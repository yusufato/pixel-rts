#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════════
   TOPCU HEDEF KALITESI — 'indirectMassing' + 'counterBattery' ONGORU'de ise yariyor mu

   Unit.js findBestVisibleEnemy, dolayli ates icin varsayilan puani `sc = -d` veriyor:
   EN YAKIN hedef. Kutle-hedefleme (patlama yaricapindaki dusman sayisini maksimize et)
   ve karsi-batarya onceligi (dusman dolaylisina +400000) YALNIZ pro beyninde kosuyor;
   ONGORU pro degil, yani ikisi de olu.

   ⚠ "Yazilmis ama kosmuyor" BEDAVA KAZANC DEMEK DEGIL. Pro katmani butun olarak NET
   ZARARLI olculdu (2026-08-09, 18/48 -> 6 delta kapali 27/48) ve tek tek deltalarin
   hicbiri anlamli cikmadi. Bu yuzden once MEKANIZMA triyaji: kural kendi hedefledigi
   metrigi kimildatiyor mu? Kimildatmiyorsa mac kapisina hic girmez (6 saat tasarruf).

   OLCULEN (mermi degil, HEDEF SECIMI — ucuz ve gurultusuz):
     kutle    : topcunun O ANKI hedefinin patlama yaricapindaki dusman sayisi.
                'indirectMassing' calisiyorsa ARTMALI.
     cbPay    : hedefin dusman DOLAYLI birimi olma orani.
                'counterBattery' calisiyorsa ARTMALI (yalniz saldiran rolde tetiklenir).
     mesafe   : hedefe mesafe. Kutle-hedefleme yakinligi ikincillestirdigi icin ARTABILIR
                — bu bir bedel, gizlenmemeli.
     dolayliOlu / marj / sure : sonuc tarafi (tam mactan).

   ⚠ Oran metrikleri "hedefi olan topcu ornegi" paydasinda; iki kolda ornek sayisi
   farkliysa yazdirilir (13. tuzak: tedavi mac suresini degistirirse payda kayar).
   ═══════════════════════════════════════════════════════════════════════════════ */
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('node:fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const MAC = Math.max(1, Number(arg('--mac', 6)) || 6);
const TOHUM0 = Number(arg('--tohum0', 150000)) || 150000;

const { ctx } = tezgahKur();
const taban = JSON.parse(fs.readFileSync('qa-runtime/gercekci-taban.json', 'utf8'));
const TARIF = Object.assign({}, taban, {
    ad: 'STANDOFF',
    zorunlu: Object.assign({}, taban.zorunlu, { artillery: 2, mortar_team: 3, mlrs: 1 })
});

function kos(seed, kutle) {
    const kod = '(() => {\n' +
'  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;\n' +
'  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;\n' +
'  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;\n' +
'  BATTLE_KARSI_PLAN = false;\n' +
'  BATTLE_TOPCU_KUTLE_INTEL4 = ' + (kutle ? 'true' : 'false') + ';\n' +
'  BATTLE_RECIPE_BLUE = ' + JSON.stringify(TARIF) + ';\n' +
'  BATTLE_RECIPE_RED = null;\n' +
'  openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true,\n' +
'    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });\n' +
'  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;\n' +
'  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true,\n' +
'    varied:true, brainIntel4:true, isAttacker:false, recipe: BATTLE_RECIPE_BLUE }), false,\n' +
'    { source:"thk", ally:true });\n' +
'  startBattle(); SIM.headless = true;\n' +
'  BATTLE_LOOKAHEAD_RED = false; BATTLE_LOOKAHEAD_BLUE = false;\n' +
'\n' +
'  let maviDolayliBas = 0, maviDegerBas = 0;\n' +
'  for (const u of SIM.units) {\n' +
'    if (u.isRed) continue;\n' +
'    if (u.isIndirect) maviDolayliBas++;\n' +
'    maviDegerBas += (STATS[u.type] && STATS[u.type].cost) || 0;\n' +
'  }\n' +
'\n' +
'  let st = 0, orn = 0, kutleTop = 0, cbSay = 0, mesTop = 0;\n' +
'  while (phase === PHASE.BATTLE && SIM.tick < 7200) {\n' +
'    if (SIM.battle && SIM.battle.winnerSide !== null) break;\n' +
'    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);\n' +
'    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);\n' +
'    if (SIM.tick % 40 !== 0) continue;\n' +
'    for (const r of SIM.units) {\n' +
'      if (r.dead || r.abandoned || r.loaded || !r.isRed || !r.isIndirect) continue;\n' +
'      const t = r.attackTarget;\n' +
'      if (!t || t.dead || t.abandoned) continue;\n' +
'      orn++;\n' +
'      /* KUTLE: hedefin patlama yaricapindaki dusman sayisi (motorun kendi olcusuyle:\n' +
'         silahin aoe alani, yoksa ARTILLERY_SPLASH_RADIUS). */\n' +
'      const w = STATS[r.type] && STATS[r.type].weapons && STATS[r.type].weapons[0];\n' +
'      const R = (w && w.aoe > 0) ? w.aoe : ARTILLERY_SPLASH_RADIUS;\n' +
'      let k = 0;\n' +
'      for (const n of SIM.spatialGrid.getNearby(t.x, t.y, R)) {\n' +
'        if (n.dead || n.loaded || n.abandoned || n.isRed === r.isRed) continue;\n' +
'        if (Math.hypot(n.x - t.x, n.y - t.y) <= R) k++;\n' +
'      }\n' +
'      kutleTop += k;\n' +
'      if (typeof battleIsIndirectType === "function" && battleIsIndirectType(t.type)) cbSay++;\n' +
'      mesTop += Math.hypot(t.x - r.x, t.y - r.y);\n' +
'    }\n' +
'  }\n' +
'\n' +
'  let maviDolayliOlu = 0, maviDegerSon = 0, kirmiziDegerSon = 0;\n' +
'  for (const u of SIM.units) {\n' +
'    if (u.dead || u.abandoned) { if (!u.isRed && u.isIndirect) maviDolayliOlu++; continue; }\n' +
'    const c = (STATS[u.type] && STATS[u.type].cost) || 0;\n' +
'    if (u.isRed) kirmiziDegerSon += c; else maviDegerSon += c;\n' +
'  }\n' +
'  return JSON.stringify({ orn: orn,\n' +
'    kutle: orn ? kutleTop / orn : null,\n' +
'    cbPay: orn ? cbSay / orn : null,\n' +
'    mesafe: orn ? mesTop / orn : null,\n' +
'    maviDolayliBas: maviDolayliBas, maviDolayliOlu: maviDolayliOlu,\n' +
'    maviKayip: maviDegerBas - maviDegerSon,\n' +
'    marj: kirmiziDegerSon - maviDegerSon,\n' +
'    sure: Math.round(SIM.tick * 0.05) });\n' +
'})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'thk-' + seed + '-' + kutle + '.js' }));
}

console.log('');
console.log('TOPCU HEDEF KALITESI   ' + MAC + ' tohum x 2 kol   (BATTLE_TOPCU_KUTLE_INTEL4)');
console.log('  rakip: maviye dolayli ates zorlanmis · AI SALDIRAN · arama kapali');
console.log('');

const cift = [];
for (let i = 0; i < MAC; i++) {
    const seed = TOHUM0 + i;
    const k = kos(seed, false);
    const a = kos(seed, true);
    cift.push({ seed: seed, k: k, a: a });
    const f = (x, d) => x == null ? '  —' : x.toFixed(d);
    console.log('  tohum ' + seed +
        '   kutle ' + f(k.kutle, 2) + ' -> ' + f(a.kutle, 2) +
        '   cbPay ' + f(k.cbPay * 100, 0) + '% -> ' + f(a.cbPay * 100, 0) + '%' +
        '   mesafe ' + f(k.mesafe, 0) + ' -> ' + f(a.mesafe, 0) +
        '   dolayliOlu ' + k.maviDolayliOlu + '/' + k.maviDolayliBas +
        ' -> ' + a.maviDolayliOlu + '/' + a.maviDolayliBas +
        '   ornek ' + k.orn + '/' + a.orn);
}

function ozet(ad, sec, birim, basamak, yon) {
    const d = cift.map((c) => (sec(c.a) == null || sec(c.k) == null) ? null : sec(c.a) - sec(c.k))
        .filter((x) => x != null);
    if (!d.length) { console.log('  ' + ad.padEnd(12) + ' veri yok'); return; }
    const ort = d.reduce((a, b) => a + b, 0) / d.length;
    const std = d.length > 1
        ? Math.sqrt(d.reduce((a, b) => a + (b - ort) * (b - ort), 0) / (d.length - 1)) : 0;
    const t = std > 0 ? ort / (std / Math.sqrt(d.length)) : 0;
    const iyi = yon === 0 ? null : (yon > 0 ? ort > 0 : ort < 0);
    const hkm = yon === 0 ? 'bilgi' :
        (Math.abs(t) >= 2.0 ? (iyi ? 'YONU DOGRU, anlamli' : '⚠ TERS YON, anlamli') : 'anlamli degil');
    console.log('  ' + ad.padEnd(12) + (ort >= 0 ? '+' : '') + ort.toFixed(basamak).padStart(9) + ' ' +
        birim.padEnd(6) + '  std ' + std.toFixed(basamak).padStart(8) + '   t ' + t.toFixed(2).padStart(6) +
        '   ' + hkm);
}

const ornK = cift.reduce((a, c) => a + c.k.orn, 0);
const ornA = cift.reduce((a, c) => a + c.a.orn, 0);
console.log('');
console.log('  ESLESTIRILMIS FARK (acik - kapali),  n = ' + cift.length +
    '   ornek: kapali ' + ornK + ' / acik ' + ornA);
console.log('  ' + '-'.repeat(78));
ozet('kutle', (r) => r.kutle, 'dusman', 2, +1);              // ARTMALI
ozet('cbPay', (r) => r.cbPay == null ? null : r.cbPay * 100, '%', 1, +1);   // ARTMALI
ozet('mesafe', (r) => r.mesafe, 'px', 0, 0);                 // bilgi (bedel olabilir)
ozet('dolayliOlu', (r) => r.maviDolayliOlu, 'birim', 2, +1); // ARTMALI
ozet('maviKayip', (r) => r.maviKayip, 'TL', 0, +1);          // ARTMALI
ozet('marj', (r) => r.marj, 'TL', 0, 0);                     // KARAR DEGIL (n kucuk)
console.log('');
console.log('  OKUMA: kutle ve cbPay kuralin KENDI hedefledigi metrikler — onlar kimildamiyorsa');
console.log('  kural ONGORU\'de calismiyor demektir ve mac kapisina girmesin. marj KARAR DEGIL');
console.log('  (marj std 2600-3800; bu n ile hicbir sey soylemez).');
