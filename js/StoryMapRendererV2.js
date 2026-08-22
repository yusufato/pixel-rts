// STORY MAP RENDERER V2
// ---------------------
// Flat, top-down map projection and monotonic settlement LOD.
// The legacy 2.5D strip-warp remains in StoryRender.js as a rollback path;
// this module is the default map infrastructure and deliberately reuses all
// existing terrain / settlement / maritime atlases.
(function (root) {
    'use strict';

    const CONFIG = Object.freeze({
        version: 'story-map-v2-flat-world-7-authored-surface',
        maxZoom: 7.5,
        presentationScale: 1.5,
        overviewRatio: 1.55,
        minorVisibleRatio: 1,
        // Keep authored pixel texture crisp through regional zoom. Smoothing is
        // reserved for extreme inspection zoom where source pixels would become
        // visibly larger than the art's intended pixel scale.
        smoothTerrainRatio: 4,
        // Civilization-style contract: city art owns a fixed physical footprint
        // in world units. Camera zoom is the only scale operation; no LOD curve
        // may secretly enlarge or shrink the city relative to its hex.
        settlementWorldSize: Object.freeze({ 1: 13, 2: 21, 3: 30 }),
        // District art must be legible inside a 27.9 world-unit wide hex. The
        // previous 10/12 values occupied roughly one third of the cell and read
        // as noise. These remain below their 19/27 city cores while filling
        // about 57–65% of the hex width at every camera zoom.
        districtWorldSize: Object.freeze({ 2: 19, 3: 22 }),
        // Raster density is independent from physical footprint. Districts keep
        // the same hex size while their persistent art uses 2x more pixels.
        districtRasterScale: 8,
        // Ports follow the same physical-object contract as cities. Their
        // world footprint never switches at an arbitrary LOD threshold.
        portWorldSize: Object.freeze({ 2: 8, 3: 10 }),
        // Ports leave the 0.5x road layer and use a dedicated 4x layer: 8x the
        // former linear density without inflating the complete road network.
        portRasterScale: 4,
        // Road/rail vectors used to be downsampled to 0.5x before entering RAM.
        // That converted continuous curves into square dotted chains at local
        // zoom. One world pixel per world unit is the minimum acceptable mip.
        networkRasterScale: 1,
        // One high-resolution world surface replaces the low-resolution
        // screen-space ground pass that used to rebuild on every camera frame.
        hexSurfaceScale: 2
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
        return Math.max(w / (ww * 1.12), h / (wh * 1.06))
            * CONFIG.presentationScale;
    }

    function zoomRatio(cam, minimum) {
        return Math.max(1, (Number(cam && cam.zoom) || 1) / Math.max(.0001, Number(minimum) || 1));
    }

    function visualZoomBand(cam, minimum) {
        const ratio = zoomRatio(cam, minimum);
        if (ratio < 1.55) return 'OVERVIEW';
        if (ratio < 3.4) return 'REGIONAL';
        if (ratio < 8) return 'DISTRICT';
        return 'LOCAL';
    }

    function cameraBucket(cam, width, height) {
        const zoom = Math.max(.0001, Number(cam && cam.zoom) || 1);
        const centerX = Number(cam && cam.x || 0) + Number(width || 0) / (2 * zoom);
        const centerY = Number(cam && cam.y || 0) + Number(height || 0) / (2 * zoom);
        const span = 360;
        return `${Math.floor(centerX / span)}:${Math.floor(centerY / span)}`;
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
        const level = Math.max(1, Math.min(3,
            Number(opts.visualLevel == null ? node && node.level : opts.visualLevel) | 0 || 1));
        const ratio = zoomRatio(opts.cam, opts.minZoom);
        const important = !!(opts.commander || opts.selected || opts.actionable || level >= 2);
        if (level === 1 && ratio < CONFIG.minorVisibleRatio && !important) return { hidden: true, level, ratio, size: 0, half: 0 };
        const worldSize = CONFIG.settlementWorldSize[level];
        const size = worldSize * Math.max(.0001, Number(opts.cam && opts.cam.zoom) || 1);
        return { hidden: false, level, ratio, worldSize, size,
            half: Math.max(1.5, size * .31) };
    }

    function settlementDistrictMetrics(node, options) {
        const opts = options || {};
        const level = Math.max(1, Math.min(3,
            Number(opts.visualLevel == null ? node && node.level : opts.visualLevel) | 0 || 1));
        const ratio = zoomRatio(opts.cam, opts.minZoom);
        if (level < 2 || ratio < 2.2) return { visible: false, level, ratio, count: 0, spreadPx: 0, sizePx: 0 };
        const count = level >= 3 ? Math.min(8, 4 + Math.floor(Math.log2(ratio))) : 3;
        const worldSize = CONFIG.districtWorldSize[level >= 3 ? 3 : 2];
        return {
            visible: true,
            level,
            ratio,
            count,
            worldSize,
            spreadPx: (level >= 3 ? 25 : 20) * Math.max(.0001, Number(opts.cam && opts.cam.zoom) || 1),
            sizePx: worldSize * Math.max(.0001, Number(opts.cam && opts.cam.zoom) || 1)
        };
    }

    function portMetrics(level, options) {
        const opts = options || {};
        const tier = Math.max(2, Math.min(3, Number(level) | 0 || 2));
        const worldSize = CONFIG.portWorldSize[tier];
        const size = worldSize * Math.max(.0001, Number(opts.cam && opts.cam.zoom) || 1);
        return { tier, worldSize, size };
    }

    function ruralMetrics(ratio) {
        const r = Math.max(1, Number(ratio) || 1);
        const local = r >= 8;
        const overview = r < 1.6;
        return {
            // Keep roughly the same screen-space rhythm at regional/local LOD.
            // The old 58/54 world-unit grid expanded to 128–240 screen pixels,
            // exposing every atlas cell as an isolated circular stamp.
            local,
            cellWorld: overview ? 96 : local ? 14 : 20,
            // Overview receives broad habitat masses. Regional LOD replaces
            // them with smaller overlapping fragments; local LOD switches to
            // farms/hamlets without allowing scenery to rival a capital icon.
            sizePx: Math.round(overview ? 74 : local ? Math.min(66, 59 + Math.log2(r / 8 + 1) * 4) : 58),
            alpha: overview ? .30 : local ? .19 : .24,
            density: overview ? .78 : local ? .50 : .44
        };
    }

    function ruralHash(x, y) {
        if (typeof storyHash === 'function') return storyHash(x, y);
        let h = ((x | 0) * 73856093) ^ ((y | 0) * 19349663);
        h = (h ^ (h >>> 13)) >>> 0;
        return (h % 1024) / 1024;
    }

    function coastlineMetrics(ratio) {
        const r = Math.max(1, Number(ratio) || 1);
        const coastPx = Math.min(2.7, 1.15 + Math.log2(r) * .34);
        return {
            coastPx,
            shadowPx: coastPx + 1.65,
            foamPx: Math.min(1.45, .72 + Math.log2(r) * .16),
            foamOffsetPx: Math.min(3.1, 1.25 + Math.log2(r) * .38),
            foamAlpha: Math.min(.68, .34 + Math.log2(r) * .08),
            dashPx: r < 1.7 ? [3, 5] : [5, 7]
        };
    }

    function mountainPlacements(range, scale, rangeIndex) {
        const points = range && Array.isArray(range.pts) ? range.pts : [];
        const f = Math.max(.01, Number(scale) || 1);
        const strength = Math.min(1, Math.max(.2, Number(range && range.str) || .5));
        const baseSize = (52 + strength * 25) * (f / .9) * .62;
        const placements = [];
        for (let index = 0; index + 1 < points.length; index++) {
            const a = points[index], b = points[index + 1];
            const ax = Number(a[0]) * f, ay = Number(a[1]) * f;
            const bx = Number(b[0]) * f, by = Number(b[1]) * f;
            const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy);
            if (!(length > .1)) continue;
            const count = Math.max(1, Math.ceil(length / Math.max(17, baseSize * .45)));
            const nx = -dy / length, ny = dx / length;
            const tangent = Math.atan2(dy, dx);
            for (let part = 0; part < count; part++) {
                const t = (part + .5) / count;
                const h1 = ruralHash((rangeIndex | 0) * 701 + index * 43 + part * 17, 1901);
                const h2 = ruralHash((rangeIndex | 0) * 313 + index * 79 + part * 29, 811);
                const size = baseSize * (.86 + h1 * .25);
                const lateral = (h2 - .5) * size * .13;
                placements.push({
                    x: ax + dx * t + nx * lateral,
                    y: ay + dy * t + ny * lateral,
                    size,
                    // Keep peaks upright; tangent only adds restrained chain
                    // flow instead of tipping a whole mountain on its side.
                    rotation: Math.max(-.18, Math.min(.18, Math.sin(tangent) * .12 + (h1 - .5) * .06)),
                    flipX: h2 > .5,
                    segment: index,
                    part
                });
            }
        }
        return placements;
    }

    function roadControlPoints(a, b, seed) {
        const start = { x: Number(a && a.x) || 0, y: Number(a && a.y) || 0 };
        const end = { x: Number(b && b.x) || 0, y: Number(b && b.y) || 0 };
        const dx = end.x - start.x, dy = end.y - start.y;
        const length = Math.max(1, Math.hypot(dx, dy));
        const nx = -dy / length, ny = dx / length;
        const direction = ruralHash((seed | 0) * 47 + 13, 409) > .5 ? 1 : -1;
        const bend = Math.min(28, length * (.038 + ruralHash((seed | 0) * 71 + 7, 811) * .025));
        const points = [start];
        for (let index = 1; index <= 3; index++) {
            const t = index / 4;
            const wave = Math.sin(Math.PI * t) * bend * direction
                + Math.sin(Math.PI * 2 * t) * bend * .22
                    * (ruralHash((seed | 0) * 101 + index * 19, 1201) > .5 ? 1 : -1);
            points.push({ x: start.x + dx * t + nx * wave, y: start.y + dy * t + ny * wave });
        }
        points.push(end);
        return points;
    }

    function traceRoundedPath(ctx, points) {
        if (!ctx || !Array.isArray(points) || points.length < 2) return false;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let index = 1; index < points.length - 1; index++) {
            const point = points[index], next = points[index + 1];
            ctx.quadraticCurveTo(point.x, point.y, (point.x + next.x) * .5, (point.y + next.y) * .5);
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        return true;
    }

    // Build one canonical coastline from the shared land mask. Horizontal and
    // vertical runs are merged so the live renderer draws a few long paths,
    // not one operation per raster pixel. nx/ny always points from land to sea
    // and is later used to place the pale foam on the water side.
    function buildCoastSegments(raster) {
        if (!raster || !(raster.width > 0) || !(raster.height > 0) || !raster.landMask) return [];
        const width = raster.width | 0, height = raster.height | 0;
        const mask = raster.landMask;
        const land = (x, y) => x >= 0 && y >= 0 && x < width && y < height
            ? !!mask[y * width + x] : false;
        const segments = [];
        const appendRun = (horizontal, fixed, from, to, nx, ny) => {
            if (to <= from) return;
            segments.push(horizontal
                ? { x1: from / width, y1: fixed / height, x2: to / width, y2: fixed / height, nx, ny }
                : { x1: fixed / width, y1: from / height, x2: fixed / width, y2: to / height, nx, ny });
        };

        for (let y = 0; y <= height; y++) {
            let start = -1, runNy = 0;
            for (let x = 0; x <= width; x++) {
                const above = x < width && land(x, y - 1);
                const below = x < width && land(x, y);
                const ny = above === below ? 0 : (above ? 1 : -1);
                if (ny !== runNy) {
                    if (runNy) appendRun(true, y, start, x, 0, runNy);
                    start = ny ? x : -1;
                    runNy = ny;
                }
            }
        }
        for (let x = 0; x <= width; x++) {
            let start = -1, runNx = 0;
            for (let y = 0; y <= height; y++) {
                const left = y < height && land(x - 1, y);
                const right = y < height && land(x, y);
                const nx = left === right ? 0 : (left ? 1 : -1);
                if (nx !== runNx) {
                    if (runNx) appendRun(false, x, start, y, runNx, 0);
                    start = nx ? y : -1;
                    runNx = nx;
                }
            }
        }
        return segments;
    }

    function buildCoastContours(raster) {
        if (!raster || !(raster.width > 0) || !(raster.height > 0) || !raster.landMask) return [];
        const width = raster.width | 0, height = raster.height | 0;
        const mask = raster.landMask;
        const land = (x, y) => x >= 0 && y >= 0 && x < width && y < height
            ? !!mask[y * width + x] : false;
        const outgoing = new Map();
        const add = (x1, y1, x2, y2) => {
            const key = `${x1},${y1}`;
            const edge = { x1, y1, x2, y2, used: false };
            if (!outgoing.has(key)) outgoing.set(key, []);
            outgoing.get(key).push(edge);
        };
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            if (!land(x, y)) continue;
            // Clockwise screen-space winding: sea stays on the right side.
            if (!land(x, y - 1)) add(x, y, x + 1, y);
            if (!land(x + 1, y)) add(x + 1, y, x + 1, y + 1);
            if (!land(x, y + 1)) add(x + 1, y + 1, x, y + 1);
            if (!land(x - 1, y)) add(x, y + 1, x, y);
        }
        const contours = [];
        for (const edges of outgoing.values()) for (const first of edges) {
            if (first.used) continue;
            const points = [{ x: first.x1 / width, y: first.y1 / height }];
            let edge = first;
            const startKey = `${first.x1},${first.y1}`;
            let closed = false;
            let guard = 0;
            while (edge && !edge.used && guard++ <= mask.length * 4) {
                edge.used = true;
                points.push({ x: edge.x2 / width, y: edge.y2 / height });
                const key = `${edge.x2},${edge.y2}`;
                if (key === startKey) { closed = true; break; }
                const next = (outgoing.get(key) || []).filter(candidate => !candidate.used);
                if (next.length <= 1) edge = next[0] || null;
                else {
                    // Diagonally touching islands share a raster vertex. Keep
                    // the sea on the right by taking the strongest right turn;
                    // otherwise two islands can collapse into a figure-eight.
                    const inX = edge.x2 - edge.x1, inY = edge.y2 - edge.y1;
                    edge = next.slice().sort((a, b) => {
                        const ax = a.x2 - a.x1, ay = a.y2 - a.y1;
                        const bx = b.x2 - b.x1, by = b.y2 - b.y1;
                        const aa = Math.atan2(inX * ay - inY * ax, inX * ax + inY * ay);
                        const ba = Math.atan2(inX * by - inY * bx, inX * bx + inY * by);
                        return ba - aa;
                    })[0];
                }
            }
            if (closed && points.length >= 4) {
                const last = points[points.length - 1];
                if (last.x === points[0].x && last.y === points[0].y) points.pop();
                let minX = 1, minY = 1, maxX = 0, maxY = 0;
                for (const point of points) {
                    minX = Math.min(minX, point.x); minY = Math.min(minY, point.y);
                    maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y);
                }
                contours.push({ points, minX, minY, maxX, maxY });
            }
        }
        return contours;
    }

    function smoothCoastPath(ctx, points, offsetPx) {
        if (!points || points.length < 3) return;
        const shifted = points.map((point, index) => {
            if (!offsetPx) return point;
            const previous = points[(index + points.length - 1) % points.length];
            const next = points[(index + 1) % points.length];
            const dx = next.x - previous.x, dy = next.y - previous.y;
            const length = Math.max(.001, Math.hypot(dx, dy));
            return { x: point.x + dy / length * offsetPx, y: point.y - dx / length * offsetPx };
        });
        const first = shifted[0], last = shifted[shifted.length - 1];
        ctx.moveTo((last.x + first.x) * .5, (last.y + first.y) * .5);
        for (let index = 0; index < shifted.length; index++) {
            const current = shifted[index], next = shifted[(index + 1) % shifted.length];
            ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) * .5, (current.y + next.y) * .5);
        }
        ctx.closePath();
    }

    function smoothCoastPoints(points) {
        if (!Array.isArray(points) || points.length < 12) return points || [];
        let result = points.map(point => ({ x: point.x, y: point.y }));
        // Two conservative circular low-pass passes remove the raster's visible
        // one-cell staircase while staying inside roughly one source cell of
        // the canonical mask. Small islands are deliberately left untouched.
        for (let pass = 0; pass < 2; pass++) {
            result = result.map((_point, index) => {
                const count = result.length;
                const a = result[(index + count - 2) % count];
                const b = result[(index + count - 1) % count];
                const c = result[index];
                const d = result[(index + 1) % count];
                const e = result[(index + 2) % count];
                return {
                    x: (a.x + b.x * 2 + c.x * 4 + d.x * 2 + e.x) / 10,
                    y: (a.y + b.y * 2 + c.y * 4 + d.y * 2 + e.y) / 10
                };
            });
        }
        return result;
    }

    function drawCoastline(ctx) {
        if (!ctx || typeof STORY === 'undefined' || typeof storyMapRasterEnsure !== 'function') return 0;
        const raster = storyMapRasterEnsure();
        if (!raster) return 0;
        let cache = STORY._mapV2CoastlineCache;
        if (!cache || cache.raster !== raster || cache.landHash !== raster.landHash) {
            if (cache && cache.worldLayers && typeof storyReleaseWorldRamLayer === 'function') {
                Object.values(cache.worldLayers).forEach(storyReleaseWorldRamLayer);
            }
            cache = {
                raster,
                landHash: raster.landHash,
                segments: buildCoastSegments(raster),
                contours: buildCoastContours(raster).map(contour => Object.assign({}, contour, {
                    renderPoints: smoothCoastPoints(contour.points)
                }))
            };
            STORY._mapV2CoastlineCache = cache;
        }
        const ratio = zoomRatio(storyCam, STORY._minZoom || storyCam.zoom);
        const metrics = coastlineMetrics(ratio);
        if (typeof storyCreateWorldRamLayer === 'function'
            && typeof storyDrawWorldRamLayer === 'function') {
            if (!cache.worldLayers) {
                cache.worldLayers = Object.create(null);
                const buildMode = (id, metricRatio, widthScale) => {
                    const canvas = document.createElement('canvas');
                    canvas.width = STORY_WORLD_W;
                    canvas.height = STORY_WORLD_H;
                    const paint = canvas.getContext('2d');
                    const fixed = coastlineMetrics(metricRatio);
                    const contours = cache.contours.map(contour => contour.renderPoints.map(point => ({
                        x: point.x * STORY_WORLD_W,
                        y: point.y * STORY_WORLD_H
                    })));
                    const path = offset => {
                        paint.beginPath();
                        for (const contour of contours) smoothCoastPath(paint, contour, offset);
                    };
                    paint.save();
                    paint.lineCap = 'round';
                    paint.lineJoin = 'round';
                    path(0);
                    paint.strokeStyle = 'rgba(2,25,39,0.82)';
                    paint.lineWidth = fixed.shadowPx * widthScale;
                    paint.stroke();
                    path(0);
                    paint.strokeStyle = 'rgba(222,181,77,0.88)';
                    paint.lineWidth = fixed.coastPx * widthScale;
                    paint.stroke();
                    path(fixed.foamOffsetPx * widthScale);
                    paint.setLineDash(fixed.dashPx.map(value => value * widthScale));
                    paint.lineDashOffset = -2 * widthScale;
                    paint.strokeStyle = `rgba(170,225,218,${fixed.foamAlpha})`;
                    paint.lineWidth = fixed.foamPx * widthScale;
                    paint.stroke();
                    paint.restore();
                    return storyCreateWorldRamLayer(canvas, {
                        mode: id,
                        worldScale: .5
                    });
                };
                // Overview strokes are authored at 4x world width so the
                // minimum zoom still receives a crisp one-pixel coastline.
                cache.worldLayers.OVERVIEW = buildMode('OVERVIEW', 1, 4);
                cache.worldLayers.LOCAL = buildMode('LOCAL', 4, 1);
                cache.worldBuilds = (Number(cache.worldBuilds) || 0) + 1;
                cache.worldBytes = Object.values(cache.worldLayers).reduce(
                    (sum, layer) => sum + Number(layer && layer.estimatedBytes || 0), 0);
            }
            const mode = ratio < 1.7 ? 'OVERVIEW' : 'LOCAL';
            const layer = cache.worldLayers[mode];
            const drawnTiles = storyDrawWorldRamLayer(ctx, layer);
            STORY._mapV2Coastline = {
                total: cache.segments.length,
                contours: cache.contours.length,
                visible: cache.contours.length,
                ratio: Math.round(ratio * 100) / 100,
                coastPx: Math.round(metrics.coastPx * 100) / 100,
                cached: true,
                ramResident: true,
                mode,
                builds: cache.worldBuilds,
                ramBytes: cache.worldBytes,
                tileCount: layer && layer.tiles ? layer.tiles.length : 0,
                drawnTiles
            };
            return cache.contours.length;
        }
        const screenKey = [STORY._cw, STORY._ch,
            visualZoomBand(storyCam, STORY._minZoom || storyCam.zoom),
            cameraBucket(storyCam, STORY._cw, STORY._ch), cache.landHash].join('|');
        let screen = cache.screen;
        if (!screen || !screen.canvas || screen.canvas.width !== STORY._cw
            || screen.canvas.height !== STORY._ch) {
            const canvas = document.createElement('canvas');
            canvas.width = STORY._cw; canvas.height = STORY._ch;
            screen = cache.screen = { canvas, key: null, view: null, visible: 0 };
        }
        const reuseInteraction = !!(STORY._mapInteracting && screen.key);
        if (reuseInteraction || screen.key === screenKey) {
            if (typeof storyDrawScreenLayerForCamera === 'function') {
                storyDrawScreenLayerForCamera(ctx, screen.canvas, screen.view);
            } else ctx.drawImage(screen.canvas, 0, 0);
            STORY._mapV2Coastline = {
                total: cache.segments.length, contours: cache.contours.length,
                visible: screen.visible, ratio: Math.round(ratio * 100) / 100,
                coastPx: Math.round(metrics.coastPx * 100) / 100,
                cached: true, reusedInteraction: reuseInteraction
            };
            return screen.visible;
        }
        const paint = screen.canvas.getContext('2d');
        paint.clearRect(0, 0, screen.canvas.width, screen.canvas.height);
        const padding = metrics.shadowPx + metrics.foamOffsetPx + 3;
        const visible = [];
        for (const contour of cache.contours) {
            const topLeft = worldToScreen(contour.minX * STORY_WORLD_W, contour.minY * STORY_WORLD_H, storyCam);
            const bottomRight = worldToScreen(contour.maxX * STORY_WORLD_W, contour.maxY * STORY_WORLD_H, storyCam);
            if (bottomRight.x < -padding || topLeft.x > STORY._cw + padding
                || bottomRight.y < -padding || topLeft.y > STORY._ch + padding) continue;
            visible.push(contour.renderPoints.map(point => worldToScreen(
                point.x * STORY_WORLD_W, point.y * STORY_WORLD_H, storyCam
            )));
        }
        const path = (offset) => {
            paint.beginPath();
            for (const contour of visible) smoothCoastPath(paint, contour, offset);
        };
        paint.save();
        paint.lineCap = 'round';
        paint.lineJoin = 'round';
        path(0);
        paint.strokeStyle = 'rgba(2,25,39,0.82)';
        paint.lineWidth = metrics.shadowPx;
        paint.stroke();
        path(0);
        paint.strokeStyle = 'rgba(222,181,77,0.88)';
        paint.lineWidth = metrics.coastPx;
        paint.stroke();
        path(metrics.foamOffsetPx);
        paint.setLineDash(metrics.dashPx);
        paint.lineDashOffset = -2;
        paint.strokeStyle = `rgba(170,225,218,${metrics.foamAlpha})`;
        paint.lineWidth = metrics.foamPx;
        paint.stroke();
        paint.restore();
        screen.key = screenKey;
        screen.view = { x: Number(storyCam.x) || 0, y: Number(storyCam.y) || 0,
            zoom: Math.max(.0001, Number(storyCam.zoom) || 1) };
        screen.visible = visible.length;
        ctx.drawImage(screen.canvas, 0, 0);
        STORY._mapV2Coastline = {
            total: cache.segments.length,
            contours: cache.contours.length,
            visible: visible.length,
            ratio: Math.round(ratio * 100) / 100,
            coastPx: Math.round(metrics.coastPx * 100) / 100,
            cached: false, reusedInteraction: false
        };
        return visible.length;
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
        const points = [[0, 0], [-fx, 0], [fx, 0], [0, -fy], [0, fy],
            [-fx * .72, -fy * .72], [fx * .72, -fy * .72],
            [-fx * .72, fy * .72], [fx * .72, fy * .72]];
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
            // Atlas hücresinin yalnız merkezi değil gerçek ekrandaki köşeleri
            // de karada kalmalı. Eski .24 katsayısı büyük orman/tarla lekesinin
            // yarısından azını ölçüyor, kıyıda denize taşmasına izin veriyordu.
            const footprint = Math.max(22, metrics.sizePx / storyCam.zoom * .72);
            if (!ruralOnLand(raster, wx, wy, footprint)
                || ruralNearStrategicNode(wx, wy,
                    Math.max(12, metrics.sizePx / storyCam.zoom * .92))) continue;

            let drawAtlas = atlas, cell;
            const forestRoll = ruralHash(gx + 1877, gy + 421);
            const forested = ny < .53
                ? (regional > .48 || forestRoll > .68)
                : (regional > .62 && forestRoll > .72);
            if (forested && forestAtlas && forestAtlas.ready) {
                drawAtlas = forestAtlas;
                const row = ny > .53 ? 1 : (regional > .70 ? 0 : 2);
                cell = row * 4 + Math.floor(ruralHash(gx + 1301, gy + 367) * 4);
            } else if (terrainAtlas && terrainAtlas.ready) {
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
            const aspect = .82 + ruralHash(gx + 233, gy + 811) * .50;
            const drawW = size * aspect, drawH = size * .78;
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

    function hexNaturalNow() {
        return typeof performance !== 'undefined' && performance.now
            ? performance.now() : Date.now();
    }

    function hexNaturalRequestFrame(callback) {
        if (typeof root.requestAnimationFrame === 'function') {
            return root.requestAnimationFrame(callback);
        }
        if (typeof root.setTimeout === 'function') {
            return root.setTimeout(() => callback(hexNaturalNow()), 0);
        }
        return null;
    }

    function invalidateHexNaturalContents(reason) {
        if (typeof STORY === 'undefined') return false;
        const job = STORY._hexNaturalContentsJob;
        if (job) job.cancelled = true;
        STORY._hexNaturalContentsJob = null;
        // Keep the completed surface on screen while its replacement is built.
        // Dropping the canvas here caused a blank terrain flash and made cities
        // appear to load after the map whenever an atlas finished decoding.
        STORY._hexNaturalContentsKey = null;
        STORY._hexNaturalContentsInvalidation = String(reason || 'unknown');
        return true;
    }

    function hexNaturalLandMask(raster) {
        let landMask = STORY._hexNaturalLandMask;
        if (landMask && STORY._hexNaturalLandMaskRaster === raster) return landMask;
        landMask = document.createElement('canvas');
        landMask.width = raster.width; landMask.height = raster.height;
        const maskPaint = landMask.getContext('2d');
        const maskImage = maskPaint.createImageData(raster.width, raster.height);
        for (let i = 0; i < raster.landMask.length; i++) {
            const pixel = i * 4;
            maskImage.data[pixel] = maskImage.data[pixel + 1] = maskImage.data[pixel + 2] = 255;
            maskImage.data[pixel + 3] = raster.landMask[i] ? 255 : 0;
        }
        maskPaint.putImageData(maskImage, 0, 0);
        STORY._hexNaturalLandMask = landMask;
        STORY._hexNaturalLandMaskRaster = raster;
        return landMask;
    }

    function paintHexNaturalCell(job, index) {
        const { world, geography, occupied, natural, paint, scaleX, scaleY,
            baseWorld, counts, seasonIndex, seasonMonth } = job;
        const coverage = Number(geography.landCoverageBps[index]);
        if (coverage <= 0) return;
        const cx = Number(world.centerX[index]) * scaleX;
        const cy = Number(world.centerY[index]) * scaleY;
        const latitude = Number(world.centerY[index]) / Number(world.height);
        const seedA = ruralHash(Number(world.qValues[index]) * 131 + 17,
            Number(world.rValues[index]) * 197 + 31);
        const seedB = ruralHash(Number(world.qValues[index]) * 313 + 71,
            Number(world.rValues[index]) * 89 + 911);
        const detailSeed = ruralHash(index * 977 + 17, index * 149 + 1429);
        const registeredResource = STORY_HEX_NATURAL_RESOURCE_NAMES[
            Number(natural.resourceCodes[index])
        ] || 'NONE';
        const resource = job.operatingResourceCells.has(index)
            ? registeredResource : 'NONE';
        const cover = STORY_HEX_NATURAL_COVER_NAMES[
            Number(natural.coverCodes[index])
        ] || 'OPEN_LAND';
        // Every land hex receives a deterministic authored ground tile. The
        // atlas had been loaded and invalidating this surface for months, but
        // was never actually drawn; most of the world therefore remained a
        // flat green fill with isolated icon stamps on top.
        const groundRow = latitude > .72 ? 3 : latitude > .56 ? 2
            : cover === 'FOREST' ? 1 : 0;
        const groundVariant = groundRow * 4 + Math.floor(seedB * 4);
        const groundSize = baseWorld * 2.18;

        let atlas = null, variant = 0, size = baseWorld * 2.04, alpha = .94, kind = null;
        const physicalLandUseSite = job.landUseSiteByCellIndex.get(index) || null;
        if (physicalLandUseSite && typeof storyVisualLandUseRecipe === 'function') {
            const recipe = storyVisualLandUseRecipe({
                landUseType: physicalLandUseSite.landUseType,
                lifecycleState: physicalLandUseSite.lifecycleState,
                year: typeof STORY !== 'undefined' ? STORY.year : 2010
            });
            atlas = recipe.atlasKey;
            variant = recipe.atlasCell;
            size = baseWorld * 2.08;
            alpha = .98;
            kind = 'LAND_USE';
        } else if (occupied.has(index)) {
            // The ground remains visible beneath urban footprints, while
            // unrelated natural landmarks stay out of the city cell.
            atlas = null;
        } else if (resource === 'PETROLEUM') {
            atlas = 'geographyVarietyModern'; variant = 15;
            size = baseWorld * 2.04; kind = 'OIL';
        } else if (resource === 'MINERAL') {
            atlas = 'geographyVarietyModern'; variant = 14;
            size = baseWorld * 2.08; kind = 'MINE';
        } else if (cover === 'MOUNTAIN'
            && (Number(geography.mountainIntensityBps[index]) >= 6000 || detailSeed > .48)) {
            const mountain = Number(geography.mountainIntensityBps[index]);
            atlas = detailSeed > .72 ? 'geographyVarietyModern' : 'mountains';
            const band = latitude > .68 ? 3 : latitude < .32 ? 2
                : mountain >= 6500 ? 1 : 0;
            variant = atlas === 'geographyVarietyModern'
                ? (latitude > .66 ? 13 : 12)
                : band * 4 + Math.floor(seedB * 4);
            size = baseWorld * 2.16; alpha = .98; kind = 'MOUNTAIN';
        } else if (cover === 'FOREST' && !job.infrastructureOccupiedCells.has(index)
            && detailSeed > .58) {
            atlas = seedA > .58 ? 'geographyVarietyModern' : 'forests';
            const band = latitude > .68 ? 3 : latitude < .30 ? 2 : seedB > .55 ? 0 : 1;
            variant = atlas === 'geographyVarietyModern'
                ? (latitude > .64 ? 2 : latitude > .48 ? 3 : seedB > .5 ? 0 : 1)
                : band * 4 + Math.floor(seedB * 4);
            size = baseWorld * 2.10; alpha = .98; kind = 'FOREST';
        } else if (seedA > .90) {
            // Tarım alanı değildir: yalnız seyrek doğal yüzey ayrıntısıdır.
            atlas = detailSeed > .95 ? 'geographyVarietyModern' : 'terrainDetail';
            const row = latitude > .70 ? 3 : latitude > .56 ? 2 : seedB > .62 ? 1 : 0;
            variant = atlas === 'geographyVarietyModern'
                ? (latitude > .70 ? 6 + Math.floor(seedB * 2)
                    : latitude > .55 ? 5
                        : seedB > .82 ? 11 : seedB > .60 ? 4 : 12)
                : row * 4 + Math.floor(seedB * 4);
            size = baseWorld * 2.08; alpha = atlas === 'geographyVarietyModern' ? .90 : .74;
            kind = 'TERRAIN';
        }
        // One clipped composition per physical hex: continuous ground first,
        // then the canonical land-use/resource/cover landmark when present.
        paint.save();
        paint.beginPath();
        for (let corner = 0; corner < 6; corner++) {
            const angle = Math.PI / 180 * (60 * corner - 30);
            const hx = cx + baseWorld * .99 * Math.cos(angle);
            const hy = cy + baseWorld * .99 * Math.sin(angle);
            if (!corner) paint.moveTo(hx, hy); else paint.lineTo(hx, hy);
        }
        paint.closePath();
        paint.clip();
        storyDrawAtlasCell(paint, 'groundDetail', groundVariant,
            cx, cy + groundSize * .5, groundSize, groundSize,
            coverage < 9400 ? .76 : .48, 0, seedA > .5);
        counts.GROUND++;
        if (atlas) {
            storyDrawAtlasCell(paint, atlas, variant, cx, cy + size * .5,
                size, size, alpha, 0, seedB > .5);
            counts[kind]++;
        }
        paint.restore();
    }

    function paintSeasonalWorldOverlay(job) {
        const all = typeof storyMapAtlasEnsure === 'function' ? storyMapAtlasEnsure() : null;
        const atlas = all && all.seasonalGround;
        const tile = atlas && atlas.seasonTiles && atlas.seasonTiles[job.seasonIndex];
        if (!tile || !job.paint.createPattern) return 0;
        const pattern = job.paint.createPattern(tile, 'repeat');
        if (!pattern) return 0;
        const bandCount = 24;
        const bandHeight = job.canvas.height / bandCount;
        let drawn = 0;
        job.paint.save();
        job.paint.fillStyle = pattern;
        for (let band = 0; band < bandCount; band++) {
            const latitude = (band + .5) / bandCount;
            // This is ground weathering, not an opaque map replacement. City,
            // forest and facility atlases must remain legible above it.
            let alpha = job.seasonIndex === 0
                ? Math.max(0, Math.min(.22, (.60 - latitude) * .78))
                : job.seasonIndex === 1 ? (latitude < .28 ? .11 : .045)
                    : job.seasonIndex === 3 ? .13 : .035;
            if (job.seasonIndex === 0 && job.seasonMonth === 3) alpha *= .68;
            if (alpha <= .015) continue;
            job.paint.globalAlpha = alpha;
            job.paint.fillRect(0, Math.floor(band * bandHeight), job.canvas.width,
                Math.ceil(bandHeight) + 1);
            drawn++;
        }
        job.paint.restore();
        return drawn;
    }

    function finishHexNaturalContents(job) {
        if (job.cancelled || STORY._hexNaturalContentsJob !== job) return;
        const finishStarted = hexNaturalNow();
        paintSeasonalWorldOverlay(job);
        const landMask = hexNaturalLandMask(job.raster);
        job.paint.save();
        job.paint.globalCompositeOperation = 'destination-in';
        job.paint.imageSmoothingEnabled = true;
        job.paint.drawImage(landMask, 0, 0, job.canvas.width, job.canvas.height);
        job.paint.restore();
        const finished = hexNaturalNow();
        job.maxSliceMs = Math.max(job.maxSliceMs, finished - finishStarted);
        STORY._hexNaturalContentsCanvas = job.canvas;
        STORY._hexNaturalContentsKey = job.key;
        STORY._hexNaturalContentsJob = null;
        STORY._hexNaturalContentsBuild = {
            adapterVersion: 'hex-natural-surface-8-seamless-seasonal-coast', key: job.key,
            counts: job.counts, renderScale: job.renderScale,
            occupiedCellCount: job.occupied.size,
            resourceCellCount: job.natural.deposits.length,
            operatingResourceCellCount: job.operatingResourceCells.size,
            width: job.canvas.width, height: job.canvas.height,
            buildMs: finished - job.startedAt, frameCount: job.frameCount,
            maxSliceMs: job.maxSliceMs, frameBudgetMs: job.frameBudgetMs
        };
        promoteHexNaturalContentsToRamTiles(job.canvas, job.key, job.renderScale);
        // Son dilim yalnız tanı kaydını kapatır. Canvas ilk dilimden beri aynı
        // nesne olarak görünür; doğal örtü sonunda tek karede patlamaz.
        hexNaturalRequestFrame(() => {
            if (typeof storyRender === 'function'
                && (typeof APP_SCREEN === 'undefined' || APP_SCREEN === 'story')) storyRender();
        });
    }

    function releaseHexNaturalRamTiles(reason) {
        const cache = STORY._hexNaturalContentsRamTiles;
        if (cache && Array.isArray(cache.tiles)) {
            for (const tile of cache.tiles) {
                if (tile && tile.bitmap && typeof tile.bitmap.close === 'function') {
                    tile.bitmap.close();
                }
            }
        }
        if (cache && cache.overviewBitmap
            && typeof cache.overviewBitmap.close === 'function') {
            cache.overviewBitmap.close();
        }
        if (cache && cache.overviewCanvas) {
            cache.overviewCanvas.width = 1;
            cache.overviewCanvas.height = 1;
        }
        if (cache && cache.viewCanvas) {
            cache.viewCanvas.width = 1;
            cache.viewCanvas.height = 1;
        }
        STORY._hexNaturalContentsRamTiles = null;
        STORY._hexNaturalContentsRamInvalidation = String(reason || 'unknown');
    }

    function promoteHexNaturalContentsToRamTiles(canvas, key, renderScale) {
        if (!canvas || typeof createImageBitmap !== 'function') return;
        releaseHexNaturalRamTiles('replacement');
        const tileSize = 1024;
        const cache = {
            key,
            renderScale: Number(renderScale) || 1,
            tiles: [],
            ready: false,
            readyCount: 0,
            overviewScale: .5,
            overviewBitmap: null,
            overviewCanvas: null,
            viewCanvas: null,
            viewKey: null,
            viewDrawn: 0,
            viewMode: null,
            lastDrawMode: null,
            byteLength: Number(canvas.width) * Number(canvas.height) * 4
        };
        STORY._hexNaturalContentsRamTiles = cache;
        const jobs = [];
        // Minimum zoom used to sample all 6000×4720 source tiles every frame.
        // Build one canonical overview from that completed surface; it is not a
        // second simulation or a lower-quality asset, only a mip level.
        const overview = document.createElement('canvas');
        overview.width = Math.max(1, Math.round(STORY_WORLD_W * cache.overviewScale));
        overview.height = Math.max(1, Math.round(STORY_WORLD_H * cache.overviewScale));
        const overviewPaint = overview.getContext('2d');
        overviewPaint.imageSmoothingEnabled = true;
        overviewPaint.imageSmoothingQuality = 'high';
        overviewPaint.drawImage(canvas, 0, 0, canvas.width, canvas.height,
            0, 0, overview.width, overview.height);
        cache.overviewCanvas = overview;
        cache.byteLength += overview.width * overview.height * 4;
        jobs.push(createImageBitmap(overview).then(bitmap => {
            cache.overviewBitmap = bitmap;
            overview.width = 1;
            overview.height = 1;
        }));
        for (let y = 0; y < canvas.height; y += tileSize) {
            for (let x = 0; x < canvas.width; x += tileSize) {
                const width = Math.min(tileSize, canvas.width - x);
                const height = Math.min(tileSize, canvas.height - y);
                const tile = { x, y, width, height, bitmap: null };
                cache.tiles.push(tile);
                jobs.push(createImageBitmap(canvas, x, y, width, height).then(bitmap => {
                    tile.bitmap = bitmap;
                    cache.readyCount++;
                }));
            }
        }
        Promise.all(jobs).then(() => {
            if (STORY._hexNaturalContentsRamTiles !== cache
                || STORY._hexNaturalContentsKey !== key) {
                releaseHexNaturalRamTiles('stale-promotion');
                return;
            }
            cache.ready = true;
            // Bitmapler bağımsız çözülmüş kaynaklardır. Büyük çalışma canvas'ının
            // piksel backing store'u artık tutulmaz; referans yalnız uyumluluk
            // için 1×1 yüzey olarak kalır.
            canvas.width = 1;
            canvas.height = 1;
            if (typeof storyRender === 'function'
                && (typeof APP_SCREEN === 'undefined' || APP_SCREEN === 'story')) storyRender();
        }).catch(() => {
            releaseHexNaturalRamTiles('promotion-failed');
        });
    }

    function drawHexNaturalRamTiles(ctx, cache) {
        if (!ctx || !cache || !cache.ready || !Array.isArray(cache.tiles)) return 0;
        const zoom = Math.max(.0001, Number(storyCam.zoom) || 1);
        const scale = Math.max(.0001, Number(cache.renderScale) || 1);
        const viewLeft = Number(storyCam.x) || 0;
        const viewTop = Number(storyCam.y) || 0;
        const viewRight = viewLeft + Number(STORY._cw || 0) / zoom;
        const viewBottom = viewTop + Number(STORY._ch || 0) / zoom;
        const zoomRatio = zoom / Math.max(.0001, Number(STORY._minZoom) || zoom);
        const viewportW = Math.max(1, Math.round(Number(STORY._cw) || 1));
        const viewportH = Math.max(1, Math.round(Number(STORY._ch) || 1));
        const stableViewport = !STORY._mapInteracting;
        const viewKey = [cache.key, viewportW, viewportH,
            viewLeft.toFixed(5), viewTop.toFixed(5), zoom.toFixed(6),
            zoomRatio < 1.55 ? 'OVERVIEW' : 'DETAIL'].join('|');
        if (stableViewport && cache.viewCanvas && cache.viewKey === viewKey) {
            ctx.drawImage(cache.viewCanvas, 0, 0);
            cache.lastDrawMode = cache.viewMode;
            return cache.viewDrawn;
        }
        let paintCtx = ctx;
        if (stableViewport) {
            if (!cache.viewCanvas) cache.viewCanvas = document.createElement('canvas');
            if (cache.viewCanvas.width !== viewportW) cache.viewCanvas.width = viewportW;
            if (cache.viewCanvas.height !== viewportH) cache.viewCanvas.height = viewportH;
            paintCtx = cache.viewCanvas.getContext('2d');
            paintCtx.clearRect(0, 0, viewportW, viewportH);
        }
        let drawn = 0;
        let drawMode = 'DETAIL';
        if ((zoomRatio < 1.55 || STORY._mapInteracting) && cache.overviewBitmap) {
            const overviewScale = Math.max(.1, Number(cache.overviewScale) || .5);
            const ix0 = Math.max(0, viewLeft);
            const iy0 = Math.max(0, viewTop);
            const ix1 = Math.min(STORY_WORLD_W, viewRight);
            const iy1 = Math.min(STORY_WORLD_H, viewBottom);
            if (ix1 > ix0 && iy1 > iy0) {
                paintCtx.save();
                paintCtx.imageSmoothingEnabled = false;
                paintCtx.drawImage(cache.overviewBitmap,
                    ix0 * overviewScale, iy0 * overviewScale,
                    (ix1 - ix0) * overviewScale, (iy1 - iy0) * overviewScale,
                    (ix0 - viewLeft) * zoom, (iy0 - viewTop) * zoom,
                    (ix1 - ix0) * zoom, (iy1 - iy0) * zoom);
                paintCtx.restore();
                drawn = 1;
                drawMode = STORY._mapInteracting ? 'INTERACTION_MIP' : 'OVERVIEW';
            }
        } else {
            paintCtx.save();
            paintCtx.imageSmoothingEnabled = true;
            paintCtx.imageSmoothingQuality = 'high';
            for (const tile of cache.tiles) {
                if (!tile.bitmap) continue;
                const tileLeft = tile.x / scale;
                const tileTop = tile.y / scale;
                const tileRight = (tile.x + tile.width) / scale;
                const tileBottom = (tile.y + tile.height) / scale;
                const ix0 = Math.max(tileLeft, viewLeft);
                const iy0 = Math.max(tileTop, viewTop);
                const ix1 = Math.min(tileRight, viewRight);
                const iy1 = Math.min(tileBottom, viewBottom);
                if (!(ix1 > ix0) || !(iy1 > iy0)) continue;
                paintCtx.drawImage(tile.bitmap,
                    (ix0 - tileLeft) * scale, (iy0 - tileTop) * scale,
                    (ix1 - ix0) * scale, (iy1 - iy0) * scale,
                    (ix0 - viewLeft) * zoom, (iy0 - viewTop) * zoom,
                    (ix1 - ix0) * zoom, (iy1 - iy0) * zoom);
                drawn++;
            }
            paintCtx.restore();
        }
        if (stableViewport) {
            cache.viewKey = viewKey;
            cache.viewDrawn = drawn;
            cache.viewMode = drawMode;
            ctx.drawImage(cache.viewCanvas, 0, 0);
        } else {
            // Never reuse a pre-drag screen composite after the camera moves.
            cache.viewKey = null;
        }
        cache.lastDrawMode = drawMode;
        return drawn;
    }

    function processHexNaturalContents(job) {
        if (job.cancelled || STORY._hexNaturalContentsJob !== job) return;
        const sliceStarted = hexNaturalNow();
        let painted = 0;
        while (job.cursor < job.order.length) {
            paintHexNaturalCell(job, job.order[job.cursor++]);
            painted++;
            // Always make useful progress, then yield before consuming a 60 FPS frame.
            // Canvas commands may be queued without advancing performance.now()
            // and flush together later. A hard cell ceiling prevents that GPU
            // flush from turning a nominal 4 ms slice into a 100+ ms hitch.
            if (painted >= 768
                || (painted >= 24 && hexNaturalNow() - sliceStarted >= job.frameBudgetMs)) break;
        }
        const sliceMs = hexNaturalNow() - sliceStarted;
        job.frameCount++;
        job.maxSliceMs = Math.max(job.maxSliceMs, sliceMs);
        job.lastSliceMs = sliceMs;
        STORY._hexNaturalContentsProgress = {
            key: job.key, completed: job.cursor, total: job.order.length,
            ratio: job.cursor / Math.max(1, job.order.length),
            frameCount: job.frameCount, lastSliceMs: job.lastSliceMs,
            maxSliceMs: job.maxSliceMs, frameBudgetMs: job.frameBudgetMs
        };
        if (job.cursor >= job.order.length) finishHexNaturalContents(job);
        else hexNaturalRequestFrame(() => {
            processHexNaturalContents(job);
            if (typeof storyRender === 'function'
                && (typeof APP_SCREEN === 'undefined' || APP_SCREEN === 'story')) storyRender();
        });
    }

    function ensureHexNaturalContentsCanvas() {
        if (typeof STORY === 'undefined' || typeof storyHexWorldEnsure !== 'function'
            || typeof storyHexGeographyEnsure !== 'function'
            || typeof storyMapAtlasReady !== 'function' || typeof storyDrawAtlasCell !== 'function'
            || typeof storyMapRasterEnsure !== 'function'
            || typeof storyHexNaturalResourcesEnsure !== 'function'
            || typeof storyHexSitesEnsure !== 'function') return null;
        const required = ['mountains', 'forests', 'groundDetail', 'seasonalGround',
            'terrainDetail', 'ruralEnvironment', 'geographyVarietyModern',
            'settlements', 'landUseModern'];
        if (!required.every(storyMapAtlasReady)) return null;
        const world = storyHexWorldEnsure();
        const geography = storyHexGeographyEnsure();
        const natural = storyHexNaturalResourcesEnsure();
        const physicalSites = storyHexSitesEnsure();
        const infrastructure = typeof storyHexInfrastructureSegmentsEnsure === 'function'
            ? storyHexInfrastructureSegmentsEnsure() : null;
        const raster = storyMapRasterEnsure();
        if (!raster || !natural || !physicalSites) return null;
        const urban = typeof storyHexUrbanFootprintsEnsure === 'function'
            ? storyHexUrbanFootprintsEnsure() : null;
        const renderScale = CONFIG.hexSurfaceScale;
        const calendar = typeof storyCalendarNow === 'function'
            ? storyCalendarNow() : { seasonIndex: 2, month: 7 };
        const seasonIndex = Math.max(0, Math.min(3, Number(calendar.seasonIndex) || 0));
        const seasonMonth = Math.max(1, Math.min(12, Number(calendar.month) || 1));
        const operatingResourceCells = new Set((physicalSites.sites || [])
            .filter(site => site.siteType === 'EXTRACTION')
            .map(site => Number(site.cellIndex)));
        const landUseSiteByCellIndex = new Map();
        const infrastructureOccupiedCells = new Set();
        for (const segment of infrastructure && infrastructure.segments || []) {
            if (!['LAND', 'RAIL'].includes(String(segment.mode))) continue;
            infrastructureOccupiedCells.add(Number(segment.fromCellIndex));
            infrastructureOccupiedCells.add(Number(segment.toCellIndex));
        }
        for (const site of physicalSites.sites || []) {
            const siteType = String(site.siteType || '').toUpperCase();
            const visualFamily = String(site.visualFamily || '').toUpperCase();
            let landUseType = null;
            if (siteType === 'AGRICULTURE' || visualFamily === 'AGRICULTURE') landUseType = 'AGRICULTURE';
            else if (siteType === 'FORESTRY' || visualFamily === 'FORESTRY') landUseType = 'FORESTRY';
            else if (siteType === 'EXTRACTION' || visualFamily === 'MINE'
                || visualFamily === 'MINERAL' || visualFamily === 'EXTRACTION') landUseType = 'MINE';
            else if (siteType === 'RENEWABLE' || visualFamily === 'RENEWABLE') landUseType = 'RENEWABLE';
            // Generic ENERGY is deliberately not presented as renewable. The
            // simulation must explicitly prove that technology/fuel family.
            const cellIndex = Number(site.cellIndex);
            if (!landUseType || !Number.isInteger(cellIndex) || cellIndex < 0
                || cellIndex >= Number(world.cellCount)) continue;
            landUseSiteByCellIndex.set(cellIndex, {
                siteId: site.id,
                landUseType,
                lifecycleState: String(site.lifecycleState || 'OPERATING')
            });
        }
        const resourceOperationKey = Array.from(operatingResourceCells)
            .sort((a, b) => a - b).join(',');
        const landUseOperationKey = Array.from(landUseSiteByCellIndex.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([index, site]) => `${index}:${site.siteId}:${site.landUseType}:${site.lifecycleState}`)
            .join(',');
        const key = ['hex-natural-surface-7-coast-infrastructure', world.layoutHash, geography.geographyHash,
            natural.registryHash, urban && urban.footprintHash || '-', STORY_WORLD_W,
            STORY_WORLD_H, physicalSites.sourceHash || physicalSites.registryHash || '-',
            infrastructure && infrastructure.topologyHash || '-',
            `season:${seasonIndex}:${seasonMonth}`, resourceOperationKey,
            landUseOperationKey, renderScale].join('|');
        if (STORY._hexNaturalContentsCanvas && STORY._hexNaturalContentsKey === key) return STORY._hexNaturalContentsCanvas;
        if (STORY._hexNaturalContentsJob && STORY._hexNaturalContentsJob.key === key) {
            return STORY._hexNaturalContentsCanvas || null;
        }
        if (STORY._hexNaturalContentsJob) STORY._hexNaturalContentsJob.cancelled = true;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(STORY_WORLD_W * renderScale));
        canvas.height = Math.max(1, Math.round(STORY_WORLD_H * renderScale));
        const paint = canvas.getContext('2d');
        paint.clearRect(0, 0, canvas.width, canvas.height);
        paint.imageSmoothingEnabled = true;
        paint.imageSmoothingQuality = 'high';
        const scaleX = canvas.width / world.width;
        const scaleY = canvas.height / world.height;
        const occupied = new Set(urban && urban.cellIndices ? Array.from(urban.cellIndices) : []);
        const order = Array.from({ length: world.cellCount }, (_, index) => index)
            .filter(index => Number(geography.landCoverageBps[index]) > 0)
            .sort((a, b) => {
                const ad = Math.abs(Number(world.centerX[a]) - Number(world.width) * .5)
                    + Math.abs(Number(world.centerY[a]) - Number(world.height) * .55);
                const bd = Math.abs(Number(world.centerX[b]) - Number(world.width) * .5)
                    + Math.abs(Number(world.centerY[b]) - Number(world.height) * .55);
                return ad - bd || a - b;
            });
        const counts = { GROUND: 0, MOUNTAIN: 0, FOREST: 0, MINE: 0,
            OIL: 0, TERRAIN: 0, LAND_USE: 0 };
        const baseWorld = Number(world.radius) * Math.min(scaleX, scaleY);
        const job = {
            key, world, geography, natural, physicalSites, raster, urban, renderScale,
            canvas, paint, scaleX, scaleY, occupied, operatingResourceCells,
            landUseSiteByCellIndex, infrastructureOccupiedCells,
            seasonIndex, seasonMonth,
            order, counts, baseWorld,
            cursor: 0, cancelled: false, startedAt: hexNaturalNow(), frameCount: 0,
            maxSliceMs: 0, lastSliceMs: 0, frameBudgetMs: 4
        };
        STORY._hexNaturalContentsJob = job;
        // Kısmi canvas güvenle yeniden kullanılabilir: ana şehir/arayüz katmanı
        // bundan bağımsızdır ve her dilim kendi hücrelerini tek kez boyar.
        STORY._hexNaturalContentsCanvas = canvas;
        STORY._hexNaturalContentsKey = key;
        STORY._hexNaturalContentsProgress = {
            key, completed: 0, total: order.length, ratio: 0,
            frameCount: 0, lastSliceMs: 0, maxSliceMs: 0, frameBudgetMs: job.frameBudgetMs
        };
        hexNaturalRequestFrame(() => processHexNaturalContents(job));
        return canvas;
    }

    function drawHexNaturalContents(ctx) {
        const canvas = ensureHexNaturalContentsCanvas();
        if (!ctx || !canvas) return 0;
        const ramTiles = STORY._hexNaturalContentsRamTiles;
        // Yeni yüzey dilimler halinde hazırlanırken önceki tamamlanmış RAM
        // karoları görünmeye devam eder; harita boş bir kareye düşmez.
        const drawnRamTiles = ramTiles && ramTiles.ready
            ? drawHexNaturalRamTiles(ctx, ramTiles) : 0;
        if (!drawnRamTiles) {
            blit(ctx, canvas, 1, storyCam, STORY._cw, STORY._ch, STORY_WORLD_W, STORY_WORLD_H);
        }
        STORY._mapV2HexContents = Object.assign({}, STORY._hexNaturalContentsBuild || {}, {
            zoom: Number(storyCam.zoom),
            ramResident: !!drawnRamTiles,
            ramMode: ramTiles && ramTiles.lastDrawMode || null,
            drawnRamTiles,
            ramTileCount: ramTiles && ramTiles.tiles ? ramTiles.tiles.length : 0,
            ramBytes: ramTiles ? ramTiles.byteLength : 0
        });
        return Object.values(STORY._hexNaturalContentsBuild && STORY._hexNaturalContentsBuild.counts || {})
            .reduce((total, value) => total + Number(value || 0), 0);
    }

    root.STORY_MAP_RENDERER_V2 = CONFIG;
    root.storyMapV2Enabled = enabled;
    root.storyMapV2MinZoom = minZoom;
    root.storyMapV2ZoomRatio = zoomRatio;
    root.storyMapV2VisualZoomBand = visualZoomBand;
    root.storyMapV2CameraBucket = cameraBucket;
    root.storyMapV2WorldToScreen = worldToScreen;
    root.storyMapV2ScreenToWorld = screenToWorld;
    root.storyMapV2ClampCamera = clampCamera;
    root.storyMapV2CenterCamera = centerCamera;
    root.storyMapV2Blit = blit;
    root.storyMapV2SettlementMetrics = settlementMetrics;
    root.storyMapV2SettlementDistrictMetrics = settlementDistrictMetrics;
    root.storyMapV2RuralMetrics = ruralMetrics;
    root.storyMapV2CoastlineMetrics = coastlineMetrics;
    root.storyMapV2MountainPlacements = mountainPlacements;
    root.storyMapV2RoadControlPoints = roadControlPoints;
    root.storyMapV2TraceRoundedPath = traceRoundedPath;
    root.storyMapV2BuildCoastSegments = buildCoastSegments;
    root.storyMapV2BuildCoastContours = buildCoastContours;
    root.storyMapV2SmoothCoastPoints = smoothCoastPoints;
    root.storyMapV2DrawCoastline = drawCoastline;
    root.storyMapV2RuralOnLand = ruralOnLand;
    root.storyMapV2DrawRuralEnvironment = drawRuralEnvironment;
    root.storyMapV2EnsureHexNaturalContentsCanvas = ensureHexNaturalContentsCanvas;
    root.storyMapV2DrawHexNaturalContents = drawHexNaturalContents;
    root.storyMapV2InvalidateHexNaturalContents = invalidateHexNaturalContents;
    root.storyMapV2PortMetrics = portMetrics;
})(typeof window !== 'undefined' ? window : globalThis);
