#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════════
   PRO-DELTA TOPLU TRIYAJI — hangisi ONGORU'de kimildatiyor, hangisi zarar veriyor

   26 pro-delta var, hepsi battleProDelta() kapisinin arkasinda ve ONGORU pro DEGIL —
   yani hicbiri ONGORU kademesinde kosmuyor. Mac kapisi delta basina ~6 saat; toptan
   acmak da yasak (pro katmani BUTUN OLARAK net zararli olculdu, 2026-08-09).

   Bu arac her deltayi TEK BASINA acar ve UC SORUYU sorar (bu tur oturdu):
     1. BAGLIYOR MU?   kodun kendi BATTLE_BALANCE.*Bind sayaci. 0 ise is biter.
     2. HAYATTA KALMA? 15. tuzak — metrik iyilesip birim oluyorsa iyilesme sahte.
     3. SONUC?         marj/sure. KARAR DEGIL (n kucuk) ama yon bilgisi verir.

   Deltaya ozgu "kendi metrigi" burada YOK — o, adayin kendi aracinda olculur
   (tools/topcu-hedef-kalite.js gibi). Bu arac ELEME yapar, sevk kararini vermez.

   ⚠ ILERI-BAKIS KAPALI kosar: triyaj kancasi (BATTLE_PRO_DELTA_TRIYAJ) isciye
   tasinmiyor; arama acikken ana iplik ve isci FARKLI beyinle koşar.
   ═══════════════════════════════════════════════════════════════════════════════ */
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('node:fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const MAC = Math.max(1, Number(arg('--mac', 4)) || 4);
const TOHUM0 = Number(arg('--tohum0', 153000)) || 153000;
const DELTALAR = String(arg('--delta', 'localRatio,adUmbrella,killFocus,ammoDiscipline'))
    .split(',').map((x) => x.trim()).filter(Boolean);

/* delta -> kodun kendi bagla-sayaci (BATTLE_BALANCE alani). Yoksa null. */
const SAYAC = {
    localRatio: 'localRatioBind', adUmbrella: 'adUmbrellaBind', antiMatch: 'antiMatchBind',
    armorFace: 'armorFaceBind', jammerPost: 'jammerPostBind', jammerUmbrella: 'jammerUmbrellaBind',
    resupplyRun: 'resupplyBind', supplyEscort: 'supplyEscortBind', standoff: 'standoffBind',
    indirectCreep: 'icreepBind', assaultCohesion: 'proCohesionBind', heloHunt: 'heloHuntBind',
    killFocus: null, ammoDiscipline: null, heloMass: null, engineerForward: null,
    commandCenter: null, massMatch: null, destLock: null
};

const { ctx } = tezgahKur();
const taban = JSON.parse(fs.readFileSync('qa-runtime/gercekci-taban.json', 'utf8'));

function kos(seed, delta) {
    const sayac = delta ? SAYAC[delta] : null;
    const kod = '(() => {\n' +
'  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;\n' +
'  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;\n' +
'  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;\n' +
'  BATTLE_PRO_DELTA_TRIYAJ = ' + (delta ? JSON.stringify([delta]) : 'null') + ';\n' +
'  if (typeof BATTLE_BALANCE !== "undefined") {\n' +
'    BATTLE_BALANCE.on = true;\n' +
     (sayac ? ('    BATTLE_BALANCE.' + sayac + ' = 0;\n') : '') +
'  }\n' +
'  BATTLE_RECIPE_BLUE = ' + JSON.stringify(taban) + ';\n' +
'  BATTLE_RECIPE_RED = null;\n' +
'  openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true,\n' +
'    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });\n' +
'  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;\n' +
'  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true,\n' +
'    varied:true, brainIntel4:true, isAttacker:false, recipe: BATTLE_RECIPE_BLUE }), false,\n' +
'    { source:"dt", ally:true });\n' +
'  startBattle(); SIM.headless = true;\n' +
'  BATTLE_LOOKAHEAD_RED = false; BATTLE_LOOKAHEAD_BLUE = false;\n' +
'  let kBas = 0;\n' +
'  for (const u of SIM.units) if (u.isRed) kBas++;\n' +
'  let st = 0;\n' +
'  while (phase === PHASE.BATTLE && SIM.tick < 7200) {\n' +
'    if (SIM.battle && SIM.battle.winnerSide !== null) break;\n' +
'    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);\n' +
'    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);\n' +
'  }\n' +
'  let kSag = 0, kD = 0, mD = 0;\n' +
'  for (const u of SIM.units) {\n' +
'    if (u.dead || u.abandoned) continue;\n' +
'    const c = (STATS[u.type] && STATS[u.type].cost) || 0;\n' +
'    if (u.isRed) { kSag++; kD += c; } else mD += c;\n' +
'  }\n' +
'  const B = (typeof BATTLE_BALANCE !== "undefined") ? BATTLE_BALANCE : {};\n' +
'  return JSON.stringify({ bind: ' + (sayac ? ('B.' + sayac + ' | 0') : '-1') + ',\n' +
'    kBas: kBas, kSag: kSag, marj: kD - mD, sure: Math.round(SIM.tick * 0.05) });\n' +
'})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'dt-' + seed + '-' + (delta || 'taban') + '.js' }));
}

function istat(d) {
    const ort = d.reduce((a, b) => a + b, 0) / d.length;
    const std = d.length > 1
        ? Math.sqrt(d.reduce((a, b) => a + (b - ort) * (b - ort), 0) / (d.length - 1)) : 0;
    return { ort: ort, std: std, t: std > 0 ? ort / (std / Math.sqrt(d.length)) : 0 };
}

console.log('');
console.log('PRO-DELTA TOPLU TRIYAJI   ' + MAC + ' tohum   deltalar: ' + DELTALAR.join(', '));
console.log('  ileri-bakis KAPALI (triyaj kancasi isciye tasinmiyor)');
console.log('');

/* TABAN bir kez kosar; her delta ona karsi ESLESTIRILMIS okunur. */
const tabanlar = [];
for (let i = 0; i < MAC; i++) tabanlar.push(kos(TOHUM0 + i, null));
const tSag = tabanlar.reduce((a, r) => a + r.kSag, 0);
const tBas = tabanlar.reduce((a, r) => a + r.kBas, 0);
console.log('  TABAN   sag kirmizi ' + tSag + '/' + tBas +
    '   ort. marj ' + Math.round(tabanlar.reduce((a, r) => a + r.marj, 0) / MAC) +
    '   ort. sure ' + Math.round(tabanlar.reduce((a, r) => a + r.sure, 0) / MAC) + 'sn');
console.log('');
const bas = '  delta'.padEnd(20) + 'BIND'.padStart(7) + '   sagKirmizi'.padEnd(16) +
    'dSag'.padStart(7) + '   t'.padStart(7) + '     dMarj'.padStart(10) + '   hukum';
console.log(bas);
console.log('  ' + '-'.repeat(bas.length));

for (const delta of DELTALAR) {
    const kollar = [];
    for (let i = 0; i < MAC; i++) kollar.push(kos(TOHUM0 + i, delta));
    const bind = kollar.reduce((a, r) => a + Math.max(0, r.bind), 0);
    const bindVar = SAYAC[delta] !== null && SAYAC[delta] !== undefined;
    const dSag = istat(kollar.map((r, i) => r.kSag - tabanlar[i].kSag));
    const dMarj = istat(kollar.map((r, i) => r.marj - tabanlar[i].marj));
    const aSag = kollar.reduce((a, r) => a + r.kSag, 0);

    let hkm;
    if (bindVar && bind === 0) hkm = '⛔ HIC BAGLAMADI';
    else if (dSag.t <= -2.0) hkm = '⛔ SAGKALIM DUSUYOR';
    else if (dSag.t >= 2.0) hkm = '✅ sagkalim ARTIYOR';
    else hkm = 'olculemedi (n=' + MAC + ')';

    console.log('  ' + delta.padEnd(18) +
        (bindVar ? String(bind).padStart(7) : '  (yok)') +
        '   ' + String(aSag).padStart(3) + '/' + String(tBas).padStart(3) + ' (taban ' + String(tSag).padStart(3) + ')' +
        (dSag.ort >= 0 ? '+' : '') + dSag.ort.toFixed(2).padStart(6) +
        dSag.t.toFixed(2).padStart(8) +
        ((dMarj.ort >= 0 ? '+' : '') + Math.round(dMarj.ort)).padStart(10) +
        '   ' + hkm);
}

console.log('');
console.log('  OKUMA: BIND=0 -> kural ONGORU\'de olu, is biter. Sagkalim DUSUYORSA kural');
console.log('  zarar veriyor (15. tuzak: metrik iyilesip birim oluyorsa iyilesme sahte).');
console.log('  "olculemedi" ETKISIZ DEMEK DEGIL — sadece bu n ile goremiyoruz. Geride kalan');
console.log('  adaylar kendi metrikleriyle ayrica olculur; bu arac yalniz ELEME yapar.');
