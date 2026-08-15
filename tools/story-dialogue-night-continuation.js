'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const QA = path.join(ROOT, 'qa-runtime');
const CALIBRATION = path.join(QA, 'story-dialogue-frontier-night-1000.json');
const LONG_OUTPUT = path.join(QA, 'story-dialogue-frontier-night-long-1500.json');
const STATE = path.join(QA, 'story-dialogue-night-suite-state.json');
const RUNNER = path.join(ROOT, 'tools', 'story-dialogue-frontier-runner.js');
const WAIT_MS = 30000;
const MAX_WAIT_MS = 12 * 60 * 60 * 1000;

function atomicWrite(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.renameSync(temporary, filePath);
}

function validCompletedReport(filePath) {
    try {
        const report = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return completedReportValid(report);
    } catch (_) { return false; }
}

function completedReportValid(report) {
    return !!(report && report.summary && Array.isArray(report.sessions)
        && report.sessions.length > 0
        && Object.prototype.hasOwnProperty.call(report.summary, 'infrastructureErrors')
        && Number(report.summary.infrastructureErrors) === 0);
}

function plan() {
    return { schemaVersion: 1, policy: 'MEASUREMENT_ONLY_NO_TRAINING',
        calibration: { sessions: 25, depth: 40, turns: 1000, output: CALIBRATION },
        longContext: { sessions: 30, depth: 50, turns: 1500, scenarioOffset: 1000,
            output: LONG_OUTPUT },
        totalTurns: 2500, maxWaitHours: 12 };
}

async function main() {
    const suite = plan();
    if (process.argv.includes('--plan')) {
        process.stdout.write(`${JSON.stringify(suite, null, 2)}\n`); return;
    }
    const startedAt = Date.now();
    atomicWrite(STATE, Object.assign({}, suite, { status: 'WAITING_FOR_CALIBRATION',
        startedAt: new Date(startedAt).toISOString() }));
    while (!validCompletedReport(CALIBRATION)) {
        if (Date.now() - startedAt > MAX_WAIT_MS) {
            atomicWrite(STATE, Object.assign({}, suite, { status: 'CALIBRATION_TIMEOUT',
                stoppedAt: new Date().toISOString() }));
            process.exitCode = 2; return;
        }
        await new Promise(resolve => setTimeout(resolve, WAIT_MS));
    }
    if (validCompletedReport(LONG_OUTPUT)) {
        atomicWrite(STATE, Object.assign({}, suite, { status: 'COMPLETE',
            completedAt: new Date().toISOString(), resumedExistingOutput: true }));
        return;
    }
    atomicWrite(STATE, Object.assign({}, suite, { status: 'LONG_CONTEXT_RUNNING',
        calibrationCompletedAt: new Date().toISOString() }));
    const child = spawn(process.execPath, [RUNNER, '--sessions=30', '--depth=50',
        '--player-microbatch=2', '--scenario-offset=1000',
        `--output=${LONG_OUTPUT}`], { cwd: ROOT, stdio: 'inherit', windowsHide: true });
    const code = await new Promise(resolve => child.once('exit', resolve));
    const complete = code === 0 && validCompletedReport(LONG_OUTPUT);
    atomicWrite(STATE, Object.assign({}, suite, { status: complete ? 'COMPLETE' : 'LONG_CONTEXT_FAILED',
        exitCode: code, stoppedAt: new Date().toISOString() }));
    if (!complete) process.exitCode = Number(code) || 2;
}

if (require.main === module) main().catch(error => {
    atomicWrite(STATE, Object.assign({}, plan(), { status: 'SUITE_ERROR', error: String(error && error.stack || error) }));
    console.error(error && error.stack || error); process.exitCode = 1;
});

module.exports = { plan, validCompletedReport, completedReportValid };
