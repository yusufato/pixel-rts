// JAM MEKANIZMA TESHISI: baloncuktaki dron tiklerinin YUZDE KACI fiilen karistiriliyor?
// TAM (eski) beklenti %100 . KISMI beklenti uavControlLoss x jammable
//   recon_uav 0.75x0.9=0.68 . armed_uav 0.75x0.8=0.60 . kamikaze 0.75x1.0=0.75
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const { ctx } = tezgahKur();
const KISMI = !process.argv.includes('--tamjam');
const RECON = process.argv.includes('--jamrecon');
const _si = process.argv.indexOf('--seed');
const SEED = _si >= 0 ? Number(process.argv[_si + 1]) : 2024;
const t = JSON.parse(require('fs').readFileSync('qa-runtime/jammer-test2.json', 'utf8'));
const sal = t.find(x => x.ad === 'SAL-DRONCU'), sav = t.find(x => x.ad === 'SAV-JAMMERLI');

const kod = '(() => {' +
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
    'BATTLE_JAM_PARTIAL = ' + KISMI + '; BATTLE_JAM_RECON = ' + RECON + ';' +
    'BATTLE_RECIPE_RED = ' + JSON.stringify(sal) + '; BATTLE_RECIPE_BLUE = ' + JSON.stringify(sav) + ';' +
    'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + SEED + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
    'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:true }), true, { source:"j", ally:false });' +
    'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"j", ally:true });' +
    'startBattle();' +
    'const say = new Map();' +   // tip -> { baloncukTik, karistirilanTik }
    'const ph = SIM.headless; SIM.headless = true; let st = 0;' +
    'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {' +
    '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
    '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
    '  for (const u of SIM.units) { if (u.dead || !u.jammable) continue;' +
    '    const inBubble = (SIM.tick - (u.jammedTick || -99)) <= 1; if (!inBubble) continue;' +
    '    const ad = (STATS[u.type] && STATS[u.type].name) || u.type;' +
    '    let r = say.get(ad); if (!r) { r = { baloncuk: 0, karistirilan: 0, jammable: u.jammable }; say.set(ad, r); }' +
    '    r.baloncuk++;' +
    '    const jt = u._jamTik || 0; if (jt > (u.__oncekiJamTik || 0)) r.karistirilan++; u.__oncekiJamTik = jt; }' +
    '} } finally { SIM.headless = ph; }' +
    'return JSON.stringify([...say.entries()].map(([ad, r]) => ({ ad, ...r })));' +
    '})()';

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'jam.js' }));
console.log('JAM MEKANIZMASI — seed' + SEED + '   [' + (KISMI ? 'KISMI (0.75 x jammable)' : 'TAM (%100, eski)') + ']');
console.log('  birim'.padEnd(26) + 'baloncukTik'.padStart(12) + '  karistirilan'.padStart(14) + '  ORAN'.padStart(8) + '  beklenen'.padStart(10));
for (const x of r) {
    const oran = x.baloncuk ? x.karistirilan / x.baloncuk : 0;
    const bek = KISMI ? 0.75 * x.jammable : 1;
    console.log('  ' + String(x.ad).padEnd(24) + String(x.baloncuk).padStart(12) + String(x.karistirilan).padStart(14) +
        ('%' + Math.round(oran * 100)).padStart(8) + ('%' + Math.round(bek * 100)).padStart(10));
}
if (!r.length) console.log('  (hic jammable birim baloncuga girmedi)');
