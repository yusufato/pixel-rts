'use strict';

const assert = require('assert');
const natural = require('../js/StoryHexNaturalResources.js');

const world = {
    layoutHash: 'layout-natural-test', width: 600, height: 200, cellCount: 6,
    radius: 40,
    qValues: Int16Array.from([0, 1, 2, 3, 4, 5]),
    rValues: Int16Array.from([0, 0, 0, 0, 0, 0]),
    centerX: Float32Array.from([50, 150, 250, 350, 450, 550]),
    centerY: Float32Array.from([100, 100, 100, 100, 100, 100])
};
const geography = {
    geographyHash: 'geo-natural-test',
    landCoverageBps: Uint16Array.from([10000, 10000, 10000, 10000, 10000, 10000]),
    terrainClass: Uint8Array.from([1, 1, 1, 1, 1, 1]),
    regionIds: Int16Array.from([0, 0, 0, 0, 0, 0]),
    mountainIntensityBps: Uint16Array.from([0, 100, 500, 2200, 7600, 3400]),
    riverPresence: Uint8Array.from([0, 0, 1, 0, 0, 0])
};
const urban = {
    footprintHash: 'urban-natural-test',
    cellIndices: Uint32Array.from([0]),
    records: [{ cityId: 0, core: { index: 0 } }]
};
const cellAt = (targetWorld, x) => {
    let best = 0, distance = Infinity;
    for (let index = 0; index < targetWorld.cellCount; index++) {
        const next = Math.abs(Number(targetWorld.centerX[index]) - Number(x));
        if (next < distance) { best = index; distance = next; }
    }
    return { index: best };
};
const options = {
    world, geography, urban, cellAt,
    nodes: [{ id: 0, mine: 1 }], oilPoints: [[.25, .5]]
};
const model = natural.storyHexNaturalCreate(options);
const repeat = natural.storyHexNaturalCreate(options);
const validation = natural.storyHexNaturalValidate(model, world, geography);

assert.strictEqual(validation.ok, true, validation.issues.map(issue => issue.code).join(','));
assert.strictEqual(model.registryHash, repeat.registryHash, 'aynı girdiler aynı doğal dünya kaydını üretmeli');
assert.strictEqual(model.diagnostics.petroleumDepositCount, 1);
assert.strictEqual(model.diagnostics.mineralDepositCount, 1);
assert.strictEqual(model.deposits.length, 2);
assert.strictEqual(new Set(model.deposits.map(row => row.cellIndex)).size, 2,
    'iki yatak aynı altıgeni paylaşmamalı');
assert(model.deposits.every(row => row.reserveStatus === 'UNQUANTIFIED_SPATIAL_STOCK_PENDING'));
assert.strictEqual(model.diagnostics.arableEvidenceStatus,
    'UNAVAILABLE_NO_CANONICAL_SOIL_SOURCE');
assert.strictEqual(model.diagnostics.quantifiedForestStockCount, 0);
assert(!model.deposits.some(row => String(row.sourceId).includes('pts')),
    'uzman iş gücü pts verisi maden yatağına dönüşmemeli');

console.log('story-hex-natural-resources: OK', JSON.stringify(model.diagnostics));
