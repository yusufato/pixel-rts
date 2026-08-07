// TESLIM OLMUS HEDEFE ATES — kullanici: "beyaz bayrak cekmis birimlere atis ediyorlar".
//
// Mission-kill'de murettebat araci terk eder (`abandoned`, gri/notr). Otomatik hedefleme onu ZATEN
// disliyordu (findBestVisibleEnemy) ama `performAttack` yalniz `dead` bakiyordu -> o an KILITLI olan
// birim atese devam ediyordu. Bu arac tam olarak onu sayar:
//
//   TESLIM SONRASI VURUS  : hedefin abandonedTick'inden SONRA inen dogrudan vurus sayisi/hasari
//   (ucustaki mermi haric tutulmaz — zaten atilmisti; olcut YENI atis uretilip uretilmedigi)
//   TERK EDILEN ARAC      : kac arac teslim oldu (baglanma kaniti — sifirsa olcum bos demektir)
//   ELE GECIRILEN         : teslim olan arac tamir edilip ele gecirildi mi (mekanigin AMACI budur)
//
// Kol: BATTLE_TESLIM_ATES_KES kapali (taban) / acik (duzeltme). Ayni tohumlar, eslestirilmis.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 8)) || 8);
const HAVUZ = [202, 2024, 3141, 777, 11, 333, 4001, 4003, 4007, 4013, 4019, 4021];
const TOHUMLAR = HAVUZ.slice(0, N);

const { ctx } = tezgahKur();

function kos(fix, seed) {
    const kod = [
        '(() => {',
        'BATTLE_TESLIM_ATES_KES = ' + fix + ';',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;',
        'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"ta", ally:true });',
        'startBattle();',
        // TESLIM SONRASI VURUS: pendingHits VARIS aninda hedef abandoned mi?
        'let vurus = 0, hasar = 0, gorulen = 0, teslimAdet = 0, gerekcesiz = 0, gerekcesizHasar = 0;',
        'const teslimGoruldu = {};',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '  for (const u of SIM.units) {',
        '    if (u.abandoned && !teslimGoruldu[u.id]) { teslimGoruldu[u.id] = true; teslimAdet++; }',
        '  }',
        // yeni uretilen dogrudan vuruslari tara: hedefi ZATEN teslim olmussa bu ISTENMEYEN atis
        '  for (const p of SIM.pendingHits) {',
        '    if (p.seq <= gorulen) continue;',
        '    gorulen = Math.max(gorulen, p.seq);',
        '    if (p.kind !== "direct" || p.tgtId == null) continue;',
        '    const t = SIM.units.find(z => z.id === p.tgtId);',
        '    if (t && t.abandoned && t.abandonedTick != null && p.fireTick > t.abandonedTick) {',
        '      vurus++; hasar += (p.dmg || 0);',
        // GEREKCELI mi: atis aninda arac KARSI TARAFCA fiilen tamir ediliyor muydu?
        '      const _tt = t._tamirTick, _ts = t._tamirSide;',
        '      const _gerekceli = (_tt != null && _ts != null && _ts !== p.atkIsRed && (p.fireTick - _tt) <= 20);',
        '      if (!_gerekceli) { gerekcesiz++; gerekcesizHasar += (p.dmg || 0); }',
        '    }',
        '  }',
        '} } finally { SIM.headless = ph; }',
        'const oS = battleArmyObservation(true), oD = battleArmyObservation(false);',
        'const b = (typeof BATTLE_BALANCE !== "undefined") ? BATTLE_BALANCE : {};',
        'const ele = b.captured ? ((b.captured.red || 0) + (b.captured.blue || 0)) : 0;',
        'return JSON.stringify({ vurus: vurus, hasar: Math.round(hasar), teslim: teslimAdet, ele: ele,',
        '  gerekcesiz: gerekcesiz, gerekcesizHasar: Math.round(gerekcesizHasar),',
        '  marj: Math.round(oS.effectiveValue - oD.effectiveValue), sure: Math.round(SIM.tick * 0.05) });',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'ta.js' }));
}

console.log('TESLIM OLMUS HEDEFE ATES — ' + TOHUMLAR.length + ' tohum, simetrik beyin');
console.log('  olcut: hedef TESLIM OLDUKTAN SONRA uretilen dogrudan atis sayisi (ucustaki mermi degil).');
console.log('');
console.log('  ' + 'kol'.padEnd(18) + 'teslim eden arac'.padStart(18) + 'TESLIM SONRASI atis'.padStart(21) +
    'israf hasar'.padStart(13) + 'ele gecen'.padStart(11) + 'marj'.padStart(9));
const S = {};
for (const [ad, f] of [['KAPALI (taban)', false], ['ACIK (duzeltme)', true]]) {
    const r = TOHUMLAR.map(s => kos(f, s));
    S[ad] = r;
    const o = k => r.reduce((a, x) => a + x[k], 0) / r.length;
    console.log('  ' + ad.padEnd(18) + o('teslim').toFixed(1).padStart(18) + o('vurus').toFixed(1).padStart(21) +
        o('gerekcesiz').toFixed(1).padStart(17) + Math.round(o('gerekcesizHasar')).toString().padStart(18) + o('ele').toFixed(1).padStart(11) +
        Math.round(o('marj')).toString().padStart(9));
}
const t = S['KAPALI (taban)'], y = S['ACIK (duzeltme)'];
const f = y.map((x, i) => x.marj - t[i].marj);
const ort = f.reduce((a, b) => a + b, 0) / f.length;
const std = Math.sqrt(f.reduce((a, b) => a + (b - ort) * (b - ort), 0) / Math.max(1, f.length - 1));
const se = std / Math.sqrt(f.length);
console.log('');
console.log('  ESLESTIRILMIS MARJ FARKI: ' + (ort > 0 ? '+' : '') + Math.round(ort) + '   std.hata ' + Math.round(se) +
    '   t ' + (se ? (ort / se).toFixed(2) : '-') + '   lehte ' + f.filter(x => x > 0).length + '/' + f.length);
console.log('');
console.log('  OKUMA: "teslim eden arac" 0 ise olcum BOS (baglanma kaniti yok) — tablo okunmaz.');
console.log('         Duzeltme calisiyorsa TESLIM SONRASI atis ~0 olmali; ele gecen artabilir (mekanigin amaci).');
