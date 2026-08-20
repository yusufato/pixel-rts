// ═══════════════════════════════════════════════════════════════════════════
//  ALTYAPI VE ULAŞIM GRAFI — Faz 14
//  ---------------------------------------------------------------------------
//  RegionModel değişmez bölge topolojisini taşır. Bu modül o topolojinin
//  üzerinde kara/deniz taşıma koridorları ile enerji/veri katmanlarını kurar.
//
//  Faz 18 ticaret/enerji akışı bu grafı gerçek kapasite, erişim, rota ve
//  kesinti için tüketir. Askerî ikmal tüketicisi Faz 48'de aynı kapıya geçer.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_INFRASTRUCTURE_SCHEMA_VERSION = 1;
const STORY_INFRASTRUCTURE_ADAPTER_VERSION = 'story-infrastructure-graph-1';
const STORY_INFRASTRUCTURE_MODES = Object.freeze(['LAND', 'SEA', 'RAIL', 'ENERGY', 'DATA']);
const STORY_INFRASTRUCTURE_ACCESS_POLICIES = Object.freeze(['ENDPOINT_OWNERS', 'PUBLIC']);
const STORY_INFRASTRUCTURE_VALID_GRAPHS = new WeakSet();

// Bunlar mevcut GEO şehir kimliklerinden türetilen, açık ve denetlenebilir
// deniz bağlantılarıdır. İsim bulunamazsa bağlantı sessizce uydurulmaz.
const STORY_INFRASTRUCTURE_SEA_LINKS = Object.freeze([
    ['Londra', 'Rotterdam'],
    ['Londra', 'Dublin'],
    ['Belfast', 'Glasgow'],
    ['Lizbon', 'Kazablanka'],
    ['Barselona', 'Cezayir'],
    ['Marsilya', 'Tunus'],
    ['Napoli', 'Palermo'],
    ['Palermo', 'Tunus'],
    ['Atina', 'İzmir'],
    ['Atina', 'İskenderiye'],
    ['İstanbul', 'Odesa'],
    ['Varna', 'Odesa'],
    ['Antalya', 'Lefkoşa'],
    ['Lefkoşa', 'Beyrut'],
    ['Lefkoşa', 'İskenderiye'],
    ['Kopenhag', 'Oslo'],
    ['Kopenhag', 'Göteborg'],
    ['Stokholm', 'Helsinki'],
    ['Helsinki', 'Tallinn'],
    ['Gdansk', 'Stokholm']
]);

// HXD-7.3: Bunlar karayolundan tahmin edilmez. 2032 başlangıç dünyasında
// açıkça var olduğu kabul edilen ana şehirlerarası ray omurgasıdır. İstasyon,
// hat kapasitesi ve hasarı ROAD kimliğinden ayrı kalır.
const STORY_INFRASTRUCTURE_RAIL_LINKS = Object.freeze([
    ['Ankara', 'İstanbul'], ['İstanbul', 'Sofya'], ['Sofya', 'Belgrad'],
    ['Belgrad', 'Budapeşte'], ['Budapeşte', 'Viyana'], ['Viyana', 'Prag'],
    ['Prag', 'Berlin'], ['Berlin', 'Hamburg'], ['Berlin', 'Varşova'],
    ['Varşova', 'Krakov'], ['Krakov', 'Budapeşte'], ['Varşova', 'Minsk'],
    ['Minsk', 'Moskova'], ['Minsk', 'Kiev'], ['Kiev', 'Odesa'],
    ['Kiev', 'Harkiv'], ['Harkiv', 'Moskova'], ['Bükreş', 'Sofya'],
    ['Bükreş', 'Budapeşte'], ['Venedik', 'Zagreb'], ['Zagreb', 'Belgrad'],
    ['Milano', 'Venedik'], ['Bologna', 'Milano'], ['Bologna', 'Venedik'],
    ['Roma', 'Bologna'], ['Roma', 'Napoli'], ['Paris', 'Lille'],
    ['Lille', 'Brüksel'], ['Brüksel', 'Amsterdam'], ['Amsterdam', 'Hamburg'],
    ['Paris', 'Lyon'], ['Lyon', 'Marsilya'], ['Lyon', 'Zürih'],
    ['Zürih', 'Milano'], ['Madrid', 'Zaragoza'], ['Zaragoza', 'Barselona'],
    ['Helsinki', 'St. Petersburg'], ['Kahire', 'İskenderiye'],
    ['Şam', 'Halep'], ['Bağdat', 'Musul']
]);

function storyInfrastructureEnabled() {
    return typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('world.infrastructureGraph');
}

function storyInfrastructureClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyInfrastructureStable(value) {
    if (value == null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(storyInfrastructureStable).join(',')}]`;
    const keys = Object.keys(value).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${storyInfrastructureStable(value[key])}`).join(',')}}`;
}

function storyInfrastructureHash(value) {
    const text = storyInfrastructureStable(value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return `fnv1a32:${(`00000000${(hash >>> 0).toString(16)}`).slice(-8)}`;
}

function storyInfrastructureRound(value, digits) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    const scale = 10 ** (digits == null ? 6 : digits);
    return Math.round(number * scale) / scale;
}

function storyInfrastructureLegacyId(regionId) {
    const match = /^region:(\d+)$/.exec(String(regionId || ''));
    return match ? Number(match[1]) : NaN;
}

function storyInfrastructureRegionCompare(a, b) {
    const an = storyInfrastructureLegacyId(a);
    const bn = storyInfrastructureLegacyId(b);
    if (Number.isInteger(an) && Number.isInteger(bn) && an !== bn) return an - bn;
    return String(a).localeCompare(String(b));
}

function storyInfrastructureEndpoints(a, b) {
    return [String(a), String(b)].sort(storyInfrastructureRegionCompare);
}

function storyInfrastructureCorridorId(mode, endpoints, parentMode) {
    const legacy = endpoints.map(storyInfrastructureLegacyId);
    const suffix = parentMode ? `:${String(parentMode).toLowerCase()}` : '';
    return `corridor:${String(mode).toLowerCase()}:${legacy[0]}:${legacy[1]}${suffix}`;
}

function storyInfrastructureDistance(a, b) {
    if (!a || !b || !a.center || !b.center) return 0;
    return storyInfrastructureRound(Math.hypot(
        Number(a.center.x) - Number(b.center.x),
        Number(a.center.y) - Number(b.center.y)
    ));
}

function storyInfrastructurePhysicalDefinition(mode, a, b) {
    const endpoints = storyInfrastructureEndpoints(a.id, b.id);
    const distance = storyInfrastructureDistance(a, b);
    const base = mode === 'SEA' ? 1050 : mode === 'RAIL' ? 1650 : 1350;
    const distancePenalty = mode === 'SEA' ? 2.5 : mode === 'RAIL' ? 3.2 : 4;
    const baseCapacity = Math.max(120, Math.round(base / (1 + distance * distancePenalty)));
    return {
        schemaVersion: STORY_INFRASTRUCTURE_SCHEMA_VERSION,
        id: storyInfrastructureCorridorId(mode, endpoints),
        mode,
        endpointRegionIds: endpoints,
        directed: false,
        parentCorridorId: null,
        baseCapacity,
        damageBps: 0,
        enabled: true,
        distance,
        costPerUnit: storyInfrastructureRound((
            mode === 'SEA' ? 1.35 : mode === 'RAIL' ? .72 : 1
        ) + distance * (mode === 'RAIL' ? 5.2 : 8), 4),
        latencySeconds: storyInfrastructureRound((
            mode === 'SEA' ? 3 : mode === 'RAIL' ? .7 : 1
        ) + distance * (mode === 'RAIL' ? 24 : 40), 4),
        accessPolicy: 'ENDPOINT_OWNERS'
    };
}

function storyInfrastructureOverlayDefinition(mode, parent) {
    const capacityFactor = mode === 'ENERGY' ? 0.7 : 1.8;
    const costFactor = mode === 'ENERGY' ? 0.45 : 0.18;
    const latencyFactor = mode === 'ENERGY' ? 0.5 : 0.08;
    return {
        schemaVersion: STORY_INFRASTRUCTURE_SCHEMA_VERSION,
        id: storyInfrastructureCorridorId(mode, parent.endpointRegionIds, parent.mode),
        mode,
        endpointRegionIds: parent.endpointRegionIds.slice(),
        directed: false,
        parentCorridorId: parent.id,
        baseCapacity: Math.max(80, Math.round(parent.baseCapacity * capacityFactor)),
        damageBps: 0,
        enabled: true,
        distance: parent.distance,
        costPerUnit: storyInfrastructureRound(parent.costPerUnit * costFactor, 4),
        latencySeconds: storyInfrastructureRound(parent.latencySeconds * latencyFactor, 4),
        accessPolicy: 'ENDPOINT_OWNERS'
    };
}

function storyInfrastructureStaticCorridor(corridor) {
    return {
        schemaVersion: corridor.schemaVersion,
        id: corridor.id,
        mode: corridor.mode,
        endpointRegionIds: Array.isArray(corridor.endpointRegionIds)
            ? corridor.endpointRegionIds.slice()
            : [],
        directed: !!corridor.directed,
        parentCorridorId: corridor.parentCorridorId,
        baseCapacity: corridor.baseCapacity,
        distance: corridor.distance,
        costPerUnit: corridor.costPerUnit,
        latencySeconds: corridor.latencySeconds,
        accessPolicy: corridor.accessPolicy
    };
}

function storyInfrastructureDefinitions() {
    const model = typeof storyRegionEnsure === 'function' ? storyRegionEnsure() : STORY.regionModel;
    if (!model || !Array.isArray(model.regions)) return [];
    const regions = model.regions.slice().sort((a, b) => a.legacyId - b.legacyId);
    const byId = new Map(regions.map(region => [region.id, region]));
    const physical = [];
    const landKeys = new Set();

    for (const region of regions) {
        for (const neighborId of (region.neighborIds || [])) {
            const endpoints = storyInfrastructureEndpoints(region.id, neighborId);
            const key = endpoints.join('|');
            if (landKeys.has(key)) continue;
            const neighbor = byId.get(neighborId);
            if (!neighbor) continue;
            landKeys.add(key);
            physical.push(storyInfrastructurePhysicalDefinition('LAND', region, neighbor));
        }
    }

    const byName = new Map(regions.map(region => [String(region.canonicalName), region]));
    const seaKeys = new Set();
    for (const pair of STORY_INFRASTRUCTURE_SEA_LINKS) {
        const a = byName.get(pair[0]);
        const b = byName.get(pair[1]);
        if (!a || !b || a.id === b.id) continue;
        const endpoints = storyInfrastructureEndpoints(a.id, b.id);
        const key = endpoints.join('|');
        if (seaKeys.has(key)) continue;
        seaKeys.add(key);
        physical.push(storyInfrastructurePhysicalDefinition('SEA', a, b));
    }

    const railKeys = new Set();
    for (const pair of STORY_INFRASTRUCTURE_RAIL_LINKS) {
        const a = byName.get(pair[0]);
        const b = byName.get(pair[1]);
        if (!a || !b || a.id === b.id) continue;
        const endpoints = storyInfrastructureEndpoints(a.id, b.id);
        const key = endpoints.join('|');
        if (railKeys.has(key)) continue;
        railKeys.add(key);
        physical.push(storyInfrastructurePhysicalDefinition('RAIL', a, b));
    }

    if (typeof storyInfrastructureRouteCorridorDefinitions === 'function') {
        for (const corridor of storyInfrastructureRouteCorridorDefinitions()) {
            if (!physical.some(existing => existing.id === corridor.id)) physical.push(corridor);
        }
    }

    physical.sort((a, b) => a.id.localeCompare(b.id));
    const corridors = physical.slice();
    for (const parent of physical.filter(corridor =>
        ['LAND', 'SEA'].includes(corridor.mode))) {
        corridors.push(storyInfrastructureOverlayDefinition('ENERGY', parent));
        corridors.push(storyInfrastructureOverlayDefinition('DATA', parent));
    }
    return corridors.sort((a, b) => a.id.localeCompare(b.id));
}

function storyInfrastructureNetworkHash(corridors) {
    return storyInfrastructureHash((corridors || [])
        .map(storyInfrastructureStaticCorridor)
        .sort((a, b) => a.id.localeCompare(b.id)));
}

function storyInfrastructureGraphCreate(options) {
    options = options || {};
    const corridors = storyInfrastructureDefinitions();
    return {
        schemaVersion: STORY_INFRASTRUCTURE_SCHEMA_VERSION,
        adapterVersion: STORY_INFRASTRUCTURE_ADAPTER_VERSION,
        generatedAt: Number.isFinite(Number(options.generatedAt)) ? Number(options.generatedAt) : 0,
        topologyHash: STORY.regionModel ? STORY.regionModel.topologyHash : null,
        networkHash: storyInfrastructureNetworkHash(corridors),
        damageRevision: 0,
        corridors,
        diagnostics: {
            backfilled: !!options.backfilled,
            restoredFromInvalidGraph: !!options.restoredFromInvalidGraph,
            sourceCorridorCount: corridors.length,
            issues: Array.isArray(options.issues) ? storyInfrastructureClone(options.issues).slice(0, 50) : [],
            warnings: Array.isArray(options.warnings) ? options.warnings.map(String).slice(0, 30) : []
        }
    };
}

function storyInfrastructureGraphValidate(graph) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!graph || typeof graph !== 'object' || Array.isArray(graph)) {
        return { ok: false, issues: [{ code: 'GRAPH_REQUIRED', path: '$', message: 'Altyapı grafı nesnesi zorunlu.' }] };
    }
    if (graph.schemaVersion !== STORY_INFRASTRUCTURE_SCHEMA_VERSION) {
        add('SCHEMA_VERSION', '$.schemaVersion', `Beklenen altyapı sürümü ${STORY_INFRASTRUCTURE_SCHEMA_VERSION}.`);
    }
    if (graph.adapterVersion !== STORY_INFRASTRUCTURE_ADAPTER_VERSION) {
        add('ADAPTER_VERSION', '$.adapterVersion', `Beklenen adaptör ${STORY_INFRASTRUCTURE_ADAPTER_VERSION}.`);
    }
    const currentTopologyHash = STORY.regionModel && STORY.regionModel.topologyHash;
    if (graph.topologyHash !== currentTopologyHash) {
        add('TOPOLOGY_HASH_MISMATCH', '$.topologyHash', 'Altyapı grafı güncel RegionModel topolojisine ait değil.');
    }
    if (!Number.isInteger(Number(graph.damageRevision)) || Number(graph.damageRevision) < 0) {
        add('INVALID_DAMAGE_REVISION', '$.damageRevision', 'Hasar revizyonu negatif olmayan tamsayı olmalı.');
    }
    if (!Array.isArray(graph.corridors)) {
        add('CORRIDORS_ARRAY', '$.corridors', 'Koridorlar dizi olmalı.');
        return { ok: false, issues };
    }

    const regionIds = new Set(((STORY.regionModel && STORY.regionModel.regions) || []).map(region => region.id));
    const ids = new Set();
    const byId = new Map();
    graph.corridors.forEach((corridor, index) => {
        const at = `$.corridors[${index}]`;
        if (!corridor || typeof corridor !== 'object' || Array.isArray(corridor)) {
            add('INVALID_CORRIDOR', at, 'Koridor kaydı nesne olmalı.');
            return;
        }
        if (corridor.schemaVersion !== STORY_INFRASTRUCTURE_SCHEMA_VERSION) {
            add('CORRIDOR_SCHEMA_VERSION', `${at}.schemaVersion`, 'Koridor sürümü uyuşmuyor.');
        }
        if (typeof corridor.id !== 'string' || !corridor.id) add('INVALID_CORRIDOR_ID', `${at}.id`, 'Koridor kimliği zorunlu.');
        else if (ids.has(corridor.id)) add('DUPLICATE_CORRIDOR_ID', `${at}.id`, `Yinelenen koridor: ${corridor.id}`);
        else {
            ids.add(corridor.id);
            byId.set(corridor.id, corridor);
        }
        if (!STORY_INFRASTRUCTURE_MODES.includes(corridor.mode)) {
            add('INVALID_MODE', `${at}.mode`, `Bilinmeyen koridor modu: ${corridor.mode}`);
        }
        if (!Array.isArray(corridor.endpointRegionIds) || corridor.endpointRegionIds.length !== 2) {
            add('INVALID_ENDPOINTS', `${at}.endpointRegionIds`, 'Koridor tam iki uç bölge taşımalı.');
        } else {
            const expectedOrder = storyInfrastructureEndpoints(
                corridor.endpointRegionIds[0],
                corridor.endpointRegionIds[1]
            );
            if (corridor.endpointRegionIds[0] === corridor.endpointRegionIds[1]) {
                add('SELF_CORRIDOR', `${at}.endpointRegionIds`, 'Koridor aynı bölgeyi kendine bağlayamaz.');
            }
            if (storyInfrastructureStable(corridor.endpointRegionIds) !== storyInfrastructureStable(expectedOrder)) {
                add('ENDPOINT_ORDER', `${at}.endpointRegionIds`, 'Koridor uçları kalıcı kimlik sırasıyla yazılmalı.');
            }
            for (const regionId of corridor.endpointRegionIds) {
                if (!regionIds.has(regionId)) add('BROKEN_REGION_REFERENCE', `${at}.endpointRegionIds`, `Bilinmeyen bölge: ${regionId}`);
            }
        }
        if (corridor.directed !== false) add('UNSUPPORTED_DIRECTION', `${at}.directed`, 'Faz 14 koridorları çift yönlü olmalı.');
        if (!Number.isFinite(Number(corridor.baseCapacity)) || Number(corridor.baseCapacity) <= 0) {
            add('INVALID_CAPACITY', `${at}.baseCapacity`, 'Temel kapasite pozitif ve sonlu olmalı.');
        }
        if (!Number.isInteger(Number(corridor.damageBps))
            || Number(corridor.damageBps) < 0 || Number(corridor.damageBps) > 10000) {
            add('INVALID_DAMAGE', `${at}.damageBps`, 'Koridor hasarı 0–10000 baz puan aralığında tamsayı olmalı.');
        }
        if (typeof corridor.enabled !== 'boolean') add('INVALID_ENABLED', `${at}.enabled`, 'Koridor etkinliği boolean olmalı.');
        if (!Number.isFinite(Number(corridor.distance)) || Number(corridor.distance) < 0) {
            add('INVALID_DISTANCE', `${at}.distance`, 'Koridor mesafesi negatif olmayan sonlu sayı olmalı.');
        }
        if (!Number.isFinite(Number(corridor.costPerUnit)) || Number(corridor.costPerUnit) < 0) {
            add('INVALID_COST', `${at}.costPerUnit`, 'Koridor maliyeti negatif olmayan sonlu sayı olmalı.');
        }
        if (!Number.isFinite(Number(corridor.latencySeconds)) || Number(corridor.latencySeconds) < 0) {
            add('INVALID_LATENCY', `${at}.latencySeconds`, 'Koridor gecikmesi negatif olmayan sonlu sayı olmalı.');
        }
        if (!STORY_INFRASTRUCTURE_ACCESS_POLICIES.includes(corridor.accessPolicy)) {
            add('INVALID_ACCESS_POLICY', `${at}.accessPolicy`, `Bilinmeyen erişim politikası: ${corridor.accessPolicy}`);
        }
    });

    graph.corridors.forEach((corridor, index) => {
        if (!corridor || !['ENERGY', 'DATA'].includes(corridor.mode)) return;
        const at = `$.corridors[${index}].parentCorridorId`;
        const parent = byId.get(corridor.parentCorridorId);
        if (!parent) add('BROKEN_PARENT_CORRIDOR', at, `Üst fiziksel koridor bulunamadı: ${corridor.parentCorridorId}`);
        else {
            if (!['LAND', 'SEA'].includes(parent.mode)) add('INVALID_PARENT_MODE', at, 'Enerji/veri katmanı kara veya deniz koridoruna bağlanmalı.');
            if (storyInfrastructureStable(parent.endpointRegionIds) !== storyInfrastructureStable(corridor.endpointRegionIds)) {
                add('PARENT_ENDPOINT_MISMATCH', at, 'Katman koridoru üst koridorla aynı uçları taşımalı.');
            }
        }
    });

    const expected = storyInfrastructureDefinitions();
    const expectedById = new Map(expected.map(corridor => [corridor.id, corridor]));
    if (graph.corridors.length !== expected.length) {
        add('CORRIDOR_COUNT_MISMATCH', '$.corridors', `Beklenen ${expected.length}, kayıtlı ${graph.corridors.length} koridor.`);
    }
    for (const expectedCorridor of expected) {
        const actual = byId.get(expectedCorridor.id);
        if (!actual) {
            add('MISSING_CORRIDOR', '$.corridors', `Zorunlu koridor eksik: ${expectedCorridor.id}`);
            continue;
        }
        if (storyInfrastructureStable(storyInfrastructureStaticCorridor(actual))
            !== storyInfrastructureStable(storyInfrastructureStaticCorridor(expectedCorridor))) {
            add('STATIC_CORRIDOR_MISMATCH', `$.corridors.${expectedCorridor.id}`, 'Koridorun değişmez tanımı güncel ağla uyuşmuyor.');
        }
    }
    for (const corridor of graph.corridors) {
        if (corridor && corridor.id && !expectedById.has(corridor.id)) {
            add('UNKNOWN_CORRIDOR', `$.corridors.${corridor.id}`, 'Kayıtta güncel ağda bulunmayan koridor var.');
        }
    }
    const actualNetworkHash = storyInfrastructureNetworkHash(graph.corridors);
    const expectedNetworkHash = storyInfrastructureNetworkHash(expected);
    if (graph.networkHash !== actualNetworkHash || graph.networkHash !== expectedNetworkHash) {
        add('NETWORK_HASH_MISMATCH', '$.networkHash', 'Altyapı ağ karması koridor tanımlarıyla uyuşmuyor.');
    }
    return { ok: issues.length === 0, issues };
}

function storyInfrastructureReset(options) {
    if (!storyInfrastructureEnabled()) {
        STORY.infrastructureGraph = null;
        return null;
    }
    STORY.infrastructureGraph = storyInfrastructureGraphCreate(Object.assign({
        generatedAt: Number(STORY.clock) || 0
    }, options || {}));
    STORY_INFRASTRUCTURE_VALID_GRAPHS.add(STORY.infrastructureGraph);
    return STORY.infrastructureGraph;
}

function storyInfrastructureRestore(saved) {
    if (!storyInfrastructureEnabled()) {
        STORY.infrastructureGraph = null;
        return null;
    }
    if (!saved) {
        return storyInfrastructureReset({
            backfilled: true,
            warnings: ['Kayıt altyapı grafı taşımıyordu; güncel RegionModel üzerinden güvenli backfill üretildi.']
        });
    }
    let candidate;
    let additiveNetworkMigration = false;
    if (Array.isArray(saved.corridors)) {
        // Erken Faz 14 geliştirme kayıtları için tam-graf uyumluluğu.
        candidate = storyInfrastructureClone(saved);
    } else {
        const issues = [];
        const add = (code, path, message) => issues.push({ code, path, message });
        const base = storyInfrastructureGraphCreate({
            generatedAt: Number.isFinite(Number(saved.generatedAt)) ? Number(saved.generatedAt) : Number(STORY.clock) || 0
        });
        if (saved.schemaVersion !== STORY_INFRASTRUCTURE_SCHEMA_VERSION) {
            add('SCHEMA_VERSION', '$.schemaVersion', 'Kompakt altyapı kayıt sürümü uyuşmuyor.');
        }
        if (saved.adapterVersion !== STORY_INFRASTRUCTURE_ADAPTER_VERSION) {
            add('ADAPTER_VERSION', '$.adapterVersion', 'Kompakt altyapı kayıt adaptörü uyuşmuyor.');
        }
        if (saved.topologyHash !== base.topologyHash) {
            add('TOPOLOGY_HASH_MISMATCH', '$.topologyHash', 'Kompakt altyapı kaydı güncel topolojiye ait değil.');
        }
        if (saved.networkHash !== base.networkHash) {
            // Compact saves only carry mutable state by stable corridor id.
            // An additive catalog revision (for example HXD-7.3 RAIL) can safely
            // backfill new defaults while preserving every still-known old id.
            const legacyWithoutRailHash = storyInfrastructureNetworkHash(
                base.corridors.filter(corridor => corridor.mode !== 'RAIL')
            );
            if (saved.networkHash === legacyWithoutRailHash) {
                additiveNetworkMigration = true;
            } else {
                add('NETWORK_HASH_MISMATCH', '$.networkHash',
                    'Kompakt altyapı kaydı güncel veya tanınan eklemeli ağ tanımıyla uyuşmuyor.');
            }
        }
        if (!Number.isInteger(Number(saved.damageRevision)) || Number(saved.damageRevision) < 0) {
            add('INVALID_DAMAGE_REVISION', '$.damageRevision', 'Kompakt hasar revizyonu negatif olmayan tamsayı olmalı.');
        }
        const states = Array.isArray(saved.corridorStates) ? saved.corridorStates : [];
        if (!Array.isArray(saved.corridorStates)) {
            add('CORRIDOR_STATES_ARRAY', '$.corridorStates', 'Kompakt koridor durumları dizi olmalı.');
        }
        const byId = new Map(base.corridors.map(corridor => [corridor.id, corridor]));
        const seen = new Set();
        states.forEach((state, index) => {
            const at = `$.corridorStates[${index}]`;
            if (!state || typeof state !== 'object' || Array.isArray(state)) {
                add('INVALID_CORRIDOR_STATE', at, 'Kompakt koridor durumu nesne olmalı.');
                return;
            }
            if (seen.has(state.id)) add('DUPLICATE_CORRIDOR_STATE', `${at}.id`, `Yinelenen koridor durumu: ${state.id}`);
            seen.add(state.id);
            const corridor = byId.get(state.id);
            if (!corridor) {
                add('UNKNOWN_CORRIDOR', `${at}.id`, `Güncel ağda bulunmayan koridor: ${state.id}`);
                return;
            }
            if (!Number.isInteger(Number(state.damageBps))
                || Number(state.damageBps) < 0 || Number(state.damageBps) > 10000) {
                add('INVALID_DAMAGE', `${at}.damageBps`, 'Kompakt hasar 0–10000 baz puan aralığında tamsayı olmalı.');
            } else {
                corridor.damageBps = Number(state.damageBps);
            }
            if (typeof state.enabled !== 'boolean') {
                add('INVALID_ENABLED', `${at}.enabled`, 'Kompakt etkinlik boolean olmalı.');
            } else {
                corridor.enabled = state.enabled;
            }
        });
        if (issues.length) {
            return storyInfrastructureReset({
                backfilled: true,
                restoredFromInvalidGraph: true,
                issues,
                warnings: ['Geçersiz kompakt altyapı kaydı kullanılmadı; güncel RegionModel üzerinden yeniden kuruldu.']
            });
        }
        base.damageRevision = Number(saved.damageRevision);
        base.diagnostics = saved.diagnostics
            ? storyInfrastructureClone(saved.diagnostics)
            : base.diagnostics;
        if (additiveNetworkMigration) {
            base.diagnostics.backfilled = true;
            base.diagnostics.warnings = Array.isArray(base.diagnostics.warnings)
                ? base.diagnostics.warnings.slice() : [];
            base.diagnostics.warnings.push(
                'Altyapı kataloğu genişledi; bilinen eski koridor durumları korunup yeni koridorlar varsayılan durumla eklendi.'
            );
        }
        candidate = base;
    }
    const validation = storyInfrastructureGraphValidate(candidate);
    if (!validation.ok) {
        return storyInfrastructureReset({
            backfilled: true,
            restoredFromInvalidGraph: true,
            issues: validation.issues,
            warnings: ['Geçersiz altyapı grafı kullanılmadı; güncel RegionModel üzerinden yeniden kuruldu.']
        });
    }
    STORY.infrastructureGraph = candidate;
    STORY_INFRASTRUCTURE_VALID_GRAPHS.add(STORY.infrastructureGraph);
    return STORY.infrastructureGraph;
}

function storyInfrastructureEnsure() {
    if (!storyInfrastructureEnabled()) return null;
    if (!STORY.infrastructureGraph) return storyInfrastructureReset({ backfilled: true });
    const regionModel = typeof storyRegionEnsure === 'function'
        ? storyRegionEnsure()
        : STORY.regionModel;
    if (STORY_INFRASTRUCTURE_VALID_GRAPHS.has(STORY.infrastructureGraph)
        && regionModel
        && STORY.infrastructureGraph.topologyHash === regionModel.topologyHash) {
        return STORY.infrastructureGraph;
    }
    const validation = storyInfrastructureGraphValidate(STORY.infrastructureGraph);
    if (!validation.ok) {
        return storyInfrastructureReset({
            backfilled: true,
            restoredFromInvalidGraph: true,
            issues: validation.issues,
            warnings: ['Canlı topoloji değişti; altyapı grafı yeniden kuruldu.']
        });
    }
    STORY_INFRASTRUCTURE_VALID_GRAPHS.add(STORY.infrastructureGraph);
    return STORY.infrastructureGraph;
}

function storyInfrastructureForSave() {
    // Otomatik kayıt sık çalışır. Geçerli runtime sidecar'ı yalnız bu modülün
    // kontrollü hasar kapısından değiştiği için her kayıtta 152 bölgeyi yeniden
    // doğrulamak yerine mevcut doğrulanmış graf kullanılır.
    const graph = STORY.infrastructureGraph || storyInfrastructureEnsure();
    if (!graph) return null;
    return {
        schemaVersion: graph.schemaVersion,
        adapterVersion: graph.adapterVersion,
        generatedAt: graph.generatedAt,
        topologyHash: graph.topologyHash,
        networkHash: graph.networkHash,
        damageRevision: graph.damageRevision,
        corridorStates: graph.corridors
            .filter(corridor => corridor.damageBps !== 0 || corridor.enabled !== true)
            .map(corridor => ({
                id: corridor.id,
                damageBps: corridor.damageBps,
                enabled: corridor.enabled
            }))
            .sort((a, b) => a.id.localeCompare(b.id)),
        diagnostics: storyInfrastructureClone(graph.diagnostics)
    };
}

function storyInfrastructureEndpointOwners(corridor) {
    const owners = new Set();
    for (const regionId of (corridor.endpointRegionIds || [])) {
        const legacyId = storyInfrastructureLegacyId(regionId);
        const node = STORY.nodes && STORY.nodes[legacyId];
        if (node && Number.isInteger(Number(node.owner))) owners.add(`country:${Number(node.owner)}`);
    }
    return [...owners].sort();
}

function storyInfrastructureEffectiveCapacity(corridor) {
    if (!corridor || !corridor.enabled) return 0;
    const remainingBps = Math.max(0, 10000 - (Number(corridor.damageBps) || 0));
    const physicalBps = typeof storyHexInfrastructureCorridorFactorBps === 'function'
        ? storyHexInfrastructureCorridorFactorBps(corridor.id) : 10000;
    return Math.max(0, Math.floor((Number(corridor.baseCapacity) || 0)
        * remainingBps / 10000 * physicalBps / 10000));
}

function storyInfrastructureCorridorView(corridor) {
    const effectiveCapacity = storyInfrastructureEffectiveCapacity(corridor);
    const damageBps = Number(corridor.damageBps) || 0;
    return Object.assign(storyInfrastructureClone(corridor), {
        effectiveCapacity,
        status: !corridor.enabled || effectiveCapacity <= 0
            ? 'BLOCKED'
            : (damageBps > 0 ? 'DAMAGED' : 'OPEN'),
        access: {
            policy: corridor.accessPolicy,
            countryIds: corridor.accessPolicy === 'PUBLIC'
                ? []
                : storyInfrastructureEndpointOwners(corridor)
        }
    });
}

function storyInfrastructureSummary(corridors) {
    const summary = {
        total: 0,
        byMode: { LAND: 0, SEA: 0, RAIL: 0, ENERGY: 0, DATA: 0 },
        baseCapacityByMode: { LAND: 0, SEA: 0, RAIL: 0, ENERGY: 0, DATA: 0 },
        effectiveCapacityByMode: { LAND: 0, SEA: 0, RAIL: 0, ENERGY: 0, DATA: 0 },
        damaged: 0,
        blocked: 0
    };
    for (const corridor of corridors || []) {
        summary.total++;
        if (Object.prototype.hasOwnProperty.call(summary.byMode, corridor.mode)) {
            summary.byMode[corridor.mode]++;
            summary.baseCapacityByMode[corridor.mode] += Number(corridor.baseCapacity) || 0;
            summary.effectiveCapacityByMode[corridor.mode] += Number(corridor.effectiveCapacity) || 0;
        }
        if (corridor.status === 'DAMAGED') summary.damaged++;
        if (corridor.status === 'BLOCKED') summary.blocked++;
    }
    return summary;
}

function storyInfrastructureSnapshot() {
    const graph = storyInfrastructureEnsure();
    if (!graph) {
        return {
            schemaVersion: STORY_INFRASTRUCTURE_SCHEMA_VERSION,
            adapterVersion: STORY_INFRASTRUCTURE_ADAPTER_VERSION,
            disabled: true,
            topologyHash: null,
            networkHash: null,
            damageRevision: 0,
            corridors: [],
            summary: storyInfrastructureSummary([]),
            diagnostics: { warnings: ['Altyapı grafı özellik bayrağıyla kapalı.'] }
        };
    }
    const corridors = graph.corridors.map(storyInfrastructureCorridorView);
    return {
        schemaVersion: graph.schemaVersion,
        adapterVersion: graph.adapterVersion,
        disabled: false,
        generatedAt: Number(STORY.clock) || 0,
        topologyHash: graph.topologyHash,
        networkHash: graph.networkHash,
        damageRevision: graph.damageRevision,
        corridors,
        summary: storyInfrastructureSummary(corridors),
        diagnostics: storyInfrastructureClone(graph.diagnostics)
    };
}

function storyInfrastructureSnapshotValidate(snapshot) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
        return { ok: false, issues: [{ code: 'SNAPSHOT_REQUIRED', path: '$', message: 'Altyapı görünümü nesne olmalı.' }] };
    }
    if (snapshot.schemaVersion !== STORY_INFRASTRUCTURE_SCHEMA_VERSION) add('SCHEMA_VERSION', '$.schemaVersion', 'Altyapı görünüm sürümü uyuşmuyor.');
    if (snapshot.adapterVersion !== STORY_INFRASTRUCTURE_ADAPTER_VERSION) add('ADAPTER_VERSION', '$.adapterVersion', 'Altyapı görünüm adaptörü uyuşmuyor.');
    if (snapshot.disabled) return { ok: issues.length === 0, issues };
    const graphValidation = storyInfrastructureGraphValidate({
        schemaVersion: snapshot.schemaVersion,
        adapterVersion: snapshot.adapterVersion,
        generatedAt: snapshot.generatedAt,
        topologyHash: snapshot.topologyHash,
        networkHash: snapshot.networkHash,
        damageRevision: snapshot.damageRevision,
        corridors: (snapshot.corridors || []).map(corridor => {
            const clean = storyInfrastructureClone(corridor);
            delete clean.effectiveCapacity;
            delete clean.status;
            delete clean.access;
            return clean;
        }),
        diagnostics: snapshot.diagnostics
    });
    issues.push(...graphValidation.issues);
    const expectedSummary = storyInfrastructureSummary(snapshot.corridors || []);
    if (storyInfrastructureStable(snapshot.summary) !== storyInfrastructureStable(expectedSummary)) {
        add('SUMMARY_MISMATCH', '$.summary', 'Altyapı özeti koridor görünümüyle uyuşmuyor.');
    }
    return { ok: issues.length === 0, issues };
}

function storyInfrastructureCorridorIdsForRegion(regionId, mode) {
    // RegionSnapshot bunu her bölge için çağırır; aynı doğrulanmış grafı 152 kez
    // yeniden doğrulamak yerine mevcut sidecar'ı doğrudan indeksler.
    const graph = STORY.infrastructureGraph || storyInfrastructureEnsure();
    if (!graph) return [];
    return graph.corridors
        .filter(corridor => (!mode || corridor.mode === mode)
            && corridor.endpointRegionIds.includes(String(regionId)))
        .map(corridor => corridor.id)
        .sort();
}

function storyInfrastructureGetCorridor(corridorId) {
    const graph = STORY.infrastructureGraph || storyInfrastructureEnsure();
    return graph
        ? graph.corridors.find(corridor => corridor.id === String(corridorId)) || null
        : null;
}

// Faz 14 test/olay kapısıdır. Faz 18 ticareti bu hasarı canlı sevkiyat
// gecikmesi/kesintisi olarak okur; savaşın hasar yazması Faz 48 kapsamındadır.
function storyInfrastructureSetDamage(corridorId, damageBps, options) {
    const graph = storyInfrastructureEnsure();
    if (!graph) return { ok: false, reason: 'FEATURE_DISABLED' };
    const corridor = graph.corridors.find(candidate => candidate.id === String(corridorId));
    if (!corridor) return { ok: false, reason: 'CORRIDOR_NOT_FOUND' };
    const number = Number(damageBps);
    if (!Number.isFinite(number)) return { ok: false, reason: 'INVALID_DAMAGE' };
    const next = Math.max(0, Math.min(10000, Math.round(number)));
    const previous = corridor.damageBps;
    corridor.damageBps = next;
    if (options && Object.prototype.hasOwnProperty.call(options, 'enabled')) {
        corridor.enabled = !!options.enabled;
    }
    if (previous !== corridor.damageBps || (options && Object.prototype.hasOwnProperty.call(options, 'enabled'))) {
        graph.damageRevision++;
        if (typeof storyRoutePlannerInvalidate === 'function') {
            storyRoutePlannerInvalidate({ corridorIds: [corridor.id] });
        }
    }
    return {
        ok: true,
        corridorId: corridor.id,
        previousDamageBps: previous,
        damageBps: corridor.damageBps,
        effectiveCapacity: storyInfrastructureEffectiveCapacity(corridor),
        damageRevision: graph.damageRevision
    };
}

function storyInfrastructureActorCanUse(corridor, actorCountryId) {
    if (!actorCountryId || corridor.accessPolicy === 'PUBLIC') return true;
    return storyInfrastructureEndpointOwners(corridor).includes(String(actorCountryId));
}

function storyInfrastructureAuthorizedCountriesCanUse(corridor, authorizedCountryIds) {
    if (!corridor || corridor.accessPolicy === 'PUBLIC') return true;
    const authorized = new Set((authorizedCountryIds || []).map(String));
    if (!authorized.size) return false;
    const owners = storyInfrastructureEndpointOwners(corridor);
    return owners.length > 0 && owners.every(countryId => authorized.has(countryId));
}

function storyInfrastructureFindRoute(fromRegionId, toRegionId, options) {
    options = options || {};
    const graph = STORY.infrastructureGraph || storyInfrastructureEnsure();
    if (!graph) return { ok: false, reason: 'FEATURE_DISABLED' };
    const from = String(fromRegionId);
    const to = String(toRegionId);
    const regionIds = new Set(((STORY.regionModel && STORY.regionModel.regions) || []).map(region => region.id));
    if (!regionIds.has(from) || !regionIds.has(to)) return { ok: false, reason: 'REGION_NOT_FOUND' };
    if (from === to) return { ok: true, regionIds: [from], corridorIds: [], totalCost: 0, totalLatencySeconds: 0, bottleneckCapacity: Infinity };
    const modes = new Set((Array.isArray(options.modes) ? options.modes : [options.mode || 'LAND']).map(String));
    const actorCountryId = options.actorCountryId == null ? null : String(options.actorCountryId);
    const authorizedCountryIds = Array.isArray(options.authorizedCountryIds)
        ? options.authorizedCountryIds.map(String)
        : null;
    const minCapacity = Math.max(0, Number(options.minCapacity) || 0);
    const adjacency = new Map();
    for (const corridor of graph.corridors) {
        if (!modes.has(corridor.mode)) continue;
        const capacity = storyInfrastructureEffectiveCapacity(corridor);
        if (capacity < minCapacity || capacity <= 0
            || (authorizedCountryIds
                ? !storyInfrastructureAuthorizedCountriesCanUse(corridor, authorizedCountryIds)
                : !storyInfrastructureActorCanUse(corridor, actorCountryId))) continue;
        const [a, b] = corridor.endpointRegionIds;
        if (!adjacency.has(a)) adjacency.set(a, []);
        if (!adjacency.has(b)) adjacency.set(b, []);
        adjacency.get(a).push({ next: b, corridor, capacity });
        adjacency.get(b).push({ next: a, corridor, capacity });
    }
    for (const edges of adjacency.values()) edges.sort((a, b) => a.corridor.id.localeCompare(b.corridor.id));

    const best = new Map([[from, { score: 0, key: '', regions: [from], corridors: [], cost: 0, latency: 0, bottleneck: Infinity }]]);
    const open = [from];
    while (open.length) {
        open.sort((a, b) => {
            const av = best.get(a);
            const bv = best.get(b);
            return av.score - bv.score || av.key.localeCompare(bv.key) || a.localeCompare(b);
        });
        const current = open.shift();
        const state = best.get(current);
        if (current === to) {
            return {
                ok: true,
                regionIds: state.regions,
                corridorIds: state.corridors,
                totalCost: storyInfrastructureRound(state.cost),
                totalLatencySeconds: storyInfrastructureRound(state.latency),
                bottleneckCapacity: state.bottleneck
            };
        }
        for (const edge of adjacency.get(current) || []) {
            const nextCost = state.cost + Number(edge.corridor.costPerUnit);
            const nextLatency = state.latency + Number(edge.corridor.latencySeconds);
            const score = nextCost + nextLatency;
            const corridors = state.corridors.concat(edge.corridor.id);
            const key = corridors.join('|');
            const previous = best.get(edge.next);
            if (!previous || score < previous.score - 1e-9
                || (Math.abs(score - previous.score) <= 1e-9 && key.localeCompare(previous.key) < 0)) {
                best.set(edge.next, {
                    score,
                    key,
                    regions: state.regions.concat(edge.next),
                    corridors,
                    cost: nextCost,
                    latency: nextLatency,
                    bottleneck: Math.min(state.bottleneck, edge.capacity)
                });
                if (!open.includes(edge.next)) open.push(edge.next);
            }
        }
    }
    return { ok: false, reason: 'NO_ROUTE', regionIds: [], corridorIds: [] };
}

function storyInfrastructureResolveFlow(flow) {
    flow = flow || {};
    const graph = STORY.infrastructureGraph || storyInfrastructureEnsure();
    if (!graph) return { ok: false, flowId: String(flow.id || ''), reason: 'FEATURE_DISABLED', delivered: 0 };
    const corridorIds = Array.isArray(flow.corridorIds) ? flow.corridorIds.map(String) : [];
    const demand = Math.max(0, Number(flow.demand) || 0);
    const mode = String(flow.mode || 'LAND');
    const actorCountryId = flow.actorCountryId == null ? null : String(flow.actorCountryId);
    const corridors = [];
    for (const corridorId of corridorIds) {
        const corridor = graph.corridors.find(candidate => candidate.id === corridorId);
        if (!corridor) return { ok: false, flowId: String(flow.id || ''), reason: 'CORRIDOR_NOT_FOUND', corridorId, delivered: 0 };
        if (corridor.mode !== mode) return { ok: false, flowId: String(flow.id || ''), reason: 'MODE_MISMATCH', corridorId, delivered: 0 };
        if (!storyInfrastructureActorCanUse(corridor, actorCountryId)) {
            return { ok: false, flowId: String(flow.id || ''), reason: 'ACCESS_DENIED', corridorId, delivered: 0 };
        }
        corridors.push(corridor);
    }
    const capacities = corridors.map(storyInfrastructureEffectiveCapacity);
    const bottleneckCapacity = capacities.length ? Math.min(...capacities) : 0;
    const delivered = Math.min(demand, bottleneckCapacity);
    const blockedCorridorIds = corridors
        .filter(corridor => storyInfrastructureEffectiveCapacity(corridor) <= 0)
        .map(corridor => corridor.id);
    return {
        ok: blockedCorridorIds.length === 0,
        flowId: String(flow.id || ''),
        mode,
        demand,
        delivered,
        unmet: Math.max(0, demand - delivered),
        bottleneckCapacity,
        corridorIds,
        blockedCorridorIds,
        damageRevision: graph.damageRevision
    };
}

function storyInfrastructureResolveFlows(flows) {
    return (Array.isArray(flows) ? flows : []).map(storyInfrastructureResolveFlow);
}
