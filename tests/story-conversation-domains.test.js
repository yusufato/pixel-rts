'use strict';

const assert = require('node:assert/strict');
const {
    STORY_CONVERSATION_DOMAINS, storyConversationDomainBuild,
    storyConversationDomainValidate
} = require('../js/StoryConversationDomains');

const fixtures = {
    SOCIAL: { topic: 'SOCIAL', speechAct: 'CHECK_IN', claims: [], entities: [] },
    ECONOMY: { topic: 'GENERAL', playerIntent: 'FOUND_COMPANY',
        claims: [{ id: 'claim:budget:1', type: 'PLAYER_REPORTED_BUDGET' }],
        entities: [{ entityId: 'electronics', role: 'COMMODITY' }] },
    POLITICS: { topic: 'POLITICS', speechAct: 'ACCUSE', claims: [], entities: [] },
    MILITARY: { topic: 'MILITARY', playerIntent: 'REQUEST_MILITARY_SUPPORT',
        claims: [{ id: 'claim:threat:1', type: 'PLAYER_REPORTED_MILITARY_THREAT' }],
        entities: [{ entityId: 'region:1', role: 'LOCATION' }] },
    DIPLOMACY: { topic: 'DIPLOMACY', playerIntent: 'REQUEST_ALLIANCE', claims: [],
        entities: [{ entityId: 'country:2', role: 'COUNTERPARTY' }] }
};

const bundles = Object.entries(fixtures).map(([domain, analysis]) => {
    const bundle = storyConversationDomainBuild({ analysis, roleView: {
        ok: true, bindingEvidence: [{ id: `authority:${domain.toLowerCase()}` }]
    } });
    assert.equal(bundle.domain, domain);
    assert.equal(bundle.producesText, false);
    assert.equal(bundle.rawWorldRead, false);
    assert.equal(bundle.worldCommand, null);
    assert.equal(bundle.worldMutation, false);
    assert.equal(storyConversationDomainValidate(bundle).ok, true);
    return bundle;
});
assert.deepEqual(bundles.map(row => row.domain), STORY_CONVERSATION_DOMAINS);
assert.equal(new Set(bundles.map(row => Object.keys(row).sort().join('|'))).size, 1,
    'beş domain aynı zarf şemasını kullanmalı');
assert.ok(bundles.find(row => row.domain === 'MILITARY').claimRefs.includes('claim:threat:1'));
assert.ok(bundles.find(row => row.domain === 'ECONOMY').entityRefs.includes('electronics'));

const inheritedMilitary = storyConversationDomainBuild({ analysis: {
    topic: 'MILITARY', claims: [], entities: []
}, inheritedClaims: [
    { id: 'claim:threat:old', type: 'PLAYER_REPORTED_MILITARY_THREAT' },
    { id: 'claim:budget:unrelated', type: 'PLAYER_REPORTED_BUDGET' }
] });
assert.deepEqual(inheritedMilitary.claimRefs, ['claim:threat:old'],
    'askerî adaptör yalnız ilgili kalıtsal iddiayı taşımalı');

const forged = JSON.parse(JSON.stringify(bundles[3]));
forged.allowedOperations.push('MOVE_ARMY');
assert.ok(storyConversationDomainValidate(forged).issues.some(row => row.code === 'OPERATION'));
const textWriter = JSON.parse(JSON.stringify(bundles[1]));
textWriter.producesText = true;
assert.ok(storyConversationDomainValidate(textWriter).issues.some(row => row.code === 'BOUNDARY'));

assert.equal(storyConversationDomainBuild({ analysis: {
    topic: 'ECONOMY', speechAct: 'ASK_INFORMATION', claims: [], entities: []
} }).domain, 'ECONOMY', 'doğrudan ekonomi sorusu sosyal alana düşmemeli');
const recorded = storyConversationDomainBuild({ analysis: fixtures.ECONOMY, factRecords: [{
    id: 'fact:country:0:inflation', actorId: 'character:0:president',
    countryId: 'country:0', field: 'inflation', status: 'VERIFIED',
    confidenceBps: 10000, sourceType: 'OWN_TREASURY', observedAt: 12,
    text: 'Doğrulanmış enflasyon göstergesi %4.0.'
}] });
assert.equal(storyConversationDomainValidate(recorded).ok, true);
const tamperedRecord = JSON.parse(JSON.stringify(recorded));
tamperedRecord.factRecords[0].text = 'Enflasyon %99.0.';
assert.ok(storyConversationDomainValidate(tamperedRecord).issues.some(row => row.code === 'CHECKSUM'),
    'tarihsel fact metni bundle imzasını bozmadan değiştirilememeli');
process.stdout.write(`${JSON.stringify({ ok: true, domains: bundles.length,
    sharedShape: true })}\n`);
