#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════════
   SOMURUCU KALIBRASYONU — bot gercekten INSANIN IMZASINI mi tekrarliyor?

   DEPONUN KENDI DISIPLINI (tools/somurucu-havuz.js basligi):
     "KALIBRASYON HEDEFI: somurucu, kullanicinin imzasini TAKLIT etmeli. E2 gercek
      %22'ye yakin degilse bot yeterince iyi degildir — once BOTU duzeltiriz, sonra
      AI'i olceriz."
   Yani AI'i olcmeden once BOTU olcmek gerekiyor. Kalibre olmayan bir bota karsi
   alinan sonuc, yanlis rakibe gore ayarlanmis olur.

   'yerel_ustunluk' BOTUNUN IMZASI (../docs/battle-ai/reports/INSAN-VS-AI-SALDIRI.md, kullanicinin 2 maci):
       VURULMA ANINDA cevresindeki 600px kesit
         insan : 8.9 dost / 1.2 dusman   (7.4 : 1)
         AI    : 6.9 dost / 3.4 dusman   (2.0 : 1)
   Bot bu orani tutturamiyorsa "insan gibi" oynamiyor demektir ve kapinin verdigi
   sonuc BOTUN kusurunu olcer, AI'in kusurunu degil.

   OLCUM NOKTASI: SIM.pendingHits kuyrugundaki bir kaydin VARIS tikinde (arriveTick),
   hedefin O ANDAKI yerel kesiti. Yani "vurulduğun anda etrafinda ne vardi" — kaynak
   olcumle ayni soru. (Fire-tick degil varis-tik: birim o arada yer degistirmis olabilir.)

   ⚠ Kesit KAFA sayar (kaynak olcum de oyle: "8.9 dost"). Deger-agirlikli degil.
   ⚠ Silahsiz birimler sayilmaz — dovuse girmiyorlar.
   ═══════════════════════════════════════════════════════════════════════════════ */
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('node:fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const MAC = Math.max(1, Number(arg('--mac', 4)) || 4);
const TOHUM0 = Number(arg('--tohum0', 162000)) || 162000;
const SOMURU = arg('--somuru', 'yerel_ustunluk');
const R = Math.max(100, Number(arg('--yaricap', 600)) || 600);
/* --oran : botun temas esigi (EXP_YU_ORAN). BOT KALIBRASYONU icin supurulur.
   ⚠ AMAC AI'I YENMEK DEGIL, insanin olculmus imzasini (7.4) tutturmak. Bu ayrim
   kritik: botu "AI'i yensin" diye ayarlayip sonra o botla AI'i olcmek DAIRESEL olur.
   Botun tek gorevi imzayi tekrarlamak; AI'i yenip yenmedigi AYRI bir sorudur. */
const ORAN = Number(arg('--oran', 0)) || 0;

const { ctx } = tezgahKur();
const taban = JSON.parse(fs.readFileSync('qa-runtime/gercekci-taban.json', 'utf8'));

function kos(seed, acik, aiSaldiran) {
    const kod = '(() => {\n' +
'  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;\n' +
'  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;\n' +
'  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;\n' +
'  BATTLE_EXPLOITER_RED = null;\n' +
'  BATTLE_EXPLOITER_BLUE = ' + (acik ? JSON.stringify(SOMURU) : 'null') + ';\n' +
     (ORAN ? ('  EXP_YU_ORAN = ' + ORAN + ';\n') : '') +
'  BATTLE_RECIPE_BLUE = ' + JSON.stringify(taban) + ';\n' +
'  BATTLE_RECIPE_RED = null;\n' +
'  openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ',\n' +
'    attackerSide:' + (aiSaldiran ? 'true' : 'false') + ',\n' +
'    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });\n' +
'  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;\n' +
'  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true,\n' +
'    varied:true, brainIntel4:true, isAttacker:' + (aiSaldiran ? 'false' : 'true') + ',\n' +
'    recipe: BATTLE_RECIPE_BLUE }), false, { source:"sklb", ally:true });\n' +
'  startBattle(); SIM.headless = true;\n' +
'  BATTLE_LOOKAHEAD_RED = false; BATTLE_LOOKAHEAD_BLUE = false;\n' +
'\n' +
'  /* VURULMA ANINDAKI YEREL KESIT — taraf basina */\n' +
'  const K = { kirmizi: { dost:0, dusman:0, n:0 }, mavi: { dost:0, dusman:0, n:0 } };\n' +
'  const R = ' + R + ';\n' +
'  function kesit(u) {\n' +
'    let dost = 0, dusman = 0;\n' +
'    const yakin = SIM.spatialGrid ? SIM.spatialGrid.getNearby(u.x, u.y, R) : SIM.units;\n' +
'    for (const o of yakin) {\n' +
'      if (o.dead || o.loaded || o.abandoned || o === u) continue;\n' +
'      const st = STATS[o.type];\n' +
'      if (!st || !st.weapons || !st.weapons.length) continue;\n' +
'      if (Math.hypot(o.x - u.x, o.y - u.y) > R) continue;\n' +
'      if (o.isRed === u.isRed) dost++; else dusman++;\n' +
'    }\n' +
'    return { dost: dost, dusman: dusman };\n' +
'  }\n' +
'  let st = 0;\n' +
'  while (phase === PHASE.BATTLE && SIM.tick < 7200) {\n' +
'    if (SIM.battle && SIM.battle.winnerSide !== null) break;\n' +
'    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);\n' +
'    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);\n' +
'    /* VARIS tikindeki kayitlar: hedefin O ANDAKI cevresi (kaynak olcumle ayni soru) */\n' +
'    const q = SIM.pendingHits || [];\n' +
'    for (let i = 0; i < q.length; i++) {\n' +
'      const h = q[i];\n' +
'      if (h.arriveTick !== SIM.tick) continue;\n' +
'      if (h.kind !== "direct") continue;\n' +
'      const t = (typeof battleUnitById === "function") ? battleUnitById(h.tgtId) : null;\n' +
'      if (!t || t.dead || t.abandoned) continue;\n' +
'      const stt = STATS[t.type];\n' +
'      if (!stt || !stt.weapons || !stt.weapons.length) continue;\n' +
'      const c = kesit(t);\n' +
'      const kova = t.isRed ? K.kirmizi : K.mavi;\n' +
'      kova.dost += c.dost; kova.dusman += c.dusman; kova.n++;\n' +
'    }\n' +
'  }\n' +
'  let kSag = 0, mSag = 0, kBas = 0, mBas = 0;\n' +
'  for (const u of SIM.units) {\n' +
'    const c = (STATS[u.type] && STATS[u.type].cost) || 0;\n' +
'    if (u.isRed) kBas += c; else mBas += c;\n' +
'    if (u.dead || u.abandoned) continue;\n' +
'    if (u.isRed) kSag += c; else mSag += c;\n' +
'  }\n' +
'  return JSON.stringify({ K: K, sagkalimAI: kBas ? kSag / kBas : 0, marj: kSag - mSag,\n' +
'    sure: Math.round(SIM.tick * 0.05) });\n' +
'})()';
    return JSON.parse(vm.runInContext(kod, ctx,
        { filename: 'sklb-' + seed + '-' + (acik ? 'acik' : 'kapali') + '.js' }));
}

console.log('');
console.log('SOMURUCU KALIBRASYONU   bot: ' + SOMURU + '   ' + MAC + ' tohum x 2 rol x 2 kol   R=' + R + 'px' + (ORAN ? ('   EXP_YU_ORAN=' + ORAN) : '   (varsayilan oran)'));
console.log('  soru: bot VURULDUGUNDA cevresinde kac dost / kac dusman var?');
console.log('  HEDEF (insan, olculmus): 8.9 dost / 1.2 dusman = 7.4:1');
console.log('  KIYAS  (AI,   olculmus): 6.9 dost / 3.4 dusman = 2.0:1');
console.log('');

const topla = () => ({ dost: 0, dusman: 0, n: 0 });
const T = { botKapali: topla(), botAcik: topla(), aiKapali: topla(), aiAcik: topla() };
let sagK = 0, sagA = 0, marjK = 0, marjA = 0, adet = 0;

for (let i = 0; i < MAC; i++) {
    for (const aiSaldiran of [true, false]) {
        const k = kos(TOHUM0 + i, false, aiSaldiran);
        const a = kos(TOHUM0 + i, true, aiSaldiran);
        // MAVI = somurucu tarafi, KIRMIZI = kod-AI
        for (const [hedef, kay] of [[T.botKapali, k.K.mavi], [T.botAcik, a.K.mavi],
            [T.aiKapali, k.K.kirmizi], [T.aiAcik, a.K.kirmizi]]) {
            hedef.dost += kay.dost; hedef.dusman += kay.dusman; hedef.n += kay.n;
        }
        sagK += k.sagkalimAI; sagA += a.sagkalimAI; marjK += k.marj; marjA += a.marj; adet++;
    }
}

function yaz(ad, t) {
    if (!t.n) { console.log('  ' + ad.padEnd(26) + 'veri yok'); return null; }
    const d = t.dost / t.n, e = t.dusman / t.n;
    const oran = e > 0 ? d / e : Infinity;
    console.log('  ' + ad.padEnd(26) + d.toFixed(2).padStart(6) + ' dost  ' +
        e.toFixed(2).padStart(6) + ' dusman   oran ' + (oran === Infinity ? '∞' : oran.toFixed(2)).padStart(6) +
        '   (vurulma ornegi ' + t.n + ')');
    return oran;
}

console.log('  ── VURULMA ANINDAKI YEREL KESIT ──');
const o1 = yaz('somurucu taraf, bot KAPALI', T.botKapali);
const o2 = yaz('somurucu taraf, bot ACIK', T.botAcik);
yaz('kod-AI, bot kapali', T.aiKapali);
yaz('kod-AI, bot acik', T.aiAcik);
console.log('');
console.log('  kod-AI sagkalim  ' + (100 * sagK / adet).toFixed(1) + '% -> ' + (100 * sagA / adet).toFixed(1) + '%' +
    '     kod-AI marj ' + Math.round(marjK / adet) + ' -> ' + Math.round(marjA / adet));
console.log('');

if (o1 != null && o2 != null) {
    console.log('  ── KALIBRASYON HUKMU ──');
    console.log('     bot orani ' + o1.toFixed(2) + ' -> ' + o2.toFixed(2) +
        '   (insan hedefi 7.4 · AI kiyasi 2.0)');
    if (o2 <= o1 + 0.15) {
        console.log('     ⛔ BOT ORANI YUKSELMIYOR — "yerel ustunlukte dovus" imzasini');
        console.log('        URETEMIYOR. Kapinin sonucu AI\'i degil BOTU olcer. ONCE BOT DUZELTILIR.');
    } else if (o2 < 4.0) {
        console.log('     ⚠ orani yukseltiyor ama insan seviyesinden UZAK (hedef 7.4).');
        console.log('        Kapi kullanilabilir ama "insan gibi" iddiasi HENUZ dogru degil.');
    } else {
        console.log('     ✅ bot insan imzasina yakin oran uretiyor — kapi bu bot icin mesru.');
    }
}
