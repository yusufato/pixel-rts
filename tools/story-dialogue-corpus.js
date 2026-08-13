'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CORPUS_SCHEMA_VERSION = 1;
const CORPUS_VERSION = 'dialogue-eval-corpus-s0-v1';
const REVIEW_STATUSES = Object.freeze(['UNREVIEWED', 'REVIEWED_REJECTED', 'REVIEWED_ACCEPTED']);
const FAILURE_TAGS = Object.freeze([
    'MISUNDERSTOOD_INTENT', 'LOST_CONTEXT', 'FAILED_REFERENCE_RESOLUTION',
    'FAILED_TO_ANSWER', 'UNNECESSARY_CLARIFICATION', 'REPEATED_REPLY',
    'SERVICE_BOT_LANGUAGE', 'CHARACTER_VOICE_BREAK', 'ROLE_CONTRADICTION',
    'HALLUCINATED_FACT', 'HALLUCINATED_ENTITY', 'HALLUCINATED_NUMBER',
    'FALSE_SHARED_HISTORY', 'UNVERIFIED_CLAIM_AS_FACT', 'SECRET_LEAK',
    'UNAUTHORIZED_COMMITMENT', 'WORLD_MUTATION_WITHOUT_CONFIRMATION',
    'BROKEN_TURKISH', 'INAPPROPRIATE_TONE', 'OVERLONG_REPLY', 'OTHER_REVIEWED'
]);
const FORBIDDEN_KEYS = new Set([
    'system', 'prompt', 'beliefs', 'worldFacts', 'hiddenFacts', 'actorId', 'name',
    'absolutePath', 'modelPath', 'rawEntry'
]);
const SERVICE_BOT = /nasıl yardımcı olabilirim|ne tür bir yardım|talebinizi belirt|buyurun|emrinize amadeyim/i;
const UNKNOWN_WALL = /amacı güvenle çıkaramadım|ne demek istediğini biraz daha aç/i;

function sha256(value) {
    return `sha256:${crypto.createHash('sha256').update(String(value)).digest('hex')}`;
}

function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function stableJson(value) {
    return JSON.stringify(stable(value));
}

function fold(value) {
    return String(value == null ? '' : value)
        .toLocaleLowerCase('tr-TR').replace(/ı/g, 'i')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9:_-]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function regexEscape(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeText(value, listenerName) {
    let text = String(value == null ? '' : value)
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
        .replace(/\b[A-Z]:\\(?:[^\s<>:"|?*]+\\)*[^\s<>:"|?*]*/gi, '[YEREL_YOL]')
        .replace(/\bhttps?:\/\/\S+/gi, '[URL]')
        .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, '[EPOSTA]')
        .replace(/(?:\+?90[\s.-]?)?(?:\(?0?5\d{2}\)?[\s.-]?)\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/g, '[TELEFON]')
        .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP]');
    const providedNames = Array.isArray(listenerName) ? listenerName : [listenerName];
    const names = providedNames.filter(Boolean).flatMap(value => [String(value).trim()].concat(
        String(value).trim().split(/\s+/).filter(part => part.length >= 3)
    )).filter(value => value.length >= 2).sort((a, b) => b.length - a.length);
    if (names.length) {
        for (const name of new Set(names)) {
            text = text.replace(new RegExp(`\\b${regexEscape(name)}\\b`, 'giu'), '[KARAKTER]');
        }
    }
    return text.trim().replace(/[ \t]+/g, ' ').slice(0, 1200);
}

function actorPseudonym(actorId, role) {
    return `ACTOR-${sha256(`${role || 'UNKNOWN'}|${actorId || 'UNKNOWN'}`).slice(7, 17).toUpperCase()}`;
}

function sourceFiles(defaultPath) {
    const main = path.resolve(defaultPath || path.join(ROOT, 'qa-runtime', 'story-dialogue-log.jsonl'));
    return [`${main}.1`, main].filter(file => fs.existsSync(file));
}

function readRows(files) {
    const rows = [];
    const sources = [];
    let invalidLineCount = 0;
    for (const file of files) {
        const raw = fs.readFileSync(file, 'utf8');
        const sourceId = `SOURCE-${sha256(path.basename(file)).slice(7, 17).toUpperCase()}`;
        sources.push({ sourceId, fileName: path.basename(file), bytes: Buffer.byteLength(raw), sha256: sha256(raw) });
        raw.split(/\r?\n/).forEach((line, index) => {
            if (!line.trim()) return;
            try {
                const row = JSON.parse(line);
                if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('OBJECT_REQUIRED');
                rows.push(Object.assign({}, row, {
                    _sourceId: sourceId,
                    _sourceLine: index + 1,
                    _sourceRecordHash: sha256(line)
                }));
            } catch (_) { invalidLineCount++; }
        });
    }
    rows.sort((a, b) => String(a.recordedAt || '').localeCompare(String(b.recordedAt || ''), 'en')
        || String(a._sourceId).localeCompare(String(b._sourceId), 'en')
        || a._sourceLine - b._sourceLine);
    return { rows, sources, invalidLineCount };
}

function epochRows(rows) {
    let epoch = 0;
    let sawSessionOne = false;
    return rows.map(row => {
        const isNewRun = row.eventType === 'TURN_CREATED' && Number(row.turnSequence) === 0
            && /^conversation-session:1$/.test(String(row.sessionId || ''));
        if (isNewRun && sawSessionOne) epoch++;
        if (isNewRun) sawSessionOne = true;
        return Object.assign({}, row, { _epoch: epoch });
    });
}

function finalTurns(sessionRows) {
    const byResponse = new Map();
    for (const row of sessionRows) {
        const key = String(row.responseId || '');
        if (!key) continue;
        const item = byResponse.get(key) || { created: null, final: null, records: [] };
        if (row.eventType === 'TURN_CREATED') item.created = row;
        item.final = row;
        item.records.push(row);
        byResponse.set(key, item);
    }
    return Array.from(byResponse.values()).filter(item => item.created && item.final)
        .sort((a, b) => Number(a.created.turnSequence) - Number(b.created.turnSequence)
            || String(a.created.recordedAt || '').localeCompare(String(b.created.recordedAt || ''), 'en'));
}

function familySignature(role, turns) {
    // Canlı motorun speech/discourse etiketi gözlemdir, altın doğru değildir.
    // Split ailesi buggy model etiketinden türetilmez. Oyuncu sözünün üslup
    // parçaları azaltılmış karması kullanılır; ileride 14B'nin ürettiği her
    // mutasyon ebeveyn scenarioFamilyId'yi açıkça miras almak zorundadır.
    const utterances = turns.map(item => fold(item.created && item.created.playerText)
        .replace(/\b(efendim|dostum|lutfen|rica ederim|peki ama)\b/g, ' ')
        .replace(/\b\d+(?:[.,]\d+)?\b/g, '#')
        .trim().replace(/\s+/g, ' '));
    return `${role || 'UNKNOWN'}|${turns.length}|${utterances.join('>')}`;
}

function splitForFamily(familyId) {
    const value = parseInt(familyId.slice(-8), 16) >>> 0;
    const bucket = value % 100;
    return bucket < 70 ? 'train' : bucket < 85 ? 'development' : 'blind_test';
}

function splitAssignments(familyIds) {
    const unique = Array.from(new Set(familyIds)).sort((a, b) => {
        const ah = parseInt(a.slice(-8), 16) >>> 0;
        const bh = parseInt(b.slice(-8), 16) >>> 0;
        return ah - bh || a.localeCompare(b, 'en');
    });
    if (unique.length < 3) return new Map(unique.map(id => [id, splitForFamily(id)]));
    const trainCount = Math.max(1, Math.floor(unique.length * 0.70));
    const developmentCount = Math.max(1, Math.floor(unique.length * 0.15));
    const blindStart = Math.min(unique.length - 1, trainCount + developmentCount);
    return new Map(unique.map((id, index) => [id,
        index < trainCount ? 'train' : index < blindStart ? 'development' : 'blind_test'
    ]));
}

function qualityFlags(reply, previousReplies) {
    const folded = fold(reply);
    return {
        serviceBotLanguage: SERVICE_BOT.test(reply),
        unknownWall: UNKNOWN_WALL.test(reply),
        exactPreviousReply: previousReplies.some(value => fold(value) === folded),
        emptyReply: !folded
    };
}

function buildCorpusFromRows(inputRows, sourceMeta, options = {}) {
    const rows = epochRows(inputRows).filter(row => ['TURN_CREATED', 'RESPONSE_ENRICHED'].includes(row.eventType));
    const sessions = new Map();
    for (const row of rows) {
        const listener = row.listener || {};
        const key = `${row._epoch}|${row.sessionId}|${listener.actorId || 'UNKNOWN'}`;
        if (!sessions.has(key)) sessions.set(key, []);
        sessions.get(key).push(row);
    }
    const sessionDrafts = [];
    for (const [rawSessionKey, sessionRows] of sessions) {
        const turns = finalTurns(sessionRows);
        if (!turns.length) continue;
        const listener = turns[0].created.listener || {};
        const role = String(listener.role || 'UNKNOWN').slice(0, 80);
        const familyId = sha256(`family|${familySignature(role, turns)}`);
        const groupId = sha256(`group|${rawSessionKey}|${turns.map(item => item.created._sourceRecordHash).join('|')}`);
        sessionDrafts.push({ turns, listener, role, familyId, groupId });
    }
    sessionDrafts.sort((a, b) => a.groupId.localeCompare(b.groupId, 'en'));
    const familySplit = splitAssignments(sessionDrafts.map(row => row.familyId));
    const knownCharacterNames = Array.from(new Set(rows.map(row => row.listener && row.listener.name)
        .filter(Boolean)));
    const cases = [];
    for (const session of sessionDrafts) {
        const split = familySplit.get(session.familyId);
        const pseudonym = actorPseudonym(session.listener.actorId, session.role);
        const history = [];
        const previousReplies = [];
        session.turns.forEach((item, turnIndex) => {
            const created = item.created;
            const final = item.final;
            const playerText = sanitizeText(created.playerText, knownCharacterNames);
            const baselineReply = sanitizeText(created.characterText, knownCharacterNames);
            const observedReply = sanitizeText(final.characterText, knownCharacterNames);
            const caseCore = {
                schemaVersion: 1,
                kind: 'DIALOGUE_EVAL_CASE_V1',
                conversationGroupId: session.groupId,
                scenarioFamilyId: session.familyId,
                split,
                turnIndex,
                listener: { pseudonym, role: session.role },
                history: history.map(row => Object.assign({}, row)),
                playerText,
                observed: {
                    baselineReply,
                    visibleReply: observedReply,
                    speechAct: String(final.speechAct || created.speechAct || 'UNKNOWN').slice(0, 64),
                    discourseAct: String(final.discourseAct || created.discourseAct || '').slice(0, 64),
                    source: String(final.source || created.source || '').slice(0, 96),
                    enrichmentStatus: String(final.enrichmentStatus || '').slice(0, 48),
                    llmUsed: final.llmUsed === true,
                    labelStatus: 'OBSERVED_UNREVIEWED'
                },
                qualityFlags: qualityFlags(observedReply, previousReplies),
                review: { status: 'UNREVIEWED', acceptedReply: null, failureTags: [], reviewer: null },
                sourceTrace: {
                    sourceIds: Array.from(new Set(item.records.map(row => row._sourceId))).sort(),
                    recordHashes: item.records.map(row => row._sourceRecordHash).sort()
                }
            };
            caseCore.caseId = sha256(`case|${stableJson(caseCore)}`);
            cases.push(caseCore);
            history.push({ playerText, characterText: observedReply });
            previousReplies.push(observedReply);
        });
    }
    const splitCounts = { train: 0, development: 0, blind_test: 0 };
    cases.forEach(row => { splitCounts[row.split]++; });
    const corpus = {
        schemaVersion: CORPUS_SCHEMA_VERSION,
        kind: 'STORY_DIALOGUE_EVAL_CORPUS',
        corpusVersion: CORPUS_VERSION,
        policy: {
            split: 'SCENARIO_FAMILY_HASH_RANKED_70_15_15_MINIMUM_ONE_EACH',
            labels: 'OBSERVED_OUTPUT_IS_NOT_GOLD',
            privacy: 'VISIBLE_TEXT_PSEUDONYMIZED_NO_HIDDEN_CONTEXT',
            sourceOrder: 'RECORDED_AT_ASCENDING'
        },
        sources: (sourceMeta || []).map(row => Object.assign({}, row)),
        summary: {
            sourceCount: (sourceMeta || []).length,
            invalidLineCount: Number(options.invalidLineCount) || 0,
            conversationGroupCount: sessionDrafts.length,
            scenarioFamilyCount: new Set(sessionDrafts.map(row => row.familyId)).size,
            caseCount: cases.length,
            splitCounts,
            llmVisibleCaseCount: cases.filter(row => row.observed.llmUsed).length,
            unknownWallCount: cases.filter(row => row.qualityFlags.unknownWall).length,
            serviceBotLanguageCount: cases.filter(row => row.qualityFlags.serviceBotLanguage).length
        },
        cases
    };
    corpus.manifestChecksum = sha256(stableJson(corpus));
    return corpus;
}

function forbiddenKeyPaths(value, pathParts = [], found = []) {
    if (Array.isArray(value)) value.forEach((row, index) => forbiddenKeyPaths(row, pathParts.concat(index), found));
    else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
        if (FORBIDDEN_KEYS.has(key)) found.push(pathParts.concat(key).join('.'));
        forbiddenKeyPaths(child, pathParts.concat(key), found);
    }
    return found;
}

function validateCorpus(corpus) {
    const issues = [];
    const add = (code, detail) => issues.push({ code, detail });
    if (!corpus || typeof corpus !== 'object' || Array.isArray(corpus)) add('OBJECT_REQUIRED', '$');
    if (corpus && corpus.schemaVersion !== CORPUS_SCHEMA_VERSION) add('SCHEMA_VERSION', corpus.schemaVersion);
    if (corpus && corpus.corpusVersion !== CORPUS_VERSION) add('CORPUS_VERSION', corpus.corpusVersion);
    const cases = corpus && Array.isArray(corpus.cases) ? corpus.cases : [];
    if (!cases.length) add('CASES_REQUIRED', 0);
    const ids = new Set();
    const familySplits = new Map();
    for (const row of cases) {
        if (!row || row.kind !== 'DIALOGUE_EVAL_CASE_V1') add('CASE_KIND', row && row.caseId);
        if (ids.has(row.caseId)) add('DUPLICATE_CASE_ID', row.caseId);
        ids.add(row.caseId);
        if (!['train', 'development', 'blind_test'].includes(row.split)) add('CASE_SPLIT', row.caseId);
        if (!row.listener || !/^ACTOR-[A-F0-9]{10}$/.test(row.listener.pseudonym || '')) add('PSEUDONYM', row.caseId);
        if (!row.playerText || !row.observed || !row.observed.visibleReply) add('VISIBLE_TURN_REQUIRED', row.caseId);
        if (!row.observed || row.observed.labelStatus !== 'OBSERVED_UNREVIEWED') add('OBSERVED_NOT_GOLD', row.caseId);
        if (!row.review || !REVIEW_STATUSES.includes(row.review.status)) add('REVIEW_STATUS', row.caseId);
        if (row.review && (!Array.isArray(row.review.failureTags)
            || row.review.failureTags.some(tag => !FAILURE_TAGS.includes(tag)))) add('FAILURE_TAG', row.caseId);
        if (row.review && row.review.status === 'REVIEWED_ACCEPTED' && !row.review.acceptedReply) {
            add('ACCEPTED_REPLY_REQUIRED', row.caseId);
        }
        if (row.review && row.review.status !== 'REVIEWED_ACCEPTED' && row.review.acceptedReply != null) {
            add('ACCEPTED_REPLY_FORBIDDEN', row.caseId);
        }
        const prior = familySplits.get(row.scenarioFamilyId);
        if (prior && prior !== row.split) add('SPLIT_LEAKAGE', row.scenarioFamilyId);
        familySplits.set(row.scenarioFamilyId, row.split);
    }
    forbiddenKeyPaths(corpus).forEach(found => add('FORBIDDEN_KEY', found));
    if (familySplits.size >= 3) {
        const populated = new Set(cases.map(row => row.split));
        for (const split of ['train', 'development', 'blind_test']) {
            if (!populated.has(split)) add('EMPTY_REQUIRED_SPLIT', split);
        }
    }
    if (corpus && corpus.manifestChecksum) {
        const copy = JSON.parse(JSON.stringify(corpus));
        delete copy.manifestChecksum;
        const expected = sha256(stableJson(copy));
        if (expected !== corpus.manifestChecksum) add('CHECKSUM_MISMATCH', expected);
    } else add('CHECKSUM_REQUIRED', null);
    return { ok: issues.length === 0, issues, caseCount: cases.length,
        familyCount: familySplits.size, checksum: corpus && corpus.manifestChecksum || null };
}

function buildCorpus(options = {}) {
    const files = options.files || sourceFiles(options.inputPath);
    const read = readRows(files);
    return buildCorpusFromRows(read.rows, read.sources, { invalidLineCount: read.invalidLineCount });
}

function argValue(name) {
    const direct = process.argv.find(arg => arg.startsWith(`${name}=`));
    if (direct) return direct.slice(name.length + 1);
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : null;
}

function main() {
    const inputPath = argValue('--input') || path.join(ROOT, 'qa-runtime', 'story-dialogue-log.jsonl');
    const outputPath = path.resolve(argValue('--output')
        || path.join(ROOT, 'qa-runtime', 'story-dialogue-corpus-s0.json'));
    const corpus = buildCorpus({ inputPath });
    const validation = validateCorpus(corpus);
    if (!validation.ok) throw new Error(`Corpus doğrulanamadı: ${JSON.stringify(validation.issues.slice(0, 20))}`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(corpus, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ outputPath, validation, summary: corpus.summary }, null, 2));
}

if (require.main === module) {
    try { main(); } catch (error) { console.error(error.stack || error); process.exitCode = 1; }
}

module.exports = {
    CORPUS_SCHEMA_VERSION, CORPUS_VERSION, REVIEW_STATUSES, FAILURE_TAGS,
    sha256, stableJson, fold, sanitizeText,
    epochRows, finalTurns, familySignature, splitForFamily, splitAssignments, buildCorpusFromRows,
    buildCorpus, validateCorpus, forbiddenKeyPaths
};
