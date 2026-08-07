// TITREME A/B — duzeltme titremeyi kesiyor mu VE birimleri TAKIP BIRAKIYOR mu?
//
// Sikisma-cozme manevrasi bir ise yariyordu (engel arkasinda kalan birimi kurtarmak). Duzeltme
// titremeyi kesiyorsa bile birimler artik takiliyorsa NET KAYIP olur. Bu yuzden iki sey birden:
//   TITREME : saniyede yon tersinmesi (tik cozunurlugu, >120 derece)
//   ILERLEME: birim basina NET yer degistirme + katedilen yol (takilan birim ikisini de kaybeder)
// Ayrica mac marji/suresi — mekanik degisikligin sonuca etkisi.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 8)) || 8);
const HAVUZ = [202, 2024, 3141, 777, 11, 333, 4001, 4003, 4007, 4013, 4019, 4021];
const TOHUMLAR = HAVUZ.slice(0, N);
const SANIYE = Number(arg('--saniye', 100));

const { ctx } = tezgahKur();

function kos(fix, seed) {
    const kod = [
        '(() => {',
        'BATTLE_UNSTICK_FIX = ' + fix + ';',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;',
        'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"ab", ally:true });',
        'startBattle();',
        'const S = {};',
        'const ilk = {};',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'const HED = ' + (SANIYE * 20) + ';',
        'try { while (SIM.tick < HED && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '  for (const u of SIM.units) {',
        '    if (u.dead || u.loaded) continue;',
        '    if (!ilk[u.id]) ilk[u.id] = { x: u.x, y: u.y };',
        '    const s = S[u.id] || (S[u.id] = { px: u.x, py: u.y, yol: 0, ters: 0, son: null, tik: 0 });',
        '    const dx = u.x - s.px, dy = u.y - s.py, d = Math.hypot(dx, dy);',
        '    s.px = u.x; s.py = u.y; s.yol += d; s.tik++;',
        '    s.sx = u.x; s.sy = u.y;',
        '    if (d < 0.3) { s.son = null; continue; }',
        '    const a = Math.atan2(dy, dx);',
        '    if (s.son != null) { let f = Math.abs(a - s.son); while (f > Math.PI) f = Math.PI * 2 - f; if (f > 2.0944) s.ters++; }',
        '    s.son = a;',
        '  }',
        '} } finally { SIM.headless = ph; }',
        'let ters = 0, yol = 0, net = 0, n = 0, enKotu = 0;',
        'for (const id in S) {',
        '  const s = S[id], i0 = ilk[id];',
        '  if (!s.tik || s.yol < 40) continue;',
        '  n++; ters += s.ters; yol += s.yol;',
        '  net += Math.hypot(s.sx - i0.x, s.sy - i0.y);',
        '  const ts = s.ters / (s.tik / 20); if (ts > enKotu) enKotu = ts;',
        '}',
        'const oS = battleArmyObservation(true), oD = battleArmyObservation(false);',
        'return JSON.stringify({ n: n, tersSn: n ? +(ters / n / ' + SANIYE + ').toFixed(3) : 0,',
        '  enKotuTersSn: +enKotu.toFixed(2), yol: n ? Math.round(yol / n) : 0, net: n ? Math.round(net / n) : 0,',
        '  verim: (n && yol) ? +(net / yol).toFixed(3) : 0,',
        '  marj: Math.round(oS.effectiveValue - oD.effectiveValue) });',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'ab.js' }));
}

console.log('TITREME A/B — ' + TOHUMLAR.length + ' tohum, ' + SANIYE + 'sn, simetrik beyin');
console.log('  "verim" = net yer degistirme / katedilen yol. DUSERSE birim takiliyor demektir (istenmez).');
console.log('');
console.log('  ' + 'kol'.padEnd(18) + 'ters/sn'.padStart(10) + 'en kotu'.padStart(10) +
    'yol'.padStart(8) + 'net'.padStart(8) + 'verim'.padStart(9) + 'marj'.padStart(9));
const S = {};
for (const [ad, f] of [['KAPALI (taban)', false], ['ACIK (duzeltme)', true]]) {
    const r = TOHUMLAR.map(s => kos(f, s));
    S[ad] = r;
    const o = k => r.reduce((a, x) => a + x[k], 0) / r.length;
    console.log('  ' + ad.padEnd(18) + o('tersSn').toFixed(3).padStart(10) + o('enKotuTersSn').toFixed(2).padStart(10) +
        Math.round(o('yol')).toString().padStart(8) + Math.round(o('net')).toString().padStart(8) +
        o('verim').toFixed(3).padStart(9) + Math.round(o('marj')).toString().padStart(9));
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
console.log('  OKUMA: ters/sn DUSMELI (titreme), verim DUSMEMELI (takilma). Ikisi birden saglanmazsa');
console.log('         duzeltme titremeyi hareketten calarak satin almistir — kabul edilmez.');
