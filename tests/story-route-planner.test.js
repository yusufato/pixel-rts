const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ console, Math, Map, Set });
vm.runInContext(fs.readFileSync(path.join(root, 'js/StoryRoutePlanner.js'), 'utf8'),
    context, { filename: 'js/StoryRoutePlanner.js' });

const result = vm.runInContext('(() => {' +
    'const makeSegment=(id,mode,a,b)=>({id,mode,endpointCellIndices:[Math.min(a,b),Math.max(a,b)],' +
    'baseCapacity:10,lengthWorld:1,damageBps:0,maintenanceBps:10000,enabled:true,lifecycleState:"OPERATING"});' +
    'const corridors=[' +
    '{id:"land-ab",mode:"LAND",endpointRegionIds:["A","B"],baseCapacity:10,costPerUnit:2,latencySeconds:5,damageBps:0,enabled:true,accessPolicy:"PUBLIC"},' +
    '{id:"rail-bd",mode:"RAIL",endpointRegionIds:["B","D"],baseCapacity:10,costPerUnit:2,latencySeconds:3,damageBps:0,enabled:true,accessPolicy:"PUBLIC"},' +
    '{id:"land-ac",mode:"LAND",endpointRegionIds:["A","C"],baseCapacity:10,costPerUnit:5,latencySeconds:8,damageBps:0,enabled:true,accessPolicy:"PUBLIC"},' +
    '{id:"land-cd",mode:"LAND",endpointRegionIds:["C","D"],baseCapacity:10,costPerUnit:5,latencySeconds:8,damageBps:0,enabled:true,accessPolicy:"PUBLIC"}];' +
    'const segments=[makeSegment("land:1:2","LAND",1,2),makeSegment("rail:2:4","RAIL",2,4),' +
    'makeSegment("land:1:3","LAND",1,3),makeSegment("land:3:4","LAND",3,4)];' +
    'const registry={topologyHash:"physical:test",revision:0,segments,' +
    'segmentById:Object.fromEntries(segments.map(s=>[s.id,s])),' +
    'corridorSegmentIds:{"land-ab":["land:1:2"],"rail-bd":["rail:2:4"],"land-ac":["land:1:3"],"land-cd":["land:3:4"]},' +
    'corridorCellPaths:{"land-ab":[1,2],"rail-bd":[2,4],"land-ac":[1,3],"land-cd":[3,4]}};' +
    'STORY={clock:10,regionModel:{regions:["A","B","C","D"].map(id=>({id}))}};' +
    'const graph={networkHash:"network:test",damageRevision:0,corridors};' +
    'storyInfrastructureEnsure=()=>graph;storyHexInfrastructureSegmentsEnsure=()=>registry;' +
    'storyInfrastructureEffectiveCapacity=c=>c.enabled?Math.floor(c.baseCapacity*(10000-c.damageBps)/10000):0;' +
    'storyInfrastructureActorCanUse=()=>true;storyInfrastructureAuthorizedCountriesCanUse=()=>true;' +
    'storyHexInfrastructureSegmentFactorBps=s=>(!s.enabled||s.lifecycleState==="CLOSED")?0:Math.floor((10000-s.damageBps)*s.maintenanceBps/10000);' +
    'const options={modes:["LAND","RAIL"],minCapacity:3,transferCost:0,transferLatencySeconds:0};' +
    'const perceptionRequired=storyRoutePlannerPlan("A","D",{...options,knowledgeMode:"PERCEIVED"});' +
    'const first=storyRoutePlannerPlan("A","D",options);' +
    'const repeated=storyRoutePlannerPlan("A","D",{...options,modes:["RAIL","LAND"]});' +
    'const landOnly=storyRoutePlannerPlan("A","C",{modes:["LAND"],minCapacity:1});' +
    'const landOnlyCached=storyRoutePlannerPlan("A","C",{modes:["LAND"],minCapacity:1});' +
    'const reserved=storyRoutePlannerReserve(first,6,{ownerId:"shipment:1",durationSeconds:100});' +
    'const blocked=storyRoutePlannerReserve(first,5,{ownerId:"shipment:2",durationSeconds:100});' +
    'const alternate=storyRoutePlannerPlan("A","D",{...options,minCapacity:5});' +
    'const saved=storyRoutePlannerForSave();storyRoutePlannerRelease(reserved.reservation.id,"TEST");' +
    'storyRoutePlannerPlan("A","D",options);' +
    'storyRoutePlannerPlan("A","C",{modes:["LAND"],minCapacity:1});' +
    'registry.segmentById["rail:2:4"].damageBps=10000;registry.segmentById["rail:2:4"].enabled=false;' +
    'registry.segmentById["rail:2:4"].lifecycleState="CLOSED";registry.revision++;graph.damageRevision++;' +
    'const targeted=storyRoutePlannerInvalidate({segmentIds:["rail:2:4"],corridorIds:["rail-bd"]});' +
    'const unaffectedLand=storyRoutePlannerPlan("A","C",{modes:["LAND"],minCapacity:1});' +
    'const replanned=storyRoutePlannerPlan("A","D",options);' +
    'const staleView={observerId:"ai:red",revision:1,reports:[{id:"report:rail-open",subjectType:"SEGMENT",' +
    'subjectId:"rail:2:4",status:"VERIFIED",confidenceBps:10000,observedAt:5,value:{enabled:true,damageBps:0,maintenanceBps:10000}}]};' +
    'const perceivedStale=storyRoutePlannerPlan("A","D",{...options,knowledgeMode:"PERCEIVED",networkView:staleView});' +
    'const updatedView={observerId:"ai:red",revision:2,reports:[{id:"report:rail-closed",subjectType:"SEGMENT",' +
    'subjectId:"rail:2:4",status:"VERIFIED",confidenceBps:10000,observedAt:10,value:{enabled:false,damageBps:10000,maintenanceBps:10000}}]};' +
    'const perceivedUpdated=storyRoutePlannerPlan("A","D",{...options,knowledgeMode:"PERCEIVED",networkView:updatedView});' +
    'registry.segmentById["rail:2:4"].damageBps=0;registry.segmentById["rail:2:4"].enabled=true;' +
    'registry.segmentById["rail:2:4"].lifecycleState="OPERATING";registry.revision++;graph.damageRevision++;' +
    'const restored=storyRoutePlannerRestore(saved);const diagnostics=storyRoutePlannerDiagnostics();' +
    'return {perceptionRequired,first,repeated,landOnly,landOnlyCached,reserved,blocked,alternate,targeted,' +
    'unaffectedLand,replanned,perceivedStale,perceivedUpdated,restored,diagnostics};})()', context);

assert.strictEqual(result.first.ok, true);
assert.strictEqual(result.perceptionRequired.ok, false);
assert.strictEqual(result.perceptionRequired.reason, 'PERCEPTION_REQUIRED',
    'AI callers must not silently fall back from perceived knowledge to world truth');
assert.deepStrictEqual(Array.from(result.first.corridorIds), ['land-ab', 'rail-bd']);
assert.deepStrictEqual(Array.from(result.first.modes), ['LAND', 'RAIL']);
assert.deepStrictEqual(Array.from(result.first.transferRegionIds), ['B']);
assert.deepStrictEqual(Array.from(result.first.segmentIds), ['land:1:2', 'rail:2:4']);
assert.strictEqual(result.repeated.routeId, result.first.routeId);
assert.strictEqual(result.repeated.cacheHit, true);
assert.strictEqual(result.landOnlyCached.cacheHit, true);
assert.strictEqual(result.reserved.ok, true);
assert.strictEqual(result.blocked.ok, false);
assert.strictEqual(result.blocked.code, 'ROUTE_CAPACITY_UNAVAILABLE');
assert.deepStrictEqual(Array.from(result.alternate.corridorIds), ['land-ac', 'land-cd']);
assert.strictEqual(result.replanned.ok, true);
assert.deepStrictEqual(Array.from(result.replanned.corridorIds), ['land-ac', 'land-cd']);
assert(!result.replanned.segmentIds.includes('rail:2:4'));
assert(result.targeted.removed > 0,
    'rail mutation must remove dependent multimodal cache entries');
assert.strictEqual(result.unaffectedLand.cacheHit, true,
    'rail-only mutation must preserve an unrelated LAND cache entry');
assert.deepStrictEqual(Array.from(result.perceivedStale.corridorIds),
    ['land-ab', 'rail-bd'],
    'AI must route from its stale observation instead of reading hidden true damage');
assert.strictEqual(result.perceivedStale.knowledgeMode, 'PERCEIVED');
assert(result.perceivedStale.observationIds.includes('report:rail-open'));
assert.deepStrictEqual(Array.from(result.perceivedUpdated.corridorIds),
    ['land-ac', 'land-cd'],
    'new verified closure observation must cause knowledge-bound replanning');
assert.strictEqual(result.restored.ok, true);
assert.strictEqual(result.diagnostics.activeReservations, 1);

console.log('STORY_ROUTE_PLANNER_OK', JSON.stringify({
    routeId: result.first.routeId,
    transfers: result.first.transferRegionIds,
    replanned: result.replanned.corridorIds
}));
