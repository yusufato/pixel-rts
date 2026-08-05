// ============================================================================
//  SECIM VE BARISCIL IKTIDAR DEVRI — Faz 31
//  --------------------------------------------------------------------------
//  Oylar kanonik nufus kohortlarindan, tercih kamuoyu hafizasi ve gercek
//  yonetim sonuclarindan turetilir. Tek zar, LLM sayisi, sahte secmen veya
//  gizli bonus yoktur. Faz 34 gelene kadar aday bir insan degil, acikca
//  POLITICAL_SLATE_PROXY_PRE_PHASE_34 modelidir. Bu katman ekonomi ya da
//  kaynak yazmaz; sertifikali sonuc yalniz yeni bir makam/mandat kimligi
//  uretir ve Faz 29 yetki imzasinin dogal yoldan yenilenmesini saglar.
// ============================================================================

const STORY_ELECTION_SCHEMA_VERSION = 1;
const STORY_ELECTION_ADAPTER_VERSION = 'story-election-mandate-ledger-1';
const STORY_ELECTION_STATUSES = Object.freeze([
    'SCHEDULED', 'CAMPAIGN', 'COUNTED', 'CONTESTED', 'CERTIFIED', 'CANCELLED'
]);
const STORY_ELECTION_MODELS = Object.freeze({
    PARLIAMENTARY_BALANCE: Object.freeze({ model: 'PARLIAMENTARY_PROPORTIONAL', termSeconds: 480, campaignSeconds: 40, competitive: true, coalition: true }),
    LIBERAL_DEMOCRATIC: Object.freeze({ model: 'EXECUTIVE_POPULAR_VOTE', termSeconds: 480, campaignSeconds: 40, competitive: true, coalition: false }),
    ASSEMBLY_RULE: Object.freeze({ model: 'ASSEMBLY_PROPORTIONAL', termSeconds: 360, campaignSeconds: 35, competitive: true, coalition: true }),
    EXECUTIVE_DOMINANT: Object.freeze({ model: 'RESTRICTED_EXECUTIVE_CONTEST', termSeconds: 600, campaignSeconds: 30, competitive: true, coalition: false }),
    MILITARY_RULE: Object.freeze({ model: 'NO_ELECTION_MILITARY_SUCCESSION_PHASE_33', termSeconds: null, campaignSeconds: 0, competitive: false, coalition: false })
});

const STORY_ELECTION_SLATES = Object.freeze({
    CONTINUITY: Object.freeze({
        name: 'İstikrar Listesi', stance: Object.freeze({ state: 62, market: 48, national: 58, reform: 28 }),
        issueWeights: Object.freeze({ food: 30, energy: 30, income: 20, employment: 20, security: 55, publicServices: 35 }),
        centerAffinity: Object.freeze({ CIVIL_SERVICE: 70, SECURITY_SERVICE: 72, ARMED_FORCES: 60, BUSINESS_COUNCIL: 54 })
    }),
    SOCIAL_COMPACT: Object.freeze({
        name: 'Toplumsal Uzlaşı', stance: Object.freeze({ state: 70, market: 28, national: 42, reform: 58 }),
        issueWeights: Object.freeze({ food: 82, energy: 70, income: 88, employment: 92, security: 38, publicServices: 90 }),
        centerAffinity: Object.freeze({ LABOR_CONFEDERATION: 92, CIVIL_SERVICE: 60, RADICAL_NETWORK: 28 })
    }),
    CIVIC_REFORM: Object.freeze({
        name: 'Yurttaş Reformu', stance: Object.freeze({ state: 42, market: 58, national: 30, reform: 92 }),
        issueWeights: Object.freeze({ food: 42, energy: 45, income: 52, employment: 48, security: 62, publicServices: 84 }),
        centerAffinity: Object.freeze({ MEDIA_NETWORK: 92, CIVIL_SERVICE: 76, BUSINESS_COUNCIL: 48 })
    }),
    NATIONAL_DEVELOPMENT: Object.freeze({
        name: 'Ulusal Kalkınma', stance: Object.freeze({ state: 58, market: 62, national: 92, reform: 44 }),
        issueWeights: Object.freeze({ food: 55, energy: 72, income: 62, employment: 68, security: 86, publicServices: 48 }),
        centerAffinity: Object.freeze({ ARMED_FORCES: 86, BUSINESS_COUNCIL: 78, SECURITY_SERVICE: 64 })
    })
});
const STORY_ELECTION_SLATE_KEYS = Object.freeze(Object.keys(STORY_ELECTION_SLATES));
const STORY_ELECTION_LEGACY_AXIS_IDEALS = Object.freeze({
    CONTINUITY: Object.freeze({ hawk: 50, auth: 55, pop: 45, nat: 55 }),
    SOCIAL_COMPACT: Object.freeze({ hawk: 28, auth: 34, pop: 84, nat: 38 }),
    CIVIC_REFORM: Object.freeze({ hawk: 34, auth: 22, pop: 58, nat: 24 }),
    NATIONAL_DEVELOPMENT: Object.freeze({ hawk: 76, auth: 66, pop: 44, nat: 86 })
});

const STORY_ELECTION_POLICY = Object.freeze({
    firstElectionBaseSeconds: 360,
    firstElectionCountryStaggerSeconds: 3,
    contestMarginBps: 200,
    contestRuleOfLawThresholdBps: 5000,
    contestResolutionSeconds: 20,
    minimumTurnoutBps: 2500,
    maximumTurnoutBps: 9200,
    maximumElections: 96,
    maximumMandates: 80,
    maximumEvents: 512,
    candidateModel: 'POLITICAL_SLATE_PROXY_PRE_PHASE_34',
    officeHolderModel: 'ELECTED_OFFICEHOLDER_PROXY_PRE_PHASE_34',
    voteModel: 'EXACT_COHORT_PERSON_ALLOCATION_V1',
    resultModel: 'MANDATE_RECORD_ONLY_PHASE_31',
    physicalMutation: false
});
const STORY_ELECTION_POLICY_HASH = storyProductionHash({
    schemaVersion: STORY_ELECTION_SCHEMA_VERSION,
    adapterVersion: STORY_ELECTION_ADAPTER_VERSION,
    models: STORY_ELECTION_MODELS,
    slates: STORY_ELECTION_SLATES,
    policy: STORY_ELECTION_POLICY
});

function storyElectionEnabled() {
    return (typeof storyFeatureEnabled !== 'function' || storyFeatureEnabled('government.electionsTransfer'))
        && (typeof storyStateCapacityEnabled !== 'function' || storyStateCapacityEnabled())
        && (typeof storyInstitutionEnabled !== 'function' || storyInstitutionEnabled())
        && (typeof storyPopulationEnabled !== 'function' || storyPopulationEnabled())
        && (typeof storyOpinionEnabled !== 'function' || storyOpinionEnabled())
        && (typeof storyPowerCenterEnabled !== 'function' || storyPowerCenterEnabled());
}
function storyElectionClone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function storyElectionRound(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 1e6) / 1e6 : 0;
}
function storyElectionClampBps(value) { return Math.max(0, Math.min(10000, Math.round(Number(value) || 0))); }
function storyElectionCountryId(value) {
    const raw = String(value == null ? '' : value);
    return raw.startsWith('country:') ? raw : `country:${Number(value)}`;
}
function storyElectionState(countryId) {
    const stateId = Number(String(countryId).split(':').pop());
    return (STORY.states || []).find(state => Number(state.id) === stateId) || null;
}
function storyElectionInstitutionCountry(countryId) {
    return STORY.institutions && STORY.institutions.countries
        ? STORY.institutions.countries[storyElectionCountryId(countryId)] || null : null;
}
function storyElectionModel(countryId) {
    const institution = storyElectionInstitutionCountry(countryId);
    return STORY_ELECTION_MODELS[String(institution && institution.regimeKey || 'PARLIAMENTARY_BALANCE')]
        || STORY_ELECTION_MODELS.PARLIAMENTARY_BALANCE;
}
function storyElectionSlateId(countryId, key) { return `slate:${storyElectionCountryId(countryId)}:${String(key).toLowerCase()}`; }
function storyElectionMandateId(countryId, sequence) { return `mandate:${storyElectionCountryId(countryId)}:${Math.max(0, Number(sequence) || 0)}`; }
function storyElectionId(countryId, sequence) { return `election:${storyElectionCountryId(countryId)}:${Math.max(1, Number(sequence) || 1)}`; }
function storyElectionOfficeHolderActorId(mandateId) { return `officeholder:${String(mandateId)}:executive`; }

function storyElectionSlates(countryId) {
    const state = storyElectionState(countryId);
    return STORY_ELECTION_SLATE_KEYS.map((key, index) => {
        const def = STORY_ELECTION_SLATES[key];
        return {
            id: storyElectionSlateId(countryId, key),
            key,
            countryId: storyElectionCountryId(countryId),
            name: `${state ? state.name : countryId} ${def.name}`,
            ballotOrder: index + 1,
            candidateModel: STORY_ELECTION_POLICY.candidateModel,
            stance: storyElectionClone(def.stance),
            issueWeights: storyElectionClone(def.issueWeights),
            endorsements: []
        };
    });
}

function storyElectionInitialMandate(ledger, countryId) {
    const state = storyElectionState(countryId);
    const id = storyElectionMandateId(countryId, 0);
    const oldName = typeof storyPresidentName === 'function'
        ? storyPresidentName(state) : `${state ? state.name : countryId} Yürütmesi`;
    const mandate = {
        id, countryId, sequence: 0, sourceElectionId: null,
        primarySlateId: storyElectionSlateId(countryId, 'CONTINUITY'),
        coalitionSlateIds: [storyElectionSlateId(countryId, 'CONTINUITY')],
        status: 'ACTIVE', startedAt: 0, endedAt: null,
        termEndsAt: STORY_ELECTION_POLICY.firstElectionBaseSeconds
            + Number(String(countryId).split(':').pop()) * STORY_ELECTION_POLICY.firstElectionCountryStaggerSeconds,
        officeHolder: {
            actorId: storyElectionOfficeHolderActorId(id), actorType: 'OFFICEHOLDER_PROXY',
            name: oldName, model: 'LEGACY_NAMED_EXECUTIVE_BRIDGED_PHASE_31'
        },
        resultModel: STORY_ELECTION_POLICY.resultModel
    };
    ledger.mandates[id] = mandate;
    return mandate;
}

function storyElectionCountryCreate(ledger, state) {
    const countryId = storyElectionCountryId(state.id);
    const institution = storyElectionInstitutionCountry(countryId);
    const model = storyElectionModel(countryId);
    const mandate = storyElectionInitialMandate(ledger, countryId);
    const nextElectionAt = model.competitive ? mandate.termEndsAt : null;
    return {
        countryId,
        regimeKey: String(institution && institution.regimeKey || 'PARLIAMENTARY_BALANCE'),
        electionModel: model.model,
        competitive: !!model.competitive,
        currentMandateId: mandate.id,
        nextElectionAt,
        electionIds: [],
        lastElectionId: null,
        transferCount: 0,
        updatedAt: storyElectionRound(STORY.clock)
    };
}

function storyElectionRecordEvent(ledger, type, details) {
    const event = Object.assign({
        id: `election-event:${ledger.nextEventSequence++}`,
        type: String(type), at: storyElectionRound(STORY.clock)
    }, storyElectionClone(details || {}));
    ledger.events.push(event);
    if (ledger.events.length > STORY_ELECTION_POLICY.maximumEvents) {
        ledger.events.splice(0, ledger.events.length - STORY_ELECTION_POLICY.maximumEvents);
    }
    return event;
}

function storyElectionLedgerCreate(options) {
    options = options || {};
    const ledger = {
        schemaVersion: STORY_ELECTION_SCHEMA_VERSION,
        adapterVersion: STORY_ELECTION_ADAPTER_VERSION,
        policyHash: STORY_ELECTION_POLICY_HASH,
        tickSequence: 0,
        lastTickAt: storyElectionRound(STORY.clock),
        nextElectionSequence: 1,
        nextMandateSequence: 1,
        nextEventSequence: 1,
        countries: {}, elections: {}, mandates: {}, events: [],
        diagnostics: {
            backfilled: !!options.backfilled,
            restoredFromInvalidLedger: !!options.restoredFromInvalidLedger,
            issues: (options.issues || []).slice(0, 50),
            warnings: options.backfilled
                ? ['Eski kayıtta seçim geçmişi yoktu; mevcut yürütme makamı başlangıç mandası olarak kaydedildi.'] : [],
            candidateModel: STORY_ELECTION_POLICY.candidateModel,
            voteModel: STORY_ELECTION_POLICY.voteModel,
            resultModel: STORY_ELECTION_POLICY.resultModel,
            randomDecisions: false, llmDecisions: false, directEconomicWrites: false
        }
    };
    for (const state of (STORY.states || [])) {
        const row = storyElectionCountryCreate(ledger, state);
        ledger.countries[row.countryId] = row;
    }
    return ledger;
}

function storyElectionAdultCohorts(countryId) {
    const regions = STORY.population && STORY.population.regions || {};
    const rows = [];
    for (const region of Object.values(regions)) {
        if (region.countryId !== countryId) continue;
        for (const cohort of region.cohorts || []) {
            if (cohort.ageBand === 'CHILD') continue;
            const opinion = STORY.publicOpinion && STORY.publicOpinion.cohorts
                ? STORY.publicOpinion.cohorts[cohort.id] || null : null;
            rows.push({ regionId: region.regionId, cohort, opinion });
        }
    }
    return rows.sort((a, b) => a.cohort.id.localeCompare(b.cohort.id, 'en'));
}

function storyElectionTurnoutBps(cohort, opinion, capacity) {
    const education = { BASIC: -900, PRIMARY: -350, SECONDARY: 300, TERTIARY: 850 }[cohort.education] || 0;
    const age = { YOUNG: 100, ADULT: 350, SENIOR: 600 }[cohort.ageBand] || 0;
    const grievance = storyElectionClampBps(opinion && opinion.rememberedSeverityBps);
    const legitimacy = storyElectionClampBps(capacity && capacity.legitimacyBps);
    return storyElectionClampBps(Math.max(STORY_ELECTION_POLICY.minimumTurnoutBps, Math.min(
        STORY_ELECTION_POLICY.maximumTurnoutBps,
        5400 + education + age + grievance * 0.16 + Math.abs(legitimacy - 5000) * 0.06
    )));
}

function storyElectionCohortAffinity(cohort, slateKey) {
    const scores = { CONTINUITY: 0, SOCIAL_COMPACT: 0, CIVIC_REFORM: 0, NATIONAL_DEVELOPMENT: 0 };
    if (cohort.occupation === 'PUBLIC') { scores.CONTINUITY += 900; scores.CIVIC_REFORM += 500; }
    if (cohort.occupation === 'DEFENSE') { scores.NATIONAL_DEVELOPMENT += 1250; scores.CONTINUITY += 500; }
    if (['AGRICULTURE', 'INDUSTRY', 'UNEMPLOYED', 'RETIRED'].includes(cohort.occupation)) scores.SOCIAL_COMPACT += 900;
    if (cohort.occupation === 'SERVICES' || cohort.occupation === 'STUDENT') scores.CIVIC_REFORM += 850;
    if (cohort.identity === 'NATIONAL') scores.NATIONAL_DEVELOPMENT += 650;
    if (cohort.identity === 'COSMOPOLITAN') scores.CIVIC_REFORM += 650;
    if (cohort.identity === 'LOCAL') scores.SOCIAL_COMPACT += 350;
    if (cohort.incomeBand === 'UPPER_MIDDLE') scores.CONTINUITY += 350;
    if (cohort.incomeBand === 'LOW') scores.SOCIAL_COMPACT += 450;
    return scores[slateKey] || 0;
}

function storyElectionIssuePressure(opinion, slateKey) {
    const def = STORY_ELECTION_SLATES[slateKey];
    let weighted = 0;
    let total = 0;
    for (const record of opinion && opinion.records || []) {
        const severity = storyElectionClampBps(record.rememberedSeverityBps);
        const weight = Number(def.issueWeights[record.problemType]) || 0;
        weighted += severity * weight;
        total += 100;
    }
    return total ? Math.round(weighted / total * 0.55) : 0;
}

function storyElectionLegacyPoliticalAlignment(countryId, slateKey) {
    const state = storyElectionState(countryId);
    const axes = state && state.gov && state.gov.president && state.gov.president.axes || {};
    const ideal = STORY_ELECTION_LEGACY_AXIS_IDEALS[slateKey];
    if (!ideal) return 0;
    const distance = ['hawk', 'auth', 'pop', 'nat'].reduce((sum, key) => (
        sum + Math.abs((Number(axes[key]) || 50) - ideal[key])
    ), 0) / 4;
    return Math.max(0, Math.round(3000 - distance * 55));
}

function storyElectionEndorsements(countryId, slates) {
    const country = STORY.powerCenters && STORY.powerCenters.countries
        ? STORY.powerCenters.countries[countryId] : null;
    const centerIds = country && country.centerIds || [];
    for (const centerId of centerIds) {
        const center = STORY.powerCenters.centers && STORY.powerCenters.centers[centerId];
        if (!center || center.status !== 'ACTIVE') continue;
        const ranked = slates.map(slate => ({
            slate,
            affinity: Number(STORY_ELECTION_SLATES[slate.key].centerAffinity[center.type]) || 0
        })).sort((a, b) => b.affinity - a.affinity || a.slate.id.localeCompare(b.slate.id, 'en'));
        if (!ranked[0] || ranked[0].affinity <= 0) continue;
        ranked[0].slate.endorsements.push({
            powerCenterId: center.id, type: center.type,
            influenceBps: storyElectionClampBps(center.influenceBps),
            affinityBps: storyElectionClampBps(ranked[0].affinity * 100),
            public: true
        });
    }
}

function storyElectionCandidateScore(slate, cohort, opinion, capacity, model) {
    const grievance = storyElectionClampBps(opinion && opinion.rememberedSeverityBps);
    const legitimacy = storyElectionClampBps(capacity && capacity.legitimacyBps);
    const base = 2500;
    const cohortAffinity = storyElectionCohortAffinity(cohort, slate.key);
    const issueFit = storyElectionIssuePressure(opinion, slate.key);
    const politicalAlignment = storyElectionLegacyPoliticalAlignment(slate.countryId, slate.key);
    const incumbent = slate.key === 'CONTINUITY'
        ? Math.round((legitimacy - 5000) * 0.20 + (5000 - grievance) * 0.15) : 0;
    const changeDemand = slate.key !== 'CONTINUITY' ? Math.round((grievance - 3500) * 0.25) : 0;
    const endorsement = Math.round((slate.endorsements || []).reduce((sum, row) => (
        sum + row.influenceBps * row.affinityBps / 10000
    ), 0) * 0.12);
    const restrictedBias = model.model === 'RESTRICTED_EXECUTIVE_CONTEST' && slate.key === 'CONTINUITY' ? 1100 : 0;
    return {
        total: Math.max(1, base + cohortAffinity + issueFit + politicalAlignment + incumbent + changeDemand + endorsement + restrictedBias),
        components: { base, cohortAffinity, issueFit, politicalAlignment, incumbent, changeDemand, endorsement, restrictedBias }
    };
}

function storyElectionAllocateExact(total, scored) {
    const sum = scored.reduce((out, row) => out + row.score, 0) || 1;
    const exact = scored.map(row => total * row.score / sum);
    const values = exact.map(Math.floor);
    let remainder = total - values.reduce((out, value) => out + value, 0);
    exact.map((value, index) => ({ index, fraction: value - Math.floor(value), id: scored[index].id }))
        .sort((a, b) => b.fraction - a.fraction || a.id.localeCompare(b.id, 'en'))
        .slice(0, remainder).forEach(row => { values[row.index]++; });
    return values;
}

function storyElectionCount(election) {
    const country = STORY.stateCapacity && STORY.stateCapacity.countries
        ? STORY.stateCapacity.countries[election.countryId] : null;
    const model = storyElectionModel(election.countryId);
    const slates = storyElectionSlates(election.countryId);
    storyElectionEndorsements(election.countryId, slates);
    const totals = Object.fromEntries(slates.map(slate => [slate.id, 0]));
    const ballots = [];
    let eligiblePeople = 0;
    let castVotes = 0;
    for (const row of storyElectionAdultCohorts(election.countryId)) {
        const eligible = Math.max(0, Math.floor(Number(row.cohort.membersPeople) || 0));
        const turnoutBps = storyElectionTurnoutBps(row.cohort, row.opinion, country);
        const cast = Math.max(0, Math.min(eligible, Math.round(eligible * turnoutBps / 10000)));
        const scored = slates.map(slate => {
            const result = storyElectionCandidateScore(slate, row.cohort, row.opinion, country, model);
            return { id: slate.id, score: result.total, components: result.components };
        });
        const allocated = storyElectionAllocateExact(cast, scored);
        const votesBySlate = {};
        scored.forEach((score, index) => {
            votesBySlate[score.id] = allocated[index];
            totals[score.id] += allocated[index];
        });
        eligiblePeople += eligible;
        castVotes += cast;
        ballots.push({
            cohortId: row.cohort.id, regionId: row.regionId,
            eligiblePeople: eligible, turnoutBps, castVotes: cast,
            votesBySlate,
            scoreComponentsBySlate: Object.fromEntries(scored.map(score => [score.id, score.components])),
            dominantProblemType: row.opinion && row.opinion.dominantProblemType || null,
            rememberedSeverityBps: storyElectionClampBps(row.opinion && row.opinion.rememberedSeverityBps)
        });
    }
    const ranked = slates.map(slate => ({
        slateId: slate.id, slateKey: slate.key, name: slate.name,
        votes: totals[slate.id], voteShareBps: castVotes ? storyElectionClampBps(totals[slate.id] * 10000 / castVotes) : 0
    })).sort((a, b) => b.votes - a.votes || a.slateId.localeCompare(b.slateId, 'en'));
    const coalition = [];
    if (model.coalition && ranked[0]) {
        coalition.push(ranked[0].slateId);
        if (ranked[0].voteShareBps < 5001 && ranked[1]) coalition.push(ranked[1].slateId);
    }
    const marginVotes = ranked.length > 1 ? ranked[0].votes - ranked[1].votes : castVotes;
    const marginBps = castVotes ? storyElectionClampBps(marginVotes * 10000 / castVotes) : 10000;
    return {
        candidates: slates,
        cohortBallots: ballots,
        totals: ranked,
        eligiblePeople, castVotes,
        turnoutBps: eligiblePeople ? storyElectionClampBps(castVotes * 10000 / eligiblePeople) : 0,
        winnerSlateId: ranked[0] ? ranked[0].slateId : null,
        coalitionSlateIds: coalition.length ? coalition : (ranked[0] ? [ranked[0].slateId] : []),
        marginVotes, marginBps,
        sourceTicks: {
            population: STORY.population ? STORY.population.tickSequence : null,
            opinion: STORY.publicOpinion ? STORY.publicOpinion.tickSequence : null,
            powerCenters: STORY.powerCenters ? STORY.powerCenters.tickSequence : null,
            institutions: STORY.institutions ? STORY.institutions.tickSequence : null,
            stateCapacity: STORY.stateCapacity ? STORY.stateCapacity.tickSequence : null
        }
    };
}

function storyElectionShouldContest(marginBps, ruleOfLawBps) {
    return storyElectionClampBps(marginBps) <= STORY_ELECTION_POLICY.contestMarginBps
        && storyElectionClampBps(ruleOfLawBps) < STORY_ELECTION_POLICY.contestRuleOfLawThresholdBps;
}

function storyElectionSchedule(ledger, country) {
    if (!country.competitive || country.nextElectionAt == null) return null;
    const already = country.electionIds.map(id => ledger.elections[id]).find(row => (
        row && !['CERTIFIED', 'CANCELLED'].includes(row.status)
    ));
    if (already) return already;
    const id = storyElectionId(country.countryId, ledger.nextElectionSequence++);
    const model = storyElectionModel(country.countryId);
    const election = {
        id, countryId: country.countryId, regimeKey: country.regimeKey,
        electionModel: model.model,
        status: 'SCHEDULED', scheduledAt: storyElectionRound(country.nextElectionAt),
        campaignStartsAt: storyElectionRound(country.nextElectionAt - model.campaignSeconds),
        countedAt: null, contestedAt: null, contestResolvesAt: null, certifiedAt: null,
        incumbentMandateId: country.currentMandateId,
        candidates: storyElectionSlates(country.countryId),
        cohortBallots: [], totals: [], eligiblePeople: 0, castVotes: 0,
        turnoutBps: 0, winnerSlateId: null, coalitionSlateIds: [],
        marginVotes: 0, marginBps: 0, contest: null, resultingMandateId: null,
        resultModel: STORY_ELECTION_POLICY.resultModel
    };
    ledger.elections[id] = election;
    country.electionIds.push(id);
    country.updatedAt = storyElectionRound(STORY.clock);
    storyElectionRecordEvent(ledger, 'ELECTION_SCHEDULED', {
        electionId: id, countryId: country.countryId,
        scheduledAt: election.scheduledAt, electionModel: election.electionModel
    });
    return election;
}

function storyElectionCreateMandate(ledger, country, election) {
    const id = storyElectionMandateId(country.countryId, ledger.nextMandateSequence++);
    const primary = election.candidates.find(row => row.id === election.winnerSlateId);
    const coalition = election.coalitionSlateIds.slice();
    const old = ledger.mandates[country.currentMandateId];
    if (old) { old.status = 'ENDED'; old.endedAt = storyElectionRound(STORY.clock); }
    const model = storyElectionModel(country.countryId);
    const mandate = {
        id, countryId: country.countryId,
        sequence: ledger.nextMandateSequence - 1,
        sourceElectionId: election.id,
        primarySlateId: election.winnerSlateId,
        coalitionSlateIds: coalition,
        status: 'ACTIVE', startedAt: storyElectionRound(STORY.clock), endedAt: null,
        termEndsAt: storyElectionRound((Number(STORY.clock) || 0) + model.termSeconds),
        officeHolder: {
            actorId: storyElectionOfficeHolderActorId(id), actorType: 'OFFICEHOLDER_PROXY',
            name: coalition.length > 1
                ? `${primary ? primary.name : 'Koalisyon'} öncülüğündeki koalisyon`
                : `${primary ? primary.name : 'Seçilmiş liste'} yürütmesi`,
            model: STORY_ELECTION_POLICY.officeHolderModel
        },
        resultModel: STORY_ELECTION_POLICY.resultModel
    };
    ledger.mandates[id] = mandate;
    country.currentMandateId = id;
    country.lastElectionId = election.id;
    country.transferCount++;
    country.nextElectionAt = mandate.termEndsAt;
    country.updatedAt = storyElectionRound(STORY.clock);
    election.resultingMandateId = id;
    return mandate;
}

function storyElectionCertify(ledger, country, election, reasonCode) {
    election.status = 'CERTIFIED';
    election.certifiedAt = storyElectionRound(STORY.clock);
    const mandate = storyElectionCreateMandate(ledger, country, election);
    storyElectionRecordEvent(ledger, 'ELECTION_CERTIFIED', {
        electionId: election.id, countryId: election.countryId,
        winnerSlateId: election.winnerSlateId,
        coalitionSlateIds: election.coalitionSlateIds,
        turnoutBps: election.turnoutBps, marginBps: election.marginBps,
        resultingMandateId: mandate.id, reasonCode,
        physicalMutation: false
    });
}

function storyElectionAdvance(ledger, country, election) {
    const now = Number(STORY.clock) || 0;
    const institution = storyElectionInstitutionCountry(country.countryId);
    const model = storyElectionModel(country.countryId);
    if (!institution || institution.regimeKey !== election.regimeKey || model.model !== election.electionModel) {
        election.status = 'CANCELLED';
        storyElectionRecordEvent(ledger, 'ELECTION_CANCELLED_REGIME_CHANGED', {
            electionId: election.id, countryId: election.countryId
        });
        return;
    }
    if (election.status === 'SCHEDULED' && now >= election.campaignStartsAt) {
        election.status = 'CAMPAIGN';
        storyElectionRecordEvent(ledger, 'ELECTION_CAMPAIGN_STARTED', {
            electionId: election.id, countryId: election.countryId,
            candidateSlateIds: election.candidates.map(row => row.id)
        });
    }
    if (election.status === 'CAMPAIGN' && now >= election.scheduledAt) {
        const count = storyElectionCount(election);
        Object.assign(election, count, { status: 'COUNTED', countedAt: storyElectionRound(now) });
        storyElectionRecordEvent(ledger, 'ELECTION_COUNTED', {
            electionId: election.id, countryId: election.countryId,
            eligiblePeople: election.eligiblePeople, castVotes: election.castVotes,
            turnoutBps: election.turnoutBps, winnerSlateId: election.winnerSlateId,
            marginBps: election.marginBps
        });
        const capacity = STORY.stateCapacity && STORY.stateCapacity.countries
            ? STORY.stateCapacity.countries[election.countryId] : null;
        const contested = storyElectionShouldContest(
            election.marginBps,
            capacity && capacity.ruleOfLawBps
        );
        if (contested) {
            election.status = 'CONTESTED';
            election.contestedAt = storyElectionRound(now);
            election.contestResolvesAt = storyElectionRound(now + STORY_ELECTION_POLICY.contestResolutionSeconds);
            election.contest = {
                reasonCode: 'NARROW_MARGIN_AND_WEAK_RULE_OF_LAW',
                filedBySlateId: election.totals[1] && election.totals[1].slateId || null,
                adjudicatorInstitutionId: `institution:${election.countryId}:judiciary`,
                resolved: false, resolutionCode: null
            };
            storyElectionRecordEvent(ledger, 'ELECTION_CONTESTED', {
                electionId: election.id, countryId: election.countryId,
                marginBps: election.marginBps, ruleOfLawBps: capacity && capacity.ruleOfLawBps
            });
        } else {
            storyElectionCertify(ledger, country, election, 'COUNT_CERTIFIED');
        }
    }
    if (election.status === 'CONTESTED' && now >= election.contestResolvesAt) {
        const capacity = STORY.stateCapacity && STORY.stateCapacity.countries
            ? STORY.stateCapacity.countries[election.countryId] : null;
        election.contest.resolved = true;
        election.contest.resolutionCode = storyElectionClampBps(capacity && capacity.ruleOfLawBps) >= 2500
            ? 'JUDICIAL_RECOUNT_CONFIRMED' : 'ADMINISTRATIVE_COUNT_CONFIRMED_WITH_LOW_CONFIDENCE';
        storyElectionCertify(ledger, country, election, election.contest.resolutionCode);
    }
}

function storyElectionReconcileCountries(ledger) {
    for (const state of (STORY.states || [])) {
        const countryId = storyElectionCountryId(state.id);
        const institution = storyElectionInstitutionCountry(countryId);
        const regimeKey = String(institution && institution.regimeKey || 'PARLIAMENTARY_BALANCE');
        const model = storyElectionModel(countryId);
        let country = ledger.countries[countryId];
        if (!country) {
            country = storyElectionCountryCreate(ledger, state);
            ledger.countries[countryId] = country;
        }
        if (country.regimeKey !== regimeKey || country.electionModel !== model.model) {
            for (const electionId of country.electionIds || []) {
                const openElection = ledger.elections[electionId];
                if (!openElection || ['CERTIFIED', 'CANCELLED'].includes(openElection.status)) continue;
                openElection.status = 'CANCELLED';
                storyElectionRecordEvent(ledger, 'ELECTION_CANCELLED_REGIME_CHANGED', {
                    electionId, countryId, previousRegimeKey: country.regimeKey, nextRegimeKey: regimeKey
                });
            }
            country.regimeKey = regimeKey;
            country.electionModel = model.model;
            country.competitive = !!model.competitive;
            country.nextElectionAt = model.competitive
                ? storyElectionRound((Number(STORY.clock) || 0) + model.termSeconds) : null;
            storyElectionRecordEvent(ledger, 'ELECTORAL_REGIME_RECONCILED', {
                countryId, regimeKey, electionModel: model.model
            });
            country.updatedAt = storyElectionRound(STORY.clock);
        }
    }
}

function storyElectionValidate(ledger) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) {
        return { ok: false, issues: [{ code: 'ELECTION_LEDGER_REQUIRED', path: '$', message: 'Seçim defteri zorunlu.' }] };
    }
    if (ledger.schemaVersion !== STORY_ELECTION_SCHEMA_VERSION) add('ELECTION_SCHEMA_VERSION', '$.schemaVersion', 'Seçim şeması uyuşmuyor.');
    if (ledger.adapterVersion !== STORY_ELECTION_ADAPTER_VERSION) add('ELECTION_ADAPTER_VERSION', '$.adapterVersion', 'Seçim adaptörü uyuşmuyor.');
    if (ledger.policyHash !== STORY_ELECTION_POLICY_HASH) add('ELECTION_POLICY_HASH', '$.policyHash', 'Seçim politika karması uyuşmuyor.');
    const knownCountries = new Set((STORY.states || []).map(state => storyElectionCountryId(state.id)));
    for (const countryId of knownCountries) {
        const country = ledger.countries && ledger.countries[countryId];
        if (!country) { add('ELECTION_COUNTRY_REQUIRED', `$.countries.${countryId}`, 'Ülke seçim kaydı eksik.'); continue; }
        if (!ledger.mandates || !ledger.mandates[country.currentMandateId]) add('ELECTION_CURRENT_MANDATE', `$.countries.${countryId}.currentMandateId`, 'Etkin mandat bulunamadı.');
        const institution = storyElectionInstitutionCountry(countryId);
        if (institution && country.regimeKey !== institution.regimeKey) add('ELECTION_REGIME_STALE', `$.countries.${countryId}.regimeKey`, 'Seçim rejimi kurum şemasıyla uyuşmuyor.');
    }
    const mandateIds = new Set();
    for (const mandate of Object.values(ledger.mandates || {})) {
        if (!mandate || !mandate.id || mandateIds.has(mandate.id)) add('ELECTION_MANDATE_ID', '$.mandates', 'Mandat kimliği eksik veya yinelenmiş.');
        else mandateIds.add(mandate.id);
        if (!knownCountries.has(mandate && mandate.countryId)) add('ELECTION_MANDATE_COUNTRY', `$.mandates.${mandate && mandate.id}`, 'Mandat ülkesi bilinmiyor.');
        if (!mandate || !mandate.officeHolder || mandate.officeHolder.model == null) add('ELECTION_OFFICE_HOLDER', `$.mandates.${mandate && mandate.id}`, 'Mandat açık makam vekili taşımalı.');
        if (mandate && mandate.resultModel !== STORY_ELECTION_POLICY.resultModel) add('ELECTION_RESULT_MODEL', `$.mandates.${mandate.id}.resultModel`, 'Mandat fiziksel sonuç uyduramaz.');
    }
    for (const election of Object.values(ledger.elections || {})) {
        const path = `$.elections.${election && election.id}`;
        if (!election || !election.id || !knownCountries.has(election.countryId)) { add('ELECTION_IDENTITY', path, 'Seçim kimliği veya ülkesi geçersiz.'); continue; }
        if (!STORY_ELECTION_STATUSES.includes(election.status)) add('ELECTION_STATUS', `${path}.status`, 'Seçim durumu geçersiz.');
        if (!Array.isArray(election.candidates) || election.candidates.length !== STORY_ELECTION_SLATE_KEYS.length) add('ELECTION_CANDIDATES', `${path}.candidates`, 'Seçim dört sürümlü liste taşımalı.');
        const candidateIds = new Set((election.candidates || []).map(row => row.id));
        if (candidateIds.size !== (election.candidates || []).length) add('ELECTION_CANDIDATE_DUPLICATE', `${path}.candidates`, 'Aday listesi yineleniyor.');
        if (['COUNTED', 'CONTESTED', 'CERTIFIED'].includes(election.status)) {
            const totalVotes = (election.totals || []).reduce((sum, row) => sum + Math.max(0, Number(row.votes) || 0), 0);
            if (totalVotes !== election.castVotes) add('ELECTION_VOTE_TOTAL', `${path}.totals`, 'Liste oyları kullanılan oylarla tam uyuşmalı.');
            const ballotVotes = (election.cohortBallots || []).reduce((sum, ballot) => (
                sum + Object.values(ballot.votesBySlate || {}).reduce((out, vote) => out + vote, 0)
            ), 0);
            if (ballotVotes !== election.castVotes) add('ELECTION_BALLOT_TOTAL', `${path}.cohortBallots`, 'Kohort oyları toplam oyla tam uyuşmalı.');
            if (!candidateIds.has(election.winnerSlateId)) add('ELECTION_WINNER', `${path}.winnerSlateId`, 'Kazanan aday listesinde bulunmalı.');
        }
        if (election.status === 'CERTIFIED' && (!election.resultingMandateId || !ledger.mandates[election.resultingMandateId])) add('ELECTION_CERTIFIED_MANDATE', path, 'Sertifikalı seçim yeni mandat üretmeli.');
        if (election.resultModel !== STORY_ELECTION_POLICY.resultModel) add('ELECTION_PHYSICAL_RESULT', `${path}.resultModel`, 'Seçim fiziksel ekonomi sonucu yazamaz.');
    }
    if (Object.keys(ledger.elections || {}).length > STORY_ELECTION_POLICY.maximumElections) add('ELECTION_LIMIT', '$.elections', 'Seçim kayıt bütçesi aşıldı.');
    if (Object.keys(ledger.mandates || {}).length > STORY_ELECTION_POLICY.maximumMandates) add('ELECTION_MANDATE_LIMIT', '$.mandates', 'Mandat kayıt bütçesi aşıldı.');
    if (!Array.isArray(ledger.events) || ledger.events.length > STORY_ELECTION_POLICY.maximumEvents) add('ELECTION_EVENT_LIMIT', '$.events', 'Seçim olay bütçesi aşıldı.');
    return { ok: issues.length === 0, issues };
}

function storyElectionReset(options) {
    if (!storyElectionEnabled()) { STORY.elections = null; return null; }
    STORY.elections = storyElectionLedgerCreate(options);
    return STORY.elections;
}
function storyElectionEnsure() {
    if (!storyElectionEnabled()) return null;
    const ledger = STORY.elections || storyElectionReset({ backfilled: true });
    storyElectionReconcileCountries(ledger);
    return ledger;
}
// Kayıt açılırken kurum defteri makam kimliğini seçim mandatından türetir.
// Tam restore/reconcile henüz kurumlar yokken yapılamaz; buna karşılık doğrulanmış
// seçim anlık görüntüsü, kurum restore'u başlamadan salt-okunur kaynak olarak
// hazırlanmalıdır. Böylece makam önce eski kimliğe, sonra seçilmiş kimliğe gidip
// iki sahte AUTHORITY_SCHEMA_RECONCILED olayı üretmez.
function storyElectionPrimeRestore(saved) {
    if (!storyElectionEnabled() || !saved) { STORY.elections = null; return null; }
    const candidate = storyElectionClone(saved);
    if (!storyElectionValidate(candidate).ok) { STORY.elections = null; return null; }
    STORY.elections = candidate;
    return candidate;
}
function storyElectionRestore(saved) {
    if (!storyElectionEnabled()) { STORY.elections = null; return null; }
    if (!saved) return storyElectionReset({ backfilled: true });
    const candidate = storyElectionClone(saved);
    const validation = storyElectionValidate(candidate);
    if (validation.ok) { STORY.elections = candidate; storyElectionReconcileCountries(candidate); return candidate; }
    const ledger = storyElectionLedgerCreate({ backfilled: true, restoredFromInvalidLedger: true, issues: validation.issues });
    ledger.diagnostics.warnings.push('Bozuk seçim defteri kullanılmadı; mevcut yürütme makamından güvenli başlangıç kuruldu.');
    STORY.elections = ledger;
    return ledger;
}
function storyElectionForSave() {
    const ledger = storyElectionEnsure();
    if (!ledger) return null;
    const validation = storyElectionValidate(ledger);
    if (!validation.ok) throw new Error(`Geçersiz seçim defteri: ${validation.issues[0].code}`);
    return storyElectionClone(ledger);
}
function storyElectionTick() {
    const ledger = storyElectionEnsure();
    if (!ledger) return { disabled: true };
    for (const country of Object.values(ledger.countries).sort((a, b) => a.countryId.localeCompare(b.countryId, 'en'))) {
        const election = storyElectionSchedule(ledger, country);
        if (election) storyElectionAdvance(ledger, country, election);
    }
    ledger.tickSequence++;
    ledger.lastTickAt = storyElectionRound(STORY.clock);
    return {
        disabled: false, tickSequence: ledger.tickSequence,
        electionCount: Object.keys(ledger.elections).length,
        mandateCount: Object.keys(ledger.mandates).length
    };
}

// Kurum katmanı bu salt-okunur makam görünümünü kullanır. ensure çağrılmaz;
// bir UI veya kurum görünümü seçim zamanı ilerletemez.
function storyElectionExecutiveHolder(countryId) {
    const ledger = storyElectionEnabled() ? STORY.elections : null;
    const country = ledger && ledger.countries[storyElectionCountryId(countryId)];
    const mandate = country && ledger.mandates[country.currentMandateId];
    return mandate ? storyElectionClone(mandate.officeHolder) : null;
}
function storyElectionCountryView(countryId) {
    const ledger = storyElectionEnabled() ? STORY.elections : null;
    const id = storyElectionCountryId(countryId);
    const country = ledger && ledger.countries[id];
    if (!country) return null;
    const out = storyElectionClone(country);
    out.currentMandate = storyElectionClone(ledger.mandates[country.currentMandateId]);
    out.elections = country.electionIds.map(electionId => storyElectionClone(ledger.elections[electionId])).filter(Boolean)
        .sort((a, b) => Number(b.scheduledAt) - Number(a.scheduledAt));
    return out;
}
function storyElectionPublicView(value) {
    if (!value) return null;
    return {
        countryId: value.countryId,
        regimeKey: value.regimeKey,
        electionModel: value.electionModel,
        competitive: !!value.competitive,
        nextElectionAt: value.nextElectionAt,
        currentMandate: value.currentMandate ? {
            id: value.currentMandate.id,
            primarySlateId: value.currentMandate.primarySlateId,
            coalitionSlateIds: (value.currentMandate.coalitionSlateIds || []).slice(),
            startedAt: value.currentMandate.startedAt,
            termEndsAt: value.currentMandate.termEndsAt,
            officeHolderName: value.currentMandate.officeHolder && value.currentMandate.officeHolder.name,
            officeHolderModel: value.currentMandate.officeHolder && value.currentMandate.officeHolder.model
        } : null,
        elections: (value.elections || []).map(election => ({
            id: election.id, status: election.status,
            scheduledAt: election.scheduledAt, electionModel: election.electionModel,
            candidates: (election.candidates || []).map(slate => ({
                id: slate.id, key: slate.key, name: slate.name,
                candidateModel: slate.candidateModel,
                publicEndorsements: (slate.endorsements || []).filter(row => row.public).map(row => ({ powerCenterId: row.powerCenterId, type: row.type }))
            })),
            totals: storyElectionClone(election.totals || []),
            eligiblePeople: election.eligiblePeople,
            castVotes: election.castVotes,
            turnoutBps: election.turnoutBps,
            winnerSlateId: election.winnerSlateId,
            coalitionSlateIds: (election.coalitionSlateIds || []).slice(),
            marginBps: election.marginBps,
            contest: election.contest ? {
                reasonCode: election.contest.reasonCode,
                filedBySlateId: election.contest.filedBySlateId,
                resolved: election.contest.resolved,
                resolutionCode: election.contest.resolutionCode
            } : null,
            certifiedAt: election.certifiedAt
        }))
    };
}
function storyElectionSummary() {
    const ledger = storyElectionEnabled() ? STORY.elections : null;
    if (!ledger) return {
        schemaVersion: STORY_ELECTION_SCHEMA_VERSION,
        adapterVersion: STORY_ELECTION_ADAPTER_VERSION,
        disabled: true, countryCount: 0, electionCount: 0, mandateCount: 0
    };
    const elections = Object.values(ledger.elections || {});
    return {
        schemaVersion: ledger.schemaVersion, adapterVersion: ledger.adapterVersion,
        policyHash: ledger.policyHash, disabled: false,
        tickSequence: ledger.tickSequence,
        countryCount: Object.keys(ledger.countries || {}).length,
        electionCount: elections.length,
        campaignCount: elections.filter(row => row.status === 'CAMPAIGN').length,
        contestedCount: elections.filter(row => row.contest != null).length,
        certifiedCount: elections.filter(row => row.status === 'CERTIFIED').length,
        mandateCount: Object.keys(ledger.mandates || {}).length,
        transferCount: Object.values(ledger.countries || {}).reduce((sum, row) => sum + row.transferCount, 0),
        eligiblePeople: elections.reduce((sum, row) => sum + row.eligiblePeople, 0),
        castVotes: elections.reduce((sum, row) => sum + row.castVotes, 0),
        eventCount: ledger.events.length
    };
}
