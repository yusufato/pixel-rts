// ═══════════════════════════════════════════════════════════════════════════
//  FİZİKSEL ARAZİ KULLANIMI VE TESİS SİCİLİ — HXD-6.5
//  ---------------------------------------------------------------------------
//  Ekonomi defterindeki soyut kapasiteyi gerçek bir altıgen konumuna bağlayan
//  salt-okunur geçiş katmanı. Bu kayıt olmadan gelecekte fabrika, tarla, maden,
//  yangın veya enkaz resmi çizilemez. Şimdilik yalnız uygun gerçek şehir
//  ilçesine sığan mevcut şirket tesisleri fiziksel site olur; sığmayanlar açık
//  yerleştirme borcu olarak raporlanır, yanlış hücreye zorlanmaz.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_HEX_SITES_SCHEMA_VERSION = 2;
const STORY_HEX_SITES_ADAPTER_VERSION = 'story-hex-land-use-sites-2';

const STORY_HEX_LAND_USE_TYPES = Object.freeze([
    'NATURAL', 'RESIDENTIAL', 'COMMERCIAL', 'CIVIC', 'AGRICULTURE', 'FORESTRY',
    'EXTRACTION', 'INDUSTRIAL', 'ENERGY', 'LOGISTICS', 'DEFENSE'
]);

const STORY_HEX_SITE_TYPES = Object.freeze({
    agriculture: 'AGRICULTURE',
    energy: 'ENERGY',
    extraction: 'EXTRACTION',
    civil_industry: 'INDUSTRIAL',
    advanced_tech: 'INDUSTRIAL',
    defense_industry: 'DEFENSE'
});

const STORY_HEX_SITE_URBAN_KIND = Object.freeze({
    energy: 'INDUSTRIAL',
    civil_industry: 'INDUSTRIAL',
    advanced_tech: 'INDUSTRIAL',
    defense_industry: 'DEFENSE'
});

const STORY_HEX_URBAN_LAND_USE = Object.freeze({
    CORE: 'CIVIC',
    RESIDENTIAL: 'RESIDENTIAL',
    INDUSTRIAL: 'INDUSTRIAL',
    CIVIC: 'CIVIC',
    DEFENSE: 'DEFENSE',
    LOGISTICS: 'LOGISTICS'
});

let STORY_HEX_SITES_CACHE = null;
const STORY_HEX_SITES_TERRAIN_WATER = 0;
const STORY_HEX_SITES_TERRAIN_IMPASSABLE = 3;

function storyHexSitesHashText(text) {
    if (typeof storyHexWorldHashText === 'function') return storyHexWorldHashText(text);
    const value = String(text == null ? '' : text);
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return `fnv1a32:${(`00000000${(hash >>> 0).toString(16)}`).slice(-8)}`;
}

function storyHexSitesRegionNumber(regionId) {
    const match = /^region:(\d+)$/.exec(String(regionId || ''));
    return match ? Number(match[1]) : -1;
}

function storyHexSitesCellId(world, index) {
    const q = Number(world && world.qValues && world.qValues[index]);
    const r = Number(world && world.rValues && world.rValues[index]);
    if (!Number.isFinite(q) || !Number.isFinite(r)) return null;
    return typeof storyHexWorldId === 'function'
        ? storyHexWorldId(q, r) : `hex:${q}:${r}`;
}

function storyHexSitesHexDistance(world, aIndex, bIndex) {
    const aq = Number(world.qValues[aIndex]), ar = Number(world.rValues[aIndex]);
    const bq = Number(world.qValues[bIndex]), br = Number(world.rValues[bIndex]);
    const dq = aq - bq, dr = ar - br;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

function storyHexSitesFacilityCondition(facility) {
    const status = String(facility && facility.status || 'UNKNOWN').toUpperCase();
    if (status === 'BURNING' || status === 'ON_FIRE') return 'BURNING';
    if (status === 'DESTROYED') return 'BURNED';
    if (status === 'ABANDONED') return 'ABANDONED';
    if (status === 'DAMAGED') return 'DAMAGED';
    // Receivership is a financial/legal condition, not physical destruction.
    return 'OPERATING';
}

function storyHexSitesInstalledStage(source) {
    if (typeof storyVisualExplicitInstalledStage === 'function') {
        return storyVisualExplicitInstalledStage(source);
    }
    const value = Number(source && (source.installedVisualStage
        ?? source.visualInstalledStage ?? source.visualStage));
    return Number.isFinite(value) ? Math.max(0, Math.min(4, Math.floor(value))) : 0;
}

function storyHexSitesProjectMap(companyEconomy) {
    const byFacility = new Map();
    for (const project of (companyEconomy && companyEconomy.projects || [])) {
        if (!project || project.status !== 'BUILDING' || !project.facilityId) continue;
        if (!byFacility.has(project.facilityId)) byFacility.set(project.facilityId, []);
        byFacility.get(project.facilityId).push(project);
    }
    for (const projects of byFacility.values()) {
        projects.sort((a, b) => String(a.id).localeCompare(String(b.id), 'en'));
    }
    return byFacility;
}

function storyHexSitesSourceHash(world, geography, urban, companyEconomy, natural, agriculture, hexConstruction) {
    const facilities = Object.values(companyEconomy && companyEconomy.facilities || {})
        .map(facility => [facility.id, facility.regionId, facility.sectorId,
            facility.ownerCompanyId, facility.status, Number(facility.capacity) || 0,
            storyHexSitesInstalledStage(facility)])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'en'));
    const projects = (companyEconomy && companyEconomy.projects || [])
        .map(project => [project.id, project.facilityId, project.status,
            Number(project.remainingDays) || 0, Number(project.capacityIncrease) || 0])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'en'));
    const constructionCommands = (hexConstruction && hexConstruction.commands || [])
        .filter(command => ['BUILDING', 'COMPLETED'].includes(command.status))
        .map(command => [command.id, command.targetCellId, command.targetCellIndex,
            command.regionId, command.projectType, command.status,
            command.completionReceiptId || null])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'en'));
    return storyHexSitesHashText(JSON.stringify({
        schemaVersion: STORY_HEX_SITES_SCHEMA_VERSION,
        adapterVersion: STORY_HEX_SITES_ADAPTER_VERSION,
        layoutHash: world.layoutHash,
        geographyHash: geography.geographyHash,
        footprintHash: urban.footprintHash,
        naturalRegistryHash: natural && natural.registryHash || null,
        agricultureRegistryHash: agriculture && agriculture.registryHash || null,
        facilities,
        projects,
        constructionCommands
    }));
}

function storyHexSitesCreate(options) {
    const opts = options || {};
    const world = opts.world || storyHexWorldEnsure();
    const geography = opts.geography || storyHexGeographyEnsure();
    const urban = opts.urban || storyHexUrbanFootprintsEnsure();
    const natural = opts.natural || (typeof storyHexNaturalResourcesEnsure === 'function'
        ? storyHexNaturalResourcesEnsure() : null);
    const agriculture = opts.agriculture || (typeof storyHexAgricultureEnsure === 'function'
        ? storyHexAgricultureEnsure() : null);
    const companyEconomy = opts.companyEconomy
        || (typeof STORY !== 'undefined' && STORY.companyEconomy) || { facilities: {}, projects: [] };
    const hexConstruction = opts.hexConstruction
        || (typeof STORY !== 'undefined' && STORY.hexConstruction) || { commands: [] };
    const landUseCells = [];
    const landUseByCellId = Object.create(null);
    const availableByRegionKind = new Map();
    const naturalCoverNames = typeof STORY_HEX_NATURAL_COVER_NAMES !== 'undefined'
        ? STORY_HEX_NATURAL_COVER_NAMES
        : ['WATER', 'COAST', 'OPEN_LAND', 'FOREST', 'MOUNTAIN', 'DRYLAND'];

    for (const city of urban.records || []) {
        for (const district of city.districts || []) {
            const activeUse = STORY_HEX_URBAN_LAND_USE[district.kind] || 'CIVIC';
            const record = {
                id: `land-use:${district.id}`,
                cellId: district.id,
                cellIndex: Number(district.index),
                regionId: `region:${city.cityId}`,
                cityId: city.cityId,
                naturalCover: natural && natural.coverCodes
                    ? naturalCoverNames[Number(natural.coverCodes[district.index])] || 'OPEN_LAND'
                    : 'UNKNOWN_CANONICAL_BIOME_PENDING',
                legalUse: activeUse,
                activeUse,
                landCoverageBps: Number(geography.landCoverageBps[district.index]),
                terrainClass: Number(geography.terrainClass[district.index]),
                siteSlotCapacity: district.kind === 'CORE' ? 0 : 1,
                siteIds: [],
                damageState: 'UNRECORDED',
                contaminationState: 'UNAVAILABLE'
            };
            landUseCells.push(record);
            landUseByCellId[record.cellId] = record;
            if (record.siteSlotCapacity > 0) {
                const key = `${record.regionId}|${district.kind}`;
                if (!availableByRegionKind.has(key)) availableByRegionKind.set(key, []);
                availableByRegionKind.get(key).push(record);
            }
        }
    }
    for (const cells of availableByRegionKind.values()) {
        cells.sort((a, b) => a.cellIndex - b.cellIndex);
    }

    const projectMap = storyHexSitesProjectMap(companyEconomy);
    const facilities = Object.values(companyEconomy.facilities || {}).slice().sort((a, b) => {
        const ac = Number(a.capacity) || 0, bc = Number(b.capacity) || 0;
        return storyHexSitesRegionNumber(a.regionId) - storyHexSitesRegionNumber(b.regionId)
            || bc - ac || String(a.id).localeCompare(String(b.id), 'en');
    });
    const sites = [];
    const siteById = Object.create(null);
    const siteIdsByCellId = Object.create(null);
    const unplacedFacilities = [];
    const ruralDepositsByRegion = new Map();
    const reservedNaturalCellIds = new Set();
    for (const deposit of natural && natural.deposits || []) {
        if (!ruralDepositsByRegion.has(deposit.regionId)) ruralDepositsByRegion.set(deposit.regionId, []);
        ruralDepositsByRegion.get(deposit.regionId).push(deposit);
        reservedNaturalCellIds.add(String(deposit.cellId));
    }
    for (const deposits of ruralDepositsByRegion.values()) {
        deposits.sort((a, b) => a.cellIndex - b.cellIndex);
    }

    const ensureRuralLandUse = deposit => {
        let record = landUseByCellId[deposit.cellId];
        if (record) return record;
        const coverCode = natural && natural.coverCodes
            ? Number(natural.coverCodes[deposit.cellIndex]) : 2;
        record = {
            id: `land-use:${deposit.cellId}`,
            cellId: deposit.cellId,
            cellIndex: Number(deposit.cellIndex),
            regionId: deposit.regionId,
            cityId: storyHexSitesRegionNumber(deposit.regionId),
            naturalCover: naturalCoverNames[coverCode] || 'OPEN_LAND',
            legalUse: 'EXTRACTION',
            activeUse: 'NATURAL',
            landCoverageBps: Number(geography.landCoverageBps[deposit.cellIndex]),
            terrainClass: Number(geography.terrainClass[deposit.cellIndex]),
            siteSlotCapacity: 1,
            siteIds: [],
            damageState: 'UNRECORDED',
            contaminationState: 'UNAVAILABLE',
            naturalDepositId: deposit.id,
            resourceType: deposit.resourceType
        };
        landUseCells.push(record);
        landUseByCellId[record.cellId] = record;
        return record;
    };

    // Mevcut ekonomi defterindeki tesisler yeni bina değildir; dünya göçünde
    // fiziksel karşılık bulmaları gerekir. Hazır sanayi/savunma ilçesi doluysa
    // aynı idarî bölgedeki en yakın, boş, geçilebilir ve doğal kaynağı işgal
    // etmeyen hücreyi "mevcut tesis göçü" olarak imara ekleriz. Bu yol tarım,
    // orman, maden veya yeni kapasite uydurmaz; yalnız zaten var olan tesise yer
    // verir. Gerçek yeni inşaat yine maliyet/süre/izin yürütücüsünü bekler.
    const migrationCandidatesByRegionKind = new Map();
    const migrationExpansionCells = [];
    const ensureMigrationLandUse = (regionId, preferredKind) => {
        if (!(world && Number(world.cellCount) > 0 && world.qValues && world.rValues
            && geography && geography.regionIds)) return null;
        const cityId = storyHexSitesRegionNumber(regionId);
        const city = urban.records && urban.records[cityId];
        const coreIndex = Number(city && city.core && city.core.index);
        if (!Number.isInteger(cityId) || cityId < 0 || !Number.isInteger(coreIndex)) return null;
        const key = `${regionId}|${preferredKind}`;
        let candidates = migrationCandidatesByRegionKind.get(key);
        if (!candidates) {
            candidates = [];
            for (let index = 0; index < Number(world.cellCount); index++) {
                if (Number(geography.regionIds[index]) !== cityId) continue;
                const terrainClass = Number(geography.terrainClass[index]);
                if (terrainClass === STORY_HEX_SITES_TERRAIN_WATER
                    || terrainClass === STORY_HEX_SITES_TERRAIN_IMPASSABLE) continue;
                if (Number(geography.landCoverageBps[index]) < 5000) continue;
                const cellId = storyHexSitesCellId(world, index);
                if (!cellId || landUseByCellId[cellId]
                    || reservedNaturalCellIds.has(cellId)) continue;
                const coverCode = natural && natural.coverCodes
                    ? Number(natural.coverCodes[index]) : 2;
                const coverName = naturalCoverNames[coverCode] || 'OPEN_LAND';
                if (coverName === 'FOREST' || coverName === 'MOUNTAIN'
                    || coverName === 'WATER') continue;
                candidates.push({ index, cellId, coverCode,
                    distance: storyHexSitesHexDistance(world, coreIndex, index) });
            }
            candidates.sort((a, b) => a.distance - b.distance || a.index - b.index);
            migrationCandidatesByRegionKind.set(key, candidates);
        }
        let candidate = null;
        while (candidates.length && !candidate) {
            const next = candidates.shift();
            if (!landUseByCellId[next.cellId]) candidate = next;
        }
        if (!candidate) return null;
        const activeUse = STORY_HEX_URBAN_LAND_USE[preferredKind] || 'CIVIC';
        const record = {
            id: `land-use:${candidate.cellId}`,
            cellId: candidate.cellId,
            cellIndex: candidate.index,
            regionId,
            cityId,
            naturalCover: naturalCoverNames[candidate.coverCode] || 'OPEN_LAND',
            legalUse: activeUse,
            activeUse,
            landCoverageBps: Number(geography.landCoverageBps[candidate.index]),
            terrainClass: Number(geography.terrainClass[candidate.index]),
            siteSlotCapacity: 1,
            siteIds: [],
            damageState: 'UNRECORDED',
            contaminationState: 'UNAVAILABLE',
            zoningSource: 'EXISTING_FACILITY_MIGRATION',
            migrationDistanceHex: candidate.distance
        };
        landUseCells.push(record);
        landUseByCellId[record.cellId] = record;
        migrationExpansionCells.push(record);
        return record;
    };

    for (const facility of facilities) {
        const preferredKind = STORY_HEX_SITE_URBAN_KIND[facility.sectorId];
        let cell = null;
        if (facility.sectorId === 'extraction') {
            const deposit = (ruralDepositsByRegion.get(facility.regionId) || [])
                .find(candidate => !siteIdsByCellId[candidate.cellId]);
            if (deposit) cell = ensureRuralLandUse(deposit);
        }
        if (!preferredKind && !cell) {
            const agricultureEvidence = facility.sectorId === 'agriculture'
                && agriculture && agriculture.regionEvidence
                ? agriculture.regionEvidence[facility.regionId] || null : null;
            unplacedFacilities.push({
                facilityId: facility.id,
                regionId: facility.regionId,
                sectorId: facility.sectorId,
                reason: facility.sectorId === 'agriculture'
                    ? 'SOIL_AND_CROP_EVIDENCE_REQUIRED'
                    : facility.sectorId === 'extraction'
                        ? 'NO_UNCLAIMED_RESOURCE_DEPOSIT_IN_REGION'
                        : 'NO_COMPATIBLE_URBAN_SITE_TYPE',
                evidenceRegistryId: agricultureEvidence && agricultureEvidence.id || null,
                candidateCellCount: agricultureEvidence
                    ? agricultureEvidence.candidateCellCount : 0,
                topCandidateCellIds: agricultureEvidence
                    ? agricultureEvidence.topCandidateCellIds.slice() : [],
                missingEvidence: agricultureEvidence
                    ? agricultureEvidence.missingEvidence.slice()
                    : ['SOIL_CLASS', 'RAINFALL_CLASS', 'CROP_SUITABILITY']
            });
            continue;
        }
        if (!cell) {
            const candidates = availableByRegionKind.get(`${facility.regionId}|${preferredKind}`) || [];
            cell = candidates.find(candidate => candidate.siteIds.length < candidate.siteSlotCapacity);
        }
        if (!cell && preferredKind) {
            cell = ensureMigrationLandUse(facility.regionId, preferredKind);
        }
        if (!cell) {
            unplacedFacilities.push({
                facilityId: facility.id,
                regionId: facility.regionId,
                sectorId: facility.sectorId,
                reason: 'NO_FREE_COMPATIBLE_SITE_SLOT'
            });
            continue;
        }
        const activeProjects = projectMap.get(facility.id) || [];
        const site = {
            id: `site:${facility.id}`,
            sourceFacilityId: facility.id,
            cellId: cell.cellId,
            cellIndex: cell.cellIndex,
            regionId: facility.regionId,
            cityId: storyHexSitesRegionNumber(facility.regionId),
            siteType: STORY_HEX_SITE_TYPES[facility.sectorId],
            sectorId: facility.sectorId,
            ownerCompanyId: facility.ownerCompanyId,
            operatorCompanyId: facility.ownerCompanyId,
            installedVisualStage: storyHexSitesInstalledStage(facility),
            capacity: Math.max(0, Number(facility.capacity) || 0),
            lifecycleState: storyHexSitesFacilityCondition(facility),
            operatingStatus: String(facility.status || 'UNKNOWN'),
            constructionState: activeProjects.length ? 'EXPANDING' : 'NONE',
            activeProjectIds: activeProjects.map(project => project.id),
            visualFamily: String(STORY_HEX_SITE_TYPES[facility.sectorId] || '').toLowerCase()
        };
        cell.siteIds.push(site.id);
        cell.activeUse = site.siteType;
        sites.push(site);
        siteById[site.id] = site;
        siteIdsByCellId[site.cellId] = [site.id];
    }

    const physicalConstructionCommands = (hexConstruction.commands || [])
        .filter(command => ['BUILDING', 'COMPLETED'].includes(command.status))
        .slice().sort((a, b) => String(a.id).localeCompare(String(b.id), 'en'));
    for (const command of physicalConstructionCommands) {
        const cellId = String(command.targetCellId || '');
        const cellIndex = Number(command.targetCellIndex);
        if (!cellId || !Number.isInteger(cellIndex) || cellIndex < 0
            || cellIndex >= Number(world.cellCount) || landUseByCellId[cellId]
            || siteIdsByCellId[cellId]) continue;
        const coverCode = natural && natural.coverCodes
            ? Number(natural.coverCodes[cellIndex]) : 2;
        const siteType = String(command.projectType || '').toUpperCase();
        const cell = {
            id: `land-use:${cellId}`,
            cellId,
            cellIndex,
            regionId: command.regionId,
            cityId: storyHexSitesRegionNumber(command.regionId),
            naturalCover: naturalCoverNames[coverCode] || 'OPEN_LAND',
            legalUse: siteType,
            activeUse: siteType,
            landCoverageBps: Number(geography.landCoverageBps[cellIndex]),
            terrainClass: Number(geography.terrainClass[cellIndex]),
            siteSlotCapacity: 1,
            siteIds: [],
            damageState: 'UNDAMAGED',
            contaminationState: siteType === 'INDUSTRIAL' ? 'MONITORING_REQUIRED' : 'NONE_RECORDED',
            zoningSource: 'NEW_CONSTRUCTION_COMMAND',
            sourceConstructionId: command.id
        };
        const site = {
            id: `site:${command.id}`,
            sourceFacilityId: null,
            sourceConstructionId: command.id,
            cellId,
            cellIndex,
            regionId: command.regionId,
            cityId: storyHexSitesRegionNumber(command.regionId),
            siteType,
            sectorId: siteType === 'INDUSTRIAL' ? 'civil_industry' : null,
            ownerCompanyId: command.companyId || null,
            operatorCompanyId: command.companyId || null,
            installedVisualStage: command.status === 'COMPLETED' ? 1 : 0,
            capacity: command.status === 'COMPLETED'
                ? Math.max(0, Number(command.requirements && command.requirements.capacity) || 0) : 0,
            lifecycleState: command.status === 'COMPLETED' ? 'OPERATING' : 'CONSTRUCTION',
            operatingStatus: command.status === 'COMPLETED' ? 'READY_FOR_COMMISSIONING' : 'NOT_OPERATIONAL',
            constructionState: command.status,
            constructionProgressBps: command.status === 'COMPLETED' ? 10000
                : Math.max(0, Math.min(10000, Math.round((1 - Math.max(0,
                    Number(command.remainingDays) || 0) / Math.max(1,
                    Number(command.requirements && command.requirements.durationDays) || 1)) * 10000))),
            activeProjectIds: command.status === 'BUILDING' ? [command.id] : [],
            visualFamily: siteType.toLowerCase()
        };
        cell.siteIds.push(site.id);
        landUseCells.push(cell);
        landUseByCellId[cellId] = cell;
        sites.push(site);
        siteById[site.id] = site;
        siteIdsByCellId[cellId] = [site.id];
    }

    const sourceHash = storyHexSitesSourceHash(world, geography, urban,
        companyEconomy, natural, agriculture, hexConstruction);
    const registryHash = storyHexSitesHashText(JSON.stringify({
        sourceHash,
        cells: landUseCells.map(cell => [cell.cellId, cell.activeUse, cell.siteIds]),
        sites: sites.map(site => [site.id, site.cellId, site.siteType, site.lifecycleState,
            site.constructionState, site.capacity, site.installedVisualStage]),
        unplaced: unplacedFacilities.map(row => [row.facilityId, row.reason])
    }));
    return {
        schemaVersion: STORY_HEX_SITES_SCHEMA_VERSION,
        adapterVersion: STORY_HEX_SITES_ADAPTER_VERSION,
        sourceHash,
        registryHash,
        geographyHash: geography.geographyHash,
        footprintHash: urban.footprintHash,
        naturalRegistryHash: natural && natural.registryHash || null,
        agricultureRegistryHash: agriculture && agriculture.registryHash || null,
        landUseCells,
        landUseByCellId,
        sites,
        constructionSites: sites.filter(site => !!site.sourceConstructionId),
        siteById,
        siteIdsByCellId,
        unplacedFacilities,
        diagnostics: {
            landUseCellCount: landUseCells.length,
            physicalSiteCount: sites.length,
            unplacedFacilityCount: unplacedFacilities.length,
            occupiedSiteCellCount: Object.keys(siteIdsByCellId).length,
            maxSitesPerCell: sites.length ? 1 : 0,
            migrationExpansionCellCount: migrationExpansionCells.length,
            constructionSiteCount: physicalConstructionCommands.length,
            reasonCounts: unplacedFacilities.reduce((out, row) => {
                out[row.reason] = (out[row.reason] || 0) + 1;
                return out;
            }, {})
        }
    };
}

function storyHexSitesValidate(model, world, geography, urban, companyEconomy, natural, agriculture, hexConstruction) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!model || typeof model !== 'object') return {
        ok: false, issues: [{ code: 'MODEL_REQUIRED', path: '$', message: 'Fiziksel tesis sicili zorunlu.' }]
    };
    if (model.schemaVersion !== STORY_HEX_SITES_SCHEMA_VERSION) add('SCHEMA_VERSION', '$.schemaVersion', 'Tesis sicili şeması uyuşmuyor.');
    if (model.adapterVersion !== STORY_HEX_SITES_ADAPTER_VERSION) add('ADAPTER_VERSION', '$.adapterVersion', 'Tesis sicili adaptörü uyuşmuyor.');
    if (geography && model.geographyHash !== geography.geographyHash) add('GEOGRAPHY_HASH', '$.geographyHash', 'Tesis sicili yanlış coğrafyaya bağlı.');
    if (urban && model.footprintHash !== urban.footprintHash) add('FOOTPRINT_HASH', '$.footprintHash', 'Tesis sicili yanlış şehir ayak izine bağlı.');
    if (natural && model.naturalRegistryHash !== natural.registryHash) add('NATURAL_HASH', '$.naturalRegistryHash', 'Tesis sicili yanlış doğal kaynak kaydına bağlı.');
    if (agriculture && model.agricultureRegistryHash !== agriculture.registryHash) add('AGRICULTURE_HASH', '$.agricultureRegistryHash', 'Tesis sicili yanlış tarımsal kanıt kaydına bağlı.');
    const facilities = companyEconomy && companyEconomy.facilities || {};
    const constructionById = Object.fromEntries((hexConstruction && hexConstruction.commands || [])
        .map(command => [command.id, command]));
    const seenCells = new Set();
    for (const site of model.sites || []) {
        const at = `$.siteById.${site.id}`;
        if (!site.id || model.siteById[site.id] !== site) add('SITE_INDEX', at, 'Site kimlik indeksi bozuk.');
        if (site.sourceConstructionId) {
            const command = constructionById[site.sourceConstructionId];
            if (!command || !['BUILDING', 'COMPLETED'].includes(command.status)) {
                add('SOURCE_CONSTRUCTION', at, 'İnşaat sitesi gerçek ve etkin komuta bağlı değil.');
            }
        } else if (!facilities[site.sourceFacilityId]) {
            add('SOURCE_FACILITY', at, 'Site gerçek şirket tesisine bağlı değil.');
        }
        const cell = model.landUseByCellId[site.cellId];
        if (!cell || !cell.siteIds.includes(site.id)) add('LAND_USE_BINDING', at, 'Site arazi kullanım hücresine bağlı değil.');
        if (seenCells.has(site.cellId)) add('SITE_SLOT_OVERFLOW', at, 'Bir hücrede birden fazla tesis site yuvası kullanıyor.');
        seenCells.add(site.cellId);
        if (geography && (Number(geography.terrainClass[site.cellIndex]) === STORY_HEX_SITES_TERRAIN_WATER
            || Number(geography.terrainClass[site.cellIndex]) === STORY_HEX_SITES_TERRAIN_IMPASSABLE)) {
            add('INVALID_TERRAIN', at, 'Fiziksel tesis suya veya geçilemez dağa kurulamaz.');
        }
        if (geography && geography.regionIds
            && Number(geography.regionIds[site.cellIndex])
                !== storyHexSitesRegionNumber(site.regionId)) {
            add('REGION_BINDING', at, 'Fiziksel tesis kendi idarî bölgesi dışına taşınamaz.');
        }
    }
    const accounted = (model.sites || []).filter(site => !!site.sourceFacilityId).length
        + (model.unplacedFacilities || []).length;
    if (accounted !== Object.keys(facilities).length) add('FACILITY_ACCOUNTING', '$.diagnostics', 'Her tesis yerleşmiş veya açık borç olarak raporlanmış olmalı.');
    return { ok: issues.length === 0, issues: issues.slice(0, 80) };
}

function storyHexSitesEnsure() {
    const world = storyHexWorldEnsure();
    const geography = storyHexGeographyEnsure();
    const urban = storyHexUrbanFootprintsEnsure();
    const natural = typeof storyHexNaturalResourcesEnsure === 'function'
        ? storyHexNaturalResourcesEnsure() : null;
    const agriculture = typeof storyHexAgricultureEnsure === 'function'
        ? storyHexAgricultureEnsure() : null;
    const companyEconomy = typeof storyCompanyEnsure === 'function'
        ? storyCompanyEnsure() : (STORY.companyEconomy || { facilities: {}, projects: [] });
    const hexConstruction = STORY.hexConstruction || { commands: [] };
    const sourceHash = storyHexSitesSourceHash(world, geography, urban,
        companyEconomy, natural, agriculture, hexConstruction);
    if (STORY_HEX_SITES_CACHE && STORY_HEX_SITES_CACHE.sourceHash === sourceHash) return STORY_HEX_SITES_CACHE;
    const model = storyHexSitesCreate({ world, geography, urban, natural,
        agriculture, companyEconomy, hexConstruction });
    const validation = storyHexSitesValidate(model, world, geography, urban,
        companyEconomy, natural, agriculture, hexConstruction);
    if (!validation.ok) throw new Error(`HEX_SITES_INVALID:${validation.issues.map(issue => issue.code).join(',')}`);
    STORY_HEX_SITES_CACHE = model;
    return model;
}

function storyHexSiteForCell(cellId) {
    const model = storyHexSitesEnsure();
    const ids = model.siteIdsByCellId[String(cellId)] || [];
    return ids.length ? model.siteById[ids[0]] : null;
}

function storyHexSitesResetCache() {
    STORY_HEX_SITES_CACHE = null;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STORY_HEX_SITES_SCHEMA_VERSION,
        STORY_HEX_SITES_ADAPTER_VERSION,
        STORY_HEX_LAND_USE_TYPES,
        STORY_HEX_SITE_TYPES,
        STORY_HEX_SITE_URBAN_KIND,
        STORY_HEX_URBAN_LAND_USE,
        storyHexSitesHashText,
        storyHexSitesRegionNumber,
        storyHexSitesFacilityCondition,
        storyHexSitesInstalledStage,
        storyHexSitesProjectMap,
        storyHexSitesSourceHash,
        storyHexSitesCreate,
        storyHexSitesValidate,
        storyHexSitesEnsure,
        storyHexSiteForCell,
        storyHexSitesResetCache
    };
}
