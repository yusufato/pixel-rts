const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ console, Math, Map, Set });
vm.runInContext(fs.readFileSync(path.join(root, 'js/StoryTransportAgents.js'), 'utf8'),
    context, { filename: 'js/StoryTransportAgents.js' });

const result = vm.runInContext('(() => {' +
    'STORY={clock:0};let deliveries=0,releases=0;' +
    'const segments={' +
    '"s1":{id:"s1",enabled:true,damageBps:0,maintenanceBps:10000,lengthWorld:1},' +
    '"s2":{id:"s2",enabled:true,damageBps:0,maintenanceBps:10000,lengthWorld:1}};' +
    'const corridor={id:"c1",enabled:true,damageBps:0,partyCountryIds:["country:0"]};' +
    'const registry={segmentById:segments};storyHexInfrastructureSegmentsEnsure=()=>registry;' +
    'storyHexInfrastructureSegmentFactorBps=s=>s&&s.enabled?Math.floor((10000-s.damageBps)*s.maintenanceBps/10000):0;' +
    'storyInfrastructureGetCorridor=()=>corridor;storyInfrastructureAuthorizedCountriesCanUse=()=>true;' +
    'storyTradeEnsure=()=>({contracts:[{id:"contract:1",partyCountryIds:["country:0"]}]});' +
    'storyTradeRound=storyTransportRound;storyTradeCompleteShipment=s=>{deliveries++;s.status="DELIVERED";storyTransportReleaseReservation(s,"DELIVERED");return {ok:true};};' +
    'storyRoutePlannerRelease=()=>{releases++;return {ok:true,changed:true};};' +
    'const route={ok:true,routeId:"route:1",modes:["LAND"],regionIds:["A","B"],corridorIds:["c1"],segmentIds:["s1","s2"],' +
    'transferRegionIds:[],reliabilityBps:10000,totalLatencySeconds:4,microLegs:[{corridorId:"c1",mode:"LAND",' +
    'cellIndices:[10,11,12],segmentIds:["s1","s2"],plannedLatencySeconds:4}]};' +
    'const make=id=>({id,contractId:"contract:1",status:"IN_TRANSIT",holdReason:null,quantity:3,' +
    'routeRegionIds:["A","B"],corridorIds:["c1"],legIndex:0,currentRegionId:"A",targetRegionId:"B",' +
    'interruptionSeconds:0,damageDelaySeconds:0});' +
    'const shipment=make("shipment:1");const attached=storyTransportAttachShipment(shipment,route,{id:"reserve:1"});' +
    'storyTransportAdvanceShipment(shipment,0.25);const loadingState=shipment.transportAgent.state;' +
    'storyTransportAdvanceShipment(shipment,0.25);storyTransportAdvanceShipment(shipment,1);' +
    'const midProgress=shipment.transportAgent.stepProgressBps;const beforeBlockDeliveries=deliveries;' +
    'corridor.damageBps=10000;const blocked=storyTransportAdvanceShipment(shipment,2);' +
    'const blockedProgress=shipment.transportAgent.stepProgressBps;corridor.damageBps=0;' +
    'storyTransportAdvanceShipment(shipment,10);' +
    'const one=make("shipment:one"),many=make("shipment:many");' +
    'storyTransportAttachShipment(one,route,{id:"reserve:one"});storyTransportAttachShipment(many,route,{id:"reserve:many"});' +
    'storyTransportAdvanceShipment(one,5);for(let i=0;i<50;i++)storyTransportAdvanceShipment(many,0.1);' +
    'const viewA=make("shipment:view-a"),viewB=make("shipment:view-b");viewB.quantity=4;' +
    'storyTransportAttachShipment(viewA,route,{id:"reserve:view-a"});storyTransportAttachShipment(viewB,route,{id:"reserve:view-b"});' +
    'viewA.transportAgent.state="MOVING";viewB.transportAgent.state="MOVING";' +
    'viewA.transportAgent.stepProgressBps=5000;viewB.transportAgent.stepProgressBps=5000;' +
    'const world={cellCount:13,centerX:new Array(13).fill(0),centerY:new Array(13).fill(0)};' +
    'world.centerX[10]=10;world.centerX[11]=20;world.centerX[12]=30;' +
    'const far=storyTransportRenderSnapshot({ledger:{shipments:[viewA,viewB]},world,zoomRatio:1});' +
    'const near=storyTransportRenderSnapshot({ledger:{shipments:[viewA,viewB]},world,zoomRatio:2});' +
    'storyTransportTerminalReset();const q1=make("shipment:q1"),q2=make("shipment:q2"),q3=make("shipment:q3"),q4=make("shipment:q4");' +
    '[q1,q2,q3,q4].forEach((s,i)=>storyTransportAttachShipment(s,route,{id:"reserve:q"+i}));' +
    'const queuedInitially=q4.transportAgent.state;storyTransportAdvanceShipment(q1,0.5);' +
    'const queueAdmission=storyTransportAdvanceShipment(q4,0.1);const admittedState=q4.transportAgent.state;' +
    'const terminalSaved=storyTransportTerminalForSave();storyTransportTerminalReset();' +
    'const terminalRestore=storyTransportTerminalRestore(terminalSaved);' +
    '[q1,q2,q3,q4].forEach(storyTransportTerminalRelease);' +
    'const redirecting=make("shipment:redirecting");storyTransportAttachShipment(redirecting,route,{id:"reserve:redirecting"});' +
    'redirecting.pendingRedirectRegionId="C";let redirectCalls=0;' +
    'storyTradeApplyRedirect=s=>{redirectCalls++;s.pendingRedirectRegionId=null;return {ok:true};};' +
    'const boundaryRedirect=storyTransportAdvanceShipment(redirecting,5);' +
    'const legacy=make("shipment:legacy");const legacyLedger={contracts:[{id:"contract:1"}],shipments:[legacy],diagnostics:{}};' +
    'storyTradeEnsure=()=>legacyLedger;storyTradeFindRoute=()=>route;' +
    'storyRoutePlannerReserve=()=>({ok:true,reservation:{id:"reserve:legacy"}});' +
    'const migration=storyTransportMigrateLegacyShipments();' +
    'return {attached,loadingState,midProgress,beforeBlockDeliveries,blocked,blockedProgress,' +
    'finalStatus:shipment.status,finalCell:shipment.transportAgent.currentCellIndex,releases,' +
    'far:{mode:far.mode,agents:far.agents.length,count:far.shipmentCount,cargo:far.cargoQuantity,x:far.agents[0].x},' +
    'near:{mode:near.mode,agents:near.agents.length,count:near.shipmentCount,cargo:near.cargoQuantity,x:near.agents[0].x},' +
    'boundaryRedirect,redirectCalls,redirectCell:redirecting.transportAgent.currentCellIndex,' +
    'queuedInitially,queueAdmission,admittedState,terminalRestoreBackfilled:terminalRestore.backfilled,' +
    'migration,legacy:{version:legacy.transportVersion,routeId:legacy.routeId,reservation:legacy.routeReservationId},' +
    'one:{status:one.status,state:one.transportAgent.state,cell:one.transportAgent.currentCellIndex,step:one.transportAgent.stepIndex},' +
    'many:{status:many.status,state:many.transportAgent.state,cell:many.transportAgent.currentCellIndex,step:many.transportAgent.stepIndex}};})()', context);

assert.strictEqual(result.attached.ok, true);
assert.strictEqual(result.loadingState, 'LOADING');
assert(result.midProgress > 0 && result.midProgress < 10000,
    'cargo must occupy a physical segment before delivery');
assert.strictEqual(result.beforeBlockDeliveries, 0,
    'target stock authority must not run while vehicle is still on a segment');
assert.strictEqual(result.blocked.held, true);
assert.strictEqual(result.blockedProgress, result.midProgress,
    'blocked corridor must freeze physical progress');
assert.strictEqual(result.finalStatus, 'DELIVERED');
assert.strictEqual(result.finalCell, 12);
assert(result.releases >= 1, 'delivery must release physical capacity');
assert.deepStrictEqual(result.one, result.many,
    'render/tick partitioning must not change physical shipment outcome');
assert.deepStrictEqual(JSON.parse(JSON.stringify(result.far)), {
    mode: 'AGGREGATED', agents: 1, count: 2, cargo: 7, x: 15
});
assert.deepStrictEqual(JSON.parse(JSON.stringify(result.near)), {
    mode: 'MATERIALIZED', agents: 2, count: 2, cargo: 7, x: 15
});
assert.strictEqual(result.boundaryRedirect.rerouted, true);
assert.strictEqual(result.redirectCalls, 1);
assert.strictEqual(result.redirectCell, 12,
    'redirect must wait for the safe physical leg boundary instead of teleporting');
assert.strictEqual(result.queuedInitially, 'QUEUED');
assert.strictEqual(result.queueAdmission.queued, undefined);
assert.strictEqual(result.admittedState, 'LOADING');
assert.strictEqual(result.terminalRestoreBackfilled, false);
assert.strictEqual(result.migration.migrated, 1);
assert.deepStrictEqual(JSON.parse(JSON.stringify(result.legacy)), {
    version: 2, routeId: 'route:1', reservation: 'reserve:legacy'
});

console.log('STORY_TRANSPORT_AGENTS_OK', JSON.stringify({
    midProgress: result.midProgress,
    blockedProgress: result.blockedProgress,
    finalCell: result.finalCell
}));
