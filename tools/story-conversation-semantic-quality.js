'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createLlmHostClient } = require('./story-dialogue-llm-host-client');

const ROOT = path.resolve(__dirname, '..');
const MODEL_FILE = 'Turkish-Llama-8b-Instruct-v0.1.Q4_K_M.gguf';
const MODEL_PATH = path.join(ROOT, 'models', MODEL_FILE);
const ELECTRON_NODE_PATH = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const DEFAULT_INPUT = path.join(ROOT, 'qa-runtime', 'story-conversation-semantic-teacher-coverage.json');
const DEFAULT_OUTPUT = path.join(ROOT, 'qa-runtime', 'story-conversation-semantic-quality.json');
const SYSTEM = 'Türkçe oyun diyaloğu için katı bir redaktör ve kanıt eleştirmenisin. Yeni metin üretmezsin.';
const ISSUE_CODES = Object.freeze([
    'AWKWARD_TURKISH', 'GRAMMAR_ERROR', 'META_GAME_LANGUAGE', 'MULTIPLE_DOMINANT_INTENTS',
    'GENERIC_EVIDENCE', 'EVIDENCE_AXIS_MISMATCH', 'TARGET_DRIFT', 'UNNATURAL_REGISTER', 'NONE'
]);
const SCHEMA = Object.freeze({
    type: 'object', additionalProperties: false,
    properties: {
        naturalTurkish: { type: 'boolean' },
        singleDominantIntent: { type: 'boolean' },
        evidenceFaithful: { type: 'boolean' },
        issues: { type: 'array', minItems: 1, maxItems: 5,
            items: { type: 'string', enum: ISSUE_CODES.slice() } },
        reason: { type: 'string', minLength: 1, maxLength: 180 }
    },
    required: ['naturalTurkish', 'singleDominantIntent', 'evidenceFaithful', 'issues', 'reason']
});

function arg(name, fallback) {
    const prefix = `--${name}=`;
    const found = process.argv.find(value => value.startsWith(prefix));
    return found ? found.slice(prefix.length) : fallback;
}

function promptFor(row) {
    return `Aşağıdaki tek oyuncu sözünü yalnız kalite açısından denetle. Cevap veya düzeltme yazma.\n`
        + `OYUNCU_SÖZÜ=${JSON.stringify(row.utterance || '')}\n`
        + `HEDEF_ÇEKİRDEK=${JSON.stringify({ communicativeFunction: row.target.communicativeFunction,
            surfaceForm: row.target.surfaceForm, predicate: row.target.predicate })}\n`
        + `HAKEM_KANITLARI=${JSON.stringify(row.evidenceSpans || [])}\n`
        + `Kurallar:\n`
        + `- naturalTurkish yalnız söz gerçek bir Türk oyuncunun doğal biçimde söyleyebileceği kadar düzgünse true.\n`
        + `- singleDominantIntent, sözde hedef çekirdekten farklı baskın selamlama/bildirim/istek yoksa true.\n`
        + `- evidenceFaithful yalnız her alıntı kendi eksenini anlamca gerçekten kanıtlıyorsa true. Metinde bulunması tek başına yetmez; “bir şey” ilişki kanıtı değildir.\n`
        + `- Şüphede true verme. Sorun yoksa issues yalnız ["NONE"] olsun.`;
}

function parseQuality(raw) {
    try {
        const value = JSON.parse(String(raw || ''));
        const keys = Object.keys(value || {});
        if (keys.some(key => !['naturalTurkish', 'singleDominantIntent', 'evidenceFaithful', 'issues', 'reason'].includes(key))) return null;
        if (typeof value.naturalTurkish !== 'boolean' || typeof value.singleDominantIntent !== 'boolean'
            || typeof value.evidenceFaithful !== 'boolean' || !Array.isArray(value.issues)
            || !value.issues.length || value.issues.some(issue => !ISSUE_CODES.includes(issue))) return null;
        const reason = String(value.reason || '').trim();
        if (!reason || reason.length > 180) return null;
        const clean = value.naturalTurkish && value.singleDominantIntent && value.evidenceFaithful;
        if (clean && (value.issues.length !== 1 || value.issues[0] !== 'NONE')) return null;
        if (!clean && value.issues.includes('NONE')) return null;
        return { naturalTurkish: value.naturalTurkish,
            singleDominantIntent: value.singleDominantIntent,
            evidenceFaithful: value.evidenceFaithful, issues: value.issues.slice(), reason };
    } catch (_) { return null; }
}

function atomicWrite(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.renameSync(temporaryPath, filePath);
}

async function main() {
    const inputPath = path.resolve(ROOT, arg('input', path.relative(ROOT, DEFAULT_INPUT)));
    const outputPath = path.resolve(ROOT, arg('output', path.relative(ROOT, DEFAULT_OUTPUT)));
    const source = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const rows = Array.isArray(source.results) ? source.results : [];
    const host = createLlmHostClient({ root: ROOT, modelPath: MODEL_PATH, contextSize: 4096,
        electronNodePath: ELECTRON_NODE_PATH, requireDiscreteGpu: true,
        loadTimeoutMs: 90000, generationTimeoutMs: 90000 });
    const results = [];
    try {
        const load = await host.load();
        for (let index = 0; index < rows.length; index++) {
            const row = rows[index];
            process.stderr.write(`[SF3-QUALITY ${index + 1}/${rows.length}]\n`);
            let generated = null;
            let quality = null;
            try {
                generated = await host.generate({ system: SYSTEM, prompt: promptFor(row),
                    maxTokens: 180, temperature: 0.1, jsonSchema: SCHEMA, seed: 593000 + index });
                quality = parseQuality(generated.raw);
            } catch (error) {
                quality = null;
                generated = { raw: null, totalMs: null, error: String(error && error.message || error) };
            }
            results.push({ id: row.id, semanticCoreAccepted: !!row.accepted,
                qualityValid: !!quality, qualityPassed: !!quality && quality.naturalTurkish
                    && quality.singleDominantIntent && quality.evidenceFaithful,
                trainingEligible: false, humanReviewRequired: !!row.accepted,
                quality, raw: generated && generated.raw || null,
                totalMs: generated && generated.totalMs || null,
                error: generated && generated.error || null });
            atomicWrite(outputPath, { schemaVersion: 1, complete: false, modelFile: MODEL_FILE,
                completed: results.length, total: rows.length, results });
        }
        const report = { schemaVersion: 1, complete: true, modelFile: MODEL_FILE,
            backend: host.backend(), devices: host.backendDevices(), loadMs: load.loadMs,
            completed: results.length, total: rows.length,
            semanticCoreAccepted: results.filter(row => row.semanticCoreAccepted).length,
            qualityPassed: results.filter(row => row.qualityPassed).length,
            trainingEligible: 0,
            policy: 'INDEPENDENT_CRITIC_MAY_REJECT_NEVER_ACCEPT_WITHOUT_HUMAN_GATE', results };
        atomicWrite(outputPath, report);
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } finally { await host.stopAndWait(); }
}

if (require.main === module) main().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });

module.exports = { ISSUE_CODES, promptFor, parseQuality };
