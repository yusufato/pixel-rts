// ═══════════════════════════════════════════════════════════════════════════
//  ÇOK BOYUTLU KARAKTER İLİŞKİLERİ — Faz 35
//  ---------------------------------------------------------------------------
//  İlişki tek dostluk puanı değildir ve simetrik değildir. A'nın B'ye
//  güveni, B'nin A'ya güveninden ayrı bir kayıttır. Tam N² matris yerine
//  gerçek kurumsal/mesleki temaslardan seyrek grafik kurulur.
// ══════════════════════════════════════════════════════════════════════════

const STORY_RELATIONSHIP_SCHEMA_VERSION = 1;
const STORY_RELATIONSHIP_ADAPTER_VERSION = 'story-character-relationship-ledger-1';
const STORY_RELATIONSHIP_AXES = Object.freeze(['trustBps', 'fearBps', 'respectBps', 'debtBps', 'hostilityBps']);

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
function storyRelationshipValidate(candidate) {
    const issues = [];
    if (!candidate || typeof candidate !== 'object') return { ok: false, issues: [{ code: 'RELATION_LEDGER_REQUIRED', path: '$' }] };
    if (candidate.schemaVersion !== STORY_RELATIONSHIP_SCHEMA_VERSION) issues.push({ code: 'RELATION_SCHEMA_VERSION', path: '$.schemaVersion' });
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
    const candidate = storyRelationshipClone(saved);
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
