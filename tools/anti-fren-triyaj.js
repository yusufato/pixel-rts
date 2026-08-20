#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════════
   ANTI-ESLESME FRENI — ONGORU'de HIC BAGLANIYOR MU (en ucuz triyaj adimi)

   'antiMatch' bir FREN: yerel etki-orani <1.0 ya da birim "yanlis alet" ise kapatmayi
   durdurur. Kullanici doktrini: "kutleyi buyutucem diye piyadeleri dolaylinin onune
   koyarsan olurler; dolaylilar tanka vurursa hicbir sey olmaz."

   ⚠ DAHA PAHALI OLCUME GECMEDEN ONCE: kural bu kurulumda TETIKLENIYOR MU?
   Kodun kendi teshis sayaclari zaten var (BATTLE_BALANCE):
       antiMatchReach — kod bu satira kac kez geldi
       antiMatchOn    — delta acikken kac kez
       antiMatchBind  — FREN kac kez fiilen bagladi
   bind = 0 ise kural ONGORU'de olu demektir ve is orada biter (10 dakika).
   Bu, bu depoda defalarca yasanmis "kanca tetiklendi ama davranis degismedi"
   hatasinin (12. tuzak) ucuz panzehiri.

   ⚠ 15. tuzak geregi HAYATTA KALMA da raporlanir: fren birimi geride tutuyorsa
   sagkalim ARTMALI; azaliyorsa kural zarar veriyor demektir.
   ═══════════════════════════════════════════════════════════════════════════════ */
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('node:fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const MAC = Math.max(1, Number(arg('--mac', 6)) || 6);
const TOHUM0 = Number(arg('--tohum0', 152000)) || 152000;

const { ctx } = tezgahKur();
const taban = JSON.parse(fs.readFileSync('qa-runtime/gercekci-taban.json', 'utf8'));

function kos(seed, fren) {
    const kod = '(() => {\n' +
'  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;\n' +
'  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;\n' +
'  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;\n' +
'  BATTLE_ANTI_ESLESME_INTEL4 = ' + (fren ? 'true' : 'false') + ';\n' +
'  if (typeof BATTLE_BALANCE !== "undefined") {\n' +
'    BATTLE_BALANCE.on = true;\n' +
'    BATTLE_BALANCE.antiMatchReach = 0; BATTLE_BALANCE.antiMatchOn = 0;\n' +
'    BATTLE_BALANCE.antiMatchBind = 0; BATTLE_BALANCE.antiMatchPreStand = 0;\n' +
'  }\n' +
'  BATTLE_RECIPE_BLUE = ' + JSON.stringify(taban) + ';\n' +
'  BATTLE_RECIPE_RED = null;\n' +
'  openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true,\n' +
'    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });\n' +
'  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;\n' +
'  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true,\n' +
'    varied:true, brainIntel4:true, isAttacker:false, recipe: BATTLE_RECIPE_BLUE }), false,\n' +
'    { source:"afr", ally:true });\n' +
'  startBattle(); SIM.headless = true;\n' +
'  BATTLE_LOOKAHEAD_RED = false; BATTLE_LOOKAHEAD_BLUE = false;\n' +
'\n' +
'  let kirmiziBas = 0;\n' +
'  for (const u of SIM.units) if (u.isRed) kirmiziBas++;\n' +
'  let st = 0;\n' +
'  while (phase === PHASE.BATTLE && SIM.tick < 7200) {\n' +
'    if (SIM.battle && SIM.battle.winnerSide !== null) break;\n' +
'    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);\n' +
'    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);\n' +
'  }\n' +
'  let kirmiziSag = 0, kD = 0, mD = 0;\n' +
'  for (const u of SIM.units) {\n' +
'    if (u.dead || u.abandoned) continue;\n' +
'    const c = (STATS[u.type] && STATS[u.type].cost) || 0;\n' +
'    if (u.isRed) { kirmiziSag++; kD += c; } else mD += c;\n' +
'  }\n' +
'  const B = (typeof BATTLE_BALANCE !== "undefined") ? BATTLE_BALANCE : {};\n' +
'  return JSON.stringify({\n' +
'    reach: B.antiMatchReach | 0, acik: B.antiMatchOn | 0, bind: B.antiMatchBind | 0,\n' +
'    kirmiziBas: kirmiziBas, kirmiziSag: kirmiziSag,\n' +
'    marj: kD - mD, sure: Math.round(SIM.tick * 0.05) });\n' +
'})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'afr-' + seed + '-' + fren + '.js' }));
}

console.log('');
console.log('ANTI-ESLESME FRENI — BAGLANIYOR MU   ' + MAC + ' tohum x 2 kol');
console.log('  (BATTLE_ANTI_ESLESME_INTEL4 · pro deltasi antiMatch)');
console.log('');

const cift = [];
for (let i = 0; i < MAC; i++) {
    const seed = TOHUM0 + i;
    const k = kos(seed, false);
    const a = kos(seed, true);
    cift.push({ seed: seed, k: k, a: a });
    console.log('  tohum ' + seed +
        '   reach ' + String(k.reach).padStart(5) + '/' + String(a.reach).padStart(5) +
        '   BIND ' + String(k.bind).padStart(4) + ' -> ' + String(a.bind).padStart(4) +
        '   sagKirmizi ' + k.kirmiziSag + '/' + k.kirmiziBas + ' -> ' + a.kirmiziSag + '/' + a.kirmiziBas +
        '   marj ' + String(k.marj).padStart(6) + ' -> ' + String(a.marj).padStart(6) +
        '   sure ' + k.sure + '/' + a.sure + 'sn');
}

function ozet(ad, sec, birim, basamak, yon) {
    const d = cift.map((c) => sec(c.a) - sec(c.k));
    const ort = d.reduce((a, b) => a + b, 0) / d.length;
    const std = d.length > 1
        ? Math.sqrt(d.reduce((a, b) => a + (b - ort) * (b - ort), 0) / (d.length - 1)) : 0;
    const t = std > 0 ? ort / (std / Math.sqrt(d.length)) : 0;
    const iyi = yon === 0 ? null : (yon > 0 ? ort > 0 : ort < 0);
    const hkm = yon === 0 ? 'bilgi'
        : (Math.abs(t) >= 2.0 ? (iyi ? 'YONU DOGRU, anlamli' : '⚠ TERS YON, anlamli') : 'anlamli degil');
    console.log('  ' + ad.padEnd(14) + (ort >= 0 ? '+' : '') + ort.toFixed(basamak).padStart(9) + ' ' +
        birim.padEnd(6) + '  std ' + std.toFixed(basamak).padStart(8) + '   t ' + t.toFixed(2).padStart(6) +
        '   ' + hkm);
}

const bindTop = cift.reduce((a, c) => a + c.a.bind, 0);
const bindKapali = cift.reduce((a, c) => a + c.k.bind, 0);
const reachTop = cift.reduce((a, c) => a + c.a.reach, 0);
console.log('');
console.log('  FREN BAGLANDI MI: acik kolda ' + bindTop + ' kez  (kod bu satira ' + reachTop + ' kez geldi)');
console.log('                    kapali kolda ' + bindKapali + ' kez  (0 olmali)');
if (!bindTop) {
    console.log('  ⛔ HIC BAGLAMADI — kural ONGORU\'de olu. Daha pahali olcume GEREK YOK.');
} else if (bindKapali) {
    console.log('  ⛔ KAPALI KOLDA BAGLADI — bayrak kapiyi tutmuyor.');
} else {
    console.log('  ✅ Fren calisiyor. Simdi sonuc tarafina bakilir.');
}
console.log('');
console.log('  ESLESTIRILMIS FARK (acik - kapali),  n = ' + cift.length);
console.log('  ' + '-'.repeat(78));
ozet('sagKirmizi', (r) => r.kirmiziSag, 'birim', 2, +1);   // fren geride tutuyorsa ARTMALI
ozet('sure', (r) => r.sure, 'sn', 0, 0);                   // bilgi
ozet('marj', (r) => r.marj, 'TL', 0, 0);                   // KARAR DEGIL (n kucuk)
console.log('');
console.log('  OKUMA: bind=0 ise is biter. bind>0 ise sagKirmizi yonu bakilir — fren');
console.log('  yanlis aleti geride tutuyorsa sagkalim ARTMALI. marj KARAR DEGIL.');
