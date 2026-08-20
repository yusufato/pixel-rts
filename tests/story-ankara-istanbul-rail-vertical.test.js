'use strict';

const assert = require('node:assert');
const { createRuntime } = require('../tools/story-sim-harness');

// HXD-11: canlı kampanyada kara/demir yolu seçimi, istasyon kapasitesi,
// gerçek yük treni, kırık rayda bekleme ve teslimde stok mutabakatı.
const seed = 2032;
const runtime = createRuntime(seed);
try {
    runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1,
        doctrine: 'combined', fog: true,
        featureFlags: { 'economy.saleSettlement': true } });
    const story = runtime.api.state();
    const ankara = story.nodes.find(node => node.name === 'Ankara');
    const istanbul = story.nodes.find(node => node.name === 'İstanbul');
    assert(ankara && istanbul);
    const sourceRegionId = `region:${ankara.id}`;
    const targetRegionId = `region:${istanbul.id}`;
    const routeOptions = { authorizedCountryIds: [`country:${ankara.owner}`],
        useCache: false };
    const road = runtime.api.routePlannerPlan(sourceRegionId, targetRegionId,
        Object.assign({ modes: ['LAND'] }, routeOptions));
    const rail = runtime.api.routePlannerPlan(sourceRegionId, targetRegionId,
        Object.assign({ modes: ['RAIL'] }, routeOptions));
    const automatic = runtime.api.routePlannerPlan(sourceRegionId, targetRegionId,
        Object.assign({ modes: ['LAND', 'RAIL'] }, routeOptions));
    assert.strictEqual(road.ok, true);
    assert.strictEqual(rail.ok, true);
    assert.deepStrictEqual(Array.from(rail.modes), ['RAIL']);
    assert(rail.totalLatencySeconds < road.totalLatencySeconds,
        'canlı 2032 dikeyinde demir yolu karadan hızlı olmalı');
    assert.deepStrictEqual(Array.from(automatic.modes), ['RAIL'],
        'otomatik seçim ölçülen hızlı ve ucuz demir yolunu seçmeli');

    const source = runtime.api.regionalRegionView(sourceRegionId);
    const targetBefore = runtime.api.regionalRegionView(targetRegionId).stocks.food;
    const desired = source.safeTargets.food * 1.25 + 50;
    assert.strictEqual(runtime.api.regionalStockDelta(sourceRegionId, 'food',
        desired - source.stocks.food,
        { type: 'HXD11_FIXTURE', source: 'ankara-istanbul-rail-vertical' }).ok, true);

    const shipmentIds = [];
    for (let index = 0; index < 3; index++) {
        const created = runtime.api.tradeCreateOrder({ sourceRegionId, targetRegionId,
            resourceId: 'food', quantity: 2, priority: 100,
            transportMode: 'RAIL', source: 'HXD11_PLAYER_RAIL_ORDER' });
        assert.strictEqual(created.ok, true);
        const dispatched = runtime.api.tradeDispatchOrder(created.order.id, 2);
        assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
        shipmentIds.push(dispatched.shipment.id);
    }
    let shipments = shipmentIds.map(id => runtime.api.tradeLedger().shipments
        .find(row => row.id === id));
    assert.deepStrictEqual(shipments.map(row => row.transportAgent.state),
        ['LOADING', 'LOADING', 'QUEUED'],
        'iki ray terminal yuvası dolunca üçüncü tren gerçekten kuyrukta kalmalı');
    assert.strictEqual(shipments[2].transportAgent.terminalQueuePosition, 1);
    assert(shipments.every(row => row.transportAgent.vehicleClass === 'FREIGHT_TRAIN'));
    assert(shipments.every(row => row.requestedTransportMode === 'RAIL'));
    assert.strictEqual(runtime.api.regionalRegionView(targetRegionId).stocks.food,
        targetBefore, 'yükleme/kuyruk hedef stoğunu arttıramaz');

    const brokenSegmentId = shipments[0].physicalRoute.steps[0].segmentId;
    assert.strictEqual(runtime.api.hexInfrastructureSetSegmentDamage(
        brokenSegmentId, 10000, { reason: 'HXD11_RAIL_BREAK' }).ok, true);
    runtime.api.tradeTick(3, { autoBalance: false, dispatchOpen: false });
    shipments = shipmentIds.map(id => runtime.api.tradeLedger().shipments
        .find(row => row.id === id));
    assert(shipments.every(row => row.status === 'HELD'));
    assert(shipments.every(row => row.holdReason === 'PHYSICAL_SEGMENT_BLOCKED'));
    assert.strictEqual(runtime.api.regionalRegionView(targetRegionId).stocks.food,
        targetBefore);

    assert.strictEqual(runtime.api.hexInfrastructureSetSegmentDamage(
        brokenSegmentId, 0, { reason: 'HXD11_RAIL_REPAIR' }).ok, true);
    for (let tick = 0; tick < 80; tick++) {
        shipments = shipmentIds.map(id => runtime.api.tradeLedger().shipments
            .find(row => row.id === id));
        if (shipments.every(row => row.status === 'DELIVERED')) break;
        runtime.api.tradeTick(1, { autoBalance: false, dispatchOpen: false });
    }
    shipments = shipmentIds.map(id => runtime.api.tradeLedger().shipments
        .find(row => row.id === id));
    assert(shipments.every(row => row.status === 'DELIVERED'));
    assert.strictEqual(runtime.api.regionalRegionView(targetRegionId).stocks.food,
        targetBefore + 6, 'üç tren yükü yalnız fiziksel boşaltmadan sonra eklenmeli');

    console.log('STORY_ANKARA_ISTANBUL_RAIL_VERTICAL_OK', JSON.stringify({
        roadEta: road.totalLatencySeconds,
        railEta: rail.totalLatencySeconds,
        automaticMode: automatic.modes[0],
        terminalStates: ['LOADING', 'LOADING', 'QUEUED'],
        shipmentCount: shipments.length
    }));
} finally {
    runtime.dom.window.close();
}
