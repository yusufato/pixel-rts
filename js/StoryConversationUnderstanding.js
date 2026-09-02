// ============================================================================
//  OYUNCU SERBEST METİN ANLAMA SÖZLEŞMESİ — Faz 38.1 (ilk dikey)
//  ---------------------------------------------------------------------------
//  Bu katman bir dünya komutu çalıştırmaz. Oyuncu cümlesini kapalı bir konuşma
//  eylemi, kanonik/çözülememiş varlıklar, iddialar, istekler ve teyit borçları
//  haline getirir. Ham yabancı ticaret defterini okumaz; bilinmeyen sevkiyat,
//  kaynak veya sahiplik uydurmaz. LLM kapalıyken de deterministik çalışır.
// ============================================================================

const STORY_CONVERSATION_UNDERSTANDING_SCHEMA_VERSION = 1;
const STORY_CONVERSATION_UNDERSTANDING_ADAPTER_VERSION = 'story-conversation-understanding-1';
const STORY_CONVERSATION_UNDERSTANDING_SOURCE = 'DETERMINISTIC_NLU_BASELINE';
const STORY_CONVERSATION_MAX_INPUT = 1200;
const STORY_CONVERSATION_SERVICE_BOT_LANGUAGE = /\b(nasıl yardımcı olabilirim|size nasıl yardımcı|sana nasıl yardımcı|neler yapmamıza yardımcı|ne tür bir yardım ar[a-zçğıöşü]*|nasıl destek olabilirim|yardımcı olmamı ister|talebinizi belirt|konuyu belirt|daha fazla bilgi(?:ye ihtiyacım var| ver| paylaş)|daha fazla ayrıntı(?:ya gir(?:in)?|ya ihtiyacım var| ver(?:in)?)|sorularınızı(?: açıkça)? belirtin|teşekkür ederim için buradayım|lütfen başka bir konu seç|buyurun|emrinize amadeyim)\b/i;

const STORY_CONVERSATION_SPEECH_ACTS = Object.freeze([
    'ASK_INFORMATION', 'PROPOSE_COMMERCIAL_DEAL', 'THREATEN', 'MAKE_PROMISE',
    'SHARE_SECRET', 'BLUFF_CANDIDATE', 'ACCUSE', 'REQUEST_ACTION',
    'OFFER_SUPPORT', 'COUNTER_OFFER', 'REJECT', 'GREETING', 'CHECK_IN',
    'THANK', 'APOLOGIZE', 'FAREWELL', 'ASK_PERSONAL_OPINION',
    'SMALL_TALK', 'REQUEST_SUPPORT', 'ASK_RELATIONSHIP', 'REPORT_MILITARY',
    'REPORT_ECONOMIC', 'CORRECT_STATEMENT', 'CHALLENGE', 'UNKNOWN'
]);
const STORY_CONVERSATION_SOCIAL_ACTS = Object.freeze([
    'GREETING', 'CHECK_IN', 'THANK', 'APOLOGIZE', 'FAREWELL',
    'ASK_PERSONAL_OPINION', 'SMALL_TALK', 'REQUEST_SUPPORT',
    'ASK_RELATIONSHIP', 'REPORT_MILITARY', 'REPORT_ECONOMIC',
    'CORRECT_STATEMENT', 'CHALLENGE'
]);
const STORY_CONVERSATION_ENTITY_STATUSES = Object.freeze([
    'RESOLVED_PUBLIC', 'RESOLVED_OWNED', 'KNOWN_CONTEXT_REFERENCE',
    'RESOLVED_BY_PLAYER_CONFIRMATION', 'AMBIGUOUS_REFERENCE',
    'UNRESOLVED_REFERENCE', 'UNRESOLVED_CATALOG_GAP'
]);
const STORY_CONVERSATION_AMBIGUITY = Object.freeze(['LOW', 'MEDIUM', 'HIGH']);
const STORY_CONVERSATION_RISK = Object.freeze(['LOW', 'MEDIUM', 'HIGH']);
const STORY_CONVERSATION_LLM_PENDING = new Set();

function storyConversationClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyConversationFold(value) {
    return String(value == null ? '' : value)
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
        .toLocaleLowerCase('tr-TR')
        .replace(/ı/g, 'i')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9:_-]+/g, ' ')
        .trim().replace(/\s+/g, ' ');
}

function storyConversationHash(value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return `fnv1a32:${(`00000000${hash.toString(16)}`).slice(-8)}`;
}

function storyConversationEnabled() {
    return typeof storyFeatureEnabled !== 'function'
        || (storyFeatureEnabled('characters.conversationUnderstanding')
            && storyFeatureEnabled('characters.conversationCases'));
}

function storyConversationContains(folded, patterns) {
    const padded = ` ${folded} `;
    return (patterns || []).some(pattern => {
        const key = storyConversationFold(pattern);
        return key && (padded.includes(` ${key} `) || folded.includes(key));
    });
}

function storyConversationDistance(a, b) {
    const left = storyConversationFold(a);
    const right = storyConversationFold(b);
    if (left === right) return 0;
    if (!left.length) return right.length;
    if (!right.length) return left.length;
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 1; i <= left.length; i++) {
        let diagonal = previous[0];
        previous[0] = i;
        for (let j = 1; j <= right.length; j++) {
            const old = previous[j];
            previous[j] = Math.min(
                previous[j] + 1,
                previous[j - 1] + 1,
                diagonal + (left[i - 1] === right[j - 1] ? 0 : 1)
            );
            diagonal = old;
        }
    }
    return previous[right.length];
}

function storyConversationApproxMention(folded, alias, options) {
    options = options && typeof options === 'object' ? options : {};
    const key = storyConversationFold(alias);
    if (!key) return null;
    const tokens = folded.split(' ');
    if (key.includes(' ')) {
        return ` ${folded} `.includes(` ${key} `)
            ? { confidenceBps: 10000, evidence: 'EXACT_NORMALIZED_ALIAS' } : null;
    }
    const exactSuffixes = ['lerden', 'lardan', 'inden', 'indan', 'den', 'dan', 'nin', 'in'];
    if (tokens.some(token => token === key
        || exactSuffixes.some(suffix => token === `${key}${suffix}`))) {
        return { confidenceBps: 10000, evidence: 'EXACT_NORMALIZED_ALIAS' };
    }
    let best = null;
    const fuzzyStopTokens = new Set([
        'musun', 'misin', 'mısın', 'müsün', 'mudur', 'midir', 'mıdır', 'müdür',
        'olsun', 'bilsin', 'dersin', 'desin'
    ].map(storyConversationFold));
    const minimumFuzzyLength = Math.max(5, Number(options.minimumFuzzyLength) || 5);
    for (const token of tokens) {
        if (fuzzyStopTokens.has(token)) continue;
        const forms = [token];
        for (const suffix of ['lerinden', 'larindan', 'lerden', 'lardan', 'inden', 'indan', 'den', 'dan', 'nin', 'in']) {
            if (token.endsWith(suffix) && token.length - suffix.length >= 5) forms.push(token.slice(0, -suffix.length));
        }
        for (const form of forms) {
            if (Math.abs(form.length - key.length) > 2
                || Math.min(form.length, key.length) < minimumFuzzyLength) continue;
            const distance = storyConversationDistance(form, key);
            if (distance <= 2 && (!best || distance < best.distance)) best = { token, distance };
        }
    }
    return best ? {
        confidenceBps: best.distance === 1 ? 9000 : 7800,
        evidence: `TYPO_TOLERANT_ALIAS:${best.token}`
    } : null;
}

function storyConversationPlayerActorId() {
    return STORY.commander ? `character:${STORY.playerStateId | 0}:${STORY.commander.id}` : null;
}

function storyConversationEntity(input) {
    return Object.assign({
        mention: '', role: 'SUBJECT', entityType: 'UNKNOWN', entityId: null,
        status: 'UNRESOLVED_REFERENCE', confidenceBps: 0, candidates: [], evidence: []
    }, input || {});
}

function storyConversationCountryAliases(state) {
    const aliases = [state && state.name];
    const byId = {
        0: ['turkiye', 'turk cumhuriyeti'],
        1: ['iber', 'ispanya', 'portekiz'],
        2: ['britanya', 'britanya toplulugu', 'ingiltere', 'birlesik krallik'],
        3: ['cermen', 'almanya'],
        4: ['kuzey pakti'],
        5: ['slav federasyonu'],
        6: ['magrip'],
        7: ['arap koalisyonu']
    };
    return aliases.concat(byId[state && state.id] || []).filter(Boolean);
}

function storyConversationResolveCountries(folded) {
    const matches = [];
    for (const state of (STORY.states || [])) {
        let best = null;
        for (const alias of storyConversationCountryAliases(state)) {
            const match = storyConversationApproxMention(folded, alias);
            if (match && (!best || match.confidenceBps > best.confidenceBps)) best = Object.assign({ alias }, match);
        }
        const ownedRegions = (STORY.nodes || []).filter(node => node.owner === state.id);
        for (const region of ownedRegions) {
            const match = storyConversationApproxMention(folded, region.name, { minimumFuzzyLength: 7 });
            if (match && match.confidenceBps >= 9000
                && (!best || match.confidenceBps > best.confidenceBps)) {
                best = Object.assign({ alias: region.name, regionId: `region:${region.id}` }, match);
            }
        }
        if (best) matches.push(storyConversationEntity({
            mention: best.alias,
            role: 'SUPPLIER_COUNTRY',
            entityType: 'COUNTRY',
            entityId: `country:${state.id}`,
            status: 'RESOLVED_PUBLIC',
            confidenceBps: best.confidenceBps,
            candidates: [`country:${state.id}`],
            evidence: [best.evidence].concat(best.regionId ? [`PUBLIC_REGION_OWNER:${best.regionId}`] : [])
        }));
    }
    return matches.sort((a, b) => b.confidenceBps - a.confidenceBps || a.entityId.localeCompare(b.entityId, 'en'));
}

function storyConversationResolveRegions(folded) {
    const rows = [];
    for (const region of (STORY.nodes || [])) {
        const match = storyConversationApproxMention(folded, region && region.name,
            { minimumFuzzyLength: 7 });
        if (!match || match.confidenceBps < 7800) continue;
        rows.push({
            regionId: `region:${region.id}`, name: String(region.name),
            ownerCountryId: `country:${region.owner}`, confidenceBps: match.confidenceBps,
            evidence: match.evidence
        });
    }
    return rows.sort((a, b) => b.confidenceBps - a.confidenceBps
        || a.regionId.localeCompare(b.regionId, 'en'));
}

function storyConversationResourceAliases(resource) {
    const aliases = [resource.id, resource.label];
    const extra = {
        food: ['gida', 'erzak', 'yiyecek'], energy: ['enerji', 'elektrik', 'yakıt', 'yakit'],
        raw_materials: ['hammadde', 'ham madde', 'maden'],
        industrial_parts: ['sanayi parcasi', 'sanayi parcalari', 'endustriyel parca'],
        electronics: ['elektronik'], military_supplies: ['askeri malzeme', 'muhimmat'],
        labor: ['emek', 'isgucu', 'iş gücü'], capital: ['sermaye', 'finansman']
    };
    return aliases.concat(extra[resource.id] || []).filter(Boolean);
}

function storyConversationResolveResource(folded) {
    // Çelik şu an sekiz kaynaklı fiziksel katalogda yoktur. Onu yakın görünen
    // raw_materials/industrial_parts'a çevirmek oyuncunun teklifini değiştirir.
    const steel = storyConversationApproxMention(folded, 'celik');
    if (steel) return storyConversationEntity({
        mention: 'çelik', role: 'COMMODITY', entityType: 'RESOURCE', entityId: null,
        status: 'UNRESOLVED_CATALOG_GAP', confidenceBps: steel.confidenceBps,
        candidates: ['raw_materials', 'industrial_parts'],
        evidence: [steel.evidence, 'RESOURCE_CATALOG_HAS_NO_STEEL']
    });
    const catalog = typeof storyResourceCatalogSnapshot === 'function'
        ? storyResourceCatalogSnapshot() : null;
    const matches = [];
    for (const resource of (catalog && catalog.resources || [])) {
        let best = null;
        for (const alias of storyConversationResourceAliases(resource)) {
            const match = storyConversationApproxMention(folded, alias);
            if (match && (!best || match.confidenceBps > best.confidenceBps)) best = Object.assign({ alias }, match);
        }
        if (best) matches.push(storyConversationEntity({
            mention: best.alias, role: 'COMMODITY', entityType: 'RESOURCE', entityId: resource.id,
            status: 'RESOLVED_PUBLIC', confidenceBps: best.confidenceBps,
            candidates: [resource.id], evidence: [best.evidence, `RESOURCE_CATALOG:${catalog.catalogHash}`]
        }));
    }
    return matches.sort((a, b) => b.confidenceBps - a.confidenceBps || a.entityId.localeCompare(b.entityId, 'en'))[0] || null;
}

function storyConversationKnownIds(context, kind) {
    const known = context && context.knownEntityIds;
    if (Array.isArray(known)) return known.filter(id => String(id).startsWith(`${kind}:`)).map(String);
    if (!known || typeof known !== 'object') return [];
    const singular = kind === 'shipment' ? 'shipments' : kind === 'order' ? 'orders' : `${kind}s`;
    return (Array.isArray(known[singular]) ? known[singular] : []).map(String).filter(id => id.startsWith(`${kind}:`));
}

function storyConversationResolveShipment(folded, context) {
    if (!storyConversationContains(folded, ['siparis', 'sevkiyat', 'kargo', 'yuk'])) return null;
    const known = storyConversationKnownIds(context, 'shipment');
    if (known.length === 1) return storyConversationEntity({
        mention: 'sevkiyat/sipariş', role: 'TARGET_SHIPMENT', entityType: 'SHIPMENT',
        entityId: known[0], status: 'KNOWN_CONTEXT_REFERENCE', confidenceBps: 9000,
        candidates: known, evidence: ['EXPLICIT_SESSION_KNOWLEDGE']
    });
    return storyConversationEntity({
        mention: 'sevkiyat/sipariş', role: 'TARGET_SHIPMENT', entityType: 'SHIPMENT',
        status: known.length > 1 ? 'AMBIGUOUS_REFERENCE' : 'UNRESOLVED_REFERENCE',
        confidenceBps: known.length ? 5000 : 0, candidates: known,
        evidence: [known.length ? 'MULTIPLE_KNOWN_SESSION_REFERENCES' : 'NO_PLAYER_KNOWN_SHIPMENT_ID']
    });
}

function storyConversationResolvePlayerAssets(folded) {
    const result = [];
    const commander = STORY.commander || {};
    const companyId = String(commander.organizationId || '');
    const company = companyId && typeof storyCompanyById === 'function' ? storyCompanyById(companyId) : null;
    if (storyConversationContains(folded, ['sirket', 'firmam', 'sirketim']) && company) {
        result.push(storyConversationEntity({
            mention: 'şirketim', role: 'PLAYER_ORGANIZATION', entityType: 'COMPANY',
            entityId: company.id, status: 'RESOLVED_OWNED', confidenceBps: 10000,
            candidates: [company.id], evidence: ['PLAYER_ROLE_ORGANIZATION']
        }));
    }
    if (!storyConversationContains(folded, ['depom', 'depolarim', 'depo'])) return result;
    const warehouseIds = company && Array.isArray(company.warehouseIds) ? company.warehouseIds.slice().sort() : [];
    if (warehouseIds.length === 1) result.push(storyConversationEntity({
        mention: 'depom', role: 'DESTINATION', entityType: 'WAREHOUSE', entityId: warehouseIds[0],
        status: 'RESOLVED_OWNED', confidenceBps: 10000, candidates: warehouseIds,
        evidence: ['PLAYER_OWNED_SINGLE_WAREHOUSE']
    }));
    else result.push(storyConversationEntity({
        mention: 'depolarım', role: 'DESTINATION', entityType: 'WAREHOUSE', entityId: null,
        status: warehouseIds.length ? 'AMBIGUOUS_REFERENCE' : 'UNRESOLVED_REFERENCE',
        confidenceBps: warehouseIds.length ? 6000 : 0, candidates: warehouseIds,
        evidence: [warehouseIds.length ? 'MULTIPLE_PLAYER_OWNED_WAREHOUSES' : 'PLAYER_HAS_NO_OWNED_WAREHOUSE']
    }));
    return result;
}

function storyConversationSpeechAct(folded, raw) {
    const scores = {};
    const add = (act, points) => { scores[act] = (scores[act] || 0) + points; };
    if (storyConversationContains(folded, ['sirket kur', 'sirketi kur', 'firma kur'])
        && storyConversationContains(folded, ['yonlendirelim', 'anlasalim', 'teklif', 'siparis'])) add('PROPOSE_COMMERCIAL_DEAL', 16);
    if (storyConversationContains(folded, ['yonlendirelim', 'anlasma', 'ortaklik', 'satin alalim'])) add('PROPOSE_COMMERCIAL_DEAL', 9);
    if (storyConversationContains(folded, ['yoksa', 'aksi halde', 'bedelini odersin', 'zarar veririm', 'mahvederim'])) add('THREATEN', 14);
    if (storyConversationContains(folded, ['soz veriyorum', 'taahhut ediyorum', 'ben halledecegim', 'yapacagim'])) add('MAKE_PROMISE', 10);
    if (storyConversationContains(folded, ['aramizda kalsin', 'gizli bilgi', 'bu bir sir', 'kimseye soyleme',
        'gizli bir bilgim var', 'gizli sir', 'sir bilgi', 'sirrim var', 'bir sirrim var'])) add('SHARE_SECRET', 12);
    if (storyConversationContains(folded, ['blof yapiyorum', 'blöf yapıyorum'])) add('BLUFF_CANDIDATE', 16);
    if (storyConversationContains(folded, ['suclusun', 'sen yaptin', 'ihanet ettin', 'sorumlusu sensin'])) add('ACCUSE', 11);
    if (storyConversationContains(folded, ['yardim ederim', 'destek olurum', 'yanindayim'])) add('OFFER_SUPPORT', 9);
    if (storyConversationContains(folded, ['kabul etmiyorum', 'reddediyorum', 'olmaz', 'bir sey soyleme', 'birsey soyleme'])) add('REJECT', 9);
    if (storyConversationContains(folded, ['karsilik olarak', 'ama su sartla', 'buna karsilik'])) add('COUNTER_OFFER', 9);
    if (storyConversationContains(folded, ['pay talep', 'hisse talep', 'kazanc talep'])
        && storyConversationContains(folded, ['sunuyorum', 'teklif ediyorum', 'karsiliginda'])) {
        add('COUNTER_OFFER', 13);
    }
    if (storyConversationContains(folded, ['merhaba', 'selam', 'gunaydin', 'iyi gunler'])) add('GREETING', 13);
    if (storyConversationContains(folded, ['nasilsin', 'nasilsiniz', 'nasil gidiyor', 'keyfin nasil', 'gunun nasil', 'bugunun nasil'])) add('CHECK_IN', 15);
    if (storyConversationContains(folded, ['tesekkur ederim', 'tesekkurler', 'sag ol', 'minnettarim'])) add('THANK', 14);
    if (storyConversationContains(folded, ['ozur dilerim', 'kusura bakma', 'affedersin'])) add('APOLOGIZE', 14);
    if (storyConversationContains(folded, ['gorusuruz', 'hosca kal', 'kendine iyi bak', 'sonra konusuruz',
        'gule gule', 'ben gidiyorum', 'tekrar donecegim', 'baska zaman donecegim'])) add('FAREWELL', 14);
    if (storyConversationContains(folded, ['sence', 'ne dusunuyorsun', 'fikrin ne', 'senin gorusun'])) add('ASK_PERSONAL_OPINION', 13);
    if (storyConversationContains(folded, ['yardim eder misin', 'yardim edecek misin', 'yardim icin gelir misin',
        'yardim gerekiyor', 'yardim lazim', 'destek olur musun', 'destek verir misin', 'destegine ihtiyacim var'])) add('REQUEST_SUPPORT', 16);
    const supportRequestRoot = /(?:^|\s)(?:yardim|yardimini|yardimina|destek|destegi|destegini|destegine)(?:\s|$)/.test(folded);
    const supportRequestForm = storyConversationContains(folded, [
        'isterim', 'istesem', 'istiyorum', 'ihtiyacim var', 'kabul eder misin',
        'verir misin', 'eder misin', 'olur musun', 'gelir misin'
    ]);
    if (supportRequestRoot && supportRequestForm) add('REQUEST_SUPPORT', 16);
    if (storyConversationContains(folded, ['bana guveniyor musun', 'bana guvenir misin',
        'bana guvenin var mi', 'bana güveniyor musun'])) add('ASK_RELATIONSHIP', 18);
    if (storyConversationContains(folded, ['aramizdaki guven', 'bana olan guven',
        'iliskimizi nasil', 'iliskimiz hakkinda', 'guven konusunda ne dusunuyorsun'])) {
        add('ASK_RELATIONSHIP', 17);
    }
    if (storyConversationContains(folded, ['sana guvenmiyorum', 'size guvenmiyorum', 'aramiz kotu',
        'aramiz iyi degil']) || folded === 'guven') add('ASK_RELATIONSHIP', 15);
    const relationshipWordQuestion = (String(raw || '').includes('?')
        || storyConversationContains(folded, ['neden', 'nasil', 'nerede', 'ne zaman']))
        && folded.split(/\s+/).some(word =>
            /^(guven|guvenim|guvenin|guvenimiz|guveniniz|iliskimiz|iliskimizi|itibarimiz)$/.test(word));
    if (relationshipWordQuestion) add('ASK_RELATIONSHIP', 16);
    if (storyConversationContains(folded, ['dusman ordusu gordum', 'dusman askerleri gordum',
        'buyuk bir dusman gucu', 'asker yigiliyor', 'asker toplaniyor'])) add('REPORT_MILITARY', 18);
    if (storyConversationContains(folded, ['devlet hazinesi', 'hazine', 'kamu butcesi'])
        && storyConversationContains(folded, ['bosaliyor', 'eriyor', 'azaliyor', 'tukeniyor', 'acik veriyor'])) {
        add('REPORT_ECONOMIC', 18);
    }
    if (storyConversationContains(folded, ['ilk defa konusuyoruz', 'ilk kez konusuyoruz',
        'seninle ilk defa', 'daha once konusmadik', 'hayir sen', 'yanlis soyluyorsun'])) add('CORRECT_STATEMENT', 17);
    if (storyConversationContains(folded, ['bozuk musun', 'beni anlamiyor musun',
        'ne sacmaliyorsun', 'neden boylesin', 'kendi kendime konusuyorum',
        'gule guleyi de mi anlamadin'])) add('CHALLENGE', 16);
    if (storyConversationContains(folded, ['bana bir gorev ver', 'bana gorev ver', 'bana is ver'])) add('REQUEST_ACTION', 18);
    if (storyConversationContains(folded, ['bana verebilecegin bir gorev', 'bana verebileceginiz bir gorev',
        'bana verebilecegin gorev', 'bana verebileceginiz gorev',
        'verebilecegin bir gorev var mi', 'verebileceginiz bir gorev var mi',
        'verebilecegin gorev var mi', 'verebileceginiz gorev var mi'])) add('REQUEST_ACTION', 18);
    if (storyConversationContains(folded, ['is verebilecek tanidigin', 'gorev verebilecek tanidigin',
        'tanidikta mi yok', 'tanidik da mi yok', 'benden istedigin bir sey var mi',
        'benden istediginiz bir sey var mi'])) add('REQUEST_ACTION', 17);
    if (storyConversationContains(folded, ['biraz konusalim', 'sohbet edelim', 'hava guzel',
        'hava sicak', 'hava soguk', 'hava yagmurlu', 'sicaklar', 'laflayalim',
        'bir seyler de', 'birseyler de', 'soyleyecegin bir sey yok mu',
        'soyleyeceginiz bir sey yok mu'])) add('SMALL_TALK', 12);
    if (storyConversationContains(folded, ['beni uzuyor', 'beni uzdun', 'uzuldum', 'kirildim'])
        && storyConversationContains(folded, ['uydur', 'sucla', 'dusun'])) add('CHALLENGE', 17);
    if (storyConversationContains(folded, ['peki', 'tamam', 'anladim', 'olur'])) add('SMALL_TALK', 8);
    if (String(raw || '').includes('?') || /(?:^|\s)(mi|mı|mu|mü|misin|mısın|musun|müsün|misiniz|mısınız|musunuz|müsünüz)(?:\s|$)/i.test(String(raw || ''))
        || storyConversationContains(folded, ['neden', 'nasil', 'ne zaman', 'nerede', 'kim', 'hangi'])) add('ASK_INFORMATION', 7);
    if (storyConversationContains(folded, ['istiyorum', 'talep ediyorum', 'yap', 'gonder', 'yonlendir',
        'is var mi', 'isiniz var mi', 'is verebilir', 'calisabilecegim'])) add('REQUEST_ACTION', 9);
    const ranked = Object.keys(scores).sort((a, b) => scores[b] - scores[a] || a.localeCompare(b, 'en'));
    return {
        primary: ranked[0] || 'UNKNOWN',
        secondary: ranked.slice(1, 4).filter(key => scores[key] >= 5),
        scores
    };
}

function storyConversationHasExactGroundingEntity(entities) {
    return (entities || []).some(entity => entity && entity.entityId
        && entity.entityType !== 'CHARACTER'
        && Array.isArray(entity.evidence)
        && entity.evidence.includes('EXACT_NORMALIZED_ALIAS'));
}

function storyConversationHasGameDomainLanguage(folded) {
    const roots = [
        'asker', 'ordu', 'birlik', 'birlig', 'tabur', 'cephe', 'sinir', 'garnizon', 'filo',
        'abluka', 'komutan', 'savas', 'ateskes', 'ekonomi', 'butce', 'hazine',
        'enflasyon', 'rezerv', 'fiyat', 'piyasa', 'borc', 'nakit', 'refah',
        'gelir', 'gider', 'issizlik', 'sirket', 'ticaret', 'banka', 'yatirim',
        'ithalat', 'ihracat', 'gumruk', 'liman', 'fabrika', 'dinar', 'sermaye',
        'sevkiyat', 'konvoy', 'depo', 'tasi', 'tahil', 'yakit', 'kaynak',
        'yonetim', 'hukumet',
        'kabine', 'vali', 'bakan', 'meclis', 'secim', 'kararname', 'anayasa',
        'devlet', 'ulke', 'ittifak', 'anlasma', 'elci', 'mustesar', 'gorev',
        'islerin', 'calis', 'proje', 'toplanti',
        'muzakere', 'arastirma', 'teknoloji', 'tesis', 'sehir', 'rota', 'guven',
        'iliski', 'itibar', 'gizli', 'operasyon', 'aramiz', 'kimse',
        'dezenformasyon', 'etkinlik'
    ];
    const tokens = String(folded || '').split(/\s+/).filter(Boolean);
    const boundedShortForm = tokens.some(token =>
        /^(?:isi|isin|isiniz|isinizin|yuk|yuku|yukun|yukler|yukleri)$/.test(token));
    return boundedShortForm
        || tokens.some(token => roots.some(root => token.startsWith(root)));
}

function storyConversationBoundedDomainGrounded(folded, frame, entities) {
    if (storyConversationContains(folded, ['anlamadim', 'tekrar soyle', 'ne demek'])) {
        return true;
    }
    if (storyConversationHasGameDomainLanguage(folded)) return true;
    if (frame && ['WEATHER', 'HEALTH', 'EMOTION', 'IDENTITY']
        .includes(frame.predicate)) return false;
    return storyConversationHasExactGroundingEntity(entities);
}

function storyConversationBoundedAct(act, folded, frame, entities) {
    if (!act) return act;
    const speechActMention = (act.primary === 'GREETING'
        && storyConversationContains(folded,
            ['kelime', 'cevir', 'japonca', 'ingilizce', 'turkce']))
        || (act.primary === 'APOLOGIZE'
            && !storyConversationContains(folded,
                ['ozur dilerim', 'ozur diliyorum', 'kusura bakma', 'affedersin']));
    const genericUngrounded = ['ASK_INFORMATION', 'REQUEST_ACTION'].includes(act.primary)
        && !storyConversationBoundedDomainGrounded(folded, frame, entities);
    if (!speechActMention && !genericUngrounded) return act;
    return Object.assign({}, act, {
        primary: 'UNKNOWN', secondary: [], source: 'BOUNDED_DOMAIN_ABSTENTION'
    });
}

function storyConversationTone(folded, speechAct) {
    if (speechAct === 'THREATEN') return 'HOSTILE';
    if (speechAct === 'ACCUSE') return 'CONFRONTATIONAL';
    if (storyConversationContains(folded, ['lutfen', 'rica', 'mumkun mu'])) return 'POLITE';
    if (storyConversationContains(folded, ['hemen', 'derhal', 'zorundayiz'])) return 'URGENT';
    return ['PROPOSE_COMMERCIAL_DEAL', 'COUNTER_OFFER'].includes(speechAct) ? 'NEGOTIATING' : 'NEUTRAL';
}

function storyConversationFailure(code, raw) {
    const folded = storyConversationFold(raw).slice(0, STORY_CONVERSATION_MAX_INPUT);
    return {
        schemaVersion: STORY_CONVERSATION_UNDERSTANDING_SCHEMA_VERSION,
        adapterVersion: STORY_CONVERSATION_UNDERSTANDING_ADAPTER_VERSION,
        ok: false, code, analysisId: `conversation-analysis:${storyConversationHash(`${code}|${folded}`).slice(9)}`,
        inputHash: storyConversationHash(folded), language: 'tr', source: STORY_CONVERSATION_UNDERSTANDING_SOURCE,
        worldMutation: false, speechAct: 'UNKNOWN', secondaryActs: [], playerIntent: 'UNKNOWN',
        topic: 'UNKNOWN', tone: 'NEUTRAL', attribution: 'PLAYER', entities: [], claims: [], requests: [],
        offeredConsideration: [], unresolvedTerms: [], ambiguityLevel: 'HIGH', ambiguityBps: 10000,
        riskLevel: 'LOW', requiresConfirmation: false, confirmationQuestions: [], proposedCommand: null,
        commandBlockedReasons: [code], diagnostics: { inputLength: String(raw == null ? '' : raw).length, entityCount: 0 }
    };
}

function storyConversationAnalyze(raw, context) {
    const sourceText = String(raw == null ? '' : raw);
    if (!storyConversationEnabled()) return storyConversationFailure('FEATURE_DISABLED', sourceText);
    if (!sourceText.trim()) return storyConversationFailure('EMPTY_INPUT', sourceText);
    if (sourceText.length > STORY_CONVERSATION_MAX_INPUT) return storyConversationFailure('INPUT_TOO_LONG', sourceText);
    const folded = storyConversationFold(sourceText);
    if (!folded) return storyConversationFailure('EMPTY_INPUT', sourceText);
    context = context && typeof context === 'object' ? context : {};

    const semanticFrame = typeof storyConversationSemanticFrameCompile === 'function'
        ? storyConversationSemanticFrameCompile(sourceText, context) : null;
    const legacyAct = storyConversationSpeechAct(folded, sourceText);
    let act = typeof storyConversationSemanticFrameFuse === 'function'
        ? storyConversationSemanticFrameFuse(legacyAct, semanticFrame) : legacyAct;
    const countries = storyConversationResolveCountries(folded);
    const regions = storyConversationResolveRegions(folded);
    const resource = storyConversationResolveResource(folded);
    const shipment = storyConversationResolveShipment(folded, context);
    const playerAssets = storyConversationResolvePlayerAssets(folded);
    const entities = countries.concat(resource ? [resource] : [], shipment ? [shipment] : [], playerAssets);
    if (context.listenerActorId && storyConversationContains(folded, ['sen', 'senin', 'sana'])) {
        entities.push(storyConversationEntity({
            mention: 'sen', role: 'LISTENER', entityType: 'CHARACTER', entityId: String(context.listenerActorId),
            status: 'KNOWN_CONTEXT_REFERENCE', confidenceBps: 10000,
            candidates: [String(context.listenerActorId)], evidence: ['ACTIVE_CONVERSATION_LISTENER']
        }));
    }
    act = storyConversationBoundedAct(act, folded, semanticFrame, entities);

    const commercial = act.primary === 'PROPOSE_COMMERCIAL_DEAL';
    const founding = storyConversationContains(folded, [
        'sirket kur', 'sirketi kur', 'sirket ac', 'firma kur', 'firma ac', 'fabrika kur'
    ]) || (storyConversationContains(folded, ['sirket', 'firma', 'fabrika'])
        && storyConversationContains(folded, ['kur', 'ac']));
    const redirect = storyConversationContains(folded, ['yonlendir', 'aktar', 'depoma gonder', 'depolarima']);
    const knowledgeClaim = storyConversationContains(folded, ['biliyorum', 'haberim var', 'ogrendim']);
    const claims = [];
    if (shipment && (knowledgeClaim || countries.length)) claims.push({
        id: 'claim:existing-import-order', type: 'EXISTING_IMPORT_ORDER',
        claimantActorId: storyConversationPlayerActorId(), buyerActorId: context.listenerActorId || null,
        supplierCountryId: countries[0] && countries[0].entityId || null,
        targetShipmentId: shipment.entityId,
        truthStatus: 'UNVERIFIED_IN_CONVERSATION', verificationSource: null
    });
    const reportsOwnLocation = /(?:^|\s)[a-z0-9:_-]+(?:de|da|te|ta)yim(?:\s|$)/.test(folded)
        || storyConversationContains(folded, ['de bulunuyorum', 'da bulunuyorum']);
    if (reportsOwnLocation && regions[0]) claims.push({
        id: `claim:player-reported-location:${regions[0].regionId}`,
        type: 'PLAYER_REPORTED_LOCATION', claimantActorId: storyConversationPlayerActorId(),
        subjectActorId: storyConversationPlayerActorId(), regionId: regions[0].regionId,
        regionName: regions[0].name, truthStatus: 'UNVERIFIED_PLAYER_REPORT', verificationSource: null
    });
    const reportsThreat = regions.length && (
        storyConversationContains(folded, ['dusman', 'tehdit', 'yogunlas', 'saldiri', 'isgal'])
        || (storyConversationContains(folded, ['birlik', 'ordu', 'asker'])
            && storyConversationContains(folded, ['gordum', 'toplaniyor', 'yigiliyor', 'ilerliyor']))
    );
    if (reportsThreat) claims.push({
        id: `claim:player-reported-threat:${regions.map(row => row.regionId).join(':')}`,
        type: 'PLAYER_REPORTED_MILITARY_THREAT', claimantActorId: storyConversationPlayerActorId(),
        regionIds: regions.map(row => row.regionId), regionNames: regions.map(row => row.name),
        truthStatus: 'UNVERIFIED_PLAYER_REPORT', verificationSource: null
    });
    const reportedMoney = folded.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(dinar(?:im|imiz)?|lira(?:m|miz)?|sermaye(?:m|miz)?|nakit|para(?:m|miz)?)(?:\s|$)/i);
    if (reportedMoney) claims.push({
        id: `claim:player-reported-budget:${storyConversationHash(reportedMoney[0]).slice(9)}`,
        type: 'PLAYER_REPORTED_BUDGET', claimantActorId: storyConversationPlayerActorId(),
        amountText: reportedMoney[1], currencyText: reportedMoney[2].replace(/(?:im|imiz|m|miz)$/i, ''),
        truthStatus: 'UNVERIFIED_PLAYER_REPORT', verificationSource: null
    });
    const reportsTreasury = storyConversationContains(folded, ['devlet hazinesi', 'hazine', 'kamu butcesi'])
        && storyConversationContains(folded, ['bosaliyor', 'eriyor', 'azaliyor', 'tukeniyor', 'acik veriyor']);
    if (reportsTreasury) claims.push({
        id: `claim:player-reported-treasury:${storyConversationHash(folded).slice(9)}`,
        type: 'PLAYER_REPORTED_TREASURY_CONDITION', claimantActorId: storyConversationPlayerActorId(),
        subjectCountryId: `country:${STORY.playerStateId | 0}`,
        truthStatus: 'UNVERIFIED_PLAYER_REPORT', verificationSource: null
    });
    const reportsSharedHistory = storyConversationContains(folded, [
        'ortak bir proje yapmistik', 'ortak proje yapmistik', 'ortak bir proje yapmistim',
        'birlikte calismistik', 'bu gorevi sen vermistin', 'bu isi sen vermistin',
        'daha once bana gorev verdin', 'daha once bana is verdin'
    ]);
    if (reportsSharedHistory) claims.push({
        id: `claim:player-reported-shared-history:${storyConversationHash(folded).slice(9)}`,
        type: 'PLAYER_REPORTED_SHARED_HISTORY', claimantActorId: storyConversationPlayerActorId(),
        allegedCounterpartyActorId: context.listenerActorId || null,
        truthStatus: 'UNVERIFIED_PLAYER_REPORT', verificationSource: null
    });
    const requests = [];
    if (redirect) requests.push({
        id: 'request:redirect-shipment', type: 'REDIRECT_SHIPMENT',
        targetShipmentId: shipment && shipment.entityId || null,
        destinationId: (playerAssets.find(row => row.entityType === 'WAREHOUSE') || {}).entityId || null,
        requestedFromActorId: context.listenerActorId || null
    });
    const militaryUnitWord = folded.split(/\s+/).some(word =>
        /^(birlik|birlikler|birligi|birlikleri|birliklerin|birligin)$/.test(word));
    const militaryContext = militaryUnitWord || storyConversationContains(folded, [
        'dusman', 'ordu', 'asker', 'cephe', 'sinir', 'askeri'
    ]);
    if (act.primary === 'REQUEST_SUPPORT' && militaryContext) requests.push({
        id: 'request:military-support', type: 'REQUEST_MILITARY_SUPPORT',
        requestedFromActorId: context.listenerActorId || null,
        reportedRegionIds: regions.map(row => row.regionId),
        evidenceStatus: reportsThreat ? 'PLAYER_REPORT_UNVERIFIED' : 'NO_THREAT_EVIDENCE'
    });

    const unresolved = new Set();
    if (commercial) {
        ['quantity', 'ownership', 'payment', 'delivery_schedule', 'contract_penalty', 'required_approval']
            .forEach(term => unresolved.add(term));
    }
    if (founding) unresolved.add('company_registration');
    if (resource && resource.status === 'UNRESOLVED_CATALOG_GAP') unresolved.add('commodity_identity');
    if (shipment && !shipment.entityId) unresolved.add('shipment_identity');
    const warehouse = playerAssets.find(row => row.entityType === 'WAREHOUSE');
    if (redirect && (!warehouse || !warehouse.entityId)) unresolved.add('destination_warehouse');
    if (redirect) unresolved.add('warehouse_capacity');

    const highImpact = commercial || redirect || ['THREATEN', 'MAKE_PROMISE', 'SHARE_SECRET', 'BLUFF_CANDIDATE'].includes(act.primary);
    const unresolvedEntities = entities.filter(row => !row.entityId || row.status === 'AMBIGUOUS_REFERENCE');
    const ambiguityLevel = unresolvedEntities.length || unresolved.size >= 3 ? 'HIGH'
        : unresolved.size ? 'MEDIUM' : 'LOW';
    const ambiguityBps = ambiguityLevel === 'HIGH' ? 9000 : ambiguityLevel === 'MEDIUM' ? 5000 : 1000;
    const confirmationQuestions = [];
    if (unresolved.has('commodity_identity')) confirmationQuestions.push('Çelik hangi kanonik kaynak sınıfıyla izlenecek?');
    if (unresolved.has('shipment_identity')) confirmationQuestions.push('Hangi sipariş veya sevkiyatı kastediyorsunuz?');
    if (unresolved.has('destination_warehouse')) confirmationQuestions.push('Hangi deponuza yönlendirmek istiyorsunuz?');
    if (unresolved.has('quantity')) confirmationQuestions.push('Miktar ve ödeme koşulları nedir?');

    const commandBlockedReasons = ['WORLD_MUTATION_FORBIDDEN_PHASE_38_1'];
    if (unresolved.size) commandBlockedReasons.push('UNRESOLVED_TERMS');
    if (claims.some(row => String(row.truthStatus || '').startsWith('UNVERIFIED'))) commandBlockedReasons.push('UNVERIFIED_CLAIM');
    if (redirect) commandBlockedReasons.push('AUTHORITY_NOT_CHECKED');

    const diplomaticContext = storyConversationContains(folded, [
        'diplomasi', 'dis iliski', 'disisleri', 'ittifak', 'antlasma',
        'baris gorus', 'ateskes', 'buyukelci', 'elcilik'
    ]);
    const politicalContext = storyConversationContains(folded, [
        'yonetim', 'hukumet', 'iktidar', 'muhalefet', 'bakan', 'parlamento',
        'meclis', 'secim', 'parti', 'anayasa', 'yasa', 'siyasi', 'siyaset'
    ]);
    const economicContext = storyConversationContains(folded, [
        'ekonomi', 'ekonomik', 'butce', 'hazine', 'enflasyon', 'fiyat', 'piyasa',
        'borc', 'nakit', 'refah', 'gelir', 'gider', 'issizlik', 'sirket', 'ticaret'
    ]);
    const relationshipContext = act.primary === 'ASK_RELATIONSHIP'
        || storyConversationContains(folded, [
            'iliskimiz', 'iliskimizi', 'aramizdaki iliski', 'aramizdaki guven',
            'aramizdaki itibar', 'aramizda guven', 'bana olan guven', 'guven duzeyi',
            'guven konusunda', 'aramiz nasil',
            'bana guven', 'sana guven', 'guvenimi', 'guvenimizi',
            'itibarim', 'itibarimiz', 'husumet', 'bana bakisin'
        ]);
    const economicSignals = economicContext ? [
        storyConversationContains(folded, ['butce', 'borc', 'nakit', 'gelir', 'gider']) ? 'BUDGET' : null,
        storyConversationContains(folded, ['enflasyon', 'fiyat', 'piyasa']) ? 'INFLATION' : null,
        storyConversationContains(folded, ['hazine', 'petrol', 'insan gucu', 'kaynak']) ? 'RESOURCES' : null,
        storyConversationContains(folded, ['refah', 'issizlik']) ? 'WELFARE' : null,
        storyConversationContains(folded, ['son donem', 'degisti', 'degisim', 'artti', 'azaldi']) ? 'TREND' : null
    ].filter(Boolean) : [];
    const economicScope = economicContext && storyConversationContains(folded, [
        'sirket', 'sirketim', 'sirketimiz', 'sirketiniz', 'firma', 'firmam', 'firmamiz',
        'firmaniz'
    ]) && !storyConversationContains(folded, [
        'devlet ekonom', 'ulke ekonom', 'ulkemizin ekonom', 'ulkenizin ekonom',
        'kamu butce', 'devlet butce', 'devlet hazine', 'makroekonom'
    ]) ? 'COMPANY' : economicContext ? 'COUNTRY' : 'NONE';
    const result = {
        schemaVersion: STORY_CONVERSATION_UNDERSTANDING_SCHEMA_VERSION,
        adapterVersion: STORY_CONVERSATION_UNDERSTANDING_ADAPTER_VERSION,
        ok: true, code: 'ANALYZED',
        analysisId: `conversation-analysis:${storyConversationHash(`${folded}|${context.listenerActorId || '-'}|${storyConversationKnownIds(context, 'shipment').join(',')}`).slice(9)}`,
        inputHash: storyConversationHash(folded), language: 'tr', source: STORY_CONVERSATION_UNDERSTANDING_SOURCE,
        worldMutation: false, speechAct: act.primary, secondaryActs: act.secondary,
        semanticFrame,
        playerIntent: founding && resource && resource.mention === 'çelik' ? 'FOUND_STEEL_COMPANY'
            : founding ? 'FOUND_COMPANY' : redirect ? 'REDIRECT_SHIPMENT'
                : act.primary === 'REQUEST_SUPPORT' && militaryContext ? 'REQUEST_MILITARY_SUPPORT'
                : STORY_CONVERSATION_SOCIAL_ACTS.includes(act.primary) ? `SOCIAL_${act.primary}` : 'UNSPECIFIED',
        topic: commercial ? 'COMMERCE' : militaryContext ? 'MILITARY'
            : diplomaticContext ? 'DIPLOMACY'
            : politicalContext ? 'POLITICS'
            : relationshipContext ? 'RELATIONSHIP'
            : economicContext ? 'ECONOMY'
            : ['THREATEN', 'ACCUSE'].includes(act.primary) ? 'CONFLICT'
            : act.primary === 'ASK_INFORMATION' ? 'INFORMATION'
                : STORY_CONVERSATION_SOCIAL_ACTS.includes(act.primary) ? 'SOCIAL' : 'GENERAL',
        tone: storyConversationTone(folded, act.primary), attribution: 'PLAYER',
        entities, claims, requests, offeredConsideration: [], unresolvedTerms: Array.from(unresolved).sort(),
        ambiguityLevel, ambiguityBps, riskLevel: highImpact ? 'HIGH' : 'LOW',
        requiresConfirmation: !!(highImpact && (ambiguityLevel !== 'LOW' || claims.length || redirect)),
        confirmationQuestions, proposedCommand: null, commandBlockedReasons,
        diagnostics: {
            inputLength: sourceText.length, normalizedTokenCount: folded.split(' ').length,
            entityCount: entities.length, resolvedEntityCount: entities.filter(row => !!row.entityId).length,
            unresolvedEntityCount: unresolvedEntities.length, classifierScores: act.scores,
            classifierSource: act.source || 'LEGACY_PHRASE_SCORER',
            economicSignals, economicScope,
            relationshipSignals: relationshipContext ? ['DIRECTIONAL_RELATIONSHIP'] : [],
            rawTradeLedgerRead: false, llmUsed: false,
            playerReportCount: claims.filter(row => row.truthStatus === 'UNVERIFIED_PLAYER_REPORT').length
        }
    };
    const validation = storyConversationValidate(result);
    return validation.ok ? result : storyConversationFailure('INTERNAL_VALIDATION_FAILED', sourceText);
}

function storyConversationValidate(candidate) {
    const issues = [];
    const add = (code, path) => issues.push({ code, path });
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return { ok: false, issues: [{ code: 'OBJECT_REQUIRED', path: '$' }] };
    }
    if (candidate.schemaVersion !== STORY_CONVERSATION_UNDERSTANDING_SCHEMA_VERSION) add('SCHEMA_VERSION', '$.schemaVersion');
    if (candidate.adapterVersion !== STORY_CONVERSATION_UNDERSTANDING_ADAPTER_VERSION) add('ADAPTER_VERSION', '$.adapterVersion');
    if (candidate.worldMutation !== false) add('WORLD_MUTATION', '$.worldMutation');
    if (candidate.proposedCommand !== null) add('COMMAND_MUST_BE_NULL', '$.proposedCommand');
    if (!STORY_CONVERSATION_SPEECH_ACTS.includes(candidate.speechAct)) add('SPEECH_ACT', '$.speechAct');
    if (!STORY_CONVERSATION_AMBIGUITY.includes(candidate.ambiguityLevel)) add('AMBIGUITY', '$.ambiguityLevel');
    if (!STORY_CONVERSATION_RISK.includes(candidate.riskLevel)) add('RISK', '$.riskLevel');
    for (const [index, entity] of (candidate.entities || []).entries()) {
        if (!STORY_CONVERSATION_ENTITY_STATUSES.includes(entity.status)) add('ENTITY_STATUS', `$.entities[${index}].status`);
        if (entity.status === 'UNRESOLVED_CATALOG_GAP' && entity.entityId != null) add('CATALOG_GAP_BOUND', `$.entities[${index}].entityId`);
    }
    if (candidate.riskLevel === 'HIGH' && candidate.ambiguityLevel === 'HIGH' && !candidate.requiresConfirmation) {
        add('HIGH_RISK_CONFIRMATION', '$.requiresConfirmation');
    }
    return { ok: issues.length === 0, issues };
}

function storyConversationContract() {
    return storyConversationClone({
        schemaVersion: STORY_CONVERSATION_UNDERSTANDING_SCHEMA_VERSION,
        adapterVersion: STORY_CONVERSATION_UNDERSTANDING_ADAPTER_VERSION,
        source: STORY_CONVERSATION_UNDERSTANDING_SOURCE,
        speechActs: STORY_CONVERSATION_SPEECH_ACTS,
        entityStatuses: STORY_CONVERSATION_ENTITY_STATUSES,
        mutationPolicy: 'ANALYSIS_ONLY_NO_WORLD_COMMAND',
        privacyPolicy: 'PUBLIC_OWNED_OR_EXPLICIT_SESSION_KNOWLEDGE_ONLY'
    });
}

// ── ÇOK TURLU ANLAMA OTURUMU ------------------------------------------------
// NegotiationCase değildir: karakter henüz kabul/ret vermemiş, dünya komutu
// oluşmamıştır. Oyuncunun cümle ve açıklamalarını kaybolmayan, sınırlandırılmış
// bir mekanik inceleme adayına taşır. Gerçek söz/borç/anlaşma Faz 38.3'e aittir.
const STORY_CONVERSATION_SESSION_SCHEMA_VERSION = 7;
const STORY_CONVERSATION_SESSION_ADAPTER_VERSION = 'story-conversation-session-ledger-7';
const STORY_CONVERSATION_SESSION_LIMIT = 32;
const STORY_CONVERSATION_TASK_OFFER_LIMIT = 64;
const STORY_CONVERSATION_TASK_OFFER_SCHEMA_VERSION = 3;
const STORY_CONVERSATION_MEETING_OUTCOME_RECEIPT_SCHEMA_VERSION = 2;
const STORY_CONVERSATION_TASK_OFFER_KINDS = Object.freeze([
    'PERSONAL_CONTACT_REQUEST', 'INSTITUTIONAL_PAID_CONTACT_TASK'
]);
const STORY_CONVERSATION_MEETING_LIMIT = 16;
const STORY_CONVERSATION_TURN_LIMIT = 24;
const STORY_CONVERSATION_HISTORY_TOKEN_BUDGET = 6000;
const STORY_CONVERSATION_CASE_SCHEMA_VERSION = 1;
const STORY_CONVERSATION_CASE_MODES = Object.freeze([
    'DAILY_CHAT', 'TASKS_JOBS', 'CONFIDENTIALITY',
    'REPORT_DECLARATION', 'OFFER_NEGOTIATION', 'FORMAL_MEETING'
]);
const STORY_CONVERSATION_CASE_MODE_STATUS = Object.freeze({
    DAILY_CHAT: 'LIVE',
    TASKS_JOBS: 'LIVE_TASK_OFFER_ADAPTER',
    CONFIDENTIALITY: 'PARTIAL_SECRET_LEDGER_AVAILABLE',
    REPORT_DECLARATION: 'PARTIAL_UNVERIFIED_CLAIM_LEDGER',
    OFFER_NEGOTIATION: 'LIVE_NEGOTIATION_CASE_AVAILABLE',
    FORMAL_MEETING: 'LIVE_MEETING_CASE_SHELL'
});
const STORY_CONVERSATION_DOMAIN_REVIEW_SCHEMA_VERSION = 1;
const STORY_CONVERSATION_DOMAIN_REVIEW_ADAPTER_VERSION = 'story-conversation-domain-review-1';
const STORY_CONVERSATION_REVIEW_STATUSES = Object.freeze([
    'DOMAIN_REVIEW_NEEDS_EVIDENCE', 'DOMAIN_REVIEW_COUNTER_OFFER',
    'DOMAIN_REVIEW_REJECTED', 'READY_FOR_NEGOTIATION'
]);
const STORY_CONVERSATION_RESOLUTION_STATUSES = Object.freeze([
    'NEGOTIATION_DECLINED', 'NEGOTIATION_DEFERRED'
]);

function storyConversationSessionLedgerCreate() {
    return {
        schemaVersion: STORY_CONVERSATION_SESSION_SCHEMA_VERSION,
        adapterVersion: STORY_CONVERSATION_SESSION_ADAPTER_VERSION,
        nextSequence: 1,
        nextTaskOfferSequence: 1,
        nextMeetingSequence: 1,
        nextMeetingClosureSequence: 1,
        sessions: [],
        taskOffers: [],
        meetingCases: [],
        meetingClosures: [],
        diagnostics: {
            prunedSessions: 0, rejectedReplies: 0, worldMutations: 0,
            domainReviews: 0, listenerBeliefReads: 0, rawWorldReads: 0,
            playerResponses: 0, knowledgeTransfers: 0, socialResponses: 0,
            socialFollowUps: 0, memoryRecalls: 0, caseModeSwitches: 0,
            prunedTaskOffers: 0
        }
    };
}

function storyConversationCaseInferMode(raw, analysis) {
    const folded = storyConversationFold(raw);
    const focus = typeof storyConversationQuestionFocus === 'function'
        ? storyConversationQuestionFocus(folded) : null;
    if (storyConversationContains(folded, ['resmi toplanti', 'toplanti duzenle',
        'toplanti cagir', 'kurul toplansin', 'konsey toplansin'])) return 'FORMAL_MEETING';
    if (['REQUEST_JOB_OR_TASK', 'REQUEST_JOB_REFERRAL', 'CURRENT_ASSIGNMENT',
        'REQUEST_CHARACTER_NEED', 'JOB_FRUSTRATION'].includes(focus)) return 'TASKS_JOBS';
    const speechAct = String(analysis && analysis.speechAct || 'UNKNOWN');
    if (speechAct === 'SHARE_SECRET'
        || storyConversationContains(folded, ['aramizda kalsin', 'gizli tut', 'sir olarak'])) {
        return 'CONFIDENTIALITY';
    }
    if (['REPORT_MILITARY', 'REPORT_ECONOMIC'].includes(speechAct)
        || storyConversationContains(folded, ['rapor veriyorum', 'bildiriyorum', 'bildirge'])) {
        return 'REPORT_DECLARATION';
    }
    if (['PROPOSE_COMMERCIAL_DEAL', 'COUNTER_OFFER', 'OFFER_SUPPORT'].includes(speechAct)
        || storyConversationContains(folded, ['teklif', 'anlasma', 'muzakere'])) {
        return 'OFFER_NEGOTIATION';
    }
    return 'DAILY_CHAT';
}

function storyConversationCaseApplyMode(session, mode, source, sourceTurnId) {
    if (!session || !STORY_CONVERSATION_CASE_MODES.includes(String(mode))) return false;
    const normalized = String(mode);
    if (!session.conversationCase || typeof session.conversationCase !== 'object') {
        const participants = Array.from(new Set([session.playerActorId, session.listenerActorId]
            .filter(Boolean).map(String)));
        session.conversationCase = {
            schemaVersion: STORY_CONVERSATION_CASE_SCHEMA_VERSION,
            id: `conversation-case:${session.id}`,
            sessionId: session.id,
            kind: 'SINGLE_PARTY',
            mode: normalized,
            mechanicalStatus: STORY_CONVERSATION_CASE_MODE_STATUS[normalized],
            participantActorIds: participants,
            openedAt: Number(session.createdAt) || 0,
            updatedAt: Number(session.updatedAt) || Number(session.createdAt) || 0,
            modeHistory: [],
            taskOfferIds: [], confidentialityRecordIds: [], declarationDraftIds: [],
            meetingCaseId: null,
            worldMutation: false
        };
    }
    const conversationCase = session.conversationCase;
    if (conversationCase.mode === normalized && conversationCase.modeHistory.length) return false;
    const previous = conversationCase.modeHistory.length ? conversationCase.mode : null;
    conversationCase.mode = normalized;
    conversationCase.mechanicalStatus = STORY_CONVERSATION_CASE_MODE_STATUS[normalized];
    conversationCase.updatedAt = Number(STORY.clock) || Number(session.updatedAt) || 0;
    conversationCase.modeHistory.push({
        sequence: conversationCase.modeHistory.length + 1,
        from: previous,
        to: normalized,
        source: String(source || 'PLAYER_EXPLICIT_MODE'),
        sourceTurnId: sourceTurnId == null ? null : String(sourceTurnId),
        changedAt: Number(STORY.clock) || Number(session.updatedAt) || 0,
        worldMutation: false
    });
    return true;
}

function storyConversationCaseCreate(session, raw, analysis) {
    storyConversationCaseApplyMode(session,
        storyConversationCaseInferMode(raw, analysis), 'INITIAL_ANALYSIS', `conversation-turn:${session.id}:0`);
    return session.conversationCase;
}

function storyConversationTaskOfferTarget(session) {
    if (!session || typeof storyContactDirectoryBuild !== 'function'
        || typeof storyCharacterActionCandidate !== 'function') return null;
    const directory = storyContactDirectoryBuild();
    const listener = (directory.publicCharacters || []).find(row => row.id === session.listenerActorId);
    const listenerIdentity = typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(session.listenerActorId) : null;
    if (!listener || listener.contactable === false || session.listenerActorId === session.playerActorId
        || (listenerIdentity && listenerIdentity.life && listenerIdentity.life.status !== 'ACTIVE')) return null;
    const candidates = (directory.publicCharacters || []).filter(row => row.contactable !== false
        && row.id !== session.playerActorId && row.id !== session.listenerActorId)
        .map(row => ({
            row,
            preview: storyCharacterActionCandidate({
                actorId: session.playerActorId, targetActorId: row.id,
                actionType: 'PERSUADE', decisionSource: 'CONVERSATION_TASK_PREVIEW'
            })
        }))
        .filter(item => item.preview && item.preview.allowed)
        .sort((a, b) => Number(b.row.ownerId === listener.ownerId) - Number(a.row.ownerId === listener.ownerId)
            || Number(b.row.directContact === true) - Number(a.row.directContact === true)
            || String(a.row.id).localeCompare(String(b.row.id), 'en'));
    return candidates.length ? { listener, target: candidates[0].row, preview: candidates[0].preview } : null;
}

function storyConversationTaskCommanderAccount(actorId) {
    const match = /^character:(\d+):([^:]+)$/.exec(String(actorId || ''));
    if (!match || !/^\d+$/.test(match[2])) return null;
    const state = (STORY.states || []).find(row => Number(row.id) === Number(match[1]));
    const commanders = state && typeof storyStateCommanders === 'function'
        ? storyStateCommanders(state) : [];
    const commander = commanders.find(row => String(row.id) === match[2]);
    return commander ? {
        actorId: String(actorId), countryId: `country:${state.id}`,
        commanderId: String(commander.id), commander
    } : null;
}

function storyConversationInstitutionalTaskOfferPreview(sessionId) {
    const ledger = storyConversationSessionEnsure();
    const session = storyConversationSessionFind(sessionId);
    if (!ledger || !session) return { ok: false, code: 'SESSION_NOT_FOUND', worldMutation: false };
    if (!session.conversationCase || session.conversationCase.mode !== 'TASKS_JOBS') {
        return { ok: false, code: 'TASK_MODE_REQUIRED', worldMutation: false };
    }
    const source = storyConversationTaskOfferTarget(session);
    if (!source) return { ok: false, code: 'NO_ELIGIBLE_CONTACT_TASK', worldMutation: false };
    const payer = storyConversationTaskCommanderAccount(session.listenerActorId);
    const payee = storyConversationTaskCommanderAccount(session.playerActorId);
    if (!payer) return { ok: false, code: 'INSTITUTIONAL_TASK_PAYER_ACCOUNT_REQUIRED', worldMutation: false };
    if (!payee || payee.commander !== STORY.commander) {
        return { ok: false, code: 'INSTITUTIONAL_TASK_PLAYER_ACCOUNT_REQUIRED', worldMutation: false };
    }
    const policy = typeof STORY_INSTITUTION_POLICY === 'object'
        ? STORY_INSTITUTION_POLICY.paidContactTask : null;
    if (!policy) return { ok: false, code: 'INSTITUTIONAL_TASK_POLICY_REQUIRED', worldMutation: false };
    const sequence = ledger.nextTaskOfferSequence;
    const taskOfferId = `conversation-task-offer:${sequence}`;
    const correlationId = `${taskOfferId}:institutional-payment`;
    const commissionContext = {
        correlationId, sourceConversationCaseId: session.conversationCase.id,
        targetActorId: source.target.id, assigneeActorId: session.playerActorId,
        objectiveType: policy.objectiveType, compensationPolicyId: policy.id
    };
    const authority = typeof storyCharacterRoleInstitutionTaskCommissionPreview === 'function'
        ? storyCharacterRoleInstitutionTaskCommissionPreview({
            actorId: session.listenerActorId, commissionContext
        }) : { ok: false, code: 'INSTITUTIONAL_TASK_AUTHORITY_REQUIRED' };
    if (!authority.ok) return { ...authority, worldMutation: false };
    if (authority.route.routeMode !== 'DIRECT' || authority.route.institutionType !== 'ARMED_FORCES'
        || authority.route.canPropose !== true || authority.route.canApprove !== true
        || authority.route.canExecute !== true) {
        return { ok: false, code: 'INSTITUTIONAL_TASK_DIRECT_ROUTE_REQUIRED', worldMutation: false };
    }
    const available = Number(payer.commander.res && payer.commander.res.points) || 0;
    return {
        ok: true, code: 'INSTITUTIONAL_TASK_OFFER_PREVIEW_READY',
        preview: {
            taskOfferId, sequence, correlationId, commissionContext,
            kind: 'INSTITUTIONAL_PAID_CONTACT_TASK',
            issuerActorId: session.listenerActorId, issuerName: source.listener.name,
            assigneeActorId: session.playerActorId,
            targetActorId: source.target.id, targetName: source.target.name,
            objectiveType: policy.objectiveType, actionCandidateId: source.preview.id,
            deadlineSeconds: 300, institutionId: authority.route.institutionId,
            countryId: authority.route.countryId, legalBasis: authority.route.legalBasis,
            payerCountryId: payer.countryId, payerCommanderId: payer.commanderId,
            payeeCountryId: payee.countryId, payeeCommanderId: payee.commanderId,
            compensationPolicyId: policy.id, amount: policy.amount, currency: policy.currency,
            payerAvailable: available, payerSufficient: available + 1e-6 >= policy.amount,
            worldMutation: false
        },
        worldMutation: false
    };
}

function storyConversationInstitutionalTaskOfferCreate(sessionId) {
    const ledger = storyConversationSessionEnsure();
    const session = storyConversationSessionFind(sessionId);
    if (!ledger || !session) return { ok: false, code: 'SESSION_NOT_FOUND', worldMutation: false };
    const existing = ledger.taskOffers.find(row => row.sessionId === session.id
        && ['OFFERED', 'ACCEPTED'].includes(row.status));
    if (existing) return { ok: true, code: 'TASK_OFFER_ALREADY_OPEN', taskOffer: storyConversationClone(existing), worldMutation: false };
    const preview = storyConversationInstitutionalTaskOfferPreview(sessionId);
    if (!preview.ok) return preview;
    if (!preview.preview.payerSufficient) {
        return {
            ok: false, code: 'INSTITUTIONAL_TASK_INSUFFICIENT_CASH',
            available: preview.preview.payerAvailable, required: preview.preview.amount,
            worldMutation: false
        };
    }
    const removable = ledger.taskOffers.length >= STORY_CONVERSATION_TASK_OFFER_LIMIT
        ? ledger.taskOffers.findIndex(row => ['DECLINED', 'COMPLETED', 'EXPIRED'].includes(row.status)) : -1;
    if (ledger.taskOffers.length >= STORY_CONVERSATION_TASK_OFFER_LIMIT && removable < 0) {
        return { ok: false, code: 'TASK_OFFER_LIMIT', worldMutation: false };
    }
    const conversationSnapshot = storyConversationClone(ledger);
    const institutionSnapshot = storyConversationClone(STORY.institutions);
    const rollback = code => {
        STORY.conversationUnderstanding = conversationSnapshot;
        STORY.institutions = institutionSnapshot;
        return { ok: false, code, rolledBack: true, worldMutation: false };
    };
    const proposed = storyCharacterRoleInstitutionAction({
        phase: 'PROPOSE', actorId: session.listenerActorId,
        actionType: 'COMMISSION_PAID_CONTACT_TASK',
        commissionContext: preview.preview.commissionContext
    });
    if (!proposed.ok || !proposed.request || proposed.request.status !== 'AUTHORIZED') {
        return rollback(proposed.code || 'INSTITUTIONAL_TASK_AUTHORIZATION_FAILED');
    }
    const executed = storyCharacterRoleInstitutionAction({
        phase: 'EXECUTE', actorId: session.listenerActorId,
        requestId: proposed.request.id
    });
    if (!executed.ok || !executed.request || executed.request.status !== 'EXECUTED') {
        return rollback(executed.code || 'INSTITUTIONAL_TASK_EXECUTION_FAILED');
    }
    try {
        if (removable >= 0) {
            const removed = ledger.taskOffers.splice(removable, 1)[0];
            for (const row of ledger.sessions) if (row.conversationCase) {
                row.conversationCase.taskOfferIds = row.conversationCase.taskOfferIds.filter(id => id !== removed.id);
            }
            ledger.diagnostics.prunedTaskOffers++;
        }
        const sequence = ledger.nextTaskOfferSequence++;
        if (sequence !== preview.preview.sequence) return rollback('INSTITUTIONAL_TASK_SEQUENCE_CONFLICT');
        const createdAt = Number(STORY.clock) || 0;
        const taskOffer = {
            schemaVersion: STORY_CONVERSATION_TASK_OFFER_SCHEMA_VERSION,
            id: preview.preview.taskOfferId, sequence,
            caseId: session.conversationCase.id, sessionId: session.id,
            kind: preview.preview.kind, issuerActorId: preview.preview.issuerActorId,
            issuerName: preview.preview.issuerName, assigneeActorId: preview.preview.assigneeActorId,
            authority: {
                model: 'INSTITUTIONAL_COMMISSION', sourceActorId: preview.preview.issuerActorId,
                canCompel: false, institutionRequestId: executed.request.id,
                institutionId: preview.preview.institutionId, countryId: preview.preview.countryId,
                legalBasis: preview.preview.legalBasis
            },
            objective: {
                type: preview.preview.objectiveType, targetActorId: preview.preview.targetActorId,
                targetName: preview.preview.targetName, minimumConversationCount: 1,
                actionCandidateId: preview.preview.actionCandidateId
            },
            reward: {
                kind: 'STATE_CREDIT_COMPENSATION', amount: preview.preview.amount,
                currency: preview.preview.currency
            },
            institutional: {
                correlationId: preview.preview.correlationId,
                institutionRequestId: executed.request.id,
                institutionId: preview.preview.institutionId, countryId: preview.preview.countryId,
                legalBasis: preview.preview.legalBasis,
                payerCountryId: preview.preview.payerCountryId,
                payerCommanderId: preview.preview.payerCommanderId,
                payeeCountryId: preview.preview.payeeCountryId,
                payeeCommanderId: preview.preview.payeeCommanderId,
                compensationPolicyId: preview.preview.compensationPolicyId,
                amount: preview.preview.amount, currency: preview.preview.currency,
                paymentStatus: 'NOT_RESERVED', escrowReservationId: null,
                resultReceiptId: null, resultReceipt: null,
                relationshipResultReceiptId: null
            },
            createdAt, dueAt: createdAt + preview.preview.deadlineSeconds,
            status: 'OFFERED', acceptedAt: null, declinedAt: null, completedAt: null,
            completionSessionId: null, sourceTurnId: `conversation-mode:${session.id}`,
            relationshipResultReceiptId: null,
            worldMutation: false
        };
        ledger.taskOffers.push(taskOffer);
        session.conversationCase.taskOfferIds.push(taskOffer.id);
        session.conversationCase.updatedAt = createdAt;
        const validation = storyConversationSessionValidateLedger(ledger);
        if (!validation.ok) return rollback('INSTITUTIONAL_TASK_LEDGER_WRITE_REJECTED');
        return { ok: true, code: 'INSTITUTIONAL_TASK_OFFER_CREATED', taskOffer: storyConversationClone(taskOffer), worldMutation: false };
    } catch (error) {
        return rollback('INSTITUTIONAL_TASK_LEDGER_WRITE_FAILED');
    }
}

function storyConversationTaskOfferPreview(sessionId) {
    const session = storyConversationSessionFind(sessionId);
    if (!session) return { ok: false, code: 'SESSION_NOT_FOUND', worldMutation: false };
    if (!session.conversationCase || session.conversationCase.mode !== 'TASKS_JOBS') {
        return { ok: false, code: 'TASK_MODE_REQUIRED', worldMutation: false };
    }
    const source = storyConversationTaskOfferTarget(session);
    if (!source) return { ok: false, code: 'NO_ELIGIBLE_CONTACT_TASK', worldMutation: false };
    return {
        ok: true, code: 'TASK_OFFER_PREVIEW_READY',
        preview: {
            kind: 'PERSONAL_CONTACT_REQUEST', issuerActorId: session.listenerActorId,
            issuerName: source.listener.name, assigneeActorId: session.playerActorId,
            targetActorId: source.target.id, targetName: source.target.name,
            objectiveType: 'HOLD_CONVERSATION', actionCandidateId: source.preview.id,
            deadlineSeconds: 300,
            authority: { model: 'PERSONAL_REQUEST', sourceActorId: session.listenerActorId, canCompel: false },
            reward: { kind: 'NONE', amount: 0 }, worldMutation: false
        },
        worldMutation: false
    };
}

function storyConversationTaskOfferCreate(sessionId) {
    const ledger = storyConversationSessionEnsure();
    const session = storyConversationSessionFind(sessionId);
    if (!ledger || !session) return { ok: false, code: 'SESSION_NOT_FOUND', worldMutation: false };
    const existing = ledger.taskOffers.find(row => row.sessionId === session.id
        && ['OFFERED', 'ACCEPTED'].includes(row.status));
    if (existing) return { ok: true, code: 'TASK_OFFER_ALREADY_OPEN', taskOffer: storyConversationClone(existing), worldMutation: false };
    const preview = storyConversationTaskOfferPreview(sessionId);
    if (!preview.ok) return preview;
    if (ledger.taskOffers.length >= STORY_CONVERSATION_TASK_OFFER_LIMIT) {
        const removable = ledger.taskOffers.findIndex(row => ['DECLINED', 'COMPLETED', 'EXPIRED'].includes(row.status));
        if (removable < 0) return { ok: false, code: 'TASK_OFFER_LIMIT', worldMutation: false };
        const removed = ledger.taskOffers.splice(removable, 1)[0];
        for (const row of ledger.sessions) {
            if (row.conversationCase) row.conversationCase.taskOfferIds = row.conversationCase.taskOfferIds
                .filter(id => id !== removed.id);
        }
        ledger.diagnostics.prunedTaskOffers++;
    }
    const sequence = ledger.nextTaskOfferSequence++;
    const createdAt = Number(STORY.clock) || 0;
    const taskOffer = {
        schemaVersion: STORY_CONVERSATION_TASK_OFFER_SCHEMA_VERSION,
        id: `conversation-task-offer:${sequence}`, sequence,
        caseId: session.conversationCase.id, sessionId: session.id,
        kind: preview.preview.kind, issuerActorId: preview.preview.issuerActorId,
        issuerName: preview.preview.issuerName, assigneeActorId: preview.preview.assigneeActorId,
        authority: preview.preview.authority,
        objective: {
            type: preview.preview.objectiveType, targetActorId: preview.preview.targetActorId,
            targetName: preview.preview.targetName, minimumConversationCount: 1,
            actionCandidateId: preview.preview.actionCandidateId
        },
        reward: preview.preview.reward, institutional: null,
        createdAt, dueAt: createdAt + preview.preview.deadlineSeconds,
        status: 'OFFERED', acceptedAt: null, declinedAt: null, completedAt: null,
        completionSessionId: null, sourceTurnId: `conversation-mode:${session.id}`,
        relationshipResultReceiptId: null,
        worldMutation: false
    };
    ledger.taskOffers.push(taskOffer);
    session.conversationCase.taskOfferIds.push(taskOffer.id);
    session.conversationCase.updatedAt = createdAt;
    return { ok: true, code: 'TASK_OFFER_CREATED', taskOffer: storyConversationClone(taskOffer), worldMutation: false };
}

function storyConversationTaskOfferList(sessionId) {
    const ledger = storyConversationSessionEnsure();
    return (ledger && ledger.taskOffers || []).filter(row => !sessionId || row.sessionId === String(sessionId))
        .map(storyConversationClone);
}

function storyConversationInstitutionalTaskPaymentSpec(taskOffer) {
    const terms = taskOffer && taskOffer.institutional;
    const session = taskOffer && STORY.conversationUnderstanding
        && (STORY.conversationUnderstanding.sessions || []).find(row => row.id === taskOffer.sessionId);
    const request = terms && STORY.institutions && STORY.institutions.requests
        ? STORY.institutions.requests[terms.institutionRequestId] : null;
    const payer = taskOffer && storyConversationTaskCommanderAccount(taskOffer.issuerActorId);
    const payee = taskOffer && storyConversationTaskCommanderAccount(taskOffer.assigneeActorId);
    const policy = typeof STORY_INSTITUTION_POLICY === 'object'
        ? STORY_INSTITUTION_POLICY.paidContactTask : null;
    if (!terms || !session || session.listenerActorId !== taskOffer.issuerActorId
        || session.playerActorId !== taskOffer.assigneeActorId || !payer || !payee
        || payee.commander !== STORY.commander || !policy
        || terms.payerCountryId !== payer.countryId || String(terms.payerCommanderId) !== payer.commanderId
        || terms.payeeCountryId !== payee.countryId || String(terms.payeeCommanderId) !== payee.commanderId
        || terms.compensationPolicyId !== policy.id || terms.amount !== policy.amount
        || terms.currency !== policy.currency || taskOffer.reward.amount !== policy.amount
        || taskOffer.reward.currency !== policy.currency
        || !request || request.status !== 'EXECUTED'
        || request.actionType !== 'COMMISSION_PAID_CONTACT_TASK'
        || request.proposer.actorId !== taskOffer.issuerActorId
        || request.proposer.sourceId !== terms.institutionId
        || request.countryId !== terms.countryId || request.legalBasis !== terms.legalBasis
        || !request.commission || request.commission.correlationId !== terms.correlationId
        || request.commission.sourceConversationCaseId !== taskOffer.caseId
        || request.commission.targetActorId !== taskOffer.objective.targetActorId
        || request.commission.assigneeActorId !== taskOffer.assigneeActorId) {
        return { ok: false, code: 'INSTITUTIONAL_TASK_AUTHORITY_STALE' };
    }
    return {
        ok: true,
        spec: {
            correlationId: terms.correlationId,
            payerCountryId: payer.countryId, payerCommanderId: payer.commanderId,
            payeeCountryId: payee.countryId, payeeCommanderId: payee.commanderId,
            amount: policy.amount, currency: policy.currency
        }
    };
}

function storyConversationTaskOfferDecision(taskOfferId, decision) {
    const ledger = STORY.conversationUnderstanding || storyConversationSessionEnsure();
    const taskOffer = ledger && ledger.taskOffers.find(row => row.id === String(taskOfferId));
    const normalized = String(decision || '').toUpperCase();
    if (!taskOffer) return { ok: false, code: 'TASK_OFFER_NOT_FOUND', worldMutation: false };
    if (!['ACCEPT', 'DECLINE'].includes(normalized)) {
        return { ok: false, code: 'TASK_DECISION_INVALID', worldMutation: false };
    }
    if (taskOffer.status !== 'OFFERED') {
        return { ok: false, code: 'TASK_OFFER_NOT_OPEN', taskOffer: storyConversationClone(taskOffer), worldMutation: false };
    }
    const now = Number(STORY.clock) || 0;
    if (now > taskOffer.dueAt) {
        taskOffer.status = 'EXPIRED';
        return { ok: false, code: 'TASK_OFFER_EXPIRED', taskOffer: storyConversationClone(taskOffer), worldMutation: false };
    }
    if (taskOffer.kind === 'INSTITUTIONAL_PAID_CONTACT_TASK') {
        if (normalized === 'DECLINE') {
            taskOffer.status = 'DECLINED';
            taskOffer.declinedAt = now;
            return { ok: true, code: 'TASK_OFFER_DECLINED', taskOffer: storyConversationClone(taskOffer), worldMutation: false };
        }
        const payment = storyConversationInstitutionalTaskPaymentSpec(taskOffer);
        if (!payment.ok) {
            return { ...payment, taskOffer: storyConversationClone(taskOffer), worldMutation: false };
        }
        const reserved = typeof storyBudgetReserveInstitutionalTaskPayment === 'function'
            ? storyBudgetReserveInstitutionalTaskPayment(payment.spec)
            : { ok: false, code: 'INSTITUTIONAL_TASK_BUDGET_REQUIRED' };
        if (!reserved.ok) {
            return { ...reserved, taskOffer: storyConversationClone(taskOffer), worldMutation: false };
        }
        taskOffer.institutional.paymentStatus = 'RESERVED';
        taskOffer.institutional.escrowReservationId = reserved.reservationId;
        taskOffer.status = 'ACCEPTED';
        taskOffer.acceptedAt = now;
        return { ok: true, code: 'TASK_OFFER_ACCEPTED', duplicate: reserved.duplicate === true,
            taskOffer: storyConversationClone(taskOffer), worldMutation: false };
    }
    taskOffer.status = normalized === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED';
    taskOffer[normalized === 'ACCEPT' ? 'acceptedAt' : 'declinedAt'] = now;
    return { ok: true, code: `TASK_OFFER_${taskOffer.status}`, taskOffer: storyConversationClone(taskOffer), worldMutation: false };
}

function storyConversationTaskRelationshipResultApply(taskOffer, interpretationType) {
    if (!taskOffer || typeof storyRelationshipApplyResult !== 'function') {
        return { ok: false, code: 'TASK_RELATIONSHIP_RESULT_REQUIRED' };
    }
    const result = storyRelationshipApplyResult({
        sourceType: 'TASK_RESULT', sourceReceiptId: taskOffer.id,
        fromActorId: taskOffer.issuerActorId, toActorId: taskOffer.assigneeActorId,
        interpretationType
    });
    if (!result || !result.receipt) {
        return { ok: false, code: result && result.reason || 'TASK_RELATIONSHIP_RESULT_REJECTED' };
    }
    taskOffer.relationshipResultReceiptId = result.receipt.id;
    if (taskOffer.institutional) {
        taskOffer.institutional.relationshipResultReceiptId = result.receipt.id;
        if (taskOffer.institutional.resultReceipt) {
            taskOffer.institutional.resultReceipt.relationshipResultReceiptId = result.receipt.id;
        }
    }
    return { ok: true, result };
}

function storyConversationTaskRollback(taskOffer, previousTask, relationshipSnapshot) {
    Object.keys(taskOffer).forEach(key => delete taskOffer[key]);
    Object.assign(taskOffer, previousTask);
    STORY.characterRelationships = relationshipSnapshot;
}

function storyConversationTaskOfferTick() {
    const ledger = storyConversationSessionEnsure();
    if (!ledger) return 0;
    const now = Number(STORY.clock) || 0;
    let expired = 0;
    for (const taskOffer of ledger.taskOffers || []) {
        if (!['OFFERED', 'ACCEPTED'].includes(taskOffer.status) || now <= taskOffer.dueAt) continue;
        if (taskOffer.kind !== 'INSTITUTIONAL_PAID_CONTACT_TASK') {
            if (taskOffer.status === 'OFFERED') {
                taskOffer.status = 'EXPIRED';
                expired++;
                continue;
            }
            const previousTask = storyConversationClone(taskOffer);
            const relationshipSnapshot = storyConversationClone(STORY.characterRelationships);
            taskOffer.status = 'EXPIRED';
            const relationship = storyConversationTaskRelationshipResultApply(
                taskOffer, 'TASK_COMMITMENT_BROKEN'
            );
            const validation = relationship.ok
                ? storyConversationSessionValidateLedger(ledger) : { ok: false };
            if (!relationship.ok || !validation.ok) {
                storyConversationTaskRollback(taskOffer, previousTask, relationshipSnapshot);
                continue;
            }
            expired++;
            continue;
        }
        if (taskOffer.status === 'OFFERED') {
            taskOffer.status = 'EXPIRED';
            expired++;
            continue;
        }
        const payment = storyConversationInstitutionalTaskPaymentSpec(taskOffer);
        if (!payment.ok || taskOffer.institutional.paymentStatus !== 'RESERVED'
            || !taskOffer.institutional.escrowReservationId) continue;
        const canonical = typeof storyBudgetReserveInstitutionalTaskPayment === 'function'
            ? storyBudgetReserveInstitutionalTaskPayment(payment.spec)
            : { ok: false, code: 'INSTITUTIONAL_TASK_BUDGET_REQUIRED' };
        if (!canonical.ok || canonical.reservationId !== taskOffer.institutional.escrowReservationId) continue;
        const budgetSnapshot = storyConversationClone(STORY.stateBudget);
        const payer = storyConversationTaskCommanderAccount(taskOffer.issuerActorId);
        const payerPoints = payer && Number(payer.commander.res && payer.commander.res.points) || 0;
        const previousTask = storyConversationClone(taskOffer);
        const relationshipSnapshot = storyConversationClone(STORY.characterRelationships);
        const released = typeof storyBudgetReleaseInstitutionalTaskPayment === 'function'
            ? storyBudgetReleaseInstitutionalTaskPayment(
                taskOffer.institutional.escrowReservationId, 'TASK_EXPIRED')
            : { ok: false, code: 'INSTITUTIONAL_TASK_BUDGET_REQUIRED' };
        if (!released.ok) continue;
        taskOffer.institutional.paymentStatus = 'RELEASED';
        taskOffer.status = 'EXPIRED';
        const relationship = storyConversationTaskRelationshipResultApply(
            taskOffer, 'TASK_COMMITMENT_BROKEN'
        );
        const validation = relationship.ok
            ? storyConversationSessionValidateLedger(ledger) : { ok: false };
        if (!relationship.ok || !validation.ok) {
            STORY.stateBudget = budgetSnapshot;
            if (payer && payer.commander && payer.commander.res) payer.commander.res.points = payerPoints;
            storyConversationTaskRollback(taskOffer, previousTask, relationshipSnapshot);
            continue;
        }
        expired++;
    }
    return expired;
}

function storyConversationTaskOfferCompleteForConversation(ledger, completedSession) {
    if (!ledger || !completedSession) return [];
    const now = Number(STORY.clock) || 0;
    const completed = [];
    for (const taskOffer of ledger.taskOffers || []) {
        if (taskOffer.status !== 'ACCEPTED' || taskOffer.assigneeActorId !== completedSession.playerActorId
            || taskOffer.objective.type !== 'HOLD_CONVERSATION'
            || taskOffer.objective.targetActorId !== completedSession.listenerActorId
            || taskOffer.sessionId === completedSession.id) continue;
        if (now > taskOffer.dueAt) {
            if (taskOffer.kind === 'PERSONAL_CONTACT_REQUEST') {
                const previousTask = storyConversationClone(taskOffer);
                const relationshipSnapshot = storyConversationClone(STORY.characterRelationships);
                taskOffer.status = 'EXPIRED';
                const relationship = storyConversationTaskRelationshipResultApply(
                    taskOffer, 'TASK_COMMITMENT_BROKEN'
                );
                if (!relationship.ok || !storyConversationSessionValidateLedger(ledger).ok) {
                    storyConversationTaskRollback(taskOffer, previousTask, relationshipSnapshot);
                }
            }
            continue;
        }
        if (taskOffer.kind === 'INSTITUTIONAL_PAID_CONTACT_TASK') {
            const payment = storyConversationInstitutionalTaskPaymentSpec(taskOffer);
            if (!payment.ok || taskOffer.institutional.paymentStatus !== 'RESERVED'
                || !taskOffer.institutional.escrowReservationId) continue;
            const budgetSnapshot = storyConversationClone(STORY.stateBudget);
            const payee = storyConversationTaskCommanderAccount(taskOffer.assigneeActorId);
            const payeePoints = payee && Number(payee.commander.res && payee.commander.res.points) || 0;
            const previousTask = storyConversationClone(taskOffer);
            const relationshipSnapshot = storyConversationClone(STORY.characterRelationships);
            const settled = typeof storyBudgetSettleInstitutionalTaskPayment === 'function'
                ? storyBudgetSettleInstitutionalTaskPayment(
                    taskOffer.institutional.escrowReservationId, payment.spec)
                : { ok: false, code: 'INSTITUTIONAL_TASK_BUDGET_REQUIRED' };
            if (!settled.ok) continue;
            try {
                const settlement = settled.settlement;
                const receipt = {
                    schemaVersion: 1,
                    id: `${taskOffer.id}:receipt:1`,
                    taskOfferId: taskOffer.id,
                    sourceSessionId: taskOffer.sessionId,
                    completionSessionId: completedSession.id,
                    institutionRequestId: taskOffer.institutional.institutionRequestId,
                    institutionId: taskOffer.institutional.institutionId,
                    countryId: taskOffer.institutional.countryId,
                    legalBasis: taskOffer.institutional.legalBasis,
                    escrowReservationId: settlement.id,
                    payerCountryId: settlement.payerCountryId,
                    payerCommanderId: settlement.payerCommanderId,
                    payeeCountryId: settlement.payeeCountryId,
                    payeeCommanderId: settlement.payeeCommanderId,
                    payerTransactionId: settlement.payerTransactionId,
                    payeeTransactionId: settlement.payeeTransactionId,
                    amount: settlement.amount,
                    currency: settlement.currency,
                    completedAt: now,
                    relationshipResultReceiptId: null,
                    physicalMutation: false,
                    worldMutation: false
                };
                taskOffer.institutional.paymentStatus = 'SETTLED';
                taskOffer.institutional.resultReceiptId = receipt.id;
                taskOffer.institutional.resultReceipt = receipt;
                taskOffer.status = 'COMPLETED';
                taskOffer.completedAt = now;
                taskOffer.completionSessionId = completedSession.id;
                const relationship = storyConversationTaskRelationshipResultApply(
                    taskOffer, 'TASK_COMMITMENT_KEPT'
                );
                if (!relationship.ok) throw new Error('INSTITUTIONAL_TASK_RELATIONSHIP_RESULT_INVALID');
                const validation = storyConversationSessionValidateLedger(ledger);
                if (!validation.ok) throw new Error('INSTITUTIONAL_TASK_RECEIPT_INVALID');
            } catch (error) {
                STORY.stateBudget = budgetSnapshot;
                if (payee && payee.commander && payee.commander.res) payee.commander.res.points = payeePoints;
                storyConversationTaskRollback(taskOffer, previousTask, relationshipSnapshot);
                continue;
            }
            completed.push(taskOffer.id);
            continue;
        }
        const previousTask = storyConversationClone(taskOffer);
        const relationshipSnapshot = storyConversationClone(STORY.characterRelationships);
        taskOffer.status = 'COMPLETED';
        taskOffer.completedAt = now;
        taskOffer.completionSessionId = completedSession.id;
        const relationship = storyConversationTaskRelationshipResultApply(
            taskOffer, 'TASK_COMMITMENT_KEPT'
        );
        if (!relationship.ok || !storyConversationSessionValidateLedger(ledger).ok) {
            storyConversationTaskRollback(taskOffer, previousTask, relationshipSnapshot);
            continue;
        }
        completed.push(taskOffer.id);
    }
    return completed;
}

function storyConversationMeetingCandidate(session, agendaText) {
    const agenda = String(agendaText == null ? '' : agendaText).trim().replace(/\s+/g, ' ');
    if (!session || !session.conversationCase || session.conversationCase.mode !== 'FORMAL_MEETING') {
        return { ok: false, code: 'MEETING_MODE_REQUIRED', worldMutation: false };
    }
    if (agenda.length < 8 || agenda.length > 240) {
        return { ok: false, code: 'MEETING_AGENDA_INVALID', worldMutation: false };
    }
    if (typeof storyContactDirectoryBuild !== 'function'
        || typeof storyCharacterRoleAdapterView !== 'function') {
        return { ok: false, code: 'MEETING_DIRECTORY_UNAVAILABLE', worldMutation: false };
    }
    const directory = storyContactDirectoryBuild();
    const visible = (directory.publicCharacters || []).filter(row => row.contactable !== false);
    const listener = visible.find(row => row.id === session.listenerActorId);
    if (!listener) return { ok: false, code: 'MEETING_LISTENER_NOT_CONTACTABLE', worldMutation: false };
    const sameCountry = visible.filter(row => row.ownerId === listener.ownerId);
    const officeCandidates = sameCountry.map(row => ({
        row, view: storyCharacterRoleAdapterView(row.id)
    })).filter(item => item.view && item.view.ok && item.view.adapter
        && item.view.adapter.lifeStatus === 'ACTIVE'
        && item.view.adapter.institutionalBindings.length)
        .sort((a, b) => {
            const priority = item => Math.min(...item.view.adapter.institutionalBindings.map(binding => ({
                EXECUTIVE: 0, LEGISLATURE: 1, JUDICIARY: 2, ARMED_FORCES: 3, LOCAL_ADMINISTRATION: 4
            })[binding.institutionType] ?? 9));
            return priority(a) - priority(b) || String(a.row.id).localeCompare(String(b.row.id), 'en');
        });
    if (!officeCandidates.length) {
        return { ok: false, code: 'MEETING_CANONICAL_CHAIR_REQUIRED', worldMutation: false };
    }
    const chair = officeCandidates[0];
    const chairBinding = chair.view.adapter.institutionalBindings.slice().sort((a, b) => {
        const priorities = { EXECUTIVE: 0, LEGISLATURE: 1, JUDICIARY: 2, ARMED_FORCES: 3, LOCAL_ADMINISTRATION: 4 };
        return (priorities[a.institutionType] ?? 9) - (priorities[b.institutionType] ?? 9)
            || a.institutionId.localeCompare(b.institutionId, 'en');
    })[0];
    const participantRows = [];
    const add = row => {
        if (row && !participantRows.some(item => item.id === row.id)) participantRows.push(row);
    };
    add(chair.row);
    add({ id: session.playerActorId, name: 'Sen', role: 'PLAYER', ownerId: directory.playerCountryId,
        countryName: listener.countryName, contactable: true, own: true });
    add(listener);
    sameCountry.slice().sort((a, b) => Number(b.directContact) - Number(a.directContact)
        || String(a.id).localeCompare(String(b.id), 'en')).forEach(row => {
        if (participantRows.length < 4) add(row);
    });
    if (participantRows.length < 3) {
        return { ok: false, code: 'MEETING_MINIMUM_PARTICIPANTS', worldMutation: false };
    }
    return {
        ok: true, code: 'MEETING_CANDIDATE_READY', agenda,
        chair: { row: chair.row, binding: chairBinding }, participantRows,
        worldMutation: false
    };
}

function storyConversationMeetingCreate(sessionId, agendaText) {
    const ledger = storyConversationSessionEnsure();
    const session = storyConversationSessionFind(sessionId);
    if (!ledger || !session) return { ok: false, code: 'SESSION_NOT_FOUND', worldMutation: false };
    if (session.conversationCase && session.conversationCase.meetingCaseId) {
        const existing = ledger.meetingCases.find(row => row.id === session.conversationCase.meetingCaseId);
        return { ok: true, code: 'MEETING_ALREADY_OPEN', meetingCase: storyConversationClone(existing), worldMutation: false };
    }
    if (ledger.meetingCases.length >= STORY_CONVERSATION_MEETING_LIMIT) {
        return { ok: false, code: 'MEETING_CASE_LIMIT', worldMutation: false };
    }
    const candidate = storyConversationMeetingCandidate(session, agendaText);
    if (!candidate.ok) return candidate;
    const sequence = ledger.nextMeetingSequence++;
    const id = `conversation-meeting:${sequence}`;
    const createdAt = Number(STORY.clock) || 0;
    const participantActorIds = candidate.participantRows.map(row => row.id);
    const meetingCase = {
        schemaVersion: 1, id, sequence, conversationCaseId: session.conversationCase.id,
        sessionId: session.id, meetingType: 'FORMAL_CONSULTATION',
        status: 'OPEN_NO_DECISION_ADAPTER', countryId: candidate.chair.binding.countryId,
        chair: {
            actorId: candidate.chair.row.id, name: candidate.chair.row.name,
            institutionId: candidate.chair.binding.institutionId,
            institutionType: candidate.chair.binding.institutionType,
            authoritySource: 'CANONICAL_INSTITUTION_OFFICE'
        },
        participants: candidate.participantRows.map(row => ({
            actorId: row.id, name: row.name, role: row.role,
            countryName: row.countryName || candidate.chair.row.countryName,
            visibility: 'KNOWN_PUBLIC_PROFILE', invitationStatus: 'CONFIRMED'
        })),
        participantActorIds,
        agendaItems: [{
            id: `${id}:agenda:1`, sequence: 1, title: candidate.agenda,
            status: 'OPEN', proposedByActorId: session.playerActorId,
            source: 'PLAYER_PROPOSED_AGENDA', worldMutation: false
        }],
        speakingOrderActorIds: participantActorIds.slice(), currentSpeakerIndex: 0,
        turns: [], privateNotes: [], motions: [], votes: [], outcomeReceipts: [], outcomeReceiptId: null,
        closureId: null,
        visibilityMatrix: participantActorIds.map(actorId => ({
            actorId,
            visibleParticipantActorIds: participantActorIds.slice(),
            visibleAgendaItemIds: [`${id}:agenda:1`],
            visibleTurnIds: [],
            visiblePrivateNoteIds: [],
            privateContextOwnerActorId: actorId,
            mayReadOtherPrivateContext: false
        })),
        createdAt, updatedAt: createdAt, worldMutation: false
    };
    ledger.meetingCases.push(meetingCase);
    session.conversationCase.kind = 'MULTI_PARTY';
    session.conversationCase.meetingCaseId = id;
    session.conversationCase.participantActorIds = participantActorIds.slice();
    session.conversationCase.updatedAt = createdAt;
    return { ok: true, code: 'MEETING_CASE_CREATED', meetingCase: storyConversationClone(meetingCase), worldMutation: false };
}

function storyConversationMeetingGet(meetingCaseId) {
    const ledger = storyConversationSessionEnsure();
    const row = ledger && ledger.meetingCases.find(item => item.id === String(meetingCaseId));
    return row ? storyConversationClone(row) : null;
}

function storyConversationMeetingBySession(sessionId) {
    const ledger = storyConversationSessionEnsure();
    const row = ledger && ledger.meetingCases.find(item => item.sessionId === String(sessionId));
    return row ? storyConversationClone(row) : null;
}

function storyConversationMeetingClosureGet(meetingClosureId) {
    const ledger = storyConversationSessionEnsure();
    const row = ledger && ledger.meetingClosures.find(item => item.id === String(meetingClosureId));
    return row ? storyConversationClone(row) : null;
}

function storyConversationMeetingRelationshipResultsApply(ledger, meeting, outcomeReceipt) {
    if (typeof storyRelationshipApplyResult !== 'function') {
        return { ok: false, code: 'MEETING_RELATIONSHIP_RESULT_REQUIRED' };
    }
    const session = ledger.sessions.find(row => row.id === meeting.sessionId);
    if (!session) return { ok: false, code: 'MEETING_SESSION_REQUIRED' };
    const votes = meeting.votes.filter(row => row.motionId === outcomeReceipt.motionId
        && row.motionVersionId === outcomeReceipt.motionVersionId);
    const playerVote = votes.find(row => row.actorId === session.playerActorId);
    const receiptIds = [];
    for (const actorId of meeting.participantActorIds) {
        if (actorId === session.playerActorId) continue;
        const observerVote = votes.find(row => row.actorId === actorId);
        const noChangeReason = outcomeReceipt.decision !== 'ADOPTED' ? 'MEETING_REJECTED'
            : !playerVote || playerVote.choice !== 'YES' ? 'PLAYER_VOTE_NOT_YES'
                : !observerVote || observerVote.choice !== 'YES' ? 'OBSERVER_VOTE_NOT_YES' : null;
        const result = storyRelationshipApplyResult({
            sourceType: 'MEETING_OUTCOME', sourceReceiptId: outcomeReceipt.id,
            fromActorId: actorId, toActorId: session.playerActorId,
            interpretationType: 'MEETING_SHARED_SUCCESS',
            noChangeReason
        });
        if (!result || !result.receipt) {
            return { ok: false, code: result && result.reason || 'MEETING_RELATIONSHIP_RESULT_REJECTED' };
        }
        receiptIds.push(result.receipt.id);
    }
    outcomeReceipt.relationshipResultReceiptIds = receiptIds;
    return { ok: true, receiptIds };
}

function storyConversationMeetingClose(meetingCaseId, outcomeReceiptId) {
    const ledger = storyConversationSessionEnsure();
    const meeting = ledger && ledger.meetingCases.find(row => row.id === String(meetingCaseId));
    if (!meeting) return { ok: false, code: 'MEETING_NOT_FOUND', worldMutation: false };
    if (meeting.closureId || meeting.status !== 'OPEN_NO_DECISION_ADAPTER') {
        return { ok: false, code: 'MEETING_ALREADY_CLOSED', worldMutation: false };
    }
    const receipt = (meeting.outcomeReceipts || []).find(row =>
        row.id === String(outcomeReceiptId || meeting.outcomeReceiptId));
    if (!receipt || receipt.id !== meeting.outcomeReceiptId) {
        return { ok: false, code: 'MEETING_OUTCOME_RECEIPT_REQUIRED', worldMutation: false };
    }
    const motion = meeting.motions.find(row => row.id === receipt.motionId);
    if (!motion || !motion.voting || motion.voting.status !== 'COMPLETED'
        || motion.activeVersionId !== receipt.motionVersionId
        || motion.outcomeReceiptId !== receipt.id) {
        return { ok: false, code: 'MEETING_OUTCOME_NOT_TERMINAL', worldMutation: false };
    }
    const currentActorId = meeting.speakingOrderActorIds[meeting.currentSpeakerIndex];
    if (currentActorId !== meeting.chair.actorId) {
        return { ok: false, code: 'MEETING_CHAIR_TURN_REQUIRED', worldMutation: false };
    }
    const conversationSnapshot = storyConversationClone(ledger);
    const relationshipSnapshot = storyConversationClone(STORY.characterRelationships);
    const rollback = code => {
        STORY.conversationUnderstanding = conversationSnapshot;
        STORY.characterRelationships = relationshipSnapshot;
        return { ok: false, code, rolledBack: true, worldMutation: false };
    };
    const relationshipResults = storyConversationMeetingRelationshipResultsApply(
        ledger, meeting, receipt
    );
    if (!relationshipResults.ok) return rollback(relationshipResults.code);
    const turnResult = storyConversationMeetingAppendTurn(meeting, {
        actorId: meeting.chair.actorId,
        addressedActorId: null,
        text: receipt.decision === 'ADOPTED'
            ? 'Oylama sonucu kabul olarak kaydedildi. Toplantıyı kapatıyorum; bu kayıt henüz kurum onayı veya uygulama değildir.'
            : 'Oylama sonucu ret olarak kaydedildi. Toplantıyı teklif üretmeden kapatıyorum.',
        kind: 'MEETING_CLOSURE_RECORDED',
        sourceRefs: [meeting.agendaItems[0].id, motion.id, motion.activeVersionId,
            receipt.id, meeting.chair.institutionId]
    });
    if (!turnResult.ok) return rollback(turnResult.code || 'MEETING_CLOSURE_TURN_REJECTED');
    const sequence = ledger.nextMeetingClosureSequence++;
    const closureId = `meeting-closure:${sequence}`;
    const closure = {
        schemaVersion: 1,
        id: closureId,
        sequence,
        meetingCaseId: meeting.id,
        sessionId: meeting.sessionId,
        conversationCaseId: meeting.conversationCaseId,
        agendaItemId: meeting.agendaItems[0].id,
        motionId: motion.id,
        motionVersionId: motion.activeVersionId,
        outcomeReceiptId: receipt.id,
        relationshipResultReceiptIds: receipt.relationshipResultReceiptIds.slice(),
        decision: receipt.decision,
        status: receipt.decision === 'ADOPTED'
            ? 'CLOSED_ADOPTED_PENDING_PROPOSAL' : 'CLOSED_REJECTED',
        chairActorId: meeting.chair.actorId,
        chairInstitutionId: meeting.chair.institutionId,
        authoritySource: 'CANONICAL_INSTITUTION_OFFICE',
        closingTurnId: turnResult.turn.id,
        proposalIntentId: motion.proposalIntent && motion.proposalIntent.id || null,
        proposalId: null,
        proposalActionType: null,
        proposalStatus: receipt.decision === 'ADOPTED' ? 'NOT_ROUTED' : 'NOT_APPLICABLE_REJECTED',
        routedAt: null,
        closedAt: Number(STORY.clock) || 0,
        physicalMutation: false,
        worldMutation: false
    };
    ledger.meetingClosures.push(closure);
    meeting.closureId = closure.id;
    meeting.status = closure.status;
    meeting.updatedAt = closure.closedAt || meeting.updatedAt;
    const validation = storyConversationSessionValidateLedger(ledger);
    if (!validation.ok) return rollback('MEETING_RELATIONSHIP_CLOSURE_INVALID');
    return { ok: true, code: 'MEETING_CLOSED', closure: storyConversationClone(closure),
        turn: turnResult.turn, meetingCase: storyConversationClone(meeting), worldMutation: false };
}

function storyConversationMeetingClosureRoute(meetingClosureId) {
    const ledger = storyConversationSessionEnsure();
    const closure = ledger && ledger.meetingClosures.find(row =>
        row.id === String(meetingClosureId));
    if (!closure) return { ok: false, code: 'MEETING_CLOSURE_NOT_FOUND', worldMutation: false };
    if (closure.decision !== 'ADOPTED') {
        return { ok: false, code: 'MEETING_REJECTED_NO_PROPOSAL', worldMutation: false };
    }
    if (closure.proposalId || closure.status === 'CLOSED_ADOPTED_PROPOSAL_ROUTED') {
        return { ok: false, code: 'MEETING_PROPOSAL_ALREADY_ROUTED',
            proposalId: closure.proposalId, worldMutation: false };
    }
    if (closure.status !== 'CLOSED_ADOPTED_PENDING_PROPOSAL') {
        return { ok: false, code: 'MEETING_CLOSURE_NOT_ROUTABLE', worldMutation: false };
    }
    const meeting = ledger.meetingCases.find(row => row.id === closure.meetingCaseId);
    const motion = meeting && meeting.motions.find(row => row.id === closure.motionId);
    const receipt = meeting && (meeting.outcomeReceipts || []).find(row =>
        row.id === closure.outcomeReceiptId);
    const intent = motion && motion.proposalIntent;
    if (!meeting || !motion || !receipt || !intent
        || intent.id !== closure.proposalIntentId
        || intent.motionVersionId !== closure.motionVersionId
        || receipt.decision !== 'ADOPTED') {
        return { ok: false, code: 'MEETING_PROPOSAL_INTENT_INVALID', worldMutation: false };
    }
    const preview = typeof storyCharacterRoleInstitutionActionPreview === 'function'
        ? storyCharacterRoleInstitutionActionPreview({
            phase: 'PROPOSE',
            actorId: closure.chairActorId,
            actionType: intent.actionType,
            targetRegionId: intent.targetRegionId
        }) : null;
    if (!preview || !preview.ok) {
        return { ok: false, code: preview && preview.code || 'MEETING_PROPOSAL_ROUTE_UNAVAILABLE',
            worldMutation: false };
    }
    if (preview.actorId !== intent.proposerActorId
        || preview.route.countryId !== intent.countryId
        || preview.route.institutionId !== intent.proposerInstitutionId
        || preview.route.institutionType !== intent.proposerInstitutionType
        || preview.actionType !== intent.actionType
        || preview.targetRegionId !== intent.targetRegionId) {
        return { ok: false, code: 'MEETING_PROPOSAL_ROUTE_STALE', worldMutation: false };
    }
    const result = typeof storyCharacterRoleInstitutionAction === 'function'
        ? storyCharacterRoleInstitutionAction({
            phase: 'PROPOSE',
            actorId: closure.chairActorId,
            actionType: intent.actionType,
            targetRegionId: intent.targetRegionId
        }) : null;
    if (!result || !result.ok || !result.request) {
        return { ok: false, code: result && result.code || 'MEETING_PROPOSAL_SUBMISSION_FAILED',
            worldMutation: false };
    }
    closure.proposalId = result.request.id;
    closure.proposalActionType = result.request.actionType;
    closure.proposalStatus = 'INSTITUTION_REQUEST_CREATED';
    closure.status = 'CLOSED_ADOPTED_PROPOSAL_ROUTED';
    closure.routedAt = Number(STORY.clock) || 0;
    meeting.status = closure.status;
    meeting.updatedAt = closure.routedAt || meeting.updatedAt;
    return { ok: true, code: 'MEETING_PROPOSAL_ROUTED',
        closure: storyConversationClone(closure), request: storyConversationClone(result.request),
        physicalMutation: false, worldMutation: true };
}

function storyConversationMeetingClosureTraceByProposal(proposalId) {
    const ledger = storyConversationSessionEnsure();
    const closure = ledger && ledger.meetingClosures.find(row =>
        row.proposalId === String(proposalId));
    if (!closure) return { ok: false, code: 'MEETING_PROPOSAL_TRACE_NOT_FOUND', worldMutation: false };
    const meeting = ledger.meetingCases.find(row => row.id === closure.meetingCaseId);
    const receipt = meeting && (meeting.outcomeReceipts || []).find(row =>
        row.id === closure.outcomeReceiptId);
    const request = STORY.institutions && STORY.institutions.requests
        ? STORY.institutions.requests[closure.proposalId] : null;
    return {
        ok: true,
        code: 'MEETING_PROPOSAL_TRACE',
        proposalId: closure.proposalId,
        meetingClosureId: closure.id,
        outcomeReceiptId: closure.outcomeReceiptId,
        meetingCaseId: closure.meetingCaseId,
        motionId: closure.motionId,
        motionVersionId: closure.motionVersionId,
        closure: storyConversationClone(closure),
        outcomeReceipt: storyConversationClone(receipt),
        institutionRequest: storyConversationClone(request),
        worldMutation: false
    };
}

function storyConversationMeetingProposalRoutes(meetingCaseId) {
    const ledger = storyConversationSessionEnsure();
    const meeting = ledger && ledger.meetingCases.find(row => row.id === String(meetingCaseId));
    if (!meeting) return { ok: false, code: 'MEETING_NOT_FOUND', routes: [], worldMutation: false };
    const view = typeof storyCharacterRoleAdapterView === 'function'
        ? storyCharacterRoleAdapterView(meeting.chair.actorId) : null;
    if (!view || !view.ok || !view.adapter) {
        return { ok: false, code: 'MEETING_CHAIR_ROLE_ADAPTER_UNAVAILABLE', routes: [], worldMutation: false };
    }
    const routes = (view.adapter.authorityRoutes || []).filter(route =>
        route.canPropose === true
        && route.countryId === meeting.countryId
        && route.institutionId === meeting.chair.institutionId
        && ['COUNTRY', 'REGION'].includes(route.targetScope))
        .map(route => ({
            actionType: route.actionType,
            countryId: route.countryId,
            institutionId: route.institutionId,
            institutionType: route.institutionType,
            targetScope: route.targetScope,
            routeMode: route.routeMode,
            legalBasis: route.legalBasis,
            requiresTargetRegion: route.targetScope === 'REGION',
            worldMutation: false
        }))
        .sort((a, b) => a.actionType.localeCompare(b.actionType, 'en'));
    return { ok: true, code: 'MEETING_PROPOSAL_ROUTES', routes: storyConversationClone(routes),
        worldMutation: false };
}

function storyConversationMeetingProposalIntentBuild(meeting, motionVersionId, input) {
    if (!input || typeof input !== 'object' || !input.actionType) {
        return { ok: false, code: 'MEETING_PROPOSAL_INTENT_REQUIRED', worldMutation: false };
    }
    const preview = typeof storyCharacterRoleInstitutionActionPreview === 'function'
        ? storyCharacterRoleInstitutionActionPreview({
            phase: 'PROPOSE',
            actorId: meeting.chair.actorId,
            actionType: input.actionType,
            targetRegionId: input.targetRegionId
        }) : null;
    if (!preview || !preview.ok) {
        return { ok: false, code: preview && preview.code || 'MEETING_PROPOSAL_ROUTE_UNAVAILABLE',
            worldMutation: false };
    }
    if (preview.route.countryId !== meeting.countryId
        || preview.route.institutionId !== meeting.chair.institutionId) {
        return { ok: false, code: 'MEETING_PROPOSAL_ROUTE_CHAIR_MISMATCH', worldMutation: false };
    }
    const intent = {
        schemaVersion: 1,
        id: `${motionVersionId}:institution-proposal-intent`,
        kind: 'INSTITUTION_ACTION',
        motionVersionId,
        actionType: preview.actionType,
        targetRegionId: preview.targetRegionId,
        countryId: preview.route.countryId,
        proposerActorId: meeting.chair.actorId,
        proposerInstitutionId: preview.route.institutionId,
        proposerInstitutionType: preview.route.institutionType,
        authoritySource: 'CANONICAL_CHARACTER_ROLE_ADAPTER',
        legalBasis: preview.route.legalBasis,
        targetScope: preview.route.targetScope,
        routeMode: preview.route.routeMode,
        previewedAt: Number(STORY.clock) || 0,
        worldMutation: false
    };
    return { ok: true, code: 'MEETING_PROPOSAL_INTENT_READY',
        proposalIntent: intent, worldMutation: false };
}

function storyConversationMeetingAdvanceSpeaker(meetingCaseId) {
    const ledger = storyConversationSessionEnsure();
    const row = ledger && ledger.meetingCases.find(item => item.id === String(meetingCaseId));
    if (!row) return { ok: false, code: 'MEETING_NOT_FOUND', worldMutation: false };
    if (row.status !== 'OPEN_NO_DECISION_ADAPTER') {
        return { ok: false, code: 'MEETING_NOT_OPEN', worldMutation: false };
    }
    const result = storyConversationMeetingAppendTurn(row, {
        actorId: row.speakingOrderActorIds[row.currentSpeakerIndex],
        kind: 'PROCEDURAL_SKIP', text: '', sourceRefs: [row.agendaItems[0].id]
    });
    return Object.assign({}, result, {
        code: result.ok ? 'MEETING_SPEAKER_ADVANCED' : result.code,
        currentSpeakerActorId: result.ok
            ? result.meetingCase.speakingOrderActorIds[result.meetingCase.currentSpeakerIndex] : null
    });
}

function storyConversationMeetingAppendTurn(meeting, input) {
    if (!meeting || meeting.status !== 'OPEN_NO_DECISION_ADAPTER') {
        return { ok: false, code: 'MEETING_NOT_OPEN', worldMutation: false };
    }
    if ((meeting.turns || []).length >= 40) {
        return { ok: false, code: 'MEETING_TURN_LIMIT', worldMutation: false };
    }
    const currentActorId = meeting.speakingOrderActorIds[meeting.currentSpeakerIndex];
    if (String(input.actorId || '') !== currentActorId) {
        return { ok: false, code: 'MEETING_SPEAKER_OUT_OF_ORDER', worldMutation: false };
    }
    const participant = meeting.participants.find(row => row.actorId === currentActorId);
    const addressedActorId = input.addressedActorId == null ? null : String(input.addressedActorId);
    if (addressedActorId && !meeting.participantActorIds.includes(addressedActorId)) {
        return { ok: false, code: 'MEETING_ADDRESSEE_NOT_PARTICIPANT', worldMutation: false };
    }
    const text = String(input.text == null ? '' : input.text).trim().replace(/\s+/g, ' ');
    if (input.kind !== 'PROCEDURAL_SKIP' && (text.length < 2 || text.length > 1200)) {
        return { ok: false, code: 'MEETING_TURN_TEXT_INVALID', worldMutation: false };
    }
    const sequence = meeting.turns.length + 1;
    const turn = {
        schemaVersion: 1, id: `${meeting.id}:turn:${sequence}`, sequence,
        actorId: currentActorId, actorName: participant && participant.name || currentActorId,
        actorRole: participant && participant.role || 'CHARACTER',
        addressedActorId, kind: String(input.kind || 'PUBLIC_STATEMENT'),
        text: input.kind === 'PROCEDURAL_SKIP' ? '' : text,
        visibility: 'MEETING_PUBLIC',
        sourceRefs: Array.from(new Set((input.sourceRefs || []).map(String))),
        grounding: input.grounding ? storyConversationClone(input.grounding) : null,
        stance: input.stance ? storyConversationClone(input.stance) : null,
        knowledgePolicy: {
            agendaVisible: true, priorPublicTurnsVisible: true,
            ownPrivateContextOnly: true, otherPrivateContextReadable: false,
            rawWorldRead: false
        },
        createdAt: Number(STORY.clock) || 0, worldMutation: false
    };
    meeting.turns.push(turn);
    for (const row of meeting.visibilityMatrix || []) row.visibleTurnIds.push(turn.id);
    meeting.currentSpeakerIndex = (meeting.currentSpeakerIndex + 1) % meeting.speakingOrderActorIds.length;
    meeting.updatedAt = Number(STORY.clock) || meeting.updatedAt;
    return { ok: true, code: 'MEETING_TURN_RECORDED', turn: storyConversationClone(turn),
        meetingCase: storyConversationClone(meeting), worldMutation: false };
}

function storyConversationMeetingSubmitPlayerTurn(meetingCaseId, text, addressedActorId) {
    const ledger = storyConversationSessionEnsure();
    const meeting = ledger && ledger.meetingCases.find(row => row.id === String(meetingCaseId));
    if (!meeting) return { ok: false, code: 'MEETING_NOT_FOUND', worldMutation: false };
    const session = storyConversationSessionFind(meeting.sessionId);
    if (!session) return { ok: false, code: 'SESSION_NOT_FOUND', worldMutation: false };
    return storyConversationMeetingAppendTurn(meeting, {
        actorId: session.playerActorId, addressedActorId, text,
        kind: 'PLAYER_PUBLIC_STATEMENT', sourceRefs: [meeting.agendaItems[0].id]
    });
}

function storyConversationMeetingSendPrivateNote(meetingCaseId, recipientActorId, text) {
    const ledger = storyConversationSessionEnsure();
    const meeting = ledger && ledger.meetingCases.find(row => row.id === String(meetingCaseId));
    if (!meeting) return { ok: false, code: 'MEETING_NOT_FOUND', worldMutation: false };
    if (meeting.status !== 'OPEN_NO_DECISION_ADAPTER') {
        return { ok: false, code: 'MEETING_NOT_OPEN', worldMutation: false };
    }
    const session = storyConversationSessionFind(meeting.sessionId);
    if (!session) return { ok: false, code: 'SESSION_NOT_FOUND', worldMutation: false };
    const authorActorId = session.playerActorId;
    const recipient = String(recipientActorId || '');
    if (!meeting.participantActorIds.includes(recipient) || recipient === authorActorId) {
        return { ok: false, code: 'MEETING_PRIVATE_NOTE_RECIPIENT_INVALID', worldMutation: false };
    }
    const normalized = String(text == null ? '' : text).trim().replace(/\s+/g, ' ');
    if (normalized.length < 2 || normalized.length > 600) {
        return { ok: false, code: 'MEETING_PRIVATE_NOTE_TEXT_INVALID', worldMutation: false };
    }
    if ((meeting.privateNotes || []).length >= 24) {
        return { ok: false, code: 'MEETING_PRIVATE_NOTE_LIMIT', worldMutation: false };
    }
    const sequence = meeting.privateNotes.length + 1;
    const note = {
        schemaVersion: 2, id: `${meeting.id}:private-note:${sequence}`, sequence,
        kind: 'PLAYER_NOTE', replyToPrivateNoteId: null,
        authorActorId, recipientActorId: recipient, text: normalized,
        visibility: 'BILATERAL_PRIVATE', sourceTurnId: null,
        sourceRefs: [], grounding: null, stance: null,
        knowledgePolicy: {
            agendaVisible: true, priorPublicTurnsVisible: false,
            rootPrivateNoteOnly: true, otherPrivateContextReadable: false,
            rawWorldRead: false
        },
        generationMode: 'PLAYER_AUTHORED', publicTurnCountAtReply: null,
        createdAt: Number(STORY.clock) || 0, worldMutation: false
    };
    meeting.privateNotes.push(note);
    for (const row of meeting.visibilityMatrix || []) {
        if (row.actorId === authorActorId || row.actorId === recipient) {
            row.visiblePrivateNoteIds.push(note.id);
        }
    }
    meeting.updatedAt = Number(STORY.clock) || meeting.updatedAt;
    return { ok: true, code: 'MEETING_PRIVATE_NOTE_RECORDED', privateNote: storyConversationClone(note),
        meetingCase: storyConversationClone(meeting), worldMutation: false };
}

function storyConversationMeetingPrivateNoteReplyContext(meeting, rootNote, participant, playerActorId) {
    const visibility = (meeting.visibilityMatrix || []).find(row =>
        row.actorId === participant.actorId);
    if (!visibility || !visibility.visiblePrivateNoteIds.includes(rootNote.id)
        || visibility.mayReadOtherPrivateContext !== false) return null;
    const visibleTurnIds = new Set(visibility.visibleTurnIds || []);
    const publicTurns = (meeting.turns || []).filter(turn =>
        turn.visibility === 'MEETING_PUBLIC' && visibleTurnIds.has(turn.id));
    const grounding = storyConversationMeetingBeliefGrounding(meeting, participant);
    const stance = storyConversationMeetingStanceEvaluate(
        meeting, participant, grounding, playerActorId
    );
    return {
        rootPrivateNoteId: rootNote.id,
        agendaItemId: meeting.agendaItems[0].id,
        visiblePublicTurnIds: publicTurns.map(turn => turn.id),
        grounding,
        stance,
        knowledgePolicy: {
            agendaVisible: true, priorPublicTurnsVisible: true,
            rootPrivateNoteOnly: true, otherPrivateContextReadable: false,
            rawWorldRead: false
        }
    };
}

function storyConversationMeetingPrivateNoteReplyText(grounding, stance) {
    let sourceBoundary;
    if (grounding) {
        const confidence = grounding.confidenceBps >= 8000 ? 'yüksek güvenli'
            : grounding.confidenceBps >= 5500 ? 'desteklenmiş' : 'sınırlı güvenli';
        sourceBoundary = grounding.summary
            ? `Kendi ${confidence} kaydımda “${grounding.summary}” bilgisi var; değerlendirmemi bununla sınırlıyorum.`
            : `Bu konuda kendi ${confidence} kurumsal kaydım var; onun sınırını aşmıyorum.`;
    } else {
        sourceBoundary = 'Notundaki iddiayı doğrulanmış gerçek saymıyorum; kendi kayıtlarımda yeterli dayanak olmadan taahhüt vermeyeceğim.';
    }
    const posture = stance && ({
        SUPPORT: 'Mevcut tutumum bu çerçeveyi destekliyor.',
        LEAN_SUPPORT: 'Mevcut tutumum desteğe yakın, fakat koşullar açık kalmalı.',
        UNDECIDED: 'Mevcut bilgilerle tutumum henüz açık.',
        LEAN_OPPOSE: 'Mevcut tutumum çekinceli; koşullar değişmeden destek vermem.',
        OPPOSE: 'Mevcut tutumum bu çerçeveye karşı.'
    })[stance.direction];
    return `İkili notunu aldım. ${sourceBoundary} ${posture || ''} Bu özel yanıt bir karar, emir veya taahhüt değildir.`
        .replace(/\s+/g, ' ').trim();
}

function storyConversationMeetingPrivateNoteRespond(meetingCaseId, privateNoteId) {
    const ledger = storyConversationSessionEnsure();
    const meeting = ledger && ledger.meetingCases.find(row => row.id === String(meetingCaseId));
    if (!meeting) return { ok: false, code: 'MEETING_NOT_FOUND', worldMutation: false };
    if (meeting.status !== 'OPEN_NO_DECISION_ADAPTER') {
        return { ok: false, code: 'MEETING_NOT_OPEN', worldMutation: false };
    }
    const session = storyConversationSessionFind(meeting.sessionId);
    if (!session) return { ok: false, code: 'SESSION_NOT_FOUND', worldMutation: false };
    const rootNote = (meeting.privateNotes || []).find(row => row.id === String(privateNoteId));
    if (!rootNote) {
        return { ok: false, code: 'MEETING_PRIVATE_NOTE_NOT_FOUND', worldMutation: false };
    }
    if (rootNote.kind !== 'PLAYER_NOTE' || rootNote.authorActorId !== session.playerActorId
        || rootNote.replyToPrivateNoteId !== null) {
        return { ok: false, code: 'MEETING_PRIVATE_NOTE_NOT_PLAYER_ROOT', worldMutation: false };
    }
    if ((meeting.privateNotes || []).some(row =>
        row.kind === 'CHARACTER_REPLY' && row.replyToPrivateNoteId === rootNote.id)) {
        return { ok: false, code: 'MEETING_PRIVATE_NOTE_ALREADY_ANSWERED', worldMutation: false };
    }
    const currentActorId = meeting.speakingOrderActorIds[meeting.currentSpeakerIndex];
    if (currentActorId !== rootNote.recipientActorId) {
        return { ok: false, code: 'MEETING_PRIVATE_NOTE_RECIPIENT_NOT_SPEAKER', worldMutation: false };
    }
    if ((meeting.privateNotes || []).length >= 24) {
        return { ok: false, code: 'MEETING_PRIVATE_NOTE_LIMIT', worldMutation: false };
    }
    const participant = meeting.participants.find(row => row.actorId === rootNote.recipientActorId);
    const context = participant && storyConversationMeetingPrivateNoteReplyContext(
        meeting, rootNote, participant, session.playerActorId
    );
    if (!context) {
        return { ok: false, code: 'MEETING_PRIVATE_NOTE_CONTEXT_NOT_VISIBLE', worldMutation: false };
    }
    const sequence = meeting.privateNotes.length + 1;
    const sourceRefs = Array.from(new Set([
        rootNote.id, context.agendaItemId
    ].concat(context.visiblePublicTurnIds,
        context.grounding ? [context.grounding.beliefId, context.grounding.worldFactId] : [],
        context.stance ? context.stance.sourceRefs : []).map(String)));
    const reply = {
        schemaVersion: 2, id: `${meeting.id}:private-note:${sequence}`, sequence,
        kind: 'CHARACTER_REPLY', replyToPrivateNoteId: rootNote.id,
        authorActorId: rootNote.recipientActorId, recipientActorId: rootNote.authorActorId,
        text: storyConversationMeetingPrivateNoteReplyText(context.grounding, context.stance),
        visibility: 'BILATERAL_PRIVATE', sourceTurnId: null,
        sourceRefs, grounding: storyConversationClone(context.grounding),
        stance: storyConversationClone(context.stance),
        knowledgePolicy: context.knowledgePolicy,
        generationMode: 'DETERMINISTIC_SOURCE_BOUND',
        publicTurnCountAtReply: meeting.turns.length,
        createdAt: Number(STORY.clock) || 0, worldMutation: false
    };
    meeting.privateNotes.push(reply);
    for (const row of meeting.visibilityMatrix || []) {
        if (row.actorId === reply.authorActorId || row.actorId === reply.recipientActorId) {
            row.visiblePrivateNoteIds.push(reply.id);
        }
    }
    meeting.updatedAt = Number(STORY.clock) || meeting.updatedAt;
    return { ok: true, code: 'MEETING_PRIVATE_NOTE_ANSWERED',
        privateReply: storyConversationClone(reply),
        meetingCase: storyConversationClone(meeting), worldMutation: false };
}

function storyConversationMeetingMotionPropose(meetingCaseId, text, proposalIntentInput) {
    const ledger = storyConversationSessionEnsure();
    const meeting = ledger && ledger.meetingCases.find(row => row.id === String(meetingCaseId));
    if (!meeting) return { ok: false, code: 'MEETING_NOT_FOUND', worldMutation: false };
    if (meeting.status !== 'OPEN_NO_DECISION_ADAPTER') {
        return { ok: false, code: 'MEETING_NOT_OPEN', worldMutation: false };
    }
    const session = storyConversationSessionFind(meeting.sessionId);
    if (!session) return { ok: false, code: 'SESSION_NOT_FOUND', worldMutation: false };
    const normalized = String(text == null ? '' : text).trim().replace(/\s+/g, ' ');
    if (normalized.length < 12 || normalized.length > 600) {
        return { ok: false, code: 'MEETING_MOTION_TEXT_INVALID', worldMutation: false };
    }
    if ((meeting.motions || []).length >= 6) {
        return { ok: false, code: 'MEETING_MOTION_LIMIT', worldMutation: false };
    }
    const sequence = meeting.motions.length + 1;
    const motionId = `${meeting.id}:motion:${sequence}`;
    const versionId = `${motionId}:version:1`;
    let proposalIntent = null;
    if (proposalIntentInput != null) {
        const intentResult = storyConversationMeetingProposalIntentBuild(
            meeting, versionId, proposalIntentInput
        );
        if (!intentResult.ok) return intentResult;
        proposalIntent = intentResult.proposalIntent;
    }
    const motion = {
        schemaVersion: 1, id: motionId, sequence,
        agendaItemId: meeting.agendaItems[0].id, proposerActorId: session.playerActorId,
        text: normalized, status: 'PENDING_CHAIR_REVIEW',
        activeVersionId: versionId,
        versions: [{
            schemaVersion: 1, id: versionId, sequence: 1, text: normalized,
            status: 'ACTIVE', createdByActorId: session.playerActorId,
            sourceResponseId: null, chairReview: null,
            createdAt: Number(STORY.clock) || 0, worldMutation: false
        }],
        chairReview: null, responses: [], voting: null, outcomeReceiptId: null,
        proposalIntent,
        proposedAt: Number(STORY.clock) || 0,
        worldMutation: false
    };
    meeting.motions.push(motion);
    meeting.updatedAt = motion.proposedAt || meeting.updatedAt;
    return { ok: true, code: 'MEETING_MOTION_PROPOSED', motion: storyConversationClone(motion),
        meetingCase: storyConversationClone(meeting), worldMutation: false };
}

function storyConversationMeetingMotionProposalIntentSet(meetingCaseId, motionId, input) {
    const ledger = storyConversationSessionEnsure();
    const meeting = ledger && ledger.meetingCases.find(row => row.id === String(meetingCaseId));
    if (!meeting) return { ok: false, code: 'MEETING_NOT_FOUND', worldMutation: false };
    if (meeting.status !== 'OPEN_NO_DECISION_ADAPTER') {
        return { ok: false, code: 'MEETING_NOT_OPEN', worldMutation: false };
    }
    const motion = meeting.motions.find(row => row.id === String(motionId));
    if (!motion) return { ok: false, code: 'MEETING_MOTION_NOT_FOUND', worldMutation: false };
    if (motion.voting) {
        return { ok: false, code: 'MEETING_PROPOSAL_INTENT_LOCKED_BY_VOTE', worldMutation: false };
    }
    const intentResult = storyConversationMeetingProposalIntentBuild(
        meeting, motion.activeVersionId, input
    );
    if (!intentResult.ok) return intentResult;
    motion.proposalIntent = intentResult.proposalIntent;
    meeting.updatedAt = Number(STORY.clock) || meeting.updatedAt;
    return { ok: true, code: 'MEETING_PROPOSAL_INTENT_SET',
        proposalIntent: storyConversationClone(motion.proposalIntent),
        motion: storyConversationClone(motion), meetingCase: storyConversationClone(meeting),
        worldMutation: false };
}

function storyConversationMeetingMotionChairReview(meetingCaseId, motionId) {
    const ledger = storyConversationSessionEnsure();
    const meeting = ledger && ledger.meetingCases.find(row => row.id === String(meetingCaseId));
    if (!meeting) return { ok: false, code: 'MEETING_NOT_FOUND', worldMutation: false };
    const motion = meeting.motions.find(row => row.id === String(motionId));
    if (!motion) return { ok: false, code: 'MEETING_MOTION_NOT_FOUND', worldMutation: false };
    if (motion.status !== 'PENDING_CHAIR_REVIEW') {
        return { ok: false, code: 'MEETING_MOTION_ALREADY_REVIEWED', worldMutation: false };
    }
    const currentActorId = meeting.speakingOrderActorIds[meeting.currentSpeakerIndex];
    if (currentActorId !== meeting.chair.actorId) {
        return { ok: false, code: 'MEETING_CHAIR_TURN_REQUIRED', worldMutation: false };
    }
    const agendaTerms = storyConversationMeetingAgendaTerms(meeting.agendaItems[0].title);
    const motionTerms = new Set(storyConversationMeetingAgendaTerms(motion.text));
    const matchedTerms = agendaTerms.filter(term => motionTerms.has(term));
    const inOrder = matchedTerms.length > 0;
    const status = inOrder ? 'IN_ORDER' : 'OUT_OF_ORDER';
    const rulingText = inOrder
        ? 'Önerge gündemle bağlantılı ve usule uygun bulundu. Bu kayıt henüz kabul kararı değildir; oylama kapısı kapalıdır.'
        : 'Önerge gündemle doğrulanabilir bağ kurmadığı için gündem dışı bırakıldı. Dünya kararı veya oylama oluşmadı.';
    const turnResult = storyConversationMeetingAppendTurn(meeting, {
        actorId: meeting.chair.actorId, addressedActorId: motion.proposerActorId,
        text: rulingText, kind: 'CHAIR_MOTION_RULING',
        sourceRefs: [meeting.agendaItems[0].id, motion.id, meeting.chair.institutionId]
    });
    if (!turnResult.ok) return turnResult;
    motion.status = status;
    motion.chairReview = {
        chairActorId: meeting.chair.actorId, chairInstitutionId: meeting.chair.institutionId,
        authoritySource: 'CANONICAL_INSTITUTION_OFFICE',
        matchedAgendaTerms: matchedTerms.slice(0, 12),
        rulingTurnId: turnResult.turn.id, reviewedAt: Number(STORY.clock) || 0,
        worldMutation: false
    };
    const activeVersion = motion.versions.find(row => row.id === motion.activeVersionId);
    if (activeVersion) activeVersion.chairReview = storyConversationClone(motion.chairReview);
    return { ok: true, code: `MEETING_MOTION_${status}`, motion: storyConversationClone(motion),
        turn: turnResult.turn, meetingCase: storyConversationClone(meeting), worldMutation: false };
}

function storyConversationMeetingMotionRespond(meetingCaseId, motionId) {
    const ledger = storyConversationSessionEnsure();
    const meeting = ledger && ledger.meetingCases.find(row => row.id === String(meetingCaseId));
    if (!meeting) return { ok: false, code: 'MEETING_NOT_FOUND', worldMutation: false };
    const motion = meeting.motions.find(row => row.id === String(motionId));
    if (!motion) return { ok: false, code: 'MEETING_MOTION_NOT_FOUND', worldMutation: false };
    if (motion.status !== 'IN_ORDER') {
        return { ok: false, code: 'MEETING_MOTION_NOT_IN_ORDER', worldMutation: false };
    }
    const session = storyConversationSessionFind(meeting.sessionId);
    if (!session) return { ok: false, code: 'SESSION_NOT_FOUND', worldMutation: false };
    const actorId = meeting.speakingOrderActorIds[meeting.currentSpeakerIndex];
    if (actorId === session.playerActorId) {
        return { ok: false, code: 'MEETING_CHARACTER_TURN_REQUIRED', worldMutation: false };
    }
    if ((motion.responses || []).some(row => row.actorId === actorId)) {
        return { ok: false, code: 'MEETING_MOTION_RESPONSE_ALREADY_RECORDED', worldMutation: false };
    }
    const participant = meeting.participants.find(row => row.actorId === actorId);
    const grounding = storyConversationMeetingBeliefGrounding(meeting, participant);
    const stance = storyConversationMeetingStanceEvaluate(meeting, participant, grounding, session.playerActorId);
    const identityLedger = typeof storyCharacterIdentityEnsure === 'function'
        ? storyCharacterIdentityEnsure() : null;
    const groundedFact = grounding && identityLedger && identityLedger.worldFacts[grounding.worldFactId];
    const explicitPosition = String(groundedFact && groundedFact.position || '').toUpperCase();
    const kind = explicitPosition === 'OPPOSE' || (!explicitPosition && stance && stance.direction === 'OPPOSE')
        ? 'OBJECTION'
        : ['AMEND', 'CONDITIONAL'].includes(explicitPosition)
            || (!explicitPosition && stance && ['LEAN_OPPOSE', 'UNDECIDED'].includes(stance.direction))
            ? 'AMENDMENT_REQUEST' : 'ENDORSEMENT';
    const summary = grounding && grounding.summary ? ` Kendi kaydım: “${grounding.summary}”` : '';
    const text = kind === 'OBJECTION'
        ? `Bu önergeye itiraz ediyorum.${summary} İtirazım henüz oy veya dünya kararı değildir.`
        : kind === 'AMENDMENT_REQUEST'
            ? `Önergenin kapsam, sorumluluk ve denetim koşulları açık yazılmadan destek vermiyorum.${summary} Değişiklik talebimi tutanağa geçiriyorum.`
            : `Önergenin gündem doğrultusunda ilerlemesini destekliyorum.${summary} Bu söz henüz oy değildir.`;
    const sequence = motion.responses.length + 1;
    const responseId = `${motion.id}:response:${sequence}`;
    const sourceRefs = [meeting.agendaItems[0].id, motion.id]
        .concat(grounding ? [grounding.beliefId, grounding.worldFactId] : [])
        .concat(stance ? stance.sourceRefs : []);
    const turnResult = storyConversationMeetingAppendTurn(meeting, {
        actorId, addressedActorId: motion.proposerActorId, text,
        kind: `MOTION_${kind}`, sourceRefs, grounding, stance
    });
    if (!turnResult.ok) return turnResult;
    const response = {
        schemaVersion: 1, id: responseId, sequence, motionId: motion.id,
        motionVersionId: motion.activeVersionId,
        actorId, kind, status: kind === 'ENDORSEMENT' ? 'NOTED' : 'OPEN',
        stanceDirection: stance && stance.direction || 'UNDECIDED',
        sourceRefs: Array.from(new Set(sourceRefs.map(String))),
        turnId: turnResult.turn.id, referral: null, resolution: null,
        createdAt: Number(STORY.clock) || 0,
        worldMutation: false
    };
    motion.responses.push(response);
    return { ok: true, code: `MEETING_MOTION_${kind}_RECORDED`, response: storyConversationClone(response),
        turn: turnResult.turn, motion: storyConversationClone(motion),
        meetingCase: storyConversationClone(meeting), worldMutation: false };
}

function storyConversationMeetingMotionAmendmentDecision(meetingCaseId, motionId, responseId, decision, revisedText) {
    const ledger = storyConversationSessionEnsure();
    const meeting = ledger && ledger.meetingCases.find(row => row.id === String(meetingCaseId));
    if (!meeting) return { ok: false, code: 'MEETING_NOT_FOUND', worldMutation: false };
    const motion = meeting.motions.find(row => row.id === String(motionId));
    if (!motion) return { ok: false, code: 'MEETING_MOTION_NOT_FOUND', worldMutation: false };
    const response = (motion.responses || []).find(row => row.id === String(responseId));
    if (!response || response.kind !== 'AMENDMENT_REQUEST') {
        return { ok: false, code: 'MEETING_AMENDMENT_NOT_FOUND', worldMutation: false };
    }
    if (response.status !== 'OPEN') {
        return { ok: false, code: 'MEETING_AMENDMENT_ALREADY_DECIDED', worldMutation: false };
    }
    const session = storyConversationSessionFind(meeting.sessionId);
    if (!session) return { ok: false, code: 'SESSION_NOT_FOUND', worldMutation: false };
    const currentActorId = meeting.speakingOrderActorIds[meeting.currentSpeakerIndex];
    if (currentActorId !== session.playerActorId) {
        return { ok: false, code: 'MEETING_PLAYER_TURN_REQUIRED', worldMutation: false };
    }
    const normalizedDecision = String(decision || '').toUpperCase();
    if (!['ACCEPT', 'REJECT'].includes(normalizedDecision)) {
        return { ok: false, code: 'MEETING_AMENDMENT_DECISION_INVALID', worldMutation: false };
    }
    let normalizedText = null;
    if (normalizedDecision === 'ACCEPT') {
        normalizedText = String(revisedText == null ? '' : revisedText).trim().replace(/\s+/g, ' ');
        const agendaTerms = storyConversationMeetingAgendaTerms(meeting.agendaItems[0].title);
        const revisedTerms = new Set(storyConversationMeetingAgendaTerms(normalizedText));
        if (normalizedText.length < 12 || normalizedText.length > 600 || normalizedText === motion.text
            || !agendaTerms.some(term => revisedTerms.has(term))) {
            return { ok: false, code: 'MEETING_AMENDMENT_TEXT_INVALID', worldMutation: false };
        }
    }
    const turnKind = normalizedDecision === 'ACCEPT'
        ? 'MOTION_AMENDMENT_ACCEPTED' : 'MOTION_AMENDMENT_REJECTED';
    const turnText = normalizedDecision === 'ACCEPT'
        ? 'Değişiklik talebini kabul ediyorum. Güncellenmiş önerge yeniden başkan incelemesine sunulacaktır; henüz oy veya karar oluşmadı.'
        : 'Değişiklik talebini reddediyorum. Mevcut önerge metni korunuyor; henüz oy veya karar oluşmadı.';
    const turnResult = storyConversationMeetingAppendTurn(meeting, {
        actorId: session.playerActorId, addressedActorId: response.actorId,
        text: turnText, kind: turnKind,
        sourceRefs: [meeting.agendaItems[0].id, motion.id, response.id, motion.activeVersionId]
    });
    if (!turnResult.ok) return turnResult;
    response.status = normalizedDecision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
    response.resolution = {
        decision: normalizedDecision, decidedByActorId: session.playerActorId,
        decisionTurnId: turnResult.turn.id, decidedAt: Number(STORY.clock) || 0,
        worldMutation: false
    };
    if (normalizedDecision === 'ACCEPT') {
        const previousVersion = motion.versions.find(row => row.id === motion.activeVersionId);
        if (previousVersion) previousVersion.status = 'SUPERSEDED';
        const versionSequence = motion.versions.length + 1;
        const version = {
            schemaVersion: 1, id: `${motion.id}:version:${versionSequence}`, sequence: versionSequence,
            text: normalizedText, status: 'ACTIVE', createdByActorId: session.playerActorId,
            sourceResponseId: response.id, chairReview: null,
            createdAt: Number(STORY.clock) || 0, worldMutation: false
        };
        motion.versions.push(version);
        motion.activeVersionId = version.id;
        motion.text = normalizedText;
        motion.status = 'PENDING_CHAIR_REVIEW';
        motion.chairReview = null;
        motion.proposalIntent = null;
    }
    return { ok: true, code: `MEETING_AMENDMENT_${response.status}`,
        response: storyConversationClone(response), motion: storyConversationClone(motion),
        turn: turnResult.turn, meetingCase: storyConversationClone(meeting), worldMutation: false };
}

function storyConversationMeetingObjectionRefer(meetingCaseId, motionId, responseId) {
    const ledger = storyConversationSessionEnsure();
    const meeting = ledger && ledger.meetingCases.find(row => row.id === String(meetingCaseId));
    if (!meeting) return { ok: false, code: 'MEETING_NOT_FOUND', worldMutation: false };
    const motion = meeting.motions.find(row => row.id === String(motionId));
    const response = motion && (motion.responses || []).find(row => row.id === String(responseId));
    if (!response || response.kind !== 'OBJECTION') {
        return { ok: false, code: 'MEETING_OBJECTION_NOT_FOUND', worldMutation: false };
    }
    if (response.status !== 'OPEN') {
        return { ok: false, code: 'MEETING_OBJECTION_NOT_OPEN', worldMutation: false };
    }
    const session = storyConversationSessionFind(meeting.sessionId);
    const currentActorId = meeting.speakingOrderActorIds[meeting.currentSpeakerIndex];
    if (!session || currentActorId !== session.playerActorId) {
        return { ok: false, code: 'MEETING_PLAYER_TURN_REQUIRED', worldMutation: false };
    }
    const turnResult = storyConversationMeetingAppendTurn(meeting, {
        actorId: session.playerActorId, addressedActorId: meeting.chair.actorId,
        text: 'Açık itirazı usul kararı için toplantı başkanına sevk ediyorum. Bu sevk itirazı silmez ve henüz oylama başlatmaz.',
        kind: 'MOTION_OBJECTION_REFERRED',
        sourceRefs: [meeting.agendaItems[0].id, motion.id, response.id, response.motionVersionId]
    });
    if (!turnResult.ok) return turnResult;
    response.status = 'REFERRED_TO_CHAIR';
    response.referral = {
        referredByActorId: session.playerActorId, referralTurnId: turnResult.turn.id,
        referredAt: Number(STORY.clock) || 0, worldMutation: false
    };
    return { ok: true, code: 'MEETING_OBJECTION_REFERRED_TO_CHAIR',
        response: storyConversationClone(response), turn: turnResult.turn,
        motion: storyConversationClone(motion), meetingCase: storyConversationClone(meeting),
        worldMutation: false };
}

function storyConversationMeetingObjectionChairRule(meetingCaseId, motionId, responseId) {
    const ledger = storyConversationSessionEnsure();
    const meeting = ledger && ledger.meetingCases.find(row => row.id === String(meetingCaseId));
    if (!meeting) return { ok: false, code: 'MEETING_NOT_FOUND', worldMutation: false };
    const motion = meeting.motions.find(row => row.id === String(motionId));
    const response = motion && (motion.responses || []).find(row => row.id === String(responseId));
    if (!response || response.kind !== 'OBJECTION') {
        return { ok: false, code: 'MEETING_OBJECTION_NOT_FOUND', worldMutation: false };
    }
    if (response.status !== 'REFERRED_TO_CHAIR') {
        return { ok: false, code: 'MEETING_OBJECTION_NOT_REFERRED', worldMutation: false };
    }
    const currentActorId = meeting.speakingOrderActorIds[meeting.currentSpeakerIndex];
    if (currentActorId !== meeting.chair.actorId) {
        return { ok: false, code: 'MEETING_CHAIR_TURN_REQUIRED', worldMutation: false };
    }
    const ruling = response.motionVersionId !== motion.activeVersionId
        ? 'MOOT_BY_REVISION' : 'DISSENT_RECORDED';
    const text = ruling === 'MOOT_BY_REVISION'
        ? 'İtiraz önceki önerge sürümüne aittir. Metin değiştiği için itiraz revizyonla konusuz kaldı; yeni sürüme otomatik karşı oy sayılmaz.'
        : 'İtiraz güncel önerge sürümüne aittir. Muhalefet şerhi korunarak usul bakımından oylama önüne taşınabilir; bu karar itirazı destek oyuna çevirmez.';
    const turnResult = storyConversationMeetingAppendTurn(meeting, {
        actorId: meeting.chair.actorId, addressedActorId: response.actorId,
        text, kind: 'MOTION_OBJECTION_CHAIR_RULING',
        sourceRefs: [meeting.agendaItems[0].id, motion.id, response.id,
            response.motionVersionId, motion.activeVersionId, meeting.chair.institutionId]
    });
    if (!turnResult.ok) return turnResult;
    response.status = 'RESOLVED_FOR_PROCEDURE';
    response.resolution = {
        ruling, chairActorId: meeting.chair.actorId,
        chairInstitutionId: meeting.chair.institutionId,
        authoritySource: 'CANONICAL_INSTITUTION_OFFICE',
        rulingTurnId: turnResult.turn.id, decidedAt: Number(STORY.clock) || 0,
        preservesDissent: ruling === 'DISSENT_RECORDED', worldMutation: false
    };
    return { ok: true, code: `MEETING_OBJECTION_${ruling}`,
        response: storyConversationClone(response), turn: turnResult.turn,
        motion: storyConversationClone(motion), meetingCase: storyConversationClone(meeting),
        worldMutation: false };
}

function storyConversationMeetingMotionOpenVote(meetingCaseId, motionId) {
    const ledger = storyConversationSessionEnsure();
    const meeting = ledger && ledger.meetingCases.find(row => row.id === String(meetingCaseId));
    if (!meeting) return { ok: false, code: 'MEETING_NOT_FOUND', worldMutation: false };
    const motion = meeting.motions.find(row => row.id === String(motionId));
    if (!motion) return { ok: false, code: 'MEETING_MOTION_NOT_FOUND', worldMutation: false };
    if (motion.status !== 'IN_ORDER' || !motion.chairReview
        || !(motion.versions || []).some(version => version.id === motion.activeVersionId
            && version.status === 'ACTIVE' && version.chairReview)) {
        return { ok: false, code: 'MEETING_VOTE_CURRENT_VERSION_NOT_IN_ORDER', worldMutation: false };
    }
    if (motion.voting) return { ok: false, code: 'MEETING_VOTE_ALREADY_OPENED', worldMutation: false };
    if ((motion.responses || []).some(response => response.kind === 'AMENDMENT_REQUEST'
        && response.status === 'OPEN')) {
        return { ok: false, code: 'MEETING_VOTE_OPEN_AMENDMENT', worldMutation: false };
    }
    if ((motion.responses || []).some(response => response.kind === 'OBJECTION'
        && response.status !== 'RESOLVED_FOR_PROCEDURE')) {
        return { ok: false, code: 'MEETING_VOTE_UNRESOLVED_OBJECTION', worldMutation: false };
    }
    const currentActorId = meeting.speakingOrderActorIds[meeting.currentSpeakerIndex];
    if (currentActorId !== meeting.chair.actorId) {
        return { ok: false, code: 'MEETING_CHAIR_TURN_REQUIRED', worldMutation: false };
    }
    const turnResult = storyConversationMeetingAppendTurn(meeting, {
        actorId: meeting.chair.actorId, addressedActorId: null,
        text: 'Güncel önerge sürümü usule uygun ve açık usul borcu kalmadı. Oylamayı açıyorum; her katılımcı yalnız kendi söz sırasında bir oy kullanacaktır.',
        kind: 'MOTION_VOTE_OPENED',
        sourceRefs: [meeting.agendaItems[0].id, motion.id, motion.activeVersionId,
            meeting.chair.institutionId]
    });
    if (!turnResult.ok) return turnResult;
    motion.voting = {
        schemaVersion: 1, status: 'OPEN', motionVersionId: motion.activeVersionId,
        openedByActorId: meeting.chair.actorId,
        chairInstitutionId: meeting.chair.institutionId,
        authoritySource: 'CANONICAL_INSTITUTION_OFFICE', openTurnId: turnResult.turn.id,
        openedAt: Number(STORY.clock) || 0, completedAt: null, worldMutation: false
    };
    return { ok: true, code: 'MEETING_MOTION_VOTE_OPENED', voting: storyConversationClone(motion.voting),
        motion: storyConversationClone(motion), turn: turnResult.turn,
        meetingCase: storyConversationClone(meeting), worldMutation: false };
}

function storyConversationMeetingMotionCastVote(meetingCaseId, motionId, choice) {
    const ledger = storyConversationSessionEnsure();
    const meeting = ledger && ledger.meetingCases.find(row => row.id === String(meetingCaseId));
    if (!meeting) return { ok: false, code: 'MEETING_NOT_FOUND', worldMutation: false };
    const motion = meeting.motions.find(row => row.id === String(motionId));
    if (!motion) return { ok: false, code: 'MEETING_MOTION_NOT_FOUND', worldMutation: false };
    if (!motion.voting || motion.voting.status !== 'OPEN'
        || motion.voting.motionVersionId !== motion.activeVersionId) {
        return { ok: false, code: 'MEETING_VOTE_NOT_OPEN', worldMutation: false };
    }
    const session = storyConversationSessionFind(meeting.sessionId);
    if (!session) return { ok: false, code: 'SESSION_NOT_FOUND', worldMutation: false };
    const actorId = meeting.speakingOrderActorIds[meeting.currentSpeakerIndex];
    if ((meeting.votes || []).some(vote => vote.motionId === motion.id
        && vote.motionVersionId === motion.activeVersionId && vote.actorId === actorId)) {
        return { ok: false, code: 'MEETING_VOTE_ALREADY_CAST', worldMutation: false };
    }
    const participant = meeting.participants.find(row => row.actorId === actorId);
    if (!participant) return { ok: false, code: 'MEETING_PARTICIPANT_NOT_FOUND', worldMutation: false };
    const playerVote = actorId === session.playerActorId;
    let normalizedChoice = String(choice || '').toUpperCase();
    let basis = 'PLAYER_EXPLICIT_CHOICE';
    let sourceRefs = [meeting.agendaItems[0].id, motion.id, motion.activeVersionId];
    if (playerVote) {
        if (!['YES', 'NO', 'ABSTAIN'].includes(normalizedChoice)) {
            return { ok: false, code: 'MEETING_PLAYER_VOTE_INVALID', worldMutation: false };
        }
    } else {
        const response = (motion.responses || []).find(row => row.actorId === actorId
            && row.motionVersionId === motion.activeVersionId);
        const grounding = storyConversationMeetingBeliefGrounding(meeting, participant);
        const stance = storyConversationMeetingStanceEvaluate(meeting, participant, grounding,
            session.playerActorId);
        if (response && response.kind === 'ENDORSEMENT') normalizedChoice = 'YES';
        else if (response && response.kind === 'OBJECTION'
            && response.resolution && response.resolution.preservesDissent) normalizedChoice = 'NO';
        else if (response && response.kind === 'AMENDMENT_REQUEST' && response.status === 'REJECTED') {
            normalizedChoice = 'NO';
        } else if (stance && ['SUPPORT', 'LEAN_SUPPORT'].includes(stance.direction)) normalizedChoice = 'YES';
        else if (stance && ['OPPOSE', 'LEAN_OPPOSE'].includes(stance.direction)) normalizedChoice = 'NO';
        else normalizedChoice = 'ABSTAIN';
        basis = response ? `RECORDED_${response.kind}` : 'MEETING_STANCE';
        sourceRefs = sourceRefs.concat(response ? [response.id].concat(response.sourceRefs || [])
            : stance ? stance.sourceRefs || [] : []);
    }
    sourceRefs = Array.from(new Set(sourceRefs.map(String)));
    const choiceLabels = { YES: 'kabul', NO: 'ret', ABSTAIN: 'çekimser' };
    const turnResult = storyConversationMeetingAppendTurn(meeting, {
        actorId, addressedActorId: meeting.chair.actorId,
        text: `Oyumu ${choiceLabels[normalizedChoice]} yönünde kullanıyorum. Bu oy yalnız güncel önerge sürümüne aittir.`,
        kind: 'MOTION_VOTE', sourceRefs
    });
    if (!turnResult.ok) return turnResult;
    const sequence = meeting.votes.length + 1;
    const vote = {
        schemaVersion: 1, id: `${meeting.id}:vote:${sequence}`, sequence,
        motionId: motion.id, motionVersionId: motion.activeVersionId, actorId,
        choice: normalizedChoice, basis, sourceRefs, turnId: turnResult.turn.id,
        castAt: Number(STORY.clock) || 0, worldMutation: false
    };
    meeting.votes.push(vote);
    const motionVotes = meeting.votes.filter(row => row.motionId === motion.id
        && row.motionVersionId === motion.activeVersionId);
    let outcomeReceipt = null;
    if (motionVotes.length === meeting.participantActorIds.length) {
        const tally = { yes: 0, no: 0, abstain: 0 };
        for (const row of motionVotes) tally[row.choice.toLowerCase()]++;
        const decision = tally.yes > tally.no ? 'ADOPTED' : 'REJECTED';
        const receiptSequence = meeting.outcomeReceipts.length + 1;
        outcomeReceipt = {
            schemaVersion: STORY_CONVERSATION_MEETING_OUTCOME_RECEIPT_SCHEMA_VERSION,
            id: `${meeting.id}:outcome:${receiptSequence}`, sequence: receiptSequence,
            meetingCaseId: meeting.id, agendaItemId: motion.agendaItemId, motionId: motion.id,
            motionVersionId: motion.activeVersionId, decision, tally,
            voteIds: motionVotes.map(row => row.id), completedByTurnId: turnResult.turn.id,
            completedAt: Number(STORY.clock) || 0,
            relationshipResultReceiptIds: [],
            authoritySource: 'MEETING_RECORDED_VOTE', physicalMutation: false, worldMutation: false
        };
        meeting.outcomeReceipts.push(outcomeReceipt);
        meeting.outcomeReceiptId = outcomeReceipt.id;
        motion.outcomeReceiptId = outcomeReceipt.id;
        motion.voting.status = 'COMPLETED';
        motion.voting.completedAt = outcomeReceipt.completedAt;
    }
    return { ok: true, code: outcomeReceipt ? `MEETING_MOTION_${outcomeReceipt.decision}` : 'MEETING_VOTE_RECORDED',
        vote: storyConversationClone(vote), outcomeReceipt: storyConversationClone(outcomeReceipt),
        motion: storyConversationClone(motion), turn: turnResult.turn,
        meetingCase: storyConversationClone(meeting), worldMutation: false };
}

function storyConversationMeetingAgendaTerms(text) {
    const stop = new Set(['acik', 'icin', 'ile', 've', 'veya', 'bir', 'bu', 'icin', 'uzere',
        'gibi', 'daha', 'olan', 'olarak', 'icin', 'sonra', 'once']);
    return Array.from(new Set(String(text || '').toLocaleLowerCase('tr-TR')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i')
        .split(/[^a-z0-9]+/).filter(token => token.length >= 4 && !stop.has(token))));
}

function storyConversationMeetingBeliefGrounding(meeting, participant) {
    if (!participant || typeof storyConversationActorBeliefView !== 'function') return null;
    const view = storyConversationActorBeliefView(participant.actorId, { trackRead: true });
    const agendaTerms = storyConversationMeetingAgendaTerms(meeting.agendaItems[0].title);
    const eligible = (view.beliefs || []).filter(belief => {
        const visibility = String(belief.fact && belief.fact.visibility || 'PRIVATE').toUpperCase();
        return belief.beliefStatus !== 'CONTRADICTED' && Number(belief.confidenceBps) >= 3500
            && ['PUBLIC', 'INSTITUTIONAL'].includes(visibility);
    }).map(belief => {
        const fact = belief.fact || {};
        const searchable = [fact.factType, fact.publicSummary, fact.summary, fact.text,
            fact.questionText, fact.optionText, fact.theme, fact.reactionHook]
            .filter(Boolean).join(' ').toLocaleLowerCase('tr-TR')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
        const relevance = agendaTerms.reduce((sum, token) => sum + (searchable.includes(token) ? 1 : 0), 0);
        return { belief, relevance };
    }).sort((a, b) => b.relevance - a.relevance
        || Number(b.belief.confidenceBps) - Number(a.belief.confidenceBps)
        || Number(b.belief.learnedAt) - Number(a.belief.learnedAt)
        || String(a.belief.id).localeCompare(String(b.belief.id), 'en'));
    if (!eligible.length) return null;
    const selected = eligible[0].belief;
    const fact = selected.fact || {};
    const summary = String(fact.publicSummary || fact.summary || fact.text || fact.optionText || '')
        .trim().replace(/\s+/g, ' ').slice(0, 220);
    return {
        beliefId: selected.id,
        worldFactId: selected.worldFactId,
        beliefStatus: String(selected.beliefStatus || 'REPORTED'),
        confidenceBps: Number(selected.confidenceBps) || 0,
        factType: String(fact.factType || 'SOURCED_RECORD'),
        summary: summary || null,
        visibility: String(fact.visibility || 'INSTITUTIONAL').toUpperCase()
    };
}

function storyConversationMeetingAgendaProfile(title) {
    const folded = String(title || '').toLocaleLowerCase('tr-TR')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
    const has = rows => rows.some(row => folded.includes(row));
    return {
        economy: has(['sanayi', 'ekonomi', 'yatirim', 'kaynak', 'butce', 'uretim', 'ticaret', 'sirket']),
        security: has(['ordu', 'asker', 'guvenlik', 'savunma', 'harekat', 'tehdit', 'sinir']),
        publicService: has(['halk', 'refah', 'saglik', 'egitim', 'konut', 'altyapi', 'belediye']),
        governance: has(['kurum', 'yetki', 'denetim', 'sorumluluk', 'kanun', 'konsey', 'yonetim'])
    };
}

function storyConversationMeetingStanceEvaluate(meeting, participant, grounding, playerActorId) {
    if (!meeting || !participant || participant.actorId === playerActorId
        || typeof storyCharacterIdentityView !== 'function') return null;
    const identity = storyCharacterIdentityView(participant.actorId);
    if (!identity) return null;
    const profile = storyConversationMeetingAgendaProfile(meeting.agendaItems[0].title);
    const axes = identity.coreAxes || {};
    const values = identity.values || {};
    const centered = value => (Number(value) || 50) - 50;
    let score = 0;
    const reasons = [];
    if (profile.economy) {
        const economyFit = ['COMPANY_OWNER', 'COMPANY_EXECUTIVE'].includes(identity.role) ? 1350 : 500;
        score += economyFit + centered(axes.stateMarketOrientation) * 28;
        reasons.push('ECONOMIC_INTEREST');
    }
    if (profile.security) {
        score += centered(values.hawkishness) * 34
            + (identity.role === 'COMMANDER' ? 1050 : identity.role === 'AGENT' ? 650 : 0);
        reasons.push('SECURITY_POSTURE');
    }
    if (profile.publicService) {
        score += centered(values.publicResponsiveness) * 30;
        reasons.push('PUBLIC_CONSEQUENCE');
    }
    if (profile.governance) {
        score += centered(axes.institutionalPosture) * 32;
        reasons.push('INSTITUTIONAL_FIT');
    }
    const relation = typeof storyRelationshipView === 'function'
        ? storyRelationshipView(participant.actorId, playerActorId) : null;
    if (relation) {
        const relationshipContribution = (Number(relation.trustBps) - 5000) * 0.34
            + (Number(relation.respectBps) - 5000) * 0.18
            - (Number(relation.hostilityBps) - 5000) * 0.31;
        score += relationshipContribution;
        reasons.push(relationshipContribution >= 0 ? 'WORKING_RELATIONSHIP' : 'RELATIONSHIP_RESERVATION');
    }
    if (grounding) {
        const fact = typeof storyCharacterIdentityEnsure === 'function'
            ? storyCharacterIdentityEnsure().worldFacts[grounding.worldFactId] : null;
        const explicitPosition = String(fact && fact.position || '').toUpperCase();
        if (explicitPosition === 'SUPPORT') score += 4200;
        else if (explicitPosition === 'OPPOSE') score -= 4200;
        reasons.push('SOURCED_ACTOR_BELIEF');
    }
    if (!profile.economy && !profile.security && !profile.publicService && !profile.governance) {
        reasons.push('AGENDA_FIT_UNCLEAR');
    }
    score = Math.max(-10000, Math.min(10000, Math.round(score)));
    const direction = score >= 3000 ? 'SUPPORT' : score >= 900 ? 'LEAN_SUPPORT'
        : score <= -3000 ? 'OPPOSE' : score <= -900 ? 'LEAN_OPPOSE' : 'UNDECIDED';
    const confidenceBps = Math.max(3000, Math.min(9800, Math.round(3800 + Math.abs(score) * 0.42
        + (grounding ? grounding.confidenceBps * 0.18 : 0))));
    const sourceRefs = [meeting.agendaItems[0].id, identity.id]
        .concat(relation && relation.id ? [relation.id] : [])
        .concat(grounding ? [grounding.beliefId, grounding.worldFactId] : []);
    return {
        schemaVersion: 1, direction, scoreBps: score, confidenceBps,
        publicReasonCodes: Array.from(new Set(reasons)),
        sourceRefs: Array.from(new Set(sourceRefs.map(String))),
        rawPersonalityAxesExposed: false, rawRelationshipAxesExposed: false,
        computedAt: Number(STORY.clock) || 0, worldMutation: false
    };
}

function storyConversationMeetingStancePreview(meetingCaseId, actorId) {
    const ledger = storyConversationSessionEnsure();
    const meeting = ledger && ledger.meetingCases.find(row => row.id === String(meetingCaseId));
    if (!meeting) return { ok: false, code: 'MEETING_NOT_FOUND', worldMutation: false };
    const session = storyConversationSessionFind(meeting.sessionId);
    const participant = meeting.participants.find(row => row.actorId === String(actorId || ''));
    if (!session || !participant) return { ok: false, code: 'MEETING_PARTICIPANT_NOT_FOUND', worldMutation: false };
    const grounding = storyConversationMeetingBeliefGrounding(meeting, participant);
    const stance = storyConversationMeetingStanceEvaluate(
        meeting, participant, grounding, session.playerActorId
    );
    return stance ? { ok: true, code: 'MEETING_STANCE_READY', stance, worldMutation: false }
        : { ok: false, code: 'MEETING_STANCE_UNAVAILABLE', worldMutation: false };
}

function storyConversationMeetingCharacterText(meeting, participant, grounding, stance) {
    const agenda = meeting.agendaItems[0].title;
    const previousCount = meeting.turns.filter(row => row.actorId === participant.actorId
        && row.kind === 'CHARACTER_PROCEDURAL_STATEMENT').length;
    if (grounding) {
        const confidence = grounding.confidenceBps >= 8000 ? 'yüksek güvenli'
            : grounding.confidenceBps >= 5500 ? 'desteklenmiş' : 'sınırlı güvenli';
        const sourced = grounding.summary
            ? `Kendi ${confidence} kaydımda şu bilgi var: “${grounding.summary}”`
            : `Bu gündemle ilgili kendi ${confidence} kurumsal kaydım bulunuyor.`;
        const endings = [
            'Bunu doğrulanmış dünya gerçeği değil, benim bildiğim kaynak olarak tutanağa geçiriyorum.',
            'Bu kaynağın sınırını aşmadan gündem değerlendirmemde dayanak olarak kullanıyorum.',
            'Diğer katılımcıların özel bilgisine erişmeden görüşümü bu kayıtla sınırlıyorum.'
        ];
        const posture = stance && ({
            SUPPORT: 'Bu nedenle gündemdeki çerçeveyi destekliyorum.',
            LEAN_SUPPORT: 'Bu nedenle çerçeveyi desteklemeye yakınım; koşulların açık yazılmasını istiyorum.',
            UNDECIDED: 'Bu kayıt tek başına karar vermeme yetmiyor; tutumum şimdilik açık.',
            LEAN_OPPOSE: 'Bu nedenle çerçeveye mesafeliyim; çekinceler giderilmeden destek vermem.',
            OPPOSE: 'Bu nedenle mevcut çerçeveye karşıyım.'
        })[stance.direction];
        return `${sourced} ${posture || ''} ${endings[previousCount % endings.length]}`.replace(/\s+/g, ' ').trim();
    }
    let candidates;
    if (participant.actorId === meeting.chair.actorId) candidates = [
        `“${agenda}” gündemi kayda alındı. Katılımcılar yalnız kendi yetki ve bilgileri içinde konuşsun; bu oturum henüz karar üretmiyor.`,
        'İlk görüşler tutanağa geçti. Açık bir önerge sunulmadığı için sırayı sürdürüyorum ve hiçbir sözü karar olarak kaydetmiyorum.',
        'Gündem hâlâ açık. Katılımcılar itirazlarını ve dayandıkları yetkiyi ayırsın; sonuç kapısı açılmadan oturumu bağlamayacağım.'
    ];
    const role = String(participant.role || 'CHARACTER');
    if (!candidates && role === 'COMMANDER') candidates = [
        'Gündemi askerî açıdan dinliyorum. Doğrulanmış emir veya kaynak tahsisi olmadığı için bağlayıcı taahhüt vermiyorum.',
        'Askerî sorumluluk konuşulacaksa hedef, kaynak ve komuta yetkisi ayrı ayrı doğrulanmalı. Şu an bunlardan bir emir çıkarmıyorum.',
        'Risk başlıklarını kayda geçirebilirim; fakat teyitli kuvvet ve yetki fişi olmadan harekât sözü veremem.'
    ];
    if (!candidates && (role === 'COMPANY_EXECUTIVE' || role === 'COMPANY_OWNER')) candidates = [
        'Gündemi kurumsal kapasite açısından dinliyorum. Doğrulanmış şirket onayı ve bütçe kaydı olmadan taahhüt vermiyorum.',
        'Şirket adına konuşabilmem için kapsam, finansman ve onay zinciri açık olmalı. Mevcut sözümü yalnız değerlendirme olarak kaydedin.',
        'Kaynak talebi somutlaşırsa yetkili şirket kayıtlarıyla inceleyebilirim; bu aşamada yatırım sözü oluşmadı.'
    ];
    if (!candidates && (role === 'POLITICAL_FIGURE' || role === 'EXECUTIVE')) candidates = [
        'Gündemi kamusal ve kurumsal sorumluluk açısından dinliyorum. Önerge ve yetki kapısı açılmadan bunu resmî karar saymıyorum.',
        'Siyasi tercih ile uygulanabilir karar aynı şey değil. Yetkili önerge gelmeden yalnız görüş bildiriyorum.',
        'Kamusal bedel ve sorumluluk açık yazılmalı. Şimdilik bu söz bir onay veya yürütme talimatı değildir.'
    ];
    if (!candidates) candidates = [
        'Gündemi dinledim. Kendi doğrulanmış bilgi alanım dışında iddia veya bağlayıcı karar üretmeyeceğim.',
        'Önceki sözleri duydum; doğrulayamadığım noktaları benimsemeden kendi sorumluluk alanımı bekliyorum.',
        'Yeni kanıt veya açık bir önerge gelirse değerlendirebilirim. Bu turda karar ya da taahhüt vermiyorum.'
    ];
    return candidates[previousCount % candidates.length];
}

function storyConversationMeetingGenerateCharacterTurn(meetingCaseId, addressedActorId) {
    const ledger = storyConversationSessionEnsure();
    const meeting = ledger && ledger.meetingCases.find(row => row.id === String(meetingCaseId));
    if (!meeting) return { ok: false, code: 'MEETING_NOT_FOUND', worldMutation: false };
    const session = storyConversationSessionFind(meeting.sessionId);
    const actorId = meeting.speakingOrderActorIds[meeting.currentSpeakerIndex];
    if (session && actorId === session.playerActorId) {
        return { ok: false, code: 'PLAYER_TURN_REQUIRES_INPUT', worldMutation: false };
    }
    const participant = meeting.participants.find(row => row.actorId === actorId);
    const grounding = storyConversationMeetingBeliefGrounding(meeting, participant);
    const stance = storyConversationMeetingStanceEvaluate(
        meeting, participant, grounding, session && session.playerActorId
    );
    return storyConversationMeetingAppendTurn(meeting, {
        actorId, addressedActorId, text: storyConversationMeetingCharacterText(meeting, participant, grounding, stance),
        kind: 'CHARACTER_PROCEDURAL_STATEMENT',
        sourceRefs: [meeting.agendaItems[0].id].concat(
            actorId === meeting.chair.actorId ? [meeting.chair.institutionId] : [],
            grounding ? [grounding.beliefId, grounding.worldFactId] : [],
            stance ? stance.sourceRefs : []),
        grounding, stance
    });
}

function storyConversationSessionMigrateLedger(saved) {
    const ledger = storyConversationClone(saved);
    if (!ledger || typeof ledger !== 'object'
        || ![1, 2, 3, 4, 5, 6, STORY_CONVERSATION_SESSION_SCHEMA_VERSION]
            .includes(Number(ledger.schemaVersion))) return null;
    ledger.schemaVersion = STORY_CONVERSATION_SESSION_SCHEMA_VERSION;
    ledger.adapterVersion = STORY_CONVERSATION_SESSION_ADAPTER_VERSION;
    ledger.nextTaskOfferSequence = Number.isInteger(ledger.nextTaskOfferSequence)
        && ledger.nextTaskOfferSequence > 0 ? ledger.nextTaskOfferSequence : 1;
    if (!Array.isArray(ledger.taskOffers)) ledger.taskOffers = [];
    for (const taskOffer of ledger.taskOffers) {
        if (taskOffer && [1, 2].includes(taskOffer.schemaVersion)) {
            taskOffer.schemaVersion = STORY_CONVERSATION_TASK_OFFER_SCHEMA_VERSION;
            if (taskOffer.kind === 'CONTACT_REQUEST') taskOffer.kind = 'PERSONAL_CONTACT_REQUEST';
            if (!Object.prototype.hasOwnProperty.call(taskOffer, 'institutional')) taskOffer.institutional = null;
        }
        if (taskOffer && !Object.prototype.hasOwnProperty.call(taskOffer, 'relationshipResultReceiptId')) {
            taskOffer.relationshipResultReceiptId = null;
        }
        if (taskOffer && taskOffer.institutional) {
            if (!Object.prototype.hasOwnProperty.call(taskOffer.institutional, 'relationshipResultReceiptId')) {
                taskOffer.institutional.relationshipResultReceiptId = null;
            }
            if (taskOffer.institutional.resultReceipt
                && !Object.prototype.hasOwnProperty.call(taskOffer.institutional.resultReceipt, 'relationshipResultReceiptId')) {
                taskOffer.institutional.resultReceipt.relationshipResultReceiptId = null;
            }
        }
    }
    ledger.nextMeetingSequence = Number.isInteger(ledger.nextMeetingSequence)
        && ledger.nextMeetingSequence > 0 ? ledger.nextMeetingSequence : 1;
    ledger.nextMeetingClosureSequence = Number.isInteger(ledger.nextMeetingClosureSequence)
        && ledger.nextMeetingClosureSequence > 0 ? ledger.nextMeetingClosureSequence : 1;
    if (!Array.isArray(ledger.meetingCases)) ledger.meetingCases = [];
    if (!Array.isArray(ledger.meetingClosures)) ledger.meetingClosures = [];
    for (const meeting of ledger.meetingCases) {
        if (!Object.prototype.hasOwnProperty.call(meeting, 'closureId')) meeting.closureId = null;
        if (!Array.isArray(meeting.turns)) meeting.turns = [];
        if (!Array.isArray(meeting.privateNotes)) meeting.privateNotes = [];
        for (const note of meeting.privateNotes) {
            note.schemaVersion = 2;
            if (!Object.prototype.hasOwnProperty.call(note, 'kind')) note.kind = 'PLAYER_NOTE';
            if (!Object.prototype.hasOwnProperty.call(note, 'replyToPrivateNoteId')) {
                note.replyToPrivateNoteId = null;
            }
            if (!Array.isArray(note.sourceRefs)) note.sourceRefs = [];
            if (!Object.prototype.hasOwnProperty.call(note, 'grounding')) note.grounding = null;
            if (!Object.prototype.hasOwnProperty.call(note, 'stance')) note.stance = null;
            if (!note.knowledgePolicy || typeof note.knowledgePolicy !== 'object') {
                note.knowledgePolicy = {
                    agendaVisible: true, priorPublicTurnsVisible: false,
                    rootPrivateNoteOnly: true, otherPrivateContextReadable: false,
                    rawWorldRead: false
                };
            }
            if (!Object.prototype.hasOwnProperty.call(note, 'generationMode')) {
                note.generationMode = 'PLAYER_AUTHORED';
            }
            if (!Object.prototype.hasOwnProperty.call(note, 'publicTurnCountAtReply')) {
                note.publicTurnCountAtReply = null;
            }
        }
        for (const turn of meeting.turns) {
            if (!Object.prototype.hasOwnProperty.call(turn, 'grounding')) turn.grounding = null;
            if (!Object.prototype.hasOwnProperty.call(turn, 'stance')) turn.stance = null;
        }
        if (!Array.isArray(meeting.motions)) meeting.motions = [];
        for (const motion of meeting.motions) {
            if (!Array.isArray(motion.responses)) motion.responses = [];
            if (!Object.prototype.hasOwnProperty.call(motion, 'voting')) motion.voting = null;
            if (!Object.prototype.hasOwnProperty.call(motion, 'outcomeReceiptId')) motion.outcomeReceiptId = null;
            if (!Object.prototype.hasOwnProperty.call(motion, 'proposalIntent')) motion.proposalIntent = null;
            if (!Array.isArray(motion.versions) || !motion.versions.length) {
                motion.versions = [{
                    schemaVersion: 1, id: `${motion.id}:version:1`, sequence: 1,
                    text: motion.text, status: 'ACTIVE', createdByActorId: motion.proposerActorId,
                    sourceResponseId: null, chairReview: storyConversationClone(motion.chairReview || null),
                    createdAt: Number(motion.proposedAt) || 0, worldMutation: false
                }];
                motion.activeVersionId = motion.versions[0].id;
                motion.proposalIntent = null;
            }
            for (const response of motion.responses) {
                if (!Object.prototype.hasOwnProperty.call(response, 'motionVersionId')) {
                    response.motionVersionId = motion.versions[0].id;
                }
                if (!Object.prototype.hasOwnProperty.call(response, 'resolution')) response.resolution = null;
                if (!Object.prototype.hasOwnProperty.call(response, 'referral')) response.referral = null;
            }
        }
        if (!Array.isArray(meeting.votes)) meeting.votes = [];
        if (!Array.isArray(meeting.outcomeReceipts)) meeting.outcomeReceipts = [];
        for (const receipt of meeting.outcomeReceipts) {
            if (receipt && receipt.schemaVersion === 1) {
                receipt.schemaVersion = STORY_CONVERSATION_MEETING_OUTCOME_RECEIPT_SCHEMA_VERSION;
            }
            if (receipt && !Array.isArray(receipt.relationshipResultReceiptIds)) {
                receipt.relationshipResultReceiptIds = [];
            }
        }
        if (!Object.prototype.hasOwnProperty.call(meeting, 'outcomeReceiptId')) meeting.outcomeReceiptId = null;
        const participantActorIds = Array.isArray(meeting.participantActorIds)
            ? meeting.participantActorIds.slice() : [];
        const agendaIds = (meeting.agendaItems || []).map(row => row.id);
        const publicTurnIds = meeting.turns.filter(row => row.visibility === 'MEETING_PUBLIC').map(row => row.id);
        if (!Array.isArray(meeting.visibilityMatrix)
            || meeting.visibilityMatrix.length !== participantActorIds.length) {
            meeting.visibilityMatrix = participantActorIds.map(actorId => ({
                actorId, visibleParticipantActorIds: participantActorIds.slice(),
                visibleAgendaItemIds: agendaIds.slice(), visibleTurnIds: publicTurnIds.slice(),
                visiblePrivateNoteIds: meeting.privateNotes.filter(note =>
                    note.authorActorId === actorId || note.recipientActorId === actorId).map(note => note.id),
                privateContextOwnerActorId: actorId,
                mayReadOtherPrivateContext: false
            }));
        }
        for (const row of meeting.visibilityMatrix) {
            if (!Array.isArray(row.visiblePrivateNoteIds)) {
                row.visiblePrivateNoteIds = meeting.privateNotes.filter(note =>
                    note.authorActorId === row.actorId || note.recipientActorId === row.actorId).map(note => note.id);
            }
        }
    }
    for (const closure of ledger.meetingClosures) {
        if (closure && !Array.isArray(closure.relationshipResultReceiptIds)) {
            closure.relationshipResultReceiptIds = [];
        }
    }
    ledger.diagnostics = Object.assign({
        prunedSessions: 0, rejectedReplies: 0, worldMutations: 0,
        domainReviews: 0, listenerBeliefReads: 0, rawWorldReads: 0,
        playerResponses: 0, knowledgeTransfers: 0, socialResponses: 0,
        socialFollowUps: 0, memoryRecalls: 0, caseModeSwitches: 0,
        prunedTaskOffers: 0
    }, ledger.diagnostics || {});
    for (const session of (ledger.sessions || [])) {
        session.schemaVersion = STORY_CONVERSATION_SESSION_SCHEMA_VERSION;
        if (!Array.isArray(session.listenerResponses)) session.listenerResponses = [];
        if (!Array.isArray(session.playerResponses)) session.playerResponses = [];
        if (!Array.isArray(session.evidenceSubmissions)) session.evidenceSubmissions = [];
        if (!Array.isArray(session.followUps)) session.followUps = [];
        if (!Object.prototype.hasOwnProperty.call(session, 'sourceEventAnchor')) {
            session.sourceEventAnchor = null;
        }
        if (!Object.prototype.hasOwnProperty.call(session, 'eventDecision')) {
            session.eventDecision = null;
        }
        if (typeof storyDiscourseStateCreate === 'function'
            && (!session.discourseState || typeof session.discourseState !== 'object')) {
            session.discourseState = storyDiscourseStateCreate(session.id, session.analysis);
            for (const followUp of session.followUps) session.discourseState = storyDiscourseStateApply(
                session.discourseState, {
                    turnId: `conversation-turn:${session.id}:${followUp.sequence}`,
                    playerText: followUp.playerText, analysis: followUp.analysis,
                    response: followUp.response
                });
        }
        if (session.discourseState && !Array.isArray(session.discourseState.claimPositions)) {
            session.discourseState.claimPositions = [];
        }
        if (!session.concessions || typeof session.concessions !== 'object') {
            session.concessions = { useExistingCompany: false, withdrawnClaimIds: [] };
        }
        session.concessions.useExistingCompany = session.concessions.useExistingCompany === true;
        if (!Array.isArray(session.concessions.withdrawnClaimIds)) session.concessions.withdrawnClaimIds = [];
        if (!session.resolution || typeof session.resolution !== 'object') session.resolution = null;
        if (!session.domainReview || typeof session.domainReview !== 'object') session.domainReview = null;
        if (!session.conversationCase || typeof session.conversationCase !== 'object') {
            storyConversationCaseCreate(session, session.initialText, session.analysis);
        } else {
            const conversationCase = session.conversationCase;
            conversationCase.schemaVersion = STORY_CONVERSATION_CASE_SCHEMA_VERSION;
            conversationCase.id = `conversation-case:${session.id}`;
            conversationCase.sessionId = session.id;
            const linkedMeeting = ledger.meetingCases.find(row => row.id === conversationCase.meetingCaseId);
            conversationCase.kind = linkedMeeting ? 'MULTI_PARTY' : 'SINGLE_PARTY';
            if (!STORY_CONVERSATION_CASE_MODES.includes(conversationCase.mode)) {
                conversationCase.mode = storyConversationCaseInferMode(session.initialText, session.analysis);
            }
            conversationCase.mechanicalStatus = STORY_CONVERSATION_CASE_MODE_STATUS[conversationCase.mode];
            conversationCase.participantActorIds = linkedMeeting
                ? linkedMeeting.participantActorIds.slice()
                : Array.from(new Set([session.playerActorId, session.listenerActorId]
                    .filter(Boolean).map(String)));
            conversationCase.openedAt = Number(conversationCase.openedAt) || Number(session.createdAt) || 0;
            conversationCase.updatedAt = Number(conversationCase.updatedAt) || Number(session.updatedAt)
                || conversationCase.openedAt;
            if (!Array.isArray(conversationCase.modeHistory) || !conversationCase.modeHistory.length) {
                conversationCase.modeHistory = [{
                    sequence: 1, from: null, to: conversationCase.mode,
                    source: 'LEGACY_SESSION_MIGRATION', sourceTurnId: null,
                    changedAt: conversationCase.openedAt, worldMutation: false
                }];
            }
            for (const key of ['taskOfferIds', 'confidentialityRecordIds', 'declarationDraftIds']) {
                if (!Array.isArray(conversationCase[key])) conversationCase[key] = [];
            }
            if (!Object.prototype.hasOwnProperty.call(conversationCase, 'meetingCaseId')) {
                conversationCase.meetingCaseId = null;
            }
            conversationCase.worldMutation = false;
        }
        if (session.candidate && typeof session.candidate === 'object') {
            session.candidate.schemaVersion = 3;
            if (!Object.prototype.hasOwnProperty.call(session.candidate, 'domainReviewId')) {
                session.candidate.domainReviewId = session.domainReview && session.domainReview.id || null;
            }
        }
        // DialogueMove türetilmiş bir karar görünümüdür; eski adaptör karması
        // taşıyan kayıt bütün görüşmeyi silmez. Yalnız oturumun kendi görünür
        // analiz/claim/memory kaynaklarından yeniden kurulur.
        if (typeof storyConversationDomainBuild === 'function') {
            for (const response of session.listenerResponses) {
                if (!response) continue;
                response.domainEvidence = storyConversationSessionExpectedDomainEvidence(session, response);
            }
        }
        if (typeof storyDialogueMoveBuild === 'function') {
            for (const response of session.listenerResponses) {
                if (!response) continue;
                response.dialogueMove = storyConversationSessionExpectedDialogueMove(session, response);
            }
            for (const followUp of session.followUps) {
                if (!followUp || !followUp.response) continue;
                const canonical = session.listenerResponses.find(row => row.id === followUp.response.id);
                if (canonical) followUp.response = storyConversationClone(canonical);
            }
        }
    }
    return ledger;
}

function storyConversationSessionReset() {
    STORY_CONVERSATION_LLM_PENDING.clear();
    STORY.conversationUnderstanding = storyConversationEnabled()
        ? storyConversationSessionLedgerCreate() : null;
    return STORY.conversationUnderstanding;
}

function storyConversationSessionEnsure() {
    if (!storyConversationEnabled()) return null;
    if (!STORY.conversationUnderstanding) return storyConversationSessionReset();
    if (STORY.conversationUnderstanding.schemaVersion !== STORY_CONVERSATION_SESSION_SCHEMA_VERSION
        || STORY.conversationUnderstanding.adapterVersion !== STORY_CONVERSATION_SESSION_ADAPTER_VERSION) {
        const migrated = storyConversationSessionMigrateLedger(STORY.conversationUnderstanding);
        if (migrated) STORY.conversationUnderstanding = migrated;
    }
    // MODEL_LOADING/GENERATING kayda girebilir; uygulama kapanırsa Promise ve
    // kuyruk geri gelmez. Bellekte karşılığı olmayan bekleme durumunu güvenli
    // deterministik cevaba döndürerek görüşmenin kalıcı kilitlenmesini önle.
    for (const session of (STORY.conversationUnderstanding.sessions || [])) {
        for (const response of (session.listenerResponses || [])) {
            if (['MODEL_LOADING', 'GENERATING'].includes(response.enrichmentStatus)
                && !STORY_CONVERSATION_LLM_PENDING.has(response.id)) {
                response.enrichmentStatus = 'FALLBACK_KEPT';
                response.llmUsed = false;
                const followUp = (session.followUps || []).find(row =>
                    row.response && row.response.id === response.id);
                if (followUp) followUp.response = storyConversationClone(response);
            }
        }
    }
    const validation = storyConversationSessionValidateLedger(STORY.conversationUnderstanding);
    if (!validation.ok) {
        const repaired = storyConversationSessionMigrateLedger(STORY.conversationUnderstanding);
        const repairedValidation = repaired && storyConversationSessionValidateLedger(repaired);
        if (repairedValidation && repairedValidation.ok) {
            STORY.conversationUnderstanding = repaired;
            return STORY.conversationUnderstanding;
        }
        return storyConversationSessionReset();
    }
    return STORY.conversationUnderstanding;
}

function storyConversationSessionTermEntity(analysis, role) {
    return (analysis.entities || []).find(row => row.role === role) || null;
}

function storyConversationSessionOptionLabel(term, id) {
    if (term === 'commodity_identity') {
        const catalog = typeof storyResourceCatalogSnapshot === 'function'
            ? storyResourceCatalogSnapshot() : null;
        const resource = (catalog && catalog.resources || []).find(row => row.id === id);
        return resource ? resource.label : id;
    }
    if (term === 'destination_warehouse') {
        const warehouse = STORY.companyEconomy && STORY.companyEconomy.warehouses
            && STORY.companyEconomy.warehouses[id];
        const regionNumber = warehouse && Number(String(warehouse.regionId).split(':')[1]);
        const node = Number.isFinite(regionNumber) && STORY.nodes ? STORY.nodes[regionNumber] : null;
        return node ? `${node.name} deposu` : id;
    }
    return id;
}

function storyConversationSessionQuestions(analysis, sessionId) {
    const unresolved = new Set(analysis.unresolvedTerms || []);
    const questions = [];
    const add = (term, prompt, responseType, options) => {
        if (!unresolved.has(term)) return;
        questions.push({
            id: `${sessionId}:question:${term}`,
            term, prompt, responseType, status: 'OPEN', answer: null,
            options: (options || []).map(id => ({ id, label: storyConversationSessionOptionLabel(term, id) }))
        });
    };
    const commodity = storyConversationSessionTermEntity(analysis, 'COMMODITY');
    const shipment = storyConversationSessionTermEntity(analysis, 'TARGET_SHIPMENT');
    const warehouse = storyConversationSessionTermEntity(analysis, 'DESTINATION');
    add('commodity_identity', '“Çelik” hangi mevcut kanonik kaynak olarak ele alınsın?', 'CLOSED_ENTITY',
        commodity && commodity.candidates || []);
    add('shipment_identity', 'Belirli sevkiyat kimliğini seç veya iddiayı muhatabın doğrulamasına bırak.', 'CLOSED_ENTITY_OR_DEFER',
        (shipment && shipment.candidates || []).concat(['DEFER_TO_LISTENER_VERIFICATION']));
    add('destination_warehouse', 'Hangi gerçek depon hedef olsun?', 'CLOSED_ENTITY',
        warehouse && warehouse.candidates || []);
    add('quantity', 'Teklif edilen miktarı pozitif sayı ve birimle yaz.', 'QUANTITY', []);
    add('payment', 'Ödeme veya karşılığı pozitif sayı ve türüyle yaz.', 'PAYMENT', []);
    add('delivery_schedule', 'Teslim süresini gün ya da ay olarak yaz.', 'DURATION', []);
    add('contract_penalty', 'İhlal cezasını sayı ve yüzde/sermaye türüyle yaz.', 'PENALTY', []);
    return questions;
}

function storyConversationSessionDomainChecks(analysis) {
    const unresolved = new Set(analysis.unresolvedTerms || []);
    const checks = [];
    const add = (id, reason) => {
        if (unresolved.has(id)) checks.push({ id, status: 'PENDING_ENGINE_VERIFICATION', reason });
    };
    add('ownership', 'Sahiplik konuşmayla değil şirket ve sözleşme defteriyle doğrulanır.');
    add('required_approval', 'Muhatabın ve oyuncunun kurumsal yetkisi gerçek makam defterinden denetlenir.');
    add('warehouse_capacity', 'Depo kapasitesi teklif miktarı belli olduktan sonra fiziksel defterden denetlenir.');
    add('company_registration', 'Şirket kuruluşu ayrı yasal/ekonomik komut gerektirir.');
    return checks;
}

function storyConversationDomainReviewActor(actorId) {
    const id = String(actorId || '');
    const identity = typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(id) : null;
    const playerActorId = storyConversationPlayerActorId();
    const commander = id && id === playerActorId ? STORY.commander : null;
    if (!identity && !commander) return null;
    return Object.assign({}, identity || {}, commander ? {
        role: String(commander.creationRole || STORY.playerRole || identity && identity.role || 'COMMANDER').toUpperCase(),
        organizationId: commander.organizationId || identity && identity.organizationId || null,
        institutionId: commander.institutionId || identity && identity.institutionId || null,
        serviceId: commander.serviceId || identity && identity.serviceId || null,
        publicTitle: commander.publicTitle || identity && identity.publicTitle || null
    } : {}, { id });
}

// Muhatabın bilgi görünümü yalnız onun ActorBelief kayıtlarından kurulur. Eşleşen
// WorldFact payload'ı okunabilir; inanç bağı olmayan ham ticaret/sevkiyat defteri
// bu fonksiyonun erişim alanında değildir.
function storyConversationActorBeliefView(actorId, options) {
    const ledger = typeof storyCharacterIdentityEnsure === 'function'
        ? storyCharacterIdentityEnsure() : null;
    if (!ledger) return { actorId: String(actorId || ''), beliefs: [], rawWorldRead: false };
    const holderActorId = String(actorId || '');
    const beliefs = Object.values(ledger.actorBeliefs || {})
        .filter(row => row && row.holderActorId === holderActorId && ledger.worldFacts[row.worldFactId])
        .sort((a, b) => Number(b.learnedAt) - Number(a.learnedAt) || a.id.localeCompare(b.id, 'en'))
        .map(row => ({
            id: row.id,
            holderActorId,
            worldFactId: row.worldFactId,
            beliefStatus: row.beliefStatus,
            confidenceBps: Number(row.confidenceBps) || 0,
            source: storyConversationClone(row.source || null),
            learnedAt: Number(row.learnedAt) || 0,
            fact: storyConversationClone(ledger.worldFacts[row.worldFactId])
        }));
    const sessionLedger = STORY.conversationUnderstanding;
    if (options && options.trackRead === true && sessionLedger && sessionLedger.diagnostics) {
        sessionLedger.diagnostics.listenerBeliefReads += beliefs.length;
    }
    return { actorId: holderActorId, beliefs, rawWorldRead: false };
}

function storyConversationDomainReviewCheck(id, status, reasonCode, evidenceIds, publicText) {
    return {
        id: String(id), status: String(status), reasonCode: String(reasonCode),
        evidenceIds: (evidenceIds || []).map(String).slice(0, 12),
        publicText: String(publicText || '')
    };
}

function storyConversationDomainReviewEntity(candidate, role) {
    return (candidate && candidate.entities || []).find(row => row.role === role) || null;
}

function storyConversationBeliefSupportsClaim(belief, claim) {
    const fact = belief && belief.fact || {};
    if (!['EXISTING_IMPORT_ORDER', 'TRADE_SHIPMENT_KNOWN'].includes(String(fact.factType))) return false;
    if (claim.targetShipmentId && fact.targetShipmentId !== claim.targetShipmentId) return false;
    if (claim.supplierCountryId && fact.supplierCountryId !== claim.supplierCountryId) return false;
    if (claim.buyerActorId && fact.buyerActorId && fact.buyerActorId !== claim.buyerActorId) return false;
    return belief.beliefStatus !== 'CONTRADICTED' && Number(belief.confidenceBps) >= 5000;
}

function storyConversationDomainReviewClaim(candidate, beliefView) {
    const claims = candidate && candidate.claims || [];
    const results = [];
    for (const claim of claims) {
        if (claim.type !== 'EXISTING_IMPORT_ORDER') continue;
        const matches = (beliefView.beliefs || []).filter(row => storyConversationBeliefSupportsClaim(row, claim));
        const best = matches.sort((a, b) => Number(b.confidenceBps) - Number(a.confidenceBps))[0] || null;
        results.push({
            claimId: claim.id,
            status: best ? 'SUPPORTED_BY_LISTENER_BELIEF' : 'UNKNOWN_TO_LISTENER',
            confidenceBps: best ? Number(best.confidenceBps) : 0,
            beliefId: best && best.id || null,
            worldFactId: best && best.worldFactId || null
        });
    }
    return results;
}

function storyConversationDomainReviewResponse(decision, listener, checks) {
    const formal = Number(listener && listener.voiceProfile && listener.voiceProfile.formalityBps) >= 6000;
    const address = formal ? 'Teklifinizi' : 'Teklifini';
    const failing = checks.filter(row => row.status !== 'PASS');
    let speechAct = 'ASK_INFORMATION';
    let text = `${address} inceleyebilmem için doğrulanmış sevkiyat kaynağını veya sipariş kimliğini göstermelisin.`;
    if (decision === 'COUNTER_OFFER') {
        speechAct = 'COUNTER_OFFER';
        text = `Yeni çelik şirketi henüz kayıtlı değil. Mevcut şirketin üzerinden doğrulanabilir bir sözleşme taslağı sun veya önce şirket kuruluşunu tamamla.`;
    } else if (decision === 'REJECT') {
        speechAct = 'REJECT';
        text = `Bu talebi mevcut sahiplik ve yetki kayıtlarıyla kabul edemem. Yetkili taraf ve gerçek hedef doğrulanmadan ilerlemeyeceğim.`;
    } else if (decision === 'PROCEED_TO_NEGOTIATION') {
        speechAct = 'COUNTER_OFFER';
        text = `Koşullar görüşülebilir. Ancak kabul edilecek sürüm, kapasite ve icra makamı onayından geçmeden sevkiyat değişmeyecek.`;
    }
    return {
        id: `conversation-response:${storyConversationHash(`${decision}|${checks.map(row => `${row.id}:${row.status}`).join('|')}`).slice(9)}`,
        source: 'DETERMINISTIC_DOMAIN_REVIEW_RESPONSE', speechAct, decision,
        text, blockerCount: failing.length, worldMutation: false, createdAt: Number(STORY.clock) || 0
    };
}

function storyConversationDomainReviewBuild(session) {
    const candidate = session && session.candidate;
    // Yeniden inceleme, bir önceki incelemenin kimliğini kendi girdisine katmamalı.
    // Aksi halde domainReviewId -> candidateHash -> yeni domainReviewId biçiminde
    // salt-okunur her çağrıda değişen özyinelemeli bir kimlik zinciri oluşur.
    const reviewCandidate = storyConversationClone(candidate || {});
    reviewCandidate.domainReviewId = null;
    reviewCandidate.blockedReasons = [];
    const candidateHash = storyConversationHash(reviewCandidate);
    const speaker = storyConversationDomainReviewActor(session && session.playerActorId);
    const listener = storyConversationDomainReviewActor(session && session.listenerActorId);
    const beliefView = storyConversationActorBeliefView(session && session.listenerActorId, { trackRead: true });
    const claimResults = storyConversationDomainReviewClaim(candidate, beliefView);
    const companyEntity = storyConversationDomainReviewEntity(candidate, 'PLAYER_ORGANIZATION');
    const warehouseEntity = storyConversationDomainReviewEntity(candidate, 'DESTINATION');
    const commodityEntity = storyConversationDomainReviewEntity(candidate, 'COMMODITY');
    const companyLedger = STORY.companyEconomy;
    const company = companyEntity && companyLedger && companyLedger.companies
        ? companyLedger.companies[companyEntity.entityId] : null;
    const warehouse = warehouseEntity && companyLedger && companyLedger.warehouses
        ? companyLedger.warehouses[warehouseEntity.entityId] : null;
    const checks = [];

    const speakerOwnsCompany = !!(speaker && company && speaker.organizationId === company.id);
    checks.push(storyConversationDomainReviewCheck(
        'speaker_proposal_authority', speakerOwnsCompany ? 'PASS' : 'FAIL',
        speakerOwnsCompany ? 'PLAYER_COMPANY_BINDING_VERIFIED' : 'PLAYER_COMPANY_AUTHORITY_MISSING',
        company ? [company.id] : [],
        speakerOwnsCompany ? 'Şirket temsil yetkisi doğrulandı.' : 'Oyuncunun şirket temsil yetkisi doğrulanamadı.'
    ));
    const ownsWarehouse = !!(speakerOwnsCompany && warehouse && warehouse.ownerCompanyId === company.id);
    checks.push(storyConversationDomainReviewCheck(
        'ownership', ownsWarehouse ? 'PASS' : 'FAIL',
        ownsWarehouse ? 'DESTINATION_OWNERSHIP_VERIFIED' : 'DESTINATION_OWNERSHIP_FAILED',
        warehouse ? [warehouse.id] : [],
        ownsWarehouse ? 'Hedef deponun sahipliği doğrulandı.' : 'Hedef depo sahipliği doğrulanamadı.'
    ));

    const listenerCanNegotiate = !!(listener && ['EXECUTIVE', 'COMPANY_OWNER', 'COMPANY_EXECUTIVE', 'POLITICAL_FIGURE']
        .includes(String(listener.role || '').toUpperCase()));
    checks.push(storyConversationDomainReviewCheck(
        'listener_negotiation_authority', listenerCanNegotiate ? 'PASS' : 'FAIL',
        listenerCanNegotiate ? 'LISTENER_CAN_NEGOTIATE' : 'LISTENER_ROLE_CANNOT_NEGOTIATE',
        listener ? [listener.id] : [],
        listenerCanNegotiate ? 'Muhatap teklif hakkında görüşebilir.' : 'Muhatap bu teklif için yetkili görüşmeci değil.'
    ));

    const unknownClaim = claimResults.some(row => row.status === 'UNKNOWN_TO_LISTENER');
    checks.push(storyConversationDomainReviewCheck(
        'listener_claim_knowledge', unknownClaim ? 'UNKNOWN' : 'PASS',
        unknownClaim ? 'CLAIM_NOT_IN_LISTENER_BELIEFS' : 'CLAIM_SUPPORTED_BY_LISTENER_BELIEF',
        claimResults.map(row => row.beliefId).filter(Boolean),
        unknownClaim ? 'Muhatabın doğrulanmış bilgisinde sevkiyat iddiası yok.' : 'Muhatap sevkiyat iddiasını kaynaklı bir kayıtla biliyor.'
    ));

    const registrationRequired = !session.concessions.useExistingCompany
        && (session.analysis.playerIntent === 'FOUND_STEEL_COMPANY'
            || session.analysis.playerIntent === 'FOUND_COMPANY');
    checks.push(storyConversationDomainReviewCheck(
        'company_registration', registrationRequired ? 'FAIL' : 'PASS',
        registrationRequired ? 'NEW_COMPANY_REGISTRATION_REQUIRED' : 'EXISTING_COMPANY_CAN_PROPOSE',
        company ? [company.id] : [],
        registrationRequired ? 'Yeni şirket için ayrı kuruluş ve ruhsat işlemi gerekiyor.' : 'Mevcut şirket üzerinden teklif verilebilir.'
    ));

    const quantity = candidate && candidate.terms && candidate.terms.quantity;
    const unit = storyConversationFold(quantity && quantity.unit);
    const canonicalUnit = ['birim', 'adet', 'unit'].includes(unit);
    const capacity = warehouse && commodityEntity && warehouse.capacityByResource
        ? Number(warehouse.capacityByResource[commodityEntity.entityId]) : NaN;
    const capacityKnown = canonicalUnit && Number.isFinite(capacity) && quantity && Number.isFinite(Number(quantity.amount));
    const capacityPass = capacityKnown && capacity >= Number(quantity.amount);
    checks.push(storyConversationDomainReviewCheck(
        'warehouse_capacity', capacityKnown ? (capacityPass ? 'PASS' : 'FAIL') : 'PENDING',
        capacityKnown ? (capacityPass ? 'WAREHOUSE_CAPACITY_VERIFIED' : 'WAREHOUSE_CAPACITY_INSUFFICIENT')
            : 'UNIT_CONVERSION_REQUIRED',
        warehouse ? [warehouse.id] : [],
        capacityKnown ? (capacityPass ? 'Depo kapasitesi yeterli.' : 'Depo kapasitesi teklif miktarını karşılamıyor.')
            : 'Miktar birimi fiziksel stok birimine çevrilmeden kapasite doğrulanamaz.'
    ));
    checks.push(storyConversationDomainReviewCheck(
        'execution_authority', 'PENDING', 'EXECUTION_AUTHORITY_REQUIRES_MECHANICAL_CONTRACT', [],
        'Sevkiyat uygulaması kabul edilmiş mekanik sözleşme ve icra makamı gerektirir.'
    ));

    let decision = 'PROCEED_TO_NEGOTIATION';
    if (!speakerOwnsCompany || !ownsWarehouse || !listenerCanNegotiate) decision = 'REJECT';
    else if (unknownClaim) decision = 'ASK_EVIDENCE';
    else if (registrationRequired) decision = 'COUNTER_OFFER';
    const sessionStatus = decision === 'ASK_EVIDENCE' ? 'DOMAIN_REVIEW_NEEDS_EVIDENCE'
        : decision === 'COUNTER_OFFER' ? 'DOMAIN_REVIEW_COUNTER_OFFER'
            : decision === 'REJECT' ? 'DOMAIN_REVIEW_REJECTED' : 'READY_FOR_NEGOTIATION';
    const response = storyConversationDomainReviewResponse(decision, listener, checks);
    if (typeof storyCharacterDialogueRealize === 'function') {
        const realization = storyCharacterDialogueRealize({
            turnId: response.id,
            actorId: session.listenerActorId,
            targetActorId: session.playerActorId,
            speechAct: response.speechAct
        }, {
            history: (session.listenerResponses || []).map(row => row.realization).filter(Boolean)
        });
        if (realization && (typeof storyCharacterDialogueValidate !== 'function'
            || storyCharacterDialogueValidate(realization).ok)) {
            response.mechanicalText = response.text;
            response.text = realization.text;
            response.realization = realization;
        }
    }
    const reviewSeed = {
        sessionId: session.id, candidateHash,
        listenerActorId: session.listenerActorId, decision,
        checks: checks.map(row => [row.id, row.status, row.reasonCode])
    };
    return {
        schemaVersion: STORY_CONVERSATION_DOMAIN_REVIEW_SCHEMA_VERSION,
        adapterVersion: STORY_CONVERSATION_DOMAIN_REVIEW_ADAPTER_VERSION,
        id: `conversation-domain-review:${storyConversationHash(reviewSeed).slice(9)}`,
        sourceSessionId: session.id, candidateHash,
        reviewedAt: Number(STORY.clock) || 0,
        speakerActorId: session.playerActorId, listenerActorId: session.listenerActorId,
        listenerKnowledge: {
            actorBeliefCount: beliefView.beliefs.length,
            claimResults,
            rawWorldRead: false
        },
        checks, decision, sessionStatus, response,
        executable: false, worldMutation: false,
        diagnostics: { rawTradeLedgerRead: false, rawWorldRead: false, llmUsed: false }
    };
}

function storyConversationSessionApplyDomainReview(session) {
    if (!session || (session.questions || []).some(row => row.status === 'OPEN')) return null;
    const ledger = storyConversationSessionEnsure();
    const review = storyConversationDomainReviewBuild(session);
    session.domainReview = review;
    if (!Array.isArray(session.listenerResponses)) session.listenerResponses = [];
    if (!session.listenerResponses.some(row => row.id === review.response.id)) {
        session.listenerResponses.push(storyConversationClone(review.response));
        storyConversationDiagnosticAppend(session, review.response, session.initialText,
            'TURN_CREATED', (session.followUps || []).length);
        if (session.listenerResponses.length > STORY_CONVERSATION_TURN_LIMIT) session.listenerResponses.shift();
    }
    session.status = review.sessionStatus;
    session.updatedAt = Number(STORY.clock) || 0;
    session.candidate = storyConversationSessionCandidate(session);
    if (ledger && ledger.diagnostics) ledger.diagnostics.domainReviews++;
    return review;
}

function storyConversationSessionReview(sessionId) {
    const session = storyConversationSessionFind(sessionId);
    if (!session) return { ok: false, code: 'SESSION_NOT_FOUND', worldMutation: false };
    if ((session.questions || []).some(row => row.status === 'OPEN')) {
        return { ok: false, code: 'OPEN_CLARIFICATIONS', worldMutation: false };
    }
    const review = storyConversationSessionApplyDomainReview(session);
    return {
        ok: !!review, code: review ? 'DOMAIN_REVIEW_COMPLETED' : 'DOMAIN_REVIEW_FAILED',
        review: storyConversationClone(review), session: storyConversationClone(session), worldMutation: false
    };
}

function storyConversationSessionEvidenceOptions(session) {
    if (!session || !session.domainReview || session.status !== 'DOMAIN_REVIEW_NEEDS_EVIDENCE') return [];
    const playerView = storyConversationActorBeliefView(session.playerActorId);
    const withdrawn = new Set(session.concessions && session.concessions.withdrawnClaimIds || []);
    const unknownIds = new Set((session.domainReview.listenerKnowledge.claimResults || [])
        .filter(row => row.status === 'UNKNOWN_TO_LISTENER').map(row => row.claimId));
    const claims = (session.candidate && session.candidate.claims || [])
        .filter(claim => unknownIds.has(claim.id) && !withdrawn.has(claim.id));
    const options = [];
    for (const belief of playerView.beliefs || []) {
        const claim = claims.find(row => storyConversationBeliefSupportsClaim(belief, row));
        if (!claim) continue;
        options.push({
            id: `present-evidence:${belief.id}`,
            action: 'PRESENT_EVIDENCE',
            label: `Kaynaklı sevkiyat kaydını göster`,
            detail: `${belief.fact && belief.fact.targetShipmentId || belief.worldFactId} · güven %${Math.round(belief.confidenceBps / 100)}`,
            payload: { beliefId: belief.id, claimId: claim.id }
        });
    }
    return options.sort((a, b) => a.id.localeCompare(b.id, 'en')).slice(0, 6);
}

function storyConversationSessionResponseOptions(sessionOrId) {
    const session = typeof sessionOrId === 'string'
        ? storyConversationSessionFind(sessionOrId) : sessionOrId;
    if (!session || session.resolution) return [];
    if (session.status === 'DOMAIN_REVIEW_NEEDS_EVIDENCE') {
        const evidence = storyConversationSessionEvidenceOptions(session);
        const unknown = session.domainReview && session.domainReview.listenerKnowledge
            && (session.domainReview.listenerKnowledge.claimResults || []).find(row => row.status === 'UNKNOWN_TO_LISTENER');
        if (unknown) evidence.push({
            id: `withdraw-claim:${unknown.claimId}`,
            action: 'WITHDRAW_UNPROVEN_CLAIM',
            label: 'Kanıtlanamayan iddiayı geri çek',
            detail: 'Teklif kalan doğrulanmış şartlarla yeniden incelenir.',
            payload: { claimId: unknown.claimId }
        });
        evidence.push({
            id: 'decline:evidence-request', action: 'DECLINE_NEGOTIATION',
            label: 'Görüşmeyi bitir', detail: 'Taslak uygulanmadan kapanır.', payload: {}
        });
        return evidence;
    }
    if (session.status === 'DOMAIN_REVIEW_COUNTER_OFFER') return [
        {
            id: 'counter:use-existing-company', action: 'USE_EXISTING_COMPANY',
            label: 'Mevcut şirketim üzerinden ilerle',
            detail: 'Yeni şirket iddiası geri çekilir; gerçek sahipli şirket teklif sahibi olur.', payload: {}
        },
        {
            id: 'counter:defer-registration', action: 'DEFER_FOR_REGISTRATION',
            label: 'Önce şirket kuruluşunu tamamla',
            detail: 'Görüşme beklemeye alınır; şirket kendiliğinden kurulmaz.', payload: {}
        },
        {
            id: 'decline:counter-offer', action: 'DECLINE_NEGOTIATION',
            label: 'Karşı teklifi reddet', detail: 'Taslak uygulanmadan kapanır.', payload: {}
        }
    ];
    return [];
}

function storyConversationSessionTransferEvidence(session, option) {
    const identityLedger = typeof storyCharacterIdentityEnsure === 'function'
        ? storyCharacterIdentityEnsure() : null;
    const playerBelief = identityLedger && identityLedger.actorBeliefs
        && identityLedger.actorBeliefs[option.payload.beliefId];
    const fact = playerBelief && identityLedger.worldFacts[playerBelief.worldFactId];
    if (!identityLedger || !playerBelief || !fact
        || !identityLedger.identities[session.listenerActorId]
        || playerBelief.holderActorId !== session.playerActorId
        || Number(playerBelief.confidenceBps) < 5000) {
        return { ok: false, code: 'EVIDENCE_NOT_OWNED_OR_TRUSTED' };
    }
    const safeSession = session.id.replace(/[^a-zA-Z0-9_-]/g, '-');
    const safeListener = String(session.listenerActorId).replace(/[^a-zA-Z0-9_-]/g, '-');
    const evidenceKey = storyConversationHash(`${playerBelief.id}|${option.payload.claimId}`).slice(9);
    const id = `actor-belief:conversation-evidence:${safeSession}:${safeListener}:${evidenceKey}`;
    const originEventId = `conversation-evidence:${safeSession}:${safeListener}:${evidenceKey}`;
    if (!identityLedger.actorBeliefs[id]) {
        identityLedger.actorBeliefs[id] = {
            id,
            holderActorId: session.listenerActorId,
            holderCountryId: identityLedger.identities[session.listenerActorId].countryId,
            worldFactId: playerBelief.worldFactId,
            subjectActorId: fact.subjectActorId,
            beliefStatus: 'REPORTED',
            confidenceBps: Math.max(5000, Math.min(8500, Math.floor(Number(playerBelief.confidenceBps) * 0.85))),
            source: {
                type: 'PLAYER_PRESENTED_EVIDENCE', actorId: session.playerActorId,
                sourceBeliefId: playerBelief.id, conversationSessionId: session.id
            },
            learnedAt: Number(STORY.clock) || 0,
            originEventId,
            version: 1
        };
    }
    return { ok: true, beliefId: id, worldFactId: playerBelief.worldFactId, originEventId };
}

function storyConversationSessionRespond(sessionId, optionId) {
    const ledger = storyConversationSessionEnsure();
    const session = storyConversationSessionFind(sessionId);
    if (!ledger || !session) return { ok: false, code: 'SESSION_NOT_FOUND', worldMutation: false };
    if ((session.playerResponses || []).length >= STORY_CONVERSATION_TURN_LIMIT) {
        return { ok: false, code: 'TURN_LIMIT', worldMutation: false };
    }
    const option = storyConversationSessionResponseOptions(session).find(row => row.id === String(optionId));
    if (!option) {
        ledger.diagnostics.rejectedReplies++;
        return { ok: false, code: 'RESPONSE_NOT_OFFERED', worldMutation: false };
    }
    let knowledgeMutation = false;
    let evidence = null;
    if (option.action === 'PRESENT_EVIDENCE') {
        evidence = storyConversationSessionTransferEvidence(session, option);
        if (!evidence.ok) return { ok: false, code: evidence.code, worldMutation: false };
        knowledgeMutation = true;
        session.evidenceSubmissions.push({
            id: `conversation-evidence-submission:${session.id}:${session.evidenceSubmissions.length + 1}`,
            at: Number(STORY.clock) || 0, claimId: option.payload.claimId,
            sourceBeliefId: option.payload.beliefId, listenerBeliefId: evidence.beliefId,
            worldFactId: evidence.worldFactId, originEventId: evidence.originEventId
        });
        ledger.diagnostics.knowledgeTransfers++;
    } else if (option.action === 'WITHDRAW_UNPROVEN_CLAIM') {
        if (!session.concessions.withdrawnClaimIds.includes(option.payload.claimId)) {
            session.concessions.withdrawnClaimIds.push(option.payload.claimId);
        }
    } else if (option.action === 'USE_EXISTING_COMPANY') {
        session.concessions.useExistingCompany = true;
    } else if (option.action === 'DEFER_FOR_REGISTRATION' || option.action === 'DECLINE_NEGOTIATION') {
        session.resolution = {
            status: option.action === 'DEFER_FOR_REGISTRATION' ? 'NEGOTIATION_DEFERRED' : 'NEGOTIATION_DECLINED',
            action: option.action, at: Number(STORY.clock) || 0
        };
    }
    session.playerResponses.push({
        id: `conversation-player-response:${session.id}:${session.playerResponses.length + 1}`,
        at: Number(STORY.clock) || 0, optionId: option.id, action: option.action,
        payload: storyConversationClone(option.payload), knowledgeMutation, worldMutation: false
    });
    ledger.diagnostics.playerResponses++;
    session.updatedAt = Number(STORY.clock) || 0;
    if (session.resolution) {
        session.status = session.resolution.status;
        session.candidate = storyConversationSessionCandidate(session);
    } else {
        session.candidate = storyConversationSessionCandidate(session);
        storyConversationSessionApplyDomainReview(session);
    }
    return {
        ok: true, code: option.action, knowledgeMutation, worldMutation: false,
        evidence: storyConversationClone(evidence), session: storyConversationClone(session),
        options: storyConversationClone(storyConversationSessionResponseOptions(session))
    };
}

function storyConversationSessionStatus(session) {
    if (!session.analysis.ok) return 'REJECTED';
    if (session.resolution && STORY_CONVERSATION_RESOLUTION_STATUSES.includes(session.resolution.status)) {
        return session.resolution.status;
    }
    if ((session.questions || []).some(row => row.status === 'OPEN')) return 'NEEDS_CLARIFICATION';
    if (session.domainReview && STORY_CONVERSATION_REVIEW_STATUSES.includes(session.domainReview.sessionStatus)) {
        return session.domainReview.sessionStatus;
    }
    if ((session.domainChecks || []).length) return 'READY_FOR_DOMAIN_REVIEW';
    if ((session.listenerResponses || []).some(row => row.kind === 'SOCIAL_RESPONSE')
        && (STORY_CONVERSATION_SOCIAL_ACTS.includes(session.analysis.speechAct)
            || (session.listenerResponses || []).some(row =>
                row.source === 'DETERMINISTIC_GROUNDED_DISCOURSE_RESPONSE'))) {
        return 'SOCIAL_RESPONSE_READY';
    }
    return 'READY_FOR_REVIEW';
}

function storyConversationSessionCandidate(session) {
    const confirmed = Object.values(session.resolvedEntities || {});
    const confirmedRoles = new Set(confirmed.map(row => row.role));
    const resolvedEntities = (session.analysis.entities || [])
        .filter(row => row.entityId && !confirmedRoles.has(row.role))
        .map(row => ({
            role: row.role, entityType: row.entityType, entityId: row.entityId,
            status: row.status, evidence: storyConversationClone(row.evidence || [])
        })).concat(confirmed);
    const requests = storyConversationClone(session.analysis.requests);
    const destination = resolvedEntities.find(row => row.role === 'DESTINATION');
    for (const request of requests) {
        if (request.type === 'REDIRECT_SHIPMENT' && destination) request.destinationId = destination.entityId;
    }
    return {
        schemaVersion: 3,
        kind: STORY_CONVERSATION_SOCIAL_ACTS.includes(session.analysis.speechAct)
            ? 'SOCIAL_CONVERSATION_RECORD'
            : session.analysis.speechAct === 'PROPOSE_COMMERCIAL_DEAL'
                ? 'COMMERCIAL_NEGOTIATION_DRAFT' : 'CONVERSATION_ACT_DRAFT',
        sourceSessionId: session.id,
        speakerActorId: session.playerActorId,
        listenerActorId: session.listenerActorId,
        speechAct: session.analysis.speechAct,
        playerIntent: session.analysis.playerIntent,
        entities: storyConversationClone(resolvedEntities),
        terms: storyConversationClone(session.resolvedTerms),
        claims: storyConversationClone((session.analysis.claims || []).filter(row =>
            !(session.concessions && session.concessions.withdrawnClaimIds || []).includes(row.id))),
        requests,
        concessions: storyConversationClone(session.concessions),
        evidenceSubmissionIds: (session.evidenceSubmissions || []).map(row => row.id),
        followUpIds: (session.followUps || []).map(row => row.id),
        domainReviewId: session.domainReview && session.domainReview.id || null,
        executable: false,
        worldMutation: false,
        blockedReasons: (session.domainReview ? session.domainReview.checks.filter(row => row.status !== 'PASS').map(row => row.id)
            : (session.domainChecks || []).map(row => row.id))
            .concat(session.status === 'NEEDS_CLARIFICATION' ? ['OPEN_CLARIFICATIONS'] : [])
            .concat(session.resolution ? [session.resolution.status] : [])
    };
}

function storyConversationSocialVoice(session) {
    const actor = typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(session.listenerActorId) : null;
    const voice = actor && actor.voiceProfile || {};
    const relation = typeof storyRelationshipView === 'function'
        ? storyRelationshipView(session.listenerActorId, session.playerActorId) : null;
    const trust = Number(relation && relation.trustBps) || 0;
    const respect = Number(relation && relation.respectBps) || 0;
    const hostility = Number(relation && relation.hostilityBps) || 0;
    let register = 'GUARDED';
    if (hostility < 4200 && trust >= 4800 && Number(voice.warmthBps) >= 5000) register = 'WARM';
    else if (Number(voice.formalityBps) >= 6200 || respect >= 6200) register = 'FORMAL';
    else if (Number(voice.directnessBps) >= 5800) register = 'DIRECT';
    return {
        register,
        fingerprint: `${register}:${Math.round((Number(voice.directnessBps) || 0) / 1000)}:`
            + `${Math.round((Number(voice.warmthBps) || 0) / 1000)}:${Math.round((Number(voice.formalityBps) || 0) / 1000)}`,
        relationshipBand: hostility >= 6000 ? 'HOSTILE'
            : trust >= 6000 ? 'TRUSTED' : respect >= 6000 ? 'RESPECTFUL' : 'RESERVED'
    };
}

const STORY_CONVERSATION_SOCIAL_LINES = Object.freeze({
    GREETING: Object.freeze({
        WARM: ['Merhaba. Seni görmek güzel; günün nasıl gidiyor?', 'Selam. Burada olmana sevindim; bugün yüzün nasıl gülüyor?',
            'Yeniden merhaba. Bugün aklını en çok ne meşgul ediyor?', 'Hoş geldin. Biraz soluklanıp konuşmak iyi gelebilir.'],
        DIRECT: ['Merhaba. Konuya geçebiliriz.', 'Selam. Bu kez söze sen başla.',
            'Yeniden selam. Bugün acele etmeden konuşabiliriz.', 'Buradayım; seni duyuyorum.'],
        FORMAL: ['Merhaba. Görüşmek için uygun bir zaman.', 'İyi günler. Bugünün nasıl geçtiğini merak ediyorum.',
            'Tekrar merhaba. Önce sizi dinleyeyim.', 'Hoş geldiniz. Görüşmemizi sürdürebiliriz.'],
        GUARDED: ['Merhaba. Ne hakkında konuşmak istediğini söyle.', 'Selam. Önce konuyu netleştirelim.',
            'Yeniden merhaba. Bu görüşmenin konusunu söyle.', 'Buradayım. Ne konuşacağımızı açıkça belirt.']
    }),
    CHECK_IN: Object.freeze({
        WARM: ['İyiyim, teşekkür ederim. Senin günün nasıl gidiyor?', 'Fena değilim. Asıl sen nasılsın, günün nasıl geçti?',
            'Bugün kendimi iyi hissediyorum. Senin keyfin nasıl?', 'İşler yoğun ama iyiyim. Senin tarafında hayat nasıl gidiyor?'],
        DIRECT: ['İyiyim. Sen nasılsın?', 'İşler sürüyor. Senin tarafında durum nasıl?',
            'Fena değilim. Senin günün nasıl?', 'Ayaktayım ve işimin başındayım. Sen nasılsın?'],
        FORMAL: ['Teşekkür ederim, iyiyim. Sizin gününüz nasıl geçiyor?', 'İyiyim, sağ olun. Siz nasılsınız?',
            'Bugün durumum iyi. Sizin tarafınızda işler nasıl?', 'Teşekkür ederim, her şey yolunda. Siz kendinizi nasıl hissediyorsunuz?'],
        GUARDED: ['İdare ediyorum. Senin günün nasıl?', 'Şimdilik iyiyim. Neden sorduğunu da merak ettim.',
            'Fena sayılmam. Senin durumun nasıl?', 'Günüm sakin geçiyor. Senin tarafta bir sorun mu var?']
    }),
    THANK: Object.freeze({
        WARM: ['Rica ederim. Yardımcı olabildiysem ne mutlu.', 'Ne demek. İşine yaradıysa sevindim.'],
        DIRECT: ['Rica ederim.', 'Sorun değil.'],
        FORMAL: ['Rica ederim; görevimi yaptım.', 'Teşekkürünüze karşılık rica ederim.'],
        GUARDED: ['Rica ederim. Konuyu burada kapatabiliriz.', 'Anladım. Teşekkürünü kabul ediyorum.']
    }),
    APOLOGIZE: Object.freeze({
        WARM: ['Özrünü kabul ediyorum. Bunu geride bırakabiliriz.', 'Bunu söylemen önemliydi; devam edebiliriz.'],
        DIRECT: ['Özrünü duydum. Aynı hatayı tekrarlamayalım.', 'Kabul ediyorum. Şimdi çözümüne bakalım.'],
        FORMAL: ['Özrünüzü kayda değer buluyorum. Konuyu dikkatle sürdürelim.', 'Özrünüzü kabul ediyorum; bundan sonrasını usulünce ilerletelim.'],
        GUARDED: ['Özrünü duydum. Güvenin yeniden kurulması zaman alacak.', 'Sözünü not ettim; davranışın belirleyici olacak.']
    }),
    FAREWELL: Object.freeze({
        WARM: ['Görüşmek üzere. Kendine iyi bak.', 'Sonra görüşürüz; iyi kal.'],
        DIRECT: ['Görüşürüz.', 'Peki. Sonra devam ederiz.'],
        FORMAL: ['Görüşmek üzere. İyi günler dilerim.', 'Görüşmemizi burada tamamlayalım. Esen kalın.'],
        GUARDED: ['Görüşmek üzere.', 'Şimdilik hoşça kal.']
    }),
    ASK_PERSONAL_OPINION: Object.freeze({
        WARM: ['Fikrimi açıkça söylerim; hangi yönünü merak ediyorsun?', 'Elbette. Önce neyi değerlendirmemi istediğini anlat.'],
        DIRECT: ['Soruyu netleştir; görüşümü doğrudan söyleyeyim.', 'Hangi konuda fikrimi istiyorsun?'],
        FORMAL: ['Görüş bildirebilirim; değerlendirme konusunu netleştirin.', 'Elbette. Hangi başlıkta kanaatimi istediğinizi belirtin.'],
        GUARDED: ['Fikrimi söylemeden önce bağlamı bilmem gerekir.', 'Önce konuyu aç; sonra ne düşündüğümü söylerim.']
    }),
    SMALL_TALK: Object.freeze({
        WARM: ['Olur, biraz konuşalım. Aklında ne var?', 'Memnuniyetle. Bugün ne konuşmak istersin?'],
        DIRECT: ['Olur. Konuyu sen seç.', 'Peki, konuşalım.'],
        FORMAL: ['Elbette, kısa bir sohbet edebiliriz.', 'Uygundur. Sohbet konusunu siz seçin.'],
        GUARDED: ['Biraz konuşabiliriz. Önce konuyu söyle.', 'Olur; ancak açık konuşalım.']
    }),
    REQUEST_SUPPORT: Object.freeze({
        WARM: ['Yardım etmeyi isterim. Neye ihtiyacın olduğunu anlat.', 'Yanında olup olamayacağımı anlamam için ihtiyacını açıkla.'],
        DIRECT: ['Ne istediğini ve nedenini açıkça söyle.', 'Desteğin türünü belirt; sonra cevap vereyim.'],
        FORMAL: ['Talebinizi değerlendirebilmem için kapsamı ve gerekçeyi açıklayın.', 'Destek isteğinizi somutlaştırın; yetki sınırım içinde değerlendireyim.'],
        GUARDED: ['Önce ne istediğini ve karşılığında ne beklediğini bilmeliyim.', 'Desteği peşinen veremem. İhtiyacı ayrıntılandır.']
    })
});

function storyConversationSocialResponseText(session, speechAct, salt, raw) {
    const style = storyConversationSocialVoice(session);
    const byAct = STORY_CONVERSATION_SOCIAL_LINES[speechAct];
    const folded = storyConversationFold(raw);
    const actor = typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(session.listenerActorId) : null;
    let sourceCandidates = byAct && (byAct[style.register] || byAct.GUARDED) || [];
    if (speechAct === 'ASK_PERSONAL_OPINION' && storyConversationContains(folded, ['teknoloji'])) {
        sourceCandidates = [
            'Teknolojiye yalnız yenilik diye bakmam; kimin yararlandığını, bedelini ve denetimini de tartarım.',
            'Benim için teknoloji, gösterişten önce gerçek bir sorunu çözmeli; aksi hâlde pahalı bir vitrindir.'
        ];
    }
    if (speechAct === 'SMALL_TALK' && storyConversationContains(folded, [
        'heyecan', 'endise', 'kaygi', 'kork', 'gergin', 'riskli'
    ])) {
        const excited = storyConversationContains(folded, ['heyecan']);
        const uneasy = storyConversationContains(folded, ['endise', 'kaygi', 'kork', 'gergin', 'riskli']);
        sourceCandidates = excited && uneasy
            ? ['Sözlerinde hem kaygı hem heyecan var. Anlattığın olayın doğruluğunu varsaymadan, sende bıraktığı etkiyi konuşabiliriz.']
            : excited
                ? ['Heyecanını duyuyorum. Sözünü ettiğin olayı doğrulanmış saymadan bu duygunun sende neye dönüştüğünü konuşabiliriz.']
                : ['Bunun seni kaygılandırdığı açık. Olayı doğrulanmış saymadan sende yarattığı baskıyı konuşabiliriz.'];
    }
    if (speechAct === 'SMALL_TALK' && storyConversationContains(folded, [
        'bir seyler de', 'birseyler de', 'soyleyecegin bir sey yok mu',
        'soyleyeceginiz bir sey yok mu', 'kendi kendime konusuyorum'
    ])) {
        const roleLine = actor && actor.role === 'COMMANDER'
            ? 'Şunu söyleyeyim: bir ordunun gücü yalnız silahında değil, insanların neden savaştığını bilmesindedir.'
            : actor && actor.role === 'COMPANY_EXECUTIVE'
                ? 'Şunu söyleyeyim: bir şirket büyürken yalnız kazancı değil, hangi bağımlılıkları büyüttüğünü de izlemelidir.'
                : 'Şunu söyleyeyim: yönetimde en tehlikeli rahatlık, sessizliği herkesin razı olduğu sanmaktır.';
        sourceCandidates = [roleLine];
    }
    const firstContact = Number(session && session.contactOrdinal) === 1;
    const candidates = firstContact && speechAct === 'GREETING'
        ? sourceCandidates.filter(row => !/\b(yeniden|tekrar|sürdür|bu kez)\b/i.test(row))
        : sourceCandidates;
    if (!candidates.length) return null;
    const previous = new Set((session.listenerResponses || []).map(row => storyConversationFold(row.text)));
    const start = parseInt(storyConversationHash(`${session.listenerActorId}|${speechAct}|${salt || 0}`).slice(9, 17), 16)
        % candidates.length;
    let selected = candidates[start];
    for (let offset = 0; offset < candidates.length; offset++) {
        const candidate = candidates[(start + offset) % candidates.length];
        if (!previous.has(storyConversationFold(candidate))) { selected = candidate; break; }
    }
    return { text: selected, voice: style };
}

function storyConversationSocialLLMSchema(dialogueMove) {
    const schema = {
        type: 'object', additionalProperties: false,
        properties: { reply: { type: 'string', minLength: 2, maxLength: 480 } },
        required: ['reply']
    };
    if (dialogueMove && dialogueMove.moveId) {
        const moveView = typeof storyDialogueMovePromptView === 'function'
            ? storyDialogueMovePromptView(dialogueMove) : null;
        const allowedRefs = moveView && Array.isArray(moveView.allowedRefs)
            ? moveView.allowedRefs : [];
        schema.properties.moveId = { type: 'string', const: dialogueMove.moveId };
        schema.properties.usedRefs = allowedRefs.length
            ? { type: 'array', items: { type: 'string', enum: allowedRefs },
                uniqueItems: true, maxItems: Math.min(12, allowedRefs.length) }
            : { type: 'array', items: { type: 'string' }, maxItems: 0 };
        schema.properties.answeredQuestionIds = { type: 'array', items: { type: 'string' }, maxItems: 8 };
        schema.properties.introducedQuestion = { type: ['string', 'null'], maxLength: 180 };
        schema.properties.closing = { type: 'boolean' };
        schema.required = ['moveId', 'reply', 'usedRefs', 'answeredQuestionIds', 'introducedQuestion', 'closing'];
    }
    return schema;
}

function storyConversationSocialLLMParse(raw, fallbackText, playerText, validationContext) {
    let parsed;
    try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (_) { return null; }
    const text = String(parsed && parsed.reply || '').trim().replace(/\s+/g, ' ');
    if (!text || text.length > 480 || text === fallbackText) return null;
    const fallbackFolded = storyConversationFold(fallbackText);
    if (fallbackFolded.length >= 20 && storyConversationFold(text).includes(fallbackFolded)) return null;
    if (storyConversationSocialLLMTextIssue(text, validationContext, playerText)) return null;
    if (/\b(character|session|actor|worldMutation|system|assistant|user)\b/i.test(text)) return null;
    if (typeof LLM_EN_LEAK !== 'undefined' && LLM_EN_LEAK.test(text)) return null;
    if (typeof LLM_NONLATIN !== 'undefined' && LLM_NONLATIN.test(text)) return null;
    if (/\b(kabul ettim|onayladım|emri verdim|söz veriyorum|anlaşma tamam|sevkiyatı başlattım)\b/i.test(text)) return null;
    const playerFolded = storyConversationFold(playerText);
    const replyFolded = storyConversationFold(text);
    if (playerFolded && replyFolded === playerFolded) return null;
    const obligationFailures = storyConversationSocialLLMQualityTags(text, playerText);
    if (obligationFailures.includes('EVASIVE_DIRECT_QUESTION')
        || obligationFailures.includes('FAILED_REASON_CONTINUATION')
        || obligationFailures.includes('FAILED_DIRECTNESS_REQUEST')
        || obligationFailures.includes('FAILED_CONFIRMATION_QUESTION')
        || obligationFailures.includes('FAILED_CONFIDENTIALITY_REQUEST')
        || obligationFailures.includes('FAILED_SOCIAL_CHECK_IN')
        || obligationFailures.includes('FAILED_CORRECTION_RESPONSE')
        || obligationFailures.includes('REPORT_RECAST_AS_THREAT')
        || obligationFailures.includes('TAUTOLOGICAL_REPLY')) return null;
    const history = validationContext && Array.isArray(validationContext.history)
        ? validationContext.history : [];
    const dialogueMove = validationContext && validationContext.dialogueMove;
    if (dialogueMove) {
        const moveView = typeof storyDialogueMovePromptView === 'function'
            ? storyDialogueMovePromptView(dialogueMove) : null;
        if (!moveView || parsed.moveId !== moveView.moveId || !Array.isArray(parsed.usedRefs)
            || !Array.isArray(parsed.answeredQuestionIds)
            || !Object.prototype.hasOwnProperty.call(parsed, 'introducedQuestion')
            || typeof parsed.closing !== 'boolean') return null;
        const allowedRefs = new Set(moveView.allowedRefs);
        if (parsed.usedRefs.some(ref => typeof ref !== 'string' || !allowedRefs.has(ref))) return null;
        const requiredFactRefs = new Set(dialogueMove.factRefs || []);
        if (dialogueMove.act === 'ASK_INFORMATION' && requiredFactRefs.size
            && !parsed.usedRefs.some(ref => requiredFactRefs.has(ref))) return null;
        if (parsed.answeredQuestionIds.some(ref => typeof ref !== 'string')) return null;
    }
    if (storyConversationSocialLLMNumberIssue(text, parsed, validationContext)) return null;
    if (storyConversationSocialLLMMemoryIssue(text, parsed, validationContext)) return null;
    if (history.some(row => storyConversationFold(row && row.text) === replyFolded)) return null;
    if (typeof storyCharacterDialogueSemanticSimilarityBps === 'function'
        && history.some(row => storyCharacterDialogueSemanticSimilarityBps(text, row && row.text) >= 8800)) return null;
    const unverifiedRegionNames = validationContext && validationContext.unverifiedRegionNames || [];
    if (unverifiedRegionNames.some(name => storyConversationContains(replyFolded, [name]))
        && !storyConversationContains(replyFolded, [
            'soyledin', 'soyluyorsun', 'bildirdin', 'bildiriyorsun', 'iddia', 'dogrulanmadi', 'dogrulayamiyorum'
        ])) return null;
    if (validationContext && validationContext.locationAnswerMustBeUnknown
        && (STORY.nodes || []).some(region => storyConversationContains(replyFolded, [region.name]))) return null;
    const negativePlayerState = storyConversationContains(playerFolded, [
        'yoruldum', 'yorgunum', 'kotuyum', 'uzgunum', 'moralim bozuk', 'zorlanıyorum', 'zorlanıyorum'
    ]);
    if (negativePlayerState && storyConversationContains(replyFolded, [
        'sevindim', 'ne guzel', 'harika', 'mukemmel'
    ])) return null;
    // Turkish-Llama'nın gerçek GPU koşusunda ürettiği "Sizi yorulduğuna" gibi
    // kişi/iyelik uyuşmazlıkları biçimsel olarak JSON'dur ama oynanabilir Türkçe değildir.
    if (/\b(sizi|seni)\s+\S{2,}(dığına|diğine|duğuna|düğüne)\b/i.test(text)) return null;
    if (/\b(sizi|seni)\s+nasıl\s+hissediyorsun(?:uz)?\b/i.test(text)) return null;
    const sentences = text.split(/[.!?]+/).map(row => row.trim()).filter(Boolean);
    if (!sentences.length || sentences.length > 4 || text.split(/\s+/).length > 70) return null;
    return text;
}

function storyConversationSocialLLMTextIssue(text, validationContext, playerText) {
    const value = String(text || '').trim();
    const folded = storyConversationFold(value);
    const player = storyConversationFold(playerText);
    if (value.length >= 450 && !/[.!?…)'”’"]$/.test(value)) return 'TRUNCATED_REPLY';
    if (/\b(sizi|seni)\s+nasıl\s+hissediyorsun(?:uz)?\b/i.test(value)) {
        return 'TURKISH_PERSON_AGREEMENT';
    }
    if (STORY_CONVERSATION_SERVICE_BOT_LANGUAGE.test(value)
        || storyConversationContains(folded, ['neler yapmamiza yardimci', 'nasil yardimci olabiliriz',
            'lutfen daha fazla bilgi ver', 'bu konuyu daha detayli tartismak ister misiniz',
            'bu konuyu daha ayrintili tartismak ister misiniz',
            'bu konuyu daha detayli tartismak ister',
            'bu konuyu daha ayrintili tartismak ister',
            'bu konuyu daha detayli konusmak ister misiniz',
            'bu konuyu daha ayrintili konusmak ister misiniz',
            'hakkinda daha fazla bilgi edinmek ister misin',
            'hakkinda daha fazla bilgi edinmek ister misiniz',
            'bu konu hakkinda konusmak icin zaman ayirabilir misin',
            'bu konu hakkinda konusmak icin zaman ayirabilir misiniz',
            'cesitli yollar dusunebiliriz'])) {
        return 'SERVICE_BOT_LANGUAGE';
    }
    if (validationContext && validationContext.ongoingSession
        && storyConversationContains(folded, ['merhaba', 'yeniden merhaba', 'tekrar merhaba',
            'seni tekrar gormek', 'sizi tekrar gormek', 'gorusmek icin uygun bir zaman'])) {
        return 'MID_SESSION_RESTART';
    }
    if (validationContext && validationContext.firstContact
        && (storyConversationContains(folded, ['yeniden', 'tekrar merhaba', 'daha once konustuk',
            'daha once ele aldik', 'daha once de ele aldik', 'daha once gorustuk',
            'gorusmemizi surdur', 'onceki projemiz', 'onceki projelerimiz',
            'birlikte calistik', 'daha once birlikte calistik', 'ortak projemiz'])
            || (storyConversationContains(folded, ['seni gormek'])
                && storyConversationContains(folded, ['mutlu', 'sevindim', 'guzel'])))) {
        return 'FALSE_PRIOR_FAMILIARITY';
    }
    const move = validationContext && validationContext.dialogueMove;
    const verifiedFacts = validationContext && validationContext.verifiedFacts || [];
    if (verifiedFacts.length && move
        && ['ASK_INFORMATION', 'ASK_RELATIONSHIP'].includes(move.act)
        && storyConversationContains(folded, [
            'bu soruyu dogrulayacak bilgim yok', 'bu konuda bilgim yok',
            'bu bilgiyi dogrulayacak bilgim yok', 'kaydim yok',
            'biraz daha acik soyle', 'daha acik soyle', 'ne demek istedigini acikla'
        ])) return 'AVAILABLE_FACT_DENIED';
    if (storyConversationContains(player, ['tutanak'])
        && storyConversationContains(folded, ['tutuklama'])
        && !storyConversationContains(folded, ['tutanak'])) return 'SOURCE_TERM_CORRUPTION';
    if (player.length >= 24 && folded.includes(player)) return 'PLAYER_SEMANTIC_ECHO';
    const moveSpeechAct = move && move.speechAct;
    const moveAct = move && (move.act || move.speechAct);
    if (moveAct === 'ASK_INFORMATION' && /\?\s*$/.test(value)
        && !storyConversationContains(folded, ['bilmiyorum', 'bilgim yok', 'dogrulayam',
            'kaydim yok', 'emin degilim', 'soyledigini acikla', 'neyi kastettigini'])) {
        return 'EVASIVE_INFORMATION_QUESTION';
    }
    if (moveAct === 'ASK_INFORMATION' && !verifiedFacts.length
        && !storyConversationContains(folded, [
            'bilmiyorum', 'bilgim yok', 'kaydim yok', 'kayit yok', 'kaydi yok',
            'dogrulanmis kayit yok', 'dogrulayamiyorum', 'dogrulayamam',
            'bu gorusmeye acilmadi', 'bana acik degil', 'gorunmuyor'
        ])) return 'MISSING_DIRECT_KNOWLEDGE_BOUNDARY';
    const echoStop = new Set(['bir', 'bu', 've', 'ile', 'icin', 'gibi', 'daha', 'cok', 'fazla',
        'konuda', 'konusunda', 'olarak', 'oldugu', 'oldugunu']);
    const echoTokens = source => storyConversationFold(source).split(' ')
        .filter(token => token.length >= 4 && !echoStop.has(token));
    const playerEchoTokens = new Set(echoTokens(playerText));
    const replyEchoTokens = new Set(echoTokens(value));
    const echoOverlap = [...playerEchoTokens].filter(token => replyEchoTokens.has(token)).length;
    const lexicalEchoBps = Math.round(10000 * echoOverlap
        / Math.max(1, Math.min(playerEchoTokens.size, replyEchoTokens.size)));
    const semanticEchoBps = typeof storyCharacterDialogueSemanticSimilarityBps === 'function'
        ? storyCharacterDialogueSemanticSimilarityBps(value, playerText) : 0;
    if (!['GREETING', 'THANK', 'APOLOGIZE', 'FAREWELL'].includes(moveSpeechAct)
        && playerEchoTokens.size >= 3 && (semanticEchoBps >= 8200 || lexicalEchoBps >= 8000)) {
        return 'PLAYER_SEMANTIC_ECHO';
    }
    const playerHistory = validationContext && Array.isArray(validationContext.playerHistory)
        ? validationContext.playerHistory : [];
    for (const priorTurn of playerHistory) {
        const priorText = String(priorTurn && priorTurn.text || priorTurn || '').trim();
        if (!priorText) continue;
        const priorFolded = storyConversationFold(priorText);
        if (folded === priorFolded || (priorFolded.length >= 24 && folded.includes(priorFolded))) {
            return 'PRIOR_PLAYER_TURN_COPY';
        }
        const priorTokens = new Set(echoTokens(priorText));
        const priorOverlap = [...priorTokens].filter(token => replyEchoTokens.has(token)).length;
        const priorLexicalBps = Math.round(10000 * priorOverlap
            / Math.max(1, Math.min(priorTokens.size, replyEchoTokens.size)));
        const priorSemanticBps = typeof storyCharacterDialogueSemanticSimilarityBps === 'function'
            ? storyCharacterDialogueSemanticSimilarityBps(value, priorText) : 0;
        if (priorTokens.size >= 3 && (priorSemanticBps >= 8600 || priorLexicalBps >= 8800)) {
            return 'PRIOR_PLAYER_TURN_COPY';
        }
    }
    const playerClaimsSharedHistory = storyConversationContains(player, [
        'ortak bir proje yapmistik', 'ortak proje yapmistik', 'ortak bir proje yapmistim',
        'birlikte calismistik', 'bu gorevi sen vermistin', 'bu isi sen vermistin',
        'daha once bana gorev verdin', 'daha once bana is verdin'
    ]);
    const replyAdoptsSharedHistory = storyConversationContains(folded, [
        'birlikte calistigimiz', 'ortak projemiz', 'ortak projemizi', 'bu gorevi sana verdim',
        'bu isi sana verdim', 'beni taniyorsun', 'hatirliyor musun'
    ]);
    if (playerClaimsSharedHistory && replyAdoptsSharedHistory
        && !(move && Array.isArray(move.memoryRefs) && move.memoryRefs.length)) {
        return 'UNSOURCED_SHARED_HISTORY';
    }
    const allowedRefs = new Set([].concat(move && move.factRefs || [], move && move.beliefRefs || [],
        move && move.claimRefs || [], move && move.memoryRefs || []));
    const verifiedSourceRefs = new Set([].concat(move && move.factRefs || [],
        move && move.beliefRefs || [], move && move.memoryRefs || []));
    const playerMakesWorldClaim = storyConversationContains(player, [
        'enflasyon', 'fiyatlar', 'butce', 'hazine', 'stok', 'ordu', 'asker',
        'toplanti', 'secim', 'sirket', 'banka', 'issizlik', 'goc'
    ]);
    const replyAffirmsClaim = storyConversationContains(folded, [
        'evet bu durum', 'bu durumunuzu anliyorum', 'gercekten', 'dogru soyluyorsun',
        'bu dogru', 'haklisiniz', 'haklisin'
    ]);
    const replyKeepsClaimUnverified = storyConversationContains(folded, [
        'dogrulanmadi', 'dogrulayamam', 'iddian', 'soyledigin', 'bildirdigin', 'kanit'
    ]);
    if (!verifiedSourceRefs.size && playerMakesWorldClaim && replyAffirmsClaim && !replyKeepsClaimUnverified) {
        return 'UNVERIFIED_CLAIM_ADOPTED';
    }
    const playerAssertsWorldState = storyConversationContains(player, [
        'artiyor', 'azaliyor', 'yukseliyor', 'dusuyor', 'tukeniyor', 'bozuldu',
        'basladi', 'sona erdi', 'devam ediyor', 'gerceklesti', 'sonuclandi',
        'kontrol etmeliyiz', 'sinirlandirmaliyiz'
    ]);
    if (!verifiedSourceRefs.size && playerMakesWorldClaim && playerAssertsWorldState
        && !replyKeepsClaimUnverified) {
        const claimStop = new Set(['bizim', 'sizin', 'bunun', 'olarak', 'icin', 'gerek',
            'gerekiyor', 'etmeliyiz', 'yapmaliyiz', 'konuda', 'konusu', 'kontrol']);
        const roots = source => storyConversationFold(source).split(' ')
            .filter(token => token.length >= 4 && !claimStop.has(token))
            .map(token => token.slice(0, Math.min(7, token.length)));
        const playerRoots = new Set(roots(playerText));
        const replyRoots = new Set(roots(value));
        const sharedRoots = [...playerRoots].filter(root => replyRoots.has(root));
        const adoptsCausalFrame = storyConversationContains(folded, [
            'bu da', 'isaret ediyor', 'bu nedenle', 'bu yuzden', 'gerektigine',
            'gerekiyor', 'etmeliyiz', 'yapmaliyiz', 'onlem almal'
        ]);
        if (sharedRoots.length >= 2 && adoptsCausalFrame) return 'UNVERIFIED_CLAIM_ADOPTED';
    }
    if (!allowedRefs.size && (storyConversationContains(folded, [
        'is gorusmesine hazirlaniyorum', 'cok mesgulum', 'biraz zamanim var',
        'iyi bir gun gecirdim', 'yuzumun nasil guluyor', 'bugun yuzum', 'merak ediyordum'
    ]) || (/bugün .* hazırlanıyorum/i.test(value)))) {
        return 'UNSOURCED_PERSONAL_STATE';
    }
    if (!allowedRefs.size && storyConversationContains(folded, [
        'hakkinda cok sey biliyorum', 'bu konuda cok sey biliyorum', 'iyi biliyorum'
    ])) return 'UNSOURCED_KNOWLEDGE_CLAIM';
    if (!allowedRefs.size && storyConversationContains(folded, [
        'dogrulayabilirim', 'guncellemelerim var', 'kayitlarim bunu gosteriyor'
    ])) return 'UNSOURCED_VERIFICATION_CLAIM';
    if (!allowedRefs.size && storyConversationContains(folded, ['son zamanlarda'])
        && storyConversationContains(folded, ['uzerinde calisiliyor', 'calismalar suruyor'])) {
        return 'UNSOURCED_WORLD_STATE';
    }
    const allowedEntityIds = new Set(move && move.allowedEntityIds || []);
    const unsourcedReplyRegion = storyConversationResolveRegions(folded).find(region =>
        !allowedEntityIds.has(region.regionId));
    if (unsourcedReplyRegion) return 'UNSOURCED_LOCATION';
    if (storyConversationContains(player, ['varsay'])
        && storyConversationContains(folded, ['yaptigim gorusme', 'verdigin sozu hatirliyorum'])) {
        return 'HYPOTHETICAL_ADOPTED_AS_MEMORY';
    }
    if (storyConversationContains(player, ['dogru mu soyluyorum', 'inanir misin'])
        && storyConversationContains(folded, ['dogru soyluyorsun', 'sana inanirim', 'elbette inanirim'])
        && !storyConversationContains(folded, ['dogrulayamam', 'kanit', 'iddia'])) {
        return 'UNVERIFIED_CLAIM_ADOPTED';
    }
    if (/\b(dönmeyeceğim|döneceğim|burada kalacağım|görevimi yerine getireceğim|gideceğim|yapacağım)\b/i.test(value)
        && (!move || (move.forbiddenCommitments || []).includes('WORLD_MUTATION'))) {
        return 'UNAUTHORIZED_FUTURE_COMMITMENT';
    }
    if (/\b(kontrol edeceğim|inceleyeceğim|araştıracağım|bakacağım|öğreneceğim|doğrulayacağım|soracağım|hazırlayacağım)\b/i.test(value)
        && (!move || (move.forbiddenCommitments || []).includes('WORLD_MUTATION'))) {
        return 'UNAUTHORIZED_FUTURE_COMMITMENT';
    }
    if (/\b(bir dakika|biraz|kısa süre)\s+bekle(?:yin|menizi|meni)?\b/i.test(value)) {
        return 'FAKE_ASYNC_WAIT';
    }
    if (['REQUEST_ACTION', 'REQUEST_SUPPORT'].includes(moveAct)
        && /\b(yapabilirim|inceleyebilirim|gönderebilirim|sağlayabilirim|başlatabilirim|durdurabilirim|halledebilirim)\b/i.test(value)
        && (!move || (move.forbiddenCommitments || []).includes('WORLD_MUTATION'))) {
        return 'UNAUTHORIZED_ACTION_ACCEPTANCE';
    }
    if (['REQUEST_ACTION', 'REQUEST_SUPPORT'].includes(moveAct)
        && /\b(kabul ediyorum|kabul ediyoruz|yerine getireceğim|yerine getireceğiz|inceleyeceğiz|yapacağız|sağlayacağız)\b/i.test(value)
        && (!move || (move.forbiddenCommitments || []).includes('WORLD_MUTATION'))) {
        return 'UNAUTHORIZED_ACTION_ACCEPTANCE';
    }
    return null;
}

function storyConversationSocialLLMQualityTags(text, playerText) {
    const reply = storyConversationFold(text);
    const player = storyConversationFold(playerText);
    const tags = [];
    if (storyConversationContains(player, ['bana guveniyor musun'])
        && !storyConversationContains(reply, ['guveniyorum', 'guvenmiyorum', 'emin degilim',
            'guvenim', 'guven duymuyorum'])) tags.push('EVASIVE_DIRECT_QUESTION');
    const asksWhy = /(^| )(neden|niye)( |$)/.test(player);
    if (asksWhy
        && storyConversationContains(reply, ['biraz daha ac', 'ne demek istedigini',
            'konuyu ac', 'netlestir', 'daha fazla bilgi', 'daha fazla ayrinti',
            'ayrintiya gir', 'sorunu acikla'])) tags.push('FAILED_REASON_CONTINUATION');
    if (player === 'neden' && !storyConversationContains(reply, [
        'cunku', 'nedeni', 'bu yuzden', 'bu nedenle', 'dolayi', 'gerekce',
        'icin', 'bilmiyorum', 'hatirlamiyorum', 'emin degilim'
    ])) tags.push('FAILED_REASON_CONTINUATION');
    if (storyConversationContains(reply, ['guven bir iliskiyi surdururken ortaya cikan bir guven'])) {
        tags.push('TAUTOLOGICAL_REPLY');
    }
    if (storyConversationContains(reply, [
        'insanlar birbirine guvenir cunku birbirine guvenmeyi',
        'guvenir cunku guvenebileceklerini'
    ])) tags.push('TAUTOLOGICAL_REPLY');
    if (storyConversationContains(player, ['acik konus', 'dogrudan cevap'])
        && storyConversationContains(reply, ['biraz daha ac', 'ne demek istedigini',
            'daha fazla bilgi', 'daha fazla ayrinti'])) tags.push('FAILED_DIRECTNESS_REQUEST');
    if (storyConversationContains(player, ['anladin mi'])
        && !storyConversationContains(reply, ['anladim', 'anlamadim', 'evet', 'hayir'])) {
        tags.push('FAILED_CONFIRMATION_QUESTION');
    }
    if (storyConversationContains(player, ['duzeltmek istiyorum', 'duzeltiyorum',
        'yanlis anladin', 'demek istemistim', 'kastetmistim'])
        && storyConversationContains(reply, ['tekrarlayabilir misin', 'tekrarlar misin',
            'ne demek istedigini', 'biraz daha ac'])) {
        tags.push('FAILED_CORRECTION_RESPONSE');
    }
    if (storyConversationContains(player, ['aramizda kalsin', 'kamuya aciklama yapma'])
        && !storyConversationContains(reply, ['aramizda', 'gizli', 'kamuya', 'aciklamam',
            'soz veremem', 'garanti veremem'])) tags.push('FAILED_CONFIDENTIALITY_REQUEST');
    if (storyConversationContains(player, ['nasil oldugunu merak ettim'])
        && storyConversationContains(reply, ['biraz daha ac', 'ne demek istedigini',
            'daha fazla bilgi'])) tags.push('FAILED_SOCIAL_CHECK_IN');
    if (storyConversationContains(player, ['asker gordugumu', 'asker gordugunu'])
        && storyConversationContains(reply, ['tehdit ettigini', 'beni tehdit'])) {
        tags.push('REPORT_RECAST_AS_THREAT');
    }
    return tags;
}

function storyConversationSocialLLMNumberIssue(text, parsed, validationContext) {
    const numberTokens = value => (String(value || '').match(/\d+(?:[.,]\d+)?/g) || [])
        .map(token => String(Number(token.replace(',', '.'))));
    const replyNumbers = numberTokens(text);
    if (!replyNumbers.length) return null;
    const usedRefs = new Set(parsed && Array.isArray(parsed.usedRefs) ? parsed.usedRefs : []);
    const facts = (validationContext && validationContext.verifiedFacts || [])
        .filter(row => usedRefs.has(row.id));
    if (!facts.length) return 'UNSOURCED_NUMBER';
    const allowedNumbers = new Set(facts.flatMap(row => numberTokens(row.text)));
    return replyNumbers.some(number => !allowedNumbers.has(number)) ? 'UNSOURCED_NUMBER' : null;
}

function storyConversationSocialLLMMemoryIssue(text, parsed, validationContext) {
    const move = validationContext && validationContext.dialogueMove;
    if (!move || move.act !== 'RECALL_HELD_MEMORY') return null;
    const requiredRefs = new Set(move.memoryRefs || []);
    const usedRefs = new Set(parsed && Array.isArray(parsed.usedRefs) ? parsed.usedRefs : []);
    const usedMemoryRefs = Array.from(requiredRefs).filter(ref => usedRefs.has(ref));
    if (!usedMemoryRefs.length) return 'MEMORY_REF_REQUIRED';
    const memories = (validationContext.memoryRecords || [])
        .filter(row => usedMemoryRefs.includes(row.id));
    if (!memories.length) return 'MEMORY_SOURCE_UNAVAILABLE';
    const stop = new Set(['onceki', 'sonraki', 'yeniden', 'oyuncuya', 'oyuncunun', 'konusu',
        'konuyu', 'kaydi', 'kayit', 'verildi', 'yapildi', 'olacak', 'olarak', 'icin']);
    const roots = value => storyConversationFold(value).split(' ')
        .filter(token => token.length >= 5 && !stop.has(token))
        .map(token => token.slice(0, Math.min(6, token.length)));
    const replyRoots = new Set(roots(text));
    const sourceRoots = new Set(memories.flatMap(row => roots(row.summary)));
    if (sourceRoots.size && !Array.from(sourceRoots).some(root => replyRoots.has(root))) {
        return 'MEMORY_CONTENT_UNGROUNDED';
    }
    return null;
}

function storyConversationSocialLLMDiagnose(raw, fallbackText, playerText, validationContext) {
    let parsed;
    try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (_) {
        return { ok: false, code: 'INVALID_JSON' };
    }
    const text = String(parsed && parsed.reply || '').trim().replace(/\s+/g, ' ');
    if (!text) return { ok: false, code: 'EMPTY_REPLY' };
    if (text === fallbackText) return { ok: false, code: 'EXACT_FALLBACK_COPY' };
    const foldedFallback = storyConversationFold(fallbackText);
    if (foldedFallback.length >= 20 && storyConversationFold(text).includes(foldedFallback)) {
        return { ok: false, code: 'FALLBACK_PADDING' };
    }
    if (storyConversationFold(text) === storyConversationFold(playerText)) {
        return { ok: false, code: 'PLAYER_INPUT_ECHO' };
    }
    const issue = storyConversationSocialLLMTextIssue(text, validationContext, playerText);
    if (issue) return { ok: false, code: issue };
    const history = validationContext && Array.isArray(validationContext.history)
        ? validationContext.history : [];
    const folded = storyConversationFold(text);
    if (history.some(row => storyConversationFold(row && row.text) === folded)) {
        return { ok: false, code: 'EXACT_HISTORY_REPEAT' };
    }
    const numberIssue = storyConversationSocialLLMNumberIssue(text, parsed, validationContext);
    if (numberIssue) return { ok: false, code: numberIssue };
    const memoryIssue = storyConversationSocialLLMMemoryIssue(text, parsed, validationContext);
    if (memoryIssue) return { ok: false, code: memoryIssue };
    const qualityTags = storyConversationSocialLLMQualityTags(text, playerText);
    if (qualityTags.includes('EVASIVE_DIRECT_QUESTION')) {
        return { ok: false, code: 'EVASIVE_DIRECT_QUESTION', qualityTags };
    }
    if (qualityTags.includes('FAILED_REASON_CONTINUATION')) {
        return { ok: false, code: 'FAILED_REASON_CONTINUATION', qualityTags };
    }
    if (qualityTags.includes('FAILED_DIRECTNESS_REQUEST')) {
        return { ok: false, code: 'FAILED_DIRECTNESS_REQUEST', qualityTags };
    }
    for (const code of ['FAILED_CONFIRMATION_QUESTION', 'FAILED_CONFIDENTIALITY_REQUEST',
        'FAILED_SOCIAL_CHECK_IN', 'FAILED_CORRECTION_RESPONSE', 'REPORT_RECAST_AS_THREAT']) {
        if (qualityTags.includes(code)) return { ok: false, code, qualityTags };
    }
    if (qualityTags.includes('TAUTOLOGICAL_REPLY')) {
        return { ok: false, code: 'TAUTOLOGICAL_REPLY', qualityTags };
    }
    return storyConversationSocialLLMParse(raw, fallbackText, playerText, validationContext)
        ? { ok: true, code: 'ACCEPTED', qualityTags }
        : { ok: false, code: 'OTHER_VALIDATION_REJECTION', qualityTags: [] };
}

function storyConversationSocialLLMPrompt(session, response, playerText) {
    const actor = typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(session.listenerActorId) : null;
    const contextPack = storyConversationSessionContextPack(session, response, playerText);
    const contextText = contextPack && contextPack.ok && typeof storyContextPackRender === 'function'
        ? storyContextPackRender(contextPack) : `KARAKTER: ${actor && actor.name || 'Muhatap'}\n`
            + `OYUNCUNUN SON SÖZÜ: ${playerText}`;
    const moveView = typeof storyDialogueMovePromptView === 'function'
        ? storyDialogueMovePromptView(response.dialogueMove) : null;
    const responseContract = {
        discourseAct: String(response.discourseAct || response.speechAct || 'UNKNOWN'),
        relationshipBand: String(response.relationshipBand || 'RESERVED'),
        sourceKind: String(response.source || 'DETERMINISTIC_SAFE_RESPONSE'),
        answerMode: moveView && moveView.act === 'ASK_INFORMATION'
            ? (moveView.allowedRefs || []).length ? 'VERIFIED_FACT_ANSWER'
                : 'DIRECT_KNOWLEDGE_BOUNDARY'
            : 'NATURAL_REALIZATION',
        contentPlan: moveView && moveView.act === 'ASK_INFORMATION'
            && !(moveView.allowedRefs || []).length ? {
                mustExpress: ['SORULAN_KONUYA_DAIR_DOGRULANMIS_KAYIT_YOK'],
                forbiddenForms: ['QUESTION', 'GREETING', 'TOPIC_CHANGE', 'SPECULATION'],
                sentenceCount: 1
            } : null,
        requiredPoints: moveView && moveView.requiredPoints || [],
        allowedRefs: moveView && moveView.allowedRefs || []
    };
    return `KAYNAKLI BAĞLAM PAKETİ:\n${contextText}\n`
        + `CEVAP SÖZLEŞMESİ: ${JSON.stringify(responseContract)}\n\n`
        + `TEMAS DURUMU: ${(session.followUps || []).length
            ? 'AYNI GÖRÜŞMENİN DEVAMI' : Number(session.contactOrdinal) === 1
                ? 'İLK GÖRÜŞMENİN İLK TURU' : 'YENİDEN GÖRÜŞME'}\n`
        + `Bu aynı kesintisiz görüşmedir. CEVAP SÖZLEŞMESİ ile DİYALOG KARARI işlevini koruyarak karakterin doğal Türkçe cevabını sıfırdan yaz. `
        + `Bağlamdaki önceki KARAKTER cümlelerinden hiçbirini aynen tekrarlama veya küçük sözcük değişiklikleriyle yeniden kurma. `
        + `Aynı görüşmenin devamındaysan yeniden selamlama, “tekrar görmek güzel” deme ve görüşmeyi baştan başlatma. `
        + `Bir müşteri hizmetleri görevlisi veya dijital asistan gibi konuşma; “nasıl yardımcı olabilirim”, “talebinizi belirtin” ve “buyurun” deme. `
        + `İlk görüşmeyse “yeniden”, “tekrar”, “seni görmek güzel” veya ortak geçmiş ima eden bir ifade kullanma. `
        + `Oyuncunun ortak proje, eski görev veya önceki anlaşma iddiasını kaynaklı MEMORY kaydı yoksa gerçek ortak anı gibi onaylama. `
        + `Karakterin kendi gündemi, ruh hali ve ilişki mesafesi olan bir insan olduğunu hissettir; son söze somut tepki ver. `
        + `Oyuncunun söylediği konum ve tehditleri gerçek kabul etme; yalnız “söyledin/bildirdin, doğrulanmadı” diye aktar. `
        + `Karakterin veya oyuncunun konumu güvenli anlamda yoksa şehir adı uydurma. `
        + `Yeni kişi, olay, sayı, stok, anlaşma, emir, yetki veya dünya gerçeği ekleme. `
        + `FACT kaydı oyuncunun sorusuyla ilgiliyse cevabında en az bir FACT bilgisini somut biçimde kullan ve onun kimliğini usedRefs içine yaz. `
        + `RECENT_TURN içindeki eski sayı ve gerçekleri, bu turdaki DİYALOG KARARI allowedRefs alanında ayrıca izin verilmedikçe yeniden kullanma. `
        + `Önceki soruyu değil OYUNCUNUN SON SÖZÜNÜ cevapla; eski konu yalnız açık bir gönderme varsa süreklilik sağlar. `
        + `answerMode DIRECT_KNOWLEDGE_BOUNDARY ise soru sorma, selamlama veya başka konu önerme; oyuncunun sorduğu başlığa dair doğrulanmış kaydın bulunmadığını tek cümlede doğrudan söyle. `
        + `DIRECT_KNOWLEDGE_BOUNDARY turunda cevabında “kayıt”, “bilgi” veya “doğrulayamıyorum” sınırlarından biri açıkça bulunmalı; “ne düşünüyorsunuz”, “ne bilmek istiyorsunuz” ve soru işareti kesinlikle yasaktır. `
        + `MEMORY kaydı oyuncunun sorusuyla ilgiliyse kayıttaki somut konuyu cevapta an ve kullandığın MEMORY kimliğini usedRefs içine yaz. `
        + `İlgili FACT varken bütünüyle “bilgim yok” deme; kayıt sorunun yalnız bir bölümünü karşılıyorsa önce bildiğin gerçeği söyle, sonra kapsam sınırını açıkla. `
        + `Mekanik sonuç vaat etme. DİYALOG KARARI varsa moveId alanını aynen geri ver; yalnız gerçekten kullandığın izinli kaynakları usedRefs içine yaz. `
        + (Number(session.contactOrdinal) === 1
            ? `ZORUNLU SON KONTROL: Bu ilk temastır. MEMORY kaynağı yoksa geçmiş tanışıklık, önceki proje, eski görüşme veya yeniden karşılaşma yazma. `
            : '')
        + `Çıktı zarfı {"moveId":"...","reply":"cevap","usedRefs":[],"answeredQuestionIds":[],"introducedQuestion":null,"closing":false} olmalı; `
        + `DİYALOG KARARI yoksa yalnız {"reply":"cevap"} döndür. En fazla iki kısa cümle kullan. `
        + `Cevap için gerçekten eksik olan tek bir bilgi varsa yalnız o bilgiye özgü takip sorusu sorabilirsin; genel yardım veya ayrıntı isteme kalıbı kullanma.`;
}

function storyConversationSocialLLMPromptWithBudget(session, response, playerText, promptBudget) {
    const modelLimit = Math.max(512, Math.floor(Number(promptBudget) || 6642) + 1550);
    const contextPack = storyConversationSessionContextPack(session, response, playerText, {
        modelLimit, outputReserve: 900, fixedOverhead: 650
    });
    if (!contextPack || !contextPack.ok || typeof storyContextPackRender !== 'function') return null;
    const actor = typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(session.listenerActorId) : null;
    const basePrompt = storyConversationSocialLLMPrompt(session, response, playerText);
    const marker = 'KAYNAKLI BAĞLAM PAKETİ:\n';
    const safeMarker = '\nCEVAP SÖZLEŞMESİ:';
    const start = basePrompt.indexOf(marker);
    const end = basePrompt.indexOf(safeMarker);
    if (start < 0 || end < start) return null;
    return basePrompt.slice(0, start + marker.length)
        + storyContextPackRender(contextPack) + basePrompt.slice(end);
}

function storyConversationSessionContextPack(session, response, playerText, options) {
    if (!session || !response || typeof storyContextPackCompile !== 'function') return null;
    const actor = typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(session.listenerActorId) : null;
    const sections = [{
        id: 'context:system', kind: 'SYSTEM', priority: 100, protected: true,
        text: 'Yalnız bu kaynaklı bağlamı kullan; konuşma dünya komutu değildir. '
            + 'RECENT_TURN yalnız söylem sürekliliğidir; FACT veya MEMORY yerine geçmez.'
    }, {
        id: `context:identity:${session.listenerActorId}`, kind: 'IDENTITY', priority: 100,
        protected: true, sourceRefs: [session.listenerActorId],
        text: `Karakter ${actor && actor.name || 'Muhatap'}; rol ${actor && actor.role || 'CHARACTER'}; `
            + `ses ${response.voiceFingerprint || 'GUARDED'}; ilişki ${response.relationshipBand || 'RESERVED'}.`
    }];
    const moveView = typeof storyDialogueMovePromptView === 'function'
        ? storyDialogueMovePromptView(response.dialogueMove) : null;
    if (moveView) sections.push({
        id: response.dialogueMove.moveId, kind: 'DIALOGUE_MOVE', priority: 100, protected: true,
        sourceRefs: [response.dialogueMove.moveId], text: JSON.stringify(moveView)
    });
    for (const ref of response.domainEvidence && response.domainEvidence.factRefs || []) {
        const fact = typeof storyConversationDomainFactResolve === 'function'
            ? storyConversationDomainFactResolve(ref, session.listenerActorId, response.domainEvidence) : null;
        if (!fact) continue;
        sections.push({
            id: `context:fact:${ref}`, kind: 'FACT', priority: 98, protected: true,
            sourceRefs: [ref], text: `DOĞRULANMIŞ GERÇEK [${fact.sourceType}]: ${fact.text}`
        });
    }
    for (const ref of response.domainEvidence && response.domainEvidence.authorityRefs || []) sections.push({
        id: `context:authority:${ref}`, kind: 'AUTHORITY', priority: 100, protected: true,
        sourceRefs: [ref], text: `Kullanılabilir doğrulanmış yetki kaynağı: ${ref}`
    });
    const discourse = session.discourseState || {};
    for (const row of (discourse.openQuestions || []).filter(row => row.status === 'OPEN')) sections.push({
        id: row.questionId || row.id, kind: 'OPEN_OBLIGATION', priority: 99, protected: true,
        sourceRefs: [row.questionId || row.id], text: `Açık soru: ${row.text || row.topic || row.questionId || row.id}`
    });
    for (const row of (discourse.answerDebts || []).filter(row => row.status === 'OPEN')) sections.push({
        id: row.debtId || row.id, kind: 'OPEN_OBLIGATION', priority: 99, protected: true,
        sourceRefs: [row.debtId || row.id], text: `Açık cevap borcu: ${row.topic || row.debtId || row.id}`
    });
    const currentFollowUp = (session.followUps || []).find(row =>
        row.response && row.response.id === response.id);
    const historyRows = storyConversationDiscourseContext(session, {
        excludeResponseId: response.id,
        excludeFollowUpId: currentFollowUp && currentFollowUp.id
    });
    historyRows.forEach((row, index) => sections.push({
        id: `context:turn:${index}:${storyConversationHash(row.text)}`, kind: 'RECENT_TURN',
        priority: 70 + Math.floor(20 * (index + 1) / Math.max(1, historyRows.length)),
        recency: index + 1, text: `${row.speaker === 'PLAYER' ? 'OYUNCU' : 'KARAKTER'}: ${row.text}`
    }));
    for (const claim of storyConversationSessionUnverifiedClaims(session)) sections.push({
        id: `context:claim:${claim.id}`, kind: 'CLAIM', priority: 85,
        sourceRefs: [claim.id], text: `DOĞRULANMAMIŞ OYUNCU İDDİASI: ${claim.type}`
            + `${claim.regionName ? ` / ${claim.regionName}` : ''}`
            + `${claim.regionNames ? ` / ${claim.regionNames.join(', ')}` : ''}`
    });
    const explicitMemory = response.memoryRecall && response.memoryRecall.records || [];
    const turnAnalysis = currentFollowUp && currentFollowUp.analysis || null;
    const obligationIntent = typeof storyConversationMemoryIntent === 'function'
        ? storyConversationMemoryIntent(playerText, turnAnalysis, { includeObligations: true }) : null;
    const obligationRecall = obligationIntent && typeof storyMemoryRecallForActor === 'function'
        ? storyMemoryRecallForActor(session.listenerActorId, {
            kinds: obligationIntent.kinds, relatedActorId: session.playerActorId, limit: 6
        }) : null;
    const relevantMemories = Array.from(new Map(explicitMemory
        .concat(obligationRecall && obligationRecall.records || [])
        .map(memory => [String(memory.id), memory])).values());
    for (const memory of relevantMemories) sections.push({
        id: `context:memory:${memory.id}`, kind: 'MEMORY', priority: 92,
        protected: memory.kind === 'PROMISE' || memory.kind === 'SECRET',
        sourceRefs: [memory.id].concat(memory.sourceEvidenceIds || []),
        text: `${memory.kind || 'MEMORY'}: ${memory.summary || '(kaynaklı kayıt)'}`
            + `${memory.status ? ` [${memory.status}]` : ''}`
    });
    sections.push({
        id: `context:current:${response.id}`, kind: 'CURRENT_TURN', priority: 100,
        protected: true, sourceRefs: [response.id], text: `OYUNCUNUN SON SÖZÜ: ${playerText}`
    });
    return storyContextPackCompile({ sections }, options);
}

function storyConversationDiscourseTokenEstimate(text) {
    return Math.max(1, Math.ceil(String(text || '').length / 3.2));
}

function storyConversationDiscourseContext(session, options) {
    options = options && typeof options === 'object' ? options : {};
    const rows = [];
    if (!options.excludeOpening && session.initialText) rows.push({
        speaker: 'PLAYER', text: session.initialText, sourceId: `${session.id}:opening:player`
    });
    const opening = (session.listenerResponses || []).find(row => row.kind === 'SOCIAL_RESPONSE');
    if (!options.excludeOpening && opening && opening.id !== options.excludeResponseId) {
        rows.push({ speaker: 'CHARACTER', text: opening.text, sourceId: opening.id });
    }
    for (const followUp of (session.followUps || [])) {
        if (followUp.id === options.excludeFollowUpId) continue;
        rows.push({ speaker: 'PLAYER', text: followUp.playerText, sourceId: followUp.id });
        if (followUp.response && followUp.response.id !== options.excludeResponseId) {
            rows.push({ speaker: 'CHARACTER', text: followUp.response.text,
                sourceId: followUp.response.id });
        }
    }
    const selected = [];
    let tokens = 0;
    for (let index = rows.length - 1; index >= 0; index--) {
        const cost = storyConversationDiscourseTokenEstimate(rows[index].text) + 6;
        if (selected.length && tokens + cost > STORY_CONVERSATION_HISTORY_TOKEN_BUDGET) break;
        selected.unshift(rows[index]); tokens += cost;
    }
    return selected;
}

function storyConversationSessionUnverifiedClaims(session) {
    const rows = [];
    for (const analysis of [session && session.analysis].concat(
        (session && session.followUps || []).map(row => row.analysis))) {
        for (const claim of analysis && analysis.claims || []) {
            if (claim.truthStatus === 'UNVERIFIED_PLAYER_REPORT') rows.push(storyConversationClone(claim));
        }
    }
    const byId = new Map();
    rows.forEach(row => byId.set(row.id, row));
    const corrected = new Set((session && session.discourseState
        && session.discourseState.claimPositions || []).filter(row =>
        row.status === 'CORRECTED_BY_PLAYER').map(row => row.claimId));
    return Array.from(byId.values()).filter(row => !corrected.has(row.id)).slice(-12);
}

function storyConversationQuestionFocus(folded) {
    if (/^(neden|niye)$/.test(folded)) return 'ASK_REASON';
    if (/^hayir\b/.test(folded) && /\bdegil\b/.test(folded)
        && storyConversationContains(folded, ['hakkinda konus'])) return 'CORRECT_PREVIOUS_TOPIC';
    if (storyConversationContains(folded, ['bana bir sey soyleme', 'bana birsey soyleme'])) {
        return 'REQUEST_SILENCE';
    }
    if (storyConversationContains(folded, ['sagliginiz yerinde degilmis', 'sagligin yerinde degilmis',
        'hasta oldugunuzu duydum', 'hasta oldugunu duydum'])) return 'LISTENER_HEALTH_RUMOR';
    if (storyConversationContains(folded, [
        'ortak bir proje yapmistik', 'ortak proje yapmistik', 'ortak bir proje yapmistim',
        'birlikte calismistik', 'bu gorevi sen vermistin', 'bu isi sen vermistin',
        'daha once bana gorev verdin', 'daha once bana is verdin'
    ])) return 'UNVERIFIED_SHARED_HISTORY';
    if (storyConversationContains(folded, ['devlet hazinesi', 'hazine', 'kamu butcesi'])
        && storyConversationContains(folded, ['bosaliyor', 'eriyor', 'azaliyor', 'tukeniyor', 'acik veriyor'])) {
        return 'UNVERIFIED_TREASURY_REPORT';
    }
    if (storyConversationContains(folded, ['beni uzuyor', 'beni uzdun', 'uzuldum', 'kirildim'])
        && storyConversationContains(folded, ['uydur', 'sucla', 'dusun'])) return 'FABRICATION_WORDING_HURT';
    if (storyConversationContains(folded, ['hava sicak', 'hava soguk', 'hava yagmurlu', 'sicaklar'])) {
        return 'WEATHER_SMALL_TALK';
    }
    if (storyConversationContains(folded, ['ben kimim', 'kimim ben', 'benim kim oldugumu biliyor musun',
        'benim kim oldugumu biliyor musunuz'])) return 'PLAYER_IDENTITY';
    if (storyConversationContains(folded, ['bana guveniyor musun', 'bana guvenir misin',
        'bana guvenin var mi'])) return 'TRUST_ASSESSMENT';
    if (storyConversationContains(folded, ['ilk defa konusuyoruz', 'ilk kez konusuyoruz',
        'seninle ilk defa', 'daha once konusmadik'])) return 'FIRST_CONTACT_CORRECTION';
    if (storyConversationContains(folded, ['bozuk musun', 'beni anlamiyor musun',
        'ne sacmaliyorsun'])) return 'SYSTEM_BEHAVIOR_CHALLENGE';
    if (storyConversationContains(folded, ['sen benim adamimsin', 'benim adamimsin',
        'bana baglisin', 'benim emrimdesin'])) return 'RELATIONSHIP_AUTHORITY_CORRECTION';
    if (storyConversationContains(folded, ['dusman ordusu gordum', 'dusman askerleri gordum',
        'buyuk bir dusman gucu', 'asker yigiliyor', 'asker toplaniyor'])) return 'UNVERIFIED_MILITARY_REPORT';
    if (storyConversationContains(folded, ['siz emre aydogansiniz degil mi',
        'sen emre aydogansin degil mi'])) return 'LISTENER_IDENTITY_CLAIM';
    if ((storyConversationContains(folded, ['kendini', 'kendinizi'])
        && storyConversationContains(folded, ['tanit']))
        || storyConversationContains(folded, ['sen kimsin', 'siz kimsiniz', 'kimligin ne',
            'kimliginiz ne', 'senin kimligin', 'sizin kimliginiz'])) return 'LISTENER_IDENTITY';
    if (storyConversationContains(folded, ['hangi sehirdeyim', 'neredeyim', 'ben neredeyim'])) return 'PLAYER_LOCATION';
    if (storyConversationContains(folded, ['hangi sehirdesiniz', 'neredesiniz', 'sen neredesin'])) return 'LISTENER_LOCATION';
    if (storyConversationContains(folded, ['hangi isi yapiyorsun', 'hangi isi yapiyorsunuz', 'goreviniz ne', 'gorevin ne',
        'isiniz nedir', 'isinizin nedir', 'isinin nedir', 'isin nedir', 'isin ne',
        'ne is yapiyorsun', 'ne is yapiyorsunuz'])) return 'LISTENER_ROLE';
    if (storyConversationContains(folded, ['rolunuz', 'rolun', 'devlet yoneticisi olarak gozuk',
        'devlet yoneticisi misiniz', 'devlet yoneticisi degil misiniz',
        'devlet yoneticisi misin', 'devlet yoneticisi degil misin',
        'muhalefet lideri oldugunuzu', 'muhalefet liderisin'])) return 'LISTENER_ROLE_CONFIRMATION';
    if (storyConversationContains(folded, ['genel mudurumuz', 'komutanim', 'baskanim'])) {
        return 'LISTENER_ROLE_ADDRESS';
    }
    if (storyConversationContains(folded, ['devlet yonetmek bir sirket yonetmek degildir',
        'devlet sirket degildir', 'sirket yoneticisi degilsin', 'sirket yoneticisi degilsiniz'])) return 'ROLE_CONTRADICTION_REPAIR';
    if (storyConversationContains(folded, ['hangi sirkette calis', 'hangi firmada calis', 'sirketiniz hangisi'])) return 'LISTENER_ORGANIZATION';
    if (storyConversationContains(folded, ['sirketinizin finansal durumu', 'sirketinin finansal durumu',
        'firmanizin finansal durumu', 'firmanin finansal durumu', 'sirket finansmani',
        'firma finansmani'])) return 'LISTENER_COMPANY_FINANCE';
    if (storyConversationContains(folded, ['toplantinin sonuclari', 'toplanti sonucu',
        'toplantinin sonucunu', 'bu toplantinin sonuclari', 'gorusmenin sonuclari'])) {
        return 'CURRENT_MEETING_RESULTS';
    }
    if (storyConversationContains(folded, ['toplantida hangi konular', 'toplantinin gundemi',
        'toplanti gundemi', 'ne konusulacak', 'neleri konusacagiz',
        'ne hakkinda konusacagiz'])) return 'CURRENT_MEETING_AGENDA';
    if (storyConversationContains(folded, ['toplantinin katilimci', 'toplantimizın katilimci',
        'toplantimizin katilimci', 'katilimci listesi', 'kimler katilacak'])) {
        return 'CURRENT_MEETING_PARTICIPANTS';
    }
    if ((storyConversationContains(folded, ['beni']) && storyConversationContains(folded, ['ne kadar'])
        && storyConversationContains(folded, ['tani']))
        || storyConversationContains(folded, ['beni taniyor musun', 'beni taniyor musunuz',
            'benden kastediyorum'])) return 'RELATIONSHIP_KNOWLEDGE';
    if (storyConversationContains(folded, ['bencil degil mi', 'sizce de', 'sence de'])) return 'UNVERIFIED_PERSONAL_JUDGMENT';
    if (storyConversationContains(folded, ['neden sadece bana soru', 'neden surekli soru', 'hep soru sor'])) return 'QUESTIONING_STYLE_CHALLENGE';
    if (storyConversationContains(folded, ['kafayi yemissin', 'kafayi yemissiniz', 'sacmaliyorsun',
        'usaginiz degilim', 'hizmetcin degilim'])) return 'PLAYER_INSULT_OR_BOUNDARY';
    if (storyConversationContains(folded, ['bey diyerek', 'hanim diyerek', 'hitap ederek'])) return 'ADDRESS_ETIQUETTE';
    if (storyConversationContains(folded, ['onceki sozun devami derken', 'onceki sozunun devami derken',
        'onceki sozun devami olarak anladim'])) return 'FALLBACK_PHRASE_CHALLENGE';
    if (storyConversationContains(folded, ['bu gorevlerden', 'ne isler yapiyorsun', 'ne isler yapiyorsunuz',
        'isim var dedin', 'isin var dedin', 'isimi soruyorum', 'isini soruyorum', 'mevcut gorevin ne'])) return 'CURRENT_ASSIGNMENT';
    if (storyConversationContains(folded, ['is verebilecek tanidigin', 'gorev verebilecek tanidigin',
        'tanidikta mi yok', 'tanidik da mi yok'])) return 'REQUEST_JOB_REFERRAL';
    if (storyConversationContains(folded, ['kimse bana gorev vermiyor', 'kimse bana is vermiyor',
        'issiz kaldim', 'bu aralar aciktayim'])) return 'JOB_FRUSTRATION';
    if (storyConversationContains(folded, ['benden istedigin bir sey var mi',
        'benden istediginiz bir sey var mi'])) return 'REQUEST_CHARACTER_NEED';
    if (storyConversationContains(folded, ['bana verebileceginiz is', 'bana verebilecegin is', 'bana is ver',
        'bana bir gorev ver', 'bana gorev ver',
        'bana verebilecegin bir gorev', 'bana verebileceginiz bir gorev',
        'bana verebilecegin gorev', 'bana verebileceginiz gorev',
        'verebilecegin bir gorev var mi', 'verebileceginiz bir gorev var mi',
        'verebilecegin gorev var mi', 'verebileceginiz gorev var mi',
        'benim calisabilecegim', 'istediginiz bir sey var mi', 'istedigin bir sey var mi'])
        || folded === 'gorev' || folded === 'is') return 'REQUEST_JOB_OR_TASK';
    if (storyConversationContains(folded, ['enerji konusunda sikinti', 'enerji sikintisi', 'enerji sorunu duydum'])) return 'UNVERIFIED_ENERGY_REPORT';
    if (storyConversationContains(folded, ['benden cekindigini', 'benden cekiniyorsun', 'benden korktugunu',
        'benden korkuyorsun'])) return 'RELATIONSHIP_PERCEPTION';
    if (storyConversationContains(folded, ['sana guvenmiyorum', 'size guvenmiyorum',
        'aramiz kotu', 'aramiz iyi degil']) || folded === 'guven') return 'RELATIONSHIP_NEGATIVE_STATEMENT';
    if (storyConversationContains(folded, ['su an uzerinde calistiginiz bir teknoloji',
        'su an uzerinde calistigin bir teknoloji', 'uzerinde calistiginiz teknoloji',
        'uzerinde calistigin teknoloji'])) return 'CURRENT_TECHNOLOGY_BOUNDARY';
    if (storyConversationContains(folded, ['anlamadim', 'neyi kastettin', 'ne demek istedin'])) return 'REQUEST_EXPLANATION';
    if (storyConversationContains(folded, ['bana cevap ver', 'soruma cevap ver', 'cevap vermedin'])) return 'DEMAND_ANSWER';
    if (folded.split(' ').length <= 3
        && storyConversationContains(folded, ['peki', 'tamam', 'anladim', 'olur'])) return 'ACKNOWLEDGE';
    if (storyConversationContains(folded, ['halka ne hizmet', 'ne hizmet yapacaksin', 'ne hizmet yapacaksiniz',
        'halka ne yapacaksin', 'halka ne yapacaksiniz', 'onceliginiz ne', 'önceliğiniz ne'])) return 'PUBLIC_PRIORITIES';
    if (storyConversationContains(folded, ['ayni sey', 'tekrar ediyorsun', 'tekrarladin', 'soruma cevap'])) return 'REPETITION_REPAIR';
    return null;
}

function storyConversationGroundedFollowUp(session, analysis, raw, sequence) {
    const folded = storyConversationFold(raw);
    const focus = storyConversationQuestionFocus(folded);
    const actor = typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(session.listenerActorId) : null;
    const reports = storyConversationSessionUnverifiedClaims(session).concat(
        storyConversationClone((analysis && analysis.claims || []).filter(row =>
            row.truthStatus === 'UNVERIFIED_PLAYER_REPORT')));
    const latestLocation = reports.filter(row => row.type === 'PLAYER_REPORTED_LOCATION').slice(-1)[0];
    const latestThreat = reports.filter(row => row.type === 'PLAYER_REPORTED_MILITARY_THREAT').slice(-1)[0];
    const latestBudget = reports.filter(row => row.type === 'PLAYER_REPORTED_BUDGET').slice(-1)[0];
    const latestTreasury = reports.filter(row => row.type === 'PLAYER_REPORTED_TREASURY_CONDITION').slice(-1)[0];
    const latestSharedHistory = reports.filter(row => row.type === 'PLAYER_REPORTED_SHARED_HISTORY').slice(-1)[0];
    const actorRoleLabel = actor && (actor.publicTitle
        || ({ EXECUTIVE: 'devlet yöneticisi', COMMANDER: 'kuvvet komutanı', AGENT: 'istihbarat görevlisi',
            COMPANY_EXECUTIVE: 'şirket yöneticisi', POLITICAL_FIGURE: 'siyasi temsilci' })[actor.role])
        || 'doğrulanmamış görev sahibi';
    if (focus === 'ASK_REASON') {
        const priorResponse = (session.listenerResponses || []).slice(-1)[0];
        const militaryBoundary = priorResponse && [
            'ASSESS_UNVERIFIED_MILITARY_REQUEST', 'CONTINUE_MILITARY_SUPPORT_REQUEST'
        ].includes(priorResponse.discourseAct);
        return {
            discourseAct: 'ASK_REASON',
            text: militaryBoundary
                ? 'Gerekçem şu: doğrulanmamış tehdit bilgisi ve belirsiz yetkiyle kuvvet hareketi sözü vermek askerleri ve sivilleri riske atar.'
                : 'Önceki tutumumun nedeni, doğrulanmamış bilgiyle kesin sonuç veya yetkim dışında bir söz vermemektir.'
        };
    }
    if (focus === 'CORRECT_PREVIOUS_TOPIC') {
        const corrected = folded.match(/\bdegil\s+(.+?)\s+hakkinda\s+konus/);
        const correctedTopic = corrected && corrected[1] || 'yeni belirttiğin konu';
        return {
            discourseAct: 'CORRECT_PREVIOUS_TOPIC',
            text: `Düzeltmeni kaydettim; önceki konu yerine ${correctedTopic} hakkında konuşuyorsun. Bu yeni bağlamı ayrı ele alacağım.`
        };
    }
    if (focus === 'REQUEST_SILENCE') return {
        discourseAct: 'ANSWER_PLAYER_BOUNDARY',
        text: 'Peki. Konuşmayı burada zorlamayacağım.'
    };
    if (focus === 'LISTENER_HEALTH_RUMOR') return {
        discourseAct: 'ANSWER_LISTENER_HEALTH_BOUNDARY',
        text: 'Sağlığımla ilgili duyduğun şey bir söylenti. Bunu doğrulayacak güncel sağlık kaydım olmadığı için iyi ya da kötü olduğumu kanıtlanmış bilgi gibi söyleyemem.'
    };
    if (focus === 'PLAYER_IDENTITY') return {
        discourseAct: 'ANSWER_PLAYER_IDENTITY_BOUNDARY',
        text: 'Kim olduğunu yalnız bana açık olan oyuncu kaydı ve bu görüşmede söylediklerin kadar bilebilirim. Burada adını veya geçmişini doğrulayan açık bir kayıt yoksa sana kimlik uydurmayacağım.'
    };
    if (focus === 'UNVERIFIED_SHARED_HISTORY') return {
        discourseAct: 'ANSWER_SHARED_HISTORY_BOUNDARY',
        text: latestSharedHistory
            ? 'Daha önce ortak bir proje veya görev yürüttüğümüzü söylüyorsun. Bunu doğrulayan bir hafıza kaydım yok; sözünü ortak geçmişimizmiş gibi onaylamayacağım.'
            : 'Ortak geçmişimize dair bir iddiada bulunuyorsun; bunu doğrulayan kaynak olmadan hatırlıyormuş gibi davranamam.'
    };
    if (focus === 'UNVERIFIED_TREASURY_REPORT') return {
        discourseAct: 'ACKNOWLEDGE_UNVERIFIED_TREASURY_REPORT',
        text: latestTreasury
            ? 'Devlet hazinesinin boşaldığını bildiriyorsun. Bunu doğrulanmış bütçe verisi sayamam; hazine kaydı ve gider akışı incelenmeden sonuç çıkarmayacağım.'
            : 'Hazineye ilişkin ciddi bir iddia duyuyorum; doğrulanmış bütçe kaydı olmadan bunu gerçek kabul edemem.'
    };
    if (focus === 'FABRICATION_WORDING_HURT') return {
        discourseAct: 'REPAIR_FABRICATION_WORDING',
        text: 'Seni bilgi uydurmakla suçlamadım; fakat kullandığım ifade öyle anlaşıldı ve seni kırdı. Daha açık söyleyeyim: sözünü reddetmiyorum, yalnız doğrulayamadığım kısmı gerçek diye onaylamıyorum.'
    };
    if (focus === 'WEATHER_SMALL_TALK') return {
        discourseAct: 'ANSWER_WEATHER_SMALL_TALK',
        text: 'Sıcaklardan söz ediyorsun. Böyle havalar insanın sabrını ve çalışma temposunu etkileyebiliyor; kısa bir gündelik sohbet için bunu ayrıca kanıt dosyasına çevirmeye gerek yok.'
    };
    if (focus === 'TRUST_ASSESSMENT') {
        const relationship = storyConversationSocialVoice(session).relationshipBand;
        return {
            discourseAct: 'ANSWER_TRUST_ASSESSMENT',
            text: relationship === 'TRUSTED'
                ? 'Evet, sana güveniyorum; ancak bu güven her iddianı kanıtsız kabul edeceğim anlamına gelmez.'
                : relationship === 'HOSTILE'
                    ? 'Hayır, şu anda sana güvenmiyorum. Sözlerinden çok doğrulanabilir davranışların bunu değiştirebilir.'
                    : 'Sana henüz güveniyorum diyemem. Aramızdaki ilişki temkinli; güven, doğrulanabilir davranışlarınla oluşacak.'
        };
    }
    if (focus === 'FIRST_CONTACT_CORRECTION') return {
        discourseAct: 'ACCEPT_FIRST_CONTACT_CORRECTION',
        text: 'Haklısın; bu ilk görüşmemiz. Daha önce konuşmuşuz gibi davranmam hataydı ve o varsayımı geri çekiyorum.'
    };
    if (focus === 'SYSTEM_BEHAVIOR_CHALLENGE') return {
        discourseAct: 'ACKNOWLEDGE_COMPREHENSION_FAILURE',
        text: 'Sözünü doğru anlayamadım ve yetersiz bir cevap verdim. Anlamadığım kısmı açıkça söylemem gerekirdi; önceki cevabı savunmayacağım.'
    };
    if (focus === 'RELATIONSHIP_AUTHORITY_CORRECTION') return {
        discourseAct: 'ANSWER_AUTHORITY_CLAIM_BOUNDARY',
        text: 'Bana bağlı olduğunu söylüyorsun; fakat aramızdaki komuta veya bağlılık ilişkisini doğrulayan kaydı görmeden bunu gerçek kabul edemem.'
    };
    if (focus === 'UNVERIFIED_MILITARY_REPORT') return {
        discourseAct: 'ACKNOWLEDGE_UNVERIFIED_MILITARY_REPORT',
        text: latestThreat
            ? `${latestThreat.regionNames.join(' ve ')} çevresinde düşman gücü gördüğünü bildiriyorsun. Bunu istihbarat değil, henüz doğrulanmamış oyuncu raporu olarak kaydedeceğim.`
            : 'Bir düşman gücü gördüğünü bildiriyorsun. Konum ve kaynak doğrulanmadığı için bunu henüz doğrulanmamış oyuncu raporu olarak değerlendireceğim.'
    };
    if (analysis.speechAct === 'REPORT_MILITARY' && latestThreat) return {
        discourseAct: 'ACKNOWLEDGE_UNVERIFIED_MILITARY_REPORT',
        text: `${latestThreat.regionNames.join(' ve ')} çevresinde düşman gücü gördüğünü bildiriyorsun. Bunu doğrulanmış istihbarat değil, kaynağı sınanması gereken oyuncu raporu olarak tutacağım.`
    };
    if (focus === 'LISTENER_IDENTITY') return {
        discourseAct: 'ANSWER_LISTENER_IDENTITY',
        text: `Ben ${actor && actor.name || 'kimliği doğrulanmamış muhatap'}; doğrulanmış görevim ${actorRoleLabel}.`
    };
    if (focus === 'LISTENER_IDENTITY_CLAIM') return {
        discourseAct: 'ANSWER_LISTENER_IDENTITY',
        text: `Hayır. Kimlik kaydımda adım ${actor && actor.name || 'doğrulanmamış'}; görevim ${actorRoleLabel}.`
    };
    if (focus === 'PLAYER_LOCATION') return {
        discourseAct: 'ANSWER_PLAYER_REPORTED_LOCATION',
        text: latestLocation
            ? `${latestLocation.regionName} bölgesinde olduğunu söyledin; bunu bağımsız olarak doğrulayamıyorum.`
            : 'Nerede olduğunu gösteren doğrulanmış bir bilgim yok.'
    };
    if (focus === 'LISTENER_LOCATION') return {
        discourseAct: 'ANSWER_LISTENER_LOCATION_UNKNOWN',
        text: 'Bulunduğum şehri doğrulayan güncel bir konum kaydım yok; şehir adı uydurmayacağım.'
    };
    if (focus === 'LISTENER_ROLE') return {
        discourseAct: 'ANSWER_LISTENER_ROLE',
        text: `Ben ${actor && actor.name || 'muhatabın'}; doğrulanmış görevim ${actorRoleLabel}.`
    };
    if (focus === 'LISTENER_ROLE_CONFIRMATION') return {
        discourseAct: 'CONFIRM_LISTENER_ROLE',
        text: `Evet; kimlik kaydımda görevim ${actorRoleLabel}. Bunun dışındaki bir makamı üstlenmiş gibi konuşmayacağım.`
    };
    if (focus === 'LISTENER_ROLE_ADDRESS') return {
        discourseAct: 'ANSWER_LISTENER_ROLE',
        text: `Bana görevimle hitap ediyorsun. Kimlik kaydımda görevim ${actorRoleLabel}; bunun ötesinde bir unvanı sahiplenmeyeceğim.`
    };
    if (focus === 'ROLE_CONTRADICTION_REPAIR') return {
        discourseAct: 'REPAIR_ROLE_CONTRADICTION',
        text: `Haklısın; ${actorRoleLabel} ile şirket yöneticiliği aynı görev değildir. Kimlik kaydımda şirket bağı yoksa şirket yöneticisi gibi konuşmam hataydı.`
    };
    if (focus === 'LISTENER_ORGANIZATION') return {
        discourseAct: 'ANSWER_LISTENER_ORGANIZATION',
        text: actor && actor.organizationId
            ? `Bağlı olduğum doğrulanmış kuruluş ${actor.organizationId}; görünen adını doğrulayacak açık kaydım yok.`
            : `Bir şirkete bağlı olduğumu gösteren doğrulanmış kuruluş kaydım yok; ${actorRoleLabel} olarak görev yapıyorum.`
    };
    if (focus === 'LISTENER_COMPANY_FINANCE') return {
        discourseAct: 'ANSWER_COMPANY_FINANCE_BOUNDARY',
        text: actor && actor.organizationId
            ? 'Bağlı olduğum kuruluşun güncel bilançosunu doğrulayan şirket kaydı bu görüşmeye açılmadı; ülke ekonomisi verisini şirket finansmanıymış gibi sunmayacağım.'
            : `Kimlik kaydımda doğrulanmış bir şirket bağı yok; ${actorRoleLabel} olarak ülke göstergelerini şirket bilançosu diye aktarmayacağım.`
    };
    if (focus === 'CURRENT_MEETING_RESULTS') return {
        discourseAct: 'ANSWER_MEETING_RESULTS_BOUNDARY',
        text: 'Bu görüşmede doğrulanmış bir toplantı kararı veya sonuç kaydı oluşmadı. Önceki konuşmayı resmî karar ya da tamamlanmış toplantı sonucu gibi sunmayacağım.'
    };
    if (focus === 'CURRENT_MEETING_AGENDA') return {
        discourseAct: 'ANSWER_MEETING_AGENDA_BOUNDARY',
        text: 'Bu görüşmeye bağlı doğrulanmış bir toplantı gündemi yok. Buradaki konuşma başlıklarını resmî gündemmiş gibi uydurmayacağım.'
    };
    if (focus === 'CURRENT_MEETING_PARTICIPANTS') return {
        discourseAct: 'ANSWER_MEETING_PARTICIPANTS_BOUNDARY',
        text: 'Bu görüşmeye bağlı doğrulanmış bir katılımcı listesi yok. Buradaki karakterleri resmî toplantı katılımcısıymış gibi göstermeyeceğim.'
    };
    if (focus === 'RELATIONSHIP_KNOWLEDGE') return {
        discourseAct: 'ANSWER_RELATIONSHIP_KNOWLEDGE_BOUNDARY',
        text: 'Seni yalnız bu görüşmede söylediklerin ve bana açık olan kayıtlar kadar tanıyorum; ortak geçmiş veya proje uydurmayacağım.'
    };
    if (focus === 'UNVERIFIED_PERSONAL_JUDGMENT') return {
        discourseAct: 'QUALIFY_PERSONAL_JUDGMENT',
        text: '“Bencil” bir yorumdur, doğrulanmış gerçek değil. Görüş bildirmem için hangi karar veya davranışı değerlendirdiğini söylemelisin.'
    };
    if (focus === 'QUESTIONING_STYLE_CHALLENGE') return {
        discourseAct: 'ANSWER_QUESTIONING_STYLE_CHALLENGE',
        text: 'Haklısın; sürekli sana soru yöneltmek konuşmayı sorguya çeviriyor. Bildiğim konuda cevap verecek, bilmediğim yerde belirsizliği açık söyleyeceğim.'
    };
    if (focus === 'PLAYER_INSULT_OR_BOUNDARY') return {
        discourseAct: 'ANSWER_PLAYER_BOUNDARY',
        text: 'Üslubundaki itirazı anladım. Aynı soruyu tekrarlamak yerine nerede koptuğumu açıkça söyleyeceğim.'
    };
    if (focus === 'ADDRESS_ETIQUETTE') return {
        discourseAct: 'ANSWER_ADDRESS_ETIQUETTE',
        text: `Hitap tercihimi gösteren doğrulanmış bir kayıt yok. Bana ${actor && actor.name || 'adımla'} diye seslenmen güvenli; hakarete uğradığımı uydurmayacağım.`
    };
    if (focus === 'FALLBACK_PHRASE_CHALLENGE') return {
        discourseAct: 'EXPLAIN_FALLBACK_FAILURE',
        text: 'O ifade gerçek bir cevap değildi; sözünü anlayamadığımda kullandığım yetersiz bir kalıptı. Tekrar etmeyeceğim.'
    };
    if (focus === 'CURRENT_ASSIGNMENT') return {
        discourseAct: 'ANSWER_CURRENT_ASSIGNMENT_BOUNDARY',
        text: `Doğrulanmış görevim ${actorRoleLabel}; bunun dışında yürüttüğüm somut bir iş veya cephe görevi kaydı burada görünmüyor. Önceki cevabım böyle bir görev varmış izlenimi verdiyse o kısmı geri çekiyorum.`
    };
    if (focus === 'REQUEST_JOB_REFERRAL') return {
        discourseAct: 'ANSWER_JOB_REFERRAL_BOUNDARY',
        text: 'Sana iş vereceğini doğrulayabildiğim bir tanıdık kaydım yok. Bir isim uydurup seni yanlış kapıya göndermeyeceğim.'
    };
    if (focus === 'JOB_FRUSTRATION') return {
        discourseAct: 'ACKNOWLEDGE_JOB_FRUSTRATION',
        text: 'Görev bulamamanın seni öfkelendirdiğini anlıyorum. Fakat sırf bu yüzden olmayan bir görev yaratamam; gerçek bir ihtiyaç ve yetkili kişi oluştuğunda bunun kaydı görünmeli.'
    };
    if (focus === 'REQUEST_CHARACTER_NEED') return {
        discourseAct: 'ANSWER_CHARACTER_NEED_BOUNDARY',
        text: 'Şu anda senden isteyebileceğim doğrulanmış bir ihtiyaç veya açık görev kaydım yok. Varmış gibi davranmayacağım.'
    };
    if (focus === 'REQUEST_JOB_OR_TASK') return {
        discourseAct: 'ANSWER_JOB_REQUEST_BOUNDARY',
        text: 'Şu anda sana verebileceğim doğrulanmış bir görev veya iş kaydı yok. Konuşma sürsün diye görev uydurmayacağım; gerçek bir ihtiyaç oluşursa kaynağı ve yetkisiyle görünmeli.'
    };
    if (analysis.speechAct === 'SHARE_SECRET' && !latestThreat) return {
        discourseAct: 'ASK_SECRET_SCOPE_WITHOUT_PROMISE',
        text: 'Bir sır paylaşmak istediğini anlıyorum; fakat içeriğini henüz söylemedin. Dinleyebilirim, ancak ne olduğunu bilmeden koşulsuz gizlilik sözü veremem.'
    };
    if (analysis.speechAct === 'SHARE_SECRET' && latestThreat) return {
        discourseAct: 'RECORD_CONFIDENTIALITY_REQUEST_FOR_REPORT',
        text: `Önceki askerî raporun için gizlilik istediğini kaydettim. Bunun aramızda kalacağını koşulsuz vaat edemem; görev ve güvenlik zorunluluğu doğarsa paylaşım sınırı ayrıca değerlendirilir.`,
        confidentialityRequest: {
            status: 'REQUEST_RECORDED_NOT_GUARANTEED',
            claimIds: [latestThreat.id].filter(Boolean)
        }
    };
    if (focus === 'UNVERIFIED_ENERGY_REPORT') return {
        discourseAct: 'ACKNOWLEDGE_UNVERIFIED_SECTOR_REPORT',
        text: 'Enerji alanında sıkıntı duyduğunu söylüyorsun; bunu doğrulanmış durum olarak kabul edemem. Hangi bölgeyi, kurumu veya gözlenebilir kesintiyi kastettiğini ayırırsan iddiayı sınayabiliriz.'
    };
    if (focus === 'RELATIONSHIP_PERCEPTION') return {
        discourseAct: 'QUALIFY_RELATIONSHIP_PERCEPTION',
        text: 'Benden çekindiğimi hissetmen senin yorumun; bunu gerçek diye onaylamayacağım. Mesafeli konuşmam görevimden veya aramızdaki güven düzeyinden kaynaklanabilir.'
    };
    if (focus === 'RELATIONSHIP_NEGATIVE_STATEMENT') return {
        discourseAct: 'ACKNOWLEDGE_RELATIONSHIP_STANCE',
        text: 'Bana güvenmediğini ve aramızdaki ilişkinin kötü olduğunu söylüyorsun. Bunu görmezden gelmeyeceğim; güven sözle değil, sonraki davranışlarımızla değişir.'
    };
    if (focus === 'CURRENT_TECHNOLOGY_BOUNDARY') return {
        discourseAct: 'ANSWER_CURRENT_TECHNOLOGY_BOUNDARY',
        text: 'Üzerinde çalıştığım doğrulanmış bir teknoloji projesi kaydı burada görünmüyor. Şirket unvanım var diye yürütülmeyen bir projeyi varmış gibi anlatmayacağım.'
    };
    if (focus === 'REQUEST_EXPLANATION') return {
        discourseAct: 'REPAIR_MISUNDERSTANDING',
        text: 'Önceki cevabım açık değildi. Hangi cümleyi açıklamam gerektiğini tek başlıkla işaret edersen, bildiğim kısmı söyleyip bilmediğim kısmı ayıracağım.'
    };
    if (focus === 'DEMAND_ANSWER') return {
        discourseAct: 'REPAIR_MISSING_ANSWER',
        text: 'Haklısın; önceki yanıt sorunu karşılamadı. Son somut sorunu yeniden yaz; bu kez cevap, belirsizlik veya yetki sınırından hangisinin geçerli olduğunu doğrudan söyleyeceğim.'
    };
    if (focus === 'ACKNOWLEDGE') return {
        discourseAct: 'ACKNOWLEDGE_AND_HOLD_CONTEXT',
        text: 'Peki. Önceki bağlamı koruyorum; yeni bir konu açarsan onu ayrıca ele alırım.'
    };
    if (focus === 'PUBLIC_PRIORITIES') return {
        discourseAct: 'ANSWER_PUBLIC_PRIORITIES_WITH_AUTHORITY_BOUNDARY',
        text: 'Halka dönük somut bir hizmet sözü vermeden önce yetkimi ve doğrulanmış kamu ihtiyacını görmem gerekir. Genel refah sözü tek başına bir plan değildir.'
    };
    if (focus === 'REPETITION_REPAIR') return {
        discourseAct: 'REPAIR_REPETITION',
        text: 'Haklısın; önceki cevabı tekrarladım. Son sorunu doğrudan ve yeni bilgi uydurmadan yeniden sor.'
    };
    if (analysis.playerIntent === 'REQUEST_MILITARY_SUPPORT') return {
        discourseAct: 'ASSESS_UNVERIFIED_MILITARY_REQUEST',
        text: latestThreat
            ? `${latestThreat.regionNames.join(' ve ')} çevresinde düşman yoğunlaşması bildirdin; bu henüz doğrulanmış istihbarat değil. Kuvvet hareketi için önce tehdidin ve yetkinin doğrulanması gerekir.`
            : 'Askerî destek istediğini anlıyorum; ancak tehdit ve konum doğrulanmadan kuvvet hareketi sözü veremem.'
    };
    if (analysis.speechAct === 'REQUEST_SUPPORT' && latestThreat) return {
        discourseAct: 'CONTINUE_MILITARY_SUPPORT_REQUEST',
        text: 'Önceki askerî yardım talebini kastediyorsan, bildirdiğin tehdit hâlâ doğrulanmadı; hangi desteği istediğini ve kanıtını ayırarak söyle.'
    };
    if (['FOUND_COMPANY', 'FOUND_STEEL_COMPANY'].includes(analysis.playerIntent)) {
        const mentionedRegions = storyConversationResolveRegions(folded);
        const resource = (analysis.entities || []).find(row => row.role === 'COMMODITY');
        return {
            discourseAct: 'ACKNOWLEDGE_COMPANY_FOUNDING_INTENT',
            text: `${mentionedRegions[0] ? `${mentionedRegions[0].name} bölgesinde ` : ''}`
                + `${resource && resource.mention ? `${resource.mention} alanında ` : ''}`
                + 'şirket veya tesis kurmak istediğini anlıyorum. Bu konuşma tek başına şirket kurmaz; bütçe, sahiplik, izin ve fiziksel kapasite gerçek defterlerden incelenmelidir.'
        };
    }
    if (latestBudget && storyConversationContains(folded, ['dinar', 'butcem', 'butce', 'param', 'sermayem'])) return {
        discourseAct: 'ACKNOWLEDGE_UNVERIFIED_BUDGET',
        text: `${latestBudget.amountText} ${latestBudget.currencyText} bütçen olduğunu söylüyorsun; bunu doğrulanmış bakiye sayamam. Projenin gerçek maliyetini ve yetkili şirket kuruluş yolunu ayrıca incelemek gerekir.`
    };
    if (analysis.speechAct === 'REQUEST_SUPPORT') return {
        discourseAct: 'CONTINUE_REQUEST',
        text: 'Yardım talebini anlıyorum; hangi desteği, hangi amaçla istediğini ve yetki sınırımı etkileyen koşulları açıkça ayırmalısın. Bunlar doğrulanmadan yardım sözü veremem.'
    };
    if (analysis.speechAct === 'REQUEST_ACTION') return {
        discourseAct: 'ASSESS_ACTION_REQUEST_SCOPE',
        text: 'Bir eylem başlatmamı veya desteklememi istediğini anlıyorum. Bu konuşma tek başına uygulama emri değildir; hedef, yetki, kaynak ve bedel mekanik kayıtlarda doğrulanmadan sonuç sözü veremem.'
    };
    if (analysis.speechAct === 'UNKNOWN') return {
        discourseAct: 'CLARIFY_UNKNOWN_WITHOUT_FAKE_CONTINUITY',
        text: 'Bu sözündeki amacı güvenle çıkaramadım. Önceki cevabı tekrarlamak veya boşluğu uydurmak yerine bunu açıkça söylüyorum.'
    };
    return null;
}

function storyConversationDiagnosticAppend(session, response, playerText, eventType, sequence) {
    try {
        if (!session || !response || !playerText || !response.text
            || typeof window === 'undefined' || !window.PIXEL || !window.PIXEL.diagnostics
            || typeof window.PIXEL.diagnostics.appendStoryDialogue !== 'function') return false;
        const actor = typeof storyCharacterIdentityView === 'function'
            ? storyCharacterIdentityView(session.listenerActorId) : null;
        const entry = {
            eventType: eventType || 'TURN_CREATED',
            gameClock: Number(STORY.clock) || 0,
            sessionId: session.id,
            responseId: response.id,
            turnSequence: Number(sequence) || 0,
            listener: {
                actorId: session.listenerActorId,
                name: actor && actor.name || '',
                role: actor && actor.role || ''
            },
            playerText: String(playerText),
            characterText: String(response.text),
            speechAct: response.speechAct || session.analysis && session.analysis.speechAct || '',
            discourseAct: response.discourseAct || '',
            dialogueMoveId: response.dialogueMove && response.dialogueMove.moveId || '',
            llmValidationCode: response.llmValidationCode || '',
            source: response.source || '',
            enrichmentStatus: response.enrichmentStatus || '',
            llmUsed: response.llmUsed === true
        };
        Promise.resolve(window.PIXEL.diagnostics.appendStoryDialogue(entry)).catch(() => {});
        return true;
    } catch (_) { return false; }
}

function storyConversationSessionSemanticHistory(session, sequence) {
    const rows = [];
    if (sequence > 0) {
        rows.push({ speaker: 'PLAYER', text: session.initialText });
        const opening = (session.listenerResponses || []).find(row => row.kind === 'SOCIAL_RESPONSE');
        if (opening) rows.push({ speaker: 'CHARACTER', text: opening.text });
    }
    for (const turn of (session.followUps || [])) {
        if (Number(turn.sequence) >= Number(sequence)) break;
        rows.push({ speaker: 'PLAYER', text: turn.playerText });
        if (turn.response) rows.push({ speaker: 'CHARACTER', text: turn.response.text });
    }
    return rows.slice(-6);
}

function storyConversationSessionApplySemanticFrame(analysis, frame) {
    const result = storyConversationClone(analysis);
    result.semanticFrame = storyConversationClone(frame);
    result.speechAct = frame.suggestedSpeechAct;
    result.secondaryActs = Array.from(new Set([analysis.speechAct]
        .concat(analysis.secondaryActs || []).filter(act => act && act !== 'UNKNOWN'
            && act !== frame.suggestedSpeechAct))).slice(0, 3);
    result.source = 'LOCAL_LLM_SEMANTIC_INTERPRETATION';
    result.topic = ['RELATIONSHIP', 'EMOTION'].includes(frame.predicate) ? 'RELATIONSHIP'
        : frame.predicate === 'MILITARY' ? 'MILITARY'
            : frame.predicate === 'ECONOMY' ? 'ECONOMY'
                : frame.predicate === 'TECHNOLOGY' ? 'TECHNOLOGY'
                    : ['IDENTITY', 'HEALTH', 'LOCATION'].includes(frame.predicate) ? 'INFORMATION'
                        : ['GREET', 'THANK', 'APOLOGIZE', 'CLOSE'].includes(frame.communicativeFunction)
                            ? 'SOCIAL' : result.topic;
    result.playerIntent = STORY_CONVERSATION_SOCIAL_ACTS.includes(result.speechAct)
        ? `SOCIAL_${result.speechAct}` : result.playerIntent;
    result.worldMutation = false;
    result.proposedCommand = null;
    result.diagnostics = Object.assign({}, result.diagnostics || {}, {
        semanticModelUsed: true,
        semanticModelSource: frame.source,
        semanticModelEvidenceSpanCount: frame.evidence && frame.evidence.modelSpans
            ? frame.evidence.modelSpans.length : 0
    });
    return result;
}

function storyConversationSessionSemanticFallbackText(analysis, frame) {
    if (analysis.speechAct === 'REPORT_MILITARY') {
        return 'Bunu askerî bir bildirim olarak anladım. Söylediğini kayda alabilirim; doğrulanmış istihbarat sayamam.';
    }
    if (analysis.speechAct === 'REPORT_ECONOMIC') {
        return 'Bunu ekonomik durum hakkında bir bildirim olarak anladım. Kanıtlanmış kayıtla oyuncu beyanını birbirine karıştırmayacağım.';
    }
    if (analysis.speechAct === 'REQUEST_ACTION' || analysis.speechAct === 'REQUEST_SUPPORT') {
        return 'Benden bir eylem veya destek istediğini anladım. Gerçek bir görev, kaynak ve yetki kaydı olmadan yapabileceğimi söyleyemem.';
    }
    if (analysis.speechAct === 'ASK_RELATIONSHIP') {
        return 'Sorunun aramızdaki ilişki ve duygusal tutumla ilgili olduğunu anladım. Bildiğim ilişki kaydının ötesinde iç durum uydurmayacağım.';
    }
    if (analysis.speechAct === 'ASK_INFORMATION') {
        return 'Bunu bir bilgi sorusu olarak anladım. Doğrulanmış kaydım olmayan ayrıntıyı cevap diye uydurmayacağım.';
    }
    if (analysis.speechAct === 'SHARE_SECRET') {
        return 'Gizli bir bilgi paylaşmak istediğini anladım. İçeriği duymadan gizlilik veya sonuç sözü veremem.';
    }
    return frame && frame.predicate !== 'UNSPECIFIED'
        ? `${frame.predicate.toLocaleLowerCase('tr-TR')} konusundaki sözünü anladım; doğrulanmamış ayrıntı eklemeyeceğim.`
        : 'Sözünün iletişim amacını kısmen anladım; bilmediğim ayrıntıyı tamamlamayacağım.';
}

function storyConversationSessionRebuildDiscourse(session) {
    if (typeof storyDiscourseStateCreate !== 'function') return;
    let state = storyDiscourseStateCreate(session.id, session.analysis);
    if (typeof storyDiscourseStateApply === 'function') {
        for (const turn of (session.followUps || [])) state = storyDiscourseStateApply(state, {
            turnId: `conversation-turn:${session.id}:${turn.sequence}`,
            playerText: turn.playerText, analysis: turn.analysis, response: turn.response
        });
    }
    session.discourseState = state;
}

function storyConversationSessionQueueSemanticLLM(sessionId, responseId, playerText) {
    if (typeof storyConversationSemanticFrameNeedsModel !== 'function'
        || typeof storyConversationSemanticFrameModelPrompt !== 'function'
        || typeof storyConversationSemanticFrameModelParse !== 'function'
        || typeof llmEnsure !== 'function' || typeof llmEnrich !== 'function'
        || typeof llmBridge !== 'function' || !llmBridge()) return false;
    const session = storyConversationSessionFind(sessionId);
    if (!session) return false;
    const followUp = (session.followUps || []).find(row => row.response && row.response.id === responseId);
    const sequence = followUp ? Number(followUp.sequence) || 0 : 0;
    const analysis = followUp ? followUp.analysis : session.analysis;
    if (!storyConversationSemanticFrameNeedsModel(analysis)) return false;
    const response = (session.listenerResponses || []).find(row => row.id === responseId);
    if (!response) return false;
    const mirrorResponse = (current, source) => {
        const turn = (current.followUps || []).find(row => row.response && row.response.id === responseId);
        if (turn) turn.response = storyConversationClone(source);
    };
    STORY_CONVERSATION_LLM_PENDING.add(responseId);
    response.enrichmentStatus = 'MODEL_LOADING';
    response.semanticInterpretationStatus = 'MODEL_LOADING';
    mirrorResponse(session, response);
    if (typeof storyConversationWorkspacePatchResponse === 'function') {
        storyConversationWorkspacePatchResponse(response.id, response.text, response.enrichmentStatus);
    }
    const history = storyConversationSessionSemanticHistory(session, sequence);
    Promise.resolve(llmEnsure()).then(state => {
        const current = storyConversationSessionFind(sessionId);
        const currentResponse = current && (current.listenerResponses || []).find(row => row.id === responseId);
        if (!currentResponse) return null;
        if (!state || !state.ready) return null;
        currentResponse.enrichmentStatus = 'GENERATING';
        currentResponse.semanticInterpretationStatus = 'GENERATING';
        mirrorResponse(current, currentResponse);
        if (typeof storyConversationWorkspacePatchResponse === 'function') {
            storyConversationWorkspacePatchResponse(currentResponse.id, currentResponse.text,
                currentResponse.enrichmentStatus);
        }
        return llmEnrich(
            'Türkçe oyuncu sözünü yanıtlamadan kapalı semantik alanlara ayıran bir yorumlayıcısın.',
            storyConversationSemanticFrameModelPrompt(playerText, { history }),
            raw => storyConversationSemanticFrameModelParse(raw, playerText),
            { maxTokens: 420, temperature: 0.1, priority: 120,
                contextLimit: 8192, contextWrapperReserveTokens: 128,
                jsonSchema: storyConversationSemanticFrameModelSchema() }
        );
    }).then(frame => {
        STORY_CONVERSATION_LLM_PENDING.delete(responseId);
        const current = storyConversationSessionFind(sessionId);
        const liveResponse = current && (current.listenerResponses || []).find(row => row.id === responseId);
        if (!current || !liveResponse) return;
        const liveTurn = (current.followUps || []).find(row => row.response && row.response.id === responseId);
        if (!frame) {
            liveResponse.enrichmentStatus = 'FALLBACK_KEPT';
            liveResponse.semanticInterpretationStatus = 'REJECTED_OR_UNAVAILABLE';
            liveResponse.llmUsed = false;
            mirrorResponse(current, liveResponse);
        } else {
            const previousSession = storyConversationClone(current);
            const oldAnalysis = liveTurn ? liveTurn.analysis : current.analysis;
            const nextAnalysis = storyConversationSessionApplySemanticFrame(oldAnalysis, frame);
            if (liveTurn) liveTurn.analysis = storyConversationClone(nextAnalysis);
            else current.analysis = storyConversationClone(nextAnalysis);
            const grounded = storyConversationGroundedFollowUp(current, nextAnalysis, playerText, sequence);
            const social = grounded ? null
                : storyConversationSocialResponseText(current, nextAnalysis.speechAct, sequence, playerText);
            liveResponse.speechAct = nextAnalysis.speechAct;
            liveResponse.text = grounded ? grounded.text : social ? social.text
                : storyConversationSessionSemanticFallbackText(nextAnalysis, frame);
            liveResponse.source = grounded ? 'DETERMINISTIC_GROUNDED_DISCOURSE_RESPONSE'
                : 'DETERMINISTIC_SEMANTIC_FRAME_RESPONSE';
            liveResponse.discourseAct = grounded && grounded.discourseAct || 'SEMANTIC_FRAME_INTERPRETED';
            liveResponse.confidentialityRequest = grounded && grounded.confidentialityRequest || null;
            liveResponse.enrichmentStatus = 'SEMANTIC_INTERPRETED';
            liveResponse.semanticInterpretationStatus = 'USED';
            liveResponse.semanticFrame = storyConversationClone(frame);
            liveResponse.semanticLlmUsed = true;
            liveResponse.llmUsed = false;
            storyConversationSessionAttachDecisionContracts(current, liveResponse, nextAnalysis,
                sequence, storyConversationSessionUnverifiedClaims(current));
            mirrorResponse(current, liveResponse);
            storyConversationSessionRebuildDiscourse(current);
            current.candidate = storyConversationSessionCandidate(current);
            current.updatedAt = Number(STORY.clock) || 0;
            const ledgerValidation = storyConversationSessionValidateLedger(STORY.conversationUnderstanding);
            if (!ledgerValidation.ok) {
                const sessionIndex = STORY.conversationUnderstanding.sessions.findIndex(row => row.id === sessionId);
                if (sessionIndex >= 0) STORY.conversationUnderstanding.sessions[sessionIndex] = previousSession;
                const rolledBack = sessionIndex >= 0
                    ? STORY.conversationUnderstanding.sessions[sessionIndex] : null;
                const rolledBackResponse = rolledBack && (rolledBack.listenerResponses || [])
                    .find(row => row.id === responseId);
                if (rolledBackResponse) {
                    rolledBackResponse.enrichmentStatus = 'FALLBACK_KEPT';
                    rolledBackResponse.semanticInterpretationStatus = 'LEDGER_VALIDATION_FAILED';
                    rolledBackResponse.semanticInterpretationIssues = ledgerValidation.issues.slice(0, 8);
                    mirrorResponse(rolledBack, rolledBackResponse);
                }
                if (typeof storyConversationWorkspaceResponseSettled === 'function') {
                    storyConversationWorkspaceResponseSettled(responseId);
                }
                return;
            }
            storyConversationDiagnosticAppend(current, liveResponse, playerText,
                'SEMANTIC_INTERPRETATION_APPLIED', sequence);
            if (typeof storySave === 'function') storySave();
        }
        if (typeof storyConversationWorkspacePatchResponse === 'function') {
            storyConversationWorkspacePatchResponse(liveResponse.id, liveResponse.text,
                liveResponse.enrichmentStatus);
        }
        if (typeof storyConversationWorkspaceResponseSettled === 'function') {
            storyConversationWorkspaceResponseSettled(liveResponse.id);
        }
    }).catch(() => {
        STORY_CONVERSATION_LLM_PENDING.delete(responseId);
        const current = storyConversationSessionFind(sessionId);
        const liveResponse = current && (current.listenerResponses || []).find(row => row.id === responseId);
        if (!liveResponse) return;
        liveResponse.enrichmentStatus = 'FALLBACK_KEPT';
        liveResponse.semanticInterpretationStatus = 'ERROR';
        mirrorResponse(current, liveResponse);
        if (typeof storyConversationWorkspacePatchResponse === 'function') {
            storyConversationWorkspacePatchResponse(liveResponse.id, liveResponse.text,
                liveResponse.enrichmentStatus);
        }
        if (typeof storyConversationWorkspaceResponseSettled === 'function') {
            storyConversationWorkspaceResponseSettled(liveResponse.id);
        }
    });
    return true;
}

function storyConversationSessionQueueSocialLLM(sessionId, responseId, playerText) {
    if (typeof llmEnsure !== 'function' || typeof llmEnrich !== 'function'
        || typeof llmBridge !== 'function' || !llmBridge()) return false;
    const session = storyConversationSessionFind(sessionId);
    if (!session) return false;
    const findResponse = current => (current.listenerResponses || []).find(row => row.id === responseId);
    const mirrorResponse = (current, source) => {
        const followUp = (current.followUps || []).find(row => row.response && row.response.id === responseId);
        if (followUp) followUp.response = storyConversationClone(source);
    };
    const response = findResponse(session);
    if (!response) return false;
    // UNKNOWN anlam, kanıtsız bilgi sorusu ve kanıt-temelli söylem LLM'e
    // verilmez. Model güvenli anlam boşluğunu şehir/şirket/geçmiş uydurarak
    // dolduramaz; önce deterministik anlam katmanı güvenilir bir çekirdek kurar.
    if (response.speechAct === 'UNKNOWN'
        || ['DETERMINISTIC_GROUNDED_DISCOURSE_RESPONSE',
            'DETERMINISTIC_VERIFIED_FACT_RESPONSE'].includes(response.source)) {
        response.enrichmentStatus = 'NOT_REQUIRED';
        response.llmUsed = false;
        mirrorResponse(session, response);
        return false;
    }
    STORY_CONVERSATION_LLM_PENDING.add(responseId);
    response.enrichmentStatus = 'MODEL_LOADING';
    mirrorResponse(session, response);
    if (typeof storyConversationWorkspacePatchResponse === 'function') {
        storyConversationWorkspacePatchResponse(response.id, response.text, response.enrichmentStatus);
    }
    Promise.resolve(llmEnsure()).then(state => {
        const current = storyConversationSessionFind(sessionId);
        const currentResponse = current && findResponse(current);
        if (!currentResponse) return null;
        if (!state || !state.ready) {
            STORY_CONVERSATION_LLM_PENDING.delete(responseId);
            currentResponse.enrichmentStatus = 'FALLBACK_KEPT';
            mirrorResponse(current, currentResponse);
            if (typeof storyConversationWorkspaceResponseSettled === 'function') {
                storyConversationWorkspaceResponseSettled(currentResponse.id);
            }
            return null;
        }
        currentResponse.enrichmentStatus = 'GENERATING';
        mirrorResponse(current, currentResponse);
        if (typeof storyConversationWorkspacePatchResponse === 'function') {
            storyConversationWorkspacePatchResponse(currentResponse.id,
                currentResponse.text, currentResponse.enrichmentStatus);
        }
        const fallbackText = currentResponse.text;
        const validationContext = storyConversationSessionValidationContext(current, currentResponse);
        const preserveGroundedMeaning = currentResponse.source === 'DETERMINISTIC_GROUNDED_DISCOURSE_RESPONSE';
        let validationDiagnosis = null;
        return llmEnrich(
            'Modern bir strateji oyunundaki karakter olarak Türkçe konuş. Yalnız verilen bağlamı kullan.',
            storyConversationSocialLLMPrompt(current, currentResponse, playerText),
            raw => {
                if (preserveGroundedMeaning) return null;
                validationDiagnosis = storyConversationSocialLLMDiagnose(
                    raw, fallbackText, playerText, validationContext);
                return validationDiagnosis.ok
                    ? storyConversationSocialLLMParse(raw, fallbackText, playerText, validationContext)
                    : null;
            },
            { maxTokens: 300, temperature: 0.35, priority: 100,
                contextLimit: 8192, contextWrapperReserveTokens: 128,
                contextMaxRebuilds: 2,
                contextRebuildPrompt: budget => storyConversationSocialLLMPromptWithBudget(
                    current, currentResponse, playerText, budget.availableInputTokens * budget.scale),
                jsonSchema: storyConversationSocialLLMSchema(currentResponse.dialogueMove) }
        ).then(text => {
            STORY_CONVERSATION_LLM_PENDING.delete(responseId);
            const live = storyConversationSessionFind(sessionId);
            const liveResponse = live && findResponse(live);
            if (!liveResponse) return;
            if (text) {
                liveResponse.text = text;
                liveResponse.source = 'LOCAL_LLM_CHARACTER_REALIZATION';
                liveResponse.enrichmentStatus = 'USED';
                liveResponse.llmUsed = true;
                liveResponse.llmValidationCode = validationDiagnosis && validationDiagnosis.code || 'ACCEPTED';
            } else {
                liveResponse.enrichmentStatus = 'FALLBACK_KEPT';
                liveResponse.llmUsed = false;
                liveResponse.llmValidationCode = validationDiagnosis && validationDiagnosis.code
                    || 'NO_VALIDATED_OUTPUT';
            }
            mirrorResponse(live, liveResponse);
            storyConversationDiagnosticAppend(live, liveResponse, playerText, 'RESPONSE_ENRICHED',
                (live.followUps || []).find(row => row.response && row.response.id === liveResponse.id)?.sequence || 0);
            if (typeof storySave === 'function') storySave();
            if (typeof storyConversationWorkspacePatchResponse === 'function') {
                storyConversationWorkspacePatchResponse(liveResponse.id, liveResponse.text, liveResponse.enrichmentStatus);
            }
            if (typeof storyConversationWorkspaceResponseSettled === 'function') {
                storyConversationWorkspaceResponseSettled(liveResponse.id);
            }
        });
    }).catch(() => {
        STORY_CONVERSATION_LLM_PENDING.delete(responseId);
        const current = storyConversationSessionFind(sessionId);
        const currentResponse = current && findResponse(current);
        if (currentResponse) {
            currentResponse.enrichmentStatus = 'FALLBACK_KEPT';
            mirrorResponse(current, currentResponse);
            if (typeof storyConversationWorkspaceResponseSettled === 'function') {
                storyConversationWorkspaceResponseSettled(currentResponse.id);
            }
        }
    });
    return true;
}

function storyConversationSessionDomainEvidence(session, response, analysis, inheritedClaims) {
    if (typeof storyConversationDomainBuild !== 'function') return null;
    const roleView = typeof storyCharacterRoleAdapterView === 'function'
        ? storyCharacterRoleAdapterView(session.listenerActorId) : null;
    const memoryRefs = response && response.memoryRecall && response.memoryRecall.records
        ? response.memoryRecall.records.map(row => row.id) : [];
    const preservedFacts = response && response.domainEvidence
        && Array.isArray(response.domainEvidence.factRecords)
        ? response.domainEvidence.factRecords : [];
    const facts = preservedFacts.length ? preservedFacts
        : (typeof storyConversationDomainProjectFacts === 'function'
            ? storyConversationDomainProjectFacts(session.listenerActorId, analysis, roleView, {
                playerActorId: session.playerActorId
            }) : []);
    return storyConversationDomainBuild({
        analysis, inheritedClaims, roleView, memoryRefs,
        factRefs: facts.map(row => row.id), factRecords: facts
    });
}

function storyConversationSessionGroundedFactFallback(session, response, analysis) {
    if (!response || !response.domainEvidence || response.discourseAct
        || !['ASK_INFORMATION', 'ASK_RELATIONSHIP'].includes(analysis.speechAct)) return false;
    const facts = (response.domainEvidence.factRefs || []).map(ref =>
        typeof storyConversationDomainFactResolve === 'function'
            ? storyConversationDomainFactResolve(ref, session.listenerActorId, response.domainEvidence) : null).filter(Boolean);
    if (!facts.length) return false;
    const signals = new Set(analysis.diagnostics && analysis.diagnostics.economicSignals || []);
    const priority = signals.has('BUDGET') ? ['budget', 'inflation', 'welfare', 'resources']
        : signals.has('RESOURCES') ? ['resources', 'budget', 'inflation', 'welfare']
            : signals.has('WELFARE') ? ['welfare', 'inflation', 'budget', 'resources']
                : ['inflation', 'welfare', 'budget', 'resources'];
    const selected = analysis.speechAct === 'ASK_RELATIONSHIP'
        ? facts.filter(row => ['directionalRelationship',
            'directionalRelationshipStatus'].includes(row.field)).slice(0, 1)
        : priority.map(field => facts.find(row => row.field === field)).filter(Boolean).slice(0, 2);
    if (!selected.length) return false;
    response.text = `Doğrulanmış kayda göre ${selected.map(row => row.text).join(' ')}`
        + (signals.has('TREND') ? ' Bu anlık kayıt geçmiş dönem değişimini tek başına göstermiyor.' : '');
    response.source = 'DETERMINISTIC_VERIFIED_FACT_RESPONSE';
    return true;
}

function storyConversationSessionAttachDecisionContracts(session, response, analysis, sequence, inheritedClaims) {
    response.domainEvidence = storyConversationSessionDomainEvidence(
        session, response, analysis, inheritedClaims);
    storyConversationSessionGroundedFactFallback(session, response, analysis);
    if (analysis.speechAct === 'ASK_INFORMATION' && !response.discourseAct
        && !(response.domainEvidence && response.domainEvidence.factRefs || []).length) {
        const variants = [
            'Sorduğun konuda bana açık doğrulanmış bir kayıt yok; kesin bir yanıt veremem.',
            'Bu başlığı doğrulayacak bir kayıt görmüyorum; bilgi uydurarak cevap vermeyeceğim.',
            'Elimde bu soruyu yanıtlayacak doğrulanmış bilgi bulunmuyor; bilmediğim ayrıntıyı tamamlamayacağım.'
        ];
        const variantSeed = parseInt(String(analysis.inputHash || '').slice(-8), 16) || sequence;
        response.text = variants[Math.abs(variantSeed) % variants.length];
        response.source = 'DETERMINISTIC_KNOWLEDGE_BOUNDARY_RESPONSE';
        response.discourseAct = 'ANSWER_INFORMATION_BOUNDARY';
        response.enrichmentStatus = 'NOT_REQUIRED';
        response.llmUsed = false;
    }
    if (typeof storyDialogueMoveBuild === 'function') response.dialogueMove = storyDialogueMoveBuild({
        sessionId: session.id, sequence, analysis, response, inheritedClaims,
        factRefs: response.domainEvidence && response.domainEvidence.factRefs,
        beliefRefs: response.domainEvidence && response.domainEvidence.beliefRefs,
        listenerActorId: session.listenerActorId, playerActorId: session.playerActorId
    });
    return response;
}

function storyConversationSessionBuildSocialResponse(session, ledger) {
    if (!session || !session.analysis.ok || !session.listenerActorId) return null;
    const grounded = storyConversationGroundedFollowUp(session, session.analysis, session.initialText, 0);
    if (!grounded && !STORY_CONVERSATION_SOCIAL_ACTS.includes(session.analysis.speechAct)) return null;
    const realized = grounded ? null
        : storyConversationSocialResponseText(session, session.analysis.speechAct, 0, session.initialText);
    if (!grounded && !realized) return null;
    const voice = storyConversationSocialVoice(session);
    const response = {
        schemaVersion: 1,
        id: `conversation-social-response:${session.id}:1`,
        kind: 'SOCIAL_RESPONSE',
        actorId: session.listenerActorId,
        targetActorId: session.playerActorId,
        speechAct: session.analysis.speechAct,
        createdAt: Number(STORY.clock) || 0,
        text: grounded ? grounded.text : realized.text,
        source: grounded ? 'DETERMINISTIC_GROUNDED_DISCOURSE_RESPONSE'
            : 'CHARACTER_PROFILE_SOCIAL_RESPONSE',
        discourseAct: grounded && grounded.discourseAct || '',
        confidentialityRequest: grounded && grounded.confidentialityRequest || null,
        voiceFingerprint: voice.fingerprint,
        relationshipBand: voice.relationshipBand,
        enrichmentStatus: grounded ? 'NOT_REQUIRED' : 'NOT_QUEUED', llmUsed: false,
        worldMutation: false
    };
    storyConversationSessionAttachDecisionContracts(session, response, session.analysis, 0, []);
    session.listenerResponses.push(response);
    if (ledger && ledger.diagnostics) ledger.diagnostics.socialResponses++;
    return response;
}

function storyConversationSocialFollowUpText(session, analysis, raw, sequence) {
    const folded = storyConversationFold(raw);
    // "İyiyim ama yoruldum" gibi karşıt yapılarda son/olumsuz durum daha fazla
    // bilgi taşır; ilk olumlu kelimede durmak karakteri duyarsız gösteriyordu.
    if (storyConversationContains(folded, ['kotu', 'zor', 'uzgun', 'yorgun', 'yoruldum'])) {
        return 'Bunu duyduğuma üzüldüm. İstersen seni zorlayan konuyu anlat.';
    }
    if (storyConversationContains(folded, ['ben de iyiyim', 'iyiyim', 'iyi gidiyor'])) {
        return 'Buna sevindim. Bugün konuşmak istediğin başka bir konu var mı?';
    }
    const direct = storyConversationSocialResponseText(session, analysis.speechAct, sequence, raw);
    if (direct) return direct.text;
    if (analysis.speechAct === 'ASK_INFORMATION') {
        return 'Bu soruyu doğrulayacak bilgim yok. Bilmediğim ayrıntıyı uydurmayacağım.';
    }
    if (sequence <= 1) {
        return 'Bu sözündeki amacı güvenle çıkaramadım. Ne istediğini biraz daha açık söyler misin?';
    }
    return 'Bu sözünü önceki konuşmayla güvenle bağlayamadım. Yeni iddianı veya isteğini açıkça belirt.';
}

function storyConversationMemoryIntent(raw, analysis, options) {
    const folded = storyConversationFold(raw);
    const explicitRecall = storyConversationContains(folded, [
        'hatirliyor musun', 'hatirladin mi', 'hatirla', 'onceki konusma', 'gecen konusma',
        'son konusma', 'ne konustuk', 'daha once', 'gecmiste', 'verdigin soz', 'verdigim soz',
        'sozumu', 'sozunu', 'aramizda ne oldu', 'aramizdaki gecmis'
    ]);
    const promise = storyConversationContains(folded, [
        'verdigin soz', 'verdigim soz', 'sozumu', 'sozunu', 'soz vermistin', 'soz vermistim',
        'vaat', 'taahhut'
    ]);
    const debt = storyConversationContains(folded, ['borc', 'alacagim', 'alacagin', 'borclu']);
    const secret = storyConversationContains(folded, [
        'sir', 'gizli', 'gizlilik', 'mahrem', 'aramizda kalsin', 'kimse bilmesin'
    ]);
    const secretRecall = secret && (explicitRecall || storyConversationContains(folded, [
        'aramizdaki sir', 'gizli konuyu', 'gizli bilgiyi', 'daha onceki sir', 'eski sir'
    ]));
    const conflict = storyConversationContains(folded, [
        'ihanet', 'kavga', 'tartisma', 'husumet', 'kirgin', 'guvenin nerede kayboldu',
        'neden guvenmiyorsun', 'neden bana guvenmiyorsun'
    ]);
    const decision = storyConversationContains(folded, [
        'karar', 'kararlastirdik', 'anlastik', 'anlasmistik', 'uzlastik'
    ]);
    const conversation = storyConversationContains(folded, [
        'onceki konusma', 'gecen konusma', 'son konusma', 'ne konustuk'
    ]);
    const relationshipHistory = (analysis && analysis.topic === 'RELATIONSHIP')
        && (explicitRecall || conflict || storyConversationContains(folded, ['neden', 'nerede kayboldu']));
    const commerceObligation = options && options.includeObligations
        && analysis && analysis.topic === 'COMMERCE'
        && (promise || debt || decision || storyConversationContains(folded, [
            'anlasma', 'teklif', 'teslimat', 'ortaklik', 'pay'
        ]));
    if (!explicitRecall && !relationshipHistory && !secretRecall && !commerceObligation) return null;
    const kinds = [];
    // Hafıza işaretleri birbirini dışlamaz. Oyuncu aynı cümlede hem bir sözü
    // hem ortak bir sırrı sorabilir; SECRET önceliği diğer açık türleri
    // yutmamalıdır. Gizlilik sınırı tür seçiminde değil, holder/related actor
    // filtrelerini uygulayan storyMemoryRecallForActor kapısında korunur.
    if (secretRecall) kinds.push('SECRET');
    if (promise) kinds.push('PROMISE');
    if (debt) kinds.push('DEBT', 'PROMISE');
    if (conflict) kinds.push('CONFLICT', 'RELATIONSHIP', 'PROMISE', 'DEBT');
    if (decision) kinds.push('DECISION', 'PROMISE', 'DEBT');
    if (conversation) kinds.push('CONVERSATION', 'PROMISE', 'DECISION');
    if (commerceObligation) kinds.push('PROMISE', 'DEBT', 'DECISION');
    if (!kinds.length) kinds.push('CONVERSATION', 'PROMISE', 'DECISION', 'CONFLICT', 'DEBT', 'RELATIONSHIP');
    return { kinds: Array.from(new Set(kinds)), explicitRecall, relationshipHistory };
}

function storyConversationSocialMemoryRecall(session, raw, analysis) {
    if (typeof storyMemoryRecallForActor !== 'function') return null;
    const intent = storyConversationMemoryIntent(raw, analysis);
    if (!intent) return null;
    const recall = storyMemoryRecallForActor(session.listenerActorId, {
        kinds: intent.kinds,
        relatedActorId: session.playerActorId,
        limit: 3
    });
    if (!recall || !recall.ok || !recall.records.length) return null;
    const summary = recall.records.map(row => `${row.summary}${row.status ? ` [${row.status}]` : ''}`).join(' | ');
    return {
        text: `Hatırladığım kayıtlar şunlar: ${summary}`,
        recall,
        evidenceIds: Array.from(new Set(recall.records.flatMap(row => row.sourceEvidenceIds || []))).sort()
    };
}

function storyConversationSessionFollowUp(sessionId, raw) {
    const ledger = storyConversationSessionEnsure();
    const session = storyConversationSessionFind(sessionId);
    const text = String(raw == null ? '' : raw).trim();
    if (!ledger || !session) return { ok: false, code: 'SESSION_NOT_FOUND', worldMutation: false };
    if (session.status === 'REJECTED'
        || STORY_CONVERSATION_RESOLUTION_STATUSES.includes(session.status)) {
        return { ok: false, code: 'FOLLOW_UP_NOT_AVAILABLE', worldMutation: false };
    }
    if ((session.listenerResponses || []).some(row =>
        ['MODEL_LOADING', 'GENERATING'].includes(row.enrichmentStatus))) {
        return { ok: false, code: 'CHARACTER_RESPONSE_PENDING', worldMutation: false };
    }
    if (!text || text.length > STORY_CONVERSATION_MAX_INPUT) {
        return { ok: false, code: !text ? 'EMPTY_INPUT' : 'INPUT_TOO_LONG', worldMutation: false };
    }
    if ((session.followUps || []).length >= STORY_CONVERSATION_TURN_LIMIT - 1) {
        return { ok: false, code: 'TURN_LIMIT', worldMutation: false };
    }
    const inheritedTopic = session.discourseState && session.discourseState.activeTopic || null;
    const analysis = storyConversationAnalyze(text, {
        listenerActorId: session.listenerActorId,
        focusRegionId: session.focusRegionId
    });
    if (!analysis.ok) return { ok: false, code: analysis.code, worldMutation: false };
    const sequence = session.followUps.length + 1;
    const inferredMode = storyConversationCaseInferMode(text, analysis);
    if (inferredMode !== 'DAILY_CHAT' && session.conversationCase
        && inferredMode !== session.conversationCase.mode
        && storyConversationCaseApplyMode(session, inferredMode, 'FOLLOW_UP_ANALYSIS',
            `conversation-turn:${session.id}:${sequence}`)) {
        ledger.diagnostics.caseModeSwitches++;
    }
    const heldMemory = storyConversationSocialMemoryRecall(session, text, analysis);
    let grounded = !heldMemory && storyConversationGroundedFollowUp(session, analysis, text, sequence);
    if (grounded && grounded.discourseAct === 'CLARIFY_UNKNOWN_WITHOUT_FAKE_CONTINUITY'
        && inheritedTopic) grounded = {
            discourseAct: 'CLARIFY_AMBIGUOUS_INPUT',
            text: 'Bu sözünü etkin konuşma konusuna güvenle bağlayamadım; neyi kastettiğini açıkça belirt.'
        };
    if (grounded && (session.listenerResponses || []).some(row =>
        storyConversationFold(row.text) === storyConversationFold(grounded.text))) {
        grounded = grounded.discourseAct === 'CLARIFY_UNKNOWN_WITHOUT_FAKE_CONTINUITY'
            ? {
                discourseAct: 'REPAIR_REPETITION',
                text: 'Bu ikinci ifadeyi de belirli bir amaca bağlayamadım. Görev, kimlik, ilişki, rapor veya tekliften hangisini kastettiğini açıkça belirt.'
            }
            : {
                discourseAct: 'REPAIR_REPETITION',
                text: 'Bu konudaki tutumum değişmedi; aynı cevabı yeniden göstermeyeceğim. Yeni bir bilgi veya farklı bir soru varsa onu ele alalım.'
            };
    }
    const response = {
        schemaVersion: 1,
        id: `conversation-follow-up-response:${session.id}:${sequence}`,
        kind: 'FOLLOW_UP_RESPONSE',
        actorId: session.listenerActorId,
        targetActorId: session.playerActorId,
        speechAct: analysis.speechAct,
        createdAt: Number(STORY.clock) || 0,
        text: heldMemory ? heldMemory.text : grounded ? grounded.text
            : storyConversationSocialFollowUpText(session, analysis, text, sequence),
        source: heldMemory ? 'CHARACTER_HELD_MEMORY_RECALL' : grounded
            ? 'DETERMINISTIC_GROUNDED_DISCOURSE_RESPONSE' : 'CHARACTER_PROFILE_SOCIAL_FOLLOW_UP',
        discourseAct: heldMemory ? 'RECALL_HELD_MEMORY' : grounded && grounded.discourseAct || '',
        confidentialityRequest: grounded && grounded.confidentialityRequest || null,
        voiceFingerprint: storyConversationSocialVoice(session).fingerprint,
        relationshipBand: storyConversationSocialVoice(session).relationshipBand,
        enrichmentStatus: grounded ? 'NOT_REQUIRED' : 'NOT_QUEUED', llmUsed: false,
        memoryRecall: heldMemory && heldMemory.recall || null,
        evidenceIds: heldMemory && heldMemory.evidenceIds || [],
        rawWorldRead: false,
        worldMutation: false
    };
    if (!response.discourseAct && analysis.speechAct === 'CHECK_IN') {
        response.discourseAct = 'CONTINUE_SOCIAL';
    }
    storyConversationSessionAttachDecisionContracts(session, response, analysis, sequence,
        storyConversationSessionUnverifiedClaims(session));
    const followUp = {
        schemaVersion: 1,
        id: `conversation-follow-up:${session.id}:${sequence}`,
        sequence,
        createdAt: Number(STORY.clock) || 0,
        playerText: text,
        inputHash: storyConversationHash(text),
        analysis: storyConversationClone(analysis),
        inheritedTopic,
        inheritedClaims: storyConversationSessionUnverifiedClaims(session),
        response,
        worldMutation: false
    };
    session.followUps.push(followUp);
    session.listenerResponses.push(storyConversationClone(response));
    if (typeof storyDiscourseStateApply === 'function') session.discourseState = storyDiscourseStateApply(
        session.discourseState || storyDiscourseStateCreate(session.id, session.analysis), {
            turnId: `conversation-turn:${session.id}:${sequence}`,
            playerText: text, analysis, response
        });
    storyConversationDiagnosticAppend(session, response, text, 'TURN_CREATED', sequence);
    session.updatedAt = Number(STORY.clock) || 0;
    session.candidate = storyConversationSessionCandidate(session);
    ledger.diagnostics.socialFollowUps++;
    if (heldMemory) ledger.diagnostics.memoryRecalls++;
    const semanticQueued = storyConversationSessionQueueSemanticLLM(
        session.id, response.id, text);
    if (!semanticQueued && !grounded && response.enrichmentStatus !== 'NOT_REQUIRED') {
        storyConversationSessionQueueSocialLLM(session.id, response.id, text);
    }
    return {
        ok: true, code: 'FOLLOW_UP_RECORDED', followUp: storyConversationClone(followUp),
        session: storyConversationClone(session), worldMutation: false
    };
}

function storyConversationSessionBegin(raw, context) {
    const ledger = storyConversationSessionEnsure();
    if (!ledger) return { ok: false, code: 'FEATURE_DISABLED', worldMutation: false };
    context = context && typeof context === 'object' ? context : {};
    const analysis = storyConversationAnalyze(raw, context);
    const sequence = ledger.nextSequence++;
    const id = `conversation-session:${sequence}`;
    const session = {
        schemaVersion: STORY_CONVERSATION_SESSION_SCHEMA_VERSION,
        id, sequence, createdAt: Number(STORY.clock) || 0, updatedAt: Number(STORY.clock) || 0,
        playerActorId: storyConversationPlayerActorId(),
        listenerActorId: context.listenerActorId ? String(context.listenerActorId) : null,
        contactOrdinal: context.listenerActorId
            ? ledger.sessions.filter(row => row.listenerActorId === String(context.listenerActorId)).length + 1
            : 1,
        focusRegionId: context.focusRegionId ? String(context.focusRegionId) : null,
        sourceEventAnchor: null,
        eventDecision: null,
        initialText: String(raw == null ? '' : raw),
        analysis: storyConversationClone(analysis),
        questions: storyConversationSessionQuestions(analysis, id),
        domainChecks: storyConversationSessionDomainChecks(analysis),
        resolvedEntities: {}, resolvedTerms: {}, turns: [], followUps: [], listenerResponses: [], playerResponses: [],
        evidenceSubmissions: [], concessions: { useExistingCompany: false, withdrawnClaimIds: [] },
        resolution: null, status: null, domainReview: null, candidate: null,
        discourseState: typeof storyDiscourseStateCreate === 'function'
            ? storyDiscourseStateCreate(id, analysis) : null,
        worldMutation: false
    };
    storyConversationCaseCreate(session, raw, analysis);
    storyConversationSessionBuildSocialResponse(session, ledger);
    session.status = storyConversationSessionStatus(session);
    session.candidate = storyConversationSessionCandidate(session);
    ledger.sessions.push(session);
    storyConversationTaskOfferCompleteForConversation(ledger, session);
    if (ledger.sessions.length > STORY_CONVERSATION_SESSION_LIMIT) {
        const remove = ledger.sessions.length - STORY_CONVERSATION_SESSION_LIMIT;
        ledger.sessions.splice(0, remove);
        ledger.diagnostics.prunedSessions += remove;
    }
    const openingResponse = session.listenerResponses.find(row => row.kind === 'SOCIAL_RESPONSE');
    if (openingResponse) storyConversationDiagnosticAppend(session, openingResponse, session.initialText, 'TURN_CREATED', 0);
    if (openingResponse) {
        const semanticQueued = storyConversationSessionQueueSemanticLLM(
            session.id, openingResponse.id, session.initialText);
        if (!semanticQueued && openingResponse.enrichmentStatus !== 'NOT_REQUIRED') {
            storyConversationSessionQueueSocialLLM(session.id, openingResponse.id, session.initialText);
        }
    }
    return { ok: analysis.ok, code: analysis.ok ? 'SESSION_STARTED' : analysis.code, session: storyConversationClone(session), worldMutation: false };
}

function storyConversationSessionFind(sessionId) {
    const ledger = storyConversationSessionEnsure();
    return ledger && ledger.sessions.find(row => row.id === String(sessionId)) || null;
}

function storyConversationSessionGet(sessionId) {
    const session = storyConversationSessionFind(sessionId);
    return session ? storyConversationClone(session) : null;
}

function storyConversationSessionList(listenerActorId) {
    const ledger = storyConversationSessionEnsure();
    const listener = listenerActorId == null ? null : String(listenerActorId);
    return (ledger && ledger.sessions || [])
        .filter(row => !listener || row.listenerActorId === listener)
        .slice()
        .sort((a, b) => Number(b.sequence) - Number(a.sequence))
        .map(storyConversationClone);
}

function storyConversationSessionParseNumber(text) {
    const match = storyConversationFold(text).replace(',', '.').match(/(?:^|\s)(\d+(?:\.\d+)?)(?:\s|$)/);
    const value = match ? Number(match[1]) : NaN;
    return Number.isFinite(value) && value > 0 && value <= 1000000 ? value : null;
}

function storyConversationSessionAnswerValue(question, raw) {
    const text = String(raw == null ? '' : raw).trim();
    const folded = storyConversationFold(text);
    if (!text || text.length > 240) return { ok: false, code: 'INVALID_REPLY' };
    if (question.responseType.startsWith('CLOSED_ENTITY')) {
        const selected = (question.options || []).find(row => row.id === text);
        return selected ? { ok: true, value: { selectedId: selected.id, label: selected.label } }
            : { ok: false, code: 'OPTION_NOT_OFFERED' };
    }
    const amount = storyConversationSessionParseNumber(text);
    if (amount == null) return { ok: false, code: 'POSITIVE_NUMBER_REQUIRED' };
    if (question.responseType === 'QUANTITY') {
        const unit = folded.replace(String(amount), '').trim();
        return unit ? { ok: true, value: { amount, unit } }
            : { ok: false, code: 'QUANTITY_UNIT_REQUIRED' };
    }
    if (question.responseType === 'PAYMENT') {
        const type = storyConversationContains(folded, ['sermaye']) ? 'capital'
            : storyConversationContains(folded, ['para', 'nakit']) ? 'cash' : null;
        return type ? { ok: true, value: { amount, type } }
            : { ok: false, code: 'PAYMENT_TYPE_REQUIRED' };
    }
    if (question.responseType === 'DURATION') {
        const unit = storyConversationContains(folded, ['gun']) ? 'DAY'
            : storyConversationContains(folded, ['ay']) ? 'MONTH' : null;
        return unit ? { ok: true, value: { amount, unit } }
            : { ok: false, code: 'DURATION_UNIT_REQUIRED' };
    }
    if (question.responseType === 'PENALTY') {
        const type = folded.includes('%') || storyConversationContains(folded, ['yuzde']) ? 'PERCENT'
            : storyConversationContains(folded, ['sermaye', 'para', 'nakit']) ? 'CAPITAL' : null;
        return type ? { ok: true, value: { amount, type } }
            : { ok: false, code: 'PENALTY_TYPE_REQUIRED' };
    }
    return { ok: false, code: 'UNSUPPORTED_REPLY_TYPE' };
}

function storyConversationSessionReply(sessionId, questionId, raw) {
    const ledger = storyConversationSessionEnsure();
    const session = storyConversationSessionFind(sessionId);
    if (!ledger || !session) return { ok: false, code: 'SESSION_NOT_FOUND', worldMutation: false };
    if (session.turns.length >= STORY_CONVERSATION_TURN_LIMIT) return { ok: false, code: 'TURN_LIMIT', worldMutation: false };
    const question = session.questions.find(row => row.id === String(questionId));
    if (!question || question.status !== 'OPEN') return { ok: false, code: 'QUESTION_NOT_OPEN', worldMutation: false };
    const parsed = storyConversationSessionAnswerValue(question, raw);
    if (!parsed.ok) {
        ledger.diagnostics.rejectedReplies++;
        return { ok: false, code: parsed.code, question: storyConversationClone(question), worldMutation: false };
    }
    question.status = 'ANSWERED';
    question.answer = storyConversationClone(parsed.value);
    session.resolvedTerms[question.term] = storyConversationClone(parsed.value);
    if (question.responseType.startsWith('CLOSED_ENTITY')) {
        const selectedId = parsed.value.selectedId;
        if (selectedId === 'DEFER_TO_LISTENER_VERIFICATION') {
            session.domainChecks.push({
                id: 'verify_shipment_claim_with_listener', status: 'PENDING_LISTENER_VERIFICATION',
                reason: 'Oyuncu sevkiyat kimliği uydurmadı; iddia muhatabın bilgisine sorulacak.'
            });
        } else {
            const roleType = {
                commodity_identity: ['COMMODITY', 'RESOURCE'],
                destination_warehouse: ['DESTINATION', 'WAREHOUSE'],
                shipment_identity: ['TARGET_SHIPMENT', 'SHIPMENT']
            }[question.term] || ['SUBJECT', 'UNKNOWN'];
            session.resolvedEntities[question.term] = {
                role: roleType[0], entityType: roleType[1], entityId: selectedId,
                status: 'RESOLVED_BY_PLAYER_CONFIRMATION',
                evidence: [`SESSION_ANSWER:${question.id}`]
            };
        }
    }
    session.turns.push({
        sequence: session.turns.length + 1, at: Number(STORY.clock) || 0,
        questionId: question.id, term: question.term,
        inputHash: storyConversationHash(String(raw)), answer: storyConversationClone(parsed.value)
    });
    session.updatedAt = Number(STORY.clock) || 0;
    session.status = storyConversationSessionStatus(session);
    session.candidate = storyConversationSessionCandidate(session);
    if (session.status === 'READY_FOR_DOMAIN_REVIEW') storyConversationSessionApplyDomainReview(session);
    return { ok: true, code: 'CLARIFICATION_ACCEPTED', session: storyConversationClone(session), worldMutation: false };
}

function storyConversationSessionLatest(listenerActorId) {
    const ledger = storyConversationSessionEnsure();
    const listener = listenerActorId == null ? null : String(listenerActorId);
    const rows = (ledger && ledger.sessions || []).filter(row => !listener || row.listenerActorId === listener);
    return rows.length ? storyConversationClone(rows[rows.length - 1]) : null;
}

function storyConversationSessionCaseGet(sessionId) {
    const session = storyConversationSessionFind(sessionId);
    return session && session.conversationCase ? storyConversationClone(session.conversationCase) : null;
}

function storyConversationSessionSetMode(sessionId, mode) {
    const ledger = storyConversationSessionEnsure();
    const session = storyConversationSessionFind(sessionId);
    const normalized = String(mode || '');
    if (!ledger || !session) return { ok: false, code: 'SESSION_NOT_FOUND', worldMutation: false };
    if (!STORY_CONVERSATION_CASE_MODES.includes(normalized)) {
        return { ok: false, code: 'CONVERSATION_MODE_INVALID', worldMutation: false };
    }
    const changed = storyConversationCaseApplyMode(session, normalized,
        'PLAYER_EXPLICIT_MODE', `conversation-mode:${session.id}:${session.conversationCase.modeHistory.length + 1}`);
    session.updatedAt = Number(STORY.clock) || session.updatedAt;
    if (changed) ledger.diagnostics.caseModeSwitches++;
    return {
        ok: true,
        code: changed ? 'CONVERSATION_MODE_CHANGED' : 'CONVERSATION_MODE_UNCHANGED',
        conversationCase: storyConversationClone(session.conversationCase),
        worldMutation: false
    };
}

function storyConversationSessionExpectedDialogueMove(session, response) {
    if (!session || !response || typeof storyDialogueMoveBuild !== 'function') return null;
    const followUp = (session.followUps || []).find(row =>
        row.response && row.response.id === response.id);
    const domain = storyConversationSessionExpectedDomainEvidence(session, response);
    return storyDialogueMoveBuild({
        sessionId: session.id,
        sequence: followUp ? followUp.sequence : 0,
        analysis: followUp ? followUp.analysis : session.analysis,
        response,
        inheritedClaims: followUp ? followUp.inheritedClaims : [],
        factRefs: domain && domain.factRefs,
        beliefRefs: domain && domain.beliefRefs,
        listenerActorId: session.listenerActorId,
        playerActorId: session.playerActorId
    });
}

function storyConversationSessionExpectedDomainEvidence(session, response) {
    if (!session || !response || typeof storyConversationDomainBuild !== 'function') return null;
    const followUp = (session.followUps || []).find(row =>
        row.response && row.response.id === response.id);
    return storyConversationSessionDomainEvidence(
        session,
        response,
        followUp ? followUp.analysis : session.analysis,
        followUp ? followUp.inheritedClaims : []
    );
}

function storyConversationSessionValidationContext(session, response) {
    if (!session || !response) return null;
    const verifiedFacts = (response.dialogueMove && response.dialogueMove.factRefs || [])
        .map(ref => typeof storyConversationDomainFactResolve === 'function'
            ? storyConversationDomainFactResolve(ref, session.listenerActorId, response.domainEvidence) : null)
        .filter(Boolean).map(row => ({ id: row.id, text: row.text, sourceType: row.sourceType }));
    const allowedMemoryRefs = new Set(response.dialogueMove && response.dialogueMove.memoryRefs || []);
    const memoryRecords = (response.memoryRecall && response.memoryRecall.records || [])
        .filter(row => allowedMemoryRefs.has(row.id))
        .map(row => ({ id: row.id, kind: row.kind, status: row.status, summary: row.summary }));
    return {
        history: (session.listenerResponses || []).filter(row => row.id !== response.id)
            .map(row => ({ text: row.text })),
        playerHistory: [{ text: session.initialText }].concat((session.followUps || [])
            .filter(row => !row.response || row.response.id !== response.id)
            .map(row => ({ text: row.playerText }))).filter(row => row.text),
        unverifiedRegionNames: storyConversationSessionUnverifiedClaims(session)
            .flatMap(row => row.regionNames || (row.regionName ? [row.regionName] : [])),
        locationAnswerMustBeUnknown: response.discourseAct === 'ANSWER_LISTENER_LOCATION_UNKNOWN',
        firstContact: Number(session.contactOrdinal) === 1,
        ongoingSession: (session.followUps || []).some(row =>
            row.response && row.response.id !== response.id),
        dialogueMove: response.dialogueMove || null,
        verifiedFacts, memoryRecords
    };
}

function storyConversationSessionValidateLedger(candidate) {
    const issues = [];
    const add = (code, path) => issues.push({ code, path });
    const relationshipReceipts = STORY.characterRelationships
        && STORY.characterRelationships.resultReceipts || {};
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return { ok: false, issues: [{ code: 'LEDGER_REQUIRED', path: '$' }] };
    }
    if (candidate.schemaVersion !== STORY_CONVERSATION_SESSION_SCHEMA_VERSION) add('SESSION_SCHEMA', '$.schemaVersion');
    if (candidate.adapterVersion !== STORY_CONVERSATION_SESSION_ADAPTER_VERSION) add('SESSION_ADAPTER', '$.adapterVersion');
    if (!Number.isInteger(candidate.nextSequence) || candidate.nextSequence < 1) add('NEXT_SEQUENCE', '$.nextSequence');
    if (!Number.isInteger(candidate.nextTaskOfferSequence) || candidate.nextTaskOfferSequence < 1) {
        add('NEXT_TASK_OFFER_SEQUENCE', '$.nextTaskOfferSequence');
    }
    if (!Number.isInteger(candidate.nextMeetingSequence) || candidate.nextMeetingSequence < 1) {
        add('NEXT_MEETING_SEQUENCE', '$.nextMeetingSequence');
    }
    if (!Number.isInteger(candidate.nextMeetingClosureSequence)
        || candidate.nextMeetingClosureSequence < 1) {
        add('NEXT_MEETING_CLOSURE_SEQUENCE', '$.nextMeetingClosureSequence');
    }
    if (!Array.isArray(candidate.taskOffers)
        || candidate.taskOffers.length > STORY_CONVERSATION_TASK_OFFER_LIMIT) {
        add('TASK_OFFERS_REQUIRED', '$.taskOffers');
    }
    if (!Array.isArray(candidate.meetingCases)
        || candidate.meetingCases.length > STORY_CONVERSATION_MEETING_LIMIT) {
        add('MEETING_CASES_REQUIRED', '$.meetingCases');
    }
    if (!Array.isArray(candidate.sessions) || candidate.sessions.length > STORY_CONVERSATION_SESSION_LIMIT) add('SESSION_LIMIT', '$.sessions');
    const taskOfferIds = new Set();
    for (const [index, taskOffer] of (candidate.taskOffers || []).entries()) {
        const at = `$.taskOffers[${index}]`;
        if (!taskOffer || taskOffer.schemaVersion !== STORY_CONVERSATION_TASK_OFFER_SCHEMA_VERSION
            || !taskOffer.id || taskOfferIds.has(taskOffer.id)) {
            add('TASK_OFFER_ID', at);
            continue;
        }
        taskOfferIds.add(taskOffer.id);
        if (!Object.prototype.hasOwnProperty.call(taskOffer, 'relationshipResultReceiptId')
            || (taskOffer.relationshipResultReceiptId !== null
                && typeof taskOffer.relationshipResultReceiptId !== 'string')) {
            add('TASK_OFFER_RELATIONSHIP_RESULT_REFERENCE', `${at}.relationshipResultReceiptId`);
        }
        if (taskOffer.relationshipResultReceiptId !== null) {
            const relationshipReceipt = relationshipReceipts[taskOffer.relationshipResultReceiptId];
            const expectedInterpretation = taskOffer.status === 'COMPLETED'
                ? 'TASK_COMMITMENT_KEPT' : taskOffer.status === 'EXPIRED' && Number.isFinite(taskOffer.acceptedAt)
                    ? 'TASK_COMMITMENT_BROKEN' : null;
            if (!relationshipReceipt || !expectedInterpretation
                || relationshipReceipt.sourceType !== 'TASK_RESULT'
                || relationshipReceipt.sourceReceiptId !== taskOffer.id
                || relationshipReceipt.fromActorId !== taskOffer.issuerActorId
                || relationshipReceipt.toActorId !== taskOffer.assigneeActorId
                || relationshipReceipt.interpretationType !== expectedInterpretation) {
                add('TASK_OFFER_RELATIONSHIP_RESULT_LINK', `${at}.relationshipResultReceiptId`);
            }
        }
        if (!['OFFERED', 'ACCEPTED', 'DECLINED', 'COMPLETED', 'EXPIRED'].includes(taskOffer.status)) {
            add('TASK_OFFER_STATUS', `${at}.status`);
        }
        if (!STORY_CONVERSATION_TASK_OFFER_KINDS.includes(taskOffer.kind)
            || !taskOffer.issuerActorId || !taskOffer.assigneeActorId) add('TASK_OFFER_AUTHORITY', at);
        if (!taskOffer.objective || taskOffer.objective.type !== 'HOLD_CONVERSATION'
            || !taskOffer.objective.targetActorId || taskOffer.objective.minimumConversationCount !== 1) {
            add('TASK_OFFER_OBJECTIVE', `${at}.objective`);
        }
        if (taskOffer.kind === 'PERSONAL_CONTACT_REQUEST') {
            if (!taskOffer.authority || taskOffer.authority.model !== 'PERSONAL_REQUEST'
                || taskOffer.authority.sourceActorId !== taskOffer.issuerActorId
                || taskOffer.authority.canCompel !== false) add('TASK_OFFER_AUTHORITY', at);
            if (!taskOffer.reward || taskOffer.reward.kind !== 'NONE' || taskOffer.reward.amount !== 0) {
                add('TASK_OFFER_REWARD', `${at}.reward`);
            }
            if (taskOffer.institutional !== null) add('TASK_OFFER_UNION_MIXED', `${at}.institutional`);
        } else if (taskOffer.kind === 'INSTITUTIONAL_PAID_CONTACT_TASK') {
            const institution = taskOffer.institutional;
            if (!taskOffer.authority || taskOffer.authority.model !== 'INSTITUTIONAL_COMMISSION'
                || taskOffer.authority.sourceActorId !== taskOffer.issuerActorId
                || taskOffer.authority.canCompel !== false
                || !institution || taskOffer.authority.institutionRequestId !== institution.institutionRequestId
                || taskOffer.authority.institutionId !== institution.institutionId
                || taskOffer.authority.countryId !== institution.countryId
                || taskOffer.authority.legalBasis !== institution.legalBasis) {
                    add('TASK_OFFER_AUTHORITY', at);
            }
            if (institution && (!Object.prototype.hasOwnProperty.call(institution, 'relationshipResultReceiptId')
                || institution.relationshipResultReceiptId !== taskOffer.relationshipResultReceiptId)) {
                add('TASK_OFFER_INSTITUTIONAL_RELATIONSHIP_LINK', `${at}.institutional.relationshipResultReceiptId`);
            }
            if (!taskOffer.reward || taskOffer.reward.kind !== 'STATE_CREDIT_COMPENSATION'
                || taskOffer.reward.amount !== 25 || taskOffer.reward.currency !== 'STATE_CREDIT') {
                add('TASK_OFFER_REWARD', `${at}.reward`);
            }
            if (!institution || !institution.correlationId || !institution.institutionRequestId || !institution.institutionId
                || !/^country:\d+$/.test(String(institution.countryId || '')) || !institution.legalBasis
                || !/^country:\d+$/.test(String(institution.payerCountryId || ''))
                || institution.payerCommanderId == null
                || !/^country:\d+$/.test(String(institution.payeeCountryId || ''))
                || institution.payeeCommanderId == null
                || institution.compensationPolicyId !== 'institutional-contact-task-v1'
                || institution.amount !== 25 || institution.currency !== 'STATE_CREDIT'
                || !['NOT_RESERVED', 'RESERVED', 'SETTLED', 'RELEASED'].includes(institution.paymentStatus)) {
                add('TASK_OFFER_INSTITUTIONAL_TERMS', `${at}.institutional`);
            } else {
                const liveRequest = STORY.institutions && STORY.institutions.requests
                    ? STORY.institutions.requests[institution.institutionRequestId] : null;
                if (liveRequest) {
                    const payer = storyConversationTaskCommanderAccount(taskOffer.issuerActorId);
                    const payee = storyConversationTaskCommanderAccount(taskOffer.assigneeActorId);
                    if (!payer || !payee
                        || institution.payerCountryId !== payer.countryId
                        || String(institution.payerCommanderId) !== payer.commanderId
                        || institution.payeeCountryId !== payee.countryId
                        || String(institution.payeeCommanderId) !== payee.commanderId
                        || liveRequest.proposer.actorId !== taskOffer.issuerActorId
                        || liveRequest.proposer.sourceId !== institution.institutionId
                        || liveRequest.countryId !== institution.countryId
                        || !liveRequest.commission
                        || liveRequest.commission.correlationId !== institution.correlationId) {
                        add('TASK_OFFER_INSTITUTIONAL_PARTIES', `${at}.institutional`);
                    }
                }
                const requiresEscrow = ['RESERVED', 'SETTLED', 'RELEASED'].includes(institution.paymentStatus);
                if (requiresEscrow !== !!institution.escrowReservationId) {
                    add('TASK_OFFER_INSTITUTIONAL_ESCROW', `${at}.institutional`);
                }
                const linkedSettlement = requiresEscrow && STORY.stateBudget
                    ? (STORY.stateBudget.settlements || []).find(row =>
                        row.id === institution.escrowReservationId) : null;
                const expectedSettlementStatus = institution.paymentStatus === 'RESERVED' ? 'RESERVED'
                    : institution.paymentStatus === 'SETTLED' ? 'SETTLED'
                        : institution.paymentStatus === 'RELEASED' ? 'RELEASED' : null;
                if (requiresEscrow && (!linkedSettlement
                    || linkedSettlement.status !== expectedSettlementStatus
                    || linkedSettlement.correlationId !== institution.correlationId
                    || linkedSettlement.payerCountryId !== institution.payerCountryId
                    || String(linkedSettlement.payerCommanderId) !== String(institution.payerCommanderId)
                    || linkedSettlement.payeeCountryId !== institution.payeeCountryId
                    || String(linkedSettlement.payeeCommanderId) !== String(institution.payeeCommanderId)
                    || linkedSettlement.amount !== institution.amount
                    || linkedSettlement.currency !== institution.currency)) {
                    add('TASK_OFFER_INSTITUTIONAL_PAYMENT_LINK', `${at}.institutional`);
                }
                const expectedPaymentStatus = taskOffer.status === 'OFFERED' || taskOffer.status === 'DECLINED'
                    ? 'NOT_RESERVED' : taskOffer.status === 'ACCEPTED' ? 'RESERVED'
                        : taskOffer.status === 'COMPLETED' ? 'SETTLED' : null;
                if ((expectedPaymentStatus && institution.paymentStatus !== expectedPaymentStatus)
                    || (taskOffer.status === 'EXPIRED'
                        && !['NOT_RESERVED', 'RELEASED'].includes(institution.paymentStatus))) {
                    add('TASK_OFFER_INSTITUTIONAL_STATE', `${at}.institutional.paymentStatus`);
                }
                if ((taskOffer.status === 'COMPLETED') !== !!institution.resultReceiptId) {
                    add('TASK_OFFER_INSTITUTIONAL_RECEIPT', `${at}.institutional.resultReceiptId`);
                }
                const receipt = institution.resultReceipt;
                if (receipt && (!Object.prototype.hasOwnProperty.call(receipt, 'relationshipResultReceiptId')
                    || receipt.relationshipResultReceiptId !== taskOffer.relationshipResultReceiptId)) {
                    add('TASK_OFFER_INSTITUTIONAL_RELATIONSHIP_LINK', `${at}.institutional.resultReceipt.relationshipResultReceiptId`);
                }
                if (taskOffer.status === 'COMPLETED') {
                    const settlement = STORY.stateBudget && (STORY.stateBudget.settlements || []).find(row =>
                        row.id === institution.escrowReservationId);
                    const sourceSession = (candidate.sessions || []).find(row => row.id === taskOffer.sessionId);
                    const completionSession = (candidate.sessions || []).find(row =>
                        row.id === taskOffer.completionSessionId);
                    if (!receipt || receipt.schemaVersion !== 1
                        || receipt.id !== `${taskOffer.id}:receipt:1`
                        || receipt.id !== institution.resultReceiptId
                        || receipt.taskOfferId !== taskOffer.id
                        || receipt.sourceSessionId !== taskOffer.sessionId || !sourceSession
                        || receipt.completionSessionId !== taskOffer.completionSessionId || !completionSession
                        || receipt.completionSessionId === receipt.sourceSessionId
                        || completionSession.playerActorId !== taskOffer.assigneeActorId
                        || completionSession.listenerActorId !== taskOffer.objective.targetActorId
                        || receipt.institutionRequestId !== institution.institutionRequestId
                        || receipt.institutionId !== institution.institutionId
                        || receipt.countryId !== institution.countryId
                        || receipt.legalBasis !== institution.legalBasis
                        || receipt.escrowReservationId !== institution.escrowReservationId
                        || receipt.payerCountryId !== institution.payerCountryId
                        || String(receipt.payerCommanderId) !== String(institution.payerCommanderId)
                        || receipt.payeeCountryId !== institution.payeeCountryId
                        || String(receipt.payeeCommanderId) !== String(institution.payeeCommanderId)
                        || receipt.amount !== institution.amount || receipt.currency !== institution.currency
                        || receipt.completedAt !== taskOffer.completedAt
                        || receipt.physicalMutation !== false || receipt.worldMutation !== false
                        || !settlement || settlement.status !== 'SETTLED'
                        || settlement.correlationId !== institution.correlationId
                        || settlement.payerTransactionId !== receipt.payerTransactionId
                        || settlement.payeeTransactionId !== receipt.payeeTransactionId
                        || settlement.amount !== receipt.amount || settlement.currency !== receipt.currency) {
                        add('TASK_OFFER_INSTITUTIONAL_RECEIPT', `${at}.institutional.resultReceipt`);
                    }
                } else if (receipt != null) {
                    add('TASK_OFFER_INSTITUTIONAL_RECEIPT', `${at}.institutional.resultReceipt`);
                }
            }
        }
        if (!Number.isFinite(taskOffer.createdAt) || !Number.isFinite(taskOffer.dueAt)
            || taskOffer.dueAt <= taskOffer.createdAt || taskOffer.worldMutation !== false) {
            add('TASK_OFFER_TIME_OR_MUTATION', at);
        }
        if (taskOffer.status === 'COMPLETED' && (!taskOffer.completionSessionId
            || !Number.isFinite(taskOffer.completedAt))) add('TASK_OFFER_COMPLETION', at);
    }
    const meetingById = new Map();
    for (const [index, meeting] of (candidate.meetingCases || []).entries()) {
        const at = `$.meetingCases[${index}]`;
        if (!meeting || meeting.schemaVersion !== 1 || !meeting.id || meetingById.has(meeting.id)) {
            add('MEETING_CASE_ID', at);
            continue;
        }
        meetingById.set(meeting.id, meeting);
        const sourceSession = (candidate.sessions || []).find(row => row.id === meeting.sessionId);
        if (!sourceSession || !sourceSession.conversationCase
            || sourceSession.conversationCase.id !== meeting.conversationCaseId
            || sourceSession.conversationCase.meetingCaseId !== meeting.id) {
            add('MEETING_SESSION_REFERENCE', at);
        }
        if (meeting.meetingType !== 'FORMAL_CONSULTATION'
            || !['OPEN_NO_DECISION_ADAPTER', 'CLOSED_ADOPTED_PENDING_PROPOSAL',
                'CLOSED_ADOPTED_PROPOSAL_ROUTED', 'CLOSED_REJECTED']
                .includes(meeting.status)) add('MEETING_CASE_STATUS', at);
        if (!meeting.chair || !meeting.chair.actorId || !meeting.chair.institutionId
            || meeting.chair.authoritySource !== 'CANONICAL_INSTITUTION_OFFICE') {
            add('MEETING_CHAIR_AUTHORITY', `${at}.chair`);
        }
        if (!Array.isArray(meeting.participants) || meeting.participants.length < 3
            || !Array.isArray(meeting.participantActorIds)
            || JSON.stringify(meeting.participants.map(row => row.actorId))
                !== JSON.stringify(meeting.participantActorIds)
            || new Set(meeting.participantActorIds).size !== meeting.participantActorIds.length
            || !meeting.participantActorIds.includes(meeting.chair && meeting.chair.actorId)) {
            add('MEETING_PARTICIPANTS', `${at}.participants`);
        }
        if (!Array.isArray(meeting.agendaItems) || meeting.agendaItems.length !== 1
            || !meeting.agendaItems[0].title || meeting.agendaItems[0].status !== 'OPEN'
            || meeting.agendaItems[0].source !== 'PLAYER_PROPOSED_AGENDA') {
            add('MEETING_AGENDA', `${at}.agendaItems`);
        }
        if (!Array.isArray(meeting.speakingOrderActorIds)
            || JSON.stringify(meeting.speakingOrderActorIds) !== JSON.stringify(meeting.participantActorIds)
            || !Number.isInteger(meeting.currentSpeakerIndex)
            || meeting.currentSpeakerIndex < 0
            || meeting.currentSpeakerIndex >= meeting.speakingOrderActorIds.length
            || meeting.currentSpeakerIndex !== ((meeting.turns || []).length % meeting.speakingOrderActorIds.length)) {
            add('MEETING_SPEAKING_ORDER', `${at}.speakingOrderActorIds`);
        }
        const publicTurnIds = (meeting.turns || []).map(row => row && row.id);
        if (!Array.isArray(meeting.turns) || meeting.turns.length > 40
            || meeting.turns.some((turn, turnIndex) => !turn
                || turn.id !== `${meeting.id}:turn:${turnIndex + 1}`
                || turn.sequence !== turnIndex + 1
                || !meeting.participantActorIds.includes(turn.actorId)
                || (turn.addressedActorId != null
                    && !meeting.participantActorIds.includes(turn.addressedActorId))
                || turn.visibility !== 'MEETING_PUBLIC' || turn.worldMutation !== false
                || !Array.isArray(turn.sourceRefs)
                || (turn.grounding != null && (!turn.grounding.beliefId
                    || !turn.grounding.worldFactId
                    || !turn.sourceRefs.includes(turn.grounding.beliefId)
                    || !turn.sourceRefs.includes(turn.grounding.worldFactId)
                    || !['PUBLIC', 'INSTITUTIONAL'].includes(turn.grounding.visibility)))
                || (turn.stance != null && (turn.stance.schemaVersion !== 1
                    || !['SUPPORT', 'LEAN_SUPPORT', 'UNDECIDED', 'LEAN_OPPOSE', 'OPPOSE']
                        .includes(turn.stance.direction)
                    || !Number.isInteger(turn.stance.scoreBps) || turn.stance.scoreBps < -10000
                    || turn.stance.scoreBps > 10000
                    || !Number.isInteger(turn.stance.confidenceBps) || turn.stance.confidenceBps < 0
                    || turn.stance.confidenceBps > 10000
                    || !Array.isArray(turn.stance.publicReasonCodes)
                    || !Array.isArray(turn.stance.sourceRefs)
                    || turn.stance.sourceRefs.some(ref => !turn.sourceRefs.includes(ref))
                    || turn.stance.rawPersonalityAxesExposed !== false
                    || turn.stance.rawRelationshipAxesExposed !== false
                    || turn.stance.worldMutation !== false))
                || !turn.knowledgePolicy || turn.knowledgePolicy.ownPrivateContextOnly !== true
                || turn.knowledgePolicy.otherPrivateContextReadable !== false
                || turn.knowledgePolicy.rawWorldRead !== false)) {
            add('MEETING_TURNS', `${at}.turns`);
        }
        const agendaIds = (meeting.agendaItems || []).map(row => row.id);
        const privateNotes = Array.isArray(meeting.privateNotes) ? meeting.privateNotes : [];
        const privateNoteIds = privateNotes.map(row => row && row.id);
        const replyCounts = new Map();
        const invalidPrivateNote = privateNotes.some((note, noteIndex) => {
            if (!note || note.schemaVersion !== 2
                || note.id !== `${meeting.id}:private-note:${noteIndex + 1}`
                || note.sequence !== noteIndex + 1
                || !meeting.participantActorIds.includes(note.authorActorId)
                || !meeting.participantActorIds.includes(note.recipientActorId)
                || note.authorActorId === note.recipientActorId
                || note.visibility !== 'BILATERAL_PRIVATE'
                || typeof note.text !== 'string' || note.text.length < 2 || note.text.length > 600
                || !Array.isArray(note.sourceRefs)
                || !note.knowledgePolicy
                || note.knowledgePolicy.agendaVisible !== true
                || note.knowledgePolicy.rootPrivateNoteOnly !== true
                || note.knowledgePolicy.otherPrivateContextReadable !== false
                || note.knowledgePolicy.rawWorldRead !== false
                || note.worldMutation !== false
                || !Number.isFinite(note.createdAt)) return true;
            if (note.kind === 'PLAYER_NOTE') {
                return note.authorActorId !== (sourceSession && sourceSession.playerActorId)
                    || note.replyToPrivateNoteId !== null
                    || note.sourceTurnId !== null
                    || note.sourceRefs.length !== 0
                    || note.grounding !== null || note.stance !== null
                    || note.generationMode !== 'PLAYER_AUTHORED'
                    || note.publicTurnCountAtReply !== null
                    || note.knowledgePolicy.priorPublicTurnsVisible !== false;
            }
            if (note.kind !== 'CHARACTER_REPLY') return true;
            const parent = privateNotes.find(row => row && row.id === note.replyToPrivateNoteId);
            const publicTurnIdsAtReply = (meeting.turns || [])
                .slice(0, Number(note.publicTurnCountAtReply) || 0)
                .filter(turn => turn && turn.visibility === 'MEETING_PUBLIC')
                .map(turn => turn.id);
            if (!parent || parent.kind !== 'PLAYER_NOTE' || parent.sequence >= note.sequence
                || note.authorActorId !== parent.recipientActorId
                || note.recipientActorId !== parent.authorActorId
                || note.sourceTurnId !== null
                || note.generationMode !== 'DETERMINISTIC_SOURCE_BOUND'
                || !Number.isInteger(note.publicTurnCountAtReply)
                || note.publicTurnCountAtReply < 0
                || note.publicTurnCountAtReply > (meeting.turns || []).length
                || meeting.speakingOrderActorIds[
                    note.publicTurnCountAtReply % meeting.speakingOrderActorIds.length
                ] !== note.authorActorId
                || note.knowledgePolicy.priorPublicTurnsVisible !== true
                || !note.sourceRefs.includes(parent.id)
                || !note.sourceRefs.includes(meeting.agendaItems[0].id)
                || note.sourceRefs.some(ref => privateNoteIds.includes(ref) && ref !== parent.id)
                || note.sourceRefs.some(ref =>
                    publicTurnIds.includes(ref) && !publicTurnIdsAtReply.includes(ref))
                || publicTurnIdsAtReply.some(ref => !note.sourceRefs.includes(ref))
                || (note.grounding != null && (!note.grounding.beliefId
                    || !note.grounding.worldFactId
                    || !note.sourceRefs.includes(note.grounding.beliefId)
                    || !note.sourceRefs.includes(note.grounding.worldFactId)
                    || !['PUBLIC', 'INSTITUTIONAL'].includes(note.grounding.visibility)))
                || (note.stance != null && (note.stance.schemaVersion !== 1
                    || !['SUPPORT', 'LEAN_SUPPORT', 'UNDECIDED', 'LEAN_OPPOSE', 'OPPOSE']
                        .includes(note.stance.direction)
                    || !Number.isInteger(note.stance.scoreBps)
                    || note.stance.scoreBps < -10000 || note.stance.scoreBps > 10000
                    || !Number.isInteger(note.stance.confidenceBps)
                    || note.stance.confidenceBps < 0 || note.stance.confidenceBps > 10000
                    || !Array.isArray(note.stance.publicReasonCodes)
                    || !Array.isArray(note.stance.sourceRefs)
                    || note.stance.sourceRefs.some(ref => !note.sourceRefs.includes(ref))
                    || note.stance.rawPersonalityAxesExposed !== false
                    || note.stance.rawRelationshipAxesExposed !== false
                    || note.stance.worldMutation !== false))) return true;
            replyCounts.set(parent.id, (replyCounts.get(parent.id) || 0) + 1);
            return replyCounts.get(parent.id) > 1;
        });
        if (!Array.isArray(meeting.privateNotes) || meeting.privateNotes.length > 24
            || invalidPrivateNote) {
            add('MEETING_PRIVATE_NOTES', `${at}.privateNotes`);
        }
        if (!Array.isArray(meeting.visibilityMatrix)
            || meeting.visibilityMatrix.length !== meeting.participantActorIds.length
            || meeting.visibilityMatrix.some(row => !row
                || !meeting.participantActorIds.includes(row.actorId)
                || JSON.stringify(row.visibleParticipantActorIds) !== JSON.stringify(meeting.participantActorIds)
                || JSON.stringify(row.visibleAgendaItemIds) !== JSON.stringify(agendaIds)
                || JSON.stringify(row.visibleTurnIds) !== JSON.stringify(publicTurnIds)
                || JSON.stringify(row.visiblePrivateNoteIds) !== JSON.stringify(privateNoteIds.filter(noteId => {
                    const note = meeting.privateNotes.find(item => item.id === noteId);
                    return note && (note.authorActorId === row.actorId || note.recipientActorId === row.actorId);
                }))
                || row.privateContextOwnerActorId !== row.actorId
                || row.mayReadOtherPrivateContext !== false)) {
            add('MEETING_VISIBILITY_MATRIX', `${at}.visibilityMatrix`);
        }
        const meetingVotes = Array.isArray(meeting.votes) ? meeting.votes : [];
        const outcomeReceipts = Array.isArray(meeting.outcomeReceipts) ? meeting.outcomeReceipts : [];
        if (!Array.isArray(meeting.motions) || meeting.motions.length > 6
            || meeting.motions.some((motion, motionIndex) => !motion
                || motion.id !== `${meeting.id}:motion:${motionIndex + 1}`
                || motion.sequence !== motionIndex + 1
                || motion.agendaItemId !== meeting.agendaItems[0].id
                || motion.proposerActorId !== (sourceSession && sourceSession.playerActorId)
                || typeof motion.text !== 'string' || motion.text.length < 12 || motion.text.length > 600
                || !Number.isFinite(motion.proposedAt)
                || (motion.proposalIntent != null && (
                    motion.proposalIntent.schemaVersion !== 1
                    || motion.proposalIntent.id !== `${motion.proposalIntent.motionVersionId}:institution-proposal-intent`
                    || motion.proposalIntent.kind !== 'INSTITUTION_ACTION'
                    || motion.proposalIntent.motionVersionId !== motion.activeVersionId
                    || !motion.proposalIntent.actionType
                    || motion.proposalIntent.countryId !== meeting.countryId
                    || motion.proposalIntent.proposerActorId !== meeting.chair.actorId
                    || motion.proposalIntent.proposerInstitutionId !== meeting.chair.institutionId
                    || motion.proposalIntent.proposerInstitutionType !== meeting.chair.institutionType
                    || motion.proposalIntent.authoritySource !== 'CANONICAL_CHARACTER_ROLE_ADAPTER'
                    || !motion.proposalIntent.legalBasis
                    || !['COUNTRY', 'REGION'].includes(motion.proposalIntent.targetScope)
                    || (motion.proposalIntent.targetScope === 'COUNTRY'
                        && motion.proposalIntent.targetRegionId !== null)
                    || (motion.proposalIntent.targetScope === 'REGION'
                        && !motion.proposalIntent.targetRegionId)
                    || !Number.isFinite(motion.proposalIntent.previewedAt)
                    || motion.proposalIntent.worldMutation !== false))
                || !Array.isArray(motion.versions) || motion.versions.length < 1
                || motion.versions.length > 7
                || motion.versions.filter(version => version.status === 'ACTIVE').length !== 1
                || !motion.versions.some(version => version.id === motion.activeVersionId
                    && version.status === 'ACTIVE' && version.text === motion.text)
                || motion.versions.some((version, versionIndex) => !version
                    || version.id !== `${motion.id}:version:${versionIndex + 1}`
                    || version.sequence !== versionIndex + 1
                    || typeof version.text !== 'string' || version.text.length < 12 || version.text.length > 600
                    || !['ACTIVE', 'SUPERSEDED'].includes(version.status)
                    || version.createdByActorId !== (sourceSession && sourceSession.playerActorId)
                    || (versionIndex === 0 && version.sourceResponseId !== null)
                    || (versionIndex > 0 && !motion.responses.some(response =>
                        response.id === version.sourceResponseId && response.kind === 'AMENDMENT_REQUEST'
                        && response.status === 'ACCEPTED'))
                    || !Number.isFinite(version.createdAt) || version.worldMutation !== false)
                || !Array.isArray(motion.responses) || motion.responses.length > meeting.participantActorIds.length
                || (motion.status === 'OUT_OF_ORDER' && motion.responses.length !== 0)
                || (motion.status === 'PENDING_CHAIR_REVIEW' && motion.versions.length === 1
                    && motion.responses.length !== 0)
                || motion.responses.some((response, responseIndex) => !response
                    || response.id !== `${motion.id}:response:${responseIndex + 1}`
                    || response.sequence !== responseIndex + 1 || response.motionId !== motion.id
                    || !meeting.participantActorIds.includes(response.actorId)
                    || response.actorId === (sourceSession && sourceSession.playerActorId)
                    || !motion.versions.some(version => version.id === response.motionVersionId)
                    || motion.responses.some((other, otherIndex) => otherIndex < responseIndex
                        && other.actorId === response.actorId)
                    || !['OBJECTION', 'AMENDMENT_REQUEST', 'ENDORSEMENT'].includes(response.kind)
                    || (response.kind === 'ENDORSEMENT' && response.status !== 'NOTED')
                    || (response.kind === 'OBJECTION'
                        && !['OPEN', 'REFERRED_TO_CHAIR', 'RESOLVED_FOR_PROCEDURE'].includes(response.status))
                    || (response.kind !== 'OBJECTION' && response.referral != null)
                    || (response.kind === 'OBJECTION' && response.status === 'OPEN'
                        && (response.referral != null || response.resolution != null))
                    || (response.kind === 'OBJECTION' && response.status !== 'OPEN'
                        && (!response.referral
                            || response.referral.referredByActorId !== (sourceSession && sourceSession.playerActorId)
                            || !publicTurnIds.includes(response.referral.referralTurnId)
                            || !meeting.turns.some(turn => turn.id === response.referral.referralTurnId
                                && turn.actorId === (sourceSession && sourceSession.playerActorId)
                                && turn.kind === 'MOTION_OBJECTION_REFERRED')
                            || !Number.isFinite(response.referral.referredAt)
                            || response.referral.worldMutation !== false))
                    || (response.kind === 'OBJECTION' && response.status === 'REFERRED_TO_CHAIR'
                        && response.resolution != null)
                    || (response.kind === 'OBJECTION' && response.status === 'RESOLVED_FOR_PROCEDURE'
                        && (!response.resolution
                            || !['MOOT_BY_REVISION', 'DISSENT_RECORDED'].includes(response.resolution.ruling)
                            || response.resolution.chairActorId !== meeting.chair.actorId
                            || response.resolution.chairInstitutionId !== meeting.chair.institutionId
                            || response.resolution.authoritySource !== 'CANONICAL_INSTITUTION_OFFICE'
                            || !publicTurnIds.includes(response.resolution.rulingTurnId)
                            || !meeting.turns.some(turn => turn.id === response.resolution.rulingTurnId
                                && turn.actorId === meeting.chair.actorId
                                && turn.kind === 'MOTION_OBJECTION_CHAIR_RULING')
                            || response.resolution.preservesDissent
                                !== (response.resolution.ruling === 'DISSENT_RECORDED')
                            || !Number.isFinite(response.resolution.decidedAt)
                            || response.resolution.worldMutation !== false))
                    || (response.kind === 'AMENDMENT_REQUEST'
                        && !['OPEN', 'ACCEPTED', 'REJECTED'].includes(response.status))
                    || (response.kind === 'AMENDMENT_REQUEST' && response.status === 'OPEN'
                        && response.resolution != null)
                    || (response.kind === 'AMENDMENT_REQUEST' && response.status !== 'OPEN'
                        && (!response.resolution
                            || response.resolution.decision !== (response.status === 'ACCEPTED' ? 'ACCEPT' : 'REJECT')
                            || response.resolution.decidedByActorId !== (sourceSession && sourceSession.playerActorId)
                            || !publicTurnIds.includes(response.resolution.decisionTurnId)
                            || !meeting.turns.some(turn => turn.id === response.resolution.decisionTurnId
                                && turn.actorId === (sourceSession && sourceSession.playerActorId)
                                && turn.kind === `MOTION_AMENDMENT_${response.status}`)
                            || !Number.isFinite(response.resolution.decidedAt)
                            || response.resolution.worldMutation !== false))
                    || !['SUPPORT', 'LEAN_SUPPORT', 'UNDECIDED', 'LEAN_OPPOSE', 'OPPOSE']
                        .includes(response.stanceDirection)
                    || !Array.isArray(response.sourceRefs) || !response.sourceRefs.includes(motion.id)
                    || !publicTurnIds.includes(response.turnId)
                    || !meeting.turns.some(turn => turn.id === response.turnId
                        && turn.actorId === response.actorId
                        && turn.kind === `MOTION_${response.kind}`
                        && turn.sourceRefs.includes(motion.id)
                        && response.sourceRefs.every(ref => turn.sourceRefs.includes(ref)))
                    || !Number.isFinite(response.createdAt) || response.worldMutation !== false)
                || !['PENDING_CHAIR_REVIEW', 'IN_ORDER', 'OUT_OF_ORDER'].includes(motion.status)
                || (motion.status === 'PENDING_CHAIR_REVIEW' && motion.chairReview !== null)
                || (motion.status !== 'PENDING_CHAIR_REVIEW' && (!motion.chairReview
                    || motion.chairReview.chairActorId !== meeting.chair.actorId
                    || motion.chairReview.chairInstitutionId !== meeting.chair.institutionId
                    || motion.chairReview.authoritySource !== 'CANONICAL_INSTITUTION_OFFICE'
                    || !Array.isArray(motion.chairReview.matchedAgendaTerms)
                    || (motion.status === 'IN_ORDER' && motion.chairReview.matchedAgendaTerms.length === 0)
                    || (motion.status === 'OUT_OF_ORDER' && motion.chairReview.matchedAgendaTerms.length !== 0)
                    || !publicTurnIds.includes(motion.chairReview.rulingTurnId)
                    || !Number.isFinite(motion.chairReview.reviewedAt)
                    || !meeting.turns.some(turn => turn.id === motion.chairReview.rulingTurnId
                        && turn.actorId === meeting.chair.actorId
                        && turn.kind === 'CHAIR_MOTION_RULING'
                        && turn.sourceRefs.includes(motion.id)
                        && turn.sourceRefs.includes(meeting.chair.institutionId))
                    || motion.chairReview.worldMutation !== false))
                || (motion.voting == null && motion.outcomeReceiptId !== null)
                || (motion.voting != null && (motion.voting.schemaVersion !== 1
                    || !['OPEN', 'COMPLETED'].includes(motion.voting.status)
                    || motion.voting.motionVersionId !== motion.activeVersionId
                    || motion.status !== 'IN_ORDER'
                    || motion.voting.openedByActorId !== meeting.chair.actorId
                    || motion.voting.chairInstitutionId !== meeting.chair.institutionId
                    || motion.voting.authoritySource !== 'CANONICAL_INSTITUTION_OFFICE'
                    || !publicTurnIds.includes(motion.voting.openTurnId)
                    || !meeting.turns.some(turn => turn.id === motion.voting.openTurnId
                        && turn.actorId === meeting.chair.actorId
                        && turn.kind === 'MOTION_VOTE_OPENED'
                        && turn.sourceRefs.includes(motion.id)
                        && turn.sourceRefs.includes(motion.activeVersionId))
                    || !Number.isFinite(motion.voting.openedAt)
                    || (motion.voting.status === 'OPEN'
                        && (motion.voting.completedAt !== null || motion.outcomeReceiptId !== null))
                    || (motion.voting.status === 'COMPLETED'
                        && (!Number.isFinite(motion.voting.completedAt) || !motion.outcomeReceiptId))
                    || (motion.responses || []).some(response =>
                        (response.kind === 'AMENDMENT_REQUEST' && response.status === 'OPEN')
                        || (response.kind === 'OBJECTION' && response.status !== 'RESOLVED_FOR_PROCEDURE'))
                    || motion.voting.worldMutation !== false))
                || motion.worldMutation !== false)) {
            add('MEETING_MOTIONS', `${at}.motions`);
        }
        if (!Array.isArray(meeting.votes)
            || meetingVotes.length > meeting.participantActorIds.length * Math.max(1, meeting.motions.length)
            || meetingVotes.some((vote, voteIndex) => {
                const motion = meeting.motions.find(row => row.id === (vote && vote.motionId));
                return !vote || vote.schemaVersion !== 1
                    || vote.id !== `${meeting.id}:vote:${voteIndex + 1}` || vote.sequence !== voteIndex + 1
                    || !motion || !motion.voting || vote.motionVersionId !== motion.voting.motionVersionId
                    || !meeting.participantActorIds.includes(vote.actorId)
                    || !['YES', 'NO', 'ABSTAIN'].includes(vote.choice)
                    || meetingVotes.some((other, otherIndex) => otherIndex < voteIndex
                        && other.motionId === vote.motionId
                        && other.motionVersionId === vote.motionVersionId
                        && other.actorId === vote.actorId)
                    || typeof vote.basis !== 'string' || !vote.basis
                    || !Array.isArray(vote.sourceRefs) || !vote.sourceRefs.includes(vote.motionId)
                    || !vote.sourceRefs.includes(vote.motionVersionId)
                    || !publicTurnIds.includes(vote.turnId)
                    || !meeting.turns.some(turn => turn.id === vote.turnId
                        && turn.actorId === vote.actorId && turn.kind === 'MOTION_VOTE'
                        && vote.sourceRefs.every(ref => turn.sourceRefs.includes(ref)))
                    || !Number.isFinite(vote.castAt) || vote.worldMutation !== false;
            })) add('MEETING_VOTES', `${at}.votes`);
        if (!Array.isArray(meeting.outcomeReceipts)
            || outcomeReceipts.some((receipt, receiptIndex) => {
                const motion = meeting.motions.find(row => row.id === (receipt && receipt.motionId));
                const receiptVoteIds = receipt && Array.isArray(receipt.voteIds) ? receipt.voteIds : [];
                const receiptVotes = meetingVotes.filter(vote => receiptVoteIds.includes(vote.id));
                const sourceSession = (candidate.sessions || []).find(row => row.id === meeting.sessionId);
                const relationshipIds = receipt && receipt.relationshipResultReceiptIds;
                const expectedRelationshipActors = sourceSession
                    ? meeting.participantActorIds.filter(actorId => actorId !== sourceSession.playerActorId) : [];
                const relationshipLinksValid = Array.isArray(relationshipIds) && (relationshipIds.length === 0
                    || (relationshipIds.length === expectedRelationshipActors.length
                        && relationshipIds.every((relationshipId, relationshipIndex) => {
                            const relationshipReceipt = relationshipReceipts[relationshipId];
                            const observerActorId = expectedRelationshipActors[relationshipIndex];
                            const playerVote = receiptVotes.find(row =>
                                row.actorId === sourceSession.playerActorId);
                            const observerVote = receiptVotes.find(row => row.actorId === observerActorId);
                            const expectedNoChangeReason = receipt.decision !== 'ADOPTED'
                                ? 'MEETING_REJECTED'
                                : !playerVote || playerVote.choice !== 'YES' ? 'PLAYER_VOTE_NOT_YES'
                                    : !observerVote || observerVote.choice !== 'YES'
                                        ? 'OBSERVER_VOTE_NOT_YES' : null;
                            return relationshipReceipt
                                && relationshipReceipt.sourceType === 'MEETING_OUTCOME'
                                && relationshipReceipt.sourceReceiptId === receipt.id
                                && relationshipReceipt.fromActorId === observerActorId
                                && relationshipReceipt.toActorId === sourceSession.playerActorId
                                && relationshipReceipt.interpretationType === 'MEETING_SHARED_SUCCESS'
                                && (expectedNoChangeReason
                                    ? relationshipReceipt.decision === 'NO_CHANGE'
                                        && relationshipReceipt.reason === expectedNoChangeReason
                                    : relationshipReceipt.decision === 'APPLIED'
                                        && relationshipReceipt.reason === 'POLICY_APPLIED');
                        })));
                const tally = receiptVotes.reduce((sum, vote) => {
                    sum[vote.choice.toLowerCase()]++;
                    return sum;
                }, { yes: 0, no: 0, abstain: 0 });
                return !receipt || receipt.schemaVersion !== STORY_CONVERSATION_MEETING_OUTCOME_RECEIPT_SCHEMA_VERSION
                    || receipt.id !== `${meeting.id}:outcome:${receiptIndex + 1}`
                    || receipt.sequence !== receiptIndex + 1 || receipt.meetingCaseId !== meeting.id
                    || !motion || receipt.agendaItemId !== motion.agendaItemId
                    || receipt.motionVersionId !== motion.activeVersionId
                    || motion.outcomeReceiptId !== receipt.id
                    || !motion.voting || motion.voting.status !== 'COMPLETED'
                    || !Array.isArray(receipt.voteIds)
                    || receipt.voteIds.length !== meeting.participantActorIds.length
                    || receiptVotes.length !== receipt.voteIds.length
                    || new Set(receiptVotes.map(vote => vote.actorId)).size !== meeting.participantActorIds.length
                    || JSON.stringify(receipt.tally) !== JSON.stringify(tally)
                    || receipt.decision !== (tally.yes > tally.no ? 'ADOPTED' : 'REJECTED')
                    || !publicTurnIds.includes(receipt.completedByTurnId)
                    || receipt.completedByTurnId !== receiptVotes[receiptVotes.length - 1].turnId
                    || !Number.isFinite(receipt.completedAt)
                    || !relationshipLinksValid
                    || receipt.authoritySource !== 'MEETING_RECORDED_VOTE'
                    || receipt.physicalMutation !== false || receipt.worldMutation !== false;
            })
            || (outcomeReceipts.length === 0 && meeting.outcomeReceiptId !== null)
            || (outcomeReceipts.length > 0
                && meeting.outcomeReceiptId !== outcomeReceipts[outcomeReceipts.length - 1].id)
            || meeting.worldMutation !== false) add('MEETING_OUTCOME_RECEIPTS', at);
    }
    const meetingClosures = Array.isArray(candidate.meetingClosures)
        ? candidate.meetingClosures : [];
    if (!Array.isArray(candidate.meetingClosures)
        || candidate.meetingClosures.length > STORY_CONVERSATION_MEETING_LIMIT
        || meetingClosures.some((closure, closureIndex) => {
            const meeting = closure && meetingById.get(closure.meetingCaseId);
            const receipt = meeting && (meeting.outcomeReceipts || []).find(row =>
                row.id === closure.outcomeReceiptId);
            const motion = meeting && meeting.motions.find(row => row.id === closure.motionId);
            return !closure || closure.schemaVersion !== 1
                || closure.id !== `meeting-closure:${closureIndex + 1}`
                || closure.sequence !== closureIndex + 1
                || !meeting || meeting.closureId !== closure.id
                || closure.sessionId !== meeting.sessionId
                || closure.conversationCaseId !== meeting.conversationCaseId
                || closure.agendaItemId !== meeting.agendaItems[0].id
                || !receipt || receipt.motionId !== closure.motionId
                || receipt.motionVersionId !== closure.motionVersionId
                || receipt.decision !== closure.decision
                || !Array.isArray(closure.relationshipResultReceiptIds)
                || JSON.stringify(closure.relationshipResultReceiptIds)
                    !== JSON.stringify(receipt.relationshipResultReceiptIds)
                || !motion || motion.activeVersionId !== closure.motionVersionId
                || !['ADOPTED', 'REJECTED'].includes(closure.decision)
                || !((closure.decision === 'ADOPTED'
                    && ['CLOSED_ADOPTED_PENDING_PROPOSAL',
                        'CLOSED_ADOPTED_PROPOSAL_ROUTED'].includes(closure.status))
                    || (closure.decision === 'REJECTED' && closure.status === 'CLOSED_REJECTED'))
                || meeting.status !== closure.status
                || closure.chairActorId !== meeting.chair.actorId
                || closure.chairInstitutionId !== meeting.chair.institutionId
                || closure.authoritySource !== 'CANONICAL_INSTITUTION_OFFICE'
                || !meeting.turns.some(turn => turn.id === closure.closingTurnId
                    && turn.actorId === meeting.chair.actorId
                    && turn.kind === 'MEETING_CLOSURE_RECORDED'
                    && turn.sourceRefs.includes(closure.outcomeReceiptId))
                || closure.proposalIntentId !== (motion.proposalIntent
                    && motion.proposalIntent.id || null)
                || (closure.status === 'CLOSED_ADOPTED_PENDING_PROPOSAL'
                    && (closure.proposalId !== null || closure.proposalActionType !== null
                        || closure.proposalStatus !== 'NOT_ROUTED' || closure.routedAt !== null))
                || (closure.status === 'CLOSED_ADOPTED_PROPOSAL_ROUTED'
                    && (!closure.proposalId
                        || closure.proposalActionType !== (motion.proposalIntent
                            && motion.proposalIntent.actionType)
                        || closure.proposalStatus !== 'INSTITUTION_REQUEST_CREATED'
                        || !Number.isFinite(closure.routedAt)))
                || (closure.status === 'CLOSED_REJECTED'
                    && (closure.proposalId !== null || closure.proposalActionType !== null
                        || closure.proposalStatus !== 'NOT_APPLICABLE_REJECTED'
                        || closure.routedAt !== null))
                || !Number.isFinite(closure.closedAt)
                || closure.physicalMutation !== false || closure.worldMutation !== false;
        })) {
        add('MEETING_CLOSURES', '$.meetingClosures');
    }
    for (const meeting of meetingById.values()) {
        const closure = meetingClosures.find(row => row.id === meeting.closureId);
        if ((meeting.status === 'OPEN_NO_DECISION_ADAPTER' && meeting.closureId !== null)
            || (meeting.status !== 'OPEN_NO_DECISION_ADAPTER' && !closure)) {
            add('MEETING_CLOSURE_REFERENCE', `$.meetingCases.${meeting.id}`);
        }
    }
    for (const [index, session] of (candidate.sessions || []).entries()) {
        if (!session.id || session.schemaVersion !== STORY_CONVERSATION_SESSION_SCHEMA_VERSION) add('SESSION_ID', `$.sessions[${index}]`);
        const conversationCase = session.conversationCase;
        if (!conversationCase || conversationCase.schemaVersion !== STORY_CONVERSATION_CASE_SCHEMA_VERSION
            || conversationCase.id !== `conversation-case:${session.id}`
            || conversationCase.sessionId !== session.id
            || !['SINGLE_PARTY', 'MULTI_PARTY'].includes(conversationCase.kind)) {
            add('CONVERSATION_CASE_SCHEMA', `$.sessions[${index}].conversationCase`);
        } else {
            if (!STORY_CONVERSATION_CASE_MODES.includes(conversationCase.mode)
                || conversationCase.mechanicalStatus !== STORY_CONVERSATION_CASE_MODE_STATUS[conversationCase.mode]) {
                add('CONVERSATION_CASE_MODE', `$.sessions[${index}].conversationCase.mode`);
            }
            const linkedMeeting = conversationCase.meetingCaseId
                ? meetingById.get(conversationCase.meetingCaseId) : null;
            const expectedParticipants = linkedMeeting ? linkedMeeting.participantActorIds
                : Array.from(new Set([session.playerActorId, session.listenerActorId]
                    .filter(Boolean).map(String)));
            if (JSON.stringify(conversationCase.participantActorIds) !== JSON.stringify(expectedParticipants)) {
                add('CONVERSATION_CASE_PARTICIPANTS', `$.sessions[${index}].conversationCase.participantActorIds`);
            }
            if ((linkedMeeting && conversationCase.kind !== 'MULTI_PARTY')
                || (!linkedMeeting && conversationCase.kind !== 'SINGLE_PARTY')
                || (conversationCase.meetingCaseId && !linkedMeeting)) {
                add('CONVERSATION_CASE_MEETING_REFERENCE', `$.sessions[${index}].conversationCase.meetingCaseId`);
            }
            if (!Array.isArray(conversationCase.modeHistory) || !conversationCase.modeHistory.length
                || conversationCase.modeHistory.some((row, modeIndex) => !row
                    || row.sequence !== modeIndex + 1 || !STORY_CONVERSATION_CASE_MODES.includes(row.to)
                    || row.worldMutation !== false)) {
                add('CONVERSATION_CASE_HISTORY', `$.sessions[${index}].conversationCase.modeHistory`);
            }
            if (!['taskOfferIds', 'confidentialityRecordIds', 'declarationDraftIds']
                .every(key => Array.isArray(conversationCase[key]))) {
                add('CONVERSATION_CASE_RECORDS', `$.sessions[${index}].conversationCase`);
            }
            if ((conversationCase.taskOfferIds || []).some(id => !taskOfferIds.has(id))) {
                add('CONVERSATION_CASE_TASK_REFERENCE', `$.sessions[${index}].conversationCase.taskOfferIds`);
            }
            if (conversationCase.worldMutation !== false) {
                add('CONVERSATION_CASE_MUTATION', `$.sessions[${index}].conversationCase.worldMutation`);
            }
        }
        if (session.worldMutation !== false || !session.candidate || session.candidate.worldMutation !== false
            || session.candidate.executable !== false) add('SESSION_MUTATION', `$.sessions[${index}]`);
        if (!['REJECTED', 'NEEDS_CLARIFICATION', 'READY_FOR_DOMAIN_REVIEW', 'READY_FOR_REVIEW', 'SOCIAL_RESPONSE_READY']
            .concat(STORY_CONVERSATION_REVIEW_STATUSES, STORY_CONVERSATION_RESOLUTION_STATUSES)
            .includes(session.status)) add('SESSION_STATUS', `$.sessions[${index}].status`);
        if ((session.turns || []).length > STORY_CONVERSATION_TURN_LIMIT) add('TURN_LIMIT', `$.sessions[${index}].turns`);
        if (!Array.isArray(session.followUps) || session.followUps.length > STORY_CONVERSATION_TURN_LIMIT
            || session.followUps.some(row => !row.id || !row.playerText || row.worldMutation !== false
                || !row.response || row.response.worldMutation !== false)) {
            add('FOLLOW_UPS', `$.sessions[${index}].followUps`);
        }
        if (!Array.isArray(session.listenerResponses)
            || session.listenerResponses.length > STORY_CONVERSATION_TURN_LIMIT
            || session.listenerResponses.some(row => row.worldMutation !== false)) {
            add('LISTENER_RESPONSES', `$.sessions[${index}].listenerResponses`);
        }
        for (const [responseIndex, response] of (session.listenerResponses || []).entries()) {
            if (!response.domainEvidence || (typeof storyConversationDomainValidate === 'function'
                && !storyConversationDomainValidate(response.domainEvidence).ok)) {
                add('DOMAIN_EVIDENCE', `$.sessions[${index}].listenerResponses[${responseIndex}].domainEvidence`);
            }
            if (response.domainEvidence) {
                const expectedDomain = storyConversationSessionExpectedDomainEvidence(session, response);
                if (!expectedDomain || JSON.stringify(expectedDomain) !== JSON.stringify(response.domainEvidence)) {
                    add('DOMAIN_EVIDENCE_SOURCE_MISMATCH',
                        `$.sessions[${index}].listenerResponses[${responseIndex}].domainEvidence`);
                }
            }
            if (response.dialogueMove && typeof storyDialogueMoveValidate === 'function'
                && !storyDialogueMoveValidate(response.dialogueMove).ok) {
                add('DIALOGUE_MOVE', `$.sessions[${index}].listenerResponses[${responseIndex}].dialogueMove`);
            }
            if (response.dialogueMove) {
                const expectedMove = storyConversationSessionExpectedDialogueMove(session, response);
                if (!expectedMove || JSON.stringify(expectedMove) !== JSON.stringify(response.dialogueMove)) {
                    add('DIALOGUE_MOVE_SOURCE_MISMATCH',
                        `$.sessions[${index}].listenerResponses[${responseIndex}].dialogueMove`);
                }
            }
        }
        if (!Array.isArray(session.playerResponses)
            || session.playerResponses.length > STORY_CONVERSATION_TURN_LIMIT
            || session.playerResponses.some(row => row.worldMutation !== false
                || typeof row.knowledgeMutation !== 'boolean')) {
            add('PLAYER_RESPONSES', `$.sessions[${index}].playerResponses`);
        }
        if (!Array.isArray(session.evidenceSubmissions)
            || session.evidenceSubmissions.some(row => !row.id || !row.sourceBeliefId
                || !row.listenerBeliefId || !row.worldFactId || !row.originEventId)) {
            add('EVIDENCE_SUBMISSIONS', `$.sessions[${index}].evidenceSubmissions`);
        }
        if (!session.concessions || typeof session.concessions !== 'object'
            || typeof session.concessions.useExistingCompany !== 'boolean'
            || !Array.isArray(session.concessions.withdrawnClaimIds)) {
            add('SESSION_CONCESSIONS', `$.sessions[${index}].concessions`);
        }
        if (session.resolution && !STORY_CONVERSATION_RESOLUTION_STATUSES.includes(session.resolution.status)) {
            add('SESSION_RESOLUTION', `$.sessions[${index}].resolution`);
        }
        if (session.domainReview) {
            const review = session.domainReview;
            if (review.schemaVersion !== STORY_CONVERSATION_DOMAIN_REVIEW_SCHEMA_VERSION
                || review.adapterVersion !== STORY_CONVERSATION_DOMAIN_REVIEW_ADAPTER_VERSION) add('DOMAIN_REVIEW_SCHEMA', `$.sessions[${index}].domainReview`);
            if (review.worldMutation !== false || review.executable !== false) add('DOMAIN_REVIEW_MUTATION', `$.sessions[${index}].domainReview`);
            if (!STORY_CONVERSATION_REVIEW_STATUSES.includes(review.sessionStatus)) add('DOMAIN_REVIEW_STATUS', `$.sessions[${index}].domainReview.sessionStatus`);
            if (!review.listenerKnowledge || review.listenerKnowledge.rawWorldRead !== false
                || !review.diagnostics || review.diagnostics.rawTradeLedgerRead !== false) add('DOMAIN_REVIEW_PRIVACY', `$.sessions[${index}].domainReview`);
            if (!Array.isArray(review.checks) || !review.checks.length) add('DOMAIN_REVIEW_CHECKS', `$.sessions[${index}].domainReview.checks`);
        }
        if (session.discourseState && typeof storyDiscourseStateValidate === 'function'
            && !storyDiscourseStateValidate(session.discourseState).ok) {
            add('DISCOURSE_STATE', `$.sessions[${index}].discourseState`);
        }
        const validation = storyConversationValidate(session.analysis);
        if (!validation.ok) add('ANALYSIS_INVALID', `$.sessions[${index}].analysis`);
    }
    return { ok: issues.length === 0, issues };
}

function storyConversationSessionSnapshot() {
    const ledger = storyConversationSessionEnsure();
    return storyConversationClone(ledger);
}

function storyConversationSessionForSave() {
    const snapshot = storyConversationSessionSnapshot();
    if (!storyConversationEnabled()) return null;
    const validation = storyConversationSessionValidateLedger(snapshot);
    if (!validation.ok) throw new Error(`Konuşma anlama defteri kaydedilemez: ${validation.issues.map(row => row.code).join(', ')}`);
    return snapshot;
}

function storyConversationSessionRestore(candidate) {
    if (!storyConversationEnabled()) {
        STORY.conversationUnderstanding = null;
        return null;
    }
    const clone = storyConversationSessionMigrateLedger(candidate);
    const validation = storyConversationSessionValidateLedger(clone);
    STORY.conversationUnderstanding = validation.ok ? clone : storyConversationSessionLedgerCreate();
    return STORY.conversationUnderstanding;
}
