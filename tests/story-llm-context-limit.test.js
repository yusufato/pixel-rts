'use strict';

const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require.resolve('../js/LLM.js'), 'utf8');
const resolveStart = source.indexOf('async function llmResolveContextRequest');
const start = source.indexOf('function llmContextTokenDecision');
const end = source.indexOf('\nfunction ', start + 20);
assert.ok(resolveStart >= 0 && start > resolveStart && end > start);
const sandbox = {};
vm.runInNewContext(`${source.slice(resolveStart, end)}\nthis.decide=llmContextTokenDecision;`
    + '\nthis.resolve=llmResolveContextRequest;', sandbox);
assert.equal(sandbox.decide(7800, 220, 8192, 128).ok, true);
assert.equal(sandbox.decide(7900, 220, 8192, 128).ok, false);
assert.equal(sandbox.decide(null, 220, 8192, 128).ok, false);
assert.equal(sandbox.decide(12820, 220, 8192, 128).totalTokens, 13168);

(async () => {
    let countCalls = 0;
    let rebuildCalls = 0;
    const bridge = { tokenCount: async text => {
        countCalls++;
        return text.length > 100 ? 9000 : 500;
    } };
    const resolved = await sandbox.resolve(bridge, {
        system: 's', prompt: 'x'.repeat(200), maxTokens: 220
    }, {
        contextLimit: 8192, contextWrapperReserveTokens: 128, contextMaxRebuilds: 2,
        contextRebuildPrompt: async () => { rebuildCalls++; return 'kısa'; }
    });
    assert.equal(resolved.ok, true);
    assert.equal(resolved.rebuilds, 1);
    assert.equal(countCalls, 2);
    assert.equal(rebuildCalls, 1);

    const refused = await sandbox.resolve({ tokenCount: async () => 9000 }, {
        system: 's', prompt: 'uzun', maxTokens: 220
    }, { contextLimit: 8192, contextWrapperReserveTokens: 128, contextMaxRebuilds: 0 });
    assert.equal(refused.ok, false);
    process.stdout.write(`${JSON.stringify({ ok: true, overLimitRejected: true,
        controlledRebuilds: resolved.rebuilds })}\n`);
})().catch(error => { console.error(error); process.exitCode = 1; });
