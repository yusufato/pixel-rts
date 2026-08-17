// ═══════════════════════════════════════════════════════════════════════════
//  ALTİGEN DÜNYA TEMELİ — HXD-1
//  ---------------------------------------------------------------------------
//  Bu modül şimdilik salt-okunur bir mekânsal sidecar'dır. STORY.nodes veya
//  canlı ekonomi alanlarına yazmaz. Amaç, bütün sonraki coğrafya/şehir/yol
//  katmanlarının paylaşacağı tek koordinat ve komşuluk sözleşmesini kurmaktır.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_HEX_WORLD_SCHEMA_VERSION = 1;
const STORY_HEX_WORLD_ADAPTER_VERSION = 'story-hex-world-1';
const STORY_HEX_WORLD_COORDINATE_SYSTEM = 'POINTY_AXIAL_QR_V1';
const STORY_HEX_WORLD_DEFAULT_WIDTH = 3000;
const STORY_HEX_WORLD_DEFAULT_HEIGHT = 2360;
const STORY_HEX_WORLD_DEFAULT_RADIUS = 16.1;
const STORY_HEX_WORLD_GEO_WIDTH = 1500;
const STORY_HEX_WORLD_GEO_HEIGHT = 1180;
const STORY_HEX_WORLD_NEIGHBOR_DIRECTIONS = Object.freeze([
    Object.freeze([1, 0]), Object.freeze([1, -1]), Object.freeze([0, -1]),
    Object.freeze([-1, 0]), Object.freeze([-1, 1]), Object.freeze([0, 1])
]);

let STORY_HEX_WORLD_CACHE = null;

function storyHexWorldHashText(text) {
    const value = String(text == null ? '' : text);
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return `fnv1a32:${(`00000000${(hash >>> 0).toString(16)}`).slice(-8)}`;
}

function storyHexWorldHashInt(hash, value) {
    const integer = Number(value) | 0;
    for (let shift = 0; shift < 32; shift += 8) {
        hash ^= (integer >>> shift) & 255;
        hash = Math.imul(hash, 0x01000193);
    }
    return hash;
}

function storyHexWorldHashArrays(qValues, rValues, centerX, centerY) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < qValues.length; index++) {
        hash = storyHexWorldHashInt(hash, qValues[index]);
        hash = storyHexWorldHashInt(hash, rValues[index]);
        hash = storyHexWorldHashInt(hash, Math.round(Number(centerX[index]) * 1000));
        hash = storyHexWorldHashInt(hash, Math.round(Number(centerY[index]) * 1000));
    }
    return `fnv1a32:${(`00000000${(hash >>> 0).toString(16)}`).slice(-8)}`;
}

function storyHexWorldConfig(options) {
    options = options || {};
    const width = Number(options.width == null ? STORY_HEX_WORLD_DEFAULT_WIDTH : options.width);
    const height = Number(options.height == null ? STORY_HEX_WORLD_DEFAULT_HEIGHT : options.height);
    const radius = Number(options.radius == null ? STORY_HEX_WORLD_DEFAULT_RADIUS : options.radius);
    const geoWidth = Number(options.geoWidth == null ? STORY_HEX_WORLD_GEO_WIDTH : options.geoWidth);
    const geoHeight = Number(options.geoHeight == null ? STORY_HEX_WORLD_GEO_HEIGHT : options.geoHeight);
    if (!Number.isFinite(width) || width <= 0) throw new Error('HEX_WORLD_WIDTH_INVALID');
    if (!Number.isFinite(height) || height <= 0) throw new Error('HEX_WORLD_HEIGHT_INVALID');
    if (!Number.isFinite(radius) || radius <= 0) throw new Error('HEX_WORLD_RADIUS_INVALID');
    if (!Number.isFinite(geoWidth) || geoWidth <= 0) throw new Error('HEX_WORLD_GEO_WIDTH_INVALID');
    if (!Number.isFinite(geoHeight) || geoHeight <= 0) throw new Error('HEX_WORLD_GEO_HEIGHT_INVALID');
    return { width, height, radius, geoWidth, geoHeight };
}

function storyHexWorldSourcePayload(config) {
    return {
        schemaVersion: STORY_HEX_WORLD_SCHEMA_VERSION,
        adapterVersion: STORY_HEX_WORLD_ADAPTER_VERSION,
        coordinateSystem: STORY_HEX_WORLD_COORDINATE_SYSTEM,
        width: config.width,
        height: config.height,
        radius: config.radius,
        geoWidth: config.geoWidth,
        geoHeight: config.geoHeight
    };
}

function storyHexWorldId(q, r) {
    return `hex:${Number(q)}:${Number(r)}`;
}

function storyHexWorldAxialToWorld(q, r, radius) {
    const size = Number(radius == null ? STORY_HEX_WORLD_DEFAULT_RADIUS : radius);
    return {
        x: Math.sqrt(3) * size * (Number(q) + Number(r) / 2),
        y: 1.5 * size * Number(r)
    };
}

function storyHexWorldCubeRound(q, r) {
    const x = Number(q);
    const z = Number(r);
    const y = -x - z;
    let rx = Math.round(x);
    let ry = Math.round(y);
    let rz = Math.round(z);
    const dx = Math.abs(rx - x);
    const dy = Math.abs(ry - y);
    const dz = Math.abs(rz - z);
    if (dx > dy && dx > dz) rx = -ry - rz;
    else if (dy > dz) ry = -rx - rz;
    else rz = -rx - ry;
    return { q: rx, r: rz };
}

function storyHexWorldWorldToAxial(x, y, radius) {
    const size = Number(radius == null ? STORY_HEX_WORLD_DEFAULT_RADIUS : radius);
    return storyHexWorldCubeRound(
        (Math.sqrt(3) / 3 * Number(x) - Number(y) / 3) / size,
        (2 / 3 * Number(y)) / size
    );
}

function storyHexWorldCount(config) {
    const rowStep = 1.5 * config.radius;
    const columnStep = Math.sqrt(3) * config.radius;
    const rowCount = Math.floor(config.height / rowStep) + 1;
    let cellCount = 0;
    for (let r = 0; r < rowCount; r++) {
        const qMin = Math.ceil(-r / 2);
        const qMax = Math.floor(config.width / columnStep - r / 2 + 1e-12);
        cellCount += Math.max(0, qMax - qMin + 1);
    }
    return { rowCount, cellCount, rowStep, columnStep };
}

function storyHexWorldCreate(options) {
    const config = storyHexWorldConfig(options);
    const dimensions = storyHexWorldCount(config);
    const qValues = new Int16Array(dimensions.cellCount);
    const rValues = new Int16Array(dimensions.cellCount);
    const centerX = new Float32Array(dimensions.cellCount);
    const centerY = new Float32Array(dimensions.cellCount);
    const rowOffsets = new Uint32Array(dimensions.rowCount + 1);
    const rowQMin = new Int16Array(dimensions.rowCount);
    const rowQMax = new Int16Array(dimensions.rowCount);
    let offset = 0;
    for (let r = 0; r < dimensions.rowCount; r++) {
        const qMin = Math.ceil(-r / 2);
        const qMax = Math.floor(config.width / dimensions.columnStep - r / 2 + 1e-12);
        rowOffsets[r] = offset;
        rowQMin[r] = qMin;
        rowQMax[r] = qMax;
        for (let q = qMin; q <= qMax; q++) {
            const point = storyHexWorldAxialToWorld(q, r, config.radius);
            qValues[offset] = q;
            rValues[offset] = r;
            centerX[offset] = point.x;
            centerY[offset] = point.y;
            offset++;
        }
    }
    rowOffsets[dimensions.rowCount] = offset;
    const sourceHash = storyHexWorldHashText(JSON.stringify(storyHexWorldSourcePayload(config)));
    const layoutHash = storyHexWorldHashArrays(qValues, rValues, centerX, centerY);
    const byteLength = qValues.byteLength + rValues.byteLength + centerX.byteLength
        + centerY.byteLength + rowOffsets.byteLength + rowQMin.byteLength + rowQMax.byteLength;
    return {
        schemaVersion: STORY_HEX_WORLD_SCHEMA_VERSION,
        adapterVersion: STORY_HEX_WORLD_ADAPTER_VERSION,
        coordinateSystem: STORY_HEX_WORLD_COORDINATE_SYSTEM,
        width: config.width,
        height: config.height,
        radius: config.radius,
        geoWidth: config.geoWidth,
        geoHeight: config.geoHeight,
        rowStep: dimensions.rowStep,
        columnStep: dimensions.columnStep,
        rowCount: dimensions.rowCount,
        cellCount: dimensions.cellCount,
        sourceHash,
        layoutHash,
        qValues,
        rValues,
        centerX,
        centerY,
        rowOffsets,
        rowQMin,
        rowQMax,
        diagnostics: {
            byteLength,
            loadMode: options && options.loadMode ? String(options.loadMode) : 'runtime',
            fallbackCode: options && options.fallbackCode ? String(options.fallbackCode) : null
        }
    };
}

function storyHexWorldIndex(world, q, r) {
    const row = Number(r);
    const column = Number(q);
    if (!world || !Number.isInteger(row) || !Number.isInteger(column)
        || row < 0 || row >= world.rowCount) return -1;
    const qMin = world.rowQMin[row];
    const qMax = world.rowQMax[row];
    if (column < qMin || column > qMax) return -1;
    return Number(world.rowOffsets[row]) + column - qMin;
}

function storyHexWorldCell(world, q, r) {
    const index = storyHexWorldIndex(world, q, r);
    if (index < 0) return null;
    return {
        id: storyHexWorldId(q, r),
        index,
        q: Number(q),
        r: Number(r),
        center: { x: Number(world.centerX[index]), y: Number(world.centerY[index]) }
    };
}

function storyHexWorldCellAt(world, x, y) {
    if (!world || !Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) return null;
    const axial = storyHexWorldWorldToAxial(x, y, world.radius);
    return storyHexWorldCell(world, axial.q, axial.r);
}

function storyHexWorldNeighbors(world, q, r) {
    const result = [];
    for (let direction = 0; direction < STORY_HEX_WORLD_NEIGHBOR_DIRECTIONS.length; direction++) {
        const delta = STORY_HEX_WORLD_NEIGHBOR_DIRECTIONS[direction];
        const cell = storyHexWorldCell(world, Number(q) + delta[0], Number(r) + delta[1]);
        if (cell) result.push(Object.assign({ direction }, cell));
    }
    return result;
}

function storyHexWorldCorners(world, q, r) {
    const cell = storyHexWorldCell(world, q, r);
    if (!cell) return [];
    const corners = [];
    for (let index = 0; index < 6; index++) {
        const angle = Math.PI / 180 * (60 * index - 30);
        corners.push({
            x: cell.center.x + world.radius * Math.cos(angle),
            y: cell.center.y + world.radius * Math.sin(angle)
        });
    }
    return corners;
}

function storyHexWorldValidate(world, expectedAsset) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!world || typeof world !== 'object') {
        add('WORLD_OBJECT', '$', 'HexWorld nesnesi zorunlu.');
        return { ok: false, issues };
    }
    if (world.schemaVersion !== STORY_HEX_WORLD_SCHEMA_VERSION) add('SCHEMA_VERSION', '$.schemaVersion', 'HexWorld sürümü uyuşmuyor.');
    if (world.adapterVersion !== STORY_HEX_WORLD_ADAPTER_VERSION) add('ADAPTER_VERSION', '$.adapterVersion', 'HexWorld adaptörü uyuşmuyor.');
    if (world.coordinateSystem !== STORY_HEX_WORLD_COORDINATE_SYSTEM) add('COORDINATE_SYSTEM', '$.coordinateSystem', 'Koordinat sistemi uyuşmuyor.');
    const arrays = ['qValues', 'rValues', 'centerX', 'centerY'];
    for (const field of arrays) {
        if (!world[field] || Number(world[field].length) !== Number(world.cellCount)) {
            add('CELL_ARRAY_LENGTH', `$.${field}`, `${field} hücre sayısıyla uyuşmuyor.`);
        }
    }
    if (!world.rowOffsets || world.rowOffsets.length !== world.rowCount + 1) add('ROW_OFFSETS_LENGTH', '$.rowOffsets', 'Satır ofset sayısı uyuşmuyor.');
    if (!world.rowQMin || world.rowQMin.length !== world.rowCount) add('ROW_QMIN_LENGTH', '$.rowQMin', 'Satır qMin sayısı uyuşmuyor.');
    if (!world.rowQMax || world.rowQMax.length !== world.rowCount) add('ROW_QMAX_LENGTH', '$.rowQMax', 'Satır qMax sayısı uyuşmuyor.');
    if (!issues.length) {
        if (world.rowOffsets[world.rowCount] !== world.cellCount) add('ROW_FINAL_OFFSET', '$.rowOffsets', 'Son satır ofseti hücre sayısına eşit değil.');
        const layoutHash = storyHexWorldHashArrays(world.qValues, world.rValues, world.centerX, world.centerY);
        if (layoutHash !== world.layoutHash) add('LAYOUT_HASH', '$.layoutHash', 'Altıgen yerleşim karması uyuşmuyor.');
    }
    if (expectedAsset) {
        for (const field of ['schemaVersion', 'adapterVersion', 'coordinateSystem', 'width', 'height', 'radius', 'rowCount', 'cellCount', 'sourceHash', 'layoutHash']) {
            if (world[field] !== expectedAsset[field]) add('ASSET_MISMATCH', `$.${field}`, `Build-time HexWorld varlığı ${field} alanıyla uyuşmuyor.`);
        }
    }
    return { ok: issues.length === 0, issues };
}

function storyHexWorldAssetValidation(asset) {
    if (!asset || typeof asset !== 'object') return { ok: false, code: 'ASSET_MISSING' };
    const required = storyHexWorldSourcePayload(storyHexWorldConfig());
    for (const field of ['schemaVersion', 'adapterVersion', 'coordinateSystem', 'width', 'height', 'radius', 'geoWidth', 'geoHeight']) {
        if (asset[field] !== required[field]) return { ok: false, code: `ASSET_${field.toUpperCase()}` };
    }
    if (!Number.isInteger(asset.cellCount) || asset.cellCount <= 0) return { ok: false, code: 'ASSET_CELL_COUNT' };
    if (!Number.isInteger(asset.rowCount) || asset.rowCount <= 0) return { ok: false, code: 'ASSET_ROW_COUNT' };
    if (typeof asset.sourceHash !== 'string' || typeof asset.layoutHash !== 'string') return { ok: false, code: 'ASSET_HASH' };
    return { ok: true, code: null };
}

function storyHexWorldEnsure() {
    if (STORY_HEX_WORLD_CACHE) return STORY_HEX_WORLD_CACHE;
    const asset = typeof STORY_HEX_WORLD_ASSET !== 'undefined' ? STORY_HEX_WORLD_ASSET : null;
    const assetValidation = storyHexWorldAssetValidation(asset);
    const options = assetValidation.ok
        ? Object.assign({}, asset, { loadMode: 'asset' })
        : { loadMode: 'runtime-fallback', fallbackCode: assetValidation.code };
    const world = storyHexWorldCreate(options);
    const validation = storyHexWorldValidate(world, assetValidation.ok ? asset : null);
    if (!validation.ok) throw new Error(`HEX_WORLD_INVALID:${validation.issues.map(issue => issue.code).join(',')}`);
    STORY_HEX_WORLD_CACHE = world;
    return world;
}

function storyHexWorldResetCache() {
    STORY_HEX_WORLD_CACHE = null;
}

function storyHexWorldDiagnostics(world) {
    const value = world || storyHexWorldEnsure();
    return {
        schemaVersion: value.schemaVersion,
        adapterVersion: value.adapterVersion,
        coordinateSystem: value.coordinateSystem,
        width: value.width,
        height: value.height,
        radius: value.radius,
        rowCount: value.rowCount,
        cellCount: value.cellCount,
        sourceHash: value.sourceHash,
        layoutHash: value.layoutHash,
        byteLength: value.diagnostics.byteLength,
        loadMode: value.diagnostics.loadMode,
        fallbackCode: value.diagnostics.fallbackCode
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STORY_HEX_WORLD_SCHEMA_VERSION,
        STORY_HEX_WORLD_ADAPTER_VERSION,
        STORY_HEX_WORLD_COORDINATE_SYSTEM,
        STORY_HEX_WORLD_DEFAULT_WIDTH,
        STORY_HEX_WORLD_DEFAULT_HEIGHT,
        STORY_HEX_WORLD_DEFAULT_RADIUS,
        STORY_HEX_WORLD_NEIGHBOR_DIRECTIONS,
        storyHexWorldHashText,
        storyHexWorldConfig,
        storyHexWorldSourcePayload,
        storyHexWorldId,
        storyHexWorldAxialToWorld,
        storyHexWorldWorldToAxial,
        storyHexWorldCount,
        storyHexWorldCreate,
        storyHexWorldIndex,
        storyHexWorldCell,
        storyHexWorldCellAt,
        storyHexWorldNeighbors,
        storyHexWorldCorners,
        storyHexWorldValidate,
        storyHexWorldAssetValidation,
        storyHexWorldEnsure,
        storyHexWorldResetCache,
        storyHexWorldDiagnostics
    };
}
