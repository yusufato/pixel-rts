'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createLlmHostClient } = require('./story-dialogue-llm-host-client');
const { createRuntime } = require('./story-sim-harness');

const ROOT = path.resolve(__dirname, '..');
const MODEL_FILE = 'Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf';
const MODEL_PATH = path.join(ROOT, 'models', MODEL_FILE);
const ELECTRON_NODE_PATH = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const OUTPUT_PATH = path.join(ROOT, 'qa-runtime', 'story-conversation-semantic-teacher-smoke.json');
const MANIFEST_PATH = path.join(ROOT, 'qa-runtime', 'story-conversation-semantic-teacher-manifest.json');
const JUDGE_SYSTEM = 'Türkçe oyuncu sözünü yanıtlamadan kapalı semantik alanlara ayıran kör bir yorumlayıcısın.';
const GENERATOR_SYSTEM = 'Verilen soyut anlam bileşimini doğal, kısa ve özgün bir Türkçe oyuncu sözüne dönüştürürsün.';

const BASE_TARGETS = Object.freeze([
    { communicativeFunction: 'ASK', predicate: 'RELATIONSHIP', target: 'LISTENER',
        surfaceForm: 'INTERROGATIVE',
        polarity: 'POSITIVE_OR_UNMARKED', temporality: 'CURRENT_OR_UNMARKED',
        epistemicStatus: 'QUESTIONED', continuity: 'NEW_OR_UNMARKED', requestedOutcome: 'INFORMATION' },
    { communicativeFunction: 'REQUEST', predicate: 'WORK', target: 'PLAYER',
        surfaceForm: 'INTERROGATIVE',
        polarity: 'POSITIVE_OR_UNMARKED', temporality: 'FUTURE',
        epistemicStatus: 'UNMARKED', continuity: 'CONTINUATION', requestedOutcome: 'ACTION' },
    { communicativeFunction: 'CONFIDE', predicate: 'SECRET', target: 'PLAYER_AND_LISTENER',
        surfaceForm: 'IMPERATIVE',
        polarity: 'POSITIVE_OR_UNMARKED', temporality: 'CURRENT_OR_UNMARKED',
        epistemicStatus: 'UNMARKED', continuity: 'CONTINUATION', requestedOutcome: 'CONFIDENTIAL_HANDLING' },
    { communicativeFunction: 'TELL', predicate: 'EMOTION', target: 'LISTENER',
        surfaceForm: 'DECLARATIVE',
        polarity: 'NEGATIVE', temporality: 'CURRENT_OR_UNMARKED',
        epistemicStatus: 'HEARSAY', continuity: 'CONTINUATION', requestedOutcome: 'NONE' },
    { communicativeFunction: 'ASK', predicate: 'MILITARY', target: 'THIRD_PARTY',
        surfaceForm: 'INTERROGATIVE',
        polarity: 'POSITIVE_OR_UNMARKED', temporality: 'PAST',
        epistemicStatus: 'QUESTIONED', continuity: 'NEW_OR_UNMARKED', requestedOutcome: 'INFORMATION' },
    { communicativeFunction: 'OFFER', predicate: 'ECONOMY', target: 'ORGANIZATION',
        surfaceForm: 'DECLARATIVE',
        polarity: 'POSITIVE_OR_UNMARKED', temporality: 'FUTURE',
        epistemicStatus: 'UNMARKED', continuity: 'CONTINUATION', requestedOutcome: 'ACTION' },
    { communicativeFunction: 'CORRECT', predicate: 'LOCATION', target: 'PLAYER',
        surfaceForm: 'DECLARATIVE',
        polarity: 'NEGATIVE', temporality: 'PAST',
        epistemicStatus: 'CLAIMED_CERTAIN', continuity: 'CORRECTION', requestedOutcome: 'NONE' },
    { communicativeFunction: 'ASK', predicate: 'OPINION', target: 'LISTENER',
        surfaceForm: 'INTERROGATIVE',
        polarity: 'POSITIVE_OR_UNMARKED', temporality: 'CURRENT_OR_UNMARKED',
        epistemicStatus: 'QUESTIONED', continuity: 'NEW_OR_UNMARKED', requestedOutcome: 'OPINION' }
]);

const GENERATOR_SCHEMA = Object.freeze({
    type: 'object', additionalProperties: false,
    properties: { utterance: { type: 'string', minLength: 8, maxLength: 220 } },
    required: ['utterance']
});

function integerArg(name, fallback) {
    const prefix = `--${name}=`;
    const raw = process.argv.find(value => value.startsWith(prefix));
    const parsed = raw ? Number(raw.slice(prefix.length)) : fallback;
    return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : fallback;
}

function stringArg(name, fallback) {
    const prefix = `--${name}=`;
    const raw = process.argv.find(value => value.startsWith(prefix));
    return raw ? raw.slice(prefix.length) : fallback;
}

function buildManifest(count) {
    return Array.from({ length: count }, (_, index) => ({
        id: `semantic-teacher:${String(index + 1).padStart(4, '0')}`,
        seed: 492000 + index,
        target: Object.assign({}, BASE_TARGETS[index % BASE_TARGETS.length]),
        variation: Math.floor(index / BASE_TARGETS.length),
        constraints: [
            'Tek veya iki kısa cümle', 'Doğal modern Türkçe', 'Alan adlarını metinde açıklama',
            'Hedef anlamı açık dilsel kanıtla taşı', 'Hazır örnek cümleyi kopyalama'
        ]
    }));
}

function generatorPrompt(row) {
    return `Aşağıdaki SEMANTIC_TARGET için doğal bir oyuncu sözü üret.\n`
        + `SEMANTIC_TARGET=${JSON.stringify(row.target)}\n`
        + `VARYASYON=${row.variation}\n`
        + `ALANLARIN TÜRKÇE ANLAMI:\n`
        + `- ASK doğrudan bilgi sorusu; REQUEST karşıdakinden eylem isteme; TELL bildirme; OFFER karşılıklı teklif; CONFIDE gizli paylaşım; CORRECT önceki bilgiyi düzeltme.\n`
        + `- surfaceForm yalnız cümlenin biçimidir. INTERROGATIVE soru biçimi olabilir; ama “yapabilir misin?” gibi bir sözün communicativeFunction değeri REQUEST kalır.\n`
        + `- RELATIONSHIP güven/tavır/aranızdaki bağ; WORK iş/görev/sorumluluk; SECRET gizlilik; EMOTION duygu; MILITARY askerî konu; ECONOMY ekonomik konu; LOCATION konum; OPINION görüş.\n`
        + `- PLAYER söz söyleyen oyuncu; LISTENER muhatap karakter; PLAYER_AND_LISTENER ikisi; THIRD_PARTY üçüncü kişi; ORGANIZATION kurum.\n`
        + `- PAST geçmiş; FUTURE gelecek; CURRENT_OR_UNMARKED şimdi veya açık zaman yok. QUESTIONED soru; HEARSAY duyum; HYPOTHETICAL varsayım; CLAIMED_CERTAIN kesinlik iddiası; UNMARKED işaretlenmemiş.\n`
        + `- NEW_OR_UNMARKED bağlamsız yeni başlık; CONTINUATION aynı başlığın devamı; CORRECTION düzeltme; REPAIR anlaşılmayan sözü onarma; ANSWER cevap.\n`
        + `Kurallar:\n- Yalnız JSON içindeki utterance alanını üret.\n`
        + `- Etiketleri veya İngilizce alan adlarını oyuncu sözüne yazma.\n`
        + `- Cümlede yalnız hedef communicativeFunction baskın olsun; soru hedefinde önce selamlama/bildirim, istek hedefinde önce niyet bildirimi kurma.\n`
        + `- İşlev ve konu ayrı kelime/öbeklerle açıkça kanıtlanabilsin.\n`
        + `- Hedef zaman, olumsuzluk, bilgi durumu ve muhatabı dilde açıkça belli et.\n`
        + `- Cümle doğal, modern Türkçe ve oyun içindeki bir insana söylenebilir olsun.\n`
        + `- Dünya hakkında doğrulanmamış özel isim, sayı veya olay uydurma.`;
}

function parseUtterance(raw) {
    try {
        const parsed = JSON.parse(String(raw || ''));
        if (!parsed || Object.keys(parsed).some(key => key !== 'utterance')) return null;
        const utterance = String(parsed.utterance || '').trim();
        if (utterance.length < 8 || utterance.length > 220 || /communicativeFunction|predicate/i.test(utterance)) return null;
        return utterance;
    } catch (_) { return null; }
}

function compareFrame(target, frame) {
    const fields = ['communicativeFunction', 'surfaceForm', 'predicate', 'target', 'polarity', 'temporality',
        'epistemicStatus', 'continuity', 'requestedOutcome'];
    const verifiedAxes = fields.filter(field => !!frame && frame[field] === target[field]);
    const mismatches = fields.filter(field => !frame || frame[field] !== target[field])
        .map(field => ({ field, expected: target[field], actual: frame ? frame[field] : null }));
    const requiredCore = ['communicativeFunction', 'surfaceForm', 'predicate'];
    const coreAccepted = !!frame && requiredCore.every(field => verifiedAxes.includes(field));
    return { accepted: coreAccepted, exactAccepted: !!frame && mismatches.length === 0,
        verifiedAxes, maskedAxes: mismatches.map(row => row.field), mismatches };
}

function atomicWrite(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.renameSync(temporaryPath, filePath);
}

function reportFor(host, load, results, expectedTotal, complete) {
    const axes = ['communicativeFunction', 'surfaceForm', 'predicate', 'target', 'polarity',
        'temporality', 'epistemicStatus', 'continuity', 'requestedOutcome'];
    const axisStats = Object.fromEntries(axes.map(axis => {
        const verified = results.filter(row => (row.verifiedAxes || []).includes(axis)).length;
        return [axis, { verified, total: results.length,
            rate: results.length ? Number((verified / results.length).toFixed(4)) : 0 }];
    }));
    return { schemaVersion: 2, complete: !!complete, modelFile: MODEL_FILE,
        backend: host.backend(), devices: host.backendDevices(), loadMs: load.loadMs,
        accepted: results.filter(row => row.accepted).length,
        exactAccepted: results.filter(row => row.exactAccepted).length,
        trainingEligible: results.filter(row => row.trainingEligible).length,
        completed: results.length, total: expectedTotal,
        acceptanceRate: results.length
            ? Number((results.filter(row => row.accepted).length / results.length).toFixed(4)) : 0,
        axisStats, policy: 'TARGET_GENERATOR_PLUS_BLIND_RELABEL_AXIS_MASKED_CORE_MATCH',
        results: results.slice().sort((a, b) => a.id.localeCompare(b.id, 'en')) };
}

async function runTeacher(rows, outputPath, previousResults) {
    const runtime = createRuntime(49200);
    const host = createLlmHostClient({ root: ROOT, modelPath: MODEL_PATH, contextSize: 8192,
        electronNodePath: ELECTRON_NODE_PATH, requireDiscreteGpu: true, loadTimeoutMs: 120000,
        generationTimeoutMs: 180000 });
    try {
        runtime.api.newCampaign({ seed: 49200, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const load = await host.load();
        const allowedIds = new Set(rows.map(row => row.id));
        const results = (previousResults || []).filter(row => row && allowedIds.has(row.id));
        const completedIds = new Set(results.map(row => row.id));
        for (let index = 0; index < rows.length; index++) {
            const row = rows[index];
            if (completedIds.has(row.id)) {
                process.stderr.write(`[SF3 ${index + 1}/${rows.length}] resume-skip\n`);
                continue;
            }
            process.stderr.write(`[SF3 ${index + 1}/${rows.length}] generator\n`);
            const generated = await host.generate({ system: GENERATOR_SYSTEM, prompt: generatorPrompt(row),
                maxTokens: 120, temperature: 0.55, jsonSchema: GENERATOR_SCHEMA, seed: row.seed });
            const utterance = parseUtterance(generated.raw);
            let judged = null;
            let frame = null;
            if (utterance) {
                process.stderr.write(`[SF3 ${index + 1}/${rows.length}] blind-judge\n`);
                judged = await host.generate({ system: JUDGE_SYSTEM,
                    prompt: runtime.api.conversationSemanticFrameModelPrompt(utterance, { history: [] }),
                    maxTokens: 420, temperature: 0.1,
                    jsonSchema: runtime.api.conversationSemanticFrameModelSchema(), seed: row.seed + 100000 });
                frame = runtime.api.conversationSemanticFrameModelParse(judged.raw, utterance);
            }
            const comparison = compareFrame(row.target, frame);
            results.push({ id: row.id, target: row.target, utterance,
                accepted: comparison.accepted, exactAccepted: comparison.exactAccepted,
                trainingEligible: false, humanReviewRequired: comparison.accepted,
                verifiedAxes: comparison.verifiedAxes, maskedAxes: comparison.maskedAxes,
                mismatches: comparison.mismatches,
                evidenceSpans: frame && frame.evidence && frame.evidence.modelSpans || [],
                generatedMs: generated.totalMs, judgedMs: judged && judged.totalMs || null,
                generatorRaw: generated.raw, judgeRaw: judged && judged.raw || null });
            atomicWrite(outputPath, reportFor(host, load, results, rows.length, false));
        }
        return reportFor(host, load, results, rows.length, results.length === rows.length);
    } finally {
        await host.stopAndWait();
        runtime.dom.window.close();
    }
}

async function main() {
    const count = integerArg('count', process.argv.includes('--smoke') ? 2 : 60);
    const outputPath = path.resolve(ROOT, stringArg('output', path.relative(ROOT, OUTPUT_PATH)));
    const manifest = { schemaVersion: 1, count, targets: buildManifest(count) };
    atomicWrite(MANIFEST_PATH, manifest);
    if (!process.argv.includes('--smoke') && !process.argv.includes('--run')) {
        process.stdout.write(`${JSON.stringify({ ok: true, mode: 'plan', manifestPath: MANIFEST_PATH, count }, null, 2)}\n`);
        return;
    }
    let previousResults = [];
    if (process.argv.includes('--resume') && fs.existsSync(outputPath)) {
        try { previousResults = JSON.parse(fs.readFileSync(outputPath, 'utf8')).results || []; } catch (_) { previousResults = []; }
    }
    const report = await runTeacher(manifest.targets, outputPath, previousResults);
    atomicWrite(outputPath, report);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.accepted !== report.total) process.exitCode = 2;
}

if (require.main === module) main().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });

module.exports = { BASE_TARGETS, buildManifest, generatorPrompt, parseUtterance, compareFrame, reportFor };
