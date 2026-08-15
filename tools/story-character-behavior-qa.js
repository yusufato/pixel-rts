'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const MINIMUM_SAMPLE = 30;
const DOMINANCE_REVIEW_BPS = 7500;

function parseArgs(argv) {
    const readNumber = (name, fallback) => {
        const row = argv.find(value => value.startsWith(`--${name}=`));
        const parsed = row && Number(row.slice(name.length + 3));
        return Number.isFinite(parsed) ? parsed : fallback;
    };
    const outputRow = argv.find(value => value.startsWith('--output='));
    const defaultWorkers = Math.max(1, Math.min(4, os.cpus().length - 1));
    return {
        seed: Math.max(0, Math.floor(readNumber('seed', 2032))),
        seeds: Math.max(1, Math.min(64, Math.floor(readNumber('seeds', 4)))),
        seconds: Math.max(10, Math.min(3600, Math.floor(readNumber('seconds', 300)))),
        workers: Math.max(1, Math.min(12,
            Math.floor(readNumber('workers', defaultWorkers)))),
        output: outputRow ? outputRow.slice('--output='.length) : null
    };
}

function addTable(target, source) {
    for (const [key, value] of Object.entries(source || {})) {
        target[key] = (target[key] || 0) + Math.max(0, Number(value) || 0);
    }
}

function dominantRow(table) {
    return Object.entries(table).sort((left, right) => right[1] - left[1]
        || left[0].localeCompare(right[0], 'en'))[0] || null;
}

function aggregate(options, rows) {
    const byType = {};
    const byRole = {};
    let sampleSize = 0;
    let distinctActorObservations = 0;
    let repeatedPairObservations = 0;
    for (const row of rows) {
        const summary = row.summary || {};
        const qa = summary.behaviorQA || {};
        sampleSize += Math.max(0, Number(summary.aiReceiptCount) || 0);
        distinctActorObservations += Math.max(0, Number(qa.distinctActorCount) || 0);
        repeatedPairObservations += Math.max(0, Number(qa.repeatedPairCount) || 0);
        addTable(byType, summary.aiByType);
        addTable(byRole, qa.byRole);
    }
    const dominantType = dominantRow(byType);
    const dominantRole = dominantRow(byRole);
    const dominantTypeShareBps = dominantType && sampleSize
        ? Math.round(dominantType[1] / sampleSize * 10000) : 0;
    const dominantRoleShareBps = dominantRole && sampleSize
        ? Math.round(dominantRole[1] / sampleSize * 10000) : 0;
    const actionMixVerdict = sampleSize < MINIMUM_SAMPLE ? 'INSUFFICIENT_SAMPLE'
        : dominantTypeShareBps > DOMINANCE_REVIEW_BPS ? 'REVIEW' : 'OK';
    return {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        contract: {
            selectionMutation: false,
            randomDiversityQuota: false,
            minimumSample: MINIMUM_SAMPLE,
            dominanceReviewBps: DOMINANCE_REVIEW_BPS
        },
        run: {
            baseSeed: options.seed,
            seedCount: rows.length,
            secondsPerSeed: options.seconds,
            workers: Math.min(options.workers, options.seeds)
        },
        aggregate: {
            sampleSize,
            byType,
            distinctTypeCount: Object.keys(byType).length,
            dominantType: dominantType && dominantType[0] || null,
            dominantTypeShareBps,
            byRole,
            distinctRoleCount: Object.keys(byRole).length,
            dominantRole: dominantRole && dominantRole[0] || null,
            dominantRoleShareBps,
            distinctActorObservations,
            repeatedPairObservations,
            actionMixVerdict
        },
        seeds: rows.sort((left, right) => left.seed - right.seed)
    };
}

async function runPool(options) {
    const queue = Array.from({ length: options.seeds }, (_, index) => options.seed + index);
    const rows = [];
    const runOne = seed => new Promise((resolve, reject) => {
        const worker = new Worker(__filename, { workerData: { seed, seconds: options.seconds } });
        worker.once('message', message => message && message.ok
            ? resolve(message.result) : reject(new Error(message && message.error || 'WORKER_FAILED')));
        worker.once('error', reject);
        worker.once('exit', code => { if (code !== 0) reject(new Error(`WORKER_EXIT_${code}`)); });
    });
    const consumers = Array.from({ length: Math.min(options.workers, queue.length) }, async () => {
        while (queue.length) rows.push(await runOne(queue.shift()));
    });
    await Promise.all(consumers);
    return rows;
}

if (!isMainThread) {
    try {
        const { runStorySimulation } = require('./story-sim-harness');
        const result = runStorySimulation({ seed: workerData.seed, seconds: workerData.seconds });
        parentPort.postMessage({ ok: true, result: {
            seed: workerData.seed,
            stateHash: result.stateHash,
            summary: result.characterActionSummary
        } });
    } catch (error) {
        parentPort.postMessage({ ok: false, error: error && error.stack || String(error) });
        process.exitCode = 1;
    }
} else {
    (async () => {
        const options = parseArgs(process.argv.slice(2));
        const report = aggregate(options, await runPool(options));
        const text = `${JSON.stringify(report, null, 2)}\n`;
        if (options.output) {
            const target = path.resolve(options.output);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, text, 'utf8');
        }
        process.stdout.write(text);
        if (report.aggregate.actionMixVerdict === 'REVIEW') process.exitCode = 2;
    })().catch(error => {
        process.stderr.write(`${error && error.stack || error}\n`);
        process.exitCode = 1;
    });
}
