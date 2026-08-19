'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  ARAMA PROFİLİ — "tam güçte tur süresi NEREYE gidiyor?"
//
//  Kullanıcı kararı (2026-08-19): AI tam güçte çalışsın, maliyet optimize edilsin.
//  Optimizasyonu tahminle yapmak bu depoda defalarca yanılttı (en son: "darboğaz rollout"
//  sanılmıştı, ölçünce ELEYİCİ çıkmıştı — ağ aday başına çağrılıyordu, 500 CNN/tur).
//  Bu araç önce ölçer: bir arama turunun süresi hangi parçalara bölünüyor?
//
//  ÖLÇÜLEN PARÇALAR (hepsi aynı turda, aynı koşuda):
//    eleme      — `battleLookaheadEleVeKapi` (aday üretimi + yayılım kapısı + değer ağı)
//    fork       — `battleForkCapture`
//    restore    — `battleForkRestore` (aday başına bir kez)
//    rollout    — `stepSim` çağrılarının toplamı  ← teorik olarak derin×ufuk×birim
//    skor       — `battleLookaheadSkor` + kanal/rol terimleri
//    kalan      — turun ölçülmeyen kısmı (yukarıdakilerin dışında ne varsa)
//
//  ⚠ SARMALAMA MALİYETİ: her çağrıya bir `Date.now()` çifti eklenir. stepSim tur başına
//  binlerce kez çağrılıyor ama Date.now() ~20ns; saniyeler mertebesindeki tur süresinin
//  yanında ihmal edilebilir. Yine de mutlak değil ORAN okunmalı.
//
//    node tools/arama-profil.js [--tohum 740000] [--nokta 3] [--ufuk 300] [--derin 5]
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const SEED = Number(arg('--tohum', 740000)) || 740000;
const NOKTA = Math.max(1, Number(arg('--nokta', 3)) || 3);
const UFUK = Number(arg('--ufuk', 300)) || 300;
const DERIN = Number(arg('--derin', 5)) || 5;
const ARA = Number(arg('--ara', 500)) || 500;
const KADEME = Number(arg('--kademe', 0)) || 0;   // 0 = kapali (tam guc, on eleme yok)
const KABA = Number(arg('--kaba', 1)) || 1;       // 1 = sim ile ayni (20Hz) · 4 = 5Hz

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
  battleDeployManifest(mv, false, { source:"ap", ally:true });
  startBattle(); SIM.headless = true;
  BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false;
  LA_UFUK = ${UFUK}; LA_DERIN = ${DERIN}; LA_TIK_BIRIM = 0; LA_BIRIM = 20; LA_TUR_BIRIM = 0;
  if (typeof LA_KADEME !== "undefined") LA_KADEME = ${KADEME};
  if (typeof LA_KABA_ADIM !== "undefined") LA_KABA_ADIM = ${KABA};

  /* SARMALAMA — hepsi ust duzey \`function\` bildirimi oldugu icin global ozellik ve
     yazilabilir. (Bir onceki aracimda \`performAttack\`i sarmaya calisip coktum: o bir
     Unit METODU idi, global degil. Once bildirim turune bakiliyor.) */
  const P = { eleme:0, fork:0, restore:0, rollout:0, skor:0, n:{eleme:0,fork:0,restore:0,rollout:0,skor:0} };
  const sar = (ad, kova) => {
    const eski = globalThis[ad];
    if (typeof eski !== "function") return false;
    globalThis[ad] = function () {
      const t0 = Date.now();
      try { return eski.apply(this, arguments); }
      finally { P[kova] += Date.now() - t0; P.n[kova]++; }
    };
    return true;
  };
  const sarildi = {
    eleme:   sar("battleLookaheadEleVeKapi", "eleme"),
    fork:    sar("battleForkCapture", "fork"),
    restore: sar("battleForkRestore", "restore"),
    rollout: sar("stepSim", "rollout"),
    skor:    sar("battleLookaheadSkor", "skor")
  };

  /* STEPSIM ICI DAGILIM — rollout %94 ise, o %94'un icinde ne var?
     unit.update bir SINIF METODU (Unit.prototype), global fonksiyon degil; ayri sarilir. */
  const S = { birim:0, carpisma:0, grid:0, kural:0, mayin:0, siper:0, hasar:0, olum:0,
              ktrl:0, komut:0, dagger:0, hash:0, ornek:0, n:0 };
  (function () {
    const um = (typeof Unit !== "undefined" && Unit.prototype && Unit.prototype.update);
    if (um) {
      Unit.prototype.update = function () {
        const t0 = Date.now();
        try { return um.apply(this, arguments); } finally { S.birim += Date.now() - t0; S.n++; }
      };
    }
    const sar2 = (ad, kova) => {
      const eski = globalThis[ad];
      if (typeof eski !== "function") return;
      globalThis[ad] = function () {
        const t0 = Date.now();
        try { return eski.apply(this, arguments); } finally { S[kova] += Date.now() - t0; }
      };
    };
    sar2("battleControllersDrive", "ktrl");
    sar2("flushPendingPlayerCommands", "komut");
    sar2("battleMaybeCaptureDecisionSnapshot", "dagger");
    sar2("battleMaybeRecordHash", "hash");
    sar2("battleBalanceSample", "ornek");
    sar2("resolveCollisions", "carpisma");
    sar2("updateBattleRules", "kural");
    sar2("updateMines", "mayin");
    sar2("updateTrenches", "siper");
    sar2("battleProcessPendingHits", "hasar");
    sar2("battleApplyDeathEffects", "olum");
  })();

  const olcum = [];
  let st = 0, nokta = 0;
  while (SIM.tick < ${(NOKTA + 1) * ARA + 50} && phase === PHASE.BATTLE && nokta < ${NOKTA}) {
    if (SIM.battle && SIM.battle.winnerSide !== null) break;
    st += BATTLE_TICK_MS;
    /* DIS TIK ROLLOUT DEGIL: sayaci once sifirlayip disaridaki stepSim'i dusuyoruz,
       yoksa gercek simulasyonun tiki "rollout" gibi gorunurdu. */
    const _r0 = P.rollout, _rn0 = P.n.rollout;
    stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
    P.rollout = _r0; P.n.rollout = _rn0;
    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);
    if (SIM.tick % ${ARA} !== 0 || SIM.tick === 0) { battleLookaheadTick(st); continue; }
    nokta++;
    for (const k of Object.keys(P)) if (k !== "n") P[k] = 0;
    for (const k of Object.keys(S)) S[k] = 0;
    for (const k of Object.keys(P.n)) P.n[k] = 0;
    const s0 = (typeof BATTLE_LA_SAYAC !== "undefined") ? BATTLE_LA_SAYAC.arananan | 0 : 0;
    const t0 = Date.now();
    battleLookaheadTick(st);
    const tur = Date.now() - t0;
    const s1 = (typeof BATTLE_LA_SAYAC !== "undefined") ? BATTLE_LA_SAYAC.arananan | 0 : 0;
    olcum.push({ tik: SIM.tick, birim: SIM.units.filter(u => !u.dead).length, aranan: s1 - s0,
      tur, eleme: P.eleme, fork: P.fork, restore: P.restore, rollout: P.rollout, skor: P.skor,
      nRollout: P.n.rollout, nRestore: P.n.restore, nEleme: P.n.eleme,
      ic: { birim:S.birim, carpisma:S.carpisma, kural:S.kural, mayin:S.mayin, siper:S.siper, hasar:S.hasar, olum:S.olum,
            ktrl:S.ktrl, komut:S.komut, dagger:S.dagger, hash:S.hash, ornek:S.ornek, nBirim:S.n } });
  }
  return JSON.stringify({ seed:${SEED}, ufuk:${UFUK}, derin:${DERIN}, kademe:${KADEME}, kaba:${KABA}, sarildi, olcum,
    kademeElenen: (typeof BATTLE_LA_SAYAC !== "undefined") ? BATTLE_LA_SAYAC.kademeElenen : 0 });
})()`;

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'ap.js' }));
const eksik = Object.entries(r.sarildi).filter(([, v]) => !v).map(([k]) => k);
console.log('');
console.log('ARAMA PROFİLİ — tohum ' + r.seed + '   ufuk ' + r.ufuk + ' · derin ' + r.derin +
    (r.kademe ? ('   · kademe ' + r.kademe + ' tik') : '   · kademe kapalı') +
    ((r.kaba > 1) ? ('   · KABA ADIM ×' + r.kaba + ' (' + Math.round(20 / r.kaba) + 'Hz)') : '   · 20Hz'));
if (eksik.length) console.log('  ⚠ SARILAMAYAN (global fonksiyon değil): ' + eksik.join(', ') + ' — o satır 0 görünür');
console.log('');
if (!r.olcum.length) { console.log('  ölçüm yok'); process.exit(0); }
console.log('  ' + 'tik'.padStart(6) + 'birim'.padStart(6) + 'aranan'.padStart(7) + 'TUR'.padStart(9) +
    'eleme'.padStart(9) + 'fork'.padStart(8) + 'restore'.padStart(9) + 'rollout'.padStart(10) +
    'skor'.padStart(8) + 'kalan'.padStart(8) + '   stepSim');
for (const o of r.olcum) {
    const kalan = o.tur - (o.eleme + o.fork + o.restore + o.rollout + o.skor);
    console.log('  ' + String(o.tik).padStart(6) + String(o.birim).padStart(6) + String(o.aranan).padStart(7) +
        (o.tur + 'ms').padStart(9) + (o.eleme + 'ms').padStart(9) + (o.fork + 'ms').padStart(8) +
        (o.restore + 'ms').padStart(9) + (o.rollout + 'ms').padStart(10) + (o.skor + 'ms').padStart(8) +
        (kalan + 'ms').padStart(8) + String(o.nRollout).padStart(10));
}
const T = (f) => r.olcum.reduce((s, o) => s + f(o), 0);
const tur = T(o => o.tur) || 1;
console.log('');
console.log('  PAY DAĞILIMI (toplam ' + tur + 'ms):');
const parcalar = [['rollout (stepSim)', T(o => o.rollout)], ['eleme (aday+kapı+ağ)', T(o => o.eleme)],
    ['restore', T(o => o.restore)], ['fork capture', T(o => o.fork)], ['skor', T(o => o.skor)]];
let toplandi = 0;
for (const [ad, v] of parcalar.sort((a, b) => b[1] - a[1])) {
    toplandi += v;
    console.log('    ' + ad.padEnd(24) + String(v).padStart(7) + 'ms   %' + (v / tur * 100).toFixed(1));
}
console.log('    ' + 'kalan (ölçülmeyen)'.padEnd(24) + String(tur - toplandi).padStart(7) + 'ms   %' +
    ((tur - toplandi) / tur * 100).toFixed(1));
console.log('');
/* STEPSIM ICI */
if (r.olcum[0] && r.olcum[0].ic) {
    const roll = T(o => o.rollout) || 1;
    const ic = [['unit.update', T(o => o.ic.birim)], ['resolveCollisions', T(o => o.ic.carpisma)],
        ['updateBattleRules', T(o => o.ic.kural)], ['updateMines', T(o => o.ic.mayin)],
        ['updateTrenches', T(o => o.ic.siper)], ['bekleyen hasar', T(o => o.ic.hasar)],
        ['olum efektleri', T(o => o.ic.olum)],
        ['RAKIP KONTROLOR', T(o => o.ic.ktrl)], ['oyuncu komut kuyrugu', T(o => o.ic.komut)],
        ['DAgger yakalama', T(o => o.ic.dagger)], ['hash kaydi', T(o => o.ic.hash)],
        ['denge ornekleyici', T(o => o.ic.ornek)]];
    let ict = 0;
    console.log('');
    console.log('  ROLLOUT ICI (stepSim ' + roll + 'ms):');
    for (const [ad, v] of ic.sort((a, b) => b[1] - a[1])) {
        ict += v;
        console.log('    ' + ad.padEnd(22) + String(v).padStart(7) + 'ms   %' + (v / roll * 100).toFixed(1));
    }
    console.log('    ' + 'kalan (grid+diger)'.padEnd(22) + String(roll - ict).padStart(7) + 'ms   %' +
        ((roll - ict) / roll * 100).toFixed(1));
    console.log('    birim guncelleme sayisi ' + T(o => o.ic.nBirim));
}
console.log('');
console.log('  stepSim çağrısı ' + T(o => o.nRollout) + '   ·   restore ' + T(o => o.nRestore) +
    '   ·   eleme ' + T(o => o.nEleme) + '   ·   aranan birim ' + T(o => o.aranan));
/* BEKLENEN, KADEMEYI DE HESABA KATAR — yoksa kademe acikken "gercek beklenenden az"
   diye yaniltici gorunurdu (ilk surumde oyle basiyordu). */
const kabaB = Math.max(1, r.kaba || 1);
const bekl = Math.round((r.kademe
    ? T(o => o.aranan) * (r.derin * r.kademe + 2 * r.ufuk)
    : T(o => o.aranan) * r.derin * r.ufuk) / kabaB);
console.log('  BEKLENEN stepSim = aranan × derin × ufuk = ' + bekl +
    (T(o => o.nRollout) > bekl * 1.15 ? '   ⚠ GERÇEK BUNDAN FAZLA — fazlalık nereden?' : '   ✓ tutuyor'));
console.log('');
