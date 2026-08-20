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
let selectedEntity = null;
const context = {
    console, setTimeout, clearTimeout,
    window: {},
    document: { readyState: 'loading', addEventListener() {} },
    STORY: { _inited: true, _selectedMapEntity: { kind: 'SITE', cellId: land.cellId, regionId: land.regionId } },
    STORY_WORLD_W: 4500,
    STORY_WORLD_H: 3540,
    storyHexSitesEnsure: () => sites,
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
    storyNode: id => Number(id) === 7 ? { id: 7, name: 'Ankara' } : null,
    storySelectNode: (id, entity) => { selectedEntity = { id, entity }; }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('js/StoryUI.js', 'utf8'), context);

const city = { id: 7, name: 'Ankara' };
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
assert.match(facilityHtml, /ŞEHRE GİR · Ankara/);

const districtLand = { cellId: 'hex:ankara-residential', regionId: 'region:7',
    activeUse: 'RESIDENTIAL', siteIds: [] };
const districtHtml = context.storyRegionContextHtml(city,
    { kind: 'DISTRICT', cellId: districtLand.cellId, land: districtLand }, owner, basics);
assert.match(districtHtml, /KONUT İLÇESİ/);
assert.match(districtHtml, /ŞEHİR NÜFUSU/);
assert.match(districtHtml, /İlçe nüfusu henüz altıgen bazında muhasebeleştirilmedi/);

const cityHtml = context.storyRegionContextHtml(city, { kind: 'CITY' }, owner, basics);
assert.match(cityHtml, /Yerel İdareler Kurulu/);
assert.match(cityHtml, /kişisel belediye başkanı karakter fazında bağlanacak/);

assert.strictEqual(context.storySelectRegionEntityAtWorld(10, 20), true);
assert.strictEqual(selectedEntity.id, 7);
assert.strictEqual(selectedEntity.entity.kind, 'SITE');

console.log('story-region-context-ui: OK', JSON.stringify({
    city: city.name,
    facility: company.name,
    ownershipRows: company.owners.length
}));
