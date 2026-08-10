'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');
const {
    createRuntime,
    stateSnapshot,
    hashSnapshot
} = require('./story-sim-harness');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_MODEL = path.join(ROOT, 'models', 'Turkish-Llama-8b-Instruct-v0.1.Q4_K_M.gguf');
const MODEL_ARG = process.argv.find(arg => arg.startsWith('--model='));
const OUTPUT_ARG = process.argv.find(arg => arg.startsWith('--output='));
const CONTEXT_ARG = process.argv.find(arg => arg.startsWith('--context='));
const modelPath = path.resolve(MODEL_ARG ? MODEL_ARG.slice(8) : DEFAULT_MODEL);
const outputPath = path.resolve(OUTPUT_ARG
    ? OUTPUT_ARG.slice(9)
    : path.join(ROOT, 'qa-runtime', 'story-character-arbiter-benchmark.json'));
const quick = process.argv.includes('--quick');
const gate = process.argv.includes('--gate');
const contextSize = Math.max(512, Number(CONTEXT_ARG ? CONTEXT_ARG.slice(10) : 1024) || 1024);
const REQUIRED_ACCEPT_RATE = 0.8;
const CASES = quick ? [
    { seed: 2032, role: 'COMMANDER' },
    { seed: 2033, role: 'COMPANY_EXECUTIVE' }
] : [
    { seed: 2032, role: 'COMMANDER' },
    { seed: 2033, role: 'AGENT' },
    { seed: 2034, role: 'POLITICAL_FIGURE' },
    { seed: 2035, role: 'EXECUTIVE' },
    { seed: 2036, role: 'COMPANY_EXECUTIVE' }
];

if (!fs.existsSync(modelPath)) {
    console.error(`Model bulunamadı: ${modelPath}`);
    process.exit(1);
}

function round(value, digits = 2) {
    const scale = 10 ** digits;
    return Math.round(Number(value) * scale) / scale;
}

function createFixture(seed, role) {
    const runtime = createRuntime(seed >>> 0);
    runtime.api.newCampaign({
        seed,
        playerStateId: 0,
        abundance: 1,
        doctrine: 'combined',
        fog: true
    });
    const story = runtime.api.state();
    const playerActorId = story.commander ? `character:0:${story.commander.id}` : null;
    const identities = runtime.api.characterIdentityLedger().identities || {};
    const actors = Object.values(identities)
        .filter(actor => actor.id !== playerActorId)
        .sort((left, right) => left.id.localeCompare(right.id, 'en'));
    const viable = [];
    for (const candidate of actors) {
        if (candidate.role !== role) continue;
        const candidateRanked = runtime.api.characterActionAIRankActor(candidate.id);
        if (!candidateRanked.length) continue;
        viable.push({ actor: candidate, ranked: candidateRanked });
    }
    if (!viable.length) {
        runtime.dom.window.close();
        throw new Error(`Tohum ${seed}, rol ${role} için hakem adayı bulunamadı.`);
    }
    const selectedFixture = viable[seed % viable.length];
    const actor = selectedFixture.actor;
    const ranked = selectedFixture.ranked;
    const request = runtime.api.characterArbiterBuildRequest(actor.id, { ranked });
    if (!request.ok) {
        runtime.dom.window.close();
        throw new Error(`Tohum ${seed} için hakem isteği kurulamadı: ${request.reason}`);
    }
    const worldHash = () => hashSnapshot(stateSnapshot(runtime.api.state()));
    const beforeHash = worldHash();
    return {
        seed,
        role,
        actorId: actor.id,
        actorName: actor.name,
        candidateCount: request.context.candidates.length,
        selectorTopScore: Number(ranked[0] && ranked[0].score) || 0,
        request,
        system: runtime.api.characterArbiterSystem(),
        prompt: runtime.api.characterArbiterPrompt(request),
        jsonSchema: runtime.api.characterArbiterJsonSchema(request),
        validate: raw => runtime.api.characterArbiterValidate(request, raw),
        resolve: raw => runtime.api.characterArbiterResolve(request, raw),
        worldHash,
        beforeHash,
        close: () => runtime.dom.window.close()
    };
}

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

child.on('message', message => {
    if (!message) return;
    if (message.t === 'backend') {
        backend = message.gpu || 'cpu';
        return;
    }
    if (message.t === 'chunk') {
        const item = pending.get(message.id);
        if (item && item.firstTokenMs == null) {
            item.firstTokenMs = performance.now() - item.startedAt;
        }
        return;
    }
    if (message.t !== 'gen') return;
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
            } else if (message.t === 'loaded') {
                clearTimeout(timer);
                child.off('message', handler);
                resolve({
                    loadMs: performance.now() - startedAt,
                    loadedModel: message.modelPath
                });
            }
        };
        child.on('message', handler);
        child.send({
            t: 'load',
            modelPath,
            gpuLayers: 'auto',
            contextSize
        });
    });
}

function generate(system, prompt, jsonSchema, seed) {
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
            maxTokens: 110,
            temperature: 0.4,
            metrics: true,
            jsonSchema,
            seed
        });
    });
}

async function main() {
    const stat = fs.statSync(modelPath);
    const load = await waitForLoad();
    const results = [];
    for (const benchmarkCase of CASES) {
        const seed = benchmarkCase.seed;
        const fixture = createFixture(seed, benchmarkCase.role);
        try {
            let generated = null;
            let generationError = null;
            try {
                generated = await generate(
                    fixture.system, fixture.prompt, fixture.jsonSchema, 38000 + seed
                );
            } catch (error) {
                generationError = String(error && error.message || error);
            }
            const raw = generated ? generated.text : '';
            const validation = fixture.validate(raw);
            const resolution = fixture.resolve(raw);
            const afterHash = fixture.worldHash();
            const top = fixture.request.context.candidates[0] || null;
            const selected = resolution.output && resolution.output.verdict === 'PROPOSE'
                ? fixture.request.context.candidates.find(row => (
                    row.choiceId === resolution.output.choiceId
                )) : null;
            const scoreRegret = selected && top
                ? Math.max(0, Number(top.score) - Number(selected.score)) : null;
            const expectedPass = !top;
            const semanticAligned = validation.ok && (
                (resolution.output && resolution.output.verdict === 'PASS' && expectedPass)
                || (resolution.output && resolution.output.verdict === 'PROPOSE'
                    && !expectedPass && scoreRegret != null && scoreRegret <= 3)
            );
            results.push({
                seed,
                role: fixture.role,
                actorId: fixture.actorId,
                actorName: fixture.actorName,
                requestId: fixture.request.requestId,
                candidateCount: fixture.candidateCount,
                systemChars: fixture.system.length,
                promptChars: fixture.prompt.length,
                contextSize,
                generationError,
                accepted: validation.ok,
                issues: validation.issues,
                source: resolution.source,
                rejectedReason: resolution.rejectedReason,
                selectorTopScore: fixture.selectorTopScore,
                topChoiceId: top && top.choiceId || null,
                topActionType: top && top.actionType || null,
                topScore: top && top.score || null,
                expectedPass,
                selectedChoiceId: selected && selected.choiceId || null,
                selectedActionType: selected && selected.actionType || null,
                selectedScore: selected && selected.score || null,
                scoreRegret: scoreRegret == null ? null : round(scoreRegret, 3),
                nearTop: semanticAligned,
                worldNeutral: fixture.beforeHash === afterHash,
                beforeHash: fixture.beforeHash,
                afterHash,
                firstTokenMs: generated ? round(generated.firstTokenMs) : null,
                totalMs: generated ? round(generated.totalMs) : null,
                generatedTokens: generated ? generated.generatedTokens : 0,
                tokensPerSecond: generated && generated.generatedTokens
                    ? round(generated.generatedTokens / (generated.totalMs / 1000))
                    : null,
                rssMb: generated && generated.memory ? round(generated.memory.rss / 1048576) : null,
                output: raw
            });
        } finally {
            fixture.close();
        }
    }

    const completed = results.filter(row => Number.isFinite(row.totalMs));
    const accepted = results.filter(row => row.accepted).length;
    const nearTop = results.filter(row => row.nearTop).length;
    const distinctChoices = new Set(results.map(row => row.selectedChoiceId).filter(Boolean)).size;
    const requiredChoiceDiversity = quick ? 1 : 2;
    const report = {
        schemaVersion: 1,
        benchmarkVersion: 'story-character-arbiter-production-v2',
        createdAt: new Date().toISOString(),
        quick,
        productionParity: {
            contextSize,
            maxTokens: 110,
            temperature: 0.4,
            gpuLayers: 'auto',
            validator: 'StoryCharacterArbiter.storyCharacterArbiterValidate',
            jsonSchemaGrammar: true
        },
        model: {
            path: modelPath,
            file: path.basename(modelPath),
            bytes: stat.size,
            modifiedAt: stat.mtime.toISOString()
        },
        runtime: {
            backend,
            loadMs: round(load.loadMs),
            node: process.version,
            platform: `${process.platform}-${process.arch}`,
            cpu: os.cpus()[0] ? os.cpus()[0].model : 'unknown',
            logicalCpuCount: os.cpus().length,
            totalMemoryGb: round(os.totalmem() / 1073741824)
        },
        summary: {
            accepted,
            total: results.length,
            acceptRate: round(accepted / Math.max(1, results.length), 4),
            fallbackCount: results.filter(row => row.source === 'DETERMINISTIC_FALLBACK').length,
            generationErrorCount: results.filter(row => row.generationError).length,
            worldNeutralCount: results.filter(row => row.worldNeutral).length,
            nearTopCount: nearTop,
            nearTopRate: round(nearTop / Math.max(1, results.length), 4),
            distinctChoices,
            requiredChoiceDiversity,
            averageFirstTokenMs: completed.length
                ? round(completed.reduce((sum, row) => sum + (row.firstTokenMs || 0), 0) / completed.length)
                : null,
            averageTotalMs: completed.length
                ? round(completed.reduce((sum, row) => sum + row.totalMs, 0) / completed.length)
                : null,
            requiredAcceptRate: REQUIRED_ACCEPT_RATE,
            gatePassed: accepted / Math.max(1, results.length) >= REQUIRED_ACCEPT_RATE
                && nearTop / Math.max(1, results.length) >= REQUIRED_ACCEPT_RATE
                && distinctChoices >= requiredChoiceDiversity
                && results.every(row => row.worldNeutral)
        },
        results
    };

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`Karakter hakemi benchmark raporu yazıldı: ${outputPath}`);
    console.log(JSON.stringify(report.summary, null, 2));
    if (gate && !report.summary.gatePassed) process.exitCode = 2;
    stopChild();
}

child.once('error', error => {
    stopChild();
    console.error(error && error.stack || error);
    process.exitCode = 1;
});

main().catch(error => {
    stopChild();
    console.error(error && error.stack || error);
    process.exitCode = 1;
});
