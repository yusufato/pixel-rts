// ═══════════════════════════════════════════════════════════════════════════
//  KOHORTTAN KARAKTER AKTİVASYON POLİTİKASI — Faz 38.11
//  Bu ilk dikey isimli kişi yaratmaz. Yalnız gerçek nüfus kohortu ile gerçek
//  toplumsal olay kesişiminden deterministik aday görünümü üretir.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_CHARACTER_ACTIVATION_SCHEMA_VERSION = 1;
const STORY_CHARACTER_ACTIVATION_ADAPTER_VERSION = 'story-character-activation-ledger-1';
const STORY_CHARACTER_ACTIVATION_PROMOTABLE = Object.freeze(['RELEVANT', 'MAJOR', 'WORLD']);
const STORY_CHARACTER_ACTIVATION_BUDGET = Object.freeze({
    worldNamedRepresentatives: 64,
    countryNamedRepresentatives: 8,
    highResolutionActors: 16,
    promotionsPerTick: 1,
    tickSeconds: 15
});
const STORY_CHARACTER_ACTIVATION_LEVELS = Object.freeze([
    'AGGREGATE', 'MINOR', 'RELEVANT', 'MAJOR', 'WORLD'
]);

function storyCharacterActivationEnabled() {
    return typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('characters.cohortActivation');
}
function storyCharacterActivationClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}
function storyCharacterActivationSafeToken(value) {
    return String(value == null ? '' : value).replace(/[^a-zA-Z0-9_-]/g, '-');
}
function storyCharacterActivationLedgerCreate(options) {
    return {
        schemaVersion: STORY_CHARACTER_ACTIVATION_SCHEMA_VERSION,
        adapterVersion: STORY_CHARACTER_ACTIVATION_ADAPTER_VERSION,
        sequence: 0,
        promotions: {},
        diagnostics: {
            backfilled: !!(options && options.backfilled),
            populationAccounting: 'NAMED_PERSON_REMAINS_INCLUDED_IN_SOURCE_COHORT',
            inventedPeople: false
        }
    };
}
function storyCharacterActivationEnsure() {
    if (!storyCharacterActivationEnabled()) return null;
    if (!STORY.characterActivation) {
        STORY.characterActivation = storyCharacterActivationLedgerCreate({ backfilled: true });
    }
    return STORY.characterActivation;
}
function storyCharacterActivationReset() {
    if (!storyCharacterActivationEnabled()) { STORY.characterActivation = null; return null; }
    STORY.characterActivation = storyCharacterActivationLedgerCreate();
    return storyCharacterActivationSnapshot();
}
function storyCharacterActivationValidate(candidate) {
    const issues = [];
    const add = (code, path) => issues.push({ code, path });
    if (!candidate || typeof candidate !== 'object') return {
        ok: false, issues: [{ code: 'ACTIVATION_LEDGER_REQUIRED', path: '$' }]
    };
    if (candidate.schemaVersion !== STORY_CHARACTER_ACTIVATION_SCHEMA_VERSION) add('ACTIVATION_SCHEMA', '$.schemaVersion');
    if (candidate.adapterVersion !== STORY_CHARACTER_ACTIVATION_ADAPTER_VERSION) add('ACTIVATION_ADAPTER', '$.adapterVersion');
    if (!Number.isInteger(candidate.sequence) || candidate.sequence < 0) add('ACTIVATION_SEQUENCE', '$.sequence');
    if (!candidate.promotions || typeof candidate.promotions !== 'object'
        || Array.isArray(candidate.promotions)) add('ACTIVATION_PROMOTIONS', '$.promotions');
    for (const [candidateId, row] of Object.entries(candidate.promotions || {})) {
        const at = `$.promotions.${candidateId}`;
        if (!row || row.candidateId !== candidateId) add('PROMOTION_CANDIDATE_ID', `${at}.candidateId`);
        if (!row || !row.actorId || !row.cohortId || !row.regionId || !row.countryId
            || !row.sourceMovementId || !STORY_CHARACTER_ACTIVATION_PROMOTABLE.includes(row.level)
            || row.populationAccounting !== 'REPRESENTATIVE_INCLUDED_IN_COHORT'
            || row.populationDelta !== 0 || !Number.isFinite(Number(row.promotedAt))) {
            add('PROMOTION_CONTRACT', at);
        }
        const identityLedger = STORY.characterIdentities;
        const actor = identityLedger && identityLedger.identities && identityLedger.identities[row.actorId];
        if (!actor || !actor.activationOrigin || actor.activationOrigin.candidateId !== candidateId
            || actor.activationOrigin.cohortId !== row.cohortId) add('PROMOTION_IDENTITY_REFERENCE', `${at}.actorId`);
    }
    return { ok: issues.length === 0, issues };
}
function storyCharacterActivationSnapshot() {
    const ledger = storyCharacterActivationEnsure();
    return ledger ? storyCharacterActivationClone(ledger) : null;
}
function storyCharacterActivationForSave() { return storyCharacterActivationSnapshot(); }
function storyCharacterActivationRestore(saved) {
    if (!storyCharacterActivationEnabled()) { STORY.characterActivation = null; return null; }
    const candidate = storyCharacterActivationClone(saved);
    if (candidate && candidate.schemaVersion === STORY_CHARACTER_ACTIVATION_SCHEMA_VERSION
        && candidate.adapterVersion === STORY_CHARACTER_ACTIVATION_ADAPTER_VERSION
        && candidate.promotions && typeof candidate.promotions === 'object') {
        STORY.characterActivation = candidate;
        if (!storyCharacterActivationValidate(candidate).ok) {
            STORY.characterActivation = storyCharacterActivationLedgerCreate({ backfilled: true });
        }
    } else {
        STORY.characterActivation = storyCharacterActivationLedgerCreate({ backfilled: true });
    }
    return storyCharacterActivationSnapshot();
}
function storyCharacterActivationLevel(participation) {
    const stage = String(participation && participation.stage || 'NONE');
    const severity = Number(participation && participation.localSeverityBps) || 0;
    const mobilization = Number(participation && participation.mobilizationBps) || 0;
    const scoreBps = Math.max(0, Math.min(10000, Math.round(
        severity * 0.45 + mobilization * 0.35
        + ({ NONE: 0, PROTEST: 900, STRIKE: 1900, UPRISING: 3200 })[stage]
    )));
    const level = scoreBps >= 9000 ? 'WORLD'
        : scoreBps >= 7000 ? 'MAJOR'
        : scoreBps >= 4500 ? 'RELEVANT'
        : scoreBps >= 2500 ? 'MINOR' : 'AGGREGATE';
    return { level, scoreBps };
}
function storyCharacterActivationCohort(region, participation) {
    const laborProblem = ['UNEMPLOYMENT', 'WAGE_PRESSURE', 'WORKING_CONDITIONS',
        'FOOD_ACCESS', 'ENERGY_ACCESS'].includes(String(participation.problemType || ''));
    return (region.cohorts || []).filter(cohort => cohort.membersPeople > 0
        && !['CHILD', 'SENIOR'].includes(cohort.ageBand))
        .map(cohort => ({
            cohort,
            score: (laborProblem && ['INDUSTRY', 'AGRICULTURE', 'SERVICES', 'UNEMPLOYED']
                .includes(cohort.occupation) ? 3000 : 0)
                + (cohort.education === 'TERTIARY' ? 900 : 0)
                + Math.min(2500, cohort.membersPeople * 5)
        }))
        .sort((a, b) => b.score - a.score
            || a.cohort.id.localeCompare(b.cohort.id, 'en'))[0]?.cohort || null;
}
function storyCharacterActivationCandidates() {
    if (!storyCharacterActivationEnabled()) return {
        ok: false, code: 'FEATURE_DISABLED', candidates: [], worldMutation: false
    };
    const population = typeof storyPopulationEnsure === 'function' ? storyPopulationEnsure() : null;
    const collective = typeof storyCollectiveEnsure === 'function' ? storyCollectiveEnsure() : null;
    if (!population || !collective) return {
        ok: false, code: 'SOURCE_LEDGER_UNAVAILABLE', candidates: [], worldMutation: false
    };
    const activationLedger = STORY.characterActivation
        || storyCharacterActivationLedgerCreate({ backfilled: true });
    const candidates = [];
    for (const regionId of Object.keys(collective.regions || {}).sort()) {
        const summary = collective.regions[regionId];
        const region = population.regions && population.regions[regionId];
        if (!region) continue;
        for (const participation of (summary.participations || [])) {
            if (participation.stage === 'NONE') continue;
            const cohort = storyCharacterActivationCohort(region, participation);
            if (!cohort) continue;
            const activation = storyCharacterActivationLevel(participation);
            const id = `activation:${cohort.id}:${participation.movementId}`;
            const promotion = activationLedger && activationLedger.promotions[id];
            candidates.push({
                id,
                schemaVersion: STORY_CHARACTER_ACTIVATION_SCHEMA_VERSION,
                level: activation.level, scoreBps: activation.scoreBps,
                cohortId: cohort.id, regionId, countryId: cohort.countryId,
                sourcePopulationPeople: cohort.membersPeople,
                profile: {
                    ageBand: cohort.ageBand, occupation: cohort.occupation,
                    education: cohort.education, identity: cohort.identity
                },
                trigger: {
                    type: 'COLLECTIVE_ACTION_PARTICIPATION', movementId: participation.movementId,
                    stage: participation.stage, problemType: participation.problemType,
                    blamedActorId: participation.blamedActorId,
                    localSeverityBps: participation.localSeverityBps,
                    mobilizationBps: participation.mobilizationBps
                },
                identityActorId: promotion ? promotion.actorId : null,
                promotionStatus: promotion ? 'PROMOTED_NAMED_REPRESENTATIVE'
                    : 'CANDIDATE_ONLY_NO_PERSON_CREATED',
                promotable: STORY_CHARACTER_ACTIVATION_PROMOTABLE.includes(activation.level),
                populationMutation: false, worldMutation: false
            });
        }
    }
    candidates.sort((a, b) => b.scoreBps - a.scoreBps || a.id.localeCompare(b.id, 'en'));
    return {
        ok: true, code: candidates.length ? 'ACTIVATION_CANDIDATES_READY' : 'NO_EVIDENCED_CANDIDATES',
        schemaVersion: STORY_CHARACTER_ACTIVATION_SCHEMA_VERSION,
        levels: STORY_CHARACTER_ACTIVATION_LEVELS.slice(), candidates,
        namedCharacterCreationAvailable: true,
        canonicalLedgersReadOnly: true, populationMutation: false, worldMutation: false
    };
}

function storyCharacterActivationRole(candidate) {
    return candidate && candidate.profile && candidate.profile.occupation === 'DEFENSE'
        ? 'OFFICER' : 'CIVILIAN';
}
function storyCharacterActivationPromote(candidateId) {
    if (!storyCharacterActivationEnabled()) return {
        ok: false, code: 'FEATURE_DISABLED', worldMutation: false
    };
    const id = String(candidateId || '');
    const ledger = storyCharacterActivationEnsure();
    const existing = ledger && ledger.promotions[id];
    if (existing) return {
        ok: true, code: 'PROMOTION_ALREADY_APPLIED', duplicate: true,
        promotion: storyCharacterActivationClone(existing), worldMutation: false
    };
    const view = storyCharacterActivationCandidates();
    const candidate = view.candidates.find(row => row.id === id);
    if (!candidate) return { ok: false, code: 'ACTIVATION_CANDIDATE_NOT_FOUND', worldMutation: false };
    if (!candidate.promotable) return {
        ok: false, code: 'ACTIVATION_LEVEL_TOO_LOW', level: candidate.level, worldMutation: false
    };
    const identityLedger = typeof storyCharacterIdentityEnsure === 'function'
        ? storyCharacterIdentityEnsure() : null;
    if (!identityLedger) return { ok: false, code: 'IDENTITY_LEDGER_UNAVAILABLE', worldMutation: false };
    const actorId = `character:activated:${storyCharacterActivationSafeToken(id)}`;
    if (identityLedger.identities[actorId]) return {
        ok: false, code: 'ACTIVATION_ACTOR_ID_CONFLICT', actorId, worldMutation: false
    };
    const role = storyCharacterActivationRole(candidate);
    const actor = storyCharacterIdentityCreate({
        id: actorId, countryId: candidate.countryId,
        name: storyCharacterStablePublicName(actorId), role,
        publicTitle: candidate.trigger.stage === 'UPRISING' ? 'Yerel Hareket Sözcüsü'
            : candidate.trigger.stage === 'STRIKE' ? 'İşçi Temsilcisi' : 'Topluluk Temsilcisi',
        originModel: 'PHASE_38_11_COHORT_PROMOTION'
    });
    actor.activationOrigin = {
        candidateId: candidate.id, cohortId: candidate.cohortId,
        regionId: candidate.regionId, sourceMovementId: candidate.trigger.movementId,
        populationAccounting: 'REPRESENTATIVE_INCLUDED_IN_COHORT',
        populationDelta: 0, version: 1
    };
    const promotedAt = Number(STORY.clock) || 0;
    const promotion = {
        id: `character-promotion:${ledger.sequence + 1}`,
        candidateId: candidate.id, actorId, cohortId: candidate.cohortId,
        regionId: candidate.regionId, countryId: candidate.countryId,
        sourceMovementId: candidate.trigger.movementId,
        level: candidate.level, scoreBps: candidate.scoreBps,
        populationAccounting: 'REPRESENTATIVE_INCLUDED_IN_COHORT',
        populationDelta: 0, promotedAt, status: 'ACTIVE', version: 1
    };
    identityLedger.identities[actorId] = actor;
    ledger.sequence++;
    ledger.promotions[candidate.id] = promotion;
    if (typeof storyMemoryAddMilestone === 'function') storyMemoryAddMilestone({
        id: `${promotion.id}:milestone`, kind: 'CAREER', subjectActorId: actorId,
        holderActorIds: [actorId], summary: `${actor.name}, ${candidate.trigger.problemType} hareketinde tanınan bir temsilci oldu.`,
        importanceBps: candidate.level === 'WORLD' ? 10000 : candidate.level === 'MAJOR' ? 9000 : 8000,
        createdAt: promotedAt,
        source: { sourceType: 'COHORT_PROMOTION', sourceId: promotion.id,
            movementId: promotion.sourceMovementId, cohortId: promotion.cohortId }
    });
    return {
        ok: true, code: 'NAMED_REPRESENTATIVE_PROMOTED', duplicate: false,
        actor: storyCharacterIdentityClone(actor), promotion: storyCharacterActivationClone(promotion),
        populationMutation: false, worldMutation: true
    };
}

function storyCharacterActivationRosterView() {
    if (!storyCharacterActivationEnabled()) return {
        ok: false, code: 'FEATURE_DISABLED', actors: [], worldMutation: false
    };
    const ledger = STORY.characterActivation
        || storyCharacterActivationLedgerCreate({ backfilled: true });
    const activeById = new Map(storyCharacterActivationCandidates().candidates
        .map(candidate => [candidate.id, candidate]));
    const identityLedger = typeof storyCharacterIdentityEnsure === 'function'
        ? storyCharacterIdentityEnsure() : null;
    const actors = Object.values(ledger && ledger.promotions || {})
        .sort((a, b) => a.actorId.localeCompare(b.actorId, 'en'))
        .map(promotion => {
            const active = activeById.get(promotion.candidateId) || null;
            const actor = identityLedger && identityLedger.identities[promotion.actorId];
            return {
                actorId: promotion.actorId, candidateId: promotion.candidateId,
                identityPresent: !!actor,
                sourceStatus: active ? 'ACTIVE_SOURCE' : 'DORMANT_SOURCE',
                effectiveLevel: active ? active.level : 'MINOR',
                promotedLevel: promotion.level,
                sourceMovementId: promotion.sourceMovementId,
                cohortId: promotion.cohortId,
                expensiveDecisionEligible: !!active && ['MAJOR', 'WORLD'].includes(active.level),
                identityDeletedWhenDormant: false,
                memoryDeletedWhenDormant: false,
                relationshipDeletedWhenDormant: false,
                worldMutation: false
            };
        });
    return {
        ok: true, code: 'ACTIVATED_CHARACTER_ROSTER', actors,
        canonicalLedgersReadOnly: true, worldMutation: false
    };
}

function storyCharacterActivationBudgetView() {
    const ledger = STORY.characterActivation
        || storyCharacterActivationLedgerCreate({ backfilled: true });
    const roster = storyCharacterActivationRosterView();
    const promotions = Object.values(ledger.promotions || {});
    const byCountry = {};
    for (const row of promotions) byCountry[row.countryId] = (byCountry[row.countryId] || 0) + 1;
    const highResolution = (roster.actors || []).filter(row => row.expensiveDecisionEligible).length;
    return {
        policy: storyCharacterActivationClone(STORY_CHARACTER_ACTIVATION_BUDGET),
        namedRepresentativeCount: promotions.length,
        countryCounts: byCountry,
        highResolutionActorCount: highResolution,
        remainingWorldSlots: Math.max(0,
            STORY_CHARACTER_ACTIVATION_BUDGET.worldNamedRepresentatives - promotions.length),
        remainingHighResolutionSlots: Math.max(0,
            STORY_CHARACTER_ACTIVATION_BUDGET.highResolutionActors - highResolution),
        llmEligibility: 'WORLD_ONLY_SEPARATE_REASONING_GATE_REQUIRED',
        worldMutation: false
    };
}
function storyCharacterActivationTick() {
    if (!storyCharacterActivationEnabled()) return {
        promotedCount: 0, code: 'FEATURE_DISABLED', worldMutation: false
    };
    const candidates = storyCharacterActivationCandidates().candidates
        .filter(row => row.promotable && !row.identityActorId);
    const promoted = [];
    const skipped = [];
    for (const candidate of candidates) {
        if (promoted.length >= STORY_CHARACTER_ACTIVATION_BUDGET.promotionsPerTick) break;
        const budget = storyCharacterActivationBudgetView();
        const countryCount = Number(budget.countryCounts[candidate.countryId]) || 0;
        if (budget.remainingWorldSlots <= 0) {
            skipped.push({ candidateId: candidate.id, reason: 'WORLD_NAMED_BUDGET_EXHAUSTED' });
            continue;
        }
        if (countryCount >= STORY_CHARACTER_ACTIVATION_BUDGET.countryNamedRepresentatives) {
            skipped.push({ candidateId: candidate.id, reason: 'COUNTRY_NAMED_BUDGET_EXHAUSTED' });
            continue;
        }
        if (['MAJOR', 'WORLD'].includes(candidate.level)
            && budget.remainingHighResolutionSlots <= 0) {
            skipped.push({ candidateId: candidate.id, reason: 'HIGH_RESOLUTION_BUDGET_EXHAUSTED' });
            continue;
        }
        const result = storyCharacterActivationPromote(candidate.id);
        if (result.ok && !result.duplicate) promoted.push(result.promotion);
        else skipped.push({ candidateId: candidate.id, reason: result.code });
    }
    return {
        promotedCount: promoted.length,
        promotionIds: promoted.map(row => row.id),
        skipped: skipped.slice(0, 32),
        evaluatedCandidateCount: candidates.length,
        promotionsPerTickCap: STORY_CHARACTER_ACTIVATION_BUDGET.promotionsPerTick,
        llmCalls: 0,
        code: promoted.length ? 'AUTOMATIC_PROMOTION_APPLIED' : 'NO_PROMOTION_APPLIED',
        worldMutation: promoted.length > 0
    };
}
