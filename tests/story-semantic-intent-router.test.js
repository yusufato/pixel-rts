'use strict';

const assert = require('node:assert/strict');
const { buildEmbeddingSpikePreflight } =
    require('../tools/story-semantic-intent-benchmark');

const report = buildEmbeddingSpikePreflight();

assert.equal(report.ok, true);
assert.equal(report.experimentGatePass, true);
assert.equal(report.gold.total, 120);
assert.deepEqual(report.gold.bySplit, {
    prototype: 75,
    calibration: 16,
    blind_test: 29
});
assert.equal(report.modelSelectionPass, false);
assert.ok(report.classCoverage.missingBlindAnchors.includes('REPORT_MILITARY'));
assert.deepEqual(report.oodBySplit, {
    prototype: { inDomain: 72, outOfDomain: 3 },
    calibration: { inDomain: 13, outOfDomain: 3 },
    blind_test: { inDomain: 26, outOfDomain: 3 }
});
assert.deepEqual(report.highRiskCoverage.THREATEN, {
    prototype: 3,
    calibration: 3,
    blind_test: 3
});
assert.equal(report.issues.length, 9);
assert.ok(!report.issues.some((issue) => issue.startsWith('OOD_POSITIVE_MISSING:')));
assert.ok(!report.issues.includes('HIGH_RISK_SPLIT_COVERAGE_MISSING:THREATEN'));
assert.ok(report.issues.includes('HIGH_RISK_SPLIT_COVERAGE_MISSING:SHARE_SECRET'));

process.stdout.write(JSON.stringify({
    ok: true,
    experimentGatePass: report.experimentGatePass,
    modelSelectionPass: report.modelSelectionPass,
    issues: report.issues.length
}) + '\n');
