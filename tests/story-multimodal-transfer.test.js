'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ console, Math, Map, Set });
vm.runInContext(fs.readFileSync(path.join(root, 'js/StoryTransportAgents.js'), 'utf8'),
    context, { filename: 'js/StoryTransportAgents.js' });

const result = vm.runInContext(`(() => {
    STORY = { clock: 10 };
    let deliveries = 0;
    const segments = {
        road: { id: 'road', enabled: true, damageBps: 0, maintenanceBps: 10000 },
        rail: { id: 'rail', enabled: true, damageBps: 0, maintenanceBps: 10000 }
    };
    const corridors = {
        road: { id: 'road', enabled: true, damageBps: 0 },
        rail: { id: 'rail', enabled: true, damageBps: 0 }
    };
    storyHexInfrastructureSegmentsEnsure = () => ({ segmentById: segments });
    storyHexInfrastructureSegmentFactorBps = () => 10000;
    storyInfrastructureGetCorridor = id => corridors[id];
    storyInfrastructureAuthorizedCountriesCanUse = () => true;
    storyTradeEnsure = () => ({ contracts: [{ id: 'contract:1', partyCountryIds: ['country:0'] }] });
    storyTradeRound = storyTransportRound;
    storyRoutePlannerRelease = () => ({ ok: true, changed: true });
    storyTradeCompleteShipment = shipment => {
        deliveries++;
        shipment.status = 'DELIVERED';
        shipment.transportAgent.state = 'DELIVERED';
        storyTransportReleaseReservation(shipment, 'DELIVERED');
        return { ok: true };
    };
    const route = { ok: true, routeId: 'route:road-rail', modes: ['LAND', 'RAIL'],
        regionIds: ['A', 'B', 'C'], corridorIds: ['road', 'rail'],
        segmentIds: ['road', 'rail'], transferRegionIds: ['B'], reliabilityBps: 10000,
        totalLatencySeconds: 6, microLegs: [
            { corridorId: 'road', mode: 'LAND', cellIndices: [1, 2],
                segmentIds: ['road'], plannedLatencySeconds: 2 },
            { corridorId: 'rail', mode: 'RAIL', cellIndices: [2, 3],
                segmentIds: ['rail'], plannedLatencySeconds: 2 }
        ] };
    const shipment = { id: 'shipment:multimodal', contractId: 'contract:1',
        status: 'IN_TRANSIT', quantity: 5, routeRegionIds: ['A', 'B', 'C'],
        corridorIds: ['road', 'rail'], legIndex: 0, currentRegionId: 'A',
        targetRegionId: 'C', interruptionSeconds: 0, damageDelaySeconds: 0 };
    storyTransportAttachShipment(shipment, route, { id: 'reserve:multi' });
    storyTransportAdvanceShipment(shipment, 2.5);
    const boundary = { state: shipment.transportAgent.state,
        mode: shipment.transportAgent.mode,
        from: shipment.transportAgent.transferFromMode,
        to: shipment.transportAgent.transferToMode,
        region: shipment.currentRegionId,
        cell: shipment.transportAgent.currentCellIndex,
        duration: shipment.transportAgent.phaseRemainingSeconds };
    storyTransportAdvanceShipment(shipment, 0.1);
    const admitted = { state: shipment.transportAgent.state,
        terminalKey: shipment.transportAgent.terminalKey,
        window: shipment.transportAgent.terminalWindow };
    storyTransportAdvanceShipment(shipment, 1.9);
    const transferred = { state: shipment.transportAgent.state,
        mode: shipment.transportAgent.mode,
        vehicleClass: shipment.transportAgent.vehicleClass,
        transferToMode: shipment.transportAgent.transferToMode || null };
    storyTransportAdvanceShipment(shipment, 2.5);
    return { boundary, admitted, transferred, finalStatus: shipment.status,
        finalCell: shipment.transportAgent.currentCellIndex, deliveries,
        validation: storyTransportShipmentValidate(shipment) };
})()`, context);

assert.deepStrictEqual(JSON.parse(JSON.stringify(result.boundary)), {
    state: 'QUEUED', mode: 'LAND', from: 'LAND', to: 'RAIL',
    region: 'B', cell: 2, duration: 2
});
assert.strictEqual(result.admitted.state, 'TRANSFERRING');
assert.match(result.admitted.terminalKey, /RAIL:2:TRANSFER:LAND>RAIL/);
assert.strictEqual(result.admitted.window.mode, 'RAIL');
assert.strictEqual(result.transferred.state, 'MOVING');
assert.strictEqual(result.transferred.mode, 'RAIL');
assert.strictEqual(result.transferred.vehicleClass, 'FREIGHT_TRAIN');
assert.strictEqual(result.transferred.transferToMode, null);
assert.strictEqual(result.finalStatus, 'DELIVERED');
assert.strictEqual(result.finalCell, 3);
assert.strictEqual(result.deliveries, 1);
assert.strictEqual(result.validation.ok, true);

console.log('STORY_MULTIMODAL_TRANSFER_OK', JSON.stringify({
    terminal: result.admitted.terminalKey,
    transferSeconds: result.boundary.duration,
    finalVehicle: result.transferred.vehicleClass
}));
