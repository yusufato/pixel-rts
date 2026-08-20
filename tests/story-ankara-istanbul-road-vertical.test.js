'use strict';

const assert = require('node:assert');
const { createRuntime } = require('../tools/story-sim-harness');

// HXD-10: soyut rota değil, canlı kampanyadaki Ankara deposundan İstanbul'a
// gerçek şirket yükü, ShipmentV2 konvoyu ve fiziksel kara segmenti üzerinden
// uçtan uca teslimat. Hedef stok yalnız araç terminalde boşaltınca artabilir.
const seed = 2032;
const runtime = createRuntime(seed);
try {
    runtime.api.newCampaign({
        seed,
        playerStateId: 0,
        abundance: 1,
        doctrine: 'combined',
        fog: true,
        featureFlags: { 'economy.saleSettlement': true }
    });
    const story = runtime.api.state();
    const ankara = story.nodes.find(node => node.name === 'Ankara');
    const istanbul = story.nodes.find(node => node.name === 'İstanbul');
    assert(ankara && istanbul, 'canlı dünya Ankara ve İstanbul içermeli');
    assert.strictEqual(ankara.owner, istanbul.owner,
        'ilk kara yolu dikeyi aynı ülkenin gerçek iç lojistiği olmalı');

    const sourceRegionId = `region:${ankara.id}`;
    const targetRegionId = `region:${istanbul.id}`;
    const countryId = `country:${ankara.owner}`;
    const road = runtime.api.routePlannerPlan(sourceRegionId, targetRegionId, {
        modes: ['LAND'],
        authorizedCountryIds: [countryId],
        useCache: false
    });
    assert.strictEqual(road.ok, true);
    assert.deepStrictEqual(Array.from(road.modes), ['LAND']);
    assert(road.segmentIds.length >= 2, 'kara dikeyi fiziksel segment zinciri taşımalı');
    assert(road.totalLatencySeconds > 0, 'ETA fiziksel rota mesafesinden gelmeli');

    const sourceBeforeFixture = runtime.api.regionalRegionView(sourceRegionId);
    const targetBefore = runtime.api.regionalRegionView(targetRegionId).stocks.food;
    const desiredSource = sourceBeforeFixture.safeTargets.food * 1.25 + 40;
    assert.strictEqual(runtime.api.regionalStockDelta(
        sourceRegionId,
        'food',
        desiredSource - sourceBeforeFixture.stocks.food,
        { type: 'HXD10_FIXTURE', source: 'ankara-istanbul-road-vertical' }
    ).ok, true);
    const sourceBeforeDispatch = runtime.api.regionalRegionView(sourceRegionId).stocks.food;

    const created = runtime.api.tradeCreateOrder({
        sourceRegionId,
        targetRegionId,
        resourceId: 'food',
        quantity: 8,
        priority: 100,
        transportMode: 'LAND',
        source: 'HXD10_PLAYER_ORDER'
    });
    assert.strictEqual(created.ok, true);
    const dispatched = runtime.api.tradeDispatchOrder(created.order.id, 8);
    assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
    const shipmentId = dispatched.shipment.id;
    let live = runtime.api.tradeLedger().shipments.find(row => row.id === shipmentId);
    assert(live, 'dispatch gerçek sevkiyat kaydı üretmeli');
    assert.strictEqual(live.transportVersion, 2);
    assert.strictEqual(live.transportAgent.vehicleClass, 'ROAD_CONVOY');
    assert.strictEqual(live.transportAgent.cargoShipmentId, live.id);
    assert(live.sellerCompanyId, 'Ankara yükü gerçek şirket kaynağına bağlanmalı');
    assert(live.commerceCargoRegionId,
        'şirket yükü soyut sayı değil, fiziksel bölge kargosuna bağlanmalı');
    assert(live.physicalRoute.steps.length >= 2);
    assert.strictEqual(runtime.api.regionalRegionView(targetRegionId).stocks.food, targetBefore,
        'araç varmadan İstanbul stoğu artamaz');
    assert.strictEqual(
        runtime.api.regionalRegionView(sourceRegionId).stocks.food,
        sourceBeforeDispatch - 8,
        'yük Ankara stoğundan dispatch anında fiziksel olarak ayrılmalı'
    );
    assert(runtime.api.tradeRegionView(sourceRegionId).outgoing.some(row => row.id === shipmentId));
    assert(runtime.api.tradeRegionView(targetRegionId).incoming.some(row => row.id === shipmentId));

    // İlk yol kesimini kır: konvoy yükleme sonunda bu segmentte beklemeli,
    // hedefe ışınlanmamalı ve İstanbul stoğu değişmemeli.
    const brokenSegmentId = live.physicalRoute.steps[0].segmentId;
    assert.strictEqual(runtime.api.hexInfrastructureSetSegmentDamage(
        brokenSegmentId,
        10000,
        { reason: 'HXD10_ROAD_BREAK' }
    ).ok, true);
    runtime.api.tradeTick(12, { autoBalance: false, dispatchOpen: false });
    live = runtime.api.tradeLedger().shipments.find(row => row.id === shipmentId);
    assert.strictEqual(live.status, 'HELD');
    assert.strictEqual(live.holdReason, 'PHYSICAL_SEGMENT_BLOCKED');
    assert(live.interruptionSeconds > 0, 'kırık yol gerçek gecikme yazmalı');
    assert.strictEqual(runtime.api.regionalRegionView(targetRegionId).stocks.food, targetBefore);

    assert.strictEqual(runtime.api.hexInfrastructureSetSegmentDamage(
        brokenSegmentId,
        0,
        { reason: 'HXD10_ROAD_REPAIR' }
    ).ok, true);
    for (let tick = 0; tick < 80; tick++) {
        live = runtime.api.tradeLedger().shipments.find(row => row.id === shipmentId);
        if (live.status === 'DELIVERED') break;
        runtime.api.tradeTick(2, { autoBalance: false, dispatchOpen: false });
    }
    live = runtime.api.tradeLedger().shipments.find(row => row.id === shipmentId);
    assert.strictEqual(live.status, 'DELIVERED');
    assert.strictEqual(live.transportAgent.state, 'DELIVERED');
    assert.strictEqual(live.transportAgent.currentCellIndex,
        live.physicalRoute.steps[live.physicalRoute.steps.length - 1].toCellIndex);
    assert.strictEqual(runtime.api.regionalRegionView(targetRegionId).stocks.food,
        targetBefore + 8, 'stok yalnız fiziksel boşaltmadan sonra sekiz artmalı');
    assert.strictEqual(runtime.api.tradeRegionView(targetRegionId).incoming.length, 0);
    assert(runtime.api.tradeRegionView(targetRegionId).recent.some(row => row.id === shipmentId),
        'teslimat bölge UI defterinden gözlenebilir kalmalı');

    console.log('STORY_ANKARA_ISTANBUL_ROAD_VERTICAL_OK', JSON.stringify({
        shipmentId,
        companyId: live.sellerCompanyId,
        vehicleClass: live.transportAgent.vehicleClass,
        segmentCount: live.physicalRoute.steps.length,
        etaSeconds: live.routeLatencySeconds,
        interruptionSeconds: live.interruptionSeconds
    }));
} finally {
    runtime.dom.window.close();
}
