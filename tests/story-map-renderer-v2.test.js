'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const context = vm.createContext({ console, globalThis: null });
context.globalThis = context;
vm.runInContext(fs.readFileSync('js/StoryMapRendererV2.js', 'utf8'), context, {
    filename: 'js/StoryMapRendererV2.js'
});

const cam = { x: 120, y: 70, zoom: 2.5 };
const screen = context.storyMapV2WorldToScreen(420, 270, cam);
const world = context.storyMapV2ScreenToWorld(screen.x, screen.y, cam);
assert(Math.abs(world.x - 420) < 1e-9, 'flat projection x must round-trip');
assert(Math.abs(world.y - 270) < 1e-9, 'flat projection y must round-trip');

const min = .35;
const sizes = [.35, 2.2, 4.5].map(zoom => context.storyMapV2SettlementMetrics(
    { level: 3 }, { cam: { zoom }, minZoom: min }
).size);
assert(sizes[0] < sizes[1] && sizes[1] < sizes[2], `capital scale must be monotonic: ${sizes}`);
const capitalWorldSizes = sizes.map((size, index) => size / [.35, 2.2, 4.5][index]);
assert(capitalWorldSizes.every(size => Math.abs(size - 27) < 1e-9),
    `capital must keep one fixed world-space size at every zoom: ${capitalWorldSizes}`);
const liveTier = context.storyMapV2SettlementMetrics(
    { level: 1 }, { cam: { zoom: 4.5 }, minZoom: min, visualLevel: 3 }
);
assert.strictEqual(liveTier.level, 3, 'live urban footprint tier must override legacy node.level');

const minorFar = context.storyMapV2SettlementMetrics({ level: 1 }, { cam: { zoom: min }, minZoom: min });
const minorNear = context.storyMapV2SettlementMetrics({ level: 1 }, { cam: { zoom: 4.5 }, minZoom: min });
assert.strictEqual(minorFar.hidden, false, 'minor settlement must remain as a tiny overview landmark');
assert.strictEqual(minorNear.hidden, false, 'minor settlement must return at local LOD');
assert(minorFar.size < minorNear.size, 'minor settlement must grow toward local LOD');
assert(Math.abs(minorFar.size / min - minorNear.size / 4.5) < 1e-9,
    'minor settlement must not run an independent zoom-size curve');
const portSizes = [.35, 2.2, 4.5].map(zoom => context.storyMapV2PortMetrics(
    3, { cam: { zoom } }
).size);
assert(portSizes.every((size, index) => Math.abs(size / [.35, 2.2, 4.5][index] - 10) < 1e-9),
    `port must keep one fixed world-space size at every zoom: ${portSizes}`);
assert.strictEqual(context.STORY_MAP_RENDERER_V2.districtRasterScale, 8,
    'district RAM art must use twice the former 4x raster density');
assert.strictEqual(context.STORY_MAP_RENDERER_V2.portRasterScale, 4,
    'port RAM art must use twice the previous 2x dedicated raster density');
assert.strictEqual(context.storyMapV2VisualZoomBand({ zoom: .35 }, .35), 'OVERVIEW');
assert.strictEqual(context.storyMapV2VisualZoomBand({ zoom: 2.2 }, .35), 'DISTRICT');
assert.strictEqual(context.storyMapV2VisualZoomBand({ zoom: 4.5 }, .35), 'LOCAL');
const capitalDistrictsFar = context.storyMapV2SettlementDistrictMetrics(
    { level: 3 }, { cam: { zoom: min }, minZoom: min }
);
const capitalDistrictsNear = context.storyMapV2SettlementDistrictMetrics(
    { level: 3 }, { cam: { zoom: 4.5 }, minZoom: min }
);
assert.strictEqual(capitalDistrictsFar.visible, false, 'overview capital must remain a single clean landmark');
assert(capitalDistrictsNear.visible && capitalDistrictsNear.count >= 6,
    'local capital must reveal deterministic urban districts');
assert.strictEqual(capitalDistrictsNear.worldSize, 18,
    'capital districts must occupy a legible majority of their hex');
const capitalNear = context.storyMapV2SettlementMetrics({ level: 3 }, { cam: { zoom: 4.5 }, minZoom: min });
assert(capitalDistrictsNear.sizePx < capitalNear.size,
    'district fragments must stay subordinate to the main settlement sprite');
const tierTwoDistrict = context.storyMapV2SettlementDistrictMetrics(
    { level: 2 }, { cam: { zoom: 2.2 }, minZoom: min }
);
assert.strictEqual(tierTwoDistrict.worldSize, 16,
    'tier-2 district must remain legible without matching the city core');

const framed = { x: 999, y: 999, zoom: .01 };
const computedMin = context.storyMapV2ClampCamera(framed, 1200, 700, 3200, 1800);
assert(framed.zoom >= computedMin, 'camera must respect minimum zoom');
assert(framed.zoom <= context.STORY_MAP_RENDERER_V2.maxZoom, 'camera must respect maximum zoom');
const fittedMin = Math.max(1200 / (3200 * 1.12), 700 / (1800 * 1.06));
assert(Math.abs(computedMin / fittedMin - 1.5) < 1e-9,
    'campaign presentation must enlarge hexes and contents together by 1.5x');
assert.strictEqual(context.STORY_MAP_RENDERER_V2.maxZoom, 7.5,
    'maximum inspection zoom must grow with the 1.5x presentation scale');

const ruralSizes = [1, 3, 10].map(ratio => context.storyMapV2RuralMetrics(ratio).sizePx);
assert(ruralSizes[0] > ruralSizes[2] && ruralSizes[1] <= ruralSizes[2],
    `rural LOD must replace overview masses with bounded overlapping local detail: ${ruralSizes}`);
assert(context.storyMapV2RuralMetrics(1).cellWorld > context.storyMapV2RuralMetrics(10).cellWorld,
    'local LOD must use a denser world grid than overview LOD');

const island = {
    width: 3,
    height: 3,
    landMask: Uint8Array.from([
        0, 0, 0,
        0, 1, 0,
        0, 0, 0
    ])
};
const coast = context.storyMapV2BuildCoastSegments(island);
assert.strictEqual(coast.length, 4, 'one-cell island must produce four merged coastline sides');
assert.deepStrictEqual(Array.from(new Set(coast.map(segment => `${segment.nx},${segment.ny}`))).sort(),
    ['-1,0', '0,-1', '0,1', '1,0'], 'coast normals must point to sea on all four sides');
const coastFar = context.storyMapV2CoastlineMetrics(1);
const coastNear = context.storyMapV2CoastlineMetrics(10);
assert(coastNear.coastPx > coastFar.coastPx && coastNear.coastPx <= 2.7,
    'coastline must thicken monotonically but remain screen-space bounded');
const islandContours = context.storyMapV2BuildCoastContours(island);
assert.strictEqual(islandContours.length, 1, 'one-cell island coastline must be one closed contour');
assert.strictEqual(islandContours[0].points.length, 4, 'one-cell island contour must keep four canonical corners');
assert.strictEqual(context.storyMapV2SmoothCoastPoints(islandContours[0].points).length, 4,
    'small-island smoothing guard must preserve tiny canonical silhouettes');
const diagonalIslands = {
    width: 2,
    height: 2,
    landMask: Uint8Array.from([1, 0, 0, 1])
};
assert.strictEqual(context.storyMapV2BuildCoastContours(diagonalIslands).length, 2,
    'diagonally touching islands must remain two independent closed contours');
context.STORY_WORLD_W = 300;
context.STORY_WORLD_H = 300;
context.storyMapRasterSample = (raster, nx, ny) => {
    const x = Math.max(0, Math.min(raster.width - 1, Math.floor(nx * raster.width)));
    const y = Math.max(0, Math.min(raster.height - 1, Math.floor(ny * raster.height)));
    return { land: !!raster.landMask[y * raster.width + x] };
};
const coastCorner = {
    width: 5,
    height: 5,
    landMask: Uint8Array.from([
        1, 1, 1, 0, 0,
        1, 1, 1, 0, 0,
        1, 1, 0, 0, 0,
        0, 0, 0, 0, 0,
        0, 0, 0, 0, 0
    ])
};
assert.strictEqual(context.storyMapV2RuralOnLand(coastCorner, 90, 90, 45), false,
    'rural footprint must reject a diagonal sea corner, not only cardinal samples');
const mountainChain = context.storyMapV2MountainPlacements({
    str: .8,
    pts: [[0, 0], [240, 0], [320, 100]]
}, 1, 2);
assert(mountainChain.length >= 6, 'long mountain range must receive overlapping chain placements');
assert(mountainChain.every(mark => Math.abs(mark.rotation) <= .18),
    'mountain tangent rotation must keep peaks upright');
assert(mountainChain.every(mark => mark.size > 32 && mark.size < 68),
    'mountain chain size variation must remain bounded');
const road = context.storyMapV2RoadControlPoints({ x: 10, y: 20 }, { x: 210, y: 20 }, 4);
assert.strictEqual(road.length, 5, 'road route must contain three terrain-like intermediate controls');
assert(road[0].x === 10 && road[0].y === 20, 'road route must preserve its start');
assert(road[4].x === 210 && road[4].y === 20, 'road route must preserve its end');
assert(road.slice(1, -1).some(point => Math.abs(point.y - 20) > 1),
    'road controls must break ruler-straight graph presentation');
assert(road.every(point => Math.abs(point.y - 20) <= 50),
    'road curvature must stay bounded around its graph edge');

console.log('STORY_MAP_RENDERER_V2_OK', JSON.stringify({
    sizes, ruralSizes, coastSegments: coast.length, coastContours: islandContours.length, computedMin
}));
