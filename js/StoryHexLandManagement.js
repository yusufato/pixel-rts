// Persistent player-facing land-management intents for physical hexes.
// This layer never fabricates reserves, ownership or instant permits: it opens
// a traceable survey/assessment record which later authority and construction
// phases can approve and execute.
const STORY_HEX_LAND_MANAGEMENT_SCHEMA_VERSION = 1;
const STORY_HEX_LAND_MANAGEMENT_ADAPTER_VERSION = 'story-hex-land-management-1';

const STORY_HEX_LAND_ACTIONS = Object.freeze({
    PROTECTION_REVIEW: Object.freeze({ label: 'KORUMA BAŞVURUSU', covers: ['FOREST'],
        outcome: 'Koruma statüsü için kurum incelemesi açıldı.' }),
    FORESTRY_SURVEY: Object.freeze({ label: 'ORMANCILIK ETÜDÜ', covers: ['FOREST'],
        outcome: 'Sürdürülebilir kesim ve yeniden dikim etüdü açıldı.' }),
    CLEARING_ASSESSMENT: Object.freeze({ label: 'TEMİZLEME ETKİ DEĞERLENDİRMESİ', covers: ['FOREST'],
        outcome: 'Ormanı kaldırmaz; çevresel etki ve telafi kanıtı ister.' }),
    AGRICULTURE_SURVEY: Object.freeze({ label: 'TARIM SAHA ETÜDÜ', covers: ['OPEN_LAND', 'DRYLAND'],
        outcome: 'Toprak, su ve işgücü kanıtı için saha etüdü açıldı.' }),
    ENERGY_SITE_SURVEY: Object.freeze({ label: 'ENERJİ SAHA ETÜDÜ', covers: ['OPEN_LAND', 'DRYLAND', 'COAST'],
        outcome: 'Enerji tesisi için bağlantı ve çevre etüdü açıldı.' }),
    GEOLOGICAL_SURVEY: Object.freeze({ label: 'JEOLOJİK ÖLÇÜM BAŞLAT', resources: ['PETROLEUM', 'MINERAL'],
        outcome: 'Rezerv ve çıkarım verimi ölçümü açıldı; sonuç çıkmadan miktar gösterilmez.' })
});

function storyHexLandManagementEnsure(root) {
    const state = root || (typeof STORY !== 'undefined' ? STORY : null);
    if (!state) throw new Error('STORY_HEX_LAND_MANAGEMENT_STATE_REQUIRED');
    if (!state.hexLandManagement
        || Number(state.hexLandManagement.schemaVersion) !== STORY_HEX_LAND_MANAGEMENT_SCHEMA_VERSION) {
        state.hexLandManagement = { schemaVersion: STORY_HEX_LAND_MANAGEMENT_SCHEMA_VERSION,
            adapterVersion: STORY_HEX_LAND_MANAGEMENT_ADAPTER_VERSION,
            sequence: 0, version: 0, records: [] };
    }
    if (!Array.isArray(state.hexLandManagement.records)) state.hexLandManagement.records = [];
    return state.hexLandManagement;
}

function storyHexLandManagementOptions(selection) {
    if (!selection || selection.kind !== 'HEX') return [];
    return Object.entries(STORY_HEX_LAND_ACTIONS).filter(([, policy]) =>
        (!policy.covers || policy.covers.includes(String(selection.cover)))
        && (!policy.resources || policy.resources.includes(String(selection.resource))))
        .map(([actionType, policy]) => ({ actionType, label: policy.label, outcome: policy.outcome }));
}

function storyHexLandManagementRecords(cellId, root) {
    const ledger = storyHexLandManagementEnsure(root);
    return ledger.records.filter(record => record.cellId === String(cellId));
}

function storyHexLandManagementSubmit(input, root) {
    input = input || {};
    const actionType = String(input.actionType || '').toUpperCase();
    const policy = STORY_HEX_LAND_ACTIONS[actionType];
    if (!policy) return { ok: false, code: 'LAND_ACTION_INVALID' };
    const cellId = String(input.cellId || '');
    if (!cellId) return { ok: false, code: 'LAND_CELL_REQUIRED' };
    const cover = String(input.cover || '');
    const resource = String(input.resource || 'NONE');
    if (policy.covers && !policy.covers.includes(cover)) return { ok: false, code: 'LAND_COVER_MISMATCH' };
    if (policy.resources && !policy.resources.includes(resource)) return { ok: false, code: 'LAND_RESOURCE_MISMATCH' };
    const ledger = storyHexLandManagementEnsure(root);
    const duplicate = ledger.records.find(record => record.cellId === cellId
        && record.actionType === actionType && record.status === 'OPEN');
    if (duplicate) return { ok: false, code: 'LAND_ACTION_ALREADY_OPEN', record: duplicate };
    ledger.sequence++;
    const record = {
        id: `hex-land-action:${ledger.sequence}`, actionType, cellId,
        cellIndex: Number(input.cellIndex), regionId: String(input.regionId || ''),
        cover, resource, status: 'OPEN',
        createdAtClock: Math.max(0, Number(typeof STORY !== 'undefined' && STORY.clock) || 0),
        createdAtYear: Number(typeof STORY !== 'undefined' && STORY.year) || null,
        outcome: policy.outcome
    };
    if (ledger.records.length >= 500) {
        ledger.records.splice(0, ledger.records.length - 499);
    }
    ledger.records.push(record);
    ledger.version++;
    return { ok: true, record };
}

if (typeof module !== 'undefined' && module.exports) module.exports = {
    STORY_HEX_LAND_MANAGEMENT_SCHEMA_VERSION,
    STORY_HEX_LAND_MANAGEMENT_ADAPTER_VERSION,
    STORY_HEX_LAND_ACTIONS,
    storyHexLandManagementEnsure,
    storyHexLandManagementOptions,
    storyHexLandManagementRecords,
    storyHexLandManagementSubmit
};
