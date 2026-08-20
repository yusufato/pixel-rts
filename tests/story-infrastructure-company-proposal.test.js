'use strict';

const assert = require('assert');
const infrastructure = require('../js/StoryInfrastructureWorks.js');

function fixture() {
    const root = {};
    const company = { id: 'company:0:civil_industry', countryId: 'country:0',
        status: 'OPERATING', licenseStatus: 'LICENSED',
        accounts: { 'ASSET:CASH': 100, 'ASSET:PROJECT_ESCROW': 0 } };
    const balances = { cash: 100, escrow: 0, settled: 0 };
    const stocks = { raw_materials: 100, industrial_parts: 100 };
    const economy = {
        cashAvailable: () => balances.cash,
        cashReserve: (_type, _id, amount) => {
            balances.cash -= amount; balances.escrow += amount;
            company.accounts['ASSET:CASH'] = balances.cash;
            company.accounts['ASSET:PROJECT_ESCROW'] = balances.escrow;
            return { ok: true };
        },
        cashRollback: (_type, _id, amount) => {
            balances.cash += amount; balances.escrow -= amount;
            company.accounts['ASSET:CASH'] = balances.cash;
            company.accounts['ASSET:PROJECT_ESCROW'] = balances.escrow;
            return { ok: true };
        },
        cashSettle: (_type, _id, amount) => {
            balances.escrow -= amount; balances.settled += amount;
            company.accounts['ASSET:PROJECT_ESCROW'] = balances.escrow;
            return { ok: true };
        },
        stock: (_regionId, resourceId) => stocks[resourceId] || 0,
        stockDelta: (_regionId, resourceId, amount) => {
            stocks[resourceId] = (stocks[resourceId] || 0) + amount;
            return { ok: true };
        },
        availableWorkers: () => 100
    };
    const options = {
        root, company: id => id === company.id ? company : null, economy,
        world: { cellCount: 3 },
        geography: {
            regionIds: Int16Array.from([0, 0, 1]),
            landCoverageBps: Uint16Array.from([10000, 10000, 10000]),
            mountainIntensityBps: Uint16Array.from([0, 0, 0])
        },
        settlements: { coreCellIndices: Int32Array.from([0, 2]) },
        natural: { coverCodes: Uint8Array.from([0, 0, 0]) },
        graph: { corridors: [] },
        findLandPath: () => [0, 1, 2]
    };
    return { root, company, balances, stocks, options };
}

function spec(company) {
    return {
        mode: 'LAND', fromRegionId: 'region:0', toRegionId: 'region:1',
        ownerType: 'COMPANY', ownerId: company.id, fundingRegionId: 'region:0',
        rightOfWay: { evidenceByRegion: {
            'region:0': 'domestic:0', 'region:1': 'domestic:1'
        } },
        environmentalAssessment: {},
        permission: { approved: false, institutionId: '',
            decisionId: '', authorityActorId: '' }
    };
}

const applicant = { actorId: 'actor:company', countryId: 'country:0',
    role: 'COMPANY_EXECUTIVE', organizationId: 'company:0:civil_industry' };
const executive = { actorId: 'actor:executive', countryId: 'country:0', role: 'EXECUTIVE' };

const approvedCase = fixture();
const proposed = infrastructure.storyInfrastructureRouteSubmitCompanyProposal(
    spec(approvedCase.company), Object.assign({}, approvedCase.options, { applicant }));
assert.equal(proposed.ok, true);
assert.equal(proposed.proposal.status, 'PENDING_EXECUTIVE');
assert.deepStrictEqual(approvedCase.balances, { cash: 68, escrow: 32, settled: 0 });
assert.deepStrictEqual(approvedCase.stocks, { raw_materials: 100, industrial_parts: 100 },
    'proposal must not consume public materials before executive approval');
assert.equal(approvedCase.root.infrastructureWorks.routeCommands.length, 0);

const unauthorized = infrastructure.storyInfrastructureRouteDecideCompanyProposal(
    proposed.proposal.id, 'APPROVE', Object.assign({}, approvedCase.options, {
        actor: applicant
    }));
assert.equal(unauthorized.code, 'EXECUTIVE_PROPOSAL_AUTHORITY_REQUIRED');

const approved = infrastructure.storyInfrastructureRouteDecideCompanyProposal(
    proposed.proposal.id, 'APPROVE', Object.assign({}, approvedCase.options, {
        actor: executive
    }));
assert.equal(approved.ok, true);
assert.equal(approved.proposal.status, 'COMMAND_CREATED');
assert.equal(approved.command.status, 'IN_PROGRESS');
assert.deepStrictEqual(approvedCase.balances, { cash: 68, escrow: 32, settled: 0 },
    'approval must bind the existing escrow instead of charging cash twice');
assert.deepStrictEqual(approvedCase.stocks, { raw_materials: 94, industrial_parts: 96 });
assert.equal(approvedCase.root.infrastructureWorks.routeCommands.length, 1);

const saved = infrastructure.storyInfrastructureWorkForSave(approvedCase.root);
const restoredRoot = {};
assert.equal(infrastructure.storyInfrastructureWorkRestore(saved, restoredRoot).ok, true);
assert.equal(restoredRoot.infrastructureWorks.routeProposals[0].status, 'COMMAND_CREATED');
assert.equal(restoredRoot.infrastructureWorks.routeProposals[0].commandId, approved.command.id);

infrastructure.storyInfrastructureWorkTick(8, approvedCase.options);
assert.deepStrictEqual(approvedCase.balances, { cash: 68, escrow: 0, settled: 32 });
assert.equal(approvedCase.root.infrastructureWorks.routeCommands[0].status, 'COMPLETED');

const rejectedCase = fixture();
const rejectedProposal = infrastructure.storyInfrastructureRouteSubmitCompanyProposal(
    spec(rejectedCase.company), Object.assign({}, rejectedCase.options, { applicant }));
const rejected = infrastructure.storyInfrastructureRouteDecideCompanyProposal(
    rejectedProposal.proposal.id, 'REJECT', Object.assign({}, rejectedCase.options, {
        actor: executive
    }));
assert.equal(rejected.ok, true);
assert.equal(rejected.proposal.status, 'REJECTED');
assert.deepStrictEqual(rejectedCase.balances, { cash: 100, escrow: 0, settled: 0 });
assert.equal(infrastructure.storyInfrastructureRouteDecideCompanyProposal(
    rejectedProposal.proposal.id, 'REJECT', Object.assign({}, rejectedCase.options, {
        actor: executive
    })).code, 'COMPANY_ROUTE_PROPOSAL_NOT_DECIDABLE');
assert.deepStrictEqual(rejectedCase.balances, { cash: 100, escrow: 0, settled: 0 },
    'repeated rejection must not release escrow twice');

const blockedCase = fixture();
const blockedProposal = infrastructure.storyInfrastructureRouteSubmitCompanyProposal(
    spec(blockedCase.company), Object.assign({}, blockedCase.options, { applicant }));
blockedCase.stocks.raw_materials = 0;
const blocked = infrastructure.storyInfrastructureRouteDecideCompanyProposal(
    blockedProposal.proposal.id, 'APPROVE', Object.assign({}, blockedCase.options, {
        actor: executive
    }));
assert.equal(blocked.ok, false);
assert.equal(blocked.proposal.status, 'RESOURCE_BLOCKED');
assert.deepStrictEqual(blockedCase.balances, { cash: 68, escrow: 32, settled: 0 });
blockedCase.stocks.raw_materials = 100;
const retried = infrastructure.storyInfrastructureRouteDecideCompanyProposal(
    blockedProposal.proposal.id, 'APPROVE', Object.assign({}, blockedCase.options, {
        actor: executive
    }));
assert.equal(retried.ok, true);
assert.equal(retried.proposal.status, 'COMMAND_CREATED');
assert.deepStrictEqual(blockedCase.balances, { cash: 68, escrow: 32, settled: 0 });

const forgedCase = fixture();
const forgedSpec = spec(forgedCase.company);
forgedSpec.permission = { approved: true, institutionId: 'institution:executive',
    decisionId: 'forged', authorityActorId: executive.actorId };
const forged = infrastructure.storyInfrastructureRouteReserveAndSubmit(
    forgedSpec, Object.assign({}, forgedCase.options, {
        preReservedCash: { reservationId: 'fake', proposalId: 'fake',
            ownerId: forgedCase.company.id, cash: 32 }
    }));
assert.equal(forged.code, 'ROUTE_PREPAID_ESCROW_INVALID');
assert.deepStrictEqual(forgedCase.balances, { cash: 100, escrow: 0, settled: 0 });

console.log('story-infrastructure-company-proposal: OK', JSON.stringify({
    escrow: proposed.proposal.escrowReservation.cash,
    command: approved.command.id,
    restoredProposal: restoredRoot.infrastructureWorks.routeProposals.length
}));
