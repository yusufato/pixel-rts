'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createLlmHostClient } = require('./story-dialogue-llm-host-client');
const { createRuntime } = require('./story-sim-harness');
const { groupCases } = require('./story-dialogue-current-replay');
const { buildManifest } = require('./story-dialogue-8b-manifest');
const { buildManifest: buildAdversarialManifest, playerPrompt } = require('./story-dialogue-adversarial-player-manifest');

const ROOT = path.resolve(__dirname, '..');
const corpusPath = path.join(ROOT, 'qa-runtime', 'story-dialogue-corpus-s0.json');
const outputArg = process.argv.find(row => row.startsWith('--output='));
const outputPath = path.resolve(outputArg ? outputArg.slice(9)
    : path.join(ROOT, 'qa-runtime', 'story-dialogue-8b-runner.json'));
const checkpointPath = outputPath.replace(/\.json$/i, '.partial.json');
const smoke = process.argv.includes('--smoke');
const battery = process.argv.includes('--battery');
const adversarial = process.argv.includes('--adversarial');
const player14b = process.argv.includes('--player14b');
const swapSmoke = process.argv.includes('--swap-smoke');
const requestedTurns = Number((process.argv.find(row => row.startsWith('--turns=')) || '').slice(8));
const turnLimit = Number.isFinite(requestedTurns) && requestedTurns > 0
    ? Math.floor(requestedTurns) : smoke ? 3 : 80;
const modelPath = path.join(ROOT, 'models', 'Turkish-Llama-8b-Instruct-v0.1.Q4_K_M.gguf');
const playerModelPath = player14b
    ? path.join(ROOT, 'models', 'Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf') : modelPath;
const electronNodePath = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const SYSTEM = 'Modern bir strateji oyunundaki karakter olarak Türkçe konuş. Yalnız verilen bağlamı kullan.';
const PLAYER_SYSTEM = 'Pixel RTS oynayan bağımsız, meraklı ve gerektiğinde yanıltıcı bir insan oyuncu gibi doğal Türkçe konuş.';
const runStartedAt = Date.now();
function liveLine(speaker, text, remaining) {
    const elapsed = Math.floor((Date.now() - runStartedAt) / 1000);
    const stamp = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
    process.stdout.write(`[${stamp}] [${speaker}] [KALAN ${remaining}] ${String(text).replace(/\s+/g, ' ').trim()}\n`);
}
function playerTextSimilarity(left, right) {
    const stop = new Set(['bir', 've', 'ile', 'icin', 'gibi', 'cok', 'daha', 'bence', 'ama']);
    const tokens = value => new Set(String(value || '').toLocaleLowerCase('tr-TR')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9çğıöşü]+/g, ' ')
        .split(' ').filter(token => token.length >= 4 && !stop.has(token)));
    const a = tokens(left), b = tokens(right);
    const overlap = [...a].filter(token => b.has(token)).length;
    return overlap / Math.max(1, Math.min(a.size, b.size));
}
function foldText(value) {
    return String(value || '').toLocaleLowerCase('tr-TR').normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9çğıöşü]+/g, ' ').trim();
}
function playerUsesTopicAnchor(text, anchors) {
    const tokens = foldText(text).split(' ').filter(Boolean);
    return (anchors || []).some(anchor => {
        const key = foldText(anchor);
        if (!key) return false;
        if (key.includes(' ')) return ` ${tokens.join(' ')} `.includes(` ${key} `);
        return tokens.some(token => token === key || (key.length >= 5 && token.startsWith(key)));
    });
}
function playerMatchesUtteranceMode(text, mode) {
    if (mode === 'QUESTION') return /\?\s*$/.test(String(text || '').trim());
    if (mode === 'FRAGMENT') return String(text || '').trim().split(/\s+/).length <= 12;
    return true;
}
function playerLeaksPrivateBrief(text) {
    const folded = foldText(text);
    return ['saldırı ailesi', 'saldiri ailesi', 'gizli test', 'test hedefi',
        'mekanik olgunluk', 'knowledge relation', 'utterance mode', 'attack family',
        'gelecek faz', 'faz yetenegi', 'faz bilgisi']
        .some(marker => folded.includes(marker));
}
function memorySnapshot() {
    return { freeMb: round(os.freemem() / 1048576), totalMb: round(os.totalmem() / 1048576) };
}
async function waitForMemoryRecovery(targetFreeBytes, timeoutMs = 30000) {
    const started = Date.now();
    let freeBytes = os.freemem();
    while (freeBytes < targetFreeBytes && Date.now() - started < timeoutMs) {
        await new Promise(resolve => setTimeout(resolve, 500));
        freeBytes = os.freemem();
    }
    return { waitedMs: Date.now() - started, recovered: freeBytes >= targetFreeBytes,
        freeMb: round(freeBytes / 1048576) };
}
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

function runnerHost(selectedModelPath = modelPath, selectedContextSize = 8192) {
    return createLlmHostClient({ root: ROOT, modelPath: selectedModelPath,
        contextSize: selectedContextSize, electronNodePath, requireDiscreteGpu: true });
}

async function main() {
    if (player14b && !fs.existsSync(playerModelPath)) throw new Error(`Oyuncu modeli bulunamadı: ${playerModelPath}`);
    const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
    const batteryManifest = battery ? buildManifest() : null;
    const runtime = createRuntime(2032);
    const swapMode = adversarial && player14b;
    const baselineFreeBytes = os.freemem();
    let host = null;
    let playerHost = null;
    const hostStats = { characterLoads: [], playerLoads: [], swaps: [], characterBackend: 'not_loaded',
        playerBackend: 'not_loaded', backendDiagnostics: [], hostRuntime: 'unknown' };
    if (!swapMode) {
        host = runnerHost();
        const load = await host.load();
        hostStats.characterLoads.push(round(load.loadMs));
        hostStats.characterBackend = host.backend();
        hostStats.backendDiagnostics = host.backendDiagnostics();
        hostStats.hostRuntime = host.runtime();
        playerHost = host;
        hostStats.playerLoads.push(round(load.loadMs));
        hostStats.playerBackend = host.backend();
    }
    const acquireHost = async kind => {
        if (!swapMode) return { host: kind === 'player' ? playerHost : host, ephemeral: false, loadMs: 0 };
        const before = memorySnapshot();
        const selectedPath = kind === 'player' ? playerModelPath : modelPath;
        const selectedContext = kind === 'player' ? 4096 : 8192;
        liveLine('MODEL LOAD', `${kind === 'player' ? '14B oyuncu' : '8B karakter'} yükleniyor; boş RAM ${before.freeMb} MB`,
            Math.max(0, turnLimit - turns.length));
        const leasedHost = runnerHost(selectedPath, selectedContext);
        let loaded;
        try { loaded = await leasedHost.load(); }
        catch (error) { await leasedHost.stopAndWait(); throw error; }
        const loadMs = round(loaded.loadMs);
        hostStats[`${kind}Loads`].push(loadMs);
        hostStats[`${kind}Backend`] = leasedHost.backend();
        if (kind === 'character') hostStats.backendDiagnostics = leasedHost.backendDiagnostics();
        hostStats.hostRuntime = leasedHost.runtime();
        liveLine('MODEL LOAD', `${kind === 'player' ? '14B oyuncu' : '8B karakter'} hazır (${loadMs} ms, ${leasedHost.backend()})`,
            Math.max(0, turnLimit - turns.length));
        return { host: leasedHost, ephemeral: true, loadMs, before };
    };
    const releaseHost = async (lease, kind) => {
        if (!lease || !lease.ephemeral) return null;
        await lease.host.stopAndWait();
        const recoveryTarget = Math.max(4 * 1073741824, Math.floor(baselineFreeBytes * 0.82));
        const recovery = await waitForMemoryRecovery(recoveryTarget);
        const row = { kind, loadMs: lease.loadMs, before: lease.before,
            after: memorySnapshot(), recovery };
        hostStats.swaps.push(row);
        liveLine('MODEL SWAP', `${kind === 'player' ? '14B oyuncu' : '8B karakter'} boşaltıldı; boş RAM ${row.after.freeMb} MB`,
            Math.max(0, turnLimit - turns.length));
        return row;
    };
    let turns = [];
    let resumedTurns = 0;
    let inFlight = null;
    try {
        runtime.api.newCampaign({ seed: 2032, playerStateId: 0, abundance: 1,
            doctrine: 'combined', fog: true });
        const directory = runtime.api.contactDirectoryBuild();
        const actors = (directory.publicCharacters || []).filter(row => row.id !== directory.playerActorId);
        const byRole = new Map();
        actors.forEach(row => { if (!byRole.has(row.role)) byRole.set(row.role, row); });
        const adversarialManifest = adversarial ? buildAdversarialManifest(turnLimit) : null;
        if (adversarialManifest && swapSmoke) {
            const base = adversarialManifest.scenarios[0];
            adversarialManifest.scenarios = [Object.assign({}, base, {
                id: 'adversarial-player:swap-smoke', knowledgeRelation: 'UNKNOWN_TO_CHARACTER',
                utteranceMode: 'QUESTION', attackFamily: 'EVERYDAY_CHAT',
                domain: { id: 'EVERYDAY_CHAT', status: 'LIVE', ownerPhases: [] },
                requiredTopicAnchors: ['bugün', 'nasılsın', 'halin'],
                targetTopicAnchor: 'bugün',
                domainGuidance: 'Karakterin bugün nasıl olduğunu sorarak gündelik sohbet aç.',
                privatePlayerBrief: 'Karaktere bugün nasıl olduğunu doğrudan ve doğal bir soruyla sor.'
            })];
            adversarialManifest.checksum = `swap-smoke:${hash(adversarialManifest.scenarios)}`;
        }
        const groups = adversarial
            ? Array.from({ length: Math.ceil(adversarialManifest.scenarios.length / 10) }, (_, groupIndex) => {
                const groupId = `adversarial-live:${String(groupIndex + 1).padStart(2, '0')}`;
                return [groupId, adversarialManifest.scenarios.slice(groupIndex * 10, groupIndex * 10 + 10)
                    .map((scenario, turnIndex) => ({ caseId: scenario.id, conversationGroupId: groupId,
                        turnIndex, scenario, listener: { role: 'EXECUTIVE' }, lengthClass: 'LONG',
                        scenarioSeed: scenario.seed }))];
            })
            : battery
            ? batteryManifest.scenarios.map(scenario => [scenario.id, scenario.turns.map((playerText, turnIndex) => ({
                caseId: `${scenario.id}:turn:${turnIndex}`, conversationGroupId: scenario.id,
                turnIndex, playerText, listener: { role: scenario.listenerRole || 'POLITICAL_FIGURE' },
                lengthClass: scenario.lengthClass, scenarioSeed: scenario.seed
            }))])
            : groupCases(corpus.cases);
        const groupSizes = new Map(groups.map(([groupId, cases]) => [groupId, cases.length]));
        if ((battery || adversarial) && fs.existsSync(checkpointPath)) {
            try {
                const saved = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
                if (saved && saved.schemaVersion === 2
                    && (!battery || saved.batteryManifestChecksum === batteryManifest.checksum)
                    && (!adversarial || saved.adversarialManifestChecksum === adversarialManifest.checksum)
                    && saved.model === path.basename(modelPath)
                    && saved.playerModel === path.basename(playerModelPath)
                    && saved.validatorFingerprint === validatorFingerprint
                    && Array.isArray(saved.turns)) {
                    turns = saved.turns;
                    resumedTurns = turns.length;
                    inFlight = saved.inFlight && typeof saved.inFlight === 'object' ? saved.inFlight : null;
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
            runnerVersion: 'story-dialogue-8b-runner-4', createdAt: new Date().toISOString(),
            status, corpusChecksum: corpus.manifestChecksum, seed: 2032, smoke,
            requestedTurnLimit: turnLimit, batteryMode: battery,
            batteryManifestChecksum: batteryManifest && batteryManifest.checksum || null,
            adversarialManifestChecksum: adversarialManifest && adversarialManifest.checksum || null,
            model: path.basename(modelPath), backend: hostStats.characterBackend,
            playerModel: path.basename(playerModelPath), playerBackend: hostStats.playerBackend,
            playerLoadMs: hostStats.playerLoads.length ? hostStats.playerLoads[0] : null,
            backendDiagnostics: hostStats.backendDiagnostics, hostRuntime: hostStats.hostRuntime, contextSize: 8192,
            validatorFingerprint,
            inFlight,
            loadMs: hostStats.characterLoads.length ? hostStats.characterLoads[0] : null, resumedTurns,
            modelSwap: { enabled: swapMode, baselineMemory: { freeMb: round(baselineFreeBytes / 1048576),
                totalMb: round(os.totalmem() / 1048576) }, playerLoads: hostStats.playerLoads.length,
                characterLoads: hostStats.characterLoads.length,
                totalLoadMs: round(hostStats.playerLoads.concat(hostStats.characterLoads)
                    .reduce((sum, value) => sum + value, 0)), swaps: hostStats.swaps },
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
            const visibleTranscript = [];
            if (battery || adversarial) {
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
            const savedRows = turns.filter(row => row.groupId === groupId && row.playerText)
                .sort((left, right) => Number(left.turnIndex) - Number(right.turnIndex));
            const savedCaseIds = new Set(savedRows.map(row => row.caseId));
            if (adversarial && savedRows.length) {
                for (const savedRow of savedRows) {
                    runtime.api.conversationSessionFollowUp(sessionId, savedRow.playerText);
                    visibleTranscript.push({ speaker: 'PLAYER', text: savedRow.playerText });
                    visibleTranscript.push({ speaker: 'CHARACTER',
                        text: savedRow.acceptedReply || savedRow.fallbackReply || '' });
                }
                liveLine('DEVAM', `${savedRows.length} kayıtlı tur yeniden kuruldu`,
                    Math.max(0, turnLimit - turns.length));
            }
            for (const sourceTemplate of cases) {
                if (savedCaseIds.has(sourceTemplate.caseId)) continue;
                if (turns.length >= turnLimit) break outer;
                let source = sourceTemplate;
                let playerSwap = null;
                if (adversarial) {
                    const publicSnapshot = { characterName: actor.name, characterRole: actor.role,
                        domain: source.scenario.domain };
                    let playerText = '';
                    let generatedPlayer = null;
                    const resumedInFlight = inFlight && inFlight.groupId === groupId
                        && inFlight.caseId === source.caseId ? inFlight : null;
                    if (resumedInFlight) {
                        playerText = resumedInFlight.playerText;
                        playerSwap = resumedInFlight.playerSwap || null;
                        liveLine('DEVAM', 'Kayıtlı oyuncu turundan 8B karakter aşamasına geçiliyor',
                            Math.max(0, turnLimit - turns.length));
                    } else {
                        const playerLease = await acquireHost('player');
                        try {
                            for (let attempt = 0; attempt < 3; attempt++) {
                            const priorPlayerTexts = visibleTranscript.filter(row => row.speaker === 'PLAYER').map(row => row.text);
                            generatedPlayer = await playerLease.host.generate({ system: PLAYER_SYSTEM,
                                prompt: playerPrompt(source.scenario, visibleTranscript, publicSnapshot)
                                    + `\nÖNCEKİ OYUNCU CÜMLELERİNE BENZEME: ${JSON.stringify(priorPlayerTexts)}`,
                                maxTokens: 140, temperature: 0.9, seed: source.scenario.seed + attempt * 1009,
                                jsonSchema: { type: 'object', additionalProperties: false,
                                    properties: { playerText: { type: 'string', minLength: 1, maxLength: 1200 } },
                                    required: ['playerText'] } });
                            let playerEnvelope;
                            try { playerEnvelope = JSON.parse(generatedPlayer.raw); } catch (_) { playerEnvelope = null; }
                            const candidate = String(playerEnvelope && playerEnvelope.playerText || '').trim();
                            const repeated = priorPlayerTexts.some(previous =>
                                previous.toLocaleLowerCase('tr-TR') === candidate.toLocaleLowerCase('tr-TR')
                                || playerTextSimilarity(previous, candidate) >= 0.72);
                            const onTopic = playerUsesTopicAnchor(candidate,
                                source.scenario.requiredTopicAnchors);
                            const correctForm = playerMatchesUtteranceMode(candidate, source.scenario.utteranceMode);
                            const privateBriefSafe = !playerLeaksPrivateBrief(candidate);
                            if (candidate && !repeated && onTopic && correctForm && privateBriefSafe) {
                                playerText = candidate; break;
                            }
                            }
                        } finally {
                            playerSwap = await releaseHost(playerLease, 'player');
                        }
                    }
                    if (!playerText) {
                        turns.push({ groupId, caseId: source.caseId, error: 'PLAYER_LLM_REPETITIVE_OR_INVALID',
                            rawOutput: generatedPlayer && generatedPlayer.raw || '',
                            targetDomain: source.scenario.domain.id,
                            requiredTopicAnchors: source.scenario.requiredTopicAnchors,
                            playerSwap });
                        writeJsonAtomic(checkpointPath, buildReport('PARTIAL'));
                        continue;
                    }
                    source = Object.assign({}, source, { playerText });
                    liveLine('OYUNCU LLM', playerText, Math.max(0, turnLimit - turns.length - 1));
                    visibleTranscript.push({ speaker: 'PLAYER', text: playerText });
                    inFlight = { groupId, caseId: source.caseId, turnIndex: source.turnIndex,
                        playerText, playerSwap, targetDomain: source.scenario.domain.id };
                    writeJsonAtomic(checkpointPath, buildReport('PARTIAL'));
                }
                const result = sessionId
                    ? runtime.api.conversationSessionFollowUp(sessionId, source.playerText)
                    : runtime.api.conversationSessionBegin(source.playerText, { listenerActorId: actor.id });
                const response = sessionId ? result.followUp && result.followUp.response
                    : result.session && result.session.listenerResponses[0];
                if (!result || !response) {
                    turns.push({ groupId, caseId: source.caseId, error: result && result.code || 'NO_RESPONSE' });
                    inFlight = null;
                    if (adversarial) writeJsonAtomic(checkpointPath, buildReport('PARTIAL'));
                    continue;
                }
                sessionId = sessionId || result.session.id;
                const session = runtime.api.conversationSessionGet(sessionId);
                const modelEligible = response.speechAct !== 'UNKNOWN'
                    && response.enrichmentStatus !== 'NOT_REQUIRED';
                if (!modelEligible) {
                    turns.push({
                        groupId, caseId: source.caseId, turnIndex: source.turnIndex,
                        listenerActorId: actor.id, listenerRole: actor.role,
                        requestedListenerRole, listenerRoleMatched: actor.role === requestedListenerRole,
                        conversationLengthClass: source.lengthClass || lengthClass(cases.length),
                        playerText: source.playerText, dialogueMoveId: response.dialogueMove.moveId,
                        modelEligible: false, disposition: 'NOT_REQUIRED',
                        accepted: null, acceptedReply: response.text, fallbackReply: response.text,
                        contextWithinLimit: true,
                        targetDomain: source.scenario && source.scenario.domain.id || null,
                        knowledgeRelation: source.scenario && source.scenario.knowledgeRelation || null,
                        attackFamily: source.scenario && source.scenario.attackFamily || null,
                        playerSwap
                    });
                    if (adversarial) {
                        liveLine(`KARAKTER · ${actor.name}`, response.text, Math.max(0, turnLimit - turns.length));
                        visibleTranscript.push({ speaker: 'CHARACTER', text: response.text });
                    }
                    inFlight = null;
                    if (adversarial) writeJsonAtomic(checkpointPath, buildReport('PARTIAL'));
                    continue;
                }
                const prompt = runtime.api.conversationSocialLLMPrompt(session, response, source.playerText);
                const characterLease = await acquireHost('character');
                let inputTokens;
                let generated;
                const schema = runtime.api.conversationSocialLLMSchema(response.dialogueMove);
                const modelSeed = 51000 + turns.length;
                let characterSwap = null;
                try {
                    inputTokens = await characterLease.host.count(`${SYSTEM}\n${prompt}`);
                    generated = await characterLease.host.generate({ system: SYSTEM, prompt, maxTokens: 300,
                        temperature: 0.35, jsonSchema: schema, seed: modelSeed });
                } finally {
                    characterSwap = await releaseHost(characterLease, 'character');
                }
                const validationContext = runtime.api.conversationValidationContext(session, response);
                const accepted = runtime.api.conversationSocialLLMParse(generated.raw,
                    response.text, source.playerText, validationContext);
                const diagnosis = runtime.api.conversationSocialLLMDiagnose(generated.raw,
                    response.text, source.playerText, validationContext);
                turns.push({
                    groupId, caseId: source.caseId, turnIndex: source.turnIndex,
                    listenerActorId: actor.id, listenerRole: actor.role,
                    requestedListenerRole, listenerRoleMatched: actor.role === requestedListenerRole,
                    conversationLengthClass: source.lengthClass || lengthClass(cases.length), modelSeed,
                    modelEligible: true, disposition: accepted ? 'USED' : 'FALLBACK_KEPT',
                    playerText: source.playerText, dialogueMoveId: response.dialogueMove.moveId,
                    targetDomain: source.scenario && source.scenario.domain.id || null,
                    targetDomainStatus: source.scenario && source.scenario.domain.status || null,
                    knowledgeRelation: source.scenario && source.scenario.knowledgeRelation || null,
                    attackFamily: source.scenario && source.scenario.attackFamily || null,
                    utteranceMode: source.scenario && source.scenario.utteranceMode || null,
                    requiredTopicAnchors: source.scenario && source.scenario.requiredTopicAnchors || [],
                    playerSwap, characterSwap,
                    contextPackId: runtime.api.conversationContextPack(
                        session, response, source.playerText).packId,
                    systemHash: hash(SYSTEM), promptHash: hash(prompt), grammarHash: hash(schema),
                    inputTokens, maxTokens: 300, wrapperReserve: 128,
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
                if (adversarial) {
                    const visibleReply = accepted || response.text;
                    liveLine(`KARAKTER · ${actor.name}`, visibleReply, Math.max(0, turnLimit - turns.length));
                    visibleTranscript.push({ speaker: 'CHARACTER', text: visibleReply });
                }
                inFlight = null;
                if (adversarial) writeJsonAtomic(checkpointPath, buildReport('PARTIAL'));
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
        if (playerHost && playerHost !== host) await playerHost.stopAndWait();
        if (host) await host.stopAndWait();
        runtime.dom.window.close();
    }
}

main().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
