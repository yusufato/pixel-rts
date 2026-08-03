// ============================================================================
//  KOLEKTIF EYLEM, GREV VE RADIKALLESME — Faz 26
//  --------------------------------------------------------------------------
//  Faz 25'in aciklanabilir sikayet hafizasini asamali kolektif eyleme cevirir.
//  Bu katman yeni bir fiziksel gercek uydurmaz: sorun, etkilenen kisi, tekrar ve
//  sorumlu gorulen aktor daima publicOpinion defterinden gelir. LLM karar vermez.
//
//  Faz 28 orgutleri henuz yoktur. Bu nedenle orgutlenme kapasitesi acikca
//  COHORT_NETWORK_PROXY_PRE_PHASE_28 olarak etiketlenir; gercek sendika veya
//  gizli orgut sayisiymis gibi sunulmaz.
// ============================================================================

const STORY_COLLECTIVE_SCHEMA_VERSION = 1;
const STORY_COLLECTIVE_ADAPTER_VERSION = 'story-collective-action-ledger-1';
const STORY_COLLECTIVE_STAGES = Object.freeze(['NONE', 'PROTEST', 'STRIKE', 'UPRISING']);
const STORY_COLLECTIVE_RESPONSES = Object.freeze(['CONCEDE', 'NEGOTIATE', 'SUPPRESS', 'IGNORE']);
const STORY_COLLECTIVE_LABOR_PROBLEMS = Object.freeze(['income', 'employment']);
const STORY_COLLECTIVE_POLICY = Object.freeze({
    organizationModel: 'COHORT_NETWORK_PROXY_PRE_PHASE_28',
    mobilizationRiseRateBps: 1800,
    mobilizationDecayRateBps: 900,
    organizationRiseRateBps: 1200,
    organizationDecayRateBps: 500,
    radicalizationRiseRateBps: 700,
    radicalizationDecayRateBps: 360,
    protestStartBps: 6200,
    protestEndBps: 4600,
    protestAffectedShareBps: 1000,
    protestGateTicks: 3,
    strikeStartBps: 7300,
    strikeEndBps: 5600,
    strikeOrganizationBps: 5200,
    strikeAffectedShareBps: 1800,
    strikeGateTicks: 4,
    uprisingStartBps: 9300,
    uprisingEndBps: 6800,
    uprisingRadicalizationBps: 9000,
    uprisingAffectedShareBps: 2500,
    uprisingMinimumEpisodes: 2,
    uprisingGateTicks: 8,
    minimumStageTicks: Object.freeze({ PROTEST: 4, STRIKE: 8, UPRISING: 11 }),
    cooldownTicks: Object.freeze({ PROTEST: 6, STRIKE: 18, UPRISING: 30 }),
    playerResponseDeadlineTicks: 6,
    maximumActiveMovementsPerCountry: 1,
    maximumMovementsPerCountry: 12,
    maximumEvents: 256,
    maximumRegionParticipations: 4
});
const STORY_COLLECTIVE_POLICY_HASH = storyProductionHash({
    schemaVersion: STORY_COLLECTIVE_SCHEMA_VERSION,
    adapterVersion: STORY_COLLECTIVE_ADAPTER_VERSION,
    stages: STORY_COLLECTIVE_STAGES,
    responses: STORY_COLLECTIVE_RESPONSES,
    policy: STORY_COLLECTIVE_POLICY
});

function storyCollectiveEnabled() {
    return (typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('society.collectiveAction'))
        && (typeof storyOpinionEnabled !== 'function' || storyOpinionEnabled());
}

function storyCollectiveClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyCollectiveClampBps(value) {
    return Math.max(0, Math.min(10000, Math.round(Number(value) || 0)));
}

function storyCollectiveRound(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 1e6) / 1e6 : 0;
}

function storyCollectiveCountryId(value) {
    const raw = String(value == null ? '' : value);
    return raw.startsWith('country:') ? raw : `country:${Number(value)}`;
}

function storyCollectiveMovementId(countryId, problemType, actorId) {
    return `movement:${String(countryId)}|${String(problemType)}|${String(actorId)}`;
}

function storyCollectiveLerp(before, target, riseRate, decayRate) {
    const from = storyCollectiveClampBps(before);
    const to = storyCollectiveClampBps(target);
    if (from === to) return from;
    const rate = to > from ? riseRate : decayRate;
    const step = Math.max(1, Math.round(Math.abs(to - from) * rate / 10000));
    return to > from ? Math.min(to, from + step) : Math.max(to, from - step);
}

function storyCollectiveProblemOrganizationBase(problemType) {
    return ({
        income: 5600,
        employment: 5900,
        publicServices: 4700,
        food: 3900,
        energy: 4000,
        security: 3000
    })[problemType] || 3200;
}

function storyCollectiveSample(countryOpinion, issue, at, sourceOpinionTick, actionEligible) {
    const populationPeople = Math.max(0, Number(countryOpinion.populationPeople) || 0);
    const cohortCount = Math.max(1, Number(countryOpinion.cohortCount) || 1);
    const affectedPeople = Math.max(0, Math.round(Number(issue.affectedPeople) || 0));
    const activeCohorts = Math.max(0, Math.round(Number(issue.activeCohortCount) || 0));
    const recoveringCohorts = Math.max(0, Math.round(Number(issue.recoveringCohortCount) || 0));
    const issueCohorts = Math.max(1, activeCohorts + recoveringCohorts);
    const averageEpisodes = Math.max(0, (Number(issue.episodeCount) || 0) / issueCohorts);
    const affectedShareBps = populationPeople > 0
        ? storyCollectiveClampBps(affectedPeople * 10000 / populationPeople)
        : 0;
    const activeCohortShareBps = storyCollectiveClampBps(activeCohorts * 10000 / cohortCount);
    const recurrenceBps = storyCollectiveClampBps(Math.max(0, averageEpisodes - 1) * 1800);
    const organizationTargetBps = storyCollectiveClampBps(
        storyCollectiveProblemOrganizationBase(issue.problemType)
        + affectedShareBps * 0.22
        + activeCohortShareBps * 0.12
        + recurrenceBps * 0.08
    );
    return {
        id: storyCollectiveMovementId(countryOpinion.countryId, issue.problemType, issue.blamedActorId),
        countryId: String(countryOpinion.countryId),
        problemType: String(issue.problemType),
        blamedActorId: String(issue.blamedActorId),
        blamedActorKind: String(issue.blamedActorKind),
        blameBasisCode: String(issue.blameBasisCode),
        affectedPeople,
        affectedShareBps,
        activeCohortShareBps,
        severityBps: storyCollectiveClampBps(issue.severityBps),
        peakSeverityBps: storyCollectiveClampBps(issue.peakSeverityBps),
        averageEpisodesBps: storyCollectiveClampBps(averageEpisodes * 1000),
        recurrenceBps,
        organizationTargetBps,
        actionEligible: !!actionEligible,
        sourceOpinionTick: Math.max(0, Math.floor(Number(sourceOpinionTick) || 0)),
        at: storyCollectiveRound(at)
    };
}

function storyCollectiveEmptySample(movement, at, sourceOpinionTick) {
    return {
        id: movement.id,
        countryId: movement.countryId,
        problemType: movement.problemType,
        blamedActorId: movement.blamedActorId,
        blamedActorKind: movement.blamedActorKind,
        blameBasisCode: movement.blameBasisCode,
        affectedPeople: 0,
        affectedShareBps: 0,
        activeCohortShareBps: 0,
        severityBps: 0,
        peakSeverityBps: movement.peakSeverityBps,
        averageEpisodesBps: movement.averageEpisodesBps,
        recurrenceBps: 0,
        organizationTargetBps: 0,
        actionEligible: false,
        sourceOpinionTick,
        at
    };
}

function storyCollectiveStageRank(stage) {
    return STORY_COLLECTIVE_STAGES.indexOf(stage);
}

function storyCollectiveDesiredStage(movement) {
    if (!movement.actionEligible) return 'NONE';
    const gate = movement.gateTicks || {};
    if (
        movement.stage !== 'NONE'
        && movement.stageTicks >= 9
        && movement.mobilizationBps >= STORY_COLLECTIVE_POLICY.uprisingStartBps
        && movement.radicalizationBps >= STORY_COLLECTIVE_POLICY.uprisingRadicalizationBps
        && movement.affectedShareBps >= STORY_COLLECTIVE_POLICY.uprisingAffectedShareBps
        && movement.averageEpisodesBps >= STORY_COLLECTIVE_POLICY.uprisingMinimumEpisodes * 1000
        && gate.UPRISING >= STORY_COLLECTIVE_POLICY.uprisingGateTicks
    ) return 'UPRISING';
    if (
        movement.stage === 'PROTEST'
        && movement.stageTicks >= 5
        && [...STORY_COLLECTIVE_LABOR_PROBLEMS, 'publicServices'].includes(movement.problemType)
        && movement.mobilizationBps >= STORY_COLLECTIVE_POLICY.strikeStartBps
        && movement.organizationBps >= STORY_COLLECTIVE_POLICY.strikeOrganizationBps
        && movement.affectedShareBps >= STORY_COLLECTIVE_POLICY.strikeAffectedShareBps
        && gate.STRIKE >= STORY_COLLECTIVE_POLICY.strikeGateTicks
    ) return 'STRIKE';
    if (
        movement.mobilizationBps >= STORY_COLLECTIVE_POLICY.protestStartBps
        && movement.affectedShareBps >= STORY_COLLECTIVE_POLICY.protestAffectedShareBps
        && gate.PROTEST >= STORY_COLLECTIVE_POLICY.protestGateTicks
    ) return 'PROTEST';
    return 'NONE';
}

function storyCollectiveCanEndStage(movement) {
    const age = Math.max(0, Number(movement.stageTicks) || 0);
    const minimum = STORY_COLLECTIVE_POLICY.minimumStageTicks[movement.stage] || 0;
    if (age < minimum) return false;
    if (movement.stage === 'UPRISING') return movement.mobilizationBps < STORY_COLLECTIVE_POLICY.uprisingEndBps;
    if (movement.stage === 'STRIKE') return movement.mobilizationBps < STORY_COLLECTIVE_POLICY.strikeEndBps;
    if (movement.stage === 'PROTEST') return movement.mobilizationBps < STORY_COLLECTIVE_POLICY.protestEndBps;
    return false;
}

// Saf gecis: testler ayni sikayet dizisini dunya yan etkisi olmadan ilerletir.
function storyCollectiveAdvanceMovement(previous, sample) {
    const movement = previous ? storyCollectiveClone(previous) : {
        id: String(sample.id),
        countryId: String(sample.countryId),
        problemType: String(sample.problemType),
        blamedActorId: String(sample.blamedActorId),
        blamedActorKind: String(sample.blamedActorKind),
        blameBasisCode: String(sample.blameBasisCode),
        firstObservedAt: sample.at,
        lastObservedAt: null,
        lastUpdatedAt: sample.at,
        affectedPeople: 0,
        affectedShareBps: 0,
        activeCohortShareBps: 0,
        severityBps: 0,
        peakSeverityBps: 0,
        averageEpisodesBps: 0,
        organizationBps: 0,
        mobilizationBps: 0,
        radicalizationBps: 0,
        suppressionMemoryBps: 0,
        concessionTrustBps: 0,
        issueTicks: 0,
        calmTicks: 0,
        stage: 'NONE',
        stageSince: null,
        stageTicks: 0,
        cooldownUntilTick: 0,
        gateTicks: { PROTEST: 0, STRIKE: 0, UPRISING: 0 },
        actionCount: 0,
        pendingResponse: false,
        responseDeadlineTick: null,
        lastResponse: null,
        sourceOpinionTick: 0
    };
    const previousStage = movement.stage;
    movement.countryId = String(sample.countryId);
    movement.actionEligible = !!sample.actionEligible;
    movement.affectedPeople = Math.max(0, Math.round(Number(sample.affectedPeople) || 0));
    movement.affectedShareBps = storyCollectiveClampBps(sample.affectedShareBps);
    movement.activeCohortShareBps = storyCollectiveClampBps(sample.activeCohortShareBps);
    movement.severityBps = storyCollectiveClampBps(sample.severityBps);
    movement.peakSeverityBps = Math.max(
        storyCollectiveClampBps(movement.peakSeverityBps),
        storyCollectiveClampBps(sample.peakSeverityBps),
        movement.severityBps
    );
    movement.averageEpisodesBps = storyCollectiveClampBps(sample.averageEpisodesBps);
    movement.lastUpdatedAt = storyCollectiveRound(sample.at);
    movement.sourceOpinionTick = Math.max(0, Math.floor(Number(sample.sourceOpinionTick) || 0));
    if (movement.severityBps > 0) {
        movement.issueTicks++;
        movement.calmTicks = 0;
        movement.lastObservedAt = movement.lastUpdatedAt;
    } else {
        movement.calmTicks++;
    }

    movement.organizationBps = storyCollectiveLerp(
        movement.organizationBps,
        sample.organizationTargetBps,
        STORY_COLLECTIVE_POLICY.organizationRiseRateBps,
        STORY_COLLECTIVE_POLICY.organizationDecayRateBps
    );
    movement.suppressionMemoryBps = storyCollectiveLerp(
        movement.suppressionMemoryBps, 0, 0, 260
    );
    movement.concessionTrustBps = storyCollectiveLerp(
        movement.concessionTrustBps, 0, 0, 420
    );

    const persistenceBps = storyCollectiveClampBps(Math.max(0, movement.issueTicks - 2) * 240);
    const mobilizationTarget = storyCollectiveClampBps(
        movement.severityBps * 0.45
        + movement.affectedShareBps * 0.24
        + movement.organizationBps * 0.14
        + movement.activeCohortShareBps * 0.08
        + sample.recurrenceBps * 0.05
        + persistenceBps * 0.12
        + movement.suppressionMemoryBps * 0.10
        - movement.concessionTrustBps * 0.16
    );
    movement.mobilizationBps = storyCollectiveLerp(
        movement.mobilizationBps,
        mobilizationTarget,
        STORY_COLLECTIVE_POLICY.mobilizationRiseRateBps,
        STORY_COLLECTIVE_POLICY.mobilizationDecayRateBps
    );
    const radicalizationTarget = storyCollectiveClampBps(
        movement.severityBps * 0.34
        + sample.recurrenceBps * 0.16
        + Math.max(0, movement.mobilizationBps - 5500) * 0.55
        + persistenceBps * 0.18
        + movement.suppressionMemoryBps * 0.42
        - movement.concessionTrustBps * 0.26
    );
    movement.radicalizationBps = storyCollectiveLerp(
        movement.radicalizationBps,
        radicalizationTarget,
        STORY_COLLECTIVE_POLICY.radicalizationRiseRateBps,
        STORY_COLLECTIVE_POLICY.radicalizationDecayRateBps
    );

    movement.gateTicks.PROTEST = movement.mobilizationBps >= STORY_COLLECTIVE_POLICY.protestStartBps
        && movement.affectedShareBps >= STORY_COLLECTIVE_POLICY.protestAffectedShareBps
        ? movement.gateTicks.PROTEST + 1 : 0;
    movement.gateTicks.STRIKE = [...STORY_COLLECTIVE_LABOR_PROBLEMS, 'publicServices'].includes(movement.problemType)
        && movement.mobilizationBps >= STORY_COLLECTIVE_POLICY.strikeStartBps
        && movement.organizationBps >= STORY_COLLECTIVE_POLICY.strikeOrganizationBps
        && movement.affectedShareBps >= STORY_COLLECTIVE_POLICY.strikeAffectedShareBps
        ? movement.gateTicks.STRIKE + 1 : 0;
    movement.gateTicks.UPRISING = movement.mobilizationBps >= STORY_COLLECTIVE_POLICY.uprisingStartBps
        && movement.radicalizationBps >= STORY_COLLECTIVE_POLICY.uprisingRadicalizationBps
        && movement.affectedShareBps >= STORY_COLLECTIVE_POLICY.uprisingAffectedShareBps
        && movement.averageEpisodesBps >= STORY_COLLECTIVE_POLICY.uprisingMinimumEpisodes * 1000
        ? movement.gateTicks.UPRISING + 1 : 0;

    movement.stageTicks = movement.stage === 'NONE' ? 0 : movement.stageTicks + 1;
    let nextStage = movement.stage;
    const desired = storyCollectiveDesiredStage(movement);
    const currentRank = storyCollectiveStageRank(movement.stage);
    const desiredRank = storyCollectiveStageRank(desired);
    const tick = movement.sourceOpinionTick;
    if (movement.stage === 'NONE') {
        nextStage = desired !== 'NONE' && tick >= movement.cooldownUntilTick ? desired : 'NONE';
    } else if (desiredRank > currentRank) {
        nextStage = desired;
    } else if (storyCollectiveCanEndStage(movement)) {
        nextStage = 'NONE';
    }
    if (nextStage !== movement.stage) {
        if (nextStage === 'NONE') {
            movement.cooldownUntilTick = tick + (STORY_COLLECTIVE_POLICY.cooldownTicks[movement.stage] || 0);
            movement.pendingResponse = false;
            movement.responseDeadlineTick = null;
            movement.stageSince = null;
            movement.stageTicks = 0;
            movement.gateTicks = { PROTEST: 0, STRIKE: 0, UPRISING: 0 };
        } else {
            movement.stageSince = movement.lastUpdatedAt;
            movement.stageTicks = 0;
            movement.actionCount++;
            movement.pendingResponse = true;
            movement.responseDeadlineTick = tick + STORY_COLLECTIVE_POLICY.playerResponseDeadlineTicks;
        }
        movement.stage = nextStage;
    }
    movement.transition = nextStage !== previousStage
        ? { from: previousStage, to: nextStage, at: movement.lastUpdatedAt }
        : null;
    return movement;
}

function storyCollectiveApplyResponsePure(source, mode, at) {
    if (!source || !STORY_COLLECTIVE_RESPONSES.includes(mode)) return null;
    const movement = storyCollectiveClone(source);
    const beforeStage = movement.stage;
    if (mode === 'CONCEDE') {
        movement.concessionTrustBps = storyCollectiveClampBps(movement.concessionTrustBps + 2600);
        movement.radicalizationBps = storyCollectiveClampBps(movement.radicalizationBps - 1700);
        movement.mobilizationBps = storyCollectiveClampBps(movement.mobilizationBps - 1100);
        movement.stage = 'NONE';
        movement.cooldownUntilTick = movement.sourceOpinionTick + 8;
    } else if (mode === 'NEGOTIATE') {
        movement.concessionTrustBps = storyCollectiveClampBps(movement.concessionTrustBps + 1100);
        movement.radicalizationBps = storyCollectiveClampBps(movement.radicalizationBps - 600);
        movement.mobilizationBps = storyCollectiveClampBps(movement.mobilizationBps - 450);
    } else if (mode === 'SUPPRESS') {
        movement.suppressionMemoryBps = storyCollectiveClampBps(movement.suppressionMemoryBps + 2800);
        movement.radicalizationBps = storyCollectiveClampBps(movement.radicalizationBps + 2100);
        movement.mobilizationBps = storyCollectiveClampBps(movement.mobilizationBps - 1700);
        movement.stage = 'NONE';
        movement.cooldownUntilTick = movement.sourceOpinionTick + 6;
    }
    movement.pendingResponse = false;
    movement.responseDeadlineTick = null;
    movement.gateTicks = { PROTEST: 0, STRIKE: 0, UPRISING: 0 };
    movement.stageSince = movement.stage === 'NONE' ? null : movement.stageSince;
    movement.stageTicks = movement.stage === 'NONE' ? 0 : movement.stageTicks;
    movement.lastResponse = { mode, at: storyCollectiveRound(at), stageBefore: beforeStage };
    movement.transition = movement.stage !== beforeStage
        ? { from: beforeStage, to: movement.stage, at: storyCollectiveRound(at), response: mode }
        : null;
    return movement;
}

function storyCollectiveLedgerCreate(options) {
    options = options || {};
    return {
        schemaVersion: STORY_COLLECTIVE_SCHEMA_VERSION,
        adapterVersion: STORY_COLLECTIVE_ADAPTER_VERSION,
        policyHash: STORY_COLLECTIVE_POLICY_HASH,
        opinionPolicyHash: typeof STORY_OPINION_POLICY_HASH === 'string' ? STORY_OPINION_POLICY_HASH : null,
        tickSequence: 0,
        lastTickAt: null,
        sourceOpinionTick: 0,
        nextEventSequence: 1,
        movements: {},
        countries: {},
        regions: {},
        events: [],
        diagnostics: {
            backfilled: !!options.backfilled,
            restoredFromInvalidLedger: false,
            issues: [],
            warnings: options.backfilled
                ? ['Eski kayıtta kolektif eylem geçmişi yoktu; geçmiş uydurulmadı.']
                : [],
            organizationModel: STORY_COLLECTIVE_POLICY.organizationModel,
            legacyStrikeGateDisabled: true,
            directWelfareWrites: false,
            randomDecisions: false
        }
    };
}

function storyCollectiveRecordEvent(ledger, type, movement, extra) {
    const event = Object.assign({
        id: `collective-event:${ledger.nextEventSequence}`,
        sequence: ledger.nextEventSequence++,
        type: String(type),
        at: storyCollectiveRound(STORY.clock),
        movementId: movement ? movement.id : null,
        countryId: movement ? movement.countryId : null,
        problemType: movement ? movement.problemType : null,
        blamedActorId: movement ? movement.blamedActorId : null,
        stage: movement ? movement.stage : null
    }, extra || {});
    ledger.events.push(event);
    if (ledger.events.length > STORY_COLLECTIVE_POLICY.maximumEvents) {
        ledger.events.splice(0, ledger.events.length - STORY_COLLECTIVE_POLICY.maximumEvents);
    }
    return event;
}

function storyCollectiveCountrySummary(countryId, movements) {
    const rows = movements.filter(row => row.countryId === countryId)
        .sort((a, b) => storyCollectiveStageRank(b.stage) - storyCollectiveStageRank(a.stage)
            || b.mobilizationBps - a.mobilizationBps
            || a.id.localeCompare(b.id, 'en'));
    const active = rows.filter(row => row.stage !== 'NONE');
    return {
        countryId,
        movementCount: rows.length,
        activeActionCount: active.length,
        protestCount: active.filter(row => row.stage === 'PROTEST').length,
        strikeCount: active.filter(row => row.stage === 'STRIKE').length,
        uprisingCount: active.filter(row => row.stage === 'UPRISING').length,
        pendingResponseCount: rows.filter(row => row.pendingResponse).length,
        maximumMobilizationBps: rows.reduce((max, row) => Math.max(max, row.mobilizationBps), 0),
        maximumRadicalizationBps: rows.reduce((max, row) => Math.max(max, row.radicalizationBps), 0),
        productionMultiplierBps: active.some(row => row.stage === 'UPRISING')
            ? 3000 : (active.some(row => row.stage === 'STRIKE')
                ? 4500 : (active.some(row => row.stage === 'PROTEST') ? 9800 : 10000)),
        unrestContribution: active.reduce((sum, row) => sum + ({ PROTEST: 2, STRIKE: 7, UPRISING: 15 })[row.stage], 0),
        movementIds: rows.map(row => row.id)
    };
}

function storyCollectiveRegionSummaries(opinion, movements) {
    const out = {};
    for (const [regionId, region] of Object.entries(opinion.regions || {})) {
        const countryMovements = movements.filter(row => row.countryId === region.countryId);
        const byKey = new Map(countryMovements.map(row => [`${row.problemType}|${row.blamedActorId}`, row]));
        const participations = (region.topIssues || []).map(issue => {
            const movement = byKey.get(`${issue.problemType}|${issue.blamedActorId}`);
            if (!movement) return null;
            return {
                movementId: movement.id,
                problemType: movement.problemType,
                blamedActorId: movement.blamedActorId,
                localSeverityBps: storyCollectiveClampBps(issue.severityBps),
                localAffectedPeople: Math.max(0, Math.round(Number(issue.affectedPeople) || 0)),
                stage: movement.stage,
                mobilizationBps: movement.mobilizationBps,
                radicalizationBps: movement.radicalizationBps
            };
        }).filter(Boolean).sort((a, b) => storyCollectiveStageRank(b.stage) - storyCollectiveStageRank(a.stage)
            || b.localSeverityBps - a.localSeverityBps)
            .slice(0, STORY_COLLECTIVE_POLICY.maximumRegionParticipations);
        out[regionId] = {
            regionId,
            countryId: region.countryId,
            activeActionCount: participations.filter(row => row.stage !== 'NONE').length,
            participations
        };
    }
    return out;
}

function storyCollectiveBuildSummaries(ledger, opinion) {
    const movements = Object.values(ledger.movements || {});
    const countries = {};
    for (const state of (STORY.states || [])) {
        const countryId = `country:${state.id}`;
        countries[countryId] = storyCollectiveCountrySummary(countryId, movements);
    }
    ledger.countries = countries;
    ledger.regions = storyCollectiveRegionSummaries(opinion, movements);
}

function storyCollectiveValidate(ledger) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) {
        return { ok: false, issues: [{ code: 'COLLECTIVE_LEDGER_REQUIRED', path: '$', message: 'Kolektif eylem defteri zorunlu.' }] };
    }
    if (ledger.schemaVersion !== STORY_COLLECTIVE_SCHEMA_VERSION) add('COLLECTIVE_SCHEMA_VERSION', '$.schemaVersion', 'Kolektif eylem şeması uyuşmuyor.');
    if (ledger.adapterVersion !== STORY_COLLECTIVE_ADAPTER_VERSION) add('COLLECTIVE_ADAPTER_VERSION', '$.adapterVersion', 'Kolektif eylem adaptörü uyuşmuyor.');
    if (ledger.policyHash !== STORY_COLLECTIVE_POLICY_HASH) add('COLLECTIVE_POLICY_HASH', '$.policyHash', 'Kolektif eylem politikası uyuşmuyor.');
    if (!Number.isInteger(ledger.tickSequence) || ledger.tickSequence < 0) add('COLLECTIVE_TICK_SEQUENCE', '$.tickSequence', 'Tik sayacı geçersiz.');
    if (!ledger.movements || typeof ledger.movements !== 'object') add('COLLECTIVE_MOVEMENTS', '$.movements', 'Hareket sözlüğü zorunlu.');
    const perCountry = {};
    const activePerCountry = {};
    const knownCountries = new Set((STORY.states || []).map(state => `country:${state.id}`));
    for (const [id, movement] of Object.entries(ledger.movements || {})) {
        const path = `$.movements.${id}`;
        if (movement.id !== id) add('COLLECTIVE_MOVEMENT_ID', `${path}.id`, 'Hareket kimliği anahtarla uyuşmuyor.');
        if (!STORY_COLLECTIVE_STAGES.includes(movement.stage)) add('COLLECTIVE_STAGE', `${path}.stage`, 'Eylem aşaması geçersiz.');
        if (!/^country:-?\d+$/.test(String(movement.countryId || ''))) add('COLLECTIVE_COUNTRY_ID', `${path}.countryId`, 'Ülke kimliği geçersiz.');
        else if (!knownCountries.has(movement.countryId)) add('COLLECTIVE_COUNTRY_REFERENCE', `${path}.countryId`, 'Hareket bilinmeyen ülkeye bağlı.');
        if (typeof STORY_OPINION_PROBLEMS !== 'undefined' && !STORY_OPINION_PROBLEMS.includes(movement.problemType)) {
            add('COLLECTIVE_PROBLEM_TYPE', `${path}.problemType`, 'Hareket bilinmeyen sorun türüne bağlı.');
        }
        if (typeof storyOpinionActorExists === 'function' && !storyOpinionActorExists(movement.blamedActorId)) {
            add('COLLECTIVE_ACTOR_REFERENCE', `${path}.blamedActorId`, 'Hareket bilinmeyen aktörü suçluyor.');
        }
        for (const field of ['affectedShareBps', 'severityBps', 'peakSeverityBps', 'organizationBps', 'mobilizationBps', 'radicalizationBps', 'suppressionMemoryBps', 'concessionTrustBps']) {
            if (!Number.isInteger(movement[field]) || movement[field] < 0 || movement[field] > 10000) {
                add('COLLECTIVE_BPS_RANGE', `${path}.${field}`, 'Kolektif eylem baz puanı 0–10.000 tamsayı olmalı.');
            }
        }
        if (movement.pendingResponse && movement.stage === 'NONE') add('COLLECTIVE_PENDING_WITHOUT_ACTION', path, 'Eylemsiz hareket yanıt bekleyemez.');
        if (typeof movement.actionEligible !== 'boolean') add('COLLECTIVE_ACTION_ELIGIBILITY', `${path}.actionEligible`, 'Eylem uygunluğu boolean olmalı.');
        if (movement.lastResponse && !STORY_COLLECTIVE_RESPONSES.includes(movement.lastResponse.mode)) {
            add('COLLECTIVE_RESPONSE_MODE', `${path}.lastResponse.mode`, 'Hareket yanıt türü geçersiz.');
        }
        perCountry[movement.countryId] = (perCountry[movement.countryId] || 0) + 1;
        if (movement.stage !== 'NONE') activePerCountry[movement.countryId] = (activePerCountry[movement.countryId] || 0) + 1;
    }
    for (const [countryId, count] of Object.entries(perCountry)) {
        if (count > STORY_COLLECTIVE_POLICY.maximumMovementsPerCountry) add('COLLECTIVE_COUNTRY_MOVEMENT_LIMIT', `$.countries.${countryId}`, 'Ülke hareket bütçesi aşıldı.');
    }
    for (const [countryId, count] of Object.entries(activePerCountry)) {
        if (count > STORY_COLLECTIVE_POLICY.maximumActiveMovementsPerCountry) add('COLLECTIVE_ACTIVE_MOVEMENT_LIMIT', `$.countries.${countryId}`, 'Ülke aynı anda eylem dikkat bütçesini aşıyor.');
    }
    if (!Array.isArray(ledger.events) || ledger.events.length > STORY_COLLECTIVE_POLICY.maximumEvents) {
        add('COLLECTIVE_EVENT_LIMIT', '$.events', 'Kolektif eylem olay bütçesi aşıldı.');
    }
    for (const [countryId, summary] of Object.entries(ledger.countries || {})) {
        if (summary.countryId !== countryId) add('COLLECTIVE_COUNTRY_SUMMARY_ID', `$.countries.${countryId}`, 'Ülke özeti kimliği uyuşmuyor.');
        if (!Number.isInteger(summary.productionMultiplierBps) || summary.productionMultiplierBps < 0 || summary.productionMultiplierBps > 10000) {
            add('COLLECTIVE_PRODUCTION_MULTIPLIER', `$.countries.${countryId}.productionMultiplierBps`, 'Üretim çarpanı geçersiz.');
        }
    }
    const opinion = STORY.publicOpinion;
    if (opinion && ledger.countries && ledger.regions) {
        const expected = storyCollectiveClone(ledger);
        storyCollectiveBuildSummaries(expected, opinion);
        if (JSON.stringify(expected.countries) !== JSON.stringify(ledger.countries)) {
            add('COLLECTIVE_COUNTRY_AGGREGATE', '$.countries', 'Ülke eylem özeti hareketlerden türemeli.');
        }
        if (JSON.stringify(expected.regions) !== JSON.stringify(ledger.regions)) {
            add('COLLECTIVE_REGION_AGGREGATE', '$.regions', 'Bölge eylem özeti kamuoyu ve hareketlerden türemeli.');
        }
    }
    return { ok: issues.length === 0, issues };
}

function storyCollectiveReset(options) {
    if (!storyCollectiveEnabled()) { STORY.collectiveAction = null; return null; }
    STORY.collectiveAction = storyCollectiveLedgerCreate(options);
    const opinion = typeof storyOpinionEnsure === 'function' ? storyOpinionEnsure() : null;
    if (opinion) storyCollectiveBuildSummaries(STORY.collectiveAction, opinion);
    return STORY.collectiveAction;
}

function storyCollectiveRestore(saved) {
    if (!storyCollectiveEnabled()) { STORY.collectiveAction = null; return null; }
    if (!saved) return storyCollectiveReset({ backfilled: true });
    const candidate = storyCollectiveClone(saved);
    const validation = storyCollectiveValidate(candidate);
    if (!validation.ok) {
        const ledger = storyCollectiveLedgerCreate({ backfilled: true });
        ledger.diagnostics.restoredFromInvalidLedger = true;
        ledger.diagnostics.issues = validation.issues.slice(0, 50);
        ledger.diagnostics.warnings.push('Bozuk kolektif eylem defteri kullanılmadı; dünya korunarak eylem geçmişi boş başlatıldı.');
        const opinion = typeof storyOpinionEnsure === 'function' ? storyOpinionEnsure() : null;
        if (opinion) storyCollectiveBuildSummaries(ledger, opinion);
        STORY.collectiveAction = ledger;
        return ledger;
    }
    STORY.collectiveAction = candidate;
    return candidate;
}

function storyCollectiveEnsure() {
    if (!storyCollectiveEnabled()) return null;
    return STORY.collectiveAction || storyCollectiveReset({ backfilled: true });
}

function storyCollectiveForSave() {
    const ledger = storyCollectiveEnsure();
    if (!ledger) return null;
    const validation = storyCollectiveValidate(ledger);
    ledger.diagnostics.issues = validation.ok ? [] : validation.issues.slice(0, 50);
    if (!validation.ok) throw new Error(`Geçersiz kolektif eylem defteri: ${validation.issues[0].code}`);
    return storyCollectiveClone(ledger);
}

function storyCollectiveStateForCountry(countryId) {
    const stateId = Number(String(countryId || '').split(':')[1]);
    return typeof storyState === 'function' ? storyState(stateId) : null;
}

function storyCollectiveAIResponseMode(movement) {
    const state = storyCollectiveStateForCountry(movement.countryId);
    const axes = state && state.gov && state.gov.president && state.gov.president.axes || {};
    if ((Number(axes.auth) || 50) >= 67) return 'SUPPRESS';
    if ((Number(axes.pop) || 50) >= 62) return 'CONCEDE';
    return 'NEGOTIATE';
}

function storyCollectiveResponseDeltas(mode) {
    if (mode === 'CONCEDE') return { workers: 3, intel: 1, business: -1 };
    if (mode === 'NEGOTIATE') return { workers: 1, intel: 1 };
    if (mode === 'SUPPRESS') return { workers: -3, intel: -3, military: 2, radicals: 4 };
    return { workers: -1, radicals: 1 };
}

function storyCollectiveRespond(movementId, mode, options) {
    options = options || {};
    const ledger = storyCollectiveEnsure();
    if (!ledger || !STORY_COLLECTIVE_RESPONSES.includes(mode)) return { ok: false, code: 'INVALID_RESPONSE' };
    const current = ledger.movements[String(movementId)];
    if (!current || !current.pendingResponse) return { ok: false, code: 'NO_PENDING_ACTION' };
    const updated = storyCollectiveApplyResponsePure(current, mode, STORY.clock);
    storyCollectiveRecordEvent(ledger, 'RESPONSE_APPLIED', updated, {
        responseMode: mode,
        actor: options.actor || 'SYSTEM'
    });
    updated.transition = null;
    ledger.movements[updated.id] = updated;
    const state = storyCollectiveStateForCountry(updated.countryId);
    if (state && typeof storyFacApply === 'function') {
        storyFacApply(state, storyCollectiveResponseDeltas(mode), `Toplumsal yanıt: ${mode}`);
    }
    const opinion = typeof storyOpinionEnsure === 'function' ? storyOpinionEnsure() : null;
    if (opinion) storyCollectiveBuildSummaries(ledger, opinion);
    return { ok: true, movement: storyCollectiveClone(updated) };
}

function storyCollectiveNotice(movement) {
    const state = storyCollectiveStateForCountry(movement.countryId);
    if (!state || !state.isPlayer || typeof storyFactionNotice !== 'function') return;
    const label = ({ PROTEST: 'PROTESTO BAŞLADI', STRIKE: 'GENEL GREV BAŞLADI', UPRISING: 'AYAKLANMA BAŞLADI' })[movement.stage];
    if (!label) return;
    storyFactionNotice({
        id: `collective-${movement.actionCount}-${movement.id}`,
        key: `collective-${movement.stage.toLowerCase()}`,
        severity: movement.stage === 'UPRISING' ? 'critical' : 'high',
        title: label,
        summary: `${movement.problemType} şikâyeti ${Math.round(movement.affectedShareBps / 100)}% toplumsal kapsama ulaştı; ${typeof storyOpinionActorLabel === 'function' ? storyOpinionActorLabel(movement.blamedActorId) : movement.blamedActorId} sorumlu görülüyor.`,
        consequence: `Seferberlik %${Math.round(movement.mobilizationBps / 100)}, radikalleşme %${Math.round(movement.radicalizationBps / 100)}. Yanıt verilmezse hareket kendi kanıt zincirine göre gelişir.`,
        deltas: {},
        collectiveActionId: movement.id,
        responseOptions: STORY_COLLECTIVE_RESPONSES.slice()
    });
}

function storyCollectiveReissuePendingNotices() {
    const ledger = storyCollectiveEnsure();
    if (!ledger) return 0;
    let count = 0;
    for (const movement of Object.values(ledger.movements || {})) {
        const state = storyCollectiveStateForCountry(movement.countryId);
        if (!movement.pendingResponse || !state || !state.isPlayer) continue;
        storyCollectiveNotice(movement);
        count++;
    }
    return count;
}

function storyCollectiveApplyRuntimeEffects(ledger) {
    for (const state of (STORY.states || [])) {
        const summary = ledger.countries[`country:${state.id}`];
        if (!summary) continue;
        if (summary.uprisingCount > 0) {
            state._uprisingUntil = Math.max(Number(state._uprisingUntil) || 0, (Number(STORY.clock) || 0) + 10);
            state._strikeUntil = Math.max(Number(state._strikeUntil) || 0, (Number(STORY.clock) || 0) + 10);
        } else if (summary.strikeCount > 0) {
            state._strikeUntil = Math.max(Number(state._strikeUntil) || 0, (Number(STORY.clock) || 0) + 10);
        }
    }
}

function storyCollectiveTick() {
    if (!storyCollectiveEnabled()) return { disabled: true, movementCount: 0 };
    const ledger = STORY.collectiveAction || storyCollectiveReset({ backfilled: true });
    const opinion = typeof storyOpinionEnsure === 'function' ? storyOpinionEnsure() : null;
    if (!ledger || !opinion) return { disabled: true, movementCount: 0 };
    const at = Number(STORY.clock) || 0;
    const samples = new Map();
    for (const country of Object.values(opinion.countries || {})) {
        const active = Object.values(ledger.movements || {}).filter(movement => (
            movement.countryId === country.countryId && movement.stage !== 'NONE'
        )).sort((a, b) => storyCollectiveStageRank(b.stage) - storyCollectiveStageRank(a.stage)
            || b.mobilizationBps - a.mobilizationBps
            || a.id.localeCompare(b.id, 'en'))[0];
        const topIssue = (country.topIssues || [])[0] || null;
        const preferredId = active ? active.id : (topIssue
            ? storyCollectiveMovementId(country.countryId, topIssue.problemType, topIssue.blamedActorId)
            : null);
        for (const issue of country.topIssues || []) {
            const candidateId = storyCollectiveMovementId(country.countryId, issue.problemType, issue.blamedActorId);
            const sample = storyCollectiveSample(
                country, issue, at, opinion.tickSequence, candidateId === preferredId
            );
            samples.set(sample.id, sample);
        }
    }
    const next = {};
    const ids = [...new Set([...Object.keys(ledger.movements || {}), ...samples.keys()])].sort();
    for (const id of ids) {
        const previous = ledger.movements[id] || null;
        const sample = samples.get(id) || storyCollectiveEmptySample(previous, at, opinion.tickSequence);
        const movement = storyCollectiveAdvanceMovement(previous, sample);
        if (movement.stage === 'NONE' && movement.mobilizationBps <= 0 && movement.radicalizationBps <= 0
            && movement.organizationBps <= 0 && movement.severityBps <= 0) continue;
        if (movement.transition) {
            storyCollectiveRecordEvent(ledger,
                movement.transition.to === 'NONE' ? 'ACTION_ENDED' : 'ACTION_STARTED',
                movement,
                { fromStage: movement.transition.from, toStage: movement.transition.to }
            );
            if (movement.transition.to !== 'NONE') storyCollectiveNotice(movement);
        }
        movement.transition = null;
        next[id] = movement;
    }
    // En fazla 12 hareket/ulke. Siralama toplumsal agirlik, sonra kalici kimlik.
    const grouped = {};
    for (const movement of Object.values(next)) {
        if (!grouped[movement.countryId]) grouped[movement.countryId] = [];
        grouped[movement.countryId].push(movement);
    }
    ledger.movements = {};
    for (const countryId of Object.keys(grouped).sort()) {
        grouped[countryId].sort((a, b) => storyCollectiveStageRank(b.stage) - storyCollectiveStageRank(a.stage)
            || (b.mobilizationBps * b.affectedPeople) - (a.mobilizationBps * a.affectedPeople)
            || a.id.localeCompare(b.id, 'en'));
        for (const movement of grouped[countryId].slice(0, STORY_COLLECTIVE_POLICY.maximumMovementsPerCountry)) {
            ledger.movements[movement.id] = movement;
        }
    }
    ledger.tickSequence++;
    ledger.lastTickAt = storyCollectiveRound(at);
    ledger.sourceOpinionTick = opinion.tickSequence;
    storyCollectiveBuildSummaries(ledger, opinion);

    // AI devletleri ayni mekanik cevaplardan birini lider eksenleriyle secer.
    // Oyuncu icin pencere acik kalir; sure dolarsa IGNORE uygulanir.
    for (const movement of Object.values(ledger.movements)) {
        if (!movement.pendingResponse) continue;
        const state = storyCollectiveStateForCountry(movement.countryId);
        if (state && !state.isPlayer) {
            storyCollectiveRespond(movement.id, storyCollectiveAIResponseMode(movement), { actor: 'AI_GOVERNMENT' });
        } else if (opinion.tickSequence >= movement.responseDeadlineTick) {
            storyCollectiveRespond(movement.id, 'IGNORE', { actor: 'PLAYER_TIMEOUT' });
            if (typeof storyFactionNoticeExpireCollective === 'function') {
                storyFactionNoticeExpireCollective(movement.id);
            }
        }
    }
    storyCollectiveBuildSummaries(ledger, opinion);
    storyCollectiveApplyRuntimeEffects(ledger);
    return {
        disabled: false,
        tickSequence: ledger.tickSequence,
        movementCount: Object.keys(ledger.movements).length,
        activeActionCount: Object.values(ledger.movements).filter(row => row.stage !== 'NONE').length
    };
}

function storyCollectiveCountryView(countryId) {
    const ledger = storyCollectiveEnsure();
    const id = storyCollectiveCountryId(countryId);
    if (!ledger || !ledger.countries[id]) return null;
    const summary = storyCollectiveClone(ledger.countries[id]);
    summary.movements = summary.movementIds.map(movementId => storyCollectiveClone(ledger.movements[movementId])).filter(Boolean);
    delete summary.movementIds;
    return summary;
}

function storyCollectiveRegionView(regionId) {
    const ledger = storyCollectiveEnsure();
    const id = String(regionId).startsWith('region:') ? String(regionId) : `region:${Number(regionId)}`;
    return ledger && ledger.regions[id] ? storyCollectiveClone(ledger.regions[id]) : null;
}

function storyCollectiveCountryProductionMultiplier(countryId) {
    const ledger = storyCollectiveEnsure();
    const summary = ledger && ledger.countries[storyCollectiveCountryId(countryId)];
    return summary ? summary.productionMultiplierBps / 10000 : 1;
}

function storyCollectiveCountryUnrest(countryId) {
    const ledger = storyCollectiveEnsure();
    const summary = ledger && ledger.countries[storyCollectiveCountryId(countryId)];
    return summary ? Math.max(0, Number(summary.unrestContribution) || 0) : 0;
}

function storyCollectiveSummary() {
    const ledger = storyCollectiveEnsure();
    if (!ledger) return {
        schemaVersion: STORY_COLLECTIVE_SCHEMA_VERSION,
        adapterVersion: STORY_COLLECTIVE_ADAPTER_VERSION,
        disabled: true,
        movementCount: 0,
        activeActionCount: 0
    };
    const movements = Object.values(ledger.movements || {});
    return {
        schemaVersion: ledger.schemaVersion,
        adapterVersion: ledger.adapterVersion,
        policyHash: ledger.policyHash,
        disabled: false,
        tickSequence: ledger.tickSequence,
        movementCount: movements.length,
        activeActionCount: movements.filter(row => row.stage !== 'NONE').length,
        protestCount: movements.filter(row => row.stage === 'PROTEST').length,
        strikeCount: movements.filter(row => row.stage === 'STRIKE').length,
        uprisingCount: movements.filter(row => row.stage === 'UPRISING').length,
        pendingResponseCount: movements.filter(row => row.pendingResponse).length,
        eventCount: ledger.events.length,
        averageMobilizationBps: movements.length
            ? storyCollectiveClampBps(movements.reduce((sum, row) => sum + row.mobilizationBps, 0) / movements.length)
            : 0,
        averageRadicalizationBps: movements.length
            ? storyCollectiveClampBps(movements.reduce((sum, row) => sum + row.radicalizationBps, 0) / movements.length)
            : 0,
        diagnostics: storyCollectiveClone(ledger.diagnostics)
    };
}
