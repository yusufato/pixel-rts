'use strict';

const assert = require('node:assert/strict');
const { buildEmbeddingSpikePreflight, l2Normalize, dotProduct, cosineSimilarity,
    frameCompatibility, rankEmbeddingCandidates, fitEmbeddingCalibration,
    buildStratifiedCalibrationFolds, crossValidateEmbeddingCalibration,
    compareSelectionEvidence, summarizeEmbeddingRows, embeddingEvaluationSplits } =
    require('../tools/story-semantic-intent-benchmark');
const corpus = require('../tools/story-semantic-intent-corpus.json');

const report = buildEmbeddingSpikePreflight();

assert.equal(report.ok, true);
assert.equal(report.experimentGatePass, true);
assert.equal(report.gold.total, 291);
assert.deepEqual(report.gold.bySplit, {
    prototype: 99,
    calibration: 96,
    blind_test: 96
});
assert.equal(report.modelSelectionPass, true);
assert.equal(report.representationSelectionPass, true);
assert.equal(report.untouchedEvaluationPass, false);
assert.equal(report.representationSupport.minimumPerClassPerSplit, 3);
assert.deepEqual(report.representationSupport.issues, []);
assert.deepEqual(report.untouchedEvaluation.gold, {
    total: 112,
    bySplit: { prototype: 10, calibration: 51, blind_test: 51 }
});
assert.equal(report.untouchedEvaluation.minimumPerClassPerEvaluationSplit, 3);
assert.equal(report.untouchedEvaluation.blindStatus,
    'SPENT_AFTER_2026_08_31_ONE_SHOT');
assert.deepEqual(report.untouchedEvaluation.evaluatedModelIds,
    ['multilingual-e5-small-q8_0', 'bge-m3-q8_0']);
assert.deepEqual(report.untouchedEvaluation.issues,
    ['UNTOUCHED_EVALUATION_ALREADY_SPENT:SPENT_AFTER_2026_08_31_ONE_SHOT']);
assert.ok(!report.untouchedEvaluation.issues.some(issue =>
    issue.startsWith('UNTOUCHED_CLASS_SUPPORT:THREATEN:')));
assert.ok(!report.untouchedEvaluation.issues.some(issue =>
    issue.startsWith('UNTOUCHED_CLASS_SUPPORT:SHARE_SECRET:')));
assert.ok(!report.untouchedEvaluation.issues.some(issue =>
    issue.startsWith('UNTOUCHED_CLASS_SUPPORT:ASK_INFORMATION:')));
assert.ok(!report.untouchedEvaluation.issues.some(issue =>
    issue.startsWith('UNTOUCHED_CLASS_SUPPORT:BLUFF_CANDIDATE:')));
assert.ok(!report.untouchedEvaluation.issues.some(issue =>
    issue.startsWith('UNTOUCHED_CLASS_SUPPORT:CHALLENGE:')));
assert.ok(!report.untouchedEvaluation.issues.some(issue =>
    issue.startsWith('UNTOUCHED_CLASS_SUPPORT:PROPOSE_COMMERCIAL_DEAL:')));
for (const act of ['ASK_PERSONAL_OPINION', 'CORRECT_STATEMENT', 'GREETING',
    'MAKE_PROMISE', 'OFFER_SUPPORT', 'REJECT', 'REPORT_ECONOMIC',
    'REPORT_MILITARY', 'REQUEST_ACTION', 'SMALL_TALK']) {
    assert.ok(!report.untouchedEvaluation.issues.some(issue =>
        issue.startsWith(`UNTOUCHED_CLASS_SUPPORT:${act}:`)), act);
}
assert.ok(!report.untouchedEvaluation.issues.some(issue =>
    issue.startsWith('UNTOUCHED_OOD_SUPPORT:')));
const evaluationSplits = embeddingEvaluationSplits(corpus,
    report.untouchedEvaluation.sourceIdPrefix);
assert.deepEqual(Object.fromEntries(Object.entries(evaluationSplits)
    .map(([split, rows]) => [split, rows.length])), {
    prototype: 99,
    calibration: 51,
    blind_test: 51
});
assert.ok(evaluationSplits.calibration.every(row =>
    row.sourceId.startsWith('representation-stability-v1:')));
assert.ok(evaluationSplits.blind_test.every(row =>
    row.sourceId.startsWith('representation-stability-v1:')));
assert.throws(() => embeddingEvaluationSplits(corpus, ''),
    /EMBEDDING_EVALUATION_SOURCE_PREFIX_REQUIRED/);
assert.deepEqual(report.classCoverage.missingBlindAnchors, []);
assert.deepEqual(report.classCoverage.missingBlindCalibration, []);
assert.deepEqual(report.oodBySplit, {
    prototype: { inDomain: 96, outOfDomain: 3 },
    calibration: { inDomain: 90, outOfDomain: 6 },
    blind_test: { inDomain: 90, outOfDomain: 6 }
});
assert.deepEqual(report.highRiskCoverage.THREATEN, {
    prototype: 3,
    calibration: 6,
    blind_test: 6
});
assert.deepEqual(report.highRiskCoverage.SHARE_SECRET, {
    prototype: 3,
    calibration: 6,
    blind_test: 6
});
assert.deepEqual(report.highRiskCoverage.BLUFF_CANDIDATE, {
    prototype: 3,
    calibration: 6,
    blind_test: 6
});
assert.deepEqual(report.highRiskCoverage.PROPOSE_COMMERCIAL_DEAL, {
    prototype: 3,
    calibration: 7,
    blind_test: 6
});
assert.deepEqual(report.highRiskCoverage.REQUEST_ACTION, {
    prototype: 6,
    calibration: 6,
    blind_test: 8
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

const balanced = rankEmbeddingCandidates([1, 0], [
    { id: 'g1', label: 'GREETING', vector: [1, 0] },
    { id: 'g2', label: 'GREETING', vector: [0, 1] },
    { id: 't1', label: 'THREATEN', vector: [0.8, 0.2] },
    { id: 't2', label: 'THREATEN', vector: [0.8, 0.2] }
], 2, { aggregation: 'top_mean', topCount: 2 });
assert.equal(balanced[0].label, 'THREATEN',
    'class-balanced aggregation must not let one outlier anchor dominate');

const offerFrame = { communicativeFunction: 'OFFER', polarity: 'POSITIVE_OR_UNMARKED',
    temporality: 'CURRENT_OR_UNMARKED', epistemicStatus: 'QUESTIONED',
    requestedOutcome: 'ACTION' };
const requestFrame = { ...offerFrame, communicativeFunction: 'REQUEST' };
assert.equal(frameCompatibility(offerFrame, offerFrame), 1);
assert.equal(frameCompatibility(offerFrame, requestFrame), 0.8);
const reranked = rankEmbeddingCandidates([1, 0], [
    { id: 'offer', label: 'OFFER_SUPPORT', vector: [0.79, 0.21], labels: offerFrame },
    { id: 'request', label: 'REQUEST_ACTION', vector: [0.8, 0.2], labels: requestFrame }
], 1, { aggregation: 'max', topCount: 1,
    frameCompatibilityWeight: 0.08, queryFrame: offerFrame });
assert.equal(reranked[0].label, 'OFFER_SUPPORT',
    'frame compatibility must be able to resolve a close semantic tie');

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

const nestedRows = [
    ['g1', 'GREETING', 'family-g1'], ['g2', 'GREETING', 'family-g2'],
    ['g3', 'GREETING', 'family-g3'], ['t1', 'THREATEN', 'family-t1'],
    ['t2', 'THREATEN', 'family-t2'], ['t3', 'THREATEN', 'family-t3']
].map(([id, actual, familyId]) => ({ id, familyId, actual, outOfDomain: false,
    rawPrediction: actual, score: 0.9, margin: 0.2 }));
const folds = buildStratifiedCalibrationFolds(nestedRows, 3);
assert.equal(folds.length, 3);
assert.deepEqual(folds.map(fold => fold.validationRows.length), [2, 2, 2]);
assert.deepEqual(folds.flatMap(fold => fold.validationRows.map(row => row.id)).sort(),
    nestedRows.map(row => row.id).sort());
for (const fold of folds) {
    const fitIds = new Set(fold.fitRows.map(row => row.id));
    assert.ok(fold.validationRows.every(row => !fitIds.has(row.id)));
}
assert.deepEqual(buildStratifiedCalibrationFolds(nestedRows.slice().reverse(), 3)
    .map(fold => fold.validationRows.map(row => row.id)),
folds.map(fold => fold.validationRows.map(row => row.id)));
assert.throws(() => buildStratifiedCalibrationFolds(nestedRows.slice(0, 2), 3),
    /EMBEDDING_CALIBRATION_FOLD_SUPPORT/);
const nested = crossValidateEmbeddingCalibration(nestedRows, 3);
assert.equal(nested.method, 'STRATIFIED_OUTER_CALIBRATION_V1');
assert.equal(nested.rowCount, 6);
assert.equal(nested.folds.every(fold => fold.fitCount === 4
    && fold.validationCount === 2), true);
assert.equal(compareSelectionEvidence({ representationId: 'a', perClassLimit: 1,
    selectionValidation: { worstFoldHighRiskFalsePositiveCount: 0,
        totalHighRiskFalsePositiveCount: 0, meanSpeechActMacroF1: 0.4,
        speechActMacroF1StdDev: 0.1 } },
{ representationId: 'b', perClassLimit: 1,
    selectionValidation: { worstFoldHighRiskFalsePositiveCount: 1,
        totalHighRiskFalsePositiveCount: 1, meanSpeechActMacroF1: 0.9,
        speechActMacroF1StdDev: 0 } }) < 0, true,
'outer-fold high-risk safety must outrank mean macro-F1');

process.stdout.write(JSON.stringify({
    ok: true,
    experimentGatePass: report.experimentGatePass,
    modelSelectionPass: report.modelSelectionPass,
    issues: report.issues.length
}) + '\n');
