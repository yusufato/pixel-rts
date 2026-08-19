'use strict';

const assert = require('assert');
const construction = require('../js/StoryHexConstruction.js');

const world = { cellCount: 5, qValues: Int16Array.from([0, 1, 2, 3, 4]),
    rValues: Int16Array.from([0, 0, 0, 0, 0]) };
const geography = { regionIds: Int16Array.from([0, 0, 0, 0, 1]),
    landCoverageBps: Uint16Array.from([10000, 10000, 10000, 10000, 10000]),
    terrainClass: Uint8Array.from([1, 1, 1, 3, 1]) };
const natural = { coverCodes: Uint8Array.from([2, 2, 3, 4, 2]), deposits: [] };
const sites = { landUseByCellId: { 'hex:0:0': { activeUse: 'CIVIC' } } };
const root = {};
const requests = {};
let requestSequence = 0;
const authority = {
    submit: spec => {
        const request = { id: `institution-request:${++requestSequence}`,
            countryId: spec.countryId, actionType: 'ISSUE_LOCAL_ORDER',
            targetRegionId: spec.regionId, status: 'PENDING_APPROVAL',
            proposer: { actorId: 'actor:mayor', sourceId: 'institution:local' } };
        requests[request.id] = request;
        return { ok: true, request: JSON.parse(JSON.stringify(request)) };
    },
    get: id => requests[id] && JSON.parse(JSON.stringify(requests[id]))
};
const company = { id: 'company:1', status: 'OPERATING', licenseStatus: 'LICENSED',
    accounts: { 'ASSET:CASH': 500, 'ASSET:PROJECT_ESCROW': 0 } };
const region = { stocks: { raw_materials: 100, industrial_parts: 100, electronics: 20 } };
const economy = {
    company: () => company, region: () => region, availableWorkers: () => 500,
    postCash: (row, postings) => { for (const post of postings) row.accounts[post.account]
        = (Number(row.accounts[post.account]) || 0) + post.amount; return { ok: true }; },
    stockDelta: (_regionId, resourceId, amount) => { region.stocks[resourceId] += amount; return { ok: true }; }
};
const options = { root, world, geography, natural, sites, authority, economy, clock: 10 };

const previewRoot = {};
construction.storyHexConstructionCandidates('region:0', 'RESIDENTIAL',
    Object.assign({}, options, { root: previewRoot }));
assert.strictEqual(previewRoot.hexConstruction, undefined, 'aday önizlemesi dünyayı değiştirmemeli');
assert.deepStrictEqual(construction.storyHexConstructionRegionView('region:0', previewRoot), {
    regionId: 'region:0', applications: [], commands: [], receipts: []
});
assert.strictEqual(previewRoot.hexConstruction, undefined, 'salt-okunur bölge görünümü defter oluşturmamalı');

const candidates = construction.storyHexConstructionCandidates('region:0', 'RESIDENTIAL', options);
assert.deepStrictEqual(candidates.map(row => row.targetCellId), ['hex:1:0', 'hex:2:0']);
assert.strictEqual(candidates[1].requiresEnvironmentalAssessment, true);

const spec = { origin: 'PLAYER', projectType: 'RESIDENTIAL', regionId: 'region:0',
    countryId: 'country:0', targetCellId: 'hex:1:0', applicantActorId: 'actor:player',
    companyId: 'company:1', landAcquisition: { mode: 'PURCHASE', evidenceId: 'deed:1', cost: 10 } };
const submitted = construction.storyHexConstructionSubmitApplication(spec, options);
assert.strictEqual(submitted.ok, true);
assert.strictEqual(submitted.application.status, 'PENDING_AUTHORITY');
assert.strictEqual(root.hexConstruction.commands.length, 0, 'kurum kararı öncesi kaynak/inşaat emri oluşmamalı');
assert.strictEqual(company.accounts['ASSET:CASH'], 500);

requests[submitted.application.authorityRequestId].status = 'EXECUTED';
const synced = construction.storyHexConstructionSyncApplication(submitted.application.id,
    Object.assign({}, options, { clock: 20 }));
assert.strictEqual(synced.ok, true);
assert.strictEqual(synced.application.status, 'COMMAND_CREATED');
assert.strictEqual(synced.command.status, 'BUILDING');
assert.strictEqual(company.accounts['ASSET:CASH'], 400);
assert.strictEqual(construction.storyHexConstructionRegionView('region:0', root).applications.length, 1);

const rejected = construction.storyHexConstructionSubmitApplication(Object.assign({}, spec, {
    origin: 'ECONOMIC_AI', targetCellId: 'hex:2:0', environmentalAssessmentId: 'assessment:1',
    environmentalMitigation: { id: 'mitigation:1' }
}), Object.assign({}, options, { clock: 30 }));
assert.strictEqual(rejected.ok, true);
requests[rejected.application.authorityRequestId].status = 'DENIED';
requests[rejected.application.authorityRequestId].result = { reasonCode: 'ZONING_CONFLICT' };
const rejectedSync = construction.storyHexConstructionSyncApplication(rejected.application.id, options);
assert.strictEqual(rejectedSync.application.status, 'REJECTED');
assert.strictEqual(rejectedSync.application.rejectionReason, 'ZONING_CONFLICT');
assert.strictEqual(root.hexConstruction.commands.length, 1, 'reddedilen başvuru fiziksel emir üretmemeli');

global.STORY = {
    playerStateId: 0, playerRole: 'COMPANY_OWNER', clock: 40,
    commander: { id: 7, creationRole: 'COMPANY_OWNER', organizationId: 'company:0:civil_industry' },
    nodes: [{ id: 0, owner: 0 }]
};
let aiCompany = null;
global.storyCharacterIdentityView = actorId => String(actorId).startsWith('character:company-executive:')
    ? { id: actorId, role: 'COMPANY_EXECUTIVE', organizationId: aiCompany && aiCompany.id }
    : { id: 'character:0:7', role: 'COMPANY_OWNER', organizationId: 'company:0:civil_industry' };
const playerCompany = Object.assign({}, company, {
    id: 'company:0:civil_industry', name: 'Oyuncu Sanayi', countryId: 'country:0',
    sectorId: 'civil_industry'
});
global.storyCompanyById = id => String(id) === playerCompany.id ? playerCompany
    : (aiCompany && String(id) === aiCompany.id ? aiCompany : null);
global.storyHexWorldEnsure = () => world;
global.storyHexGeographyEnsure = () => geography;
global.storyHexNaturalResourcesEnsure = () => natural;
global.storyHexSitesEnsure = () => sites;
global.storyInstitutionRegionView = () => ({
    countryId: 'country:0', institution: {
        id: 'institution:local', officeHolder: { actorId: 'actor:mayor' }
    }
});
global.storyInstitutionSubmitAction = input => {
    const request = {
        id: `institution-request:player:${requestSequence++}`,
        countryId: input.countryId, targetRegionId: input.targetRegionId,
        actionType: input.actionType, status: 'PENDING_APPROVAL'
    };
    return { ok: true, request };
};
const playerView = construction.storyHexConstructionPlayerView('region:0');
assert.strictEqual(playerView.allowed, true);
const begun = construction.storyHexConstructionPlayerBegin('region:0', 'RESIDENTIAL');
assert.strictEqual(begun.ok, true);
assert.strictEqual(global.STORY._hexConstructionPickMode, true);
const playerTarget = begun.draft.candidateCellIds[0];
assert.strictEqual(construction.storyHexConstructionPlayerPickCell(playerTarget).ok, true);
const playerApplication = construction.storyHexConstructionPlayerSubmitDraft();
assert.strictEqual(playerApplication.ok, true);
assert.strictEqual(playerApplication.application.origin, 'PLAYER');
assert.strictEqual(playerApplication.application.companyId, playerCompany.id);
assert.strictEqual(global.STORY._hexConstructionDraft, null);

global.STORY.hexConstruction = undefined;
global.STORY.nodes[0].owner = 1;
global.STORY.nodes[0].pop = 132;
aiCompany = {
    id: 'company:1:civil_industry', name: 'AI Sanayi', countryId: 'country:1',
    sectorId: 'civil_industry', status: 'OPERATING', licenseStatus: 'LICENSED',
    facilityIds: ['facility:0:civil_industry'],
    accounts: { 'ASSET:CASH': 500, 'ASSET:PROJECT_ESCROW': 0 }
};
global.STORY.companyEconomy = {
    companies: { [aiCompany.id]: aiCompany },
    facilities: { 'facility:0:civil_industry': {
        id: 'facility:0:civil_industry', regionId: 'region:0', ownerCompanyId: aiCompany.id
    } }
};
global.storyRegionalRegionView = () => ({ shortages: [] });
const aiSignal = construction.storyHexConstructionEconomicAIProject(aiCompany, 'region:0');
assert.strictEqual(aiSignal.projectType, 'RESIDENTIAL');
assert.strictEqual(aiSignal.reason, 'HOUSING_CAP_PRESSURE');
const aiTick = construction.storyHexConstructionEconomicAITick(30, {
    root: global.STORY, world, geography, natural, sites, authority
});
assert.strictEqual(aiTick.applications, 1);
assert.strictEqual(global.STORY.hexConstruction.applications[0].origin, 'ECONOMIC_AI');
assert.strictEqual(global.STORY.hexConstruction.commands.length, 0,
    'ekonomik AI da kurum kararı öncesi fiziksel emir üretmemeli');
const aiEconomy = {
    company: () => aiCompany, region: () => region, availableWorkers: () => 500,
    postCash: (row, postings) => { for (const post of postings) row.accounts[post.account]
        = (Number(row.accounts[post.account]) || 0) + post.amount; return { ok: true }; },
    stockDelta: (_regionId, resourceId, amount) => { region.stocks[resourceId] += amount; return { ok: true }; }
};
const reviewingAuthority = Object.assign({}, authority, {
    progress: requestId => {
        requests[requestId].status = 'EXECUTED';
        requests[requestId].executedByActorId = 'actor:mayor';
        requests[requestId].executorInstitutionId = 'institution:local';
        return { ok: true, request: requests[requestId] };
    }
});
global.STORY.clock = 60;
const reviewed = construction.storyHexConstructionSyncApplications({
    root: global.STORY, world, geography, natural, sites,
    authority: reviewingAuthority, economy: aiEconomy, clock: 60
});
assert.strictEqual(reviewed.length, 1);
assert.strictEqual(global.STORY.hexConstruction.applications[0].status, 'COMMAND_CREATED');
assert.strictEqual(global.STORY.hexConstruction.commands[0].status, 'BUILDING');
assert.strictEqual(aiCompany.accounts['ASSET:CASH'], 400,
    'kurum uygulamasından sonra gerçek şirket kaynağı bloke edilmeli');

delete global.storyCharacterIdentityView;
delete global.storyCompanyById;
delete global.storyHexWorldEnsure;
delete global.storyHexGeographyEnsure;
delete global.storyHexNaturalResourcesEnsure;
delete global.storyHexSitesEnsure;
delete global.storyInstitutionRegionView;
delete global.storyInstitutionSubmitAction;
delete global.storyRegionalRegionView;
delete global.STORY;

console.log('story-hex-construction-application: OK', JSON.stringify({
    candidates: candidates.length, applications: root.hexConstruction.applications.length,
    commands: root.hexConstruction.commands.length
}));
