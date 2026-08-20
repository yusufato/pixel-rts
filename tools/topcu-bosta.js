#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════════
   TOPCU NEDEN BOSTA — %33'luk israfin uc olasi sebebini AYIRIR

   Olculdu (8 tohum, taban davranis): kirmizinin dolayli-ates birimleri zamanin
   **%33'unde** hedefsiz. Durum kodu "READY" — yani hazir, mühimmatli, ama nisan almiyor.
   Bu karsi-plandan BAGIMSIZ bir kusur: dolayli ates ordunun en pahali kalemi.

   Uc olasilik var ve tek tek ayrilabilir. Her BOSTA ornegi tam bir kovaya duser:

     A) MENZILDE HIC DUSMAN YOK      -> konum/menzil sorunu (yaklasmasi gerekiyor)
     B) MENZILDE VAR ama GOZCU YOK   -> gozcu kurali (kesifle eslesme sorunu)
     C) MENZILDE VAR ve GOZCU VAR    -> HEDEF SECIMI KUSURU  <-- gercek bug burasi
     D) baska durum kodu             -> Cephanesiz / Gozcu Yok / hareket vb.

   C sifirdan buyukse, topcu ates edebilecegi bir hedef varken bilerek bosta duruyor.

   Kullanicinin 4 gercek macindaki teshisle ayni aileden:
       "TOPCUx3 maci: 214 saniye boyunca TOPLAM 1 ATIS (%0)"
       "AI atislarinin %68'ini ZIRHLI'ya harcadi"
   ═══════════════════════════════════════════════════════════════════════════════ */
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('node:fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const MAC = Math.max(1, Number(arg('--mac', 6)) || 6);
const TOHUM0 = Number(arg('--tohum0', 147000)) || 147000;
const STANDOFF = !process.argv.includes('--duz');   // varsayilan: rakipte dolayli ates zorlanmis

const { ctx } = tezgahKur();
const taban = JSON.parse(fs.readFileSync('qa-runtime/gercekci-taban.json', 'utf8'));
const TARIF = STANDOFF
    ? Object.assign({}, taban, { ad: 'STANDOFF',
        zorunlu: Object.assign({}, taban.zorunlu, { artillery: 2, mortar_team: 3, mlrs: 1 }) })
    : taban;

function kos(seed) {
    const kod = '(() => {\n' +
'  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;\n' +
'  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;\n' +
'  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;\n' +
'  BATTLE_KARSI_PLAN = false;\n' +
'  BATTLE_RECIPE_BLUE = ' + JSON.stringify(TARIF) + ';\n' +
'  BATTLE_RECIPE_RED = null;\n' +
'  openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true,\n' +
'    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });\n' +
'  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;\n' +
'  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true,\n' +
'    varied:true, brainIntel4:true, isAttacker:false, recipe: BATTLE_RECIPE_BLUE }), false,\n' +
'    { source:"tb", ally:true });\n' +
'  startBattle(); SIM.headless = true;\n' +
'  BATTLE_LOOKAHEAD_RED = false; BATTLE_LOOKAHEAD_BLUE = false;\n' +
'\n' +
'  let st = 0, birimOrn = 0, atesli = 0;\n' +
'  let A = 0, B = 0, C = 0, D = 0;\n' +
'  const durum = {};\n' +
'  let cYakin = 0, cN = 0, cAday = 0;\n' +
'  const cTip = {};\n' +
'\n' +
'  while (phase === PHASE.BATTLE && SIM.tick < 7200) {\n' +
'    if (SIM.battle && SIM.battle.winnerSide !== null) break;\n' +
'    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);\n' +
'    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);\n' +
'    if (SIM.tick % 40 !== 0) continue;\n' +
'\n' +
'    for (const r of SIM.units) {\n' +
'      if (r.dead || r.abandoned || r.loaded || !r.isRed || !r.isIndirect) continue;\n' +
'      birimOrn++;\n' +
'      if (r.attackTarget) { atesli++; continue; }\n' +
'      const ds = String(r.combatState || "?");\n' +
'      durum[ds] = (durum[ds] || 0) + 1;\n' +
'      if (ds !== "READY") { D++; continue; }\n' +
'\n' +
'      /* BOSTA + READY: menzilde dusman var mi, varsa gozcu saglaniyor mu */\n' +
'      let menzilde = 0, gozculu = 0, yakin = 1e9, ornekHedef = null;\n' +
'      for (const e of SIM.units) {\n' +
'        if (e.dead || e.abandoned || e.loaded || e.isRed) continue;\n' +
'        const st2 = STATS[e.type];\n' +
'        if (!st2) continue;\n' +
'        const d = Math.hypot(e.x - r.x, e.y - r.y);\n' +
'        if (d < yakin) yakin = d;\n' +
'        if (d > (r.range || 0)) continue;\n' +
'        menzilde++;\n' +
'        /* HEDEF UYGUNLUGU da sart: vuramayacagi hedef "kacirilmis firsat" degildir.\n' +
'           Bu denetim ilk surumde YOKTU ve C kovasini sisirmis olabilir. */\n' +
'        if (typeof unitCanEngage === "function" &&\n' +
'            !unitCanEngage(STATS[r.type], STATS[e.type])) continue;\n' +
'        if (typeof artilleryHasSight === "function" && artilleryHasSight(r, e)) {\n' +
'          gozculu++; if (!ornekHedef) ornekHedef = e;\n' +
'        }\n' +
'      }\n' +
'      if (!menzilde) { A++; continue; }\n' +
'      if (!gozculu) { B++; continue; }\n' +
'      C++;\n' +
'      cAday += gozculu;\n' +
'      if (yakin < 1e9) { cYakin += yakin; cN++; }\n' +
'      if (ornekHedef) { const t = "tip" + ornekHedef.type; cTip[t] = (cTip[t] || 0) + 1; }\n' +
'    }\n' +
'  }\n' +
'  let rN = 0, rMenzil = 0;\n' +
'  for (const r of SIM.units) if (r.isRed && r.isIndirect) { rN++; rMenzil += (r.range || 0); }\n' +
'  return JSON.stringify({ birimOrn: birimOrn, atesli: atesli, A: A, B: B, C: C, D: D,\n' +
'    durum: durum, cYakin: cN ? cYakin / cN : null, cAday: C ? cAday / C : 0, cTip: cTip,\n' +
'    topSayi: rN, topMenzil: rN ? rMenzil / rN : 0, sure: Math.round(SIM.tick * 0.05) });\n' +
'})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'tb-' + seed + '.js' }));
}

console.log('');
console.log('TOPCU NEDEN BOSTA   ' + MAC + ' tohum   rakip=' + (STANDOFF ? 'STANDOFF (dolayli zorlanmis)' : 'duz taban'));
console.log('');
const T = { birimOrn: 0, atesli: 0, A: 0, B: 0, C: 0, D: 0 };
const durum = {}, cTip = {};
let cY = 0, cYN = 0, cAday = 0, cAdayN = 0;
for (let i = 0; i < MAC; i++) {
    const r = kos(TOHUM0 + i);
    for (const f of ['birimOrn', 'atesli', 'A', 'B', 'C', 'D']) T[f] += r[f];
    for (const k of Object.keys(r.durum || {})) durum[k] = (durum[k] || 0) + r.durum[k];
    for (const k of Object.keys(r.cTip || {})) cTip[k] = (cTip[k] || 0) + r.cTip[k];
    if (r.cYakin != null) { cY += r.cYakin; cYN++; }
    if (r.C) { cAday += r.cAday; cAdayN++; }
    const bosta = r.A + r.B + r.C + r.D;
    const p = (x) => bosta ? (100 * x / bosta).toFixed(0).padStart(3) + '%' : '  —';
    console.log('  tohum ' + (TOHUM0 + i) + '  topcu ' + r.topSayi + ' (menzil ' + Math.round(r.topMenzil) + ')' +
        '   bosta ' + (r.birimOrn ? (100 * bosta / r.birimOrn).toFixed(0) : 0) + '%' +
        '   ->  A(menzilde yok) ' + p(r.A) + '   B(gozcu yok) ' + p(r.B) +
        '   C(HEDEF SECIMI) ' + p(r.C) + '   D(baska durum) ' + p(r.D) +
        '   sure ' + r.sure + 'sn');
}
const bosta = T.A + T.B + T.C + T.D;
const P = (x) => bosta ? (100 * x / bosta).toFixed(1) + '%' : '—';
console.log('');
console.log('  TOPLAM   ' + T.birimOrn + ' birim-ornegi,  ' + bosta + ' tanesi BOSTA (%' +
    (T.birimOrn ? (100 * bosta / T.birimOrn).toFixed(1) : 0) + ')');
console.log('  ' + '-'.repeat(72));
console.log('    A · menzilde hic dusman yok       ' + P(T.A).padStart(7) + '   -> konum/menzil sorunu');
console.log('    B · menzilde var, GOZCU yok       ' + P(T.B).padStart(7) + '   -> gozcu kurali / kesif eslesmesi');
console.log('    C · menzilde var, GOZCU VAR       ' + P(T.C).padStart(7) + '   -> HEDEF SECIMI KUSURU');
console.log('    D · baska durum kodu              ' + P(T.D).padStart(7) + '   -> ' +
    Object.keys(durum).filter((k) => k !== 'READY').sort((a, b) => durum[b] - durum[a]).slice(0, 3)
        .map((k) => k + ' ' + durum[k]).join(' · '));
console.log('');
if (T.C) {
    console.log('  C KOVASI AYRINTI (topcu ates edebilecekken durdugu anlar)');
    console.log('    ornek basina uygun hedef sayisi : ' + (cAdayN ? (cAday / cAdayN).toFixed(1) : '—'));
    console.log('    en yakin dusman mesafesi        : ' + (cYN ? Math.round(cY / cYN) + 'px' : '—'));
    const sr = Object.keys(cTip).sort((a, b) => cTip[b] - cTip[a]);
    const tp = sr.reduce((a, k) => a + cTip[k], 0) || 1;
    console.log('    goz ardi edilen hedef tipleri   : ' +
        sr.slice(0, 5).map((k) => k + ' %' + (100 * cTip[k] / tp).toFixed(0)).join(' · '));
    console.log('');
    console.log('  ⛔ C > 0 demek: topcu vurabilecegi bir hedef varken BOSTA duruyor.');
} else {
    console.log('  ✅ C = 0 — topcu ates edebilecekken hic bosta durmuyor. Israf A/B/D kovalarinda.');
}
