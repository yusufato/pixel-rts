// ============================================================================
//  BİLEŞİMSEL SOHBET ANLAMI — SemanticFrameV2
//  --------------------------------------------------------------------------
//  Bu katman cümle ezberlemez. Sonlu anlam eksenlerini ayrı ayrı çıkarır ve
//  bunların çarpımından bir konuşma hareketi adayı üretir. Sözcük kökleri bir
//  ontolojiyi işaretler; tam cümleler yalnız test verisidir. Çerçeve dünya
//  gerçeği, sayı, yetki veya komut üretemez.
// ============================================================================

const STORY_SEMANTIC_FRAME_SCHEMA_VERSION = 2;
const STORY_SEMANTIC_FRAME_SOURCE = 'DETERMINISTIC_COMPOSITIONAL_FRAME';
const STORY_SEMANTIC_MODEL_FUNCTIONS = Object.freeze([
    'ASK', 'TELL', 'REQUEST', 'OFFER', 'REJECT', 'CONFIDE', 'CORRECT',
    'REPAIR', 'CLOSE', 'GREET', 'THANK', 'APOLOGIZE', 'UNRESOLVED'
]);
const STORY_SEMANTIC_MODEL_SURFACE_FORMS = Object.freeze([
    'INTERROGATIVE', 'DECLARATIVE', 'IMPERATIVE', 'EXCLAMATORY', 'FRAGMENT'
]);
const STORY_SEMANTIC_MODEL_PREDICATES = Object.freeze([
    'IDENTITY', 'HEALTH', 'EMOTION', 'RELATIONSHIP', 'WORK', 'SECRET',
    'TECHNOLOGY', 'MILITARY', 'ECONOMY', 'LOCATION', 'WEATHER', 'OPINION',
    'UNSPECIFIED'
]);
const STORY_SEMANTIC_MODEL_TARGETS = Object.freeze([
    'PLAYER', 'LISTENER', 'PLAYER_AND_LISTENER', 'THIRD_PARTY',
    'ORGANIZATION', 'WORLD', 'UNSPECIFIED'
]);
const STORY_SEMANTIC_MODEL_POLARITIES = Object.freeze([
    'POSITIVE_OR_UNMARKED', 'NEGATIVE', 'MIXED'
]);
const STORY_SEMANTIC_MODEL_TIMES = Object.freeze([
    'PAST', 'CURRENT_OR_UNMARKED', 'FUTURE', 'HABITUAL'
]);
const STORY_SEMANTIC_MODEL_EPISTEMICS = Object.freeze([
    'UNMARKED', 'HEARSAY', 'HYPOTHETICAL', 'CLAIMED_CERTAIN', 'QUESTIONED'
]);
const STORY_SEMANTIC_MODEL_CONTINUITIES = Object.freeze([
    'NEW_OR_UNMARKED', 'CONTINUATION', 'CORRECTION', 'REPAIR', 'ANSWER'
]);
const STORY_SEMANTIC_MODEL_OUTCOMES = Object.freeze([
    'INFORMATION', 'ACTION', 'OPINION', 'REFERRAL', 'CONFIDENTIAL_HANDLING',
    'ACKNOWLEDGEMENT', 'NONE'
]);

const STORY_SEMANTIC_PREDICATES = Object.freeze({
    IDENTITY: ['kim', 'ad', 'isim', 'kimlik', 'unvan', 'rol'],
    HEALTH: ['saglik', 'sagli', 'hasta', 'rahatsiz', 'hisset'],
    EMOTION: ['sinir', 'kizgin', 'uzul', 'kiril', 'mutlu', 'kork', 'endise',
        'heyecan', 'kaygi', 'gergin'],
    RELATIONSHIP: ['guven', 'ilisk', 'sadakat', 'dost', 'husumet', 'itibar'],
    WORK: ['gorev', 'is', 'calis', 'ihtiyac', 'yardim', 'destek', 'gelistir'],
    SECRET: ['sir', 'gizli', 'mahrem', 'aramiz', 'sifre', 'anahtar', 'kimsenin', 'sakli', 'muhbir'],
    TECHNOLOGY: ['teknoloji', 'arastir', 'yapayzeka', 'otomasyon', 'bilim'],
    MILITARY: ['ordu', 'asker', 'birlik', 'dusman', 'cephe', 'savas', 'savun', 'saldir'],
    ECONOMY: ['ekonomi', 'hazine', 'butce', 'enflasyon', 'fiyat', 'piyasa', 'borc', 'ticaret',
        'issizlik', 'bugday', 'liman', 'bakim', 'sozlesme', 'gelir', 'dinar', 'gumruk',
        'fabrika', 'vardiya'],
    LOCATION: ['nerede', 'konum', 'sehir', 'bolge', 'bulun'],
    WEATHER: ['hava', 'yagmur', 'sicak', 'soguk'],
    OPINION: ['fikir', 'gorus', 'dusun', 'sence']
});

function storySemanticFrameTokens(raw) {
    const folded = typeof storyConversationFold === 'function'
        ? storyConversationFold(raw) : String(raw || '').toLocaleLowerCase('tr-TR');
    return folded ? folded.split(/\s+/).filter(Boolean) : [];
}

function storySemanticFrameRootMatches(tokens, root) {
    const blocked = {
        is: new Set(['istanbul']),
        birlik: new Set(['birlikte']),
        ver: new Set(['verici', 'verimli', 'verim', 'vergi'])
    };
    const shortSuffixes = new Set([
        'i', 'ı', 'u', 'ü', 'in', 'ın', 'un', 'ün', 'e', 'a', 'de', 'da',
        'den', 'dan', 'ler', 'lar', 'im', 'ım', 'um', 'üm', 'imiz', 'ımız',
        'umuz', 'ümüz', 'mek', 'mak', 'iyor', 'ıyor', 'uyor', 'üyor', 'di',
        'dı', 'du', 'dü', 'mis', 'mış', 'muş', 'müş', 'ecek', 'acak', 'eceg',
        'acag', 'meli', 'malı', 'meliyiz', 'malıyız', 'sin', 'sın', 'sun',
        'sün', 'siniz', 'sınız', 'sunuz', 'sünüz', 'yiz', 'yız', 'yuz', 'yüz'
    ]);
    return tokens.filter(token => {
        if (token === root) return true;
        if (blocked[root] && blocked[root].has(token)) return false;
        if (!token.startsWith(root)) return false;
        if (root.length >= 4) return true;
        return shortSuffixes.has(token.slice(root.length));
    });
}

function storySemanticFrameEvidence(tokens, roots) {
    const result = [];
    for (const root of roots || []) {
        for (const token of storySemanticFrameRootMatches(tokens, root)) {
            if (!result.includes(token)) result.push(token);
        }
    }
    return result;
}

function storySemanticFrameHas(tokens, roots) {
    return storySemanticFrameEvidence(tokens, roots).length > 0;
}

function storySemanticFrameQuestionEvidence(tokens) {
    const particleEvidence = storySemanticFrameEvidence(tokens,
        ['mi', 'mı', 'mu', 'mü', 'miyim', 'mıyım', 'muyum', 'müyüm']);
    const questionWordPatterns = [
        /^kim(?:e|i|in|den|le|dir)?$/,
        /^ne(?:dir|yi|ye|yle)?$/,
        /^neden$/,
        /^nasil(?:sin|siniz|di|mis)?$/,
        /^nere(?:de|den|ye)(?:dir)?$/,
        /^hangi(?:si|sini|sine|sinden)?$/,
        /^kac(?:i|a|tan|tir|inci)?$/
    ];
    const wordEvidence = tokens.filter(token =>
        questionWordPatterns.some(pattern => pattern.test(token)));
    return particleEvidence.concat(wordEvidence)
        .filter((value, index, all) => all.indexOf(value) === index);
}

function storySemanticFramePredicate(tokens) {
    const candidates = Object.entries(STORY_SEMANTIC_PREDICATES).map(([id, roots]) => {
        const evidence = storySemanticFrameEvidence(tokens, roots);
        return { id, evidence, score: evidence.length * 2600 };
    }).filter(row => row.score > 0)
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id, 'en'));
    return {
        primary: candidates[0] ? candidates[0].id : 'UNSPECIFIED',
        secondary: candidates.slice(1, 4).map(row => row.id),
        evidence: candidates.flatMap(row => row.evidence).filter((value, index, all) => all.indexOf(value) === index),
        score: candidates[0] ? Math.min(3600, candidates[0].score) : 0
    };
}

function storySemanticFrameTarget(tokens) {
    const playerEvidence = storySemanticFrameEvidence(tokens,
        ['ben', 'bana', 'beni', 'benim', 'benden', 'biz', 'bize', 'bizim']);
    const listenerEvidence = storySemanticFrameEvidence(tokens,
        ['sen', 'sana', 'seni', 'senin', 'senden', 'siz', 'size', 'sizi', 'sizin', 'sizden']);
    for (const token of tokens) {
        if (token.length >= 6 && /(?:iniz|inizin|niz|nizin)$/.test(token)
            && !listenerEvidence.includes(token)) listenerEvidence.push(token);
    }
    if (playerEvidence.length && listenerEvidence.length) return {
        value: 'PLAYER_AND_LISTENER', evidence: playerEvidence.concat(listenerEvidence), score: 1300
    };
    if (listenerEvidence.length) return { value: 'LISTENER', evidence: listenerEvidence, score: 1100 };
    if (playerEvidence.length) return { value: 'PLAYER', evidence: playerEvidence, score: 1100 };
    return { value: 'UNSPECIFIED', evidence: [], score: 0 };
}

function storySemanticFrameFunction(raw, tokens, predicate) {
    const questionEvidence = storySemanticFrameQuestionEvidence(tokens);
    const closeEvidence = storySemanticFrameEvidence(tokens,
        ['gorus', 'hosca', 'gule', 'ayril', 'gidiyor', 'doneceg']);
    const greetingEvidence = storySemanticFrameEvidence(tokens,
        ['selam', 'merhaba', 'gunaydin']);
    const thanksEvidence = storySemanticFrameEvidence(tokens, ['tesekkur', 'sagol', 'minnettar']);
    const apologyEvidence = storySemanticFrameEvidence(tokens, ['ozur', 'affet', 'kusura']);
    const requestEvidence = storySemanticFrameEvidence(tokens,
        ['ver', 'yap', 'gonder', 'yonlendir', 'baslat', 'artir', 'getir', 'bosalt',
            'ode', 'cagir', 'dondur', 'ister', 'istiyor', 'rica', 'lazim', 'gerekiyor']);
    const offerEvidence = storySemanticFrameEvidence(tokens,
        ['ederim', 'olurum', 'sunarim', 'sunuyor', 'sagliyorum', 'teklif', 'oner']);
    const rejectEvidence = storySemanticFrameEvidence(tokens,
        ['reddet', 'istemiyorum', 'kabul', 'olmaz']);
    const predicateIds = new Set([predicate.primary].concat(predicate.secondary || []));
    const secretEvidence = predicateIds.has('SECRET') ? predicate.evidence : [];
    const confideEvidence = storySemanticFrameEvidence(tokens,
        ['kalsin', 'soyleme', 'paylas', 'vereceg', 'anlat', 'goster', 'emanet', 'sirrim',
            'bilgim', 'yalniz', 'kimsenin']);
    const restrictedAudienceEvidence = storySemanticFrameEvidence(tokens, ['yalniz', 'sadece']);
    const disclosureEvidence = storySemanticFrameEvidence(tokens,
        ['anlat', 'soyle', 'paylas', 'ver', 'goster', 'emanet']);
    const negatedDisclosureEvidence = tokens.filter(token =>
        /^(?:anlat|soyle|paylas|ver|goster|emanet).*(?:amam|emem|mayac|meyece|mam|mem|maz|mez)/
            .test(token));
    const modalAbilityEvidence = tokens.filter(token => /(?:abil|ebil)/.test(token));
    const firstPersonAbilityEvidence = modalAbilityEvidence.filter(token =>
        /(?:abilirim|ebilirim)$/.test(token));
    const conditionalThreatEvidence = tokens.filter(token => token === 'yoksa'
        || /(?:mazsan|mezsen|mazsaniz|mezseniz|mazsiniz|mezsiniz)$/.test(token));
    const inclusiveQuestionEvidence = storySemanticFrameEvidence(tokens,
        ['miyiz', 'mıyız', 'muyuz', 'müyüz']);
    const hasActionPredicate = ['WORK', 'MILITARY', 'ECONOMY', 'TECHNOLOGY']
        .some(id => predicateIds.has(id));
    if (closeEvidence.length) return { value: 'CLOSE', evidence: closeEvidence, score: 3300 };
    if (greetingEvidence.length) return { value: 'GREET', evidence: greetingEvidence, score: 3300 };
    if (thanksEvidence.length) return { value: 'THANK', evidence: thanksEvidence, score: 3300 };
    if (apologyEvidence.length) return { value: 'APOLOGIZE', evidence: apologyEvidence, score: 3300 };
    if (rejectEvidence.length && storySemanticFrameHas(tokens, ['degil', 'hayir', 'reddet', 'istemiyorum'])) {
        return { value: 'REJECT', evidence: rejectEvidence, score: 3000 };
    }
    if (conditionalThreatEvidence.length) {
        return { value: 'TELL', requestedOutcome: 'ACTION',
            evidence: conditionalThreatEvidence, score: 3300 };
    }
    if (!questionEvidence.length && !negatedDisclosureEvidence.length
        && ((secretEvidence.length && confideEvidence.length)
        || (restrictedAudienceEvidence.length && disclosureEvidence.length))) {
        return { value: 'CONFIDE', evidence: secretEvidence.concat(confideEvidence,
            restrictedAudienceEvidence, disclosureEvidence)
            .filter((value, index, all) => all.indexOf(value) === index), score: 2800 };
    }
    if (questionEvidence.length && modalAbilityEvidence.length
        && inclusiveQuestionEvidence.length
        && hasActionPredicate) {
        return { value: 'OFFER', evidence: modalAbilityEvidence.concat(inclusiveQuestionEvidence), score: 3200 };
    }
    if (questionEvidence.length && modalAbilityEvidence.length
        && hasActionPredicate) {
        return { value: 'REQUEST', evidence: modalAbilityEvidence.concat(questionEvidence), score: 3200 };
    }
    if (requestEvidence.length) {
        return { value: 'REQUEST', evidence: requestEvidence, score: 3100 };
    }
    if (!questionEvidence.length && firstPersonAbilityEvidence.length) {
        return { value: 'OFFER', evidence: firstPersonAbilityEvidence, score: 2900 };
    }
    if (offerEvidence.length) return { value: 'OFFER', evidence: offerEvidence, score: 2700 };
    if (String(raw || '').includes('?') || questionEvidence.length) {
        return { value: 'ASK', evidence: questionEvidence, score: 3000 };
    }
    return { value: 'TELL', evidence: [], score: predicate.primary === 'UNSPECIFIED' ? 0 : 1800 };
}

function storySemanticFrameSurfaceForm(raw, tokens) {
    const text = String(raw || '').trim();
    const questionEvidence = storySemanticFrameQuestionEvidence(tokens);
    if (text.includes('?') || questionEvidence.length) return { value: 'INTERROGATIVE', evidence: questionEvidence };
    if (text.endsWith('!')) return { value: 'EXCLAMATORY', evidence: ['!'] };
    if (storySemanticFrameHas(tokens, ['yap', 'ver', 'git', 'gel', 'gonder', 'bekle', 'dur'])) {
        return { value: 'IMPERATIVE', evidence: storySemanticFrameEvidence(tokens,
            ['yap', 'ver', 'git', 'gel', 'gonder', 'bekle', 'dur']) };
    }
    if (tokens.length <= 2) return { value: 'FRAGMENT', evidence: tokens.slice() };
    return { value: 'DECLARATIVE', evidence: [] };
}

function storySemanticFramePolarity(tokens) {
    const evidence = storySemanticFrameEvidence(tokens,
        ['degil', 'yok', 'hic', 'istemiyor', 'guvenmiyor', 'bilmiyor']);
    return { value: evidence.length ? 'NEGATIVE' : 'POSITIVE_OR_UNMARKED', evidence };
}

function storySemanticFrameTime(tokens) {
    const past = storySemanticFrameEvidence(tokens, ['dun', 'once', 'gecmis', 'yapti', 'oldu', 'gordum', 'duydum']);
    const future = storySemanticFrameEvidence(tokens, ['yarin', 'sonra', 'gelecek', 'yapacag', 'edeceg', 'doneceg']);
    const habitual = storySemanticFrameEvidence(tokens, ['genelde', 'surekli', 'herzaman', 'bazen']);
    if (past.length) return { value: 'PAST', evidence: past };
    if (future.length) return { value: 'FUTURE', evidence: future };
    if (habitual.length) return { value: 'HABITUAL', evidence: habitual };
    return { value: 'CURRENT_OR_UNMARKED', evidence: [] };
}

function storySemanticFrameEpistemic(tokens) {
    const rumor = storySemanticFrameEvidence(tokens, ['duydum', 'soylenti', 'deniyor', 'galiba', 'sanirim']);
    const hypothetical = storySemanticFrameEvidence(tokens, ['eger', 'varsay', 'olursa', 'belki']);
    const certainty = storySemanticFrameEvidence(tokens, ['biliyorum', 'eminim', 'kesin']);
    if (rumor.length) return { value: 'HEARSAY', evidence: rumor };
    if (hypothetical.length) return { value: 'HYPOTHETICAL', evidence: hypothetical };
    if (certainty.length) return { value: 'CLAIMED_CERTAIN', evidence: certainty };
    return { value: 'UNMARKED', evidence: [] };
}

function storySemanticFrameContinuity(tokens) {
    const correction = storySemanticFrameEvidence(tokens, ['hayir', 'yanlis', 'aslinda', 'duzelt']);
    const repair = storySemanticFrameEvidence(tokens, ['anlamadim', 'tekrar', 'acikla', 'ne demek']);
    const continuation = storySemanticFrameEvidence(tokens, ['peki', 'tamam', 'ayrica', 'oyle ise', 'neden']);
    if (correction.length) return { value: 'CORRECTION', evidence: correction };
    if (repair.length) return { value: 'REPAIR', evidence: repair };
    if (continuation.length) return { value: 'CONTINUATION', evidence: continuation };
    return { value: 'NEW_OR_UNMARKED', evidence: [] };
}

function storySemanticFrameSpeechAct(frame) {
    const fn = frame.communicativeFunction;
    const predicate = frame.predicate;
    if (fn === 'CLOSE') return 'FAREWELL';
    if (fn === 'GREET') return 'GREETING';
    if (fn === 'THANK') return 'THANK';
    if (fn === 'APOLOGIZE') return 'APOLOGIZE';
    if (fn === 'CORRECT') return 'CORRECT_STATEMENT';
    if (fn === 'REPAIR') return 'CHALLENGE';
    if (fn === 'REJECT') return 'REJECT';
    if (fn === 'CONFIDE') return 'SHARE_SECRET';
    if (fn === 'OFFER' && predicate === 'WORK') return 'OFFER_SUPPORT';
    if (fn === 'OFFER' && predicate === 'ECONOMY') return 'PROPOSE_COMMERCIAL_DEAL';
    if (fn === 'TELL' && frame.requestedOutcome === 'ACTION') return 'THREATEN';
    if (fn === 'REQUEST' && predicate === 'WORK') return 'REQUEST_ACTION';
    if (fn === 'REQUEST' && predicate === 'MILITARY') return 'REQUEST_SUPPORT';
    if (fn === 'REQUEST' && ['ECONOMY', 'TECHNOLOGY'].includes(predicate)) return 'REQUEST_ACTION';
    if (fn === 'REQUEST' && frame.requestedOutcome === 'ACTION') return 'REQUEST_ACTION';
    if (fn === 'ASK' && ['RELATIONSHIP', 'EMOTION'].includes(predicate)) return 'ASK_RELATIONSHIP';
    if (fn === 'ASK' && (predicate === 'OPINION' || frame.secondaryPredicates.includes('OPINION'))) {
        return 'ASK_PERSONAL_OPINION';
    }
    if (fn === 'ASK') return 'ASK_INFORMATION';
    if (fn === 'TELL' && predicate === 'MILITARY') return 'REPORT_MILITARY';
    if (fn === 'TELL' && predicate === 'ECONOMY') return 'REPORT_ECONOMIC';
    if (fn === 'TELL' && ['HEALTH', 'EMOTION', 'RELATIONSHIP', 'WEATHER'].includes(predicate)) return 'SMALL_TALK';
    return 'UNKNOWN';
}

function storyConversationSemanticFrameNeedsModel(analysis) {
    const frame = analysis && analysis.semanticFrame;
    if (!analysis || !analysis.ok || !frame) return false;
    if (typeof storyFeatureEnabled === 'function'
        && !storyFeatureEnabled('characters.semanticModelInterpretation')) return false;
    if (analysis.riskLevel === 'HIGH') return false;
    return analysis.speechAct === 'UNKNOWN' || Number(frame.confidenceBps) < 5200;
}

function storyConversationSemanticFrameModelSchema() {
    const enumField = values => ({ type: 'string', enum: values.slice() });
    return {
        type: 'object', additionalProperties: false,
        properties: {
            candidates: {
                type: 'array', minItems: 1, maxItems: 1,
                items: {
                    type: 'object', additionalProperties: false,
                    properties: {
                        communicativeFunction: enumField(STORY_SEMANTIC_MODEL_FUNCTIONS),
                        surfaceForm: enumField(STORY_SEMANTIC_MODEL_SURFACE_FORMS),
                        predicate: enumField(STORY_SEMANTIC_MODEL_PREDICATES),
                        target: enumField(STORY_SEMANTIC_MODEL_TARGETS),
                        polarity: enumField(STORY_SEMANTIC_MODEL_POLARITIES),
                        temporality: enumField(STORY_SEMANTIC_MODEL_TIMES),
                        epistemicStatus: enumField(STORY_SEMANTIC_MODEL_EPISTEMICS),
                        continuity: enumField(STORY_SEMANTIC_MODEL_CONTINUITIES),
                        requestedOutcome: enumField(STORY_SEMANTIC_MODEL_OUTCOMES),
                        evidenceSpans: {
                            type: 'array', minItems: 1, maxItems: 8,
                            items: {
                                type: 'object', additionalProperties: false,
                                properties: {
                                    axis: enumField(['FUNCTION', 'PREDICATE', 'TARGET',
                                        'POLARITY', 'TIME', 'EPISTEMIC', 'CONTINUITY']),
                                    quote: { type: 'string', minLength: 1, maxLength: 80 }
                                },
                                required: ['axis', 'quote']
                            }
                        }
                    },
                    required: ['communicativeFunction', 'surfaceForm', 'predicate', 'target',
                        'polarity', 'temporality', 'epistemicStatus', 'continuity',
                        'requestedOutcome', 'evidenceSpans']
                }
            }
        },
        required: ['candidates']
    };
}

function storyConversationSemanticFrameModelPrompt(raw, context) {
    const history = (context && context.history || []).slice(-6).map(row => ({
        speaker: row && row.speaker === 'CHARACTER' ? 'CHARACTER' : 'PLAYER',
        text: String(row && row.text || '').slice(0, 320)
    }));
    return `GÖREV: Son PLAYER sözünü cevaplama; yalnız TEK en iyi semantik çerçeveyi çıkar.\n`
        + `ALANLAR:\n`
        + `- communicativeFunction: ASK=soru, TELL=bildirim, REQUEST=eylem isteği, OFFER=teklif, REJECT=ret, CONFIDE=gizli paylaşım, CORRECT=düzeltme, REPAIR=anlaşılmama onarımı, CLOSE=veda, GREET=selam.\n`
        + `- surfaceForm yalnız dilbilgisel biçimdir: INTERROGATIVE=soru biçimi, DECLARATIVE=bildirim, IMPERATIVE=emir/istek, EXCLAMATORY=ünlem, FRAGMENT=eksik parça.\n`
        + `- communicativeFunction gerçek pragmatik amaçtır. “Yarın burada olabilir misin?” surfaceForm=INTERROGATIVE fakat communicativeFunction=REQUEST ve requestedOutcome=ACTION olur.\n`
        + `- predicate: IDENTITY=kimlik/rol, HEALTH=sağlık, EMOTION=duygu, RELATIONSHIP=ilişki/güven/tavır, WORK=iş/görev/sorumluluk, SECRET=gizlilik, TECHNOLOGY, MILITARY, ECONOMY, LOCATION, WEATHER, OPINION.\n`
        + `- target: PLAYER=oyuncu, LISTENER=konuşulan karakter, PLAYER_AND_LISTENER=ikisi, THIRD_PARTY=üçüncü kişi, ORGANIZATION=kurum.\n`
        + `ÖRNEK AYRIŞTIRMALAR:\n`
        + `“Bana kızgın mısınız?” => ASK + EMOTION + LISTENER + INFORMATION. Kanıt: FUNCTION “mısınız”, PREDICATE “kızgın”, TARGET “Bana”.\n`
        + `“Yarın yapabileceğim bir iş var mı?” => REQUEST + WORK + PLAYER + ACTION. Kanıt: FUNCTION “var mı”, PREDICATE “iş”, TIME “Yarın”.\n`
        + `“Bu aramızda kalsın.” => CONFIDE + SECRET + PLAYER_AND_LISTENER + CONFIDENTIAL_HANDLING. Kanıt: FUNCTION “kalsın”, PREDICATE “aramızda”.\n`
        + `Kurallar:\n- Tam cümle ezberleme. İletişim işlevi, konu, hedef, zaman, olumsuzluk ve bağlamı ayrı değerlendir.\n`
        + `- candidates dizisinde tam 1 aday üret. Emin değilsen UNRESOLVED/UNSPECIFIED kullan.\n`
        + `- evidenceSpans içinde FUNCTION ve PREDICATE ayrı kısa alıntılarla kanıtlanmalı.\n`
        + `- evidenceSpans.quote yalnız SON_PLAYER_TEXT içinde birebir bulunan kısa alıntı olmalı; tüm cümleyi her alana kopyalama.\n`
        + `- Dünya gerçeği, karakter bilgisi, görev varlığı, sayı, karar veya komut üretme.\n`
        + `ÖNCEKİ_GÖRÜNÜR_TURLAR=${JSON.stringify(history)}\n`
        + `SON_PLAYER_TEXT=${JSON.stringify(String(raw || ''))}`;
}

function storyConversationSemanticFrameModelCandidate(raw, candidate) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
    const allowedKeys = new Set(['communicativeFunction', 'surfaceForm', 'predicate', 'target', 'polarity',
        'temporality', 'epistemicStatus', 'continuity', 'requestedOutcome', 'evidenceSpans']);
    if (Object.keys(candidate).some(key => !allowedKeys.has(key))) return null;
    const enums = [
        ['communicativeFunction', STORY_SEMANTIC_MODEL_FUNCTIONS],
        ['surfaceForm', STORY_SEMANTIC_MODEL_SURFACE_FORMS],
        ['predicate', STORY_SEMANTIC_MODEL_PREDICATES],
        ['target', STORY_SEMANTIC_MODEL_TARGETS],
        ['polarity', STORY_SEMANTIC_MODEL_POLARITIES],
        ['temporality', STORY_SEMANTIC_MODEL_TIMES],
        ['epistemicStatus', STORY_SEMANTIC_MODEL_EPISTEMICS],
        ['continuity', STORY_SEMANTIC_MODEL_CONTINUITIES],
        ['requestedOutcome', STORY_SEMANTIC_MODEL_OUTCOMES]
    ];
    if (enums.some(([key, values]) => !values.includes(candidate[key]))) return null;
    const spans = Array.isArray(candidate.evidenceSpans) ? candidate.evidenceSpans : [];
    if (!spans.length || spans.length > 8) return null;
    const foldedRaw = typeof storyConversationFold === 'function'
        ? storyConversationFold(raw) : String(raw || '').toLocaleLowerCase('tr-TR');
    const validSpans = [];
    for (const span of spans) {
        if (!span || typeof span !== 'object' || Array.isArray(span)
            || Object.keys(span).some(key => !['axis', 'quote'].includes(key))
            || !['FUNCTION', 'PREDICATE', 'TARGET', 'POLARITY', 'TIME',
                'EPISTEMIC', 'CONTINUITY'].includes(span.axis)) return null;
        const quote = String(span && span.quote || '').trim();
        const foldedQuote = typeof storyConversationFold === 'function'
            ? storyConversationFold(quote) : quote.toLocaleLowerCase('tr-TR');
        if (!quote || quote.length > 80 || !foldedQuote || !foldedRaw.includes(foldedQuote)) return null;
        validSpans.push({ axis: String(span.axis), quote });
    }
    if (candidate.communicativeFunction === 'UNRESOLVED'
        || candidate.predicate === 'UNSPECIFIED') return null;
    if (candidate.communicativeFunction === 'CONFIDE' && candidate.predicate !== 'SECRET') return null;
    if (candidate.communicativeFunction === 'REQUEST'
        && !['ACTION', 'REFERRAL'].includes(candidate.requestedOutcome)) return null;
    if (candidate.communicativeFunction === 'ASK'
        && !['INFORMATION', 'OPINION'].includes(candidate.requestedOutcome)) return null;
    if (candidate.communicativeFunction === 'ASK'
        && candidate.epistemicStatus !== 'QUESTIONED') return null;
    if (candidate.communicativeFunction === 'OFFER'
        && !['ACTION', 'CONFIDENTIAL_HANDLING', 'NONE'].includes(candidate.requestedOutcome)) return null;
    if (candidate.communicativeFunction === 'TELL'
        && !['ACKNOWLEDGEMENT', 'NONE'].includes(candidate.requestedOutcome)) return null;
    if (candidate.communicativeFunction === 'CORRECT'
        && !['ACKNOWLEDGEMENT', 'NONE'].includes(candidate.requestedOutcome)) return null;
    if (candidate.predicate === 'SECRET'
        && !['CONFIDE', 'ASK', 'TELL', 'REQUEST'].includes(candidate.communicativeFunction)) return null;
    const independentAxes = new Set(validSpans.map(row => row.axis));
    const independentQuotes = new Set(validSpans.map(row => storyConversationFold(row.quote)));
    if (!independentAxes.has('FUNCTION') || !independentAxes.has('PREDICATE')
        || independentQuotes.size < 2) return null;
    const frame = {
        schemaVersion: STORY_SEMANTIC_FRAME_SCHEMA_VERSION,
        source: 'LOCAL_LLM_SEMANTIC_CANDIDATE',
        communicativeFunction: candidate.communicativeFunction,
        surfaceForm: candidate.surfaceForm,
        predicate: candidate.predicate,
        secondaryPredicates: [], target: candidate.target,
        polarity: candidate.polarity, temporality: candidate.temporality,
        epistemicStatus: candidate.epistemicStatus, continuity: candidate.continuity,
        requestedOutcome: candidate.requestedOutcome,
        evidence: { modelSpans: validSpans },
        confidenceBps: Math.min(8200, 5000 + independentAxes.size * 700 + validSpans.length * 150),
        listenerActorId: null, worldMutation: false, proposedCommand: null
    };
    frame.suggestedSpeechAct = storySemanticFrameSpeechAct(frame);
    return frame.suggestedSpeechAct === 'UNKNOWN' ? null : frame;
}

function storyConversationSemanticFrameModelParse(rawOutput, playerText) {
    let parsed;
    try { parsed = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : rawOutput; } catch (_) { return null; }
    const candidates = parsed && Array.isArray(parsed.candidates) ? parsed.candidates : [];
    const frames = candidates.map(row => storyConversationSemanticFrameModelCandidate(playerText, row)).filter(Boolean)
        .sort((a, b) => b.confidenceBps - a.confidenceBps
            || a.suggestedSpeechAct.localeCompare(b.suggestedSpeechAct, 'en'));
    return frames[0] || null;
}

function storyConversationSemanticFrameCompile(raw, context) {
    const tokens = storySemanticFrameTokens(raw);
    const predicate = storySemanticFramePredicate(tokens);
    const target = storySemanticFrameTarget(tokens);
    const communicative = storySemanticFrameFunction(raw, tokens, predicate);
    const surfaceForm = storySemanticFrameSurfaceForm(raw, tokens);
    const polarity = storySemanticFramePolarity(tokens);
    const temporality = storySemanticFrameTime(tokens);
    const epistemic = storySemanticFrameEpistemic(tokens);
    const continuity = storySemanticFrameContinuity(tokens);
    const frame = {
        schemaVersion: STORY_SEMANTIC_FRAME_SCHEMA_VERSION,
        source: STORY_SEMANTIC_FRAME_SOURCE,
        communicativeFunction: communicative.value,
        surfaceForm: surfaceForm.value,
        predicate: predicate.primary,
        secondaryPredicates: predicate.secondary,
        target: target.value,
        polarity: polarity.value,
        temporality: temporality.value,
        epistemicStatus: epistemic.value,
        continuity: continuity.value,
        requestedOutcome: communicative.requestedOutcome
            || (communicative.value === 'ASK' ? 'INFORMATION'
            : communicative.value === 'REQUEST' ? 'ACTION'
                : communicative.value === 'OFFER' ? 'ACTION'
                    : communicative.value === 'CONFIDE'
                        ? 'CONFIDENTIAL_HANDLING' : 'NONE'),
        evidence: {
            communicativeFunction: communicative.evidence,
            surfaceForm: surfaceForm.evidence,
            predicate: predicate.evidence,
            target: target.evidence,
            polarity: polarity.evidence,
            temporality: temporality.evidence,
            epistemicStatus: epistemic.evidence,
            continuity: continuity.evidence
        },
        confidenceBps: Math.min(10000, predicate.score + communicative.score + target.score
            + (epistemic.value !== 'UNMARKED' ? 500 : 0)),
        listenerActorId: context && context.listenerActorId ? String(context.listenerActorId) : null,
        worldMutation: false,
        proposedCommand: null
    };
    frame.suggestedSpeechAct = storySemanticFrameSpeechAct(frame);
    return frame;
}

function storyConversationSemanticFrameFuse(legacy, frame) {
    const selfSufficientFunction = frame && (['CLOSE', 'GREET', 'THANK', 'APOLOGIZE']
        .includes(frame.communicativeFunction)
        || (frame.communicativeFunction === 'TELL'
            && ['HEALTH', 'EMOTION', 'WEATHER'].includes(frame.predicate)));
    const minimumConfidence = selfSufficientFunction ? 3000 : 5200;
    if (!frame || frame.confidenceBps < minimumConfidence || frame.suggestedSpeechAct === 'UNKNOWN') return legacy;
    const genericLegacy = !legacy || ['UNKNOWN', 'ASK_INFORMATION', 'SMALL_TALK'].includes(legacy.primary);
    if (!genericLegacy && legacy.primary !== frame.suggestedSpeechAct) return legacy;
    const scores = Object.assign({}, legacy && legacy.scores || {});
    scores[frame.suggestedSpeechAct] = Math.max(scores[frame.suggestedSpeechAct] || 0,
        Math.round(frame.confidenceBps / 500));
    const primary = frame.suggestedSpeechAct;
    return {
        primary,
        secondary: Object.keys(scores).filter(key => key !== primary && scores[key] >= 5)
            .sort((a, b) => scores[b] - scores[a] || a.localeCompare(b, 'en')).slice(0, 3),
        scores,
        source: 'COMPOSITIONAL_FRAME_FUSED'
    };
}

function storyConversationSemanticFrameValidate(candidate) {
    const issues = [];
    if (!candidate || candidate.schemaVersion !== STORY_SEMANTIC_FRAME_SCHEMA_VERSION) issues.push('SCHEMA_VERSION');
    if (candidate && candidate.worldMutation !== false) issues.push('WORLD_MUTATION');
    if (candidate && candidate.proposedCommand !== null) issues.push('COMMAND_FORBIDDEN');
    if (candidate && (!Number.isFinite(candidate.confidenceBps)
        || candidate.confidenceBps < 0 || candidate.confidenceBps > 10000)) issues.push('CONFIDENCE');
    return { ok: issues.length === 0, issues };
}
