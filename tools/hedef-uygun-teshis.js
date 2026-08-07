// HEDEF UYGUNLUGU TESHISI — "AI vuramayacagi hedefe SALDIR emri veriyor" kusuru
//
// OLCULEN KUSUR (hava-hava calismasi sirasinda cikti): BattleController'in SALDIR emri yalniz
// "dusman tarafta mi" diye bakiyordu. Kilitlerin %44.6'si birimin HIC vuramayacagi hedefeydi
// (havan->IHA 92, MBT->SIHA 58, MANPADS->kara 19). Boyle bir birim nisan alip BEKLER, ates etmez.
//
// IKI SEY AYRI OLCULUR (tuzak A1 — mekanizma metrigi mac sonucundan ayri okunur):
//   1. MEKANIZMA: taraf basina "vuramayacagi hedefe kilitli" tik orani. Duzeltme calisiyorsa ~0.
//   2. MAC: taraf-basi bayrakla ESLESTIRILMIS fark (ayni tohum, yalniz KIRMIZI'da duzeltme).
//
// Kadro DOGAL birakilir (hava zorlanmaz) — kusur havan/MBT/MANPADS'i de vuruyor, yani gunluk ordu.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 12)) || 12);
// 48 tohum: ilk 24 mevcut havuz (onceki olcumlerle karsilastirilabilir), kalani determinist uzanti.
const HAVUZ = [202, 2024, 3141, 777, 11, 333, 4001, 4003, 4007, 4013, 4019, 4021,
               4027, 4031, 4037, 4041, 4043, 4049, 4051, 4057, 4063, 4069, 4073, 4079,
               4091, 4093, 4099, 4111, 4127, 4129, 4133, 4139, 4153, 4157, 4159, 4177,
               4201, 4211, 4217, 4219, 4229, 4231, 4241, 4243, 4253, 4259, 4261, 4271];
const TOHUMLAR = HAVUZ.slice(0, N);

const { ctx } = tezgahKur();

// duzelt: 'yok' (taban, iki taraf da eski davranis) | 'kirmizi' (yalniz KIRMIZI duzeltilmis)
function kos(duzelt, seed) {
    const kod = [
        '(() => {',
        'BATTLE_HEDEF_UYGUN = false;',   // taban: eski davranis
        'BATTLE_HEDEF_UYGUN_RED = ' + (duzelt === 'kirmizi' ? 'true' : 'null') + ';',
        'BATTLE_HEDEF_UYGUN_BLUE = null;',
        'BATTLE_HAVA_HAVA = true;',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;',
        'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',   // simetrik beyin
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'BATTLE_BEONAI_RED = null; BATTLE_BEONAI_BLUE = null;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        // MAVI ORDUSU: acikca kurulmali (yoksa mavi bos sahaya cikar — kirmizi 12/12 kazanir, kol gecersiz olur).
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"hu", ally:true });',
        'startBattle();',
        // BAGLANMA KANITI (tuzak B2): iki taraf da gercekten ordu kurdu mu?
        'const _n = (kk) => SIM.units.filter(u => !!u.isRed === kk).length;',
        'const _birimM = _n(false), _birimK = _n(true);',
        // ── SAYAC: taraf basina kilit ve "vuramayacagi hedefe kilit" ──
        'const s = { k: { kilit: 0, bos: 0 }, m: { kilit: 0, bos: 0 } };',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '  if (SIM.tick % 20) continue;',
        '  for (const u of SIM.units) {',
        '    if (u.dead || !u.attackTarget || u.attackTarget.dead) continue;',
        '    const t = u.isRed ? s.k : s.m;',
        '    t.kilit++;',
        '    if (!unitCanEngage(STATS[u.type], STATS[u.attackTarget.type])) t.bos++;',
        '  }',
        '} } finally { SIM.headless = ph; }',
        'const oS = battleArmyObservation(true), oD = battleArmyObservation(false);',
        'const b = SIM.battle || {};',
        'BATTLE_HEDEF_UYGUN_RED = null; BATTLE_HEDEF_UYGUN = true;',
        'return JSON.stringify({',
        '  kBosPct: s.k.kilit ? +(s.k.bos / s.k.kilit * 100).toFixed(1) : 0,',
        '  mBosPct: s.m.kilit ? +(s.m.bos / s.m.kilit * 100).toFixed(1) : 0,',
        '  marj: Math.round(oS.effectiveValue - oD.effectiveValue),',
        '  birimM: _birimM, birimK: _birimK,',
        '  kirmiziKazandi: b.winnerSide === true ? 1 : 0, sure: Math.round(SIM.tick * 0.05) });',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'hu.js' }));
}

console.log('HEDEF UYGUNLUGU TESHISI — ' + TOHUMLAR.length + ' tohum, DOGAL kadro, simetrik beyin (intel4-pro)');
console.log('  marj = KIRMIZI - MAVI. Duzeltme yalniz KIRMIZI\'da acilir -> fark tamamen bu kusurdan gelir.');
console.log('');
console.log('  ' + 'kol'.padEnd(22) + 'KIRMIZI bos-kilit%'.padStart(19) + 'MAVI bos-kilit%'.padStart(17) +
    'ort.marj'.padStart(10) + 'K galibiyet'.padStart(13));
const sonuc = {};
for (const [ad, d] of [['taban (ikisi de eski)', 'yok'], ['KIRMIZI duzeltilmis', 'kirmizi']]) {
    const r = TOHUMLAR.map(s => kos(d, s));
    sonuc[ad] = r;
    const o = f => r.reduce((a, x) => a + x[f], 0) / r.length;
    console.log('  ' + ad.padEnd(22) + o('kBosPct').toFixed(1).padStart(19) + o('mBosPct').toFixed(1).padStart(17) +
        Math.round(o('marj')).toString().padStart(10) +
        (r.reduce((a, x) => a + x.kirmiziKazandi, 0) + '/' + r.length).padStart(13));
    if (d === 'yok') console.log('    BAGLANMA KANITI — birim sayisi  MAVI ' + r[0].birimM + ' / KIRMIZI ' + r[0].birimK);
}
console.log('');
const t = sonuc['taban (ikisi de eski)'], y = sonuc['KIRMIZI duzeltilmis'];
const f = y.map((x, i) => x.marj - t[i].marj);
const ort = f.reduce((a, b) => a + b, 0) / f.length;
const std = Math.sqrt(f.reduce((a, b) => a + (b - ort) * (b - ort), 0) / Math.max(1, f.length - 1));
const se = std / Math.sqrt(f.length);
console.log('  ESLESTIRILMIS MARJ FARKI (KIRMIZI lehine): ' + (ort > 0 ? '+' : '') + Math.round(ort) +
    '   std.hata ' + Math.round(se) + '   t ' + (se ? (ort / se).toFixed(2) : '-') +
    '   lehte ' + f.filter(x => x > 0).length + '/' + f.length);
console.log('');
console.log('  OKUMA: MEKANIZMA kapisi = KIRMIZI bos-kilit% tabana gore ~0\'a inmeli (MAVI degismemeli).');
console.log('         MAC kapisi AYRI: |t| < 2 ise bu ornekelemde mac etkisi KANITLANMAMIS demektir —');
console.log('         mekanizma calissa bile. 12 tohum karar icin az; kapi 37+ tohum ister.');
