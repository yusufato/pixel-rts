'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { buildStoryMapRasterAssetData } = require('./story-sim-harness');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'js', 'StoryMapRasterAsset.js');

function hashBytes(values) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < values.length; index++) {
        const value = Number(values[index]) | 0;
        hash ^= value & 255;
        hash = Math.imul(hash, 0x01000193);
        hash ^= (value >>> 8) & 255;
        hash = Math.imul(hash, 0x01000193);
    }
    return `fnv1a32:${(`00000000${(hash >>> 0).toString(16)}`).slice(-8)}`;
}

function encodeRuns(values) {
    const runs = [];
    let index = 0;
    while (index < values.length) {
        const value = Number(values[index]);
        let count = 1;
        while (index + count < values.length && values[index + count] === value && count < 65535) count++;
        runs.push({ value, count });
        index += count;
    }
    const payload = Buffer.allocUnsafe(runs.length * 4);
    for (let run = 0; run < runs.length; run++) {
        payload.writeInt16LE(runs[run].value, run * 4);
        payload.writeUInt16LE(runs[run].count, run * 4 + 2);
    }
    return { runs, payload };
}

function chunksOf(value, size = 100) {
    const chunks = [];
    for (let index = 0; index < value.length; index += size) chunks.push(value.slice(index, index + size));
    return chunks;
}

const raster = buildStoryMapRasterAssetData(2032);
const encoded = encodeRuns(raster.regionIds);
const payloadChunks = chunksOf(encoded.payload.toString('base64'));
const asset = {
    schemaVersion: 1,
    adapterVersion: 'canonical-map-raster-asset-1',
    rasterSchemaVersion: raster.schemaVersion,
    rasterAdapterVersion: raster.adapterVersion,
    encoding: 'rle-int16-le-v1',
    width: raster.width,
    height: raster.height,
    geoWidth: raster.geoWidth,
    geoHeight: raster.geoHeight,
    sourceHash: raster.sourceHash,
    landHash: raster.landHash,
    regionHash: raster.regionHash,
    payloadHash: hashBytes(encoded.payload),
    runCount: encoded.runs.length,
    rawPixelCount: raster.regionIds.length,
    payloadBytes: encoded.payload.length
};
const lines = [
    '// ═══ OTOMATİK ÜRETİLDİ — elle düzenleme: tools/make-story-map-raster.js ═══',
    `// ${asset.width}×${asset.height} · ${asset.runCount} RLE kaydı · ${asset.payloadBytes} bayt`,
    'globalThis.STORY_MAP_RASTER_ASSET_V1 = Object.freeze({',
    ...Object.entries(asset).map(([key, value]) => `    ${key}: ${JSON.stringify(value)},`),
    '    payloadChunks: Object.freeze([',
    ...payloadChunks.map(chunk => `        ${JSON.stringify(chunk)},`),
    '    ])',
    '});',
    ''
];
fs.writeFileSync(OUTPUT, lines.join('\n'), 'utf8');
console.log(`Story map raster asset yazıldı: ${OUTPUT}`);
console.log(JSON.stringify(asset, null, 2));
