// ═══════════════════════════════════════════════════════════════════════════
//  DİNAMİK ŞEHİR AYAK İZİ — HXD-6
//  ---------------------------------------------------------------------------
//  Şehir büyüklüğünü tek `level` sprite'ından çıkarır. Nüfus, zenginlik,
//  mevcut fiziksel bina yatırımı ve liman hizmeti; kendi idarî bölgesindeki
//  geçilebilir altıgenlere deterministik ilçeler olarak yerleşir.
//
//  Bu model bir sidecar'dır: kayıt dosyasına yazılmaz, dünyayı değiştirmez ve
//  her yüklemede kanonik dünya sicillerinden yeniden türetilir.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_HEX_URBAN_SCHEMA_VERSION = 1;
const STORY_HEX_URBAN_ADAPTER_VERSION = 'story-hex-urban-footprint-1';

const STORY_HEX_URBAN_KIND = Object.freeze({
    CORE: 0,
    RESIDENTIAL: 1,
    INDUSTRIAL: 2,
    CIVIC: 3,
    DEFENSE: 4,
    LOGISTICS: 5
});
const STORY_HEX_URBAN_KIND_NAME = Object.freeze([
    'CORE', 'RESIDENTIAL', 'INDUSTRIAL', 'CIVIC', 'DEFENSE', 'LOGISTICS'
]);

let STORY_HEX_URBAN_CACHE = null;
let STORY_HEX_URBAN_CANDIDATE_CACHE = null;

function storyHexUrbanClamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
}

function storyHexUrbanPopulation(node) {
    const regionId = `region:${Number(node && node.id)}`;
    const ledgerRegion = typeof STORY !== 'undefined' && STORY.population
        && STORY.population.regions && STORY.population.regions[regionId];
    if (ledgerRegion && Number.isFinite(Number(ledgerRegion.populationPeople))) {
        return { people: Math.max(0, Math.round(Number(ledgerRegion.populationPeople))), source: 'POPULATION_LEDGER' };
    }
    if (node && Number.isFinite(Number(node.pop)) && Number(node.pop) > 0) {
        return { people: Math.max(0, Math.round(Number(node.pop) * 1000)), source: 'NODE_POPULATION' };
    }
    // Eski kayıtta ilk büyüme tiki henüz çalışmadıysa sessiz sayı uydurma:
    // legacy level yalnız görünür ve sayılabilir bir uyumluluk fallback'idir.
    const legacyLevel = storyHexUrbanClamp(node && node.level, 1, 3);
    return {
        people: Math.round((10 + (legacyLevel - 1) * 28) * 1000),
        source: 'LEGACY_LEVEL_POPULATION_FALLBACK'
    };
}

function storyHexUrbanInvestment(node) {
    const value = key => Math.max(0, Number(node && node[key]) | 0);
    const industrial = value('fac') + value('art');
    const defense = value('bar') + value('air') + value('sup') + value('aad');
    return {
        industrial,
        defense,
        total: industrial + defense,
        buildings: {
            fac: value('fac'), bar: value('bar'), art: value('art'),
            air: value('air'), sup: value('sup'), aad: value('aad')
        }
    };
}

function storyHexUrbanDemand(node, settlementRecord) {
    const population = storyHexUrbanPopulation(node);
    const investment = storyHexUrbanInvestment(node);
    const wealth = Math.max(0, Number(node && node.wealth) || 0);
    const residential = storyHexUrbanClamp(Math.ceil(population.people / 35000), 1, 4);
    const industrial = investment.industrial > 0
        ? storyHexUrbanClamp(Math.ceil(investment.industrial / 3), 1, 2) : 0;
    const defense = investment.defense > 0
        ? storyHexUrbanClamp(Math.ceil(investment.defense / 4), 1, 2) : 0;
    const civic = population.people >= 30000 || wealth >= 18 ? 1 : 0;
    const logistics = settlementRecord && settlementRecord.port ? 1 : 0;
    const kinds = [];
    for (let i = 0; i < residential; i++) kinds.push(STORY_HEX_URBAN_KIND.RESIDENTIAL);
    for (let i = 0; i < industrial; i++) kinds.push(STORY_HEX_URBAN_KIND.INDUSTRIAL);
    if (civic) kinds.push(STORY_HEX_URBAN_KIND.CIVIC);
    for (let i = 0; i < defense; i++) kinds.push(STORY_HEX_URBAN_KIND.DEFENSE);
    if (logistics) kinds.push(STORY_HEX_URBAN_KIND.LOGISTICS);
    return {
        populationPeople: population.people,
        populationSource: population.source,
        wealth,
        investment,
        requested: { residential, industrial, civic, defense, logistics },
        kinds: kinds.slice(0, 8)
    };
}

function storyHexUrbanDistance(world, aIndex, bIndex) {
    const aq = Number(world.qValues[aIndex]), ar = Number(world.rValues[aIndex]);
    const bq = Number(world.qValues[bIndex]), br = Number(world.rValues[bIndex]);
    const dq = aq - bq, dr = ar - br;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

function storyHexUrbanCandidates(world, geography, regionId, coreIndex) {
    const candidates = [];
    for (let index = 0; index < world.cellCount; index++) {
        if (index === coreIndex || Number(geography.regionIds[index]) !== regionId) continue;
        if (!(Number(geography.movementMask[index]) & STORY_HEX_MOVEMENT_LAND)) continue;
        if (Number(geography.terrainClass[index]) === STORY_HEX_TERRAIN_IMPASSABLE) continue;
        const distance = storyHexUrbanDistance(world, coreIndex, index);
        candidates.push({ index, distance });
    }
    candidates.sort((a, b) => a.distance - b.distance || a.index - b.index);
    return candidates;
}

function storyHexUrbanCandidateRegistry(world, geography, settlements, cityCount) {
    const sourceKey = `${world.layoutHash}|${geography.geographyHash}|${settlements.settlementHash}|${cityCount}`;
    if (STORY_HEX_URBAN_CANDIDATE_CACHE
        && STORY_HEX_URBAN_CANDIDATE_CACHE.sourceKey === sourceKey) {
        return STORY_HEX_URBAN_CANDIDATE_CACHE;
    }
    const byCity = Array.from({ length: cityCount }, () => []);
    for (let index = 0; index < world.cellCount; index++) {
        const regionId = Number(geography.regionIds[index]);
        if (regionId < 0 || regionId >= cityCount) continue;
        if (index === Number(settlements.coreCellIndices[regionId])) continue;
        if (!(Number(geography.movementMask[index]) & STORY_HEX_MOVEMENT_LAND)) continue;
        if (Number(geography.terrainClass[index]) === STORY_HEX_TERRAIN_IMPASSABLE) continue;
        byCity[regionId].push({
            index,
            distance: storyHexUrbanDistance(
                world, Number(settlements.coreCellIndices[regionId]), index
            )
        });
    }
    for (const candidates of byCity) {
        candidates.sort((a, b) => a.distance - b.distance || a.index - b.index);
    }
    STORY_HEX_URBAN_CANDIDATE_CACHE = { sourceKey, byCity };
    return STORY_HEX_URBAN_CANDIDATE_CACHE;
}

function storyHexUrbanCell(world, index, kindCode) {
    return {
        id: storyHexWorldId(Number(world.qValues[index]), Number(world.rValues[index])),
        index,
        q: Number(world.qValues[index]),
        r: Number(world.rValues[index]),
        center: { x: Number(world.centerX[index]), y: Number(world.centerY[index]) },
        kindCode,
        kind: STORY_HEX_URBAN_KIND_NAME[kindCode] || 'UNKNOWN'
    };
}

function storyHexUrbanSourceHash(world, geography, settlements, nodes) {
    return storyHexWorldHashText(JSON.stringify({
        schemaVersion: STORY_HEX_URBAN_SCHEMA_VERSION,
        adapterVersion: STORY_HEX_URBAN_ADAPTER_VERSION,
        layoutHash: world.layoutHash,
        geographyHash: geography.geographyHash,
        settlementHash: settlements.settlementHash,
        nodes: (nodes || []).map(node => {
            const population = storyHexUrbanPopulation(node);
            const investment = storyHexUrbanInvestment(node);
            return [node.id, population.people, population.source,
                Number(node.wealth) || 0, investment.buildings];
        })
    }));
}

function storyHexUrbanFootprintsCreate(options) {
    options = options || {};
    const world = options.world || storyHexWorldEnsure();
    const geography = options.geography || storyHexGeographyEnsure();
    const settlements = options.settlements || storyHexSettlementsEnsure();
    const nodes = options.nodes || STORY.nodes || [];
    const records = [];
    const cellIndices = [];
    const kindCodes = [];
    const cityOffsets = new Uint16Array(nodes.length + 1);
    const occupied = new Set();
    const kindCounts = Object.fromEntries(STORY_HEX_URBAN_KIND_NAME.map(name => [name, 0]));
    let compatibilityFallbackCount = 0;
    let requestedDistrictCount = 0;
    let allocatedDistrictCount = 0;
    let truncatedCityCount = 0;
    const candidateRegistry = storyHexUrbanCandidateRegistry(
        world, geography, settlements, nodes.length
    );

    for (let cityId = 0; cityId < nodes.length; cityId++) {
        const node = nodes[cityId];
        const settlement = settlements.records[cityId];
        const coreIndex = Number(settlements.coreCellIndices[cityId]);
        const demand = storyHexUrbanDemand(node, settlement);
        if (demand.populationSource === 'LEGACY_LEVEL_POPULATION_FALLBACK') compatibilityFallbackCount++;
        requestedDistrictCount += demand.kinds.length;
        const candidates = candidateRegistry.byCity[cityId]
            .filter(candidate => !occupied.has(candidate.index));
        const districts = [storyHexUrbanCell(world, coreIndex, STORY_HEX_URBAN_KIND.CORE)];
        occupied.add(coreIndex);
        kindCounts.CORE++;
        for (let slot = 0; slot < demand.kinds.length && slot < candidates.length; slot++) {
            const candidate = candidates[slot];
            const kindCode = demand.kinds[slot];
            occupied.add(candidate.index);
            districts.push(storyHexUrbanCell(world, candidate.index, kindCode));
            kindCounts[STORY_HEX_URBAN_KIND_NAME[kindCode]]++;
            allocatedDistrictCount++;
        }
        if (districts.length - 1 < demand.kinds.length) truncatedCityCount++;
        cityOffsets[cityId] = cellIndices.length;
        for (const district of districts) {
            cellIndices.push(district.index);
            kindCodes.push(district.kindCode);
        }
        records.push({
            cityId,
            name: String(node.name || settlement.name || cityId),
            core: districts[0],
            populationPeople: demand.populationPeople,
            populationSource: demand.populationSource,
            wealth: demand.wealth,
            investment: demand.investment,
            requested: demand.requested,
            requestedDistrictCount: demand.kinds.length,
            allocatedDistrictCount: districts.length - 1,
            truncated: districts.length - 1 < demand.kinds.length,
            districts
        });
    }
    cityOffsets[nodes.length] = cellIndices.length;
    const cellIndexArray = Uint16Array.from(cellIndices);
    const kindCodeArray = Uint8Array.from(kindCodes);
    const footprintHash = storyHexSettlementHashArrays([
        cityOffsets, cellIndexArray, kindCodeArray
    ]);
    return {
        schemaVersion: STORY_HEX_URBAN_SCHEMA_VERSION,
        adapterVersion: STORY_HEX_URBAN_ADAPTER_VERSION,
        sourceHash: storyHexUrbanSourceHash(world, geography, settlements, nodes),
        geographyHash: geography.geographyHash,
        settlementHash: settlements.settlementHash,
        footprintHash,
        cityCount: nodes.length,
        cityOffsets,
        cellIndices: cellIndexArray,
        kindCodes: kindCodeArray,
        records,
        diagnostics: {
            loadMode: String(options.loadMode || 'runtime'),
            cityCount: nodes.length,
            footprintCellCount: cellIndexArray.length,
            requestedDistrictCount,
            allocatedDistrictCount,
            unallocatedDistrictCount: requestedDistrictCount - allocatedDistrictCount,
            truncatedCityCount,
            truncatedCityNames: records.filter(record => record.truncated).map(record => record.name),
            compatibilityFallbackCount,
            uniqueOccupiedCellCount: occupied.size,
            kindCounts,
            byteLength: cityOffsets.byteLength + cellIndexArray.byteLength + kindCodeArray.byteLength
        }
    };
}

function storyHexUrbanFootprintsValidate(model, world, geography, settlements, nodes) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    const hexWorld = world || storyHexWorldEnsure();
    const hexGeography = geography || storyHexGeographyEnsure();
    const hexSettlements = settlements || storyHexSettlementsEnsure();
    const sourceNodes = nodes || STORY.nodes || [];
    if (!model || typeof model !== 'object') return { ok: false, issues: [{ code: 'MODEL_REQUIRED', path: '$', message: 'HexUrban zorunlu.' }] };
    if (model.schemaVersion !== STORY_HEX_URBAN_SCHEMA_VERSION) add('SCHEMA_VERSION', '$.schemaVersion', 'Şehir ayak izi şeması uyuşmuyor.');
    if (model.adapterVersion !== STORY_HEX_URBAN_ADAPTER_VERSION) add('ADAPTER_VERSION', '$.adapterVersion', 'Şehir ayak izi adaptörü uyuşmuyor.');
    if (model.geographyHash !== hexGeography.geographyHash) add('GEOGRAPHY_SOURCE', '$.geographyHash', 'Şehir ayak izi yanlış coğrafyaya bağlı.');
    if (model.settlementHash !== hexSettlements.settlementHash) add('SETTLEMENT_SOURCE', '$.settlementHash', 'Şehir ayak izi yanlış yerleşim siciline bağlı.');
    if (model.cityCount !== sourceNodes.length || !Array.isArray(model.records)
        || model.records.length !== sourceNodes.length) add('CITY_COUNT', '$.records', 'Şehir ayak izi kayıt sayısı uyuşmuyor.');
    const occupied = new Set();
    if (!issues.length) for (let cityId = 0; cityId < sourceNodes.length; cityId++) {
        const record = model.records[cityId];
        if (!record || record.cityId !== cityId || !Array.isArray(record.districts)
            || !record.districts.length) { add('CITY_RECORD', `$.records[${cityId}]`, 'Şehir ayak izi kaydı eksik.'); continue; }
        if (record.districts[0].index !== Number(hexSettlements.coreCellIndices[cityId])
            || record.districts[0].kind !== 'CORE') add('CORE_BINDING', `$.records[${cityId}].core`, 'Ayak izi HXD-4 çekirdeğinden başlamalı.');
        for (const district of record.districts) {
            const index = Number(district.index);
            if (index < 0 || index >= hexWorld.cellCount) { add('CELL_INDEX', `$.records[${cityId}]`, 'İlçe dünya dışında.'); continue; }
            if (occupied.has(index)) add('CELL_COLLISION', `$.records[${cityId}]`, 'İki şehir/ilçe aynı hücreyi kullanamaz.');
            occupied.add(index);
            if (Number(hexGeography.regionIds[index]) !== cityId) add('CELL_REGION', `$.records[${cityId}]`, 'İlçe kendi idarî bölgesinde değil.');
            if (!(Number(hexGeography.movementMask[index]) & STORY_HEX_MOVEMENT_LAND)
                || Number(hexGeography.terrainClass[index]) === STORY_HEX_TERRAIN_IMPASSABLE) add('CELL_TERRAIN', `$.records[${cityId}]`, 'İlçe geçilebilir karada olmalı.');
        }
    }
    if (!issues.length) {
        const expectedHash = storyHexSettlementHashArrays([
            model.cityOffsets, model.cellIndices, model.kindCodes
        ]);
        if (model.footprintHash !== expectedHash) add('FOOTPRINT_HASH', '$.footprintHash', 'Şehir ayak izi checksum uyuşmuyor.');
    }
    return { ok: issues.length === 0, issues: issues.slice(0, 50) };
}

function storyHexUrbanFootprintsEnsure() {
    const world = storyHexWorldEnsure();
    const geography = storyHexGeographyEnsure();
    const settlements = storyHexSettlementsEnsure();
    if (!world || !geography || !settlements) return null;
    const nodes = STORY.nodes || [];
    const sourceHash = storyHexUrbanSourceHash(world, geography, settlements, nodes);
    if (STORY_HEX_URBAN_CACHE && STORY_HEX_URBAN_CACHE.sourceHash === sourceHash) return STORY_HEX_URBAN_CACHE;
    const model = storyHexUrbanFootprintsCreate({ world, geography, settlements, nodes, loadMode: 'runtime' });
    const validation = storyHexUrbanFootprintsValidate(model, world, geography, settlements, nodes);
    if (!validation.ok) throw new Error(`HEX_URBAN_INVALID:${validation.issues.map(issue => issue.code).join(',')}`);
    STORY_HEX_URBAN_CACHE = model;
    if (typeof STORY !== 'undefined') STORY._settlementLayerKey = null;
    return model;
}

function storyHexUrbanFootprintForNode(node) {
    if (!node || !Number.isInteger(Number(node.id))) return null;
    const model = storyHexUrbanFootprintsEnsure();
    return model.records[Number(node.id)] || null;
}

function storyHexUrbanResetCache() {
    STORY_HEX_URBAN_CACHE = null;
    if (typeof STORY !== 'undefined') STORY._settlementLayerKey = null;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STORY_HEX_URBAN_SCHEMA_VERSION,
        STORY_HEX_URBAN_ADAPTER_VERSION,
        STORY_HEX_URBAN_KIND,
        STORY_HEX_URBAN_KIND_NAME,
        storyHexUrbanPopulation,
        storyHexUrbanInvestment,
        storyHexUrbanDemand,
        storyHexUrbanDistance,
        storyHexUrbanCandidateRegistry,
        storyHexUrbanSourceHash,
        storyHexUrbanFootprintsCreate,
        storyHexUrbanFootprintsValidate,
        storyHexUrbanFootprintsEnsure,
        storyHexUrbanFootprintForNode,
        storyHexUrbanResetCache
    };
}
