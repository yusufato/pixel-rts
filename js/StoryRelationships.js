// ═══════════════════════════════════════════════════════════════════════════
//  ÇOK BOYUTLU KARAKTER İLİŞKİLERİ — Faz 35
//  ---------------------------------------------------------------------------
//  İlişki tek dostluk puanı değildir ve simetrik değildir. A'nın B'ye
//  güveni, B'nin A'ya güveninden ayrı bir kayıttır. Tam N² matris yerine
//  gerçek kurumsal/mesleki temaslardan seyrek grafik kurulur.
// ══════════════════════════════════════════════════════════════════════════

const STORY_RELATIONSHIP_SCHEMA_VERSION = 2;
const STORY_RELATIONSHIP_ADAPTER_VERSION = 'story-character-relationship-ledger-2';
const STORY_RELATIONSHIP_AXES = Object.freeze(['trustBps', 'fearBps', 'respectBps', 'debtBps', 'hostilityBps']);
const STORY_RELATIONSHIP_RESULT_RECEIPT_SCHEMA_VERSION = 1;
const STORY_RELATIONSHIP_RESULT_RECEIPT_LIMIT = 256;
const STORY_RELATIONSHIP_RESULT_COOLDOWN_SECONDS = 300;
const STORY_RELATIONSHIP_ZERO_DELTAS = Object.freeze({
    trustBps: 0, fearBps: 0, respectBps: 0, debtBps: 0, hostilityBps: 0
});
const STORY_RELATIONSHIP_RESULT_POLICIES = Object.freeze({
    TASK_COMMITMENT_KEPT: Object.freeze({
        sourceType: 'TASK_RESULT', interpretationFamily: 'TASK_POSITIVE',
        deltas: Object.freeze({ trustBps: 250, fearBps: 0, respectBps: 150, debtBps: 0, hostilityBps: -100 })
    }),
    TASK_COMMITMENT_BROKEN: Object.freeze({
        sourceType: 'TASK_RESULT', interpretationFamily: 'TASK_NEGATIVE',
        deltas: Object.freeze({ trustBps: -600, fearBps: 0, respectBps: -250, debtBps: 0, hostilityBps: 350 })
    }),
    MEETING_SHARED_SUCCESS: Object.freeze({
        sourceType: 'MEETING_OUTCOME', interpretationFamily: 'MEETING_POSITIVE',
        deltas: Object.freeze({ trustBps: 180, fearBps: 0, respectBps: 160, debtBps: 0, hostilityBps: -80 }),
        noChangeReasons: Object.freeze(['MEETING_REJECTED', 'PLAYER_VOTE_NOT_YES', 'OBSERVER_VOTE_NOT_YES'])
    })
});
const STORY_RELATIONSHIP_RESULT_NO_CHANGE_REASONS = Object.freeze([
    'COOLDOWN_ACTIVE', 'MEETING_REJECTED', 'PLAYER_VOTE_NOT_YES', 'OBSERVER_VOTE_NOT_YES'
]);

function storyRelationshipEnabled() {
    return typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('characters.multiDimensionalRelations');
}
function storyRelationshipClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}
function storyRelationshipClamp(value) {
    return Math.max(0, Math.min(10000, Math.round(Number(value) || 0)));
}
function storyRelationshipId(fromActorId, toActorId) {
    return `relationship:${String(fromActorId)}=>${String(toActorId)}`;
}
function storyRelationshipResultId(sourceType, sourceReceiptId, fromActorId, toActorId) {
    return `relationship-result:${String(sourceType)}:${String(sourceReceiptId)}:${String(fromActorId)}=>${String(toActorId)}`;
}
function storyRelationshipRoleFamily(role) {
    if (['COMPANY_OWNER', 'COMPANY_EXECUTIVE'].includes(role)) return 'COMPANY';
    if (['EXECUTIVE', 'POLITICAL_FIGURE', 'POLITICAL_CANDIDATE', 'MAYOR'].includes(role)) return 'POLITICAL';
    if (role === 'AGENT') return 'INTELLIGENCE';
    if (role === 'CIVILIAN') return 'CIVILIAN';
    return 'MILITARY';
}
function storyRelationshipBaseline(from, to) {
    const axes = typeof STORY_CHARACTER_CORE_AXES !== 'undefined' ? STORY_CHARACTER_CORE_AXES : [];
    const distance = axes.length ? axes.reduce((sum, key) =>
        sum + Math.abs(Number(from.coreAxes && from.coreAxes[key]) - Number(to.coreAxes && to.coreAxes[key])), 0) / axes.length : 50;
    const similarityBps = storyRelationshipClamp(10000 - distance * 100);
    const sameCountry = from.countryId === to.countryId;
    const sameFamily = storyRelationshipRoleFamily(from.role) === storyRelationshipRoleFamily(to.role);
    const directional = typeof storyCharacterIdentityJitter === 'function'
        ? storyCharacterIdentityJitter(`${from.id}>${to.id}`, 'relation', 700) : 0;
    const targetAuthority = Number(to.values && to.values.libertyAuthority) || 50;
    const targetHawk = Number(to.values && to.values.hawkishness) || 50;
    return {
        trustBps: storyRelationshipClamp(1800 + similarityBps * 0.42 + (sameCountry ? 900 : -500)
            + (sameFamily ? 450 : 0) + directional),
        fearBps: storyRelationshipClamp(700 + targetAuthority * 34 + targetHawk * 18
            + (storyRelationshipRoleFamily(to.role) === 'INTELLIGENCE' ? 900 : 0) - directional * 0.2),
        respectBps: storyRelationshipClamp(1600 + similarityBps * 0.3
            + (sameFamily ? 900 : 250) + targetHawk * 12 + directional * 0.35),
        debtBps: storyRelationshipClamp(150 + Math.abs(directional) * 0.2),
        hostilityBps: storyRelationshipClamp(1100 + (10000 - similarityBps) * 0.24
            + (sameCountry ? -450 : 600) - directional * 0.25)
    };
}
function storyRelationshipEdgeCreate(from, to, reason) {
    const axes = storyRelationshipBaseline(from, to);
    return Object.assign({
        id: storyRelationshipId(from.id, to.id),
        fromActorId: from.id,
        toActorId: to.id,
        countryId: from.countryId,
        contactReason: String(reason || 'INSTITUTIONAL_CONTACT'),
        createdAt: Number(STORY.clock) || 0,
        updatedAt: Number(STORY.clock) || 0,
        version: 1,
        history: []
    }, axes);
}
function storyRelationshipConnect(ledger, from, to, reason) {
    if (!from || !to || from.id === to.id) return null;
    const id = storyRelationshipId(from.id, to.id);
    if (!ledger.edges[id]) ledger.edges[id] = storyRelationshipEdgeCreate(from, to, reason);
    return ledger.edges[id];
}
function storyRelationshipLedgerCreate() {
    const identityLedger = typeof storyCharacterIdentityEnsure === 'function'
        ? storyCharacterIdentityEnsure() : null;
    const ledger = {
        schemaVersion: STORY_RELATIONSHIP_SCHEMA_VERSION,
        adapterVersion: STORY_RELATIONSHIP_ADAPTER_VERSION,
        axes: STORY_RELATIONSHIP_AXES.slice(),
        edges: {},
        nextResultReceiptSequence: 1,
        resultReceipts: {},
        revision: 1,
        generatedAt: Number(STORY.clock) || 0
    };
    const byCountry = new Map();
    for (const identity of Object.values(identityLedger && identityLedger.identities || {})) {
        if (!byCountry.has(identity.countryId)) byCountry.set(identity.countryId, []);
        byCountry.get(identity.countryId).push(identity);
    }
    for (const rows of byCountry.values()) {
        rows.sort((a, b) => a.id.localeCompare(b.id, 'en'));
        const anchor = rows.find(row => row.role === 'EXECUTIVE')
            || rows.find(row => row.role === 'POLITICAL_FIGURE') || rows[0];
        for (const row of rows) {
            if (row.id === anchor.id) continue;
            storyRelationshipConnect(ledger, row, anchor, 'EXECUTIVE_ACCESS');
            storyRelationshipConnect(ledger, anchor, row, 'EXECUTIVE_OVERSIGHT');
        }
        const families = new Map();
        for (const row of rows) {
            const family = storyRelationshipRoleFamily(row.role);
            if (!families.has(family)) families.set(family, []);
            families.get(family).push(row);
        }
        for (const familyRows of families.values()) {
            for (let index = 0; index + 1 < familyRows.length; index++) {
                storyRelationshipConnect(ledger, familyRows[index], familyRows[index + 1], 'PROFESSIONAL_NETWORK');
                storyRelationshipConnect(ledger, familyRows[index + 1], familyRows[index], 'PROFESSIONAL_NETWORK');
            }
        }
    }
    return ledger;
}
function storyRelationshipMigrate(saved) {
    const candidate = storyRelationshipClone(saved);
    if (!candidate || typeof candidate !== 'object') return candidate;
    if (candidate.schemaVersion === 1) {
        candidate.schemaVersion = STORY_RELATIONSHIP_SCHEMA_VERSION;
        candidate.adapterVersion = STORY_RELATIONSHIP_ADAPTER_VERSION;
        candidate.nextResultReceiptSequence = 1;
        candidate.resultReceipts = {};
    }
    return candidate;
}
function storyRelationshipAxesSnapshot(edge) {
    return edge ? Object.fromEntries(STORY_RELATIONSHIP_AXES.map(axis => [axis, Number(edge[axis])])) : null;
}
function storyRelationshipAxesEqual(left, right) {
    return STORY_RELATIONSHIP_AXES.every(axis => Number(left && left[axis]) === Number(right && right[axis]));
}
function storyRelationshipResultCooldownKey(fromActorId, toActorId, family) {
    return `${storyRelationshipId(fromActorId, toActorId)}:${String(family)}`;
}
function storyRelationshipActorActive(identity) {
    return !!identity && (!identity.life || identity.life.status == null || identity.life.status === 'ACTIVE');
}
function storyRelationshipResultReceiptValidate(receipt, id, identities, receipts) {
    const issues = [];
    const path = `$.resultReceipts.${id}`;
    const policy = receipt && STORY_RELATIONSHIP_RESULT_POLICIES[receipt.interpretationType];
    if (!receipt || receipt.id !== id) issues.push({ code: 'RELATION_RESULT_ID', path });
    if (!receipt || receipt.schemaVersion !== STORY_RELATIONSHIP_RESULT_RECEIPT_SCHEMA_VERSION) issues.push({ code: 'RELATION_RESULT_SCHEMA', path: `${path}.schemaVersion` });
    if (!receipt || !Number.isInteger(receipt.sequence) || receipt.sequence < 1) issues.push({ code: 'RELATION_RESULT_SEQUENCE', path: `${path}.sequence` });
    if (!policy || policy.sourceType !== receipt.sourceType) issues.push({ code: 'RELATION_RESULT_POLICY', path: `${path}.interpretationType` });
    if (!receipt || !String(receipt.sourceReceiptId || '')) issues.push({ code: 'RELATION_RESULT_SOURCE', path: `${path}.sourceReceiptId` });
    if (receipt && receipt.id !== storyRelationshipResultId(receipt.sourceType, receipt.sourceReceiptId, receipt.fromActorId, receipt.toActorId)) issues.push({ code: 'RELATION_RESULT_SOURCE_ID', path: `${path}.id` });
    if (!receipt || receipt.fromActorId === receipt.toActorId || !identities[receipt.fromActorId] || !identities[receipt.toActorId]) issues.push({ code: 'RELATION_RESULT_DIRECTION', path });
    if (receipt && receipt.relationshipId !== storyRelationshipId(receipt.fromActorId, receipt.toActorId)) issues.push({ code: 'RELATION_RESULT_RELATIONSHIP', path: `${path}.relationshipId` });
    if (policy && receipt.interpretationFamily !== policy.interpretationFamily) issues.push({ code: 'RELATION_RESULT_FAMILY', path: `${path}.interpretationFamily` });
    if (receipt && receipt.cooldownKey !== storyRelationshipResultCooldownKey(receipt.fromActorId, receipt.toActorId, receipt.interpretationFamily)) issues.push({ code: 'RELATION_RESULT_COOLDOWN_KEY', path: `${path}.cooldownKey` });
    if (receipt && receipt.cooldownSeconds !== STORY_RELATIONSHIP_RESULT_COOLDOWN_SECONDS) issues.push({ code: 'RELATION_RESULT_COOLDOWN_SECONDS', path: `${path}.cooldownSeconds` });
    if (receipt && receipt.physicalMutation !== false) issues.push({ code: 'RELATION_RESULT_PHYSICAL_MUTATION', path: `${path}.physicalMutation` });
    if (receipt && receipt.decision === 'APPLIED') {
        if (receipt.reason !== 'POLICY_APPLIED' || receipt.relationshipMutation !== true) issues.push({ code: 'RELATION_RESULT_APPLIED_STATE', path });
        if (!policy || !storyRelationshipAxesEqual(receipt.deltas, policy.deltas)) issues.push({ code: 'RELATION_RESULT_DELTAS', path: `${path}.deltas` });
        if (!receipt.before || !receipt.after || receipt.edgeVersionAfter !== receipt.edgeVersionBefore + 1) issues.push({ code: 'RELATION_RESULT_EDGE_VERSION', path });
        for (const axis of STORY_RELATIONSHIP_AXES) {
            if (storyRelationshipClamp(Number(receipt.before && receipt.before[axis]) + Number(receipt.deltas && receipt.deltas[axis])) !== Number(receipt.after && receipt.after[axis])) issues.push({ code: 'RELATION_RESULT_AXIS_MATH', path: `${path}.after.${axis}` });
        }
    } else if (receipt && receipt.decision === 'NO_CHANGE') {
        if (!STORY_RELATIONSHIP_RESULT_NO_CHANGE_REASONS.includes(receipt.reason) || receipt.relationshipMutation !== false) issues.push({ code: 'RELATION_RESULT_NO_CHANGE_STATE', path });
        if (receipt.reason !== 'COOLDOWN_ACTIVE' && (!policy.noChangeReasons || !policy.noChangeReasons.includes(receipt.reason))) issues.push({ code: 'RELATION_RESULT_NO_CHANGE_POLICY', path: `${path}.reason` });
        if (!storyRelationshipAxesEqual(receipt.deltas, STORY_RELATIONSHIP_ZERO_DELTAS)) issues.push({ code: 'RELATION_RESULT_NO_CHANGE_DELTAS', path: `${path}.deltas` });
        if ((receipt.before == null) !== (receipt.after == null) || (receipt.before && !storyRelationshipAxesEqual(receipt.before, receipt.after))) issues.push({ code: 'RELATION_RESULT_NO_CHANGE_AXES', path });
        if (receipt.edgeVersionBefore !== receipt.edgeVersionAfter) issues.push({ code: 'RELATION_RESULT_NO_CHANGE_VERSION', path });
        if (receipt.reason === 'COOLDOWN_ACTIVE') {
            const prior = Object.values(receipts || {}).some(row => row.id !== receipt.id && row.decision === 'APPLIED'
                && row.cooldownKey === receipt.cooldownKey && row.sequence < receipt.sequence
                && receipt.appliedAt - row.appliedAt >= 0 && receipt.appliedAt - row.appliedAt < STORY_RELATIONSHIP_RESULT_COOLDOWN_SECONDS);
            if (!prior) issues.push({ code: 'RELATION_RESULT_COOLDOWN_EVIDENCE', path });
        }
    } else issues.push({ code: 'RELATION_RESULT_DECISION', path: `${path}.decision` });
    return issues;
}
function storyRelationshipValidate(candidate) {
    const issues = [];
    if (!candidate || typeof candidate !== 'object') return { ok: false, issues: [{ code: 'RELATION_LEDGER_REQUIRED', path: '$' }] };
    if (candidate.schemaVersion !== STORY_RELATIONSHIP_SCHEMA_VERSION) issues.push({ code: 'RELATION_SCHEMA_VERSION', path: '$.schemaVersion' });
    if (candidate.adapterVersion !== STORY_RELATIONSHIP_ADAPTER_VERSION) issues.push({ code: 'RELATION_ADAPTER_VERSION', path: '$.adapterVersion' });
    if (!Array.isArray(candidate.axes) || candidate.axes.join('|') !== STORY_RELATIONSHIP_AXES.join('|')) issues.push({ code: 'RELATION_AXES', path: '$.axes' });
    const identities = typeof storyCharacterIdentityEnsure === 'function'
        ? (storyCharacterIdentityEnsure().identities || {}) : {};
    for (const [id, edge] of Object.entries(candidate.edges || {})) {
        if (!edge || edge.id !== id) issues.push({ code: 'RELATION_ID', path: `$.edges.${id}` });
        if (!identities[edge.fromActorId]) issues.push({ code: 'RELATION_FROM_ACTOR', path: `$.edges.${id}.fromActorId` });
        if (!identities[edge.toActorId]) issues.push({ code: 'RELATION_TO_ACTOR', path: `$.edges.${id}.toActorId` });
        if (edge.fromActorId === edge.toActorId) issues.push({ code: 'RELATION_SELF_EDGE', path: `$.edges.${id}` });
        for (const axis of STORY_RELATIONSHIP_AXES) {
            const value = Number(edge[axis]);
            if (!Number.isInteger(value) || value < 0 || value > 10000) issues.push({ code: 'RELATION_AXIS_RANGE', path: `$.edges.${id}.${axis}` });
        }
    }
    const receipts = candidate.resultReceipts;
    if (!receipts || typeof receipts !== 'object' || Array.isArray(receipts)) issues.push({ code: 'RELATION_RESULT_RECEIPTS', path: '$.resultReceipts' });
    const receiptEntries = Object.entries(receipts || {});
    if (receiptEntries.length > STORY_RELATIONSHIP_RESULT_RECEIPT_LIMIT) issues.push({ code: 'RELATION_RESULT_LIMIT', path: '$.resultReceipts' });
    for (const [id, receipt] of receiptEntries) issues.push(...storyRelationshipResultReceiptValidate(receipt, id, identities, receipts));
    const maxSequence = receiptEntries.reduce((max, row) => Math.max(max, Number(row[1] && row[1].sequence) || 0), 0);
    if (!Number.isInteger(candidate.nextResultReceiptSequence) || candidate.nextResultReceiptSequence <= maxSequence) issues.push({ code: 'RELATION_RESULT_NEXT_SEQUENCE', path: '$.nextResultReceiptSequence' });
    return { ok: issues.length === 0, issues };
}
function storyRelationshipReset() {
    if (!storyRelationshipEnabled()) { STORY.characterRelationships = null; return null; }
    STORY.characterRelationships = storyRelationshipLedgerCreate();
    return storyRelationshipSnapshot();
}
function storyRelationshipEnsure() {
    if (!storyRelationshipEnabled()) return null;
    if (!STORY.characterRelationships) STORY.characterRelationships = storyRelationshipLedgerCreate();
    return STORY.characterRelationships;
}
function storyRelationshipSnapshot() {
    const ledger = storyRelationshipEnsure();
    return ledger ? storyRelationshipClone(ledger) : null;
}
function storyRelationshipForSave() { return storyRelationshipSnapshot(); }
function storyRelationshipRestore(saved) {
    if (!storyRelationshipEnabled()) { STORY.characterRelationships = null; return null; }
    const candidate = storyRelationshipMigrate(saved);
    if (candidate && storyRelationshipValidate(candidate).ok) STORY.characterRelationships = candidate;
    else STORY.characterRelationships = storyRelationshipLedgerCreate();
    return storyRelationshipSnapshot();
}
function storyRelationshipView(fromActorId, toActorId) {
    const ledger = storyRelationshipEnsure();
    const edge = ledger && ledger.edges[storyRelationshipId(fromActorId, toActorId)];
    return edge ? storyRelationshipClone(edge) : null;
}
function storyRelationshipEnsureEdge(fromActorId, toActorId, reason) {
    const ledger = storyRelationshipEnsure();
    const identityLedger = typeof storyCharacterIdentityEnsure === 'function'
        ? storyCharacterIdentityEnsure() : null;
    const identities = identityLedger && identityLedger.identities || {};
    const edge = ledger && storyRelationshipConnect(ledger, identities[fromActorId], identities[toActorId], reason);
    return edge || null;
}
function storyRelationshipAdjust(fromActorId, toActorId, deltas, meta) {
    const ledger = storyRelationshipEnsure();
    const edge = storyRelationshipEnsureEdge(fromActorId, toActorId, meta && meta.reason);
    if (!ledger || !edge) return { applied: false, reason: 'RELATION_ACTOR_MISSING' };
    const before = {};
    const after = {};
    for (const axis of STORY_RELATIONSHIP_AXES) {
        before[axis] = edge[axis];
        edge[axis] = storyRelationshipClamp(Number(edge[axis]) + Number(deltas && deltas[axis] || 0));
        after[axis] = edge[axis];
    }
    edge.updatedAt = Number(STORY.clock) || 0;
    edge.version++;
    edge.history.push({
        at: edge.updatedAt,
        source: String(meta && meta.source || 'UNKNOWN'),
        sourceEventId: meta && meta.sourceEventId != null ? Number(meta.sourceEventId) : null,
        sourceReceiptId: meta && meta.sourceReceiptId != null ? String(meta.sourceReceiptId) : null,
        reason: String(meta && meta.reason || 'RELATION_CHANGED'),
        before,
        after
    });
    if (edge.history.length > 24) edge.history.splice(0, edge.history.length - 24);
    ledger.revision++;
    let debtMemory = null;
    if (before.debtBps !== after.debtBps && (!meta || meta.recordDebtMemory !== false)
        && typeof storyMemoryRecordRelationshipDebt === 'function') {
        debtMemory = storyMemoryRecordRelationshipDebt({
            relationshipId: edge.id,
            debtorActorId: edge.fromActorId,
            creditorActorId: edge.toActorId,
            beforeDebtBps: before.debtBps,
            afterDebtBps: after.debtBps,
            summary: meta && meta.debtSummary,
            source: {
                relationshipHistoryVersion: edge.version,
                source: String(meta && meta.source || 'UNKNOWN'),
                reason: String(meta && meta.reason || 'RELATION_CHANGED'),
                sourceEventId: meta && meta.sourceEventId != null ? Number(meta.sourceEventId) : null,
                sourceReceiptId: meta && meta.sourceReceiptId != null ? String(meta.sourceReceiptId) : null,
                talkUid: meta && meta.talkUid != null ? Number(meta.talkUid) : null,
                talkTemplateId: meta && meta.talkTemplateId != null ? String(meta.talkTemplateId) : null
            }
        });
    }
    return { applied: true, edge: storyRelationshipClone(edge), debtMemory };
}
function storyRelationshipResultReceiptGet(receiptId) {
    const ledger = storyRelationshipEnsure();
    const receipt = ledger && ledger.resultReceipts && ledger.resultReceipts[String(receiptId)];
    return receipt ? storyRelationshipClone(receipt) : null;
}
function storyRelationshipResultReceiptList(filter) {
    const ledger = storyRelationshipEnsure();
    return Object.values(ledger && ledger.resultReceipts || {})
        .filter(receipt => !filter || (
            (filter.sourceType == null || receipt.sourceType === filter.sourceType)
            && (filter.sourceReceiptId == null || receipt.sourceReceiptId === String(filter.sourceReceiptId))
            && (filter.fromActorId == null || receipt.fromActorId === filter.fromActorId)
            && (filter.toActorId == null || receipt.toActorId === filter.toActorId)
        ))
        .sort((left, right) => left.sequence - right.sequence)
        .map(storyRelationshipClone);
}
function storyRelationshipApplyResult(input) {
    const ledger = storyRelationshipEnsure();
    const sourceType = String(input && input.sourceType || '');
    const sourceReceiptId = String(input && input.sourceReceiptId || '');
    const fromActorId = String(input && input.fromActorId || '');
    const toActorId = String(input && input.toActorId || '');
    const interpretationType = String(input && input.interpretationType || '');
    const policy = STORY_RELATIONSHIP_RESULT_POLICIES[interpretationType];
    if (!ledger || !sourceReceiptId || !policy || policy.sourceType !== sourceType) {
        return { applied: false, reason: 'RELATION_RESULT_POLICY_REJECTED' };
    }
    const identityLedger = typeof storyCharacterIdentityEnsure === 'function'
        ? storyCharacterIdentityEnsure() : null;
    const identities = identityLedger && identityLedger.identities || {};
    if (fromActorId === toActorId || !storyRelationshipActorActive(identities[fromActorId])
        || !storyRelationshipActorActive(identities[toActorId])) {
        return { applied: false, reason: 'RELATION_RESULT_ACTOR_REJECTED' };
    }
    const id = storyRelationshipResultId(sourceType, sourceReceiptId, fromActorId, toActorId);
    const existing = ledger.resultReceipts[id];
    if (existing) return { applied: existing.decision === 'APPLIED', duplicate: true, receipt: storyRelationshipClone(existing) };
    if (Object.keys(ledger.resultReceipts).length >= STORY_RELATIONSHIP_RESULT_RECEIPT_LIMIT) {
        return { applied: false, reason: 'RELATION_RESULT_RECEIPT_LIMIT' };
    }
    const beforeLedger = storyRelationshipClone(ledger);
    const appliedAt = Number(STORY.clock) || 0;
    const cooldownKey = storyRelationshipResultCooldownKey(fromActorId, toActorId, policy.interpretationFamily);
    const requestedNoChangeReason = input && input.noChangeReason != null ? String(input.noChangeReason) : null;
    if ((requestedNoChangeReason
        && (!policy.noChangeReasons || !policy.noChangeReasons.includes(requestedNoChangeReason)))
        || requestedNoChangeReason === 'COOLDOWN_ACTIVE') {
        return { applied: false, reason: 'RELATION_RESULT_NO_CHANGE_REJECTED' };
    }
    const cooldownReceipt = Object.values(ledger.resultReceipts).find(receipt => receipt.decision === 'APPLIED'
        && receipt.cooldownKey === cooldownKey && appliedAt - receipt.appliedAt >= 0
        && appliedAt - receipt.appliedAt < STORY_RELATIONSHIP_RESULT_COOLDOWN_SECONDS);
    const noChangeReason = requestedNoChangeReason || (cooldownReceipt ? 'COOLDOWN_ACTIVE' : null);
    let edgeBefore = ledger.edges[storyRelationshipId(fromActorId, toActorId)] || null;
    if (!noChangeReason && !edgeBefore) edgeBefore = storyRelationshipEnsureEdge(fromActorId, toActorId, interpretationType);
    const before = storyRelationshipAxesSnapshot(edgeBefore);
    const edgeVersionBefore = edgeBefore ? edgeBefore.version : null;
    let after = before;
    let edgeVersionAfter = edgeVersionBefore;
    if (!noChangeReason) {
        const adjusted = storyRelationshipAdjust(fromActorId, toActorId, policy.deltas, {
            source: 'relationship.result', sourceReceiptId: id,
            reason: interpretationType, recordDebtMemory: false
        });
        if (!adjusted.applied) {
            STORY.characterRelationships = beforeLedger;
            return { applied: false, reason: adjusted.reason || 'RELATION_RESULT_ADJUST_FAILED' };
        }
        after = storyRelationshipAxesSnapshot(adjusted.edge);
        edgeVersionAfter = adjusted.edge.version;
    }
    const receipt = {
        schemaVersion: STORY_RELATIONSHIP_RESULT_RECEIPT_SCHEMA_VERSION,
        id,
        sequence: ledger.nextResultReceiptSequence++,
        sourceType,
        sourceReceiptId,
        fromActorId,
        toActorId,
        relationshipId: storyRelationshipId(fromActorId, toActorId),
        interpretationType,
        interpretationFamily: policy.interpretationFamily,
        decision: noChangeReason ? 'NO_CHANGE' : 'APPLIED',
        reason: noChangeReason || 'POLICY_APPLIED',
        deltas: storyRelationshipClone(noChangeReason ? STORY_RELATIONSHIP_ZERO_DELTAS : policy.deltas),
        before,
        after,
        edgeVersionBefore,
        edgeVersionAfter,
        cooldownKey,
        cooldownSeconds: STORY_RELATIONSHIP_RESULT_COOLDOWN_SECONDS,
        appliedAt,
        relationshipMutation: !noChangeReason,
        physicalMutation: false
    };
    ledger.resultReceipts[id] = receipt;
    ledger.revision++;
    const validation = storyRelationshipValidate(ledger);
    if (!validation.ok) {
        STORY.characterRelationships = beforeLedger;
        return { applied: false, reason: 'RELATION_RESULT_VALIDATION_FAILED', issues: validation.issues };
    }
    return { applied: !noChangeReason, duplicate: false, receipt: storyRelationshipClone(receipt) };
}

const STORY_RELATIONSHIP_ORIGIN_TAG_DELTAS = Object.freeze({
    sert: Object.freeze({ trustBps: -80, fearBps: 180, respectBps: 100, debtBps: 0, hostilityBps: 100 }),
    kurnaz: Object.freeze({ trustBps: -120, fearBps: 100, respectBps: 40, debtBps: 30, hostilityBps: 120 }),
    halkci: Object.freeze({ trustBps: 150, fearBps: -50, respectBps: 110, debtBps: 50, hostilityBps: -80 }),
    uzman: Object.freeze({ trustBps: 100, fearBps: -40, respectBps: 140, debtBps: 20, hostilityBps: -50 })
});
function storyRelationshipApplyOriginProfile(profile) {
    if (!profile || !Array.isArray(profile.decisions)) return { applied: false, reason: 'ORIGIN_PROFILE_MISSING' };
    const identityLedger = typeof storyCharacterIdentityEnsure === 'function'
        ? storyCharacterIdentityEnsure() : null;
    const aggregate = Object.fromEntries(STORY_RELATIONSHIP_AXES.map(axis => [axis, 0]));
    for (const decision of profile.decisions) {
        const delta = STORY_RELATIONSHIP_ORIGIN_TAG_DELTAS[decision.optionTag] || {};
        for (const axis of STORY_RELATIONSHIP_AXES) aggregate[axis] += Number(delta[axis]) || 0;
    }
    let changed = 0;
    for (const observer of Object.values(identityLedger && identityLedger.identities || {})) {
        if (observer.countryId !== profile.countryId || observer.id === profile.actorId) continue;
        const result = storyRelationshipAdjust(observer.id, profile.actorId, aggregate, {
            source: 'character.creation_profile',
            reason: 'ORIGIN_REPUTATION',
            sourceEventId: profile.decisions[profile.decisions.length - 1].originEventId,
            recordDebtMemory: false
        });
        if (result.applied) changed++;
    }
    return { applied: true, changedEdges: changed, aggregate };
}
