'use strict';

const assert = require('node:assert/strict');
const { templates, targets, listenerRoles, buildManifest } = require('../tools/story-dialogue-8b-manifest');
assert.deepEqual(targets, { SHORT: 50, MEDIUM: 20, LONG: 10 });
assert.ok(templates.SHORT.every(row => row.length >= 3 && row.length <= 5));
assert.ok(templates.MEDIUM.every(row => row.length >= 6 && row.length <= 10));
assert.ok(templates.LONG.every(row => row.length >= 20));
assert.ok(Object.values(templates).flat().flat().every(row => typeof row === 'string' && row.trim()));
const first = buildManifest();
const second = buildManifest();
assert.equal(first.checksum, second.checksum);
assert.equal(first.scenarioCount, 80);
assert.equal(first.turnCount, 540);
assert.equal(new Set(first.scenarios.map(row => row.turns.join('\u001f'))).size, 80,
    '80 görüşmenin oyuncu metni gerçekten benzersiz olmalı');
assert.deepEqual(new Set(first.scenarios.map(row => row.listenerRole)), new Set(listenerRoles));
assert.ok(first.scenarios.every(row => row.listenerRole && row.seed));
process.stdout.write(`${JSON.stringify({ ok: true, scenarios: 80, unique: 80, roles: listenerRoles.length })}\n`);
