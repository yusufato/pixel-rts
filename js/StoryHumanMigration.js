// ============================================================================
//  GOC VE MULTECI AKISI — Faz 27
//  ---------------------------------------------------------------------------
//  Savas/guvenlik, yasam kosulu, issizlik ve kolektif eylem baskisini kanonik
//  bolgeler arasinda rotali, kapasiteli ve tam kisi korunumlu akisa cevirir.
//  Nufusun sahibi StoryPopulation'dir; bu defter yalniz karar, rota ve sonucu
//  saklar. Ucret, konut veya sinir politikasi henuz yoksa sahte kesinlik uretmez.
// ============================================================================

const STORY_HUMAN_MIGRATION_SCHEMA_VERSION = 1;
const STORY_HUMAN_MIGRATION_ADAPTER_VERSION = 'story-human-migration-ledger-1';
const STORY_HUMAN_MIGRATION_STATUSES = Object.freeze(['IN_TRANSIT', 'BLOCKED', 'COMPLETED', 'CANCELLED']);
const STORY_HUMAN_MIGRATION_KINDS = Object.freeze(['INTERNAL_MIGRATION', 'CROSS_BORDER_MIGRATION', 'REFUGEE']);
const STORY_HUMAN_MIGRATION_CAUSES = Object.freeze(['SECURITY', 'UPRISING', 'EMPLOYMENT', 'WELLBEING']);
const STORY_HUMAN_MIGRATION_POLICY = Object.freeze({
    maximumFlows: 256,
    maximumEvents: 256,
    maximumNewFlowsPerTick: 4,
    maximumOriginsConsidered: 10,
    maximumTargetsConsidered: 14,
    maximumPeoplePerFlow: 90,
    maximumOriginSharePerFlowBps: 18,
    minimumOriginPopulationPeople: 1000,
    minimumEconomicPushBps: 2600,
    maximumEconomicOriginWellbeingBps: 6500,
    refugeeSecurityBps: 5000,
    minimumTargetSecurityBps: 6800,
    minimumEconomicQualityGainBps: 900,
    crossBorderEconomicPenaltyBps: 900,
    crossBorderEconomicMinimumGainBps: 2100,
    routeCapacityPeoplePerUnit: 4,
    minimumTravelSeconds: 10,
    latencyToTravelSeconds: 12,
    retrySeconds: 10,
    maximumRouteAttempts: 3,
    receptionHeadroomBps: 1200,
    minimumReceptionHeadroomPeople: 600,
    infrastructureReceptionPeoplePerLevel: 180,
    publicEventMinimumPeople: 25,
    capacityModel: 'ROUTE_BOTTLENECK_AND_FIXED_RECEPTION_PROXY_PRE_ASSET_HOUSING',
    borderModel: 'TWO_COUNTRY_AUTHORIZATION_NO_THIRD_PARTY_TRANSIT',
    settlementModel: 'ATOMIC_ON_ARRIVAL_SOURCE_CENSUS_UNTIL_SETTLEMENT'
});
const STORY_HUMAN_MIGRATION_POLICY_HASH = storyProductionHash({
    schemaVersion: STORY_HUMAN_MIGRATION_SCHEMA_VERSION,
    adapterVersion: STORY_HUMAN_MIGRATION_ADAPTER_VERSION,
    policy: STORY_HUMAN_MIGRATION_POLICY
});

function storyHumanMigrationEnabled() {
    return typeof storyFeatureEnabled !== 'function' || storyFeatureEnabled('population.humanMigration');
}

function storyHumanMigrationClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyHumanMigrationClampBps(value) {
    return Math.max(0, Math.min(10000, Math.round(Number(value) || 0)));
}

function storyHumanMigrationRound(value) {
    return Math.round((Number(value) || 0) * 1e6) / 1e6;
}

function storyHumanMigrationRegionId(value) {
    return String(value).startsWith('region:') ? String(value) : `region:${Number(value)}`;
}

function storyHumanMigrationNode(regionId) {
    const id = storyHumanMigrationRegionId(regionId);
    return (STORY.nodes || []).find(node => `region:${Number(node.id)}` === id) || null;
}

function storyHumanMigrationCountryIdForRegion(regionId) {
    const node = storyHumanMigrationNode(regionId);
    return node && Number.isInteger(Number(node.owner)) && Number(node.owner) >= 0
        ? `country:${Number(node.owner)}` : null;
}

function storyHumanMigrationCollectiveStage(regionId) {
    const view = typeof storyCollectiveRegionView === 'function' ? storyCollectiveRegionView(regionId) : null;
    const ranks = { NONE: 0, PROTEST: 1, STRIKE: 2, UPRISING: 3 };
    return ((view && view.participations) || []).reduce((best, row) => (
        (ranks[row.stage] || 0) > (ranks[best] || 0) ? row.stage : best
    ), 'NONE');
}

function storyHumanMigrationRegionSignal(regionId) {
    const needs = typeof storyNeedsRegionSummaryView === 'function'
        ? storyNeedsRegionSummaryView(regionId) : null;
    const population = typeof storyPopulationRegionView === 'function'
        ? storyPopulationRegionView(regionId) : null;
    if (!needs || !population || !population.countryId) return null;
    const collectiveStage = storyHumanMigrationCollectiveStage(regionId);
    const stagePush = { NONE: 0, PROTEST: 350, STRIKE: 1200, UPRISING: 3600 }[collectiveStage] || 0;
    const securityHardship = 10000 - storyHumanMigrationClampBps(needs.securityBps);
    const wellbeingHardship = 10000 - storyHumanMigrationClampBps(needs.wellbeingBps);
    const pushBps = storyHumanMigrationClampBps(
        securityHardship * 0.62
        + wellbeingHardship * 0.42
        + storyHumanMigrationClampBps(needs.unemploymentRiskBps) * 0.16
        + stagePush
    );
    const qualityBps = storyHumanMigrationClampBps(
        storyHumanMigrationClampBps(needs.wellbeingBps) * 0.55
        + storyHumanMigrationClampBps(needs.securityBps) * 0.35
        + storyHumanMigrationClampBps(needs.publicServicesBps) * 0.10
        - ({ NONE: 0, PROTEST: 250, STRIKE: 900, UPRISING: 2400 }[collectiveStage] || 0)
    );
    const refugee = collectiveStage === 'UPRISING'
        || storyHumanMigrationClampBps(needs.securityBps) < STORY_HUMAN_MIGRATION_POLICY.refugeeSecurityBps;
    const cause = refugee
        ? (collectiveStage === 'UPRISING' ? 'UPRISING' : 'SECURITY')
        : (storyHumanMigrationClampBps(needs.unemploymentRiskBps) >= 1200 ? 'EMPLOYMENT' : 'WELLBEING');
    return {
        regionId: storyHumanMigrationRegionId(regionId),
        countryId: population.countryId,
        populationPeople: population.populationPeople,
        wellbeingBps: storyHumanMigrationClampBps(needs.wellbeingBps),
        securityBps: storyHumanMigrationClampBps(needs.securityBps),
        publicServicesBps: storyHumanMigrationClampBps(needs.publicServicesBps),
        unemploymentRiskBps: storyHumanMigrationClampBps(needs.unemploymentRiskBps),
        collectiveStage,
        pushBps,
        qualityBps,
        refugee,
        cause,
        sourceNeedsTick: STORY.needsWelfare ? STORY.needsWelfare.tickSequence : null,
        sourceCollectiveTick: STORY.collectiveAction ? STORY.collectiveAction.tickSequence : null
    };
}

function storyHumanMigrationReceptionCapacity(regionId, populationPeople) {
    const node = storyHumanMigrationNode(regionId);
    const population = Math.max(0, Math.floor(Number(populationPeople) || 0));
    const infrastructure = node
        ? (Math.max(1, Number(node.level) || 1) + Math.max(0, Number(node.cities) || 0))
        : 1;
    const headroom = Math.max(
        STORY_HUMAN_MIGRATION_POLICY.minimumReceptionHeadroomPeople,
        Math.round(population * STORY_HUMAN_MIGRATION_POLICY.receptionHeadroomBps / 10000)
            + infrastructure * STORY_HUMAN_MIGRATION_POLICY.infrastructureReceptionPeoplePerLevel
    );
    return population + headroom;
}

function storyHumanMigrationCapacityMap() {
    const population = typeof storyPopulationEnsure === 'function' ? storyPopulationEnsure() : null;
    const out = {};
    for (const [regionId, region] of Object.entries((population && population.regions) || {})) {
        out[regionId] = storyHumanMigrationReceptionCapacity(regionId, region.populationPeople);
    }
    return out;
}

function storyHumanMigrationEmptyRegionSummary(regionId) {
    return {
        regionId,
        countryId: storyHumanMigrationCountryIdForRegion(regionId),
        incomingPeople: 0,
        outgoingPeople: 0,
        refugeeInPeople: 0,
        refugeeOutPeople: 0,
        activeInboundPeople: 0,
        activeOutboundPeople: 0,
        completedFlowCount: 0,
        lastArrivalAt: null,
        lastDepartureAt: null
    };
}

function storyHumanMigrationEmptyCountrySummary(countryId) {
    return {
        countryId,
        incomingPeople: 0,
        outgoingPeople: 0,
        refugeeInPeople: 0,
        refugeeOutPeople: 0,
        activeInboundPeople: 0,
        activeOutboundPeople: 0,
        internalPeople: 0,
        completedFlowCount: 0
    };
}

function storyHumanMigrationBuildSummaries(ledger) {
    const regions = {};
    for (const node of (STORY.nodes || [])) {
        const regionId = `region:${Number(node.id)}`;
        regions[regionId] = storyHumanMigrationEmptyRegionSummary(regionId);
    }
    const countries = {};
    for (const state of (STORY.states || [])) {
        const countryId = `country:${Number(state.id)}`;
        countries[countryId] = storyHumanMigrationEmptyCountrySummary(countryId);
    }
    for (const flow of ledger.flows || []) {
        const origin = regions[flow.originRegionId];
        const destination = regions[flow.destinationRegionId];
        const originCountry = countries[flow.originCountryId] || (countries[flow.originCountryId] = storyHumanMigrationEmptyCountrySummary(flow.originCountryId));
        const destinationCountry = countries[flow.destinationCountryId] || (countries[flow.destinationCountryId] = storyHumanMigrationEmptyCountrySummary(flow.destinationCountryId));
        if (flow.status === 'IN_TRANSIT' || flow.status === 'BLOCKED') {
            if (origin) origin.activeOutboundPeople += flow.people;
            if (destination) destination.activeInboundPeople += flow.people;
            originCountry.activeOutboundPeople += flow.people;
            destinationCountry.activeInboundPeople += flow.people;
            continue;
        }
        if (flow.status !== 'COMPLETED') continue;
        if (origin) {
            origin.outgoingPeople += flow.people;
            origin.completedFlowCount++;
            origin.lastDepartureAt = origin.lastDepartureAt == null ? flow.completedAt : Math.max(origin.lastDepartureAt, flow.completedAt);
            if (flow.kind === 'REFUGEE') origin.refugeeOutPeople += flow.people;
        }
        if (destination) {
            destination.incomingPeople += flow.people;
            destination.completedFlowCount++;
            destination.lastArrivalAt = destination.lastArrivalAt == null ? flow.completedAt : Math.max(destination.lastArrivalAt, flow.completedAt);
            if (flow.kind === 'REFUGEE') destination.refugeeInPeople += flow.people;
        }
        originCountry.outgoingPeople += flow.people;
        destinationCountry.incomingPeople += flow.people;
        originCountry.completedFlowCount++;
        if (destinationCountry !== originCountry) destinationCountry.completedFlowCount++;
        if (flow.originCountryId === flow.destinationCountryId) {
            originCountry.internalPeople += flow.people;
        }
        if (flow.kind === 'REFUGEE') {
            originCountry.refugeeOutPeople += flow.people;
            destinationCountry.refugeeInPeople += flow.people;
        }
    }
    ledger.regions = regions;
    ledger.countries = countries;
    return ledger;
}

function storyHumanMigrationLedgerCreate(options) {
    options = options || {};
    const ledger = {
        schemaVersion: STORY_HUMAN_MIGRATION_SCHEMA_VERSION,
        adapterVersion: STORY_HUMAN_MIGRATION_ADAPTER_VERSION,
        policyHash: STORY_HUMAN_MIGRATION_POLICY_HASH,
        topologyHash: STORY.regionModel ? STORY.regionModel.topologyHash : null,
        tickSequence: 0,
        nextFlowSequence: 1,
        lastTickAt: Number(STORY.clock) || 0,
        receptionCapacityPeopleByRegion: storyHumanMigrationCapacityMap(),
        flows: [],
        events: [],
        countries: {},
        regions: {},
        diagnostics: {
            backfilled: !!options.backfilled,
            restoredFromInvalidLedger: !!options.restoredFromInvalidLedger,
            issues: (options.issues || []).slice(0, 50),
            warnings: (options.warnings || []).map(String).slice(0, 30),
            exactPopulationTransfers: true,
            randomDecisions: false,
            llmDecisions: false,
            sharedTradeCapacityReservation: false,
            capacityModel: STORY_HUMAN_MIGRATION_POLICY.capacityModel,
            borderModel: STORY_HUMAN_MIGRATION_POLICY.borderModel,
            settlementModel: STORY_HUMAN_MIGRATION_POLICY.settlementModel,
            housingAssetModelActive: false,
            borderPolicyModelActive: false
        }
    };
    return storyHumanMigrationBuildSummaries(ledger);
}

function storyHumanMigrationValidate(ledger) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) return {
        ok: false,
        issues: [{ code: 'HUMAN_MIGRATION_LEDGER_REQUIRED', path: '$', message: 'Göç defteri zorunlu.' }]
    };
    if (ledger.schemaVersion !== STORY_HUMAN_MIGRATION_SCHEMA_VERSION) add('HUMAN_MIGRATION_SCHEMA', '$.schemaVersion', 'Göç şeması uyuşmuyor.');
    if (ledger.adapterVersion !== STORY_HUMAN_MIGRATION_ADAPTER_VERSION) add('HUMAN_MIGRATION_ADAPTER', '$.adapterVersion', 'Göç adaptörü uyuşmuyor.');
    if (ledger.policyHash !== STORY_HUMAN_MIGRATION_POLICY_HASH) add('HUMAN_MIGRATION_POLICY', '$.policyHash', 'Göç politikası uyuşmuyor.');
    if (ledger.topologyHash !== (STORY.regionModel ? STORY.regionModel.topologyHash : null)) add('HUMAN_MIGRATION_TOPOLOGY', '$.topologyHash', 'Göç defteri yanlış topolojiye bağlı.');
    if (!Number.isInteger(ledger.tickSequence) || ledger.tickSequence < 0) add('HUMAN_MIGRATION_TICK', '$.tickSequence', 'Göç tik sırası negatif olmayan tamsayı olmalı.');
    if (!Number.isInteger(ledger.nextFlowSequence) || ledger.nextFlowSequence < 1) add('HUMAN_MIGRATION_NEXT_FLOW', '$.nextFlowSequence', 'Sonraki göç akışı sırası pozitif tamsayı olmalı.');
    const flowList = Array.isArray(ledger.flows) ? ledger.flows : [];
    const eventList = Array.isArray(ledger.events) ? ledger.events : [];
    if (!Array.isArray(ledger.flows)) add('HUMAN_MIGRATION_FLOWS_ARRAY', '$.flows', 'Göç akışları dizi olmalı.');
    if (!Array.isArray(ledger.events)) add('HUMAN_MIGRATION_EVENTS_ARRAY', '$.events', 'Göç olayları dizi olmalı.');
    const regionIds = (STORY.nodes || []).map(node => `region:${Number(node.id)}`).sort();
    if (JSON.stringify(Object.keys(ledger.receptionCapacityPeopleByRegion || {}).sort()) !== JSON.stringify(regionIds)) {
        add('HUMAN_MIGRATION_CAPACITY_SET', '$.receptionCapacityPeopleByRegion', 'Kabul kapasitesi bütün bölgeleri birebir kapsamalı.');
    }
    for (const regionId of regionIds) {
        const capacity = ledger.receptionCapacityPeopleByRegion
            ? ledger.receptionCapacityPeopleByRegion[regionId] : null;
        if (!Number.isInteger(capacity) || capacity < 0) {
            add('HUMAN_MIGRATION_CAPACITY_VALUE', `$.receptionCapacityPeopleByRegion.${regionId}`, 'Kabul kapasitesi negatif olmayan tam kişi sayısı olmalı.');
        }
    }
    const knownRegions = new Set(regionIds);
    const knownCountries = new Set((STORY.states || []).map(state => `country:${Number(state.id)}`));
    const knownCorridors = new Set((((STORY.infrastructureGraph || {}).corridors) || []).map(row => row.id));
    const knownProfiles = new Set((typeof STORY_POPULATION_PROFILES === 'undefined'
        ? [] : STORY_POPULATION_PROFILES).map(row => row.key));
    const flowIds = new Set();
    for (let index = 0; index < flowList.length; index++) {
        const flow = flowList[index];
        const path = `$.flows[${index}]`;
        if (!flow || typeof flow !== 'object') { add('HUMAN_MIGRATION_FLOW', path, 'Göç akışı nesne olmalı.'); continue; }
        if (flowIds.has(flow.id)) add('HUMAN_MIGRATION_FLOW_ID', `${path}.id`, 'Göç akışı kimliği yinelenemez.');
        flowIds.add(flow.id);
        if (!knownRegions.has(flow.originRegionId) || !knownRegions.has(flow.destinationRegionId) || flow.originRegionId === flow.destinationRegionId) add('HUMAN_MIGRATION_FLOW_REGION', path, 'Kaynak/hedef bölge geçersiz.');
        if (!knownCountries.has(flow.originCountryId) || !knownCountries.has(flow.destinationCountryId)) add('HUMAN_MIGRATION_FLOW_COUNTRY', path, 'Kaynak/hedef ülke geçersiz.');
        if (!STORY_HUMAN_MIGRATION_STATUSES.includes(flow.status)) add('HUMAN_MIGRATION_STATUS', `${path}.status`, 'Göç durumu geçersiz.');
        if (!STORY_HUMAN_MIGRATION_KINDS.includes(flow.kind)) add('HUMAN_MIGRATION_KIND', `${path}.kind`, 'Göç türü geçersiz.');
        if (!STORY_HUMAN_MIGRATION_CAUSES.includes(flow.cause)) add('HUMAN_MIGRATION_CAUSE', `${path}.cause`, 'Göç nedeni geçersiz.');
        if (!Number.isInteger(flow.people) || flow.people <= 0) add('HUMAN_MIGRATION_PEOPLE', `${path}.people`, 'Göç eden kişi sayısı pozitif tamsayı olmalı.');
        const cohortRows = Array.isArray(flow.cohorts) ? flow.cohorts : [];
        const cohortPeople = cohortRows.reduce((sum, row) => sum + (Number(row && row.people) || 0), 0);
        const cohortKeys = new Set();
        const invalidCohort = cohortRows.some(row => {
            if (!row || typeof row !== 'object' || Array.isArray(row)) return true;
            const duplicate = cohortKeys.has(row.profileKey);
            cohortKeys.add(row.profileKey);
            return !knownProfiles.has(row.profileKey) || duplicate
                || !Number.isInteger(row.people) || row.people <= 0;
        });
        if (!Array.isArray(flow.cohorts) || !cohortRows.length || cohortPeople !== flow.people || invalidCohort) add('HUMAN_MIGRATION_COHORT_TOTAL', `${path}.cohorts`, 'Göç kohortları benzersiz/geçerli profillerle akış kişi sayısına tam uymalı.');
        if (!flow.route || !Array.isArray(flow.route.regionIds) || !Array.isArray(flow.route.corridorIds)
            || flow.route.regionIds[0] !== flow.originRegionId
            || flow.route.regionIds[flow.route.regionIds.length - 1] !== flow.destinationRegionId
            || flow.route.regionIds.length !== flow.route.corridorIds.length + 1
            || flow.route.regionIds.some(regionId => !knownRegions.has(regionId))
            || flow.route.corridorIds.some(corridorId => !knownCorridors.has(corridorId))) {
            add('HUMAN_MIGRATION_ROUTE', `${path}.route`, 'Göç rotası kaynak ve hedefe bağlı olmalı.');
        }
        if (!Number.isFinite(Number(flow.departedAt)) || !Number.isFinite(Number(flow.arrivalAt)) || flow.arrivalAt < flow.departedAt) add('HUMAN_MIGRATION_TIME', path, 'Göç zamanları geçersiz.');
        if (flow.status === 'COMPLETED' && !Number.isFinite(Number(flow.completedAt))) add('HUMAN_MIGRATION_COMPLETION', `${path}.completedAt`, 'Tamamlanan akışın varış zamanı olmalı.');
    }
    if (flowList.length > STORY_HUMAN_MIGRATION_POLICY.maximumFlows) add('HUMAN_MIGRATION_FLOW_BOUND', '$.flows', 'Göç geçmişi kayıt tavanını aştı.');
    if (eventList.length > STORY_HUMAN_MIGRATION_POLICY.maximumEvents) add('HUMAN_MIGRATION_EVENT_BOUND', '$.events', 'Göç olay geçmişi tavanı aştı.');
    if (Array.isArray(ledger.flows)) {
        const expected = storyHumanMigrationClone(ledger);
        storyHumanMigrationBuildSummaries(expected);
        if (JSON.stringify(expected.countries) !== JSON.stringify(ledger.countries || {})) add('HUMAN_MIGRATION_COUNTRY_AGGREGATE', '$.countries', 'Ülke göç özetleri akışlardan türemeli.');
        if (JSON.stringify(expected.regions) !== JSON.stringify(ledger.regions || {})) add('HUMAN_MIGRATION_REGION_AGGREGATE', '$.regions', 'Bölge göç özetleri akışlardan türemeli.');
    }
    return { ok: issues.length === 0, issues };
}

function storyHumanMigrationReset(options) {
    if (!storyHumanMigrationEnabled()) { STORY.humanMigration = null; return null; }
    STORY.humanMigration = storyHumanMigrationLedgerCreate(options);
    return STORY.humanMigration;
}

function storyHumanMigrationRestore(saved) {
    if (!storyHumanMigrationEnabled()) { STORY.humanMigration = null; return null; }
    if (!saved) return storyHumanMigrationReset({
        backfilled: true,
        warnings: ['Eski kayıtta göç geçmişi yoktu; geçmiş akış uydurulmadı.']
    });
    const candidate = storyHumanMigrationClone(saved);
    const validation = storyHumanMigrationValidate(candidate);
    if (!validation.ok) return storyHumanMigrationReset({
        backfilled: true,
        restoredFromInvalidLedger: true,
        issues: validation.issues,
        warnings: ['Bozuk göç defteri kullanılmadı; kanonik nüfus korunarak göç geçmişi boş başlatıldı.']
    });
    STORY.humanMigration = candidate;
    return STORY.humanMigration;
}

function storyHumanMigrationEnsure() {
    if (!storyHumanMigrationEnabled()) return null;
    return STORY.humanMigration || storyHumanMigrationReset({ backfilled: true });
}

function storyHumanMigrationForSave() {
    const ledger = storyHumanMigrationEnsure();
    if (!ledger) return null;
    storyHumanMigrationBuildSummaries(ledger);
    const validation = storyHumanMigrationValidate(ledger);
    ledger.diagnostics.issues = validation.ok ? [] : validation.issues.slice(0, 50);
    if (!validation.ok) throw new Error(`Geçersiz göç defteri: ${validation.issues[0].code}`);
    return storyHumanMigrationClone(ledger);
}

function storyHumanMigrationActiveReserved(ledger, regionId) {
    const reserved = {};
    for (const flow of ledger.flows || []) {
        if (flow.originRegionId !== regionId || !['IN_TRANSIT', 'BLOCKED'].includes(flow.status)) continue;
        for (const row of flow.cohorts || []) reserved[row.profileKey] = (reserved[row.profileKey] || 0) + row.people;
    }
    return reserved;
}

function storyHumanMigrationPendingInbound(ledger, regionId) {
    return (ledger.flows || []).filter(flow => flow.destinationRegionId === regionId
        && ['IN_TRANSIT', 'BLOCKED'].includes(flow.status))
        .reduce((sum, flow) => sum + flow.people, 0);
}

const STORY_HUMAN_MIGRATION_ROUTE_CACHE = new Map();

function storyHumanMigrationRoute(origin, destination) {
    const netHash = typeof STORY !== 'undefined' && STORY.infrastructureWorks
        && STORY.infrastructureWorks.networkHash ? STORY.infrastructureWorks.networkHash : '0';
    const cacheKey = `${origin.regionId}:${destination.regionId}:${origin.countryId}:${destination.countryId}:${netHash}`;
    if (STORY_HUMAN_MIGRATION_ROUTE_CACHE.has(cacheKey)) {
        return STORY_HUMAN_MIGRATION_ROUTE_CACHE.get(cacheKey);
    }
    const authorizedCountryIds = [...new Set([origin.countryId, destination.countryId].filter(Boolean))];
    const result = typeof storyInfrastructureFindRoute === 'function'
        ? storyInfrastructureFindRoute(origin.regionId, destination.regionId, {
            modes: ['LAND', 'SEA'],
            authorizedCountryIds,
            minCapacity: 1
        })
        : { ok: false, reason: 'ROUTE_SERVICE_UNAVAILABLE' };
    if (STORY_HUMAN_MIGRATION_ROUTE_CACHE.size > 2000) STORY_HUMAN_MIGRATION_ROUTE_CACHE.clear();
    STORY_HUMAN_MIGRATION_ROUTE_CACHE.set(cacheKey, result);
    return result;
}

function storyHumanMigrationCandidateDestinations(origin, signals, ledger) {
    const candidates = [];
    for (const target of signals) {
        if (target.regionId === origin.regionId || target.securityBps < STORY_HUMAN_MIGRATION_POLICY.minimumTargetSecurityBps) continue;
        const crossBorder = target.countryId !== origin.countryId;
        const rawGain = target.qualityBps - origin.qualityBps;
        if (!origin.refugee) {
            if (rawGain < STORY_HUMAN_MIGRATION_POLICY.minimumEconomicQualityGainBps) continue;
            if (crossBorder && rawGain < STORY_HUMAN_MIGRATION_POLICY.crossBorderEconomicMinimumGainBps) continue;
        }
        const capacity = Number(ledger.receptionCapacityPeopleByRegion[target.regionId]) || 0;
        const headroom = Math.max(0, capacity - target.populationPeople - storyHumanMigrationPendingInbound(ledger, target.regionId));
        if (headroom <= 0) continue;
        const borderPenalty = crossBorder && !origin.refugee
            ? STORY_HUMAN_MIGRATION_POLICY.crossBorderEconomicPenaltyBps : 0;
        candidates.push({ target, crossBorder, rawGain, headroom, score: rawGain - borderPenalty });
    }
    return candidates.sort((a, b) => b.score - a.score
        || b.target.securityBps - a.target.securityBps
        || a.target.regionId.localeCompare(b.target.regionId))
        .slice(0, STORY_HUMAN_MIGRATION_POLICY.maximumTargetsConsidered);
}

function storyHumanMigrationAllocateCohorts(region, totalPeople, reservedByProfile, refugee) {
    const mobility = {
        children: refugee ? 9000 : 2500,
        students: refugee ? 9000 : 12500,
        young_agriculture: refugee ? 10000 : 10000,
        young_industry: refugee ? 10000 : 12500,
        young_services: refugee ? 10000 : 14000,
        adult_agriculture: refugee ? 10000 : 7000,
        adult_industry: refugee ? 10000 : 9000,
        adult_services: refugee ? 10000 : 10500,
        adult_public: refugee ? 9000 : 5500,
        adult_defense: refugee ? 7000 : 2500,
        unemployed: refugee ? 10500 : 15000,
        retired: refugee ? 8500 : 3500
    };
    const rows = (region.cohorts || []).map(cohort => {
        const available = Math.max(0, cohort.membersPeople - (reservedByProfile[cohort.profileKey] || 0));
        return {
            profileKey: cohort.profileKey,
            available,
            weight: available * (mobility[cohort.profileKey] || 10000)
        };
    }).filter(row => row.available > 0 && row.weight > 0);
    const target = Math.min(Math.max(0, Math.floor(totalPeople)), rows.reduce((sum, row) => sum + row.available, 0));
    if (target <= 0) return [];
    const allocations = Object.fromEntries(rows.map(row => [row.profileKey, 0]));
    let remaining = target;
    let active = rows.slice();
    while (remaining > 0 && active.length) {
        const totalWeight = active.reduce((sum, row) => sum + row.weight, 0) || 1;
        const exact = active.map(row => remaining * row.weight / totalWeight);
        const batch = exact.map(Math.floor);
        let remainder = remaining - batch.reduce((sum, value) => sum + value, 0);
        exact.map((value, index) => ({ index, fraction: value - Math.floor(value) }))
            .sort((a, b) => b.fraction - a.fraction || active[a.index].profileKey.localeCompare(active[b.index].profileKey))
            .slice(0, remainder)
            .forEach(row => { batch[row.index]++; });
        let placed = 0;
        for (let index = 0; index < active.length; index++) {
            const row = active[index];
            const room = row.available - allocations[row.profileKey];
            const value = Math.min(room, batch[index]);
            allocations[row.profileKey] += value;
            placed += value;
        }
        if (placed <= 0) break;
        remaining -= placed;
        active = active.filter(row => allocations[row.profileKey] < row.available);
    }
    return Object.keys(allocations).sort().map(profileKey => ({ profileKey, people: allocations[profileKey] }))
        .filter(row => row.people > 0);
}

function storyHumanMigrationTrim(ledger) {
    if (ledger.flows.length > STORY_HUMAN_MIGRATION_POLICY.maximumFlows) {
        const active = ledger.flows.filter(flow => ['IN_TRANSIT', 'BLOCKED'].includes(flow.status));
        const closed = ledger.flows.filter(flow => !['IN_TRANSIT', 'BLOCKED'].includes(flow.status))
            .sort((a, b) => (b.completedAt || b.cancelledAt || b.departedAt) - (a.completedAt || a.cancelledAt || a.departedAt)
                || b.id.localeCompare(a.id));
        ledger.flows = active.concat(closed.slice(0, Math.max(0, STORY_HUMAN_MIGRATION_POLICY.maximumFlows - active.length)))
            .sort((a, b) => a.departedAt - b.departedAt || a.id.localeCompare(b.id));
    }
    if (ledger.events.length > STORY_HUMAN_MIGRATION_POLICY.maximumEvents) {
        ledger.events = ledger.events.slice(-STORY_HUMAN_MIGRATION_POLICY.maximumEvents);
    }
}

function storyHumanMigrationEvent(ledger, type, flow, at, reason) {
    ledger.events.push({
        id: `migration-event:${ledger.tickSequence}:${ledger.events.length + 1}`,
        type,
        at: storyHumanMigrationRound(at),
        flowId: flow.id,
        originRegionId: flow.originRegionId,
        destinationRegionId: flow.destinationRegionId,
        kind: flow.kind,
        cause: flow.cause,
        people: flow.people,
        reason: reason || null
    });
}

function storyHumanMigrationSettleDue(ledger, now) {
    let completed = 0;
    let blocked = 0;
    let cancelled = 0;
    for (const flow of ledger.flows) {
        if (!['IN_TRANSIT', 'BLOCKED'].includes(flow.status) || Number(flow.arrivalAt) > now) continue;
        const origin = storyHumanMigrationRegionSignal(flow.originRegionId);
        const destination = storyHumanMigrationRegionSignal(flow.destinationRegionId);
        const route = origin && destination ? storyHumanMigrationRoute(origin, destination) : { ok: false, reason: 'REGION_STATE_UNAVAILABLE' };
        const population = typeof storyPopulationRegionView === 'function' ? storyPopulationRegionView(flow.destinationRegionId) : null;
        const capacity = Number(ledger.receptionCapacityPeopleByRegion[flow.destinationRegionId]) || 0;
        const headroom = population ? Math.max(0, capacity - population.populationPeople) : 0;
        if (!route.ok || headroom < flow.people) {
            flow.attempts++;
            flow.lastFailureReason = !route.ok ? (route.reason || 'NO_ROUTE') : 'RECEPTION_CAPACITY';
            if (flow.attempts >= STORY_HUMAN_MIGRATION_POLICY.maximumRouteAttempts) {
                flow.status = 'CANCELLED';
                flow.cancelledAt = storyHumanMigrationRound(now);
                storyHumanMigrationEvent(ledger, 'MIGRATION_CANCELLED', flow, now, flow.lastFailureReason);
                cancelled++;
            } else {
                flow.status = 'BLOCKED';
                flow.arrivalAt = storyHumanMigrationRound(now + STORY_HUMAN_MIGRATION_POLICY.retrySeconds);
                storyHumanMigrationEvent(ledger, 'MIGRATION_BLOCKED', flow, now, flow.lastFailureReason);
                blocked++;
            }
            continue;
        }
        const requested = Object.fromEntries(flow.cohorts.map(row => [row.profileKey, row.people]));
        const transfer = typeof storyPopulationTransferCohorts === 'function'
            ? storyPopulationTransferCohorts(flow.originRegionId, flow.destinationRegionId, requested, {
                minimumOriginPopulationPeople: STORY_HUMAN_MIGRATION_POLICY.minimumOriginPopulationPeople
            })
            : { ok: false, reason: 'POPULATION_TRANSFER_UNAVAILABLE' };
        if (!transfer.ok || transfer.movedPeople !== flow.people || transfer.populationDelta !== 0) {
            flow.attempts++;
            flow.lastFailureReason = transfer.reason || 'POPULATION_TRANSFER_MISMATCH';
            if (flow.attempts >= STORY_HUMAN_MIGRATION_POLICY.maximumRouteAttempts) {
                flow.status = 'CANCELLED';
                flow.cancelledAt = storyHumanMigrationRound(now);
                storyHumanMigrationEvent(ledger, 'MIGRATION_CANCELLED', flow, now, flow.lastFailureReason);
                cancelled++;
            } else {
                flow.status = 'BLOCKED';
                flow.arrivalAt = storyHumanMigrationRound(now + STORY_HUMAN_MIGRATION_POLICY.retrySeconds);
                storyHumanMigrationEvent(ledger, 'MIGRATION_BLOCKED', flow, now, flow.lastFailureReason);
                blocked++;
            }
            continue;
        }
        flow.status = 'COMPLETED';
        flow.completedAt = storyHumanMigrationRound(now);
        flow.originCountryId = transfer.originCountryId;
        flow.destinationCountryId = transfer.destinationCountryId;
        flow.populationDelta = transfer.populationDelta;
        flow.originPopulationBefore = transfer.originPopulationBefore;
        flow.originPopulationAfter = transfer.originPopulationAfter;
        flow.destinationPopulationBefore = transfer.destinationPopulationBefore;
        flow.destinationPopulationAfter = transfer.destinationPopulationAfter;
        flow.lastFailureReason = null;
        storyHumanMigrationEvent(ledger, 'MIGRATION_ARRIVED', flow, now, null);
        completed++;
    }
    return { completed, blocked, cancelled };
}

function storyHumanMigrationCreateFlows(ledger, now) {
    const signals = Object.keys((STORY.population && STORY.population.regions) || {})
        .map(storyHumanMigrationRegionSignal).filter(Boolean);
    const origins = signals.filter(signal => signal.populationPeople > STORY_HUMAN_MIGRATION_POLICY.minimumOriginPopulationPeople
        && (signal.refugee || (
            signal.pushBps >= STORY_HUMAN_MIGRATION_POLICY.minimumEconomicPushBps
            && signal.wellbeingBps <= STORY_HUMAN_MIGRATION_POLICY.maximumEconomicOriginWellbeingBps
        )))
        .sort((a, b) => Number(b.refugee) - Number(a.refugee)
            || b.pushBps - a.pushBps
            || a.regionId.localeCompare(b.regionId))
        .slice(0, STORY_HUMAN_MIGRATION_POLICY.maximumOriginsConsidered);
    let created = 0;
    for (const origin of origins) {
        if (created >= STORY_HUMAN_MIGRATION_POLICY.maximumNewFlowsPerTick) break;
        if (ledger.flows.some(flow => flow.originRegionId === origin.regionId
            && ['IN_TRANSIT', 'BLOCKED'].includes(flow.status))) continue;
        const population = typeof storyPopulationRegionView === 'function' ? storyPopulationRegionView(origin.regionId) : null;
        if (!population) continue;
        const reserved = storyHumanMigrationActiveReserved(ledger, origin.regionId);
        const destinations = storyHumanMigrationCandidateDestinations(origin, signals, ledger);
        let selected = null;
        for (const candidate of destinations) {
            const route = storyHumanMigrationRoute(origin, candidate.target);
            if (!route.ok) continue;
            selected = { candidate, route };
            break;
        }
        if (!selected) continue;
        const corridorLimit = Number.isFinite(Number(selected.route.bottleneckCapacity))
            ? Math.floor(Number(selected.route.bottleneckCapacity) * STORY_HUMAN_MIGRATION_POLICY.routeCapacityPeoplePerUnit)
            : STORY_HUMAN_MIGRATION_POLICY.maximumPeoplePerFlow;
        const originShareLimit = Math.max(1, Math.floor(origin.populationPeople
            * STORY_HUMAN_MIGRATION_POLICY.maximumOriginSharePerFlowBps / 10000));
        const pressureLimit = Math.max(1, Math.floor((origin.refugee ? origin.pushBps : Math.max(0, origin.pushBps - 1800)) / 50));
        const people = Math.min(
            STORY_HUMAN_MIGRATION_POLICY.maximumPeoplePerFlow,
            originShareLimit,
            pressureLimit,
            corridorLimit,
            selected.candidate.headroom
        );
        const cohorts = storyHumanMigrationAllocateCohorts(population, people, reserved, origin.refugee);
        const allocatedPeople = cohorts.reduce((sum, row) => sum + row.people, 0);
        if (allocatedPeople <= 0) continue;
        const crossBorder = selected.candidate.target.countryId !== origin.countryId;
        const kind = origin.refugee
            ? 'REFUGEE'
            : (crossBorder ? 'CROSS_BORDER_MIGRATION' : 'INTERNAL_MIGRATION');
        const travelSeconds = Math.max(
            STORY_HUMAN_MIGRATION_POLICY.minimumTravelSeconds,
            Number(selected.route.totalLatencySeconds || 0) * STORY_HUMAN_MIGRATION_POLICY.latencyToTravelSeconds
        );
        const flow = {
            id: `migration:${ledger.nextFlowSequence++}`,
            status: 'IN_TRANSIT',
            kind,
            cause: origin.cause,
            originRegionId: origin.regionId,
            destinationRegionId: selected.candidate.target.regionId,
            originCountryId: origin.countryId,
            destinationCountryId: selected.candidate.target.countryId,
            people: allocatedPeople,
            cohorts,
            departedAt: storyHumanMigrationRound(now),
            arrivalAt: storyHumanMigrationRound(now + travelSeconds),
            completedAt: null,
            cancelledAt: null,
            attempts: 0,
            lastFailureReason: null,
            route: {
                regionIds: selected.route.regionIds.slice(),
                corridorIds: selected.route.corridorIds.slice(),
                totalCost: storyHumanMigrationRound(selected.route.totalCost),
                totalLatencySeconds: storyHumanMigrationRound(selected.route.totalLatencySeconds),
                bottleneckCapacity: storyHumanMigrationRound(selected.route.bottleneckCapacity)
            },
            evidence: {
                originPushBps: origin.pushBps,
                originQualityBps: origin.qualityBps,
                destinationQualityBps: selected.candidate.target.qualityBps,
                qualityGainBps: selected.candidate.rawGain,
                originSecurityBps: origin.securityBps,
                destinationSecurityBps: selected.candidate.target.securityBps,
                originCollectiveStage: origin.collectiveStage,
                sourceNeedsTick: origin.sourceNeedsTick,
                sourceCollectiveTick: origin.sourceCollectiveTick
            }
        };
        ledger.flows.push(flow);
        storyHumanMigrationEvent(ledger, 'MIGRATION_DEPARTED', flow, now, null);
        created++;
    }
    return created;
}

function storyHumanMigrationTick() {
    const ledger = storyHumanMigrationEnsure();
    if (!ledger) return { disabled: true, created: 0, completed: 0 };
    const now = Number(STORY.clock) || 0;
    ledger.tickSequence++;
    ledger.lastTickAt = storyHumanMigrationRound(now);
    const settled = storyHumanMigrationSettleDue(ledger, now);
    const created = storyHumanMigrationCreateFlows(ledger, now);
    storyHumanMigrationTrim(ledger);
    storyHumanMigrationBuildSummaries(ledger);
    return Object.assign({ disabled: false, tickSequence: ledger.tickSequence, created }, settled);
}

function storyHumanMigrationCountryView(countryId) {
    const ledger = storyHumanMigrationEnsure();
    const id = String(countryId).startsWith('country:') ? String(countryId) : `country:${Number(countryId)}`;
    const summary = ledger && ledger.countries[id];
    if (!summary) return null;
    const recentFlows = ledger.flows.filter(flow => flow.originCountryId === id || flow.destinationCountryId === id)
        .slice(-12).map(storyHumanMigrationClone);
    return Object.assign(storyHumanMigrationClone(summary), { recentFlows });
}

function storyHumanMigrationRegionView(regionId) {
    const ledger = storyHumanMigrationEnsure();
    const id = storyHumanMigrationRegionId(regionId);
    const summary = ledger && ledger.regions[id];
    if (!summary) return null;
    const recentFlows = ledger.flows.filter(flow => flow.originRegionId === id || flow.destinationRegionId === id)
        .slice(-8).map(storyHumanMigrationClone);
    return Object.assign(storyHumanMigrationClone(summary), {
        receptionCapacityPeople: Number(ledger.receptionCapacityPeopleByRegion[id]) || 0,
        recentFlows
    });
}

function storyHumanMigrationPublicView(value) {
    if (!value || typeof value !== 'object') return null;
    const publicFlows = (value.recentFlows || []).filter(flow => flow.status === 'COMPLETED'
        && (flow.kind === 'REFUGEE' || flow.people >= STORY_HUMAN_MIGRATION_POLICY.publicEventMinimumPeople))
        .map(flow => ({
            id: flow.id,
            status: flow.status,
            kind: flow.kind,
            cause: flow.cause,
            originRegionId: flow.originRegionId,
            destinationRegionId: flow.destinationRegionId,
            people: flow.people,
            completedAt: flow.completedAt
        }));
    return {
        regionId: value.regionId,
        countryId: value.countryId,
        incomingPeople: value.incomingPeople,
        outgoingPeople: value.outgoingPeople,
        refugeeInPeople: value.refugeeInPeople,
        refugeeOutPeople: value.refugeeOutPeople,
        completedFlowCount: value.completedFlowCount,
        recentFlows: publicFlows
    };
}

function storyHumanMigrationSummary() {
    const ledger = storyHumanMigrationEnsure();
    if (!ledger) return {
        schemaVersion: STORY_HUMAN_MIGRATION_SCHEMA_VERSION,
        adapterVersion: STORY_HUMAN_MIGRATION_ADAPTER_VERSION,
        disabled: true,
        flowCount: 0
    };
    const completed = ledger.flows.filter(flow => flow.status === 'COMPLETED');
    const active = ledger.flows.filter(flow => flow.status === 'IN_TRANSIT' || flow.status === 'BLOCKED');
    return {
        schemaVersion: ledger.schemaVersion,
        adapterVersion: ledger.adapterVersion,
        policyHash: ledger.policyHash,
        disabled: false,
        tickSequence: ledger.tickSequence,
        flowCount: ledger.flows.length,
        activeFlowCount: active.length,
        completedFlowCount: completed.length,
        cancelledFlowCount: ledger.flows.filter(flow => flow.status === 'CANCELLED').length,
        movedPeople: completed.reduce((sum, flow) => sum + flow.people, 0),
        refugeePeople: completed.filter(flow => flow.kind === 'REFUGEE').reduce((sum, flow) => sum + flow.people, 0),
        crossBorderPeople: completed.filter(flow => flow.originCountryId !== flow.destinationCountryId).reduce((sum, flow) => sum + flow.people, 0),
        internalPeople: completed.filter(flow => flow.originCountryId === flow.destinationCountryId).reduce((sum, flow) => sum + flow.people, 0),
        eventCount: ledger.events.length,
        diagnostics: storyHumanMigrationClone(ledger.diagnostics)
    };
}
