'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const review = require('../tools/story-semantic-review-server');
const benchmark = require('../tools/story-semantic-intent-benchmark');
const corpus = require('../tools/story-semantic-intent-corpus.json');

const queue = { rows: [{ id: 'semantic-teacher:0001' }] };
const axes = ['communicativeFunction', 'surfaceForm', 'predicate'];
assert.equal(review.validateReview({ id: 'semantic-teacher:0001', verdict: 'ACCEPT',
    approvedAxes: axes, notes: 'Doğal.' }, queue).ok, true);
assert.equal(review.validateReview({ id: 'semantic-teacher:0001', verdict: 'ACCEPT',
    approvedAxes: ['predicate'] }, queue).code, 'CORE_AXES_REQUIRED');
assert.equal(review.validateReview({ id: 'semantic-teacher:9999', verdict: 'REJECT',
    approvedAxes: [] }, queue).code, 'UNKNOWN_ID');
assert.equal(review.validateReview({ id: 'semantic-teacher:0001', verdict: 'EDIT',
    correctedUtterance: '', approvedAxes: axes }, queue).code, 'EDIT_TEXT_REQUIRED');

const corpusValidation = benchmark.validateCorpus(corpus);
assert.equal(corpusValidation.ok, true, corpusValidation.issues.join(', '));
assert.equal(corpusValidation.count, 720);
assert.equal(corpusValidation.uniqueTexts, 720);
const v3Candidates = corpus.candidates.filter(row =>
    String(row.sourceId || '').startsWith('representation-stability-v3:'));
assert.equal(v3Candidates.length, 51);
assert.equal(new Set(v3Candidates.map(row => row.familyId)).size, 51);
assert.ok(v3Candidates.every(row => row.split === 'blind_test'
    && row.labelStatus === 'CANDIDATE_UNREVIEWED'));
assert.equal(v3Candidates.filter(row => row.adjudication).length, 51);
assert.equal(v3Candidates.filter(row => !row.adjudication).length, 0);
assert.ok(v3Candidates.filter(row => row.adjudication).every(row =>
    row.adjudication.reviewer === 'CODEX_INDIVIDUAL_REVIEW'
    && benchmark.validateLabels(row.adjudication.labels).ok),
'only individually reviewed, fully labeled v3 rows may become gold');

const externalReviewRoot = path.join(__dirname, '..', 'qa-runtime',
    'external-ai-reviews');
const geminiBatch = require('../qa-runtime/external-ai-reviews/external-review-0003/input.json');
const geminiOutput = require('../qa-runtime/external-ai-reviews/external-review-0003/gemini-3-8-flash.json');
const priorExternalRows = [
    require('../qa-runtime/external-ai-reviews/external-review-0001/input.json'),
    require('../qa-runtime/external-ai-reviews/external-review-0002/input.json')
].flatMap(batch => batch.records || []);
const allowedExternalFields = ['familyId', 'history', 'id', 'speakerFamily', 'split', 'text'];
assert.equal(geminiBatch.schemaVersion, 1);
assert.equal(geminiBatch.kind, 'EXTERNAL_SEMANTIC_REVIEW_INPUT');
assert.equal(geminiBatch.batchId, 'external-review-0003');
assert.equal(geminiBatch.records.length, 100);
assert.equal(new Set(geminiBatch.records.map(row => row.id)).size, 100);
assert.equal(new Set(geminiBatch.records.map(row => row.familyId)).size, 100);
assert.ok(geminiBatch.records.every(row =>
    JSON.stringify(Object.keys(row).sort()) === JSON.stringify(allowedExternalFields)
    && ['prototype', 'calibration'].includes(row.split)
    && Array.isArray(row.history)));
const priorExternalIds = new Set(priorExternalRows.map(row => row.id));
const priorExternalFamilies = new Set(priorExternalRows.map(row => row.familyId));
assert.ok(geminiBatch.records.every(row =>
    !priorExternalIds.has(row.id) && !priorExternalFamilies.has(row.familyId)));
const sourceById = new Map(corpus.candidates.map(row => [row.id, row]));
assert.ok(geminiBatch.records.every(row => {
    const source = sourceById.get(row.id);
    return source && source.split !== 'blind_test'
        && source.adjudication
        && source.adjudication.reviewer === 'CODEX_INDIVIDUAL_REVIEW'
        && allowedExternalFields.every(field =>
            JSON.stringify(row[field]) === JSON.stringify(source[field]));
}));
assert.equal(geminiOutput.schemaVersion, 1);
assert.equal(geminiOutput.kind, 'EXTERNAL_SEMANTIC_INDIVIDUAL_REVIEW');
assert.equal(geminiOutput.batchId, geminiBatch.batchId);
assert.equal(geminiOutput.reviewer, 'Gemini-3.8-Flash');
assert.equal(geminiOutput.role, 'LABELER');
assert.equal(geminiOutput.protocolStatus, 'COMPLETE');
assert.equal(geminiOutput.consensusEligible, false);
assert.equal(geminiOutput.records.length, 100);
assert.equal(geminiOutput.evaluatedIds.length, 100);
assert.equal(new Set(geminiOutput.records.map(row => row.id)).size, 100);
assert.deepEqual(new Set(geminiOutput.records.map(row => row.id)),
    new Set(geminiBatch.records.map(row => row.id)));
assert.deepEqual(new Set(geminiOutput.evaluatedIds),
    new Set(geminiBatch.records.map(row => row.id)));
const geminiDecisionCounts = Object.fromEntries([
    'ACCEPT', 'NEEDS_REVIEW', 'SEMANTIC_NEAR_DUPLICATE'
].map(decision => [decision, geminiOutput.records.filter(row =>
    row.decision === decision).length]));
assert.deepEqual(geminiDecisionCounts, {
    ACCEPT: 91, NEEDS_REVIEW: 0, SEMANTIC_NEAR_DUPLICATE: 9
});
assert.equal(geminiOutput.summary.reviewed, geminiOutput.records.length);
assert.equal(geminiOutput.summary.accepted, geminiDecisionCounts.ACCEPT);
assert.equal(geminiOutput.summary.needsReview, geminiDecisionCounts.NEEDS_REVIEW);
assert.equal(geminiOutput.summary.semanticNearDuplicates,
    geminiDecisionCounts.SEMANTIC_NEAR_DUPLICATE);
assert.ok(geminiOutput.records.every(row => row.decision !== 'ACCEPT'
    ? row.labels == null : benchmark.validateLabels(row.labels).ok));
const externalProtocol = fs.readFileSync(path.join(externalReviewRoot, 'PROTOCOL.md'), 'utf8');
assert.match(externalProtocol, /ACTIVE_BATCH_ID: external-review-0003/);
assert.match(externalProtocol, /Gemini-3\.8-Flash:[\s\S]*?STATUS: CLOSED[\s\S]*?CONSENSUS_ELIGIBLE: false[\s\S]*?EXPECTED_RECORD_COUNT: 100[\s\S]*?EXPECTED_UNIQUE_FAMILY_COUNT: 100/);

const candidate = Object.assign({}, corpus.candidates[0]);
delete candidate.adjudication;
const labels = Object.fromEntries(Object.entries(benchmark.LABEL_VALUES)
    .map(([axis, values]) => [axis, values[0]]));
labels.outOfDomain = false;
labels.secondarySpeechActs = [];
const corpusQueue = review.buildQueue({
    teacher: { results: [] },
    quality: { results: [] },
    reviews: { reviews: [] },
    corpus: { candidates: [candidate],
        gates: { prototypeHumanGold: 100, productHumanGold: 1000 } },
    proposals: new Map([[candidate.id, {
        labels, confidenceBps: 5000, source: 'TEST_PROPOSAL'
    }]])
});
assert.equal(corpusQueue.rows.length, 1);
assert.equal(corpusQueue.rows[0].annotationMode, 'FULL_LABEL_V1');
assert.equal(corpusQueue.status.humanGold, 0);
assert.equal(corpusQueue.status.codexGold, 0);
assert.equal(corpusQueue.status.gold, 0);
assert.equal(corpusQueue.status.prototype.pass, false);

const fullAccepted = review.validateReview({
    id: candidate.id, verdict: 'ACCEPT', labels, notes: 'İnsan tarafından kontrol edildi.'
}, corpusQueue);
assert.equal(fullAccepted.ok, true);
assert.equal(fullAccepted.value.annotationContractVersion, 1);
assert.equal(fullAccepted.value.reviewer, 'LOCAL_HUMAN');
assert.equal(benchmark.isHumanGoldReview(fullAccepted.value, new Set([candidate.id])), true);
assert.equal(benchmark.isGoldReview(fullAccepted.value, new Set([candidate.id])), true);

const codexAccepted = Object.assign({}, fullAccepted.value, {
    reviewer: 'CODEX_INDIVIDUAL_REVIEW'
});
assert.equal(benchmark.isHumanGoldReview(codexAccepted, new Set([candidate.id])), false);
assert.equal(benchmark.isGoldReview(codexAccepted, new Set([candidate.id])), true);

const geminiAssisted = Object.assign({}, codexAccepted, {
    generator: 'Gemini-3.8-Flash',
    candidateConfidence: 'HIGH',
    adjudicator: 'CODEX_INDIVIDUAL_REVIEW',
    adjudicationVerdict: codexAccepted.verdict,
    goldStatus: 'VERIFIED_GOLD'
});
assert.deepEqual(benchmark.validateAssistedGoldProvenance(geminiAssisted), {
    ok: true, assisted: true, issues: []
});
assert.equal(benchmark.isGoldReview(geminiAssisted, new Set([candidate.id])), true);
const rawGeminiCandidate = Object.assign({}, geminiAssisted, {
    reviewer: 'Gemini-3.8-Flash', adjudicator: 'Gemini-3.8-Flash'
});
assert.equal(benchmark.isGoldReview(rawGeminiCandidate, new Set([candidate.id])), false,
    'A Gemini candidate cannot adjudicate itself into gold.');
const partialAssistance = Object.assign({}, codexAccepted, {
    generator: 'Gemini-3.8-Flash'
});
assert.equal(benchmark.validateAssistedGoldProvenance(partialAssistance).ok, false,
    'Partial assisted-gold provenance must fail closed.');
const partialHumanAssistance = Object.assign({}, fullAccepted.value, {
    generator: 'Gemini-3.8-Flash'
});
assert.equal(benchmark.isHumanGoldReview(partialHumanAssistance,
    new Set([candidate.id])), false,
    'Human gold must also reject partial assisted provenance.');

const oppositeActionFamilies = benchmark.classifyErrorFamilies({
    ...labels, speechAct: 'THREATEN', communicativeFunction: 'REQUEST',
    polarity: 'POSITIVE_OR_UNMARKED', epistemicStatus: 'UNMARKED'
}, {
    ...labels, speechAct: 'ASK_INFORMATION', communicativeFunction: 'ASK',
    polarity: 'NEGATIVE', epistemicStatus: 'HYPOTHETICAL'
});
assert.deepEqual(oppositeActionFamilies, [
    'SPEECH_ACT_DISAMBIGUATION', 'COMMUNICATIVE_FUNCTION', 'POLARITY',
    'EPISTEMIC_STATUS'
]);
assert.equal(oppositeActionFamilies.some(id => id.includes('THREATEN')), false,
    'Error families must describe reusable failure logic, not memorize a sentence or label pair.');

const incomplete = Object.assign({}, labels);
delete incomplete.predicate;
assert.equal(review.validateReview({
    id: candidate.id, verdict: 'ACCEPT', labels: incomplete
}, corpusQueue).code, 'FULL_LABELS_REQUIRED');
assert.equal(review.validateReview({
    id: candidate.id, verdict: 'REJECT', notes: 'Doğal veya tek anlamlı değil.'
}, corpusQueue).ok, true);

const unreviewedCorpus = Object.assign({}, corpus, {
    candidates: corpus.candidates.map(row => {
        const copy = Object.assign({}, row);
        delete copy.adjudication;
        return copy;
    })
});
const inventory = benchmark.buildBenchmark({
    corpus: unreviewedCorpus, reviews: { reviews: [] }, includePredictions: false
});
assert.equal(inventory.ok, true);
assert.equal(inventory.inventory.candidates, 720);
assert.equal(inventory.inventory.humanGold, 0);
assert.equal(inventory.inventory.codexGold, 0);
assert.equal(inventory.inventory.gold, 0);
assert.equal(inventory.gates.prototype.threshold, 100);
assert.equal(inventory.gates.prototype.pass, false);
assert.equal(inventory.gates.product.pass, false);

const measured = benchmark.buildBenchmark({
    corpus, reviews: { reviews: [] },
    proposals: new Map(corpus.candidates.filter(row => row.adjudication).map(row => [row.id, {
        labels: row.id === corpus.candidates[0].id ? row.adjudication.labels : labels,
        confidenceBps: 5000, source: 'TEST_PROPOSAL'
    }]))
});
assert.ok(Object.keys(measured.baseline.errorFamilies).every(id =>
    benchmark.ERROR_FAMILY_DEFINITIONS[id]));
assert.equal(measured.baseline.errorFamilies.OUT_OF_DOMAIN_GATE.exampleIds.length <= 5, true);

console.log(JSON.stringify({ ok: true, candidates: corpusValidation.count,
    families: corpusValidation.familyCount, prototypeGold: inventory.inventory.humanGold }));
