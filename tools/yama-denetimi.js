// YAMA DENETIMI — kok neden duzeltildikten sonra TELAFI YAMALARI hala gerekli mi?
//
// KULLANICI (2026-08-08): "sorun yeni eklediklerimizden cok ESKIMIS ALTYAPILAR olabilir."
// Bugun tahsis metrigi duzeltildi (deficit/cost -> para bazli en-buyuk-kalan). Uzerinde yillar
// icinde birikmis yamalar var ve UCU DE hala kadronun ~%23'unu (≈1500TL, 5-6 birim) degistiriyor.
//
// EN GUCLU SUPHELI: IMZA-FLOOR. Kendi yorumu ne icin yazildigini soyluyor:
//   "doktrin IMZA birimleri hic alinmadiysa BIRER tane garanti (PAHALI-BIRIM YAPISAL-DISLANMASINI KIR)"
// Yani tam olarak bugun KOKUNDEN cozulen sorunu telafi ediyordu. Kok neden gidince yamanin
// gerekcesi de gitmis olmali — ama gitmediyse artik duzeltilmis tahsise KARSI calisiyor olabilir.
//
// TASARIM (taraf-basi, tuzak B3): yama yalniz KIRMIZIDA kapatilir; MAVI her zaman tam yamali.
// Kirmizi konuslandirmasi openBattlefieldSession ICINDE olur, mavi ondan SONRA -> global bayragi
// iki deploy arasinda geri acmak taraf-basi kontrol verir (yeni bayrak eklemeye gerek yok).
// BIND KANITI: her kosuda iki kolun kirmizi kadrosu karsilastirilir; ayni ciktigi kosu sayilir
// (hepsi ayniysa yama hic calismamis demektir -> tablo anlamsiz).
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('fs');
const path = require('path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 24)) || 24);
const ATLA = Math.max(0, Number(arg('--atla', 56)) || 0);   // 0-7 doz, 8-31 vektor1, 32-55 taban -> 56+ TAZE
const HAVUZ = []; for (let i = 0; i < 96; i++) HAVUZ.push(100000 + i * 137);
const TOHUMLAR = HAVUZ.slice(ATLA, ATLA + N);

const { ctx } = tezgahKur();

// yamaKapali=true ise KIRMIZI konuslandirmasi sirasinda imza-floor kapatilir, sonra geri acilir
function kos(seed, kirmiziSaldiran, yamaKapali) {
    const kod = [
        '(() => {',
        'BATTLE_RECIPE_RED = null;',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        // ── yalniz KIRMIZI deploy'u bu ayarla kurulur ──
        'if (typeof BATTLE_INTEL4_DELTAS !== "undefined") BATTLE_INTEL4_DELTAS.comp = ' + (yamaKapali ? 'false' : 'true') + ';',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:' + kirmiziSaldiran + ', durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        // ── mavi HER ZAMAN tam yamali ──
        'if (typeof BATTLE_INTEL4_DELTAS !== "undefined") BATTLE_INTEL4_DELTAS.comp = true;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:' + (!kirmiziSaldiran) + ' }), false, { source:"yd", ally:true });',
        'const kK = {}; for (const u of SIM.units) { if (u.dead || !u.isRed) continue; const id = (STATS[u.type]||{}).id || u.type; kK[id] = (kK[id]||0)+1; }',
        'startBattle();',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '} } finally { SIM.headless = ph; }',
        'const oK = battleArmyObservation(true), oM = battleArmyObservation(false);',
        'return JSON.stringify({ marj: Math.round(oK.effectiveValue - oM.effectiveValue), kK });',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'yd.js' }));
}

console.log('YAMA DENETIMI — IMZA-FLOOR (BATTLE_INTEL4_DELTAS.comp), yalniz KIRMIZIDA');
console.log('  ' + TOHUMLAR.length + ' tohum x 2 rol = ' + (TOHUMLAR.length * 2) + ' eslestirilmis mac');
console.log('  tohumlar ' + TOHUMLAR[0] + '..' + TOHUMLAR[TOHUMLAR.length - 1] + '  (TAZE dilim)');
console.log('  KOL A = yama ACIK (bugunku hal)   KOL B = yama KAPALI (kok neden zaten duzeltildi)');
console.log('');

const fark = [], mA = [], mB = [];
let kadroAyni = 0, n = 0;
const kayip = {}, kazanc = {};
for (const s of TOHUMLAR) for (const rol of [true, false]) {
    const A = kos(s, rol, false);
    const B = kos(s, rol, true);
    n++;
    const dA = Object.entries(A.kK).sort().map(([a, b]) => a + '×' + b).join(' ');
    const dB = Object.entries(B.kK).sort().map(([a, b]) => a + '×' + b).join(' ');
    if (dA === dB) kadroAyni++;
    else for (const t of new Set([...Object.keys(A.kK), ...Object.keys(B.kK)])) {
        const d = (A.kK[t] || 0) - (B.kK[t] || 0);
        if (d > 0) kazanc[t] = (kazanc[t] || 0) + d;      // yama bunu EKLIYOR
        if (d < 0) kayip[t] = (kayip[t] || 0) - d;        // yama bunu SOKUYOR
    }
    mA.push(A.marj); mB.push(B.marj); fark.push(B.marj - A.marj);
}

console.log('  BIND KANITI: kadro AYNI cikan kosu ' + kadroAyni + '/' + n +
    (kadroAyni === n ? '   *** YAMA HIC CALISMAMIS, TABLO ANLAMSIZ ***' : ''));
const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => k + '×' + v).join(' ');
console.log('    yama EKLIYOR : ' + (top(kazanc) || '-'));
console.log('    yama SOKUYOR : ' + (top(kayip) || '-'));
console.log('');
const ort = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const o = ort(fark);
const sd = Math.sqrt(fark.reduce((a, b) => a + (b - o) ** 2, 0) / Math.max(1, fark.length - 1));
const se = sd / Math.sqrt(fark.length);
console.log('  kol A (yama ACIK)  marj ort ' + Math.round(ort(mA)));
console.log('  kol B (yama KAPALI) marj ort ' + Math.round(ort(mB)));
console.log('');
console.log('  ══ YAMAYI KAPATMANIN ETKISI (kirmizi lehine) ══');
console.log('     ' + (o > 0 ? '+' : '') + Math.round(o) + '   std.hata ' + Math.round(se) +
    '   t ' + (se ? (o / se).toFixed(2) : '-') + '   n=' + fark.length +
    '   lehte ' + fark.filter(x => x > 0).length + '/' + fark.length);
console.log('');
console.log('  YORUM: pozitif+anlamli => yama artik ZARARLI (kok neden duzeldi, yama fazla duzeltiyor)');
console.log('         ~0 => yama artik GEREKSIZ (olu agirlik, sadelestirilebilir)');
console.log('         negatif+anlamli => yama HALA GEREKLI (bagimsiz bir is yapiyor)');
fs.writeFileSync(path.join(__dirname, '..', 'qa-runtime', 'yama-imza-floor.json'),
    JSON.stringify({ tohumlar: TOHUMLAR, fark, mA, mB, o, se, kadroAyni, n, kazanc, kayip }, null, 1));
