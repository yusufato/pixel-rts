'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const HOST = '127.0.0.1';
const PORT = Math.max(1024, Math.floor(Number(process.env.PIXEL_SEMANTIC_REVIEW_PORT) || 4318));
const HTML_PATH = path.join(__dirname, 'story-semantic-review.html');
const TEACHER_PATH = path.join(ROOT, 'qa-runtime', 'story-conversation-semantic-teacher-coverage.json');
const QUALITY_PATH = path.join(ROOT, 'qa-runtime', 'story-conversation-semantic-quality.json');
const REVIEWS_PATH = path.join(ROOT, 'qa-runtime', 'story-conversation-semantic-human-reviews.json');
const AXES = Object.freeze(['communicativeFunction', 'surfaceForm', 'predicate', 'target',
    'polarity', 'temporality', 'epistemicStatus', 'continuity', 'requestedOutcome']);
const VERDICTS = Object.freeze(['ACCEPT', 'REJECT', 'EDIT']);
const UI_CONTRACT_VERSION = 2;

function readJson(filePath, fallback) {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (_) { return fallback; }
}

function atomicWrite(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.renameSync(temporaryPath, filePath);
}

function buildQueue() {
    const teacher = readJson(TEACHER_PATH, { results: [] });
    const quality = readJson(QUALITY_PATH, { results: [] });
    const reviews = readJson(REVIEWS_PATH, { reviews: [] });
    const qualityById = new Map((quality.results || []).map(row => [row.id, row]));
    const reviewById = new Map((reviews.reviews || []).map(row => [row.id, row]));
    const rows = (teacher.results || []).map(row => ({
        id: row.id, utterance: row.utterance, target: row.target,
        semanticCoreAccepted: !!row.accepted, exactAccepted: !!row.exactAccepted,
        verifiedAxes: row.verifiedAxes || [], maskedAxes: row.maskedAxes || [],
        evidenceSpans: row.evidenceSpans || [], quality: qualityById.get(row.id) || null,
        review: reviewById.get(row.id) && reviewById.get(row.id).uiContractVersion === UI_CONTRACT_VERSION
            ? reviewById.get(row.id) : null,
        legacyReview: reviewById.get(row.id) && reviewById.get(row.id).uiContractVersion !== UI_CONTRACT_VERSION
            ? reviewById.get(row.id) : null
    }));
    return { schemaVersion: 1, axes: AXES.slice(), rows,
        status: { total: rows.length, reviewed: rows.filter(row => row.review).length,
            accepted: rows.filter(row => row.review && ['ACCEPT', 'EDIT'].includes(row.review.verdict)).length,
            rejected: rows.filter(row => row.review && row.review.verdict === 'REJECT').length } };
}

function validateReview(input, queue) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, code: 'OBJECT_REQUIRED' };
    const allowed = new Set(['id', 'verdict', 'correctedUtterance', 'approvedAxes', 'notes']);
    if (Object.keys(input).some(key => !allowed.has(key))) return { ok: false, code: 'UNKNOWN_FIELD' };
    const id = String(input.id || '');
    if (!queue.rows.some(row => row.id === id)) return { ok: false, code: 'UNKNOWN_ID' };
    const verdict = String(input.verdict || '');
    if (!VERDICTS.includes(verdict)) return { ok: false, code: 'INVALID_VERDICT' };
    const correctedUtterance = String(input.correctedUtterance || '').trim();
    if (verdict === 'EDIT' && (correctedUtterance.length < 3 || correctedUtterance.length > 300)) {
        return { ok: false, code: 'EDIT_TEXT_REQUIRED' };
    }
    const approvedAxes = Array.isArray(input.approvedAxes)
        ? [...new Set(input.approvedAxes.map(String))] : [];
    if (approvedAxes.some(axis => !AXES.includes(axis))) return { ok: false, code: 'INVALID_AXIS' };
    if (['ACCEPT', 'EDIT'].includes(verdict)
        && !['communicativeFunction', 'surfaceForm', 'predicate'].every(axis => approvedAxes.includes(axis))) {
        return { ok: false, code: 'CORE_AXES_REQUIRED' };
    }
    const notes = String(input.notes || '').trim().slice(0, 500);
    return { ok: true, value: { id, verdict, uiContractVersion: UI_CONTRACT_VERSION,
        correctedUtterance: verdict === 'EDIT' ? correctedUtterance : null,
        approvedAxes, notes, reviewedAt: new Date().toISOString(), reviewer: 'LOCAL_HUMAN' } };
}

function saveReview(review) {
    const ledger = readJson(REVIEWS_PATH, { schemaVersion: 1, reviews: [] });
    const previous = (ledger.reviews || []).find(row => row.id === review.id) || null;
    const rows = (ledger.reviews || []).filter(row => row.id !== review.id);
    rows.push(review); rows.sort((a, b) => a.id.localeCompare(b.id, 'en'));
    const history = Array.isArray(ledger.history) ? ledger.history.slice() : [];
    if (previous) history.push(Object.assign({ supersededAt: new Date().toISOString() }, previous));
    const next = { schemaVersion: 1, updatedAt: new Date().toISOString(),
        reviews: rows, history: history.slice(-500) };
    atomicWrite(REVIEWS_PATH, next);
    return next;
}

function json(res, status, value) {
    const body = Buffer.from(JSON.stringify(value));
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8',
        'content-length': body.length, 'cache-control': 'no-store' });
    res.end(body);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = []; let size = 0;
        req.on('data', chunk => {
            size += chunk.length;
            if (size > 65536) { reject(new Error('BODY_TOO_LARGE')); req.destroy(); return; }
            chunks.push(chunk);
        });
        req.on('end', () => {
            try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
            catch (_) { reject(new Error('INVALID_JSON')); }
        });
        req.on('error', reject);
    });
}

function createServer() {
    return http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url, `http://${HOST}:${PORT}`);
            if (req.method === 'GET' && url.pathname === '/') {
                const body = fs.readFileSync(HTML_PATH);
                res.writeHead(200, { 'content-type': 'text/html; charset=utf-8',
                    'content-length': body.length, 'cache-control': 'no-store' });
                res.end(body); return;
            }
            if (req.method === 'GET' && url.pathname === '/api/queue') {
                json(res, 200, buildQueue()); return;
            }
            if (req.method === 'POST' && url.pathname === '/api/review') {
                const queue = buildQueue();
                const validation = validateReview(await readBody(req), queue);
                if (!validation.ok) { json(res, 400, validation); return; }
                saveReview(validation.value);
                json(res, 200, { ok: true, review: validation.value, status: buildQueue().status }); return;
            }
            json(res, 404, { ok: false, code: 'NOT_FOUND' });
        } catch (error) { json(res, 500, { ok: false, code: String(error && error.message || error) }); }
    });
}

if (require.main === module) {
    createServer().listen(PORT, HOST, () => {
        process.stdout.write(`Pixel RTS semantic review: http://${HOST}:${PORT}\n`);
    });
}

module.exports = { AXES, VERDICTS, UI_CONTRACT_VERSION, buildQueue, validateReview, saveReview, createServer };
