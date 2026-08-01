// ═══════════════════════════════════════════════════════════════════════════
//  OYUNCU UI PROJEKSİYONU — Faz 10.1
//  ---------------------------------------------------------------------------
//  Ham dünya ve nedensellik defteri doğrudan UI'ya verilmez. Bu katman,
//  PlayerVisibleFact bilgi sınıflarını kalıcı etkilerle eşleştirir:
//    VERIFIED          → kesin önce/sonra veya delta gösterilebilir
//    ESTIMATED / RUMOR → yalnız değişim ve oyuncunun mevcut tahmini gösterilir
//    UNKNOWN           → olay ve etki oyuncu görünümüne hiç girmez
//
//  Projeksiyon salt-okunurdur. Komut payload'ları, aktörler ve bilinmeyen kaynak
//  anahtarları UI view-model'ine taşınmaz.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_PROJECTION_SCHEMA_VERSION = 1;
const STORY_PROJECTION_RECENT_SECONDS = 60;
const STORY_PROJECTION_MAX_ITEMS = 40;

const STORY_PROJECTION_DOMAIN_META = Object.freeze({
    territory: { title: 'TOPRAK', icon: '⌖' },
    society: { title: 'TOPLUM', icon: '◉' },
    economy: { title: 'EKONOMİ', icon: '▤' },
    military: { title: 'ASKERÎ', icon: '◆' },
    diplomacy: { title: 'DİPLOMASİ', icon: '◇' },
    government: { title: 'YÖNETİM', icon: '▣' }
});

const STORY_PROJECTION_COMMAND_LABELS = Object.freeze({
    'territory.transfer': 'Bölge kontrolü değişti',
    'welfare.adjust': 'Toplumsal refah güncellendi',
    'resource.flow': 'Kaynak akışı işlendi',
    'military.commander_move': 'Komutan intikali gerçekleşti',
    'diplomacy.treaty_set': 'Antlaşma durumu değişti',
    'diplomacy.relation_adjust': 'Diplomatik ilişki değişti'
});

const STORY_PROJECTION_EVENT_LABELS = Object.freeze({
    'territory.owner_changed': 'Bölge el değiştirdi',
    'welfare.changed': 'Refah değişti',
    'resource.changed': 'Kaynaklar değişti',
    'military.commander_moved': 'Komutan konum değiştirdi',
    'diplomacy.treaty_changed': 'Antlaşma değişti',
    'diplomacy.relation_changed': 'İlişki puanı değişti'
});

const STORY_PROJECTION_SOURCE_LABELS = Object.freeze({
    'income.city': 'Şehir gelirleri',
    'test.resource': 'Kaynak işlemi',
    'test.causality.move': 'Verilen intikal emri',
    'test.causality.transfer': 'Verilen kontrol emri',
    inflation: 'Enflasyon baskısı',
    unrest: 'Toplumsal huzursuzluk',
    strike: 'Grev etkisi',
    council: 'Konsey kararı',
    battle: 'Muharebe sonucu',
    siege: 'Kuşatma sonucu',
    conquest: 'Fetih sonucu',
    movement: 'İntikal emri',
    'territory.transfer': 'Bölge kontrolü'
});

function storyProjectionClone(value) {
    if (typeof storyWorldV2Clone === 'function') return storyWorldV2Clone(value);
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyProjectionFactIndex(knowledge) {
    const index = new Map();
    for (const fact of (knowledge && knowledge.facts) || []) {
        index.set(`${fact.subjectId}|${fact.field}`, fact);
    }
    return index;
}

function storyProjectionEntityName(world, subjectId) {
    const collections = ['countries', 'regions', 'characters'];
    for (const collectionName of collections) {
        const entity = (world[collectionName] || []).find(candidate => candidate.id === subjectId);
        if (entity) return String(entity.name || subjectId);
    }
    return String(subjectId || 'Bilinmeyen');
}

function storyProjectionCharacterSubject(world, playerCountryId, legacyCommanderId) {
    const candidates = (world.characters || []).filter(character => (
        Number(character.legacyId) === Number(legacyCommanderId)
    ));
    const own = candidates.find(character => character.ownerId === playerCountryId);
    if (own) return own.id;
    return candidates.length === 1 ? candidates[0].id : null;
}

function storyProjectionEffectBinding(effect, world, knowledge) {
    const path = String(effect && effect.path || '');
    let match = /^state:(-?\d+)\.(welfare|resources)$/.exec(path);
    if (match) {
        return {
            subjectId: `country:${match[1]}`,
            field: match[2],
            domain: match[2] === 'resources' ? 'economy' : 'society',
            label: match[2] === 'resources' ? 'Kaynaklar' : 'Refah',
            valueMap: value => storyProjectionClone(value)
        };
    }

    match = /^region:(-?\d+)\.ownerId$/.exec(path);
    if (match) {
        return {
            subjectId: `region:${match[1]}`,
            field: 'ownerId',
            domain: 'territory',
            label: 'Bölge kontrolü',
            valueMap: value => value == null ? null : `country:${value}`
        };
    }

    match = /^character:(-?\d+)\.node$/.exec(path);
    if (match) {
        const subjectId = storyProjectionCharacterSubject(
            world,
            knowledge.playerCountryId,
            Number(match[1])
        );
        if (!subjectId) return null;
        return {
            subjectId,
            field: 'regionId',
            domain: 'military',
            label: 'Komutan konumu',
            valueMap: value => value == null ? null : `region:${value}`
        };
    }

    // Diplomatik gerçekler henüz PlayerKnowledgeService içinde bilgi sınıfı
    // taşımıyor. Ham ilişki/antlaşma etkisini göstermek bilgi sızıntısı olur.
    return null;
}

function storyProjectionSourceLabel(source) {
    const key = String(source || '');
    if (STORY_PROJECTION_SOURCE_LABELS[key]) return STORY_PROJECTION_SOURCE_LABELS[key];
    if (key.startsWith('income.')) return 'Düzenli gelir';
    if (key.startsWith('expense.')) return 'Onaylanan harcama';
    if (key.startsWith('refund.')) return 'Kaynak iadesi';
    if (key.startsWith('faction.')) return 'Toplumsal grup etkisi';
    if (key.startsWith('economy.')) return 'Ekonomik koşullar';
    if (key.startsWith('council.')) return 'Konsey kararı';
    if (key.startsWith('battle.')) return 'Muharebe sonucu';
    return 'Sistem etkisi';
}

function storyProjectionEventLabel(type) {
    return STORY_PROJECTION_EVENT_LABELS[String(type || '')] || 'Dünya olayı';
}

function storyProjectionCommandLabel(type) {
    return STORY_PROJECTION_COMMAND_LABELS[String(type || '')] || 'Dünya kararı';
}

function storyProjectionDirection(effect, binding) {
    if (effect.operation === 'DELTA' && effect.delta && typeof effect.delta === 'object') {
        const total = Object.values(effect.delta).reduce((sum, value) => sum + (Number(value) || 0), 0);
        return total > 0 ? 'UP' : total < 0 ? 'DOWN' : 'MIXED';
    }
    if (typeof effect.before === 'number' && typeof effect.after === 'number') {
        return effect.after > effect.before ? 'UP' : effect.after < effect.before ? 'DOWN' : 'SAME';
    }
    if (binding.field === 'ownerId' && effect.before !== effect.after) return 'CHANGED';
    return 'CHANGED';
}

function storyProjectionCause(effect, ledger, binding) {
    const commands = new Map((ledger.commands || []).map(command => [command.id, command]));
    const events = new Map((ledger.events || []).map(event => [event.id, event]));
    const event = events.get(effect.eventId) || null;
    const command = event ? commands.get(event.commandId) || null : null;
    const chain = [];
    const seen = new Set();
    let cursor = event;
    while (cursor && !seen.has(cursor.id) && chain.length < 9) {
        seen.add(cursor.id);
        chain.push({
            kind: 'EVENT',
            id: cursor.id,
            label: storyProjectionEventLabel(cursor.type),
            time: Number(cursor.time) || 0
        });
        cursor = cursor.causeEventId ? events.get(cursor.causeEventId) || null : null;
    }
    chain.reverse();
    chain.unshift({
        kind: 'COMMAND',
        id: command ? command.id : null,
        label: storyProjectionCommandLabel(command && command.type),
        time: command ? Number(command.time) || 0 : Number(effect.time) || 0
    });
    chain.push({
        kind: 'EFFECT',
        id: effect.id,
        label: `${binding.label}: ${storyProjectionSourceLabel(effect.source)}`,
        time: Number(effect.time) || 0
    });
    return {
        commandId: command ? command.id : null,
        eventId: event ? event.id : null,
        rootEventId: event ? event.rootEventId || event.id : null,
        summary: storyProjectionSourceLabel(effect.source),
        steps: chain
    };
}

function storyProjectionVisibleEffect(effect, world, knowledge, ledger, factIndex) {
    const binding = storyProjectionEffectBinding(effect, world, knowledge);
    if (!binding) return null;
    const fact = factIndex.get(`${binding.subjectId}|${binding.field}`);
    if (!fact || fact.status === PLAYER_FACT_STATUS.UNKNOWN) return null;

    const exact = fact.status === PLAYER_FACT_STATUS.VERIFIED;
    const mapValue = binding.valueMap || storyProjectionClone;
    const item = {
        id: `change:${effect.id}`,
        effectId: effect.id,
        sequence: Number(effect.sequence) || 0,
        observedAt: Number(effect.time) || 0,
        subjectId: binding.subjectId,
        subjectName: storyProjectionEntityName(world, binding.subjectId),
        domain: binding.domain,
        field: binding.field,
        label: binding.label,
        knowledge: {
            status: fact.status,
            confidenceBps: fact.confidenceBps,
            sourceType: fact.source && fact.source.type ? String(fact.source.type) : 'UNKNOWN',
            observedAt: Number(fact.observedAt) || 0
        },
        precision: exact ? 'EXACT' : 'OPAQUE',
        before: exact && effect.operation === 'SET' ? mapValue(effect.before) : null,
        after: exact && effect.operation === 'SET' ? mapValue(effect.after) : null,
        delta: exact && effect.operation === 'DELTA' ? storyProjectionClone(effect.delta) : null,
        visibleValue: storyProjectionClone(fact.value),
        direction: storyProjectionDirection(effect, binding),
        badge: {
            tone: storyProjectionDirection(effect, binding) === 'DOWN' ? 'NEGATIVE'
                : storyProjectionDirection(effect, binding) === 'UP' ? 'POSITIVE'
                    : 'NEUTRAL',
            text: exact ? binding.label : `${binding.label} hakkında yeni bilgi`
        },
        cause: storyProjectionCause(effect, ledger, binding)
    };
    return item;
}

function storyProjectionDomainCards(world, knowledge) {
    const own = (knowledge.countries || []).find(country => country.id === knowledge.playerCountryId);
    const ownedRegionCount = (world.regions || []).filter(region => region.ownerId === knowledge.playerCountryId).length;
    const ownCharacterCount = (world.characters || []).filter(character => character.ownerId === knowledge.playerCountryId).length;
    const cards = [
        {
            id: 'society',
            title: STORY_PROJECTION_DOMAIN_META.society.title,
            status: 'ACTIVE',
            facts: own ? [storyProjectionClone(own.welfare)] : []
        },
        {
            id: 'economy',
            title: STORY_PROJECTION_DOMAIN_META.economy.title,
            status: 'ACTIVE',
            facts: own ? [storyProjectionClone(own.inflation), storyProjectionClone(own.resources)] : []
        },
        {
            id: 'territory',
            title: STORY_PROJECTION_DOMAIN_META.territory.title,
            status: 'ACTIVE',
            summary: { ownedRegions: ownedRegionCount, knownRegions: (world.regions || []).length },
            facts: []
        },
        {
            id: 'military',
            title: STORY_PROJECTION_DOMAIN_META.military.title,
            status: 'ACTIVE',
            summary: { knownOwnCharacters: ownCharacterCount },
            facts: []
        },
        {
            id: 'government',
            title: STORY_PROJECTION_DOMAIN_META.government.title,
            status: 'ACTIVE',
            facts: own ? [storyProjectionClone(own.reputation)] : []
        },
        {
            id: 'diplomacy',
            title: STORY_PROJECTION_DOMAIN_META.diplomacy.title,
            status: 'NOT_IMPLEMENTED',
            facts: []
        }
    ];
    return cards;
}

function storyPlayerDomainProjection(world, knowledge, ledger, options) {
    options = options || {};
    if (typeof storyFeatureEnabled === 'function' && !storyFeatureEnabled('projection.causalityUi')) {
        throw new Error('Oyuncu nedensellik projeksiyonu özellik bayrağıyla kapalı.');
    }
    const worldValidation = storyWorldV2Validate(world);
    if (!worldValidation.ok) throw new StoryWorldValidationError(worldValidation.issues);
    const knowledgeValidation = storyPlayerKnowledgeValidate(knowledge);
    if (!knowledgeValidation.ok) throw new Error('Geçersiz PlayerKnowledge görünümü.');
    if (!ledger || !Array.isArray(ledger.commands) || !Array.isArray(ledger.events) || !Array.isArray(ledger.effects)) {
        throw new Error('Geçerli nedensellik defteri zorunlu.');
    }
    if (typeof storyCausalityValidate === 'function') {
        const causalityValidation = storyCausalityValidate(ledger);
        if (!causalityValidation.ok) throw new Error('Geçersiz nedensellik defteri.');
    }
    if (knowledge.worldCampaignId !== world.meta.campaignId) {
        throw new Error('Dünya ve oyuncu bilgi görünümü farklı kampanyalara ait.');
    }

    const factIndex = storyProjectionFactIndex(knowledge);
    const maxItems = Math.max(1, Math.min(200, Number(options.maxItems) || STORY_PROJECTION_MAX_ITEMS));
    const recentSeconds = Math.max(1, Number(options.recentSeconds) || STORY_PROJECTION_RECENT_SECONDS);
    const items = [];
    const effects = ledger.effects.slice().sort((a, b) => Number(b.sequence) - Number(a.sequence));
    for (const effect of effects) {
        const item = storyProjectionVisibleEffect(effect, world, knowledge, ledger, factIndex);
        if (item) items.push(item);
        if (items.length >= maxItems) break;
    }

    const domains = {};
    for (const [id, meta] of Object.entries(STORY_PROJECTION_DOMAIN_META)) {
        const domainItems = items.filter(item => item.domain === id);
        domains[id] = {
            id,
            title: meta.title,
            icon: meta.icon,
            itemCount: domainItems.length,
            recentCount: domainItems.filter(item => item.observedAt >= world.clock.gameTime - recentSeconds).length,
            latestAt: domainItems.length ? domainItems[0].observedAt : null
        };
    }

    return {
        schemaVersion: STORY_PROJECTION_SCHEMA_VERSION,
        playerCountryId: knowledge.playerCountryId,
        worldCampaignId: world.meta.campaignId,
        generatedAt: Number(world.clock.gameTime) || 0,
        recentSeconds,
        badgeCount: items.filter(item => item.observedAt >= world.clock.gameTime - recentSeconds).length,
        domains,
        domainCards: storyProjectionDomainCards(world, knowledge),
        items
    };
}

function storyPlayerProjectionValidate(view, knowledge, ledger) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!view || typeof view !== 'object' || Array.isArray(view)) {
        return { ok: false, issues: [{ code: 'VIEW_REQUIRED', path: '$', message: 'Projeksiyon nesnesi zorunlu.' }] };
    }
    if (view.schemaVersion !== STORY_PROJECTION_SCHEMA_VERSION) {
        add('SCHEMA_VERSION', '$.schemaVersion', `Beklenen projeksiyon sürümü ${STORY_PROJECTION_SCHEMA_VERSION}.`);
    }
    if (!Array.isArray(view.items)) add('ITEMS_ARRAY', '$.items', 'Değişim listesi dizi olmalı.');
    if (!Array.isArray(view.domainCards)) add('DOMAIN_CARDS_ARRAY', '$.domainCards', 'Domain kartları dizi olmalı.');
    if (issues.length) return { ok: false, issues };

    const facts = storyProjectionFactIndex(knowledge || { facts: [] });
    const effectIds = new Set(((ledger && ledger.effects) || []).map(effect => effect.id));
    const commandIds = new Set(((ledger && ledger.commands) || []).map(command => command.id));
    const eventIds = new Set(((ledger && ledger.events) || []).map(event => event.id));
    const ids = new Set();
    view.items.forEach((item, index) => {
        const at = `$.items[${index}]`;
        if (!item || typeof item !== 'object') {
            add('INVALID_ITEM', at, 'Değişim satırı nesne olmalı.');
            return;
        }
        if (ids.has(item.id)) add('DUPLICATE_ITEM', `${at}.id`, `Yinelenen değişim kimliği: ${item.id}`);
        ids.add(item.id);
        if (!effectIds.has(item.effectId)) add('BROKEN_EFFECT_REFERENCE', `${at}.effectId`, 'Kaynak etki bulunamadı.');
        if (!Object.prototype.hasOwnProperty.call(STORY_PROJECTION_DOMAIN_META, item.domain)) {
            add('INVALID_DOMAIN', `${at}.domain`, 'Bilinmeyen UI domaini.');
        }
        const fact = facts.get(`${item.subjectId}|${item.field}`);
        if (!fact || fact.status === PLAYER_FACT_STATUS.UNKNOWN) {
            add('HIDDEN_FACT_LEAK', at, 'Bilinmeyen gerçek değişim akışına sızdı.');
        } else if (fact.status !== PLAYER_FACT_STATUS.VERIFIED) {
            if (item.precision !== 'OPAQUE' || item.before !== null || item.after !== null || item.delta !== null) {
                add('IMPRECISE_FACT_EXACT_LEAK', at, 'Tahmin/söylenti kesin etki değeri taşıyamaz.');
            }
        } else if (item.precision !== 'EXACT') {
            add('VERIFIED_PRECISION', `${at}.precision`, 'Doğrulanmış etki kesin görünmelidir.');
        }
        if (!item.cause || !Array.isArray(item.cause.steps)) {
            add('CAUSE_REQUIRED', `${at}.cause`, 'Neden zinciri zorunlu.');
        } else {
            if (item.cause.commandId != null && !commandIds.has(item.cause.commandId)) {
                add('BROKEN_COMMAND_REFERENCE', `${at}.cause.commandId`, 'Kaynak komut bulunamadı.');
            }
            if (item.cause.eventId != null && !eventIds.has(item.cause.eventId)) {
                add('BROKEN_EVENT_REFERENCE', `${at}.cause.eventId`, 'Kaynak olay bulunamadı.');
            }
            for (const step of item.cause.steps) {
                if (Object.prototype.hasOwnProperty.call(step, 'payload')
                    || Object.prototype.hasOwnProperty.call(step, 'actor')
                    || Object.prototype.hasOwnProperty.call(step, 'target')) {
                    add('RAW_CAUSE_LEAK', `${at}.cause.steps`, 'Ham komut/olay verisi UI izine taşınamaz.');
                }
            }
        }
    });
    return { ok: issues.length === 0, issues };
}

function storyPlayerProjectionCurrent(options) {
    if (typeof storyFeatureEnabled === 'function' && !storyFeatureEnabled('projection.causalityUi')) {
        return {
            schemaVersion: STORY_PROJECTION_SCHEMA_VERSION,
            disabled: true,
            playerCountryId: null,
            worldCampaignId: null,
            generatedAt: Number(STORY && STORY.clock) || 0,
            recentSeconds: STORY_PROJECTION_RECENT_SECONDS,
            badgeCount: 0,
            domains: {},
            domainCards: [],
            items: []
        };
    }
    const world = storyWorldV2ExportValidated();
    const playerCountryId = storyWorldV2CountryId(STORY.playerStateId);
    const knowledge = storyPlayerKnowledgeProject(world, playerCountryId);
    const ledger = typeof storyCausalitySnapshot === 'function'
        ? storyCausalitySnapshot()
        : { commands: [], events: [], effects: [] };
    return storyPlayerDomainProjection(world, knowledge, ledger, options);
}
