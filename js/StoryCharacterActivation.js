// ═══════════════════════════════════════════════════════════════════════════
//  KOHORTTAN KARAKTER AKTİVASYON POLİTİKASI — Faz 38.11
//  Bu ilk dikey isimli kişi yaratmaz. Yalnız gerçek nüfus kohortu ile gerçek
//  toplumsal olay kesişiminden deterministik aday görünümü üretir.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_CHARACTER_ACTIVATION_SCHEMA_VERSION = 1;
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
            candidates.push({
                id: `activation:${cohort.id}:${participation.movementId}`,
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
                identityActorId: null,
                promotionStatus: 'CANDIDATE_ONLY_NO_PERSON_CREATED',
                populationMutation: false, worldMutation: false
            });
        }
    }
    candidates.sort((a, b) => b.scoreBps - a.scoreBps || a.id.localeCompare(b.id, 'en'));
    return {
        ok: true, code: candidates.length ? 'ACTIVATION_CANDIDATES_READY' : 'NO_EVIDENCED_CANDIDATES',
        schemaVersion: STORY_CHARACTER_ACTIVATION_SCHEMA_VERSION,
        levels: STORY_CHARACTER_ACTIVATION_LEVELS.slice(), candidates,
        namedCharacterCreationAvailable: false,
        canonicalLedgersReadOnly: true, populationMutation: false, worldMutation: false
    };
}
