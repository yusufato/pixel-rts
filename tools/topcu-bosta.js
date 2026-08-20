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
/* Ikmal araci kirilgan; ileri gitmek onu oldurebilir. O yuzden OLUM ANI da sayilir —
   kazanc kaybi ile birlikte okunmali. (Bir ara BATTLE_IKMAL_TAKIP diye kendi surumum
   vardi; mevcut supplyEscort kurali onu her eksende yendi ve o bayrak silindi.) */
const TAKIP = false;
/* --refakat : depoda ZATEN YAZILI olan 'supplyEscort' kuralini ONGORU'de acar.
   Ayni isi yapan yarismaci surum; kazanan mac kapisina gider, kaybeden SILINIR. */
const REFAKAT = process.argv.includes('--refakat');

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
'  BATTLE_IKMAL_REFAKAT_INTEL4 = ' + (REFAKAT ? 'true' : 'false') + ';\n' +
'  BATTLE_KP_TELEMETRI = { ikmalEmri: 0 };\n' +
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
'  let ikmalOlumTik = null, ikmalBas = 0;\n' +
'  for (const u of SIM.units) if (u.isRed && u.type === T.SUPPLY) ikmalBas++;\n' +
'  let A = 0, B = 0, C = 0, D = 0, C1 = 0, C2 = 0, C3 = 0;\n' +
'  const durum = {};\n' +
'  let cYakin = 0, cN = 0, cAday = 0;\n' +
'  let cephSay = 0, cephIkmalYok = 0, cephMes = 0, cephMesN = 0, cephYakin = 0;\n' +
'  const cTip = {};\n' +
'\n' +
'  while (phase === PHASE.BATTLE && SIM.tick < 7200) {\n' +
'    if (SIM.battle && SIM.battle.winnerSide !== null) break;\n' +
'    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);\n' +
'    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);\n' +
'    if (SIM.tick % 40 !== 0) continue;\n' +
'    if (ikmalOlumTik == null && ikmalBas) {\n' +
'      let sag = 0;\n' +
'      for (const u of SIM.units) if (u.isRed && u.type === T.SUPPLY && !u.dead && !u.abandoned) sag++;\n' +
'      if (!sag) ikmalOlumTik = SIM.tick;\n' +
'    }\n' +
'\n' +
'    for (const r of SIM.units) {\n' +
'      if (r.dead || r.abandoned || r.loaded || !r.isRed || !r.isIndirect) continue;\n' +
'      birimOrn++;\n' +
'      if (r.attackTarget) { atesli++; continue; }\n' +
'      const ds = String(r.combatState || "?");\n' +
'      durum[ds] = (durum[ds] || 0) + 1;\n' +
'      if (ds !== "READY") {\n' +
'        D++;\n' +
'        /* CEPHANESIZ ANLARDA IKMAL NEREDE? Savunan kurulumda ikmal olumu topcuyu\n' +
'           kurutmuyordu (cephane %51, kuru 0.00) ama SALDIRAN kurulumda topcu zamanin\n' +
'           %25inde cephanesiz. Hipotez: ileri giden topcu ikmalinden kopuyor. */\n' +
'        if (ds.indexOf("ephanesiz") >= 0) {\n' +
'          let yakinIkmal = 1e9, ikmalVar = 0;\n' +
'          for (const s2 of SIM.units) {\n' +
'            if (s2.dead || s2.abandoned || s2.loaded || !s2.isRed) continue;\n' +
'            if (s2.type !== T.SUPPLY && s2.type !== T.ENGINEER) continue;\n' +
'            ikmalVar++;\n' +
'            const d2 = Math.hypot(s2.x - r.x, s2.y - r.y);\n' +
'            if (d2 < yakinIkmal) yakinIkmal = d2;\n' +
'          }\n' +
'          cephSay++;\n' +
'          if (!ikmalVar) cephIkmalYok++;\n' +
'          else { cephMes += yakinIkmal; cephMesN++; if (yakinIkmal <= 400) cephYakin++; }\n' +
'        }\n' +
'        continue;\n' +
'      }\n' +
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
'        /* ⚠ ASGARI MENZIL (olu bolge) — ILK SURUMDE YOKTU ve C kovasini SISIRDI.\n' +
'           Havan 3 / topcu 5 / CNRA 8 / balistik 20 (tile). CNRA icin 800px demek;\n' +
'           ilk olcumde "en yakin dusman 749px" cikmisti, yani o hedeflerin bir kismi\n' +
'           vurulamaz olu bolgedeydi ve "kacirilmis firsat" diye sayilmisti.\n' +
'           Motor da tam bu denetimi yapiyor: Unit.js "__minR > 0 && d < __minR". */\n' +
'        const _mr = (STATS[r.type] && STATS[r.type].minRange) || 0;\n' +
'        if (_mr > 0 && d < _mr) continue;\n' +
'        /* KARA-MENZIL SINIRI (SPAAG gibi): motor ayrica bunu da suzuyor. */\n' +
'        if (r.groundRange > 0 && !e.isAir && d > r.groundRange) continue;\n' +
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
'      /* C KOVASINI IKIYE BOL — MOTORUN KENDI SUZGECIYLE.\n' +
'         Filtreleri elle taklit etmek yanilticiydi (minRange denetimini ilk surumde\n' +
'         unutmustum). Dogrusu motorun kendi fonksiyonunu cagirmak:\n' +
'           C1: findBestVisibleEnemy() NULL   -> motorun suzgeci eliyor, benim filtrem gevsek\n' +
'           C2: aday VAR ama birim ates etmiyor -> CAGIRAN taraftaki kapi (asil bug)\n' +
'         ⚠ Saf okuma: findBestVisibleEnemy sim durumunu degistirmez. */\n' +
'      let _aday = null;\n' +
'      try { _aday = r.findBestVisibleEnemy(); } catch (_e) { _aday = null; }\n' +
'      if (!_aday) C1++;\n' +
'      else if (_aday.dist <= (r.range || 0)) C2++;\n' +
'      else C3++;\n' +
'      cAday += gozculu;\n' +
'      if (yakin < 1e9) { cYakin += yakin; cN++; }\n' +
'      if (ornekHedef) { const t = "tip" + ornekHedef.type; cTip[t] = (cTip[t] || 0) + 1; }\n' +
'    }\n' +
'  }\n' +
'  let rN = 0, rMenzil = 0;\n' +
'  /* ⚠ SAG KALAN topcu — KOMPOZISYON DEGIL. Olu birimler SIM.units icinden siliniyor\n' +
'     (js/main.js:1807 splice) ama filtresiz sayarsan yine yanilirsin: iki kolun mac\n' +
'     sonundaki sag-kalan sayisi farkli olunca "farkli ordu kurulmus" saniyorsun.\n' +
'     Bu tam olarak yasandi: ayni tohumda kapali 0 / acik 3 gorundu. */\n' +
'  for (const r of SIM.units) {\n' +
'    if (!r.isRed || !r.isIndirect || r.dead || r.abandoned) continue;\n' +
'    rN++; rMenzil += (r.range || 0);\n' +
'  }\n' +
'  return JSON.stringify({ birimOrn: birimOrn, atesli: atesli, A: A, B: B, C: C, D: D,\n' +
'    durum: durum, cYakin: cN ? cYakin / cN : null, cAday: C ? cAday / C : 0, cTip: cTip,\n' +
'    C1: C1, C2: C2, C3: C3,\n' +
'    topSayi: rN, topMenzil: rN ? rMenzil / rN : 0, sure: Math.round(SIM.tick * 0.05),\n' +
'    cephSay: cephSay, cephIkmalYok: cephIkmalYok, cephYakin: cephYakin,\n' +
'    cephMes: cephMesN ? cephMes / cephMesN : null,\n' +
'    ikmalBas: ikmalBas,\n' +
'    ikmalOlumSn: ikmalOlumTik == null ? null : Math.round(ikmalOlumTik * 0.05),\n' +
'    ikmalEmri: (BATTLE_KP_TELEMETRI && BATTLE_KP_TELEMETRI.ikmalEmri) | 0 });\n' +
'})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'tb-' + seed + '.js' }));
}

console.log('');
console.log('TOPCU NEDEN BOSTA   ' + MAC + ' tohum   rakip=' + (STANDOFF ? 'STANDOFF (dolayli zorlanmis)' : 'duz taban'));
console.log('  KOL: ' + (TAKIP ? 'IKMAL_TAKIP (benim)' : REFAKAT ? 'IKMAL_REFAKAT (mevcut supplyEscort)' : 'TABAN'));
console.log('');
const T = { birimOrn: 0, atesli: 0, A: 0, B: 0, C: 0, D: 0, C1: 0, C2: 0, C3: 0 };
const durum = {}, cTip = {};
let cY = 0, cYN = 0, cAday = 0, cAdayN = 0;
const cS = { say: 0, ikmalYok: 0, yakin: 0, mes: 0, mesN: 0 };
const ikS = { emir: 0, olu: 0, olumSn: 0 };
for (let i = 0; i < MAC; i++) {
    const r = kos(TOHUM0 + i);
    for (const f of ['birimOrn', 'atesli', 'A', 'B', 'C', 'D', 'C1', 'C2', 'C3']) T[f] += (r[f] || 0);
    for (const k of Object.keys(r.durum || {})) durum[k] = (durum[k] || 0) + r.durum[k];
    for (const k of Object.keys(r.cTip || {})) cTip[k] = (cTip[k] || 0) + r.cTip[k];
    if (r.cYakin != null) { cY += r.cYakin; cYN++; }
    ikS.emir += r.ikmalEmri || 0;
    if (r.ikmalOlumSn != null) { ikS.olu++; ikS.olumSn += r.ikmalOlumSn; }
    cS.say += r.cephSay || 0; cS.ikmalYok += r.cephIkmalYok || 0; cS.yakin += r.cephYakin || 0;
    if (r.cephMes != null) { cS.mes += r.cephMes; cS.mesN++; }
    if (r.C) { cAday += r.cAday; cAdayN++; }
    const bosta = r.A + r.B + r.C + r.D;
    const p = (x) => bosta ? (100 * x / bosta).toFixed(0).padStart(3) + '%' : '  —';
    console.log('  tohum ' + (TOHUM0 + i) + '  sagTopcu ' + r.topSayi + ' (menzil ' + Math.round(r.topMenzil) + ')' +
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
console.log('  IKMAL: faz-bagimsiz ileri emir ' + ikS.emir +
    '   ikmal araci olen mac ' + ikS.olu + '/' + MAC +
    (ikS.olu ? ('   ort. olum ' + Math.round(ikS.olumSn / ikS.olu) + 'sn') : ''));
console.log('');
if (cS.say) {
    console.log('  CEPHANESIZ ANLARDA IKMAL NEREDE  (' + cS.say + ' ornek)');
    console.log('    hic ikmal/istihkam KALMAMIS   : ' + (100 * cS.ikmalYok / cS.say).toFixed(1) + '%');
    console.log('    ikmal VAR ve 400px icinde     : ' + (100 * cS.yakin / cS.say).toFixed(1) +
        '%   <- hale menzilinde ama yine kuru');
    console.log('    en yakin ikmale ort. mesafe   : ' + (cS.mesN ? Math.round(cS.mes / cS.mesN) + 'px' : '—'));
    console.log('');
}
if (T.C) {
    console.log('  C KOVASI, MOTORUN KENDI SUZGECIYLE BOLUNDU');
    console.log('    C1 · motorun suzgeci eliyor   : ' + T.C1 + '   (benim filtrem gevsek demek)');
    console.log('    C2 · aday VAR ama ates YOK    : ' + T.C2 + '   <- CAGIRAN taraftaki kapi = asil bug');
    console.log('    C3 · aday var, menzil disinda : ' + T.C3);
    console.log('');
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
