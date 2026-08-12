// ============================================================================
//  SÜRÜMLÜ PAZARLIK VAKASI — Faz 38.3 (ilk dikey)
//  ---------------------------------------------------------------------------
//  READY_FOR_NEGOTIATION konuşma taslağını kalıcı teklif sürümlerine dönüştürür.
//  Taraf kabulü dünya icrası değildir. Bu defter para, stok, sevkiyat, ilişki
//  veya yetki değiştirmez; mekanik sözleşme kapısı özellikle PENDING kalır.
// ============================================================================

const STORY_NEGOTIATION_SCHEMA_VERSION = 1;
const STORY_NEGOTIATION_ADAPTER_VERSION = 'story-negotiation-case-1';
const STORY_NEGOTIATION_CASE_LIMIT = 128;
const STORY_NEGOTIATION_VERSION_LIMIT = 16;
const STORY_NEGOTIATION_COMMITMENT_LIMIT = 256;
const STORY_NEGOTIATION_SECRET_LIMIT = 256;
const STORY_NEGOTIATION_DISCLOSURE_LIMIT = 16;
const STORY_NEGOTIATION_MECHANICAL_REVIEW_LIMIT = 16;
const STORY_NEGOTIATION_DELIVERY_LIMIT = 128;
const STORY_NEGOTIATION_CONSEQUENCE_LIMIT = 256;
const STORY_NEGOTIATION_PENALTY_RETRY_SECONDS = 10;
const STORY_NEGOTIATION_EVENT_LIMIT = 512;
const STORY_NEGOTIATION_STATUSES = Object.freeze([
    'DRAFT', 'COUNTERED', 'ACCEPTED_PENDING_APPROVAL', 'ACTIVE',
    'FULFILLED', 'BREACHED', 'BREACH_PAYMENT_PENDING', 'DECLINED', 'EXPIRED'
]);
const STORY_NEGOTIATION_TERM_KEYS = Object.freeze([
    'quantity', 'payment', 'delivery_schedule', 'contract_penalty'
]);
const STORY_NEGOTIATION_OBLIGATIONS = Object.freeze([
    'PROVIDE_COUNTER_OFFER', 'SECURE_MECHANICAL_APPROVAL'
]);

function storyNegotiationClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyNegotiationHash(value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return `fnv1a32:${(`00000000${hash.toString(16)}`).slice(-8)}`;
}

function storyNegotiationEnabled() {
    return typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('characters.negotiationCases');
}

function storyNegotiationDamageAssessment(deliveries) {
    const entries = (deliveries || []).map(row => ({
        deliveryObligationId: row.id,
        shipmentId: row.shipmentId,
        resourceId: row.resourceId,
        quantity: Number(row.quantity) || 0,
        contractualValue: Number(row.paymentAmount) || 0,
        refundedPrincipal: Number(row.paymentAmount) || 0,
        penaltyCompensation: Number(row.penaltyAmount) || 0,
        verifiedDirectLoss: 0,
        uncompensatedDamage: 0,
        evidenceIds: [row.id].concat(row.penaltyTransactionIds || []).filter(Boolean),
        classification: 'BREACH_SETTLED_ESCROW_REFUNDED_AND_PENALTY_PAID'
    }));
    return {
        schemaVersion: 1,
        currency: 'capital',
        entries,
        totals: {
            contractualValue: entries.reduce((sum, row) => sum + row.contractualValue, 0),
            refundedPrincipal: entries.reduce((sum, row) => sum + row.refundedPrincipal, 0),
            penaltyCompensation: entries.reduce((sum, row) => sum + row.penaltyCompensation, 0),
            verifiedDirectLoss: entries.reduce((sum, row) => sum + row.verifiedDirectLoss, 0),
            uncompensatedDamage: entries.reduce((sum, row) => sum + row.uncompensatedDamage, 0)
        },
        unmeasuredClaims: [
            { kind: 'OPPORTUNITY_COST', status: 'UNVERIFIED', includedInDamage: false },
            { kind: 'PRODUCTION_LOSS', status: 'UNVERIFIED', includedInDamage: false }
        ],
        sourceModel: 'CANONICAL_DELIVERY_ESCROW_AND_PENALTY_RECEIPTS_ONLY'
    };
}

function storyNegotiationLedgerCreate() {
    return {
        schemaVersion: STORY_NEGOTIATION_SCHEMA_VERSION,
        adapterVersion: STORY_NEGOTIATION_ADAPTER_VERSION,
        nextCaseSequence: 1,
        nextCommitmentSequence: 1,
        nextSecretSequence: 1,
        nextDisclosureSequence: 1,
        nextMechanicalReviewSequence: 1,
        nextDeliverySequence: 1,
        nextConsequenceSequence: 1,
        cases: {},
        commitments: {},
        secrets: {},
        deliveryObligations: {},
        consequenceCandidates: {},
        events: [],
        diagnostics: {
            opened: 0, versionsCreated: 0, partyAcceptances: 0,
            promisesCreated: 0, promisesKept: 0, promisesBroken: 0,
            secretsShared: 0, disclosures: 0, unauthorizedDisclosures: 0,
            leaksDiscovered: 0, betrayalsApplied: 0,
            mechanicalPreflights: 0, mechanicalBlocked: 0,
            deliveriesCreated: 0, deliveriesKept: 0, deliveriesBroken: 0,
            consequenceCandidatesCreated: 0,
            rejectedMutations: 0, prunedCases: 0, prunedEvents: 0
        }
    };
}

function storyNegotiationLedgerMigrate(candidate) {
    const ledger = candidate && typeof candidate === 'object' ? candidate : storyNegotiationLedgerCreate();
    if (!Number.isInteger(ledger.nextSecretSequence) || ledger.nextSecretSequence < 1) ledger.nextSecretSequence = 1;
    if (!Number.isInteger(ledger.nextDisclosureSequence) || ledger.nextDisclosureSequence < 1) ledger.nextDisclosureSequence = 1;
    if (!Number.isInteger(ledger.nextMechanicalReviewSequence) || ledger.nextMechanicalReviewSequence < 1) ledger.nextMechanicalReviewSequence = 1;
    if (!Number.isInteger(ledger.nextDeliverySequence) || ledger.nextDeliverySequence < 1) ledger.nextDeliverySequence = 1;
    if (!Number.isInteger(ledger.nextConsequenceSequence) || ledger.nextConsequenceSequence < 1) ledger.nextConsequenceSequence = 1;
    if (!ledger.secrets || typeof ledger.secrets !== 'object' || Array.isArray(ledger.secrets)) ledger.secrets = {};
    if (!ledger.deliveryObligations || typeof ledger.deliveryObligations !== 'object'
        || Array.isArray(ledger.deliveryObligations)) ledger.deliveryObligations = {};
    if (!ledger.consequenceCandidates || typeof ledger.consequenceCandidates !== 'object'
        || Array.isArray(ledger.consequenceCandidates)) ledger.consequenceCandidates = {};
    if (!ledger.diagnostics || typeof ledger.diagnostics !== 'object') ledger.diagnostics = {};
    for (const [key, value] of Object.entries({
        secretsShared: 0, disclosures: 0, unauthorizedDisclosures: 0,
        leaksDiscovered: 0, betrayalsApplied: 0,
        mechanicalPreflights: 0, mechanicalBlocked: 0,
        deliveriesCreated: 0, deliveriesKept: 0, deliveriesBroken: 0,
        consequenceCandidatesCreated: 0
    })) {
        if (!Number.isFinite(Number(ledger.diagnostics[key]))) ledger.diagnostics[key] = value;
    }
    for (const caseRow of Object.values(ledger.cases || {})) {
        if (!Array.isArray(caseRow.mechanicalReviews)) caseRow.mechanicalReviews = [];
        if (!caseRow.mechanicalGrounding && typeof storyConversationSessionGet === 'function') {
            const session = storyConversationSessionGet(caseRow.sourceSessionId);
            if (session && session.candidate
                && storyNegotiationHash(session.candidate) === caseRow.sourceCandidateHash) {
                caseRow.mechanicalGrounding = storyNegotiationMechanicalGrounding(session.candidate);
            }
        }
    }
    for (const obligation of Object.values(ledger.deliveryObligations)) {
        if (!Number.isInteger(obligation.penaltyAttempts) || obligation.penaltyAttempts < 0) {
            obligation.penaltyAttempts = 0;
        }
        if (obligation.nextPenaltyRetryAt === undefined) obligation.nextPenaltyRetryAt = null;
    }
    for (const consequence of Object.values(ledger.consequenceCandidates)) {
        const review = consequence && consequence.diplomaticReview;
        if (!review || review.damageAssessment) continue;
        const receiptIds = new Set(review.verifiedBreachReceiptIds || []);
        const deliveries = Object.values(ledger.deliveryObligations)
            .filter(row => receiptIds.has(row.id) && row.status === 'BROKEN');
        review.damageAssessment = storyNegotiationDamageAssessment(deliveries);
        review.verifiedEconomicDamage = review.damageAssessment.totals.uncompensatedDamage;
        if (review.thresholds) review.thresholds.damagePassed = review.verifiedEconomicDamage
            >= Number(review.thresholds.warVerifiedDamageMinimum || 250);
    }
    return ledger;
}

function storyNegotiationEnsure() {
    if (!storyNegotiationEnabled()) return null;
    if (!STORY.negotiations || STORY.negotiations.schemaVersion !== STORY_NEGOTIATION_SCHEMA_VERSION) {
        STORY.negotiations = storyNegotiationLedgerCreate();
    }
    return storyNegotiationLedgerMigrate(STORY.negotiations);
}

function storyNegotiationReset() {
    STORY.negotiations = storyNegotiationEnabled() ? storyNegotiationLedgerCreate() : null;
    return storyNegotiationSnapshot();
}

function storyNegotiationCaseBySession(sessionId) {
    const ledger = storyNegotiationEnsure();
    return storyNegotiationClone(ledger && Object.values(ledger.cases)
        .find(row => row.sourceSessionId === String(sessionId)) || null);
}

function storyNegotiationCaseGet(caseId) {
    const ledger = storyNegotiationEnsure();
    return storyNegotiationClone(ledger && ledger.cases[String(caseId)] || null);
}

function storyNegotiationCaseList(actorId) {
    const ledger = storyNegotiationEnsure();
    const actor = actorId == null ? null : String(actorId);
    return Object.values(ledger && ledger.cases || {})
        .filter(row => !actor || row.partyActorIds.includes(actor))
        .sort((a, b) => Number(b.sequence) - Number(a.sequence))
        .map(storyNegotiationClone);
}

function storyNegotiationTerms(candidate) {
    const terms = {};
    for (const key of STORY_NEGOTIATION_TERM_KEYS) {
        const value = candidate && candidate.terms && candidate.terms[key];
        if (value && Number.isFinite(Number(value.amount)) && Number(value.amount) > 0) {
            const unit = String(value.unit || value.type || '').trim();
            if (unit) terms[key] = { amount: Number(value.amount), unit: unit.slice(0, 32) };
        }
    }
    return terms;
}

function storyNegotiationMechanicalGrounding(candidate) {
    const body = {
        schemaVersion: 1,
        adapterVersion: 'story-negotiation-mechanical-grounding-1',
        sourceCandidateHash: storyNegotiationHash(candidate || {}),
        entities: storyNegotiationClone(candidate && candidate.entities || []),
        requests: storyNegotiationClone(candidate && candidate.requests || []),
        claims: storyNegotiationClone(candidate && candidate.claims || []),
        domainReviewId: candidate && candidate.domainReviewId || null
    };
    body.contentHash = storyNegotiationHash(body);
    return body;
}

function storyNegotiationDeliverySchedule(term, startAt) {
    const amount = Number(term && term.amount);
    const unit = String(term && term.unit || '').toUpperCase();
    const calendar = typeof STORY_CALENDAR !== 'undefined' ? STORY_CALENDAR : null;
    if (!Number.isFinite(amount) || amount <= 0 || !calendar) {
        return { ok: false, code: 'DELIVERY_SCHEDULE_INVALID' };
    }
    const secondsPerDay = Number(calendar.secondsPerYear) / Number(calendar.daysPerYear);
    const durationSeconds = unit === 'DAY' ? amount * secondsPerDay
        : unit === 'MONTH' ? amount * Number(calendar.daysPerMonth) * secondsPerDay : NaN;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        return { ok: false, code: 'DELIVERY_SCHEDULE_UNIT_UNSUPPORTED', unit };
    }
    const createdAt = Number.isFinite(Number(startAt)) ? Number(startAt) : (Number(STORY.clock) || 0);
    return {
        ok: true,
        code: 'DELIVERY_SCHEDULE_RESOLVED',
        amount,
        unit,
        durationSeconds: Number(durationSeconds.toFixed(9)),
        dueAt: Number((createdAt + durationSeconds).toFixed(9)),
        calendarScale: { secondsPerYear: calendar.secondsPerYear, daysPerYear: calendar.daysPerYear }
    };
}

function storyNegotiationPenaltyQuote(paymentTerm, penaltyTerm) {
    const payment = Number(paymentTerm && paymentTerm.amount);
    const amount = Number(penaltyTerm && penaltyTerm.amount);
    const unit = String(penaltyTerm && penaltyTerm.unit || '').toUpperCase();
    if (!Number.isFinite(payment) || payment <= 0 || !Number.isFinite(amount) || amount <= 0) {
        return { ok: false, code: 'CONTRACT_PENALTY_INVALID' };
    }
    const value = unit === 'PERCENT' ? payment * amount / 100
        : ['CAPITAL', 'CURRENCY_UNIT'].includes(unit) ? amount : NaN;
    if (!Number.isFinite(value) || value <= 0) {
        return { ok: false, code: 'CONTRACT_PENALTY_UNIT_UNSUPPORTED', unit };
    }
    return { ok: true, code: 'CONTRACT_PENALTY_QUOTED', amount: Number(value.toFixed(6)),
        unit: 'capital', sourceAmount: amount, sourceUnit: unit, paymentAmount: payment };
}

function storyNegotiationVersion(caseRow, proposerActorId, terms, source, supersedesVersionId) {
    const number = caseRow.versions.length + 1;
    const body = {
        caseId: caseRow.id, number, proposerActorId, terms,
        concessions: storyNegotiationClone(source && source.concessions || {}),
        evidenceSubmissionIds: storyNegotiationClone(source && source.evidenceSubmissionIds || []),
        supersedesVersionId: supersedesVersionId || null
    };
    return Object.assign(body, {
        schemaVersion: 1,
        id: `${caseRow.id}:version:${number}`,
        createdAt: Number(STORY.clock) || 0,
        contentHash: storyNegotiationHash(body),
        acceptedByActorIds: [String(proposerActorId)],
        status: 'PROPOSED',
        executable: false,
        worldMutation: false
    });
}

function storyNegotiationPartyApprovals(caseRow, acceptedActorIds) {
    const accepted = new Set((acceptedActorIds || []).map(String));
    return caseRow.partyActorIds.map(actorId => ({
        id: `party-acceptance:${actorId}`,
        kind: 'PARTY_ACCEPTANCE', actorId,
        status: accepted.has(actorId) ? 'APPROVED' : 'PENDING',
        approvedAt: accepted.has(actorId) ? (Number(STORY.clock) || 0) : null
    })).concat([{
        id: 'mechanical-contract-authority',
        kind: 'MECHANICAL_CONTRACT_AUTHORITY', actorId: null,
        ownerSystem: 'PHASE_38_3_EXECUTION_NOT_IMPLEMENTED',
        status: 'PENDING', approvedAt: null
    }]);
}

function storyNegotiationCaseOpen(sessionId) {
    const ledger = storyNegotiationEnsure();
    if (!ledger) return { ok: false, code: 'FEATURE_DISABLED', worldMutation: false };
    const session = typeof storyConversationSessionGet === 'function'
        ? storyConversationSessionGet(sessionId) : null;
    if (!session) return { ok: false, code: 'SESSION_NOT_FOUND', worldMutation: false };
    if (session.status !== 'READY_FOR_NEGOTIATION' || !session.candidate
        || session.candidate.executable !== false || session.candidate.worldMutation !== false) {
        ledger.diagnostics.rejectedMutations++;
        return { ok: false, code: 'SESSION_NOT_READY', worldMutation: false };
    }
    const existing = Object.values(ledger.cases).find(row => row.sourceSessionId === session.id);
    if (existing) return { ok: true, code: 'CASE_EXISTS', case: storyNegotiationClone(existing), worldMutation: false };
    const sequence = ledger.nextCaseSequence++;
    const caseRow = {
        schemaVersion: STORY_NEGOTIATION_SCHEMA_VERSION,
        id: `negotiation-case:${sequence}`,
        sequence,
        sourceSessionId: session.id,
        sourceCandidateHash: storyNegotiationHash(session.candidate),
        topic: String(session.candidate.kind || 'CONVERSATION_NEGOTIATION'),
        partyActorIds: [String(session.playerActorId), String(session.listenerActorId)],
        mechanicalGrounding: storyNegotiationMechanicalGrounding(session.candidate),
        mechanicalReviews: [],
        createdAt: Number(STORY.clock) || 0,
        updatedAt: Number(STORY.clock) || 0,
        currentVersionId: null,
        versions: [],
        requiredApprovals: [],
        status: 'DRAFT',
        execution: { status: 'NOT_AUTHORIZED', receiptId: null },
        executable: false,
        worldMutation: false
    };
    const version = storyNegotiationVersion(caseRow, session.playerActorId,
        storyNegotiationTerms(session.candidate), session.candidate, null);
    if (!STORY_NEGOTIATION_TERM_KEYS.every(key => version.terms[key])) {
        ledger.diagnostics.rejectedMutations++;
        return { ok: false, code: 'INCOMPLETE_NEGOTIATION_TERMS', worldMutation: false };
    }
    caseRow.versions.push(version);
    caseRow.currentVersionId = version.id;
    caseRow.requiredApprovals = storyNegotiationPartyApprovals(caseRow, version.acceptedByActorIds);
    ledger.cases[caseRow.id] = caseRow;
    ledger.diagnostics.opened++;
    ledger.diagnostics.versionsCreated++;
    const ids = Object.keys(ledger.cases).sort((a, b) => ledger.cases[a].sequence - ledger.cases[b].sequence);
    while (ids.length > STORY_NEGOTIATION_CASE_LIMIT) {
        delete ledger.cases[ids.shift()];
        ledger.diagnostics.prunedCases++;
    }
    return { ok: true, code: 'CASE_OPENED', case: storyNegotiationClone(caseRow), worldMutation: false };
}

function storyNegotiationPatchTerms(currentTerms, patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return { ok: false, code: 'INVALID_PATCH' };
    const unknown = Object.keys(patch).filter(key => !STORY_NEGOTIATION_TERM_KEYS.includes(key));
    if (unknown.length) return { ok: false, code: 'UNKNOWN_TERM', unknown };
    const terms = storyNegotiationClone(currentTerms || {});
    for (const key of Object.keys(patch)) {
        const value = patch[key];
        if (!value || !Number.isFinite(Number(value.amount)) || Number(value.amount) <= 0
            || Number(value.amount) > 1000000 || !String(value.unit || '').trim()) {
            return { ok: false, code: 'INVALID_TERM', term: key };
        }
        terms[key] = { amount: Number(value.amount), unit: String(value.unit).slice(0, 32) };
    }
    return { ok: true, terms };
}

function storyNegotiationCaseCounter(caseId, proposerActorId, patch) {
    const ledger = storyNegotiationEnsure();
    const caseRow = ledger && ledger.cases[String(caseId)];
    if (!caseRow) return { ok: false, code: 'CASE_NOT_FOUND', worldMutation: false };
    const proposer = String(proposerActorId || '');
    if (!caseRow.partyActorIds.includes(proposer)) return { ok: false, code: 'NOT_A_PARTY', worldMutation: false };
    if (!['DRAFT', 'COUNTERED', 'ACCEPTED_PENDING_APPROVAL'].includes(caseRow.status)) {
        return { ok: false, code: 'CASE_CLOSED', worldMutation: false };
    }
    if (caseRow.versions.length >= STORY_NEGOTIATION_VERSION_LIMIT) return { ok: false, code: 'VERSION_LIMIT', worldMutation: false };
    const current = caseRow.versions.find(row => row.id === caseRow.currentVersionId);
    const patched = storyNegotiationPatchTerms(current && current.terms, patch);
    if (!patched.ok) {
        ledger.diagnostics.rejectedMutations++;
        return { ok: false, code: patched.code, worldMutation: false };
    }
    if (storyNegotiationHash(patched.terms) === storyNegotiationHash(current.terms)) {
        return { ok: false, code: 'NO_TERM_CHANGE', worldMutation: false };
    }
    current.status = 'SUPERSEDED';
    const version = storyNegotiationVersion(caseRow, proposer, patched.terms, current, current.id);
    caseRow.versions.push(version);
    caseRow.currentVersionId = version.id;
    caseRow.requiredApprovals = storyNegotiationPartyApprovals(caseRow, version.acceptedByActorIds);
    caseRow.status = 'COUNTERED';
    caseRow.execution = { status: 'NOT_AUTHORIZED', receiptId: null };
    caseRow.updatedAt = Number(STORY.clock) || 0;
    ledger.diagnostics.versionsCreated++;
    storyNegotiationResolveCounterOfferPromises(caseRow, version);
    return { ok: true, code: 'COUNTER_VERSION_CREATED', case: storyNegotiationClone(caseRow),
        version: storyNegotiationClone(version), worldMutation: false };
}

function storyNegotiationEvent(ledger, input) {
    const row = Object.assign({
        schemaVersion: 1,
        id: `negotiation-event:${storyNegotiationHash([
            input.kind, input.caseId, input.commitmentId, input.secretId, input.disclosureId,
            input.actorId, input.recipientActorId, Number(STORY.clock) || 0, ledger.events.length
        ].join('|')).slice(9)}`,
        at: Number(STORY.clock) || 0
    }, storyNegotiationClone(input || {}));
    ledger.events.push(row);
    if (ledger.events.length > STORY_NEGOTIATION_EVENT_LIMIT) {
        const remove = ledger.events.length - STORY_NEGOTIATION_EVENT_LIMIT;
        ledger.events.splice(0, remove);
        ledger.diagnostics.prunedEvents += remove;
    }
    return row;
}

function storyNegotiationCommitmentMemoryId(commitment) {
    return `character-memory:negotiation-promise:${String(commitment.id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function storyNegotiationPromiseCreate(caseId, promisorActorId, obligationCode, dueInSeconds) {
    const ledger = storyNegotiationEnsure();
    const caseRow = ledger && ledger.cases[String(caseId)];
    if (!caseRow) return { ok: false, code: 'CASE_NOT_FOUND', worldMutation: false };
    const promisor = String(promisorActorId || '');
    if (!caseRow.partyActorIds.includes(promisor)) return { ok: false, code: 'NOT_A_PARTY', worldMutation: false };
    const obligation = String(obligationCode || '');
    if (!STORY_NEGOTIATION_OBLIGATIONS.includes(obligation)) {
        return { ok: false, code: 'UNKNOWN_OBLIGATION', worldMutation: false };
    }
    const seconds = Number(dueInSeconds);
    if (!Number.isFinite(seconds) || seconds < 5 || seconds > 86400) {
        return { ok: false, code: 'INVALID_DEADLINE', worldMutation: false };
    }
    const openDuplicate = Object.values(ledger.commitments).find(row => row.caseId === caseRow.id
        && row.promisorActorId === promisor && row.obligationCode === obligation && row.status === 'OPEN');
    if (openDuplicate) return { ok: true, code: 'PROMISE_EXISTS', commitment: storyNegotiationClone(openDuplicate), worldMutation: false };
    if (Object.keys(ledger.commitments).length >= STORY_NEGOTIATION_COMMITMENT_LIMIT) {
        return { ok: false, code: 'COMMITMENT_LIMIT', worldMutation: false };
    }
    const sequence = ledger.nextCommitmentSequence++;
    const promisee = caseRow.partyActorIds.find(id => id !== promisor);
    const current = caseRow.versions.find(row => row.id === caseRow.currentVersionId);
    const commitment = {
        schemaVersion: 1,
        id: `negotiation-commitment:${sequence}`,
        sequence,
        caseId: caseRow.id,
        sourceVersionId: caseRow.currentVersionId,
        sourceVersionNumber: current && current.number || 0,
        promisorActorId: promisor,
        promiseeActorId: promisee,
        obligationCode: obligation,
        createdAt: Number(STORY.clock) || 0,
        dueAt: (Number(STORY.clock) || 0) + seconds,
        status: 'OPEN',
        resolvedAt: null,
        resolutionEventId: null,
        memoryMilestoneId: null,
        effectsApplied: false,
        worldMutation: false
    };
    const memory = typeof storyMemoryRecordPromise === 'function'
        ? storyMemoryRecordPromise({
            subjectActorId: promisor,
            relatedActorId: promisee,
            talkTemplateId: `negotiation:${caseRow.id}:${commitment.id}`,
            summary: obligation === 'PROVIDE_COUNTER_OFFER'
                ? 'Güncel müzakere vakasına süre içinde karşı teklif sunma sözü verildi.'
                : 'Mekanik sözleşme onayını süre içinde sağlama sözü verildi.',
            dueAt: commitment.dueAt,
            source: { type: 'NEGOTIATION_COMMITMENT', negotiationCaseId: caseRow.id,
                commitmentId: commitment.id, sourceVersionId: commitment.sourceVersionId }
        }) : null;
    commitment.memoryMilestoneId = memory && memory.milestone && memory.milestone.id
        || storyNegotiationCommitmentMemoryId(commitment);
    ledger.commitments[commitment.id] = commitment;
    ledger.diagnostics.promisesCreated++;
    storyNegotiationEvent(ledger, { kind: 'PROMISE_CREATED', caseId: caseRow.id,
        commitmentId: commitment.id, actorId: promisor, worldMutation: false });
    return { ok: true, code: 'PROMISE_CREATED', commitment: storyNegotiationClone(commitment),
        memoryApplied: !!(memory && memory.applied), worldMutation: false };
}

function storyNegotiationPromiseEffects(commitment, kept) {
    if (commitment.effectsApplied) return { applied: false, duplicate: true };
    const deltas = kept
        ? { trustBps: 250, respectBps: 150, hostilityBps: -100, debtBps: 120 }
        : { trustBps: -600, respectBps: -250, hostilityBps: 350, debtBps: 0 };
    const relationship = typeof storyRelationshipAdjust === 'function'
        ? storyRelationshipAdjust(commitment.promiseeActorId, commitment.promisorActorId, deltas, {
            source: 'negotiation.promise',
            reason: kept ? 'PROMISE_KEPT' : 'PROMISE_BROKEN',
            sourceReceiptId: commitment.id,
            debtSummary: kept ? 'Tutulan müzakere sözü karşı tarafta sınırlı kişisel borç doğurdu.' : null
        }) : { applied: false, reason: 'RELATIONSHIP_EXECUTOR_MISSING' };
    const memory = typeof storyMemoryResolveMilestone === 'function'
        ? storyMemoryResolveMilestone(commitment.memoryMilestoneId, kept ? 'KEPT' : 'BROKEN')
        : { applied: false, reason: 'MEMORY_EXECUTOR_MISSING' };
    commitment.effectsApplied = !!relationship.applied;
    return { applied: !!relationship.applied, relationship, memory };
}

// Söz sonucu doğrudan savaş, antlaşma veya para yazmaz. Yalnız mevcut gerçek
// sonuca dayalı, sonraki domainin inceleyebileceği kapalı adayları üretir.
// Özellikle ticari bir ihlal, diplomasi yürütücüsü olmadan casus belli değildir.
function storyNegotiationPromiseConsequenceCandidate(commitment, kept) {
    const ledger = storyNegotiationEnsure();
    if (!ledger || !commitment) return { applied: false, reason: 'NEGOTIATION_DISABLED' };
    const existing = Object.values(ledger.consequenceCandidates || {})
        .find(row => row.sourceCommitmentId === commitment.id);
    if (existing) return { applied: false, duplicate: true, candidate: storyNegotiationClone(existing) };
    if (Object.keys(ledger.consequenceCandidates).length >= STORY_NEGOTIATION_CONSEQUENCE_LIMIT) {
        return { applied: false, reason: 'CONSEQUENCE_LIMIT' };
    }
    const caseRow = ledger.cases[commitment.caseId];
    if (!caseRow) return { applied: false, reason: 'CASE_NOT_FOUND' };
    const identity = actorId => typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(actorId) : null;
    const promisor = identity(commitment.promisorActorId);
    const promisee = identity(commitment.promiseeActorId);
    const countryIds = [promisor && promisor.countryId, promisee && promisee.countryId]
        .filter(Boolean).map(String);
    const crossBorder = countryIds.length === 2 && countryIds[0] !== countryIds[1];
    const sequence = ledger.nextConsequenceSequence++;
    const nextStepCodes = kept
        ? ['CONTINUE_NEGOTIATION', 'FORMALIZE_MECHANICAL_CONTRACT']
        : ['REQUEST_CURE', 'SUSPEND_NEGOTIATION'].concat(
            crossBorder ? ['DIPLOMATIC_PROTEST_REVIEW'] : []
        );
    const candidate = {
        schemaVersion: 1,
        id: `negotiation-consequence:${sequence}`,
        sequence,
        caseId: commitment.caseId,
        sourceCommitmentId: commitment.id,
        sourceResolutionEventId: commitment.resolutionEventId,
        triggerStatus: kept ? 'KEPT' : 'BROKEN',
        kind: kept ? 'COOPERATIVE_FOLLOW_UP' : 'COMMERCIAL_DISPUTE',
        promisorActorId: commitment.promisorActorId,
        promiseeActorId: commitment.promiseeActorId,
        partyCountryIds: Array.from(new Set(countryIds)).sort(),
        crossBorder,
        nextStepCodes,
        escalationReview: !kept && crossBorder ? 'DIPLOMATIC_INCIDENT_REVIEW' : 'NONE',
        diplomaticReview: null,
        warCandidate: null,
        peaceCandidate: null,
        status: 'OPEN',
        createdAt: Number(STORY.clock) || 0,
        executable: false,
        worldMutation: false,
        blockedReasons: !kept && crossBorder
            ? ['DIPLOMATIC_INCIDENT_EXECUTOR_MISSING'] : []
    };
    ledger.consequenceCandidates[candidate.id] = candidate;
    ledger.diagnostics.consequenceCandidatesCreated++;
    storyNegotiationEvent(ledger, {
        kind: 'PROMISE_CONSEQUENCE_CANDIDATE_CREATED', caseId: commitment.caseId,
        commitmentId: commitment.id, consequenceCandidateId: candidate.id,
        triggerStatus: candidate.triggerStatus, worldMutation: false
    });
    return { applied: true, candidate: storyNegotiationClone(candidate) };
}

function storyNegotiationCountryStateId(countryId) {
    const match = /^country:(-?\d+)$/.exec(String(countryId || ''));
    return match ? Number(match[1]) : null;
}

// Ticari bir söz ihlali savaş sebebi değildir. Bu inceleme yalnız kanonik
// söz/olay/ilişki/antlaşma kayıtlarından açıklanabilir bir diplomatik dosya
// üretir. Doğrulanmış maddi zarar yoksa savaş adayı özellikle kapalı kalır.
function storyNegotiationDiplomaticIncidentReview(candidateId, requestedByActorId) {
    const ledger = storyNegotiationEnsure();
    const candidate = ledger && ledger.consequenceCandidates[String(candidateId || '')];
    if (!candidate) return { ok: false, code: 'CONSEQUENCE_NOT_FOUND', worldMutation: false };
    if (candidate.diplomaticReview) {
        return { ok: true, code: 'DIPLOMATIC_REVIEW_EXISTS', duplicate: true,
            review: storyNegotiationClone(candidate.diplomaticReview), worldMutation: false };
    }
    const requester = String(requestedByActorId || '');
    if (requester !== candidate.promiseeActorId) {
        return { ok: false, code: 'INJURED_PARTY_STANDING_REQUIRED', worldMutation: false };
    }
    const commitment = ledger.commitments[candidate.sourceCommitmentId];
    const sourceEvent = (ledger.events || []).find(row => row.id === candidate.sourceResolutionEventId);
    const countryStateIds = (candidate.partyCountryIds || []).map(storyNegotiationCountryStateId)
        .filter(Number.isInteger);
    const treaty = countryStateIds.length === 2 && typeof storyTreaty === 'function'
        ? storyTreaty(countryStateIds[0], countryStateIds[1]) : null;
    const stateRelation = countryStateIds.length === 2 && typeof storyRelValue === 'function'
        ? storyRelValue(countryStateIds[0], countryStateIds[1]) : null;
    const actorRelation = typeof storyRelationshipView === 'function'
        ? storyRelationshipView(candidate.promiseeActorId, candidate.promisorActorId) : null;
    const matchingBrokenDeliveries = Object.values(ledger.deliveryObligations || {}).filter(row =>
        row.caseId === candidate.caseId && row.status === 'BROKEN'
        && Array.isArray(row.penaltyTransactionIds) && row.penaltyTransactionIds.length > 0);
    // Escrow iadesi ve ceza ödemesi kayda girdiyse teslimat ihlali gerçektir.
    // Ceza alıcının tazminatıdır, zarar değildir; iade edilmiş anapara da kayıp
    // yazılamaz. Fırsat/üretim kaybı ayrı makbuz olmadan yalnız ölçülmemiş iddia
    // olarak kalır ve savaş eşiğine girmez.
    const verifiedBreachReceiptIds = matchingBrokenDeliveries.map(row => row.id).sort();
    const damageAssessment = storyNegotiationDamageAssessment(matchingBrokenDeliveries);
    const verifiedEconomicDamage = damageAssessment.totals.uncompensatedDamage;
    const legalStanding = !!commitment && commitment.status === 'BROKEN'
        && !!sourceEvent && sourceEvent.kind === 'PROMISE_BROKEN'
        && candidate.triggerStatus === 'BROKEN' && candidate.crossBorder === true;
    const protestEligible = legalStanding;
    const hostileThreshold = Number.isFinite(stateRelation) && stateRelation <= -60;
    const damageThreshold = verifiedEconomicDamage >= 250;
    const lawfulWarRoute = countryStateIds.length === 2 && treaty && treaty !== 'war'
        && typeof storyInstitutionCountryView === 'function'
        && countryStateIds.some(id => {
            const country = storyInstitutionCountryView(`country:${id}`);
            const route = country && country.authorityByAction && country.authorityByAction.DECLARE_WAR;
            return route && route.mode !== 'PROHIBITED' && route.mode !== 'EXTERNAL_DOMAIN';
        });
    const review = {
        schemaVersion: 1,
        id: `diplomatic-review:${candidate.sequence}`,
        consequenceCandidateId: candidate.id,
        requestedByActorId: requester,
        reviewedAt: Number(STORY.clock) || 0,
        evidenceIds: [candidate.sourceResolutionEventId, candidate.sourceCommitmentId]
            .concat(verifiedBreachReceiptIds).filter(Boolean),
        legalStanding,
        protestEligible,
        requiresStateAuthority: protestEligible,
        treatyAtReview: treaty,
        stateRelationAtReview: stateRelation,
        actorRelationshipAtReview: actorRelation ? {
            trustBps: actorRelation.trustBps,
            respectBps: actorRelation.respectBps,
            hostilityBps: actorRelation.hostilityBps,
            debtBps: actorRelation.debtBps
        } : null,
        verifiedBreachReceiptIds,
        damageAssessment,
        verifiedEconomicDamage,
        thresholds: {
            warVerifiedDamageMinimum: 250,
            warStateRelationMaximum: -60,
            damagePassed: damageThreshold,
            hostilityPassed: hostileThreshold,
            lawfulWarRoute: !!lawfulWarRoute
        },
        protestCandidate: protestEligible ? {
            kind: 'DIPLOMATIC_PROTEST', status: 'AWAITING_STATE_AUTHORITY', executable: false
        } : null,
        warCandidate: legalStanding && damageThreshold && hostileThreshold && lawfulWarRoute
            ? { kind: 'DECLARE_WAR_REVIEW', status: 'AWAITING_CONSTITUTIONAL_AUTHORITY', executable: false }
            : null,
        peaceCandidate: null,
        executable: false,
        worldMutation: false,
        blockedReasons: [
            !legalStanding ? 'LEGAL_STANDING_FAILED' : null,
            !damageThreshold ? 'VERIFIED_ECONOMIC_DAMAGE_BELOW_WAR_THRESHOLD' : null,
            !hostileThreshold ? 'STATE_RELATION_NOT_HOSTILE_ENOUGH_FOR_WAR_REVIEW' : null,
            !lawfulWarRoute ? 'LAWFUL_WAR_ROUTE_NOT_VERIFIED' : null
        ].filter(Boolean)
    };
    candidate.diplomaticReview = review;
    candidate.status = 'REVIEWED';
    candidate.blockedReasons = review.blockedReasons.slice();
    candidate.warCandidate = review.warCandidate;
    candidate.peaceCandidate = null;
    storyNegotiationEvent(ledger, {
        kind: 'DIPLOMATIC_INCIDENT_REVIEWED', caseId: candidate.caseId,
        consequenceCandidateId: candidate.id, requestedByActorId: requester,
        protestEligible, warCandidate: !!review.warCandidate, worldMutation: false
    });
    return { ok: true, code: protestEligible ? 'DIPLOMATIC_PROTEST_AUTHORITY_REQUIRED'
        : 'DIPLOMATIC_INCIDENT_REVIEW_BLOCKED', duplicate: false,
        review: storyNegotiationClone(review), worldMutation: false };
}

// Zarar gören özel aktör dosyayı açabilir fakat devlet adına protesto
// yayımlayamaz. Yalnız Faz 29 kurum defterinde tamamlanmış, doğru devlete ait
// ve henüz tüketilmemiş bir yetki fişi bu etkiyi açar. Protesto savaş veya
// antlaşma değişikliği değildir.
function storyNegotiationDiplomaticProtestExecute(candidateId, authorityRequestId) {
    const ledger = storyNegotiationEnsure();
    const candidate = ledger && ledger.consequenceCandidates[String(candidateId || '')];
    if (!candidate || !candidate.diplomaticReview) {
        return { ok: false, code: 'DIPLOMATIC_REVIEW_REQUIRED', worldMutation: false };
    }
    const review = candidate.diplomaticReview;
    if (!review.protestEligible || !review.protestCandidate) {
        return { ok: false, code: 'DIPLOMATIC_PROTEST_NOT_ELIGIBLE', worldMutation: false };
    }
    const requestId = String(authorityRequestId || '');
    if (review.protestExecution) {
        const same = review.protestExecution.authorityRequestId === requestId;
        return same
            ? { ok: true, code: 'DIPLOMATIC_PROTEST_ALREADY_ISSUED', duplicate: true,
                execution: storyNegotiationClone(review.protestExecution), worldMutation: false }
            : { ok: false, code: 'DIPLOMATIC_PROTEST_ALREADY_ISSUED', worldMutation: false };
    }
    const institutionLedger = STORY.institutions;
    const request = institutionLedger && institutionLedger.requests
        && institutionLedger.requests[requestId];
    if (!request || request.actionType !== 'ISSUE_DIPLOMATIC_PROTEST') {
        return { ok: false, code: 'STATE_PROTEST_AUTHORITY_REQUIRED', worldMutation: false };
    }
    if (request.status !== 'EXECUTED') {
        return { ok: false, code: 'STATE_PROTEST_AUTHORITY_NOT_EXECUTED', worldMutation: false };
    }
    const alreadyConsumed = Object.values(ledger.consequenceCandidates || {}).some(row =>
        row && row.diplomaticReview && row.diplomaticReview.protestExecution
        && row.diplomaticReview.protestExecution.authorityRequestId === requestId);
    if (alreadyConsumed) {
        return { ok: false, code: 'STATE_PROTEST_AUTHORITY_ALREADY_CONSUMED', worldMutation: false };
    }
    const injuredActor = typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(candidate.promiseeActorId) : null;
    const accusedActor = typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(candidate.promisorActorId) : null;
    if (!injuredActor || !accusedActor || injuredActor.countryId === accusedActor.countryId) {
        return { ok: false, code: 'CROSS_BORDER_STATE_PARTIES_REQUIRED', worldMutation: false };
    }
    if (request.countryId !== injuredActor.countryId) {
        return { ok: false, code: 'INJURED_STATE_AUTHORITY_REQUIRED', worldMutation: false };
    }
    const injuredStateId = storyNegotiationCountryStateId(injuredActor.countryId);
    const accusedStateId = storyNegotiationCountryStateId(accusedActor.countryId);
    if (!Number.isInteger(injuredStateId) || !Number.isInteger(accusedStateId)) {
        return { ok: false, code: 'STATE_IDENTITY_INVALID', worldMutation: false };
    }
    const treatyBefore = typeof storyTreaty === 'function'
        ? storyTreaty(injuredStateId, accusedStateId) : null;
    const relationBefore = typeof storyRelValue === 'function'
        ? storyRelValue(injuredStateId, accusedStateId) : null;
    if (!Number.isFinite(relationBefore) || typeof storyRelAdd !== 'function') {
        return { ok: false, code: 'DIPLOMACY_RELATION_EXECUTOR_MISSING', worldMutation: false };
    }
    storyRelAdd(injuredStateId, accusedStateId, -6, {
        actor: { type: 'institution', id: request.executorInstitutionId },
        reason: 'diplomatic.protest.commercial_breach',
        idempotencyKey: `diplomatic-protest:${candidate.id}`,
        correlationId: review.id
    });
    const relationAfter = storyRelValue(injuredStateId, accusedStateId);
    const treatyAfter = storyTreaty(injuredStateId, accusedStateId);
    const execution = {
        schemaVersion: 1,
        id: `diplomatic-protest:${candidate.sequence}`,
        consequenceCandidateId: candidate.id,
        diplomaticReviewId: review.id,
        authorityRequestId: requestId,
        issuingCountryId: injuredActor.countryId,
        targetCountryId: accusedActor.countryId,
        executedByInstitutionId: request.executorInstitutionId,
        issuedAt: Number(STORY.clock) || 0,
        relationBefore,
        relationAfter,
        relationDelta: relationAfter - relationBefore,
        treatyBefore,
        treatyAfter,
        warMutation: false,
        treatyMutation: treatyBefore !== treatyAfter
    };
    review.protestExecution = execution;
    review.protestCandidate.status = 'ISSUED';
    review.protestCandidate.executable = false;
    review.requiresStateAuthority = false;
    storyNegotiationEvent(ledger, {
        kind: 'DIPLOMATIC_PROTEST_ISSUED', caseId: candidate.caseId,
        consequenceCandidateId: candidate.id, diplomaticReviewId: review.id,
        authorityRequestId: requestId, issuingCountryId: injuredActor.countryId,
        targetCountryId: accusedActor.countryId, relationDelta: execution.relationDelta,
        treatyMutation: execution.treatyMutation, warMutation: false, worldMutation: true
    });
    return { ok: true, code: 'DIPLOMATIC_PROTEST_ISSUED', duplicate: false,
        execution: storyNegotiationClone(execution), worldMutation: true };
}

function storyNegotiationDiplomaticStateParties(candidate) {
    const injuredActor = typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(candidate && candidate.promiseeActorId) : null;
    const accusedActor = typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(candidate && candidate.promisorActorId) : null;
    const injuredStateId = storyNegotiationCountryStateId(injuredActor && injuredActor.countryId);
    const accusedStateId = storyNegotiationCountryStateId(accusedActor && accusedActor.countryId);
    return injuredActor && accusedActor && injuredActor.countryId !== accusedActor.countryId
        && Number.isInteger(injuredStateId) && Number.isInteger(accusedStateId)
        ? { injuredActor, accusedActor, injuredStateId, accusedStateId } : null;
}

function storyNegotiationAuthorityConsumed(ledger, requestId) {
    const id = String(requestId || '');
    return Object.values(ledger && ledger.consequenceCandidates || {}).some(row => {
        const review = row && row.diplomaticReview;
        if (!review) return false;
        if (review.protestExecution && review.protestExecution.authorityRequestId === id) return true;
        if (review.warExecution && review.warExecution.authorityRequestId === id) return true;
        return !!(review.peaceExecution && Array.isArray(review.peaceExecution.authorityRequestIds)
            && review.peaceExecution.authorityRequestIds.includes(id));
    });
}

function storyNegotiationConstitutionalWarExecute(candidateId, authorityRequestId) {
    const ledger = storyNegotiationEnsure();
    const candidate = ledger && ledger.consequenceCandidates[String(candidateId || '')];
    const review = candidate && candidate.diplomaticReview;
    if (!review || !review.warCandidate) {
        return { ok: false, code: 'WAR_REVIEW_THRESHOLDS_NOT_MET', worldMutation: false };
    }
    const requestId = String(authorityRequestId || '');
    if (review.warExecution) {
        return review.warExecution.authorityRequestId === requestId
            ? { ok: true, code: 'WAR_ALREADY_DECLARED', duplicate: true,
                execution: storyNegotiationClone(review.warExecution), worldMutation: false }
            : { ok: false, code: 'WAR_ALREADY_DECLARED', worldMutation: false };
    }
    const request = STORY.institutions && STORY.institutions.requests
        && STORY.institutions.requests[requestId];
    if (!request || request.actionType !== 'DECLARE_WAR') {
        return { ok: false, code: 'DECLARE_WAR_AUTHORITY_REQUIRED', worldMutation: false };
    }
    if (request.status !== 'EXECUTED') {
        return { ok: false, code: 'DECLARE_WAR_AUTHORITY_NOT_EXECUTED', worldMutation: false };
    }
    const parties = storyNegotiationDiplomaticStateParties(candidate);
    if (!parties) return { ok: false, code: 'CROSS_BORDER_STATE_PARTIES_REQUIRED', worldMutation: false };
    if (request.countryId !== parties.injuredActor.countryId) {
        return { ok: false, code: 'INJURED_STATE_WAR_AUTHORITY_REQUIRED', worldMutation: false };
    }
    if (storyNegotiationAuthorityConsumed(ledger, requestId)) {
        return { ok: false, code: 'CONSTITUTIONAL_AUTHORITY_ALREADY_CONSUMED', worldMutation: false };
    }
    const currentRelation = storyRelValue(parties.injuredStateId, parties.accusedStateId);
    const damageMinimum = Number(review.thresholds && review.thresholds.warVerifiedDamageMinimum) || 250;
    const relationMaximum = Number(review.thresholds && review.thresholds.warStateRelationMaximum);
    if (Number(review.verifiedEconomicDamage) < damageMinimum) {
        return { ok: false, code: 'WAR_DAMAGE_THRESHOLD_STALE', worldMutation: false };
    }
    if (!Number.isFinite(currentRelation) || !Number.isFinite(relationMaximum)
        || currentRelation > relationMaximum) {
        return { ok: false, code: 'WAR_HOSTILITY_THRESHOLD_STALE', worldMutation: false };
    }
    const treatyBefore = storyTreaty(parties.injuredStateId, parties.accusedStateId);
    if (treatyBefore === 'war') {
        return { ok: false, code: 'STATES_ALREADY_AT_WAR', worldMutation: false };
    }
    storySetTreaty(parties.injuredStateId, parties.accusedStateId, 'war', 0, {
        actor: { type: 'institution', id: request.executorInstitutionId },
        reason: 'constitutional.declare_war',
        idempotencyKey: `constitutional-war:${candidate.id}`,
        correlationId: review.id
    });
    const treatyAfter = storyTreaty(parties.injuredStateId, parties.accusedStateId);
    const execution = {
        schemaVersion: 1,
        id: `constitutional-war:${candidate.sequence}`,
        consequenceCandidateId: candidate.id,
        authorityRequestId: requestId,
        declaringCountryId: parties.injuredActor.countryId,
        targetCountryId: parties.accusedActor.countryId,
        executedByInstitutionId: request.executorInstitutionId,
        executedAt: Number(STORY.clock) || 0,
        treatyBefore,
        treatyAfter,
        warMutation: treatyBefore !== treatyAfter && treatyAfter === 'war'
    };
    review.warExecution = execution;
    review.warCandidate.status = 'DECLARED';
    review.warCandidate.executable = false;
    review.peaceCandidate = {
        kind: 'NEGOTIATE_PEACE',
        status: 'AWAITING_BILATERAL_CONSTITUTIONAL_AUTHORITY',
        requiredCountryIds: [parties.injuredActor.countryId, parties.accusedActor.countryId].sort(),
        executable: false
    };
    candidate.warCandidate = storyNegotiationClone(review.warCandidate);
    candidate.peaceCandidate = storyNegotiationClone(review.peaceCandidate);
    storyNegotiationEvent(ledger, {
        kind: 'CONSTITUTIONAL_WAR_DECLARED', caseId: candidate.caseId,
        consequenceCandidateId: candidate.id, authorityRequestId: requestId,
        declaringCountryId: execution.declaringCountryId, targetCountryId: execution.targetCountryId,
        treatyBefore, treatyAfter, worldMutation: true
    });
    return { ok: true, code: 'CONSTITUTIONAL_WAR_DECLARED', duplicate: false,
        execution: storyNegotiationClone(execution), worldMutation: true };
}

function storyNegotiationConstitutionalPeaceExecute(candidateId, authorityRequestIds) {
    const ledger = storyNegotiationEnsure();
    const candidate = ledger && ledger.consequenceCandidates[String(candidateId || '')];
    const review = candidate && candidate.diplomaticReview;
    if (!review || !review.warExecution || !review.peaceCandidate) {
        return { ok: false, code: 'ACTIVE_WAR_REVIEW_REQUIRED', worldMutation: false };
    }
    const requestIds = Array.from(new Set((authorityRequestIds || []).map(String))).sort();
    if (review.peaceExecution) {
        return storyNegotiationHash(review.peaceExecution.authorityRequestIds) === storyNegotiationHash(requestIds)
            ? { ok: true, code: 'PEACE_ALREADY_SIGNED', duplicate: true,
                execution: storyNegotiationClone(review.peaceExecution), worldMutation: false }
            : { ok: false, code: 'PEACE_ALREADY_SIGNED', worldMutation: false };
    }
    const parties = storyNegotiationDiplomaticStateParties(candidate);
    if (!parties) return { ok: false, code: 'CROSS_BORDER_STATE_PARTIES_REQUIRED', worldMutation: false };
    const requiredCountryIds = [parties.injuredActor.countryId, parties.accusedActor.countryId].sort();
    const requests = requestIds.map(id => STORY.institutions && STORY.institutions.requests
        && STORY.institutions.requests[id]).filter(Boolean);
    if (requests.length !== 2 || requestIds.length !== 2
        || requests.some(row => row.actionType !== 'SIGN_TREATY')) {
        return { ok: false, code: 'BILATERAL_PEACE_AUTHORITY_REQUIRED', worldMutation: false };
    }
    if (requests.some(row => row.status !== 'EXECUTED')) {
        return { ok: false, code: 'BILATERAL_PEACE_AUTHORITY_NOT_EXECUTED', worldMutation: false };
    }
    const suppliedCountries = requests.map(row => row.countryId).sort();
    if (storyNegotiationHash(suppliedCountries) !== storyNegotiationHash(requiredCountryIds)) {
        return { ok: false, code: 'BOTH_BELLIGERENT_AUTHORITIES_REQUIRED', worldMutation: false };
    }
    if (requestIds.some(id => storyNegotiationAuthorityConsumed(ledger, id))) {
        return { ok: false, code: 'CONSTITUTIONAL_AUTHORITY_ALREADY_CONSUMED', worldMutation: false };
    }
    const treatyBefore = storyTreaty(parties.injuredStateId, parties.accusedStateId);
    if (treatyBefore !== 'war') {
        return { ok: false, code: 'STATES_NOT_AT_WAR', worldMutation: false };
    }
    storySetTreaty(parties.injuredStateId, parties.accusedStateId, 'peace', 0, {
        actor: { type: 'institutions', id: requestIds.join('+') },
        reason: 'constitutional.bilateral_peace',
        idempotencyKey: `constitutional-peace:${candidate.id}`,
        correlationId: review.id
    });
    const treatyAfter = storyTreaty(parties.injuredStateId, parties.accusedStateId);
    const execution = {
        schemaVersion: 1,
        id: `constitutional-peace:${candidate.sequence}`,
        consequenceCandidateId: candidate.id,
        authorityRequestIds: requestIds,
        signatoryCountryIds: suppliedCountries,
        executedAt: Number(STORY.clock) || 0,
        treatyBefore,
        treatyAfter,
        peaceMutation: treatyBefore === 'war' && treatyAfter === 'peace'
    };
    review.peaceExecution = execution;
    review.peaceCandidate.status = 'SIGNED';
    candidate.peaceCandidate = storyNegotiationClone(review.peaceCandidate);
    storyNegotiationEvent(ledger, {
        kind: 'BILATERAL_PEACE_SIGNED', caseId: candidate.caseId,
        consequenceCandidateId: candidate.id, authorityRequestIds: requestIds,
        signatoryCountryIds: suppliedCountries, treatyBefore, treatyAfter, worldMutation: true
    });
    return { ok: true, code: 'BILATERAL_PEACE_SIGNED', duplicate: false,
        execution: storyNegotiationClone(execution), worldMutation: true };
}

function storyNegotiationPromiseResolve(commitment, status, evidence) {
    const ledger = storyNegotiationEnsure();
    if (!ledger || !commitment || commitment.status !== 'OPEN') {
        return { ok: false, code: 'PROMISE_NOT_OPEN', worldMutation: false };
    }
    const kept = status === 'KEPT';
    commitment.status = kept ? 'KEPT' : 'BROKEN';
    commitment.resolvedAt = Number(STORY.clock) || 0;
    const event = storyNegotiationEvent(ledger, {
        kind: kept ? 'PROMISE_KEPT' : 'PROMISE_BROKEN',
        caseId: commitment.caseId,
        commitmentId: commitment.id,
        actorId: commitment.promisorActorId,
        evidence: storyNegotiationClone(evidence || {}),
        worldMutation: true
    });
    commitment.resolutionEventId = event.id;
    const effects = storyNegotiationPromiseEffects(commitment, kept);
    const consequence = storyNegotiationPromiseConsequenceCandidate(commitment, kept);
    commitment.consequenceCandidateId = consequence && consequence.candidate
        ? consequence.candidate.id : null;
    if (kept) ledger.diagnostics.promisesKept++;
    else ledger.diagnostics.promisesBroken++;
    return { ok: true, code: kept ? 'PROMISE_KEPT' : 'PROMISE_BROKEN',
        commitment: storyNegotiationClone(commitment), effects, consequence,
        worldMutation: !!effects.applied };
}

function storyNegotiationResolveCounterOfferPromises(caseRow, version) {
    const ledger = storyNegotiationEnsure();
    if (!ledger) return [];
    const resolved = [];
    for (const commitment of Object.values(ledger.commitments)) {
        if (commitment.caseId !== caseRow.id || commitment.status !== 'OPEN'
            || commitment.obligationCode !== 'PROVIDE_COUNTER_OFFER'
            || commitment.promisorActorId !== version.proposerActorId
            || Number(version.number) <= Number(commitment.sourceVersionNumber)) continue;
        resolved.push(storyNegotiationPromiseResolve(commitment, 'KEPT', {
            type: 'NEGOTIATION_VERSION', versionId: version.id, contentHash: version.contentHash
        }));
    }
    return resolved;
}

function storyNegotiationIdentityLedger() {
    return typeof storyCharacterIdentityEnsure === 'function' ? storyCharacterIdentityEnsure() : null;
}

function storyNegotiationSafeToken(value) {
    return String(value == null ? '' : value).replace(/[^a-zA-Z0-9_-]/g, '-');
}

function storyNegotiationBeliefCreate(identityLedger, input) {
    const holder = identityLedger && identityLedger.identities[String(input.holderActorId || '')];
    const fact = identityLedger && identityLedger.worldFacts[String(input.worldFactId || '')];
    if (!holder || !fact) return null;
    const id = String(input.id);
    if (identityLedger.actorBeliefs[id]) return identityLedger.actorBeliefs[id];
    const belief = {
        id,
        holderActorId: holder.id,
        holderCountryId: holder.countryId,
        worldFactId: fact.id,
        subjectActorId: fact.subjectActorId,
        beliefStatus: String(input.beliefStatus || 'REPORTED'),
        confidenceBps: Math.max(1, Math.min(10000, Math.round(Number(input.confidenceBps) || 1))),
        source: storyNegotiationClone(input.source || {}),
        learnedAt: Number(STORY.clock) || 0,
        originEventId: String(input.originEventId || fact.originEventId),
        version: 1
    };
    identityLedger.actorBeliefs[id] = belief;
    return belief;
}

function storyNegotiationSecretShare(caseId, fromActorId, toActorId, sourceBeliefId) {
    const ledger = storyNegotiationEnsure();
    const caseRow = ledger && ledger.cases[String(caseId)];
    if (!caseRow) return { ok: false, code: 'CASE_NOT_FOUND', worldMutation: false };
    const from = String(fromActorId || '');
    const to = String(toActorId || '');
    if (from === to || !caseRow.partyActorIds.includes(from) || !caseRow.partyActorIds.includes(to)) {
        return { ok: false, code: 'NOT_CASE_PARTIES', worldMutation: false };
    }
    const identities = storyNegotiationIdentityLedger();
    const sourceBelief = identities && identities.actorBeliefs[String(sourceBeliefId || '')];
    const fact = sourceBelief && identities.worldFacts[sourceBelief.worldFactId];
    if (!sourceBelief || sourceBelief.holderActorId !== from) {
        return { ok: false, code: 'SOURCE_BELIEF_NOT_OWNED', worldMutation: false };
    }
    if (!fact || fact.visibility !== 'PRIVATE' || Number(sourceBelief.confidenceBps) < 5000) {
        return { ok: false, code: 'SOURCE_NOT_SHAREABLE_SECRET', worldMutation: false };
    }
    const duplicate = Object.values(ledger.secrets).find(row => row.caseId === caseRow.id
        && row.worldFactId === fact.id && row.ownerActorId === from && row.holderActorIds.includes(to));
    if (duplicate) return { ok: true, code: 'SECRET_ALREADY_SHARED', secret: storyNegotiationClone(duplicate),
        knowledgeMutation: false, worldMutation: false };
    if (Object.keys(ledger.secrets).length >= STORY_NEGOTIATION_SECRET_LIMIT) {
        return { ok: false, code: 'SECRET_LIMIT', worldMutation: false };
    }
    const sequence = ledger.nextSecretSequence++;
    const id = `negotiation-secret:${sequence}`;
    const recipientBelief = storyNegotiationBeliefCreate(identities, {
        id: `actor-belief:${storyNegotiationSafeToken(id)}:${storyNegotiationSafeToken(to)}`,
        holderActorId: to,
        worldFactId: fact.id,
        beliefStatus: 'REPORTED',
        confidenceBps: Math.max(1, Math.round(Number(sourceBelief.confidenceBps) * 0.9)),
        source: { type: 'NEGOTIATION_SECRET_SHARE', actorId: from,
            sourceBeliefId: sourceBelief.id, negotiationCaseId: caseRow.id, secretId: id }
    });
    if (!recipientBelief) return { ok: false, code: 'IDENTITY_LEDGER_UNAVAILABLE', worldMutation: false };
    const memoryId = `character-memory:negotiation-secret:${storyNegotiationSafeToken(id)}`;
    const memory = typeof storyMemoryAddMilestone === 'function' ? storyMemoryAddMilestone({
        id: memoryId,
        kind: 'SECRET',
        status: 'ACTIVE',
        subjectActorId: from,
        holderActorIds: [from, to],
        relatedActorIds: [to],
        summary: 'Müzakere sırasında gizli bilgi paylaşıldı; üçüncü kişilere aktarım ayrıca yetkilendirilmelidir.',
        importanceBps: 9000,
        source: { type: 'NEGOTIATION_SECRET', negotiationCaseId: caseRow.id,
            secretId: id, worldFactId: fact.id, sourceBeliefId: sourceBelief.id }
    }) : null;
    const secret = {
        schemaVersion: 1,
        id,
        sequence,
        caseId: caseRow.id,
        worldFactId: fact.id,
        sourceBeliefId: sourceBelief.id,
        ownerActorId: from,
        holderActorIds: [from, to],
        allowedDisclosureActorIds: [],
        disclosures: [],
        memoryMilestoneId: memory && memory.milestone && memory.milestone.id || memoryId,
        createdAt: Number(STORY.clock) || 0,
        version: 1
    };
    ledger.secrets[id] = secret;
    ledger.diagnostics.secretsShared++;
    storyNegotiationEvent(ledger, { kind: 'SECRET_SHARED', caseId: caseRow.id,
        secretId: id, actorId: from, recipientActorId: to, knowledgeMutation: true, worldMutation: false });
    return { ok: true, code: 'SECRET_SHARED', secret: storyNegotiationClone(secret),
        recipientBelief: storyNegotiationClone(recipientBelief), knowledgeMutation: true, worldMutation: false };
}

function storyNegotiationSecretAuthorize(secretId, ownerActorId, recipientActorId) {
    const ledger = storyNegotiationEnsure();
    const secret = ledger && ledger.secrets[String(secretId)];
    if (!secret) return { ok: false, code: 'SECRET_NOT_FOUND', worldMutation: false };
    if (secret.ownerActorId !== String(ownerActorId || '')) {
        return { ok: false, code: 'NOT_SECRET_OWNER', worldMutation: false };
    }
    const recipient = String(recipientActorId || '');
    const identities = storyNegotiationIdentityLedger();
    if (!identities || !identities.identities[recipient] || secret.holderActorIds.includes(recipient)) {
        return { ok: false, code: 'INVALID_DISCLOSURE_RECIPIENT', worldMutation: false };
    }
    if (secret.allowedDisclosureActorIds.includes(recipient)) {
        return { ok: true, code: 'DISCLOSURE_ALREADY_AUTHORIZED', secret: storyNegotiationClone(secret), worldMutation: false };
    }
    secret.allowedDisclosureActorIds.push(recipient);
    secret.allowedDisclosureActorIds.sort();
    secret.version++;
    return { ok: true, code: 'DISCLOSURE_AUTHORIZED', secret: storyNegotiationClone(secret),
        knowledgeMutation: true, worldMutation: false };
}

function storyNegotiationSecretDisclose(secretId, discloserActorId, recipientActorId) {
    const ledger = storyNegotiationEnsure();
    const secret = ledger && ledger.secrets[String(secretId)];
    if (!secret) return { ok: false, code: 'SECRET_NOT_FOUND', worldMutation: false };
    const discloser = String(discloserActorId || '');
    const recipient = String(recipientActorId || '');
    const identities = storyNegotiationIdentityLedger();
    if (!secret.holderActorIds.includes(discloser)) return { ok: false, code: 'DISCLOSER_NOT_HOLDER', worldMutation: false };
    if (!identities || !identities.identities[recipient] || recipient === discloser) {
        return { ok: false, code: 'INVALID_DISCLOSURE_RECIPIENT', worldMutation: false };
    }
    const duplicate = secret.disclosures.find(row => row.discloserActorId === discloser
        && row.recipientActorId === recipient);
    if (duplicate) return { ok: true, code: 'DISCLOSURE_EXISTS', disclosure: storyNegotiationClone(duplicate),
        knowledgeMutation: false, worldMutation: false };
    if (secret.disclosures.length >= STORY_NEGOTIATION_DISCLOSURE_LIMIT) {
        return { ok: false, code: 'DISCLOSURE_LIMIT', worldMutation: false };
    }
    const sourceBeliefs = Object.values(identities.actorBeliefs).filter(row =>
        row.holderActorId === discloser && row.worldFactId === secret.worldFactId);
    const sourceBelief = sourceBeliefs.sort((a, b) => Number(b.confidenceBps) - Number(a.confidenceBps))[0];
    if (!sourceBelief) return { ok: false, code: 'DISCLOSER_BELIEF_MISSING', worldMutation: false };
    const sequence = ledger.nextDisclosureSequence++;
    const id = `negotiation-disclosure:${sequence}`;
    const authorized = secret.allowedDisclosureActorIds.includes(recipient);
    const originalBelief = storyNegotiationBeliefCreate(identities, {
        id: `actor-belief:${storyNegotiationSafeToken(secret.id)}:${storyNegotiationSafeToken(recipient)}`,
        holderActorId: recipient,
        worldFactId: secret.worldFactId,
        beliefStatus: 'REPORTED',
        confidenceBps: Math.max(1, Math.round(Number(sourceBelief.confidenceBps) * 0.82)),
        source: { type: 'NEGOTIATION_SECRET_DISCLOSURE', actorId: discloser,
            sourceBeliefId: sourceBelief.id, secretId: secret.id, disclosureId: id }
    });
    const disclosureFactId = `world-fact:${id}`;
    identities.worldFacts[disclosureFactId] = {
        id: disclosureFactId,
        factType: 'NEGOTIATION_SECRET_DISCLOSURE',
        subjectActorId: discloser,
        countryId: identities.identities[discloser].countryId,
        secretWorldFactId: secret.worldFactId,
        recipientActorId: recipient,
        authorized,
        occurredAt: Number(STORY.clock) || 0,
        originEventId: id,
        visibility: 'PRIVATE',
        version: 1
    };
    const disclosureBeliefIds = [discloser, recipient].map(holderActorId => {
        const belief = storyNegotiationBeliefCreate(identities, {
            id: `actor-belief:${storyNegotiationSafeToken(id)}:${storyNegotiationSafeToken(holderActorId)}`,
            holderActorId,
            worldFactId: disclosureFactId,
            beliefStatus: 'VERIFIED',
            confidenceBps: 10000,
            source: { type: 'DISCLOSURE_PARTICIPANT', actorId: discloser, disclosureId: id }
        });
        return belief && belief.id;
    }).filter(Boolean);
    const disclosure = {
        id,
        sequence,
        discloserActorId: discloser,
        recipientActorId: recipient,
        originalBeliefId: originalBelief && originalBelief.id,
        disclosureWorldFactId: disclosureFactId,
        disclosureBeliefIds,
        authorized,
        status: authorized ? 'AUTHORIZED' : 'UNDISCOVERED_UNAUTHORIZED',
        disclosedAt: Number(STORY.clock) || 0,
        discoveredAt: null,
        reportedByActorId: null,
        betrayalMemoryMilestoneId: null,
        effectsApplied: false
    };
    secret.disclosures.push(disclosure);
    if (!secret.holderActorIds.includes(recipient)) secret.holderActorIds.push(recipient);
    secret.holderActorIds.sort();
    secret.version++;
    ledger.diagnostics.disclosures++;
    if (!authorized) ledger.diagnostics.unauthorizedDisclosures++;
    storyNegotiationEvent(ledger, { kind: authorized ? 'SECRET_DISCLOSED_AUTHORIZED' : 'SECRET_DISCLOSED_UNAUTHORIZED',
        caseId: secret.caseId, secretId: secret.id, disclosureId: id, actorId: discloser,
        recipientActorId: recipient, knowledgeMutation: true, worldMutation: false });
    return { ok: true, code: authorized ? 'AUTHORIZED_DISCLOSURE' : 'UNAUTHORIZED_DISCLOSURE_UNDISCOVERED',
        disclosure: storyNegotiationClone(disclosure), knowledgeMutation: true, worldMutation: false };
}

function storyNegotiationSecretReportLeak(secretId, disclosureId, reporterActorId) {
    const ledger = storyNegotiationEnsure();
    const secret = ledger && ledger.secrets[String(secretId)];
    if (!secret) return { ok: false, code: 'SECRET_NOT_FOUND', worldMutation: false };
    const disclosure = secret.disclosures.find(row => row.id === String(disclosureId || ''));
    if (!disclosure) return { ok: false, code: 'DISCLOSURE_NOT_FOUND', worldMutation: false };
    if (disclosure.discoveredAt !== null) return { ok: true, code: 'LEAK_ALREADY_REPORTED',
        disclosure: storyNegotiationClone(disclosure), worldMutation: false };
    const reporter = String(reporterActorId || '');
    const identities = storyNegotiationIdentityLedger();
    const reporterBelief = identities && Object.values(identities.actorBeliefs).find(row =>
        row.holderActorId === reporter && row.worldFactId === disclosure.disclosureWorldFactId);
    if (!reporterBelief) return { ok: false, code: 'REPORTER_LACKS_DISCLOSURE_BELIEF', worldMutation: false };
    const ownerBelief = storyNegotiationBeliefCreate(identities, {
        id: `actor-belief:${storyNegotiationSafeToken(disclosure.id)}:${storyNegotiationSafeToken(secret.ownerActorId)}`,
        holderActorId: secret.ownerActorId,
        worldFactId: disclosure.disclosureWorldFactId,
        beliefStatus: 'REPORTED',
        confidenceBps: Math.max(1, Math.round(Number(reporterBelief.confidenceBps) * 0.9)),
        source: { type: 'SOURCED_LEAK_REPORT', actorId: reporter,
            sourceBeliefId: reporterBelief.id, secretId: secret.id, disclosureId: disclosure.id }
    });
    disclosure.discoveredAt = Number(STORY.clock) || 0;
    disclosure.reportedByActorId = reporter;
    ledger.diagnostics.leaksDiscovered++;
    let relationship = null;
    let memory = null;
    if (disclosure.authorized) {
        disclosure.status = 'DISCOVERED_AUTHORIZED';
    } else {
        disclosure.status = 'DISCOVERED_UNAUTHORIZED';
        relationship = typeof storyRelationshipAdjust === 'function' ? storyRelationshipAdjust(
            secret.ownerActorId, disclosure.discloserActorId,
            { trustBps: -800, respectBps: -300, hostilityBps: 500 },
            { source: 'negotiation.secret_leak', reason: 'SECRET_LEAK_DISCOVERED',
                sourceReceiptId: disclosure.id, recordDebtMemory: false }
        ) : { applied: false, reason: 'RELATIONSHIP_EXECUTOR_MISSING' };
        const memoryId = `character-memory:negotiation-betrayal:${storyNegotiationSafeToken(disclosure.id)}`;
        memory = typeof storyMemoryAddMilestone === 'function' ? storyMemoryAddMilestone({
            id: memoryId,
            kind: 'BETRAYAL',
            status: 'ACTIVE',
            subjectActorId: disclosure.discloserActorId,
            holderActorIds: [secret.ownerActorId, disclosure.discloserActorId],
            relatedActorIds: [secret.ownerActorId, reporter],
            summary: 'Yetkisiz sır ifşası kaynaklı bir raporla ortaya çıktı.',
            importanceBps: 9800,
            source: { type: 'NEGOTIATION_SECRET_LEAK', negotiationCaseId: secret.caseId,
                secretId: secret.id, disclosureId: disclosure.id,
                disclosureWorldFactId: disclosure.disclosureWorldFactId, reporterActorId: reporter }
        }) : null;
        disclosure.betrayalMemoryMilestoneId = memory && memory.milestone && memory.milestone.id || memoryId;
        disclosure.effectsApplied = !!(relationship && relationship.applied);
        if (disclosure.effectsApplied) ledger.diagnostics.betrayalsApplied++;
    }
    secret.version++;
    storyNegotiationEvent(ledger, { kind: disclosure.authorized ? 'AUTHORIZED_DISCLOSURE_REPORTED' : 'SECRET_LEAK_DISCOVERED',
        caseId: secret.caseId, secretId: secret.id, disclosureId: disclosure.id,
        actorId: reporter, ownerActorId: secret.ownerActorId,
        knowledgeMutation: true, worldMutation: !!(relationship && relationship.applied) });
    return { ok: true, code: disclosure.authorized ? 'AUTHORIZED_DISCLOSURE_REPORTED' : 'SECRET_LEAK_DISCOVERED',
        disclosure: storyNegotiationClone(disclosure), ownerBelief: storyNegotiationClone(ownerBelief),
        relationship, memory, knowledgeMutation: true, worldMutation: !!(relationship && relationship.applied) };
}

function storyNegotiationTick() {
    const ledger = storyNegotiationEnsure();
    if (!ledger) return { checked: 0, broken: 0, worldMutation: false };
    const now = Number(STORY.clock) || 0;
    let checked = 0;
    let broken = 0;
    let worldMutation = false;
    for (const commitment of Object.values(ledger.commitments)
        .sort((a, b) => Number(a.dueAt) - Number(b.dueAt) || a.sequence - b.sequence)) {
        if (commitment.status !== 'OPEN') continue;
        checked++;
        if (now <= Number(commitment.dueAt)) continue;
        const result = storyNegotiationPromiseResolve(commitment, 'BROKEN', {
            type: 'DEADLINE_EXPIRED', dueAt: commitment.dueAt, observedAt: now
        });
        if (result.ok) broken++;
        worldMutation = worldMutation || result.worldMutation;
    }
    const deliveries = storyNegotiationDeliveryTick();
    return { checked, broken, deliveries, worldMutation: worldMutation || deliveries.worldMutation };
}

function storyNegotiationCaseAccept(caseId, actorId, versionId) {
    const ledger = storyNegotiationEnsure();
    const caseRow = ledger && ledger.cases[String(caseId)];
    if (!caseRow) return { ok: false, code: 'CASE_NOT_FOUND', worldMutation: false };
    const actor = String(actorId || '');
    if (!caseRow.partyActorIds.includes(actor)) return { ok: false, code: 'NOT_A_PARTY', worldMutation: false };
    if (!['DRAFT', 'COUNTERED', 'ACCEPTED_PENDING_APPROVAL'].includes(caseRow.status)) {
        return { ok: false, code: 'CASE_CLOSED', worldMutation: false };
    }
    if (String(versionId) !== caseRow.currentVersionId) return { ok: false, code: 'STALE_VERSION', worldMutation: false };
    const version = caseRow.versions.find(row => row.id === caseRow.currentVersionId);
    if (!version.acceptedByActorIds.includes(actor)) {
        version.acceptedByActorIds.push(actor);
        version.acceptedByActorIds.sort((a, b) => caseRow.partyActorIds.indexOf(a) - caseRow.partyActorIds.indexOf(b));
        ledger.diagnostics.partyAcceptances++;
    }
    caseRow.requiredApprovals = storyNegotiationPartyApprovals(caseRow, version.acceptedByActorIds);
    const partiesAccepted = caseRow.partyActorIds.every(id => version.acceptedByActorIds.includes(id));
    version.status = partiesAccepted ? 'ACCEPTED_BY_PARTIES' : 'PROPOSED';
    caseRow.status = partiesAccepted ? 'ACCEPTED_PENDING_APPROVAL' : caseRow.status;
    caseRow.updatedAt = Number(STORY.clock) || 0;
    return { ok: true, code: partiesAccepted ? 'PARTIES_ACCEPTED_PENDING_APPROVAL' : 'PARTY_ACCEPTED',
        case: storyNegotiationClone(caseRow), executable: false, worldMutation: false };
}

function storyNegotiationMechanicalEntity(grounding, role) {
    return (grounding && grounding.entities || []).find(row => row.role === role) || null;
}

function storyNegotiationMechanicalCheck(id, passed, code, references, detail) {
    return {
        id: String(id),
        status: passed ? 'PASS' : 'BLOCKED',
        code: String(code),
        references: Array.from(new Set((references || []).filter(Boolean).map(String))).sort(),
        detail: String(detail || '')
    };
}

function storyNegotiationMechanicalPreflight(caseId, requestedByActorId) {
    const ledger = storyNegotiationEnsure();
    const caseRow = ledger && ledger.cases[String(caseId)];
    if (!caseRow) return { ok: false, code: 'CASE_NOT_FOUND', worldMutation: false };
    const requester = String(requestedByActorId || '');
    if (!caseRow.partyActorIds.includes(requester)) {
        return { ok: false, code: 'NOT_A_PARTY', worldMutation: false };
    }
    const version = caseRow.versions.find(row => row.id === caseRow.currentVersionId);
    const partiesAccepted = !!version && caseRow.partyActorIds.every(id =>
        (version.acceptedByActorIds || []).includes(id));
    if (!partiesAccepted || caseRow.status !== 'ACCEPTED_PENDING_APPROVAL') {
        return { ok: false, code: 'PARTY_ACCEPTANCE_REQUIRED', worldMutation: false };
    }
    const grounding = caseRow.mechanicalGrounding;
    if (!grounding) return { ok: false, code: 'MECHANICAL_GROUNDING_MISSING', worldMutation: false };

    const requests = (grounding.requests || []).filter(row => row.type === 'REDIRECT_SHIPMENT');
    const request = requests.length === 1 ? requests[0] : null;
    const shipmentEntity = storyNegotiationMechanicalEntity(grounding, 'TARGET_SHIPMENT');
    const destinationEntity = storyNegotiationMechanicalEntity(grounding, 'DESTINATION');
    const commodityEntity = storyNegotiationMechanicalEntity(grounding, 'COMMODITY');
    const companyEntity = storyNegotiationMechanicalEntity(grounding, 'PLAYER_ORGANIZATION');
    const trade = typeof storyTradeEnsure === 'function' ? storyTradeEnsure() : null;
    const companies = STORY.companyEconomy;
    const identities = storyNegotiationIdentityLedger();
    const playerIdentity = identities && identities.identities[caseRow.partyActorIds[0]];
    const counterpartyIdentity = identities && identities.identities[caseRow.partyActorIds[1]];
    const shipmentId = request && request.targetShipmentId || shipmentEntity && shipmentEntity.entityId;
    const destinationId = request && request.destinationId || destinationEntity && destinationEntity.entityId;
    const shipment = trade && trade.shipments.find(row => row.id === shipmentId);
    const order = shipment && trade.orders.find(row => row.id === shipment.orderId);
    const contract = shipment && trade.contracts.find(row => row.id === shipment.contractId);
    const warehouse = companies && companies.warehouses && companies.warehouses[destinationId];
    const company = companies && companies.companies && companies.companies[companyEntity && companyEntity.entityId];
    const originalSellerCompanyId = shipment && (shipment.sellerCompanyId || order && order.sellerCompanyId) || null;
    const quantity = version.terms.quantity;
    const payment = version.terms.payment;
    const schedule = version.terms.delivery_schedule;
    const penalty = version.terms.contract_penalty;
    const unitResolution = typeof storyResourceUnitResolve === 'function' && commodityEntity
        ? storyResourceUnitResolve(commodityEntity.entityId, quantity && quantity.unit, quantity && quantity.amount)
        : { ok: false, code: 'UNIT_RESOLVER_UNAVAILABLE' };
    const physicalUnit = !!unitResolution.ok;
    const checks = [];
    checks.push(storyNegotiationMechanicalCheck('request_shape', !!request,
        request ? 'SINGLE_REDIRECT_REQUEST' : 'UNSUPPORTED_OR_AMBIGUOUS_REQUEST',
        requests.map(row => row.id), 'Mekanik adaptör bu dikeyde yalnız tek bir mevcut sevkiyat yönlendirmesini tanır.'));
    checks.push(storyNegotiationMechanicalCheck('active_shipment', !!shipment && ['IN_TRANSIT', 'HELD'].includes(shipment.status),
        shipment ? (['IN_TRANSIT', 'HELD'].includes(shipment.status) ? 'ACTIVE_SHIPMENT_VERIFIED' : 'SHIPMENT_NOT_ACTIVE') : 'SHIPMENT_NOT_FOUND',
        [shipmentId], 'Sevkiyat canlı ticaret defterinde ve yönlendirilebilir durumda olmalıdır.'));
    checks.push(storyNegotiationMechanicalCheck('trade_references', !!order && !!contract && contract.status === 'ACTIVE',
        !order ? 'ORDER_REFERENCE_MISSING' : !contract ? 'CONTRACT_REFERENCE_MISSING'
            : contract.status !== 'ACTIVE' ? 'CONTRACT_NOT_ACTIVE' : 'TRADE_REFERENCES_VERIFIED',
        [shipment && shipment.orderId, shipment && shipment.contractId], 'Sevkiyatın kanonik sipariş ve etkin sözleşme zinciri kopuk olmamalıdır.'));
    const existingSettlement = shipment && shipment.settlementReservationId && STORY.stateBudget
        && (STORY.stateBudget.settlements || []).find(row => row.id === shipment.settlementReservationId);
    const paymentBindingFree = !!shipment && !shipment.settlementReservationId;
    const resaleTransferable = !!(shipment && existingSettlement
        && existingSettlement.status === 'RESERVED' && existingSettlement.payerType === 'COMPANY'
        && existingSettlement.buyerCompanyId && existingSettlement.sellerCompanyId
        && existingSettlement.shipmentId === shipment.id
        && existingSettlement.sellerCompanyId === originalSellerCompanyId
        && existingSettlement.resourceId === shipment.resourceId
        && Math.abs(Number(existingSettlement.quantity) - Number(shipment.quantity)) <= 1e-6
        && existingSettlement.buyerCompanyId !== (company && company.id)
        && counterpartyIdentity
        && counterpartyIdentity.organizationId === existingSettlement.buyerCompanyId);
    const paymentBindingReady = paymentBindingFree || resaleTransferable;
    const deliverySellerCompanyId = resaleTransferable
        ? existingSettlement.buyerCompanyId : originalSellerCompanyId;
    const sellerCompany = companies && companies.companies && companies.companies[deliverySellerCompanyId];
    checks.push(storyNegotiationMechanicalCheck('shipment_payment_binding', paymentBindingReady,
        paymentBindingFree ? 'SHIPMENT_PAYMENT_UNBOUND'
            : resaleTransferable ? 'SHIPMENT_PAYMENT_BUYER_RESALE_READY'
                : 'SHIPMENT_PAYMENT_ALREADY_BOUND',
        [shipment && shipment.settlementReservationId, existingSettlement && existingSettlement.status],
        'Bağlı ilk escrow korunur; yalnız mevcut alıcının temsilcisi yeni alıcıya ayrı escrow ile yoldaki malı yeniden satabilir.'));
    checks.push(storyNegotiationMechanicalCheck('resale_assignment_authority', paymentBindingFree || resaleTransferable,
        paymentBindingFree ? 'RESALE_ASSIGNMENT_NOT_REQUIRED'
            : resaleTransferable ? 'CURRENT_BUYER_REPRESENTATION_VERIFIED'
                : 'CURRENT_BUYER_REPRESENTATION_REQUIRED',
        [counterpartyIdentity && counterpartyIdentity.id,
            counterpartyIdentity && counterpartyIdentity.organizationId,
            existingSettlement && existingSettlement.buyerCompanyId],
        'Yoldaki malın hak sahibi, sohbet edilen karşı tarafın gerçekten temsil ettiği şirket olmalıdır.'));
    const counterpartyRepresentationOk = !!(counterpartyIdentity && deliverySellerCompanyId
        && counterpartyIdentity.organizationId === deliverySellerCompanyId);
    checks.push(storyNegotiationMechanicalCheck('counterparty_representation', counterpartyRepresentationOk,
        counterpartyRepresentationOk ? 'SELLER_REPRESENTATION_VERIFIED'
            : 'SELLER_REPRESENTATION_REQUIRED',
        [counterpartyIdentity && counterpartyIdentity.id,
            counterpartyIdentity && counterpartyIdentity.organizationId, deliverySellerCompanyId],
        'Konuşmayı kabul eden karakter, mekanik sözleşmedeki satıcı şirketi gerçekten temsil etmelidir.'));
    checks.push(storyNegotiationMechanicalCheck('destination_warehouse', !!warehouse && warehouse.status === 'OPERATING',
        warehouse ? (warehouse.status === 'OPERATING' ? 'WAREHOUSE_VERIFIED' : 'WAREHOUSE_NOT_OPERATING') : 'WAREHOUSE_NOT_FOUND',
        [destinationId], 'Hedef, çalışan ve kanonik şirket defterinde bulunan gerçek bir depo olmalıdır.'));
    const ownershipOk = !!(warehouse && company && playerIdentity
        && playerIdentity.organizationId === company.id && warehouse.ownerCompanyId === company.id);
    checks.push(storyNegotiationMechanicalCheck('destination_ownership', ownershipOk,
        ownershipOk ? 'PLAYER_COMPANY_OWNS_DESTINATION' : 'DESTINATION_OWNERSHIP_OR_REPRESENTATION_FAILED',
        [company && company.id, warehouse && warehouse.ownerCompanyId, playerIdentity && playerIdentity.id],
        'Teklifi veren aktör hedef deponun sahibi şirketi gerçekten temsil etmelidir.'));
    const resourceOk = !!(shipment && commodityEntity && shipment.resourceId === commodityEntity.entityId);
    checks.push(storyNegotiationMechanicalCheck('resource_identity', resourceOk,
        resourceOk ? 'SHIPMENT_RESOURCE_MATCH' : 'SHIPMENT_RESOURCE_MISMATCH',
        [shipment && shipment.resourceId, commodityEntity && commodityEntity.entityId],
        'Konuşmada seçilen kanonik kaynak ile fiziksel sevkiyat aynı olmalıdır.'));
    const countryOk = !!(shipment && warehouse && shipment.buyerCountryId === warehouse.countryId);
    checks.push(storyNegotiationMechanicalCheck('buyer_country', countryOk,
        countryOk ? 'BUYER_COUNTRY_MATCH' : 'BUYER_COUNTRY_MISMATCH',
        [shipment && shipment.buyerCountryId, warehouse && warehouse.countryId],
        'Yönlendirme hedefi mevcut sevkiyatın alıcı ülkesinde kalmalıdır.'));
    const targetChanges = !!(shipment && warehouse && shipment.targetRegionId !== warehouse.regionId);
    checks.push(storyNegotiationMechanicalCheck('redirect_target_change', targetChanges,
        targetChanges ? 'REDIRECT_TARGET_CHANGES' : 'REDIRECT_TARGET_UNCHANGED',
        [shipment && shipment.targetRegionId, warehouse && warehouse.regionId],
        'Mevcut hedef ile aynı depo bölgesine yönlendirme değişiklik sayılmaz.'));
    checks.push(storyNegotiationMechanicalCheck('quantity_unit', physicalUnit,
        physicalUnit ? unitResolution.code : unitResolution.code || 'UNIT_CONVERSION_REQUIRED',
        [quantity && quantity.unit], 'Ton gibi konuşma birimleri kanonik stok birimine doğrulanmış dönüşüm olmadan çevrilemez.'));
    const canonicalQuantity = physicalUnit ? Number(unitResolution.amount) : NaN;
    const quantityOk = !!(physicalUnit && shipment && canonicalQuantity <= Number(shipment.quantity));
    checks.push(storyNegotiationMechanicalCheck('quantity_bound', quantityOk,
        quantityOk ? 'QUANTITY_WITHIN_SHIPMENT' : 'QUANTITY_EXCEEDS_OR_CANNOT_COMPARE',
        [shipment && shipment.id], 'Anlaşılan miktar sevkiyatın fiziksel miktarını aşmamalıdır.'));
    const nominalCapacity = warehouse && commodityEntity
        && Number(warehouse.capacityByResource && warehouse.capacityByResource[commodityEntity.entityId]);
    const nominalCapacityOk = !!(physicalUnit && Number.isFinite(nominalCapacity)
        && nominalCapacity >= canonicalQuantity);
    checks.push(storyNegotiationMechanicalCheck('nominal_capacity', nominalCapacityOk,
        nominalCapacityOk ? 'NOMINAL_CAPACITY_VERIFIED' : 'NOMINAL_CAPACITY_INSUFFICIENT_OR_UNKNOWN',
        [warehouse && warehouse.id], 'Depo türsel kapasitesi teklif miktarını karşılamalıdır.'));
    const occupancy = typeof storyCompanyWarehouseOccupancy === 'function' && warehouse && commodityEntity
        ? storyCompanyWarehouseOccupancy(warehouse.id, commodityEntity.entityId) : null;
    const occupancyOk = !!(physicalUnit && occupancy && occupancy.ok && !occupancy.overbooked
        && Number(occupancy.available) >= canonicalQuantity);
    checks.push(storyNegotiationMechanicalCheck('warehouse_occupancy', occupancyOk,
        !occupancy || !occupancy.ok ? (occupancy && occupancy.code || 'WAREHOUSE_OCCUPANCY_UNAVAILABLE')
            : occupancy.overbooked ? 'WAREHOUSE_ALREADY_OVERBOOKED'
                : !physicalUnit ? 'WAREHOUSE_QUANTITY_UNIT_UNRESOLVED'
                    : Number(occupancy.available) < canonicalQuantity
                        ? 'WAREHOUSE_AVAILABLE_CAPACITY_INSUFFICIENT' : 'WAREHOUSE_OCCUPANCY_VERIFIED',
        [warehouse && warehouse.id].concat(occupancy && occupancy.incomingShipmentIds || []),
        'Teslim edilmiş bölgesel stok ve hedefe giden fiziksel sevkiyatlar depo kapasitesinden düşülür.'));
    const paymentUnit = typeof storyResourceUnitResolve === 'function'
        ? storyResourceUnitResolve('capital', payment && payment.unit, payment && payment.amount)
        : { ok: false, code: 'UNIT_RESOLVER_UNAVAILABLE' };
    const maintenanceReserve = typeof STORY_COMMERCE_COMPANY_MAINTENANCE_RESERVE !== 'undefined'
        ? STORY_COMMERCE_COMPANY_MAINTENANCE_RESERVE : 80;
    const availablePaymentCash = company
        ? Math.max(0, Number(company.accounts && company.accounts['ASSET:CASH']) - maintenanceReserve) : 0;
    const paymentExecutorAvailable = typeof storyBudgetReserveNegotiatedPayment === 'function'
        && typeof storyBudgetReleaseNegotiatedPayment === 'function';
    const paymentReady = !!(company && paymentUnit.ok && paymentExecutorAvailable
        && availablePaymentCash + 1e-6 >= Number(paymentUnit.amount));
    checks.push(storyNegotiationMechanicalCheck('payment_executor', paymentReady,
        !company ? 'NEGOTIATED_PAYMENT_BUYER_COMPANY_MISSING'
            : !paymentUnit.ok ? paymentUnit.code
                : !paymentExecutorAvailable ? 'NEGOTIATED_PAYMENT_EXECUTOR_UNAVAILABLE'
                    : availablePaymentCash + 1e-6 < Number(paymentUnit.amount)
                        ? 'NEGOTIATED_PAYMENT_CASH_UNAVAILABLE' : 'NEGOTIATED_PAYMENT_ESCROW_AVAILABLE',
        [company && company.id, payment && payment.unit],
        'Pazarlık bedeli şirket bakım rezervi korunduktan sonra idempotent bütçe settlement ve şirket escrow fişine bağlanır.'));
    const deliverySchedule = storyNegotiationDeliverySchedule(schedule, Number(STORY.clock) || 0);
    checks.push(storyNegotiationMechanicalCheck('delivery_schedule_executor', deliverySchedule.ok,
        deliverySchedule.code, [schedule && schedule.unit],
        'Teslim süresi duvar saatine değil STORY_CALENDAR gün/ay ölçeğine çevrilir.'));
    const penaltyQuote = storyNegotiationPenaltyQuote(payment, penalty);
    const penaltyExecutorAvailable = typeof storyCompanyPayContractPenalty === 'function';
    const penaltyReady = !!(penaltyQuote.ok && penaltyExecutorAvailable && sellerCompany && company);
    checks.push(storyNegotiationMechanicalCheck('penalty_executor', penaltyReady,
        !penaltyQuote.ok ? penaltyQuote.code
            : !penaltyExecutorAvailable ? 'CONTRACT_PENALTY_EXECUTOR_UNAVAILABLE'
                : !sellerCompany ? 'CONTRACT_PENALTY_SELLER_COMPANY_MISSING'
                    : !company ? 'CONTRACT_PENALTY_BUYER_COMPANY_MISSING' : 'CONTRACT_PENALTY_EXECUTOR_AVAILABLE',
        [deliverySellerCompanyId, company && company.id, penalty && penalty.unit],
        'Doğrulanmış gecikme cezası satıcı ve alıcı şirket arasında çift taraflı posting ile uygulanır; nakit yoksa alacak açık kalır.'));

    const inputHash = storyNegotiationHash({
        caseId: caseRow.id, versionHash: version.contentHash, groundingHash: grounding.contentHash,
        requester, shipment: shipment && { id: shipment.id, status: shipment.status,
            quantity: shipment.quantity, resourceId: shipment.resourceId, orderId: shipment.orderId,
            contractId: shipment.contractId, buyerCountryId: shipment.buyerCountryId,
            currentRegionId: shipment.currentRegionId, targetRegionId: shipment.targetRegionId,
            settlementReservationId: shipment.settlementReservationId || null },
        warehouse: warehouse && { id: warehouse.id, status: warehouse.status,
            countryId: warehouse.countryId, ownerCompanyId: warehouse.ownerCompanyId,
            capacity: nominalCapacity }, occupancy, unitResolution,
        deliverySchedule, penaltyQuote, originalSellerCompanyId, deliverySellerCompanyId,
        counterpartyOrganizationId: counterpartyIdentity && counterpartyIdentity.organizationId || null,
        existingSettlement: existingSettlement && { id: existingSettlement.id,
            status: existingSettlement.status, payerType: existingSettlement.payerType,
            buyerCompanyId: existingSettlement.buyerCompanyId,
            sellerCompanyId: existingSettlement.sellerCompanyId,
            amount: existingSettlement.amount },
        checks: checks.map(row => [row.id, row.status, row.code])
    });
    const duplicate = caseRow.mechanicalReviews.find(row => row.inputHash === inputHash);
    if (duplicate) return { ok: true, code: duplicate.status === 'READY' ? 'PREFLIGHT_READY' : 'PREFLIGHT_BLOCKED',
        review: storyNegotiationClone(duplicate), duplicate: true, worldMutation: false };
    const sequence = ledger.nextMechanicalReviewSequence++;
    const blocked = checks.filter(row => row.status !== 'PASS');
    const review = {
        schemaVersion: 1,
        id: `negotiation-mechanical-review:${sequence}`,
        sequence,
        caseId: caseRow.id,
        versionId: version.id,
        requestedByActorId: requester,
        createdAt: Number(STORY.clock) || 0,
        inputHash,
        status: blocked.length ? 'BLOCKED' : 'READY',
        checks,
        blockerCodes: blocked.map(row => row.code),
        executable: false,
        worldMutation: false
    };
    caseRow.mechanicalReviews.push(review);
    if (caseRow.mechanicalReviews.length > STORY_NEGOTIATION_MECHANICAL_REVIEW_LIMIT) caseRow.mechanicalReviews.shift();
    caseRow.execution = { status: blocked.length ? 'PREFLIGHT_BLOCKED' : 'PREFLIGHT_READY', receiptId: review.id };
    const authority = caseRow.requiredApprovals.find(row => row.kind === 'MECHANICAL_CONTRACT_AUTHORITY');
    if (authority) {
        authority.ownerSystem = 'STORY_NEGOTIATION_MECHANICAL_PREFLIGHT';
        authority.lastReviewId = review.id;
        authority.status = 'PENDING';
    }
    caseRow.updatedAt = Number(STORY.clock) || 0;
    ledger.diagnostics.mechanicalPreflights++;
    if (blocked.length) ledger.diagnostics.mechanicalBlocked++;
    storyNegotiationEvent(ledger, { kind: blocked.length ? 'MECHANICAL_PREFLIGHT_BLOCKED' : 'MECHANICAL_PREFLIGHT_READY',
        caseId: caseRow.id, actorId: requester, mechanicalReviewId: review.id,
        worldMutation: false });
    return { ok: true, code: blocked.length ? 'PREFLIGHT_BLOCKED' : 'PREFLIGHT_READY',
        review: storyNegotiationClone(review), duplicate: false, worldMutation: false };
}

function storyNegotiationDeliveryObligationCreate(caseId, requestedByActorId) {
    const ledger = storyNegotiationEnsure();
    const caseRow = ledger && ledger.cases[String(caseId)];
    if (!caseRow) return { ok: false, code: 'CASE_NOT_FOUND', worldMutation: false };
    const requester = String(requestedByActorId || '');
    if (!caseRow.partyActorIds.includes(requester)) return { ok: false, code: 'NOT_A_PARTY', worldMutation: false };
    const version = caseRow.versions.find(row => row.id === caseRow.currentVersionId);
    const refreshed = storyNegotiationMechanicalPreflight(caseRow.id, requester);
    const review = refreshed && refreshed.review;
    if (!version || !refreshed.ok || refreshed.code !== 'PREFLIGHT_READY'
        || !review || review.status !== 'READY') {
        return { ok: false, code: 'MECHANICAL_PREFLIGHT_READY_REQUIRED', worldMutation: false };
    }
    const duplicate = Object.values(ledger.deliveryObligations).find(row =>
        row.caseId === caseRow.id && row.versionId === version.id);
    if (duplicate) return { ok: true, code: 'DELIVERY_OBLIGATION_EXISTS', duplicate: true,
        obligation: storyNegotiationClone(duplicate), worldMutation: false };
    if (Object.keys(ledger.deliveryObligations).length >= STORY_NEGOTIATION_DELIVERY_LIMIT) {
        return { ok: false, code: 'DELIVERY_OBLIGATION_LIMIT', worldMutation: false };
    }
    const grounding = caseRow.mechanicalGrounding;
    const request = (grounding.requests || []).find(row => row.type === 'REDIRECT_SHIPMENT');
    const shipmentId = request && request.targetShipmentId;
    const shipment = STORY.tradeLogistics && STORY.tradeLogistics.shipments
        && STORY.tradeLogistics.shipments.find(row => row.id === shipmentId);
    const companyEntity = storyNegotiationMechanicalEntity(grounding, 'PLAYER_ORGANIZATION');
    const destinationEntity = storyNegotiationMechanicalEntity(grounding, 'DESTINATION');
    const buyerCompanyId = companyEntity && companyEntity.entityId;
    const destinationWarehouse = STORY.companyEconomy && STORY.companyEconomy.warehouses
        && STORY.companyEconomy.warehouses[destinationEntity && destinationEntity.entityId];
    const order = shipment && STORY.tradeLogistics.orders.find(row => row.id === shipment.orderId);
    const originalSellerCompanyId = shipment && (shipment.sellerCompanyId || order && order.sellerCompanyId);
    const existingSettlement = shipment && shipment.settlementReservationId && STORY.stateBudget
        && (STORY.stateBudget.settlements || []).find(row => row.id === shipment.settlementReservationId);
    const identities = storyNegotiationIdentityLedger();
    const counterpartyIdentity = identities && identities.identities[caseRow.partyActorIds[1]];
    const resaleTransfer = !!(existingSettlement && existingSettlement.status === 'RESERVED'
        && existingSettlement.payerType === 'COMPANY' && existingSettlement.buyerCompanyId
        && existingSettlement.sellerCompanyId
        && existingSettlement.shipmentId === shipment.id
        && existingSettlement.sellerCompanyId === originalSellerCompanyId
        && existingSettlement.resourceId === shipment.resourceId
        && Math.abs(Number(existingSettlement.quantity) - Number(shipment.quantity)) <= 1e-6
        && existingSettlement.buyerCompanyId !== buyerCompanyId
        && counterpartyIdentity
        && counterpartyIdentity.organizationId === existingSettlement.buyerCompanyId);
    const sellerCompanyId = resaleTransfer ? existingSettlement.buyerCompanyId : originalSellerCompanyId;
    const schedule = storyNegotiationDeliverySchedule(version.terms.delivery_schedule, Number(STORY.clock) || 0);
    const penalty = storyNegotiationPenaltyQuote(version.terms.payment, version.terms.contract_penalty);
    if (!shipment || !buyerCompanyId || !sellerCompanyId || !destinationWarehouse
        || !schedule.ok || !penalty.ok || (shipment.settlementReservationId && !resaleTransfer)) {
        return { ok: false, code: 'DELIVERY_OBLIGATION_GROUNDING_INVALID', worldMutation: false };
    }
    const unit = storyResourceUnitResolve(shipment.resourceId,
        version.terms.quantity.unit, version.terms.quantity.amount);
    if (!unit.ok) return { ok: false, code: unit.code, worldMutation: false };
    const transferMode = resaleTransfer ? 'BUYER_TO_BUYER_RESALE' : 'DIRECT_NEGOTIATED_DELIVERY';
    const contractDraft = typeof storyMechanicalContractGoodsDraftCreate === 'function'
        ? storyMechanicalContractGoodsDraftCreate({
            subtype: transferMode,
            source: {
                negotiationCaseId: caseRow.id,
                negotiationVersionId: version.id,
                mechanicalReviewId: review.id
            },
            parties: [
                { role: 'BUYER', actorId: caseRow.partyActorIds[0], legalActorType: 'COMPANY',
                    legalActorId: buyerCompanyId },
                { role: 'SELLER', actorId: caseRow.partyActorIds[1], legalActorType: 'COMPANY',
                    legalActorId: sellerCompanyId }
            ],
            scope: {
                shipmentId: shipment.id, orderId: shipment.orderId,
                tradeContractId: shipment.contractId,
                resourceId: shipment.resourceId, quantity: unit.amount,
                quantityUnit: 'canonical', destinationWarehouseId: destinationWarehouse.id,
                targetRegionId: destinationWarehouse.regionId,
                originalBuyerCompanyId: resaleTransfer ? existingSettlement.buyerCompanyId : null,
                originalSellerCompanyId
            },
            price: {
                amount: Number(version.terms.payment.amount), currency: 'capital',
                payerLegalActorId: buyerCompanyId, payeeLegalActorId: sellerCompanyId,
                primarySettlementReservationId: resaleTransfer ? existingSettlement.id : null
            },
            schedule: {
                createdAt: Number(STORY.clock) || 0, dueAt: schedule.dueAt,
                durationSeconds: schedule.durationSeconds,
                sourceAmount: schedule.amount, sourceUnit: schedule.unit
            },
            serviceLevel: { metric: 'PHYSICAL_SHIPMENT_DELIVERED', requiredQuantity: unit.amount,
                destinationWarehouseId: destinationWarehouse.id },
            breach: { code: 'DELIVERY_DEADLINE_BREACHED', penaltyAmount: penalty.amount,
                penaltyCurrency: 'capital' },
            causalIds: [caseRow.id, version.id, review.id, shipment.id, shipment.orderId,
                shipment.contractId, destinationWarehouse.id].filter(Boolean)
        }) : { ok: false, code: 'MECHANICAL_CONTRACT_V1_UNAVAILABLE' };
    if (!contractDraft.ok) {
        return { ok: false, code: contractDraft.code || 'MECHANICAL_CONTRACT_DRAFT_FAILED',
            worldMutation: false };
    }
    const mechanicalContractId = contractDraft.contract.id;
    const reserve = typeof storyBudgetReserveNegotiatedPayment === 'function'
        ? storyBudgetReserveNegotiatedPayment({
            correlationId: `${caseRow.id}:${version.id}:payment`,
            negotiationCaseId: caseRow.id,
            negotiationVersionId: version.id,
            buyerCompanyId,
            sellerCompanyId,
            buyerCountryId: shipment.buyerCountryId,
            sellerCountryId: shipment.sellerCountryId,
            shipmentId: shipment.id,
            resourceId: shipment.resourceId,
            quantity: unit.amount,
            amount: version.terms.payment.amount,
            currency: version.terms.payment.unit
        }) : { ok: false, code: 'NEGOTIATED_PAYMENT_EXECUTOR_UNAVAILABLE' };
    if (!reserve.ok) return { ok: false, code: reserve.code || 'NEGOTIATED_PAYMENT_RESERVE_FAILED',
        finance: reserve, worldMutation: false };
    const redirected = typeof storyTradeRedirectShipment === 'function'
        ? storyTradeRedirectShipment(shipment.id, destinationWarehouse.regionId, {
            authorizedByCountryId: shipment.buyerCountryId,
            source: 'NEGOTIATED_DELIVERY_OBLIGATION'
        }) : { ok: false, code: 'SHIPMENT_REDIRECT_EXECUTOR_UNAVAILABLE' };
    if (!redirected.ok) {
        storyBudgetReleaseNegotiatedPayment(reserve.reservationId,
            redirected.code || 'NEGOTIATED_REDIRECT_FAILED');
        return { ok: false, code: redirected.code || 'NEGOTIATED_REDIRECT_FAILED',
            redirect: redirected, worldMutation: false };
    }
    if (typeof storyBudgetBindTradeShipment === 'function') {
        storyBudgetBindTradeShipment(reserve.reservationId, shipment.id);
    }
    if (resaleTransfer) {
        shipment.beneficialBuyerCompanyId = buyerCompanyId;
        shipment.resaleSettlementReservationId = reserve.reservationId;
        shipment.resaleSettlementAmount = Number(version.terms.payment.amount);
        shipment.resaleSourceBuyerCompanyId = existingSettlement.buyerCompanyId;
    } else {
        shipment.settlementReservationId = reserve.reservationId;
        shipment.settlementAmount = Number(version.terms.payment.amount);
        shipment.buyerCompanyId = buyerCompanyId;
        if (order) order.buyerCompanyId = buyerCompanyId;
    }
    const sequence = ledger.nextDeliverySequence++;
    const id = `negotiation-delivery:${sequence}`;
    const sellerActorId = caseRow.partyActorIds[1];
    const buyerActorId = caseRow.partyActorIds[0];
    const memory = typeof storyMemoryRecordPromise === 'function' ? storyMemoryRecordPromise({
        subjectActorId: sellerActorId,
        relatedActorId: buyerActorId,
        talkTemplateId: `negotiation-delivery:${caseRow.id}:${version.id}`,
        summary: 'Kabul edilmiş müzakere sürümündeki fiziksel sevkiyat son tarihe kadar teslim edilecek.',
        dueAt: schedule.dueAt,
        source: { type: 'NEGOTIATION_DELIVERY_OBLIGATION', negotiationCaseId: caseRow.id,
            negotiationVersionId: version.id, shipmentId: shipment.id }
    }) : null;
    const obligation = {
        schemaVersion: 1,
        id,
        sequence,
        caseId: caseRow.id,
        versionId: version.id,
        mechanicalReviewId: review.id,
        shipmentId: shipment.id,
        buyerActorId,
        sellerActorId,
        buyerCompanyId,
        sellerCompanyId,
        transferMode,
        mechanicalContractId,
        originalSellerCompanyId,
        originalBuyerCompanyId: resaleTransfer ? existingSettlement.buyerCompanyId : null,
        primarySettlementReservationId: resaleTransfer ? existingSettlement.id : null,
        destinationWarehouseId: destinationWarehouse.id,
        targetRegionId: destinationWarehouse.regionId,
        tradeAmendmentId: redirected.amendment && redirected.amendment.id || null,
        resourceId: shipment.resourceId,
        quantity: unit.amount,
        paymentAmount: Number(version.terms.payment.amount),
        penaltyAmount: penalty.amount,
        escrowReservationId: reserve.reservationId,
        createdAt: Number(STORY.clock) || 0,
        dueAt: schedule.dueAt,
        status: 'OPEN',
        deliveredAt: null,
        breachedAt: null,
        resolvedAt: null,
        lastErrorCode: null,
        memoryMilestoneId: memory && memory.milestone && memory.milestone.id || null,
        breachEffectsApplied: false,
        penaltyTransactionIds: [],
        penaltyAttempts: 0,
        nextPenaltyRetryAt: null,
        version: 1
    };
    ledger.deliveryObligations[id] = obligation;
    const contractActivation = storyMechanicalContractActivate(mechanicalContractId, id);
    if (!contractActivation.ok) {
        obligation.lastErrorCode = contractActivation.code || 'MECHANICAL_CONTRACT_ACTIVATION_FAILED';
    }
    const authority = caseRow.requiredApprovals.find(row => row.kind === 'MECHANICAL_CONTRACT_AUTHORITY');
    if (authority) {
        authority.status = 'APPROVED';
        authority.actorId = requester;
        authority.approvedAt = Number(STORY.clock) || 0;
        authority.ownerSystem = 'MECHANICAL_CONTRACT_V1';
        authority.obligationId = id;
        authority.mechanicalContractId = mechanicalContractId;
    }
    caseRow.status = 'ACTIVE';
    caseRow.execution = { status: 'TRACKING_DELIVERY', receiptId: id };
    caseRow.worldMutation = true;
    caseRow.updatedAt = Number(STORY.clock) || 0;
    ledger.diagnostics.deliveriesCreated++;
    for (const commitment of Object.values(ledger.commitments)) {
        if (commitment.caseId === caseRow.id && commitment.status === 'OPEN'
            && commitment.obligationCode === 'SECURE_MECHANICAL_APPROVAL') {
            storyNegotiationPromiseResolve(commitment, 'KEPT', {
                type: 'DELIVERY_OBLIGATION', obligationId: id, mechanicalReviewId: review.id
            });
        }
    }
    storyNegotiationEvent(ledger, { kind: 'DELIVERY_OBLIGATION_CREATED', caseId: caseRow.id,
        actorId: requester, deliveryObligationId: id, worldMutation: true });
    return { ok: true, code: 'DELIVERY_OBLIGATION_CREATED', duplicate: false,
        obligation: storyNegotiationClone(obligation), worldMutation: true };
}

function storyNegotiationDeliveryBreachEffects(obligation) {
    if (obligation.breachEffectsApplied) return { applied: false, duplicate: true };
    const relationship = typeof storyRelationshipAdjust === 'function'
        ? storyRelationshipAdjust(obligation.buyerActorId, obligation.sellerActorId,
            { trustBps: -700, respectBps: -300, hostilityBps: 450 }, {
                source: 'negotiation.delivery', reason: 'DELIVERY_DEADLINE_BREACHED',
                sourceReceiptId: obligation.id, recordDebtMemory: false
            }) : { applied: false, reason: 'RELATIONSHIP_EXECUTOR_MISSING' };
    const memory = obligation.memoryMilestoneId && typeof storyMemoryResolveMilestone === 'function'
        ? storyMemoryResolveMilestone(obligation.memoryMilestoneId, 'BROKEN')
        : { applied: false, reason: 'MEMORY_EXECUTOR_MISSING' };
    obligation.breachEffectsApplied = !!relationship.applied;
    return { applied: obligation.breachEffectsApplied, relationship, memory };
}

function storyNegotiationDeliveryTick() {
    const ledger = storyNegotiationEnsure();
    if (!ledger) return { checked: 0, kept: 0, broken: 0, pendingPenalty: 0, worldMutation: false };
    const now = Number(STORY.clock) || 0;
    let checked = 0;
    let kept = 0;
    let broken = 0;
    let pendingPenalty = 0;
    let worldMutation = false;
    for (const obligation of Object.values(ledger.deliveryObligations)
        .sort((a, b) => Number(a.dueAt) - Number(b.dueAt) || a.sequence - b.sequence)) {
        if (!['OPEN', 'SETTLEMENT_PENDING', 'BREACH_PAYMENT_PENDING'].includes(obligation.status)) continue;
        if (obligation.status === 'BREACH_PAYMENT_PENDING'
            && Number.isFinite(Number(obligation.nextPenaltyRetryAt))
            && now < Number(obligation.nextPenaltyRetryAt)) continue;
        checked++;
        const caseRow = ledger.cases[obligation.caseId];
        const shipment = STORY.tradeLogistics && STORY.tradeLogistics.shipments
            && STORY.tradeLogistics.shipments.find(row => row.id === obligation.shipmentId);
        if (obligation.status !== 'BREACH_PAYMENT_PENDING' && shipment && shipment.status === 'DELIVERED') {
            const settled = obligation.transferMode === 'BUYER_TO_BUYER_RESALE'
                && typeof storyBudgetSettleShipmentPayments === 'function'
                ? storyBudgetSettleShipmentPayments(shipment)
                : typeof storyBudgetSettleNegotiatedPayment === 'function'
                    ? storyBudgetSettleNegotiatedPayment(obligation.escrowReservationId, {
                        shipmentId: shipment.id, cargoCost: shipment.commerceCargoCost || 0
                    }) : { ok: false, code: 'NEGOTIATED_PAYMENT_SETTLEMENT_UNAVAILABLE' };
            if (!settled.ok) {
                obligation.status = 'SETTLEMENT_PENDING';
                obligation.lastErrorCode = settled.code || 'SETTLEMENT_FAILED';
                obligation.version++;
                if (obligation.mechanicalContractId
                    && typeof storyMechanicalContractSyncDelivery === 'function') {
                    storyMechanicalContractSyncDelivery(obligation.mechanicalContractId, obligation);
                }
                continue;
            }
            obligation.status = 'KEPT';
            obligation.deliveredAt = Number(shipment.deliveredAt) || now;
            obligation.resolvedAt = now;
            obligation.lastErrorCode = null;
            obligation.version++;
            if (obligation.mechanicalContractId
                && typeof storyMechanicalContractSyncDelivery === 'function') {
                storyMechanicalContractSyncDelivery(obligation.mechanicalContractId, obligation);
            }
            if (obligation.memoryMilestoneId && typeof storyMemoryResolveMilestone === 'function') {
                storyMemoryResolveMilestone(obligation.memoryMilestoneId, 'KEPT');
            }
            if (caseRow) {
                caseRow.status = 'FULFILLED';
                caseRow.execution = { status: 'DELIVERY_SETTLED', receiptId: obligation.id };
                caseRow.updatedAt = now;
            }
            ledger.diagnostics.deliveriesKept++;
            kept++;
            worldMutation = true;
            storyNegotiationEvent(ledger, { kind: 'DELIVERY_OBLIGATION_KEPT', caseId: obligation.caseId,
                deliveryObligationId: obligation.id, shipmentId: obligation.shipmentId, worldMutation: true });
            continue;
        }
        if (obligation.status !== 'BREACH_PAYMENT_PENDING' && now <= Number(obligation.dueAt)) continue;
        if (obligation.status !== 'BREACH_PAYMENT_PENDING') {
            const released = typeof storyBudgetReleaseNegotiatedPayment === 'function'
                ? storyBudgetReleaseNegotiatedPayment(obligation.escrowReservationId, 'DELIVERY_DEADLINE_BREACHED')
                : { ok: false, code: 'NEGOTIATED_PAYMENT_RELEASE_UNAVAILABLE' };
            if (!released.ok) {
                obligation.lastErrorCode = released.code || 'ESCROW_RELEASE_FAILED';
                obligation.version++;
                continue;
            }
            obligation.breachedAt = now;
            storyNegotiationDeliveryBreachEffects(obligation);
        }
        const penalty = typeof storyCompanyPayContractPenalty === 'function'
            ? storyCompanyPayContractPenalty(obligation.sellerCompanyId, obligation.buyerCompanyId,
                obligation.penaltyAmount, { correlationId: `${obligation.id}:penalty`,
                    negotiationCaseId: obligation.caseId, negotiationVersionId: obligation.versionId,
                    shipmentId: obligation.shipmentId })
            : { ok: false, code: 'CONTRACT_PENALTY_EXECUTOR_UNAVAILABLE' };
        if (!penalty.ok) {
            obligation.status = 'BREACH_PAYMENT_PENDING';
            obligation.lastErrorCode = penalty.code || 'CONTRACT_PENALTY_FAILED';
            obligation.penaltyAttempts = Math.max(0, Number(obligation.penaltyAttempts) || 0) + 1;
            obligation.nextPenaltyRetryAt = Number((now
                + STORY_NEGOTIATION_PENALTY_RETRY_SECONDS).toFixed(9));
            obligation.version++;
            if (caseRow) {
                caseRow.status = 'BREACH_PAYMENT_PENDING';
                caseRow.execution = { status: 'BREACH_PAYMENT_PENDING', receiptId: obligation.id };
                caseRow.updatedAt = now;
            }
            pendingPenalty++;
            worldMutation = true;
            if (obligation.mechanicalContractId
                && typeof storyMechanicalContractSyncDelivery === 'function') {
                storyMechanicalContractSyncDelivery(obligation.mechanicalContractId, obligation);
            }
            continue;
        }
        obligation.status = 'BROKEN';
        obligation.resolvedAt = now;
        obligation.lastErrorCode = null;
        obligation.nextPenaltyRetryAt = null;
        obligation.penaltyTransactionIds = [penalty.debitTransaction && penalty.debitTransaction.id,
            penalty.creditTransaction && penalty.creditTransaction.id].filter(Boolean);
        obligation.version++;
        if (obligation.mechanicalContractId
            && typeof storyMechanicalContractSyncDelivery === 'function') {
            storyMechanicalContractSyncDelivery(obligation.mechanicalContractId, obligation);
        }
        if (caseRow) {
            caseRow.status = 'BREACHED';
            caseRow.execution = { status: 'BREACH_SETTLED', receiptId: obligation.id };
            caseRow.updatedAt = now;
        }
        ledger.diagnostics.deliveriesBroken++;
        broken++;
        worldMutation = true;
        storyNegotiationEvent(ledger, { kind: 'DELIVERY_OBLIGATION_BROKEN', caseId: obligation.caseId,
            deliveryObligationId: obligation.id, shipmentId: obligation.shipmentId,
            penaltyAmount: obligation.penaltyAmount, worldMutation: true });
    }
    return { checked, kept, broken, pendingPenalty, worldMutation };
}

function storyNegotiationValidate(candidate) {
    const issues = [];
    const add = (code, path) => issues.push({ code, path });
    if (!candidate || typeof candidate !== 'object') return { ok: false, issues: [{ code: 'LEDGER_OBJECT', path: '$' }] };
    if (candidate.schemaVersion !== STORY_NEGOTIATION_SCHEMA_VERSION) add('SCHEMA_VERSION', '$.schemaVersion');
    if (candidate.adapterVersion !== STORY_NEGOTIATION_ADAPTER_VERSION) add('ADAPTER_VERSION', '$.adapterVersion');
    if (!candidate.cases || typeof candidate.cases !== 'object' || Array.isArray(candidate.cases)) add('CASES', '$.cases');
    if (!candidate.commitments || typeof candidate.commitments !== 'object'
        || Array.isArray(candidate.commitments)) add('COMMITMENTS', '$.commitments');
    if (!candidate.secrets || typeof candidate.secrets !== 'object'
        || Array.isArray(candidate.secrets)) add('SECRETS', '$.secrets');
    if (!candidate.deliveryObligations || typeof candidate.deliveryObligations !== 'object'
        || Array.isArray(candidate.deliveryObligations)) add('DELIVERY_OBLIGATIONS', '$.deliveryObligations');
    if (!candidate.consequenceCandidates || typeof candidate.consequenceCandidates !== 'object'
        || Array.isArray(candidate.consequenceCandidates)) add('CONSEQUENCE_CANDIDATES', '$.consequenceCandidates');
    if (!Array.isArray(candidate.events) || candidate.events.length > STORY_NEGOTIATION_EVENT_LIMIT) add('EVENTS', '$.events');
    for (const [id, row] of Object.entries(candidate.cases || {})) {
        const at = `$.cases.${id}`;
        if (row.id !== id || !Number.isInteger(row.sequence) || row.sequence < 1) add('CASE_IDENTITY', at);
        if (!STORY_NEGOTIATION_STATUSES.includes(row.status)) add('CASE_STATUS', `${at}.status`);
        if (!Array.isArray(row.partyActorIds) || row.partyActorIds.length !== 2
            || new Set(row.partyActorIds).size !== 2) add('PARTIES', `${at}.partyActorIds`);
        const grounding = row.mechanicalGrounding;
        if (!grounding || grounding.adapterVersion !== 'story-negotiation-mechanical-grounding-1'
            || !Array.isArray(grounding.entities) || !Array.isArray(grounding.requests)
            || !Array.isArray(grounding.claims)) add('MECHANICAL_GROUNDING', `${at}.mechanicalGrounding`);
        if (grounding) {
            const groundingBody = storyNegotiationClone(grounding);
            delete groundingBody.contentHash;
            if (storyNegotiationHash(groundingBody) !== grounding.contentHash
                || grounding.sourceCandidateHash !== row.sourceCandidateHash) {
                add('MECHANICAL_GROUNDING_HASH', `${at}.mechanicalGrounding`);
            }
        }
        if (!Array.isArray(row.mechanicalReviews)
            || row.mechanicalReviews.length > STORY_NEGOTIATION_MECHANICAL_REVIEW_LIMIT) {
            add('MECHANICAL_REVIEWS', `${at}.mechanicalReviews`);
        }
        if (!Array.isArray(row.versions) || !row.versions.length
            || row.versions.length > STORY_NEGOTIATION_VERSION_LIMIT) add('VERSIONS', `${at}.versions`);
        if (!row.versions.some(version => version.id === row.currentVersionId)) add('CURRENT_VERSION', `${at}.currentVersionId`);
        for (const version of (row.versions || [])) {
            if (version.executable !== false || version.worldMutation !== false) add('VERSION_MUTATION', `${at}.versions`);
            if (!row.partyActorIds.includes(version.proposerActorId)) add('VERSION_PROPOSER', `${at}.versions`);
            if ((version.acceptedByActorIds || []).some(actorId => !row.partyActorIds.includes(actorId))) add('VERSION_ACCEPTANCE', `${at}.versions`);
            if (!STORY_NEGOTIATION_TERM_KEYS.every(key => version.terms && version.terms[key]
                && Number.isFinite(Number(version.terms[key].amount)) && Number(version.terms[key].amount) > 0
                && String(version.terms[key].unit || '').trim())) add('VERSION_TERMS', `${at}.versions.${version.number}`);
            const body = {
                caseId: row.id, number: version.number, proposerActorId: version.proposerActorId,
                terms: version.terms, concessions: version.concessions,
                evidenceSubmissionIds: version.evidenceSubmissionIds,
                supersedesVersionId: version.supersedesVersionId || null
            };
            if (storyNegotiationHash(body) !== version.contentHash) add('VERSION_HASH', `${at}.versions.${version.number}`);
        }
        const authority = Array.isArray(row.requiredApprovals)
            ? row.requiredApprovals.find(item => item.kind === 'MECHANICAL_CONTRACT_AUTHORITY')
            : null;
        const lifecycleStatus = ['ACTIVE', 'FULFILLED', 'BREACHED', 'BREACH_PAYMENT_PENDING'].includes(row.status);
        const deliveryReceipt = row.execution && candidate.deliveryObligations
            && candidate.deliveryObligations[row.execution.receiptId];
        const authorityValid = lifecycleStatus
            ? authority && authority.status === 'APPROVED' && authority.obligationId
                && deliveryReceipt && authority.obligationId === deliveryReceipt.id
            : authority && authority.status === 'PENDING';
        if (!authorityValid) add('EXECUTION_APPROVAL', `${at}.requiredApprovals`);
        const preflightStatuses = ['NOT_AUTHORIZED', 'PREFLIGHT_BLOCKED', 'PREFLIGHT_READY'];
        const lifecycleExecutionStatuses = ['TRACKING_DELIVERY', 'DELIVERY_SETTLED',
            'BREACH_PAYMENT_PENDING', 'BREACH_SETTLED'];
        const receiptValid = row.execution && row.execution.status === 'NOT_AUTHORIZED'
            ? row.execution.receiptId === null
            : row.execution && preflightStatuses.includes(row.execution.status)
                ? (row.mechanicalReviews || []).some(review => review.id === row.execution.receiptId)
                : !!deliveryReceipt && deliveryReceipt.caseId === row.id;
        const executionStatusValid = row.execution && (lifecycleStatus
            ? lifecycleExecutionStatuses.includes(row.execution.status)
            : preflightStatuses.includes(row.execution.status));
        if (!executionStatusValid || !receiptValid || row.executable !== false
            || row.worldMutation !== lifecycleStatus) {
            add('CASE_MUTATION', at);
        }
        for (const review of (row.mechanicalReviews || [])) {
            const reviewAt = `${at}.mechanicalReviews.${review && review.id}`;
            if (!review || review.caseId !== row.id || !row.versions.some(version => version.id === review.versionId)
                || !row.partyActorIds.includes(review.requestedByActorId)) add('MECHANICAL_REVIEW_IDENTITY', reviewAt);
            if (!['BLOCKED', 'READY'].includes(review && review.status)
                || !Array.isArray(review && review.checks) || !Array.isArray(review && review.blockerCodes)) {
                add('MECHANICAL_REVIEW_STATUS', reviewAt);
            }
            const blockers = (review && review.checks || []).filter(check => check.status !== 'PASS').map(check => check.code);
            if (storyNegotiationHash(blockers) !== storyNegotiationHash(review && review.blockerCodes)
                || (!!blockers.length) !== (review && review.status === 'BLOCKED')
                || review.executable !== false || review.worldMutation !== false) {
                add('MECHANICAL_REVIEW_BLOCKERS', reviewAt);
            }
        }
    }
    const consequenceRows = Object.entries(candidate.consequenceCandidates || {});
    if (consequenceRows.length > STORY_NEGOTIATION_CONSEQUENCE_LIMIT) {
        add('CONSEQUENCE_LIMIT', '$.consequenceCandidates');
    }
    for (const [id, row] of consequenceRows) {
        const at = `$.consequenceCandidates.${id}`;
        if (!row || row.id !== id || row.schemaVersion !== 1
            || !Number.isInteger(row.sequence) || row.sequence < 1) add('CONSEQUENCE_IDENTITY', at);
        if (!candidate.commitments[row && row.sourceCommitmentId]
            || !candidate.cases[row && row.caseId]) add('CONSEQUENCE_SOURCE', at);
        if (!['KEPT', 'BROKEN'].includes(row && row.triggerStatus)
            || !['COOPERATIVE_FOLLOW_UP', 'COMMERCIAL_DISPUTE'].includes(row && row.kind)
            || !['OPEN', 'REVIEWED'].includes(row && row.status)) add('CONSEQUENCE_STATE', at);
        if (!Array.isArray(row && row.nextStepCodes) || !row.nextStepCodes.length
            || row.executable !== false || row.worldMutation !== false
            || (row.peaceCandidate !== null && !(row.diplomaticReview
                && storyNegotiationHash(row.diplomaticReview.peaceCandidate)
                    === storyNegotiationHash(row.peaceCandidate)))
            || (row.warCandidate !== null && !(row.diplomaticReview
                && storyNegotiationHash(row.diplomaticReview.warCandidate)
                    === storyNegotiationHash(row.warCandidate)))) {
            add('CONSEQUENCE_SAFETY', at);
        }
        if (row && row.status === 'REVIEWED') {
            const review = row.diplomaticReview;
            if (!review || review.consequenceCandidateId !== row.id || review.schemaVersion !== 1
                || review.executable !== false || review.worldMutation !== false
                || !Array.isArray(review.evidenceIds)
                || !Array.isArray(review.blockedReasons)
                || !review.thresholds || !Number.isFinite(Number(review.verifiedEconomicDamage))
                || !review.damageAssessment || review.damageAssessment.schemaVersion !== 1
                || !Array.isArray(review.damageAssessment.entries)
                || !Array.isArray(review.damageAssessment.unmeasuredClaims)
                || !review.damageAssessment.totals
                || Number(review.damageAssessment.totals.uncompensatedDamage)
                    !== Number(review.verifiedEconomicDamage)
                || ['contractualValue', 'refundedPrincipal', 'penaltyCompensation',
                    'verifiedDirectLoss', 'uncompensatedDamage'].some(key => {
                    const sum = review.damageAssessment.entries.reduce((total, entry) =>
                        total + Number(entry[key] || 0), 0);
                    return sum !== Number(review.damageAssessment.totals[key] || 0);
                })
                || review.damageAssessment.unmeasuredClaims.some(claim =>
                    claim.status !== 'UNVERIFIED' || claim.includedInDamage !== false)
                || review.damageAssessment.entries.some(entry =>
                    !String(entry.deliveryObligationId || '').trim()
                    || !Array.isArray(entry.evidenceIds)
                    || Number(entry.uncompensatedDamage) < 0)) {
                add('DIPLOMATIC_REVIEW', `${at}.diplomaticReview`);
            }
            if (review && review.protestExecution) {
                const execution = review.protestExecution;
                if (execution.schemaVersion !== 1 || execution.consequenceCandidateId !== row.id
                    || !String(execution.authorityRequestId || '').trim()
                    || !String(execution.issuingCountryId || '').trim()
                    || !String(execution.targetCountryId || '').trim()
                    || execution.issuingCountryId === execution.targetCountryId
                    || !Number.isFinite(Number(execution.relationBefore))
                    || !Number.isFinite(Number(execution.relationAfter))
                    || Number(execution.relationAfter) - Number(execution.relationBefore)
                        !== Number(execution.relationDelta)
                    || execution.treatyMutation !== false || execution.warMutation !== false
                    || !review.protestCandidate || review.protestCandidate.status !== 'ISSUED'
                    || review.requiresStateAuthority !== false) {
                    add('DIPLOMATIC_PROTEST_EXECUTION', `${at}.diplomaticReview.protestExecution`);
                }
            }
            if (review && review.warExecution) {
                const execution = review.warExecution;
                if (execution.schemaVersion !== 1 || execution.consequenceCandidateId !== row.id
                    || !String(execution.authorityRequestId || '').trim()
                    || execution.treatyAfter !== 'war' || execution.warMutation !== true
                    || !review.warCandidate || review.warCandidate.status !== 'DECLARED'
                    || !review.peaceCandidate
                    || review.peaceCandidate.status === 'AWAITING_CONSTITUTIONAL_AUTHORITY') {
                    add('CONSTITUTIONAL_WAR_EXECUTION', `${at}.diplomaticReview.warExecution`);
                }
            }
            if (review && review.peaceExecution) {
                const execution = review.peaceExecution;
                if (execution.schemaVersion !== 1 || execution.consequenceCandidateId !== row.id
                    || !Array.isArray(execution.authorityRequestIds)
                    || execution.authorityRequestIds.length !== 2
                    || !Array.isArray(execution.signatoryCountryIds)
                    || execution.signatoryCountryIds.length !== 2
                    || execution.treatyBefore !== 'war' || execution.treatyAfter !== 'peace'
                    || execution.peaceMutation !== true
                    || !review.peaceCandidate || review.peaceCandidate.status !== 'SIGNED') {
                    add('CONSTITUTIONAL_PEACE_EXECUTION', `${at}.diplomaticReview.peaceExecution`);
                }
            }
        }
    }
    for (const [id, obligation] of Object.entries(candidate.deliveryObligations || {})) {
        const at = `$.deliveryObligations.${id}`;
        const caseRow = candidate.cases && candidate.cases[obligation.caseId];
        const version = caseRow && (caseRow.versions || []).find(row => row.id === obligation.versionId);
        const review = caseRow && (caseRow.mechanicalReviews || []).find(row => row.id === obligation.mechanicalReviewId);
        if (obligation.id !== id || !Number.isInteger(obligation.sequence) || obligation.sequence < 1
            || !caseRow || !version || !review || review.versionId !== obligation.versionId
            || review.status !== 'READY') add('DELIVERY_IDENTITY', at);
        if (!['OPEN', 'SETTLEMENT_PENDING', 'BREACH_PAYMENT_PENDING', 'KEPT', 'BROKEN']
            .includes(obligation.status)) add('DELIVERY_STATUS', `${at}.status`);
        if (!caseRow || !caseRow.partyActorIds.includes(obligation.buyerActorId)
            || !caseRow.partyActorIds.includes(obligation.sellerActorId)
            || obligation.buyerActorId === obligation.sellerActorId) add('DELIVERY_ACTORS', at);
        if (!String(obligation.shipmentId || '').trim()
            || !String(obligation.buyerCompanyId || '').trim()
            || !String(obligation.sellerCompanyId || '').trim()
            || obligation.buyerCompanyId === obligation.sellerCompanyId
            || !String(obligation.resourceId || '').trim()
            || !String(obligation.destinationWarehouseId || '').trim()
            || !String(obligation.targetRegionId || '').trim()
            || !String(obligation.tradeAmendmentId || '').trim()) add('DELIVERY_GROUNDING', at);
        if (!Number.isFinite(Number(obligation.quantity)) || Number(obligation.quantity) <= 0
            || !Number.isFinite(Number(obligation.paymentAmount)) || Number(obligation.paymentAmount) <= 0
            || !Number.isFinite(Number(obligation.penaltyAmount)) || Number(obligation.penaltyAmount) <= 0) {
            add('DELIVERY_VALUE', at);
        }
        const transferMode = obligation.transferMode || 'DIRECT_NEGOTIATED_DELIVERY';
        if (!['DIRECT_NEGOTIATED_DELIVERY', 'BUYER_TO_BUYER_RESALE'].includes(transferMode)) {
            add('DELIVERY_TRANSFER_MODE', at);
        }
        if (transferMode === 'BUYER_TO_BUYER_RESALE'
            && (!String(obligation.originalBuyerCompanyId || '').trim()
                || !String(obligation.originalSellerCompanyId || '').trim()
                || !String(obligation.primarySettlementReservationId || '').trim()
                || obligation.originalBuyerCompanyId !== obligation.sellerCompanyId
                || obligation.originalBuyerCompanyId === obligation.buyerCompanyId)) {
            add('DELIVERY_RESALE_CHAIN', at);
        }
        const authority = caseRow && Array.isArray(caseRow.requiredApprovals)
            ? caseRow.requiredApprovals.find(row => row.kind === 'MECHANICAL_CONTRACT_AUTHORITY')
            : null;
        if (obligation.mechanicalContractId != null
            && (!String(obligation.mechanicalContractId).trim()
                || !authority || authority.mechanicalContractId !== obligation.mechanicalContractId)) {
            add('DELIVERY_MECHANICAL_CONTRACT_LINK', at);
        }
        if (!Number.isFinite(Number(obligation.createdAt))
            || !Number.isFinite(Number(obligation.dueAt))
            || Number(obligation.dueAt) <= Number(obligation.createdAt)
            || !String(obligation.escrowReservationId || '').trim()) add('DELIVERY_DEADLINE', at);
        const unresolved = ['OPEN', 'SETTLEMENT_PENDING'].includes(obligation.status);
        const pendingBreach = obligation.status === 'BREACH_PAYMENT_PENDING';
        const kept = obligation.status === 'KEPT';
        const broken = obligation.status === 'BROKEN';
        if (unresolved && (obligation.deliveredAt !== null || obligation.breachedAt !== null
            || obligation.resolvedAt !== null)) add('DELIVERY_OPEN_EFFECT', at);
        if (pendingBreach && (obligation.breachedAt === null || !Number.isFinite(Number(obligation.breachedAt))
            || obligation.resolvedAt !== null || !Number.isInteger(obligation.penaltyAttempts)
            || obligation.penaltyAttempts < 1
            || !Number.isFinite(Number(obligation.nextPenaltyRetryAt))
            || Number(obligation.nextPenaltyRetryAt) <= Number(obligation.breachedAt))) {
            add('DELIVERY_PENDING_BREACH', at);
        }
        if (kept && (obligation.deliveredAt === null || !Number.isFinite(Number(obligation.deliveredAt))
            || obligation.resolvedAt === null || !Number.isFinite(Number(obligation.resolvedAt))
            || obligation.breachedAt !== null)) {
            add('DELIVERY_KEPT', at);
        }
        if (broken && (obligation.breachedAt === null || !Number.isFinite(Number(obligation.breachedAt))
            || obligation.resolvedAt === null || !Number.isFinite(Number(obligation.resolvedAt))
            || obligation.nextPenaltyRetryAt !== null
            || !Array.isArray(obligation.penaltyTransactionIds)
            || obligation.penaltyTransactionIds.length < 1)) add('DELIVERY_BROKEN', at);
    }
    for (const [id, commitment] of Object.entries(candidate.commitments || {})) {
        const at = `$.commitments.${id}`;
        const caseRow = candidate.cases && candidate.cases[commitment.caseId];
        if (commitment.id !== id || !caseRow) add('COMMITMENT_IDENTITY', at);
        if (!['OPEN', 'KEPT', 'BROKEN'].includes(commitment.status)) add('COMMITMENT_STATUS', `${at}.status`);
        if (!STORY_NEGOTIATION_OBLIGATIONS.includes(commitment.obligationCode)) add('COMMITMENT_OBLIGATION', `${at}.obligationCode`);
        if (!caseRow || !caseRow.partyActorIds.includes(commitment.promisorActorId)
            || !caseRow.partyActorIds.includes(commitment.promiseeActorId)
            || commitment.promisorActorId === commitment.promiseeActorId) add('COMMITMENT_PARTIES', at);
        if (!Number.isFinite(Number(commitment.dueAt)) || Number(commitment.dueAt) <= Number(commitment.createdAt)) add('COMMITMENT_DEADLINE', `${at}.dueAt`);
        if (commitment.status === 'OPEN' && (commitment.resolvedAt !== null
            || commitment.resolutionEventId !== null || commitment.effectsApplied)) add('OPEN_COMMITMENT_EFFECT', at);
        if (commitment.status !== 'OPEN' && (!commitment.resolutionEventId
            || !Number.isFinite(Number(commitment.resolvedAt)))) add('RESOLVED_COMMITMENT', at);
    }
    for (const [id, secret] of Object.entries(candidate.secrets || {})) {
        const at = `$.secrets.${id}`;
        const caseRow = candidate.cases && candidate.cases[secret.caseId];
        if (secret.id !== id || !caseRow || !Number.isInteger(secret.sequence) || secret.sequence < 1) {
            add('SECRET_IDENTITY', at);
        }
        if (!caseRow || !caseRow.partyActorIds.includes(secret.ownerActorId)) add('SECRET_OWNER', `${at}.ownerActorId`);
        if (!secret.worldFactId || !secret.sourceBeliefId || !secret.memoryMilestoneId) add('SECRET_SOURCES', at);
        if (!Array.isArray(secret.holderActorIds) || !secret.holderActorIds.includes(secret.ownerActorId)
            || new Set(secret.holderActorIds).size !== secret.holderActorIds.length) add('SECRET_HOLDERS', `${at}.holderActorIds`);
        if (!Array.isArray(secret.allowedDisclosureActorIds)
            || new Set(secret.allowedDisclosureActorIds).size !== secret.allowedDisclosureActorIds.length) {
            add('SECRET_AUTHORIZATIONS', `${at}.allowedDisclosureActorIds`);
        }
        if (!Array.isArray(secret.disclosures)
            || secret.disclosures.length > STORY_NEGOTIATION_DISCLOSURE_LIMIT) add('SECRET_DISCLOSURES', `${at}.disclosures`);
        for (const disclosure of (secret.disclosures || [])) {
            const disclosureAt = `${at}.disclosures.${disclosure && disclosure.id}`;
            if (!disclosure || !disclosure.id || !secret.holderActorIds.includes(disclosure.discloserActorId)
                || disclosure.discloserActorId === disclosure.recipientActorId) add('DISCLOSURE_ACTORS', disclosureAt);
            if (!['AUTHORIZED', 'UNDISCOVERED_UNAUTHORIZED', 'DISCOVERED_AUTHORIZED',
                'DISCOVERED_UNAUTHORIZED'].includes(disclosure && disclosure.status)) add('DISCLOSURE_STATUS', disclosureAt);
            if (!disclosure.disclosureWorldFactId || !Array.isArray(disclosure.disclosureBeliefIds)
                || disclosure.disclosureBeliefIds.length !== 2) add('DISCLOSURE_EVIDENCE', disclosureAt);
            const discovered = disclosure && disclosure.discoveredAt !== null;
            if (discovered !== String(disclosure && disclosure.status).startsWith('DISCOVERED')) {
                add('DISCLOSURE_DISCOVERY_STATE', disclosureAt);
            }
            if (disclosure && disclosure.effectsApplied && (disclosure.authorized
                || disclosure.status !== 'DISCOVERED_UNAUTHORIZED')) add('DISCLOSURE_EFFECT', disclosureAt);
        }
    }
    return { ok: issues.length === 0, issues };
}

function storyNegotiationSnapshot() {
    return storyNegotiationClone(storyNegotiationEnsure());
}

function storyNegotiationForSave() {
    const snapshot = storyNegotiationSnapshot();
    const validation = storyNegotiationValidate(snapshot);
    return validation.ok ? snapshot : null;
}

function storyNegotiationRestore(candidate) {
    if (!storyNegotiationEnabled()) {
        STORY.negotiations = null;
        return { loaded: false, validation: { ok: true, issues: [] } };
    }
    const clone = storyNegotiationLedgerMigrate(storyNegotiationClone(candidate || storyNegotiationLedgerCreate()));
    const validation = storyNegotiationValidate(clone);
    STORY.negotiations = validation.ok ? clone : storyNegotiationLedgerCreate();
    return { loaded: validation.ok && !!candidate, validation };
}
