'use strict';

const assert = require('assert');
const infrastructure = require('../js/StoryInfrastructureWorks.js');

function fixture() {
    const root = {};
    const options = {
        root,
        nodes: [{ id: 0, owner: 0 }, { id: 1, owner: 1 }, { id: 2, owner: 0 }],
        world: { cellCount: 3 },
        geography: { regionIds: Int16Array.from([0, 1, 2]),
            landCoverageBps: Uint16Array.from([10000, 10000, 10000]),
            mountainIntensityBps: Uint16Array.from([0, 0, 0]) },
        settlements: { coreCellIndices: Int32Array.from([0, 1, 2]) },
        natural: { coverCodes: Uint8Array.from([0, 0, 0]) },
        graph: { corridors: [] },
        findLandPath: () => [0, 1, 2],
        negotiationCase: id => ({ id,
            partyActorIds: ['actor:country:0:executive', 'actor:country:1:executive'] })
    };
    return { root, options };
}

function spec() {
    return { mode: 'RAIL', fromRegionId: 'region:0', toRegionId: 'region:2',
        rightOfWay: { evidenceByRegion: { 'region:0': 'domestic:0', 'region:2': 'domestic:2' } },
        permission: { approved: true, institutionId: 'institution:country:0:executive',
            decisionId: 'decision:1', authorityActorId: 'actor:country:0:executive' } };
}

const applicant = { actorId: 'actor:country:0:executive', countryId: 'country:0', role: 'EXECUTIVE' };
const foreignExecutive = { actorId: 'actor:country:1:executive', countryId: 'country:1', role: 'EXECUTIVE' };

function open(fx, compensationCash) {
    const result = infrastructure.storyInfrastructureRightOfWayRequest({
        applicantActor: applicant, spec: spec(), targetRegionId: 'region:1', compensationCash,
        sourceEvidence: { kind: 'NEGOTIATION_CASE', id: `case:${compensationCash}`,
            routeKey: 'RAIL|region:0|region:2|region:1', targetRegionId: 'region:1' }
    }, fx.options);
    assert.equal(result.ok, true);
    return result.request;
}

const friendly = fixture();
const friendlyRequest = open(friendly, 40);
assert.equal(infrastructure.storyInfrastructureRightOfWayAiTick(Object.assign({}, friendly.options, {
    clock: 7, reviewDelaySeconds: 8, playerCountryId: 'country:0',
    executiveForCountry: () => foreignExecutive,
    aiSignals: () => ({ diplomaticRelation: 80, treaty: 'peace', trustBps: 8500,
        hostilityBps: 500, marketConfidence: 25 })
})).reviewed, 0, 'review delay must prevent an instant decision');
const friendlyTick = infrastructure.storyInfrastructureRightOfWayAiTick(Object.assign({}, friendly.options, {
    clock: 8, reviewDelaySeconds: 8, playerCountryId: 'country:0',
    executiveForCountry: () => foreignExecutive,
    aiSignals: () => ({ diplomaticRelation: 80, treaty: 'peace', trustBps: 8500,
        hostilityBps: 500, marketConfidence: 25 })
}));
assert.equal(friendlyTick.reviewed, 1);
assert.equal(friendlyTick.decisions[0].status, 'GRANTED');
assert(friendlyTick.decisions[0].foreignDecision.policy.score > 0);

const hostile = fixture();
open(hostile, 200);
const hostileTick = infrastructure.storyInfrastructureRightOfWayAiTick(Object.assign({}, hostile.options, {
    clock: 8, reviewDelaySeconds: 8, playerCountryId: 'country:0',
    executiveForCountry: () => foreignExecutive,
    aiSignals: () => ({ diplomaticRelation: -80, treaty: 'war', trustBps: 1000,
        hostilityBps: 9000, marketConfidence: 10 })
}));
assert.equal(hostileTick.reviewed, 1);
assert.equal(hostileTick.decisions[0].status, 'REJECTED',
    'a large offer must not override active-war security risk');

const negotiable = fixture();
const negotiableRequest = open(negotiable, 0);
const negotiableTick = infrastructure.storyInfrastructureRightOfWayAiTick(Object.assign({}, negotiable.options, {
    clock: 8, reviewDelaySeconds: 8, playerCountryId: 'country:0',
    executiveForCountry: () => foreignExecutive,
    aiSignals: () => ({ diplomaticRelation: 0, treaty: 'peace', trustBps: 5000,
        hostilityBps: 5000, marketConfidence: 50 })
}));
assert.equal(negotiableTick.reviewed, 1);
assert.equal(negotiableTick.decisions[0].status, 'COUNTERED');
assert(negotiableTick.decisions[0].counterOffer.compensationCash > 0);
assert.equal(infrastructure.storyInfrastructureRightOfWayCounterRespond(
    negotiableRequest.id, 'ACCEPT', Object.assign({}, negotiable.options, {
        actor: foreignExecutive, clock: 9
    })).code, 'RIGHT_OF_WAY_APPLICANT_AUTHORITY_REQUIRED');
const counterAccepted = infrastructure.storyInfrastructureRightOfWayCounterRespond(
    negotiableRequest.id, 'ACCEPT', Object.assign({}, negotiable.options, {
        actor: applicant, clock: 9
    }));
assert.equal(counterAccepted.ok, true);
assert.equal(counterAccepted.request.status, 'GRANTED');
assert.equal(counterAccepted.request.counterOffer.status, 'ACCEPTED');
assert.equal(counterAccepted.request.foreignDecision.compensationCash,
    counterAccepted.request.counterOffer.compensationCash);

const playerTarget = fixture();
open(playerTarget, 40);
const skipped = infrastructure.storyInfrastructureRightOfWayAiTick(Object.assign({}, playerTarget.options, {
    clock: 100, playerCountryId: 'country:1', executiveForCountry: () => foreignExecutive,
    aiSignals: () => ({ diplomaticRelation: 100, treaty: 'peace', trustBps: 10000,
        hostilityBps: 0, marketConfidence: 10 })
}));
assert.equal(skipped.reviewed, 0);
assert.equal(playerTarget.root.infrastructureWorks.rightOfWayRequests[0].status,
    'PENDING_FOREIGN_EXECUTIVE', 'AI must not decide for the player government');

const freePass = fixture();
const freeRequest = open(freePass, 45);
const freeDecision = infrastructure.storyInfrastructureRightOfWayDecide(freeRequest.id,
    { action: 'APPROVE', compensationCash: 0 }, Object.assign({}, freePass.options, {
        actor: foreignExecutive
    }));
assert.equal(freeDecision.ok, true);
assert.equal(freeDecision.request.foreignDecision.compensationCash, 0,
    'an explicit zero-price grant must not fall back to the offer');

const expiring = fixture();
const expiringRequest = open(expiring, 20);
const expiringDecision = infrastructure.storyInfrastructureRightOfWayDecide(
    expiringRequest.id, { action: 'APPROVE', validForSeconds: 2 },
    Object.assign({}, expiring.options, { actor: foreignExecutive, clock: 10 }));
assert.equal(expiringDecision.request.foreignDecision.validUntil, 12);
assert(infrastructure.storyInfrastructureRightOfWayGrant(
    spec(), 'region:1', 'country:0', Object.assign({}, expiring.options, { clock: 11 })));
assert.equal(infrastructure.storyInfrastructureRightOfWayGrant(
    spec(), 'region:1', 'country:0', Object.assign({}, expiring.options, { clock: 12 })), null);
assert.equal(expiring.root.infrastructureWorks.rightOfWayRequests[0].status, 'REVOKED');
assert.equal(expiring.root.infrastructureWorks.rightOfWayRequests[0].revocation.reason, 'EXPIRED');

const revoked = fixture();
const revokedRequest = open(revoked, 20);
infrastructure.storyInfrastructureRightOfWayDecide(revokedRequest.id,
    { action: 'APPROVE', validForSeconds: 0 }, Object.assign({}, revoked.options, {
        actor: foreignExecutive, clock: 10
    }));
assert.equal(infrastructure.storyInfrastructureRightOfWayRevoke(revokedRequest.id,
    'SECURITY_REVIEW', Object.assign({}, revoked.options, { actor: applicant, clock: 11 })).code,
    'FOREIGN_EXECUTIVE_AUTHORITY_REQUIRED');
const revokeResult = infrastructure.storyInfrastructureRightOfWayRevoke(revokedRequest.id,
    'SECURITY_REVIEW', Object.assign({}, revoked.options, { actor: foreignExecutive, clock: 11 }));
assert.equal(revokeResult.ok, true);
assert.equal(revokeResult.request.status, 'REVOKED');
assert.equal(revokeResult.request.revocation.reason, 'SECURITY_REVIEW');

console.log('story-infrastructure-right-of-way-ai: OK', JSON.stringify({
    friendly: friendlyTick.decisions[0].foreignDecision.policy.score,
    hostile: hostileTick.decisions[0].foreignDecision.policy.score,
    counterOffer: counterAccepted.request.counterOffer.compensationCash,
    playerDecisionSkipped: true,
    freePass: true,
    expiryAndRevocation: true
}));
