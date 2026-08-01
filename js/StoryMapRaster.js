// ═══════════════════════════════════════════════════════════════════════════
//  KANONİK KARA MASKESİ + REGION ID RASTER — Faz 14.2
//  ---------------------------------------------------------------------------
//  Terrain, politik overlay ve harita hit-test aynı türetilmiş rasterı okur.
//  GEO.land yalnız burada scanline edilir; tüketiciler kendi kıyı maskelerini
//  yeniden üretmez.
//
//  Raster kalıcı dünya gerçeği değildir. GEO topolojisi + düğüm geometrisinden
//  deterministik türetilir, sahiplik değişiminden etkilenmez ve kayda yazılmaz.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_MAP_RASTER_SCHEMA_VERSION = 1;
const STORY_MAP_RASTER_ADAPTER_VERSION = 'canonical-map-raster-1';
const STORY_MAP_RASTER_WIDTH = 820;
const STORY_MAP_RASTER_ASSET_SCHEMA_VERSION = 1;
const STORY_MAP_RASTER_ASSET_ADAPTER_VERSION = 'canonical-map-raster-asset-1';
const STORY_MAP_RASTER_ASSET_ENCODING = 'rle-int16-le-v1';
const STORY_MAP_RASTER_VALID = new WeakSet();
let STORY_MAP_RASTER_GEO_HASH = null;

function storyMapRasterEnabled() {
    return typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('world.canonicalMapRaster');
}

function storyMapRasterAssetEnabled() {
    return typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('world.prebuiltMapRaster');
}

function storyMapRasterHashText(text) {
    let hash = 0x811c9dc5;
    const value = String(text || '');
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return `fnv1a32:${(`00000000${(hash >>> 0).toString(16)}`).slice(-8)}`;
}

function storyMapRasterHashBytes(values) {
    let hash = 0x811c9dc5;
    const bytes = values || [];
    for (let index = 0; index < bytes.length; index++) {
        const value = Number(bytes[index]) | 0;
        hash ^= value & 255;
        hash = Math.imul(hash, 0x01000193);
        hash ^= (value >>> 8) & 255;
        hash = Math.imul(hash, 0x01000193);
    }
    return `fnv1a32:${(`00000000${(hash >>> 0).toString(16)}`).slice(-8)}`;
}

function storyMapRasterGeoHash() {
    if (STORY_MAP_RASTER_GEO_HASH) return STORY_MAP_RASTER_GEO_HASH;
    if (typeof GEO === 'undefined' || !Array.isArray(GEO.land)) {
        STORY_MAP_RASTER_GEO_HASH = 'geo:none';
        return STORY_MAP_RASTER_GEO_HASH;
    }
    STORY_MAP_RASTER_GEO_HASH = storyMapRasterHashText(JSON.stringify({
        width: GEO.W,
        height: GEO.H,
        land: GEO.land
    }));
    return STORY_MAP_RASTER_GEO_HASH;
}

function storyMapRasterGeometryKey(nodes) {
    return storyMapRasterHashText(JSON.stringify((nodes || [])
        .map(node => [
            Number(node.id),
            Math.round((Number(node.lx) || 0) * 1e8),
            Math.round((Number(node.ly) || 0) * 1e8)
        ])
        .sort((a, b) => a[0] - b[0])));
}

function storyMapRasterSourceHash(nodes, width, height) {
    return storyMapRasterHashText([
        STORY_MAP_RASTER_ADAPTER_VERSION,
        storyMapRasterGeoHash(),
        storyMapRasterGeometryKey(nodes),
        Number(width),
        Number(height)
    ].join('|'));
}

function storyMapRasterizeLand(width, height) {
    const landMask = new Uint8Array(width * height);
    if (typeof GEO === 'undefined' || !Array.isArray(GEO.land)) return landMask;
    const sx = width / GEO.W;
    const sy = height / GEO.H;
    for (const ring of GEO.land) {
        for (let gy = 0; gy < height; gy++) {
            const y = (gy + 0.5) / sy;
            const intersections = [];
            for (let index = 0; index < ring.length; index++) {
                const current = ring[index];
                const next = ring[(index + 1) % ring.length];
                const x1 = current[0], y1 = current[1], x2 = next[0], y2 = next[1];
                if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
                    intersections.push(x1 + (y - y1) / (y2 - y1) * (x2 - x1));
                }
            }
            intersections.sort((a, b) => a - b);
            for (let pair = 0; pair + 1 < intersections.length; pair += 2) {
                const from = Math.max(0, Math.ceil(intersections[pair] * sx - 0.5));
                const to = Math.min(width - 1, Math.floor(intersections[pair + 1] * sx - 0.5));
                for (let gx = from; gx <= to; gx++) landMask[gy * width + gx] ^= 1;
            }
        }
    }
    return landMask;
}

function storyMapRasterKdBuild(points, depth) {
    if (!points.length) return null;
    const axis = depth % 2;
    const sorted = points.slice().sort((a, b) => (
        (axis === 0 ? a.x - b.x : a.y - b.y)
        || (axis === 0 ? a.y - b.y : a.x - b.x)
        || a.id - b.id
    ));
    const middle = Math.floor(sorted.length / 2);
    return {
        point: sorted[middle],
        axis,
        left: storyMapRasterKdBuild(sorted.slice(0, middle), depth + 1),
        right: storyMapRasterKdBuild(sorted.slice(middle + 1), depth + 1)
    };
}

function storyMapRasterKdNearest(tree, x, y, best) {
    if (!tree) return best;
    const point = tree.point;
    const dx = x - point.x;
    const dy = y - point.y;
    const distance = dx * dx + dy * dy;
    if (!best || distance < best.distance
        || (distance === best.distance && point.id < best.point.id)) {
        best = { point, distance };
    }
    const delta = tree.axis === 0 ? dx : dy;
    const near = delta <= 0 ? tree.left : tree.right;
    const far = delta <= 0 ? tree.right : tree.left;
    best = storyMapRasterKdNearest(near, x, y, best);
    if (delta * delta <= best.distance) best = storyMapRasterKdNearest(far, x, y, best);
    return best;
}

function storyMapRasterAssignRegions(landMask, width, height, nodes) {
    const regionIds = new Int16Array(width * height);
    regionIds.fill(-1);
    const points = (nodes || []).map(node => ({
        id: Number(node.id),
        // Eski politik Voronoi normalize 0..1 uzayında eşit x/y ağırlığı
        // kullanıyordu. Raster en-boy oranını mesafeye katmak sınırları sessizce
        // değiştirirdi; KD-tree de aynı normalize metriği korur.
        x: Number(node.lx) || 0,
        y: Number(node.ly) || 0
    })).filter(point => Number.isInteger(point.id));
    const tree = storyMapRasterKdBuild(points, 0);
    if (!tree) return regionIds;
    for (let gy = 0; gy < height; gy++) {
        for (let gx = 0; gx < width; gx++) {
            const offset = gy * width + gx;
            if (!landMask[offset]) continue;
            const nearest = storyMapRasterKdNearest(
                tree,
                (gx + 0.5) / width,
                (gy + 0.5) / height,
                null
            );
            regionIds[offset] = nearest ? nearest.point.id : -1;
        }
    }
    return regionIds;
}

function storyMapRasterCreate(options) {
    options = options || {};
    const nodes = options.nodes || STORY.nodes || [];
    const width = Math.max(64, Math.round(Number(options.width) || STORY_MAP_RASTER_WIDTH));
    const height = Math.max(32, Math.round(width * GEO.H / GEO.W));
    const started = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const landMask = storyMapRasterizeLand(width, height);
    const regionIds = storyMapRasterAssignRegions(landMask, width, height, nodes);
    const ended = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    let landCells = 0;
    for (let index = 0; index < landMask.length; index++) if (landMask[index]) landCells++;
    return {
        schemaVersion: STORY_MAP_RASTER_SCHEMA_VERSION,
        adapterVersion: STORY_MAP_RASTER_ADAPTER_VERSION,
        width,
        height,
        geoWidth: Number(GEO.W),
        geoHeight: Number(GEO.H),
        sourceHash: storyMapRasterSourceHash(nodes, width, height),
        landHash: storyMapRasterHashBytes(landMask),
        regionHash: storyMapRasterHashBytes(regionIds),
        landMask,
        regionIds,
        diagnostics: {
            landCells,
            seaCells: landMask.length - landCells,
            regionCount: new Set(Array.from(regionIds).filter(id => id >= 0)).size,
            buildMs: Math.max(0, Math.round((ended - started) * 1000) / 1000),
            warnings: []
        }
    };
}

function storyMapRasterDecodeBase64(chunks) {
    const encoded = Array.isArray(chunks) ? chunks.join('') : String(chunks || '');
    if (!encoded) return new Uint8Array(0);
    const binary = typeof atob === 'function'
        ? atob(encoded)
        : (typeof Buffer !== 'undefined' ? Buffer.from(encoded, 'base64').toString('binary') : '');
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index) & 0xff;
    return bytes;
}

function storyMapRasterAssetDecode(asset, nodes) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    const started = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    if (!asset || typeof asset !== 'object') {
        add('ASSET_MISSING', '$', 'Build-time harita raster varlığı bulunamadı.');
        return { ok: false, issues, raster: null };
    }
    if (asset.schemaVersion !== STORY_MAP_RASTER_ASSET_SCHEMA_VERSION) {
        add('ASSET_SCHEMA_VERSION', '$.schemaVersion', 'Raster varlık şema sürümü uyuşmuyor.');
    }
    if (asset.adapterVersion !== STORY_MAP_RASTER_ASSET_ADAPTER_VERSION) {
        add('ASSET_ADAPTER_VERSION', '$.adapterVersion', 'Raster varlık adaptör sürümü uyuşmuyor.');
    }
    if (asset.rasterSchemaVersion !== STORY_MAP_RASTER_SCHEMA_VERSION
        || asset.rasterAdapterVersion !== STORY_MAP_RASTER_ADAPTER_VERSION) {
        add('ASSET_RASTER_VERSION', '$.rasterSchemaVersion', 'Varlık hedef raster sözleşmesiyle uyuşmuyor.');
    }
    if (asset.encoding !== STORY_MAP_RASTER_ASSET_ENCODING) {
        add('ASSET_ENCODING', '$.encoding', 'Raster varlık sıkıştırma biçimi desteklenmiyor.');
    }
    const width = Number(asset.width);
    const height = Number(asset.height);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
        add('ASSET_DIMENSIONS', '$.width', 'Raster varlık boyutları geçersiz.');
    }
    const sourceNodes = nodes || STORY.nodes || [];
    if (Number.isInteger(width) && Number.isInteger(height)
        && asset.sourceHash !== storyMapRasterSourceHash(sourceNodes, width, height)) {
        add('ASSET_SOURCE_HASH', '$.sourceHash', 'Raster varlığı güncel GEO/bölge geometrisine ait değil.');
    }
    let bytes = new Uint8Array(0);
    try {
        bytes = storyMapRasterDecodeBase64(asset.payloadChunks);
    } catch (error) {
        add('ASSET_BASE64', '$.payloadChunks', `Raster varlık payload’ı çözülemedi: ${error.message}`);
    }
    if (bytes.length % 4 !== 0 || bytes.length === 0) {
        add('ASSET_PAYLOAD_SIZE', '$.payloadChunks', 'RLE payload uzunluğu dört baytlık kayıtlara uymuyor.');
    }
    if (asset.payloadHash !== storyMapRasterHashBytes(bytes)) {
        add('ASSET_PAYLOAD_HASH', '$.payloadHash', 'Sıkıştırılmış raster payload checksum uyuşmuyor.');
    }
    const pixelCount = Number.isInteger(width) && Number.isInteger(height) ? width * height : 0;
    const regionIds = new Int16Array(pixelCount);
    regionIds.fill(-1);
    let cursor = 0;
    let runs = 0;
    if (!issues.some(issue => ['ASSET_BASE64', 'ASSET_PAYLOAD_SIZE'].includes(issue.code))) {
        for (let offset = 0; offset < bytes.length; offset += 4) {
            let value = bytes[offset] | (bytes[offset + 1] << 8);
            if (value & 0x8000) value -= 0x10000;
            const count = bytes[offset + 2] | (bytes[offset + 3] << 8);
            runs++;
            if (count <= 0 || cursor + count > pixelCount) {
                add('ASSET_RUN_OVERFLOW', `$.payloadChunks[${offset / 4}]`, 'RLE kaydı raster sınırını aşıyor.');
                break;
            }
            regionIds.fill(value, cursor, cursor + count);
            cursor += count;
        }
    }
    if (cursor !== pixelCount) add('ASSET_PIXEL_COUNT', '$.payloadChunks', 'RLE kayıtları raster piksel sayısını tamamlamıyor.');
    if (Number(asset.runCount) !== runs) add('ASSET_RUN_COUNT', '$.runCount', 'RLE kayıt sayısı başlıkla uyuşmuyor.');
    const landMask = new Uint8Array(pixelCount);
    let landCells = 0;
    for (let index = 0; index < pixelCount; index++) {
        if (regionIds[index] >= 0) {
            landMask[index] = 1;
            landCells++;
        }
    }
    const ended = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const raster = {
        schemaVersion: STORY_MAP_RASTER_SCHEMA_VERSION,
        adapterVersion: STORY_MAP_RASTER_ADAPTER_VERSION,
        width,
        height,
        geoWidth: Number(asset.geoWidth),
        geoHeight: Number(asset.geoHeight),
        sourceHash: asset.sourceHash,
        landHash: asset.landHash,
        regionHash: asset.regionHash,
        landMask,
        regionIds,
        diagnostics: {
            landCells,
            seaCells: pixelCount - landCells,
            regionCount: new Set(Array.from(regionIds).filter(id => id >= 0)).size,
            buildMs: 0,
            decodeMs: Math.max(0, Math.round((ended - started) * 1000) / 1000),
            loadMode: 'asset',
            assetBytes: bytes.length,
            runCount: runs,
            warnings: []
        }
    };
    const validation = storyMapRasterValidate(raster, sourceNodes);
    for (const issue of validation.issues) add(`ASSET_${issue.code}`, issue.path, issue.message);
    return { ok: issues.length === 0, issues, raster: issues.length ? null : raster };
}

function storyMapRasterValidate(raster, nodes) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!raster || typeof raster !== 'object' || Array.isArray(raster)) {
        return { ok: false, issues: [{ code: 'RASTER_REQUIRED', path: '$', message: 'Kanonik raster nesnesi zorunlu.' }] };
    }
    if (raster.schemaVersion !== STORY_MAP_RASTER_SCHEMA_VERSION) add('SCHEMA_VERSION', '$.schemaVersion', 'Raster şema sürümü uyuşmuyor.');
    if (raster.adapterVersion !== STORY_MAP_RASTER_ADAPTER_VERSION) add('ADAPTER_VERSION', '$.adapterVersion', 'Raster adaptör sürümü uyuşmuyor.');
    const width = Number(raster.width);
    const height = Number(raster.height);
    if (!Number.isInteger(width) || width <= 0) add('INVALID_WIDTH', '$.width', 'Raster genişliği pozitif tamsayı olmalı.');
    if (!Number.isInteger(height) || height <= 0) add('INVALID_HEIGHT', '$.height', 'Raster yüksekliği pozitif tamsayı olmalı.');
    const length = Number.isInteger(width) && Number.isInteger(height) ? width * height : -1;
    if (!(raster.landMask instanceof Uint8Array) || raster.landMask.length !== length) {
        add('LAND_MASK_LENGTH', '$.landMask', 'Kara maskesi Uint8Array ve tam raster boyunda olmalı.');
    }
    if (!(raster.regionIds instanceof Int16Array) || raster.regionIds.length !== length) {
        add('REGION_RASTER_LENGTH', '$.regionIds', 'Bölge rasterı Int16Array ve tam raster boyunda olmalı.');
    }
    const sourceNodes = nodes || STORY.nodes || [];
    const validIds = new Set(sourceNodes.map(node => Number(node.id)));
    if (raster.landMask instanceof Uint8Array && raster.regionIds instanceof Int16Array
        && raster.landMask.length === raster.regionIds.length) {
        for (let index = 0; index < raster.landMask.length; index++) {
            const land = raster.landMask[index];
            const regionId = raster.regionIds[index];
            if (land !== 0 && land !== 1) {
                add('INVALID_LAND_VALUE', `$.landMask[${index}]`, 'Kara değeri yalnız 0/1 olabilir.');
                break;
            }
            if (!land && regionId !== -1) {
                add('SEA_REGION_LEAK', `$.regionIds[${index}]`, 'Deniz hücresi bölge kimliği taşıyamaz.');
                break;
            }
            if (land && !validIds.has(regionId)) {
                add('LAND_REGION_MISSING', `$.regionIds[${index}]`, 'Kara hücresi geçerli bölge kimliği taşımalı.');
                break;
            }
        }
    }
    if (Number.isInteger(width) && Number.isInteger(height)
        && raster.sourceHash !== storyMapRasterSourceHash(sourceNodes, width, height)) {
        add('SOURCE_HASH_MISMATCH', '$.sourceHash', 'Raster güncel GEO/düğüm geometrisine ait değil.');
    }
    if (raster.landMask instanceof Uint8Array
        && raster.landHash !== storyMapRasterHashBytes(raster.landMask)) {
        add('LAND_HASH_MISMATCH', '$.landHash', 'Kara maskesi checksum uyuşmuyor.');
    }
    if (raster.regionIds instanceof Int16Array
        && raster.regionHash !== storyMapRasterHashBytes(raster.regionIds)) {
        add('REGION_HASH_MISMATCH', '$.regionHash', 'Bölge raster checksum uyuşmuyor.');
    }
    return { ok: issues.length === 0, issues };
}

function storyMapRasterEnsure() {
    if (!storyMapRasterEnabled()) return null;
    if (!STORY._geoMap || typeof GEO === 'undefined' || !Array.isArray(GEO.land)) return null;
    const nodes = STORY.nodes || [];
    const existing = STORY.canonicalMapRaster;
    if (existing && STORY_MAP_RASTER_VALID.has(existing)
        && existing.sourceHash === storyMapRasterSourceHash(nodes, existing.width, existing.height)) {
        return existing;
    }
    if (existing) {
        const validation = storyMapRasterValidate(existing, nodes);
        if (validation.ok) {
            STORY_MAP_RASTER_VALID.add(existing);
            return existing;
        }
    }
    let raster = null;
    STORY._mapRasterAssetFailure = null;
    if (storyMapRasterAssetEnabled()) {
        const asset = typeof STORY_MAP_RASTER_ASSET_V1 !== 'undefined'
            ? STORY_MAP_RASTER_ASSET_V1
            : globalThis.STORY_MAP_RASTER_ASSET_V1;
        const decoded = storyMapRasterAssetDecode(asset, nodes);
        if (decoded.ok) raster = decoded.raster;
        else STORY._mapRasterAssetFailure = {
            at: Number(STORY.clock) || 0,
            issues: decoded.issues.map(issue => Object.assign({}, issue))
        };
    }
    if (!raster) {
        raster = storyMapRasterCreate({ nodes });
        raster.diagnostics.loadMode = storyMapRasterAssetEnabled() ? 'runtime-fallback' : 'runtime-disabled';
        raster.diagnostics.fallbackCode = STORY._mapRasterAssetFailure
            && STORY._mapRasterAssetFailure.issues[0]
            ? STORY._mapRasterAssetFailure.issues[0].code
            : null;
    }
    const validation = storyMapRasterValidate(raster, nodes);
    if (!validation.ok) throw new Error(`Kanonik harita rasterı üretilemedi: ${validation.issues[0].code}`);
    STORY.canonicalMapRaster = raster;
    STORY_MAP_RASTER_VALID.add(raster);
    return raster;
}

function storyMapRasterInvalidate(reason) {
    if (typeof storyInvalidateMapCaches === 'function') {
        const result = storyInvalidateMapCaches('geometry', reason || 'manual');
        if (result && result.ok) {
            STORY._mapRasterInvalidation = {
                at: Number(STORY.clock) || 0,
                reason: String(reason || 'manual'),
                revision: result.revision
            };
            return result;
        }
    }
    STORY.canonicalMapRaster = null;
    STORY._landGrid = null;
    STORY._ownerKey = null;
    STORY._ownerCache = null;
    STORY._ownerOverlayData = null;
    STORY._ownerOverlaySource = null;
    STORY._terrainCache = null;
    STORY._geoTerrain = null;
    STORY._mapRasterInvalidation = {
        at: Number(STORY.clock) || 0,
        reason: String(reason || 'manual')
    };
    return { ok: true, legacy: true, scope: 'geometry' };
}

function storyMapRasterSample(raster, normalizedX, normalizedY) {
    if (!raster) return { land: false, regionId: -1, x: -1, y: -1 };
    const nx = Number(normalizedX);
    const ny = Number(normalizedY);
    if (!Number.isFinite(nx) || !Number.isFinite(ny) || nx < 0 || ny < 0 || nx >= 1 || ny >= 1) {
        return { land: false, regionId: -1, x: -1, y: -1 };
    }
    const x = Math.min(raster.width - 1, Math.floor(nx * raster.width));
    const y = Math.min(raster.height - 1, Math.floor(ny * raster.height));
    const offset = y * raster.width + x;
    return {
        land: raster.landMask[offset] === 1,
        regionId: Number(raster.regionIds[offset]),
        x,
        y
    };
}

function storyMapRasterResample(width, height) {
    const raster = storyMapRasterEnsure();
    if (!raster) return null;
    const targetWidth = Math.max(1, Math.round(Number(width) || 1));
    const targetHeight = Math.max(1, Math.round(Number(height) || 1));
    const landMask = new Uint8Array(targetWidth * targetHeight);
    const regionIds = new Int16Array(targetWidth * targetHeight);
    regionIds.fill(-1);
    for (let y = 0; y < targetHeight; y++) {
        const sourceY = Math.min(raster.height - 1, Math.floor((y + 0.5) * raster.height / targetHeight));
        for (let x = 0; x < targetWidth; x++) {
            const sourceX = Math.min(raster.width - 1, Math.floor((x + 0.5) * raster.width / targetWidth));
            const sourceOffset = sourceY * raster.width + sourceX;
            const targetOffset = y * targetWidth + x;
            landMask[targetOffset] = raster.landMask[sourceOffset];
            regionIds[targetOffset] = raster.regionIds[sourceOffset];
        }
    }
    return {
        width: targetWidth,
        height: targetHeight,
        sourceWidth: raster.width,
        sourceHeight: raster.height,
        sourceHash: raster.sourceHash,
        landHash: storyMapRasterHashBytes(landMask),
        regionHash: storyMapRasterHashBytes(regionIds),
        landMask,
        regionIds
    };
}

function storyMapRasterResampleLand(width, height) {
    const raster = storyMapRasterEnsure();
    if (!raster) return null;
    const targetWidth = Math.max(1, Math.round(Number(width) || 1));
    const targetHeight = Math.max(1, Math.round(Number(height) || 1));
    const landMask = new Uint8Array(targetWidth * targetHeight);
    for (let y = 0; y < targetHeight; y++) {
        const sourceY = Math.min(raster.height - 1, Math.floor((y + 0.5) * raster.height / targetHeight));
        for (let x = 0; x < targetWidth; x++) {
            const sourceX = Math.min(raster.width - 1, Math.floor((x + 0.5) * raster.width / targetWidth));
            landMask[y * targetWidth + x] = raster.landMask[sourceY * raster.width + sourceX];
        }
    }
    return landMask;
}

function storyMapRasterCoverageAt(width, height) {
    const raster = storyMapRasterEnsure();
    const sampled = storyMapRasterResample(width, height);
    if (!raster || !sampled) return null;
    let canonicalLandCells = 0;
    let thinGeometryLostCells = 0;
    for (let y = 0; y < raster.height; y++) {
        const targetY = Math.min(sampled.height - 1, Math.floor(y * sampled.height / raster.height));
        for (let x = 0; x < raster.width; x++) {
            const sourceOffset = y * raster.width + x;
            if (!raster.landMask[sourceOffset]) continue;
            canonicalLandCells++;
            const targetX = Math.min(sampled.width - 1, Math.floor(x * sampled.width / raster.width));
            if (!sampled.landMask[targetY * sampled.width + targetX]) thinGeometryLostCells++;
        }
    }
    return {
        canonicalLandCells,
        thinGeometryLostCells,
        thinGeometryLostRatio: canonicalLandCells
            ? Math.round(thinGeometryLostCells / canonicalLandCells * 1e8) / 1e8
            : 0
    };
}

function storyMapRasterDiagnostics() {
    const raster = storyMapRasterEnsure();
    if (!raster) {
        return {
            schemaVersion: STORY_MAP_RASTER_SCHEMA_VERSION,
            adapterVersion: STORY_MAP_RASTER_ADAPTER_VERSION,
            disabled: true
        };
    }
    return {
        schemaVersion: raster.schemaVersion,
        adapterVersion: raster.adapterVersion,
        disabled: false,
        width: raster.width,
        height: raster.height,
        geoWidth: raster.geoWidth,
        geoHeight: raster.geoHeight,
        sourceHash: raster.sourceHash,
        landHash: raster.landHash,
        regionHash: raster.regionHash,
        diagnostics: Object.assign({}, raster.diagnostics),
        overlay300: storyMapRasterCoverageAt(300, Math.round(300 * raster.height / raster.width))
    };
}

function storyMapPickNode(wx, wy) {
    if (storyMapRasterEnabled()) {
        const raster = storyMapRasterEnsure();
        if (raster) {
            const sample = storyMapRasterSample(
                raster,
                Number(wx) / STORY_WORLD_W,
                Number(wy) / STORY_WORLD_H
            );
            return sample.land ? sample.regionId : -1;
        }
    }
    let hit = -1;
    let distance = 34 * 34;
    for (const node of STORY.nodes || []) {
        const dx = node.lx * STORY_WORLD_W - wx;
        const dy = node.ly * STORY_WORLD_H - wy;
        const candidate = dx * dx + dy * dy;
        if (candidate < distance) {
            distance = candidate;
            hit = node.id;
        }
    }
    return hit;
}
