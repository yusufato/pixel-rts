'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_MODEL = path.join(ROOT, 'models', 'Turkish-Llama-8b-Instruct-v0.1.Q4_K_M.gguf');
const MODEL_ARG = process.argv.find(arg => arg.startsWith('--model='));
const OUTPUT_ARG = process.argv.find(arg => arg.startsWith('--output='));
const modelPath = path.resolve(MODEL_ARG ? MODEL_ARG.slice(8) : DEFAULT_MODEL);
const outputPath = path.resolve(
    OUTPUT_ARG ? OUTPUT_ARG.slice(9) : path.join(ROOT, 'qa-runtime', 'story-llm-benchmark.json')
);
const quick = process.argv.includes('--quick');
const gate = process.argv.includes('--gate');
const REQUIRED_PASS_RATE = 0.8;

if (!fs.existsSync(modelPath)) {
    console.error(`Model bulunamadı: ${modelPath}`);
    process.exit(1);
}

function round(value, digits = 2) {
    const scale = 10 ** digits;
    return Math.round(Number(value) * scale) / scale;
}

function extractJson(text) {
    const raw = String(text || '').replace(/```(?:json)?/gi, '').replace(/```/g, '');
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try { return JSON.parse(raw.slice(start, end + 1)); } catch (_) { return null; }
}

function parseStrictJson(text) {
    const raw = String(text || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    try {
        const value = JSON.parse(raw);
        return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    } catch (_) {
        return null;
    }
}

function normalizedWords(text) {
    return String(text || '').toLocaleLowerCase('tr-TR')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/).filter(Boolean);
}

function jaccard(a, b) {
    const aa = new Set(normalizedWords(a));
    const bb = new Set(normalizedWords(b));
    const union = new Set([...aa, ...bb]);
    if (!union.size) return 1;
    let intersection = 0;
    for (const word of aa) if (bb.has(word)) intersection++;
    return intersection / union.size;
}

const fixtures = [
    {
        id: 'intent_entity_tr',
        system: 'Türkçe oyun niyeti ayrıştırıcısısın. Yalnız geçerli JSON yaz; açıklama yazma.',
        prompt: 'Oyuncu yazdı: "ben bi celik sirketi kurcam, ingiltereden gelen celikleri de bizim Ankara depoya yonlendirsek olurmu?"\n'
            + 'Şema: {"intent":"...","sector":"...","sourceCountry":"...","targetCity":"...","asksPermission":true}',
        maxTokens: 90,
        validate(text) {
            const value = parseStrictJson(text);
            const joined = JSON.stringify(value || {}).toLocaleLowerCase('tr-TR');
            return {
                pass: !!value && /şirket|company|kur/.test(joined)
                    && /çelik|celik|steel/.test(joined)
                    && /ingiltere|brit/.test(joined)
                    && /ankara/.test(joined),
                parsed: value
            };
        }
    },
    {
        id: 'memory_fact_binding',
        system: 'Verilen gerçekleri değiştirme. Yalnız geçerli JSON yaz.',
        prompt: 'Bilinenler: Şirket=Bozkır Çelik; sipariş=240 ton; çıkış=Liverpool; varış=Ankara; teslim=18 Eylül; sigortacı=Atlas.\n'
            + 'Şema: {"company":"...","amountTons":0,"origin":"...","destination":"...","delivery":"...","insurer":"..."}',
        maxTokens: 90,
        validate(text) {
            const value = parseStrictJson(text);
            const joined = JSON.stringify(value || {}).toLocaleLowerCase('tr-TR');
            return {
                pass: !!value && joined.includes('bozkır') && joined.includes('240')
                    && joined.includes('liverpool') && joined.includes('ankara')
                    && joined.includes('18') && joined.includes('atlas'),
                parsed: value
            };
        }
    },
    {
        id: 'candidate_action_constraint',
        system: 'Dünya değerlerini değiştiremezsin. Yalnız verilen actionId değerlerinden birini seç ve geçerli JSON yaz.',
        prompt: 'Amaç: çelik sevkiyatını Ankara deposuna almak. Kısıt: savaş ilan edilemez, bütçe 80, A3 maliyeti 120.\n'
            + 'Adaylar: A1=nakliyeciyle rota değiştir(maliyet 40); A2=hiçbir şey yapma(maliyet 0); A3=limanı satın al(maliyet 120).\n'
            + 'Şema: {"selectedActionId":"A1|A2|A3","reason":"kısa"}',
        maxTokens: 70,
        validate(text) {
            const value = parseStrictJson(text);
            return { pass: !!value && value.selectedActionId === 'A1', parsed: value };
        }
    },
    {
        id: 'character_voice',
        system: 'Yalnız Türkçe yaz. İki karakter farklı kişiliğe sahip olsun. Tam dört replik; her satır "Ad: söz" biçiminde.',
        prompt: 'Karakterler: Selim Paşa=resmî, kuşkucu, kısa konuşur. Derya Hanım=tüccar, pragmatik, pazarlıkçı.\n'
            + 'Konu: 240 ton çeliğin Ankara deposuna yönlendirilmesi. Selim güvence istiyor; Derya bedel istiyor.',
        maxTokens: 120,
        validate(text) {
            const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
            const selim = lines.filter(line => /^Selim/i.test(line));
            const derya = lines.filter(line => /^Derya/i.test(line));
            return {
                pass: lines.length >= 4 && selim.length >= 1 && derya.length >= 1
                    && new Set(lines.map(line => line.toLocaleLowerCase('tr-TR'))).size === lines.length,
                lines
            };
        }
    }
];

const repetitionFixture = {
    system: 'Yalnız Türkçe yaz. Tek cümleyle cevap ver; karakterin önceki sözlerini aynen tekrar etme.',
    prompts: [
        'Derya Hanım, oyuncunun çelik rotası teklifini ilk kez duyuyor. Temkinli ama pazarlığa açık cevap ver.',
        'Derya Hanım, aynı teklif için sigorta güvencesini öğrendi. Önceki cevabı tekrarlamadan yeni koşul söyle.',
        'Derya Hanım, navlun bedelinin yarısının ödendiğini öğrendi. Öncekileri tekrarlamadan karar eşiğini söyle.'
    ]
};

const child = fork(path.join(ROOT, 'electron', 'llm-host.js'), [], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit', 'ipc']
});

let backend = 'unknown';
let nextId = 0;
const pending = new Map();

function stopChild() {
    try { child.send({ t: 'stop' }); } catch (_) {}
}

function fail(error) {
    stopChild();
    console.error(error && error.stack || error);
    process.exitCode = 1;
}

child.on('message', message => {
    if (!message) return;
    if (message.t === 'backend') {
        backend = message.gpu || 'cpu';
        return;
    }
    if (message.t === 'chunk') {
        const item = pending.get(message.id);
        if (item && item.firstTokenMs == null) item.firstTokenMs = performance.now() - item.startedAt;
        return;
    }
    if (message.t === 'gen') {
        const item = pending.get(message.id);
        if (!item) return;
        pending.delete(message.id);
        clearTimeout(item.timer);
        if (message.error) item.reject(new Error(message.error));
        else item.resolve({
            text: String(message.text || ''),
            generatedTokens: Number(message.generatedTokens) || 0,
            memory: message.memory || null,
            firstTokenMs: item.firstTokenMs,
            totalMs: performance.now() - item.startedAt
        });
    }
});

function waitForLoad() {
    const startedAt = performance.now();
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Model 180 saniyede yüklenmedi.')), 180000);
        const handler = message => {
            if (!message) return;
            if (message.t === 'error') {
                clearTimeout(timer);
                child.off('message', handler);
                reject(new Error(message.error));
            }
            if (message.t === 'loaded') {
                clearTimeout(timer);
                child.off('message', handler);
                resolve({ loadMs: performance.now() - startedAt, loadedModel: message.modelPath });
            }
        };
        child.on('message', handler);
        child.send({ t: 'load', modelPath, gpuLayers: 'auto', contextSize: quick ? 1024 : 2048 });
    });
}

function generate(system, prompt, maxTokens, temperature = 0.25) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
        const item = {
            startedAt: performance.now(),
            firstTokenMs: null,
            resolve,
            reject,
            timer: setTimeout(() => {
                pending.delete(id);
                reject(new Error(`İstek ${id} 180 saniyede tamamlanmadı.`));
            }, 180000)
        };
        pending.set(id, item);
        child.send({
            t: 'gen',
            id,
            system,
            prompt,
            maxTokens,
            temperature,
            metrics: true,
            seed: 31000 + id
        });
    });
}

async function main() {
    const stat = fs.statSync(modelPath);
    const load = await waitForLoad();
    const results = [];
    for (const fixture of fixtures) {
        const generated = await generate(
            fixture.system,
            fixture.prompt,
            quick ? Math.min(60, fixture.maxTokens) : fixture.maxTokens
        );
        const validation = fixture.validate(generated.text);
        results.push({
            id: fixture.id,
            pass: !!validation.pass,
            firstTokenMs: round(generated.firstTokenMs),
            totalMs: round(generated.totalMs),
            generatedTokens: generated.generatedTokens,
            tokensPerSecond: generated.generatedTokens
                ? round(generated.generatedTokens / (generated.totalMs / 1000))
                : null,
            rssMb: generated.memory ? round(generated.memory.rss / 1048576) : null,
            output: generated.text,
            validation
        });
    }

    const repetitionOutputs = [];
    for (const prompt of repetitionFixture.prompts.slice(0, quick ? 2 : 3)) {
        repetitionOutputs.push(await generate(repetitionFixture.system, prompt, quick ? 55 : 80, 0.55));
    }
    let maxSimilarity = 0;
    for (let i = 0; i < repetitionOutputs.length; i++) {
        for (let j = i + 1; j < repetitionOutputs.length; j++) {
            maxSimilarity = Math.max(maxSimilarity, jaccard(repetitionOutputs[i].text, repetitionOutputs[j].text));
        }
    }
    const unsupportedNumbers = repetitionOutputs.flatMap(item => String(item.text || '').match(/\d+(?:[.,]\d+)?/g) || []);
    results.push({
        id: 'dialog_repetition',
        pass: maxSimilarity < 0.72 && unsupportedNumbers.length === 0,
        maxWordJaccard: round(maxSimilarity, 4),
        unsupportedNumbers,
        outputs: repetitionOutputs.map(item => item.text),
        firstTokenMs: round(repetitionOutputs.reduce((sum, item) => sum + item.firstTokenMs, 0) / repetitionOutputs.length),
        totalMs: round(repetitionOutputs.reduce((sum, item) => sum + item.totalMs, 0)),
        generatedTokens: repetitionOutputs.reduce((sum, item) => sum + item.generatedTokens, 0)
    });

    const latencyRows = results.filter(row => Number.isFinite(row.totalMs));
    const report = {
        schemaVersion: 1,
        benchmarkVersion: 'story-llm-phase3.1-v1',
        createdAt: new Date().toISOString(),
        quick,
        model: {
            path: modelPath,
            file: path.basename(modelPath),
            bytes: stat.size,
            modifiedAt: stat.mtime.toISOString()
        },
        runtime: {
            backend,
            contextSize: quick ? 1024 : 2048,
            loadMs: round(load.loadMs),
            node: process.version,
            platform: `${process.platform}-${process.arch}`,
            cpu: os.cpus()[0] ? os.cpus()[0].model : 'unknown',
            logicalCpuCount: os.cpus().length,
            totalMemoryGb: round(os.totalmem() / 1073741824)
        },
        summary: {
            passed: results.filter(row => row.pass).length,
            total: results.length,
            passRate: round(results.filter(row => row.pass).length / results.length, 4),
            averageFirstTokenMs: round(
                latencyRows.reduce((sum, row) => sum + (row.firstTokenMs || 0), 0) / Math.max(1, latencyRows.length)
            ),
            averageTotalMs: round(
                latencyRows.reduce((sum, row) => sum + row.totalMs, 0) / Math.max(1, latencyRows.length)
            ),
            requiredPassRate: REQUIRED_PASS_RATE,
            gatePassed: results.filter(row => row.pass).length / results.length >= REQUIRED_PASS_RATE
        },
        results
    };
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`Hikâye LLM benchmark raporu yazıldı: ${outputPath}`);
    console.log(JSON.stringify(report.summary, null, 2));
    if (gate && !report.summary.gatePassed) process.exitCode = 2;
    stopChild();
}

child.once('error', fail);
main().catch(fail);
