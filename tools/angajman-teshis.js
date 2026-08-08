// ANGAJMAN KABUL/RET — "AI taarruzu SADECE ustun oldugunu goruyorsa yapsin"
//
// KULLANICI (2026-08-08): "ben taarruz ediyorum ancak rakip bana taarruz ediyor; AI savunmasi
// taarruzu sadece ustun oldugunu goruyorsa yapmali."
// OLCULDU (kullanicinin 3 savunma maci, guncel motor): AI hazir savunmaya taarruz etti,
// oldurmelerinin %78'i KUTLE ICINDE oldu, maclar 27-0 / 26-11 / 26-7 bitti.
//
// KURAL: FIRE_WINDOW -> ASSAULT gecisi yerel ustunluk (dost/dusman >= ANGAJMAN_ESIK, 900px)
// sartina baglanir. Ustunluk yoksa ATES PENCERESINDE kalinir (dolayli ates dovmeye devam eder).
//
// OLCULEN:
//   BAGLANMA : kural kac kez bakti, kac kez REDDETTI (sifirsa kural hic calismamis - tuzak B2)
//   KUTLE ICINDE OLUM : hucum kutleye dalmayi birakti mi
//   MAC       : eslestirilmis marj farki (taraf-basi: yalniz KIRMIZI)
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 8)) || 8);
// HAVUZ 12 -> 36: 8 tohum KANIT DEGIL. Bugun v2 klon 48 macta t 2.03 verip 96 BAGIMSIZ macta
// t -2.85 cikti; ayni tuzak. `--atla` ile ayrik dilim alinabilir (bagimsiz teyit).
const HAVUZ = [202, 2024, 3141, 777, 11, 333, 4001, 4003, 4007, 4013, 4019, 4021,
               4027, 4049, 4051, 4057, 4073, 4079, 4091, 4093, 4099, 4111, 4127, 4129,
               4133, 4139, 4157, 4159, 4177, 4201, 4211, 4217, 4219, 4229, 4231, 4241];
const ATLA = Math.max(0, Number(arg('--atla', 0)) || 0);
const TOHUMLAR = HAVUZ.slice(ATLA, ATLA + N);
const R = 600;

const { ctx } = tezgahKur();

function kos(seed, acik) {
    const kod = [
        '(() => {',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;',
        'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
        'BATTLE_ANGAJMAN = false; BATTLE_ANGAJMAN_RED = ' + (acik ? 'true' : 'null') + '; BATTLE_ANGAJMAN_BLUE = null;',
        'if (typeof BATTLE_ANGAJMAN_SAYAC !== "undefined") BATTLE_ANGAJMAN_SAYAC = { bakilan: 0, reddedilen: 0 };',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        // KIRMIZI SALDIRAN — kullanicinin senaryosu (AI saldiriyor, karsi taraf savunuyor)
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"an", ally:true });',
        'startBattle();',
        'const R = ' + R + ';',
        'const olum = []; const onceki = new Map();',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  for (const u of SIM.units) if (!u.dead) onceki.set(u.id, { x: u.x, y: u.y, isRed: !!u.isRed });',
        '  const canliOnce = new Set(SIM.units.filter(u => !u.dead).map(u => u.id));',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '  const canliSimdi = new Set(SIM.units.filter(u => !u.dead).map(u => u.id));',
        '  for (const id of canliOnce) { if (canliSimdi.has(id)) continue;',
        '    const k = onceki.get(id); if (!k) continue;',
        '    let dost = 0, dusman = 0;',
        '    for (const v of SIM.units) { if (v.dead || v.loaded || v.id === id) continue;',
        '      if (Math.hypot(v.x - k.x, v.y - k.y) > R) continue;',
        '      if (!!v.isRed === k.isRed) dost++; else dusman++; }',
        '    olum.push({ kirmiziKurban: k.isRed, dost, dusman }); }',
        '} } finally { SIM.headless = ph; }',
        'const oS = battleArmyObservation(true), oD = battleArmyObservation(false);',
        'return JSON.stringify({ olum, marj: Math.round(oS.effectiveValue - oD.effectiveValue),',
        '  sayac: (typeof BATTLE_ANGAJMAN_SAYAC !== "undefined") ? BATTLE_ANGAJMAN_SAYAC : null });',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'an.js' }));
}

function kol(acik) {
    let olum = [], marj = [], bakilan = 0, reddedilen = 0;
    for (const s of TOHUMLAR) {
        const r = kos(s, acik);
        olum = olum.concat(r.olum); marj.push(r.marj);
        if (r.sayac) { bakilan += r.sayac.bakilan; reddedilen += r.sayac.reddedilen; }
    }
    return { olum, marj, bakilan, reddedilen };
}

console.log('ANGAJMAN KABUL/RET — ' + TOHUMLAR.length + ' mac, KIRMIZI saldiran (mudahale yalniz KIRMIZIDA)');
console.log('  kural: yerel oran (900px) < ' + '1.30' + ' ise HUCUM ETME, ates penceresinde kal');
console.log('');
const A = kol(false), B = kol(true);

// KIRMIZININ KAYIPLARI: kirmizi hucumda eriyorsa burada gorunur
function rapor(ad, o) {
    const kayip = o.olum.filter(x => x.kirmiziKurban);        // olen KIRMIZI birimler
    const oldurme = o.olum.filter(x => !x.kirmiziKurban);     // kirmizinin oldurdukleri
    const kutle = oldurme.filter(x => x.dost >= 4).length;
    console.log('  ' + ad.padEnd(20) + String(kayip.length).padStart(12) + String(oldurme.length).padStart(11) +
        ('%' + (oldurme.length ? Math.round(kutle / oldurme.length * 100) : 0)).padStart(15));
}
console.log('  ' + 'kol'.padEnd(20) + 'KIRMIZI kayip'.padStart(12) + 'oldurme'.padStart(11) + 'kutle-icinde'.padStart(15));
rapor('KAPALI (taban)', A);
rapor('ACIK (angajman)', B);
console.log('');
console.log('  BAGLANMA KANITI — kural bakti: taban ' + A.bakilan + ' | acik ' + B.bakilan +
    '   REDDEDILEN hucum: taban ' + A.reddedilen + ' | acik ' + B.reddedilen);
if (!B.reddedilen) console.log('  *** KURAL HIC REDDETMEDI — tablo ANLAMSIZ (bkz tuzak B2) ***');

const f = B.marj.map((x, i) => x - A.marj[i]);
const o = f.reduce((a, b) => a + b, 0) / f.length;
const sd = Math.sqrt(f.reduce((a, b) => a + (b - o) * (b - o), 0) / Math.max(1, f.length - 1));
const se = sd / Math.sqrt(f.length);
console.log('');
console.log('  ESLESTIRILMIS MARJ FARKI (kirmizi lehine): ' + (o > 0 ? '+' : '') + Math.round(o) +
    '   std.hata ' + Math.round(se) + '   t ' + (se ? (o / se).toFixed(2) : '-') +
    '   lehte ' + f.filter(x => x > 0).length + '/' + f.length);
