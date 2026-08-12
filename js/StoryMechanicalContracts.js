// ============================================================================
//  MECHANICAL CONTRACT V1 — Faz 38.3 genel sözleşme omurgası
//  ---------------------------------------------------------------------------
//  NegotiationCase konuşmayı taşır; bu defter taraf, değer, süre, ihlal ve
//  icra makbuzunun mekanik gerçeğidir. Şema beş türü tanır. İlk kanıtlı dünya
//  adaptörü yalnız GOODS / SHIPMENT_DELIVERY'dir.
// ============================================================================

const STORY_MECHANICAL_CONTRACT_SCHEMA_VERSION = 1;
const STORY_MECHANICAL_CONTRACT_ADAPTER_VERSION = 'mechanical-contract-v1';
const STORY_MECHANICAL_CONTRACT_LIMIT = 256;
const STORY_MECHANICAL_CONTRACT_EVENT_LIMIT = 512;
const STORY_MECHANICAL_CONTRACT_TYPES = Object.freeze([
    'GOODS', 'SERVICE', 'CONSTRUCTION', 'LOGISTICS', 'INSURANCE'
]);
const STORY_MECHANICAL_CONTRACT_STATUSES = Object.freeze([
    'APPROVED_PENDING_EXECUTION', 'ACTIVE', 'FULFILLED',
    'BREACH_PAYMENT_PENDING', 'BREACHED', 'CANCELLED'
]);

function storyMechanicalContractClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyMechanicalContractHash(value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return `fnv1a32:${(`00000000${hash.toString(16)}`).slice(-8)}`;
}

function storyMechanicalContractEnabled() {
    return typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('characters.mechanicalContracts');
}

function storyMechanicalContractLedgerCreate() {
    return {
        schemaVersion: STORY_MECHANICAL_CONTRACT_SCHEMA_VERSION,
        adapterVersion: STORY_MECHANICAL_CONTRACT_ADAPTER_VERSION,
        nextContractSequence: 1,
        nextEventSequence: 1,
        contracts: {},
        events: [],
        diagnostics: { created: 0, activated: 0, fulfilled: 0, breached: 0,
            pendingBreachPayment: 0, idempotentHits: 0, rejected: 0 }
    };
}

function storyMechanicalContractLedgerMigrate(candidate) {
    const ledger = candidate && typeof candidate === 'object'
        ? candidate : storyMechanicalContractLedgerCreate();
    if (!Number.isInteger(ledger.nextContractSequence) || ledger.nextContractSequence < 1) {
        ledger.nextContractSequence = 1;
    }
    if (!Number.isInteger(ledger.nextEventSequence) || ledger.nextEventSequence < 1) {
        ledger.nextEventSequence = 1;
    }
    if (!ledger.contracts || typeof ledger.contracts !== 'object' || Array.isArray(ledger.contracts)) {
        ledger.contracts = {};
    }
    if (!Array.isArray(ledger.events)) ledger.events = [];
    if (!ledger.diagnostics || typeof ledger.diagnostics !== 'object') ledger.diagnostics = {};
    for (const key of ['created', 'activated', 'fulfilled', 'breached',
        'pendingBreachPayment', 'idempotentHits', 'rejected']) {
        if (!Number.isFinite(Number(ledger.diagnostics[key]))) ledger.diagnostics[key] = 0;
    }
    return ledger;
}

function storyMechanicalContractEnsure() {
    if (!storyMechanicalContractEnabled()) return null;
    if (!STORY.mechanicalContracts
        || STORY.mechanicalContracts.schemaVersion !== STORY_MECHANICAL_CONTRACT_SCHEMA_VERSION) {
        STORY.mechanicalContracts = storyMechanicalContractLedgerCreate();
    }
    return storyMechanicalContractLedgerMigrate(STORY.mechanicalContracts);
}

function storyMechanicalContractReset() {
    STORY.mechanicalContracts = storyMechanicalContractEnabled()
        ? storyMechanicalContractLedgerCreate() : null;
    return storyMechanicalContractSnapshot();
}

function storyMechanicalContractEvent(ledger, kind, contract, details) {
    const event = {
        schemaVersion: 1,
        id: `mechanical-contract-event:${ledger.nextEventSequence++}`,
        kind: String(kind),
        contractId: contract.id,
        at: Number(STORY.clock) || 0,
        details: storyMechanicalContractClone(details || {})
    };
    ledger.events.push(event);
    if (ledger.events.length > STORY_MECHANICAL_CONTRACT_EVENT_LIMIT) {
        ledger.events.splice(0, ledger.events.length - STORY_MECHANICAL_CONTRACT_EVENT_LIMIT);
    }
    return event;
}

function storyMechanicalContractImmutableBody(spec) {
    return {
        type: String(spec.type), subtype: String(spec.subtype),
        source: storyMechanicalContractClone(spec.source),
        parties: storyMechanicalContractClone(spec.parties),
        scope: storyMechanicalContractClone(spec.scope),
        price: storyMechanicalContractClone(spec.price),
        schedule: storyMechanicalContractClone(spec.schedule),
        serviceLevel: storyMechanicalContractClone(spec.serviceLevel),
        breach: storyMechanicalContractClone(spec.breach),
        causalIds: storyMechanicalContractClone(spec.causalIds || [])
    };
}

function storyMechanicalContractGoodsDraftCreate(spec) {
    const ledger = storyMechanicalContractEnsure();
    if (!ledger) return { ok: false, code: 'MECHANICAL_CONTRACT_FEATURE_DISABLED' };
    spec = spec || {};
    const immutable = storyMechanicalContractImmutableBody(Object.assign({}, spec, {
        type: 'GOODS', subtype: spec.subtype || 'SHIPMENT_DELIVERY'
    }));
    const source = immutable.source || {};
    const sourceKey = `${source.negotiationCaseId || ''}:${source.negotiationVersionId || ''}`;
    const contentHash = storyMechanicalContractHash(immutable);
    const validationProbe = {
        source, parties: immutable.parties, scope: immutable.scope,
        price: immutable.price, schedule: immutable.schedule,
        serviceLevel: immutable.serviceLevel, breach: immutable.breach
    };
    const buyer = (immutable.parties || []).find(row => row.role === 'BUYER');
    const seller = (immutable.parties || []).find(row => row.role === 'SELLER');
    const valid = source.negotiationCaseId && source.negotiationVersionId && source.mechanicalReviewId
        && buyer && seller && buyer.actorId && seller.actorId
        && buyer.legalActorId && seller.legalActorId && buyer.legalActorId !== seller.legalActorId
        && validationProbe.scope && validationProbe.scope.shipmentId
        && Number(validationProbe.scope.quantity) > 0 && validationProbe.scope.resourceId
        && validationProbe.price && Number(validationProbe.price.amount) > 0
        && validationProbe.price.currency === 'capital'
        && validationProbe.schedule && Number(validationProbe.schedule.dueAt) > Number(STORY.clock || 0)
        && validationProbe.breach && Number(validationProbe.breach.penaltyAmount) > 0;
    if (!valid) {
        ledger.diagnostics.rejected++;
        return { ok: false, code: 'MECHANICAL_CONTRACT_GOODS_DRAFT_INVALID' };
    }
    const existing = Object.values(ledger.contracts).find(row => row.sourceKey === sourceKey);
    if (existing) {
        if (existing.contentHash !== contentHash) {
            if (existing.status !== 'APPROVED_PENDING_EXECUTION') {
                ledger.diagnostics.rejected++;
                return { ok: false, code: 'MECHANICAL_CONTRACT_SOURCE_CONFLICT' };
            }
            Object.assign(existing, immutable, {
                contentHash,
                approvals: [
                    (immutable.parties || []).find(row => row.role === 'BUYER'),
                    (immutable.parties || []).find(row => row.role === 'SELLER')
                ].filter(Boolean).map(row => ({
                    role: row.role, actorId: row.actorId, legalActorId: row.legalActorId,
                    status: 'APPROVED', approvedAt: Number(STORY.clock) || 0,
                    source: 'NEGOTIATION_CURRENT_VERSION_ACCEPTANCE'
                })),
                updatedAt: Number(STORY.clock) || 0,
                version: Number(existing.version || 0) + 1
            });
            storyMechanicalContractEvent(ledger, 'CONTRACT_DRAFT_REFRESHED', existing,
                { mechanicalReviewId: source.mechanicalReviewId });
            return { ok: true, code: 'MECHANICAL_CONTRACT_DRAFT_REFRESHED', duplicate: false,
                contract: storyMechanicalContractClone(existing) };
        }
        ledger.diagnostics.idempotentHits++;
        return { ok: true, code: 'MECHANICAL_CONTRACT_EXISTS', duplicate: true,
            contract: storyMechanicalContractClone(existing) };
    }
    if (Object.keys(ledger.contracts).length >= STORY_MECHANICAL_CONTRACT_LIMIT) {
        ledger.diagnostics.rejected++;
        return { ok: false, code: 'MECHANICAL_CONTRACT_LIMIT' };
    }
    const sequence = ledger.nextContractSequence++;
    const contract = Object.assign({
        schemaVersion: STORY_MECHANICAL_CONTRACT_SCHEMA_VERSION,
        id: `mechanical-contract:${sequence}`,
        sequence,
        sourceKey,
        contentHash,
        status: 'APPROVED_PENDING_EXECUTION',
        approvals: [buyer, seller].map(row => ({
            role: row.role, actorId: row.actorId, legalActorId: row.legalActorId,
            status: 'APPROVED', approvedAt: Number(STORY.clock) || 0,
            source: 'NEGOTIATION_CURRENT_VERSION_ACCEPTANCE'
        })),
        execution: { adapter: 'GOODS_SHIPMENT_DELIVERY_V1', status: 'PENDING',
            receiptId: null, lastErrorCode: null },
        createdAt: Number(STORY.clock) || 0,
        updatedAt: Number(STORY.clock) || 0,
        fulfilledAt: null,
        breachedAt: null,
        version: 1
    }, immutable);
    ledger.contracts[contract.id] = contract;
    ledger.diagnostics.created++;
    storyMechanicalContractEvent(ledger, 'CONTRACT_CREATED', contract, { sourceKey });
    return { ok: true, code: 'MECHANICAL_CONTRACT_CREATED', duplicate: false,
        contract: storyMechanicalContractClone(contract) };
}

function storyMechanicalContractActivate(contractId, receiptId) {
    const ledger = storyMechanicalContractEnsure();
    const contract = ledger && ledger.contracts[String(contractId || '')];
    if (!contract) return { ok: false, code: 'MECHANICAL_CONTRACT_NOT_FOUND' };
    const receipt = String(receiptId || '');
    if (!receipt) return { ok: false, code: 'MECHANICAL_CONTRACT_RECEIPT_REQUIRED' };
    if (contract.status === 'ACTIVE' && contract.execution.receiptId === receipt) {
        ledger.diagnostics.idempotentHits++;
        return { ok: true, code: 'MECHANICAL_CONTRACT_ALREADY_ACTIVE', duplicate: true,
            contract: storyMechanicalContractClone(contract) };
    }
    if (contract.status !== 'APPROVED_PENDING_EXECUTION') {
        return { ok: false, code: 'MECHANICAL_CONTRACT_NOT_ACTIVATABLE' };
    }
    contract.status = 'ACTIVE';
    contract.execution.status = 'TRACKING';
    contract.execution.receiptId = receipt;
    contract.updatedAt = Number(STORY.clock) || 0;
    contract.version++;
    ledger.diagnostics.activated++;
    storyMechanicalContractEvent(ledger, 'CONTRACT_ACTIVATED', contract, { receiptId: receipt });
    return { ok: true, code: 'MECHANICAL_CONTRACT_ACTIVATED', duplicate: false,
        contract: storyMechanicalContractClone(contract) };
}

function storyMechanicalContractSyncDelivery(contractId, obligation) {
    const ledger = storyMechanicalContractEnsure();
    const contract = ledger && ledger.contracts[String(contractId || '')];
    if (!contract || !obligation || contract.execution.receiptId !== obligation.id) {
        return { ok: false, code: 'MECHANICAL_CONTRACT_DELIVERY_LINK_INVALID' };
    }
    const target = obligation.status === 'KEPT' ? 'FULFILLED'
        : obligation.status === 'BROKEN' ? 'BREACHED'
            : obligation.status === 'BREACH_PAYMENT_PENDING' ? 'BREACH_PAYMENT_PENDING' : 'ACTIVE';
    if (contract.status === target) {
        ledger.diagnostics.idempotentHits++;
        return { ok: true, code: 'MECHANICAL_CONTRACT_STATUS_UNCHANGED', duplicate: true,
            contract: storyMechanicalContractClone(contract) };
    }
    if (!['ACTIVE', 'BREACH_PAYMENT_PENDING'].includes(contract.status)
        || !['ACTIVE', 'FULFILLED', 'BREACH_PAYMENT_PENDING', 'BREACHED'].includes(target)) {
        return { ok: false, code: 'MECHANICAL_CONTRACT_TRANSITION_INVALID' };
    }
    contract.status = target;
    contract.execution.status = target === 'ACTIVE' ? 'TRACKING' : target;
    contract.execution.lastErrorCode = obligation.lastErrorCode || null;
    contract.updatedAt = Number(STORY.clock) || 0;
    contract.fulfilledAt = target === 'FULFILLED' ? contract.updatedAt : null;
    contract.breachedAt = ['BREACHED', 'BREACH_PAYMENT_PENDING'].includes(target)
        ? Number(obligation.breachedAt) || contract.updatedAt : null;
    contract.version++;
    if (target === 'FULFILLED') ledger.diagnostics.fulfilled++;
    if (target === 'BREACHED') ledger.diagnostics.breached++;
    if (target === 'BREACH_PAYMENT_PENDING') ledger.diagnostics.pendingBreachPayment++;
    storyMechanicalContractEvent(ledger, `CONTRACT_${target}`, contract,
        { deliveryObligationId: obligation.id });
    return { ok: true, code: `MECHANICAL_CONTRACT_${target}`,
        contract: storyMechanicalContractClone(contract) };
}

function storyMechanicalContractGet(contractId) {
    const ledger = storyMechanicalContractEnsure();
    return storyMechanicalContractClone(ledger && ledger.contracts[String(contractId || '')] || null);
}

function storyMechanicalContractList(actorId) {
    const actor = actorId == null ? null : String(actorId);
    const ledger = storyMechanicalContractEnsure();
    return Object.values(ledger && ledger.contracts || {})
        .filter(row => !actor || row.parties.some(party => party.actorId === actor))
        .sort((a, b) => b.sequence - a.sequence)
        .map(storyMechanicalContractClone);
}

function storyMechanicalContractValidate(candidate) {
    const issues = [];
    const add = (code, path) => issues.push({ code, path });
    if (!candidate || typeof candidate !== 'object') {
        return { ok: false, issues: [{ code: 'LEDGER_OBJECT', path: '$' }] };
    }
    if (candidate.schemaVersion !== STORY_MECHANICAL_CONTRACT_SCHEMA_VERSION) add('SCHEMA_VERSION', '$.schemaVersion');
    if (candidate.adapterVersion !== STORY_MECHANICAL_CONTRACT_ADAPTER_VERSION) add('ADAPTER_VERSION', '$.adapterVersion');
    if (!candidate.contracts || typeof candidate.contracts !== 'object' || Array.isArray(candidate.contracts)) {
        add('CONTRACTS', '$.contracts');
    }
    if (!Array.isArray(candidate.events) || candidate.events.length > STORY_MECHANICAL_CONTRACT_EVENT_LIMIT) {
        add('EVENTS', '$.events');
    }
    for (const [id, row] of Object.entries(candidate.contracts || {})) {
        const at = `$.contracts.${id}`;
        if (row.id !== id || !Number.isInteger(row.sequence) || row.sequence < 1) add('CONTRACT_IDENTITY', at);
        if (!STORY_MECHANICAL_CONTRACT_TYPES.includes(row.type)) add('CONTRACT_TYPE', `${at}.type`);
        if (!STORY_MECHANICAL_CONTRACT_STATUSES.includes(row.status)) add('CONTRACT_STATUS', `${at}.status`);
        const immutable = storyMechanicalContractImmutableBody(row);
        if (storyMechanicalContractHash(immutable) !== row.contentHash) add('CONTRACT_HASH', at);
        const buyer = (row.parties || []).find(party => party.role === 'BUYER');
        const seller = (row.parties || []).find(party => party.role === 'SELLER');
        if (!buyer || !seller || !buyer.actorId || !seller.actorId || !buyer.legalActorId
            || !seller.legalActorId || buyer.legalActorId === seller.legalActorId) add('CONTRACT_PARTIES', at);
        if (!row.source || !row.source.negotiationCaseId || !row.source.negotiationVersionId
            || !row.source.mechanicalReviewId) add('CONTRACT_SOURCE', at);
        if (row.source && row.sourceKey !== `${row.source.negotiationCaseId}:${row.source.negotiationVersionId}`) {
            add('CONTRACT_SOURCE_KEY', at);
        }
        if (!row.scope || !row.scope.shipmentId || !row.scope.resourceId
            || !(Number(row.scope.quantity) > 0)) add('CONTRACT_SCOPE', at);
        if (!row.price || !(Number(row.price.amount) > 0) || row.price.currency !== 'capital') add('CONTRACT_PRICE', at);
        if (!row.schedule || !(Number(row.schedule.dueAt) > Number(row.createdAt))) add('CONTRACT_SCHEDULE', at);
        if (!row.breach || !(Number(row.breach.penaltyAmount) > 0)) add('CONTRACT_BREACH', at);
        if (!Array.isArray(row.approvals) || row.approvals.length !== 2
            || row.approvals.some(approval => approval.status !== 'APPROVED')) add('CONTRACT_APPROVALS', at);
        const pending = row.status === 'APPROVED_PENDING_EXECUTION';
        if (!row.execution || (pending
            ? row.execution.status !== 'PENDING' || row.execution.receiptId !== null
            : !String(row.execution.receiptId || '').trim())) add('CONTRACT_EXECUTION', at);
        const expectedExecutionStatus = {
            ACTIVE: 'TRACKING', FULFILLED: 'FULFILLED',
            BREACH_PAYMENT_PENDING: 'BREACH_PAYMENT_PENDING', BREACHED: 'BREACHED'
        }[row.status];
        if (!pending && row.status !== 'CANCELLED'
            && row.execution && row.execution.status !== expectedExecutionStatus) {
            add('CONTRACT_EXECUTION_STATUS', at);
        }
        if (row.status === 'FULFILLED' && !Number.isFinite(Number(row.fulfilledAt))) {
            add('CONTRACT_FULFILLED_AT', at);
        }
        if (['BREACHED', 'BREACH_PAYMENT_PENDING'].includes(row.status)
            && !Number.isFinite(Number(row.breachedAt))) add('CONTRACT_BREACHED_AT', at);
        if (row.type !== 'GOODS' || row.execution.adapter !== 'GOODS_SHIPMENT_DELIVERY_V1') {
            add('CONTRACT_ADAPTER', at);
        }
    }
    return { ok: issues.length === 0, issues };
}

function storyMechanicalContractSnapshot() {
    return storyMechanicalContractClone(storyMechanicalContractEnsure());
}

function storyMechanicalContractForSave() {
    const snapshot = storyMechanicalContractSnapshot();
    return storyMechanicalContractValidate(snapshot).ok ? snapshot : null;
}

function storyMechanicalContractRestore(candidate) {
    if (!storyMechanicalContractEnabled()) {
        STORY.mechanicalContracts = null;
        return { ok: true, disabled: true };
    }
    if (!candidate) {
        STORY.mechanicalContracts = storyMechanicalContractLedgerCreate();
        return { ok: true, migrated: true };
    }
    const migrated = storyMechanicalContractLedgerMigrate(storyMechanicalContractClone(candidate));
    const validation = storyMechanicalContractValidate(migrated);
    STORY.mechanicalContracts = validation.ok ? migrated : storyMechanicalContractLedgerCreate();
    return validation.ok ? { ok: true, migrated: false }
        : { ok: false, code: 'MECHANICAL_CONTRACT_RESTORE_INVALID', issues: validation.issues };
}
