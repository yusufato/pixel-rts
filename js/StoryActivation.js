//  BÖLGE AKTİVASYON BÜTÇELEYİCİSİ — Faz 12
//  ---------------------------------------------------------------------------
//  Sonraki ekonomi, toplum ve kurum sistemlerinin 152 bölgeyi aynı ayrıntıda
//  çalıştırması gerekmez. Bu servis bölgeleri dünya gerçeklerine göre
//  HOT/WARM/COLD olarak sıralar ve deterministik çalışma dilimleri üretir.
//
//  Kamera, seçili şehir, açık panel ve render görünürlüğü BİLEREK okunmaz.
//  Aktivasyon salt-okunur ve türetilmiştir; dinamik kopyası kaydedilmez.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_ACTIVATION_SCHEMA_VERSION = 1;
const STORY_ACTIVATION_POLICY_VERSION = 'region-activation-policy-1';
const STORY_ACTIVATION_LEVELS = Object.freeze(['HOT', 'WARM', 'COLD']);
const STORY_ACTIVATION_POLICY = Object.freeze({
    maxHot: 12,
    maxWarm: 48,
    recentControlSeconds: 60,
    levels: Object.freeze({
        HOT: Object.freeze({ cadenceTicks: 1, detailBps: 10000, eventBudget: 8 }),
        WARM: Object.freeze({ cadenceTicks: 4, detailBps: 4000, eventBudget: 3 }),
        COLD: Object.freeze({ cadenceTicks: 20, detailBps: 1000, eventBudget: 1 })
    })
});

function storyActivationEnabled() {
    return typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('world.regionActivation');
}

function storyActivationClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyActivationHashText(text) {
    const value = String(text == null ? '' : text);
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

function storyActivationPolicyBase(options) {
    options = options || {};
    return {
        schemaVersion: STORY_ACTIVATION_SCHEMA_VERSION,
        policyVersion: STORY_ACTIVATION_POLICY_VERSION,
        topologyHash: STORY.regionModel ? STORY.regionModel.topologyHash : null,
        diagnostics: {
            backfilled: !!options.backfilled,
            restoredFromInvalidPolicy: !!options.restoredFromInvalidPolicy,
            issues: Array.isArray(options.issues) ? storyActivationClone(options.issues).slice(0, 30) : [],
            warnings: Array.isArray(options.warnings) ? options.warnings.map(String).slice(0, 30) : []
        }
    };
}

function storyActivationPolicyValidate(policy) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
        return {
            ok: false,
            issues: [{ code: 'POLICY_REQUIRED', path: '$', message: 'Aktivasyon politikası nesnesi zorunlu.' }]
        };
    }
    if (policy.schemaVersion !== STORY_ACTIVATION_SCHEMA_VERSION) {
        add('SCHEMA_VERSION', '$.schemaVersion', `Beklenen aktivasyon sürümü ${STORY_ACTIVATION_SCHEMA_VERSION}.`);
    }
    if (policy.policyVersion !== STORY_ACTIVATION_POLICY_VERSION) {
        add('POLICY_VERSION', '$.policyVersion', `Beklenen politika ${STORY_ACTIVATION_POLICY_VERSION}.`);
    }
    const expectedTopologyHash = STORY.regionModel ? STORY.regionModel.topologyHash : null;
    if (policy.topologyHash !== expectedTopologyHash) {
        add('TOPOLOGY_HASH_MISMATCH', '$.topologyHash', 'Aktivasyon politikası güncel bölge topolojisine ait değil.');
    }
    return { ok: issues.length === 0, issues };
}

function storyActivationReset(options) {
    if (!storyActivationEnabled()) {
        STORY.activationPolicy = null;
        return null;
    }
    STORY.activationPolicy = storyActivationPolicyBase(options);
    return STORY.activationPolicy;
}

function storyActivationRestore(saved) {
    if (!storyActivationEnabled()) {
        STORY.activationPolicy = null;
        return null;
    }
    if (!saved) {
        return storyActivationReset({
            backfilled: true,
            warnings: ['Kayıt aktivasyon politikası taşımıyordu; güncel deterministik politika kullanıldı.']
        });
    }
    const candidate = storyActivationClone(saved);
    const validation = storyActivationPolicyValidate(candidate);
    if (!validation.ok) {
        return storyActivationReset({
            backfilled: true,
            restoredFromInvalidPolicy: true,
            issues: validation.issues,
            warnings: ['Geçersiz aktivasyon politikası kullanılmadı; güncel politika yeniden kuruldu.']
        });
    }
    STORY.activationPolicy = candidate;
    return STORY.activationPolicy;
}

function storyActivationEnsurePolicy() {
    if (!storyActivationEnabled()) return null;
    if (!STORY.activationPolicy) return storyActivationReset({ backfilled: true });
    const validation = storyActivationPolicyValidate(STORY.activationPolicy);
    if (!validation.ok) {
        return storyActivationReset({
            backfilled: true,
            restoredFromInvalidPolicy: true,
            issues: validation.issues,
            warnings: ['Bölge topolojisi değişti; aktivasyon politikası yeniden kuruldu.']
        });
    }
    return STORY.activationPolicy;
}

function storyActivationForSave() {
    const policy = storyActivationEnsurePolicy();
    return policy ? storyActivationClone(policy) : null;
}

function storyActivationRecentControlIds() {
    const result = new Set();
    const effects = STORY.causality && Array.isArray(STORY.causality.effects)
        ? STORY.causality.effects
        : [];
    const threshold = (Number(STORY.clock) || 0) - STORY_ACTIVATION_POLICY.recentControlSeconds;
    for (let index = effects.length - 1; index >= 0; index--) {
        const effect = effects[index];
        if (!effect || Number(effect.time) < threshold) break;
        const match = /^region:(\d+)\.ownerId$/.exec(String(effect.path || ''));
        if (match) result.add(Number(match[1]));
    }
    return result;
}

function storyActivationDistances(startId) {
    const nodes = STORY.nodes || [];
    const distances = new Array(nodes.length).fill(Infinity);
    if (!Number.isInteger(startId) || !nodes[startId]) return distances;
    distances[startId] = 0;
    const queue = [startId];
    for (let cursor = 0; cursor < queue.length; cursor++) {
        const currentId = queue[cursor];
        const current = nodes[currentId];
        for (const neighborId of (current.neighbors || [])) {
            if (distances[neighborId] !== Infinity) continue;
            distances[neighborId] = distances[currentId] + 1;
            queue.push(neighborId);
        }
    }
    return distances;
}

function storyActivationCandidate(node, context) {
    const reasons = [];
    let priority = 0;
    const add = (reason, score) => {
        reasons.push(reason);
        priority += score;
    };
    if (node.id === context.commanderNodeId) add('PLAYER_COMMANDER', 120000);
    if (context.battleIds.has(node.id)) add('ACTIVE_BATTLE', 115000);
    if (node._siege) add('ACTIVE_SIEGE', 110000);
    if (context.capitalIds.has(node.id)) add('CAPITAL', 100000);
    if (context.recentControlIds.has(node.id)) add('RECENT_CONTROL_CHANGE', 90000);

    const distance = context.distances[node.id];
    if (distance === 1) add('COMMANDER_NEIGHBOR', 70000);
    else if (distance === 2) add('COMMANDER_NEAR', 50000);

    const neighbors = (node.neighbors || []).map(storyNode).filter(Boolean);
    const frontier = neighbors.some(neighbor => neighbor.owner !== node.owner);
    if (frontier) add(node.owner === STORY.playerStateId ? 'PLAYER_FRONTIER' : 'WORLD_FRONTIER', node.owner === STORY.playerStateId ? 40000 : 18000);
    if (node.owner === STORY.playerStateId) add('PLAYER_CONTROLLED', 12000);

    const level = Math.max(1, Number(node.level) || 1);
    const infrastructure = typeof prodInfraLevel === 'function'
        ? Math.max(0, prodInfraLevel(node))                       // ALTI BİNA: tesis toplamı
        : Math.max(0, Number(node.fac) || 0) + Math.max(0, Number(node.bar) || 0);
    const population = Math.max(0, Number(node.pop) || 0);
    const garrison = Math.max(0, Number(node.garrison) || 0);
    priority += level * 1200 + infrastructure * 350 + Math.min(3000, population / 1000) + Math.min(2000, garrison * 10);
    if (!reasons.length) reasons.push('BACKGROUND');
    return {
        id: `region:${node.id}`,
        legacyId: node.id,
        priority: Math.round(priority * 1000) / 1000,
        reasons
    };
}

function storyActivationContext() {
    const commanderNodeId = Number(STORY.commander && STORY.commander.node);
    const battleIds = new Set();
    const battle = STORY.battleCtx;
    if (battle && Number.isInteger(Number(battle.nodeId))) battleIds.add(Number(battle.nodeId));
    if (battle && Number.isInteger(Number(battle.enemyStageNode))) battleIds.add(Number(battle.enemyStageNode));
    return {
        commanderNodeId,
        battleIds,
        capitalIds: new Set((STORY._capitals || []).map(Number).filter(Number.isInteger)),
        recentControlIds: storyActivationRecentControlIds(),
        distances: storyActivationDistances(commanderNodeId)
    };
}

function storyActivationCurrentTick() {
    if (typeof storyClockSnapshot === 'function') {
        const clock = storyClockSnapshot();
        if (Number.isInteger(clock.tick)) return clock.tick;
    }
    return Math.max(0, Math.floor((Number(STORY.clock) || 0) * 4));
}

function storyActivationBuildSnapshot() {
    const policy = storyActivationEnsurePolicy();
    if (!policy) {
        return {
            schemaVersion: STORY_ACTIVATION_SCHEMA_VERSION,
            policyVersion: STORY_ACTIVATION_POLICY_VERSION,
            disabled: true,
            generatedAt: Number(STORY.clock) || 0,
            topologyHash: null,
            regions: [],
            summary: { HOT: 0, WARM: 0, COLD: 0, relativeWorkBps: 0 },
            diagnostics: { warnings: ['Bölge aktivasyonu özellik bayrağıyla kapalı.'] }
        };
    }
    const context = storyActivationContext();
    const candidates = (STORY.nodes || [])
        .map(node => storyActivationCandidate(node, context))
        .sort((a, b) => b.priority - a.priority || a.legacyId - b.legacyId);
    const regions = candidates.map((candidate, rank) => {
        const level = rank < STORY_ACTIVATION_POLICY.maxHot
            ? 'HOT'
            : rank < STORY_ACTIVATION_POLICY.maxHot + STORY_ACTIVATION_POLICY.maxWarm
                ? 'WARM'
                : 'COLD';
        const budget = STORY_ACTIVATION_POLICY.levels[level];
        return Object.assign({}, candidate, {
            rank,
            level,
            budget: storyActivationClone(budget)
        });
    }).sort((a, b) => a.legacyId - b.legacyId);
    const summary = { HOT: 0, WARM: 0, COLD: 0, relativeWorkBps: 0 };
    for (const region of regions) {
        summary[region.level]++;
        summary.relativeWorkBps += region.budget.detailBps / region.budget.cadenceTicks;
    }
    const allHotWork = Math.max(1, regions.length * 10000);
    summary.relativeWorkBps = Math.round(summary.relativeWorkBps / allHotWork * 10000);
    return {
        schemaVersion: STORY_ACTIVATION_SCHEMA_VERSION,
        policyVersion: STORY_ACTIVATION_POLICY_VERSION,
        disabled: false,
        generatedAt: Number(STORY.clock) || 0,
        tick: storyActivationCurrentTick(),
        topologyHash: policy.topologyHash,
        policy: storyActivationClone(STORY_ACTIVATION_POLICY),
        regions,
        summary,
        diagnostics: storyActivationClone(policy.diagnostics)
    };
}

function storyActivationValidate(snapshot) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
        return { ok: false, issues: [{ code: 'SNAPSHOT_REQUIRED', path: '$', message: 'Aktivasyon görünümü nesne olmalı.' }] };
    }
    if (snapshot.schemaVersion !== STORY_ACTIVATION_SCHEMA_VERSION) add('SCHEMA_VERSION', '$.schemaVersion', 'Aktivasyon şema sürümü uyuşmuyor.');
    if (snapshot.policyVersion !== STORY_ACTIVATION_POLICY_VERSION) add('POLICY_VERSION', '$.policyVersion', 'Aktivasyon politika sürümü uyuşmuyor.');
    if (snapshot.disabled) return { ok: issues.length === 0, issues };
    if (snapshot.topologyHash !== (STORY.regionModel && STORY.regionModel.topologyHash)) {
        add('TOPOLOGY_HASH_MISMATCH', '$.topologyHash', 'Aktivasyon görünümü güncel topolojiye ait değil.');
    }
    if (!Array.isArray(snapshot.regions)) {
        add('REGIONS_ARRAY', '$.regions', 'Aktivasyon bölgeleri dizi olmalı.');
        return { ok: false, issues };
    }
    if (snapshot.regions.length !== (STORY.nodes || []).length) {
        add('REGION_COUNT_MISMATCH', '$.regions', 'Her canlı bölge tam bir aktivasyon kaydı taşımalı.');
    }
    const ids = new Set();
    const counts = { HOT: 0, WARM: 0, COLD: 0 };
    snapshot.regions.forEach((region, index) => {
        const at = `$.regions[${index}]`;
        if (!region || typeof region !== 'object') {
            add('INVALID_REGION', at, 'Aktivasyon bölgesi nesne olmalı.');
            return;
        }
        if (ids.has(region.id)) add('DUPLICATE_REGION_ID', `${at}.id`, `Yinelenen aktivasyon kimliği: ${region.id}`);
        ids.add(region.id);
        if (region.id !== `region:${region.legacyId}` || !STORY.nodes[region.legacyId]) {
            add('REGION_ID_MISMATCH', `${at}.id`, 'Aktivasyon kimliği canlı bölgeye bağlanmalı.');
        }
        if (!STORY_ACTIVATION_LEVELS.includes(region.level)) add('INVALID_LEVEL', `${at}.level`, `Geçersiz aktivasyon seviyesi: ${region.level}`);
        else counts[region.level]++;
        if (!Number.isFinite(Number(region.priority))) add('INVALID_PRIORITY', `${at}.priority`, 'Öncelik sonlu olmalı.');
        if (!Array.isArray(region.reasons) || !region.reasons.length) add('REASONS_REQUIRED', `${at}.reasons`, 'En az bir öncelik nedeni zorunlu.');
        const expectedBudget = STORY_ACTIVATION_POLICY.levels[region.level];
        if (expectedBudget && JSON.stringify(region.budget) !== JSON.stringify(expectedBudget)) {
            add('BUDGET_MISMATCH', `${at}.budget`, 'Bölge bütçesi seviye politikasıyla uyuşmuyor.');
        }
    });
    if (counts.HOT > STORY_ACTIVATION_POLICY.maxHot) add('HOT_BUDGET_EXCEEDED', '$.summary.HOT', 'Sıcak bölge bütçesi aşıldı.');
    if (counts.WARM > STORY_ACTIVATION_POLICY.maxWarm) add('WARM_BUDGET_EXCEEDED', '$.summary.WARM', 'Ilık bölge bütçesi aşıldı.');
    if (!snapshot.summary || STORY_ACTIVATION_LEVELS.some(level => snapshot.summary[level] !== counts[level])) {
        add('SUMMARY_MISMATCH', '$.summary', 'Aktivasyon özeti bölge kayıtlarıyla uyuşmuyor.');
    }
    const commander = snapshot.regions.find(region => region.legacyId === Number(STORY.commander && STORY.commander.node));
    if (commander && commander.level !== 'HOT') add('COMMANDER_NOT_HOT', '$.regions', 'Oyuncu komutanının bölgesi HOT olmalı.');
    return { ok: issues.length === 0, issues };
}

function storyActivationSnapshot() {
    const snapshot = storyActivationBuildSnapshot();
    const validation = storyActivationValidate(snapshot);
    if (!validation.ok && !snapshot.disabled) {
        snapshot.diagnostics = snapshot.diagnostics || {};
        snapshot.diagnostics.issues = validation.issues;
    }
    return snapshot;
}

function storyActivationRegionDue(region, systemId, tick) {
    if (!region) return false;
    const cadence = Math.max(1, region.budget.cadenceTicks | 0);
    if (cadence === 1) return true;
    const currentTick = Number.isInteger(Number(tick)) ? Number(tick) : storyActivationCurrentTick();
    const phase = storyActivationHashText(`${systemId || 'default'}:${region.id}`) % cadence;
    return ((currentTick % cadence) + cadence) % cadence === phase;
}

function storyActivationDue(regionId, systemId, tick) {
    if (!storyActivationEnabled()) return true;
    const snapshot = storyActivationSnapshot();
    const legacyId = typeof regionId === 'string'
        ? Number(String(regionId).replace(/^region:/, ''))
        : Number(regionId);
    const region = snapshot.regions.find(candidate => candidate.legacyId === legacyId);
    return storyActivationRegionDue(region, systemId, tick);
}

function storyActivationBatch(systemId, tick) {
    if (!storyActivationEnabled()) return (STORY.nodes || []).map(node => node.id);
    const snapshot = storyActivationSnapshot();
    const currentTick = tick == null ? snapshot.tick : tick;
    return snapshot.regions
        .filter(region => storyActivationRegionDue(region, systemId, currentTick))
        .map(region => region.legacyId);
}
