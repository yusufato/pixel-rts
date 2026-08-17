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

const STORY_VISUAL_CATALOG_SCHEMA_VERSION = 1;
const STORY_VISUAL_CATALOG_VERSION = 'story-visual-catalog-2010-2100-v1';

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
    { id: 'land-use', load: 'VISIBLE_REGION', families: ['agriculture', 'forestry', 'mine'] },
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

// İlk manifest mevcut modern atlasın fiziksel olarak sunduğu altı aileyi ilan
// eder. Yeni resim/atlas eklemek renderer değişikliği değil, bu manifestin veri
// üretim adımı olacaktır. CORE satırı nüfus seviyesine göre tarifte tamamlanır.
const STORY_VISUAL_ASSET_MANIFEST = Object.freeze(Object.entries(STORY_VISUAL_URBAN_KIND)
    .map(([kind, definition]) => Object.freeze({
        id: `urban.${kind.toLowerCase()}.baseline.operating.modern_2010`,
        packId: definition.packId,
        family: definition.family,
        atlasKey: 'settlements',
        atlasRow: definition.legacyAtlasRow,
        periodId: 'MODERN_2010',
        visualStage: 0,
        condition: 'OPERATING'
    })));

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
        if (entry.atlasKey !== 'settlements') issues.push(`ASSET_UNKNOWN_ATLAS:${entry.id}`);
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
        STORY_VISUAL_ASSET_MANIFEST,
        storyVisualPeriodForYear,
        storyVisualNormalizeCondition,
        storyVisualExplicitInstalledStage,
        storyVisualResearchCeiling,
        storyVisualFacilityForDistrict,
        storyVisualLegacyUrbanRow,
        storyVisualAssetFallbackIds,
        storyVisualResolveAsset,
        storyVisualUrbanRecipe,
        storyVisualCatalogValidate
    };
}
