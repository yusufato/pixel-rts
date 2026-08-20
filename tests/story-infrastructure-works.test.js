'use strict';

const assert = require('node:assert');
const {
    storyInfrastructureWorkEnsure,
    storyInfrastructureWorkPreflight,
    storyInfrastructureWorkSubmit,
    storyInfrastructureWorkReserveAndSubmit,
    storyInfrastructureRouteCandidate,
    storyInfrastructureRouteReserveAndSubmit,
    storyInfrastructureRouteStart,
    storyInfrastructureRouteCorridorDefinitions,
    storyInfrastructureWorkStart,
    storyInfrastructureWorkTick,
    storyInfrastructureWorkForSave,
    storyInfrastructureWorkRestore
} = require('../js/StoryInfrastructureWorks.js');

function fixture() {
    const segment = {
        id: 'segment:rail:10:11', mode: 'RAIL', kind: 'RAIL_TRACK',
        corridorIds: ['corridor:rail:0:1'], damageBps: 6000,
        maintenanceBps: 7000, enabled: true, lifecycleState: 'DAMAGED',
        repairRemainingSeconds: 0
    };
    return { root: {}, segment, registry: {
        segmentById: { [segment.id]: segment }, revision: 0
    } };
}

const f = fixture();
const incomplete = storyInfrastructureWorkPreflight({ targetSegmentId: f.segment.id }, f);
assert.equal(incomplete.ok, false);
assert(incomplete.blockReasons.includes('AUTHORITY_APPROVAL_REQUIRED'));
assert(incomplete.blockReasons.includes('RESOURCE_RESERVATION_REQUIRED'));

const requirements = incomplete.requirements;
const spec = {
    targetSegmentId: f.segment.id,
    permission: { approved: true, institutionId: 'institution:transport',
        decisionId: 'decision:repair:1', authorityActorId: 'actor:minister' },
    resourceReservation: { id: 'reservation:repair:1', ownerType: 'STATE',
        ownerId: 'country:0', regionId: 'region:0', cash: requirements.cash,
        workforce: requirements.workforce, materials: requirements.materials }
};
const submitted = storyInfrastructureWorkSubmit(spec, f);
assert.equal(submitted.ok, true);
assert.equal(submitted.command.status, 'AUTHORIZED');
assert.equal(storyInfrastructureWorkSubmit(spec, f).code, 'SEGMENT_WORK_ALREADY_OPEN');

const started = storyInfrastructureWorkStart(submitted.command.id, f);
assert.equal(started.ok, true);
assert.equal(f.segment.lifecycleState, 'UNDER_REPAIR');
assert(storyInfrastructureWorkTick(requirements.durationDays - 1, f).completed.length === 0);
assert.equal(f.segment.damageBps, 6000, 'repair may not mutate damage before completion');

const savedDuringRepair = storyInfrastructureWorkForSave(f.root);
const restoredRoot = {};
assert.equal(storyInfrastructureWorkRestore(savedDuringRepair, restoredRoot).ok, true);
assert.equal(restoredRoot.infrastructureWorks.commands[0].status, 'IN_PROGRESS');

const completed = storyInfrastructureWorkTick(1, f);
assert.equal(completed.completed.length, 1);
assert.equal(f.segment.damageBps, 0);
assert.equal(f.segment.maintenanceBps, 10000);
assert.equal(f.segment.lifecycleState, 'OPERATING');
assert.equal(f.root.infrastructureWorks.receipts.length, 1);
assert.equal(f.root.infrastructureWorks.commands[0].completionReceiptId,
    f.root.infrastructureWorks.receipts[0].id);

const healthy = storyInfrastructureWorkPreflight(spec, f);
assert(healthy.blockReasons.includes('SEGMENT_REPAIR_NOT_REQUIRED'));
assert.equal(storyInfrastructureWorkRestore({ schemaVersion: 99 }, {}).ok, false);

const funded = fixture();
const balances = { cash: 100, workers: 100, stocks: {
    raw_materials: 100, industrial_parts: 100, electronics: 100
}, escrow: 0, settled: 0 };
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
    stock: (_region, resourceId) => balances.stocks[resourceId] || 0,
    stockDelta: (_region, resourceId, amount) => {
        if ((balances.stocks[resourceId] || 0) + amount < 0) return { ok: false };
        balances.stocks[resourceId] = (balances.stocks[resourceId] || 0) + amount;
        return { ok: true };
    },
    availableWorkers: () => balances.workers
};
const fundedSpec = {
    targetSegmentId: funded.segment.id, ownerType: 'COMPANY', ownerId: 'company:1',
    regionId: 'region:0', permission: spec.permission
};
const fundedSubmit = storyInfrastructureWorkReserveAndSubmit(fundedSpec,
    Object.assign({}, funded, { economy }));
assert.equal(fundedSubmit.ok, true);
assert(balances.cash < 100 && balances.escrow > 0,
    'real reservation must move payer cash into escrow');
assert.equal(storyInfrastructureWorkStart(fundedSubmit.command.id, funded).ok, true);
storyInfrastructureWorkTick(fundedSubmit.command.requirements.durationDays,
    Object.assign({}, funded, { economy }));
assert.equal(balances.escrow, 0);
assert(balances.settled > 0, 'completion must settle reserved company cash');

const routeRoot = {};
const routeBalances = { cash: 1000, workers: 1000,
    stocks: { raw_materials: 1000, industrial_parts: 1000, electronics: 1000 },
    escrow: 0, settled: 0 };
const routeEconomy = {
    cashAvailable: () => routeBalances.cash,
    cashReserve: (_type, _id, amount) => {
        routeBalances.cash -= amount; routeBalances.escrow += amount; return { ok: true };
    },
    cashRollback: (_type, _id, amount) => {
        routeBalances.cash += amount; routeBalances.escrow -= amount; return { ok: true };
    },
    cashSettle: (_type, _id, amount) => {
        routeBalances.escrow -= amount; routeBalances.settled += amount; return { ok: true };
    },
    stock: (_region, resourceId) => routeBalances.stocks[resourceId],
    stockDelta: (_region, resourceId, amount) => {
        routeBalances.stocks[resourceId] += amount; return { ok: true };
    },
    availableWorkers: () => routeBalances.workers
};
const routeContext = {
    root: routeRoot,
    world: { cellCount: 3 },
    geography: {
        regionIds: Int16Array.from([0, 2, 1]),
        landCoverageBps: Uint16Array.from([10000, 9000, 10000]),
        mountainIntensityBps: Uint16Array.from([0, 0, 0])
    },
    settlements: { coreCellIndices: Int32Array.from([0, 2, 1]) },
    graph: { corridors: [] },
    findLandPath: () => [0, 1, 2],
    economy: routeEconomy
};
const routeBase = {
    mode: 'RAIL', fromRegionId: 'region:0', toRegionId: 'region:1',
    ownerType: 'STATE', ownerId: 'country:0', fundingRegionId: 'region:0',
    permission: spec.permission,
    environmentalAssessment: { assessmentId: 'eia:1', mitigationId: 'mitigation:1', restorationCash: 5 }
};
const missingRights = storyInfrastructureRouteCandidate(routeBase, routeContext);
assert(missingRights.blockReasons.some(reason => reason.startsWith('RIGHT_OF_WAY_REQUIRED:')));
const routeSpec = Object.assign({}, routeBase, { rightOfWay: {
    evidenceByRegion: { 'region:0': 'row:0', 'region:1': 'row:1', 'region:2': 'row:2' },
    compensationCash: 10
} });
const routeSubmitted = storyInfrastructureRouteReserveAndSubmit(routeSpec, routeContext);
assert.equal(routeSubmitted.ok, true);
assert.equal(routeSubmitted.command.pathCellIndices.length, 3);
assert.equal(storyInfrastructureRouteStart(routeSubmitted.command.id, routeContext).ok, true);
const routeCompleted = storyInfrastructureWorkTick(
    routeSubmitted.command.requirements.durationDays, routeContext);
assert.equal(routeCompleted.completedRoutes.length, 1);
assert.equal(routeRoot.infrastructureWorks.routes.length, 1);
assert.equal(routeBalances.escrow, 0);
global.STORY = { infrastructureWorks: routeRoot.infrastructureWorks,
    regionModel: { regions: [
        { id: 'region:0', center: { x: 0, y: 0 } },
        { id: 'region:1', center: { x: 1, y: 0 } }
    ] } };
global.storyInfrastructurePhysicalDefinition = (mode, a, b) => ({
    id: `base:${mode}:${a.id}:${b.id}`, mode,
    endpointRegionIds: [a.id, b.id]
});
const dynamicDefinitions = storyInfrastructureRouteCorridorDefinitions();
assert.equal(dynamicDefinitions.length, 1);
assert.equal(dynamicDefinitions[0].id, routeRoot.infrastructureWorks.routes[0].corridorId);
delete global.STORY;
delete global.storyInfrastructurePhysicalDefinition;

console.log('STORY_INFRASTRUCTURE_WORKS_OK', JSON.stringify({
    requirements,
    receiptId: completed.completed[0].id,
    registryRevision: f.registry.revision,
    ledgerRevision: storyInfrastructureWorkEnsure(f.root).revision,
    fundedCashSettled: balances.settled,
    builtRoute: routeRoot.infrastructureWorks.routes[0].corridorId,
    routeCashSettled: routeBalances.settled
}));
