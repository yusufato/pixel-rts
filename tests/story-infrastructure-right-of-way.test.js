'use strict';

const assert = require('assert');
const infrastructure = require('../js/StoryInfrastructureWorks.js');

function fixture() {
    const root = {};
    const nodes = [
        { id: 0, owner: 0, name: 'Başlangıç' },
        { id: 1, owner: 1, name: 'Yabancı Koridor' },
        { id: 2, owner: 0, name: 'Hedef' }
    ];
    const options = {
        root, nodes,
        world: { cellCount: 3 },
        geography: {
            regionIds: Int16Array.from([0, 1, 2]),
            landCoverageBps: Uint16Array.from([10000, 10000, 10000]),
            mountainIntensityBps: Uint16Array.from([0, 0, 0])
        },
        settlements: { coreCellIndices: Int32Array.from([0, 1, 2]) },
        natural: { coverCodes: Uint8Array.from([0, 0, 0]) },
        graph: { corridors: [] },
        findLandPath: () => [0, 1, 2],
        negotiationCase: id => id === 'negotiation-case:77' ? {
            id, partyActorIds: ['actor:country:0:executive', 'actor:country:1:executive']
        } : null,
        conversationSession: id => id === 'conversation:9' ? {
            id, playerActorId: 'actor:country:0:executive',
            listenerActorId: 'actor:country:1:executive'
        } : null,
        conversationSessions: () => [{ id: 'conversation:9', initialText: 'Demiryolu geçişini konuşalım',
            playerActorId: 'actor:country:0:executive', listenerActorId: 'actor:country:1:executive' },
        { id: 'conversation:foreign-secret', initialText: 'Oyuncunun taraf olmadığı kayıt',
            playerActorId: 'actor:country:2:executive', listenerActorId: 'actor:country:1:executive' }],
        negotiationCases: () => [{ id: 'negotiation-case:77', topic: 'TRANSIT_RIGHT_OF_WAY',
            partyActorIds: ['actor:country:0:executive', 'actor:country:1:executive'] },
        { id: 'negotiation-case:wrong-country', topic: 'UNRELATED',
            partyActorIds: ['actor:country:0:executive', 'actor:country:2:executive'] }]
    };
    return { root, nodes, options };
}

function routeSpec() {
    return {
        mode: 'LAND', fromRegionId: 'region:0', toRegionId: 'region:2',
        ownerType: 'STATE', ownerId: 'country:0', fundingRegionId: 'region:0',
        rightOfWay: { evidenceByRegion: {
            'region:0': 'domestic:0', 'region:2': 'domestic:2'
        }, compensationCash: 0 },
        environmentalAssessment: {},
        permission: { approved: true, institutionId: 'institution:country:0:executive',
            decisionId: 'domestic-route', authorityActorId: 'actor:country:0:executive' }
    };
}

const applicant = {
    actorId: 'actor:country:0:executive', countryId: 'country:0', role: 'EXECUTIVE'
};
const foreignExecutive = {
    actorId: 'actor:country:1:executive', countryId: 'country:1', role: 'EXECUTIVE'
};
const wrongExecutive = {
    actorId: 'actor:country:2:executive', countryId: 'country:2', role: 'EXECUTIVE'
};
const fx = fixture();
const spec = routeSpec();

const evidenceCandidates = infrastructure.storyInfrastructureRightOfWayEvidenceCandidates({
    applicantActor: applicant, spec, targetRegionId: 'region:1'
}, fx.options);
assert.equal(evidenceCandidates.length, 2);
assert.deepEqual(evidenceCandidates.map(row => row.kind).sort(),
    ['CONVERSATION', 'NEGOTIATION_CASE']);
assert(evidenceCandidates.every(row => row.sourceEvidence.routeKey
    === 'LAND|region:0|region:2|region:1'));
assert(!evidenceCandidates.some(row => row.id.includes('foreign-secret')
    || row.id.includes('wrong-country')), 'unrelated or foreign-only records must not leak');

const noEvidence = infrastructure.storyInfrastructureRightOfWayRequest({
    applicantActor: applicant, spec, targetRegionId: 'region:1', compensationCash: 45
}, fx.options);
assert.equal(noEvidence.code, 'RIGHT_OF_WAY_DIPLOMATIC_EVIDENCE_REQUIRED');

const unboundEvidence = infrastructure.storyInfrastructureRightOfWayRequest({
    applicantActor: applicant, spec, targetRegionId: 'region:1', compensationCash: 45,
    sourceEvidence: { kind: 'NEGOTIATION_CASE', id: 'negotiation-case:77' }
}, fx.options);
assert.equal(unboundEvidence.code, 'RIGHT_OF_WAY_EVIDENCE_ROUTE_BINDING_REQUIRED');

const missingCase = infrastructure.storyInfrastructureRightOfWayRequest({
    applicantActor: applicant, spec, targetRegionId: 'region:1', compensationCash: 45,
    sourceEvidence: { kind: 'NEGOTIATION_CASE', id: 'negotiation-case:missing',
        routeKey: 'LAND|region:0|region:2|region:1', targetRegionId: 'region:1' }
}, fx.options);
assert.equal(missingCase.code, 'RIGHT_OF_WAY_NEGOTIATION_CASE_NOT_FOUND');

const opened = infrastructure.storyInfrastructureRightOfWayRequest({
    applicantActor: applicant, spec, targetRegionId: 'region:1', compensationCash: 45,
    sourceEvidence: { kind: 'NEGOTIATION_CASE', id: 'negotiation-case:77',
        routeKey: 'LAND|region:0|region:2|region:1', targetRegionId: 'region:1' }
}, fx.options);
assert.equal(opened.ok, true);
assert.equal(opened.request.status, 'PENDING_FOREIGN_EXECUTIVE');
assert.equal(opened.request.targetCountryId, 'country:1');
assert.equal(opened.request.offeredCompensationCash, 45);
assert.equal(infrastructure.storyInfrastructureRightOfWayGrant(
    spec, 'region:1', 'country:0', fx.options), null);

const duplicate = infrastructure.storyInfrastructureRightOfWayRequest({
    applicantActor: applicant, spec, targetRegionId: 'region:1', compensationCash: 99,
    sourceEvidence: { kind: 'CONVERSATION', id: 'conversation:9',
        routeKey: 'LAND|region:0|region:2|region:1', targetRegionId: 'region:1' }
}, fx.options);
assert.equal(duplicate.ok, true);
assert.equal(duplicate.duplicate, true);
assert.equal(fx.root.infrastructureWorks.rightOfWayRequests.length, 1);

const unauthorized = infrastructure.storyInfrastructureRightOfWayDecide(
    opened.request.id, { action: 'APPROVE' }, Object.assign({}, fx.options, {
        actor: wrongExecutive
    }));
assert.equal(unauthorized.code, 'FOREIGN_EXECUTIVE_AUTHORITY_REQUIRED');

const approved = infrastructure.storyInfrastructureRightOfWayDecide(
    opened.request.id, {
        action: 'APPROVE', compensationCash: 60,
        sourceEvidenceId: 'foreign-cabinet-decision:4'
    }, Object.assign({}, fx.options, { actor: foreignExecutive }));
assert.equal(approved.ok, true);
assert.equal(approved.request.status, 'GRANTED');
assert.equal(approved.request.foreignDecision.compensationCash, 60);
assert.match(approved.request.grantEvidenceId, /^right-of-way-grant:/);
const grant = infrastructure.storyInfrastructureRightOfWayGrant(
    spec, 'region:1', 'country:0', fx.options);
assert(grant);
assert.equal(grant.id, opened.request.id);
assert.equal(infrastructure.storyInfrastructureRightOfWayDecide(
    opened.request.id, 'REJECT', Object.assign({}, fx.options, {
        actor: foreignExecutive
    })).code, 'RIGHT_OF_WAY_REQUEST_NOT_DECIDABLE');

spec.rightOfWay.evidenceByRegion['region:1'] = grant.grantEvidenceId;
spec.rightOfWay.grantsByRegion = {
    'region:1': { requestId: grant.id, targetCountryId: grant.targetCountryId,
        evidenceId: grant.grantEvidenceId,
        compensationCash: grant.foreignDecision.compensationCash }
};
spec.rightOfWay.compensationCash = grant.foreignDecision.compensationCash;
const balances = { cash: 10000, escrow: 0, settled: 0,
    stocks: { raw_materials: 10000, industrial_parts: 10000, electronics: 10000 } };
let settleCalls = 0;
let compensationCalls = 0;
let failCompensationOnce = true;
const economy = {
    cashAvailable: () => balances.cash,
    cashReserve: (_type, _id, amount) => {
        balances.cash -= amount; balances.escrow += amount; return { ok: true };
    },
    cashRollback: (_type, _id, amount) => {
        balances.cash += amount; balances.escrow -= amount; return { ok: true };
    },
    cashSettle: (_type, _id, amount, details) => {
        settleCalls++; balances.escrow -= amount; balances.settled += amount;
        assert.equal(details.compensationCash, 60);
        return { ok: true, transaction: { id: 'cash-settlement:1' } };
    },
    compensationSettle: (targetCountryId, amount) => {
        compensationCalls++;
        assert.equal(targetCountryId, 'country:1');
        assert.equal(amount, 60);
        if (failCompensationOnce) {
            failCompensationOnce = false;
            return { ok: false, code: 'TARGET_TREASURY_TEMPORARILY_UNAVAILABLE' };
        }
        return { ok: true, transaction: { id: 'budget:country:1:1' } };
    },
    stock: (_regionId, resourceId) => balances.stocks[resourceId] || 0,
    stockDelta: (_regionId, resourceId, amount) => {
        balances.stocks[resourceId] += amount; return { ok: true };
    },
    availableWorkers: () => 10000
};
const submitted = infrastructure.storyInfrastructureRouteReserveAndSubmit(
    spec, Object.assign({}, fx.options, { economy }));
assert.equal(submitted.ok, true);
assert.equal(submitted.command.financialSettlement.compensationRows.length, 1);
assert.equal(infrastructure.storyInfrastructureRouteStart(submitted.command.id,
    Object.assign({}, fx.options, { economy })).ok, true);
const blockedTick = infrastructure.storyInfrastructureWorkTick(
    submitted.command.requirements.durationDays, Object.assign({}, fx.options, { economy }));
assert.equal(blockedTick.completedRoutes.length, 0);
const liveCommand = fx.root.infrastructureWorks.routeCommands[0];
assert.equal(liveCommand.financialSettlement.cashSettled, true);
assert.equal(liveCommand.completionBlockedReason, 'TARGET_TREASURY_TEMPORARILY_UNAVAILABLE');
const completedTick = infrastructure.storyInfrastructureWorkTick(
    0.01, Object.assign({}, fx.options, { economy }));
assert.equal(completedTick.completedRoutes.length, 1);
assert.equal(settleCalls, 1, 'retry must not settle project escrow twice');
assert.equal(compensationCalls, 2);
assert.equal(liveCommand.financialSettlement.compensationRows[0].status, 'PAID');
infrastructure.storyInfrastructureWorkTick(0.01,
    Object.assign({}, fx.options, { economy }));
assert.equal(settleCalls, 1);
assert.equal(compensationCalls, 2, 'completed route must not pay compensation twice');

const saved = infrastructure.storyInfrastructureWorkForSave(fx.root);
const restored = {};
assert.equal(infrastructure.storyInfrastructureWorkRestore(saved, restored).ok, true);
assert.equal(restored.infrastructureWorks.rightOfWayRequests.length, 1);
assert.equal(restored.infrastructureWorks.rightOfWayRequests[0].grantEvidenceId,
    approved.request.grantEvidenceId);

console.log('story-infrastructure-right-of-way: OK', JSON.stringify({
    request: opened.request.id,
    targetCountry: opened.request.targetCountryId,
    compensation: approved.request.foreignDecision.compensationCash,
    settlementRetrySafe: true
}));
