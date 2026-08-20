'use strict';

const assert = require('node:assert');
const {
    storyInfrastructureWorkEnsure,
    storyInfrastructureWorkPreflight,
    storyInfrastructureWorkSubmit,
    storyInfrastructureWorkReserveAndSubmit,
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

console.log('STORY_INFRASTRUCTURE_WORKS_OK', JSON.stringify({
    requirements,
    receiptId: completed.completed[0].id,
    registryRevision: f.registry.revision,
    ledgerRevision: storyInfrastructureWorkEnsure(f.root).revision,
    fundedCashSettled: balances.settled
}));
