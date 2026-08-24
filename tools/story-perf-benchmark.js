'use strict';

const { performance } = require('node:perf_hooks');
const { createRuntime } = require('./story-sim-harness');

function runBenchmark(options = {}) {
    const seed = options.seed || 42424;
    const durationSeconds = options.durationSeconds || 60;
    const speed = options.speed || 1;

    const runtime = createRuntime(seed);
    runtime.api.newCampaign({
        seed,
        playerStateId: 0,
        abundance: 1.0,
        doctrine: 'combined',
        fog: true
    });
    runtime.api.setSpeed(speed);

    const stepLatenciesMs = [];
    const fixedStep = 0.25;
    const totalSteps = Math.round(durationSeconds / fixedStep);

    for (let i = 0; i < totalSteps; i++) {
        const t0 = performance.now();
        runtime.api.advance(fixedStep);
        const dt = performance.now() - t0;
        stepLatenciesMs.push(dt);
    }

    stepLatenciesMs.sort((a, b) => a - b);
    const sum = stepLatenciesMs.reduce((acc, v) => acc + v, 0);
    const avg = sum / stepLatenciesMs.length;
    const min = stepLatenciesMs[0];
    const max = stepLatenciesMs[stepLatenciesMs.length - 1];
    const p50 = stepLatenciesMs[Math.floor(stepLatenciesMs.length * 0.50)];
    const p90 = stepLatenciesMs[Math.floor(stepLatenciesMs.length * 0.90)];
    const p95 = stepLatenciesMs[Math.floor(stepLatenciesMs.length * 0.95)];
    const p99 = stepLatenciesMs[Math.floor(stepLatenciesMs.length * 0.99)];

    // Calculate variance and standard deviation
    const variance = stepLatenciesMs.reduce((acc, v) => acc + (v - avg) ** 2, 0) / stepLatenciesMs.length;
    const stdDev = Math.sqrt(variance);

    return {
        durationSeconds,
        totalSteps,
        avg: avg.toFixed(3),
        min: min.toFixed(3),
        max: max.toFixed(3),
        p50: p50.toFixed(3),
        p90: p90.toFixed(3),
        p95: p95.toFixed(3),
        p99: p99.toFixed(3),
        stdDev: stdDev.toFixed(3),
        totalTimeMs: sum.toFixed(1)
    };
}

if (require.main === module) {
    console.log('=== STORY SIMULATION PERFORMANCE BENCHMARK (60s) ===');
    const result = runBenchmark({ durationSeconds: 60 });
    console.log(`Total Simulated Steps: ${result.totalSteps} (0.25s fixed steps)`);
    console.log(`Total Execution Time:  ${result.totalTimeMs} ms`);
    console.log(`Average Step Latency:  ${result.avg} ms`);
    console.log(`Min Step Latency:      ${result.min} ms`);
    console.log(`Median (p50) Latency:  ${result.p50} ms`);
    console.log(`p90 Latency:           ${result.p90} ms`);
    console.log(`p95 Latency:           ${result.p95} ms`);
    console.log(`p99 Latency:           ${result.p99} ms`);
    console.log(`Max Peak Spike:        ${result.max} ms`);
    console.log(`Standard Deviation:    ${result.stdDev} ms`);
    console.log('=====================================================');
}

module.exports = { runBenchmark };
