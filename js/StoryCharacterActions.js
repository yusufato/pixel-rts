// ============================================================================
//  KARAKTER EYLEM ADAYLARI VE MAKBUZLARI — Faz 37
//  ---------------------------------------------------------------------------
//  Karakter kimliği niyet, kurum defteri yetki, ilişki grafı sosyal sonuç,
//  hafıza ise yaşanmış bağlam taşır. Bu katman bunları tek bir doğrulama
//  zincirinde birleştirir; LLM veya rastgelelik eylem seçemez ve sayı yazamaz.
//
//  İkna, müzakere, kişisel ittifak ve ihanet gerçek ilişki/hafıza sonucu
//  üretir. Emir, karakter hedefinden ayrı bir komut ve saha hedefi ister;
//  Faz 33.1 yönetim kuyruğuna gerçek seferberlik kararı yollar. Sabotaj
//  fiziksel varlığa; istifa ise kanonik makam devri ve halefliğe bağlanır.
// ============================================================================

const STORY_CHARACTER_ACTION_SCHEMA_VERSION = 8;
const STORY_CHARACTER_ACTION_ADAPTER_VERSION = 'story-character-action-ledger-8';
const STORY_CHARACTER_ACTION_RECEIPT_CAP = 2048;
const STORY_CHARACTER_ARBITER_DECISION_CAP = 512;
const STORY_CHARACTER_ACTION_AI_POLICY_HASH = 'fnv1a32:phase38-speech-realizer-4';
const STORY_CHARACTER_ACTION_AI_ACTOR_WINDOW = 8;
const STORY_CHARACTER_ACTION_AI_CONTACT_CAP = 4;
const STORY_CHARACTER_ACTION_AI_MIN_SCORE = 54;
const STORY_CHARACTER_ACTION_AI_RECENT_WINDOW_SECONDS = 120;
const STORY_CHARACTER_ACTION_SABOTAGE_DELAY_SECONDS = 30;
const STORY_CHARACTER_ACTION_SABOTAGE_MAX_DAMAGE_BPS = 10000;
const STORY_CHARACTER_ACTION_PLAYER_TYPES = Object.freeze(['PERSUADE', 'NEGOTIATE', 'ALLY', 'BETRAY']);
const STORY_CHARACTER_ACTION_AI_SOURCES = Object.freeze(['DETERMINISTIC_AI', 'LOCAL_LLM_VALIDATED']);

const STORY_CHARACTER_ACTION_DEFS = Object.freeze({
    PERSUADE: Object.freeze({
        id: 'PERSUADE', name: 'İkna et', targetRequired: true,
        authorityModel: 'PERSONAL_AGENCY', cooldownSeconds: 20, pairCooldownSeconds: 180,
        cost: Object.freeze({ key: 'influence', amount: 2 }), handler: 'RELATIONSHIP',
        relationshipEffects: Object.freeze([
            Object.freeze({ direction: 'TARGET_TO_ACTOR', trustBps: 180, respectBps: 90, hostilityBps: -70 })
        ])
    }),
    NEGOTIATE: Object.freeze({
        id: 'NEGOTIATE', name: 'Müzakere et', targetRequired: true,
        authorityModel: 'PERSONAL_AGENCY', cooldownSeconds: 30, pairCooldownSeconds: 300,
        cost: Object.freeze({ key: 'influence', amount: 3 }), handler: 'RELATIONSHIP',
        relationshipEffects: Object.freeze([
            Object.freeze({ direction: 'ACTOR_TO_TARGET', trustBps: 110, respectBps: 70, hostilityBps: -60 }),
            Object.freeze({ direction: 'TARGET_TO_ACTOR', trustBps: 110, respectBps: 70, hostilityBps: -60 })
        ])
    }),
    ORDER: Object.freeze({
        id: 'ORDER', name: 'Emir ver', targetRequired: true,
        targetModel: 'CHARACTER_AND_REGION_COMMAND',
        authorityModel: 'INSTITUTION_OFFICE', institutionTypes: Object.freeze(['EXECUTIVE', 'ARMED_FORCES']),
        cooldownSeconds: 30, pairCooldownSeconds: 120,
        cost: Object.freeze({ ledger: 'GOVERNANCE', key: null, amount: 0 }), handler: 'GOVERNANCE_ORDER'
    }),
    SABOTAGE: Object.freeze({
        id: 'SABOTAGE', name: 'Sabotaj düzenle', targetRequired: true,
        targetModel: 'CHARACTER_AND_WORLD_ASSET',
        authorityModel: 'INTELLIGENCE_SERVICE', allowedRoles: Object.freeze(['AGENT']),
        cooldownSeconds: 90, cost: Object.freeze({ key: 'capability', amount: 6 }), handler: 'COVERT_OPERATION'
    }),
    ALLY: Object.freeze({
        id: 'ALLY', name: 'Kişisel ittifak kur', targetRequired: true,
        authorityModel: 'PERSONAL_AGENCY', cooldownSeconds: 60, pairCooldownSeconds: 900,
        cost: Object.freeze({ key: 'credibility', amount: 4 }), handler: 'RELATIONSHIP',
        relationshipEffects: Object.freeze([
            Object.freeze({ direction: 'ACTOR_TO_TARGET', trustBps: 280, respectBps: 170, hostilityBps: -180 }),
            Object.freeze({ direction: 'TARGET_TO_ACTOR', trustBps: 280, respectBps: 170, hostilityBps: -180 })
        ])
    }),
    RESIGN: Object.freeze({
        id: 'RESIGN', name: 'İstifa et', targetRequired: false,
        targetModel: 'OWN_INSTITUTION',
        authorityModel: 'INSTITUTION_OFFICE', cooldownSeconds: 0,
        cost: Object.freeze({ key: null, amount: 0 }), handler: 'OFFICE_SUCCESSION'
    }),
    BETRAY: Object.freeze({
        id: 'BETRAY', name: 'İhanet et', targetRequired: true,
        authorityModel: 'PERSONAL_AGENCY', cooldownSeconds: 120, pairCooldownSeconds: 1200,
        cost: Object.freeze({ key: 'credibility', amount: 8 }), handler: 'RELATIONSHIP',
        relationshipEffects: Object.freeze([
            Object.freeze({ direction: 'ACTOR_TO_TARGET', trustBps: -2200, respectBps: -900, hostilityBps: 1700 }),
            Object.freeze({ direction: 'TARGET_TO_ACTOR', trustBps: -2800, respectBps: -1200, hostilityBps: 2400 })
        ])
    })
});

function storyCharacterActionEnabled() {
    return typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('characters.actionCandidates');
}

function storyCharacterActionClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyCharacterActionNow() {
    return Number.isFinite(Number(STORY.clock)) ? Number(STORY.clock) : 0;
}

function storyCharacterActionSafeToken(value) {
    return String(value == null ? '' : value).replace(/[^a-zA-Z0-9_-]/g, '-');
}

function storyCharacterActionClampBps(value, minimum, maximum) {
    return Math.max(minimum == null ? 0 : minimum,
        Math.min(maximum == null ? 10000 : maximum, Math.round(Number(value) || 0)));
}

function storyCharacterActionHash32(value) {
    const text = String(value == null ? '' : value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

function storyCharacterActionDeterministicBps(value) {
    return storyCharacterActionHash32(value) % 10000;
}

function storyCharacterActionAIReceipt(receipt) {
    return !!(receipt && STORY_CHARACTER_ACTION_AI_SOURCES.includes(receipt.decisionSource));
}

function storyCharacterActionSabotagePlan(candidate, receiptId) {
    const targetCountry = typeof storyStateCapacityCountryView === 'function'
        ? storyStateCapacityCountryView(candidate.targetCountryId) : null;
    const capability = storyCharacterActionClampBps(
        (Number(candidate.cost && candidate.cost.available) || 0) * 100
    );
    const bureaucratic = storyCharacterActionClampBps(targetCountry && targetCountry.bureaucraticCapacityBps);
    const integrity = storyCharacterActionClampBps(targetCountry && targetCountry.institutionalIntegrityBps);
    const control = storyCharacterActionClampBps(targetCountry && targetCountry.regionalControlBps);
    const securityBps = storyCharacterActionClampBps(
        bureaucratic * 0.35 + integrity * 0.35 + control * 0.30
    );
    const existingDamageBps = storyCharacterActionClampBps(
        candidate.domainValidation && candidate.domainValidation.view
            && candidate.domainValidation.view.damageBps
    );
    const successChanceBps = storyCharacterActionClampBps(
        4600 + capability * 0.60 - securityBps * 0.20 + existingDamageBps * 0.08,
        1200, 9200
    );
    const detectionChanceBps = storyCharacterActionClampBps(
        2200 + securityBps * 0.45 - capability * 0.18,
        800, 9000
    );
    const attributionChanceBps = storyCharacterActionClampBps(
        1000 + integrity * 0.50 - capability * 0.12,
        500, 8500
    );
    const damageDeltaBps = storyCharacterActionClampBps(
        1400 + capability * 0.12,
        1400, 3200
    );
    const seed = STORY.seed == null ? 0 : STORY.seed;
    const commitment = [seed, receiptId, candidate.actorId,
        candidate.domainContext.targetAssetId].join('|');
    return {
        operationId: `covert-operation:${storyCharacterActionSafeToken(receiptId)}`,
        successChanceBps, detectionChanceBps, attributionChanceBps,
        damageDeltaBps, securityBps,
        resolutionCommitment: `fnv1a32:${storyCharacterActionHash32(commitment).toString(16).padStart(8, '0')}`,
        resolutionKey: commitment
    };
}

function storyCharacterActionIdentities() {
    const ledger = typeof storyCharacterIdentityEnsure === 'function'
        ? storyCharacterIdentityEnsure() : null;
    return ledger && ledger.identities || {};
}

function storyCharacterActionLedgerCreate(options) {
    options = options || {};
    return {
        schemaVersion: STORY_CHARACTER_ACTION_SCHEMA_VERSION,
        adapterVersion: STORY_CHARACTER_ACTION_ADAPTER_VERSION,
        nextReceiptSequence: 0,
        nextArbiterDecisionSequence: 0,
        cooldowns: {},
        receipts: {},
        arbiterDecisions: {},
        officeTransitions: {},
        ai: {
            policyHash: STORY_CHARACTER_ACTION_AI_POLICY_HASH,
            cursor: 0,
            tickSequence: 0,
            selectedCount: 0,
            appliedCount: 0,
            deniedCount: 0,
            prunedAppliedCount: 0,
            prunedDeniedCount: 0,
            arbiterRequestedCount: 0,
            arbiterAcceptedCount: 0,
            arbiterPassCount: 0,
            arbiterFallbackCount: 0,
            arbiterStaleCount: 0,
            arbiterRestoredCount: 0,
            arbiterDecisionPrunedCount: 0,
            lastTickAt: 0,
            lastSelection: null,
            pendingArbiter: null
        },
        diagnostics: {
            backfilled: !!options.backfilled,
            restoredFromInvalidLedger: false,
            receiptCap: STORY_CHARACTER_ACTION_RECEIPT_CAP,
            deterministicCandidates: true,
            randomDecisions: false,
            llmDecisions: true,
            unavailableDomainExecutors: []
        }
    };
}

function storyCharacterActionMigrateLedger(saved) {
    const ledger = storyCharacterActionClone(saved);
    if (!ledger || typeof ledger !== 'object'
        || ![1, 2, 3, 4, 5, 6, 7, STORY_CHARACTER_ACTION_SCHEMA_VERSION].includes(ledger.schemaVersion)) return null;
    if (!ledger.cooldowns || typeof ledger.cooldowns !== 'object') ledger.cooldowns = {};
    if (!ledger.receipts || typeof ledger.receipts !== 'object') ledger.receipts = {};
    if (!ledger.arbiterDecisions || typeof ledger.arbiterDecisions !== 'object'
        || Array.isArray(ledger.arbiterDecisions)) ledger.arbiterDecisions = {};
    ledger.nextArbiterDecisionSequence = Math.max(0,
        Math.floor(Number(ledger.nextArbiterDecisionSequence) || 0));
    if (!ledger.officeTransitions || typeof ledger.officeTransitions !== 'object'
        || Array.isArray(ledger.officeTransitions)) ledger.officeTransitions = {};
    const defaults = storyCharacterActionLedgerCreate({
        backfilled: !!(ledger.diagnostics && ledger.diagnostics.backfilled)
    });
    ledger.ai = Object.assign({}, defaults.ai, ledger.ai || {});
    // Politika karması, kayıttaki eski seçiciyi sürdürmek için değil hangi
    // kuralla devam edildiğini kanıtlamak içindir. Yeni sürüme göçte günceldir.
    ledger.ai.policyHash = STORY_CHARACTER_ACTION_AI_POLICY_HASH;
    for (const receipt of Object.values(ledger.receipts)) {
        const definition = STORY_CHARACTER_ACTION_DEFS[receipt && receipt.actionType];
        if (!receipt || !definition) continue;
        if (!receipt.targetModel) receipt.targetModel = definition.targetModel
            || (definition.targetRequired ? 'CHARACTER' : 'NONE');
        if (!receipt.domainContext || typeof receipt.domainContext !== 'object') receipt.domainContext = {};
        if (receipt.domainReceipt === undefined) receipt.domainReceipt = null;
        receipt.version = Math.max(1, Number(receipt.version) || 1);
    }
    ledger.diagnostics = Object.assign({}, defaults.diagnostics, ledger.diagnostics || {}, {
        unavailableDomainExecutors: []
    });
    ledger.schemaVersion = STORY_CHARACTER_ACTION_SCHEMA_VERSION;
    ledger.adapterVersion = STORY_CHARACTER_ACTION_ADAPTER_VERSION;
    return ledger;
}

function storyCharacterActionReset() {
    if (!storyCharacterActionEnabled()) { STORY.characterActions = null; return null; }
    if (typeof storyCharacterArbiterLiveReset === 'function') storyCharacterArbiterLiveReset({ preserveTestAdapter: true });
    STORY.characterActions = storyCharacterActionLedgerCreate();
    return storyCharacterActionSnapshot();
}

function storyCharacterActionEnsure() {
    if (!storyCharacterActionEnabled()) return null;
    if (STORY.characterActions
        && STORY.characterActions.schemaVersion !== STORY_CHARACTER_ACTION_SCHEMA_VERSION) {
        STORY.characterActions = storyCharacterActionMigrateLedger(STORY.characterActions);
    }
    if (!STORY.characterActions) STORY.characterActions = storyCharacterActionLedgerCreate();
    return STORY.characterActions;
}

// Kurum katmanı her ensure çağrısında makamları kaynaklarından yeniden kurar.
// İstifa sonucunun kayıt/yüklemede eski sahibine dönmemesi için aktif geçiş
// burada kanonik kaynak olarak tutulur; StoryInstitutions yalnız salt-okunur
// halef görünümünü tüketir.
function storyCharacterActionOfficeHolderOverride(countryId, institutionType) {
    const ledger = STORY.characterActions;
    if (!ledger || !ledger.officeTransitions) return null;
    const normalizedCountryId = String(countryId || '');
    const institutionId = `institution:${normalizedCountryId}:${String(institutionType || '').toLowerCase()}`;
    const transition = ledger.officeTransitions[institutionId];
    if (!transition || transition.status !== 'ACTIVE' || !transition.successorHolder) return null;
    return storyCharacterActionClone(transition.successorHolder);
}

function storyCharacterActionSuccessorRoleScore(institutionType, actor) {
    const role = String(actor && actor.role || '').toUpperCase();
    if (institutionType === 'EXECUTIVE') {
        if (role === 'EXECUTIVE') return 5000;
        if (role === 'POLITICAL_FIGURE') return 4600;
        if (role === 'POLITICAL_CANDIDATE') return 4300;
        if (role === 'COMPANY_EXECUTIVE') return 2200;
        if (role === 'COMMANDER') return 1800;
        return 500;
    }
    if (institutionType === 'ARMED_FORCES') {
        const family = typeof storyRelationshipRoleFamily === 'function'
            ? storyRelationshipRoleFamily(role) : null;
        if (family === 'MILITARY' || ['COMMANDER', 'GENERAL', 'OFFICER'].includes(role)) return 5000;
        return 0;
    }
    return 0;
}

function storyCharacterActionChooseOfficeSuccessor(actor, institution) {
    if (!actor || !institution) return null;
    const institutionType = String(institution.type || '').toUpperCase();
    const candidates = Object.values(storyCharacterActionIdentities())
        .filter(row => row && row.id !== actor.id && row.countryId === actor.countryId)
        .map(row => {
            const roleScore = storyCharacterActionSuccessorRoleScore(institutionType, row);
            const credibility = Number(row.career && row.career.credibility) || 0;
            const influence = Number(row.career && row.career.influence) || 0;
            return {
                actor: row,
                roleScore,
                score: roleScore * 10000 + Math.round(credibility * 100) + Math.round(influence * 10)
            };
        })
        .filter(row => row.roleScore > 0)
        .sort((a, b) => b.score - a.score || a.actor.id.localeCompare(b.actor.id, 'en'));
    const selected = candidates[0] && candidates[0].actor;
    return selected ? {
        actorId: selected.id,
        actorType: 'CHARACTER',
        name: selected.name,
        model: 'PHASE_37_DETERMINISTIC_SUCCESSOR'
    } : null;
}

function storyCharacterActionCooldownKey(actorId, actionType) {
    return `${String(actorId)}|${String(actionType).toUpperCase()}`;
}

function storyCharacterActionPairCooldownKey(actorId, actionType, targetActorId) {
    return `${String(actorId)}|${String(actionType).toUpperCase()}|${String(targetActorId)}`;
}

function storyCharacterActionHeldInstitutions(actorId) {
    const ledger = typeof storyInstitutionEnsure === 'function' ? storyInstitutionEnsure() : null;
    const rows = [];
    for (const country of Object.values(ledger && ledger.countries || {})) {
        for (const institution of Object.values(country.institutions || {})) {
            if (institution.officeHolder && institution.officeHolder.actorId === actorId) {
                rows.push({
                    countryId: country.countryId,
                    institutionId: institution.id,
                    institutionType: institution.type,
                    authoritySignature: country.authoritySignature
                });
            }
        }
    }
    return rows.sort((a, b) => a.institutionId.localeCompare(b.institutionId, 'en'));
}

function storyCharacterActionAuthority(definition, actor, target) {
    if (!definition || !actor) return { ok: false, model: null, reason: 'ACTOR_NOT_FOUND', grants: [] };
    if (definition.authorityModel === 'PERSONAL_AGENCY') {
        return { ok: true, model: 'PERSONAL_AGENCY', reason: null, grants: [] };
    }
    if (definition.authorityModel === 'INTELLIGENCE_SERVICE') {
        const allowed = (definition.allowedRoles || []).includes(actor.role) && !!actor.serviceId;
        return {
            ok: allowed,
            model: 'INTELLIGENCE_SERVICE',
            reason: allowed ? null : 'ACTOR_LACKS_INTELLIGENCE_SERVICE',
            grants: actor.serviceId ? [{ serviceId: actor.serviceId }] : []
        };
    }
    if (definition.authorityModel === 'INSTITUTION_OFFICE') {
        const held = storyCharacterActionHeldInstitutions(actor.id);
        const grants = definition.institutionTypes
            ? held.filter(row => definition.institutionTypes.includes(row.institutionType))
            : held;
        return {
            ok: grants.length > 0,
            model: 'INSTITUTION_OFFICE',
            reason: grants.length ? null : 'ACTOR_LACKS_REQUIRED_OFFICE',
            grants
        };
    }
    return { ok: false, model: definition.authorityModel, reason: 'UNKNOWN_AUTHORITY_MODEL', grants: [] };
}

function storyCharacterActionContact(actor, target) {
    if (!actor || !target) return false;
    if (actor.countryId === target.countryId) return true;
    if (typeof storyRelationshipView !== 'function') return false;
    return !!(storyRelationshipView(actor.id, target.id) || storyRelationshipView(target.id, actor.id));
}

function storyCharacterActionTargetValidation(definition, actor, target) {
    if (!definition.targetRequired) return { ok: target == null, reason: target == null ? null : 'TARGET_NOT_ALLOWED' };
    if (!target) return { ok: false, reason: 'TARGET_NOT_FOUND' };
    if (!actor) return { ok: false, reason: 'ACTOR_NOT_FOUND' };
    if (actor.id === target.id) return { ok: false, reason: 'SELF_TARGET_FORBIDDEN' };
    if (definition.id === 'ORDER' && actor.countryId !== target.countryId) {
        return { ok: false, reason: 'TARGET_OUTSIDE_COMMAND_JURISDICTION' };
    }
    if (definition.id === 'ORDER') {
        const family = typeof storyRelationshipRoleFamily === 'function'
            ? storyRelationshipRoleFamily(target.role) : null;
        const military = family === 'MILITARY'
            || ['COMMANDER', 'GENERAL', 'OFFICER', 'SOLDIER'].includes(String(target.role || '').toUpperCase());
        if (!military) return { ok: false, reason: 'ORDER_TARGET_MUST_BE_MILITARY' };
    }
    if (definition.id === 'SABOTAGE' && actor.countryId === target.countryId) {
        return { ok: false, reason: 'SABOTAGE_TARGET_MUST_BE_FOREIGN' };
    }
    if (['PERSUADE', 'NEGOTIATE', 'ALLY', 'BETRAY'].includes(definition.id)
        && !storyCharacterActionContact(actor, target)) {
        return { ok: false, reason: 'NO_VERIFIED_CONTACT' };
    }
    if (definition.id === 'ALLY') {
        const memory = typeof storyMemoryEnsure === 'function' ? storyMemoryEnsure() : null;
        const alreadyAllied = Object.values(memory && memory.milestones || {}).some(row =>
            row.kind === 'RELATIONSHIP' && row.status === 'ACTIVE'
            && [row.subjectActorId].concat(row.relatedActorIds || []).includes(actor.id)
            && [row.subjectActorId].concat(row.relatedActorIds || []).includes(target.id));
        if (alreadyAllied) return { ok: false, reason: 'ALLIANCE_ALREADY_ACTIVE' };
    }
    if (definition.id === 'BETRAY') {
        const outgoing = typeof storyRelationshipView === 'function'
            ? storyRelationshipView(actor.id, target.id) : null;
        const incoming = typeof storyRelationshipView === 'function'
            ? storyRelationshipView(target.id, actor.id) : null;
        const meaningfulTie = [outgoing, incoming].filter(Boolean).some(edge =>
            Number(edge.trustBps) >= 4000 || Number(edge.debtBps) >= 1200 || Number(edge.respectBps) >= 5000);
        const memory = typeof storyMemoryEnsure === 'function' ? storyMemoryEnsure() : null;
        const allianceTie = Object.values(memory && memory.milestones || {}).some(row =>
            row.kind === 'RELATIONSHIP' && row.status === 'ACTIVE'
            && [row.subjectActorId].concat(row.relatedActorIds || []).includes(actor.id)
            && [row.subjectActorId].concat(row.relatedActorIds || []).includes(target.id));
        if (!meaningfulTie && !allianceTie) return { ok: false, reason: 'BETRAYAL_REQUIRES_MEANINGFUL_TIE' };
    }
    return { ok: true, reason: null };
}

function storyCharacterActionDomainContext(input) {
    const source = input && input.domainContext && typeof input.domainContext === 'object'
        ? input.domainContext : {};
    const clean = {};
    for (const key of ['commandType', 'targetRegionId', 'targetAssetId', 'assetType', 'targetInstitutionId']) {
        if (source[key] != null && String(source[key]).trim()) clean[key] = String(source[key]).trim();
    }
    return clean;
}

function storyCharacterActionDomainValidation(definition, actor, target, domainContext) {
    if (!definition) return {
        ok: false, reason: 'UNKNOWN_ACTION_TYPE', executorAvailable: false,
        targetModel: null, view: null
    };
    const targetModel = definition.targetModel || (definition.targetRequired ? 'CHARACTER' : 'NONE');
    if (definition.id === 'ORDER') {
        if (!domainContext.commandType) return {
            ok: false, reason: 'ORDER_COMMAND_TYPE_REQUIRED', executorAvailable: true,
            targetModel, view: null
        };
        if (domainContext.commandType !== 'MOBILIZE_RESERVE') return {
            ok: false, reason: 'ORDER_COMMAND_TYPE_UNSUPPORTED', executorAvailable: true,
            targetModel, view: null
        };
        if (!domainContext.targetRegionId) return {
            ok: false, reason: 'ORDER_REGION_TARGET_REQUIRED', executorAvailable: true,
            targetModel, view: null
        };
        if (!actor || actor.id !== storyCharacterActionAIPlayerActorId()) return {
            ok: false, reason: 'ORDER_PLAYER_GOVERNANCE_CONTEXT_REQUIRED', executorAvailable: true,
            targetModel, view: null
        };
        if (typeof storyGovernanceActionView !== 'function' || typeof storyGovernanceSubmit !== 'function') return {
            ok: false, reason: 'ORDER_GOVERNANCE_EXECUTOR_UNAVAILABLE', executorAvailable: false,
            targetModel, view: null
        };
        const view = storyGovernanceActionView(domainContext.commandType, domainContext.targetRegionId);
        return {
            ok: !!(view && view.allowed),
            reason: view && view.allowed ? null : 'ORDER_GOVERNANCE_LOCKED',
            executorAvailable: true, targetModel,
            view: storyCharacterActionClone(view || null)
        };
    }
    if (definition.id === 'SABOTAGE') {
        if (!domainContext.targetAssetId) return {
            ok: false, reason: 'SABOTAGE_ASSET_TARGET_REQUIRED',
            executorAvailable: false, targetModel, view: null
        };
        if (domainContext.assetType !== 'INFRASTRUCTURE_CORRIDOR') return {
            ok: false, reason: 'SABOTAGE_ASSET_TYPE_UNSUPPORTED',
            executorAvailable: false, targetModel, view: null
        };
        const infrastructure = typeof storyInfrastructureEnsure === 'function'
            ? storyInfrastructureEnsure() : null;
        const corridors = infrastructure && infrastructure.corridors;
        const asset = Array.isArray(corridors)
            ? corridors.find(row => row && row.id === domainContext.targetAssetId)
            : corridors && corridors[domainContext.targetAssetId];
        const ownerCountryIds = asset && typeof storyInfrastructureEndpointOwners === 'function'
            ? storyInfrastructureEndpointOwners(asset) : [];
        if (asset && target && !ownerCountryIds.includes(target.countryId)) return {
            ok: false, reason: 'SABOTAGE_ASSET_OUTSIDE_TARGET_JURISDICTION',
            executorAvailable: true, targetModel,
            view: {
                assetType: 'INFRASTRUCTURE_CORRIDOR', assetId: asset.id,
                damageBps: Number(asset.damageBps) || 0, ownerCountryIds
            }
        };
        return {
            ok: !!asset,
            reason: asset ? null : 'SABOTAGE_ASSET_TARGET_NOT_FOUND',
            executorAvailable: typeof storyInfrastructureSetDamage === 'function', targetModel,
            view: asset ? {
                assetType: 'INFRASTRUCTURE_CORRIDOR', assetId: asset.id,
                damageBps: Number(asset.damageBps) || 0, ownerCountryIds
            } : null
        };
    }
    if (definition.id === 'RESIGN') {
        if (!domainContext.targetInstitutionId) return {
            ok: false, reason: 'RESIGN_INSTITUTION_TARGET_REQUIRED', executorAvailable: false,
            targetModel, view: null
        };
        const held = actor ? storyCharacterActionHeldInstitutions(actor.id) : [];
        const grant = held.find(row => row.institutionId === domainContext.targetInstitutionId) || null;
        const institutionLedger = typeof storyInstitutionEnsure === 'function'
            ? storyInstitutionEnsure() : null;
        const country = grant && institutionLedger && institutionLedger.countries[grant.countryId];
        const institution = country && country.institutions[grant.institutionId];
        const successor = institution
            ? storyCharacterActionChooseOfficeSuccessor(actor, institution) : null;
        return {
            ok: !!grant && !!successor,
            reason: !grant ? 'RESIGN_TARGET_OFFICE_NOT_HELD'
                : (!successor ? 'RESIGN_SUCCESSOR_NOT_FOUND' : null),
            executorAvailable: true, targetModel,
            view: grant && institution ? {
                countryId: grant.countryId,
                institutionId: grant.institutionId,
                institutionType: grant.institutionType,
                institutionName: institution.name,
                predecessorActorId: actor.id,
                predecessorName: actor.name,
                successorHolder: storyCharacterActionClone(successor)
            } : null
        };
    }
    return { ok: true, reason: null, executorAvailable: !!definition.handler, targetModel, view: null };
}

function storyCharacterActionCostValidation(definition, actor) {
    const cost = definition && definition.cost || { key: null, amount: 0 };
    const ledger = String(cost.ledger || 'CHARACTER_CAREER');
    if (!cost.key || !(Number(cost.amount) > 0)) {
        return { ok: true, reason: null, ledger, key: null, amount: 0, available: null };
    }
    const available = Number(actor && actor.career && actor.career[cost.key]);
    if (!Number.isFinite(available)) {
        return { ok: false, reason: 'CAREER_RESOURCE_MISSING', ledger, key: cost.key, amount: cost.amount, available: null };
    }
    return {
        ok: available + 1e-6 >= cost.amount,
        reason: available + 1e-6 >= cost.amount ? null : 'INSUFFICIENT_CAREER_RESOURCE',
        ledger, key: cost.key, amount: cost.amount, available
    };
}

function storyCharacterActionCandidate(input) {
    input = input || {};
    const type = String(input.actionType || '').toUpperCase();
    const definition = STORY_CHARACTER_ACTION_DEFS[type];
    const identities = storyCharacterActionIdentities();
    const actorId = String(input.actorId || '');
    const targetActorId = input.targetActorId == null ? null : String(input.targetActorId);
    const actor = identities[actorId] || null;
    const target = targetActorId == null ? null : (identities[targetActorId] || null);
    const domainContext = storyCharacterActionDomainContext(input);
    const ledger = storyCharacterActionEnsure();
    const now = storyCharacterActionNow();
    const reasons = [];
    if (!storyCharacterActionEnabled() || !ledger) reasons.push('ACTION_LAYER_DISABLED');
    if (!definition) reasons.push('UNKNOWN_ACTION_TYPE');
    if (!actor) reasons.push('ACTOR_NOT_FOUND');

    const targetValidation = definition
        ? storyCharacterActionTargetValidation(definition, actor, target)
        : { ok: false, reason: 'UNKNOWN_ACTION_TYPE' };
    if (!targetValidation.ok && !reasons.includes(targetValidation.reason)) reasons.push(targetValidation.reason);

    const authority = definition
        ? storyCharacterActionAuthority(definition, actor, target)
        : { ok: false, model: null, reason: 'UNKNOWN_ACTION_TYPE', grants: [] };
    if (!authority.ok && !reasons.includes(authority.reason)) reasons.push(authority.reason);

    const domainValidation = storyCharacterActionDomainValidation(definition, actor, target, domainContext);
    if (type === 'ORDER' && domainValidation.view && domainValidation.view.targetRegionId) {
        domainContext.targetRegionId = String(domainValidation.view.targetRegionId);
    }
    if (!domainValidation.ok && !reasons.includes(domainValidation.reason)) reasons.push(domainValidation.reason);

    const cost = definition
        ? storyCharacterActionCostValidation(definition, actor)
        : { ok: false, reason: 'UNKNOWN_ACTION_TYPE', ledger: null, key: null, amount: 0, available: null };
    if (!cost.ok && !reasons.includes(cost.reason)) reasons.push(cost.reason);

    const cooldownKey = definition && actor
        ? storyCharacterActionCooldownKey(actor.id, definition.id) : null;
    const pairCooldownKey = definition && actor && target
        ? storyCharacterActionPairCooldownKey(actor.id, definition.id, target.id) : null;
    const actorAvailableAt = cooldownKey && ledger ? Number(ledger.cooldowns[cooldownKey]) || 0 : 0;
    const pairAvailableAt = pairCooldownKey && ledger ? Number(ledger.cooldowns[pairCooldownKey]) || 0 : 0;
    const availableAt = Math.max(now, actorAvailableAt, pairAvailableAt);
    const cooldownReady = availableAt <= now + 1e-9;
    if (!cooldownReady) reasons.push('ACTION_ON_COOLDOWN');
    const handlerAvailable = !!(definition && definition.handler && domainValidation.executorAvailable);
    if (definition && !handlerAvailable) reasons.push('DOMAIN_EXECUTOR_NOT_AVAILABLE');

    return {
        id: `character-action-candidate:${storyCharacterActionSafeToken(actorId)}:${type || 'unknown'}:${storyCharacterActionSafeToken(targetActorId || 'none')}`,
        actionType: type,
        actionName: definition ? definition.name : 'Bilinmeyen eylem',
        actorId,
        actorCountryId: actor ? actor.countryId : null,
        targetActorId,
        targetCountryId: target ? target.countryId : null,
        targetModel: domainValidation.targetModel,
        domainContext: storyCharacterActionClone(domainContext),
        domainValidation: storyCharacterActionClone(domainValidation),
        generatedAt: now,
        availableAt,
        cooldownSeconds: definition ? definition.cooldownSeconds : 0,
        pairCooldownSeconds: definition ? Number(definition.pairCooldownSeconds) || 0 : 0,
        targetValidation,
        authority,
        cost,
        handlerAvailable,
        decisionSource: String(input.decisionSource || 'PLAYER_OR_SYSTEM'),
        selectorScore: Number.isFinite(Number(input.selectorScore)) ? Number(input.selectorScore) : null,
        selectorReasons: Array.isArray(input.selectorReasons) ? input.selectorReasons.map(String) : [],
        decisionMetadata: input.decisionMetadata && typeof input.decisionMetadata === 'object'
            ? storyCharacterActionClone(input.decisionMetadata) : null,
        allowed: reasons.length === 0,
        reasons
    };
}

function storyCharacterActionCandidates(actorId, targetActorId, domainContexts) {
    domainContexts = domainContexts || {};
    return Object.keys(STORY_CHARACTER_ACTION_DEFS).map(actionType => storyCharacterActionCandidate({
        actorId,
        targetActorId: actionType === 'RESIGN' ? null : targetActorId,
        actionType,
        domainContext: domainContexts[actionType] || null
    }));
}

function storyCharacterActionPlayerView(targetActorId, domainContext) {
    const actorId = storyCharacterActionAIPlayerActorId();
    const identities = storyCharacterActionIdentities();
    const target = identities[String(targetActorId || '')] || null;
    if (!actorId || !identities[actorId]) {
        return { disabled: true, reason: 'PLAYER_CHARACTER_NOT_FOUND', actorId: null, targetActorId: targetActorId || null, actions: [] };
    }
    if (!target) {
        return { disabled: true, reason: 'TARGET_NOT_FOUND', actorId, targetActorId: targetActorId || null, actions: [] };
    }
    const cleanDomainContext = storyCharacterActionDomainContext({ domainContext });
    const playerTypes = STORY_CHARACTER_ACTION_PLAYER_TYPES.slice();
    if (cleanDomainContext.targetRegionId) playerTypes.push('ORDER');
    if (cleanDomainContext.targetAssetId) playerTypes.push('SABOTAGE');
    return {
        disabled: false,
        actorId,
        targetActorId: target.id,
        targetName: target.name,
        generatedAt: storyCharacterActionNow(),
        actions: playerTypes.map(actionType => {
            const candidate = storyCharacterActionCandidate({
                actorId, targetActorId: target.id, actionType, decisionSource: 'PLAYER_UI',
                domainContext: actionType === 'ORDER'
                    ? Object.assign({ commandType: 'MOBILIZE_RESERVE' }, cleanDomainContext)
                    : (actionType === 'SABOTAGE' ? cleanDomainContext : null)
            });
            return {
                actionType,
                label: candidate.actionName,
                allowed: candidate.allowed,
                availableAt: candidate.availableAt,
                cooldownRemainingSeconds: Math.max(0, candidate.availableAt - candidate.generatedAt),
                cost: storyCharacterActionClone(candidate.cost),
                domainCost: storyCharacterActionClone(candidate.domainValidation
                    && candidate.domainValidation.view && candidate.domainValidation.view.cost || null),
                domainContext: storyCharacterActionClone(candidate.domainContext),
                domainReasons: storyCharacterActionClone(candidate.domainValidation
                    && candidate.domainValidation.view && candidate.domainValidation.view.reasons || []),
                reasons: candidate.reasons.slice()
            };
        })
    };
}

function storyCharacterActionExecutePlayer(actionType, targetActorId, domainContext) {
    const type = String(actionType || '').toUpperCase();
    if (!STORY_CHARACTER_ACTION_PLAYER_TYPES.includes(type) && !['ORDER', 'SABOTAGE', 'RESIGN'].includes(type)) {
        return { ok: false, status: 'DENIED', reason: 'ACTION_NOT_ON_PLAYER_SURFACE' };
    }
    const actorId = storyCharacterActionAIPlayerActorId();
    if (!actorId) return { ok: false, status: 'DENIED', reason: 'PLAYER_CHARACTER_NOT_FOUND' };
    return storyCharacterActionExecute({
        actionType: type,
        actorId,
        targetActorId: type === 'RESIGN' ? null : String(targetActorId || ''),
        decisionSource: 'PLAYER_UI',
        domainContext: type === 'ORDER'
            ? Object.assign({ commandType: 'MOBILIZE_RESERVE' }, storyCharacterActionDomainContext({ domainContext }))
            : (['SABOTAGE', 'RESIGN'].includes(type)
                ? storyCharacterActionDomainContext({ domainContext }) : null)
    });
}

function storyCharacterActionSpendCost(candidate, receiptId) {
    const cost = candidate.cost;
    if (!cost.key || !(Number(cost.amount) > 0)) {
        return { ok: true, ledger: cost.ledger, key: null, amount: 0, before: null, after: null };
    }
    const actor = storyCharacterActionIdentities()[candidate.actorId];
    const before = Number(actor && actor.career && actor.career[cost.key]);
    const after = before - Number(cost.amount);
    if (!actor || !actor.career || !Number.isFinite(before) || after < -1e-6) {
        return { ok: false, reason: 'COST_REVALIDATION_FAILED' };
    }
    const changed = typeof storyCausalitySet === 'function'
        ? storyCausalitySet(actor.career, cost.key, after, {
            target: { type: 'character', id: actor.id },
            path: `${actor.id}.career.${cost.key}`,
            source: 'character.action.cost'
        })
        : (() => { actor.career[cost.key] = after; return true; })();
    if (!changed) return { ok: false, reason: 'COST_WRITE_REJECTED' };
    actor.updatedAt = storyCharacterActionNow();
    actor.version = Math.max(1, Number(actor.version) || 1) + 1;
    return {
        ok: true, receiptId: `${receiptId}:cost`, ledger: cost.ledger,
        actorId: actor.id, key: cost.key, amount: Number(cost.amount), before, after
    };
}

function storyCharacterActionApplyRelationshipEffect(candidate, definition, receiptId) {
    const results = [];
    for (const effect of (definition.relationshipEffects || [])) {
        const fromActorId = effect.direction === 'TARGET_TO_ACTOR'
            ? candidate.targetActorId : candidate.actorId;
        const toActorId = effect.direction === 'TARGET_TO_ACTOR'
            ? candidate.actorId : candidate.targetActorId;
        const deltas = Object.fromEntries(
            (typeof STORY_RELATIONSHIP_AXES !== 'undefined' ? STORY_RELATIONSHIP_AXES : [])
                .map(axis => [axis, Number(effect[axis]) || 0])
        );
        const result = storyRelationshipAdjust(fromActorId, toActorId, deltas, {
            source: 'character.action', reason: definition.id,
            sourceReceiptId: receiptId, recordDebtMemory: false
        });
        results.push({ fromActorId, toActorId, deltas, applied: !!result.applied, reason: result.reason || null });
    }
    return results;
}

function storyCharacterActionRemember(candidate, definition, receiptId) {
    const domainTarget = definition.id === 'ORDER' && candidate.domainContext.targetRegionId
        ? ` / ${candidate.domainContext.targetRegionId}`
        : (definition.id === 'SABOTAGE' && candidate.domainContext.targetAssetId
            ? ` / ${candidate.domainContext.targetAssetId}` : '');
    const summary = definition.id === 'RESIGN'
        ? `${candidate.actionName}: ${candidate.actorId} / ${candidate.domainContext.targetInstitutionId}`
        : `${candidate.actionName}: ${candidate.actorId} → ${candidate.targetActorId}${domainTarget}`;
    const waitsForDomain = ['ORDER', 'SABOTAGE'].includes(definition.id);
    const participants = (definition.id === 'SABOTAGE' || definition.id === 'RESIGN')
        ? [candidate.actorId]
        : [candidate.actorId, candidate.targetActorId];
    const opened = typeof storyMemoryOpenEpisode === 'function' ? storyMemoryOpenEpisode({
        topicKey: `character-action:${definition.id.toLowerCase()}`,
        participantActorIds: participants,
        summary,
        unresolvedTopic: waitsForDomain
            ? (definition.id === 'SABOTAGE'
                ? `${candidate.actionName} operasyon sonucu bekleniyor.`
                : `${candidate.actionName} kurum ve saha sonucu bekleniyor.`)
            : `${candidate.actionName} sonucu bekleniyor.`,
        importanceBps: definition.id === 'ALLY' ? 8200 : 6800,
        source: { type: 'CHARACTER_ACTION_RECEIPT', receiptId, actionType: definition.id }
    }) : { applied: false, reason: 'MEMORY_EXECUTOR_NOT_AVAILABLE' };
    const resolved = !waitsForDomain && opened.applied && typeof storyMemoryResolveEpisode === 'function'
        ? storyMemoryResolveEpisode(opened.episode.id, `${candidate.actionName} uygulandı.`)
        : { applied: false, reason: waitsForDomain ? 'DOMAIN_DECISION_PENDING' : (opened.reason || 'EPISODE_NOT_OPENED') };
    let milestone = null;
    const brokenAllianceIds = [];
    if (definition.id === 'ALLY' && typeof storyMemoryAddMilestone === 'function') {
        milestone = storyMemoryAddMilestone({
            id: `character-memory:alliance:${storyCharacterActionSafeToken(receiptId)}`,
            kind: 'RELATIONSHIP', status: 'ACTIVE',
            subjectActorId: candidate.actorId,
            holderActorIds: [candidate.actorId, candidate.targetActorId],
            relatedActorIds: [candidate.targetActorId],
            summary: `${candidate.actorId} ile ${candidate.targetActorId} kişisel ittifak kurdu.`,
            importanceBps: 9000,
            source: { type: 'CHARACTER_ACTION_RECEIPT', receiptId, actionType: definition.id }
        });
    } else if (definition.id === 'BETRAY' && typeof storyMemoryAddMilestone === 'function') {
        const memoryLedger = typeof storyMemoryEnsure === 'function' ? storyMemoryEnsure() : null;
        for (const row of Object.values(memoryLedger && memoryLedger.milestones || {})) {
            if (row.kind !== 'RELATIONSHIP' || row.status !== 'ACTIVE') continue;
            const actors = [row.subjectActorId].concat(row.relatedActorIds || []);
            if (!actors.includes(candidate.actorId) || !actors.includes(candidate.targetActorId)) continue;
            const broken = storyMemoryResolveMilestone(row.id, 'BROKEN');
            if (broken.applied) brokenAllianceIds.push(row.id);
        }
        milestone = storyMemoryAddMilestone({
            id: `character-memory:betrayal:${storyCharacterActionSafeToken(receiptId)}`,
            kind: 'BETRAYAL', status: 'ACTIVE',
            subjectActorId: candidate.actorId,
            holderActorIds: [candidate.actorId, candidate.targetActorId],
            relatedActorIds: [candidate.targetActorId],
            summary: `${candidate.actorId}, ${candidate.targetActorId} ile arasındaki bağı bozdu.`,
            importanceBps: 9600,
            source: { type: 'CHARACTER_ACTION_RECEIPT', receiptId, actionType: definition.id }
        });
    }
    return {
        episodeId: opened.episode && opened.episode.id || null,
        episodeOpened: !!opened.applied,
        episodeResolved: !!resolved.applied,
        milestoneId: milestone && milestone.milestone && milestone.milestone.id || null,
        milestoneApplied: !!(milestone && milestone.applied),
        brokenAllianceIds
    };
}

function storyCharacterActionResolveSabotage(receipt) {
    const domain = receipt && receipt.domainReceipt;
    if (!domain || domain.outcomeModel !== 'QUEUED_COVERT_OPERATION') return false;
    if (storyCharacterActionNow() + 1e-9 < Number(domain.resolveAt)) return false;
    const resolutionKey = String(domain.resolutionKey || domain.operationId || receipt.id);
    const successDrawBps = storyCharacterActionDeterministicBps(`${resolutionKey}|success`);
    const detectionDrawBps = storyCharacterActionDeterministicBps(`${resolutionKey}|detection`);
    const attributionDrawBps = storyCharacterActionDeterministicBps(`${resolutionKey}|attribution`);
    const intendedSuccess = successDrawBps < Number(domain.successChanceBps);
    const detected = detectionDrawBps < Number(domain.detectionChanceBps);
    const attributed = detected && attributionDrawBps < Number(domain.attributionChanceBps);
    const corridor = typeof storyInfrastructureGetCorridor === 'function'
        ? storyInfrastructureGetCorridor(domain.targetAssetId) : null;
    const previousDamageBps = corridor ? Number(corridor.damageBps) || 0 : null;
    const nextDamageBps = corridor && intendedSuccess
        ? Math.min(STORY_CHARACTER_ACTION_SABOTAGE_MAX_DAMAGE_BPS,
            previousDamageBps + Number(domain.damageDeltaBps || 0))
        : previousDamageBps;
    const causalRun = typeof storyCausalityRun === 'function'
        ? storyCausalityRun({
            type: 'character.sabotage_resolution',
            eventType: 'infrastructure.covert_damage_resolved',
            actor: { type: 'character', id: receipt.actorId },
            target: { type: 'infrastructure_corridor', id: domain.targetAssetId },
            idempotencyKey: `sabotage-resolution:${domain.operationId}`,
            correlationId: domain.operationId,
            metadata: { detected, attributed }
        }, () => {
            if (!corridor) return { ok: false, reason: 'TARGET_ASSET_LOST' };
            if (!intendedSuccess) return { ok: true, attempted: true, physicalMutation: false };
            return storyInfrastructureSetDamage(domain.targetAssetId, nextDamageBps, {
                source: 'CHARACTER_SABOTAGE', operationId: domain.operationId
            });
        })
        : { commandId: null, eventId: null, result: !corridor
            ? { ok: false, reason: 'TARGET_ASSET_LOST' }
            : (intendedSuccess
                ? storyInfrastructureSetDamage(domain.targetAssetId, nextDamageBps)
                : { ok: true, attempted: true, physicalMutation: false }) };
    const mutation = causalRun.result || { ok: false, reason: 'EMPTY_SABOTAGE_RESULT' };
    const succeeded = intendedSuccess && mutation.ok;
    const physicalMutation = succeeded
        && Number(mutation.damageBps) !== Number(mutation.previousDamageBps);
    const finalResult = {
        status: !corridor ? 'TARGET_LOST' : (succeeded ? 'SUCCEEDED' : 'FAILED'),
        resolvedAt: storyCharacterActionNow(),
        detected, attributed,
        physicalMutation,
        previousDamageBps,
        damageBps: succeeded ? Number(mutation.damageBps) : previousDamageBps,
        damageDeltaBps: succeeded ? Math.max(0,
            Number(mutation.damageBps) - Number(mutation.previousDamageBps)) : 0,
        successDrawBps, detectionDrawBps, attributionDrawBps,
        reason: mutation.ok ? null : mutation.reason || null,
        causality: { commandId: causalRun.commandId || null, eventId: causalRun.eventId || null }
    };
    domain.outcomeModel = 'COVERT_OPERATION_RESOLVED';
    domain.finalResult = finalResult;
    domain.physicalMutation = physicalMutation;
    domain.resolvedAt = finalResult.resolvedAt;
    delete domain.resolutionKey;
    if (receipt.memory && receipt.memory.episodeId
        && !receipt.memory.episodeResolved && typeof storyMemoryResolveEpisode === 'function') {
        const resolution = storyMemoryResolveEpisode(
            receipt.memory.episodeId,
            `Sabotaj sonucu: ${finalResult.status}; tespit ${detected ? 'edildi' : 'edilmedi'}.`
        );
        receipt.memory.episodeResolved = !!resolution.applied;
    }
    if (detected && receipt.targetActorId && typeof storyMemoryAddRecent === 'function') {
        storyMemoryAddRecent(receipt.targetActorId, {
            id: `character-memory:sabotage-detected:${storyCharacterActionSafeToken(receipt.id)}`,
            kind: 'OTHER',
            summary: attributed
                ? `${domain.targetAssetId} sabotajı ${receipt.actorId} ile ilişkilendirildi.`
                : `${domain.targetAssetId} üzerinde faili belirlenemeyen sabotaj girişimi tespit edildi.`,
            occurredAt: finalResult.resolvedAt,
            importanceBps: physicalMutation ? 8600 : 6800,
            relatedActorIds: attributed ? [receipt.actorId] : [],
            source: {
                type: 'CHARACTER_ACTION_RECEIPT', receiptId: receipt.id,
                operationId: domain.operationId, detected: true, attributed
            }
        });
    }
    if (typeof storyTelemetryEvent === 'function') {
        storyTelemetryEvent('character.sabotage_resolved', {
            receiptId: receipt.id, operationId: domain.operationId,
            targetAssetId: domain.targetAssetId, targetCountryId: receipt.targetCountryId,
            status: finalResult.status, detected, attributed,
            physicalMutation, damageDeltaBps: finalResult.damageDeltaBps
        });
    }
    return true;
}

function storyCharacterActionSyncDomainReceipts() {
    const ledger = storyCharacterActionEnsure();
    if (!ledger) return { changed: 0 };
    let changed = 0;
    for (const receipt of Object.values(ledger.receipts || {})) {
        if (!receipt || receipt.status !== 'APPLIED') continue;
        if (receipt.actionType === 'SABOTAGE') {
            if (storyCharacterActionResolveSabotage(receipt)) changed++;
            continue;
        }
        if (receipt.actionType !== 'ORDER' || !STORY.institutions) continue;
        const domain = receipt.domainReceipt;
        if (!domain || domain.outcomeModel !== 'QUEUED_DOMAIN_DECISION' || !domain.requestId) continue;
        const request = STORY.institutions.requests && STORY.institutions.requests[domain.requestId];
        const result = request && request.domainDecision && request.domainDecision.result;
        if (!result) continue;
        domain.outcomeModel = 'DOMAIN_DECISION_RESOLVED';
        domain.finalResult = storyCharacterActionClone(result);
        domain.physicalMutation = !!result.physicalMutation;
        domain.resolvedAt = storyCharacterActionNow();
        if (receipt.memory && receipt.memory.episodeId
            && !receipt.memory.episodeResolved && typeof storyMemoryResolveEpisode === 'function') {
            const resolution = storyMemoryResolveEpisode(
                receipt.memory.episodeId,
                `Emir sonucu: ${String(result.status || 'UNKNOWN')}`
            );
            receipt.memory.episodeResolved = !!resolution.applied;
        }
        changed++;
        if (typeof storyTelemetryEvent === 'function') {
            storyTelemetryEvent('character.action_domain_resolved', {
                receiptId: receipt.id, actionType: receipt.actionType,
                requestId: domain.requestId, resultStatus: result.status,
                physicalMutation: !!result.physicalMutation
            });
        }
    }
    return { changed };
}

function storyCharacterActionCommit(candidate, definition, receiptId) {
    const costReceipt = storyCharacterActionSpendCost(candidate, receiptId);
    if (!costReceipt.ok) return { applied: false, reason: costReceipt.reason, costReceipt };
    if (definition.handler === 'GOVERNANCE_ORDER') {
        const submitted = storyGovernanceSubmit(
            candidate.domainContext.commandType,
            candidate.domainContext.targetRegionId
        );
        if (!submitted || !submitted.ok) return {
            applied: false,
            reason: submitted && (submitted.reason || submitted.status) || 'ORDER_SUBMISSION_FAILED',
            costReceipt,
            domainReceipt: storyCharacterActionClone(submitted || null)
        };
        const request = submitted.request || {};
        const memory = storyCharacterActionRemember(candidate, definition, receiptId);
        return {
            applied: true,
            costReceipt,
            relationshipEffects: [],
            memory,
            domainReceipt: {
                ok: true,
                outcomeModel: 'QUEUED_DOMAIN_DECISION',
                requestId: request.id || null,
                requestStatus: request.status || null,
                actionId: candidate.domainContext.commandType,
                targetRegionId: candidate.domainContext.targetRegionId,
                funds: storyCharacterActionClone(request.domainDecision && request.domainDecision.funds || null),
                physicalMutation: false
            }
        };
    }
    if (definition.handler === 'COVERT_OPERATION') {
        const plan = storyCharacterActionSabotagePlan(candidate, receiptId);
        const memory = storyCharacterActionRemember(candidate, definition, receiptId);
        return {
            applied: true,
            costReceipt,
            relationshipEffects: [],
            memory,
            domainReceipt: {
                ok: true,
                outcomeModel: 'QUEUED_COVERT_OPERATION',
                operationId: plan.operationId,
                serviceId: candidate.authority.grants[0] && candidate.authority.grants[0].serviceId || null,
                targetAssetType: candidate.domainContext.assetType,
                targetAssetId: candidate.domainContext.targetAssetId,
                targetCountryId: candidate.targetCountryId,
                launchedAt: storyCharacterActionNow(),
                resolveAt: storyCharacterActionNow() + STORY_CHARACTER_ACTION_SABOTAGE_DELAY_SECONDS,
                successChanceBps: plan.successChanceBps,
                detectionChanceBps: plan.detectionChanceBps,
                attributionChanceBps: plan.attributionChanceBps,
                damageDeltaBps: plan.damageDeltaBps,
                securityBps: plan.securityBps,
                resolutionCommitment: plan.resolutionCommitment,
                resolutionKey: plan.resolutionKey,
                physicalMutation: false,
                finalResult: null
            }
        };
    }
    if (definition.handler === 'OFFICE_SUCCESSION') {
        const view = candidate.domainValidation && candidate.domainValidation.view;
        const ledger = storyCharacterActionEnsure();
        if (!view || !view.institutionId || !view.successorHolder || !ledger) return {
            applied: false, reason: 'RESIGN_SUCCESSION_REVALIDATION_FAILED', costReceipt
        };
        const transition = {
            id: `office-transition:${storyCharacterActionSafeToken(receiptId)}`,
            status: 'ACTIVE',
            countryId: view.countryId,
            institutionId: view.institutionId,
            institutionType: view.institutionType,
            predecessorActorId: candidate.actorId,
            predecessorName: view.predecessorName,
            successorHolder: storyCharacterActionClone(view.successorHolder),
            reason: 'VOLUNTARY_RESIGNATION',
            sourceReceiptId: receiptId,
            createdAt: storyCharacterActionNow(),
            version: 1
        };
        ledger.officeTransitions[view.institutionId] = transition;
        if (typeof storyInstitutionEnsure === 'function') storyInstitutionEnsure();
        const stillHeld = storyCharacterActionHeldInstitutions(candidate.actorId)
            .some(row => row.institutionId === view.institutionId);
        const institutionLedger = typeof storyInstitutionEnsure === 'function'
            ? storyInstitutionEnsure() : null;
        const country = institutionLedger && institutionLedger.countries[view.countryId];
        const institution = country && country.institutions[view.institutionId];
        const successorApplied = institution && institution.officeHolder
            && institution.officeHolder.actorId === view.successorHolder.actorId;
        if (stillHeld || !successorApplied) {
            delete ledger.officeTransitions[view.institutionId];
            if (typeof storyInstitutionEnsure === 'function') storyInstitutionEnsure();
            return { applied: false, reason: 'RESIGN_SUCCESSION_WRITE_FAILED', costReceipt };
        }
        const memory = storyCharacterActionRemember(candidate, definition, receiptId);
        return {
            applied: true,
            costReceipt,
            relationshipEffects: [],
            memory,
            domainReceipt: {
                ok: true,
                outcomeModel: 'OFFICE_SUCCESSION_RESOLVED',
                transitionId: transition.id,
                institutionId: transition.institutionId,
                institutionType: transition.institutionType,
                predecessorActorId: transition.predecessorActorId,
                successorHolder: storyCharacterActionClone(transition.successorHolder),
                physicalMutation: true,
                resolvedAt: storyCharacterActionNow()
            }
        };
    }
    const relationshipEffects = storyCharacterActionApplyRelationshipEffect(candidate, definition, receiptId);
    if (relationshipEffects.some(row => !row.applied)) {
        return { applied: false, reason: 'RELATIONSHIP_EFFECT_FAILED', costReceipt, relationshipEffects };
    }
    const memory = storyCharacterActionRemember(candidate, definition, receiptId);
    return { applied: true, costReceipt, relationshipEffects, memory };
}

function storyCharacterActionPruneReceipts(ledger) {
    const rows = Object.values(ledger.receipts || {}).sort((a, b) =>
        Number(a.sequence) - Number(b.sequence) || a.id.localeCompare(b.id, 'en'));
    const protectedReceiptIds = new Set(Object.values(ledger.officeTransitions || {})
        .filter(row => row && row.status === 'ACTIVE' && row.sourceReceiptId)
        .map(row => row.sourceReceiptId));
    let excess = Math.max(0, rows.length - STORY_CHARACTER_ACTION_RECEIPT_CAP);
    for (const row of rows) {
        if (excess <= 0) break;
        if (protectedReceiptIds.has(row.id)) continue;
        if (storyCharacterActionAIReceipt(row)) {
            if (row.status === 'APPLIED') {
                ledger.ai.prunedAppliedCount = Math.max(0, Number(ledger.ai.prunedAppliedCount) || 0) + 1;
            } else if (row.status === 'FAILED') {
                ledger.ai.prunedDeniedCount = Math.max(0, Number(ledger.ai.prunedDeniedCount) || 0) + 1;
            }
        }
        delete ledger.receipts[row.id];
        excess--;
    }
}

function storyCharacterActionExecute(input) {
    const candidate = storyCharacterActionCandidate(input);
    if (!candidate.allowed) return { ok: false, status: 'DENIED', candidate };
    const ledger = storyCharacterActionEnsure();
    const definition = STORY_CHARACTER_ACTION_DEFS[candidate.actionType];
    const sequence = Math.max(0, Math.floor(Number(ledger.nextReceiptSequence) || 0)) + 1;
    ledger.nextReceiptSequence = sequence;
    const receiptId = `character-action-receipt:${sequence}`;
    const run = typeof storyCausalityRun === 'function'
        ? storyCausalityRun({
            type: 'character.action', actor: { type: 'character', id: candidate.actorId },
            target: { type: 'character', id: candidate.targetActorId },
            idempotencyKey: receiptId,
            metadata: { actionType: candidate.actionType }
        }, () => storyCharacterActionCommit(candidate, definition, receiptId))
        : { commandId: null, eventId: null, result: storyCharacterActionCommit(candidate, definition, receiptId) };
    const result = run.result || { applied: false, reason: 'EMPTY_ACTION_RESULT' };
    const completedAt = storyCharacterActionNow();
    const receipt = {
        id: receiptId, sequence, actionType: candidate.actionType,
        actorId: candidate.actorId, actorCountryId: candidate.actorCountryId,
        targetActorId: candidate.targetActorId, targetCountryId: candidate.targetCountryId,
        targetModel: candidate.targetModel,
        domainContext: storyCharacterActionClone(candidate.domainContext),
        domainReceipt: storyCharacterActionClone(result.domainReceipt || null),
        status: result.applied ? 'APPLIED' : 'FAILED',
        decisionSource: candidate.decisionSource,
        selectorScore: candidate.selectorScore,
        selectorReasons: storyCharacterActionClone(candidate.selectorReasons),
        decisionMetadata: storyCharacterActionClone(candidate.decisionMetadata),
        createdAt: candidate.generatedAt, completedAt,
        authority: storyCharacterActionClone(candidate.authority),
        cost: storyCharacterActionClone(candidate.cost),
        costReceipt: storyCharacterActionClone(result.costReceipt || null),
        relationshipEffects: storyCharacterActionClone(result.relationshipEffects || []),
        memory: storyCharacterActionClone(result.memory || null),
        causality: { commandId: run.commandId || null, eventId: run.eventId || null },
        reason: result.reason || null,
        version: 1
    };
    ledger.receipts[receipt.id] = receipt;
    if (result.applied && definition.cooldownSeconds > 0) {
        ledger.cooldowns[storyCharacterActionCooldownKey(candidate.actorId, candidate.actionType)]
            = completedAt + definition.cooldownSeconds;
    }
    if (result.applied && candidate.targetActorId && definition.pairCooldownSeconds > 0) {
        ledger.cooldowns[storyCharacterActionPairCooldownKey(
            candidate.actorId, candidate.actionType, candidate.targetActorId
        )] = completedAt + definition.pairCooldownSeconds;
    }
    storyCharacterActionPruneReceipts(ledger);
    if (typeof storyTelemetryEvent === 'function') {
        storyTelemetryEvent('character.action_resolved', {
            receiptId, actionType: candidate.actionType, actorId: candidate.actorId,
            targetActorId: candidate.targetActorId,
            targetRegionId: candidate.domainContext && candidate.domainContext.targetRegionId || null,
            status: receipt.status
        });
    }
    return { ok: result.applied, status: receipt.status, receipt: storyCharacterActionClone(receipt) };
}

function storyCharacterActionAIPlayerActorId() {
    return STORY.commander
        ? `character:${STORY.playerStateId | 0}:${STORY.commander.id}`
        : null;
}

function storyCharacterActionAIActorActive(actor) {
    if (!actor || !actor.countryId) return false;
    const stateId = Number(String(actor.countryId).split(':').pop());
    return Number.isInteger(stateId) && (STORY.nodes || []).some(node => Number(node.owner) === stateId);
}

function storyCharacterActionAIContacts(actorId) {
    const ledger = typeof storyRelationshipEnsure === 'function' ? storyRelationshipEnsure() : null;
    const identities = storyCharacterActionIdentities();
    const targetIds = new Set();
    for (const edge of Object.values(ledger && ledger.edges || {})) {
        if (edge.fromActorId === actorId && identities[edge.toActorId]) targetIds.add(edge.toActorId);
        if (edge.toActorId === actorId && identities[edge.fromActorId]) targetIds.add(edge.fromActorId);
    }
    return Array.from(targetIds).sort((a, b) => a.localeCompare(b, 'en'))
        .slice(0, STORY_CHARACTER_ACTION_AI_CONTACT_CAP);
}

function storyCharacterActionAIRelationship(actorId, targetActorId) {
    const direct = typeof storyRelationshipView === 'function'
        ? storyRelationshipView(actorId, targetActorId) : null;
    const reverse = typeof storyRelationshipView === 'function'
        ? storyRelationshipView(targetActorId, actorId) : null;
    return direct || reverse || {
        trustBps: 0, fearBps: 0, respectBps: 0, debtBps: 0, hostilityBps: 0
    };
}

function storyCharacterActionAIRecentStats(actorId, actionType) {
    const ledger = storyCharacterActionEnsure();
    const now = storyCharacterActionNow();
    const windowStart = now - STORY_CHARACTER_ACTION_AI_RECENT_WINDOW_SECONDS;
    let globalTypeCount = 0;
    let actorTypeCount = 0;
    for (const receipt of Object.values(ledger && ledger.receipts || {})) {
        if (receipt.status !== 'APPLIED' || !storyCharacterActionAIReceipt(receipt)) continue;
        if (Number(receipt.completedAt) < windowStart || receipt.actionType !== actionType) continue;
        globalTypeCount++;
        if (receipt.actorId === actorId) actorTypeCount++;
    }
    return { globalTypeCount, actorTypeCount, windowSeconds: STORY_CHARACTER_ACTION_AI_RECENT_WINDOW_SECONDS };
}

function storyCharacterActionAIOption(candidate, relationship) {
    const trust = Number(relationship.trustBps) || 0;
    const respect = Number(relationship.respectBps) || 0;
    const debt = Number(relationship.debtBps) || 0;
    const hostility = Number(relationship.hostilityBps) || 0;
    const recent = storyCharacterActionAIRecentStats(candidate.actorId, candidate.actionType);
    // Aynı türü bütün dünya adına art arda seçmek onun marjinal değerini
    // düşürür. Bu rastgele çeşitlilik kotası değildir: 120 sn sonra tamamen
    // silinen, kayıt/yüklemede makbuzlardan aynen türeyen bir fırsat maliyetidir.
    const repetitionPenalty = Math.min(18,
        recent.globalTypeCount * 2.75 + recent.actorTypeCount * 4.5);
    const options = {
        PERSUADE: {
            relevant: trust < 6100 || hostility >= 1500,
            baseScore: 46 + hostility / 500 + Math.max(0, 6100 - trust) / 700,
            affinities: { popularTechnocraticStyle: 8, institutionalPosture: 5 },
            goalTags: ['BUILD_SOCIAL_INFLUENCE', 'POLITICAL_ACCESS'],
            contextReason: `persuasion-gap:t${Math.round(trust)}:h${Math.round(hostility)}`
        },
        NEGOTIATE: {
            relevant: debt >= 260 || hostility >= 2050 || trust < 4300,
            baseScore: 40 + debt / 240 + hostility / 480 + Math.max(0, 4300 - trust) / 850,
            affinities: { popularTechnocraticStyle: -8, institutionalPosture: 9 },
            goalTags: ['SECURE_PUBLIC_CONTRACTS', 'RESTORE_MARKET_CONFIDENCE', 'PROTECT_STATE_SECRETS'],
            contextReason: `negotiation-friction:d${Math.round(debt)}:h${Math.round(hostility)}`
        },
        ALLY: {
            relevant: trust >= 5700 && respect >= 4700 && hostility <= 1800,
            baseScore: 38 + trust / 900 + respect / 1200 - hostility / 650,
            affinities: { nationalGlobalOrientation: -6, institutionalPosture: 8 },
            goalTags: ['POLITICAL_ACCESS', 'EXPAND_INFORMAL_NETWORK', 'GAIN_OPERATIONAL_AUTHORITY'],
            contextReason: `alliance-fit:t${Math.round(trust)}:r${Math.round(respect)}:h${Math.round(hostility)}`
        },
        BETRAY: {
            relevant: hostility >= 3000 || (debt >= 1800 && trust < 4200),
            baseScore: 18 + hostility / 260 + debt / 650 + Math.max(0, 4200 - trust) / 450,
            affinities: { institutionalPosture: -30, popularTechnocraticStyle: -5 },
            goalTags: ['CONTROL_THE_NETWORK', 'MARKET_DOMINANCE', 'INSTITUTIONAL_CONTROL'],
            contextReason: `betrayal-pressure:t${Math.round(trust)}:d${Math.round(debt)}:h${Math.round(hostility)}`
        }
    };
    const option = options[candidate.actionType];
    if (!option || !option.relevant) return null;
    return Object.assign({
        id: candidate.id,
        baseScore: option.baseScore - repetitionPenalty,
        policyReasons: [
            option.contextReason,
            `recent-${candidate.actionType.toLowerCase()}:${recent.globalTypeCount}`,
            `actor-repeat:${recent.actorTypeCount}`,
            `repetition-penalty:-${repetitionPenalty.toFixed(2)}`
        ]
    }, option, { baseScore: option.baseScore - repetitionPenalty });
}

function storyCharacterActionAIRankActor(actorId) {
    const identities = storyCharacterActionIdentities();
    const actor = identities[actorId];
    if (!actor) return [];
    const ranked = [];
    for (const targetActorId of storyCharacterActionAIContacts(actorId)) {
        const relationship = storyCharacterActionAIRelationship(actorId, targetActorId);
        for (const actionType of ['PERSUADE', 'NEGOTIATE', 'ALLY', 'BETRAY']) {
            const candidate = storyCharacterActionCandidate({
                actorId, targetActorId, actionType, decisionSource: 'DETERMINISTIC_AI'
            });
            if (!candidate.allowed) continue;
            const option = storyCharacterActionAIOption(candidate, relationship);
            if (!option) continue;
            const scored = typeof storyCharacterOptionScore === 'function'
                ? storyCharacterOptionScore(actorId, option)
                : { score: option.baseScore, reasons: ['IDENTITY_SCORER_UNAVAILABLE'] };
            ranked.push({
                candidate,
                score: Math.round((Number(scored.score) || 0) * 1000) / 1000,
                reasons: (option.policyReasons || []).concat(scored.reasons || [])
            });
        }
    }
    return ranked.sort((a, b) => b.score - a.score
        || a.candidate.actionType.localeCompare(b.candidate.actionType, 'en')
        || a.candidate.targetActorId.localeCompare(b.candidate.targetActorId, 'en'));
}

function storyCharacterActionAISelection() {
    const ledger = storyCharacterActionEnsure();
    if (!ledger) return { selected: false, reason: 'ACTION_LAYER_DISABLED', ranked: [] };
    const playerActorId = storyCharacterActionAIPlayerActorId();
    const actors = Object.values(storyCharacterActionIdentities())
        .filter(actor => actor.id !== playerActorId && storyCharacterActionAIActorActive(actor))
        .sort((a, b) => a.id.localeCompare(b.id, 'en'));
    if (!actors.length) return { selected: false, reason: 'NO_AI_ACTORS', ranked: [] };
    const start = Math.max(0, Math.floor(Number(ledger.ai.cursor) || 0)) % actors.length;
    const windowSize = Math.min(STORY_CHARACTER_ACTION_AI_ACTOR_WINDOW, actors.length);
    const actorWindow = [];
    for (let offset = 0; offset < windowSize; offset++) actorWindow.push(actors[(start + offset) % actors.length]);
    ledger.ai.cursor = (start + windowSize) % actors.length;
    const ranked = actorWindow.flatMap(actor => storyCharacterActionAIRankActor(actor.id))
        .sort((a, b) => b.score - a.score
            || a.candidate.actorId.localeCompare(b.candidate.actorId, 'en')
            || a.candidate.actionType.localeCompare(b.candidate.actionType, 'en')
            || a.candidate.targetActorId.localeCompare(b.candidate.targetActorId, 'en'));
    const best = ranked[0] || null;
    if (!best) return { selected: false, reason: 'NO_ALLOWED_CANDIDATE', actorWindow: actorWindow.map(row => row.id), ranked: [] };
    if (best.score < STORY_CHARACTER_ACTION_AI_MIN_SCORE) {
        return {
            selected: false, reason: 'SCORE_BELOW_THRESHOLD',
            actorWindow: actorWindow.map(row => row.id),
            ranked: ranked.slice(0, 8).map(row => ({
                actorId: row.candidate.actorId, targetActorId: row.candidate.targetActorId,
                actionType: row.candidate.actionType, score: row.score, reasons: row.reasons
            }))
        };
    }
    return {
        selected: true,
        actorWindow: actorWindow.map(row => row.id),
        candidate: storyCharacterActionClone(best.candidate),
        score: best.score,
        reasons: best.reasons,
        ranked: ranked.slice(0, 8).map(row => ({
            actorId: row.candidate.actorId, targetActorId: row.candidate.targetActorId,
            actionType: row.candidate.actionType, score: row.score, reasons: row.reasons
        }))
    };
}

function storyCharacterActionArbiterDecisionPrune(ledger) {
    const rows = Object.values(ledger.arbiterDecisions || {}).sort((a, b) =>
        Number(a.sequence) - Number(b.sequence) || a.id.localeCompare(b.id, 'en'));
    const excess = Math.max(0, rows.length - STORY_CHARACTER_ARBITER_DECISION_CAP);
    for (let index = 0; index < excess; index++) {
        delete ledger.arbiterDecisions[rows[index].id];
        ledger.ai.arbiterDecisionPrunedCount++;
    }
}

function storyCharacterActionArbiterDecisionRecord(pending, input) {
    const ledger = storyCharacterActionEnsure();
    input = input || {};
    const sequence = Math.max(0, Math.floor(Number(ledger.nextArbiterDecisionSequence) || 0)) + 1;
    ledger.nextArbiterDecisionSequence = sequence;
    const id = `character-arbiter-decision:${sequence}`;
    const row = {
        id,
        sequence,
        schemaVersion: 2,
        requestId: pending.requestId,
        contextHash: pending.contextHash,
        actorId: pending.actorId,
        source: String(input.source || 'DETERMINISTIC_FALLBACK'),
        status: String(input.status || 'FALLBACK'),
        verdict: String(input.verdict || 'PASS'),
        candidateId: input.candidateId == null ? null : String(input.candidateId),
        actionType: input.actionType == null ? null : String(input.actionType),
        targetActorId: input.targetActorId == null ? null : String(input.targetActorId),
        reasonCode: input.reasonCode == null ? null : String(input.reasonCode),
        fallbackReason: input.fallbackReason == null ? null : String(input.fallbackReason),
        speechPlan: input.speechPlan && typeof input.speechPlan === 'object'
            ? storyCharacterActionClone(input.speechPlan) : null,
        createdAt: Number(pending.createdAt) || 0,
        consumedAt: storyCharacterActionNow(),
        createdAtTick: Number(pending.createdAtTick) || 0,
        consumedAtTick: Number(ledger.ai.tickSequence) || 0,
        version: 2
    };
    row.realization = typeof storyCharacterSpeechRealizeDecision === 'function'
        ? storyCharacterSpeechRealizeDecision(row, {
            history: Object.values(ledger.arbiterDecisions || {})
        }) : null;
    ledger.arbiterDecisions[id] = row;
    storyCharacterActionArbiterDecisionPrune(ledger);
    return storyCharacterActionClone(row);
}

function storyCharacterActionArbiterRecentDecisions(actorId, limit) {
    const ledger = storyCharacterActionEnsure();
    return Object.values(ledger && ledger.arbiterDecisions || {})
        .filter(row => row.actorId === String(actorId || ''))
        .sort((a, b) => Number(b.sequence) - Number(a.sequence)
            || b.id.localeCompare(a.id, 'en'))
        .slice(0, Math.max(1, Math.min(12, Number(limit) || 6)))
        .map(row => ({
            verdict: row.verdict,
            actionType: row.actionType,
            targetActorId: row.targetActorId,
            reasonCode: row.reasonCode,
            fallbackReason: row.fallbackReason,
            source: row.source,
            consumedAt: row.consumedAt
        }));
}

function storyCharacterActionAIApply(proposal, decisionSource, decisionMetadata, actorWindow, dtSec) {
    const ledger = storyCharacterActionEnsure();
    const preview = storyCharacterActionCandidate({
        actionType: proposal.actionType,
        actorId: proposal.actorId,
        targetActorId: proposal.targetActorId,
        decisionSource,
        selectorScore: proposal.score,
        selectorReasons: proposal.reasons,
        decisionMetadata
    });
    if (!preview.allowed) {
        return {
            applied: false,
            stale: true,
            result: { ok: false, status: 'DENIED', candidate: preview },
            selection: {
                at: ledger.ai.lastTickAt, status: 'STALE',
                reason: preview.reasons.join('|'), actorId: proposal.actorId,
                targetActorId: proposal.targetActorId, actionType: proposal.actionType,
                score: proposal.score, reasons: proposal.reasons,
                actorWindow: actorWindow || [], elapsedSeconds: Number(dtSec) || 0
            }
        };
    }
    ledger.ai.selectedCount++;
    const result = storyCharacterActionExecute({
        actionType: proposal.actionType,
        actorId: proposal.actorId,
        targetActorId: proposal.targetActorId,
        decisionSource,
        selectorScore: proposal.score,
        selectorReasons: proposal.reasons,
        decisionMetadata
    });
    if (result.ok) ledger.ai.appliedCount++;
    else if (result.receipt) ledger.ai.deniedCount++;
    else ledger.ai.selectedCount--;
    return {
        applied: !!result.ok,
        stale: !result.receipt,
        result,
        selection: {
            at: ledger.ai.lastTickAt,
            status: result.ok ? 'APPLIED' : (result.receipt ? 'DENIED' : 'STALE'),
            reason: result.ok ? null : (result.candidate && result.candidate.reasons || ['EXECUTION_FAILED']).join('|'),
            actorId: proposal.actorId,
            targetActorId: proposal.targetActorId,
            actionType: proposal.actionType,
            score: proposal.score,
            reasons: proposal.reasons,
            receiptId: result.receipt && result.receipt.id || null,
            decisionSource,
            decisionMetadata: storyCharacterActionClone(decisionMetadata),
            actorWindow: actorWindow || [],
            elapsedSeconds: Number(dtSec) || 0
        }
    };
}

function storyCharacterActionArbiterQueue(selection) {
    const ledger = storyCharacterActionEnsure();
    if (!selection || !selection.selected || typeof storyCharacterArbiterBuildRequest !== 'function'
        || typeof storyCharacterArbiterLiveAvailable !== 'function'
        || !storyCharacterArbiterLiveAvailable()
        || typeof storyCharacterArbiterLiveDispatch !== 'function') return null;
    const actorId = selection.candidate.actorId;
    const ranked = storyCharacterActionAIRankActor(actorId);
    const request = storyCharacterArbiterBuildRequest(actorId, { ranked });
    if (!request || !request.ok || !request.context.candidates.length) return null;
    const dispatch = storyCharacterArbiterLiveDispatch(request);
    if (!dispatch || !dispatch.ok) return null;
    const fallback = ranked.find(row => row.candidate.id === selection.candidate.id) || ranked[0];
    ledger.ai.pendingArbiter = {
        schemaVersion: 1,
        requestId: request.requestId,
        contextHash: request.contextHash,
        actorId,
        createdAt: storyCharacterActionNow(),
        createdAtTick: ledger.ai.tickSequence,
        consumeAtTick: ledger.ai.tickSequence + 1,
        actorWindow: (selection.actorWindow || []).slice(),
        fallback: fallback ? {
            candidateId: fallback.candidate.id,
            actionType: fallback.candidate.actionType,
            actorId: fallback.candidate.actorId,
            targetActorId: fallback.candidate.targetActorId,
            score: fallback.score,
            reasons: (fallback.reasons || []).slice()
        } : null
    };
    ledger.ai.arbiterRequestedCount++;
    return storyCharacterActionClone(ledger.ai.pendingArbiter);
}

function storyCharacterActionArbiterConsume(dtSec) {
    const ledger = storyCharacterActionEnsure();
    const pending = ledger && ledger.ai.pendingArbiter;
    if (!pending || ledger.ai.tickSequence < Number(pending.consumeAtTick)) return null;
    ledger.ai.pendingArbiter = null;
    const ranked = storyCharacterActionAIRankActor(pending.actorId);
    const request = typeof storyCharacterArbiterBuildRequest === 'function'
        ? storyCharacterArbiterBuildRequest(pending.actorId, { ranked }) : null;
    const sameContext = !!(request && request.ok
        && request.requestId === pending.requestId && request.contextHash === pending.contextHash);
    const mailbox = sameContext && typeof storyCharacterArbiterLiveTake === 'function'
        ? storyCharacterArbiterLiveTake(pending.requestId, pending.contextHash)
        : { status: 'STALE_CONTEXT', result: null };
    if (!sameContext && typeof storyCharacterArbiterLiveDiscard === 'function') {
        storyCharacterArbiterLiveDiscard(pending.requestId);
    }
    if (sameContext && mailbox.status !== 'SETTLED'
        && typeof storyCharacterArbiterLiveDiscard === 'function') {
        storyCharacterArbiterLiveDiscard(pending.requestId);
    }
    const result = mailbox.status === 'SETTLED' ? mailbox.result : null;
    const output = result && result.output;
    const modelValidated = !!(sameContext && result && result.source === 'LOCAL_LLM_VALIDATED'
        && result.validation && result.validation.ok && output
        && output.requestId === pending.requestId);
    if (modelValidated && output.verdict === 'PASS') {
        ledger.ai.arbiterAcceptedCount++;
        ledger.ai.arbiterPassCount++;
        const decision = storyCharacterActionArbiterDecisionRecord(pending, {
            source: 'LOCAL_LLM_VALIDATED', status: 'ACCEPTED', verdict: 'PASS',
            reasonCode: output.reasonCode, speechPlan: output.speechPlan
        });
        return {
            applied: false,
            result: null,
            selection: {
                at: ledger.ai.lastTickAt, status: 'ARBITER_PASS', reason: output.reasonCode,
                actorId: pending.actorId, requestId: pending.requestId,
                arbiterDecisionId: decision.id,
                decisionSource: 'LOCAL_LLM_VALIDATED', actorWindow: pending.actorWindow || [],
                elapsedSeconds: Number(dtSec) || 0
            }
        };
    }
    if (modelValidated && output.verdict === 'PROPOSE') {
        const selected = ranked.find(row => row.candidate.id === output.candidateId);
        if (selected) {
            ledger.ai.arbiterAcceptedCount++;
            const decision = storyCharacterActionArbiterDecisionRecord(pending, {
                source: 'LOCAL_LLM_VALIDATED', status: 'ACCEPTED', verdict: 'PROPOSE',
                candidateId: selected.candidate.id,
                actionType: selected.candidate.actionType,
                targetActorId: selected.candidate.targetActorId,
                reasonCode: output.reasonCode, speechPlan: output.speechPlan
            });
            const applied = storyCharacterActionAIApply({
                actionType: selected.candidate.actionType,
                actorId: selected.candidate.actorId,
                targetActorId: selected.candidate.targetActorId,
                score: selected.score,
                reasons: (selected.reasons || []).concat(`arbiter:${output.reasonCode}`)
            }, 'LOCAL_LLM_VALIDATED', {
                schemaVersion: 1,
                requestId: pending.requestId,
                contextHash: pending.contextHash,
                choiceId: output.choiceId,
                arbiterDecisionId: decision.id,
                reasonCode: output.reasonCode,
                speechPlan: storyCharacterActionClone(output.speechPlan)
            }, pending.actorWindow, dtSec);
            if (applied.stale) ledger.ai.arbiterStaleCount++;
            return applied;
        }
    }
    if (!sameContext) ledger.ai.arbiterStaleCount++;
    else ledger.ai.arbiterFallbackCount++;
    const fallback = pending.fallback;
    const fallbackReason = sameContext ? mailbox.status : 'STALE_CONTEXT';
    const fallbackDecision = storyCharacterActionArbiterDecisionRecord(pending, {
        source: 'DETERMINISTIC_FALLBACK',
        status: sameContext ? 'FALLBACK' : 'STALE',
        verdict: fallback ? 'PROPOSE' : 'PASS',
        candidateId: fallback && fallback.candidateId,
        actionType: fallback && fallback.actionType,
        targetActorId: fallback && fallback.targetActorId,
        fallbackReason
    });
    if (!fallback) {
        return {
            applied: false, result: null,
            selection: {
                at: ledger.ai.lastTickAt, status: 'ARBITER_FALLBACK_EMPTY',
                reason: sameContext ? mailbox.status : 'STALE_CONTEXT', actorId: pending.actorId,
                arbiterDecisionId: fallbackDecision.id,
                actorWindow: pending.actorWindow || [], elapsedSeconds: Number(dtSec) || 0
            }
        };
    }
    return storyCharacterActionAIApply({
        actionType: fallback.actionType,
        actorId: fallback.actorId,
        targetActorId: fallback.targetActorId,
        score: fallback.score,
        reasons: (fallback.reasons || []).concat(`arbiter-fallback:${sameContext ? mailbox.status : 'STALE_CONTEXT'}`)
    }, 'DETERMINISTIC_AI', {
        schemaVersion: 1,
        requestId: pending.requestId,
        contextHash: pending.contextHash,
        arbiterDecisionId: fallbackDecision.id,
        fallbackReason
    }, pending.actorWindow, dtSec);
}

function storyCharacterActionTick(dtSec) {
    const ledger = storyCharacterActionEnsure();
    if (!ledger) return { disabled: true };
    // Yönetim tikindeki gerçek değişim anı ana senkron kapısıdır.
    // Bu on saniyelik seyrek tarama ise eski/yarım kayıttan kalan kuyruğa
    // alınmış domain makbuzları için kurtarma yoludur.
    storyCharacterActionSyncDomainReceipts();
    ledger.ai.tickSequence++;
    ledger.ai.lastTickAt = storyCharacterActionNow();
    if (typeof storyCharacterArbiterLiveWarmup === 'function') storyCharacterArbiterLiveWarmup();

    const consumed = storyCharacterActionArbiterConsume(dtSec);
    if (consumed) {
        ledger.ai.lastSelection = consumed.selection;
        if (typeof storyCharacterArbiterLiveAvailable === 'function'
            && storyCharacterArbiterLiveAvailable()) {
            const nextSelection = storyCharacterActionAISelection();
            if (nextSelection.selected) storyCharacterActionArbiterQueue(nextSelection);
        }
        return { disabled: false, applied: consumed.applied, result: consumed.result,
            selection: storyCharacterActionClone(ledger.ai.lastSelection) };
    }

    const selection = storyCharacterActionAISelection();
    if (!selection.selected) {
        ledger.ai.lastSelection = {
            at: ledger.ai.lastTickAt,
            status: 'SKIPPED', reason: selection.reason,
            actorWindow: selection.actorWindow || [], ranked: selection.ranked || []
        };
        return { disabled: false, applied: false, selection: storyCharacterActionClone(ledger.ai.lastSelection) };
    }
    const pending = storyCharacterActionArbiterQueue(selection);
    if (pending) {
        ledger.ai.lastSelection = {
            at: ledger.ai.lastTickAt, status: 'ARBITER_PENDING', reason: null,
            actorId: pending.actorId, requestId: pending.requestId,
            actorWindow: pending.actorWindow, consumeAtTick: pending.consumeAtTick
        };
        return { disabled: false, applied: false, pending: true,
            selection: storyCharacterActionClone(ledger.ai.lastSelection) };
    }
    const applied = storyCharacterActionAIApply({
        actionType: selection.candidate.actionType,
        actorId: selection.candidate.actorId,
        targetActorId: selection.candidate.targetActorId,
        score: selection.score,
        reasons: selection.reasons
    }, 'DETERMINISTIC_AI', null, selection.actorWindow, dtSec);
    ledger.ai.lastSelection = applied.selection;
    return { disabled: false, applied: applied.applied, result: applied.result,
        selection: storyCharacterActionClone(ledger.ai.lastSelection) };
}

function storyCharacterActionValidate(candidate) {
    const issues = [];
    const add = (code, path) => issues.push({ code, path });
    if (!candidate || typeof candidate !== 'object') return { ok: false, issues: [{ code: 'LEDGER_REQUIRED', path: '$' }] };
    if (candidate.schemaVersion !== STORY_CHARACTER_ACTION_SCHEMA_VERSION) add('SCHEMA_VERSION', '$.schemaVersion');
    if (candidate.adapterVersion !== STORY_CHARACTER_ACTION_ADAPTER_VERSION) add('ADAPTER_VERSION', '$.adapterVersion');
    if (!candidate.cooldowns || typeof candidate.cooldowns !== 'object' || Array.isArray(candidate.cooldowns)) add('COOLDOWNS_OBJECT', '$.cooldowns');
    if (!candidate.receipts || typeof candidate.receipts !== 'object' || Array.isArray(candidate.receipts)) add('RECEIPTS_OBJECT', '$.receipts');
    if (!candidate.arbiterDecisions || typeof candidate.arbiterDecisions !== 'object'
        || Array.isArray(candidate.arbiterDecisions)) add('ARBITER_DECISIONS_OBJECT', '$.arbiterDecisions');
    if (!candidate.officeTransitions || typeof candidate.officeTransitions !== 'object'
        || Array.isArray(candidate.officeTransitions)) add('OFFICE_TRANSITIONS_OBJECT', '$.officeTransitions');
    if (!candidate.ai || typeof candidate.ai !== 'object' || Array.isArray(candidate.ai)) add('AI_STATE_OBJECT', '$.ai');
    else {
        if (candidate.ai.policyHash !== STORY_CHARACTER_ACTION_AI_POLICY_HASH) add('AI_POLICY_HASH', '$.ai.policyHash');
        for (const key of ['cursor', 'tickSequence', 'selectedCount', 'appliedCount', 'deniedCount',
            'prunedAppliedCount', 'prunedDeniedCount', 'arbiterRequestedCount',
            'arbiterAcceptedCount', 'arbiterPassCount', 'arbiterFallbackCount',
            'arbiterStaleCount', 'arbiterRestoredCount', 'arbiterDecisionPrunedCount']) {
            if (!Number.isInteger(Number(candidate.ai[key])) || Number(candidate.ai[key]) < 0) add('AI_COUNTER', `$.ai.${key}`);
        }
        if (Number(candidate.ai.selectedCount) !== Number(candidate.ai.appliedCount) + Number(candidate.ai.deniedCount)) {
            add('AI_SELECTED_OUTCOME_MISMATCH', '$.ai.selectedCount');
        }
        if (!Number.isFinite(Number(candidate.ai.lastTickAt)) || Number(candidate.ai.lastTickAt) < 0) add('AI_LAST_TICK', '$.ai.lastTickAt');
        const pending = candidate.ai.pendingArbiter;
        if (pending != null && (!pending || pending.schemaVersion !== 1
            || !pending.requestId || !pending.contextHash || !pending.actorId
            || !Number.isInteger(Number(pending.createdAtTick))
            || !Number.isInteger(Number(pending.consumeAtTick))
            || Number(pending.consumeAtTick) !== Number(pending.createdAtTick) + 1
            || !pending.fallback || !pending.fallback.candidateId)) {
            add('AI_PENDING_ARBITER', '$.ai.pendingArbiter');
        }
    }
    const identities = storyCharacterActionIdentities();
    let maximumArbiterSequence = 0;
    for (const [id, decision] of Object.entries(candidate.arbiterDecisions || {})) {
        const at = `$.arbiterDecisions.${id}`;
        if (!decision || decision.id !== id) add('ARBITER_DECISION_ID', `${at}.id`);
        if (!decision || ![1, 2].includes(decision.schemaVersion)) add('ARBITER_DECISION_SCHEMA', `${at}.schemaVersion`);
        if (!decision || !decision.requestId || !decision.contextHash) add('ARBITER_DECISION_REQUEST', at);
        if (!identities[decision && decision.actorId]) add('ARBITER_DECISION_ACTOR', `${at}.actorId`);
        if (!['LOCAL_LLM_VALIDATED', 'DETERMINISTIC_FALLBACK'].includes(decision && decision.source)) {
            add('ARBITER_DECISION_SOURCE', `${at}.source`);
        }
        if (!['ACCEPTED', 'FALLBACK', 'STALE'].includes(decision && decision.status)) {
            add('ARBITER_DECISION_STATUS', `${at}.status`);
        }
        if (!['PROPOSE', 'PASS'].includes(decision && decision.verdict)) add('ARBITER_DECISION_VERDICT', `${at}.verdict`);
        if (decision && decision.verdict === 'PROPOSE'
            && (!decision.candidateId || !STORY_CHARACTER_ACTION_DEFS[decision.actionType])) {
            add('ARBITER_DECISION_CANDIDATE', at);
        }
        if (decision && decision.targetActorId != null && !identities[decision.targetActorId]) {
            add('ARBITER_DECISION_TARGET', `${at}.targetActorId`);
        }
        if (decision && decision.source === 'LOCAL_LLM_VALIDATED'
            && (!decision.reasonCode || !decision.speechPlan || typeof decision.speechPlan !== 'object')) {
            add('ARBITER_DECISION_MODEL_PROOF', at);
        }
        if (decision && decision.schemaVersion === 2 && decision.status !== 'STALE') {
            const speechValidation = typeof storyCharacterSpeechValidateRealization === 'function'
                ? storyCharacterSpeechValidateRealization(decision.realization)
                : { ok: false };
            if (!speechValidation.ok) add('ARBITER_DECISION_REALIZATION', `${at}.realization`);
        }
        if (decision && decision.status === 'STALE' && decision.realization != null) {
            add('ARBITER_STALE_REALIZATION', `${at}.realization`);
        }
        if (!Number.isInteger(Number(decision && decision.sequence)) || Number(decision.sequence) < 1) {
            add('ARBITER_DECISION_SEQUENCE', `${at}.sequence`);
        }
        maximumArbiterSequence = Math.max(maximumArbiterSequence, Number(decision && decision.sequence) || 0);
    }
    if (!Number.isInteger(Number(candidate.nextArbiterDecisionSequence))
        || Number(candidate.nextArbiterDecisionSequence) < maximumArbiterSequence) {
        add('ARBITER_DECISION_NEXT_SEQUENCE', '$.nextArbiterDecisionSequence');
    }
    if (Object.keys(candidate.arbiterDecisions || {}).length > STORY_CHARACTER_ARBITER_DECISION_CAP) {
        add('ARBITER_DECISION_CAP', '$.arbiterDecisions');
    }
    for (const [key, value] of Object.entries(candidate.cooldowns || {})) {
        if (!Number.isFinite(Number(value)) || Number(value) < 0) add('COOLDOWN_TIME', `$.cooldowns.${key}`);
    }
    for (const [id, receipt] of Object.entries(candidate.receipts || {})) {
        const at = `$.receipts.${id}`;
        if (!receipt || receipt.id !== id) add('RECEIPT_ID', `${at}.id`);
        if (!STORY_CHARACTER_ACTION_DEFS[receipt && receipt.actionType]) add('ACTION_TYPE', `${at}.actionType`);
        if (!identities[receipt && receipt.actorId]) add('ACTOR_REFERENCE', `${at}.actorId`);
        if (receipt && receipt.targetActorId != null && !identities[receipt.targetActorId]) add('TARGET_REFERENCE', `${at}.targetActorId`);
        if (!['APPLIED', 'FAILED'].includes(receipt && receipt.status)) add('RECEIPT_STATUS', `${at}.status`);
        if (!receipt || !receipt.authority || receipt.authority.ok !== true) add('AUTHORITY_RECEIPT', `${at}.authority`);
        if (!receipt || !receipt.cost || !receipt.cost.ledger) add('COST_CONTRACT', `${at}.cost`);
        if (receipt && receipt.status === 'APPLIED' && (!receipt.costReceipt || receipt.costReceipt.ok !== true)) add('COST_RECEIPT', `${at}.costReceipt`);
        if (!receipt || typeof receipt.targetModel !== 'string') add('TARGET_MODEL', `${at}.targetModel`);
        if (!receipt || !receipt.domainContext || typeof receipt.domainContext !== 'object'
            || Array.isArray(receipt.domainContext)) add('DOMAIN_CONTEXT', `${at}.domainContext`);
        if (receipt && receipt.actionType === 'ORDER' && receipt.status === 'APPLIED') {
            if (!receipt.domainReceipt || receipt.domainReceipt.ok !== true
                || !['QUEUED_DOMAIN_DECISION', 'DOMAIN_DECISION_RESOLVED'].includes(receipt.domainReceipt.outcomeModel)
                || !receipt.domainReceipt.requestId || !receipt.domainReceipt.targetRegionId) {
                add('ORDER_DOMAIN_RECEIPT', `${at}.domainReceipt`);
            }
            if (receipt.domainReceipt && receipt.domainReceipt.outcomeModel === 'DOMAIN_DECISION_RESOLVED'
                && (!receipt.domainReceipt.finalResult || !receipt.domainReceipt.finalResult.status)) {
                add('ORDER_DOMAIN_FINAL_RESULT', `${at}.domainReceipt.finalResult`);
            }
        }
        if (receipt && receipt.actionType === 'SABOTAGE' && receipt.status === 'APPLIED') {
            const domain = receipt.domainReceipt;
            if (!domain || domain.ok !== true
                || !['QUEUED_COVERT_OPERATION', 'COVERT_OPERATION_RESOLVED'].includes(domain.outcomeModel)
                || !domain.operationId || !domain.targetAssetId || !domain.targetCountryId
                || !Number.isFinite(Number(domain.resolveAt))) {
                add('SABOTAGE_DOMAIN_RECEIPT', `${at}.domainReceipt`);
            }
            if (domain && domain.outcomeModel === 'COVERT_OPERATION_RESOLVED'
                && (!domain.finalResult || !['SUCCEEDED', 'FAILED', 'TARGET_LOST'].includes(domain.finalResult.status))) {
                add('SABOTAGE_DOMAIN_FINAL_RESULT', `${at}.domainReceipt.finalResult`);
            }
        }
        if (receipt && receipt.actionType === 'RESIGN' && receipt.status === 'APPLIED') {
            const domain = receipt.domainReceipt;
            if (!domain || domain.ok !== true || domain.outcomeModel !== 'OFFICE_SUCCESSION_RESOLVED'
                || !domain.transitionId || !domain.institutionId || !domain.predecessorActorId
                || !domain.successorHolder || !identities[domain.successorHolder.actorId]
                || domain.physicalMutation !== true) {
                add('RESIGN_DOMAIN_RECEIPT', `${at}.domainReceipt`);
            }
        }
        if (storyCharacterActionAIReceipt(receipt)) {
            if (!Number.isFinite(Number(receipt.selectorScore))) add('AI_SELECTOR_SCORE', `${at}.selectorScore`);
            if (!Array.isArray(receipt.selectorReasons) || !receipt.selectorReasons.length) add('AI_SELECTOR_REASONS', `${at}.selectorReasons`);
        }
        if (receipt && receipt.decisionSource === 'LOCAL_LLM_VALIDATED') {
            const meta = receipt.decisionMetadata;
            if (!meta || !meta.requestId || !meta.contextHash || !meta.reasonCode
                || !meta.speechPlan || typeof meta.speechPlan !== 'object') {
                add('LLM_DECISION_METADATA', `${at}.decisionMetadata`);
            }
        }
    }
    for (const [institutionId, transition] of Object.entries(candidate.officeTransitions || {})) {
        const at = `$.officeTransitions.${institutionId}`;
        if (!transition || transition.institutionId !== institutionId) add('OFFICE_TRANSITION_ID', `${at}.institutionId`);
        if (!transition || transition.status !== 'ACTIVE') add('OFFICE_TRANSITION_STATUS', `${at}.status`);
        if (!identities[transition && transition.predecessorActorId]) add('OFFICE_TRANSITION_PREDECESSOR', `${at}.predecessorActorId`);
        if (!transition || !transition.successorHolder || !identities[transition.successorHolder.actorId]) {
            add('OFFICE_TRANSITION_SUCCESSOR', `${at}.successorHolder`);
        }
        const sourceReceipt = transition && candidate.receipts[transition.sourceReceiptId];
        if (!sourceReceipt || sourceReceipt.actionType !== 'RESIGN' || sourceReceipt.status !== 'APPLIED') {
            add('OFFICE_TRANSITION_RECEIPT', `${at}.sourceReceiptId`);
        }
    }
    if (Object.keys(candidate.receipts || {}).length > STORY_CHARACTER_ACTION_RECEIPT_CAP) add('RECEIPT_CAP', '$.receipts');
    const aiReceipts = Object.values(candidate.receipts || {}).filter(storyCharacterActionAIReceipt);
    if (candidate.ai && Number(candidate.ai.appliedCount) !== Number(candidate.ai.prunedAppliedCount)
        + aiReceipts.filter(row => row.status === 'APPLIED').length) {
        add('AI_APPLIED_RECEIPT_MISMATCH', '$.ai.appliedCount');
    }
    if (candidate.ai && Number(candidate.ai.deniedCount) !== Number(candidate.ai.prunedDeniedCount)
        + aiReceipts.filter(row => row.status === 'FAILED').length) {
        add('AI_DENIED_RECEIPT_MISMATCH', '$.ai.deniedCount');
    }
    return { ok: issues.length === 0, issues };
}

function storyCharacterActionSnapshot() {
    const ledger = storyCharacterActionEnsure();
    return ledger ? storyCharacterActionClone(ledger) : null;
}

function storyCharacterActionForSave() { return storyCharacterActionSnapshot(); }

// Kurum defteri makam sahibini kendi restore'u sırasında yeniden türetir.
// Aktif istifa geçişini bundan önce salt-okunur kaynak olarak hazırlarız;
// tam kimlik/referans doğrulaması karakter sicili geri geldikten sonra normal
// restore aşamasında yine yapılır.
function storyCharacterActionPrimeRestore(saved) {
    if (typeof storyCharacterArbiterLiveReset === 'function') storyCharacterArbiterLiveReset({ preserveTestAdapter: true });
    if (!storyCharacterActionEnabled() || !saved) {
        STORY.characterActions = null;
        return null;
    }
    const candidate = storyCharacterActionMigrateLedger(saved);
    STORY.characterActions = candidate || null;
    return candidate ? storyCharacterActionClone(candidate) : null;
}

function storyCharacterActionRestore(saved) {
    if (!storyCharacterActionEnabled()) { STORY.characterActions = null; return null; }
    const candidate = storyCharacterActionMigrateLedger(saved);
    if (candidate && storyCharacterActionValidate(candidate).ok) {
        STORY.characterActions = candidate;
        if (STORY.characterActions.ai.pendingArbiter) STORY.characterActions.ai.arbiterRestoredCount++;
    }
    else {
        STORY.characterActions = storyCharacterActionLedgerCreate({ backfilled: true });
        STORY.characterActions.diagnostics.restoredFromInvalidLedger = !!candidate;
    }
    if (typeof storyInstitutionEnsure === 'function') storyInstitutionEnsure();
    return storyCharacterActionSnapshot();
}

function storyCharacterActionSummary() {
    const ledger = storyCharacterActionEnsure();
    if (!ledger) return { disabled: true };
    const receipts = Object.values(ledger.receipts || {});
    const playerActorId = storyCharacterActionAIPlayerActorId();
    const aiReceipts = receipts.filter(storyCharacterActionAIReceipt);
    const byType = {};
    for (const receipt of receipts) byType[receipt.actionType] = (byType[receipt.actionType] || 0) + 1;
    const aiByType = {};
    for (const receipt of aiReceipts) aiByType[receipt.actionType] = (aiByType[receipt.actionType] || 0) + 1;
    const dominantAITypeRow = Object.entries(aiByType).sort((a, b) => b[1] - a[1]
        || a[0].localeCompare(b[0], 'en'))[0] || null;
    const tickCount = Math.max(0, Number(ledger.ai.tickSequence) || 0);
    const appliedAI = Math.max(0, Number(ledger.ai.appliedCount) || 0);
    const selectedAI = Math.max(0, Number(ledger.ai.selectedCount) || 0);
    return {
        schemaVersion: ledger.schemaVersion,
        receiptCount: receipts.length,
        appliedCount: receipts.filter(row => row.status === 'APPLIED').length,
        failedCount: receipts.filter(row => row.status === 'FAILED').length,
        cooldownCount: Object.keys(ledger.cooldowns || {}).length,
        byType,
        aiReceiptCount: aiReceipts.length,
        aiByType,
        aiDistinctTypeCount: Object.keys(aiByType).length,
        aiDominantType: dominantAITypeRow ? dominantAITypeRow[0] : null,
        aiDominantTypeShareBps: dominantAITypeRow && aiReceipts.length
            ? Math.round(dominantAITypeRow[1] / aiReceipts.length * 10000) : 0,
        aiActionRateBps: tickCount ? Math.round(appliedAI / tickCount * 10000) : 0,
        aiSkippedCount: Math.max(0, tickCount - selectedAI),
        aiArbiterRequestedCount: Math.max(0, Number(ledger.ai.arbiterRequestedCount) || 0),
        aiArbiterAcceptedCount: Math.max(0, Number(ledger.ai.arbiterAcceptedCount) || 0),
        aiArbiterPassCount: Math.max(0, Number(ledger.ai.arbiterPassCount) || 0),
        aiArbiterFallbackCount: Math.max(0, Number(ledger.ai.arbiterFallbackCount) || 0),
        aiArbiterStaleCount: Math.max(0, Number(ledger.ai.arbiterStaleCount) || 0),
        arbiterDecisionCount: Object.keys(ledger.arbiterDecisions || {}).length,
        arbiterDecisionPrunedCount: Math.max(0, Number(ledger.ai.arbiterDecisionPrunedCount) || 0),
        aiPlayerActorReceiptCount: aiReceipts.filter(row => row.actorId === playerActorId).length,
        serializedChars: JSON.stringify(ledger).length,
        ai: storyCharacterActionClone(ledger.ai),
        receiptCap: STORY_CHARACTER_ACTION_RECEIPT_CAP
    };
}
