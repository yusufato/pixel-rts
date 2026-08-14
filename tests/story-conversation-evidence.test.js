'use strict';

const assert = require('node:assert/strict');
const { createRuntime } = require('../tools/story-sim-harness');

const runtime = createRuntime(2032);
try {
    runtime.api.newCampaign({
        seed: 2032, playerStateId: 0, abundance: 1,
        doctrine: 'combined', fog: true
    });
    const directory = runtime.api.contactDirectoryBuild();
    const ownExecutive = directory.publicCharacters.find(row =>
        row.ownerId === directory.playerCountryId && row.role === 'EXECUTIVE');
    const ownCommander = directory.publicCharacters.find(row =>
        row.ownerId === directory.playerCountryId && row.role === 'COMMANDER'
        && row.id !== directory.playerActorId);
    const foreignExecutive = directory.publicCharacters.find(row =>
        row.ownerId !== directory.playerCountryId && row.role === 'EXECUTIVE');
    assert.ok(ownExecutive && ownCommander && foreignExecutive, 'kanıt testi için üç rol bulunmalı');

    function ask(actor, text) {
        const opened = runtime.api.conversationSessionBegin('Merhaba.', { listenerActorId: actor.id });
        const followed = runtime.api.conversationSessionFollowUp(opened.session.id, text);
        const session = runtime.api.conversationSessionGet(opened.session.id);
        const response = session.listenerResponses.find(row =>
            row.id === followed.followUp.response.id);
        const pack = runtime.api.conversationContextPack(session, response, text);
        return { followed, session, response, pack };
    }

    const economyQuestion = 'Ekonomi son dönemde nasıl değişti ve bütçenin güncel durumu nedir?';
    const own = ask(ownExecutive, economyQuestion);
    assert.equal(own.followed.followUp.analysis.topic, 'ECONOMY');
    assert.ok(own.followed.followUp.analysis.diagnostics.economicSignals.includes('BUDGET'));
    assert.ok(own.followed.followUp.analysis.diagnostics.economicSignals.includes('TREND'));
    assert.equal(own.response.domainEvidence.domain, 'ECONOMY');
    assert.ok(own.response.domainEvidence.factRefs.includes('fact:country:0:budget'));
    assert.equal(own.response.domainEvidence.factRecords.length,
        own.response.domainEvidence.factRefs.length);
    assert.deepEqual(own.response.dialogueMove.factRefs, own.response.domainEvidence.factRefs);
    const ownFacts = own.pack.sections.filter(row => row.kind === 'FACT');
    assert.equal(ownFacts.length, own.response.domainEvidence.factRefs.length);
    assert.ok(ownFacts.some(row => /OWN_BUDGET_LEDGER/.test(row.text)));
    assert.ok(ownFacts.every(row => row.protected && row.sourceRefs.length === 1));
    assert.ok(ownFacts.every(row => !/recentTransactions|journal|policyHash/.test(row.text)),
        'ham bütçe defteri prompta sızmamalı');
    assert.equal(own.response.source, 'DETERMINISTIC_VERIFIED_FACT_RESPONSE');
    assert.match(own.response.text, /Doğrulanmış kayda göre/);
    assert.match(own.response.text, /anlık kayıt geçmiş dönem değişimini/i,
        'trend sorusu yalnız anlık görüntüyle cevaplanmış gibi yapılmamalı');
    assert.doesNotMatch(own.response.text, /doğrulayacak bilgim yok/i);
    const validationContext = runtime.api.conversationValidationContext(own.session, own.response);
    const envelope = (reply, usedRefs) => JSON.stringify({
        moveId: own.response.dialogueMove.moveId, reply, usedRefs,
        answeredQuestionIds: [], introducedQuestion: null, closing: false
    });
    const groundedReply = runtime.api.conversationSocialLLMDiagnose(envelope(
        'Doğrulanmış kayıtta enflasyon %0.0, refah ise 50.0/100 görünüyor.',
        ['fact:country:0:inflation', 'fact:country:0:welfare']),
    own.response.text, economyQuestion, validationContext);
    assert.equal(groundedReply.ok, true, 'kaynaklı sayılar gerçek cevaba açılmalı');
    const inventedNumber = runtime.api.conversationSocialLLMDiagnose(envelope(
        'Doğrulanmış enflasyon %99.0 görünüyor.', ['fact:country:0:inflation']),
    own.response.text, economyQuestion, validationContext);
    assert.equal(inventedNumber.code, 'UNSOURCED_NUMBER', 'FACT dışı sayı reddedilmeli');
    const deniedAvailable = runtime.api.conversationSocialLLMDiagnose(envelope(
        'Bu konuda bilgim yok.', ['fact:country:0:inflation']),
    own.response.text, economyQuestion, validationContext);
    assert.equal(deniedAvailable.code, 'AVAILABLE_FACT_DENIED',
        'mevcut doğrulanmış gerçek varken bilgisizlik kaçışı reddedilmeli');

    const commander = ask(ownCommander, 'Ekonomi, bütçe ve refah ne durumda?');
    assert.deepEqual(Array.from(commander.response.domainEvidence.factRefs), [
        'fact:country:0:inflation', 'fact:country:0:welfare'
    ], 'kurum yetkisi olmayan komutan bütçe ve hazine hesabını görmemeli');
    const rebuiltOwnPack = runtime.api.conversationContextPack(
        own.session, own.response, economyQuestion);
    assert.equal(rebuiltOwnPack.sections.filter(row => row.kind === 'FACT').length, 4,
        'aynı ülkenin iki karakteri birbirinin fact cache kaydını ezmemeli');

    const foreign = ask(foreignExecutive, 'Ekonominizin ve bütçenizin güncel durumu nedir?');
    assert.ok(foreign.response.domainEvidence.factRefs.length >= 2);
    assert.ok(foreign.response.domainEvidence.factRefs.every(ref =>
        ref.startsWith(`fact:${foreignExecutive.ownerId}:`)));
    assert.ok(foreign.response.domainEvidence.factRefs.every(ref =>
        !ref.startsWith(`fact:${directory.playerCountryId}:`)),
    'yabancı yöneticiye oyuncu ülkesinin özel defteri bağlanmamalı');

    const relationship = ask(ownExecutive,
        'Bana güveniyor musun, aramızdaki ilişkiyi nasıl görüyorsun?');
    const expectedDirectionalId = `relationship:${ownExecutive.id}=>${directory.playerActorId}`;
    assert.equal(relationship.followed.followUp.analysis.topic, 'RELATIONSHIP');
    assert.equal(relationship.followed.followUp.analysis.speechAct, 'ASK_RELATIONSHIP');
    assert.deepEqual(Array.from(relationship.response.domainEvidence.factRefs), [expectedDirectionalId],
        'yalnız muhataptan oyuncuya yönlü ilişki kanıtı kullanılmalı');
    assert.ok(relationship.response.domainEvidence.factRecords[0].text.includes(
        'Bu kayıt yalnız muhataptan oyuncuya yöneliktir'));
    assert.equal(relationship.pack.sections.filter(row => row.kind === 'FACT').length, 1);
    assert.equal(relationship.response.source, 'DETERMINISTIC_GROUNDED_DISCOURSE_RESPONSE');
    assert.doesNotMatch(relationship.response.text, /biraz daha açık/i);
    assert.equal(relationship.response.domainEvidence.factRefs.some(ref =>
        ref === `relationship:${directory.playerActorId}=>${ownExecutive.id}`), false,
    'oyuncudan muhataba ters ilişki kanıt diye sızmamalı');

    const relationshipContext = runtime.api.conversationValidationContext(
        relationship.session, relationship.response);
    relationshipContext.dialogueMove = Object.assign({},
        relationshipContext.dialogueMove, { act: 'ASK_RELATIONSHIP' });
    const relationshipEvasion = runtime.api.conversationSocialLLMDiagnose(JSON.stringify({
        moveId: relationship.response.dialogueMove.moveId,
        reply: 'Güvenin nerede kaybolduğunu duydum. Lütfen biraz daha açık söyleyin.',
        usedRefs: [expectedDirectionalId], answeredQuestionIds: [],
        introducedQuestion: null, closing: false
    }), relationship.response.text, 'Bana güveniyor musun?', relationshipContext);
    assert.equal(relationshipEvasion.code, 'AVAILABLE_FACT_DENIED',
        'FACT referansını yazıp cevaptan kaçmak kabul edilmemeli');

    const togetherSentence = runtime.api.conversationAnalyze(
        'Bu projenin başarılı olması için güvenimi sana sunuyorum. Onunla birlikte, benim için de bir pay talep ediyorum.',
        { listenerActorId: ownExecutive.id });
    assert.equal(togetherSentence.topic, 'RELATIONSHIP',
        '“birlikte” sözcüğü askerî “birlik” diye sınıflandırılmamalı');
    assert.equal(togetherSentence.diagnostics.relationshipSignals.includes(
        'DIRECTIONAL_RELATIONSHIP'), true);
    const inflectedTrustQuestion = runtime.api.conversationAnalyze(
        'Demir, güvenin nerede kayboldu?', { listenerActorId: ownExecutive.id });
    assert.equal(inflectedTrustQuestion.speechAct, 'ASK_RELATIONSHIP');
    assert.equal(inflectedTrustQuestion.topic, 'RELATIONSHIP');

    const unestablishedActor = directory.publicCharacters.find(row =>
        row.id !== directory.playerActorId
        && !runtime.api.relationshipView(row.id, directory.playerActorId));
    assert.ok(unestablishedActor, 'ilişki kaydı olmayan karakter fikstürü bulunmalı');
    const unestablished = ask(unestablishedActor, 'Aramızdaki güven ve itibar nasıl?');
    assert.equal(unestablished.followed.followUp.analysis.topic, 'RELATIONSHIP');
    assert.equal(unestablished.response.domainEvidence.factRecords.length, 1);
    assert.equal(unestablished.response.domainEvidence.factRecords[0].sourceType,
        'DIRECTIONAL_RELATIONSHIP_LEDGER_ABSENCE');
    assert.equal(unestablished.response.source, 'DETERMINISTIC_VERIFIED_FACT_RESPONSE');
    assert.match(unestablished.response.domainEvidence.factRecords[0].text,
        /ilişki kaydı henüz oluşmamış/);

    const social = ask(ownExecutive, 'Bugün nasılsın?');
    assert.equal(social.response.domainEvidence.domain, 'SOCIAL');
    assert.deepEqual(Array.from(social.response.domainEvidence.factRefs), []);
    assert.equal(social.pack.sections.some(row => row.kind === 'FACT'), false);

    const ledger = runtime.api.conversationSessionSnapshot();
    assert.equal(runtime.api.conversationSessionValidate(ledger).ok, true);
    assert.ok(runtime.api.conversationSessionRestore(JSON.parse(JSON.stringify(ledger))));
    const restored = runtime.api.conversationSessionGet(own.session.id);
    const restoredResponse = restored.listenerResponses.find(row => row.id === own.response.id);
    const restoredPack = runtime.api.conversationContextPack(restored, restoredResponse, economyQuestion);
    assert.deepEqual(
        Array.from(restoredPack.sections.filter(row => row.kind === 'FACT').map(row => row.text)),
        Array.from(ownFacts.map(row => row.text)),
        'kayıt/yükleme tarihsel FACT metinlerini birebir korumalı');
    process.stdout.write(`${JSON.stringify({
        ok: true, ownFactCount: ownFacts.length,
        commanderFactCount: commander.response.domainEvidence.factRefs.length,
        foreignFactCount: foreign.response.domainEvidence.factRefs.length,
        relationshipFactCount: relationship.response.domainEvidence.factRefs.length,
        unestablishedRelationshipFactCount: unestablished.response.domainEvidence.factRefs.length,
        socialFactCount: 0
    })}\n`);
} finally {
    runtime.dom.window.close();
}
