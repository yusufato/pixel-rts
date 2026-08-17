// ARAMA EMRININ OMRU — 'AI hemen ezmesin' korumasi yazilmis ama BAGLANMAMIS.
// OLCULDU: medyan omur 11 tik (0.6sn), %27.4'u 2 TIK icinde eziliyor, %50.4'u 1 saniyede.
// Arama periyodu 100 tik; emir ideal olarak o kadar yasamali.
// UYARI: ezmenin MESRU sebepleri olabilir (dusman belirdi, tepki gerekiyor). Emri zorla
// tutturmak birimi oldurebilir -> olculmeden baglanmaz. Ama %27'sinin 0.1 SANIYEDE
// ezilmesi mesru tepkiyle aciklanamaz.
// ARAMANIN EMRI NE KADAR YASIYOR? `_laUntilTick` atanip HIC OKUNMUYOR (grep: tek gecis).
// Yani taban AI, aramanin emrini bir sonraki tikte ezebilir. Ne siklikta?
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const { ctx, hatalar } = tezgahKur();
if (hatalar.length) { console.log('HATA', hatalar); process.exit(1); }
const kod = `(() => {
  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
  openBattlefieldSession({ mode:"quick", mapId:-2, seed:680001, attackerSide:true,
    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
  BATTLE_REPLAY_KAYITSIZ = true;
  battleDeployManifest(battleBuildArmyManifest(6500,{maxUnits:48,combatFocused:true,varied:true,brainIntel4:true,isAttacker:false,pro:false}), false, {source:"eo", ally:true});
  startBattle(); SIM.headless = true;
  BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false;
  const izlenen = new Map();   // uid -> {hedefX,hedefY,verildi}
  const omur = [];             // emrin kac TIK yasadigi
  let st = 0;
  while (SIM.tick < 3600 && phase === PHASE.BATTLE) {
    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);
    // izlenen emirler hala duruyor mu?
    for (const [uid, e] of izlenen) {
      const u = SIM.units.find(x => x.id === uid);
      if (!u || u.dead) { omur.push(SIM.tick - e.verildi); izlenen.delete(uid); continue; }
      const t = u.manualMoveTarget;
      const ayni = t && Math.abs(t.x - e.hedefX) < 1 && Math.abs(t.y - e.hedefY) < 1;
      if (!ayni) { omur.push(SIM.tick - e.verildi); izlenen.delete(uid); }
    }
    battleLookaheadTick(st);
    // yeni verilen emirleri yakala
    for (const u of SIM.units) {
      if (u.dead || !u.isRed) continue;
      if ((u._laUntilTick|0) === SIM.tick + LA_EMIR_SURESI && u.manualMoveTarget) {
        izlenen.set(u.id, { hedefX: u.manualMoveTarget.x, hedefY: u.manualMoveTarget.y, verildi: SIM.tick });
      }
    }
  }
  for (const [uid, e] of izlenen) omur.push(SIM.tick - e.verildi);
  return JSON.stringify({ omur, emir: BATTLE_LA_SAYAC.emir, sure: LA_EMIR_SURESI });
})()`;
const r = JSON.parse(vm.runInContext(kod, ctx, {filename:'eo.js'}));
const o = r.omur.sort((a,b)=>a-b);
if (!o.length) { console.log('  emir yakalanamadi'); process.exit(0); }
const p = q => o[Math.min(o.length-1, Math.floor(o.length*q))];
console.log('  izlenen emir: ' + o.length + '   (LA_EMIR_SURESI = ' + r.sure + ' tik = ' + (r.sure/20).toFixed(0) + 'sn)');
console.log('  emir omru (tik):  medyan ' + p(0.5) + '   p25 ' + p(0.25) + '   p75 ' + p(0.75) + '   max ' + o[o.length-1]);
console.log('  saniye olarak  :  medyan ' + (p(0.5)/20).toFixed(1) + 'sn');
const hemen = o.filter(x=>x<=2).length, kisa = o.filter(x=>x<=20).length;
console.log('  2 TIK icinde ezilen : ' + hemen + ' = %' + (hemen/o.length*100).toFixed(1));
console.log('  1 SANIYE icinde     : ' + kisa + ' = %' + (kisa/o.length*100).toFixed(1));
console.log('  ARAMA PERIYODU 100 tik -> emir ideal olarak 100 tik yasamali');
