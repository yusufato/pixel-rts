// ============================================================================
//  HİKÂYE HARİTA CACHE SÖZLEŞMESİ — Faz 14.6
//  --------------------------------------------------------------------------
//  Harita cache'leri kalıcı dünya gerçeği değildir. Geometri, sahiplik, palet,
//  çağ veya viewport değiştiğinde yalnız etkilenen türetilmiş katmanlar burada
//  geçersiz kılınır. Çağıran sistemlerin cache alanlarını tek tek bilmesi gerekmez.
// ============================================================================

const STORY_MAP_CACHE_SCHEMA_VERSION = 1;
const STORY_MAP_CACHE_ADAPTER_VERSION = 'story-map-cache-invalidation-1';

const STORY_MAP_ERA_PALETTES = Object.freeze({
    chaos: Object.freeze({ id: 'chaos', rgb: [1.07, 0.94, 0.91], lift: [4, -2, -3] }),
    fire: Object.freeze({ id: 'fire', rgb: [1.06, 0.99, 0.91], lift: [3, 0, -3] }),
    cold: Object.freeze({ id: 'cold', rgb: [0.93, 1.00, 1.08], lift: [-2, 0, 4] }),
    peace: Object.freeze({ id: 'peace', rgb: [0.95, 1.04, 0.97], lift: [-2, 3, 0] }),
    golden: Object.freeze({ id: 'golden', rgb: [1.08, 1.04, 0.91], lift: [4, 2, -3] }),
    gray: Object.freeze({ id: 'gray', rgb: [0.96, 0.97, 0.98], lift: [0, 0, 1] }),
    neutral: Object.freeze({ id: 'neutral', rgb: [1, 1, 1], lift: [0, 0, 0] })
});

function storyMapCacheEnabled() {
    return typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('render.mapCacheInvalidation');
}

function storyMapPaletteDescriptor() {
    if (!storyMapCacheEnabled()) return STORY_MAP_ERA_PALETTES.neutral;
    const eraId = STORY && STORY._era && STORY._era.id
        ? String(STORY._era.id)
        : 'gray';
    return STORY_MAP_ERA_PALETTES[eraId] || STORY_MAP_ERA_PALETTES.gray;
}

function storyMapPaletteKey() {
    const palette = storyMapPaletteDescriptor();
    const statePalette = (STORY.states || [])
        .map(state => `${Number(state.id)}:${String(state.color || '#888888').toLowerCase()}`)
        .join(',');
    const raw = [
        STORY_MAP_CACHE_ADAPTER_VERSION,
        palette.id,
        palette.rgb.join(','),
        palette.lift.join(','),
        statePalette
    ].join('|');
    return typeof storyMapRasterHashText === 'function'
        ? storyMapRasterHashText(raw)
        : raw;
}

function storyMapCacheReleaseWorldLayer(layer) {
    if (!layer) return;
    if (typeof storyReleaseWorldRamLayer === 'function') {
        storyReleaseWorldRamLayer(layer);
        return;
    }
    for (const tile of (layer.tiles || [])) {
        if (tile && tile.bitmap && typeof tile.bitmap.close === 'function') {
            try { tile.bitmap.close(); } catch (_error) { /* best effort */ }
        }
    }
}

function storyMapCacheReleaseWorldLayers(group) {
    if (!group) return;
    const layers = group.layers || group.worldLayers || null;
    if (layers) Object.values(layers).forEach(storyMapCacheReleaseWorldLayer);
    if (group.layer) storyMapCacheReleaseWorldLayer(group.layer);
}

function storyMapCacheClearOwner() {
    STORY._ownerKey = null;
    STORY._ownerOverlayData = null;
    STORY._ownerOverlaySource = null;
    STORY._hexOwnerKey = null;
    STORY._hexOwnerOverlaySource = null;
    STORY._networkLayerKey = null;
    STORY._settlementLayerKey = null;
    STORY._commanderLayerKey = null;
    storyMapCacheReleaseWorldLayers(STORY._politicalBorderWorldLayer);
    STORY._politicalBorderWorldLayer = null;
    if (STORY._politicalBorderLayerCache) STORY._politicalBorderLayerCache.key = null;
    if (STORY._hexGridLayerCache) STORY._hexGridLayerCache.key = null;
    // _ownerCache canvas belleği kasıtlı olarak korunur ve rebuild'de yeniden kullanılır.
}

function storyMapCacheClearTerrain(clearStaticCanvas) {
    storyMapCacheReleaseWorldLayers(STORY._settlementWorldLayers);
    storyMapCacheReleaseWorldLayers(STORY._networkWorldLayers);
    storyMapCacheReleaseWorldLayers(STORY._politicalBorderWorldLayer);
    if (clearStaticCanvas) {
        storyMapCacheReleaseWorldLayers(STORY._mapV2CoastlineCache);
        STORY._mapV2CoastlineCache = null;
        STORY._terrainCache = null;
        STORY._geoTerrain = null;
        STORY._geoTerrainSource = null;
    }
    STORY._networkLayerKey = null;
    STORY._settlementLayerKey = null;
    STORY._settlementWorldLayers = null;
    STORY._networkWorldLayers = null;
    STORY._politicalBorderWorldLayer = null;
    STORY._commanderLayerKey = null;
    if (STORY._politicalBorderLayerCache) STORY._politicalBorderLayerCache.key = null;
    if (STORY._hexGridLayerCache) STORY._hexGridLayerCache.key = null;
}

function storyMapCacheClearWarp() {
    STORY._warpPlanCache = null;
}

function storyInvalidateMapCaches(scope, reason, details) {
    const normalizedScope = String(scope || '').toLowerCase();
    const allowed = ['ownership', 'era', 'palette', 'derived', 'geometry', 'viewport'];
    if (!allowed.includes(normalizedScope)) {
        return {
            ok: false,
            code: 'MAP_CACHE_SCOPE_UNKNOWN',
            scope: normalizedScope,
            allowed: allowed.slice()
        };
    }
    if (!storyMapCacheEnabled()) {
        return {
            ok: false,
            code: 'MAP_CACHE_INVALIDATION_DISABLED',
            scope: normalizedScope,
            disabled: true
        };
    }

    if (normalizedScope === 'ownership') {
        storyMapCacheClearOwner();
    } else if (normalizedScope === 'era') {
        storyMapCacheClearTerrain();
    } else if (normalizedScope === 'palette') {
        storyMapCacheClearTerrain();
        storyMapCacheClearOwner();
    } else if (normalizedScope === 'derived') {
        storyMapCacheClearTerrain();
        storyMapCacheClearOwner();
        storyMapCacheClearWarp();
    } else if (normalizedScope === 'geometry') {
        STORY.canonicalMapRaster = null;
        STORY._landGrid = null;
        STORY._landGridSource = null;
        storyMapCacheClearTerrain(true);
        storyMapCacheClearOwner();
        storyMapCacheClearWarp();
    } else if (normalizedScope === 'viewport') {
        storyMapCacheClearWarp();
    }

    const previous = STORY._mapCacheInvalidation || {};
    const event = {
        schemaVersion: STORY_MAP_CACHE_SCHEMA_VERSION,
        adapterVersion: STORY_MAP_CACHE_ADAPTER_VERSION,
        revision: (Number(previous.revision) || 0) + 1,
        at: Number(STORY.clock) || 0,
        scope: normalizedScope,
        reason: String(reason || 'manual'),
        details: details && typeof details === 'object'
            ? Object.assign({}, details)
            : null
    };
    STORY._mapCacheInvalidation = event;
    STORY._mapCacheRevisions = Object.assign({}, STORY._mapCacheRevisions || {});
    STORY._mapCacheRevisions[normalizedScope] =
        (Number(STORY._mapCacheRevisions[normalizedScope]) || 0) + 1;
    return Object.assign({ ok: true }, event);
}

function storyMapCacheDiagnostics() {
    return {
        schemaVersion: STORY_MAP_CACHE_SCHEMA_VERSION,
        adapterVersion: STORY_MAP_CACHE_ADAPTER_VERSION,
        enabled: storyMapCacheEnabled(),
        palette: Object.assign({}, storyMapPaletteDescriptor(), {
            key: storyMapPaletteKey()
        }),
        revisions: Object.assign({}, STORY._mapCacheRevisions || {}),
        lastInvalidation: STORY._mapCacheInvalidation
            ? Object.assign({}, STORY._mapCacheInvalidation)
            : null,
        populated: {
            raster: !!STORY.canonicalMapRaster,
            landGrid: !!STORY._landGrid,
            terrain: !!STORY._terrainCache,
            geoTerrain: !!STORY._geoTerrain,
            ownerCanvas: !!STORY._ownerCache,
            ownerData: !!STORY._ownerOverlayData,
            hexOwnerCanvas: !!STORY._hexOwnerCache,
            hexOwnerData: !!STORY._hexOwnerOverlaySource,
            networkScreenLayer: !!STORY._networkLayerCanvas,
            settlementScreenLayer: !!STORY._settlementLayerCanvas,
            commanderScreenLayer: !!STORY._commanderLayerCanvas,
            naturalWorldRam: !!STORY._hexNaturalContentsRamTiles,
            settlementWorldRam: !!STORY._settlementWorldLayers,
            networkWorldRam: !!STORY._networkWorldLayers,
            politicalBorderWorldRam: !!STORY._politicalBorderWorldLayer,
            coastlineWorldRam: !!(STORY._mapV2CoastlineCache
                && STORY._mapV2CoastlineCache.worldLayers),
            warpPlan: !!STORY._warpPlanCache
        }
    };
}
