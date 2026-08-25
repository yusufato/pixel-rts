// ============================================================================
//  SATIS, ENVANTER VE FATURA DEFTERI — Faz 22.1E
//  --------------------------------------------------------------------------
//  Uretim gelir degildir. Fiziksel cikti once sahibine ait envanter olur;
//  gelir ancak gercek bir alici mali aldiginda yazilir. Bu katman ilk olarak
//  hedefli bayrakla calisir; mevcut Faz 22.1 dengesi kabul kapilari gecilmeden
//  degistirilmez.
// ============================================================================

const STORY_COMMERCE_SCHEMA_VERSION = 1;
const STORY_COMMERCE_ADAPTER_VERSION = 'story-sale-settlement-ledger-1';
const STORY_COMMERCE_INVENTORY_LIMIT = 2400;
const STORY_COMMERCE_INVOICE_LIMIT = 1800;
const STORY_COMMERCE_STATE_CONTRACT_MARGIN_BPS = 1200;
// Faz 28 gerçek ücret/temettü/vergiyi kurana kadar gerçekleşen katma değerin
// çoğu hane geliri vekiliyle kapalı dolaşıma döner; kalan kısım işletme
// sermayesidir. %80 hane havuzunu uzun vadede tüketirken %100 şirketleri kısa
// vadede nakitsiz bıraktı. Bu geçici vekil iki gerçek cüzdan arasında %90/%10
// bölüşür; para yaratmaz ve gerçek ücret katmanı geldiğinde kaldırılacaktır.
const STORY_COMMERCE_HOUSEHOLD_INCOME_SHARE_BPS = 9000;
const STORY_COMMERCE_STATE_PROCUREMENT_RESERVE = 800;
const STORY_COMMERCE_WARTIME_PROCUREMENT_RESERVE = 400;
const STORY_COMMERCE_COMPANY_DISTRIBUTION_RESERVE = 160;
const STORY_COMMERCE_COMPANY_MAINTENANCE_RESERVE = 80;
const STORY_COMMERCE_PHYSICAL_RESOURCES = Object.freeze([
    'food', 'energy', 'raw_materials', 'industrial_parts',
    'electronics', 'military_supplies'
]);
const STORY_COMMERCE_POLICY_HASH = storyProductionHash({
    schemaVersion: STORY_COMMERCE_SCHEMA_VERSION,
    adapterVersion: STORY_COMMERCE_ADAPTER_VERSION,
    physicalResources: STORY_COMMERCE_PHYSICAL_RESOURCES,
    revenueRecognition: 'ON_TITLE_TRANSFER',
    openingOwner: 'MARKET_CLEARING',
    settlement: 'IMMEDIATE_FOR_PROBE',
    institutionalPayers: ['STATE', 'MILITARY'],
    stateContractMarginBps: STORY_COMMERCE_STATE_CONTRACT_MARGIN_BPS,
    householdIncomeShareBps: STORY_COMMERCE_HOUSEHOLD_INCOME_SHARE_BPS,
    householdIncomeModel: 'REALIZED_MARGIN_PROXY_UNTIL_PHASE_28',
    stateProcurementReserve: STORY_COMMERCE_STATE_PROCUREMENT_RESERVE,
    wartimeProcurementReserve: STORY_COMMERCE_WARTIME_PROCUREMENT_RESERVE,
    companyDistributionReserve: STORY_COMMERCE_COMPANY_DISTRIBUTION_RESERVE,
    companyMaintenanceReserve: STORY_COMMERCE_COMPANY_MAINTENANCE_RESERVE
});

function storyCommerceEnabled() {
    return typeof storyFeatureEnabled === 'function'
        && storyFeatureEnabled('economy.saleSettlement');
}

function storyCommerceClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyCommerceRound(value, digits) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    const factor = 10 ** (digits == null ? 6 : digits);
    return Math.round(number * factor) / factor;
}

function storyCommerceRegionCountry(regionId) {
    const nodeId = Number(String(regionId).split(':')[1]);
    const node = STORY.nodes && STORY.nodes[nodeId];
    return node ? `country:${Number(node.owner)}` : null;
}

function storyCommerceUnitPrice(regionId, resourceId) {
    const seq = STORY.regionalEconomy ? Number(STORY.regionalEconomy.tickSequence) || 0 : 0;
    if (!storyCommerceUnitPrice._cache || storyCommerceUnitPrice._cacheSeq !== seq) {
        storyCommerceUnitPrice._cache = new Map();
        storyCommerceUnitPrice._cacheSeq = seq;
    }
    const k = `${regionId}|${resourceId}`;
    if (storyCommerceUnitPrice._cache.has(k)) return storyCommerceUnitPrice._cache.get(k);
    const base = Math.max(0.01, Number(
        typeof STORY_COMPANY_BASE_VALUE !== 'undefined'
            && STORY_COMPANY_BASE_VALUE[resourceId]
    ) || 0.01);
    const index = typeof storyCompanyMarketPrice === 'function'
        ? storyCompanyMarketPrice(regionId, resourceId)
        : 100;
    const price = storyCommerceRound(Math.max(0.01, base * Math.max(1, Number(index) || 100) / 100));
    storyCommerceUnitPrice._cache.set(k, price);
    return price;
}

function storyCommerceCreateLedger(options) {
    const commerce = {
        schemaVersion: STORY_COMMERCE_SCHEMA_VERSION,
        adapterVersion: STORY_COMMERCE_ADAPTER_VERSION,
        policyHash: STORY_COMMERCE_POLICY_HASH,
        inventorySequence: 0,
        invoiceSequence: 0,
        inventories: [],
        invoices: [],
        totals: {
            invoiceCount: 0,
            amount: 0,
            quantity: 0,
            householdIncome: 0,
            countByBuyerType: {},
            amountByBuyerType: {}
        },
        diagnostics: {
            backfilled: !!(options && options.backfilled),
            revenueRecognition: 'ON_TITLE_TRANSFER',
            openingStockOwner: 'MARKET_CLEARING',
            warnings: []
        }
    };
    for (const region of Object.values(
        STORY.regionalEconomy && STORY.regionalEconomy.regions || {}
    )) {
        const countryId = storyCommerceRegionCountry(region.regionId);
        for (const resourceId of STORY_COMMERCE_PHYSICAL_RESOURCES) {
            const quantity = storyCommerceRound(Math.max(0, Number(region.stocks[resourceId]) || 0));
            if (quantity <= 0) continue;
            storyCommerceAddInventoryLot(commerce, {
                regionId: region.regionId,
                resourceId,
                ownerType: 'MARKET_CLEARING',
                ownerId: `market-clearing:${countryId || 'unknown'}`,
                quantity,
                unitCost: storyCommerceUnitPrice(region.regionId, resourceId),
                source: 'OPENING_STOCK'
            });
        }
    }
    return commerce;
}

function storyCommerceEnsure() {
    if (!storyCommerceEnabled() || !STORY.companyEconomy) return null;
    if (!STORY.companyEconomy.commerce) {
        STORY.companyEconomy.commerce = storyCommerceCreateLedger({ backfilled: true });
    }
    const commerce = STORY.companyEconomy.commerce;
    if (!commerce.totals) {
        commerce.totals = {
            invoiceCount: Number(commerce.invoiceSequence) || (commerce.invoices || []).length,
            amount: storyCommerceRound((commerce.invoices || []).reduce(
                (sum, invoice) => sum + Math.max(0, Number(invoice.amount) || 0), 0
            )),
            quantity: storyCommerceRound((commerce.invoices || []).reduce(
                (sum, invoice) => sum + Math.max(0, Number(invoice.quantity) || 0), 0
            )),
            householdIncome: 0,
            countByBuyerType: {},
            amountByBuyerType: {}
        };
        for (const invoice of (commerce.invoices || [])) {
            const buyerType = String(invoice.buyerType || 'UNKNOWN');
            commerce.totals.countByBuyerType[buyerType] =
                (commerce.totals.countByBuyerType[buyerType] || 0) + 1;
            commerce.totals.amountByBuyerType[buyerType] = storyCommerceRound(
                (commerce.totals.amountByBuyerType[buyerType] || 0)
                    + Math.max(0, Number(invoice.amount) || 0)
            );
        }
        commerce.diagnostics.warnings.push('COMMERCE_TOTALS_BACKFILLED_FROM_RETAINED_INVOICES');
    }
    return commerce;
}

function storyCommerceInvalidateInventoryMap(commerce) {
    if (commerce) {
        commerce._inventoryMap = null;
        commerce._inventoryMapRevision = null;
    }
}

function storyCommerceGetInventoryBucket(commerce, regionId, resourceId) {
    if (!commerce || !Array.isArray(commerce.inventories)) return [];
    if (!(commerce._inventoryMap instanceof Map) || commerce._inventoryMapRevision !== commerce.inventories.length) {
        const map = new Map();
        for (const lot of commerce.inventories) {
            if (Number(lot.quantity) > 1e-8) {
                const k = `${lot.regionId}|${lot.resourceId}`;
                let bucket = map.get(k);
                if (!bucket) { bucket = []; map.set(k, bucket); }
                bucket.push(lot);
            }
        }
        commerce._inventoryMap = map;
        commerce._inventoryMapRevision = commerce.inventories.length;
    }
    const key = `${regionId}|${resourceId}`;
    const bucket = commerce._inventoryMap.get(key);
    if (!bucket) return [];
    if (bucket.length > 8) {
        let zeroCount = 0;
        for (let i = 0; i < bucket.length; i++) {
            if (Number(bucket[i].quantity) <= 1e-8) zeroCount++;
        }
        if (zeroCount > 4) {
            const compacted = bucket.filter(row => Number(row.quantity) > 1e-8);
            commerce._inventoryMap.set(key, compacted);
            return compacted;
        }
    }
    return bucket;
}

function storyCommerceAddInventoryLot(commerce, spec) {
    const quantity = storyCommerceRound(Math.max(0, Number(spec.quantity) || 0));
    if (!commerce || quantity <= 0) return null;
    const unitCost = storyCommerceRound(Math.max(0, Number(spec.unitCost) || 0));
    commerce.inventorySequence++;
    const lot = {
        id: `commerce-inventory:${commerce.inventorySequence}`,
        regionId: String(spec.regionId),
        resourceId: String(spec.resourceId),
        ownerType: String(spec.ownerType),
        ownerId: String(spec.ownerId),
        quantity,
        unitCost,
        totalCost: storyCommerceRound(quantity * unitCost),
        source: String(spec.source || 'UNSPECIFIED'),
        correlationId: spec.correlationId || null,
        createdAt: storyCommerceRound(STORY.clock)
    };
    commerce.inventories.push(lot);
    if (commerce.inventories.length > STORY_COMMERCE_INVENTORY_LIMIT) {
        commerce.inventories = commerce.inventories.filter(row => row.quantity > 1e-8);
        storyCommerceInvalidateInventoryMap(commerce);
    } else if (commerce._inventoryMap instanceof Map) {
        // Incrementally add to existing map instead of full rebuild
        const k = `${lot.regionId}|${lot.resourceId}`;
        let bucket = commerce._inventoryMap.get(k);
        if (!bucket) { bucket = []; commerce._inventoryMap.set(k, bucket); }
        bucket.push(lot);
        commerce._inventoryMapRevision = commerce.inventories.length;
    }
    return lot;
}

function storyCommerceInventoryPlan(regionId, resourceId, quantity, preferredOwnerId, companyFirst, requiredOwnerId) {
    const commerce = storyCommerceEnsure();
    const wanted = storyCommerceRound(Math.max(0, Number(quantity) || 0));
    if (!commerce || wanted <= 0) return { ok: false, code: 'COMMERCE_DISABLED', slices: [] };
    const rawLots = storyCommerceGetInventoryBucket(commerce, regionId, resourceId);
    let lots = rawLots.filter(lot => (!requiredOwnerId || lot.ownerId === String(requiredOwnerId)) && Number(lot.quantity) > 1e-8);
    if (lots.length > 1) {
        lots = lots.slice().sort((a, b) => {
            const rank = lot => lot.ownerId === preferredOwnerId
                ? 0
                : (companyFirst
                    ? (lot.ownerType === 'COMPANY' ? 1 : 2)
                    : (lot.ownerType === 'MARKET_CLEARING' ? 1 : 2));
            return rank(a) - rank(b) || a.createdAt - b.createdAt || a.id.localeCompare(b.id);
        });
    }
    let remaining = wanted;
    const slices = [];
    for (const lot of lots) {
        if (remaining <= 1e-8) break;
        const take = storyCommerceRound(Math.min(remaining, Number(lot.quantity) || 0));
        if (take <= 0) continue;
        slices.push({
            lot,
            quantity: take,
            cost: storyCommerceRound(take * Number(lot.unitCost || 0)),
            saleUnitPrice: storyCommerceUnitPrice(regionId, resourceId)
        });
        remaining = storyCommerceRound(remaining - take);
    }
    return {
        ok: remaining <= 1e-7,
        code: remaining <= 1e-7 ? 'INVENTORY_AVAILABLE' : 'COMMERCE_INVENTORY_UNAVAILABLE',
        requested: wanted,
        available: storyCommerceRound(wanted - remaining),
        missing: remaining,
        slices
    };
}

function storyCommerceApplySlices(slices) {
    for (const slice of slices || []) {
        slice.lot.quantity = storyCommerceRound(Math.max(0, Number(slice.lot.quantity) - slice.quantity));
        slice.lot.totalCost = storyCommerceRound(slice.lot.quantity * Number(slice.lot.unitCost || 0));
    }
}

// A regional stock loss must destroy the ownership claim over the same goods.
// Otherwise physical stock decays while the sale ledger continues to report
// inventory that no longer exists. Losses use deterministic FIFO across all
// owners; company-owned slices are impaired at their recorded cost.
function storyCommerceApplyPhysicalLoss(regionId, resourceId, desiredQuantity, reason) {
    const commerce = storyCommerceEnsure();
    const quantity = storyCommerceRound(Math.max(0, Number(desiredQuantity) || 0));
    if (!commerce) return { ok: false, code: 'COMMERCE_LEDGER_MISSING', applied: 0 };
    if (quantity <= 0) return { ok: true, code: 'NO_PHYSICAL_LOSS', applied: 0, cost: 0 };
    const rawLots = storyCommerceGetInventoryBucket(commerce, regionId, resourceId);
    const lots = rawLots
        .filter(lot => Number(lot.quantity) > 1e-8)
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    let remaining = quantity;
    const slices = [];
    const companyCosts = {};
    for (const lot of lots) {
        if (remaining <= 1e-8) break;
        const take = storyCommerceRound(Math.min(remaining, Number(lot.quantity) || 0));
        if (take <= 0) continue;
        const cost = storyCommerceRound(take * Number(lot.unitCost || 0));
        slices.push({ lot, quantity: take, cost });
        if (lot.ownerType === 'COMPANY') {
            companyCosts[lot.ownerId] = storyCommerceRound(
                (companyCosts[lot.ownerId] || 0) + cost
            );
        }
        remaining = storyCommerceRound(remaining - take);
    }
    if (remaining > 1e-7) {
        return {
            ok: false,
            code: 'COMMERCE_PHYSICAL_LOSS_INVENTORY_UNAVAILABLE',
            requested: quantity,
            available: storyCommerceRound(quantity - remaining),
            missing: remaining,
            applied: 0
        };
    }
    for (const [companyId, cost] of Object.entries(companyCosts)) {
        const company = storyCompanyById(companyId);
        if (!company) return { ok: false, code: 'INVENTORY_OWNER_MISSING', companyId, applied: 0 };
        if (Number(company.accounts['ASSET:INVENTORY']) + 1e-5 < cost) {
            return { ok: false, code: 'COMPANY_INVENTORY_IMPAIRMENT_UNFUNDED', companyId, applied: 0 };
        }
    }
    for (const [companyId, cost] of Object.entries(companyCosts)) {
        if (cost <= 0) continue;
        const company = storyCompanyById(companyId);
        const posted = storyCompanyPost(company, 'commerce.inventory_loss', [
            { account: 'EXPENSE:INVENTORY_LOSS', amount: cost },
            { account: 'ASSET:INVENTORY', amount: -cost }
        ], {
            regionId: String(regionId),
            resourceId: String(resourceId),
            reason: String(reason || 'PHYSICAL_LOSS'),
            quantity
        });
        if (!posted.ok) return { ok: false, code: posted.code, companyId, applied: 0 };
        company.cumulative.expense = storyCompanyRound(company.cumulative.expense + cost);
    }
    storyCommerceApplySlices(slices);
    return {
        ok: true,
        code: 'COMMERCE_PHYSICAL_LOSS_APPLIED',
        applied: quantity,
        cost: storyCommerceRound(slices.reduce((sum, slice) => sum + slice.cost, 0)),
        companyCost: storyCommerceRound(Object.values(companyCosts).reduce((sum, cost) => sum + cost, 0))
    };
}

function storyCommerceCargoPlan(regionId, resourceId, desiredQuantity, sellerCompanyId) {
    const requiredSeller = sellerCompanyId ? String(sellerCompanyId) : null;
    const plan = storyCommerceInventoryPlan(
        regionId,
        resourceId,
        desiredQuantity,
        requiredSeller,
        !!requiredSeller,
        requiredSeller
    );
    if (!plan.ok) return plan;
    return {
        ok: true,
        code: 'COMMERCE_CARGO_AVAILABLE',
        regionId: String(regionId),
        resourceId: String(resourceId),
        quantity: storyCommerceRound(desiredQuantity),
        cost: storyCommerceRound(plan.slices.reduce(
            (sum, slice) => sum + Number(slice.cost || 0),
            0
        )),
        slices: plan.slices
    };
}

function storyCommerceDispatchCargo(plan, shipmentId) {
    const commerce = storyCommerceEnsure();
    if (!commerce || !plan || !plan.ok) return { ok: false, code: 'COMMERCE_CARGO_PLAN_REQUIRED' };
    const cargoRegionId = `shipment:${String(shipmentId)}`;
    storyCommerceApplySlices(plan.slices);
    for (const slice of plan.slices) {
        storyCommerceAddInventoryLot(commerce, {
            regionId: cargoRegionId,
            resourceId: plan.resourceId,
            ownerType: slice.lot.ownerType,
            ownerId: slice.lot.ownerId,
            quantity: slice.quantity,
            unitCost: slice.lot.unitCost,
            source: 'TRADE_CARGO',
            correlationId: String(shipmentId)
        });
    }
    return {
        ok: true,
        code: 'COMMERCE_CARGO_DISPATCHED',
        cargoRegionId,
        quantity: plan.quantity,
        cost: plan.cost
    };
}

function storyCommerceCargoQuantity(shipment) {
    const commerce = storyCommerceEnsure();
    if (!commerce || !shipment) return 0;
    const cargoRegionId = shipment.commerceCargoRegionId || `shipment:${String(shipment.id)}`;
    return storyCommerceRound(commerce.inventories
        .filter(lot => lot.regionId === cargoRegionId
            && lot.resourceId === String(shipment.resourceId)
            && Number(lot.quantity) > 1e-8)
        .reduce((sum, lot) => sum + Number(lot.quantity || 0), 0));
}

function storyCommerceCanDeliverCargo(shipment) {
    if (!storyCommerceEnabled()) return { ok: true, code: 'COMMERCE_DISABLED' };
    const quantity = storyCommerceCargoQuantity(shipment);
    return Math.abs(quantity - Number(shipment.quantity || 0)) <= 1e-6
        ? { ok: true, code: 'COMMERCE_CARGO_READY', quantity }
        : { ok: false, code: 'COMMERCE_CARGO_QUANTITY_MISMATCH', quantity };
}

function storyCommerceDeliverCargo(shipment) {
    const ready = storyCommerceCanDeliverCargo(shipment);
    if (!ready.ok) return ready;
    if (!storyCommerceEnabled()) return ready;
    const commerce = storyCommerceEnsure();
    const cargoRegionId = shipment.commerceCargoRegionId || `shipment:${String(shipment.id)}`;
    const effectiveBuyerCompanyId = shipment.beneficialBuyerCompanyId || shipment.buyerCompanyId;
    const effectiveSettlementId = shipment.resaleSettlementReservationId || shipment.settlementReservationId;
    const effectiveSettlementAmount = shipment.resaleSettlementReservationId
        ? shipment.resaleSettlementAmount : shipment.settlementAmount;
    const wholesaleBuyer = effectiveBuyerCompanyId && effectiveSettlementId
        && effectiveBuyerCompanyId !== shipment.sellerCompanyId
        ? String(effectiveBuyerCompanyId)
        : null;
    const wholesaleUnitCost = wholesaleBuyer
        ? storyCommerceRound(
            Number(effectiveSettlementAmount || 0)
                / Math.max(1e-8, Number(shipment.quantity) || 0)
        )
        : null;
    for (const lot of commerce.inventories) {
        if (lot.regionId !== cargoRegionId || lot.resourceId !== String(shipment.resourceId)) continue;
        lot.regionId = String(shipment.targetRegionId);
        if (wholesaleBuyer) {
            lot.ownerType = 'COMPANY';
            lot.ownerId = wholesaleBuyer;
            lot.unitCost = wholesaleUnitCost;
            lot.totalCost = storyCommerceRound(
                Number(lot.quantity || 0) * wholesaleUnitCost
            );
        }
        lot.source = 'TRADE_DELIVERY';
        lot.correlationId = String(shipment.id);
    }
    storyCommerceInvalidateInventoryMap(commerce);
    return { ok: true, code: 'COMMERCE_CARGO_DELIVERED', quantity: ready.quantity };
}

function storyCommerceLoseCargo(shipment, reason) {
    if (!storyCommerceEnabled()) return { ok: true, code: 'COMMERCE_DISABLED' };
    const cargoRegionId = shipment.commerceCargoRegionId || `shipment:${String(shipment.id)}`;
    return storyCommerceApplyPhysicalLoss(
        cargoRegionId,
        shipment.resourceId,
        shipment.quantity,
        reason || 'TRADE_CARGO_LOSS'
    );
}

function storyCommerceMoveInventory(fromRegionId, toRegionId, resourceId, desiredQuantity, source, correlationId) {
    const commerce = storyCommerceEnsure();
    if (!commerce) return { ok: false, code: 'COMMERCE_LEDGER_MISSING', moved: 0 };
    const plan = storyCommerceInventoryPlan(fromRegionId, resourceId, desiredQuantity, null, false);
    if (!plan.ok) return Object.assign({ moved: 0 }, plan);
    storyCommerceApplySlices(plan.slices);
    for (const slice of plan.slices) {
        storyCommerceAddInventoryLot(commerce, {
            regionId: String(toRegionId),
            resourceId: String(resourceId),
            ownerType: slice.lot.ownerType,
            ownerId: slice.lot.ownerId,
            quantity: slice.quantity,
            unitCost: slice.lot.unitCost,
            source: String(source || 'INVENTORY_TRANSFER'),
            correlationId: correlationId || null
        });
    }
    return {
        ok: true,
        code: 'COMMERCE_INVENTORY_MOVED',
        moved: storyCommerceRound(desiredQuantity),
        fromRegionId: String(fromRegionId),
        toRegionId: String(toRegionId)
    };
}

function storyCommerceConsumptionPlan(regionId, resourceId, desiredQuantity) {
    return storyCommerceInventoryPlan(regionId, resourceId, desiredQuantity, null, false);
}

function storyCommerceCommitConsumption(plan, reason, correlationId) {
    if (!plan || !plan.ok) return { ok: false, code: 'COMMERCE_CONSUMPTION_PLAN_REQUIRED' };
    const companyCosts = {};
    for (const slice of plan.slices) {
        if (slice.lot.ownerType !== 'COMPANY') continue;
        companyCosts[slice.lot.ownerId] = storyCommerceRound(
            (companyCosts[slice.lot.ownerId] || 0) + slice.cost
        );
    }
    for (const [companyId, cost] of Object.entries(companyCosts)) {
        const company = storyCompanyById(companyId);
        if (!company || Number(company.accounts['ASSET:INVENTORY']) + 1e-5 < cost) {
            return { ok: false, code: 'COMMERCE_CONSUMPTION_OWNER_INVALID', companyId };
        }
    }
    for (const [companyId, cost] of Object.entries(companyCosts)) {
        if (cost <= 0) continue;
        const company = storyCompanyById(companyId);
        const posted = storyCompanyPost(company, 'commerce.inventory_consumption', [
            { account: 'EXPENSE:INPUT_CONSUMPTION', amount: cost },
            { account: 'ASSET:INVENTORY', amount: -cost }
        ], {
            reason: String(reason || 'PHYSICAL_INPUT_CONSUMPTION'),
            correlationId: correlationId || null
        });
        if (!posted.ok) return posted;
        company.cumulative.expense = storyCompanyRound(company.cumulative.expense + cost);
    }
    storyCommerceApplySlices(plan.slices);
    return {
        ok: true,
        code: 'COMMERCE_INVENTORY_CONSUMED',
        quantity: storyCommerceRound(plan.slices.reduce((sum, slice) => sum + slice.quantity, 0)),
        cost: storyCommerceRound(plan.slices.reduce((sum, slice) => sum + slice.cost, 0))
    };
}

function storyCommerceRecordInvoice(commerce, spec) {
    commerce.invoiceSequence++;
    const invoice = {
        id: `commerce-invoice:${commerce.invoiceSequence}`,
        status: 'SETTLED',
        createdAt: storyCommerceRound(STORY.clock),
        settledAt: storyCommerceRound(STORY.clock),
        sellerType: String(spec.sellerType),
        sellerId: String(spec.sellerId),
        buyerType: String(spec.buyerType),
        buyerId: String(spec.buyerId),
        regionId: String(spec.regionId),
        resourceId: String(spec.resourceId),
        quantity: storyCommerceRound(spec.quantity),
        unitPrice: storyCommerceRound(spec.unitPrice),
        amount: storyCommerceRound(spec.amount),
        costAmount: storyCommerceRound(spec.costAmount || 0),
        correlationId: spec.correlationId || null
    };
    commerce.invoices.push(invoice);
    const buyerType = invoice.buyerType || 'UNKNOWN';
    commerce.totals.invoiceCount++;
    commerce.totals.amount = storyCommerceRound(commerce.totals.amount + invoice.amount);
    commerce.totals.quantity = storyCommerceRound(commerce.totals.quantity + invoice.quantity);
    commerce.totals.countByBuyerType[buyerType] =
        (commerce.totals.countByBuyerType[buyerType] || 0) + 1;
    commerce.totals.amountByBuyerType[buyerType] = storyCommerceRound(
        (commerce.totals.amountByBuyerType[buyerType] || 0) + invoice.amount
    );
    if (commerce.invoices.length > STORY_COMMERCE_INVOICE_LIMIT) {
        commerce.invoices.splice(0, commerce.invoices.length - STORY_COMMERCE_INVOICE_LIMIT);
    }
    return invoice;
}

function storyCommerceProductionPlan(regionId, transaction, company) {
    const physicalInputs = Object.entries(transaction.consumed || {})
        .filter(([resourceId, quantity]) => STORY_COMMERCE_PHYSICAL_RESOURCES.includes(resourceId)
            && Number(quantity) > 1e-8);
    const inputPlans = [];
    const workingCapitalRequired = Math.max(0, Number(
        transaction.consumed && transaction.consumed.capital
    ) || 0);
    let purchaseCashRequired = 0;
    let outputCost = 0;
    for (const [resourceId, quantity] of physicalInputs) {
        const plan = storyCommerceInventoryPlan(regionId, resourceId, quantity, company.id, false);
        if (!plan.ok) return Object.assign({ resourceId }, plan);
        for (const slice of plan.slices) {
            if (slice.lot.ownerId === company.id) {
                outputCost += slice.cost;
            } else {
                const purchase = storyCommerceRound(slice.quantity * slice.saleUnitPrice);
                purchaseCashRequired += purchase;
                outputCost += purchase;
            }
        }
        inputPlans.push({ resourceId, plan });
    }
    // OPERATING_CAPITAL expresses the minimum liquid balance needed to run a
    // cycle. It is not destroyed and is not capitalized into inventory. The
    // actual cash outflow is the purchase of physical inputs; requiring the
    // greater of both values prevents unfunded production without double-pay.
    const cashRequired = Math.max(workingCapitalRequired, purchaseCashRequired);
    return {
        ok: Number(company.accounts['ASSET:CASH']) + 1e-6 >= cashRequired,
        code: Number(company.accounts['ASSET:CASH']) + 1e-6 >= cashRequired
            ? 'COMMERCE_PRODUCTION_FUNDED'
            : 'COMPANY_COMMERCE_CASH_UNAVAILABLE',
        inputPlans,
        cashRequired: storyCommerceRound(cashRequired),
        workingCapitalRequired: storyCommerceRound(workingCapitalRequired),
        purchaseCashRequired: storyCommerceRound(purchaseCashRequired),
        operatingCost: 0,
        outputCost: storyCommerceRound(outputCost)
    };
}

function storyCommerceCanCommitProduction(regionId, transaction) {
    const company = typeof storyCompanyForRegionSector === 'function'
        ? storyCompanyForRegionSector(regionId, transaction.sectorId)
        : null;
    if (!company) return { ok: false, code: 'PRODUCTION_COMPANY_MISSING' };
    const plan = storyCommerceProductionPlan(regionId, transaction, company);
    return plan.ok ? { ok: true, plan } : plan;
}

function storyCommercePostSellerSale(seller, saleAmount, costAmount, details) {
    const bookedInventory = Math.max(0, Number(
        seller.accounts && seller.accounts['ASSET:INVENTORY']
    ) || 0);
    const bookedCostAmount = storyCommerceRound(Math.min(
        Math.max(0, Number(costAmount) || 0),
        bookedInventory
    ));
    const roundingDifference = storyCommerceRound(
        Math.max(0, Number(costAmount) || 0) - bookedCostAmount
    );
    if (roundingDifference > 0.02) {
        const commerce = storyCommerceEnsure();
        if (commerce && commerce.diagnostics) {
            commerce.diagnostics.warnings.push(
                `SELLER_INVENTORY_COST_SHORTFALL:${seller.id}:${roundingDifference}`
            );
            commerce.diagnostics.warnings = commerce.diagnostics.warnings.slice(-30);
        }
    }
    const posted = storyCompanyPost(seller, 'commerce.sale', [
        { account: 'ASSET:CASH', amount: saleAmount },
        { account: 'REVENUE:SALES', amount: -saleAmount },
        { account: 'EXPENSE:COGS', amount: bookedCostAmount },
        { account: 'ASSET:INVENTORY', amount: -bookedCostAmount }
    ], details);
    if (!posted.ok) return posted;
    const targetHouseholdIncome = Math.max(0, saleAmount - bookedCostAmount)
        * STORY_COMMERCE_HOUSEHOLD_INCOME_SHARE_BPS / 10000;
    const distributableCash = Math.max(
        0,
        Number(seller.accounts['ASSET:CASH'])
            - STORY_COMMERCE_COMPANY_DISTRIBUTION_RESERVE
    );
    const householdIncome = storyCommerceRound(Math.min(
        targetHouseholdIncome,
        distributableCash
    ));
    if (householdIncome > 0) {
        const distributed = storyCompanyPost(seller, 'commerce.household_income_proxy', [
            { account: 'EXPENSE:LABOR_INCOME_PROXY', amount: householdIncome },
            { account: 'ASSET:CASH', amount: -householdIncome }
        ], Object.assign({}, details || {}, {
            model: 'REALIZED_MARGIN_PROXY_UNTIL_PHASE_28'
        }));
        if (!distributed.ok) return distributed;
        STORY.companyEconomy.marketClearingCash = storyCommerceRound(
            STORY.companyEconomy.marketClearingCash + householdIncome
        );
        const commerce = storyCommerceEnsure();
        commerce.totals.householdIncome = storyCommerceRound(
            (Number(commerce.totals.householdIncome) || 0) + householdIncome
        );
    }
    seller.cumulative.revenue = storyCompanyRound(seller.cumulative.revenue + saleAmount);
    seller.cumulative.expense = storyCompanyRound(
        seller.cumulative.expense + bookedCostAmount + householdIncome
    );
    posted.costAmount = bookedCostAmount;
    posted.roundingDifference = roundingDifference;
    posted.householdIncome = householdIncome;
    return posted;
}

function storyCommerceOnProductionCommitted(regionId, transaction, company) {
    const commerce = storyCommerceEnsure();
    if (!commerce || !company) return { ok: false, code: 'COMMERCE_LEDGER_MISSING' };
    const plan = transaction._commercePlan || storyCommerceProductionPlan(regionId, transaction, company);
    if (!plan.ok) return plan;
    let acquiredCost = 0;
    for (const input of plan.inputPlans) {
        for (const slice of input.plan.slices) {
            if (slice.lot.ownerId === company.id) continue;
            const amount = storyCommerceRound(slice.quantity * slice.saleUnitPrice);
            let sellerCost = slice.cost;
            if (slice.lot.ownerType === 'COMPANY') {
                const seller = storyCompanyById(slice.lot.ownerId);
                if (!seller) return { ok: false, code: 'INVENTORY_SELLER_MISSING' };
                const sold = storyCommercePostSellerSale(seller, amount, slice.cost, {
                    correlationId: transaction.id,
                    buyerCompanyId: company.id,
                    resourceId: input.resourceId
                });
                if (!sold.ok) return sold;
                sellerCost = sold.costAmount;
            } else {
                STORY.companyEconomy.marketClearingCash = storyCommerceRound(
                    STORY.companyEconomy.marketClearingCash + amount
                );
            }
            const bought = storyCompanyPost(company, 'commerce.input_purchase', [
                { account: 'ASSET:INVENTORY', amount },
                { account: 'ASSET:CASH', amount: -amount }
            ], { correlationId: transaction.id, resourceId: input.resourceId });
            if (!bought.ok) return bought;
            acquiredCost += amount;
            storyCommerceRecordInvoice(commerce, {
                sellerType: slice.lot.ownerType,
                sellerId: slice.lot.ownerId,
                buyerType: 'COMPANY',
                buyerId: company.id,
                regionId,
                resourceId: input.resourceId,
                quantity: slice.quantity,
                unitPrice: slice.saleUnitPrice,
                amount,
                costAmount: sellerCost,
                correlationId: transaction.id
            });
        }
        storyCommerceApplySlices(input.plan.slices);
    }
    const outputs = Object.entries(transaction.produced || {})
        .filter(([resourceId, quantity]) => STORY_COMMERCE_PHYSICAL_RESOURCES.includes(resourceId)
            && Number(quantity) > 1e-8);
    const outputValue = outputs.reduce((sum, [resourceId, quantity]) => (
        sum + Number(quantity) * storyCommerceUnitPrice(regionId, resourceId)
    ), 0);
    let assignedCost = 0;
    outputs.forEach(([resourceId, quantity], index) => {
        const isLast = index === outputs.length - 1;
        const share = outputValue > 0
            ? Number(quantity) * storyCommerceUnitPrice(regionId, resourceId) / outputValue
            : 1 / Math.max(1, outputs.length);
        const totalCost = isLast
            ? storyCommerceRound(plan.outputCost - assignedCost)
            : storyCommerceRound(plan.outputCost * share);
        assignedCost = storyCommerceRound(assignedCost + totalCost);
        storyCommerceAddInventoryLot(commerce, {
            regionId,
            resourceId,
            ownerType: 'COMPANY',
            ownerId: company.id,
            quantity,
            unitCost: Number(quantity) > 0 ? totalCost / Number(quantity) : 0,
            source: 'PRODUCTION',
            correlationId: transaction.id
        });
    });
    company.cumulative.productionCycles = storyCompanyRound(
        company.cumulative.productionCycles + Math.max(0, Number(transaction.cycles) || 0)
    );
    company.lastResult = {
        at: storyCompanyRound(STORY.clock),
        regionId: storyCompanyRegionId(regionId),
        revenue: 0,
        expense: 0,
        inventoryCost: plan.outputCost,
        workingCapitalRequired: plan.workingCapitalRequired,
        profit: 0,
        revenueRecognition: 'DEFERRED_UNTIL_SALE'
    };
    return {
        ok: true,
        companyId: company.id,
        revenue: 0,
        operatingCost: plan.operatingCost,
        workingCapitalRequired: plan.workingCapitalRequired,
        purchaseCashRequired: plan.purchaseCashRequired,
        acquiredInputCost: storyCommerceRound(acquiredCost),
        inventoryCost: plan.outputCost,
        revenueRecognition: 'DEFERRED_UNTIL_SALE'
    };
}

function storyCommerceSettleDemand(regionId, demand, desiredQuantity) {
    const commerce = storyCommerceEnsure();
    if (!commerce) return { ok: false, code: 'COMMERCE_LEDGER_MISSING', delivered: 0 };
    const consumerType = String(demand.consumerType || '');
    const buyerCompanyId = demand.buyerCompanyId ? String(demand.buyerCompanyId) : null;
    const institutionalBuyer = ['STATE', 'MILITARY'].includes(consumerType);
    const payerCountryId = institutionalBuyer
        ? String(demand.payerId || storyCommerceRegionCountry(regionId) || '')
        : null;
    if (consumerType !== 'HOUSEHOLDS' && !buyerCompanyId && !institutionalBuyer) {
        return { ok: false, code: 'COMMERCE_PAYER_REQUIRED', delivered: 0 };
    }
    if (institutionalBuyer && !/^country:\d+$/.test(payerCountryId)) {
        return { ok: false, code: 'COMMERCE_STATE_PAYER_REQUIRED', delivered: 0 };
    }
    const plan = storyCommerceInventoryPlan(
        regionId,
        demand.resourceId,
        desiredQuantity,
        buyerCompanyId,
        true
    );
    if (!plan.slices.length) return { ok: false, code: plan.code, delivered: 0 };
    let delivered = 0;
    let invoiceCount = 0;
    const usedSlices = [];
    for (const original of plan.slices) {
        let quantity = original.quantity;
        const sellerCompany = original.lot.ownerType === 'COMPANY'
            ? storyCompanyById(original.lot.ownerId)
            : null;
        let unitPrice = original.saleUnitPrice;
        if (consumerType === 'HOUSEHOLDS' && sellerCompany) {
            quantity = storyCommerceRound(Math.min(
                quantity,
                Number(STORY.companyEconomy.marketClearingCash) / Math.max(0.01, unitPrice)
            ));
            if (quantity <= 0) break;
            const amount = storyCommerceRound(quantity * unitPrice);
            const cost = storyCommerceRound(quantity * Number(original.lot.unitCost || 0));
            const sold = storyCommercePostSellerSale(sellerCompany, amount, cost, {
                correlationId: demand.id,
                buyerType: 'HOUSEHOLDS',
                resourceId: demand.resourceId
            });
            if (!sold.ok) break;
            STORY.companyEconomy.marketClearingCash = storyCommerceRound(
                STORY.companyEconomy.marketClearingCash - amount
            );
            storyCommerceRecordInvoice(commerce, {
                sellerType: 'COMPANY', sellerId: sellerCompany.id,
                buyerType: 'HOUSEHOLDS', buyerId: `households:${regionId}`,
                regionId, resourceId: demand.resourceId, quantity, unitPrice,
                amount, costAmount: sold.costAmount, correlationId: demand.id
            });
            invoiceCount++;
        } else if (institutionalBuyer) {
            if (consumerType === 'MILITARY' && demand.resourceId === 'military_supplies') {
                unitPrice = storyCommerceRound(Math.max(
                    unitPrice,
                    Number(original.lot.unitCost || 0)
                        * (1 + STORY_COMMERCE_STATE_CONTRACT_MARGIN_BPS / 10000)
                ));
            }
            const payerState = typeof storyBudgetState === 'function'
                ? storyBudgetState(payerCountryId)
                : null;
            const treasuryCash = payerState && typeof storyBudgetWalletCash === 'function'
                ? storyBudgetWalletCash(payerState)
                : 0;
            const payerStateId = Number(String(payerCountryId).split(':')[1]);
            const atWar = Number.isInteger(payerStateId) && (STORY.states || []).some(state => (
                Number(state.id) !== payerStateId
                && typeof storyIsHostile === 'function'
                && storyIsHostile(payerStateId, Number(state.id))
            ));
            const treasuryReserve = atWar && consumerType === 'MILITARY'
                ? STORY_COMMERCE_WARTIME_PROCUREMENT_RESERVE
                : STORY_COMMERCE_STATE_PROCUREMENT_RESERVE;
            const availableCash = Math.max(0, treasuryCash - treasuryReserve);
            quantity = storyCommerceRound(Math.min(
                quantity,
                availableCash / Math.max(0.01, unitPrice)
            ));
            if (quantity <= 0) break;
            const amount = storyCommerceRound(quantity * unitPrice);
            const cost = storyCommerceRound(quantity * Number(original.lot.unitCost || 0));
            let sellerCost = cost;
            const paid = typeof storyBudgetDebit === 'function'
                ? storyBudgetDebit(payerCountryId, amount, 'institutional.procurement', {
                    correlationId: demand.id
                })
                : { ok: false, code: 'BUDGET_PAYMENT_UNAVAILABLE' };
            if (!paid.ok) break;
            if (sellerCompany) {
                const sold = storyCommercePostSellerSale(sellerCompany, amount, cost, {
                    correlationId: demand.id,
                    buyerType: consumerType,
                    payerCountryId,
                    resourceId: demand.resourceId
                });
                if (!sold.ok) break;
                sellerCost = sold.costAmount;
            } else {
                STORY.companyEconomy.marketClearingCash = storyCommerceRound(
                    STORY.companyEconomy.marketClearingCash + amount
                );
            }
            STORY.companyEconomy.externalMoneyInflow = storyCommerceRound(
                STORY.companyEconomy.externalMoneyInflow + amount
            );
            storyCommerceRecordInvoice(commerce, {
                sellerType: original.lot.ownerType,
                sellerId: original.lot.ownerId,
                buyerType: consumerType,
                buyerId: payerCountryId,
                regionId,
                resourceId: demand.resourceId,
                quantity,
                unitPrice,
                amount,
                costAmount: sellerCost,
                correlationId: demand.id
            });
            invoiceCount++;
        } else if (buyerCompanyId && original.lot.ownerId !== buyerCompanyId) {
            const buyer = storyCompanyById(buyerCompanyId);
            if (!buyer) break;
            quantity = storyCommerceRound(Math.min(
                quantity,
                Math.max(
                    0,
                    Number(buyer.accounts['ASSET:CASH'])
                        - STORY_COMMERCE_COMPANY_MAINTENANCE_RESERVE
                ) / Math.max(0.01, unitPrice)
            ));
            if (quantity <= 0) break;
            const amount = storyCommerceRound(quantity * unitPrice);
            const cost = storyCommerceRound(quantity * Number(original.lot.unitCost || 0));
            let sellerCost = cost;
            if (sellerCompany) {
                const sold = storyCommercePostSellerSale(sellerCompany, amount, cost, {
                    correlationId: demand.id,
                    buyerCompanyId,
                    resourceId: demand.resourceId
                });
                if (!sold.ok) break;
                sellerCost = sold.costAmount;
            } else {
                STORY.companyEconomy.marketClearingCash = storyCommerceRound(
                    STORY.companyEconomy.marketClearingCash + amount
                );
            }
            const consumed = storyCompanyPost(buyer, 'commerce.direct_consumption', [
                { account: 'EXPENSE:INPUT_CONSUMPTION', amount },
                { account: 'ASSET:CASH', amount: -amount }
            ], { correlationId: demand.id, resourceId: demand.resourceId });
            if (!consumed.ok) break;
            storyCommerceRecordInvoice(commerce, {
                sellerType: original.lot.ownerType, sellerId: original.lot.ownerId,
                buyerType: 'COMPANY', buyerId: buyerCompanyId,
                regionId, resourceId: demand.resourceId, quantity, unitPrice,
                amount, costAmount: sellerCost, correlationId: demand.id
            });
            invoiceCount++;
        } else if (buyerCompanyId && original.lot.ownerId === buyerCompanyId) {
            const buyer = storyCompanyById(buyerCompanyId);
            const cost = storyCommerceRound(quantity * Number(original.lot.unitCost || 0));
            const consumed = storyCompanyPost(buyer, 'commerce.own_inventory_consumption', [
                { account: 'EXPENSE:INPUT_CONSUMPTION', amount: cost },
                { account: 'ASSET:INVENTORY', amount: -cost }
            ], { correlationId: demand.id, resourceId: demand.resourceId });
            if (!consumed.ok) break;
        }
        usedSlices.push(Object.assign({}, original, { quantity }));
        delivered = storyCommerceRound(delivered + quantity);
        if (delivered >= desiredQuantity - 1e-7) break;
    }
    storyCommerceApplySlices(usedSlices);
    return {
        ok: delivered > 0,
        code: delivered > 0 ? 'COMMERCE_SALE_SETTLED' : 'COMMERCE_PAYMENT_UNAVAILABLE',
        delivered,
        summary: {
            status: delivered >= desiredQuantity - 1e-7 ? 'SETTLED' : 'PARTIAL',
            delivered,
            invoiceCount,
            revenueRecognition: 'ON_TITLE_TRANSFER'
        }
    };
}

function storyCommerceValidate(commerce, companyLedger, options) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!commerce || typeof commerce !== 'object') {
        return { ok: false, issues: [{ code: 'COMMERCE_LEDGER_MISSING', path: '$.commerce', message: 'Satis defteri yok.' }] };
    }
    if (commerce.schemaVersion !== STORY_COMMERCE_SCHEMA_VERSION) add('COMMERCE_SCHEMA_VERSION', '$.commerce.schemaVersion', 'Sema surumu uyusmuyor.');
    if (commerce.adapterVersion !== STORY_COMMERCE_ADAPTER_VERSION) add('COMMERCE_ADAPTER_VERSION', '$.commerce.adapterVersion', 'Adapter surumu uyusmuyor.');
    if (commerce.policyHash !== STORY_COMMERCE_POLICY_HASH) add('COMMERCE_POLICY_HASH', '$.commerce.policyHash', 'Politika karmasi uyusmuyor.');
    const physical = {};
    const companyInventoryCost = {};
    for (let index = 0; index < (commerce.inventories || []).length; index++) {
        const lot = commerce.inventories[index];
        const at = `$.commerce.inventories[${index}]`;
        if (!lot || !STORY_COMMERCE_PHYSICAL_RESOURCES.includes(lot.resourceId)) {
            add('COMMERCE_INVENTORY_RESOURCE', `${at}.resourceId`, 'Gecersiz fiziksel kaynak.');
            continue;
        }
        if (!Number.isFinite(Number(lot.quantity)) || Number(lot.quantity) < -1e-7) add('COMMERCE_INVENTORY_QUANTITY', `${at}.quantity`, 'Miktar negatif olmayan sonlu sayi olmali.');
        if (!Number.isFinite(Number(lot.totalCost)) || Number(lot.totalCost) < -1e-7) add('COMMERCE_INVENTORY_COST', `${at}.totalCost`, 'Maliyet negatif olmayan sonlu sayi olmali.');
        const key = `${lot.regionId}|${lot.resourceId}`;
        physical[key] = storyCommerceRound((physical[key] || 0) + Math.max(0, Number(lot.quantity) || 0));
        if (lot.ownerType === 'COMPANY') {
            if (!companyLedger.companies[lot.ownerId]) add('COMMERCE_INVENTORY_OWNER', `${at}.ownerId`, 'Envanter sahibi sirket yok.');
            companyInventoryCost[lot.ownerId] = storyCommerceRound(
                (companyInventoryCost[lot.ownerId] || 0) + Math.max(0, Number(lot.totalCost) || 0)
            );
        }
    }
    for (const [companyId, company] of Object.entries(companyLedger.companies || {})) {
        const booked = storyCommerceRound(Number(company.accounts && company.accounts['ASSET:INVENTORY']) || 0);
        const lots = storyCommerceRound(companyInventoryCost[companyId] || 0);
        if (Math.abs(booked - lots) > 0.02) {
            add('COMMERCE_COMPANY_INVENTORY_MISMATCH', `$.companies.${companyId}.accounts.ASSET:INVENTORY`, `Defter ${booked}, lot maliyeti ${lots}.`);
        }
    }
    for (let index = 0; index < (commerce.invoices || []).length; index++) {
        const invoice = commerce.invoices[index];
        if (!invoice || invoice.status !== 'SETTLED'
            || !Number.isFinite(Number(invoice.amount)) || Number(invoice.amount) < 0) {
            add('COMMERCE_INVOICE_INVALID', `$.commerce.invoices[${index}]`, 'Fatura durumu veya tutari gecersiz.');
        }
    }
    if (!commerce.totals
        || !Number.isFinite(Number(commerce.totals.invoiceCount))
        || Number(commerce.totals.invoiceCount) < (commerce.invoices || []).length
        || !Number.isFinite(Number(commerce.totals.amount))
        || Number(commerce.totals.amount) < -1e-7) {
        add('COMMERCE_TOTALS_INVALID', '$.commerce.totals', 'Kumulatif satis toplamları gecersiz.');
    }
    if (options && options.checkPhysicalMirrors) {
        for (const region of Object.values(
            STORY.regionalEconomy && STORY.regionalEconomy.regions || {}
        )) {
            for (const resourceId of STORY_COMMERCE_PHYSICAL_RESOURCES) {
                const key = `${region.regionId}|${resourceId}`;
                const stock = storyCommerceRound(Math.max(0, Number(region.stocks[resourceId]) || 0));
                const owned = storyCommerceRound(physical[key] || 0);
                if (Math.abs(stock - owned) > 1e-4) {
                    add('COMMERCE_PHYSICAL_MIRROR_MISMATCH', `$.commerce.inventories.${key}`, `Stok ${stock}, sahipli lot ${owned}.`);
                }
            }
        }
    }
    return { ok: issues.length === 0, issues };
}

function storyCommerceSummary() {
    const commerce = storyCommerceEnsure();
    if (!commerce) return { disabled: true };
    return {
        schemaVersion: commerce.schemaVersion,
        adapterVersion: commerce.adapterVersion,
        disabled: false,
        inventoryLots: commerce.inventories.filter(row => row.quantity > 1e-8).length,
        invoices: commerce.invoices.length,
        cumulativeInvoices: Number(commerce.totals.invoiceCount) || 0,
        cumulativeAmount: storyCommerceRound(commerce.totals.amount),
        householdIncome: storyCommerceRound(commerce.totals.householdIncome),
        countByBuyerType: storyCommerceClone(commerce.totals.countByBuyerType),
        amountByBuyerType: storyCommerceClone(commerce.totals.amountByBuyerType),
        companyOwnedQuantity: storyCommerceRound(commerce.inventories
            .filter(row => row.ownerType === 'COMPANY')
            .reduce((sum, row) => sum + Number(row.quantity || 0), 0)),
        marketClearingCash: storyCommerceRound(STORY.companyEconomy.marketClearingCash),
        revenueRecognition: commerce.diagnostics.revenueRecognition
    };
}
