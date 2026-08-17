// ═══════════════════════════════════════════════════════════════════════════
//  DOĞAL ÖRTÜ, UYGUNLUK VE YATAK SİCİLİ — HXD-6.5
//  ---------------------------------------------------------------------------
//  Renderer dekorunu simülasyon gerçeğinden ayırır. Kara/dağ/nehir kanonik
//  HexGeography'den, petrol STORY_TERRAIN.oil işaretlerinden, mineral kanıtı
//  GEO_CITIES/node.mine kaydından gelir. Eski `pts` işaretleri maden değildir;
//  ekonomi onları uzman iş gücü/ileri teknoloji havzası olarak tanımlar.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_HEX_NATURAL_SCHEMA_VERSION = 1;
const STORY_HEX_NATURAL_ADAPTER_VERSION = 'story-hex-natural-resources-1';

const STORY_HEX_NATURAL_COVER = Object.freeze({
    WATER: 0,
    COAST: 1,
    OPEN_LAND: 2,
    FOREST: 3,
    MOUNTAIN: 4,
    DRYLAND: 5
});
const STORY_HEX_NATURAL_COVER_NAMES = Object.freeze([
    'WATER', 'COAST', 'OPEN_LAND', 'FOREST', 'MOUNTAIN', 'DRYLAND'
]);
const STORY_HEX_NATURAL_RESOURCE = Object.freeze({
    NONE: 0,
    PETROLEUM: 1,
    MINERAL: 2
});
const STORY_HEX_NATURAL_RESOURCE_NAMES = Object.freeze([
    'NONE', 'PETROLEUM', 'MINERAL'
]);

const STORY_HEX_NATURAL_POLICY = Object.freeze({
    fullLandCoverageBps: 9400,
    visibleMountainMinimumBps: 2300,
    mountainChanceDivisor: 8200,
    dryLatitude: 0.70,
    warmLatitude: 0.55,
    forestChanceNorth: 0.28,
    forestChanceWarm: 0.16,
    forestChanceDry: 0.08,
    arableRiverBonusBps: 1200,
    arableMountainPenaltyBps: 6200,
    arableSoilEvidence: 'UNAVAILABLE_NO_CANONICAL_SOIL_SOURCE'
});

let STORY_HEX_NATURAL_CACHE = null;

function storyHexNaturalHashText(text) {
    if (typeof storyHexWorldHashText === 'function') return storyHexWorldHashText(text);
    const value = String(text == null ? '' : text);
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return `fnv1a32:${(`00000000${(hash >>> 0).toString(16)}`).slice(-8)}`;
}

function storyHexNaturalHashUnit(x, y) {
    if (typeof storyHash === 'function') return storyHash(x, y);
    let hash = ((Number(x) | 0) * 73856093) ^ ((Number(y) | 0) * 19349663);
    hash = (hash ^ (hash >>> 13)) >>> 0;
    return (hash % 1024) / 1024;
}

function storyHexNaturalSeed(world, index) {
    return {
        a: storyHexNaturalHashUnit(Number(world.qValues[index]) * 131 + 17,
            Number(world.rValues[index]) * 197 + 31),
        b: storyHexNaturalHashUnit(Number(world.qValues[index]) * 313 + 71,
            Number(world.rValues[index]) * 89 + 911)
    };
}

function storyHexNaturalCoverForCell(world, geography, index) {
    const coverage = Number(geography.landCoverageBps[index]);
    const terrain = Number(geography.terrainClass[index]);
    if (coverage <= 0 || terrain === 0) return STORY_HEX_NATURAL_COVER.WATER;
    if (coverage < STORY_HEX_NATURAL_POLICY.fullLandCoverageBps || terrain === 2) {
        return STORY_HEX_NATURAL_COVER.COAST;
    }
    const latitude = Number(world.centerY[index]) / Math.max(1, Number(world.height));
    const seed = storyHexNaturalSeed(world, index);
    const mountain = Number(geography.mountainIntensityBps[index]);
    const mountainChance = Math.max(0, Math.min(.94,
        mountain / STORY_HEX_NATURAL_POLICY.mountainChanceDivisor));
    if (terrain === 3 || (mountain >= STORY_HEX_NATURAL_POLICY.visibleMountainMinimumBps
        && seed.a < mountainChance)) return STORY_HEX_NATURAL_COVER.MOUNTAIN;
    const forestChance = latitude > STORY_HEX_NATURAL_POLICY.dryLatitude
        ? STORY_HEX_NATURAL_POLICY.forestChanceDry
        : latitude > STORY_HEX_NATURAL_POLICY.warmLatitude
            ? STORY_HEX_NATURAL_POLICY.forestChanceWarm
            : STORY_HEX_NATURAL_POLICY.forestChanceNorth;
    if (seed.a < forestChance) return STORY_HEX_NATURAL_COVER.FOREST;
    return latitude > STORY_HEX_NATURAL_POLICY.dryLatitude
        ? STORY_HEX_NATURAL_COVER.DRYLAND : STORY_HEX_NATURAL_COVER.OPEN_LAND;
}

function storyHexNaturalArableSuitability(world, geography, coverCode, index) {
    if (![STORY_HEX_NATURAL_COVER.OPEN_LAND, STORY_HEX_NATURAL_COVER.DRYLAND]
        .includes(coverCode)) return 0;
    const coverage = Number(geography.landCoverageBps[index]);
    const mountain = Number(geography.mountainIntensityBps[index]);
    const riverBonus = Number(geography.riverPresence[index])
        ? STORY_HEX_NATURAL_POLICY.arableRiverBonusBps : 0;
    const latitude = Number(world.centerY[index]) / Math.max(1, Number(world.height));
    const climatePenalty = latitude > .78 ? 2400 : latitude > .68 ? 900 : 0;
    return Math.max(0, Math.min(10000, Math.round(
        coverage - mountain / 10000 * STORY_HEX_NATURAL_POLICY.arableMountainPenaltyBps
        + riverBonus - climatePenalty
    )));
}

function storyHexNaturalNearestCandidate(world, geography, regionId, originIndex,
    occupied, resourceCodes, mode) {
    const candidates = [];
    const oq = Number(world.qValues[originIndex]), or = Number(world.rValues[originIndex]);
    for (let index = 0; index < world.cellCount; index++) {
        if (Number(geography.regionIds[index]) !== regionId || occupied.has(index)
            || Number(resourceCodes[index]) !== STORY_HEX_NATURAL_RESOURCE.NONE
            || Number(geography.landCoverageBps[index]) < STORY_HEX_NATURAL_POLICY.fullLandCoverageBps
            || Number(geography.terrainClass[index]) === 3) continue;
        const q = Number(world.qValues[index]), r = Number(world.rValues[index]);
        const distance = (Math.abs(q - oq) + Math.abs(r - or)
            + Math.abs((q - oq) + (r - or))) / 2;
        const mountain = Number(geography.mountainIntensityBps[index]);
        const score = mode === 'MINERAL'
            ? mountain * 2.2 - distance * 240
            : -mountain * .4 - distance * 260;
        candidates.push({ index, score });
    }
    candidates.sort((a, b) => b.score - a.score || a.index - b.index);
    return candidates.length ? candidates[0].index : -1;
}

function storyHexNaturalCreate(options) {
    const opts = options || {};
    const world = opts.world || storyHexWorldEnsure();
    const geography = opts.geography || storyHexGeographyEnsure();
    const nodes = opts.nodes || (typeof STORY !== 'undefined' ? STORY.nodes : []) || [];
    const urban = opts.urban || (typeof storyHexUrbanFootprintsEnsure === 'function'
        ? storyHexUrbanFootprintsEnsure() : null);
    const oilPoints = opts.oilPoints || (typeof STORY_TERRAIN !== 'undefined'
        && STORY_TERRAIN.oil) || [];
    const cellAt = opts.cellAt || (typeof storyHexWorldCellAt === 'function'
        ? storyHexWorldCellAt : null);
    const occupied = new Set(urban && urban.cellIndices ? Array.from(urban.cellIndices) : []);
    const coverCodes = new Uint8Array(world.cellCount);
    const resourceCodes = new Uint8Array(world.cellCount);
    const arableSuitabilityBps = new Uint16Array(world.cellCount);
    const forestrySuitabilityBps = new Uint16Array(world.cellCount);
    const coverCounts = Object.fromEntries(STORY_HEX_NATURAL_COVER_NAMES.map(name => [name, 0]));
    const deposits = [];
    const localizationDebts = [];

    for (let index = 0; index < world.cellCount; index++) {
        const cover = storyHexNaturalCoverForCell(world, geography, index);
        coverCodes[index] = cover;
        coverCounts[STORY_HEX_NATURAL_COVER_NAMES[cover]]++;
        arableSuitabilityBps[index] = storyHexNaturalArableSuitability(
            world, geography, cover, index
        );
        forestrySuitabilityBps[index] = cover === STORY_HEX_NATURAL_COVER.FOREST ? 7000 : 0;
    }

    const addDeposit = (index, resourceCode, evidence, sourceId) => {
        if (index < 0 || index >= world.cellCount || occupied.has(index)
            || resourceCodes[index] !== STORY_HEX_NATURAL_RESOURCE.NONE) return false;
        resourceCodes[index] = resourceCode;
        deposits.push({
            id: `deposit:${STORY_HEX_NATURAL_RESOURCE_NAMES[resourceCode].toLowerCase()}:${index}`,
            cellId: typeof storyHexWorldId === 'function'
                ? storyHexWorldId(world.qValues[index], world.rValues[index])
                : `hex:${world.qValues[index]}:${world.rValues[index]}`,
            cellIndex: index,
            regionId: `region:${Number(geography.regionIds[index])}`,
            resourceType: STORY_HEX_NATURAL_RESOURCE_NAMES[resourceCode],
            evidence,
            sourceId,
            reserveStatus: 'UNQUANTIFIED_SPATIAL_STOCK_PENDING'
        });
        return true;
    };

    for (let pointIndex = 0; pointIndex < oilPoints.length; pointIndex++) {
        const point = oilPoints[pointIndex];
        const origin = cellAt
            ? cellAt(world, Number(point[0]) * world.width,
                Number(point[1]) * world.height) : null;
        if (!origin) continue;
        let index = origin.index;
        if (occupied.has(index) || Number(geography.landCoverageBps[index]) < 9400) {
            index = storyHexNaturalNearestCandidate(world, geography,
                Number(geography.regionIds[origin.index]), origin.index,
                occupied, resourceCodes, 'PETROLEUM');
        }
        if (!addDeposit(index, STORY_HEX_NATURAL_RESOURCE.PETROLEUM,
            'LEGACY_PETROLEUM_MAP_MARKER', `STORY_TERRAIN.oil:${pointIndex}`)) {
            localizationDebts.push({ sourceId: `STORY_TERRAIN.oil:${pointIndex}`, reason: 'PETROLEUM_CELL_UNRESOLVED' });
        }
    }

    for (const node of nodes) {
        if (!node || !node.mine) continue;
        const city = urban && urban.records && urban.records[Number(node.id)];
        const originIndex = city && city.core ? Number(city.core.index) : -1;
        if (originIndex < 0) {
            localizationDebts.push({ sourceId: `node:${node.id}:mine`, reason: 'MINERAL_CITY_CORE_UNRESOLVED' });
            continue;
        }
        const index = storyHexNaturalNearestCandidate(world, geography, Number(node.id),
            originIndex, occupied, resourceCodes, 'MINERAL');
        if (!addDeposit(index, STORY_HEX_NATURAL_RESOURCE.MINERAL,
            'LEGACY_CITY_REGIONAL_MINE_FLAG_PROCEDURAL_LOCALIZATION', `node:${node.id}:mine`)) {
            localizationDebts.push({ sourceId: `node:${node.id}:mine`, reason: 'MINERAL_CELL_UNRESOLVED' });
        }
    }

    const sourceHash = storyHexNaturalHashText(JSON.stringify({
        schemaVersion: STORY_HEX_NATURAL_SCHEMA_VERSION,
        adapterVersion: STORY_HEX_NATURAL_ADAPTER_VERSION,
        layoutHash: world.layoutHash,
        geographyHash: geography.geographyHash,
        footprintHash: urban && urban.footprintHash || null,
        policy: STORY_HEX_NATURAL_POLICY,
        oilPoints,
        mineNodes: nodes.filter(node => node && node.mine).map(node => node.id)
    }));
    const registryHash = storyHexNaturalHashText(JSON.stringify({
        sourceHash,
        cover: Array.from(coverCodes),
        resources: Array.from(resourceCodes),
        debts: localizationDebts
    }));
    return {
        schemaVersion: STORY_HEX_NATURAL_SCHEMA_VERSION,
        adapterVersion: STORY_HEX_NATURAL_ADAPTER_VERSION,
        sourceHash,
        registryHash,
        geographyHash: geography.geographyHash,
        footprintHash: urban && urban.footprintHash || null,
        coverCodes,
        resourceCodes,
        arableSuitabilityBps,
        forestrySuitabilityBps,
        deposits,
        depositByCellId: Object.fromEntries(deposits.map(deposit => [deposit.cellId, deposit])),
        localizationDebts,
        diagnostics: {
            cellCount: world.cellCount,
            coverCounts,
            petroleumDepositCount: deposits.filter(row => row.resourceType === 'PETROLEUM').length,
            mineralDepositCount: deposits.filter(row => row.resourceType === 'MINERAL').length,
            localizationDebtCount: localizationDebts.length,
            arableCandidateCount: Array.from(arableSuitabilityBps).filter(value => value >= 6500).length,
            arableEvidenceStatus: STORY_HEX_NATURAL_POLICY.arableSoilEvidence,
            quantifiedForestStockCount: 0,
            legacyPointsRejectedAsMineral: typeof STORY_TERRAIN !== 'undefined'
                && STORY_TERRAIN.pts ? STORY_TERRAIN.pts.length : 0
        }
    };
}

function storyHexNaturalValidate(model, world, geography) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!model || typeof model !== 'object') return {
        ok: false, issues: [{ code: 'MODEL_REQUIRED', path: '$', message: 'Doğal kaynak sicili zorunlu.' }]
    };
    if (model.schemaVersion !== STORY_HEX_NATURAL_SCHEMA_VERSION) add('SCHEMA_VERSION', '$.schemaVersion', 'Doğal kaynak şeması uyuşmuyor.');
    if (model.adapterVersion !== STORY_HEX_NATURAL_ADAPTER_VERSION) add('ADAPTER_VERSION', '$.adapterVersion', 'Doğal kaynak adaptörü uyuşmuyor.');
    if (geography && model.geographyHash !== geography.geographyHash) add('GEOGRAPHY_HASH', '$.geographyHash', 'Doğal kaynak sicili yanlış coğrafyaya bağlı.');
    for (const field of ['coverCodes', 'resourceCodes', 'arableSuitabilityBps', 'forestrySuitabilityBps']) {
        if (!model[field] || model[field].length !== world.cellCount) add('ARRAY_LENGTH', `$.${field}`, 'Hücre dizisi dünya boyutuyla uyuşmuyor.');
    }
    const seen = new Set();
    for (const deposit of model.deposits || []) {
        if (seen.has(deposit.cellIndex)) add('DEPOSIT_COLLISION', `$.deposits.${deposit.id}`, 'İki yatak aynı hücreyi kullanamaz.');
        seen.add(deposit.cellIndex);
        if (!['PETROLEUM', 'MINERAL'].includes(deposit.resourceType)) add('RESOURCE_TYPE', `$.deposits.${deposit.id}`, 'Bilinmeyen yatak türü.');
        const terrain = Number(geography.terrainClass[deposit.cellIndex]);
        if (terrain === 0 || terrain === 3) add('DEPOSIT_TERRAIN', `$.deposits.${deposit.id}`, 'Yatak suya veya geçilemez dağa yerleşemez.');
    }
    return { ok: issues.length === 0, issues: issues.slice(0, 80) };
}

function storyHexNaturalResourcesEnsure() {
    const world = storyHexWorldEnsure();
    const geography = storyHexGeographyEnsure();
    const urban = typeof storyHexUrbanFootprintsEnsure === 'function'
        ? storyHexUrbanFootprintsEnsure() : null;
    const nodes = typeof STORY !== 'undefined' ? STORY.nodes || [] : [];
    const oilPoints = typeof STORY_TERRAIN !== 'undefined' ? STORY_TERRAIN.oil || [] : [];
    const sourceToken = [world.layoutHash, geography.geographyHash,
        urban && urban.footprintHash || '-', nodes.length,
        nodes.filter(node => node && node.mine).map(node => node.id).join(','),
        storyHexNaturalHashText(JSON.stringify(oilPoints))].join('|');
    if (STORY_HEX_NATURAL_CACHE && STORY_HEX_NATURAL_CACHE.sourceToken === sourceToken) {
        return STORY_HEX_NATURAL_CACHE;
    }
    const model = storyHexNaturalCreate({ world, geography, urban, nodes, oilPoints });
    const validation = storyHexNaturalValidate(model, world, geography);
    if (!validation.ok) throw new Error(`HEX_NATURAL_INVALID:${validation.issues.map(issue => issue.code).join(',')}`);
    model.sourceToken = sourceToken;
    STORY_HEX_NATURAL_CACHE = model;
    return model;
}

function storyHexNaturalResetCache() {
    STORY_HEX_NATURAL_CACHE = null;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STORY_HEX_NATURAL_SCHEMA_VERSION,
        STORY_HEX_NATURAL_ADAPTER_VERSION,
        STORY_HEX_NATURAL_COVER,
        STORY_HEX_NATURAL_COVER_NAMES,
        STORY_HEX_NATURAL_RESOURCE,
        STORY_HEX_NATURAL_RESOURCE_NAMES,
        STORY_HEX_NATURAL_POLICY,
        storyHexNaturalHashText,
        storyHexNaturalHashUnit,
        storyHexNaturalSeed,
        storyHexNaturalCoverForCell,
        storyHexNaturalArableSuitability,
        storyHexNaturalNearestCandidate,
        storyHexNaturalCreate,
        storyHexNaturalValidate,
        storyHexNaturalResourcesEnsure,
        storyHexNaturalResetCache
    };
}
