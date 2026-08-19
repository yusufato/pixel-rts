'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  UCUZ PUANLAYICI ÖNGÖRÜSÜ — "rollout'u neyle değiştirebiliriz?"
//
//  NEDEN: maliyet profili turun %94,5'inin rollout olduğunu gösterdi. Rollout'u
//  ucuzlatmanın iki yolu var: (a) her adımı ucuzlatmak (5Hz — ölçüldü), (b) BAZI adaylar
//  için rollout'u hiç koşmamak, ucuz bir puanla elemek. (b)'nin ön koşulu şu: ucuz puan,
//  tam rollout'un SIRALAMASINI tutturuyor mu?
//
//  Eleyicide ZATEN iki ucuz puanlayıcı var:
//    analitik  `battleLookaheadStatik(u,x,y)` — bedava, her adaya bakar
//    değer ağı `battleLookaheadAgSkor`        — analitik olarak en iyi LA_AG_ADAY adaya
//  Arkadaş incelemesinin 5. maddesi ÜÇÜNCÜ bir ucuz puanlayıcı (etki haritası) öneriyor.
//  Onu inşa etmeden önce mevcut ikisinin ne kadar isabetli olduğunu bilmek gerek —
//  yoksa aynı bilgiyi üçüncü kez hesaplamış oluruz.
//
//  ÖLÇÜLEN: her karar anında, her aranan birim için, her adayın
//    · analitik puanı
//    · değer ağı puanı (varsa)
//    · KISA rollout puanı (LA_KADEME tik)
//    · TAM rollout puanı (LA_UFUK tik)   ← gerçek hedef
//  Rapor: her ucuz puanın tam rollout ile Spearman sıra korelasyonu + "tam rollout'un
//  birincisini ilk 2'sinde tutma" oranı (kademeli elemenin gerçek ölçütü budur).
//
//  ⚠ SPEARMAN, PEARSON DEĞİL: karar SIRALAMAYA bakıyor, mutlak değere değil. İki puan
//  farklı ölçekte olabilir ve yine de aynı adayı seçtirir.
//
//    node tools/ucuz-puan-ongoru.js [--tohum 750000] [--nokta 4] [--ufuk 300] [--kisa 60]
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const SEED = Number(arg('--tohum', 750000)) || 750000;
const NOKTA = Math.max(1, Number(arg('--nokta', 4)) || 4);
const UFUK = Number(arg('--ufuk', 300)) || 300;
const KISA = Number(arg('--kisa', 60)) || 60;
const ARA = Number(arg('--ara', 400)) || 400;

const { ctx, hatalar } = tezgahKur();
if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }

const kod = `(() => {
  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;
  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;
  openBattlefieldSession({ mode:"quick", mapId:-2, seed:${SEED}, attackerSide:true,
    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;
  const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,
    brainIntel4:true, isAttacker:false, pro:false });
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;
  battleDeployManifest(mv, false, { source:"up", ally:true });
  startBattle(); SIM.headless = true;
  BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false;
  LA_UFUK = ${UFUK}; LA_DERIN = 5; LA_BIRIM = 20; LA_TUR_BIRIM = 0; LA_TIK_BIRIM = 0;
  if (typeof LA_KABA_ADIM !== "undefined") LA_KABA_ADIM = 1;
  if (typeof LA_KADEME !== "undefined") LA_KADEME = 0;

  const kayit = [];   // her birim-karari icin bir satir: adaylarin dort puani

  function birimOlc(uid, isRed, now) {
    const u0 = SIM.units.find(x => x.id === uid);
    if (!u0 || u0.dead) return;
    const adaylar = battleLookaheadEleVeKapi(u0);
    if (!adaylar || adaylar.length < 3) return;
    const derin = adaylar.slice(0, 5);
    if (!derin.some(a => a.kal)) { const k = adaylar.find(a => a.kal); if (k) derin.push(k); }
    if (derin.length < 3) return;

    const _g = BATTLE_SIM_GOLGE; BATTLE_SIM_GOLGE = true;
    const fork = battleForkCapture();
    const bas = battleLookaheadMarj(isRed);
    const sat = [];
    for (const a of derin) {
      /* ANALITIK: eleVeKapi zaten a._s'e yazmis olabilir; garanti icin yeniden hesapla. */
      const analitik = (typeof battleLookaheadStatik === "function")
        ? battleLookaheadStatik(u0, a.x, a.y) : null;
      const ag = (typeof battleLookaheadAgSkor === "function" && typeof battleValueNetHazir === "function"
        && battleValueNetHazir()) ? battleLookaheadAgSkor(u0, a.x, a.y) : null;

      const koy = (t) => {
        battleForkRestore(fork);
        const u = SIM.units.find(x => x.id === uid);
        if (!u) return null;
        u.controlOwner = "PLAYER"; u.manualTarget = null; u.attackTarget = null;
        u.targetX = a.x; u.targetY = a.y;
        u.manualMoveTarget = { x: a.x, y: a.y };
        u.isMovingToManualTarget = true; u._holdingPos = false;
        battleRolloutIlerlet(now, t);
        return battleLookaheadSkor(isRed, bas);
      };
      const kisa = koy(${KISA});
      const tam  = koy(${UFUK});
      sat.push({ analitik, ag, kisa, tam });
    }
    battleForkRestore(fork);
    BATTLE_SIM_GOLGE = _g;
    if (sat.length >= 3) kayit.push(sat);
  }

  let st = 0, nokta = 0;
  while (SIM.tick < ${(NOKTA + 1) * ARA + 50} && phase === PHASE.BATTLE && nokta < ${NOKTA}) {
    if (SIM.battle && SIM.battle.winnerSide !== null) break;
    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);
    if (SIM.tick % ${ARA} !== 0 || SIM.tick === 0) { battleLookaheadTick(st); continue; }
    nokta++;
    /* Karar anindaki birimleri KENDIMIZ oluruz (battleLookaheadTick'i cagirmadan) —
       boylece ayni durumda hem ucuz puanlari hem iki rollout'u alabiliriz. */
    const hedefler = SIM.units
      .filter(u => !u.dead && u.isRed && !u.loaded && !u.abandoned && !u.isAir && u.controlOwner !== "PLAYER")
      .sort((a, b) => (((STATS[b.type] && STATS[b.type].cost) || 0) - ((STATS[a.type] && STATS[a.type].cost) || 0)) || (a.id - b.id))
      .slice(0, 8).map(u => u.id);
    for (const uid of hedefler) birimOlc(uid, true, st);
    battleLookaheadTick(st);   // gercek maci ilerlet
  }
  return JSON.stringify({ seed:${SEED}, kisa:${KISA}, ufuk:${UFUK}, kayit });
})()`;

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'up.js' }));

// ── Spearman sıra korelasyonu (satır içi, sonra satırlar üzerinden ortalama) ──
function sira(v) {
    const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
    const s = new Array(v.length);
    for (let i = 0; i < idx.length; i++) s[idx[i][1]] = i;
    return s;
}
function spearman(a, b) {
    const n = a.length;
    if (n < 3) return null;
    const ra = sira(a), rb = sira(b);
    const ma = (n - 1) / 2;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) { const x = ra[i] - ma, y = rb[i] - ma; num += x * y; da += x * x; db += y * y; }
    return (da && db) ? num / Math.sqrt(da * db) : null;
}

const olcuAd = { analitik: 'analitik (bedava)', ag: 'değer ağı', kisa: 'kısa rollout ' + r.kisa + ' tik' };
const sonuc = {};
for (const k of Object.keys(olcuAd)) sonuc[k] = { rho: [], ilk1: 0, ilk2: 0, n: 0 };

for (const sat of r.kayit) {
    const tam = sat.map(x => x.tam);
    const enIyiTam = tam.indexOf(Math.max(...tam));
    for (const k of Object.keys(olcuAd)) {
        const v = sat.map(x => x[k]);
        if (v.some(x => x == null || !isFinite(x))) continue;
        const rho = spearman(v, tam);
        if (rho == null) continue;
        sonuc[k].rho.push(rho);
        sonuc[k].n++;
        const sirali = v.map((x, i) => [x, i]).sort((a, b) => b[0] - a[0]).map(p => p[1]);
        if (sirali[0] === enIyiTam) sonuc[k].ilk1++;
        if (sirali.slice(0, 2).includes(enIyiTam)) sonuc[k].ilk2++;
    }
}

console.log('');
console.log('UCUZ PUANLAYICI ÖNGÖRÜSÜ — tohum ' + r.seed + '   (tam rollout ' + r.ufuk + ' tik = hedef)');
console.log('  ' + r.kayit.length + ' birim-kararı · aday başına 2 rollout koşuldu (kısa + tam)');
console.log('');
console.log('  ' + 'ucuz puan'.padEnd(24) + 'n'.padStart(5) + 'Spearman ρ'.padStart(13) +
    'en iyiyi #1 seçti'.padStart(20) + 'en iyiyi ilk 2de'.padStart(19));
console.log('  ' + '─'.repeat(81));
for (const k of Object.keys(olcuAd)) {
    const s = sonuc[k];
    if (!s.n) { console.log('  ' + olcuAd[k].padEnd(24) + '    —   (hesaplanamadı / puan yok)'); continue; }
    const rho = s.rho.reduce((x, y) => x + y, 0) / s.n;
    console.log('  ' + olcuAd[k].padEnd(24) + String(s.n).padStart(5) + rho.toFixed(3).padStart(13) +
        ('%' + (s.ilk1 / s.n * 100).toFixed(0)).padStart(20) +
        ('%' + (s.ilk2 / s.n * 100).toFixed(0)).padStart(19));
}
console.log('');
console.log('  OKUMA: "en iyiyi ilk 2de" kademeli elemenin GERÇEK ölçütüdür — finalist 2 aday');
console.log('  seçiyoruz, tam rollout\'un birincisi o ikisinin içinde kalmalı. Rastgele seçimde');
console.log('  bu oran 2/aday sayısı ≈ %40 olurdu; ondan belirgin yüksek değilse ucuz puan');
console.log('  eleme için KULLANILAMAZ.');
console.log('');
