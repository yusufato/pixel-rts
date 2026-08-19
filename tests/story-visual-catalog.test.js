'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const catalog = require('../js/StoryVisualCatalog.js');

const validation = catalog.storyVisualCatalogValidate();
assert.strictEqual(validation.ok, true, validation.issues.join(', '));
assert.strictEqual(catalog.STORY_VISUAL_ASSET_MANIFEST.length, 86,
    'HXD-6.9 A2: 6 fallback + 16 inşaat + 64 yeni fiziksel atlas hücresi.');
assert.strictEqual(new Set(catalog.STORY_VISUAL_ASSET_MANIFEST.map(row => row.id)).size, 86);

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

const foundation = catalog.storyVisualConstructionRecipe({
    year: 2032,
    command: { projectType: 'RESIDENTIAL', status: 'BUILDING',
        remainingDays: 90, requirements: { durationDays: 100 } },
    physicalSite: { siteType: 'RESIDENTIAL', lifecycleState: 'CONSTRUCTION' }
});
assert.strictEqual(foundation.phase, 'FOUNDATION');
assert.strictEqual(foundation.progressBps, 1000);
assert.strictEqual(foundation.atlasKey, 'constructionModern');
assert.strictEqual(foundation.atlasCell, 0);

const structure = catalog.storyVisualConstructionRecipe({
    year: 2032,
    command: { projectType: 'LOGISTICS', status: 'BUILDING',
        remainingDays: 40, requirements: { durationDays: 100 } },
    physicalSite: { siteType: 'LOGISTICS', lifecycleState: 'CONSTRUCTION' }
});
assert.strictEqual(structure.phase, 'STRUCTURE');
assert.strictEqual(structure.atlasCell, 9);

const completedConstruction = catalog.storyVisualConstructionRecipe({
    year: 2032,
    command: { projectType: 'CIVIC', status: 'COMPLETED',
        remainingDays: 0, requirements: { durationDays: 100 } },
    physicalSite: { siteType: 'CIVIC', lifecycleState: 'OPERATING' }
});
assert.strictEqual(completedConstruction.phase, 'OPERATING');
assert.strictEqual(completedConstruction.progressBps, 10000);
assert.strictEqual(completedConstruction.atlasCell, 14);

const futureFallback = catalog.storyVisualConstructionRecipe({
    year: 2095,
    command: { projectType: 'INDUSTRIAL', status: 'COMPLETED' },
    physicalSite: { siteType: 'INDUSTRIAL', lifecycleState: 'DAMAGED' }
});
assert.strictEqual(futureFallback.phase, 'DAMAGED');
assert.strictEqual(futureFallback.atlasCell, 7);
assert.strictEqual(futureFallback.fallbackDepth, 1,
    'Gelecek çağ varlığı üretilmeden modern atlas açık fallback olmalı.');

assert.strictEqual(catalog.storyVisualClimateZone({ node: { ly: .18 } }), 'BOREAL');
assert.strictEqual(catalog.storyVisualClimateZone({ node: { ly: .78 } }), 'DRY');
assert.strictEqual(catalog.storyVisualClimateZone({ node: { ly: .45, port: true } }), 'COASTAL');
const climateCity = catalog.storyVisualUrbanPresentationRecipe({
    year: 2032, kind: 'CORE', node: { id: 1, owner: 0, ly: .45, port: true },
    state: { tech: [] }, companyEconomy: { facilities: {} }
});
assert.strictEqual(climateCity.presentationSource, 'URBAN_CLIMATE');
assert.strictEqual(climateCity.atlasKey, 'urbanClimateModern');
assert.strictEqual(climateCity.atlasCell, 3);
assert.strictEqual(climateCity.fallbackDepth, 1);

const damagedIndustry = catalog.storyVisualUrbanPresentationRecipe({
    year: 2032, kind: 'INDUSTRIAL', node: { id: 4, owner: 0, ly: .5 },
    state: { tech: [] }, physicalSites: { registryHash: 'test' },
    physicalSite: { id: 'site:4', siteType: 'INDUSTRIAL', lifecycleState: 'DAMAGED' }
});
assert.strictEqual(damagedIndustry.presentationSource, 'URBAN_DAMAGE');
assert.strictEqual(damagedIndustry.atlasKey, 'urbanDamageModern');
assert.strictEqual(damagedIndustry.atlasCell, 13);

const borealDefense = catalog.storyVisualUrbanPresentationRecipe({
    year: 2032, kind: 'DEFENSE', node: { id: 8, owner: 0, ly: .2 },
    state: { tech: [] }, physicalSites: { registryHash: 'test' },
    physicalSite: { id: 'site:8', siteType: 'DEFENSE', lifecycleState: 'OPERATING' }
});
assert.strictEqual(borealDefense.presentationSource, 'SPECIAL_DEFENSE');
assert.strictEqual(borealDefense.atlasKey, 'specialFacilitiesModern');
assert.strictEqual(borealDefense.atlasCell, 14);

const reclaimedMine = catalog.storyVisualLandUseRecipe({
    year: 2032, landUseType: 'MINE', lifecycleState: 'ABANDONED'
});
assert.strictEqual(reclaimedMine.lifecyclePhase, 'RECLAIMED');
assert.strictEqual(reclaimedMine.atlasKey, 'landUseModern');
assert.strictEqual(reclaimedMine.atlasCell, 11);

for (const file of ['urban-construction-atlas-modern-v1.png',
    'urban-climate-atlas-modern-v1.png', 'urban-damage-atlas-modern-v1.png',
    'special-facilities-atlas-modern-v1.png', 'land-use-atlas-modern-v1.png']) {
    const bytes = fs.readFileSync(path.join(__dirname, '..', 'assets', 'maps', file));
    assert.strictEqual(bytes.toString('ascii', 1, 4), 'PNG');
    assert.ok(bytes.readUInt32BE(16) >= 1024 && bytes.readUInt32BE(20) >= 1024,
        `${file}: atlas çözünürlüğü düşük`);
    assert.strictEqual(bytes[25], 6, `${file}: PNG gerçek RGBA olmalı`);
}

console.log('story-visual-catalog: OK');
