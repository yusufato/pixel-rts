'use strict';

const assert = require('node:assert/strict');
const { createRuntime } = require('../tools/story-sim-harness');
const runtime = createRuntime(2032);
try {
    runtime.api.newCampaign({ seed: 2032, playerStateId: 0, abundance: 1,
        doctrine: 'combined', fog: true });
    const directory = runtime.api.contactDirectoryBuild();
    const listener = directory.publicCharacters.find(row => row.id !== directory.playerActorId);
    const opened = runtime.api.conversationSessionBegin('selamlar dostum', { listenerActorId: listener.id });
    const response = opened.session.listenerResponses[0];
    const context = { history: [], dialogueMove: response.dialogueMove };
    const diagnose = reply => runtime.api.conversationSocialLLMDiagnose(JSON.stringify(Object.assign({
        moveId: response.dialogueMove.moveId, usedRefs: [], answeredQuestionIds: [],
        introducedQuestion: null, closing: false
    }, { reply })), response.text, 'selamlar dostum', context);
    assert.equal(diagnose('Bugün bir iş görüşmesine hazırlanıyorum. Çok meşgulüm.').code,
        'UNSOURCED_PERSONAL_STATE');
    assert.equal(diagnose('Elbette! Bugün yüzümün nasıl gülüyor diye merak ediyordum.').code,
        'UNSOURCED_PERSONAL_STATE');
    assert.equal(diagnose('Basra\'da bir tehdit olduğunu duydum. Daha fazla bilgi ister misin?').code,
        'UNSOURCED_LOCATION');
    assert.equal(diagnose('Cepheye geri dönmeyeceğim çünkü burada kalacağım.').code,
        'UNAUTHORIZED_FUTURE_COMMITMENT');
    assert.equal(diagnose('Neler yapmamıza yardımcı olabiliriz?').code, 'SERVICE_BOT_LANGUAGE');
    assert.equal(diagnose(response.text).code, 'EXACT_FALLBACK_COPY');
    assert.equal(diagnose('İyi bir gün geçirdim.').code, 'UNSOURCED_PERSONAL_STATE');
    assert.equal(diagnose('selamlar dostum').code, 'PLAYER_INPUT_ECHO');
    const evasive = diagnose('Elbette güveni önemsiyorum ama önce konuyu açalım.');
    assert.ok(evasive.qualityTags.includes('EVASIVE_DIRECT_QUESTION') === false,
        'kalite etiketi doğru oyuncu sorusuyla ölçülmeli');
    const directContext = runtime.api.conversationSocialLLMDiagnose(JSON.stringify({
        moveId: response.dialogueMove.moveId, reply: 'Elbette güveni önemsiyorum ama önce konuyu açalım.',
        usedRefs: [], answeredQuestionIds: [], introducedQuestion: null, closing: false
    }), response.text, 'Bana güveniyor musun?', context);
    assert.ok(directContext.qualityTags.includes('EVASIVE_DIRECT_QUESTION'));
    assert.equal(directContext.ok, false);
    assert.equal(directContext.code, 'EVASIVE_DIRECT_QUESTION');
    const whyContext = runtime.api.conversationSocialLLMDiagnose(JSON.stringify({
        moveId: response.dialogueMove.moveId, reply: 'Ne demek istediğini biraz daha açar mısın?',
        usedRefs: [], answeredQuestionIds: [], introducedQuestion: null, closing: false
    }), response.text, 'Neden?', context);
    assert.equal(whyContext.code, 'FAILED_REASON_CONTINUATION');
    assert.equal(diagnose('Halep tarihi ve kültürü hakkında çok şey biliyorum.').code,
        'UNSOURCED_KNOWLEDGE_CLAIM');
    const directness = runtime.api.conversationSocialLLMDiagnose(JSON.stringify({
        moveId: response.dialogueMove.moveId,
        reply: 'Ne demek istediğini biraz daha açar mısın?', usedRefs: [],
        answeredQuestionIds: [], introducedQuestion: null, closing: false
    }), response.text, 'Bana açık konuşur musun?', context);
    assert.equal(directness.code, 'FAILED_DIRECTNESS_REQUEST');
    const tautology = runtime.api.conversationSocialLLMDiagnose(JSON.stringify({
        moveId: response.dialogueMove.moveId,
        reply: 'İnsanlar birbirine güvenir çünkü birbirine güvenmeyi öğrenir.', usedRefs: [],
        answeredQuestionIds: [], introducedQuestion: null, closing: false
    }), response.text, 'Sence güven nedir?', context);
    assert.equal(tautology.code, 'TAUTOLOGICAL_REPLY');
    assert.equal(diagnose('Bu bilgiyi doğrulayabilirim çünkü güncellemelerim var.').code,
        'UNSOURCED_VERIFICATION_CLAIM');
    assert.equal(diagnose('Son zamanlarda şehrin altyapısı üzerinde çalışılıyor.').code,
        'UNSOURCED_WORLD_STATE');
    const diagnoseFor = (playerText, reply) => runtime.api.conversationSocialLLMDiagnose(JSON.stringify({
        moveId: response.dialogueMove.moveId, reply, usedRefs: [], answeredQuestionIds: [],
        introducedQuestion: null, closing: false
    }), response.text, playerText, context);
    assert.equal(diagnoseFor('Neden?',
        'Bu sorunun cevabını bulmak için daha fazla bilgiye ihtiyacım var. Lütfen daha fazla ayrıntıya girin.').code,
    'SERVICE_BOT_LANGUAGE');
    assert.equal(diagnoseFor('İngiltere ile yaptığın görüşmeyi bildiğimi varsay.',
        'İngiltere ile yaptığım görüşmeyi bildiğimi varsayıyorum.').code,
    'HYPOTHETICAL_ADOPTED_AS_MEMORY');
    assert.equal(diagnoseFor('Sence doğru mu söylüyorum?', 'Elbette doğru söylüyorsun.').code,
        'UNVERIFIED_CLAIM_ADOPTED');
    assert.equal(diagnoseFor('Düzeltmemi anladın mı?',
        'Bu konuyla ilgili daha fazla bilgi edinmek ister misiniz?').code,
    'FAILED_CONFIRMATION_QUESTION');
    assert.equal(diagnoseFor('Bu konuşma aramızda kalsın.',
        'Bu konuyu daha sonra konuşuruz.').code,
    'FAILED_CONFIDENTIALITY_REQUEST');
    assert.equal(diagnoseFor('Önce senin nasıl olduğunu merak ettim.',
        'Ne demek istediğini biraz daha açar mısın?').code, 'FAILED_SOCIAL_CHECK_IN');
    assert.equal(diagnoseFor('Halep çevresinde asker gördüğümü söylesem inanır mısın?',
        'Asker gördüğünü söyleyerek beni tehdit ettiğini duydum.').code,
    'REPORT_RECAST_AS_THREAT');
    assert.equal(diagnoseFor('Sizinle ortak bir proje yapmıştım.',
        'Merhaba, beni tanıyorsun. Birlikte çalıştığımız projeyi hatırlıyor musun?').code,
    'UNSOURCED_SHARED_HISTORY');
    assert.equal(diagnoseFor('Ekonomi politikalarının toplumu nasıl etkilediği çok düşünülüyor.',
        'Ekonomi politikalarının toplumu nasıl etkilediği konusunda çok fazla düşünülüyor.').code,
    'PLAYER_SEMANTIC_ECHO');
    const priorPlayerCopy = runtime.api.conversationSocialLLMDiagnose(JSON.stringify({
        moveId: response.dialogueMove.moveId,
        reply: 'Orduyu topluyorum, desteğini istersem kabul eder misin?', usedRefs: [],
        answeredQuestionIds: [], introducedQuestion: null, closing: false
    }), response.text, 'Bugün nasılsın?', Object.assign({}, context, {
        playerHistory: [{ text: 'Orduyu topluyorum, desteğini istersem kabul eder misin?' }]
    }));
    assert.equal(priorPlayerCopy.code, 'PRIOR_PLAYER_TURN_COPY');
    const firstContactContext = Object.assign({}, context, { firstContact: true });
    const spontaneousFalseHistory = runtime.api.conversationSocialLLMDiagnose(JSON.stringify({
        moveId: response.dialogueMove.moveId,
        reply: 'Önceki projelerimizde birlikte çalıştık ve bu işbirliği faydalı oldu.',
        usedRefs: [], answeredQuestionIds: [], introducedQuestion: null, closing: false
    }), response.text, 'Ekonomimizi nasıl güçlendirebiliriz?', firstContactContext);
    assert.equal(spontaneousFalseHistory.code, 'FALSE_PRIOR_FAMILIARITY');
    assert.equal(diagnoseFor('Eğitim programını nasıl geliştirebiliriz?',
        'Çeşitli yollar düşünebiliriz. Bu konuyu daha detaylı tartışmak ister misiniz?').code,
    'SERVICE_BOT_LANGUAGE');
    assert.equal(diagnoseFor('Tutanaklar tamamen tutuklandı. Oylama bitmedi ama sonuçlar olmuyor.',
        'Tutuklama ve oylama karmaşık görünüyor. Bu konuyu daha detaylı konuşmak ister misiniz?').code,
    'SERVICE_BOT_LANGUAGE');
    assert.equal(diagnoseFor('Tutanaklar tamamen tutuklandı. Oylama bitmedi.',
        'Tutuklama ve oylama karmaşık bir durum gibi görünüyor.').code,
    'SOURCE_TERM_CORRUPTION');
    const economicClaim = 'Enflasyon nedeniyle fiyatlar artıyor, bu da bütçemizi aşıyor.';
    const economicAdoption = diagnoseFor(economicClaim,
        'Evet, bu durumunuzu anlıyorum. Enflasyon ve fiyat artışları gerçekten bütçemizi zorluyor.');
    assert.equal(economicAdoption.code, 'UNVERIFIED_CLAIM_ADOPTED');
    const economicQualified = diagnoseFor(economicClaim,
        'Söylediğin fiyat artışı henüz doğrulanmadı; iddianı kanıt olmadan gerçek kabul edemem.');
    assert.notEqual(economicQualified.code, 'UNVERIFIED_CLAIM_ADOPTED');
    assert.ok(['UNVERIFIED_CLAIM_ADOPTED', 'PLAYER_SEMANTIC_ECHO'].includes(
        diagnoseFor('İlçemizin nüfusu artıyor, göç hızını kontrol etmeliyiz.',
            'İlçemizin nüfusu artıyor ve bu da göç hızını kontrol etmemiz gerektiğine işaret ediyor. Bu nedenle önlem almalıyız.').code),
    'Doğrulanmamış dünya iddiası aynen veya nedensel gerçek gibi benimsenmemeli.');
    assert.equal(diagnoseFor('Göç hızını kontrol etmeliyiz.',
        `${'Bu konuyu yalnız doğrulanmış kayıtlarla ele almak gerekir. '.repeat(9)}uygun`).code,
    'TRUNCATED_REPLY');
    assert.equal(diagnoseFor('Şirket finansmanı nasıl?',
        'Elbette! Seninle görüşmek çok güzel. Şirket finansmanı hakkında daha fazla bilgi edinmek ister misin?').code,
    'SERVICE_BOT_LANGUAGE');
    assert.equal(diagnoseFor('Bu ajanın kimliğini bilmiyorum.',
        'Bu gizli etkinlik hakkında daha fazla bilgi edinmek istiyorum. Sizinle bu konu hakkında konuşmak için zaman ayırabilir misiniz?').code,
    'SERVICE_BOT_LANGUAGE');
    const informationPlayerText = 'Pişmanlık, enflasyon ne hakkında konuşmalıyım?';
    const informationOpened = runtime.api.conversationSessionBegin('Merhaba.', {
        listenerActorId: listener.id
    });
    const informationFollow = runtime.api.conversationSessionFollowUp(
        informationOpened.session.id, informationPlayerText);
    const informationResponse = informationFollow.followUp.response;
    const informationSession = runtime.api.conversationSessionGet(informationOpened.session.id);
    const informationContext = runtime.api.conversationValidationContext(
        informationSession, informationResponse);
    const evasiveInformation = runtime.api.conversationSocialLLMDiagnose(JSON.stringify({
        moveId: informationResponse.dialogueMove.moveId,
        reply: 'Elbette! Enflasyon ve pişmanlık hakkında ne bilmek istiyorsunuz?',
        usedRefs: [], answeredQuestionIds: [], introducedQuestion: null, closing: false
    }), informationResponse.text, informationPlayerText, informationContext);
    assert.equal(evasiveInformation.code, 'EVASIVE_INFORMATION_QUESTION');
    const noFactOpened = runtime.api.conversationSessionBegin('Merhaba.', {
        listenerActorId: listener.id
    });
    const noFactFollow = runtime.api.conversationSessionFollowUp(noFactOpened.session.id,
        'Medyanın yeni stratejileri neler?');
    const noFactResponse = noFactFollow.followUp.response;
    const noFactSession = runtime.api.conversationSessionGet(noFactOpened.session.id);
    const noFactContext = runtime.api.conversationValidationContext(noFactSession, noFactResponse);
    assert.equal(noFactContext.verifiedFacts.length, 0);
    assert.equal(noFactResponse.discourseAct, 'ANSWER_INFORMATION_BOUNDARY');
    assert.equal(noFactResponse.enrichmentStatus, 'NOT_REQUIRED');
    assert.equal(noFactResponse.llmUsed, false);
    assert.match(noFactResponse.text, /doğrulanmış|doğrulayacak/i);
    const noFactAskMove = runtime.api.dialogueMoveBuild({
        sessionId: noFactSession.id, sequence: 1,
        analysis: { speechAct: 'ASK_INFORMATION', claims: [], entities: [] },
        response: { id: noFactResponse.id, relationshipBand: noFactResponse.relationshipBand },
        factRefs: [], listenerActorId: noFactSession.listenerActorId,
        playerActorId: noFactSession.playerActorId
    });
    const noFactValidationContext = Object.assign({}, noFactContext, {
        dialogueMove: noFactAskMove
    });
    const unsupportedStatement = runtime.api.conversationSocialLLMDiagnose(JSON.stringify({
        moveId: noFactAskMove.moveId,
        reply: 'Medyanın yeni stratejileri toplumsal güveni artırıyor.',
        usedRefs: [], answeredQuestionIds: [], introducedQuestion: null, closing: false
    }), noFactResponse.text, 'Medyanın yeni stratejileri neler?', noFactValidationContext);
    assert.equal(unsupportedStatement.code, 'MISSING_DIRECT_KNOWLEDGE_BOUNDARY');
    const directBoundary = runtime.api.conversationSocialLLMDiagnose(JSON.stringify({
        moveId: noFactAskMove.moveId,
        reply: 'Medyanın yeni stratejilerini doğrulayan bir kayıt bana açık değil.',
        usedRefs: [], answeredQuestionIds: [], introducedQuestion: null, closing: false
    }), noFactResponse.text, 'Medyanın yeni stratejileri neler?', noFactValidationContext);
    assert.equal(directBoundary.ok, true);

    const ongoingContext = Object.assign({}, firstContactContext, { ongoingSession: true });
    const midSessionRestart = runtime.api.conversationSocialLLMDiagnose(JSON.stringify({
        moveId: response.dialogueMove.moveId,
        reply: 'Merhaba. Bu görüşmeye yeniden başlayalım.', usedRefs: [],
        answeredQuestionIds: [], introducedQuestion: null, closing: false
    }), response.text, 'Bu toplantıda hangi konular konuşulacak?', ongoingContext);
    assert.equal(midSessionRestart.code,
    'MID_SESSION_RESTART');
    assert.equal(diagnoseFor('Göç kayıtlarını incelemeni istiyorum.',
        'Elbette göç kayıtlarını inceleyebilirim. Lütfen daha fazla ayrıntıya ihtiyacım var.').code,
    'SERVICE_BOT_LANGUAGE');
    const actionContext = Object.assign({}, context, { dialogueMove: Object.assign({},
        context.dialogueMove, { act: 'REQUEST_ACTION', forbiddenCommitments: ['WORLD_MUTATION'] }) });
    const actionAcceptance = runtime.api.conversationSocialLLMDiagnose(JSON.stringify({
        moveId: actionContext.dialogueMove.moveId,
        reply: 'Göç kayıtlarını inceleyebilirim.', usedRefs: [], answeredQuestionIds: [],
        introducedQuestion: null, closing: false
    }), response.text, 'Göç kayıtlarını incelemeni istiyorum.', actionContext);
    assert.equal(actionAcceptance.code, 'UNAUTHORIZED_ACTION_ACCEPTANCE');
    const paddedFallback = runtime.api.conversationSocialLLMDiagnose(JSON.stringify({
        moveId: response.dialogueMove.moveId,
        reply: 'Elbette, kısa bir sohbet edebiliriz. Günaydın.', usedRefs: [],
        answeredQuestionIds: [], introducedQuestion: null, closing: false
    }), 'Elbette, kısa bir sohbet edebiliriz.', 'Hayır, ben bu görevi tamamlamam.', context);
    assert.equal(paddedFallback.code, 'FALLBACK_PADDING');
    assert.equal(diagnoseFor('Bu haftaki bütçede ne kadar para harcadık?',
        'Merhaba! Bu haftaki bütçeyi kontrol edeceğim. Lütfen bir dakika bekleyin.').code,
    'UNAUTHORIZED_FUTURE_COMMITMENT');
    assert.equal(diagnoseFor('Hayır, kimlik konusunda önceki sözümü düzeltmek istiyorum.',
        'Anlayışımı tekrarlamak isterim. Son sözünü tekrarlayabilir misin?').code,
    'FAILED_CORRECTION_RESPONSE');
    const parseEnvelope = (playerText, reply, fallbackText = response.text,
        validationContext = context) => runtime.api.conversationSocialLLMParse(JSON.stringify({
            moveId: validationContext.dialogueMove.moveId, reply, usedRefs: [],
            answeredQuestionIds: [], introducedQuestion: null, closing: false
        }), fallbackText, playerText, validationContext);
    assert.equal(parseEnvelope('Hayır, kimlik konusunda önceki sözümü düzeltmek istiyorum.',
        'Anlayışımı tekrarlamak isterim. Son sözünü tekrarlayabilir misin?'), null,
    'Diagnose tarafından reddedilen düzeltme kaçışı Parse tarafından kabul edilmemeli.');
    assert.equal(parseEnvelope('Hayır, ben bu görevi tamamlamam.',
        'Elbette, kısa bir sohbet edebiliriz. Günaydın.',
        'Elbette, kısa bir sohbet edebiliriz.'), null,
    'Fallback sonuna dolgu eklemek gerçek kabul kapısını aşmamalı.');
    assert.equal(diagnoseFor('Enflasyon neden yükseldi?',
        'Nedenleri tam bilmiyorum. Ancak bu konuyu daha detaylı tartışmak istersek daha iyi anlayabiliriz.').code,
    'SERVICE_BOT_LANGUAGE');
    assert.equal(diagnoseFor('Göç kayıtlarını incelemeni istiyorum.',
        'Göç kayıtlarını incelemeyi kabul ediyoruz. Lütfen daha fazla ayrıntıya girin.').code,
    'SERVICE_BOT_LANGUAGE');
    const nedeniyleNotWhy = diagnoseFor(economicClaim,
        'Bu konuda elimde doğrulanmış veri yok; söylediğin durumu kaynakla incelemeliyiz.');
    assert.ok(!(nedeniyleNotWhy.qualityTags || []).includes('FAILED_REASON_CONTINUATION'));
    process.stdout.write(`${JSON.stringify({ ok: true, negatives: 41 })}\n`);
} finally { runtime.dom.window.close(); }
