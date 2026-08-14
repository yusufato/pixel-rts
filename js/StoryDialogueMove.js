// ============================================================================
//  DIALOGUE MOVE V1 — sohbet karar sözleşmesi
//  ---------------------------------------------------------------------------
//  LLM bir karakterin neye cevap vereceğini, hangi iddiayı gerçek sayacağını
//  veya hangi dünya eylemini vaat edeceğini seçmez. Bu salt-okunur sözleşme
//  önce kurulur; doğal dil katmanı yalnız bu kararın metnini gerçekleştirebilir.
// ============================================================================

const STORY_DIALOGUE_MOVE_SCHEMA_VERSION = 1;
const STORY_DIALOGUE_MOVE_ADAPTER_VERSION = 'story-dialogue-move-1';
const STORY_DIALOGUE_MOVE_STANCES = Object.freeze([
    'OPEN', 'WARM', 'NEUTRAL', 'GUARDED', 'SKEPTICAL', 'BOUNDARY', 'REPAIR'
]);
const STORY_DIALOGUE_MOVE_FORBIDDEN_COMMITMENTS = Object.freeze([
    'WORLD_MUTATION', 'ACCEPT_AGREEMENT', 'CREATE_COMPANY', 'TRANSFER_FUNDS',
    'MOVE_ARMY', 'DECLARE_WAR', 'REVEAL_HIDDEN_INFORMATION'
]);
const STORY_DIALOGUE_MOVE_BASE_ACTS = Object.freeze([
    'ASK_INFORMATION', 'PROPOSE_COMMERCIAL_DEAL', 'THREATEN', 'MAKE_PROMISE',
    'SHARE_SECRET', 'BLUFF_CANDIDATE', 'ACCUSE', 'REQUEST_ACTION',
    'OFFER_SUPPORT', 'COUNTER_OFFER', 'REJECT', 'GREETING', 'CHECK_IN',
    'THANK', 'APOLOGIZE', 'FAREWELL', 'ASK_PERSONAL_OPINION', 'SMALL_TALK',
    'REQUEST_SUPPORT', 'ASK_RELATIONSHIP', 'REPORT_MILITARY',
    'REPORT_ECONOMIC', 'CORRECT_STATEMENT', 'CHALLENGE', 'UNKNOWN'
]);
const STORY_DIALOGUE_MOVE_ACT_POLICIES = Object.freeze({
    ANSWER_LISTENER_IDENTITY: { policyId: 'CANONICAL_ACTOR_IDENTITY', claimTypes: [], memory: false },
    ANSWER_LISTENER_ROLE: { policyId: 'CANONICAL_ACTOR_IDENTITY', claimTypes: [], memory: false },
    CONFIRM_LISTENER_ROLE: { policyId: 'CANONICAL_ACTOR_IDENTITY', claimTypes: [], memory: false },
    REPAIR_ROLE_CONTRADICTION: { policyId: 'CANONICAL_ACTOR_IDENTITY', claimTypes: [], memory: false },
    ANSWER_LISTENER_ORGANIZATION: { policyId: 'CANONICAL_ACTOR_IDENTITY', claimTypes: [], memory: false },
    ANSWER_PLAYER_IDENTITY_BOUNDARY: { policyId: 'CURRENT_TURN_ONLY', claimTypes: [], memory: false },
    ANSWER_TRUST_ASSESSMENT: { policyId: 'CURRENT_TURN_ONLY', claimTypes: [], memory: false },
    ACCEPT_FIRST_CONTACT_CORRECTION: { policyId: 'CURRENT_TURN_ONLY', claimTypes: [], memory: false },
    ACKNOWLEDGE_COMPREHENSION_FAILURE: { policyId: 'CURRENT_TURN_ONLY', claimTypes: [], memory: false },
    ANSWER_AUTHORITY_CLAIM_BOUNDARY: { policyId: 'CURRENT_TURN_ONLY', claimTypes: [], memory: false },
    ACKNOWLEDGE_UNVERIFIED_MILITARY_REPORT: { policyId: 'PLAYER_MILITARY_CLAIM_ONLY', claimTypes: ['PLAYER_REPORTED_MILITARY_THREAT'], memory: false },
    RECORD_CONFIDENTIALITY_REQUEST_FOR_REPORT: { policyId: 'PLAYER_MILITARY_CLAIM_ONLY', claimTypes: ['PLAYER_REPORTED_MILITARY_THREAT'], memory: false },
    ANSWER_PLAYER_REPORTED_LOCATION: { policyId: 'PLAYER_LOCATION_CLAIM_ONLY', claimTypes: ['PLAYER_REPORTED_LOCATION'], memory: false },
    ANSWER_LISTENER_LOCATION_UNKNOWN: { policyId: 'NO_LOCATION_EVIDENCE', claimTypes: [], memory: false },
    ASSESS_UNVERIFIED_MILITARY_REQUEST: { policyId: 'PLAYER_MILITARY_CLAIM_ONLY', claimTypes: ['PLAYER_REPORTED_MILITARY_THREAT'], memory: false },
    CONTINUE_MILITARY_SUPPORT_REQUEST: { policyId: 'PLAYER_MILITARY_CLAIM_ONLY', claimTypes: ['PLAYER_REPORTED_MILITARY_THREAT'], memory: false },
    ACKNOWLEDGE_UNVERIFIED_BUDGET: { policyId: 'PLAYER_BUDGET_CLAIM_ONLY', claimTypes: ['PLAYER_REPORTED_BUDGET'], memory: false },
    ACKNOWLEDGE_COMPANY_FOUNDING_INTENT: { policyId: 'CURRENT_TURN_AND_BUDGET_CLAIM', claimTypes: ['PLAYER_REPORTED_BUDGET'], memory: false },
    RECALL_HELD_MEMORY: { policyId: 'ACTOR_HELD_MEMORY_ONLY', claimTypes: [], memory: true },
    ANSWER_RELATIONSHIP_KNOWLEDGE_BOUNDARY: { policyId: 'CURRENT_TURN_ONLY', claimTypes: [], memory: false },
    QUALIFY_PERSONAL_JUDGMENT: { policyId: 'CURRENT_TURN_ONLY', claimTypes: [], memory: false },
    ANSWER_QUESTIONING_STYLE_CHALLENGE: { policyId: 'CURRENT_TURN_ONLY', claimTypes: [], memory: false },
    ANSWER_PLAYER_BOUNDARY: { policyId: 'CURRENT_TURN_ONLY', claimTypes: [], memory: false },
    ANSWER_ADDRESS_ETIQUETTE: { policyId: 'CANONICAL_ACTOR_IDENTITY', claimTypes: [], memory: false },
    EXPLAIN_FALLBACK_FAILURE: { policyId: 'CURRENT_TURN_ONLY', claimTypes: [], memory: false },
    ANSWER_CURRENT_ASSIGNMENT_BOUNDARY: { policyId: 'CANONICAL_ACTOR_IDENTITY', claimTypes: [], memory: false },
    ANSWER_JOB_REQUEST_BOUNDARY: { policyId: 'CURRENT_TURN_ONLY', claimTypes: [], memory: false },
    ACKNOWLEDGE_UNVERIFIED_TREASURY_REPORT: { policyId: 'PLAYER_TREASURY_CLAIM_ONLY', claimTypes: ['PLAYER_REPORTED_TREASURY_CONDITION'], memory: false },
    ANSWER_SHARED_HISTORY_BOUNDARY: { policyId: 'PLAYER_SHARED_HISTORY_CLAIM_ONLY', claimTypes: ['PLAYER_REPORTED_SHARED_HISTORY'], memory: false },
    REPAIR_FABRICATION_WORDING: { policyId: 'CURRENT_TURN_ONLY', claimTypes: [], memory: false },
    ANSWER_WEATHER_SMALL_TALK: { policyId: 'CURRENT_TURN_ONLY', claimTypes: [], memory: false },
    ACKNOWLEDGE_UNVERIFIED_SECTOR_REPORT: { policyId: 'CURRENT_TURN_ONLY', claimTypes: [], memory: false },
    QUALIFY_RELATIONSHIP_PERCEPTION: { policyId: 'CURRENT_TURN_ONLY', claimTypes: [], memory: false },
    REPAIR_MISUNDERSTANDING: { policyId: 'CURRENT_TURN_ONLY', claimTypes: [], memory: false },
    REPAIR_MISSING_ANSWER: { policyId: 'CURRENT_TURN_ONLY', claimTypes: [], memory: false },
    ACKNOWLEDGE_AND_HOLD_CONTEXT: { policyId: 'CURRENT_TURN_ONLY', claimTypes: [], memory: false },
    ANSWER_PUBLIC_PRIORITIES_WITH_AUTHORITY_BOUNDARY: { policyId: 'CURRENT_TURN_ONLY', claimTypes: [], memory: false },
    REPAIR_REPETITION: { policyId: 'CURRENT_TURN_ONLY', claimTypes: [], memory: false },
    CLARIFY_UNKNOWN_WITHOUT_FAKE_CONTINUITY: { policyId: 'CURRENT_TURN_ONLY', claimTypes: [], memory: false }
});
const STORY_DIALOGUE_MOVE_ACT_CATALOG = Object.freeze(Object.assign(
    {},
    Object.fromEntries(STORY_DIALOGUE_MOVE_BASE_ACTS.map(act => [act, Object.freeze({
        policyId: 'CURRENT_TURN_CLAIMS_ONLY', claimTypes: Object.freeze(['*']), memory: false
    })])),
    Object.fromEntries(Object.entries(STORY_DIALOGUE_MOVE_ACT_POLICIES).map(([act, policy]) => [act,
        Object.freeze(Object.assign({}, policy, { claimTypes: Object.freeze(policy.claimTypes.slice()) }))]))
));

function storyDialogueMoveClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyDialogueMoveHash(value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return `fnv1a32:${(`00000000${hash.toString(16)}`).slice(-8)}`;
}

function storyDialogueMoveUnique(values) {
    return Array.from(new Set((values || []).filter(value =>
        typeof value === 'string' && value.trim()).map(value => value.trim()))).sort();
}

function storyDialogueMoveStance(act, speechAct, relationshipBand) {
    if (/REPAIR|MISSING_ANSWER|FALLBACK_FAILURE/.test(act)) return 'REPAIR';
    if (/UNVERIFIED|QUALIFY|UNKNOWN|CLARIFY/.test(act)) return 'SKEPTICAL';
    if (/BOUNDARY|ROLE_CONTRADICTION/.test(act)) return 'BOUNDARY';
    if (['GREETING', 'CHECK_IN', 'THANK', 'APOLOGIZE'].includes(speechAct)
        && relationshipBand === 'TRUSTED') return 'WARM';
    if (relationshipBand === 'HOSTILE' || relationshipBand === 'RESERVED') return 'GUARDED';
    return ['GREETING', 'CHECK_IN', 'SMALL_TALK'].includes(speechAct) ? 'OPEN' : 'NEUTRAL';
}

function storyDialogueMoveRequiredPoints(act, input) {
    const points = ['ANSWER_CURRENT_PLAYER_TURN', 'PRESERVE_WORLD_NEUTRALITY'];
    if (/IDENTITY|ROLE|ORGANIZATION/.test(act)) points.push('USE_CANONICAL_ACTOR_IDENTITY_ONLY');
    if (/UNVERIFIED|QUALIFY|MILITARY|BUDGET|LOCATION/.test(act)
        || (input.claimRefs || []).length) points.push('PRESERVE_CLAIM_VERIFICATION_STATUS');
    if (/UNKNOWN|CLARIFY/.test(act)) points.push('STATE_UNDERSTANDING_LIMIT_EXPLICITLY');
    if (/REPAIR/.test(act)) points.push('CORRECT_PRIOR_RESPONSE_WITHOUT_DEFENSIVENESS');
    if ((input.memoryRefs || []).length) points.push('CITE_ONLY_HELD_MEMORY');
    if (/SUPPORT|REQUEST|COMPANY|JOB|TASK|PRIORITIES/.test(act)) points.push('STATE_AUTHORITY_BOUNDARY');
    return storyDialogueMoveUnique(points);
}

function storyDialogueMoveRelevantClaims(act, currentClaims, inheritedClaims) {
    const rows = [].concat(currentClaims || []);
    const policy = STORY_DIALOGUE_MOVE_ACT_CATALOG[act];
    const types = policy ? policy.claimTypes : [];
    if (!types.includes('*')) for (let index = rows.length - 1; index >= 0; index--) {
        if (!types.includes(rows[index] && rows[index].type)) rows.splice(index, 1);
    }
    if (types.length && !types.includes('*')) rows.push(...(inheritedClaims || []).filter(row =>
        row && types.includes(row.type)));
    const byId = new Map();
    rows.filter(Boolean).forEach(row => row.id && byId.set(row.id, row));
    return Array.from(byId.values());
}

function storyDialogueMoveBuild(input) {
    input = input && typeof input === 'object' ? input : {};
    const analysis = input.analysis && typeof input.analysis === 'object' ? input.analysis : {};
    const response = input.response && typeof input.response === 'object' ? input.response : {};
    const sequence = Math.max(0, Math.floor(Number(input.sequence) || 0));
    const sessionId = String(input.sessionId || 'conversation-session:unknown');
    const responseId = String(response.id || input.responseId || 'conversation-response:unknown');
    const act = String(response.discourseAct || analysis.speechAct || 'UNKNOWN').toUpperCase();
    const policy = STORY_DIALOGUE_MOVE_ACT_CATALOG[act] || null;
    const claims = storyDialogueMoveRelevantClaims(act, analysis.claims, input.inheritedClaims);
    const claimRefs = storyDialogueMoveUnique(claims.map(row => row && row.id));
    const memoryRecords = response.memoryRecall && response.memoryRecall.records || [];
    const memoryRefs = storyDialogueMoveUnique((policy && policy.memory ? memoryRecords : [])
        .map(row => row && row.id));
    const entityIds = [].concat(
        input.listenerActorId || [], input.playerActorId || [],
        (analysis.entities || []).map(row => row && row.entityId),
        claims.flatMap(row => row && (row.entityIds || row.regionIds) || [])
    );
    const core = {
        schemaVersion: STORY_DIALOGUE_MOVE_SCHEMA_VERSION,
        adapterVersion: STORY_DIALOGUE_MOVE_ADAPTER_VERSION,
        act,
        sourcePolicyId: policy && policy.policyId || 'UNREGISTERED_ACT',
        stance: storyDialogueMoveStance(act, analysis.speechAct, response.relationshipBand),
        addressesTurnId: `conversation-turn:${sessionId}:${sequence}`,
        factRefs: storyDialogueMoveUnique(input.factRefs),
        beliefRefs: storyDialogueMoveUnique(input.beliefRefs),
        claimRefs,
        memoryRefs,
        allowedEntityIds: storyDialogueMoveUnique(entityIds),
        requiredPoints: [],
        forbiddenCommitments: STORY_DIALOGUE_MOVE_FORBIDDEN_COMMITMENTS.slice(),
        worldCommand: null,
        responseId
    };
    core.requiredPoints = storyDialogueMoveRequiredPoints(act, core);
    core.moveId = `dialogue-move:${storyDialogueMoveHash(core).slice(8)}`;
    return core;
}

function storyDialogueMoveValidate(candidate, sourceUniverse) {
    const issues = [];
    const add = (code, path) => issues.push({ code, path });
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return { ok: false, issues: [{ code: 'MOVE_REQUIRED', path: '$' }] };
    }
    if (candidate.schemaVersion !== STORY_DIALOGUE_MOVE_SCHEMA_VERSION) add('SCHEMA', '$.schemaVersion');
    if (candidate.adapterVersion !== STORY_DIALOGUE_MOVE_ADAPTER_VERSION) add('ADAPTER', '$.adapterVersion');
    if (!/^dialogue-move:[a-f0-9]{8}$/.test(String(candidate.moveId || ''))) add('MOVE_ID', '$.moveId');
    if (!/^[A-Z][A-Z0-9_]{1,79}$/.test(String(candidate.act || ''))) add('ACT', '$.act');
    const actPolicy = STORY_DIALOGUE_MOVE_ACT_CATALOG[candidate.act];
    if (!actPolicy) add('ACT_NOT_REGISTERED', '$.act');
    if (!actPolicy || candidate.sourcePolicyId !== actPolicy.policyId) add('SOURCE_POLICY', '$.sourcePolicyId');
    if (!STORY_DIALOGUE_MOVE_STANCES.includes(candidate.stance)) add('STANCE', '$.stance');
    if (!/^conversation-turn:.+:[0-9]+$/.test(String(candidate.addressesTurnId || ''))) add('TURN_REF', '$.addressesTurnId');
    for (const key of ['factRefs', 'beliefRefs', 'claimRefs', 'memoryRefs', 'allowedEntityIds',
        'requiredPoints', 'forbiddenCommitments']) {
        const rows = candidate[key];
        if (!Array.isArray(rows) || rows.some(row => typeof row !== 'string' || !row.trim())
            || new Set(rows).size !== rows.length) add('REF_LIST', `$.${key}`);
    }
    if (!candidate.requiredPoints || !candidate.requiredPoints.includes('PRESERVE_WORLD_NEUTRALITY')) {
        add('WORLD_NEUTRALITY_POINT', '$.requiredPoints');
    }
    if (!candidate.forbiddenCommitments
        || !STORY_DIALOGUE_MOVE_FORBIDDEN_COMMITMENTS.every(row => candidate.forbiddenCommitments.includes(row))) {
        add('FORBIDDEN_COMMITMENTS', '$.forbiddenCommitments');
    }
    if (candidate.worldCommand !== null) add('WORLD_COMMAND', '$.worldCommand');
    if (!candidate.responseId) add('RESPONSE_ID', '$.responseId');
    if (actPolicy && !actPolicy.memory && (candidate.memoryRefs || []).length) add('MEMORY_NOT_ALLOWED', '$.memoryRefs');
    if (sourceUniverse && typeof sourceUniverse === 'object') {
        for (const key of ['factRefs', 'beliefRefs', 'claimRefs', 'memoryRefs', 'allowedEntityIds']) {
            const allowed = new Set(sourceUniverse[key] || []);
            for (const ref of candidate[key] || []) if (!allowed.has(ref)) add('UNSOURCED_REF', `$.${key}`);
        }
    }
    const unsigned = storyDialogueMoveClone(candidate);
    delete unsigned.moveId;
    const expectedId = `dialogue-move:${storyDialogueMoveHash(unsigned).slice(8)}`;
    if (candidate.moveId !== expectedId) add('MOVE_CHECKSUM', '$.moveId');
    return { ok: issues.length === 0, issues };
}

function storyDialogueMovePromptView(move) {
    const validation = storyDialogueMoveValidate(move);
    if (!validation.ok) return null;
    return {
        moveId: move.moveId,
        act: move.act,
        sourcePolicyId: move.sourcePolicyId,
        stance: move.stance,
        addressesTurnId: move.addressesTurnId,
        allowedRefs: storyDialogueMoveUnique([].concat(
            move.factRefs, move.beliefRefs, move.claimRefs, move.memoryRefs)),
        allowedEntityIds: move.allowedEntityIds.slice(),
        requiredPoints: move.requiredPoints.slice(),
        forbiddenCommitments: move.forbiddenCommitments.slice(),
        worldCommand: null
    };
}

if (typeof module !== 'undefined' && module.exports) module.exports = {
    STORY_DIALOGUE_MOVE_SCHEMA_VERSION,
    STORY_DIALOGUE_MOVE_ADAPTER_VERSION,
    STORY_DIALOGUE_MOVE_FORBIDDEN_COMMITMENTS,
    STORY_DIALOGUE_MOVE_ACT_CATALOG,
    storyDialogueMoveBuild,
    storyDialogueMoveValidate,
    storyDialogueMovePromptView
};
