// ═══════════════════════════════════════════════════════════════════════════
//  KARAKTER KİMLİĞİ VE HEDEFLERİ — Faz 34 çekirdeği
//  ---------------------------------------------------------------------------
//  Eski `axes + üç yetenek` kaydını silmez; onu sürümlü, kanonik bir karakter
//  kimliğine göç ettirir. Kimlik karar vermez ve yetkili eylemi yasaklamaz.
//  Yalnız adayları puanlar, gerekçesini açıklar ve konuşma stratejisine bağlam
//  verir. Mekanik sonuç yine ilgili domain/kurum kapısından geçer.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_CHARACTER_IDENTITY_SCHEMA_VERSION = 4;
const STORY_CHARACTER_IDENTITY_ADAPTER_VERSION = 'story-character-identity-ledger-4';
const STORY_CHARACTER_CREATION_POLICY_VERSION = 'story-character-paid-decisions-1';
const STORY_CHARACTER_CORE_AXES = Object.freeze([
    'stateMarketOrientation',
    'nationalGlobalOrientation',
    'popularTechnocraticStyle',
    'institutionalPosture'
]);

// Her seçenek dünyada aynı anda bir kazanç ve bir bedel uygular. Sayılar küçük
// tutulur; amaç karakter ekranından ekonomik üstünlük satın almak değil,
// geçmiş kararının oynanışta gerçek ve açıklanabilir bir izi olmasıdır.
const STORY_CHARACTER_DECISION_EFFECTS = Object.freeze({
    harp: Object.freeze({
        sert: Object.freeze({
            gain: { scope: 'COMMANDER_RESOURCE', key: 'manpower', amount: 6, label: 'Sefer insan gücü +6' },
            cost: { scope: 'PLAYER_STATE', key: 'reputation', amount: -1, label: 'Devlet itibarı -1' },
            visibility: 'PUBLIC', reactionHook: 'SECURITY_EXPECTATION'
        }),
        kurnaz: Object.freeze({
            gain: { scope: 'COMMANDER_RESOURCE', key: 'points', amount: 7, label: 'Komuta puanı +7' },
            cost: { scope: 'PLAYER_STATE', key: 'reputation', amount: -1, label: 'Devlet itibarı -1' },
            visibility: 'PRIVATE', reactionHook: 'HIDDEN_CHANNEL_EXPOSURE'
        }),
        halkci: Object.freeze({
            gain: { scope: 'PLAYER_STATE', key: 'reputation', amount: 1, label: 'Devlet itibarı +1' },
            cost: { scope: 'COMMANDER_RESOURCE', key: 'points', amount: -5, label: 'Komuta puanı -5' },
            visibility: 'PUBLIC', reactionHook: 'PUBLIC_PROMISE_EXPECTATION'
        }),
        uzman: Object.freeze({
            gain: { scope: 'PLAYER_STATE', key: 'techPoints', amount: 1, label: 'Araştırma fonu +1' },
            cost: { scope: 'COMMANDER_RESOURCE', key: 'points', amount: -5, label: 'Komuta puanı -5' },
            visibility: 'INSTITUTIONAL', reactionHook: 'EVIDENCE_STANDARD_EXPECTATION'
        })
    }),
    idare: Object.freeze({
        sert: Object.freeze({
            gain: { scope: 'COMMANDER_RESOURCE', key: 'oil', amount: 6, label: 'Sefer yakıtı +6' },
            cost: { scope: 'COMMANDER_RESOURCE', key: 'points', amount: -4, label: 'Komuta puanı -4' },
            visibility: 'INSTITUTIONAL', reactionHook: 'EXECUTIVE_CONTROL_EXPECTATION'
        }),
        kurnaz: Object.freeze({
            gain: { scope: 'COMMANDER_RESOURCE', key: 'points', amount: 7, label: 'Komuta puanı +7' },
            cost: { scope: 'PLAYER_STATE', key: 'reputation', amount: -1, label: 'Devlet itibarı -1' },
            visibility: 'PRIVATE', reactionHook: 'PATRONAGE_SCRUTINY'
        }),
        halkci: Object.freeze({
            gain: { scope: 'PLAYER_STATE', key: 'reputation', amount: 1, label: 'Devlet itibarı +1' },
            cost: { scope: 'COMMANDER_RESOURCE', key: 'points', amount: -6, label: 'Komuta puanı -6' },
            visibility: 'PUBLIC', reactionHook: 'SERVICE_DELIVERY_EXPECTATION'
        }),
        uzman: Object.freeze({
            gain: { scope: 'PLAYER_STATE', key: 'techPoints', amount: 1, label: 'Araştırma fonu +1' },
            cost: { scope: 'COMMANDER_RESOURCE', key: 'oil', amount: -6, label: 'Sefer yakıtı -6' },
            visibility: 'INSTITUTIONAL', reactionHook: 'MEASUREMENT_COMMITMENT'
        })
    }),
    siyaset: Object.freeze({
        sert: Object.freeze({
            gain: { scope: 'COMMANDER_RESOURCE', key: 'manpower', amount: 5, label: 'Sefer insan gücü +5' },
            cost: { scope: 'COMMANDER_RESOURCE', key: 'points', amount: -5, label: 'Komuta puanı -5' },
            visibility: 'PUBLIC', reactionHook: 'AUTHORITY_ACCOUNTABILITY'
        }),
        kurnaz: Object.freeze({
            gain: { scope: 'COMMANDER_RESOURCE', key: 'points', amount: 7, label: 'Komuta puanı +7' },
            cost: { scope: 'PLAYER_STATE', key: 'reputation', amount: -1, label: 'Devlet itibarı -1' },
            visibility: 'PRIVATE', reactionHook: 'POLITICAL_LEVERAGE_EXPOSURE'
        }),
        halkci: Object.freeze({
            gain: { scope: 'PLAYER_STATE', key: 'reputation', amount: 1, label: 'Devlet itibarı +1' },
            cost: { scope: 'COMMANDER_RESOURCE', key: 'oil', amount: -5, label: 'Sefer yakıtı -5' },
            visibility: 'PUBLIC', reactionHook: 'PUBLIC_CONSISTENCY_TEST'
        }),
        uzman: Object.freeze({
            gain: { scope: 'PLAYER_STATE', key: 'techPoints', amount: 1, label: 'Araştırma fonu +1' },
            cost: { scope: 'COMMANDER_RESOURCE', key: 'points', amount: -5, label: 'Komuta puanı -5' },
            visibility: 'INSTITUTIONAL', reactionHook: 'INSTITUTIONAL_CONSISTENCY_TEST'
        })
    })
});

function storyCharacterIdentityEnabled() {
    return typeof storyFeatureEnabled !== 'function' || storyFeatureEnabled('characters.identityGoals');
}
function storyCharacterIdentityClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}
function storyCharacterIdentityClamp(value) {
    return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}
function storyCharacterIdentityHash(text) {
    let hash = 2166136261 >>> 0;
    for (const char of String(text || '')) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
}
function storyCharacterIdentityJitter(id, channel, amplitude) {
    const unit = storyCharacterIdentityHash(`${id}|${channel}`) / 0xffffffff;
    return Math.round((unit * 2 - 1) * amplitude);
}
function storyCharacterIdentityRole(commander, president) {
    if (president) return 'EXECUTIVE';
    if (commander && commander.isPlayer) {
        const selected = String(commander.creationRole || 'COMMANDER').toUpperCase();
        return ['COMMANDER', 'COMPANY_OWNER', 'MAYOR', 'EXECUTIVE', 'AGENT', 'CIVILIAN'].includes(selected)
            ? selected : 'COMMANDER';
    }
    return 'COMMANDER';
}
function storyCharacterIdentityAxes(id, legacyAxes, role) {
    const old = Object.assign({ hawk: 50, auth: 50, pop: 50, nat: 50 }, legacyAxes || {});
    const roleStateBias = role === 'EXECUTIVE' ? 8 : role === 'COMMANDER' ? 4 : 0;
    return {
        stateMarketOrientation: storyCharacterIdentityClamp(
            50 + (Number(old.pop) - 50) * 0.35 + roleStateBias
                + storyCharacterIdentityJitter(id, 'state-market', 12)
        ),
        nationalGlobalOrientation: storyCharacterIdentityClamp(old.nat),
        popularTechnocraticStyle: storyCharacterIdentityClamp(old.pop),
        institutionalPosture: storyCharacterIdentityClamp(
            50 + (Number(old.auth) - 50) * 0.45
                + storyCharacterIdentityJitter(id, 'institution', 14)
        )
    };
}
function storyCharacterIdentityValues(legacyAxes) {
    const old = Object.assign({ hawk: 50, auth: 50, pop: 50, nat: 50 }, legacyAxes || {});
    return {
        hawkishness: storyCharacterIdentityClamp(old.hawk),
        libertyAuthority: storyCharacterIdentityClamp(old.auth),
        publicResponsiveness: storyCharacterIdentityClamp(old.pop),
        sovereigntyPriority: storyCharacterIdentityClamp(old.nat)
    };
}
function storyCharacterIdentityTraitSet(id, role, axes, values) {
    const pick = (rows, channel) => rows[storyCharacterIdentityHash(`${id}|${channel}`) % rows.length];
    const family = ['COMPANY_OWNER', 'COMPANY_EXECUTIVE'].includes(role) ? 'COMPANY'
        : ['EXECUTIVE', 'POLITICAL_FIGURE', 'MAYOR'].includes(role) ? 'POLITICAL'
        : role === 'AGENT' ? 'INTELLIGENCE'
        : role === 'CIVILIAN' ? 'CIVILIAN' : 'MILITARY';
    const fearSets = {
        COMPANY: ['INSOLVENCY', 'HOSTILE_TAKEOVER', 'REGULATORY_CAPTURE', 'SUPPLY_COLLAPSE'],
        POLITICAL: ['LEGITIMACY_COLLAPSE', 'STATE_PARALYSIS', 'COALITION_BREAKDOWN', 'ECONOMIC_SHOCK'],
        INTELLIGENCE: ['NETWORK_EXPOSURE', 'FALSE_SOURCE', 'POLITICAL_PURGE', 'OPERATIONAL_COMPROMISE'],
        CIVILIAN: ['LOSS_OF_LIVELIHOOD', 'PUBLIC_DISGRACE', 'POLITICAL_REPRISAL', 'COMMUNITY_BREAKDOWN'],
        MILITARY: ['UNIT_DISINTEGRATION', 'POLITICAL_SCAPEGOAT', 'SUPPLY_COLLAPSE', 'LOSS_OF_COMMAND']
    };
    const ambitionSets = {
        COMPANY: ['MARKET_DOMINANCE', 'INDUSTRIAL_EXPANSION', 'POLITICAL_ACCESS', 'DYNASTIC_WEALTH'],
        POLITICAL: ['LASTING_REFORM', 'NATIONAL_RENEWAL', 'HISTORIC_GROWTH', 'INSTITUTIONAL_CONTROL'],
        INTELLIGENCE: ['INFORMATION_SUPREMACY', 'PERFECT_COVER', 'CONTROL_THE_NETWORK', 'NATIONAL_SECURITY_LEGACY'],
        CIVILIAN: ['SOCIAL_ASCENT', 'PROTECT_THE_COMMUNITY', 'PUBLIC_RECOGNITION', 'INDEPENDENT_LIFE'],
        MILITARY: ['DECISIVE_VICTORY', 'GENERAL_STAFF_COMMAND', 'PROTECT_THE_FORCE', 'NATIONAL_RECOGNITION']
    };
    const fears = fearSets[family];
    const ambitions = ambitionSets[family];
    const redLines = [
        axes.institutionalPosture >= 55 ? 'UNLAWFUL_CHAIN_OF_COMMAND' : 'UNACCOUNTABLE_ENTRENCHMENT',
        values.hawkishness >= 55 ? 'PUBLIC_HUMILIATION' : 'UNNECESSARY_ESCALATION'
    ];
    return {
        fears: [pick(fears, 'fear-primary'), pick(fears, 'fear-secondary')].filter((v, i, a) => a.indexOf(v) === i),
        ambitions: [pick(ambitions, 'ambition-primary'), pick(ambitions, 'ambition-secondary')].filter((v, i, a) => a.indexOf(v) === i),
        redLines
    };
}
function storyCharacterIdentityVoice(id, axes, values) {
    return {
        register: axes.popularTechnocraticStyle >= 58 ? 'PLAIN_PUBLIC' : 'ANALYTICAL_FORMAL',
        directnessBps: storyCharacterIdentityClamp(45 + (values.hawkishness - 50) * 0.45
            + storyCharacterIdentityJitter(id, 'directness', 14)) * 100,
        warmthBps: storyCharacterIdentityClamp(50 + (axes.popularTechnocraticStyle - 50) * 0.55
            + storyCharacterIdentityJitter(id, 'warmth', 12)) * 100,
        formalityBps: storyCharacterIdentityClamp(55 + (axes.institutionalPosture - 50) * 0.5
            - (axes.popularTechnocraticStyle - 50) * 0.25) * 100,
        metaphorDomain: values.hawkishness >= 62 ? 'SECURITY' : axes.stateMarketOrientation >= 60 ? 'PUBLIC_DUTY' : 'PRACTICAL_TRADEOFF'
    };
}
function storyCharacterIdentityGoals(id, role, axes, traits) {
    let roleGoal;
    if (['COMPANY_OWNER', 'COMPANY_EXECUTIVE'].includes(role)) {
        roleGoal = axes.stateMarketOrientation >= 55 ? 'SECURE_PUBLIC_CONTRACTS' : 'EXPAND_MARKET_SHARE';
    } else if (role === 'AGENT') {
        roleGoal = axes.institutionalPosture >= 55 ? 'PROTECT_STATE_SECRETS' : 'EXPAND_INFORMAL_NETWORK';
    } else if (['EXECUTIVE', 'POLITICAL_FIGURE', 'MAYOR'].includes(role)) {
        roleGoal = axes.stateMarketOrientation >= 55 ? 'EXPAND_STATE_CAPACITY' : 'RESTORE_MARKET_CONFIDENCE';
    } else if (role === 'CIVILIAN') {
        roleGoal = 'BUILD_SOCIAL_INFLUENCE';
    } else {
        roleGoal = traits.ambitions.includes('PROTECT_THE_FORCE') ? 'PRESERVE_FORCE_READINESS' : 'GAIN_OPERATIONAL_AUTHORITY';
    }
    const personalGoal = traits.ambitions[0];
    return [
        { id: `${id}:goal:role`, kind: 'ROLE', objective: roleGoal, priorityBps: 7600, status: 'ACTIVE' },
        { id: `${id}:goal:personal`, kind: 'PERSONAL', objective: personalGoal, priorityBps: 6200, status: 'ACTIVE' }
    ];
}
function storyCharacterIdentityCareer(role) {
    return {
        influence: 50,
        credibility: 50,
        autonomy: 50,
        capability: 50,
        model: `ROLE_CAREER:${String(role || 'CHARACTER')}`
    };
}
function storyCharacterIdentityLife() {
    return {
        status: 'ACTIVE',
        statusEvidence: 'SOURCE_ACTOR_PRESENT',
        birthDate: null,
        ageYears: null,
        healthStatus: 'UNKNOWN',
        retirementEligibility: 'UNKNOWN',
        events: [],
        version: 1
    };
}
function storyCharacterIdentityLifeBackfill(actor) {
    if (!actor.life || typeof actor.life !== 'object' || Array.isArray(actor.life)) {
        actor.life = storyCharacterIdentityLife();
    }
    const life = actor.life;
    if (!['ACTIVE', 'RETIRED', 'DEAD'].includes(life.status)) life.status = 'ACTIVE';
    if (!life.statusEvidence) life.statusEvidence = 'LEGACY_SOURCE_ACTOR_PRESENT';
    if (life.birthDate == null) life.birthDate = null;
    if (life.ageYears == null || !Number.isFinite(Number(life.ageYears))) life.ageYears = null;
    else life.ageYears = Math.max(0, Math.min(130, Math.floor(Number(life.ageYears))));
    if (!['UNKNOWN', 'HEALTHY', 'IMPAIRED', 'CRITICAL'].includes(life.healthStatus)) {
        life.healthStatus = 'UNKNOWN';
    }
    if (!['UNKNOWN', 'ELIGIBLE', 'INELIGIBLE'].includes(life.retirementEligibility)) {
        life.retirementEligibility = 'UNKNOWN';
    }
    if (!Array.isArray(life.events)) life.events = [];
    life.version = 1;
    return life;
}
function storyCharacterIdentityCanAct(actorId) {
    const ledger = storyCharacterIdentityEnsure();
    const actor = ledger && ledger.identities[String(actorId || '')];
    if (!actor) return { ok: false, code: 'ACTOR_NOT_FOUND', status: null };
    const life = storyCharacterIdentityLifeBackfill(actor);
    return {
        ok: life.status === 'ACTIVE',
        code: life.status === 'ACTIVE' ? 'ACTOR_ACTIVE' : `ACTOR_${life.status}`,
        status: life.status
    };
}
function storyCharacterIdentityLifeTransition(input) {
    input = input || {};
    const actorId = String(input.actorId || '');
    const toStatus = String(input.toStatus || '').toUpperCase();
    const sourceEventId = String(input.sourceEventId || '');
    const ledger = storyCharacterIdentityEnsure();
    const actor = ledger && ledger.identities[actorId];
    if (!actor) return { ok: false, code: 'ACTOR_NOT_FOUND', worldMutation: false };
    const life = storyCharacterIdentityLifeBackfill(actor);
    if (!['RETIRED', 'DEAD'].includes(toStatus)) {
        return { ok: false, code: 'LIFE_STATUS_TRANSITION_UNSUPPORTED', worldMutation: false };
    }
    if (!sourceEventId) return { ok: false, code: 'SOURCE_EVENT_REQUIRED', worldMutation: false };
    if (life.status !== 'ACTIVE') {
        return { ok: false, code: `ACTOR_ALREADY_${life.status}`, worldMutation: false };
    }
    const held = typeof storyCharacterActionHeldInstitutions === 'function'
        ? storyCharacterActionHeldInstitutions(actorId) : [];
    if (held.length > 1) return {
        ok: false, code: 'MULTIPLE_OFFICE_SUCCESSION_NOT_ATOMIC',
        institutionIds: held.map(row => row.institutionId), worldMutation: false
    };
    const previews = held.map(row => storyCharacterActionCandidate({
        actionType: 'RESIGN', actorId,
        domainContext: { targetInstitutionId: row.institutionId },
        decisionSource: 'LIFE_CYCLE'
    }));
    const blocked = previews.find(row => !row.allowed);
    if (blocked) return {
        ok: false, code: 'OFFICE_SUCCESSION_REQUIRED_BEFORE_LIFE_TRANSITION',
        institutionId: blocked.domainContext && blocked.domainContext.targetInstitutionId,
        reasons: blocked.reasons.slice(), worldMutation: false
    };
    const successionReceiptIds = [];
    for (const preview of previews) {
        const resignation = storyCharacterActionExecute({
            actionType: 'RESIGN', actorId,
            domainContext: preview.domainContext,
            decisionSource: 'LIFE_CYCLE'
        });
        if (!resignation.ok) return {
            ok: false, code: 'OFFICE_SUCCESSION_FAILED',
            successionReceiptIds, worldMutation: successionReceiptIds.length > 0
        };
        successionReceiptIds.push(resignation.receipt.id);
    }
    const occurredAt = Number.isFinite(Number(input.occurredAt))
        ? Number(input.occurredAt) : Number(STORY.clock) || 0;
    const event = {
        id: `character-life:${actorId.replace(/[^a-zA-Z0-9_-]/g, '-')}:${toStatus.toLowerCase()}:${life.events.length + 1}`,
        fromStatus: 'ACTIVE', toStatus, sourceEventId,
        reasonCode: String(input.reasonCode || (toStatus === 'DEAD' ? 'DEATH_EVENT' : 'VOLUNTARY_RETIREMENT')),
        occurredAt, successionReceiptIds,
        sourceValidation: 'EXTERNAL_EVENT_REFERENCE_UNVERIFIED', version: 1
    };
    life.status = toStatus;
    life.statusEvidence = sourceEventId;
    life.events.push(event);
    if (life.events.length > 16) life.events.splice(0, life.events.length - 16);
    actor.updatedAt = occurredAt;
    if (typeof storyMemoryAddMilestone === 'function') storyMemoryAddMilestone({
        id: `${event.id}:milestone`, kind: 'CAREER', subjectActorId: actorId,
        holderActorIds: [actorId], summary: toStatus === 'DEAD'
            ? `${actor.name} hayatını kaybetti.` : `${actor.name} aktif görevlerden emekli oldu.`,
        importanceBps: 10000, createdAt: occurredAt,
        source: { sourceType: 'CHARACTER_LIFE_EVENT', sourceId: sourceEventId, lifeEventId: event.id }
    });
    return { ok: true, code: `ACTOR_${toStatus}`, event: storyCharacterIdentityClone(event), worldMutation: true };
}
function storyCharacterIdentityCreate(input) {
    const id = String(input.id);
    const axes = storyCharacterIdentityAxes(id, input.legacyAxes, input.role);
    const values = storyCharacterIdentityValues(input.legacyAxes);
    const traits = storyCharacterIdentityTraitSet(id, input.role, axes, values);
    return {
        id,
        countryId: String(input.countryId),
        sourceActorId: id,
        name: String(input.name || 'İsimsiz karakter'),
        role: String(input.role),
        originModel: String(input.originModel || 'LEGACY_CHARACTER_MIGRATION'),
        organizationId: input.organizationId == null ? null : String(input.organizationId),
        institutionId: input.institutionId == null ? null : String(input.institutionId),
        serviceId: input.serviceId == null ? null : String(input.serviceId),
        publicTitle: input.publicTitle == null ? null : String(input.publicTitle),
        coreAxes: axes,
        values,
        fears: traits.fears,
        ambitions: traits.ambitions,
        redLines: traits.redLines,
        voiceProfile: storyCharacterIdentityVoice(id, axes, values),
        goals: storyCharacterIdentityGoals(id, input.role, axes, traits),
        career: storyCharacterIdentityCareer(input.role),
        life: storyCharacterIdentityLife(),
        legacySeeds: Array.isArray(input.legacySeeds) ? input.legacySeeds.slice(0, 8) : [],
        createdAt: Number(STORY.clock) || 0,
        updatedAt: Number(STORY.clock) || 0,
        version: 1
    };
}

const STORY_CHARACTER_PUBLIC_SURNAMES = Object.freeze([
    'Akın', 'Arslan', 'Aydın', 'Batur', 'Candan', 'Demir', 'Eren', 'Göktaş',
    'Işık', 'Kara', 'Kaya', 'Keskin', 'Koç', 'Özkan', 'Sancak', 'Tekin', 'Yalçın', 'Yıldız'
]);
const STORY_CHARACTER_PUBLIC_NAMES = Object.freeze([
    'Ada', 'Alp', 'Aslı', 'Baran', 'Beren', 'Cem', 'Derya', 'Ece', 'Emir', 'Gökçe',
    'Ilgaz', 'Irmak', 'Kerem', 'Leyla', 'Mert', 'Mina', 'Nehir', 'Ozan', 'Selin', 'Tuna'
]);
function storyCharacterStablePublicName(id) {
    const first = STORY_CHARACTER_PUBLIC_NAMES[storyCharacterIdentityHash(`${id}|first`) % STORY_CHARACTER_PUBLIC_NAMES.length];
    const last = STORY_CHARACTER_PUBLIC_SURNAMES[storyCharacterIdentityHash(`${id}|last`) % STORY_CHARACTER_PUBLIC_SURNAMES.length];
    return `${first} ${last}`;
}

function storyCharacterIdentitySources() {
    const rows = [];
    for (const state of (STORY.states || [])) {
        const countryId = `country:${state.id}`;
        if (state.gov && state.gov.president) {
            rows.push({
                id: `character:${state.id}:president`, countryId,
                name: state.gov.president.name, role: 'EXECUTIVE',
                legacyAxes: state.gov.president.axes, legacySeeds: state.gov.president.legacy,
                originModel: 'NAMED_PRESIDENT_PHASE_1_MIGRATION'
            });
        }
        const commanders = typeof storyStateCommanders === 'function'
            ? storyStateCommanders(state) : ((state.gov && state.gov.commanders) || []);
        for (const commander of commanders) {
            rows.push({
                id: `character:${state.id}:${commander.id}`, countryId,
                name: commander.name, role: storyCharacterIdentityRole(commander, false),
                organizationId: commander.isPlayer ? commander.organizationId : null,
                institutionId: commander.isPlayer ? commander.institutionId : null,
                serviceId: commander.isPlayer ? commander.serviceId : null,
                publicTitle: commander.isPlayer ? commander.publicTitle : null,
                legacyAxes: commander.axes, legacySeeds: commander.legacy,
                originModel: commander.isPlayer ? 'PLAYER_CHARACTER_CREATION_MIGRATION' : 'CANONICAL_COMMANDER_MIGRATION'
            });
        }
        const politicalSlots = [
            ['government-whip', 'Hükûmet Grup Başkanı'],
            ['opposition-leader', 'Ana Muhalefet Lideri'],
            ['labor-organizer', 'Emek Bloğu Sözcüsü']
        ];
        for (const [slot, publicTitle] of politicalSlots) {
            const id = `character:${state.id}:political:${slot}`;
            rows.push({
                id, countryId, name: storyCharacterStablePublicName(id), role: 'POLITICAL_FIGURE',
                publicTitle, institutionId: `political:${state.id}:${slot}`,
                originModel: 'PHASE_35_POLITICAL_CAST'
            });
        }
        const agentSlots = [
            ['domestic', 'İç İstihbarat Daire Başkanı'],
            ['foreign', 'Dış Operasyonlar Daire Başkanı']
        ];
        for (const [slot, publicTitle] of agentSlots) {
            const id = `character:${state.id}:agent:${slot}`;
            rows.push({
                id, countryId, name: storyCharacterStablePublicName(id), role: 'AGENT',
                publicTitle, serviceId: `intelligence:${state.id}:${slot}`,
                originModel: 'PHASE_35_INTELLIGENCE_CAST'
            });
        }
    }
    const companyLedger = STORY.companyEconomy;
    for (const company of Object.values(companyLedger && companyLedger.companies || {})) {
        const id = `character:company-executive:${company.id}`;
        rows.push({
            id, countryId: company.countryId, name: storyCharacterStablePublicName(id),
            role: 'COMPANY_EXECUTIVE', publicTitle: `${company.name} Genel Müdürü`,
            organizationId: company.id, originModel: 'PHASE_35_COMPANY_EXECUTIVE_CAST'
        });
    }
    return rows.sort((a, b) => a.id.localeCompare(b.id, 'en'));
}
function storyCharacterIdentityLedgerCreate() {
    const ledger = {
        schemaVersion: STORY_CHARACTER_IDENTITY_SCHEMA_VERSION,
        adapterVersion: STORY_CHARACTER_IDENTITY_ADAPTER_VERSION,
        identities: {},
        creationProfiles: {},
        worldFacts: {},
        actorBeliefs: {},
        generatedAt: Number(STORY.clock) || 0
    };
    for (const source of storyCharacterIdentitySources()) {
        ledger.identities[source.id] = storyCharacterIdentityCreate(source);
    }
    return ledger;
}
function storyCharacterIdentityMigrateLedger(saved) {
    const ledger = storyCharacterIdentityClone(saved);
    if (!ledger || typeof ledger !== 'object') return null;
    if (![1, 2, 3, STORY_CHARACTER_IDENTITY_SCHEMA_VERSION].includes(ledger.schemaVersion)) return null;
    if (!ledger.identities || typeof ledger.identities !== 'object') return null;
    if (!ledger.creationProfiles || typeof ledger.creationProfiles !== 'object') ledger.creationProfiles = {};
    if (!ledger.worldFacts || typeof ledger.worldFacts !== 'object') ledger.worldFacts = {};
    if (!ledger.actorBeliefs || typeof ledger.actorBeliefs !== 'object') ledger.actorBeliefs = {};
    for (const actor of Object.values(ledger.identities)) storyCharacterIdentityLifeBackfill(actor);
    ledger.schemaVersion = STORY_CHARACTER_IDENTITY_SCHEMA_VERSION;
    ledger.adapterVersion = STORY_CHARACTER_IDENTITY_ADAPTER_VERSION;
    return ledger;
}
function storyCharacterIdentityReset() {
    if (!storyCharacterIdentityEnabled()) { STORY.characterIdentities = null; return null; }
    STORY.characterIdentities = storyCharacterIdentityLedgerCreate();
    return storyCharacterIdentitySnapshot();
}
function storyCharacterIdentityReconcileSources() {
    const ledger = STORY.characterIdentities;
    if (!ledger || !ledger.identities) return ledger;
    for (const source of storyCharacterIdentitySources()) {
        const existing = ledger.identities[source.id];
        if (!existing) {
            ledger.identities[source.id] = storyCharacterIdentityCreate(source);
            continue;
        }
        // Rol seçimi ve kurumsal bağlar kaynak kaydının güncel gerçeğidir;
        // kişilik çekirdeğini yeniden zar atmadan eski deftere eklenebilir.
        const playerSource = source.originModel === 'PLAYER_CHARACTER_CREATION_MIGRATION';
        const previousRole = existing.role;
        if (playerSource) existing.role = source.role;
        for (const key of ['organizationId', 'institutionId', 'serviceId', 'publicTitle']) {
            if (playerSource) existing[key] = source[key] == null ? null : String(source[key]);
            else if (existing[key] == null && source[key] != null) existing[key] = String(source[key]);
        }
        if (!existing.career || typeof existing.career !== 'object') {
            existing.career = storyCharacterIdentityCareer(existing.role);
        } else if (playerSource && previousRole !== existing.role) {
            existing.career.model = `ROLE_CAREER:${existing.role}`;
        }
        storyCharacterIdentityLifeBackfill(existing);
    }
    return ledger;
}
function storyCharacterBindPlayerRole() {
    const commander = STORY.commander;
    if (!commander) return null;
    const role = String(commander.creationRole || STORY.playerRole || 'COMMANDER').toUpperCase();
    const stateId = STORY.playerStateId | 0;
    const playerState = typeof storyState === 'function' ? storyState(stateId) : null;
    // Başlangıç seçimi makamın kendisidir: yalnız siyasi yürütme rolü devlet
    // lideri olarak başlar. Daha sonra seçim/atama/darbe state.gov.leader
    // alanını gerçekten değiştirirse institution tick yeni makamı tanır.
    if (playerState && playerState.gov) {
        playerState.gov.leader = role === 'EXECUTIVE' ? 'player' : 'ai';
    }
    commander.organizationId = null;
    commander.institutionId = null;
    commander.serviceId = null;
    commander.publicTitle = null;
    if (role === 'COMPANY_OWNER') {
        const preferredId = `company:${stateId}:civil_industry`;
        const company = typeof storyCompanyById === 'function'
            ? storyCompanyById(preferredId)
            : STORY.companyEconomy && STORY.companyEconomy.companies
                && STORY.companyEconomy.companies[preferredId];
        if (company) {
            commander.organizationId = preferredId;
            commander.publicTitle = `${company.name} Yönetim Kurulu Başkanı`;
        }
    } else if (role === 'AGENT') {
        commander.serviceId = `intelligence:${stateId}:domestic`;
        commander.publicTitle = 'İç İstihbarat Saha Yöneticisi';
    } else if (role === 'EXECUTIVE') {
        commander.institutionId = `institution:country:${stateId}:executive`;
        commander.publicTitle = 'Yürütme Lideri';
    } else if (role === 'COMMANDER') {
        commander.institutionId = `institution:country:${stateId}:armed_forces`;
        commander.publicTitle = 'Kuvvet Komutanı';
    }
    if (STORY.characterIdentities && typeof storyCharacterIdentityReconcileSources === 'function') {
        storyCharacterIdentityReconcileSources();
    }
    return {
        role,
        organizationId: commander.organizationId,
        institutionId: commander.institutionId,
        serviceId: commander.serviceId,
        publicTitle: commander.publicTitle
    };
}
function storyCharacterIdentityEnsure() {
    if (!storyCharacterIdentityEnabled()) return null;
    if (STORY.characterIdentities
        && STORY.characterIdentities.schemaVersion !== STORY_CHARACTER_IDENTITY_SCHEMA_VERSION) {
        STORY.characterIdentities = storyCharacterIdentityMigrateLedger(STORY.characterIdentities);
    }
    if (!STORY.characterIdentities) {
        storyCharacterIdentityReset();
    }
    const ledger = STORY.characterIdentities;
    if (!ledger.creationProfiles || typeof ledger.creationProfiles !== 'object') ledger.creationProfiles = {};
    if (!ledger.worldFacts || typeof ledger.worldFacts !== 'object') ledger.worldFacts = {};
    if (!ledger.actorBeliefs || typeof ledger.actorBeliefs !== 'object') ledger.actorBeliefs = {};
    for (const actor of Object.values(ledger.identities || {})) storyCharacterIdentityLifeBackfill(actor);
    return STORY.characterIdentities;
}
function storyCharacterPoliticalCandidate(countryId, slateKey, electionKey) {
    const ledger = storyCharacterIdentityEnsure();
    if (!ledger) return null;
    const stateId = Number(String(countryId).split(':').pop());
    const normalizedKey = String(slateKey || 'CONTINUITY').toUpperCase();
    const electionToken = String(electionKey || 'initial').replace(/[^a-zA-Z0-9_-]/g, '-');
    const id = `character:${stateId}:candidate:${electionToken}:${normalizedKey.toLowerCase()}`;
    if (!ledger.identities[id]) {
        const legacyAxes = typeof STORY_ELECTION_LEGACY_AXIS_IDEALS !== 'undefined'
            ? STORY_ELECTION_LEGACY_AXIS_IDEALS[normalizedKey] : null;
        const firstNames = typeof STORY_CMD_NAMES !== 'undefined' ? STORY_CMD_NAMES : ['Deniz', 'Ekin', 'Barış'];
        const surnames = typeof PRES_SURNAMES !== 'undefined' ? PRES_SURNAMES : ['Aksoy', 'Ertem', 'Karaca'];
        const name = `${firstNames[storyCharacterIdentityHash(`${id}:first`) % firstNames.length]} ${surnames[storyCharacterIdentityHash(`${id}:last`) % surnames.length]}`;
        ledger.identities[id] = storyCharacterIdentityCreate({
            id, countryId: `country:${stateId}`, name,
            role: 'POLITICAL_CANDIDATE', legacyAxes,
            legacySeeds: [`ELECTION_CANDIDATE:${normalizedKey}`, `ELECTION:${electionKey || 'initial'}`],
            originModel: 'ELECTION_CANDIDATE_PHASE_34'
        });
    }
    return storyCharacterIdentityView(id);
}
function storyCharacterIdentityReconcileElections() {
    const electionLedger = STORY.elections;
    if (!electionLedger || !electionLedger.elections) return;
    for (const election of Object.values(electionLedger.elections)) {
        for (const slate of (election.candidates || [])) {
            const candidate = storyCharacterPoliticalCandidate(election.countryId, slate.key, election.id);
            if (!candidate) continue;
            slate.candidateActorId = candidate.id;
            slate.candidateName = candidate.name;
            slate.candidateModel = 'CANONICAL_CHARACTER_IDENTITY_PHASE_34';
        }
    }
    for (const mandate of Object.values(electionLedger.mandates || {})) {
        if (!mandate.sourceElectionId) continue;
        const election = electionLedger.elections[mandate.sourceElectionId];
        const primary = election && (election.candidates || []).find(row => row.id === mandate.primarySlateId);
        if (!primary || !primary.candidateActorId) continue;
        mandate.officeHolder = {
            actorId: primary.candidateActorId,
            actorType: 'CHARACTER',
            name: primary.candidateName,
            model: 'CANONICAL_CHARACTER_IDENTITY_PHASE_34'
        };
    }
}
function storyCharacterIdentityValidate(ledger) {
    const issues = [];
    if (!ledger || typeof ledger !== 'object') return { ok: false, issues: [{ code: 'LEDGER_REQUIRED', path: '$' }] };
    if (ledger.schemaVersion !== STORY_CHARACTER_IDENTITY_SCHEMA_VERSION) issues.push({ code: 'SCHEMA_VERSION', path: '$.schemaVersion' });
    const identities = ledger.identities && typeof ledger.identities === 'object' ? ledger.identities : {};
    for (const [id, row] of Object.entries(identities)) {
        const at = `$.identities.${id}`;
        if (!row || row.id !== id) issues.push({ code: 'IDENTITY_ID', path: `${at}.id` });
        for (const axis of STORY_CHARACTER_CORE_AXES) {
            const value = row && row.coreAxes && Number(row.coreAxes[axis]);
            if (!Number.isInteger(value) || value < 0 || value > 100) issues.push({ code: 'CORE_AXIS', path: `${at}.coreAxes.${axis}` });
        }
        if (!Array.isArray(row && row.fears) || !row.fears.length) issues.push({ code: 'FEARS_REQUIRED', path: `${at}.fears` });
        if (!Array.isArray(row && row.ambitions) || !row.ambitions.length) issues.push({ code: 'AMBITIONS_REQUIRED', path: `${at}.ambitions` });
        if (!Array.isArray(row && row.redLines) || !row.redLines.length) issues.push({ code: 'RED_LINES_REQUIRED', path: `${at}.redLines` });
        if (!Array.isArray(row && row.goals) || row.goals.length < 2) issues.push({ code: 'GOALS_REQUIRED', path: `${at}.goals` });
        if (row && row.activationOrigin) {
            const origin = row.activationOrigin;
            if (!origin.candidateId || !origin.cohortId || !origin.regionId || !origin.sourceMovementId
                || origin.populationAccounting !== 'REPRESENTATIVE_INCLUDED_IN_COHORT'
                || origin.populationDelta !== 0) {
                issues.push({ code: 'ACTIVATION_ORIGIN', path: `${at}.activationOrigin` });
            }
        }
        const life = row && row.life;
        if (!life || !['ACTIVE', 'RETIRED', 'DEAD'].includes(life.status)) {
            issues.push({ code: 'LIFE_STATUS', path: `${at}.life.status` });
        }
        const birthDateValid = life && (life.birthDate === null
            || /^\d{4}-\d{2}-\d{2}$/.test(String(life.birthDate)));
        const ageValid = life && (life.ageYears === null
            || (Number.isInteger(life.ageYears) && life.ageYears >= 0 && life.ageYears <= 130));
        if (!life || !birthDateValid || !ageValid
            || !['UNKNOWN', 'HEALTHY', 'IMPAIRED', 'CRITICAL'].includes(life.healthStatus)
            || !['UNKNOWN', 'ELIGIBLE', 'INELIGIBLE'].includes(life.retirementEligibility)
            || !Array.isArray(life.events) || life.events.length > 16) {
            issues.push({ code: 'LIFE_CONTRACT', path: `${at}.life` });
        }
        for (const [eventIndex, event] of ((life && life.events) || []).entries()) {
            if (!event || !event.id || !['RETIRED', 'DEAD'].includes(event.toStatus)
                || !event.sourceEventId || !Number.isFinite(Number(event.occurredAt))
                || event.sourceValidation !== 'EXTERNAL_EVENT_REFERENCE_UNVERIFIED') {
                issues.push({ code: 'LIFE_EVENT', path: `${at}.life.events[${eventIndex}]` });
            }
        }
        const lastLifeEvent = life && life.events && life.events[life.events.length - 1];
        if (life && life.status !== 'ACTIVE'
            && (!lastLifeEvent || lastLifeEvent.toStatus !== life.status
                || life.statusEvidence !== lastLifeEvent.sourceEventId)) {
            issues.push({ code: 'LIFE_STATUS_EVIDENCE', path: `${at}.life.statusEvidence` });
        }
    }
    for (const key of ['creationProfiles', 'worldFacts', 'actorBeliefs']) {
        if (!ledger[key] || typeof ledger[key] !== 'object' || Array.isArray(ledger[key])) {
            issues.push({ code: 'OBJECT_REQUIRED', path: `$.${key}` });
        }
    }
    const facts = ledger.worldFacts && typeof ledger.worldFacts === 'object' ? ledger.worldFacts : {};
    const profiles = ledger.creationProfiles && typeof ledger.creationProfiles === 'object'
        ? ledger.creationProfiles : {};
    for (const [actorId, profile] of Object.entries(profiles)) {
        const at = `$.creationProfiles.${actorId}`;
        if (!identities[actorId]) issues.push({ code: 'PROFILE_ACTOR_REFERENCE', path: `${at}.actorId` });
        if (!profile || profile.actorId !== actorId) issues.push({ code: 'PROFILE_ACTOR_ID', path: `${at}.actorId` });
        if (!Array.isArray(profile && profile.decisions) || profile.decisions.length !== 12) {
            issues.push({ code: 'PROFILE_DECISION_COUNT', path: `${at}.decisions` });
        }
        for (const [index, decision] of ((profile && profile.decisions) || []).entries()) {
            if (!decision.worldFactId || !facts[decision.worldFactId]) {
                issues.push({ code: 'PROFILE_WORLD_FACT_REFERENCE', path: `${at}.decisions[${index}].worldFactId` });
            }
            if (!decision.originEventId) issues.push({ code: 'PROFILE_ORIGIN_EVENT_REQUIRED', path: `${at}.decisions[${index}].originEventId` });
            if (!decision.gain || !(Number(decision.gain.appliedDelta) > 0)) {
                issues.push({ code: 'PROFILE_GAIN_REQUIRED', path: `${at}.decisions[${index}].gain` });
            }
            if (!decision.cost || !(Number(decision.cost.appliedDelta) < 0)) {
                issues.push({ code: 'PROFILE_COST_REQUIRED', path: `${at}.decisions[${index}].cost` });
            }
            if (!Number.isFinite(Number(decision.visibleAt))
                || Number(decision.visibleAt) - Number(profile.completedAt) > 600) {
                issues.push({ code: 'PROFILE_VISIBILITY_DEADLINE', path: `${at}.decisions[${index}].visibleAt` });
            }
        }
    }
    for (const [id, fact] of Object.entries(facts)) {
        const at = `$.worldFacts.${id}`;
        if (!fact || fact.id !== id) issues.push({ code: 'WORLD_FACT_ID', path: `${at}.id` });
        if (!fact || !identities[fact.subjectActorId]) issues.push({ code: 'WORLD_FACT_ACTOR_REFERENCE', path: `${at}.subjectActorId` });
        if (!fact || !fact.originEventId) issues.push({ code: 'WORLD_FACT_ORIGIN_EVENT', path: `${at}.originEventId` });
    }
    const beliefs = ledger.actorBeliefs && typeof ledger.actorBeliefs === 'object' ? ledger.actorBeliefs : {};
    for (const [id, belief] of Object.entries(beliefs)) {
        const at = `$.actorBeliefs.${id}`;
        if (!belief || belief.id !== id) issues.push({ code: 'ACTOR_BELIEF_ID', path: `${at}.id` });
        if (!belief || !identities[belief.holderActorId]) issues.push({ code: 'ACTOR_BELIEF_HOLDER_REFERENCE', path: `${at}.holderActorId` });
        if (!belief || !facts[belief.worldFactId]) issues.push({ code: 'ACTOR_BELIEF_FACT_REFERENCE', path: `${at}.worldFactId` });
        const confidence = Number(belief && belief.confidenceBps);
        if (!Number.isInteger(confidence) || confidence < 1 || confidence > 10000) {
            issues.push({ code: 'ACTOR_BELIEF_CONFIDENCE', path: `${at}.confidenceBps` });
        }
    }
    return { ok: issues.length === 0, issues };
}
function storyCharacterIdentitySnapshot() {
    const ledger = storyCharacterIdentityEnsure();
    return ledger ? storyCharacterIdentityClone(ledger) : null;
}
function storyCharacterIdentityForSave() { return storyCharacterIdentitySnapshot(); }
function storyCharacterIdentityRestore(saved) {
    if (!storyCharacterIdentityEnabled()) { STORY.characterIdentities = null; return null; }
    const candidate = storyCharacterIdentityMigrateLedger(saved);
    if (candidate && storyCharacterIdentityValidate(candidate).ok) STORY.characterIdentities = candidate;
    else STORY.characterIdentities = storyCharacterIdentityLedgerCreate();
    storyCharacterIdentityReconcileSources();
    storyCharacterIdentityReconcileElections();
    return storyCharacterIdentitySnapshot();
}

function storyCharacterDecisionPreview(theme, optionTag) {
    const template = STORY_CHARACTER_DECISION_EFFECTS[String(theme || '')]
        && STORY_CHARACTER_DECISION_EFFECTS[String(theme || '')][String(optionTag || '')];
    return template ? {
        policyVersion: STORY_CHARACTER_CREATION_POLICY_VERSION,
        gainLabel: template.gain.label,
        costLabel: template.cost.label,
        visibility: template.visibility,
        reactionHook: template.reactionHook
    } : null;
}

function storyCharacterDecisionTemplate(role, theme, optionTag) {
    const roleKey = String(role || 'COMMANDER').toUpperCase();
    const base = STORY_CHARACTER_DECISION_EFFECTS[String(theme || '')]
        && STORY_CHARACTER_DECISION_EFFECTS[String(theme || '')][String(optionTag || '')];
    if (!base || roleKey === 'COMMANDER') return base;
    const labels = {
        COMPANY_OWNER: { influence: 'Şirket nüfuzu', credibility: 'Ticari güven', autonomy: 'Yönetim özerkliği', capability: 'İşletme kapasitesi' },
        EXECUTIVE: { influence: 'Siyasi nüfuz', credibility: 'Kamusal güven', autonomy: 'Karar özerkliği', capability: 'Yönetim kapasitesi' },
        AGENT: { influence: 'Ağ nüfuzu', credibility: 'Kaynak güveni', autonomy: 'Operasyon özerkliği', capability: 'Servis kapasitesi' },
        MAYOR: { influence: 'Yerel nüfuz', credibility: 'Kent güveni', autonomy: 'Yerel özerklik', capability: 'Belediye kapasitesi' },
        CIVILIAN: { influence: 'Toplumsal nüfuz', credibility: 'İtibar', autonomy: 'Bağımsızlık', capability: 'Mesleki kapasite' }
    }[roleKey] || { influence: 'Nüfuz', credibility: 'Güven', autonomy: 'Özerklik', capability: 'Kapasite' };
    const keys = {
        sert: ['influence', 'credibility'],
        kurnaz: ['autonomy', 'credibility'],
        halkci: ['credibility', 'autonomy'],
        uzman: ['capability', 'influence']
    }[String(optionTag)] || ['capability', 'autonomy'];
    const amount = String(theme) === 'siyaset' ? 6 : String(theme) === 'idare' ? 5 : 4;
    return {
        gain: { scope: 'CHARACTER_CAREER', key: keys[0], amount, label: `${labels[keys[0]]} +${amount}` },
        cost: { scope: 'CHARACTER_CAREER', key: keys[1], amount: -3, label: `${labels[keys[1]]} -3` },
        visibility: base.visibility,
        reactionHook: base.reactionHook
    };
}

function storyCharacterCreationRolePolicy(role) {
    if (typeof charRoleQuestionPolicy === 'function') return charRoleQuestionPolicy(role);
    const policies = {
        COMMANDER: { harp: 6, idare: 3, siyaset: 3 },
        COMPANY_OWNER: { harp: 2, idare: 6, siyaset: 4 },
        MAYOR: { harp: 1, idare: 7, siyaset: 4 },
        EXECUTIVE: { harp: 3, idare: 4, siyaset: 5 },
        AGENT: { harp: 2, idare: 3, siyaset: 7 },
        CIVILIAN: { harp: 1, idare: 5, siyaset: 6 }
    };
    const key = policies[String(role || '').toUpperCase()] ? String(role).toUpperCase() : 'COMMANDER';
    return { role: key, version: 'character-role-question-policy-1', counts: policies[key], total: 12 };
}

function storyCharacterCreationValidate(character) {
    const issues = [];
    const decisions = Array.isArray(character && character.decisions) ? character.decisions : [];
    const policy = storyCharacterCreationRolePolicy(character && character.role);
    if (decisions.length !== policy.total) issues.push({ code: 'DECISION_COUNT', path: '$.decisions' });
    const counts = { harp: 0, idare: 0, siyaset: 0 };
    const indices = new Set();
    decisions.forEach((decision, index) => {
        const at = `$.decisions[${index}]`;
        const decisionIndex = Number(decision && decision.index);
        if (!Number.isInteger(decisionIndex) || decisionIndex < 0 || decisionIndex >= policy.total || indices.has(decisionIndex)) {
            issues.push({ code: 'DECISION_INDEX', path: `${at}.index` });
        }
        indices.add(decisionIndex);
        const theme = String(decision && decision.theme || '');
        const optionTag = String(decision && decision.optionTag || '');
        if (!Object.prototype.hasOwnProperty.call(counts, theme)) issues.push({ code: 'DECISION_THEME', path: `${at}.theme` });
        else counts[theme]++;
        if (!storyCharacterDecisionPreview(theme, optionTag)) issues.push({ code: 'DECISION_TRADEOFF', path: `${at}.optionTag` });
        if (!String(decision && decision.questionText || '').trim()) issues.push({ code: 'DECISION_QUESTION', path: `${at}.questionText` });
        if (!String(decision && decision.optionText || '').trim()) issues.push({ code: 'DECISION_OPTION', path: `${at}.optionText` });
    });
    for (const [theme, expected] of Object.entries(policy.counts)) {
        if (counts[theme] !== expected) issues.push({ code: 'ROLE_DISTRIBUTION', path: `$.decisions.${theme}`, expected, actual: counts[theme] });
    }
    return { ok: issues.length === 0, issues, policy, counts };
}

function storyCharacterCreationApplyDelta(descriptor, actorId, countryId) {
    const commander = STORY.commander;
    const stateId = Number(String(countryId).split(':').pop());
    const state = typeof storyState === 'function' ? storyState(stateId) : null;
    let target = null;
    let targetEntity = null;
    let path = null;
    if (descriptor.scope === 'COMMANDER_RESOURCE' && commander && commander.res) {
        target = commander.res;
        targetEntity = { type: 'character', id: actorId };
        path = `${actorId}.res.${descriptor.key}`;
    } else if (descriptor.scope === 'CHARACTER_CAREER') {
        const ledger = storyCharacterIdentityEnsure();
        const identity = ledger && ledger.identities && ledger.identities[actorId];
        if (identity) {
            if (!identity.career || typeof identity.career !== 'object') {
                identity.career = storyCharacterIdentityCareer(identity.role);
            }
            target = identity.career;
            targetEntity = { type: 'character', id: actorId };
            path = `${actorId}.career.${descriptor.key}`;
        }
    } else if (descriptor.scope === 'PLAYER_STATE' && state) {
        target = state;
        targetEntity = { type: 'country', id: countryId };
        path = `${countryId}.${descriptor.key}`;
    }
    if (!target || !targetEntity) return null;
    const before = Number(target[descriptor.key]) || 0;
    const requested = Number(descriptor.amount) || 0;
    const after = descriptor.scope === 'COMMANDER_RESOURCE'
        ? Math.max(0, before + requested)
        : descriptor.scope === 'CHARACTER_CAREER'
            ? Math.max(0, Math.min(100, before + requested))
            : before + requested;
    const changed = typeof storyCausalitySet === 'function'
        ? storyCausalitySet(target, descriptor.key, after, {
            target: targetEntity,
            path,
            source: 'character.creation_decision'
        })
        : false;
    if (!changed) return null;
    return Object.assign({}, descriptor, { before, after, appliedDelta: after - before });
}

function storyCharacterCreationBeliefHolders(ledger, actorId, countryId, visibility) {
    const holders = [{ actorId, confidenceBps: 10000, sourceType: 'FIRST_HAND' }];
    if (visibility === 'PRIVATE') return holders;
    const candidates = Object.values(ledger.identities || {})
        .filter(row => row.countryId === countryId && row.id !== actorId)
        .sort((a, b) => {
            const executiveDelta = Number(b.role === 'EXECUTIVE') - Number(a.role === 'EXECUTIVE');
            return executiveDelta || a.id.localeCompare(b.id, 'en');
        });
    const limit = visibility === 'PUBLIC' ? 3 : 1;
    for (const row of candidates.slice(0, limit)) {
        holders.push({
            actorId: row.id,
            confidenceBps: row.role === 'EXECUTIVE' ? 9000 : 7800,
            sourceType: visibility === 'PUBLIC' ? 'PUBLIC_RECORD' : 'INSTITUTIONAL_RECORD'
        });
    }
    return holders;
}

function storyCharacterCreationRecordBeliefs(ledger, fact, subjectActorId) {
    const ids = [];
    const holders = storyCharacterCreationBeliefHolders(
        ledger, subjectActorId, fact.countryId, fact.visibility
    );
    for (const holder of holders) {
        const safeHolder = holder.actorId.replace(/[^a-zA-Z0-9_-]/g, '-');
        const id = `actor-belief:${fact.id.replace(/[^a-zA-Z0-9_-]/g, '-')}:${safeHolder}`;
        ledger.actorBeliefs[id] = {
            id,
            holderActorId: holder.actorId,
            holderCountryId: ledger.identities[holder.actorId].countryId,
            worldFactId: fact.id,
            subjectActorId,
            beliefStatus: holder.confidenceBps === 10000 ? 'VERIFIED' : 'REPORTED',
            confidenceBps: holder.confidenceBps,
            source: { type: holder.sourceType, actorId: subjectActorId },
            learnedAt: Number(STORY.clock) || 0,
            originEventId: fact.originEventId,
            version: 1
        };
        ids.push(id);
    }
    return ids;
}

function storyCharacterCreationApply(character) {
    if (!storyCharacterIdentityEnabled() || !character || !Array.isArray(character.decisions)) {
        return { applied: false, reason: 'NO_CREATION_DECISIONS' };
    }
    const validation = storyCharacterCreationValidate(character);
    if (!validation.ok) return { applied: false, reason: 'INVALID_CREATION_DECISIONS', validation };
    const ledger = storyCharacterIdentityEnsure();
    const countryId = `country:${STORY.playerStateId | 0}`;
    const actorId = `character:${STORY.playerStateId | 0}:${STORY.commander.id}`;
    const identity = ledger && ledger.identities[actorId];
    if (!identity) return { applied: false, reason: 'PLAYER_IDENTITY_MISSING' };
    if (ledger.creationProfiles[actorId]) {
        return { applied: false, duplicate: true, profile: storyCharacterIdentityClone(ledger.creationProfiles[actorId]) };
    }
    const completedAt = Number(STORY.clock) || 0;
    const profile = {
        id: `creation-profile:${actorId}`,
        actorId,
        countryId,
        role: validation.policy.role,
        policyVersion: STORY_CHARACTER_CREATION_POLICY_VERSION,
        questionPolicyVersion: validation.policy.version,
        distribution: storyCharacterIdentityClone(validation.counts),
        completedAt,
        decisions: [],
        version: 1
    };
    const ordered = character.decisions.slice().sort((a, b) => Number(a.index) - Number(b.index));
    for (const decision of ordered) {
        const template = storyCharacterDecisionTemplate(
            validation.policy.role, decision.theme, decision.optionTag
        );
        const factId = `world-fact:character-origin:${STORY.playerStateId | 0}:${STORY.commander.id}:${decision.index}`;
        const receipt = storyCausalityRun({
            type: 'character.creation_decision',
            eventType: 'character.origin_decision_recorded',
            actor: { type: 'character', id: actorId },
            target: { type: 'character', id: actorId },
            payload: {
                actorId, countryId, role: validation.policy.role,
                decisionIndex: decision.index, theme: decision.theme,
                optionTag: decision.optionTag, visibility: template.visibility,
                reactionHook: template.reactionHook
            },
            idempotencyKey: `character-origin:${actorId}:${decision.index}`,
            correlationId: `character-origin:${actorId}`
        }, ctx => {
            const gain = storyCharacterCreationApplyDelta(template.gain, actorId, countryId);
            const cost = storyCharacterCreationApplyDelta(template.cost, actorId, countryId);
            if (!gain || !cost || !(gain.appliedDelta > 0) || !(cost.appliedDelta < 0)) {
                throw new Error(`Karakter kararı kazanç/bedel uygulayamadı: ${decision.index}`);
            }
            const originEventId = ctx && ctx.event ? ctx.event.id : null;
            const fact = {
                id: factId,
                factType: 'CHARACTER_ORIGIN_DECISION',
                subjectActorId: actorId,
                countryId,
                decisionIndex: Number(decision.index),
                role: validation.policy.role,
                theme: String(decision.theme),
                branch: String(decision.branch || 'root'),
                questionText: String(decision.questionText),
                optionText: String(decision.optionText),
                optionTag: String(decision.optionTag),
                occurredAt: completedAt,
                originEventId,
                visibility: template.visibility,
                reactionHook: template.reactionHook,
                gain: storyCharacterIdentityClone(gain),
                cost: storyCharacterIdentityClone(cost),
                firstVisibleAt: completedAt,
                visibilityDeadlineAt: completedAt + 600,
                version: 1
            };
            ledger.worldFacts[factId] = fact;
            fact.actorBeliefIds = storyCharacterCreationRecordBeliefs(ledger, fact, actorId);
            if (typeof storyCausalityRecordEffect === 'function') storyCausalityRecordEffect({
                target: { type: 'world-fact', id: factId },
                path: `worldFact:${factId}`,
                operation: 'SET',
                before: null,
                after: { status: 'RECORDED', beliefCount: fact.actorBeliefIds.length },
                source: 'character.creation_decision',
                observed: true
            });
            return {
                worldFactId: factId,
                originEventId,
                gain: storyCharacterIdentityClone(gain),
                cost: storyCharacterIdentityClone(cost),
                visibleAt: completedAt,
                visibilityDeadlineAt: completedAt + 600
            };
        });
        if (!receipt.applied || !receipt.result) {
            throw new Error(`Karakter köken kararı kaydedilemedi: ${decision.index}`);
        }
        profile.decisions.push(Object.assign({
            index: Number(decision.index),
            theme: String(decision.theme),
            optionTag: String(decision.optionTag),
            optionText: String(decision.optionText),
            reactionHook: template.reactionHook
        }, receipt.result));
    }
    ledger.creationProfiles[actorId] = profile;
    identity.creationProfileId = profile.id;
    identity.updatedAt = completedAt;
    if (typeof storyRelationshipApplyOriginProfile === 'function') {
        profile.relationshipSeed = storyRelationshipApplyOriginProfile(profile);
    }
    if (typeof storyLog === 'function') {
        storyLog(`📜 Geçmişin dünyaya yazıldı: ${profile.decisions.length} kararın kazancı ve bedeli artık etkin.`);
    }
    return { applied: true, profile: storyCharacterIdentityClone(profile) };
}

function storyCharacterCreationOutcomeView(actorId) {
    const ledger = storyCharacterIdentityEnsure();
    const profile = ledger && ledger.creationProfiles[String(actorId)];
    if (!profile) return null;
    const factIds = new Set(profile.decisions.map(row => row.worldFactId));
    return {
        profile: storyCharacterIdentityClone(profile),
        worldFacts: Object.values(ledger.worldFacts).filter(row => factIds.has(row.id)).map(storyCharacterIdentityClone),
        actorBeliefs: Object.values(ledger.actorBeliefs)
            .filter(row => factIds.has(row.worldFactId)).map(storyCharacterIdentityClone),
        firstVisibleAt: Math.min(...profile.decisions.map(row => Number(row.visibleAt))),
        latestVisibilityDeadlineAt: Math.max(...profile.decisions.map(row => Number(row.visibilityDeadlineAt)))
    };
}

function storyCharacterCreationSummary(actorId) {
    const view = storyCharacterCreationOutcomeView(actorId);
    if (!view) return null;
    const net = {};
    for (const decision of view.profile.decisions) {
        for (const effect of [decision.gain, decision.cost]) {
            const key = `${effect.scope}.${effect.key}`;
            net[key] = (net[key] || 0) + Number(effect.appliedDelta || 0);
        }
    }
    return {
        decisionCount: view.profile.decisions.length,
        factCount: view.worldFacts.length,
        beliefCount: view.actorBeliefs.length,
        net,
        visibleWithinSeconds: Math.max(0, view.firstVisibleAt - view.profile.completedAt)
    };
}
function storyCharacterIdentityView(actorId) {
    const ledger = storyCharacterIdentityEnsure();
    let row = ledger && ledger.identities[String(actorId)];
    // Sonradan yaratılan tek bir komutan için bütün karakterleri her okumada
    // uzlaştırma. Yalnız eksik kimlik istendiğinde kaynak listesini bir kez tara.
    if (!row && ledger) {
        const source = storyCharacterIdentitySources().find(item => item.id === String(actorId));
        if (source) row = ledger.identities[source.id] = storyCharacterIdentityCreate(source);
    }
    if (!row) return null;
    const stateId = Number(String(row.countryId).split(':').pop());
    const state = typeof storyState === 'function' ? storyState(stateId) : null;
    const commanderId = /^character:\d+:(\d+)$/.exec(row.id);
    const commander = commanderId && typeof storyCommanderById === 'function'
        ? storyCommanderById(stateId, Number(commanderId[1])) : null;
    const loyalty = commander ? Number(commander.loyalty) || 50 : (row.role === 'EXECUTIVE' ? 78 : 50);
    const institutionalDistance = Math.abs(Number(row.coreAxes.institutionalPosture) - 65);
    const currentRegimeAlignment = storyCharacterIdentityClamp(loyalty - institutionalDistance * 0.35);
    return Object.assign(storyCharacterIdentityClone(row), {
        currentRegimeAlignment,
        alignmentModel: 'DERIVED_FROM_ROLE_LOYALTY_AND_INSTITUTIONAL_DISTANCE'
    });
}
function storyCharacterExecutiveHolder(countryId) {
    const stateId = Number(String(countryId).split(':').pop());
    const row = storyCharacterIdentityView(`character:${stateId}:president`);
    return row ? {
        actorId: row.id, actorType: 'CHARACTER', name: row.name,
        model: 'CANONICAL_CHARACTER_IDENTITY_PHASE_34'
    } : null;
}

function storyCharacterOptionScore(actorId, option) {
    const actor = storyCharacterIdentityView(actorId);
    if (!actor) return { optionId: option && option.id, score: 0, reasons: ['CHARACTER_IDENTITY_MISSING'] };
    const affinities = option && option.affinities || {};
    let score = Number(option && option.baseScore) || 0;
    const reasons = [];
    for (const axis of STORY_CHARACTER_CORE_AXES) {
        if (!Number.isFinite(Number(affinities[axis]))) continue;
        const centered = (Number(actor.coreAxes[axis]) - 50) / 50;
        const contribution = centered * Number(affinities[axis]);
        score += contribution;
        reasons.push(`${axis}:${contribution >= 0 ? '+' : ''}${contribution.toFixed(2)}`);
    }
    for (const goal of actor.goals || []) {
        if ((option.goalTags || []).includes(goal.objective)) {
            const contribution = Number(goal.priorityBps) / 1000;
            score += contribution;
            reasons.push(`goal:${goal.objective}:+${contribution.toFixed(2)}`);
        }
    }
    return { optionId: String(option.id), score: Math.round(score * 1000) / 1000, reasons };
}
function storyCharacterRankOptions(actorId, options) {
    // Profil hiçbir adayı silmez; yetki/uygunluk kontrolü ilgili domainindir.
    return (options || []).map(option => storyCharacterOptionScore(actorId, option))
        .sort((a, b) => b.score - a.score || a.optionId.localeCompare(b.optionId, 'en'));
}
function storyCharacterConversationStrategy(actorId, context) {
    const actor = storyCharacterIdentityView(actorId);
    if (!actor) return null;
    const stakes = Math.max(0, Math.min(100, Number(context && context.stakes) || 50));
    return {
        actorId: actor.id,
        opening: actor.voiceProfile.directnessBps >= 6000 ? 'STATE_POSITION_FIRST' : 'RELATIONSHIP_CONTEXT_FIRST',
        evidenceStyle: actor.coreAxes.popularTechnocraticStyle < 50 ? 'FIGURES_AND_CAUSAL_CHAIN' : 'HUMAN_CONSEQUENCE_AND_SHARED_STAKES',
        concessionStyle: actor.coreAxes.institutionalPosture >= 55 ? 'FORMAL_RECIPROCAL_COMMITMENT' : 'REVERSIBLE_PILOT',
        pressureToleranceBps: storyCharacterIdentityClamp(70 - stakes * 0.25 + actor.values.hawkishness * 0.25) * 100,
        prohibitedFabrication: true,
        voiceProfile: storyCharacterIdentityClone(actor.voiceProfile)
    };
}
