'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const reportArg = process.argv.find(row => row.startsWith('--report='));
const reportPath = path.resolve(reportArg ? reportArg.slice(9)
    : path.join(ROOT, 'qa-runtime', 'story-dialogue-8b-battery-report.json'));

function normalize(value) {
    return String(value || '').toLocaleLowerCase('tr-TR')
        .replace(/[^a-zçğıöşü0-9]+/giu, ' ').trim();
}

function increment(map, key, sample) {
    const current = map.get(key) || { count: 0, sample };
    current.count += 1; map.set(key, current);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const turns = Array.isArray(report.turns) ? report.turns : [];
const accepted = turns.filter(row => row.accepted === true && row.acceptedReply);
const replyCounts = new Map();
const promptReplyCounts = new Map();
const conversationTexts = new Map();

for (const row of accepted) {
    const reply = normalize(row.acceptedReply);
    increment(replyCounts, reply, row.acceptedReply);
    increment(promptReplyCounts, `${normalize(row.playerText)}\u0000${reply}`,
        { playerText: row.playerText, reply: row.acceptedReply });
}
for (const row of turns) {
    if (!row.groupId || row.playerText == null) continue;
    const list = conversationTexts.get(row.groupId) || [];
    list.push(String(row.playerText)); conversationTexts.set(row.groupId, list);
}

const conversationSignatures = new Map();
for (const [groupId, texts] of conversationTexts) {
    increment(conversationSignatures, texts.map(normalize).join('\u001f'), { groupId, texts });
}
const repeatedReplies = [...replyCounts.values()].filter(row => row.count > 1)
    .sort((a, b) => b.count - a.count);
const repeatedPromptReplies = [...promptReplyCounts.values()].filter(row => row.count > 1)
    .sort((a, b) => b.count - a.count);
const repeatedConversations = [...conversationSignatures.values()].filter(row => row.count > 1)
    .sort((a, b) => b.count - a.count);

const audit = {
    schemaVersion: 1, kind: 'STORY_DIALOGUE_8B_AUDIT', reportPath,
    reportStatus: report.status || null, turns: turns.length,
    conversations: conversationTexts.size,
    uniqueConversationTexts: conversationSignatures.size,
    repeatedConversationInstances: repeatedConversations.reduce((sum, row) => sum + row.count - 1, 0),
    acceptedReplies: accepted.length, uniqueAcceptedReplies: replyCounts.size,
    exactRepeatedAcceptedInstances: repeatedReplies.reduce((sum, row) => sum + row.count - 1, 0),
    repeatedSamePromptReplyInstances: repeatedPromptReplies.reduce((sum, row) => sum + row.count - 1, 0),
    topRepeatedConversations: repeatedConversations.slice(0, 10),
    topRepeatedAcceptedReplies: repeatedReplies.slice(0, 15),
    topRepeatedPromptReplies: repeatedPromptReplies.slice(0, 15)
};

process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
