'use strict';

const assert = require('node:assert');
const { createRuntime } = require('../tools/story-sim-harness');

// HXD-12: canlı 2032 ağında gerçekten bağlı iki liman. Yük, fiziksel gemi,
// tek slotlu liman kuyruğu, hava gecikmesi ve abluka aynı ShipmentV2 gerçeğidir.
const seed = 2032;
const runtime = createRuntime(seed);
let savedRaw;
let seaCorridorId;
try {
    runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1,
        doctrine: 'combined', fog: true });
    const story = runtime.api.state();
    const izmir = story.nodes.find(node => node.name === 'İzmir');
    const athens = story.nodes.find(node => node.name === 'Atina');
    assert(izmir && athens, 'canlı dünya İzmir ve Atina limanlarını içermeli');
    assert.strictEqual(izmir.owner, athens.owner,
        '2032 dikeyi diplomasi değil fiziksel deniz taşımacılığını sınamalı');
    const sourceRegionId = `region:${izmir.id}`;
    const targetRegionId = `region:${athens.id}`;
    const plan = runtime.api.routePlannerPlan(sourceRegionId, targetRegionId, {
        modes: ['SEA'], authorizedCountryIds: [`country:${izmir.owner}`],
        minCapacity: 2, knowledgeMode: 'TRUTH', useCache: false
    });
    assert.strictEqual(plan.ok, true, JSON.stringify(plan));
    assert.deepStrictEqual(Array.from(plan.modes), ['SEA']);
    assert(plan.segmentIds.length >= 3, 'rota dekoratif çizgi değil fiziksel hücre zinciri olmalı');
    seaCorridorId = plan.corridorIds[0];

    const targetBefore = runtime.api.regionalRegionView(targetRegionId).stocks.food;

    const shipmentIds = [];
    for (let index = 0; index < 2; index++) {
        const created = runtime.api.tradeCreateOrder({ sourceRegionId, targetRegionId,
            resourceId: 'food', quantity: 2, priority: 100 - index,
            transportMode: 'SEA', source: 'HXD12_PLAYER_SEA_ORDER',
            exportReserveBps: 0 });
        assert.strictEqual(created.ok, true);
        const dispatched = runtime.api.tradeDispatchOrder(created.order.id, 2);
        assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
        shipmentIds.push(dispatched.shipment.id);
    }
    let shipments = runtime.api.tradeLedger().shipments.filter(row => shipmentIds.includes(row.id));
    assert(shipments.every(row => row.transportAgent.vehicleClass === 'CARGO_SHIP'));
    assert.strictEqual(shipments.filter(row => row.transportAgent.state === 'LOADING').length, 1,
        'SEA terminali aynı anda yalnız bir gemi yüklemeli');
    assert.strictEqual(shipments.filter(row => row.transportAgent.state === 'QUEUED').length, 1,
        'ikinci gemi fiziksel liman kuyruğunda kalmalı');

    runtime.api.maritimeConditionSet(seaCorridorId, {
        weatherFactorBps: 5000, reason: 'HXD12_STORM_FRONT'
    });
    for (let tick = 0; tick < 5; tick++) {
        runtime.api.tradeTick(0.25, { autoBalance: false, dispatchOpen: false });
    }
    shipments = runtime.api.tradeLedger().shipments.filter(row => shipmentIds.includes(row.id));
    const moving = shipments.find(row => Number(row.transportAgent.stepProgressBps) > 0);
    assert(moving, 'ilk kargo gemisi deniz hücrelerinde ilerlemeli');
    assert(Number(moving.weatherDelaySeconds) > 0, 'fırtına gecikmesi ayrı ölçülmeli');
    assert.strictEqual(runtime.api.regionalRegionView(targetRegionId).stocks.food, targetBefore,
        'gemi görünmesi teslimat değildir');

    runtime.api.maritimeConditionSet(seaCorridorId, {
        weatherFactorBps: 5000, blockaded: true,
        blockadedByCountryId: 'country:test-blockader', reason: 'HXD12_BLOCKADE'
    });
    const progressBeforeBlockade = moving.transportAgent.stepProgressBps;
    runtime.api.tradeTick(0.5, { autoBalance: false, dispatchOpen: false });
    shipments = runtime.api.tradeLedger().shipments.filter(row => shipmentIds.includes(row.id));
    const blocked = shipments.find(row => row.id === moving.id);
    assert.strictEqual(blocked.status, 'HELD');
    assert.strictEqual(blocked.holdReason, 'MARITIME_BLOCKADE');
    assert.strictEqual(blocked.transportAgent.stepProgressBps, progressBeforeBlockade,
        'abluka gemiyi aynı fiziksel noktada tutmalı');

    runtime.api.maritimeConditionClear(seaCorridorId);
    for (let tick = 0; tick < 300; tick++) {
        runtime.api.tradeTick(0.25, { autoBalance: false, dispatchOpen: false });
        shipments = runtime.api.tradeLedger().shipments.filter(row => shipmentIds.includes(row.id));
        if (shipments.every(row => row.status === 'DELIVERED')) break;
    }
    assert(shipments.every(row => row.status === 'DELIVERED'),
        JSON.stringify(shipments.map(row => ({ status: row.status, hold: row.holdReason,
            state: row.transportAgent.state }))));
    assert.strictEqual(runtime.api.regionalRegionView(targetRegionId).stocks.food,
        targetBefore + 4, 'stok yalnız iki fiziksel gemi boşaltınca artmalı');

    runtime.api.maritimeConditionSet(seaCorridorId, {
        weatherFactorBps: 7200, reason: 'HXD12_SAVE_RESUME'
    });
    runtime.api.saveNow();
    const saveStatus = runtime.api.saveStatus();
    assert.strictEqual(saveStatus.ok, true, saveStatus.error);
    assert.strictEqual(saveStatus.error, null);
    savedRaw = runtime.api.savedRaw();
    assert.strictEqual(JSON.parse(savedRaw).maritimeConditions
        .corridors[seaCorridorId].weatherFactorBps, 7200,
    'deniz koşulu ham kampanya kaydında bulunmalı');
} finally {
    runtime.dom.window.close();
}

const restored = createRuntime(seed);
try {
    restored.api.putSavedRaw(savedRaw);
    assert.strictEqual(restored.api.loadNow(), true);
    const condition = restored.api.maritimeConditionForCorridor(seaCorridorId);
    assert(condition, 'deniz koşulu kayıt-yükleme sonrasında kaybolmamalı');
    assert.strictEqual(condition.weatherFactorBps, 7200);
    assert.strictEqual(condition.reason, 'HXD12_SAVE_RESUME');
    console.log('STORY_IZMIR_ATINA_SEA_VERTICAL_OK', JSON.stringify({
        corridorId: seaCorridorId, vehicle: 'CARGO_SHIP', shipments: 2,
        weatherDelay: true, blockadeHold: true, saveResume: true
    }));
} finally {
    restored.dom.window.close();
}
