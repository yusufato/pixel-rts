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

const model = sites.storyHexSitesCreate({ world, geography, urban, companyEconomy });
const validation = sites.storyHexSitesValidate(model, world, geography, urban, companyEconomy);
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
    && row.reason === 'ARABLE_SOIL_EVIDENCE_UNAVAILABLE'));
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

console.log('story-hex-sites: OK', JSON.stringify(model.diagnostics));
