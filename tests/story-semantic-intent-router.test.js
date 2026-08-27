'use strict';

const assert = require('node:assert/strict');
const { buildEmbeddingSpikePreflight } =
    require('../tools/story-semantic-intent-benchmark');

const report = buildEmbeddingSpikePreflight();

assert.equal(report.ok, true);
assert.equal(report.experimentGatePass, true);
assert.equal(report.gold.total, 100);
assert.deepEqual(report.gold.bySplit, {
    prototype: 67,
    calibration: 10,
    blind_test: 23
});
assert.equal(report.modelSelectionPass, false);
assert.ok(report.classCoverage.missingBlindAnchors.includes('REPORT_MILITARY'));
assert.ok(report.issues.includes('OOD_POSITIVE_MISSING:prototype'));
assert.ok(report.issues.includes('OOD_POSITIVE_MISSING:calibration'));
assert.ok(report.issues.includes('OOD_POSITIVE_MISSING:blind_test'));
assert.ok(report.issues.includes('HIGH_RISK_SPLIT_COVERAGE_MISSING:THREATEN'));

process.stdout.write(JSON.stringify({
    ok: true,
    experimentGatePass: report.experimentGatePass,
    modelSelectionPass: report.modelSelectionPass,
    issues: report.issues.length
}) + '\n');
