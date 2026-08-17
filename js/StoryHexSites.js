// ═══════════════════════════════════════════════════════════════════════════
//  FİZİKSEL ARAZİ KULLANIMI VE TESİS SİCİLİ — HXD-6.5
//  ---------------------------------------------------------------------------
//  Ekonomi defterindeki soyut kapasiteyi gerçek bir altıgen konumuna bağlayan
//  salt-okunur geçiş katmanı. Bu kayıt olmadan gelecekte fabrika, tarla, maden,
//  yangın veya enkaz resmi çizilemez. Şimdilik yalnız uygun gerçek şehir
//  ilçesine sığan mevcut şirket tesisleri fiziksel site olur; sığmayanlar açık
//  yerleştirme borcu olarak raporlanır, yanlış hücreye zorlanmaz.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_HEX_SITES_SCHEMA_VERSION = 1;
const STORY_HEX_SITES_ADAPTER_VERSION = 'story-hex-land-use-sites-1';

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

function storyHexSitesFacilityCondition(facility) {
    const status = String(facility && facility.status || 'UNKNOWN').toUpperCase();
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

function storyHexSitesSourceHash(world, geography, urban, companyEconomy, natural) {
    const facilities = Object.values(companyEconomy && companyEconomy.facilities || {})
        .map(facility => [facility.id, facility.regionId, facility.sectorId,
            facility.ownerCompanyId, facility.status, Number(facility.capacity) || 0,
            storyHexSitesInstalledStage(facility)])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'en'));
    const projects = (companyEconomy && companyEconomy.projects || [])
        .map(project => [project.id, project.facilityId, project.status,
            Number(project.remainingDays) || 0, Number(project.capacityIncrease) || 0])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'en'));
    return storyHexSitesHashText(JSON.stringify({
        schemaVersion: STORY_HEX_SITES_SCHEMA_VERSION,
        adapterVersion: STORY_HEX_SITES_ADAPTER_VERSION,
        layoutHash: world.layoutHash,
        geographyHash: geography.geographyHash,
        footprintHash: urban.footprintHash,
        naturalRegistryHash: natural && natural.registryHash || null,
        facilities,
        projects
    }));
}

function storyHexSitesCreate(options) {
    const opts = options || {};
    const world = opts.world || storyHexWorldEnsure();
    const geography = opts.geography || storyHexGeographyEnsure();
    const urban = opts.urban || storyHexUrbanFootprintsEnsure();
    const natural = opts.natural || (typeof storyHexNaturalResourcesEnsure === 'function'
        ? storyHexNaturalResourcesEnsure() : null);
    const companyEconomy = opts.companyEconomy
        || (typeof STORY !== 'undefined' && STORY.companyEconomy) || { facilities: {}, projects: [] };
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
    for (const deposit of natural && natural.deposits || []) {
        if (!ruralDepositsByRegion.has(deposit.regionId)) ruralDepositsByRegion.set(deposit.regionId, []);
        ruralDepositsByRegion.get(deposit.regionId).push(deposit);
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

    for (const facility of facilities) {
        const preferredKind = STORY_HEX_SITE_URBAN_KIND[facility.sectorId];
        let cell = null;
        if (facility.sectorId === 'extraction') {
            const deposit = (ruralDepositsByRegion.get(facility.regionId) || [])
                .find(candidate => !siteIdsByCellId[candidate.cellId]);
            if (deposit) cell = ensureRuralLandUse(deposit);
        }
        if (!preferredKind && !cell) {
            unplacedFacilities.push({
                facilityId: facility.id,
                regionId: facility.regionId,
                sectorId: facility.sectorId,
                reason: facility.sectorId === 'agriculture'
                    ? 'ARABLE_SOIL_EVIDENCE_UNAVAILABLE'
                    : facility.sectorId === 'extraction'
                        ? 'NO_UNCLAIMED_RESOURCE_DEPOSIT_IN_REGION'
                        : 'NO_COMPATIBLE_URBAN_SITE_TYPE'
            });
            continue;
        }
        if (!cell) {
            const candidates = availableByRegionKind.get(`${facility.regionId}|${preferredKind}`) || [];
            cell = candidates.find(candidate => candidate.siteIds.length < candidate.siteSlotCapacity);
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

    const sourceHash = storyHexSitesSourceHash(world, geography, urban, companyEconomy, natural);
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
        landUseCells,
        landUseByCellId,
        sites,
        siteById,
        siteIdsByCellId,
        unplacedFacilities,
        diagnostics: {
            landUseCellCount: landUseCells.length,
            physicalSiteCount: sites.length,
            unplacedFacilityCount: unplacedFacilities.length,
            occupiedSiteCellCount: Object.keys(siteIdsByCellId).length,
            maxSitesPerCell: sites.length ? 1 : 0,
            reasonCounts: unplacedFacilities.reduce((out, row) => {
                out[row.reason] = (out[row.reason] || 0) + 1;
                return out;
            }, {})
        }
    };
}

function storyHexSitesValidate(model, world, geography, urban, companyEconomy, natural) {
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
    const facilities = companyEconomy && companyEconomy.facilities || {};
    const seenCells = new Set();
    for (const site of model.sites || []) {
        const at = `$.siteById.${site.id}`;
        if (!site.id || model.siteById[site.id] !== site) add('SITE_INDEX', at, 'Site kimlik indeksi bozuk.');
        if (!facilities[site.sourceFacilityId]) add('SOURCE_FACILITY', at, 'Site gerçek şirket tesisine bağlı değil.');
        const cell = model.landUseByCellId[site.cellId];
        if (!cell || !cell.siteIds.includes(site.id)) add('LAND_USE_BINDING', at, 'Site arazi kullanım hücresine bağlı değil.');
        if (seenCells.has(site.cellId)) add('SITE_SLOT_OVERFLOW', at, 'Bir hücrede birden fazla tesis site yuvası kullanıyor.');
        seenCells.add(site.cellId);
        if (geography && (Number(geography.terrainClass[site.cellIndex]) === STORY_HEX_SITES_TERRAIN_WATER
            || Number(geography.terrainClass[site.cellIndex]) === STORY_HEX_SITES_TERRAIN_IMPASSABLE)) {
            add('INVALID_TERRAIN', at, 'Fiziksel tesis suya veya geçilemez dağa kurulamaz.');
        }
    }
    const accounted = (model.sites || []).length + (model.unplacedFacilities || []).length;
    if (accounted !== Object.keys(facilities).length) add('FACILITY_ACCOUNTING', '$.diagnostics', 'Her tesis yerleşmiş veya açık borç olarak raporlanmış olmalı.');
    return { ok: issues.length === 0, issues: issues.slice(0, 80) };
}

function storyHexSitesEnsure() {
    const world = storyHexWorldEnsure();
    const geography = storyHexGeographyEnsure();
    const urban = storyHexUrbanFootprintsEnsure();
    const natural = typeof storyHexNaturalResourcesEnsure === 'function'
        ? storyHexNaturalResourcesEnsure() : null;
    const companyEconomy = typeof storyCompanyEnsure === 'function'
        ? storyCompanyEnsure() : (STORY.companyEconomy || { facilities: {}, projects: [] });
    const sourceHash = storyHexSitesSourceHash(world, geography, urban, companyEconomy, natural);
    if (STORY_HEX_SITES_CACHE && STORY_HEX_SITES_CACHE.sourceHash === sourceHash) return STORY_HEX_SITES_CACHE;
    const model = storyHexSitesCreate({ world, geography, urban, natural, companyEconomy });
    const validation = storyHexSitesValidate(model, world, geography, urban, companyEconomy, natural);
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
