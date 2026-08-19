// ═══════════════════════════════════════════════════════════════════════════
//  HİKÂYE GÖRSEL DİLİ VE VARLIK SİCİLİ — HXD-6.4
//  ---------------------------------------------------------------------------
//  2010–2100 dünyasında mekanik gerçek ile çizilen varlığı birbirine bağlar.
//  Yıl yalnız sanat dönemini belirler; araştırma bir üst sınırdır. Bir hücre,
//  ancak kurulu/işletilen fiziksel varlık o kademeyi taşıyorsa yeni görünür.
//
//  Sicil binlerce dosyanın renderer içinde `if (yıl...)` dallarına dönüşmesini
//  engeller. Mantıksal varlık → paket → atlas → kontrollü fallback zinciri
//  veriyle çözülür. Bugünkü tek yerleşim atlası ilk fiziksel fallback'tir.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_VISUAL_CATALOG_SCHEMA_VERSION = 3;
const STORY_VISUAL_CATALOG_VERSION = 'story-visual-catalog-2010-2100-v3';

const STORY_VISUAL_PERIODS = Object.freeze([
    { id: 'MODERN_2010', from: 2010, to: 2029, artDirection: 'contemporary' },
    { id: 'CONNECTED_2030', from: 2030, to: 2049, artDirection: 'connected-transition' },
    { id: 'AUTOMATED_2050', from: 2050, to: 2074, artDirection: 'automation-heavy' },
    { id: 'ADAPTIVE_2075', from: 2075, to: 2089, artDirection: 'climate-adaptive' },
    { id: 'FRONTIER_2090', from: 2090, to: 2100, artDirection: 'frontier-modern' }
]);

const STORY_VISUAL_INSTALL_STAGES = Object.freeze([
    'BASELINE', 'CONNECTED', 'AUTOMATED', 'ADAPTIVE', 'FRONTIER'
]);

const STORY_VISUAL_CONDITIONS = Object.freeze([
    'OPERATING', 'CONSTRUCTION', 'DAMAGED', 'BURNED', 'ABANDONED'
]);

// Paketler bağımsız yüklenebilir. HXD-6 yalnız `urban-core` ve
// `urban-districts` paketlerini kullanır; sonraki fazlar diğerlerini aktive eder.
const STORY_VISUAL_ASSET_PACKS = Object.freeze([
    { id: 'terrain-base', load: 'MAP', families: ['terrain', 'forest', 'mountain', 'water'] },
    { id: 'urban-core', load: 'VISIBLE_ERA', families: ['core', 'residential', 'civic'] },
    { id: 'urban-industry', load: 'VISIBLE_ERA', families: ['industrial', 'energy', 'extraction'] },
    { id: 'urban-logistics', load: 'VISIBLE_ERA', families: ['logistics', 'port', 'warehouse'] },
    { id: 'land-use', load: 'VISIBLE_REGION', families: ['agriculture', 'forestry', 'mine', 'renewable'] },
    { id: 'infrastructure', load: 'VISIBLE_REGION', families: ['road', 'rail', 'utility'] },
    { id: 'mobile-agents', load: 'VISIBLE_REGION', families: ['truck', 'train', 'ship', 'aircraft', 'character'] },
    { id: 'conflict-state', load: 'ON_DEMAND', families: ['fortification', 'damage', 'fire', 'ruin'] }
]);

const STORY_VISUAL_URBAN_KIND = Object.freeze({
    CORE: { family: 'core', packId: 'urban-core', legacyAtlasRow: null },
    RESIDENTIAL: { family: 'residential', packId: 'urban-core', legacyAtlasRow: 0 },
    INDUSTRIAL: { family: 'industrial', packId: 'urban-industry', legacyAtlasRow: 2 },
    CIVIC: { family: 'civic', packId: 'urban-core', legacyAtlasRow: 1 },
    DEFENSE: { family: 'defense', packId: 'conflict-state', legacyAtlasRow: 1 },
    LOGISTICS: { family: 'logistics', packId: 'urban-logistics', legacyAtlasRow: 2 }
});

const STORY_VISUAL_CONSTRUCTION_FAMILIES = Object.freeze({
    RESIDENTIAL: { row: 0, family: 'residential' },
    INDUSTRIAL: { row: 1, family: 'industrial' },
    LOGISTICS: { row: 2, family: 'logistics' },
    CIVIC: { row: 3, family: 'civic' }
});

const STORY_VISUAL_CONSTRUCTION_PHASES = Object.freeze({
    FOUNDATION: { column: 0, minProgressBps: 0 },
    STRUCTURE: { column: 1, minProgressBps: 3300 },
    OPERATING: { column: 2, minProgressBps: 10000 },
    DAMAGED: { column: 3, minProgressBps: 0 }
});

const STORY_VISUAL_CLIMATE_ZONES = Object.freeze({
    TEMPERATE: { column: 0 },
    DRY: { column: 1 },
    BOREAL: { column: 2 },
    COASTAL: { column: 3 }
});

const STORY_VISUAL_A2_URBAN_FAMILIES = Object.freeze({
    CORE: { row: 0, family: 'core', packId: 'urban-core' },
    RESIDENTIAL: { row: 1, family: 'residential', packId: 'urban-core' },
    CIVIC: { row: 2, family: 'civic', packId: 'urban-core' },
    INDUSTRIAL: { row: 3, family: 'industrial', packId: 'urban-industry' }
});

const STORY_VISUAL_DAMAGE_STATES = Object.freeze({
    OPERATING: { column: 0 },
    DAMAGED: { column: 1 },
    BURNED: { column: 2 },
    ABANDONED: { column: 3 }
});

const STORY_VISUAL_SPECIAL_FAMILIES = Object.freeze({
    LOGISTICS: { row: 0, family: 'logistics', packId: 'urban-logistics' },
    ENERGY: { row: 1, family: 'energy', packId: 'urban-industry' },
    EXTRACTION: { row: 2, family: 'extraction', packId: 'urban-industry' },
    DEFENSE: { row: 3, family: 'defense', packId: 'conflict-state' }
});

const STORY_VISUAL_LAND_USE_FAMILIES = Object.freeze({
    AGRICULTURE: { row: 0, family: 'agriculture' },
    FORESTRY: { row: 1, family: 'forestry' },
    MINE: { row: 2, family: 'mine' },
    RENEWABLE: { row: 3, family: 'renewable' }
});

const STORY_VISUAL_LAND_USE_PHASES = Object.freeze({
    SETUP: { column: 0 },
    OPERATING: { column: 1 },
    DAMAGED: { column: 2 },
    RECLAIMED: { column: 3 }
});

// İlk manifest mevcut modern atlasın fiziksel olarak sunduğu altı aileyi ilan
// eder. Yeni resim/atlas eklemek renderer değişikliği değil, bu manifestin veri
// üretim adımı olacaktır. CORE satırı nüfus seviyesine göre tarifte tamamlanır.
const STORY_VISUAL_BASELINE_URBAN_ASSETS = Object.entries(STORY_VISUAL_URBAN_KIND)
    .map(([kind, definition]) => Object.freeze({
        id: `urban.${kind.toLowerCase()}.baseline.operating.modern_2010`,
        packId: definition.packId,
        family: definition.family,
        atlasKey: 'settlements',
        atlasRow: definition.legacyAtlasRow,
        periodId: 'MODERN_2010',
        visualStage: 0,
        condition: 'OPERATING'
    }));

const STORY_VISUAL_CONSTRUCTION_ASSETS = Object.entries(STORY_VISUAL_CONSTRUCTION_FAMILIES)
    .flatMap(([projectType, family]) => Object.entries(STORY_VISUAL_CONSTRUCTION_PHASES)
        .map(([phase, phaseDefinition]) => Object.freeze({
            id: `construction.${family.family}.${phase.toLowerCase()}.modern_2010`,
            packId: STORY_VISUAL_URBAN_KIND[projectType]
                ? STORY_VISUAL_URBAN_KIND[projectType].packId : 'urban-core',
            family: family.family,
            atlasKey: 'constructionModern',
            atlasCell: family.row * 4 + phaseDefinition.column,
            atlasRow: family.row,
            atlasColumn: phaseDefinition.column,
            periodId: 'MODERN_2010',
            visualStage: 0,
            condition: phase === 'FOUNDATION' || phase === 'STRUCTURE'
                ? 'CONSTRUCTION' : phase
        })));

function storyVisualGridAssets(domain, atlasKey, rows, columns, columnField) {
    return Object.entries(rows).flatMap(([rowId, row]) => Object.entries(columns)
        .map(([columnId, column]) => Object.freeze({
            id: `${domain}.${row.family}.${columnId.toLowerCase()}.modern_2010`,
            packId: row.packId || 'land-use',
            family: row.family,
            [columnField]: columnId,
            atlasKey,
            atlasCell: row.row * 4 + column.column,
            atlasRow: row.row,
            atlasColumn: column.column,
            periodId: 'MODERN_2010',
            visualStage: 0,
            condition: columnField === 'condition' ? columnId : 'OPERATING',
            sourceRowId: rowId
        })));
}

const STORY_VISUAL_URBAN_CLIMATE_ASSETS = storyVisualGridAssets(
    'urban-climate', 'urbanClimateModern', STORY_VISUAL_A2_URBAN_FAMILIES,
    STORY_VISUAL_CLIMATE_ZONES, 'climateZone'
);
const STORY_VISUAL_URBAN_DAMAGE_ASSETS = storyVisualGridAssets(
    'urban-damage', 'urbanDamageModern', STORY_VISUAL_A2_URBAN_FAMILIES,
    STORY_VISUAL_DAMAGE_STATES, 'condition'
);
const STORY_VISUAL_SPECIAL_ASSETS = storyVisualGridAssets(
    'special', 'specialFacilitiesModern', STORY_VISUAL_SPECIAL_FAMILIES,
    STORY_VISUAL_CLIMATE_ZONES, 'climateZone'
);
const STORY_VISUAL_LAND_USE_ASSETS = storyVisualGridAssets(
    'land-use', 'landUseModern', STORY_VISUAL_LAND_USE_FAMILIES,
    STORY_VISUAL_LAND_USE_PHASES, 'lifecyclePhase'
);

const STORY_VISUAL_ASSET_MANIFEST = Object.freeze([
    ...STORY_VISUAL_BASELINE_URBAN_ASSETS,
    ...STORY_VISUAL_CONSTRUCTION_ASSETS,
    ...STORY_VISUAL_URBAN_CLIMATE_ASSETS,
    ...STORY_VISUAL_URBAN_DAMAGE_ASSETS,
    ...STORY_VISUAL_SPECIAL_ASSETS,
    ...STORY_VISUAL_LAND_USE_ASSETS
]);

function storyVisualClampInt(value, min, max) {
    return Math.max(min, Math.min(max, Math.floor(Number(value) || 0)));
}

function storyVisualPeriodForYear(year) {
    const target = storyVisualClampInt(year == null ? 2010 : year, 2010, 2100);
    return STORY_VISUAL_PERIODS.find(period => target >= period.from && target <= period.to)
        || STORY_VISUAL_PERIODS[0];
}

function storyVisualNormalizeCondition(value) {
    const condition = String(value || 'OPERATING').toUpperCase();
    return STORY_VISUAL_CONDITIONS.includes(condition) ? condition : 'OPERATING';
}

function storyVisualExplicitInstalledStage(source) {
    if (!source || typeof source !== 'object') return 0;
    const candidates = [
        source.visualInstalledStage,
        source.installedVisualStage,
        source.installedTechStage,
        source.visualStage
    ];
    for (const value of candidates) {
        if (Number.isFinite(Number(value))) return storyVisualClampInt(value, 0, 4);
        const name = String(value || '').toUpperCase();
        const index = STORY_VISUAL_INSTALL_STAGES.indexOf(name);
        if (index >= 0) return index;
    }
    return 0;
}

// Eski teknoloji kayıtları görsel kademe taşımıyor ve bu nedenle şehri geleceğe
// sıçratamaz. Yeni teknoloji kayıtları `visualStage` eklediğinde yalnız tavanı
// yükseltir; gerçek görünüm için ayrıca kurulu varlık gerekir.
function storyVisualResearchCeiling(state, techById) {
    const lookup = techById || (typeof TECH_BY_ID !== 'undefined' ? TECH_BY_ID : {});
    let ceiling = 0;
    for (const id of (state && Array.isArray(state.tech) ? state.tech : [])) {
        const tech = lookup && lookup[id];
        ceiling = Math.max(ceiling, storyVisualExplicitInstalledStage(tech));
    }
    return storyVisualClampInt(ceiling, 0, 4);
}

function storyVisualFacilityForDistrict(node, kind, companyEconomy) {
    const ledger = companyEconomy || (typeof STORY !== 'undefined' && STORY.companyEconomy);
    if (!node || !ledger || !ledger.facilities) return null;
    const regionId = `region:${Number(node.id)}`;
    const preferred = {
        INDUSTRIAL: ['civil_industry', 'advanced_tech', 'defense_industry'],
        LOGISTICS: ['logistics'],
        DEFENSE: ['defense_industry'],
        CIVIC: ['services'],
        RESIDENTIAL: ['construction']
    }[kind] || [];
    if (!preferred.length) return null;
    const facilities = Object.values(ledger.facilities).filter(facility =>
        facility && facility.regionId === regionId && facility.status === 'OPERATING'
        && preferred.includes(facility.sectorId));
    return facilities.sort((a, b) => {
        const ai = preferred.indexOf(a.sectorId), bi = preferred.indexOf(b.sectorId);
        const ar = ai < 0 ? 999 : ai, br = bi < 0 ? 999 : bi;
        return ar - br || String(a.id).localeCompare(String(b.id), 'en');
    })[0] || null;
}

function storyVisualLegacyUrbanRow(kind, visualLevel, industrial) {
    if (kind !== 'CORE') {
        const entry = STORY_VISUAL_URBAN_KIND[kind] || STORY_VISUAL_URBAN_KIND.RESIDENTIAL;
        return entry.legacyAtlasRow;
    }
    const level = storyVisualClampInt(visualLevel || 1, 1, 3);
    return industrial && level < 3 ? 2 : level >= 3 ? 3 : level - 1;
}

function storyVisualAssetFallbackIds(recipe) {
    const kind = String(recipe && recipe.kind || 'CORE').toLowerCase();
    const stage = String(recipe && recipe.visualStageName || 'BASELINE').toLowerCase();
    const condition = String(recipe && recipe.condition || 'OPERATING').toLowerCase();
    const period = String(recipe && recipe.periodId || 'MODERN_2010').toLowerCase();
    const ids = [
        `urban.${kind}.${stage}.${condition}.${period}`,
        `urban.${kind}.${stage}.operating.${period}`,
        `urban.${kind}.${stage}.operating.modern_2010`,
        `urban.${kind}.baseline.operating.modern_2010`
    ];
    return ids.filter((id, index) => ids.indexOf(id) === index);
}

function storyVisualResolveAsset(recipe, manifest) {
    const entries = Array.isArray(manifest) ? manifest : STORY_VISUAL_ASSET_MANIFEST;
    const byId = new Map(entries.map(entry => [entry.id, entry]));
    const candidates = storyVisualAssetFallbackIds(recipe);
    for (let depth = 0; depth < candidates.length; depth++) {
        const entry = byId.get(candidates[depth]);
        if (entry) return {
            ok: true,
            entry,
            requestedId: candidates[0],
            resolvedId: entry.id,
            fallbackDepth: depth,
            fallbackReason: depth ? 'REQUESTED_ASSET_MISSING' : null
        };
    }
    return {
        ok: false,
        entry: null,
        requestedId: candidates[0],
        resolvedId: null,
        fallbackDepth: candidates.length,
        fallbackReason: 'NO_REGISTERED_ASSET_FALLBACK'
    };
}

function storyVisualConstructionProgressBps(command, physicalSite) {
    if (command && command.status === 'COMPLETED') return 10000;
    const duration = Math.max(0, Number(command && command.requirements
        && command.requirements.durationDays) || 0);
    const remaining = Math.max(0, Number(command && command.remainingDays) || 0);
    if (duration) {
        return storyVisualClampInt(Math.round((1 - remaining / duration) * 10000), 0, 10000);
    }
    const explicit = Number(physicalSite && physicalSite.constructionProgressBps);
    if (Number.isFinite(explicit)) return storyVisualClampInt(explicit, 0, 10000);
    return 0;
}

function storyVisualConstructionPhase(command, physicalSite) {
    const condition = storyVisualNormalizeCondition(physicalSite && physicalSite.lifecycleState);
    if (condition === 'DAMAGED' || condition === 'BURNED') return 'DAMAGED';
    if (command && command.status === 'COMPLETED' || condition === 'OPERATING') return 'OPERATING';
    return storyVisualConstructionProgressBps(command, physicalSite) >= 3300
        ? 'STRUCTURE' : 'FOUNDATION';
}

function storyVisualConstructionRecipe(input) {
    const spec = input || {};
    const command = spec.command || null;
    const physicalSite = spec.physicalSite || null;
    const projectType = String(spec.projectType || command && command.projectType
        || physicalSite && physicalSite.siteType || 'RESIDENTIAL').toUpperCase();
    const definition = STORY_VISUAL_CONSTRUCTION_FAMILIES[projectType]
        || STORY_VISUAL_CONSTRUCTION_FAMILIES.RESIDENTIAL;
    const phase = storyVisualConstructionPhase(command, physicalSite);
    const period = storyVisualPeriodForYear(spec.year == null
        ? (typeof STORY !== 'undefined' && STORY.year) || 2010 : spec.year);
    const requestedId = `construction.${definition.family}.${phase.toLowerCase()}.${period.id.toLowerCase()}`;
    const fallbackIds = [
        requestedId,
        `construction.${definition.family}.${phase.toLowerCase()}.modern_2010`
    ].filter((id, index, rows) => rows.indexOf(id) === index);
    const entries = Array.isArray(spec.assetManifest)
        ? spec.assetManifest : STORY_VISUAL_ASSET_MANIFEST;
    const byId = new Map(entries.map(entry => [entry.id, entry]));
    let entry = null, fallbackDepth = fallbackIds.length;
    for (let index = 0; index < fallbackIds.length; index++) {
        if (!byId.has(fallbackIds[index])) continue;
        entry = byId.get(fallbackIds[index]);
        fallbackDepth = index;
        break;
    }
    return {
        schemaVersion: STORY_VISUAL_CATALOG_SCHEMA_VERSION,
        catalogVersion: STORY_VISUAL_CATALOG_VERSION,
        projectType,
        family: definition.family,
        phase,
        progressBps: storyVisualConstructionProgressBps(command, physicalSite),
        periodId: period.id,
        requestedAssetId: requestedId,
        resolvedAssetId: entry && entry.id || null,
        atlasKey: entry && entry.atlasKey || 'constructionModern',
        atlasCell: entry && Number(entry.atlasCell),
        fallbackDepth,
        fallbackReason: entry ? (fallbackDepth ? 'PERIOD_ASSET_MISSING' : null)
            : 'NO_REGISTERED_CONSTRUCTION_ASSET',
        assetMissing: !entry
    };
}

function storyVisualClimateZone(input) {
    const spec = input || {};
    const explicit = String(spec.climateZone || '').toUpperCase();
    if (STORY_VISUAL_CLIMATE_ZONES[explicit]) return explicit;
    const node = spec.node || null;
    if (node && (node.port || node.isPort || node.coastal)) return 'COASTAL';
    const latitudeY = Number(node && (node.ly ?? node.normalizedY));
    if (Number.isFinite(latitudeY)) {
        if (latitudeY <= .31) return 'BOREAL';
        if (latitudeY >= .67) return 'DRY';
    }
    return 'TEMPERATE';
}

function storyVisualResolveVariant(domain, family, variant, period, manifest) {
    const periodId = String(period && period.id || period || 'MODERN_2010').toLowerCase();
    const stem = `${domain}.${String(family).toLowerCase()}.${String(variant).toLowerCase()}`;
    const candidates = [`${stem}.${periodId}`, `${stem}.modern_2010`]
        .filter((id, index, rows) => rows.indexOf(id) === index);
    const entries = Array.isArray(manifest) ? manifest : STORY_VISUAL_ASSET_MANIFEST;
    const byId = new Map(entries.map(entry => [entry.id, entry]));
    for (let index = 0; index < candidates.length; index++) {
        const entry = byId.get(candidates[index]);
        if (!entry) continue;
        return {
            assetMissing: false,
            requestedAssetId: candidates[0],
            resolvedAssetId: entry.id,
            atlasKey: entry.atlasKey,
            atlasCell: Number(entry.atlasCell),
            fallbackDepth: index,
            fallbackReason: index ? 'PERIOD_ASSET_MISSING' : null
        };
    }
    return {
        assetMissing: true,
        requestedAssetId: candidates[0],
        resolvedAssetId: null,
        atlasKey: null,
        atlasCell: null,
        fallbackDepth: candidates.length,
        fallbackReason: 'NO_REGISTERED_VARIANT_ASSET'
    };
}

function storyVisualSpecialFamily(input) {
    const spec = input || {};
    const kind = String(spec.kind || '').toUpperCase();
    if (kind === 'LOGISTICS' || kind === 'DEFENSE') return kind;
    const site = spec.physicalSite || {};
    const siteType = String(site.siteType || '').toUpperCase();
    const sector = String(site.sectorId || '').toLowerCase();
    if (siteType === 'LOGISTICS') return 'LOGISTICS';
    if (siteType === 'DEFENSE' || sector.includes('defense')) return 'DEFENSE';
    if (siteType === 'ENERGY' || sector.includes('energy')) return 'ENERGY';
    if (['EXTRACTION', 'MINE', 'MINERAL'].includes(siteType)
        || sector.includes('extract') || sector.includes('mining')) return 'EXTRACTION';
    return null;
}

function storyVisualUrbanPresentationRecipe(input) {
    const spec = input || {};
    const mechanics = storyVisualUrbanRecipe(spec);
    const period = storyVisualPeriodForYear(spec.year == null
        ? (typeof STORY !== 'undefined' && STORY.year) || 2010 : spec.year);
    const climateZone = storyVisualClimateZone(spec);
    const condition = storyVisualNormalizeCondition(spec.condition
        || spec.physicalSite && spec.physicalSite.lifecycleState || mechanics.condition);
    const specialFamily = storyVisualSpecialFamily(spec);
    let art;
    if (specialFamily) {
        const row = STORY_VISUAL_SPECIAL_FAMILIES[specialFamily];
        art = storyVisualResolveVariant('special', row.family, climateZone, period,
            spec.assetManifest);
    } else {
        const family = STORY_VISUAL_A2_URBAN_FAMILIES[mechanics.kind]
            || STORY_VISUAL_A2_URBAN_FAMILIES.CORE;
        if (['DAMAGED', 'BURNED', 'ABANDONED'].includes(condition)) {
            art = storyVisualResolveVariant('urban-damage', family.family, condition,
                period, spec.assetManifest);
        } else {
            art = storyVisualResolveVariant('urban-climate', family.family, climateZone,
                period, spec.assetManifest);
        }
    }
    return Object.assign({}, mechanics, art, {
        climateZone,
        condition,
        presentationSource: specialFamily ? `SPECIAL_${specialFamily}`
            : condition === 'OPERATING' || condition === 'CONSTRUCTION'
                ? 'URBAN_CLIMATE' : 'URBAN_DAMAGE'
    });
}

function storyVisualLandUseRecipe(input) {
    const spec = input || {};
    const type = String(spec.landUseType || spec.family || 'AGRICULTURE').toUpperCase();
    const family = STORY_VISUAL_LAND_USE_FAMILIES[type]
        || STORY_VISUAL_LAND_USE_FAMILIES.AGRICULTURE;
    const lifecycle = String(spec.lifecyclePhase || spec.lifecycleState || 'OPERATING').toUpperCase();
    const phase = STORY_VISUAL_LAND_USE_PHASES[lifecycle] ? lifecycle
        : lifecycle === 'CONSTRUCTION' ? 'SETUP'
            : ['DAMAGED', 'BURNED'].includes(lifecycle) ? 'DAMAGED'
                : lifecycle === 'ABANDONED' ? 'RECLAIMED' : 'OPERATING';
    const period = storyVisualPeriodForYear(spec.year == null
        ? (typeof STORY !== 'undefined' && STORY.year) || 2010 : spec.year);
    return Object.assign({ family: family.family, lifecyclePhase: phase, periodId: period.id },
        storyVisualResolveVariant('land-use', family.family, phase, period,
            spec.assetManifest));
}

function storyVisualUrbanRecipe(input) {
    const spec = input || {};
    const kind = String(spec.kind || 'CORE').toUpperCase();
    const kindDef = STORY_VISUAL_URBAN_KIND[kind] || STORY_VISUAL_URBAN_KIND.CORE;
    const node = spec.node || null;
    const state = spec.state || (typeof STORY !== 'undefined' && STORY.states && node
        ? STORY.states[Number(node.owner)] : null);
    const physicalSite = spec.physicalSite || null;
    const facility = spec.facility || (!spec.physicalSites
        ? storyVisualFacilityForDistrict(node, kind, spec.companyEconomy) : null);
    const researchCeiling = storyVisualResearchCeiling(state, spec.techById);
    const installedStage = Math.max(
        storyVisualExplicitInstalledStage(node),
        storyVisualExplicitInstalledStage(spec.urbanFootprint),
        storyVisualExplicitInstalledStage(physicalSite),
        storyVisualExplicitInstalledStage(facility)
    );
    const visualStage = state ? Math.min(installedStage, researchCeiling) : installedStage;
    const period = storyVisualPeriodForYear(spec.year == null
        ? (typeof STORY !== 'undefined' && STORY.year) || 2010 : spec.year);
    const condition = storyVisualNormalizeCondition(spec.condition
        || (physicalSite && physicalSite.lifecycleState)
        || (facility && facility.status) || 'OPERATING');
    const atlasRow = storyVisualLegacyUrbanRow(
        kind, spec.visualLevel, !!spec.industrial
    );
    const logicalAssetId = [
        'urban', kind.toLowerCase(), STORY_VISUAL_INSTALL_STAGES[visualStage].toLowerCase(),
        condition.toLowerCase(), period.id.toLowerCase()
    ].join('.');
    const baseRecipe = {
        schemaVersion: STORY_VISUAL_CATALOG_SCHEMA_VERSION,
        catalogVersion: STORY_VISUAL_CATALOG_VERSION,
        kind,
        logicalAssetId,
        packId: kindDef.packId,
        family: kindDef.family,
        periodId: period.id,
        installedStage,
        researchCeiling,
        visualStage,
        visualStageName: STORY_VISUAL_INSTALL_STAGES[visualStage],
        condition,
        sourcePhysicalSiteId: physicalSite && physicalSite.id || null,
        sourceFacilityId: physicalSite && physicalSite.sourceFacilityId
            || facility && facility.id || null
    };
    const resolved = storyVisualResolveAsset(baseRecipe, spec.assetManifest);
    return Object.assign(baseRecipe, {
        resolvedAssetId: resolved.resolvedId,
        atlasKey: resolved.entry && resolved.entry.atlasKey || 'settlements',
        atlasRow: resolved.entry && resolved.entry.atlasRow != null
            ? resolved.entry.atlasRow : atlasRow,
        fallbackDepth: resolved.fallbackDepth,
        fallbackReason: resolved.fallbackReason,
        assetMissing: !resolved.ok
    });
}

function storyVisualCatalogValidate() {
    const issues = [];
    let expectedYear = 2010;
    const periodIds = new Set();
    for (const period of STORY_VISUAL_PERIODS) {
        if (periodIds.has(period.id)) issues.push(`DUPLICATE_PERIOD:${period.id}`);
        periodIds.add(period.id);
        if (period.from !== expectedYear || period.to < period.from) {
            issues.push(`PERIOD_GAP_OR_OVERLAP:${period.id}`);
        }
        expectedYear = period.to + 1;
    }
    if (expectedYear !== 2101) issues.push('PERIOD_RANGE_MUST_END_AT_2100');
    const packIds = new Set();
    for (const pack of STORY_VISUAL_ASSET_PACKS) {
        if (!pack.id || packIds.has(pack.id)) issues.push(`DUPLICATE_PACK:${pack.id || '?'}`);
        packIds.add(pack.id);
        if (!Array.isArray(pack.families) || !pack.families.length) issues.push(`EMPTY_PACK:${pack.id}`);
    }
    for (const [kind, definition] of Object.entries(STORY_VISUAL_URBAN_KIND)) {
        if (!packIds.has(definition.packId)) issues.push(`UNKNOWN_PACK:${kind}:${definition.packId}`);
        if (definition.legacyAtlasRow != null
            && (definition.legacyAtlasRow < 0 || definition.legacyAtlasRow > 3)) {
            issues.push(`INVALID_LEGACY_ROW:${kind}`);
        }
    }
    const assetIds = new Set();
    for (const entry of STORY_VISUAL_ASSET_MANIFEST) {
        if (!entry.id || assetIds.has(entry.id)) issues.push(`DUPLICATE_ASSET:${entry.id || '?'}`);
        assetIds.add(entry.id);
        if (!packIds.has(entry.packId)) issues.push(`ASSET_UNKNOWN_PACK:${entry.id}:${entry.packId}`);
        if (!['settlements', 'constructionModern', 'urbanClimateModern',
            'urbanDamageModern', 'specialFacilitiesModern', 'landUseModern'].includes(entry.atlasKey)) {
            issues.push(`ASSET_UNKNOWN_ATLAS:${entry.id}`);
        }
        if (entry.atlasKey !== 'settlements'
            && (!Number.isInteger(entry.atlasCell) || entry.atlasCell < 0 || entry.atlasCell > 15)) {
            issues.push(`ASSET_INVALID_CELL:${entry.id}`);
        }
    }
    return { ok: issues.length === 0, issues };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STORY_VISUAL_CATALOG_SCHEMA_VERSION,
        STORY_VISUAL_CATALOG_VERSION,
        STORY_VISUAL_PERIODS,
        STORY_VISUAL_INSTALL_STAGES,
        STORY_VISUAL_CONDITIONS,
        STORY_VISUAL_ASSET_PACKS,
        STORY_VISUAL_URBAN_KIND,
        STORY_VISUAL_CONSTRUCTION_FAMILIES,
        STORY_VISUAL_CONSTRUCTION_PHASES,
        STORY_VISUAL_CLIMATE_ZONES,
        STORY_VISUAL_A2_URBAN_FAMILIES,
        STORY_VISUAL_DAMAGE_STATES,
        STORY_VISUAL_SPECIAL_FAMILIES,
        STORY_VISUAL_LAND_USE_FAMILIES,
        STORY_VISUAL_LAND_USE_PHASES,
        STORY_VISUAL_ASSET_MANIFEST,
        storyVisualPeriodForYear,
        storyVisualNormalizeCondition,
        storyVisualExplicitInstalledStage,
        storyVisualResearchCeiling,
        storyVisualFacilityForDistrict,
        storyVisualLegacyUrbanRow,
        storyVisualAssetFallbackIds,
        storyVisualResolveAsset,
        storyVisualConstructionProgressBps,
        storyVisualConstructionPhase,
        storyVisualConstructionRecipe,
        storyVisualClimateZone,
        storyVisualResolveVariant,
        storyVisualSpecialFamily,
        storyVisualUrbanPresentationRecipe,
        storyVisualLandUseRecipe,
        storyVisualUrbanRecipe,
        storyVisualCatalogValidate
    };
}
