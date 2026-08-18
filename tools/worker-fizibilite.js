'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  WORKER FIZIBILITESI — aramayi ayri bir is parcacigina tasimak ne kadara mal olur?
//
//  NEDEN SIMDI: aramanin TAM ayardaki degeri +735 (t 3.55, taban ustunde) olculdu,
//  ama canli oyunda o ayar oynatilamiyor (en kotu tik 3636ms). Tam gucu oyuna
//  tasimanin bilinen tek yolu Worker.
//
//  ANAHTAR ICGORU: `battleForkCapture()` ZATEN dunyanin tam serilestirmesi ve
//  `tools/fork-derin-denetim.js` onun EKSIKSIZ oldugunu olcru (8 nokta, 43 bin alan,
//  FARK 0). Yani worker'a gonderilecek mesajin ne olacagi arastirilacak bir sey degil
//  — fork'un kendisi. Bu arac o mesajin MALIYETINI olcer:
//    · fork ne kadar buyuk (bayt)
//    · JSON.stringify / parse kac ms  (postMessage'in structured clone'u ile ayni sinif)
//    · arama turunun kendisi kac ms   (kiyas taban)
//  Karar kurali: serilestirme, arama turunun yaninda KUCUK kalmali; yoksa worker
//  kazanci yer.
//
//    node tools/worker-fizibilite.js [--tohum 720000] [--nokta 3]
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const SEED = Number(arg('--tohum', 720000)) || 720000;
const NOKTA = Math.max(1, Number(arg('--nokta', 3)) || 3);
const ARA = Number(arg('--ara', 600)) || 600;

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
  battleDeployManifest(mv, false, { source:"wf", ally:true });
  startBattle(); SIM.headless = true;
  BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false;

  const olcum = [];
  let st = 0, nokta = 0;
  while (SIM.tick < ${(NOKTA + 1) * ARA + 50} && phase === PHASE.BATTLE && nokta < ${NOKTA}) {
    if (SIM.battle && SIM.battle.winnerSide !== null) break;
    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);
    if (SIM.tick % ${ARA} !== 0 || SIM.tick === 0) { battleLookaheadTick(st); continue; }
    nokta++;

    const _g = BATTLE_SIM_GOLGE; BATTLE_SIM_GOLGE = true;
    // 1) FORK MALIYETI
    let t0 = Date.now(); const f = battleForkCapture(); const tCap = Date.now() - t0;
    t0 = Date.now(); const js = JSON.stringify(f); const tStr = Date.now() - t0;
    t0 = Date.now(); const geri = JSON.parse(js); const tPar = Date.now() - t0;
    t0 = Date.now(); battleForkRestore(geri); const tRes = Date.now() - t0;
    BATTLE_SIM_GOLGE = _g;

    // 2) ARAMA TURUNUN KENDISI (kiyas taban) — TAM ayar
    const _e = { u: LA_UFUK, d: LA_DERIN, b: LA_BIRIM, t: LA_TIK_BIRIM };
    LA_UFUK = 100; LA_DERIN = 2; LA_TIK_BIRIM = 0;
    t0 = Date.now(); battleLookaheadTick(st); const tArama = Date.now() - t0;
    LA_UFUK = _e.u; LA_DERIN = _e.d; LA_BIRIM = _e.b; LA_TIK_BIRIM = _e.t;

    olcum.push({ tik: SIM.tick, birim: SIM.units.filter(u => !u.dead).length,
      bayt: js.length, tCap, tStr, tPar, tRes, tArama });
  }
  return JSON.stringify({ seed:${SEED}, olcum });
})()`;

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'wf.js' }));
console.log('WORKER FIZIBILITESI — tohum ' + r.seed);
console.log('');
console.log('  ' + 'tik'.padStart(5) + 'birim'.padStart(7) + '  fork(KB)'.padStart(10) +
    'capture'.padStart(9) + 'stringify'.padStart(11) + 'parse'.padStart(8) + 'restore'.padStart(9) +
    '   ARAMA TURU');
for (const o of r.olcum) {
    console.log('  ' + String(o.tik).padStart(5) + String(o.birim).padStart(7) +
        String(Math.round(o.bayt / 1024)).padStart(10) +
        (o.tCap + 'ms').padStart(9) + (o.tStr + 'ms').padStart(11) + (o.tPar + 'ms').padStart(8) +
        (o.tRes + 'ms').padStart(9) + ('   ' + o.tArama + 'ms').padStart(14));
}
if (!r.olcum.length) { console.log('  olcum yok'); process.exit(0); }
const ort = (f) => r.olcum.reduce((s, o) => s + f(o), 0) / r.olcum.length;
const seri = ort(o => o.tStr) + ort(o => o.tPar);
const arama = ort(o => o.tArama);
console.log('');
console.log('  ORTALAMA: fork ' + Math.round(ort(o => o.bayt) / 1024) + 'KB   ' +
    'serilestirme (stringify+parse) ' + seri.toFixed(1) + 'ms   arama turu ' + arama.toFixed(0) + 'ms');
console.log('  SERILESTIRME / ARAMA orani: %' + (seri / Math.max(1, arama) * 100).toFixed(1));
console.log('');
if (seri < arama * 0.15) {
    console.log('  KARAR: worker MANTIKLI — mesaj maliyeti aramanin yaninda kucuk.');
    console.log('         Ana is parcaciginda kalan yalniz ~' + Math.round(seri) + 'ms/tur (60 FPS = 16.7ms/kare).');
} else {
    console.log('  KARAR: DIKKAT — serilestirme aramanin %' + (seri / arama * 100).toFixed(0) +
        "'i kadar; worker kazanci onemli olcude yer.");
}
