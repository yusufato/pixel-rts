'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRuntime } = require('./story-sim-harness');
const { createLlmHostClient } = require('./story-dialogue-llm-host-client');
const { buildManifest } = require('./story-dialogue-adversarial-player-manifest');

const ROOT = path.resolve(__dirname, '..');
const outputArg = process.argv.find(row => row.startsWith('--output='));
const sessionArg = process.argv.find(row => row.startsWith('--sessions='));
const depthArg = process.argv.find(row => row.startsWith('--depth='));
const microbatchArg = process.argv.find(row => row.startsWith('--player-microbatch='));
const scenarioOffsetArg = process.argv.find(row => row.startsWith('--scenario-offset='));
const sessionCount = Math.max(1, Math.floor(Number(sessionArg && sessionArg.slice(11)) || 10));
const depthLimit = Math.max(1, Math.floor(Number(depthArg && depthArg.slice(8)) || 10));
const playerMicrobatchSize = Math.min(2, Math.max(1,
    Math.floor(Number(microbatchArg && microbatchArg.split('=')[1]) || 2)));
const playerContextSize = 4096;
const scenarioOffset = Math.max(0, Math.floor(Number(
    scenarioOffsetArg && scenarioOffsetArg.split('=')[1]) || 0));
const outputPath = path.resolve(outputArg ? outputArg.slice(9)
    : path.join(ROOT, 'qa-runtime', 'story-dialogue-frontier.json'));
const checkpointPath = outputPath.replace(/\.json$/i, '.partial.json');
const playerModelPath = path.join(ROOT, 'models', 'Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf');
const characterModelPath = path.join(ROOT, 'models', 'Turkish-Llama-8b-Instruct-v0.1.Q4_K_M.gguf');
const PLAYER_SYSTEM = 'Pixel RTS oynayan bağımsız, meraklı ve gerektiğinde yanıltıcı bir insan oyuncu gibi doğal Türkçe konuş.';
const CHARACTER_SYSTEM = 'Modern bir strateji oyunundaki karakter olarak Türkçe konuş. Yalnız verilen bağlamı kullan.';
const startedAt = Date.now();

function round(value, digits = 2) {
    const scale = 10 ** digits;
    return Math.round(Number(value) * scale) / scale;
}
function hash(value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    let state = 2166136261;
    for (let index = 0; index < text.length; index++) {
        state ^= text.charCodeAt(index); state = Math.imul(state, 16777619) >>> 0;
    }
    return (`00000000${state.toString(16)}`).slice(-8);
}
function frontierRunnerFingerprint() {
    return hash([
        fs.readFileSync(__filename, 'utf8'),
        fs.readFileSync(path.join(ROOT, 'tools', 'story-dialogue-adversarial-player-manifest.js'), 'utf8'),
        fs.readFileSync(path.join(ROOT, 'tools', 'story-dialogue-domain-maturity.json'), 'utf8')
    ].join('\n---FRONTIER-CONTRACT---\n'));
}
function fold(value) {
    return String(value || '').toLocaleLowerCase('tr-TR').normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9çğıöşü]+/g, ' ').trim();
}
function similarity(left, right) {
    const stop = new Set(['bir', 've', 'ile', 'icin', 'gibi', 'cok', 'daha', 'bence', 'ama']);
    const tokens = value => new Set(fold(value).split(' ')
        .filter(token => token.length >= 4 && !stop.has(token)));
    const a = tokens(left), b = tokens(right);
    const overlap = [...a].filter(token => b.has(token)).length;
    return overlap / Math.max(1, Math.min(a.size, b.size));
}
function usesAnchor(text, anchors) {
    const tokens = fold(text).split(' ').filter(Boolean);
    const suffixes = ['i', 'ı', 'u', 'ü', 'in', 'ın', 'un', 'ün', 'e', 'a', 'de', 'da',
        'den', 'dan', 'ler', 'lar', 'im', 'ım', 'um', 'üm', 'imi', 'ımı', 'umu', 'ümü',
        'imiz', 'ımız', 'umuz', 'ümüz',
        'mi', 'mı', 'mu', 'mü', 'nin', 'nın', 'nun', 'nün', 'yi', 'yı', 'yu', 'yü'];
    const softened = key => ({ k: 'g', p: 'b', t: 'd', c: 'c' }[key.slice(-1)]
        ? `${key.slice(0, -1)}${{ k: 'g', p: 'b', t: 'd', c: 'c' }[key.slice(-1)]}` : key);
    const tokenMatches = (token, key) => {
        if (token === key || (key.length >= 5 && token.startsWith(key))) return true;
        if (key.length < 3) return false;
        return [key, softened(key)].some(stem => token.startsWith(stem)
            && suffixes.includes(token.slice(stem.length)));
    };
    return (anchors || []).some(anchor => {
        const key = fold(anchor);
        if (!key) return false;
        if (key.includes(' ')) {
            const parts = key.split(' ');
            return tokens.some((token, index) => parts.every((part, offset) =>
                tokens[index + offset] && tokenMatches(tokens[index + offset], part)));
        }
        return tokens.some(token => tokenMatches(token, key));
    });
}
function matchesMode(text, mode) {
    const value = String(text || '').trim();
    const folded = fold(value);
    const tokens = new Set(folded.split(' ').filter(Boolean));
    const hasPhrase = (...needles) => needles.some(needle => {
        const key = fold(needle);
        return key.includes(' ') ? ` ${folded} `.includes(` ${key} `) : tokens.has(key);
    });
    const hasTokenPrefix = (...needles) => [...tokens].some(token => needles.some(needle => {
        const key = fold(needle);
        return token === key || (key.length >= 3 && token.startsWith(key));
    }));
    const question = /\?\s*$/.test(value);
    if (mode === 'QUESTION') return question;
    if (mode === 'ASSERTION') return !question;
    if (mode === 'DEMAND') return hasPhrase('istiyorum', 'talep ediyorum', 'emrediyorum', 'gerekiyor',
        'gerek', 'lütfen') || hasTokenPrefix('yap', 'ver', 'gönder', 'başlat', 'durdur', 'sağla', 'kur');
    if (mode === 'EMOTIONAL_REACTION') return hasTokenPrefix('sevin', 'üzül', 'endişe', 'kork',
        'kızgın', 'şaşır', 'heyecan', 'rahatsız', 'umut') || hasPhrase('hoşuma gitti', 'hoşuma gitmedi');
    if (mode === 'COUNTER_CLAIM') return hasPhrase('ama', 'ancak', 'hayır', 'katılmıyorum',
        'öyle değil', 'tersine', 'aksine', 'buna rağmen', 'yanlış', 'yine de');
    if (mode === 'FRAGMENT') return value.split(/\s+/).length <= 12;
    if (mode === 'TOPIC_SWITCH') return hasPhrase('başka bir konu', 'konuyu değiştir', 'geçelim',
        'bir yana', 'bu arada', 'şimdi de', 'yeni konu');
    if (mode === 'CORRECTION') return hasPhrase('yanlış', 'öyle değil', 'demek istemedim',
        'kastettim', 'aslında', 'hayır', 'önceki söz') || hasTokenPrefix('düzelt');
    if (mode === 'NEGOTIATION') return hasPhrase('karşılığında', 'şartıyla', 'koşuluyla')
        || hasTokenPrefix('teklif', 'bedel', 'ücret', 'pay', 'komisyon')
        || (tokens.has(fold('eğer')) && tokens.has(fold('ise')));
    if (mode === 'CASUAL_CHAT') return value.split(/\s+/).length <= 24
        && !hasPhrase('talep ediyorum', 'emrediyorum', 'karşılığında', 'şartıyla');
    return false;
}

function playerModeContract(mode, topicAnchor = 'konu') {
    const topic = String(topicAnchor || 'konu').trim();
    const contracts = {
        QUESTION: `Soru işaretiyle biten tek bir doğrudan soru yaz. Biçim örneği: “${topic} neden değişti?”`,
        ASSERTION: `Soru sorma; soru işareti kullanmadan bir iddia veya gözlem belirt. Biçim örneği: “${topic} hakkında eksik bir ayrıntı var.”`,
        DEMAND: `Karakterden açıkça bir eylem iste veya emir ver. Biçim örneği: “${topic} kayıtlarını incelemeni istiyorum.”`,
        EMOTIONAL_REACTION: `Kendi duygunu konuya bağla; sevindim, endişeliyim, kızgınım gibi açık duygu sözü kullan. Biçim örneği: “${topic} haberi beni endişelendirdi.”`,
        COUNTER_CLAIM: `Önceki tutuma açıkça karşı çık; hayır, ama, katılmıyorum veya buna rağmen gibi karşıtlık kullan. Biçim örneği: “Hayır, ${topic} konusunda sana katılmıyorum.”`,
        FRAGMENT: `En fazla on iki sözcüklü, kasıtlı kısa veya yarım bir ifade yaz. Biçim örneği: “${topic} hakkındaki o eski mesele...”`,
        TOPIC_SWITCH: `Konu değiştirdiğini açıkça söyle; bu arada, başka bir konu veya geçelim gibi geçiş kullan. Biçim örneği: “Bu arada ${topic} konusuna geçelim.”`,
        CORRECTION: `Önceki sözü açıkça düzelt; hayır, aslında, yanlış veya demek istemedim kullan. Biçim örneği: “Hayır, ${topic} konusunda önceki sözümü düzeltmek istiyorum.”`,
        NEGOTIATION: `Kazanç ve bedeli aynı teklifte bağla; karşılığında, şartıyla veya teklif kullan. Biçim örneği: “${topic} desteği karşılığında pay teklif ediyorum.”`,
        CASUAL_CHAT: `Talep veya pazarlık yapmadan gündelik, kısa ve doğal bir sosyal söz yaz. Biçim örneği: “Bugün ${topic} konusu sakin görünüyor.”`
    };
    return contracts[mode] || '';
}
function playerCandidateIssues(text, scenario, priorPlayer) {
    const value = String(text || '').trim();
    const folded = fold(value);
    const issues = [];
    if (!value) issues.push('EMPTY');
    if ((priorPlayer || []).some(previous => fold(previous) === folded
        || similarity(previous, value) >= 0.72)) issues.push('REPEATED');
    if (!usesAnchor(value, scenario.requiredTopicAnchors)) issues.push('OFF_TOPIC');
    if (!matchesMode(value, scenario.utteranceMode)) issues.push('WRONG_UTTERANCE_MODE');
    const foreignTokens = new Set(['really', 'actually', 'maybe', 'because', 'however',
        'therefore', 'although', 'people', 'important', 'currently', 'should', 'would',
        'could', 'about', 'with', 'from', 'this', 'that', 'have', 'meeting', 'government',
        'unexpectedly', 'suddenly', 'probably', 'basically', 'literally']);
    if (folded.split(' ').some(token => foreignTokens.has(token))) issues.push('NON_TURKISH_TOKEN');
    const sentenceCount = value.split(/[.!?]+/).map(row => row.trim()).filter(Boolean).length;
    if (sentenceCount > 2) issues.push('TOO_MANY_SENTENCES');
    if (['saldırı ailesi', 'saldiri ailesi', 'gizli test', 'test hedefi', 'mekanik olgunluk',
        'knowledge relation', 'utterance mode', 'attack family', 'gelecek faz',
        'faz yetenegi', 'faz bilgisi', 'gelistirme asamas', 'oyuncu yetenek',
        'oyun yetenek'].some(marker => folded.includes(marker))) {
        issues.push('PRIVATE_BRIEF_LEAK');
    }
    return issues;
}
function playerMicrobatchPrompt(jobs) {
    const compactJobs = jobs.map(job => ({
        jobId: job.session.index,
        publicCharacter: { name: job.session.actor.name, role: job.session.actor.role },
        goal: String(job.scenario.privatePlayerBrief || '')
            .replace(/gelecek[- ]faz/gi, 'henüz mümkün olmayan')
            .replace(/faz bilgisi/gi, 'iç yönerge'),
        formInstruction: job.scenario.utteranceGuidance,
        strictFormContract: playerModeContract(job.scenario.utteranceMode,
            job.scenario.targetTopicAnchor),
        topicGuidance: job.scenario.domainGuidance,
        preferredTopicAnchor: job.scenario.targetTopicAnchor,
        allowedTopicAnchors: job.scenario.requiredTopicAnchors,
        visibleTranscript: job.session.transcript.slice(-12),
        priorPlayerTexts: job.session.transcript.filter(row => row.speaker === 'PLAYER')
            .slice(-8).map(row => row.text),
        retryFeedback: job.retryFeedback || null
    }));
    return [
        'Aşağıdaki bağımsız Pixel RTS oyuncu işlerinin her biri için bir sonraki doğal Türkçe oyuncu sözünü üret.',
        'İşleri birbirine karıştırma. Her jobId tam bir kez dönmeli.',
        'Karaktere doğrudan hitap eden en fazla iki kısa cümle yaz; rapor, rol açıklaması veya test etiketi yazma.',
        'Yalnız doğal Türkçe kullan. İngilizce kelime, çeviri kokan ifade, bozuk ek veya anlamsız tamlama yazma; göndermeden önce özne-yüklem ve anlam kontrolü yap.',
        'Her söz kendi preferredTopicAnchor ifadesini mümkünse kullanmalı; doğal değilse allowedTopicAnchors içinden başka birini kullanabilir. Türkçe çekim eki serbesttir. strictFormContract zorunludur; örneğin konusunu değil yalnız cümle biçimini taklit et.',
        'Görünür geçmişte olmayan bilgiyi iddia edebilir veya yalan söyleyebilirsin; fakat iç yönergeyi veya alan kodunu tekrarlama.',
        `İŞLER: ${JSON.stringify(compactJobs)}`,
        'Yalnız {"turns":[{"jobId":0,"playerText":"..."}]} biçiminde JSON döndür.'
    ].join('\n');
}
function chunkRows(rows, size) {
    const chunks = [];
    for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
    return chunks;
}
function chunkJobsByMode(rows, size) {
    const groups = new Map();
    for (const row of rows) {
        const mode = row && row.scenario && row.scenario.utteranceMode || 'UNKNOWN';
        if (!groups.has(mode)) groups.set(mode, []);
        groups.get(mode).push(row);
    }
    return [...groups.values()].flatMap(group => chunkRows(group, size));
}
function writeAtomic(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.renameSync(temporary, filePath);
}
function memorySnapshot() {
    return { freeMb: round(os.freemem() / 1048576), totalMb: round(os.totalmem() / 1048576) };
}
function live(speaker, text, completed, total) {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const stamp = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
    process.stdout.write(`[${stamp}] [${speaker}] [KALAN ${Math.max(0, total - completed)}] ${String(text).replace(/\s+/g, ' ').trim()}\n`);
}
function patchAcceptedResponse(runtime, sessionId, responseId, acceptedText) {
    if (!acceptedText) return;
    const ledger = runtime.api.conversationSessionSnapshot();
    const session = (ledger.sessions || []).find(row => row.id === sessionId);
    if (!session) throw new Error(`SESSION_PATCH_NOT_FOUND:${sessionId}`);
    const response = (session.listenerResponses || []).find(row => row.id === responseId);
    if (!response) throw new Error(`RESPONSE_PATCH_NOT_FOUND:${responseId}`);
    response.text = acceptedText;
    response.source = 'LOCAL_LLM_CHARACTER_REALIZATION';
    response.enrichmentStatus = 'USED';
    response.llmUsed = true;
    const followUp = (session.followUps || []).find(row => row.response && row.response.id === responseId);
    if (followUp && followUp.response) Object.assign(followUp.response, response);
    const validation = runtime.api.conversationSessionValidate(ledger);
    if (!validation || !validation.ok) throw new Error('SESSION_PATCH_LEDGER_INVALID');
    runtime.api.conversationSessionRestore(ledger);
}
function completedCount(state) {
    return state.sessions.reduce((sum, session) => sum + session.turns.length, 0);
}
function summary(state) {
    const turns = state.sessions.flatMap(session => session.turns);
    const playerDiagnostics = turns.flatMap(row => row.playerMetrics && row.playerMetrics.attemptDiagnostics || []);
    const firstAttemptAccepted = turns.filter(row => row.playerMetrics
        && row.playerMetrics.attemptDiagnostics && row.playerMetrics.attemptDiagnostics[0]
        && !row.playerMetrics.attemptDiagnostics[0].issues.length).length;
    const finalPlayerAccepted = turns.filter(row => row.playerText && !row.error).length;
    const modelEligibleTurns = turns.filter(row => row.modelEligible === true);
    const supportedPublicTurns = turns.filter(row => row.knowledgeRelation === 'SUPPORTED_PUBLIC');
    const usefulAnswer = row => row.accepted === true || (row.disposition === 'NOT_REQUIRED'
        && row.responseDiscourseAct && !/CLARIFY|REPAIR|UNKNOWN/.test(row.responseDiscourseAct));
    const supportedPublicUseful = supportedPublicTurns.filter(usefulAnswer).length;
    return {
        sessions: state.sessions.length, turns: turns.length,
        accepted: turns.filter(row => row.accepted === true).length,
        fallback: turns.filter(row => row.accepted === false).length,
        notRequired: turns.filter(row => row.disposition === 'NOT_REQUIRED').length,
        errors: turns.filter(row => row.error).length,
        rejectionCodes: turns.filter(row => row.accepted === false).reduce((acc, row) => {
            const code = row.validationCode || 'UNKNOWN'; acc[code] = (acc[code] || 0) + 1; return acc;
        }, {}),
        playerAttemptSlots: playerDiagnostics.length,
        playerBatchCalls: new Set(playerDiagnostics.map(row => row.batchCallId || row.rawHash)).size,
        playerFirstAttemptAccepted: firstAttemptAccepted,
        playerFirstAttemptAcceptanceBps: Math.round(10000 * firstAttemptAccepted / Math.max(1, turns.length)),
        playerFinalAccepted: finalPlayerAccepted,
        modelEligibleTurns: modelEligibleTurns.length,
        characterAcceptanceBps: modelEligibleTurns.length
            ? Math.round(10000 * turns.filter(row => row.accepted === true).length
                / modelEligibleTurns.length) : 0,
        supportedPublicTurns: supportedPublicTurns.length,
        supportedPublicUseful,
        supportedPublicUsefulBps: supportedPublicTurns.length
            ? Math.round(10000 * supportedPublicUseful / supportedPublicTurns.length) : 0,
        playerCandidateIssues: playerDiagnostics.flatMap(row => row.issues || []).reduce((acc, issue) => {
            acc[issue] = (acc[issue] || 0) + 1; return acc;
        }, {})
    };
}

async function main() {
    for (const model of [playerModelPath, characterModelPath]) {
        if (!fs.existsSync(model)) throw new Error(`Model bulunamadı: ${model}`);
    }
    const totalTurns = sessionCount * depthLimit;
    const manifest = buildManifest(scenarioOffset + totalTurns);
    const validatorFingerprint = hash(fs.readFileSync(
        path.join(ROOT, 'js', 'StoryConversationUnderstanding.js'), 'utf8'));
    const runnerFingerprint = frontierRunnerFingerprint();
    const runtime = createRuntime(2032);
    runtime.api.newCampaign({ seed: 2032, playerStateId: 0, abundance: 1,
        doctrine: 'combined', fog: true });
    let state = null;
    if (fs.existsSync(checkpointPath)) {
        try {
            const saved = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
            if (saved.schemaVersion === 3 && saved.kind === 'STORY_DIALOGUE_FRONTIER_CHECKPOINT'
                && saved.sessionCount === sessionCount && saved.depthLimit === depthLimit
                && (Number(saved.scenarioOffset) || 0) === scenarioOffset
                && (saved.playerContextSize === playerContextSize
                    || (saved.playerContextSize == null && !(saved.pending || []).length
                        && !(saved.modelLoads || []).length))
                && saved.manifestChecksum === manifest.checksum
                && saved.validatorFingerprint === validatorFingerprint
                && saved.runnerFingerprint === runnerFingerprint
                && saved.playerModel === path.basename(playerModelPath)
                && saved.characterModel === path.basename(characterModelPath)) {
                state = saved;
                state.playerContextSize = playerContextSize;
                state.playerMicrobatchSize = playerMicrobatchSize;
                state.playerBatchSequence = Number(state.playerBatchSequence) || 0;
                state.pending = (state.pending || []).filter(row => {
                    if (!row.playerText) return true;
                    const scenario = manifest.scenarios[row.scenarioIndex];
                    const session = (state.sessions || [])[row.sessionIndex];
                    const prior = session ? session.transcript.filter(item => item.speaker === 'PLAYER')
                        .map(item => item.text) : [];
                    const issues = scenario ? playerCandidateIssues(row.playerText, scenario, prior) : ['NO_SCENARIO'];
                    if (!issues.length) return true;
                    live('CHECKPOINT RET', `Oturum ${row.sessionIndex + 1}: ${issues.join(', ')}`,
                        completedCount(state), totalTurns);
                    return false;
                });
                const validation = runtime.api.conversationSessionValidate(saved.conversationLedger);
                if (!validation || !validation.ok) throw new Error('CHECKPOINT_LEDGER_INVALID');
                runtime.api.conversationSessionRestore(saved.conversationLedger);
                live('DEVAM', `${completedCount(state)} tamamlanmış tur, faz ${state.phase}, derinlik ${state.depthIndex + 1}`,
                    completedCount(state), totalTurns);
            }
        } catch (error) {
            process.stderr.write(`Frontier ara kaydı kullanılamadı: ${error.message}\n`);
            state = null;
        }
    }
    if (!state) {
        const directory = runtime.api.contactDirectoryBuild();
        const actors = (directory.publicCharacters || []).filter(row => row.id !== directory.playerActorId);
        if (!actors.length) throw new Error('NO_PUBLIC_CHARACTER');
        const sessions = [];
        for (let index = 0; index < sessionCount; index++) {
            const actor = actors[index % actors.length];
            const opened = runtime.api.conversationSessionBegin('Merhaba.', { listenerActorId: actor.id });
            if (!opened || !opened.session || !opened.session.id) throw new Error('SESSION_BOOTSTRAP_FAILED');
            sessions.push({ index, sessionId: opened.session.id, actor: { id: actor.id, name: actor.name,
                role: actor.role }, transcript: [], turns: [] });
        }
        state = {
            schemaVersion: 3, kind: 'STORY_DIALOGUE_FRONTIER_CHECKPOINT',
            runnerVersion: 'story-dialogue-frontier-3', createdAt: new Date().toISOString(),
            sessionCount, depthLimit, playerMicrobatchSize, playerContextSize, scenarioOffset,
            depthIndex: 0, phase: 'PLAYER', pending: [], sessions,
            playerBatchSequence: 0,
            manifestChecksum: manifest.checksum, validatorFingerprint, runnerFingerprint,
            playerModel: path.basename(playerModelPath), characterModel: path.basename(characterModelPath),
            modelLoads: [], conversationLedger: runtime.api.conversationSessionSnapshot()
        };
        writeAtomic(checkpointPath, state);
    }
    const persist = () => {
        state.updatedAt = new Date().toISOString();
        state.conversationLedger = runtime.api.conversationSessionSnapshot();
        writeAtomic(checkpointPath, state);
    };
    try {
        while (state.depthIndex < depthLimit) {
            if (state.phase === 'PLAYER') {
                const host = createLlmHostClient({ root: ROOT, modelPath: playerModelPath,
                    contextSize: playerContextSize, generationTimeoutMs: 300000,
                    requireDiscreteGpu: true });
                const before = memorySnapshot();
                live('MODEL LOAD', `14B oyuncu frontier ${state.depthIndex + 1} yükleniyor`, completedCount(state), totalTurns);
                let loaded;
                try {
                    loaded = await host.load();
                    state.modelLoads.push({ kind: 'PLAYER', depthIndex: state.depthIndex,
                        loadMs: round(loaded.loadMs), backend: host.backend(),
                        devices: loaded.devices, vram: loaded.vram, before });
                    live('MODEL LOAD', `14B hazır (${round(loaded.loadMs)} ms, ${host.backend()})`, completedCount(state), totalTurns);
                    const jobs = state.sessions.filter(session =>
                        !state.pending.some(row => row.sessionIndex === session.index)).map(session => {
                        const scenarioIndex = scenarioOffset + state.depthIndex * sessionCount + session.index;
                        return { session, scenarioIndex, scenario: manifest.scenarios[scenarioIndex],
                            attemptDiagnostics: [] };
                    });
                    for (const initialBatch of chunkJobsByMode(jobs, playerMicrobatchSize)) {
                        let unresolved = initialBatch.slice();
                        for (let attempt = 0; attempt < 3 && unresolved.length; attempt++) {
                            const generated = await host.generate({ system: PLAYER_SYSTEM,
                                prompt: playerMicrobatchPrompt(unresolved),
                                maxTokens: Math.min(3072, 80 + unresolved.length * 180),
                                temperature: 0.9, seed: 73000 + state.depthIndex * 1009 + attempt * 7919,
                                jsonSchema: { type: 'object', additionalProperties: false,
                                    properties: { turns: { type: 'array', minItems: unresolved.length,
                                        maxItems: unresolved.length, items: { type: 'object',
                                            additionalProperties: false, properties: {
                                                jobId: { type: 'integer' },
                                                playerText: { type: 'string', minLength: 1, maxLength: 1200 }
                                            }, required: ['jobId', 'playerText'] } } }, required: ['turns'] } });
                            const batchCallId = `player-batch:${++state.playerBatchSequence}`;
                            let envelope = null;
                            try { envelope = JSON.parse(generated.raw); } catch (_) {}
                            const candidates = new Map((envelope && Array.isArray(envelope.turns)
                                ? envelope.turns : []).map(row => [Number(row.jobId), String(row.playerText || '').trim()]));
                            const retry = [];
                            for (const job of unresolved) {
                                const candidate = candidates.get(job.session.index) || '';
                                const priorPlayer = job.session.transcript.filter(row => row.speaker === 'PLAYER')
                                    .map(row => row.text);
                                const issues = playerCandidateIssues(candidate, job.scenario, priorPlayer);
                                if (issues.length) job.retryFeedback = {
                                    rejectedText: candidate, problems: issues,
                                    requiredForm: playerModeContract(job.scenario.utteranceMode,
                                        job.scenario.targetTopicAnchor),
                                    correction: 'Yeni ve doğal bir söz üret; reddedilen metni tekrarlama. allowedTopicAnchors içinden bir konu sözü kullan ve requiredForm biçimine harfiyen uy.'
                                };
                                job.attemptDiagnostics.push({ attempt: attempt + 1, issues,
                                    batchCallId, batchSize: unresolved.length, totalMs: round(generated.totalMs),
                                    rawHash: hash(generated.raw), candidate });
                                if (issues.length) { retry.push(job); continue; }
                                state.pending.push({ sessionIndex: job.session.index,
                                    scenarioIndex: job.scenarioIndex, scenarioId: job.scenario.id,
                                    playerText: candidate, error: null,
                                    playerMetrics: { attempts: job.attemptDiagnostics.length,
                                        attemptDiagnostics: job.attemptDiagnostics },
                                    prepared: false, completed: false });
                                live(`OYUNCU 14B · ${job.session.index + 1}/${sessionCount}`,
                                    candidate, completedCount(state), totalTurns);
                                persist();
                            }
                            unresolved = retry;
                        }
                        for (const job of unresolved) {
                            state.pending.push({ sessionIndex: job.session.index,
                                scenarioIndex: job.scenarioIndex, scenarioId: job.scenario.id,
                                playerText: '', error: 'PLAYER_LLM_REPETITIVE_OFF_TOPIC_OR_INVALID',
                                playerMetrics: { attempts: job.attemptDiagnostics.length,
                                    attemptDiagnostics: job.attemptDiagnostics },
                                prepared: false, completed: false });
                            live(`OYUNCU HATA · ${job.session.index + 1}/${sessionCount}`,
                                'Üç mikro-batch denemesinde geçerli alan/biçim cümlesi üretilemedi',
                                completedCount(state), totalTurns);
                            persist();
                        }
                    }
                } finally {
                    await host.stopAndWait();
                    const load = state.modelLoads[state.modelLoads.length - 1];
                    if (load && load.kind === 'PLAYER' && load.depthIndex === state.depthIndex) {
                        load.after = memorySnapshot();
                    }
                    persist();
                }
                state.phase = 'CHARACTER';
                persist();
            }

            if (state.phase === 'CHARACTER') {
                const work = [];
                for (const pending of state.pending) {
                    if (pending.completed) continue;
                    const sessionState = state.sessions[pending.sessionIndex];
                    const scenario = manifest.scenarios[pending.scenarioIndex];
                    if (pending.error || !pending.playerText) {
                        sessionState.turns.push({ depthIndex: state.depthIndex, scenarioId: scenario.id,
                            targetDomain: scenario.domain.id, knowledgeRelation: scenario.knowledgeRelation,
                            attackFamily: scenario.attackFamily,
                            error: pending.error || 'NO_PLAYER_TEXT', playerMetrics: pending.playerMetrics });
                        pending.completed = true; persist(); continue;
                    }
                    let result;
                    if (!pending.prepared) {
                        result = runtime.api.conversationSessionFollowUp(sessionState.sessionId, pending.playerText);
                        const response = result && result.followUp && result.followUp.response;
                        if (!response) {
                            sessionState.turns.push({ depthIndex: state.depthIndex, scenarioId: scenario.id,
                                playerText: pending.playerText, error: result && result.code || 'NO_RESPONSE' });
                            pending.completed = true; persist(); continue;
                        }
                        pending.prepared = true;
                        pending.responseId = response.id;
                        persist();
                    }
                    const session = runtime.api.conversationSessionGet(sessionState.sessionId);
                    const response = (session.listenerResponses || []).find(row => row.id === pending.responseId);
                    if (!response) throw new Error(`PREPARED_RESPONSE_MISSING:${pending.responseId}`);
                    const modelEligible = response.speechAct !== 'UNKNOWN'
                        && response.source !== 'DETERMINISTIC_GROUNDED_DISCOURSE_RESPONSE';
                    work.push({ pending, sessionState, scenario, session, response, modelEligible });
                }
                const eligible = work.filter(row => row.modelEligible);
                let host = null;
                try {
                    if (eligible.length) {
                        host = createLlmHostClient({ root: ROOT, modelPath: characterModelPath,
                            contextSize: 8192, requireDiscreteGpu: true });
                        const before = memorySnapshot();
                        live('MODEL LOAD', `8B karakter frontier ${state.depthIndex + 1} yükleniyor (${eligible.length} üretim)`,
                            completedCount(state), totalTurns);
                        const loaded = await host.load();
                        state.modelLoads.push({ kind: 'CHARACTER', depthIndex: state.depthIndex,
                            loadMs: round(loaded.loadMs), backend: host.backend(),
                            devices: loaded.devices, vram: loaded.vram, before,
                            backendDiagnostics: host.backendDiagnostics() });
                        live('MODEL LOAD', `8B hazır (${round(loaded.loadMs)} ms, ${host.backend()})`,
                            completedCount(state), totalTurns);
                    }
                    for (const item of work) {
                        const { pending, sessionState, scenario, session, response } = item;
                        let turn;
                        if (!item.modelEligible) {
                            turn = { depthIndex: state.depthIndex, scenarioId: scenario.id,
                                targetDomain: scenario.domain.id, knowledgeRelation: scenario.knowledgeRelation,
                                attackFamily: scenario.attackFamily, playerText: pending.playerText,
                                dialogueMoveId: response.dialogueMove.moveId, modelEligible: false,
                                disposition: 'NOT_REQUIRED', accepted: null,
                                acceptedReply: response.text, fallbackReply: response.text,
                                responseDiscourseAct: response.discourseAct || '',
                                playerMetrics: pending.playerMetrics };
                        } else {
                            const prompt = runtime.api.conversationSocialLLMPrompt(session, response, pending.playerText);
                            const schema = runtime.api.conversationSocialLLMSchema(response.dialogueMove);
                            const inputTokens = await host.count(`${CHARACTER_SYSTEM}\n${prompt}`);
                            const generated = await host.generate({ system: CHARACTER_SYSTEM, prompt,
                                maxTokens: 220, temperature: 0.35, jsonSchema: schema,
                                seed: 91000 + pending.scenarioIndex });
                            const validationContext = runtime.api.conversationValidationContext(session, response);
                            const accepted = runtime.api.conversationSocialLLMParse(generated.raw,
                                response.text, pending.playerText, validationContext);
                            const diagnosis = runtime.api.conversationSocialLLMDiagnose(generated.raw,
                                response.text, pending.playerText, validationContext);
                            if (accepted) patchAcceptedResponse(runtime, sessionState.sessionId, response.id, accepted);
                            turn = { depthIndex: state.depthIndex, scenarioId: scenario.id,
                                targetDomain: scenario.domain.id, knowledgeRelation: scenario.knowledgeRelation,
                                attackFamily: scenario.attackFamily, playerText: pending.playerText,
                                dialogueMoveId: response.dialogueMove.moveId, modelEligible: true,
                                disposition: accepted ? 'USED' : 'FALLBACK_KEPT', accepted: !!accepted,
                                acceptedReply: accepted, fallbackReply: response.text,
                                responseDiscourseAct: response.discourseAct || '',
                                validationCode: diagnosis.code, qualityTags: diagnosis.qualityTags || [],
                                playerMetrics: pending.playerMetrics,
                                rawOutput: generated.raw, inputTokens,
                                contextWithinLimit: inputTokens + 220 + 128 <= 8192,
                                firstTokenMs: generated.firstTokenMs == null ? null : round(generated.firstTokenMs),
                                totalMs: round(generated.totalMs), generatedTokens: generated.generatedTokens };
                        }
                        const visibleReply = turn.acceptedReply || turn.fallbackReply || '';
                        sessionState.turns.push(turn);
                        sessionState.transcript.push({ speaker: 'PLAYER', text: pending.playerText });
                        sessionState.transcript.push({ speaker: 'CHARACTER', text: visibleReply });
                        pending.completed = true;
                        live(`KARAKTER 8B · ${sessionState.index + 1}/${sessionCount}`,
                            visibleReply, completedCount(state), totalTurns);
                        persist();
                    }
                } finally {
                    if (host) {
                        await host.stopAndWait();
                        const load = state.modelLoads[state.modelLoads.length - 1];
                        if (load && load.kind === 'CHARACTER' && load.depthIndex === state.depthIndex) {
                            load.after = memorySnapshot();
                        }
                    }
                    persist();
                }
                state.pending = [];
                state.depthIndex++;
                state.phase = 'PLAYER';
                persist();
            }
        }
        const report = Object.assign({}, state, {
            kind: 'STORY_DIALOGUE_FRONTIER_REPORT', status: 'COMPLETE',
            finishedAt: new Date().toISOString(), summary: summary(state),
            conversationLedger: undefined, pending: undefined
        });
        writeAtomic(outputPath, report);
        if (fs.existsSync(checkpointPath)) fs.unlinkSync(checkpointPath);
        process.stdout.write(`${JSON.stringify({ outputPath, summary: report.summary,
            modelLoads: report.modelLoads.length })}\n`);
    } finally {
        runtime.dom.window.close();
    }
}

if (require.main === module) {
    main().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
}

module.exports = { patchAcceptedResponse, summary, playerCandidateIssues, playerMicrobatchPrompt,
    playerModeContract, chunkJobsByMode, frontierRunnerFingerprint };
