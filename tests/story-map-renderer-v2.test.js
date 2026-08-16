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

const minorFar = context.storyMapV2SettlementMetrics({ level: 1 }, { cam: { zoom: min }, minZoom: min });
const minorNear = context.storyMapV2SettlementMetrics({ level: 1 }, { cam: { zoom: 4.5 }, minZoom: min });
assert.strictEqual(minorFar.hidden, false, 'minor settlement must remain as a tiny overview landmark');
assert.strictEqual(minorNear.hidden, false, 'minor settlement must return at local LOD');
assert(minorFar.size < minorNear.size, 'minor settlement must grow toward local LOD');

const framed = { x: 999, y: 999, zoom: .01 };
const computedMin = context.storyMapV2ClampCamera(framed, 1200, 700, 3200, 1800);
assert(framed.zoom >= computedMin, 'camera must respect minimum zoom');
assert(framed.zoom <= context.STORY_MAP_RENDERER_V2.maxZoom, 'camera must respect maximum zoom');

const ruralSizes = [1, 3, 10].map(ratio => context.storyMapV2RuralMetrics(ratio).sizePx);
assert(ruralSizes[0] < ruralSizes[1] && ruralSizes[1] < ruralSizes[2],
    `rural detail must reveal monotonically toward local LOD: ${ruralSizes}`);
assert(context.storyMapV2RuralMetrics(1).cellWorld > context.storyMapV2RuralMetrics(10).cellWorld,
    'local LOD must use a denser world grid than overview LOD');

console.log('STORY_MAP_RENDERER_V2_OK', JSON.stringify({ sizes, ruralSizes, computedMin }));
