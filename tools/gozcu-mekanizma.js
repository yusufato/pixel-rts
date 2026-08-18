'use strict';
// GOZCU KURALI — MEKANIZMA KAPISI (mac kapisindan ONCE, dakikalar icinde)
//
// SORU: BATTLE_GOZCU_INTEL4 + BATTLE_GOZCU_KAT bayraklari
//   (a) orduya gercekten kesif ekliyor mu,
//   (b) topcunun "Gozcu Yok" oranini dusuruyor mu,
//   (c) topcu daha cok ates ediyor mu?
// Ucu de olculmeden mac kapisina girilmez (kapi 1 saat; bu 3 dakika).
//
//   node tools/gozcu-mekanizma.js --mac 4
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const MAC = Math.max(1, Number(arg('--mac', 4)) || 4);
const TOHUM0 = Number(arg('--tohum0', 101000)) || 101000;
const MAX_TIK = Number(arg('--maxtik', 2400)) || 2400;
const { ctx, hatalar } = tezgahKur();
if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }

function kos(seed, acik) {
    const kod = `(() => {
  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
  BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;
  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;
  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;
  BATTLE_GOZCU_INTEL4 = ${acik ? 'true' : 'false'};
  BATTLE_GOZCU_KAT = ${acik ? 2 : 3};
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;
  openBattlefieldSession({ mode:"quick", mapId:-2, seed:${seed}, attackerSide:true,
    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;
  const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,
    brainIntel4:true, isAttacker:false, pro:false });
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;
  battleDeployManifest(mv, false, { source:"gk", ally:true });
  startBattle(); SIM.headless = true;
  const kesif = (r) => SIM.units.filter(u => !u.dead && u.isRed === r &&
      (u.type === T.RECON || u.type === T.RECON_UAV)).length;
  const dolayli = (r) => SIM.units.filter(u => !u.dead && u.isRed === r &&
      (u.type === T.ARTILLERY || u.type === T.MORTAR || u.type === T.MLRS)).length;
  const k0 = { kesif: kesif(true), dolayli: dolayli(true), birim: SIM.units.filter(u=>u.isRed&&!u.dead).length };
  let firsat = 0, gozcuYok = 0, hazir = 0;
  let st = 0;
  while (SIM.tick < ${MAX_TIK} && phase === PHASE.BATTLE) {
    if (SIM.battle && SIM.battle.winnerSide !== null) break;
    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);
    if (SIM.tick % 10) continue;
    for (const u of SIM.units) {
      if (u.dead || !u.isRed) continue;
      if (u.type !== T.ARTILLERY && u.type !== T.MORTAR && u.type !== T.MLRS) continue;
      const st2 = STATS[u.type]; if (!st2) continue;
      let yakin = Infinity;
      for (const o of SIM.units) { if (o.dead || o.isRed === u.isRed) continue;
        const dd = Math.hypot(o.x - u.x, o.y - u.y); if (dd < yakin) yakin = dd; }
      if (yakin > (st2.range || 0)) continue;
      firsat++;
      if (u.combatState === 'Gözcü Yok') gozcuYok++;
      else if (u.combatState === 'READY') hazir++;
    }
  }
  return JSON.stringify({ seed:${seed}, acik:${acik}, kesif:k0.kesif, dolayli:k0.dolayli,
    birim:k0.birim, firsat, gozcuYok, hazir, tik: SIM.tick });
})()`;
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'gk-' + seed + '-' + acik + '.js' }));
}

console.log('GOZCU KURALI — MEKANIZMA KAPISI (' + MAC + ' tohum)');
console.log('');
const top = { false: { kesif:0, dolayli:0, birim:0, firsat:0, gozcuYok:0, hazir:0 },
              true:  { kesif:0, dolayli:0, birim:0, firsat:0, gozcuYok:0, hazir:0 } };
for (let i = 0; i < MAC; i++) {
    for (const acik of [false, true]) {
        const r = kos(TOHUM0 + i, acik);
        const t = top[acik];
        t.kesif += r.kesif; t.dolayli += r.dolayli; t.birim += r.birim;
        t.firsat += r.firsat; t.gozcuYok += r.gozcuYok; t.hazir += r.hazir;
        console.log('  tohum ' + r.seed + '  kural ' + (acik ? 'ACIK ' : 'kapali') +
            '  kesif ' + r.kesif + '  dolayli ' + r.dolayli + '  birim ' + r.birim +
            '  firsat ' + r.firsat + '  gozcuYok ' + r.gozcuYok +
            ' (%' + (r.firsat ? (r.gozcuYok / r.firsat * 100).toFixed(0) : '-') + ')');
    }
}
console.log('');
for (const acik of [false, true]) {
    const t = top[acik];
    console.log('  ' + (acik ? 'ACIK  ' : 'KAPALI') +
        '  kesif/mac ' + (t.kesif / MAC).toFixed(1) +
        '  dolayli/mac ' + (t.dolayli / MAC).toFixed(1) +
        '  birim/mac ' + (t.birim / MAC).toFixed(1) +
        '  GOZCU YOK %' + (t.firsat ? (t.gozcuYok / t.firsat * 100).toFixed(1) : '-') +
        '  HAZIR %' + (t.firsat ? (t.hazir / t.firsat * 100).toFixed(1) : '-'));
}
const a = top[true], k = top[false];
const dus = k.firsat && a.firsat ? (k.gozcuYok / k.firsat - a.gozcuYok / a.firsat) * 100 : 0;
console.log('');
console.log('  GOZCU YOK ORANI DEGISIMI: ' + (dus > 0 ? '-' : '+') + Math.abs(dus).toFixed(1) + ' puan');
console.log('  BEDEL: ordu ' + ((k.birim - a.birim) / MAC).toFixed(1) + ' birim kucuyor (gozcu parasi)');
console.log('');
console.log('  KARAR: ' + (dus > 10 ? 'mekanizma CALISIYOR -> mac kapisina girebilir'
    : 'etki kucuk -> mac kapisi HARCANMAZ'));
