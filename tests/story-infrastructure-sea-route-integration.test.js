'use strict';

const assert = require('node:assert');
const { createRuntime } = require('../tools/story-sim-harness');

const seed = 2032;
const runtime = createRuntime(seed);
let savedRaw;
let corridorId;
let nantesId;
try {
    runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1,
        doctrine: 'combined', fog: true });
    const story = runtime.api.state();
    const from = story.nodes.find(node => node.name === 'Nantes');
    const to = story.nodes.find(node => node.name === 'Cork');
    assert(from && to, 'real world fixture requires Nantes and Cork');
    nantesId = from.id;
    const beforeSettlements = runtime.api.hexSettlementsEnsure();
    assert.equal(beforeSettlements.portFlags[from.id], 0,
        'Nantes must begin without a physical port so the test covers port construction');
    assert.equal(beforeSettlements.portFlags[to.id], 1, 'Cork must provide the existing endpoint port');
    const base = {
        mode: 'SEA', fromRegionId: `region:${from.id}`, toRegionId: `region:${to.id}`,
        ownerType: 'STATE', ownerId: 'country:0', fundingRegionId: `region:${from.id}`,
        permission: { approved: true, institutionId: 'institution:maritime-transport',
            decisionId: 'decision:nantes-cork-sea', authorityActorId: 'actor:transport-minister' },
        environmentalAssessment: { assessmentId: 'eia:nantes-cork',
            mitigationId: 'mitigation:nantes-cork', restorationCash: 25 }
    };
    const preview = runtime.api.infrastructureRouteCandidate(base);
    assert(preview.pathCellIndices.length > 2, 'candidate must cross a real physical sea path');
    assert.equal(preview.portSites.filter(port => !port.existing).length, 1,
        'candidate must identify the missing Nantes port');
    assert(preview.blockReasons.some(reason => reason.startsWith('PORT_AUTHORITY_REQUIRED:')),
        'both harbor jurisdictions must provide explicit authority evidence');
    const evidenceByRegion = Object.fromEntries(
        preview.crossedRegionIds.map(regionId => [regionId, `right-of-way:${regionId}`])
    );
    const portEvidence = Object.fromEntries(
        preview.crossedRegionIds.map(regionId => [regionId, `harbor-authority:${regionId}`])
    );
    const spec = Object.assign({}, base, {
        rightOfWay: { evidenceByRegion, compensationCash: 15 },
        portAuthority: { evidenceByRegion: portEvidence,
            dredgingPermitId: 'dredging:nantes-terminal' }
    });
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
    assert.equal(submitted.command.requirements.newPortCount, 1);
    assert.equal(runtime.api.infrastructureRouteStart(submitted.command.id, { economy }).ok, true);
    const completed = runtime.api.infrastructureWorkTick(
        submitted.command.requirements.durationDays, { economy });
    assert.equal(completed.completedRoutes.length, 1);
    corridorId = completed.completedRoutes[0].corridorId;
    assert.equal(balances.escrow, 0);
    const settlements = runtime.api.hexSettlementsEnsure();
    assert.equal(settlements.portFlags[from.id], 1,
        'commissioning must create the Nantes land/water port terminal');
    const physical = runtime.api.hexInfrastructureDiagnostics();
    assert.equal(physical.sourceSeaCorridorCount, 21);
    assert.equal(physical.failedSeaCorridorCount, 0);
    assert.deepEqual(runtime.api.hexInfrastructureCorridorPath(corridorId),
        completed.completedRoutes[0].pathCellIndices,
        'physical sea corridor must preserve the approved quay-to-quay cell chain');
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
    assert.equal(restored.api.hexSettlementsEnsure().portFlags[nantesId], 1,
        'save/load must retain the commissioned port requirement');
    const physical = restored.api.hexInfrastructureDiagnostics();
    assert.equal(physical.sourceSeaCorridorCount, 21);
    assert.equal(physical.failedSeaCorridorCount, 0);
    assert.deepEqual(restored.api.hexInfrastructureCorridorPath(corridorId),
        ledger.routes[0].pathCellIndices,
        'save/load must not silently move the approved sea terminals or lane');
    console.log('STORY_INFRASTRUCTURE_SEA_ROUTE_INTEGRATION_OK', JSON.stringify({
        corridorId, seaCorridors: physical.sourceSeaCorridorCount,
        seaSegments: physical.seaSegmentCount, portAccess: physical.portAccessSegmentCount
    }));
} finally {
    restored.dom.window.close();
}
