// ═══════════════════════════════════════════════════════════════════════════
//  KARAKTER DAVRANIŞ DURUMU — Faz 38.7
//  Kararlı sınırlı bias, kaynaklı ve sönümlenen stres, mekanik-gerçekten ayrı
//  kamu personası. Bu ilk dilim seçim puanına veya dünya sonucuna yazmaz.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_CHARACTER_BEHAVIOR_SCHEMA_VERSION = 1;
const STORY_CHARACTER_BEHAVIOR_ADAPTER_VERSION = 'story-character-behavior-1';
const STORY_CHARACTER_STRESS_CAP_PER_ACTOR = 8;
const STORY_CHARACTER_STRESS_MAX_BPS = 10000;
const STORY_CHARACTER_STRESS_MIN_HALF_LIFE = 30;
const STORY_CHARACTER_STRESS_MAX_HALF_LIFE = 1800;

function storyCharacterBehaviorEnabled() {
    return typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('characters.behaviorState');
}
function storyCharacterBehaviorClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}
function storyCharacterBehaviorHash(value) {
    const text = String(value == null ? '' : value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
function storyCharacterBehaviorBiasProfile(actor) {
    const axes = actor && actor.coreAxes || {};
    const candidates = [
        { id: 'INSTITUTIONAL_PRIOR', axis: 'institutionalPosture', signed: Number(axes.institutionalPosture) - 50 },
        { id: 'NATIONAL_PRIOR', axis: 'nationalGlobalOrientation', signed: Number(axes.nationalGlobalOrientation) - 50 },
        { id: 'EVIDENCE_STYLE_PRIOR', axis: 'popularTechnocraticStyle', signed: Number(axes.popularTechnocraticStyle) - 50 }
    ].map(row => Object.assign(row, {
        direction: row.signed >= 0 ? 'POSITIVE' : 'NEGATIVE',
        strengthBps: Math.min(2500, Math.round(Math.abs(row.signed) * 50))
    })).filter(row => row.strengthBps >= 250)
        .sort((left, right) => right.strengthBps - left.strengthBps
            || left.id.localeCompare(right.id, 'en')).slice(0, 2);
    return {
        schemaVersion: 1, actorId: actor.id,
        biases: candidates.map(row => ({
            id: row.id, axis: row.axis, direction: row.direction,
            strengthBps: row.strengthBps, source: 'CANONICAL_CORE_AXIS'
        })),
        cap: 2, scoreEffect: 0, doubleCountPrevented: true
    };
}
function storyCharacterBehaviorPersona(actor) {
    const voice = actor && actor.voiceProfile || {};
    return {
        schemaVersion: 1, actorId: actor.id,
        publicRegister: String(voice.register || 'ANALYTICAL_FORMAL'),
        disclosureStyle: Number(voice.formalityBps) >= 6000 ? 'INSTITUTIONAL' : 'PERSONAL_DIRECT',
        pressureStyle: Number(voice.directnessBps) >= 6000 ? 'FIRM' : 'MEASURED',
        source: 'CANONICAL_VOICE_PROFILE', mechanicalTruthMutable: false
    };
}
function storyCharacterBehaviorLedgerCreate() {
    const actors = {};
    const identities = typeof storyCharacterIdentityEnsure === 'function'
        ? storyCharacterIdentityEnsure().identities : {};
    for (const actor of Object.values(identities || {})) actors[actor.id] = {
        actorId: actor.id,
        biasProfile: storyCharacterBehaviorBiasProfile(actor),
        publicPersona: storyCharacterBehaviorPersona(actor),
        stressors: {}, updatedAt: Number(STORY.clock) || 0
    };
    return {
        schemaVersion: STORY_CHARACTER_BEHAVIOR_SCHEMA_VERSION,
        adapterVersion: STORY_CHARACTER_BEHAVIOR_ADAPTER_VERSION,
        actors, diagnostics: { worldMutation: false, welfareWrites: 0, randomBias: false }
    };
}
function storyCharacterBehaviorEnsure() {
    if (!storyCharacterBehaviorEnabled()) return null;
    if (!STORY.characterBehavior || STORY.characterBehavior.schemaVersion !== STORY_CHARACTER_BEHAVIOR_SCHEMA_VERSION) {
        STORY.characterBehavior = storyCharacterBehaviorLedgerCreate();
    }
    const identities = typeof storyCharacterIdentityEnsure === 'function'
        ? storyCharacterIdentityEnsure().identities : {};
    for (const actor of Object.values(identities || {})) if (!STORY.characterBehavior.actors[actor.id]) {
        STORY.characterBehavior.actors[actor.id] = {
            actorId: actor.id, biasProfile: storyCharacterBehaviorBiasProfile(actor),
            publicPersona: storyCharacterBehaviorPersona(actor), stressors: {},
            updatedAt: Number(STORY.clock) || 0
        };
    }
    return STORY.characterBehavior;
}
function storyCharacterBehaviorReset() {
    STORY.characterBehavior = storyCharacterBehaviorEnabled()
        ? storyCharacterBehaviorLedgerCreate() : null;
    return storyCharacterBehaviorSnapshot();
}
function storyCharacterBehaviorHeldBelief(actorId, beliefId) {
    const ledger = typeof storyCharacterIdentityEnsure === 'function'
        ? storyCharacterIdentityEnsure() : null;
    const belief = ledger && ledger.actorBeliefs && ledger.actorBeliefs[String(beliefId || '')];
    return belief && belief.holderActorId === String(actorId || '') ? belief : null;
}
function storyCharacterBehaviorStressAdd(actorId, input) {
    const ledger = storyCharacterBehaviorEnsure();
    const row = ledger && ledger.actors[String(actorId || '')];
    input = input || {};
    const belief = storyCharacterBehaviorHeldBelief(actorId, input.beliefId);
    if (!row) return { ok: false, code: 'ACTOR_NOT_FOUND' };
    if (!belief || !input.eventId || String(belief.originEventId || belief.source && belief.source.eventId || '') !== String(input.eventId)) {
        return { ok: false, code: 'SOURCE_BELIEF_REQUIRED' };
    }
    const initialBps = Math.max(1, Math.min(STORY_CHARACTER_STRESS_MAX_BPS,
        Math.round(Number(input.initialBps) || 0)));
    const halfLifeSeconds = Math.max(STORY_CHARACTER_STRESS_MIN_HALF_LIFE,
        Math.min(STORY_CHARACTER_STRESS_MAX_HALF_LIFE, Math.round(Number(input.halfLifeSeconds) || 300)));
    const id = `character-stress:${storyCharacterBehaviorHash(`${actorId}|${input.eventId}|${input.kind || 'EVENT'}`).toString(16)}`;
    row.stressors[id] = {
        id, actorId: String(actorId), kind: String(input.kind || 'EVENT_PRESSURE'),
        eventId: String(input.eventId), beliefId: belief.id,
        initialBps, currentBps: initialBps, halfLifeSeconds,
        startedAt: Number(STORY.clock) || 0, lastUpdatedAt: Number(STORY.clock) || 0,
        status: 'ACTIVE', scoreEffect: 0, worldMutation: false
    };
    const ordered = Object.values(row.stressors).sort((a, b) => Number(b.startedAt) - Number(a.startedAt)
        || b.id.localeCompare(a.id, 'en'));
    for (const excess of ordered.slice(STORY_CHARACTER_STRESS_CAP_PER_ACTOR)) delete row.stressors[excess.id];
    row.updatedAt = Number(STORY.clock) || 0;
    return { ok: true, stressor: storyCharacterBehaviorClone(row.stressors[id]) };
}
function storyCharacterBehaviorTick(dtSec) {
    const ledger = storyCharacterBehaviorEnsure();
    if (!ledger) return { disabled: true };
    const now = Number(STORY.clock) || 0;
    let active = 0;
    for (const actor of Object.values(ledger.actors)) for (const stressor of Object.values(actor.stressors || {})) {
        if (stressor.status !== 'ACTIVE') continue;
        const elapsed = Math.max(0, now - Number(stressor.startedAt));
        stressor.currentBps = Math.max(0, Math.round(Number(stressor.initialBps)
            * Math.pow(0.5, elapsed / Number(stressor.halfLifeSeconds))));
        stressor.lastUpdatedAt = now;
        if (stressor.currentBps <= 10) stressor.status = 'EXPIRED'; else active++;
        actor.updatedAt = now;
    }
    return { disabled: false, activeStressors: active, elapsedSeconds: Number(dtSec) || 0 };
}
function storyCharacterBehaviorValidate(candidate) {
    const issues = [];
    const add = (code, path) => issues.push({ code, path });
    if (!candidate || candidate.schemaVersion !== STORY_CHARACTER_BEHAVIOR_SCHEMA_VERSION) add('SCHEMA_VERSION', '$');
    if (!candidate || candidate.adapterVersion !== STORY_CHARACTER_BEHAVIOR_ADAPTER_VERSION) add('ADAPTER_VERSION', '$');
    const identities = typeof storyCharacterIdentityEnsure === 'function'
        ? storyCharacterIdentityEnsure().identities : {};
    for (const [actorId, row] of Object.entries(candidate && candidate.actors || {})) {
        const at = `$.actors.${actorId}`;
        if (!identities[actorId] || !row || row.actorId !== actorId) add('ACTOR_REFERENCE', at);
        if (!row || !row.biasProfile || row.biasProfile.biases.length > 2
            || row.biasProfile.scoreEffect !== 0 || row.biasProfile.doubleCountPrevented !== true) add('BIAS_CONTRACT', `${at}.biasProfile`);
        if (!row || !row.publicPersona || row.publicPersona.mechanicalTruthMutable !== false) add('PERSONA_CONTRACT', `${at}.publicPersona`);
        if (Object.keys(row && row.stressors || {}).length > STORY_CHARACTER_STRESS_CAP_PER_ACTOR) add('STRESS_CAP', `${at}.stressors`);
        for (const [id, stressor] of Object.entries(row && row.stressors || {})) {
            if (!stressor || stressor.id !== id || stressor.actorId !== actorId
                || !storyCharacterBehaviorHeldBelief(actorId, stressor.beliefId)
                || stressor.scoreEffect !== 0 || stressor.worldMutation !== false
                || Number(stressor.currentBps) < 0 || Number(stressor.currentBps) > 10000) {
                add('STRESS_CONTRACT', `${at}.stressors.${id}`);
            }
        }
    }
    if (!candidate || !candidate.diagnostics || candidate.diagnostics.worldMutation !== false
        || candidate.diagnostics.welfareWrites !== 0) add('WORLD_MUTATION_CONTRACT', '$.diagnostics');
    return { ok: issues.length === 0, issues };
}
function storyCharacterBehaviorSnapshot() {
    const ledger = storyCharacterBehaviorEnsure();
    return ledger ? storyCharacterBehaviorClone(ledger) : null;
}
function storyCharacterBehaviorForSave() { return storyCharacterBehaviorSnapshot(); }
function storyCharacterBehaviorRestore(saved) {
    if (!storyCharacterBehaviorEnabled()) { STORY.characterBehavior = null; return null; }
    const candidate = storyCharacterBehaviorClone(saved);
    if (candidate && storyCharacterBehaviorValidate(candidate).ok) STORY.characterBehavior = candidate;
    else STORY.characterBehavior = storyCharacterBehaviorLedgerCreate();
    return storyCharacterBehaviorSnapshot();
}
