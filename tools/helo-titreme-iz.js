// HELO TITREME IZI: teslim ucusunda bir helonun ardisik tiklerini AYNEN dok.
// Neden: evre kirilimi UCUS-teslim'de %90 yon-tersine-donus ve tik basina ~30px adim gosterdi
// (mikro sarsinti DEGIL, tam hizla ileri-geri). Hangi yazicinin hedefi ezdigini tahminle degil
// izle-ve-gor ile bulmak icin her tik: konum, targetX/Y, manualMoveTarget, unstick, kargo.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
const { ctx } = tezgahKur();

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const SEED = Number(arg('--seed', 3141));
const N = Number(arg('--tik', 40));   // kac ardisik tik dokulsun
const GERCEKCI_TABAN = JSON.parse(fs.readFileSync('qa-runtime/gercekci-taban.json', 'utf8'));

const kod = [
    '(() => {',
    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
    'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
    'BATTLE_RECIPE_RED = Object.assign({ ad:"IZ", rol:"attacker", zorunlu:{ transport_helo:2 }, tavan:{}, artik:[] }, ' + JSON.stringify(GERCEKCI_TABAN) + ');',
    'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + SEED + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
    'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"iz", ally:true });',
    'startBattle();',
    'const NT = Object.keys(STATS).map(Number).find(t => STATS[t] && STATS[t].id === "transport_helo");',
    'const sat = [];',
    'let hedefId = null, sayac = 0, oncekiX = null, oncekiY = null;',
    'const ph = SIM.headless; SIM.headless = true; let st = 0;',
    'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE && sayac < ' + N + ') {',
    '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
    '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
    '  for (const u of SIM.units) {',
    '    if (u.dead || u.type !== NT || !u.isRed) continue;',
    '    if (!u.cargo || u.cargo.length === 0) continue;',
    '    if (hedefId === null) hedefId = u.id;',
    '    if (u.id !== hedefId) continue;',
    '    const dx = oncekiX == null ? 0 : u.x - oncekiX, dy = oncekiY == null ? 0 : u.y - oncekiY;',
    '    oncekiX = u.x; oncekiY = u.y;',
    '    sat.push({ tik: SIM.tick, x: Math.round(u.x), y: Math.round(u.y),',
    '      adim: Math.round(Math.hypot(dx, dy)), dy: Math.round(dy),',
    '      tX: Math.round(u.targetX), tY: Math.round(u.targetY),',
    '      mmt: u.manualMoveTarget ? (Math.round(u.manualMoveTarget.x) + "," + Math.round(u.manualMoveTarget.y)) : "-",',
    '      mov: u.isMovingToManualTarget ? 1 : 0, hold: u._holdingPos ? 1 : 0,',
    '      unstick: u._unstickPoint ? (Math.round(u._unstickPoint.x) + "," + Math.round(u._unstickPoint.y)) : "-",',
    '      stall: u._motionStalls || 0, kargo: u.cargo.length, kalkti: u._ferryKalkti ? 1 : 0,',
    '      bosalt: u._ferryBosaltiyor ? 1 : 0, kacan: u.isFleeing ? 1 : 0, hp: Math.round(u.hp) });',
    '    sayac++;',
    '  }',
    '} } finally { SIM.headless = ph; }',
    'BATTLE_RECIPE_RED = null;',
    'return JSON.stringify(sat);',
    '})()'
].join('');

const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'iz.js' }));
console.log('HELO TITREME IZI — seed ' + SEED + ', ' + r.length + ' tik (yuklu helo)');
console.log('');
console.log('  tik'.padStart(6) + '     x'.padStart(7) + '     y'.padStart(7) + '  adim'.padStart(7) + '    dy'.padStart(7) +
    '     tX'.padStart(8) + '     tY'.padStart(8) + '   manualMoveTarget'.padStart(20) + ' mov'.padStart(5) + ' hold'.padStart(6) +
    '  unstick'.padStart(14) + ' stall'.padStart(7) + ' kargo'.padStart(7));
for (const s of r) {
    console.log(String(s.tik).padStart(6) + String(s.x).padStart(7) + String(s.y).padStart(7) +
        String(s.adim).padStart(7) + String(s.dy).padStart(7) +
        String(s.tX).padStart(8) + String(s.tY).padStart(8) + s.mmt.padStart(20) +
        String(s.mov).padStart(5) + String(s.hold).padStart(6) + s.unstick.padStart(14) +
        String(s.stall).padStart(7) + String(s.kargo).padStart(7));
}
