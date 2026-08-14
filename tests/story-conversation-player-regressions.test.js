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

    process.stdout.write(`${JSON.stringify({ ok: true, regressions: 30 })}\n`);
} finally {
    runtime.dom.window.close();
}
