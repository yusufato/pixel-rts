// ═══════════════════════════════════════════════════════════════════════════
// BattleFeatures.js — Faz 3: seçici model GİRDİLERİ (stateFeatures.v1 + candidateFeatures.v1)
// ───────────────────────────────────────────────────────────────────────────
// Plan: SAVAS-AI-PLAN-v4-LLM.md §2.0/§2.1/§5. Model ADAY ÜRETMEZ, SIRALAR:
//   score = f(stateFeatures, candidateFeatures) → tahmini rollout-ödülü. En yüksek skorlu aday seçilir.
// Öğretmen = Oracle'ın karşı-olgusal rollout ödülü (BattleOracle.js). Bu dosya yalnız FEATURE çıkarır;
// eğitim/çıkarım ayrı (Faz 3b). Sektör-temelli durum (ham koordinat değil) → OPG ızgarası (8×6) yeniden kullanılır.
// ═══════════════════════════════════════════════════════════════════════════

const STATE_FEATURES_VERSION = 'stateFeatures.v1';
// v2 (2026-08-07): YEREL USTUNLUK oznitelikleri eklendi (projeksiyonlu yerel oran + hedef kutle
// payi + kanat orani). Surum ARTIRILMALI: eski modeller yeni vektorle calisamaz, uyumluluk
// kontrolu onlari eler. Bkz docs/KARAR-UZAYI-3.md
const CANDIDATE_FEATURES_VERSION = 'candidateFeatures.v2';
// FIRE_PREPARATION burada da olmali: yoksa o adaylar TUM-SIFIR intent one-hot alir ve model onlari
// ayirt edemez (gramere ekleyip burayi unutmak sessiz bir hata olurdu).
const FEATURE_INTENTS = ['HOLD', 'ADVANCE', 'MAIN_ATTACK', 'FIX_AND_FLANK', 'COUNTERATTACK', 'REGROUP', 'DISENGAGE', 'FIRE_PREPARATION'];
const FEATURE_TEMPOS = ['cautious', 'normal', 'aggressive'];

// ── Durum özellikleri: bir karar anında komutanın gördüğü (sektör dağılımı + global) ──
// ctx = opgBuildContext çıktısı (own[SECTORS], enemy[SECTORS], ownTotal, enemyTotal, role, ...)
// extra = { minEnemyDist, tick, maxTicks, ownCount, enemyCount }
function battleStateFeatures(ctx, extra = {}) {
    const S = (typeof OPG_SECTORS !== 'undefined') ? OPG_SECTORS : 48;
    const f = [];
    const ownTot = (ctx.ownTotal || 0) + 1e-6, enemyTot = (ctx.enemyTotal || 0) + 1e-6;
    // sektör dağılımları (normalize: her sektörün toplam içindeki payı) — konum-değişmez ölçek
    for (let s = 0; s < S; s++) f.push((ctx.own ? ctx.own[s] : 0) / ownTot);
    for (let s = 0; s < S; s++) f.push((ctx.enemy ? ctx.enemy[s] : 0) / enemyTot);
    // global bağlam
    f.push(Math.min(2, ctx.ownTotal / 1500));                        // mutlak öz güç (ölçekli)
    f.push(Math.min(2, ctx.enemyTotal / 1500));                      // mutlak düşman güç
    f.push(Math.min(3, ctx.ownTotal / enemyTot));                    // kuvvet oranı
    f.push(ctx.role === 'ATTACKER' ? 1 : 0);                         // rol one-hot
    f.push(ctx.role === 'DEFENDER' ? 1 : 0);
    f.push(Math.min(1, (extra.ownCount || 0) / 20));                 // birim sayıları
    f.push(Math.min(1, (extra.enemyCount || 0) / 20));
    f.push(Math.min(1, (extra.minEnemyDist != null ? extra.minEnemyDist : 1500) / 1500));  // temas mesafesi
    f.push(Math.min(1, (extra.tick || 0) / (extra.maxTicks || 4800)));  // savaş zamanı
    return f;
}
function battleStateFeatureNames() {
    const S = (typeof OPG_SECTORS !== 'undefined') ? OPG_SECTORS : 48;
    const names = [];
    for (let s = 0; s < S; s++) names.push('own_s' + s);
    for (let s = 0; s < S; s++) names.push('enemy_s' + s);
    names.push('ownTotalScaled', 'enemyTotalScaled', 'forceRatio', 'roleAttacker', 'roleDefender',
        'ownCount', 'enemyCount', 'minEnemyDist', 'battleTime');
    return names;
}

// ── Aday özellikleri: bir operasyon-adayının vektörü (model bunu state ile skorlar) ──
// candidate = operationGrammarGenerate çıktı elemanı; ctx = opgBuildContext (sektör yoğunlukları için)
function battleCandidateFeatures(candidate, ctx) {
    const COLS = (typeof OPG_COLS !== 'undefined') ? OPG_COLS : 8;
    const ROWS = (typeof OPG_ROWS !== 'undefined') ? OPG_ROWS : 6;
    const f = [];
    // intent one-hot
    for (const it of FEATURE_INTENTS) f.push(candidate.intent === it ? 1 : 0);
    // ana sektör konumu + oradaki yoğunluklar
    const ms = candidate.mainSector | 0;
    f.push((ms % COLS) / COLS);
    f.push(((ms / COLS) | 0) / ROWS);
    const enemyTot = (ctx.enemyTotal || 0) + 1e-6, ownTot = (ctx.ownTotal || 0) + 1e-6;
    f.push((ctx.enemy ? (ctx.enemy[ms] || 0) : 0) / enemyTot);       // ana sektörde düşman yoğunluğu
    f.push((ctx.own ? (ctx.own[ms] || 0) : 0) / ownTot);             // ana sektörde öz yoğunluk
    // flank sektör
    const hasFlank = candidate.flankSector != null;
    const fs = hasFlank ? (candidate.flankSector | 0) : 0;
    f.push(hasFlank ? 1 : 0);
    f.push(hasFlank ? (fs % COLS) / COLS : 0);
    f.push(hasFlank ? ((fs / COLS) | 0) / ROWS : 0);
    f.push(hasFlank ? (ctx.enemy ? (ctx.enemy[fs] || 0) : 0) / enemyTot : 0);
    // allocation
    const a = candidate.allocation || {};
    f.push(a.main || 0); f.push(a.fixing || 0); f.push(a.flank || 0); f.push(a.reserve || 0);
    // tempo one-hot + pursuit
    for (const tp of FEATURE_TEMPOS) f.push(candidate.tempo === tp ? 1 : 0);
    f.push(Math.min(1, (candidate.pursuitLimit || 300) / 500));

    // ── YEREL ÜSTÜNLÜK ÖZNİTELİKLERİ (v2) — ÖLÇÜLMÜŞ EKSİK ──
    // Oyuncunun ustunlugu OLCULDU: temas aninda 8.9 dost / 1.2 dusman; AI 6.9 / 3.4.
    // Yani oyuncu "hangi sektor" degil "orada USTUN muyum" sorusuna gore oynuyor.
    // Yukaridaki oznitelikler dusman ve oz yogunlugu AYRI AYRI (toplama bolunmus) veriyordu;
    // ORAN yoktu. Model bu haliyle "oraya gidersem ustun olur muyum" sorusunu GOREMIYORDU.
    // Buradaki uc oznitelik tam onu verir; adayin taahhut ettigi MAIN payi hesaba katilir.
    const _eps = 1e-6;
    const _dusMain = (ctx.enemy ? (ctx.enemy[ms] || 0) : 0);
    const _ozMain = (ctx.own ? (ctx.own[ms] || 0) : 0);
    const _taahhut = (a.main || 0) * (ctx.ownTotal || 0);          // MAIN'e ayrilan mutlak guc
    const _projeOran = (_ozMain + _taahhut) / (_dusMain + _eps);   // varista beklenen YEREL oran
    f.push(Math.min(3, _projeOran) / 3);                           // 0..1 kelepceli (3 = ezici ustunluk)
    f.push(Math.min(1, _dusMain / ((ctx.enemyTotal || 0) + _eps))); // hedefteki dusman KUTLESI (payi)
    // kanat icin ayni oran (kanat yoksa 0) — FIX_AND_FLANK kararlarinda kanadin gucu onemli
    const _dusFlank = hasFlank ? (ctx.enemy ? (ctx.enemy[fs] || 0) : 0) : 0;
    const _flankTaahhut = (a.flank || 0) * (ctx.ownTotal || 0);
    f.push(hasFlank ? Math.min(3, ((ctx.own ? (ctx.own[fs] || 0) : 0) + _flankTaahhut) / (_dusFlank + _eps)) / 3 : 0);
    return f;
}
function battleCandidateFeatureNames() {
    const names = [];
    for (const it of FEATURE_INTENTS) names.push('intent_' + it);
    names.push('mainCol', 'mainRow', 'mainEnemyDensity', 'mainOwnDensity',
        'hasFlank', 'flankCol', 'flankRow', 'flankEnemyDensity',
        'allocMain', 'allocFixing', 'allocFlank', 'allocReserve');
    for (const tp of FEATURE_TEMPOS) names.push('tempo_' + tp);
    names.push('pursuit');
    // v2 — yerel ustunluk (isim listesi vektorle AYNI uzunlukta kalmali)
    names.push('projeYerelOran', 'hedefKutlePayi', 'flankYerelOran');
    return names;
}

if (typeof module !== 'undefined') module.exports = {
    STATE_FEATURES_VERSION, CANDIDATE_FEATURES_VERSION,
    battleStateFeatures, battleCandidateFeatures, battleStateFeatureNames, battleCandidateFeatureNames
};
