// ============================================================================
//  CONVERSATION CONTEXT PACK V1
//  Öncelikli, kaynaklı ve görünür bilgi paketi. Dünya mutasyonu üretmez.
// ============================================================================

const STORY_CONTEXT_PACK_SCHEMA_VERSION = 1;
const STORY_CONTEXT_PACK_ADAPTER_VERSION = 'story-context-pack-1';
const STORY_CONTEXT_MODEL_LIMIT = 8192;
const STORY_CONTEXT_OUTPUT_RESERVE = 900;
const STORY_CONTEXT_FIXED_OVERHEAD = 650;
const STORY_CONTEXT_SECTION_KINDS = Object.freeze([
    'SYSTEM', 'IDENTITY', 'DIALOGUE_MOVE', 'AUTHORITY', 'OPEN_OBLIGATION',
    'FACT', 'CURRENT_TURN', 'RECENT_TURN', 'CLAIM', 'MEMORY', 'EPISODE_SUMMARY',
    'RUMOR', 'SMALL_TALK'
]);

function storyContextPackClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyContextPackTokenEstimate(text) {
    // Üretim kabulünde gerçek model tokenizer'ı enjekte edilmelidir. Bu sayaç
    // yalnız deterministik/headless güvenlik üst sınırı ve test tezgâhı içindir.
    return Math.max(1, Math.ceil(String(text || '').length / 3.2));
}

function storyContextPackHash(value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619) >>> 0;
    }
    return (`00000000${hash.toString(16)}`).slice(-8);
}

function storyContextPackCompile(input, options) {
    input = input && typeof input === 'object' ? input : {};
    options = options && typeof options === 'object' ? options : {};
    const modelLimit = Number.isInteger(options.modelLimit) ? options.modelLimit : STORY_CONTEXT_MODEL_LIMIT;
    const outputReserve = Number.isInteger(options.outputReserve) ? options.outputReserve : STORY_CONTEXT_OUTPUT_RESERVE;
    const fixedOverhead = Number.isInteger(options.fixedOverhead)
        ? options.fixedOverhead : STORY_CONTEXT_FIXED_OVERHEAD;
    const promptBudget = modelLimit - outputReserve - fixedOverhead;
    const tokenizer = typeof options.countTokens === 'function'
        ? options.countTokens : storyContextPackTokenEstimate;
    const tokenizerMode = typeof options.countTokens === 'function' ? 'MODEL_TOKENIZER' : 'DETERMINISTIC_ESTIMATE';
    const rejected = [];
    const seenSectionIds = new Set();
    const rows = (input.sections || []).map((row, ordinal) => Object.assign({}, row, { ordinal }))
        .filter(row => {
            if (!row.id || !STORY_CONTEXT_SECTION_KINDS.includes(row.kind) || !String(row.text || '').trim()) {
                rejected.push({ id: row.id || null, reason: 'INVALID_SECTION' }); return false;
            }
            if (row.visibility === 'HIDDEN' || row.visibleToListener === false) {
                rejected.push({ id: row.id, reason: 'HIDDEN_FROM_LISTENER' }); return false;
            }
            if (seenSectionIds.has(String(row.id))) {
                rejected.push({ id: row.id, reason: 'DUPLICATE_SECTION_ID' }); return false;
            }
            seenSectionIds.add(String(row.id));
            return true;
        })
        .map(row => ({
            id: String(row.id), kind: row.kind, text: String(row.text).trim(),
            sourceRefs: Array.from(new Set((row.sourceRefs || []).filter(Boolean).map(String))).sort(),
            priority: Math.max(0, Math.min(100, Number(row.priority) || 0)),
            protected: row.protected === true,
            recency: Number(row.recency) || 0,
            ordinal: row.ordinal,
            tokenCount: tokenizer(String(row.text).trim()) + 4
        }));
    const protectedRows = rows.filter(row => row.protected).sort((a, b) => a.ordinal - b.ordinal);
    const requiredTokens = protectedRows.reduce((sum, row) => sum + row.tokenCount, 0);
    if (requiredTokens > promptBudget) return {
        ok: false, code: 'PROTECTED_CONTEXT_EXCEEDS_BUDGET', schemaVersion: STORY_CONTEXT_PACK_SCHEMA_VERSION,
        adapterVersion: STORY_CONTEXT_PACK_ADAPTER_VERSION, modelLimit, outputReserve, fixedOverhead,
        promptBudget, tokenCount: requiredTokens, tokenizerMode, sections: [], dropped: [], rejected,
        worldMutation: false
    };
    const selected = protectedRows.slice();
    let tokenCount = requiredTokens;
    const optional = rows.filter(row => !row.protected).sort((a, b) =>
        b.priority - a.priority || b.recency - a.recency || b.ordinal - a.ordinal);
    const dropped = [];
    for (const row of optional) {
        if (tokenCount + row.tokenCount <= promptBudget) {
            selected.push(row); tokenCount += row.tokenCount;
        } else dropped.push({ id: row.id, kind: row.kind, tokenCount: row.tokenCount,
            reason: 'LOWER_PRIORITY_BUDGET_CUT' });
    }
    selected.sort((a, b) => a.ordinal - b.ordinal);
    const sections = selected.map(row => {
        const copy = storyContextPackClone(row); delete copy.ordinal; return copy;
    });
    const pack = {
        ok: true, code: 'CONTEXT_PACK_READY', schemaVersion: STORY_CONTEXT_PACK_SCHEMA_VERSION,
        adapterVersion: STORY_CONTEXT_PACK_ADAPTER_VERSION, packId: '', modelLimit,
        outputReserve, fixedOverhead, promptBudget, tokenCount, tokenizerMode, sections, dropped, rejected,
        protectedIds: sections.filter(row => row.protected).map(row => row.id),
        sourceRefs: Array.from(new Set(sections.flatMap(row => row.sourceRefs))).sort(),
        rawWorldRead: false, worldCommand: null, worldMutation: false
    };
    pack.packId = `context-pack:${storyContextPackHash(Object.assign({}, pack, { packId: '' }))}`;
    return pack;
}

function storyContextPackRender(pack) {
    if (!pack || !pack.ok) return '';
    return pack.sections.map(row => `[${row.kind}] ${row.text}`).join('\n');
}

function storyContextPackValidate(pack) {
    const issues = [];
    const add = (code, path) => issues.push({ code, path });
    if (!pack || typeof pack !== 'object') return { ok: false, issues: [{ code: 'PACK_REQUIRED', path: '$' }] };
    if (pack.schemaVersion !== STORY_CONTEXT_PACK_SCHEMA_VERSION) add('SCHEMA', '$.schemaVersion');
    if (pack.adapterVersion !== STORY_CONTEXT_PACK_ADAPTER_VERSION) add('ADAPTER', '$.adapterVersion');
    if (pack.ok !== true || pack.tokenCount > pack.promptBudget
        || pack.promptBudget + pack.outputReserve + pack.fixedOverhead !== pack.modelLimit) add('BUDGET', '$');
    if (!Array.isArray(pack.sections) || pack.sections.some(row =>
        !STORY_CONTEXT_SECTION_KINDS.includes(row.kind) || !row.id || !row.text
        || row.visibility === 'HIDDEN' || row.visibleToListener === false)) add('SECTION', '$.sections');
    if (pack.rawWorldRead !== false || pack.worldCommand !== null || pack.worldMutation !== false) add('BOUNDARY', '$');
    if (!/^context-pack:[a-f0-9]{8}$/.test(String(pack.packId || ''))
        || `context-pack:${storyContextPackHash(Object.assign({}, pack, { packId: '' }))}` !== pack.packId) {
        add('CHECKSUM', '$.packId');
    }
    return { ok: issues.length === 0, issues };
}

if (typeof module !== 'undefined' && module.exports) module.exports = {
    STORY_CONTEXT_MODEL_LIMIT, STORY_CONTEXT_OUTPUT_RESERVE, STORY_CONTEXT_FIXED_OVERHEAD,
    STORY_CONTEXT_SECTION_KINDS,
    storyContextPackTokenEstimate, storyContextPackCompile, storyContextPackRender,
    storyContextPackValidate
};
