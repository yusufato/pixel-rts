// ============================================================================
//  EKONOMIK AKTOR KARAR DEFTERI — Faz 22
//  --------------------------------------------------------------------------
//  Sirketler ve AI devletleri gercek fiyat, stok, nakit, kredi, fiziksel girdi
//  ve insa suresi sinirlari icinde aday uretir. Bu katman kaynak ya da para
//  yazmaz; yalniz Faz 17-21'in yetkili mutasyon kapilarini cagirir.
// ============================================================================

const STORY_ECONOMIC_AI_SCHEMA_VERSION = 1;
const STORY_ECONOMIC_AI_ADAPTER_VERSION = 'story-economic-ai-ledger-1';
const STORY_ECONOMIC_AI_DECISION_LIMIT = 600;
const STORY_ECONOMIC_AI_ACTIONS = Object.freeze([
    'INVEST_OWN_FUNDS',
    'BORROW_AND_INVEST',
    'PREPARE_INVESTMENT_INPUTS',
    'TARGETED_CAPACITY_GRANT',
    'HOLD'
]);
const STORY_ECONOMIC_AI_POLICY = Object.freeze({
    decisionHistoryLimit: STORY_ECONOMIC_AI_DECISION_LIMIT,
    decisionIntervalDays: 90,
    companyCooldownDays: 150,
    stateCooldownDays: 180,
    minimumInvestmentScore: 4300,
    stateGrantScore: 7600,
    stateGrantMaximum: 90,
    stateCashReserve: 800,
    minimumWorkingCapitalReserve: 80,
    maxCompanyActionsPerCycle: 8,
    maxStateActionsPerCycle: 2,
    maximumCandidatesPerDecision: 6,
    pressureWeightBps: 5500,
    priceWeightBps: 2500,
    shortageWeightBps: 1500,
    marginWeightBps: 500,
    debtPenaltyWeightBps: 800
});
const STORY_ECONOMIC_AI_POLICY_HASH = storyProductionHash({
    schemaVersion: STORY_ECONOMIC_AI_SCHEMA_VERSION,
    adapterVersion: STORY_ECONOMIC_AI_ADAPTER_VERSION,
    actions: STORY_ECONOMIC_AI_ACTIONS,
    companyPolicyHash: typeof STORY_COMPANY_POLICY_HASH === 'string'
        ? STORY_COMPANY_POLICY_HASH
        : null,
    marketPolicyHash: typeof STORY_MARKET_POLICY_HASH === 'string'
        ? STORY_MARKET_POLICY_HASH
        : null,
    budgetPolicyHash: typeof STORY_BUDGET_POLICY_HASH === 'string'
        ? STORY_BUDGET_POLICY_HASH
        : null,
    policy: STORY_ECONOMIC_AI_POLICY
});
let STORY_ECONOMIC_AI_ROUTE_CACHE = { token: null, values: new Map() };

function storyEconomicAIEnabled() {
    return (typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('economy.economicAI'))
        && (typeof storyCompanyEnabled !== 'function' || storyCompanyEnabled())
        && (typeof storyMarketEnabled !== 'function' || storyMarketEnabled())
        && (typeof storyBudgetEnabled !== 'function' || storyBudgetEnabled());
}

function storyEconomicAIBootstrapPlanningEnabled() {
    return typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('economy.bootstrapPlanning');
}

function storyEconomicAIClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyEconomicAIRound(value, digits) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    const factor = 10 ** (digits == null ? 6 : digits);
    return Math.round(number * factor) / factor;
}

function storyEconomicAIClamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
}

function storyEconomicAIWorldDay() {
    const yearSeconds = typeof STORY_CALENDAR !== 'undefined'
        ? Number(STORY_CALENDAR.secondsPerYear) || 120
        : 120;
    return storyEconomicAIRound(Math.max(0, Number(STORY.clock) || 0) * 365 / yearSeconds);
}

function storyEconomicAITotalsBase() {
    return {
        cycles: 0,
        companyDecisions: 0,
        stateDecisions: 0,
        appliedActions: 0,
        rejectedActions: 0,
        holdDecisions: 0,
        projectsStarted: 0,
        loansTaken: 0,
        grantsPaid: 0,
        grantAmount: 0,
        outcomesRealized: 0,
        outcomesFailed: 0,
        preparationsStarted: 0,
        preparationsReady: 0,
        preparedParts: 0,
        preparedElectronics: 0,
        operationalOrdersCreated: 0,
        operationalShipmentsDispatched: 0,
        operationalPartsMoved: 0,
        operationalRawMaterialsMoved: 0
    };
}

function storyEconomicAILedgerCreate(options) {
    options = options || {};
    return {
        schemaVersion: STORY_ECONOMIC_AI_SCHEMA_VERSION,
        adapterVersion: STORY_ECONOMIC_AI_ADAPTER_VERSION,
        policyHash: STORY_ECONOMIC_AI_POLICY_HASH,
        companyPolicyHash: typeof STORY_COMPANY_POLICY_HASH === 'string'
            ? STORY_COMPANY_POLICY_HASH
            : null,
        marketPolicyHash: typeof STORY_MARKET_POLICY_HASH === 'string'
            ? STORY_MARKET_POLICY_HASH
            : null,
        budgetPolicyHash: typeof STORY_BUDGET_POLICY_HASH === 'string'
            ? STORY_BUDGET_POLICY_HASH
            : null,
        tickSequence: 0,
        decisionSequence: 0,
        lastTickAt: 0,
        elapsedDays: 0,
        preparationSequence: 0,
        preparations: [],
        lastActorDecisionDay: {},
        decisions: [],
        totals: storyEconomicAITotalsBase(),
        diagnostics: {
            backfilled: !!options.backfilled,
            restoredFromInvalidLedger: !!options.restoredFromInvalidLedger,
            issues: Array.isArray(options.issues) ? storyEconomicAIClone(options.issues).slice(0, 50) : [],
            warnings: Array.isArray(options.warnings) ? options.warnings.map(String).slice(0, 30) : [],
            usesHiddenForeignState: false,
            mutatesThroughAuthorizedGatesOnly: true,
            playerTreasuryAutonomy: false,
            bootstrapPlanningEnabled: storyEconomicAIBootstrapPlanningEnabled(),
            rejectionCounters: {
                byCode: {},
                bySector: {},
                missingPhysicalInputs: { industrial_parts: 0, electronics: 0 }
            }
        }
    };
}

function storyEconomicAIRecordRejectionDiagnostic(ledger, candidate) {
    if (!ledger || !candidate || !candidate.rejectionCode) return;
    const diagnostics = ledger.diagnostics || (ledger.diagnostics = {});
    const counters = diagnostics.rejectionCounters || (diagnostics.rejectionCounters = {
        byCode: {}, bySector: {}, missingPhysicalInputs: { industrial_parts: 0, electronics: 0 }
    });
    const add = (map, key, amount) => {
        if (!key) return;
        map[key] = Math.max(0, Number(map[key]) || 0) + (amount == null ? 1 : amount);
    };
    add(counters.byCode, candidate.rejectionCode);
    add(counters.bySector, candidate.sectorId || 'unknown');
    if (candidate.rejectionCode === 'PHYSICAL_INPUTS_UNAVAILABLE') {
        const signals = candidate.signals || {};
        if (Number(signals.availableParts) + 1e-6 < Number(signals.requiredParts)) {
            add(counters.missingPhysicalInputs, 'industrial_parts');
        }
        if (Number(signals.availableElectronics) + 1e-6 < Number(signals.requiredElectronics)) {
            add(counters.missingPhysicalInputs, 'electronics');
        }
    }
}

function storyEconomicAIValidate(ledger) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) {
        return {
            ok: false,
            issues: [{ code: 'ECONOMIC_AI_LEDGER_REQUIRED', path: '$', message: 'Ekonomik AI defteri zorunlu.' }]
        };
    }
    if (ledger.schemaVersion !== STORY_ECONOMIC_AI_SCHEMA_VERSION) {
        add('ECONOMIC_AI_SCHEMA_VERSION', '$.schemaVersion', 'Ekonomik AI sema surumu uyusmuyor.');
    }
    if (ledger.adapterVersion !== STORY_ECONOMIC_AI_ADAPTER_VERSION) {
        add('ECONOMIC_AI_ADAPTER_VERSION', '$.adapterVersion', 'Ekonomik AI adapteri uyusmuyor.');
    }
    if (ledger.policyHash !== STORY_ECONOMIC_AI_POLICY_HASH) {
        add('ECONOMIC_AI_POLICY_HASH', '$.policyHash', 'Ekonomik AI politika karmasi uyusmuyor.');
    }
    if (ledger.companyPolicyHash !== (typeof STORY_COMPANY_POLICY_HASH === 'string' ? STORY_COMPANY_POLICY_HASH : null)) {
        add('ECONOMIC_AI_COMPANY_LINK', '$.companyPolicyHash', 'Sirket politika bagi uyusmuyor.');
    }
    if (ledger.marketPolicyHash !== (typeof STORY_MARKET_POLICY_HASH === 'string' ? STORY_MARKET_POLICY_HASH : null)) {
        add('ECONOMIC_AI_MARKET_LINK', '$.marketPolicyHash', 'Piyasa politika bagi uyusmuyor.');
    }
    if (ledger.budgetPolicyHash !== (typeof STORY_BUDGET_POLICY_HASH === 'string' ? STORY_BUDGET_POLICY_HASH : null)) {
        add('ECONOMIC_AI_BUDGET_LINK', '$.budgetPolicyHash', 'Butce politika bagi uyusmuyor.');
    }
    for (const key of ['tickSequence', 'decisionSequence']) {
        if (!Number.isInteger(Number(ledger[key])) || Number(ledger[key]) < 0) {
            add('ECONOMIC_AI_SEQUENCE', `$.${key}`, 'Karar sayaci negatif olmayan tamsayi olmali.');
        }
    }
    if (!Number.isFinite(Number(ledger.elapsedDays)) || Number(ledger.elapsedDays) < 0) {
        add('ECONOMIC_AI_ELAPSED_DAYS', '$.elapsedDays', 'Birikmis gun sonlu ve negatif olmayan deger olmali.');
    }
    if (!Array.isArray(ledger.decisions)) {
        add('ECONOMIC_AI_DECISIONS', '$.decisions', 'Karar listesi zorunlu.');
        return { ok: false, issues };
    }
    if (!Number.isInteger(Number(ledger.preparationSequence || 0))
        || Number(ledger.preparationSequence || 0) < 0
        || !Array.isArray(ledger.preparations || [])) {
        add('ECONOMIC_AI_PREPARATION_LEDGER', '$.preparations', 'Yatırım hazırlık defteri ve sayacı geçerli olmalı.');
    }
    const preparationIds = new Set();
    const activePreparationCompanies = new Set();
    for (let i = 0; i < (ledger.preparations || []).length; i++) {
        const row = ledger.preparations[i];
        const path = `$.preparations[${i}]`;
        if (!row || !row.id || preparationIds.has(row.id)) {
            add('ECONOMIC_AI_PREPARATION_ID', `${path}.id`, 'Hazırlık kimliği eksik veya tekrarlı.');
            continue;
        }
        preparationIds.add(row.id);
        if (!['ACCUMULATING', 'READY', 'CONSUMED', 'CANCELLED'].includes(row.status)) {
            add('ECONOMIC_AI_PREPARATION_STATUS', `${path}.status`, 'Hazırlık durumu geçersiz.');
        }
        if (!row.companyId || !row.countryId || !row.facilityId || !row.regionId || !row.sectorId) {
            add('ECONOMIC_AI_PREPARATION_LINK', path,
                'Hazırlık şirket, ülke, tesis, bölge ve sektöre bağlanmalı.');
        }
        if (['ACCUMULATING', 'READY'].includes(row.status)) {
            if (activePreparationCompanies.has(row.companyId)) {
                add('ECONOMIC_AI_DUPLICATE_ACTIVE_PREPARATION', `${path}.companyId`,
                    'Bir şirket aynı anda yalnız bir fiziksel girdi hazırlığı yürütebilir.');
            }
            activePreparationCompanies.add(row.companyId);
        }
        if (!Array.isArray(row.transactionIds) || !Array.isArray(row.orderIds)
            || !Array.isArray(row.unreachableSourceRegionIds)) {
            add('ECONOMIC_AI_PREPARATION_REFERENCES', path,
                'Hazırlık stok işlemleri ve lojistik siparişleri için kimlik listesi taşımalı.');
        }
        for (const resourceId of ['industrial_parts', 'electronics']) {
            const required = Number(row.required && row.required[resourceId]);
            const reserved = Number(row.reserved && row.reserved[resourceId]);
            if (!Number.isFinite(required) || required < 0 || !Number.isFinite(reserved)
                || reserved < 0 || reserved > required + 1e-6) {
                add('ECONOMIC_AI_PREPARATION_QUANTITY', `${path}.${resourceId}`, 'Hazırlanan fiziksel girdi gereksinimi aşamaz.');
            }
        }
    }
    const ids = new Set();
    for (let i = 0; i < ledger.decisions.length; i++) {
        const decision = ledger.decisions[i];
        const path = `$.decisions[${i}]`;
        if (!decision || typeof decision !== 'object' || !decision.id || ids.has(decision.id)) {
            add('ECONOMIC_AI_DECISION_ID', `${path}.id`, 'Karar kimligi eksik veya tekrarli.');
            continue;
        }
        ids.add(decision.id);
        if (!['COMPANY', 'STATE'].includes(decision.actorType) || !decision.actorId) {
            add('ECONOMIC_AI_ACTOR', path, 'Karar aktoru gecersiz.');
        }
        if (!Array.isArray(decision.candidates) || !decision.candidates.length) {
            add('ECONOMIC_AI_CANDIDATES', `${path}.candidates`, 'Her karar en az bir aday tasimali.');
        }
        for (const candidate of (decision.candidates || [])) {
            if (!STORY_ECONOMIC_AI_ACTIONS.includes(candidate.actionType)
                || !Number.isFinite(Number(candidate.score))) {
                add('ECONOMIC_AI_CANDIDATE', `${path}.candidates`, 'Aday turu veya puani gecersiz.');
            }
        }
        if (!STORY_ECONOMIC_AI_ACTIONS.includes(decision.selectedAction)) {
            add('ECONOMIC_AI_SELECTION', `${path}.selectedAction`, 'Secilen eylem katalog disi.');
        }
        const selectedCandidate = (decision.candidates || [])
            .find(candidate => candidate.id === decision.selectedCandidateId);
        if (!selectedCandidate
            || selectedCandidate.actionType !== decision.selectedAction
            || Number(selectedCandidate.score) !== Number(decision.selectedScore)) {
            add('ECONOMIC_AI_SELECTION_LINK', `${path}.selectedCandidateId`,
                'Secim kimligi, eylemi ve puani kayitli bir adaya baglanmali.');
        }
        if (!decision.execution
            || !['APPLIED', 'REJECTED', 'HELD'].includes(decision.execution.status)) {
            add('ECONOMIC_AI_EXECUTION', `${path}.execution.status`, 'Karar uygulama durumu gecersiz.');
        }
        if (decision.outcome && !['PENDING', 'REALIZED', 'FAILED', 'NOT_APPLICABLE'].includes(decision.outcome.status)) {
            add('ECONOMIC_AI_OUTCOME', `${path}.outcome.status`, 'Karar sonucu gecersiz.');
        }
    }
    const expectedTotals = Object.keys(storyEconomicAITotalsBase());
    for (const key of expectedTotals) {
        if (!Number.isFinite(Number(ledger.totals && ledger.totals[key]))
            || Number(ledger.totals[key]) < 0) {
            add('ECONOMIC_AI_TOTALS', `$.totals.${key}`, 'Karar toplami sonlu ve negatif olmayan sayi olmali.');
        }
    }
    return { ok: issues.length === 0, issues };
}

function storyEconomicAIReset(options) {
    if (!storyEconomicAIEnabled()) {
        STORY.economicAI = null;
        return null;
    }
    STORY.economicAI = storyEconomicAILedgerCreate(options);
    return STORY.economicAI;
}

function storyEconomicAIRestore(saved) {
    if (!storyEconomicAIEnabled()) {
        STORY.economicAI = null;
        return null;
    }
    if (!saved) {
        return storyEconomicAIReset({
            backfilled: true,
            warnings: ['Kayit ekonomik AI kararlari tasimiyordu; karar defteri bos baslatildi.']
        });
    }
    const candidate = storyEconomicAIClone(saved);
    const validation = storyEconomicAIValidate(candidate);
    if (!validation.ok) {
        return storyEconomicAIReset({
            restoredFromInvalidLedger: true,
            issues: validation.issues,
            warnings: ['Gecersiz ekonomik AI defteri kullanilmadi; bos ve guvenli defter kuruldu.']
        });
    }
    STORY.economicAI = candidate;
    return STORY.economicAI;
}

function storyEconomicAIEnsure() {
    if (!storyEconomicAIEnabled()) return null;
    if (!STORY.economicAI) return storyEconomicAIReset({ backfilled: true });
    return STORY.economicAI;
}

function storyEconomicAIForSave() {
    const ledger = storyEconomicAIEnsure();
    if (!ledger) return null;
    const validation = storyEconomicAIValidate(ledger);
    if (!validation.ok) {
        ledger.diagnostics.issues = validation.issues.slice(0, 50);
        ledger.diagnostics.warnings = ['Ekonomik AI karar defteri dogrulama sorunlari tasiyor.'];
    }
    return storyEconomicAIClone(ledger);
}

function storyEconomicAIResourceForSector(sectorId) {
    for (const [resourceId, mappedSector] of Object.entries(STORY_COMPANY_RESOURCE_SECTOR || {})) {
        if (mappedSector === sectorId) return resourceId;
    }
    return null;
}

function storyEconomicAIFinance(company) {
    const ledger = STORY.companyEconomy;
    const bank = ledger && ledger.banks && ledger.banks[company.bankId];
    const cash = Math.max(0, Number(company.accounts && company.accounts['ASSET:CASH']) || 0);
    const debt = Math.max(0, -(Number(company.accounts && company.accounts['LIABILITY:DEBT']) || 0));
    const equity = Math.max(1,
        -(Number(company.accounts && company.accounts['EQUITY:OPENING']) || 0)
        - (Number(company.accounts && company.accounts['EQUITY:RETAINED']) || 0)
    );
    const ceiling = storyEconomicAIRound(
        equity * STORY_COMPANY_POLICY.maximumDebtToEquityBps / 10000
    );
    return {
        cash: storyEconomicAIRound(cash),
        debt: storyEconomicAIRound(debt),
        equity: storyEconomicAIRound(equity),
        debtCeiling: ceiling,
        availableDebt: storyEconomicAIRound(Math.max(0, ceiling - debt)),
        bankId: bank ? bank.id : null,
        bankReserves: storyEconomicAIRound(bank ? Math.max(0, Number(bank.reserves) || 0) : 0),
        debtRatioBps: Math.round(storyEconomicAIClamp(debt / equity * 10000, 0, 50000))
    };
}

function storyEconomicAIDependencySignals(company) {
    const regions = STORY.regionalEconomy && STORY.regionalEconomy.regions
        ? Object.values(STORY.regionalEconomy.regions).filter(region => {
            const nodeId = Number(String(region.regionId || '').split(':')[1]);
            const node = STORY.nodes && STORY.nodes[nodeId];
            return node && `country:${Number(node.owner)}` === company.countryId;
        })
        : [];
    const fill = resourceId => {
        let requested = 0;
        let delivered = 0;
        let produced = 0;
        for (const region of regions) {
            produced += Math.max(0, Number(region.lastTick
                && region.lastTick.producedByResource
                && region.lastTick.producedByResource[resourceId]) || 0);
            const allocations = region.lastTick && Array.isArray(region.lastTick.allocations)
                ? region.lastTick.allocations
                : [];
            for (const row of allocations) {
                if (row.consumerType !== 'HOUSEHOLDS' || row.resourceId !== resourceId) continue;
                requested += Math.max(0, Number(row.requested) || 0);
                delivered += Math.max(0, Number(row.delivered) || 0);
            }
        }
        return {
            accessBps: requested > 0
                ? Math.round(storyEconomicAIClamp(delivered / requested * 10000, 0, 10000))
                : 10000,
            productionCoverageBps: requested > 0
                ? Math.round(storyEconomicAIClamp(produced / requested * 10000, 0, 10000))
                : 10000
        };
    };
    const food = fill('food');
    const energy = fill('energy');
    const foodFillBps = food.accessBps;
    const energyFillBps = energy.accessBps;
    const partsStock = regions.reduce((sum, region) => sum + Math.max(0, Number(region.stocks.industrial_parts) || 0), 0);
    const partsTarget = regions.reduce((sum, region) => sum + Math.max(0, Number(region.safeTargets.industrial_parts) || 0), 0);
    const partsScarcityBps = partsTarget > 0
        ? Math.round(storyEconomicAIClamp((partsTarget - partsStock) / partsTarget * 10000, 0, 10000))
        : 0;
    const foodPressureBps = 10000 - Math.min(foodFillBps, food.productionCoverageBps);
    const energyPressureBps = 10000 - Math.min(energyFillBps, energy.productionCoverageBps);
    let dependencyBonus = 0;
    const traces = [];
    if (company.sectorId === 'civil_industry') {
        dependencyBonus = Math.round(
            Math.max(foodPressureBps, energyPressureBps) * 0.35
            + partsScarcityBps * 0.25
        );
        traces.push('FOOD_OR_ENERGY->INDUSTRIAL_PARTS', 'INDUSTRIAL_PARTS->CIVIL_INDUSTRY');
    } else if (company.sectorId === 'energy') {
        dependencyBonus = Math.round(foodPressureBps * 0.2);
        traces.push('FOOD->ENERGY');
    }
    return {
        foodFillBps,
        energyFillBps,
        foodProductionCoverageBps: food.productionCoverageBps,
        energyProductionCoverageBps: energy.productionCoverageBps,
        partsStock: storyEconomicAIRound(partsStock),
        partsTarget: storyEconomicAIRound(partsTarget),
        partsScarcityBps,
        dependencyBonus: storyEconomicAIBootstrapPlanningEnabled() ? dependencyBonus : 0,
        traces
    };
}

function storyEconomicAICompletedSector(countryId, sectorId) {
    return !!(STORY.companyEconomy && (STORY.companyEconomy.projects || []).some(project => (
        project.status === 'COMPLETED'
        && project.sectorId === sectorId
        && STORY.companyEconomy.companies[project.companyId]
        && STORY.companyEconomy.companies[project.companyId].countryId === countryId
    )));
}

function storyEconomicAIBootstrapStage(countryId, dependency) {
    if (!storyEconomicAIBootstrapPlanningEnabled()
        || Math.max(10000 - dependency.foodProductionCoverageBps, 10000 - dependency.energyFillBps) < 2500) {
        return 'BALANCED';
    }
    if (!storyEconomicAICompletedSector(countryId, 'civil_industry')) return 'CIVIL_INDUSTRY';
    if (!storyEconomicAICompletedSector(countryId, 'energy')) return 'ENERGY';
    if (!storyEconomicAICompletedSector(countryId, 'agriculture')) return 'AGRICULTURE';
    return 'BALANCED';
}

function storyEconomicAIPreparationFor(companyId, facilityId) {
    const ledger = STORY.economicAI;
    return ledger && (ledger.preparations || []).find(row => (
        row.companyId === companyId
        && row.facilityId === facilityId
        && ['ACCUMULATING', 'READY'].includes(row.status)
    ));
}

function storyEconomicAIActivePreparationForCompany(companyId) {
    const ledger = STORY.economicAI;
    return ledger && (ledger.preparations || []).find(row => (
        row.companyId === companyId
        && ['ACCUMULATING', 'READY'].includes(row.status)
    ));
}

function storyEconomicAICountryIdForRegion(regionId) {
    const nodeId = Number(String(regionId || '').split(':')[1]);
    const node = STORY.nodes && STORY.nodes[nodeId];
    return node ? `country:${Number(node.owner)}` : null;
}

function storyEconomicAIProcurementRouteAvailable(sourceRegionId, targetRegionId, countryId, resourceId) {
    if (sourceRegionId === targetRegionId) return true;
    if (typeof storyInfrastructureFindRoute !== 'function') return false;
    const graph = STORY.infrastructureGraph;
    const token = `${Number(graph && graph.damageRevision) || 0}|${graph && graph.networkHash || ''}`;
    if (STORY_ECONOMIC_AI_ROUTE_CACHE.token !== token) {
        STORY_ECONOMIC_AI_ROUTE_CACHE = { token, values: new Map() };
    }
    const authorizedCountryIds = (Array.isArray(countryId) ? countryId : [countryId])
        .map(String).sort((a, b) => a.localeCompare(b));
    const key = `${sourceRegionId}|${targetRegionId}|${authorizedCountryIds.join(',')}|${resourceId}`;
    if (STORY_ECONOMIC_AI_ROUTE_CACHE.values.has(key)) {
        return STORY_ECONOMIC_AI_ROUTE_CACHE.values.get(key);
    }
    const route = storyInfrastructureFindRoute(sourceRegionId, targetRegionId, {
        modes: typeof storyTradeModes === 'function'
            ? storyTradeModes(resourceId)
            : ['LAND', 'SEA'],
        authorizedCountryIds,
        minCapacity: 0
    });
    const available = !!(route && route.ok && (route.corridorIds || []).length);
    STORY_ECONOMIC_AI_ROUTE_CACHE.values.set(key, available);
    return available;
}

let _reachableInputCache = null;
let _reachableInputCacheClock = null;

function storyEconomicAIInvalidateReachableInputCache() {
    _reachableInputCache = null;
    _reachableInputCacheClock = null;
}

function storyEconomicAIReachableInput(company, targetRegionId, resourceId) {
    const countryId = company ? company.countryId : null;
    const clock = Number(STORY.clock) || 0;
    if (_reachableInputCache && _reachableInputCacheClock === clock) {
        const cached = _reachableInputCache.get(`${targetRegionId}|${countryId}|${resourceId}`);
        if (cached) return cached;
    } else {
        _reachableInputCache = new Map();
        _reachableInputCacheClock = clock;
    }
    const regional = STORY.regionalEconomy;
    const target = regional && regional.regions[targetRegionId];
    if (!target) return { quantity: 0, sourceRegionIds: [] };
    const reserveBps = typeof STORY_TRADE_POLICY !== 'undefined'
        ? Number(STORY_TRADE_POLICY.exportReserveBps) || 12500
        : 12500;
    const targetReserve = storyEconomicAIBootstrapPlanningEnabled()
        ? Math.max(0, Number(target.safeTargets[resourceId]) || 0)
        : 0;
    let quantity = Math.max(0, (Number(target.stocks[resourceId]) || 0) - targetReserve);
    const sources = [];
    for (const region of Object.values(regional.regions)) {
        if (region.regionId === targetRegionId
            || storyEconomicAICountryIdForRegion(region.regionId) !== countryId) continue;
        const stock = Math.max(0, Number(region.stocks[resourceId]) || 0);
        const safe = Math.max(0, Number(region.safeTargets[resourceId]) || 0);
        const exportable = storyEconomicAIRound(Math.max(0, stock - safe * reserveBps / 10000));
        if (exportable <= 1e-6
            || !storyEconomicAIProcurementRouteAvailable(
                region.regionId, targetRegionId, countryId, resourceId
            )) continue;
        quantity = storyEconomicAIRound(quantity + exportable);
        sources.push(region.regionId);
    }
    const res = { quantity, sourceRegionIds: sources.sort((a, b) => a.localeCompare(b)) };
    _reachableInputCache.set(`${targetRegionId}|${countryId}|${resourceId}`, res);
    return res;
}

function storyEconomicAIPendingPreparationQuantity(preparation, resourceId) {
    const trade = STORY.tradeLogistics;
    if (!trade) return 0;
    const ids = new Set((preparation.orderIds || []).map(String));
    return storyEconomicAIRound((trade.orders || []).reduce((sum, order) => {
        if (!ids.has(String(order.id)) || order.resourceId !== resourceId
            || order.targetRegionId !== preparation.regionId
            || ['FULFILLED', 'CANCELLED'].includes(order.status)) return sum;
        return sum + Math.max(0,
            Number(order.quantity) - Number(order.deliveredQuantity || 0));
    }, 0));
}

function storyEconomicAIOperationalPending(targetRegionId, resourceId) {
    const trade = STORY.tradeLogistics;
    if (!trade) return 0;
    return storyEconomicAIRound((trade.orders || []).reduce((sum, order) => {
        if (order.source !== 'ECONOMIC_AI_OPERATIONAL_BOOTSTRAP'
            || order.targetRegionId !== targetRegionId
            || order.resourceId !== resourceId
            || ['FULFILLED', 'CANCELLED'].includes(order.status)) return sum;
        return sum + Math.max(0,
            Number(order.quantity) - Number(order.deliveredQuantity || 0));
    }, 0));
}

function storyEconomicAIOperationalBootstrap() {
    const ledger = storyEconomicAIEnsure();
    const regional = STORY.regionalEconomy;
    const companies = STORY.companyEconomy && STORY.companyEconomy.companies;
    if (!ledger || !regional || !companies || !storyEconomicAIBootstrapPlanningEnabled()
        || typeof storyTradeCreateOrder !== 'function'
        || typeof storyTradeDispatchOrder !== 'function') {
        return { ordersCreated: 0, shipmentsDispatched: 0, partsMoved: 0 };
    }
    let ordersCreated = 0;
    let shipmentsDispatched = 0;
    let partsMoved = 0;
    let rawMaterialsMoved = 0;
    const worldDaysPerEconomicTick = (typeof STORY_CALENDAR !== 'undefined'
        ? Number(STORY_CALENDAR.daysPerYear) || 365
        : 365) * 4 / (typeof STORY_CALENDAR !== 'undefined'
        ? Number(STORY_CALENDAR.secondsPerYear) || 120
        : 120);
    const countryIds = [...new Set(Object.values(companies).map(company => company.countryId))]
        .sort((a, b) => a.localeCompare(b));
    for (const countryId of countryIds) {
        const energyCompany = Object.values(companies).find(company => (
            company.countryId === countryId && company.sectorId === 'energy'
        ));
        if (!energyCompany) continue;
        const dependency = storyEconomicAIDependencySignals(energyCompany);
        if (Math.min(dependency.energyFillBps, dependency.energyProductionCoverageBps) >= 7000) continue;
        const hubs = (energyCompany.facilityIds || [])
            .map(id => STORY.companyEconomy.facilities[id])
            .filter(Boolean)
            .map(facility => {
                const region = regional.regions[facility.regionId];
                const capacity = Math.max(0, Number(region && region.sectorCapacity.energy) || 0);
                const extractionCapacity = Math.max(0, Number(region && region.sectorCapacity.extraction) || 0);
                const civilCapacity = Math.max(0, Number(region && region.sectorCapacity.civil_industry) || 0);
                const agricultureCapacity = Math.max(0, Number(region && region.sectorCapacity.agriculture) || 0);
                const required = storyEconomicAIRound(Math.max(
                    2,
                    (capacity * 0.08 + extractionCapacity * 0.1)
                        * worldDaysPerEconomicTick * 8
                ));
                const stock = Math.max(0, Number(region && region.stocks.industrial_parts) || 0);
                const pending = storyEconomicAIOperationalPending(facility.regionId, 'industrial_parts');
                const hubScore = capacity
                    + extractionCapacity * 3
                    + civilCapacity * 2
                    + agricultureCapacity;
                return {
                    facility,
                    region,
                    capacity,
                    extractionCapacity,
                    civilCapacity,
                    agricultureCapacity,
                    hubScore,
                    required,
                    stock,
                    pending
                };
            })
            .filter(row => row.region && row.capacity > 0)
            .sort((a, b) => b.hubScore - a.hubScore
                || b.capacity - a.capacity
                || a.facility.regionId.localeCompare(b.facility.regionId))
            .slice(0, 4);
        const targets = hubs.filter(row => row.stock + row.pending + 1e-6 < row.required);
        let countryOrders = 0;
        for (const target of targets) {
            if (countryOrders >= 4) break;
            let need = storyEconomicAIRound(target.required - target.stock - target.pending);
            const sources = Object.values(regional.regions)
                .filter(region => region.regionId !== target.facility.regionId
                    && storyEconomicAICountryIdForRegion(region.regionId) === countryId
                    && Number(region.stocks.industrial_parts) > 1e-6)
                .map(region => ({
                    region,
                    quantity: Math.max(0, Number(region.stocks.industrial_parts) || 0),
                    energyCapacity: Math.max(0, Number(region.sectorCapacity.energy) || 0)
                }))
                .filter(row => storyEconomicAIProcurementRouteAvailable(
                    row.region.regionId,
                    target.facility.regionId,
                    countryId,
                    'industrial_parts'
                ))
                .sort((a, b) => a.energyCapacity - b.energyCapacity
                    || b.quantity - a.quantity
                    || a.region.regionId.localeCompare(b.region.regionId));
            for (const source of sources) {
                if (need <= 1e-6 || countryOrders >= 4) break;
                const quantity = storyEconomicAIRound(Math.min(need, source.quantity));
                const created = storyTradeCreateOrder({
                    sourceRegionId: source.region.regionId,
                    targetRegionId: target.facility.regionId,
                    resourceId: 'industrial_parts',
                    quantity,
                    priority: 12000,
                    source: 'ECONOMIC_AI_OPERATIONAL_BOOTSTRAP',
                    exportReserveBps: 0
                });
                if (!created.ok) continue;
                ordersCreated++;
                countryOrders++;
                const dispatched = storyTradeDispatchOrder(created.order, quantity);
                if (!dispatched.ok) {
                    created.order.lastFailure = dispatched.code;
                    if (['NO_ROUTE', 'INVALID_ROUTE_ENDPOINT', 'NO_AUTHORIZED_PATH'].includes(dispatched.code)) {
                        created.order.status = 'CANCELLED';
                    }
                    continue;
                }
                shipmentsDispatched++;
                partsMoved = storyEconomicAIRound(partsMoved + dispatched.shipment.quantity);
                need = storyEconomicAIRound(Math.max(0, need - dispatched.shipment.quantity));
            }
        }
        const hub = hubs[0];
        if (hub && hub.civilCapacity > 0) {
            const resourceId = 'raw_materials';
            const targetRegionId = hub.facility.regionId;
            const stock = Math.max(0, Number(hub.region.stocks[resourceId]) || 0);
            const pending = storyEconomicAIOperationalPending(targetRegionId, resourceId);
            const required = storyEconomicAIRound(Math.max(
                5,
                hub.civilCapacity * 1.5 * worldDaysPerEconomicTick * 8
            ));
            let need = storyEconomicAIRound(Math.max(0, required - stock - pending));
            if (need > 1e-6) {
                const rawSources = Object.values(regional.regions)
                    .filter(region => region.regionId !== targetRegionId
                        && Number(region.stocks[resourceId]) > 1e-6)
                    .map(region => {
                        const sourceCountryId = storyEconomicAICountryIdForRegion(region.regionId);
                        const domestic = sourceCountryId === countryId;
                        const reserveBps = domestic ? 0 : STORY_TRADE_POLICY.exportReserveBps;
                        const safe = Math.max(0, Number(region.safeTargets[resourceId]) || 0);
                        const quantity = storyEconomicAIRound(Math.max(
                            0,
                            Number(region.stocks[resourceId]) - safe * reserveBps / 10000
                        ));
                        return { region, sourceCountryId, domestic, reserveBps, quantity };
                    })
                    .filter(row => row.quantity > 1e-6
                        && typeof storyTradeCanContract === 'function'
                        && storyTradeCanContract(row.sourceCountryId, countryId)
                        && storyEconomicAIProcurementRouteAvailable(
                            row.region.regionId,
                            targetRegionId,
                            [row.sourceCountryId, countryId],
                            resourceId
                        ))
                    .sort((a, b) => Number(b.domestic) - Number(a.domestic)
                        || b.quantity - a.quantity
                        || a.region.regionId.localeCompare(b.region.regionId));
                const source = rawSources[0];
                if (source) {
                    const quantity = storyEconomicAIRound(Math.min(need, source.quantity));
                    const created = storyTradeCreateOrder({
                        sourceRegionId: source.region.regionId,
                        targetRegionId,
                        resourceId,
                        quantity,
                        priority: 11500,
                        source: 'ECONOMIC_AI_OPERATIONAL_BOOTSTRAP',
                        exportReserveBps: source.reserveBps
                    });
                    if (created.ok) {
                        ordersCreated++;
                        const dispatched = storyTradeDispatchOrder(created.order, quantity);
                        if (dispatched.ok) {
                            shipmentsDispatched++;
                            rawMaterialsMoved = storyEconomicAIRound(
                                rawMaterialsMoved + dispatched.shipment.quantity
                            );
                        } else {
                            created.order.lastFailure = dispatched.code;
                            if (['NO_ROUTE', 'INVALID_ROUTE_ENDPOINT', 'NO_AUTHORIZED_PATH'].includes(dispatched.code)) {
                                created.order.status = 'CANCELLED';
                            }
                        }
                    }
                }
            }
        }
    }
    ledger.totals.operationalOrdersCreated += ordersCreated;
    ledger.totals.operationalShipmentsDispatched += shipmentsDispatched;
    ledger.totals.operationalPartsMoved = storyEconomicAIRound(
        ledger.totals.operationalPartsMoved + partsMoved
    );
    ledger.totals.operationalRawMaterialsMoved = storyEconomicAIRound(
        ledger.totals.operationalRawMaterialsMoved + rawMaterialsMoved
    );
    return { ordersCreated, shipmentsDispatched, partsMoved, rawMaterialsMoved };
}

function storyEconomicAIProcurePreparedInputs(preparation) {
    if (!preparation || preparation.status !== 'ACCUMULATING'
        || typeof storyTradeCreateOrder !== 'function'
        || typeof storyTradeDispatchOrder !== 'function') {
        return { ordersCreated: 0, shipmentsDispatched: 0, unavailable: true };
    }
    const regional = STORY.regionalEconomy;
    if (!regional) return { ordersCreated: 0, shipmentsDispatched: 0, unavailable: true };
    preparation.orderIds = Array.isArray(preparation.orderIds) ? preparation.orderIds : [];
    preparation.unreachableSourceRegionIds = Array.isArray(preparation.unreachableSourceRegionIds)
        ? preparation.unreachableSourceRegionIds
        : [];
    const unreachableSources = new Set(preparation.unreachableSourceRegionIds.map(String));
    preparation.procurementAttempts = Math.max(0, Number(preparation.procurementAttempts) || 0) + 1;
    let ordersCreated = 0;
    let shipmentsDispatched = 0;
    const failures = [];
    const reserveBps = typeof STORY_TRADE_POLICY !== 'undefined'
        ? Number(STORY_TRADE_POLICY.exportReserveBps) || 12500
        : 12500;
    for (const resourceId of ['industrial_parts', 'electronics']) {
        const required = Math.max(0, Number(preparation.required[resourceId]) || 0);
        const reserved = Math.max(0, Number(preparation.reserved[resourceId]) || 0);
        const pending = storyEconomicAIPendingPreparationQuantity(preparation, resourceId);
        let need = storyEconomicAIRound(Math.max(0, required - reserved - pending));
        if (need <= 1e-6) continue;
        const sources = Object.values(regional.regions)
            .filter(region => region.regionId !== preparation.regionId
                && storyEconomicAICountryIdForRegion(region.regionId) === preparation.countryId
                && !unreachableSources.has(region.regionId))
            .map(region => {
                const stock = Math.max(0, Number(region.stocks[resourceId]) || 0);
                const safe = Math.max(0, Number(region.safeTargets[resourceId]) || 0);
                return {
                    regionId: region.regionId,
                    exportable: storyEconomicAIRound(Math.max(0, stock - safe * reserveBps / 10000))
                };
            })
            .filter(row => row.exportable > 1e-6)
            .sort((a, b) => b.exportable - a.exportable || a.regionId.localeCompare(b.regionId));
        for (const source of sources) {
            if (need <= 1e-6 || ordersCreated >= 4) break;
            const quantity = storyEconomicAIRound(Math.min(need, source.exportable));
            const created = storyTradeCreateOrder({
                sourceRegionId: source.regionId,
                targetRegionId: preparation.regionId,
                resourceId,
                quantity,
                priority: 10000,
                source: 'ECONOMIC_AI_PROJECT_PREPARATION'
            });
            if (!created.ok) {
                failures.push(`${resourceId}:${source.regionId}:${created.code || 'CREATE_FAILED'}`);
                continue;
            }
            preparation.orderIds.push(created.order.id);
            ordersCreated++;
            const dispatched = storyTradeDispatchOrder(created.order, quantity);
            if (dispatched.ok) {
                shipmentsDispatched++;
                need = storyEconomicAIRound(Math.max(0, need - dispatched.shipment.quantity));
            } else {
                created.order.lastFailure = dispatched.code;
                if (['NO_ROUTE', 'INVALID_ROUTE_ENDPOINT', 'NO_AUTHORIZED_PATH'].includes(dispatched.code)) {
                    created.order.status = 'CANCELLED';
                    if (!unreachableSources.has(source.regionId)) {
                        unreachableSources.add(source.regionId);
                        preparation.unreachableSourceRegionIds.push(source.regionId);
                    }
                }
                failures.push(`${resourceId}:${source.regionId}:${dispatched.code || 'DISPATCH_FAILED'}`);
                // An OPEN order is a real pending claim. Do not create a
                // duplicate claim for the same need during this pass.
                if (created.order.status !== 'CANCELLED') need = 0;
            }
        }
    }
    preparation.updatedAt = storyEconomicAIRound(STORY.clock);
    preparation.lastProcurement = {
        at: preparation.updatedAt,
        ordersCreated,
        shipmentsDispatched,
        failures: failures.slice(0, 12)
    };
    return { ordersCreated, shipmentsDispatched, failures };
}

function storyEconomicAIStartPreparation(candidate) {
    const ledger = storyEconomicAIEnsure();
    if (!ledger || !candidate || candidate.actionType !== 'PREPARE_INVESTMENT_INPUTS') {
        return { status: 'REJECTED', code: 'PREPARATION_CANDIDATE_REQUIRED' };
    }
    const existing = storyEconomicAIActivePreparationForCompany(candidate.companyId);
    if (existing) return { status: 'REJECTED', code: 'PREPARATION_ALREADY_ACTIVE', preparationId: existing.id };
    ledger.preparationSequence = Math.max(0, Number(ledger.preparationSequence) || 0) + 1;
    const preparation = {
        id: `economic-preparation:${ledger.preparationSequence}`,
        companyId: candidate.companyId,
        countryId: candidate.countryId,
        facilityId: candidate.facilityId,
        regionId: candidate.regionId,
        sectorId: candidate.sectorId,
        status: 'ACCUMULATING',
        createdAt: storyEconomicAIRound(STORY.clock),
        updatedAt: storyEconomicAIRound(STORY.clock),
        readyAt: null,
        consumedAt: null,
        required: {
            industrial_parts: Math.max(0, Number(candidate.signals.requiredParts) || 0),
            electronics: Math.max(0, Number(candidate.signals.requiredElectronics) || 0)
        },
        reserved: { industrial_parts: 0, electronics: 0 },
        dependencyStage: candidate.signals.bootstrapStage,
        transactionIds: [],
        orderIds: [],
        unreachableSourceRegionIds: [],
        procurementAttempts: 0,
        lastProcurement: null
    };
    ledger.preparations.push(preparation);
    ledger.totals.preparationsStarted++;
    // The decision happens after the ordinary regional/trade tick. Capture any
    // stock physically present at the target first, then procure the remainder
    // through Faz 18 orders and delayed shipments.
    storyEconomicAIReservePreparedInputs(preparation.regionId);
    storyEconomicAIProcurePreparedInputs(preparation);
    return {
        status: 'APPLIED',
        code: 'PREPARATION_STARTED',
        preparationId: preparation.id,
        preparation: storyEconomicAIClone(preparation)
    };
}

function storyEconomicAIReservePreparedInputs(regionId) {
    const ledger = storyEconomicAIEnsure();
    if (!ledger || !storyEconomicAIBootstrapPlanningEnabled()) return { reserved: 0, ready: 0 };
    const id = String(regionId).startsWith('region:') ? String(regionId) : `region:${Number(regionId)}`;
    const region = STORY.regionalEconomy && STORY.regionalEconomy.regions[id];
    if (!region) return { reserved: 0, ready: 0 };
    let reservedTotal = 0;
    let ready = 0;
    const preparations = (ledger.preparations || []).filter(row => (
        row.regionId === id && row.status === 'ACCUMULATING'
    )).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    for (const preparation of preparations) {
        for (const resourceId of ['industrial_parts', 'electronics']) {
            const remaining = Math.max(0,
                Number(preparation.required[resourceId]) - Number(preparation.reserved[resourceId]));
            if (remaining <= 1e-9) continue;
            // Investment may only escrow stock above the local operating
            // reserve. Otherwise a nominal capacity project can cannibalize
            // the maintenance parts of the power/industrial base it needs.
            const operatingReserve = Math.max(0, Number(region.safeTargets[resourceId]) || 0);
            const available = Math.max(
                0,
                (Number(region.stocks[resourceId]) || 0) - operatingReserve
            );
            const quantity = storyEconomicAIRound(Math.min(remaining, available));
            if (quantity <= 1e-9) continue;
            const commerceEscrowId = `escrow:${preparation.id}`;
            const commerceMove = typeof storyCommerceEnabled === 'function' && storyCommerceEnabled()
                && typeof storyCommerceMoveInventory === 'function'
                ? storyCommerceMoveInventory(
                    id,
                    commerceEscrowId,
                    resourceId,
                    quantity,
                    'INVESTMENT_INPUT_PREPARATION',
                    preparation.id
                )
                : null;
            if (commerceMove && !commerceMove.ok) continue;
            const debit = storyRegionalStockDelta(id, resourceId, -quantity, {
                type: 'INVESTMENT_INPUT_PREPARATION', source: preparation.id
            });
            if (!debit.ok) {
                if (commerceMove && commerceMove.ok) {
                    storyCommerceMoveInventory(
                        commerceEscrowId,
                        id,
                        resourceId,
                        quantity,
                        'INVESTMENT_INPUT_PREPARATION_ROLLBACK',
                        preparation.id
                    );
                }
                continue;
            }
            storyRegionalAddToMap(STORY.regionalEconomy.totals.consumed, resourceId, quantity);
            preparation.reserved[resourceId] = storyEconomicAIRound(
                Number(preparation.reserved[resourceId]) + quantity
            );
            preparation.transactionIds.push(debit.transaction.id);
            preparation.updatedAt = storyEconomicAIRound(STORY.clock);
            reservedTotal = storyEconomicAIRound(reservedTotal + quantity);
            if (resourceId === 'industrial_parts') ledger.totals.preparedParts = storyEconomicAIRound(ledger.totals.preparedParts + quantity);
            if (resourceId === 'electronics') ledger.totals.preparedElectronics = storyEconomicAIRound(ledger.totals.preparedElectronics + quantity);
        }
        const complete = ['industrial_parts', 'electronics'].every(resourceId => (
            Number(preparation.reserved[resourceId]) + 1e-6 >= Number(preparation.required[resourceId])
        ));
        if (complete) {
            preparation.status = 'READY';
            preparation.readyAt = storyEconomicAIRound(STORY.clock);
            preparation.updatedAt = preparation.readyAt;
            ledger.totals.preparationsReady++;
            ready++;
        }
    }
    return { reserved: reservedTotal, ready };
}

function storyEconomicAIStartPreparedInvestment(candidate, preparation) {
    const regionId = candidate.regionId;
    const released = [];
    for (const resourceId of ['industrial_parts', 'electronics']) {
        const quantity = Math.max(0, Number(preparation.reserved[resourceId]) || 0);
        if (quantity <= 0) continue;
        const credit = storyRegionalStockDelta(regionId, resourceId, quantity, {
            type: 'INVESTMENT_PREPARATION_RELEASE', source: preparation.id
        });
        if (!credit.ok) {
            for (const row of released) {
                storyRegionalStockDelta(regionId, row.resourceId, -row.quantity, {
                    type: 'INVESTMENT_PREPARATION_RELEASE_ROLLBACK', source: preparation.id
                });
                if (typeof storyCommerceEnabled === 'function' && storyCommerceEnabled()
                    && typeof storyCommerceMoveInventory === 'function') {
                    storyCommerceMoveInventory(
                        regionId,
                        `escrow:${preparation.id}`,
                        row.resourceId,
                        row.quantity,
                        'INVESTMENT_PREPARATION_RELEASE_ROLLBACK',
                        preparation.id
                    );
                }
            }
            return { ok: false, code: credit.code || 'PREPARATION_RELEASE_FAILED' };
        }
        if (typeof storyCommerceEnabled === 'function' && storyCommerceEnabled()
            && typeof storyCommerceMoveInventory === 'function') {
            const commerceRelease = storyCommerceMoveInventory(
                `escrow:${preparation.id}`,
                regionId,
                resourceId,
                quantity,
                'INVESTMENT_PREPARATION_RELEASE',
                preparation.id
            );
            if (!commerceRelease.ok) {
                storyRegionalStockDelta(regionId, resourceId, -quantity, {
                    type: 'INVESTMENT_PREPARATION_RELEASE_ROLLBACK', source: preparation.id
                });
                for (const row of released) {
                    storyRegionalStockDelta(regionId, row.resourceId, -row.quantity, {
                        type: 'INVESTMENT_PREPARATION_RELEASE_ROLLBACK', source: preparation.id
                    });
                    storyCommerceMoveInventory(
                        regionId,
                        `escrow:${preparation.id}`,
                        row.resourceId,
                        row.quantity,
                        'INVESTMENT_PREPARATION_RELEASE_ROLLBACK',
                        preparation.id
                    );
                }
                return { ok: false, code: commerceRelease.code || 'COMMERCE_PREPARATION_RELEASE_FAILED' };
            }
        }
        released.push({ resourceId, quantity });
    }
    const investment = storyCompanyStartInvestment(
        candidate.companyId,
        regionId,
        { cashCost: candidate.signals.requiredCash }
    );
    if (!investment.ok) {
        for (const row of released) {
            storyRegionalStockDelta(regionId, row.resourceId, -row.quantity, {
                type: 'INVESTMENT_PREPARATION_RESTORE', source: preparation.id
            });
            if (typeof storyCommerceEnabled === 'function' && storyCommerceEnabled()
                && typeof storyCommerceMoveInventory === 'function') {
                storyCommerceMoveInventory(
                    regionId,
                    `escrow:${preparation.id}`,
                    row.resourceId,
                    row.quantity,
                    'INVESTMENT_PREPARATION_RESTORE',
                    preparation.id
                );
            }
        }
        return investment;
    }
    preparation.status = 'CONSUMED';
    preparation.consumedAt = storyEconomicAIRound(STORY.clock);
    preparation.updatedAt = preparation.consumedAt;
    return investment;
}

function storyEconomicAICandidateForFacility(company, facility) {
    const resourceId = storyEconomicAIResourceForSector(company.sectorId);
    const region = STORY.regionalEconomy && STORY.regionalEconomy.regions[facility.regionId];
    const market = STORY.marketPrices && STORY.marketPrices.regions
        && STORY.marketPrices.regions[facility.regionId];
    const price = market && market.resources && market.resources[resourceId];
    const stock = region ? Math.max(0, Number(region.stocks[resourceId]) || 0) : 0;
    const safeTarget = region ? Math.max(0.000001, Number(region.safeTargets[resourceId]) || 0.000001) : 1;
    const pressureBps = Math.round(storyEconomicAIClamp(
        (safeTarget - stock) / safeTarget * 10000,
        0,
        10000
    ));
    const fillBps = price && price.signals
        ? storyEconomicAIClamp(price.signals.fillBps, 0, 10000)
        : 10000;
    const shortageBps = Math.round(10000 - fillBps);
    const priceIndex = price && Number.isFinite(Number(price.priceIndex))
        ? Number(price.priceIndex)
        : 100;
    const pricePremiumBps = Math.round(storyEconomicAIClamp(
        (priceIndex / 100 - 1) * 10000,
        0,
        20000
    ));
    const lastResult = company.lastResult;
    const marginBps = lastResult && Number(lastResult.revenue) > 0
        ? Math.round(storyEconomicAIClamp(
            Number(lastResult.profit) / Number(lastResult.revenue) * 10000,
            -10000,
            10000
        ))
        : Math.round(storyEconomicAIClamp(pricePremiumBps * 0.35, -10000, 7000));
    const finance = storyEconomicAIFinance(company);
    const debtPenalty = Math.round(
        storyEconomicAIClamp(finance.debtRatioBps, 0, 25000)
        * STORY_ECONOMIC_AI_POLICY.debtPenaltyWeightBps / 10000
    );
    const dependency = storyEconomicAIDependencySignals(company);
    const baseScore = Math.round(storyEconomicAIClamp(
        pressureBps * STORY_ECONOMIC_AI_POLICY.pressureWeightBps / 10000
        + Math.min(10000, pricePremiumBps) * STORY_ECONOMIC_AI_POLICY.priceWeightBps / 10000
        + shortageBps * STORY_ECONOMIC_AI_POLICY.shortageWeightBps / 10000
        + Math.max(-10000, marginBps) * STORY_ECONOMIC_AI_POLICY.marginWeightBps / 10000
        - debtPenalty,
        -10000,
        10000
    ));
    const score = Math.round(storyEconomicAIClamp(
        baseScore + dependency.dependencyBonus,
        -10000,
        10000
    ));
    const requiredCash = STORY_COMPANY_POLICY.investmentCashCost;
    const requiredLiquidity = requiredCash
        + STORY_ECONOMIC_AI_POLICY.minimumWorkingCapitalReserve;
    const requiredParts = STORY_COMPANY_POLICY.investmentParts;
    const requiredElectronics = company.sectorId === 'advanced_tech'
        ? STORY_COMPANY_POLICY.investmentElectronics
        : 0;
    const availableParts = region ? Math.max(
        0,
        (Number(region.stocks.industrial_parts) || 0)
            - (storyEconomicAIBootstrapPlanningEnabled()
                ? Math.max(0, Number(region.safeTargets.industrial_parts) || 0)
                : 0)
    ) : 0;
    const availableElectronics = region ? Math.max(
        0,
        (Number(region.stocks.electronics) || 0)
            - (storyEconomicAIBootstrapPlanningEnabled()
                ? Math.max(0, Number(region.safeTargets.electronics) || 0)
                : 0)
    ) : 0;
    const reachableParts = availableParts >= requiredParts
        ? { quantity: availableParts, sourceRegionIds: [facility.regionId] }
        : storyEconomicAIReachableInput(company, facility.regionId, 'industrial_parts');
    const reachableElectronics = requiredElectronics <= 0 || availableElectronics >= requiredElectronics
        ? { quantity: availableElectronics, sourceRegionIds: [facility.regionId] }
        : storyEconomicAIReachableInput(company, facility.regionId, 'electronics');
    const inputCoverageBps = Math.round(Math.min(
        requiredParts > 0
            ? storyEconomicAIClamp(reachableParts.quantity / requiredParts * 10000, 0, 10000)
            : 10000,
        requiredElectronics > 0
            ? storyEconomicAIClamp(reachableElectronics.quantity / requiredElectronics * 10000, 0, 10000)
            : 10000
    ));
    const cashShortfall = storyEconomicAIRound(Math.max(0, requiredLiquidity - finance.cash));
    const bootstrapStage = storyEconomicAIBootstrapStage(company.countryId, dependency);
    const bootstrapSector = {
        CIVIL_INDUSTRY: 'civil_industry',
        ENERGY: 'energy',
        AGRICULTURE: 'agriculture'
    }[bootstrapStage] || null;
    const activePreparation = storyEconomicAIActivePreparationForCompany(company.id);
    const preparation = activePreparation && activePreparation.facilityId === facility.id
        ? activePreparation
        : null;
    const hasActiveProject = (STORY.companyEconomy.projects || []).some(project => (
        project.companyId === company.id && project.status === 'BUILDING'
    ));
    let eligibility = 'ELIGIBLE';
    let rejectionCode = null;
    if (company.status !== 'OPERATING' || company.licenseStatus !== 'LICENSED') {
        eligibility = 'REJECTED';
        rejectionCode = 'COMPANY_NOT_OPERATING';
    } else if (facility.status && facility.status !== 'OPERATING') {
        eligibility = 'REJECTED';
        rejectionCode = 'FACILITY_NOT_OPERATING';
    } else if (hasActiveProject) {
        eligibility = 'REJECTED';
        rejectionCode = 'COMPANY_PROJECT_ACTIVE';
    } else if (bootstrapSector && company.sectorId !== bootstrapSector) {
        eligibility = 'REJECTED';
        rejectionCode = 'UPSTREAM_DEPENDENCY_REQUIRED';
    } else if (activePreparation && !preparation) {
        eligibility = 'REJECTED';
        rejectionCode = 'INPUT_PREPARATION_ACTIVE';
    } else if (score < STORY_ECONOMIC_AI_POLICY.minimumInvestmentScore
        && !(bootstrapSector === company.sectorId && score >= 3000)) {
        eligibility = 'REJECTED';
        rejectionCode = 'BENEFIT_BELOW_THRESHOLD';
    } else if (availableParts + 1e-6 < requiredParts
        || availableElectronics + 1e-6 < requiredElectronics) {
        if (preparation && preparation.status === 'READY') {
            eligibility = 'ELIGIBLE';
            rejectionCode = null;
        } else if (preparation) {
            eligibility = 'REJECTED';
            rejectionCode = 'INPUT_PREPARATION_ACTIVE';
        } else if (bootstrapSector === company.sectorId) {
            if (reachableParts.quantity + 1e-6 < requiredParts
                || reachableElectronics.quantity + 1e-6 < requiredElectronics) {
                eligibility = 'REJECTED';
                rejectionCode = 'PROCUREMENT_ROUTE_UNAVAILABLE';
            } else {
                eligibility = 'ELIGIBLE';
                rejectionCode = null;
            }
        } else {
            eligibility = 'REJECTED';
            rejectionCode = 'PHYSICAL_INPUTS_UNAVAILABLE';
        }
    } else if (cashShortfall > 0
        && (finance.availableDebt + 1e-6 < cashShortfall
            || finance.bankReserves + 1e-6 < cashShortfall)) {
        eligibility = 'REJECTED';
        rejectionCode = 'FINANCE_UNAVAILABLE';
    }
    let actionType = cashShortfall <= 0
        ? 'INVEST_OWN_FUNDS'
        : 'BORROW_AND_INVEST';
    if (eligibility === 'ELIGIBLE'
        && bootstrapSector === company.sectorId
        && !activePreparation
        && (availableParts + 1e-6 < requiredParts
            || availableElectronics + 1e-6 < requiredElectronics)) {
        actionType = 'PREPARE_INVESTMENT_INPUTS';
    }
    return {
        id: `candidate:${company.id}:${facility.id}`,
        actionType,
        actorId: company.id,
        countryId: company.countryId,
        companyId: company.id,
        facilityId: facility.id,
        regionId: facility.regionId,
        sectorId: company.sectorId,
        resourceId,
        score,
        eligibility,
        rejectionCode,
        signals: {
            stock: storyEconomicAIRound(stock),
            safeTarget: storyEconomicAIRound(safeTarget),
            pressureBps,
            fillBps: Math.round(fillBps),
            shortageBps,
            priceIndex: storyEconomicAIRound(priceIndex),
            pricePremiumBps,
            marginBps,
            baseScore,
            dependencyBonus: dependency.dependencyBonus,
            dependencyFoodFillBps: dependency.foodFillBps,
            dependencyEnergyFillBps: dependency.energyFillBps,
            dependencyFoodProductionCoverageBps: dependency.foodProductionCoverageBps,
            dependencyEnergyProductionCoverageBps: dependency.energyProductionCoverageBps,
            nationalPartsStock: dependency.partsStock,
            nationalPartsTarget: dependency.partsTarget,
            nationalPartsScarcityBps: dependency.partsScarcityBps,
            bootstrapStage,
            preparationId: activePreparation ? activePreparation.id : null,
            preparationStatus: activePreparation ? activePreparation.status : null,
            preparationFacilityId: activePreparation ? activePreparation.facilityId : null,
            preparedParts: activePreparation ? activePreparation.reserved.industrial_parts : 0,
            preparedElectronics: activePreparation ? activePreparation.reserved.electronics : 0,
            cash: finance.cash,
            debt: finance.debt,
            debtCeiling: finance.debtCeiling,
            bankReserves: finance.bankReserves,
            requiredCash,
            requiredLiquidity,
            workingCapitalReserve: STORY_ECONOMIC_AI_POLICY.minimumWorkingCapitalReserve,
            cashShortfall,
            requiredParts,
            availableParts: storyEconomicAIRound(availableParts),
            reachableParts: storyEconomicAIRound(reachableParts.quantity),
            reachablePartSourceRegionIds: reachableParts.sourceRegionIds,
            requiredElectronics,
            availableElectronics: storyEconomicAIRound(availableElectronics),
            reachableElectronics: Number.isFinite(reachableElectronics.quantity)
                ? storyEconomicAIRound(reachableElectronics.quantity)
                : requiredElectronics,
            reachableElectronicSourceRegionIds: reachableElectronics.sourceRegionIds,
            inputCoverageBps
        },
        reasons: [
            `PRESSURE_BPS:${pressureBps}`,
            `PRICE_INDEX:${storyEconomicAIRound(priceIndex)}`,
            `FILL_BPS:${Math.round(fillBps)}`,
            `MARGIN_BPS:${marginBps}`,
            `DEPENDENCY_BONUS:${dependency.dependencyBonus}`,
            ...dependency.traces,
            rejectionCode || 'ALL_GATES_PASSED'
        ]
    };
}

let _storyEconomicAICandidateCache = null;
let _storyEconomicAICandidateCacheClock = null;

function storyEconomicAIInvalidateCandidateCache() {
    _storyEconomicAICandidateCache = null;
    _storyEconomicAICandidateCacheClock = null;
}

function storyEconomicAICompanyCandidates(companyId) {
    const ledger = storyEconomicAIEnsure();
    const company = STORY.companyEconomy && STORY.companyEconomy.companies[companyId];
    if (!ledger || !company) return [];
    const clock = Number(STORY.clock) || 0;
    if (_storyEconomicAICandidateCache && _storyEconomicAICandidateCacheClock === clock) {
        const cached = _storyEconomicAICandidateCache.get(companyId);
        if (cached) return cached;
    } else {
        _storyEconomicAICandidateCache = new Map();
        _storyEconomicAICandidateCacheClock = clock;
    }
    const facilities = (company.facilityIds || [])
        .map(id => STORY.companyEconomy.facilities[id])
        .filter(Boolean);
    const candidates = facilities
        .map(facility => storyEconomicAICandidateForFacility(company, facility))
        .sort((a, b) => b.score - a.score
            || b.signals.inputCoverageBps - a.signals.inputCoverageBps
            || a.regionId.localeCompare(b.regionId)
            || a.facilityId.localeCompare(b.facilityId));
    _storyEconomicAICandidateCache.set(companyId, candidates);
    return candidates;
}

function storyEconomicAIHoldCandidate(actorId, countryId, code, score) {
    return {
        id: `candidate:${actorId}:hold`,
        actionType: 'HOLD',
        actorId,
        countryId,
        score: Number.isFinite(Number(score)) ? Number(score) : 0,
        eligibility: 'ELIGIBLE',
        rejectionCode: null,
        signals: {},
        reasons: [String(code || 'NO_VALID_ACTION')]
    };
}

function storyEconomicAIRecordDecision(ledger, payload) {
    storyEconomicAIInvalidateCandidateCache();
    ledger.decisionSequence++;
    const decision = Object.assign({
        id: `economic-decision:${ledger.decisionSequence}`,
        sequence: ledger.decisionSequence,
        tickSequence: ledger.tickSequence,
        at: storyEconomicAIRound(STORY.clock),
        worldDay: storyEconomicAIWorldDay()
    }, storyEconomicAIClone(payload));
    ledger.decisions.push(decision);
    while (ledger.decisions.length > STORY_ECONOMIC_AI_DECISION_LIMIT) {
        const removable = ledger.decisions.findIndex(row => row.execution.status === 'HELD');
        ledger.decisions.splice(removable >= 0 ? removable : 0, 1);
    }
    return decision;
}

function storyEconomicAIVisibleCandidates(candidates, selected, limit) {
    const maximum = Math.max(1, Number(limit) || STORY_ECONOMIC_AI_POLICY.maximumCandidatesPerDecision);
    const visible = (candidates || []).slice(0, maximum);
    if (selected && !visible.some(candidate => candidate.id === selected.id)) {
        if (visible.length >= maximum) visible[visible.length - 1] = selected;
        else visible.push(selected);
    }
    return visible;
}

function storyEconomicAICompactLoan(result, companyId) {
    if (!result) return null;
    return {
        ok: !!result.ok,
        code: result.code || null,
        amount: storyEconomicAIRound(result.amount),
        ceiling: storyEconomicAIRound(result.ceiling),
        companyId,
        bankId: result.bank && result.bank.id || null
    };
}

function storyEconomicAICompactInvestment(result) {
    if (!result) return null;
    const project = result.project;
    return {
        ok: !!result.ok,
        code: result.code || null,
        project: project ? {
            id: project.id,
            companyId: project.companyId,
            facilityId: project.facilityId,
            regionId: project.regionId,
            sectorId: project.sectorId,
            status: project.status,
            startedAt: project.startedAt,
            remainingDays: project.remainingDays,
            cashCost: project.cashCost,
            physicalInputs: storyEconomicAIClone(project.physicalInputs),
            capacityIncrease: project.capacityIncrease
        } : null
    };
}

function storyEconomicAIExecuteCompanyCandidate(candidate) {
    if (!candidate || candidate.eligibility !== 'ELIGIBLE') {
        return { status: 'REJECTED', code: candidate && candidate.rejectionCode || 'CANDIDATE_NOT_ELIGIBLE' };
    }
    if (candidate.actionType === 'PREPARE_INVESTMENT_INPUTS') {
        return storyEconomicAIStartPreparation(candidate);
    }
    let loan = null;
    if (candidate.actionType === 'BORROW_AND_INVEST') {
        loan = storyCompanyRequestLoan(candidate.companyId, candidate.signals.cashShortfall, {
            correlationId: candidate.id
        });
        if (!loan.ok) {
            return {
                status: 'REJECTED',
                code: loan.code,
                loan: storyEconomicAICompactLoan(loan, candidate.companyId)
            };
        }
    }
    const preparation = candidate.signals.preparationId
        ? storyEconomicAIPreparationFor(candidate.companyId, candidate.facilityId)
        : null;
    const investment = preparation && preparation.status === 'READY'
        ? storyEconomicAIStartPreparedInvestment(candidate, preparation)
        : storyCompanyStartInvestment(
            candidate.companyId,
            candidate.regionId,
            { cashCost: candidate.signals.requiredCash }
        );
    if (!investment.ok) {
        // A successfully disbursed loan remains a real liability. It is not
        // silently erased if execution later fails; the failed decision is
        // visible and the company must service or reuse that liquidity.
        return {
            status: 'REJECTED',
            code: investment.code,
            loan: storyEconomicAICompactLoan(loan, candidate.companyId),
            investment: storyEconomicAICompactInvestment(investment)
        };
    }
    return {
        status: 'APPLIED',
        code: 'PROJECT_STARTED',
        loan: storyEconomicAICompactLoan(loan, candidate.companyId),
        investment: storyEconomicAICompactInvestment(investment),
        projectId: investment.project.id
    };
}

function storyEconomicAICompanyDecision(company, actionBudget) {
    const ledger = storyEconomicAIEnsure();
    const worldDay = storyEconomicAIWorldDay();
    const candidates = storyEconomicAICompanyCandidates(company.id);
    const strongest = candidates[0];
    const lastDay = Number(ledger.lastActorDecisionDay[company.id]);
    const cooldown = Number.isFinite(lastDay)
        && worldDay - lastDay < STORY_ECONOMIC_AI_POLICY.companyCooldownDays;
    let selected = candidates.find(candidate => candidate.eligibility === 'ELIGIBLE');
    if (cooldown) selected = null;
    if (!selected || actionBudget.remaining <= 0) {
        const code = cooldown
            ? 'ACTOR_COOLDOWN'
            : (actionBudget.remaining <= 0 ? 'CYCLE_ACTION_BUDGET' : 'NO_ELIGIBLE_INVESTMENT');
        const hold = storyEconomicAIHoldCandidate(company.id, company.countryId, code, strongest ? strongest.score : 0);
        const visibleCandidates = (strongest ? [strongest] : []).concat([hold]);
        if (strongest && strongest.rejectionCode) {
            storyEconomicAIRecordRejectionDiagnostic(ledger, strongest);
        }
        ledger.totals.companyDecisions++;
        ledger.totals.holdDecisions++;
        return storyEconomicAIRecordDecision(ledger, {
            actorType: 'COMPANY',
            actorId: company.id,
            countryId: company.countryId,
            candidates: visibleCandidates,
            selectedCandidateId: hold.id,
            selectedAction: 'HOLD',
            selectedScore: hold.score,
            execution: { status: 'HELD', code },
            outcome: { status: 'NOT_APPLICABLE' }
        });
    }
    const execution = storyEconomicAIExecuteCompanyCandidate(selected);
    ledger.lastActorDecisionDay[company.id] = worldDay;
    ledger.totals.companyDecisions++;
    if (execution.status === 'APPLIED') {
        actionBudget.remaining--;
        ledger.totals.appliedActions++;
        if (execution.code === 'PROJECT_STARTED') {
            ledger.totals.projectsStarted++;
            if (execution.loan && execution.loan.ok) ledger.totals.loansTaken++;
        }
    } else {
        ledger.totals.rejectedActions++;
    }
    return storyEconomicAIRecordDecision(ledger, {
        actorType: 'COMPANY',
        actorId: company.id,
        countryId: company.countryId,
        candidates: storyEconomicAIVisibleCandidates(
            candidates,
            selected,
            STORY_ECONOMIC_AI_POLICY.maximumCandidatesPerDecision
        ),
        selectedCandidateId: selected.id,
        selectedAction: selected.actionType,
        selectedScore: selected.score,
        execution: storyEconomicAIClone(execution),
        outcome: execution.status === 'APPLIED'
            ? (execution.code === 'PREPARATION_STARTED' ? {
                status: 'PENDING',
                preparationId: execution.preparationId
            } : {
                status: 'PENDING',
                projectId: execution.projectId,
                facilityId: selected.facilityId,
                baselineCapacity: storyEconomicAIRound(
                    Number(STORY.companyEconomy.facilities[selected.facilityId].capacity)
                ),
                expectedCapacityIncrease: STORY_COMPANY_POLICY.investmentCapacity
            })
            : { status: 'FAILED', code: execution.code }
    });
}

function storyEconomicAICompanyPortfolioOrder() {
    const companies = Object.values(STORY.companyEconomy.companies || {});
    if (!storyEconomicAIBootstrapPlanningEnabled()) {
        return companies.sort((a, b) => a.id.localeCompare(b.id));
    }
    const ranked = companies.map(company => {
        const candidates = storyEconomicAICompanyCandidates(company.id);
        const eligible = candidates.find(candidate => candidate.eligibility === 'ELIGIBLE');
        const strongest = candidates[0];
        return {
            company,
            rank: eligible ? eligible.score : (strongest ? strongest.score - 20000 : -30000),
            sectorId: eligible && eligible.sectorId || strongest && strongest.sectorId || company.sectorId
        };
    });
    const byCountry = new Map();
    for (const row of ranked) {
        const list = byCountry.get(row.company.countryId) || [];
        list.push(row);
        byCountry.set(row.company.countryId, list);
    }
    for (const list of byCountry.values()) {
        list.sort((a, b) => b.rank - a.rank
            || a.sectorId.localeCompare(b.sectorId)
            || a.company.id.localeCompare(b.company.id));
    }
    const countryIds = [...byCountry.keys()].sort((a, b) => a.localeCompare(b));
    const ordered = [];
    let depth = 0;
    while (ordered.length < ranked.length) {
        let added = false;
        for (const countryId of countryIds) {
            const row = byCountry.get(countryId)[depth];
            if (!row) continue;
            ordered.push(row.company);
            added = true;
        }
        if (!added) break;
        depth++;
    }
    return ordered;
}

function storyEconomicAIStateCandidates(state) {
    const countryId = `country:${Number(state.id)}`;
    const companyLedger = STORY.companyEconomy;
    if (!companyLedger) return [];
    const candidates = [];
    const strategic = new Set(['agriculture', 'energy']);
    for (const company of Object.values(companyLedger.companies)
        .filter(row => row.countryId === countryId && row.status === 'OPERATING')
        .sort((a, b) => a.id.localeCompare(b.id))) {
        for (const candidate of storyEconomicAICompanyCandidates(company.id)) {
            if (candidate.score < STORY_ECONOMIC_AI_POLICY.stateGrantScore) continue;
            if (!strategic.has(candidate.sectorId)) continue;
            if (!['FINANCE_UNAVAILABLE', 'PHYSICAL_INPUTS_UNAVAILABLE'].includes(candidate.rejectionCode)) continue;
            if (candidate.rejectionCode === 'PHYSICAL_INPUTS_UNAVAILABLE') continue;
            const shortfall = Math.max(0, Number(candidate.signals.cashShortfall) || 0);
            if (shortfall <= 0) continue;
            candidates.push({
                id: `candidate:state:${state.id}:grant:${company.id}:${candidate.regionId}`,
                actionType: 'TARGETED_CAPACITY_GRANT',
                actorId: countryId,
                countryId,
                companyId: company.id,
                regionId: candidate.regionId,
                sectorId: candidate.sectorId,
                resourceId: candidate.resourceId,
                score: candidate.score,
                eligibility: 'ELIGIBLE',
                rejectionCode: null,
                amount: storyEconomicAIRound(Math.min(
                    STORY_ECONOMIC_AI_POLICY.stateGrantMaximum,
                    shortfall
                )),
                signals: storyEconomicAIClone(candidate.signals),
                reasons: [
                    'STRATEGIC_FOOD_OR_ENERGY',
                    `PRESSURE_BPS:${candidate.signals.pressureBps}`,
                    'PRIVATE_FINANCE_UNAVAILABLE'
                ]
            });
        }
    }
    return candidates.sort((a, b) => b.score - a.score
        || a.companyId.localeCompare(b.companyId)
        || a.regionId.localeCompare(b.regionId));
}

function storyEconomicAIExecuteStateGrant(state, candidate) {
    const budget = typeof storyBudgetCountryView === 'function'
        ? storyBudgetCountryView(state.id)
        : null;
    const cash = budget ? Math.max(0, Number(budget.cash) || 0) : 0;
    if (cash - candidate.amount < STORY_ECONOMIC_AI_POLICY.stateCashReserve) {
        return { status: 'REJECTED', code: 'STATE_CASH_RESERVE' };
    }
    const paid = storyBudgetDebit(state, candidate.amount, 'economic_ai.capacity_grant', {
        correlationId: candidate.id
    });
    if (!paid.ok) return { status: 'REJECTED', code: paid.code, budget: paid };
    const received = storyCompanyReceiveStateSupport(candidate.companyId, candidate.amount, {
        correlationId: candidate.id,
        countryId: candidate.countryId,
        regionId: candidate.regionId,
        sectorId: candidate.sectorId
    });
    if (!received.ok) {
        storyBudgetCredit(state, candidate.amount, 'economic_ai.capacity_grant.rollback', {
            correlationId: candidate.id
        });
        return { status: 'REJECTED', code: received.code };
    }
    return {
        status: 'APPLIED',
        code: 'CAPACITY_GRANT_PAID',
        amount: candidate.amount,
        companyId: candidate.companyId,
        budgetTransactionId: paid.transaction && paid.transaction.id,
        companyTransactionId: received.transaction && received.transaction.id
    };
}

function storyEconomicAIStateDecision(state, actionBudget) {
    const ledger = storyEconomicAIEnsure();
    const actorId = `country:${Number(state.id)}`;
    const worldDay = storyEconomicAIWorldDay();
    const candidates = storyEconomicAIStateCandidates(state);
    const strongest = candidates[0];
    const lastDay = Number(ledger.lastActorDecisionDay[actorId]);
    const cooldown = Number.isFinite(lastDay)
        && worldDay - lastDay < STORY_ECONOMIC_AI_POLICY.stateCooldownDays;
    const selected = !cooldown && actionBudget.remaining > 0
        ? candidates.find(candidate => candidate.eligibility === 'ELIGIBLE')
        : null;
    if (!selected) {
        const code = cooldown
            ? 'ACTOR_COOLDOWN'
            : (actionBudget.remaining <= 0 ? 'CYCLE_ACTION_BUDGET' : 'NO_ELIGIBLE_STATE_POLICY');
        const hold = storyEconomicAIHoldCandidate(actorId, actorId, code, strongest ? strongest.score : 0);
        ledger.totals.stateDecisions++;
        ledger.totals.holdDecisions++;
        return storyEconomicAIRecordDecision(ledger, {
            actorType: 'STATE',
            actorId,
            countryId: actorId,
            candidates: (strongest ? [strongest] : []).concat([hold]),
            selectedCandidateId: hold.id,
            selectedAction: 'HOLD',
            selectedScore: hold.score,
            execution: { status: 'HELD', code },
            outcome: { status: 'NOT_APPLICABLE' }
        });
    }
    const execution = storyEconomicAIExecuteStateGrant(state, selected);
    ledger.lastActorDecisionDay[actorId] = worldDay;
    ledger.totals.stateDecisions++;
    if (execution.status === 'APPLIED') {
        actionBudget.remaining--;
        ledger.totals.appliedActions++;
        ledger.totals.grantsPaid++;
        ledger.totals.grantAmount = storyEconomicAIRound(
            ledger.totals.grantAmount + execution.amount
        );
    } else {
        ledger.totals.rejectedActions++;
    }
    return storyEconomicAIRecordDecision(ledger, {
        actorType: 'STATE',
        actorId,
        countryId: actorId,
        candidates: storyEconomicAIVisibleCandidates(
            candidates,
            selected,
            STORY_ECONOMIC_AI_POLICY.maximumCandidatesPerDecision
        ),
        selectedCandidateId: selected.id,
        selectedAction: selected.actionType,
        selectedScore: selected.score,
        execution: storyEconomicAIClone(execution),
        outcome: execution.status === 'APPLIED'
            ? { status: 'REALIZED', amount: execution.amount, companyId: selected.companyId }
            : { status: 'FAILED', code: execution.code }
    });
}

function storyEconomicAIUpdateOutcomes(ledger) {
    for (const decision of ledger.decisions) {
        if (!decision.outcome || decision.outcome.status !== 'PENDING') continue;
        if (decision.outcome.preparationId) {
            const preparation = (ledger.preparations || []).find(row => row.id === decision.outcome.preparationId);
            if (!preparation) {
                decision.outcome.status = 'FAILED';
                decision.outcome.code = 'PREPARATION_MISSING';
                decision.outcome.resolvedAt = storyEconomicAIRound(STORY.clock);
                ledger.totals.outcomesFailed++;
            } else if (preparation.status === 'READY' || preparation.status === 'CONSUMED') {
                decision.outcome.status = 'REALIZED';
                decision.outcome.resolvedAt = storyEconomicAIRound(STORY.clock);
                decision.outcome.reserved = storyEconomicAIClone(preparation.reserved);
                ledger.totals.outcomesRealized++;
            } else if (preparation.status === 'CANCELLED') {
                decision.outcome.status = 'FAILED';
                decision.outcome.code = 'PREPARATION_CANCELLED';
                decision.outcome.resolvedAt = storyEconomicAIRound(STORY.clock);
                ledger.totals.outcomesFailed++;
            }
            continue;
        }
        const project = STORY.companyEconomy && (STORY.companyEconomy.projects || [])
            .find(row => row.id === decision.outcome.projectId);
        if (!project) {
            decision.outcome.status = 'FAILED';
            decision.outcome.code = 'PROJECT_MISSING';
            decision.outcome.resolvedAt = storyEconomicAIRound(STORY.clock);
            ledger.totals.outcomesFailed++;
            continue;
        }
        if (project.status === 'COMPLETED') {
            const facility = STORY.companyEconomy.facilities[project.facilityId];
            decision.outcome.status = 'REALIZED';
            decision.outcome.resolvedAt = storyEconomicAIRound(STORY.clock);
            decision.outcome.capacityAfter = storyEconomicAIRound(
                facility ? facility.capacity : decision.outcome.baselineCapacity
            );
            decision.outcome.realizedIncrease = storyEconomicAIRound(
                decision.outcome.capacityAfter - decision.outcome.baselineCapacity
            );
            ledger.totals.outcomesRealized++;
        } else if (project.status === 'CANCELLED') {
            decision.outcome.status = 'FAILED';
            decision.outcome.code = 'PROJECT_CANCELLED';
            decision.outcome.resolvedAt = storyEconomicAIRound(STORY.clock);
            ledger.totals.outcomesFailed++;
        }
    }
}

function storyEconomicAITick(dtSec) {
    const ledger = storyEconomicAIEnsure();
    if (!ledger) return { disabled: true, decisions: 0, actions: 0 };
    const yearSeconds = typeof STORY_CALENDAR !== 'undefined'
        ? Number(STORY_CALENDAR.secondsPerYear) || 120
        : 120;
    const worldDays = storyEconomicAIRound(Math.max(0, Number(dtSec) || 0) * 365 / yearSeconds);
    if (worldDays <= 0) return { disabled: false, decisions: 0, actions: 0 };
    ledger.tickSequence++;
    ledger.lastTickAt = storyEconomicAIRound(STORY.clock);
    // Ticaret bu sistemden hemen önce çalışır. Teslim edilen fiziksel yükü bir
    // sonraki bölgesel tüketimden önce proje emanetine al; kalan açığı yalnız
    // gerçek Faz 18 siparişleri ve gecikmeli sevkiyatlarla tamamla.
    if (storyEconomicAIBootstrapPlanningEnabled()) {
        for (const preparation of (ledger.preparations || [])
            .filter(row => row.status === 'ACCUMULATING')
            .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))) {
            storyEconomicAIReservePreparedInputs(preparation.regionId);
            if (preparation.status === 'ACCUMULATING') {
                storyEconomicAIProcurePreparedInputs(preparation);
            }
        }
    }
    storyEconomicAIUpdateOutcomes(ledger);
    ledger.elapsedDays = storyEconomicAIRound(ledger.elapsedDays + worldDays);
    if (ledger.elapsedDays + 1e-6 < STORY_ECONOMIC_AI_POLICY.decisionIntervalDays) {
        return { disabled: false, decisions: 0, actions: 0, waitingDays: ledger.elapsedDays };
    }
    ledger.elapsedDays = storyEconomicAIRound(
        ledger.elapsedDays - STORY_ECONOMIC_AI_POLICY.decisionIntervalDays
    );
    ledger.totals.cycles++;
    const beforeDecisions = ledger.decisionSequence;
    const beforeActions = ledger.totals.appliedActions;
    const companyBudget = { remaining: STORY_ECONOMIC_AI_POLICY.maxCompanyActionsPerCycle };
    for (const company of storyEconomicAICompanyPortfolioOrder()) {
        storyEconomicAICompanyDecision(company, companyBudget);
    }
    const stateBudget = { remaining: STORY_ECONOMIC_AI_POLICY.maxStateActionsPerCycle };
    for (const state of (STORY.states || []).filter(row => !row.isPlayer)
        .sort((a, b) => Number(a.id) - Number(b.id))) {
        storyEconomicAIStateDecision(state, stateBudget);
    }
    return {
        disabled: false,
        cycle: ledger.totals.cycles,
        decisions: ledger.decisionSequence - beforeDecisions,
        actions: ledger.totals.appliedActions - beforeActions,
        companyActionsRemaining: companyBudget.remaining,
        stateActionsRemaining: stateBudget.remaining
    };
}

function storyEconomicAICountryView(countryId) {
    const ledger = storyEconomicAIEnsure();
    if (!ledger) return null;
    const id = String(countryId).startsWith('country:')
        ? String(countryId)
        : `country:${Number(countryId)}`;
    const countryDecisions = ledger.decisions.filter(row => row.countryId === id);
    const latest = countryDecisions.slice(-24);
    const milestones = countryDecisions
        .filter(row => row.execution.status === 'APPLIED')
        .slice(-6);
    const decisions = Array.from(new Map(
        latest.concat(milestones).map(row => [row.id, row])
    ).values())
        .sort((a, b) => b.sequence - a.sequence)
        .map(storyEconomicAIClone);
    return {
        countryId: id,
        decisions,
        latestDecision: decisions[0] || null,
        appliedActions: decisions.filter(row => row.execution.status === 'APPLIED').length,
        pendingOutcomes: decisions.filter(row => row.outcome && row.outcome.status === 'PENDING').length
    };
}

function storyEconomicAISummary() {
    const ledger = storyEconomicAIEnsure();
    if (!ledger) {
        return {
            schemaVersion: STORY_ECONOMIC_AI_SCHEMA_VERSION,
            adapterVersion: STORY_ECONOMIC_AI_ADAPTER_VERSION,
            disabled: true
        };
    }
    const pending = ledger.decisions.filter(row => row.outcome && row.outcome.status === 'PENDING').length;
    return {
        schemaVersion: ledger.schemaVersion,
        adapterVersion: ledger.adapterVersion,
        policyHash: ledger.policyHash,
        disabled: false,
        tickSequence: ledger.tickSequence,
        decisionSequence: ledger.decisionSequence,
        decisionCount: ledger.decisions.length,
        pendingOutcomes: pending,
        totals: storyEconomicAIClone(ledger.totals),
        diagnostics: storyEconomicAIClone(ledger.diagnostics)
    };
}
