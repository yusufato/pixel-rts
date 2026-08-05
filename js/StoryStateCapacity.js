// ============================================================================
//  MEŞRUİYET VE DEVLET KAPASİTESİ — Faz 30
//  --------------------------------------------------------------------------
//  Faz 29 bir kararın kim tarafından ve hangi anayasal rotayla alınabildiğini
//  kanıtlar. Bu katman ayrı bir gerçeği ölçer: yetkili kararın sahada ne kadar
//  hızlı ve ne kadar eksiksiz uygulanabildiği. Kaynak sistemlere doğrudan yazı
//  yazılmaz; sonraki domain fazlarının tüketebileceği, gecikmeli ve açıklanır
//  bir uygulama fişi üretilir.
//
//  "Yolsuzluk riski" kanıtlanmış suç değildir. Kurumsal bütünlük, mali süreklilik
//  ve güç yoğunlaşmasından türetilmiş yapısal saptırma/sızıntı basıncıdır. Fail,
//  rüşvet, ihale ve soruşturma Faz 32'nin sorumluluğundadır.
// ============================================================================

const STORY_STATE_CAPACITY_SCHEMA_VERSION = 1;
const STORY_STATE_CAPACITY_ADAPTER_VERSION = 'story-state-capacity-ledger-1';
const STORY_STATE_CAPACITY_TICKET_STATUSES = Object.freeze([
    'QUEUED', 'IMPLEMENTING', 'COMPLETED', 'DEGRADED', 'PAPER_ONLY'
]);
const STORY_STATE_CAPACITY_TERMINAL_STATUSES = Object.freeze([
    'COMPLETED', 'DEGRADED', 'PAPER_ONLY'
]);

const STORY_STATE_CAPACITY_COMPLEXITY = Object.freeze({
    ENACT_LAW: 'HIGH', AMEND_CONSTITUTION: 'EXTREME', APPOINT_COMMANDER: 'LOW',
    DISMISS_COMMANDER: 'LOW', AUTHORIZE_BUDGET: 'HIGH', SIGN_TREATY: 'MEDIUM',
    DECLARE_WAR: 'HIGH', MOBILIZE_FORCE: 'HIGH', CONTAIN_VIOLENCE: 'HIGH',
    ISSUE_LOCAL_ORDER: 'MEDIUM', REVIEW_LEGALITY: 'LOW',
    REQUEST_READINESS_BUDGET: 'MEDIUM', LOBBY_POLICY: 'MEDIUM',
    DELAY_IMPLEMENTATION: 'LOW', REQUEST_SECURITY_RESOURCES: 'MEDIUM'
});
const STORY_STATE_CAPACITY_COMPLEXITY_POLICY = Object.freeze({
    LOW: Object.freeze({ baseDurationSeconds: 20, requiredCapacityBps: 2500, qualityPenaltyBps: 0 }),
    MEDIUM: Object.freeze({ baseDurationSeconds: 45, requiredCapacityBps: 4000, qualityPenaltyBps: 500 }),
    HIGH: Object.freeze({ baseDurationSeconds: 80, requiredCapacityBps: 5500, qualityPenaltyBps: 1100 }),
    EXTREME: Object.freeze({ baseDurationSeconds: 120, requiredCapacityBps: 7000, qualityPenaltyBps: 1700 })
});
const STORY_STATE_CAPACITY_POLICY = Object.freeze({
    maximumTickets: 256,
    maximumEvents: 512,
    minimumStartCapacityBps: 1200,
    maximumDurationMultiplier: 6,
    degradedQualityThresholdBps: 5200,
    degradedLeakageThresholdBps: 4600,
    effectModel: 'CAPACITY_IMPLEMENTATION_RECORD_ONLY_PHASE_30',
    legitimacyModel: 'WELFARE_FACTION_GRIEVANCE_SERVICE_COMPOSITE_V1',
    bureaucracyModel: 'CIVIL_SERVICE_PUBLIC_SERVICE_FISCAL_COMPOSITE_V1',
    corruptionModel: 'STRUCTURAL_DIVERSION_RISK_NOT_PROVEN_CRIME_V1',
    regionalControlModel: 'ADMIN_REACH_SECURITY_INFRASTRUCTURE_GARRISON_V1'
});
const STORY_STATE_CAPACITY_POLICY_HASH = storyProductionHash({
    schemaVersion: STORY_STATE_CAPACITY_SCHEMA_VERSION,
    adapterVersion: STORY_STATE_CAPACITY_ADAPTER_VERSION,
    complexity: STORY_STATE_CAPACITY_COMPLEXITY,
    complexityPolicy: STORY_STATE_CAPACITY_COMPLEXITY_POLICY,
    policy: STORY_STATE_CAPACITY_POLICY
});

function storyStateCapacityEnabled() {
    return (typeof storyFeatureEnabled !== 'function' || storyFeatureEnabled('government.stateCapacity'))
        && (typeof storyInstitutionEnabled !== 'function' || storyInstitutionEnabled());
}
function storyStateCapacityClone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function storyStateCapacityRound(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 1e6) / 1e6 : 0;
}
function storyStateCapacityClampBps(value) {
    return Math.max(0, Math.min(10000, Math.round(Number(value) || 0)));
}
function storyStateCapacityCountryId(value) {
    const raw = String(value == null ? '' : value);
    return raw.startsWith('country:') ? raw : `country:${Number(value)}`;
}
function storyStateCapacityRegionId(value) {
    const raw = String(value == null ? '' : value);
    return raw.startsWith('region:') ? raw : `region:${Number(value)}`;
}
function storyStateCapacityWeighted(parts) {
    let value = 0;
    let weight = 0;
    for (const part of parts || []) {
        const partWeight = Math.max(0, Number(part.weight) || 0);
        value += storyStateCapacityClampBps(part.value) * partWeight;
        weight += partWeight;
    }
    return storyStateCapacityClampBps(weight > 0 ? value / weight : 0);
}
function storyStateCapacityState(countryId) {
    const stateId = Number(String(countryId).split(':').pop());
    return (STORY.states || []).find(state => Number(state.id) === stateId) || null;
}
function storyStateCapacityCenter(countryId, type) {
    const rows = STORY.powerCenters && STORY.powerCenters.centers;
    return Object.values(rows || {}).find(row => row.countryId === countryId && row.type === type) || null;
}
function storyStateCapacityInfrastructureAccessMap() {
    const graph = STORY.infrastructureGraph;
    const aggregates = {};
    for (const corridor of (graph && graph.corridors || [])) {
        const accessBps = corridor.enabled
            ? Math.max(0, 10000 - (Number(corridor.damageBps) || 0)) : 0;
        for (const regionId of (corridor.endpointRegionIds || [])) {
            if (!aggregates[regionId]) aggregates[regionId] = { sum: 0, count: 0 };
            aggregates[regionId].sum += accessBps;
            aggregates[regionId].count++;
        }
    }
    return Object.fromEntries((STORY.nodes || []).map(node => {
        const regionId = storyStateCapacityRegionId(node.id);
        const row = aggregates[regionId];
        return [regionId, row && row.count
            ? storyStateCapacityClampBps(row.sum / row.count) : 3000];
    }));
}
function storyStateCapacityFiscalContinuity(countryId) {
    const country = STORY.stateBudget && STORY.stateBudget.countries
        ? STORY.stateBudget.countries[countryId] : null;
    if (!country) return { fiscalContinuityBps: 5000, status: 'UNKNOWN', missedPaymentDays: 0 };
    const missedPaymentDays = Math.max(0, Number(country.missedPaymentDays) || 0);
    const status = String(country.status || 'CURRENT');
    return {
        fiscalContinuityBps: status === 'DEFAULT' ? 0
            : storyStateCapacityClampBps(10000 - missedPaymentDays * 100),
        status,
        missedPaymentDays: storyStateCapacityRound(missedPaymentDays)
    };
}
function storyStateCapacityInstitutionalChecks(countryId) {
    const country = STORY.institutions && STORY.institutions.countries
        ? STORY.institutions.countries[countryId] : null;
    const actions = ['ENACT_LAW', 'AMEND_CONSTITUTION', 'AUTHORIZE_BUDGET', 'DECLARE_WAR', 'REVIEW_LEGALITY'];
    if (!country) return 0;
    const meanApprovals = actions.reduce((sum, actionType) => {
        const route = country.authorityByAction && country.authorityByAction[actionType];
        return sum + (route && Array.isArray(route.requiredInstitutionIds)
            ? route.requiredInstitutionIds.length : 0);
    }, 0) / actions.length;
    return storyStateCapacityClampBps(meanApprovals / 3 * 10000);
}

function storyStateCapacityRegionSnapshot(node, countrySnapshots, infrastructureAccessByRegion) {
    const regionId = storyStateCapacityRegionId(node.id);
    const countryId = storyStateCapacityCountryId(node.owner);
    const needs = STORY.needsWelfare && STORY.needsWelfare.regions
        ? STORY.needsWelfare.regions[regionId] : null;
    const securityBps = storyStateCapacityClampBps(needs && needs.securityBps);
    const publicServicesBps = storyStateCapacityClampBps(needs && needs.publicServicesBps);
    const infrastructureAccessBps = storyStateCapacityClampBps(
        infrastructureAccessByRegion && infrastructureAccessByRegion[regionId]
    );
    const garrisonReference = Math.max(1, (Number(node.level) || 1) * 2);
    const garrisonPresenceBps = storyStateCapacityClampBps(
        Math.max(0, Number(node.garrison) || 0) / garrisonReference * 10000
    );
    const country = countrySnapshots && countrySnapshots[countryId];
    const bureaucracyBps = storyStateCapacityClampBps(country && country.bureaucraticCapacityBps);
    const administrativeReachBps = storyStateCapacityWeighted([
        { value: bureaucracyBps, weight: 45 },
        { value: publicServicesBps, weight: 30 },
        { value: infrastructureAccessBps, weight: 25 }
    ]);
    let regionalControlBps = storyStateCapacityWeighted([
        { value: administrativeReachBps, weight: 40 },
        { value: securityBps, weight: 35 },
        { value: infrastructureAccessBps, weight: 15 },
        { value: garrisonPresenceBps, weight: 10 }
    ]);
    if (node._siege) regionalControlBps = storyStateCapacityClampBps(regionalControlBps - 3000);
    return {
        regionId, countryId,
        administrativeReachBps, regionalControlBps, securityBps,
        publicServicesBps, infrastructureAccessBps, garrisonPresenceBps,
        underSiege: !!node._siege,
        updatedAt: storyStateCapacityRound(STORY.clock),
        sources: {
            needsTick: STORY.needsWelfare ? STORY.needsWelfare.tickSequence : null,
            infrastructureRevision: STORY.infrastructureGraph ? STORY.infrastructureGraph.revision || 0 : null,
            nodeOwner: Number(node.owner), garrison: Math.max(0, Number(node.garrison) || 0)
        }
    };
}

function storyStateCapacityCountrySnapshot(state) {
    const countryId = storyStateCapacityCountryId(state.id);
    const needs = STORY.needsWelfare && STORY.needsWelfare.countries
        ? STORY.needsWelfare.countries[countryId] : null;
    const opinion = STORY.publicOpinion && STORY.publicOpinion.countries
        ? STORY.publicOpinion.countries[countryId] : null;
    const factions = state.factions || {};
    const factionApprovalBps = storyStateCapacityClampBps(
        ['workers', 'business', 'military', 'intel'].reduce((sum, key) =>
            sum + (Number.isFinite(Number(factions[key])) ? Number(factions[key]) * 100 : 5000), 0) / 4
    );
    const welfareBps = storyStateCapacityClampBps((Number(state.welfare) || 0) * 100);
    const grievanceBps = storyStateCapacityClampBps(opinion && opinion.rememberedSeverityBps);
    const publicServicesBps = storyStateCapacityClampBps(needs && needs.publicServicesBps);
    const legitimacyBps = storyStateCapacityWeighted([
        { value: welfareBps, weight: 35 },
        { value: factionApprovalBps, weight: 30 },
        { value: 10000 - grievanceBps, weight: 20 },
        { value: publicServicesBps, weight: 15 }
    ]);
    const civilService = storyStateCapacityCenter(countryId, 'CIVIL_SERVICE');
    const business = storyStateCapacityCenter(countryId, 'BUSINESS_COUNCIL');
    const civilOrganizationBps = storyStateCapacityClampBps(civilService && civilService.organizationBps);
    const civilAdministrationBps = storyStateCapacityClampBps(
        civilService && civilService.capabilities && civilService.capabilities.administrationBps
    );
    const civilIndependenceBps = storyStateCapacityClampBps(civilService && civilService.independenceBps);
    const fiscal = storyStateCapacityFiscalContinuity(countryId);
    const bureaucraticCapacityBps = storyStateCapacityWeighted([
        { value: civilAdministrationBps, weight: 35 },
        { value: civilOrganizationBps, weight: 25 },
        { value: publicServicesBps, weight: 25 },
        { value: fiscal.fiscalContinuityBps, weight: 15 }
    ]);
    const institutionalChecksBps = storyStateCapacityInstitutionalChecks(countryId);
    const ruleOfLawBps = storyStateCapacityWeighted([
        { value: institutionalChecksBps, weight: 45 },
        { value: civilIndependenceBps, weight: 30 },
        { value: legitimacyBps, weight: 25 }
    ]);
    const institutionalIntegrityBps = storyStateCapacityWeighted([
        { value: ruleOfLawBps, weight: 35 },
        { value: civilIndependenceBps, weight: 30 },
        { value: civilOrganizationBps, weight: 20 },
        { value: fiscal.fiscalContinuityBps, weight: 15 }
    ]);
    const businessInfluenceBps = storyStateCapacityClampBps(business && business.influenceBps);
    const civilInfluenceBps = storyStateCapacityClampBps(civilService && civilService.influenceBps);
    const capturePressureBps = storyStateCapacityClampBps(Math.max(0, businessInfluenceBps - civilInfluenceBps));
    const arrearsPressureBps = storyStateCapacityClampBps(fiscal.missedPaymentDays * 100);
    const corruptionRiskBps = storyStateCapacityWeighted([
        { value: 10000 - institutionalIntegrityBps, weight: 70 },
        { value: capturePressureBps, weight: 20 },
        { value: arrearsPressureBps, weight: 10 }
    ]);
    return {
        countryId, legitimacyBps, bureaucraticCapacityBps, ruleOfLawBps,
        institutionalIntegrityBps, corruptionRiskBps,
        regionalControlBps: 0, implementationCapacityBps: 0,
        regionIds: [], updatedAt: storyStateCapacityRound(STORY.clock),
        sources: {
            welfareBps, factionApprovalBps, grievanceBps, publicServicesBps,
            civilOrganizationBps, civilAdministrationBps, civilIndependenceBps,
            fiscalContinuityBps: fiscal.fiscalContinuityBps,
            fiscalStatus: fiscal.status, missedPaymentDays: fiscal.missedPaymentDays,
            institutionalChecksBps, businessInfluenceBps, civilInfluenceBps,
            capturePressureBps,
            needsTick: STORY.needsWelfare ? STORY.needsWelfare.tickSequence : null,
            opinionTick: STORY.publicOpinion ? STORY.publicOpinion.tickSequence : null,
            powerCenterTick: STORY.powerCenters ? STORY.powerCenters.tickSequence : null,
            institutionTick: STORY.institutions ? STORY.institutions.tickSequence : null
        }
    };
}

function storyStateCapacityBuildSnapshots() {
    const countries = {};
    for (const state of (STORY.states || [])) {
        const row = storyStateCapacityCountrySnapshot(state);
        countries[row.countryId] = row;
    }
    const infrastructureAccessByRegion = storyStateCapacityInfrastructureAccessMap();
    const regions = {};
    for (const node of (STORY.nodes || [])) {
        const row = storyStateCapacityRegionSnapshot(node, countries, infrastructureAccessByRegion);
        regions[row.regionId] = row;
    }
    for (const country of Object.values(countries)) {
        const owned = Object.values(regions).filter(region => region.countryId === country.countryId);
        country.regionIds = owned.map(region => region.regionId).sort((a, b) => a.localeCompare(b, 'en'));
        let people = 0;
        let weightedControl = 0;
        for (const region of owned) {
            const population = STORY.population && STORY.population.regions
                ? STORY.population.regions[region.regionId] : null;
            const weight = Math.max(1, Number(population && population.populationPeople) || 1);
            people += weight;
            weightedControl += region.regionalControlBps * weight;
        }
        country.regionalControlBps = storyStateCapacityClampBps(people ? weightedControl / people : 0);
        country.implementationCapacityBps = storyStateCapacityWeighted([
            { value: country.bureaucraticCapacityBps, weight: 35 },
            { value: country.legitimacyBps, weight: 25 },
            { value: country.institutionalIntegrityBps, weight: 20 },
            { value: country.regionalControlBps, weight: 20 }
        ]);
    }
    return { countries, regions };
}

function storyStateCapacityRecordEvent(ledger, type, details) {
    const event = Object.assign({
        id: `state-capacity-event:${ledger.nextEventSequence++}`,
        type: String(type), at: storyStateCapacityRound(STORY.clock)
    }, storyStateCapacityClone(details || {}));
    ledger.events.push(event);
    if (ledger.events.length > STORY_STATE_CAPACITY_POLICY.maximumEvents) {
        ledger.events.splice(0, ledger.events.length - STORY_STATE_CAPACITY_POLICY.maximumEvents);
    }
    return event;
}
function storyStateCapacityLedgerCreate(options) {
    options = options || {};
    const ledger = {
        schemaVersion: STORY_STATE_CAPACITY_SCHEMA_VERSION,
        adapterVersion: STORY_STATE_CAPACITY_ADAPTER_VERSION,
        policyHash: STORY_STATE_CAPACITY_POLICY_HASH,
        institutionPolicyHash: typeof STORY_INSTITUTION_POLICY_HASH === 'string' ? STORY_INSTITUTION_POLICY_HASH : null,
        tickSequence: 0, lastTickAt: storyStateCapacityRound(STORY.clock),
        nextEventSequence: 1, countries: {}, regions: {}, tickets: {}, events: [],
        diagnostics: {
            backfilled: !!options.backfilled,
            restoredFromInvalidLedger: !!options.restoredFromInvalidLedger,
            issues: (options.issues || []).slice(0, 50),
            warnings: options.backfilled
                ? ['Eski kayıtta devlet kapasitesi yoktu; mevcut kanonik kaynaklardan başlangıç fotoğrafı kuruldu.'] : [],
            effectModel: STORY_STATE_CAPACITY_POLICY.effectModel,
            provenCorruptionCrimes: false, randomDecisions: false, llmDecisions: false,
            physicalMutations: false
        }
    };
    STORY.stateCapacity = ledger;
    const snapshots = storyStateCapacityBuildSnapshots();
    ledger.countries = snapshots.countries;
    ledger.regions = snapshots.regions;
    return ledger;
}
function storyStateCapacityValidate(ledger) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) return {
        ok: false, issues: [{ code: 'STATE_CAPACITY_LEDGER_REQUIRED', path: '$', message: 'Devlet kapasitesi defteri zorunlu.' }]
    };
    if (ledger.schemaVersion !== STORY_STATE_CAPACITY_SCHEMA_VERSION) add('STATE_CAPACITY_SCHEMA', '$.schemaVersion', 'Şema sürümü uyuşmuyor.');
    if (ledger.adapterVersion !== STORY_STATE_CAPACITY_ADAPTER_VERSION) add('STATE_CAPACITY_ADAPTER', '$.adapterVersion', 'Adaptör sürümü uyuşmuyor.');
    if (ledger.policyHash !== STORY_STATE_CAPACITY_POLICY_HASH) add('STATE_CAPACITY_POLICY', '$.policyHash', 'Politika karması uyuşmuyor.');
    if (ledger.institutionPolicyHash !== STORY_INSTITUTION_POLICY_HASH) add('STATE_CAPACITY_INSTITUTION_LINK', '$.institutionPolicyHash', 'Faz 29 yetki sözleşmesi uyuşmuyor.');
    const knownCountries = new Set((STORY.states || []).map(row => storyStateCapacityCountryId(row.id)));
    const knownRegions = new Set((STORY.nodes || []).map(row => storyStateCapacityRegionId(row.id)));
    for (const countryId of Object.keys(ledger.countries || {})) {
        if (!knownCountries.has(countryId)) add('STATE_CAPACITY_UNKNOWN_COUNTRY', `$.countries.${countryId}`, 'Bilinmeyen ülke kapasite kaydı.');
    }
    for (const regionId of Object.keys(ledger.regions || {})) {
        if (!knownRegions.has(regionId)) add('STATE_CAPACITY_UNKNOWN_REGION', `$.regions.${regionId}`, 'Bilinmeyen bölge kapasite kaydı.');
    }
    for (const countryId of knownCountries) {
        const row = ledger.countries && ledger.countries[countryId];
        if (!row || row.countryId !== countryId) { add('STATE_CAPACITY_COUNTRY', `$.countries.${countryId}`, 'Ülke kapasite kaydı eksik.'); continue; }
        for (const field of ['legitimacyBps', 'bureaucraticCapacityBps', 'ruleOfLawBps', 'institutionalIntegrityBps', 'corruptionRiskBps', 'regionalControlBps', 'implementationCapacityBps']) {
            if (!Number.isInteger(row[field]) || row[field] < 0 || row[field] > 10000) add('STATE_CAPACITY_BPS', `$.countries.${countryId}.${field}`, 'Ölçü 0–10.000 tamsayı olmalı.');
        }
    }
    for (const regionId of knownRegions) {
        const row = ledger.regions && ledger.regions[regionId];
        if (!row || row.regionId !== regionId || !knownCountries.has(row.countryId)) { add('STATE_CAPACITY_REGION', `$.regions.${regionId}`, 'Bölge kapasite kaydı eksik veya sahipsiz.'); continue; }
        for (const field of ['administrativeReachBps', 'regionalControlBps', 'securityBps', 'publicServicesBps', 'infrastructureAccessBps', 'garrisonPresenceBps']) {
            if (!Number.isInteger(row[field]) || row[field] < 0 || row[field] > 10000) add('STATE_CAPACITY_REGION_BPS', `$.regions.${regionId}.${field}`, 'Bölge ölçüsü 0–10.000 tamsayı olmalı.');
        }
    }
    const tickets = Object.values(ledger.tickets || {});
    if (tickets.length > STORY_STATE_CAPACITY_POLICY.maximumTickets) add('STATE_CAPACITY_TICKET_LIMIT', '$.tickets', 'Uygulama fişi bütçesi aşıldı.');
    const authorizationIds = new Set();
    for (const ticket of tickets) {
        const at = `$.tickets.${ticket && ticket.id}`;
        if (!ticket || !ticket.id || !knownCountries.has(ticket.countryId)) { add('STATE_CAPACITY_TICKET', at, 'Uygulama fişi kimliği/ülkesi geçersiz.'); continue; }
        if (ticket.id !== storyStateCapacityTicketId(ticket.authorizationRequestId)) add('STATE_CAPACITY_TICKET_ID', `${at}.id`, 'Uygulama fişi kimliği yetki fişiyle uyuşmuyor.');
        if (authorizationIds.has(ticket.authorizationRequestId)) add('STATE_CAPACITY_DUPLICATE_AUTHORIZATION', `${at}.authorizationRequestId`, 'Aynı yetki fişi iki kez tüketilemez.');
        authorizationIds.add(ticket.authorizationRequestId);
        if (!STORY_STATE_CAPACITY_TICKET_STATUSES.includes(ticket.status)) add('STATE_CAPACITY_TICKET_STATUS', `${at}.status`, 'Uygulama durumu geçersiz.');
        if (!STORY_STATE_CAPACITY_COMPLEXITY_POLICY[ticket.complexity]) add('STATE_CAPACITY_TICKET_COMPLEXITY', `${at}.complexity`, 'Uygulama karmaşıklığı geçersiz.');
        if (ticket.targetRegionId != null && !knownRegions.has(ticket.targetRegionId)) add('STATE_CAPACITY_TICKET_REGION', `${at}.targetRegionId`, 'Uygulama fişi bilinmeyen bölgeyi hedefliyor.');
        if (!Number.isInteger(ticket.progressBps) || ticket.progressBps < 0 || ticket.progressBps > 10000) add('STATE_CAPACITY_TICKET_PROGRESS', `${at}.progressBps`, 'İlerleme 0–10.000 tamsayı olmalı.');
        if (ticket.effectModel !== STORY_STATE_CAPACITY_POLICY.effectModel) add('STATE_CAPACITY_TICKET_EFFECT', `${at}.effectModel`, 'Faz 30 fiziksel etki uyduramaz.');
        const receipt = ticket.authorizationReceipt;
        if (!receipt || receipt.requestId !== ticket.authorizationRequestId
            || receipt.actionType !== ticket.actionType
            || receipt.sourceEffectModel !== 'AUTHORIZATION_RECORD_ONLY_PHASE_29'
            || typeof receipt.authoritySignature !== 'string' || !receipt.authoritySignature
            || !Number.isFinite(Number(receipt.executedAt))
            || !receipt.proposer || !receipt.proposer.actorId || !receipt.proposer.sourceKind) {
            add('STATE_CAPACITY_AUTHORIZATION_RECEIPT', `${at}.authorizationReceipt`, 'Uygulama fişi geçerli Faz 29 yetki makbuzu taşımalı.');
        }
        const sourceRequest = STORY.institutions && STORY.institutions.requests
            ? STORY.institutions.requests[ticket.authorizationRequestId] : null;
        if (sourceRequest && (sourceRequest.status !== 'EXECUTED'
            || sourceRequest.countryId !== ticket.countryId
            || sourceRequest.actionType !== ticket.actionType
            || sourceRequest.authoritySignature !== (receipt && receipt.authoritySignature))) {
            add('STATE_CAPACITY_SOURCE_REQUEST_MISMATCH', `${at}.authorizationReceipt`, 'Uygulama fişi kanonik yürütülmüş kararla uyuşmuyor.');
        }
        if (STORY_STATE_CAPACITY_TERMINAL_STATUSES.includes(ticket.status) && !ticket.result) add('STATE_CAPACITY_TICKET_RESULT', `${at}.result`, 'Tamamlanan fiş sonuç taşımalı.');
        if (!STORY_STATE_CAPACITY_TERMINAL_STATUSES.includes(ticket.status) && ticket.result) add('STATE_CAPACITY_PREMATURE_RESULT', `${at}.result`, 'Devam eden uygulama sonuç taşıyamaz.');
        if ((ticket.status === 'COMPLETED' || ticket.status === 'DEGRADED') && ticket.progressBps !== 10000) add('STATE_CAPACITY_TERMINAL_PROGRESS', `${at}.progressBps`, 'Tamamlanan/bozulan uygulama tam ilerleme taşımalı.');
        if (ticket.result && (ticket.result.physicalMutation !== false
            || ticket.result.effectModel !== STORY_STATE_CAPACITY_POLICY.effectModel)) {
            add('STATE_CAPACITY_RESULT_EFFECT', `${at}.result`, 'Faz 30 sonucu fiziksel mutasyon içeremez.');
        }
    }
    if (!Array.isArray(ledger.events) || ledger.events.length > STORY_STATE_CAPACITY_POLICY.maximumEvents) add('STATE_CAPACITY_EVENT_LIMIT', '$.events', 'Olay bütçesi aşıldı.');
    return { ok: issues.length === 0, issues };
}
function storyStateCapacityReset(options) {
    if (!storyStateCapacityEnabled()) { STORY.stateCapacity = null; return null; }
    return storyStateCapacityLedgerCreate(options);
}
function storyStateCapacityEnsure() {
    if (!storyStateCapacityEnabled()) return null;
    return STORY.stateCapacity || storyStateCapacityReset({ backfilled: true });
}
function storyStateCapacityRestore(saved) {
    if (!storyStateCapacityEnabled()) { STORY.stateCapacity = null; return null; }
    if (!saved) return storyStateCapacityReset({ backfilled: true });
    const candidate = storyStateCapacityClone(saved);
    const validation = storyStateCapacityValidate(candidate);
    if (validation.ok) { STORY.stateCapacity = candidate; return candidate; }
    const ledger = storyStateCapacityLedgerCreate({ backfilled: true, restoredFromInvalidLedger: true, issues: validation.issues });
    ledger.diagnostics.warnings.push('Bozuk devlet kapasitesi defteri kullanılmadı; canlı kaynaklardan güvenli başlangıç kuruldu.');
    return ledger;
}
function storyStateCapacityForSave() {
    const ledger = storyStateCapacityEnsure();
    if (!ledger) return null;
    const validation = storyStateCapacityValidate(ledger);
    if (!validation.ok) throw new Error(`Geçersiz devlet kapasitesi defteri: ${validation.issues[0].code}`);
    return storyStateCapacityClone(ledger);
}

function storyStateCapacityEligibleRequest(request) {
    if (!request || request.status !== 'EXECUTED') return false;
    if (request.effectModel !== 'AUTHORIZATION_RECORD_ONLY_PHASE_29') return false;
    if (!STORY_STATE_CAPACITY_COMPLEXITY[request.actionType]) return false;
    // Güç merkezinin kendi bildirimi, yayını veya özel koordinasyonu devlet
    // bürokrasisinin işi değildir. Kurumsal başvuru ya da gerçek kurum yürütücüsü gerekir.
    return !!request.executorInstitutionId
        || !!(request.proposer && request.proposer.sourceKind === 'INSTITUTION');
}
function storyStateCapacityTicketId(requestId) { return `implementation:${String(requestId)}`; }
function storyStateCapacityCapacitySnapshot(ledger, ticket) {
    const country = ledger.countries[ticket.countryId];
    const region = ticket.targetRegionId ? ledger.regions[ticket.targetRegionId] : null;
    const controlBps = region ? region.regionalControlBps : (country ? country.regionalControlBps : 0);
    const implementationCapacityBps = storyStateCapacityWeighted([
        { value: country && country.implementationCapacityBps, weight: region ? 70 : 100 },
        { value: controlBps, weight: region ? 30 : 0 }
    ]);
    const leakageRiskBps = storyStateCapacityWeighted([
        { value: country && country.corruptionRiskBps, weight: 55 },
        { value: 10000 - controlBps, weight: 25 },
        { value: 10000 - (country && country.bureaucraticCapacityBps), weight: 20 }
    ]);
    return {
        at: storyStateCapacityRound(STORY.clock), implementationCapacityBps,
        legitimacyBps: storyStateCapacityClampBps(country && country.legitimacyBps),
        bureaucraticCapacityBps: storyStateCapacityClampBps(country && country.bureaucraticCapacityBps),
        institutionalIntegrityBps: storyStateCapacityClampBps(country && country.institutionalIntegrityBps),
        controlBps, leakageRiskBps
    };
}
function storyStateCapacityCreateTicket(ledger, request) {
    const complexity = STORY_STATE_CAPACITY_COMPLEXITY[request.actionType];
    const policy = STORY_STATE_CAPACITY_COMPLEXITY_POLICY[complexity];
    const id = storyStateCapacityTicketId(request.id);
    const ticket = {
        id, authorizationRequestId: request.id, countryId: request.countryId,
        actionType: request.actionType, targetRegionId: request.targetRegionId || null,
        complexity, requiredCapacityBps: policy.requiredCapacityBps,
        baseDurationSeconds: policy.baseDurationSeconds,
        status: 'QUEUED', progressBps: 0,
        createdAt: storyStateCapacityRound(STORY.clock), startedAt: null,
        updatedAt: storyStateCapacityRound(STORY.clock), completedAt: null,
        deadlineAt: storyStateCapacityRound((Number(STORY.clock) || 0)
            + policy.baseDurationSeconds * STORY_STATE_CAPACITY_POLICY.maximumDurationMultiplier),
        effectModel: STORY_STATE_CAPACITY_POLICY.effectModel,
        authorizationReceipt: {
            requestId: request.id, authoritySignature: request.authoritySignature,
            actionType: request.actionType, executedAt: request.executedAt,
            proposer: storyStateCapacityClone(request.proposer),
            executorInstitutionId: request.executorInstitutionId || null,
            sourceEffectModel: request.effectModel
        },
        startCapacity: null, latestCapacity: null, result: null
    };
    ledger.tickets[id] = ticket;
    storyStateCapacityRecordEvent(ledger, 'IMPLEMENTATION_QUEUED', {
        ticketId: id, authorizationRequestId: request.id, countryId: request.countryId,
        actionType: request.actionType, complexity
    });
    return ticket;
}
function storyStateCapacityPruneTickets(ledger) {
    const rows = Object.values(ledger.tickets || {});
    if (rows.length <= STORY_STATE_CAPACITY_POLICY.maximumTickets) return;
    const removable = rows.filter(row => STORY_STATE_CAPACITY_TERMINAL_STATUSES.includes(row.status))
        .sort((a, b) => Number(a.completedAt || a.updatedAt) - Number(b.completedAt || b.updatedAt)
            || a.id.localeCompare(b.id, 'en'));
    while (Object.keys(ledger.tickets).length > STORY_STATE_CAPACITY_POLICY.maximumTickets && removable.length) {
        delete ledger.tickets[removable.shift().id];
    }
}
function storyStateCapacityFinish(ledger, ticket, status, snapshot, reasonCodes) {
    const policy = STORY_STATE_CAPACITY_COMPLEXITY_POLICY[ticket.complexity];
    const qualityBps = status === 'PAPER_ONLY' ? 0 : storyStateCapacityClampBps(
        snapshot.institutionalIntegrityBps * 0.45 + snapshot.controlBps * 0.30
        + snapshot.legitimacyBps * 0.25 - policy.qualityPenaltyBps
    );
    ticket.status = status;
    ticket.updatedAt = storyStateCapacityRound(STORY.clock);
    ticket.completedAt = ticket.updatedAt;
    ticket.latestCapacity = snapshot;
    ticket.result = {
        status, implementationQualityBps: qualityBps,
        leakageBps: snapshot.leakageRiskBps,
        reasonCodes: (reasonCodes || []).slice(),
        physicalMutation: false, effectReady: status === 'COMPLETED' || status === 'DEGRADED',
        effectModel: STORY_STATE_CAPACITY_POLICY.effectModel
    };
    storyStateCapacityRecordEvent(ledger, `IMPLEMENTATION_${status}`, {
        ticketId: ticket.id, authorizationRequestId: ticket.authorizationRequestId,
        countryId: ticket.countryId, actionType: ticket.actionType,
        implementationQualityBps: qualityBps, leakageBps: snapshot.leakageRiskBps,
        reasonCodes: ticket.result.reasonCodes, physicalMutation: false
    });
}
function storyStateCapacityAdvanceTicket(ledger, ticket, dt) {
    if (STORY_STATE_CAPACITY_TERMINAL_STATUSES.includes(ticket.status)) return;
    const snapshot = storyStateCapacityCapacitySnapshot(ledger, ticket);
    ticket.latestCapacity = snapshot;
    ticket.updatedAt = storyStateCapacityRound(STORY.clock);
    if (ticket.targetRegionId) {
        const region = ledger.regions[ticket.targetRegionId];
        if (!region || region.countryId !== ticket.countryId) {
            storyStateCapacityFinish(ledger, ticket, 'PAPER_ONLY', snapshot, ['TARGET_JURISDICTION_LOST']);
            return;
        }
    }
    if ((Number(STORY.clock) || 0) >= ticket.deadlineAt && ticket.progressBps < 10000) {
        storyStateCapacityFinish(ledger, ticket, 'PAPER_ONLY', snapshot, [
            'IMPLEMENTATION_DEADLINE_EXCEEDED',
            snapshot.implementationCapacityBps < ticket.requiredCapacityBps ? 'CAPACITY_BELOW_REQUIREMENT' : 'INSUFFICIENT_PROGRESS'
        ]);
        return;
    }
    if (snapshot.implementationCapacityBps < STORY_STATE_CAPACITY_POLICY.minimumStartCapacityBps) {
        // Başlamış bir uygulama kapasite çökünce geçmişini silip yeniden sıraya
        // girmiş gibi görünmez; ilerlemesi donar ve son tarihte kâğıtta kalır.
        ticket.status = ticket.startedAt == null ? 'QUEUED' : 'IMPLEMENTING';
        return;
    }
    if (ticket.status === 'QUEUED') {
        ticket.status = 'IMPLEMENTING';
        ticket.startedAt = storyStateCapacityRound(STORY.clock);
        ticket.startCapacity = storyStateCapacityClone(snapshot);
        storyStateCapacityRecordEvent(ledger, 'IMPLEMENTATION_STARTED', {
            ticketId: ticket.id, countryId: ticket.countryId, actionType: ticket.actionType,
            implementationCapacityBps: snapshot.implementationCapacityBps
        });
    }
    const increment = Math.max(1, Math.round(
        Math.max(0, Number(dt) || 0) / ticket.baseDurationSeconds
        * snapshot.implementationCapacityBps
    ));
    ticket.progressBps = Math.min(10000, ticket.progressBps + increment);
    if (ticket.progressBps < 10000) return;
    const policy = STORY_STATE_CAPACITY_COMPLEXITY_POLICY[ticket.complexity];
    const qualityBps = storyStateCapacityClampBps(
        snapshot.institutionalIntegrityBps * 0.45 + snapshot.controlBps * 0.30
        + snapshot.legitimacyBps * 0.25 - policy.qualityPenaltyBps
    );
    const reasons = [];
    if (snapshot.implementationCapacityBps < ticket.requiredCapacityBps) reasons.push('CAPACITY_BELOW_REQUIREMENT');
    if (snapshot.leakageRiskBps >= STORY_STATE_CAPACITY_POLICY.degradedLeakageThresholdBps) reasons.push('HIGH_DIVERSION_RISK');
    if (qualityBps < STORY_STATE_CAPACITY_POLICY.degradedQualityThresholdBps) reasons.push('LOW_IMPLEMENTATION_QUALITY');
    storyStateCapacityFinish(ledger, ticket, reasons.length ? 'DEGRADED' : 'COMPLETED', snapshot, reasons);
}
function storyStateCapacityTick(dt) {
    const ledger = storyStateCapacityEnsure();
    if (!ledger) return { disabled: true };
    const snapshots = storyStateCapacityBuildSnapshots();
    ledger.countries = snapshots.countries;
    ledger.regions = snapshots.regions;
    const requests = STORY.institutions && STORY.institutions.requests || {};
    for (const request of Object.values(requests).sort((a, b) => String(a.id).localeCompare(String(b.id), 'en'))) {
        if (!storyStateCapacityEligibleRequest(request)) continue;
        const id = storyStateCapacityTicketId(request.id);
        if (!ledger.tickets[id]) storyStateCapacityCreateTicket(ledger, request);
    }
    for (const ticket of Object.values(ledger.tickets).sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
        storyStateCapacityAdvanceTicket(ledger, ticket, dt);
    }
    storyStateCapacityPruneTickets(ledger);
    ledger.tickSequence++;
    ledger.lastTickAt = storyStateCapacityRound(STORY.clock);
    return {
        disabled: false, tickSequence: ledger.tickSequence,
        countryCount: Object.keys(ledger.countries).length,
        regionCount: Object.keys(ledger.regions).length,
        ticketCount: Object.keys(ledger.tickets).length
    };
}

// Görünüm çağrıları bilinçli olarak ensure/reconcile yapmaz. UI açmak zaman
// ilerletmez, yeni fiş üretmez ve kayıt karmasını değiştirmez.
function storyStateCapacityCountryView(countryId) {
    const ledger = storyStateCapacityEnabled() ? STORY.stateCapacity : null;
    const id = storyStateCapacityCountryId(countryId);
    if (!ledger || !ledger.countries || !ledger.countries[id]) return null;
    const out = storyStateCapacityClone(ledger.countries[id]);
    out.implementationTickets = Object.values(ledger.tickets || {})
        .filter(ticket => ticket.countryId === id)
        .sort((a, b) => Number(b.createdAt) - Number(a.createdAt) || a.id.localeCompare(b.id, 'en'));
    return out;
}
function storyStateCapacityRegionView(regionId) {
    const ledger = storyStateCapacityEnabled() ? STORY.stateCapacity : null;
    const id = storyStateCapacityRegionId(regionId);
    if (!ledger || !ledger.regions || !ledger.regions[id]) return null;
    const out = storyStateCapacityClone(ledger.regions[id]);
    out.implementationTickets = Object.values(ledger.tickets || {})
        .filter(ticket => ticket.targetRegionId === id)
        .sort((a, b) => Number(b.createdAt) - Number(a.createdAt) || a.id.localeCompare(b.id, 'en'));
    return out;
}
function storyStateCapacityPublicView(value) {
    if (!value) return null;
    if (value.regionId) return {
        regionId: value.regionId, countryId: value.countryId,
        regionalControlBps: value.regionalControlBps,
        administrativeReachBps: value.administrativeReachBps,
        underSiege: !!value.underSiege
    };
    return {
        countryId: value.countryId, legitimacyBps: value.legitimacyBps,
        regionalControlBps: value.regionalControlBps
    };
}
function storyStateCapacitySummary() {
    const ledger = storyStateCapacityEnabled() ? STORY.stateCapacity : null;
    if (!ledger) return {
        schemaVersion: STORY_STATE_CAPACITY_SCHEMA_VERSION,
        adapterVersion: STORY_STATE_CAPACITY_ADAPTER_VERSION,
        disabled: true, countryCount: 0, regionCount: 0, ticketCount: 0
    };
    const countries = Object.values(ledger.countries || {});
    const tickets = Object.values(ledger.tickets || {});
    const average = field => storyStateCapacityClampBps(countries.length
        ? countries.reduce((sum, row) => sum + row[field], 0) / countries.length : 0);
    return {
        schemaVersion: ledger.schemaVersion, adapterVersion: ledger.adapterVersion,
        policyHash: ledger.policyHash, disabled: false, tickSequence: ledger.tickSequence,
        countryCount: countries.length, regionCount: Object.keys(ledger.regions || {}).length,
        ticketCount: tickets.length,
        queuedCount: tickets.filter(row => row.status === 'QUEUED').length,
        implementingCount: tickets.filter(row => row.status === 'IMPLEMENTING').length,
        completedCount: tickets.filter(row => row.status === 'COMPLETED').length,
        degradedCount: tickets.filter(row => row.status === 'DEGRADED').length,
        paperOnlyCount: tickets.filter(row => row.status === 'PAPER_ONLY').length,
        averageLegitimacyBps: average('legitimacyBps'),
        averageBureaucraticCapacityBps: average('bureaucraticCapacityBps'),
        averageCorruptionRiskBps: average('corruptionRiskBps'),
        averageRegionalControlBps: average('regionalControlBps'),
        eventCount: (ledger.events || []).length
    };
}
