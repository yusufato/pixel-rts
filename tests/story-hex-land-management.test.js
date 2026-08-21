const assert = require('assert');
const land = require('../js/StoryHexLandManagement.js');

const root = {};
global.STORY = { clock: 12.5, year: 2032 };
const forest = { kind: 'HEX', cellId: 'hex:4:7', cellIndex: 22,
    regionId: 'region:2', cover: 'FOREST', resource: 'NONE' };
const labels = land.storyHexLandManagementOptions(forest).map(row => row.actionType);
assert(labels.includes('FORESTRY_SURVEY'));
assert(labels.includes('CLEARING_ASSESSMENT'));
assert(!labels.includes('AGRICULTURE_SURVEY'));
const opened = land.storyHexLandManagementSubmit({ ...forest,
    actionType: 'FORESTRY_SURVEY' }, root);
assert.strictEqual(opened.ok, true);
assert.strictEqual(opened.record.status, 'OPEN');
assert.strictEqual(land.storyHexLandManagementRecords(forest.cellId, root).length, 1);
const duplicate = land.storyHexLandManagementSubmit({ ...forest,
    actionType: 'FORESTRY_SURVEY' }, root);
assert.strictEqual(duplicate.ok, false);
assert.strictEqual(duplicate.code, 'LAND_ACTION_ALREADY_OPEN');
const deposit = { kind: 'HEX', cover: 'MOUNTAIN', resource: 'MINERAL' };
assert(land.storyHexLandManagementOptions(deposit)
    .some(row => row.actionType === 'GEOLOGICAL_SURVEY'));
console.log('STORY_HEX_LAND_MANAGEMENT_OK');
