'use strict';
// MENZILE GIR — MEKANIZMA KAPISI
//
// KULLANICININ 4 MACINDAN: AI ile oyuncu ayni mesafede duruyor ama AI'nin silahi yetmiyor
// (mesafe/menzil orani AI 2.17-3.09 · oyuncu 1.24-1.82). Ates edebilir konumda gecen zaman
// AI %12-22 · oyuncu %23-35. Firsat/canli-ornek AI 0.16 · oyuncu 0.31.
//
// SORU: BATTLE_MENZILE_GIR bu orani gercekten degistiriyor mu, ve bedeli ne (olum)?
//   node tools/menzile-gir-mekanizma.js --mac 6
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const MAC = Math.max(1, Number(arg('--mac', 6)) || 6);
const TOHUM0 = Number(arg('--tohum0', 112000)) || 112000;
const MAX_TIK = Number(arg('--maxtik', 4400)) || 4400;
const { ctx, hatalar } = tezgahKur();
if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }

function kos(seed, acik) {
    const kod = `(() => {
  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
  BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;
  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;
  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;
  BATTLE_MENZILE_GIR = ${acik ? 'true' : 'false'};
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;
  openBattlefieldSession({ mode:"quick", mapId:-2, seed:${seed}, attackerSide:false,
    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;
  const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,
    brainIntel4:true, isAttacker:true, pro:false });
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;
  battleDeployManifest(mv, false, { source:"mg", ally:true });
  startBattle(); SIM.headless = true;
  BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false;

  const kisa = (u) => { const s = STATS[u.type];
    return s && s.weapons && s.weapons.length && !u.isIndirect && !u.isAir && u.range < 900; };
  let orn = 0, menzilde = 0, oran = 0;
  let st = 0;
  while (SIM.tick < ${MAX_TIK} && phase === PHASE.BATTLE) {
    if (SIM.battle && SIM.battle.winnerSide !== null) break;
    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);
    if (typeof battleLookaheadTick === "function") battleLookaheadTick(st);
    if (SIM.tick % 20) continue;
    for (const u of SIM.units) {
      if (u.dead || !u.isRed || !kisa(u)) continue;
      let ed = Infinity;
      for (const e of SIM.units) { if (e.dead || e.isRed === u.isRed || e.isAir) continue;
        const dd = Math.hypot(e.x - u.x, e.y - u.y); if (dd < ed) ed = dd; }
      if (ed === Infinity) continue;
      orn++; oran += ed / Math.max(1, u.range);
      if (ed <= u.range) menzilde++;
    }
  }
  const kSag = SIM.units.filter(u => !u.dead && u.isRed).length;
  const mSag = SIM.units.filter(u => !u.dead && !u.isRed).length;
  const oS = battleArmyObservation(true), oD = battleArmyObservation(false);
  return JSON.stringify({ seed:${seed}, acik:${acik}, orn, menzilde, oranOrt: orn ? oran/orn : 0,
    kSag, mSag, marj: Math.round(oS.effectiveValue - oD.effectiveValue),
    bind: (typeof BATTLE_BALANCE !== 'undefined' ? (BATTLE_BALANCE.menzileGirBind||0) : 0),
    sn: Math.round(SIM.tick * BATTLE_TICK_SEC) });
})()`;
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'mg-' + seed + '-' + acik + '.js' }));
}

console.log('MENZILE GIR — MEKANIZMA KAPISI (' + MAC + ' tohum, AI savunan + arama acik)');
console.log('');
const top = { false: { o: 0, m: 0, r: 0, k: 0, mj: 0 }, true: { o: 0, m: 0, r: 0, k: 0, mj: 0 } };
for (let i = 0; i < MAC; i++) {
    for (const acik of [false, true]) {
        const r = kos(TOHUM0 + i, acik);
        const t = top[acik];
        t.o += r.orn; t.m += r.menzilde; t.r += r.oranOrt * r.orn; t.k += r.kSag; t.mj += r.marj;
        console.log('  tohum ' + r.seed + '  kural ' + (acik ? 'ACIK ' : 'kapali') +
            '  menzilde %' + (r.orn ? (r.menzilde / r.orn * 100).toFixed(1) : '-') +
            '  mesafe/menzil ' + r.oranOrt.toFixed(2) +
            '  sag k/m ' + r.kSag + '/' + r.mSag +
            '  marj ' + (r.marj > 0 ? '+' : '') + r.marj);
    }
}
console.log('');
for (const acik of [false, true]) {
    const t = top[acik];
    console.log('  ' + (acik ? 'ACIK  ' : 'KAPALI') +
        '  kisa menzilli birim MENZILDE %' + (t.o ? (t.m / t.o * 100).toFixed(1) : '-') +
        '   ortalama mesafe/menzil ' + (t.o ? (t.r / t.o).toFixed(2) : '-') +
        '   sag kalan AI birimi ' + (t.k / MAC).toFixed(1) +
        '   ortalama marj ' + Math.round(t.mj / MAC));
}
const pk = top[false].o ? top[false].m / top[false].o : 0;
const pa = top[true].o ? top[true].m / top[true].o : 0;
console.log('');
console.log('  DEGISIM: menzilde gecen zaman %' + (pk * 100).toFixed(1) + ' -> %' + (pa * 100).toFixed(1));
console.log('  KARAR: ' + (pa > pk * 1.3 ? 'mekanizma CALISIYOR -> mac kapisina girebilir'
    : 'etki kucuk -> mac kapisi HARCANMAZ'));
