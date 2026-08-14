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
const STORY_CONVERSATION_SERVICE_BOT_LANGUAGE = /\b(nasıl yardımcı olabilirim|size nasıl yardımcı|sana nasıl yardımcı|neler yapmamıza yardımcı|ne tür bir yardım ar[a-zçğıöşü]*|nasıl destek olabilirim|yardımcı olmamı ister|talebinizi belirt|konuyu belirt|daha fazla bilgi(?:ye ihtiyacım var| ver| paylaş)|daha fazla ayrıntı(?:ya gir(?:in)?|ya ihtiyacım var| ver(?:in)?)|sorularınızı açıkça belirt|lütfen başka bir konu seç|buyurun|emrinize amadeyim)\b/i;

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
        || storyFeatureEnabled('characters.conversationUnderstanding');
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
    if (storyConversationContains(folded, ['aramizda kalsin', 'gizli bilgi', 'bu bir sir', 'kimseye soyleme'])) add('SHARE_SECRET', 12);
    if (storyConversationContains(folded, ['blof yapiyorum', 'blöf yapıyorum'])) add('BLUFF_CANDIDATE', 16);
    if (storyConversationContains(folded, ['suclusun', 'sen yaptin', 'ihanet ettin', 'sorumlusu sensin'])) add('ACCUSE', 11);
    if (storyConversationContains(folded, ['yardim ederim', 'destek olurum', 'yanindayim'])) add('OFFER_SUPPORT', 9);
    if (storyConversationContains(folded, ['kabul etmiyorum', 'reddediyorum', 'olmaz'])) add('REJECT', 9);
    if (storyConversationContains(folded, ['karsilik olarak', 'ama su sartla', 'buna karsilik'])) add('COUNTER_OFFER', 9);
    if (storyConversationContains(folded, ['merhaba', 'selam', 'gunaydin', 'iyi gunler'])) add('GREETING', 13);
    if (storyConversationContains(folded, ['nasilsin', 'nasil gidiyor', 'keyfin nasil', 'gunun nasil', 'bugunun nasil'])) add('CHECK_IN', 15);
    if (storyConversationContains(folded, ['tesekkur ederim', 'tesekkurler', 'sag ol', 'minnettarim'])) add('THANK', 14);
    if (storyConversationContains(folded, ['ozur dilerim', 'kusura bakma', 'affedersin'])) add('APOLOGIZE', 14);
    if (storyConversationContains(folded, ['gorusuruz', 'hosca kal', 'kendine iyi bak', 'sonra konusuruz'])) add('FAREWELL', 14);
    if (storyConversationContains(folded, ['sence', 'ne dusunuyorsun', 'fikrin ne', 'senin gorusun'])) add('ASK_PERSONAL_OPINION', 13);
    if (storyConversationContains(folded, ['yardim eder misin', 'yardim edecek misin', 'yardim icin gelir misin',
        'yardim gerekiyor', 'yardim lazim', 'destek olur musun', 'destek verir misin', 'destegine ihtiyacim var'])) add('REQUEST_SUPPORT', 16);
    if (storyConversationContains(folded, ['bana guveniyor musun', 'bana guvenir misin',
        'bana guvenin var mi', 'bana güveniyor musun'])) add('ASK_RELATIONSHIP', 18);
    if (storyConversationContains(folded, ['dusman ordusu gordum', 'dusman askerleri gordum',
        'buyuk bir dusman gucu', 'asker yigiliyor', 'asker toplaniyor'])) add('REPORT_MILITARY', 18);
    if (storyConversationContains(folded, ['devlet hazinesi', 'hazine', 'kamu butcesi'])
        && storyConversationContains(folded, ['bosaliyor', 'eriyor', 'azaliyor', 'tukeniyor', 'acik veriyor'])) {
        add('REPORT_ECONOMIC', 18);
    }
    if (storyConversationContains(folded, ['ilk defa konusuyoruz', 'ilk kez konusuyoruz',
        'seninle ilk defa', 'daha once konusmadik', 'hayir sen', 'yanlis soyluyorsun'])) add('CORRECT_STATEMENT', 17);
    if (storyConversationContains(folded, ['bozuk musun', 'beni anlamiyor musun',
        'ne sacmaliyorsun', 'neden boylesin'])) add('CHALLENGE', 16);
    if (storyConversationContains(folded, ['bana bir gorev ver', 'bana gorev ver', 'bana is ver'])) add('REQUEST_ACTION', 18);
    if (storyConversationContains(folded, ['bana verebilecegin bir gorev', 'bana verebileceginiz bir gorev',
        'bana verebilecegin gorev', 'bana verebileceginiz gorev',
        'verebilecegin bir gorev var mi', 'verebileceginiz bir gorev var mi',
        'verebilecegin gorev var mi', 'verebileceginiz gorev var mi'])) add('REQUEST_ACTION', 18);
    if (storyConversationContains(folded, ['biraz konusalim', 'sohbet edelim', 'hava guzel',
        'hava sicak', 'hava soguk', 'hava yagmurlu', 'sicaklar', 'laflayalim'])) add('SMALL_TALK', 12);
    if (storyConversationContains(folded, ['beni uzuyor', 'beni uzdun', 'uzuldum', 'kirildim'])
        && storyConversationContains(folded, ['uydur', 'sucla', 'dusun'])) add('CHALLENGE', 17);
    if (storyConversationContains(folded, ['peki', 'tamam', 'anladim', 'olur'])) add('SMALL_TALK', 8);
    if (String(raw || '').includes('?') || storyConversationContains(folded, ['neden', 'nasil', 'ne zaman', 'nerede', 'kim', 'hangi'])) add('ASK_INFORMATION', 7);
    if (storyConversationContains(folded, ['istiyorum', 'yap', 'gonder', 'yonlendir',
        'is var mi', 'isiniz var mi', 'is verebilir', 'calisabilecegim'])) add('REQUEST_ACTION', 9);
    const ranked = Object.keys(scores).sort((a, b) => scores[b] - scores[a] || a.localeCompare(b, 'en'));
    return {
        primary: ranked[0] || 'UNKNOWN',
        secondary: ranked.slice(1, 4).filter(key => scores[key] >= 5),
        scores
    };
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

    const act = storyConversationSpeechAct(folded, sourceText);
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
    const militaryContext = storyConversationContains(folded, [
        'dusman', 'birlik', 'ordu', 'asker', 'cephe', 'sinir', 'askeri'
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
    const result = {
        schemaVersion: STORY_CONVERSATION_UNDERSTANDING_SCHEMA_VERSION,
        adapterVersion: STORY_CONVERSATION_UNDERSTANDING_ADAPTER_VERSION,
        ok: true, code: 'ANALYZED',
        analysisId: `conversation-analysis:${storyConversationHash(`${folded}|${context.listenerActorId || '-'}|${storyConversationKnownIds(context, 'shipment').join(',')}`).slice(9)}`,
        inputHash: storyConversationHash(folded), language: 'tr', source: STORY_CONVERSATION_UNDERSTANDING_SOURCE,
        worldMutation: false, speechAct: act.primary, secondaryActs: act.secondary,
        playerIntent: founding && resource && resource.mention === 'çelik' ? 'FOUND_STEEL_COMPANY'
            : founding ? 'FOUND_COMPANY' : redirect ? 'REDIRECT_SHIPMENT'
                : act.primary === 'REQUEST_SUPPORT' && militaryContext ? 'REQUEST_MILITARY_SUPPORT'
                : STORY_CONVERSATION_SOCIAL_ACTS.includes(act.primary) ? `SOCIAL_${act.primary}` : 'UNSPECIFIED',
        topic: commercial ? 'COMMERCE' : militaryContext ? 'MILITARY'
            : diplomaticContext ? 'DIPLOMACY'
            : politicalContext ? 'POLITICS'
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
const STORY_CONVERSATION_SESSION_SCHEMA_VERSION = 3;
const STORY_CONVERSATION_SESSION_ADAPTER_VERSION = 'story-conversation-session-ledger-3';
const STORY_CONVERSATION_SESSION_LIMIT = 32;
const STORY_CONVERSATION_TURN_LIMIT = 24;
const STORY_CONVERSATION_HISTORY_TOKEN_BUDGET = 6000;
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
        sessions: [],
        diagnostics: {
            prunedSessions: 0, rejectedReplies: 0, worldMutations: 0,
            domainReviews: 0, listenerBeliefReads: 0, rawWorldReads: 0,
            playerResponses: 0, knowledgeTransfers: 0, socialResponses: 0,
            socialFollowUps: 0, memoryRecalls: 0
        }
    };
}

function storyConversationSessionMigrateLedger(saved) {
    const ledger = storyConversationClone(saved);
    if (!ledger || typeof ledger !== 'object'
        || ![1, 2, STORY_CONVERSATION_SESSION_SCHEMA_VERSION].includes(Number(ledger.schemaVersion))) return null;
    ledger.schemaVersion = STORY_CONVERSATION_SESSION_SCHEMA_VERSION;
    ledger.adapterVersion = STORY_CONVERSATION_SESSION_ADAPTER_VERSION;
    ledger.diagnostics = Object.assign({
        prunedSessions: 0, rejectedReplies: 0, worldMutations: 0,
        domainReviews: 0, listenerBeliefReads: 0, rawWorldReads: 0,
        playerResponses: 0, knowledgeTransfers: 0, socialResponses: 0,
        socialFollowUps: 0, memoryRecalls: 0
    }, ledger.diagnostics || {});
    for (const session of (ledger.sessions || [])) {
        session.schemaVersion = STORY_CONVERSATION_SESSION_SCHEMA_VERSION;
        if (!Array.isArray(session.listenerResponses)) session.listenerResponses = [];
        if (!Array.isArray(session.playerResponses)) session.playerResponses = [];
        if (!Array.isArray(session.evidenceSubmissions)) session.evidenceSubmissions = [];
        if (!Array.isArray(session.followUps)) session.followUps = [];
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
    if ((session.listenerResponses || []).some(row => row.kind === 'SOCIAL_RESPONSE')
        && (STORY_CONVERSATION_SOCIAL_ACTS.includes(session.analysis.speechAct)
            || (session.listenerResponses || []).some(row =>
                row.source === 'DETERMINISTIC_GROUNDED_DISCOURSE_RESPONSE'))) {
        return 'SOCIAL_RESPONSE_READY';
    }
    if ((session.questions || []).some(row => row.status === 'OPEN')) return 'NEEDS_CLARIFICATION';
    if (session.domainReview && STORY_CONVERSATION_REVIEW_STATUSES.includes(session.domainReview.sessionStatus)) {
        return session.domainReview.sessionStatus;
    }
    return (session.domainChecks || []).length ? 'READY_FOR_DOMAIN_REVIEW' : 'READY_FOR_REVIEW';
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

function storyConversationSocialResponseText(session, speechAct, salt) {
    const style = storyConversationSocialVoice(session);
    const byAct = STORY_CONVERSATION_SOCIAL_LINES[speechAct];
    const sourceCandidates = byAct && (byAct[style.register] || byAct.GUARDED) || [];
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
        properties: { reply: { type: 'string', minLength: 2, maxLength: 420 } },
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
    if (!text || text.length > 420 || text === fallbackText) return null;
    const fallbackFolded = storyConversationFold(fallbackText);
    if (fallbackFolded.length >= 20 && storyConversationFold(text).includes(fallbackFolded)) return null;
    if (storyConversationSocialLLMTextIssue(text, validationContext, playerText)) return null;
    if (/\d/.test(text) || /\b(character|session|actor|worldMutation|system|assistant|user)\b/i.test(text)) return null;
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
        if (parsed.answeredQuestionIds.some(ref => typeof ref !== 'string')) return null;
    }
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
    const sentences = text.split(/[.!?]+/).map(row => row.trim()).filter(Boolean);
    if (!sentences.length || sentences.length > 4 || text.split(/\s+/).length > 70) return null;
    return text;
}

function storyConversationSocialLLMTextIssue(text, validationContext, playerText) {
    const value = String(text || '').trim();
    const folded = storyConversationFold(value);
    const player = storyConversationFold(playerText);
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
    if (!allowedRefs.size && playerMakesWorldClaim && replyAffirmsClaim && !replyKeepsClaimUnverified) {
        return 'UNVERIFIED_CLAIM_ADOPTED';
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
    if (/\d/.test(text)) return { ok: false, code: 'UNSOURCED_NUMBER' };
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
    return `KAYNAKLI BAĞLAM PAKETİ:\n${contextText}\n`
        + `GÜVENLİ ANLAM: ${response.text}\n\n`
        + `TEMAS DURUMU: ${Number(session.contactOrdinal) === 1 ? 'İLK GÖRÜŞME' : 'DAHA ÖNCE GÖRÜŞÜLDÜ'}\n`
        + `Bu aynı kesintisiz görüşmedir. Güvenli anlamı koruyarak karakterin doğal Türkçe cevabını yaz; `
        + `GÜVENLİ ANLAM cümlesini kelimesi kelimesine kopyalama. `
        + `Bir müşteri hizmetleri görevlisi veya dijital asistan gibi konuşma; “nasıl yardımcı olabilirim”, “talebinizi belirtin” ve “buyurun” deme. `
        + `İlk görüşmeyse “yeniden”, “tekrar”, “seni görmek güzel” veya ortak geçmiş ima eden bir ifade kullanma. `
        + `Oyuncunun ortak proje, eski görev veya önceki anlaşma iddiasını kaynaklı MEMORY kaydı yoksa gerçek ortak anı gibi onaylama. `
        + `Karakterin kendi gündemi, ruh hali ve ilişki mesafesi olan bir insan olduğunu hissettir; son söze somut tepki ver. `
        + `Oyuncunun söylediği konum ve tehditleri gerçek kabul etme; yalnız “söyledin/bildirdin, doğrulanmadı” diye aktar. `
        + `Karakterin veya oyuncunun konumu güvenli anlamda yoksa şehir adı uydurma. `
        + `Yeni kişi, olay, sayı, stok, anlaşma, emir, yetki veya dünya gerçeği ekleme. `
        + `Mekanik sonuç vaat etme. DİYALOG KARARI varsa moveId alanını aynen geri ver; yalnız gerçekten kullandığın izinli kaynakları usedRefs içine yaz. `
        + (Number(session.contactOrdinal) === 1
            ? `ZORUNLU SON KONTROL: Bu ilk temastır. MEMORY kaynağı yoksa geçmiş tanışıklık, önceki proje, eski görüşme veya yeniden karşılaşma yazma. `
            : '')
        + `Çıktı zarfı {"moveId":"...","reply":"cevap","usedRefs":[],"answeredQuestionIds":[],"introducedQuestion":null,"closing":false} olmalı; `
        + `DİYALOG KARARI yoksa yalnız {"reply":"cevap"} döndür. En fazla dört kısa cümle.`;
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
    const safeMarker = '\nGÜVENLİ ANLAM:';
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
        text: 'Yalnız bu kaynaklı bağlamı kullan; konuşma dünya komutu değildir.'
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
    const obligationRecall = typeof storyMemoryRecallForActor === 'function'
        ? storyMemoryRecallForActor(session.listenerActorId, {
            kinds: ['PROMISE', 'SECRET'], relatedActorId: session.playerActorId, limit: 6
        }) : null;
    const relevantMemories = explicitMemory.concat(obligationRecall && obligationRecall.records || []);
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
    if ((storyConversationContains(folded, ['kendini', 'kendinizi'])
        && storyConversationContains(folded, ['tanit']))
        || storyConversationContains(folded, ['sen kimsin', 'siz kimsiniz'])) return 'LISTENER_IDENTITY';
    if (storyConversationContains(folded, ['hangi sehirdeyim', 'neredeyim', 'ben neredeyim'])) return 'PLAYER_LOCATION';
    if (storyConversationContains(folded, ['hangi sehirdesiniz', 'neredesiniz', 'sen neredesin'])) return 'LISTENER_LOCATION';
    if (storyConversationContains(folded, ['hangi isi yapiyorsun', 'hangi isi yapiyorsunuz', 'goreviniz ne', 'gorevin ne',
        'isiniz nedir', 'isinizin nedir', 'isinin nedir', 'isin nedir', 'isin ne',
        'ne is yapiyorsun', 'ne is yapiyorsunuz'])) return 'LISTENER_ROLE';
    if (storyConversationContains(folded, ['rolunuz', 'rolun', 'devlet yoneticisi olarak gozuk',
        'devlet yoneticisi misiniz', 'devlet yoneticisi degil misiniz',
        'devlet yoneticisi misin', 'devlet yoneticisi degil misin',
        'muhalefet lideri oldugunuzu', 'muhalefet liderisin'])) return 'LISTENER_ROLE_CONFIRMATION';
    if (storyConversationContains(folded, ['devlet yonetmek bir sirket yonetmek degildir',
        'devlet sirket degildir', 'sirket yoneticisi degilsin', 'sirket yoneticisi degilsiniz'])) return 'ROLE_CONTRADICTION_REPAIR';
    if (storyConversationContains(folded, ['hangi sirkette calis', 'hangi firmada calis', 'sirketiniz hangisi'])) return 'LISTENER_ORGANIZATION';
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
    if (focus === 'REQUEST_JOB_OR_TASK') return {
        discourseAct: 'ANSWER_JOB_REQUEST_BOUNDARY',
        text: 'Şu anda sana verebileceğim doğrulanmış bir görev veya iş kaydı yok. Konuşma sürsün diye görev uydurmayacağım; gerçek bir ihtiyaç oluşursa kaynağı ve yetkisiyle görünmeli.'
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
        || response.source === 'DETERMINISTIC_GROUNDED_DISCOURSE_RESPONSE') {
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
            { maxTokens: 220, temperature: 0.35, priority: 100,
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
    return storyConversationDomainBuild({ analysis, inheritedClaims, roleView, memoryRefs });
}

function storyConversationSessionAttachDecisionContracts(session, response, analysis, sequence, inheritedClaims) {
    response.domainEvidence = storyConversationSessionDomainEvidence(
        session, response, analysis, inheritedClaims);
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
        : storyConversationSocialResponseText(session, session.analysis.speechAct, 0);
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
    const direct = storyConversationSocialResponseText(session, analysis.speechAct, sequence);
    if (direct) return direct.text;
    if (analysis.speechAct === 'ASK_INFORMATION') {
        return 'Bu soruyu doğrulayacak bilgim yok. Bilmediğim ayrıntıyı uydurmayacağım.';
    }
    if (sequence <= 1) {
        return 'Bu sözündeki amacı güvenle çıkaramadım. Ne istediğini biraz daha açık söyler misin?';
    }
    return 'Bu sözünü önceki konuşmayla güvenle bağlayamadım. Yeni iddianı veya isteğini açıkça belirt.';
}

function storyConversationSocialMemoryRecall(session, raw) {
    if (typeof storyMemoryRecallForActor !== 'function') return null;
    const folded = storyConversationFold(raw);
    const wantsMemory = storyConversationContains(folded, [
        'hatirliyor musun', 'hatirladin mi', 'onceki konusma', 'gecen konusma',
        'daha once', 'verdigin soz', 'verdigim soz', 'sozumu', 'sozunu', 'ne oldu'
    ]);
    if (!wantsMemory) return null;
    const wantsPromise = storyConversationContains(folded, ['soz', 'tuttuk', 'bozduk', 'ne oldu']);
    const recall = storyMemoryRecallForActor(session.listenerActorId, {
        kinds: wantsPromise ? ['PROMISE']
            : ['CONVERSATION', 'PROMISE', 'DECISION', 'CONFLICT', 'DEBT', 'RELATIONSHIP'],
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
    if (session.status !== 'SOCIAL_RESPONSE_READY') {
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
    const analysis = storyConversationAnalyze(text, {
        listenerActorId: session.listenerActorId,
        focusRegionId: session.focusRegionId
    });
    if (!analysis.ok) return { ok: false, code: analysis.code, worldMutation: false };
    const sequence = session.followUps.length + 1;
    const heldMemory = storyConversationSocialMemoryRecall(session, text);
    let grounded = !heldMemory && storyConversationGroundedFollowUp(session, analysis, text, sequence);
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
        enrichmentStatus: heldMemory || grounded ? 'NOT_REQUIRED' : 'NOT_QUEUED', llmUsed: false,
        memoryRecall: heldMemory && heldMemory.recall || null,
        evidenceIds: heldMemory && heldMemory.evidenceIds || [],
        rawWorldRead: false,
        worldMutation: false
    };
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
    if (!heldMemory && !grounded) storyConversationSessionQueueSocialLLM(session.id, response.id, text);
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
    storyConversationSessionBuildSocialResponse(session, ledger);
    session.status = storyConversationSessionStatus(session);
    session.candidate = storyConversationSessionCandidate(session);
    ledger.sessions.push(session);
    if (ledger.sessions.length > STORY_CONVERSATION_SESSION_LIMIT) {
        const remove = ledger.sessions.length - STORY_CONVERSATION_SESSION_LIMIT;
        ledger.sessions.splice(0, remove);
        ledger.diagnostics.prunedSessions += remove;
    }
    const openingResponse = session.listenerResponses.find(row => row.kind === 'SOCIAL_RESPONSE');
    if (openingResponse) storyConversationDiagnosticAppend(session, openingResponse, session.initialText, 'TURN_CREATED', 0);
    if (openingResponse) storyConversationSessionQueueSocialLLM(session.id, openingResponse.id, session.initialText);
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
        dialogueMove: response.dialogueMove || null
    };
}

function storyConversationSessionValidateLedger(candidate) {
    const issues = [];
    const add = (code, path) => issues.push({ code, path });
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return { ok: false, issues: [{ code: 'LEDGER_REQUIRED', path: '$' }] };
    }
    if (candidate.schemaVersion !== STORY_CONVERSATION_SESSION_SCHEMA_VERSION) add('SESSION_SCHEMA', '$.schemaVersion');
    if (candidate.adapterVersion !== STORY_CONVERSATION_SESSION_ADAPTER_VERSION) add('SESSION_ADAPTER', '$.adapterVersion');
    if (!Number.isInteger(candidate.nextSequence) || candidate.nextSequence < 1) add('NEXT_SEQUENCE', '$.nextSequence');
    if (!Array.isArray(candidate.sessions) || candidate.sessions.length > STORY_CONVERSATION_SESSION_LIMIT) add('SESSION_LIMIT', '$.sessions');
    for (const [index, session] of (candidate.sessions || []).entries()) {
        if (!session.id || session.schemaVersion !== STORY_CONVERSATION_SESSION_SCHEMA_VERSION) add('SESSION_ID', `$.sessions[${index}]`);
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
