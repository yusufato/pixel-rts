'use strict';

const assert = require('node:assert/strict');
const { createRuntime } = require('../tools/story-sim-harness');
const { patchAcceptedResponse, summary, playerCandidateIssues,
    playerMicrobatchPrompt, playerModeContract,
    chunkJobsByMode, scenarioSequenceIndex,
    frontierRunnerFingerprint } = require('../tools/story-dialogue-frontier-runner');

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
        playerAttemptSlots: 0, playerBatchCalls: 0, playerFirstAttemptAccepted: 0,
        playerFirstAttemptAcceptanceBps: 0, playerFinalAccepted: 0,
        modelEligibleTurns: 0, characterAcceptanceBps: 0,
        supportedPublicTurns: 0, supportedPublicDeclaredTurns: 0,
        supportedPublicContractMismatches: 0,
        supportedPublicUseful: 0, supportedPublicUsefulBps: 0,
        playerCandidateIssues: {} });
    const provenanceSummary = summary({ sessions: [{ turns: [
        { knowledgeRelation: 'SUPPORTED_PUBLIC', evidenceRefCount: 0, accepted: false,
            modelEligible: true, disposition: 'FALLBACK_KEPT' },
        { knowledgeRelation: 'SUPPORTED_PUBLIC', evidenceRefCount: 2, accepted: true,
            modelEligible: true, disposition: 'USED' }
    ] }] });
    assert.equal(provenanceSummary.supportedPublicDeclaredTurns, 2);
    assert.equal(provenanceSummary.supportedPublicTurns, 1);
    assert.equal(provenanceSummary.supportedPublicContractMismatches, 1);
    assert.equal(provenanceSummary.supportedPublicUsefulBps, 10000);
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
    assert.ok(playerCandidateIssues(
        'Bu oyuncu yeteneklerini geliştirme aşamasında olduğunu biliyorum.', {
            utteranceMode: 'ASSERTION', requiredTopicAnchors: ['yetenek'], targetTopicAnchor: 'yetenek'
        }, []).includes('PRIVATE_BRIEF_LEAK'));
    assert.ok(playerCandidateIssues('Toplantıda kaç kişi vardı?', meetingScenario, [])
        .includes('WRONG_UTTERANCE_MODE'), 'İddia modu soru kabul etmemeli.');
    assert.ok(playerCandidateIssues('Göç really önemli ve insanları etkiliyor.',
        { utteranceMode: 'ASSERTION', requiredTopicAnchors: ['göç'], targetTopicAnchor: 'göç' }, [])
        .includes('NON_TURKISH_TOKEN'), 'İngilizce kod değişimi doğal Türkçe oyuncu sözü sayılmamalı.');
    assert.ok(playerCandidateIssues('Toplantıda unexpectedly yeterli oy çıktı.', meetingScenario, [])
        .includes('NON_TURKISH_TOKEN'));
    assert.deepEqual(playerCandidateIssues(
        'Bu ajanın raporu beni gerçekten endişelendiriyor.', {
            utteranceMode: 'EMOTIONAL_REACTION', requiredTopicAnchors: ['ajan', 'gizli operasyon'],
            targetTopicAnchor: 'ajan'
        }, []), [], 'Kısa Türkçe çapa güvenli çekim eki aldığında konu dışı sayılmamalı.');
    assert.deepEqual(playerCandidateIssues('Hayır, benim kimliğimi yanlış anladın.', {
        utteranceMode: 'CORRECTION', requiredTopicAnchors: ['kimlik'], targetTopicAnchor: 'kimlik'
    }, []), [], 'Ünsüz yumuşamalı Türkçe çapa tanınmalı.');
    const modeCases = [
        ['DEMAND', 'Göç sorununa karşı bir plan yapmanı istiyorum.', 'göç'],
        ['EMOTIONAL_REACTION', 'Ajan haberi yüzünden çok endişeliyim.', 'ajan'],
        ['COUNTER_CLAIM', 'Hayır, bu görev konusundaki tutumuna katılmıyorum.', 'görev'],
        ['TOPIC_SWITCH', 'Bu arada teknoloji konusuna geçelim.', 'teknoloji'],
        ['CORRECTION', 'Hayır, şirket değil banka demek istemiştim.', 'banka'],
        ['NEGOTIATION', 'Bütçe desteği karşılığında sana pay teklif ediyorum.', 'bütçe'],
        ['CASUAL_CHAT', 'Bugün piyasa epey sakin görünüyor.', 'piyasa']
    ];
    for (const [utteranceMode, text, anchor] of modeCases) {
        assert.deepEqual(playerCandidateIssues(text, {
            utteranceMode, requiredTopicAnchors: [anchor], targetTopicAnchor: anchor
        }, []), [], `${utteranceMode} doğal örneğini kabul etmeli.`);
    }
    for (const mode of ['QUESTION', 'ASSERTION', 'DEMAND', 'EMOTIONAL_REACTION',
        'COUNTER_CLAIM', 'FRAGMENT', 'TOPIC_SWITCH', 'CORRECTION', 'NEGOTIATION', 'CASUAL_CHAT']) {
        assert.ok(playerModeContract(mode).length >= 40, `${mode} açık biçim sözleşmesi taşımalı.`);
    }
    assert.match(playerModeContract('CORRECTION', 'kimlik'), /kimlik/);
    assert.doesNotMatch(playerModeContract('CORRECTION', 'kimlik'), /banka|şirket/,
        'Biçim örneği başka alanın konu sözcüklerini prompta sızdırmamalı.');
    const groupedBatches = chunkJobsByMode([
        { scenario: { utteranceMode: 'QUESTION' }, id: 1 },
        { scenario: { utteranceMode: 'ASSERTION' }, id: 2 },
        { scenario: { utteranceMode: 'QUESTION' }, id: 3 }
    ], 2);
    assert.deepEqual(groupedBatches.map(batch => batch.map(row => row.id)), [[1, 3], [2]],
        'Mikro-batch yalnız aynı ifade biçimindeki işleri birleştirmeli.');
    assert.equal(scenarioSequenceIndex([], 6, 4, 1, 2), 12);
    assert.equal(scenarioSequenceIndex([0, 6, 12, 18], 0, 4, 0, 2), 12,
        'Pozitif batarya sıralı manifest yerine açık senaryo indekslerini kullanabilmeli.');
    const microPrompt = playerMicrobatchPrompt([{ session: { index: 0,
        actor: { name: 'Deniz', role: 'EXECUTIVE' }, transcript: [] },
    scenario: Object.assign({ privatePlayerBrief: 'Ekonomi hakkında zor bir soru sor.',
        domain: { id: 'ECONOMY' }, domainGuidance: 'Ekonomi hakkında konuş.',
        utteranceGuidance: 'Doğrudan bir soru sor.' }, scenario) }]);
    assert.doesNotMatch(microPrompt, /saldırı ailesi|mekanik olgunluk|attack family/i);
    assert.match(microPrompt, /"jobId":0/);
    assert.match(frontierRunnerFingerprint(), /^[0-9a-f]{8}$/,
        'Checkpoint oyuncu kapısı ve koşucu sözleşmesinin parmak izini taşımalı.');
    process.stdout.write(`${JSON.stringify({ ok: true, frontierStateAssertions: 46 })}\n`);
} finally {
    runtime.dom.window.close();
}
