'use strict';

const { performance } = require('node:perf_hooks');
const { createRuntime } = require('./story-sim-harness');

function runProfiler(options = {}) {
    const seed = options.seed || 42424;
    const durationSeconds = options.durationSeconds || 60;
    const speed = options.speed || 1;

    const runtime = createRuntime(seed);
    const window = runtime.dom.window;

    runtime.api.newCampaign({
        seed,
        playerStateId: 0,
        abundance: 1.0,
        doctrine: 'combined',
        fog: true
    });
    runtime.api.setSpeed(speed);

    // Let's monkey-patch global subsystem functions to measure time spent
    const timings = {};

    function wrap(name, fn) {
        if (typeof fn !== 'function') return fn;
        timings[name] = { totalMs: 0, count: 0, maxMs: 0 };
        return function (...args) {
            const t0 = performance.now();
            try {
                return fn.apply(this, args);
            } finally {
                const dt = performance.now() - t0;
                timings[name].totalMs += dt;
                timings[name].count++;
                if (dt > timings[name].maxMs) timings[name].maxMs = dt;
            }
        };
    }

    const functionsToProfile = [
        'storyTradeLogisticsTick',
        'storyTradeHouseholdDistributionBalance',
        'storyTradeCommitProductionVolumeAdmission',
        'storyTradeProductionInputBalance',
        'storyTradeAutoBalance',
        'storyTradeProductionOpportunityView',
        'storyTradeProductionAdmissionPlan',
        'storyTradeDispatchOrder',
        'storyTradeCreateOrder',
        'storyTradeAdvanceShipment',
        'storyTransportAdvanceShipment',
        'storyTradeRefreshDistributionBatches',
        'storyTradeGarbageCollect',
        'storyTradeFindRoute',
        'storyRoutePlannerPlan',
        'storyRoutePlannerReserve',
        'storyRegionalEconomyTick',
        'storyRegionalAllocateDemands',
        'storyCommerceSettleDemand',
        'storyCommerceInventoryPlan',
        'storyEconomicAITick',
        'storyEconomicAICompanyPortfolioOrder',
        'storyEconomicAICompanyDecision',
        'storyEconomicAIStateCandidates',
        'storyEconomicAICandidateForFacility',
        'storyEconomicAIReachableInput',
        'storyEconomicAIOperationalBootstrap',
        'storyInfrastructureWorkTickSeconds',
        'storyHexConstructionTickSeconds',
        'storyHumanMigrationTick',
        'storyCityGrowthTick',
        'storyPopulationTick',
        'storyWarfareTick',
        'storyTacticalAITick',
        'storySchedulerTick',
        'storyRenderFrame',
        'storyRenderMap',
        'storyMapInvalidate',
        'storyMapRebuild'
    ];

    for (const name of functionsToProfile) {
        if (typeof window[name] === 'function') {
            window[name] = wrap(name, window[name]);
        }
    }

    const fixedStep = 0.25;
    const totalSteps = Math.round(durationSeconds / fixedStep);
    const stepDurations = [];

    console.log(`Starting profiling run for ${durationSeconds}s (${totalSteps} steps)...`);
    const totalStart = performance.now();

    for (let i = 0; i < totalSteps; i++) {
        const t0 = performance.now();
        runtime.api.advance(fixedStep);
        const dt = performance.now() - t0;
        stepDurations.push(dt);
        if ((i + 1) % 40 === 0) {
            console.log(`Progress: ${i + 1}/${totalSteps} steps (${((i + 1) * fixedStep).toFixed(1)}s sim time)...`);
        }
    }

    const totalEnd = performance.now();
    console.log(`Profiling completed in ${((totalEnd - totalStart) / 1000).toFixed(1)}s\n`);

    // Sort timings by totalMs descending
    const sorted = Object.entries(timings)
        .filter(([_, data]) => data.count > 0)
        .sort((a, b) => b[1].totalMs - a[1].totalMs);

    console.log('=== DETAILED SUBSYSTEM EXECUTION TIME BREAKDOWN ===');
    console.log(
        'Function Name'.padEnd(44) +
        'Total Time (ms)'.padStart(16) +
        'Calls'.padStart(8) +
        'Avg (ms)'.padStart(12) +
        'Max (ms)'.padStart(12)
    );
    console.log('-'.repeat(92));

    for (const [name, data] of sorted) {
        const avg = data.totalMs / data.count;
        console.log(
            name.padEnd(44) +
            data.totalMs.toFixed(1).padStart(16) +
            String(data.count).padStart(8) +
            avg.toFixed(2).padStart(12) +
            data.maxMs.toFixed(2).padStart(12)
        );
    }
    console.log('===================================================\n');
}

if (require.main === module) {
    runProfiler({ durationSeconds: 60 });
}

module.exports = { runProfiler };
