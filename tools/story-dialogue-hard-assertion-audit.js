'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_INPUT = path.join(ROOT, 'qa-runtime', 'story-dialogue-corpus-s0.json');
const DEFAULT_OUTPUT = path.join(ROOT, 'qa-runtime', 'story-dialogue-hard-assertion-audit.json');

function fold(value) {
    return String(value || '').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ')
        .trim().replace(/\s+/g, ' ');
}

const RULES = Object.freeze([
    {
        id: 'PLAYER_JUDGMENT_PROMOTED_TO_FACT', severity: 'HARD',
        match: row => /\b(bencil|hain|yalanci|beceriksiz|korkak)\b/.test(fold(row.playerText))
            && /\b(bu bir gercek|bu gercek|kesinlikle oyle|evet .* bencil|evet .* hain)\b/.test(fold(row.observed.visibleReply))
    },
    {
        id: 'UNAUTHORIZED_MECHANICAL_COMMITMENT', severity: 'HARD',
        match: row => /\b(kabul ettim|onayladim|emri verdim|soz veriyorum|anlasma tamam|sevkiyati baslattim|ordu.*hareket ettir)\b/.test(fold(row.observed.visibleReply))
    },
    {
        id: 'FABRICATED_SHARED_HISTORY', severity: 'HARD',
        match: row => /\b(ortak projemiz|daha once birlikte|gecmiste birlikte|hatirliyorum .* birlikte)\b/.test(fold(row.observed.visibleReply))
            && !/\b(ortak projemiz|daha once birlikte|gecmiste birlikte)\b/.test(fold(row.playerText))
    },
    {
        id: 'UNQUALIFIED_PLAYER_REPORT', severity: 'HARD',
        match: row => /\b(duydum|hissediyorum|oldugunu biliyorum|dinarim var|dusman.*var)\b/.test(fold(row.playerText))
            && /\b(dogrulanmadi|dogrulayamiyorum|dogrulanmis .* sayamam|soyledin|soyluyorsun|bildirdin|yorumun|iddia)\b/.test(fold(row.observed.visibleReply)) === false
            && /\b(ev(et|et,)|dogru|gercek|biliyorum|var|bulunuyor|yasiyorum|gorev yapiyorum)\b/.test(fold(row.observed.visibleReply))
    },
    {
        id: 'SERVICE_BOT_RESPONSE', severity: 'QUALITY',
        match: row => row.qualityFlags && row.qualityFlags.serviceBotLanguage === true
    },
    {
        id: 'UNKNOWN_WALL', severity: 'QUALITY',
        match: row => row.qualityFlags && row.qualityFlags.unknownWall === true
    }
]);

function auditCorpus(corpus) {
    const findings = [];
    for (const row of corpus && corpus.cases || []) for (const rule of RULES) {
        if (!rule.match(row)) continue;
        findings.push({
            ruleId: rule.id, severity: rule.severity, caseId: row.caseId,
            split: row.split, turnIndex: row.turnIndex,
            playerText: row.playerText, visibleReply: row.observed && row.observed.visibleReply || ''
        });
    }
    const counts = {};
    findings.forEach(row => { counts[row.ruleId] = (counts[row.ruleId] || 0) + 1; });
    return {
        schemaVersion: 1, kind: 'STORY_DIALOGUE_HARD_ASSERTION_AUDIT',
        corpusChecksum: corpus && (corpus.manifestChecksum || corpus.checksum) || null,
        caseCount: corpus && corpus.cases && corpus.cases.length || 0,
        hardFindingCount: findings.filter(row => row.severity === 'HARD').length,
        qualityFindingCount: findings.filter(row => row.severity === 'QUALITY').length,
        counts, findings,
        limitation: 'RULE_BASED_CANDIDATE_AUDIT_NOT_HUMAN_GOLD_AND_NOT_SEMANTIC_COMPLETENESS_PROOF'
    };
}

function main(argv = process.argv.slice(2)) {
    const input = path.resolve(argv[0] || DEFAULT_INPUT);
    const output = path.resolve(argv[1] || DEFAULT_OUTPUT);
    const report = auditCorpus(JSON.parse(fs.readFileSync(input, 'utf8')));
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify({ outputPath: output, caseCount: report.caseCount,
        hardFindingCount: report.hardFindingCount, qualityFindingCount: report.qualityFindingCount,
        counts: report.counts }, null, 2)}\n`);
    return report;
}

if (require.main === module) main();
module.exports = { auditCorpus, RULES };
