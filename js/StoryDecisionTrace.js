// ═══════════════════════════════════════════════════════════════════════════
//  ALGILANAN DÜNYA VE KARAR İZİ V2 — Faz 38.6
//  ---------------------------------------------------------------------------
//  Bu katman WorldFact içeriğini okumaz. Bir karakterin karar bağlamına yalnız
//  o karakter adına tutulmuş ActorBelief referansları girebilir. Aday, yetki,
//  bedel ve ilişki kanıtı mevcut kanonik defterlerden salt okunur alınır.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_DECISION_CONTEXT_SCHEMA_VERSION = 2;
const STORY_DECISION_TRACE_SCHEMA_VERSION = 2;
const STORY_DECISION_TRACE_ADAPTER_VERSION = 'story-decision-trace-2';
const STORY_DECISION_CONTEXT_CAP = 512;
const STORY_DECISION_TRACE_CAP = 512;

function storyDecisionTraceEnabled() {
    return typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('characters.decisionTraceV2');
}

function storyDecisionTraceClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyDecisionTraceHash(value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function storyDecisionTraceImportance(actionType) {
    const type = String(actionType || '').toUpperCase();
    if (['SABOTAGE', 'ORDER', 'RESIGN'].includes(type)) return 'WORLD';
    if (['BETRAY', 'ALLY', 'NEGOTIATE'].includes(type)) return 'MAJOR';
    return 'ROUTINE';
}

function storyDecisionTraceActorBeliefs(actorId, targetActorIds) {
    const identityLedger = typeof storyCharacterIdentityEnsure === 'function'
        ? storyCharacterIdentityEnsure() : null;
    const targets = new Set((targetActorIds || []).filter(Boolean).map(String));
    return Object.values(identityLedger && identityLedger.actorBeliefs || {})
        .filter(row => row && row.holderActorId === String(actorId || ''))
        .filter(row => !targets.size || !row.subjectActorId
            || row.subjectActorId === String(actorId || '') || targets.has(String(row.subjectActorId)))
        .sort((left, right) => Number(right.confidenceBps) - Number(left.confidenceBps)
            || String(left.id).localeCompare(String(right.id), 'en'))
        .slice(0, 12)
        .map(row => ({
            beliefId: String(row.id),
            worldFactId: String(row.worldFactId),
            subjectActorId: row.subjectActorId == null ? null : String(row.subjectActorId),
            beliefStatus: String(row.beliefStatus || 'REPORTED'),
            confidenceBps: Math.max(0, Math.min(10000, Math.round(Number(row.confidenceBps) || 0))),
            sourceType: String(row.source && row.source.type || 'UNKNOWN_SOURCE'),
            learnedAt: Number(row.learnedAt) || 0
        }));
}

function storyDecisionTraceCandidate(row) {
    const candidate = row && row.candidate || row;
    if (!candidate || !candidate.id || !candidate.actionType) return null;
    const cost = candidate.cost || {};
    const authority = candidate.authority || {};
    const targetValidation = candidate.targetValidation || {};
    const domainValidation = candidate.domainValidation || {};
    const availableAt = Number(candidate.availableAt) || 0;
    const generatedAt = Number(candidate.generatedAt) || 0;
    const gate = (gateId, passed, reason, evidenceType) => ({
        gateId,
        passed: passed === true,
        reason: reason == null ? null : String(reason),
        evidenceType
    });
    return {
        candidateId: String(candidate.id),
        actionType: String(candidate.actionType),
        targetActorId: candidate.targetActorId == null ? null : String(candidate.targetActorId),
        targetModel: String(candidate.targetModel || 'CHARACTER'),
        allowed: candidate.allowed !== false,
        score: Math.round((Number(row && row.score == null ? candidate.selectorScore : row.score) || 0) * 1000) / 1000,
        authority: {
            model: authority.model == null ? null : String(authority.model),
            allowed: authority.ok === true,
            reason: authority.reason == null ? null : String(authority.reason)
        },
        cost: {
            ledger: cost.ledger == null ? null : String(cost.ledger),
            key: cost.key == null ? null : String(cost.key),
            amount: Number(cost.amount) || 0,
            available: Number.isFinite(Number(cost.available)) ? Number(cost.available) : null,
            affordable: cost.ok === true
        },
        filterEvidence: [
            gate('TARGET', targetValidation.ok, targetValidation.reason, 'TARGET_VALIDATION'),
            gate('AUTHORITY', authority.ok, authority.reason, 'AUTHORITY_GRANT'),
            gate('DOMAIN', domainValidation.ok, domainValidation.reason, 'DOMAIN_ADAPTER'),
            gate('COST', cost.ok, cost.reason, 'RESOURCE_LEDGER'),
            gate('COOLDOWN', availableAt <= generatedAt + 1e-9,
                availableAt <= generatedAt + 1e-9 ? null : 'ACTION_ON_COOLDOWN', 'ACTION_LEDGER'),
            gate('EXECUTOR', candidate.handlerAvailable === true,
                candidate.handlerAvailable === true ? null : 'DOMAIN_EXECUTOR_NOT_AVAILABLE', 'DOMAIN_EXECUTOR')
        ],
        filterReasons: (candidate.reasons || []).map(String).slice(0, 12),
        scoreReasons: (row && row.reasons || candidate.selectorReasons || []).map(String).slice(0, 16)
    };
}

function storyDecisionContextV2Build(actorId, ranked) {
    if (!storyDecisionTraceEnabled()) return null;
    const actor = typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(String(actorId || '')) : null;
    if (!actor) return null;
    const candidates = (ranked || []).map(storyDecisionTraceCandidate).filter(Boolean)
        .sort((left, right) => right.score - left.score
            || left.candidateId.localeCompare(right.candidateId, 'en'));
    const targetIds = Array.from(new Set(candidates.map(row => row.targetActorId).filter(Boolean))).sort();
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
    const contextCore = {
        schemaVersion: STORY_DECISION_CONTEXT_SCHEMA_VERSION,
        adapterVersion: STORY_DECISION_TRACE_ADAPTER_VERSION,
        actorId: actor.id,
        generatedAt: typeof STORY !== 'undefined' ? Number(STORY.clock) || 0 : 0,
        trigger: {
            type: 'AUTONOMOUS_REVIEW',
            source: 'CHARACTER_ACTION_AI_TICK',
            reasonCodes: candidates.slice(0, 3)
                .flatMap(row => row.scoreReasons.slice(0, 2)).filter(Boolean).slice(0, 6)
        },
        actorBeliefs: storyDecisionTraceActorBeliefs(actor.id, targetIds),
        activeGoals: (actor.goals || []).filter(row => row && row.status === 'ACTIVE')
            .map(row => ({ objective: String(row.objective), priorityBps: Number(row.priorityBps) || 0 }))
            .sort((left, right) => right.priorityBps - left.priorityBps
                || left.objective.localeCompare(right.objective, 'en')).slice(0, 8),
        relationships,
        candidates,
        candidateIds: candidates.map(row => row.candidateId),
        rawWorldFactRead: false
    };
    const contextHash = storyDecisionTraceHash(contextCore);
    return Object.assign({ id: `decision-context:${contextHash.slice(8)}`, contextHash }, contextCore);
}

function storyDecisionTraceV2Build(decisionId, context, input) {
    if (!context || context.schemaVersion !== STORY_DECISION_CONTEXT_SCHEMA_VERSION) return null;
    input = input || {};
    const verdict = String(input.verdict || 'PASS');
    const candidateId = input.candidateId == null ? null : String(input.candidateId);
    const selected = candidateId
        ? context.candidates.find(row => row.candidateId === candidateId) : null;
    if (verdict === 'PROPOSE' && (!selected || selected.allowed !== true)) return null;
    if (verdict === 'PASS' && candidateId != null) return null;
    const importance = storyDecisionTraceImportance(selected && selected.actionType || input.actionType);
    const traceCore = {
        schemaVersion: STORY_DECISION_TRACE_SCHEMA_VERSION,
        adapterVersion: STORY_DECISION_TRACE_ADAPTER_VERSION,
        decisionId: String(decisionId),
        contextId: context.id,
        contextHash: context.contextHash,
        actorId: context.actorId,
        verdict,
        selectedCandidateId: selected ? selected.candidateId : null,
        actionType: selected ? selected.actionType : null,
        targetActorId: selected ? selected.targetActorId : null,
        importance,
        supportingReasons: selected ? selected.scoreReasons.slice(0, 8) : [],
        opposingReasons: selected ? selected.filterReasons.slice(0, 8) : ['NO_CANDIDATE_SELECTED'],
        goalContributions: context.activeGoals.slice(0, 4),
        relationshipContribution: selected
            ? context.relationships.find(row => row.targetActorId === selected.targetActorId) || null : null,
        beliefEvidenceIds: context.actorBeliefs.map(row => row.beliefId),
        authority: selected ? storyDecisionTraceClone(selected.authority) : null,
        cost: selected ? storyDecisionTraceClone(selected.cost) : null,
        filterEvidence: selected ? storyDecisionTraceClone(selected.filterEvidence) : [],
        reasonCode: input.reasonCode == null ? null : String(input.reasonCode),
        source: String(input.source || 'DETERMINISTIC_FALLBACK'),
        rawWorldFactRead: false
    };
    const traceHash = storyDecisionTraceHash(traceCore);
    return Object.assign({ id: `decision-trace:${traceHash.slice(8)}`, traceHash }, traceCore);
}

function storyDecisionTraceV2PlayerView(traceId, viewerActorId) {
    const ledger = typeof storyCharacterActionEnsure === 'function'
        ? storyCharacterActionEnsure() : null;
    const trace = ledger && ledger.decisionTraces && ledger.decisionTraces[String(traceId || '')];
    const context = trace && ledger.decisionContexts && ledger.decisionContexts[trace.contextId];
    if (!trace || !context) return null;
    const viewerId = String(viewerActorId || '');
    const identityLedger = typeof storyCharacterIdentityEnsure === 'function'
        ? storyCharacterIdentityEnsure() : null;
    const viewerFacts = new Set(Object.values(identityLedger && identityLedger.actorBeliefs || {})
        .filter(row => row && row.holderActorId === viewerId).map(row => String(row.worldFactId)));
    const visibleBeliefs = context.actorBeliefs.filter(row => trace.actorId === viewerId
        || viewerFacts.has(String(row.worldFactId)));
    const ownsDecision = trace.actorId === viewerId;
    return {
        id: trace.id,
        decisionId: trace.decisionId,
        actorId: trace.actorId,
        verdict: trace.verdict,
        actionType: trace.actionType,
        targetActorId: trace.targetActorId,
        importance: trace.importance,
        supportingReasons: ownsDecision ? trace.supportingReasons.slice() : [],
        opposingReasons: ownsDecision ? trace.opposingReasons.slice() : [],
        authority: ownsDecision ? storyDecisionTraceClone(trace.authority) : null,
        cost: ownsDecision ? storyDecisionTraceClone(trace.cost) : null,
        visibleBeliefEvidence: visibleBeliefs.map(row => ({
            beliefId: row.beliefId,
            beliefStatus: row.beliefStatus,
            confidenceBps: row.confidenceBps,
            sourceType: row.sourceType
        })),
        hiddenBeliefEvidenceCount: Math.max(0, context.actorBeliefs.length - visibleBeliefs.length),
        privateReasonCount: ownsDecision ? 0
            : trace.supportingReasons.length + trace.opposingReasons.length,
        rawWorldFactRead: false
    };
}

function storyDecisionTraceV2Validate(contexts, traces) {
    const issues = [];
    const add = (code, path) => issues.push({ code, path });
    for (const [id, context] of Object.entries(contexts || {})) {
        const at = `$.decisionContexts.${id}`;
        if (!context || context.id !== id) add('DECISION_CONTEXT_ID', `${at}.id`);
        if (!context || context.schemaVersion !== STORY_DECISION_CONTEXT_SCHEMA_VERSION) add('DECISION_CONTEXT_SCHEMA', at);
        if (!context || context.rawWorldFactRead !== false) add('RAW_WORLD_FACT_READ', `${at}.rawWorldFactRead`);
        if (!Array.isArray(context && context.candidateIds) || !Array.isArray(context && context.candidates)) add('DECISION_CONTEXT_CANDIDATES', at);
        if (!context || !context.trigger || context.trigger.type !== 'AUTONOMOUS_REVIEW'
            || context.trigger.source !== 'CHARACTER_ACTION_AI_TICK') add('DECISION_CONTEXT_TRIGGER', `${at}.trigger`);
        for (let index = 0; index < (context && context.candidates || []).length; index++) {
            const candidate = context.candidates[index];
            const gateIds = (candidate.filterEvidence || []).map(row => row.gateId);
            if (!['TARGET', 'AUTHORITY', 'DOMAIN', 'COST', 'COOLDOWN', 'EXECUTOR']
                .every(gateId => gateIds.includes(gateId))) {
                add('DECISION_FILTER_EVIDENCE', `${at}.candidates[${index}].filterEvidence`);
            }
        }
        if (context && context.contextHash !== storyDecisionTraceHash(Object.assign({}, context, {
            id: undefined, contextHash: undefined
        }))) add('DECISION_CONTEXT_HASH', `${at}.contextHash`);
    }
    for (const [id, trace] of Object.entries(traces || {})) {
        const at = `$.decisionTraces.${id}`;
        const context = trace && contexts && contexts[trace.contextId];
        if (!trace || trace.id !== id) add('DECISION_TRACE_ID', `${at}.id`);
        if (!trace || trace.schemaVersion !== STORY_DECISION_TRACE_SCHEMA_VERSION) add('DECISION_TRACE_SCHEMA', at);
        if (!context) add('DECISION_TRACE_CONTEXT', `${at}.contextId`);
        if (trace && trace.rawWorldFactRead !== false) add('RAW_WORLD_FACT_READ', `${at}.rawWorldFactRead`);
        if (trace && trace.verdict === 'PROPOSE'
            && (!trace.selectedCandidateId || !context
                || !context.candidateIds.includes(trace.selectedCandidateId))) {
            add('SELECTED_CANDIDATE_NOT_OFFERED', `${at}.selectedCandidateId`);
        }
        if (trace && ['MAJOR', 'WORLD'].includes(trace.importance)
            && (!trace.contextId || !trace.contextHash)) add('MAJOR_TRACE_REQUIRED', at);
    }
    return { ok: issues.length === 0, issues };
}
