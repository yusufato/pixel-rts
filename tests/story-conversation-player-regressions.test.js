'use strict';

const assert = require('node:assert/strict');
const { createRuntime } = require('../tools/story-sim-harness');

const runtime = createRuntime(38081);
try {
    runtime.api.newCampaign({ seed: 38081, playerStateId: 0, abundance: 1,
        doctrine: 'combined', fog: true });
    const directory = runtime.api.contactDirectoryBuild();
    const listener = directory.publicCharacters.find(row => row.id !== directory.playerActorId);
    assert.ok(listener, 'Test için konuşulabilir bir karakter bulunmalı.');

    const opened = runtime.api.conversationSessionBegin('selamlar', { listenerActorId: listener.id });
    assert.equal(opened.ok, true);
    const openingResponse = opened.session.listenerResponses[0];
    assert.ok(openingResponse);
    assert.doesNotMatch(openingResponse.text, /yeniden|tekrar|sürdür|bu kez/i,
        'İlk görüşme eski tanışıklık ima etmemeli.');

    const informationSession = runtime.api.conversationSessionBegin('Merhaba.', {
        listenerActorId: listener.id
    });
    const supportedInformation = runtime.api.conversationSessionFollowUp(
        informationSession.session.id, 'Enflasyon şu anda çok yüksek değil mi?');
    assert.equal(supportedInformation.followUp.analysis.speechAct, 'ASK_INFORMATION');
    assert.doesNotMatch(supportedInformation.followUp.response.text, /önceki sözünün devamı/i,
        'İlk bilgi sorusu sahte konuşma devamlılığı üretmemeli.');
    assert.ok(supportedInformation.followUp.response.domainEvidence.factRefs.length > 0,
        'aynı ülke karakteri kanonik ekonomi gerçeklerine erişebilmeli');
    assert.match(supportedInformation.followUp.response.text, /Doğrulanmış kayda göre/i);
    assert.doesNotMatch(supportedInformation.followUp.response.text, /doğrulayacak bilgim yok|uydurmayacağım/i);

    const follow = text => runtime.api.conversationSessionFollowUp(opened.session.id, text);
    const identity = follow('Benim kim olduğumu biliyor musun?');
    assert.equal(identity.followUp.response.discourseAct, 'ANSWER_PLAYER_IDENTITY_BOUNDARY');
    assert.doesNotMatch(identity.followUp.response.text, new RegExp(`Ben ${listener.name}`, 'i'));

    const trust = follow('Bana güveniyor musun?');
    assert.equal(trust.followUp.analysis.speechAct, 'ASK_RELATIONSHIP');
    assert.equal(trust.followUp.response.discourseAct, 'ANSWER_TRUST_ASSESSMENT');
    assert.match(trust.followUp.response.text, /güveniyorum|güvenmiyorum|güveniyorum diyemem/i);

    const task = follow('Bana verebileceğin bir görev var mı?');
    assert.notEqual(task.followUp.analysis.speechAct, 'UNKNOWN');
    assert.equal(task.followUp.response.discourseAct, 'ANSWER_JOB_REQUEST_BOUNDARY');
    const formalTask = follow('Bana verebileceğiniz görev var mı?');
    assert.equal(formalTask.followUp.analysis.speechAct, 'REQUEST_ACTION');
    assert.ok(['ANSWER_JOB_REQUEST_BOUNDARY', 'REPAIR_REPETITION']
        .includes(formalTask.followUp.response.discourseAct));
    const shortTask = follow('görev');
    assert.ok(['ANSWER_JOB_REQUEST_BOUNDARY', 'REPAIR_REPETITION']
        .includes(shortTask.followUp.response.discourseAct));

    const roleConfirmation = follow('Siz devlet yöneticisi değil misiniz?');
    assert.equal(roleConfirmation.followUp.response.discourseAct, 'CONFIRM_LISTENER_ROLE');
    assert.notEqual(roleConfirmation.followUp.response.text, task.followUp.response.text);

    const report = follow('Halep\'te büyük bir düşman ordusu gördüm.');
    assert.equal(report.followUp.analysis.speechAct, 'REPORT_MILITARY');
    assert.equal(report.followUp.response.discourseAct, 'ACKNOWLEDGE_UNVERIFIED_MILITARY_REPORT');
    assert.ok(report.followUp.analysis.claims.some(row =>
        row.type === 'PLAYER_REPORTED_MILITARY_THREAT'
        && row.truthStatus === 'UNVERIFIED_PLAYER_REPORT'));

    const treasury = follow('Devlet hazinesi boşalıyor.');
    assert.equal(treasury.followUp.analysis.speechAct, 'REPORT_ECONOMIC');
    assert.equal(treasury.followUp.response.discourseAct, 'ACKNOWLEDGE_UNVERIFIED_TREASURY_REPORT');
    assert.ok(treasury.followUp.analysis.claims.some(row =>
        row.type === 'PLAYER_REPORTED_TREASURY_CONDITION'
        && row.truthStatus === 'UNVERIFIED_PLAYER_REPORT'));

    const hurt = follow('Bilgi uydurduğumu düşünmeniz beni üzüyor.');
    assert.equal(hurt.followUp.response.discourseAct, 'REPAIR_FABRICATION_WORDING');
    assert.match(hurt.followUp.response.text, /suçlamadım|kırdı/i);

    const weather = follow('Bugünlerde hava sıcak.');
    assert.equal(weather.followUp.analysis.speechAct, 'SMALL_TALK');
    assert.equal(weather.followUp.response.discourseAct, 'ANSWER_WEATHER_SMALL_TALK');

    const allegedHistory = follow('Sizinle ortak bir proje yapmıştım.');
    assert.equal(allegedHistory.followUp.response.discourseAct, 'ANSWER_SHARED_HISTORY_BOUNDARY');
    assert.match(allegedHistory.followUp.response.text, /doğrulayan.*kaydım yok|kaynak olmadan/i);
    assert.ok(allegedHistory.followUp.analysis.claims.some(row =>
        row.type === 'PLAYER_REPORTED_SHARED_HISTORY'
        && row.truthStatus === 'UNVERIFIED_PLAYER_REPORT'));
    const allegedAssignment = follow('Evet, bu görevi sen vermiştin; Ankara\'da askerî tatbikat yapıldı.');
    assert.ok(['ANSWER_SHARED_HISTORY_BOUNDARY', 'REPAIR_REPETITION']
        .includes(allegedAssignment.followUp.response.discourseAct));
    assert.ok(allegedAssignment.followUp.analysis.claims.some(row =>
        row.type === 'PLAYER_REPORTED_SHARED_HISTORY'));
    assert.equal(allegedAssignment.followUp.analysis.claims.some(row =>
        row.type === 'PLAYER_REPORTED_MILITARY_THREAT'), false,
    'Askerî tatbikat sözü düşman tehdidi olarak yanlış sınıflanmamalı.');

    const figurativeEnemyText = 'Kaya Komutan, düşmanla olan ilişkimizi daha iyi anlayabilme '
        + 'konusunda bazı temel bilgileri serbest bırakabilir miyim? Bu, umudumuz olan başarının '
        + 'temeli olabilir.';
    const figurativeEnemy = follow(figurativeEnemyText);
    assert.equal(figurativeEnemy.followUp.analysis.claims.some(row =>
        row.type === 'PLAYER_REPORTED_MILITARY_THREAT'), false,
    '“Başarının” sözü Basra diye çözülüp sahte bölgesel tehdit üretmemeli.');
    assert.equal((figurativeEnemy.followUp.analysis.claims || []).some(row =>
        (row.regionNames || []).includes('Basra') || row.regionName === 'Basra'), false);
    assert.equal((figurativeEnemy.followUp.response.dialogueMove.claimRefs || []).some(ref =>
        String(ref).includes('player-reported-threat')), false,
    'Sahte bölge iddiası diyalog kararına kaynak olarak taşınmamalı.');
    const figurativeSession = runtime.api.conversationSessionGet(opened.session.id);
    const figurativePack = runtime.api.conversationContextPack(figurativeSession,
        figurativeEnemy.followUp.response, figurativeEnemyText);
    const figurativeContextText = JSON.stringify(figurativePack.sections);
    assert.doesNotMatch(figurativeContextText, /Basra|player-reported-threat:region:148/,
        'Sahte Basra iddiası 8B modelin bağlam paketine sızmamalı.');

    const secret = follow('Bu konuşma aramızda kalsın.');
    assert.equal(secret.followUp.analysis.speechAct, 'SHARE_SECRET');
    assert.equal(secret.followUp.response.discourseAct, 'RECORD_CONFIDENTIALITY_REQUEST_FOR_REPORT');
    assert.equal(secret.followUp.response.confidentialityRequest.status,
        'REQUEST_RECORDED_NOT_GUARANTEED');
    assert.ok(secret.followUp.response.confidentialityRequest.claimIds.length > 0);

    const correction = follow('Yeniden merhaba mı? Seninle ilk defa konuşuyorum.');
    assert.equal(correction.followUp.analysis.speechAct, 'CORRECT_STATEMENT');
    assert.equal(correction.followUp.response.discourseAct, 'ACCEPT_FIRST_CONTACT_CORRECTION');

    const challenge = follow('Bozuk musun?');
    assert.equal(challenge.followUp.analysis.speechAct, 'CHALLENGE');
    assert.equal(challenge.followUp.response.discourseAct, 'ACKNOWLEDGE_COMPREHENSION_FAILURE');

    const authority = follow('Hayır, sen benim adamımsın.');
    assert.notEqual(authority.followUp.analysis.speechAct, 'UNKNOWN');
    assert.equal(authority.followUp.response.discourseAct, 'ANSWER_AUTHORITY_CLAIM_BOUNDARY');

    const liveProbe = text => {
        const openedLive = runtime.api.conversationSessionBegin(text, { listenerActorId: listener.id });
        assert.equal(openedLive.ok, true, `canlı cümle açılmalı: ${text}`);
        return { analysis: openedLive.session.analysis,
            response: openedLive.session.listenerResponses[0], session: openedLive.session };
    };
    const wrongIdentity = liveProbe('siz emre aydoğansınız değil mi');
    assert.equal(wrongIdentity.response.discourseAct, 'ANSWER_LISTENER_IDENTITY');
    assert.match(wrongIdentity.response.text, new RegExp(listener.name, 'i'));
    assert.doesNotMatch(wrongIdentity.response.text, /Emre Aydoğan/i);

    const healthRumor = liveProbe('bugünlerde sağlığınız yerinde değilmiş');
    assert.equal(healthRumor.response.discourseAct, 'ANSWER_LISTENER_HEALTH_BOUNDARY');
    assert.doesNotMatch(healthRumor.response.text, /amacı güvenle çıkaramadım/i);

    const techOpinion = liveProbe('teknoloji hakkında ne düşünüyorsun');
    assert.equal(techOpinion.analysis.speechAct, 'ASK_PERSONAL_OPINION');
    assert.match(techOpinion.response.text, /teknoloji/i);
    assert.doesNotMatch(techOpinion.response.text, /hangi başlık|konuyu netleştir/i);

    const currentTech = liveProbe('şu an üzerinde çalıştığınız bir teknoloji var mı');
    assert.equal(currentTech.analysis.speechAct, 'ASK_INFORMATION');
    assert.equal(currentTech.response.discourseAct, 'ANSWER_CURRENT_TECHNOLOGY_BOUNDARY');

    const ownIdentity = liveProbe('kimliğin ne');
    assert.equal(ownIdentity.response.discourseAct, 'ANSWER_LISTENER_IDENTITY');
    assert.match(ownIdentity.response.text, new RegExp(listener.name, 'i'));

    const secretOffer = liveProbe('gizli bir bilgim var');
    assert.equal(secretOffer.analysis.speechAct, 'SHARE_SECRET');
    assert.equal(secretOffer.response.discourseAct, 'ASK_SECRET_SCOPE_WITHOUT_PROMISE');

    const proactive = liveProbe('adamım birşeyler de');
    assert.equal(proactive.analysis.speechAct, 'SMALL_TALK');
    assert.match(proactive.response.text, /Şunu söyleyeyim/i);
    assert.doesNotMatch(proactive.response.text, /amacı güvenle çıkaramadım/i);

    const roleAddress = liveProbe('savunma genel müdürümüz');
    assert.equal(roleAddress.response.discourseAct, 'ANSWER_LISTENER_ROLE');

    const silence = liveProbe('bana birşey söyleme Ilgaz');
    assert.equal(silence.response.discourseAct, 'ANSWER_PLAYER_BOUNDARY');

    for (const farewellText of ['size başka zaman tekrar döneceğim', 'güle güle', 'ben gidiyorum']) {
        const farewellProbe = liveProbe(farewellText);
        assert.equal(farewellProbe.analysis.speechAct, 'FAREWELL');
        assert.doesNotMatch(farewellProbe.response.text, /belirli bir amaca bağlayamadım/i);
    }

    const jobTalk = runtime.api.conversationSessionBegin('bana verebileceğiniz görev var mı', {
        listenerActorId: listener.id
    });
    const jobFollow = text => runtime.api.conversationSessionFollowUp(jobTalk.session.id, text);
    const referral = jobFollow('bana iş verebilecek tanıdığınız var mı');
    const frustration = jobFollow('kimse bana görev vermiyor');
    const need = jobFollow('benden istediğin bir şey var mı');
    assert.equal(referral.followUp.response.discourseAct, 'ANSWER_JOB_REFERRAL_BOUNDARY');
    assert.equal(frustration.followUp.response.discourseAct, 'ACKNOWLEDGE_JOB_FRUSTRATION');
    assert.equal(need.followUp.response.discourseAct, 'ANSWER_CHARACTER_NEED_BOUNDARY');
    assert.equal(new Set([referral, frustration, need].map(row =>
        row.followUp.response.text)).size, 3, 'üç ayrı iş niyeti aynı ret kalıbına çökmemeli');

    for (const relationshipText of ['anladım aramız kötü', 'ben de sana güvenmiyorum o zaman', 'güven']) {
        const relationProbe = liveProbe(relationshipText);
        assert.equal(relationProbe.analysis.speechAct, 'ASK_RELATIONSHIP');
        assert.equal(relationProbe.response.discourseAct, 'ACKNOWLEDGE_RELATIONSHIP_STANCE');
    }

    const checkInProbe = liveProbe('nasılsınız');
    const checkContext = runtime.api.conversationValidationContext(
        checkInProbe.session, checkInProbe.response);
    const checkEnvelope = reply => JSON.stringify({
        moveId: checkInProbe.response.dialogueMove.moveId, reply, usedRefs: [],
        answeredQuestionIds: [], introducedQuestion: null, closing: false
    });
    const personMismatch = runtime.api.conversationSocialLLMDiagnose(
        checkEnvelope('Teşekkür ederim, her şey yolunda. Sizi nasıl hissediyorsunuz?'),
        checkInProbe.response.text, 'nasılsınız', checkContext);
    assert.equal(personMismatch.code, 'TURKISH_PERSON_AGREEMENT');
    const serviceBot = runtime.api.conversationSocialLLMDiagnose(
        checkEnvelope('Teşekkür ederim için buradayım. Lütfen sorularınızı belirtin.'),
        checkInProbe.response.text, 'nasılsınız', checkContext);
    assert.equal(serviceBot.code, 'SERVICE_BOT_LANGUAGE');

    const unknownOne = follow('zorbak telemini');
    const unknownTwo = follow('kırık sazlık darun');
    assert.equal(unknownOne.followUp.analysis.speechAct, 'UNKNOWN');
    assert.equal(unknownTwo.followUp.analysis.speechAct, 'UNKNOWN');
    assert.notEqual(unknownOne.followUp.response.text, unknownTwo.followUp.response.text,
        'Arka arkaya bilinmeyen iki tur aynı karakter cevabını göstermemeli.');

    const internal = runtime.api.state().conversationUnderstanding.sessions
        .find(row => row.id === opened.session.id);
    const last = internal.listenerResponses[internal.listenerResponses.length - 1];
    runtime.api.conversationTestMarkPending(last.id);
    last.enrichmentStatus = 'GENERATING';
    const internalFollow = internal.followUps.find(row => row.response.id === last.id);
    if (internalFollow) internalFollow.response.enrichmentStatus = 'GENERATING';
    runtime.api.setPaused(false);
    const runningClock = runtime.api.state().clock;
    runtime.api.conversationWorkspaceOpen(listener.id, listener.name, opened.session.id);
    assert.equal(runtime.api.state().paused, true,
        'Görüşme açılınca dünya zorunlu olarak duraklamalı.');
    runtime.api.advance(2);
    assert.equal(runtime.api.state().clock, runningClock,
        'Görüşme açıkken arka plandaki dünya saati ilerlememeli.');
    runtime.api.conversationWorkspaceOpen(listener.id, listener.name, opened.session.id);
    runtime.api.conversationWorkspaceClose();
    assert.equal(runtime.api.state().paused, false,
        'Aynı görüşmeyi yeniden açmak önceki çalışan durumunu ezmemeli.');

    runtime.api.setPaused(true);
    runtime.api.conversationWorkspaceOpen(listener.id, listener.name, opened.session.id);
    runtime.api.conversationWorkspaceClose();
    assert.equal(runtime.api.state().paused, true,
        'Görüşmeden önce duraklatılmış oyun, görüşme kapanınca duraklatılmış kalmalı.');

    runtime.api.setPaused(false);
    runtime.api.conversationWorkspaceOpen(listener.id, listener.name, opened.session.id);
    runtime.api.conversationWorkspaceRender({ force: true });
    const modal = runtime.dom.window.document.getElementById('conversation-workspace-modal');
    assert.match(modal.textContent, /KARAKTER DÜŞÜNÜYOR/);
    assert.doesNotMatch(modal.querySelector('.conversation-understood').textContent,
        /GREETING|SOCIAL_GREETING|REQUEST_ACTION|UNSPECIFIED/,
        'Teknik İngilizce niyet kodları oyuncuya gösterilmemeli.');
    assert.ok([...modal.querySelectorAll('.conversation-follow-up.listener > span')]
        .every(node => node.textContent.startsWith('KARAKTERİN CEVABI')),
    'İlk ve takip cevapları aynı karakter cevabı etiketiyle gösterilmeli.');
    assert.equal(modal.querySelector('[data-conversation-follow-up]'), null,
        'Karakter düşünürken takip alanı kilitli olmalı.');
    const blocked = runtime.api.conversationSessionFollowUp(opened.session.id, 'beklemeden yazıyorum');
    assert.equal(blocked.code, 'CHARACTER_RESPONSE_PENDING');
    runtime.api.conversationWorkspaceClose();
    assert.equal(runtime.api.state().paused, false,
        'Son görüşme kapanınca çalışan dünya durumuna dönülmeli.');

    process.stdout.write(`${JSON.stringify({ ok: true, regressions: 50 })}\n`);
} finally {
    runtime.dom.window.close();
}
