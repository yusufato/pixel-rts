'use strict';

const assert = require('assert');
const sites = require('../js/StoryHexSites.js');

const world = { layoutHash: 'layout-test' };
const geography = {
    geographyHash: 'geo-test',
    landCoverageBps: Uint16Array.from([10000, 10000, 10000, 10000]),
    terrainClass: Uint8Array.from([1, 1, 1, 1])
};
const urban = {
    footprintHash: 'urban-test',
    records: [{
        cityId: 0,
        districts: [
            { id: 'hex:0:0', index: 0, kind: 'CORE' },
            { id: 'hex:1:0', index: 1, kind: 'INDUSTRIAL' },
            { id: 'hex:2:0', index: 2, kind: 'INDUSTRIAL' },
            { id: 'hex:3:0', index: 3, kind: 'DEFENSE' }
        ]
    }]
};
const facility = (id, sectorId, capacity, extra) => Object.assign({
    id, regionId: 'region:0', sectorId, ownerCompanyId: `company:${sectorId}`,
    status: 'OPERATING', capacity
}, extra || {});
const companyEconomy = {
    facilities: {
        civil: facility('civil', 'civil_industry', 8, { installedVisualStage: 1 }),
        advanced: facility('advanced', 'advanced_tech', 7),
        defense: facility('defense', 'defense_industry', 6),
        energy: facility('energy', 'energy', 5),
        farm: facility('farm', 'agriculture', 4)
    },
    projects: [{
        id: 'project:1', facilityId: 'civil', status: 'BUILDING',
        remainingDays: 30, capacityIncrease: 0.2
    }]
};
const agriculture = {
    registryHash: 'agriculture-test',
    regionEvidence: {
        'region:0': {
            id: 'agriculture-region-evidence:region:0',
            candidateCellCount: 12,
            topCandidateCellIds: ['hex:7:7', 'hex:8:7'],
            missingEvidence: ['SOIL_CLASS', 'RAINFALL_CLASS', 'CROP_SUITABILITY']
        }
    }
};

const model = sites.storyHexSitesCreate({
    world, geography, urban, agriculture, companyEconomy
});
const validation = sites.storyHexSitesValidate(
    model, world, geography, urban, companyEconomy, null, agriculture
);
assert.strictEqual(validation.ok, true, validation.issues.map(issue => issue.code).join(','));
assert.strictEqual(model.landUseCells.length, 4);
assert.strictEqual(model.sites.length, 3,
    'iki sanayi ve bir savunma yuvasına yalnız üç gerçek tesis yerleşmeli');
assert.strictEqual(model.unplacedFacilities.length, 2);
assert.strictEqual(model.diagnostics.maxSitesPerCell, 1);
assert.strictEqual(new Set(model.sites.map(site => site.cellId)).size, model.sites.length,
    'bir altıgen sınırsız tesis ikonu yığınına dönüşmemeli');
assert.strictEqual(model.siteById['site:civil'].constructionState, 'EXPANDING');
assert.strictEqual(model.siteById['site:civil'].installedVisualStage, 1);
assert(model.unplacedFacilities.some(row => row.facilityId === 'farm'
    && row.reason === 'SOIL_AND_CROP_EVIDENCE_REQUIRED'
    && row.candidateCellCount === 12
    && row.evidenceRegistryId === 'agriculture-region-evidence:region:0'));
assert(model.unplacedFacilities.some(row => row.facilityId === 'energy'
    && row.reason === 'NO_FREE_COMPATIBLE_SITE_SLOT'));

const brokenGeography = Object.assign({}, geography, {
    terrainClass: Uint8Array.from([1, 0, 1, 1])
});
const invalid = sites.storyHexSitesValidate(model, world, brokenGeography, urban, companyEconomy);
assert.strictEqual(invalid.ok, false);
assert(invalid.issues.some(issue => issue.code === 'INVALID_TERRAIN'));

const ruralWorld = { layoutHash: 'layout-rural-test' };
const ruralGeography = {
    geographyHash: 'geo-rural-test',
    landCoverageBps: Uint16Array.from([10000, 10000]),
    terrainClass: Uint8Array.from([1, 1])
};
const ruralUrban = {
    footprintHash: 'urban-rural-test',
    records: [{ cityId: 0, districts: [{ id: 'hex:0:0', index: 0, kind: 'CORE' }] }]
};
const ruralNatural = {
    registryHash: 'natural-rural-test',
    coverCodes: Uint8Array.from([2, 2]),
    deposits: [{ id: 'deposit:mineral:1', cellId: 'hex:1:0', cellIndex: 1,
        regionId: 'region:0', resourceType: 'MINERAL' }]
};
const ruralEconomy = {
    facilities: { mine: facility('mine', 'extraction', 9) }, projects: []
};
const ruralModel = sites.storyHexSitesCreate({
    world: ruralWorld, geography: ruralGeography, urban: ruralUrban,
    natural: ruralNatural, companyEconomy: ruralEconomy
});
const ruralValidation = sites.storyHexSitesValidate(ruralModel, ruralWorld,
    ruralGeography, ruralUrban, ruralEconomy, ruralNatural);
assert.strictEqual(ruralValidation.ok, true,
    ruralValidation.issues.map(issue => issue.code).join(','));
assert.strictEqual(ruralModel.sites.length, 1);
assert.strictEqual(ruralModel.siteById['site:mine'].cellId, 'hex:1:0');
assert.strictEqual(ruralModel.landUseByCellId['hex:1:0'].activeUse, 'EXTRACTION');
assert.strictEqual(ruralModel.landUseByCellId['hex:1:0'].naturalDepositId,
    'deposit:mineral:1');

const expansionWorld = {
    layoutHash: 'layout-expansion-test', cellCount: 5,
    qValues: Int16Array.from([0, 1, 2, 3, 4]),
    rValues: Int16Array.from([0, 0, 0, 0, 0])
};
const expansionGeography = {
    geographyHash: 'geo-expansion-test',
    regionIds: Int16Array.from([0, 0, 0, 0, 0]),
    landCoverageBps: Uint16Array.from([10000, 10000, 10000, 10000, 10000]),
    terrainClass: Uint8Array.from([1, 1, 1, 1, 1])
};
const expansionUrban = {
    footprintHash: 'urban-expansion-test',
    records: [{ cityId: 0, core: { id: 'hex:0:0', index: 0 }, districts: [
        { id: 'hex:0:0', index: 0, kind: 'CORE' },
        { id: 'hex:1:0', index: 1, kind: 'INDUSTRIAL' }
    ] }]
};
const expansionNatural = {
    registryHash: 'natural-expansion-test',
    coverCodes: Uint8Array.from([2, 2, 2, 3, 4]), deposits: []
};
const expansionEconomy = { facilities: {
    first: facility('first', 'civil_industry', 8),
    second: facility('second', 'advanced_tech', 7)
}, projects: [] };
const expansionModel = sites.storyHexSitesCreate({ world: expansionWorld,
    geography: expansionGeography, urban: expansionUrban,
    natural: expansionNatural, companyEconomy: expansionEconomy });
const expansionValidation = sites.storyHexSitesValidate(expansionModel,
    expansionWorld, expansionGeography, expansionUrban,
    expansionEconomy, expansionNatural);
assert.strictEqual(expansionValidation.ok, true,
    expansionValidation.issues.map(issue => issue.code).join(','));
assert.strictEqual(expansionModel.sites.length, 2,
    'mevcut ikinci sanayi tesisi aynı bölgedeki boş kanonik hücreye göç etmeli');
assert.strictEqual(expansionModel.unplacedFacilities.length, 0);
assert.strictEqual(expansionModel.diagnostics.migrationExpansionCellCount, 1);
assert.strictEqual(expansionModel.landUseByCellId['hex:2:0'].zoningSource,
    'EXISTING_FACILITY_MIGRATION');
assert.strictEqual(expansionModel.landUseByCellId['hex:2:0'].siteIds.length, 1);

const constructionLedger = { commands: [{
    id: 'hex-construction:1', projectType: 'LOGISTICS', status: 'BUILDING',
    targetCellId: 'hex:3:0', targetCellIndex: 3, regionId: 'region:0',
    companyId: 'company:logistics', remainingDays: 40,
    requirements: { capacity: 1, durationDays: 100 }, completionReceiptId: null
}] };
const constructionModel = sites.storyHexSitesCreate({ world: expansionWorld,
    geography: expansionGeography, urban: expansionUrban,
    natural: expansionNatural, companyEconomy: { facilities: {}, projects: [] },
    hexConstruction: constructionLedger });
const constructionValidation = sites.storyHexSitesValidate(constructionModel,
    expansionWorld, expansionGeography, expansionUrban,
    { facilities: {}, projects: [] }, expansionNatural, null, constructionLedger);
assert.strictEqual(constructionValidation.ok, true,
    constructionValidation.issues.map(issue => issue.code).join(','));
assert.strictEqual(constructionModel.siteById['site:hex-construction:1'].constructionState,
    'BUILDING');
assert.strictEqual(constructionModel.landUseByCellId['hex:3:0'].zoningSource,
    'NEW_CONSTRUCTION_COMMAND');
assert.strictEqual(constructionModel.constructionSites.length, 1);
assert.strictEqual(constructionModel.constructionSites[0].constructionProgressBps, 6000);
constructionLedger.commands[0].remainingDays = 20;
const progressedConstructionModel = sites.storyHexSitesCreate({ world: expansionWorld,
    geography: expansionGeography, urban: expansionUrban,
    natural: expansionNatural, companyEconomy: { facilities: {}, projects: [] },
    hexConstruction: constructionLedger });
assert.strictEqual(progressedConstructionModel.sourceHash, constructionModel.sourceHash,
    'Canlı remainingDays statik site/şehir bitmap kaynak karmasını bozmamalı.');
assert.strictEqual(progressedConstructionModel.constructionSites[0].constructionProgressBps, 8000,
    'Yeni model istendiğinde canlı ilerleme doğru türetilmeli.');

console.log('story-hex-sites: OK', JSON.stringify(model.diagnostics));
