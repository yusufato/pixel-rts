'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const v8 = require('node:v8');
const { fork, spawn } = require('node:child_process');
const { STORY_TEST_TASKS } = require('./story-test-manifest');

const ROOT = path.resolve(__dirname, '..');
const WORKER_FILE = path.join(__dirname, 'story-test-worker.js');
const TEST_FILE = path.join(ROOT, 'tests', 'story-world.test.js');
const TIMING_FILE = path.join(ROOT, 'qa-runtime', 'story-test-timings.json');

function argValue(name) {
    const direct = process.argv.find(arg => arg.startsWith(`${name}=`));
    if (direct) return direct.slice(name.length + 1);
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : null;
}
function bytesGiB(value) { return Math.round(Number(value) / 1024 / 1024 / 1024 * 10) / 10; }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function cpuSnapshot() {
    return os.cpus().map(cpu => ({ ...cpu.times }));
}
async function cpuBusyPercent() {
    const before = cpuSnapshot();
    await sleep(500);
    const after = cpuSnapshot();
    let idle = 0;
    let total = 0;
    for (let index = 0; index < after.length; index++) {
        const keys = Object.keys(after[index]);
        for (const key of keys) {
            const delta = after[index][key] - before[index][key];
            total += delta;
            if (key === 'idle') idle += delta;
        }
    }
    return total > 0 ? Math.max(0, Math.min(100, Math.round((1 - idle / total) * 100))) : 0;
}
function loadTimings() {
    try { return JSON.parse(fs.readFileSync(TIMING_FILE, 'utf8')); } catch (_) { return {}; }
}
function saveTimings(timings) {
    fs.mkdirSync(path.dirname(TIMING_FILE), { recursive: true });
    fs.writeFileSync(TIMING_FILE, `${JSON.stringify(timings, null, 2)}\n`);
}
function determineWorkerCount(cpuBusy) {
    const explicitRaw = argValue('--workers') || process.env.STORY_TEST_WORKERS;
    const explicit = explicitRaw == null || explicitRaw === 'auto' ? null : Math.max(1, Number(explicitRaw) || 1);
    const logical = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
    const reserveBytes = Math.max(2.5 * 1024 ** 3, Number(process.env.STORY_TEST_RESERVE_MB || 3072) * 1024 ** 2);
    const perWorkerBytes = Math.max(1024, Number(process.env.STORY_TEST_WORKER_MB || 2200)) * 1024 ** 2;
    const memoryCap = Math.max(1, Math.floor(Math.max(0, os.freemem() - reserveBytes) / perWorkerBytes));
    const cpuCap = Math.max(1, logical - 1);
    let automatic = Math.max(1, Math.min(10, memoryCap, cpuCap));
    if (cpuBusy >= 85) automatic = 1;
    else if (cpuBusy >= 70) automatic = Math.min(automatic, 2);
    return {
        count: explicit == null ? automatic : Math.min(explicit, cpuCap),
        explicit: explicit != null,
        logical, memoryCap, reserveBytes, perWorkerBytes
    };
}

async function runAssertions(resultsDir) {
    return new Promise(resolve => {
        const child = spawn(process.execPath, ['--max-old-space-size=8192', '--expose-gc', TEST_FILE], {
            cwd: ROOT,
            stdio: 'inherit',
            env: { ...process.env, STORY_TEST_RESULTS_DIR: resultsDir, STORY_TEST_PARALLEL_ASSERTION: '1' }
        });
        child.on('exit', code => resolve(code == null ? 1 : code));
        child.on('error', error => { console.error(error.stack || error); resolve(1); });
    });
}

async function main() {
    const started = Date.now();
    const cpuBusy = await cpuBusyPercent();
    const config = determineWorkerCount(cpuBusy);
    const keep = process.argv.includes('--keep-results');
    const requestedTask = argValue('--task');
    const selected = requestedTask
        ? STORY_TEST_TASKS.filter(task => task.key === requestedTask)
        : STORY_TEST_TASKS.slice();
    if (!selected.length) throw new Error(`Unknown story test task: ${requestedTask}`);

    const timings = loadTimings();
    selected.sort((a, b) => (
        Number(timings[b.key] && timings[b.key].elapsedMs || b.weight * 1000)
        - Number(timings[a.key] && timings[a.key].elapsedMs || a.weight * 1000)
    ));
    const resultsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-rts-story-test-'));
    const workerHeapMb = Math.max(1024, Number(process.env.STORY_TEST_WORKER_MB || 2200));
    const recycleRss = workerHeapMb * 1024 ** 2 * 0.9;
    const states = new Map();
    let completed = 0;
    let failed = null;
    let sequence = 1;

    console.log(`[story-parallel] tasks=${selected.length} workers=${config.count} cpu=${cpuBusy}% freeRam=${bytesGiB(os.freemem())}GiB memoryCap=${config.memoryCap}${config.explicit ? ' explicit' : ' auto'}`);
    if (config.explicit && config.count > config.memoryCap) {
        console.warn(`[story-parallel] WARNING: explicit workers=${config.count} exceeds current memory-aware cap=${config.memoryCap}.`);
    }
    if (!config.explicit && cpuBusy >= 85) {
        console.log('[story-parallel] CPU is already saturated; auto mode reduced the pool to one worker.');
    }

    function createWorker() {
        const child = fork(WORKER_FILE, [], {
            cwd: ROOT,
            execArgv: [`--max-old-space-size=${workerHeapMb}`, '--expose-gc'],
            stdio: ['ignore', 'inherit', 'inherit', 'ipc']
        });
        const state = { child, ready: false, task: null, memory: null, recycling: false };
        states.set(child.pid, state);
        child.on('message', message => {
            if (!message) return;
            if (message.type === 'ready') { state.ready = true; assign(state); return; }
            if (message.type === 'heartbeat') { state.memory = message.memory; return; }
            if (message.type === 'done') {
                const task = state.task;
                state.task = null;
                state.memory = message.memory;
                completed++;
                timings[message.key] = { elapsedMs: Math.round(message.elapsedMs), bytes: message.bytes, updatedAt: new Date().toISOString() };
                console.log(`[story-parallel] ${completed}/${selected.length} ${message.key} ${(message.elapsedMs / 1000).toFixed(1)}s ${(message.bytes / 1024 / 1024).toFixed(1)}MiB`);
                if (message.memory && message.memory.rss > recycleRss && selected.length) {
                    state.recycling = true;
                    child.disconnect();
                    child.kill();
                } else assign(state);
                finishIfDone();
                return;
            }
            if (message.type === 'error') {
                failed = new Error(`${message.key}: ${message.error && message.error.message}`);
                failed.stack = message.error && message.error.stack || failed.stack;
                finishIfDone();
            }
        });
        child.on('exit', () => {
            const unfinished = state.task;
            states.delete(child.pid);
            if (unfinished && !failed) {
                unfinished.inFlight = false;
                failed = new Error(`Story test worker exited during task: ${unfinished.key}`);
            }
            if (!failed && completed < selected.length && states.size < config.count) createWorker();
            finishIfDone();
        });
        child.on('error', error => { failed = error; finishIfDone(); });
    }

    function assign(state) {
        if (failed || !state.ready || state.task || state.recycling) return;
        const task = selected.find(item => !item.done && !item.inFlight);
        if (!task) { finishIfDone(); return; }
        // Avoid starting another memory-heavy isolate while the OS is close to reserve.
        if (os.freemem() < config.reserveBytes && [...states.values()].some(item => item.task)) {
            setTimeout(() => assign(state), 1000).unref();
            return;
        }
        task.inFlight = true;
        state.task = task;
        state.child.send({
            type: 'run', taskId: sequence++, key: task.key, fn: task.fn, args: task.args,
            outputPath: path.join(resultsDir, `${task.key}.bin`)
        });
    }

    let resolvePool;
    const poolDone = new Promise(resolve => { resolvePool = resolve; });
    let resolved = false;
    function finishIfDone() {
        if (resolved) return;
        if (!failed && completed < selected.length) return;
        resolved = true;
        for (const state of states.values()) {
            try { state.child.disconnect(); } catch (_) { /* already disconnected */ }
            state.child.kill();
        }
        resolvePool();
    }

    const monitor = setInterval(() => {
        const active = [...states.values()].filter(state => state.task);
        const rss = [...states.values()].reduce((sum, state) => sum + Number(state.memory && state.memory.rss || 0), 0);
        console.log(`[story-parallel] progress=${completed}/${selected.length} active=${active.map(state => state.task.key).join(',') || '-'} workerRss=${bytesGiB(rss)}GiB freeRam=${bytesGiB(os.freemem())}GiB`);
    }, 15000);
    for (let index = 0; index < config.count; index++) createWorker();
    await poolDone;
    clearInterval(monitor);
    saveTimings(timings);
    if (failed) throw failed;
    for (const task of selected) {
        const target = path.join(resultsDir, `${task.key}.bin`);
        if (!fs.existsSync(target)) throw new Error(`Worker result is missing after completion: ${task.key}`);
        // Decode once in the coordinator so a worker-side serialization problem
        // fails before the assertion process starts. The value is discarded to
        // keep coordinator memory bounded.
        v8.deserialize(fs.readFileSync(target));
    }

    let exitCode = 0;
    if (!requestedTask) exitCode = await runAssertions(resultsDir);
    console.log(`[story-parallel] total=${((Date.now() - started) / 1000).toFixed(1)}s results=${keep ? resultsDir : 'cleaned'}`);
    if (!keep) fs.rmSync(resultsDir, { recursive: true, force: true });
    process.exitCode = exitCode;
}

main().catch(error => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
