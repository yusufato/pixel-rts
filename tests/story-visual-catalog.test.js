'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const catalog = require('../js/StoryVisualCatalog.js');

const validation = catalog.storyVisualCatalogValidate();
assert.strictEqual(validation.ok, true, validation.issues.join(', '));
assert.strictEqual(catalog.STORY_VISUAL_ASSET_MANIFEST.length, 144,
    'HXD-7.4.3d: 96 mevcut varlık + 48 iklim uyumlu işlevsel kent varyantı.');
assert.strictEqual(new Set(catalog.STORY_VISUAL_ASSET_MANIFEST.map(row => row.id)).size, 144);

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

const roadVehicle = catalog.storyVisualTransportAsset('ROAD_CONVOY', 2032);
assert.strictEqual(roadVehicle.ok, true);
assert.strictEqual(roadVehicle.atlasKey, 'transportRoad');
assert.strictEqual(roadVehicle.family, 'truck');
assert.strictEqual(roadVehicle.mirrorForReverse, true,
    'raster araçlar kaliteyi bozan canvas rotasyonu yerine piksel-korumalı ayna kullanmalı');
assert.strictEqual(roadVehicle.fallbackDepth, 0,
    'Takvim 2030 olsa da kurulu araç kademesi yoksa modern araçta kalmalı.');
const automatedTrain = catalog.storyVisualTransportAsset('FREIGHT_TRAIN', 2080, {
    installedVisualStage: 2
});
assert.strictEqual(automatedTrain.visualStageName, 'AUTOMATED');
assert.strictEqual(automatedTrain.assetPeriodId, 'AUTOMATED_2050');
assert.strictEqual(automatedTrain.fallbackDepth, 1);
assert.strictEqual(automatedTrain.fallbackReason, 'PERIOD_ASSET_MISSING');
assert.strictEqual(catalog.storyVisualTransportAsset('DECORATIVE_CAR', 2032).ok, false,
    'sevkiyata bağlı olmayan dekoratif araç sınıfı çizilmemeli');

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
assert.strictEqual(catalog.storyVisualClimateZone({
    node: { ly: .18 }, calendar: { month: 7, seasonIndex: 2 }
}), 'TEMPERATE', 'northern city must not keep its snow atlas outside winter');
assert.strictEqual(catalog.storyVisualClimateZone({
    node: { ly: .18 }, calendar: { month: 1, seasonIndex: 0 }
}), 'BOREAL', 'northern city may use its snow atlas in winter');
assert.strictEqual(catalog.storyVisualClimateZone({ node: { ly: .78 } }), 'DRY');
assert.strictEqual(catalog.storyVisualClimateZone({ node: { ly: .45, port: true } }), 'COASTAL');
const climateCity = catalog.storyVisualUrbanPresentationRecipe({
    year: 2032, kind: 'CORE', node: { id: 1, owner: 0, ly: .45, port: true },
    state: { tech: [] }, companyEconomy: { facilities: {} }
});
assert.strictEqual(climateCity.presentationSource, 'URBAN_CLIMATE');
assert.strictEqual(climateCity.atlasKey, 'urbanClimateModern');
assert.strictEqual(climateCity.atlasCell, 3,
    'Coastal city core must use the coastal civic center cell, not a terminal/commercial cell.');
const borealCity = catalog.storyVisualUrbanPresentationRecipe({
    year: 2032, kind: 'CORE', node: { id: 2, owner: 0, ly: .18 },
    state: { tech: [] }, physicalSites: { registryHash: 'boreal-test' }
});
assert.strictEqual(borealCity.presentationSource, 'URBAN_CLIMATE');
assert.strictEqual(borealCity.atlasKey, 'urbanClimateModern');
assert.strictEqual(borealCity.atlasCell, 2);
const dryCity = catalog.storyVisualUrbanPresentationRecipe({
    year: 2032, kind: 'CORE', node: { id: 3, owner: 0, ly: .78 },
    state: { tech: [] }, physicalSites: { registryHash: 'dry-test' }
});
assert.strictEqual(dryCity.presentationSource, 'URBAN_CLIMATE');
assert.strictEqual(dryCity.atlasKey, 'urbanClimateModern');
assert.strictEqual(dryCity.atlasCell, 1);

const functionalCells = {};
for (const kind of ['RESIDENTIAL', 'CIVIC', 'LOGISTICS', 'INDUSTRIAL']) {
    const recipe = catalog.storyVisualUrbanPresentationRecipe({
        year: 2032, kind, node: { id: 17, owner: 0, ly: .5 },
        district: { id: `district:${kind}` }, state: { tech: [] },
        physicalSites: { registryHash: 'functional-test' }
    });
    assert.strictEqual(recipe.presentationSource, kind === 'LOGISTICS'
        ? 'SPECIAL_LOGISTICS' : 'URBAN_FUNCTIONAL');
    if (kind !== 'LOGISTICS') functionalCells[kind] = recipe.atlasCell;
}
assert.strictEqual(Math.floor(functionalCells.RESIDENTIAL / 4), 0);
assert.strictEqual(Math.floor(functionalCells.CIVIC / 4), 1);
assert.strictEqual(Math.floor(functionalCells.INDUSTRIAL / 4), 3);
assert.ok(climateCity.atlasCell >= 0 && climateCity.atlasCell <= 3,
    'Baseline şehir çekirdeği dört konut varyantından deterministik seçim yapmalı.');
assert.strictEqual(climateCity.fallbackDepth, 0,
    'Kurulu kademe baseline ise 2032 takvimi şehri kendiliğinden yükseltmemeli.');

const adaptiveRoad = catalog.storyVisualInfrastructureRecipe({
    year: 2092,
    kind: 'ROAD',
    segment: { installedVisualStage: 3, status: 'OPERATING' }
});
assert.strictEqual(adaptiveRoad.visualStageName, 'ADAPTIVE');
assert.strictEqual(adaptiveRoad.assetPeriodId, 'ADAPTIVE_2075');
assert.strictEqual(adaptiveRoad.fallbackReason, 'PERIOD_ASSET_MISSING');
assert.ok(adaptiveRoad.renderStyle.width > 1);
const baselineRail = catalog.storyVisualInfrastructureRecipe({
    year: 2092, kind: 'RAIL', segment: { installedVisualStage: 0 }
});
assert.strictEqual(baselineRail.assetPeriodId, 'MODERN_2010');
assert.strictEqual(baselineRail.fallbackDepth, 0);
const visualAudit = catalog.storyVisualAuditSelections([
    roadVehicle, automatedTrain, adaptiveRoad, baselineRail
]);
assert.deepStrictEqual({
    selectionCount: visualAudit.selectionCount,
    exactCount: visualAudit.exactCount,
    fallbackCount: visualAudit.fallbackCount,
    assetMissingCount: visualAudit.assetMissingCount
}, { selectionCount: 4, exactCount: 2, fallbackCount: 2, assetMissingCount: 0 });
assert.strictEqual(visualAudit.byReason.PERIOD_ASSET_MISSING, 2);
assert.strictEqual(visualAudit.missingRequestedIds.length, 2);

const damagedIndustry = catalog.storyVisualUrbanPresentationRecipe({
    year: 2032, kind: 'INDUSTRIAL', node: { id: 4, owner: 0, ly: .5 },
    state: { tech: [] }, physicalSites: { registryHash: 'test' },
    physicalSite: { id: 'site:4', siteType: 'INDUSTRIAL', lifecycleState: 'DAMAGED' }
});
assert.strictEqual(damagedIndustry.presentationSource, 'URBAN_DAMAGE');
assert.strictEqual(damagedIndustry.atlasKey, 'urbanDamageModern');
assert.strictEqual(damagedIndustry.atlasCell, 13);

const sectorCells = [];
for (const sectorId of ['civil_industry', 'advanced_tech', 'defense_industry',
    'energy', 'extraction', 'agriculture']) {
    const recipe = catalog.storyVisualUrbanPresentationRecipe({
        year: 2032, kind: 'INDUSTRIAL', node: { id: 4, owner: 0, ly: .5 },
        state: { tech: [] }, physicalSites: { registryHash: 'sector-test' },
        physicalSite: { id: `site:${sectorId}`, siteType: 'INDUSTRIAL', sectorId,
            lifecycleState: 'OPERATING' }
    });
    assert.strictEqual(recipe.presentationSource, `SECTOR_${sectorId.toUpperCase()}`);
    assert.strictEqual(recipe.atlasKey, 'industrialSectorsModern');
    assert.strictEqual(recipe.assetMissing, false);
    sectorCells.push(recipe.atlasCell);
}
assert.strictEqual(new Set(sectorCells).size, 6,
    'Altı ekonomik sektör atlas üzerinde birbirinden ayırt edilebilir olmalı.');

const abstractIndustry = catalog.storyVisualUrbanPresentationRecipe({
    year: 2032, kind: 'INDUSTRIAL', node: { id: 4, owner: 0, ly: .5 },
    state: { tech: [] }, physicalSites: { registryHash: 'sector-test' }
});
assert.strictEqual(abstractIndustry.presentationSource, 'URBAN_FUNCTIONAL',
    'Fiziksel site olmadan belirli sektör tesisi değil genel sanayi ailesi seçilmeli.');
assert.strictEqual(abstractIndustry.atlasKey, 'urbanFunctionalModern');
assert.ok(abstractIndustry.atlasCell >= 12 && abstractIndustry.atlasCell <= 15);

const damagedSector = catalog.storyVisualUrbanPresentationRecipe({
    year: 2032, kind: 'INDUSTRIAL', node: { id: 4, owner: 0, ly: .5 },
    state: { tech: [] }, physicalSites: { registryHash: 'sector-test' },
    physicalSite: { id: 'site:energy:damaged', siteType: 'ENERGY', sectorId: 'energy',
        lifecycleState: 'DAMAGED' }
});
assert.strictEqual(damagedSector.presentationSource, 'URBAN_DAMAGE',
    'Hasar yaşam döngüsü çalışan sektör görselinden öncelikli olmalı.');
assert.strictEqual(damagedSector.atlasKey, 'urbanDamageModern');

const burningIndustry = catalog.storyVisualUrbanPresentationRecipe({
    year: 2032, kind: 'INDUSTRIAL', node: { id: 4, owner: 0, ly: .5 },
    state: { tech: [] }, physicalSites: { registryHash: 'test' },
    physicalSite: { id: 'site:fire:4', siteType: 'INDUSTRIAL', lifecycleState: 'BURNING' }
});
assert.strictEqual(burningIndustry.presentationSource, 'URBAN_DAMAGE');
assert.strictEqual(burningIndustry.condition, 'BURNING');
assert.strictEqual(burningIndustry.atlasKey, 'urbanDamageModern');
assert.strictEqual(burningIndustry.atlasCell, 13,
    'Aktif yangının altında hasarlı fiziksel yapı görünmeli.');
assert.strictEqual(burningIndustry.fireOverlay, true);
assert.strictEqual(burningIndustry.fireOverlayAtlasKey, 'conflictFireOverlay');

const damageCells = {};
for (const condition of ['DAMAGED', 'BURNED', 'ABANDONED']) {
    const recipe = catalog.storyVisualUrbanPresentationRecipe({
        year: 2018, kind: 'INDUSTRIAL', node: { id: 4, owner: 0, ly: .5 },
        state: { tech: [] }, physicalSites: { registryHash: 'damage-test' },
        physicalSite: { id: `site:${condition}`, siteType: 'INDUSTRIAL',
            lifecycleState: condition }
    });
    damageCells[condition] = recipe.atlasCell;
}
assert.strictEqual(new Set(Object.values(damageCells)).size, 3,
    'Hasarlı, yanmış ve terk edilmiş tesisler farklı atlas hücreleri kullanmalı.');
assert.notStrictEqual(damageCells.DAMAGED, burningIndustry.fireOverlayAtlasCell,
    'Aktif yangın yalnız hasar hücresi değil bağımsız gerçek overlay de taşımalı.');

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

for (const family of ['AGRICULTURE', 'FORESTRY', 'MINE', 'RENEWABLE']) {
    const cells = ['SETUP', 'OPERATING', 'DAMAGED', 'RECLAIMED'].map(lifecyclePhase =>
        catalog.storyVisualLandUseRecipe({
            year: 2018, landUseType: family, lifecyclePhase
        }).atlasCell);
    assert.strictEqual(new Set(cells).size, 4,
        `${family}: dört yaşam döngüsü atlas üzerinde ayırt edilebilir olmalı`);
}

const stageYears = [2018, 2035, 2058, 2080, 2096];
for (let stage = 0; stage < stageYears.length; stage++) {
    const state = { tech: ['stageTech'] };
    const stageTech = { stageTech: { visualStage: 4 } };
    const city = catalog.storyVisualUrbanRecipe({
        year: stageYears[stage], kind: 'INDUSTRIAL',
        node: { id: 9, owner: 0, installedVisualStage: stage },
        state, techById: stageTech, companyEconomy: { facilities: {} }
    });
    const road = catalog.storyVisualInfrastructureRecipe({
        year: stageYears[stage], kind: 'ROAD',
        segment: { installedVisualStage: stage }, state, techById: stageTech
    });
    const vehicle = catalog.storyVisualTransportAsset('ROAD_CONVOY',
        stageYears[stage], { installedVisualStage: stage });
    const expectedPeriod = catalog.STORY_VISUAL_PERIODS[stage].id;
    assert.strictEqual(city.assetPeriodId, expectedPeriod);
    assert.strictEqual(road.assetPeriodId, expectedPeriod);
    assert.strictEqual(vehicle.assetPeriodId, expectedPeriod);
    assert.strictEqual(city.visualStage, stage);
    assert.strictEqual(road.visualStage, stage);
    assert.strictEqual(vehicle.visualStage, stage);
}

for (const file of ['urban-construction-atlas-modern-v1.png',
    'urban-climate-atlas-modern-v1.png', 'urban-functional-atlas-modern-v1.png',
    'urban-functional-boreal-modern-v1.png', 'urban-functional-dry-modern-v1.png',
    'urban-damage-atlas-modern-v1.png',
    'special-facilities-atlas-modern-v1.png', 'land-use-atlas-modern-v1.png',
    'industrial-sector-atlas-modern-v1.png']) {
    const bytes = fs.readFileSync(path.join(__dirname, '..', 'assets', 'maps', file));
    assert.strictEqual(bytes.toString('ascii', 1, 4), 'PNG');
    assert.ok(bytes.readUInt32BE(16) >= 1024 && bytes.readUInt32BE(20) >= 1024,
        `${file}: atlas çözünürlüğü düşük`);
    assert.strictEqual(bytes[25], 6, `${file}: PNG gerçek RGBA olmalı`);
}

for (const file of ['transport-road-convoy-modern-v1.png',
    'transport-freight-train-modern-v1.png', 'transport-cargo-ship-modern-v1.png']) {
    const bytes = fs.readFileSync(path.join(__dirname, '..', 'assets', 'maps', file));
    assert.strictEqual(bytes.toString('ascii', 1, 4), 'PNG');
    assert.ok(bytes.readUInt32BE(16) >= 900 && bytes.readUInt32BE(20) >= 900,
        `${file}: araç kaynağı yüksek çözünürlüklü olmalı`);
    assert.strictEqual(bytes[25], 6, `${file}: PNG gerçek RGBA olmalı`);
}

{
    const file = 'conflict-fire-overlay-modern-v1.png';
    const bytes = fs.readFileSync(path.join(__dirname, '..', 'assets', 'maps', file));
    assert.strictEqual(bytes.toString('ascii', 1, 4), 'PNG');
    assert.ok(bytes.readUInt32BE(16) >= 900 && bytes.readUInt32BE(20) >= 900,
        `${file}: yangın overlayi yüksek çözünürlüklü olmalı`);
    assert.strictEqual(bytes[25], 6, `${file}: PNG gerçek RGBA olmalı`);
}

console.log('story-visual-catalog: OK');
