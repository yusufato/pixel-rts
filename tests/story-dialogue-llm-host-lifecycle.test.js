'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { fork } = require('node:child_process');

const child = fork(path.join(__dirname, '..', 'electron', 'llm-host.js'), [], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc']
});
const timeout = setTimeout(() => {
    try { child.kill(); } catch (_) {}
    throw new Error('LLM_HOST_DISCONNECT_EXIT_TIMEOUT');
}, 5000);
child.once('spawn', () => child.disconnect());
child.once('exit', (code, signal) => {
    clearTimeout(timeout);
    assert.equal(signal, null);
    assert.equal(code, 0);
    process.stdout.write(`${JSON.stringify({ ok: true, disconnectExit: true })}\n`);
});
