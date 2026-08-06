'use strict';

const harness = require('./story-sim-harness');
const { storyTestTaskByKey } = require('./story-test-manifest');

const key = process.argv[2] || 'first';
const task = storyTestTaskByKey(key);
if (!task) throw new Error(`Unknown story profile task: ${key}`);
const fn = harness[task.fn];
if (typeof fn !== 'function') throw new Error(`Unknown harness function: ${task.fn}`);
const started = Date.now();
Promise.resolve(fn(...task.args)).then(() => {
    console.log(`[story-profile] ${key} completed in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}).catch(error => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
