// ============================================================================
//  CONVERSATION DOMAIN ADAPTERS V1
//  Beş alan, tek kanıt zarfı. Metin veya dünya komutu üretmez.
// ============================================================================

const STORY_CONVERSATION_DOMAIN_SCHEMA_VERSION = 1;
const STORY_CONVERSATION_DOMAIN_ADAPTER_VERSION = 'story-conversation-domains-1';
const STORY_CONVERSATION_DOMAINS = Object.freeze([
    'SOCIAL', 'ECONOMY', 'POLITICS', 'MILITARY', 'DIPLOMACY'
]);

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

function storyConversationDomainBuild(input) {
    input = input && typeof input === 'object' ? input : {};
    const analysis = input.analysis || {};
    const domain = storyConversationDomainResolve(analysis);
    const inheritedClaims = (input.inheritedClaims || []).filter(row => row && row.id
        && ((domain === 'MILITARY' && row.type === 'PLAYER_REPORTED_MILITARY_THREAT')
            || (domain === 'ECONOMY' && row.type === 'PLAYER_REPORTED_BUDGET')));
    const claims = (analysis.claims || []).filter(row => row && row.id).concat(inheritedClaims);
    const entities = (analysis.entities || []).filter(row => row && row.entityId);
    const roleView = input.roleView && input.roleView.ok ? input.roleView : null;
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
    const bundle = {
        schemaVersion: STORY_CONVERSATION_DOMAIN_SCHEMA_VERSION,
        adapterVersion: STORY_CONVERSATION_DOMAIN_ADAPTER_VERSION,
        bundleId: '', domain,
        claimRefs: storyConversationDomainUnique(claims.map(row => row.id)),
        entityRefs: storyConversationDomainUnique(entities.map(row => row.entityId)),
        factRefs: storyConversationDomainUnique(input.factRefs),
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
        memoryRefs: candidate.memoryRefs,
        roleView: { ok: true, bindingEvidence: candidate.authorityRefs.map(id => ({ id })) }
    });
    if (expected.bundleId !== candidate.bundleId) add('CHECKSUM', '$.bundleId');
    return { ok: issues.length === 0, issues };
}

if (typeof module !== 'undefined' && module.exports) module.exports = {
    STORY_CONVERSATION_DOMAINS, storyConversationDomainResolve,
    storyConversationDomainBuild, storyConversationDomainValidate
};
