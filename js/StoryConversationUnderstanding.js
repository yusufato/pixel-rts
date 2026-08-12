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

const STORY_CONVERSATION_SPEECH_ACTS = Object.freeze([
    'ASK_INFORMATION', 'PROPOSE_COMMERCIAL_DEAL', 'THREATEN', 'MAKE_PROMISE',
    'SHARE_SECRET', 'BLUFF_CANDIDATE', 'ACCUSE', 'REQUEST_ACTION',
    'OFFER_SUPPORT', 'COUNTER_OFFER', 'REJECT', 'GREETING', 'CHECK_IN',
    'THANK', 'APOLOGIZE', 'FAREWELL', 'ASK_PERSONAL_OPINION',
    'SMALL_TALK', 'REQUEST_SUPPORT', 'UNKNOWN'
]);
const STORY_CONVERSATION_SOCIAL_ACTS = Object.freeze([
    'GREETING', 'CHECK_IN', 'THANK', 'APOLOGIZE', 'FAREWELL',
    'ASK_PERSONAL_OPINION', 'SMALL_TALK', 'REQUEST_SUPPORT'
]);
const STORY_CONVERSATION_ENTITY_STATUSES = Object.freeze([
    'RESOLVED_PUBLIC', 'RESOLVED_OWNED', 'KNOWN_CONTEXT_REFERENCE',
    'RESOLVED_BY_PLAYER_CONFIRMATION', 'AMBIGUOUS_REFERENCE',
    'UNRESOLVED_REFERENCE', 'UNRESOLVED_CATALOG_GAP'
]);
const STORY_CONVERSATION_AMBIGUITY = Object.freeze(['LOW', 'MEDIUM', 'HIGH']);
const STORY_CONVERSATION_RISK = Object.freeze(['LOW', 'MEDIUM', 'HIGH']);

function storyConversationClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyConversationFold(value) {
    return String(value == null ? '' : value)
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
        .replace(/ı/g, 'i').replace(/İ/g, 'I')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('tr-TR')
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

function storyConversationApproxMention(folded, alias) {
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
    for (const token of tokens) {
        const forms = [token];
        for (const suffix of ['lerinden', 'larindan', 'lerden', 'lardan', 'inden', 'indan', 'den', 'dan', 'nin', 'in']) {
            if (token.endsWith(suffix) && token.length - suffix.length >= 5) forms.push(token.slice(0, -suffix.length));
        }
        for (const form of forms) {
            if (Math.abs(form.length - key.length) > 2 || Math.min(form.length, key.length) < 5) continue;
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
            const match = storyConversationApproxMention(folded, region.name);
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
    if (storyConversationContains(folded, ['yardim eder misin', 'yardim edecek misin', 'destek olur musun', 'destegine ihtiyacim var'])) add('REQUEST_SUPPORT', 14);
    if (storyConversationContains(folded, ['biraz konusalim', 'sohbet edelim', 'hava guzel', 'laflayalim'])) add('SMALL_TALK', 12);
    if (String(raw || '').includes('?') || storyConversationContains(folded, ['neden', 'nasil', 'ne zaman', 'nerede', 'kim', 'hangi'])) add('ASK_INFORMATION', 7);
    if (storyConversationContains(folded, ['istiyorum', 'yap', 'gonder', 'yonlendir'])) add('REQUEST_ACTION', 5);
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
    const founding = storyConversationContains(folded, ['sirket kur', 'sirketi kur', 'firma kur']);
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
    const requests = [];
    if (redirect) requests.push({
        id: 'request:redirect-shipment', type: 'REDIRECT_SHIPMENT',
        targetShipmentId: shipment && shipment.entityId || null,
        destinationId: (playerAssets.find(row => row.entityType === 'WAREHOUSE') || {}).entityId || null,
        requestedFromActorId: context.listenerActorId || null
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
    if (claims.some(row => row.truthStatus === 'UNVERIFIED_IN_CONVERSATION')) commandBlockedReasons.push('UNVERIFIED_CLAIM');
    if (redirect) commandBlockedReasons.push('AUTHORITY_NOT_CHECKED');

    const result = {
        schemaVersion: STORY_CONVERSATION_UNDERSTANDING_SCHEMA_VERSION,
        adapterVersion: STORY_CONVERSATION_UNDERSTANDING_ADAPTER_VERSION,
        ok: true, code: 'ANALYZED',
        analysisId: `conversation-analysis:${storyConversationHash(`${folded}|${context.listenerActorId || '-'}|${storyConversationKnownIds(context, 'shipment').join(',')}`).slice(9)}`,
        inputHash: storyConversationHash(folded), language: 'tr', source: STORY_CONVERSATION_UNDERSTANDING_SOURCE,
        worldMutation: false, speechAct: act.primary, secondaryActs: act.secondary,
        playerIntent: founding && resource && resource.mention === 'çelik' ? 'FOUND_STEEL_COMPANY'
            : founding ? 'FOUND_COMPANY' : redirect ? 'REDIRECT_SHIPMENT'
                : STORY_CONVERSATION_SOCIAL_ACTS.includes(act.primary) ? `SOCIAL_${act.primary}` : 'UNSPECIFIED',
        topic: commercial ? 'COMMERCE' : ['THREATEN', 'ACCUSE'].includes(act.primary) ? 'CONFLICT'
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
            rawTradeLedgerRead: false, llmUsed: false
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
    }
    return ledger;
}

function storyConversationSessionReset() {
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
    const validation = storyConversationSessionValidateLedger(STORY.conversationUnderstanding);
    if (!validation.ok) return storyConversationSessionReset();
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
    if (STORY_CONVERSATION_SOCIAL_ACTS.includes(session.analysis.speechAct)
        && (session.listenerResponses || []).some(row => row.kind === 'SOCIAL_RESPONSE')) {
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
        WARM: ['Merhaba. Seni görmek güzel; günün nasıl gidiyor?', 'Selam. Burada olmana sevindim; nasıl yardımcı olabilirim?',
            'Yeniden merhaba. Bugün aklında ne var?', 'Hoş geldin. Biraz konuşmak iyi olabilir; nereden başlayalım?'],
        DIRECT: ['Merhaba. Konuya geçebiliriz.', 'Selam. Söyle, neyi konuşacağız?',
            'Yeniden selam. Bu kez hangi konu var?', 'Buradayım. Ne söylemek istiyorsun?'],
        FORMAL: ['Merhaba. Görüşmeye hazırım; buyurun.', 'İyi günler. Ele almak istediğiniz konuyu söyleyin.',
            'Tekrar merhaba. Gündeminizdeki konuyu dinleyebilirim.', 'Hoş geldiniz. Görüşmeye nereden başlayalım?'],
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
    const candidates = byAct && (byAct[style.register] || byAct.GUARDED) || [];
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

function storyConversationSocialLLMSchema() {
    return {
        type: 'object', additionalProperties: false,
        properties: { reply: { type: 'string', minLength: 2, maxLength: 420 } },
        required: ['reply']
    };
}

function storyConversationSocialLLMParse(raw, fallbackText, playerText) {
    let parsed;
    try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (_) { return null; }
    const text = String(parsed && parsed.reply || '').trim().replace(/\s+/g, ' ');
    if (!text || text.length > 420 || text === fallbackText) return null;
    if (/\d/.test(text) || /\b(character|session|actor|worldMutation|system|assistant|user)\b/i.test(text)) return null;
    if (typeof LLM_EN_LEAK !== 'undefined' && LLM_EN_LEAK.test(text)) return null;
    if (typeof LLM_NONLATIN !== 'undefined' && LLM_NONLATIN.test(text)) return null;
    if (/\b(kabul ettim|onayladım|emri verdim|söz veriyorum|anlaşma tamam|sevkiyatı başlattım)\b/i.test(text)) return null;
    const playerFolded = storyConversationFold(playerText);
    const replyFolded = storyConversationFold(text);
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

function storyConversationSocialLLMPrompt(session, response, playerText) {
    const actor = typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(session.listenerActorId) : null;
    const history = [];
    if (session.initialText) history.push(`OYUNCU: ${session.initialText}`);
    const opening = (session.listenerResponses || []).find(row => row.kind === 'SOCIAL_RESPONSE');
    if (opening && opening.id !== response.id) history.push(`KARAKTER: ${opening.text}`);
    for (const followUp of (session.followUps || []).slice(-10)) {
        if (followUp.response && followUp.response.id === response.id) continue;
        history.push(`OYUNCU: ${followUp.playerText}`);
        if (followUp.response && followUp.response.text) history.push(`KARAKTER: ${followUp.response.text}`);
    }
    return `KARAKTER: ${actor && actor.name || 'Muhatap'}\nROL: ${actor && actor.role || 'CHARACTER'}\n`
        + `SES KAYDI: ${response.voiceFingerprint || 'GUARDED'}\nİLİŞKİ BANDI: ${response.relationshipBand || 'RESERVED'}\n`
        + `KONUŞMA GEÇMİŞİ:\n${history.join('\n') || '(ilk mesaj)'}\nOYUNCUNUN SON SÖZÜ: ${playerText}\n`
        + `GÜVENLİ ANLAM: ${response.text}\n\n`
        + `Bu aynı kesintisiz görüşmedir. Güvenli anlamı koruyarak karakterin doğal Türkçe cevabını yaz; `
        + `GÜVENLİ ANLAM cümlesini kelimesi kelimesine kopyalama. `
        + `Yeni kişi, olay, sayı, stok, anlaşma, emir, yetki veya dünya gerçeği ekleme. `
        + `Mekanik sonuç vaat etme. Yalnız {"reply":"cevap"} JSON nesnesi döndür; en fazla dört kısa cümle.`;
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
    response.enrichmentStatus = 'MODEL_LOADING';
    Promise.resolve(llmEnsure()).then(state => {
        const current = storyConversationSessionFind(sessionId);
        const currentResponse = current && findResponse(current);
        if (!currentResponse) return null;
        if (!state || !state.ready) {
            currentResponse.enrichmentStatus = 'FALLBACK_KEPT';
            mirrorResponse(current, currentResponse);
            return null;
        }
        currentResponse.enrichmentStatus = 'GENERATING';
        mirrorResponse(current, currentResponse);
        const fallbackText = currentResponse.text;
        return llmEnrich(
            'Modern bir strateji oyunundaki karakter olarak Türkçe konuş. Yalnız verilen bağlamı kullan.',
            storyConversationSocialLLMPrompt(current, currentResponse, playerText),
            raw => storyConversationSocialLLMParse(raw, fallbackText, playerText),
            { maxTokens: 180, temperature: 0.35, priority: 100, jsonSchema: storyConversationSocialLLMSchema() }
        ).then(text => {
            const live = storyConversationSessionFind(sessionId);
            const liveResponse = live && findResponse(live);
            if (!liveResponse) return;
            if (text) {
                liveResponse.text = text;
                liveResponse.source = 'LOCAL_LLM_CHARACTER_REALIZATION';
                liveResponse.enrichmentStatus = 'USED';
                liveResponse.llmUsed = true;
            } else {
                liveResponse.enrichmentStatus = 'FALLBACK_KEPT';
                liveResponse.llmUsed = false;
            }
            mirrorResponse(live, liveResponse);
            if (typeof storySave === 'function') storySave();
            if (typeof storyConversationWorkspacePatchResponse === 'function') {
                storyConversationWorkspacePatchResponse(liveResponse.id, liveResponse.text, liveResponse.enrichmentStatus);
            }
        });
    }).catch(() => {
        const current = storyConversationSessionFind(sessionId);
        const currentResponse = current && findResponse(current);
        if (currentResponse) {
            currentResponse.enrichmentStatus = 'FALLBACK_KEPT';
            mirrorResponse(current, currentResponse);
        }
    });
    return true;
}

function storyConversationSessionBuildSocialResponse(session, ledger) {
    if (!session || !session.analysis.ok || !session.listenerActorId
        || !STORY_CONVERSATION_SOCIAL_ACTS.includes(session.analysis.speechAct)) return null;
    const realized = storyConversationSocialResponseText(session, session.analysis.speechAct, 0);
    if (!realized) return null;
    const response = {
        schemaVersion: 1,
        id: `conversation-social-response:${session.id}:1`,
        kind: 'SOCIAL_RESPONSE',
        actorId: session.listenerActorId,
        targetActorId: session.playerActorId,
        speechAct: session.analysis.speechAct,
        createdAt: Number(STORY.clock) || 0,
        text: realized.text,
        source: 'CHARACTER_PROFILE_SOCIAL_RESPONSE',
        voiceFingerprint: realized.voice.fingerprint,
        relationshipBand: realized.voice.relationshipBand,
        enrichmentStatus: 'NOT_QUEUED', llmUsed: false,
        worldMutation: false
    };
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
    return 'Bunu önceki sözünün devamı olarak anladım. Ne demek istediğini biraz daha açar mısın?';
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
    const response = {
        schemaVersion: 1,
        id: `conversation-follow-up-response:${session.id}:${sequence}`,
        kind: 'FOLLOW_UP_RESPONSE',
        actorId: session.listenerActorId,
        targetActorId: session.playerActorId,
        speechAct: analysis.speechAct,
        createdAt: Number(STORY.clock) || 0,
        text: heldMemory ? heldMemory.text : storyConversationSocialFollowUpText(session, analysis, text, sequence),
        source: heldMemory ? 'CHARACTER_HELD_MEMORY_RECALL' : 'CHARACTER_PROFILE_SOCIAL_FOLLOW_UP',
        voiceFingerprint: storyConversationSocialVoice(session).fingerprint,
        relationshipBand: storyConversationSocialVoice(session).relationshipBand,
        enrichmentStatus: heldMemory ? 'NOT_REQUIRED' : 'NOT_QUEUED', llmUsed: false,
        memoryRecall: heldMemory && heldMemory.recall || null,
        evidenceIds: heldMemory && heldMemory.evidenceIds || [],
        rawWorldRead: false,
        worldMutation: false
    };
    const followUp = {
        schemaVersion: 1,
        id: `conversation-follow-up:${session.id}:${sequence}`,
        sequence,
        createdAt: Number(STORY.clock) || 0,
        playerText: text,
        inputHash: storyConversationHash(text),
        analysis: storyConversationClone(analysis),
        response,
        worldMutation: false
    };
    session.followUps.push(followUp);
    session.listenerResponses.push(storyConversationClone(response));
    session.updatedAt = Number(STORY.clock) || 0;
    session.candidate = storyConversationSessionCandidate(session);
    ledger.diagnostics.socialFollowUps++;
    if (heldMemory) ledger.diagnostics.memoryRecalls++;
    if (!heldMemory) storyConversationSessionQueueSocialLLM(session.id, response.id, text);
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
        focusRegionId: context.focusRegionId ? String(context.focusRegionId) : null,
        initialText: String(raw == null ? '' : raw),
        analysis: storyConversationClone(analysis),
        questions: storyConversationSessionQuestions(analysis, id),
        domainChecks: storyConversationSessionDomainChecks(analysis),
        resolvedEntities: {}, resolvedTerms: {}, turns: [], followUps: [], listenerResponses: [], playerResponses: [],
        evidenceSubmissions: [], concessions: { useExistingCompany: false, withdrawnClaimIds: [] },
        resolution: null, status: null, domainReview: null, candidate: null, worldMutation: false
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
