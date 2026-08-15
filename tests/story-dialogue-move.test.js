'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
    STORY_DIALOGUE_MOVE_FORBIDDEN_COMMITMENTS,
    STORY_DIALOGUE_MOVE_ACT_CATALOG,
    storyDialogueMoveBuild,
    storyDialogueMoveValidate,
    storyDialogueMovePromptView
} = require('../js/StoryDialogueMove');

function fixture() {
    return {
        sessionId: 'conversation-session:12', sequence: 3,
        listenerActorId: 'character:red:commander:1', playerActorId: 'character:player',
        analysis: {
            speechAct: 'REQUEST_SUPPORT',
            claims: [{
                id: 'claim:threat:1', type: 'PLAYER_REPORTED_MILITARY_THREAT',
                truthStatus: 'UNVERIFIED_PLAYER_REPORT', regionIds: ['region:halep']
            }],
            entities: [{ entityId: 'region:halep', role: 'LOCATION' }]
        },
        response: {
            id: 'conversation-follow-up-response:12:3',
            discourseAct: 'ASSESS_UNVERIFIED_MILITARY_REQUEST',
            relationshipBand: 'RESERVED', worldMutation: false
        }
    };
}

function run() {
    const first = storyDialogueMoveBuild(fixture());
    const second = storyDialogueMoveBuild(fixture());
    assert.deepEqual(first, second, 'aynı girdiden aynı karar çıkmalı');
    assert.equal(storyDialogueMoveValidate(first).ok, true);
    assert.equal(first.worldCommand, null);
    assert.deepEqual(first.claimRefs, ['claim:threat:1']);
    assert.ok(first.allowedEntityIds.includes('region:halep'));
    assert.ok(first.requiredPoints.includes('PRESERVE_CLAIM_VERIFICATION_STATUS'));
    assert.ok(first.requiredPoints.includes('STATE_AUTHORITY_BOUNDARY'));
    assert.ok(STORY_DIALOGUE_MOVE_FORBIDDEN_COMMITMENTS.every(row =>
        first.forbiddenCommitments.includes(row)));

    const promptView = storyDialogueMovePromptView(first);
    assert.equal(promptView.moveId, first.moveId);
    assert.deepEqual(promptView.allowedRefs, ['claim:threat:1']);
    assert.equal(promptView.worldCommand, null);
    assert.equal(Object.hasOwn(promptView, 'reply'), false);

    const universe = {
        factRefs: [], beliefRefs: [], claimRefs: ['claim:threat:1'], memoryRefs: [],
        allowedEntityIds: ['character:player', 'character:red:commander:1', 'region:halep']
    };
    assert.equal(storyDialogueMoveValidate(first, universe).ok, true);

    const forgedRef = JSON.parse(JSON.stringify(first));
    forgedRef.beliefRefs.push('belief:hidden:war-plan');
    assert.ok(storyDialogueMoveValidate(forgedRef, universe).issues.some(row =>
        row.code === 'UNSOURCED_REF'));

    const forgedCommand = JSON.parse(JSON.stringify(first));
    forgedCommand.worldCommand = { type: 'MOVE_ARMY' };
    assert.ok(storyDialogueMoveValidate(forgedCommand).issues.some(row =>
        row.code === 'WORLD_COMMAND'));

    const forgedPromise = JSON.parse(JSON.stringify(first));
    forgedPromise.forbiddenCommitments = ['WORLD_MUTATION'];
    assert.ok(storyDialogueMoveValidate(forgedPromise).issues.some(row =>
        row.code === 'FORBIDDEN_COMMITMENTS'));

    const memoryMove = storyDialogueMoveBuild({
        sessionId: 'conversation-session:13', sequence: 2,
        listenerActorId: 'character:executive:1', playerActorId: 'character:player',
        analysis: { speechAct: 'ASK_INFORMATION', claims: [], entities: [] },
        response: {
            id: 'conversation-follow-up-response:13:2', discourseAct: 'RECALL_HELD_MEMORY',
            memoryRecall: { records: [{ id: 'memory:promise:1' }] }, worldMutation: false
        }
    });
    assert.deepEqual(memoryMove.memoryRefs, ['memory:promise:1']);
    assert.ok(memoryMove.requiredPoints.includes('CITE_ONLY_HELD_MEMORY'));

    const noFactQuestion = storyDialogueMoveBuild({
        sessionId: 'conversation-session:no-fact', sequence: 1,
        analysis: { speechAct: 'ASK_INFORMATION', claims: [], entities: [] },
        response: { id: 'response:no-fact', relationshipBand: 'RESERVED' },
        factRefs: [], listenerActorId: 'character:0:1', playerActorId: 'character:0:player'
    });
    assert.ok(noFactQuestion.requiredPoints.includes('STATE_MISSING_VERIFIED_RECORD_DIRECTLY'));
    assert.ok(noFactQuestion.requiredPoints.includes('DO_NOT_REPLY_WITH_A_QUESTION'));
    assert.equal(storyDialogueMoveValidate(memoryMove).ok, true);
    assert.equal(memoryMove.sourcePolicyId, 'ACTOR_HELD_MEMORY_ONLY');

    const unrelated = storyDialogueMoveBuild({
        sessionId: 'conversation-session:14', sequence: 5,
        listenerActorId: 'character:executive:1', playerActorId: 'character:player',
        inheritedClaims: fixture().analysis.claims,
        analysis: { speechAct: 'CHECK_IN', claims: [], entities: [] },
        response: { id: 'response:14:5', discourseAct: 'CHECK_IN', worldMutation: false }
    });
    assert.deepEqual(unrelated.claimRefs, [], 'eski ilgisiz iddia yeni günlük cevaba taşınmamalı');

    const source = fs.readFileSync(path.join(__dirname, '..', 'js',
        'StoryConversationUnderstanding.js'), 'utf8');
    const groundedActs = Array.from(source.matchAll(/discourseAct:\s*'([A-Z0-9_]+)'/g),
        match => match[1]);
    const missingActs = Array.from(new Set(groundedActs)).filter(act =>
        !Object.hasOwn(STORY_DIALOGUE_MOVE_ACT_CATALOG, act));
    assert.deepEqual(missingActs, [], 'kaynakta kullanılan her deterministik eylem kapalı katalogda olmalı');

    const unknownAct = storyDialogueMoveBuild({
        sessionId: 'conversation-session:15', sequence: 1,
        analysis: { speechAct: 'UNKNOWN', claims: [], entities: [] },
        response: { id: 'response:15:1', discourseAct: 'FUTURE_UNREGISTERED_ACT' }
    });
    assert.ok(storyDialogueMoveValidate(unknownAct).issues.some(row =>
        row.code === 'ACT_NOT_REGISTERED'));

    process.stdout.write(`${JSON.stringify({ ok: true, moveId: first.moveId, checks: 23,
        catalogActs: Object.keys(STORY_DIALOGUE_MOVE_ACT_CATALOG).length })}\n`);
}

run();
