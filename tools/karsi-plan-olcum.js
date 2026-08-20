#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════════
   KARSI-PLAN MEKANIZMA OLCUMU — zincirin IKINCI halkasi

   Birinci halka (tespit) gecti: tools/taktik-tespit-olcum.js, 6 tohum ->
       STANDOFF %75.9 tespit · KONTROL %0.0 yanlis alarm · ilk tespit tik 120 (6sn).

   Bu arac tespitin ARDINDAN gelen TEPKIYI olcer. Soru "maci kim kazandi" DEGIL (o
   gurultu; marj std 2600-3800, n=6'da saptama tabani ~3000). Soru su: karsi-plan
   acikken AI'nin DAVRANISI hedeflenen yonde degisiyor mu?

   Iki kol AYNI tohumda, AYNI rakip tarifiyle (maviye dolayli ates zorlanmis) kosar;
   tek fark BATTLE_KARSI_PLAN. Inanc katmani (profile) HER IKI KOLDA da aciktir —
   yoksa olculen sey karsi-plan degil "inanc katmanini acmak" olurdu.

   MEKANIZMA METRIKLERI (gurultusuz olmasi beklenenler):
     mesafe    : kirmizinin silahli kutlesinin CIKARILMIS kaynak konumuna ort. uzakligi,
                 yalniz tespit AKTIFKEN orneklenir. Karsi-plan calisiyorsa DUSMELI.
     bastirma  : kirmizinin bastirilmis birim orani. Kapatma isliyorsa DUSMELI.
     dolayliOlu: mavinin olen dolayli-ates birimi sayisi. "Topcuyu bul ve bas" bunun
                 ARTMASI demektir — plani en dogrudan sinayan olcu.
     tetikTik  : karsi-planin ilk tetiklendigi tik (yalniz acik kolda anlamli).

   ⚠ MAC MARJI da yazilir ama KARAR ICIN DEGILDIR — n bu is icin cok kucuk.
   ═══════════════════════════════════════════════════════════════════════════════ */
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('node:fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const MAC = Math.max(1, Number(arg('--mac', 6)) || 6);
const TOHUM0 = Number(arg('--tohum0', 143000)) || 143000;
const ORNEK = Math.max(5, Number(arg('--ornek', 40)) || 40);
const ARAMA = process.argv.includes('--arama');   // ileri-bakis acik kosmak (yavas ama gercekci)
/* Baskini hangi gruplar yapsin ('flank' / 'mainflank').
   ⚠ ARA IDDIA GERI CEKILDI: once "'flank' olu, FLANK grubu bos" demistim — YANLIS.
   Sektor-komuta acikken FLANK payi %15 ve dal gercekten cagriliyor (cagri 87/58).
   Az emir cikmasinin sebebi shouldRefresh bogazi idi (dal 274 cagri / 265 bogaz / 9 emir);
   duzeltildikten sonra 'flank' da 9-14 emir uretiyor. */
const KAPSAM = arg('--kapsam', 'flank');
const SURE = Math.max(0, Number(arg('--sure', 0)) || 0);   // taahhut kilidi (tik); 0 = kilit yok

const { ctx, hatalar } = tezgahKur();

const taban = JSON.parse(fs.readFileSync('qa-runtime/gercekci-taban.json', 'utf8'));
const TARIF_STANDOFF = Object.assign({}, taban, {
    ad: 'STANDOFF',
    zorunlu: Object.assign({}, taban.zorunlu, { artillery: 2, mortar_team: 3, mlrs: 1 })
});

function kos(seed, karsiPlan) {
    const kod = '(() => {\n' +
'  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;\n' +
'  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;\n' +
'  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;\n' +
'  BATTLE_INTEL4_DELTAS.profile = true;             /* HER IKI KOLDA acik (bkz. baslik) */\n' +
'  BATTLE_KARSI_PLAN = ' + (karsiPlan ? 'true' : 'false') + ';\n' +
'  BATTLE_KARSI_PLAN_KAPSAM = "' + KAPSAM + '";\n' +
'  BATTLE_KARSI_PLAN_SURE = ' + SURE + ';\n' +
'  BATTLE_KP_TELEMETRI = { sorgu:0, aktif:0, nisan:0, baskin:0, kilitli:0 };\n' +
'  BATTLE_RECIPE_BLUE = ' + JSON.stringify(TARIF_STANDOFF) + ';\n' +
'  BATTLE_RECIPE_RED = null;\n' +
'  openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true,\n' +
'    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });\n' +
'  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;\n' +
'  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true,\n' +
'    varied:true, brainIntel4:true, isAttacker:false, recipe: BATTLE_RECIPE_BLUE }), false,\n' +
'    { source:"kp", ally:true });\n' +
'  startBattle(); SIM.headless = true;\n' +
'  BATTLE_LOOKAHEAD_RED = ' + (ARAMA ? 'true' : 'false') + '; BATTLE_LOOKAHEAD_BLUE = false;\n' +
'\n' +
'  let kirmizi = null;\n' +
'  if (typeof BATTLE_CONTROLLERS !== "undefined") {\n' +
'    for (const c of BATTLE_CONTROLLERS.values()) if (c && c.side === true) kirmizi = c;\n' +
'  }\n' +
'  if (!kirmizi) return JSON.stringify({ hata: "kirmizi kontrolor bulunamadi" });\n' +
'\n' +
'  let maviDolayliBas = 0;\n' +
'  for (const u of SIM.units) if (!u.isRed && u.isIndirect) maviDolayliBas++;\n' +
'\n' +
'  let st = 0, orn = 0, tespit = 0;\n' +
'  let mesafeTop = 0, mesafeN = 0, basTop = 0, basN = 0;\n' +
'\n' +
'  while (phase === PHASE.BATTLE && SIM.tick < 7200) {\n' +
'    if (SIM.battle && SIM.battle.winnerSide !== null) break;\n' +
'    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);\n' +
'    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);\n' +
     (ARAMA ? '    battleLookaheadTick(st);\n' : '') +
'    if (SIM.tick % ' + ORNEK + ' !== 0) continue;\n' +
'    orn++;\n' +
'    const t = battleTaktikTespit(kirmizi);\n' +
'    if (!(t && t.taktik === "STANDOFF_ATIS")) continue;\n' +
'    tespit++;\n' +
'    /* Tespit AKTIFKEN olcum: iki kol da ayni kosulda karsilastirilsin diye. Kapali\n' +
'       kolda da tespitci CALISIR (saf fonksiyon, davranisa dokunmaz) — kimse dinlemez. */\n' +
'    const kay = t.kanit.kaynak;\n' +
'    let dTop = 0, dN = 0, bas = 0, canli = 0;\n' +
'    for (const u of SIM.units) {\n' +
'      if (u.dead || u.loaded || u.abandoned || !u.isRed) continue;\n' +
'      const s = STATS[u.type];\n' +
'      if (!s || !s.weapons || !s.weapons.length) continue;\n' +
'      canli++;\n' +
'      if ((u.suppression || 0) > 0.3) bas++;\n' +
'      dTop += Math.hypot(kay.x - u.x, kay.y - u.y); dN++;\n' +
'    }\n' +
'    if (dN) { mesafeTop += dTop / dN; mesafeN++; }\n' +
'    if (canli) { basTop += bas / canli; basN++; }\n' +
'  }\n' +
'\n' +
'  let maviDolayliOlu = 0;\n' +
'  for (const u of SIM.units) if (!u.isRed && u.isIndirect && (u.dead || u.abandoned)) maviDolayliOlu++;\n' +
'\n' +
'  const cls = kirmizi.perception && kirmizi.perception._threatProfile && kirmizi.perception._threatProfile.classes;\n' +
'  const aa = cls && cls.areaAlpha;\n' +
'  const tetikli = !!(aa && aa.reactionsTriggered && aa.reactionsTriggered.indexOf("karsiPlanStandoff") >= 0);\n' +
'\n' +
'  let kirmiziDeger = 0, maviDeger = 0;\n' +
'  for (const u of SIM.units) {\n' +
'    if (u.dead || u.abandoned) continue;\n' +
'    const c = (STATS[u.type] && STATS[u.type].cost) || 0;\n' +
'    if (u.isRed) kirmiziDeger += c; else maviDeger += c;\n' +
'  }\n' +
'  return JSON.stringify({\n' +
'    orn: orn, tespit: tespit,\n' +
'    mesafe: mesafeN ? mesafeTop / mesafeN : null,\n' +
'    bastirma: basN ? basTop / basN : null,\n' +
'    maviDolayliBas: maviDolayliBas, maviDolayliOlu: maviDolayliOlu,\n' +
'    tetikli: tetikli,\n' +
'    tetikTik: (aa && aa._firstReactionTick != null) ? aa._firstReactionTick : null,\n' +
'    marj: kirmiziDeger - maviDeger,\n' +
'    baskin: (BATTLE_KP_TELEMETRI && BATTLE_KP_TELEMETRI.baskin) | 0,\n' +
'    sure: Math.round(SIM.tick * 0.05)\n' +
'  });\n' +
'})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'kp-' + seed + '-' + karsiPlan + '.js' }));
}

console.log('');
console.log('KARSI-PLAN MEKANIZMA OLCUMU   ' + MAC + ' tohum x 2 kol' +
    (ARAMA ? '   (ileri-bakis ACIK)' : '   (ileri-bakis kapali)') + '   kapsam=' + KAPSAM + '   taahhut=' + SURE + ' tik');
console.log('  rakip: maviye dolayli ates zorlanmis (artillery 2 / mortar 3 / mlrs 1)');
console.log('  inanc katmani her iki kolda ACIK; tek fark BATTLE_KARSI_PLAN');
console.log('');

const cift = [];
for (let i = 0; i < MAC; i++) {
    const seed = TOHUM0 + i;
    const kapali = kos(seed, false);
    const acik = kos(seed, true);
    if (kapali.hata || acik.hata) {
        console.log('  tohum ' + seed + '  HATA: ' + (kapali.hata || acik.hata));
        continue;
    }
    cift.push({ seed: seed, kapali: kapali, acik: acik });
    const f = (x) => x == null ? '  —  ' : String(Math.round(x)).padStart(5);
    const y = (x) => x == null ? ' — ' : (x * 100).toFixed(0).padStart(3);
    console.log('  tohum ' + seed +
        '   mesafe ' + f(kapali.mesafe) + ' -> ' + f(acik.mesafe) +
        '   bastirma ' + y(kapali.bastirma) + '% -> ' + y(acik.bastirma) + '%' +
        '   dolayliOlu ' + kapali.maviDolayliOlu + '/' + kapali.maviDolayliBas +
        ' -> ' + acik.maviDolayliOlu + '/' + acik.maviDolayliBas +
        '   tetik ' + (acik.tetikli ? ('tik ' + acik.tetikTik) : 'YOK') +
        '   baskinEmri ' + acik.baskin);
}

function ozet(ad, sec, birim, yon) {
    const d = cift
        .map((c) => (sec(c.acik) == null || sec(c.kapali) == null) ? null : sec(c.acik) - sec(c.kapali))
        .filter((x) => x != null);
    if (!d.length) { console.log('  ' + ad.padEnd(14) + ' veri yok'); return null; }
    const ort = d.reduce((a, b) => a + b, 0) / d.length;
    const std = d.length > 1
        ? Math.sqrt(d.reduce((a, b) => a + (b - ort) * (b - ort), 0) / (d.length - 1)) : 0;
    const t = std > 0 ? ort / (std / Math.sqrt(d.length)) : 0;
    const iyi = yon > 0 ? ort > 0 : ort < 0;
    console.log('  ' + ad.padEnd(14) + (ort >= 0 ? '+' : '') + ort.toFixed(2).padStart(9) + ' ' + birim.padEnd(6) +
        '  std ' + std.toFixed(2).padStart(8) + '   t ' + t.toFixed(2).padStart(6) +
        '   ' + (Math.abs(t) >= 2.0 ? (iyi ? 'YONU DOGRU, anlamli' : '⚠ TERS YON, anlamli') : 'anlamli degil'));
    return { ort: ort, std: std, t: t };
}

console.log('');
console.log('  ESLESTIRILMIS FARK (acik - kapali),  n = ' + cift.length);
console.log('  ' + '-'.repeat(76));
ozet('mesafe', (r) => r.mesafe, 'px', -1);                    // DUSMELI
ozet('bastirma', (r) => r.bastirma == null ? null : r.bastirma * 100, '%', -1);   // DUSMELI
ozet('dolayliOlu', (r) => r.maviDolayliOlu, 'birim', +1);     // ARTMALI
ozet('marj', (r) => r.marj, 'TL', +1);                        // bilgi amacli, KARAR DEGIL

const tetikSayi = cift.filter((c) => c.acik.tetikli).length;
const yanlisTetik = cift.filter((c) => c.kapali.tetikli).length;
console.log('');
console.log('  KANCA BAGLI MI: karsi-plan ' + tetikSayi + '/' + cift.length + ' macta tetiklendi (acik kol)');
console.log('                  kapali kolda tetiklenme: ' + yanlisTetik + '/' + cift.length + '  (0 olmali)');
if (!tetikSayi) {
    console.log('  ⛔ KANCA HIC TETIKLENMEDI — davranis olcumu anlamsiz, once baglantiyi duzelt.');
} else if (yanlisTetik) {
    console.log('  ⛔ KAPALI KOLDA TETIKLENDI — bayrak kapiyi tutmuyor.');
}
console.log('');
console.log('  OKUMA: marj KARAR DEGIL (n cok kucuk, marj std 2600-3800). Karar mekanizma');
console.log('  metriklerinde: mesafe dusuyor + dolayliOlu artiyorsa plan calisiyor demektir.');
if (hatalar && hatalar.length) console.log('  tezgah uyarilari: ' + hatalar.length);
