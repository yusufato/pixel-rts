// ═══════════════════════════════════════════════════════════════════════════
//  KARAKTER ÜÇ KATMANLI HAFIZA — Faz 36
//  ---------------------------------------------------------------------------
//  RECENT: oyuncu/AI karar bağlamı için sınırlı yakın olaylar.
//  EPISODE: açık veya çözülmüş konuşma/müzakere konusu.
//  MILESTONE: söz, sır, ihanet, borç ve köken gibi budanmayan mihenk taşları.
//
//  Bu defter gerçek üretmez. WorldFact, ActorBelief ve nedensel olaylara
//  kaynak gösterir; LLM yalnız ileride bu doğrulanmış bağlamı ifade edebilir.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_CHARACTER_MEMORY_SCHEMA_VERSION = 1;
const STORY_CHARACTER_MEMORY_ADAPTER_VERSION = 'story-character-memory-ledger-1';
const STORY_CHARACTER_MEMORY_POLICY_HASH = 'fnv1a32:phase36-three-layer-memory-1';
const STORY_CHARACTER_MEMORY_RECENT_CAP = 24;
const STORY_CHARACTER_MEMORY_SUMMARY_CAP = 12;
const STORY_CHARACTER_MEMORY_RESOLVED_EPISODE_CAP = 48;
const STORY_CHARACTER_MEMORY_OPEN_EPISODE_CAP = 64;
const STORY_CHARACTER_MEMORY_MILESTONE_CAP = 2048;
const STORY_CHARACTER_MEMORY_SERIALIZED_CHAR_CAP = 4000000;

const STORY_CHARACTER_MEMORY_KINDS = Object.freeze([
    'ORIGIN', 'CONVERSATION', 'PROMISE', 'SECRET', 'BETRAYAL', 'DEBT',
    'RELATIONSHIP', 'DECISION', 'ACHIEVEMENT', 'CONFLICT', 'OTHER'
]);
const STORY_CHARACTER_MEMORY_MILESTONE_STATUS = Object.freeze([
    'ACTIVE', 'OPEN', 'KEPT', 'BROKEN', 'RESOLVED'
]);

function storyMemoryEnabled() {
    return typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('characters.threeLayerMemory');
}

function storyMemoryClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyMemoryClampBps(value) {
    return Math.max(0, Math.min(10000, Math.round(Number(value) || 0)));
}

function storyMemorySafeToken(value) {
    return String(value == null ? '' : value).replace(/[^a-zA-Z0-9_-]/g, '-');
}

function storyMemoryNow() {
    return Number.isFinite(Number(STORY.clock)) ? Number(STORY.clock) : 0;
}

function storyMemoryIdentityMap() {
    const ledger = typeof storyCharacterIdentityEnsure === 'function'
        ? storyCharacterIdentityEnsure() : null;
    return ledger && ledger.identities || {};
}

function storyMemoryLedgerCreate(options) {
    options = options || {};
    return {
        schemaVersion: STORY_CHARACTER_MEMORY_SCHEMA_VERSION,
        adapterVersion: STORY_CHARACTER_MEMORY_ADAPTER_VERSION,
        policyHash: STORY_CHARACTER_MEMORY_POLICY_HASH,
        nextSequence: 0,
        recentByActor: {},
        episodes: {},
        milestones: {},
        summariesByActor: {},
        diagnostics: {
            backfilled: !!options.backfilled,
            restoredFromInvalidLedger: false,
            warnings: options.backfilled
                ? ['Eski kayıtta karakter hafızası yoktu; doğrulanmış köken olgularından güvenli backfill yapıldı.']
                : [],
            recentCap: STORY_CHARACTER_MEMORY_RECENT_CAP,
            summaryCap: STORY_CHARACTER_MEMORY_SUMMARY_CAP,
            resolvedEpisodeCap: STORY_CHARACTER_MEMORY_RESOLVED_EPISODE_CAP,
            openEpisodeCap: STORY_CHARACTER_MEMORY_OPEN_EPISODE_CAP,
            milestoneCap: STORY_CHARACTER_MEMORY_MILESTONE_CAP,
            serializedCharCap: STORY_CHARACTER_MEMORY_SERIALIZED_CHAR_CAP,
            inventedFacts: false,
            llmWrites: false
        }
    };
}

function storyMemoryNextId(ledger, layer) {
    ledger.nextSequence = Math.max(0, Math.floor(Number(ledger.nextSequence) || 0)) + 1;
    return `character-memory:${String(layer || 'record').toLowerCase()}:${ledger.nextSequence}`;
}

function storyMemoryRecentSummary(actorId, removed) {
    if (!removed.length) return null;
    const ledger = STORY.characterMemory;
    const kinds = {};
    for (const row of removed) kinds[row.kind] = (kinds[row.kind] || 0) + 1;
    const orderedKinds = Object.keys(kinds).sort().map(kind => `${kind}:${kinds[kind]}`);
    const summaries = ledger.summariesByActor[actorId] || (ledger.summariesByActor[actorId] = []);
    const record = {
        id: storyMemoryNextId(ledger, 'summary'),
        actorId,
        layer: 'SUMMARY',
        fromAt: Math.min(...removed.map(row => Number(row.occurredAt) || 0)),
        toAt: Math.max(...removed.map(row => Number(row.occurredAt) || 0)),
        recordCount: removed.length,
        kinds,
        summary: `Yakın bağlamdan ${removed.length} düşük öncelikli kayıt arşivlendi (${orderedKinds.join(', ')}).`,
        sourceMemoryIds: removed.map(row => row.id),
        createdAt: storyMemoryNow(),
        version: 1
    };
    summaries.push(record);
    while (summaries.length > STORY_CHARACTER_MEMORY_SUMMARY_CAP) summaries.shift();
    return record;
}

function storyMemoryPruneRecent(actorId) {
    const ledger = STORY.characterMemory;
    const rows = ledger && ledger.recentByActor[actorId];
    if (!rows || rows.length <= STORY_CHARACTER_MEMORY_RECENT_CAP) return [];
    rows.sort((a, b) => Number(b.importanceBps) - Number(a.importanceBps)
        || Number(b.occurredAt) - Number(a.occurredAt)
        || String(a.id).localeCompare(String(b.id), 'en'));
    const kept = rows.slice(0, STORY_CHARACTER_MEMORY_RECENT_CAP);
    const removed = rows.slice(STORY_CHARACTER_MEMORY_RECENT_CAP);
    kept.sort((a, b) => Number(a.occurredAt) - Number(b.occurredAt)
        || String(a.id).localeCompare(String(b.id), 'en'));
    ledger.recentByActor[actorId] = kept;
    storyMemoryRecentSummary(actorId, removed);
    return removed;
}

function storyMemoryAddRecent(actorId, input) {
    const ledger = storyMemoryEnsure();
    const identities = storyMemoryIdentityMap();
    const idActor = String(actorId || '');
    if (!ledger || !identities[idActor]) return { applied: false, reason: 'ACTOR_NOT_FOUND' };
    input = input || {};
    const rows = ledger.recentByActor[idActor] || (ledger.recentByActor[idActor] = []);
    const id = String(input.id || storyMemoryNextId(ledger, 'recent'));
    const existing = rows.find(row => row.id === id);
    if (existing) return { applied: false, duplicate: true, record: storyMemoryClone(existing) };
    const kind = STORY_CHARACTER_MEMORY_KINDS.includes(String(input.kind || '').toUpperCase())
        ? String(input.kind).toUpperCase() : 'OTHER';
    const record = {
        id,
        actorId: idActor,
        layer: 'RECENT',
        kind,
        summary: String(input.summary || kind),
        occurredAt: Number.isFinite(Number(input.occurredAt)) ? Number(input.occurredAt) : storyMemoryNow(),
        importanceBps: storyMemoryClampBps(input.importanceBps == null ? 5000 : input.importanceBps),
        relatedActorIds: Array.from(new Set((input.relatedActorIds || []).map(String))).sort(),
        source: storyMemoryClone(input.source || {}),
        version: 1
    };
    rows.push(record);
    const pruned = storyMemoryPruneRecent(idActor);
    return { applied: true, record: storyMemoryClone(record), prunedCount: pruned.length };
}

function storyMemoryOpenEpisode(input) {
    const ledger = storyMemoryEnsure();
    if (!ledger) return { applied: false, reason: 'MEMORY_DISABLED' };
    input = input || {};
    const identities = storyMemoryIdentityMap();
    const participants = Array.from(new Set((input.participantActorIds || []).map(String))).sort();
    if (!participants.length || participants.some(id => !identities[id])) {
        return { applied: false, reason: 'INVALID_PARTICIPANTS' };
    }
    const id = String(input.id || storyMemoryNextId(ledger, 'episode'));
    if (ledger.episodes[id]) return { applied: false, duplicate: true, episode: storyMemoryClone(ledger.episodes[id]) };
    const openCount = Object.values(ledger.episodes).filter(row => row && row.status === 'OPEN').length;
    if (openCount >= STORY_CHARACTER_MEMORY_OPEN_EPISODE_CAP) {
        return { applied: false, reason: 'OPEN_EPISODE_BUDGET_EXHAUSTED' };
    }
    const episode = {
        id,
        layer: 'EPISODE',
        topicKey: String(input.topicKey || 'general'),
        participantActorIds: participants,
        status: 'OPEN',
        summary: String(input.summary || input.topicKey || 'Açık konuşma konusu'),
        unresolvedTopic: input.unresolvedTopic == null ? String(input.topicKey || 'general') : String(input.unresolvedTopic),
        openedAt: Number.isFinite(Number(input.openedAt)) ? Number(input.openedAt) : storyMemoryNow(),
        lastUpdatedAt: storyMemoryNow(),
        resolvedAt: null,
        resolution: null,
        source: storyMemoryClone(input.source || {}),
        memoryIds: [],
        milestoneIds: [],
        version: 1
    };
    ledger.episodes[id] = episode;
    for (const actorId of participants) {
        const result = storyMemoryAddRecent(actorId, {
            id: `character-memory:episode-open:${storyMemorySafeToken(id)}:${storyMemorySafeToken(actorId)}`,
            kind: 'CONVERSATION',
            summary: episode.summary,
            occurredAt: episode.openedAt,
            importanceBps: input.importanceBps == null ? 6500 : input.importanceBps,
            relatedActorIds: participants.filter(id => id !== actorId),
            source: Object.assign({}, episode.source, { episodeId: id })
        });
        if (result.record) episode.memoryIds.push(result.record.id);
    }
    return { applied: true, episode: storyMemoryClone(episode) };
}

function storyMemoryPruneResolvedEpisodes() {
    const ledger = STORY.characterMemory;
    if (!ledger) return [];
    const resolved = Object.values(ledger.episodes).filter(row => row.status === 'RESOLVED')
        .sort((a, b) => Number(b.resolvedAt) - Number(a.resolvedAt)
            || String(a.id).localeCompare(String(b.id), 'en'));
    const removed = resolved.slice(STORY_CHARACTER_MEMORY_RESOLVED_EPISODE_CAP);
    for (const row of removed) delete ledger.episodes[row.id];
    return removed.map(row => row.id);
}

function storyMemoryResolveEpisode(episodeId, resolution) {
    const ledger = storyMemoryEnsure();
    const episode = ledger && ledger.episodes[String(episodeId || '')];
    if (!episode) return { applied: false, reason: 'EPISODE_NOT_FOUND' };
    if (episode.status === 'RESOLVED') return { applied: false, duplicate: true, episode: storyMemoryClone(episode) };
    episode.status = 'RESOLVED';
    episode.resolution = String(resolution || 'Çözüldü');
    episode.unresolvedTopic = null;
    episode.resolvedAt = storyMemoryNow();
    episode.lastUpdatedAt = episode.resolvedAt;
    for (const actorId of episode.participantActorIds) {
        storyMemoryAddRecent(actorId, {
            id: `character-memory:episode-resolved:${storyMemorySafeToken(episode.id)}:${storyMemorySafeToken(actorId)}`,
            kind: 'CONVERSATION',
            summary: episode.resolution,
            occurredAt: episode.resolvedAt,
            importanceBps: 7000,
            relatedActorIds: episode.participantActorIds.filter(id => id !== actorId),
            source: Object.assign({}, episode.source || {}, { episodeId: episode.id })
        });
    }
    storyMemoryPruneResolvedEpisodes();
    return { applied: true, episode: storyMemoryClone(episode) };
}

function storyMemoryAddMilestone(input) {
    const ledger = storyMemoryEnsure();
    if (!ledger) return { applied: false, reason: 'MEMORY_DISABLED' };
    input = input || {};
    const identities = storyMemoryIdentityMap();
    const subjectActorId = String(input.subjectActorId || '');
    const holders = Array.from(new Set((input.holderActorIds || [subjectActorId]).map(String))).sort();
    if (!identities[subjectActorId] || holders.some(id => !identities[id])) {
        return { applied: false, reason: 'INVALID_ACTOR_REFERENCE' };
    }
    const id = String(input.id || storyMemoryNextId(ledger, 'milestone'));
    if (ledger.milestones[id]) return { applied: false, duplicate: true, milestone: storyMemoryClone(ledger.milestones[id]) };
    if (Object.keys(ledger.milestones).length >= STORY_CHARACTER_MEMORY_MILESTONE_CAP) {
        return { applied: false, reason: 'MILESTONE_BUDGET_EXHAUSTED' };
    }
    const kind = STORY_CHARACTER_MEMORY_KINDS.includes(String(input.kind || '').toUpperCase())
        ? String(input.kind).toUpperCase() : 'OTHER';
    const status = STORY_CHARACTER_MEMORY_MILESTONE_STATUS.includes(String(input.status || '').toUpperCase())
        ? String(input.status).toUpperCase() : 'ACTIVE';
    const milestone = {
        id,
        layer: 'MILESTONE',
        kind,
        subjectActorId,
        holderActorIds: holders,
        relatedActorIds: Array.from(new Set((input.relatedActorIds || []).map(String))).sort(),
        summary: String(input.summary || kind),
        status,
        permanent: true,
        importanceBps: storyMemoryClampBps(input.importanceBps == null ? 9000 : input.importanceBps),
        createdAt: Number.isFinite(Number(input.createdAt)) ? Number(input.createdAt) : storyMemoryNow(),
        dueAt: Number.isFinite(Number(input.dueAt)) ? Number(input.dueAt) : null,
        resolvedAt: null,
        source: storyMemoryClone(input.source || {}),
        version: 1
    };
    ledger.milestones[id] = milestone;
    for (const holderId of (input.recordRecent === false ? [] : holders)) {
        storyMemoryAddRecent(holderId, {
            id: `character-memory:milestone-seen:${storyMemorySafeToken(id)}:${storyMemorySafeToken(holderId)}`,
            kind,
            summary: milestone.summary,
            occurredAt: milestone.createdAt,
            importanceBps: Math.min(8500, milestone.importanceBps),
            relatedActorIds: [subjectActorId].concat(milestone.relatedActorIds).filter(id => id !== holderId),
            source: Object.assign({}, milestone.source, { milestoneId: id })
        });
    }
    return { applied: true, milestone: storyMemoryClone(milestone) };
}

function storyMemoryResolveMilestone(milestoneId, status) {
    const ledger = storyMemoryEnsure();
    const milestone = ledger && ledger.milestones[String(milestoneId || '')];
    const nextStatus = String(status || '').toUpperCase();
    if (!milestone) return { applied: false, reason: 'MILESTONE_NOT_FOUND' };
    if (!STORY_CHARACTER_MEMORY_MILESTONE_STATUS.includes(nextStatus) || nextStatus === 'OPEN') {
        return { applied: false, reason: 'INVALID_STATUS' };
    }
    milestone.status = nextStatus;
    milestone.resolvedAt = storyMemoryNow();
    milestone.version = Math.max(1, Number(milestone.version) || 1) + 1;
    return { applied: true, milestone: storyMemoryClone(milestone) };
}

// Aynı konuşma şablonunda aynı kişiye tekrar verilen açık söz, yeni ve
// sınırsız mihenk taşları üretmez. Tek kaynaklı söz güncellenir; tekrarın
// kendisi yakın hafızaya ayrı bir kayıt olarak düşer.
function storyMemoryRecordPromise(input) {
    const ledger = storyMemoryEnsure();
    input = input || {};
    const subjectActorId = String(input.subjectActorId || '');
    const relatedActorId = String(input.relatedActorId || '');
    const templateId = String(input.talkTemplateId || 'general');
    const id = `character-memory:promise:${storyMemorySafeToken(templateId)}:${storyMemorySafeToken(subjectActorId)}:${storyMemorySafeToken(relatedActorId)}`;
    const existing = ledger && ledger.milestones[id];
    if (!existing) {
        return storyMemoryAddMilestone({
            id, kind: 'PROMISE', subjectActorId,
            holderActorIds: [subjectActorId, relatedActorId].filter(Boolean),
            relatedActorIds: [relatedActorId].filter(Boolean),
            summary: String(input.summary || 'Verilen söz kayda geçti.'),
            status: 'OPEN', importanceBps: input.importanceBps == null ? 9500 : input.importanceBps,
            dueAt: input.dueAt,
            source: storyMemoryClone(input.source || {})
        });
    }
    existing.summary = String(input.summary || existing.summary);
    existing.status = 'OPEN';
    existing.resolvedAt = null;
    existing.dueAt = Number.isFinite(Number(input.dueAt)) ? Number(input.dueAt) : existing.dueAt;
    existing.source = storyMemoryClone(input.source || existing.source || {});
    existing.version = Math.max(1, Number(existing.version) || 1) + 1;
    for (const holderActorId of existing.holderActorIds) {
        storyMemoryAddRecent(holderActorId, {
            id: `character-memory:promise-repeat:${storyMemorySafeToken(id)}:${existing.version}:${storyMemorySafeToken(holderActorId)}`,
            kind: 'PROMISE', summary: existing.summary, importanceBps: 8500,
            relatedActorIds: [subjectActorId, relatedActorId].filter(actorId => actorId && actorId !== holderActorId),
            source: Object.assign({}, existing.source, { milestoneId: id })
        });
    }
    return { applied: true, updated: true, milestone: storyMemoryClone(existing) };
}

// Borç yalnız yönlü ilişki defterindeki gerçek debtBps değişiminden doğar.
// Aynı A→B yükümlülüğü tek bir kalıcı mihenk taşında güncellenir; böylece
// her ödeme ayrı bir sahte "borç" çoğaltmaz ve borç sıfırlansa bile tarihçe
// tamamen unutulmaz.
function storyMemoryRecordRelationshipDebt(input) {
    const ledger = storyMemoryEnsure();
    input = input || {};
    const identities = storyMemoryIdentityMap();
    const debtorActorId = String(input.debtorActorId || '');
    const creditorActorId = String(input.creditorActorId || '');
    if (!ledger || !identities[debtorActorId] || !identities[creditorActorId]
        || debtorActorId === creditorActorId) {
        return { applied: false, reason: 'CANONICAL_DEBT_ACTORS_REQUIRED' };
    }
    const beforeDebtBps = storyMemoryClampBps(input.beforeDebtBps);
    const afterDebtBps = storyMemoryClampBps(input.afterDebtBps);
    if (beforeDebtBps === afterDebtBps) return { applied: false, reason: 'DEBT_UNCHANGED' };
    const relationshipId = String(input.relationshipId || `${debtorActorId}=>${creditorActorId}`);
    const id = `character-memory:debt:${storyMemorySafeToken(relationshipId)}`;
    const summary = String(input.summary
        || `${debtorActorId} aktörünün ${creditorActorId} aktörüne yükümlülüğü ${afterDebtBps} bps oldu.`);
    const source = Object.assign({}, storyMemoryClone(input.source || {}), { relationshipId });
    const existing = ledger.milestones[id];
    if (!existing) {
        const created = storyMemoryAddMilestone({
            id, kind: 'DEBT', subjectActorId: debtorActorId,
            holderActorIds: [debtorActorId, creditorActorId],
            relatedActorIds: [creditorActorId], summary,
            status: afterDebtBps > 0 ? 'OPEN' : 'RESOLVED',
            importanceBps: Math.max(7500, afterDebtBps), source
        });
        return Object.assign({}, created, { beforeDebtBps, afterDebtBps });
    }
    existing.summary = summary;
    existing.status = afterDebtBps > 0 ? 'OPEN' : 'RESOLVED';
    existing.importanceBps = Math.max(7500, afterDebtBps);
    existing.resolvedAt = afterDebtBps > 0 ? null : storyMemoryNow();
    existing.source = source;
    existing.version = Math.max(1, Number(existing.version) || 1) + 1;
    for (const holderActorId of existing.holderActorIds) {
        storyMemoryAddRecent(holderActorId, {
            id: `character-memory:debt-change:${storyMemorySafeToken(id)}:${existing.version}:${storyMemorySafeToken(holderActorId)}`,
            kind: 'DEBT', summary, importanceBps: Math.min(8500, existing.importanceBps),
            relatedActorIds: [debtorActorId, creditorActorId].filter(actorId => actorId !== holderActorId),
            source: Object.assign({}, source, { milestoneId: id })
        });
    }
    return { applied: true, updated: true, milestone: storyMemoryClone(existing), beforeDebtBps, afterDebtBps };
}

// Gizli bilgi, salt bir iddia veya LLM metni değildir. Yalnız kanonik bir
// bütünlük dosyasındaki kamuya kapalı, iddiayı destekleyen ve hem özgünlüğü
// hem ilgisi yüksek bir kanıt bu kapıdan SECRET olabilir.
function storyMemoryRecordPrivateIntegrityEvidence(caseRow, evidence) {
    const ledger = storyMemoryEnsure();
    const identities = storyMemoryIdentityMap();
    if (!ledger || !caseRow || !evidence || evidence.public
        || evidence.direction !== 'SUPPORTS'
        || Number(evidence.authenticityBps) < 8000
        || Number(evidence.relevanceBps) < 8000) {
        return { applied: false, reason: 'CONFIRMED_PRIVATE_EVIDENCE_REQUIRED' };
    }
    let subjectActorId = caseRow.subjectActorId ? String(caseRow.subjectActorId) : '';
    if (!identities[subjectActorId] && caseRow.beneficiaryCompanyId) {
        const companyActorId = `character:company-executive:${String(caseRow.beneficiaryCompanyId)}`;
        if (identities[companyActorId]) subjectActorId = companyActorId;
    }
    if (!identities[subjectActorId]) return { applied: false, reason: 'EVIDENCE_SUBJECT_REQUIRED' };
    const countryToken = String(caseRow.countryId || '').replace(/^country:/, '');
    const preferredHolderId = `character:${countryToken}:agent:domestic`;
    const holderActorId = identities[preferredHolderId]
        ? preferredHolderId
        : Object.values(identities).filter(row => row.countryId === caseRow.countryId && row.role === 'AGENT')
            .sort((a, b) => String(a.id).localeCompare(String(b.id), 'en'))[0]?.id;
    if (!holderActorId) return { applied: false, reason: 'INTELLIGENCE_HOLDER_REQUIRED' };
    return storyMemoryAddMilestone({
        id: `character-memory:integrity-secret:${storyMemorySafeToken(evidence.id)}`,
        kind: 'SECRET', subjectActorId, holderActorIds: [holderActorId],
        relatedActorIds: [subjectActorId].filter(id => id !== holderActorId),
        summary: `${String(caseRow.kind || 'BÜTÜNLÜK_DOSYASI')}: ${String(evidence.summaryCode || evidence.type)}`,
        status: 'ACTIVE', importanceBps: Math.max(9000, Number(evidence.relevanceBps) || 0),
        source: {
            integrityCaseId: String(caseRow.id), integrityEvidenceId: String(evidence.id),
            sourceId: String(evidence.sourceId || ''), sourceKind: String(evidence.sourceKind || '')
        }
    });
}

function storyMemorySeedOriginFacts() {
    const ledger = storyMemoryEnsure();
    const identityLedger = typeof storyCharacterIdentityEnsure === 'function'
        ? storyCharacterIdentityEnsure() : null;
    if (!ledger || !identityLedger) return { factCount: 0, milestoneCount: 0, recentCount: 0 };
    let milestoneCount = 0;
    let recentCount = 0;
    const beliefsByFact = {};
    for (const belief of Object.values(identityLedger.actorBeliefs || {})) {
        (beliefsByFact[belief.worldFactId] || (beliefsByFact[belief.worldFactId] = [])).push(belief);
    }
    const facts = Object.values(identityLedger.worldFacts || {})
        .filter(fact => fact && fact.factType === 'CHARACTER_ORIGIN_DECISION')
        .sort((a, b) => String(a.id).localeCompare(String(b.id), 'en'));
    for (const fact of facts) {
        const beliefs = (beliefsByFact[fact.id] || []).sort((a, b) => String(a.id).localeCompare(String(b.id), 'en'));
        const holderActorIds = Array.from(new Set([fact.subjectActorId].concat(
            beliefs.map(row => row.holderActorId)
        ))).filter(id => storyMemoryIdentityMap()[id]).sort();
        const milestoneId = `character-memory:origin:${storyMemorySafeToken(fact.id)}`;
        const milestoneResult = storyMemoryAddMilestone({
            id: milestoneId,
            kind: 'ORIGIN',
            subjectActorId: fact.subjectActorId,
            holderActorIds,
            summary: String(fact.optionText || fact.optionTag || 'Karakter geçmişi'),
            status: 'ACTIVE',
            importanceBps: 9000,
            createdAt: fact.occurredAt,
            recordRecent: false,
            source: { worldFactId: fact.id, eventId: fact.originEventId }
        });
        if (milestoneResult.applied) milestoneCount++;
        for (const belief of beliefs) {
            const recentResult = storyMemoryAddRecent(belief.holderActorId, {
                id: `character-memory:belief:${storyMemorySafeToken(belief.id)}`,
                kind: 'ORIGIN',
                summary: String(fact.optionText || fact.optionTag || 'Karakter geçmişi'),
                occurredAt: belief.learnedAt,
                importanceBps: Math.min(8000, Number(belief.confidenceBps) || 5000),
                relatedActorIds: [fact.subjectActorId].filter(id => id !== belief.holderActorId),
                source: { worldFactId: fact.id, actorBeliefId: belief.id, eventId: fact.originEventId }
            });
            if (recentResult.applied) recentCount++;
        }
    }
    return { factCount: facts.length, milestoneCount, recentCount };
}

function storyMemoryValidate(candidate) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!candidate || typeof candidate !== 'object') return { ok: false, issues: [{ code: 'LEDGER_REQUIRED', path: '$' }] };
    if (candidate.schemaVersion !== STORY_CHARACTER_MEMORY_SCHEMA_VERSION) add('SCHEMA_VERSION', '$.schemaVersion', 'Hafıza şema sürümü uyuşmuyor.');
    if (candidate.adapterVersion !== STORY_CHARACTER_MEMORY_ADAPTER_VERSION) add('ADAPTER_VERSION', '$.adapterVersion', 'Hafıza adaptörü uyuşmuyor.');
    if (candidate.policyHash !== STORY_CHARACTER_MEMORY_POLICY_HASH) add('POLICY_HASH', '$.policyHash', 'Hafıza politikası uyuşmuyor.');
    const identities = storyMemoryIdentityMap();
    for (const key of ['recentByActor', 'episodes', 'milestones', 'summariesByActor']) {
        if (!candidate[key] || typeof candidate[key] !== 'object' || Array.isArray(candidate[key])) add('OBJECT_REQUIRED', `$.${key}`, 'Hafıza koleksiyonu nesne olmalı.');
    }
    for (const [actorId, rows] of Object.entries(candidate.recentByActor || {})) {
        if (!identities[actorId]) add('ACTOR_REFERENCE', `$.recentByActor.${actorId}`, 'Yakın hafıza aktörü bulunamadı.');
        if (!Array.isArray(rows)) { add('RECENT_ARRAY', `$.recentByActor.${actorId}`, 'Yakın hafıza dizi olmalı.'); continue; }
        if (rows.length > STORY_CHARACTER_MEMORY_RECENT_CAP) add('RECENT_CAP', `$.recentByActor.${actorId}`, 'Yakın hafıza tavanı aşıldı.');
        for (const [index, row] of rows.entries()) {
            const at = `$.recentByActor.${actorId}[${index}]`;
            if (!row || row.actorId !== actorId || row.layer !== 'RECENT') add('RECENT_IDENTITY', at, 'Yakın kayıt aktör/katman sözleşmesini bozuyor.');
            if (!STORY_CHARACTER_MEMORY_KINDS.includes(row && row.kind)) add('MEMORY_KIND', `${at}.kind`, 'Hafıza türü geçersiz.');
        }
    }
    for (const [id, episode] of Object.entries(candidate.episodes || {})) {
        const at = `$.episodes.${id}`;
        if (!episode || episode.id !== id || episode.layer !== 'EPISODE') add('EPISODE_ID', at, 'Konuşma bölümü kimliği geçersiz.');
        if (!['OPEN', 'RESOLVED'].includes(episode && episode.status)) add('EPISODE_STATUS', `${at}.status`, 'Konuşma bölümü durumu geçersiz.');
        if (!Array.isArray(episode && episode.participantActorIds) || !episode.participantActorIds.length
            || episode.participantActorIds.some(actorId => !identities[actorId])) add('EPISODE_PARTICIPANTS', `${at}.participantActorIds`, 'Konuşma katılımcısı bulunamadı.');
        if (episode && episode.status === 'OPEN' && !episode.unresolvedTopic) add('EPISODE_OPEN_TOPIC', `${at}.unresolvedTopic`, 'Açık bölüm çözülmemiş konu taşımalı.');
    }
    const openEpisodeCount = Object.values(candidate.episodes || {}).filter(row => row && row.status === 'OPEN').length;
    const resolvedEpisodeCount = Object.values(candidate.episodes || {}).filter(row => row && row.status === 'RESOLVED').length;
    if (openEpisodeCount > STORY_CHARACTER_MEMORY_OPEN_EPISODE_CAP) add('OPEN_EPISODE_CAP', '$.episodes', 'Açık bölüm tavanı aşıldı.');
    if (resolvedEpisodeCount > STORY_CHARACTER_MEMORY_RESOLVED_EPISODE_CAP) add('RESOLVED_EPISODE_CAP', '$.episodes', 'Çözülmüş bölüm tavanı aşıldı.');
    for (const [id, milestone] of Object.entries(candidate.milestones || {})) {
        const at = `$.milestones.${id}`;
        if (!milestone || milestone.id !== id || milestone.layer !== 'MILESTONE' || milestone.permanent !== true) add('MILESTONE_ID', at, 'Mihenk taşı kimliği/kalıcılığı geçersiz.');
        if (!identities[milestone && milestone.subjectActorId]) add('MILESTONE_SUBJECT', `${at}.subjectActorId`, 'Mihenk taşı öznesi bulunamadı.');
        if (!Array.isArray(milestone && milestone.holderActorIds) || milestone.holderActorIds.some(actorId => !identities[actorId])) add('MILESTONE_HOLDERS', `${at}.holderActorIds`, 'Mihenk taşı bilen aktörleri geçersiz.');
        if (!STORY_CHARACTER_MEMORY_MILESTONE_STATUS.includes(milestone && milestone.status)) add('MILESTONE_STATUS', `${at}.status`, 'Mihenk taşı durumu geçersiz.');
    }
    if (Object.keys(candidate.milestones || {}).length > STORY_CHARACTER_MEMORY_MILESTONE_CAP) {
        add('MILESTONE_CAP', '$.milestones', 'Kalıcı mihenk taşı tavanı aşıldı.');
    }
    if (JSON.stringify(candidate).length > STORY_CHARACTER_MEMORY_SERIALIZED_CHAR_CAP) {
        add('SERIALIZED_SIZE_CAP', '$', 'Karakter hafıza defteri serileştirme bütçesini aştı.');
    }
    return { ok: issues.length === 0, issues };
}

function storyMemorySummary() {
    const ledger = storyMemoryEnsure();
    if (!ledger) return { disabled: true };
    const recentCounts = Object.values(ledger.recentByActor || {}).map(rows => rows.length);
    const summaryCounts = Object.values(ledger.summariesByActor || {}).map(rows => rows.length);
    const episodes = Object.values(ledger.episodes || {});
    const milestones = Object.values(ledger.milestones || {});
    const milestoneKinds = {};
    for (const row of milestones) milestoneKinds[row.kind] = (milestoneKinds[row.kind] || 0) + 1;
    return {
        schemaVersion: ledger.schemaVersion,
        adapterVersion: ledger.adapterVersion,
        actorCountWithRecent: recentCounts.length,
        recentCount: recentCounts.reduce((sum, value) => sum + value, 0),
        maxRecentPerActor: recentCounts.length ? Math.max(...recentCounts) : 0,
        summaryCount: summaryCounts.reduce((sum, value) => sum + value, 0),
        maxSummaryPerActor: summaryCounts.length ? Math.max(...summaryCounts) : 0,
        openEpisodeCount: episodes.filter(row => row.status === 'OPEN').length,
        resolvedEpisodeCount: episodes.filter(row => row.status === 'RESOLVED').length,
        milestoneCount: milestones.length,
        milestoneKinds,
        serializedChars: JSON.stringify(ledger).length,
        budgets: {
            recentPerActor: STORY_CHARACTER_MEMORY_RECENT_CAP,
            summaryPerActor: STORY_CHARACTER_MEMORY_SUMMARY_CAP,
            openEpisodes: STORY_CHARACTER_MEMORY_OPEN_EPISODE_CAP,
            resolvedEpisodes: STORY_CHARACTER_MEMORY_RESOLVED_EPISODE_CAP,
            milestones: STORY_CHARACTER_MEMORY_MILESTONE_CAP,
            serializedChars: STORY_CHARACTER_MEMORY_SERIALIZED_CHAR_CAP
        }
    };
}

function storyMemoryReset(options) {
    if (!storyMemoryEnabled()) { STORY.characterMemory = null; return null; }
    STORY.characterMemory = storyMemoryLedgerCreate(options);
    if (!options || options.seedOrigins !== false) storyMemorySeedOriginFacts();
    return storyMemorySnapshot();
}

function storyMemoryEnsure() {
    if (!storyMemoryEnabled()) return null;
    if (!STORY.characterMemory) STORY.characterMemory = storyMemoryLedgerCreate();
    return STORY.characterMemory;
}

function storyMemorySnapshot() {
    const ledger = storyMemoryEnsure();
    return ledger ? storyMemoryClone(ledger) : null;
}

function storyMemoryForSave() { return storyMemorySnapshot(); }

function storyMemoryRestore(saved) {
    if (!storyMemoryEnabled()) { STORY.characterMemory = null; return null; }
    const candidate = storyMemoryClone(saved);
    if (candidate && storyMemoryValidate(candidate).ok) {
        STORY.characterMemory = candidate;
    } else {
        STORY.characterMemory = storyMemoryLedgerCreate({ backfilled: true });
        STORY.characterMemory.diagnostics.restoredFromInvalidLedger = !!candidate;
    }
    storyMemorySeedOriginFacts();
    return storyMemorySnapshot();
}

function storyMemoryWorldView() {
    const ledger = storyMemorySnapshot();
    return ledger || {
        schemaVersion: STORY_CHARACTER_MEMORY_SCHEMA_VERSION,
        adapterVersion: STORY_CHARACTER_MEMORY_ADAPTER_VERSION,
        policyHash: STORY_CHARACTER_MEMORY_POLICY_HASH,
        nextSequence: 0,
        recentByActor: {}, episodes: {}, milestones: {}, summariesByActor: {},
        diagnostics: { disabled: true, inventedFacts: false, llmWrites: false }
    };
}
