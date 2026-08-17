'use strict';

const assert = require('assert');
const catalog = require('../js/StoryVisualCatalog.js');

const validation = catalog.storyVisualCatalogValidate();
assert.strictEqual(validation.ok, true, validation.issues.join(', '));

assert.strictEqual(catalog.storyVisualPeriodForYear(2010).id, 'MODERN_2010');
assert.strictEqual(catalog.storyVisualPeriodForYear(2049).id, 'CONNECTED_2030');
assert.strictEqual(catalog.storyVisualPeriodForYear(2100).id, 'FRONTIER_2090');
assert.strictEqual(catalog.storyVisualPeriodForYear(2200).id, 'FRONTIER_2090');

const techById = {
    researchedFutureFactory: { id: 'researchedFutureFactory', visualStage: 3 }
};
const researchedOnly = catalog.storyVisualUrbanRecipe({
    year: 2080,
    kind: 'INDUSTRIAL',
    node: { id: 7, owner: 2 },
    state: { tech: ['researchedFutureFactory'] },
    techById,
    companyEconomy: { facilities: {} }
});
assert.strictEqual(researchedOnly.researchCeiling, 3);
assert.strictEqual(researchedOnly.installedStage, 0,
    'Araştırma tek başına fiziksel görünümü yükseltmemeli.');
assert.strictEqual(researchedOnly.visualStage, 0);

const installed = catalog.storyVisualUrbanRecipe({
    year: 2080,
    kind: 'INDUSTRIAL',
    node: { id: 7, owner: 2 },
    state: { tech: ['researchedFutureFactory'] },
    techById,
    companyEconomy: {
        facilities: {
            factory: {
                id: 'factory', regionId: 'region:7', sectorId: 'advanced_tech',
                status: 'OPERATING', installedVisualStage: 2
            }
        }
    }
});
assert.strictEqual(installed.installedStage, 2);
assert.strictEqual(installed.visualStage, 2);
assert.strictEqual(installed.visualStageName, 'AUTOMATED');
assert.strictEqual(installed.sourceFacilityId, 'factory');
assert.strictEqual(installed.periodId, 'ADAPTIVE_2075');
assert.strictEqual(installed.atlasRow, 2);
assert.ok(installed.fallbackDepth > 0,
    'Gelecek dönem resmi gelene kadar açık fallback raporlanmalı.');
assert.strictEqual(installed.resolvedAssetId,
    'urban.industrial.baseline.operating.modern_2010');
assert.strictEqual(installed.assetMissing, false);

const overInstalled = catalog.storyVisualUrbanRecipe({
    year: 2095,
    kind: 'CIVIC',
    node: { id: 1, owner: 0, visualInstalledStage: 4 },
    state: { tech: ['researchedFutureFactory'] },
    techById,
    companyEconomy: { facilities: {} }
});
assert.strictEqual(overInstalled.visualStage, 3,
    'Kurulu görünüm araştırma tavanını aşmamalı.');

const physical = catalog.storyVisualUrbanRecipe({
    year: 2055,
    kind: 'INDUSTRIAL',
    node: { id: 4, owner: 1 },
    state: { tech: ['researchedFutureFactory'] },
    techById,
    physicalSites: { registryHash: 'physical-test' },
    physicalSite: {
        id: 'site:factory:4', sourceFacilityId: 'factory:4',
        installedVisualStage: 2, lifecycleState: 'DAMAGED'
    },
    companyEconomy: {
        facilities: {
            abstractOnly: {
                id: 'abstractOnly', regionId: 'region:4', sectorId: 'advanced_tech',
                status: 'OPERATING', installedVisualStage: 4
            }
        }
    }
});
assert.strictEqual(physical.visualStage, 2);
assert.strictEqual(physical.condition, 'DAMAGED');
assert.strictEqual(physical.sourcePhysicalSiteId, 'site:factory:4');
assert.strictEqual(physical.sourceFacilityId, 'factory:4');
assert.notStrictEqual(physical.visualStage, 4,
    'Fiziksel sicil varken soyut şirket tesisi görünümü yükseltememeli.');

assert.strictEqual(catalog.storyVisualLegacyUrbanRow('CORE', 3, false), 3);
assert.strictEqual(catalog.storyVisualLegacyUrbanRow('CORE', 2, true), 2);
assert.strictEqual(catalog.storyVisualLegacyUrbanRow('DEFENSE', 1, false), 1);

const missing = catalog.storyVisualResolveAsset({
    kind: 'INDUSTRIAL', visualStageName: 'FRONTIER', condition: 'BURNED',
    periodId: 'FRONTIER_2090'
}, []);
assert.strictEqual(missing.ok, false);
assert.strictEqual(missing.fallbackReason, 'NO_REGISTERED_ASSET_FALLBACK');

console.log('story-visual-catalog: OK');
