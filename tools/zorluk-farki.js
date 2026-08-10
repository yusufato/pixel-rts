// ZORLUK FARKI — kampanya kurulumundaki KOLAY/ZOR dugmesi gercekte ne kadar fark ediyor?
//
// KOLAY = rakip intel3-pro (taban beyin) · ZOR = rakip intel4 (mezun surum). Dugme calisiyor
// (--beyintest bayraklari dogruladi) ama "kolay"/"zor" ISIM olarak kalmamali.
//
// ILK SURUM YANLISTI (durustluk notu): pro-vs-intel4 kapisini kullanmistim; o kapi "pro tarafinin"
// galibiyetini raporlar ve pro maclarin yarisinda MAVI, yarisinda KIRMIZI olur. Ben ise yalniz
// KIRMIZININ beynini degistiriyordum → iki sey karisti ve sonuc yorumlanamaz cikti (-4 puan).
// Bu surum SABIT TARAF olcer: MAVI = oyuncu vekili (daima intel4, pro katmani KAPALI),
// KIRMIZI = rakip (beyni kola gore degisir). Cikti: MAVININ galibiyet orani.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(4, Number(arg('--tohum', 48)) || 48);
const ATLA = Math.max(0, Number(arg('--atla', 3072)) || 3072);
const HAVUZ = []; for (let i = 0; i < 4096; i++) HAVUZ.push(100000 + i * 137);
const TOHUMLAR = HAVUZ.slice(ATLA, ATLA + N);

const { ctx } = tezgahKur();

function kos(seed, kirmiziSaldiran, kirmiziIntel4) {
    const kod = [
        '(() => {',
        'BATTLE_RECIPE_RED = null;',
        'BATTLE_INTEL4_BLUE = true;',                                   // oyuncu vekili: DAIMA intel4
        'BATTLE_INTEL4_RED = ' + (kirmiziIntel4 ? 'true' : 'false') + ';',   // rakip: zorluga gore
        'BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;', // pro katmani iki tarafta da KAPALI (karistirmasin)
        'BATTLE_BEONAI_RED = null; BATTLE_BEONAI_BLUE = null;',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:' + kirmiziSaldiran + ', durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:' + (!kirmiziSaldiran) + ' }), false, { source:"zf", ally:true });',
        'startBattle();',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '} } finally { SIM.headless = ph; }',
        'const oK = battleArmyObservation(true), oM = battleArmyObservation(false);',
        'const b = SIM.battle || {};',
        // MAVI lehine marj (oyuncu vekilinin kazanci)
        'return JSON.stringify({ maviMarj: Math.round(oM.effectiveValue - oK.effectiveValue),',
        '  maviKazandi: b.winnerSide === false });',
        '})()'
    ].join('\n');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'zf.js' }));
}

function kol(kirmiziIntel4) {
    const marj = []; let galip = 0, n = 0;
    for (const s of TOHUMLAR) for (const rol of [true, false]) {
        const r = kos(s, rol, kirmiziIntel4);
        marj.push(r.maviMarj); if (r.maviKazandi) galip++; n++;
    }
    const o = marj.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(marj.reduce((a, b) => a + (b - o) ** 2, 0) / Math.max(1, n - 1));
    return { n, galip, yuzde: Math.round(galip / n * 100), marj: Math.round(o), se: Math.round(sd / Math.sqrt(n)) };
}

console.log('ZORLUK FARKI — MAVI (oyuncu vekili, daima intel4) vs KIRMIZI (rakip)');
console.log('  ' + TOHUMLAR.length + ' tohum x 2 rol = ' + (TOHUMLAR.length * 2) + ' mac/kol, havuz ' + ATLA + '+');
const zor = kol(true);      // rakip intel4
const kolay = kol(false);   // rakip intel3-pro
const yaz = (ad, r) => console.log('  ' + ad.padEnd(7) + 'MAVI kazanir ' + String(r.galip).padStart(3) + '/' + r.n +
    ' = %' + String(r.yuzde).padStart(2) + '   mavi marj ' + String(r.marj).padStart(6) + '  ±' + r.se);
console.log('');
yaz('ZOR', zor); yaz('KOLAY', kolay);
const dMarj = kolay.marj - zor.marj, dPuan = kolay.yuzde - zor.yuzde;
const se = Math.round(Math.sqrt(zor.se * zor.se + kolay.se * kolay.se));
console.log('');
console.log('  DUGMENIN DEGERI: ' + (dMarj > 0 ? '+' : '') + dMarj + ' marj (±' + se + ')  ·  ' +
    (dPuan > 0 ? '+' : '') + dPuan + ' puan galibiyet');
console.log('  (pozitif = KOLAY gercekten kolay. |fark| < ' + (2 * se) + ' ise dugme ISIMDEN IBARETTIR.)');
