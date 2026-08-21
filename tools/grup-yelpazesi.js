'use strict';
/* ═══════════════════════════════════════════════════════════════════════════════
   GRUP YELPAZESI — "kutleyi oynatmak, tek birimi oynatmaktan daha cok fark yaratir mi?"

   BUTUN GRUP-ARAMA PLANI TEK BIR IDDIAYA DAYANIYOR (docs/PLAN-GRUP-ARAMA.md):
       grup adaylari arasi YAYILIM, birim adaylari arasindakinden belirgin BUYUKTUR.
   Bu arac o iddiayi INSA ETMEDEN sinar. Kucuk cikarsa plan DUSER.

   NEDEN ONEMLI — zaten olculmus uc kusurun ortak koku bu darlik:
     · kararlarin %29'unda adaylar arasi yayilim SIFIR   (tools/gelecek-yelpazesi.js)
     · deger agi aday siralamada rastgeleden KOTU        (%10.8 vs taban %18, n=55)
     · manevra ifade edilemiyor                          (karsi-plan + yerel_ustunluk, 2026-08-20)
   Kodun kendi ifadesi: "adaylar birbirinden TEK BIR BIRIMIN nereye yuruyecegi kadar
   farkli ve global durum degeri o farkla degismiyor."

   ⭐ KONTROLLU KARSILASTIRMA — tasarimin ozu:
   Iki kolda da AYNI hedef noktalari kullanilir (ayni geometri, ayni sayi). Tek fark
   KAC BIRIM oynar:
       BIREY : capa birim TEK BASINA o noktaya gider
       KUTLE : capa birimin cevresindeki en yakin K birim BIRLIKTE gider
                (her biri kendi ofsetini korur -> formasyon dagilmaz)
   Boylece "yayilim farki noktalarin farkindan mi, kutlenin farkindan mi" sorusu
   karismaz. Bu ayrim olmadan olcum yaniltir.

   YONTEM (her olcum aninda):
     1. fork al
     2. her aday nokta icin: restore -> emri uygula -> UFUK tik oynat -> skor
     3. YAYILIM = max(skor) - min(skor)   ve   "sifir yayilim" orani
   Skor: kirmizi-mavi deger marji (rollout sonu - rollout basi), yani ayni olcek.

   ⚠ Rollout boyunca oynatilan birimler controlOwner='PLAYER' yapilir ki AI onlari
   yeniden yonlendirmesin. Bu bir davranis farki YARATIR ama IKI KOLDA DA ayni oldugu
   icin KARSILASTIRMA gecerlidir (mutlak deger degil, YAYILIM okunur) — mevcut
   gelecek-yelpazesi.js de ayni gerekceyle boyle yapiyor.

   ⚠ ARAMA KAPALI kosar: bu olcum aramanin YERINE gecmiyor, aramanin ADAY UZAYINI
   sinamak icin ayni mekanigi elle kuruyor.
   ═══════════════════════════════════════════════════════════════════════════════ */
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('node:fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const MAC = Math.max(1, Number(arg('--mac', 3)) || 3);
const TOHUM0 = Number(arg('--tohum0', 170000)) || 170000;
const UFUK = Math.max(50, Number(arg('--ufuk', 200)) || 200);        // tik (200 = 10sn)
const YARICAP = Math.max(100, Number(arg('--yaricap', 600)) || 600); // aday halkasi
const YON = Math.max(3, Number(arg('--yon', 8)) || 8);               // aday yonu
const KUTLE = Math.max(2, Number(arg('--kutle', 8)) || 8);           // grup kolunda kac birim
const CAPA = Math.max(1, Number(arg('--capa', 3)) || 3);             // olcum basina kac capa birim
const ANLAR = String(arg('--anlar', '700,1500,2300')).split(',').map(Number).filter(Boolean);

const { ctx, hatalar } = tezgahKur();
const taban = JSON.parse(fs.readFileSync('qa-runtime/gercekci-taban.json', 'utf8'));

function kos(seed) {
    const kod = '(() => {\n' +
'  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;\n' +
'  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;\n' +
'  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;\n' +
'  BATTLE_RECIPE_BLUE = ' + JSON.stringify(taban) + ';\n' +
'  BATTLE_RECIPE_RED = null;\n' +
'  openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true,\n' +
'    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });\n' +
'  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;\n' +
'  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true,\n' +
'    varied:true, brainIntel4:true, isAttacker:false, recipe: BATTLE_RECIPE_BLUE }), false,\n' +
'    { source:"gy", ally:true });\n' +
'  startBattle(); SIM.headless = true;\n' +
'  BATTLE_LOOKAHEAD_RED = false; BATTLE_LOOKAHEAD_BLUE = false;\n' +
'\n' +
'  const ANLAR = ' + JSON.stringify(ANLAR) + ';\n' +
'  const UFUK = ' + UFUK + ', YARICAP = ' + YARICAP + ', YON = ' + YON + ';\n' +
'  const KUTLE = ' + KUTLE + ', CAPA = ' + CAPA + ';\n' +
'  const olcumler = [];\n' +
'\n' +
'  /* Marj: kirmizi - mavi ayakta deger. Skor = rollout sonu - rollout basi. */\n' +
'  function marj() {\n' +
'    let k = 0, m = 0;\n' +
'    for (const u of SIM.units) {\n' +
'      if (u.dead || u.abandoned) continue;\n' +
'      const c = (STATS[u.type] && STATS[u.type].cost) || 0;\n' +
'      if (u.isRed) k += c; else m += c;\n' +
'    }\n' +
'    return k - m;\n' +
'  }\n' +
'  /* Aday noktalar: capa birimin cevresinde YON yonlu tek halka + "yerinde kal". */\n' +
'  function adaylar(cx, cy) {\n' +
'    const out = [{ x: cx, y: cy, kal: true }];\n' +
'    for (let i = 0; i < YON; i++) {\n' +
'      const a = (Math.PI * 2 * i) / YON;\n' +
'      const px = cx + Math.cos(a) * YARICAP, py = cy + Math.sin(a) * YARICAP;\n' +
'      if (px < 60 || py < 60 || px > WORLD_W - 60 || py > WORLD_H - 60) continue;\n' +
'      if (typeof isPassableAt === "function" && !isPassableAt(px, py)) continue;\n' +
'      out.push({ x: px, y: py, kal: false });\n' +
'    }\n' +
'    return out;\n' +
'  }\n' +
'  /* Kutle: capaya en yakin K silahli KIRMIZI birim (capa dahil). Determinist:\n' +
'     mesafeye gore, esitlikte id. */\n' +
'  function kutleSec(capa, K) {\n' +
'    const aday = [];\n' +
'    for (const u of SIM.units) {\n' +
'      if (u.dead || u.loaded || u.abandoned || !u.isRed) continue;\n' +
'      const s = STATS[u.type];\n' +
'      if (!s || !s.weapons || !s.weapons.length) continue;\n' +
'      aday.push({ u: u, d: Math.hypot(u.x - capa.x, u.y - capa.y) });\n' +
'    }\n' +
'    aday.sort((a, b) => (a.d - b.d) || (a.u.id - b.u.id));\n' +
'    return aday.slice(0, K).map((x) => x.u);\n' +
'  }\n' +
'\n' +
'  let st = 0, anIdx = 0;\n' +
'  while (phase === PHASE.BATTLE && SIM.tick < 7200 && anIdx < ANLAR.length) {\n' +
'    if (SIM.battle && SIM.battle.winnerSide !== null) break;\n' +
'    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);\n' +
'    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);\n' +
'    if (SIM.tick < ANLAR[anIdx]) continue;\n' +
'    anIdx++;\n' +
'\n' +
'    /* CAPA BIRIMLER: kirmizinin en degerli silahli birimleri (determinist siralama) */\n' +
'    const capalar = [];\n' +
'    for (const u of SIM.units) {\n' +
'      if (u.dead || u.loaded || u.abandoned || !u.isRed) continue;\n' +
'      const s = STATS[u.type];\n' +
'      if (!s || !s.weapons || !s.weapons.length) continue;\n' +
'      capalar.push(u);\n' +
'    }\n' +
'    capalar.sort((a, b) => (((STATS[b.type] && STATS[b.type].cost) || 0) -\n' +
'                            ((STATS[a.type] && STATS[a.type].cost) || 0)) || (a.id - b.id));\n' +
'    const secili = capalar.slice(0, CAPA);\n' +
'    if (!secili.length) continue;\n' +
'\n' +
'    for (const capa of secili) {\n' +
'      const noktalar = adaylar(capa.x, capa.y);\n' +
'      if (noktalar.length < 3) continue;\n' +
'      const kutle = kutleSec(capa, KUTLE);\n' +
'      const kutleId = kutle.map((u) => u.id);\n' +
'      /* ofsetler: formasyon korunsun diye her birim capaya gore kendi farkini tasir */\n' +
'      const ofset = kutle.map((u) => ({ id: u.id, dx: u.x - capa.x, dy: u.y - capa.y }));\n' +
'      const capaId = capa.id;\n' +
'\n' +
'      for (const kip of ["birey", "kutle"]) {\n' +
'        const skorlar = [];\n' +
'        for (const nokta of noktalar) {\n' +
'          const fork = battleForkCapture();\n' +
'          const bas = marj();\n' +
'          const hedefler = (kip === "birey")\n' +
'            ? [{ id: capaId, x: nokta.x, y: nokta.y }]\n' +
'            : ofset.map((o) => ({ id: o.id, x: nokta.x + o.dx, y: nokta.y + o.dy }));\n' +
'          for (const h of hedefler) {\n' +
'            const u = SIM.units.find((x) => x.id === h.id);\n' +
'            if (!u || u.dead) continue;\n' +
'            u.controlOwner = "PLAYER";\n' +
'            u.manualTarget = null; u.attackTarget = null;\n' +
'            u.targetX = h.x; u.targetY = h.y;\n' +
'            u.manualMoveTarget = { x: h.x, y: h.y };\n' +
'            u.isMovingToManualTarget = true; u._holdingPos = false;\n' +
'          }\n' +
'          let s2 = st;\n' +
'          for (let t = 0; t < UFUK && phase === PHASE.BATTLE; t++) {\n' +
'            s2 += BATTLE_TICK_MS;\n' +
'            stepSim(s2, BATTLE_TICK_SEC, battleControllersDrive, false);\n' +
'          }\n' +
'          skorlar.push(marj() - bas);\n' +
'          battleForkRestore(fork);\n' +
'        }\n' +
'        if (skorlar.length < 3) continue;\n' +
'        const enB = Math.max.apply(null, skorlar), enK = Math.min.apply(null, skorlar);\n' +
'        olcumler.push({ tik: ANLAR[anIdx - 1], kip: kip, capa: capaId,\n' +
'          birim: kip === "birey" ? 1 : kutleId.length,\n' +
'          aday: skorlar.length, yayilim: enB - enK,\n' +
'          enIyi: enB, kal: skorlar[0] });\n' +
'      }\n' +
'    }\n' +
'\n' +
'    /* ── UCUNCU KIP: GERCEK GOREV GRUBU ────────────────────────────────────────\n' +
'       Ilk iki kip ("birey" ve "kutle") kontrollu ama YAPAY: kutle, capaya en yakin\n' +
'       K birim. Aramanin gercekte kullanacagi nesne bu degil, TASK CONTRACT: kontrolor\n' +
'       zaten MAIN/FIXING/FLANK gruplarini kuruyor ve her birinin unitIds listesi var\n' +
'       (controller.operationalPlan.taskContracts).\n' +
'       Hedefler de yapay halka degil, aramanin gercekte deneyecegi seyler: UC SEKTOR\n' +
'       MERKEZI (assignSectors ile ayni x-bandlari) + kendi objektifi + yerinde kal.\n' +
'       Yani bu kip, "grup aramasi kurulursa aday uzayi ne kadar yayilir" sorusunun\n' +
'       en sadik hali. */\n' +
'    let kirmiziKtrl = null;\n' +
'    if (typeof BATTLE_CONTROLLERS !== "undefined") {\n' +
'      for (const c of BATTLE_CONTROLLERS.values()) if (c && c.side === true) kirmiziKtrl = c;\n' +
'    }\n' +
'    const sozlesmeler = (kirmiziKtrl && kirmiziKtrl.operationalPlan &&\n' +
'      kirmiziKtrl.operationalPlan.taskContracts) || [];\n' +
'    for (const sz of sozlesmeler) {\n' +
'      const ids = (sz.unitIds || []).slice();\n' +
'      if (ids.length < 3) continue;                    /* tek-iki birimlik grup "grup" degil */\n' +
'      const uyeler = [];\n' +
'      for (const id of ids) {\n' +
'        const u = SIM.units.find((x) => x.id === id);\n' +
'        if (u && !u.dead && !u.loaded && !u.abandoned) uyeler.push(u);\n' +
'      }\n' +
'      if (uyeler.length < 3) continue;\n' +
'      let gx = 0, gy = 0;\n' +
'      for (const u of uyeler) { gx += u.x; gy += u.y; }\n' +
'      gx /= uyeler.length; gy /= uyeler.length;\n' +
'      const ofsetG = uyeler.map((u) => ({ id: u.id, dx: u.x - gx, dy: u.y - gy }));\n' +
'\n' +
'      /* SEKTOR MERKEZLERI: assignSectors ile ayni esikler (WORLD_W/3). Derinlik grubun\n' +
'         kendi y sinde kalir — bu kip SEKTOR secimini olcuyor, derinlik degil. */\n' +
'      const gHedef = [{ x: gx, y: gy }];\n' +
'      for (const sx of [WORLD_W / 6, WORLD_W / 2, WORLD_W * 5 / 6]) {\n' +
'        if (Math.abs(sx - gx) < 40) continue;          /* zaten oradaysa aday degil */\n' +
'        gHedef.push({ x: sx, y: gy });\n' +
'      }\n' +
'      if (typeof battleObjectiveForSide === "function") {\n' +
'        const o = battleObjectiveForSide(true);\n' +
'        if (o) gHedef.push({ x: o.x, y: o.y });\n' +
'      }\n' +
'      if (gHedef.length < 3) continue;\n' +
'\n' +
'      const gSkor = [];\n' +
'      for (const h of gHedef) {\n' +
'        const fork = battleForkCapture();\n' +
'        const bas = marj();\n' +
'        for (const o of ofsetG) {\n' +
'          const u = SIM.units.find((x) => x.id === o.id);\n' +
'          if (!u || u.dead) continue;\n' +
'          u.controlOwner = "PLAYER";\n' +
'          u.manualTarget = null; u.attackTarget = null;\n' +
'          u.targetX = h.x + o.dx; u.targetY = h.y + o.dy;\n' +
'          u.manualMoveTarget = { x: h.x + o.dx, y: h.y + o.dy };\n' +
'          u.isMovingToManualTarget = true; u._holdingPos = false;\n' +
'        }\n' +
'        let s3 = st;\n' +
'        for (let t = 0; t < UFUK && phase === PHASE.BATTLE; t++) {\n' +
'          s3 += BATTLE_TICK_MS;\n' +
'          stepSim(s3, BATTLE_TICK_SEC, battleControllersDrive, false);\n' +
'        }\n' +
'        gSkor.push(marj() - bas);\n' +
'        battleForkRestore(fork);\n' +
'      }\n' +
'      if (gSkor.length < 3) continue;\n' +
'      const gB = Math.max.apply(null, gSkor), gK = Math.min.apply(null, gSkor);\n' +
'      olcumler.push({ tik: ANLAR[anIdx - 1], kip: "grup", rol: String(sz.groupRole),\n' +
'        birim: uyeler.length, aday: gSkor.length, yayilim: gB - gK,\n' +
'        enIyi: gB, kal: gSkor[0] });\n' +
'    }\n' +
'  }\n' +
'  return JSON.stringify(olcumler);\n' +
'})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'gy-' + seed + '.js' }));
}

console.log('');
console.log('GRUP YELPAZESI   ' + MAC + ' tohum   ufuk ' + UFUK + ' tik (' + (UFUK * 0.05).toFixed(0) + 'sn)' +
    '   halka ' + YARICAP + 'px x ' + YON + ' yon   kutle ' + KUTLE + ' birim');
console.log('  SORU: ayni hedef noktalari, TEK BIRIM vs KUTLE — yayilim degisiyor mu?');
console.log('  (Bu, docs/PLAN-GRUP-ARAMA.md\'nin dayandigi TEK iddia. Kucukse plan duser.)');
console.log('');

const hepsi = [];
for (let i = 0; i < MAC; i++) {
    const r = kos(TOHUM0 + i);
    hepsi.push(...r);
    console.log('  tohum ' + (TOHUM0 + i) + '  olcum ' + r.length);
}

function ozet(kip) {
    const a = hepsi.filter((x) => x.kip === kip);
    if (!a.length) return null;
    const y = a.map((x) => x.yayilim);
    const ort = y.reduce((p, q) => p + q, 0) / y.length;
    const srt = [...y].sort((p, q) => p - q);
    const med = srt[Math.floor(srt.length / 2)];
    const sifir = y.filter((v) => Math.abs(v) < 1).length;
    const kazanc = a.map((x) => x.enIyi - x.kal);
    const kOrt = kazanc.reduce((p, q) => p + q, 0) / kazanc.length;
    const kStd = kazanc.length > 1
        ? Math.sqrt(kazanc.reduce((p, q) => p + (q - kOrt) * (q - kOrt), 0) / (kazanc.length - 1)) : 0;
    return { n: a.length, ort: ort, med: med, sifirPay: 100 * sifir / y.length,
        kazanc: kOrt, kazancT: kStd ? kOrt / (kStd / Math.sqrt(kazanc.length)) : 0 };
}

const B = ozet('birey'), K = ozet('kutle'), G = ozet('grup');
console.log('');
console.log('  ' + 'kip'.padEnd(10) + 'olcum'.padStart(7) + 'ort yayilim'.padStart(14) +
    'medyan'.padStart(10) + 'sifir yayilim'.padStart(15) + 'en iyi - kal'.padStart(14) + 't'.padStart(8));
console.log('  ' + '-'.repeat(78));
for (const [ad, o] of [['BIREY', B], ['KUTLE', K], ['GRUP', G]]) {
    if (!o) { console.log('  ' + ad.padEnd(10) + 'veri yok'); continue; }
    console.log('  ' + ad.padEnd(10) + String(o.n).padStart(7) + o.ort.toFixed(0).padStart(14) +
        o.med.toFixed(0).padStart(10) + (o.sifirPay.toFixed(1) + '%').padStart(15) +
        o.kazanc.toFixed(0).padStart(14) + o.kazancT.toFixed(2).padStart(8));
}
console.log('');
if (B && K) {
    const kat = B.ort > 0 ? K.ort / B.ort : Infinity;
    console.log('  ── HUKUM ──');
    console.log('     yayilim orani (kutle / birey): ' + (kat === Infinity ? '∞' : kat.toFixed(2)) + 'x');
    console.log('     sifir-yayilim: %' + B.sifirPay.toFixed(1) + ' -> %' + K.sifirPay.toFixed(1));
    if (G) {
        const gk = B.ort > 0 ? G.ort / B.ort : Infinity;
        console.log('     GERCEK GRUP (taskContracts + sektor hedefleri):');
        console.log('        yayilim ' + G.ort.toFixed(0) + ' (' + (gk === Infinity ? '∞' : gk.toFixed(2)) + 'x)   sifir %' + G.sifirPay.toFixed(1) +
            '   en iyi-kal ' + G.kazanc.toFixed(0) + ' (t ' + G.kazancT.toFixed(2) + ')');
    }
    if (kat >= 2.0 && K.sifirPay < B.sifirPay) {
        console.log('     ✅ IDDIA AYAKTA — kutle adaylari belirgin daha cok fark yaratiyor.');
        console.log('        Grup aramasi insa edilmeye deger; sonraki adim gercek grup adaylari.');
    } else if (kat >= 1.3) {
        console.log('     ⚠ ZAYIF DESTEK — fark var ama kucuk. Insaat maliyeti bunu hak eder mi,');
        console.log('        ayri bir soru. Once daha cok tohumla tekrar.');
    } else {
        console.log('     ⛔ IDDIA DUSTU — kutleyi oynatmak tek birimi oynatmaktan daha cok fark');
        console.log('        yaratmiyor. docs/PLAN-GRUP-ARAMA.md bu sonuca gore GERI CEKILIR.');
    }
}
console.log('');
console.log('  OKUMA: "en iyi - kal" = en iyi aday, YERINDE KALMAYA gore ne kazandiriyor.');
console.log('  Yayilim buyuk ama bu kazanc sifirsa, secim onemli ama YON onemsiz demektir.');
if (hatalar && hatalar.length) console.log('  tezgah uyarilari: ' + hatalar.length);
