'use strict';

const assert = require('node:assert/strict');
const suite = require('../tools/story-dialogue-night-continuation');
const plan = suite.plan();
assert.equal(plan.calibration.turns, 1000);
assert.equal(plan.calibration.sessions, 25);
assert.equal(plan.calibration.depth, 40);
assert.equal(plan.longContext.turns, 1500);
assert.equal(plan.longContext.depth, 50);
assert.equal(plan.totalTurns, 2500);
assert.equal(plan.policy, 'MEASUREMENT_ONLY_NO_TRAINING');
assert.equal(suite.validCompletedReport(__filename), false);
assert.equal(suite.completedReportValid({ sessions: [{}], summary: {} }), false,
    'Eski rapor altyapı sayacı yokken yeni uzun koşuyu tetiklememeli.');
assert.equal(suite.completedReportValid({ sessions: [{}], summary: { infrastructureErrors: 1 } }), false);
assert.equal(suite.completedReportValid({ sessions: [{}], summary: { infrastructureErrors: 0 } }), true);
console.log('Story dialogue night continuation test passed.');
