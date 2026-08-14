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
    const nedeniyleNotWhy = diagnoseFor(economicClaim,
        'Bu konuda elimde doğrulanmış veri yok; söylediğin durumu kaynakla incelemeliyiz.');
    assert.ok(!(nedeniyleNotWhy.qualityTags || []).includes('FAILED_REASON_CONTINUATION'));
    process.stdout.write(`${JSON.stringify({ ok: true, negatives: 29 })}\n`);
} finally { runtime.dom.window.close(); }
