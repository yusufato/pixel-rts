#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════════
   YONLU ZIRH TRIYAJI — pro 'armorFace' ONGORU'de ise yariyor mu

   Kuralin kayitli teshisi: yonlu-zirhli birimlerin maruziyeti
       ON %63 · YAN %27 · ARKA %10   -> %37'si zirhin ZAYIF tarafindan
       savunan MBT en kotusu: %42 / %56 / %1
   Sebep: facingAngle once HAREKET yonune, sonra ATIS HEDEFINE kuruluyor. Ikisi de
   "beni kim vuruyor" sorusunu sormuyor: A'ya ates ederken B yandan vuruyor.
   Kural burnu, seni VURABILEN dusmanlarin hasar-agirlikli merkezine dondurur.

   NEDEN BU ADAY: kuralin kendi notu "BEDAVA BECERI: yalniz yon degisir, birim yerinden
   oynamaz" diyor. Bugun indirectCreep'i eleyen tuzak (one cik -> ol) buna yapisal olarak
   islemez. Yine de 15. tuzak geregi HAYATTA KALMA ayrica raporlanir.

   OLCU: SIM.pendingHits kuyrugu, hasar hesaplanirken isRear/isFlank damgasi tasiyor.
   Her tik yeni giren kayitlar (seq ile) taranir; hedefi KIRMIZI ve yonlu-zirhli olanlar
   sayilir. Kural calisiyorsa ARKA+YAN payi DUSMELI.

   ⚠ Oran metrigi "alinan vurus" paydasinda. Tedavi vurus sayisini degistirirse payda
   kayar (13. tuzak) — o yuzden ham vurus sayisi da yazilir.
   ═══════════════════════════════════════════════════════════════════════════════ */
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('node:fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const MAC = Math.max(1, Number(arg('--mac', 6)) || 6);
const TOHUM0 = Number(arg('--tohum0', 151000)) || 151000;

const { ctx } = tezgahKur();
const taban = JSON.parse(fs.readFileSync('qa-runtime/gercekci-taban.json', 'utf8'));

function kos(seed, zirh) {
    const kod = '(() => {\n' +
'  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;\n' +
'  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;\n' +
'  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;\n' +
'  BATTLE_ZIRH_YONU_INTEL4 = ' + (zirh ? 'true' : 'false') + ';\n' +
'  BATTLE_RECIPE_BLUE = ' + JSON.stringify(taban) + ';\n' +
'  BATTLE_RECIPE_RED = null;\n' +
'  openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true,\n' +
'    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });\n' +
'  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;\n' +
'  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true,\n' +
'    varied:true, brainIntel4:true, isAttacker:false, recipe: BATTLE_RECIPE_BLUE }), false,\n' +
'    { source:"zy", ally:true });\n' +
'  startBattle(); SIM.headless = true;\n' +
'  BATTLE_LOOKAHEAD_RED = false; BATTLE_LOOKAHEAD_BLUE = false;\n' +
'\n' +
'  /* yonlu-zirhli KIRMIZI birimlerin kimlikleri (baslangicta sabit) */\n' +
'  const yonlu = {};\n' +
'  let yonluBas = 0, yonluDeger = 0;\n' +
'  for (const u of SIM.units) {\n' +
'    if (!u.isRed) continue;\n' +
'    const s = STATS[u.type];\n' +
'    if (!s || !s.armorFacing) continue;\n' +
'    yonlu[u.id] = 1; yonluBas++;\n' +
'    yonluDeger += s.cost || 0;\n' +
'  }\n' +
'\n' +
'  let st = 0, sonSeq = -1;\n' +
'  let vurus = 0, arka = 0, yan = 0, hasarTop = 0;\n' +
'  while (phase === PHASE.BATTLE && SIM.tick < 7200) {\n' +
'    if (SIM.battle && SIM.battle.winnerSide !== null) break;\n' +
'    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);\n' +
'    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);\n' +
'    /* Kuyrukta HER TIK yeni giren kayitlari tara. Kayit varis-tikinde tuketiliyor,\n' +
'       o yuzden ornekleme seyrek olamaz; seq ile tekrar sayim engellenir. */\n' +
'    const q = SIM.pendingHits || [];\n' +
'    for (let i = 0; i < q.length; i++) {\n' +
'      const h = q[i];\n' +
'      if (h.seq <= sonSeq) continue;\n' +
'      if (h.seq > sonSeq) sonSeq = h.seq;\n' +
'      if (h.kind !== "direct") continue;          /* yon yalniz dogrudan atesde anlamli */\n' +
'      if (!yonlu[h.tgtId]) continue;              /* hedef yonlu-zirhli kirmizi degil */\n' +
'      vurus++; hasarTop += (h.dmg || 0);\n' +
'      if (h.isRear) arka++; else if (h.isFlank) yan++;\n' +
'    }\n' +
'  }\n' +
'\n' +
'  let yonluSag = 0, kD = 0, mD = 0;\n' +
'  for (const u of SIM.units) {\n' +
'    if (u.dead || u.abandoned) continue;\n' +
'    if (u.isRed && yonlu[u.id]) yonluSag++;\n' +
'    const c = (STATS[u.type] && STATS[u.type].cost) || 0;\n' +
'    if (u.isRed) kD += c; else mD += c;\n' +
'  }\n' +
'  return JSON.stringify({ yonluBas: yonluBas, yonluSag: yonluSag,\n' +
'    vurus: vurus, arka: arka, yan: yan, hasar: hasarTop,\n' +
'    marj: kD - mD, sure: Math.round(SIM.tick * 0.05) });\n' +
'})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'zy-' + seed + '-' + zirh + '.js' }));
}

const yuz = (x, n) => n ? (100 * x / n).toFixed(1) + '%' : '—';
console.log('');
console.log('YONLU ZIRH TRIYAJI   ' + MAC + ' tohum x 2 kol   (BATTLE_ZIRH_YONU_INTEL4)');
console.log('  olcu: kirmizinin yonlu-zirhli birimlerine gelen DOGRUDAN vuruslarin yon dagilimi');
console.log('');

const cift = [];
for (let i = 0; i < MAC; i++) {
    const seed = TOHUM0 + i;
    const k = kos(seed, false);
    const a = kos(seed, true);
    cift.push({ seed: seed, k: k, a: a });
    const zayif = (r) => r.vurus ? (100 * (r.arka + r.yan) / r.vurus) : null;
    const f = (x) => x == null ? '  — ' : x.toFixed(1).padStart(5) + '%';
    console.log('  tohum ' + seed +
        '   zayif-taraf ' + f(zayif(k)) + ' -> ' + f(zayif(a)) +
        '   (arka ' + k.arka + '/' + a.arka + ' · yan ' + k.yan + '/' + a.yan + ')' +
        '   vurus ' + k.vurus + '/' + a.vurus +
        '   sagZirhli ' + k.yonluSag + '/' + k.yonluBas + ' -> ' + a.yonluSag + '/' + a.yonluBas +
        '   sure ' + k.sure + '/' + a.sure + 'sn');
}

function ozet(ad, sec, birim, basamak, yon) {
    const d = cift.map((c) => (sec(c.a) == null || sec(c.k) == null) ? null : sec(c.a) - sec(c.k))
        .filter((x) => x != null);
    if (!d.length) { console.log('  ' + ad.padEnd(14) + ' veri yok'); return; }
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

const T = (sec) => cift.reduce((a, c) => a + sec(c), 0);
const vK = T((c) => c.k.vurus), vA = T((c) => c.a.vurus);
const zK = T((c) => c.k.arka + c.k.yan), zA = T((c) => c.a.arka + c.a.yan);
const sagK = T((c) => c.k.yonluSag), sagA = T((c) => c.a.yonluSag), basT = T((c) => c.k.yonluBas);
console.log('');
console.log('  TOPLAM   kapali: vurus ' + vK + '  zayif-taraf ' + zK + ' (' + yuz(zK, vK) + ')' +
    '   ·   acik: vurus ' + vA + '  zayif-taraf ' + zA + ' (' + yuz(zA, vA) + ')');
console.log('  ⚑ HAYATTA KALMA: sag yonlu-zirhli  kapali ' + sagK + '/' + basT + '  ·  acik ' + sagA + '/' + basT);
console.log('');
console.log('  ESLESTIRILMIS FARK (acik - kapali),  n = ' + cift.length);
console.log('  ' + '-'.repeat(78));
ozet('zayifPay', (r) => r.vurus ? 100 * (r.arka + r.yan) / r.vurus : null, '%', 1, -1);   // DUSMELI
ozet('arkaPay', (r) => r.vurus ? 100 * r.arka / r.vurus : null, '%', 1, -1);              // DUSMELI
ozet('alinanHasar', (r) => r.hasar, 'HP', 0, -1);                                        // DUSMELI
ozet('sagZirhli', (r) => r.yonluSag, 'birim', 2, +1);                                    // ARTMALI
ozet('marj', (r) => r.marj, 'TL', 0, 0);                                                 // KARAR DEGIL
console.log('');
console.log('  OKUMA: zayifPay kuralin KENDI hedefledigi metrik. Kimildamiyorsa kural');
console.log('  ONGORU\'de calismiyor demektir; mac kapisina girmesin. marj KARAR DEGIL.');
