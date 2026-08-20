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
        { id: 'corridor:rail:0:2', mode: 'RAIL', endpointRegionIds: ['region:0', 'region:2'], baseCapacity: 120 },
        { id: 'corridor:energy:0:2:land', mode: 'ENERGY', parentCorridorId: 'corridor:land:0:2', endpointRegionIds: ['region:0', 'region:2'], baseCapacity: 70 }
    ];
    const registry = storyHexInfrastructureBuild(world, geography,
        { coreCellIndices: cores }, corridors);
    const shared = registry.segments.find(segment => segment.corridorIds.includes('corridor:land:0:2')
        && segment.corridorIds.includes('corridor:land:1:2'));
    const rail = registry.segments.find(segment =>
        segment.corridorIds.includes('corridor:rail:0:2'));
    shared.damageBps = 5000;
    return {
        segmentCount: registry.segments.length,
        sharedSegmentCount: registry.diagnostics.sharedSegmentCount,
        failedCorridorCount: registry.diagnostics.failedCorridorCount,
        sharedCorridors: shared.corridorIds.slice(),
        damagedFactorBps: storyHexInfrastructureSegmentFactorBps(shared),
        inheritedEnergySegments: registry.corridorSegmentIds['corridor:energy:0:2:land'].length,
        parentLandSegments: registry.corridorSegmentIds['corridor:land:0:2'].length,
        railSegmentCount: registry.corridorSegmentIds['corridor:rail:0:2'].length,
        railMode: rail.mode,
        railDistinctFromRoad: !registry.corridorSegmentIds['corridor:land:0:2']
            .includes(rail.id),
        railFactorBps: storyHexInfrastructureSegmentFactorBps(rail)
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
assert(segments.railSegmentCount > 0, 'rail corridor must receive a physical hex chain');
assert.strictEqual(segments.railMode, 'RAIL');
assert.strictEqual(segments.railDistinctFromRoad, true,
    'road and rail on the same hex edge must keep separate physical identities');
assert.strictEqual(segments.railFactorBps, 10000,
    'damaging a road segment must not silently damage the parallel rail track');

const seaSegments = vm.runInContext(`(() => {
    const world = storyHexWorldCreate({ width: 300, height: 180, radius: 16.1 });
    const geography = {
        movementMask: new Uint8Array(world.cellCount),
        mountainIntensityBps: new Uint16Array(world.cellCount),
        landCoverageBps: new Uint16Array(world.cellCount)
    };
    const startWater = storyHexWorldIndex(world, 1, 2);
    const endWater = storyHexWorldIndex(world, 7, 2);
    for (let q = 1; q <= 7; q++) {
        geography.movementMask[storyHexWorldIndex(world, q, 2)] = 2;
    }
    const portTerminalIds = new Int16Array([0, 1]);
    const portLandCellIndices = new Int16Array([
        storyHexWorldIndex(world, 1, 1), storyHexWorldIndex(world, 7, 1)
    ]);
    const portWaterCellIndices = new Int16Array([startWater, endWater]);
    const corridors = [
        { id: 'corridor:sea:0:1', mode: 'SEA',
            endpointRegionIds: ['region:0', 'region:1'], baseCapacity: 90 },
        { id: 'corridor:data:0:1:sea', mode: 'DATA',
            parentCorridorId: 'corridor:sea:0:1',
            endpointRegionIds: ['region:0', 'region:1'], baseCapacity: 160 }
    ];
    const registry = storyHexInfrastructureBuild(world, geography, {
        portTerminalIds, portLandCellIndices, portWaterCellIndices,
        coreCellIndices: new Int16Array(2)
    }, corridors);
    const seaChain = registry.corridorSegmentIds['corridor:sea:0:1'];
    const inherited = registry.corridorSegmentIds['corridor:data:0:1:sea'];
    const cellPath = registry.corridorCellPaths['corridor:sea:0:1'];
    const routeSegments = seaChain.map(id => registry.segmentById[id]);
    return {
        chainLength: seaChain.length,
        inheritedLength: inherited.length,
        inheritedExact: inherited.join('|') === seaChain.join('|'),
        endpointPortCount: routeSegments.filter(segment =>
            segment.kind === 'PORT_ACCESS').length,
        startsAndEndsOnPortLand: cellPath[0] === portLandCellIndices[0]
            && cellPath[cellPath.length - 1] === portLandCellIndices[1],
        allPhysical: routeSegments.every(segment => segment.mode === 'SEA'),
        sourceSeaCorridorCount: registry.diagnostics.sourceSeaCorridorCount,
        seaSegmentCount: registry.diagnostics.seaSegmentCount,
        failedSeaCorridorCount: registry.diagnostics.failedSeaCorridorCount
    };
})()`, context);
assert(seaSegments.chainLength > 2,
    'sea corridor must contain two port accesses and a real water-hex chain');
assert.strictEqual(seaSegments.endpointPortCount, 2,
    'both ends of a sea corridor must pass through a physical port terminal');
assert.strictEqual(seaSegments.startsAndEndsOnPortLand, true,
    'render path must connect the ordered physical port land endpoints');
assert.strictEqual(seaSegments.allPhysical, true,
    'every sea-corridor bottleneck must be a physical sea segment');
assert.strictEqual(seaSegments.inheritedExact, true,
    'sea data overlay must inherit the same physical chain');
assert.strictEqual(seaSegments.sourceSeaCorridorCount, 1);
assert(seaSegments.seaSegmentCount > 2);
assert.strictEqual(seaSegments.failedSeaCorridorCount, 0);

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
    const legacyRestored = storyHexInfrastructureRestore(Object.assign({}, saved, {
        schemaVersion: 1,
        adapterVersion: 'story-hex-infrastructure-segments-1',
        topologyHash: 'legacy-land-only-topology'
    }));
    return { changed, savedStateCount: saved.states.length, restored: restored.ok,
        legacyRestored: legacyRestored.ok,
        migratedFromSchemaVersion: legacyRestored.migratedFromSchemaVersion,
        damageBps: segment.damageBps, maintenanceBps: segment.maintenanceBps,
        lifecycleState: segment.lifecycleState, repairRemainingSeconds: segment.repairRemainingSeconds };
})()`, context);
assert.strictEqual(persistence.changed.ok, true, 'segment damage mutation must succeed');
assert.strictEqual(persistence.savedStateCount, 1, 'only non-default physical state must be persisted');
assert.strictEqual(persistence.restored, true, 'physical segment save must restore');
assert.strictEqual(persistence.legacyRestored, true,
    'HXD-7.1 land-only save must migrate without losing compatible segment state');
assert.strictEqual(persistence.migratedFromSchemaVersion, 1);
assert.strictEqual(persistence.damageBps, 6000, 'restored damage must equal saved damage');
assert.strictEqual(persistence.maintenanceBps, 8000, 'restored maintenance must equal saved maintenance');
assert.strictEqual(persistence.lifecycleState, 'DAMAGED', 'damage must restore its physical lifecycle');
assert.strictEqual(persistence.repairRemainingSeconds, 45, 'repair time must survive save/load');

console.log('STORY_HEX_INFRASTRUCTURE_OK', JSON.stringify({ land: segments, sea: seaSegments }));
