// ═══════════════════════════════════════════════════════════════════════════
//  HİKÂYE ÖZELLİK BAYRAKLARI — Faz 3
//  ---------------------------------------------------------------------------
//  Yeni katmanlar önce burada isim alır. Bilinmeyen bayrak sessizce kabul
//  edilmez; yazım hatası A/B koşusunu sahte biçimde "aynı" gösteremez.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_FEATURE_DEFAULTS = Object.freeze({
    'telemetry.world': true,
    'telemetry.resources': true,
    'telemetry.performance': true,
    'welfare.continuousCap': true,
    'world.v2Projection': true,
    'knowledge.playerProjection': true,
    'time.fixedStep': true,
    'rng.streams': true,
    'scheduler.registry': true,
    'causality.ledger': true,
    'causality.guards': true,
    'projection.causalityUi': true,
    'world.regionModel': true,
    'world.regionActivation': true,
    'world.regionAggregation': true,
    'world.infrastructureGraph': true,
    'economy.resourceTaxonomy': true,
    'economy.productionSectors': true,
    'economy.regionalStocks': true,
    'economy.tradeLogistics': true,
    'economy.marketPrices': true,
    'economy.stateBudget': true,
    'economy.companiesBanks': true,
    'economy.economicAI': true,
    'economy.bootstrapPlanning': true,
    'economy.saleSettlement': false,
    'population.cohorts': true,
    'population.needsWelfare': true,
    'diplomacy.peacefulStart': true,
    'world.canonicalMapRaster': true,
    'world.prebuiltMapRaster': true,
    'render.imageDataPoliticalOverlay': true,
    'render.adaptiveMapWarp': true,
    'render.mapCacheInvalidation': true,
    'ui.cityDossier': true
});

// A compound phase may only run when its physical ledgers are available.
// Keeping the requested flag true is useful in saved configuration, but the
// effective value must become false when a prerequisite is disabled for an
// A/B run or a legacy fallback. Otherwise Phase 22.1 can mutate population or
// finance while the stock system that supplies its evidence is absent.
const STORY_FEATURE_DEPENDENCIES = Object.freeze({
    'economy.bootstrapPlanning': Object.freeze([
        'economy.resourceTaxonomy',
        'economy.productionSectors',
        'economy.regionalStocks',
        'economy.tradeLogistics',
        'economy.marketPrices',
        'economy.stateBudget',
        'economy.companiesBanks',
        'economy.economicAI',
        'population.cohorts',
        'population.needsWelfare'
    ]),
    'economy.saleSettlement': Object.freeze([
        'economy.resourceTaxonomy',
        'economy.productionSectors',
        'economy.regionalStocks',
        'economy.marketPrices',
        'economy.companiesBanks'
    ])
});

function storyFeatureNormalize(overrides) {
    const normalized = Object.assign({}, STORY_FEATURE_DEFAULTS);
    if (!overrides) return normalized;
    for (const key of Object.keys(overrides)) {
        if (!Object.prototype.hasOwnProperty.call(STORY_FEATURE_DEFAULTS, key)) {
            throw new Error(`Bilinmeyen hikâye özellik bayrağı: ${key}`);
        }
        normalized[key] = !!overrides[key];
    }
    return normalized;
}

function storyFeatureConfigure(overrides) {
    const normalized = storyFeatureNormalize(overrides);
    STORY.featureFlags = normalized;
    if (STORY.cfg) STORY.cfg.featureFlags = Object.assign({}, normalized);
    return normalized;
}

function storyFeatureEnabled(name, resolving) {
    if (!Object.prototype.hasOwnProperty.call(STORY_FEATURE_DEFAULTS, name)) return false;
    const flags = STORY.featureFlags;
    const requested = flags && Object.prototype.hasOwnProperty.call(flags, name)
        ? !!flags[name]
        : !!STORY_FEATURE_DEFAULTS[name];
    if (!requested) return false;

    const dependencies = STORY_FEATURE_DEPENDENCIES[name];
    if (!dependencies || !dependencies.length) return true;
    const active = resolving || new Set();
    if (active.has(name)) return false;
    active.add(name);
    const enabled = dependencies.every(dependency => storyFeatureEnabled(dependency, active));
    active.delete(name);
    return enabled;
}

function storyFeatureSnapshot() {
    return Object.assign({}, STORY.featureFlags || STORY_FEATURE_DEFAULTS);
}
