'use strict';

const fs = require('node:fs');
const path = require('node:path');
const v8 = require('node:v8');

function storyTestResult(key, fallback, ...args) {
    const directory = process.env.STORY_TEST_RESULTS_DIR;
    if (!directory) return fallback(...args);
    const target = path.join(directory, `${String(key)}.bin`);
    if (!fs.existsSync(target)) throw new Error(`Parallel story test result is missing: ${key}`);
    return v8.deserialize(fs.readFileSync(target));
}

module.exports = { storyTestResult };
