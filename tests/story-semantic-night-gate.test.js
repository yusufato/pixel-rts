'use strict';

const assert = require('node:assert/strict');
const { evaluateNightGate } = require('../tools/story-semantic-night-gate');
const axes = ['communicativeFunction', 'surfaceForm', 'predicate'];
const reviews = Array.from({ length: 40 }, (_, index) => ({ id: String(index), verdict: 'ACCEPT',
    uiContractVersion: 2, approvedAxes: axes }));
const adjudications = reviews.map(row => ({ id: row.id, verdict: 'ACCEPT_CORE', approvedAxes: axes }));
const passing = evaluateNightGate({ reviews, adjudications, heldout: { total: 20, coreAccuracy: 0.85,
    evidenceAccuracy: 0.95, falseHighConfidenceRate: 0.02, naturalTurkishRate: 0.90 } });
assert.equal(passing.ok, true);
assert.equal(passing.decision, 'NIGHT_TEST_READY');
const blocked = evaluateNightGate({ reviews: reviews.slice(0, 39), adjudications, heldout: { total: 20,
    coreAccuracy: 0.99, evidenceAccuracy: 0.99, falseHighConfidenceRate: 0, naturalTurkishRate: 1 } });
assert.equal(blocked.ok, false);
assert.ok(blocked.checks.some(row => row.id === 'GOLD_ACCEPTED_40' && !row.pass));
console.log('Story semantic night gate test passed.');
