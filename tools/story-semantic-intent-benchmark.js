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
const HIGH_RISK_ACTS = Object.freeze([
    'THREATEN', 'REQUEST_ACTION', 'PROPOSE_COMMERCIAL_DEAL', 'SHARE_SECRET',
    'BLUFF_CANDIDATE'
]);
const HIGH_RISK_FRAME_CONTRACTS = Object.freeze({
    THREATEN: Object.freeze({ communicativeFunction: Object.freeze(['TELL', 'REQUEST']),
        requestedOutcome: 'ACTION' }),
    REQUEST_ACTION: Object.freeze({ communicativeFunction: 'REQUEST',
        predicate: Object.freeze([
            'IDENTITY', 'HEALTH', 'EMOTION', 'RELATIONSHIP', 'WORK', 'SECRET',
            'TECHNOLOGY', 'MILITARY', 'ECONOMY', 'LOCATION', 'WEATHER', 'OPINION'
        ]),
        requestedOutcome: 'ACTION' }),
    PROPOSE_COMMERCIAL_DEAL: Object.freeze({ communicativeFunction: 'OFFER',
        requestedOutcome: 'ACTION' }),
    SHARE_SECRET: Object.freeze({ communicativeFunction: 'CONFIDE',
        requestedOutcome: 'CONFIDENTIAL_HANDLING' }),
    BLUFF_CANDIDATE: Object.freeze({ communicativeFunction: 'TELL',
        polarity: 'MIXED', epistemicStatus: 'CLAIMED_CERTAIN',
        requestedOutcome: 'NONE' })
});
const MIN_REPRESENTATION_CLASS_SUPPORT = 3;
const EMBEDDING_ANCHOR_COUNTS = Object.freeze([1, 3, 5, 10, 20]);
const EMBEDDING_REPRESENTATIONS = Object.freeze([
    Object.freeze({ id: 'single-max', aggregation: 'max', topCount: 1,
        frameCompatibilityWeight: 0 }),
    Object.freeze({ id: 'class-top3-mean', aggregation: 'top_mean', topCount: 3,
        frameCompatibilityWeight: 0 }),
    Object.freeze({ id: 'frame-top3-mean', aggregation: 'top_mean', topCount: 3,
        frameCompatibilityWeight: 0.08 }),
    Object.freeze({ id: 'class-centroid', aggregation: 'centroid', topCount: 1,
        frameCompatibilityWeight: 0, anchorCountIndependent: true }),
    Object.freeze({ id: 'frame-centroid-guard', aggregation: 'centroid', topCount: 1,
        frameCompatibilityWeight: 0, highRiskMinimumFrameCompatibility: 0.8,
        anchorCountIndependent: true }),
    Object.freeze({ id: 'contract-centroid-guard', aggregation: 'centroid',
        topCount: 1, frameCompatibilityWeight: 0, highRiskFrameContract: true,
        anchorCountIndependent: true }),
    Object.freeze({ id: 'contract-frame-centroid-guard', aggregation: 'centroid',
        topCount: 1, frameCompatibilityWeight: 0.08, highRiskFrameContract: true,
        anchorCountIndependent: true }),
    Object.freeze({ id: 'contract-bluff-candidate-centroid-guard', aggregation: 'centroid',
        topCount: 1, frameCompatibilityWeight: 0,
        deterministicContractCandidates: Object.freeze(['BLUFF_CANDIDATE']),
        highRiskFrameContract: true,
        anchorCountIndependent: true }),
    Object.freeze({ id: 'bounded-domain-contract-bluff-centroid-guard',
        aggregation: 'centroid', topCount: 1, frameCompatibilityWeight: 0,
        deterministicContractCandidates: Object.freeze(['BLUFF_CANDIDATE']),
        highRiskFrameContract: true, boundedDomainFrameContract: true,
        anchorCountIndependent: true }),
    Object.freeze({ id: 'bounded-domain-authoritative-high-risk-centroid-guard',
        aggregation: 'centroid', topCount: 1, frameCompatibilityWeight: 0,
        deterministicContractCandidates: Object.freeze(['BLUFF_CANDIDATE']),
        authoritativeSpeechActCandidates: Object.freeze(HIGH_RISK_ACTS.filter(label =>
            label !== 'BLUFF_CANDIDATE')),
        highRiskFrameContract: true, boundedDomainFrameContract: true,
        anchorCountIndependent: true }),
    Object.freeze({ id: 'bounded-domain-consensus-high-risk-centroid-guard',
        aggregation: 'centroid', topCount: 1, frameCompatibilityWeight: 0,
        authoritativeSpeechActCandidates: Object.freeze(HIGH_RISK_ACTS),
        highRiskSpeechActConsensus: true,
        highRiskFrameContract: true, boundedDomainFrameContract: true,
        anchorCountIndependent: true }),
    Object.freeze({ id: 'bounded-domain-semantic-consensus-high-risk-centroid-guard',
        aggregation: 'centroid', topCount: 1, frameCompatibilityWeight: 0,
        authoritativeSpeechActCandidates: Object.freeze(HIGH_RISK_ACTS),
        highRiskEmbeddingConsensus: true,
        highRiskFrameContract: true, boundedDomainFrameContract: true,
        anchorCountIndependent: true }),
    Object.freeze({ id: 'contract-bluff-candidate-centroid-ood-max-guard',
        aggregation: 'centroid', oodAggregation: 'max', topCount: 1,
        frameCompatibilityWeight: 0,
        deterministicContractCandidates: Object.freeze(['BLUFF_CANDIDATE']),
        highRiskFrameContract: true,
        anchorCountIndependent: true })
]);
const FRAME_COMPATIBILITY_AXES = Object.freeze([
    'communicativeFunction', 'polarity', 'temporality', 'epistemicStatus',
    'requestedOutcome'
]);
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
    const expectedCount = Number(corpus && corpus.summary && corpus.summary.total) || 200;
    if (expectedCount < 200 || rows.length !== expectedCount) {
        issues.push(`CANDIDATE_COUNT:${rows.length}/${expectedCount}`);
    }
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
            const exactResolvedEntityCount = (analysis && analysis.entities || [])
                .filter(entity => entity && entity.status === 'RESOLVED_PUBLIC'
                    && (entity.evidence || []).includes('EXACT_NORMALIZED_ALIAS')).length;
            return [row.id, {
                labels: labelsFromAnalysis(analysis),
                domainGrounding: { exactResolvedEntityCount },
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

function l2Normalize(vector) {
    const values = Array.from(vector || [], Number);
    const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
    if (!norm || !Number.isFinite(norm)) throw new Error('EMBEDDING_VECTOR_NORM');
    return values.map(value => value / norm);
}

function dotProduct(left, right) {
    if (!left || !right || left.length !== right.length || !left.length) {
        throw new Error('EMBEDDING_VECTOR_DIMENSION');
    }
    return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function cosineSimilarity(left, right) {
    const leftNorm = Math.sqrt(dotProduct(left, left));
    const rightNorm = Math.sqrt(dotProduct(right, right));
    if (!leftNorm || !rightNorm) throw new Error('EMBEDDING_VECTOR_NORM');
    return dotProduct(left, right) / (leftNorm * rightNorm);
}

function percentile(values, ratio) {
    if (!values.length) return null;
    const sorted = values.slice().sort((left, right) => left - right);
    const index = Math.min(sorted.length - 1,
        Math.max(0, Math.ceil(sorted.length * ratio) - 1));
    return sorted[index];
}

function frameCompatibility(left, right) {
    if (!left || !right) return 0.5;
    const matches = FRAME_COMPATIBILITY_AXES.filter(axis => left[axis] === right[axis]);
    return matches.length / FRAME_COMPATIBILITY_AXES.length;
}

function matchesHighRiskFrameContract(label, frame) {
    const contract = HIGH_RISK_FRAME_CONTRACTS[label];
    if (!contract) return true;
    if (!frame) return false;
    return Object.entries(contract).every(([axis, value]) => Array.isArray(value)
        ? value.includes(frame[axis]) : frame[axis] === value);
}

function matchesAuthoritativeSpeechActContract(label, frame) {
    if (!frame || frame.speechAct !== label
        || !matchesHighRiskFrameContract(label, frame)) return false;
    if (label !== 'REQUEST_ACTION') return true;
    return frame.surfaceForm !== 'INTERROGATIVE'
        && !['CORRECTION', 'REPAIR', 'ANSWER'].includes(frame.continuity)
        && !(frame.secondarySpeechActs || []).includes('ASK_INFORMATION');
}

function hasBoundedDomainGrounding(frame, grounding) {
    if (!frame) return false;
    if (frame.predicate && frame.predicate !== 'UNSPECIFIED') return true;
    if (frame.target && frame.target !== 'UNSPECIFIED') return true;
    if (['CONTINUATION', 'CORRECTION', 'REPAIR', 'ANSWER'].includes(frame.continuity)) {
        return true;
    }
    return Number(grounding && grounding.exactResolvedEntityCount) > 0;
}

function matchesBoundedDomainFrameContract(label, frame, grounding) {
    if (!['ASK_INFORMATION', 'SMALL_TALK'].includes(label)) return true;
    if (!frame) return false;
    const grounded = hasBoundedDomainGrounding(frame, grounding);
    if (label === 'ASK_INFORMATION') {
        if (frame.continuity === 'REPAIR') return true;
        return frame.communicativeFunction === 'ASK'
            && frame.requestedOutcome === 'INFORMATION' && grounded;
    }
    return frame.communicativeFunction === 'TELL' && frame.requestedOutcome === 'NONE'
        && (frame.speechAct === 'SMALL_TALK' || grounded);
}

function selectPrototypeAnchors(anchors, perClassLimit) {
    const limit = Math.max(1, Number(perClassLimit) || 1);
    const grouped = new Map();
    for (const anchor of (anchors || []).slice().sort((left, right) =>
        String(left.id).localeCompare(String(right.id)))) {
        if (!grouped.has(anchor.label)) grouped.set(anchor.label, []);
        grouped.get(anchor.label).push(anchor);
    }
    const selected = [];
    for (const rows of grouped.values()) {
        if (rows.length <= limit) {
            selected.push(...rows);
            continue;
        }
        const similarities = new Map();
        const similarity = (left, right) => {
            const key = `${left.id}\u0000${right.id}`;
            if (!similarities.has(key)) similarities.set(key,
                cosineSimilarity(left.vector, right.vector));
            return similarities.get(key);
        };
        const chosen = [];
        const remaining = rows.slice();
        while (chosen.length < limit) {
            const ranked = remaining.map(candidate => {
                const coverage = rows.reduce((sum, target) => sum + Math.max(
                    ...chosen.map(anchor => similarity(target, anchor)),
                    similarity(target, candidate)), 0);
                return { candidate, coverage };
            }).sort((left, right) => right.coverage - left.coverage
                || String(left.candidate.id).localeCompare(String(right.candidate.id)));
            const winner = ranked[0].candidate;
            chosen.push(winner);
            remaining.splice(remaining.indexOf(winner), 1);
        }
        selected.push(...chosen);
    }
    return selected;
}

function buildPrototypeClassCentroids(anchors) {
    const grouped = new Map();
    for (const anchor of (anchors || []).slice().sort((left, right) =>
        String(left.id).localeCompare(String(right.id)))) {
        if (!grouped.has(anchor.label)) grouped.set(anchor.label, []);
        grouped.get(anchor.label).push(anchor);
    }
    return [...grouped.entries()].map(([label, rows]) => {
        const dimension = rows[0].vector.length;
        if (rows.some(row => row.vector.length !== dimension)) {
            throw new Error(`EMBEDDING_VECTOR_DIMENSION:${label}`);
        }
        const mean = Array.from({ length: dimension }, (_, index) =>
            rows.reduce((sum, row) => sum + row.vector[index], 0) / rows.length);
        return { id: `centroid:${label}`, label, vector: l2Normalize(mean),
            sourceAnchorIds: rows.map(row => row.id),
            sourceLabels: rows.map(row => row.labels).filter(Boolean) };
    });
}

function rankEmbeddingCandidates(queryVector, anchors, perClassLimit, options) {
    options = options && typeof options === 'object' ? options : {};
    const aggregation = options.aggregation || 'max';
    const topCount = Math.max(1, Number(options.topCount) || 1);
    const frameWeight = Math.max(0, Math.min(1,
        Number(options.frameCompatibilityWeight) || 0));
    const deterministicContractCandidates = new Set(
        Array.isArray(options.deterministicContractCandidates)
            ? options.deterministicContractCandidates : []);
    const authoritativeSpeechActCandidates = new Set(
        Array.isArray(options.authoritativeSpeechActCandidates)
            ? options.authoritativeSpeechActCandidates : []);
    const grouped = new Map();
    let selectedAnchors = aggregation === 'centroid'
        ? buildPrototypeClassCentroids(anchors)
        : selectPrototypeAnchors(anchors, perClassLimit);
    if (aggregation === 'centroid' && options.oodAggregation === 'max') {
        selectedAnchors = selectedAnchors.filter(anchor => anchor.label !== 'UNKNOWN')
            .concat((anchors || []).filter(anchor => anchor.label === 'UNKNOWN')
                .slice().sort((left, right) => String(left.id)
                    .localeCompare(String(right.id))));
    }
    for (const anchor of selectedAnchors) {
        if (!grouped.has(anchor.label)) grouped.set(anchor.label, []);
        grouped.get(anchor.label).push(anchor);
    }
    const candidates = [...grouped.entries()].map(([label, rows]) => {
        const scored = rows.map(row => {
            const semanticScore = cosineSimilarity(queryVector, row.vector);
            const compatibility = aggregation === 'centroid'
                ? Math.max(...(row.sourceLabels || []).map(labels =>
                    frameCompatibility(options.queryFrame, labels)), 0)
                : frameCompatibility(options.queryFrame, row.labels);
            const blockedByFrameGuard = HIGH_RISK_ACTS.includes(row.label)
                && ((options.highRiskMinimumFrameCompatibility != null
                    && compatibility < options.highRiskMinimumFrameCompatibility)
                || (options.highRiskFrameContract
                    && !matchesHighRiskFrameContract(row.label, options.queryFrame))
                || (options.highRiskSpeechActConsensus
                    && !matchesAuthoritativeSpeechActContract(row.label,
                        options.queryFrame)));
            const blockedByDomainGuard = options.boundedDomainFrameContract
                && !matchesBoundedDomainFrameContract(row.label, options.queryFrame,
                    options.queryGrounding);
            const blocked = blockedByFrameGuard || blockedByDomainGuard;
            const deterministicContractCandidate = !blocked
                && ((deterministicContractCandidates.has(row.label)
                    && matchesHighRiskFrameContract(row.label, options.queryFrame))
                || (authoritativeSpeechActCandidates.has(row.label)
                    && !options.highRiskEmbeddingConsensus
                    && matchesAuthoritativeSpeechActContract(row.label,
                        options.queryFrame)));
            return { row, semanticScore, compatibility, deterministicContractCandidate,
                score: blocked ? -Infinity
                    : semanticScore * (1 - frameWeight) + compatibility * frameWeight };
        })
            .sort((left, right) => right.score - left.score
                || String(left.row.id).localeCompare(String(right.row.id)));
        const selected = scored.slice(0, Math.min(topCount, scored.length));
        const score = aggregation === 'top_mean'
            ? selected.reduce((sum, item) => sum + item.score, 0) / selected.length
            : scored[0].score;
        const semanticScore = aggregation === 'top_mean'
            ? selected.reduce((sum, item) => sum + item.semanticScore, 0)
                / selected.length
            : scored[0].semanticScore;
        return { label, score, semanticScore, anchorId: scored[0].row.id,
            deterministicContractCandidate: scored[0].deterministicContractCandidate,
            anchorIds: aggregation === 'centroid'
                ? scored[0].row.sourceAnchorIds || [scored[0].row.id]
                : selected.map(item => item.row.id) };
    });
    if (options.highRiskEmbeddingConsensus) {
        const semanticWinner = candidates.slice().sort((left, right) =>
            right.semanticScore - left.semanticScore
                || left.label.localeCompare(right.label))[0];
        for (const candidate of candidates) {
            if (!HIGH_RISK_ACTS.includes(candidate.label)) continue;
            const agreed = candidate === semanticWinner
                && matchesAuthoritativeSpeechActContract(candidate.label,
                    options.queryFrame);
            candidate.deterministicContractCandidate = agreed;
            if (!agreed) candidate.score = -Infinity;
        }
    }
    return candidates.sort((left, right) => Number(right.deterministicContractCandidate)
        - Number(left.deterministicContractCandidate) || right.score - left.score
        || left.label.localeCompare(right.label));
}

function rawEmbeddingRows(rows, vectors, anchors, perClassLimit, representation,
    proposalById) {
    return rows.map(row => {
        const proposal = proposalById && proposalById.get(row.id);
        const ranked = rankEmbeddingCandidates(vectors.get(row.id), anchors,
            perClassLimit, Object.assign({}, representation, {
                queryFrame: proposal && proposal.labels,
                queryGrounding: proposal && proposal.domainGrounding
            }));
        const first = ranked[0] || { label: 'UNKNOWN', score: 0, anchorId: null };
        const second = ranked[1] || { score: 0 };
        return { id: row.id, familyId: row.familyId || row.id,
            actual: row.adjudication.labels.speechAct,
            outOfDomain: row.adjudication.labels.outOfDomain,
            rawPrediction: first.label, score: first.score,
            margin: first.deterministicContractCandidate
                ? 1 : first.score - second.score,
            anchorId: first.anchorId };
    });
}

function applyEmbeddingCalibration(row, calibration) {
    if (!row || row.margin < calibration.minimumMargin) return 'UNKNOWN';
    const threshold = calibration.classThresholds[row.rawPrediction]
        ?? calibration.defaultThreshold;
    return row.score >= threshold ? row.rawPrediction : 'UNKNOWN';
}

function summarizeEmbeddingRows(rows, calibration) {
    const evaluated = rows.map(row => {
        const predicted = applyEmbeddingCalibration(row, calibration);
        const scoreBin = Math.min(9, Math.max(0, Math.floor(row.score * 10)));
        const calibratedConfidence = calibration.confidenceByScoreBin
            && calibration.confidenceByScoreBin[scoreBin] != null
            ? calibration.confidenceByScoreBin[scoreBin]
            : calibration.fallbackConfidence;
        return { ...row, predicted,
            confidenceBps: Math.round(Math.max(0, Math.min(1,
                calibratedConfidence == null ? 0.5 : calibratedConfidence)) * 10000) };
    });
    const actual = evaluated.map(row => row.actual);
    const predicted = evaluated.map(row => row.predicted);
    const perClassRecall = Object.fromEntries([...new Set(actual)].sort().map(label => {
        const classRows = evaluated.filter(row => row.actual === label);
        return [label, classRows.filter(row => row.predicted === label).length / classRows.length];
    }));
    const ood = evaluated.filter(row => row.outOfDomain);
    const oodFalseAcceptances = ood.filter(row => row.predicted !== 'UNKNOWN');
    const highRiskFalsePositives = evaluated.filter(row =>
        HIGH_RISK_ACTS.includes(row.predicted) && row.actual !== row.predicted);
    const confusionKeys = [...new Set(evaluated.map(row =>
        `${row.actual}=>${row.predicted}`))].sort();
    return {
        count: evaluated.length,
        speechActMacroF1: macroF1(actual, predicted),
        perClassRecall,
        oodFalseAcceptanceRate: ood.length ? oodFalseAcceptances.length / ood.length : null,
        oodFalseAcceptanceIds: oodFalseAcceptances.map(row => row.id),
        oodFalseAcceptances: oodFalseAcceptances.map(row => ({
            id: row.id, predicted: row.predicted })),
        highRiskFalsePositiveCount: highRiskFalsePositives.length,
        highRiskFalsePositiveIds: highRiskFalsePositives.map(row => row.id),
        top1Top2Margin: { p50: percentile(evaluated.map(row => row.margin), 0.5),
            p95: percentile(evaluated.map(row => row.margin), 0.95) },
        expectedCalibrationError: expectedCalibrationError(evaluated.map(row => ({
            confidenceBps: row.confidenceBps, correct: row.actual === row.predicted }))),
        confusion: Object.fromEntries(confusionKeys.map(key => [key,
            evaluated.filter(row => `${row.actual}=>${row.predicted}` === key).length]))
    };
}

function fitEmbeddingCalibration(rows) {
    const marginCandidates = [0, ...new Set(rows.map(row => Number(row.margin.toFixed(6))))]
        .sort((left, right) => left - right);
    let best = null;
    for (const minimumMargin of marginCandidates) {
        const classThresholds = {};
        for (const label of LABEL_VALUES.speechAct.filter(value => value !== 'UNKNOWN')) {
            const labelRows = rows.filter(row => row.rawPrediction === label
                && row.margin >= minimumMargin);
            const thresholds = [0, ...new Set(labelRows.map(row =>
                Number((row.score + 1e-9).toFixed(9)))), 1.000001].sort((a, b) => a - b);
            let selected = thresholds[0];
            let selectedF1 = -1;
            for (const threshold of thresholds) {
                let tp = 0; let fp = 0; let fn = 0; let oodFalseAcceptances = 0;
                for (const row of rows) {
                    const accepted = row.rawPrediction === label
                        && row.margin >= minimumMargin && row.score >= threshold;
                    if (accepted && row.actual === label) tp += 1;
                    else if (accepted) fp += 1;
                    else if (row.actual === label) fn += 1;
                    if (accepted && row.outOfDomain) oodFalseAcceptances += 1;
                }
                if (HIGH_RISK_ACTS.includes(label) && fp) continue;
                if (oodFalseAcceptances) continue;
                const f1 = (2 * tp) / Math.max(1, 2 * tp + fp + fn);
                if (f1 > selectedF1 || (f1 === selectedF1 && threshold < selected)) {
                    selected = threshold; selectedF1 = f1;
                }
            }
            classThresholds[label] = selected;
        }
        const calibration = { minimumMargin, defaultThreshold: 1.000001,
            classThresholds };
        const metrics = summarizeEmbeddingRows(rows, calibration);
        const candidate = { calibration, metrics };
        if (!best || metrics.highRiskFalsePositiveCount
                < best.metrics.highRiskFalsePositiveCount
            || (metrics.highRiskFalsePositiveCount === best.metrics.highRiskFalsePositiveCount
                && metrics.oodFalseAcceptanceRate < best.metrics.oodFalseAcceptanceRate)
            || (metrics.highRiskFalsePositiveCount === best.metrics.highRiskFalsePositiveCount
                && metrics.oodFalseAcceptanceRate === best.metrics.oodFalseAcceptanceRate
                && metrics.speechActMacroF1 > best.metrics.speechActMacroF1)
            || (metrics.highRiskFalsePositiveCount === best.metrics.highRiskFalsePositiveCount
                && metrics.oodFalseAcceptanceRate === best.metrics.oodFalseAcceptanceRate
                && metrics.speechActMacroF1 === best.metrics.speechActMacroF1
                && minimumMargin < best.calibration.minimumMargin)) best = candidate;
    }
    const calibratedRows = rows.map(row => ({ row,
        predicted: applyEmbeddingCalibration(row, best.calibration) }));
    best.calibration.fallbackConfidence = calibratedRows.filter(item =>
        item.row.actual === item.predicted).length / Math.max(1, calibratedRows.length);
    best.calibration.confidenceByScoreBin = {};
    for (let bin = 0; bin < 10; bin++) {
        const binRows = calibratedRows.filter(item =>
            Math.min(9, Math.max(0, Math.floor(item.row.score * 10))) === bin);
        if (binRows.length) best.calibration.confidenceByScoreBin[bin] =
            binRows.filter(item => item.row.actual === item.predicted).length / binRows.length;
    }
    best.metrics = summarizeEmbeddingRows(rows, best.calibration);
    return best;
}

function buildStratifiedCalibrationFolds(rows, foldCount) {
    const count = Math.max(2, Number(foldCount) || 3);
    const byClass = new Map();
    for (const row of rows || []) {
        if (!byClass.has(row.actual)) byClass.set(row.actual, []);
        byClass.get(row.actual).push(row);
    }
    const validationIds = Array.from({ length: count }, () => new Set());
    for (const [label, classRows] of [...byClass.entries()]
        .sort((left, right) => left[0].localeCompare(right[0]))) {
        const ordered = classRows.slice().sort((left, right) =>
            String(left.familyId || left.id).localeCompare(
                String(right.familyId || right.id))
            || String(left.id).localeCompare(String(right.id)));
        if (ordered.length < count) {
            throw new Error(`EMBEDDING_CALIBRATION_FOLD_SUPPORT:${label}`
                + `:${ordered.length}/${count}`);
        }
        ordered.forEach((row, index) => validationIds[index % count].add(row.id));
    }
    return validationIds.map((ids, index) => ({
        index,
        fitRows: (rows || []).filter(row => !ids.has(row.id)),
        validationRows: (rows || []).filter(row => ids.has(row.id))
            .sort((left, right) => String(left.id).localeCompare(String(right.id)))
    }));
}

function average(values) {
    return values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function standardDeviation(values) {
    const mean = average(values);
    if (mean == null) return null;
    return Math.sqrt(average(values.map(value => (value - mean) ** 2)));
}

function crossValidateEmbeddingCalibration(rows, foldCount) {
    const folds = buildStratifiedCalibrationFolds(rows, foldCount);
    const results = folds.map(fold => {
        const fitted = fitEmbeddingCalibration(fold.fitRows);
        const metrics = summarizeEmbeddingRows(fold.validationRows,
            fitted.calibration);
        return { index: fold.index, fitCount: fold.fitRows.length,
            validationCount: fold.validationRows.length,
            validationIds: fold.validationRows.map(row => row.id), metrics };
    });
    const macroF1 = results.map(row => row.metrics.speechActMacroF1);
    const highRisk = results.map(row => row.metrics.highRiskFalsePositiveCount);
    const meanPerClassRecall = Object.fromEntries([...new Set(results.flatMap(row =>
        Object.keys(row.metrics.perClassRecall)))].sort().map(label => [label,
        average(results.map(row => row.metrics.perClassRecall[label] ?? 0))]));
    const highRiskRecall = HIGH_RISK_ACTS.map(label => meanPerClassRecall[label] ?? 0);
    const ood = results.map(row => row.metrics.oodFalseAcceptanceRate)
        .filter(value => value != null);
    return { schemaVersion: 1, method: 'STRATIFIED_OUTER_CALIBRATION_V1',
        foldCount: folds.length, rowCount: (rows || []).length,
        meanSpeechActMacroF1: average(macroF1),
        minimumSpeechActMacroF1: Math.min(...macroF1),
        speechActMacroF1StdDev: standardDeviation(macroF1),
        meanPerClassRecall,
        minimumHighRiskRecall: Math.min(...highRiskRecall),
        meanHighRiskRecall: average(highRiskRecall),
        totalHighRiskFalsePositiveCount: highRisk.reduce((sum, value) => sum + value, 0),
        worstFoldHighRiskFalsePositiveCount: Math.max(...highRisk),
        meanOodFalseAcceptanceRate: average(ood),
        worstFoldOodFalseAcceptanceRate: ood.length ? Math.max(...ood) : null,
        folds: results };
}

function compareSelectionEvidence(left, right) {
    const leftEvidence = left.selectionValidation;
    const rightEvidence = right.selectionValidation;
    const safetyRate = value => typeof value === 'number' && Number.isFinite(value)
        ? value : Infinity;
    return leftEvidence.worstFoldHighRiskFalsePositiveCount
            - rightEvidence.worstFoldHighRiskFalsePositiveCount
        || leftEvidence.totalHighRiskFalsePositiveCount
            - rightEvidence.totalHighRiskFalsePositiveCount
        || safetyRate(leftEvidence.worstFoldOodFalseAcceptanceRate)
            - safetyRate(rightEvidence.worstFoldOodFalseAcceptanceRate)
        || safetyRate(leftEvidence.meanOodFalseAcceptanceRate)
            - safetyRate(rightEvidence.meanOodFalseAcceptanceRate)
        || rightEvidence.minimumHighRiskRecall - leftEvidence.minimumHighRiskRecall
        || rightEvidence.meanHighRiskRecall - leftEvidence.meanHighRiskRecall
        || rightEvidence.meanSpeechActMacroF1 - leftEvidence.meanSpeechActMacroF1
        || leftEvidence.speechActMacroF1StdDev
            - rightEvidence.speechActMacroF1StdDev
        || left.representationId.localeCompare(right.representationId)
        || left.perClassLimit - right.perClassLimit;
}

function selectEmbeddingRepresentations(representationIds) {
    if (!Array.isArray(representationIds) || representationIds.length === 0) {
        return EMBEDDING_REPRESENTATIONS.slice();
    }
    const requested = [...new Set(representationIds)];
    const knownIds = new Set(EMBEDDING_REPRESENTATIONS.map(row => row.id));
    const unknown = requested.filter(id => !knownIds.has(id));
    if (unknown.length) {
        throw new Error(`EMBEDDING_REPRESENTATION_UNKNOWN:${unknown.join(',')}`);
    }
    return EMBEDDING_REPRESENTATIONS.filter(row => requested.includes(row.id));
}

function evaluateEmbeddingVectors(rowsBySplit, vectors, anchors, representationIds) {
    const proposalById = buildBaselineProposals([
        ...rowsBySplit.calibration, ...rowsBySplit.blind_test
    ]);
    return selectEmbeddingRepresentations(representationIds)
        .flatMap(representation => {
        const anchorCounts = representation.anchorCountIndependent
            ? [null] : EMBEDDING_ANCHOR_COUNTS;
        return anchorCounts.map(perClassLimit => {
            const calibrationRows = rawEmbeddingRows(rowsBySplit.calibration,
                vectors, anchors, perClassLimit, representation, proposalById);
            const selectionValidation = crossValidateEmbeddingCalibration(
                calibrationRows, 3);
            const fitted = fitEmbeddingCalibration(calibrationRows);
            const blindRows = rawEmbeddingRows(rowsBySplit.blind_test,
                vectors, anchors, perClassLimit, representation, proposalById);
            return { representationId: representation.id, perClassLimit,
                anchorSelectionPolicy: representation.id === 'contract-centroid-guard'
                    ? 'PROTOTYPE_CLASS_CENTROID_INTENT_CONTRACT_V1'
                    : representation.id === 'contract-frame-centroid-guard'
                    ? 'PROTOTYPE_CLASS_CENTROID_INTENT_CONTRACT_FRAME_V1'
                    : representation.id
                        === 'contract-bluff-candidate-centroid-ood-max-guard'
                    ? 'PROTOTYPE_CLASS_CENTROID_INTENT_CONTRACT_BLUFF_CANDIDATE_OOD_MAX_V1'
                    : representation.id === 'bounded-domain-contract-bluff-centroid-guard'
                    ? 'PROTOTYPE_CLASS_CENTROID_BOUNDED_DOMAIN_CONTRACT_BLUFF_V1'
                    : representation.id === 'contract-bluff-candidate-centroid-guard'
                    ? 'PROTOTYPE_CLASS_CENTROID_INTENT_CONTRACT_BLUFF_CANDIDATE_V1'
                    : representation.id === 'frame-centroid-guard'
                    ? 'PROTOTYPE_CLASS_CENTROID_FRAME_GUARD_V1'
                    : representation.anchorCountIndependent
                        ? 'PROTOTYPE_CLASS_CENTROID_V1'
                    : 'PROTOTYPE_GREEDY_COVERAGE_V1',
                selectionValidation,
                calibration: fitted.metrics, thresholds: fitted.calibration,
                blindTest: summarizeEmbeddingRows(blindRows, fitted.calibration) };
        });
    });
}

function hashFile(filePath) {
    return new Promise((resolve, reject) => {
        const hash = require('node:crypto').createHash('sha256');
        fs.createReadStream(filePath).on('data', chunk => hash.update(chunk))
            .on('error', reject).on('end', () => resolve(hash.digest('hex')));
    });
}

async function runEmbeddingModel(spec, rowsBySplit) {
    const started = performance.now();
    const rssBefore = process.memoryUsage().rss;
    let peakObservedRssBytes = rssBefore;
    const { getLlama } = await import('node-llama-cpp');
    const llama = await getLlama({ gpu: false });
    const model = await llama.loadModel({ modelPath: spec.modelPath, gpuLayers: 0 });
    const loadedAt = performance.now();
    const context = await model.createEmbeddingContext({
        contextSize: spec.contextSize || 511, threads: 0 });
    const profiles = [];
    try {
        for (const profile of spec.profiles) {
            const durations = [];
            const vectors = new Map();
            const anchors = [];
            for (const row of rowsBySplit.prototype) {
                const before = performance.now();
                const result = await context.getEmbeddingFor(
                    `${profile.anchorPrefix}${row.text}`);
                peakObservedRssBytes = Math.max(peakObservedRssBytes,
                    process.memoryUsage().rss);
                durations.push(performance.now() - before);
                const vector = l2Normalize(result.vector);
                vectors.set(row.id, vector);
                anchors.push({ id: row.id,
                    label: row.adjudication.labels.speechAct,
                    labels: row.adjudication.labels, vector });
            }
            for (const split of ['calibration', 'blind_test']) {
                for (const row of rowsBySplit[split]) {
                    const before = performance.now();
                    const result = await context.getEmbeddingFor(
                        `${profile.queryPrefix}${row.text}`);
                    peakObservedRssBytes = Math.max(peakObservedRssBytes,
                        process.memoryUsage().rss);
                    durations.push(performance.now() - before);
                    vectors.set(row.id, l2Normalize(result.vector));
                }
            }
            const normalizationProbe = anchors.length > 1 ? {
                cosine: cosineSimilarity(anchors[0].vector, anchors[1].vector),
                normalizedDot: dotProduct(anchors[0].vector, anchors[1].vector)
            } : null;
            const curve = evaluateEmbeddingVectors(rowsBySplit, vectors, anchors,
                spec.representationIds);
            const selected = curve.slice().sort(compareSelectionEvidence)[0];
            profiles.push({ id: profile.id,
                encoding: { queryPrefix: profile.queryPrefix,
                    anchorPrefix: profile.anchorPrefix },
                vectorDimension: anchors[0] ? anchors[0].vector.length : null,
                normalizedDotCosineDelta: normalizationProbe
                    ? Math.abs(normalizationProbe.cosine
                        - normalizationProbe.normalizedDot) : null,
                warmLatencyMs: { p50: percentile(durations, 0.5),
                    p95: percentile(durations, 0.95) },
                selectionMethod: 'STRATIFIED_OUTER_CALIBRATION_V1',
                selectedByCalibration: selected.perClassLimit,
                selectedRepresentation: selected.representationId,
                anchorCurve: curve });
        }
        return { id: spec.id, modelPath: path.basename(spec.modelPath),
            fileBytes: fs.statSync(spec.modelPath).size,
            sha256: await hashFile(spec.modelPath),
            runtime: { package: 'node-llama-cpp',
                version: readJson(path.join(ROOT, 'node_modules', 'node-llama-cpp',
                    'package.json'), {}).version || null,
                cpuOnly: true, coldLoadMs: loadedAt - started,
                peakObservedRssBytes,
                rssDeltaBytes: Math.max(0, peakObservedRssBytes - rssBefore) },
            profiles };
    } finally {
        await context.dispose(); await model.dispose(); await llama.dispose();
    }
}

function embeddingGoldSplits(corpus) {
    const candidateIds = new Set((corpus.candidates || []).map(row => row.id));
    const gold = (corpus.candidates || []).filter(row => row.adjudication
        && isGoldReview(row.adjudication, candidateIds));
    return Object.fromEntries(SPLITS.map(split =>
        [split, gold.filter(row => row.split === split)]));
}

function embeddingEvaluationPrefixes(source) {
    const legacyPrefix = typeof source === 'string' ? source
        : source && typeof source.sourceIdPrefix === 'string'
            ? source.sourceIdPrefix : '';
    const calibration = source && typeof source === 'object'
        && typeof source.calibrationSourceIdPrefix === 'string'
        ? source.calibrationSourceIdPrefix : legacyPrefix;
    const blindTest = source && typeof source === 'object'
        && typeof source.blindSourceIdPrefix === 'string'
        ? source.blindSourceIdPrefix : legacyPrefix;
    if (!calibration || !blindTest) {
        throw new Error('EMBEDDING_EVALUATION_SOURCE_PREFIX_REQUIRED');
    }
    return { calibration, blindTest };
}

function embeddingEvaluationSplits(corpus, source) {
    const prefixes = embeddingEvaluationPrefixes(source);
    const allGold = embeddingGoldSplits(corpus);
    return {
        prototype: allGold.prototype,
        calibration: allGold.calibration.filter(row => String(row.sourceId || '')
            .startsWith(prefixes.calibration)),
        blind_test: allGold.blind_test.filter(row => String(row.sourceId || '')
            .startsWith(prefixes.blindTest))
    };
}

function embeddingCalibrationStudySplits(corpus, sourceIdPrefix) {
    const evaluation = embeddingEvaluationSplits(corpus, sourceIdPrefix);
    return { prototype: evaluation.prototype,
        calibration: evaluation.calibration, blind_test: [] };
}

function buildDeterministicBlindBaseline(rows) {
    const proposals = buildBaselineProposals(rows);
    const evaluated = rows.map(row => {
        const proposal = proposals.get(row.id);
        return { id: row.id, actual: row.adjudication.labels.speechAct,
            predicted: proposal.labels.speechAct,
            outOfDomain: row.adjudication.labels.outOfDomain,
            confidenceBps: proposal.confidenceBps };
    });
    const actual = evaluated.map(row => row.actual);
    const predicted = evaluated.map(row => row.predicted);
    const ood = evaluated.filter(row => row.outOfDomain);
    const oodFalseAcceptances = ood.filter(row => row.predicted !== 'UNKNOWN');
    const highRiskFalsePositives = evaluated.filter(row =>
        HIGH_RISK_ACTS.includes(row.predicted) && row.actual !== row.predicted);
    return { count: evaluated.length,
        speechActMacroF1: macroF1(actual, predicted),
        perClassRecall: Object.fromEntries([...new Set(actual)].sort().map(label => {
            const classRows = evaluated.filter(row => row.actual === label);
            return [label, classRows.filter(row => row.predicted === label).length
                / classRows.length];
        })),
        oodFalseAcceptanceRate: ood.length ? oodFalseAcceptances.length / ood.length : null,
        oodFalseAcceptanceIds: oodFalseAcceptances.map(row => row.id),
        oodFalseAcceptances: oodFalseAcceptances.map(row => ({
            id: row.id, predicted: row.predicted })),
        highRiskFalsePositiveCount: highRiskFalsePositives.length,
        highRiskFalsePositiveIds: highRiskFalsePositives.map(row => row.id),
        expectedCalibrationError: expectedCalibrationError(evaluated.map(row => ({
            confidenceBps: row.confidenceBps,
            correct: row.actual === row.predicted }))) };
}

function evaluateHighRiskRecall(metrics, baseline) {
    const observed = Object.fromEntries(HIGH_RISK_ACTS.map(label =>
        [label, Number(metrics && metrics.perClassRecall
            && metrics.perClassRecall[label]) || 0]));
    const required = Object.fromEntries(HIGH_RISK_ACTS.map(label => [label,
        Math.max(1 / MIN_REPRESENTATION_CLASS_SUPPORT,
            Number(baseline && baseline.perClassRecall
                && baseline.perClassRecall[label]) || 0)]));
    const failures = HIGH_RISK_ACTS.filter(label => observed[label] < required[label]);
    return { pass: failures.length === 0, observed, required, failures };
}

function buildBlindEvaluationAcceptance(models, deterministicBlindBaseline) {
    return (models || []).map(model => {
        const profileCandidates = model.profiles.map(profile => ({ profile,
            point: profile.anchorCurve.find(point =>
                point.perClassLimit === profile.selectedByCalibration
                    && point.representationId === profile.selectedRepresentation) }))
            .sort((left, right) => compareSelectionEvidence(left.point, right.point)
                || left.profile.id.localeCompare(right.profile.id));
        const selected = profileCandidates[0];
        const macroF1Delta = selected.point.blindTest.speechActMacroF1
            - deterministicBlindBaseline.speechActMacroF1;
        const qualityPass = macroF1Delta >= 0.15;
        const highRiskPass = selected.point.blindTest.highRiskFalsePositiveCount === 0;
        const oodPass = selected.point.blindTest.oodFalseAcceptanceRate === 0;
        const highRiskRecall = evaluateHighRiskRecall(selected.point.blindTest,
            deterministicBlindBaseline);
        return { modelId: model.id, profileId: selected.profile.id,
            representationId: selected.point.representationId,
            perClassLimit: selected.point.perClassLimit, macroF1Delta,
            anchorSelectionPolicy: selected.point.anchorSelectionPolicy,
            qualityPass, highRiskPass, oodPass, highRiskRecall,
            pass: qualityPass && highRiskPass && oodPass && highRiskRecall.pass,
            reasons: [!qualityPass && 'BLIND_MACRO_F1_DELTA_BELOW_0_15',
                !highRiskPass && 'BLIND_HIGH_RISK_FALSE_POSITIVE',
                !oodPass && 'BLIND_OOD_FALSE_ACCEPTANCE',
                !highRiskRecall.pass && 'BLIND_HIGH_RISK_RECALL_REGRESSION_OR_ZERO']
                .filter(Boolean) };
    });
}

async function runEmbeddingSpike(options) {
    const corpus = options.corpus || readJson(DEFAULT_CORPUS_PATH, null);
    const preflight = buildEmbeddingSpikePreflight({ corpus });
    if (!preflight.untouchedEvaluationPass) {
        throw new Error('EMBEDDING_UNTOUCHED_EVALUATION_PREFLIGHT');
    }
    const rowsBySplit = embeddingEvaluationSplits(corpus,
        preflight.untouchedEvaluation);
    const deterministicBlindBaseline = buildDeterministicBlindBaseline(
        rowsBySplit.blind_test);
    const models = [];
    for (const spec of options.models || []) {
        models.push(await runEmbeddingModel(spec, rowsBySplit));
    }
    const acceptance = buildBlindEvaluationAcceptance(models,
        deterministicBlindBaseline);
    return { schemaVersion: 2, kind: 'STORY_SEMANTIC_EMBEDDING_SPIKE_V2',
        generatedAt: new Date().toISOString(), preflight,
        deterministicBlindBaseline, models,
        selection: { acceptedModelIds: acceptance.filter(row => row.pass)
            .map(row => row.modelId), acceptance } };
}

function buildCalibrationStudyRecommendation(models,
    deterministicCalibrationBaseline) {
    const selection = (models || []).map(model => {
        const candidates = model.profiles.map(profile => ({ profile,
            point: profile.anchorCurve.find(point =>
                point.perClassLimit === profile.selectedByCalibration
                    && point.representationId === profile.selectedRepresentation) }))
            .sort((left, right) => compareSelectionEvidence(left.point, right.point)
                || left.profile.id.localeCompare(right.profile.id));
        const selected = candidates[0];
        const macroF1Delta = selected.point.selectionValidation.meanSpeechActMacroF1
            - deterministicCalibrationBaseline.speechActMacroF1;
        const qualityPass = macroF1Delta >= 0.15;
        const highRiskPass = selected.point.selectionValidation
            .worstFoldHighRiskFalsePositiveCount === 0
            && selected.point.selectionValidation
                .totalHighRiskFalsePositiveCount === 0;
        const oodPass = selected.point.selectionValidation
            .worstFoldOodFalseAcceptanceRate === 0
            && selected.point.selectionValidation.meanOodFalseAcceptanceRate === 0;
        const highRiskRecall = evaluateHighRiskRecall({
            perClassRecall: selected.point.selectionValidation.meanPerClassRecall
        }, deterministicCalibrationBaseline);
        return { modelId: model.id, profileId: selected.profile.id,
            representationId: selected.point.representationId,
            perClassLimit: selected.point.perClassLimit,
            anchorSelectionPolicy: selected.point.anchorSelectionPolicy,
            selectionValidation: selected.point.selectionValidation,
            macroF1Delta, qualityPass, highRiskPass, oodPass, highRiskRecall,
            eligibleForNewBlindEpoch: qualityPass && highRiskPass
                && oodPass && highRiskRecall.pass,
            reasons: [!qualityPass && 'OUTER_CALIBRATION_MACRO_F1_DELTA_BELOW_0_15',
                !highRiskPass && 'OUTER_CALIBRATION_HIGH_RISK_FALSE_POSITIVE',
                !oodPass && 'OUTER_CALIBRATION_OOD_FALSE_ACCEPTANCE',
                !highRiskRecall.pass
                    && 'OUTER_CALIBRATION_HIGH_RISK_RECALL_REGRESSION_OR_ZERO']
                .filter(Boolean) };
    });
    return {
        eligibleModelIds: selection.filter(row => row.eligibleForNewBlindEpoch)
            .map(row => row.modelId),
        createNewBlindEpoch: selection.some(row => row.eligibleForNewBlindEpoch),
        selection
    };
}

async function runEmbeddingCalibrationStudy(options) {
    const corpus = options.corpus || readJson(DEFAULT_CORPUS_PATH, null);
    const preflight = buildEmbeddingSpikePreflight({ corpus });
    const evaluation = preflight.untouchedEvaluation;
    const calibrationReady = preflight.representationSelectionPass
        && evaluation && Object.values(evaluation.byClass || {}).every(coverage =>
            coverage.calibration >= evaluation.minimumPerClassPerEvaluationSplit)
        && Number(evaluation.outOfDomainBySplit
            && evaluation.outOfDomainBySplit.calibration) >=
            evaluation.minimumPerClassPerEvaluationSplit;
    if (!calibrationReady) {
        throw new Error('EMBEDDING_CALIBRATION_STUDY_PREFLIGHT');
    }
    const rowsBySplit = embeddingCalibrationStudySplits(corpus, evaluation);
    const deterministicCalibrationBaseline = buildDeterministicBlindBaseline(
        rowsBySplit.calibration);
    const models = [];
    for (const spec of options.models || []) {
        models.push(await runEmbeddingModel(spec, rowsBySplit));
    }
    return { schemaVersion: 1,
        kind: 'STORY_SEMANTIC_EMBEDDING_CALIBRATION_STUDY_V1',
        generatedAt: new Date().toISOString(), preflight,
        boundary: { blindTestAccessed: false,
            prototypeCount: rowsBySplit.prototype.length,
            calibrationCount: rowsBySplit.calibration.length,
            blindTestCount: rowsBySplit.blind_test.length },
        deterministicCalibrationBaseline, models,
        recommendation: buildCalibrationStudyRecommendation(models,
            deterministicCalibrationBaseline) };
}

function embeddingModelSpecs(e5Path, bgePath) {
    const models = [];
    if (e5Path) models.push({
        id: 'multilingual-e5-small-q8_0', modelPath: e5Path,
            contextSize: 511, profiles: [
                { id: 'e5-query-query', queryPrefix: 'query: ',
                    anchorPrefix: 'query: ' },
                { id: 'e5-query-passage', queryPrefix: 'query: ',
                    anchorPrefix: 'passage: ' }
            ] });
    if (bgePath) models.push({
        id: 'bge-m3-q8_0', modelPath: bgePath, contextSize: 512,
            profiles: [{ id: 'bge-m3-plain', queryPrefix: '',
                anchorPrefix: '' }] });
    return models;
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
    const representationSupport = Object.fromEntries([...blindActs].sort().map(act =>
        [act, Object.fromEntries(SPLITS.map(split => [split,
            bySplit[split].filter(row => row.adjudication.labels.speechAct === act).length]))]));
    const representationIssues = [];
    for (const [act, coverage] of Object.entries(representationSupport)) {
        for (const split of SPLITS) {
            if (coverage[split] < MIN_REPRESENTATION_CLASS_SUPPORT) {
                representationIssues.push(`REPRESENTATION_CLASS_SUPPORT:${act}:${split}`
                    + `:${coverage[split]}/${MIN_REPRESENTATION_CLASS_SUPPORT}`);
            }
        }
    }
    const evaluationPolicy = corpus && corpus.representationEvaluationPolicy;
    const legacyEvaluationPrefix = evaluationPolicy
        && typeof evaluationPolicy.sourceIdPrefix === 'string'
        ? evaluationPolicy.sourceIdPrefix : '';
    const calibrationEvaluationPrefix = evaluationPolicy
        && typeof evaluationPolicy.calibrationSourceIdPrefix === 'string'
        ? evaluationPolicy.calibrationSourceIdPrefix : legacyEvaluationPrefix;
    const blindEvaluationPrefix = evaluationPolicy
        && typeof evaluationPolicy.blindSourceIdPrefix === 'string'
        ? evaluationPolicy.blindSourceIdPrefix : legacyEvaluationPrefix;
    const evaluationSplits = evaluationPolicy
        && Array.isArray(evaluationPolicy.evaluationSplits)
        ? evaluationPolicy.evaluationSplits.filter(split => SPLITS.includes(split)) : [];
    const evaluationMinimum = Number(evaluationPolicy
        && evaluationPolicy.minimumPerClassPerEvaluationSplit)
        || MIN_REPRESENTATION_CLASS_SUPPORT;
    const evaluationBySplit = {
        prototype: calibrationEvaluationPrefix ? gold.filter(row =>
            row.split === 'prototype' && String(row.sourceId || '')
                .startsWith(calibrationEvaluationPrefix)) : [],
        calibration: calibrationEvaluationPrefix ? gold.filter(row =>
            row.split === 'calibration' && String(row.sourceId || '')
                .startsWith(calibrationEvaluationPrefix)) : [],
        blind_test: blindEvaluationPrefix ? gold.filter(row =>
            row.split === 'blind_test' && String(row.sourceId || '')
                .startsWith(blindEvaluationPrefix)) : []
    };
    const evaluationGold = SPLITS.flatMap(split => evaluationBySplit[split]);
    const evaluationSupport = Object.fromEntries([...blindActs].sort().map(act =>
        [act, Object.fromEntries(evaluationSplits.map(split => [split,
            evaluationBySplit[split].filter(row =>
                row.adjudication.labels.speechAct === act).length]))]));
    const evaluationOodBySplit = Object.fromEntries(evaluationSplits.map(split => [split,
        evaluationBySplit[split].filter(row =>
            row.adjudication.labels.outOfDomain).length]));
    const evaluationIssues = [];
    if (!evaluationPolicy || !calibrationEvaluationPrefix || !blindEvaluationPrefix
        || evaluationSplits.length !== 2
        || !evaluationSplits.includes('calibration')
        || !evaluationSplits.includes('blind_test')) {
        evaluationIssues.push('REPRESENTATION_EVALUATION_POLICY_INVALID');
    } else {
        if (evaluationPolicy.blindStatus !== 'SEALED_UNTOUCHED') {
            evaluationIssues.push('UNTOUCHED_EVALUATION_ALREADY_SPENT:'
                + String(evaluationPolicy.blindStatus || 'UNMARKED'));
        }
        for (const [act, coverage] of Object.entries(evaluationSupport)) {
            for (const split of evaluationSplits) {
                if (coverage[split] < evaluationMinimum) {
                    evaluationIssues.push(`UNTOUCHED_CLASS_SUPPORT:${act}:${split}`
                        + `:${coverage[split]}/${evaluationMinimum}`);
                }
            }
        }
        for (const split of evaluationSplits) {
            if (evaluationOodBySplit[split] < evaluationMinimum) {
                evaluationIssues.push(`UNTOUCHED_OOD_SUPPORT:${split}`
                    + `:${evaluationOodBySplit[split]}/${evaluationMinimum}`);
            }
        }
    }
    const threshold = Number(corpus && corpus.gates
        && corpus.gates.prototypeHumanGold) || 100;
    const representationSelectionPass = validation.ok && gold.length >= threshold
        && issues.length === 0 && representationIssues.length === 0;
    return {
        ok: validation.ok,
        experimentGatePass: validation.ok && gold.length >= threshold,
        modelSelectionPass: validation.ok && gold.length >= threshold && issues.length === 0,
        representationSelectionPass,
        untouchedEvaluationPass: representationSelectionPass
            && evaluationIssues.length === 0,
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
        representationSupport: {
            minimumPerClassPerSplit: MIN_REPRESENTATION_CLASS_SUPPORT,
            byClass: representationSupport,
            issues: representationIssues
        },
        untouchedEvaluation: {
            epoch: evaluationPolicy && evaluationPolicy.epoch || null,
            sourceIdPrefix: calibrationEvaluationPrefix === blindEvaluationPrefix
                ? calibrationEvaluationPrefix : null,
            calibrationSourceIdPrefix: calibrationEvaluationPrefix || null,
            blindSourceIdPrefix: blindEvaluationPrefix || null,
            priorBlindStatus: evaluationPolicy && evaluationPolicy.priorBlindStatus || null,
            blindStatus: evaluationPolicy && evaluationPolicy.blindStatus || null,
            evaluatedAt: evaluationPolicy && evaluationPolicy.evaluatedAt || null,
            evaluatedModelIds: evaluationPolicy
                && Array.isArray(evaluationPolicy.evaluatedModelIds)
                ? evaluationPolicy.evaluatedModelIds.slice() : [],
            minimumPerClassPerEvaluationSplit: evaluationMinimum,
            gold: { total: evaluationGold.length,
                bySplit: Object.fromEntries(SPLITS.map(split =>
                    [split, evaluationBySplit[split].length])) },
            byClass: evaluationSupport,
            outOfDomainBySplit: evaluationOodBySplit,
            issues: evaluationIssues
        },
        issues
    };
}

if (require.main === module) {
    if (process.argv.includes('--embedding-spike')
        || process.argv.includes('--embedding-calibration-study')) {
        const value = name => {
            const prefix = `--${name}=`;
            const item = process.argv.find(argument => argument.startsWith(prefix));
            return item ? item.slice(prefix.length) : null;
        };
        const e5Path = value('e5-model');
        const bgePath = value('bge-model');
        const models = embeddingModelSpecs(e5Path, bgePath);
        if (!models.length) throw new Error('EMBEDDING_MODEL_PATH_REQUIRED');
        const representation = value('representation');
        const representationIds = representation
            ? representation.split(',').map(id => id.trim()).filter(Boolean) : [];
        selectEmbeddingRepresentations(representationIds);
        for (const model of models) model.representationIds = representationIds;
        const run = process.argv.includes('--embedding-calibration-study')
            ? runEmbeddingCalibrationStudy : runEmbeddingSpike;
        run({ models }).then(report => {
            const output = value('output');
            if (output) fs.writeFileSync(path.resolve(output),
                `${JSON.stringify(report, null, 2)}\n`);
            process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        }).catch(error => { console.error(error); process.exitCode = 2; });
        return;
    }
    if (process.argv.includes('--embedding-spike-preflight')) {
        const preflight = buildEmbeddingSpikePreflight();
        process.stdout.write(`${JSON.stringify(preflight, null, 2)}\n`);
        if (!preflight.ok || (process.argv.includes('--require-model-selection')
            && !preflight.modelSelectionPass)
            || (process.argv.includes('--require-representation-selection')
                && !preflight.representationSelectionPass)
            || (process.argv.includes('--require-untouched-evaluation')
                && !preflight.untouchedEvaluationPass)) process.exitCode = 2;
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
    labelsFromAnalysis, buildBaselineProposals, buildBenchmark, buildEmbeddingSpikePreflight,
    l2Normalize, dotProduct, cosineSimilarity, frameCompatibility,
    matchesHighRiskFrameContract, matchesAuthoritativeSpeechActContract,
    hasBoundedDomainGrounding,
    matchesBoundedDomainFrameContract,
    selectEmbeddingRepresentations,
    selectPrototypeAnchors, buildPrototypeClassCentroids, rankEmbeddingCandidates,
    fitEmbeddingCalibration, buildStratifiedCalibrationFolds,
    crossValidateEmbeddingCalibration, compareSelectionEvidence,
    summarizeEmbeddingRows, evaluateEmbeddingVectors,
    embeddingEvaluationSplits, embeddingCalibrationStudySplits,
    evaluateHighRiskRecall, buildBlindEvaluationAcceptance,
    buildCalibrationStudyRecommendation, runEmbeddingSpike,
    runEmbeddingCalibrationStudy
};
