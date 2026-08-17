// ═══════════════════════════════════════════════════════════════════════════
//  ALTİGEN İDARÎ BÖLGE ÜYELİĞİ — HXD-3
//  ---------------------------------------------------------------------------
//  Canlı 152 bölgeyi değiştirmeden HexGeography hücrelerini bölge kümelerine
//  bağlar. Üyelik, sınır ve fiziksel komşuluk salt-okunur bir sidecar'dır.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_HEX_REGIONS_SCHEMA_VERSION = 1;
const STORY_HEX_REGIONS_ADAPTER_VERSION = 'story-hex-regions-1';
const STORY_HEX_POLITICAL_ADAPTER_VERSION = 'story-hex-political-view-1';
let STORY_HEX_REGIONS_CACHE = null;
let STORY_HEX_POLITICAL_CACHE = null;

function storyHexRegionsHashInt(hash, value) {
    const integer = Number(value) | 0;
    for (let shift = 0; shift < 32; shift += 8) {
        hash ^= (integer >>> shift) & 255;
        hash = Math.imul(hash, 0x01000193);
    }
    return hash;
}

function storyHexRegionsHashArrays(arrays) {
    let hash = 0x811c9dc5;
    for (const values of arrays || []) {
        hash = storyHexRegionsHashInt(hash, values.length);
        for (let index = 0; index < values.length; index++) {
            hash = storyHexRegionsHashInt(hash, values[index]);
        }
    }
    return `fnv1a32:${(`00000000${(hash >>> 0).toString(16)}`).slice(-8)}`;
}

function storyHexRegionsSourceHash(geography, nodes) {
    const topologyHash = typeof storyRegionTopologyHash === 'function'
        ? storyRegionTopologyHash(nodes || [])
        : storyHexWorldHashText(JSON.stringify((nodes || []).map(node => ({
            id: Number(node.id), x: Number(node.lx), y: Number(node.ly)
        }))));
    return storyHexWorldHashText(JSON.stringify({
        schemaVersion: STORY_HEX_REGIONS_SCHEMA_VERSION,
        adapterVersion: STORY_HEX_REGIONS_ADAPTER_VERSION,
        geographyHash: geography.geographyHash,
        topologyHash,
        regionCount: (nodes || []).length
    }));
}

function storyHexRegionsLegacyEdgeSet(nodes) {
    const edges = new Set();
    for (const node of nodes || []) {
        const a = Number(node.id);
        for (const value of node.neighbors || []) {
            const b = Number(value);
            if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) continue;
            edges.add(a < b ? `${a}:${b}` : `${b}:${a}`);
        }
    }
    return edges;
}

function storyHexRegionsCreate(options) {
    options = options || {};
    const world = options.world || storyHexWorldEnsure();
    const geography = options.geography || storyHexGeographyEnsure();
    const nodes = options.nodes || STORY.nodes || [];
    const regionCount = nodes.length;
    if (!world || !geography || !regionCount) throw new Error('HEX_REGIONS_SOURCE_MISSING');
    const cellRegionIds = geography.regionIds.slice();
    const regionCellCounts = new Uint32Array(regionCount);
    const regionLandCoverageBps = new Uint32Array(regionCount);
    let assignedCellCount = 0;
    let unassignedLandCells = 0;
    for (let index = 0; index < world.cellCount; index++) {
        const regionId = Number(cellRegionIds[index]);
        const coverage = Number(geography.landCoverageBps[index]);
        if (coverage <= 0) {
            cellRegionIds[index] = -1;
            continue;
        }
        if (regionId < 0 || regionId >= regionCount) {
            cellRegionIds[index] = -1;
            unassignedLandCells++;
            continue;
        }
        assignedCellCount++;
        regionCellCounts[regionId]++;
        regionLandCoverageBps[regionId] += coverage;
    }

    const regionCellOffsets = new Uint32Array(regionCount + 1);
    for (let regionId = 0; regionId < regionCount; regionId++) {
        regionCellOffsets[regionId + 1] = regionCellOffsets[regionId] + regionCellCounts[regionId];
    }
    const regionCellIndices = new Uint16Array(assignedCellCount);
    const writeOffsets = regionCellOffsets.slice(0, regionCount);
    for (let cellIndex = 0; cellIndex < world.cellCount; cellIndex++) {
        const regionId = Number(cellRegionIds[cellIndex]);
        if (regionId >= 0) regionCellIndices[writeOffsets[regionId]++] = cellIndex;
    }

    const borderA = [];
    const borderB = [];
    const borderDirection = [];
    const borderRegionA = [];
    const borderRegionB = [];
    const physicalEdges = new Set();
    const neighborSets = Array.from({ length: regionCount }, () => new Set());
    for (let cellIndex = 0; cellIndex < world.cellCount; cellIndex++) {
        const regionA = Number(cellRegionIds[cellIndex]);
        if (regionA < 0) continue;
        const q = Number(world.qValues[cellIndex]);
        const r = Number(world.rValues[cellIndex]);
        for (let direction = 0; direction < 6; direction++) {
            const delta = STORY_HEX_WORLD_NEIGHBOR_DIRECTIONS[direction];
            const neighborIndex = storyHexWorldIndex(world, q + delta[0], r + delta[1]);
            if (neighborIndex <= cellIndex) continue;
            const regionB = Number(cellRegionIds[neighborIndex]);
            if (regionB < 0 || regionA === regionB) continue;
            borderA.push(cellIndex);
            borderB.push(neighborIndex);
            borderDirection.push(direction);
            borderRegionA.push(regionA);
            borderRegionB.push(regionB);
            neighborSets[regionA].add(regionB);
            neighborSets[regionB].add(regionA);
            physicalEdges.add(regionA < regionB ? `${regionA}:${regionB}` : `${regionB}:${regionA}`);
        }
    }

    const regionNeighborOffsets = new Uint32Array(regionCount + 1);
    const sortedNeighbors = neighborSets.map(set => [...set].sort((a, b) => a - b));
    for (let regionId = 0; regionId < regionCount; regionId++) {
        regionNeighborOffsets[regionId + 1] = regionNeighborOffsets[regionId]
            + sortedNeighbors[regionId].length;
    }
    const regionNeighborIds = new Uint16Array(regionNeighborOffsets[regionCount]);
    let neighborCursor = 0;
    for (const neighbors of sortedNeighbors) {
        for (const neighborId of neighbors) regionNeighborIds[neighborCursor++] = neighborId;
    }

    const borderCellA = Uint16Array.from(borderA);
    const borderCellB = Uint16Array.from(borderB);
    const borderDirections = Uint8Array.from(borderDirection);
    const borderRegionIdsA = Uint16Array.from(borderRegionA);
    const borderRegionIdsB = Uint16Array.from(borderRegionB);
    const legacyEdges = storyHexRegionsLegacyEdgeSet(nodes);
    const sharedEdges = [...physicalEdges].filter(edge => legacyEdges.has(edge)).length;
    const hashFields = [
        cellRegionIds, regionCellCounts, regionLandCoverageBps,
        regionCellOffsets, regionCellIndices, regionNeighborOffsets, regionNeighborIds,
        borderCellA, borderCellB, borderDirections, borderRegionIdsA, borderRegionIdsB
    ];
    const membershipHash = storyHexRegionsHashArrays(hashFields);
    const byteLength = hashFields.reduce((total, values) => total + values.byteLength, 0);
    return {
        schemaVersion: STORY_HEX_REGIONS_SCHEMA_VERSION,
        adapterVersion: STORY_HEX_REGIONS_ADAPTER_VERSION,
        sourceHash: storyHexRegionsSourceHash(geography, nodes),
        geographyHash: geography.geographyHash,
        membershipHash,
        cellCount: world.cellCount,
        regionCount,
        cellRegionIds,
        regionCellCounts,
        regionLandCoverageBps,
        regionCellOffsets,
        regionCellIndices,
        regionNeighborOffsets,
        regionNeighborIds,
        borderCellA,
        borderCellB,
        borderDirections,
        borderRegionIdsA,
        borderRegionIdsB,
        diagnostics: {
            loadMode: String(options.loadMode || 'runtime'),
            byteLength,
            assignedCellCount,
            unassignedLandCells,
            representedRegionCount: regionCellCounts.reduce(
                (count, value) => count + (value > 0 ? 1 : 0), 0
            ),
            borderEdgeCount: borderCellA.length,
            physicalNeighborPairCount: physicalEdges.size,
            legacyNeighborPairCount: legacyEdges.size,
            sharedNeighborPairCount: sharedEdges,
            physicalOnlyNeighborPairCount: physicalEdges.size - sharedEdges,
            legacyOnlyNeighborPairCount: legacyEdges.size - sharedEdges
        }
    };
}

function storyHexRegionsValidate(model, world, geography, nodes) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    const hexWorld = world || storyHexWorldEnsure();
    const hexGeography = geography || storyHexGeographyEnsure();
    const sourceNodes = nodes || STORY.nodes || [];
    if (!model || typeof model !== 'object') return { ok: false, issues: [{ code: 'MODEL_REQUIRED', path: '$', message: 'HexRegions nesnesi zorunlu.' }] };
    if (model.schemaVersion !== STORY_HEX_REGIONS_SCHEMA_VERSION) add('SCHEMA_VERSION', '$.schemaVersion', 'HexRegions şeması uyuşmuyor.');
    if (model.adapterVersion !== STORY_HEX_REGIONS_ADAPTER_VERSION) add('ADAPTER_VERSION', '$.adapterVersion', 'HexRegions adaptörü uyuşmuyor.');
    if (model.geographyHash !== hexGeography.geographyHash) add('GEOGRAPHY_HASH_SOURCE', '$.geographyHash', 'Coğrafya kaynağı uyuşmuyor.');
    if (model.cellCount !== hexWorld.cellCount) add('CELL_COUNT', '$.cellCount', 'Hücre sayısı uyuşmuyor.');
    if (model.regionCount !== sourceNodes.length) add('REGION_COUNT', '$.regionCount', 'Bölge sayısı canlı dünyayla uyuşmuyor.');
    const exactLengths = {
        cellRegionIds: hexWorld.cellCount,
        regionCellCounts: sourceNodes.length,
        regionLandCoverageBps: sourceNodes.length,
        regionCellOffsets: sourceNodes.length + 1,
        regionNeighborOffsets: sourceNodes.length + 1
    };
    for (const [field, length] of Object.entries(exactLengths)) {
        if (!model[field] || model[field].length !== length) add('ARRAY_LENGTH', `$.${field}`, `${field} uzunluğu uyuşmuyor.`);
    }
    const borderLength = model.borderCellA && model.borderCellA.length;
    for (const field of ['borderCellB', 'borderDirections', 'borderRegionIdsA', 'borderRegionIdsB']) {
        if (!model[field] || model[field].length !== borderLength) add('BORDER_ARRAY_LENGTH', `$.${field}`, 'Sınır dizileri aynı uzunlukta olmalı.');
    }
    if (!issues.length) {
        for (let cellIndex = 0; cellIndex < hexWorld.cellCount; cellIndex++) {
            const regionId = Number(model.cellRegionIds[cellIndex]);
            const coverage = Number(hexGeography.landCoverageBps[cellIndex]);
            if (coverage > 0 && (regionId < 0 || regionId >= model.regionCount)) add('LAND_REGION_MISSING', `$.cellRegionIds[${cellIndex}]`, 'Kara/kıyı hücresi geçerli bölge taşımalı.');
            if (coverage === 0 && regionId !== -1) add('WATER_REGION_LEAK', `$.cellRegionIds[${cellIndex}]`, 'Saf su hücresi idarî kara bölgesi taşıyamaz.');
        }
        for (let regionId = 0; regionId < model.regionCount; regionId++) {
            const start = Number(model.regionCellOffsets[regionId]);
            const end = Number(model.regionCellOffsets[regionId + 1]);
            if (end < start || end - start !== Number(model.regionCellCounts[regionId])) add('MEMBERSHIP_OFFSET', `$.regionCellOffsets[${regionId}]`, 'Bölge CSR üyeliği tutarsız.');
            if (end === start) add('REGION_UNREPRESENTED', `$.regionCellCounts[${regionId}]`, 'Bölge hiçbir altıgende temsil edilmiyor.');
            for (let cursor = start; cursor < end; cursor++) {
                const cellIndex = Number(model.regionCellIndices[cursor]);
                if (cellIndex >= model.cellCount || Number(model.cellRegionIds[cellIndex]) !== regionId) add('MEMBERSHIP_INDEX', `$.regionCellIndices[${cursor}]`, 'CSR hücresi bölge üyeliğiyle uyuşmuyor.');
            }
            const neighborStart = Number(model.regionNeighborOffsets[regionId]);
            const neighborEnd = Number(model.regionNeighborOffsets[regionId + 1]);
            for (let cursor = neighborStart; cursor < neighborEnd; cursor++) {
                const neighborId = Number(model.regionNeighborIds[cursor]);
                const reverseStart = Number(model.regionNeighborOffsets[neighborId]);
                const reverseEnd = Number(model.regionNeighborOffsets[neighborId + 1]);
                let reverse = false;
                for (let reverseCursor = reverseStart; reverseCursor < reverseEnd; reverseCursor++) {
                    if (Number(model.regionNeighborIds[reverseCursor]) === regionId) reverse = true;
                }
                if (!reverse) add('NEIGHBOR_ASYMMETRY', `$.regionNeighborIds[${cursor}]`, 'Fiziksel bölge komşuluğu simetrik değil.');
            }
        }
        for (let index = 0; index < borderLength; index++) {
            const a = Number(model.borderCellA[index]);
            const b = Number(model.borderCellB[index]);
            const direction = Number(model.borderDirections[index]);
            const delta = STORY_HEX_WORLD_NEIGHBOR_DIRECTIONS[direction];
            const expected = storyHexWorldIndex(
                hexWorld,
                Number(hexWorld.qValues[a]) + delta[0],
                Number(hexWorld.rValues[a]) + delta[1]
            );
            if (expected !== b) add('BORDER_NOT_ADJACENT', `$.borderCellB[${index}]`, 'Sınır yalnız ortak kenarlı hücreler arasında olabilir.');
            if (Number(model.cellRegionIds[a]) !== Number(model.borderRegionIdsA[index])
                || Number(model.cellRegionIds[b]) !== Number(model.borderRegionIdsB[index])
                || Number(model.borderRegionIdsA[index]) === Number(model.borderRegionIdsB[index])) {
                add('BORDER_REGION', `$.borderRegionIdsA[${index}]`, 'Sınır bölge kimlikleri hücrelerle uyuşmuyor.');
            }
        }
        const hashFields = [
            model.cellRegionIds, model.regionCellCounts, model.regionLandCoverageBps,
            model.regionCellOffsets, model.regionCellIndices, model.regionNeighborOffsets,
            model.regionNeighborIds, model.borderCellA, model.borderCellB,
            model.borderDirections, model.borderRegionIdsA, model.borderRegionIdsB
        ];
        if (model.membershipHash !== storyHexRegionsHashArrays(hashFields)) add('MEMBERSHIP_HASH', '$.membershipHash', 'Üyelik checksum uyuşmuyor.');
    }
    return { ok: issues.length === 0, issues: issues.slice(0, 50) };
}

function storyHexPoliticalOwnerSourceHash(model, nodes) {
    return storyHexWorldHashText(JSON.stringify({
        adapterVersion: STORY_HEX_POLITICAL_ADAPTER_VERSION,
        membershipHash: model.membershipHash,
        owners: (nodes || []).map(node => [Number(node.id), Number(node.owner)])
    }));
}

function storyHexPoliticalViewCreate(options) {
    options = options || {};
    const world = options.world || storyHexWorldEnsure();
    const model = options.model || storyHexRegionsEnsure();
    const nodes = options.nodes || STORY.nodes || [];
    const ownerByRegion = new Int16Array(model.regionCount);
    ownerByRegion.fill(-1);
    for (const node of nodes) {
        const regionId = Number(node.id);
        if (regionId >= 0 && regionId < ownerByRegion.length) ownerByRegion[regionId] = Number(node.owner);
    }
    const cellOwnerIds = new Int16Array(model.cellCount);
    cellOwnerIds.fill(-1);
    const nationalBorderMask = new Uint8Array(model.cellCount);
    for (let cellIndex = 0; cellIndex < model.cellCount; cellIndex++) {
        const regionId = Number(model.cellRegionIds[cellIndex]);
        if (regionId >= 0) cellOwnerIds[cellIndex] = ownerByRegion[regionId];
    }
    let nationalBorderEdgeCount = 0;
    for (let cellIndex = 0; cellIndex < model.cellCount; cellIndex++) {
        const owner = Number(cellOwnerIds[cellIndex]);
        if (owner < 0) continue;
        const q = Number(world.qValues[cellIndex]);
        const r = Number(world.rValues[cellIndex]);
        for (let direction = 0; direction < 6; direction++) {
            const delta = STORY_HEX_WORLD_NEIGHBOR_DIRECTIONS[direction];
            const neighbor = storyHexWorldIndex(world, q + delta[0], r + delta[1]);
            if (neighbor < 0) continue;
            const neighborOwner = Number(cellOwnerIds[neighbor]);
            if (neighborOwner < 0 || neighborOwner === owner) continue;
            nationalBorderMask[cellIndex] |= 1 << direction;
            if (neighbor > cellIndex) nationalBorderEdgeCount++;
        }
    }
    const ownershipHash = storyHexRegionsHashArrays([
        ownerByRegion, cellOwnerIds, nationalBorderMask
    ]);
    return {
        schemaVersion: STORY_HEX_REGIONS_SCHEMA_VERSION,
        adapterVersion: STORY_HEX_POLITICAL_ADAPTER_VERSION,
        membershipHash: model.membershipHash,
        sourceHash: storyHexPoliticalOwnerSourceHash(model, nodes),
        ownershipHash,
        regionCount: model.regionCount,
        cellCount: model.cellCount,
        ownerByRegion,
        cellOwnerIds,
        nationalBorderMask,
        diagnostics: {
            loadMode: String(options.loadMode || 'runtime'),
            byteLength: ownerByRegion.byteLength + cellOwnerIds.byteLength
                + nationalBorderMask.byteLength,
            ownedCellCount: cellOwnerIds.reduce((count, owner) => count + (owner >= 0 ? 1 : 0), 0),
            nationalBorderEdgeCount
        }
    };
}

function storyHexPoliticalViewValidate(view, world, model, nodes) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    const hexWorld = world || storyHexWorldEnsure();
    const hexRegions = model || storyHexRegionsEnsure();
    const sourceNodes = nodes || STORY.nodes || [];
    if (!view || typeof view !== 'object') return { ok: false, issues: [{ code: 'VIEW_REQUIRED', path: '$', message: 'HexPoliticalView zorunlu.' }] };
    if (view.schemaVersion !== STORY_HEX_REGIONS_SCHEMA_VERSION) add('SCHEMA_VERSION', '$.schemaVersion', 'Politik görünüm şeması uyuşmuyor.');
    if (view.adapterVersion !== STORY_HEX_POLITICAL_ADAPTER_VERSION) add('ADAPTER_VERSION', '$.adapterVersion', 'Politik görünüm adaptörü uyuşmuyor.');
    if (view.membershipHash !== hexRegions.membershipHash) add('MEMBERSHIP_SOURCE', '$.membershipHash', 'Politik görünüm yanlış üyelik kaynağına bağlı.');
    if (view.sourceHash !== storyHexPoliticalOwnerSourceHash(hexRegions, sourceNodes)) add('OWNER_SOURCE', '$.sourceHash', 'Politik görünüm güncel sahipliğe ait değil.');
    if (!view.ownerByRegion || view.ownerByRegion.length !== hexRegions.regionCount) add('OWNER_REGION_LENGTH', '$.ownerByRegion', 'Bölge sahip dizisi uyuşmuyor.');
    if (!view.cellOwnerIds || view.cellOwnerIds.length !== hexRegions.cellCount) add('OWNER_CELL_LENGTH', '$.cellOwnerIds', 'Hücre sahip dizisi uyuşmuyor.');
    if (!view.nationalBorderMask || view.nationalBorderMask.length !== hexRegions.cellCount) add('BORDER_MASK_LENGTH', '$.nationalBorderMask', 'Devlet sınır maskesi uyuşmuyor.');
    if (!issues.length) {
        for (let regionId = 0; regionId < hexRegions.regionCount; regionId++) {
            const node = sourceNodes[regionId];
            if (!node || Number(view.ownerByRegion[regionId]) !== Number(node.owner)) add('REGION_OWNER', `$.ownerByRegion[${regionId}]`, 'Bölge sahibi canlı dünyayla uyuşmuyor.');
        }
        for (let cellIndex = 0; cellIndex < hexRegions.cellCount; cellIndex++) {
            const regionId = Number(hexRegions.cellRegionIds[cellIndex]);
            const expectedOwner = regionId >= 0 ? Number(view.ownerByRegion[regionId]) : -1;
            if (Number(view.cellOwnerIds[cellIndex]) !== expectedOwner) add('CELL_OWNER', `$.cellOwnerIds[${cellIndex}]`, 'Hücre sahibi bölge sahibinden türemiyor.');
            const q = Number(hexWorld.qValues[cellIndex]);
            const r = Number(hexWorld.rValues[cellIndex]);
            for (let direction = 0; direction < 6; direction++) {
                const delta = STORY_HEX_WORLD_NEIGHBOR_DIRECTIONS[direction];
                const neighbor = storyHexWorldIndex(hexWorld, q + delta[0], r + delta[1]);
                if (neighbor < 0) continue;
                const owner = Number(view.cellOwnerIds[cellIndex]);
                const neighborOwner = Number(view.cellOwnerIds[neighbor]);
                const expected = owner >= 0 && neighborOwner >= 0 && owner !== neighborOwner;
                const actual = ((Number(view.nationalBorderMask[cellIndex]) >> direction) & 1) === 1;
                if (actual !== expected) add('NATIONAL_BORDER', `$.nationalBorderMask[${cellIndex}]`, 'Devlet sınırı sahiplik geçişiyle uyuşmuyor.');
            }
            if (issues.length >= 50) break;
        }
        const expectedHash = storyHexRegionsHashArrays([
            view.ownerByRegion, view.cellOwnerIds, view.nationalBorderMask
        ]);
        if (view.ownershipHash !== expectedHash) add('OWNERSHIP_HASH', '$.ownershipHash', 'Politik sahiplik checksum uyuşmuyor.');
    }
    return { ok: issues.length === 0, issues: issues.slice(0, 50) };
}

function storyHexRegionsStable(value) {
    if (value == null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(storyHexRegionsStable).join(',')}]`;
    const keys = Object.keys(value).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${storyHexRegionsStable(value[key])}`).join(',')}}`;
}

function storyHexRegionsEconomicPayload(regionIds) {
    const ids = [...regionIds].sort((a, b) => a - b);
    const regional = STORY.regionalEconomy && STORY.regionalEconomy.regions || {};
    const population = STORY.population && STORY.population.regions || {};
    const companies = STORY.companyEconomy || {};
    const regionKeys = new Set(ids.map(id => `region:${id}`));
    const nodes = ids.map(id => STORY.nodes[id]).filter(Boolean);
    const stockTotals = {};
    let populationPeople = 0;
    for (const id of ids) {
        const key = `region:${id}`;
        const stock = regional[key] && regional[key].stocks || {};
        for (const [resource, value] of Object.entries(stock)) {
            stockTotals[resource] = Math.round(((stockTotals[resource] || 0) + Number(value || 0)) * 1e6) / 1e6;
        }
        populationPeople += Number(population[key] && population[key].populationPeople || 0);
    }
    const facilities = Object.values(companies.facilities || {}).filter(row => regionKeys.has(row.regionId));
    const warehouses = Object.values(companies.warehouses || {}).filter(row => regionKeys.has(row.regionId));
    const companySummary = typeof storyCompanySummary === 'function' ? storyCompanySummary() : null;
    const budgetSummary = typeof storyBudgetSummary === 'function' ? storyBudgetSummary() : null;
    const infrastructure = typeof storyInfrastructureSnapshot === 'function'
        ? storyInfrastructureSnapshot() : null;
    return {
        regionIds: ids,
        owners: nodes.map(node => [Number(node.id), Number(node.owner)]),
        nodeTotals: {
            population: nodes.reduce((sum, node) => sum + Number(node.pop || 0), 0),
            wealth: nodes.reduce((sum, node) => sum + Number(node.wealth || 0), 0),
            garrison: nodes.reduce((sum, node) => sum + Number(node.garrison || 0), 0),
            factories: nodes.reduce((sum, node) => sum + Number(node.fac || 0), 0),
            barracks: nodes.reduce((sum, node) => sum + Number(node.bar || 0), 0),
            oil: nodes.reduce((sum, node) => sum + Number(node.oil || 0), 0),
            points: nodes.reduce((sum, node) => sum + Number(node.pts || 0), 0)
        },
        populationPeople,
        stockTotals,
        companies: companySummary ? {
            companyCount: companySummary.companyCount,
            bankCount: companySummary.bankCount,
            facilityCount: facilities.length,
            warehouseCount: warehouses.length,
            totalCompanyCash: companySummary.totalCompanyCash,
            totalCompanyDebt: companySummary.totalCompanyDebt,
            totalBankReserves: companySummary.totalBankReserves,
            marketClearingCash: companySummary.marketClearingCash
        } : null,
        budget: budgetSummary,
        infrastructure: infrastructure ? {
            corridorCount: infrastructure.corridors.length,
            byMode: infrastructure.summary && infrastructure.summary.byMode
        } : null
    };
}

function storyHexRegionsReconcile(model) {
    const hexRegions = model || storyHexRegionsEnsure();
    const sourceIds = (STORY.nodes || []).map(node => Number(node.id));
    const projectedIds = [];
    for (let regionId = 0; regionId < hexRegions.regionCount; regionId++) {
        if (Number(hexRegions.regionCellCounts[regionId]) > 0) projectedIds.push(regionId);
    }
    const source = storyHexRegionsEconomicPayload(sourceIds);
    const projected = storyHexRegionsEconomicPayload(projectedIds);
    const sourceHash = storyHexWorldHashText(storyHexRegionsStable(source));
    const projectedHash = storyHexWorldHashText(storyHexRegionsStable(projected));
    const validRegionKeys = new Set(sourceIds.map(id => `region:${id}`));
    const company = STORY.companyEconomy || {};
    const invalidFacilityRegionIds = Object.values(company.facilities || {})
        .filter(row => !validRegionKeys.has(row.regionId)).map(row => row.id).sort();
    const invalidWarehouseRegionIds = Object.values(company.warehouses || {})
        .filter(row => !validRegionKeys.has(row.regionId)).map(row => row.id).sort();
    const missingRegionalIds = sourceIds
        .filter(id => !(STORY.regionalEconomy && STORY.regionalEconomy.regions
            && STORY.regionalEconomy.regions[`region:${id}`]));
    const missingPopulationIds = sourceIds
        .filter(id => !(STORY.population && STORY.population.regions
            && STORY.population.regions[`region:${id}`]));
    return {
        sourceHash,
        projectedHash,
        equal: sourceHash === projectedHash,
        source,
        projected,
        referencesValid: !invalidFacilityRegionIds.length && !invalidWarehouseRegionIds.length
            && !missingRegionalIds.length && !missingPopulationIds.length,
        diagnostics: {
            invalidFacilityRegionIds,
            invalidWarehouseRegionIds,
            missingRegionalIds,
            missingPopulationIds
        }
    };
}

function storyHexRegionsEnsure() {
    const world = storyHexWorldEnsure();
    const geography = storyHexGeographyEnsure();
    const sourceHash = storyHexRegionsSourceHash(geography, STORY.nodes || []);
    if (STORY_HEX_REGIONS_CACHE && STORY_HEX_REGIONS_CACHE.sourceHash === sourceHash) return STORY_HEX_REGIONS_CACHE;
    const model = storyHexRegionsCreate({ world, geography, nodes: STORY.nodes, loadMode: 'runtime' });
    const validation = storyHexRegionsValidate(model, world, geography, STORY.nodes);
    if (!validation.ok) throw new Error(`HEX_REGIONS_INVALID:${validation.issues.map(issue => issue.code).join(',')}`);
    STORY_HEX_REGIONS_CACHE = model;
    return model;
}

function storyHexPoliticalViewEnsure() {
    const world = storyHexWorldEnsure();
    const model = storyHexRegionsEnsure();
    const sourceHash = storyHexPoliticalOwnerSourceHash(model, STORY.nodes || []);
    if (STORY_HEX_POLITICAL_CACHE && STORY_HEX_POLITICAL_CACHE.sourceHash === sourceHash) return STORY_HEX_POLITICAL_CACHE;
    const view = storyHexPoliticalViewCreate({ world, model, nodes: STORY.nodes, loadMode: 'runtime' });
    const validation = storyHexPoliticalViewValidate(view, world, model, STORY.nodes);
    if (!validation.ok) throw new Error(`HEX_POLITICAL_INVALID:${validation.issues.map(issue => issue.code).join(',')}`);
    STORY_HEX_POLITICAL_CACHE = view;
    return view;
}

function storyHexRegionsResetCache() {
    STORY_HEX_REGIONS_CACHE = null;
    STORY_HEX_POLITICAL_CACHE = null;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STORY_HEX_REGIONS_SCHEMA_VERSION,
        STORY_HEX_REGIONS_ADAPTER_VERSION,
        STORY_HEX_POLITICAL_ADAPTER_VERSION,
        storyHexRegionsSourceHash,
        storyHexRegionsCreate,
        storyHexRegionsValidate,
        storyHexRegionsEnsure,
        storyHexRegionsResetCache,
        storyHexPoliticalOwnerSourceHash,
        storyHexPoliticalViewCreate,
        storyHexPoliticalViewValidate,
        storyHexPoliticalViewEnsure,
        storyHexRegionsReconcile
    };
}
