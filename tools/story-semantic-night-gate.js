'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');

function read(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; } }

function evaluateNightGate(input) {
    const reviews = input.reviews || [];
    const adjudications = input.adjudications || [];
    const heldout = input.heldout || {};
    const qaById = new Map(adjudications.map(row => [row.id, row]));
    const humanAccepted = reviews.filter(row => row && row.uiContractVersion === 2
        && ['ACCEPT', 'EDIT'].includes(row.verdict)
        && ['communicativeFunction', 'surfaceForm', 'predicate']
            .every(axis => (row.approvedAxes || []).includes(axis)));
    const goldAccepted = humanAccepted.filter(row => {
        const qa = qaById.get(row.id);
        return qa && qa.verdict === 'ACCEPT_CORE'
            && ['communicativeFunction', 'surfaceForm', 'predicate']
                .every(axis => (qa.approvedAxes || []).includes(axis));
    }).length;
    const metrics = {
        humanAccepted: humanAccepted.length, qaAdjudicated: adjudications.length,
        goldAccepted, heldoutTotal: Number(heldout.total) || 0,
        coreAccuracy: Number(heldout.coreAccuracy) || 0,
        evidenceAccuracy: Number(heldout.evidenceAccuracy) || 0,
        falseHighConfidenceRate: Number(heldout.falseHighConfidenceRate) || 1,
        naturalTurkishRate: Number(heldout.naturalTurkishRate) || 0
    };
    const checks = [
        ['GOLD_ACCEPTED_40', metrics.goldAccepted >= 40, metrics.goldAccepted, 40],
        ['HELDOUT_20', metrics.heldoutTotal >= 20, metrics.heldoutTotal, 20],
        ['CORE_ACCURACY_85', metrics.coreAccuracy >= 0.85, metrics.coreAccuracy, 0.85],
        ['EVIDENCE_ACCURACY_95', metrics.evidenceAccuracy >= 0.95, metrics.evidenceAccuracy, 0.95],
        ['FALSE_HIGH_MAX_02', metrics.falseHighConfidenceRate <= 0.02, metrics.falseHighConfidenceRate, 0.02],
        ['NATURAL_TURKISH_90', metrics.naturalTurkishRate >= 0.90, metrics.naturalTurkishRate, 0.90]
    ].map(([id, pass, actual, threshold]) => ({ id, pass, actual, threshold }));
    return { ok: checks.every(row => row.pass), schemaVersion: 1, metrics, checks,
        decision: checks.every(row => row.pass) ? 'NIGHT_TEST_READY' : 'NIGHT_TEST_BLOCKED' };
}

if (require.main === module) {
    const reviews = read(path.join(ROOT, 'qa-runtime', 'story-conversation-semantic-human-reviews.json'), { reviews: [] });
    const adjudications = read(path.join(ROOT, 'qa-runtime', 'story-conversation-semantic-qa-adjudications.json'), { adjudications: [] });
    const heldout = read(path.join(ROOT, 'qa-runtime', 'story-conversation-semantic-heldout.json'), {});
    const report = evaluateNightGate({ reviews: reviews.reviews || [],
        adjudications: adjudications.adjudications || [], heldout });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.ok) process.exitCode = 2;
}

module.exports = { evaluateNightGate };
