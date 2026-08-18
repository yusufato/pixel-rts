'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  WORKER KAPISI — "aramayı başka bir iş parçacığında koşturmak AYNI sonucu verir mi?"
//
//  Tarayıcı Worker'ını yazmadan önce mimarinin doğruluğunu kanıtlar. İki ayrı iddia,
//  ikisi de ayrı ayrı ölçülür (biri geçip diğeri düşebilir):
//
//   1) EMİR EŞİTLİĞİ — fork tek başına YETERLİ bir mesaj mı?
//      İşçi yalnız fork'u alıp arayınca, ana iş parçacığının aynı anda üreteceği
//      emirlerin AYNISINI üretmeli. Üretmiyorsa fork eksiktir (bkz. mayın kusuru:
//      fork mayınları taşımıyordu ve bu aylarca görünmedi).
//
//   2) ÖNGÖRÜ EŞİTLİĞİ — işçi geleceği DOĞRU tahmin edebiliyor mu?
//      Worker'ın emri ~k tik sonra iner. Doğru tasarım: işçi dünyayı k tik KENDİ
//      ilerletip oradan arasın. Bu ancak işçinin k tik sonra ulaştığı durum, ana
//      iş parçacığının k tik sonra bulunduğu durumla BİREBİR aynıysa geçerlidir.
//      Kapı: iki tarafın k tik sonraki `battleStateHash()` değeri eşit olmalı.
//      (Oyuncu girdisi bu eşitliği bozar — AI-vs-AI'da bozmamalı.)
//
//  NEGATİF KONTROL: fork'tan mayınlar atılır → EMİR EŞİTLİĞİ düşmeli. Düşmüyorsa
//  kapı kördür (bu projede "yeşil ama kör test" birden çok kez yaşandı).
//
//    node tools/worker-kapisi.js [--tohum 740000] [--nokta 3] [--ileri 60]
// ═══════════════════════════════════════════════════════════════════════════
const path = require('node:path');
const vm = require('node:vm');
const { Worker } = require('node:worker_threads');
const { tezgahKur } = require('./muharebe-tezgah.js');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const SEED = Number(arg('--tohum', 740000)) || 740000;
const NOKTA = Math.max(1, Number(arg('--nokta', 3)) || 3);
const ILERI = Math.max(0, Number(arg('--ileri', 60)) || 0);
const ARA = Number(arg('--ara', 400)) || 400;

const { ctx, hatalar } = tezgahKur();
if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }

function calistir(kod, ad) { return vm.runInContext(kod, ctx, { filename: ad }); }

// ── ANA İŞ PARÇACIĞI: işçinin kurulumuyla BİREBİR aynı oturum ──
calistir(`(() => {
  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;
  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;
  openBattlefieldSession({ mode:"quick", mapId:-2, seed:${SEED}, attackerSide:true,
    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;
  const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,
    brainIntel4:true, isAttacker:false, pro:false });
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;
  battleDeployManifest(mv, false, { source:"wisci", ally:true });
  startBattle(); SIM.headless = true;
  BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false;
  globalThis.__emirler = [];
  const _e = battleLookaheadEmirVer;
  battleLookaheadEmirVer = function (uid, karar, kayit) {
    if (kayit) globalThis.__emirler.push({ uid: uid, x: karar.x, y: karar.y });
    return _e(uid, karar, kayit);
  };
  globalThis.__st = 0;
  return 'ok';
})()`, 'wk-kur.js');

const isci = new Worker(path.join(__dirname, 'worker-arama-isci.js'), { workerData: { seed: SEED } });
const bekle = () => new Promise((c, r) => {
    isci.once('message', (m) => (m.tip === 'hata' ? r(new Error(m.mesaj)) : c(m)));
});

(async () => {
    console.log('WORKER KAPISI — tohum ' + SEED + ', ' + NOKTA + ' nokta, ongoru ' + ILERI + ' tik');
    console.log('');
    /* ⚠ EMIR KONTROLU BOSA DONEBILIR: arama yalniz `SIM.tick % LA_PERIYOT_TIK === 0`
       aninda karar verir. Sinama noktasi T'ye `ileri` eklenince periyoda denk gelmezse
       ne ana taraf ne isci emir uretir ve "0/0 esit" diye YANLIS gecer (ilk kosuda tam
       bu oldu: --ileri 60 ile T+60 periyoda denk gelmedi). Uretilen toplam emir sayisi
       ayrica raporlanir; sifirsa kapi SONUCSUZ ilan edilir. */
    let emirOk = 0, emirTop = 0, ongOk = 0, ongTop = 0, emirSayisi = 0;
    const detay = [];

    for (let n = 1; n <= NOKTA; n++) {
        // 1) ANA: sınama noktasına kadar ilerle
        calistir(`(() => {
          while (SIM.tick % ${ARA} !== 0 || SIM.tick === 0 || SIM.tick < ${(n - 1) * ARA + 1}) {
            if (SIM.battle && SIM.battle.winnerSide !== null) break;
            if (phase !== PHASE.BATTLE) break;
            globalThis.__st += BATTLE_TICK_MS;
            stepSim(globalThis.__st, BATTLE_TICK_SEC, battleControllersDrive, false);
            if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, globalThis.__st);
            globalThis.__emirler = [];
            battleLookaheadTick(globalThis.__st);
          }
          return 'ok';
        })()`, 'wk-ilerle.js');

        // 2) ANA: fork al (işçiye gidecek mesaj) — GÖLGE altında, gerçek maçı kirletmeden
        const paket = JSON.parse(calistir(`(() => {
          const _g = BATTLE_SIM_GOLGE; BATTLE_SIM_GOLGE = true;
          const f = battleForkCapture();
          BATTLE_SIM_GOLGE = _g;
          return JSON.stringify({ fork: JSON.stringify(f), now: globalThis.__st, tik: SIM.tick });
        })()`, 'wk-fork.js'));
        if (!paket.tik) break;

        // 3) ANA: k tik ilerle + ARA (işçinin yapacağının aynısı) — REFERANS
        const ref = JSON.parse(calistir(`(() => {
          const _g = BATTLE_SIM_GOLGE; BATTLE_SIM_GOLGE = true;
          const geri = battleForkCapture();
          let s = globalThis.__st;
          for (let i = 0; i < ${ILERI}; i++) {
            s += BATTLE_TICK_MS;
            stepSim(s, BATTLE_TICK_SEC, battleControllersDrive, false);
            if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, s);
          }
          const ilerHash = battleStateHash();
          globalThis.__emirler = [];
          battleLookaheadTick(s);
          const em = globalThis.__emirler.slice();
          battleForkRestore(geri);
          BATTLE_SIM_GOLGE = _g;
          return JSON.stringify({ emirler: em, ilerHash: ilerHash });
        })()`, 'wk-ref.js'));

        // 4) İŞÇİ: aynı fork, aynı ilerletme, aynı arama
        isci.postMessage({ tip: 'ara', fork: paket.fork, now: paket.now, ileri: ILERI });
        const cev = await bekle();

        const anahtar = (e) => e.map(o => o.uid + '@' + Math.round(o.x * 100) + ',' + Math.round(o.y * 100)).sort().join(' | ');
        const emirEsit = anahtar(ref.emirler) === anahtar(cev.emirler);
        const ongEsit = ref.ilerHash === cev.ilerHash;
        emirTop++; ongTop++; emirSayisi += ref.emirler.length;
        if (emirEsit) emirOk++;
        if (ongEsit) ongOk++;
        console.log('  tik ' + String(paket.tik).padStart(5) + '   fork ' +
            String(Math.round(paket.fork.length / 1024)).padStart(4) + 'KB   emir ' +
            String(ref.emirler.length).padStart(3) + '/' + String(cev.emirler.length).padEnd(3) +
            '  EMIR ' + (emirEsit ? 'ESIT ✓' : 'FARKLI ✗') +
            '   ONGORU ' + (ongEsit ? 'ESIT ✓' : 'FARKLI ✗'));
        if (!emirEsit) detay.push({ tik: paket.tik, ana: anahtar(ref.emirler).slice(0, 200), isci: anahtar(cev.emirler).slice(0, 200) });
    }

    for (const d of detay) {
        console.log('    ! tik ' + d.tik);
        console.log('      ana : ' + d.ana);
        console.log('      isci: ' + d.isci);
    }

    // ── NEGATİF KONTROL: fork'tan mayınları at → EMİR EŞİTLİĞİ düşmeli ──
    console.log('');
    console.log('NEGATIF KONTROL (fork\'tan mayinlar atiliyor — kapi YAKALAMALI):');
    const negPaket = JSON.parse(calistir(`(() => {
      const _g = BATTLE_SIM_GOLGE; BATTLE_SIM_GOLGE = true;
      const f = battleForkCapture();
      const mayinSay = (f.mines || []).length;
      f.mines = [];
      BATTLE_SIM_GOLGE = _g;
      return JSON.stringify({ fork: JSON.stringify(f), now: globalThis.__st, mayin: mayinSay });
    })()`, 'wk-neg.js'));
    const negRef = JSON.parse(calistir(`(() => {
      const _g = BATTLE_SIM_GOLGE; BATTLE_SIM_GOLGE = true;
      const geri = battleForkCapture();
      let s = globalThis.__st;
      for (let i = 0; i < ${ILERI}; i++) { s += BATTLE_TICK_MS; stepSim(s, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, s); }
      const h = battleStateHash();
      battleForkRestore(geri); BATTLE_SIM_GOLGE = _g;
      return JSON.stringify({ ilerHash: h });
    })()`, 'wk-negref.js'));
    isci.postMessage({ tip: 'ara', fork: negPaket.fork, now: negPaket.now, ileri: ILERI });
    const negCev = await bekle();
    const negYakalandi = negRef.ilerHash !== negCev.ilerHash;
    console.log('  forktaki mayin: ' + negPaket.mayin + '   ' +
        (negPaket.mayin === 0 ? '! bu noktada mayin YOK — kontrol UYGULANAMADI (--nokta/--ara arttir)'
            : (negYakalandi ? 'SAPMA YAKALANDI (kapi CALISIYOR)' : '*** KACIRDI -> KAPI KOR ***')));

    await isci.terminate();
    console.log('');
    console.log('  EMIR ESITLIGI  : ' + emirOk + '/' + emirTop + '   (fork tek basina YETERLI mesaj mi)' +
        (emirSayisi === 0 ? '   *** SONUCSUZ: hic emir uretilmedi, karsilastirma BOS ***' : '   [' + emirSayisi + ' emir karsilastirildi]'));
    console.log('  ONGORU ESITLIGI: ' + ongOk + '/' + ongTop + '   (isci gelecegi birebir tahmin edebiliyor mu)');
    const kontrolOk = negPaket.mayin === 0 ? null : negYakalandi;
    const gecti = emirOk === emirTop && ongOk === ongTop && kontrolOk !== false && emirSayisi > 0;
    console.log('  KAPI: ' + (gecti ? 'GECTI' : 'DUSTU') +
        (kontrolOk === null ? '   (⚠ negatif kontrol uygulanamadi)' : ''));
    process.exit(gecti ? 0 : 1);
})().catch(e => { console.log('HATA: ' + e.message); process.exit(1); });
