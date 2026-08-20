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
    assert.equal(afterMode.querySelectorAll('.infrastructure-route-select').length, 10);
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
    console.log('STORY_INFRASTRUCTURE_ROUTE_PLAYER_UI_OK', JSON.stringify({
        destinations: open.destinations.length,
        edgeCount: selected.draft.requirements.edgeCount,
        resourceBlocks: selected.draft.resourceBlocks.map(row => row.code)
    }));
} finally {
    runtime.dom.window.close();
}
