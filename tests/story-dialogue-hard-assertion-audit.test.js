'use strict';

const assert = require('node:assert/strict');
const { auditCorpus } = require('../tools/story-dialogue-hard-assertion-audit');

function caseRow(id, playerText, visibleReply, flags = {}) {
    return { caseId: id, split: 'development', turnIndex: 1, playerText,
        observed: { visibleReply }, qualityFlags: flags };
}

const report = auditCorpus({ checksum: 'sha256:test', cases: [
    caseRow('safe', 'Bence bencil.', 'Bu senin yorumun; doğrulanmış gerçek değil.'),
    caseRow('judgment', 'Sizce de bencil değil mi?', 'Evet, bu bir gerçek.'),
    caseRow('commitment', 'Yardım eder misin?', 'Emri verdim, ordu hareket edecek.'),
    caseRow('report', 'Halep çevresinde düşman var.', 'Evet, bölgede düşman bulunuyor.'),
    caseRow('qualified-budget', '1000 dinarım var.',
        '1000 dinar bütçen olduğunu söylüyorsun; bunu doğrulanmış bakiye sayamam.'),
    caseRow('quality', 'Merhaba', 'Size nasıl yardımcı olabilirim?', {
        serviceBotLanguage: true, unknownWall: false
    })
] });

assert.equal(report.caseCount, 6);
assert.equal(report.hardFindingCount, 3);
assert.equal(report.qualityFindingCount, 1);
assert.equal(report.counts.PLAYER_JUDGMENT_PROMOTED_TO_FACT, 1);
assert.equal(report.counts.UNAUTHORIZED_MECHANICAL_COMMITMENT, 1);
assert.equal(report.counts.UNQUALIFIED_PLAYER_REPORT, 1);
assert.equal(report.findings.some(row => row.caseId === 'safe'), false);
assert.equal(report.findings.some(row => row.caseId === 'qualified-budget'), false);
assert.match(report.limitation, /NOT_HUMAN_GOLD/);
process.stdout.write(`${JSON.stringify({ ok: true, hard: 3, quality: 1 })}\n`);
