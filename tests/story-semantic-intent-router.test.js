'use strict';

const assert = require('node:assert/strict');
const { buildEmbeddingSpikePreflight } =
    require('../tools/story-semantic-intent-benchmark');

const report = buildEmbeddingSpikePreflight();

assert.equal(report.ok, true);
assert.equal(report.experimentGatePass, true);
assert.equal(report.gold.total, 160);
assert.deepEqual(report.gold.bySplit, {
    prototype: 85,
    calibration: 34,
    blind_test: 41
});
assert.equal(report.modelSelectionPass, false);
assert.deepEqual(report.classCoverage.missingBlindAnchors, []);
assert.deepEqual(report.classCoverage.missingBlindCalibration, [
    'REPORT_ECONOMIC',
    'REQUEST_ACTION'
]);
assert.deepEqual(report.oodBySplit, {
    prototype: { inDomain: 82, outOfDomain: 3 },
    calibration: { inDomain: 31, outOfDomain: 3 },
    blind_test: { inDomain: 38, outOfDomain: 3 }
});
assert.deepEqual(report.highRiskCoverage.THREATEN, {
    prototype: 3,
    calibration: 3,
    blind_test: 3
});
assert.deepEqual(report.highRiskCoverage.SHARE_SECRET, {
    prototype: 3,
    calibration: 3,
    blind_test: 3
});
assert.deepEqual(report.highRiskCoverage.BLUFF_CANDIDATE, {
    prototype: 3,
    calibration: 3,
    blind_test: 3
});
assert.deepEqual(report.highRiskCoverage.PROPOSE_COMMERCIAL_DEAL, {
    prototype: 3,
    calibration: 4,
    blind_test: 3
});
assert.deepEqual(report.issues, [
    'BLIND_ACT_WITHOUT_CALIBRATION:REPORT_ECONOMIC',
    'BLIND_ACT_WITHOUT_CALIBRATION:REQUEST_ACTION'
]);
assert.ok(!report.issues.some((issue) => issue.startsWith('OOD_POSITIVE_MISSING:')));
assert.ok(!report.issues.includes('HIGH_RISK_SPLIT_COVERAGE_MISSING:THREATEN'));
assert.ok(!report.issues.includes('HIGH_RISK_SPLIT_COVERAGE_MISSING:SHARE_SECRET'));
assert.ok(!report.issues.includes('HIGH_RISK_SPLIT_COVERAGE_MISSING:BLUFF_CANDIDATE'));
assert.ok(!report.issues.includes('HIGH_RISK_SPLIT_COVERAGE_MISSING:PROPOSE_COMMERCIAL_DEAL'));

process.stdout.write(JSON.stringify({
    ok: true,
    experimentGatePass: report.experimentGatePass,
    modelSelectionPass: report.modelSelectionPass,
    issues: report.issues.length
}) + '\n');
