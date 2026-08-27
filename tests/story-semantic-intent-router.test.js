'use strict';

const assert = require('node:assert/strict');
const { buildEmbeddingSpikePreflight, l2Normalize, dotProduct, cosineSimilarity,
    rankEmbeddingCandidates, fitEmbeddingCalibration, summarizeEmbeddingRows } =
    require('../tools/story-semantic-intent-benchmark');

const report = buildEmbeddingSpikePreflight();

assert.equal(report.ok, true);
assert.equal(report.experimentGatePass, true);
assert.equal(report.gold.total, 179);
assert.deepEqual(report.gold.bySplit, {
    prototype: 89,
    calibration: 45,
    blind_test: 45
});
assert.equal(report.modelSelectionPass, true);
assert.deepEqual(report.classCoverage.missingBlindAnchors, []);
assert.deepEqual(report.classCoverage.missingBlindCalibration, []);
assert.deepEqual(report.oodBySplit, {
    prototype: { inDomain: 86, outOfDomain: 3 },
    calibration: { inDomain: 42, outOfDomain: 3 },
    blind_test: { inDomain: 42, outOfDomain: 3 }
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
assert.deepEqual(report.highRiskCoverage.REQUEST_ACTION, {
    prototype: 6,
    calibration: 3,
    blind_test: 5
});
assert.deepEqual(report.issues, []);
assert.ok(!report.issues.some((issue) => issue.startsWith('OOD_POSITIVE_MISSING:')));
assert.ok(!report.issues.includes('HIGH_RISK_SPLIT_COVERAGE_MISSING:THREATEN'));
assert.ok(!report.issues.includes('HIGH_RISK_SPLIT_COVERAGE_MISSING:SHARE_SECRET'));
assert.ok(!report.issues.includes('HIGH_RISK_SPLIT_COVERAGE_MISSING:BLUFF_CANDIDATE'));
assert.ok(!report.issues.includes('HIGH_RISK_SPLIT_COVERAGE_MISSING:PROPOSE_COMMERCIAL_DEAL'));

const normalizedLeft = l2Normalize([3, 4]);
const normalizedRight = l2Normalize([4, 3]);
assert.ok(Math.abs(dotProduct(normalizedLeft, normalizedRight)
    - cosineSimilarity(normalizedLeft, normalizedRight)) < 1e-12);
assert.throws(() => l2Normalize([0, 0]), /EMBEDDING_VECTOR_NORM/);

const ranked = rankEmbeddingCandidates([1, 0], [
    { id: 'b', label: 'GREETING', vector: [0.9, 0.1] },
    { id: 'a', label: 'GREETING', vector: [1, 0] },
    { id: 'c', label: 'THREATEN', vector: [0, 1] }
], 1);
assert.equal(ranked[0].label, 'GREETING');
assert.equal(ranked[0].anchorId, 'a');

const calibrationRows = [
    { id: 'safe', actual: 'GREETING', outOfDomain: false,
        rawPrediction: 'GREETING', score: 0.91, margin: 0.2 },
    { id: 'risk-fp', actual: 'GREETING', outOfDomain: false,
        rawPrediction: 'THREATEN', score: 0.82, margin: 0.08 },
    { id: 'risk-tp', actual: 'THREATEN', outOfDomain: false,
        rawPrediction: 'THREATEN', score: 0.9, margin: 0.12 },
    { id: 'ood', actual: 'UNKNOWN', outOfDomain: true,
        rawPrediction: 'GREETING', score: 0.4, margin: 0.01 }
];
const fitted = fitEmbeddingCalibration(calibrationRows);
const calibrated = summarizeEmbeddingRows(calibrationRows, fitted.calibration);
assert.equal(calibrated.highRiskFalsePositiveCount, 0);
assert.equal(calibrated.count, 4);

process.stdout.write(JSON.stringify({
    ok: true,
    experimentGatePass: report.experimentGatePass,
    modelSelectionPass: report.modelSelectionPass,
    issues: report.issues.length
}) + '\n');
