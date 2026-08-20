'use strict';

const assert = require('node:assert');
const { createRuntime } = require('../tools/story-sim-harness');

const seed = 2032;
const runtime = createRuntime(seed);
let savedRaw;
let corridorId;
try {
    runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1,
        doctrine: 'combined', fog: true });
    const story = runtime.api.state();
    const from = story.nodes.find(node => node.name === 'Ankara');
    const to = story.nodes.find(node => node.name === 'İzmir');
    assert(from && to, 'real world fixture requires Ankara and İzmir');
    const base = {
        mode: 'RAIL', fromRegionId: `region:${from.id}`, toRegionId: `region:${to.id}`,
        ownerType: 'STATE', ownerId: 'country:0', fundingRegionId: `region:${from.id}`,
        permission: { approved: true, institutionId: 'institution:transport',
            decisionId: 'decision:ankara-izmir-rail', authorityActorId: 'actor:minister' },
        environmentalAssessment: { assessmentId: 'eia:ankara-izmir',
            mitigationId: 'mitigation:ankara-izmir', restorationCash: 20 }
    };
    const preview = runtime.api.infrastructureRouteCandidate(base);
    assert(preview.pathCellIndices.length > 1, 'candidate must have a physical land path');
    assert(preview.blockReasons.some(reason => reason.startsWith('RIGHT_OF_WAY_REQUIRED:')),
        'crossed regions must require explicit right-of-way evidence');
    const evidenceByRegion = Object.fromEntries(
        preview.crossedRegionIds.map(regionId => [regionId, `right-of-way:${regionId}`])
    );
    const spec = Object.assign({}, base, { rightOfWay: {
        evidenceByRegion, compensationCash: preview.crossedRegionIds.length * 5
    } });
    const balances = { cash: 100000, workers: 100000,
        stocks: { raw_materials: 100000, industrial_parts: 100000, electronics: 100000 },
        escrow: 0, settled: 0 };
    const economy = {
        cashAvailable: () => balances.cash,
        cashReserve: (_type, _id, amount) => {
            balances.cash -= amount; balances.escrow += amount; return { ok: true };
        },
        cashRollback: (_type, _id, amount) => {
            balances.cash += amount; balances.escrow -= amount; return { ok: true };
        },
        cashSettle: (_type, _id, amount) => {
            balances.escrow -= amount; balances.settled += amount; return { ok: true };
        },
        stock: (_region, resourceId) => balances.stocks[resourceId],
        stockDelta: (_region, resourceId, amount) => {
            balances.stocks[resourceId] += amount; return { ok: true };
        },
        availableWorkers: () => balances.workers
    };
    const submitted = runtime.api.infrastructureRouteReserveAndSubmit(spec, { economy });
    assert.equal(submitted.ok, true);
    assert.equal(runtime.api.infrastructureRouteStart(submitted.command.id, { economy }).ok, true);
    const completed = runtime.api.infrastructureWorkTick(
        submitted.command.requirements.durationDays, { economy });
    assert.equal(completed.completedRoutes.length, 1);
    corridorId = completed.completedRoutes[0].corridorId;
    assert.equal(balances.escrow, 0);
    assert(balances.settled > 0);
    const graph = runtime.api.infrastructureGraph();
    assert(graph.corridors.some(corridor => corridor.id === corridorId && corridor.mode === 'RAIL'),
        'completed route must become a real macro infrastructure corridor');
    const physical = runtime.api.hexInfrastructureDiagnostics();
    assert.equal(physical.sourceRailCorridorCount, 41);
    assert.equal(physical.failedRailCorridorCount, 0);
    assert.deepEqual(runtime.api.hexInfrastructureCorridorPath(corridorId),
        completed.completedRoutes[0].pathCellIndices,
        'commissioned corridor must use the exact approved physical hex chain');
    runtime.api.saveNow();
    savedRaw = runtime.api.savedRaw();
} finally {
    runtime.dom.window.close();
}

const restored = createRuntime(seed);
try {
    restored.api.putSavedRaw(savedRaw);
    assert.equal(restored.api.loadNow(), true);
    const ledger = restored.api.infrastructureWorkLedger();
    assert.equal(ledger.routes.length, 1);
    assert.equal(ledger.routes[0].corridorId, corridorId);
    assert(restored.api.infrastructureGraph().corridors.some(corridor => corridor.id === corridorId));
    const physical = restored.api.hexInfrastructureDiagnostics();
    assert.equal(physical.sourceRailCorridorCount, 41);
    assert.equal(physical.failedRailCorridorCount, 0);
    assert.deepEqual(restored.api.hexInfrastructureCorridorPath(corridorId),
        ledger.routes[0].pathCellIndices,
        'save/load must preserve the approved physical route, not silently reroute it');
    console.log('STORY_INFRASTRUCTURE_ROUTE_INTEGRATION_OK', JSON.stringify({
        corridorId, railCorridors: physical.sourceRailCorridorCount,
        railSegments: physical.railSegmentCount
    }));
} finally {
    restored.dom.window.close();
}
