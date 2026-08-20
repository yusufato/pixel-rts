#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════════
   KARSI-BATARYA ZINCIRI — nerede kopuyor, ve karsi-plan onu kapatiyor mu

   TABAN OLCUMU (4 tohum / 142 ornek, karsi-plan KAPALI):
       mavi topcu GORUNUR          %66.9
       kirmizinin topcusu MENZILDE %35.9
       GOZCU kurali saglaniyor     %20.4
       fiilen HEDEFLENMIS          %0.0     <-- hic
       kirmizinin topcusu BOSTA    %44.3    (READY, hedefsiz)
       hedefe ort. mesafe          759px    (dusmanin topu 1516px'te)

   Yani standoff bir GORME sorunu DEGIL. Dusmanin topu goruluyor; bizim topcumuz erim
   disinda oturuyor ve zamanin yarisina yakininda bosta bekliyor. Bu, kullanicinin 4
   gercek macinda bulunmus kusurla ayni: "TOPCUx3 maci: 214 saniye TOPLAM 1 ATIS (%0)".

   ELEME MANTIGI (hangi halkada tikaniyoruz):
     gorunur=0            -> GORME sorunu (inanc kanali gerekli)
     gorunur>0 & menzil=0 -> MENZIL sorunu (yaklasmak gerekli)   <-- taban burada
     menzil>0 & gozcu=0   -> GOZCU KURALI
     gozcu>0 & kilitli=0  -> HEDEF ONCELIGI                       <-- taban burada da

   ⚠ ORTAK-KOVA NORMALIZASYONU (13. tuzak, 2026-08-20 iki kez yasandi)
   Karsi-plan macin SURESINI degistiriyor. Once acik kol tam sureye gitti (180 ornek vs
   79) ve oranlar sahte dustu; sabit pencere koyunca bu sefer KAPALI kol pencereden ONCE
   bitti (41 ornek). Iki kolun paydasi hicbir sabit pencerede esitlenmiyor.
   COZUM: ornekler 300-tiklik KOVALARA yazilir; ozet yalnizca IKI KOLUN DA ornek verdigi
   kovalari toplar. Boylece karsilastirma birebir ayni zaman araliginda yapilir.
   Sonuc metrikleri (olen dusman topcusu, marj, sure) yine TAM mactan alinir — onlarin
   dogru paydasi macin kendisidir. Ve sure farkinin kendisi bir BULGUDUR, gizlenmez.
   ═══════════════════════════════════════════════════════════════════════════════ */
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('node:fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const MAC = Math.max(1, Number(arg('--mac', 4)) || 4);
const TOHUM0 = Number(arg('--tohum0', 145000)) || 145000;
const KAPSAM = arg('--kapsam', 'topcu');
const KOVA = 300;              // tik/kova — 15sn
const NKOVA = 24;              // 24 x 300 = 7200 tik (tam mac)
const TEK = process.argv.includes('--taban');

const { ctx } = tezgahKur();
const taban = JSON.parse(fs.readFileSync('qa-runtime/gercekci-taban.json', 'utf8'));
const TARIF = Object.assign({}, taban, {
    ad: 'STANDOFF',
    zorunlu: Object.assign({}, taban.zorunlu, { artillery: 2, mortar_team: 3, mlrs: 1 })
});

function kos(seed, karsiPlan) {
    const kod = '(() => {\n' +
'  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;\n' +
'  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;\n' +
'  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;\n' +
'  BATTLE_INTEL4_DELTAS.profile = true;              /* HER IKI KOLDA acik */\n' +
'  BATTLE_KARSI_PLAN = ' + (karsiPlan ? 'true' : 'false') + ';\n' +
'  BATTLE_KARSI_PLAN_KAPSAM = "' + KAPSAM + '";\n' +
'  BATTLE_KP_TELEMETRI = { sorgu:0, aktif:0, mevzi:0 };\n' +
'  BATTLE_RECIPE_BLUE = ' + JSON.stringify(TARIF) + ';\n' +
'  BATTLE_RECIPE_RED = null;\n' +
'  openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true,\n' +
'    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });\n' +
'  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;\n' +
'  battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true,\n' +
'    varied:true, brainIntel4:true, isAttacker:false, recipe: BATTLE_RECIPE_BLUE }), false,\n' +
'    { source:"te", ally:true });\n' +
'  startBattle(); SIM.headless = true;\n' +
'  BATTLE_LOOKAHEAD_RED = false; BATTLE_LOOKAHEAD_BLUE = false;\n' +
'  let kirmizi = null;\n' +
'  for (const c of BATTLE_CONTROLLERS.values()) if (c && c.side === true) kirmizi = c;\n' +
'\n' +
'  let maviDolayliBas = 0;\n' +
'  for (const u of SIM.units) if (!u.isRed && u.isIndirect) maviDolayliBas++;\n' +
'\n' +
'  const N = ' + NKOVA + ', K = ' + KOVA + ';\n' +
'  const mk = () => { const a = []; for (let i = 0; i < N; i++) a.push(0); return a; };\n' +
'  const orn = mk(), gorunur = mk(), menzilde = mk(), gozcu = mk(), kilitli = mk();\n' +
'  const birimOrn = mk(), bosta = mk();\n' +
'  let st = 0, enYakinTop = 0, enYakinN = 0, hedefMes = 0, hedefN = 0;\n' +
'\n' +
'  while (phase === PHASE.BATTLE && SIM.tick < 7200) {\n' +
'    if (SIM.battle && SIM.battle.winnerSide !== null) break;\n' +
'    st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);\n' +
'    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);\n' +
'    if (SIM.tick % 40 !== 0) continue;\n' +
'    const b = Math.floor(SIM.tick / K);\n' +
'    if (b < 0 || b >= N) continue;\n' +
'\n' +
'    const maviTop = [];\n' +
'    for (const u of SIM.units) {\n' +
'      if (u.dead || u.abandoned || u.loaded || u.isRed || !u.isIndirect) continue;\n' +
'      maviTop.push(u);\n' +
'    }\n' +
'    if (!maviTop.length) continue;\n' +
'    orn[b]++;\n' +
'\n' +
'    /* 1) GORUNUR MU — kirmizinin temas listesi */\n' +
'    const temas = (kirmizi.lastObservation && kirmizi.lastObservation.contacts) || [];\n' +
'    const gorunenId = {};\n' +
'    for (const c of temas) if (c.visible === true) gorunenId[c.id] = 1;\n' +
'    for (const u of maviTop) if (gorunenId[u.id]) { gorunur[b]++; break; }\n' +
'\n' +
'    /* 2) MENZILDE · 3) GOZCU · 4) KILITLI · 5) BOSTA */\n' +
'    let mVar = false, goVar = false, kVar = false;\n' +
'    let yakin = 1e9;\n' +
'    for (const r of SIM.units) {\n' +
'      if (r.dead || r.abandoned || r.loaded || !r.isRed || !r.isIndirect) continue;\n' +
'      birimOrn[b]++;\n' +
'      if (!r.attackTarget) bosta[b]++;\n' +
'      else { hedefMes += Math.hypot(r.attackTarget.x - r.x, r.attackTarget.y - r.y); hedefN++; }\n' +
'      for (const u of maviTop) {\n' +
'        const d = Math.hypot(u.x - r.x, u.y - r.y);\n' +
'        if (d < yakin) yakin = d;\n' +
'        if (d <= (r.range || 0)) {\n' +
'          mVar = true;\n' +
'          if (typeof artilleryHasSight === "function" && artilleryHasSight(r, u)) goVar = true;\n' +
'        }\n' +
'      }\n' +
'      if (r.attackTarget && !r.attackTarget.isRed && r.attackTarget.isIndirect) kVar = true;\n' +
'    }\n' +
'    if (mVar) menzilde[b]++;\n' +
'    if (goVar) gozcu[b]++;\n' +
'    if (kVar) kilitli[b]++;\n' +
'    if (yakin < 1e9) { enYakinTop += yakin; enYakinN++; }\n' +
'  }\n' +
'\n' +
'  let maviDolayliOlu = 0;\n' +
'  for (const u of SIM.units) if (!u.isRed && u.isIndirect && (u.dead || u.abandoned)) maviDolayliOlu++;\n' +
'  let kD = 0, mD = 0;\n' +
'  for (const u of SIM.units) {\n' +
'    if (u.dead || u.abandoned) continue;\n' +
'    const c = (STATS[u.type] && STATS[u.type].cost) || 0;\n' +
'    if (u.isRed) kD += c; else mD += c;\n' +
'  }\n' +
'  return JSON.stringify({ orn: orn, gorunur: gorunur, menzilde: menzilde, gozcu: gozcu,\n' +
'    kilitli: kilitli, birimOrn: birimOrn, bosta: bosta,\n' +
'    hedefMes: hedefN ? hedefMes / hedefN : null,\n' +
'    enYakin: enYakinN ? enYakinTop / enYakinN : null,\n' +
'    maviDolayliBas: maviDolayliBas, maviDolayliOlu: maviDolayliOlu,\n' +
'    mevzi: (BATTLE_KP_TELEMETRI && BATTLE_KP_TELEMETRI.mevzi) | 0,\n' +
'    marj: kD - mD, sure: Math.round(SIM.tick * 0.05) });\n' +
'})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'te-' + seed + '-' + karsiPlan + '.js' }));
}

/* ─── ortak kova secimi ────────────────────────────────────────────────────────
   Yalniz IKI KOLUN DA ornek verdigi kovalar sayilir → payda birebir esitlenir. */
function ortakTopla(k, a) {
    const T = { orn: 0, gorunur: 0, menzilde: 0, gozcu: 0, kilitli: 0, birimOrn: 0, bosta: 0, kova: 0 };
    const A = { orn: 0, gorunur: 0, menzilde: 0, gozcu: 0, kilitli: 0, birimOrn: 0, bosta: 0, kova: 0 };
    for (let b = 0; b < NKOVA; b++) {
        if (!k.orn[b] || (a && !a.orn[b])) continue;
        for (const f of ['orn', 'gorunur', 'menzilde', 'gozcu', 'kilitli', 'birimOrn', 'bosta']) {
            T[f] += k[f][b];
            if (a) A[f] += a[f][b];
        }
        T.kova++; A.kova++;
    }
    return { k: T, a: a ? A : null };
}

const p = (x, n) => n ? (100 * x / n).toFixed(0).padStart(3) + '%' : '  —';
console.log('');
console.log('KARSI-BATARYA ZINCIRI   ' + MAC + ' tohum' + (TEK ? '   (yalniz taban)' : ' x 2 kol   kapsam=' + KAPSAM));
console.log('  oran metrikleri ORTAK KOVALARDA (300 tik = 15sn); sonuc metrikleri tam mactan');
console.log('  rakip: maviye dolayli ates zorlanmis (artillery 2 / mortar 3 / mlrs 1)');
console.log('');

const G = { k: { orn: 0, gorunur: 0, menzilde: 0, gozcu: 0, kilitli: 0, birimOrn: 0, bosta: 0 },
            a: { orn: 0, gorunur: 0, menzilde: 0, gozcu: 0, kilitli: 0, birimOrn: 0, bosta: 0 } };
let kOlu = 0, aOlu = 0, kBas = 0, aBas = 0, kSure = 0, aSure = 0, kMarj = 0, aMarj = 0;
let kYakin = 0, aYakin = 0, yN = 0, mevziTop = 0, n = 0;

for (let i = 0; i < MAC; i++) {
    const seed = TOHUM0 + i;
    const k = kos(seed, false);
    const a = TEK ? null : kos(seed, true);
    const o = ortakTopla(k, a);
    n++;
    for (const f of Object.keys(G.k)) { G.k[f] += o.k[f]; if (o.a) G.a[f] += o.a[f]; }
    kOlu += k.maviDolayliOlu; kBas += k.maviDolayliBas; kSure += k.sure; kMarj += k.marj;
    if (k.enYakin != null) { kYakin += k.enYakin; yN++; }
    if (a) {
        aOlu += a.maviDolayliOlu; aBas += a.maviDolayliBas; aSure += a.sure; aMarj += a.marj;
        if (a.enYakin != null) aYakin += a.enYakin;
        mevziTop += a.mevzi;
    }
    const sat = (r, T, et, ek) => '  ' + seed + ' ' + et.padEnd(7) +
        ' kova ' + String(o.k.kova).padStart(2) +
        '  gorunur ' + p(T.gorunur, T.orn) + '  menzil ' + p(T.menzilde, T.orn) +
        '  gozcu ' + p(T.gozcu, T.orn) + '  KILITLI ' + p(T.kilitli, T.orn) +
        '  bosta ' + p(T.bosta, T.birimOrn) +
        '  dolayliOlu ' + r.maviDolayliOlu + '/' + r.maviDolayliBas +
        '  sure ' + String(r.sure).padStart(3) + 'sn' + (ek || '');
    console.log(sat(k, o.k, 'KAPALI'));
    if (a) console.log(sat(a, o.a, 'ACIK', '  mevzi ' + a.mevzi));
}

function yaz(ad, T, olu, bas, sure, marj, yakin, ek) {
    console.log('  ' + ad);
    console.log('    GORUNUR ' + p(T.gorunur, T.orn) + '    MENZILDE ' + p(T.menzilde, T.orn) +
        '    GOZCU ' + p(T.gozcu, T.orn) + '    KILITLI ' + p(T.kilitli, T.orn) +
        '    topcu BOSTA ' + p(T.bosta, T.birimOrn));
    console.log('    olen dusman topcusu ' + olu + '/' + bas +
        '    ort. sure ' + Math.round(sure / n) + 'sn' +
        '    ort. marj ' + Math.round(marj / n) + ' TL' +
        '    en yakin dusman topu ' + (yN ? Math.round(yakin / yN) : '—') + 'px' + (ek || ''));
}

console.log('');
yaz('KAPALI  (' + G.k.orn + ' ortak ornek)', G.k, kOlu, kBas, kSure, kMarj, kYakin);
if (!TEK) {
    console.log('');
    yaz('ACIK    (' + G.a.orn + ' ortak ornek)', G.a, aOlu, aBas, aSure, aMarj, aYakin,
        '    mevzi emri ' + mevziTop);
    const d = (x, y, n1, n2) => {
        const f = (n2 ? 100 * y / n2 : 0) - (n1 ? 100 * x / n1 : 0);
        return ((f >= 0 ? '+' : '') + f.toFixed(1) + ' puan').padStart(12);
    };
    console.log('');
    console.log('  FARK (acik - kapali)');
    console.log('    menzilde ' + d(G.k.menzilde, G.a.menzilde, G.k.orn, G.a.orn) +
        '    gozcu ' + d(G.k.gozcu, G.a.gozcu, G.k.orn, G.a.orn) +
        '    KILITLI ' + d(G.k.kilitli, G.a.kilitli, G.k.orn, G.a.orn));
    console.log('    bosta    ' + d(G.k.bosta, G.a.bosta, G.k.birimOrn, G.a.birimOrn) +
        '    olen dusman topcusu ' + ((aOlu - kOlu >= 0 ? '+' : '') + (aOlu - kOlu)).padStart(6) +
        '    sure ' + ((aSure - kSure >= 0 ? '+' : '') + Math.round((aSure - kSure) / n) + 'sn').padStart(8) +
        '    marj ' + ((aMarj - kMarj >= 0 ? '+' : '') + Math.round((aMarj - kMarj) / n) + ' TL').padStart(10));
    console.log('');
    if (!mevziTop) console.log('  ⛔ MEVZI EMRI HIC URETILMEDI — kanca bagli degil.');
    else if (!G.a.kilitli) console.log('  ⛔ KILITLI HALA %0 — sonraki halka HEDEF ONCELIGI (scoreTarget).');
    else console.log('  ✅ KILITLI %0 olmaktan cikti — zincir bir halka ilerledi.');
    console.log('  ⚠ marj n=' + n + "'de KARAR DEGIL (marj std 2600-3800). Sure farki ise gercek bir bulgudur.");
}
console.log('');
console.log('  ELEME: gorunur=0 -> GORME · gorunur>0 & menzil=0 -> MENZIL');
console.log('         menzil>0 & gozcu=0 -> GOZCU KURALI · gozcu>0 & kilitli=0 -> HEDEF ONCELIGI');
