'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  EMIR BAYATLAMASI — "arama T aninda karar verir, emir T+k'da inerse ne kaybeder?"
//
//  NEDEN: Worker (PLAN-SIRADAKI 2. madde) aramanin TAM ayarini oyuna tasimanin bilinen
//  tek yolu. Fizibilite olculdu ve MALIYET sorun DEGIL (fork 612KB, serilestirme 10.3ms,
//  arama turu 2834ms → %0.4). Asil risk GECIKME: worker'in emri ~2.8sn (≈56 tik) sonra
//  iner, oysa karar T anindaki dunyaya gore verilmisti.
//
//  Bu arac worker YAZILMADAN once o riski olcer — aramanin KENDI para biriminde
//  (rollout skoru), bir saatlik mac kapisi harcamadan.
//
//  YONTEM (her karar icin):
//    T   : arama karar verir -> c(T) noktasi
//    T+k : ayni birim icin UC skor, hepsi ayni forktan:
//          s_kal   = "yerinde kal"                      (taban)
//          s_bayat = c(T) noktasinin SIMDIKI skoru      (worker'in verecegi emir)
//          s_taze  = simdi hesaplanan en iyi aday       (ana-is-parcaciginin emri)
//    KORUNAN DEGER = (s_bayat - s_kal) / (s_taze - s_kal)
//    1.0 = gecikme bedava · 0.0 = emir degersiz · <0 = ZARARLI
//
//  Skorlama aramanin kendi yolunun aynisidir (fork -> isinla -> LA_UFUK tik oynat ->
//  battleLookaheadSkor), boylece sayilar aramanin ic olcegiyle kiyaslanabilir.
//
//    node tools/emir-bayatlama.js --tohum 3 --gecikme 60 --karar 40
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 3)) || 3);
const TOHUM0 = Number(arg('--tohum0', 730000)) || 730000;
const GECIKME = Math.max(1, Number(arg('--gecikme', 60)) || 60);
const KARAR = Math.max(5, Number(arg('--karar', 40)) || 40);
const MAX_TIK = Number(arg('--maxtik', 4000)) || 4000;

function kos(ctx, seed) {
    const kod = `(() => {
  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;
  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;
  openBattlefieldSession({ mode:"quick", mapId:-2, seed:${seed}, attackerSide:true,
    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;
  const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,
    brainIntel4:true, isAttacker:false, pro:false });
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;
  battleDeployManifest(mv, false, { source:"eb", ally:true });
  startBattle(); SIM.headless = true;
  BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false;

  /* TEK NOKTA SKORU — aramanin battleLookaheadBirimKarari icindeki rollout'unun aynisi.
     Cagiran fork/restore'u KENDI yonetir; bu fonksiyon zemini kalici bozmaz. */
  const noktaSkor = (uid, px, py, isRed, now, fork, bas) => {
    battleForkRestore(fork);
    const u = SIM.units.find(x => x.id === uid);
    if (!u) return null;
    u.controlOwner = 'PLAYER';
    u.manualTarget = null; u.attackTarget = null;
    u.targetX = px; u.targetY = py;
    u.manualMoveTarget = { x: px, y: py };
    u.isMovingToManualTarget = true; u._holdingPos = false;
    let s = now;
    for (let i = 0; i < LA_UFUK && phase === PHASE.BATTLE; i++) {
      s += BATTLE_TICK_MS; stepSim(s, BATTLE_TICK_SEC, battleControllersDrive, false);
    }
    return battleLookaheadSkor(isRed, bas);
  };

  const kayit = [];
  const bekleyen = [];
  let st = 0;
  while (SIM.tick < ${MAX_TIK} && phase === PHASE.BATTLE && kayit.length < ${KARAR}) {
    if (SIM.battle && SIM.battle.winnerSide !== null) break;
    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);

    for (let i = bekleyen.length - 1; i >= 0 && kayit.length < ${KARAR}; i--) {
      const w = bekleyen[i];
      if (SIM.tick < w.tik + ${GECIKME}) continue;
      bekleyen.splice(i, 1);
      const u = SIM.units.find(x => x.id === w.uid);
      if (!u || u.dead) { kayit.push({ oldu: 1 }); continue; }
      const _g = BATTLE_SIM_GOLGE; BATTLE_SIM_GOLGE = true;
      const fork = battleForkCapture();
      const bas = battleLookaheadMarj(true);
      const sKal = noktaSkor(w.uid, u.x, u.y, true, st, fork, bas);
      const sBayat = noktaSkor(w.uid, w.x, w.y, true, st, fork, bas);
      battleForkRestore(fork);
      const u2 = SIM.units.find(x => x.id === w.uid);
      const adaylar = u2 ? battleLookaheadEleVeKapi(u2) : null;
      let sTaze = null, tazeX = null, tazeY = null;
      if (adaylar) {
        for (const a of adaylar.slice(0, LA_DERIN)) {
          const sc = noktaSkor(w.uid, a.x, a.y, true, st, fork, bas);
          if (sc != null && (sTaze == null || sc > sTaze)) { sTaze = sc; tazeX = a.x; tazeY = a.y; }
        }
      }
      battleForkRestore(fork);
      BATTLE_SIM_GOLGE = _g;
      if (sKal == null || sBayat == null || sTaze == null) continue;
      kayit.push({ oldu: 0, sKal: sKal, sBayat: sBayat, sTaze: sTaze,
        mesafe: Math.round(Math.hypot(w.x - u.x, w.y - u.y)),
        tazeFark: (tazeX == null) ? null : Math.round(Math.hypot(tazeX - w.x, tazeY - w.y)) });
    }

    if (SIM.tick % LA_PERIYOT_TIK !== 0) continue;
    const oncekiEmir = BATTLE_LA_SAYAC.emir;
    battleLookaheadTick(st);
    if (BATTLE_LA_SAYAC.emir === oncekiEmir) continue;
    for (const u of SIM.units) {
      if (u.dead || !u.isRed) continue;
      if ((u._laUntilTick|0) !== SIM.tick + LA_EMIR_SURESI) continue;
      const t = u.manualMoveTarget; if (!t) continue;
      bekleyen.push({ uid: u.id, x: t.x, y: t.y, tik: SIM.tick });
    }
  }
  return JSON.stringify({ seed:${seed}, kayit: kayit, tik: SIM.tick });
})()`;
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'eb-' + seed + '.js' }));
}

function main() {
    const { ctx, hatalar } = tezgahKur();
    if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }
    console.log('EMIR BAYATLAMASI — gecikme ' + GECIKME + ' tik (' + (GECIKME / 20).toFixed(1) + 'sn), ' +
        N + ' tohum, hedef ' + KARAR + ' karar/tohum');
    console.log('');
    const hepsi = [];
    let oldu = 0;
    for (let i = 0; i < N; i++) {
        const seed = TOHUM0 + i;
        const t0 = Date.now();
        const r = kos(ctx, seed);
        for (const k of r.kayit) { if (k.oldu) oldu++; else hepsi.push(k); }
        console.log('  tohum ' + seed + '   ' + r.kayit.length + ' karar   ' +
            Math.round((Date.now() - t0) / 1000) + 'sn');
    }
    if (!hepsi.length) { console.log('  olcum yok'); process.exit(0); }
    const oranlar = [];
    let tazeUstun = 0, bayatZararli = 0;
    for (const k of hepsi) {
        const payda = k.sTaze - k.sKal;
        if (Math.abs(payda) < 1e-9) continue;
        oranlar.push((k.sBayat - k.sKal) / payda);
        if (k.sTaze > k.sBayat) tazeUstun++;
        if (k.sBayat < k.sKal) bayatZararli++;
    }
    if (!oranlar.length) { console.log('  degerlendirilebilir karar yok (taze == kal)'); process.exit(0); }
    /* HAVUZLANMIS ORAN — asil olcu BU. Oranlarin MEDYANI kirilgan: payda (taze-kal)
       sifira yaklasan kararlarda oran patliyor (ilk kosuda ortalama 1.98 cikti, oysa
       medyan 0.98 idi — bu bir isaret degil, bolme gurultusu). Havuzlanmis oran
       "aramanin TOPLAM urettigi degerin ne kadari gecikmeden sag cikti" sorusunun
       dogrudan cevabi ve tek bir carpik karardan etkilenmiyor. */
    let payBayat = 0, payTaze = 0;
    for (const k of hepsi) { payBayat += (k.sBayat - k.sKal); payTaze += (k.sTaze - k.sKal); }
    const havuz = payTaze !== 0 ? payBayat / payTaze : NaN;
    oranlar.sort((a, b) => a - b);
    const p = (q) => oranlar[Math.min(oranlar.length - 1, Math.floor(oranlar.length * q))];
    const ort = oranlar.reduce((a, b) => a + b, 0) / oranlar.length;
    const mesafe = hepsi.map(k => k.mesafe).sort((a, b) => a - b);
    console.log('');
    console.log('  degerlendirilen karar: ' + oranlar.length + '   (bu arada olen birim: ' + oldu + ')');
    console.log('  KORUNAN DEGER — HAVUZLANMIS (asil olcu): ' + (havuz * 100).toFixed(1) + '%');
    console.log('    ham: bayat toplam ' + Math.round(payBayat) + '  vs  taze toplam ' + Math.round(payTaze) + '  (kal tabanina gore)');
    console.log('  karar-basi oran (kirilgan, bilgi icin): medyan ' + p(0.5).toFixed(2) +
        '   ortalama ' + ort.toFixed(2));
    console.log('    p25 ' + p(0.25).toFixed(2) + '   p75 ' + p(0.75).toFixed(2));
    console.log('  taze emir bayattan IYI: %' + (tazeUstun / hepsi.length * 100).toFixed(1));
    console.log('  bayat emir "yerinde kal"dan KOTU (zararli): %' + (bayatZararli / hepsi.length * 100).toFixed(1));
    console.log('  ' + GECIKME + ' tik sonra hedefe kalan mesafe: medyan ' +
        mesafe[Math.floor(mesafe.length / 2)] + 'px');
    console.log('');
    const med = havuz;
    if (med >= 0.8) console.log('  OKUMA: gecikme UCUZ -> Worker duz yoldan tasarlanabilir.');
    else if (med >= 0.4) console.log('  OKUMA: gecikme KAYIP veriyor -> worker ONGORULU olmali (dunyayi k tik ilerletip oyle arasin).');
    else console.log('  OKUMA: gecikme YIKICI -> duz worker aramanin degerini yer; once ongoru tasarimi.');
}

main();
