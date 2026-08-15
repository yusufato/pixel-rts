'use strict';

const assert = require('node:assert/strict');
const review = require('../tools/story-semantic-review-server');

const queue = { rows: [{ id: 'semantic-teacher:0001' }] };
const axes = ['communicativeFunction', 'surfaceForm', 'predicate'];
assert.equal(review.validateReview({ id: 'semantic-teacher:0001', verdict: 'ACCEPT',
    approvedAxes: axes, notes: 'Doğal.' }, queue).ok, true);
assert.equal(review.validateReview({ id: 'semantic-teacher:0001', verdict: 'ACCEPT',
    approvedAxes: ['predicate'] }, queue).code, 'CORE_AXES_REQUIRED');
assert.equal(review.validateReview({ id: 'semantic-teacher:9999', verdict: 'REJECT',
    approvedAxes: [] }, queue).code, 'UNKNOWN_ID');
assert.equal(review.validateReview({ id: 'semantic-teacher:0001', verdict: 'EDIT',
    correctedUtterance: '', approvedAxes: axes }, queue).code, 'EDIT_TEXT_REQUIRED');

console.log('Story semantic review server test passed.');
