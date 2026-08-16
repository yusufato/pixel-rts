// ═══════════════════════════════════════════════════════════════════════════
//  POLİTİK OVERLAY — Faz 14.3
//  ---------------------------------------------------------------------------
//  Kanonik RegionIdRaster + canlı sahiplik → tek RGBA ImageData.
//  Deniz tamamen şeffaftır. Devlet sınırı ayrı Uint8 maskede tutulur.
//  LLM, kayıt veya kamera bu türetilmiş görsel katmanın girdisi değildir.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_POLITICAL_OVERLAY_SCHEMA_VERSION = 1;
const STORY_POLITICAL_OVERLAY_ADAPTER_VERSION = 'political-overlay-rgba-3';
// Fiziksel coğrafya önce okunur; devlet rengi yalnız yön bulma merceğidir.
const STORY_POLITICAL_BORDER_ALPHA = 154;
const STORY_POLITICAL_INTERIOR_ALPHA = 16;

function storyPoliticalOverlayEnabled() {
    const enabled = typeof storyFeatureEnabled === 'function'
        ? storyFeatureEnabled('render.imageDataPoliticalOverlay')
        : true;
    return enabled
        && typeof storyMapRasterEnabled === 'function'
        && storyMapRasterEnabled()
        && typeof storyMapRasterEnsure === 'function';
}

function storyPoliticalOverlayHashString(value) {
    const text = String(value == null ? '' : value);
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i) & 0xff;
        hash = Math.imul(hash, 0x01000193) >>> 0;
        const high = text.charCodeAt(i) >>> 8;
        if (high) {
            hash ^= high;
            hash = Math.imul(hash, 0x01000193) >>> 0;
        }
    }
    return `fnv1a32:${hash.toString(16).padStart(8, '0')}`;
}

function storyPoliticalOverlayHashBytes(values) {
    let hash = 0x811c9dc5;
    const bytes = values || [];
    for (let index = 0; index < bytes.length; index++) {
        hash ^= Number(bytes[index]) & 0xff;
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return `fnv1a32:${hash.toString(16).padStart(8, '0')}`;
}

function storyPoliticalOverlayRgb(value) {
    const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(value || ''));
    return match
        ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)]
        : [136, 136, 136];
}

function storyPoliticalOverlayOwnerKey(raster, nodes, states) {
    const owners = (nodes || []).map(node => `${Number(node.id)}:${Number(node.owner)}`).join(',');
    const palette = (states || []).map(state => `${Number(state.id)}:${String(state.color || '#888888').toLowerCase()}`).join(',');
    return storyPoliticalOverlayHashString([
        STORY_POLITICAL_OVERLAY_ADAPTER_VERSION,
        raster ? raster.sourceHash : 'no-raster',
        owners,
        palette
    ].join('|'));
}

function storyPoliticalOverlayOwnerTables(nodes, states) {
    const ownerByRegion = new Int16Array((nodes || []).reduce(
        (max, node) => Math.max(max, Number(node.id) + 1),
        0
    ));
    ownerByRegion.fill(-1);
    for (const node of nodes || []) {
        const regionId = Number(node.id);
        if (Number.isInteger(regionId) && regionId >= 0 && regionId < ownerByRegion.length) {
            ownerByRegion[regionId] = Number.isInteger(Number(node.owner)) ? Number(node.owner) : -1;
        }
    }
    const colors = new Map();
    for (const state of states || []) colors.set(Number(state.id), storyPoliticalOverlayRgb(state.color));
    return { ownerByRegion, colors };
}

function storyPoliticalOverlayCreate(options) {
    options = options || {};
    const started = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const raster = options.raster || storyMapRasterEnsure();
    if (!raster) return null;
    const nodes = options.nodes || STORY.nodes || [];
    const states = options.states || STORY.states || [];
    const tables = storyPoliticalOverlayOwnerTables(nodes, states);
    const pixelCount = raster.width * raster.height;
    const rgba = new Uint8ClampedArray(pixelCount * 4);
    const borderMask = new Uint8Array(pixelCount);
    const ownerAt = index => {
        if (index < 0 || index >= pixelCount || raster.landMask[index] !== 1) return -1;
        const regionId = Number(raster.regionIds[index]);
        return regionId >= 0 && regionId < tables.ownerByRegion.length
            ? Number(tables.ownerByRegion[regionId])
            : -1;
    };
    let landPixels = 0;
    let transparentSeaPixels = 0;
    let borderPixels = 0;
    for (let y = 0; y < raster.height; y++) {
        for (let x = 0; x < raster.width; x++) {
            const index = y * raster.width + x;
            if (raster.landMask[index] !== 1) {
                transparentSeaPixels++;
                continue;
            }
            landPixels++;
            const owner = ownerAt(index);
            const rgb = tables.colors.get(owner) || [136, 136, 136];
            let border = false;
            if (x > 0) {
                const neighbor = ownerAt(index - 1);
                border = neighbor !== -1 && neighbor !== owner;
            }
            if (!border && x + 1 < raster.width) {
                const neighbor = ownerAt(index + 1);
                border = neighbor !== -1 && neighbor !== owner;
            }
            if (!border && y > 0) {
                const neighbor = ownerAt(index - raster.width);
                border = neighbor !== -1 && neighbor !== owner;
            }
            if (!border && y + 1 < raster.height) {
                const neighbor = ownerAt(index + raster.width);
                border = neighbor !== -1 && neighbor !== owner;
            }
            const offset = index * 4;
            if (border) {
                borderMask[index] = 1;
                borderPixels++;
                rgba[offset] = rgb[0] * 0.5 | 0;
                rgba[offset + 1] = rgb[1] * 0.5 | 0;
                rgba[offset + 2] = rgb[2] * 0.5 | 0;
                rgba[offset + 3] = STORY_POLITICAL_BORDER_ALPHA;
            } else {
                rgba[offset] = rgb[0];
                rgba[offset + 1] = rgb[1];
                rgba[offset + 2] = rgb[2];
                rgba[offset + 3] = STORY_POLITICAL_INTERIOR_ALPHA;
            }
        }
    }
    const finished = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    return {
        schemaVersion: STORY_POLITICAL_OVERLAY_SCHEMA_VERSION,
        adapterVersion: STORY_POLITICAL_OVERLAY_ADAPTER_VERSION,
        width: raster.width,
        height: raster.height,
        sourceHash: raster.sourceHash,
        landHash: raster.landHash,
        regionHash: raster.regionHash,
        ownerHash: storyPoliticalOverlayOwnerKey(raster, nodes, states),
        rgbaHash: storyPoliticalOverlayHashBytes(rgba),
        borderHash: storyPoliticalOverlayHashBytes(borderMask),
        rgba,
        borderMask,
        diagnostics: {
            landPixels,
            transparentSeaPixels,
            borderPixels,
            buildMs: Math.round((finished - started) * 1000) / 1000
        }
    };
}

function storyPoliticalOverlayValidate(overlay, raster, nodes, states, options) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    raster = raster || (typeof storyMapRasterEnsure === 'function' ? storyMapRasterEnsure() : null);
    nodes = nodes || STORY.nodes || [];
    states = states || STORY.states || [];
    options = options || {};
    const deep = options.deep !== false;
    if (!overlay || typeof overlay !== 'object') {
        add('OVERLAY_REQUIRED', '$', 'Politik overlay nesnesi gerekli.');
        return { ok: false, issues };
    }
    if (overlay.schemaVersion !== STORY_POLITICAL_OVERLAY_SCHEMA_VERSION) {
        add('SCHEMA_VERSION', '$.schemaVersion', 'Politik overlay şema sürümü uyuşmuyor.');
    }
    if (overlay.adapterVersion !== STORY_POLITICAL_OVERLAY_ADAPTER_VERSION) {
        add('ADAPTER_VERSION', '$.adapterVersion', 'Politik overlay adaptör sürümü uyuşmuyor.');
    }
    if (!raster) add('RASTER_REQUIRED', '$.sourceHash', 'Kanonik harita rasterı bulunamadı.');
    if (raster && (overlay.width !== raster.width || overlay.height !== raster.height)) {
        add('DIMENSION_MISMATCH', '$.width', 'Politik overlay kanonik raster boyutuyla uyuşmuyor.');
    }
    const pixelCount = Math.max(0, Number(overlay.width) * Number(overlay.height));
    if (!(overlay.rgba instanceof Uint8ClampedArray) || overlay.rgba.length !== pixelCount * 4) {
        add('RGBA_LENGTH', '$.rgba', 'RGBA dizisi beklenen uzunlukta değil.');
    }
    if (!(overlay.borderMask instanceof Uint8Array) || overlay.borderMask.length !== pixelCount) {
        add('BORDER_LENGTH', '$.borderMask', 'Sınır maskesi beklenen uzunlukta değil.');
    }
    if (raster && overlay.sourceHash !== raster.sourceHash) {
        add('SOURCE_HASH_MISMATCH', '$.sourceHash', 'Politik overlay farklı bir coğrafya kaynağına ait.');
    }
    if (raster && overlay.ownerHash !== storyPoliticalOverlayOwnerKey(raster, nodes, states)) {
        add('OWNER_HASH_MISMATCH', '$.ownerHash', 'Politik overlay güncel sahiplik/palet revizyonuna ait değil.');
    }
    if (deep && overlay.rgba instanceof Uint8ClampedArray && overlay.rgba.length === pixelCount * 4
        && overlay.borderMask instanceof Uint8Array && overlay.borderMask.length === pixelCount && raster) {
        const tables = storyPoliticalOverlayOwnerTables(nodes, states);
        const ownerAt = index => {
            if (index < 0 || index >= pixelCount || raster.landMask[index] !== 1) return -1;
            const regionId = Number(raster.regionIds[index]);
            return regionId >= 0 && regionId < tables.ownerByRegion.length
                ? Number(tables.ownerByRegion[regionId])
                : -1;
        };
        for (let index = 0; index < pixelCount; index++) {
            const alpha = overlay.rgba[index * 4 + 3];
            if (raster.landMask[index] === 0 && alpha !== 0) {
                add('SEA_ALPHA_LEAK', `$.rgba[${index * 4 + 3}]`, 'Deniz pikseli tamamen şeffaf değil.');
                break;
            }
            if (raster.landMask[index] === 1 && alpha === 0) {
                add('LAND_ALPHA_MISSING', `$.rgba[${index * 4 + 3}]`, 'Kara pikselinde politik renk eksik.');
                break;
            }
            if (overlay.borderMask[index] !== 0 && overlay.borderMask[index] !== 1) {
                add('BORDER_VALUE', `$.borderMask[${index}]`, 'Sınır maskesi yalnız 0/1 içerebilir.');
                break;
            }
            if (raster.landMask[index] === 0 && overlay.borderMask[index] !== 0) {
                add('SEA_BORDER_LEAK', `$.borderMask[${index}]`, 'Denize siyasi sınır yazılmış.');
                break;
            }
            if (raster.landMask[index] === 1) {
                const x = index % raster.width;
                const y = Math.floor(index / raster.width);
                const owner = ownerAt(index);
                let expectedBorder = false;
                if (x > 0) {
                    const neighbor = ownerAt(index - 1);
                    expectedBorder = neighbor !== -1 && neighbor !== owner;
                }
                if (!expectedBorder && x + 1 < raster.width) {
                    const neighbor = ownerAt(index + 1);
                    expectedBorder = neighbor !== -1 && neighbor !== owner;
                }
                if (!expectedBorder && y > 0) {
                    const neighbor = ownerAt(index - raster.width);
                    expectedBorder = neighbor !== -1 && neighbor !== owner;
                }
                if (!expectedBorder && y + 1 < raster.height) {
                    const neighbor = ownerAt(index + raster.width);
                    expectedBorder = neighbor !== -1 && neighbor !== owner;
                }
                if (overlay.borderMask[index] !== (expectedBorder ? 1 : 0)) {
                    add('BORDER_TOPOLOGY_MISMATCH', `$.borderMask[${index}]`, 'Sınır maskesi güncel sahiplik topolojisiyle uyuşmuyor.');
                    break;
                }
                if (alpha !== (expectedBorder ? STORY_POLITICAL_BORDER_ALPHA : STORY_POLITICAL_INTERIOR_ALPHA)) {
                    add('LAND_ALPHA_VALUE', `$.rgba[${index * 4 + 3}]`, 'Kara alfa değeri sınır/iç bölge sözleşmesiyle uyuşmuyor.');
                    break;
                }
            }
        }
    }
    if (deep && overlay.rgba instanceof Uint8ClampedArray
        && overlay.rgbaHash !== storyPoliticalOverlayHashBytes(overlay.rgba)) {
        add('RGBA_HASH_MISMATCH', '$.rgbaHash', 'Politik RGBA checksum uyuşmuyor.');
    }
    if (deep && overlay.borderMask instanceof Uint8Array
        && overlay.borderHash !== storyPoliticalOverlayHashBytes(overlay.borderMask)) {
        add('BORDER_HASH_MISMATCH', '$.borderHash', 'Politik sınır checksum uyuşmuyor.');
    }
    return { ok: issues.length === 0, issues };
}

function storyPoliticalOverlayInvalidate(reason) {
    if (typeof storyInvalidateMapCaches === 'function') {
        const result = storyInvalidateMapCaches('ownership', reason || 'manual');
        if (result && result.ok) {
            STORY._ownerOverlayInvalidation = {
                at: Number(STORY.clock) || 0,
                reason: String(reason || 'manual'),
                revision: result.revision
            };
            return result;
        }
    }
    STORY._ownerKey = null;
    STORY._ownerOverlayInvalidation = {
        at: Number(STORY.clock) || 0,
        reason: String(reason || 'manual')
    };
    return { ok: true, legacy: true, scope: 'ownership' };
}

function storyPoliticalOverlayEnsureCanvas() {
    if (!storyPoliticalOverlayEnabled()) return null;
    const raster = storyMapRasterEnsure();
    if (!raster) return null;
    const ownerKey = storyPoliticalOverlayOwnerKey(raster, STORY.nodes, STORY.states);
    if (STORY._ownerCache && STORY._ownerOverlayData && STORY._ownerKey === ownerKey
        && STORY._ownerCache.width === raster.width && STORY._ownerCache.height === raster.height) {
        return STORY._ownerCache;
    }
    const overlay = storyPoliticalOverlayCreate({ raster, nodes: STORY.nodes, states: STORY.states });
    // Bu payload aynı çağrıda deterministik olarak üretildi. Kare/fetih yolunda
    // 528.900 pikseli ikinci kez taramayız; derin kapı QA ve dış veri için kalır.
    const validation = storyPoliticalOverlayValidate(
        overlay,
        raster,
        STORY.nodes,
        STORY.states,
        { deep: false }
    );
    if (!validation.ok) throw new Error(`Politik overlay üretilemedi: ${validation.issues[0].code}`);
    let canvas = STORY._ownerCache;
    if (!canvas || canvas.width !== raster.width || canvas.height !== raster.height) {
        canvas = document.createElement('canvas');
        canvas.width = raster.width;
        canvas.height = raster.height;
    }
    const context = canvas.getContext('2d');
    const imageData = context.createImageData(raster.width, raster.height);
    imageData.data.set(overlay.rgba);
    context.putImageData(imageData, 0, 0);
    STORY._ownerOverlayRevision = (Number(STORY._ownerOverlayRevision) || 0) + 1;
    STORY._ownerCache = canvas;
    STORY._ownerKey = ownerKey;
    STORY._ownerOverlayData = overlay;
    STORY._ownerOverlaySource = {
        schemaVersion: overlay.schemaVersion,
        adapterVersion: overlay.adapterVersion,
        sourceHash: overlay.sourceHash,
        landHash: overlay.landHash,
        regionHash: overlay.regionHash,
        ownerHash: overlay.ownerHash,
        rgbaHash: overlay.rgbaHash,
        borderHash: overlay.borderHash,
        width: overlay.width,
        height: overlay.height,
        revision: STORY._ownerOverlayRevision,
        putImageDataCalls: 1,
        buildMs: overlay.diagnostics.buildMs
    };
    return canvas;
}

function storyPoliticalOverlayDiagnostics() {
    const source = STORY._ownerOverlaySource;
    return source
        ? Object.assign({ disabled: false }, source, {
            diagnostics: STORY._ownerOverlayData
                ? Object.assign({}, STORY._ownerOverlayData.diagnostics)
                : null
        })
        : {
            schemaVersion: STORY_POLITICAL_OVERLAY_SCHEMA_VERSION,
            adapterVersion: STORY_POLITICAL_OVERLAY_ADAPTER_VERSION,
            disabled: !storyPoliticalOverlayEnabled()
        };
}
