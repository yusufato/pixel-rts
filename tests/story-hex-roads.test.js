const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ console, Math, Map, Set,
    Int16Array, Int32Array, Uint8Array, Uint16Array, Uint32Array, Float32Array, Float64Array });
for (const file of ['js/StoryHexWorld.js', 'js/StoryHexRoads.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
vm.runInContext('const STORY_HEX_MOVEMENT_LAND = 1;', context);

const result = vm.runInContext(`(() => {
    const world = storyHexWorldCreate({ width: 260, height: 170, radius: 16.1 });
    const geography = {
        movementMask: new Uint8Array(world.cellCount),
        mountainIntensityBps: new Uint16Array(world.cellCount),
        landCoverageBps: new Uint16Array(world.cellCount)
    };
    geography.movementMask.fill(1);
    geography.landCoverageBps.fill(10000);
    const start = storyHexWorldIndex(world, 1, 2);
    const end = storyHexWorldIndex(world, 6, 2);
    const blocked = storyHexWorldIndex(world, 3, 2);
    geography.movementMask[blocked] = 0;
    geography.landCoverageBps[blocked] = 0;
    const path = storyHexRoadFindPath(world, geography, start, end);
    const adjacent = path.every((cell, index) => !index
        || storyHexRoadDistance(world, path[index - 1], cell) === 1);
    const avoidsBlocked = !path.includes(blocked);
    for (const neighbor of storyHexWorldNeighbors(world,
        Number(world.qValues[end]), Number(world.rValues[end]))) {
        if (neighbor.index !== start) geography.movementMask[neighbor.index] = 0;
    }
    const disconnected = storyHexRoadFindPath(world, geography, start, end);
    return { path, adjacent, avoidsBlocked, disconnected };
})()`, context);

assert(result.path.length > 2, 'route should contain a real hex chain');
assert.strictEqual(result.adjacent, true, 'every route step must share a hex edge');
assert.strictEqual(result.avoidsBlocked, true, 'route must avoid non-land cells');
assert.deepStrictEqual(Array.from(result.disconnected), [], 'disconnected land masses must not invent a road');
console.log('STORY_HEX_ROADS_OK', JSON.stringify({ steps: result.path.length - 1 }));

const segments = vm.runInContext(`(() => {
    const world = storyHexWorldCreate({ width: 300, height: 180, radius: 16.1 });
    const geography = {
        movementMask: new Uint8Array(world.cellCount),
        mountainIntensityBps: new Uint16Array(world.cellCount),
        landCoverageBps: new Uint16Array(world.cellCount)
    };
    geography.movementMask.fill(1);
    geography.landCoverageBps.fill(10000);
    const cores = new Int16Array(3);
    cores[0] = storyHexWorldIndex(world, 1, 2);
    cores[1] = storyHexWorldIndex(world, 3, 2);
    cores[2] = storyHexWorldIndex(world, 7, 2);
    const corridors = [
        { id: 'corridor:land:0:2', mode: 'LAND', endpointRegionIds: ['region:0', 'region:2'], baseCapacity: 100 },
        { id: 'corridor:land:1:2', mode: 'LAND', endpointRegionIds: ['region:1', 'region:2'], baseCapacity: 80 },
        { id: 'corridor:energy:0:2:land', mode: 'ENERGY', parentCorridorId: 'corridor:land:0:2', endpointRegionIds: ['region:0', 'region:2'], baseCapacity: 70 }
    ];
    const registry = storyHexInfrastructureBuild(world, geography,
        { coreCellIndices: cores }, corridors);
    const shared = registry.segments.find(segment => segment.corridorIds.includes('corridor:land:0:2')
        && segment.corridorIds.includes('corridor:land:1:2'));
    shared.damageBps = 5000;
    return {
        segmentCount: registry.segments.length,
        sharedSegmentCount: registry.diagnostics.sharedSegmentCount,
        failedCorridorCount: registry.diagnostics.failedCorridorCount,
        sharedCorridors: shared.corridorIds.slice(),
        damagedFactorBps: storyHexInfrastructureSegmentFactorBps(shared),
        inheritedEnergySegments: registry.corridorSegmentIds['corridor:energy:0:2:land'].length,
        parentLandSegments: registry.corridorSegmentIds['corridor:land:0:2'].length
    };
})()`, context);

assert(segments.segmentCount > 0, 'physical road registry must contain hex-edge segments');
assert(segments.sharedSegmentCount > 0, 'overlapping corridors must share the same physical segment');
assert.strictEqual(segments.failedCorridorCount, 0, 'valid fixture corridors must all receive physical paths');
assert(segments.sharedCorridors.includes('corridor:energy:0:2:land'),
    'energy overlay must inherit the physical land path instead of inventing geometry');
assert.strictEqual(segments.damagedFactorBps, 5000,
    '50% physical damage must reduce the segment condition factor to 50%');
assert.strictEqual(segments.inheritedEnergySegments, segments.parentLandSegments,
    'overlay and parent corridor must reference the same segment chain');

const missingPhysicalFactor = vm.runInContext(`(() => {
    const registry = {
        corridorSegmentIds: { 'corridor:land:blocked': [] },
        segmentById: {}
    };
    storyHexInfrastructureSegmentsEnsure = () => registry;
    return storyHexInfrastructureCorridorFactorBps('corridor:land:blocked');
})()`, context);
assert.strictEqual(missingPhysicalFactor, 0,
    'a known land corridor without a physical hex chain must be closed');

const infraContext = vm.createContext({ console, Math, Map, Set,
    STORY: {}, storyHexInfrastructureCorridorFactorBps: () => 5000 });
vm.runInContext(fs.readFileSync(path.join(root, 'js/StoryInfrastructure.js'), 'utf8'),
    infraContext, { filename: 'js/StoryInfrastructure.js' });
const physicalCapacity = vm.runInContext(`storyInfrastructureEffectiveCapacity({
    id: 'corridor:land:0:2', enabled: true, baseCapacity: 100, damageBps: 0
})`, infraContext);
assert.strictEqual(physicalCapacity, 50,
    'macro corridor capacity must include its physical segment bottleneck');

const persistence = vm.runInContext(`(() => {
    const segment = {
        id: 'segment:land:1:2', corridorIds: ['corridor:land:0:1'],
        damageBps: 0, maintenanceBps: 10000, enabled: true,
        lifecycleState: 'OPERATING', repairRemainingSeconds: 0
    };
    const registry = {
        schemaVersion: STORY_HEX_INFRASTRUCTURE_SCHEMA_VERSION,
        adapterVersion: STORY_HEX_INFRASTRUCTURE_ADAPTER_VERSION,
        networkHash: 'network:test', topologyHash: 'topology:test', revision: 0,
        segments: [segment], segmentById: { [segment.id]: segment },
        corridorSegmentIds: { 'corridor:land:0:1': [segment.id] }
    };
    STORY = { infrastructureGraph: { damageRevision: 0 } };
    storyHexInfrastructureSegmentsEnsure = () => registry;
    const changed = storyHexInfrastructureSetSegmentDamage(segment.id, 6000, {
        maintenanceBps: 8000, repairRemainingSeconds: 45
    });
    const saved = storyHexInfrastructureForSave();
    segment.damageBps = 0; segment.maintenanceBps = 10000;
    segment.lifecycleState = 'OPERATING'; segment.repairRemainingSeconds = 0;
    const restored = storyHexInfrastructureRestore(saved);
    return { changed, savedStateCount: saved.states.length, restored: restored.ok,
        damageBps: segment.damageBps, maintenanceBps: segment.maintenanceBps,
        lifecycleState: segment.lifecycleState, repairRemainingSeconds: segment.repairRemainingSeconds };
})()`, context);
assert.strictEqual(persistence.changed.ok, true, 'segment damage mutation must succeed');
assert.strictEqual(persistence.savedStateCount, 1, 'only non-default physical state must be persisted');
assert.strictEqual(persistence.restored, true, 'physical segment save must restore');
assert.strictEqual(persistence.damageBps, 6000, 'restored damage must equal saved damage');
assert.strictEqual(persistence.maintenanceBps, 8000, 'restored maintenance must equal saved maintenance');
assert.strictEqual(persistence.lifecycleState, 'DAMAGED', 'damage must restore its physical lifecycle');
assert.strictEqual(persistence.repairRemainingSeconds, 45, 'repair time must survive save/load');

console.log('STORY_HEX_INFRASTRUCTURE_OK', JSON.stringify(segments));
