'use strict';

const assert = require('node:assert');
const { createRuntime } = require('../tools/story-sim-harness');

const runtime = createRuntime(7433);
try {
    runtime.api.newCampaign({ seed: 7433, playerStateId: 0, abundance: 1,
        doctrine: 'combined', fog: true });
    const story = runtime.api.state();
    const companies = Object.values(story.companyEconomy.companies)
        .filter(company => company.status === 'OPERATING'
            && company.licenseStatus === 'LICENSED' && company.facilityIds.length);
    assert(companies.length, 'campaign must expose operating companies with physical facilities');
    for (const company of companies) {
        const before = Number(company.accounts['ASSET:CASH']) || 0;
        const target = Math.max(before, 5000);
        company.accounts['ASSET:CASH'] = target;
        story.companyEconomy.externalMoneyInflow += target - before;
    }
    const demandRegionalView = () => ({ shortages: [
        { resourceId: 'food', deficit: 25 },
        { resourceId: 'energy', deficit: 25 },
        { resourceId: 'raw_materials', deficit: 25 },
        { resourceId: 'industrial_parts', deficit: 25 },
        { resourceId: 'electronics', deficit: 25 },
        { resourceId: 'military_supplies', deficit: 25 }
    ] });

    let applied = null;
    for (const company of companies) {
        const cashBefore = Number(company.accounts['ASSET:CASH']) || 0;
        const escrowBefore = Number(company.accounts['ASSET:PROJECT_ESCROW']) || 0;
        const result = runtime.api.infrastructureRouteEconomicAiApply(company, {
            regionalView: demandRegionalView
        });
        if (!result.ok) continue;
        applied = { company, result, cashBefore, escrowBefore };
        break;
    }
    assert(applied, 'at least one real company must find a justified physical route');
    assert.equal(applied.result.proposal.origin, 'ECONOMIC_AI');
    assert.equal(applied.result.proposal.status, 'PENDING_EXECUTIVE');
    assert(Number(applied.company.accounts['ASSET:CASH']) < applied.cashBefore,
        'AI proposal must reserve real company cash');
    assert(Number(applied.company.accounts['ASSET:PROJECT_ESCROW']) > applied.escrowBefore,
        'AI proposal must move the same cash into project escrow');
    assert(applied.result.proposal.spec.aiDecisionEvidence
        && Number.isFinite(applied.result.proposal.spec.aiDecisionEvidence.score),
    'AI proposal must retain an explainable demand score');
    assert(applied.result.proposal.spec.aiDecisionEvidence.score >= 600,
        'unjustified network expansion must not spend company escrow');
    story.commander.creationRole = 'EXECUTIVE';
    story.playerRole = 'EXECUTIVE';
    const originNodeId = Number(applied.result.fromRegionId.split(':')[1]);
    const proposalHtml = runtime.api.infrastructureRouteProjectHtml(originNodeId);
    assert(proposalHtml.includes('AI ŞİRKET BAŞVURUSU'));
    assert(proposalHtml.includes('GEREKÇE:'));

    story.clock = Number(applied.result.proposal.submittedAt) + 20;
    const playerGuard = runtime.api.infrastructureRouteEconomicAiTick(0, {
        playerCountryId: applied.result.proposal.countryId
    });
    assert.equal(playerGuard.reviews, 0,
        'AI must not decide the player country executive proposal');
    assert.equal(story.infrastructureWorks.routeProposals
        .find(row => row.id === applied.result.proposal.id).status, 'PENDING_EXECUTIVE');

    const aiReview = runtime.api.infrastructureRouteEconomicAiTick(0, {
        playerCountryId: 'country:999'
    });
    assert.equal(aiReview.reviews, 1);
    const reviewed = story.infrastructureWorks.routeProposals
        .find(row => row.id === applied.result.proposal.id);
    assert(['COMMAND_CREATED', 'RESOURCE_BLOCKED'].includes(reviewed.status));
    assert(reviewed.executiveDecision && reviewed.executiveDecision.verdict === 'APPROVE');
    assert(story.infrastructureWorks.aiRouteDecisions.some(row =>
        row.kind === 'EXECUTIVE_REVIEW' && row.proposalId === reviewed.id));

    const saved = runtime.api.infrastructureWorkLedger();
    const restored = runtime.api.infrastructureWorkRestore(saved);
    assert.equal(restored.ok, true);
    assert.equal(runtime.api.state().infrastructureWorks.aiRouteDecisionSequence,
        saved.aiRouteDecisionSequence);
    assert.equal(runtime.api.state().infrastructureWorks.aiRouteDecisions.length,
        saved.aiRouteDecisions.length);

    console.log('story-infrastructure-route-economic-ai: OK', JSON.stringify({
        companyId: applied.company.id,
        proposalId: applied.result.proposal.id,
        mode: applied.result.mode,
        score: applied.result.policy.score,
        reviewStatus: reviewed.status,
        playerDecisionSkipped: playerGuard.reviews === 0,
        escrowReserved: true
    }));
} finally {
    runtime.dom.window.close();
}
