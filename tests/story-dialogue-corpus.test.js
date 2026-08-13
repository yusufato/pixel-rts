'use strict';

const assert = require('node:assert/strict');
const {
    buildCorpusFromRows, validateCorpus, sanitizeText, splitAssignments
} = require('../tools/story-dialogue-corpus');

function row(at, eventType, sessionId, responseId, turnSequence, actorId, name, role,
    playerText, characterText, speechAct, discourseAct, source, enrichmentStatus, llmUsed) {
    return {
        schemaVersion: 1, recordedAt: at, eventType, gameClock: turnSequence,
        sessionId, responseId, turnSequence,
        listener: { actorId, name, role }, playerText, characterText, speechAct,
        discourseAct, source, enrichmentStatus, llmUsed,
        _sourceId: 'SOURCE-TEST', _sourceLine: turnSequence + 1,
        _sourceRecordHash: `sha256:${String(responseId + eventType).padEnd(64, '0').slice(0, 64)}`
    };
}

function fixture() {
    return [
        row('2026-08-12T10:00:00.000Z', 'TURN_CREATED', 'conversation-session:1', 'opening:1', 0,
            'character:secret:1', 'Ayşe Kaya', 'EXECUTIVE', 'Merhaba Ayşe Kaya', 'Merhaba.',
            'GREETING', '', 'SAFE', 'NOT_QUEUED', false),
        row('2026-08-12T10:00:01.000Z', 'RESPONSE_ENRICHED', 'conversation-session:1', 'opening:1', 0,
            'character:secret:1', 'Ayşe Kaya', 'EXECUTIVE', 'Merhaba Ayşe Kaya', 'Merhaba Ayşe Kaya.',
            'GREETING', '', 'LOCAL_LLM', 'USED', true),
        row('2026-08-12T10:00:02.000Z', 'TURN_CREATED', 'conversation-session:1', 'follow:1', 1,
            'character:secret:1', 'Ayşe Kaya', 'EXECUTIVE', 'işiniz nedir?', 'Devlet yöneticisiyim.',
            'ASK_INFORMATION', 'ANSWER_LISTENER_ROLE', 'GROUNDED', 'NOT_REQUIRED', false),
        // Yeni kampanya aynı sessionId ile başlar; önceki oturuma karışmamalı.
        row('2026-08-12T11:00:00.000Z', 'TURN_CREATED', 'conversation-session:1', 'opening:2', 0,
            'character:secret:2', 'Mehmet Can', 'COMMANDER', 'Selamlar Mehmet Can', 'Selamlar.',
            'GREETING', '', 'SAFE', 'NOT_QUEUED', false),
        row('2026-08-12T11:00:02.000Z', 'TURN_CREATED', 'conversation-session:1', 'follow:2', 1,
            'character:secret:2', 'Mehmet Can', 'COMMANDER', 'Bana iş var mı? mailim a@b.com 0532 111 22 33',
            'Şu anda görev yok.', 'REQUEST_ACTION', 'ANSWER_JOB_REQUEST_BOUNDARY',
            'GROUNDED', 'NOT_REQUIRED', false)
    ];
}

function run() {
    const source = [{ sourceId: 'SOURCE-TEST', fileName: 'fixture.jsonl', bytes: 1, sha256: 'sha256:test' }];
    const first = buildCorpusFromRows(fixture(), source);
    const second = buildCorpusFromRows(fixture(), source);
    assert.equal(first.manifestChecksum, second.manifestChecksum, 'Aynı girdi aynı corpus checksumını üretmeli.');
    assert.equal(first.summary.conversationGroupCount, 2, 'Session sayacı sıfırlanan kampanyalar birleşmemeli.');
    assert.equal(first.summary.caseCount, 4, 'Enriched olay ayrı tur değil ilk turun son görünür cevabı olmalı.');
    assert.equal(first.cases[0].observed.labelStatus, 'OBSERVED_UNREVIEWED', 'Eski motor etiketi altın etiket olmamalı.');
    assert.ok(first.cases.some(item => item.observed.llmUsed && item.observed.visibleReply.includes('[KARAKTER]')),
        'LLM ile zenginleşmiş son görünür cevap seçilip karakter adı takma ada çevrilmeli.');
    assert.ok(first.cases.some(item => item.playerText.includes('[EPOSTA]') && item.playerText.includes('[TELEFON]')),
        'E-posta ve telefon görünür corpus metninden çıkarılmalı.');
    assert.ok(JSON.stringify(first).includes('ACTOR-'), 'Ham aktör kimliği yerine kararlı takma ad bulunmalı.');
    assert.ok(!JSON.stringify(first).includes('character:secret'), 'Ham aktör kimliği corpus içine sızmamalı.');
    assert.ok(!JSON.stringify(first).includes('Ayşe Kaya') && !JSON.stringify(first).includes('Mehmet Can'),
        'Muhatap adı metin ve metadata içinden çıkarılmalı.');
    const validation = validateCorpus(first);
    assert.equal(validation.ok, true, JSON.stringify(validation.issues));
    const familySplits = new Map();
    for (const item of first.cases) {
        const previous = familySplits.get(item.scenarioFamilyId);
        if (previous) assert.equal(item.split, previous, 'Aynı senaryo ailesi splitler arasında sızmamalı.');
        familySplits.set(item.scenarioFamilyId, item.split);
    }
    const corrupt = JSON.parse(JSON.stringify(first));
    corrupt.cases[0].playerText = 'değiştirildi';
    assert.ok(validateCorpus(corrupt).issues.some(issue => issue.code === 'CHECKSUM_MISMATCH'),
        'Corpus değişikliği checksum kapısında yakalanmalı.');
    const hidden = JSON.parse(JSON.stringify(first));
    hidden.cases[0].system = 'gizli';
    delete hidden.manifestChecksum;
    assert.ok(validateCorpus(hidden).issues.some(issue => issue.code === 'FORBIDDEN_KEY'),
        'Gizli bağlam anahtarı şema içinde reddedilmeli.');
    const badTag = JSON.parse(JSON.stringify(first));
    badTag.cases[0].review.failureTags = ['MODEL_KOTU'];
    delete badTag.manifestChecksum;
    assert.ok(validateCorpus(badTag).issues.some(issue => issue.code === 'FAILURE_TAG'),
        'Serbest ve karşılaştırılamaz hata etiketi kapalı sözlükte reddedilmeli.');
    const fakeGold = JSON.parse(JSON.stringify(first));
    fakeGold.cases[0].review.acceptedReply = 'İncelenmeden altın cevap olamam.';
    delete fakeGold.manifestChecksum;
    assert.ok(validateCorpus(fakeGold).issues.some(issue => issue.code === 'ACCEPTED_REPLY_FORBIDDEN'),
        'İnsan incelemesi olmadan kabul cevabı corpus içine yazılamamalı.');
    assert.equal(sanitizeText('C:\\Users\\osman\\secret.txt https://x.test', ''), '[YEREL_YOL] [URL]');
    const assigned = splitAssignments([
        'sha256:00000001', 'sha256:00000002', 'sha256:00000003',
        'sha256:00000004', 'sha256:00000005', 'sha256:00000006'
    ]);
    assert.deepEqual(new Set(assigned.values()), new Set(['train', 'development', 'blind_test']),
        'Küçük corpus bile üç değerlendirme splitini doldurmalı.');
    console.log(JSON.stringify({ ok: true, checksum: first.manifestChecksum,
        cases: first.summary.caseCount, groups: first.summary.conversationGroupCount }));
}

run();
