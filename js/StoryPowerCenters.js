// ============================================================================
//  GUC MERKEZLERI — Faz 28
//  --------------------------------------------------------------------------
//  Eski fraksiyon destek puanlarini "kurum" diye yeniden adlandirmaz. Her guc
//  merkezi kanonik nufus, sirket, butce, komutan, garnizon ve kolektif eylem
//  kayitlarindan kaynak/destek/kapasite kaniti toplar. Bu faz eylem yetkisi
//  vermez; Faz 29 gelene kadar yalniz mekanik olarak dogrulanmis niyet sinirlari
//  aciklanir. LLM sayi, lider, amac veya kapasite uretmez.
// ============================================================================

const STORY_POWER_CENTER_SCHEMA_VERSION = 1;
const STORY_POWER_CENTER_ADAPTER_VERSION = 'story-power-center-ledger-1';
const STORY_POWER_CENTER_TYPES = Object.freeze([
    'ARMED_FORCES', 'BUSINESS_COUNCIL', 'LABOR_CONFEDERATION',
    'CIVIL_SERVICE', 'MEDIA_NETWORK', 'SECURITY_SERVICE', 'RADICAL_NETWORK'
]);
const STORY_POWER_CENTER_DEFS = Object.freeze({
    ARMED_FORCES: Object.freeze({
        name: 'Silahlı Kuvvetler', legacyFaction: 'military',
        declaredActions: Object.freeze(['ADVISE_SECURITY', 'REQUEST_READINESS_BUDGET', 'MOBILIZE_FORCE']),
        objectiveCodes: Object.freeze(['FORCE_READINESS', 'BUDGET_SECURITY', 'TERRITORIAL_ORDER'])
    }),
    BUSINESS_COUNCIL: Object.freeze({
        name: 'İş Dünyası Konseyi', legacyFaction: 'business',
        declaredActions: Object.freeze(['LOBBY_POLICY', 'COORDINATE_INVESTMENT', 'WITHHOLD_INVESTMENT']),
        objectiveCodes: Object.freeze(['MARKET_STABILITY', 'LOGISTICS_OPEN', 'CAPITAL_PRESERVATION'])
    }),
    LABOR_CONFEDERATION: Object.freeze({
        name: 'Emek Konfederasyonu', legacyFaction: 'workers',
        declaredActions: Object.freeze(['NEGOTIATE_LABOR', 'MOBILIZE_PROTEST', 'CALL_STRIKE']),
        objectiveCodes: Object.freeze(['EMPLOYMENT_SECURITY', 'INCOME_SECURITY', 'PUBLIC_SERVICES'])
    }),
    CIVIL_SERVICE: Object.freeze({
        name: 'Kamu İdaresi', legacyFaction: 'intel',
        declaredActions: Object.freeze(['ADVISE_ADMINISTRATION', 'DELAY_IMPLEMENTATION', 'REPORT_CAPACITY']),
        objectiveCodes: Object.freeze(['ADMIN_CAPACITY', 'BUDGET_CONTINUITY', 'LEGAL_CONTINUITY'])
    }),
    MEDIA_NETWORK: Object.freeze({
        name: 'Medya Ağı', legacyFaction: 'intel',
        declaredActions: Object.freeze(['PUBLISH_POSITION', 'INVESTIGATE_PUBLIC_EVENT', 'WITHHOLD_ENDORSEMENT']),
        objectiveCodes: Object.freeze(['INFORMATION_ACCESS', 'PRESS_AUTONOMY', 'AUDIENCE_TRUST'])
    }),
    SECURITY_SERVICE: Object.freeze({
        name: 'İç Güvenlik Ağı', legacyFaction: 'military',
        declaredActions: Object.freeze(['ASSESS_INTERNAL_THREAT', 'REQUEST_SECURITY_RESOURCES', 'CONTAIN_VIOLENCE']),
        objectiveCodes: Object.freeze(['INTERNAL_ORDER', 'COUNTER_RADICALIZATION', 'EXECUTIVE_CONTINUITY'])
    }),
    RADICAL_NETWORK: Object.freeze({
        name: 'Radikal Ağlar', legacyFaction: 'radicals',
        declaredActions: Object.freeze(['RECRUIT_GRIEVANCE', 'MOBILIZE_PROTEST', 'ESCALATE_DISRUPTION']),
        objectiveCodes: Object.freeze(['MASS_MOBILIZATION', 'GRIEVANCE_ESCALATION', 'REGIME_DISRUPTION'])
    })
});
const STORY_POWER_CENTER_POLICY = Object.freeze({
    maximumEvents: 256,
    centersPerCountry: STORY_POWER_CENTER_TYPES.length,
    organizationRiseRateBps: 2400,
    organizationDecayRateBps: 900,
    influenceRiseRateBps: 2000,
    influenceDecayRateBps: 1100,
    leaderModel: 'OFFICEHOLDER_PROXY_PRE_PHASE_34',
    authorityModel: 'DECLARED_LIMITS_PRE_PHASE_29',
    mediaCapacityModel: 'EDUCATED_SERVICE_REACH_PROXY_PRE_PHASE_39',
    securityCapacityModel: 'DEFENSE_PUBLIC_PERSONNEL_PROXY_PRE_PHASE_47'
});
const STORY_POWER_CENTER_POLICY_HASH = storyProductionHash({
    schemaVersion: STORY_POWER_CENTER_SCHEMA_VERSION,
    adapterVersion: STORY_POWER_CENTER_ADAPTER_VERSION,
    types: STORY_POWER_CENTER_TYPES,
    definitions: STORY_POWER_CENTER_DEFS,
    policy: STORY_POWER_CENTER_POLICY
});

function storyPowerCenterEnabled() {
    return (typeof storyFeatureEnabled !== 'function' || storyFeatureEnabled('society.powerCenters'))
        && (typeof storyPopulationEnabled !== 'function' || storyPopulationEnabled())
        && (typeof storyCompanyEnabled !== 'function' || storyCompanyEnabled());
}

function storyPowerCenterClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyPowerCenterRound(value, digits) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    const factor = 10 ** (digits == null ? 6 : digits);
    return Math.round(number * factor) / factor;
}

function storyPowerCenterClampBps(value) {
    return Math.max(0, Math.min(10000, Math.round(Number(value) || 0)));
}

function storyPowerCenterCountryId(value) {
    const raw = String(value == null ? '' : value);
    return raw.startsWith('country:') ? raw : `country:${Number(value)}`;
}

function storyPowerCenterRegionId(value) {
    const raw = String(value == null ? '' : value);
    return raw.startsWith('region:') ? raw : `region:${Number(value)}`;
}

function storyPowerCenterId(countryId, type) {
    return `power-center:${storyPowerCenterCountryId(countryId)}:${String(type).toLowerCase()}`;
}

function storyPowerCenterLerp(from, to, riseRateBps, decayRateBps) {
    const before = storyPowerCenterClampBps(from);
    const target = storyPowerCenterClampBps(to);
    if (before === target) return before;
    const rate = target > before ? riseRateBps : decayRateBps;
    const step = Math.max(1, Math.round(Math.abs(target - before) * rate / 10000));
    return target > before ? Math.min(target, before + step) : Math.max(target, before - step);
}

function storyPowerCenterCohortWeightBps(type, cohort) {
    const occupation = String(cohort && cohort.occupation || '');
    const income = String(cohort && cohort.incomeBand || '');
    const education = String(cohort && cohort.education || '');
    const age = String(cohort && cohort.ageBand || '');
    let weight = 0;
    if (type === 'ARMED_FORCES') weight = occupation === 'DEFENSE' ? 10000 : 0;
    else if (type === 'BUSINESS_COUNCIL') {
        if (occupation === 'INDUSTRY') weight += 2600;
        if (occupation === 'SERVICES') weight += 3600;
        if (income === 'UPPER_MIDDLE') weight += 4200;
        if (income === 'MIDDLE') weight += 900;
    } else if (type === 'LABOR_CONFEDERATION') {
        if (occupation === 'AGRICULTURE') weight += 7200;
        if (occupation === 'INDUSTRY') weight += 8200;
        if (occupation === 'SERVICES') weight += 4200;
        if (occupation === 'UNEMPLOYED') weight += 1200;
    } else if (type === 'CIVIL_SERVICE') {
        if (occupation === 'PUBLIC') weight += 10000;
        if (occupation === 'SERVICES' && education === 'TERTIARY') weight += 1200;
    } else if (type === 'MEDIA_NETWORK') {
        if (occupation === 'SERVICES') weight += 5000;
        if (occupation === 'STUDENT') weight += 1800;
        if (education === 'TERTIARY') weight += 2200;
    } else if (type === 'SECURITY_SERVICE') {
        if (occupation === 'DEFENSE') weight += 5200;
        if (occupation === 'PUBLIC') weight += 1800;
    } else if (type === 'RADICAL_NETWORK') {
        if (occupation === 'UNEMPLOYED') weight += 6200;
        if (occupation === 'STUDENT') weight += 1600;
        if (age === 'YOUNG') weight += 700;
        if (income === 'LOW') weight += 900;
    }
    return storyPowerCenterClampBps(weight);
}

function storyPowerCenterSupport(countryId, type) {
    const population = typeof storyPopulationEnsure === 'function' ? storyPopulationEnsure() : null;
    const regions = {};
    const profilePeople = {};
    let populationPeople = 0;
    let supportPeople = 0;
    for (const region of Object.values(population && population.regions || {})) {
        if (region.countryId !== countryId) continue;
        populationPeople += Math.max(0, Math.round(Number(region.populationPeople) || 0));
        let regionalSupport = 0;
        for (const cohort of (region.cohorts || [])) {
            const weighted = Math.round(Math.max(0, Number(cohort.membersPeople) || 0)
                * storyPowerCenterCohortWeightBps(type, cohort) / 10000);
            regionalSupport += weighted;
            profilePeople[cohort.profileKey] = (profilePeople[cohort.profileKey] || 0) + weighted;
        }
        regions[region.regionId] = regionalSupport;
        supportPeople += regionalSupport;
    }
    return {
        populationPeople,
        supportPeople,
        supportShareBps: populationPeople > 0
            ? storyPowerCenterClampBps(supportPeople * 10000 / populationPeople) : 0,
        regions,
        profileKeys: Object.entries(profilePeople).filter(([, people]) => people > 0)
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en'))
            .map(([profileKey]) => profileKey)
    };
}

function storyPowerCenterCompanySignals(countryId) {
    const company = typeof storyCompanyEnsure === 'function' ? storyCompanyEnsure() : null;
    const companies = Object.values(company && company.companies || {}).filter(row => row.countryId === countryId);
    const facilities = Object.values(company && company.facilities || {}).filter(row => row.countryId === countryId);
    const banks = Object.values(company && company.banks || {}).filter(row => row.countryId === countryId);
    return {
        companies,
        facilities,
        banks,
        cash: storyPowerCenterRound(companies.reduce((sum, row) => sum
            + Math.max(0, Number(row.accounts && row.accounts['ASSET:CASH']) || 0), 0)),
        debt: storyPowerCenterRound(companies.reduce((sum, row) => sum
            + Math.max(0, -(Number(row.accounts && row.accounts['LIABILITY:DEBT']) || 0)), 0)),
        bankReserves: storyPowerCenterRound(banks.reduce((sum, row) => sum + Math.max(0, Number(row.reserves) || 0), 0)),
        lobbyInfluence: storyPowerCenterRound(companies.reduce((sum, row) => sum + Math.max(0, Number(row.lobbyInfluence) || 0), 0))
    };
}

function storyPowerCenterStateSignals(countryId) {
    const stateId = Number(String(countryId).split(':')[1]);
    const state = typeof storyState === 'function' ? storyState(stateId) : null;
    const nodes = (STORY.nodes || []).filter(node => Number(node.owner) === stateId);
    const commanders = state && state.gov && Array.isArray(state.gov.commanders) ? state.gov.commanders : [];
    const forceUnits = commanders.reduce((sum, commander) => sum + Object.values(commander.army || {})
        .reduce((total, count) => total + Math.max(0, Number(count) || 0), 0), 0);
    const collective = STORY.collectiveAction && STORY.collectiveAction.countries
        ? STORY.collectiveAction.countries[countryId] : null;
    const needs = typeof storyNeedsCountryView === 'function' ? storyNeedsCountryView(countryId) : null;
    return {
        stateId,
        state,
        nodes,
        commanders,
        forceUnits,
        garrison: nodes.reduce((sum, node) => sum + Math.max(0, Number(node.garrison) || 0), 0),
        activeActions: Math.max(0, Number(collective && collective.activeActionCount) || 0),
        maximumRadicalizationBps: storyPowerCenterClampBps(collective && collective.maximumRadicalizationBps),
        maximumMobilizationBps: storyPowerCenterClampBps(collective && collective.maximumMobilizationBps),
        wellbeingBps: storyPowerCenterClampBps(needs && needs.wellbeingBps),
        publicServicesBps: storyPowerCenterClampBps(needs && needs.publicServicesBps),
        unemploymentRiskBps: storyPowerCenterClampBps(needs && needs.unemploymentRiskBps)
    };
}

function storyPowerCenterLeader(countryId, type, companySignals, stateSignals) {
    if (type === 'ARMED_FORCES' && stateSignals.commanders.length) {
        const leader = stateSignals.commanders.slice().sort((a, b) => {
            const aScore = (Number(a.skills && a.skills.warrior) || 0) * 100 + (Number(a.loyalty) || 0);
            const bScore = (Number(b.skills && b.skills.warrior) || 0) * 100 + (Number(b.loyalty) || 0);
            return bScore - aScore || Number(a.id) - Number(b.id);
        })[0];
        return {
            actorType: 'CHARACTER',
            actorId: `character:${stateSignals.stateId}:${leader.id}`,
            name: String(leader.name || `Komutan ${leader.id}`),
            basisCode: 'HIGHEST_WARRIOR_COMMAND_SCORE',
            model: 'CANONICAL_CHARACTER'
        };
    }
    if (type === 'BUSINESS_COUNCIL' && companySignals.companies.length) {
        const leader = companySignals.companies.slice().sort((a, b) => {
            const aCash = Math.max(0, Number(a.accounts && a.accounts['ASSET:CASH']) || 0);
            const bCash = Math.max(0, Number(b.accounts && b.accounts['ASSET:CASH']) || 0);
            return b.facilityIds.length - a.facilityIds.length || bCash - aCash || a.id.localeCompare(b.id, 'en');
        })[0];
        return {
            actorType: 'COMPANY', actorId: leader.id, name: leader.name,
            basisCode: 'LARGEST_OPERATING_COMPANY', model: 'CANONICAL_LEGAL_ACTOR'
        };
    }
    const labels = {
        LABOR_CONFEDERATION: 'Konfederasyon Sözcülüğü',
        CIVIL_SERVICE: 'Baş İdarecilik',
        MEDIA_NETWORK: 'Yayın Kurulu Sözcülüğü',
        SECURITY_SERVICE: 'Güvenlik Koordinatörlüğü',
        RADICAL_NETWORK: 'Dağınık Ağ Sözcülüğü'
    };
    return {
        actorType: 'INSTITUTIONAL_OFFICE',
        actorId: `office:${countryId}:${type.toLowerCase()}`,
        name: labels[type] || `${type} Sözcülüğü`,
        basisCode: 'STABLE_INSTITUTIONAL_OFFICE',
        model: STORY_POWER_CENTER_POLICY.leaderModel
    };
}

function storyPowerCenterLegacyAlignment(state, type) {
    const key = STORY_POWER_CENTER_DEFS[type].legacyFaction;
    const value = state && state.factions && Number(state.factions[key]);
    return storyPowerCenterClampBps(Number.isFinite(value) ? value * 100 : 5000);
}

function storyPowerCenterTarget(type, support, companies, stateSignals) {
    const regionCount = Math.max(1, stateSignals.nodes.length);
    const companyScale = storyPowerCenterClampBps((companies.cash + companies.bankReserves * 0.35) / 2600 * 10000);
    const facilityScale = storyPowerCenterClampBps(companies.facilities.length / Math.max(1, regionCount * 4) * 10000);
    const forceScale = storyPowerCenterClampBps((stateSignals.forceUnits + stateSignals.garrison * 0.35
        + stateSignals.commanders.length * 0.4) / Math.max(4, regionCount * 2.2) * 10000);
    const administrationScale = storyPowerCenterClampBps(
        support.supportShareBps * 0.55 + stateSignals.publicServicesBps * 0.45
    );
    const radicalScale = storyPowerCenterClampBps(
        support.supportShareBps * 0.38
        + stateSignals.maximumRadicalizationBps * 0.42
        + stateSignals.maximumMobilizationBps * 0.20
    );
    const organization = {
        ARMED_FORCES: 5600 + forceScale * 0.32 + support.supportShareBps * 0.10,
        BUSINESS_COUNCIL: 5000 + facilityScale * 0.25 + companyScale * 0.22,
        LABOR_CONFEDERATION: 3200 + support.supportShareBps * 0.43 + stateSignals.maximumMobilizationBps * 0.10,
        CIVIL_SERVICE: 4700 + administrationScale * 0.35,
        MEDIA_NETWORK: 3000 + support.supportShareBps * 0.38,
        SECURITY_SERVICE: 5000 + forceScale * 0.22 + administrationScale * 0.12,
        RADICAL_NETWORK: 900 + radicalScale * 0.72 + stateSignals.activeActions * 350
    }[type] || 0;
    const capabilities = {
        financeBps: type === 'BUSINESS_COUNCIL' ? companyScale
            : (type === 'CIVIL_SERVICE' ? storyPowerCenterClampBps(companies.bankReserves / 2200 * 10000) : 0),
        mobilizationBps: storyPowerCenterClampBps(organization * 0.58 + support.supportShareBps * 0.42),
        coercionBps: type === 'ARMED_FORCES' ? forceScale
            : (type === 'SECURITY_SERVICE' ? storyPowerCenterClampBps(forceScale * 0.68)
                : (type === 'RADICAL_NETWORK' ? radicalScale : 0)),
        administrationBps: type === 'CIVIL_SERVICE' ? administrationScale
            : (type === 'SECURITY_SERVICE' ? storyPowerCenterClampBps(administrationScale * 0.55)
                : (type === 'BUSINESS_COUNCIL' ? storyPowerCenterClampBps(facilityScale * 0.65) : 0)),
        informationBps: type === 'MEDIA_NETWORK'
            ? storyPowerCenterClampBps(2800 + support.supportShareBps * 0.62)
            : (type === 'SECURITY_SERVICE' ? storyPowerCenterClampBps(1800 + forceScale * 0.34) : 0)
    };
    const meanCapability = Object.values(capabilities).reduce((sum, value) => sum + value, 0) / 5;
    return {
        organizationBps: storyPowerCenterClampBps(organization),
        influenceBps: storyPowerCenterClampBps(
            organization * 0.40 + support.supportShareBps * 0.28 + meanCapability * 0.32
        ),
        capabilities
    };
}

function storyPowerCenterGoals(type, signals, alignmentBps) {
    const pressure = {
        ARMED_FORCES: [signals.forceUnits + signals.garrison < signals.nodes.length ? 7600 : 4700, 5200, 4300],
        BUSINESS_COUNCIL: [10000 - signals.wellbeingBps, 4800, signals.unemploymentRiskBps],
        LABOR_CONFEDERATION: [signals.unemploymentRiskBps, 10000 - signals.wellbeingBps, 10000 - signals.publicServicesBps],
        CIVIL_SERVICE: [10000 - signals.publicServicesBps, 4600, 5200],
        MEDIA_NETWORK: [storyPowerCenterClampBps(10000 - alignmentBps), 5200, 4800],
        SECURITY_SERVICE: [signals.maximumMobilizationBps, signals.maximumRadicalizationBps, 5000],
        RADICAL_NETWORK: [signals.maximumMobilizationBps, signals.maximumRadicalizationBps, storyPowerCenterClampBps(10000 - alignmentBps)]
    }[type] || [5000, 5000, 5000];
    return STORY_POWER_CENTER_DEFS[type].objectiveCodes.map((code, index) => ({
        code,
        priorityBps: storyPowerCenterClampBps(pressure[index]),
        evidenceCodes: ({
            ARMED_FORCES: ['FORCE_AND_GARRISON', 'LEGACY_ATTITUDE', 'OWNED_REGIONS'],
            BUSINESS_COUNCIL: ['COMPANY_BALANCE_SHEETS', 'INFRASTRUCTURE_NETWORK', 'LABOR_RISK'],
            LABOR_CONFEDERATION: ['COHORT_EMPLOYMENT', 'COHORT_WELLBEING', 'PUBLIC_SERVICE_RESULT'],
            CIVIL_SERVICE: ['PUBLIC_SERVICE_RESULT', 'STATE_BUDGET', 'PUBLIC_COHORTS'],
            MEDIA_NETWORK: ['LEGACY_PRESS_ATTITUDE', 'EDUCATED_SERVICE_COHORTS', 'PUBLIC_EVENTS'],
            SECURITY_SERVICE: ['COLLECTIVE_MOBILIZATION', 'COLLECTIVE_RADICALIZATION', 'DEFENSE_PUBLIC_COHORTS'],
            RADICAL_NETWORK: ['COLLECTIVE_MOBILIZATION', 'COLLECTIVE_RADICALIZATION', 'REGIME_ALIGNMENT']
        })[type]
    })).sort((a, b) => b.priorityBps - a.priorityBps || a.code.localeCompare(b.code, 'en'));
}

function storyPowerCenterBuild(countryId, type, previous) {
    const support = storyPowerCenterSupport(countryId, type);
    const companies = storyPowerCenterCompanySignals(countryId);
    const signals = storyPowerCenterStateSignals(countryId);
    const alignmentBps = storyPowerCenterLegacyAlignment(signals.state, type);
    const target = storyPowerCenterTarget(type, support, companies, signals);
    const initial = !previous;
    const organizationBps = initial ? target.organizationBps : storyPowerCenterLerp(
        previous.organizationBps, target.organizationBps,
        STORY_POWER_CENTER_POLICY.organizationRiseRateBps,
        STORY_POWER_CENTER_POLICY.organizationDecayRateBps
    );
    const influenceBps = initial ? target.influenceBps : storyPowerCenterLerp(
        previous.influenceBps, target.influenceBps,
        STORY_POWER_CENTER_POLICY.influenceRiseRateBps,
        STORY_POWER_CENTER_POLICY.influenceDecayRateBps
    );
    const active = signals.nodes.length > 0;
    return {
        id: storyPowerCenterId(countryId, type),
        countryId,
        type,
        name: `${signals.state && signals.state.name || countryId} ${STORY_POWER_CENTER_DEFS[type].name}`,
        status: active ? 'ACTIVE' : 'DISSOLVED',
        foundedAt: previous ? previous.foundedAt : storyPowerCenterRound(STORY.clock),
        updatedAt: storyPowerCenterRound(STORY.clock),
        leader: storyPowerCenterLeader(countryId, type, companies, signals),
        supportBase: {
            populationPeople: support.populationPeople,
            membersPeople: support.supportPeople,
            shareBps: support.supportShareBps,
            profileKeys: support.profileKeys,
            regionalPeople: support.regions
        },
        resources: {
            membershipPeople: support.supportPeople,
            treasuryCash: type === 'BUSINESS_COUNCIL' ? companies.cash : 0,
            bankReserves: type === 'BUSINESS_COUNCIL' ? companies.bankReserves : 0,
            debtExposure: type === 'BUSINESS_COUNCIL' ? companies.debt : 0,
            facilityCount: type === 'BUSINESS_COUNCIL' ? companies.facilities.length : 0,
            commanderCount: type === 'ARMED_FORCES' ? signals.commanders.length : 0,
            forceUnits: type === 'ARMED_FORCES' ? storyPowerCenterRound(signals.forceUnits) : 0,
            garrisonUnits: (type === 'ARMED_FORCES' || type === 'SECURITY_SERVICE')
                ? storyPowerCenterRound(signals.garrison) : 0,
            regionalPresenceCount: Object.values(support.regions).filter(value => value > 0).length
        },
        resourceEvidence: {
            populationTick: STORY.population ? STORY.population.tickSequence : null,
            companyTick: STORY.companyEconomy ? STORY.companyEconomy.tickSequence : null,
            collectiveTick: STORY.collectiveAction ? STORY.collectiveAction.tickSequence : null,
            canonicalSources: ['POPULATION_COHORTS', 'COMPANY_LEDGER', 'COMMANDERS_AND_GARRISONS', 'COLLECTIVE_ACTION']
        },
        organizationBps,
        influenceBps,
        alignmentBps,
        independenceBps: storyPowerCenterClampBps(4200 + Math.abs(5000 - alignmentBps) * 0.42),
        capabilities: target.capabilities,
        goals: storyPowerCenterGoals(type, signals, alignmentBps),
        actionLimits: {
            authorityModel: STORY_POWER_CENTER_POLICY.authorityModel,
            declaredActionTypes: STORY_POWER_CENTER_DEFS[type].declaredActions.slice(),
            executableActionTypes: [],
            blockedUntilPhase: 29,
            maximumConcurrentActions: 0
        },
        diagnostics: {
            supportModel: 'WEIGHTED_CANONICAL_COHORTS',
            leaderModel: type === 'ARMED_FORCES' || type === 'BUSINESS_COUNCIL'
                ? 'CANONICAL_ACTOR' : STORY_POWER_CENTER_POLICY.leaderModel,
            mediaCapacityModel: type === 'MEDIA_NETWORK' ? STORY_POWER_CENTER_POLICY.mediaCapacityModel : null,
            securityCapacityModel: type === 'SECURITY_SERVICE' ? STORY_POWER_CENTER_POLICY.securityCapacityModel : null,
            randomDecisions: false,
            llmDecisions: false
        }
    };
}

function storyPowerCenterCountrySummary(countryId, centers) {
    const rows = centers.filter(center => center.countryId === countryId)
        .sort((a, b) => b.influenceBps - a.influenceBps || a.id.localeCompare(b.id, 'en'));
    return {
        countryId,
        centerCount: rows.length,
        activeCenterCount: rows.filter(row => row.status === 'ACTIVE').length,
        dominantCenterId: rows.length ? rows[0].id : null,
        maximumInfluenceBps: rows.reduce((max, row) => Math.max(max, row.influenceBps), 0),
        maximumCoercionBps: rows.reduce((max, row) => Math.max(max, row.capabilities.coercionBps), 0),
        centerIds: rows.map(row => row.id)
    };
}

function storyPowerCenterRegionSummaries(centers) {
    const regions = {};
    for (const node of (STORY.nodes || [])) {
        const regionId = storyPowerCenterRegionId(node.id);
        const countryId = storyPowerCenterCountryId(node.owner);
        const rows = centers.filter(center => center.countryId === countryId).map(center => ({
            centerId: center.id,
            type: center.type,
            membersPeople: Math.max(0, Math.round(Number(center.supportBase.regionalPeople[regionId]) || 0)),
            influenceBps: center.influenceBps
        })).filter(row => row.membersPeople > 0)
            .sort((a, b) => b.membersPeople - a.membersPeople || a.centerId.localeCompare(b.centerId, 'en'));
        regions[regionId] = {
            regionId,
            countryId,
            centerCount: rows.length,
            dominantCenterId: rows.length ? rows[0].centerId : null,
            centers: rows
        };
    }
    return regions;
}

function storyPowerCenterBuildSummaries(ledger) {
    const rows = Object.values(ledger.centers || {});
    ledger.countries = {};
    for (const state of (STORY.states || [])) {
        const countryId = storyPowerCenterCountryId(state.id);
        ledger.countries[countryId] = storyPowerCenterCountrySummary(countryId, rows);
    }
    ledger.regions = storyPowerCenterRegionSummaries(rows);
}

function storyPowerCenterLedgerCreate(options) {
    options = options || {};
    const ledger = {
        schemaVersion: STORY_POWER_CENTER_SCHEMA_VERSION,
        adapterVersion: STORY_POWER_CENTER_ADAPTER_VERSION,
        policyHash: STORY_POWER_CENTER_POLICY_HASH,
        tickSequence: 0,
        lastTickAt: storyPowerCenterRound(STORY.clock),
        nextEventSequence: 1,
        centers: {},
        countries: {},
        regions: {},
        events: [],
        diagnostics: {
            backfilled: !!options.backfilled,
            restoredFromInvalidLedger: !!options.restoredFromInvalidLedger,
            issues: Array.isArray(options.issues) ? storyPowerCenterClone(options.issues).slice(0, 50) : [],
            warnings: options.backfilled
                ? ['Eski kayıtta güç merkezi geçmişi yoktu; mevcut kanonik kaynaklardan başlangıç fotoğrafı kuruldu.'] : [],
            legacyFactionRole: 'ALIGNMENT_INPUT_ONLY',
            directEconomyWrites: false,
            directWelfareWrites: false,
            directAuthorityActions: false,
            randomDecisions: false,
            llmDecisions: false
        }
    };
    for (const state of (STORY.states || [])) {
        const countryId = storyPowerCenterCountryId(state.id);
        for (const type of STORY_POWER_CENTER_TYPES) {
            const center = storyPowerCenterBuild(countryId, type, null);
            ledger.centers[center.id] = center;
        }
    }
    storyPowerCenterBuildSummaries(ledger);
    return ledger;
}

function storyPowerCenterValidate(ledger) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) {
        return { ok: false, issues: [{ code: 'POWER_CENTER_LEDGER_REQUIRED', path: '$', message: 'Güç merkezi defteri zorunlu.' }] };
    }
    if (ledger.schemaVersion !== STORY_POWER_CENTER_SCHEMA_VERSION) add('POWER_CENTER_SCHEMA_VERSION', '$.schemaVersion', 'Güç merkezi şeması uyuşmuyor.');
    if (ledger.adapterVersion !== STORY_POWER_CENTER_ADAPTER_VERSION) add('POWER_CENTER_ADAPTER_VERSION', '$.adapterVersion', 'Güç merkezi adaptörü uyuşmuyor.');
    if (ledger.policyHash !== STORY_POWER_CENTER_POLICY_HASH) add('POWER_CENTER_POLICY_HASH', '$.policyHash', 'Güç merkezi politika karması uyuşmuyor.');
    if (!Number.isInteger(ledger.tickSequence) || ledger.tickSequence < 0) add('POWER_CENTER_TICK', '$.tickSequence', 'Tik sayacı geçersiz.');
    if (!ledger.centers || typeof ledger.centers !== 'object' || Array.isArray(ledger.centers)) add('POWER_CENTER_MAP', '$.centers', 'Merkez sözlüğü zorunlu.');
    const knownCountries = new Set((STORY.states || []).map(state => storyPowerCenterCountryId(state.id)));
    const knownRegions = new Set((STORY.nodes || []).map(node => storyPowerCenterRegionId(node.id)));
    const counts = {};
    for (const [id, center] of Object.entries(ledger.centers || {})) {
        const path = `$.centers.${id}`;
        if (center.id !== id) add('POWER_CENTER_ID', `${path}.id`, 'Merkez kimliği anahtarla uyuşmuyor.');
        if (!knownCountries.has(center.countryId)) add('POWER_CENTER_COUNTRY', `${path}.countryId`, 'Merkez bilinmeyen ülkeye bağlı.');
        if (!STORY_POWER_CENTER_TYPES.includes(center.type)) add('POWER_CENTER_TYPE', `${path}.type`, 'Merkez türü geçersiz.');
        counts[center.countryId] = (counts[center.countryId] || 0) + 1;
        if (!center.leader || !center.leader.actorId || !center.leader.actorType || !center.leader.name) {
            add('POWER_CENTER_LEADER', `${path}.leader`, 'Her merkez kaynaklı bir lider/ofis taşımalı.');
        }
        const support = center.supportBase || {};
        if (!Number.isInteger(support.membersPeople) || support.membersPeople < 0
            || !Number.isInteger(support.populationPeople) || support.populationPeople < support.membersPeople) {
            add('POWER_CENTER_SUPPORT', `${path}.supportBase`, 'Destek tabanı geçersiz.');
        }
        if (!support.regionalPeople || typeof support.regionalPeople !== 'object' || Array.isArray(support.regionalPeople)) {
            add('POWER_CENTER_REGIONAL_SUPPORT', `${path}.supportBase.regionalPeople`, 'Bölgesel destek sözlüğü zorunlu.');
        } else {
            let sum = 0;
            for (const [regionId, people] of Object.entries(support.regionalPeople)) {
                if (!knownRegions.has(regionId)) add('POWER_CENTER_REGION_REFERENCE', `${path}.supportBase.regionalPeople.${regionId}`, 'Bilinmeyen bölge desteği.');
                if (!Number.isInteger(people) || people < 0) add('POWER_CENTER_REGION_PEOPLE', `${path}.supportBase.regionalPeople.${regionId}`, 'Bölgesel destek tamsayı olmalı.');
                sum += Math.max(0, Number(people) || 0);
            }
            if (sum !== support.membersPeople) add('POWER_CENTER_SUPPORT_SUM', `${path}.supportBase`, 'Bölgesel destek toplamı merkez toplamıyla uyuşmuyor.');
        }
        for (const field of ['organizationBps', 'influenceBps', 'alignmentBps', 'independenceBps']) {
            if (!Number.isInteger(center[field]) || center[field] < 0 || center[field] > 10000) add('POWER_CENTER_BPS', `${path}.${field}`, 'Baz puan 0–10.000 tamsayı olmalı.');
        }
        for (const [field, value] of Object.entries(center.capabilities || {})) {
            if (!Number.isInteger(value) || value < 0 || value > 10000) add('POWER_CENTER_CAPABILITY', `${path}.capabilities.${field}`, 'Kapasite baz puanı geçersiz.');
        }
        if (!Array.isArray(center.goals) || center.goals.length !== 3
            || center.goals.some(goal => !goal.code || !Number.isInteger(goal.priorityBps))) {
            add('POWER_CENTER_GOALS', `${path}.goals`, 'Her merkez üç açıklanabilir amaç taşımalı.');
        }
        if (!center.actionLimits || center.actionLimits.authorityModel !== STORY_POWER_CENTER_POLICY.authorityModel
            || !Array.isArray(center.actionLimits.declaredActionTypes)
            || !Array.isArray(center.actionLimits.executableActionTypes)
            || center.actionLimits.executableActionTypes.length !== 0
            || center.actionLimits.maximumConcurrentActions !== 0) {
            add('POWER_CENTER_ACTION_LIMITS', `${path}.actionLimits`, 'Faz 29 öncesi eylem sınırı ihlal edildi.');
        }
        for (const [field, value] of Object.entries(center.resources || {})) {
            if (!Number.isFinite(Number(value)) || Number(value) < 0) add('POWER_CENTER_RESOURCE', `${path}.resources.${field}`, 'Kaynak negatif veya sonlu değil.');
        }
    }
    for (const countryId of knownCountries) {
        if ((counts[countryId] || 0) !== STORY_POWER_CENTER_POLICY.centersPerCountry) add('POWER_CENTER_COUNTRY_COUNT', `$.countries.${countryId}`, 'Her ülke yedi güç merkezi taşımalı.');
    }
    if (!Array.isArray(ledger.events) || ledger.events.length > STORY_POWER_CENTER_POLICY.maximumEvents) add('POWER_CENTER_EVENT_LIMIT', '$.events', 'Olay bütçesi aşıldı.');
    const expected = storyPowerCenterClone(ledger);
    storyPowerCenterBuildSummaries(expected);
    if (JSON.stringify(expected.countries) !== JSON.stringify(ledger.countries)) add('POWER_CENTER_COUNTRY_AGGREGATE', '$.countries', 'Ülke özeti merkezlerden türemeli.');
    if (JSON.stringify(expected.regions) !== JSON.stringify(ledger.regions)) add('POWER_CENTER_REGION_AGGREGATE', '$.regions', 'Bölge özeti merkezlerden türemeli.');
    return { ok: issues.length === 0, issues };
}

function storyPowerCenterReset(options) {
    if (!storyPowerCenterEnabled()) { STORY.powerCenters = null; return null; }
    STORY.powerCenters = storyPowerCenterLedgerCreate(options);
    return STORY.powerCenters;
}

function storyPowerCenterRestore(saved) {
    if (!storyPowerCenterEnabled()) { STORY.powerCenters = null; return null; }
    if (!saved) return storyPowerCenterReset({ backfilled: true });
    const candidate = storyPowerCenterClone(saved);
    const validation = storyPowerCenterValidate(candidate);
    if (validation.ok) { STORY.powerCenters = candidate; return candidate; }
    const ledger = storyPowerCenterLedgerCreate({
        backfilled: true,
        restoredFromInvalidLedger: true,
        issues: validation.issues
    });
    ledger.diagnostics.warnings.push('Bozuk güç merkezi defteri kullanılmadı; mevcut kanonik kaynaklardan güvenli fotoğraf kuruldu.');
    STORY.powerCenters = ledger;
    return ledger;
}

function storyPowerCenterEnsure() {
    if (!storyPowerCenterEnabled()) return null;
    return STORY.powerCenters || storyPowerCenterReset({ backfilled: true });
}

function storyPowerCenterForSave() {
    const ledger = storyPowerCenterEnsure();
    if (!ledger) return null;
    const validation = storyPowerCenterValidate(ledger);
    if (!validation.ok) throw new Error(`Geçersiz güç merkezi defteri: ${validation.issues[0].code}`);
    return storyPowerCenterClone(ledger);
}

function storyPowerCenterRecordEvent(ledger, type, center, extra) {
    const event = Object.assign({
        id: `power-center-event:${ledger.nextEventSequence}`,
        sequence: ledger.nextEventSequence++,
        type: String(type),
        at: storyPowerCenterRound(STORY.clock),
        centerId: center ? center.id : null,
        countryId: center ? center.countryId : null
    }, extra || {});
    ledger.events.push(event);
    if (ledger.events.length > STORY_POWER_CENTER_POLICY.maximumEvents) {
        ledger.events.splice(0, ledger.events.length - STORY_POWER_CENTER_POLICY.maximumEvents);
    }
    return event;
}

function storyPowerCenterTick() {
    const ledger = storyPowerCenterEnsure();
    if (!ledger) return { disabled: true };
    const next = {};
    for (const state of (STORY.states || [])) {
        const countryId = storyPowerCenterCountryId(state.id);
        for (const type of STORY_POWER_CENTER_TYPES) {
            const id = storyPowerCenterId(countryId, type);
            const previous = ledger.centers[id] || null;
            const center = storyPowerCenterBuild(countryId, type, previous);
            if (previous && previous.leader.actorId !== center.leader.actorId) {
                storyPowerCenterRecordEvent(ledger, 'LEADER_CHANGED', center, {
                    previousLeaderId: previous.leader.actorId,
                    nextLeaderId: center.leader.actorId
                });
            }
            const previousBand = previous ? Math.floor(previous.influenceBps / 2000) : null;
            const nextBand = Math.floor(center.influenceBps / 2000);
            if (previous && previousBand !== nextBand) {
                storyPowerCenterRecordEvent(ledger, 'INFLUENCE_BAND_CHANGED', center, {
                    previousInfluenceBps: previous.influenceBps,
                    nextInfluenceBps: center.influenceBps
                });
            }
            next[id] = center;
        }
    }
    ledger.centers = next;
    ledger.tickSequence++;
    ledger.lastTickAt = storyPowerCenterRound(STORY.clock);
    storyPowerCenterBuildSummaries(ledger);
    return {
        disabled: false,
        tickSequence: ledger.tickSequence,
        centerCount: Object.keys(ledger.centers).length,
        eventCount: ledger.events.length
    };
}

function storyPowerCenterCountryView(countryId) {
    const ledger = storyPowerCenterEnsure();
    const id = storyPowerCenterCountryId(countryId);
    if (!ledger || !ledger.countries[id]) return null;
    const out = storyPowerCenterClone(ledger.countries[id]);
    out.centers = out.centerIds.map(centerId => storyPowerCenterClone(ledger.centers[centerId])).filter(Boolean);
    delete out.centerIds;
    return out;
}

function storyPowerCenterRegionView(regionId) {
    const ledger = storyPowerCenterEnsure();
    const id = storyPowerCenterRegionId(regionId);
    return ledger && ledger.regions[id] ? storyPowerCenterClone(ledger.regions[id]) : null;
}

function storyPowerCenterPublicView(value) {
    if (!value) return null;
    if (value.regionId) {
        const centers = (value.centers || []).map(center => ({
            id: center.centerId || center.id,
            type: center.type,
            status: 'PUBLIC_PRESENCE'
        }));
        return {
            regionId: value.regionId,
            countryId: value.countryId,
            centerCount: centers.length || Number(value.centerCount) || 0,
            centers
        };
    }
    const centers = (value.centers || []).map(center => ({
        id: center.id,
        countryId: center.countryId,
        type: center.type,
        name: center.name,
        status: center.status,
        leader: center.leader ? {
            actorType: center.leader.actorType,
            name: center.leader.name,
            model: center.leader.model
        } : null,
        declaredObjectives: (center.goals || []).map(goal => goal.code)
    }));
    return {
        countryId: value.countryId,
        centerCount: centers.length || Number(value.centerCount) || 0,
        activeCenterCount: centers.filter(center => center.status === 'ACTIVE').length,
        centers
    };
}

function storyPowerCenterOrganizationForProblem(countryId, problemType) {
    const ledger = storyPowerCenterEnsure();
    if (!ledger) return null;
    const types = (problemType === 'income' || problemType === 'employment')
        ? ['LABOR_CONFEDERATION']
        : (problemType === 'publicServices'
            ? ['LABOR_CONFEDERATION', 'CIVIL_SERVICE']
            : ['RADICAL_NETWORK', 'LABOR_CONFEDERATION']);
    const rows = types.map(type => ledger.centers[storyPowerCenterId(countryId, type)]).filter(Boolean);
    if (!rows.length) return null;
    const organizationBps = storyPowerCenterClampBps(rows.reduce((sum, row) => sum + row.organizationBps, 0) / rows.length);
    return {
        model: 'POWER_CENTER_CAPACITY_PHASE_28',
        organizationBps,
        centerIds: rows.map(row => row.id)
    };
}

function storyPowerCenterSummary() {
    const ledger = storyPowerCenterEnsure();
    if (!ledger) return {
        schemaVersion: STORY_POWER_CENTER_SCHEMA_VERSION,
        adapterVersion: STORY_POWER_CENTER_ADAPTER_VERSION,
        disabled: true,
        centerCount: 0
    };
    const rows = Object.values(ledger.centers || {});
    const byType = {};
    for (const type of STORY_POWER_CENTER_TYPES) {
        const typed = rows.filter(row => row.type === type);
        byType[type] = {
            count: typed.length,
            membersPeople: typed.reduce((sum, row) => sum + row.supportBase.membersPeople, 0),
            averageInfluenceBps: typed.length
                ? Math.round(typed.reduce((sum, row) => sum + row.influenceBps, 0) / typed.length) : 0
        };
    }
    return {
        schemaVersion: ledger.schemaVersion,
        adapterVersion: ledger.adapterVersion,
        policyHash: ledger.policyHash,
        disabled: false,
        tickSequence: ledger.tickSequence,
        centerCount: rows.length,
        activeCenterCount: rows.filter(row => row.status === 'ACTIVE').length,
        eventCount: ledger.events.length,
        byType
    };
}
