// STORY MAP RENDERER V2
// ---------------------
// Flat, top-down map projection and monotonic settlement LOD.
// The legacy 2.5D strip-warp remains in StoryRender.js as a rollback path;
// this module is the default map infrastructure and deliberately reuses all
// existing terrain / settlement / maritime atlases.
(function (root) {
    'use strict';

    const CONFIG = Object.freeze({
        version: 'story-map-v2-flat-world-2',
        maxZoom: 5,
        overviewRatio: 1.55,
        minorVisibleRatio: 1,
        // Keep authored pixel texture crisp through regional zoom. Smoothing is
        // reserved for extreme inspection zoom where source pixels would become
        // visibly larger than the art's intended pixel scale.
        smoothTerrainRatio: 4,
        settlementBasePx: Object.freeze({ 1: 10, 2: 24, 3: 34 }),
        settlementMaxPx: Object.freeze({ 1: 30, 2: 70, 3: 108 })
    });

    const RURAL_VARIANTS = Object.freeze({
        temperate: Object.freeze([0, 1, 2, 4, 5, 6, 9, 10, 12, 13]),
        mediterranean: Object.freeze([0, 1, 3, 5, 7, 8, 10, 11, 13, 14]),
        dry: Object.freeze([3, 8, 9, 14, 15])
    });

    function enabled() {
        // Explicit local rollback for visual comparison/debugging.
        try { return root.localStorage.getItem('story.map.renderer') !== 'legacy-warp'; }
        catch (_) { return true; }
    }

    function minZoom(width, height, worldWidth, worldHeight) {
        const w = Math.max(1, Number(width) || 1);
        const h = Math.max(1, Number(height) || 1);
        const ww = Math.max(1, Number(worldWidth) || 1);
        const wh = Math.max(1, Number(worldHeight) || 1);
        // Keep the current fill-first framing. Projection itself is now flat;
        // no hidden perspective width multiplier participates in this value.
        return Math.max(w / (ww * 1.12), h / (wh * 1.06));
    }

    function zoomRatio(cam, minimum) {
        return Math.max(1, (Number(cam && cam.zoom) || 1) / Math.max(.0001, Number(minimum) || 1));
    }

    function worldToScreen(wx, wy, cam) {
        const z = Math.max(.0001, Number(cam.zoom) || 1);
        const viewportH = (typeof STORY !== 'undefined' && STORY && Number(STORY._ch)) || 600;
        return {
            x: (Number(wx) - Number(cam.x || 0)) * z,
            y: (Number(wy) - Number(cam.y || 0)) * z,
            u: ((Number(wy) - Number(cam.y || 0)) * z) / Math.max(1, viewportH)
        };
    }

    function screenToWorld(x, y, cam) {
        const z = Math.max(.0001, Number(cam.zoom) || 1);
        return { x: Number(cam.x || 0) + Number(x) / z, y: Number(cam.y || 0) + Number(y) / z };
    }

    function clampCamera(cam, width, height, worldWidth, worldHeight) {
        const minimum = minZoom(width, height, worldWidth, worldHeight);
        cam.zoom = Math.max(minimum, Math.min(CONFIG.maxZoom, Number(cam.zoom) || minimum));
        const visibleW = Number(width) / cam.zoom;
        const visibleH = Number(height) / cam.zoom;
        if (visibleW >= worldWidth) cam.x = (worldWidth - visibleW) / 2;
        else cam.x = Math.max(-visibleW * .04, Math.min(worldWidth - visibleW * .96, Number(cam.x) || 0));
        if (visibleH >= worldHeight) cam.y = (worldHeight - visibleH) / 2;
        else cam.y = Math.max(-visibleH * .04, Math.min(worldHeight - visibleH * .96, Number(cam.y) || 0));
        return minimum;
    }

    function centerCamera(cam, wx, wy, width, height) {
        const z = Math.max(.0001, Number(cam.zoom) || 1);
        cam.x = Number(wx) - Number(width) / (2 * z);
        cam.y = Number(wy) - Number(height) / (2 * z);
    }

    function blit(ctx, source, alpha, cam, width, height, worldWidth, worldHeight) {
        if (!ctx || !source || !(source.width > 0) || !(source.height > 0)) return false;
        const z = Math.max(.0001, Number(cam.zoom) || 1);
        const kx = source.width / worldWidth;
        const ky = source.height / worldHeight;
        ctx.save();
        ctx.imageSmoothingEnabled = zoomRatio(cam,
            (typeof STORY !== 'undefined' && STORY && STORY._minZoom) || cam.zoom) >= CONFIG.smoothTerrainRatio;
        if (ctx.imageSmoothingEnabled) ctx.imageSmoothingQuality = 'high';
        if (alpha != null) ctx.globalAlpha = alpha;
        ctx.drawImage(source,
            cam.x * kx, cam.y * ky,
            (width / z) * kx, (height / z) * ky,
            0, 0, width, height);
        ctx.restore();
        return true;
    }

    function settlementMetrics(node, options) {
        const opts = options || {};
        const level = Math.max(1, Math.min(3, Number(node && node.level) | 0 || 1));
        const ratio = zoomRatio(opts.cam, opts.minZoom);
        const important = !!(opts.commander || opts.selected || opts.actionable || level >= 2);
        if (level === 1 && ratio < CONFIG.minorVisibleRatio && !important) return { hidden: true, level, ratio, size: 0, half: 0 };
        // One monotonic curve replaces the old far/near size switch. At every
        // zoom step size can only stay equal or grow; it can never pop smaller.
        // Capitals must already read as urban anchors in overview, while the
        // gentler exponent prevents them from exploding at regional zoom.
        const growth = Math.pow(ratio, .58);
        const size = Math.round(Math.min(CONFIG.settlementMaxPx[level], CONFIG.settlementBasePx[level] * growth));
        return { hidden: false, level, ratio, size: Math.max(5, size), half: Math.max(3, Math.round(size * .31)) };
    }

    function ruralMetrics(ratio) {
        const r = Math.max(1, Number(ratio) || 1);
        const local = r >= 8;
        return {
            // Overview/regional LOD uses broad terrain habitats. Only local LOD
            // reveals authored farms and hamlets, preventing polka-dot villages.
            local,
            cellWorld: local ? 60 : r < 1.6 ? 90 : 50,
            sizePx: Math.round(local ? Math.min(122, 82 + Math.pow(r - 7, .54) * 15)
                : Math.min(120, 78 + Math.pow(r, .48) * 14)),
            alpha: local ? .78 : (r < 1.6 ? .38 : .48),
            density: local ? .34 : (r < 1.6 ? .84 : .72)
        };
    }

    function ruralHash(x, y) {
        if (typeof storyHash === 'function') return storyHash(x, y);
        let h = ((x | 0) * 73856093) ^ ((y | 0) * 19349663);
        h = (h ^ (h >>> 13)) >>> 0;
        return (h % 1024) / 1024;
    }

    function ruralNearStrategicNode(wx, wy, radius) {
        if (typeof STORY === 'undefined' || !STORY || !Array.isArray(STORY.nodes)) return false;
        const rr = radius * radius;
        for (const node of STORY.nodes) {
            if (!node || !Number.isFinite(Number(node.lx)) || !Number.isFinite(Number(node.ly))) continue;
            const dx = Number(node.lx) * STORY_WORLD_W - wx;
            const dy = Number(node.ly) * STORY_WORLD_H - wy;
            if (dx * dx + dy * dy < rr) return true;
        }
        return false;
    }

    function ruralOnLand(raster, wx, wy, footprint) {
        const nx = wx / STORY_WORLD_W, ny = wy / STORY_WORLD_H;
        const fx = footprint / STORY_WORLD_W, fy = footprint / STORY_WORLD_H;
        const points = [[0, 0], [-fx, 0], [fx, 0], [0, -fy], [0, fy]];
        for (const point of points) {
            if (!storyMapRasterSample(raster, nx + point[0], ny + point[1]).land) return false;
        }
        return true;
    }

    function drawRuralEnvironment(ctx) {
        if (!ctx || typeof STORY === 'undefined' || typeof storyMapAtlasEnsure !== 'function'
            || typeof storyMapAtlasReady !== 'function' || !storyMapAtlasReady('ruralEnvironment')
            || typeof storyMapRasterEnsure !== 'function' || typeof storyMapRasterSample !== 'function') return 0;
        const atlases = storyMapAtlasEnsure();
        const atlas = atlases.ruralEnvironment;
        const terrainAtlas = atlases.terrainDetail;
        const forestAtlas = atlases.forests;
        const raster = storyMapRasterEnsure();
        if (!atlas || !atlas.ready || !raster) return 0;

        const ratio = zoomRatio(storyCam, STORY._minZoom || storyCam.zoom);
        const metrics = ruralMetrics(ratio);
        const cellWorld = metrics.cellWorld;
        const visibleW = STORY._cw / storyCam.zoom;
        const visibleH = STORY._ch / storyCam.zoom;
        const x0 = Math.floor(storyCam.x / cellWorld) - 1;
        const y0 = Math.floor(storyCam.y / cellWorld) - 1;
        const x1 = Math.ceil((storyCam.x + visibleW) / cellWorld) + 1;
        const y1 = Math.ceil((storyCam.y + visibleH) / cellWorld) + 1;
        let drawn = 0;

        ctx.save();
        const mapTopLeft = worldToScreen(0, 0, storyCam);
        const mapBottomRight = worldToScreen(STORY_WORLD_W, STORY_WORLD_H, storyCam);
        ctx.beginPath();
        ctx.rect(Math.max(0, mapTopLeft.x), Math.max(0, mapTopLeft.y),
            Math.min(STORY._cw, mapBottomRight.x) - Math.max(0, mapTopLeft.x),
            Math.min(STORY._ch, mapBottomRight.y) - Math.max(0, mapTopLeft.y));
        ctx.clip();
        ctx.imageSmoothingEnabled = false;
        for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
            const jitterX = (ruralHash(gx + 43, gy + 719) - .5) * cellWorld * .54;
            const jitterY = (ruralHash(gx + 827, gy + 113) - .5) * cellWorld * .44;
            const wx = (gx + .5) * cellWorld + jitterX;
            const wy = (gy + .5) * cellWorld + jitterY;
            if (wx < 0 || wy < 0 || wx >= STORY_WORLD_W || wy >= STORY_WORLD_H) continue;
            const ny = wy / STORY_WORLD_H;
            // Broad, deterministic habitat belts. This is deliberately smooth
            // rather than per-cell noise, so the atlas reads as forests/fields
            // with clearings instead of a uniform grid of decorative dots.
            const regional = Math.max(0, Math.min(1, .5
                + Math.sin(wx * .0047) * .16
                + Math.sin(wy * .0053) * .13
                + Math.sin((wx + wy) * .0021) * .11));
            const biomeDensity = ny > .72 ? .18 : ny > .53 ? .76 : .90;
            const regionalWeight = .45 + regional * .75;
            if (ruralHash(gx + 211, gy + 977) > metrics.density * biomeDensity * regionalWeight
                || (ny > .72 && regional < .55)) continue;
            const footprint = Math.max(22, metrics.sizePx / storyCam.zoom * .24);
            if (!ruralOnLand(raster, wx, wy, footprint)
                || ruralNearStrategicNode(wx, wy, Math.max(48, footprint * 1.5))) continue;

            let drawAtlas = atlas, cell;
            const forestRoll = ruralHash(gx + 1877, gy + 421);
            const forested = ny < .53
                ? (regional > .48 || forestRoll > .68)
                : (regional > .62 && forestRoll > .72);
            if (!metrics.local && forested && forestAtlas && forestAtlas.ready) {
                drawAtlas = forestAtlas;
                const row = ny > .53 ? 1 : (regional > .70 ? 0 : 2);
                cell = row * 4 + Math.floor(ruralHash(gx + 1301, gy + 367) * 4);
            } else if (!metrics.local && terrainAtlas && terrainAtlas.ready) {
                drawAtlas = terrainAtlas;
                const row = ny > .72 ? 3 : ny > .53 ? 2 : (regional > .57 ? 0 : 1);
                cell = row * 4 + Math.floor(ruralHash(gx + 1301, gy + 367) * 4);
            } else {
                const variants = ny > .72 ? RURAL_VARIANTS.dry
                    : ny > .53 ? RURAL_VARIANTS.mediterranean : RURAL_VARIANTS.temperate;
                const pick = Math.min(variants.length - 1,
                    Math.floor(ruralHash(gx + 1301, gy + 367) * variants.length));
                cell = variants[pick];
            }
            const sourceW = drawAtlas.img.naturalWidth / drawAtlas.cols;
            const sourceH = drawAtlas.img.naturalHeight / drawAtlas.rows;
            const col = cell % drawAtlas.cols, row = Math.floor(cell / drawAtlas.cols);
            const point = worldToScreen(wx, wy, storyCam);
            const size = metrics.sizePx * (.88 + ruralHash(gx + 59, gy + 1601) * .28);
            const aspect = metrics.local ? (.88 + ruralHash(gx + 233, gy + 811) * .24)
                : (.82 + ruralHash(gx + 233, gy + 811) * .50);
            const drawW = size * aspect, drawH = size * (metrics.local ? .90 : .78);
            if (point.x < -drawW || point.y < -drawH || point.x > STORY._cw + drawW || point.y > STORY._ch + drawH) continue;

            ctx.globalAlpha = metrics.alpha * (.88 + ruralHash(gx + 401, gy + 271) * .12);
            ctx.save();
            ctx.translate(Math.round(point.x), Math.round(point.y));
            if (ruralHash(gx + 101, gy + 1201) > .5) ctx.scale(-1, 1);
            ctx.drawImage(drawAtlas.img, col * sourceW, row * sourceH, sourceW, sourceH,
                Math.round(-drawW / 2), Math.round(-drawH / 2), Math.round(drawW), Math.round(drawH));
            ctx.restore();
            drawn++;
        }
        ctx.restore();
        STORY._mapV2RuralEnvironment = {
            drawn,
            ratio: Math.round(ratio * 100) / 100,
            sizePx: metrics.sizePx,
            cellWorld
        };
        return drawn;
    }

    function drawGroundDetail(ctx) {
        if (!ctx || typeof storyMapAtlasEnsure !== 'function' || typeof storyMapRasterEnsure !== 'function'
            || typeof storyMapRasterSample !== 'function' || typeof STORY === 'undefined') return 0;
        const ratio = zoomRatio(storyCam, STORY._minZoom || storyCam.zoom);
        if (ratio < 4.6 || typeof storyMapAtlasReady !== 'function' || !storyMapAtlasReady('groundDetail')) return 0;
        const atlas = storyMapAtlasEnsure().groundDetail;
        const raster = storyMapRasterEnsure();
        if (!atlas || !atlas.ready || !raster) return 0;
        const tileWorld = 112;
        const sw = atlas.img.naturalWidth / atlas.cols;
        const sh = atlas.img.naturalHeight / atlas.rows;
        const localDetail = ratio >= 8;
        const alpha = localDetail
            ? Math.min(.76, .64 + (ratio - 8) * .018)
            : Math.min(.28, .14 + (ratio - 4.6) * .024);
        let layer = STORY._mapV2GroundLayer;
        if (!layer || layer.width !== STORY._cw || layer.height !== STORY._ch) {
            layer = document.createElement('canvas'); layer.width = STORY._cw; layer.height = STORY._ch;
            STORY._mapV2GroundLayer = layer;
        }
        let mask = STORY._mapV2LandMask;
        if (!mask || STORY._mapV2LandMaskRaster !== raster) {
            mask = document.createElement('canvas'); mask.width = raster.width; mask.height = raster.height;
            const mg = mask.getContext('2d'), image = mg.createImageData(raster.width, raster.height);
            for (let i = 0; i < raster.landMask.length; i++) {
                const k = i * 4, a = raster.landMask[i] ? 255 : 0;
                image.data[k] = image.data[k + 1] = image.data[k + 2] = 255; image.data[k + 3] = a;
            }
            mg.putImageData(image, 0, 0);
            STORY._mapV2LandMask = mask; STORY._mapV2LandMaskRaster = raster;
        }
        const dg = layer.getContext('2d');
        dg.clearRect(0, 0, layer.width, layer.height);
        dg.imageSmoothingEnabled = true; dg.imageSmoothingQuality = 'high';
        let drawn = 0;
        // Two half-offset passes feather cell boundaries without inventing new
        // art. The canonical land mask is applied afterwards in one operation.
        for (let pass = 0; pass < 2; pass++) {
            const offset = pass ? -tileWorld * .5 : 0;
            const x0 = Math.floor((storyCam.x - offset) / tileWorld) - 1;
            const y0 = Math.floor((storyCam.y - offset) / tileWorld) - 1;
            const x1 = Math.ceil((storyCam.x + STORY._cw / storyCam.zoom - offset) / tileWorld) + 1;
            const y1 = Math.ceil((storyCam.y + STORY._ch / storyCam.zoom - offset) / tileWorld) + 1;
            dg.globalAlpha = pass ? .36 : .76;
            for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
                const wx = gx * tileWorld + offset, wy = gy * tileWorld + offset;
                if (wx + tileWorld <= 0 || wy + tileWorld <= 0 || wx >= STORY_WORLD_W || wy >= STORY_WORLD_H) continue;
                const ny = (wy + tileWorld * .5) / STORY_WORLD_H;
                const h = typeof storyHash === 'function'
                    ? storyHash(gx * 97 + 31 + pass * 719, gy * 131 + 17 + pass * 313)
                    : ((gx * 17 + gy * 31 + pass * 19) & 255) / 255;
                const row = ny > .68 ? (h > .55 ? 3 : 2) : (h > .58 ? 1 : 0);
                const col = Math.min(3, Math.floor(h * 4));
                const s = worldToScreen(wx, wy, storyCam);
                const dw = tileWorld * storyCam.zoom + 1.5;
                const dh = tileWorld * storyCam.zoom + 1.5;
                dg.drawImage(atlas.img, col * sw, row * sh, sw, sh,
                    Math.floor(s.x), Math.floor(s.y), Math.ceil(dw), Math.ceil(dh));
                drawn++;
            }
        }
        dg.globalAlpha = 1;
        dg.globalCompositeOperation = 'destination-in';
        blit(dg, mask, 1, storyCam, STORY._cw, STORY._ch, STORY_WORLD_W, STORY_WORLD_H);
        dg.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation = 'soft-light';
        ctx.drawImage(layer, 0, 0);
        ctx.restore();
        STORY._mapV2GroundDetail = { drawn, ratio: Math.round(ratio * 100) / 100, alpha };
        return drawn;
    }

    root.STORY_MAP_RENDERER_V2 = CONFIG;
    root.storyMapV2Enabled = enabled;
    root.storyMapV2MinZoom = minZoom;
    root.storyMapV2ZoomRatio = zoomRatio;
    root.storyMapV2WorldToScreen = worldToScreen;
    root.storyMapV2ScreenToWorld = screenToWorld;
    root.storyMapV2ClampCamera = clampCamera;
    root.storyMapV2CenterCamera = centerCamera;
    root.storyMapV2Blit = blit;
    root.storyMapV2SettlementMetrics = settlementMetrics;
    root.storyMapV2RuralMetrics = ruralMetrics;
    root.storyMapV2DrawRuralEnvironment = drawRuralEnvironment;
    root.storyMapV2DrawGroundDetail = drawGroundDetail;
})(typeof window !== 'undefined' ? window : globalThis);
