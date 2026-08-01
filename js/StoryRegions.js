// ═══════════════════════════════════════════════════════════════════════════
//  KANONİK BÖLGE MODELİ — Faz 11
//  ---------------------------------------------------------------------------
//  STORY.nodes mevcut oynanışın canlı ve geriye uyumlu çalışma dizisidir.
//  Bu modül onu bir anda değiştirmez. Kimlik, konum ve komşuluk gibi topoloji
//  alanlarını sürümlü bir sidecar registry'de dondurur; sahiplik, ekonomi,
//  askerî durum ve lojistik görünümü ise canlı node'dan salt-okunur türetilir.
//
//  Böylece iki gerçek kaynağı oluşmaz:
//    - RegionModel: kalıcı kimlik + değişmez topoloji sözleşmesi
//    - STORY.nodes: mevcut motorun canlı dinamik değerleri
// ═══════════════════════════════════════════════════════════════════════════

const STORY_REGION_SCHEMA_VERSION = 1;
const STORY_REGION_ADAPTER_VERSION = 'story-node-sidecar-1';

function storyRegionEnabled() {
    return typeof storyFeatureEnabled !== 'function' || storyFeatureEnabled('world.regionModel');
}

function storyRegionClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyRegionId(legacyId) {
    return `region:${Number(legacyId)}`;
}

function storyRegionCountryId(legacyId) {
    return legacyId == null ? null : `country:${Number(legacyId)}`;
}

function storyRegionHashText(text) {
    const value = String(text == null ? '' : text);
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return `fnv1a32:${(`00000000${(hash >>> 0).toString(16)}`).slice(-8)}`;
}

function storyRegionSortedLegacyNeighbors(node) {
    return [...new Set((Array.isArray(node && node.neighbors) ? node.neighbors : [])
        .map(Number)
        .filter(Number.isInteger))]
        .sort((a, b) => a - b);
}

function storyRegionTopologyPayload(nodes) {
    return (nodes || []).map(node => ({
        id: Number(node.id),
        x: Number(node.lx),
        y: Number(node.ly),
        mapId: Number(node.mapId) || 0,
        neighbors: storyRegionSortedLegacyNeighbors(node)
    }));
}

function storyRegionTopologyHash(nodes) {
    return storyRegionHashText(JSON.stringify(storyRegionTopologyPayload(nodes)));
}

function storyRegionStaticRecord(node) {
    const legacyId = Number(node.id);
    return {
        schemaVersion: STORY_REGION_SCHEMA_VERSION,
        id: storyRegionId(legacyId),
        legacyId,
        canonicalName: String(node.name || `Bölge ${legacyId}`),
        center: {
            coordinateSpace: 'NORMALIZED_WORLD',
            x: Number(node.lx),
            y: Number(node.ly)
        },
        neighborIds: storyRegionSortedLegacyNeighbors(node).map(storyRegionId),
        mapId: Number(node.mapId) || 0,
        classification: {
            kind: 'CITY_REGION',
            geoSource: !!node.geo
        }
    };
}

function storyRegionModelCreate(nodes, options) {
    options = options || {};
    const source = Array.isArray(nodes) ? nodes : [];
    return {
        schemaVersion: STORY_REGION_SCHEMA_VERSION,
        adapterVersion: STORY_REGION_ADAPTER_VERSION,
        generatedAt: Number.isFinite(Number(options.generatedAt)) ? Number(options.generatedAt) : 0,
        topologyHash: storyRegionTopologyHash(source),
        regions: source.map(storyRegionStaticRecord).sort((a, b) => a.legacyId - b.legacyId),
        diagnostics: {
            sourceCount: source.length,
            backfilled: !!options.backfilled,
            restoredFromInvalidModel: !!options.restoredFromInvalidModel,
            issues: Array.isArray(options.issues) ? storyRegionClone(options.issues).slice(0, 30) : [],
            warnings: Array.isArray(options.warnings) ? options.warnings.map(String).slice(0, 30) : []
        }
    };
}

function storyRegionModelValidate(model, nodes, states) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!model || typeof model !== 'object' || Array.isArray(model)) {
        return { ok: false, issues: [{ code: 'MODEL_REQUIRED', path: '$', message: 'RegionModel nesnesi zorunlu.' }] };
    }
    if (model.schemaVersion !== STORY_REGION_SCHEMA_VERSION) {
        add('SCHEMA_VERSION', '$.schemaVersion', `Beklenen bölge sürümü ${STORY_REGION_SCHEMA_VERSION}.`);
    }
    if (model.adapterVersion !== STORY_REGION_ADAPTER_VERSION) {
        add('ADAPTER_VERSION', '$.adapterVersion', `Beklenen adaptör ${STORY_REGION_ADAPTER_VERSION}.`);
    }
    if (!Array.isArray(model.regions)) {
        add('REGIONS_ARRAY', '$.regions', 'RegionModel.regions dizi olmalı.');
        return { ok: false, issues };
    }

    const sourceNodes = Array.isArray(nodes) ? nodes : [];
    const stateIds = new Set((states || []).map(state => Number(state.id)));
    const nodeIds = new Set();
    sourceNodes.forEach((node, index) => {
        const at = `nodes[${index}]`;
        if (!node || !Number.isInteger(Number(node.id))) {
            add('INVALID_NODE_ID', `${at}.id`, 'Her canlı düğüm tamsayı kimlik taşımalı.');
            return;
        }
        const id = Number(node.id);
        if (nodeIds.has(id)) add('DUPLICATE_NODE_ID', `${at}.id`, `Yinelenen canlı düğüm kimliği: ${id}`);
        nodeIds.add(id);
        if (id !== index) add('NODE_INDEX_ID_MISMATCH', `${at}.id`, `storyNode(${id}) dizi indeks sözleşmesini bozar.`);
        if (!Number.isFinite(Number(node.lx)) || !Number.isFinite(Number(node.ly))) {
            add('INVALID_NODE_POSITION', at, 'Canlı düğüm sonlu normalleştirilmiş konum taşımalı.');
        } else if (Number(node.lx) < 0 || Number(node.lx) > 1 || Number(node.ly) < 0 || Number(node.ly) > 1) {
            add('NODE_POSITION_RANGE', at, 'Canlı düğüm konumu 0–1 dışında.');
        }
        if (states && !stateIds.has(Number(node.owner))) {
            add('INVALID_NODE_OWNER', `${at}.owner`, `Bilinmeyen devlet sahibi: ${node.owner}`);
        }
        const neighbors = storyRegionSortedLegacyNeighbors(node);
        if (neighbors.length !== (Array.isArray(node.neighbors) ? node.neighbors.length : 0)) {
            add('NODE_NEIGHBOR_DUPLICATE_OR_INVALID', `${at}.neighbors`, 'Komşuluk tamsayı, tekil ve açık olmalı.');
        }
        if (neighbors.includes(id)) add('NODE_SELF_NEIGHBOR', `${at}.neighbors`, 'Bölge kendine komşu olamaz.');
    });

    const modelIds = new Set();
    const legacyIds = new Set();
    model.regions.forEach((region, index) => {
        const at = `$.regions[${index}]`;
        if (!region || typeof region !== 'object' || Array.isArray(region)) {
            add('INVALID_REGION', at, 'Bölge kaydı nesne olmalı.');
            return;
        }
        if (region.schemaVersion !== STORY_REGION_SCHEMA_VERSION) {
            add('REGION_SCHEMA_VERSION', `${at}.schemaVersion`, 'Bölge kayıt sürümü uyuşmuyor.');
        }
        if (typeof region.id !== 'string' || !region.id) add('INVALID_REGION_ID', `${at}.id`, 'Kalıcı bölge kimliği zorunlu.');
        else if (modelIds.has(region.id)) add('DUPLICATE_REGION_ID', `${at}.id`, `Yinelenen bölge kimliği: ${region.id}`);
        else modelIds.add(region.id);
        const legacyId = Number(region.legacyId);
        if (!Number.isInteger(legacyId)) add('INVALID_LEGACY_ID', `${at}.legacyId`, 'legacyId tamsayı olmalı.');
        else if (legacyIds.has(legacyId)) add('DUPLICATE_LEGACY_ID', `${at}.legacyId`, `Yinelenen legacyId: ${legacyId}`);
        else legacyIds.add(legacyId);
        if (region.id !== storyRegionId(legacyId)) {
            add('REGION_ID_MISMATCH', `${at}.id`, `Beklenen kimlik ${storyRegionId(legacyId)}.`);
        }
        if (!region.center || region.center.coordinateSpace !== 'NORMALIZED_WORLD'
            || !Number.isFinite(Number(region.center.x)) || !Number.isFinite(Number(region.center.y))) {
            add('INVALID_REGION_CENTER', `${at}.center`, 'Normalleştirilmiş ve sonlu merkez zorunlu.');
        } else if (Number(region.center.x) < 0 || Number(region.center.x) > 1
            || Number(region.center.y) < 0 || Number(region.center.y) > 1) {
            add('REGION_CENTER_RANGE', `${at}.center`, 'Bölge merkezi 0–1 aralığında olmalı.');
        }
        if (!Array.isArray(region.neighborIds)) add('REGION_NEIGHBORS_ARRAY', `${at}.neighborIds`, 'neighborIds dizi olmalı.');
        else {
            const unique = new Set(region.neighborIds);
            if (unique.size !== region.neighborIds.length) add('DUPLICATE_REGION_NEIGHBOR', `${at}.neighborIds`, 'Bölge komşuları tekil olmalı.');
            if (unique.has(region.id)) add('REGION_SELF_NEIGHBOR', `${at}.neighborIds`, 'Bölge kendine komşu olamaz.');
        }
    });
    model.regions.forEach((region, index) => {
        if (!region || !Array.isArray(region.neighborIds)) return;
        for (const neighborId of region.neighborIds) {
            if (!modelIds.has(neighborId)) {
                add('BROKEN_REGION_NEIGHBOR', `$.regions[${index}].neighborIds`, `Bilinmeyen model komşusu: ${neighborId}`);
            }
        }
    });

    if (model.regions.length !== sourceNodes.length) {
        add('REGION_COUNT_MISMATCH', '$.regions', `Model ${model.regions.length}, canlı dünya ${sourceNodes.length} bölge taşıyor.`);
    }
    for (const node of sourceNodes) {
        const legacyId = Number(node.id);
        const region = model.regions.find(candidate => Number(candidate.legacyId) === legacyId);
        if (!region) {
            add('MISSING_REGION', '$.regions', `Canlı düğüm için model kaydı yok: ${legacyId}`);
            continue;
        }
        if (Number(region.center.x) !== Number(node.lx) || Number(region.center.y) !== Number(node.ly)) {
            add('REGION_POSITION_MISMATCH', `${region.id}.center`, 'Model ve canlı düğüm konumu uyuşmuyor.');
        }
        const expectedNeighbors = storyRegionSortedLegacyNeighbors(node).map(storyRegionId);
        if (JSON.stringify(region.neighborIds) !== JSON.stringify(expectedNeighbors)) {
            add('REGION_NEIGHBOR_MISMATCH', `${region.id}.neighborIds`, 'Model ve canlı düğüm komşuluğu uyuşmuyor.');
        }
        for (const neighborLegacyId of storyRegionSortedLegacyNeighbors(node)) {
            const neighbor = sourceNodes[neighborLegacyId];
            if (!neighbor) {
                add('BROKEN_NODE_NEIGHBOR', `nodes[${legacyId}].neighbors`, `Bilinmeyen komşu: ${neighborLegacyId}`);
            } else if (!storyRegionSortedLegacyNeighbors(neighbor).includes(legacyId)) {
                add('ASYMMETRIC_NODE_NEIGHBOR', `nodes[${legacyId}].neighbors`, `${legacyId}→${neighborLegacyId} ters bağlantı taşımıyor.`);
            }
        }
    }
    if (model.topologyHash !== storyRegionTopologyHash(sourceNodes)) {
        add('TOPOLOGY_HASH_MISMATCH', '$.topologyHash', 'Kayıtlı topoloji karması canlı düğümlerle uyuşmuyor.');
    }
    return { ok: issues.length === 0, issues };
}

function storyRegionReset(options) {
    if (!storyRegionEnabled()) {
        STORY.regionModel = null;
        return null;
    }
    STORY.regionModel = storyRegionModelCreate(STORY.nodes || [], Object.assign({
        generatedAt: Number(STORY.clock) || 0
    }, options || {}));
    return STORY.regionModel;
}

function storyRegionRestore(saved) {
    if (!storyRegionEnabled()) {
        STORY.regionModel = null;
        return null;
    }
    if (!saved) {
        return storyRegionReset({
            backfilled: true,
            warnings: ['Kayıt RegionModel taşımıyordu; canlı düğümlerden güvenli backfill üretildi.']
        });
    }
    const candidate = storyRegionClone(saved);
    const validation = storyRegionModelValidate(candidate, STORY.nodes, STORY.states);
    if (!validation.ok) {
        return storyRegionReset({
            backfilled: true,
            restoredFromInvalidModel: true,
            issues: validation.issues,
            warnings: ['Geçersiz RegionModel kullanılmadı; canlı düğümlerden yeniden kuruldu.']
        });
    }
    STORY.regionModel = candidate;
    return STORY.regionModel;
}

function storyRegionEnsure() {
    if (!storyRegionEnabled()) return null;
    if (!STORY.regionModel) return storyRegionReset({ backfilled: true });
    const validation = storyRegionModelValidate(STORY.regionModel, STORY.nodes, STORY.states);
    if (!validation.ok) {
        return storyRegionReset({
            backfilled: true,
            restoredFromInvalidModel: true,
            issues: validation.issues,
            warnings: ['Canlı topoloji değişti; RegionModel yeniden kuruldu.']
        });
    }
    return STORY.regionModel;
}

function storyRegionForSave() {
    const model = storyRegionEnsure();
    return model ? storyRegionClone(model) : null;
}

function storyRegionDynamicRecord(staticRegion, node) {
    return {
        schemaVersion: STORY_REGION_SCHEMA_VERSION,
        id: staticRegion.id,
        legacyId: staticRegion.legacyId,
        canonicalName: staticRegion.canonicalName,
        displayName: String(node.name || staticRegion.canonicalName),
        center: storyRegionClone(staticRegion.center),
        neighborIds: staticRegion.neighborIds.slice(),
        mapId: staticRegion.mapId,
        classification: storyRegionClone(staticRegion.classification),
        ownerId: storyRegionCountryId(node.owner),
        economy: {
            level: Math.max(1, Number(node.level) || 1),
            population: Number(node.pop) || 0,
            wealth: Number(node.wealth) || 0,
            infrastructure: {
                factory: Math.max(0, Number(node.fac) || 0),
                barracks: Math.max(0, Number(node.bar) || 0)
            },
            deposits: {
                oil: Math.max(0, Number(node.oil) || 0),
                cities: Math.max(0, Number(node.cities) || 0),
                points: Math.max(0, Number(node.pts) || 0)
            }
        },
        military: {
            garrison: Math.max(0, Number(node.garrison) || 0)
        },
        logistics: {
            landNeighborIds: staticRegion.neighborIds.slice(),
            corridorIds: typeof storyInfrastructureCorridorIdsForRegion === 'function'
                ? storyInfrastructureCorridorIdsForRegion(staticRegion.id)
                : []
        }
    };
}

function storyRegionSnapshot() {
    const model = storyRegionEnsure();
    if (!model) return {
        schemaVersion: STORY_REGION_SCHEMA_VERSION,
        disabled: true,
        topologyHash: null,
        regions: [],
        diagnostics: { warnings: ['RegionModel özellik bayrağıyla kapalı.'] }
    };
    return {
        schemaVersion: STORY_REGION_SCHEMA_VERSION,
        adapterVersion: model.adapterVersion,
        topologyHash: model.topologyHash,
        generatedAt: Number(STORY.clock) || 0,
        regions: model.regions.map(staticRegion => (
            storyRegionDynamicRecord(staticRegion, STORY.nodes[staticRegion.legacyId])
        )),
        diagnostics: storyRegionClone(model.diagnostics)
    };
}

function storyRegionV2Records() {
    const snapshot = storyRegionSnapshot();
    if (snapshot.disabled) return null;
    return snapshot.regions.map(region => ({
        id: region.id,
        legacyId: region.legacyId,
        name: region.displayName,
        ownerId: region.ownerId,
        neighborIds: region.neighborIds.slice(),
        level: region.economy.level,
        garrison: region.military.garrison,
        infrastructure: storyRegionClone(region.economy.infrastructure),
        population: region.economy.population,
        wealth: region.economy.wealth,
        deposits: storyRegionClone(region.economy.deposits),
        position: storyRegionClone(region.center),
        classification: storyRegionClone(region.classification),
        logistics: storyRegionClone(region.logistics)
    }));
}
