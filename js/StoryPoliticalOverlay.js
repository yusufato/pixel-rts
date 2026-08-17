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
const STORY_HEX_POLITICAL_OVERLAY_ADAPTER_VERSION = 'hex-political-overlay-canvas-1';
const STORY_HEX_POLITICAL_EDGE_CORNERS = Object.freeze([
    Object.freeze([0, 1]), Object.freeze([5, 0]), Object.freeze([4, 5]),
    Object.freeze([3, 4]), Object.freeze([2, 3]), Object.freeze([1, 2])
]);

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

function storyHexPoliticalOverlayEnabled() {
    return typeof storyHexWorldEnsure === 'function'
        && typeof storyHexRegionsEnsure === 'function'
        && typeof storyHexPoliticalViewEnsure === 'function';
}

function storyHexPoliticalOverlayModel(options) {
    options = options || {};
    const world = options.world || storyHexWorldEnsure();
    const regions = options.regions || storyHexRegionsEnsure();
    const political = options.political || storyHexPoliticalViewEnsure();
    const states = options.states || STORY.states || [];
    const width = Number(options.width) || STORY_MAP_RASTER_WIDTH;
    const height = Number(options.height) || Math.round(width * world.height / world.width);
    const palette = states.map(state => `${Number(state.id)}:${String(state.color || '#888888').toLowerCase()}`).join(',');
    return {
        adapterVersion: STORY_HEX_POLITICAL_OVERLAY_ADAPTER_VERSION,
        width,
        height,
        worldLayoutHash: world.layoutHash,
        membershipHash: regions.membershipHash,
        ownershipHash: political.ownershipHash,
        renderHash: storyPoliticalOverlayHashString([
            STORY_HEX_POLITICAL_OVERLAY_ADAPTER_VERSION,
            world.layoutHash,
            regions.membershipHash,
            political.ownershipHash,
            palette,
            width,
            height
        ].join('|')),
        assignedCellCount: regions.diagnostics.assignedCellCount,
        nationalBorderEdgeCount: political.diagnostics.nationalBorderEdgeCount,
        scaleX: width / world.width,
        scaleY: height / world.height
    };
}

function storyHexPoliticalCellAtWorld(wx, wy, renderWidth, renderHeight) {
    if (!storyHexPoliticalOverlayEnabled()) return null;
    const world = storyHexWorldEnsure();
    const width = Math.max(1, Number(renderWidth) || Number(typeof STORY_WORLD_W !== 'undefined' ? STORY_WORLD_W : world.width));
    const height = Math.max(1, Number(renderHeight) || Number(typeof STORY_WORLD_H !== 'undefined' ? STORY_WORLD_H : world.height));
    const cell = storyHexWorldCellAt(
        world,
        Number(wx) / width * world.width,
        Number(wy) / height * world.height
    );
    if (!cell) return null;
    const regions = storyHexRegionsEnsure();
    const political = storyHexPoliticalViewEnsure();
    const regionId = Number(regions.cellRegionIds[cell.index]);
    return Object.assign({}, cell, {
        regionId,
        ownerId: Number(political.cellOwnerIds[cell.index]),
        assigned: regionId >= 0
    });
}

function storyHexVisibleCellIndices(bounds, renderWidth, renderHeight) {
    if (!storyHexPoliticalOverlayEnabled()) return [];
    const world = storyHexWorldEnsure();
    const width = Math.max(1, Number(renderWidth) || world.width);
    const height = Math.max(1, Number(renderHeight) || world.height);
    const minX = Number(bounds && bounds.minX) / width * world.width - world.radius;
    const maxX = Number(bounds && bounds.maxX) / width * world.width + world.radius;
    const minY = Number(bounds && bounds.minY) / height * world.height - world.radius;
    const maxY = Number(bounds && bounds.maxY) / height * world.height + world.radius;
    const result = [];
    for (let row = 0; row < world.rowCount; row++) {
        const start = Number(world.rowOffsets[row]);
        const end = Number(world.rowOffsets[row + 1]);
        if (start >= end) continue;
        const centerY = Number(world.centerY[start]);
        if (centerY < minY || centerY > maxY) continue;
        for (let index = start; index < end; index++) {
            const centerX = Number(world.centerX[index]);
            if (centerX >= minX && centerX <= maxX) result.push(index);
        }
    }
    return result;
}

function storyHexPoliticalOverlayEnsureCanvas() {
    if (!storyHexPoliticalOverlayEnabled() || typeof document === 'undefined') return null;
    const raster = typeof storyMapRasterEnsure === 'function' ? storyMapRasterEnsure() : null;
    const world = storyHexWorldEnsure();
    const regions = storyHexRegionsEnsure();
    const political = storyHexPoliticalViewEnsure();
    const width = raster ? raster.width : STORY_MAP_RASTER_WIDTH;
    const height = raster ? raster.height : Math.round(width * world.height / world.width);
    const model = storyHexPoliticalOverlayModel({ world, regions, political, states: STORY.states, width, height });
    if (STORY._hexOwnerCache && STORY._hexOwnerKey === model.renderHash
        && STORY._hexOwnerCache.width === width && STORY._hexOwnerCache.height === height) {
        return STORY._hexOwnerCache;
    }
    const started = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    let canvas = STORY._hexOwnerCache;
    if (!canvas || canvas.width !== width || canvas.height !== height) {
        canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
    }
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, width, height);
    const colors = new Map((STORY.states || []).map(state => [Number(state.id), String(state.color || '#888888')]));
    const cellsByOwner = new Map();
    for (let index = 0; index < world.cellCount; index++) {
        const regionId = Number(regions.cellRegionIds[index]);
        if (regionId < 0) continue;
        const ownerId = Number(political.cellOwnerIds[index]);
        if (!cellsByOwner.has(ownerId)) cellsByOwner.set(ownerId, []);
        cellsByOwner.get(ownerId).push(index);
    }
    context.save();
    context.globalAlpha = STORY_POLITICAL_INTERIOR_ALPHA / 255;
    for (const [ownerId, indices] of cellsByOwner.entries()) {
        context.beginPath();
        for (const index of indices) {
            const corners = storyHexWorldCorners(
                world,
                Number(world.qValues[index]),
                Number(world.rValues[index])
            );
            context.moveTo(corners[0].x * model.scaleX, corners[0].y * model.scaleY);
            for (let corner = 1; corner < corners.length; corner++) {
                context.lineTo(corners[corner].x * model.scaleX, corners[corner].y * model.scaleY);
            }
            context.closePath();
        }
        context.fillStyle = colors.get(ownerId) || '#888888';
        context.fill();
    }
    context.globalAlpha = STORY_POLITICAL_BORDER_ALPHA / 255;
    context.strokeStyle = '#17140e';
    context.lineWidth = 1.35;
    context.lineCap = 'round';
    context.beginPath();
    let drawnBorderEdges = 0;
    for (let index = 0; index < world.cellCount; index++) {
        const mask = Number(political.nationalBorderMask[index]);
        if (!mask) continue;
        const q = Number(world.qValues[index]);
        const r = Number(world.rValues[index]);
        const corners = storyHexWorldCorners(world, q, r);
        for (let direction = 0; direction < 6; direction++) {
            if (!((mask >> direction) & 1)) continue;
            const delta = STORY_HEX_WORLD_NEIGHBOR_DIRECTIONS[direction];
            const neighbor = storyHexWorldIndex(world, q + delta[0], r + delta[1]);
            if (neighbor >= 0 && neighbor < index) continue;
            const edge = STORY_HEX_POLITICAL_EDGE_CORNERS[direction];
            context.moveTo(corners[edge[0]].x * model.scaleX, corners[edge[0]].y * model.scaleY);
            context.lineTo(corners[edge[1]].x * model.scaleX, corners[edge[1]].y * model.scaleY);
            drawnBorderEdges++;
        }
    }
    // V2 sınırı bu rastera gömmez. Raster çizgisi yakın zoomda kaynak ölçeğiyle
    // birlikte büyüyüp arazi yükseltisi gibi 10px'lik koyu duvara dönüşüyordu.
    // Canlı sınır aşağıdaki ekran-uzayı çizicisinde sabit kalınlıkla çizilir.
    if (typeof storyMapV2Enabled !== 'function' || !storyMapV2Enabled()) context.stroke();
    context.restore();
    const finished = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    STORY._hexOwnerCache = canvas;
    STORY._hexOwnerKey = model.renderHash;
    STORY._hexOwnerOverlaySource = Object.assign({}, model, {
        ownerGroupCount: cellsByOwner.size,
        drawnBorderEdges,
        buildMs: Math.round((finished - started) * 1000) / 1000
    });
    return canvas;
}

function storyHexPoliticalBorderSegmentsEnsure() {
    if (!storyHexPoliticalOverlayEnabled()) return [];
    const world = storyHexWorldEnsure();
    const political = storyHexPoliticalViewEnsure();
    const key = `${world.layoutHash}|${political.ownershipHash}`;
    if (STORY._hexPoliticalBorderSegments
        && STORY._hexPoliticalBorderSegmentsKey === key) return STORY._hexPoliticalBorderSegments;
    const segments = [];
    for (let index = 0; index < world.cellCount; index++) {
        const mask = Number(political.nationalBorderMask[index]);
        if (!mask) continue;
        const q = Number(world.qValues[index]);
        const r = Number(world.rValues[index]);
        const corners = storyHexWorldCorners(world, q, r);
        for (let direction = 0; direction < 6; direction++) {
            if (!((mask >> direction) & 1)) continue;
            const delta = STORY_HEX_WORLD_NEIGHBOR_DIRECTIONS[direction];
            const neighbor = storyHexWorldIndex(world, q + delta[0], r + delta[1]);
            if (neighbor >= 0 && neighbor < index) continue;
            const edge = STORY_HEX_POLITICAL_EDGE_CORNERS[direction];
            segments.push({
                x1: corners[edge[0]].x / world.width,
                y1: corners[edge[0]].y / world.height,
                x2: corners[edge[1]].x / world.width,
                y2: corners[edge[1]].y / world.height
            });
        }
    }
    STORY._hexPoliticalBorderSegments = segments;
    STORY._hexPoliticalBorderSegmentsKey = key;
    return segments;
}

function storyDrawHexPoliticalBorders(ctx) {
    if (!ctx || typeof storyW2S !== 'function' || typeof STORY_WORLD_W === 'undefined') return 0;
    const segments = storyHexPoliticalBorderSegmentsEnsure();
    if (!segments.length) return 0;
    const ratio = typeof storyMapV2ZoomRatio === 'function'
        ? storyMapV2ZoomRatio(storyCam, STORY._minZoom || storyCam.zoom) : 1;
    const outer = Math.min(2.8, 1.45 + Math.log2(Math.max(1, ratio)) * .22);
    let visible = 0;
    const drawPath = countVisible => {
        ctx.beginPath();
        for (const segment of segments) {
            const a = storyW2S(segment.x1 * STORY_WORLD_W, segment.y1 * STORY_WORLD_H);
            const b = storyW2S(segment.x2 * STORY_WORLD_W, segment.y2 * STORY_WORLD_H);
            if ((a.x < -6 && b.x < -6) || (a.x > STORY._cw + 6 && b.x > STORY._cw + 6)
                || (a.y < -6 && b.y < -6) || (a.y > STORY._ch + 6 && b.y > STORY._ch + 6)) continue;
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            if (countVisible) visible++;
        }
    };
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    drawPath(true); ctx.strokeStyle = 'rgba(20,18,13,.66)'; ctx.lineWidth = outer; ctx.stroke();
    drawPath(false); ctx.strokeStyle = 'rgba(220,181,78,.34)'; ctx.lineWidth = .7; ctx.stroke();
    ctx.restore();
    STORY._hexPoliticalBorderDiagnostics = { total: segments.length, visible,
        outerPx: Math.round(outer * 100) / 100 };
    return visible;
}

function storyHexPoliticalOverlayDiagnostics() {
    return STORY._hexOwnerOverlaySource
        ? Object.assign({ disabled: false }, STORY._hexOwnerOverlaySource)
        : { adapterVersion: STORY_HEX_POLITICAL_OVERLAY_ADAPTER_VERSION, disabled: !storyHexPoliticalOverlayEnabled() };
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
    const hexPolitical = typeof storyHexPoliticalViewEnsure === 'function'
        ? (nodes === STORY.nodes
            ? storyHexPoliticalViewEnsure()
            : storyHexPoliticalViewCreate({
                world: storyHexWorldEnsure(),
                model: storyHexRegionsEnsure(),
                nodes,
                loadMode: 'overlay-input'
            }))
        : null;
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
        hexMembershipHash: hexPolitical ? hexPolitical.membershipHash : null,
        hexOwnershipHash: hexPolitical ? hexPolitical.ownershipHash : null,
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
    if (typeof storyHexPoliticalViewEnsure === 'function') {
        const hexPolitical = nodes === STORY.nodes
            ? storyHexPoliticalViewEnsure()
            : storyHexPoliticalViewCreate({
                world: storyHexWorldEnsure(),
                model: storyHexRegionsEnsure(),
                nodes,
                loadMode: 'overlay-validation'
            });
        if (overlay.hexMembershipHash !== hexPolitical.membershipHash) {
            add('HEX_MEMBERSHIP_HASH_MISMATCH', '$.hexMembershipHash', 'Politik overlay güncel altıgen üyeliğine bağlı değil.');
        }
        if (overlay.hexOwnershipHash !== hexPolitical.ownershipHash) {
            add('HEX_OWNERSHIP_HASH_MISMATCH', '$.hexOwnershipHash', 'Politik overlay güncel altıgen sahipliğine bağlı değil.');
        }
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
        hexMembershipHash: overlay.hexMembershipHash,
        hexOwnershipHash: overlay.hexOwnershipHash,
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
