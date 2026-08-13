'use strict';

const assert = require('node:assert/strict');
const {
    storyDiscourseStateCreate, storyDiscourseStateApply, storyDiscourseStateValidate
} = require('../js/StoryDiscourseState');

let state = storyDiscourseStateCreate('conversation-session:test', { topic: 'COMMERCE' });
state = storyDiscourseStateApply(state, {
    turnId: 'conversation-turn:conversation-session:test:1',
    playerText: 'Bugün nasılsın?', analysis: { topic: 'SOCIAL', speechAct: 'CHECK_IN' },
    response: { discourseAct: 'CHECK_IN', text: 'İyiyim.' }
});
assert.equal(state.activeTopic, 'COMMERCE', 'sosyal ara söz aktif ticari konuyu silmemeli');

state = storyDiscourseStateApply(state, {
    turnId: 'conversation-turn:conversation-session:test:2',
    playerText: 'Anlamadım.', analysis: { topic: 'GENERAL', speechAct: 'UNKNOWN' },
    response: { discourseAct: 'REPAIR_MISUNDERSTANDING', text: 'Hangi cümleyi açıklayayım?' }
});
assert.equal(state.repairChain.length, 1);
assert.equal(state.repairChain[0].repairOfTurnId,
    'conversation-turn:conversation-session:test:1');
assert.equal(state.answerDebts.filter(row => row.status === 'OPEN').length, 1);

state = storyDiscourseStateApply(state, {
    turnId: 'conversation-turn:conversation-session:test:3',
    playerText: 'Bu şirket için 1000 dinarım var.',
    analysis: { topic: 'GENERAL', speechAct: 'UNKNOWN', playerIntent: 'UNSPECIFIED',
        claims: [{ id: 'claim:budget:1', type: 'PLAYER_REPORTED_BUDGET' }] },
    response: { discourseAct: 'ACKNOWLEDGE_UNVERIFIED_BUDGET', text: 'Bunu doğrulayamıyorum.' }
});
assert.equal(state.answerDebts[0].status, 'ANSWERED');
assert.equal(state.answerDebts[0].answeredByTurnId,
    'conversation-turn:conversation-session:test:3');
assert.equal(storyDiscourseStateValidate(state).ok, true);

state = storyDiscourseStateApply(state, {
    turnId: 'conversation-turn:conversation-session:test:4',
    playerText: 'Halep çevresinde düşman var.',
    analysis: { topic: 'MILITARY', speechAct: 'REQUEST_ACTION', playerIntent: 'UNSPECIFIED',
        claims: [{ id: 'claim:threat:1', type: 'PLAYER_REPORTED_MILITARY_THREAT',
            truthStatus: 'UNVERIFIED_PLAYER_REPORT' }] },
    response: { discourseAct: 'REQUEST_ACTION', text: 'Bunu doğrulamam gerekir.' }
});
state = storyDiscourseStateApply(state, {
    turnId: 'conversation-turn:conversation-session:test:5',
    playerText: 'Onu demiyorum, Halep iddiamı geri çekiyorum.',
    analysis: { topic: 'GENERAL', speechAct: 'UNKNOWN', playerIntent: 'UNSPECIFIED' },
    response: { discourseAct: 'CLARIFY_UNKNOWN_WITHOUT_FAKE_CONTINUITY', text: 'Düzeltmeni kaydediyorum.' }
});
assert.equal(state.claimPositions.find(row => row.claimId === 'claim:threat:1').status,
    'CORRECTED_BY_PLAYER');
assert.equal(state.repairChain.at(-1).repairOfTurnId,
    'conversation-turn:conversation-session:test:4');

state = storyDiscourseStateApply(state, {
    turnId: 'conversation-turn:conversation-session:test:6',
    playerText: 'Önceki konuya dönelim.',
    analysis: { topic: 'GENERAL', speechAct: 'UNKNOWN', playerIntent: 'UNSPECIFIED' },
    response: { discourseAct: 'ACKNOWLEDGE_AND_HOLD_CONTEXT', text: 'Önceki konuya dönüyorum.' }
});
assert.equal(state.activeTopic, 'COMMERCE');

const broken = JSON.parse(JSON.stringify(state));
broken.answerDebts[0].questionId = 'missing-question';
assert.ok(storyDiscourseStateValidate(broken).issues.some(row => row.code === 'ANSWER_DEBT'));
assert.equal(state.worldMutation, false);
process.stdout.write(`${JSON.stringify({ ok: true, revision: state.revision,
    activeTopic: state.activeTopic, repairs: state.repairChain.length })}\n`);
