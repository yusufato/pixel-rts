const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({
    console,
    STORY_RESOURCE_DEFINITIONS: [
        { id: 'food', transportModes: ['LAND'] }
    ],
    STORY_RESOURCE_CATALOG_HASH: 'resource-catalog:test',
    STORY_REGIONAL_POLICY_HASH: 'regional-policy:test',
    storyProductionHash: value => JSON.stringify(value)
});
vm.runInContext(
    fs.readFileSync(path.join(root, 'js/StoryTrade.js'), 'utf8'),
    context,
    { filename: 'js/StoryTrade.js' }
);

const result = vm.runInContext(`(() => {
    const base = {
        transportVersion: 2,
        corridorIds: ['corridor:road'],
        routeRegionIds: ['region:a', 'region:b'],
        legIndex: 1,
        currentRegionId: 'region:b',
        targetRegionId: 'region:b',
        physicalRoute: { steps: [{ segmentId: 'segment:1' }] },
        transportAgent: {
            state: 'QUEUED',
            stepIndex: 1,
            transferToMode: null
        }
    };
    const check = patch => storyTradePhysicalArrivalAtDestination(
        Object.assign({}, base, patch, {
            transportAgent: Object.assign(
                {}, base.transportAgent, patch && patch.transportAgent)
        })
    );
    return {
        queuedForUnload: check({}),
        unloading: check({ transportAgent: { state: 'UNLOADING' } }),
        loadingQueue: check({
            legIndex: 0,
            currentRegionId: 'region:a',
            transportAgent: { stepIndex: 0 }
        }),
        transferQueue: check({
            transportAgent: { transferToMode: 'RAIL' }
        }),
        staleStep: check({ transportAgent: { stepIndex: 0 } }),
        wrongTarget: check({ currentRegionId: 'region:a' }),
        missingRoute: check({ physicalRoute: null })
    };
})()`, context);

assert.deepStrictEqual(JSON.parse(JSON.stringify(result)), {
    queuedForUnload: true,
    unloading: true,
    loadingQueue: false,
    transferQueue: false,
    staleStep: false,
    wrongTarget: false,
    missingRoute: false
});

console.log('STORY_TRADE_ARRIVAL_QUEUE_OK', JSON.stringify(result));
