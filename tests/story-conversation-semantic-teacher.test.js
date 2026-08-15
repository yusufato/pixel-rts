'use strict';

const assert = require('node:assert');
const teacher = require('../tools/story-conversation-semantic-teacher');

const manifestA = teacher.buildManifest(24);
const manifestB = teacher.buildManifest(24);
assert.deepStrictEqual(manifestA, manifestB, 'teacher curriculum must be deterministic');
assert.strictEqual(new Set(manifestA.map(row => JSON.stringify(row.target))).size,
    teacher.BASE_TARGETS.length, 'curriculum must cover every base composition');
assert.strictEqual(teacher.parseUtterance('{"utterance":"Yarın bana bir görev verir misiniz?"}'),
    'Yarın bana bir görev verir misiniz?');
assert.strictEqual(teacher.parseUtterance('{"utterance":"predicate: WORK"}'), null,
    'label leakage must be rejected');
const target = manifestA[0].target;
assert.strictEqual(teacher.compareFrame(target, Object.assign({}, target)).accepted, true);
assert.strictEqual(teacher.compareFrame(target, Object.assign({}, target, { predicate: 'WORK' })).accepted, false);
const partial = teacher.compareFrame(target, Object.assign({}, target, { target: 'PLAYER_AND_LISTENER' }));
assert.strictEqual(partial.accepted, true, 'non-core disagreement must be masked, not poison core labels');
assert.strictEqual(partial.exactAccepted, false);
assert.ok(partial.maskedAxes.includes('target'));

console.log(`Story semantic teacher test passed: ${manifestA.length} deterministic tasks, ${teacher.BASE_TARGETS.length} compositions.`);
