// ═══════════════════════════════════════════════════════════════════════════
//  KARAKTER HAKEMİ — Faz 38
//  ---------------------------------------------------------------------------
//  LLM dünya yazarı değildir. Kodun doğruladığı Faz 37 adaylarından birini
//  önerebilir veya pas geçebilir. Yetki, hedef, bedel, cooldown ve fiziksel
//  sonuç yine StoryCharacterActions tarafından doğrulanır ve uygulanır.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_CHARACTER_ARBITER_SCHEMA_VERSION = 2;
const STORY_CHARACTER_ARBITER_ADAPTER_VERSION = 'story-character-arbiter-3';
const STORY_CHARACTER_ARBITER_POLICY_HASH = 'fnv1a32:phase38-grammar-choice-3';
const STORY_CHARACTER_ARBITER_CANDIDATE_CAP = 8;
const STORY_CHARACTER_ARBITER_CACHE_CAP = 32;
const STORY_CHARACTER_ARBITER_MIN_SCORE = 54;
const STORY_CHARACTER_ARBITER_LIVE_SCHEMA_VERSION = 1;

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
ADAYLAR boşsa verdict PASS ve choiceId null olmalıdır.
Yeni eylem, hedef, sayı, bedel, olasılık, bilgi veya dünya sonucu uyduramazsın.
Yalnız tek satırlık geçerli JSON döndür. Açıklama ve markdown yazma.
Kodları AYNEN kullan; kodların yerine doğal dil cümlesi yazma.
choiceId içindeki sayı kalite veya sıra bildirmez; etiketi tahmin etme.
Aktörün hedef, kırmızı çizgi ve ilişkilerini değerlendir. score kodun kanıt gücüdür;
açık bir kırmızı çizgi çelişkisi yoksa daha güçlü kanıtı tercih et.
recentDecisions geçmiş karar kanıtıdır; değişen bağlam yoksa aynı düşük değerli seçimi seri biçimde tekrarlama.
reasonCode: GOAL_ALIGNMENT|RELATIONSHIP_PRESSURE|RECIPROCITY|RED_LINE|INSUFFICIENT_VALUE|DEFER_FOR_INFORMATION
opening: STATE_POSITION_FIRST|RELATIONSHIP_CONTEXT_FIRST
tone: FIRM|MEASURED|WARM|GUARDED
address: FORMAL_TITLE|SURNAME|ROLE_TITLE|NEUTRAL
emphasis: GOAL|RELATIONSHIP|COST|RISK|RED_LINE|RECIPROCITY
Şema: {"schemaVersion":2,"requestId":"...","verdict":"PROPOSE|PASS","choiceId":"SUNULAN_KOD|null","reasonCode":"izinli kod","speechPlan":{"opening":"izinli kod","tone":"izinli kod","address":"izinli kod","emphasis":["izinli kod"]}}`;

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
    const rankedCandidates = ranked.map(storyCharacterArbiterCandidateRow).filter(Boolean)
        .filter(row => Number(row.score) >= STORY_CHARACTER_ARBITER_MIN_SCORE)
        .sort((left, right) => right.score - left.score
            || left.candidateId.localeCompare(right.candidateId, 'en'))
        .slice(0, STORY_CHARACTER_ARBITER_CANDIDATE_CAP);
    const usedChoiceIds = new Set();
    const candidates = rankedCandidates.map((row, index) => {
        const base = `Q${storyCharacterArbiterHash(row.candidateId).slice(-4).toUpperCase()}`;
        const choiceId = usedChoiceIds.has(base) ? `${base}${index + 1}` : base;
        usedChoiceIds.add(choiceId);
        return Object.assign({ choiceId }, row);
    });
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
        recentDecisions: typeof storyCharacterActionArbiterRecentDecisions === 'function'
            ? storyCharacterActionArbiterRecentDecisions(actor.id, 6) : [],
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
        'schemaVersion', 'requestId', 'verdict', 'choiceId', 'reasonCode', 'speechPlan'
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
        const selected = candidates.find(row => row.choiceId === output.choiceId);
        if (!selected) add('CHOICE_NOT_OFFERED', '$.choiceId');
    } else if (output.verdict === 'PASS') {
        if (output.choiceId != null) add('PASS_CHOICE_FORBIDDEN', '$.choiceId');
    }
    return { ok: issues.length === 0, issues, output: issues.length ? null : storyCharacterArbiterClone(output) };
}

function storyCharacterArbiterMaterialize(request, output) {
    const candidates = request && request.context && request.context.candidates || [];
    const selected = output && output.verdict === 'PROPOSE'
        ? candidates.find(row => row.choiceId === output.choiceId) : null;
    return {
        schemaVersion: output.schemaVersion,
        requestId: output.requestId,
        verdict: output.verdict,
        choiceId: output.choiceId,
        candidateId: selected ? selected.candidateId : null,
        actionType: selected ? selected.actionType : null,
        targetActorId: selected ? selected.targetActorId : null,
        reasonCode: output.reasonCode,
        speechPlan: storyCharacterArbiterClone(output.speechPlan)
    };
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
    const rawOutput = {
        schemaVersion: STORY_CHARACTER_ARBITER_SCHEMA_VERSION,
        requestId: request && request.requestId || null,
        verdict: propose ? 'PROPOSE' : 'PASS',
        choiceId: propose ? top.choiceId : null,
        reasonCode: propose ? 'GOAL_ALIGNMENT' : 'INSUFFICIENT_VALUE',
        speechPlan: storyCharacterArbiterSpeechPlan(actor, top, !propose)
    };
    const validation = storyCharacterArbiterValidate(request, rawOutput);
    return {
        ok: true,
        source: 'DETERMINISTIC_FALLBACK',
        rejectedReason: reason || null,
        proposalOnly: true,
        worldMutation: false,
        output: storyCharacterArbiterMaterialize(request, rawOutput),
        validation
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
        output: storyCharacterArbiterMaterialize(request, validation.output),
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
        recentDecisions: request.context.recentDecisions,
        candidates: request.context.candidates.map(row => ({
            choiceId: row.choiceId,
            actionType: row.actionType,
            targetActorId: row.targetActorId,
            targetCountryId: row.targetCountryId,
            targetModel: row.targetModel,
            score: row.score,
            cost: row.cost
        }))
    })}`;
}

function storyCharacterArbiterJsonSchema(request) {
    const choiceIds = (request && request.context && request.context.candidates || [])
        .map(row => row.choiceId).filter(Boolean);
    const speechPlan = {
        type: 'object',
        properties: {
            opening: { enum: STORY_CHARACTER_ARBITER_OPENINGS.slice() },
            tone: { enum: STORY_CHARACTER_ARBITER_TONES.slice() },
            address: { enum: STORY_CHARACTER_ARBITER_ADDRESSES.slice() },
            emphasis: {
                type: 'array',
                items: { enum: STORY_CHARACTER_ARBITER_EMPHASIS.slice() },
                minItems: 1,
                maxItems: 3
            }
        },
        additionalProperties: false
    };
    const branch = (verdict, choiceId, reasonCodes) => ({
        type: 'object',
        properties: {
            schemaVersion: { const: STORY_CHARACTER_ARBITER_SCHEMA_VERSION },
            requestId: { const: request && request.requestId || '' },
            verdict: { const: verdict },
            choiceId,
            reasonCode: { enum: reasonCodes },
            speechPlan
        },
        additionalProperties: false
    });
    const passBranch = branch('PASS', { const: null }, [
        'RED_LINE', 'INSUFFICIENT_VALUE', 'DEFER_FOR_INFORMATION'
    ]);
    if (!choiceIds.length) return { oneOf: [passBranch] };
    return {
        oneOf: [
            branch('PROPOSE', { enum: choiceIds }, STORY_CHARACTER_ARBITER_REASON_CODES.slice()),
            passBranch
        ]
    };
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

function storyCharacterArbiterAskRequest(request) {
    if (!request.ok) return Promise.resolve({ ok: false, reason: request.reason, request });
    const cache = storyCharacterArbiterCache();
    if (cache.entries[request.contextHash]) return Promise.resolve(storyCharacterArbiterClone(cache.entries[request.contextHash]));
    if (typeof llmEnrich !== 'function') return Promise.resolve(
        storyCharacterArbiterCachePut(request, storyCharacterArbiterFallback(request, 'LLM_ADAPTER_UNAVAILABLE'))
    );
    return llmEnrich(STORY_CHARACTER_ARBITER_SYSTEM, storyCharacterArbiterPrompt(request), raw => {
        const validation = storyCharacterArbiterValidate(request, raw);
        return validation.ok ? raw : null;
    }, { jsonSchema: storyCharacterArbiterJsonSchema(request) }).then(output => storyCharacterArbiterCachePut(request,
        output ? storyCharacterArbiterResolve(request, output)
            : storyCharacterArbiterFallback(request, 'LLM_UNAVAILABLE_OR_REJECTED'))
    ).catch(() => storyCharacterArbiterCachePut(request,
        storyCharacterArbiterFallback(request, 'LLM_EXCEPTION')));
}

function storyCharacterArbiterAsk(actorId, options) {
    return storyCharacterArbiterAskRequest(storyCharacterArbiterBuildRequest(actorId, options));
}

// Asenkron model sonucu kanonik dünyaya hiçbir zaman kendi başına yazamaz.
// Buradaki posta kutusu yalnız duvar-saatinde tamamlanan öneriyi tutar; sabit
// hikâye tiki, kayıtlı istek zarfını yeniden üretip eşleştirmeden sonucu alamaz.
function storyCharacterArbiterLiveState() {
    if (typeof STORY === 'undefined') return { generation: 0, entries: {}, testAdapter: null, warmupStarted: false };
    if (!STORY._characterArbiterLive) {
        STORY._characterArbiterLive = { generation: 1, entries: {}, testAdapter: null, warmupStarted: false };
    }
    return STORY._characterArbiterLive;
}

function storyCharacterArbiterLiveReset(options) {
    options = options || {};
    const previous = typeof STORY !== 'undefined' && STORY._characterArbiterLive;
    const testAdapter = options.preserveTestAdapter && previous ? previous.testAdapter : null;
    const generation = Math.max(0, Number(previous && previous.generation) || 0) + 1;
    if (typeof STORY !== 'undefined') {
        STORY._characterArbiterLive = {
            generation, entries: {}, testAdapter: testAdapter || null, warmupStarted: false
        };
    }
    return { generation, cleared: true };
}

function storyCharacterArbiterSetLiveAdapter(adapter) {
    const state = storyCharacterArbiterLiveState();
    state.testAdapter = typeof adapter === 'function' ? adapter : null;
    return !!state.testAdapter;
}

function storyCharacterArbiterLiveAvailable() {
    const state = storyCharacterArbiterLiveState();
    if (typeof state.testAdapter === 'function') return true;
    return storyCharacterArbiterEnabled()
        && typeof llmAvailable === 'function' && llmAvailable();
}

function storyCharacterArbiterLiveWarmup() {
    const state = storyCharacterArbiterLiveState();
    if (typeof state.testAdapter === 'function' || storyCharacterArbiterLiveAvailable()) return true;
    if (state.warmupStarted || !storyCharacterArbiterEnabled()
        || typeof llmBridge !== 'function' || !llmBridge()
        || typeof llmEnsure !== 'function') return false;
    state.warmupStarted = true;
    Promise.resolve(llmEnsure()).catch(() => null);
    return false;
}

function storyCharacterArbiterLiveStore(request, generation, result) {
    const state = storyCharacterArbiterLiveState();
    if (state.generation !== generation) return false;
    const entry = state.entries[request.requestId];
    if (!entry || entry.contextHash !== request.contextHash) return false;
    entry.status = 'SETTLED';
    entry.result = storyCharacterArbiterClone(result);
    return true;
}

function storyCharacterArbiterLiveDispatch(request) {
    if (!request || !request.ok) return { ok: false, reason: 'REQUEST_INVALID' };
    if (!storyCharacterArbiterLiveAvailable()) return { ok: false, reason: 'LIVE_ARBITER_UNAVAILABLE' };
    const state = storyCharacterArbiterLiveState();
    const generation = state.generation;
    state.entries[request.requestId] = {
        schemaVersion: STORY_CHARACTER_ARBITER_LIVE_SCHEMA_VERSION,
        requestId: request.requestId,
        contextHash: request.contextHash,
        status: 'PENDING',
        result: null
    };
    let run;
    try {
        run = typeof state.testAdapter === 'function'
            ? state.testAdapter(storyCharacterArbiterClone(request))
            : storyCharacterArbiterAskRequest(request);
    } catch (_) {
        run = storyCharacterArbiterFallback(request, 'LIVE_DISPATCH_EXCEPTION');
    }
    if (run && typeof run.then === 'function') {
        run.then(result => storyCharacterArbiterLiveStore(request, generation, result))
            .catch(() => storyCharacterArbiterLiveStore(request, generation,
                storyCharacterArbiterFallback(request, 'LIVE_PROMISE_EXCEPTION')));
    } else {
        storyCharacterArbiterLiveStore(request, generation,
            run || storyCharacterArbiterFallback(request, 'LIVE_EMPTY_RESULT'));
    }
    return { ok: true, requestId: request.requestId, contextHash: request.contextHash };
}

function storyCharacterArbiterLiveTake(requestId, contextHash) {
    const state = storyCharacterArbiterLiveState();
    const entry = state.entries[String(requestId || '')];
    if (!entry) return { status: 'MISSING', result: null };
    if (entry.contextHash !== contextHash) return { status: 'CONTEXT_MISMATCH', result: null };
    if (entry.status !== 'SETTLED') return { status: 'PENDING', result: null };
    delete state.entries[entry.requestId];
    return { status: 'SETTLED', result: storyCharacterArbiterClone(entry.result) };
}

function storyCharacterArbiterLiveDiscard(requestId) {
    const state = storyCharacterArbiterLiveState();
    const key = String(requestId || '');
    const existed = !!state.entries[key];
    delete state.entries[key];
    return existed;
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
        cacheCap: STORY_CHARACTER_ARBITER_CACHE_CAP,
        liveAvailable: storyCharacterArbiterLiveAvailable(),
        liveWarmupStarted: !!storyCharacterArbiterLiveState().warmupStarted,
        livePending: Object.values(storyCharacterArbiterLiveState().entries)
            .filter(row => row.status === 'PENDING').length
    };
}
