'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createRuntime } = require('./story-sim-harness');
const { auditCorpus } = require('./story-dialogue-hard-assertion-audit');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_INPUT = path.join(ROOT, 'qa-runtime', 'story-dialogue-corpus-s0.json');
const DEFAULT_OUTPUT = path.join(ROOT, 'qa-runtime', 'story-dialogue-current-replay.json');
const SERVICE_BOT = /nasıl yardımcı olabilirim|ne tür bir yardım|talebinizi belirt|konuyu belirt|daha fazla bilgi ver|buyurun|emrinize amadeyim/i;

function groupCases(cases) {
    const groups = new Map();
    for (const row of cases || []) {
        if (!groups.has(row.conversationGroupId)) groups.set(row.conversationGroupId, []);
        groups.get(row.conversationGroupId).push(row);
    }
    for (const rows of groups.values()) rows.sort((a, b) => a.turnIndex - b.turnIndex);
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

function replayCorpus(corpus, seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1,
            doctrine: 'combined', fog: true });
        const directory = runtime.api.contactDirectoryBuild();
        const actors = (directory.publicCharacters || []).filter(row =>
            row.id !== directory.playerActorId);
        const byRole = new Map();
        actors.forEach(row => { if (!byRole.has(row.role)) byRole.set(row.role, row); });
        const replayed = [];
        const skipped = [];
        for (const [groupId, rows] of groupCases(corpus.cases)) {
            const role = rows[0] && rows[0].listener && rows[0].listener.role;
            const actor = byRole.get(role) || actors[0];
            if (!actor || !rows.length) {
                skipped.push({ groupId, reason: 'ROLE_ACTOR_UNAVAILABLE', role });
                continue;
            }
            const opened = runtime.api.conversationSessionBegin(rows[0].playerText, {
                listenerActorId: actor.id
            });
            const opening = opened && opened.session && opened.session.listenerResponses
                && opened.session.listenerResponses[0];
            if (!opened || !opened.ok || !opening) {
                skipped.push({ groupId, reason: opened && opened.code || 'OPENING_RESPONSE_UNAVAILABLE', role });
                continue;
            }
            const push = (source, response) => replayed.push(Object.assign({}, source, {
                history: [],
                observed: Object.assign({}, source.observed, {
                    baselineReply: response.text, visibleReply: response.text,
                    speechAct: response.speechAct || '', discourseAct: response.discourseAct || '',
                    source: response.source, enrichmentStatus: response.enrichmentStatus,
                    llmUsed: false, labelStatus: 'CURRENT_REPLAY_NOT_GOLD'
                }),
                qualityFlags: {
                    serviceBotLanguage: SERVICE_BOT.test(response.text || ''),
                    unknownWall: response.discourseAct === 'CLARIFY_UNKNOWN_WITHOUT_FAKE_CONTINUITY',
                    exactPreviousReply: false, emptyReply: !String(response.text || '').trim()
                }
            }));
            push(rows[0], opening);
            let stopped = false;
            for (const source of rows.slice(1)) {
                const result = runtime.api.conversationSessionFollowUp(opened.session.id, source.playerText);
                const response = result && result.followUp && result.followUp.response;
                if (!result || !result.ok || !response) {
                    skipped.push({ groupId, turnIndex: source.turnIndex,
                        reason: result && result.code || 'FOLLOW_UP_RESPONSE_UNAVAILABLE', role });
                    stopped = true; break;
                }
                push(source, response);
            }
            if (stopped) continue;
        }
        const audit = auditCorpus({ manifestChecksum: corpus.manifestChecksum, cases: replayed });
        return {
            schemaVersion: 1, kind: 'STORY_DIALOGUE_CURRENT_REPLAY', seed,
            sourceCorpusChecksum: corpus.manifestChecksum || null,
            sourceCaseCount: (corpus.cases || []).length,
            replayedCaseCount: replayed.length,
            skippedCaseCount: skipped.length,
            completeCoverage: replayed.length === (corpus.cases || []).length && skipped.length === 0,
            hardFindingCount: audit.hardFindingCount,
            qualityFindingCount: audit.qualityFindingCount,
            counts: audit.counts, skipped, findings: audit.findings
        };
    } finally {
        runtime.dom.window.close();
    }
}

function main(argv = process.argv.slice(2)) {
    const input = path.resolve(argv[0] || DEFAULT_INPUT);
    const output = path.resolve(argv[1] || DEFAULT_OUTPUT);
    const report = replayCorpus(JSON.parse(fs.readFileSync(input, 'utf8')),
        Number(argv[2]) || 2032);
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report;
}

if (require.main === module) main();
module.exports = { replayCorpus, groupCases };
