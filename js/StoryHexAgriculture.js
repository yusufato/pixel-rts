// ═══════════════════════════════════════════════════════════════════════════
//  TARIMSAL KANIT VE YERLEŞİM KAPISI — HXD-6.5
//  ---------------------------------------------------------------------------
//  Arazi görünüşü veya kaba bir uygunluk puanı, çiftlik kurma izni değildir.
//  Bu sicil kanonik coğrafyadan yalnız aday hücreleri sıralar; toprak, yağış
//  ve ürün kanıtı gelene kadar bütün adayları açıkça BLOKLU tutar.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_HEX_AGRICULTURE_SCHEMA_VERSION = 1;
const STORY_HEX_AGRICULTURE_ADAPTER_VERSION = 'story-hex-agriculture-evidence-1';

const STORY_HEX_AGRICULTURE_POLICY = Object.freeze({
    candidateThresholdBps: 6500,
    topCandidatesPerRegion: 8,
    requiredEvidence: Object.freeze(['SOIL_CLASS', 'RAINFALL_CLASS', 'CROP_SUITABILITY']),
    placementBlocker: 'SOIL_AND_CROP_EVIDENCE_REQUIRED'
});

let STORY_HEX_AGRICULTURE_CACHE = null;

function storyHexAgricultureHashText(text) {
    if (typeof storyHexWorldHashText === 'function') return storyHexWorldHashText(text);
    const value = String(text == null ? '' : text);
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return `fnv1a32:${(`00000000${(hash >>> 0).toString(16)}`).slice(-8)}`;
}

function storyHexAgricultureCellId(world, index) {
    if (typeof storyHexWorldId === 'function') {
        return storyHexWorldId(world.qValues[index], world.rValues[index]);
    }
    return `hex:${Number(world.qValues[index])}:${Number(world.rValues[index])}`;
}

function storyHexAgricultureCreate(options) {
    const opts = options || {};
    const world = opts.world || storyHexWorldEnsure();
    const geography = opts.geography || storyHexGeographyEnsure();
    const natural = opts.natural || storyHexNaturalResourcesEnsure();
    const urban = opts.urban || (typeof storyHexUrbanFootprintsEnsure === 'function'
        ? storyHexUrbanFootprintsEnsure() : null);
    const occupied = new Set(urban && urban.cellIndices
        ? Array.from(urban.cellIndices, Number) : []);
    const candidates = [];
    const candidateByCellId = Object.create(null);
    const regionBuckets = new Map();

    for (let index = 0; index < world.cellCount; index++) {
        const score = Number(natural.arableSuitabilityBps[index]) || 0;
        const terrain = Number(geography.terrainClass[index]);
        if (score < STORY_HEX_AGRICULTURE_POLICY.candidateThresholdBps
            || occupied.has(index) || terrain === 0 || terrain === 3) continue;
        const regionId = `region:${Number(geography.regionIds[index])}`;
        const cellId = storyHexAgricultureCellId(world, index);
        const record = {
            id: `agriculture-evidence:${cellId}`,
            cellId,
            cellIndex: index,
            regionId,
            candidateScoreBps: score,
            scoreMeaning: 'RANKING_PROXY_NOT_PLACEMENT_PERMISSION',
            proxyEvidence: {
                landCoverageBps: Number(geography.landCoverageBps[index]) || 0,
                mountainIntensityBps: Number(geography.mountainIntensityBps[index]) || 0,
                riverPresence: !!Number(geography.riverPresence[index]),
                naturalCoverCode: Number(natural.coverCodes[index]) || 0,
                latitudeOnlyClimateProxy: Number(world.centerY[index]) / Math.max(1, Number(world.height))
            },
            soilClass: 'UNKNOWN',
            rainfallClass: 'UNKNOWN',
            cropSuitability: [],
            irrigationStatus: 'UNKNOWN_NOT_INFERRED_FROM_RIVER',
            missingEvidence: STORY_HEX_AGRICULTURE_POLICY.requiredEvidence.slice(),
            placementAuthorized: false,
            placementStatus: STORY_HEX_AGRICULTURE_POLICY.placementBlocker
        };
        candidates.push(record);
        candidateByCellId[cellId] = record;
        if (!regionBuckets.has(regionId)) regionBuckets.set(regionId, []);
        regionBuckets.get(regionId).push(record);
    }

    candidates.sort((a, b) => a.cellIndex - b.cellIndex);
    const regionEvidence = Object.create(null);
    for (const [regionId, records] of regionBuckets.entries()) {
        records.sort((a, b) => b.candidateScoreBps - a.candidateScoreBps
            || a.cellIndex - b.cellIndex);
        regionEvidence[regionId] = {
            id: `agriculture-region-evidence:${regionId}`,
            regionId,
            candidateCellCount: records.length,
            authorizedCellCount: 0,
            topCandidateCellIds: records.slice(0,
                STORY_HEX_AGRICULTURE_POLICY.topCandidatesPerRegion).map(row => row.cellId),
            evidenceStatus: STORY_HEX_AGRICULTURE_POLICY.placementBlocker,
            missingEvidence: STORY_HEX_AGRICULTURE_POLICY.requiredEvidence.slice()
        };
    }

    const sourceHash = storyHexAgricultureHashText(JSON.stringify({
        schemaVersion: STORY_HEX_AGRICULTURE_SCHEMA_VERSION,
        adapterVersion: STORY_HEX_AGRICULTURE_ADAPTER_VERSION,
        layoutHash: world.layoutHash,
        geographyHash: geography.geographyHash,
        naturalRegistryHash: natural.registryHash,
        footprintHash: urban && urban.footprintHash || null,
        policy: STORY_HEX_AGRICULTURE_POLICY
    }));
    const registryHash = storyHexAgricultureHashText(JSON.stringify({
        sourceHash,
        candidates: candidates.map(row => [row.cellId, row.regionId,
            row.candidateScoreBps, row.placementStatus]),
        regions: Object.values(regionEvidence).map(row => [row.regionId,
            row.candidateCellCount, row.authorizedCellCount])
    }));

    return {
        schemaVersion: STORY_HEX_AGRICULTURE_SCHEMA_VERSION,
        adapterVersion: STORY_HEX_AGRICULTURE_ADAPTER_VERSION,
        sourceHash,
        registryHash,
        geographyHash: geography.geographyHash,
        naturalRegistryHash: natural.registryHash,
        footprintHash: urban && urban.footprintHash || null,
        candidates,
        candidateByCellId,
        regionEvidence,
        diagnostics: {
            candidateCellCount: candidates.length,
            candidateRegionCount: Object.keys(regionEvidence).length,
            authorizedCellCount: 0,
            blockedCandidateCount: candidates.length,
            evidenceStatus: STORY_HEX_AGRICULTURE_POLICY.placementBlocker,
            noProxyPromotedToFact: true
        }
    };
}

function storyHexAgricultureValidate(model, world, geography, natural, urban) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!model || typeof model !== 'object') return {
        ok: false,
        issues: [{ code: 'MODEL_REQUIRED', path: '$', message: 'Tarımsal kanıt sicili zorunlu.' }]
    };
    if (model.schemaVersion !== STORY_HEX_AGRICULTURE_SCHEMA_VERSION) {
        add('SCHEMA_VERSION', '$.schemaVersion', 'Tarımsal kanıt şeması uyuşmuyor.');
    }
    if (model.adapterVersion !== STORY_HEX_AGRICULTURE_ADAPTER_VERSION) {
        add('ADAPTER_VERSION', '$.adapterVersion', 'Tarımsal kanıt adaptörü uyuşmuyor.');
    }
    if (geography && model.geographyHash !== geography.geographyHash) {
        add('GEOGRAPHY_HASH', '$.geographyHash', 'Tarımsal kanıt yanlış coğrafyaya bağlı.');
    }
    if (natural && model.naturalRegistryHash !== natural.registryHash) {
        add('NATURAL_HASH', '$.naturalRegistryHash', 'Tarımsal kanıt yanlış doğal kaynak siciline bağlı.');
    }
    const occupied = new Set(urban && urban.cellIndices
        ? Array.from(urban.cellIndices, Number) : []);
    const seen = new Set();
    let authorizedCount = 0;
    for (const row of model.candidates || []) {
        const at = `$.candidateByCellId.${row.cellId}`;
        if (seen.has(row.cellIndex)) add('CANDIDATE_DUPLICATE', at, 'Aynı hücre iki kez aday olamaz.');
        seen.add(row.cellIndex);
        if (model.candidateByCellId[row.cellId] !== row) add('CANDIDATE_INDEX', at, 'Aday hücre indeksi bozuk.');
        if (occupied.has(row.cellIndex)) add('URBAN_COLLISION', at, 'Şehir hücresi kırsal tarım adayı olamaz.');
        const terrain = Number(geography.terrainClass[row.cellIndex]);
        if (terrain === 0 || terrain === 3) add('INVALID_TERRAIN', at, 'Su veya geçilemez dağ tarım adayı olamaz.');
        if (row.placementAuthorized) {
            authorizedCount++;
            if (row.soilClass === 'UNKNOWN' || row.rainfallClass === 'UNKNOWN'
                || !Array.isArray(row.cropSuitability) || !row.cropSuitability.length
                || row.missingEvidence.length) {
                add('UNSUPPORTED_AUTHORIZATION', at,
                    'Toprak, yağış ve ürün kanıtı tamamlanmadan tarım izni verilemez.');
            }
        }
    }
    if (authorizedCount !== Number(model.diagnostics.authorizedCellCount)) {
        add('AUTHORIZED_COUNT', '$.diagnostics.authorizedCellCount', 'İzinli hücre sayacı uyuşmuyor.');
    }
    return { ok: issues.length === 0, issues: issues.slice(0, 80) };
}

function storyHexAgricultureEnsure() {
    const world = storyHexWorldEnsure();
    const geography = storyHexGeographyEnsure();
    const natural = storyHexNaturalResourcesEnsure();
    const urban = typeof storyHexUrbanFootprintsEnsure === 'function'
        ? storyHexUrbanFootprintsEnsure() : null;
    const sourceToken = [world.layoutHash, geography.geographyHash,
        natural.registryHash, urban && urban.footprintHash || '-'].join('|');
    if (STORY_HEX_AGRICULTURE_CACHE
        && STORY_HEX_AGRICULTURE_CACHE.sourceToken === sourceToken) {
        return STORY_HEX_AGRICULTURE_CACHE;
    }
    const model = storyHexAgricultureCreate({ world, geography, natural, urban });
    const validation = storyHexAgricultureValidate(model, world, geography, natural, urban);
    if (!validation.ok) {
        throw new Error(`HEX_AGRICULTURE_INVALID:${validation.issues.map(issue => issue.code).join(',')}`);
    }
    model.sourceToken = sourceToken;
    STORY_HEX_AGRICULTURE_CACHE = model;
    return model;
}

function storyHexAgricultureResetCache() {
    STORY_HEX_AGRICULTURE_CACHE = null;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STORY_HEX_AGRICULTURE_SCHEMA_VERSION,
        STORY_HEX_AGRICULTURE_ADAPTER_VERSION,
        STORY_HEX_AGRICULTURE_POLICY,
        storyHexAgricultureHashText,
        storyHexAgricultureCellId,
        storyHexAgricultureCreate,
        storyHexAgricultureValidate,
        storyHexAgricultureEnsure,
        storyHexAgricultureResetCache
    };
}
