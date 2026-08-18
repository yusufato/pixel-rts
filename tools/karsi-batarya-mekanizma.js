'use strict';
// KARSI-BATARYA MEKANIZMA KAPISI — AI dusman topcusuna ates ediyor mu?
//
// KULLANICININ 4 MACINDAN (kontrollu, ayni tohum/ayni AI ordusu): AI kendisini olduren
// dusman topcusuna 214 saniyede 1 KEZ ates etti (%0). Atislarinin %68'ini ZIRHLI'ya
// harcadi. Sebep BattleTargeting.js'teki `hasArea` kosulu.
//
// Bu arac RAKIBE TOPCU VEREREK olcer (varsayilan ordu her zaman topcu icermiyor):
// mavi tarafa 3 topcu zorlanir, kirmizinin (AI) atislarinin yuzde kaci onlara gidiyor.
//
//   node tools/karsi-batarya-mekanizma.js --mac 6
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const MAC = Math.max(1, Number(arg('--mac', 6)) || 6);
const TOHUM0 = Number(arg('--tohum0', 110000)) || 110000;
const MAX_TIK = Number(arg('--maxtik', 4400)) || 4400;
const { ctx, hatalar } = tezgahKur();
if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }

function kos(seed, acik) {
    const kod = `(() => {
  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
  BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;
  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;
  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;
  BATTLE_KARSI_BATARYA_HERKES = ${acik ? 'true' : 'false'};
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;
  openBattlefieldSession({ mode:"quick", mapId:-2, seed:${seed}, attackerSide:false,
    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;
  const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,
    brainIntel4:true, isAttacker:true, pro:false });
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;
  battleDeployManifest(mv, false, { source:"kb", ally:true });
  startBattle(); SIM.headless = true;
  BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false;

  /* MAVIYE TOPCU ZORLA: varsayilan ordu her zaman dolayli ates icermiyor; kusur ancak
     rakipte topcu VARSA gorunur. Kullanicinin macindaki kurgunun aynisi (TOPCU x3). */
  const mavi = SIM.units.filter(u => !u.isRed && !u.dead);
  let donusen = 0;
  for (const u of mavi) {
    if (donusen >= 3) break;
    if (u.type === T.ARTILLERY || u.type === T.MORTAR) { donusen++; continue; }
    const st = STATS[u.type];
    if (!st || !st.weapons || !st.weapons.length) continue;      // destek birimini bozma
    if (u.type === T.SUPPLY || u.type === T.ENGINEER) continue;
    u.type = T.ARTILLERY;
    const a = STATS[T.ARTILLERY];
    u.hp = u.maxHp = a.hp; u.range = a.range; u.vision = a.vision;
    u.maxAmmo = a.maxAmmo; u.ammo = a.maxAmmo;
    donusen++;
  }
  const topcuId = new Set(SIM.units.filter(u => !u.isRed && !u.dead &&
      (u.type === T.ARTILLERY || u.type === T.MORTAR)).map(u => u.id));

  /* AI'nin atislarini say: hedefi dusman topcusu mu? performAttack sarilir. */
  let kAtis = 0, kTopcuAtis = 0;
  const _eski = performAttack;
  performAttack = function (a, h) {
    if (a && a.isRed && h) { kAtis++; if (topcuId.has(h.id)) kTopcuAtis++; }
    return _eski.apply(this, arguments);
  };
  let st = 0;
  while (SIM.tick < ${MAX_TIK} && phase === PHASE.BATTLE) {
    if (SIM.battle && SIM.battle.winnerSide !== null) break;
    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);
    if (typeof battleLookaheadTick === "function") battleLookaheadTick(st);
  }
  performAttack = _eski;
  const sag = SIM.units.filter(u => !u.dead && topcuId.has(u.id)).length;
  const oS = battleArmyObservation(true), oD = battleArmyObservation(false);
  return JSON.stringify({ seed:${seed}, acik:${acik}, topcu: topcuId.size, sagTopcu: sag,
    kAtis, kTopcuAtis, marj: Math.round(oS.effectiveValue - oD.effectiveValue),
    sn: Math.round(SIM.tick * BATTLE_TICK_SEC) });
})()`;
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'kb-' + seed + '-' + acik + '.js' }));
}

console.log('KARSI-BATARYA MEKANIZMA KAPISI — ' + MAC + ' tohum (maviye 3 topcu zorlandi)');
console.log('');
const top = { false: { a: 0, t: 0, sag: 0, top: 0, marj: 0 }, true: { a: 0, t: 0, sag: 0, top: 0, marj: 0 } };
for (let i = 0; i < MAC; i++) {
    for (const acik of [false, true]) {
        const r = kos(TOHUM0 + i, acik);
        const k = top[acik];
        k.a += r.kAtis; k.t += r.kTopcuAtis; k.sag += r.sagTopcu; k.top += r.topcu; k.marj += r.marj;
        console.log('  tohum ' + r.seed + '  kural ' + (acik ? 'ACIK ' : 'kapali') +
            '  AI atis ' + String(r.kAtis).padStart(4) + '  topcuya ' + String(r.kTopcuAtis).padStart(3) +
            ' (%' + (r.kAtis ? (r.kTopcuAtis / r.kAtis * 100).toFixed(1) : '0') + ')' +
            '  sag topcu ' + r.sagTopcu + '/' + r.topcu + '  marj ' + (r.marj > 0 ? '+' : '') + r.marj);
    }
}
console.log('');
for (const acik of [false, true]) {
    const k = top[acik];
    console.log('  ' + (acik ? 'ACIK  ' : 'KAPALI') +
        '  AI atisinin topcuya giden payi %' + (k.a ? (k.t / k.a * 100).toFixed(1) : '-') +
        '   dusman topcusu sagkalim ' + k.sag + '/' + k.top +
        '   ortalama marj ' + Math.round(k.marj / MAC));
}
const pk = top[false].a ? top[false].t / top[false].a : 0;
const pa = top[true].a ? top[true].t / top[true].a : 0;
console.log('');
console.log('  DEGISIM: topcuya giden atis payi %' + (pk * 100).toFixed(1) + ' -> %' + (pa * 100).toFixed(1));
console.log('  KARAR: ' + (pa > pk * 1.5 ? 'mekanizma CALISIYOR -> mac kapisina girebilir'
    : 'etki kucuk -> mac kapisi HARCANMAZ'));
