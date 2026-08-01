'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { runStorySimulation } = require('./story-sim-harness');

function readNumberArg(name, fallback) {
    const prefix = `--${name}=`;
    const raw = process.argv.find(arg => arg.startsWith(prefix));
    if (!raw) return fallback;
    const value = Number(raw.slice(prefix.length));
    return Number.isFinite(value) ? value : fallback;
}

const seed = readNumberArg('seed', 2032);
const seconds = readNumberArg('seconds', 900);
const outputArg = process.argv.find(arg => arg.startsWith('--output='));
const output = outputArg
    ? path.resolve(process.cwd(), outputArg.slice('--output='.length))
    : path.resolve(__dirname, '..', 'qa-runtime', 'story-current-report.json');

const report = runStorySimulation({ seed, seconds });
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(`Hikâye güncel ham raporu yazıldı: ${output}`);
console.log(`Durum karması: ${report.stateHash}`);
console.log(`Simülasyon: ${report.simulatedSeconds} sn / gerçek süre: ${report.wallTimeMs} ms`);
console.log(`Olay sayaçları: ${JSON.stringify(report.telemetry && report.telemetry.counters || {})}`);
