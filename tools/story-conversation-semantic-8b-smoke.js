'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { createLlmHostClient } = require('./story-dialogue-llm-host-client');
const { createRuntime } = require('./story-sim-harness');

const ROOT = path.resolve(__dirname, '..');
const teacher14b = process.argv.includes('--teacher14b');
const modelLabel = teacher14b ? 'QWEN_CODER_14B_TEACHER' : 'TURKISH_LLAMA_8B';
const modelFile = teacher14b
    ? 'Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf'
    : 'Turkish-Llama-8b-Instruct-v0.1.Q4_K_M.gguf';
const modelPath = path.join(ROOT, 'models', modelFile);
const outputFile = teacher14b
    ? 'story-conversation-semantic-14b-smoke.json'
    : 'story-conversation-semantic-8b-smoke.json';
const electronNodePath = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const SYSTEM = 'Türkçe oyuncu sözünü yanıtlamadan kapalı semantik alanlara ayıran bir yorumlayıcısın.';
const probes = [
    { text: 'Bana karşı öfke taşıdığınızı seziyorum.', expected: ['SMALL_TALK'] },
    { text: 'Benden yana tavrınız neden bu kadar sert?', expected: ['ASK_RELATIONSHIP'] },
    { text: 'Yarın için üzerime düşen bir sorumluluk bulunuyor mu?', expected: ['REQUEST_ACTION', 'ASK_INFORMATION'] },
    { text: 'Aramızdaki meseleyi kimse duymasın.', expected: ['SHARE_SECRET'] }
];

async function main() {
    const runtime = createRuntime(38104);
    const host = createLlmHostClient({ root: ROOT, modelPath, contextSize: 8192,
        electronNodePath, requireDiscreteGpu: true, loadTimeoutMs: 90000 });
    try {
        runtime.api.newCampaign({ seed: 38104, playerStateId: 0, abundance: 1,
            doctrine: 'combined', fog: true });
        const load = await host.load();
        const rows = [];
        for (let index = 0; index < probes.length; index++) {
            const probe = probes[index];
            const prompt = runtime.api.conversationSemanticFrameModelPrompt(probe.text, { history: [] });
            const schema = runtime.api.conversationSemanticFrameModelSchema();
            const inputTokens = await host.count(`${SYSTEM}\n${prompt}`);
            const generated = await host.generate({ system: SYSTEM, prompt,
                maxTokens: 420, temperature: 0.1, jsonSchema: schema, seed: 381040 + index });
            const frame = runtime.api.conversationSemanticFrameModelParse(generated.raw, probe.text);
            rows.push({ text: probe.text, expected: probe.expected,
                accepted: !!frame, actual: frame && frame.suggestedSpeechAct || null,
                matched: !!frame && probe.expected.includes(frame.suggestedSpeechAct),
                source: frame && frame.source || null,
                evidenceSpans: frame && frame.evidence && frame.evidence.modelSpans || [],
                inputTokens, firstTokenMs: generated.firstTokenMs,
                totalMs: generated.totalMs, generatedTokens: generated.generatedTokens,
                raw: generated.raw });
        }
        const report = { ok: rows.every(row => row.matched), modelLabel, modelFile,
            backend: host.backend(),
            devices: host.backendDevices(), loadMs: load.loadMs,
            matched: rows.filter(row => row.matched).length, total: rows.length, rows };
        const outputPath = path.join(ROOT, 'qa-runtime', outputFile);
        const temporaryPath = `${outputPath}.tmp`;
        fs.writeFileSync(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
        fs.renameSync(temporaryPath, outputPath);
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        if (!report.ok) process.exitCode = 2;
    } finally {
        await host.stopAndWait();
        runtime.dom.window.close();
    }
}

main().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
