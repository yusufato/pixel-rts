'use strict';

const assert = require('assert');
const agriculture = require('../js/StoryHexAgriculture.js');

const world = {
    layoutHash: 'layout-agriculture-test',
    cellCount: 5,
    width: 500,
    height: 300,
    qValues: Int16Array.from([0, 1, 2, 3, 4]),
    rValues: Int16Array.from([0, 0, 0, 0, 0]),
    centerY: Float32Array.from([50, 80, 120, 160, 200])
};
const geography = {
    geographyHash: 'geo-agriculture-test',
    regionIds: Uint16Array.from([2, 2, 2, 2, 2]),
    landCoverageBps: Uint16Array.from([10000, 10000, 10000, 0, 10000]),
    terrainClass: Uint8Array.from([1, 1, 1, 0, 3]),
    mountainIntensityBps: Uint16Array.from([300, 200, 100, 0, 9000]),
    riverPresence: Uint8Array.from([1, 0, 1, 0, 0])
};
const natural = {
    registryHash: 'natural-agriculture-test',
    arableSuitabilityBps: Uint16Array.from([9000, 8500, 6400, 9500, 7000]),
    coverCodes: Uint8Array.from([2, 2, 2, 0, 4])
};
const urban = {
    footprintHash: 'urban-agriculture-test',
    cellIndices: Uint32Array.from([1])
};

const model = agriculture.storyHexAgricultureCreate({ world, geography, natural, urban });
const validation = agriculture.storyHexAgricultureValidate(
    model, world, geography, natural, urban
);
assert.strictEqual(validation.ok, true,
    validation.issues.map(issue => issue.code).join(','));
assert.strictEqual(model.candidates.length, 1,
    'yalnız eşik üstü, kırsal ve geçilebilir kara aday olmalı');
assert.strictEqual(model.candidates[0].cellId, 'hex:0:0');
assert.strictEqual(model.candidates[0].candidateScoreBps, 9000);
assert.strictEqual(model.candidates[0].placementAuthorized, false,
    'yüksek vekil puanı çiftlik kurma iznine dönüşmemeli');
assert.strictEqual(model.candidates[0].scoreMeaning,
    'RANKING_PROXY_NOT_PLACEMENT_PERMISSION');
assert.deepStrictEqual(model.candidates[0].missingEvidence,
    ['SOIL_CLASS', 'RAINFALL_CLASS', 'CROP_SUITABILITY']);
assert.strictEqual(model.regionEvidence['region:2'].authorizedCellCount, 0);
assert.strictEqual(model.diagnostics.noProxyPromotedToFact, true);

const replay = agriculture.storyHexAgricultureCreate({ world, geography, natural, urban });
assert.strictEqual(replay.registryHash, model.registryHash,
    'aynı dünya aynı tarım kanıt sicilini üretmeli');

replay.candidates[0].placementAuthorized = true;
replay.diagnostics.authorizedCellCount = 1;
const unsupported = agriculture.storyHexAgricultureValidate(
    replay, world, geography, natural, urban
);
assert.strictEqual(unsupported.ok, false);
assert(unsupported.issues.some(issue => issue.code === 'UNSUPPORTED_AUTHORIZATION'),
    'kanıtsız izin doğrulamada reddedilmeli');

console.log('story-hex-agriculture: OK', JSON.stringify(model.diagnostics));
