'use strict';

const assert = require('node:assert/strict');
const { runStorySimulation } = require('../tools/story-sim-harness');

const YEARS = 30;
const CURRENT_YEAR_SECONDS = 120;
const report = runStorySimulation({
    seed: 2032,
    seconds: YEARS * CURRENT_YEAR_SECONDS,
    sampleEvery: CURRENT_YEAR_SECONDS
});

assert.equal(
    report.simulatedSeconds,
    YEARS * CURRENT_YEAR_SECONDS,
    `${YEARS} oyun yılı kesintisiz tamamlanmalı.`
);
assert.equal(report.snapshot.states.length, 8, 'Soak sonunda sekiz devlet kaydı korunmalı.');
assert.ok(report.samples.length >= YEARS, 'Her oyun yılı için en az bir sağlık örneği bulunmalı.');
assert.equal(report.causalityValidation.ok, true, '30 yıllık defter yapısal doğrulamayı geçmeli.');
assert.equal(report.causalityWorldConsistency.ok, true, '30 yıllık dünya–defter mutabakatı korunmalı.');
assert.equal(report.causality.guard.blockedTotal, 0, 'Normal 30 yıllık akış hiçbir zincir sigortasına çarpmamalı.');
assert.equal(report.causality.guard.invariantFailures, 0, '30 yıllık akış geçersiz kalıcı değer üretmemeli.');
assert.equal(report.regionalValidation.ok, true, '30 yıllık akış sonunda bölgesel stok defteri geçerli kalmalı.');
assert.equal(report.populationValidation.ok, true,
    '30 yıllık akış sonunda kohort, bölge ve ülke nüfus mutabakatı korunmalı.');
assert.equal(report.populationSummary.cohortCount, 152 * 12,
    '30 yıllık akışta kanonik nüfus kohortları kaybolmamalı veya çoğalmamalı.');
assert.equal(report.needsValidation.ok, true,
    '30 yıllık akışta ihtiyaç ve yaşam koşulu defteri geçerli kalmalı.');
assert.equal(report.needsSummary.cohortOutcomeCount, 152 * 12,
    '30 yıllık akışta her nüfus kohortunun yaşam koşulu sonucu korunmalı.');
assert.equal(report.tradeValidation.ok, true, '30 yıllık akış sonunda ticaret ve yoldaki yük koruma defteri geçerli kalmalı.');
assert.equal(report.marketValidation.ok, true, '30 yıllık akış sonunda piyasa ve fiyat defteri geçerli kalmalı.');
assert.equal(report.budgetValidation.ok, true, '30 yıllık akış sonunda devlet bütçeleri ve çift taraflı fişler geçerli kalmalı.');
assert.equal(report.companyValidation.ok, true, '30 yıllık akış sonunda şirket, banka, tesis ve para koruma defteri geçerli kalmalı.');
assert.equal(report.economicAIValidation.ok, true,
    '30 yıllık akış sonunda ekonomik AI karar defteri geçerli kalmalı.');
assert.ok(report.economicAISummary.totals.cycles > 0,
    '30 yıllık akış boyunca ekonomik AI karar döngüleri çalışmalı.');
assert.ok(report.economicAISummary.totals.projectsStarted > 0,
    '30 yıllık akış boyunca ekonomik aktörler en az bir gerçek yatırım yapmalı.');
assert.ok(report.economicAISummary.decisionCount <= 600,
    'Tekrarlanan ekonomik bekleme kararları uzun kaydı sınırsız büyütmemeli.');
assert.ok(report.companySummary.companyCount >= 48, '30 yıllık akışta başlangıç şirket aktörleri kaybolmamalı.');
assert.equal(report.companySummary.bankCount, 8, '30 yıllık akışta sekiz ayrı banka bilançosu korunmalı.');
assert.equal(report.budgetSummary.countryCount, 8, '30 yıllık akışta sekiz devlet bütçesi korunmalı.');
assert.ok(report.budgetSummary.totalCash >= 0 && report.budgetSummary.totalDebt >= 0,
    '30 yıllık akışta toplam nakit ve borç sonlu, negatif olmayan değerler taşımalı.');
assert.ok(report.marketSummary.minIndex >= 25 && report.marketSummary.maxIndex <= 800,
    '30 yıllık akışta fiyatlar sonlu politika sınırlarını aşmamalı.');

console.log(`${YEARS} yıllık hikâye soak testi geçti.`);
console.log(JSON.stringify({
    seed: report.seed,
    simulatedSeconds: report.simulatedSeconds,
    stateHash: report.stateHash,
    wallTimeMs: report.wallTimeMs,
    populationSummary: report.populationSummary,
    needsSummary: report.needsSummary,
    tradeSummary: report.tradeSummary,
    marketSummary: report.marketSummary,
    budgetSummary: report.budgetSummary,
    companySummary: report.companySummary,
    economicAISummary: report.economicAISummary,
    final: report.final
}, null, 2));
