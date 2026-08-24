// ============================================================================
//  BÖLGESEL STOK, TÜKETİM VE KITLIK DEFTERİ — Faz 17
//  --------------------------------------------------------------------------
//  Sekiz kanonik kaynağın ilk gerçek bölgesel durum sahibidir. Eski
//  oil/manpower/points alanları bu deftere taşınmaz. Üretim teklifleri atomik
//  uygulanır; tüketiciler öncelik ve güvenli stok sınırıyla paylaştırılır.
// ============================================================================

const STORY_REGIONAL_ECONOMY_SCHEMA_VERSION = 1;
const STORY_REGIONAL_ECONOMY_ADAPTER_VERSION = 'story-regional-stock-ledger-1';
const STORY_REGIONAL_ECONOMY_SHORTAGE_LIMIT = 2000;
const STORY_REGIONAL_ECONOMY_TRANSACTION_LIMIT = 300;
const STORY_REGIONAL_ECONOMY_RESOURCE_HASH = STORY_RESOURCE_CATALOG_HASH;
const STORY_REGIONAL_ECONOMY_PRODUCTION_HASH = STORY_PRODUCTION_CATALOG_HASH;

const STORY_REGIONAL_CONSUMER_POLICY = Object.freeze([
    Object.freeze({ id: 'HOUSEHOLDS', priority: 100, minFillBps: 8500, mayUseReserve: true }),
    Object.freeze({ id: 'MILITARY', priority: 95, minFillBps: 8000, mayUseReserve: true }),
    Object.freeze({ id: 'STATE', priority: 85, minFillBps: 7000, mayUseReserve: false }),
    Object.freeze({ id: 'COMPANIES', priority: 70, minFillBps: 6000, mayUseReserve: false })
]);

const STORY_REGIONAL_SAFE_DAYS = Object.freeze({
    food: 30,
    energy: 7,
    raw_materials: 5,
    industrial_parts: 14,
    electronics: 30,
    military_supplies: 30,
    labor: 0,
    capital: 14
});

const STORY_REGIONAL_POLICY_HASH = storyProductionHash({
    schemaVersion: STORY_REGIONAL_ECONOMY_SCHEMA_VERSION,
    adapterVersion: STORY_REGIONAL_ECONOMY_ADAPTER_VERSION,
    resourceCatalogHash: STORY_REGIONAL_ECONOMY_RESOURCE_HASH,
    productionCatalogHash: STORY_REGIONAL_ECONOMY_PRODUCTION_HASH,
    consumers: STORY_REGIONAL_CONSUMER_POLICY,
    safeDays: STORY_REGIONAL_SAFE_DAYS
});

function storyRegionalEnabled() {
    return (typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('economy.regionalStocks'))
        && (typeof storyResourceEnabled !== 'function' || storyResourceEnabled())
        && (typeof storyProductionEnabled !== 'function' || storyProductionEnabled());
}

function storyRegionalClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyRegionalRound(value, digits) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    const factor = 10 ** (digits == null ? 6 : digits);
    return Math.round(number * factor) / factor;
}

function storyRegionalResourceMap(value) {
    const out = {};
    for (const id of STORY_RESOURCE_IDS) out[id] = storyRegionalRound(value);
    return out;
}

function storyRegionalAddToMap(map, resourceId, amount) {
    map[resourceId] = storyRegionalRound((Number(map[resourceId]) || 0) + (Number(amount) || 0));
}

function storyRegionalPopulation(node) {
    if (Number.isFinite(Number(node && node.pop)) && Number(node.pop) > 0) return Number(node.pop);
    return 10 + Math.max(0, (Number(node && node.level) || 1) - 1) * 28;
}

function storyRegionalDemandSpecs(node, worldDays) {
    const days = Math.max(0, Number(worldDays) || 0);
    const population = storyRegionalPopulation(node);
    const level = Math.max(1, Number(node && node.level) || 1);
    const facilities = typeof prodInfraLevel === 'function'
        ? Math.max(0, prodInfraLevel(node))                       // ALTI BİNA: tesis toplamı
        : Math.max(0, Number(node && node.fac) || 0) + Math.max(0, Number(node && node.bar) || 0);
    const military = Math.max(0, Number(node && node.garrison) || 0);
    const settledCommerce = typeof storyCommerceEnabled === 'function'
        && storyCommerceEnabled();
    const countryId = `country:${Number(node && node.owner)}`;
    const rows = [];
    const add = (consumerType, resourceId, perDay, reason, payer) => {
        const policy = STORY_REGIONAL_CONSUMER_POLICY.find(item => item.id === consumerType);
        const quantity = storyRegionalRound(Math.max(0, perDay) * days);
        if (!policy || quantity <= 0) return;
        const row = {
            id: `demand:${Number(node.id)}:${consumerType}:${resourceId}`
                + (payer && payer.buyerCompanyId ? `:${payer.buyerCompanyId}` : ''),
            consumerType,
            resourceId,
            quantity,
            priority: policy.priority,
            minFillBps: policy.minFillBps,
            mayUseReserve: policy.mayUseReserve,
            reason
        };
        if (payer) Object.assign(row, payer);
        rows.push(row);
    };
    const householdPayer = settledCommerce
        ? { payerType: 'HOUSEHOLDS', payerId: `households:region:${Number(node.id)}` }
        : null;
    const statePayer = settledCommerce
        ? { payerType: 'STATE', payerId: countryId }
        : null;
    add('HOUSEHOLDS', 'food', population * 0.04, 'BASIC_NUTRITION', householdPayer);
    add('HOUSEHOLDS', 'energy', population * 0.08, 'HOUSEHOLD_ENERGY', householdPayer);
    if (typeof storyCompanyEnabled !== 'function' || !storyCompanyEnabled()) {
        add('HOUSEHOLDS', 'capital', population * 0.02, 'HOUSEHOLD_LIQUIDITY');
    }
    add('MILITARY', 'food', military * 0.10, 'GARRISON_RATIONS', statePayer);
    add('MILITARY', 'military_supplies', military * 0.08, 'READINESS_REPLENISHMENT', statePayer);
    add('MILITARY', 'energy', military * 0.05, 'MILITARY_ENERGY', statePayer);
    add('STATE', 'energy', level * 0.30, 'PUBLIC_SERVICES', statePayer);
    if (typeof storyCompanyEnabled !== 'function' || !storyCompanyEnabled()) {
        add('STATE', 'capital', level * 0.20, 'ADMINISTRATION');
    }
    let liveFacilities = [];
    if (settledCommerce && STORY.companyEconomy) {
        const ce = STORY.companyEconomy;
        if (!(ce._liveFacilitiesByRegion instanceof Map) || ce._liveFacilitiesRevision !== Object.keys(ce.facilities || {}).length) {
            const map = new Map();
            for (const f of Object.values(ce.facilities || {})) {
                if (f && f.status === 'OPERATING' && ce.companies && ce.companies[f.ownerCompanyId]) {
                    let list = map.get(f.regionId);
                    if (!list) { list = []; map.set(f.regionId, list); }
                    list.push(f);
                }
            }
            ce._liveFacilitiesByRegion = map;
            ce._liveFacilitiesRevision = Object.keys(ce.facilities || {}).length;
        }
        liveFacilities = ce._liveFacilitiesByRegion.get(`region:${Number(node.id)}`) || [];
    }
    // In the settled economy production recipes already buy their real power,
    // maintenance parts and electronics from their owners. Adding these
    // legacy facility proxies again would double-charge the same operation and
    // consume the same physical inputs twice.
    if (!liveFacilities.length) {
        add('COMPANIES', 'energy', facilities * 0.60, 'FACILITY_OPERATION');
        add('COMPANIES', 'industrial_parts', facilities * 0.05, 'MAINTENANCE');
        add('COMPANIES', 'electronics', facilities * 0.01, 'TECH_MAINTENANCE');
    }
    if (typeof storyCompanyEnabled !== 'function' || !storyCompanyEnabled()) {
        add('COMPANIES', 'capital', facilities * 0.15, 'WORKING_CAPITAL');
    }
    return rows.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id, 'en'));
}

function storyRegionalInitialSafeTargets(node) {
    const daily = storyRegionalDemandSpecs(node, 1);
    const targets = storyRegionalResourceMap(0);
    for (const demand of daily) {
        storyRegionalAddToMap(
            targets,
            demand.resourceId,
            demand.quantity * (STORY_REGIONAL_SAFE_DAYS[demand.resourceId] || 0)
        );
    }
    targets.raw_materials = storyRegionalRound(Math.max(targets.raw_materials, 5));
    targets.industrial_parts = storyRegionalRound(Math.max(targets.industrial_parts, 3));
    targets.electronics = storyRegionalRound(Math.max(targets.electronics, 1));
    return targets;
}

function storyRegionalInitialRegion(node) {
    const safeTargets = storyRegionalInitialSafeTargets(node);
    const level = Math.max(1, Number(node.level) || 1);
    const factory = Math.max(0, Number(node.fac) || 0);
    const barracks = Math.max(0, Number(node.bar) || 0);
    const cityYield = Math.max(0, Number(node.cities) || 0);
    const oilDeposit = Math.max(0, Number(node.oil) || 0);
    const mine = node.mine ? 1 : 0;
    /* ── AŞAMA 1: `pts` yatağı artık ekonomiye giriyor ────────────────────────
       Ölçüm (152 düğüm): haritadaki üç yataktan `oil` enerjiyi, `mine` çıkarmayı
       besliyordu; `pts` HİÇBİR sektöre bağlı değildi — 20 şehirdeki 32 birim
       yalnız eski cüzdanın soyut "puan" gelirini üretiyordu.

       `pts` = UZMAN İŞ GÜCÜ / İLERİ TEKNOLOJİ havzası. `advanced_tech`
       kapasitesini ve açılış elektronik stokunu besler; `electronics` zincirin
       en sağlam ucu (stoku sıfır olan yalnız 6 bölge), yani coğrafi çeşitlilik
       oraya eklenince denge bozulmuyor.

       ÇİFT SAYIM YOK: eski cüzdanın `points` geliri (Story.js) değişmedi,
       burada yalnız bölgesel bağış eklendi. `pts = 0` iken formül eskisiyle
       BİREBİR aynı sonucu verir — regresyon kapısı bunu ölçer. */
    const techDeposit = Math.max(0, Number(node.pts) || 0);
    const bootstrapCalibration = typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('economy.bootstrapPlanning');
    const extractionCapacity = mine
        ? storyRegionalRound(bootstrapCalibration
            ? 7.5 + level * 0.5
            : 0.75 + level * 0.1)
        : 0;
    const stocks = storyRegionalResourceMap(0);
    for (const id of STORY_RESOURCE_IDS) stocks[id] = storyRegionalRound((safeTargets[id] || 0) * 2);
    stocks.food = storyRegionalRound(stocks.food + 10 + level * 4);
    stocks.energy = storyRegionalRound(stocks.energy + 15 + oilDeposit * 15);
    stocks.raw_materials = storyRegionalRound(stocks.raw_materials + 15 + mine * 50);
    stocks.industrial_parts = storyRegionalRound(stocks.industrial_parts + 5 + factory * 8);
    stocks.electronics = storyRegionalRound(stocks.electronics + 1 + factory * 1.5 + techDeposit * 3);
    stocks.military_supplies = storyRegionalRound(stocks.military_supplies + 3 + barracks * 3);
    stocks.labor = 0;
    stocks.capital = storyRegionalRound(stocks.capital + 20 + level * 10 + factory * 5);
    return {
        regionId: `region:${Number(node.id)}`,
        stocks,
        safeTargets,
        endowments: {
            arable_capacity: storyRegionalRound(1.25 + cityYield * 0.75 + level * 0.25),
            energy_potential: storyRegionalRound(10 + oilDeposit * 30 + factory * 2),
            // Legacy reserve/capacity units exhausted the complete eight-state
            // world in a few simulated months. The stabilized path sizes a
            // proven reserve to roughly 33 years at installed mine capacity;
            // it remains finite and every extracted unit is still debited.
            mineral_reserve: storyRegionalRound(bootstrapCalibration && mine
                ? 75 + extractionCapacity * 1.25 * 12000
                : 75 + mine * 500)
        },
        sectorCapacity: {
            agriculture: storyRegionalRound(0.5 + cityYield * 0.25 + level * 0.15),
            energy: storyRegionalRound(oilDeposit > 0 || factory > 0 ? 0.25 + oilDeposit * 0.5 + factory * 0.1 : 0),
            extraction: extractionCapacity,
            civil_industry: storyRegionalRound(factory > 0 ? factory * 0.45 : 0),
            // `pts` yatağı sanayi ŞARTINI da kaldırır: uzman havzası olan bir
            // şehir fabrikası olmasa da ileri teknoloji üretebilir. pts=0 iken
            // ifade eski hâline birebir indirgenir.
            advanced_tech: storyRegionalRound(
                (factory >= 2 || level >= 3 ? factory * 0.18 + 0.1 : 0) + techDeposit * 0.22),
            defense_industry: storyRegionalRound(factory > 0 && barracks > 0 ? factory * 0.2 + barracks * 0.1 : 0)
        },
        lastTick: null
    };
}

function storyRegionalTotalsBase() {
    return {
        produced: storyRegionalResourceMap(0),
        consumed: storyRegionalResourceMap(0),
        decayed: storyRegionalResourceMap(0),
        externalInflow: storyRegionalResourceMap(0),
        cohortLaborSupply: storyRegionalResourceMap(0),
        financialBridgeInflow: storyRegionalResourceMap(0),
        financialBridgeOutflow: storyRegionalResourceMap(0),
        financialOperatingUse: storyRegionalResourceMap(0)
    };
}

function storyRegionalLedgerCreate(options) {
    options = options || {};
    const regions = {};
    for (const node of (STORY.nodes || [])) {
        const region = storyRegionalInitialRegion(node);
        regions[region.regionId] = region;
    }
    return {
        schemaVersion: STORY_REGIONAL_ECONOMY_SCHEMA_VERSION,
        adapterVersion: STORY_REGIONAL_ECONOMY_ADAPTER_VERSION,
        policyHash: STORY_REGIONAL_POLICY_HASH,
        resourceCatalogHash: STORY_REGIONAL_ECONOMY_RESOURCE_HASH,
        productionCatalogHash: STORY_REGIONAL_ECONOMY_PRODUCTION_HASH,
        topologyHash: STORY.regionModel ? STORY.regionModel.topologyHash : null,
        tickSequence: 0,
        transactionSequence: 0,
        lastTickAt: 0,
        regions,
        shortages: [],
        transactions: [],
        totals: storyRegionalTotalsBase(),
        diagnostics: {
            backfilled: !!options.backfilled,
            restoredFromInvalidLedger: !!options.restoredFromInvalidLedger,
            issues: Array.isArray(options.issues) ? storyRegionalClone(options.issues).slice(0, 50) : [],
            warnings: Array.isArray(options.warnings) ? options.warnings.map(String).slice(0, 30) : [],
            authoritative: 'regional-canonical',
            legacyMaterialized: false,
            liveStockSystem: true
        }
    };
}

function storyRegionalClearNodeMirrors() {
    for (const node of (STORY.nodes || [])) delete node.stocks;
}

function storyRegionalSyncNodeMirrors() {
    const ledger = STORY.regionalEconomy;
    if (!ledger || !ledger.regions) {
        storyRegionalClearNodeMirrors();
        return;
    }
    for (const node of (STORY.nodes || [])) {
        const region = ledger.regions[`region:${Number(node.id)}`];
        if (region) node.stocks = storyRegionalClone(region.stocks);
        else delete node.stocks;
    }
}

function storyRegionalValidate(ledger, options) {
    options = options || {};
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) {
        return { ok: false, issues: [{ code: 'REGIONAL_LEDGER_REQUIRED', path: '$', message: 'Bölgesel stok defteri nesnesi zorunlu.' }] };
    }
    if (ledger.schemaVersion !== STORY_REGIONAL_ECONOMY_SCHEMA_VERSION) add('REGIONAL_SCHEMA_VERSION', '$.schemaVersion', 'Bölgesel stok şema sürümü uyuşmuyor.');
    if (ledger.adapterVersion !== STORY_REGIONAL_ECONOMY_ADAPTER_VERSION) add('REGIONAL_ADAPTER_VERSION', '$.adapterVersion', 'Bölgesel stok adaptörü uyuşmuyor.');
    if (ledger.policyHash !== STORY_REGIONAL_POLICY_HASH) add('REGIONAL_POLICY_HASH', '$.policyHash', 'Bölgesel stok politikası uyuşmuyor.');
    if (ledger.resourceCatalogHash !== STORY_REGIONAL_ECONOMY_RESOURCE_HASH) add('REGIONAL_RESOURCE_LINK', '$.resourceCatalogHash', 'Bölgesel stok yanlış kaynak kataloğuna bağlı.');
    if (ledger.productionCatalogHash !== STORY_REGIONAL_ECONOMY_PRODUCTION_HASH) add('REGIONAL_PRODUCTION_LINK', '$.productionCatalogHash', 'Bölgesel stok yanlış üretim kataloğuna bağlı.');
    const topologyHash = STORY.regionModel ? STORY.regionModel.topologyHash : null;
    if (ledger.topologyHash !== topologyHash) add('REGIONAL_TOPOLOGY_HASH', '$.topologyHash', 'Bölgesel stok yanlış topolojiye bağlı.');
    if (!ledger.regions || typeof ledger.regions !== 'object' || Array.isArray(ledger.regions)) {
        add('REGIONAL_REGIONS_REQUIRED', '$.regions', 'Bölge stok kayıtları zorunlu.');
        return { ok: false, issues };
    }
    const expectedIds = (STORY.nodes || []).map(node => `region:${Number(node.id)}`).sort();
    const actualIds = Object.keys(ledger.regions).sort();
    if (storyProductionStable(expectedIds) !== storyProductionStable(actualIds)) {
        add('REGIONAL_REGION_SET', '$.regions', 'Stok defteri güncel bölge kümesiyle bire bir uyuşmalı.');
    }
    for (const regionId of actualIds) {
        const region = ledger.regions[regionId];
        const at = `$.regions.${regionId}`;
        if (!region || region.regionId !== regionId) {
            add('REGIONAL_REGION_ID', `${at}.regionId`, 'Bölgesel stok kimliği anahtarla uyuşmalı.');
            continue;
        }
        for (const field of ['stocks', 'safeTargets']) {
            if (!region[field] || typeof region[field] !== 'object') {
                add('REGIONAL_RESOURCE_MAP', `${at}.${field}`, `${field} kaynak haritası zorunlu.`);
                continue;
            }
            for (const resourceId of STORY_RESOURCE_IDS) {
                const value = Number(region[field][resourceId]);
                if (!Number.isFinite(value) || value < 0) add('REGIONAL_NEGATIVE_OR_INVALID', `${at}.${field}.${resourceId}`, 'Stok ve hedefler sonlu, negatif olmayan sayı olmalı.');
            }
        }
        for (const key of ['arable_capacity', 'energy_potential', 'mineral_reserve']) {
            const value = Number(region.endowments && region.endowments[key]);
            if (!Number.isFinite(value) || value < 0) add('REGIONAL_ENDOWMENT', `${at}.endowments.${key}`, 'Doğal kapasite sonlu ve negatif olmayan sayı olmalı.');
        }
        for (const sectorId of STORY_PRODUCTION_SECTOR_IDS) {
            const value = Number(region.sectorCapacity && region.sectorCapacity[sectorId]);
            if (!Number.isFinite(value) || value < 0) add('REGIONAL_SECTOR_CAPACITY', `${at}.sectorCapacity.${sectorId}`, 'Sektör kapasitesi sonlu ve negatif olmayan sayı olmalı.');
        }
        if (options.checkNodeMirrors) {
            const nodeId = Number(regionId.split(':')[1]);
            const node = STORY.nodes && STORY.nodes[nodeId];
            if (!node || storyProductionStable(node.stocks || {}) !== storyProductionStable(region.stocks)) {
                add('REGIONAL_NODE_MIRROR', `${at}.stocks`, 'Bölge kapsül aynası kanonik stokla uyuşmuyor.');
            }
        }
    }
    if (!Number.isInteger(Number(ledger.tickSequence)) || Number(ledger.tickSequence) < 0) add('REGIONAL_TICK_SEQUENCE', '$.tickSequence', 'Tik sırası negatif olmayan tamsayı olmalı.');
    if (!Array.isArray(ledger.shortages) || !Array.isArray(ledger.transactions)) add('REGIONAL_LOG_ARRAYS', '$', 'Kıtlık ve işlem defterleri dizi olmalı.');
    for (const group of [
        'produced', 'consumed', 'decayed', 'externalInflow', 'cohortLaborSupply',
        'financialBridgeInflow', 'financialBridgeOutflow', 'financialOperatingUse'
    ]) {
        for (const resourceId of STORY_RESOURCE_IDS) {
            const value = Number(ledger.totals && ledger.totals[group] && ledger.totals[group][resourceId]);
            if (!Number.isFinite(value) || value < 0) add('REGIONAL_TOTALS', `$.totals.${group}.${resourceId}`, 'Koruma toplamları sonlu ve negatif olmayan sayı olmalı.');
        }
    }
    return { ok: issues.length === 0, issues };
}

function storyRegionalReset(options) {
    if (!storyRegionalEnabled()) {
        STORY.regionalEconomy = null;
        storyRegionalClearNodeMirrors();
        return null;
    }
    STORY.regionalEconomy = storyRegionalLedgerCreate(options);
    storyRegionalSyncNodeMirrors();
    return STORY.regionalEconomy;
}

function storyRegionalRestore(saved) {
    if (!storyRegionalEnabled()) {
        STORY.regionalEconomy = null;
        storyRegionalClearNodeMirrors();
        return null;
    }
    if (!saved) {
        return storyRegionalReset({
            backfilled: true,
            warnings: ['Kayıt kanonik bölgesel stok taşımıyordu; eski kaynakları dönüştürmeden deterministik başlangıç stokları kuruldu.']
        });
    }
    const candidate = storyRegionalClone(saved);
    if (!candidate.totals) candidate.totals = storyRegionalTotalsBase();
    if (!candidate.totals.cohortLaborSupply) {
        candidate.totals.cohortLaborSupply = storyRegionalResourceMap(0);
    }
    if (!candidate.totals.financialBridgeInflow) {
        candidate.totals.financialBridgeInflow = storyRegionalResourceMap(0);
    }
    if (!candidate.totals.financialBridgeOutflow) {
        candidate.totals.financialBridgeOutflow = storyRegionalResourceMap(0);
    }
    if (!candidate.totals.financialOperatingUse) {
        candidate.totals.financialOperatingUse = storyRegionalResourceMap(0);
    }
    const validation = storyRegionalValidate(candidate);
    if (!validation.ok) {
        return storyRegionalReset({
            backfilled: true,
            restoredFromInvalidLedger: true,
            issues: validation.issues,
            warnings: ['Geçersiz bölgesel stok defteri kullanılmadı; eski kaynaklara dokunmadan güvenli başlangıç durumu kuruldu.']
        });
    }
    STORY.regionalEconomy = candidate;
    storyRegionalSyncNodeMirrors();
    return STORY.regionalEconomy;
}

function storyRegionalEnsure() {
    if (!storyRegionalEnabled()) return null;
    if (!STORY.regionalEconomy) return storyRegionalReset({ backfilled: true });
    return STORY.regionalEconomy;
}

function storyRegionalForSave() {
    const ledger = storyRegionalEnsure();
    if (!ledger) return null;
    if (typeof storyCompanyEnabled === 'function' && storyCompanyEnabled()
        && typeof storyCompanySyncRegionalCapital === 'function') {
        storyCompanySyncRegionalCapital(true);
    }
    storyRegionalSyncNodeMirrors();
    const validation = storyRegionalValidate(ledger, { checkNodeMirrors: true });
    if (!validation.ok) {
        ledger.diagnostics.issues = validation.issues.slice(0, 50);
        ledger.diagnostics.warnings = ['Bölgesel stok kaydı doğrulama sorunları taşıyor.'];
    }
    return storyRegionalClone(ledger);
}

function storyRegionalSummary() {
    const ledger = storyRegionalEnsure();
    if (!ledger) {
        return {
            schemaVersion: STORY_REGIONAL_ECONOMY_SCHEMA_VERSION,
            adapterVersion: STORY_REGIONAL_ECONOMY_ADAPTER_VERSION,
            disabled: true,
            liveStockSystem: false,
            regionCount: 0,
            shortages: 0
        };
    }
    const stockTotals = storyRegionalResourceMap(0);
    for (const region of Object.values(ledger.regions)) {
        for (const id of STORY_RESOURCE_IDS) storyRegionalAddToMap(stockTotals, id, region.stocks[id]);
    }
    return {
        schemaVersion: ledger.schemaVersion,
        adapterVersion: ledger.adapterVersion,
        policyHash: ledger.policyHash,
        resourceCatalogHash: ledger.resourceCatalogHash,
        productionCatalogHash: ledger.productionCatalogHash,
        topologyHash: ledger.topologyHash,
        disabled: false,
        liveStockSystem: true,
        legacyMaterialized: false,
        regionCount: Object.keys(ledger.regions).length,
        tickSequence: ledger.tickSequence,
        lastTickAt: ledger.lastTickAt,
        shortageCount: ledger.shortages.length,
        transactionCount: ledger.transactions.length,
        stockTotals,
        flowTotals: storyRegionalClone(ledger.totals),
        diagnostics: storyRegionalClone(ledger.diagnostics)
    };
}

function storyRegionalRegionView(regionId) {
    const ledger = storyRegionalEnsure();
    const id = String(regionId).startsWith('region:') ? String(regionId) : `region:${Number(regionId)}`;
    const region = ledger && ledger.regions[id];
    if (!region) return null;
    return {
        regionId: id,
        stocks: storyRegionalClone(region.stocks),
        safeTargets: storyRegionalClone(region.safeTargets),
        endowments: storyRegionalClone(region.endowments),
        sectorCapacity: storyRegionalClone(region.sectorCapacity),
        shortages: ledger.shortages.filter(item => item.regionId === id).slice(-20).map(storyRegionalClone),
        lastTick: storyRegionalClone(region.lastTick)
    };
}

function storyRegionalRecordTransaction(entry) {
    const ledger = STORY.regionalEconomy;
    if (!ledger) return null;
    ledger.transactionSequence++;
    const row = Object.assign({
        id: `regional-tx:${ledger.transactionSequence}`,
        tickSequence: ledger.tickSequence,
        at: storyRegionalRound(STORY.clock)
    }, entry);
    ledger.transactions.push(row);
    if (ledger.transactions.length > STORY_REGIONAL_ECONOMY_TRANSACTION_LIMIT) {
        ledger.transactions.splice(0, ledger.transactions.length - STORY_REGIONAL_ECONOMY_TRANSACTION_LIMIT);
    }
    return row;
}

function storyRegionalStockDelta(regionId, resourceId, amount, options) {
    options = options || {};
    const ledger = storyRegionalEnsure();
    const id = String(regionId).startsWith('region:') ? String(regionId) : `region:${Number(regionId)}`;
    const region = ledger && ledger.regions[id];
    const delta = Number(amount);
    if (!region) return { ok: false, code: 'REGION_NOT_FOUND', regionId: id };
    if (!STORY_RESOURCE_IDS.includes(resourceId)) return { ok: false, code: 'RESOURCE_NOT_FOUND', resourceId };
    if (!Number.isFinite(delta)) return { ok: false, code: 'INVALID_DELTA', resourceId };
    const before = Number(region.stocks[resourceId]) || 0;
    const after = storyRegionalRound(before + delta);
    if (after < -1e-9) return { ok: false, code: 'NEGATIVE_STOCK', resourceId, before, delta };
    region.stocks[resourceId] = Math.max(0, after);
    const transaction = storyRegionalRecordTransaction({
        type: String(options.type || 'STOCK_DELTA'),
        source: String(options.source || 'SYSTEM'),
        regionId: id,
        resourceId,
        before: storyRegionalRound(before),
        delta: storyRegionalRound(delta),
        after: region.stocks[resourceId]
    });
    const node = STORY.nodes && STORY.nodes[Number(id.split(':')[1])];
    if (node) node.stocks = Object.assign({}, region.stocks);
    return { ok: true, transaction, before, after: region.stocks[resourceId] };
}

function storyRegionalProposalPayload(proposal) {
    if (!proposal) return proposal;
    const payload = Object.assign({}, proposal);
    delete payload.proposalHash;
    return payload;
}

function storyRegionalCommitProduction(regionId, proposal) {
    const ledger = storyRegionalEnsure();
    const id = String(regionId).startsWith('region:') ? String(regionId) : `region:${Number(regionId)}`;
    const region = ledger && ledger.regions[id];
    if (!region) return { ok: false, code: 'REGION_NOT_FOUND', regionId: id };
    if (!proposal || proposal.status === 'DISABLED' || proposal.status === 'INVALID_REQUEST'
        || !Number.isFinite(Number(proposal.actualCycles)) || Number(proposal.actualCycles) <= 0) {
        return { ok: false, code: 'PROPOSAL_NOT_COMMITTABLE', regionId: id };
    }
    if (proposal.catalogHash !== STORY_PRODUCTION_CATALOG_HASH
        || proposal.resourceCatalogHash !== STORY_RESOURCE_CATALOG_HASH
        || (!proposal._trustedDirect && proposal.proposalHash !== storyProductionHash(storyRegionalProposalPayload(proposal)))) {
        return { ok: false, code: 'PROPOSAL_INTEGRITY', regionId: id };
    }
    const sector = STORY_PRODUCTION_SECTOR_DEFINITIONS.find(item => item.id === proposal.sectorId);
    if (!sector || sector.recipe.id !== proposal.recipeId || sector.recipe.version !== proposal.recipeVersion) {
        return { ok: false, code: 'PROPOSAL_RECIPE_MISMATCH', regionId: id };
    }
    const cycles = Number(proposal.actualCycles);
    const expectedConsumed = {};
    const expectedProduced = {};
    const expectedEndowments = {};
    for (const input of sector.recipe.inputs) expectedConsumed[input.resourceId] = storyRegionalRound(input.quantity * cycles);
    for (const output of sector.recipe.outputs) expectedProduced[output.resourceId] = storyRegionalRound(output.quantity * cycles);
    for (const endowment of sector.recipe.endowments) expectedEndowments[endowment.id] = storyRegionalRound(endowment.quantity * cycles);
    const proposalConsumed = proposal.consumed || {};
    const proposalProduced = proposal.produced || {};
    const proposalEndowments = proposal.endowmentUse || {};
    let mismatch = false;
    for (const [k, v] of Object.entries(expectedConsumed)) {
        if (Math.abs(Number(proposalConsumed[k] && proposalConsumed[k].quantity || proposalConsumed[k] || 0) - v) > 1e-4) { mismatch = true; break; }
    }
    if (!mismatch) {
        for (const [k, v] of Object.entries(expectedProduced)) {
            if (Math.abs(Number(proposalProduced[k] && proposalProduced[k].quantity || proposalProduced[k] || 0) - v) > 1e-4) { mismatch = true; break; }
        }
    }
    if (!mismatch) {
        for (const [k, v] of Object.entries(expectedEndowments)) {
            if (Math.abs(Number(proposalEndowments[k] && proposalEndowments[k].quantity || proposalEndowments[k] || 0) - v) > 1e-4) { mismatch = true; break; }
        }
    }
    if (mismatch) {
        return { ok: false, code: 'PROPOSAL_QUANTITY_MISMATCH', regionId: id };
    }
    for (const [resourceId, quantity] of Object.entries(expectedConsumed)) {
        const available = resourceId === 'capital'
            && typeof storyCompanyOperatingCash === 'function'
            && typeof storyCompanyEnabled === 'function'
            && storyCompanyEnabled()
            ? storyCompanyOperatingCash(id, proposal.sectorId)
            : (Number(region.stocks[resourceId]) || 0);
        if (available + 1e-9 < quantity) {
            return { ok: false, code: 'INSUFFICIENT_STOCK', regionId: id, resourceId };
        }
    }
    for (const endowment of sector.recipe.endowments) {
        if (endowment.depletable
            && (Number(region.endowments[endowment.id]) || 0) + 1e-9 < expectedEndowments[endowment.id]) {
            return { ok: false, code: 'INSUFFICIENT_ENDOWMENT', regionId: id, endowmentId: endowment.id };
        }
    }
    let _commercePlan = null;
    if (typeof storyCommerceEnabled === 'function' && storyCommerceEnabled()
        && typeof storyCommerceCanCommitProduction === 'function') {
        const finance = storyCommerceCanCommitProduction(id, {
            sectorId: proposal.sectorId,
            cycles: storyRegionalRound(cycles),
            consumed: expectedConsumed,
            produced: expectedProduced
        });
        if (!finance.ok) return Object.assign({ regionId: id }, finance);
        if (finance.plan) _commercePlan = finance.plan;
    }
    const before = Object.assign({}, region.stocks);
    for (const [resourceId, quantity] of Object.entries(expectedConsumed)) {
        const companyCapital = resourceId === 'capital'
            && typeof storyCompanyEnabled === 'function'
            && storyCompanyEnabled();
        if (!companyCapital) {
            region.stocks[resourceId] = storyRegionalRound(region.stocks[resourceId] - quantity);
        }
        if (companyCapital) {
            storyRegionalAddToMap(ledger.totals.financialOperatingUse, resourceId, quantity);
        } else {
            storyRegionalAddToMap(ledger.totals.consumed, resourceId, quantity);
        }
    }
    for (const endowment of sector.recipe.endowments) {
        if (endowment.depletable) {
            region.endowments[endowment.id] = storyRegionalRound(
                region.endowments[endowment.id] - expectedEndowments[endowment.id]
            );
        }
    }
    for (const [resourceId, quantity] of Object.entries(expectedProduced)) {
        region.stocks[resourceId] = storyRegionalRound(region.stocks[resourceId] + quantity);
        storyRegionalAddToMap(ledger.totals.produced, resourceId, quantity);
    }
    const transaction = storyRegionalRecordTransaction({
        type: 'PRODUCTION_COMMIT',
        source: proposal.recipeId,
        regionId: id,
        sectorId: proposal.sectorId,
        cycles: storyRegionalRound(cycles),
        consumed: expectedConsumed,
        produced: expectedProduced,
        before,
        after: Object.assign({}, region.stocks)
    });
    if (_commercePlan) transaction._commercePlan = _commercePlan;
    if (typeof storyCompanyOnProductionCommitted === 'function'
        && typeof storyCompanyEnabled === 'function'
        && storyCompanyEnabled()) {
        const settlement = storyCompanyOnProductionCommitted(id, transaction);
        transaction.companySettlement = settlement && settlement.ok
            ? {
                companyId: settlement.companyId,
                revenue: settlement.revenue,
                operatingCost: settlement.operatingCost,
                workingCapitalRequired: settlement.workingCapitalRequired,
                purchaseCashRequired: settlement.purchaseCashRequired,
                acquiredInputCost: settlement.acquiredInputCost,
                inventoryCost: settlement.inventoryCost
            }
            : { error: settlement && settlement.code || 'COMPANY_SETTLEMENT_FAILED' };
    }
    return { ok: true, transaction, committed: true };
}

function storyRegionalShortageEffects(resourceId) {
    const definition = STORY_RESOURCE_DEFINITIONS.find(item => item.id === resourceId);
    return (definition && definition.shortageEffects || [])
        .filter(effect => Number(effect.activationPhase) <= 17)
        .map(effect => effect.id);
}

function storyRegionalShortageLookup(ledger) {
    if (ledger.__shortageLookup instanceof Map) return ledger.__shortageLookup;
    const lookup = new Map();
    for (const row of (ledger.shortages || [])) {
        if (!row.lifecycleStatus) row.lifecycleStatus = row.resolvedAt != null ? 'RESOLVED' : 'ACTIVE';
        const key = `${row.regionId}|${row.consumerType}|${row.resourceId}`;
        lookup.set(key, row);
    }
    Object.defineProperty(ledger, '__shortageLookup', {
        value: lookup,
        writable: true,
        configurable: true,
        enumerable: false
    });
    return lookup;
}

function storyRegionalAllocateDemands(regionId, demands) {
    const ledger = storyRegionalEnsure();
    const id = String(regionId).startsWith('region:') ? String(regionId) : `region:${Number(regionId)}`;
    const region = ledger && ledger.regions[id];
    if (!region) return { ok: false, code: 'REGION_NOT_FOUND', allocations: [] };
    const ordered = (Array.isArray(demands) ? demands : []).map(d => Object.assign({}, d))
        .sort((a, b) => Number(b.priority) - Number(a.priority) || String(a.id).localeCompare(String(b.id), 'en'));
    const allocations = [];
    for (const demand of ordered) {
        const resourceId = String(demand.resourceId);
        const requested = Math.max(0, Number(demand.quantity) || 0);
        if (!STORY_RESOURCE_IDS.includes(resourceId) || requested <= 0) continue;
        const before = Math.max(0, Number(region.stocks[resourceId]) || 0);
        const reserveFloor = demand.mayUseReserve ? 0 : Math.max(0, Number(region.safeTargets[resourceId]) || 0);
        const usable = Math.max(0, before - reserveFloor);
        let delivered = storyRegionalRound(Math.min(requested, usable));
        let sale = null;
        if (delivered > 0
            && typeof storyCommerceEnabled === 'function' && storyCommerceEnabled()
            && typeof storyCommerceSettleDemand === 'function') {
            sale = storyCommerceSettleDemand(id, demand, delivered);
            delivered = sale.ok ? storyRegionalRound(sale.delivered) : 0;
        }
        const unmet = storyRegionalRound(requested - delivered);
        region.stocks[resourceId] = storyRegionalRound(before - delivered);
        storyRegionalAddToMap(ledger.totals.consumed, resourceId, delivered);
        const fillBps = requested > 0 ? Math.round(delivered / requested * 10000) : 10000;
        const allocation = {
            demandId: String(demand.id),
            regionId: id,
            consumerType: String(demand.consumerType),
            resourceId,
            priority: Number(demand.priority) || 0,
            requested: storyRegionalRound(requested),
            delivered,
            unmet,
            fillBps,
            minFillBps: Number(demand.minFillBps) || 0,
            reason: String(demand.reason || 'UNSPECIFIED'),
            status: unmet <= 1e-9 ? 'SATISFIED' : (delivered > 0 ? 'PARTIAL' : 'UNMET')
        };
        if (demand.payerType) allocation.payerType = String(demand.payerType);
        if (demand.payerId) allocation.payerId = String(demand.payerId);
        if (demand.buyerCompanyId) allocation.buyerCompanyId = String(demand.buyerCompanyId);
        if (sale) allocation.sale = storyRegionalClone(sale.summary || {
            ok: sale.ok,
            code: sale.code || null
        });
        allocations.push(allocation);
        const shortageKey = `${id}|${demand.consumerType}|${resourceId}`;
        const shortageLookup = storyRegionalShortageLookup(ledger);
        const existingShortage = shortageLookup.get(shortageKey);
        if (unmet > 1e-9) {
            const shortage = Object.assign(existingShortage || {
                id: `shortage:${id}:${demand.consumerType}:${resourceId}`,
                firstAt: storyRegionalRound(STORY.clock),
                occurrences: 0,
                cumulativeUnmet: 0
            }, {
                tickSequence: ledger.tickSequence,
                at: storyRegionalRound(STORY.clock),
                cause: before <= 0 ? 'EMPTY_STOCK' : (reserveFloor > 0 && usable <= 0 ? 'SAFE_RESERVE_PROTECTED' : 'INSUFFICIENT_STOCK'),
                effects: storyRegionalShortageEffects(resourceId),
                lifecycleStatus: 'ACTIVE',
                resolvedAt: null
            }, allocation);
            shortage.occurrences = Math.max(0, Number(shortage.occurrences) || 0) + 1;
            shortage.cumulativeUnmet = storyRegionalRound((Number(shortage.cumulativeUnmet) || 0) + unmet);
            if (!existingShortage) {
                ledger.shortages.push(shortage);
                shortageLookup.set(shortageKey, shortage);
            }
        } else if (existingShortage && existingShortage.lifecycleStatus === 'ACTIVE') {
            existingShortage.lifecycleStatus = 'RESOLVED';
            existingShortage.resolvedAt = storyRegionalRound(STORY.clock);
            existingShortage.tickSequence = ledger.tickSequence;
            existingShortage.at = storyRegionalRound(STORY.clock);
        }
    }
    if (ledger.shortages.length > STORY_REGIONAL_ECONOMY_SHORTAGE_LIMIT) {
        const removed = ledger.shortages.splice(0, ledger.shortages.length - STORY_REGIONAL_ECONOMY_SHORTAGE_LIMIT);
        const shortageLookup = storyRegionalShortageLookup(ledger);
        for (const row of removed) shortageLookup.delete(`${row.regionId}|${row.consumerType}|${row.resourceId}`);
    }
    if (allocations.length) {
        storyRegionalRecordTransaction({
            type: 'CONSUMPTION_ALLOCATION',
            source: 'REGIONAL_DEMAND',
            regionId: id,
            allocations
        });
    }
    return { ok: true, allocations };
}

function storyRegionalApplyStorage(region, worldDays) {
    const ledger = STORY.regionalEconomy;
    const losses = storyRegionalResourceMap(0);
    for (const definition of STORY_RESOURCE_DEFINITIONS) {
        const id = definition.id;
        const before = Math.max(0, Number(region.stocks[id]) || 0);
        let rate = 0;
        if (definition.storage.decayModel === 'SHELF_LIFE') {
            rate = Math.min(0.95, Math.max(0, worldDays) / Math.max(1, Number(definition.storage.shelfLifeDays) || 1));
        } else if (definition.storage.decayModel === 'BUFFER_LOSS') {
            rate = Math.min(0.25, Math.max(0, worldDays) * 0.002);
        } else if (definition.storage.decayModel === 'OBSOLESCENCE') {
            rate = Math.min(0.10, Math.max(0, worldDays) * 0.0005);
        } else if (definition.storage.decayModel === 'READINESS_LOSS') {
            rate = Math.min(0.10, Math.max(0, worldDays) * 0.0003);
        } else if (definition.storage.decayModel === 'NON_STOCK') {
            rate = before > 0 ? 1 : 0;
        }
        let loss = storyRegionalRound(Math.min(before, before * rate));
        if (loss <= 0) continue;
        if (typeof storyCommerceEnabled === 'function' && storyCommerceEnabled()
            && STORY_COMMERCE_PHYSICAL_RESOURCES.includes(id)
            && typeof storyCommerceApplyPhysicalLoss === 'function') {
            const impairment = storyCommerceApplyPhysicalLoss(
                region.regionId,
                id,
                loss,
                `STORAGE_${definition.storage.decayModel}`
            );
            // Do not let physical stock and ownership diverge if the ownership
            // ledger cannot atomically represent this loss.
            loss = impairment.ok ? storyRegionalRound(impairment.applied) : 0;
        }
        if (loss <= 0) continue;
        region.stocks[id] = storyRegionalRound(before - loss);
        losses[id] = loss;
        storyRegionalAddToMap(ledger.totals.decayed, id, loss);
    }
    return losses;
}

function storyRegionalEconomyTick(dtSec) {
    const ledger = storyRegionalEnsure();
    if (!ledger) return { disabled: true, regionsProcessed: 0 };
    const yearSeconds = typeof YEAR_SECONDS !== 'undefined' && Number(YEAR_SECONDS) > 0
        ? Number(YEAR_SECONDS)
        : 120;
    const worldDays = storyRegionalRound(Math.max(0, Number(dtSec) || 0) * 365 / yearSeconds);
    if (worldDays <= 0) return { disabled: false, regionsProcessed: 0 };
    const bootstrapPlanning = typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('economy.bootstrapPlanning');
    ledger.tickSequence++;
    ledger.lastTickAt = storyRegionalRound(STORY.clock);
    let productionCommits = 0;
    let blockedProposals = 0;
    let unprofitableProductionHolds = 0;
    let shortageCount = 0;
    // Faz 22.1: during a food/energy bootstrap, scarce operational energy is
    // allocated to essential food production before extraction. The legacy
    // order remains byte-for-byte available when the feature is disabled.
    const sectorOrder = bootstrapPlanning
        ? ['energy', 'agriculture', 'extraction', 'civil_industry', 'advanced_tech', 'defense_industry']
        : ['energy', 'extraction', 'agriculture', 'civil_industry', 'advanced_tech', 'defense_industry'];
    for (const node of (STORY.nodes || [])) {
        const regionId = `region:${Number(node.id)}`;
        const region = ledger.regions[regionId];
        if (!region) continue;
        const producedByResource = storyRegionalResourceMap(0);
        const productionConsumedByResource = storyRegionalResourceMap(0);
        const productionRequestedByResource = storyRegionalResourceMap(0);
        const productionUnmetByResource = storyRegionalResourceMap(0);
        const productionHolds = [];
        const productionBottlenecks = [];
        const population = storyRegionalPopulation(node);
        const laborView = typeof storyPopulationLaborSupply === 'function'
            ? storyPopulationLaborSupply(regionId, worldDays)
            : null;
        const laborSupply = storyRegionalRound(laborView && laborView.status === 'COHORT_DERIVED'
            ? laborView.laborLots
            : population * 1.5 * worldDays);
        const companyCapital = typeof storyCompanyEnabled === 'function' && storyCompanyEnabled();
        const capitalInflow = companyCapital
            ? 0
            : storyRegionalRound((1 + (Number(node.wealth) || 0) * 0.2 + Math.max(1, Number(node.level) || 1)) * worldDays);
        region.stocks.labor = laborSupply;
        if (companyCapital && typeof storyCompanyRegionalLiquidity === 'function') {
            const beforeCapital = Math.max(0, Number(region.stocks.capital) || 0);
            const nextCapital = storyCompanyRegionalLiquidity(regionId);
            const bridgeDelta = storyRegionalRound(nextCapital - beforeCapital);
            region.stocks.capital = nextCapital;
            if (bridgeDelta >= 0) storyRegionalAddToMap(ledger.totals.financialBridgeInflow, 'capital', bridgeDelta);
            else storyRegionalAddToMap(ledger.totals.financialBridgeOutflow, 'capital', -bridgeDelta);
        } else {
            region.stocks.capital = storyRegionalRound(region.stocks.capital + capitalInflow);
        }
        if (laborView && laborView.status === 'COHORT_DERIVED') {
            storyRegionalAddToMap(ledger.totals.cohortLaborSupply, 'labor', laborSupply);
        } else {
            storyRegionalAddToMap(ledger.totals.externalInflow, 'labor', laborSupply);
        }
        storyRegionalAddToMap(ledger.totals.externalInflow, 'capital', capitalInflow);

        // Faz 26: protesto/grev/ayaklanma mevcut uretim cevrimini azaltir;
        // girdi veya cikti sonradan carpilmaz. Boylece tuketilmeyen mal ve emek
        // stokta kalir, fiziksel defter korunur ve etki tek kez uygulanir.
        const collectiveProductionMultiplier = typeof storyCollectiveRegionProductionMultiplier === 'function'
            ? storyCollectiveRegionProductionMultiplier(regionId)
            : 1;

        for (const sectorId of storyRegionalSectorOrder(region, sectorOrder)) {
            const capacity = Math.max(0, Number(region.sectorCapacity[sectorId]) || 0);
            if (capacity <= 0) continue;
            const requestedCycles = storyRegionalRound(capacity * worldDays * collectiveProductionMultiplier);
            const viability = companyCapital && typeof storyCompanyProductionViability === 'function'
                ? storyCompanyProductionViability(regionId, sectorId)
                : { approved: true, code: 'NO_COMPANY_GATE' };
            if (!viability.approved) {
                blockedProposals++;
                unprofitableProductionHolds++;
                productionHolds.push(Object.assign({}, viability));
                continue;
            }
            if (bootstrapPlanning) {
                const sectorDefinition = STORY_PRODUCTION_SECTOR_DEFINITIONS
                    .find(row => row.id === sectorId);
                for (const input of (sectorDefinition && sectorDefinition.recipe.inputs) || []) {
                    if (['labor', 'capital'].includes(input.resourceId)) continue;
                    storyRegionalAddToMap(
                        productionRequestedByResource,
                        input.resourceId,
                        Math.max(0, Number(input.quantity) || 0) * requestedCycles
                    );
                }
            }
            const endowments = {
                arable_capacity: storyRegionalRound(region.endowments.arable_capacity * worldDays),
                energy_potential: storyRegionalRound(region.endowments.energy_potential * worldDays),
                mineral_reserve: region.endowments.mineral_reserve
            };
            const proposal = storyProductionEvaluate(sectorId, {
                requestedCycles,
                capacityUnits: requestedCycles,
                efficiencyBps: 10000,
                availableQuantities: companyCapital && typeof storyCompanyOperatingCash === 'function'
                    ? Object.assign({}, region.stocks, {
                        capital: storyCompanyOperatingCash(regionId, sectorId)
                    })
                    : region.stocks,
                endowments
            });
            if (bootstrapPlanning) {
                for (const bottleneck of (proposal.bottlenecks || [])) {
                    productionBottlenecks.push({
                        sectorId,
                        status: proposal.status,
                        requestedCycles: proposal.requestedCycles,
                        actualCycles: proposal.actualCycles,
                        code: bottleneck.code,
                        key: bottleneck.key,
                        severity: bottleneck.severity
                    });
                }
            }
            if (proposal.actualCycles > 0) {
                const receipt = storyRegionalCommitProduction(regionId, proposal);
                if (receipt.ok) {
                    productionCommits++;
                    for (const [resourceId, quantity] of Object.entries(receipt.transaction.produced || {})) {
                        storyRegionalAddToMap(producedByResource, resourceId, quantity);
                    }
                    for (const [resourceId, quantity] of Object.entries(receipt.transaction.consumed || {})) {
                        storyRegionalAddToMap(productionConsumedByResource, resourceId, quantity);
                    }
                } else blockedProposals++;
            } else blockedProposals++;
        }
        if (bootstrapPlanning) {
            for (const resourceId of STORY_RESOURCE_IDS) {
                productionUnmetByResource[resourceId] = storyRegionalRound(Math.max(
                    0,
                    Number(productionRequestedByResource[resourceId])
                        - Number(productionConsumedByResource[resourceId])
                ));
            }
        }

        // Faz 22.1: yatırım girdisi hazırlıkları yeni üretilmiş fiziksel malı
        // hane/şirket talebi tüketmeden önce proje emanetine ayırabilir. Kaynak
        // yaratılmaz; bölgesel stoktan atomik olarak çıkar ve ekonomik AI
        // defterinde aynı miktarda saklanır.
        if (typeof storyEconomicAIReservePreparedInputs === 'function') {
            storyEconomicAIReservePreparedInputs(regionId);
        }

        const demandResult = storyRegionalAllocateDemands(regionId, storyRegionalDemandSpecs(node, worldDays));
        const demandRequestedByResource = storyRegionalResourceMap(0);
        const demandDeliveredByResource = storyRegionalResourceMap(0);
        const demandUnmetByResource = storyRegionalResourceMap(0);
        for (const allocation of (demandResult.allocations || [])) {
            storyRegionalAddToMap(demandRequestedByResource, allocation.resourceId, allocation.requested);
            storyRegionalAddToMap(demandDeliveredByResource, allocation.resourceId, allocation.delivered);
            storyRegionalAddToMap(demandUnmetByResource, allocation.resourceId, allocation.unmet);
        }
        shortageCount += demandResult.allocations
            ? demandResult.allocations.filter(item => item.unmet > 0).length
            : 0;
        const losses = storyRegionalApplyStorage(region, worldDays);
        const lastTick = {
            sequence: ledger.tickSequence,
            at: ledger.lastTickAt,
            worldDays,
            collectiveProductionMultiplierBps: Math.round(collectiveProductionMultiplier * 10000),
            labor: laborView && laborView.status === 'COHORT_DERIVED'
                ? Object.assign({}, laborView)
                : { status: 'LEGACY_FALLBACK', laborLots: laborSupply, wageIndex: null },
            demandCount: demandResult.allocations ? demandResult.allocations.length : 0,
            allocations: demandResult.allocations ? demandResult.allocations.slice() : [],
            shortageCount: demandResult.allocations
                ? demandResult.allocations.filter(item => item.unmet > 0).length
                : 0,
            producedByResource,
            productionConsumedByResource,
            demandRequestedByResource,
            demandDeliveredByResource,
            demandUnmetByResource,
            storageLosses: losses
        };
        if (bootstrapPlanning) {
            lastTick.productionRequestedByResource = productionRequestedByResource;
            lastTick.productionUnmetByResource = productionUnmetByResource;
            lastTick.productionHolds = productionHolds;
            lastTick.productionBottlenecks = productionBottlenecks;
        }
        region.lastTick = lastTick;
        node.stocks = Object.assign({}, region.stocks);
    }
    // Company cash is the canonical source for regional capital while the
    // companies/banks layer is enabled. Production settlement changes company
    // balances during this tick, so refresh every regional mirror before any
    // dossier, aggregation capsule, save or invariant probe can observe it.
    if (typeof storyCompanyEnabled === 'function' && storyCompanyEnabled()
        && typeof storyCompanySyncRegionalCapital === 'function') {
        storyCompanySyncRegionalCapital(true);
    }
    return {
        disabled: false,
        tickSequence: ledger.tickSequence,
        worldDays,
        regionsProcessed: Object.keys(ledger.regions).length,
        productionCommits,
        blockedProposals,
        unprofitableProductionHolds,
        shortageCount
    };
}


function storyRegionalSetSafeTarget(regionId, resourceId, quantity, options) {
    const ledger = storyRegionalEnsure();
    const id = String(regionId).startsWith('region:') ? String(regionId) : `region:${Number(regionId)}`;
    const region = ledger && ledger.regions[id];
    const value = storyRegionalRound(Math.max(0, Number(quantity) || 0));
    if (!region) return { ok: false, code: 'REGION_NOT_FOUND' };
    if (!STORY_RESOURCE_IDS.includes(String(resourceId))) return { ok: false, code: 'RESOURCE_NOT_FOUND' };
    const before = Number(region.safeTargets[resourceId]) || 0;
    region.safeTargets[resourceId] = value;
    const transaction = storyRegionalRecordTransaction({
        type: 'SAFE_TARGET_POLICY', source: String(options && options.source || 'PLAYER'),
        actorId: options && options.actorId || null, regionId: id,
        resourceId: String(resourceId), before, after: value, delta: storyRegionalRound(value - before)
    });
    return { ok: true, transaction, before, after: value };
}

function storyRegionalSectorOrder(region, defaults) {
    const priority = String(region && region.playerSectorPriority || '');
    if (!priority || !defaults.includes(priority)) return defaults;
    return [priority].concat(defaults.filter(id => id !== priority));
}
function storyRegionalSetSectorPriority(regionId, sectorId, options) {
    const ledger = storyRegionalEnsure();
    const id = String(regionId).startsWith('region:') ? String(regionId) : `region:${Number(regionId)}`;
    const region = ledger && ledger.regions[id];
    if (!region) return { ok: false, code: 'REGION_NOT_FOUND' };
    if (!STORY_PRODUCTION_SECTOR_IDS.includes(String(sectorId))) return { ok: false, code: 'SECTOR_NOT_FOUND' };
    const before = region.playerSectorPriority || null;
    region.playerSectorPriority = String(sectorId);
    const transaction = storyRegionalRecordTransaction({ type: 'SECTOR_PRIORITY_POLICY',
        source: String(options && options.source || 'PLAYER'), actorId: options && options.actorId || null,
        regionId: id, before, after: region.playerSectorPriority });
    return { ok: true, transaction, before, after: region.playerSectorPriority };
}