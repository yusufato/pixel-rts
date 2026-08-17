'use strict';

const assert = require('node:assert/strict');
const asset = require('../tools/make-story-hex-world').buildAsset();
const {
    STORY_HEX_WORLD_DEFAULT_RADIUS,
    storyHexWorldCreate,
    storyHexWorldCell,
    storyHexWorldCellAt,
    storyHexWorldNeighbors,
    storyHexWorldValidate,
    storyHexWorldDiagnostics
} = require('../js/StoryHexWorld');

function run() {
    const started = process.hrtime.bigint();
    const first = storyHexWorldCreate({ loadMode: 'test' });
    const repeat = storyHexWorldCreate({ loadMode: 'test-repeat' });
    const validation = storyHexWorldValidate(first, asset);
    assert.equal(validation.ok, true, JSON.stringify(validation.issues));
    assert.equal(first.radius, STORY_HEX_WORLD_DEFAULT_RADIUS);
    assert.equal(first.width, 3000);
    assert.equal(first.height, 2360);
    assert.equal(first.cellCount, 10584, 'Ana HexWorld adayı tam 10.584 hücre üretmeli.');
    assert.equal(first.rowCount, 98, 'Ana HexWorld adayı 98 satır üretmeli.');
    assert.equal(first.sourceHash, repeat.sourceHash, 'Aynı sözleşme aynı kaynak karmasını üretmeli.');
    assert.equal(first.layoutHash, repeat.layoutHash, 'Aynı sözleşme aynı yerleşim karmasını üretmeli.');
    assert.deepEqual(Array.from(first.qValues), Array.from(repeat.qValues));
    assert.deepEqual(Array.from(first.rValues), Array.from(repeat.rValues));

    const center = storyHexWorldCell(first, 0, 0);
    assert.equal(center.id, 'hex:0:0');
    assert.deepEqual(storyHexWorldCellAt(first, center.center.x, center.center.y), center);
    assert.equal(storyHexWorldNeighbors(first, 0, 0).length, 2, 'Köşe hücresinin yalnız dünya içindeki komşuları dönmeli.');

    for (let index = 0; index < first.cellCount; index += 97) {
        const cell = storyHexWorldCell(first, first.qValues[index], first.rValues[index]);
        const picked = storyHexWorldCellAt(first, cell.center.x, cell.center.y);
        assert.equal(picked && picked.index, index, `Merkez round-trip hücre ${index} için korunmalı.`);
    }

    const candidates = [20, 16.1, 12].map(radius => {
        const world = storyHexWorldCreate({ radius, loadMode: 'candidate' });
        return { radius, cellCount: world.cellCount, rowCount: world.rowCount, byteLength: world.diagnostics.byteLength };
    });
    assert.ok(candidates[0].cellCount < candidates[1].cellCount);
    assert.ok(candidates[1].cellCount < candidates[2].cellCount);
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    assert.ok(elapsedMs < 250, `HexWorld hedefli test 250 ms altında kalmalı: ${elapsedMs.toFixed(3)} ms`);

    return {
        diagnostics: storyHexWorldDiagnostics(first),
        candidates,
        elapsedMs: Math.round(elapsedMs * 1000) / 1000
    };
}

if (require.main === module) {
    const result = run();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

module.exports = { run };
