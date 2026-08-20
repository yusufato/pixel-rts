'use strict';

const assert = require('node:assert');
const { createRuntime } = require('../tools/story-sim-harness');

// HXD-11B: canlı kampanya ağında Bursa'dan kara aracıyla İstanbul'a, gerçek
// terminal aktarmasıyla trene ve ray üzerinden Sofya'ya tek ShipmentV2.
const seed = 2032;
const runtime = createRuntime(seed);
try {
    runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1,
        doctrine: 'combined', fog: true,
        featureFlags: { 'economy.saleSettlement': true } });
    const story = runtime.api.state();
    const bursa = story.nodes.find(node => node.name === 'Bursa');
    const istanbul = story.nodes.find(node => node.name === 'İstanbul');
    const sofia = story.nodes.find(node => node.name === 'Sofya');
    assert(bursa && istanbul && sofia);
    assert.strictEqual(bursa.owner, sofia.owner);
    const sourceRegionId = `region:${bursa.id}`;
    const targetRegionId = `region:${sofia.id}`;
    const source = runtime.api.regionalRegionView(sourceRegionId);
    const targetBefore = runtime.api.regionalRegionView(targetRegionId).stocks.food;
    const desired = source.safeTargets.food * 1.25 + 40;
    assert.strictEqual(runtime.api.regionalStockDelta(sourceRegionId, 'food',
        desired - source.stocks.food,
        { type: 'HXD11B_FIXTURE', source: 'story-live-multimodal-vertical' }).ok, true);

    const created = runtime.api.tradeCreateOrder({ sourceRegionId, targetRegionId,
        resourceId: 'food', quantity: 4, priority: 100,
        source: 'HXD11B_PLAYER_AUTO_ORDER' });
    assert.strictEqual(created.ok, true);
    const dispatched = runtime.api.tradeDispatchOrder(created.order.id, 4);
    assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
    const shipmentId = dispatched.shipment.id;
    let shipment = runtime.api.tradeLedger().shipments.find(row => row.id === shipmentId);
    assert.deepStrictEqual(Array.from(shipment.physicalRoute.modes), ['LAND', 'RAIL']);
    assert.deepStrictEqual(Array.from(shipment.physicalRoute.transferRegionIds),
        [`region:${istanbul.id}`]);
    assert.strictEqual(shipment.transportAgent.vehicleClass, 'ROAD_CONVOY');
    assert.strictEqual(runtime.api.regionalRegionView(targetRegionId).stocks.food, targetBefore);

    let transferSnapshot = null;
    for (let tick = 0; tick < 120; tick++) {
        runtime.api.tradeTick(0.25, { autoBalance: false, dispatchOpen: false });
        shipment = runtime.api.tradeLedger().shipments.find(row => row.id === shipmentId);
        if (shipment.transportAgent.state === 'TRANSFERRING') {
            transferSnapshot = {
                regionId: shipment.currentRegionId,
                cellIndex: shipment.transportAgent.currentCellIndex,
                fromMode: shipment.transportAgent.transferFromMode,
                toMode: shipment.transportAgent.transferToMode,
                terminalKey: shipment.transportAgent.terminalKey,
                window: shipment.transportAgent.terminalWindow
            };
            break;
        }
    }
    assert(transferSnapshot, 'canlı yük İstanbul aktarma terminalinden geçmeli');
    assert.strictEqual(transferSnapshot.regionId, `region:${istanbul.id}`);
    assert.strictEqual(transferSnapshot.fromMode, 'LAND');
    assert.strictEqual(transferSnapshot.toMode, 'RAIL');
    assert.match(transferSnapshot.terminalKey, /TRANSFER:LAND>RAIL/);
    assert.strictEqual(runtime.api.regionalRegionView(targetRegionId).stocks.food, targetBefore,
        'aktarma teslim değildir; hedef stok değişmemeli');

    let observedTrain = false;
    for (let tick = 0; tick < 160; tick++) {
        runtime.api.tradeTick(0.25, { autoBalance: false, dispatchOpen: false });
        shipment = runtime.api.tradeLedger().shipments.find(row => row.id === shipmentId);
        if (shipment.transportAgent.vehicleClass === 'FREIGHT_TRAIN') observedTrain = true;
        if (shipment.status === 'DELIVERED') break;
    }
    assert.strictEqual(observedTrain, true, 'aktarma bitince yük treni fiziksel ajan olmalı');
    assert.strictEqual(shipment.status, 'DELIVERED');
    assert.strictEqual(runtime.api.regionalRegionView(targetRegionId).stocks.food,
        targetBefore + 4);

    console.log('STORY_LIVE_MULTIMODAL_VERTICAL_OK', JSON.stringify({
        shipmentId,
        route: ['Bursa', 'İstanbul', 'Sofya'],
        modes: shipment.physicalRoute.modes,
        transferRegion: transferSnapshot.regionId,
        transferCell: transferSnapshot.cellIndex,
        finalVehicle: shipment.transportAgent.vehicleClass
    }));
} finally {
    runtime.dom.window.close();
}
