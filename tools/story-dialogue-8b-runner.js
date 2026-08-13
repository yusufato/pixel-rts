'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { fork } = require('node:child_process');
const { createRuntime } = require('./story-sim-harness');
const { groupCases } = require('./story-dialogue-current-replay');
const { buildManifest } = require('./story-dialogue-8b-manifest');

const ROOT = path.resolve(__dirname, '..');
const corpusPath = path.join(ROOT, 'qa-runtime', 'story-dialogue-corpus-s0.json');
const outputArg = process.argv.find(row => row.startsWith('--output='));
const outputPath = path.resolve(outputArg ? outputArg.slice(9)
    : path.join(ROOT, 'qa-runtime', 'story-dialogue-8b-runner.json'));
const checkpointPath = outputPath.replace(/\.json$/i, '.partial.json');
const smoke = process.argv.includes('--smoke');
const battery = process.argv.includes('--battery');
const requestedTurns = Number((process.argv.find(row => row.startsWith('--turns=')) || '').slice(8));
const turnLimit = Number.isFinite(requestedTurns) && requestedTurns > 0
    ? Math.floor(requestedTurns) : smoke ? 3 : 80;
const modelPath = path.join(ROOT, 'models', 'Turkish-Llama-8b-Instruct-v0.1.Q4_K_M.gguf');
const electronNodePath = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const SYSTEM = 'Modern bir strateji oyunundaki karakter olarak Türkçe konuş. Yalnız verilen bağlamı kullan.';
const validatorFingerprint = hash(fs.readFileSync(
    path.join(ROOT, 'js', 'StoryConversationUnderstanding.js'), 'utf8'));

function hash(value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    let state = 2166136261;
    for (let index = 0; index < text.length; index++) {
        state ^= text.charCodeAt(index); state = Math.imul(state, 16777619) >>> 0;
    }
    return (`00000000${state.toString(16)}`).slice(-8);
}

function lengthClass(turnCount) {
    return turnCount <= 4 ? 'SHORT' : turnCount <= 7 ? 'MEDIUM' : 'LONG';
}

if (!fs.existsSync(modelPath)) throw new Error(`Model bulunamadı: ${modelPath}`);

function round(value, digits = 2) {
    const scale = 10 ** digits;
    return Math.round(Number(value) * scale) / scale;
}

function percentile(rows, p) {
    const values = rows.filter(Number.isFinite).sort((a, b) => a - b);
    if (!values.length) return null;
    return round(values[Math.min(values.length - 1, Math.floor((values.length - 1) * p))]);
}

function writeJsonAtomic(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.renameSync(temporary, filePath);
}

function summarizeTurns(turns) {
    return {
        turns: turns.length, modelEligible: turns.filter(row => row.modelEligible).length,
        accepted: turns.filter(row => row.accepted === true).length,
        fallback: turns.filter(row => row.accepted === false).length,
        notRequired: turns.filter(row => row.disposition === 'NOT_REQUIRED').length,
        errors: turns.filter(row => row.error).length,
        contextOverflows: turns.filter(row => row.contextWithinLimit === false).length,
        rejectionCodes: turns.filter(row => row.accepted === false).reduce((acc, row) => {
            const key = row.validationCode || 'UNKNOWN'; acc[key] = (acc[key] || 0) + 1; return acc;
        }, {}),
        qualityTags: turns.flatMap(row => row.qualityTags || []).reduce((acc, tag) => {
            acc[tag] = (acc[tag] || 0) + 1; return acc;
        }, {}),
        lengthClasses: turns.reduce((acc, row) => {
            const key = row.conversationLengthClass || 'UNKNOWN';
            acc[key] = (acc[key] || 0) + 1; return acc;
        }, {}),
        p50TotalMs: percentile(turns.map(row => row.totalMs), 0.5),
        p95TotalMs: percentile(turns.map(row => row.totalMs), 0.95),
        p50FirstTokenMs: percentile(turns.map(row => row.firstTokenMs), 0.5),
        p95FirstTokenMs: percentile(turns.map(row => row.firstTokenMs), 0.95)
    };
}

function runnerHost() {
    const useElectronRuntime = fs.existsSync(electronNodePath);
    const child = fork(path.join(ROOT, 'electron', 'llm-host.js'), [], {
        cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
        execPath: useElectronRuntime ? electronNodePath : process.execPath,
        env: Object.assign({}, process.env,
            useElectronRuntime ? { ELECTRON_RUN_AS_NODE: '1' } : {})
    });
    let sequence = 0;
    let backend = 'unknown';
    let backendDiagnostics = [];
    let stopped = false;
    const pending = new Map();
    const rejectPending = error => {
        for (const item of pending.values()) {
            clearTimeout(item.timer); item.reject(error);
        }
        pending.clear();
    };
    child.on('message', message => {
        if (!message) return;
        if (message.t === 'backend') {
            backend = message.gpu || 'cpu';
            backendDiagnostics = Array.isArray(message.diagnostics) ? message.diagnostics : [];
            return;
        }
        if (message.t === 'chunk') {
            const item = pending.get(message.id);
            if (item && item.firstTokenMs == null) item.firstTokenMs = performance.now() - item.started;
            return;
        }
        if (!['gen', 'count'].includes(message.t)) return;
        const item = pending.get(message.id);
        if (!item) return;
        pending.delete(message.id); clearTimeout(item.timer);
        if (item.firstTokenMs != null) message.firstTokenMs = item.firstTokenMs;
        if (message.error) item.reject(new Error(message.error));
        else item.resolve(message);
    });
    child.on('exit', (code, signal) => {
        stopped = true;
        rejectPending(new Error(`LLM_HOST_EXIT:${code == null ? signal : code}`));
    });
    const request = payload => new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => {
            pending.delete(id); reject(new Error('LLM_TIMEOUT'));
            // node-llama-cpp yerel üretimde kilitlenirse IPC "stop" mesajını işleyemeyebilir.
            // Zorla kapat; tamamlanmış görüşmeler ara kayıttan sonraki koşuda sürdürülür.
            try { child.kill(); } catch (_) {}
        }, 90000);
        pending.set(id, { resolve, reject, timer, started: performance.now(), firstTokenMs: null });
        child.send(Object.assign({}, payload, { id }));
    });
    const load = () => new Promise((resolve, reject) => {
        const started = performance.now();
        const timer = setTimeout(() => reject(new Error('MODEL_LOAD_TIMEOUT')), 180000);
        const listener = message => {
            if (message && message.t === 'loaded') {
                clearTimeout(timer); child.off('message', listener);
                resolve({ loadMs: performance.now() - started });
            } else if (message && message.t === 'error') {
                clearTimeout(timer); child.off('message', listener); reject(new Error(message.error));
            }
        };
        child.on('message', listener);
        child.send({ t: 'load', modelPath, gpuLayers: 'auto', contextSize: 8192 });
    });
    return {
        load, backend: () => backend, backendDiagnostics: () => backendDiagnostics.slice(),
        runtime: () => useElectronRuntime ? 'electron-node' : 'system-node',
        count: async text => Number((await request({ t: 'count', text })).tokens),
        generate: async input => {
            const started = performance.now();
            const message = await request(Object.assign({ t: 'gen', metrics: true }, input));
            return { raw: String(message.text || ''), totalMs: performance.now() - started,
                firstTokenMs: Number.isFinite(message.firstTokenMs) ? message.firstTokenMs : null,
                generatedTokens: Number(message.generatedTokens) || 0, memory: message.memory || null };
        },
        stop: () => {
            if (stopped) return;
            try { child.send({ t: 'stop' }); } catch (_) {}
            const killer = setTimeout(() => { try { child.kill(); } catch (_) {} }, 1500);
            if (killer.unref) killer.unref();
        }
    };
}

async function main() {
    const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
    const batteryManifest = battery ? buildManifest() : null;
    const runtime = createRuntime(2032);
    const host = runnerHost();
    const load = await host.load();
    let turns = [];
    let resumedTurns = 0;
    try {
        runtime.api.newCampaign({ seed: 2032, playerStateId: 0, abundance: 1,
            doctrine: 'combined', fog: true });
        const directory = runtime.api.contactDirectoryBuild();
        const actors = (directory.publicCharacters || []).filter(row => row.id !== directory.playerActorId);
        const byRole = new Map();
        actors.forEach(row => { if (!byRole.has(row.role)) byRole.set(row.role, row); });
        const groups = battery
            ? batteryManifest.scenarios.map(scenario => [scenario.id, scenario.turns.map((playerText, turnIndex) => ({
                caseId: `${scenario.id}:turn:${turnIndex}`, conversationGroupId: scenario.id,
                turnIndex, playerText, listener: { role: scenario.listenerRole || 'POLITICAL_FIGURE' },
                lengthClass: scenario.lengthClass, scenarioSeed: scenario.seed
            }))])
            : groupCases(corpus.cases);
        const groupSizes = new Map(groups.map(([groupId, cases]) => [groupId, cases.length]));
        if (battery && fs.existsSync(checkpointPath)) {
            try {
                const saved = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
                if (saved && saved.schemaVersion === 2
                    && saved.batteryManifestChecksum === batteryManifest.checksum
                    && saved.model === path.basename(modelPath)
                    && saved.validatorFingerprint === validatorFingerprint
                    && Array.isArray(saved.turns)) {
                    turns = saved.turns;
                    resumedTurns = turns.length;
                }
            } catch (error) {
                process.stderr.write(`Ara kayıt okunamadı, temiz koşu başlatılıyor: ${error.message}\n`);
            }
        }
        const completedGroups = new Set();
        const savedGroupCounts = turns.reduce((acc, row) => {
            if (row && row.groupId) acc.set(row.groupId, (acc.get(row.groupId) || 0) + 1);
            return acc;
        }, new Map());
        for (const [groupId, size] of groupSizes) {
            if ((savedGroupCounts.get(groupId) || 0) >= size) completedGroups.add(groupId);
        }
        // Yarım kalmış tek bir görüşmenin satırlarını at. Aynı görüşme temiz ve deterministik
        // biçimde baştan oynatılır; tamamlanmış görüşmelere dokunulmaz.
        if (battery) turns = turns.filter(row => completedGroups.has(row.groupId));
        const buildReport = status => ({
            schemaVersion: 2, kind: 'STORY_DIALOGUE_8B_GAME_PARITY_RUN',
            runnerVersion: 'story-dialogue-8b-runner-3', createdAt: new Date().toISOString(),
            status, corpusChecksum: corpus.manifestChecksum, seed: 2032, smoke,
            requestedTurnLimit: turnLimit, batteryMode: battery,
            batteryManifestChecksum: batteryManifest && batteryManifest.checksum || null,
            model: path.basename(modelPath), backend: host.backend(),
            backendDiagnostics: host.backendDiagnostics(), hostRuntime: host.runtime(), contextSize: 8192,
            validatorFingerprint,
            loadMs: round(load.loadMs), resumedTurns,
            completedConversations: completedGroups.size,
            gameParity: { llmHost: true, contextPack: true, dialogueMove: true,
                jsonGrammar: true, productionValidator: true },
            summary: summarizeTurns(turns), turns
        });
        outer: for (const [groupId, cases] of groups) {
            if (completedGroups.has(groupId)) continue;
            const requestedListenerRole = cases[0].listener.role;
            const actor = byRole.get(requestedListenerRole);
            if (!actor) {
                turns.push({ groupId, conversationLengthClass: cases[0].lengthClass || lengthClass(cases.length),
                    requestedListenerRole, error: 'LISTENER_ROLE_UNAVAILABLE' });
                completedGroups.add(groupId);
                if (battery) writeJsonAtomic(checkpointPath, buildReport('PARTIAL'));
                continue;
            }
            let sessionId = null;
            if (battery) {
                const bootstrap = runtime.api.conversationSessionBegin('Merhaba.', {
                    listenerActorId: actor.id
                });
                if (!bootstrap || !bootstrap.session || !bootstrap.session.id) {
                    turns.push({ groupId, error: bootstrap && bootstrap.code || 'BATTERY_BOOTSTRAP_FAILED',
                        conversationLengthClass: cases[0].lengthClass || lengthClass(cases.length) });
                    continue;
                }
                sessionId = bootstrap.session.id;
            }
            for (const source of cases) {
                if (turns.length >= turnLimit) break outer;
                const result = sessionId
                    ? runtime.api.conversationSessionFollowUp(sessionId, source.playerText)
                    : runtime.api.conversationSessionBegin(source.playerText, { listenerActorId: actor.id });
                const response = sessionId ? result.followUp && result.followUp.response
                    : result.session && result.session.listenerResponses[0];
                if (!result || !result.ok || !response) {
                    turns.push({ groupId, caseId: source.caseId, error: result && result.code || 'NO_RESPONSE' });
                    continue;
                }
                sessionId = sessionId || result.session.id;
                const session = runtime.api.conversationSessionGet(sessionId);
                const modelEligible = response.speechAct !== 'UNKNOWN'
                    && response.source !== 'DETERMINISTIC_GROUNDED_DISCOURSE_RESPONSE';
                if (!modelEligible) {
                    turns.push({
                        groupId, caseId: source.caseId, turnIndex: source.turnIndex,
                        listenerActorId: actor.id, listenerRole: actor.role,
                        requestedListenerRole, listenerRoleMatched: actor.role === requestedListenerRole,
                        conversationLengthClass: source.lengthClass || lengthClass(cases.length),
                        playerText: source.playerText, dialogueMoveId: response.dialogueMove.moveId,
                        modelEligible: false, disposition: 'NOT_REQUIRED',
                        accepted: null, acceptedReply: response.text, fallbackReply: response.text,
                        contextWithinLimit: true
                    });
                    continue;
                }
                const prompt = runtime.api.conversationSocialLLMPrompt(session, response, source.playerText);
                const inputTokens = await host.count(`${SYSTEM}\n${prompt}`);
                const schema = runtime.api.conversationSocialLLMSchema(response.dialogueMove);
                const modelSeed = 51000 + turns.length;
                const generated = await host.generate({ system: SYSTEM, prompt, maxTokens: 220,
                    temperature: 0.35, jsonSchema: schema, seed: modelSeed });
                const history = (session.listenerResponses || []).filter(row => row.id !== response.id)
                    .map(row => ({ text: row.text }));
                const accepted = runtime.api.conversationSocialLLMParse(generated.raw,
                    response.text, source.playerText, { history, dialogueMove: response.dialogueMove });
                const diagnosis = runtime.api.conversationSocialLLMDiagnose(generated.raw,
                    response.text, source.playerText, { history, dialogueMove: response.dialogueMove });
                turns.push({
                    groupId, caseId: source.caseId, turnIndex: source.turnIndex,
                    listenerActorId: actor.id, listenerRole: actor.role,
                    requestedListenerRole, listenerRoleMatched: actor.role === requestedListenerRole,
                    conversationLengthClass: source.lengthClass || lengthClass(cases.length), modelSeed,
                    modelEligible: true, disposition: accepted ? 'USED' : 'FALLBACK_KEPT',
                    playerText: source.playerText, dialogueMoveId: response.dialogueMove.moveId,
                    contextPackId: runtime.api.conversationContextPack(
                        session, response, source.playerText).packId,
                    systemHash: hash(SYSTEM), promptHash: hash(prompt), grammarHash: hash(schema),
                    inputTokens, maxTokens: 220, wrapperReserve: 128,
                    contextWithinLimit: inputTokens + 220 + 128 <= 8192,
                    rawOutput: generated.raw, acceptedReply: accepted,
                    validationCode: diagnosis.code,
                    qualityTags: diagnosis.qualityTags || [],
                    rawOutputHash: hash(generated.raw), acceptedReplyHash: accepted ? hash(accepted) : null,
                    accepted: !!accepted, fallbackReply: response.text,
                    firstTokenMs: generated.firstTokenMs == null ? null : round(generated.firstTokenMs),
                    totalMs: round(generated.totalMs), generatedTokens: generated.generatedTokens,
                    rssMb: generated.memory ? round(generated.memory.rss / 1048576) : null
                });
            }
            completedGroups.add(groupId);
            if (battery) writeJsonAtomic(checkpointPath, buildReport('PARTIAL'));
        }
        const report = buildReport('COMPLETE');
        writeJsonAtomic(outputPath, report);
        if (fs.existsSync(checkpointPath)) fs.unlinkSync(checkpointPath);
        process.stdout.write(`${JSON.stringify({ outputPath, backend: report.backend,
            summary: report.summary })}\n`);
    } finally {
        host.stop(); runtime.dom.window.close();
    }
}

main().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
