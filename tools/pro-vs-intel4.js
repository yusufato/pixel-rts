// INTEL4-PRO vs INTEL4 — taraf-basi, eslestirilmis.
// Mezuniyet olcutu (kullanici): >=%75 ustunluk. Bugun 6 motor degisikligi yapildi; pro'nun intel4'e
// karsi durumu yeniden olculmeli (degisikliklerin cogu IKI beyni de etkiliyor, ama pro-deltalari degil).
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 12)) || 12);
const ATLA = Math.max(0, Number(arg('--atla', 64)) || 0);
const HAVUZ = []; for (let i = 0; i < 96; i++) HAVUZ.push(100000 + i * 137);
const TOHUMLAR = HAVUZ.slice(ATLA, ATLA + N);
const { ctx } = tezgahKur();

// proKirmizi=true -> KIRMIZI pro, MAVI duz intel4.  false -> tersi (taraf yanliligi goturulur)
function kos(seed, kirmiziSaldiran, proKirmizi) {
    const kod = [
        '(() => {',
        'BATTLE_RECIPE_RED = null;',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4PRO_RED = ' + (proKirmizi ? 'true' : 'false') + ';',
        'BATTLE_INTEL4PRO_BLUE = ' + (proKirmizi ? 'false' : 'true') + ';',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:' + kirmiziSaldiran + ', durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:' + (!kirmiziSaldiran) + ', pro:' + (!proKirmizi) + ' }), false, { source:"pv", ally:true });',
        'startBattle();',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '} } finally { SIM.headless = ph; }',
        'const oK = battleArmyObservation(true), oM = battleArmyObservation(false);',
        'const b = SIM.battle || {};',
        'return JSON.stringify({ marj: Math.round(oK.effectiveValue - oM.effectiveValue),',
        '  kazanan: b.winnerSide === true ? "kirmizi" : (b.winnerSide === false ? "mavi" : "berabere") });',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'pv.js' }));
}

console.log('INTEL4-PRO vs INTEL4 — ' + TOHUMLAR.length + ' tohum x 2 rol x 2 taraf = ' + (TOHUMLAR.length * 4) + ' mac');
console.log('  tohumlar ' + TOHUMLAR[0] + '..' + TOHUMLAR[TOHUMLAR.length - 1] + '  (bugunku 6 motor degisikliginden SONRA)');
console.log('');
const proMarj = []; let proGalip = 0, mac = 0;
for (const s of TOHUMLAR) for (const rol of [true, false]) for (const proK of [true, false]) {
    const r = kos(s, rol, proK);
    // pro'nun lehine marj
    proMarj.push(proK ? r.marj : -r.marj);
    mac++;
    if ((proK && r.kazanan === 'kirmizi') || (!proK && r.kazanan === 'mavi')) proGalip++;
    if (mac % 12 === 0) { try { require('fs').writeSync(1, '    ...' + mac + '/' + (TOHUMLAR.length * 4) + ' mac\n'); } catch (e) { } }
}
const ort = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const o = ort(proMarj);
const sd = Math.sqrt(proMarj.reduce((a, b) => a + (b - o) ** 2, 0) / Math.max(1, proMarj.length - 1));
const se = sd / Math.sqrt(proMarj.length);
console.log('');
console.log('  ══ PRO LEHINE ESLESTIRILMIS MARJ ══');
console.log('     ' + (o > 0 ? '+' : '') + Math.round(o) + '   std.hata ' + Math.round(se) +
    '   t ' + (se ? (o / se).toFixed(2) : '-') + '   n=' + proMarj.length +
    '   lehte ' + proMarj.filter(x => x > 0).length + '/' + proMarj.length);
console.log('  ══ GALIBIYET: pro ' + proGalip + '/' + mac + ' = %' + Math.round(proGalip / mac * 100) +
    '   (mezuniyet olcutu: >=%75) ══');
