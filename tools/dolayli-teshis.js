// TUM DOLAYLI BIRIMLER ates ediyor mu? (balistik ozel bir vaka mi, genel bir sorun mu)
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const { ctx } = tezgahKur();

const tarif = JSON.parse(require('fs').readFileSync('qa-runtime/adaylar-duman.json', 'utf8'))
    .find(t => t.ad === 'KESIF-balistik-1');

const kod = '(() => {' +
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
    'BATTLE_RECIPE_RED = ' + JSON.stringify(tarif) + ';' +
    'openBattlefieldSession({ mode:"quick", mapId:-2, seed:2024, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
    'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"t", ally:true });' +
    'startBattle();' +
    'const izle = new Map();' +   // unitId -> {tip, ilkAmmo, atis, oldu, gorusPx, menzilPx, minPx}
    'for (const u of SIM.units) {' +
    '  const s = STATS[u.type]; if (!s) continue;' +
    '  const w = (s.weapons || []).find(x => x.indirect) || null;' +
    '  if (!w) continue;' +
    '  izle.set(u.id, { tip: s.name || s.id, kirmizi: !!u.isRed, ammo: u.ammo, atis: 0, oldu: null,' +
    '    menzil: Math.round((w.range||0)*75), minMenzil: Math.round((w.minRange||0)*75), gorus: Math.round((s.vision||0)*75) });' +
    '}' +
    'const ph = SIM.headless; SIM.headless = true; let st = 0;' +
    'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {' +
    '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
    '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
    '  for (const u of SIM.units) {' +
    '    const r = izle.get(u.id); if (!r) continue;' +
    '    if (u.dead) { if (r.oldu == null) r.oldu = SIM.tick; continue; }' +
    '    if (u.ammo < r.ammo) { r.atis += (r.ammo - u.ammo); }' +
    '    r.ammo = u.ammo;' +
    '  }' +
    '} } finally { SIM.headless = ph; }' +
    'return JSON.stringify([...izle.values()].map(r => ({ tip: r.tip, kirmizi: r.kirmizi, atis: r.atis,' +
    '  olduSn: r.oldu!=null?Math.round(r.oldu*BATTLE_TICK_SEC):null, menzil: r.menzil, minMenzil: r.minMenzil, gorus: r.gorus })));' +
    '})()';

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'dolayli.js' }));
console.log('DOLAYLI BIRIMLER — seed2024 (menzil/görüş px cinsinden)');
console.log('taraf  birim'.padEnd(30) + 'ATIS'.padStart(6) + '  öldü'.padStart(8) + '   menzil'.padStart(9) + '  minMenzil'.padStart(11) + '   görüş'.padStart(8));
for (const x of r.sort((a, b) => (a.kirmizi === b.kirmizi ? 0 : a.kirmizi ? -1 : 1) || b.atis - a.atis)) {
    console.log(((x.kirmizi ? 'KIRMIZI ' : 'mavi    ') + x.tip).padEnd(30) +
        String(x.atis).padStart(6) + String(x.olduSn != null ? x.olduSn + 'sn' : '-').padStart(8) +
        String(x.menzil).padStart(9) + String(x.minMenzil).padStart(11) + String(x.gorus).padStart(8));
}
const hic = r.filter(x => x.atis === 0);
console.log('');
console.log('HIC ATES ETMEYEN: ' + (hic.length ? hic.map(x => (x.kirmizi ? 'K:' : 'M:') + x.tip).join(', ') : '-'));
console.log('NOT: görüş < menzil olan birim KENDI BASINA hedef goremez; gozcu (kesif) gerekir.');
