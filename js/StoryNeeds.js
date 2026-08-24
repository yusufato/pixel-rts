// ============================================================================
//  İHTİYAÇ, REFAH VE GÜVENLİK — Faz 24
//  --------------------------------------------------------------------------
//  Fiziksel ekonomi sonuçlarını nüfus kohortlarına dağıtır. Bu katman eski
//  state.welfare alanına ikinci kez yazmaz; Faz 25'in şikâyet hafızasına
//  açıklanabilir, kişi-ağırlıklı yaşam koşulu girdisi sağlar.
// ============================================================================

const STORY_NEEDS_SCHEMA_VERSION = 1;
const STORY_NEEDS_ADAPTER_VERSION = 'story-cohort-needs-ledger-1';
const STORY_NEEDS_PRESSURES = Object.freeze(['food', 'energy', 'income', 'employment', 'security', 'publicServices']);
const STORY_NEEDS_POLICY = Object.freeze({
    baseWeights: Object.freeze({ food: 2400, energy: 1500, income: 2200, security: 1800, publicServices: 2100 }),
    incomeByOccupation: Object.freeze({
        DEPENDENT: 4200, STUDENT: 3800, AGRICULTURE: 6200, INDUSTRY: 7000,
        SERVICES: 7200, PUBLIC: 7000, DEFENSE: 6900, UNEMPLOYED: 1800, RETIRED: 4800
    }),
    strikeIncomePenaltyBps: 2800,
    fiscalCurrentBps: 9000,
    fiscalDefaultBps: 2500,
    siegeSecurityBps: 1000,
    warSecurityBps: 5600,
    peaceSecurityBps: 9000
});
const STORY_NEEDS_POLICY_HASH = storyProductionHash({
    schemaVersion: STORY_NEEDS_SCHEMA_VERSION,
    adapterVersion: STORY_NEEDS_ADAPTER_VERSION,
    policy: STORY_NEEDS_POLICY
});

function storyNeedsEnabled() {
    return (typeof storyFeatureEnabled !== 'function' || storyFeatureEnabled('population.needsWelfare'))
        && (typeof storyPopulationEnabled !== 'function' || storyPopulationEnabled())
        && (typeof storyRegionalEnabled !== 'function' || storyRegionalEnabled());
}

function storyNeedsClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyNeedsClampBps(value) {
    return Math.max(0, Math.min(10000, Math.round(Number(value) || 0)));
}

function storyNeedsWeightedAverage(rows, field, weightField) {
    let total = 0;
    let weights = 0;
    for (const row of rows || []) {
        const weight = Math.max(0, Number(row[weightField || 'membersPeople']) || 0);
        total += (Number(row[field]) || 0) * weight;
        weights += weight;
    }
    return weights > 0 ? storyNeedsClampBps(total / weights) : 0;
}

function storyNeedsNormalizeWeights(cohort) {
    const raw = Object.assign({}, STORY_NEEDS_POLICY.baseWeights);
    if (cohort.ageBand === 'CHILD') {
        raw.food += 600; raw.publicServices += 700; raw.income += 250;
    } else if (cohort.ageBand === 'SENIOR') {
        raw.energy += 350; raw.publicServices += 750; raw.income += 250;
    }
    if (cohort.incomeBand === 'LOW') {
        raw.food += 450; raw.energy += 400; raw.income += 650;
    } else if (cohort.incomeBand === 'LOWER_MIDDLE') {
        raw.food += 200; raw.energy += 150; raw.income += 250;
    } else if (cohort.incomeBand === 'UPPER_MIDDLE') {
        raw.food = Math.max(1, raw.food - 300); raw.energy = Math.max(1, raw.energy - 250);
    }
    if (cohort.occupation === 'UNEMPLOYED') {
        raw.income += 1400; raw.publicServices += 400;
    }
    if (cohort.occupation === 'DEFENSE') raw.security += 850;
    if (cohort.identity === 'LOCAL') raw.security += 200;
    const keys = Object.keys(raw);
    const total = keys.reduce((sum, key) => sum + raw[key], 0) || 1;
    const exact = keys.map(key => raw[key] / total * 10000);
    const values = exact.map(Math.floor);
    let remainder = 10000 - values.reduce((sum, value) => sum + value, 0);
    exact.map((value, index) => ({ index, fraction: value - Math.floor(value) }))
        .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
        .slice(0, remainder)
        .forEach(row => { values[row.index]++; });
    return Object.fromEntries(keys.map((key, index) => [key, values[index]]));
}

function storyNeedsAllocationFill(regional, consumerType, resourceId, fallback) {
    const allocations = regional && regional.lastTick && Array.isArray(regional.lastTick.allocations)
        ? regional.lastTick.allocations
        : [];
    const row = allocations.find(item => item.consumerType === consumerType && item.resourceId === resourceId);
    return row ? storyNeedsClampBps(row.fillBps) : storyNeedsClampBps(fallback == null ? 10000 : fallback);
}

function storyNeedsHostileCount(ownerId) {
    const owner = Number(String(ownerId || '').split(':')[1]);
    if (!Number.isInteger(owner) || typeof storyIsHostile !== 'function') return 0;
    let count = 0;
    for (const state of (STORY.states || [])) {
        if (state.id !== owner && storyIsHostile(owner, state.id)) count++;
    }
    return count;
}

function storyNeedsRegionSignals(regionId) {
    const nodeId = Number(String(regionId).split(':')[1]);
    const node = STORY.nodes && STORY.nodes[nodeId];
    const population = typeof storyPopulationRegionView === 'function'
        ? storyPopulationRegionView(regionId)
        : null;
    const regional = STORY.regionalEconomy && STORY.regionalEconomy.regions
        ? STORY.regionalEconomy.regions[regionId]
        : null;
    const foodAccessBps = storyNeedsAllocationFill(regional, 'HOUSEHOLDS', 'food', 10000);
    const energyAccessBps = storyNeedsAllocationFill(regional, 'HOUSEHOLDS', 'energy', 10000);
    const publicEnergyBps = storyNeedsAllocationFill(regional, 'STATE', 'energy', 10000);
    const budget = population && population.countryId && typeof storyBudgetCountryView === 'function'
        ? storyBudgetCountryView(population.countryId)
        : null;
    const fiscalBps = budget && budget.status === 'DEFAULT'
        ? STORY_NEEDS_POLICY.fiscalDefaultBps
        : STORY_NEEDS_POLICY.fiscalCurrentBps;
    const arrearsPenalty = budget ? Math.min(4000, Math.round((Number(budget.missedPaymentDays) || 0) * 40)) : 0;
    const publicServicesBps = storyNeedsClampBps(publicEnergyBps * 0.7 + Math.max(0, fiscalBps - arrearsPenalty) * 0.3);
    const hostileCount = population ? storyNeedsHostileCount(population.countryId) : 0;
    let securityBps = node && node._siege
        ? STORY_NEEDS_POLICY.siegeSecurityBps
        : (hostileCount > 0 ? STORY_NEEDS_POLICY.warSecurityBps : STORY_NEEDS_POLICY.peaceSecurityBps);
    securityBps = storyNeedsClampBps(securityBps + Math.min(700, Math.max(0, Number(node && node.garrison) || 0) * 70));
    const state = node && typeof storyState === 'function' ? storyState(node.owner) : null;
    const collectiveActionsActive = typeof storyCollectiveEnabled === 'function'
        && storyCollectiveEnabled();
    const legacyStrikeActive = !collectiveActionsActive
        && !!(state && state._strikeUntil && state._strikeUntil > (Number(STORY.clock) || 0));
    const strikeProblems = collectiveActionsActive
        && typeof storyCollectiveRegionStrikeProblems === 'function'
        ? storyCollectiveRegionStrikeProblems(regionId)
        : (legacyStrikeActive ? ['LEGACY_GENERAL_STRIKE'] : []);
    const strikeActive = collectiveActionsActive
        && typeof storyCollectiveRegionStrikeActive === 'function'
        ? storyCollectiveRegionStrikeActive(regionId)
        : legacyStrikeActive;
    return {
        foodAccessBps,
        energyAccessBps,
        publicEnergyBps,
        publicServicesBps,
        securityBps,
        hostileCount,
        underSiege: !!(node && node._siege),
        strikeActive,
        strikeProblems,
        fiscalStatus: budget ? budget.status : 'UNAVAILABLE',
        sourceRegionalTick: regional && regional.lastTick ? regional.lastTick.sequence : null,
        sourceBudgetTick: STORY.stateBudget ? STORY.stateBudget.tickSequence : null
    };
}

function storyNeedsCohortOutcome(cohort, signals) {
    let incomeSecurityBps = STORY_NEEDS_POLICY.incomeByOccupation[cohort.occupation] || 4000;
    const laborStrike = (signals.strikeProblems || []).some(
        problem => problem === 'income' || problem === 'employment'
    );
    const publicServiceStrike = (signals.strikeProblems || []).includes('publicServices');
    const legacyGeneralStrike = (signals.strikeProblems || []).includes('LEGACY_GENERAL_STRIKE');
    if (signals.strikeActive && ((laborStrike
        && ['AGRICULTURE', 'INDUSTRY', 'SERVICES', 'PUBLIC'].includes(cohort.occupation))
        || (publicServiceStrike && cohort.occupation === 'PUBLIC')
        || (legacyGeneralStrike && ['AGRICULTURE', 'INDUSTRY', 'SERVICES'].includes(cohort.occupation)))) {
        incomeSecurityBps -= STORY_NEEDS_POLICY.strikeIncomePenaltyBps;
    }
    incomeSecurityBps = storyNeedsClampBps(incomeSecurityBps);
    const unemploymentRiskBps = cohort.occupation === 'UNEMPLOYED' ? 10000 : 0;
    const weights = storyNeedsNormalizeWeights(cohort);
    const access = {
        food: signals.foodAccessBps,
        energy: signals.energyAccessBps,
        income: incomeSecurityBps,
        security: signals.securityBps,
        publicServices: signals.publicServicesBps
    };
    const contributions = {};
    let hardshipBps = 0;
    for (const key of Object.keys(weights)) {
        contributions[key] = Math.round((10000 - access[key]) * weights[key] / 10000);
        hardshipBps += contributions[key];
    }
    hardshipBps = storyNeedsClampBps(hardshipBps);
    const ranked = Object.keys(contributions).sort((a, b) => contributions[b] - contributions[a] || a.localeCompare(b, 'en'));
    return {
        cohortId: cohort.id,
        regionId: cohort.regionId,
        countryId: cohort.countryId,
        membersPeople: cohort.membersPeople,
        foodAccessBps: signals.foodAccessBps,
        energyAccessBps: signals.energyAccessBps,
        incomeSecurityBps,
        unemploymentRiskBps,
        securityBps: signals.securityBps,
        publicServicesBps: signals.publicServicesBps,
        weights,
        hardshipContributionsBps: contributions,
        hardshipBps,
        wellbeingBps: 10000 - hardshipBps,
        primaryPressure: ranked[0] || null,
        incomeMeasurement: 'EMPLOYMENT_SECURITY_PROXY_NO_WAGE'
    };
}

function storyNeedsRegionCreate(regionId) {
    const population = typeof storyPopulationRegionView === 'function'
        ? storyPopulationRegionView(regionId)
        : null;
    if (!population) return null;
    const signals = storyNeedsRegionSignals(regionId);
    const cohorts = population.cohorts.map(cohort => storyNeedsCohortOutcome(cohort, signals));
    return {
        regionId,
        countryId: population.countryId,
        populationPeople: population.populationPeople,
        signals,
        cohorts,
        foodAccessBps: storyNeedsWeightedAverage(cohorts, 'foodAccessBps'),
        energyAccessBps: storyNeedsWeightedAverage(cohorts, 'energyAccessBps'),
        incomeSecurityBps: storyNeedsWeightedAverage(cohorts, 'incomeSecurityBps'),
        unemploymentRiskBps: storyNeedsWeightedAverage(cohorts, 'unemploymentRiskBps'),
        securityBps: storyNeedsWeightedAverage(cohorts, 'securityBps'),
        publicServicesBps: storyNeedsWeightedAverage(cohorts, 'publicServicesBps'),
        wellbeingBps: storyNeedsWeightedAverage(cohorts, 'wellbeingBps')
    };
}

function storyNeedsAggregateCountries(regions) {
    const countries = {};
    for (const state of (STORY.states || [])) countries[`country:${state.id}`] = {
        countryId: `country:${state.id}`, populationPeople: 0, regionCount: 0,
        foodAccessBps: 0, energyAccessBps: 0, incomeSecurityBps: 0,
        unemploymentRiskBps: 0, securityBps: 0, publicServicesBps: 0, wellbeingBps: 0
    };
    const fields = ['foodAccessBps', 'energyAccessBps', 'incomeSecurityBps', 'unemploymentRiskBps', 'securityBps', 'publicServicesBps', 'wellbeingBps'];
    for (const country of Object.values(countries)) {
        const owned = Object.values(regions).filter(region => region.countryId === country.countryId);
        country.populationPeople = owned.reduce((sum, region) => sum + region.populationPeople, 0);
        country.regionCount = owned.length;
        for (const field of fields) country[field] = storyNeedsWeightedAverage(owned, field, 'populationPeople');
    }
    return countries;
}

function storyNeedsLedgerCreate(options) {
    options = options || {};
    const regions = {};
    for (const node of (STORY.nodes || [])) {
        const id = `region:${Number(node.id)}`;
        const region = storyNeedsRegionCreate(id);
        if (region) regions[id] = region;
    }
    return {
        schemaVersion: STORY_NEEDS_SCHEMA_VERSION,
        adapterVersion: STORY_NEEDS_ADAPTER_VERSION,
        policyHash: STORY_NEEDS_POLICY_HASH,
        populationPolicyHash: typeof STORY_POPULATION_POLICY_HASH === 'string' ? STORY_POPULATION_POLICY_HASH : null,
        topologyHash: STORY.regionModel ? STORY.regionModel.topologyHash : null,
        tickSequence: 0,
        lastTickAt: Number(STORY.clock) || 0,
        regions,
        countries: storyNeedsAggregateCountries(regions),
        diagnostics: {
            backfilled: !!options.backfilled,
            restoredFromInvalidLedger: !!options.restoredFromInvalidLedger,
            issues: (options.issues || []).slice(0, 50),
            warnings: (options.warnings || []).map(String).slice(0, 30),
            mutatesLegacyWelfare: false,
            wageModelActive: false,
            incomeMeasurement: 'EMPLOYMENT_SECURITY_PROXY_NO_WAGE'
        }
    };
}

function storyNeedsReconcilePopulationLinks(ledger) {
    const population = typeof storyPopulationEnsure === 'function'
        ? storyPopulationEnsure() : ((typeof STORY !== 'undefined' && STORY.population) || null);
    if (!ledger || !population || !population.regions) return ledger;
    const metricFields = ['foodAccessBps', 'energyAccessBps', 'incomeSecurityBps', 'unemploymentRiskBps', 'securityBps', 'publicServicesBps', 'wellbeingBps'];
    for (const regionId of Object.keys(ledger.regions || {})) {
        const popRegion = population.regions[regionId];
        const reg = ledger.regions[regionId];
        if (!popRegion || !reg) continue;
        reg.countryId = popRegion.countryId;
        reg.populationPeople = popRegion.populationPeople;
        const popCohortMap = new Map((popRegion.cohorts || []).map(c => [c.id, c]));
        for (const cohort of reg.cohorts || []) {
            const popCohort = popCohortMap.get(cohort.cohortId);
            if (popCohort) {
                cohort.regionId = regionId;
                cohort.countryId = popRegion.countryId;
                cohort.membersPeople = popCohort.membersPeople;
            }
        }
        for (const field of metricFields) {
            reg[field] = storyNeedsWeightedAverage(reg.cohorts, field);
        }
    }
    ledger.countries = storyNeedsAggregateCountries(ledger.regions || {});
    return ledger;
}

function storyNeedsValidate(ledger) {
    if (ledger) storyNeedsReconcilePopulationLinks(ledger);
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) return {
        ok: false, issues: [{ code: 'NEEDS_LEDGER_REQUIRED', path: '$', message: 'İhtiyaç defteri zorunlu.' }]
    };
    if (ledger.schemaVersion !== STORY_NEEDS_SCHEMA_VERSION) add('NEEDS_SCHEMA_VERSION', '$.schemaVersion', 'İhtiyaç şeması uyuşmuyor.');
    if (ledger.adapterVersion !== STORY_NEEDS_ADAPTER_VERSION) add('NEEDS_ADAPTER_VERSION', '$.adapterVersion', 'İhtiyaç adaptörü uyuşmuyor.');
    if (ledger.policyHash !== STORY_NEEDS_POLICY_HASH) add('NEEDS_POLICY_HASH', '$.policyHash', 'İhtiyaç politikası uyuşmuyor.');
    if (ledger.populationPolicyHash !== STORY_POPULATION_POLICY_HASH) add('NEEDS_POPULATION_LINK', '$.populationPolicyHash', 'İhtiyaç defteri yanlış nüfus politikasına bağlı.');
    if (ledger.topologyHash !== (STORY.regionModel ? STORY.regionModel.topologyHash : null)) add('NEEDS_TOPOLOGY_HASH', '$.topologyHash', 'İhtiyaç defteri yanlış topolojiye bağlı.');
    const population = typeof storyPopulationEnsure === 'function' ? storyPopulationEnsure() : null;
    const expectedIds = population ? Object.keys(population.regions).sort() : [];
    const actualIds = Object.keys(ledger.regions || {}).sort();
    if (JSON.stringify(expectedIds) !== JSON.stringify(actualIds)) add('NEEDS_REGION_SET', '$.regions', 'İhtiyaç bölgeleri nüfus bölgeleriyle birebir uyuşmalı.');
    const metricFields = ['foodAccessBps', 'energyAccessBps', 'incomeSecurityBps', 'unemploymentRiskBps', 'securityBps', 'publicServicesBps', 'wellbeingBps'];
    for (const regionId of actualIds) {
        const region = ledger.regions[regionId];
        const popRegion = population && population.regions[regionId];
        if (!region || !popRegion) continue;
        if (region.countryId !== popRegion.countryId || region.populationPeople !== popRegion.populationPeople) add('NEEDS_REGION_LINK', `$.regions.${regionId}`, 'İhtiyaç bölgesi güncel nüfus/sahiplikle uyuşmuyor.');
        const expectedCohorts = new Set(popRegion.cohorts.map(row => row.id));
        const populationByCohort = new Map(popRegion.cohorts.map(row => [row.id, row]));
        const actualCohorts = new Set((region.cohorts || []).map(row => row.cohortId));
        if (JSON.stringify([...expectedCohorts].sort()) !== JSON.stringify([...actualCohorts].sort())) add('NEEDS_COHORT_SET', `$.regions.${regionId}.cohorts`, 'İhtiyaç sonuçları bütün kohortları birebir kapsamalı.');
        for (const row of (region.cohorts || [])) {
            if (!expectedCohorts.has(row.cohortId)) add('NEEDS_UNKNOWN_COHORT', `$.regions.${regionId}.cohorts`, 'Bilinmeyen kohort sonucu.');
            const populationCohort = populationByCohort.get(row.cohortId);
            if (populationCohort && (row.regionId !== regionId
                || row.countryId !== popRegion.countryId
                || row.membersPeople !== populationCohort.membersPeople)) {
                add('NEEDS_COHORT_LINK', `$.regions.${regionId}.cohorts.${row.cohortId}`, 'Kohort sonucu güncel bölge, ülke ve kişi sayısına bağlı olmalı.');
            }
            for (const field of metricFields.concat(['hardshipBps'])) {
                if (!Number.isInteger(row[field]) || row[field] < 0 || row[field] > 10000) add('NEEDS_BPS_RANGE', `$.regions.${regionId}.cohorts.${row.cohortId}.${field}`, 'Gösterge 0–10.000 tamsayı baz puan olmalı.');
            }
            if (!STORY_NEEDS_PRESSURES.includes(row.primaryPressure)) add('NEEDS_PRIMARY_PRESSURE', `$.regions.${regionId}.cohorts.${row.cohortId}.primaryPressure`, 'Birincil baskı türü geçersiz.');
            const weightKeys = ['food', 'energy', 'income', 'security', 'publicServices'];
            if (JSON.stringify(Object.keys(row.weights || {}).sort()) !== JSON.stringify(weightKeys.slice().sort())
                || weightKeys.some(key => !Number.isInteger(row.weights[key]) || row.weights[key] < 0)
                || weightKeys.reduce((sum, key) => sum + row.weights[key], 0) !== 10000) {
                add('NEEDS_WEIGHT_TOTAL', `$.regions.${regionId}.cohorts.${row.cohortId}.weights`, 'İhtiyaç ağırlıkları beş kanalda toplam 10.000 baz puan olmalı.');
            }
            const access = {
                food: row.foodAccessBps,
                energy: row.energyAccessBps,
                income: row.incomeSecurityBps,
                security: row.securityBps,
                publicServices: row.publicServicesBps
            };
            const expectedContributions = Object.fromEntries(weightKeys.map(key => [
                key,
                Math.round((10000 - access[key]) * Number(row.weights && row.weights[key] || 0) / 10000)
            ]));
            const expectedHardship = storyNeedsClampBps(Object.values(expectedContributions).reduce((sum, value) => sum + value, 0));
            if (JSON.stringify(expectedContributions) !== JSON.stringify(row.hardshipContributionsBps || {})) {
                add('NEEDS_HARDSHIP_CONTRIBUTIONS', `$.regions.${regionId}.cohorts.${row.cohortId}.hardshipContributionsBps`, 'Güçlük katkıları erişim ve kohort ağırlıklarından yeniden üretilebilmeli.');
            }
            if (row.hardshipBps !== expectedHardship || row.wellbeingBps !== 10000 - expectedHardship) {
                add('NEEDS_HARDSHIP_TOTAL', `$.regions.${regionId}.cohorts.${row.cohortId}`, 'Toplam güçlük ve yaşam koşulu katkı toplamıyla uyuşmalı.');
            }
        }
        for (const field of metricFields) {
            if (!Number.isInteger(region[field]) || region[field] < 0 || region[field] > 10000) {
                add('NEEDS_REGION_BPS', `$.regions.${regionId}.${field}`, 'Bölge göstergesi geçersiz.');
            } else if (region[field] !== storyNeedsWeightedAverage(region.cohorts, field)) {
                add('NEEDS_REGION_AGGREGATE', `$.regions.${regionId}.${field}`, 'Bölge göstergesi kohortların nüfus ağırlıklı ortalaması olmalı.');
            }
        }
    }
    const expectedCountries = storyNeedsAggregateCountries(ledger.regions || {});
    if (JSON.stringify(expectedCountries) !== JSON.stringify(ledger.countries || {})) add('NEEDS_COUNTRY_TOTAL', '$.countries', 'Ülke göstergeleri bölge nüfus ağırlıklarından türemeli.');
    return { ok: issues.length === 0, issues };
}

function storyNeedsReset(options) {
    if (!storyNeedsEnabled()) { STORY.needsWelfare = null; return null; }
    STORY.needsWelfare = storyNeedsLedgerCreate(options);
    return STORY.needsWelfare;
}

function storyNeedsRestore(saved) {
    if (!storyNeedsEnabled()) { STORY.needsWelfare = null; return null; }
    if (!saved) return storyNeedsReset({ backfilled: true, warnings: ['Eski kayıtta kohort yaşam koşulu sonucu yoktu; canlı ekonomi ve nüfustan kuruldu.'] });
    const candidate = storyNeedsClone(saved);
    const validation = storyNeedsValidate(candidate);
    if (!validation.ok) return storyNeedsReset({
        backfilled: true, restoredFromInvalidLedger: true, issues: validation.issues,
        warnings: ['Bozuk ihtiyaç defteri kullanılmadı; canlı ekonomi ve nüfustan güvenli sonuçlar kuruldu.']
    });
    STORY.needsWelfare = candidate;
    return STORY.needsWelfare;
}

function storyNeedsEnsure() {
    if (!storyNeedsEnabled()) return null;
    return STORY.needsWelfare || storyNeedsReset({ backfilled: true });
}

function storyNeedsTick() {
    const ledger = storyNeedsEnsure();
    if (!ledger) return { disabled: true, regionsProcessed: 0 };
    const next = storyNeedsLedgerCreate();
    next.tickSequence = Math.max(0, Number(ledger.tickSequence) || 0) + 1;
    next.lastTickAt = Number(STORY.clock) || 0;
    next.diagnostics = storyNeedsClone(ledger.diagnostics);
    STORY.needsWelfare = next;
    return { disabled: false, tickSequence: next.tickSequence, regionsProcessed: Object.keys(next.regions).length };
}

function storyNeedsForSave() {
    const ledger = storyNeedsEnsure();
    if (!ledger) return null;
    // Geçerli projeksiyonu sırf save alınıyor diye yeniden hesaplama: bölgesel
    // stok tahsisi ihtiyaç tikinden sonra değişmiş olabilir ve bu, davranış
    // zamanı ilerlemeden 295. saniye gözlemini 300. saniye sonucuymuş gibi
    // yeniden yazar. Doğrulayıcı nüfus/kohort/sahiplik bağını zaten tam kontrol
    // eder; yalnız bu bağ gerçekten koptuysa (şehir büyümesi veya tamamlanan göç)
    // salt yapısal uzlaştırma gerekir.
    const currentValidation = storyNeedsValidate(ledger);
    if (currentValidation.ok) {
        ledger.diagnostics.issues = [];
        return storyNeedsClone(ledger);
    }
    // PopulationForSave, son 5 saniyelik ihtiyac tikinden sonra calisan sehir
    // buyumesini kanonik kohortlara uzlastirabilir. Kayitta eski uye sayisini
    // tutmamak icin ihtiyac projeksiyonunu yeni bir davranis tiki saymadan
    // guncel nufustan yeniden kur.
    const reconciled = storyNeedsLedgerCreate();
    reconciled.tickSequence = Math.max(0, Number(ledger.tickSequence) || 0);
    reconciled.lastTickAt = Number(ledger.lastTickAt) || 0;
    reconciled.diagnostics = storyNeedsClone(ledger.diagnostics);
    STORY.needsWelfare = reconciled;
    const validation = storyNeedsValidate(reconciled);
    reconciled.diagnostics.issues = validation.ok ? [] : validation.issues.slice(0, 50);
    if (!validation.ok) throw new Error(`Geçersiz ihtiyaç defteri: ${validation.issues[0].code}`);
    return storyNeedsClone(reconciled);
}

function storyNeedsRegionView(regionId) {
    const ledger = storyNeedsEnsure();
    const id = String(regionId).startsWith('region:') ? String(regionId) : `region:${Number(regionId)}`;
    return ledger && ledger.regions[id] ? storyNeedsClone(ledger.regions[id]) : null;
}

function storyNeedsRegionSummaryView(regionId) {
    const region = storyNeedsRegionView(regionId);
    if (!region) return null;
    delete region.cohorts;
    return region;
}

function storyNeedsCountryView(countryId) {
    const ledger = storyNeedsEnsure();
    const id = String(countryId).startsWith('country:') ? String(countryId) : `country:${Number(countryId)}`;
    return ledger && ledger.countries[id] ? storyNeedsClone(ledger.countries[id]) : null;
}

function storyNeedsCohortView(cohortId) {
    const match = /^cohort:(-?\d+):/.exec(String(cohortId || ''));
    const region = match ? storyNeedsRegionView(`region:${Number(match[1])}`) : null;
    return region ? storyNeedsClone(region.cohorts.find(row => row.cohortId === String(cohortId)) || null) : null;
}

function storyNeedsSummary() {
    const ledger = storyNeedsEnsure();
    if (!ledger) return { schemaVersion: STORY_NEEDS_SCHEMA_VERSION, adapterVersion: STORY_NEEDS_ADAPTER_VERSION, disabled: true, regionCount: 0, cohortOutcomeCount: 0 };
    const countries = Object.values(ledger.countries || {});
    return {
        schemaVersion: ledger.schemaVersion,
        adapterVersion: ledger.adapterVersion,
        policyHash: ledger.policyHash,
        disabled: false,
        tickSequence: ledger.tickSequence,
        regionCount: Object.keys(ledger.regions).length,
        cohortOutcomeCount: Object.values(ledger.regions).reduce((sum, region) => sum + region.cohorts.length, 0),
        averageWellbeingBps: storyNeedsWeightedAverage(countries, 'wellbeingBps', 'populationPeople'),
        averageFoodAccessBps: storyNeedsWeightedAverage(countries, 'foodAccessBps', 'populationPeople'),
        averageEnergyAccessBps: storyNeedsWeightedAverage(countries, 'energyAccessBps', 'populationPeople'),
        averageIncomeSecurityBps: storyNeedsWeightedAverage(countries, 'incomeSecurityBps', 'populationPeople'),
        averageSecurityBps: storyNeedsWeightedAverage(countries, 'securityBps', 'populationPeople'),
        averagePublicServicesBps: storyNeedsWeightedAverage(countries, 'publicServicesBps', 'populationPeople'),
        diagnostics: storyNeedsClone(ledger.diagnostics)
    };
}
