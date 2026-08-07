// TEK MACIN ANATOMISI — "beonai neyi yanlis yapiyor?" (kullanici sorusu)
//
// ONEMLI: beonai BIRIM SECMEZ. Ordu kompozisyonu iki kolda da BIREBIR AYNIDIR (ayni tohum, ayni
// kurucu). Model yalniz OPERASYONEL PLANI secer: niyet / ana sektor / kuvvet bolusumu / tempo.
// Bu arac tek bir tohumda:
//   (1) IKI ORDUYU dokerek matchup'i gosterir (kim kime karsi)
//   (2) her karar aninda KOD-AI ne dedi / BEONAI ne dedi — yan yana
//   (3) marj zaman icinde nasil ayrisiyor (nerede kaybediliyor)
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const SEED = Number(arg('--seed', 202));
const SURUM = arg('--surum', 'beonai-karisim');
const ORNEK = Math.max(100, Number(arg('--ornek', 300)) || 300);

const { ctx } = tezgahKur();

function kos(surum) {
    const kod = [
        '(() => {',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;',
        'BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'BATTLE_BEONAI_RED = ' + (surum ? JSON.stringify(surum) : 'null') + '; BATTLE_BEONAI_BLUE = null;',
        'BATTLE_RECIPE_RED = null;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + SEED + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"tm", ally:true });',
        'startBattle();',
        'const ordu = { kirmizi: {}, mavi: {} };',
        'for (const u of SIM.units) { const id = (STATS[u.type]||{}).id || u.type;',
        '  const t = u.isRed ? ordu.kirmizi : ordu.mavi; t[id] = (t[id]||0)+1; }',
        'const zaman = [], kararlar = [];',
        'let sonPlan = null;',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '  const ctrl = [...BATTLE_CONTROLLERS.values()].find(c => c.side === true);',
        '  const p = ctrl && ctrl.operationalPlan;',
        '  if (p) { const imza = p.kind + "|" + (p.taskContracts||[]).map(c => c.groupRole+":"+(c.unitIds||[]).length+"@"+(c.sector||"-")).join(" ");',
        '    if (imza !== sonPlan) { sonPlan = imza; kararlar.push({ t: SIM.tick, imza }); } }',
        '  if (SIM.tick % ' + ORNEK + ') continue;',
        '  let kd = 0, md = 0;',
        '  for (const u of SIM.units) { if (u.dead || u.loaded) continue; const v = (STATS[u.type]||{}).cost || 0;',
        '    if (u.isRed) kd += v; else md += v; }',
        '  zaman.push({ t: SIM.tick, kirmizi: kd, mavi: md, marj: kd - md });',
        '} } finally { SIM.headless = ph; }',
        'const oS = battleArmyObservation(true), oD = battleArmyObservation(false);',
        'BATTLE_BEONAI_RED = null;',
        'return JSON.stringify({ ordu, zaman, kararlar, marj: Math.round(oS.effectiveValue - oD.effectiveValue) });',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'tm.js' }));
}

const a = kos(null), b = kos(SURUM);

console.log('TEK MAC ANATOMISI — tohum ' + SEED + '   kod-AI vs ' + SURUM);
console.log('');
console.log('  ORDULAR (iki kolda da AYNI — beonai birim SECMEZ):');
const sirala = o => Object.entries(o).sort((x, y) => y[1] - x[1]).map(([k, v]) => k + ' ' + v).join(', ');
console.log('    KIRMIZI (saldiran): ' + sirala(a.ordu.kirmizi));
console.log('    MAVI  (savunan)  : ' + sirala(a.ordu.mavi));
const ayniOrdu = JSON.stringify(a.ordu) === JSON.stringify(b.ordu);
console.log('    -> iki kolun ordulari ' + (ayniOrdu ? 'BIREBIR AYNI (dogrulandi)' : '*** FARKLI — kurgu hatasi ***'));
console.log('');
console.log('  MARJ ZAMAN ICINDE (kirmizi deger - mavi deger):');
console.log('    ' + 'sn'.padStart(5) + 'kod-AI'.padStart(10) + SURUM.slice(0, 9).padStart(11) + '  fark'.padStart(9));
const n = Math.min(a.zaman.length, b.zaman.length);
for (let i = 0; i < n; i++) {
    const x = a.zaman[i], y = b.zaman[i];
    console.log('    ' + String(Math.round(x.t * 0.05)).padStart(5) + String(x.marj).padStart(10) +
        String(y.marj).padStart(11) + ((y.marj - x.marj > 0 ? '+' : '') + (y.marj - x.marj)).padStart(9));
}
console.log('    ' + 'SON'.padStart(5) + String(a.marj).padStart(10) + String(b.marj).padStart(11) +
    ((b.marj - a.marj > 0 ? '+' : '') + (b.marj - a.marj)).padStart(9));
console.log('');
console.log('  PLAN DEGISIKLIKLERI (ilk 10):');
console.log('    kod-AI: ' + a.kararlar.length + ' degisim   ' + SURUM + ': ' + b.kararlar.length + ' degisim');
for (let i = 0; i < 10; i++) {
    const x = a.kararlar[i], y = b.kararlar[i];
    if (!x && !y) break;
    console.log('      ' + (x ? Math.round(x.t * 0.05) + 'sn ' + x.imza.slice(0, 62) : '-'));
    console.log('      ' + (y ? Math.round(y.t * 0.05) + 'sn ' + y.imza.slice(0, 62) : '-') + '   <- model');
}
