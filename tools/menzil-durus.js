// MENZIL DURUSU (range delta) — A/B, taraf-basi
//
// TESHIS (kullanicinin 2 YENI maci, 2026-08-08): tedarik duzeltmesi CNRA'yi orduya soktu ama AI onu
// KULLANAMIYOR. Ayni silah: insanin elinde 3 adet 3065 hasar / 25 yedi (oran 122:1), AI'in elinde
// 2 adet 511 hasar / 520 yedi (oran 0.98:1), 2/2 oldu.
// SEBEP: AI'in uzun menzillileri mac icinde ONE GELIYOR (1273 -> 880 -> 719px, elinde 2600px silah)
// ve ates yiyor (baski 6.2/12.2/20.2/84.9; insanin uzun menzillileri 0.0).
// Konuslandirma duzeltmesi onlari GERIYE koydu, YURUTME one getiriyor.
//
// KODDA ZATEN VAR AMA KAPALI: BATTLE_INTEL4_DELTAS.range = false
//   "UZUN-menzilli birim (range>=520) STRIKE'ta bile 0.9x menzilde durup vurur" (js/Unit.js)
// Bu A/B onu YALNIZ KIRMIZIDA acar (yeni taraf-basi delta destegi).
//
// BIND KANITI: uzun menzillilerin "dusmana mesafe / kendi menzili" orani ve BASKIsi olculur.
// Oran yukselmiyorsa kural calismamis demektir ve marj tablosu ANLAMSIZ.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 12)) || 12);
const ATLA = Math.max(0, Number(arg('--atla', 24)) || 0);
const HAVUZ = []; for (let i = 0; i < 96; i++) HAVUZ.push(100000 + i * 137);
const TOHUMLAR = HAVUZ.slice(ATLA, ATLA + N);
const { ctx } = tezgahKur();

function kos(seed, kirmiziSaldiran, acik) {
    const kod = [
        '(() => {',
        'BATTLE_RECIPE_RED = null;',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
        'BATTLE_INTEL4_DELTAS_RED = ' + (acik ? '{ range: true }' : 'null') + ';',
        'BATTLE_INTEL4_DELTAS_BLUE = null;',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:' + kirmiziSaldiran + ', durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:' + (!kirmiziSaldiran) + ' }), false, { source:"md", ally:true });',
        'startBattle();',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'let oranTop = 0, oranN = 0, baskiTop = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '  if (SIM.tick % 40 === 0) {',
        '    const uzun = SIM.units.filter(u => !u.dead && u.isRed && (u.range || 0) >= 520);',
        '    const karsi = SIM.units.filter(u => !u.dead && !u.isRed);',
        '    for (const u of uzun) { let mn = 1e9;',
        '      for (const v of karsi) { const dd = Math.hypot(v.x - u.x, v.y - u.y); if (dd < mn) mn = dd; }',
        '      if (mn < 1e9 && u.range > 0) { oranTop += mn / u.range; oranN++; baskiTop += (u.suppression || 0); } } }',
        '} } finally { SIM.headless = ph; }',
        'const oK = battleArmyObservation(true), oM = battleArmyObservation(false);',
        'BATTLE_INTEL4_DELTAS_RED = null;',
        'return JSON.stringify({ marj: Math.round(oK.effectiveValue - oM.effectiveValue),',
        '  oran: oranN ? oranTop / oranN : 0, baski: oranN ? baskiTop / oranN : 0, n: oranN });',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'md.js' }));
}

console.log('MENZIL DURUSU (range delta) — YALNIZ KIRMIZIDA, ' + TOHUMLAR.length + ' tohum x 2 rol');
console.log('  tohumlar ' + TOHUMLAR[0] + '..' + TOHUMLAR[TOHUMLAR.length - 1]);
console.log('');
const fark = [], oA = [], oB = [], bA = [], bB = [];
for (const s of TOHUMLAR) for (const rol of [true, false]) {
    const A = kos(s, rol, false), B = kos(s, rol, true);
    fark.push(B.marj - A.marj);
    oA.push(A.oran); oB.push(B.oran); bA.push(A.baski); bB.push(B.baski);
}
const ort = a => a.reduce((x, y) => x + y, 0) / a.length;
console.log('  BIND KANITI — uzun menzillilerin "dusmana mesafe / kendi menzili":');
console.log('    KAPALI ' + ort(oA).toFixed(2) + '   ACIK ' + ort(oB).toFixed(2) +
    (ort(oB) > ort(oA) + 0.02 ? '   -> kural CALISTI' : '   *** DEGISMEDI, kural baglanmadi ***'));
console.log('    baski: KAPALI ' + ort(bA).toFixed(1) + '   ACIK ' + ort(bB).toFixed(1));
console.log('');
const o = ort(fark);
const sd = Math.sqrt(fark.reduce((a, b) => a + (b - o) ** 2, 0) / Math.max(1, fark.length - 1));
const se = sd / Math.sqrt(fark.length);
console.log('  ══ ESLESTIRILMIS MARJ FARKI (kirmizi lehine) ══');
console.log('     ' + (o > 0 ? '+' : '') + Math.round(o) + '   std.hata ' + Math.round(se) +
    '   t ' + (se ? (o / se).toFixed(2) : '-') + '   n=' + fark.length +
    '   lehte ' + fark.filter(x => x > 0).length + '/' + fark.length);
