// INTEL4-PRO DELTA DENETIMI — pro katmani intel4'u YENMIYOR (%44 galibiyet, t -1.04, 48 mac).
// Demek ki ACIK olan 9 deltadan bazilari hakkini vermiyor ya da ZARARLI.
//
// KULLANICI KARARI (2026-08-09): "beonai'de israr etmiyorum, kod-AI en ust seviyeye ciksin,
// sadece intel4-pro'yu gelistirmeye yogunlas."
//
// YONTEM: her delta TEK BASINA kapatilir (yalniz KIRMIZIDA — taraf-basi, tuzak B3), digerleri sabit.
// Eslestirilmis fark: marj(delta KAPALI) - marj(hepsi ACIK).
//   pozitif+anlamli -> delta ZARARLI, kapatilmali
//   ~0 + kadro/davranis DEGISMIYOR -> delta OLU (hic tetiklenmiyor)
//   negatif+anlamli -> delta FAYDALI, kalmali
// BIND KANITI: kapatinca mac sonucu HIC degismiyorsa delta o tohumda hic calismamistir.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
const path = require('path');
function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 12)) || 12);
const ATLA = Math.max(0, Number(arg('--atla', 0)) || 0);
const DELTALAR = (arg('--delta', 'indirectMassing,assaultCohesion,counterBattery,trueForceRatio,standoff,heloHunt,spotterRequirement,logisticsRequirement,airBaseRequirement')).split(',');
const HAVUZ = []; for (let i = 0; i < 96; i++) HAVUZ.push(100000 + i * 137);
const TOHUMLAR = HAVUZ.slice(ATLA, ATLA + N);
const ARA = path.join(__dirname, '..', 'qa-runtime', 'pro-delta-ARA.json');
const yaz = (s) => { try { fs.writeSync(1, s + '\n'); } catch (e) { console.log(s); } };
const { ctx } = tezgahKur();

function kos(seed, kirmiziSaldiran, kapaliDelta) {
    const kod = [
        '(() => {',
        'BATTLE_RECIPE_RED = null;',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        // taraf-basi: yalniz KIRMIZIDA kapat
        (kapaliDelta ? ('BATTLE_INTEL4PRO_DELTAS_RED = { ' + kapaliDelta + ': false };') : 'BATTLE_INTEL4PRO_DELTAS_RED = null;'),
        'BATTLE_INTEL4PRO_DELTAS_BLUE = null;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:' + kirmiziSaldiran + ', durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:' + (!kirmiziSaldiran) + ', pro:true }), false, { source:"pd", ally:true });',
        'startBattle();',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '} } finally { SIM.headless = ph; }',
        'const oK = battleArmyObservation(true), oM = battleArmyObservation(false);',
        'BATTLE_INTEL4PRO_DELTAS_RED = null;',
        'return JSON.stringify({ marj: Math.round(oK.effectiveValue - oM.effectiveValue), tik: SIM.tick });',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'pd.js' }));
}

yaz('INTEL4-PRO DELTA DENETIMI — her delta TEK BASINA kapatilir (yalniz KIRMIZI)');
yaz('  ' + TOHUMLAR.length + ' tohum x 2 rol = ' + (TOHUMLAR.length * 2) + ' eslestirilmis mac / delta');
yaz('  ' + DELTALAR.length + ' delta  ->  ' + ((DELTALAR.length + 1) * TOHUMLAR.length * 2) + ' mac');
yaz('');
const taban = [];
for (const s of TOHUMLAR) for (const rol of [true, false]) taban.push(kos(s, rol, null).marj);
const ort = (a) => a.reduce((x, y) => x + y, 0) / a.length;
yaz('  TABAN (hepsi acik) marj ort ' + Math.round(ort(taban)) + '   n=' + taban.length);
yaz('');
yaz('  ' + 'delta'.padEnd(22) + 'KAPATMA ETKISI'.padStart(15) + 'std.hata'.padStart(10) + 't'.padStart(7) + 'lehte'.padStart(8) + '  degisen mac');
const sonuc = [];
const t0 = Date.now();
for (let i = 0; i < DELTALAR.length; i++) {
    const d = DELTALAR[i];
    const fark = []; let degisen = 0, k = 0;
    for (const s of TOHUMLAR) for (const rol of [true, false]) {
        const r = kos(s, rol, d);
        const f = r.marj - taban[k]; fark.push(f); if (f !== 0) degisen++; k++;
    }
    const o = ort(fark);
    const sd = Math.sqrt(fark.reduce((a, b) => a + (b - o) ** 2, 0) / Math.max(1, fark.length - 1));
    const se = sd / Math.sqrt(fark.length);
    sonuc.push({ delta: d, o, se, t: se ? o / se : 0, degisen, n: fark.length });
    yaz('  ' + d.padEnd(22) + ((o > 0 ? '+' : '') + Math.round(o)).padStart(15) + Math.round(se).toString().padStart(10) +
        (se ? (o / se).toFixed(2) : '-').padStart(7) + (fark.filter(x => x > 0).length + '/' + fark.length).padStart(8) +
        ('  ' + degisen + '/' + fark.length) + (degisen === 0 ? '   *** OLU: hic tetiklenmiyor ***' : ''));
    fs.writeFileSync(ARA, JSON.stringify({ taban, sonuc }, null, 1));
}
yaz('');
yaz('  ══ SIRALAMA (kapatmanin kazandirdigi) ══');
for (const s of sonuc.slice().sort((a, b) => b.o - a.o))
    yaz('    ' + ((s.o > 0 ? '+' : '') + Math.round(s.o)).padStart(7) + '  t ' + s.t.toFixed(2).padStart(6) + '   ' + s.delta +
        (s.degisen === 0 ? '  (OLU)' : ''));
yaz('');
yaz('  YORUM: |t|>=2 ve POZITIF olan delta ZARARLI -> kapatilmali.');
yaz('         degisen=0 olan delta OLU -> sadelestirilebilir.');
