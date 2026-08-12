// ═══════════════════════════════════════════════════════════════════════════
//  İLİŞKİ YORUMU VE BAĞLAMSAL GERİ ÇAĞRIM — Faz 38.8
//  Mevcut Faz 35 ilişki ve Faz 36 hafıza defterlerini kopyalamaz. Yalnız
//  aktörün gerçekten tuttuğu bir hafıza kaydını, mevcut beş ilişki ekseninde
//  salt-okunur ve açıklanabilir bir yorum adayına dönüştürür.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_RELATIONSHIP_INTERPRETATION_SCHEMA_VERSION = 1;
const STORY_RELATIONSHIP_INTERPRETATION_TYPES = Object.freeze([
    'PROMISE_KEPT', 'PROMISE_BROKEN', 'PUBLIC_HUMILIATION', 'SHARED_CRISIS_SUCCESS'
]);
const STORY_RELATIONSHIP_INTERPRETATION_BASE = Object.freeze({
    PROMISE_KEPT: Object.freeze({
        trustBps: 250, fearBps: 0, respectBps: 120, debtBps: 100, hostilityBps: -80
    }),
    PROMISE_BROKEN: Object.freeze({
        trustBps: -600, fearBps: 80, respectBps: -250, debtBps: 0, hostilityBps: 350
    }),
    PUBLIC_HUMILIATION: Object.freeze({
        trustBps: -250, fearBps: 120, respectBps: -500, debtBps: 0, hostilityBps: 500
    }),
    SHARED_CRISIS_SUCCESS: Object.freeze({
        trustBps: 400, fearBps: -80, respectBps: 300, debtBps: 150, hostilityBps: -150
    })
});
const STORY_RELATIONSHIP_INTERPRETATION_HINTS = Object.freeze({
    PROMISE_KEPT: Object.freeze(['COOPERATE', 'FORMALIZE_COMMITMENT']),
    PROMISE_BROKEN: Object.freeze(['REQUEST_CURE', 'SUSPEND_COOPERATION']),
    PUBLIC_HUMILIATION: Object.freeze(['DISTANCE', 'DEMAND_REPAIR']),
    SHARED_CRISIS_SUCCESS: Object.freeze(['SUPPORT', 'ALLY'])
});

function storyRelationshipInterpretationEnabled() {
    return typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('characters.relationshipInterpretation');
}
function storyRelationshipInterpretationClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}
function storyRelationshipInterpretationHeldSource(actorId, sourceId) {
    const ledger = typeof storyMemoryEnsure === 'function' ? storyMemoryEnsure() : null;
    const id = String(sourceId || '');
    const holder = String(actorId || '');
    const milestone = ledger && ledger.milestones && ledger.milestones[id];
    if (milestone && (milestone.holderActorIds || []).includes(holder)) {
        return { layer: 'MILESTONE', row: milestone };
    }
    const episode = ledger && ledger.episodes && ledger.episodes[id];
    if (episode && (episode.participantActorIds || []).includes(holder)) {
        return { layer: 'EPISODE', row: episode };
    }
    const recent = ledger && ledger.recentByActor && (ledger.recentByActor[holder] || [])
        .find(row => row && row.id === id && row.actorId === holder);
    return recent ? { layer: 'RECENT', row: recent } : null;
}
function storyRelationshipInterpretationType(source) {
    const row = source && source.row;
    if (!row) return null;
    const kind = String(row.kind || '').toUpperCase();
    if (kind === 'PROMISE') {
        if (row.status === 'KEPT') return 'PROMISE_KEPT';
        if (row.status === 'BROKEN') return 'PROMISE_BROKEN';
    }
    const tag = String(row.source && row.source.relationshipEventTag || '').toUpperCase();
    const sourced = row.source && (row.source.sourceEventId != null
        || row.source.sourceReceiptId != null);
    if (tag === 'PUBLIC_HUMILIATION' && kind === 'CONFLICT' && sourced) return tag;
    if (tag === 'SHARED_CRISIS_SUCCESS' && kind === 'DECISION' && sourced) return tag;
    return null;
}
function storyRelationshipInterpretationIntensityBps(actorId, type) {
    const actor = typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(actorId) : null;
    const axes = actor && actor.coreAxes || {};
    const values = actor && actor.values || {};
    let delta = 0;
    if (type === 'PROMISE_BROKEN' || type === 'PUBLIC_HUMILIATION') {
        delta += (Number(axes.loyalty) - 50) * 18;
        delta += (Number(values.hawkishness) - 50) * 10;
    } else {
        delta += (Number(axes.cooperation) - 50) * 14;
        delta += (Number(axes.loyalty) - 50) * 8;
    }
    return Math.max(8000, Math.min(12000, Math.round(10000 + delta)));
}
function storyRelationshipInterpretMemory(actorId, relatedActorId, sourceId) {
    const holderActorId = String(actorId || '');
    const targetActorId = String(relatedActorId || '');
    if (!storyRelationshipInterpretationEnabled()) return {
        ok: false, code: 'FEATURE_DISABLED', worldMutation: false, rawWorldRead: false
    };
    const identities = typeof storyCharacterIdentityEnsure === 'function'
        ? storyCharacterIdentityEnsure().identities : {};
    if (!identities[holderActorId] || !identities[targetActorId]
        || holderActorId === targetActorId) return {
        ok: false, code: 'ACTOR_REFERENCE_REQUIRED', worldMutation: false, rawWorldRead: false
    };
    const source = storyRelationshipInterpretationHeldSource(holderActorId, sourceId);
    if (!source) return {
        ok: false, code: 'ACTOR_HELD_MEMORY_REQUIRED', worldMutation: false, rawWorldRead: false
    };
    const related = [source.row.subjectActorId].concat(source.row.relatedActorIds || [],
        source.row.participantActorIds || []).filter(Boolean).map(String);
    if (!related.includes(targetActorId)) return {
        ok: false, code: 'MEMORY_TARGET_MISMATCH', worldMutation: false, rawWorldRead: false
    };
    const interpretationType = storyRelationshipInterpretationType(source);
    if (!interpretationType) return {
        ok: false, code: 'SUPPORTED_EVENT_TAG_REQUIRED', sourceMemoryId: String(sourceId),
        worldMutation: false, rawWorldRead: false
    };
    const intensityBps = storyRelationshipInterpretationIntensityBps(holderActorId, interpretationType);
    const base = STORY_RELATIONSHIP_INTERPRETATION_BASE[interpretationType];
    const proposedRelationshipDeltas = Object.fromEntries(Object.entries(base).map(([axis, value]) => [
        axis, Math.round(Number(value) * intensityBps / 10000)
    ]));
    const recall = typeof storyMemoryRecallForActor === 'function'
        ? storyMemoryRecallForActor(holderActorId, {
            sourceIds: [String(sourceId)], relatedActorId: targetActorId, limit: 3
        }) : { ok: false, records: [], rawWorldRead: false };
    return {
        ok: true,
        code: 'RELATIONSHIP_INTERPRETATION_READY',
        interpretation: {
            schemaVersion: STORY_RELATIONSHIP_INTERPRETATION_SCHEMA_VERSION,
            id: `relationship-interpretation:${holderActorId}:${String(sourceId)}`,
            actorId: holderActorId,
            relatedActorId: targetActorId,
            sourceMemoryId: String(sourceId),
            sourceLayer: source.layer,
            interpretationType,
            intensityBps,
            proposedRelationshipDeltas,
            actionHints: STORY_RELATIONSHIP_INTERPRETATION_HINTS[interpretationType].slice(),
            recallRecords: storyRelationshipInterpretationClone(recall.records || []),
            applied: false,
            worldMutation: false,
            rawWorldRead: false
        },
        worldMutation: false,
        rawWorldRead: false
    };
}
