'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
    storyHexWorldCreate,
    storyHexWorldDiagnostics
} = require('../js/StoryHexWorld');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'js', 'StoryHexWorldAsset.js');

function buildAsset() {
    const world = storyHexWorldCreate({ loadMode: 'build-time' });
    const diagnostics = storyHexWorldDiagnostics(world);
    return Object.freeze({
        schemaVersion: world.schemaVersion,
        adapterVersion: world.adapterVersion,
        coordinateSystem: world.coordinateSystem,
        width: world.width,
        height: world.height,
        radius: world.radius,
        geoWidth: world.geoWidth,
        geoHeight: world.geoHeight,
        rowCount: world.rowCount,
        cellCount: world.cellCount,
        sourceHash: world.sourceHash,
        layoutHash: world.layoutHash,
        generatedByteLength: diagnostics.byteLength
    });
}

function serialize(asset) {
    return `// OTOMATİK ÜRETİLDİ — tools/make-story-hex-world.js\n`
        + `const STORY_HEX_WORLD_ASSET = Object.freeze(${JSON.stringify(asset, null, 4)});\n`;
}

function main() {
    const asset = buildAsset();
    const content = serialize(asset);
    fs.writeFileSync(OUTPUT, content, 'utf8');
    process.stdout.write(`${JSON.stringify({ output: path.relative(ROOT, OUTPUT), asset }, null, 2)}\n`);
}

if (require.main === module) main();

module.exports = { buildAsset, serialize };
