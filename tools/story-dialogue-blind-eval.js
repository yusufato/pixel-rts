'use strict';

// Faz 38.2 insan kör ses değerlendirme tezgâhı.
// Paket konuşmacı kimliklerini gizler; cevap anahtarı ayrı dosyada kalır.
// İnsan cevap vermeden başarı sonucu üretmez.

const fs = require('node:fs');
const path = require('node:path');
const { createRuntime } = require('./story-sim-harness');

const SCHEMA_VERSION = 1;
const DEFAULT_SEED = 2032;
const VOICE_CODES = ['SES-A', 'SES-B', 'SES-C'];

function hash32(value) {
    const text = String(value == null ? '' : value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

function shuffled(rows, seed) {
    return rows.slice().sort((a, b) => hash32(`${seed}|${a.id}`) - hash32(`${seed}|${b.id}`)
        || a.id.localeCompare(b.id, 'en'));
}

function buildPacket(seed = DEFAULT_SEED) {
    const runtime = createRuntime(seed >>> 0);
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = runtime.api.state();
        const playerActorId = story.commander ? `character:0:${story.commander.id}` : null;
        const identities = Object.values(runtime.api.characterIdentityLedger().identities || {})
            .filter(row => row.id !== playerActorId)
            .sort((a, b) => a.id.localeCompare(b.id, 'en'));
        const actors = [];
        const fingerprints = new Set();
        for (const actor of identities) {
            const sample = runtime.api.characterDialogueRealize({
                turnId: `blind:sample:${actor.id}`, actorId: actor.id,
                targetActorId: playerActorId, speechAct: 'ASK_INFORMATION'
            }, { history: [] });
            if (!sample || fingerprints.has(sample.voiceFingerprint)) continue;
            fingerprints.add(sample.voiceFingerprint);
            actors.push(actor);
            if (actors.length === VOICE_CODES.length) break;
        }
        if (actors.length !== VOICE_CODES.length) throw new Error('Üç ayrı ses imzası bulunamadı.');

        const answerKey = {};
        const speakerSamples = [];
        const evaluationItems = [];
        const intents = ['PROPOSE_COMMERCIAL_DEAL', 'COUNTER_OFFER', 'ASK_INFORMATION', 'DEFER', 'REJECT'];
        actors.forEach((actor, actorIndex) => {
            const voiceCode = VOICE_CODES[actorIndex];
            const history = [];
            const utterances = [];
            for (let turn = 0; turn < 12; turn++) {
                const realization = runtime.api.characterDialogueRealize({
                    turnId: `blind:${seed}:${actorIndex}:${turn}`,
                    actorId: actor.id,
                    targetActorId: playerActorId,
                    speechAct: intents[(turn + actorIndex) % intents.length],
                    addressMode: 'NEUTRAL'
                }, { history });
                if (!realization || !runtime.api.characterDialogueValidate(realization).ok) {
                    throw new Error(`Geçersiz kör değerlendirme sözü: ${actor.id}/${turn}`);
                }
                history.push(realization);
                utterances.push(realization);
            }
            speakerSamples.push({
                voiceCode,
                examples: utterances.slice(0, 4).map(row => row.text)
            });
            utterances.slice(4).forEach((row, index) => {
                const id = `KOR-${String(actorIndex * 8 + index + 1).padStart(2, '0')}`;
                evaluationItems.push({ id, text: row.text });
                answerKey[id] = {
                    voiceCode,
                    actorId: actor.id,
                    voiceFingerprint: row.voiceFingerprint,
                    intent: row.intent
                };
            });
        });
        const packet = {
            schemaVersion: SCHEMA_VERSION,
            kind: 'STORY_DIALOGUE_BLIND_VOICE_PACKET',
            seed,
            instructions: [
                'Önce SES-A/B/C örneklerini oku.',
                'Aşağıdaki her anonim cümleyi yalnız üslubuna göre bir ses koduyla eşleştir.',
                'İçerik doğruluğunu veya hangi cevabı sevdiğini değil konuşmacı tutarlılığını değerlendir.',
                'Cevap anahtarını değerlendirme bitene kadar açma.'
            ],
            voiceChoices: VOICE_CODES.slice(),
            speakerSamples,
            evaluationItems: shuffled(evaluationItems, seed),
            answerTemplate: shuffled(evaluationItems, seed).map(row => ({
                id: row.id, guessedVoiceCode: '', confidence: 0
            }))
        };
        const key = {
            schemaVersion: SCHEMA_VERSION,
            kind: 'STORY_DIALOGUE_BLIND_VOICE_KEY',
            seed,
            answerKey,
            acceptance: {
                minimumAccuracyBps: 6500,
                minimumPerVoiceAccuracyBps: 5000,
                minimumAnsweredItems: evaluationItems.length
            }
        };
        return { packet, key };
    } finally {
        runtime.dom.window.close();
    }
}

function scoreRows(answers, key) {
    const rows = Array.isArray(answers) ? answers : answers.answers || answers.answerTemplate || [];
    const byVoice = Object.fromEntries(VOICE_CODES.map(code => [code, { correct: 0, total: 0 }]));
    let correct = 0;
    let answered = 0;
    const invalid = [];
    for (const row of rows) {
        const expected = key.answerKey && key.answerKey[row.id];
        if (!expected || !VOICE_CODES.includes(row.guessedVoiceCode)) {
            invalid.push(row.id || null);
            continue;
        }
        answered++;
        byVoice[expected.voiceCode].total++;
        if (row.guessedVoiceCode === expected.voiceCode) {
            correct++;
            byVoice[expected.voiceCode].correct++;
        }
    }
    const accuracyBps = answered ? Math.round(correct * 10000 / answered) : 0;
    const perVoice = Object.fromEntries(Object.entries(byVoice).map(([code, value]) => [code, Object.assign({}, value, {
        accuracyBps: value.total ? Math.round(value.correct * 10000 / value.total) : 0
    })]));
    const acceptance = key.acceptance || {};
    const complete = answered >= Number(acceptance.minimumAnsweredItems || 0);
    const pass = complete
        && accuracyBps >= Number(acceptance.minimumAccuracyBps || 6500)
        && Object.values(perVoice).every(row => row.accuracyBps >= Number(acceptance.minimumPerVoiceAccuracyBps || 5000));
    return { schemaVersion: 1, kind: 'STORY_DIALOGUE_BLIND_VOICE_SCORE', answered, correct,
        invalid, accuracyBps, perVoice, complete, pass };
}

function scoreAnswers(answerPath, keyPath) {
    const answers = JSON.parse(fs.readFileSync(answerPath, 'utf8'));
    const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    return scoreRows(answers, key);
}

function main() {
    const args = process.argv.slice(2);
    const scoreIndex = args.indexOf('--score');
    const outputDir = path.resolve(__dirname, '..', 'qa-runtime', 'story-dialogue-blind-phase38.2');
    const packetPath = path.join(outputDir, 'blind-packet.json');
    const keyPath = path.join(outputDir, 'blind-answer-key.json');
    if (scoreIndex >= 0) {
        const answerPath = args[scoreIndex + 1];
        if (!answerPath) throw new Error('--score için cevap JSON yolu gerekli.');
        const report = scoreAnswers(path.resolve(answerPath), keyPath);
        fs.mkdirSync(outputDir, { recursive: true });
        fs.writeFileSync(path.join(outputDir, 'blind-score.json'), `${JSON.stringify(report, null, 2)}\n`);
        console.log(JSON.stringify(report));
        process.exitCode = report.pass ? 0 : 2;
        return;
    }
    const built = buildPacket(DEFAULT_SEED);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(packetPath, `${JSON.stringify(built.packet, null, 2)}\n`);
    fs.writeFileSync(keyPath, `${JSON.stringify(built.key, null, 2)}\n`);
    console.log(JSON.stringify({
        packetPath, keyPath,
        voices: built.packet.speakerSamples.length,
        trainingExamples: built.packet.speakerSamples.reduce((sum, row) => sum + row.examples.length, 0),
        evaluationItems: built.packet.evaluationItems.length,
        scored: false
    }));
}

if (require.main === module) main();

module.exports = { buildPacket, scoreRows, scoreAnswers };
