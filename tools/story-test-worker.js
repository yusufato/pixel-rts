'use strict';

const fs = require('node:fs');
const path = require('node:path');
const v8 = require('node:v8');
const harness = require('./story-sim-harness');

let active = false;

function send(message) {
    if (typeof process.send === 'function' && process.connected) process.send(message);
}

async function execute(message) {
    if (active) throw new Error('Worker received overlapping tasks.');
    active = true;
    const started = process.hrtime.bigint();
    try {
        const fn = harness[message.fn];
        if (typeof fn !== 'function') throw new Error(`Unknown story test task function: ${message.fn}`);
        const result = await fn(...(Array.isArray(message.args) ? message.args : []));
        for (const path of (message.requiredTrue || [])) {
            const value = String(path).split('.').reduce((cursor, key) =>
                cursor == null ? undefined : cursor[key], result);
            if (value !== true) throw new Error(
                `${message.key}: required result ${path}=true, got ${JSON.stringify(value)}`
            );
        }
        const payload = v8.serialize(result);
        fs.writeFileSync(message.outputPath, payload);
        const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
        const memory = process.memoryUsage();
        // Büyük 900 sn sonuçlarında tam GC, yoğun CPU altında sonucu diske
        // yazdıktan sonra işçiyi dakikalarca kilitleyebiliyor. Sonucu önce
        // ana sürece bildir; büyük nesne grafı taşıyan işçiyi havuz yenilesin.
        send({
            type: 'done', taskId: message.taskId, key: message.key,
            elapsedMs, bytes: payload.length, memory,
            recycleRecommended: payload.length >= 8 * 1024 * 1024
        });
    } catch (error) {
        send({ type: 'error', taskId: message.taskId, key: message.key, error: { message: error.message, stack: error.stack } });
    } finally {
        active = false;
    }
}

process.on('message', message => {
    if (!message || message.type !== 'run') return;
    execute(message);
});

setInterval(() => {
    send({ type: 'heartbeat', active, memory: process.memoryUsage() });
}, 2000).unref();

send({ type: 'ready', pid: process.pid });
