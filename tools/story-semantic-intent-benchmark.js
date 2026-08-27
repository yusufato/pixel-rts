'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_CORPUS_PATH = path.join(__dirname, 'story-semantic-intent-corpus.json');
const DEFAULT_REVIEWS_PATH = path.join(ROOT, 'qa-runtime',
    'story-conversation-semantic-human-reviews.json');

const LABEL_VALUES = Object.freeze({
    speechAct: Object.freeze([
        'ASK_INFORMATION', 'PROPOSE_COMMERCIAL_DEAL', 'THREATEN', 'MAKE_PROMISE',
        'SHARE_SECRET', 'BLUFF_CANDIDATE', 'ACCUSE', 'REQUEST_ACTION',
        'OFFER_SUPPORT', 'COUNTER_OFFER', 'REJECT', 'GREETING', 'CHECK_IN',
        'THANK', 'APOLOGIZE', 'FAREWELL', 'ASK_PERSONAL_OPINION',
        'SMALL_TALK', 'REQUEST_SUPPORT', 'ASK_RELATIONSHIP', 'REPORT_MILITARY',
        'REPORT_ECONOMIC', 'CORRECT_STATEMENT', 'CHALLENGE', 'UNKNOWN'
    ]),
    communicativeFunction: Object.freeze([
        'ASK', 'TELL', 'REQUEST', 'OFFER', 'REJECT', 'CONFIDE', 'CORRECT',
        'REPAIR', 'CLOSE', 'GREET', 'THANK', 'APOLOGIZE', 'UNRESOLVED'
    ]),
    surfaceForm: Object.freeze([
        'INTERROGATIVE', 'DECLARATIVE', 'IMPERATIVE', 'EXCLAMATORY', 'FRAGMENT'
    ]),
    predicate: Object.freeze([
        'IDENTITY', 'HEALTH', 'EMOTION', 'RELATIONSHIP', 'WORK', 'SECRET',
        'TECHNOLOGY', 'MILITARY', 'ECONOMY', 'LOCATION', 'WEATHER', 'OPINION',
        'UNSPECIFIED'
    ]),
    target: Object.freeze([
        'PLAYER', 'LISTENER', 'PLAYER_AND_LISTENER', 'THIRD_PARTY',
        'ORGANIZATION', 'WORLD', 'UNSPECIFIED'
    ]),
    polarity: Object.freeze(['POSITIVE_OR_UNMARKED', 'NEGATIVE', 'MIXED']),
    temporality: Object.freeze(['PAST', 'CURRENT_OR_UNMARKED', 'FUTURE', 'HABITUAL']),
    epistemicStatus: Object.freeze([
        'UNMARKED', 'HEARSAY', 'HYPOTHETICAL', 'CLAIMED_CERTAIN', 'QUESTIONED'
    ]),
    continuity: Object.freeze([
        'NEW_OR_UNMARKED', 'CONTINUATION', 'CORRECTION', 'REPAIR', 'ANSWER'
    ]),
    requestedOutcome: Object.freeze([
        'INFORMATION', 'ACTION', 'OPINION', 'REFERRAL', 'CONFIDENTIAL_HANDLING',
        'ACKNOWLEDGEMENT', 'NONE'
    ])
});
const LABEL_AXES = Object.freeze(Object.keys(LABEL_VALUES));
const REQUIRED_LABEL_FIELDS = Object.freeze([...LABEL_AXES, 'outOfDomain']);
const SPLITS = Object.freeze(['prototype', 'calibration', 'blind_test']);
const GOLD_REVIEWERS = Object.freeze(['LOCAL_HUMAN', 'CODEX_INDIVIDUAL_REVIEW']);
const ERROR_FAMILY_DEFINITIONS = Object.freeze({
    OUT_OF_DOMAIN_GATE: Object.freeze({ rootCauseLayer: 'CALIBRATION', scope: 'Known game language must not be rejected as OOD, and real OOD must not be forced in-domain.' }),
    SPEECH_ACT_DISAMBIGUATION: Object.freeze({ rootCauseLayer: 'PRAGMATICS', scope: 'Topic and surface form must not replace the utterance action.' }),
    COMMUNICATIVE_FUNCTION: Object.freeze({ rootCauseLayer: 'PRAGMATICS', scope: 'Ask, tell, request, offer, reject, repair and close must remain distinct.' }),
    SURFACE_FORM: Object.freeze({ rootCauseLayer: 'COMPOSITION', scope: 'Question marks and cue words must not override the complete clause structure.' }),
    PREDICATE: Object.freeze({ rootCauseLayer: 'SEMANTIC_RETRIEVAL', scope: 'The game topic must be recovered without confusing related or opposite actions.' }),
    TARGET: Object.freeze({ rootCauseLayer: 'SLOT_RESOLUTION', scope: 'Player, listener, third party, organization and world targets must remain distinct.' }),
    POLARITY: Object.freeze({ rootCauseLayer: 'COMPOSITION', scope: 'Affirmation, negation and mixed clauses must be composed before routing.' }),
    TEMPORALITY: Object.freeze({ rootCauseLayer: 'COMPOSITION', scope: 'Past, current, future and habitual references must remain distinct.' }),
    EPISTEMIC_STATUS: Object.freeze({ rootCauseLayer: 'COMPOSITION', scope: 'Question, certainty, hearsay and hypothetical language are execution gates.' }),
    CONTINUITY: Object.freeze({ rootCauseLayer: 'CONTEXT', scope: 'Continuation, correction, repair and answer depend on dialogue history.' }),
    REQUESTED_OUTCOME: Object.freeze({ rootCauseLayer: 'POLICY', scope: 'Information, opinion, action and acknowledgement requests must not be interchanged.' }),
    SECONDARY_SPEECH_ACT_COMPOSITION: Object.freeze({ rootCauseLayer: 'COMPOSITION', scope: 'Compound utterances must preserve material secondary acts.' })
});

function readJson(filePath, fallback) {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (_) { return fallback; }
}

function normalizeText(value) {
    return String(value || '').normalize('NFKC').toLocaleLowerCase('tr-TR')
        .replace(/\s+/g, ' ').trim();
}

function validateLabels(labels) {
    const issues = [];
    if (!labels || typeof labels !== 'object' || Array.isArray(labels)) {
        return { ok: false, issues: ['LABEL_OBJECT_REQUIRED'] };
    }
    for (const axis of LABEL_AXES) {
        if (!LABEL_VALUES[axis].includes(labels[axis])) issues.push(`INVALID_LABEL:${axis}`);
    }
    if (typeof labels.outOfDomain !== 'boolean') issues.push('INVALID_LABEL:outOfDomain');
    const secondary = labels.secondarySpeechActs == null ? [] : labels.secondarySpeechActs;
    if (!Array.isArray(secondary)
        || secondary.length > 3
        || secondary.some(value => !LABEL_VALUES.speechAct.includes(value))
        || new Set(secondary).size !== secondary.length) {
        issues.push('INVALID_LABEL:secondarySpeechActs');
    }
    return { ok: issues.length === 0, issues };
}

function classifyErrorFamilies(actual, predicted) {
    if (!actual || !predicted) return [];
    const families = [];
    if (actual.outOfDomain !== predicted.outOfDomain) families.push('OUT_OF_DOMAIN_GATE');
    if (actual.speechAct !== predicted.speechAct) families.push('SPEECH_ACT_DISAMBIGUATION');
    const axes = [
        ['communicativeFunction', 'COMMUNICATIVE_FUNCTION'], ['surfaceForm', 'SURFACE_FORM'],
        ['predicate', 'PREDICATE'], ['target', 'TARGET'], ['polarity', 'POLARITY'],
        ['temporality', 'TEMPORALITY'], ['epistemicStatus', 'EPISTEMIC_STATUS'],
        ['continuity', 'CONTINUITY'], ['requestedOutcome', 'REQUESTED_OUTCOME']
    ];
    for (const [axis, family] of axes) {
        if (actual[axis] !== predicted[axis]) families.push(family);
    }
    const actualSecondary = [...(actual.secondarySpeechActs || [])].sort();
    const predictedSecondary = [...(predicted.secondarySpeechActs || [])].sort();
    if (JSON.stringify(actualSecondary) !== JSON.stringify(predictedSecondary)) {
        families.push('SECONDARY_SPEECH_ACT_COMPOSITION');
    }
    return families;
}

function summarizeErrorFamilies(compared) {
    const result = Object.fromEntries(Object.entries(ERROR_FAMILY_DEFINITIONS)
        .map(([id, definition]) => [id, Object.assign({ count: 0, exampleIds: [] }, definition)]));
    for (const comparison of compared) {
        for (const family of classifyErrorFamilies(comparison.actual, comparison.predicted)) {
            result[family].count += 1;
            if (result[family].exampleIds.length < 5) result[family].exampleIds.push(comparison.row.id);
        }
    }
    return result;
}

function validateCorpus(corpus) {
    const issues = [];
    const rows = corpus && Array.isArray(corpus.candidates) ? corpus.candidates : [];
    if (!corpus || corpus.schemaVersion !== 1
        || corpus.kind !== 'STORY_SEMANTIC_INTENT_CORPUS_V1') issues.push('CORPUS_SCHEMA');
    if (rows.length !== 200) issues.push(`CANDIDATE_COUNT:${rows.length}`);
    const ids = new Set();
    const texts = new Set();
    const familySplits = new Map();
    for (const row of rows) {
        if (!row || typeof row !== 'object') { issues.push('CANDIDATE_OBJECT'); continue; }
        if (!row.id || ids.has(row.id)) issues.push(`DUPLICATE_ID:${row.id || ''}`);
        ids.add(row.id);
        const text = normalizeText(row.text);
        if (!text || texts.has(text)) issues.push(`DUPLICATE_TEXT:${row.id || ''}`);
        texts.add(text);
        if (!SPLITS.includes(row.split)) issues.push(`INVALID_SPLIT:${row.id || ''}`);
        if (!row.familyId) issues.push(`FAMILY_REQUIRED:${row.id || ''}`);
        const family = String(row.familyId || '');
        if (!familySplits.has(family)) familySplits.set(family, new Set());
        familySplits.get(family).add(row.split);
        if (row.labelStatus !== 'CANDIDATE_UNREVIEWED') {
            issues.push(`UNTRUSTED_GOLD_STATUS:${row.id || ''}`);
        }
        if (row.adjudication) {
            if (row.adjudication.id !== row.id) issues.push(`ADJUDICATION_ID:${row.id || ''}`);
            if (!GOLD_REVIEWERS.includes(row.adjudication.reviewer)) {
                issues.push(`ADJUDICATION_REVIEWER:${row.id || ''}`);
            }
            if (!['ACCEPT', 'EDIT'].includes(row.adjudication.verdict)
                || !validateLabels(row.adjudication.labels).ok) {
                issues.push(`ADJUDICATION_LABELS:${row.id || ''}`);
            }
        }
    }
    for (const [family, splits] of familySplits) {
        if (splits.size > 1) issues.push(`FAMILY_SPLIT_LEAK:${family}`);
    }
    return { ok: issues.length === 0, issues, count: rows.length,
        uniqueTexts: texts.size, familyCount: familySplits.size };
}

function isHumanGoldReview(review, candidateIds) {
    return !!(review
        && candidateIds.has(review.id)
        && review.annotationContractVersion === 1
        && review.reviewer === 'LOCAL_HUMAN'
        && ['ACCEPT', 'EDIT'].includes(review.verdict)
        && validateLabels(review.labels).ok);
}

function isGoldReview(review, candidateIds) {
    return !!(review
        && candidateIds.has(review.id)
        && review.annotationContractVersion === 1
        && GOLD_REVIEWERS.includes(review.reviewer)
        && ['ACCEPT', 'EDIT'].includes(review.verdict)
        && validateLabels(review.labels).ok);
}

function labelsFromAnalysis(analysis) {
    const frame = analysis && analysis.semanticFrame || {};
    return {
        speechAct: LABEL_VALUES.speechAct.includes(analysis && analysis.speechAct)
            ? analysis.speechAct : 'UNKNOWN',
        communicativeFunction: LABEL_VALUES.communicativeFunction.includes(frame.communicativeFunction)
            ? frame.communicativeFunction : 'UNRESOLVED',
        surfaceForm: LABEL_VALUES.surfaceForm.includes(frame.surfaceForm)
            ? frame.surfaceForm : 'FRAGMENT',
        predicate: LABEL_VALUES.predicate.includes(frame.predicate)
            ? frame.predicate : 'UNSPECIFIED',
        target: LABEL_VALUES.target.includes(frame.target) ? frame.target : 'UNSPECIFIED',
        polarity: LABEL_VALUES.polarity.includes(frame.polarity)
            ? frame.polarity : 'POSITIVE_OR_UNMARKED',
        temporality: LABEL_VALUES.temporality.includes(frame.temporality)
            ? frame.temporality : 'CURRENT_OR_UNMARKED',
        epistemicStatus: LABEL_VALUES.epistemicStatus.includes(frame.epistemicStatus)
            ? frame.epistemicStatus : 'UNMARKED',
        continuity: LABEL_VALUES.continuity.includes(frame.continuity)
            ? frame.continuity : 'NEW_OR_UNMARKED',
        requestedOutcome: LABEL_VALUES.requestedOutcome.includes(frame.requestedOutcome)
            ? frame.requestedOutcome : 'NONE',
        outOfDomain: !analysis || analysis.speechAct === 'UNKNOWN',
        secondarySpeechActs: (analysis && analysis.secondaryActs || [])
            .filter(value => LABEL_VALUES.speechAct.includes(value)).slice(0, 3)
    };
}

function buildBaselineProposals(candidates) {
    const { createRuntime } = require('./story-sim-harness');
    const runtime = createRuntime(38110);
    try {
        runtime.api.newCampaign({ seed: 38110, playerStateId: 0, abundance: 1,
            doctrine: 'combined', fog: true });
        const directory = runtime.api.contactDirectoryBuild();
        const listener = directory.publicCharacters.find(row =>
            row.id !== directory.playerActorId) || directory.publicCharacters[0];
        if (!listener) throw new Error('SEMANTIC_BENCHMARK_LISTENER_REQUIRED');
        return new Map((candidates || []).map(row => {
            const analysis = runtime.api.conversationAnalyze(row.text, {
                listenerActorId: listener.id
            });
            return [row.id, {
                labels: labelsFromAnalysis(analysis),
                confidenceBps: Number(analysis && analysis.confidenceBps
                    || analysis && analysis.semanticFrame && analysis.semanticFrame.confidenceBps) || 0,
                source: analysis && analysis.source || null
            }];
        }));
    } finally {
        runtime.dom.window.close();
    }
}

function macroF1(actual, predicted) {
    const classes = [...new Set(actual.concat(predicted))];
    if (!classes.length) return null;
    let sum = 0;
    for (const label of classes) {
        let tp = 0; let fp = 0; let fn = 0;
        for (let index = 0; index < actual.length; index++) {
            if (actual[index] === label && predicted[index] === label) tp += 1;
            else if (actual[index] !== label && predicted[index] === label) fp += 1;
            else if (actual[index] === label && predicted[index] !== label) fn += 1;
        }
        const precision = tp + fp ? tp / (tp + fp) : 0;
        const recall = tp + fn ? tp / (tp + fn) : 0;
        sum += precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    }
    return sum / classes.length;
}

function expectedCalibrationError(rows) {
    if (!rows.length) return null;
    let weighted = 0;
    for (let low = 0; low < 10000; low += 1000) {
        const bin = rows.filter(row => row.confidenceBps >= low
            && row.confidenceBps <= (low === 9000 ? 10000 : low + 999));
        if (!bin.length) continue;
        const accuracy = bin.filter(row => row.correct).length / bin.length;
        const confidence = bin.reduce((sum, row) => sum + row.confidenceBps, 0)
            / bin.length / 10000;
        weighted += Math.abs(accuracy - confidence) * bin.length / rows.length;
    }
    return weighted;
}

function buildBenchmark(options) {
    options = options && typeof options === 'object' ? options : {};
    const corpus = options.corpus || readJson(DEFAULT_CORPUS_PATH, null);
    const reviewsLedger = options.reviews || readJson(DEFAULT_REVIEWS_PATH, { reviews: [] });
    const corpusValidation = validateCorpus(corpus);
    const candidates = corpus && Array.isArray(corpus.candidates) ? corpus.candidates : [];
    const candidateIds = new Set(candidates.map(row => row.id));
    const externalReviews = Array.isArray(reviewsLedger)
        ? reviewsLedger : reviewsLedger.reviews || [];
    const decisionById = new Map(candidates.filter(row => row.adjudication)
        .map(row => [row.id, row.adjudication]));
    for (const review of externalReviews) {
        if (candidateIds.has(review.id)) decisionById.set(review.id, review);
    }
    const reviews = [...decisionById.values()];
    const goldReviews = reviews.filter(row => isGoldReview(row, candidateIds));
    const humanGold = goldReviews.filter(row => row.reviewer === 'LOCAL_HUMAN').length;
    const codexGold = goldReviews.filter(row =>
        row.reviewer === 'CODEX_INDIVIDUAL_REVIEW').length;
    const reviewById = new Map(goldReviews.map(row => [row.id, row]));
    const proposals = options.proposals || (options.includePredictions === false
        ? new Map() : buildBaselineProposals(candidates));
    const compared = candidates.filter(row => reviewById.has(row.id) && proposals.has(row.id))
        .map(row => {
            const actual = reviewById.get(row.id).labels;
            const prediction = proposals.get(row.id);
            return { row, actual, predicted: prediction.labels,
                confidenceBps: prediction.confidenceBps,
                correct: actual.speechAct === prediction.labels.speechAct };
        });
    const actualActs = compared.map(row => row.actual.speechAct);
    const predictedActs = compared.map(row => row.predicted.speechAct);
    const exactFrameMatches = compared.filter(row =>
        classifyErrorFamilies(row.actual, row.predicted).length === 0).length;
    const confusion = {};
    for (const row of compared) {
        const key = `${row.actual.speechAct}=>${row.predicted.speechAct}`;
        confusion[key] = (confusion[key] || 0) + 1;
    }
    const ood = compared.filter(row => row.actual.outOfDomain);
    const domainErrors = {};
    for (const row of compared) {
        const domain = String(row.row.familyId || 'UNKNOWN').split('|').slice(-1)[0];
        if (!domainErrors[domain]) domainErrors[domain] = { total: 0, speechActErrors: 0 };
        domainErrors[domain].total += 1;
        if (!row.correct) domainErrors[domain].speechActErrors += 1;
    }
    const prototypeThreshold = Number(corpus && corpus.gates
        && corpus.gates.prototypeHumanGold) || 100;
    const productThreshold = Number(corpus && corpus.gates
        && corpus.gates.productHumanGold) || 1000;
    return {
        ok: corpusValidation.ok,
        schemaVersion: 1,
        corpus: corpusValidation,
        inventory: {
            candidates: candidates.length,
            reviewed: reviews.filter(row => candidateIds.has(row.id)).length,
            gold: goldReviews.length,
            humanGold,
            codexGold,
            remainingForPrototype: Math.max(0, prototypeThreshold - goldReviews.length),
            remainingForProduct: Math.max(0, productThreshold - goldReviews.length),
            bySource: Object.fromEntries(['OBSERVED_PLAYER', 'MODEL_GENERATED_CANDIDATE']
                .map(source => [source, candidates.filter(row => row.sourceType === source).length])),
            bySplit: Object.fromEntries(SPLITS.map(split =>
                [split, candidates.filter(row => row.split === split).length]))
        },
        gates: {
            prototype: { threshold: prototypeThreshold,
                pass: goldReviews.length >= prototypeThreshold },
            product: { threshold: productThreshold,
                pass: goldReviews.length >= productThreshold }
        },
        baseline: {
            comparedGold: compared.length,
            speechActMacroF1: macroF1(actualActs, predictedActs),
            exactFrameMatchRate: compared.length ? exactFrameMatches / compared.length : null,
            oodFalseAcceptanceRate: ood.length
                ? ood.filter(row => !row.predicted.outOfDomain).length / ood.length : null,
            expectedCalibrationError: expectedCalibrationError(compared),
            confusion,
            domainErrors,
            errorFamilies: summarizeErrorFamilies(compared)
        }
    };
}

function buildEmbeddingSpikePreflight(options) {
    options = options && typeof options === 'object' ? options : {};
    const corpus = options.corpus || readJson(DEFAULT_CORPUS_PATH, null);
    const validation = validateCorpus(corpus);
    const candidates = corpus && Array.isArray(corpus.candidates) ? corpus.candidates : [];
    const gold = candidates.filter(row => row.adjudication
        && isGoldReview(row.adjudication, new Set([row.id])));
    const bySplit = Object.fromEntries(SPLITS.map(split =>
        [split, gold.filter(row => row.split === split)]));
    const acts = rows => new Set(rows.map(row => row.adjudication.labels.speechAct));
    const prototypeActs = acts(bySplit.prototype);
    const calibrationActs = acts(bySplit.calibration);
    const blindActs = acts(bySplit.blind_test);
    const missingBlindAnchors = [...blindActs].filter(act => !prototypeActs.has(act)).sort();
    const missingBlindCalibration = [...blindActs]
        .filter(act => !calibrationActs.has(act)).sort();
    const oodBySplit = Object.fromEntries(SPLITS.map(split => [split, {
        inDomain: bySplit[split].filter(row => !row.adjudication.labels.outOfDomain).length,
        outOfDomain: bySplit[split].filter(row => row.adjudication.labels.outOfDomain).length
    }]));
    const highRiskActs = ['THREATEN', 'REQUEST_ACTION', 'PROPOSE_COMMERCIAL_DEAL',
        'SHARE_SECRET', 'BLUFF_CANDIDATE'];
    const highRiskCoverage = Object.fromEntries(highRiskActs.map(act =>
        [act, Object.fromEntries(SPLITS.map(split => [split,
            bySplit[split].filter(row => row.adjudication.labels.speechAct === act).length]))]));
    const issues = [];
    for (const act of missingBlindAnchors) issues.push(`BLIND_ACT_WITHOUT_PROTOTYPE_ANCHOR:${act}`);
    for (const act of missingBlindCalibration) issues.push(`BLIND_ACT_WITHOUT_CALIBRATION:${act}`);
    for (const split of SPLITS) {
        if (!oodBySplit[split].outOfDomain) issues.push(`OOD_POSITIVE_MISSING:${split}`);
    }
    for (const [act, coverage] of Object.entries(highRiskCoverage)) {
        if (!coverage.prototype || !coverage.blind_test) {
            issues.push(`HIGH_RISK_SPLIT_COVERAGE_MISSING:${act}`);
        }
    }
    const threshold = Number(corpus && corpus.gates
        && corpus.gates.prototypeHumanGold) || 100;
    return {
        ok: validation.ok,
        experimentGatePass: validation.ok && gold.length >= threshold,
        modelSelectionPass: validation.ok && gold.length >= threshold && issues.length === 0,
        gold: { total: gold.length,
            bySplit: Object.fromEntries(SPLITS.map(split => [split, bySplit[split].length])) },
        classCoverage: {
            prototype: [...prototypeActs].sort(),
            calibration: [...calibrationActs].sort(),
            blindTest: [...blindActs].sort(),
            missingBlindAnchors,
            missingBlindCalibration
        },
        oodBySplit,
        highRiskCoverage,
        issues
    };
}

if (require.main === module) {
    if (process.argv.includes('--embedding-spike-preflight')) {
        const preflight = buildEmbeddingSpikePreflight();
        process.stdout.write(`${JSON.stringify(preflight, null, 2)}\n`);
        if (!preflight.ok || (process.argv.includes('--require-model-selection')
            && !preflight.modelSelectionPass)) process.exitCode = 2;
        return;
    }
    const report = buildBenchmark({ includePredictions: !process.argv.includes('--inventory-only') });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.ok || (process.argv.includes('--require-prototype')
        && !report.gates.prototype.pass)) process.exitCode = 2;
}

module.exports = {
    LABEL_VALUES, LABEL_AXES, REQUIRED_LABEL_FIELDS, SPLITS, GOLD_REVIEWERS,
    ERROR_FAMILY_DEFINITIONS, classifyErrorFamilies, summarizeErrorFamilies,
    normalizeText, validateLabels, validateCorpus, isHumanGoldReview, isGoldReview,
    labelsFromAnalysis, buildBaselineProposals, buildBenchmark, buildEmbeddingSpikePreflight
};
