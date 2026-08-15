'use strict';

const assert = require('node:assert/strict');
const quality = require('../tools/story-conversation-semantic-quality');

assert.deepEqual(quality.parseQuality(JSON.stringify({ naturalTurkish: true,
    singleDominantIntent: true, evidenceFaithful: true, issues: ['NONE'], reason: 'Doğal ve tutarlı.' })), {
    naturalTurkish: true, singleDominantIntent: true, evidenceFaithful: true,
    issues: ['NONE'], reason: 'Doğal ve tutarlı.'
});
assert.equal(quality.parseQuality(JSON.stringify({ naturalTurkish: false,
    singleDominantIntent: true, evidenceFaithful: true, issues: ['NONE'], reason: 'Çelişkili.' })), null);
assert.equal(quality.parseQuality(JSON.stringify({ naturalTurkish: true,
    singleDominantIntent: true, evidenceFaithful: true, issues: ['AWKWARD_TURKISH'], reason: 'Çelişkili.' })), null);
assert.equal(quality.parseQuality('{"naturalTurkish":true,"worldMutation":true}'), null);

console.log('Story semantic quality critic test passed.');
