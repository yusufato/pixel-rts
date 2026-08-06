'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { storyTestTaskByKey } = require('./story-test-manifest');

const root = path.resolve(__dirname, '..');
const taskKey = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : 'first';
if (!storyTestTaskByKey(taskKey)) throw new Error(`Unknown story profile task: ${taskKey}`);
const profileDir = path.join(root, 'qa-runtime', 'story-cpu-profiles');
fs.mkdirSync(profileDir, { recursive: true });
const child = spawn(process.execPath, [
    '--max-old-space-size=8192', '--cpu-prof', `--cpu-prof-dir=${profileDir}`,
    path.join(__dirname, 'story-test-profile-task.js'), taskKey
], { cwd: root, stdio: 'inherit' });
child.on('exit', code => { process.exitCode = code == null ? 1 : code; });
child.on('error', error => { console.error(error.stack || error); process.exitCode = 1; });
