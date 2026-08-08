// VEKIL SINAVI — tezgah, insana karsi kaybettiren davranisi GOREBILIYOR mu?
//
// GUNUN EN PAHALI DERSI (2026-08-08): tezgahta iki tarafi da ayni kod-AI surdugu icin AI'in bir
// yetenegi kotu kullanmasi KARSILIKLI SONUMLENIR. Tezgah -1417 diyor ama kullanici canli 2 maci
// 61'e 3 kazandi. Yani her olcum insana karsi KOR.
//
// COZUM ADAYI: TAKTIK-VEKILI (BATTLE_SURROGATE_SIDE) + oyuncu-meta doktrini (indeks 9).
// SINAV: vekil, kullanicinin GERCEK maclarindaki IMZALARI uretebiliyor mu?
//   olcut (kullanicinin 2 canli maci):
//     - kazanma: 61 olume karsi 3   (ezici)
//     - saldiri helosu: 3 adet, 4116 hasar, 471 yedi, 0 OLUM
//     - CNRA: 3065 hasar / 25 yedi  = 122:1
//     - AI'in dolayli ates birimleri: 8 olum (insaninki 0)
// Uretebiliyorsa tezgah GORUR hale gelir ve sonraki her yatirim dogru hedefe gider.
// Uretemiyorsa vekil YETERSIZ demektir ve bunu bilmek de degerli.
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 8)) || 8);
const ATLA = Math.max(0, Number(arg('--atla', 76)) || 0);
const KIP = arg('--kip', 'saldiran');   // saldiran | savunan | kusatan
const HAVUZ = []; for (let i = 0; i < 96; i++) HAVUZ.push(100000 + i * 137);
const TOHUMLAR = HAVUZ.slice(ATLA, ATLA + N);
const { ctx } = tezgahKur();

function kos(seed, vekilAcik) {
    // MAVI = vekil (insan yerine), KIRMIZI = AI (intel4-pro)
    const kirmiziSaldiran = (KIP === 'savunan');   // vekil savunansa kirmizi saldirir
    const kod = [
        '(() => {',
        'BATTLE_RECIPE_RED = null;',
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;',
        'BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;',
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;',
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;',
        'BATTLE_SURROGATE_SIDE = ' + (vekilAcik ? 'false' : 'null') + ';',
        'BATTLE_SURROGATE_DEFENSIVE = ' + (KIP === 'savunan' ? 'true' : 'false') + ';',
        'BATTLE_SURROGATE_ENVELOP = ' + (KIP === 'kusatan' ? 'true' : 'false') + ';',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;',
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:' + kirmiziSaldiran + ', durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });',
        // MAVI ordusu: OYUNCU-META doktrini (vekilin kadrosu insan profilinden)
        (vekilAcik ? 'BATTLE_FORCE_DOCTRINE = BATTLE_DOCTRINE_PLAYER_META;' : ''),
        'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:' + (!kirmiziSaldiran) + ' }), false, { source:"vs", ally:true });',
        'BATTLE_FORCE_DOCTRINE = null;',
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;',
        'startBattle();',
        // baslangic kadrolari
        'const bas = { helo:0, mlrs:0, dolK:0 };',
        'for (const u of SIM.units) { if (u.dead) continue; const id=(STATS[u.type]||{}).id;',
        '  if (!u.isRed && id === "attack_helo") bas.helo++;',
        '  if (!u.isRed && id === "mlrs") bas.mlrs++;',
        '  if (u.isRed && u.isIndirect) bas.dolK++; }',
        'const ph = SIM.headless; SIM.headless = true; let st = 0;',
        'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {',
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);',
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);',
        '} } finally { SIM.headless = ph; }',
        'let heloKalan=0, mlrsKalan=0, dolKKalan=0, oluK=0, oluM=0;',
        'for (const u of SIM.units) { const id=(STATS[u.type]||{}).id;',
        '  if (u.dead) { if (u.isRed) oluK++; else oluM++; continue; }',
        '  if (!u.isRed && id === "attack_helo") heloKalan++;',
        '  if (!u.isRed && id === "mlrs") mlrsKalan++;',
        '  if (u.isRed && u.isIndirect) dolKKalan++; }',
        'const oK = battleArmyObservation(true), oM = battleArmyObservation(false);',
        'BATTLE_SURROGATE_SIDE = null; BATTLE_SURROGATE_DEFENSIVE = false; BATTLE_SURROGATE_ENVELOP = false;',
        'return JSON.stringify({ marjMavi: Math.round(oM.effectiveValue - oK.effectiveValue),',
        '  oluK, oluM, bas, heloKalan, mlrsKalan, dolKKalan, tik: SIM.tick });',
        '})()'
    ].join('');
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'vs.js' }));
}

console.log('VEKIL SINAVI — kip: ' + KIP + ', ' + TOHUMLAR.length + ' tohum, MAVI=vekil KIRMIZI=AI(intel4-pro)');
console.log('  OLCUT (kullanicinin 2 canli maci): 61 AI olumune karsi 3 insan olumu; helo 0 kayip;');
console.log('                                     CNRA 122:1; AI dolayli birimleri 8 olum, insaninki 0');
console.log('');
const ort = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
for (const acik of [false, true]) {
    const R = TOHUMLAR.map(s => kos(s, acik));
    const heloBas = R.reduce((a, r) => a + r.bas.helo, 0), heloKal = R.reduce((a, r) => a + r.heloKalan, 0);
    const mlrsBas = R.reduce((a, r) => a + r.bas.mlrs, 0), mlrsKal = R.reduce((a, r) => a + r.mlrsKalan, 0);
    const dolBas = R.reduce((a, r) => a + r.bas.dolK, 0), dolKal = R.reduce((a, r) => a + r.dolKKalan, 0);
    console.log('  ── ' + (acik ? 'VEKIL ACIK' : 'vekil kapali (kod-AI)') + ' ──');
    console.log('    mavi marj ort ' + Math.round(ort(R.map(r => r.marjMavi))) +
        '    olum: AI ' + R.reduce((a, r) => a + r.oluK, 0) + '  mavi ' + R.reduce((a, r) => a + r.oluM, 0) +
        '    mac ort ' + Math.round(ort(R.map(r => r.tik)) * 0.05) + 'sn');
    console.log('    mavi helo ' + heloKal + '/' + heloBas + ' hayatta   mavi CNRA ' + mlrsKal + '/' + mlrsBas +
        ' hayatta   AI dolayli ' + dolKal + '/' + dolBas + ' hayatta');
}
console.log('');
console.log('  KARAR: vekil acikken mavi EZICI kazanip helosunu/CNRA\'sini yasatabiliyorsa tezgah artik GORUYOR.');
