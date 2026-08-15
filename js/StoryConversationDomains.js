// ============================================================================
//  CONVERSATION DOMAIN ADAPTERS V1
//  Beş alan, tek kanıt zarfı. Metin veya dünya komutu üretmez.
// ============================================================================

const STORY_CONVERSATION_DOMAIN_SCHEMA_VERSION = 2;
const STORY_CONVERSATION_DOMAIN_ADAPTER_VERSION = 'story-conversation-domains-2';
const STORY_CONVERSATION_DOMAINS = Object.freeze([
    'SOCIAL', 'ECONOMY', 'POLITICS', 'MILITARY', 'DIPLOMACY'
]);
const STORY_CONVERSATION_DOMAIN_FACT_CACHE = new Map();

function storyConversationDomainClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyConversationDomainUnique(rows) {
    return Array.from(new Set((rows || []).filter(Boolean).map(String))).sort();
}

function storyConversationDomainResolve(analysis) {
    analysis = analysis || {};
    const topic = String(analysis.topic || '').toUpperCase();
    if (topic === 'MILITARY' || analysis.playerIntent === 'REQUEST_MILITARY_SUPPORT') return 'MILITARY';
    if (['COMMERCE', 'ECONOMY'].includes(topic)
        || ['FOUND_COMPANY', 'FOUND_STEEL_COMPANY', 'REDIRECT_SHIPMENT'].includes(analysis.playerIntent)
        || (analysis.claims || []).some(row => row.type === 'PLAYER_REPORTED_BUDGET')) return 'ECONOMY';
    if (['DIPLOMACY', 'FOREIGN_RELATIONS'].includes(topic)
        || ['PROPOSE_TREATY', 'REQUEST_ALLIANCE', 'NEGOTIATE_PEACE'].includes(analysis.playerIntent)) return 'DIPLOMACY';
    if (['POLITICS', 'GOVERNMENT', 'CONFLICT'].includes(topic)
        || ['ACCUSE', 'THREATEN'].includes(analysis.speechAct)) return 'POLITICS';
    return 'SOCIAL';
}

function storyConversationDomainRoleAdapter(roleView) {
    return roleView && roleView.ok && roleView.adapter
        ? roleView.adapter : (roleView && roleView.ok ? roleView : null);
}

function storyConversationDomainFactText(fact, countryName) {
    const value = fact && fact.value;
    const prefix = `${countryName || fact.subjectId} — `;
    if (fact.field === 'inflation' && Number.isFinite(Number(value))) {
        return `${prefix}doğrulanmış enflasyon göstergesi %${Number(value).toFixed(1)}.`;
    }
    if (fact.field === 'welfare' && Number.isFinite(Number(value))) {
        return `${prefix}doğrulanmış refah göstergesi ${Number(value).toFixed(1)}/100.`;
    }
    if (fact.field === 'resources' && value && typeof value === 'object') {
        return `${prefix}hazine kaynakları: petrol ${Number(value.oil || 0).toFixed(1)}, `
            + `insan gücü ${Number(value.manpower || 0).toFixed(1)}, puan ${Number(value.points || 0).toFixed(1)}.`;
    }
    if (fact.field === 'budget' && value && typeof value === 'object') {
        return `${prefix}devlet bütçesi ${String(value.status || 'UNKNOWN')}; `
            + `nakit ${Number(value.cash || 0).toFixed(1)} ${String(value.currency || 'STATE_CREDIT')}, `
            + `borç ${Number(value.debt || 0).toFixed(1)}, borç tavanı ${Number(value.debtCeiling || 0).toFixed(1)}, `
            + `gecikmiş ödeme ${Number(value.arrears || 0).toFixed(1)}.`;
    }
    return '';
}

function storyConversationDomainRelationshipBand(value, positive) {
    const score = Math.max(0, Math.min(10000, Number(value) || 0));
    if (positive) return score >= 7000 ? 'yüksek' : score >= 4000 ? 'orta' : 'düşük';
    return score >= 7000 ? 'yüksek' : score >= 4000 ? 'belirgin' : 'düşük';
}

function storyConversationDomainRelationshipFact(actor, playerActorId) {
    if (!actor || !playerActorId || actor.id === playerActorId
        || typeof storyRelationshipView !== 'function') return null;
    const edge = storyRelationshipView(actor.id, playerActorId);
    const observedAt = Number(typeof STORY !== 'undefined' && STORY.clock) || 0;
    if (!edge) return {
        id: `fact:relationship:${actor.id}=>${playerActorId}:unestablished`,
        actorId: String(actor.id), countryId: String(actor.countryId),
        field: 'directionalRelationshipStatus', status: 'VERIFIED', confidenceBps: 10000,
        sourceType: 'DIRECTIONAL_RELATIONSHIP_LEDGER_ABSENCE', observedAt,
        text: 'Muhatabın oyuncuya dönük kanonik ilişki kaydı henüz oluşmamış; güven, saygı, borç veya husumet sonucu varmış gibi söylenemez.'
    };
    return {
        id: String(edge.id), actorId: String(actor.id), countryId: String(actor.countryId),
        field: 'directionalRelationship', status: 'VERIFIED', confidenceBps: 10000,
        sourceType: 'DIRECTIONAL_RELATIONSHIP_LEDGER', observedAt: Number(edge.updatedAt) || 0,
        text: `Muhatabın oyuncuya dönük kanonik ilişki kaydı: güven ${storyConversationDomainRelationshipBand(edge.trustBps, true)}, `
            + `saygı ${storyConversationDomainRelationshipBand(edge.respectBps, true)}, çekince ${storyConversationDomainRelationshipBand(edge.fearBps, false)}, `
            + `borç ${storyConversationDomainRelationshipBand(edge.debtBps, false)}, husumet ${storyConversationDomainRelationshipBand(edge.hostilityBps, false)}. `
            + 'Bu kayıt yalnız muhataptan oyuncuya yöneliktir; ters yön hakkında kanıt değildir.'
    };
}

// Ham STORY durumunu konuşma motoruna açmaz. Kanonik WorldV2 görünümünü
// PlayerKnowledge bilgi sınıfından, bu kez dinleyici karakterin ülkesi açısından
// üretir. UNKNOWN/rumor/estimated kayıtlar kesin gerçek zarfına giremez.
function storyConversationDomainProjectFacts(actorId, analysis, roleView, options) {
    if (typeof storyCharacterIdentityView !== 'function') return [];
    const actor = storyCharacterIdentityView(actorId);
    if (!actor || !actor.countryId) return [];
    if (String(analysis && analysis.topic || '').toUpperCase() === 'RELATIONSHIP'
        || analysis && analysis.speechAct === 'ASK_RELATIONSHIP') {
        const relationship = storyConversationDomainRelationshipFact(
            actor, options && options.playerActorId
        );
        if (!relationship) return [];
        STORY_CONVERSATION_DOMAIN_FACT_CACHE.set(`${relationship.actorId}|${relationship.id}`, relationship);
        return [storyConversationDomainClone(relationship)];
    }
    if (storyConversationDomainResolve(analysis) !== 'ECONOMY'
        || typeof storyWorldV2Snapshot !== 'function'
        || typeof storyPlayerKnowledgeProject !== 'function') return [];
    // Şirket bilançosu ile ülke makro göstergeleri aynı kanıt değildir.
    if (analysis && analysis.diagnostics && analysis.diagnostics.economicScope === 'COMPANY') return [];
    const world = storyWorldV2Snapshot();
    const knowledge = storyPlayerKnowledgeProject(world, actor.countryId);
    const country = (knowledge.countries || []).find(row => row.id === actor.countryId);
    const worldCountry = (world.countries || []).find(row => row.id === actor.countryId);
    if (!country) return [];
    const adapter = storyConversationDomainRoleAdapter(roleView);
    const hasInstitution = !!(adapter && adapter.lifeStatus !== 'DEAD'
        && ((adapter.bindingEvidence || []).length || (adapter.authorityRoutes || []).length));
    const allowedFields = new Set(['inflation', 'welfare']);
    if (adapter && adapter.family === 'GOVERNMENT' && hasInstitution) {
        ['budget', 'resources'].forEach(field => allowedFields.add(field));
    }
    const rows = [];
    for (const field of allowedFields) {
        const fact = country[field];
        if (!fact || fact.status !== 'VERIFIED' || fact.value == null) continue;
        const text = storyConversationDomainFactText(fact, worldCountry && worldCountry.name);
        if (!text) continue;
        const row = {
            id: String(fact.id), actorId: String(actor.id), countryId: String(actor.countryId),
            field: String(fact.field), status: String(fact.status),
            confidenceBps: Number(fact.confidenceBps), sourceType: String(fact.source && fact.source.type || 'UNKNOWN'),
            observedAt: Number(fact.observedAt) || 0, text
        };
        STORY_CONVERSATION_DOMAIN_FACT_CACHE.set(`${row.actorId}|${row.id}`, row);
        rows.push(storyConversationDomainClone(row));
    }
    return rows.sort((a, b) => a.id.localeCompare(b.id, 'en'));
}

function storyConversationDomainFactResolve(ref, actorId) {
    const evidence = arguments.length > 2 && arguments[2];
    const preserved = evidence && Array.isArray(evidence.factRecords)
        ? evidence.factRecords.find(item => item.id === String(ref)
            && item.actorId === String(actorId)) : null;
    const row = preserved || STORY_CONVERSATION_DOMAIN_FACT_CACHE.get(`${String(actorId)}|${String(ref)}`);
    if (!row || row.actorId !== String(actorId) || row.status !== 'VERIFIED'
        || row.confidenceBps !== 10000) return null;
    return storyConversationDomainClone(row);
}

function storyConversationDomainBuild(input) {
    input = input && typeof input === 'object' ? input : {};
    const analysis = input.analysis || {};
    const domain = storyConversationDomainResolve(analysis);
    const inheritedClaims = (input.inheritedClaims || []).filter(row => row && row.id
        && ((domain === 'MILITARY' && row.type === 'PLAYER_REPORTED_MILITARY_THREAT')
            || (domain === 'ECONOMY' && row.type === 'PLAYER_REPORTED_BUDGET')));
    const claims = (analysis.claims || []).filter(row => row && row.id).concat(inheritedClaims);
    const entities = (analysis.entities || []).filter(row => row && row.entityId);
    const roleView = storyConversationDomainRoleAdapter(input.roleView);
    const authorityRefs = roleView ? storyConversationDomainUnique([].concat(
        (roleView.bindingEvidence || []).map(row => row.id),
        (roleView.authorityRoutes || []).map(row => row.institutionId || row.legalBasis)
    )) : [];
    const capabilityRequirements = {
        SOCIAL: [],
        ECONOMY: ['COMPANY_OR_ECONOMIC_AUTHORITY_IF_COMMITTING'],
        POLITICS: ['INSTITUTIONAL_AUTHORITY_IF_COMMITTING'],
        MILITARY: ['MILITARY_AUTHORITY_IF_COMMITTING'],
        DIPLOMACY: ['DIPLOMATIC_AUTHORITY_IF_COMMITTING']
    }[domain];
    const factRecords = (input.factRecords || []).filter(row => row && row.id).map(row => ({
        id: String(row.id), actorId: String(row.actorId), countryId: String(row.countryId),
        field: String(row.field), status: String(row.status),
        confidenceBps: Number(row.confidenceBps), sourceType: String(row.sourceType || 'UNKNOWN'),
        observedAt: Number(row.observedAt) || 0, text: String(row.text || '')
    })).sort((a, b) => a.id.localeCompare(b.id, 'en'));
    const bundle = {
        schemaVersion: STORY_CONVERSATION_DOMAIN_SCHEMA_VERSION,
        adapterVersion: STORY_CONVERSATION_DOMAIN_ADAPTER_VERSION,
        bundleId: '', domain,
        claimRefs: storyConversationDomainUnique(claims.map(row => row.id)),
        entityRefs: storyConversationDomainUnique(entities.map(row => row.entityId)),
        factRefs: storyConversationDomainUnique([].concat(input.factRefs || [], factRecords.map(row => row.id))),
        factRecords,
        beliefRefs: storyConversationDomainUnique(input.beliefRefs),
        memoryRefs: storyConversationDomainUnique(input.memoryRefs),
        authorityRefs,
        capabilityRequirements: capabilityRequirements.slice(),
        allowedOperations: ['READ_EVIDENCE', 'PROPOSE_DIALOGUE_MOVE'],
        producesText: false,
        rawWorldRead: false,
        worldCommand: null,
        worldMutation: false
    };
    const signature = JSON.stringify(Object.assign({}, bundle, { bundleId: '' }));
    let hash = 2166136261;
    for (let index = 0; index < signature.length; index++) {
        hash ^= signature.charCodeAt(index); hash = Math.imul(hash, 16777619) >>> 0;
    }
    bundle.bundleId = `domain-evidence:${(`00000000${hash.toString(16)}`).slice(-8)}`;
    return bundle;
}

function storyConversationDomainValidate(candidate) {
    const issues = [];
    const add = (code, path) => issues.push({ code, path });
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return { ok: false, issues: [{ code: 'BUNDLE_REQUIRED', path: '$' }] };
    }
    if (candidate.schemaVersion !== STORY_CONVERSATION_DOMAIN_SCHEMA_VERSION) add('SCHEMA', '$.schemaVersion');
    if (candidate.adapterVersion !== STORY_CONVERSATION_DOMAIN_ADAPTER_VERSION) add('ADAPTER', '$.adapterVersion');
    if (!/^domain-evidence:[a-f0-9]{8}$/.test(String(candidate.bundleId || ''))) add('BUNDLE_ID', '$.bundleId');
    if (!STORY_CONVERSATION_DOMAINS.includes(candidate.domain)) add('DOMAIN', '$.domain');
    for (const key of ['claimRefs', 'entityRefs', 'factRefs', 'beliefRefs', 'memoryRefs',
        'authorityRefs', 'capabilityRequirements', 'allowedOperations']) {
        if (!Array.isArray(candidate[key]) || new Set(candidate[key]).size !== candidate[key].length
            || candidate[key].some(row => typeof row !== 'string' || !row)) add('REF_LIST', `$.${key}`);
    }
    if (!Array.isArray(candidate.factRecords)) add('FACT_RECORDS', '$.factRecords');
    else for (const [index, row] of candidate.factRecords.entries()) {
        if (!row || !candidate.factRefs.includes(row.id) || row.status !== 'VERIFIED'
            || row.confidenceBps !== 10000 || !row.actorId || !row.countryId || !row.field
            || !row.sourceType || !row.text || !Number.isFinite(Number(row.observedAt))) {
            add('FACT_RECORD', `$.factRecords[${index}]`);
        }
    }
    if (candidate.producesText !== false || candidate.rawWorldRead !== false
        || candidate.worldCommand !== null || candidate.worldMutation !== false) add('BOUNDARY', '$');
    if ((candidate.allowedOperations || []).some(row =>
        !['READ_EVIDENCE', 'PROPOSE_DIALOGUE_MOVE'].includes(row))) add('OPERATION', '$.allowedOperations');
    const rebuilt = storyConversationDomainClone(candidate);
    rebuilt.bundleId = '';
    const expected = storyConversationDomainBuild({
        analysis: { topic: candidate.domain === 'ECONOMY' ? 'ECONOMY' : candidate.domain,
            claims: candidate.claimRefs.map(id => ({ id })),
            entities: candidate.entityRefs.map(entityId => ({ entityId })) },
        factRefs: candidate.factRefs, beliefRefs: candidate.beliefRefs,
        factRecords: candidate.factRecords,
        memoryRefs: candidate.memoryRefs,
        roleView: { ok: true, bindingEvidence: candidate.authorityRefs.map(id => ({ id })) }
    });
    if (expected.bundleId !== candidate.bundleId) add('CHECKSUM', '$.bundleId');
    return { ok: issues.length === 0, issues };
}

if (typeof module !== 'undefined' && module.exports) module.exports = {
    STORY_CONVERSATION_DOMAINS, storyConversationDomainResolve,
    storyConversationDomainBuild, storyConversationDomainValidate,
    storyConversationDomainProjectFacts, storyConversationDomainFactResolve
};
