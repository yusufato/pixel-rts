// ============================================================================
//  TİCARET SÖZLEŞMELERİ VE FİZİKSEL LOJİSTİK — Faz 18
//  --------------------------------------------------------------------------
//  Bu katman stok üretmez. Mal, gönderici stoğundan atomik olarak çıkar;
//  koridorlar üzerinde gecikmeli ilerler ve yalnız fiziksel teslimatta alıcı
//  stoğuna girer. Kalıcı Faz 18 şeması "CLEARING_PENDING_PRICE" alanını korur;
//  Faz 19 salt-okunur endeks teklifi uretir. Faz 20 sinir otesi sevkte
//  alici butcesinden escrow ayirir ve fiziksel teslimatta saticiya aktarir.
// ============================================================================

const STORY_TRADE_SCHEMA_VERSION = 1;
const STORY_TRADE_ADAPTER_VERSION = 'story-trade-logistics-ledger-1';
const STORY_TRADE_ORDER_LIMIT = 600;
const STORY_TRADE_SHIPMENT_LIMIT = 800;
const STORY_TRADE_AMENDMENT_LIMIT = 300;
const STORY_TRADE_MAX_AUTO_DISPATCHES = 48;
const STORY_TRADE_MAX_OPEN_DISPATCH_ATTEMPTS = 48;
const STORY_TRADE_RETRY_BASE_SECONDS = 8;
const STORY_TRADE_RETRY_MAX_SECONDS = 64;
const STORY_TRADE_MAX_PRODUCTION_INPUT_DISPATCHES = 18;
const STORY_TRADE_PRODUCTION_PIPELINE_WINDOWS = 4;
const STORY_TRADE_DISTRIBUTION_ADAPTER_VERSION = 'story-domestic-distribution-contract-1';
const STORY_TRADE_DISTRIBUTION_MAX_LEGS = 8;
const STORY_TRADE_DISTRIBUTION_BATCH_LIMIT = 40;
const STORY_TRADE_PRODUCTION_INPUT_DISPATCH_LIMITS = Object.freeze({
    industrial_parts: 6,
    energy: 6,
    raw_materials: 4,
    electronics: 2
});
const STORY_TRADE_TRANSPORTABLE = Object.freeze(
    STORY_RESOURCE_DEFINITIONS
        .filter(definition => !definition.transportModes.includes('NOT_TRANSPORTED')
            && !definition.transportModes.includes('FINANCIAL_NETWORK'))
        .map(definition => definition.id)
);

const STORY_TRADE_POLICY = Object.freeze({
    exportReserveBps: 12500,
    importTargetBps: 10000,
    maxAutoDispatches: STORY_TRADE_MAX_AUTO_DISPATCHES,
    titleTransfer: 'ON_PHYSICAL_DELIVERY',
    settlement: 'CLEARING_PENDING_PRICE',
    thirdPartyTransit: false
});

const STORY_TRADE_POLICY_HASH = storyProductionHash({
    schemaVersion: STORY_TRADE_SCHEMA_VERSION,
    adapterVersion: STORY_TRADE_ADAPTER_VERSION,
    resourceCatalogHash: STORY_RESOURCE_CATALOG_HASH,
    policy: STORY_TRADE_POLICY,
    transportable: STORY_TRADE_TRANSPORTABLE
});

function storyTradeEnabled() {
    return (typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('economy.tradeLogistics'))
        && (typeof storyRegionalEnabled !== 'function' || storyRegionalEnabled())
        && (typeof storyInfrastructureEnabled !== 'function' || storyInfrastructureEnabled());
}

function storyTradeClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyTradeRound(value, digits) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    const factor = 10 ** (digits == null ? 6 : digits);
    return Math.round(number * factor) / factor;
}

function storyTradeBootstrapPlanningEnabled() {
    return typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('economy.bootstrapPlanning');
}

function storyTradeRecordDispatchFailure(order, result) {
    if (!order || !result || result.ok) return;
    order.lastFailure = result.code || 'DISPATCH_FAILED';
    if (!storyTradeBootstrapPlanningEnabled()) return;
    const failures = Math.max(0, Number(order.dispatchFailureCount) || 0) + 1;
    const exponent = Math.min(3, Math.max(0, failures - 1));
    const delaySeconds = Math.min(
        STORY_TRADE_RETRY_MAX_SECONDS,
        STORY_TRADE_RETRY_BASE_SECONDS * (2 ** exponent)
    );
    order.dispatchFailureCount = failures;
    order.lastAttemptAt = storyTradeRound(STORY.clock);
    order.nextRetryAt = storyTradeRound(Number(STORY.clock) + delaySeconds);
    order.updatedAt = storyTradeRound(STORY.clock);
}

function storyTradeClearDispatchFailure(order) {
    if (!order || !storyTradeBootstrapPlanningEnabled()) return;
    order.dispatchFailureCount = 0;
    order.lastFailure = null;
    order.lastAttemptAt = storyTradeRound(STORY.clock);
    order.nextRetryAt = null;
}

function storyTradeResourceMap(value) {
    const out = {};
    for (const resourceId of STORY_RESOURCE_IDS) out[resourceId] = storyTradeRound(value);
    return out;
}

function storyTradeAdd(map, resourceId, amount) {
    map[resourceId] = storyTradeRound((Number(map[resourceId]) || 0) + (Number(amount) || 0));
}

function storyTradeRegionId(value) {
    return String(value).startsWith('region:') ? String(value) : `region:${Number(value)}`;
}

function storyTradeNode(regionId) {
    const match = /^region:(\d+)$/.exec(String(regionId || ''));
    return match ? STORY.nodes && STORY.nodes[Number(match[1])] : null;
}

function storyTradeCountryIdForRegion(regionId) {
    const node = storyTradeNode(regionId);
    return node && Number.isInteger(Number(node.owner)) ? `country:${Number(node.owner)}` : null;
}

function storyTradeCountryNumber(countryId) {
    const match = /^country:(\d+)$/.exec(String(countryId || ''));
    return match ? Number(match[1]) : NaN;
}

function storyTradeModes(resourceId) {
    const definition = STORY_RESOURCE_DEFINITIONS.find(item => item.id === String(resourceId));
    if (!definition) return [];
    if (definition.transportModes.includes('ENERGY_GRID')) return ['ENERGY'];
    return definition.transportModes.filter(mode => mode === 'LAND' || mode === 'SEA');
}

function storyTradeTotalsBase() {
    return {
        dispatched: storyTradeResourceMap(0),
        delivered: storyTradeResourceMap(0),
        lost: storyTradeResourceMap(0),
        returned: storyTradeResourceMap(0)
    };
}

function storyTradeLedgerCreate(options) {
    options = options || {};
    const infrastructure = typeof storyInfrastructureEnsure === 'function'
        ? storyInfrastructureEnsure()
        : STORY.infrastructureGraph;
    return {
        schemaVersion: STORY_TRADE_SCHEMA_VERSION,
        adapterVersion: STORY_TRADE_ADAPTER_VERSION,
        policyHash: STORY_TRADE_POLICY_HASH,
        resourceCatalogHash: STORY_RESOURCE_CATALOG_HASH,
        regionalPolicyHash: typeof STORY_REGIONAL_POLICY_HASH === 'string'
            ? STORY_REGIONAL_POLICY_HASH
            : null,
        topologyHash: STORY.regionModel ? STORY.regionModel.topologyHash : null,
        networkHash: infrastructure ? infrastructure.networkHash : null,
        tickSequence: 0,
        contractSequence: 0,
        orderSequence: 0,
        shipmentSequence: 0,
        amendmentSequence: 0,
        lastTickAt: 0,
        contracts: [],
        orders: [],
        shipments: [],
        amendments: [],
        capacityWindow: {
            sequence: 0,
            usedByCorridor: {}
        },
        totals: storyTradeTotalsBase(),
        diagnostics: {
            backfilled: !!options.backfilled,
            restoredFromInvalidLedger: !!options.restoredFromInvalidLedger,
            issues: Array.isArray(options.issues) ? storyTradeClone(options.issues).slice(0, 50) : [],
            warnings: Array.isArray(options.warnings) ? options.warnings.map(String).slice(0, 30) : [],
            priceSettlementActive: true,
            titleTransfer: STORY_TRADE_POLICY.titleTransfer,
            thirdPartyTransit: STORY_TRADE_POLICY.thirdPartyTransit
        }
    };
}

function storyTradeActiveCargoTotals(ledger) {
    const totals = storyTradeResourceMap(0);
    for (const shipment of (ledger && ledger.shipments) || []) {
        if (!['IN_TRANSIT', 'HELD'].includes(shipment.status)) continue;
        storyTradeAdd(totals, shipment.resourceId, shipment.quantity);
    }
    return totals;
}

function storyTradeValidate(ledger) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) {
        return { ok: false, issues: [{ code: 'TRADE_LEDGER_REQUIRED', path: '$', message: 'Ticaret defteri zorunlu.' }] };
    }
    if (ledger.schemaVersion !== STORY_TRADE_SCHEMA_VERSION) add('TRADE_SCHEMA_VERSION', '$.schemaVersion', 'Ticaret şema sürümü uyuşmuyor.');
    if (ledger.adapterVersion !== STORY_TRADE_ADAPTER_VERSION) add('TRADE_ADAPTER_VERSION', '$.adapterVersion', 'Ticaret adaptörü uyuşmuyor.');
    if (ledger.policyHash !== STORY_TRADE_POLICY_HASH) add('TRADE_POLICY_HASH', '$.policyHash', 'Ticaret politikası uyuşmuyor.');
    if (ledger.resourceCatalogHash !== STORY_RESOURCE_CATALOG_HASH) add('TRADE_RESOURCE_HASH', '$.resourceCatalogHash', 'Kaynak kataloğu bağı uyuşmuyor.');
    if (ledger.regionalPolicyHash !== STORY_REGIONAL_POLICY_HASH) add('TRADE_REGIONAL_HASH', '$.regionalPolicyHash', 'Bölgesel stok politikası bağı uyuşmuyor.');
    const topologyHash = STORY.regionModel ? STORY.regionModel.topologyHash : null;
    if (ledger.topologyHash !== topologyHash) add('TRADE_TOPOLOGY_HASH', '$.topologyHash', 'Ticaret defteri başka topolojiye ait.');
    const infrastructure = STORY.infrastructureGraph || (typeof storyInfrastructureEnsure === 'function' ? storyInfrastructureEnsure() : null);
    if (ledger.networkHash !== (infrastructure && infrastructure.networkHash)) {
        add('TRADE_NETWORK_HASH', '$.networkHash', 'Ticaret defteri başka koridor ağına ait.');
    }
    for (const field of ['contracts', 'orders', 'shipments', 'amendments']) {
        if (!Array.isArray(ledger[field])) add('TRADE_LOG_ARRAY', `$.${field}`, `${field} dizi olmalı.`);
    }
    if (issues.length) return { ok: false, issues };

    const regionIds = new Set(Object.keys((STORY.regionalEconomy && STORY.regionalEconomy.regions) || {}));
    const contractIds = new Set();
    ledger.contracts.forEach((contract, index) => {
        const at = `$.contracts[${index}]`;
        if (!contract || !contract.id) return add('INVALID_CONTRACT', at, 'Sözleşme kimliği zorunlu.');
        if (contractIds.has(contract.id)) add('DUPLICATE_CONTRACT', `${at}.id`, 'Sözleşme kimliği yineleniyor.');
        contractIds.add(contract.id);
        if (!['ACTIVE', 'SUSPENDED', 'TERMINATED'].includes(contract.status)) add('INVALID_CONTRACT_STATUS', `${at}.status`, 'Sözleşme durumu geçersiz.');
        if (!Array.isArray(contract.partyCountryIds) || contract.partyCountryIds.length < 1) add('INVALID_CONTRACT_PARTIES', `${at}.partyCountryIds`, 'Sözleşme tarafları zorunlu.');
        if (!STORY_TRADE_TRANSPORTABLE.includes(contract.resourceId)) add('INVALID_CONTRACT_RESOURCE', `${at}.resourceId`, 'Taşınamaz kaynak sözleşmeye bağlandı.');
    });

    const orderIds = new Set();
    ledger.orders.forEach((order, index) => {
        const at = `$.orders[${index}]`;
        if (!order || !order.id) return add('INVALID_ORDER', at, 'Sipariş kimliği zorunlu.');
        if (orderIds.has(order.id)) add('DUPLICATE_ORDER', `${at}.id`, 'Sipariş kimliği yineleniyor.');
        orderIds.add(order.id);
        if (!contractIds.has(order.contractId)) add('BROKEN_ORDER_CONTRACT', `${at}.contractId`, 'Sipariş sözleşmesi bulunamadı.');
        if (!regionIds.has(order.sourceRegionId) || !regionIds.has(order.targetRegionId)) add('BROKEN_ORDER_REGION', at, 'Sipariş bölgesi bulunamadı.');
        if (!Number.isFinite(Number(order.quantity)) || Number(order.quantity) <= 0) add('INVALID_ORDER_QUANTITY', `${at}.quantity`, 'Sipariş miktarı pozitif olmalı.');
        if (!Number.isFinite(Number(order.dispatchedQuantity)) || Number(order.dispatchedQuantity) < 0
            || Number(order.dispatchedQuantity) > Number(order.quantity) + 1e-6) {
            add('INVALID_DISPATCHED_QUANTITY', `${at}.dispatchedQuantity`, 'Sevk edilen miktar sipariş sınırında olmalı.');
        }
        const reserveBps = order.exportReserveBps == null
            ? STORY_TRADE_POLICY.exportReserveBps
            : Number(order.exportReserveBps);
        if (!Number.isFinite(reserveBps) || reserveBps < 0
            || reserveBps > STORY_TRADE_POLICY.exportReserveBps) {
            add('INVALID_ORDER_EXPORT_RESERVE', `${at}.exportReserveBps`,
                'Sipariş rezerv tabanı normal ihracat rezervi sınırında olmalı.');
        }
        const authorizedDomesticReserveRelease = [
            'ECONOMIC_AI_OPERATIONAL_BOOTSTRAP',
            'AUTO_PRODUCTION_INPUT_CLEARING',
            'DOMESTIC_DISTRIBUTION_BATCH'
        ].includes(order.source) && order.sellerCountryId === order.buyerCountryId;
        if (reserveBps < STORY_TRADE_POLICY.exportReserveBps
            && !authorizedDomesticReserveRelease) {
            add('UNAUTHORIZED_ORDER_RESERVE_RELEASE', `${at}.exportReserveBps`,
                'Düşük rezerv tabanı yalnız aynı ülkenin kayıtlı operasyonel bootstrap sevkiyatında kullanılabilir.');
        }
        if (order.dispatchFailureCount != null
            && (!Number.isInteger(Number(order.dispatchFailureCount))
                || Number(order.dispatchFailureCount) < 0)) {
            add('INVALID_ORDER_FAILURE_COUNT', `${at}.dispatchFailureCount`,
                'Sevk başarısızlık sayacı negatif olmayan tamsayı olmalı.');
        }
        if (order.lastAttemptAt != null
            && (!Number.isFinite(Number(order.lastAttemptAt)) || Number(order.lastAttemptAt) < 0)) {
            add('INVALID_ORDER_LAST_ATTEMPT', `${at}.lastAttemptAt`,
                'Son sevk denemesi geçerli bir dünya zamanı olmalı.');
        }
        if (order.nextRetryAt != null
            && (!Number.isFinite(Number(order.nextRetryAt))
                || Number(order.nextRetryAt) < Math.max(0, Number(order.lastAttemptAt) || 0))) {
            add('INVALID_ORDER_RETRY_TIME', `${at}.nextRetryAt`,
                'Yeniden deneme zamanı son denemeden önce olamaz.');
        }
    });

    const shipmentIds = new Set();
    ledger.shipments.forEach((shipment, index) => {
        const at = `$.shipments[${index}]`;
        if (!shipment || !shipment.id) return add('INVALID_SHIPMENT', at, 'Sevkiyat kimliği zorunlu.');
        if (shipmentIds.has(shipment.id)) add('DUPLICATE_SHIPMENT', `${at}.id`, 'Sevkiyat kimliği yineleniyor.');
        shipmentIds.add(shipment.id);
        if (!orderIds.has(shipment.orderId)) add('BROKEN_SHIPMENT_ORDER', `${at}.orderId`, 'Sevkiyat siparişi bulunamadı.');
        if (!contractIds.has(shipment.contractId)) add('BROKEN_SHIPMENT_CONTRACT', `${at}.contractId`, 'Sevkiyat sözleşmesi bulunamadı.');
        if (!['IN_TRANSIT', 'HELD', 'DELIVERED', 'LOST', 'RETURNED'].includes(shipment.status)) {
            add('INVALID_SHIPMENT_STATUS', `${at}.status`, 'Sevkiyat durumu geçersiz.');
        }
        if (!Number.isFinite(Number(shipment.quantity)) || Number(shipment.quantity) <= 0) add('INVALID_SHIPMENT_QUANTITY', `${at}.quantity`, 'Sevkiyat miktarı pozitif olmalı.');
        if (!Array.isArray(shipment.routeRegionIds) || !Array.isArray(shipment.corridorIds)
            || shipment.routeRegionIds.length !== shipment.corridorIds.length + 1) {
            add('INVALID_SHIPMENT_ROUTE', at, 'Sevkiyat rota düğümü/koridor sayısı uyuşmuyor.');
        }
        const heldAtDestination = shipment.status === 'HELD'
            && shipment.legIndex === shipment.corridorIds.length
            && shipment.currentRegionId === shipment.targetRegionId;
        if (['IN_TRANSIT', 'HELD'].includes(shipment.status)
            && (shipment.legIndex < 0
                || shipment.legIndex > shipment.corridorIds.length
                || (shipment.legIndex === shipment.corridorIds.length && !heldAtDestination))) {
            add('INVALID_SHIPMENT_LEG', `${at}.legIndex`, 'Canlı sevkiyat geçerli rota ayağında olmalı.');
        }
    });

    if (ledger.distributionBatches != null && !Array.isArray(ledger.distributionBatches)) {
        add('DISTRIBUTION_BATCH_ARRAY', '$.distributionBatches',
            'Ülke-içi dağıtım sözleşmeleri dizi olmalı.');
    }
    if (ledger.distributionBatchSequence != null
        && (!Number.isInteger(Number(ledger.distributionBatchSequence))
            || Number(ledger.distributionBatchSequence) < 0)) {
        add('DISTRIBUTION_BATCH_SEQUENCE', '$.distributionBatchSequence',
            'Dağıtım sözleşmesi sıra numarası negatif olmayan tamsayı olmalı.');
    }
    const distributionBatchIds = new Set();
    for (const [batchIndex, batch] of (ledger.distributionBatches || []).entries()) {
        const at = `$.distributionBatches[${batchIndex}]`;
        if (!batch || !batch.id) {
            add('INVALID_DISTRIBUTION_BATCH', at, 'Dağıtım sözleşmesi kimliği zorunlu.');
            continue;
        }
        if (distributionBatchIds.has(batch.id)) {
            add('DUPLICATE_DISTRIBUTION_BATCH', `${at}.id`, 'Dağıtım sözleşmesi kimliği yineleniyor.');
        }
        distributionBatchIds.add(batch.id);
        if (batch.adapterVersion !== STORY_TRADE_DISTRIBUTION_ADAPTER_VERSION) {
            add('DISTRIBUTION_ADAPTER_VERSION', `${at}.adapterVersion`,
                'Dağıtım sözleşmesi adaptörü uyuşmuyor.');
        }
        if (!['PLANNED', 'IN_TRANSIT', 'HELD', 'PARTIAL', 'DELIVERED', 'LOST', 'FAILED']
            .includes(batch.status)) {
            add('INVALID_DISTRIBUTION_STATUS', `${at}.status`, 'Dağıtım sözleşmesi durumu geçersiz.');
        }
        if (!/^country:\d+$/.test(String(batch.countryId || ''))) {
            add('INVALID_DISTRIBUTION_COUNTRY', `${at}.countryId`, 'Dağıtım ülkesi zorunlu.');
        }
        if (!regionIds.has(batch.sourceRegionId)) {
            add('INVALID_DISTRIBUTION_SOURCE', `${at}.sourceRegionId`,
                'Dağıtım kaynağı geçerli bir bölge olmalı.');
        }
        if (!STORY_TRADE_TRANSPORTABLE.includes(batch.resourceId)) {
            add('INVALID_DISTRIBUTION_RESOURCE', `${at}.resourceId`,
                'Dağıtım kaynağı fiziksel olarak taşınabilir olmalı.');
        }
        if (!Array.isArray(batch.legs)
            || batch.legs.length < 2
            || batch.legs.length > STORY_TRADE_DISTRIBUTION_MAX_LEGS) {
            add('INVALID_DISTRIBUTION_LEGS', `${at}.legs`,
                'Dağıtım sözleşmesi 2-8 fiziksel hedef bacağı taşımalı.');
            continue;
        }
        const legIds = new Set();
        const targetIds = new Set();
        let plannedQuantity = 0;
        let dispatchedQuantity = 0;
        let deliveredQuantity = 0;
        let lostQuantity = 0;
        for (const [legIndex, leg] of batch.legs.entries()) {
            const legAt = `${at}.legs[${legIndex}]`;
            if (!leg || !leg.id || legIds.has(leg.id)) {
                add('INVALID_DISTRIBUTION_LEG_ID', `${legAt}.id`,
                    'Dağıtım bacağı kimliği zorunlu ve benzersiz olmalı.');
                continue;
            }
            legIds.add(leg.id);
            if (!regionIds.has(leg.targetRegionId)
                || leg.targetRegionId === batch.sourceRegionId
                || targetIds.has(leg.targetRegionId)) {
                add('INVALID_DISTRIBUTION_TARGET', `${legAt}.targetRegionId`,
                    'Her dağıtım hedefi geçerli, kaynaktan farklı ve benzersiz olmalı.');
            }
            targetIds.add(leg.targetRegionId);
            if (!Number.isFinite(Number(leg.quantity)) || Number(leg.quantity) <= 0) {
                add('INVALID_DISTRIBUTION_LEG_QUANTITY', `${legAt}.quantity`,
                    'Dağıtım bacağı miktarı pozitif olmalı.');
            }
            plannedQuantity += Math.max(0, Number(leg.quantity) || 0);
            if (!Array.isArray(leg.routeRegionIds) || !Array.isArray(leg.corridorIds)
                || leg.routeRegionIds.length !== leg.corridorIds.length + 1
                || leg.routeRegionIds[0] !== batch.sourceRegionId
                || leg.routeRegionIds[leg.routeRegionIds.length - 1] !== leg.targetRegionId) {
                add('INVALID_DISTRIBUTION_ROUTE', legAt,
                    'Dağıtım bacağı kaynak-hedef arasında geçerli rota fişi taşımalı.');
            }
            const order = leg.orderId
                ? ledger.orders.find(candidate => candidate.id === leg.orderId)
                : null;
            const shipment = leg.shipmentId
                ? ledger.shipments.find(candidate => candidate.id === leg.shipmentId)
                : null;
            if (leg.orderId && (!order
                || order.distributionBatchId !== batch.id
                || order.distributionLegId !== leg.id
                || order.sellerCountryId !== batch.countryId
                || order.buyerCountryId !== batch.countryId)) {
                add('BROKEN_DISTRIBUTION_ORDER', `${legAt}.orderId`,
                    'Dağıtım bacağının sipariş fişi bulunamadı veya başka sözleşmeye ait.');
            }
            if (leg.shipmentId && (!shipment
                || shipment.distributionBatchId !== batch.id
                || shipment.distributionLegId !== leg.id)) {
                add('BROKEN_DISTRIBUTION_SHIPMENT', `${legAt}.shipmentId`,
                    'Dağıtım bacağının sevkiyat fişi bulunamadı veya başka sözleşmeye ait.');
            }
            if (shipment) {
                dispatchedQuantity += Number(shipment.quantity) || 0;
                if (shipment.status === 'DELIVERED') deliveredQuantity += Number(shipment.quantity) || 0;
                if (shipment.status === 'LOST') lostQuantity += Number(shipment.quantity) || 0;
            }
        }
        const closeEnough = (left, right) => Math.abs(Number(left || 0) - Number(right || 0)) <= 1e-5;
        if (!closeEnough(batch.quantity, plannedQuantity)
            || !closeEnough(batch.dispatchedQuantity, dispatchedQuantity)
            || !closeEnough(batch.deliveredQuantity, deliveredQuantity)
            || !closeEnough(batch.lostQuantity, lostQuantity)) {
            add('DISTRIBUTION_QUANTITY_CONSERVATION', at,
                'Dağıtım planı, sevk, teslim ve kayıp miktarları bacak fişleriyle kapanmalı.');
        }
    }

    const cargo = storyTradeActiveCargoTotals(ledger);
    for (const resourceId of STORY_RESOURCE_IDS) {
        for (const group of ['dispatched', 'delivered', 'lost', 'returned']) {
            const value = Number(ledger.totals && ledger.totals[group] && ledger.totals[group][resourceId]);
            if (!Number.isFinite(value) || value < 0) add('INVALID_TRADE_TOTAL', `$.totals.${group}.${resourceId}`, 'Ticaret toplamı negatif olmayan sonlu sayı olmalı.');
        }
        const balance = storyTradeRound(
            Number(ledger.totals.dispatched[resourceId])
            - Number(ledger.totals.delivered[resourceId])
            - Number(ledger.totals.lost[resourceId])
            - Number(ledger.totals.returned[resourceId])
            - Number(cargo[resourceId])
        );
        if (Math.abs(balance) > 1e-6) add('TRADE_CARGO_CONSERVATION', `$.totals.${resourceId}`, `Yoldaki ${resourceId} koruma denklemi kapanmıyor: ${balance}`);
    }
    return { ok: issues.length === 0, issues };
}

function storyTradeReset(options) {
    if (!storyTradeEnabled()) {
        STORY.tradeLogistics = null;
        return null;
    }
    STORY.tradeLogistics = storyTradeLedgerCreate(options);
    return STORY.tradeLogistics;
}

function storyTradeRestore(saved) {
    if (!storyTradeEnabled()) {
        STORY.tradeLogistics = null;
        return null;
    }
    if (!saved) {
        return storyTradeReset({
            backfilled: true,
            warnings: ['Kayıt ticaret defteri taşımıyordu; yoldaki hayalî yük üretmeden boş defter kuruldu.']
        });
    }
    const candidate = storyTradeClone(saved);
    const validation = storyTradeValidate(candidate);
    if (!validation.ok) {
        return storyTradeReset({
            backfilled: true,
            restoredFromInvalidLedger: true,
            issues: validation.issues,
            warnings: ['Geçersiz ticaret defteri kullanılmadı; bölgesel stoklara dokunmadan boş defter kuruldu.']
        });
    }
    STORY.tradeLogistics = candidate;
    return STORY.tradeLogistics;
}

function storyTradeEnsure() {
    if (!storyTradeEnabled()) return null;
    if (!STORY.tradeLogistics) return storyTradeReset({ backfilled: true });
    return STORY.tradeLogistics;
}

function storyTradeForSave() {
    const ledger = storyTradeEnsure();
    if (!ledger) return null;
    const validation = storyTradeValidate(ledger);
    if (!validation.ok) {
        ledger.diagnostics.issues = validation.issues.slice(0, 50);
        ledger.diagnostics.warnings = ['Ticaret defteri kayıt öncesi doğrulama sorunu taşıyor.'];
    }
    return storyTradeClone(ledger);
}

function storyTradeSummary() {
    const ledger = storyTradeEnsure();
    if (!ledger) {
        return {
            schemaVersion: STORY_TRADE_SCHEMA_VERSION,
            adapterVersion: STORY_TRADE_ADAPTER_VERSION,
            disabled: true,
            activeContracts: 0,
            openOrders: 0,
            activeShipments: 0
        };
    }
    const cargo = storyTradeActiveCargoTotals(ledger);
    const summary = {
        schemaVersion: ledger.schemaVersion,
        adapterVersion: ledger.adapterVersion,
        policyHash: ledger.policyHash,
        topologyHash: ledger.topologyHash,
        networkHash: ledger.networkHash,
        disabled: false,
        tickSequence: ledger.tickSequence,
        lastTickAt: ledger.lastTickAt,
        activeContracts: ledger.contracts.filter(item => item.status === 'ACTIVE').length,
        openOrders: ledger.orders.filter(item => ['OPEN', 'PARTIAL'].includes(item.status)).length,
        activeShipments: ledger.shipments.filter(item => ['IN_TRANSIT', 'HELD'].includes(item.status)).length,
        heldShipments: ledger.shipments.filter(item => item.status === 'HELD').length,
        cargoInTransit: cargo,
        totals: storyTradeClone(ledger.totals),
        capacityWindow: storyTradeClone(ledger.capacityWindow),
        diagnostics: storyTradeClone(ledger.diagnostics)
    };
    if (Array.isArray(ledger.distributionBatches)) {
        summary.domesticDistribution = {
            adapterVersion: STORY_TRADE_DISTRIBUTION_ADAPTER_VERSION,
            batchCount: ledger.distributionBatches.length,
            statusCounts: ledger.distributionBatches.reduce((counts, batch) => {
                counts[batch.status] = (counts[batch.status] || 0) + 1;
                return counts;
            }, {}),
            plannedQuantity: storyTradeRound(ledger.distributionBatches.reduce(
                (sum, batch) => sum + Number(batch.quantity || 0),
                0
            )),
            deliveredQuantity: storyTradeRound(ledger.distributionBatches.reduce(
                (sum, batch) => sum + Number(batch.deliveredQuantity || 0),
                0
            ))
        };
    }
    return summary;
}

function storyTradeRegionView(regionId) {
    const ledger = storyTradeEnsure();
    const id = storyTradeRegionId(regionId);
    if (!ledger || !storyTradeNode(id)) return null;
    const own = shipment => shipment.sourceRegionId === id
        || shipment.targetRegionId === id
        || shipment.currentRegionId === id;
    const withQuote = row => {
        const clone = storyTradeClone(row);
        clone.marketQuote = typeof storyMarketTradeQuote === 'function'
            ? storyMarketTradeQuote(row.sourceRegionId, row.targetRegionId, row.resourceId, row.quantity)
            : null;
        return clone;
    };
    return {
        regionId: id,
        incoming: ledger.shipments.filter(item => item.targetRegionId === id && ['IN_TRANSIT', 'HELD'].includes(item.status))
            .map(withQuote),
        outgoing: ledger.shipments.filter(item => item.sourceRegionId === id && ['IN_TRANSIT', 'HELD'].includes(item.status))
            .map(withQuote),
        recent: ledger.shipments.filter(own).slice(-20).map(withQuote),
        openOrders: ledger.orders.filter(item => (item.sourceRegionId === id || item.targetRegionId === id)
            && ['OPEN', 'PARTIAL'].includes(item.status)).map(withQuote)
    };
}

function storyTradeCanContract(sellerCountryId, buyerCountryId) {
    if (!sellerCountryId || !buyerCountryId) return false;
    if (sellerCountryId === buyerCountryId) return true;
    const seller = storyTradeCountryNumber(sellerCountryId);
    const buyer = storyTradeCountryNumber(buyerCountryId);
    if (!Number.isInteger(seller) || !Number.isInteger(buyer)) return false;
    return typeof storyIsHostile !== 'function' || !storyIsHostile(seller, buyer);
}

function storyTradeEnsureContract(sellerCountryId, buyerCountryId, resourceId, options) {
    const ledger = storyTradeEnsure();
    if (!ledger) return { ok: false, code: 'FEATURE_DISABLED' };
    if (!STORY_TRADE_TRANSPORTABLE.includes(String(resourceId))) return { ok: false, code: 'RESOURCE_NOT_TRANSPORTABLE' };
    if (!storyTradeCanContract(sellerCountryId, buyerCountryId)) return { ok: false, code: 'HOSTILE_PARTIES' };
    const parties = [...new Set([String(sellerCountryId), String(buyerCountryId)])].sort();
    let contract = ledger.contracts.find(item => item.status === 'ACTIVE'
        && item.sellerCountryId === String(sellerCountryId)
        && item.buyerCountryId === String(buyerCountryId)
        && item.resourceId === String(resourceId));
    if (contract) return { ok: true, contract };
    ledger.contractSequence++;
    contract = {
        id: `trade-contract:${ledger.contractSequence}`,
        version: 1,
        status: 'ACTIVE',
        createdAt: storyTradeRound(STORY.clock),
        updatedAt: storyTradeRound(STORY.clock),
        sellerCountryId: String(sellerCountryId),
        buyerCountryId: String(buyerCountryId),
        sellerCompanyId: null,
        buyerCompanyId: null,
        partyCountryIds: parties,
        resourceId: String(resourceId),
        transportModes: storyTradeModes(resourceId),
        titleTransfer: STORY_TRADE_POLICY.titleTransfer,
        settlement: typeof storyBudgetEnabled === 'function' && storyBudgetEnabled()
            ? 'BUDGET_ESCROW_PRICE_LOCK'
            : STORY_TRADE_POLICY.settlement,
        source: String(options && options.source || 'STATE_CLEARING'),
        amendmentIds: []
    };
    ledger.contracts.push(contract);
    return { ok: true, contract };
}

function storyTradeCreateOrder(spec) {
    spec = spec || {};
    const ledger = storyTradeEnsure();
    if (!ledger) return { ok: false, code: 'FEATURE_DISABLED' };
    const sourceRegionId = storyTradeRegionId(spec.sourceRegionId);
    const targetRegionId = storyTradeRegionId(spec.targetRegionId);
    const resourceId = String(spec.resourceId || '');
    const quantity = storyTradeRound(Math.max(0, Number(spec.quantity) || 0));
    if (!storyTradeNode(sourceRegionId) || !storyTradeNode(targetRegionId) || sourceRegionId === targetRegionId) {
        return { ok: false, code: 'INVALID_ORDER_REGION' };
    }
    if (!STORY_TRADE_TRANSPORTABLE.includes(resourceId)) return { ok: false, code: 'RESOURCE_NOT_TRANSPORTABLE' };
    if (quantity <= 0) return { ok: false, code: 'INVALID_ORDER_QUANTITY' };
    const sellerCountryId = storyTradeCountryIdForRegion(sourceRegionId);
    const buyerCountryId = storyTradeCountryIdForRegion(targetRegionId);
    const sellerCompanyId = typeof storyCompanySellerForTrade === 'function'
        ? storyCompanySellerForTrade(sourceRegionId, resourceId)
        : null;
    const buyerCompanyId = sellerCompanyId && spec.buyerCompanyId
        ? String(spec.buyerCompanyId)
        : (sellerCompanyId
            && typeof storyCommerceEnabled === 'function' && storyCommerceEnabled()
            && sellerCountryId !== buyerCountryId
            && typeof storyCompanyBuyerForTrade === 'function'
            ? storyCompanyBuyerForTrade(targetRegionId, resourceId)
            : null);
    const contractResult = storyTradeEnsureContract(sellerCountryId, buyerCountryId, resourceId, {
        source: spec.source
    });
    if (!contractResult.ok) return contractResult;
    if (sellerCompanyId && !contractResult.contract.sellerCompanyId) {
        contractResult.contract.sellerCompanyId = sellerCompanyId;
    }
    if (buyerCompanyId && !contractResult.contract.buyerCompanyId) {
        contractResult.contract.buyerCompanyId = buyerCompanyId;
    }
    ledger.orderSequence++;
    const order = {
        id: `trade-order:${ledger.orderSequence}`,
        contractId: contractResult.contract.id,
        status: 'OPEN',
        createdAt: storyTradeRound(STORY.clock),
        updatedAt: storyTradeRound(STORY.clock),
        sourceRegionId,
        targetRegionId,
        sellerCountryId,
        buyerCountryId,
        sellerCompanyId,
        buyerCompanyId,
        resourceId,
        quantity,
        dispatchedQuantity: 0,
        deliveredQuantity: 0,
        priority: Math.max(0, Number(spec.priority) || 0),
        source: String(spec.source || 'AUTO_BALANCE'),
        shipmentIds: []
    };
    // Keep the legacy order shape exact unless a caller explicitly requests a
    // lower, authorized reserve. Dispatch already falls back to policy default.
    if (spec.exportReserveBps != null) {
        order.exportReserveBps = Math.round(Math.max(0, Math.min(
            STORY_TRADE_POLICY.exportReserveBps,
            Number(spec.exportReserveBps) || 0
        )));
    }
    if (spec.distributionBatchId && spec.distributionLegId) {
        order.distributionBatchId = String(spec.distributionBatchId);
        order.distributionLegId = String(spec.distributionLegId);
    }
    ledger.orders.push(order);
    return { ok: true, order, contract: contractResult.contract };
}

function storyTradeFindRoute(sourceRegionId, targetRegionId, contract, resourceId) {
    if (typeof storyInfrastructureFindRoute !== 'function') return { ok: false, reason: 'INFRASTRUCTURE_API_MISSING' };
    return storyInfrastructureFindRoute(sourceRegionId, targetRegionId, {
        modes: storyTradeModes(resourceId),
        authorizedCountryIds: contract.partyCountryIds,
        minCapacity: 0
    });
}

function storyTradeCapacityAvailable(route, ledger) {
    let available = Infinity;
    for (const corridorId of route.corridorIds || []) {
        const corridor = storyInfrastructureGetCorridor(corridorId);
        if (!corridor) return 0;
        const capacity = storyInfrastructureEffectiveCapacity(corridor);
        const used = Number(ledger.capacityWindow.usedByCorridor[corridorId]) || 0;
        available = Math.min(available, Math.max(0, capacity - used));
    }
    return Number.isFinite(available) ? storyTradeRound(available) : 0;
}

// Faz 22.1E iç dağıtım mikro çekirdeği. Bu API kendiliğinden çalışmaz ve
// varsayılan defter şeklini değiştirmez. Yalnız açıkça çağrıldığında tek bir
// ülke kararını, her biri mevcut ticaret motorunun gerçek rota/kapasite/stok ve
// sahiplik kurallarından geçen birden fazla fiziksel teslimat bacağına çevirir.
function storyTradeDistributionEnsure(ledger) {
    if (!ledger) return null;
    if (!Array.isArray(ledger.distributionBatches)) ledger.distributionBatches = [];
    if (!Number.isInteger(Number(ledger.distributionBatchSequence))
        || Number(ledger.distributionBatchSequence) < 0) {
        ledger.distributionBatchSequence = 0;
    }
    return ledger.distributionBatches;
}

function storyTradePlanDomesticDistribution(spec) {
    spec = spec || {};
    const ledger = storyTradeEnsure();
    if (!ledger) return { ok: false, code: 'FEATURE_DISABLED' };
    const sourceRegionId = storyTradeRegionId(spec.sourceRegionId);
    const sourceCountryId = storyTradeCountryIdForRegion(sourceRegionId);
    const resourceId = String(spec.resourceId || '');
    const rawLegs = Array.isArray(spec.legs) ? spec.legs : [];
    if (!sourceCountryId || !storyTradeNode(sourceRegionId)) {
        return { ok: false, code: 'DISTRIBUTION_SOURCE_NOT_FOUND' };
    }
    if (!STORY_TRADE_TRANSPORTABLE.includes(resourceId)) {
        return { ok: false, code: 'DISTRIBUTION_RESOURCE_NOT_TRANSPORTABLE' };
    }
    if (rawLegs.length < 2 || rawLegs.length > STORY_TRADE_DISTRIBUTION_MAX_LEGS) {
        return { ok: false, code: 'DISTRIBUTION_LEG_COUNT' };
    }
    const reserveBps = spec.exportReserveBps == null
        ? 0
        : Math.round(Number(spec.exportReserveBps));
    if (!Number.isFinite(reserveBps)
        || reserveBps < 0
        || reserveBps > STORY_TRADE_POLICY.exportReserveBps) {
        return { ok: false, code: 'DISTRIBUTION_RESERVE_INVALID' };
    }
    const targetIds = new Set();
    const legs = [];
    const corridorDemand = {};
    let totalQuantity = 0;
    for (const [index, rawLeg] of rawLegs.entries()) {
        const targetRegionId = storyTradeRegionId(rawLeg && rawLeg.targetRegionId);
        const quantity = storyTradeRound(Math.max(0, Number(rawLeg && rawLeg.quantity) || 0));
        if (!storyTradeNode(targetRegionId)
            || targetRegionId === sourceRegionId
            || targetIds.has(targetRegionId)) {
            return { ok: false, code: 'DISTRIBUTION_TARGET_INVALID', legIndex: index };
        }
        if (storyTradeCountryIdForRegion(targetRegionId) !== sourceCountryId) {
            return { ok: false, code: 'DISTRIBUTION_CROSS_BORDER_FORBIDDEN', legIndex: index };
        }
        if (quantity <= 0) {
            return { ok: false, code: 'DISTRIBUTION_QUANTITY_INVALID', legIndex: index };
        }
        const route = storyInfrastructureFindRoute(sourceRegionId, targetRegionId, {
            modes: storyTradeModes(resourceId),
            authorizedCountryIds: [sourceCountryId],
            minCapacity: 0
        });
        if (!route.ok || !(route.corridorIds || []).length) {
            return {
                ok: false,
                code: route.reason || 'DISTRIBUTION_ROUTE_UNAVAILABLE',
                legIndex: index,
                route
            };
        }
        for (const corridorId of route.corridorIds) {
            corridorDemand[corridorId] = storyTradeRound(
                (Number(corridorDemand[corridorId]) || 0) + quantity
            );
        }
        targetIds.add(targetRegionId);
        totalQuantity = storyTradeRound(totalQuantity + quantity);
        legs.push({
            targetRegionId,
            quantity,
            routeRegionIds: route.regionIds.slice(),
            corridorIds: route.corridorIds.slice(),
            routeCostEstimate: storyTradeRound(route.totalCost * quantity),
            routeLatencySeconds: storyTradeRound(route.totalLatencySeconds)
        });
    }
    const source = storyRegionalRegionView(sourceRegionId);
    const reserve = storyTradeRound((Number(source.safeTargets[resourceId]) || 0)
        * reserveBps / 10000);
    const exportable = storyTradeRound(Math.max(
        0,
        (Number(source.stocks[resourceId]) || 0) - reserve
    ));
    if (totalQuantity > exportable + 1e-6) {
        return {
            ok: false,
            code: 'DISTRIBUTION_STOCK_UNAVAILABLE',
            requested: totalQuantity,
            exportable
        };
    }
    for (const [corridorId, requested] of Object.entries(corridorDemand)) {
        const corridor = storyInfrastructureGetCorridor(corridorId);
        const available = storyTradeRound(Math.max(
            0,
            storyInfrastructureEffectiveCapacity(corridor)
                - (Number(ledger.capacityWindow.usedByCorridor[corridorId]) || 0)
        ));
        if (requested > available + 1e-6) {
            return {
                ok: false,
                code: 'DISTRIBUTION_CORRIDOR_CAPACITY_EXHAUSTED',
                corridorId,
                requested,
                available
            };
        }
    }
    const cargoPlan = typeof storyCommerceEnabled === 'function' && storyCommerceEnabled()
        && typeof storyCommerceCargoPlan === 'function'
        ? storyCommerceCargoPlan(sourceRegionId, resourceId, totalQuantity, null)
        : null;
    if (cargoPlan && !cargoPlan.ok) {
        return {
            ok: false,
            code: cargoPlan.code || 'DISTRIBUTION_OWNED_CARGO_UNAVAILABLE',
            cargo: cargoPlan
        };
    }
    return {
        ok: true,
        code: 'DISTRIBUTION_ADMITTED',
        countryId: sourceCountryId,
        sourceRegionId,
        resourceId,
        reserveBps,
        quantity: totalQuantity,
        legs,
        corridorDemand,
        exportable,
        commerceCost: cargoPlan ? storyTradeRound(cargoPlan.cost || 0) : null
    };
}

function storyTradeRefreshDistributionBatch(batchOrId) {
    const ledger = storyTradeEnsure();
    if (!ledger || !Array.isArray(ledger.distributionBatches)) return null;
    const batch = typeof batchOrId === 'object'
        ? batchOrId
        : ledger.distributionBatches.find(candidate => candidate.id === String(batchOrId));
    if (!batch) return null;
    let dispatched = 0;
    let delivered = 0;
    let lost = 0;
    let active = 0;
    let held = 0;
    for (const leg of batch.legs || []) {
        const shipment = leg.shipmentId
            ? ledger.shipments.find(candidate => candidate.id === leg.shipmentId)
            : null;
        if (!shipment) continue;
        dispatched = storyTradeRound(dispatched + Number(shipment.quantity || 0));
        leg.status = shipment.status;
        if (shipment.status === 'DELIVERED') delivered = storyTradeRound(delivered + shipment.quantity);
        else if (shipment.status === 'LOST') lost = storyTradeRound(lost + shipment.quantity);
        else if (['IN_TRANSIT', 'HELD'].includes(shipment.status)) {
            active++;
            if (shipment.status === 'HELD') held++;
        }
    }
    batch.dispatchedQuantity = dispatched;
    batch.deliveredQuantity = delivered;
    batch.lostQuantity = lost;
    if (delivered >= batch.quantity - 1e-6) batch.status = 'DELIVERED';
    else if (lost >= batch.quantity - 1e-6) batch.status = 'LOST';
    else if (active > 0) batch.status = held === active ? 'HELD' : 'IN_TRANSIT';
    else if (delivered > 0 || lost > 0 || dispatched > 0) batch.status = 'PARTIAL';
    batch.updatedAt = storyTradeRound(STORY.clock);
    return batch;
}

function storyTradeCommitDomesticDistribution(spec) {
    const plan = storyTradePlanDomesticDistribution(spec);
    if (!plan.ok) return plan;
    const ledger = storyTradeEnsure();
    storyTradeDistributionEnsure(ledger);
    ledger.distributionBatchSequence++;
    const batch = {
        id: `trade-distribution:${ledger.distributionBatchSequence}`,
        adapterVersion: STORY_TRADE_DISTRIBUTION_ADAPTER_VERSION,
        version: 1,
        status: 'PLANNED',
        createdAt: storyTradeRound(STORY.clock),
        updatedAt: storyTradeRound(STORY.clock),
        countryId: plan.countryId,
        sourceRegionId: plan.sourceRegionId,
        resourceId: plan.resourceId,
        quantity: plan.quantity,
        dispatchedQuantity: 0,
        deliveredQuantity: 0,
        lostQuantity: 0,
        reserveBps: plan.reserveBps,
        source: String(spec && spec.source || 'MANUAL_DOMESTIC_DISTRIBUTION'),
        admission: {
            corridorDemand: storyTradeClone(plan.corridorDemand),
            exportableAtAdmission: plan.exportable,
            commerceCostAtAdmission: plan.commerceCost
        },
        legs: plan.legs.map((leg, index) => ({
            id: `trade-distribution:${ledger.distributionBatchSequence}:leg:${index + 1}`,
            status: 'PLANNED',
            targetRegionId: leg.targetRegionId,
            quantity: leg.quantity,
            routeRegionIds: leg.routeRegionIds.slice(),
            corridorIds: leg.corridorIds.slice(),
            routeCostEstimate: leg.routeCostEstimate,
            routeLatencySeconds: leg.routeLatencySeconds,
            orderId: null,
            shipmentId: null,
            failureCode: null
        }))
    };
    ledger.distributionBatches.push(batch);
    for (const leg of batch.legs) {
        const created = storyTradeCreateOrder({
            sourceRegionId: batch.sourceRegionId,
            targetRegionId: leg.targetRegionId,
            resourceId: batch.resourceId,
            quantity: leg.quantity,
            priority: Math.max(0, Number(spec && spec.priority) || 0),
            source: 'DOMESTIC_DISTRIBUTION_BATCH',
            exportReserveBps: batch.reserveBps,
            distributionBatchId: batch.id,
            distributionLegId: leg.id
        });
        if (!created.ok) {
            leg.status = 'FAILED';
            leg.failureCode = created.code || 'DISTRIBUTION_ORDER_FAILED';
            batch.status = batch.dispatchedQuantity > 0 ? 'PARTIAL' : 'FAILED';
            batch.updatedAt = storyTradeRound(STORY.clock);
            return { ok: false, code: leg.failureCode, batch, leg };
        }
        leg.orderId = created.order.id;
        const dispatched = storyTradeDispatchOrder(created.order, leg.quantity);
        if (!dispatched.ok || Math.abs(dispatched.shipment.quantity - leg.quantity) > 1e-6) {
            leg.status = dispatched.ok ? 'PARTIAL' : 'FAILED';
            leg.failureCode = dispatched.ok
                ? 'DISTRIBUTION_PARTIAL_DISPATCH'
                : (dispatched.code || 'DISTRIBUTION_DISPATCH_FAILED');
            if (!dispatched.ok) storyTradeRecordDispatchFailure(created.order, dispatched);
            storyTradeRefreshDistributionBatch(batch);
            batch.status = batch.dispatchedQuantity > 0 ? 'PARTIAL' : 'FAILED';
            return { ok: false, code: leg.failureCode, batch, leg, dispatched };
        }
        leg.shipmentId = dispatched.shipment.id;
        leg.status = dispatched.shipment.status;
    }
    storyTradeRefreshDistributionBatch(batch);
    return { ok: true, code: 'DISTRIBUTION_COMMITTED', batch, plan };
}

function storyTradeRefreshDistributionBatches(ledger) {
    if (!ledger || !Array.isArray(ledger.distributionBatches)) return;
    for (const batch of ledger.distributionBatches) storyTradeRefreshDistributionBatch(batch);
}

function storyTradeConsumeCapacity(route, quantity, ledger) {
    for (const corridorId of route.corridorIds || []) {
        ledger.capacityWindow.usedByCorridor[corridorId] = storyTradeRound(
            (Number(ledger.capacityWindow.usedByCorridor[corridorId]) || 0) + quantity
        );
    }
}

function storyTradeDispatchOrder(orderOrId, maxQuantity) {
    const ledger = storyTradeEnsure();
    if (!ledger) return { ok: false, code: 'FEATURE_DISABLED' };
    const order = typeof orderOrId === 'object'
        ? orderOrId
        : ledger.orders.find(item => item.id === String(orderOrId));
    if (!order || !['OPEN', 'PARTIAL'].includes(order.status)) return { ok: false, code: 'ORDER_NOT_OPEN' };
    const contract = ledger.contracts.find(item => item.id === order.contractId);
    if (!contract || contract.status !== 'ACTIVE') return { ok: false, code: 'CONTRACT_NOT_ACTIVE' };
    if (!storyTradeCanContract(order.sellerCountryId, order.buyerCountryId)) {
        contract.status = 'SUSPENDED';
        contract.updatedAt = storyTradeRound(STORY.clock);
        return { ok: false, code: 'HOSTILE_PARTIES' };
    }
    const regional = storyRegionalRegionView(order.sourceRegionId);
    if (!regional) return { ok: false, code: 'SOURCE_REGION_NOT_FOUND' };
    const remaining = storyTradeRound(order.quantity - order.dispatchedQuantity);
    const reserveBps = order.exportReserveBps == null
        ? STORY_TRADE_POLICY.exportReserveBps
        : Number(order.exportReserveBps);
    const reserve = storyTradeRound((Number(regional.safeTargets[order.resourceId]) || 0)
        * reserveBps / 10000);
    const exportable = storyTradeRound(Math.max(0, (Number(regional.stocks[order.resourceId]) || 0) - reserve));
    if (remaining <= 0 || exportable <= 0) return { ok: false, code: 'NO_EXPORTABLE_STOCK' };
    const route = storyTradeFindRoute(order.sourceRegionId, order.targetRegionId, contract, order.resourceId);
    if (!route.ok || !(route.corridorIds || []).length) return { ok: false, code: route.reason || 'NO_ROUTE', route };
    const availableCapacity = storyTradeCapacityAvailable(route, ledger);
    const quantity = storyTradeRound(Math.min(
        remaining,
        exportable,
        Number.isFinite(Number(maxQuantity)) ? Math.max(0, Number(maxQuantity)) : Infinity,
        availableCapacity
    ));
    if (quantity <= 0) return { ok: false, code: 'CORRIDOR_CAPACITY_EXHAUSTED', route };

    const commerceCargoPlan = typeof storyCommerceEnabled === 'function' && storyCommerceEnabled()
        && typeof storyCommerceCargoPlan === 'function'
        ? storyCommerceCargoPlan(
            order.sourceRegionId,
            order.resourceId,
            quantity,
            order.buyerCompanyId && order.sellerCountryId !== order.buyerCountryId
                ? order.sellerCompanyId
                : null
        )
        : null;
    if (commerceCargoPlan && !commerceCargoPlan.ok) {
        return { ok: false, code: commerceCargoPlan.code || 'COMMERCE_CARGO_UNAVAILABLE' };
    }

    const reservation = typeof storyBudgetReserveTrade === 'function'
        ? storyBudgetReserveTrade(order, quantity)
        : { ok: true, internal: true, amount: 0, reservationId: null };
    if (!reservation.ok) return {
        ok: false,
        code: reservation.code || 'TRADE_PAYMENT_RESERVATION_FAILED',
        finance: reservation
    };

    const debit = storyRegionalStockDelta(order.sourceRegionId, order.resourceId, -quantity, {
        type: 'TRADE_DISPATCH',
        source: order.id
    });
    if (!debit.ok) {
        if (reservation.reservationId && typeof storyBudgetReleaseTrade === 'function') {
            storyBudgetReleaseTrade(reservation.reservationId, 'SOURCE_DEBIT_FAILED');
        }
        return { ok: false, code: debit.code || 'SOURCE_DEBIT_FAILED' };
    }

    storyTradeConsumeCapacity(route, quantity, ledger);
    ledger.shipmentSequence++;
    const firstCorridor = storyInfrastructureGetCorridor(route.corridorIds[0]);
    const shipment = {
        id: `trade-shipment:${ledger.shipmentSequence}`,
        orderId: order.id,
        contractId: contract.id,
        status: 'IN_TRANSIT',
        holdReason: null,
        createdAt: storyTradeRound(STORY.clock),
        dispatchedAt: storyTradeRound(STORY.clock),
        deliveredAt: null,
        sourceRegionId: order.sourceRegionId,
        targetRegionId: order.targetRegionId,
        currentRegionId: order.sourceRegionId,
        sellerCountryId: order.sellerCountryId,
        buyerCountryId: order.buyerCountryId,
        sellerCompanyId: order.sellerCompanyId || null,
        buyerCompanyId: order.buyerCompanyId || null,
        titleOwnerCountryId: order.sellerCountryId,
        resourceId: order.resourceId,
        quantity,
        mode: firstCorridor ? firstCorridor.mode : storyTradeModes(order.resourceId)[0],
        routeRegionIds: route.regionIds.slice(),
        corridorIds: route.corridorIds.slice(),
        routeCostEstimate: storyTradeRound(route.totalCost * quantity),
        routeLatencySeconds: storyTradeRound(route.totalLatencySeconds),
        legIndex: 0,
        legRemainingSeconds: firstCorridor ? storyTradeRound(firstCorridor.latencySeconds) : 0,
        pendingRedirectRegionId: null,
        amendmentIds: [],
        interruptionSeconds: 0,
        damageDelaySeconds: 0
    };
    if (order.distributionBatchId && order.distributionLegId) {
        shipment.distributionBatchId = order.distributionBatchId;
        shipment.distributionLegId = order.distributionLegId;
    }
    if (commerceCargoPlan && typeof storyCommerceDispatchCargo === 'function') {
        const cargo = storyCommerceDispatchCargo(commerceCargoPlan, shipment.id);
        if (!cargo.ok) {
            storyRegionalStockDelta(order.sourceRegionId, order.resourceId, quantity, {
                type: 'TRADE_DISPATCH_ROLLBACK',
                source: order.id
            });
            if (reservation.reservationId && typeof storyBudgetReleaseTrade === 'function') {
                storyBudgetReleaseTrade(reservation.reservationId, 'COMMERCE_CARGO_COMMIT_FAILED');
            }
            return { ok: false, code: cargo.code || 'COMMERCE_CARGO_COMMIT_FAILED' };
        }
        shipment.commerceCargoRegionId = cargo.cargoRegionId;
        shipment.commerceCargoCost = storyTradeRound(cargo.cost || 0);
    }
    shipment.settlementReservationId = reservation.reservationId || null;
    shipment.settlementAmount = storyTradeRound(reservation.amount || 0);
    shipment.priceQuote = reservation.quote ? storyTradeClone(reservation.quote) : null;
    ledger.shipments.push(shipment);
    if (shipment.settlementReservationId && typeof storyBudgetBindTradeShipment === 'function') {
        storyBudgetBindTradeShipment(shipment.settlementReservationId, shipment.id);
    }
    order.shipmentIds.push(shipment.id);
    order.dispatchedQuantity = storyTradeRound(order.dispatchedQuantity + quantity);
    order.updatedAt = storyTradeRound(STORY.clock);
    order.status = order.dispatchedQuantity >= order.quantity - 1e-6 ? 'DISPATCHED' : 'PARTIAL';
    storyTradeClearDispatchFailure(order);
    storyTradeAdd(ledger.totals.dispatched, order.resourceId, quantity);
    return { ok: true, order, shipment, route, debit };
}

function storyTradeApplyRedirect(shipment) {
    if (!shipment.pendingRedirectRegionId) return { ok: true, changed: false };
    const ledger = storyTradeEnsure();
    const contract = ledger.contracts.find(item => item.id === shipment.contractId);
    const route = storyTradeFindRoute(
        shipment.currentRegionId,
        shipment.pendingRedirectRegionId,
        contract,
        shipment.resourceId
    );
    if (!route.ok || !(route.corridorIds || []).length) {
        shipment.status = 'HELD';
        shipment.holdReason = 'REDIRECT_ROUTE_UNAVAILABLE';
        return { ok: false, code: 'REDIRECT_ROUTE_UNAVAILABLE' };
    }
    shipment.targetRegionId = shipment.pendingRedirectRegionId;
    shipment.pendingRedirectRegionId = null;
    shipment.routeRegionIds = route.regionIds.slice();
    shipment.corridorIds = route.corridorIds.slice();
    shipment.routeCostEstimate = storyTradeRound(route.totalCost * shipment.quantity);
    shipment.routeLatencySeconds = storyTradeRound(route.totalLatencySeconds);
    shipment.legIndex = 0;
    const first = storyInfrastructureGetCorridor(shipment.corridorIds[0]);
    shipment.legRemainingSeconds = first ? storyTradeRound(first.latencySeconds) : 0;
    shipment.status = 'IN_TRANSIT';
    shipment.holdReason = null;
    return { ok: true, changed: true };
}

function storyTradeRedirectShipment(shipmentId, targetRegionId, options) {
    options = options || {};
    const ledger = storyTradeEnsure();
    if (!ledger) return { ok: false, code: 'FEATURE_DISABLED' };
    const shipment = ledger.shipments.find(item => item.id === String(shipmentId));
    if (!shipment || !['IN_TRANSIT', 'HELD'].includes(shipment.status)) return { ok: false, code: 'SHIPMENT_NOT_ACTIVE' };
    const target = storyTradeRegionId(targetRegionId);
    if (!storyTradeNode(target) || target === shipment.targetRegionId) return { ok: false, code: 'INVALID_REDIRECT_TARGET' };
    const targetCountryId = storyTradeCountryIdForRegion(target);
    if (targetCountryId !== shipment.buyerCountryId) return { ok: false, code: 'BUYER_COUNTRY_MISMATCH' };
    const authorizedBy = String(options.authorizedByCountryId || '');
    if (![shipment.sellerCountryId, shipment.buyerCountryId].includes(authorizedBy)) {
        return { ok: false, code: 'AMENDMENT_AUTHORITY_REQUIRED' };
    }
    const contract = ledger.contracts.find(item => item.id === shipment.contractId);
    if (!contract || contract.status !== 'ACTIVE') return { ok: false, code: 'CONTRACT_NOT_ACTIVE' };
    const routeProbe = storyTradeFindRoute(shipment.currentRegionId, target, contract, shipment.resourceId);
    if (!routeProbe.ok || !(routeProbe.corridorIds || []).length) return { ok: false, code: routeProbe.reason || 'NO_ROUTE' };
    ledger.amendmentSequence++;
    const amendment = {
        id: `trade-amendment:${ledger.amendmentSequence}`,
        contractId: contract.id,
        shipmentId: shipment.id,
        type: 'REDIRECT_TARGET',
        authorizedByCountryId: authorizedBy,
        createdAt: storyTradeRound(STORY.clock),
        previousTargetRegionId: shipment.targetRegionId,
        targetRegionId: target,
        status: 'ACCEPTED'
    };
    ledger.amendments.push(amendment);
    shipment.amendmentIds.push(amendment.id);
    shipment.pendingRedirectRegionId = target;
    contract.version++;
    contract.updatedAt = storyTradeRound(STORY.clock);
    contract.amendmentIds.push(amendment.id);
    if (shipment.status === 'HELD' || shipment.currentRegionId === shipment.sourceRegionId) {
        storyTradeApplyRedirect(shipment);
    }
    if (ledger.amendments.length > STORY_TRADE_AMENDMENT_LIMIT) {
        ledger.amendments.splice(0, ledger.amendments.length - STORY_TRADE_AMENDMENT_LIMIT);
    }
    return { ok: true, amendment, shipment };
}

function storyTradeCompleteShipment(shipment) {
    const ledger = storyTradeEnsure();
    if (storyTradeCountryIdForRegion(shipment.targetRegionId) !== shipment.buyerCountryId) {
        shipment.status = 'HELD';
        shipment.holdReason = 'TARGET_OWNERSHIP_CHANGED';
        return { ok: false, code: 'TARGET_OWNERSHIP_CHANGED' };
    }
    const cargoReady = typeof storyCommerceCanDeliverCargo === 'function'
        ? storyCommerceCanDeliverCargo(shipment)
        : { ok: true };
    if (!cargoReady.ok) {
        shipment.status = 'HELD';
        shipment.holdReason = cargoReady.code || 'COMMERCE_CARGO_NOT_READY';
        return { ok: false, code: shipment.holdReason };
    }
    const credit = storyRegionalStockDelta(shipment.targetRegionId, shipment.resourceId, shipment.quantity, {
        type: 'TRADE_DELIVERY',
        source: shipment.id
    });
    if (!credit.ok) {
        shipment.status = 'HELD';
        shipment.holdReason = 'TARGET_CREDIT_FAILED';
        return { ok: false, code: credit.code || 'TARGET_CREDIT_FAILED' };
    }
    const settlement = shipment.settlementReservationId && typeof storyBudgetSettleTrade === 'function'
        ? storyBudgetSettleTrade(shipment.settlementReservationId, {
            shipmentId: shipment.id,
            cargoCost: shipment.commerceCargoCost || 0
        })
        : { ok: true, internal: true };
    if (!settlement.ok) {
        storyRegionalStockDelta(shipment.targetRegionId, shipment.resourceId, -shipment.quantity, {
            type: 'TRADE_DELIVERY_ROLLBACK',
            source: shipment.id
        });
        shipment.status = 'HELD';
        shipment.holdReason = 'PAYMENT_SETTLEMENT_FAILED';
        return { ok: false, code: settlement.code || 'PAYMENT_SETTLEMENT_FAILED' };
    }
    const cargoDelivery = typeof storyCommerceDeliverCargo === 'function'
        ? storyCommerceDeliverCargo(shipment)
        : { ok: true };
    if (!cargoDelivery.ok) {
        storyRegionalStockDelta(shipment.targetRegionId, shipment.resourceId, -shipment.quantity, {
            type: 'TRADE_DELIVERY_ROLLBACK',
            source: shipment.id
        });
        shipment.status = 'HELD';
        shipment.holdReason = cargoDelivery.code || 'COMMERCE_CARGO_DELIVERY_FAILED';
        return { ok: false, code: shipment.holdReason };
    }
    shipment.status = 'DELIVERED';
    shipment.holdReason = null;
    shipment.currentRegionId = shipment.targetRegionId;
    shipment.deliveredAt = storyTradeRound(STORY.clock);
    shipment.titleOwnerCountryId = shipment.buyerCountryId;
    storyTradeAdd(ledger.totals.delivered, shipment.resourceId, shipment.quantity);
    const order = ledger.orders.find(item => item.id === shipment.orderId);
    if (order) {
        order.deliveredQuantity = storyTradeRound(order.deliveredQuantity + shipment.quantity);
        order.updatedAt = storyTradeRound(STORY.clock);
        if (order.deliveredQuantity >= order.quantity - 1e-6) order.status = 'FULFILLED';
    }
    if (shipment.distributionBatchId) {
        storyTradeRefreshDistributionBatch(shipment.distributionBatchId);
    }
    return { ok: true, credit, settlement };
}

function storyTradeLoseShipment(shipmentId, reason) {
    const ledger = storyTradeEnsure();
    if (!ledger) return { ok: false, code: 'FEATURE_DISABLED' };
    const shipment = ledger.shipments.find(item => item.id === String(shipmentId));
    if (!shipment || !['IN_TRANSIT', 'HELD'].includes(shipment.status)) return { ok: false, code: 'SHIPMENT_NOT_ACTIVE' };
    const cargoLoss = typeof storyCommerceLoseCargo === 'function'
        ? storyCommerceLoseCargo(shipment, reason || 'LOGISTICS_LOSS')
        : { ok: true };
    if (!cargoLoss.ok) return { ok: false, code: cargoLoss.code || 'COMMERCE_CARGO_LOSS_FAILED' };
    shipment.status = 'LOST';
    shipment.holdReason = String(reason || 'LOGISTICS_LOSS');
    shipment.lostAt = storyTradeRound(STORY.clock);
    if (shipment.settlementReservationId && typeof storyBudgetReleaseTrade === 'function') {
        storyBudgetReleaseTrade(shipment.settlementReservationId, shipment.holdReason);
    }
    storyTradeAdd(ledger.totals.lost, shipment.resourceId, shipment.quantity);
    if (shipment.distributionBatchId) {
        storyTradeRefreshDistributionBatch(shipment.distributionBatchId);
    }
    return { ok: true, shipment };
}

function storyTradeAdvanceShipment(shipment, dtSec) {
    if (!['IN_TRANSIT', 'HELD'].includes(shipment.status)) return { moved: false };
    const ledger = storyTradeEnsure();
    const contract = ledger.contracts.find(item => item.id === shipment.contractId);
    if (storyTradeCountryIdForRegion(shipment.targetRegionId) !== shipment.buyerCountryId) {
        shipment.status = 'HELD';
        shipment.holdReason = 'TARGET_OWNERSHIP_CHANGED';
        shipment.interruptionSeconds = storyTradeRound(shipment.interruptionSeconds + dtSec);
        return { moved: false, held: true };
    }
    if (!contract || contract.status !== 'ACTIVE'
        || !storyTradeCanContract(shipment.sellerCountryId, shipment.buyerCountryId)) {
        shipment.status = 'HELD';
        shipment.holdReason = 'CONTRACT_OR_DIPLOMATIC_BLOCK';
        shipment.interruptionSeconds = storyTradeRound(shipment.interruptionSeconds + dtSec);
        return { moved: false, held: true };
    }
    if (shipment.legIndex >= shipment.corridorIds.length
        && shipment.currentRegionId === shipment.targetRegionId) {
        const completed = storyTradeCompleteShipment(shipment);
        if (!completed.ok) {
            shipment.interruptionSeconds = storyTradeRound(
                shipment.interruptionSeconds + Math.max(0, Number(dtSec) || 0)
            );
        }
        return {
            moved: false,
            held: !completed.ok,
            status: shipment.status,
            completion: completed
        };
    }
    if (shipment.pendingRedirectRegionId
        && (shipment.status === 'HELD' || shipment.legRemainingSeconds <= 1e-9)) {
        storyTradeApplyRedirect(shipment);
    }
    const corridorId = shipment.corridorIds[shipment.legIndex];
    const corridor = storyInfrastructureGetCorridor(corridorId);
    const effective = storyInfrastructureEffectiveCapacity(corridor);
    const base = Math.max(0, Number(corridor && corridor.baseCapacity) || 0);
    const access = corridor && typeof storyInfrastructureAuthorizedCountriesCanUse === 'function'
        ? storyInfrastructureAuthorizedCountriesCanUse(corridor, contract.partyCountryIds)
        : !!corridor;
    if (!corridor || effective <= 0 || !access) {
        shipment.status = 'HELD';
        shipment.holdReason = !corridor ? 'CORRIDOR_MISSING' : (!access ? 'TRANSIT_ACCESS_DENIED' : 'CORRIDOR_BLOCKED');
        shipment.interruptionSeconds = storyTradeRound(shipment.interruptionSeconds + dtSec);
        return { moved: false, held: true };
    }
    shipment.status = 'IN_TRANSIT';
    shipment.holdReason = null;
    let budget = Math.max(0, Number(dtSec) || 0);
    let moved = false;
    while (budget > 1e-9 && shipment.status === 'IN_TRANSIT') {
        const activeCorridor = storyInfrastructureGetCorridor(shipment.corridorIds[shipment.legIndex]);
        const activeEffective = storyInfrastructureEffectiveCapacity(activeCorridor);
        const activeBase = Math.max(1, Number(activeCorridor && activeCorridor.baseCapacity) || 1);
        const speedFactor = Math.max(0, Math.min(1, activeEffective / activeBase));
        if (speedFactor <= 0) {
            shipment.status = 'HELD';
            shipment.holdReason = 'CORRIDOR_BLOCKED';
            shipment.interruptionSeconds = storyTradeRound(shipment.interruptionSeconds + budget);
            break;
        }
        const realNeeded = shipment.legRemainingSeconds / speedFactor;
        const used = Math.min(budget, realNeeded);
        shipment.legRemainingSeconds = storyTradeRound(Math.max(0, shipment.legRemainingSeconds - used * speedFactor));
        shipment.damageDelaySeconds = storyTradeRound(shipment.damageDelaySeconds + used * (1 - speedFactor));
        budget -= used;
        moved = moved || used > 0;
        if (shipment.legRemainingSeconds > 1e-9) break;
        shipment.currentRegionId = shipment.routeRegionIds[shipment.legIndex + 1];
        shipment.legIndex++;
        if (shipment.pendingRedirectRegionId) {
            const redirected = storyTradeApplyRedirect(shipment);
            if (!redirected.ok) break;
        }
        if (shipment.legIndex >= shipment.corridorIds.length) {
            storyTradeCompleteShipment(shipment);
            break;
        }
        const next = storyInfrastructureGetCorridor(shipment.corridorIds[shipment.legIndex]);
        shipment.legRemainingSeconds = storyTradeRound(Number(next && next.latencySeconds) || 0);
        if (!next || storyInfrastructureEffectiveCapacity(next) <= 0) {
            shipment.status = 'HELD';
            shipment.holdReason = 'CORRIDOR_BLOCKED';
            shipment.interruptionSeconds = storyTradeRound(shipment.interruptionSeconds + budget);
            break;
        }
    }
    return { moved, status: shipment.status };
}

function storyTradePendingInbound(ledger) {
    const pending = new Map();
    const add = (regionId, resourceId, amount) => {
        const key = `${regionId}|${resourceId}`;
        pending.set(key, storyTradeRound((pending.get(key) || 0) + amount));
    };
    for (const order of ledger.orders) {
        if (['OPEN', 'PARTIAL'].includes(order.status)) {
            add(order.targetRegionId, order.resourceId, Math.max(0, order.quantity - order.dispatchedQuantity));
        }
    }
    for (const shipment of ledger.shipments) {
        if (['IN_TRANSIT', 'HELD'].includes(shipment.status)) add(shipment.targetRegionId, shipment.resourceId, shipment.quantity);
    }
    return pending;
}

function storyTradeProductionInputCriticality(lastTick, resourceId, priorityMode) {
    const downstreamFood = priorityMode === 'DOWNSTREAM_FOOD';
    const sectorWeights = {
        industrial_parts: {
            energy: 500,
            extraction: 400,
            civil_industry: 300,
            agriculture: 250,
            advanced_tech: 100,
            defense_industry: 80
        },
        energy: {
            agriculture: downstreamFood ? 550 : 400,
            civil_industry: 500,
            extraction: 450,
            advanced_tech: 100,
            defense_industry: 80
        },
        raw_materials: {
            civil_industry: 500,
            advanced_tech: 120,
            defense_industry: 100
        },
        electronics: { defense_industry: 100 }
    };
    const weights = sectorWeights[resourceId] || {};
    let score = 0;
    for (const bottleneck of (lastTick.productionBottlenecks || [])) {
        if (bottleneck.key !== resourceId
            || !['INPUT_SHORTAGE', 'STOCK_UNAVAILABLE'].includes(bottleneck.code)) continue;
        score = Math.max(score, Number(weights[bottleneck.sectorId]) || 0);
    }
    const consumed = Math.max(0, Number(
        lastTick.productionConsumedByResource
        && lastTick.productionConsumedByResource[resourceId]
    ) || 0);
    return score + (consumed > 1e-6 ? 25 : 0);
}

// Read-only counterfactual observer for the next allocator. It asks what one
// physical unit would unlock before any order is created. A simultaneous
// second blocker is kept explicit instead of pretending that delivery alone
// guarantees production.
function storyTradeProductionOpportunityView() {
    const ledger = STORY.tradeLogistics;
    const regional = STORY.regionalEconomy;
    if (!ledger || !regional || !regional.regions) {
        return { disabled: true, opportunities: [], summary: {} };
    }
    const pending = storyTradePendingInbound(ledger);
    const commerce = STORY.companyEconomy && STORY.companyEconomy.commerce;
    const marketRegions = STORY.marketPrices && STORY.marketPrices.regions || {};
    const needRegions = STORY.needsWelfare && STORY.needsWelfare.regions || {};
    const priorityMode = ledger.diagnostics && ledger.diagnostics.productionInputPriorityMode
        || 'UPSTREAM_RECOVERY';
    const resourceOrder = ['industrial_parts', 'energy', 'raw_materials', 'electronics'];
    const inputResources = new Set([
        'industrial_parts', 'energy', 'raw_materials', 'electronics'
    ]);
    const sourceAvailability = (region, resourceId) => {
        const lastTick = region.lastTick || {};
        const stock = Math.max(0, Number(region.stocks && region.stocks[resourceId]) || 0);
        const requested = Math.max(0, Number(
            lastTick.productionRequestedByResource
                && lastTick.productionRequestedByResource[resourceId]
        ) || 0);
        const consumed = Math.max(0, Number(
            lastTick.productionConsumedByResource
                && lastTick.productionConsumedByResource[resourceId]
        ) || 0);
        const unmet = Math.max(0, Number(
            lastTick.productionUnmetByResource
                && lastTick.productionUnmetByResource[resourceId]
        ) || 0);
        const blocking = (lastTick.productionBottlenecks || []).some(bottleneck => (
            bottleneck.key === resourceId
                && ['INPUT_SHORTAGE', 'STOCK_UNAVAILABLE'].includes(bottleneck.code)
                && bottleneck.severity === 'BLOCKING'
        ));
        const localProductionNeed = Math.min(
            requested,
            consumed + (blocking ? Math.min(unmet, stock) : 0)
        );
        const consumerNeed = Math.max(0, Number(
            lastTick.demandRequestedByResource
                && lastTick.demandRequestedByResource[resourceId]
        ) || 0);
        const physical = storyTradeRound(Math.max(0, stock - localProductionNeed - consumerNeed));
        const owned = commerce && Array.isArray(commerce.inventories)
            ? storyTradeRound(commerce.inventories.reduce((sum, lot) => (
                lot.regionId === region.regionId
                    && lot.resourceId === resourceId
                    && Number(lot.quantity) > 0
                    ? sum + Number(lot.quantity)
                    : sum
            ), 0))
            : physical;
        return {
            stock: storyTradeRound(stock),
            operatingReserve: storyTradeRound(localProductionNeed + consumerNeed),
            physical,
            owned,
            transferable: storyTradeRound(Math.min(physical, owned))
        };
    };

    const opportunities = [];
    for (const region of Object.values(regional.regions)) {
        const lastTick = region.lastTick || {};
        const countryId = storyTradeCountryIdForRegion(region.regionId);
        const bottlenecks = lastTick.productionBottlenecks || [];
        for (const bottleneck of bottlenecks) {
            const resourceId = String(bottleneck.key || '');
            if (!inputResources.has(resourceId)
                || bottleneck.severity !== 'BLOCKING'
                || !['INPUT_SHORTAGE', 'STOCK_UNAVAILABLE'].includes(bottleneck.code)) continue;
            const sector = STORY_PRODUCTION_SECTOR_DEFINITIONS.find(
                candidate => candidate.id === bottleneck.sectorId
            );
            const input = sector && sector.recipe.inputs.find(
                candidate => candidate.resourceId === resourceId
            );
            if (!sector || !input || Number(input.quantity) <= 0) continue;

            const simultaneousBlockers = bottlenecks.filter(candidate => (
                candidate.sectorId === bottleneck.sectorId
                    && candidate.severity === 'BLOCKING'
                    && candidate.key !== resourceId
            )).map(candidate => ({
                code: candidate.code,
                key: candidate.key
            }));
            const missingCycles = storyTradeRound(Math.max(
                0,
                Number(bottleneck.requestedCycles || 0) - Number(bottleneck.actualCycles || 0)
            ));
            const oneUnitCycles = storyTradeRound(Math.min(
                missingCycles,
                1 / Number(input.quantity)
            ));
            const marketRegion = marketRegions[region.regionId];
            const outputs = (sector.recipe.outputs || []).map(output => {
                const quantity = storyTradeRound(Number(output.quantity || 0) * oneUnitCycles);
                const price = marketRegion && marketRegion.resources
                    && marketRegion.resources[output.resourceId];
                const priceIndex = price && Number.isFinite(Number(price.priceIndex))
                    ? Number(price.priceIndex)
                    : 1;
                return {
                    resourceId: output.resourceId,
                    quantity,
                    priceIndex: storyTradeRound(priceIndex),
                    valueIndex: storyTradeRound(quantity * priceIndex)
                };
            });
            const grossValueIndex = storyTradeRound(outputs.reduce(
                (sum, output) => sum + output.valueIndex,
                0
            ));
            const realizationBps = simultaneousBlockers.length ? 2500 : 10000;
            const realizedValueIndex = storyTradeRound(grossValueIndex * realizationBps / 10000);
            const inputRequired = storyTradeRound(missingCycles * Number(input.quantity));
            const inbound = storyTradeRound(pending.get(`${region.regionId}|${resourceId}`) || 0);
            const uncoveredNeed = storyTradeRound(Math.max(0, inputRequired - inbound));

            const sourceCandidates = [];
            let sourcesWithStock = 0;
            for (const source of uncoveredNeed > 1e-6 ? Object.values(regional.regions) : []) {
                if (source.regionId === region.regionId
                    || storyTradeCountryIdForRegion(source.regionId) !== countryId) continue;
                const availability = sourceAvailability(source, resourceId);
                if (availability.transferable <= 1e-6) continue;
                sourcesWithStock++;
                const route = storyInfrastructureFindRoute(source.regionId, region.regionId, {
                    modes: storyTradeModes(resourceId),
                    authorizedCountryIds: [countryId],
                    minCapacity: 0
                });
                if (!route.ok || !(route.corridorIds || []).length) continue;
                const routeCapacity = storyTradeCapacityAvailable(route, ledger);
                const transferable = storyTradeRound(Math.min(
                    uncoveredNeed,
                    availability.transferable,
                    routeCapacity
                ));
                if (transferable <= 1e-6) continue;
                const latencySeconds = storyTradeRound(route.totalLatencySeconds);
                sourceCandidates.push({
                    sourceRegionId: source.regionId,
                    stock: availability.stock,
                    operatingReserve: availability.operatingReserve,
                    physicalAvailable: availability.physical,
                    ownedAvailable: availability.owned,
                    routeCapacity: storyTradeRound(routeCapacity),
                    transferable,
                    latencySeconds,
                    routeRegionIds: route.regionIds.slice(),
                    corridorIds: route.corridorIds.slice(),
                    throughputScore: storyTradeRound(transferable / Math.max(1, latencySeconds))
                });
            }
            sourceCandidates.sort((a, b) => b.throughputScore - a.throughputScore
                || a.latencySeconds - b.latencySeconds
                || b.transferable - a.transferable
                || a.sourceRegionId.localeCompare(b.sourceRegionId));
            const bestSource = sourceCandidates[0] || null;
            const deliveryFactor = bestSource
                ? 1 / (1 + bestSource.latencySeconds / 16)
                : 0;
            const score = storyTradeRound(realizedValueIndex * deliveryFactor);
            const needs = needRegions[region.regionId] || {};
            const allocations = lastTick.allocations || [];
            const allocationRelief = (consumerType, outputResourceId, outputQuantity, gapBps) => {
                let requested = 0;
                let delivered = 0;
                for (const allocation of allocations) {
                    if (allocation.consumerType !== consumerType
                        || allocation.resourceId !== outputResourceId) continue;
                    requested += Math.max(0, Number(allocation.requested) || 0);
                    delivered += Math.max(0, Number(allocation.delivered) || 0);
                }
                const unmet = Math.max(0, requested - delivered);
                const coverageBps = requested > 1e-6
                    ? Math.round(Math.min(outputQuantity, unmet) / requested * 10000)
                    : 0;
                return Math.max(0, Math.min(10000, Math.min(gapBps, coverageBps)));
            };
            let householdReliefBps = 0;
            let publicServiceReliefBps = 0;
            for (const output of outputs) {
                if (output.resourceId === 'food') {
                    householdReliefBps = Math.max(householdReliefBps, allocationRelief(
                        'HOUSEHOLDS', 'food', output.quantity,
                        10000 - Math.max(0, Number(needs.foodAccessBps) || 0)
                    ));
                } else if (output.resourceId === 'energy') {
                    householdReliefBps = Math.max(householdReliefBps, allocationRelief(
                        'HOUSEHOLDS', 'energy', output.quantity,
                        10000 - Math.max(0, Number(needs.energyAccessBps) || 0)
                    ));
                    publicServiceReliefBps = Math.max(publicServiceReliefBps, allocationRelief(
                        'STATE', 'energy', output.quantity,
                        10000 - Math.max(0, Number(needs.signals && needs.signals.publicEnergyBps) || 0)
                    ));
                }
            }
            const directNeedReliefBps = outputs.some(output => output.resourceId === 'energy')
                ? Math.round(householdReliefBps * 0.7 + publicServiceReliefBps * 0.3)
                : householdReliefBps;
            const requested = Math.max(0, Number(
                lastTick.productionRequestedByResource
                    && lastTick.productionRequestedByResource[resourceId]
            ) || 0);
            const unmet = Math.max(0, Number(
                lastTick.productionUnmetByResource
                    && lastTick.productionUnmetByResource[resourceId]
            ) || 0);
            const legacyFillBps = requested > 1e-6
                ? Math.round(Math.max(0, Math.min(1, (requested - unmet) / requested)) * 10000)
                : 10000;
            const deliveryCoverageBps = bestSource && uncoveredNeed > 1e-6
                ? Math.round(Math.min(1, bestSource.transferable / uncoveredNeed) * 10000)
                : 0;
            opportunities.push({
                countryId,
                regionId: region.regionId,
                sectorId: sector.id,
                inputResourceId: resourceId,
                status: uncoveredNeed <= 1e-6
                    ? 'PIPELINE_COVERED'
                    : (bestSource
                        ? (simultaneousBlockers.length ? 'CONDITIONAL' : 'IMMEDIATE')
                        : (sourcesWithStock ? 'NO_ROUTE_CAPACITY' : 'NO_DOMESTIC_SOURCE')),
                missingCycles,
                inputRequired,
                pendingInbound: inbound,
                uncoveredNeed,
                simultaneousBlockers,
                marginal: {
                    inputQuantity: 1,
                    unlockedCycles: oneUnitCycles,
                    outputs,
                    grossValueIndex,
                    realizationBps,
                    realizedValueIndex
                },
                bestSource,
                score,
                objectives: {
                    directNeedReliefBps,
                    householdReliefBps,
                    publicServiceReliefBps,
                    affectedPopulationPeople: directNeedReliefBps > 0
                        ? Math.max(0, Number(needs.populationPeople) || 0)
                        : 0,
                    chainReliefBps: 0,
                    downstreamBlockerCount: 0,
                    downstreamUncoveredNeed: 0,
                    realizationBps,
                    deliveryCoverageBps,
                    latencySeconds: bestSource ? bestSource.latencySeconds : null,
                    economicValueIndex: realizedValueIndex
                },
                legacy: {
                    priorityMode,
                    resourceOrder: resourceOrder.indexOf(resourceId),
                    criticality: storyTradeProductionInputCriticality(
                        lastTick, resourceId, priorityMode
                    ),
                    fillBps: legacyFillBps,
                    priorityRank: null
                },
                policyLane: directNeedReliefBps > 0 ? 'SURVIVAL' : 'ECONOMIC',
                paretoRank: null,
                countryParetoRank: null,
                paretoFrontier: false,
                countryParetoFrontier: false,
                dominatedByCount: null,
                countryDominatedByCount: null
            });
        }
    }

    // A produced intermediate is valuable only if the current world actually
    // has a downstream blocker for it. This second pass measures that live
    // chain instead of assigning another static all-purpose weight.
    for (const opportunity of opportunities) {
        const outputs = opportunity.marginal.outputs || [];
        let downstreamBlockerCount = 0;
        let downstreamUncoveredNeed = 0;
        let chainReliefBps = 0;
        for (const output of outputs) {
            const downstream = opportunities.filter(candidate => (
                candidate.countryId === opportunity.countryId
                    && candidate.inputResourceId === output.resourceId
                    && candidate.uncoveredNeed > 1e-6
                    && !(candidate.regionId === opportunity.regionId
                        && candidate.sectorId === opportunity.sectorId)
            ));
            const need = downstream.reduce(
                (sum, candidate) => sum + Number(candidate.uncoveredNeed || 0),
                0
            );
            downstreamBlockerCount += downstream.length;
            downstreamUncoveredNeed += need;
            if (need > 1e-6) {
                chainReliefBps = Math.max(chainReliefBps, Math.round(
                    Math.min(1, Number(output.quantity || 0) / need) * 10000
                ));
            }
        }
        opportunity.objectives.downstreamBlockerCount = downstreamBlockerCount;
        opportunity.objectives.downstreamUncoveredNeed = storyTradeRound(downstreamUncoveredNeed);
        opportunity.objectives.chainReliefBps = chainReliefBps;
        if (opportunity.policyLane !== 'SURVIVAL' && downstreamBlockerCount > 0) {
            opportunity.policyLane = 'CHAIN_RECOVERY';
        }
    }

    const dispatchable = opportunities.filter(opportunity => (
        opportunity.status === 'IMMEDIATE' || opportunity.status === 'CONDITIONAL'
    ));
    const dominates = (left, right) => {
        const a = left.objectives;
        const b = right.objectives;
        const aLatency = Number.isFinite(a.latencySeconds) ? a.latencySeconds : Number.POSITIVE_INFINITY;
        const bLatency = Number.isFinite(b.latencySeconds) ? b.latencySeconds : Number.POSITIVE_INFINITY;
        const maximized = [
            'directNeedReliefBps',
            'chainReliefBps',
            'realizationBps',
            'deliveryCoverageBps',
            'economicValueIndex'
        ];
        const noWorse = maximized.every(key => Number(a[key] || 0) >= Number(b[key] || 0) - 1e-9)
            && aLatency <= bLatency + 1e-9;
        const strictlyBetter = maximized.some(key => Number(a[key] || 0) > Number(b[key] || 0) + 1e-9)
            || aLatency < bLatency - 1e-9;
        return noWorse && strictlyBetter;
    };
    const assignParetoRanks = (candidates, rankKey, countKey) => {
        const dominated = new Map(candidates.map(candidate => [candidate, []]));
        const dominationCount = new Map(candidates.map(candidate => [candidate, 0]));
        for (let leftIndex = 0; leftIndex < candidates.length; leftIndex++) {
            for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex++) {
                const left = candidates[leftIndex];
                const right = candidates[rightIndex];
                if (dominates(left, right)) {
                    dominated.get(left).push(right);
                    dominationCount.set(right, dominationCount.get(right) + 1);
                } else if (dominates(right, left)) {
                    dominated.get(right).push(left);
                    dominationCount.set(left, dominationCount.get(left) + 1);
                }
            }
        }
        for (const candidate of candidates) {
            candidate[countKey] = dominationCount.get(candidate);
        }
        let frontier = candidates.filter(candidate => dominationCount.get(candidate) === 0);
        let rank = 1;
        while (frontier.length) {
            const next = [];
            for (const candidate of frontier) {
                candidate[rankKey] = rank;
                for (const target of dominated.get(candidate)) {
                    dominationCount.set(target, dominationCount.get(target) - 1);
                    if (dominationCount.get(target) === 0) next.push(target);
                }
            }
            frontier = next;
            rank++;
        }
    };
    const dispatchableByCountry = new Map();
    for (const opportunity of dispatchable) {
        if (!dispatchableByCountry.has(opportunity.countryId)) {
            dispatchableByCountry.set(opportunity.countryId, []);
        }
        dispatchableByCountry.get(opportunity.countryId).push(opportunity);
    }
    for (const countryCandidates of dispatchableByCountry.values()) {
        assignParetoRanks(countryCandidates, 'countryParetoRank', 'countryDominatedByCount');
        for (const opportunity of countryCandidates) {
            opportunity.countryParetoFrontier = opportunity.countryParetoRank === 1;
        }
    }
    // A global frontier is needed only for comparison/reporting. Any global
    // winner must already be undominated inside its own country, so comparing
    // the much smaller union of country frontiers is exact for rank one.
    const countryFrontiers = dispatchable.filter(opportunity => opportunity.countryParetoFrontier);
    for (const opportunity of countryFrontiers) {
        opportunity.dominatedByCount = countryFrontiers.filter(other => (
            other !== opportunity && dominates(other, opportunity)
        )).length;
        opportunity.paretoFrontier = opportunity.dominatedByCount === 0;
        opportunity.paretoRank = opportunity.paretoFrontier ? 1 : null;
    }

    const legacyPriority = dispatchable.slice().sort((a, b) => (
        a.legacy.resourceOrder - b.legacy.resourceOrder
            || b.legacy.criticality - a.legacy.criticality
            || a.legacy.fillBps - b.legacy.fillBps
            || b.uncoveredNeed - a.uncoveredNeed
            || a.regionId.localeCompare(b.regionId)
            || a.sectorId.localeCompare(b.sectorId)
    ));
    legacyPriority.forEach((opportunity, index) => {
        opportunity.legacy.priorityRank = index + 1;
    });

    opportunities.sort((a, b) => b.score - a.score
        || b.marginal.realizedValueIndex - a.marginal.realizedValueIndex
        || a.countryId.localeCompare(b.countryId)
        || a.regionId.localeCompare(b.regionId)
        || a.sectorId.localeCompare(b.sectorId)
        || a.inputResourceId.localeCompare(b.inputResourceId));
    const statusCounts = opportunities.reduce((counts, opportunity) => {
        counts[opportunity.status] = (counts[opportunity.status] || 0) + 1;
        return counts;
    }, {});
    const byInputResourceStatus = {};
    const byCountryStatus = {};
    const immediateTransferableByResource = {};
    const immediateScoreByResource = {};
    const frontierByLane = {};
    const frontierByInputResource = {};
    for (const opportunity of opportunities) {
        const resourceStatusKey = `${opportunity.inputResourceId}|${opportunity.status}`;
        const countryStatusKey = `${opportunity.countryId}|${opportunity.status}`;
        byInputResourceStatus[resourceStatusKey] =
            (byInputResourceStatus[resourceStatusKey] || 0) + 1;
        byCountryStatus[countryStatusKey] = (byCountryStatus[countryStatusKey] || 0) + 1;
        if (opportunity.paretoFrontier) {
            frontierByLane[opportunity.policyLane] = (frontierByLane[opportunity.policyLane] || 0) + 1;
            frontierByInputResource[opportunity.inputResourceId] =
                (frontierByInputResource[opportunity.inputResourceId] || 0) + 1;
        }
        if (opportunity.status !== 'IMMEDIATE') continue;
        immediateTransferableByResource[opportunity.inputResourceId] = storyTradeRound(
            (immediateTransferableByResource[opportunity.inputResourceId] || 0)
                + Number(opportunity.bestSource && opportunity.bestSource.transferable || 0)
        );
        immediateScoreByResource[opportunity.inputResourceId] = storyTradeRound(
            (immediateScoreByResource[opportunity.inputResourceId] || 0)
                + Number(opportunity.score || 0)
        );
    }
    return {
        disabled: false,
        generatedAt: storyTradeRound(STORY.clock),
        opportunityCount: opportunities.length,
        statusCounts,
        byInputResourceStatus,
        byCountryStatus,
        immediateTransferableByResource,
        immediateScoreByResource,
        paretoFrontierCount: dispatchable.filter(opportunity => opportunity.paretoFrontier).length,
        countryParetoFrontierCount: dispatchable.filter(
            opportunity => opportunity.countryParetoFrontier
        ).length,
        frontierByLane,
        frontierByInputResource,
        legacyPriorityPreview: legacyPriority.slice(0, 20).map(opportunity => ({
            rank: opportunity.legacy.priorityRank,
            countryId: opportunity.countryId,
            regionId: opportunity.regionId,
            sectorId: opportunity.sectorId,
            inputResourceId: opportunity.inputResourceId,
            status: opportunity.status,
            policyLane: opportunity.policyLane,
            paretoRank: opportunity.paretoRank,
            countryParetoRank: opportunity.countryParetoRank,
            objectives: Object.assign({}, opportunity.objectives)
        })),
        paretoPriorityPreview: dispatchable.slice().sort((a, b) => (
            Number(b.paretoFrontier) - Number(a.paretoFrontier)
                || a.countryParetoRank - b.countryParetoRank
                || ({ SURVIVAL: 0, CHAIN_RECOVERY: 1, ECONOMIC: 2 }[a.policyLane]
                    - { SURVIVAL: 0, CHAIN_RECOVERY: 1, ECONOMIC: 2 }[b.policyLane])
                || b.objectives.directNeedReliefBps - a.objectives.directNeedReliefBps
                || b.objectives.chainReliefBps - a.objectives.chainReliefBps
                || b.objectives.realizationBps - a.objectives.realizationBps
                || a.objectives.latencySeconds - b.objectives.latencySeconds
                || a.regionId.localeCompare(b.regionId)
                || a.sectorId.localeCompare(b.sectorId)
        )).slice(0, 20).map(opportunity => ({
            rank: opportunity.paretoRank,
            countryRank: opportunity.countryParetoRank,
            countryId: opportunity.countryId,
            regionId: opportunity.regionId,
            sectorId: opportunity.sectorId,
            inputResourceId: opportunity.inputResourceId,
            status: opportunity.status,
            policyLane: opportunity.policyLane,
            legacyPriorityRank: opportunity.legacy.priorityRank,
            objectives: Object.assign({}, opportunity.objectives)
        })),
        immediateTransferable: storyTradeRound(opportunities
            .filter(opportunity => opportunity.status === 'IMMEDIATE')
            .reduce((sum, opportunity) => (
                sum + Number(opportunity.bestSource && opportunity.bestSource.transferable || 0)
            ), 0)),
        opportunities: opportunities.slice(0, 120)
    };
}

// Faz 22.1: Household reserve balancing cannot repair an industrial chain by
// itself. This pass uses the previous physical production receipt to maintain a
// bounded domestic pipeline for energy and intermediate inputs. It creates no
// stock, uses real contracts/routes/corridor capacity and preserves one complete
// local operating window at the source before releasing anything.
function storyTradeProductionInputBalance(ledger) {
    const bootstrapPlanning = typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('economy.bootstrapPlanning');
    const regional = bootstrapPlanning && storyRegionalEnsure();
    if (!regional) return {
        productionInputOrdersCreated: 0,
        productionInputShipmentsDispatched: 0,
        productionInputAttempts: 0
    };
    const pending = storyTradePendingInbound(ledger);
    const settledCommerce = typeof storyFeatureEnabled === 'function'
        && storyFeatureEnabled('economy.saleSettlement');
    let priorityMode = 'UPSTREAM_RECOVERY';
    if (settledCommerce) {
        let partsProduced = 0;
        let partsConsumed = 0;
        let foodRequested = 0;
        let foodDelivered = 0;
        for (const region of Object.values(regional.regions)) {
            const lastTick = region.lastTick || {};
            partsProduced += Math.max(0, Number(
                lastTick.producedByResource && lastTick.producedByResource.industrial_parts
            ) || 0);
            partsConsumed += Math.max(0, Number(
                lastTick.productionConsumedByResource
                    && lastTick.productionConsumedByResource.industrial_parts
            ) || 0);
            for (const allocation of (lastTick.allocations || [])) {
                if (allocation.consumerType !== 'HOUSEHOLDS'
                    || allocation.resourceId !== 'food') continue;
                foodRequested += Math.max(0, Number(allocation.requested) || 0);
                foodDelivered += Math.max(0, Number(allocation.delivered) || 0);
            }
        }
        const foodFillBps = foodRequested > 1e-6
            ? Math.round(Math.max(0, Math.min(1, foodDelivered / foodRequested)) * 10000)
            : 10000;
        const partsCoverageBps = partsConsumed > 1e-6
            ? Math.round(partsProduced / partsConsumed * 10000)
            : (partsProduced > 1e-6 ? 20000 : 0);
        const currentMode = ledger.diagnostics.productionInputPriorityMode
            || 'UPSTREAM_RECOVERY';
        if (currentMode === 'DOWNSTREAM_FOOD') {
            priorityMode = foodFillBps < 6500 && partsCoverageBps >= 9500
                ? 'DOWNSTREAM_FOOD'
                : 'UPSTREAM_RECOVERY';
        } else if (foodFillBps < 5000 && partsCoverageBps >= 12000) {
            priorityMode = 'DOWNSTREAM_FOOD';
        }
        ledger.diagnostics.productionInputPriorityMode = priorityMode;
        ledger.diagnostics.lastHouseholdFoodFillBps = foodFillBps;
        ledger.diagnostics.lastPartsOperatingCoverageBps = partsCoverageBps;
    }
    // Parts unlock power; power unlocks food/extraction; raw material then
    // closes the civil-parts loop. Per-resource quotas prevent the first
    // shortage class from consuming the whole logistics window.
    const resourceOrder = ['industrial_parts', 'energy', 'raw_materials', 'electronics'];
    let ordersCreated = 0;
    let shipmentsDispatched = 0;
    let attempts = 0;
    for (const resourceId of resourceOrder) {
        if (!STORY_TRADE_TRANSPORTABLE.includes(resourceId)) continue;
        const demands = [];
        const supplies = [];
        let resourceDispatches = 0;
        const resourceDispatchLimit = STORY_TRADE_PRODUCTION_INPUT_DISPATCH_LIMITS[resourceId] || 0;
        for (const region of Object.values(regional.regions)) {
            const lastTick = region.lastTick || {};
            const requested = Math.max(0, Number(
                lastTick.productionRequestedByResource
                && lastTick.productionRequestedByResource[resourceId]
            ) || 0);
            const unmet = Math.max(0, Number(
                lastTick.productionUnmetByResource
                && lastTick.productionUnmetByResource[resourceId]
            ) || 0);
            const inbound = pending.get(`${region.regionId}|${resourceId}`) || 0;
            // The observed domestic production route spans roughly 3.5
            // economy windows. Keep a four-window physical pipeline instead
            // of ordering only the current missed window; pending/open cargo
            // is subtracted so this consolidates orders rather than spamming.
            const deficit = storyTradeRound(Math.max(
                0,
                unmet * STORY_TRADE_PRODUCTION_PIPELINE_WINDOWS - inbound
            ));
            if (deficit > 1e-6 && requested > 1e-6) {
                demands.push({
                    regionId: region.regionId,
                    countryId: storyTradeCountryIdForRegion(region.regionId),
                    quantity: deficit,
                    fillBps: Math.round(Math.max(0, Math.min(1, (requested - unmet) / requested)) * 10000),
                    criticality: settledCommerce
                        ? storyTradeProductionInputCriticality(lastTick, resourceId, priorityMode)
                        : 0
                });
            }
            const stock = Math.max(0, Number(region.stocks[resourceId]) || 0);
            const consumed = Math.max(0, Number(
                lastTick.productionConsumedByResource
                && lastTick.productionConsumedByResource[resourceId]
            ) || 0);
            const blockingInputShortage = (lastTick.productionBottlenecks || []).some(
                bottleneck => bottleneck.key === resourceId
                    && ['INPUT_SHORTAGE', 'STOCK_UNAVAILABLE'].includes(bottleneck.code)
                    && bottleneck.severity === 'BLOCKING'
            );
            // Reserve one proven operating window, not every theoretical
            // installed-capacity request. The old reserve trapped parts and
            // power in regions whose other inputs/cash were already blocked,
            // while working energy and food regions starved. If this exact
            // resource was a zero-cycle blocker, retain only enough newly
            // arrived stock to cover the observed unmet window; otherwise a
            // delivery can be exported again before the next production tick.
            const localProductionNeed = settledCommerce
                ? Math.min(
                    requested,
                    consumed + (blockingInputShortage ? Math.min(unmet, stock) : 0)
                )
                : requested;
            const localConsumerNeed = Math.max(0, Number(
                lastTick.demandRequestedByResource
                && lastTick.demandRequestedByResource[resourceId]
            ) || 0);
            const operatingReserve = storyTradeRound(localProductionNeed + localConsumerNeed);
            const domesticQuantity = storyTradeRound(Math.max(0, stock - operatingReserve));
            const exportReserve = Math.max(
                operatingReserve,
                Math.max(0, Number(region.safeTargets[resourceId]) || 0)
                    * STORY_TRADE_POLICY.exportReserveBps / 10000
            );
            const foreignQuantity = storyTradeRound(Math.max(0, stock - exportReserve));
            if (domesticQuantity > 1e-6) supplies.push({
                regionId: region.regionId,
                countryId: storyTradeCountryIdForRegion(region.regionId),
                domesticQuantity,
                foreignQuantity
            });
        }
        demands.sort((a, b) => b.criticality - a.criticality
            || a.fillBps - b.fillBps
            || b.quantity - a.quantity
            || a.regionId.localeCompare(b.regionId));
        supplies.sort((a, b) => b.domesticQuantity - a.domesticQuantity
            || a.regionId.localeCompare(b.regionId));
        for (const demand of demands) {
            if (shipmentsDispatched >= STORY_TRADE_MAX_PRODUCTION_INPUT_DISPATCHES) break;
            const candidates = supplies
                .filter(supply => (supply.countryId === demand.countryId
                    ? supply.domesticQuantity
                    : supply.foreignQuantity) > 1e-6
                    && supply.regionId !== demand.regionId)
                .filter(supply => storyTradeCanContract(supply.countryId, demand.countryId))
                .sort((a, b) => {
                    const ad = a.countryId === demand.countryId ? 0 : 1;
                    const bd = b.countryId === demand.countryId ? 0 : 1;
                    const aq = ad === 0 ? a.domesticQuantity : a.foreignQuantity;
                    const bq = bd === 0 ? b.domesticQuantity : b.foreignQuantity;
                    return ad - bd || bq - aq || a.regionId.localeCompare(b.regionId);
                });
            for (const supply of candidates) {
                if (demand.quantity <= 1e-6
                    || shipmentsDispatched >= STORY_TRADE_MAX_PRODUCTION_INPUT_DISPATCHES
                    || resourceDispatches >= resourceDispatchLimit
                    || attempts >= STORY_TRADE_MAX_PRODUCTION_INPUT_DISPATCHES * 3) break;
                attempts++;
                const sameCountry = supply.countryId === demand.countryId;
                const available = sameCountry ? supply.domesticQuantity : supply.foreignQuantity;
                const quantity = storyTradeRound(Math.min(demand.quantity, available));
                const created = storyTradeCreateOrder({
                    sourceRegionId: supply.regionId,
                    targetRegionId: demand.regionId,
                    resourceId,
                    quantity,
                    priority: 120,
                    source: sameCountry
                        ? 'AUTO_PRODUCTION_INPUT_CLEARING'
                        : 'AUTO_PRODUCTION_INPUT_IMPORT',
                    exportReserveBps: sameCountry ? 0 : STORY_TRADE_POLICY.exportReserveBps
                });
                if (!created.ok) continue;
                ordersCreated++;
                const dispatched = storyTradeDispatchOrder(created.order, quantity);
                if (!dispatched.ok) {
                    storyTradeRecordDispatchFailure(created.order, dispatched);
                    created.order.status = [
                        'NO_ROUTE',
                        'REGION_NOT_FOUND',
                        'SOURCE_REGION_NOT_FOUND',
                        'CONTRACT_NOT_ACTIVE',
                        'HOSTILE_PARTIES'
                    ].includes(dispatched.code) ? 'CANCELLED' : 'OPEN';
                    continue;
                }
                shipmentsDispatched++;
                resourceDispatches++;
                const actual = dispatched.shipment.quantity;
                demand.quantity = storyTradeRound(Math.max(0, demand.quantity - actual));
                supply.domesticQuantity = storyTradeRound(Math.max(0, supply.domesticQuantity - actual));
                supply.foreignQuantity = storyTradeRound(Math.max(0, supply.foreignQuantity - actual));
            }
        }
        if (shipmentsDispatched >= STORY_TRADE_MAX_PRODUCTION_INPUT_DISPATCHES) break;
    }
    return {
        productionInputOrdersCreated: ordersCreated,
        productionInputShipmentsDispatched: shipmentsDispatched,
        productionInputAttempts: attempts
    };
}

function storyTradeAutoBalance(ledger) {
    const regional = storyRegionalEnsure();
    if (!regional) return { ordersCreated: 0, shipmentsDispatched: 0 };
    const pending = storyTradePendingInbound(ledger);
    let ordersCreated = 0;
    let shipmentsDispatched = 0;
    let attempts = 0;
    for (const resourceId of STORY_TRADE_TRANSPORTABLE) {
        const demands = [];
        const supplies = [];
        for (const region of Object.values(regional.regions)) {
            const stock = Math.max(0, Number(region.stocks[resourceId]) || 0);
            const target = Math.max(0, Number(region.safeTargets[resourceId]) || 0);
            const inbound = pending.get(`${region.regionId}|${resourceId}`) || 0;
            const deficit = storyTradeRound(Math.max(0, target * STORY_TRADE_POLICY.importTargetBps / 10000 - stock - inbound));
            const surplus = storyTradeRound(Math.max(0, stock - target * STORY_TRADE_POLICY.exportReserveBps / 10000));
            if (deficit > 1e-6) demands.push({ regionId: region.regionId, countryId: storyTradeCountryIdForRegion(region.regionId), quantity: deficit });
            if (surplus > 1e-6) supplies.push({ regionId: region.regionId, countryId: storyTradeCountryIdForRegion(region.regionId), quantity: surplus });
        }
        demands.sort((a, b) => b.quantity - a.quantity || a.regionId.localeCompare(b.regionId));
        supplies.sort((a, b) => b.quantity - a.quantity || a.regionId.localeCompare(b.regionId));
        for (const demand of demands) {
            if (shipmentsDispatched >= STORY_TRADE_MAX_AUTO_DISPATCHES) break;
            const candidates = supplies
                .filter(supply => supply.quantity > 1e-6
                    && supply.regionId !== demand.regionId
                    && storyTradeCanContract(supply.countryId, demand.countryId))
                .sort((a, b) => {
                    const ad = a.countryId === demand.countryId ? 0 : 1;
                    const bd = b.countryId === demand.countryId ? 0 : 1;
                    return ad - bd || b.quantity - a.quantity || a.regionId.localeCompare(b.regionId);
                });
            for (const supply of candidates) {
                if (demand.quantity <= 1e-6
                    || shipmentsDispatched >= STORY_TRADE_MAX_AUTO_DISPATCHES
                    || attempts >= STORY_TRADE_MAX_AUTO_DISPATCHES * 2) break;
                attempts++;
                const quantity = storyTradeRound(Math.min(demand.quantity, supply.quantity));
                const created = storyTradeCreateOrder({
                    sourceRegionId: supply.regionId,
                    targetRegionId: demand.regionId,
                    resourceId,
                    quantity,
                    priority: 100,
                    source: 'AUTO_SHORTAGE_CLEARING'
                });
                if (!created.ok) continue;
                ordersCreated++;
                const dispatched = storyTradeDispatchOrder(created.order, quantity);
                if (!dispatched.ok) {
                    storyTradeRecordDispatchFailure(created.order, dispatched);
                    created.order.status = dispatched.code === 'NO_ROUTE' ? 'CANCELLED' : 'OPEN';
                    continue;
                }
                shipmentsDispatched++;
                const actual = dispatched.shipment.quantity;
                demand.quantity = storyTradeRound(Math.max(0, demand.quantity - actual));
                supply.quantity = storyTradeRound(Math.max(0, supply.quantity - actual));
            }
        }
        if (shipmentsDispatched >= STORY_TRADE_MAX_AUTO_DISPATCHES
            || attempts >= STORY_TRADE_MAX_AUTO_DISPATCHES * 2) break;
    }
    return { ordersCreated, shipmentsDispatched, attempts };
}

function storyTradeGarbageCollect(ledger) {
    if (Array.isArray(ledger.distributionBatches)
        && ledger.distributionBatches.length > STORY_TRADE_DISTRIBUTION_BATCH_LIMIT) {
        let removeCount = ledger.distributionBatches.length - STORY_TRADE_DISTRIBUTION_BATCH_LIMIT;
        const removedIds = new Set();
        ledger.distributionBatches = ledger.distributionBatches.filter(batch => {
            if (removeCount > 0 && ['DELIVERED', 'LOST', 'FAILED', 'PARTIAL'].includes(batch.status)) {
                removeCount--;
                removedIds.add(batch.id);
                return false;
            }
            return true;
        });
        if (removedIds.size) {
            for (const row of [...ledger.orders, ...ledger.shipments]) {
                if (!removedIds.has(row.distributionBatchId)) continue;
                delete row.distributionBatchId;
                delete row.distributionLegId;
            }
        }
    }
    const retainedDistributionShipmentIds = new Set(
        (ledger.distributionBatches || []).flatMap(batch => (
            (batch.legs || []).map(leg => leg.shipmentId).filter(Boolean)
        ))
    );
    if (ledger.shipments.length > STORY_TRADE_SHIPMENT_LIMIT) {
        let removeCount = ledger.shipments.length - STORY_TRADE_SHIPMENT_LIMIT;
        ledger.shipments = ledger.shipments.filter(shipment => {
            if (removeCount > 0
                && ['DELIVERED', 'LOST', 'RETURNED'].includes(shipment.status)
                && !retainedDistributionShipmentIds.has(shipment.id)) {
                removeCount--;
                return false;
            }
            return true;
        });
    }
    if (ledger.orders.length > STORY_TRADE_ORDER_LIMIT) {
        const referencedOrderIds = new Set(ledger.shipments.map(shipment => shipment.orderId));
        for (const batch of ledger.distributionBatches || []) {
            for (const leg of batch.legs || []) {
                if (leg.orderId) referencedOrderIds.add(leg.orderId);
            }
        }
        let removeCount = ledger.orders.length - STORY_TRADE_ORDER_LIMIT;
        ledger.orders = ledger.orders.filter(order => {
            if (removeCount > 0
                && ['FULFILLED', 'CANCELLED'].includes(order.status)
                && !referencedOrderIds.has(order.id)) {
                removeCount--;
                return false;
            }
            return true;
        });
    }
}

function storyTradeLogisticsTick(dtSec, options) {
    options = options || {};
    const ledger = storyTradeEnsure();
    if (!ledger) return { disabled: true, advanced: 0, delivered: 0, held: 0, ordersCreated: 0, shipmentsDispatched: 0 };
    const dt = Math.max(0, Number(dtSec) || 0);
    if (dt <= 0) return { disabled: false, advanced: 0, delivered: 0, held: 0, ordersCreated: 0, shipmentsDispatched: 0 };
    ledger.tickSequence++;
    ledger.lastTickAt = storyTradeRound(STORY.clock);
    ledger.capacityWindow = {
        sequence: ledger.tickSequence,
        usedByCorridor: {}
    };
    let advanced = 0;
    let delivered = 0;
    let held = 0;
    for (const shipment of ledger.shipments) {
        if (!['IN_TRANSIT', 'HELD'].includes(shipment.status)) continue;
        const before = shipment.status;
        const result = storyTradeAdvanceShipment(shipment, dt);
        if (result.moved) advanced++;
        if (shipment.status === 'DELIVERED') delivered++;
        if (shipment.status === 'HELD' && before !== 'HELD') held++;
    }
    let dispatchAttempts = 0;
    let retryDeferred = 0;
    if (options.dispatchOpen !== false) {
        for (const order of ledger.orders
            .filter(item => ['OPEN', 'PARTIAL'].includes(item.status))
            .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))) {
            if (dispatchAttempts >= STORY_TRADE_MAX_OPEN_DISPATCH_ATTEMPTS
                || ledger.capacityWindow.usedByCorridor.__dispatchCount >= STORY_TRADE_MAX_AUTO_DISPATCHES) break;
            if (storyTradeBootstrapPlanningEnabled()
                && Number.isFinite(Number(order.nextRetryAt))
                && Number(order.nextRetryAt) > Number(STORY.clock) + 1e-9) {
                retryDeferred++;
                continue;
            }
            dispatchAttempts++;
            const result = storyTradeDispatchOrder(order);
            if (result.ok) {
                ledger.capacityWindow.usedByCorridor.__dispatchCount =
                    (ledger.capacityWindow.usedByCorridor.__dispatchCount || 0) + 1;
            } else storyTradeRecordDispatchFailure(order, result);
        }
    }
    delete ledger.capacityWindow.usedByCorridor.__dispatchCount;
    const productionInputs = options.autoBalance === false
        ? {
            productionInputOrdersCreated: 0,
            productionInputShipmentsDispatched: 0,
            productionInputAttempts: 0
        }
        : storyTradeProductionInputBalance(ledger);
    const balance = options.autoBalance === false
        ? { ordersCreated: 0, shipmentsDispatched: 0, attempts: 0 }
        : storyTradeAutoBalance(ledger);
    storyTradeRefreshDistributionBatches(ledger);
    storyTradeGarbageCollect(ledger);
    return Object.assign({
        disabled: false,
        tickSequence: ledger.tickSequence,
        advanced,
        delivered,
        held,
        dispatchAttempts,
        retryDeferred
    }, productionInputs, balance);
}
