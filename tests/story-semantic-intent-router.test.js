'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { buildEmbeddingSpikePreflight, l2Normalize, dotProduct, cosineSimilarity,
    frameCompatibility, matchesHighRiskFrameContract,
    matchesAuthoritativeSpeechActContract, hasBoundedDomainGrounding,
    matchesBoundedDomainFrameContract, selectEmbeddingRepresentations,
    selectPrototypeAnchors,
    buildPrototypeClassCentroids, rankEmbeddingCandidates, fitEmbeddingCalibration,
    buildStratifiedCalibrationFolds, crossValidateEmbeddingCalibration,
    compareSelectionEvidence, summarizeEmbeddingRows, embeddingEvaluationSplits,
    embeddingCalibrationStudySplits, evaluateHighRiskRecall,
    buildBlindEvaluationAcceptance, buildCalibrationStudyRecommendation } =
    require('../tools/story-semantic-intent-benchmark');
const corpus = require('../tools/story-semantic-intent-corpus.json');

const blindV5CandidateRows = corpus.candidates.filter(row =>
    String(row.sourceId || '').startsWith('representation-stability-v5:'));
assert.equal(blindV5CandidateRows.length, 51);
assert.equal(new Set(blindV5CandidateRows.map(row => row.familyId)).size, 51);
assert.equal(new Set(blindV5CandidateRows.map(row => row.text)).size, 51);
assert.ok(blindV5CandidateRows.every(row => row.split === 'blind_test'
    && row.sourceType === 'MODEL_GENERATED_CANDIDATE'
    && row.labelStatus === 'CANDIDATE_UNREVIEWED'));
assert.equal(blindV5CandidateRows.filter(row => row.adjudication).length, 36);
assert.equal(blindV5CandidateRows.filter(row => !row.adjudication).length, 15);
assert.ok(blindV5CandidateRows.filter(row => row.adjudication).every(row =>
    row.adjudication.reviewer === 'CODEX_INDIVIDUAL_REVIEW'),
    'Only individually reviewed V5 candidates may become gold');
assert.deepEqual(Object.fromEntries([...new Set(blindV5CandidateRows.map(row =>
    row.proposalSpeechAct))].sort().map(label => [label,
    blindV5CandidateRows.filter(row => row.proposalSpeechAct === label).length])), {
    ASK_INFORMATION: 3,
    ASK_PERSONAL_OPINION: 3,
    BLUFF_CANDIDATE: 3,
    CHALLENGE: 3,
    CORRECT_STATEMENT: 3,
    GREETING: 3,
    MAKE_PROMISE: 3,
    OFFER_SUPPORT: 3,
    PROPOSE_COMMERCIAL_DEAL: 3,
    REJECT: 3,
    REPORT_ECONOMIC: 3,
    REPORT_MILITARY: 3,
    REQUEST_ACTION: 3,
    SHARE_SECRET: 3,
    SMALL_TALK: 3,
    THREATEN: 3,
    UNKNOWN: 3
});
assert.equal(corpus.representationEvaluationPolicy.epoch,
    'representation-stability-v4');
assert.equal(corpus.representationEvaluationPolicy.blindStatus,
    'SPENT_AFTER_2026_09_01_V4_ONE_SHOT');

const directionalRiskCalibrationRows = corpus.candidates.filter(row =>
    String(row.sourceId || '').startsWith(
        'representation-stability-v1:directional-risk-v2:'));
assert.equal(directionalRiskCalibrationRows.length, 20);
assert.ok(directionalRiskCalibrationRows.every(row => row.split === 'calibration'));
assert.equal(new Set(directionalRiskCalibrationRows.map(row => row.familyId)).size, 20);
assert.equal(new Set(directionalRiskCalibrationRows.map(row => row.text)).size, 20);
const directionalRiskReviewed = directionalRiskCalibrationRows.filter(row =>
    row.adjudication && row.adjudication.reviewer === 'CODEX_INDIVIDUAL_REVIEW');
assert.equal(directionalRiskReviewed.length, 20);
assert.equal(directionalRiskCalibrationRows.filter(row => !row.adjudication).length, 0);
assert.deepEqual(Object.fromEntries([...new Set(directionalRiskReviewed.map(row =>
    row.adjudication.labels.speechAct))].sort().map(label => [label,
    directionalRiskReviewed.filter(row =>
        row.adjudication.labels.speechAct === label).length])), {
    ACCUSE: 3,
    ASK_INFORMATION: 1,
    BLUFF_CANDIDATE: 3,
    CHALLENGE: 1,
    MAKE_PROMISE: 1,
    OFFER_SUPPORT: 1,
    PROPOSE_COMMERCIAL_DEAL: 1,
    REJECT: 1,
    REPORT_ECONOMIC: 1,
    REPORT_MILITARY: 1,
    REQUEST_ACTION: 1,
    SHARE_SECRET: 3,
    SMALL_TALK: 1,
    THREATEN: 1
});

const blindV4Rows = corpus.candidates.filter(row => String(row.sourceId || '')
    .startsWith('representation-stability-v4:'));
const blindV4Gold = blindV4Rows.filter(row => row.adjudication);
assert.equal(blindV4Rows.length, 51);
assert.equal(new Set(blindV4Rows.map(row => row.familyId)).size, 51);
assert.equal(new Set(blindV4Rows.map(row => row.text)).size, 51);
assert.equal(blindV4Gold.length, 51);
assert.ok(blindV4Gold.every(row =>
    row.adjudication.reviewer === 'CODEX_INDIVIDUAL_REVIEW'));
assert.deepEqual(Object.fromEntries([...new Set(blindV4Gold.map(row =>
    row.adjudication.labels.speechAct))].sort().map(label => [label,
    blindV4Gold.filter(row => row.adjudication.labels.speechAct === label).length])), {
    ASK_INFORMATION: 3,
    ASK_PERSONAL_OPINION: 3,
    BLUFF_CANDIDATE: 3,
    CHALLENGE: 3,
    CORRECT_STATEMENT: 3,
    GREETING: 3,
    MAKE_PROMISE: 3,
    OFFER_SUPPORT: 3,
    PROPOSE_COMMERCIAL_DEAL: 3,
    REJECT: 3,
    REPORT_ECONOMIC: 3,
    REPORT_MILITARY: 3,
    REQUEST_ACTION: 3,
    SHARE_SECRET: 3,
    SMALL_TALK: 3,
    THREATEN: 3,
    UNKNOWN: 3
});

assert.deepEqual(selectEmbeddingRepresentations([
    'bounded-domain-contract-bluff-centroid-guard'
]).map(row => row.id), ['bounded-domain-contract-bluff-centroid-guard']);
assert.deepEqual(selectEmbeddingRepresentations([
    'bounded-domain-authoritative-high-risk-centroid-guard'
]).map(row => row.id), ['bounded-domain-authoritative-high-risk-centroid-guard']);
assert.throws(() => selectEmbeddingRepresentations(['not-a-representation']),
    /EMBEDDING_REPRESENTATION_UNKNOWN:not-a-representation/);

const report = buildEmbeddingSpikePreflight();
const oodTaxonomyRows = corpus.candidates.filter(row =>
    String(row.id).startsWith('semantic-intent:oodtax'));
assert.equal(oodTaxonomyRows.length, 24);
assert.deepEqual(Object.fromEntries(['prototype', 'calibration', 'blind_test']
    .map(split => [split, oodTaxonomyRows.filter(row => row.split === split).length])),
{ prototype: 12, calibration: 12, blind_test: 0 });
assert.equal(new Set(oodTaxonomyRows.map(row => row.familyId)).size, 24,
    'OOD taxonomy rows must remain independent families');
assert.ok(oodTaxonomyRows.every(row => row.adjudication
    && row.adjudication.reviewer === 'CODEX_INDIVIDUAL_REVIEW'
    && row.adjudication.labels.speechAct === 'UNKNOWN'
    && row.adjudication.labels.outOfDomain === true),
'every OOD taxonomy row must remain individually reviewed UNKNOWN gold');
assert.ok(oodTaxonomyRows.filter(row => row.split === 'calibration').every(row =>
    row.sourceId.startsWith('representation-stability-v1:ood-taxonomy:')),
'OOD calibration taxonomy must remain inside calibration and outside blind v2');

assert.equal(report.ok, true);
assert.equal(report.experimentGatePass, true);
assert.equal(report.gold.total, 524);
assert.deepEqual(report.gold.bySplit, {
    prototype: 111,
    calibration: 128,
    blind_test: 285
});
assert.equal(report.modelSelectionPass, true);
assert.equal(report.representationSelectionPass, true);
assert.equal(report.untouchedEvaluationPass, false);
assert.equal(report.representationSupport.minimumPerClassPerSplit, 3);
assert.deepEqual(report.representationSupport.issues, []);
assert.deepEqual(report.untouchedEvaluation.gold, {
    total: 144,
    bySplit: { prototype: 10, calibration: 83, blind_test: 51 }
});
assert.equal(report.untouchedEvaluation.minimumPerClassPerEvaluationSplit, 3);
assert.equal(report.untouchedEvaluation.blindStatus,
    'SPENT_AFTER_2026_09_01_V4_ONE_SHOT');
assert.equal(report.untouchedEvaluation.priorBlindStatus,
    'SPENT_AFTER_2026_09_01_V3_ONE_SHOT');
assert.deepEqual(report.untouchedEvaluation.evaluatedModelIds,
    ['bge-m3-q8_0']);
assert.deepEqual(report.untouchedEvaluation.issues,
    ['UNTOUCHED_EVALUATION_ALREADY_SPENT:SPENT_AFTER_2026_09_01_V4_ONE_SHOT']);
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
    report.untouchedEvaluation);
assert.equal(corpus.representationEvaluationPolicy.epoch,
    'representation-stability-v4');
assert.equal(corpus.representationEvaluationPolicy.blindStatus,
    'SPENT_AFTER_2026_09_01_V4_ONE_SHOT');
assert.equal(corpus.representationEvaluationPolicy.evaluatedAt,
    '2026-09-01T11:38:13.828Z');
assert.deepEqual(corpus.representationEvaluationPolicy.evaluatedModelIds,
    ['bge-m3-q8_0']);
assert.deepEqual(corpus.representationEvaluationPolicy.evaluatedRepresentationIds,
    ['bounded-domain-authoritative-high-risk-centroid-guard']);
assert.deepEqual(corpus.representationEvaluationPolicy.evaluationAcceptedModelIds, []);
assert.equal(corpus.representationEvaluationPolicy.evaluationPass, false);
assert.deepEqual(Object.fromEntries(Object.entries(evaluationSplits)
    .map(([split, rows]) => [split, rows.length])), {
    prototype: 111,
    calibration: 83,
    blind_test: 51
});
assert.ok(evaluationSplits.calibration.every(row =>
    row.sourceId.startsWith('representation-stability-v1:')));
assert.ok(evaluationSplits.blind_test.every(row =>
    row.sourceId.startsWith('representation-stability-v4:')));
const sealedBlindCanonical = evaluationSplits.blind_test
    .slice().sort((a, b) => a.sourceId.localeCompare(b.sourceId))
    .map(row => ({ id: row.id, sourceId: row.sourceId, familyId: row.familyId,
        text: row.text, labels: row.adjudication.labels }));
const sealedBlindChecksum = crypto.createHash('sha256')
    .update(JSON.stringify(sealedBlindCanonical)).digest('hex');
assert.equal(corpus.representationEvaluationPolicy.blindChecksumContract,
    'SHA256_JSON_SORTED_ID_SOURCE_FAMILY_TEXT_LABELS_V1');
assert.equal(corpus.representationEvaluationPolicy.blindChecksumSha256,
    sealedBlindChecksum);
assert.equal(corpus.representationEvaluationPolicy.blindCount,
    evaluationSplits.blind_test.length);
assert.equal(corpus.representationEvaluationPolicy.blindFamilyCount,
    new Set(evaluationSplits.blind_test.map(row => row.familyId)).size);
const calibrationStudySplits = embeddingCalibrationStudySplits(corpus,
    report.untouchedEvaluation);
assert.deepEqual(Object.fromEntries(Object.entries(calibrationStudySplits)
    .map(([split, rows]) => [split, rows.length])), {
    prototype: 111,
    calibration: 83,
    blind_test: 0
});
assert.throws(() => embeddingEvaluationSplits(corpus, ''),
    /EMBEDDING_EVALUATION_SOURCE_PREFIX_REQUIRED/);
const splitSourceEvaluation = embeddingEvaluationSplits(corpus, {
    calibrationSourceIdPrefix: 'representation-stability-v1:',
    blindSourceIdPrefix: 'sha256:'
});
assert.equal(splitSourceEvaluation.calibration.length, 83);
assert.ok(splitSourceEvaluation.blind_test.length > 0);
assert.ok(splitSourceEvaluation.calibration.every(row =>
    row.sourceId.startsWith('representation-stability-v1:')));
assert.ok(splitSourceEvaluation.blind_test.every(row =>
    row.sourceId.startsWith('sha256:')));
const splitSourceCalibration = embeddingCalibrationStudySplits(corpus, {
    calibrationSourceIdPrefix: 'representation-stability-v1:',
    blindSourceIdPrefix: 'future-sealed-blind-v2:'
});
assert.equal(splitSourceCalibration.calibration.length, 83);
assert.equal(splitSourceCalibration.blind_test.length, 0);
assert.deepEqual(report.classCoverage.missingBlindAnchors, []);
assert.deepEqual(report.classCoverage.missingBlindCalibration, []);
assert.deepEqual(report.oodBySplit, {
    prototype: { inDomain: 96, outOfDomain: 15 },
    calibration: { inDomain: 110, outOfDomain: 18 },
    blind_test: { inDomain: 270, outOfDomain: 15 }
});
assert.deepEqual(report.highRiskCoverage.THREATEN, {
    prototype: 3,
    calibration: 7,
    blind_test: 15
});
assert.deepEqual(report.highRiskCoverage.SHARE_SECRET, {
    prototype: 3,
    calibration: 9,
    blind_test: 15
});
assert.deepEqual(report.highRiskCoverage.BLUFF_CANDIDATE, {
    prototype: 3,
    calibration: 9,
    blind_test: 18
});
assert.deepEqual(report.highRiskCoverage.PROPOSE_COMMERCIAL_DEAL, {
    prototype: 3,
    calibration: 8,
    blind_test: 18
});
assert.deepEqual(report.highRiskCoverage.REQUEST_ACTION, {
    prototype: 6,
    calibration: 7,
    blind_test: 17
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
const multimodalOodAnchors = [
    { id: 'domain-centroid', label: 'GREETING', vector: [0.8, 0.6] },
    { id: 'ood-east', label: 'UNKNOWN', vector: [1, 0] },
    { id: 'ood-north', label: 'UNKNOWN', vector: [0, 1] }
];
assert.equal(rankEmbeddingCandidates([1, 0], multimodalOodAnchors, null,
    { aggregation: 'centroid' })[0].label, 'GREETING',
    'a single OOD centroid can erase a multi-modal OOD family');
const oodMaxRanked = rankEmbeddingCandidates([1, 0], multimodalOodAnchors, null,
    { aggregation: 'centroid', oodAggregation: 'max' });
assert.equal(oodMaxRanked[0].label, 'UNKNOWN',
    'nearest OOD prototype must remain an explicit abstention candidate');
assert.deepEqual(oodMaxRanked[0].anchorIds, ['ood-east']);
assert.deepEqual(rankEmbeddingCandidates([1, 0], multimodalOodAnchors.slice().reverse(),
    null, { aggregation: 'centroid', oodAggregation: 'max' }), oodMaxRanked,
    'OOD max competition must be input-order invariant');
assert.throws(() => buildPrototypeClassCentroids([
    { id: 'short', label: 'GREETING', vector: [1] },
    { id: 'long', label: 'GREETING', vector: [1, 0] }
]), /EMBEDDING_VECTOR_DIMENSION/);

const greetingFrame = { communicativeFunction: 'GREET',
    polarity: 'POSITIVE_OR_UNMARKED', temporality: 'CURRENT_OR_UNMARKED',
    epistemicStatus: 'UNMARKED', requestedOutcome: 'NONE' };
const actionFrame = { communicativeFunction: 'REQUEST',
    predicate: 'WORK',
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
assert.equal(matchesHighRiskFrameContract('REQUEST_ACTION', {
    ...actionFrame, predicate: 'WORK' }), true);
assert.equal(matchesHighRiskFrameContract('REQUEST_ACTION', {
    ...actionFrame, predicate: 'UNSPECIFIED', target: 'WORLD' }), false,
    'an unresolved out-of-domain task must not become an executable action request');
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
const unknownCandidate = { id: 'unknown-domain', label: 'UNKNOWN', vector: [0.7, 0.3],
    labels: { communicativeFunction: 'UNRESOLVED', requestedOutcome: 'NONE' } };
const domainAskFrame = { speechAct: 'ASK_INFORMATION', communicativeFunction: 'ASK',
    predicate: 'UNSPECIFIED', target: 'UNSPECIFIED', continuity: 'NEW_OR_UNMARKED',
    requestedOutcome: 'INFORMATION' };
assert.equal(hasBoundedDomainGrounding(domainAskFrame,
    { exactResolvedEntityCount: 1 }), true);
assert.equal(matchesBoundedDomainFrameContract('ASK_INFORMATION', domainAskFrame,
    { exactResolvedEntityCount: 0 }), false,
    'question shape alone must not make lexical nonsense an in-game information request');
assert.equal(matchesBoundedDomainFrameContract('ASK_INFORMATION', domainAskFrame,
    { exactResolvedEntityCount: 1 }), true,
    'an exact canonical entity must ground an otherwise unspecified game question');
assert.equal(matchesBoundedDomainFrameContract('ASK_INFORMATION', {
    ...domainAskFrame, continuity: 'REPAIR', communicativeFunction: 'TELL',
    requestedOutcome: 'NONE' }, { exactResolvedEntityCount: 0 }), true,
    'repair turns must remain valid without repeating their prior game topic');
const travelRequestFrame = { speechAct: 'REQUEST_ACTION', communicativeFunction: 'REQUEST',
    predicate: 'UNSPECIFIED', target: 'UNSPECIFIED', continuity: 'NEW_OR_UNMARKED',
    requestedOutcome: 'ACTION' };
assert.equal(matchesBoundedDomainFrameContract('SMALL_TALK', travelRequestFrame,
    { exactResolvedEntityCount: 0 }), false,
    'an ungrounded real-world request must not escape into small talk');
const basketballTellFrame = { speechAct: 'UNKNOWN', communicativeFunction: 'TELL',
    predicate: 'UNSPECIFIED', target: 'UNSPECIFIED', continuity: 'NEW_OR_UNMARKED',
    requestedOutcome: 'NONE' };
assert.equal(matchesBoundedDomainFrameContract('SMALL_TALK', basketballTellFrame,
    { exactResolvedEntityCount: 0 }), false,
    'a typo-tolerant entity resemblance must not ground an unrelated report request');
const boundedDomainRanking = rankEmbeddingCandidates([1, 0], [
    { id: 'small-talk-domain', label: 'SMALL_TALK', vector: [1, 0],
        labels: { communicativeFunction: 'TELL', requestedOutcome: 'NONE' } },
    unknownCandidate
], null, { aggregation: 'centroid', queryFrame: basketballTellFrame,
    queryGrounding: { exactResolvedEntityCount: 0 }, boundedDomainFrameContract: true });
assert.equal(boundedDomainRanking[0].label, 'UNKNOWN');
assert.equal(boundedDomainRanking.find(row => row.label === 'SMALL_TALK').score,
    -Infinity);
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

const commercialFrame = { speechAct: 'PROPOSE_COMMERCIAL_DEAL',
    communicativeFunction: 'OFFER', predicate: 'ECONOMY', target: 'LISTENER',
    polarity: 'POSITIVE_OR_UNMARKED', temporality: 'CURRENT_OR_UNMARKED',
    epistemicStatus: 'UNMARKED', continuity: 'NEW_OR_UNMARKED',
    requestedOutcome: 'ACTION' };
const authoritativeCommercial = rankEmbeddingCandidates([1, 0], [
    { id: 'request-topic-nearer', label: 'REQUEST_ACTION', vector: [1, 0],
        labels: actionFrame },
    { id: 'commercial-direction', label: 'PROPOSE_COMMERCIAL_DEAL', vector: [0.7, 0.3],
        labels: commercialFrame }
], null, { aggregation: 'centroid', queryFrame: commercialFrame,
    authoritativeSpeechActCandidates: [
        'REQUEST_ACTION', 'PROPOSE_COMMERCIAL_DEAL', 'THREATEN'
    ], highRiskFrameContract: true, boundedDomainFrameContract: true });
assert.equal(authoritativeCommercial[0].label, 'PROPOSE_COMMERCIAL_DEAL',
    'a strict commercial direction must outrank the semantically nearer action topic');
assert.equal(authoritativeCommercial[0].deterministicContractCandidate, true);

const authoritativeRequest = rankEmbeddingCandidates([1, 0], [
    { id: 'threat-topic-nearer', label: 'THREATEN', vector: [1, 0], labels: actionFrame },
    { id: 'request-direction', label: 'REQUEST_ACTION', vector: [0.72, 0.28],
        labels: actionFrame }
], null, { aggregation: 'centroid', queryFrame: {
    ...actionFrame, speechAct: 'REQUEST_ACTION', surfaceForm: 'IMPERATIVE',
    continuity: 'NEW_OR_UNMARKED', secondarySpeechActs: []
}, authoritativeSpeechActCandidates: ['REQUEST_ACTION', 'THREATEN'],
highRiskFrameContract: true });
assert.equal(authoritativeRequest[0].label, 'REQUEST_ACTION',
    'a strict request direction must outrank the semantically nearer threat topic');
assert.equal(matchesAuthoritativeSpeechActContract('REQUEST_ACTION', {
    ...actionFrame, speechAct: 'REQUEST_ACTION', surfaceForm: 'INTERROGATIVE',
    continuity: 'NEW_OR_UNMARKED', secondarySpeechActs: ['ASK_INFORMATION']
}), false, 'an information question misparsed as a request must not gain authority');
assert.equal(matchesAuthoritativeSpeechActContract('REQUEST_ACTION', {
    ...actionFrame, speechAct: 'REQUEST_ACTION', surfaceForm: 'IMPERATIVE',
    continuity: 'CORRECTION', secondarySpeechActs: []
}), false, 'a correction misparsed as an imperative must not gain request authority');

const inconsistentCommercial = rankEmbeddingCandidates([1, 0], [
    { id: 'request-consistent', label: 'REQUEST_ACTION', vector: [1, 0],
        labels: actionFrame },
    { id: 'commercial-inconsistent', label: 'PROPOSE_COMMERCIAL_DEAL', vector: [0.7, 0.3],
        labels: commercialFrame }
], null, { aggregation: 'centroid', queryFrame: {
    ...commercialFrame, communicativeFunction: 'REQUEST'
}, authoritativeSpeechActCandidates: ['PROPOSE_COMMERCIAL_DEAL'],
highRiskFrameContract: true });
assert.equal(inconsistentCommercial[0].label, 'REQUEST_ACTION',
    'an inconsistent deterministic direction must not receive authoritative priority');
assert.equal(inconsistentCommercial.find(row => row.label === 'PROPOSE_COMMERCIAL_DEAL').score,
    -Infinity, 'the existing high-risk contract veto must remain active');

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

const observableOodLeak = summarizeEmbeddingRows([calibrationRows[3]], {
    minimumMargin: 0,
    defaultThreshold: 0,
    classThresholds: { GREETING: 0 },
    fallbackConfidence: 0.5
});
assert.deepEqual(observableOodLeak.oodFalseAcceptanceIds, ['ood']);
assert.deepEqual(observableOodLeak.oodFalseAcceptances,
    [{ id: 'ood', predicted: 'GREETING' }],
    'OOD leakage receipts must identify both the source row and forced class');

const oodCompetingRows = [
    { id: 'safe-high', actual: 'GREETING', outOfDomain: false,
        rawPrediction: 'GREETING', score: 0.7, margin: 0.2 },
    { id: 'safe-mid', actual: 'GREETING', outOfDomain: false,
        rawPrediction: 'GREETING', score: 0.6, margin: 0.2 },
    { id: 'safe-low', actual: 'GREETING', outOfDomain: false,
        rawPrediction: 'GREETING', score: 0.5, margin: 0.2 },
    { id: 'ood-high', actual: 'UNKNOWN', outOfDomain: true,
        rawPrediction: 'GREETING', score: 0.65, margin: 0.2 }
];
const oodGuardedFit = fitEmbeddingCalibration(oodCompetingRows);
const oodGuarded = summarizeEmbeddingRows(oodCompetingRows,
    oodGuardedFit.calibration);
assert.equal(oodGuarded.oodFalseAcceptanceRate, 0,
    'class thresholds must reject OOD even when accepting it would improve class F1');
assert.equal(oodGuarded.confusion['UNKNOWN=>UNKNOWN'], 1);
assert.equal(oodGuarded.confusion['GREETING=>GREETING'], 1,
    'OOD safety must retain any cleanly separated in-domain example');

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
        worstFoldOodFalseAcceptanceRate: 0, meanOodFalseAcceptanceRate: 0,
        speechActMacroF1StdDev: 0.1 } },
{ representationId: 'b', perClassLimit: 1,
    selectionValidation: { worstFoldHighRiskFalsePositiveCount: 1,
        totalHighRiskFalsePositiveCount: 1, meanSpeechActMacroF1: 0.9,
        minimumHighRiskRecall: 1, meanHighRiskRecall: 1,
        worstFoldOodFalseAcceptanceRate: 0, meanOodFalseAcceptanceRate: 0,
        speechActMacroF1StdDev: 0 } }) < 0, true,
'outer-fold high-risk safety must outrank mean macro-F1');
assert.equal(compareSelectionEvidence({ representationId: 'ood-safe', perClassLimit: 1,
    selectionValidation: { worstFoldHighRiskFalsePositiveCount: 0,
        totalHighRiskFalsePositiveCount: 0, meanSpeechActMacroF1: 0.4,
        minimumHighRiskRecall: 1, meanHighRiskRecall: 1,
        worstFoldOodFalseAcceptanceRate: 0, meanOodFalseAcceptanceRate: 0,
        speechActMacroF1StdDev: 0.1 } },
{ representationId: 'ood-unsafe', perClassLimit: 1,
    selectionValidation: { worstFoldHighRiskFalsePositiveCount: 0,
        totalHighRiskFalsePositiveCount: 0, meanSpeechActMacroF1: 0.9,
        minimumHighRiskRecall: 1, meanHighRiskRecall: 1,
        worstFoldOodFalseAcceptanceRate: 1, meanOodFalseAcceptanceRate: 1 / 3,
        speechActMacroF1StdDev: 0 } }) < 0, true,
'outer-fold OOD safety must outrank mean macro-F1');

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

const blindAcceptance = buildBlindEvaluationAcceptance([{
    id: 'blind-ood-unsafe', profiles: [{ id: 'blind-profile',
        selectedByCalibration: null, selectedRepresentation: 'centroid',
        anchorCurve: [{ representationId: 'centroid', perClassLimit: null,
            anchorSelectionPolicy: 'TEST_CENTROID',
            selectionValidation: { worstFoldHighRiskFalsePositiveCount: 0,
                totalHighRiskFalsePositiveCount: 0,
                worstFoldOodFalseAcceptanceRate: 0,
                meanOodFalseAcceptanceRate: 0,
                minimumHighRiskRecall: 1, meanHighRiskRecall: 1,
                meanSpeechActMacroF1: 0.7, speechActMacroF1StdDev: 0 },
            blindTest: { speechActMacroF1: 0.6,
                highRiskFalsePositiveCount: 0, oodFalseAcceptanceRate: 1,
                perClassRecall: { THREATEN: 1, REQUEST_ACTION: 1,
                    PROPOSE_COMMERCIAL_DEAL: 1, SHARE_SECRET: 1,
                    BLUFF_CANDIDATE: 1 } } }] }]
}], { speechActMacroF1: 0.3, perClassRecall: {} });
assert.equal(blindAcceptance[0].qualityPass, true);
assert.equal(blindAcceptance[0].highRiskPass, true);
assert.equal(blindAcceptance[0].highRiskRecall.pass, true);
assert.equal(blindAcceptance[0].oodPass, false);
assert.equal(blindAcceptance[0].pass, false);
assert.deepEqual(blindAcceptance[0].reasons, ['BLIND_OOD_FALSE_ACCEPTANCE']);

const recommendation = buildCalibrationStudyRecommendation([{
    id: 'safe-but-weak', profiles: [{ id: 'safe-profile',
        selectedByCalibration: 1, selectedRepresentation: 'single-max',
        anchorCurve: [{ representationId: 'single-max', perClassLimit: 1,
            selectionValidation: { worstFoldHighRiskFalsePositiveCount: 0,
                totalHighRiskFalsePositiveCount: 0,
                worstFoldOodFalseAcceptanceRate: 0,
                meanOodFalseAcceptanceRate: 0,
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
                worstFoldOodFalseAcceptanceRate: 0,
                meanOodFalseAcceptanceRate: 0,
                meanPerClassRecall: { THREATEN: 1, REQUEST_ACTION: 1,
                    PROPOSE_COMMERCIAL_DEAL: 1, SHARE_SECRET: 1,
                    BLUFF_CANDIDATE: 1 },
                meanSpeechActMacroF1: 0.7, speechActMacroF1StdDev: 0.1 } }] }]
}, {
    id: 'strong-but-ood-unsafe', profiles: [{ id: 'ood-unsafe-profile',
        selectedByCalibration: 1, selectedRepresentation: 'single-max',
        anchorCurve: [{ representationId: 'single-max', perClassLimit: 1,
            selectionValidation: { worstFoldHighRiskFalsePositiveCount: 0,
                totalHighRiskFalsePositiveCount: 0,
                worstFoldOodFalseAcceptanceRate: 1,
                meanOodFalseAcceptanceRate: 1 / 3,
                meanPerClassRecall: { THREATEN: 1, REQUEST_ACTION: 1,
                    PROPOSE_COMMERCIAL_DEAL: 1, SHARE_SECRET: 1,
                    BLUFF_CANDIDATE: 1 },
                meanSpeechActMacroF1: 0.7, speechActMacroF1StdDev: 0.1 } }] }]
}], { speechActMacroF1: 0.3 });
assert.deepEqual(recommendation.eligibleModelIds, []);
assert.equal(recommendation.createNewBlindEpoch, false);
assert.deepEqual(recommendation.selection.map(row => row.reasons), [
    ['OUTER_CALIBRATION_MACRO_F1_DELTA_BELOW_0_15'],
    ['OUTER_CALIBRATION_HIGH_RISK_FALSE_POSITIVE'],
    ['OUTER_CALIBRATION_OOD_FALSE_ACCEPTANCE']
]);

process.stdout.write(JSON.stringify({
    ok: true,
    experimentGatePass: report.experimentGatePass,
    modelSelectionPass: report.modelSelectionPass,
    issues: report.issues.length
}) + '\n');
