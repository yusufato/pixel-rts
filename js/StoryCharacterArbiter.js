// ═══════════════════════════════════════════════════════════════════════════
//  KARAKTER HAKEMİ — Faz 38
//  ---------------------------------------------------------------------------
//  LLM dünya yazarı değildir. Kodun doğruladığı Faz 37 adaylarından birini
//  önerebilir veya pas geçebilir. Yetki, hedef, bedel, cooldown ve fiziksel
//  sonuç yine StoryCharacterActions tarafından doğrulanır ve uygulanır.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_CHARACTER_ARBITER_SCHEMA_VERSION = 1;
const STORY_CHARACTER_ARBITER_ADAPTER_VERSION = 'story-character-arbiter-1';
const STORY_CHARACTER_ARBITER_POLICY_HASH = 'fnv1a32:phase38-closed-choice-1';
const STORY_CHARACTER_ARBITER_CANDIDATE_CAP = 8;
const STORY_CHARACTER_ARBITER_CACHE_CAP = 32;
const STORY_CHARACTER_ARBITER_MIN_SCORE = 54;

const STORY_CHARACTER_ARBITER_VERDICTS = Object.freeze(['PROPOSE', 'PASS']);
const STORY_CHARACTER_ARBITER_REASON_CODES = Object.freeze([
    'GOAL_ALIGNMENT', 'RELATIONSHIP_PRESSURE', 'RECIPROCITY', 'RED_LINE',
    'INSUFFICIENT_VALUE', 'DEFER_FOR_INFORMATION'
]);
const STORY_CHARACTER_ARBITER_OPENINGS = Object.freeze([
    'STATE_POSITION_FIRST', 'RELATIONSHIP_CONTEXT_FIRST'
]);
const STORY_CHARACTER_ARBITER_TONES = Object.freeze(['FIRM', 'MEASURED', 'WARM', 'GUARDED']);
const STORY_CHARACTER_ARBITER_ADDRESSES = Object.freeze([
    'FORMAL_TITLE', 'SURNAME', 'ROLE_TITLE', 'NEUTRAL'
]);
const STORY_CHARACTER_ARBITER_EMPHASIS = Object.freeze([
    'GOAL', 'RELATIONSHIP', 'COST', 'RISK', 'RED_LINE', 'RECIPROCITY'
]);

const STORY_CHARACTER_ARBITER_SYSTEM = `Sen Pixel RTS karakter karar hakemisin.
Yalnız verilen ADAYLAR arasından seçim yapabilir veya PASS diyebilirsin.
Yeni eylem, hedef, sayı, bedel, olasılık, bilgi veya dünya sonucu uyduramazsın.
Yalnız tek satırlık geçerli JSON döndür. Açıklama ve markdown yazma.
Şema: {"schemaVersion":1,"requestId":"...","verdict":"PROPOSE|PASS","candidateId":"...|null","actionType":"...|null","targetActorId":"...|null","reasonCode":"izinli kod","speechPlan":{"opening":"izinli kod","tone":"izinli kod","address":"izinli kod","emphasis":["izinli kod"]}}`;

function storyCharacterArbiterClone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
}

function storyCharacterArbiterEnabled() {
    return typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('characters.llmArbiter');
}

function storyCharacterArbiterHash(value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function storyCharacterArbiterSafeIdentity(actor) {
    if (!actor) return null;
    return {
        id: actor.id,
        name: actor.name,
        role: actor.role,
        publicTitle: actor.publicTitle || null,
        countryId: actor.countryId,
        coreAxes: storyCharacterArbiterClone(actor.coreAxes || {}),
        values: storyCharacterArbiterClone(actor.values || {}),
        fears: (actor.fears || []).map(String).slice(0, 4),
        ambitions: (actor.ambitions || []).map(String).slice(0, 4),
        redLines: (actor.redLines || []).map(String).slice(0, 4),
        goals: (actor.goals || []).filter(row => row && row.status === 'ACTIVE').map(row => ({
            objective: String(row.objective), priorityBps: Number(row.priorityBps) || 0
        })).slice(0, 4),
        voiceProfile: storyCharacterArbiterClone(actor.voiceProfile || {})
    };
}

function storyCharacterArbiterMemory(actorId) {
    const world = typeof storyMemoryWorldView === 'function' ? storyMemoryWorldView() : null;
    return (world && world.recentByActor && world.recentByActor[actorId] || [])
        .slice(0, 6)
        .map(row => ({
            kind: String(row && row.kind || row && row.type || 'MEMORY'),
            topicKey: String(row && row.topicKey || ''),
            summary: String(row && row.summary || row && row.description || '').slice(0, 180),
            at: Number(row && (row.at == null ? row.createdAt : row.at)) || 0
        }));
}

function storyCharacterArbiterCandidateRow(row) {
    const candidate = row && row.candidate || row;
    if (!candidate || !candidate.allowed || !candidate.id || !candidate.actionType) return null;
    return {
        candidateId: String(candidate.id),
        actionType: String(candidate.actionType),
        targetActorId: candidate.targetActorId == null ? null : String(candidate.targetActorId),
        targetCountryId: candidate.targetCountryId == null ? null : String(candidate.targetCountryId),
        targetModel: String(candidate.targetModel || 'CHARACTER'),
        score: Math.round((Number(row && row.score == null ? candidate.selectorScore : row.score) || 0) * 1000) / 1000,
        cost: candidate.cost ? {
            ledger: String(candidate.cost.ledger || ''),
            key: candidate.cost.key == null ? null : String(candidate.cost.key),
            amount: Number(candidate.cost.amount) || 0
        } : null,
        reasons: (row && row.reasons || candidate.selectorReasons || []).map(String).slice(0, 10)
    };
}

function storyCharacterArbiterBuildRequest(actorId, options) {
    options = options || {};
    const actor = typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(String(actorId || '')) : null;
    if (!storyCharacterArbiterEnabled()) return { ok: false, reason: 'ARBITER_DISABLED' };
    if (!actor) return { ok: false, reason: 'ACTOR_NOT_FOUND' };
    const ranked = Array.isArray(options.ranked)
        ? options.ranked
        : (typeof storyCharacterActionAIRankActor === 'function'
            ? storyCharacterActionAIRankActor(actor.id) : []);
    const candidates = ranked.map(storyCharacterArbiterCandidateRow).filter(Boolean)
        .sort((left, right) => right.score - left.score
            || left.candidateId.localeCompare(right.candidateId, 'en'))
        .slice(0, STORY_CHARACTER_ARBITER_CANDIDATE_CAP);
    const targetIds = Array.from(new Set(candidates.map(row => row.targetActorId).filter(Boolean))).sort();
    const targets = targetIds.map(targetId => storyCharacterArbiterSafeIdentity(
        typeof storyCharacterIdentityView === 'function' ? storyCharacterIdentityView(targetId) : null
    )).filter(Boolean).map(row => ({
        id: row.id, name: row.name, role: row.role, publicTitle: row.publicTitle,
        countryId: row.countryId
    }));
    const relationships = targetIds.map(targetActorId => {
        const edge = typeof storyRelationshipView === 'function'
            ? storyRelationshipView(actor.id, targetActorId) : null;
        return {
            targetActorId,
            trustBps: Number(edge && edge.trustBps) || 0,
            fearBps: Number(edge && edge.fearBps) || 0,
            respectBps: Number(edge && edge.respectBps) || 0,
            debtBps: Number(edge && edge.debtBps) || 0,
            hostilityBps: Number(edge && edge.hostilityBps) || 0
        };
    });
    const context = {
        schemaVersion: STORY_CHARACTER_ARBITER_SCHEMA_VERSION,
        adapterVersion: STORY_CHARACTER_ARBITER_ADAPTER_VERSION,
        policyHash: STORY_CHARACTER_ARBITER_POLICY_HASH,
        actor: storyCharacterArbiterSafeIdentity(actor),
        targets,
        relationships,
        recentMemory: storyCharacterArbiterMemory(actor.id),
        candidates
    };
    const contextHash = storyCharacterArbiterHash(context);
    return {
        ok: true,
        schemaVersion: STORY_CHARACTER_ARBITER_SCHEMA_VERSION,
        adapterVersion: STORY_CHARACTER_ARBITER_ADAPTER_VERSION,
        policyHash: STORY_CHARACTER_ARBITER_POLICY_HASH,
        requestId: `character-arbiter:${storyCharacterArbiterHash(`${actor.id}|${contextHash}`).slice(8)}`,
        generatedAt: typeof STORY !== 'undefined' ? Number(STORY.clock) || 0 : 0,
        contextHash,
        proposalOnly: true,
        worldMutation: false,
        context
    };
}

function storyCharacterArbiterParse(raw) {
    if (raw && typeof raw === 'object') return storyCharacterArbiterClone(raw);
    const text = String(raw == null ? '' : raw).trim();
    if (!text || text.length > 4096) return null;
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
        return JSON.parse(text.slice(start, end + 1));
    } catch (_) {
        return null;
    }
}

function storyCharacterArbiterValidate(request, raw) {
    const output = storyCharacterArbiterParse(raw);
    const issues = [];
    const add = (code, path) => issues.push({ code, path });
    if (!request || !request.ok) add('REQUEST_INVALID', '$request');
    if (!output || typeof output !== 'object' || Array.isArray(output)) {
        add('OUTPUT_NOT_OBJECT', '$');
        return { ok: false, issues, output: null };
    }
    const allowedTop = new Set([
        'schemaVersion', 'requestId', 'verdict', 'candidateId', 'actionType',
        'targetActorId', 'reasonCode', 'speechPlan'
    ]);
    for (const key of Object.keys(output)) if (!allowedTop.has(key)) add('UNKNOWN_FIELD', `$.${key}`);
    if (output.schemaVersion !== STORY_CHARACTER_ARBITER_SCHEMA_VERSION) add('SCHEMA_VERSION', '$.schemaVersion');
    if (output.requestId !== request.requestId) add('REQUEST_ID', '$.requestId');
    if (!STORY_CHARACTER_ARBITER_VERDICTS.includes(output.verdict)) add('VERDICT', '$.verdict');
    if (!STORY_CHARACTER_ARBITER_REASON_CODES.includes(output.reasonCode)) add('REASON_CODE', '$.reasonCode');
    const plan = output.speechPlan;
    if (!plan || typeof plan !== 'object' || Array.isArray(plan)) add('SPEECH_PLAN', '$.speechPlan');
    else {
        const allowedPlan = new Set(['opening', 'tone', 'address', 'emphasis']);
        for (const key of Object.keys(plan)) if (!allowedPlan.has(key)) add('UNKNOWN_FIELD', `$.speechPlan.${key}`);
        if (!STORY_CHARACTER_ARBITER_OPENINGS.includes(plan.opening)) add('OPENING', '$.speechPlan.opening');
        if (!STORY_CHARACTER_ARBITER_TONES.includes(plan.tone)) add('TONE', '$.speechPlan.tone');
        if (!STORY_CHARACTER_ARBITER_ADDRESSES.includes(plan.address)) add('ADDRESS', '$.speechPlan.address');
        if (!Array.isArray(plan.emphasis) || !plan.emphasis.length || plan.emphasis.length > 3
            || plan.emphasis.some(value => !STORY_CHARACTER_ARBITER_EMPHASIS.includes(value))
            || new Set(plan.emphasis).size !== plan.emphasis.length) add('EMPHASIS', '$.speechPlan.emphasis');
    }
    const candidates = request && request.context && request.context.candidates || [];
    if (output.verdict === 'PROPOSE') {
        const selected = candidates.find(row => row.candidateId === output.candidateId);
        if (!selected) add('CANDIDATE_NOT_OFFERED', '$.candidateId');
        else {
            if (output.actionType !== selected.actionType) add('ACTION_MISMATCH', '$.actionType');
            if ((output.targetActorId || null) !== (selected.targetActorId || null)) add('TARGET_MISMATCH', '$.targetActorId');
        }
    } else if (output.verdict === 'PASS') {
        if (output.candidateId != null) add('PASS_CANDIDATE_FORBIDDEN', '$.candidateId');
        if (output.actionType != null) add('PASS_ACTION_FORBIDDEN', '$.actionType');
        if (output.targetActorId != null) add('PASS_TARGET_FORBIDDEN', '$.targetActorId');
    }
    return { ok: issues.length === 0, issues, output: issues.length ? null : storyCharacterArbiterClone(output) };
}

function storyCharacterArbiterSpeechPlan(actor, candidate, pass) {
    const voice = actor && actor.voiceProfile || {};
    const opening = STORY_CHARACTER_ARBITER_OPENINGS.includes(voice.opening)
        ? voice.opening
        : (Number(voice.directnessBps) >= 6000 ? 'STATE_POSITION_FIRST' : 'RELATIONSHIP_CONTEXT_FIRST');
    const tone = pass ? 'GUARDED'
        : Number(voice.warmthBps) >= 6200 ? 'WARM'
            : Number(voice.directnessBps) >= 6200 ? 'FIRM' : 'MEASURED';
    const actionEmphasis = {
        PERSUADE: ['GOAL', 'RELATIONSHIP'], NEGOTIATE: ['RECIPROCITY', 'COST'],
        ALLY: ['RELATIONSHIP', 'RECIPROCITY'], BETRAY: ['RED_LINE', 'RISK'],
        ORDER: ['GOAL', 'RISK'], SABOTAGE: ['RISK', 'GOAL'], RESIGN: ['RED_LINE', 'COST']
    };
    return {
        opening,
        tone,
        address: Number(voice.formalityBps) >= 6000 ? 'FORMAL_TITLE' : 'ROLE_TITLE',
        emphasis: pass ? ['RISK'] : (actionEmphasis[candidate && candidate.actionType] || ['GOAL'])
    };
}

function storyCharacterArbiterFallback(request, reason) {
    const actor = request && request.context && request.context.actor;
    const top = request && request.context && request.context.candidates && request.context.candidates[0];
    const propose = !!(top && Number(top.score) >= STORY_CHARACTER_ARBITER_MIN_SCORE);
    const output = {
        schemaVersion: STORY_CHARACTER_ARBITER_SCHEMA_VERSION,
        requestId: request && request.requestId || null,
        verdict: propose ? 'PROPOSE' : 'PASS',
        candidateId: propose ? top.candidateId : null,
        actionType: propose ? top.actionType : null,
        targetActorId: propose ? top.targetActorId : null,
        reasonCode: propose ? 'GOAL_ALIGNMENT' : 'INSUFFICIENT_VALUE',
        speechPlan: storyCharacterArbiterSpeechPlan(actor, top, !propose)
    };
    return {
        ok: true,
        source: 'DETERMINISTIC_FALLBACK',
        rejectedReason: reason || null,
        proposalOnly: true,
        worldMutation: false,
        output,
        validation: storyCharacterArbiterValidate(request, output)
    };
}

function storyCharacterArbiterResolve(request, raw) {
    const validation = storyCharacterArbiterValidate(request, raw);
    if (!validation.ok) return storyCharacterArbiterFallback(request,
        validation.issues[0] && validation.issues[0].code || 'LLM_OUTPUT_REJECTED');
    return {
        ok: true,
        source: 'LOCAL_LLM_VALIDATED',
        rejectedReason: null,
        proposalOnly: true,
        worldMutation: false,
        output: validation.output,
        validation
    };
}

function storyCharacterArbiterPrompt(request) {
    return `İSTEK:\n${JSON.stringify({
        schemaVersion: request.schemaVersion,
        requestId: request.requestId,
        contextHash: request.contextHash,
        actor: request.context.actor,
        targets: request.context.targets,
        relationships: request.context.relationships,
        recentMemory: request.context.recentMemory,
        candidates: request.context.candidates
    })}`;
}

function storyCharacterArbiterCache() {
    if (typeof STORY === 'undefined') return { order: [], entries: {} };
    if (!STORY._characterArbiterCache) STORY._characterArbiterCache = { order: [], entries: {} };
    return STORY._characterArbiterCache;
}

function storyCharacterArbiterCachePut(request, result) {
    const cache = storyCharacterArbiterCache();
    const key = request.contextHash;
    cache.entries[key] = storyCharacterArbiterClone(result);
    cache.order = cache.order.filter(value => value !== key);
    cache.order.push(key);
    while (cache.order.length > STORY_CHARACTER_ARBITER_CACHE_CAP) {
        const removed = cache.order.shift();
        delete cache.entries[removed];
    }
    return storyCharacterArbiterClone(cache.entries[key]);
}

function storyCharacterArbiterAsk(actorId, options) {
    const request = storyCharacterArbiterBuildRequest(actorId, options);
    if (!request.ok) return Promise.resolve({ ok: false, reason: request.reason, request });
    const cache = storyCharacterArbiterCache();
    if (cache.entries[request.contextHash]) return Promise.resolve(storyCharacterArbiterClone(cache.entries[request.contextHash]));
    if (typeof llmEnrich !== 'function') return Promise.resolve(
        storyCharacterArbiterCachePut(request, storyCharacterArbiterFallback(request, 'LLM_ADAPTER_UNAVAILABLE'))
    );
    return llmEnrich(STORY_CHARACTER_ARBITER_SYSTEM, storyCharacterArbiterPrompt(request), raw => {
        const validation = storyCharacterArbiterValidate(request, raw);
        return validation.ok ? validation.output : null;
    }).then(output => storyCharacterArbiterCachePut(request,
        output ? storyCharacterArbiterResolve(request, output)
            : storyCharacterArbiterFallback(request, 'LLM_UNAVAILABLE_OR_REJECTED'))
    ).catch(() => storyCharacterArbiterCachePut(request,
        storyCharacterArbiterFallback(request, 'LLM_EXCEPTION')));
}

function storyCharacterArbiterDiagnostics() {
    const cache = storyCharacterArbiterCache();
    return {
        schemaVersion: STORY_CHARACTER_ARBITER_SCHEMA_VERSION,
        adapterVersion: STORY_CHARACTER_ARBITER_ADAPTER_VERSION,
        policyHash: STORY_CHARACTER_ARBITER_POLICY_HASH,
        enabled: storyCharacterArbiterEnabled(),
        proposalOnly: true,
        worldMutation: false,
        cacheSize: cache.order.length,
        cacheCap: STORY_CHARACTER_ARBITER_CACHE_CAP
    };
}
