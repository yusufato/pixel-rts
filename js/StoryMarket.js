// ============================================================================
//  BOLGESEL PIYASA VE FIYAT DEFTERI - Faz 19
//  --------------------------------------------------------------------------
//  Fiziksel stok, gerceklesen talep, yerel uretim ve lojistik riskten sinirli
//  fiyat endeksleri uretir. Bu katman para veya stok yaratmaz; odeme/mahsuplasma
//  Devlet butcesi/odeme Faz 20'de kurulmustur. Labor mevcut NON_STOCK modeli
//  nedeniyle acikca ertelenir; bolgesel capital ise sirket/banka karsiligi
//  gelene kadar sabit numeraire olarak kalir.
// ============================================================================

const STORY_MARKET_SCHEMA_VERSION = 1;
const STORY_MARKET_ADAPTER_VERSION = 'story-market-price-ledger-1';
const STORY_MARKET_EVENT_LIMIT = 300;
const STORY_MARKET_ACTIVE_RESOURCES = Object.freeze([
    'food',
    'energy',
    'raw_materials',
    'industrial_parts',
    'electronics',
    'military_supplies'
]);
const STORY_MARKET_RESOURCE_STATUS = Object.freeze({
    labor: 'DEFERRED',
    capital: 'NUMERAIRE'
});
const STORY_MARKET_POLICY = Object.freeze({
    unit: 'PRICE_INDEX_POINT',
    baseIndex: 100,
    minIndex: 25,
    maxIndex: 800,
    targetMinMultiplier: 0.35,
    targetMaxMultiplier: 6,
    smoothingAlpha: 0.22,
    maxTickMoveBps: 1000,
    inTransitReliefBps: 3500,
    heldReliefBps: 500,
    householdBasket: Object.freeze({ food: 6000, energy: 4000 }),
    producerBasket: Object.freeze({
        energy: 3000,
        raw_materials: 2000,
        industrial_parts: 2500,
        electronics: 1500,
        military_supplies: 1000
    })
});
const STORY_MARKET_POLICY_HASH = storyProductionHash({
    schemaVersion: STORY_MARKET_SCHEMA_VERSION,
    adapterVersion: STORY_MARKET_ADAPTER_VERSION,
    activeResources: STORY_MARKET_ACTIVE_RESOURCES,
    resourceStatus: STORY_MARKET_RESOURCE_STATUS,
    policy: STORY_MARKET_POLICY,
    resourceCatalogHash: STORY_RESOURCE_CATALOG_HASH,
    productionCatalogHash: STORY_PRODUCTION_CATALOG_HASH
});

function storyMarketEnabled() {
    return (typeof storyFeatureEnabled !== 'function' || storyFeatureEnabled('economy.marketPrices'))
        && (typeof storyRegionalEnabled !== 'function' || storyRegionalEnabled())
        && (typeof storyTradeEnabled !== 'function' || storyTradeEnabled());
}

function storyMarketClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyMarketRound(value, digits) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    const factor = 10 ** (digits == null ? 6 : digits);
    return Math.round(number * factor) / factor;
}

function storyMarketClamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
}

function storyMarketRegionId(value) {
    return String(value).startsWith('region:') ? String(value) : `region:${Number(value)}`;
}

function storyMarketCountryId(value) {
    return String(value).startsWith('country:') ? String(value) : `country:${Number(value)}`;
}

function storyMarketResourceRecord(resourceId) {
    if (resourceId === 'labor') {
        return {
            resourceId,
            status: 'DEFERRED',
            reason: 'LABOR_MARKET_NOT_MODELED',
            priceIndex: null,
            targetIndex: null,
            previousIndex: null,
            lastChangeBps: null,
            band: 'DEFERRED',
            signals: null,
            updatedAt: 0
        };
    }
    if (resourceId === 'capital') {
        return {
            resourceId,
            status: 'NUMERAIRE',
            reason: 'MONETARY_CLEARING_PHASE_20',
            priceIndex: 1,
            targetIndex: 1,
            previousIndex: 1,
            lastChangeBps: 0,
            band: 'NUMERAIRE',
            signals: null,
            updatedAt: 0
        };
    }
    return {
        resourceId,
        status: 'ACTIVE',
        reason: null,
        priceIndex: STORY_MARKET_POLICY.baseIndex,
        targetIndex: STORY_MARKET_POLICY.baseIndex,
        previousIndex: STORY_MARKET_POLICY.baseIndex,
        lastChangeBps: 0,
        band: 'NORMAL',
        signals: {
            stock: 0,
            safeTarget: 0,
            stockCoverageRatio: 1,
            stockCoverageDays: null,
            requested: 0,
            delivered: 0,
            unmet: 0,
            fillBps: 10000,
            produced: 0,
            productionConsumed: 0,
            inboundInTransit: 0,
            inboundHeld: 0,
            routeDamageBps: 0,
            flowGapRatio: 0
        },
        updatedAt: 0
    };
}

function storyMarketRegionRecord(node) {
    const resources = {};
    for (const resourceId of STORY_RESOURCE_IDS) {
        resources[resourceId] = storyMarketResourceRecord(resourceId);
    }
    return {
        regionId: `region:${Number(node.id)}`,
        ownerCountryId: storyMarketCountryId(node.owner),
        resources,
        householdCpi: 100,
        producerPriceIndex: 100,
        updatedAt: 0
    };
}

function storyMarketLedgerCreate(options) {
    options = options || {};
    const regions = {};
    for (const node of (STORY.nodes || [])) {
        const region = storyMarketRegionRecord(node);
        regions[region.regionId] = region;
    }
    return {
        schemaVersion: STORY_MARKET_SCHEMA_VERSION,
        adapterVersion: STORY_MARKET_ADAPTER_VERSION,
        policyHash: STORY_MARKET_POLICY_HASH,
        resourceCatalogHash: STORY_RESOURCE_CATALOG_HASH,
        productionCatalogHash: STORY_PRODUCTION_CATALOG_HASH,
        regionalPolicyHash: typeof STORY_REGIONAL_POLICY_HASH === 'string' ? STORY_REGIONAL_POLICY_HASH : null,
        tradePolicyHash: typeof STORY_TRADE_POLICY_HASH === 'string' ? STORY_TRADE_POLICY_HASH : null,
        topologyHash: STORY.regionModel ? STORY.regionModel.topologyHash : null,
        networkHash: STORY.infrastructureGraph ? STORY.infrastructureGraph.networkHash : null,
        tickSequence: 0,
        eventSequence: 0,
        lastTickAt: 0,
        regions,
        countries: {},
        events: [],
        diagnostics: {
            backfilled: !!options.backfilled,
            restoredFromInvalidLedger: !!options.restoredFromInvalidLedger,
            issues: Array.isArray(options.issues) ? storyMarketClone(options.issues).slice(0, 50) : [],
            warnings: Array.isArray(options.warnings) ? options.warnings.map(String).slice(0, 30) : [],
            priceBasis: 'INDEXED_PHYSICAL_GOODS',
            mutatesStocks: false,
            mutatesMoney: false,
            laborPricing: 'DEFERRED',
            capitalPricing: 'NUMERAIRE',
            legacyInflationBridged: false
        }
    };
}

function storyMarketValidate(ledger) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) {
        return { ok: false, issues: [{ code: 'MARKET_LEDGER_REQUIRED', path: '$', message: 'Piyasa defteri zorunlu.' }] };
    }
    if (ledger.schemaVersion !== STORY_MARKET_SCHEMA_VERSION) add('MARKET_SCHEMA_VERSION', '$.schemaVersion', 'Piyasa sema surumu uyusmuyor.');
    if (ledger.adapterVersion !== STORY_MARKET_ADAPTER_VERSION) add('MARKET_ADAPTER_VERSION', '$.adapterVersion', 'Piyasa adapteri uyusmuyor.');
    if (ledger.policyHash !== STORY_MARKET_POLICY_HASH) add('MARKET_POLICY_HASH', '$.policyHash', 'Piyasa politikasi uyusmuyor.');
    if (ledger.resourceCatalogHash !== STORY_RESOURCE_CATALOG_HASH) add('MARKET_RESOURCE_LINK', '$.resourceCatalogHash', 'Kaynak katalog bagi uyusmuyor.');
    if (ledger.productionCatalogHash !== STORY_PRODUCTION_CATALOG_HASH) add('MARKET_PRODUCTION_LINK', '$.productionCatalogHash', 'Uretim katalog bagi uyusmuyor.');
    if (ledger.regionalPolicyHash !== (typeof STORY_REGIONAL_POLICY_HASH === 'string' ? STORY_REGIONAL_POLICY_HASH : null)) {
        add('MARKET_REGIONAL_LINK', '$.regionalPolicyHash', 'Bolgesel ekonomi bagi uyusmuyor.');
    }
    if (ledger.tradePolicyHash !== (typeof STORY_TRADE_POLICY_HASH === 'string' ? STORY_TRADE_POLICY_HASH : null)) {
        add('MARKET_TRADE_LINK', '$.tradePolicyHash', 'Ticaret bagi uyusmuyor.');
    }
    const topologyHash = STORY.regionModel ? STORY.regionModel.topologyHash : null;
    if (ledger.topologyHash !== topologyHash) add('MARKET_TOPOLOGY_HASH', '$.topologyHash', 'Bolge topolojisi uyusmuyor.');
    const networkHash = STORY.infrastructureGraph ? STORY.infrastructureGraph.networkHash : null;
    if (ledger.networkHash !== networkHash) add('MARKET_NETWORK_HASH', '$.networkHash', 'Lojistik agi uyusmuyor.');
    if (!Number.isInteger(Number(ledger.tickSequence)) || Number(ledger.tickSequence) < 0) {
        add('MARKET_TICK_SEQUENCE', '$.tickSequence', 'Tik sayaci negatif olmayan tamsayi olmali.');
    }
    if (!ledger.regions || typeof ledger.regions !== 'object' || Array.isArray(ledger.regions)) {
        add('MARKET_REGIONS_REQUIRED', '$.regions', 'Bolgesel fiyat kayitlari zorunlu.');
        return { ok: false, issues };
    }
    const expectedIds = (STORY.nodes || []).map(node => `region:${Number(node.id)}`).sort();
    const actualIds = Object.keys(ledger.regions).sort();
    if (storyProductionStable(expectedIds) !== storyProductionStable(actualIds)) {
        add('MARKET_REGION_SET', '$.regions', 'Piyasa defteri guncel bolge kumesiyle bire bir uyusmali.');
    }
    for (const regionId of actualIds) {
        const region = ledger.regions[regionId];
        const at = `$.regions.${regionId}`;
        if (!region || region.regionId !== regionId || !region.resources) {
            add('MARKET_REGION_RECORD', at, 'Bolgesel piyasa kaydi gecersiz.');
            continue;
        }
        for (const resourceId of STORY_RESOURCE_IDS) {
            const price = region.resources[resourceId];
            const pt = `${at}.resources.${resourceId}`;
            if (!price || price.resourceId !== resourceId) {
                add('MARKET_RESOURCE_RECORD', pt, 'Kaynak fiyat kaydi eksik.');
                continue;
            }
            if (STORY_MARKET_ACTIVE_RESOURCES.includes(resourceId)) {
                if (price.status !== 'ACTIVE') add('MARKET_ACTIVE_STATUS', `${pt}.status`, 'Fiziksel mal fiyat durumu ACTIVE olmali.');
                for (const field of ['priceIndex', 'targetIndex', 'previousIndex']) {
                    const value = Number(price[field]);
                    if (!Number.isFinite(value)
                        || value < STORY_MARKET_POLICY.minIndex
                        || value > STORY_MARKET_POLICY.maxIndex) {
                        add('MARKET_PRICE_RANGE', `${pt}.${field}`, 'Fiyat endeksi sonlu ve politika sinirlarinda olmali.');
                    }
                }
            } else if (resourceId === 'labor') {
                if (price.status !== 'DEFERRED' || price.priceIndex !== null) {
                    add('MARKET_LABOR_DEFERRED', pt, 'Is gucu fiyati model kurulana kadar DEFERRED/null olmali.');
                }
            } else if (resourceId === 'capital') {
                if (price.status !== 'NUMERAIRE' || Number(price.priceIndex) !== 1) {
                    add('MARKET_CAPITAL_NUMERAIRE', pt, 'Bolgesel sermaye sirket/banka karsiligi gelene kadar sabit numeraire olmali.');
                }
            }
        }
        for (const field of ['householdCpi', 'producerPriceIndex']) {
            if (!Number.isFinite(Number(region[field])) || Number(region[field]) <= 0) {
                add('MARKET_INDEX_FINITE', `${at}.${field}`, 'Bolgesel fiyat endeksi sonlu ve pozitif olmali.');
            }
        }
    }
    if (!ledger.countries || typeof ledger.countries !== 'object' || Array.isArray(ledger.countries)) {
        add('MARKET_COUNTRIES_REQUIRED', '$.countries', 'Ulusal fiyat ozetleri nesne olmali.');
    }
    if (!Array.isArray(ledger.events) || ledger.events.length > STORY_MARKET_EVENT_LIMIT) {
        add('MARKET_EVENTS_BOUNDED', '$.events', 'Fiyat olaylari sinirli dizi olmali.');
    }
    return { ok: issues.length === 0, issues };
}

function storyMarketReset(options) {
    if (!storyMarketEnabled()) {
        STORY.marketPrices = null;
        return null;
    }
    STORY.marketPrices = storyMarketLedgerCreate(options);
    return STORY.marketPrices;
}

function storyMarketRestore(saved) {
    if (!storyMarketEnabled()) {
        STORY.marketPrices = null;
        return null;
    }
    if (!saved) return storyMarketReset({ backfilled: true });
    const validation = storyMarketValidate(saved);
    if (!validation.ok) {
        return storyMarketReset({
            backfilled: true,
            restoredFromInvalidLedger: true,
            issues: validation.issues,
            warnings: ['Gecersiz piyasa defteri guvenli baslangic fiyatlariyla yenilendi.']
        });
    }
    STORY.marketPrices = storyMarketClone(saved);
    return STORY.marketPrices;
}

function storyMarketEnsure() {
    if (!storyMarketEnabled()) {
        STORY.marketPrices = null;
        return null;
    }
    if (!STORY.marketPrices) return storyMarketReset({ backfilled: true });
    return STORY.marketPrices;
}

function storyMarketForSave() {
    const ledger = storyMarketEnsure();
    if (!ledger) return null;
    const validation = storyMarketValidate(ledger);
    if (!validation.ok) {
        ledger.diagnostics.warnings = ['Piyasa defteri kayit oncesi dogrulama sorunu tasiyor.'];
        ledger.diagnostics.issues = validation.issues.slice(0, 50);
    }
    return storyMarketClone(ledger);
}

function storyMarketCorridor(corridorId) {
    if (typeof storyInfrastructureGetCorridor === 'function') return storyInfrastructureGetCorridor(corridorId);
    return STORY.infrastructureGraph && (STORY.infrastructureGraph.corridors || [])
        .find(item => item.id === corridorId);
}

function storyMarketInboundIndex() {
    const ledger = STORY.tradeLogistics;
    const index = new Map();
    if (!ledger || !Array.isArray(ledger.shipments)) return index;
    for (const shipment of ledger.shipments) {
        if (!['IN_TRANSIT', 'HELD'].includes(shipment.status)) continue;
        const quantity = Math.max(0, Number(shipment.quantity) || 0);
        const key = `${shipment.targetRegionId}|${shipment.resourceId}`;
        const row = index.get(key) || {
            inTransit: 0,
            held: 0,
            damageWeight: 0,
            quantityWeight: 0
        };
        if (shipment.status === 'HELD') row.held += quantity;
        else row.inTransit += quantity;
        const corridorId = shipment.corridorIds && shipment.corridorIds[shipment.legIndex];
        const corridor = corridorId ? storyMarketCorridor(corridorId) : null;
        const damage = corridor ? storyMarketClamp(corridor.damageBps, 0, 10000) : 0;
        row.damageWeight += damage * quantity;
        row.quantityWeight += quantity;
        index.set(key, row);
    }
    return index;
}

function storyMarketInboundSignals(regionId, resourceId, inboundIndex) {
    const row = inboundIndex && inboundIndex.get(`${regionId}|${resourceId}`);
    if (!row) return { inTransit: 0, held: 0, routeDamageBps: 0 };
    return {
        inTransit: storyMarketRound(row.inTransit),
        held: storyMarketRound(row.held),
        routeDamageBps: row.quantityWeight > 0 ? Math.round(row.damageWeight / row.quantityWeight) : 0
    };
}

function storyMarketSignal(regionId, resourceId, inboundIndex) {
    const regional = STORY.regionalEconomy
        && STORY.regionalEconomy.regions
        && STORY.regionalEconomy.regions[regionId];
    if (!regional) return null;
    const lastTick = regional.lastTick || {};
    const read = (field, fallback) => Math.max(0, Number(lastTick[field] && lastTick[field][resourceId]) || fallback || 0);
    const stock = Math.max(0, Number(regional.stocks[resourceId]) || 0);
    const safeTarget = Math.max(0, Number(regional.safeTargets[resourceId]) || 0);
    const householdAndInstitutionRequested = read('demandRequestedByResource');
    const householdAndInstitutionDelivered = read('demandDeliveredByResource');
    const householdAndInstitutionUnmet = read('demandUnmetByResource');
    const bootstrapPlanning = typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('economy.bootstrapPlanning');
    const productionRequested = bootstrapPlanning ? read('productionRequestedByResource') : 0;
    const productionUnmet = bootstrapPlanning ? read('productionUnmetByResource') : 0;
    const produced = read('producedByResource');
    const productionConsumed = read('productionConsumedByResource');
    const requested = householdAndInstitutionRequested + productionRequested;
    const delivered = householdAndInstitutionDelivered + productionConsumed;
    const unmet = householdAndInstitutionUnmet + productionUnmet;
    const worldDays = Math.max(0, Number(lastTick.worldDays) || 0);
    const inbound = storyMarketInboundSignals(regionId, resourceId, inboundIndex);
    const effectiveStock = stock
        + inbound.inTransit * STORY_MARKET_POLICY.inTransitReliefBps / 10000
        + inbound.held * STORY_MARKET_POLICY.heldReliefBps / 10000;
    const stockCoverageRatio = safeTarget > 1e-9
        ? effectiveStock / safeTarget
        : (requested > 1e-9 ? effectiveStock / requested : 1);
    const fillBps = requested > 1e-9
        ? Math.round(storyMarketClamp(delivered / requested, 0, 1) * 10000)
        : 10000;
    const dailyUse = worldDays > 1e-9 ? requested / worldDays : 0;
    const flowDenominator = Math.max(1, requested, produced);
    const result = {
        stock: storyMarketRound(stock),
        safeTarget: storyMarketRound(safeTarget),
        stockCoverageRatio: storyMarketRound(storyMarketClamp(stockCoverageRatio, 0, 100)),
        stockCoverageDays: dailyUse > 1e-9
            ? storyMarketRound(storyMarketClamp(stock / dailyUse, 0, 9999))
            : null,
        requested: storyMarketRound(requested),
        delivered: storyMarketRound(delivered),
        unmet: storyMarketRound(unmet),
        fillBps,
        produced: storyMarketRound(produced),
        productionConsumed: storyMarketRound(productionConsumed),
        inboundInTransit: inbound.inTransit,
        inboundHeld: inbound.held,
        routeDamageBps: inbound.routeDamageBps,
        flowGapRatio: storyMarketRound(storyMarketClamp((requested - produced) / flowDenominator, -1, 1))
    };
    if (bootstrapPlanning) {
        result.productionRequested = storyMarketRound(productionRequested);
        result.productionUnmet = storyMarketRound(productionUnmet);
    }
    return result;
}

function storyMarketBand(signal) {
    if (!signal) return 'NORMAL';
    if (signal.fillBps < 5000 || signal.stockCoverageRatio < 0.25) return 'CRITICAL';
    if (signal.fillBps < 9000 || signal.stockCoverageRatio < 0.75) return 'TIGHT';
    if (signal.stockCoverageRatio > 2.5 && signal.fillBps >= 9900) return 'SURPLUS';
    return 'NORMAL';
}

// Pure evaluator: harness bu fonksiyonu salinim ve sifir-stok testlerinde kullanir.
function storyMarketEvaluatePrice(resourceId, currentIndex, signal) {
    if (!STORY_MARKET_ACTIVE_RESOURCES.includes(resourceId)) {
        return { status: resourceId === 'labor' ? 'DEFERRED' : 'NUMERAIRE', targetIndex: null, nextIndex: null };
    }
    const current = storyMarketClamp(
        Number(currentIndex) || STORY_MARKET_POLICY.baseIndex,
        STORY_MARKET_POLICY.minIndex,
        STORY_MARKET_POLICY.maxIndex
    );
    const stockRatio = Math.max(0.05, Number(signal && signal.stockCoverageRatio) || 0);
    const fillBps = storyMarketClamp(signal && signal.fillBps, 0, 10000);
    const flowGap = storyMarketClamp(signal && signal.flowGapRatio, -1, 1);
    const heldScale = Math.max(1, Number(signal && signal.safeTarget) || Number(signal && signal.requested) || 1);
    const heldPressure = storyMarketClamp((Number(signal && signal.inboundHeld) || 0) / heldScale, 0, 2);
    const routeDamage = storyMarketClamp(signal && signal.routeDamageBps, 0, 10000) / 10000;
    const scarcityPressure = storyMarketClamp(-Math.log(stockRatio), -1.2, 2.5);
    const shortagePressure = storyMarketClamp(1 - fillBps / 10000, 0, 1);
    const logisticsPressure = storyMarketClamp(heldPressure * 0.65 + routeDamage * 0.35, 0, 1.5);
    const targetMultiplier = storyMarketClamp(
        Math.exp(
            scarcityPressure * 0.45
            + shortagePressure * 0.80
            + flowGap * 0.18
            + logisticsPressure * 0.30
        ),
        STORY_MARKET_POLICY.targetMinMultiplier,
        STORY_MARKET_POLICY.targetMaxMultiplier
    );
    const targetIndex = storyMarketClamp(
        STORY_MARKET_POLICY.baseIndex * targetMultiplier,
        STORY_MARKET_POLICY.minIndex,
        STORY_MARKET_POLICY.maxIndex
    );
    const smooth = current + (targetIndex - current) * STORY_MARKET_POLICY.smoothingAlpha;
    const maxUp = current * (1 + STORY_MARKET_POLICY.maxTickMoveBps / 10000);
    const maxDown = current * (1 - STORY_MARKET_POLICY.maxTickMoveBps / 10000);
    const nextIndex = storyMarketClamp(smooth, maxDown, maxUp);
    return {
        status: 'ACTIVE',
        targetIndex: storyMarketRound(targetIndex),
        nextIndex: storyMarketRound(nextIndex),
        pressures: {
            scarcity: storyMarketRound(scarcityPressure),
            shortage: storyMarketRound(shortagePressure),
            flowGap: storyMarketRound(flowGap),
            logistics: storyMarketRound(logisticsPressure)
        }
    };
}

function storyMarketWeightedIndex(resources, basket) {
    let total = 0;
    let weight = 0;
    for (const [resourceId, resourceWeight] of Object.entries(basket)) {
        const record = resources && resources[resourceId];
        if (!record || record.status !== 'ACTIVE' || !Number.isFinite(Number(record.priceIndex))) continue;
        total += Number(record.priceIndex) * Number(resourceWeight);
        weight += Number(resourceWeight);
    }
    return weight > 0 ? storyMarketRound(total / weight) : 100;
}

function storyMarketRecordBandEvent(ledger, region, resource, previousBand) {
    if (previousBand === resource.band) return;
    ledger.eventSequence++;
    ledger.events.push({
        id: `market-event:${ledger.eventSequence}`,
        at: storyMarketRound(STORY.clock),
        tickSequence: ledger.tickSequence,
        regionId: region.regionId,
        ownerCountryId: region.ownerCountryId,
        resourceId: resource.resourceId,
        fromBand: previousBand,
        toBand: resource.band,
        priceIndex: resource.priceIndex,
        targetIndex: resource.targetIndex
    });
    if (ledger.events.length > STORY_MARKET_EVENT_LIMIT) {
        ledger.events.splice(0, ledger.events.length - STORY_MARKET_EVENT_LIMIT);
    }
}

function storyMarketCountrySummaries(ledger) {
    const countries = {};
    for (const state of (STORY.states || [])) {
        const countryId = storyMarketCountryId(state.id);
        const owned = (STORY.nodes || []).filter(node => Number(node.owner) === Number(state.id));
        let populationWeight = 0;
        let householdTotal = 0;
        let producerTotal = 0;
        const resourceTotals = Object.fromEntries(STORY_MARKET_ACTIVE_RESOURCES.map(id => [id, { total: 0, weight: 0 }]));
        for (const node of owned) {
            const region = ledger.regions[`region:${Number(node.id)}`];
            if (!region) continue;
            const pop = typeof storyRegionalPopulation === 'function'
                ? Math.max(1, storyRegionalPopulation(node))
                : Math.max(1, Number(node.pop) || 1);
            populationWeight += pop;
            householdTotal += region.householdCpi * pop;
            producerTotal += region.producerPriceIndex * pop;
            for (const resourceId of STORY_MARKET_ACTIVE_RESOURCES) {
                resourceTotals[resourceId].total += region.resources[resourceId].priceIndex * pop;
                resourceTotals[resourceId].weight += pop;
            }
        }
        const previous = ledger.countries[countryId];
        const householdCpi = populationWeight > 0 ? storyMarketRound(householdTotal / populationWeight) : 100;
        const producerPriceIndex = populationWeight > 0 ? storyMarketRound(producerTotal / populationWeight) : 100;
        const previousCpi = previous && Number(previous.householdCpi) > 0 ? Number(previous.householdCpi) : 100;
        const tickChangeBps = Math.round((householdCpi / previousCpi - 1) * 10000);
        const priorSmoothed = previous ? Number(previous.smoothedPriceChangeBps) || 0 : 0;
        const prices = {};
        for (const resourceId of STORY_MARKET_ACTIVE_RESOURCES) {
            const row = resourceTotals[resourceId];
            prices[resourceId] = row.weight > 0 ? storyMarketRound(row.total / row.weight) : 100;
        }
        countries[countryId] = {
            countryId,
            regionCount: owned.length,
            householdBasketVersion: 'HOUSEHOLD_BASIC_V1',
            householdCpi,
            producerPriceIndex,
            tickChangeBps,
            smoothedPriceChangeBps: storyMarketRound(priorSmoothed * 0.8 + tickChangeBps * 0.2),
            prices,
            updatedAt: storyMarketRound(STORY.clock),
            legacyInflationBridged: false
        };
    }
    ledger.countries = countries;
}

function storyMarketPriceTick(dtSec) {
    const ledger = storyMarketEnsure();
    if (!ledger) return { disabled: true, regionsProcessed: 0, pricesUpdated: 0 };
    const dt = Math.max(0, Number(dtSec) || 0);
    if (dt <= 0) return { disabled: false, regionsProcessed: 0, pricesUpdated: 0 };
    ledger.tickSequence++;
    ledger.lastTickAt = storyMarketRound(STORY.clock);
    const inboundIndex = storyMarketInboundIndex();
    let pricesUpdated = 0;
    for (const node of (STORY.nodes || [])) {
        const regionId = `region:${Number(node.id)}`;
        const region = ledger.regions[regionId];
        if (!region) continue;
        region.ownerCountryId = storyMarketCountryId(node.owner);
        for (const resourceId of STORY_MARKET_ACTIVE_RESOURCES) {
            const resource = region.resources[resourceId];
            const signal = storyMarketSignal(regionId, resourceId, inboundIndex);
            if (!signal) continue;
            const evaluated = storyMarketEvaluatePrice(resourceId, resource.priceIndex, signal);
            const previousIndex = resource.priceIndex;
            const previousBand = resource.band;
            resource.previousIndex = previousIndex;
            resource.priceIndex = evaluated.nextIndex;
            resource.targetIndex = evaluated.targetIndex;
            resource.lastChangeBps = previousIndex > 0
                ? Math.round((resource.priceIndex / previousIndex - 1) * 10000)
                : 0;
            resource.signals = signal;
            resource.pressures = evaluated.pressures;
            resource.band = storyMarketBand(signal);
            resource.updatedAt = ledger.lastTickAt;
            storyMarketRecordBandEvent(ledger, region, resource, previousBand);
            pricesUpdated++;
        }
        const labor = region.resources.labor;
        labor.updatedAt = ledger.lastTickAt;
        const capital = region.resources.capital;
        capital.updatedAt = ledger.lastTickAt;
        region.householdCpi = storyMarketWeightedIndex(region.resources, STORY_MARKET_POLICY.householdBasket);
        region.producerPriceIndex = storyMarketWeightedIndex(region.resources, STORY_MARKET_POLICY.producerBasket);
        region.updatedAt = ledger.lastTickAt;
    }
    storyMarketCountrySummaries(ledger);
    return {
        disabled: false,
        tickSequence: ledger.tickSequence,
        regionsProcessed: Object.keys(ledger.regions).length,
        pricesUpdated
    };
}

function storyMarketRegionView(regionId) {
    const ledger = storyMarketEnsure();
    const id = storyMarketRegionId(regionId);
    return ledger && ledger.regions[id] ? storyMarketClone(ledger.regions[id]) : null;
}

function storyMarketCountryView(countryId) {
    const ledger = storyMarketEnsure();
    const id = storyMarketCountryId(countryId);
    return ledger && ledger.countries[id] ? storyMarketClone(ledger.countries[id]) : null;
}

function storyMarketTradeQuote(sourceRegionId, targetRegionId, resourceId, quantity) {
    const ledger = storyMarketEnsure();
    const source = ledger && ledger.regions[storyMarketRegionId(sourceRegionId)];
    const target = ledger && ledger.regions[storyMarketRegionId(targetRegionId)];
    const sourcePrice = source && source.resources && source.resources[resourceId];
    const targetPrice = target && target.resources && target.resources[resourceId];
    if (!sourcePrice || !targetPrice
        || sourcePrice.status !== 'ACTIVE' || targetPrice.status !== 'ACTIVE') {
        return {
            status: 'PRICE_UNAVAILABLE',
            unit: STORY_MARKET_POLICY.unit,
            settlementStatus: 'PRICE_QUOTE_UNAVAILABLE'
        };
    }
    const unitIndex = storyMarketRound((Number(sourcePrice.priceIndex) + Number(targetPrice.priceIndex)) / 2);
    const amount = Math.max(0, Number(quantity) || 0);
    return {
        status: 'INDICATIVE_INDEX_QUOTE',
        unit: STORY_MARKET_POLICY.unit,
        resourceId: String(resourceId),
        quantity: storyMarketRound(amount),
        sourceIndex: storyMarketRound(sourcePrice.priceIndex),
        targetIndex: storyMarketRound(targetPrice.priceIndex),
        unitIndex,
        indexedNotional: storyMarketRound(unitIndex * amount),
        quotedAt: storyMarketRound(STORY.clock),
        settlementStatus: 'BUDGET_ESCROW_PRICE_LOCK',
        settlementCurrency: typeof STORY_BUDGET_POLICY !== 'undefined'
            ? STORY_BUDGET_POLICY.currency
            : 'STATE_CREDIT',
        settlementScale: typeof STORY_BUDGET_SETTLEMENT_SCALE === 'number'
            ? STORY_BUDGET_SETTLEMENT_SCALE
            : 0.01,
        createsDebt: false,
        transfersCapital: false
    };
}

function storyMarketSummary() {
    const ledger = storyMarketEnsure();
    if (!ledger) {
        return {
            schemaVersion: STORY_MARKET_SCHEMA_VERSION,
            adapterVersion: STORY_MARKET_ADAPTER_VERSION,
            disabled: true,
            regionCount: 0,
            countryCount: 0
        };
    }
    let activePriceCount = 0;
    let criticalCount = 0;
    let minIndex = Infinity;
    let maxIndex = -Infinity;
    let total = 0;
    for (const region of Object.values(ledger.regions)) {
        for (const resourceId of STORY_MARKET_ACTIVE_RESOURCES) {
            const resource = region.resources[resourceId];
            activePriceCount++;
            if (resource.band === 'CRITICAL') criticalCount++;
            minIndex = Math.min(minIndex, resource.priceIndex);
            maxIndex = Math.max(maxIndex, resource.priceIndex);
            total += resource.priceIndex;
        }
    }
    return {
        schemaVersion: ledger.schemaVersion,
        adapterVersion: ledger.adapterVersion,
        policyHash: ledger.policyHash,
        disabled: false,
        tickSequence: ledger.tickSequence,
        lastTickAt: ledger.lastTickAt,
        regionCount: Object.keys(ledger.regions).length,
        countryCount: Object.keys(ledger.countries).length,
        activePriceCount,
        criticalCount,
        averageIndex: activePriceCount ? storyMarketRound(total / activePriceCount) : 100,
        minIndex: Number.isFinite(minIndex) ? storyMarketRound(minIndex) : 100,
        maxIndex: Number.isFinite(maxIndex) ? storyMarketRound(maxIndex) : 100,
        eventCount: ledger.events.length,
        diagnostics: storyMarketClone(ledger.diagnostics)
    };
}
