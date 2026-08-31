'use strict';

const assert = require('node:assert/strict');
const { buildEmbeddingSpikePreflight, l2Normalize, dotProduct, cosineSimilarity,
    frameCompatibility, matchesHighRiskFrameContract, selectPrototypeAnchors,
    buildPrototypeClassCentroids, rankEmbeddingCandidates, fitEmbeddingCalibration,
    buildStratifiedCalibrationFolds, crossValidateEmbeddingCalibration,
    compareSelectionEvidence, summarizeEmbeddingRows, embeddingEvaluationSplits,
    embeddingCalibrationStudySplits, evaluateHighRiskRecall,
    buildCalibrationStudyRecommendation } =
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
const calibrationStudySplits = embeddingCalibrationStudySplits(corpus,
    report.untouchedEvaluation.sourceIdPrefix);
assert.deepEqual(Object.fromEntries(Object.entries(calibrationStudySplits)
    .map(([split, rows]) => [split, rows.length])), {
    prototype: 99,
    calibration: 51,
    blind_test: 0
});
assert.throws(() => embeddingEvaluationSplits(corpus, ''),
    /EMBEDDING_EVALUATION_SOURCE_PREFIX_REQUIRED/);
const splitSourceEvaluation = embeddingEvaluationSplits(corpus, {
    calibrationSourceIdPrefix: 'representation-stability-v1:',
    blindSourceIdPrefix: 'sha256:'
});
assert.equal(splitSourceEvaluation.calibration.length, 51);
assert.ok(splitSourceEvaluation.blind_test.length > 0);
assert.ok(splitSourceEvaluation.calibration.every(row =>
    row.sourceId.startsWith('representation-stability-v1:')));
assert.ok(splitSourceEvaluation.blind_test.every(row =>
    row.sourceId.startsWith('sha256:')));
const splitSourceCalibration = embeddingCalibrationStudySplits(corpus, {
    calibrationSourceIdPrefix: 'representation-stability-v1:',
    blindSourceIdPrefix: 'future-sealed-blind-v2:'
});
assert.equal(splitSourceCalibration.calibration.length, 51);
assert.equal(splitSourceCalibration.blind_test.length, 0);
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

const coverageAnchors = [
    { id: 'a-first-outlier', label: 'GREETING', vector: [-1, 0] },
    { id: 'b-central', label: 'GREETING', vector: [1, 0] },
    { id: 'c-near-central', label: 'GREETING', vector: [0.9, 0.1] },
    { id: 't-only', label: 'THREATEN', vector: [0, 1] }
];
const selectedCoverage = selectPrototypeAnchors(coverageAnchors, 1);
assert.deepEqual(selectedCoverage.map(anchor => anchor.id), ['c-near-central', 't-only'],
    'prototype coverage must select a representative anchor, not the first id');
assert.deepEqual(selectPrototypeAnchors(coverageAnchors.slice().reverse(), 1)
    .map(anchor => anchor.id), selectedCoverage.map(anchor => anchor.id),
    'prototype coverage must be input-order invariant');
assert.equal(rankEmbeddingCandidates([-1, 0], coverageAnchors, 1)[0].label,
    'THREATEN', 'query similarity must not change the prototype-only anchor subset');

const centroids = buildPrototypeClassCentroids(coverageAnchors);
assert.deepEqual(centroids.map(row => row.id),
    ['centroid:GREETING', 'centroid:THREATEN']);
assert.deepEqual(centroids[0].sourceAnchorIds,
    ['a-first-outlier', 'b-central', 'c-near-central']);
assert.ok(Math.abs(dotProduct(centroids[0].vector, centroids[0].vector) - 1) < 1e-12,
    'class centroid must be L2-normalized after averaging');
assert.deepEqual(buildPrototypeClassCentroids(coverageAnchors.slice().reverse()), centroids,
    'class centroid must be input-order invariant');
assert.equal(rankEmbeddingCandidates([1, 0], coverageAnchors, null,
    { aggregation: 'centroid' })[0].label, 'GREETING');
assert.throws(() => buildPrototypeClassCentroids([
    { id: 'short', label: 'GREETING', vector: [1] },
    { id: 'long', label: 'GREETING', vector: [1, 0] }
]), /EMBEDDING_VECTOR_DIMENSION/);

const greetingFrame = { communicativeFunction: 'GREET',
    polarity: 'POSITIVE_OR_UNMARKED', temporality: 'CURRENT_OR_UNMARKED',
    epistemicStatus: 'UNMARKED', requestedOutcome: 'NONE' };
const actionFrame = { communicativeFunction: 'REQUEST',
    polarity: 'POSITIVE_OR_UNMARKED', temporality: 'CURRENT_OR_UNMARKED',
    epistemicStatus: 'UNMARKED', requestedOutcome: 'ACTION' };
const guardedCentroid = rankEmbeddingCandidates([1, 0], [
    { id: 'action-1', label: 'REQUEST_ACTION', vector: [1, 0], labels: actionFrame },
    { id: 'action-2', label: 'REQUEST_ACTION', vector: [0.99, 0.01],
        labels: actionFrame },
    { id: 'greeting-1', label: 'GREETING', vector: [0.8, 0.2],
        labels: greetingFrame }
], null, { aggregation: 'centroid', queryFrame: greetingFrame,
    highRiskMinimumFrameCompatibility: 0.8 });
assert.equal(guardedCentroid[0].label, 'GREETING',
    'high-risk centroid must not outrank a frame-compatible safe class');
assert.equal(guardedCentroid.find(row => row.label === 'REQUEST_ACTION').score,
    -Infinity, 'incompatible high-risk centroid must be deterministically vetoed');

assert.equal(matchesHighRiskFrameContract('REQUEST_ACTION', actionFrame), true);
assert.equal(matchesHighRiskFrameContract('THREATEN', actionFrame), true);
assert.equal(matchesHighRiskFrameContract('THREATEN', {
    communicativeFunction: 'TELL', requestedOutcome: 'ACTION' }), true);
assert.equal(matchesHighRiskFrameContract('REQUEST_ACTION', greetingFrame), false);
assert.equal(matchesHighRiskFrameContract('PROPOSE_COMMERCIAL_DEAL', {
    communicativeFunction: 'OFFER', requestedOutcome: 'ACTION' }), true);
assert.equal(matchesHighRiskFrameContract('SHARE_SECRET', {
    communicativeFunction: 'CONFIDE', requestedOutcome: 'CONFIDENTIAL_HANDLING' }), true);
assert.equal(matchesHighRiskFrameContract('SHARE_SECRET', {
    communicativeFunction: 'TELL', requestedOutcome: 'NONE' }), false);
assert.equal(matchesHighRiskFrameContract('BLUFF_CANDIDATE', {
    communicativeFunction: 'TELL', polarity: 'MIXED',
    epistemicStatus: 'CLAIMED_CERTAIN', requestedOutcome: 'NONE' }), true);
assert.equal(matchesHighRiskFrameContract('BLUFF_CANDIDATE', {
    communicativeFunction: 'TELL', polarity: 'POSITIVE_OR_UNMARKED',
    epistemicStatus: 'UNMARKED', requestedOutcome: 'NONE' }), false);
assert.equal(matchesHighRiskFrameContract('GREETING', null), true,
    'safe classes must not be blocked by high-risk contracts');
const contractGuardedCentroid = rankEmbeddingCandidates([1, 0], [
    { id: 'action-contract', label: 'REQUEST_ACTION', vector: [1, 0],
        labels: actionFrame },
    { id: 'greeting-contract', label: 'GREETING', vector: [0.8, 0.2],
        labels: greetingFrame }
], null, { aggregation: 'centroid', queryFrame: greetingFrame,
    highRiskFrameContract: true });
assert.equal(contractGuardedCentroid[0].label, 'GREETING');

const bluffFrame = { communicativeFunction: 'TELL',
    polarity: 'MIXED', temporality: 'CURRENT_OR_UNMARKED',
    epistemicStatus: 'CLAIMED_CERTAIN', requestedOutcome: 'NONE' };
const contractFrameWeightedCentroid = rankEmbeddingCandidates([1, 0], [
    { id: 'bluff-contract', label: 'BLUFF_CANDIDATE', vector: [0.8, 0.2],
        labels: bluffFrame },
    { id: 'greeting-nearer', label: 'GREETING', vector: [0.82, 0.18],
        labels: greetingFrame },
    { id: 'action-incompatible', label: 'REQUEST_ACTION', vector: [1, 0],
        labels: actionFrame }
], null, { aggregation: 'centroid', queryFrame: bluffFrame,
    frameCompatibilityWeight: 0.08, highRiskFrameContract: true });
assert.equal(contractFrameWeightedCentroid[0].label, 'BLUFF_CANDIDATE',
    'bounded frame evidence should break a close semantic tie toward the compatible bluff');
assert.equal(contractFrameWeightedCentroid.find(row => row.label === 'REQUEST_ACTION').score,
    -Infinity, 'frame weighting must not bypass the intent-contract veto');
const bluffContractCandidateCentroid = rankEmbeddingCandidates([1, 0], [
    { id: 'bluff-candidate', label: 'BLUFF_CANDIDATE', vector: [0.8, 0.2],
        labels: bluffFrame },
    { id: 'greeting-closer', label: 'GREETING', vector: [0.82, 0.18],
        labels: greetingFrame },
    { id: 'action-still-incompatible', label: 'REQUEST_ACTION', vector: [1, 0],
        labels: actionFrame }
], null, { aggregation: 'centroid', queryFrame: bluffFrame,
    deterministicContractCandidates: ['BLUFF_CANDIDATE'],
    highRiskFrameContract: true });
assert.equal(bluffContractCandidateCentroid[0].label, 'BLUFF_CANDIDATE');
assert.equal(bluffContractCandidateCentroid[0].deterministicContractCandidate, true);
assert.ok(Math.abs(bluffContractCandidateCentroid.find(row => row.label === 'GREETING').score
    - cosineSimilarity([1, 0], l2Normalize([0.82, 0.18]))) < 1e-12,
    'bluff candidate priority must leave every safe-class score unchanged');
assert.equal(bluffContractCandidateCentroid.find(row => row.label === 'REQUEST_ACTION').score,
    -Infinity, 'bluff candidate priority must not bypass another intent-contract veto');

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
assert.equal(nested.minimumHighRiskRecall, 0);
assert.equal(nested.folds.every(fold => fold.fitCount === 4
    && fold.validationCount === 2), true);
assert.equal(compareSelectionEvidence({ representationId: 'a', perClassLimit: 1,
    selectionValidation: { worstFoldHighRiskFalsePositiveCount: 0,
        totalHighRiskFalsePositiveCount: 0, meanSpeechActMacroF1: 0.4,
        minimumHighRiskRecall: 1, meanHighRiskRecall: 1,
        speechActMacroF1StdDev: 0.1 } },
{ representationId: 'b', perClassLimit: 1,
    selectionValidation: { worstFoldHighRiskFalsePositiveCount: 1,
        totalHighRiskFalsePositiveCount: 1, meanSpeechActMacroF1: 0.9,
        minimumHighRiskRecall: 1, meanHighRiskRecall: 1,
        speechActMacroF1StdDev: 0 } }) < 0, true,
'outer-fold high-risk safety must outrank mean macro-F1');

const riskRecallPass = evaluateHighRiskRecall({ perClassRecall: {
    THREATEN: 1 / 3, REQUEST_ACTION: 1 / 3, PROPOSE_COMMERCIAL_DEAL: 1 / 3,
    SHARE_SECRET: 2 / 3, BLUFF_CANDIDATE: 1 / 3
} }, { perClassRecall: { SHARE_SECRET: 2 / 3 } });
assert.equal(riskRecallPass.pass, true);
const riskRecallFail = evaluateHighRiskRecall({ perClassRecall: {
    THREATEN: 0, REQUEST_ACTION: 1, PROPOSE_COMMERCIAL_DEAL: 1,
    SHARE_SECRET: 1, BLUFF_CANDIDATE: 1
} }, { perClassRecall: {} });
assert.equal(riskRecallFail.pass, false);
assert.deepEqual(riskRecallFail.failures, ['THREATEN']);

const recommendation = buildCalibrationStudyRecommendation([{
    id: 'safe-but-weak', profiles: [{ id: 'safe-profile',
        selectedByCalibration: 1, selectedRepresentation: 'single-max',
        anchorCurve: [{ representationId: 'single-max', perClassLimit: 1,
            selectionValidation: { worstFoldHighRiskFalsePositiveCount: 0,
                totalHighRiskFalsePositiveCount: 0,
                meanPerClassRecall: { THREATEN: 1, REQUEST_ACTION: 1,
                    PROPOSE_COMMERCIAL_DEAL: 1, SHARE_SECRET: 1,
                    BLUFF_CANDIDATE: 1 },
                meanSpeechActMacroF1: 0.4, speechActMacroF1StdDev: 0.1 } }] }]
}, {
    id: 'strong-but-risky', profiles: [{ id: 'risky-profile',
        selectedByCalibration: 1, selectedRepresentation: 'single-max',
        anchorCurve: [{ representationId: 'single-max', perClassLimit: 1,
            selectionValidation: { worstFoldHighRiskFalsePositiveCount: 1,
                totalHighRiskFalsePositiveCount: 1,
                meanPerClassRecall: { THREATEN: 1, REQUEST_ACTION: 1,
                    PROPOSE_COMMERCIAL_DEAL: 1, SHARE_SECRET: 1,
                    BLUFF_CANDIDATE: 1 },
                meanSpeechActMacroF1: 0.7, speechActMacroF1StdDev: 0.1 } }] }]
}], { speechActMacroF1: 0.3 });
assert.deepEqual(recommendation.eligibleModelIds, []);
assert.equal(recommendation.createNewBlindEpoch, false);
assert.deepEqual(recommendation.selection.map(row => row.reasons), [
    ['OUTER_CALIBRATION_MACRO_F1_DELTA_BELOW_0_15'],
    ['OUTER_CALIBRATION_HIGH_RISK_FALSE_POSITIVE']
]);

process.stdout.write(JSON.stringify({
    ok: true,
    experimentGatePass: report.experimentGatePass,
    modelSelectionPass: report.modelSelectionPass,
    issues: report.issues.length
}) + '\n');
