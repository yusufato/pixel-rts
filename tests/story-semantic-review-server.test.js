'use strict';

const assert = require('node:assert/strict');
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
assert.equal(corpusValidation.count, 361);
assert.equal(corpusValidation.uniqueTexts, 361);

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
assert.equal(inventory.inventory.candidates, 361);
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
