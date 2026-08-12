// ============================================================================
//  DARBE, BOLUNME VE IC CATISMA — Faz 33
//  --------------------------------------------------------------------------
//  Darbe tek esikli bir zar degildir. Memnuniyetsiz kanonik aktorler once
//  hazirlik yapar, koalisyon kurar, devlet karsi hamle gelistirir ve sonuc
//  kayitli guc iliskisinden deterministik olarak dogar. LLM ve RNG karar vermez.
// ============================================================================

const STORY_POLITICAL_CRISIS_SCHEMA_VERSION = 1;
const STORY_POLITICAL_CRISIS_ADAPTER_VERSION = 'story-political-crisis-ledger-1';
const STORY_POLITICAL_CRISIS_STATUSES = Object.freeze([
    'ORGANIZING', 'COALITION', 'ULTIMATUM', 'ATTEMPT',
    'FAILED', 'SUCCESS', 'SPLIT', 'DISSOLVED'
]);
const STORY_POLITICAL_CRISIS_TERMINAL_STATUSES = Object.freeze([
    'FAILED', 'SUCCESS', 'SPLIT', 'DISSOLVED'
]);
const STORY_POLITICAL_CRISIS_ACTIONS = Object.freeze({
    NEGOTIATE: Object.freeze({ pointCost: 25, cooldownSeconds: 14 }),
    SECURE_COMMAND: Object.freeze({ pointCost: 45, cooldownSeconds: 18 }),
    PUBLIC_ACCOUNT: Object.freeze({ reputationCost: 2, cooldownSeconds: 20 }),
    WAIT_AND_WATCH: Object.freeze({ cooldownSeconds: 8 })
});
const STORY_POLITICAL_CRISIS_POLICY = Object.freeze({
    minimumPlotters: 2,
    plotterLoyaltyBelow: 48,
    loyalistLoyaltyAtLeast: 68,
    openRiskBps: 3500,
    coalitionPreparationBps: 2800,
    ultimatumPreparationBps: 6200,
    attemptPreparationBps: 9000,
    publicKnowledgeBps: 1800,
    successScoreBps: 4000,
    splitControlBps: 3500,
    failureCooldownSeconds: 60,
    maximumCrises: 160,
    maximumEvents: 800,
    maximumActionsPerCrisis: 80,
    maximumAIActionsPerCrisis: 1,
    outcomeModel: 'DETERMINISTIC_PREPARATION_COALITION_COUNTERACTION_V1',
    regionalControlModel: 'RECORDED_CONTESTED_CONTROL_NO_FAKE_ANNEXATION_V1',
    randomOutcome: false,
    llmOutcome: false
});
const STORY_POLITICAL_CRISIS_POLICY_HASH = storyProductionHash({
    schemaVersion: STORY_POLITICAL_CRISIS_SCHEMA_VERSION,
    adapterVersion: STORY_POLITICAL_CRISIS_ADAPTER_VERSION,
    policy: STORY_POLITICAL_CRISIS_POLICY
});

function storyPoliticalCrisisEnabled() {
    return (typeof storyFeatureEnabled !== 'function' || storyFeatureEnabled('government.politicalCrisis'))
        && (typeof storyPowerCenterEnabled !== 'function' || storyPowerCenterEnabled())
        && (typeof storyInstitutionEnabled !== 'function' || storyInstitutionEnabled())
        && (typeof storyStateCapacityEnabled !== 'function' || storyStateCapacityEnabled())
        && (typeof storyElectionEnabled !== 'function' || storyElectionEnabled())
        && (typeof storyIntegrityEnabled !== 'function' || storyIntegrityEnabled());
}
function storyPoliticalCrisisClone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function storyPoliticalCrisisRound(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 1e6) / 1e6 : 0;
}
function storyPoliticalCrisisClampBps(value) {
    return Math.max(0, Math.min(10000, Math.round(Number(value) || 0)));
}
function storyPoliticalCrisisCountryId(value) {
    if (typeof value === 'string' && /^country:\d+$/.test(value)) return value;
    if (value && value.id != null) return `country:${Number(value.id)}`;
    const match = String(value == null ? '' : value).match(/(?:country:)?(\d+)/);
    return match ? `country:${Number(match[1])}` : null;
}
function storyPoliticalCrisisState(countryId) {
    const id = storyPoliticalCrisisCountryId(countryId);
    if (!id) return null;
    const stateId = Number(id.split(':')[1]);
    return (STORY.states || []).find(row => Number(row.id) === stateId) || null;
}
function storyPoliticalCrisisActorId(stateId, commander) {
    return commander && commander.id != null ? `character:${Number(stateId)}:${Number(commander.id)}` : null;
}
function storyPoliticalCrisisActor(state, actorId) {
    if (!state || !actorId) return null;
    return (typeof storyStateCommanders === 'function' ? storyStateCommanders(state) : ((state.gov && state.gov.commanders) || []))
        .find(row => storyPoliticalCrisisActorId(state.id, row) === actorId) || null;
}
function storyPoliticalCrisisActorName(state, actorId) {
    const actor = storyPoliticalCrisisActor(state, actorId);
    return actor ? String(actor.name || 'Isimsiz aktor') : 'Bilinmeyen aktor';
}
function storyPoliticalCrisisCountryRow(countryId) {
    return {
        countryId,
        activeCrisisId: null,
        crisisIds: [],
        lastAssessmentAt: null,
        nextCrisisAllowedAt: 0,
        lastResolvedAt: null
    };
}
function storyPoliticalCrisisLedgerCreate(options) {
    options = options || {};
    const countries = {};
    for (const state of (STORY.states || [])) {
        const countryId = storyPoliticalCrisisCountryId(state.id);
        countries[countryId] = storyPoliticalCrisisCountryRow(countryId);
    }
    return {
        schemaVersion: STORY_POLITICAL_CRISIS_SCHEMA_VERSION,
        adapterVersion: STORY_POLITICAL_CRISIS_ADAPTER_VERSION,
        policyHash: STORY_POLITICAL_CRISIS_POLICY_HASH,
        tickSequence: 0,
        nextCrisisSequence: 1,
        nextEventSequence: 1,
        createdAt: storyPoliticalCrisisRound(STORY.clock),
        lastTickAt: null,
        countries,
        crises: {},
        events: [],
        diagnostics: {
            backfilled: !!options.backfilled,
            restoredFromInvalidLedger: !!options.restoredFromInvalidLedger,
            issues: storyPoliticalCrisisClone(options.issues || []),
            warnings: []
        }
    };
}
function storyPoliticalCrisisRecordEvent(ledger, type, crisis, extra) {
    const event = Object.assign({
        id: `political-crisis-event:${ledger.nextEventSequence}`,
        sequence: ledger.nextEventSequence++,
        type: String(type),
        at: storyPoliticalCrisisRound(STORY.clock),
        crisisId: crisis ? crisis.id : null,
        countryId: crisis ? crisis.countryId : null
    }, storyPoliticalCrisisClone(extra || {}));
    ledger.events.push(event);
    if (ledger.events.length > STORY_POLITICAL_CRISIS_POLICY.maximumEvents) {
        ledger.events.splice(0, ledger.events.length - STORY_POLITICAL_CRISIS_POLICY.maximumEvents);
    }
    return event;
}
function storyPoliticalCrisisPowerCenter(countryId, type) {
    const view = typeof storyPowerCenterCountryView === 'function'
        ? storyPowerCenterCountryView(countryId) : null;
    return view && (view.centers || []).find(row => row.type === type) || null;
}
function storyPoliticalCrisisAssessment(state) {
    const countryId = storyPoliticalCrisisCountryId(state.id);
    const commanders = ((state.gov && state.gov.commanders) || []).filter(row => !row.isPlayer);
    const loyaltyOf = row => storyPoliticalCrisisClampBps((row.loyalty == null ? 60 : row.loyalty) * 100) / 100;
    const plotters = commanders.filter(row => loyaltyOf(row) < STORY_POLITICAL_CRISIS_POLICY.plotterLoyaltyBelow)
        .sort((a, b) => loyaltyOf(a) - loyaltyOf(b) || Number(a.id) - Number(b.id));
    const loyalists = commanders.filter(row => row._sworn || loyaltyOf(row) >= STORY_POLITICAL_CRISIS_POLICY.loyalistLoyaltyAtLeast)
        .sort((a, b) => Number(!!b._sworn) - Number(!!a._sworn) || loyaltyOf(b) - loyaltyOf(a) || Number(a.id) - Number(b.id));
    const avgPlotterLoyalty = plotters.length
        ? plotters.reduce((sum, row) => sum + loyaltyOf(row), 0) / plotters.length : 60;
    const avgPlotterSkill = plotters.length
        ? plotters.reduce((sum, row) => sum + ((row.skills && row.skills.warrior) || 0)
            + ((row.skills && row.skills.diplomat) || 0), 0) / (plotters.length * 12) : 0;
    const unrest = typeof storyFacUnrest === 'function' ? storyFacUnrest(state) : 0;
    const welfareStressBps = storyPoliticalCrisisClampBps((100 - (Number(state.welfare) || 0)) * 100);
    const unrestBps = storyPoliticalCrisisClampBps(unrest / 50 * 10000);
    const militarySupport = state.factions && Number.isFinite(Number(state.factions.military))
        ? Number(state.factions.military) : 50;
    const militaryDiscontentBps = storyPoliticalCrisisClampBps((100 - militarySupport) * 100);
    const loyaltyStressBps = storyPoliticalCrisisClampBps((55 - avgPlotterLoyalty) * 400);
    const capacity = typeof storyStateCapacityCountryView === 'function'
        ? storyStateCapacityCountryView(countryId) : null;
    const legitimacyBps = capacity ? storyPoliticalCrisisClampBps(capacity.legitimacyBps) : 5000;
    const ruleOfLawBps = capacity ? storyPoliticalCrisisClampBps(capacity.ruleOfLawBps) : 5000;
    const regionalControlBps = capacity ? storyPoliticalCrisisClampBps(capacity.regionalControlBps) : 5000;
    const armed = storyPoliticalCrisisPowerCenter(countryId, 'ARMED_FORCES');
    const security = storyPoliticalCrisisPowerCenter(countryId, 'SECURITY_SERVICE');
    const armedInfluenceBps = armed ? storyPoliticalCrisisClampBps(armed.influenceBps) : 0;
    const armedCoercionBps = armed ? storyPoliticalCrisisClampBps(armed.capabilities && armed.capabilities.coercionBps) : 0;
    const securityInformationBps = security ? storyPoliticalCrisisClampBps(security.capabilities && security.capabilities.informationBps) : 0;
    const securityCoercionBps = security ? storyPoliticalCrisisClampBps(security.capabilities && security.capabilities.coercionBps) : 0;
    const integrity = typeof storyIntegrityCountryView === 'function'
        ? storyIntegrityCountryView(countryId) : null;
    const substantiatedCases = integrity
        ? (integrity.cases || []).filter(row => row.status === 'SUBSTANTIATED').length : 0;
    const election = typeof storyElectionCountryView === 'function'
        ? storyElectionCountryView(countryId) : null;
    const contestedElection = !!(election && (election.elections || []).some(row => row.contest && !row.contest.resolved));
    const plotterShareBps = storyPoliticalCrisisClampBps(plotters.length / Math.max(1, commanders.length) * 10000);
    const loyalistShareBps = storyPoliticalCrisisClampBps(loyalists.length / Math.max(1, commanders.length) * 10000);
    const structuralRiskBps = storyPoliticalCrisisClampBps(
        loyaltyStressBps * 0.31 + militaryDiscontentBps * 0.17 + unrestBps * 0.15
        + welfareStressBps * 0.12 + (10000 - legitimacyBps) * 0.14
        + (10000 - ruleOfLawBps) * 0.06 + Math.min(2000, substantiatedCases * 700)
        + (contestedElection ? 900 : 0)
    );
    const coalitionBps = storyPoliticalCrisisClampBps(
        plotterShareBps * 0.38 + avgPlotterSkill * 10000 * 0.22
        + armedInfluenceBps * 0.18 + armedCoercionBps * 0.22
    );
    const baseCounterBps = storyPoliticalCrisisClampBps(
        loyalistShareBps * 0.30 + ruleOfLawBps * 0.24 + legitimacyBps * 0.15
        + securityInformationBps * 0.14 + securityCoercionBps * 0.17
    );
    return {
        countryId,
        plotterActorIds: plotters.map(row => storyPoliticalCrisisActorId(state.id, row)),
        loyalistActorIds: loyalists.map(row => storyPoliticalCrisisActorId(state.id, row)),
        leadActorId: plotters.length ? storyPoliticalCrisisActorId(state.id, plotters[0]) : null,
        plotterCount: plotters.length,
        commanderCount: commanders.length,
        structuralRiskBps,
        coalitionBps,
        baseCounterBps,
        initialIntelligenceBps: storyPoliticalCrisisClampBps(securityInformationBps * 0.45 + loyalistShareBps * 0.18),
        regionalControlBps,
        factors: {
            loyaltyStressBps, militaryDiscontentBps, unrestBps, welfareStressBps,
            legitimacyBps, ruleOfLawBps, regionalControlBps, armedInfluenceBps,
            armedCoercionBps, securityInformationBps, securityCoercionBps,
            substantiatedCases, contestedElection
        }
    };
}
function storyPoliticalCrisisRegionalControl(state, crisis, assessment) {
    const plotters = new Set(crisis.plotterActorIds || []);
    const loyalists = new Set(crisis.loyalistActorIds || []);
    return (STORY.nodes || []).filter(node => Number(node.owner) === Number(state.id)).map(node => {
        const atNode = ((state.gov && state.gov.commanders) || []).filter(row => Number(row.node) === Number(node.id));
        const plotterPresent = atNode.some(row => plotters.has(storyPoliticalCrisisActorId(state.id, row)));
        const loyalistPresent = atNode.some(row => loyalists.has(storyPoliticalCrisisActorId(state.id, row)));
        let status = 'INSTITUTIONAL';
        if (plotterPresent && crisis.preparationBps >= STORY_POLITICAL_CRISIS_POLICY.ultimatumPreparationBps) status = 'CONTESTED';
        else if (loyalistPresent || Number(node.garrison) > 0) status = 'SECURED';
        return {
            regionId: `region:${Number(node.id)}`,
            status,
            plotterPresence: plotterPresent,
            loyalistPresence: loyalistPresent,
            nationalControlBps: assessment.regionalControlBps
        };
    }).sort((a, b) => a.regionId.localeCompare(b.regionId, 'en'));
}

function storyPoliticalCrisisMemoryOpen(state, crisis) {
    if (typeof storyMemoryOpenEpisode !== 'function' || !crisis || !crisis.leadActorId) return null;
    const participants = Array.from(new Set([
        crisis.leadActorId,
        (crisis.loyalistActorIds || [])[0]
    ].filter(Boolean)));
    const id = `character-memory:political-crisis:${crisis.id}`;
    const opened = storyMemoryOpenEpisode({
        id,
        topicKey: `political-crisis:${crisis.id}`,
        participantActorIds: participants,
        summary: `${storyPoliticalCrisisActorName(state, crisis.leadActorId)} çevresinde askerî iktidar krizi başladı.`,
        unresolvedTopic: 'Koalisyonun dağılacağı, uzlaşacağı veya yönetime el koymaya kalkışacağı henüz belli değil.',
        importanceBps: 9300,
        source: { politicalCrisisId: crisis.id, countryId: crisis.countryId, eventType: 'CRISIS_OPENED' }
    });
    return opened && opened.episode ? opened.episode.id : (opened && opened.duplicate ? id : null);
}

function storyPoliticalCrisisMemoryRecordAction(state, crisis, history) {
    if (typeof storyMemoryOpenEpisode !== 'function' || typeof storyMemoryResolveEpisode !== 'function') return null;
    const participants = Array.from(new Set([history.actorId, history.targetActorId].filter(Boolean)));
    if (!participants.length) return null;
    const actionLabels = {
        NEGOTIATE: 'Doğrudan müzakere',
        SECURE_COMMAND: 'Komuta zincirini güvenceye alma',
        PUBLIC_ACCOUNT: 'Kamu önünde hesap verme',
        WAIT_AND_WATCH: 'Müdahale etmeden gözlem'
    };
    const id = `character-memory:political-crisis-action:${crisis.id}:${history.sequence}`;
    const label = actionLabels[history.actionId] || history.actionId;
    const opened = storyMemoryOpenEpisode({
        id, topicKey: `political-crisis-action:${history.actionId}`,
        participantActorIds: participants,
        summary: `${label}: ${participants.map(actorId => storyPoliticalCrisisActorName(state, actorId)).join(' ↔ ')}`,
        unresolvedTopic: 'Karşı hamlenin kriz üzerindeki etkisi uygulanıyor.',
        importanceBps: 8500,
        source: {
            politicalCrisisId: crisis.id, actionSequence: history.sequence,
            actionId: history.actionId, resultCode: history.resultCode
        }
    });
    const episodeId = opened && opened.episode ? opened.episode.id : (opened && opened.duplicate ? id : null);
    if (episodeId) storyMemoryResolveEpisode(
        episodeId,
        `${label} tamamlandı: ${history.resultCode}. Hazırlık ${history.before.preparationBps}→${history.after.preparationBps}, karşı güç ${history.before.counterBps}→${history.after.counterBps}.`
    );
    return episodeId;
}

function storyPoliticalCrisisMemoryResolve(state, crisis) {
    if (crisis.memoryEpisodeId && typeof storyMemoryResolveEpisode === 'function') {
        storyMemoryResolveEpisode(
            crisis.memoryEpisodeId,
            `Siyasi kriz ${crisis.resultCode || crisis.status} sonucuyla kapandı.`
        );
    }
    if (!['SUCCESS', 'FAILED', 'SPLIT'].includes(crisis.status)
        || !crisis.leadActorId || typeof storyMemoryAddMilestone !== 'function') return null;
    const identityLedger = typeof storyCharacterIdentityEnsure === 'function'
        ? storyCharacterIdentityEnsure() : null;
    const identities = identityLedger && identityLedger.identities || {};
    const publicHolders = Object.values(identities)
        .filter(row => row.countryId === crisis.countryId).map(row => row.id).sort();
    const privateHolders = Array.from(new Set([
        crisis.leadActorId,
        ...(crisis.plotterActorIds || []),
        ...(crisis.loyalistActorIds || [])
    ].filter(actorId => identities[actorId]))).sort();
    const holders = crisis.publicExposure ? publicHolders : privateHolders;
    if (!holders.length) return null;
    return storyMemoryAddMilestone({
        id: `character-memory:political-crisis-betrayal:${crisis.id}`,
        kind: 'BETRAYAL', subjectActorId: crisis.leadActorId,
        holderActorIds: holders,
        relatedActorIds: Array.from(new Set((crisis.plotterActorIds || []).concat(crisis.loyalistActorIds || [])))
            .filter(actorId => actorId !== crisis.leadActorId && identities[actorId]).sort(),
        summary: `${storyPoliticalCrisisActorName(state, crisis.leadActorId)} öncülüğündeki koalisyon yönetime el koymayı denedi; sonuç ${crisis.resultCode}.`,
        status: ['SUCCESS', 'SPLIT'].includes(crisis.status) ? 'ACTIVE' : 'RESOLVED',
        importanceBps: 10000, recordRecent: false,
        source: {
            politicalCrisisId: crisis.id, resultCode: crisis.resultCode,
            outcomeScoreBps: crisis.outcomeScoreBps, publicExposure: !!crisis.publicExposure
        }
    });
}
function storyPoliticalCrisisOpen(ledger, state, assessment) {
    const countryId = assessment.countryId;
    const country = ledger.countries[countryId];
    const id = `political-crisis:${ledger.nextCrisisSequence++}`;
    const crisis = {
        id, countryId, type: 'COUP_AND_STATE_FRACTURE', status: 'ORGANIZING',
        openedAt: storyPoliticalCrisisRound(STORY.clock), updatedAt: storyPoliticalCrisisRound(STORY.clock),
        resolvedAt: null, resultCode: null,
        leadActorId: assessment.leadActorId,
        plotterActorIds: assessment.plotterActorIds.slice(),
        loyalistActorIds: assessment.loyalistActorIds.slice(),
        preparationBps: Math.max(350, Math.round(assessment.structuralRiskBps * 0.08)),
        coalitionBps: assessment.coalitionBps,
        counterBps: assessment.baseCounterBps,
        manualCounterBps: 0,
        intelligenceBps: assessment.initialIntelligenceBps,
        publicExposure: false,
        lastActionAt: null,
        factorSnapshot: assessment.factors,
        actionHistory: [],
        regionalControl: [],
        outcomeModel: STORY_POLITICAL_CRISIS_POLICY.outcomeModel,
        randomOutcome: false,
        llmOutcome: false
    };
    crisis.regionalControl = storyPoliticalCrisisRegionalControl(state, crisis, assessment);
    ledger.crises[id] = crisis;
    country.activeCrisisId = id;
    country.crisisIds.push(id);
    storyPoliticalCrisisRecordEvent(ledger, 'CRISIS_OPENED', crisis, {
        actorId: crisis.leadActorId,
        plotterActorIds: crisis.plotterActorIds,
        preparationAfterBps: crisis.preparationBps,
        coalitionAfterBps: crisis.coalitionBps,
        counterAfterBps: crisis.counterBps,
        reasonCodes: Object.keys(assessment.factors).filter(key => assessment.factors[key] === true || Number(assessment.factors[key]) >= 6000)
    });
    crisis.memoryEpisodeId = storyPoliticalCrisisMemoryOpen(state, crisis);
    return crisis;
}
function storyPoliticalCrisisStage(preparationBps) {
    if (preparationBps >= STORY_POLITICAL_CRISIS_POLICY.attemptPreparationBps) return 'ATTEMPT';
    if (preparationBps >= STORY_POLITICAL_CRISIS_POLICY.ultimatumPreparationBps) return 'ULTIMATUM';
    if (preparationBps >= STORY_POLITICAL_CRISIS_POLICY.coalitionPreparationBps) return 'COALITION';
    return 'ORGANIZING';
}
function storyPoliticalCrisisResolve(ledger, state, country, crisis, assessment) {
    crisis.status = 'ATTEMPT';
    storyPoliticalCrisisRecordEvent(ledger, 'ATTEMPT_STARTED', crisis, {
        actorId: crisis.leadActorId,
        preparationBeforeBps: crisis.preparationBps,
        coalitionBeforeBps: crisis.coalitionBps,
        counterBeforeBps: crisis.counterBps
    });
    const scoreBps = Math.round(
        crisis.preparationBps * 0.45 + crisis.coalitionBps * 0.45 - crisis.counterBps * 0.55
    );
    const contested = (crisis.regionalControl || []).filter(row => row.status === 'CONTESTED');
    const success = scoreBps >= STORY_POLITICAL_CRISIS_POLICY.successScoreBps;
    const split = success && assessment.regionalControlBps < STORY_POLITICAL_CRISIS_POLICY.splitControlBps && contested.length > 0;
    crisis.status = split ? 'SPLIT' : (success ? 'SUCCESS' : 'FAILED');
    crisis.resultCode = split ? 'STATE_CONTROL_FRACTURED' : (success ? 'GOVERNMENT_SEIZED' : 'COUP_DEFEATED');
    crisis.resolvedAt = storyPoliticalCrisisRound(STORY.clock);
    crisis.updatedAt = crisis.resolvedAt;
    crisis.publicExposure = true;
    crisis.outcomeScoreBps = scoreBps;
    country.activeCrisisId = null;
    country.lastResolvedAt = crisis.resolvedAt;
    country.nextCrisisAllowedAt = crisis.resolvedAt + STORY_POLITICAL_CRISIS_POLICY.failureCooldownSeconds;
    const plotters = crisis.plotterActorIds.map(id => storyPoliticalCrisisActor(state, id)).filter(Boolean);
    if (success) {
        if (state.gov) {
            state.gov.leader = 'ai';
            state.gov.crisisOutcome = crisis.resultCode;
            state.gov.crisisActorId = crisis.leadActorId;
        }
        if (state.isPlayer) state.isAdmin = false;
        for (const commander of plotters) commander.loyalty = Math.max(55, Number(commander.loyalty) || 0);
        if (typeof storyWelfareDelta === 'function') storyWelfareDelta(state, 'government.political_crisis_success', split ? -10 : -7);
    } else {
        for (const commander of plotters) commander.loyalty = Math.max(10, (Number(commander.loyalty) || 0) - 4);
        if (typeof storyWelfareDelta === 'function') storyWelfareDelta(state, 'government.political_crisis_failed', -2);
    }
    storyPoliticalCrisisRecordEvent(ledger, 'CRISIS_RESOLVED', crisis, {
        actorId: crisis.leadActorId,
        resultCode: crisis.resultCode,
        outcomeScoreBps: scoreBps,
        contestedRegionIds: contested.map(row => row.regionId),
        physicalGovernmentMutation: success,
        physicalTerritorialMutation: false
    });
    storyPoliticalCrisisMemoryResolve(state, crisis);
    if (state.isPlayer && typeof storyFlash === 'function') {
        storyFlash(success
            ? `🔥 ${storyPoliticalCrisisActorName(state, crisis.leadActorId)} öncülüğündeki girişim yönetimi ele geçirdi.`
            : `🛡️ ${storyPoliticalCrisisActorName(state, crisis.leadActorId)} öncülüğündeki darbe girişimi bozuldu.`);
    } else if (typeof storyLog === 'function') {
        storyLog(`🏛️ ${state.name}: ${success ? 'yönetim zorla el değiştirdi' : 'darbe girişimi başarısız oldu'}.`);
    }
}
function storyPoliticalCrisisAdvance(ledger, state, country, crisis, assessment, dt) {
    const beforeStatus = crisis.status;
    const beforePreparation = crisis.preparationBps;
    crisis.leadActorId = assessment.leadActorId || crisis.leadActorId;
    crisis.plotterActorIds = assessment.plotterActorIds.slice();
    crisis.loyalistActorIds = assessment.loyalistActorIds.slice();
    crisis.factorSnapshot = assessment.factors;
    crisis.coalitionBps = assessment.coalitionBps;
    crisis.counterBps = storyPoliticalCrisisClampBps(assessment.baseCounterBps + crisis.manualCounterBps);
    if (assessment.plotterCount < STORY_POLITICAL_CRISIS_POLICY.minimumPlotters) {
        crisis.preparationBps = storyPoliticalCrisisClampBps(crisis.preparationBps - Math.max(500, Math.round(1100 * dt / 5)));
        if (crisis.preparationBps === 0) {
            crisis.status = 'DISSOLVED'; crisis.resultCode = 'COALITION_DISSOLVED';
            crisis.resolvedAt = storyPoliticalCrisisRound(STORY.clock); crisis.updatedAt = crisis.resolvedAt;
            country.activeCrisisId = null; country.lastResolvedAt = crisis.resolvedAt;
            country.nextCrisisAllowedAt = crisis.resolvedAt + STORY_POLITICAL_CRISIS_POLICY.failureCooldownSeconds;
            storyPoliticalCrisisRecordEvent(ledger, 'CRISIS_RESOLVED', crisis, {
                resultCode: crisis.resultCode, physicalGovernmentMutation: false, physicalTerritorialMutation: false
            });
            storyPoliticalCrisisMemoryResolve(state, crisis);
            return;
        }
    } else {
        const pressure = assessment.structuralRiskBps + crisis.coalitionBps * 0.22 - crisis.counterBps * 0.28;
        const increment = Math.max(80, Math.round(Math.max(900, pressure) / 16 * Math.max(0, Number(dt) || 0) / 5));
        crisis.preparationBps = storyPoliticalCrisisClampBps(crisis.preparationBps + increment);
        crisis.intelligenceBps = storyPoliticalCrisisClampBps(
            crisis.intelligenceBps + Math.round((180 + assessment.baseCounterBps * 0.025) * Math.max(0, Number(dt) || 0) / 5)
        );
        crisis.status = storyPoliticalCrisisStage(crisis.preparationBps);
    }
    crisis.publicExposure = crisis.publicExposure || crisis.status === 'ULTIMATUM' || crisis.intelligenceBps >= 6500;
    crisis.updatedAt = storyPoliticalCrisisRound(STORY.clock);
    crisis.regionalControl = storyPoliticalCrisisRegionalControl(state, crisis, assessment);
    if (beforeStatus !== crisis.status) {
        storyPoliticalCrisisRecordEvent(ledger, 'CRISIS_STAGE_CHANGED', crisis, {
            fromStatus: beforeStatus, toStatus: crisis.status,
            preparationBeforeBps: beforePreparation, preparationAfterBps: crisis.preparationBps,
            coalitionAfterBps: crisis.coalitionBps, counterAfterBps: crisis.counterBps
        });
        if (state.isPlayer && crisis.intelligenceBps >= STORY_POLITICAL_CRISIS_POLICY.publicKnowledgeBps
            && typeof storyFlash === 'function') {
            storyFlash(`⚠️ ${storyPoliticalCrisisActorName(state, crisis.leadActorId)} çevresindeki askerî kriz ${crisis.status} aşamasına geçti. Sohbetten karşı hamle seç.`);
        }
    }
    if (crisis.status === 'ATTEMPT') storyPoliticalCrisisResolve(ledger, state, country, crisis, assessment);
}
function storyPoliticalCrisisSelectActor(state, crisis, mode) {
    if (state.isPlayer && STORY.commander) return STORY.commander;
    const preferred = mode === 'SECURE_COMMAND' ? crisis.loyalistActorIds : crisis.loyalistActorIds.concat(crisis.plotterActorIds);
    for (const id of preferred) {
        const actor = storyPoliticalCrisisActor(state, id);
        if (actor) return actor;
    }
    return ((state.gov && state.gov.commanders) || [])[0] || null;
}
function storyPoliticalCrisisAct(countryId, actionId, options) {
    options = options || {};
    const ledger = storyPoliticalCrisisEnsure();
    const id = storyPoliticalCrisisCountryId(countryId);
    const state = storyPoliticalCrisisState(id);
    const country = ledger && ledger.countries[id];
    const crisis = country && ledger.crises[country.activeCrisisId];
    const action = STORY_POLITICAL_CRISIS_ACTIONS[actionId];
    if (!ledger || !state || !country || !crisis || !action) return { ok: false, reason: 'ACTIVE_CRISIS_AND_KNOWN_ACTION_REQUIRED' };
    if (STORY_POLITICAL_CRISIS_TERMINAL_STATUSES.includes(crisis.status)) return { ok: false, reason: 'CRISIS_ALREADY_RESOLVED' };
    const now = Number(STORY.clock) || 0;
    if (crisis.lastActionAt != null && now - crisis.lastActionAt < action.cooldownSeconds) {
        return { ok: false, reason: 'ACTION_COOLDOWN', remainingSeconds: Math.ceil(action.cooldownSeconds - (now - crisis.lastActionAt)) };
    }
    const actor = storyPoliticalCrisisSelectActor(state, crisis, actionId);
    if (!actor) return { ok: false, reason: 'CANONICAL_ACTOR_REQUIRED' };
    const actorId = storyPoliticalCrisisActorId(state.id, actor);
    const targetActorId = actionId === 'SECURE_COMMAND' && crisis.loyalistActorIds.length
        ? crisis.loyalistActorIds[0] : crisis.leadActorId;
    const target = storyPoliticalCrisisActor(state, targetActorId);
    const points = actor.res && Number(actor.res.points) || 0;
    if (action.pointCost && points < action.pointCost) return { ok: false, reason: 'INSUFFICIENT_COMMAND_POINTS', required: action.pointCost, available: points };
    if (action.reputationCost && (Number(state.reputation) || 0) < action.reputationCost) return { ok: false, reason: 'INSUFFICIENT_REPUTATION', required: action.reputationCost };
    const before = {
        preparationBps: crisis.preparationBps, coalitionBps: crisis.coalitionBps,
        counterBps: crisis.counterBps, intelligenceBps: crisis.intelligenceBps
    };
    const receipts = [];
    if (action.pointCost) {
        actor.res.points = storyPoliticalCrisisRound(points - action.pointCost);
        receipts.push({ ownerActorId: actorId, resource: 'points', amount: -action.pointCost });
    }
    if (action.reputationCost) {
        state.reputation = Math.max(0, (Number(state.reputation) || 0) - action.reputationCost);
        receipts.push({ ownerCountryId: id, resource: 'reputation', amount: -action.reputationCost });
    }
    let resultCode = null;
    if (actionId === 'NEGOTIATE') {
        if (target) target.loyalty = Math.min(100, (Number(target.loyalty) || 0) + 7);
        crisis.preparationBps = storyPoliticalCrisisClampBps(crisis.preparationBps - 950);
        crisis.coalitionBps = storyPoliticalCrisisClampBps(crisis.coalitionBps - 450);
        crisis.intelligenceBps = storyPoliticalCrisisClampBps(crisis.intelligenceBps + 350);
        resultCode = 'LEAD_PLOTTER_NEGOTIATED';
    } else if (actionId === 'SECURE_COMMAND') {
        if (target) target.loyalty = Math.min(100, (Number(target.loyalty) || 0) + 3);
        crisis.manualCounterBps = storyPoliticalCrisisClampBps(crisis.manualCounterBps + 1500);
        crisis.counterBps = storyPoliticalCrisisClampBps(crisis.counterBps + 1500);
        crisis.intelligenceBps = storyPoliticalCrisisClampBps(crisis.intelligenceBps + 500);
        resultCode = 'LOYAL_COMMAND_NETWORK_SECURED';
    } else if (actionId === 'PUBLIC_ACCOUNT') {
        crisis.publicExposure = true;
        crisis.intelligenceBps = storyPoliticalCrisisClampBps(crisis.intelligenceBps + 2100);
        crisis.manualCounterBps = storyPoliticalCrisisClampBps(crisis.manualCounterBps + 650);
        crisis.counterBps = storyPoliticalCrisisClampBps(crisis.counterBps + 650);
        crisis.preparationBps = storyPoliticalCrisisClampBps(crisis.preparationBps - 300);
        crisis.coalitionBps = storyPoliticalCrisisClampBps(crisis.coalitionBps + 250);
        resultCode = 'CRISIS_EXPOSED_PUBLICLY';
    } else {
        crisis.intelligenceBps = storyPoliticalCrisisClampBps(crisis.intelligenceBps + 750);
        crisis.preparationBps = storyPoliticalCrisisClampBps(crisis.preparationBps + 280);
        resultCode = 'OBSERVATION_WITHOUT_INTERVENTION';
    }
    crisis.lastActionAt = storyPoliticalCrisisRound(now);
    crisis.updatedAt = crisis.lastActionAt;
    const history = {
        sequence: crisis.actionHistory.length + 1,
        at: crisis.lastActionAt,
        actionId,
        actorId,
        targetActorId: target ? targetActorId : null,
        resultCode,
        controller: options.ai ? 'AI' : 'PLAYER',
        decisionSource: options.source ? String(options.source) : null,
        sourceConversationSessionId: options.sourceConversationSessionId
            ? String(options.sourceConversationSessionId) : null,
        sourceConversationResponseId: options.sourceConversationResponseId
            ? String(options.sourceConversationResponseId) : null,
        resourceReceipts: receipts,
        before,
        after: {
            preparationBps: crisis.preparationBps, coalitionBps: crisis.coalitionBps,
            counterBps: crisis.counterBps, intelligenceBps: crisis.intelligenceBps
        }
    };
    crisis.actionHistory.push(history);
    if (crisis.actionHistory.length > STORY_POLITICAL_CRISIS_POLICY.maximumActionsPerCrisis) crisis.actionHistory.shift();
    storyPoliticalCrisisRecordEvent(ledger, 'COUNTERACTION_RECORDED', crisis, history);
    history.memoryEpisodeId = storyPoliticalCrisisMemoryRecordAction(state, crisis, history);
    if (options.save !== false && typeof storySave === 'function') storySave();
    return { ok: true, crisis: storyPoliticalCrisisClone(crisis), action: storyPoliticalCrisisClone(history) };
}
function storyPoliticalCrisisTick(dt) {
    const ledger = storyPoliticalCrisisEnsure();
    if (!ledger) return { disabled: true };
    for (const state of (STORY.states || []).slice().sort((a, b) => Number(a.id) - Number(b.id))) {
        if (!state.gov || !(STORY.nodes || []).some(node => Number(node.owner) === Number(state.id))) continue;
        const countryId = storyPoliticalCrisisCountryId(state.id);
        const country = ledger.countries[countryId] || (ledger.countries[countryId] = storyPoliticalCrisisCountryRow(countryId));
        const assessment = storyPoliticalCrisisAssessment(state);
        country.lastAssessmentAt = storyPoliticalCrisisRound(STORY.clock);
        let crisis = country.activeCrisisId ? ledger.crises[country.activeCrisisId] : null;
        if (!crisis && (Number(STORY.clock) || 0) >= (Number(country.nextCrisisAllowedAt) || 0)
            && assessment.plotterCount >= STORY_POLITICAL_CRISIS_POLICY.minimumPlotters
            && assessment.structuralRiskBps >= STORY_POLITICAL_CRISIS_POLICY.openRiskBps) {
            crisis = storyPoliticalCrisisOpen(ledger, state, assessment);
        }
        if (!crisis) continue;
        storyPoliticalCrisisAdvance(ledger, state, country, crisis, assessment, dt);
        const aiActionCount = (crisis.actionHistory || []).filter(row => row.controller === 'AI').length;
        if (!state.isPlayer && country.activeCrisisId && crisis.status !== 'ORGANIZING'
            && aiActionCount < STORY_POLITICAL_CRISIS_POLICY.maximumAIActionsPerCrisis
            && (crisis.lastActionAt == null || (Number(STORY.clock) || 0) - crisis.lastActionAt >= 20)) {
            storyPoliticalCrisisAct(countryId, crisis.counterBps < crisis.coalitionBps ? 'SECURE_COMMAND' : 'NEGOTIATE', { save: false, ai: true });
        }
    }
    ledger.tickSequence++;
    ledger.lastTickAt = storyPoliticalCrisisRound(STORY.clock);
    return { disabled: false, tickSequence: ledger.tickSequence, activeCount: Object.values(ledger.countries).filter(row => row.activeCrisisId).length };
}
function storyPoliticalCrisisValidate(ledger) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!ledger || typeof ledger !== 'object') return { ok: false, issues: [{ code: 'POLITICAL_CRISIS_LEDGER_REQUIRED', path: '$', message: 'Siyasi kriz defteri zorunlu.' }] };
    if (ledger.schemaVersion !== STORY_POLITICAL_CRISIS_SCHEMA_VERSION) add('POLITICAL_CRISIS_SCHEMA_VERSION', '$.schemaVersion', 'Sema surumu uyusmuyor.');
    if (ledger.adapterVersion !== STORY_POLITICAL_CRISIS_ADAPTER_VERSION) add('POLITICAL_CRISIS_ADAPTER_VERSION', '$.adapterVersion', 'Adaptor surumu uyusmuyor.');
    if (ledger.policyHash !== STORY_POLITICAL_CRISIS_POLICY_HASH) add('POLITICAL_CRISIS_POLICY_HASH', '$.policyHash', 'Politika karmasi uyusmuyor.');
    const knownCountries = new Set((STORY.states || []).map(row => storyPoliticalCrisisCountryId(row.id)));
    for (const countryId of knownCountries) if (!ledger.countries || !ledger.countries[countryId]) add('POLITICAL_CRISIS_COUNTRY', `$.countries.${countryId}`, 'Ulke kriz ozeti eksik.');
    for (const [countryId, country] of Object.entries(ledger.countries || {})) {
        if (!knownCountries.has(countryId) || country.countryId !== countryId) add('POLITICAL_CRISIS_COUNTRY_IDENTITY', `$.countries.${countryId}`, 'Ulke kimligi gecersiz.');
        if (country.activeCrisisId && (!ledger.crises[country.activeCrisisId]
            || STORY_POLITICAL_CRISIS_TERMINAL_STATUSES.includes(ledger.crises[country.activeCrisisId].status))) {
            add('POLITICAL_CRISIS_ACTIVE_REF', `$.countries.${countryId}.activeCrisisId`, 'Etkin kriz referansi gecersiz.');
        }
        for (const crisisId of (country.crisisIds || [])) if (!ledger.crises[crisisId] || ledger.crises[crisisId].countryId !== countryId) {
            add('POLITICAL_CRISIS_COUNTRY_REF', `$.countries.${countryId}.crisisIds`, 'Kriz referansi eksik veya baska ulkeye ait.');
        }
    }
    for (const [id, crisis] of Object.entries(ledger.crises || {})) {
        const path = `$.crises.${id}`;
        if (crisis.id !== id || !knownCountries.has(crisis.countryId)) add('POLITICAL_CRISIS_IDENTITY', path, 'Kriz kimligi veya ulkesi gecersiz.');
        if (!STORY_POLITICAL_CRISIS_STATUSES.includes(crisis.status)) add('POLITICAL_CRISIS_STATUS', `${path}.status`, 'Kriz durumu gecersiz.');
        for (const field of ['preparationBps', 'coalitionBps', 'counterBps', 'intelligenceBps']) {
            if (!Number.isInteger(crisis[field]) || crisis[field] < 0 || crisis[field] > 10000) add('POLITICAL_CRISIS_BPS', `${path}.${field}`, 'Kriz olcumu 0-10.000 tamsayi olmali.');
        }
        if (crisis.randomOutcome !== false || crisis.llmOutcome !== false || crisis.outcomeModel !== STORY_POLITICAL_CRISIS_POLICY.outcomeModel) {
            add('POLITICAL_CRISIS_OUTCOME_MODEL', path, 'Kriz sonucu RNG veya LLM tarafindan belirlenemez.');
        }
        for (const actorId of [crisis.leadActorId, ...(crisis.plotterActorIds || []), ...(crisis.loyalistActorIds || [])].filter(Boolean)) {
            if (!/^character:\d+:\d+$/.test(actorId)) add('POLITICAL_CRISIS_ACTOR_ID', path, 'Aktor kimligi kanonik degil.');
        }
        if (!Array.isArray(crisis.actionHistory) || crisis.actionHistory.length > STORY_POLITICAL_CRISIS_POLICY.maximumActionsPerCrisis) add('POLITICAL_CRISIS_ACTION_LIMIT', `${path}.actionHistory`, 'Karsi hamle kayit butcesi asildi.');
        if ((crisis.actionHistory || []).filter(row => row.controller === 'AI').length > STORY_POLITICAL_CRISIS_POLICY.maximumAIActionsPerCrisis) add('POLITICAL_CRISIS_AI_ACTION_LIMIT', `${path}.actionHistory`, 'AI ayni krizde karar spamı yapamaz.');
        if (STORY_POLITICAL_CRISIS_TERMINAL_STATUSES.includes(crisis.status) && crisis.resolvedAt == null) add('POLITICAL_CRISIS_RESOLUTION_TIME', `${path}.resolvedAt`, 'Sonuclanmis kriz cozum zamani tasimali.');
    }
    if (Object.keys(ledger.crises || {}).length > STORY_POLITICAL_CRISIS_POLICY.maximumCrises) add('POLITICAL_CRISIS_LIMIT', '$.crises', 'Kriz kayit butcesi asildi.');
    if (!Array.isArray(ledger.events) || ledger.events.length > STORY_POLITICAL_CRISIS_POLICY.maximumEvents) add('POLITICAL_CRISIS_EVENT_LIMIT', '$.events', 'Olay kayit butcesi asildi.');
    return { ok: issues.length === 0, issues };
}
function storyPoliticalCrisisReset(options) {
    if (!storyPoliticalCrisisEnabled()) { STORY.politicalCrises = null; return null; }
    STORY.politicalCrises = storyPoliticalCrisisLedgerCreate(options);
    return STORY.politicalCrises;
}
function storyPoliticalCrisisEnsure() {
    if (!storyPoliticalCrisisEnabled()) return null;
    return STORY.politicalCrises || storyPoliticalCrisisReset({ backfilled: true });
}
function storyPoliticalCrisisRestore(saved) {
    if (!storyPoliticalCrisisEnabled()) { STORY.politicalCrises = null; return null; }
    if (!saved) return storyPoliticalCrisisReset({ backfilled: true });
    const candidate = storyPoliticalCrisisClone(saved);
    const validation = storyPoliticalCrisisValidate(candidate);
    if (validation.ok) { STORY.politicalCrises = candidate; return candidate; }
    return storyPoliticalCrisisReset({ backfilled: true, restoredFromInvalidLedger: true, issues: validation.issues });
}
function storyPoliticalCrisisForSave() {
    const ledger = storyPoliticalCrisisEnsure();
    if (!ledger) return null;
    const validation = storyPoliticalCrisisValidate(ledger);
    ledger.diagnostics.issues = validation.ok ? [] : validation.issues.slice(0, 50);
    return storyPoliticalCrisisClone(ledger);
}
function storyPoliticalCrisisCountryView(countryId) {
    const ledger = storyPoliticalCrisisEnabled() ? STORY.politicalCrises : null;
    const id = storyPoliticalCrisisCountryId(countryId);
    const country = ledger && ledger.countries[id];
    if (!country) return null;
    return Object.assign(storyPoliticalCrisisClone(country), {
        activeCrisis: country.activeCrisisId ? storyPoliticalCrisisClone(ledger.crises[country.activeCrisisId]) : null,
        crises: (country.crisisIds || []).map(crisisId => storyPoliticalCrisisClone(ledger.crises[crisisId])).filter(Boolean)
    });
}
function storyPoliticalCrisisPublicView(value) {
    if (!value) return null;
    const visible = (value.crises || []).filter(row => row.publicExposure || STORY_POLITICAL_CRISIS_TERMINAL_STATUSES.includes(row.status));
    const active = value.activeCrisis && (value.activeCrisis.publicExposure || value.activeCrisis.status === 'ULTIMATUM')
        ? value.activeCrisis : null;
    const map = row => ({
        id: row.id, type: row.type, status: row.status,
        openedAt: row.openedAt, resolvedAt: row.resolvedAt,
        resultCode: row.resultCode,
        contestedRegionIds: (row.regionalControl || []).filter(region => region.status === 'CONTESTED').map(region => region.regionId)
    });
    return {
        countryId: value.countryId,
        active: !!active,
        publicStatus: active ? active.status : 'NO_PUBLIC_ACTIVE_CRISIS',
        activeCrisis: active ? map(active) : null,
        crises: visible.map(map)
    };
}
function storyPoliticalCrisisSummary() {
    const ledger = storyPoliticalCrisisEnabled() ? STORY.politicalCrises : null;
    if (!ledger) return { schemaVersion: STORY_POLITICAL_CRISIS_SCHEMA_VERSION, adapterVersion: STORY_POLITICAL_CRISIS_ADAPTER_VERSION, disabled: true, crisisCount: 0 };
    const crises = Object.values(ledger.crises || {});
    return {
        schemaVersion: ledger.schemaVersion, adapterVersion: ledger.adapterVersion,
        policyHash: ledger.policyHash, disabled: false, tickSequence: ledger.tickSequence,
        countryCount: Object.keys(ledger.countries || {}).length,
        crisisCount: crises.length,
        activeCount: Object.values(ledger.countries || {}).filter(row => row.activeCrisisId).length,
        attemptCount: crises.filter(row => ['ATTEMPT', 'FAILED', 'SUCCESS', 'SPLIT'].includes(row.status)).length,
        successCount: crises.filter(row => row.status === 'SUCCESS' || row.status === 'SPLIT').length,
        failedCount: crises.filter(row => row.status === 'FAILED').length,
        dissolvedCount: crises.filter(row => row.status === 'DISSOLVED').length,
        splitCount: crises.filter(row => row.status === 'SPLIT').length,
        actionCount: crises.reduce((sum, row) => sum + (row.actionHistory || []).length, 0),
        eventCount: (ledger.events || []).length,
        randomOutcome: false,
        llmOutcome: false
    };
}
function storyPoliticalCrisisPlayerView() {
    const state = typeof storyPlayerState === 'function' ? storyPlayerState() : null;
    if (!state) return null;
    const value = storyPoliticalCrisisCountryView(state.id);
    const crisis = value && value.activeCrisis;
    if (!crisis || crisis.intelligenceBps < STORY_POLITICAL_CRISIS_POLICY.publicKnowledgeBps) return null;
    return value;
}
function storyPoliticalCrisisActionMessage(actionId, result) {
    if (!result || !result.ok) {
        if (result && result.reason === 'ACTION_COOLDOWN') return `Bu temas icin ${result.remainingSeconds} sn daha beklemelisin.`;
        if (result && result.reason === 'INSUFFICIENT_COMMAND_POINTS') return `Komuta puani yetersiz: ${result.available}/${result.required}.`;
        if (result && result.reason === 'INSUFFICIENT_REPUTATION') return 'Bu aciklamayi tasiyacak kadar itibar yok.';
        return 'Bu karsi hamle su anda uygulanamiyor.';
    }
    return ({
        NEGOTIATE: 'Komplo lideriyle dogrudan temas kuruldu; sadakat ve hazirlik yeniden hesaplanacak.',
        SECURE_COMMAND: 'Sadik subaylar komuta zincirini emniyete aldi.',
        PUBLIC_ACCOUNT: 'Kriz kamuya acildi; bilgi artti fakat koalisyon da aciga cikarak sertlesti.',
        WAIT_AND_WATCH: 'Mudahale etmeden izledin; bilgi artti ama karsi taraf da zaman kazandi.'
    })[actionId] || 'Karsi hamle kaydedildi.';
}
