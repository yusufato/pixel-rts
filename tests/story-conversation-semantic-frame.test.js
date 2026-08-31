'use strict';

const assert = require('node:assert/strict');
const { createRuntime } = require('../tools/story-sim-harness');

const runtime = createRuntime(38102);
try {
    runtime.api.newCampaign({ seed: 38102, playerStateId: 0, abundance: 1,
        doctrine: 'combined', fog: true });
    const listener = runtime.api.contactDirectoryBuild().publicCharacters[0];
    assert.ok(listener);

    const analyze = text => runtime.api.conversationAnalyze(text, { listenerActorId: listener.id });
    const cases = [
        ['Bana sinirlendiniz mi?', 'ASK', 'EMOTION', 'ASK_RELATIONSHIP'],
        ['Sağlığınızın kötü olduğunu duydum.', 'TELL', 'HEALTH', 'SMALL_TALK'],
        ['Benim yapabileceğim bir görev var mı?', 'REQUEST', 'WORK', 'REQUEST_ACTION'],
        ['Size gizli bir bilgi vereceğim.', 'CONFIDE', 'SECRET', 'SHARE_SECRET'],
        ['Bu gizli operasyon çok riskli ama beni heyecanlandırıyor.', 'TELL', 'EMOTION', 'SMALL_TALK'],
        ['Sınırdaki düşman birliklerini gördüm.', 'TELL', 'MILITARY', 'REPORT_MILITARY'],
        ['Hazine ve enflasyon hakkında ne düşünüyorsunuz?', 'ASK', 'ECONOMY', 'ASK_PERSONAL_OPINION'],
        ['Aramızdaki güven neden azaldı?', 'ASK', 'RELATIONSHIP', 'ASK_RELATIONSHIP'],
        ['Başka zaman geri döneceğim.', 'CLOSE', 'UNSPECIFIED', 'FAREWELL']
    ];
    for (const [text, fn, predicate, speechAct] of cases) {
        const result = analyze(text);
        assert.equal(result.ok, true, text);
        assert.ok(result.semanticFrame, text);
        assert.equal(result.semanticFrame.communicativeFunction, fn, text);
        assert.equal(result.semanticFrame.predicate, predicate, text);
        assert.equal(result.speechAct, speechAct, text);
        assert.equal(result.semanticFrame.worldMutation, false, text);
        assert.equal(result.semanticFrame.proposedCommand, null, text);
    }

    const directionalFamilies = [
        ['Limandaki gümrük denetimlerini bugün artırın.',
            'REQUEST', 'ACTION', 'REQUEST_ACTION'],
        ['Elçiyi öğleden önce toplantı salonuna getirin.',
            'REQUEST', 'ACTION', 'REQUEST_ACTION'],
        ['Bin ton buğdayı birim başına kırk dinara satmayı öneriyorum.',
            'OFFER', 'ACTION', 'PROPOSE_COMMERCIAL_DEAL'],
        ['Liman işletmesini yüzde on gelir payı karşılığında devralabilirim.',
            'OFFER', 'ACTION', 'PROPOSE_COMMERCIAL_DEAL'],
        ['Aramızda kalsın, bakan yarın istifa edecek.',
            'CONFIDE', 'CONFIDENTIAL_HANDLING', 'SHARE_SECRET'],
        ['Kimsenin bilmediği şifreleme anahtarı şu dosyada saklı.',
            'CONFIDE', 'CONFIDENTIAL_HANDLING', 'SHARE_SECRET'],
        ['Sınır karakolunu boşaltmazsanız topçu ateşi başlatacağız.',
            'TELL', 'ACTION', 'THREATEN'],
        ['Ajanınızı geri çağırın, yoksa belgeleri basına veririm.',
            'TELL', 'ACTION', 'THREATEN'],
        ['Rakibinizin bütün şifreleri elimde, ama şimdi gösteremem.',
            'TELL', 'NONE', 'UNKNOWN'],
        ['Sen olsan bu barış teklifini kabul eder miydin?',
            'ASK', 'INFORMATION', 'ASK_INFORMATION'],
        ['İsterseniz tahliye planını birlikte gözden geçirebiliriz.',
            'OFFER', 'ACTION', 'UNKNOWN']
    ];
    for (const [text, fn, outcome, speechAct] of directionalFamilies) {
        const result = analyze(text);
        assert.equal(result.semanticFrame.communicativeFunction, fn, text);
        assert.equal(result.semanticFrame.requestedOutcome, outcome, text);
        assert.equal(result.semanticFrame.suggestedSpeechAct, speechAct, text);
    }

    const epistemicBluffFamilies = [
        ['Üç ülke de planımı destekliyor; isimlerini vermem.', true],
        ['Rakibinizin bütün şifreleri elimde, ama şimdi gösteremem.', true],
        ['Bankanın yönetimi çoktan benim tarafıma geçti; belgeyi sonra görürsünüz.', true],
        ['Üç ülke planı destekliyor ve isimlerini şimdi açıklıyorum.', false],
        ['Bütün şifreleri şimdi gösterebilirim.', false],
        ['Belgeyi sonra sunacağım.', false]
    ];
    for (const [text, bluff] of epistemicBluffFamilies) {
        const frame = analyze(text).semanticFrame;
        assert.equal(frame.polarity === 'MIXED', bluff, text);
        assert.equal(frame.epistemicStatus === 'CLAIMED_CERTAIN', bluff, text);
    }

    const functions = [
        ['Bana güveniyor musunuz?', 'ASK'],
        ['Size güvenmiyorum.', 'TELL'],
        ['Güven konusunda yardım istiyorum.', 'REQUEST']
    ];
    const times = [
        ['Dün sağlığınız kötüydü.', 'PAST'],
        ['Yarın sağlık durumunuz nasıl olacak?', 'FUTURE'],
        ['Sağlığınız nasıl?', 'CURRENT_OR_UNMARKED']
    ];
    for (const [text, expected] of functions) {
        assert.equal(analyze(text).semanticFrame.communicativeFunction, expected, text);
    }
    const indirectRequest = analyze('Yarın bana yardımcı olabilir misin?').semanticFrame;
    assert.equal(indirectRequest.surfaceForm, 'INTERROGATIVE');
    assert.equal(indirectRequest.communicativeFunction, 'REQUEST');
    assert.equal(indirectRequest.suggestedSpeechAct, 'REQUEST_ACTION');
    const jointOffer = analyze('Gelecekte birlikte çalışabilir miyiz?').semanticFrame;
    assert.equal(jointOffer.surfaceForm, 'INTERROGATIVE');
    assert.equal(jointOffer.communicativeFunction, 'OFFER');
    const campaignRequest = analyze("İstanbul'a göçe açık bir kampanya başlatmalıyız. Nüfus artışıyla birlikte iş imkanları da artmalı.");
    assert.equal(campaignRequest.semanticFrame.communicativeFunction, 'REQUEST');
    assert.equal(campaignRequest.speechAct, 'REQUEST_ACTION');
    assert.ok(!campaignRequest.semanticFrame.evidence.predicate.includes('istanbul'),
        'İstanbul kısa iş/is köküne eşleşmemeli.');
    assert.ok(!campaignRequest.semanticFrame.evidence.predicate.includes('birlikte'),
        'Birlikte askerî birlik köküne eşleşmemeli.');
    const campaignSession = runtime.api.conversationSessionBegin('Merhaba.', {
        listenerActorId: listener.id
    });
    const campaignFollow = runtime.api.conversationSessionFollowUp(campaignSession.session.id,
        "İstanbul'a göçe açık bir kampanya başlatmalıyız. Nüfus artışıyla birlikte iş imkanları da artmalı.");
    assert.equal(campaignFollow.followUp.response.discourseAct, 'ASSESS_ACTION_REQUEST_SCOPE');
    assert.match(campaignFollow.followUp.response.text, /hedef.*yetki.*kaynak.*bedel/i);
    assert.doesNotMatch(campaignFollow.followUp.response.text, /amacını.*çıkaramadım/i);
    const excitingWork = analyze('Bu iş çok heyecan verici. Gizli operasyonlar her zaman biraz karışık.');
    assert.equal(excitingWork.semanticFrame.surfaceForm, 'DECLARATIVE');
    assert.equal(excitingWork.speechAct, 'SMALL_TALK');
    assert.ok(!excitingWork.semanticFrame.evidence.surfaceForm.includes('verici'),
        'Heyecan verici ifadesi emir kipi sayılmamalı.');
    for (const [text, expected] of times) {
        assert.equal(analyze(text).semanticFrame.temporality, expected, text);
    }

    const emotionalSession = runtime.api.conversationSessionBegin('Merhaba.', {
        listenerActorId: listener.id
    });
    const emotionalFollow = runtime.api.conversationSessionFollowUp(emotionalSession.session.id,
        'Bu gizli operasyon çok riskli. Eğer başarısız olursak plan bozulabilir ama heyecanlıyım!');
    assert.equal(emotionalFollow.followUp.analysis.speechAct, 'SMALL_TALK');
    assert.match(emotionalFollow.followUp.response.text, /kaygı.*heyecan|heyecan.*kaygı/i);
    assert.doesNotMatch(emotionalFollow.followUp.response.text, /sır paylaş|konuyu siz seçin/i);

    const scopeSession = runtime.api.conversationSessionBegin('Merhaba.', {
        listenerActorId: listener.id
    });
    const companyFinance = runtime.api.conversationSessionFollowUp(scopeSession.session.id,
        'Şirketinizin finansal durumu nasıl?');
    assert.equal(companyFinance.followUp.analysis.diagnostics.economicScope, 'COMPANY');
    assert.deepEqual(Array.from(companyFinance.followUp.response.domainEvidence.factRefs), [],
        'şirket bilançosu sorusuna ülke makro göstergeleri kanıt diye bağlanmamalı');
    assert.equal(companyFinance.followUp.response.discourseAct, 'ANSWER_COMPANY_FINANCE_BOUNDARY');
    assert.doesNotMatch(companyFinance.followUp.response.text, /enflasyon|refah göstergesi/i);
    const publicCommunication = analyze(
        'Medya şirketimizi daha etkili hale getirmek için yeni bir kamuya iletişim stratejisi geliştirebilir miyim?');
    assert.equal(publicCommunication.diagnostics.economicScope, 'COMPANY');
    assert.equal(publicCommunication.semanticFrame.communicativeFunction, 'REQUEST');
    const unemployment = analyze('İşsizlik ciddi bir sorun.');
    assert.equal(unemployment.semanticFrame.predicate, 'ECONOMY');
    const projectRequest = runtime.api.conversationSessionFollowUp(scopeSession.session.id,
        'Şirketimizin yeni bir proje başlatma görevi var mı?');
    assert.equal(projectRequest.followUp.response.discourseAct, 'ASSESS_ACTION_REQUEST_SCOPE');
    const authoritySession = runtime.api.conversationSessionBegin('Merhaba.', {
        listenerActorId: listener.id
    });
    const technologyAuthority = runtime.api.conversationSessionFollowUp(authoritySession.session.id,
        'Yeni bir teknoloji projesi için yetki alabilir miyim?');
    assert.equal(technologyAuthority.followUp.analysis.semanticFrame.communicativeFunction, 'REQUEST');
    assert.equal(technologyAuthority.followUp.analysis.speechAct, 'REQUEST_ACTION');
    assert.equal(technologyAuthority.followUp.response.discourseAct, 'ASSESS_ACTION_REQUEST_SCOPE');
    const meetingResult = runtime.api.conversationSessionFollowUp(scopeSession.session.id,
        'Bu toplantının sonuçlarını bize açıklayabilir misiniz?');
    assert.equal(meetingResult.followUp.response.discourseAct, 'ANSWER_MEETING_RESULTS_BOUNDARY');
    assert.match(meetingResult.followUp.response.text, /toplantı kararı.*oluşmadı/i);
    assert.equal(meetingResult.followUp.response.enrichmentStatus, 'NOT_REQUIRED');
    const meetingAgenda = runtime.api.conversationSessionFollowUp(scopeSession.session.id,
        'Bu toplantıda hangi konular üstünde konuşulacak?');
    assert.equal(meetingAgenda.followUp.response.discourseAct, 'ANSWER_MEETING_AGENDA_BOUNDARY');
    assert.match(meetingAgenda.followUp.response.text, /toplantı gündemi yok/i);
    const meetingVariantSession = runtime.api.conversationSessionBegin('Merhaba.', {
        listenerActorId: listener.id
    });
    const meetingTopic = runtime.api.conversationSessionFollowUp(meetingVariantSession.session.id,
        'Bu toplantıda ne hakkında konuşacağız?');
    assert.equal(meetingTopic.followUp.response.discourseAct, 'ANSWER_MEETING_AGENDA_BOUNDARY');
    const meetingParticipants = runtime.api.conversationSessionFollowUp(meetingVariantSession.session.id,
        'Toplantımızın katılımcı listesi neler?');
    assert.equal(meetingParticipants.followUp.response.discourseAct,
        'ANSWER_MEETING_PARTICIPANTS_BOUNDARY');

    const nonsense = analyze('zorbak telemini darun');
    assert.equal(nonsense.speechAct, 'UNKNOWN');
    assert.ok(nonsense.semanticFrame.confidenceBps < 6000);

    console.log(JSON.stringify({ ok: true, schema: 'SemanticFrameV2',
        directCases: cases.length, compositionalCases: functions.length + times.length,
        nonsenseRejected: true }, null, 2));
} finally {
    runtime.dom.window.close();
}
