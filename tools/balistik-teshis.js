// BALISTIK FUZE TESHISI: gercekten ates ediyor mu, vuruyor mu, ne zaman oluyor?
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const { ctx } = tezgahKur();

const tarif = JSON.parse(require('fs').readFileSync('qa-runtime/adaylar-duman.json', 'utf8'))
    .find(t => t.ad === 'KESIF-balistik-1');

const kod = '(() => {' +
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
    'BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;' +
    'BATTLE_RECIPE_RED = ' + JSON.stringify(tarif) + ';' +
    'openBattlefieldSession({ mode:"quick", mapId:-2, seed:2024, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
    'const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false });' +
    'battleDeployManifest(mv, false, { source:"teshis", ally:true });' +
    'startBattle();' +
    'const BT = T.BALLISTIC != null ? T.BALLISTIC : Object.keys(STATS).map(Number).find(k => STATS[k] && STATS[k].id === "ballistic_missile");' +
    'const bul = () => SIM.units.filter(u => u.type === BT && !u.dead);' +
    'const ph = SIM.headless; SIM.headless = true; let st = 0;' +
    'let atis = 0, oldu = null, ilkAtis = null, sonAtis = null;' +
    'let muhimmatBas = null, muhimmatSon = null, mesafeKayit = [];' +
    'const b0 = bul(); if (b0.length) muhimmatBas = b0[0].ammo;' +
    'let oncekiAmmo = muhimmatBas;' +
    'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {' +
    '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
    '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
    '  const b = bul();' +
    '  if (b.length) {' +
    '    const u = b[0];' +
    '    if (oncekiAmmo != null && u.ammo < oncekiAmmo) { atis++; if (ilkAtis == null) ilkAtis = SIM.tick; sonAtis = SIM.tick; }' +
    '    oncekiAmmo = u.ammo; muhimmatSon = u.ammo;' +
    '    if (SIM.tick % 400 === 0) {' +
    '      let enYakin = 1e9;' +
    '      for (const e of SIM.units) { if (e.dead || e.isRed === u.isRed) continue;' +
    '        const d = Math.hypot(e.x-u.x, e.y-u.y); if (d < enYakin) enYakin = d; }' +
    '      mesafeKayit.push({ sn: Math.round(SIM.tick*BATTLE_TICK_SEC), enYakinDusman: Math.round(enYakin), ammo: u.ammo });' +
    '    }' +
    '  } else if (oldu == null && oncekiAmmo != null) { oldu = SIM.tick; }' +
    '} } finally { SIM.headless = ph; }' +
    'const b2 = SIM.battle || {};' +
    'return JSON.stringify({ atis, ilkAtisSn: ilkAtis!=null?Math.round(ilkAtis*BATTLE_TICK_SEC):null,' +
    '  sonAtisSn: sonAtis!=null?Math.round(sonAtis*BATTLE_TICK_SEC):null,' +
    '  olduSn: oldu!=null?Math.round(oldu*BATTLE_TICK_SEC):null,' +
    '  muhimmatBas, muhimmatSon, mesafeKayit, minRangePx: STATS[BT] ? null : null,' +
    '  bitisSn: Math.round(SIM.tick*BATTLE_TICK_SEC), sebep: b2.outcomeReason });' +
    '})()';

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'balistik.js' }));
console.log('BALISTIK FUZE — seed2024, tek mac');
console.log('  ATIS SAYISI      : ' + r.atis + '   (mühimmat ' + r.muhimmatBas + ' -> ' + r.muhimmatSon + ')');
console.log('  ilk atis         : ' + (r.ilkAtisSn != null ? r.ilkAtisSn + 'sn' : 'HIC ATES ETMEDI'));
console.log('  son atis         : ' + (r.sonAtisSn != null ? r.sonAtisSn + 'sn' : '-'));
console.log('  ne zaman oldu    : ' + (r.olduSn != null ? r.olduSn + 'sn' : 'yasadi'));
console.log('  mac bitisi       : ' + r.bitisSn + 'sn (' + r.sebep + ')');
console.log('');
console.log('  ZAMAN / EN YAKIN DUSMAN MESAFESI (minRange = 1500px, ates edemez altinda):');
for (const m of r.mesafeKayit) {
    const durum = m.enYakinDusman < 1500 ? ' <-- MENZIL ALTI, ATES EDEMEZ' : '';
    console.log('    ' + String(m.sn).padStart(4) + 'sn   ' + String(m.enYakinDusman).padStart(5) + 'px   ammo ' + m.ammo + durum);
}
