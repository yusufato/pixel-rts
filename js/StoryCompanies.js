// ============================================================================
//  SIRKET, BANKA, TESIS VE YATIRIM DEFTERI — Faz 21
//  --------------------------------------------------------------------------
//  Devlet kasasindan ayri ekonomik aktorler. Sirket nakdi uretim/satis,
//  girdi gideri, kredi ve yatirimla degisir. Tesis kapasitesinin tek sahibi
//  vardir; yatirim aninda kapasite yaratmaz, fiziksel girdi ve zaman ister.
// ============================================================================

const STORY_COMPANY_SCHEMA_VERSION = 1;
const STORY_COMPANY_ADAPTER_VERSION = 'story-company-bank-ledger-1';
const STORY_COMPANY_TRANSACTION_LIMIT = 1800;
const STORY_COMPANY_PROJECT_LIMIT = 600;
const STORY_COMPANY_SECTORS = Object.freeze([
    'agriculture', 'energy', 'extraction', 'civil_industry',
    'advanced_tech', 'defense_industry'
]);
const STORY_COMPANY_RESOURCE_SECTOR = Object.freeze({
    food: 'agriculture',
    energy: 'energy',
    raw_materials: 'extraction',
    industrial_parts: 'civil_industry',
    electronics: 'advanced_tech',
    military_supplies: 'defense_industry'
});
const STORY_COMPANY_BASE_VALUE = Object.freeze({
    food: 0.42,
    energy: 0.18,
    raw_materials: 0.55,
    industrial_parts: 1.65,
    electronics: 4.20,
    military_supplies: 3.10
});
const STORY_COMPANY_POLICY = Object.freeze({
    currency: 'STATE_CREDIT',
    openingCompanyCash: 160,
    openingBankReserves: 1400,
    openingClearingCashPerCountry: 9000,
    minimumFoundingCapital: 120,
    loanInterestBps: 650,
    maximumDebtToEquityBps: 25000,
    insolvencyDays: 90,
    bankruptcyDays: 180,
    investmentDays: 180,
    investmentCashCost: 140,
    investmentParts: 18,
    investmentElectronics: 3,
    investmentCapacity: 0.20,
    licenseFee: 25,
    stateShareBps: 1200
});
const STORY_COMPANY_POLICY_HASH = storyProductionHash({
    schemaVersion: STORY_COMPANY_SCHEMA_VERSION,
    adapterVersion: STORY_COMPANY_ADAPTER_VERSION,
    sectors: STORY_COMPANY_SECTORS,
    resourceSector: STORY_COMPANY_RESOURCE_SECTOR,
    values: STORY_COMPANY_BASE_VALUE,
    policy: STORY_COMPANY_POLICY
});

function storyCompanyEnabled() {
    return (typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('economy.companiesBanks'))
        && (typeof storyRegionalEnabled !== 'function' || storyRegionalEnabled())
        && (typeof storyMarketEnabled !== 'function' || storyMarketEnabled())
        && (typeof storyBudgetEnabled !== 'function' || storyBudgetEnabled());
}

function storyCompanyClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyCompanyRound(value, digits) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    const factor = 10 ** (digits == null ? 6 : digits);
    return Math.round(number * factor) / factor;
}

function storyCompanyCountryId(value) {
    if (typeof value === 'object' && value) value = value.id;
    const raw = String(value == null ? '' : value);
    return raw.startsWith('country:') ? raw : `country:${Number(value)}`;
}

function storyCompanyRegionId(value) {
    const raw = String(value == null ? '' : value);
    return raw.startsWith('region:') ? raw : `region:${Number(value)}`;
}

function storyCompanyName(countryId, sectorId) {
    const stateId = Number(String(countryId).split(':')[1]);
    const state = STORY.states && STORY.states[stateId];
    const prefix = state && state.name ? String(state.name).split(' ')[0] : `Devlet ${stateId}`;
    const suffix = {
        agriculture: 'Gida',
        energy: 'Enerji',
        extraction: 'Maden',
        civil_industry: 'Sanayi',
        advanced_tech: 'Teknoloji',
        defense_industry: 'Savunma'
    }[sectorId] || sectorId;
    return `${prefix} ${suffix} A.S.`;
}

function storyCompanyAccountBase(openingCash) {
    const accounts = {
        'ASSET:CASH': storyCompanyRound(openingCash),
        'ASSET:PROJECT_ESCROW': 0,
        'ASSET:RECEIVABLE': 0,
        'LIABILITY:DEBT': 0,
        'EQUITY:OPENING': storyCompanyRound(-openingCash),
        'EQUITY:RETAINED': 0
    };
    if (typeof storyCommerceEnabled === 'function' && storyCommerceEnabled()) {
        accounts['ASSET:INVENTORY'] = 0;
        accounts['ASSET:TRADE_ESCROW'] = 0;
    }
    return accounts;
}

function storyCompanyRecord(ledger, payload) {
    ledger.transactionSequence++;
    const transaction = Object.assign({
        id: `company-tx:${ledger.transactionSequence}`,
        sequence: ledger.transactionSequence,
        at: storyCompanyRound(STORY.clock)
    }, storyCompanyClone(payload));
    ledger.transactions.push(transaction);
    if (ledger.transactions.length > STORY_COMPANY_TRANSACTION_LIMIT) {
        ledger.transactions.splice(0, ledger.transactions.length - STORY_COMPANY_TRANSACTION_LIMIT);
    }
    return transaction;
}

function storyCompanyPost(company, source, postings, details) {
    const rows = (postings || []).map(row => ({
        account: String(row.account),
        amount: storyCompanyRound(row.amount)
    }));
    const sum = storyCompanyRound(rows.reduce((total, row) => total + row.amount, 0));
    if (Math.abs(sum) > 1e-5) return { ok: false, code: 'UNBALANCED_COMPANY_POSTING', sum };
    for (const row of rows) {
        company.accounts[row.account] = storyCompanyRound(
            (Number(company.accounts[row.account]) || 0) + row.amount
        );
    }
    if (company.accounts['ASSET:CASH'] < -1e-5
        || company.accounts['ASSET:PROJECT_ESCROW'] < -1e-5
        || company.accounts['ASSET:RECEIVABLE'] < -1e-5
        || (company.accounts['ASSET:TRADE_ESCROW'] != null
            && company.accounts['ASSET:TRADE_ESCROW'] < -1e-5)
        || (company.accounts['ASSET:INVENTORY'] != null
            && company.accounts['ASSET:INVENTORY'] < -1e-5)
        || company.accounts['LIABILITY:DEBT'] > 1e-5) {
        for (const row of rows) {
            company.accounts[row.account] = storyCompanyRound(company.accounts[row.account] - row.amount);
        }
        return { ok: false, code: 'INVALID_COMPANY_BALANCE' };
    }
    const transaction = storyCompanyRecord(STORY.companyEconomy, Object.assign({
        actorType: 'COMPANY',
        actorId: company.id,
        source: String(source),
        postings: rows
    }, details || {}));
    return { ok: true, transaction };
}

function storyCompanyBankPost(bank, source, changes, details) {
    const next = {
        reserves: storyCompanyRound(bank.reserves + (Number(changes.reserves) || 0)),
        loansReceivable: storyCompanyRound(bank.loansReceivable + (Number(changes.loansReceivable) || 0)),
        equity: storyCompanyRound(bank.equity + (Number(changes.equity) || 0))
    };
    if (next.reserves < -1e-5 || next.loansReceivable < -1e-5) {
        return { ok: false, code: 'INVALID_BANK_BALANCE' };
    }
    Object.assign(bank, next);
    return {
        ok: true,
        transaction: storyCompanyRecord(STORY.companyEconomy, Object.assign({
            actorType: 'BANK',
            actorId: bank.id,
            source: String(source),
            changes: {
                reserves: storyCompanyRound(changes.reserves),
                loansReceivable: storyCompanyRound(changes.loansReceivable),
                equity: storyCompanyRound(changes.equity)
            }
        }, details || {}))
    };
}

function storyCompanyLedgerCreate(options) {
    options = options || {};
    const ledger = {
        schemaVersion: STORY_COMPANY_SCHEMA_VERSION,
        adapterVersion: STORY_COMPANY_ADAPTER_VERSION,
        policyHash: STORY_COMPANY_POLICY_HASH,
        resourceCatalogHash: STORY_RESOURCE_CATALOG_HASH,
        productionCatalogHash: STORY_PRODUCTION_CATALOG_HASH,
        currency: STORY_COMPANY_POLICY.currency,
        tickSequence: 0,
        transactionSequence: 0,
        applicationSequence: 0,
        projectSequence: 0,
        lastTickAt: 0,
        openingMoneySupply: 0,
        externalMoneyInflow: 0,
        marketClearingCash: 0,
        applicationEscrow: 0,
        companies: {},
        banks: {},
        facilities: {},
        warehouses: {},
        applications: [],
        projects: [],
        transactions: [],
        diagnostics: {
            backfilled: !!options.backfilled,
            restoredFromInvalidLedger: !!options.restoredFromInvalidLedger,
            issues: Array.isArray(options.issues) ? storyCompanyClone(options.issues).slice(0, 50) : [],
            warnings: Array.isArray(options.warnings) ? options.warnings.map(String).slice(0, 30) : [],
            regionalCapitalBridge: 'COMPANY_LIQUIDITY_MIRROR',
            stateTreasuryIsNotCompany: true
        }
    };
    for (const state of (STORY.states || [])) {
        const countryId = storyCompanyCountryId(state.id);
        const bankId = `bank:${state.id}:0`;
        ledger.banks[bankId] = {
            id: bankId,
            name: `${state.name} Kalkinma Bankasi`,
            countryId,
            status: 'OPERATING',
            reserves: STORY_COMPANY_POLICY.openingBankReserves,
            deposits: 0,
            loansReceivable: 0,
            equity: STORY_COMPANY_POLICY.openingBankReserves,
            annualInterestBps: STORY_COMPANY_POLICY.loanInterestBps,
            loanIds: []
        };
        ledger.openingMoneySupply += STORY_COMPANY_POLICY.openingBankReserves;
        ledger.marketClearingCash += STORY_COMPANY_POLICY.openingClearingCashPerCountry;
        ledger.openingMoneySupply += STORY_COMPANY_POLICY.openingClearingCashPerCountry;
        for (const sectorId of STORY_COMPANY_SECTORS) {
            const id = `company:${state.id}:${sectorId}`;
            const openingCash = STORY_COMPANY_POLICY.openingCompanyCash;
            ledger.companies[id] = {
                id,
                name: storyCompanyName(countryId, sectorId),
                countryId,
                sectorId,
                legalStatus: 'REGISTERED',
                licenseStatus: 'LICENSED',
                status: 'OPERATING',
                foundedAt: 0,
                owners: [
                    { ownerType: 'DOMESTIC_PRIVATE', ownerId: `households:${state.id}`, shareBps: 8800 },
                    { ownerType: 'STATE', ownerId: countryId, shareBps: STORY_COMPANY_POLICY.stateShareBps }
                ],
                accounts: storyCompanyAccountBase(openingCash),
                facilityIds: [],
                warehouseIds: [],
                bankId,
                annualInterestBps: STORY_COMPANY_POLICY.loanInterestBps,
                arrears: 0,
                distressedDays: 0,
                cumulative: {
                    revenue: 0,
                    expense: 0,
                    interest: 0,
                    investment: 0,
                    tradeRevenue: 0,
                    productionCycles: 0
                },
                lobbyInfluence: 0,
                lastResult: null
            };
            ledger.openingMoneySupply += openingCash;
        }
    }
    for (const node of (STORY.nodes || [])) {
        const regionId = storyCompanyRegionId(node.id);
        const countryId = storyCompanyCountryId(node.owner);
        const regional = STORY.regionalEconomy && STORY.regionalEconomy.regions
            ? STORY.regionalEconomy.regions[regionId]
            : null;
        for (const sectorId of STORY_COMPANY_SECTORS) {
            const capacity = Math.max(0, Number(regional && regional.sectorCapacity[sectorId]) || 0);
            if (capacity <= 0) continue;
            const companyId = `company:${node.owner}:${sectorId}`;
            const facilityId = `facility:${node.id}:${sectorId}`;
            ledger.facilities[facilityId] = {
                id: facilityId,
                regionId,
                countryId,
                sectorId,
                ownerCompanyId: companyId,
                status: 'OPERATING',
                capacity: storyCompanyRound(capacity),
                licensed: true,
                acquiredAt: 0
            };
            ledger.companies[companyId].facilityIds.push(facilityId);
        }
        const warehouseId = `warehouse:${node.id}:general`;
        const ownerCompanyId = `company:${node.owner}:civil_industry`;
        ledger.warehouses[warehouseId] = {
            id: warehouseId,
            regionId,
            countryId,
            ownerCompanyId,
            status: 'OPERATING',
            capacityByResource: Object.fromEntries(
                STORY_RESOURCE_IDS.map(resourceId => [
                    resourceId,
                    storyCompanyRound(Math.max(10, Number(regional && regional.safeTargets[resourceId]) || 0) * 3)
                ])
            )
        };
        ledger.companies[ownerCompanyId].warehouseIds.push(warehouseId);
    }
    ledger.openingMoneySupply = storyCompanyRound(ledger.openingMoneySupply);
    ledger.marketClearingCash = storyCompanyRound(ledger.marketClearingCash);
    return ledger;
}

function storyCompanyValidate(candidate) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!candidate || typeof candidate !== 'object') return { ok: false, issues: [{ code: 'COMPANY_LEDGER_MISSING', path: '$', message: 'Sirket defteri yok.' }] };
    if (candidate.schemaVersion !== STORY_COMPANY_SCHEMA_VERSION) add('COMPANY_SCHEMA_VERSION', '$.schemaVersion', 'Sirket sema surumu uyumsuz.');
    if (candidate.adapterVersion !== STORY_COMPANY_ADAPTER_VERSION) add('COMPANY_ADAPTER_VERSION', '$.adapterVersion', 'Sirket adapter surumu uyumsuz.');
    if (candidate.policyHash !== STORY_COMPANY_POLICY_HASH) add('COMPANY_POLICY_HASH', '$.policyHash', 'Sirket politika karmasi uyumsuz.');
    if (candidate.resourceCatalogHash !== STORY_RESOURCE_CATALOG_HASH) add('COMPANY_RESOURCE_HASH', '$.resourceCatalogHash', 'Kaynak katalog karmasi uyumsuz.');
    if (candidate.productionCatalogHash !== STORY_PRODUCTION_CATALOG_HASH) add('COMPANY_PRODUCTION_HASH', '$.productionCatalogHash', 'Uretim katalog karmasi uyumsuz.');
    const companies = candidate.companies && typeof candidate.companies === 'object' ? candidate.companies : {};
    const banks = candidate.banks && typeof candidate.banks === 'object' ? candidate.banks : {};
    if (Object.keys(companies).length < (STORY.states || []).length * STORY_COMPANY_SECTORS.length) {
        add('COMPANY_COUNT', '$.companies', 'Her devlet ve sektor icin ekonomik aktor bulunmali.');
    }
    for (const [id, company] of Object.entries(companies)) {
        if (company.id !== id) add('COMPANY_ID', `$.companies.${id}.id`, 'Sirket kimligi anahtarla uyusmuyor.');
        const shares = (company.owners || []).reduce((sum, row) => sum + (Number(row.shareBps) || 0), 0);
        if (shares !== 10000) add('COMPANY_OWNERSHIP', `$.companies.${id}.owners`, 'Ortaklik paylari 10000 baz puan olmali.');
        for (const [account, amount] of Object.entries(company.accounts || {})) {
            if (!Number.isFinite(Number(amount))) add('COMPANY_ACCOUNT_FINITE', `$.companies.${id}.accounts.${account}`, 'Hesap sonlu olmali.');
        }
        if (Number(company.accounts && company.accounts['ASSET:CASH']) < -1e-5) add('COMPANY_NEGATIVE_CASH', `$.companies.${id}.accounts.ASSET:CASH`, 'Sirket nakdi negatif olamaz.');
        if (!['REGISTERED', 'DISSOLVED'].includes(company.legalStatus)) add('COMPANY_LEGAL_STATUS', `$.companies.${id}.legalStatus`, 'Gecersiz hukuki durum.');
    }
    for (const [id, bank] of Object.entries(banks)) {
        if (bank.id !== id || Number(bank.reserves) < -1e-5 || Number(bank.loansReceivable) < -1e-5) {
            add('BANK_BALANCE', `$.banks.${id}`, 'Banka kimligi veya bilancosu gecersiz.');
        }
    }
    const facilityOwners = new Set();
    for (const [id, facility] of Object.entries(candidate.facilities || {})) {
        if (!companies[facility.ownerCompanyId]) add('FACILITY_OWNER', `$.facilities.${id}.ownerCompanyId`, 'Tesisin kayitli sahibi yok.');
        const key = `${facility.regionId}|${facility.sectorId}`;
        if (facilityOwners.has(key)) add('FACILITY_DUPLICATE_OWNER', `$.facilities.${id}`, 'Ayni bolge/sektor kapasitesinin iki sahibi olamaz.');
        facilityOwners.add(key);
    }
    for (const project of (candidate.projects || [])) {
        if (!companies[project.companyId]) add('PROJECT_COMPANY', `$.projects.${project.id}.companyId`, 'Yatirim sirketi yok.');
        if (!candidate.facilities[project.facilityId]) add('PROJECT_FACILITY', `$.projects.${project.id}.facilityId`, 'Yatirim tesisi yok.');
        if (!['BUILDING', 'COMPLETED', 'CANCELLED'].includes(project.status)) add('PROJECT_STATUS', `$.projects.${project.id}.status`, 'Yatirim durumu gecersiz.');
    }
    for (const transaction of (candidate.transactions || [])) {
        if (transaction.actorType !== 'COMPANY' || !Array.isArray(transaction.postings)) continue;
        const sum = storyCompanyRound(transaction.postings.reduce((total, row) => total + Number(row.amount || 0), 0));
        if (Math.abs(sum) > 1e-5) add('COMPANY_UNBALANCED_TRANSACTION', `$.transactions.${transaction.id}`, 'Sirket fisi dengeli degil.');
    }
    const companyCash = Object.values(companies).reduce(
        (sum, company) => sum + Math.max(0, Number(company.accounts && company.accounts['ASSET:CASH']) || 0)
            + Math.max(0, Number(company.accounts && company.accounts['ASSET:PROJECT_ESCROW']) || 0)
            + Math.max(0, Number(company.accounts && company.accounts['ASSET:TRADE_ESCROW']) || 0),
        0
    );
    const bankReserves = Object.values(banks).reduce((sum, bank) => sum + Math.max(0, Number(bank.reserves) || 0), 0);
    const activeMoney = storyCompanyRound(companyCash + bankReserves
        + Math.max(0, Number(candidate.marketClearingCash) || 0)
        + Math.max(0, Number(candidate.applicationEscrow) || 0));
    const expectedMoney = storyCompanyRound(
        (Number(candidate.openingMoneySupply) || 0) + (Number(candidate.externalMoneyInflow) || 0)
    );
    if (Math.abs(activeMoney - expectedMoney) > 0.05) {
        add('COMPANY_MONEY_CONSERVATION', '$.openingMoneySupply', `Sirket/banka para korumasi bozuldu: ${activeMoney}.`);
    }
    if (candidate.commerce && typeof storyCommerceValidate === 'function') {
        const commerceValidation = storyCommerceValidate(candidate.commerce, candidate, {
            checkPhysicalMirrors: candidate === STORY.companyEconomy
        });
        for (const issue of commerceValidation.issues || []) issues.push(issue);
    } else if (typeof storyCommerceEnabled === 'function' && storyCommerceEnabled()) {
        add('COMMERCE_LEDGER_MISSING', '$.commerce', 'Satis ve envanter defteri zorunlu.');
    }
    return { ok: issues.length === 0, issues };
}

function storyCompanyReset(options) {
    if (!storyCompanyEnabled()) {
        STORY.companyEconomy = null;
        return null;
    }
    STORY.companyEconomy = storyCompanyLedgerCreate(options);
    if (typeof storyCommerceEnabled === 'function' && storyCommerceEnabled()) {
        STORY.companyEconomy.commerce = storyCommerceCreateLedger();
    }
    storyCompanySyncRegionalCapital(false);
    return STORY.companyEconomy;
}

function storyCompanyRestore(saved) {
    if (!storyCompanyEnabled()) {
        STORY.companyEconomy = null;
        return null;
    }
    const candidate = storyCompanyClone(saved);
    if (candidate && typeof storyCommerceEnabled === 'function' && storyCommerceEnabled()
        && !candidate.commerce && typeof storyCommerceCreateLedger === 'function') {
        candidate.commerce = storyCommerceCreateLedger({ backfilled: true });
    }
    const validation = storyCompanyValidate(candidate);
    if (!validation.ok) {
        return storyCompanyReset({
            backfilled: !saved,
            restoredFromInvalidLedger: !!saved,
            issues: validation.issues,
            warnings: [saved
                ? 'Sirket/banka defteri gecersizdi; mevcut bolge ve sektorlerden guvenli acilis kuruldu.'
                : 'Kayit sirket/banka defteri tasimiyordu; mevcut bolge ve sektorlerden acilis kuruldu.']
        });
    }
    STORY.companyEconomy = candidate;
    storyCompanySyncRegionalCapital(false);
    return STORY.companyEconomy;
}

function storyCompanyEnsure() {
    if (!storyCompanyEnabled()) return null;
    return STORY.companyEconomy || storyCompanyReset({ backfilled: true });
}

function storyCompanyForSave() {
    const ledger = storyCompanyEnsure();
    if (!ledger) return null;
    const validation = storyCompanyValidate(ledger);
    if (!validation.ok) throw new Error(`Sirket defteri kaydedilemez: ${validation.issues.map(row => row.code).join(', ')}`);
    ledger.diagnostics.issues = [];
    return storyCompanyClone(ledger);
}

function storyCompanyById(companyId) {
    const ledger = storyCompanyEnsure();
    return ledger && ledger.companies[String(companyId)] || null;
}

function storyCompanyFacility(regionId, sectorId) {
    const ledger = storyCompanyEnsure();
    const id = `facility:${Number(storyCompanyRegionId(regionId).split(':')[1])}:${sectorId}`;
    return ledger && ledger.facilities[id] || null;
}

function storyCompanyForRegionSector(regionId, sectorId) {
    const facility = storyCompanyFacility(regionId, sectorId);
    return facility ? storyCompanyById(facility.ownerCompanyId) : null;
}

function storyCompanyOperatingCash(regionId, sectorId) {
    const company = storyCompanyForRegionSector(regionId, sectorId);
    if (!company || company.status !== 'OPERATING' || company.licenseStatus !== 'LICENSED') return 0;
    return Math.max(0, Number(company.accounts['ASSET:CASH']) || 0);
}

function storyCompanyRegionalLiquidity(regionId) {
    const ledger = storyCompanyEnsure();
    if (!ledger) return null;
    const id = storyCompanyRegionId(regionId);
    let total = 0;
    for (const company of Object.values(ledger.companies)) {
        const local = company.facilityIds.filter(facilityId => ledger.facilities[facilityId]
            && ledger.facilities[facilityId].regionId === id).length;
        if (!local) continue;
        total += (Number(company.accounts['ASSET:CASH']) || 0)
            * local / Math.max(1, company.facilityIds.length);
    }
    return storyCompanyRound(total);
}

function storyCompanySyncRegionalCapital(trackFlows) {
    const ledger = STORY.companyEconomy;
    const regional = STORY.regionalEconomy;
    if (!ledger || !regional || !regional.regions) return;
    for (const region of Object.values(regional.regions)) {
        const before = Math.max(0, Number(region.stocks.capital) || 0);
        const next = storyCompanyRegionalLiquidity(region.regionId);
        region.stocks.capital = next;
        if (trackFlows !== false && regional.totals) {
            const delta = storyCompanyRound(next - before);
            if (delta >= 0 && regional.totals.financialBridgeInflow) {
                storyRegionalAddToMap(regional.totals.financialBridgeInflow, 'capital', delta);
            } else if (delta < 0 && regional.totals.financialBridgeOutflow) {
                storyRegionalAddToMap(regional.totals.financialBridgeOutflow, 'capital', -delta);
            }
        }
        const nodeId = Number(String(region.regionId).split(':')[1]);
        const node = STORY.nodes && STORY.nodes[nodeId];
        if (node) node.stocks = storyCompanyClone(region.stocks);
    }
}

function storyCompanyMarketPrice(regionId, resourceId) {
    const market = typeof storyMarketRegionView === 'function' ? storyMarketRegionView(regionId) : null;
    const row = market && market.resources && market.resources[resourceId];
    const localPrice = row && Number.isFinite(Number(row.priceIndex)) ? Number(row.priceIndex) : 100;
    if (typeof storyFeatureEnabled === 'function'
        && !storyFeatureEnabled('economy.bootstrapPlanning')) return localPrice;
    const nodeId = Number(String(storyCompanyRegionId(regionId)).split(':')[1]);
    const node = STORY.nodes && STORY.nodes[nodeId];
    if (!node || !STORY.marketPrices || !STORY.marketPrices.regions) return localPrice;
    const nationalPrices = (STORY.nodes || [])
        .filter(candidate => Number(candidate.owner) === Number(node.owner))
        .map(candidate => STORY.marketPrices.regions[`region:${Number(candidate.id)}`])
        .map(region => region && region.resources && region.resources[resourceId])
        .filter(price => price && price.status === 'ACTIVE'
            && Number.isFinite(Number(price.priceIndex)))
        .map(price => Number(price.priceIndex))
        .sort((a, b) => a - b);
    if (!nationalPrices.length) return localPrice;
    // Ulusal şirket, yerel spot fiyat yerine erişebildiği ülke içi toptan
    // pazarın üst çeyrek fırsat fiyatıyla plan yapar. Maksimum tek bir uç
    // bölgenin bütün ülkeyi belirlemesine izin verilmez.
    return nationalPrices[Math.floor((nationalPrices.length - 1) * 0.75)];
}

function storyCompanyProductionUnitEconomics(regionId, sectorId) {
    const sector = (typeof STORY_PRODUCTION_SECTOR_DEFINITIONS !== 'undefined'
        ? STORY_PRODUCTION_SECTOR_DEFINITIONS
        : []).find(row => row.id === sectorId);
    if (!sector) return null;
    let workingCapitalRequired = 0;
    let expectedPhysicalInputCost = 0;
    for (const input of (sector.recipe.inputs || [])) {
        const quantity = Math.max(0, Number(input.quantity) || 0);
        if (input.resourceId === 'capital') {
            workingCapitalRequired += quantity;
            continue;
        }
        const baseValue = Math.max(0, Number(STORY_COMPANY_BASE_VALUE[input.resourceId]) || 0);
        expectedPhysicalInputCost += quantity * baseValue
            * storyCompanyMarketPrice(regionId, input.resourceId) / 100;
    }
    let expectedRevenue = 0;
    let primaryOutputId = null;
    for (const output of (sector.recipe.outputs || [])) {
        if (!primaryOutputId) primaryOutputId = output.resourceId;
        const quantity = Math.max(0, Number(output.quantity) || 0);
        const baseValue = Math.max(0, Number(STORY_COMPANY_BASE_VALUE[output.resourceId]) || 0);
        expectedRevenue += quantity * baseValue
            * storyCompanyMarketPrice(regionId, output.resourceId) / 100;
    }
    return {
        sector,
        primaryOutputId,
        workingCapitalRequired: storyCompanyRound(workingCapitalRequired),
        expectedPhysicalInputCost: storyCompanyRound(expectedPhysicalInputCost),
        expectedRevenue: storyCompanyRound(expectedRevenue)
    };
}

function storyCompanyProductionViability(regionId, sectorId) {
    if (typeof storyFeatureEnabled === 'function'
        && !storyFeatureEnabled('economy.bootstrapPlanning')) {
        return { approved: true, code: 'LEGACY_AUTO_PRODUCTION' };
    }
    const company = storyCompanyForRegionSector(regionId, sectorId);
    const sector = (typeof STORY_PRODUCTION_SECTOR_DEFINITIONS !== 'undefined'
        ? STORY_PRODUCTION_SECTOR_DEFINITIONS
        : []).find(row => row.id === sectorId);
    if (!company || !sector) return { approved: false, code: 'PRODUCTION_ACTOR_MISSING' };
    if (['advanced_tech', 'defense_industry'].includes(sectorId)) {
        let requestedEnergy = 0;
        let deliveredEnergy = 0;
        for (const node of (STORY.nodes || [])) {
            if (`country:${Number(node.owner)}` !== company.countryId) continue;
            const regional = STORY.regionalEconomy && STORY.regionalEconomy.regions
                && STORY.regionalEconomy.regions[`region:${Number(node.id)}`];
            for (const allocation of (regional && regional.lastTick && regional.lastTick.allocations) || []) {
                if (allocation.consumerType !== 'HOUSEHOLDS' || allocation.resourceId !== 'energy') continue;
                requestedEnergy += Math.max(0, Number(allocation.requested) || 0);
                deliveredEnergy += Math.max(0, Number(allocation.delivered) || 0);
            }
        }
        const householdEnergyFillBps = requestedEnergy > 0
            ? Math.round(Math.max(0, Math.min(1, deliveredEnergy / requestedEnergy)) * 10000)
            : 10000;
        const countryNumber = Number(String(company.countryId).split(':')[1]);
        const atWar = Number.isInteger(countryNumber) && (STORY.states || []).some(state => (
            state.id !== countryNumber
            && typeof storyIsHostile === 'function'
            && storyIsHostile(countryNumber, state.id)
        ));
        const rationingThreshold = sectorId === 'advanced_tech'
            ? 9000
            : (atWar ? 4000 : 8000);
        if (householdEnergyFillBps < rationingThreshold) {
            return {
                approved: false,
                code: 'STRATEGIC_ENERGY_RATIONING',
                companyId: company.id,
                sectorId,
                regionId: storyCompanyRegionId(regionId),
                householdEnergyFillBps,
                rationingThresholdBps: rationingThreshold,
                atWar
            };
        }
    }
    const economics = storyCompanyProductionUnitEconomics(regionId, sectorId);
    const workingCapitalRequired = economics ? economics.workingCapitalRequired : 0;
    const expectedPhysicalInputCost = economics ? economics.expectedPhysicalInputCost : 0;
    const expectedMarketRevenuePerCycle = economics ? economics.expectedRevenue : 0;
    const primaryOutputId = economics && economics.primaryOutputId;
    const regional = STORY.regionalEconomy && STORY.regionalEconomy.regions
        && STORY.regionalEconomy.regions[storyCompanyRegionId(regionId)];
    const wasProducing = !!(primaryOutputId && regional && regional.lastTick
        && Number(regional.lastTick.producedByResource
            && regional.lastTick.producedByResource[primaryOutputId]) > 1e-6);
    // Sale settlement gives physical inputs a real owner and a real purchase
    // price. In that model OPERATING_CAPITAL is a liquidity gate, not a second
    // expense on top of those purchases. Legacy mode keeps its original cost
    // proxy so the default-off feature remains bit-for-bit stable.
    const settledCostBasis = typeof storyCommerceEnabled === 'function'
        && storyCommerceEnabled();
    const expectedCostPerCycle = settledCostBasis
        ? expectedPhysicalInputCost
        : workingCapitalRequired;
    const stateContractMarginBps = typeof STORY_COMMERCE_STATE_CONTRACT_MARGIN_BPS !== 'undefined'
        ? STORY_COMMERCE_STATE_CONTRACT_MARGIN_BPS
        : 0;
    const stateContractRevenue = settledCostBasis && sectorId === 'defense_industry'
        ? expectedPhysicalInputCost * (1 + stateContractMarginBps / 10000)
        : 0;
    const expectedRevenuePerCycle = Math.max(
        expectedMarketRevenuePerCycle,
        stateContractRevenue
    );
    const revenueBasis = stateContractRevenue > expectedMarketRevenuePerCycle
        ? 'STATE_MILITARY_CONTRACT'
        : 'MARKET_SALE';
    const requiredRevenue = expectedCostPerCycle * (wasProducing ? 0.8 : 1);
    const approved = expectedCostPerCycle <= 1e-9
        || expectedRevenuePerCycle + 1e-6 >= requiredRevenue;
    return {
        approved,
        code: settledCostBasis
            ? (approved ? 'NON_NEGATIVE_EXPECTED_SALE_MARGIN' : 'PRICE_BELOW_EXPECTED_INPUT_COST')
            : (approved ? 'NON_NEGATIVE_OPERATING_MARGIN' : 'PRICE_BELOW_OPERATING_COST'),
        companyId: company.id,
        sectorId,
        regionId: storyCompanyRegionId(regionId),
        operatingCashPerCycle: storyCompanyRound(workingCapitalRequired),
        workingCapitalRequired: storyCompanyRound(workingCapitalRequired),
        expectedInputCostPerCycle: storyCompanyRound(expectedPhysicalInputCost),
        costBasis: settledCostBasis ? 'PHYSICAL_INPUTS' : 'LEGACY_OPERATING_CAPITAL',
        expectedMarketRevenuePerCycle: storyCompanyRound(expectedMarketRevenuePerCycle),
        expectedRevenuePerCycle: storyCompanyRound(expectedRevenuePerCycle),
        revenueBasis,
        wasProducing,
        continuationFloorBps: wasProducing ? 8000 : 10000,
        breakEvenIndex: expectedMarketRevenuePerCycle > 0
            ? storyCompanyRound(storyCompanyMarketPrice(
                regionId,
                primaryOutputId
            ) * expectedCostPerCycle / expectedMarketRevenuePerCycle)
            : null
    };
}

function storyCompanyOnProductionCommitted(regionId, transaction) {
    const ledger = storyCompanyEnsure();
    if (!ledger || !transaction) return { disabled: !ledger };
    const company = storyCompanyForRegionSector(regionId, transaction.sectorId);
    if (!company) return { ok: false, code: 'PRODUCTION_COMPANY_MISSING' };
    if (typeof storyCommerceEnabled === 'function' && storyCommerceEnabled()
        && typeof storyCommerceOnProductionCommitted === 'function') {
        return storyCommerceOnProductionCommitted(regionId, transaction, company);
    }
    const operatingCost = Math.max(0, Number(transaction.consumed && transaction.consumed.capital) || 0);
    if (operatingCost > Number(company.accounts['ASSET:CASH']) + 1e-6) {
        return { ok: false, code: 'COMPANY_CASH_UNAVAILABLE' };
    }
    let revenue = 0;
    for (const [resourceId, quantity] of Object.entries(transaction.produced || {})) {
        const base = Number(STORY_COMPANY_BASE_VALUE[resourceId]) || 0;
        revenue += Math.max(0, Number(quantity) || 0)
            * base * storyCompanyMarketPrice(regionId, resourceId) / 100;
    }
    // Faz 22.1: settlement is one atomic exchange. The operating payment made
    // by this same facility is available to the clearing pool before its sale
    // is settled; otherwise an empty pool makes the first facility lose cash
    // and lets a later iteration collect it purely because of array order.
    const bootstrapPlanning = typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('economy.bootstrapPlanning');
    const settlementLiquidity = Number(ledger.marketClearingCash)
        + (bootstrapPlanning ? operatingCost : 0);
    revenue = storyCompanyRound(Math.min(revenue, settlementLiquidity));
    const postings = [];
    if (operatingCost > 0) {
        postings.push({ account: 'EXPENSE:OPERATIONS', amount: operatingCost });
        postings.push({ account: 'ASSET:CASH', amount: -operatingCost });
        ledger.marketClearingCash = storyCompanyRound(ledger.marketClearingCash + operatingCost);
    }
    if (revenue > 0) {
        postings.push({ account: 'ASSET:CASH', amount: revenue });
        postings.push({ account: 'REVENUE:WHOLESALE', amount: -revenue });
        ledger.marketClearingCash = storyCompanyRound(ledger.marketClearingCash - revenue);
    }
    const result = postings.length
        ? storyCompanyPost(company, 'production.settlement', postings, {
            regionId: storyCompanyRegionId(regionId),
            sectorId: transaction.sectorId,
            regionalTransactionId: transaction.id
        })
        : { ok: true, transaction: null };
    if (!result.ok) {
        ledger.marketClearingCash = storyCompanyRound(ledger.marketClearingCash - operatingCost + revenue);
        return result;
    }
    company.cumulative.revenue = storyCompanyRound(company.cumulative.revenue + revenue);
    company.cumulative.expense = storyCompanyRound(company.cumulative.expense + operatingCost);
    company.cumulative.productionCycles = storyCompanyRound(
        company.cumulative.productionCycles + Math.max(0, Number(transaction.cycles) || 0)
    );
    company.lastResult = {
        at: storyCompanyRound(STORY.clock),
        regionId: storyCompanyRegionId(regionId),
        revenue,
        expense: operatingCost,
        profit: storyCompanyRound(revenue - operatingCost)
    };
    return { ok: true, companyId: company.id, revenue, operatingCost, transaction: result.transaction };
}

function storyCompanySellerForTrade(regionId, resourceId) {
    const sectorId = STORY_COMPANY_RESOURCE_SECTOR[String(resourceId)];
    const company = sectorId && storyCompanyForRegionSector(regionId, sectorId);
    return company && company.status !== 'BANKRUPT' ? company.id : null;
}

function storyCompanyBuyerForTrade(regionId, resourceId) {
    const ledger = storyCompanyEnsure();
    const sectorId = STORY_COMPANY_RESOURCE_SECTOR[String(resourceId)];
    const nodeId = Number(storyCompanyRegionId(regionId).split(':')[1]);
    const node = STORY.nodes && STORY.nodes[nodeId];
    if (!ledger || !sectorId || !node || !Number.isInteger(Number(node.owner))) return null;
    const company = ledger.companies[`company:${Number(node.owner)}:${sectorId}`];
    return company && company.status === 'OPERATING' && company.licenseStatus === 'LICENSED'
        ? company.id
        : null;
}

function storyCompanyReserveTradePayment(companyId, amount, details) {
    const company = storyCompanyById(companyId);
    const value = storyCompanyRound(Math.max(0, Number(amount) || 0));
    const reserve = typeof STORY_COMMERCE_COMPANY_MAINTENANCE_RESERVE !== 'undefined'
        ? STORY_COMMERCE_COMPANY_MAINTENANCE_RESERVE
        : 80;
    if (!company || value <= 0 || company.status !== 'OPERATING') {
        return { ok: false, code: 'TRADE_BUYER_COMPANY_MISSING' };
    }
    if (Math.max(0, Number(company.accounts['ASSET:CASH']) - reserve) + 1e-6 < value) {
        return { ok: false, code: 'TRADE_BUYER_COMPANY_CASH_UNAVAILABLE' };
    }
    const posted = storyCompanyPost(company, 'trade.import_reserve', [
        { account: 'ASSET:TRADE_ESCROW', amount: value },
        { account: 'ASSET:CASH', amount: -value }
    ], details);
    return posted.ok
        ? { ok: true, companyId: company.id, amount: value, transaction: posted.transaction }
        : posted;
}

function storyCompanyReleaseTradePayment(companyId, amount, details) {
    const company = storyCompanyById(companyId);
    const value = storyCompanyRound(Math.max(0, Number(amount) || 0));
    if (!company || value <= 0) return { ok: false, code: 'TRADE_BUYER_COMPANY_MISSING' };
    return storyCompanyPost(company, 'trade.import_release', [
        { account: 'ASSET:CASH', amount: value },
        { account: 'ASSET:TRADE_ESCROW', amount: -value }
    ], details);
}

function storyCompanySettleTradeImport(companyId, amount, details) {
    const company = storyCompanyById(companyId);
    const value = storyCompanyRound(Math.max(0, Number(amount) || 0));
    if (!company || value <= 0) return { ok: false, code: 'TRADE_BUYER_COMPANY_MISSING' };
    const posted = storyCompanyPost(company, 'trade.import_inventory', [
        { account: 'ASSET:INVENTORY', amount: value },
        { account: 'ASSET:TRADE_ESCROW', amount: -value }
    ], details);
    if (!posted.ok) return posted;
    company.cumulative.tradeExpense = storyCompanyRound(
        (Number(company.cumulative.tradeExpense) || 0) + value
    );
    return { ok: true, companyId: company.id, amount: value, transaction: posted.transaction };
}

function storyCompanyReceiveTradePayment(companyId, amount, details) {
    const ledger = storyCompanyEnsure();
    const company = storyCompanyById(companyId);
    const value = storyCompanyRound(Math.max(0, Number(amount) || 0));
    if (!company || value <= 0) return { ok: false, code: 'TRADE_COMPANY_MISSING' };
    const posted = storyCompanyPost(company, 'trade.export', [
        { account: 'ASSET:CASH', amount: value },
        { account: 'REVENUE:TRADE_EXPORT', amount: -value }
    ], details);
    if (!posted.ok) return posted;
    ledger.externalMoneyInflow = storyCompanyRound(ledger.externalMoneyInflow + value);
    company.cumulative.revenue = storyCompanyRound(company.cumulative.revenue + value);
    company.cumulative.tradeRevenue = storyCompanyRound(company.cumulative.tradeRevenue + value);
    return {
        ok: true,
        company: storyCompanyClone(company),
        transaction: storyCompanyClone(posted.transaction)
    };
}

function storyCompanyReceiveStateSupport(companyId, amount, details) {
    const ledger = storyCompanyEnsure();
    const company = storyCompanyById(companyId);
    const value = storyCompanyRound(Math.max(0, Number(amount) || 0));
    if (!ledger || !company || value <= 0 || company.status === 'BANKRUPT') {
        return { ok: false, code: 'STATE_SUPPORT_COMPANY_UNAVAILABLE' };
    }
    const posted = storyCompanyPost(company, 'state.capacity_support', [
        { account: 'ASSET:CASH', amount: value },
        { account: 'REVENUE:STATE_SUPPORT', amount: -value }
    ], details);
    if (!posted.ok) return posted;
    // The state budget is a separate balanced ledger. From the company
    // ledger's boundary this is an explicitly identified external inflow,
    // never unexplained money creation.
    ledger.externalMoneyInflow = storyCompanyRound(ledger.externalMoneyInflow + value);
    company.cumulative.revenue = storyCompanyRound(company.cumulative.revenue + value);
    return {
        ok: true,
        amount: value,
        company: storyCompanyClone(company),
        transaction: storyCompanyClone(posted.transaction)
    };
}

function storyCompanyRequestLoan(companyId, amount, options) {
    const ledger = storyCompanyEnsure();
    const company = storyCompanyById(companyId);
    const value = storyCompanyRound(Math.max(0, Number(amount) || 0));
    const bank = company && ledger.banks[company.bankId];
    if (!company || !bank || value <= 0) return { ok: false, code: 'INVALID_LOAN_REQUEST' };
    if (bank.status !== 'OPERATING' || bank.reserves + 1e-6 < value) return { ok: false, code: 'BANK_LIQUIDITY_DENIED' };
    const equity = Math.max(1, -(Number(company.accounts['EQUITY:OPENING']) || 0)
        - (Number(company.accounts['EQUITY:RETAINED']) || 0));
    const debt = Math.max(0, -(Number(company.accounts['LIABILITY:DEBT']) || 0));
    const ceiling = storyCompanyRound(equity * STORY_COMPANY_POLICY.maximumDebtToEquityBps / 10000);
    if (debt + value > ceiling + 1e-6) return { ok: false, code: 'COMPANY_DEBT_CEILING', ceiling, debt };
    const companyPosted = storyCompanyPost(company, 'bank.loan', [
        { account: 'ASSET:CASH', amount: value },
        { account: 'LIABILITY:DEBT', amount: -value }
    ], { correlationId: options && options.correlationId || null, bankId: bank.id });
    if (!companyPosted.ok) return companyPosted;
    const bankPosted = storyCompanyBankPost(bank, 'loan.disbursement', {
        reserves: -value,
        loansReceivable: value,
        equity: 0
    }, { companyId: company.id, correlationId: options && options.correlationId || null });
    if (!bankPosted.ok) {
        storyCompanyPost(company, 'bank.loan.rollback', [
            { account: 'LIABILITY:DEBT', amount: value },
            { account: 'ASSET:CASH', amount: -value }
        ]);
        return bankPosted;
    }
    return {
        ok: true,
        amount: value,
        company: storyCompanyClone(company),
        bank: storyCompanyClone(bank),
        ceiling
    };
}

function storyCompanyStartInvestment(companyId, regionId, options) {
    const ledger = storyCompanyEnsure();
    const company = storyCompanyById(companyId);
    const id = storyCompanyRegionId(regionId);
    const facility = company && storyCompanyFacility(id, company.sectorId);
    if (!company || !facility || facility.ownerCompanyId !== company.id) return { ok: false, code: 'FACILITY_NOT_OWNED' };
    if (company.status !== 'OPERATING' || company.licenseStatus !== 'LICENSED') return { ok: false, code: 'COMPANY_NOT_OPERATING' };
    if (ledger.projects.some(project => project.facilityId === facility.id && project.status === 'BUILDING')) {
        return { ok: false, code: 'INVESTMENT_ALREADY_BUILDING' };
    }
    const cashCost = storyCompanyRound(Number(options && options.cashCost) || STORY_COMPANY_POLICY.investmentCashCost);
    if (Number(company.accounts['ASSET:CASH']) + 1e-6 < cashCost) return { ok: false, code: 'INVESTMENT_CASH_UNAVAILABLE' };
    const region = STORY.regionalEconomy && STORY.regionalEconomy.regions[id];
    const parts = STORY_COMPANY_POLICY.investmentParts;
    const electronics = company.sectorId === 'advanced_tech' ? STORY_COMPANY_POLICY.investmentElectronics : 0;
    if (!region || Number(region.stocks.industrial_parts) + 1e-6 < parts
        || Number(region.stocks.electronics) + 1e-6 < electronics) {
        return { ok: false, code: 'INVESTMENT_INPUTS_UNAVAILABLE', required: { industrial_parts: parts, electronics } };
    }
    const commerceInputPlans = [];
    if (typeof storyCommerceEnabled === 'function' && storyCommerceEnabled()
        && typeof storyCommerceConsumptionPlan === 'function') {
        for (const [resourceId, quantity] of Object.entries({
            industrial_parts: parts,
            electronics
        })) {
            if (quantity <= 0) continue;
            const plan = storyCommerceConsumptionPlan(id, resourceId, quantity);
            if (!plan.ok) return {
                ok: false,
                code: plan.code || 'COMMERCE_INVESTMENT_INPUTS_UNAVAILABLE',
                resourceId
            };
            commerceInputPlans.push({ resourceId, plan });
        }
    }
    const posted = storyCompanyPost(company, 'investment.reserve', [
        { account: 'ASSET:PROJECT_ESCROW', amount: cashCost },
        { account: 'ASSET:CASH', amount: -cashCost }
    ], { facilityId: facility.id });
    if (!posted.ok) return posted;
    const partsDebit = storyRegionalStockDelta(id, 'industrial_parts', -parts, {
        type: 'COMPANY_INVESTMENT_INPUT', source: company.id
    });
    const electronicsDebit = electronics > 0
        ? storyRegionalStockDelta(id, 'electronics', -electronics, {
            type: 'COMPANY_INVESTMENT_INPUT', source: company.id
        })
        : { ok: true };
    if (!partsDebit.ok || !electronicsDebit.ok) {
        if (partsDebit.ok) storyRegionalStockDelta(id, 'industrial_parts', parts, { type: 'COMPANY_INVESTMENT_ROLLBACK', source: company.id });
        if (electronicsDebit.ok && electronics > 0) storyRegionalStockDelta(id, 'electronics', electronics, { type: 'COMPANY_INVESTMENT_ROLLBACK', source: company.id });
        storyCompanyPost(company, 'investment.rollback', [
            { account: 'ASSET:CASH', amount: cashCost },
            { account: 'ASSET:PROJECT_ESCROW', amount: -cashCost }
        ]);
        return { ok: false, code: 'INVESTMENT_ATOMIC_DEBIT_FAILED' };
    }
    for (const input of commerceInputPlans) {
        const consumed = storyCommerceCommitConsumption(
            input.plan,
            'COMPANY_CAPACITY_INVESTMENT',
            company.id
        );
        if (!consumed.ok) {
            // The plans were preflighted against exact mirrors, so this path is
            // an invariant breach rather than an ordinary business rejection.
            return { ok: false, code: consumed.code || 'COMMERCE_INVESTMENT_CONSUMPTION_FAILED' };
        }
    }
    ledger.projectSequence++;
    const project = {
        id: `company-project:${ledger.projectSequence}`,
        companyId: company.id,
        facilityId: facility.id,
        regionId: id,
        sectorId: company.sectorId,
        status: 'BUILDING',
        startedAt: storyCompanyRound(STORY.clock),
        completedAt: null,
        remainingDays: STORY_COMPANY_POLICY.investmentDays,
        cashCost,
        physicalInputs: { industrial_parts: parts, electronics },
        capacityIncrease: STORY_COMPANY_POLICY.investmentCapacity
    };
    ledger.projects.push(project);
    if (ledger.projects.length > STORY_COMPANY_PROJECT_LIMIT) {
        const completed = ledger.projects.filter(row => row.status !== 'BUILDING');
        while (ledger.projects.length > STORY_COMPANY_PROJECT_LIMIT && completed.length) {
            ledger.projects.splice(ledger.projects.indexOf(completed.shift()), 1);
        }
    }
    return { ok: true, project: storyCompanyClone(project) };
}

function storyCompanySubmitApplication(spec) {
    const ledger = storyCompanyEnsure();
    spec = spec || {};
    const countryId = storyCompanyCountryId(spec.countryId);
    const sectorId = String(spec.sectorId || '');
    const capital = storyCompanyRound(Math.max(0, Number(spec.foundingCapital) || 0));
    if (!STORY_COMPANY_SECTORS.includes(sectorId)) return { ok: false, code: 'INVALID_COMPANY_SECTOR' };
    if (!String(spec.name || '').trim()) return { ok: false, code: 'COMPANY_NAME_REQUIRED' };
    ledger.applicationSequence++;
    const application = {
        id: `company-application:${ledger.applicationSequence}`,
        name: String(spec.name).trim().slice(0, 80),
        countryId,
        sectorId,
        proposedOwnerId: String(spec.proposedOwnerId || countryId),
        requestedCapital: capital,
        fundedCapital: 0,
        capitalVerified: false,
        licenseApproved: false,
        status: 'PENDING_CAPITAL_AND_LICENSE',
        submittedAt: storyCompanyRound(STORY.clock),
        registeredCompanyId: null
    };
    ledger.applications.push(application);
    return { ok: true, application: storyCompanyClone(application) };
}

function storyCompanyFundApplication(applicationId, stateOrId, amount) {
    const ledger = storyCompanyEnsure();
    const application = ledger && ledger.applications.find(row => row.id === String(applicationId));
    const value = storyCompanyRound(Math.max(0, Number(amount) || 0));
    if (!application || value <= 0 || application.status === 'REGISTERED') return { ok: false, code: 'INVALID_APPLICATION_FUNDING' };
    const paid = typeof storyBudgetDebit === 'function'
        ? storyBudgetDebit(stateOrId, value, 'company.founding_capital', {
            correlationId: application.id
        })
        : { ok: false, code: 'STATE_BUDGET_REQUIRED' };
    if (!paid.ok) return paid;
    ledger.applicationEscrow = storyCompanyRound(ledger.applicationEscrow + value);
    ledger.externalMoneyInflow = storyCompanyRound(ledger.externalMoneyInflow + value);
    application.fundedCapital = storyCompanyRound(application.fundedCapital + value);
    application.capitalVerified = application.fundedCapital + 1e-6
        >= Math.max(STORY_COMPANY_POLICY.minimumFoundingCapital, application.requestedCapital);
    application.status = application.capitalVerified
        ? (application.licenseApproved ? 'READY_TO_REGISTER' : 'PENDING_LICENSE')
        : 'PENDING_CAPITAL_AND_LICENSE';
    return { ok: true, application: storyCompanyClone(application) };
}

function storyCompanyApproveLicense(applicationId, stateOrId) {
    const ledger = storyCompanyEnsure();
    const application = ledger && ledger.applications.find(row => row.id === String(applicationId));
    if (!application || application.status === 'REGISTERED') return { ok: false, code: 'APPLICATION_NOT_PENDING' };
    if (storyCompanyCountryId(stateOrId) !== application.countryId) return { ok: false, code: 'LICENSE_AUTHORITY_MISMATCH' };
    application.licenseApproved = true;
    application.status = application.capitalVerified ? 'READY_TO_REGISTER' : 'PENDING_CAPITAL';
    return { ok: true, application: storyCompanyClone(application) };
}

function storyCompanyRegisterApplication(applicationId) {
    const ledger = storyCompanyEnsure();
    const application = ledger && ledger.applications.find(row => row.id === String(applicationId));
    if (!application || !application.capitalVerified || !application.licenseApproved) {
        return { ok: false, code: 'APPLICATION_REQUIREMENTS_INCOMPLETE' };
    }
    const countryNo = Number(application.countryId.split(':')[1]);
    const serial = ledger.applicationSequence;
    const id = `company:${countryNo}:registered:${serial}`;
    if (ledger.companies[id]) return { ok: false, code: 'COMPANY_ID_COLLISION' };
    const capital = storyCompanyRound(application.fundedCapital);
    ledger.applicationEscrow = storyCompanyRound(ledger.applicationEscrow - capital);
    ledger.companies[id] = {
        id,
        name: application.name,
        countryId: application.countryId,
        sectorId: application.sectorId,
        legalStatus: 'REGISTERED',
        licenseStatus: 'LICENSED',
        status: 'OPERATING',
        foundedAt: storyCompanyRound(STORY.clock),
        owners: [{ ownerType: 'FOUNDER', ownerId: application.proposedOwnerId, shareBps: 10000 }],
        accounts: storyCompanyAccountBase(capital),
        facilityIds: [],
        warehouseIds: [],
        bankId: `bank:${countryNo}:0`,
        annualInterestBps: STORY_COMPANY_POLICY.loanInterestBps,
        arrears: 0,
        distressedDays: 0,
        cumulative: { revenue: 0, expense: 0, interest: 0, investment: 0, tradeRevenue: 0, productionCycles: 0 },
        lobbyInfluence: 0,
        lastResult: null
    };
    application.status = 'REGISTERED';
    application.registeredCompanyId = id;
    return {
        ok: true,
        company: storyCompanyClone(ledger.companies[id]),
        application: storyCompanyClone(application)
    };
}

function storyCompanyLobby(companyId, amount, options) {
    const ledger = storyCompanyEnsure();
    const company = storyCompanyById(companyId);
    const value = storyCompanyRound(Math.max(0, Number(amount) || 0));
    if (!company || value <= 0 || company.status !== 'OPERATING') {
        return { ok: false, code: 'INVALID_LOBBY_REQUEST' };
    }
    if (Number(company.accounts['ASSET:CASH']) + 1e-6 < value) {
        return { ok: false, code: 'LOBBY_CASH_UNAVAILABLE' };
    }
    const posted = storyCompanyPost(company, 'political.lobbying', [
        { account: 'EXPENSE:LOBBYING', amount: value },
        { account: 'ASSET:CASH', amount: -value }
    ], {
        target: String(options && options.target || 'ECONOMIC_POLICY'),
        disclosed: options && options.disclosed !== false
    });
    if (!posted.ok) return posted;
    ledger.marketClearingCash = storyCompanyRound(ledger.marketClearingCash + value);
    company.cumulative.expense = storyCompanyRound(company.cumulative.expense + value);
    company.lobbyInfluence = storyCompanyRound(
        Math.min(100, (Number(company.lobbyInfluence) || 0) + value * 0.08)
    );
    return {
        ok: true,
        companyId: company.id,
        amount: value,
        influence: company.lobbyInfluence
    };
}

function storyCompanyTick(dtSec) {
    const ledger = storyCompanyEnsure();
    if (!ledger) return { disabled: true };
    const yearSeconds = typeof STORY_CALENDAR !== 'undefined'
        ? Number(STORY_CALENDAR.secondsPerYear) || 120
        : 120;
    const worldDays = storyCompanyRound(Math.max(0, Number(dtSec) || 0) * 365 / yearSeconds);
    if (worldDays <= 0) return { disabled: false, processed: 0 };
    ledger.tickSequence++;
    ledger.lastTickAt = storyCompanyRound(STORY.clock);
    let completedProjects = 0;
    let bankruptcies = 0;
    for (const project of ledger.projects) {
        if (project.status !== 'BUILDING') continue;
        project.remainingDays = storyCompanyRound(Math.max(0, project.remainingDays - worldDays));
        if (project.remainingDays > 0) continue;
        const company = ledger.companies[project.companyId];
        const facility = ledger.facilities[project.facilityId];
        const region = STORY.regionalEconomy && STORY.regionalEconomy.regions[project.regionId];
        if (!company || !facility || !region) {
            project.status = 'CANCELLED';
            continue;
        }
        const cost = Math.max(0, Number(project.cashCost) || 0);
        storyCompanyPost(company, 'investment.complete', [
            { account: 'EXPENSE:CAPACITY_INVESTMENT', amount: cost },
            { account: 'ASSET:PROJECT_ESCROW', amount: -cost }
        ], { projectId: project.id, facilityId: facility.id });
        ledger.marketClearingCash = storyCompanyRound(ledger.marketClearingCash + cost);
        facility.capacity = storyCompanyRound(facility.capacity + project.capacityIncrease);
        region.sectorCapacity[project.sectorId] = storyCompanyRound(
            (Number(region.sectorCapacity[project.sectorId]) || 0) + project.capacityIncrease
        );
        company.cumulative.expense = storyCompanyRound(company.cumulative.expense + cost);
        company.cumulative.investment = storyCompanyRound(company.cumulative.investment + cost);
        project.status = 'COMPLETED';
        project.completedAt = storyCompanyRound(STORY.clock);
        completedProjects++;
    }
    for (const company of Object.values(ledger.companies)) {
        if (company.status === 'BANKRUPT') continue;
        const debt = Math.max(0, -(Number(company.accounts['LIABILITY:DEBT']) || 0));
        if (debt > 0) {
            const interest = storyCompanyRound(debt * company.annualInterestBps / 10000 * worldDays / 365);
            const bank = ledger.banks[company.bankId];
            if (interest > 0 && Number(company.accounts['ASSET:CASH']) + 1e-6 >= interest && bank) {
                storyCompanyPost(company, 'bank.interest', [
                    { account: 'EXPENSE:INTEREST', amount: interest },
                    { account: 'ASSET:CASH', amount: -interest }
                ], { bankId: bank.id });
                storyCompanyBankPost(bank, 'loan.interest', { reserves: interest, loansReceivable: 0, equity: interest }, {
                    companyId: company.id
                });
                company.cumulative.expense = storyCompanyRound(company.cumulative.expense + interest);
                company.cumulative.interest = storyCompanyRound(company.cumulative.interest + interest);
                company.arrears = Math.max(0, storyCompanyRound(company.arrears - interest));
            } else if (interest > 0) {
                company.accounts['LIABILITY:DEBT'] = storyCompanyRound(company.accounts['LIABILITY:DEBT'] - interest);
                if (bank) bank.loansReceivable = storyCompanyRound(bank.loansReceivable + interest);
                company.arrears = storyCompanyRound(company.arrears + interest);
            }
        }
        const noCash = Number(company.accounts['ASSET:CASH']) < 0.01;
        const distressed = noCash && (debt > 0 || company.arrears > 0);
        company.distressedDays = storyCompanyRound(Math.max(0, company.distressedDays + (distressed ? worldDays : -worldDays * 0.5)));
        if (company.distressedDays >= STORY_COMPANY_POLICY.bankruptcyDays) {
            company.status = 'BANKRUPT';
            company.legalStatus = 'DISSOLVED';
            company.licenseStatus = 'REVOKED';
            for (const facilityId of company.facilityIds) {
                const facility = ledger.facilities[facilityId];
                if (facility) facility.status = 'RECEIVERSHIP';
            }
            bankruptcies++;
        } else if (company.distressedDays >= STORY_COMPANY_POLICY.insolvencyDays) {
            company.status = 'INSOLVENT';
        } else if (company.status === 'INSOLVENT' && !distressed) {
            company.status = 'OPERATING';
        }
    }
    storyCompanySyncRegionalCapital(true);
    return {
        disabled: false,
        tickSequence: ledger.tickSequence,
        worldDays,
        completedProjects,
        bankruptcies
    };
}

function storyCompanyRegionView(regionId) {
    const ledger = storyCompanyEnsure();
    if (!ledger) return null;
    const id = storyCompanyRegionId(regionId);
    const facilities = Object.values(ledger.facilities)
        .filter(row => row.regionId === id)
        .map(row => Object.assign({}, storyCompanyClone(row), {
            company: storyCompanyClone(ledger.companies[row.ownerCompanyId])
        }));
    const warehouses = Object.values(ledger.warehouses)
        .filter(row => row.regionId === id)
        .map(storyCompanyClone);
    const projects = ledger.projects.filter(row => row.regionId === id).map(storyCompanyClone);
    return { regionId: id, facilities, warehouses, projects };
}

function storyCompanyWarehouseOccupancy(warehouseId, resourceId) {
    const ledger = storyCompanyEnsure();
    const warehouse = ledger && ledger.warehouses[String(warehouseId || '')];
    const resource = String(resourceId || '');
    if (!warehouse) return { ok: false, code: 'WAREHOUSE_NOT_FOUND' };
    if (!STORY_RESOURCE_IDS.includes(resource)) return { ok: false, code: 'RESOURCE_NOT_FOUND' };
    const regional = STORY.regionalEconomy && STORY.regionalEconomy.regions
        && STORY.regionalEconomy.regions[warehouse.regionId];
    if (!regional) return { ok: false, code: 'REGIONAL_STOCK_NOT_FOUND' };
    const capacity = Math.max(0, Number(warehouse.capacityByResource && warehouse.capacityByResource[resource]) || 0);
    // Her bölgede tek genel depo vardır; bölgesel stok bu deponun teslim edilmiş
    // fiziksel doluluğudur. Yoldaki sevkiyat henüz stokta değildir fakat hedef
    // kapasiteyi şimdiden taahhüt eder. Açık fakat sevk edilmemiş sipariş fiziksel
    // mal olmadığı için burada sayılmaz.
    const stored = Math.max(0, Number(regional.stocks && regional.stocks[resource]) || 0);
    const incomingShipments = ((STORY.tradeLogistics && STORY.tradeLogistics.shipments) || [])
        .filter(row => row.targetRegionId === warehouse.regionId && row.resourceId === resource
            && ['IN_TRANSIT', 'HELD'].includes(row.status));
    const incoming = incomingShipments.reduce((sum, row) => sum + Math.max(0, Number(row.quantity) || 0), 0);
    const committed = storyCompanyRound(stored + incoming);
    const available = storyCompanyRound(Math.max(0, capacity - committed));
    return {
        ok: true,
        code: committed > capacity + 1e-6 ? 'WAREHOUSE_OVERBOOKED' : 'WAREHOUSE_OCCUPANCY_VERIFIED',
        warehouseId: warehouse.id,
        regionId: warehouse.regionId,
        resourceId: resource,
        capacity: storyCompanyRound(capacity),
        stored: storyCompanyRound(stored),
        incoming: storyCompanyRound(incoming),
        committed,
        available,
        utilizationBps: capacity > 0 ? Math.round(Math.min(2, committed / capacity) * 10000) : 20000,
        incomingShipmentIds: incomingShipments.map(row => row.id).sort(),
        overbooked: committed > capacity + 1e-6
    };
}

function storyCompanyPayContractPenalty(fromCompanyId, toCompanyId, amount, details) {
    const ledger = storyCompanyEnsure();
    const from = ledger && ledger.companies[String(fromCompanyId || '')];
    const to = ledger && ledger.companies[String(toCompanyId || '')];
    const value = storyCompanyRound(Math.max(0, Number(amount) || 0));
    const correlationId = String(details && details.correlationId || '').trim();
    if (!from || !to || from.id === to.id || value <= 0 || !correlationId) {
        return { ok: false, code: 'INVALID_CONTRACT_PENALTY_TRANSFER' };
    }
    const existingDebit = ledger.transactions.find(row => row.source === 'contract.penalty.debit'
        && row.correlationId === correlationId);
    const existingCredit = ledger.transactions.find(row => row.source === 'contract.penalty.credit'
        && row.correlationId === correlationId);
    const existingRollback = ledger.transactions.find(row => row.source === 'contract.penalty.rollback'
        && row.correlationId === correlationId);
    if (existingDebit && existingCredit) {
        const booked = Math.max(0, -Number((existingDebit.postings || [])
            .find(row => row.account === 'ASSET:CASH')?.amount || 0));
        return Math.abs(booked - value) <= 1e-6
            ? { ok: true, code: 'CONTRACT_PENALTY_ALREADY_PAID', duplicate: true,
                amount: value, debitTransaction: storyCompanyClone(existingDebit),
                creditTransaction: storyCompanyClone(existingCredit) }
            : { ok: false, code: 'CONTRACT_PENALTY_IDEMPOTENCY_CONFLICT' };
    }
    if (existingDebit && !existingCredit && !existingRollback) {
        return { ok: false, code: 'CONTRACT_PENALTY_TRANSFER_INCOMPLETE' };
    }
    if (Number(from.accounts && from.accounts['ASSET:CASH']) + 1e-6 < value) {
        return { ok: false, code: 'CONTRACT_PENALTY_CASH_UNAVAILABLE',
            available: storyCompanyRound(from.accounts && from.accounts['ASSET:CASH']), required: value };
    }
    const meta = Object.assign({}, storyCompanyClone(details || {}), { correlationId });
    const debited = storyCompanyPost(from, 'contract.penalty.debit', [
        { account: 'EXPENSE:CONTRACT_PENALTY', amount: value },
        { account: 'ASSET:CASH', amount: -value }
    ], meta);
    if (!debited.ok) return debited;
    const credited = storyCompanyPost(to, 'contract.penalty.credit', [
        { account: 'ASSET:CASH', amount: value },
        { account: 'REVENUE:CONTRACT_PENALTY', amount: -value }
    ], meta);
    if (!credited.ok) {
        storyCompanyPost(from, 'contract.penalty.rollback', [
            { account: 'ASSET:CASH', amount: value },
            { account: 'EXPENSE:CONTRACT_PENALTY', amount: -value }
        ], Object.assign({}, meta, { failedCreditCode: credited.code || 'UNKNOWN' }));
        return { ok: false, code: 'CONTRACT_PENALTY_CREDIT_FAILED', credit: credited };
    }
    return { ok: true, code: 'CONTRACT_PENALTY_PAID', duplicate: false, amount: value,
        fromCompanyId: from.id, toCompanyId: to.id,
        debitTransaction: debited.transaction, creditTransaction: credited.transaction };
}

function storyCompanyCountryView(countryId) {
    const ledger = storyCompanyEnsure();
    if (!ledger) return null;
    const id = storyCompanyCountryId(countryId);
    const companies = Object.values(ledger.companies)
        .filter(row => row.countryId === id)
        .map(row => ({
            id: row.id,
            name: row.name,
            countryId: row.countryId,
            sectorId: row.sectorId,
            legalStatus: row.legalStatus,
            licenseStatus: row.licenseStatus,
            status: row.status,
            cash: storyCompanyRound(row.accounts['ASSET:CASH']),
            debt: storyCompanyRound(-row.accounts['LIABILITY:DEBT']),
            facilityCount: row.facilityIds.length,
            warehouseCount: row.warehouseIds.length,
            owners: storyCompanyClone(row.owners),
            cumulative: storyCompanyClone(row.cumulative),
            lobbyInfluence: storyCompanyRound(row.lobbyInfluence),
            lastResult: storyCompanyClone(row.lastResult)
        }));
    const bank = Object.values(ledger.banks).find(row => row.countryId === id);
    return {
        countryId: id,
        companies,
        bank: bank ? storyCompanyClone(bank) : null,
        totals: {
            cash: storyCompanyRound(companies.reduce((sum, row) => sum + row.cash, 0)),
            debt: storyCompanyRound(companies.reduce((sum, row) => sum + row.debt, 0)),
            operating: companies.filter(row => row.status === 'OPERATING').length,
            insolvent: companies.filter(row => row.status === 'INSOLVENT').length,
            bankrupt: companies.filter(row => row.status === 'BANKRUPT').length
        }
    };
}

function storyCompanySummary() {
    const ledger = storyCompanyEnsure();
    if (!ledger) return {
        schemaVersion: STORY_COMPANY_SCHEMA_VERSION,
        adapterVersion: STORY_COMPANY_ADAPTER_VERSION,
        disabled: true
    };
    const companies = Object.values(ledger.companies);
    const banks = Object.values(ledger.banks);
    const projectCountsBySectorStatus = {};
    for (const project of ledger.projects) {
        const sector = String(project.sectorId || 'unknown');
        const status = String(project.status || 'UNKNOWN');
        if (!projectCountsBySectorStatus[sector]) projectCountsBySectorStatus[sector] = {};
        projectCountsBySectorStatus[sector][status] =
            (projectCountsBySectorStatus[sector][status] || 0) + 1;
    }
    const capacityBySector = {};
    for (const facility of Object.values(ledger.facilities)) {
        const sector = String(facility.sectorId || 'unknown');
        capacityBySector[sector] = storyCompanyRound(
            (capacityBySector[sector] || 0) + Math.max(0, Number(facility.capacity) || 0)
        );
    }
    return {
        schemaVersion: ledger.schemaVersion,
        adapterVersion: ledger.adapterVersion,
        policyHash: ledger.policyHash,
        disabled: false,
        tickSequence: ledger.tickSequence,
        companyCount: companies.length,
        bankCount: banks.length,
        facilityCount: Object.keys(ledger.facilities).length,
        warehouseCount: Object.keys(ledger.warehouses).length,
        activeProjects: ledger.projects.filter(row => row.status === 'BUILDING').length,
        completedProjects: ledger.projects.filter(row => row.status === 'COMPLETED').length,
        projectCountsBySectorStatus,
        capacityBySector,
        totalCompanyCash: storyCompanyRound(companies.reduce((sum, row) => sum + Math.max(0, Number(row.accounts['ASSET:CASH']) || 0), 0)),
        totalCompanyDebt: storyCompanyRound(companies.reduce((sum, row) => sum + Math.max(0, -(Number(row.accounts['LIABILITY:DEBT']) || 0)), 0)),
        totalBankReserves: storyCompanyRound(banks.reduce((sum, row) => sum + Math.max(0, Number(row.reserves) || 0), 0)),
        marketClearingCash: storyCompanyRound(ledger.marketClearingCash),
        insolventCompanies: companies.filter(row => row.status === 'INSOLVENT').map(row => row.id),
        bankruptCompanies: companies.filter(row => row.status === 'BANKRUPT').map(row => row.id),
        diagnostics: storyCompanyClone(ledger.diagnostics)
    };
}
