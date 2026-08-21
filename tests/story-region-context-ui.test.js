'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const company = {
    id: 'company:0:industry',
    name: 'Ankara Çelik AŞ',
    owners: [
        { ownerType: 'DOMESTIC_PRIVATE', shareBps: 8800 },
        { ownerType: 'STATE', shareBps: 1200 }
    ]
};
const land = {
    cellId: 'hex:ankara-industrial',
    regionId: 'region:7',
    activeUse: 'INDUSTRIAL',
    siteIds: ['site:factory']
};
const site = {
    id: 'site:factory',
    cellId: land.cellId,
    regionId: land.regionId,
    siteType: 'INDUSTRIAL',
    ownerCompanyId: company.id,
    operatorCompanyId: company.id,
    capacity: 240,
    operatingStatus: 'OPERATING'
};
const sites = {
    landUseByCellId: { [land.cellId]: land },
    siteIdsByCellId: { [land.cellId]: [site.id] },
    siteById: { [site.id]: site }
};
const settlements = {
    records: new Array(8).fill(null)
};
settlements.records[7] = {
    requiredPort: true,
    port: {
        fallbackCode: 'LEGACY_GEOMETRY_FALLBACK',
        hostRegionId: 0,
        terminalId: 14,
        distance: 42.75
    }
};
let selectedEntity = null;
let createdOrderSpec = null;
const context = {
    console, setTimeout, clearTimeout,
    window: {},
    document: { readyState: 'loading', addEventListener() {} },
    STORY: { _inited: true, clock: 12, nodes: [
        { id: 0, name: 'İstanbul', owner: 0 }, null, null, null, null, null, null,
        { id: 7, name: 'Ankara', owner: 0 }
    ], _selectedMapEntity: { kind: 'SITE', cellId: land.cellId, regionId: land.regionId } },
    STORY_WORLD_W: 4500,
    STORY_WORLD_H: 3540,
    storyCalendarNow: () => ({ seasonIndex: 0, year: 2032, label: '10.01.2032' }),
    storyHexSitesEnsure: () => sites,
    storyHexSettlementsEnsure: () => settlements,
    storyCompanyById: id => id === company.id ? company : null,
    storyPopulationRegionView: () => ({ populationPeople: 875000 }),
    storyPopulationLaborSupply: () => ({ status: 'COHORT_DERIVED', availableWorkersPeople: 312000 }),
    storyInstitutionRegionView: () => ({
        institution: { officeHolder: {
            name: 'Yerel İdareler Kurulu',
            actorType: 'COLLECTIVE_OFFICE',
            model: 'COLLECTIVE_LOCAL_OFFICE_PRE_PHASE_35'
        } }
    }),
    storyHexPoliticalCellAtWorld: () => ({ id: land.cellId }),
    STORY_RESOURCE_DEFINITIONS: [
        { id: 'food', label: 'Gıda' }, { id: 'industrial_parts', label: 'Sanayi Parçası' }
    ],
    STORY_TRADE_TRANSPORTABLE: ['food', 'industrial_parts'],
    storyTradePhysicalModes: () => ['LAND', 'RAIL'],
    storyRoutePlannerPlan: () => ({ ok: true, modes: ['LAND', 'RAIL'],
        totalLatencySeconds: 6.4, totalCost: 2.4, bottleneckCapacity: 12,
        reliabilityBps: 9600, transferRegionIds: ['region:1'] }),
    storyPlayerState: () => ({ id: 0 }),
    storyRegionalRegionView: () => ({ stocks: { food: 24, industrial_parts: 6 } }),
    storyTradeRegionView: () => ({ incoming: [], outgoing: [] }),
    storyTradeCreateOrder: spec => {
        createdOrderSpec = spec;
        return { ok: true, order: { id: 'trade-order:ui-1', status: 'OPEN' } };
    },
    storyTradeDispatchOrder: (order, quantity) => ({ ok: true, order, quantity,
        shipment: { id: 'trade-shipment:ui-1', quantity } }),
    storyTradeNode: id => id === 'region:0' ? context.STORY.nodes[0] : context.STORY.nodes[7],
    storyNode: id => context.STORY.nodes[Number(id)] || null,
    storySelectNode: (id, entity) => { selectedEntity = { id, entity }; }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('js/StoryUI.js', 'utf8'), context);

assert.strictEqual(context.storySeasonForUi().name, 'KIŞ');
assert.match(context.storySeasonTooltip(), /KIŞ · 10\.01\.2032/);
assert.doesNotMatch(context.storySeasonTooltip(), /undefined/);

const city = context.STORY.nodes[7];
const owner = { name: 'Türk Cumhuriyeti', color: '#55ff88' };
const basics = {
    type: 'KARARGAH', stateText: 'KOMUTA MERKEZİ', stateColor: '#4ade80',
    mapName: 'Standart taktik saha', doctrine: 'Birleşik Silahlar',
    reward: 'Komuta ve ikmal merkezi', rewardLabel: 'BÖLGE İŞLEVİ', force: '4'
};
const resolved = context.storyRegionSelectionResolve(city);
assert.strictEqual(resolved.kind, 'SITE');
assert.strictEqual(resolved.site.id, site.id);

const facilityHtml = context.storyRegionContextHtml(city, resolved, owner, basics);
assert.match(facilityHtml, /Ankara Çelik AŞ/);
assert.match(facilityHtml, /FABRİKA \/ SANAYİ TESİSİ/);
assert.match(facilityHtml, /YERLİ ÖZEL SERMAYE/);
assert.match(facilityHtml, /%88/);
assert.match(facilityHtml, /KAMU \/ KURUMSAL/);
assert.match(facilityHtml, /KAPASİTE<b>240/);
assert.match(facilityHtml, /DURUM<b>OPERATING/);
assert.match(facilityHtml, /Ankara idarî bölgesine bağlı/);
assert.match(facilityHtml, /BÖLGEDE KULLANILABİLİR İŞGÜCÜ: 312\.000/);
assert.match(facilityHtml, /ŞEHRE GİR · Ankara/);

const districtLand = { cellId: 'hex:ankara-residential', regionId: 'region:7',
    activeUse: 'RESIDENTIAL', siteIds: [] };
const districtHtml = context.storyRegionContextHtml(city,
    { kind: 'DISTRICT', cellId: districtLand.cellId, land: districtLand }, owner, basics);
assert.match(districtHtml, /KONUT İLÇESİ/);
assert.match(districtHtml, /ŞEHİR NÜFUSU/);
assert.match(districtHtml, /BÖLGE İŞGÜCÜ<b>312\.000/);
assert.match(districtHtml, /İlçe nüfusu henüz altıgen bazında muhasebeleştirilmedi/);

const cityHtml = context.storyRegionContextHtml(city, { kind: 'CITY' }, owner, basics);
assert.match(cityHtml, /Yerel İdareler Kurulu/);
assert.match(cityHtml, /kişisel belediye başkanı karakter fazında bağlanacak/);
assert.match(cityHtml, /ŞEHİR LOJİSTİĞİ/);
assert.match(cityHtml, /SİPARİŞİ OLUŞTUR VE SEVK ET/);
assert.match(cityHtml, /İstanbul/);
assert.match(cityHtml, /Gıda · 24/);
assert.match(cityHtml, /TIR KONVOYU → YÜK TRENİ/);
assert.match(cityHtml, /ETA <b>6.4 sn/);
assert.match(cityHtml, /DARBOĞAZ <b>12/);
assert.match(cityHtml, /AKTARMA <b>1/);
assert.match(cityHtml, /KAYNAK COĞRAFYA UYARISI/);
assert.match(cityHtml, /İstanbul · #14 · 42.8 dünya birimi/);

context.STORY._regionLogisticsDraft.quantity = '3';
context.STORY._regionLogisticsDraft.transportMode = 'RAIL';
const dispatch = context.storyRegionLogisticsDispatch();
assert.strictEqual(dispatch.ok, true);
assert.strictEqual(dispatch.shipment.quantity, 3);
assert.strictEqual(createdOrderSpec.sourceRegionId, 'region:7');
assert.strictEqual(createdOrderSpec.targetRegionId, 'region:0');
assert.strictEqual(createdOrderSpec.transportMode, 'RAIL');
assert.strictEqual(createdOrderSpec.source, 'PLAYER_REGION_LOGISTICS_UI');

assert.strictEqual(context.storySelectRegionEntityAtWorld(10, 20), true);
assert.strictEqual(selectedEntity.id, 7);
assert.strictEqual(selectedEntity.entity.kind, 'SITE');

console.log('story-region-context-ui: OK', JSON.stringify({
    city: city.name,
    facility: company.name,
    ownershipRows: company.owners.length
}));
