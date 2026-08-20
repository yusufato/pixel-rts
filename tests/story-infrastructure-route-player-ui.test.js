'use strict';

const assert = require('node:assert');
const { createRuntime } = require('../tools/story-sim-harness');

const runtime = createRuntime(2032);
try {
    runtime.api.newCampaign({ seed: 2032, playerStateId: 0, abundance: 1,
        doctrine: 'combined', fog: true });
    const story = runtime.api.state();
    const ankara = story.nodes.find(node => node.name === 'Ankara');
    const izmir = story.nodes.find(node => node.name === 'İzmir');
    assert(ankara && izmir);
    const locked = runtime.api.infrastructureRoutePlayerView(`region:${ankara.id}`);
    assert.equal(locked.allowed, false);
    assert.equal(locked.lockedReason, 'EXECUTIVE_ROLE_REQUIRED');
    story.commander.creationRole = 'EXECUTIVE';
    story.playerRole = 'EXECUTIVE';
    const open = runtime.api.infrastructureRoutePlayerView(`region:${ankara.id}`);
    assert.equal(open.allowed, true);
    assert(open.destinations.some(row => row.regionId === `region:${izmir.id}`));
    const before = runtime.dom.window.document.createElement('div');
    before.innerHTML = runtime.api.infrastructureRouteProjectHtml(ankara.id);
    assert.equal(before.querySelectorAll('.infrastructure-route-mode').length, 3);
    assert.equal(before.querySelectorAll('.infrastructure-route-select').length, 0,
        'destination buttons must stay hidden until a mode is selected');
    assert.equal(runtime.api.infrastructureRoutePlayerChooseMode(`region:${ankara.id}`, 'RAIL').ok, true);
    assert.equal(runtime.api.infrastructureRoutePlayerView(`region:${ankara.id}`).selectedMode, 'RAIL');
    const afterMode = runtime.dom.window.document.createElement('div');
    afterMode.innerHTML = runtime.api.infrastructureRouteProjectHtml(ankara.id);
    assert.equal(afterMode.querySelectorAll('.infrastructure-route-mode').length, 3);
    assert.equal(afterMode.querySelectorAll('.infrastructure-route-select').length,
        open.destinations.length, 'all legal targets must remain searchable');
    assert.equal(afterMode.querySelectorAll('.infrastructure-route-select:not([hidden])').length,
        Math.min(12, open.destinations.length));
    assert.equal(afterMode.querySelector('.infrastructure-route-target-filter').value, '');
    assert.equal(runtime.api.infrastructureRoutePlayerSetTargetFilter(
        `region:${ankara.id}`, 'İzmir').ok, true);
    const filtered = runtime.dom.window.document.createElement('div');
    filtered.innerHTML = runtime.api.infrastructureRouteProjectHtml(ankara.id);
    assert.equal(filtered.querySelector('.infrastructure-route-target-filter').value, 'İzmir');
    const visibleFiltered = [...filtered.querySelectorAll(
        '.infrastructure-route-select:not([hidden])')];
    assert(visibleFiltered.some(button => button.dataset.to === `region:${izmir.id}`));
    const selected = runtime.api.infrastructureRoutePlayerSelect(
        `region:${ankara.id}`, `region:${izmir.id}`, 'RAIL');
    assert.equal(selected.ok, true);
    assert.equal(selected.draft.requirements.edgeCount, 10);
    assert.equal(selected.draft.candidate.blockReasons.length, 0);
    assert(selected.draft.resourceBlocks.some(row => row.code === 'ROUTE_MATERIAL_UNAVAILABLE'
        && row.resourceId === 'raw_materials'),
    'real regional stock shortage must be visible before the submit click');
    assert.equal(runtime.api.infrastructureRoutePlayerView(`region:${ankara.id}`).draft.mode, 'RAIL');
    const draftHtml = runtime.dom.window.document.createElement('div');
    draftHtml.innerHTML = runtime.api.infrastructureRouteProjectHtml(ankara.id);
    assert(draftHtml.textContent.includes('KAYNAK EKSİĞİ'));
    assert.equal(draftHtml.querySelector('.infrastructure-route-submit').disabled, true);
    assert.equal(runtime.api.infrastructureRoutePlayerCancelDraft().ok, true);
    assert.equal(runtime.api.infrastructureRoutePlayerView(`region:${ankara.id}`).draft, null);

    const company = Object.values(story.companyEconomy.companies)
        .find(row => row.countryId === 'country:0' && row.status === 'OPERATING');
    assert(company);
    const originalCompanyCash = company.accounts['ASSET:CASH'];
    company.accounts['ASSET:CASH'] = 2000;
    story.companyEconomy.externalMoneyInflow += 2000 - originalCompanyCash;
    story.commander.creationRole = 'COMPANY_OWNER';
    story.commander.organizationId = company.id;
    story.playerRole = 'COMPANY_OWNER';
    const companyView = runtime.api.infrastructureRoutePlayerView(`region:${ankara.id}`);
    assert.equal(companyView.allowed, true);
    assert.equal(companyView.submissionKind, 'COMPANY_PROPOSAL');
    let companyTarget = null;
    for (const destination of companyView.destinations) {
        const candidate = runtime.api.infrastructureRoutePlayerSelect(
            `region:${ankara.id}`, destination.regionId, 'LAND');
        if (candidate.ok && candidate.draft.candidate.blockReasons.length === 0) {
            companyTarget = destination;
            break;
        }
    }
    assert(companyTarget, 'company needs at least one unbuilt domestic LAND proposal target');
    const companyDraftHtml = runtime.dom.window.document.createElement('div');
    companyDraftHtml.innerHTML = runtime.api.infrastructureRouteProjectHtml(ankara.id);
    assert.equal(companyDraftHtml.querySelector('.infrastructure-route-submit').disabled, false,
        'company may escrow a proposal before public materials become available: '
            + JSON.stringify(runtime.api.infrastructureRoutePlayerView(`region:${ankara.id}`).draft));
    const cashBeforeProposal = company.accounts['ASSET:CASH'];
    const escrowBeforeProposal = company.accounts['ASSET:PROJECT_ESCROW'];
    const companySubmission = runtime.api.infrastructureRoutePlayerSubmitDraft();
    assert.equal(companySubmission.ok, true);
    assert.equal(companySubmission.proposal.status, 'PENDING_EXECUTIVE');
    assert(company.accounts['ASSET:CASH'] < cashBeforeProposal);
    assert(company.accounts['ASSET:PROJECT_ESCROW'] > escrowBeforeProposal);
    assert.equal(story.infrastructureWorks.routeCommands.length, 0);

    story.commander.creationRole = 'EXECUTIVE';
    story.commander.organizationId = '';
    story.playerRole = 'EXECUTIVE';
    const executiveHtml = runtime.dom.window.document.createElement('div');
    executiveHtml.innerHTML = runtime.api.infrastructureRouteProjectHtml(ankara.id);
    assert.equal(executiveHtml.querySelectorAll('.infrastructure-proposal-decision').length, 2);
    const regional = story.regionalEconomy.regions[`region:${ankara.id}`];
    regional.stocks.raw_materials = 1000;
    regional.stocks.industrial_parts = 1000;
    const cashAfterEscrow = company.accounts['ASSET:CASH'];
    const approvedProposal = runtime.api.infrastructureRoutePlayerDecideProposal(
        companySubmission.proposal.id, 'APPROVE');
    assert.equal(approvedProposal.ok, true);
    assert.equal(approvedProposal.proposal.status, 'COMMAND_CREATED');
    assert.equal(approvedProposal.command.status, 'IN_PROGRESS');
    assert.equal(company.accounts['ASSET:CASH'], cashAfterEscrow,
        'executive approval must not debit company cash a second time');
    runtime.api.infrastructureWorkTick(approvedProposal.command.remainingDays);
    assert.equal(story.infrastructureWorks.routeCommands
        .find(row => row.id === approvedProposal.command.id).status, 'COMPLETED');
    const companyValidation = runtime.api.validateCompanyLedger(runtime.api.companyLedger());
    assert.equal(companyValidation.ok, true,
        JSON.stringify(companyValidation.issues && companyValidation.issues.slice(0, 3)));
    console.log('STORY_INFRASTRUCTURE_ROUTE_PLAYER_UI_OK', JSON.stringify({
        destinations: open.destinations.length,
        edgeCount: selected.draft.requirements.edgeCount,
        resourceBlocks: selected.draft.resourceBlocks.map(row => row.code)
    }));
} finally {
    runtime.dom.window.close();
}
