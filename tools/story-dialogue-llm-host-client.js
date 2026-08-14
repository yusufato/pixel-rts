'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { fork } = require('node:child_process');

function createLlmHostClient(options) {
    const root = path.resolve(options.root);
    const modelPath = path.resolve(options.modelPath);
    const contextSize = Math.max(512, Math.floor(Number(options.contextSize) || 8192));
    const electronNodePath = options.electronNodePath
        ? path.resolve(options.electronNodePath)
        : path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
    const useElectronRuntime = fs.existsSync(electronNodePath);
    const child = fork(path.join(root, 'electron', 'llm-host.js'), [], {
        cwd: root, stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
        execPath: useElectronRuntime ? electronNodePath : process.execPath,
        env: Object.assign({}, process.env,
            useElectronRuntime ? { ELECTRON_RUN_AS_NODE: '1' } : {})
    });
    let sequence = 0;
    let backend = 'unknown';
    let backendDiagnostics = [];
    let backendDevices = [];
    let backendVram = null;
    let stopped = false;
    const pending = new Map();
    const rejectPending = error => {
        for (const item of pending.values()) {
            clearTimeout(item.timer); item.reject(error);
        }
        pending.clear();
    };
    child.on('message', message => {
        if (!message) return;
        if (message.t === 'backend') {
            backend = message.gpu || 'cpu';
            backendDiagnostics = Array.isArray(message.diagnostics) ? message.diagnostics : [];
            backendDevices = Array.isArray(message.devices) ? message.devices.slice() : [];
            backendVram = message.vram && typeof message.vram === 'object'
                ? Object.assign({}, message.vram) : null;
            return;
        }
        if (message.t === 'chunk') {
            const item = pending.get(message.id);
            if (item && item.firstTokenMs == null) item.firstTokenMs = performance.now() - item.started;
            return;
        }
        if (!['gen', 'count'].includes(message.t)) return;
        const item = pending.get(message.id);
        if (!item) return;
        pending.delete(message.id); clearTimeout(item.timer);
        if (item.firstTokenMs != null) message.firstTokenMs = item.firstTokenMs;
        if (message.error) item.reject(new Error(message.error));
        else item.resolve(message);
    });
    child.on('exit', (code, signal) => {
        stopped = true;
        rejectPending(new Error(`LLM_HOST_EXIT:${code == null ? signal : code}`));
    });
    const request = payload => new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => {
            pending.delete(id); reject(new Error('LLM_TIMEOUT'));
            try { child.kill(); } catch (_) {}
        }, Math.max(1000, Number(options.generationTimeoutMs) || 90000));
        pending.set(id, { resolve, reject, timer, started: performance.now(), firstTokenMs: null });
        child.send(Object.assign({}, payload, { id }));
    });
    const stopAndWait = () => new Promise(resolve => {
        if (stopped) { resolve(); return; }
        let settled = false;
        let killer;
        let deadline;
        const finish = () => {
            if (settled) return;
            settled = true;
            clearTimeout(killer); clearTimeout(deadline); resolve();
        };
        child.once('exit', finish);
        try { child.send({ t: 'stop' }); } catch (_) { try { child.kill(); } catch (_) {} }
        killer = setTimeout(() => { try { child.kill(); } catch (_) {} }, 5000);
        deadline = setTimeout(finish, 10000);
        if (killer.unref) killer.unref();
        if (deadline.unref) deadline.unref();
    });
    const loadOrProbe = probeOnly => new Promise((resolve, reject) => {
        const started = performance.now();
        const timer = setTimeout(() => reject(new Error(probeOnly
            ? 'GPU_PROBE_TIMEOUT' : 'MODEL_LOAD_TIMEOUT')),
        Math.max(1000, Number(options.loadTimeoutMs) || 180000));
        const listener = message => {
            if (message && message.t === 'loaded') {
                clearTimeout(timer); child.off('message', listener);
                resolve({ loadMs: performance.now() - started, backend,
                    devices: backendDevices.slice(), vram: backendVram && Object.assign({}, backendVram) });
            } else if (message && message.t === 'error') {
                clearTimeout(timer); child.off('message', listener); reject(new Error(message.error));
            }
        };
        child.on('message', listener);
        child.send({ t: 'load', modelPath, gpuLayers: options.gpuLayers || 'auto', contextSize,
            requireDiscreteGpu: options.requireDiscreteGpu === true, probeOnly });
    });
    return {
        load: () => loadOrProbe(false),
        probe: () => loadOrProbe(true),
        backend: () => backend,
        backendDiagnostics: () => backendDiagnostics.slice(),
        backendDevices: () => backendDevices.slice(),
        backendVram: () => backendVram && Object.assign({}, backendVram),
        runtime: () => useElectronRuntime ? 'electron-node' : 'system-node',
        count: async text => Number((await request({ t: 'count', text })).tokens),
        generate: async input => {
            const started = performance.now();
            const message = await request(Object.assign({ t: 'gen', metrics: true }, input));
            return { raw: String(message.text || ''), totalMs: performance.now() - started,
                firstTokenMs: Number.isFinite(message.firstTokenMs) ? message.firstTokenMs : null,
                generatedTokens: Number(message.generatedTokens) || 0, memory: message.memory || null };
        },
        stopAndWait,
        stop: () => { void stopAndWait(); }
    };
}

module.exports = { createLlmHostClient };
