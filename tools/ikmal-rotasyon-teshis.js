// MUHIMMAT ROTASYONU — oyuncu ile AI arasindaki OLCULMUS yurutme-katmani farki.
//
// BULGU (docs/INSAN-VS-AI-SALDIRI.md): "muhimmati bitip sonra >=%50 dolu donen birim"
//   seed2024  OYUNCU 7/8 (%88)   AI 0/2 (%0)
//   seed777   OYUNCU 4/5 (%80)   AI 1/3 (%33)
//   handikap  OYUNCU 8           AI 0
// Yani AI muhimmat bitince birimi ORADA BIRAKIYOR; insan geri cekip dolduruyor ve geri gonderiyor.
// Bu, "savunanin topcusu t=60'ta kuruyor, atis hacmi 4x dusuyor" bulgusunun da cevabi.
//
// NEDEN YENIDEN OLCUYORUZ: `resupplyRun` deltasi KAPALI (globals.js) ve kapatilma gerekcesi
// "kuru-tik yuzdesi" olcumune dayaniyordu — ROTASYON olcumune degil. Ikisi farkli sey:
//   kuru-tik %  : birimin ne kadar sure mermisiz kaldigi
//   ROTASYON    : mermisi bitince geri cekilip DOLU donmesi
// Bu arac rotasyonu, gercekten kostugumuz yapilandirmada (pro ACIK) olcer.
//
// TUZAK NOTU: `BATTLE_BALANCE.on` sayaclarina GUVENILMEZ (bkz OLCUM-TUZAKLARI A8) — burada olay
// dogrudan izlenir: birim ammo 0'a dusuyor mu, sonra >=%50'ye donuyor mu.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 8)) || 8);
const HAVUZ = [202, 2024, 3141, 777, 11, 333, 4001, 4003, 4007, 4013, 4019, 4021];
const TOHUMLAR = HAVUZ.slice(0, N);
const ROTASYON = process.argv.includes('--rotasyon');   // resupplyRun deltasini AC

const { ctx } = tezgahKur();

function kos(seed, rotasyonAcik) {
    const kod = [
        '(() => {',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;',
        'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
        // TARAF-BASI: rotasyon YALNIZ kirmiziya acilir (temiz A/B; global bayrak iki tarafi birden degistirirdi)
        'if (typeof BATTLE_INTEL4PRO_DELTAS !== "undefined") BATTLE_INTEL4PRO_DELTAS.resupplyRun = false;',
        'BATTLE_INTEL4PRO_DELTAS_RED = ' + (rotasyonAcik ? '{ resupplyRun: true }' : 'null') + ';',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"ir", ally:true });',
        'startBattle();',
        // ── OLAY IZLEME (sayac degil): kurudu mu, sonra >=%50 doldu mu ──
        'const iz = {};',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '  for (const u of SIM.units) {',
        '    if (u.dead || !u.maxAmmo || u.maxAmmo <= 0) continue;',
        '    const r = iz[u.id] || (iz[u.id] = { kirmizi: !!u.isRed, tip: (STATS[u.type]||{}).id,',
        '      kuruTik: 0, tik: 0, kurudu: false, rotasyon: 0, enDusuk: 1 });',
        '    r.tik++;',
        '    const oran = u.ammo / u.maxAmmo;',
        '    if (oran < r.enDusuk) r.enDusuk = oran;',
        '    if (u.ammo <= 0) { r.kuruTik++; r.kurudu = true; }',
        '    else if (r.kurudu && oran >= 0.5) { r.rotasyon++; r.kurudu = false; }',   // kuru -> >=%50 dolu = BIR rotasyon
        '  }',
        '} } finally { SIM.headless = ph; }',
        'const oS = battleArmyObservation(true), oD = battleArmyObservation(false);',
        'const out = { kirmizi: { birim: 0, kuruyan: 0, rotasyon: 0, kuruTik: 0, tik: 0 },',
        '              mavi:    { birim: 0, kuruyan: 0, rotasyon: 0, kuruTik: 0, tik: 0 } };',
        'for (const id in iz) { const r = iz[id]; const t = r.kirmizi ? out.kirmizi : out.mavi;',
        '  t.birim++; if (r.enDusuk <= 0) t.kuruyan++; t.rotasyon += r.rotasyon; t.kuruTik += r.kuruTik; t.tik += r.tik; }',
        'return JSON.stringify({ ...out, marj: Math.round(oS.effectiveValue - oD.effectiveValue) });',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'ir.js' }));
}

console.log('MUHIMMAT ROTASYONU — "kurudu sonra >=%50 dolu dondu" (OLAY izlemesi, sayac DEGIL)');
console.log('  kiyas (olculmus insan): seed2024 %88 · seed777 %80 · handikap 8 rotasyon');
console.log('  A/B taraf-basi: rotasyon YALNIZ kirmiziya acilir, mavi iki kolda AYNI');
console.log('');
console.log('  ' + 'kol'.padEnd(20) + 'taraf'.padStart(9) + 'muhimmatli birim'.padStart(18) +
    'kuruyan'.padStart(10) + 'ROTASYON'.padStart(11) + 'kuru zaman%'.padStart(13));
const S = {};
for (const [ad, acik] of [['KAPALI (taban)', false], ['ACIK (resupplyRun)', true]]) {
    const r = TOHUMLAR.map(s => kos(s, acik));
    S[ad] = r;
    for (const taraf of ['kirmizi', 'mavi']) {
        const o = (f) => r.reduce((a, x) => a + x[taraf][f], 0) / r.length;
        const kuruPct = o('tik') ? (o('kuruTik') / o('tik') * 100) : 0;
        console.log('  ' + (taraf === 'kirmizi' ? ad : '').padEnd(20) + taraf.toUpperCase().padStart(9) +
            o('birim').toFixed(1).padStart(18) + o('kuruyan').toFixed(1).padStart(10) +
            o('rotasyon').toFixed(1).padStart(11) + ('%' + kuruPct.toFixed(1)).padStart(13));
    }
}
const t = S['KAPALI (taban)'], y = S['ACIK (resupplyRun)'];
const f = y.map((x, i) => x.marj - t[i].marj);
const ort = f.reduce((a, b) => a + b, 0) / f.length;
const std = Math.sqrt(f.reduce((a, b) => a + (b - ort) * (b - ort), 0) / Math.max(1, f.length - 1));
const se = std / Math.sqrt(f.length);
console.log('');
console.log('  ESLESTIRILMIS MARJ FARKI (kirmizi lehine): ' + (ort > 0 ? '+' : '') + Math.round(ort) +
    '   std.hata ' + Math.round(se) + '   t ' + (se ? (ort / se).toFixed(2) : '-') +
    '   lehte ' + f.filter(x => x > 0).length + '/' + f.length);
console.log('');
console.log('  OKUMA: MEKANIZMA = kirmizi ROTASYON sayisi (mavi degismemeli — bagli kanit).');
console.log('         MAC kapisi AYRI ve |t| >= 2 ister; bu orneklemde kanitlanmayabilir.');
