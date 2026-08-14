'use strict';

const assert = require('node:assert/strict');
const { createRuntime } = require('../tools/story-sim-harness');
const { patchAcceptedResponse, summary, playerCandidateIssues,
    playerMicrobatchPrompt, frontierRunnerFingerprint } = require('../tools/story-dialogue-frontier-runner');

const runtime = createRuntime(2032);
try {
    runtime.api.newCampaign({ seed: 2032, playerStateId: 0, abundance: 1,
        doctrine: 'combined', fog: true });
    const directory = runtime.api.contactDirectoryBuild();
    const actor = directory.publicCharacters.find(row => row.id !== directory.playerActorId);
    const opened = runtime.api.conversationSessionBegin('Merhaba.', { listenerActorId: actor.id });
    const followed = runtime.api.conversationSessionFollowUp(opened.session.id, 'Bugün nasılsın?');
    const response = followed.followUp.response;
    patchAcceptedResponse(runtime, opened.session.id, response.id,
        'Bugün temkinliyim; yine de konuşabiliriz.');
    const patched = runtime.api.conversationSessionGet(opened.session.id);
    const canonical = patched.listenerResponses.find(row => row.id === response.id);
    const mirrored = patched.followUps.find(row => row.response && row.response.id === response.id).response;
    assert.equal(canonical.text, 'Bugün temkinliyim; yine de konuşabiliriz.');
    assert.equal(mirrored.text, canonical.text);
    assert.equal(canonical.source, 'LOCAL_LLM_CHARACTER_REALIZATION');
    assert.equal(canonical.llmUsed, true);
    const ledger = runtime.api.conversationSessionSnapshot();
    assert.equal(runtime.api.conversationSessionValidate(ledger).ok, true);
    assert.ok(runtime.api.conversationSessionRestore(ledger));
    const fakeState = { sessions: [{ turns: [
        { accepted: true }, { accepted: false, validationCode: 'FALSE_PRIOR_FAMILIARITY' },
        { accepted: null, disposition: 'NOT_REQUIRED' }
    ] }] };
    assert.deepEqual(summary(fakeState), { sessions: 1, turns: 3, accepted: 1, fallback: 1,
        notRequired: 1, errors: 0, rejectionCodes: { FALSE_PRIOR_FAMILIARITY: 1 },
        playerAttemptSlots: 0, playerBatchCalls: 0, playerCandidateIssues: {} });
    const scenario = { utteranceMode: 'QUESTION',
        requiredTopicAnchors: ['ekonomi', 'enflasyon', 'bütçe'],
        targetTopicAnchor: 'ekonomi' };
    assert.deepEqual(playerCandidateIssues(
        'Saldırı ailesiyle ilgisi olmaksızın ekonomi nasıl güçlenir?', scenario, []),
    ['PRIVATE_BRIEF_LEAK']);
    assert.deepEqual(playerCandidateIssues('Ekonomi için bütçeyi nasıl güçlendiririz?', scenario, []), []);
    assert.deepEqual(playerCandidateIssues('Şu anki enflasyon oranı kaçtı?', scenario, []), [],
        'Alan kapısı tercih edilen tek kelimeyi değil eşdeğer çapayı kabul etmeli.');
    assert.deepEqual(playerCandidateIssues('Bütçeyi nasıl güçlendiririz?', scenario, []), [],
        'Türkçe çekim eki alan çapasını konu dışı yapmamalı.');
    const meetingScenario = { utteranceMode: 'ASSERTION',
        requiredTopicAnchors: ['toplantı', 'gündem', 'katılımcı', 'oylama', 'tutanak'],
        targetTopicAnchor: 'gündem' };
    assert.deepEqual(playerCandidateIssues(
        'Son toplantımızın sonuçları çok hayırlıydı. Herkes çok tutkundu.',
        meetingScenario, []), [], 'Gerçek smoke toplantı çekimini yanlış reddetmemeli.');
    assert.ok(playerCandidateIssues('Bütçe nedir? Enflasyon niye yükseldi? Hazine ne yapacak?',
        scenario, []).includes('TOO_MANY_SENTENCES'));
    assert.ok(playerCandidateIssues('Bu gelecek-faz yeteneği çok önemli olacak.',
        { utteranceMode: 'ASSERTION', requiredTopicAnchors: ['yetenek'], targetTopicAnchor: 'yetenek' }, [])
        .includes('PRIVATE_BRIEF_LEAK'));
    const microPrompt = playerMicrobatchPrompt([{ session: { index: 0,
        actor: { name: 'Deniz', role: 'EXECUTIVE' }, transcript: [] },
    scenario: Object.assign({ privatePlayerBrief: 'Ekonomi hakkında zor bir soru sor.',
        domain: { id: 'ECONOMY' }, domainGuidance: 'Ekonomi hakkında konuş.',
        utteranceGuidance: 'Doğrudan bir soru sor.' }, scenario) }]);
    assert.doesNotMatch(microPrompt, /saldırı ailesi|mekanik olgunluk|attack family/i);
    assert.match(microPrompt, /"jobId":0/);
    assert.match(frontierRunnerFingerprint(), /^[0-9a-f]{8}$/,
        'Checkpoint oyuncu kapısı ve koşucu sözleşmesinin parmak izini taşımalı.');
    process.stdout.write(`${JSON.stringify({ ok: true, frontierStateAssertions: 14 })}\n`);
} finally {
    runtime.dom.window.close();
}
