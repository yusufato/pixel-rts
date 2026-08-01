'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const baselinePath = path.join(ROOT, 'qa-baselines', 'story-phase0-summary.json');
const currentPath = path.join(ROOT, 'qa-runtime', 'story-current-report.json');

if (!fs.existsSync(currentPath)) {
    throw new Error(`Güncel rapor bulunamadı: ${currentPath}\nÖnce "npm run story:report" çalıştır.`);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const current = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
if (baseline.seed !== current.seed || baseline.simulatedSeconds !== current.simulatedSeconds) {
    throw new Error('Karşılaştırma reddedildi: tohum veya simülasyon süresi aynı değil.');
}

const numberDelta = (before, after) => ({
    before,
    after,
    delta: Math.round((after - before) * 10000) / 10000
});

const report = {
    schemaVersion: 1,
    seed: current.seed,
    simulatedSeconds: current.simulatedSeconds,
    stateHashChanged: baseline.stateHash !== current.stateHash,
    baselineHash: baseline.stateHash,
    currentHash: current.stateHash,
    metrics: {
        averageWelfare: numberDelta(baseline.final.averageWelfare, current.final.averageWelfare),
        averageInflation: numberDelta(baseline.final.averageInflation, current.final.averageInflation),
        averageUnrest: numberDelta(baseline.final.averageUnrest, current.final.averageUnrest),
        activeStates: numberDelta(baseline.final.activeStates, current.final.activeStates),
        oil: numberDelta(baseline.final.totalResources.oil, current.final.totalResources.oil),
        manpower: numberDelta(baseline.final.totalResources.manpower, current.final.totalResources.manpower),
        points: numberDelta(baseline.final.totalResources.points, current.final.totalResources.points)
    },
    eventCounters: current.telemetry && current.telemetry.counters || {}
};

const outputPath = path.join(ROOT, 'qa-runtime', 'story-comparison.json');
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Hikâye karşılaştırması yazıldı: ${outputPath}`);
console.log(JSON.stringify(report, null, 2));

