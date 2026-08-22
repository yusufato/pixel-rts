'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const catalog = require('../js/StoryVisualCatalog.js');

const validation = catalog.storyVisualCatalogValidate();
assert.deepStrictEqual(validation.issues, [], validation.issues.join('\n'));

const assetRoot = path.join(__dirname, '..', 'assets', 'maps');
const diskSources = fs.readdirSync(assetRoot)
    .filter(name => /\.(png|webp|jpg|jpeg)$/i.test(name))
    .map(name => `assets/maps/${name}`)
    .sort();
const catalogSources = catalog.STORY_VISUAL_SOURCE_CATALOG
    .map(source => source.source).sort();
assert.deepStrictEqual(catalogSources, diskSources,
    'assets/maps alt1ndaki her resim aktif veya ar_iv kategorisine sahip olmal1');

const renderSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'StoryRender.js'), 'utf8');
const registryBody = renderSource.match(/const STORY_MAP_ATLAS_SPECS = \{([\s\S]*?)\n\};/);
assert(registryBody, 'StoryRender atlas sicili bulunamad1');
const runtimeAtlasKeys = Array.from(registryBody[1].matchAll(/^\s{4}([A-Za-z0-9_]+):\s*\{/gm))
    .map(match => match[1]).sort();
const activeAtlasKeys = catalog.STORY_VISUAL_SOURCE_CATALOG
    .filter(source => source.status === 'ACTIVE')
    .map(source => source.atlasKey).sort();
assert.deepStrictEqual(activeAtlasKeys, runtimeAtlasKeys,
    'renderer taraf1ndan y�klenen her atlas1n tek bir aktif kategori sahibi olmal1');

for (const source of catalog.STORY_VISUAL_SOURCE_CATALOG) {
    assert(source.category && source.purpose, `${source.id}: ama� veya kategori eksik`);
    assert(source.placement && source.placement.anchor,
        `${source.id}: yerle_im politikas1 eksik`);
    assert(source.domains.length > 0, `${source.id}: fiziksel domain eksik`);
}

const dryUrban = catalog.storyVisualSelectCategorizedSource({
    purpose: 'URBAN_FUNCTIONAL',
    climateZone: 'DRY',
    hexDomain: 'LAND',
    year: 2032,
    installedSource: { installedVisualStage: 0 }
});
assert.strictEqual(dryUrban.ok, true);
assert.strictEqual(dryUrban.atlasKey, 'urbanFunctionalDryModern',
    'kuru b�lge genel 1l1man _ehir atlas1n1 kullanmamal1');

const borealUrban = catalog.storyVisualSelectCategorizedSource({
    purpose: 'URBAN_FUNCTIONAL',
    climateZone: 'BOREAL',
    hexDomain: 'LAND',
    year: 2032,
    installedSource: { installedVisualStage: 0 }
});
assert.strictEqual(borealUrban.atlasKey, 'urbanFunctionalBorealModern');

const futureUrban = catalog.storyVisualSelectCategorizedSource({
    purpose: 'URBAN_FUNCTIONAL',
    climateZone: 'TEMPERATE',
    hexDomain: 'LAND',
    year: 2080,
    installedSource: { installedVisualStage: 3 }
});
assert.strictEqual(futureUrban.atlasKey, 'urbanFunctionalModern');
assert.strictEqual(futureUrban.fallbackReason, 'PERIOD_ASSET_MISSING',
    'gelecek teknoloji varl11 yoksa modern kaynak a�1k fallback olarak raporlanmal1');

assert.strictEqual(catalog.storyVisualPlacementDecision({
    atlasKey: 'modernPorts', hexDomain: 'WATER', landCoverageBps: 0
}).reason, 'HEX_DOMAIN_MISMATCH', 'liman a�1k deniz hexine yerle_memeli');
assert.strictEqual(catalog.storyVisualPlacementDecision({
    atlasKey: 'modernPorts', hexDomain: 'COAST', landCoverageBps: 6000
}).ok, true, 'liman k1y1n1n kara a1rl1kl1 kenar1na yerle_ebilmeli');
assert.strictEqual(catalog.storyVisualPlacementDecision({
    atlasKey: 'forests', hexDomain: 'WATER', landCoverageBps: 0
}).reason, 'HEX_DOMAIN_MISMATCH', 'orman suya yerle_memeli');
assert.strictEqual(catalog.storyVisualPlacementDecision({
    atlasKey: 'urbanFunctionalModern', hexDomain: 'LAND',
    climateZone: 'DRY', landCoverageBps: 10000, physicalOccupancy: true
}).reason, 'REGIONAL_CLIMATE_MISMATCH',
    '1l1man _ehir atlas1 kuru b�lge filtresini ge�memeli');

const vehiclePlacement = catalog.storyVisualPlacementDecision({
    atlasKey: 'transportRoad', hexDomain: 'MOBILE', rotation: Math.PI,
    flipX: true
});
assert.strictEqual(vehiclePlacement.ok, true);
assert.strictEqual(vehiclePlacement.rotation, 0,
    'piksel ta_1t kayna1 yeniden �rnekleyen canvas rotasyonuna sokulmamal1');
assert.strictEqual(vehiclePlacement.flipX, true,
    'y�n dei_imi atlas1n izin verdii kay1ps1z yatay aynalama ile yap1lmal1');

const dryCityRecipe = catalog.storyVisualUrbanPresentationRecipe({
    year: 2032,
    kind: 'RESIDENTIAL',
    climateZone: 'DRY',
    node: { id: 40, owner: 0, installedVisualStage: 0 },
    state: { tech: [] },
    physicalSites: { registryHash: 'placement-test' }
});
assert.strictEqual(dryCityRecipe.atlasKey, 'urbanFunctionalDryModern');
assert.strictEqual(dryCityRecipe.placement.ok, true);
assert.strictEqual(dryCityRecipe.category, 'URBAN');

const mineRecipe = catalog.storyVisualLandUseRecipe({
    year: 2032,
    landUseType: 'MINE',
    lifecycleState: 'OPERATING',
    landCoverageBps: 10000
});
assert.strictEqual(mineRecipe.atlasKey, 'landUseModern');
assert.strictEqual(mineRecipe.category, 'LAND_USE');
assert.strictEqual(mineRecipe.purpose, 'LAND_USE');
assert.strictEqual(mineRecipe.placement.ok, true);

const transportRecipe = catalog.storyVisualTransportAsset(
    'FREIGHT_TRAIN', 2080, { installedVisualStage: 3 }
);
assert.strictEqual(transportRecipe.category, 'MOBILE');
assert.strictEqual(transportRecipe.placement.ok, true);
assert.strictEqual(transportRecipe.fallbackReason, 'PERIOD_ASSET_MISSING');

console.log('STORY_VISUAL_PLACEMENT_OK', JSON.stringify({
    sourceCount: catalogSources.length,
    activeAtlasCount: activeAtlasKeys.length,
    archivedSourceCount: catalog.STORY_VISUAL_SOURCE_CATALOG
        .filter(source => source.status === 'ARCHIVED').length
}));
