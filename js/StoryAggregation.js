//  BÖLGE TOPLULAŞTIRMA / AYRINTILANDIRMA — Faz 13
//  ---------------------------------------------------------------------------
//  HOT bölgenin tam JSON durumu sürümlü bir kapsüle dondurulur; COLD görünüm
//  yalnız korunması gereken toplamları taşır. Kapsül yeniden açıldığında tam
//  bölge byte-eşdeğer kanonik içerikle geri kurulabilir.
//
//  Mevcut motor henüz COLD kayıtları canlı node yerine çalıştırmaz. Bu modül
//  veri-koruma ve geçiş sözleşmesidir; Faz 13 kabulü geçmeden uzak bölge
//  sistemlerini seyrekleştirmek nüfus, stok veya üretim kuyruğu silebilirdi.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_AGGREGATION_SCHEMA_VERSION = 1;
const STORY_AGGREGATION_POLICY_VERSION = 'region-aggregate-policy-1';

function storyAggregationEnabled() {
    return typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('world.regionAggregation');
}

function storyAggregationClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyAggregationStable(value) {
    if (value == null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(storyAggregationStable).join(',')}]`;
    const keys = Object.keys(value).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${storyAggregationStable(value[key])}`).join(',')}}`;
}

function storyAggregationHash(value) {
    const text = storyAggregationStable(value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return `fnv1a32:${(`00000000${(hash >>> 0).toString(16)}`).slice(-8)}`;
}

function storyAggregationRound(value, digits) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    const scale = 10 ** (digits == null ? 6 : digits);
    return Math.round(number * scale) / scale;
}

function storyAggregationNumericMap(value) {
    const result = {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
    for (const key of Object.keys(value).sort()) {
        const amount = Number(value[key]);
        if (Number.isFinite(amount)) result[String(key)] = storyAggregationRound(amount);
    }
    return result;
}

function storyAggregationQueueSummary(queue) {
    const byType = {};
    let remainingWork = 0;
    let totalWork = 0;
    for (const job of (Array.isArray(queue) ? queue : [])) {
        const type = String(job && job.type != null ? job.type : 'unknown');
        byType[type] = (byType[type] || 0) + 1;
        remainingWork += Math.max(0, Number(job && job.t) || 0);
        totalWork += Math.max(0, Number(job && job.tot) || 0);
    }
    return {
        count: (Array.isArray(queue) ? queue.length : 0),
        remainingWork: storyAggregationRound(remainingWork),
        totalWork: storyAggregationRound(totalWork),
        byType: Object.fromEntries(Object.keys(byType).sort().map(key => [key, byType[key]]))
    };
}

function storyAggregationSummaryFromPayload(payload) {
    const node = payload || {};
    const companyIds = Array.isArray(node.companyIds) ? node.companyIds.map(String).sort() : [];
    const pendingEvents = Array.isArray(node.pendingEvents) ? node.pendingEvents : [];
    return {
        ownerId: node.owner == null ? null : `country:${Number(node.owner)}`,
        population: storyAggregationRound(node.pop),
        wealth: storyAggregationRound(node.wealth),
        level: Math.max(1, Number(node.level) || 1),
        infrastructure: {
            factory: Math.max(0, Number(node.fac) || 0),
            barracks: Math.max(0, Number(node.bar) || 0)
        },
        military: {
            garrison: Math.max(0, Number(node.garrison) || 0),
            legacyPool: storyAggregationNumericMap(node.pool)
        },
        deposits: {
            oil: Math.max(0, Number(node.oil) || 0),
            cities: Math.max(0, Number(node.cities) || 0),
            points: Math.max(0, Number(node.pts) || 0),
            mine: !!node.mine
        },
        stocks: storyAggregationNumericMap(node.stocks),
        production: storyAggregationQueueSummary(node.q),
        companies: {
            count: companyIds.length,
            ids: companyIds
        },
        pendingEvents: {
            count: pendingEvents.length,
            activeSiege: !!node._siege
        }
    };
}

function storyAggregationPolicyBase(options) {
    options = options || {};
    return {
        schemaVersion: STORY_AGGREGATION_SCHEMA_VERSION,
        policyVersion: STORY_AGGREGATION_POLICY_VERSION,
        topologyHash: STORY.regionModel ? STORY.regionModel.topologyHash : null,
        diagnostics: {
            backfilled: !!options.backfilled,
            restoredFromInvalidPolicy: !!options.restoredFromInvalidPolicy,
            issues: Array.isArray(options.issues) ? storyAggregationClone(options.issues).slice(0, 30) : [],
            warnings: Array.isArray(options.warnings) ? options.warnings.map(String).slice(0, 30) : []
        }
    };
}

function storyAggregationPolicyValidate(policy) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
        return {
            ok: false,
            issues: [{ code: 'POLICY_REQUIRED', path: '$', message: 'Toplulaştırma politikası nesnesi zorunlu.' }]
        };
    }
    if (policy.schemaVersion !== STORY_AGGREGATION_SCHEMA_VERSION) {
        add('SCHEMA_VERSION', '$.schemaVersion', `Beklenen toplulaştırma sürümü ${STORY_AGGREGATION_SCHEMA_VERSION}.`);
    }
    if (policy.policyVersion !== STORY_AGGREGATION_POLICY_VERSION) {
        add('POLICY_VERSION', '$.policyVersion', `Beklenen politika ${STORY_AGGREGATION_POLICY_VERSION}.`);
    }
    const expectedTopologyHash = STORY.regionModel ? STORY.regionModel.topologyHash : null;
    if (policy.topologyHash !== expectedTopologyHash) {
        add('TOPOLOGY_HASH_MISMATCH', '$.topologyHash', 'Toplulaştırma politikası güncel bölge topolojisine ait değil.');
    }
    return { ok: issues.length === 0, issues };
}

function storyAggregationReset(options) {
    if (!storyAggregationEnabled()) {
        STORY.aggregationPolicy = null;
        return null;
    }
    STORY.aggregationPolicy = storyAggregationPolicyBase(options);
    return STORY.aggregationPolicy;
}

function storyAggregationRestore(saved) {
    if (!storyAggregationEnabled()) {
        STORY.aggregationPolicy = null;
        return null;
    }
    if (!saved) {
        return storyAggregationReset({
            backfilled: true,
            warnings: ['Kayıt toplulaştırma politikası taşımıyordu; güncel kayıpsız politika kullanıldı.']
        });
    }
    const candidate = storyAggregationClone(saved);
    const validation = storyAggregationPolicyValidate(candidate);
    if (!validation.ok) {
        return storyAggregationReset({
            backfilled: true,
            restoredFromInvalidPolicy: true,
            issues: validation.issues,
            warnings: ['Geçersiz toplulaştırma politikası kullanılmadı; güncel politika yeniden kuruldu.']
        });
    }
    STORY.aggregationPolicy = candidate;
    return STORY.aggregationPolicy;
}

function storyAggregationEnsurePolicy() {
    if (!storyAggregationEnabled()) return null;
    if (!STORY.aggregationPolicy) return storyAggregationReset({ backfilled: true });
    const validation = storyAggregationPolicyValidate(STORY.aggregationPolicy);
    if (!validation.ok) {
        return storyAggregationReset({
            backfilled: true,
            restoredFromInvalidPolicy: true,
            issues: validation.issues,
            warnings: ['Bölge topolojisi değişti; toplulaştırma politikası yeniden kuruldu.']
        });
    }
    return STORY.aggregationPolicy;
}

function storyAggregationForSave() {
    const policy = storyAggregationEnsurePolicy();
    return policy ? storyAggregationClone(policy) : null;
}

function storyAggregationCreateCapsule(regionId, sourceNode) {
    if (!storyAggregationEnabled()) return null;
    const node = sourceNode || storyNode(Number(regionId));
    if (!node) return null;
    if (!STORY.aggregationPolicy) storyAggregationEnsurePolicy();
    const payload = storyAggregationClone(node);
    const summary = storyAggregationSummaryFromPayload(payload);
    return {
        schemaVersion: STORY_AGGREGATION_SCHEMA_VERSION,
        policyVersion: STORY_AGGREGATION_POLICY_VERSION,
        id: `aggregate:region:${Number(node.id)}`,
        regionId: `region:${Number(node.id)}`,
        legacyId: Number(node.id),
        createdAt: storyAggregationRound(STORY.clock),
        topologyHash: STORY.regionModel ? STORY.regionModel.topologyHash : null,
        payloadHash: storyAggregationHash(payload),
        summaryHash: storyAggregationHash(summary),
        summary,
        payload
    };
}

function storyAggregationCapsuleValidate(capsule) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!capsule || typeof capsule !== 'object' || Array.isArray(capsule)) {
        return { ok: false, issues: [{ code: 'CAPSULE_REQUIRED', path: '$', message: 'Bölge kapsülü nesnesi zorunlu.' }] };
    }
    if (capsule.schemaVersion !== STORY_AGGREGATION_SCHEMA_VERSION) add('SCHEMA_VERSION', '$.schemaVersion', 'Kapsül şema sürümü uyuşmuyor.');
    if (capsule.policyVersion !== STORY_AGGREGATION_POLICY_VERSION) add('POLICY_VERSION', '$.policyVersion', 'Kapsül politika sürümü uyuşmuyor.');
    if (!Number.isInteger(Number(capsule.legacyId)) || capsule.regionId !== `region:${Number(capsule.legacyId)}`) {
        add('REGION_ID_MISMATCH', '$.regionId', 'Kapsül kalıcı bölge kimliğine bağlanmalı.');
    }
    if (!capsule.payload || typeof capsule.payload !== 'object' || Array.isArray(capsule.payload)) {
        add('PAYLOAD_REQUIRED', '$.payload', 'Kapsül tam bölge payload’ı taşımalı.');
    } else {
        if (Number(capsule.payload.id) !== Number(capsule.legacyId)) {
            add('PAYLOAD_REGION_MISMATCH', '$.payload.id', 'Payload başka bölgeye ait.');
        }
        const live = STORY.nodes && STORY.nodes[Number(capsule.legacyId)];
        if (live) {
            const payloadNeighbors = [...new Set((capsule.payload.neighbors || []).map(Number))].sort((a, b) => a - b);
            const liveNeighbors = [...new Set((live.neighbors || []).map(Number))].sort((a, b) => a - b);
            if (Number(capsule.payload.lx) !== Number(live.lx)
                || Number(capsule.payload.ly) !== Number(live.ly)
                || (Number(capsule.payload.mapId) || 0) !== (Number(live.mapId) || 0)
                || storyAggregationStable(payloadNeighbors) !== storyAggregationStable(liveNeighbors)) {
                add('STATIC_TOPOLOGY_MISMATCH', '$.payload', 'Kapsül bölgenin sabit konum/komşuluk sözleşmesini değiştiremez.');
            }
        }
        if (capsule.payloadHash !== storyAggregationHash(capsule.payload)) {
            add('PAYLOAD_HASH_MISMATCH', '$.payloadHash', 'Kapsül payload checksum doğrulamasını geçmedi.');
        }
        const expectedSummary = storyAggregationSummaryFromPayload(capsule.payload);
        if (capsule.summaryHash !== storyAggregationHash(expectedSummary)) {
            add('SUMMARY_HASH_MISMATCH', '$.summaryHash', 'Kapsül özet checksum doğrulamasını geçmedi.');
        }
        if (storyAggregationStable(capsule.summary) !== storyAggregationStable(expectedSummary)) {
            add('SUMMARY_PAYLOAD_MISMATCH', '$.summary', 'Kapsül özeti tam payload ile uyuşmuyor.');
        }
    }
    const expectedTopologyHash = STORY.regionModel ? STORY.regionModel.topologyHash : null;
    if (capsule.topologyHash !== expectedTopologyHash) {
        add('TOPOLOGY_HASH_MISMATCH', '$.topologyHash', 'Kapsül güncel bölge topolojisine ait değil.');
    }
    return { ok: issues.length === 0, issues };
}

function storyAggregationToCold(regionId, sourceNode) {
    if (!storyAggregationEnabled()) {
        const node = sourceNode || storyNode(Number(regionId));
        return {
            mode: 'HOT',
            disabled: true,
            regionId: node ? `region:${node.id}` : null,
            node: storyAggregationClone(node)
        };
    }
    const capsule = storyAggregationCreateCapsule(regionId, sourceNode);
    if (!capsule) return null;
    const validation = storyAggregationCapsuleValidate(capsule);
    if (!validation.ok) return { mode: 'INVALID', capsule, validation };
    return {
        schemaVersion: STORY_AGGREGATION_SCHEMA_VERSION,
        mode: 'COLD',
        regionId: capsule.regionId,
        legacyId: capsule.legacyId,
        frozenAt: capsule.createdAt,
        summary: storyAggregationClone(capsule.summary),
        capsule
    };
}

function storyAggregationToHot(coldState) {
    if (!coldState || coldState.mode !== 'COLD' || !coldState.capsule) {
        return { ok: false, node: null, issues: [{ code: 'COLD_STATE_REQUIRED', path: '$', message: 'COLD geçiş kaydı zorunlu.' }] };
    }
    const validation = storyAggregationCapsuleValidate(coldState.capsule);
    if (!validation.ok) return { ok: false, node: null, issues: validation.issues };
    return {
        ok: true,
        mode: 'HOT',
        regionId: coldState.regionId,
        node: storyAggregationClone(coldState.capsule.payload),
        summary: storyAggregationClone(coldState.capsule.summary),
        issues: []
    };
}

function storyAggregationConservationSignature(items) {
    const signature = {
        regionCount: 0,
        population: 0,
        wealth: 0,
        garrison: 0,
        infrastructure: { factory: 0, barracks: 0 },
        deposits: { oil: 0, cities: 0, points: 0 },
        queueCount: 0,
        queueRemainingWork: 0,
        legacyPoolUnits: 0,
        companyCount: 0,
        pendingEventCount: 0
    };
    signature.stocks = typeof STORY_RESOURCE_IDS !== 'undefined'
        ? Object.fromEntries(STORY_RESOURCE_IDS.map(id => [id, 0]))
        : {};
    for (const item of (items || [])) {
        const summary = item && item.summary
            ? item.summary
            : storyAggregationSummaryFromPayload(item && item.payload ? item.payload : item);
        signature.regionCount++;
        signature.population += Number(summary.population) || 0;
        signature.wealth += Number(summary.wealth) || 0;
        signature.garrison += Number(summary.military && summary.military.garrison) || 0;
        signature.infrastructure.factory += Number(summary.infrastructure && summary.infrastructure.factory) || 0;
        signature.infrastructure.barracks += Number(summary.infrastructure && summary.infrastructure.barracks) || 0;
        signature.deposits.oil += Number(summary.deposits && summary.deposits.oil) || 0;
        signature.deposits.cities += Number(summary.deposits && summary.deposits.cities) || 0;
        signature.deposits.points += Number(summary.deposits && summary.deposits.points) || 0;
        signature.queueCount += Number(summary.production && summary.production.count) || 0;
        signature.queueRemainingWork += Number(summary.production && summary.production.remainingWork) || 0;
        signature.companyCount += Number(summary.companies && summary.companies.count) || 0;
        signature.pendingEventCount += (Number(summary.pendingEvents && summary.pendingEvents.count) || 0)
            + (summary.pendingEvents && summary.pendingEvents.activeSiege ? 1 : 0);
        for (const [resourceId, amount] of Object.entries(summary.stocks || {})) {
            signature.stocks[resourceId] = (Number(signature.stocks[resourceId]) || 0) + (Number(amount) || 0);
        }
        for (const value of Object.values(summary.military && summary.military.legacyPool || {})) {
            signature.legacyPoolUnits += Number(value) || 0;
        }
    }
    const roundDeep = value => {
        if (value && typeof value === 'object') {
            for (const key of Object.keys(value)) {
                if (typeof value[key] === 'number') value[key] = storyAggregationRound(value[key]);
                else roundDeep(value[key]);
            }
        }
    };
    roundDeep(signature);
    return signature;
}

function storyAggregationWorldConservation(items) {
    const signature = storyAggregationConservationSignature(items);
    signature.countryResources = { oil: 0, manpower: 0, points: 0, chips: 0 };
    for (const state of (STORY.states || [])) {
        signature.countryResources.oil += Number(state.res && state.res.oil) || 0;
        signature.countryResources.manpower += Number(state.res && state.res.manpower) || 0;
        signature.countryResources.points += Number(state.res && state.res.points) || 0;
        signature.countryResources.chips += Number(state.chips) || 0;
    }
    for (const key of Object.keys(signature.countryResources)) {
        signature.countryResources[key] = storyAggregationRound(signature.countryResources[key]);
    }
    return signature;
}

function storyAggregationDistribute(total, keys, salt, precision) {
    const ordered = [...new Set((keys || []).map(String))].sort();
    if (!ordered.length) return {};
    const digits = Math.max(0, Math.min(6, Number.isInteger(precision) ? precision : 3));
    const scale = 10 ** digits;
    const units = Math.round((Number(total) || 0) * scale);
    const sign = units < 0 ? -1 : 1;
    const absolute = Math.abs(units);
    const base = Math.floor(absolute / ordered.length);
    let remainder = absolute - base * ordered.length;
    const ranked = ordered.slice().sort((a, b) => {
        const ha = storyAggregationHash(`${salt || ''}:${a}`);
        const hb = storyAggregationHash(`${salt || ''}:${b}`);
        return ha.localeCompare(hb) || a.localeCompare(b);
    });
    const unitMap = Object.fromEntries(ordered.map(key => [key, base]));
    for (let index = 0; index < ranked.length && remainder > 0; index++, remainder--) {
        unitMap[ranked[index]]++;
    }
    return Object.fromEntries(ordered.map(key => [key, sign * unitMap[key] / scale]));
}

function storyAggregationSnapshot() {
    const policy = storyAggregationEnsurePolicy();
    if (!policy) {
        return {
            schemaVersion: STORY_AGGREGATION_SCHEMA_VERSION,
            policyVersion: STORY_AGGREGATION_POLICY_VERSION,
            disabled: true,
            topologyHash: null,
            regions: [],
            conservation: storyAggregationWorldConservation([]),
            diagnostics: { warnings: ['Bölge toplulaştırması özellik bayrağıyla kapalı.'] }
        };
    }
    const regions = (STORY.nodes || []).map(node => {
        const capsule = storyAggregationCreateCapsule(node.id, node);
        return {
            regionId: capsule.regionId,
            legacyId: capsule.legacyId,
            payloadHash: capsule.payloadHash,
            summaryHash: capsule.summaryHash,
            summary: capsule.summary
        };
    });
    return {
        schemaVersion: STORY_AGGREGATION_SCHEMA_VERSION,
        policyVersion: STORY_AGGREGATION_POLICY_VERSION,
        disabled: false,
        generatedAt: storyAggregationRound(STORY.clock),
        topologyHash: policy.topologyHash,
        regions,
        conservation: storyAggregationWorldConservation(regions),
        diagnostics: storyAggregationClone(policy.diagnostics)
    };
}

function storyAggregationSnapshotValidate(snapshot) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
        return { ok: false, issues: [{ code: 'SNAPSHOT_REQUIRED', path: '$', message: 'Toplulaştırma görünümü nesne olmalı.' }] };
    }
    if (snapshot.schemaVersion !== STORY_AGGREGATION_SCHEMA_VERSION) add('SCHEMA_VERSION', '$.schemaVersion', 'Toplulaştırma şema sürümü uyuşmuyor.');
    if (snapshot.policyVersion !== STORY_AGGREGATION_POLICY_VERSION) add('POLICY_VERSION', '$.policyVersion', 'Toplulaştırma politika sürümü uyuşmuyor.');
    if (snapshot.disabled) return { ok: issues.length === 0, issues };
    if (snapshot.topologyHash !== (STORY.regionModel && STORY.regionModel.topologyHash)) {
        add('TOPOLOGY_HASH_MISMATCH', '$.topologyHash', 'Toplulaştırma görünümü güncel topolojiye ait değil.');
    }
    if (!Array.isArray(snapshot.regions)) {
        add('REGIONS_ARRAY', '$.regions', 'Toplulaştırma bölgeleri dizi olmalı.');
        return { ok: false, issues };
    }
    if (snapshot.regions.length !== (STORY.nodes || []).length) {
        add('REGION_COUNT_MISMATCH', '$.regions', 'Her canlı bölge bir özet taşımalı.');
    }
    const ids = new Set();
    snapshot.regions.forEach((region, index) => {
        const at = `$.regions[${index}]`;
        if (!region || typeof region !== 'object') {
            add('INVALID_REGION', at, 'Toplulaştırılmış bölge nesne olmalı.');
            return;
        }
        if (ids.has(region.regionId)) add('DUPLICATE_REGION_ID', `${at}.regionId`, `Yinelenen bölge: ${region.regionId}`);
        ids.add(region.regionId);
        if (region.regionId !== `region:${Number(region.legacyId)}` || !STORY.nodes[region.legacyId]) {
            add('REGION_ID_MISMATCH', `${at}.regionId`, 'Özet canlı bölge kimliğine bağlanmalı.');
        }
        if (region.summaryHash !== storyAggregationHash(region.summary)) {
            add('SUMMARY_HASH_MISMATCH', `${at}.summaryHash`, 'Bölge özet checksum doğrulamasını geçmedi.');
        }
    });
    const expected = storyAggregationWorldConservation(snapshot.regions || []);
    if (storyAggregationStable(snapshot.conservation) !== storyAggregationStable(expected)) {
        add('CONSERVATION_MISMATCH', '$.conservation', 'Dünya korunum özeti bölge özetleriyle uyuşmuyor.');
    }
    return { ok: issues.length === 0, issues };
}
