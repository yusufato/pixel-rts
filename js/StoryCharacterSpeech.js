// ============================================================================
//  KARAKTER KARARLARININ KONUŞMA GERÇEKLEŞTİRİCİSİ — Faz 38
//  ---------------------------------------------------------------------------
//  LLM cümle yazmaz. Hakemin doğrulanmış eylem/PASS kararı ile sınırlı enum
//  konuşma planı, burada kanonik karakter sesiyle kısa Türkçe söze dönüşür.
//  Gerçekleştirici sayı, dünya olgusu veya mekanik sonuç ekleyemez. Son altı
//  söz tam-cümle tekrarını; son iki söz de aynı hitabın üçüncü kullanımını
//  engeller. Oyuncu yalnız kendisine yöneltilmiş sözleri görebilir.
// ============================================================================

const STORY_CHARACTER_SPEECH_SCHEMA_VERSION = 1;
const STORY_CHARACTER_SPEECH_SOURCE = 'DETERMINISTIC_CONSTRAINED_REALIZER';
const STORY_CHARACTER_SPEECH_RECENT_WINDOW = 6;
const STORY_CHARACTER_DIALOGUE_SCHEMA_VERSION = 1;
const STORY_CHARACTER_DIALOGUE_SOURCE = 'DETERMINISTIC_LONG_DIALOGUE_REALIZER';
const STORY_CHARACTER_DIALOGUE_RECENT_WINDOW = 12;
const STORY_CHARACTER_DIALOGUE_MAX_SIMILARITY_BPS = 7200;
const STORY_CHARACTER_DIALOGUE_MAX_SEMANTIC_SIMILARITY_BPS = 8600;

const STORY_CHARACTER_DIALOGUE_STOP_WORDS = new Set([
    'acik', 'acikca', 'olarak', 'icin', 'ama', 'fakat', 've', 'veya', 'bir', 'bu', 'su',
    'ben', 'benim', 'sen', 'senin', 'biz', 'bizim', 'ki', 'de', 'da', 'ile', 'diye',
    'soyle', 'soyleyeyim', 'soyluyorum', 'belirtmeliyim', 'konusuyorum', 'konusamam',
    'degerlendirmem', 'sunlar', 'su', 'net', 'dogrudan', 'simdilik'
]);

const STORY_CHARACTER_DIALOGUE_SEMANTIC_ROOTS = Object.freeze({
    kabul: 'ACCEPT', onay: 'ACCEPT', redd: 'REJECT', ilerle: 'PROCEED', yurut: 'PROCEED',
    kosul: 'CONDITION', sart: 'CONDITION', yukumluluk: 'OBLIGATION', sorumluluk: 'OBLIGATION',
    teklif: 'OFFER', oneri: 'OFFER', karsilik: 'RECIPROCITY', ortak: 'RECIPROCITY',
    risk: 'RISK', belirsiz: 'UNCERTAINTY', ihtiyat: 'CAUTION', temkin: 'CAUTION',
    bilgi: 'EVIDENCE', kaynak: 'EVIDENCE', dayan: 'EVIDENCE', dogrula: 'EVIDENCE',
    acikla: 'EXPLAIN', ayrinti: 'DETAIL', netles: 'DETAIL', karar: 'DECISION', sonuc: 'RESULT',
    ertele: 'DEFER', bekle: 'DEFER', guven: 'TRUST', iliski: 'RELATIONSHIP', bag: 'RELATIONSHIP',
    ticari: 'TRADE', ticaret: 'TRADE', cikar: 'INTEREST', bedel: 'COST', yuk: 'COST'
});

// Faz 38.2: Bunlar yeni karar üretmez. Hakem/anlama katmanının verdiği kapalı
// konuşma eylemini farklı karakter seslerinde gerçekleştirir. Her satır aynı
// mekanik içeriğin ifade çeşididir; fiyat, miktar, yetki veya yeni dünya olgusu
// ekleyemez.
const STORY_CHARACTER_DIALOGUE_CORES = Object.freeze({
    PROPOSE_COMMERCIAL_DEAL: Object.freeze([
        'teklifi açık koşullarla değerlendirmeye hazırım',
        'ortak bir ticari zemin kurup şartları tek tek ele alabiliriz',
        'çıkarlarımız uyuşuyorsa teklifin ayrıntılarını konuşabiliriz',
        'önce yükümlülükleri netleştirip sonra ticari zeminde ilerleyelim',
        'iki tarafın sorumluluğu görünürse bu öneriyi masada tutarım',
        'teklifin karşılığını ve riskini birlikte tartışmaya açabilirim'
    ]),
    COUNTER_OFFER: Object.freeze([
        'mevcut koşulları kabul etmiyorum ama değiştirerek ilerleyebiliriz',
        'önerinin özü kalabilir; şartların yeniden kurulması gerekiyor',
        'aynı hedefe ancak farklı koşullarla yaklaşırım',
        'masadan kalkmıyorum fakat bu biçimiyle onay vermiyorum',
        'teklifi reddetmeden önce dengeli bir karşılık belirleyelim',
        'ilerlemek için yükümlülüklerin yeniden paylaşılmasını isterim'
    ]),
    ASK_INFORMATION: Object.freeze([
        'karar vermeden önce dayanağını açıkça görmem gerekiyor',
        'bu iddiayı hangi bilgiye bağladığını açıklamanı istiyorum',
        'eksik noktaları tamamlamadan sağlıklı bir sonuca varamam',
        'önce kaynağı ve bağlamı netleştirelim',
        'değerlendirmem için doğrulanabilir bir açıklama gerekiyor',
        'belirsiz kalan kısmı açarsan tutumumu belirleyebilirim'
    ]),
    REJECT: Object.freeze([
        'bu koşullarda öneriyi kabul etmiyorum',
        'mevcut biçimiyle ilerlemeyeceğim',
        'bu teklif benim için kabul edilebilir sınırda değil',
        'önerilen zemine onay vermiyorum',
        'şartlar değişmeden bu görüşme sonuç vermez',
        'bu düzenlemeye taraf olmayacağım'
    ]),
    DEFER: Object.freeze([
        'şimdilik karar vermeyi erteliyorum',
        'koşullar netleşene kadar bu konuyu açık tutacağım',
        'hemen sonuç vermek yerine gelişmeleri görmeyi tercih ediyorum',
        'bu aşamada kesin bir tutum açıklamayacağım',
        'kararı sonraki değerlendirmeye bırakıyorum',
        'belirsizlik azalmadan bağlayıcı cevap vermeyeceğim'
    ]),
    DEFAULT: Object.freeze([
        'konuyu kendi sınırlarım içinde değerlendireceğim',
        'bu meselede tutumumu açık ve ölçülü biçimde belirleyeceğim',
        'söylediklerini dikkate alıp uygun cevabı vereceğim',
        'bu başlığı sonuçlarıyla birlikte ele alacağım'
    ])
});

const STORY_CHARACTER_DIALOGUE_VOICES = Object.freeze({
    DIRECT: Object.freeze({
        leads: Object.freeze(['Net olayım:', 'Doğrudan söyleyeceğim:', 'Kararımın çerçevesi açık:']),
        closings: Object.freeze(['Gereksiz dolambaç istemiyorum.', 'Sonucu açıkça görelim.', 'Sınırı baştan bilelim.'])
    }),
    FORMAL: Object.freeze({
        leads: Object.freeze(['Kurumsal açıdan değerlendirmem şu:', 'Usulü gözeterek belirtmeliyim:', 'Yetki çerçevesinde söyleyebilirim ki:']),
        closings: Object.freeze(['Süreç kayıtlı ve denetlenebilir kalmalı.', 'Usul tamamlanmadan sonuç doğmaz.', 'Yükümlülükler açıkça tanımlanmalı.'])
    }),
    WARM: Object.freeze({
        leads: Object.freeze(['Ortak bir yol bulmak niyetiyle söyleyeyim:', 'Aramızdaki güveni koruyarak konuşuyorum:', 'Birbirimizi anlayabileceğimiz yerden başlayalım:']),
        closings: Object.freeze(['İki tarafı da koruyan bir yol bulabiliriz.', 'Güveni bozmadan ilerlemek isterim.', 'Bağımızı sonuç uğruna harcamayalım.'])
    }),
    CAUTIOUS: Object.freeze({
        leads: Object.freeze(['İhtiyatı elden bırakmadan söylemeliyim:', 'Bütün riskleri görmeden konuşamam ama:', 'Şimdilik temkinli değerlendirmem şu:']),
        closings: Object.freeze(['Önce belirsizliği azaltalım.', 'Aceleyle geri dönülmez söz vermem.', 'Risk görünür olmadan ilerlemem.'])
    })
});

const STORY_CHARACTER_SPEECH_ACTION_LINES = Object.freeze({
    PERSUADE: Object.freeze([
        'bu görüşü yeniden değerlendirmeni istiyorum',
        'bakışını değiştirecek zeminin hâlâ var olduğuna inanıyorum',
        'bu konuda bir kez daha düşünmeni bekliyorum',
        'itirazlarını duydum; yine de tutumunu gözden geçirmeni istiyorum',
        'seni zorlamadan fikrini değiştirmeye çalışacağım',
        'bu kararı başka bir açıdan ele almamız gerektiğini düşünüyorum'
    ]),
    NEGOTIATE: Object.freeze([
        'şartları karşılıklı bir zeminde konuşalım',
        'iki tarafın da taşıyabileceği bir uzlaşma arayalım',
        'anlaşmazlığı açık koşullarla çözmeyi öneriyorum',
        'çıkarlarımızı saklamadan ortak bir yol bulalım',
        'koşulları yeniden ele alıp dengeli bir sonuca varalım',
        'masadan kalkmadan önce kabul edilebilir zemini arayalım'
    ]),
    ALLY: Object.freeze([
        'aramızdaki bağı açık bir ittifaka dönüştürmek istiyorum',
        'birbirimize karşı değil, birlikte hareket etmemizi öneriyorum',
        'güvenimizi kalıcı bir ortaklığa çevirebiliriz',
        'aynı yönde hareket etmenin ikimiz için de doğru olduğuna inanıyorum',
        'ilişkimizi daha güçlü ve açık bir bağa taşımayı öneriyorum',
        'bundan sonra birbirimizin yanında durabileceğimiz bir düzen kuralım'
    ]),
    BETRAY: Object.freeze([
        'aramızdaki bağın benim için sona erdiğini bil',
        'bundan sonra verdiğim desteğe güvenemeyeceğini açıkça söylüyorum',
        'ortaklığımızı burada bitiriyorum',
        'sana karşı taşıdığım yükümlülüğü artık kabul etmiyorum',
        'yollarımızı ayırıyorum ve bunun sonucunu üstleniyorum',
        'aramızdaki güveni geri dönülmez biçimde çekiyorum'
    ]),
    ORDER: Object.freeze([
        'bu emri uygulamanı ve sorumluluğunu üstlenmeni bekliyorum',
        'verilen görevi komuta zinciri içinde yerine getir',
        'bu kararın gereğini gecikmeden yapmanı istiyorum',
        'yetkin dâhilindeki görevi açık biçimde yürüt',
        'sorumluluğu devral ve emrin gereğini uygula',
        'bu görevi sonuçlandırmak üzere harekete geç'
    ]),
    SABOTAGE: Object.freeze([
        'bu gizli görevi yalnız belirlenmiş sınırlar içinde yürüt',
        'operasyonu dikkatle yürütmeni ve iz bırakmamanı bekliyorum',
        'görevi sessizce uygula; yetkinin dışına çıkma',
        'bu operasyonu ölçülü ve denetlenebilir biçimde yürüt',
        'gizliliği koruyarak görevin gereğini yerine getir',
        'operasyonu açık edilen amaçtan sapmadan tamamla'
    ]),
    RESIGN: Object.freeze([
        'görevimi bırakıyorum ve yetkiyi usulünce devrediyorum',
        'bu makamdan çekilme kararımı açıklıyorum',
        'sorumluluğumu kabul ederek görevden ayrılıyorum',
        'yetkimi bırakıyor ve haleflik sürecini başlatıyorum',
        'bu görevde kalmayacağımı açıkça bildiriyorum',
        'makamdan çekiliyor ve kurumsal devri kabul ediyorum'
    ])
});

const STORY_CHARACTER_SPEECH_PASS_LINES = Object.freeze({
    DEFER_FOR_INFORMATION: Object.freeze([
        'şimdilik karar vermeyeceğim; önce daha fazla bilgiye ihtiyacım var',
        'yeterli bilgi oluşmadan bu adımı atmayacağım',
        'kararı erteliyorum; belirsizlik giderilmeden ilerlemeyeceğim'
    ]),
    INSUFFICIENT_VALUE: Object.freeze([
        'bu adımın bedeli şu anda karşılığını vermiyor',
        'önerilen yol benim için yeterli değer üretmiyor',
        'bu koşullarda ilerlemek için yeterli gerekçe görmüyorum'
    ]),
    RED_LINE: Object.freeze([
        'bu teklif kabul edemeyeceğim bir sınırı aşıyor',
        'burada geri çekilmeyeceğim bir çizgi var',
        'bu koşul temel sınırlarımla bağdaşmıyor'
    ]),
    DEFAULT: Object.freeze([
        'şimdilik harekete geçmeyeceğim',
        'bu aşamada kararımı bekletiyorum',
        'koşullar değişmeden bir adım atmayacağım'
    ])
});

const STORY_CHARACTER_SPEECH_LEADS = Object.freeze({
    STATE_POSITION_FIRST: Object.freeze({
        FIRM: Object.freeze(['Açık konuşacağım:', 'Tutumumu saklamayacağım:', 'Kararım net:']),
        MEASURED: Object.freeze(['Değerlendirmem şu:', 'Benim vardığım sonuç şu:', 'Durumu tarttım:']),
        WARM: Object.freeze(['İyi niyetle söylüyorum:', 'Açık bir niyetle konuşuyorum:', 'Yapıcı olmak istiyorum:']),
        GUARDED: Object.freeze(['Şimdilik temkinliyim:', 'Sınırlarımı koruyarak söylüyorum:', 'Tedbiri elden bırakmadan konuşuyorum:'])
    }),
    RELATIONSHIP_CONTEXT_FIRST: Object.freeze({
        FIRM: Object.freeze(['Aramızdaki bağı gözetiyorum ama:', 'İlişkimizi hesaba katarak açık söylüyorum:', 'Geçmişimizi unutmadan net konuşuyorum:']),
        MEASURED: Object.freeze(['Ortak zemini korumak için söylüyorum:', 'Aramızdaki ilişkiyi tartarak konuşuyorum:', 'Birbirimizi anladığımızı varsayarak söylüyorum:']),
        WARM: Object.freeze(['Aramızdaki güvene dayanarak söylüyorum:', 'Birlikte yol bulabileceğimize inanarak konuşuyorum:', 'İlişkimizi korumak isteğiyle söylüyorum:']),
        GUARDED: Object.freeze(['Aramızdaki geçmişi göz ardı etmiyorum; yine de:', 'İlişkimizi koruyarak temkinli konuşuyorum:', 'Güveni kaybetmeden sınırımı belirtiyorum:'])
    })
});

const STORY_CHARACTER_SPEECH_EMPHASIS_LINES = Object.freeze({
    GOAL: Object.freeze(['Hedefim konusunda tereddüdüm yok.', 'Nereye varmak istediğimi biliyorum.']),
    RELATIONSHIP: Object.freeze(['Aramızdaki ilişkiyi de hesaba katıyorum.', 'Bu kararın aramızdaki bağı etkilediğini biliyorum.']),
    COST: Object.freeze(['Bedelini göz ardı etmiyorum.', 'Bu seçimin yükünü de tartıyorum.']),
    RISK: Object.freeze(['Riskleri görmeden ilerlemeyeceğim.', 'Belirsizliği kararın dışında bırakmıyorum.']),
    RED_LINE: Object.freeze(['Sınırlarım bu kararın bir parçası.', 'Aşılmasına izin vermeyeceğim bir çizgi var.']),
    RECIPROCITY: Object.freeze(['Karşılığını da açıkça görmem gerekiyor.', 'Bu adımın karşılıklı olmasını bekliyorum.'])
});

const STORY_CHARACTER_SPEECH_ROLE_TITLES = Object.freeze({
    EXECUTIVE: 'Başkan', POLITICAL_FIGURE: 'Sayın temsilci', POLITICAL_CANDIDATE: 'Sayın aday',
    MAYOR: 'Başkan', COMMANDER: 'Komutan', MILITARY: 'Komutan', AGENT: 'Görevli',
    COMPANY_OWNER: 'Yönetici', COMPANY_EXECUTIVE: 'Yönetici', CIVILIAN: 'Sayın yurttaş'
});

function storyCharacterSpeechClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyCharacterSpeechHash32(value) {
    const text = String(value == null ? '' : value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

function storyCharacterSpeechNormalize(value) {
    return String(value == null ? '' : value).normalize('NFKC').toLocaleLowerCase('tr-TR')
        .replace(/[“”"'’`]/g, '').replace(/[^a-zçğıöşüâîû0-9]+/gi, ' ').trim();
}

function storyCharacterSpeechSafeWords(value) {
    return String(value == null ? '' : value).replace(/[^A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû -]/g, ' ')
        .replace(/\s+/g, ' ').trim();
}

function storyCharacterSpeechIdentity(actorId) {
    return typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(actorId) : null;
}

function storyCharacterSpeechPlan(decision, actor) {
    const input = decision && decision.speechPlan || {};
    const voice = actor && actor.voiceProfile || {};
    const opening = ['STATE_POSITION_FIRST', 'RELATIONSHIP_CONTEXT_FIRST'].includes(input.opening)
        ? input.opening : (Number(voice.directnessBps) >= 6000 ? 'STATE_POSITION_FIRST' : 'RELATIONSHIP_CONTEXT_FIRST');
    const tone = ['FIRM', 'MEASURED', 'WARM', 'GUARDED'].includes(input.tone)
        ? input.tone : (Number(voice.warmthBps) >= 6200 ? 'WARM'
            : Number(voice.directnessBps) >= 6500 ? 'FIRM'
                : Number(voice.formalityBps) >= 6500 ? 'GUARDED' : 'MEASURED');
    const address = ['FORMAL_TITLE', 'SURNAME', 'ROLE_TITLE', 'NEUTRAL'].includes(input.address)
        ? input.address : (Number(voice.formalityBps) >= 6500 ? 'FORMAL_TITLE' : 'NEUTRAL');
    const emphasis = Array.from(new Set((Array.isArray(input.emphasis) ? input.emphasis : ['GOAL'])
        .filter(key => STORY_CHARACTER_SPEECH_EMPHASIS_LINES[key]))).slice(0, 2);
    return { opening, tone, address, emphasis: emphasis.length ? emphasis : ['GOAL'] };
}

function storyCharacterSpeechAddressVariants(target, requestedMode) {
    const safeName = storyCharacterSpeechSafeWords(target && target.name);
    const parts = safeName.split(' ').filter(Boolean);
    const surname = parts.length ? parts[parts.length - 1] : '';
    const publicTitle = storyCharacterSpeechSafeWords(target && target.publicTitle);
    const roleTitle = publicTitle || STORY_CHARACTER_SPEECH_ROLE_TITLES[String(target && target.role || '')] || '';
    const values = {
        FORMAL_TITLE: publicTitle || (surname ? `Sayın ${surname}` : (roleTitle || '')),
        SURNAME: surname,
        ROLE_TITLE: roleTitle,
        NEUTRAL: ''
    };
    const order = [requestedMode, 'FORMAL_TITLE', 'ROLE_TITLE', 'SURNAME', 'NEUTRAL'];
    const seen = new Set();
    return order.filter(mode => {
        const key = storyCharacterSpeechNormalize(values[mode]) || 'NEUTRAL';
        if (seen.has(key)) return false;
        seen.add(key);
        return mode === 'NEUTRAL' || !!values[mode];
    }).map(mode => ({ mode, text: values[mode] }));
}

function storyCharacterSpeechHistory(actorId, supplied) {
    const rows = Array.isArray(supplied) ? supplied
        : Object.values(STORY.characterActions && STORY.characterActions.arbiterDecisions || {});
    return rows.filter(row => row && row.actorId === String(actorId || '') && row.realization)
        .sort((a, b) => Number(b.sequence) - Number(a.sequence)
            || String(b.id).localeCompare(String(a.id), 'en'))
        .slice(0, STORY_CHARACTER_SPEECH_RECENT_WINDOW);
}

function storyCharacterSpeechCompose(address, lead, core, emphasis) {
    const prefix = address ? `${address}, ` : '';
    const raw = `${prefix}${lead} ${core}. ${emphasis || ''}`.replace(/\s+/g, ' ').trim();
    return raw.replace(/\.\s*\.$/, '.').slice(0, 280);
}

function storyCharacterSpeechRealizeDecision(decision, options) {
    if (!decision || decision.status === 'STALE') return null;
    const actor = storyCharacterSpeechIdentity(decision.actorId);
    const target = decision.targetActorId ? storyCharacterSpeechIdentity(decision.targetActorId) : null;
    const plan = storyCharacterSpeechPlan(decision, actor);
    const actionLines = decision.verdict === 'PASS'
        ? (STORY_CHARACTER_SPEECH_PASS_LINES[decision.reasonCode]
            || STORY_CHARACTER_SPEECH_PASS_LINES.DEFAULT)
        : (STORY_CHARACTER_SPEECH_ACTION_LINES[decision.actionType]
            || STORY_CHARACTER_SPEECH_PASS_LINES.DEFAULT);
    const leads = STORY_CHARACTER_SPEECH_LEADS[plan.opening][plan.tone];
    const emphasisKey = plan.emphasis[0];
    const emphases = STORY_CHARACTER_SPEECH_EMPHASIS_LINES[emphasisKey]
        || STORY_CHARACTER_SPEECH_EMPHASIS_LINES.GOAL;
    const addresses = target
        ? storyCharacterSpeechAddressVariants(target, plan.address)
        : [{ mode: 'NEUTRAL', text: '' }];
    const recent = storyCharacterSpeechHistory(decision.actorId, options && options.history);
    const recentTexts = new Set(recent.map(row => row.realization.normalizedText));
    const recentAddressModes = recent.slice(0, 2).map(row => row.realization.addressMode);
    const requestedAddress = addresses.find(row => row.mode === plan.address) || addresses[0];
    const requestedRepeated = recentAddressModes.length >= 2
        && recentAddressModes[0] === requestedAddress.mode
        && recentAddressModes[1] === requestedAddress.mode;
    // Konuşma planındaki hitabı normalde aynen uygula. Ancak aynı aktör onu iki
    // kez üst üste kullandıysa üçüncü söz için güvenli alternatifleri aç.
    const addressPool = requestedRepeated ? addresses : [requestedAddress];
    const seed = `${decision.requestId}|${decision.contextHash}|${decision.actorId}|${decision.sequence}|${plan.opening}|${plan.tone}`;
    const variants = [];
    for (let lineIndex = 0; lineIndex < actionLines.length; lineIndex++) {
        for (let leadIndex = 0; leadIndex < leads.length; leadIndex++) {
            for (let addressIndex = 0; addressIndex < addressPool.length; addressIndex++) {
                const emphasisIndex = storyCharacterSpeechHash32(`${seed}|emphasis|${lineIndex}|${leadIndex}`) % emphases.length;
                const address = addressPool[addressIndex];
                const text = storyCharacterSpeechCompose(address.text, leads[leadIndex], actionLines[lineIndex], emphases[emphasisIndex]);
                variants.push({
                    text,
                    normalizedText: storyCharacterSpeechNormalize(text),
                    addressMode: address.mode,
                    addressText: address.text || null,
                    templateId: `${decision.verdict}:${decision.actionType || decision.reasonCode || 'DEFAULT'}:${lineIndex}:${leadIndex}:${emphasisIndex}`,
                    order: storyCharacterSpeechHash32(`${seed}|${lineIndex}|${leadIndex}|${addressIndex}`)
                });
            }
        }
    }
    variants.sort((a, b) => a.order - b.order || a.templateId.localeCompare(b.templateId, 'en'));
    const repeatedAddress = mode => recentAddressModes.length >= 2
        && recentAddressModes[0] === mode && recentAddressModes[1] === mode;
    const selected = variants.find(row => !recentTexts.has(row.normalizedText) && !repeatedAddress(row.addressMode))
        || variants.find(row => !recentTexts.has(row.normalizedText))
        || variants[0];
    if (!selected) return null;
    const utteranceHash = storyCharacterSpeechHash32(`${decision.id}|${selected.normalizedText}`)
        .toString(16).padStart(8, '0');
    return {
        schemaVersion: STORY_CHARACTER_SPEECH_SCHEMA_VERSION,
        utteranceId: `character-utterance:${utteranceHash}`,
        templateId: selected.templateId,
        text: selected.text,
        normalizedText: selected.normalizedText,
        requestedAddressMode: plan.address,
        addressMode: selected.addressMode,
        addressText: selected.addressText,
        opening: plan.opening,
        tone: plan.tone,
        emphasis: plan.emphasis,
        source: STORY_CHARACTER_SPEECH_SOURCE,
        generatedAt: Number(decision.consumedAt) || 0
    };
}

function storyCharacterSpeechValidateRealization(realization) {
    const issues = [];
    if (!realization || typeof realization !== 'object') return { ok: false, issues: ['REALIZATION_OBJECT'] };
    if (realization.schemaVersion !== STORY_CHARACTER_SPEECH_SCHEMA_VERSION) issues.push('SCHEMA_VERSION');
    if (!realization.utteranceId || !realization.templateId) issues.push('IDENTITY');
    if (!realization.text || realization.text.length > 280) issues.push('TEXT_LENGTH');
    if (storyCharacterSpeechNormalize(realization.text) !== realization.normalizedText) issues.push('NORMALIZED_TEXT');
    if (/character:|country:|fnv1a32|successChance|damageBps/i.test(realization.text || '')) issues.push('INTERNAL_FACT_LEAK');
    if (!['FORMAL_TITLE', 'SURNAME', 'ROLE_TITLE', 'NEUTRAL'].includes(realization.addressMode)) issues.push('ADDRESS_MODE');
    if (!['STATE_POSITION_FIRST', 'RELATIONSHIP_CONTEXT_FIRST'].includes(realization.opening)) issues.push('OPENING');
    if (!['FIRM', 'MEASURED', 'WARM', 'GUARDED'].includes(realization.tone)) issues.push('TONE');
    if (realization.source !== STORY_CHARACTER_SPEECH_SOURCE) issues.push('SOURCE');
    return { ok: issues.length === 0, issues };
}

function storyCharacterSpeechPlayerActorId() {
    if (typeof storyCharacterActionAIPlayerActorId === 'function') return storyCharacterActionAIPlayerActorId();
    return STORY.commander ? `character:${STORY.playerStateId | 0}:${STORY.commander.id}` : null;
}

function storyCharacterSpeechPlayerInbox(limit) {
    const playerActorId = storyCharacterSpeechPlayerActorId();
    if (!playerActorId) return [];
    return Object.values(STORY.characterActions && STORY.characterActions.arbiterDecisions || {})
        .filter(row => row && row.targetActorId === playerActorId && row.status !== 'STALE'
            && row.realization && storyCharacterSpeechValidateRealization(row.realization).ok)
        .sort((a, b) => Number(b.sequence) - Number(a.sequence)
            || String(b.id).localeCompare(String(a.id), 'en'))
        .slice(0, Math.max(1, Math.min(12, Number(limit) || 6)))
        .map(row => {
            const actor = storyCharacterSpeechIdentity(row.actorId);
            return {
                decisionId: row.id,
                actorId: row.actorId,
                speakerName: actor && actor.name || 'Bilinmeyen karakter',
                speakerTitle: actor && actor.publicTitle || STORY_CHARACTER_SPEECH_ROLE_TITLES[String(actor && actor.role || '')] || null,
                actionType: row.actionType,
                verdict: row.verdict,
                text: row.realization.text,
                at: Number(row.consumedAt) || 0,
                source: row.realization.source
            };
        });
}

function storyCharacterDialogueVoice(actor) {
    const voice = actor && actor.voiceProfile || {};
    const scores = {
        DIRECT: Number(voice.directnessBps) || 0,
        FORMAL: Number(voice.formalityBps) || 0,
        WARM: Number(voice.warmthBps) || 0,
        CAUTIOUS: Math.round(((10000 - (Number(voice.directnessBps) || 0)) * 0.65)
            + ((Number(voice.formalityBps) || 0) * 0.35))
    };
    if (Number(voice.warmthBps) < 4500) scores.CAUTIOUS += 900;
    const ranked = Object.keys(scores).sort((a, b) => scores[b] - scores[a]
        || a.localeCompare(b, 'en'));
    return {
        primary: ranked[0] || 'CAUTIOUS',
        secondary: ranked[1] || 'FORMAL',
        scores
    };
}

function storyCharacterDialogueTokens(value) {
    return storyCharacterSpeechNormalize(value).split(' ').filter(Boolean);
}

function storyCharacterDialogueNgrams(value, size) {
    const tokens = storyCharacterDialogueTokens(value);
    const grams = new Set();
    const width = Math.max(1, Number(size) || 2);
    for (let index = 0; index <= tokens.length - width; index++) {
        grams.add(tokens.slice(index, index + width).join(' '));
    }
    return grams;
}

function storyCharacterDialogueSimilarityBps(left, right) {
    const a = storyCharacterDialogueNgrams(left, 2);
    const b = storyCharacterDialogueNgrams(right, 2);
    if (!a.size && !b.size) return 10000;
    let intersection = 0;
    a.forEach(value => { if (b.has(value)) intersection++; });
    const union = a.size + b.size - intersection;
    return union ? Math.round(intersection * 10000 / union) : 0;
}

function storyCharacterDialogueSemanticTokens(value) {
    const suffixes = ['larimizdan', 'lerimizden', 'larindan', 'lerinden', 'larimiz', 'lerimiz',
        'mak', 'mek', 'madan', 'meden', 'acak', 'ecek', 'iyor', 'iyor', 'iyor', 'iyor',
        'lik', 'lik', 'luk', 'luk', 'lar', 'ler', 'dan', 'den', 'dir', 'dir', 'tir', 'tir',
        'im', 'in', 'um', 'un', 'miz', 'niz', 'si', 'i', 'u'];
    return storyCharacterDialogueTokens(value).map(token => {
        let root = token.replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ş/g, 's')
            .replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ç/g, 'c');
        for (const suffix of suffixes) {
            if (root.endsWith(suffix) && root.length - suffix.length >= 4) {
                root = root.slice(0, -suffix.length);
                break;
            }
        }
        if (STORY_CHARACTER_DIALOGUE_STOP_WORDS.has(root) || root.length < 3) return null;
        const semanticRoot = Object.keys(STORY_CHARACTER_DIALOGUE_SEMANTIC_ROOTS)
            .find(prefix => root.startsWith(prefix));
        return semanticRoot ? STORY_CHARACTER_DIALOGUE_SEMANTIC_ROOTS[semanticRoot] : root.toUpperCase();
    }).filter(Boolean);
}

function storyCharacterDialogueSemanticSimilarityBps(left, right) {
    const a = new Set(storyCharacterDialogueSemanticTokens(left));
    const b = new Set(storyCharacterDialogueSemanticTokens(right));
    if (!a.size && !b.size) return 10000;
    let intersection = 0;
    a.forEach(value => { if (b.has(value)) intersection++; });
    const union = a.size + b.size - intersection;
    return union ? Math.round(intersection * 10000 / union) : 0;
}

function storyCharacterDialogueIntent(input) {
    const key = String(input && (input.speechAct || input.intent || input.actionType) || 'DEFAULT');
    if (STORY_CHARACTER_DIALOGUE_CORES[key]) return key;
    if (key === 'DECLINE_NEGOTIATION' || key === 'NEGOTIATION_DECLINED') return 'REJECT';
    if (key === 'DEFER_FOR_REGISTRATION' || key === 'NEGOTIATION_DEFERRED') return 'DEFER';
    return 'DEFAULT';
}

function storyCharacterDialogueRealize(input, options) {
    if (!input || !input.actorId || !input.turnId) return null;
    const actor = storyCharacterSpeechIdentity(input.actorId);
    const target = input.targetActorId ? storyCharacterSpeechIdentity(input.targetActorId) : null;
    if (!actor) return null;
    const intent = storyCharacterDialogueIntent(input);
    const voice = storyCharacterDialogueVoice(actor);
    const registers = [voice.primary, voice.secondary].filter((value, index, rows) => rows.indexOf(value) === index);
    const cores = STORY_CHARACTER_DIALOGUE_CORES[intent] || STORY_CHARACTER_DIALOGUE_CORES.DEFAULT;
    const history = (Array.isArray(options && options.history) ? options.history : [])
        .filter(row => row && row.actorId === input.actorId && row.text)
        .slice(-STORY_CHARACTER_DIALOGUE_RECENT_WINDOW);
    const recentTexts = new Set(history.map(row => storyCharacterSpeechNormalize(row.text)));
    const recentTemplates = new Set(history.slice(-6).map(row => row.templateId));
    const recentAddresses = history.slice(-2).map(row => row.addressMode);
    const requestedAddress = String(input.addressMode || (Number(actor.voiceProfile && actor.voiceProfile.formalityBps) >= 6000
        ? 'FORMAL_TITLE' : 'NEUTRAL'));
    const addresses = target ? storyCharacterSpeechAddressVariants(target, requestedAddress)
        : [{ mode: 'NEUTRAL', text: '' }];
    const addressRepeated = recentAddresses.length === 2
        && recentAddresses[0] === recentAddresses[1]
        && recentAddresses[0] === requestedAddress;
    const addressPool = addressRepeated ? addresses : [addresses.find(row => row.mode === requestedAddress) || addresses[0]];
    const variants = [];
    registers.forEach(register => {
        const voiceRows = STORY_CHARACTER_DIALOGUE_VOICES[register];
        cores.forEach((core, coreIndex) => voiceRows.leads.forEach((lead, leadIndex) =>
            voiceRows.closings.forEach((closing, closingIndex) => addressPool.forEach((address, addressIndex) => {
                const prefix = address.text ? `${address.text}, ` : '';
                const text = `${prefix}${lead} ${core}. ${closing}`.replace(/\s+/g, ' ').trim();
                const templateId = `${intent}:${register}:${coreIndex}:${leadIndex}:${closingIndex}:${address.mode}`;
                const similarities = history.map(row => storyCharacterDialogueSimilarityBps(text, row.text));
                const maxSimilarityBps = similarities.length ? Math.max(...similarities) : 0;
                const semanticSimilarities = history.map(row => storyCharacterDialogueSemanticSimilarityBps(text, row.text));
                const maxSemanticSimilarityBps = semanticSimilarities.length ? Math.max(...semanticSimilarities) : 0;
                variants.push({
                    text,
                    normalizedText: storyCharacterSpeechNormalize(text),
                    templateId,
                    register,
                    addressMode: address.mode,
                    addressText: address.text || null,
                    maxSimilarityBps,
                    maxSemanticSimilarityBps,
                    order: storyCharacterSpeechHash32(`${input.turnId}|${input.actorId}|${templateId}|${addressIndex}`)
                });
            }))));
    });
    variants.sort((a, b) => {
        const aAddressSpam = recentAddresses.length === 2
            && recentAddresses[0] === a.addressMode && recentAddresses[1] === a.addressMode;
        const bAddressSpam = recentAddresses.length === 2
            && recentAddresses[0] === b.addressMode && recentAddresses[1] === b.addressMode;
        const aBlocked = recentTexts.has(a.normalizedText) || recentTemplates.has(a.templateId)
            || a.maxSimilarityBps > STORY_CHARACTER_DIALOGUE_MAX_SIMILARITY_BPS
            || a.maxSemanticSimilarityBps > STORY_CHARACTER_DIALOGUE_MAX_SEMANTIC_SIMILARITY_BPS;
        const bBlocked = recentTexts.has(b.normalizedText) || recentTemplates.has(b.templateId)
            || b.maxSimilarityBps > STORY_CHARACTER_DIALOGUE_MAX_SIMILARITY_BPS
            || b.maxSemanticSimilarityBps > STORY_CHARACTER_DIALOGUE_MAX_SEMANTIC_SIMILARITY_BPS;
        return Number(aAddressSpam) - Number(bAddressSpam)
            || Number(aBlocked) - Number(bBlocked)
            || a.maxSimilarityBps - b.maxSimilarityBps
            || a.maxSemanticSimilarityBps - b.maxSemanticSimilarityBps
            || a.order - b.order
            || a.templateId.localeCompare(b.templateId, 'en');
    });
    const selected = variants[0];
    if (!selected) return null;
    return {
        schemaVersion: STORY_CHARACTER_DIALOGUE_SCHEMA_VERSION,
        utteranceId: `dialogue-utterance:${storyCharacterSpeechHash32(`${input.turnId}|${selected.normalizedText}`)
            .toString(16).padStart(8, '0')}`,
        turnId: String(input.turnId),
        actorId: String(input.actorId),
        targetActorId: input.targetActorId ? String(input.targetActorId) : null,
        intent,
        text: selected.text,
        normalizedText: selected.normalizedText,
        templateId: selected.templateId,
        register: selected.register,
        voiceFingerprint: `${voice.primary}>${voice.secondary}`,
        addressMode: selected.addressMode,
        addressText: selected.addressText,
        maxRecentSimilarityBps: selected.maxSimilarityBps,
        maxRecentSemanticSimilarityBps: selected.maxSemanticSimilarityBps,
        regenerated: history.length > 0,
        source: STORY_CHARACTER_DIALOGUE_SOURCE,
        worldMutation: false
    };
}

function storyCharacterDialogueValidate(realization) {
    const issues = [];
    if (!realization || typeof realization !== 'object') return { ok: false, issues: ['REALIZATION_OBJECT'] };
    if (realization.schemaVersion !== STORY_CHARACTER_DIALOGUE_SCHEMA_VERSION) issues.push('SCHEMA_VERSION');
    if (!realization.utteranceId || !realization.turnId || !realization.actorId) issues.push('IDENTITY');
    if (!realization.text || realization.text.length > 320) issues.push('TEXT_LENGTH');
    if (storyCharacterSpeechNormalize(realization.text) !== realization.normalizedText) issues.push('NORMALIZED_TEXT');
    if (!STORY_CHARACTER_DIALOGUE_CORES[realization.intent]) issues.push('INTENT');
    if (!STORY_CHARACTER_DIALOGUE_VOICES[realization.register]) issues.push('REGISTER');
    if (!['FORMAL_TITLE', 'SURNAME', 'ROLE_TITLE', 'NEUTRAL'].includes(realization.addressMode)) issues.push('ADDRESS_MODE');
    if (Number(realization.maxRecentSimilarityBps) < 0 || Number(realization.maxRecentSimilarityBps) > 10000) issues.push('SIMILARITY');
    if (Number(realization.maxRecentSemanticSimilarityBps) < 0
        || Number(realization.maxRecentSemanticSimilarityBps) > 10000) issues.push('SEMANTIC_SIMILARITY');
    if (realization.source !== STORY_CHARACTER_DIALOGUE_SOURCE) issues.push('SOURCE');
    if (realization.worldMutation !== false) issues.push('WORLD_MUTATION');
    if (/character:|country:|fnv1a32|successChance|damageBps/i.test(realization.text || '')) issues.push('INTERNAL_FACT_LEAK');
    return { ok: issues.length === 0, issues };
}
