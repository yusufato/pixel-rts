// ============================================================================
//  PATRONAJ, YOLSUZLUK VE SORUSTURMA — Faz 32
//  --------------------------------------------------------------------------
//  Yapısal yolsuzluk riski suç değildir. Bu katman yalnız gerçek kurum kararı,
//  bütçe fişi, şirket kimliği ve kaynaklı delil üzerinden dosya açar. Kırmızı
//  bayrak, iddia ve doğrulanmış bulgu ayrı durumlardır; RNG/LLM hüküm vermez.
//  Dünya ekonomisine doğrudan yazılmaz.
// ============================================================================

const STORY_INTEGRITY_SCHEMA_VERSION = 1;
const STORY_INTEGRITY_ADAPTER_VERSION = 'story-integrity-investigation-ledger-1';
const STORY_INTEGRITY_CASE_STATUSES = Object.freeze([
    'ALLEGATION', 'PRELIMINARY_REVIEW', 'FORMAL_INVESTIGATION',
    'SUBSTANTIATED', 'UNSUBSTANTIATED', 'CLOSED'
]);
const STORY_INTEGRITY_POLICY = Object.freeze({
    maximumCases: 160,
    maximumEvidence: 640,
    maximumEvents: 640,
    singleBidRiskBps: 2600,
    priceDeviationRiskBps: 4200,
    lobbyRiskScale: 0.35,
    formalInvestigationMinimumEvidenceBps: 2500,
    substantiationThresholdBps: 6000,
    resultModel: 'INTEGRITY_FINDING_RECORD_ONLY_PHASE_32',
    physicalMutation: false,
    actorModel: 'CANONICAL_OR_EXPLICIT_PROXY_PRE_PHASE_34'
});
const STORY_INTEGRITY_POLICY_HASH = storyProductionHash({
    schemaVersion: STORY_INTEGRITY_SCHEMA_VERSION,
    adapterVersion: STORY_INTEGRITY_ADAPTER_VERSION,
    policy: STORY_INTEGRITY_POLICY
});

function storyIntegrityEnabled() {
    return (typeof storyFeatureEnabled !== 'function' || storyFeatureEnabled('government.patronageIntegrity'))
        && (typeof storyInstitutionEnabled !== 'function' || storyInstitutionEnabled())
        && (typeof storyStateCapacityEnabled !== 'function' || storyStateCapacityEnabled())
        && (typeof storyCompanyEnabled !== 'function' || storyCompanyEnabled())
        && (typeof storyBudgetEnabled !== 'function' || storyBudgetEnabled());
}
function storyIntegrityClone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function storyIntegrityRound(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 1e6) / 1e6 : 0;
}
function storyIntegrityClampBps(value) { return Math.max(0, Math.min(10000, Math.round(Number(value) || 0))); }
function storyIntegrityCountryId(value) {
    const raw = String(value == null ? '' : value);
    return raw.startsWith('country:') ? raw : `country:${Number(value)}`;
}
function storyIntegrityRecordEvent(ledger, type, payload) {
    const event = Object.assign({
        id: `integrity-event:${ledger.nextEventSequence}`,
        sequence: ledger.nextEventSequence++, type: String(type),
        at: storyIntegrityRound(STORY.clock)
    }, storyIntegrityClone(payload || {}));
    ledger.events.push(event);
    if (ledger.events.length > STORY_INTEGRITY_POLICY.maximumEvents) {
        ledger.events.splice(0, ledger.events.length - STORY_INTEGRITY_POLICY.maximumEvents);
    }
    return event;
}
function storyIntegrityCountryCreate(state) {
    return {
        countryId: storyIntegrityCountryId(state.id), caseIds: [],
        allegationCount: 0, openInvestigationCount: 0,
        substantiatedCount: 0, unsubstantiatedCount: 0,
        lastCaseAt: null, updatedAt: storyIntegrityRound(STORY.clock)
    };
}
function storyIntegrityLedgerCreate(options) {
    const countries = {};
    for (const state of (STORY.states || [])) {
        const row = storyIntegrityCountryCreate(state);
        countries[row.countryId] = row;
    }
    return {
        schemaVersion: STORY_INTEGRITY_SCHEMA_VERSION,
        adapterVersion: STORY_INTEGRITY_ADAPTER_VERSION,
        policyHash: STORY_INTEGRITY_POLICY_HASH,
        institutionPolicyHash: typeof STORY_INSTITUTION_POLICY_HASH === 'string' ? STORY_INSTITUTION_POLICY_HASH : null,
        stateCapacityPolicyHash: typeof STORY_STATE_CAPACITY_POLICY_HASH === 'string' ? STORY_STATE_CAPACITY_POLICY_HASH : null,
        companyPolicyHash: typeof STORY_COMPANY_POLICY_HASH === 'string' ? STORY_COMPANY_POLICY_HASH : null,
        budgetPolicyHash: typeof STORY_BUDGET_POLICY_HASH === 'string' ? STORY_BUDGET_POLICY_HASH : null,
        tickSequence: 0, lastTickAt: null, nextCaseSequence: 1,
        nextEvidenceSequence: 1, nextEventSequence: 1,
        countries, cases: {}, evidence: {}, events: [],
        consumedSourceIds: {},
        diagnostics: {
            backfilled: !!(options && options.backfilled),
            restoredFromInvalidLedger: !!(options && options.restoredFromInvalidLedger),
            issues: storyIntegrityClone(options && options.issues || []), warnings: [],
            randomDecisions: false, llmDecisions: false,
            riskIsNotProof: true, physicalMutation: false
        }
    };
}
function storyIntegrityRecount(ledger) {
    for (const country of Object.values(ledger.countries || {})) {
        const cases = country.caseIds.map(id => ledger.cases[id]).filter(Boolean);
        country.allegationCount = cases.length;
        country.openInvestigationCount = cases.filter(row => row.status === 'FORMAL_INVESTIGATION').length;
        country.substantiatedCount = cases.filter(row => row.status === 'SUBSTANTIATED').length;
        country.unsubstantiatedCount = cases.filter(row => row.status === 'UNSUBSTANTIATED').length;
    }
}
function storyIntegrityEvidenceScore(ledger, caseRow) {
    const rows = caseRow.evidenceIds.map(id => ledger.evidence[id]).filter(Boolean);
    let support = 0;
    let rebuttal = 0;
    for (const row of rows) {
        const score = Math.round(row.authenticityBps * row.relevanceBps / 10000);
        if (row.direction === 'NEUTRAL') continue;
        if (row.direction === 'REBUTS') rebuttal += score;
        else support += score;
    }
    // Aynı sonuca giden çok sayıda zayıf belirti doğrusal biçimde %100 kanıt olamaz.
    support = Math.round(10000 * (1 - Math.exp(-support / 10000)));
    rebuttal = Math.round(10000 * (1 - Math.exp(-rebuttal / 10000)));
    return storyIntegrityClampBps(support - Math.round(rebuttal * 0.8));
}
function storyIntegrityAddEvidence(ledger, caseRow, spec) {
    const sourceId = String(spec.sourceId || '');
    const dedupeId = `${caseRow.id}|${sourceId}|${String(spec.type)}`;
    const existing = Object.values(ledger.evidence).find(row => row.dedupeId === dedupeId);
    if (existing) return existing;
    if (Object.keys(ledger.evidence).length >= STORY_INTEGRITY_POLICY.maximumEvidence) return null;
    const direction = ['SUPPORTS', 'REBUTS', 'NEUTRAL'].includes(spec.direction)
        ? spec.direction : 'SUPPORTS';
    const row = {
        id: `integrity-evidence:${ledger.nextEvidenceSequence++}`,
        dedupeId, caseId: caseRow.id, countryId: caseRow.countryId,
        type: String(spec.type), sourceId,
        sourceKind: String(spec.sourceKind),
        direction,
        authenticityBps: storyIntegrityClampBps(spec.authenticityBps),
        relevanceBps: storyIntegrityClampBps(spec.relevanceBps),
        public: !!spec.public, createdAt: storyIntegrityRound(STORY.clock),
        summaryCode: String(spec.summaryCode || spec.type)
    };
    ledger.evidence[row.id] = row;
    caseRow.evidenceIds.push(row.id);
    caseRow.evidenceScoreBps = storyIntegrityEvidenceScore(ledger, caseRow);
    storyIntegrityRecordEvent(ledger, 'EVIDENCE_ATTACHED', {
        caseId: caseRow.id, evidenceId: row.id, type: row.type, public: row.public
    });
    if (typeof storyMemoryRecordPrivateIntegrityEvidence === 'function') {
        storyMemoryRecordPrivateIntegrityEvidence(caseRow, row);
    }
    return row;
}
function storyIntegrityCreateCase(ledger, spec) {
    const countryId = storyIntegrityCountryId(spec.countryId);
    const country = ledger.countries[countryId];
    if (!country) return { ok: false, reason: 'UNKNOWN_COUNTRY' };
    const sourceKey = String(spec.sourceKey || '');
    if (!sourceKey) return { ok: false, reason: 'SOURCE_KEY_REQUIRED' };
    const existingId = ledger.consumedSourceIds[sourceKey];
    if (existingId && ledger.cases[existingId]) return { ok: true, duplicate: true, case: storyIntegrityClone(ledger.cases[existingId]) };
    if (Object.keys(ledger.cases).length >= STORY_INTEGRITY_POLICY.maximumCases) {
        return { ok: false, reason: 'CASE_BUDGET_EXHAUSTED' };
    }
    const row = {
        id: `integrity-case:${ledger.nextCaseSequence++}`,
        countryId, kind: String(spec.kind), subjectActorId: spec.subjectActorId ? String(spec.subjectActorId) : null,
        beneficiaryCompanyId: spec.beneficiaryCompanyId ? String(spec.beneficiaryCompanyId) : null,
        authorityRequestId: spec.authorityRequestId ? String(spec.authorityRequestId) : null,
        sourceKey, status: 'ALLEGATION', redFlags: storyIntegrityClone(spec.redFlags || []),
        evidenceIds: [], evidenceScoreBps: 0,
        investigationRequestId: null, openedAt: storyIntegrityRound(STORY.clock),
        investigationOpenedAt: null, resolvedAt: null, resolutionCode: null,
        resultModel: STORY_INTEGRITY_POLICY.resultModel,
        physicalMutation: false
    };
    ledger.cases[row.id] = row;
    ledger.consumedSourceIds[sourceKey] = row.id;
    country.caseIds.push(row.id);
    country.lastCaseAt = row.openedAt;
    country.updatedAt = row.openedAt;
    storyIntegrityRecordEvent(ledger, 'ALLEGATION_REGISTERED', {
        caseId: row.id, countryId, kind: row.kind, redFlags: row.redFlags
    });
    return { ok: true, case: row };
}
function storyIntegrityInstitutionRequest(requestId, actionTypes) {
    const ledger = STORY.institutions;
    const request = ledger && ledger.requests && ledger.requests[String(requestId)];
    return request && request.status === 'EXECUTED' && actionTypes.includes(request.actionType) ? request : null;
}
function storyIntegrityBudgetTransaction(countryId, transactionId) {
    const budget = STORY.stateBudget && STORY.stateBudget.countries
        ? STORY.stateBudget.countries[storyIntegrityCountryId(countryId)] : null;
    return budget && (budget.journal || []).find(row => row.id === String(transactionId));
}
function storyIntegrityCompany(companyId, countryId) {
    const row = STORY.companyEconomy && STORY.companyEconomy.companies
        ? STORY.companyEconomy.companies[String(companyId)] : null;
    return row && row.countryId === storyIntegrityCountryId(countryId) ? row : null;
}

function storyIntegrityRegisterProcurement(spec) {
    const ledger = storyIntegrityEnsure();
    if (!ledger) return { ok: false, reason: 'INTEGRITY_LAYER_DISABLED' };
    spec = spec || {};
    const request = storyIntegrityInstitutionRequest(spec.authorityRequestId, ['AUTHORIZE_BUDGET']);
    if (!request) return { ok: false, reason: 'EXECUTED_BUDGET_AUTHORITY_REQUIRED' };
    const tx = storyIntegrityBudgetTransaction(request.countryId, spec.budgetTransactionId);
    if (!tx || tx.source !== 'institutional.procurement') return { ok: false, reason: 'PROCUREMENT_BUDGET_RECEIPT_REQUIRED' };
    const company = storyIntegrityCompany(spec.companyId, request.countryId);
    if (!company) return { ok: false, reason: 'CANONICAL_COMPANY_REQUIRED' };
    const amount = Math.max(0, tx.postings.reduce((max, row) => Math.max(max, Number(row.amount) || 0), 0));
    const benchmark = Math.max(0, Number(spec.benchmarkAmount) || 0);
    const bidCount = Math.max(0, Math.floor(Number(spec.competitiveBidCount) || 0));
    const priceDeviationBps = benchmark > 0 ? storyIntegrityClampBps((amount / benchmark - 1) * 10000) : 0;
    const redFlags = [];
    if (bidCount < 2) redFlags.push('SINGLE_BID_OR_NO_COMPETITION');
    if (priceDeviationBps >= 2000) redFlags.push('PRICE_ABOVE_BENCHMARK');
    if ((Number(company.lobbyInfluence) || 0) >= 25) redFlags.push('HIGH_BENEFICIARY_LOBBY_INFLUENCE');
    if (!redFlags.length) {
        return {
            ok: true,
            noCase: true,
            reason: 'NO_INTEGRITY_RED_FLAGS',
            receipt: { authorityRequestId: request.id, budgetTransactionId: tx.id, companyId: company.id }
        };
    }
    const created = storyIntegrityCreateCase(ledger, {
        countryId: request.countryId, kind: 'PROCUREMENT_REVIEW',
        beneficiaryCompanyId: company.id, authorityRequestId: request.id,
        sourceKey: `procurement:${tx.id}`, redFlags
    });
    if (!created.ok) return created;
    const row = ledger.cases[created.case.id];
    row.status = 'PRELIMINARY_REVIEW';
    storyIntegrityAddEvidence(ledger, row, {
        type: 'AUTHORITY_RECEIPT', sourceId: request.id, sourceKind: 'INSTITUTION_REQUEST',
        direction: 'NEUTRAL', authenticityBps: 10000, relevanceBps: 1800,
        public: true, summaryCode: 'LAWFUL_BUDGET_AUTHORITY_EXISTS'
    });
    storyIntegrityAddEvidence(ledger, row, {
        type: 'PAYMENT_RECEIPT', sourceId: tx.id, sourceKind: 'BUDGET_TRANSACTION',
        direction: 'NEUTRAL', authenticityBps: 10000, relevanceBps: 2200,
        public: false, summaryCode: 'PROCUREMENT_PAYMENT_EXISTS'
    });
    if (bidCount < 2) storyIntegrityAddEvidence(ledger, row, {
        type: 'COMPETITION_RED_FLAG', sourceId: `${tx.id}:bids:${bidCount}`, sourceKind: 'PROCUREMENT_ANALYTIC',
        authenticityBps: 8500, relevanceBps: STORY_INTEGRITY_POLICY.singleBidRiskBps,
        public: false, summaryCode: 'INSUFFICIENT_COMPETITION'
    });
    if (priceDeviationBps >= 2000) storyIntegrityAddEvidence(ledger, row, {
        type: 'PRICE_DEVIATION_RED_FLAG', sourceId: `${tx.id}:benchmark:${storyIntegrityRound(benchmark)}`,
        sourceKind: 'PROCUREMENT_ANALYTIC', authenticityBps: benchmark > 0 ? 8000 : 0,
        relevanceBps: Math.min(STORY_INTEGRITY_POLICY.priceDeviationRiskBps, priceDeviationBps),
        public: false, summaryCode: 'PRICE_ABOVE_BENCHMARK'
    });
    if ((Number(company.lobbyInfluence) || 0) >= 25) storyIntegrityAddEvidence(ledger, row, {
        type: 'LOBBY_INFLUENCE_RED_FLAG', sourceId: `${company.id}:lobby:${storyIntegrityRound(company.lobbyInfluence)}`,
        sourceKind: 'COMPANY_REGISTRY', authenticityBps: 10000,
        relevanceBps: storyIntegrityClampBps(Number(company.lobbyInfluence) * 100 * STORY_INTEGRITY_POLICY.lobbyRiskScale),
        public: false, summaryCode: 'HIGH_BENEFICIARY_LOBBY_INFLUENCE'
    });
    storyIntegrityRecount(ledger);
    return { ok: true, duplicate: !!created.duplicate, case: storyIntegrityClone(row) };
}

function storyIntegrityScanExplicitBribes(ledger) {
    for (const [countryId, country] of Object.entries(STORY.stateBudget && STORY.stateBudget.countries || {})) {
        for (const tx of (country.journal || [])) {
            if (tx.source !== 'political.bribe') continue;
            const transfer = tx.postings.find(row => row.account.startsWith('MEMO:TRANSFER_TO:'));
            const recipient = transfer ? transfer.account.slice('MEMO:TRANSFER_TO:'.length) : '';
            const legacyCountryId = Number(String(countryId).replace(/^country:/, ''));
            const subjectActorId = recipient
                ? (recipient.startsWith('character:') ? recipient : `character:${legacyCountryId}:${recipient}`)
                : null;
            const created = storyIntegrityCreateCase(ledger, {
                countryId, kind: 'EXPLICIT_BRIBE_TRANSFER', sourceKey: `bribe:${tx.id}`,
                subjectActorId,
                redFlags: ['EXPLICIT_BRIBE_CLASSIFICATION']
            });
            if (!created.ok || created.duplicate) continue;
            const row = ledger.cases[created.case.id];
            storyIntegrityAddEvidence(ledger, row, {
                type: 'EXPLICIT_BRIBE_RECEIPT', sourceId: tx.id, sourceKind: 'BUDGET_TRANSACTION',
                authenticityBps: 10000, relevanceBps: 10000, public: false,
                summaryCode: 'TRANSFER_CLASSIFIED_AS_POLITICAL_BRIBE'
            });
        }
    }
}

function storyIntegrityOpenInvestigation(caseId, judiciaryRequestId) {
    const ledger = storyIntegrityEnsure();
    const row = ledger && ledger.cases[String(caseId)];
    if (!row) return { ok: false, reason: 'UNKNOWN_CASE' };
    if (!['ALLEGATION', 'PRELIMINARY_REVIEW'].includes(row.status)) return { ok: false, reason: 'CASE_NOT_OPENABLE' };
    const request = storyIntegrityInstitutionRequest(judiciaryRequestId, ['REVIEW_LEGALITY']);
    if (!request || request.countryId !== row.countryId) return { ok: false, reason: 'EXECUTED_JUDICIAL_AUTHORITY_REQUIRED' };
    const authorityUsed = Object.values(ledger.cases || {}).some(candidate => (
        candidate.id !== row.id && candidate.investigationRequestId === request.id
    ));
    if (authorityUsed) return { ok: false, reason: 'JUDICIAL_AUTHORITY_ALREADY_CONSUMED' };
    if (row.evidenceScoreBps < STORY_INTEGRITY_POLICY.formalInvestigationMinimumEvidenceBps) {
        return { ok: false, reason: 'INSUFFICIENT_PRELIMINARY_EVIDENCE', evidenceScoreBps: row.evidenceScoreBps };
    }
    row.status = 'FORMAL_INVESTIGATION';
    row.investigationRequestId = request.id;
    row.investigationOpenedAt = storyIntegrityRound(STORY.clock);
    storyIntegrityRecordEvent(ledger, 'FORMAL_INVESTIGATION_OPENED', { caseId: row.id, requestId: request.id });
    storyIntegrityRecount(ledger);
    return { ok: true, case: storyIntegrityClone(row) };
}
function storyIntegrityResolveInvestigation(caseId) {
    const ledger = storyIntegrityEnsure();
    const row = ledger && ledger.cases[String(caseId)];
    if (!row) return { ok: false, reason: 'UNKNOWN_CASE' };
    if (row.status !== 'FORMAL_INVESTIGATION') return { ok: false, reason: 'FORMAL_INVESTIGATION_REQUIRED' };
    row.evidenceScoreBps = storyIntegrityEvidenceScore(ledger, row);
    row.status = row.evidenceScoreBps >= STORY_INTEGRITY_POLICY.substantiationThresholdBps
        ? 'SUBSTANTIATED' : 'UNSUBSTANTIATED';
    row.resolutionCode = row.status === 'SUBSTANTIATED'
        ? 'EVIDENCE_THRESHOLD_MET' : 'EVIDENCE_THRESHOLD_NOT_MET';
    row.resolvedAt = storyIntegrityRound(STORY.clock);
    storyIntegrityRecordEvent(ledger, 'INVESTIGATION_RESOLVED', {
        caseId: row.id, status: row.status, evidenceScoreBps: row.evidenceScoreBps
    });
    storyIntegrityRecount(ledger);
    return { ok: true, case: storyIntegrityClone(row) };
}

function storyIntegrityValidate(ledger) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!ledger || typeof ledger !== 'object') return { ok: false, issues: [{ code: 'INTEGRITY_LEDGER_REQUIRED', path: '$', message: 'Bütünlük defteri zorunlu.' }] };
    if (ledger.schemaVersion !== STORY_INTEGRITY_SCHEMA_VERSION) add('INTEGRITY_SCHEMA_VERSION', '$.schemaVersion', 'Şema sürümü uyuşmuyor.');
    if (ledger.adapterVersion !== STORY_INTEGRITY_ADAPTER_VERSION) add('INTEGRITY_ADAPTER_VERSION', '$.adapterVersion', 'Adaptör sürümü uyuşmuyor.');
    if (ledger.policyHash !== STORY_INTEGRITY_POLICY_HASH) add('INTEGRITY_POLICY_HASH', '$.policyHash', 'Politika karması uyuşmuyor.');
    const knownCountries = new Set((STORY.states || []).map(row => storyIntegrityCountryId(row.id)));
    for (const countryId of knownCountries) if (!ledger.countries || !ledger.countries[countryId]) add('INTEGRITY_COUNTRY', `$.countries.${countryId}`, 'Ülke özeti eksik.');
    for (const [countryId, country] of Object.entries(ledger.countries || {})) {
        if (!knownCountries.has(countryId) || country.countryId !== countryId) {
            add('INTEGRITY_COUNTRY_IDENTITY', `$.countries.${countryId}`, 'Ülke özetinin kimliği geçersiz.');
        }
        for (const caseId of (country.caseIds || [])) {
            if (!ledger.cases[caseId] || ledger.cases[caseId].countryId !== countryId) {
                add('INTEGRITY_COUNTRY_CASE_REF', `$.countries.${countryId}.caseIds`, 'Ülke dosya referansı eksik veya başka ülkeye ait.');
            }
        }
    }
    const usedInvestigationRequests = new Set();
    for (const [id, row] of Object.entries(ledger.cases || {})) {
        if (row.id !== id || !knownCountries.has(row.countryId)) add('INTEGRITY_CASE_IDENTITY', `$.cases.${id}`, 'Dosya kimliği veya ülkesi geçersiz.');
        if (!STORY_INTEGRITY_CASE_STATUSES.includes(row.status)) add('INTEGRITY_CASE_STATUS', `$.cases.${id}.status`, 'Dosya durumu geçersiz.');
        if (!Number.isInteger(row.evidenceScoreBps) || row.evidenceScoreBps < 0 || row.evidenceScoreBps > 10000) add('INTEGRITY_EVIDENCE_SCORE', `$.cases.${id}.evidenceScoreBps`, 'Kanıt skoru 0–10.000 tamsayı olmalı.');
        if (row.physicalMutation !== false || row.resultModel !== STORY_INTEGRITY_POLICY.resultModel) add('INTEGRITY_PHYSICAL_RESULT', `$.cases.${id}`, 'Faz 32 sonucu fiziksel dünyaya doğrudan yazamaz.');
        if (['FORMAL_INVESTIGATION', 'SUBSTANTIATED', 'UNSUBSTANTIATED'].includes(row.status)) {
            if (!row.investigationRequestId) add('INTEGRITY_INVESTIGATION_AUTHORITY', `$.cases.${id}.investigationRequestId`, 'Resmî veya sonuçlanmış soruşturma yargı yetki fişi taşımalı.');
            else if (usedInvestigationRequests.has(row.investigationRequestId)) add('INTEGRITY_INVESTIGATION_AUTHORITY_REUSED', `$.cases.${id}.investigationRequestId`, 'Yargı yetki fişi birden fazla dosyada kullanılamaz.');
            else usedInvestigationRequests.add(row.investigationRequestId);
        }
        if (['SUBSTANTIATED', 'UNSUBSTANTIATED'].includes(row.status) && row.resolvedAt == null) {
            add('INTEGRITY_RESOLUTION_TIME', `$.cases.${id}.resolvedAt`, 'Sonuçlanmış soruşturma çözüm zamanı taşımalı.');
        }
        for (const evidenceId of (row.evidenceIds || [])) if (!ledger.evidence[evidenceId]) add('INTEGRITY_EVIDENCE_REF', `$.cases.${id}.evidenceIds`, 'Kanıt referansı eksik.');
    }
    for (const [id, row] of Object.entries(ledger.evidence || {})) {
        const caseRow = ledger.cases[row.caseId];
        if (row.id !== id || !caseRow || !knownCountries.has(row.countryId)
            || (caseRow && (caseRow.countryId !== row.countryId || !(caseRow.evidenceIds || []).includes(id)))) {
            add('INTEGRITY_EVIDENCE_IDENTITY', `$.evidence.${id}`, 'Kanıt kimliği, dosyası veya ülkesi geçersiz.');
        }
        if (!['SUPPORTS', 'REBUTS', 'NEUTRAL'].includes(row.direction)) {
            add('INTEGRITY_EVIDENCE_DIRECTION', `$.evidence.${id}.direction`, 'Kanıt yönü geçersiz.');
        }
    }
    if (Object.keys(ledger.cases || {}).length > STORY_INTEGRITY_POLICY.maximumCases) add('INTEGRITY_CASE_LIMIT', '$.cases', 'Dosya bütçesi aşıldı.');
    if (Object.keys(ledger.evidence || {}).length > STORY_INTEGRITY_POLICY.maximumEvidence) add('INTEGRITY_EVIDENCE_LIMIT', '$.evidence', 'Kanıt bütçesi aşıldı.');
    return { ok: issues.length === 0, issues };
}
function storyIntegrityReset(options) {
    if (!storyIntegrityEnabled()) { STORY.integrity = null; return null; }
    STORY.integrity = storyIntegrityLedgerCreate(options);
    return STORY.integrity;
}
function storyIntegrityEnsure() {
    if (!storyIntegrityEnabled()) return null;
    return STORY.integrity || storyIntegrityReset({ backfilled: true });
}
function storyIntegrityRestore(saved) {
    if (!storyIntegrityEnabled()) { STORY.integrity = null; return null; }
    if (!saved) return storyIntegrityReset({ backfilled: true });
    const candidate = storyIntegrityClone(saved);
    const validation = storyIntegrityValidate(candidate);
    if (validation.ok) { STORY.integrity = candidate; storyIntegrityRecount(candidate); return candidate; }
    return storyIntegrityReset({ backfilled: true, restoredFromInvalidLedger: true, issues: validation.issues });
}
function storyIntegrityForSave() {
    const ledger = storyIntegrityEnsure();
    if (!ledger) return null;
    const validation = storyIntegrityValidate(ledger);
    ledger.diagnostics.issues = validation.ok ? [] : validation.issues.slice(0, 50);
    return storyIntegrityClone(ledger);
}
function storyIntegrityTick() {
    const ledger = storyIntegrityEnsure();
    if (!ledger) return { disabled: true };
    storyIntegrityScanExplicitBribes(ledger);
    storyIntegrityRecount(ledger);
    ledger.tickSequence++;
    ledger.lastTickAt = storyIntegrityRound(STORY.clock);
    return { disabled: false, tickSequence: ledger.tickSequence, caseCount: Object.keys(ledger.cases).length };
}
function storyIntegrityCountryView(countryId) {
    const ledger = storyIntegrityEnabled() ? STORY.integrity : null;
    const id = storyIntegrityCountryId(countryId);
    const country = ledger && ledger.countries[id];
    if (!country) return null;
    const cases = country.caseIds.map(caseId => ledger.cases[caseId]).filter(Boolean)
        .map(row => Object.assign(storyIntegrityClone(row), {
            evidence: row.evidenceIds.map(evidenceId => storyIntegrityClone(ledger.evidence[evidenceId])).filter(Boolean)
        }));
    return Object.assign(storyIntegrityClone(country), { cases });
}
function storyIntegrityPublicView(value) {
    if (!value) return null;
    const cases = (value.cases || []).filter(row => (
        row.status === 'FORMAL_INVESTIGATION'
        || row.status === 'SUBSTANTIATED'
        || row.status === 'UNSUBSTANTIATED'
        || (row.evidence || []).some(evidence => evidence.public && evidence.direction === 'SUPPORTS')
    ));
    return {
        countryId: value.countryId,
        allegationCount: cases.length,
        openInvestigationCount: cases.filter(row => row.status === 'FORMAL_INVESTIGATION').length,
        substantiatedCount: cases.filter(row => row.status === 'SUBSTANTIATED').length,
        unsubstantiatedCount: cases.filter(row => row.status === 'UNSUBSTANTIATED').length,
        cases: cases.map(row => ({
            id: row.id, kind: row.kind, status: row.status,
            openedAt: row.openedAt, resolvedAt: row.resolvedAt,
            resolutionCode: row.resolutionCode
        }))
    };
}
function storyIntegritySummary() {
    const ledger = storyIntegrityEnabled() ? STORY.integrity : null;
    if (!ledger) return { schemaVersion: STORY_INTEGRITY_SCHEMA_VERSION, adapterVersion: STORY_INTEGRITY_ADAPTER_VERSION, disabled: true, caseCount: 0 };
    const cases = Object.values(ledger.cases || {});
    return {
        schemaVersion: ledger.schemaVersion, adapterVersion: ledger.adapterVersion,
        policyHash: ledger.policyHash, disabled: false, tickSequence: ledger.tickSequence,
        countryCount: Object.keys(ledger.countries || {}).length, caseCount: cases.length,
        allegationCount: cases.filter(row => row.status === 'ALLEGATION').length,
        investigationCount: cases.filter(row => row.status === 'FORMAL_INVESTIGATION').length,
        substantiatedCount: cases.filter(row => row.status === 'SUBSTANTIATED').length,
        unsubstantiatedCount: cases.filter(row => row.status === 'UNSUBSTANTIATED').length,
        evidenceCount: Object.keys(ledger.evidence || {}).length,
        eventCount: (ledger.events || []).length
    };
}
