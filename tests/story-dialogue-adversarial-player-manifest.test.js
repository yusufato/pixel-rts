'use strict';

const assert = require('node:assert/strict');
const { buildManifest, playerPrompt, DOMAIN_ANCHORS, DOMAIN_GUIDANCE } = require('../tools/story-dialogue-adversarial-player-manifest');
const maturity = require('../tools/story-dialogue-domain-maturity.json');

const manifest = buildManifest(60);
assert.equal(manifest.scenarios.length, 60);
const counts = manifest.scenarios.reduce((acc, row) => {
    acc[row.knowledgeRelation] = (acc[row.knowledgeRelation] || 0) + 1;
    return acc;
}, {});
assert.equal(counts.SUPPORTED_PUBLIC, 9);
assert.equal(counts.UNKNOWN_TO_CHARACTER, 15);
assert.equal(counts.FALSE_PREMISE, 12);
assert.equal(counts.MIXED_TRUE_FALSE, 9);
assert.equal(counts.FUTURE_DOMAIN, 9);
assert.equal(counts.AMBIGUOUS_OR_NOISY, 6);
assert.equal(new Set(manifest.scenarios.slice(0, 6).map(row => row.knowledgeRelation)).size, 6,
    'İlk kabul koşusu altı ayrı bilgi ilişkisini kapsamalı.');
assert.ok(counts.SUPPORTED_PUBLIC / manifest.scenarios.length <= 0.25,
    'Oyuncu LLM bilinen ve rahat konulara kapanmamalı.');
assert.ok(new Set(manifest.scenarios.map(row => row.utteranceMode)).size >= 10);
assert.ok(manifest.scenarios.every(row => typeof row.utteranceGuidance === 'string'
    && row.utteranceGuidance.length >= 12));
assert.ok(new Set(manifest.scenarios.map(row => row.attackFamily)).size >= 15);
assert.ok(manifest.scenarios.some(row => row.domain.status === 'LIVE'));
assert.ok(manifest.scenarios.some(row => row.domain.status === 'PARTIAL'));
assert.ok(manifest.scenarios.some(row => row.domain.status === 'PLANNED'));
assert.ok(manifest.scenarios.every(row => !Object.hasOwn(row, 'playerText')),
    'Manifest hazır cümle ezberletmemeli; cümleyi oyuncu LLM üretmeli.');
assert.ok(manifest.scenarios.every(row => Array.isArray(row.requiredTopicAnchors)
    && row.requiredTopicAnchors.length >= 1), 'Her senaryonun çalıştırıcı tarafından denetlenen konu çapası olmalı.');
assert.ok(manifest.scenarios.every(row => row.requiredTopicAnchors.includes(row.targetTopicAnchor)),
    'Her senaryonun tek, açık üretim çapası denetlenen alan çapalarından seçilmeli.');
assert.ok(manifest.scenarios.every(row => typeof row.domainGuidance === 'string'
    && row.domainGuidance.length >= 30), 'İç domain kodu yerine doğal Türkçe konu özeti bulunmalı.');
assert.equal(new Set(manifest.scenarios.slice(0, 6).map(row => row.domain.id)).size, 6,
    'İlk kabul koşusu altı farklı alanı zorlamalı.');
const prompt = playerPrompt(manifest.scenarios[11], [{ speaker: 'CHARACTER', text: 'Seni dinliyorum.' }],
    { visibleRole: 'Devlet yöneticisi' });
assert.match(prompt, /Yanlış konuşman, yalan söylemen/);
assert.match(prompt, /Cümlende tercihen “.+”/);
assert.doesNotMatch(prompt, new RegExp(manifest.scenarios[11].domain.id),
    'İç domain kimliği oyuncu promptuna sızmamalı.');
assert.doesNotMatch(prompt, /saldırı ailesi|mekanik olgunluk|attack family/i,
    'İç test etiketleri oyuncu modelinin görebildiği prompta sızmamalı.');
assert.doesNotMatch(prompt, /CHARACTER_ACTOR_BELIEFS|EXPECTED_ANSWER|NLU_LABELS/);
assert.match(prompt, /Yalnız \{"playerText":"\.\.\."\}/);
assert.deepEqual(maturity.domains.filter(row => !DOMAIN_ANCHORS[row.id]).map(row => row.id), [],
    'Her gerçek maturity domaini elle seçilmiş doğal Türkçe çapalara sahip olmalı.');
assert.deepEqual(maturity.domains.filter(row => !DOMAIN_GUIDANCE[row.id]).map(row => row.id), [],
    'Her gerçek maturity domaini doğal Türkçe konu açıklamasına sahip olmalı.');
process.stdout.write(`${JSON.stringify({ ok: true, scenarios: 60, knowledgeRelations: counts })}\n`);
