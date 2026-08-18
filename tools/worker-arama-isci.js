'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  ARAMA İŞÇİSİ (Node worker_threads) — tarayıcıdaki Web Worker'ın birebir provası
//
//  Tarayıcı Worker'ı yazmadan önce mimarinin DOĞRU olduğunu burada kanıtlıyoruz:
//  işçi kendi dünyasını kurar, ana iş parçacığından gelen fork'u geri yükler, aramayı
//  koşar ve YALNIZ emirleri döndürür. Tarayıcı sürümü ile tek farkı taşıma katmanı
//  (postMessage yerine parentPort) — mantık aynı.
//
//  ⚠ FORK HARİTAYI TAŞIMAZ. `battleForkCapture` birimleri/siperleri/mayınları taşır
//  ama arazi rasterini taşımaz. Bu yüzden işçi ÖNCE aynı tohumla oturumu açar
//  (kurulum bir kez), sonra her mesajda yalnız fork'u geri yükler.
//
//  MESAJ SÖZLEŞMESİ
//    ana → işçi  { tip:'kur', seed, ... }         : oturumu kur (bir kez)
//    ana → işçi  { tip:'ara', fork, now, ileri }  : fork'u yükle, `ileri` tik ilerlet, ara
//    işçi → ana  { tip:'emir', emirler, hash }    : nihai emirler + ilerletme sonrası hash
// ═══════════════════════════════════════════════════════════════════════════
const { parentPort, workerData } = require('node:worker_threads');
const vm = require('node:vm');
const { tezgahKur } = require('./muharebe-tezgah.js');

const { ctx, hatalar } = tezgahKur();
if (hatalar.length) {
    parentPort.postMessage({ tip: 'hata', mesaj: 'TEZGAH: ' + hatalar.join(' | ') });
    process.exit(1);
}

// ── KURULUM: aynı tohumla oturum (arazi + STATS + dünya boyutları buradan gelir) ──
const kurKod = `(() => {
  BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
  if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;
  if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;
  openBattlefieldSession({ mode:"quick", mapId:-2, seed:${workerData.seed}, attackerSide:true,
    durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
  BATTLE_REPLAY.telemetry = null; BATTLE_REPLAY_KAYITSIZ = true;
  const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,
    brainIntel4:true, isAttacker:false, pro:false });
  if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;
  battleDeployManifest(mv, false, { source:"wisci", ally:true });
  startBattle(); SIM.headless = true;
  BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false;
  /* EMİR TOPLAYICI — yalnız NİHAİ emirler (kayit===true). Deneme rollout'ları da bu
     fonksiyonu çağırıyor; onları toplamak işçiyi ana iş parçacığından ayırırdı. */
  globalThis.__emirler = [];
  const _e = battleLookaheadEmirVer;
  battleLookaheadEmirVer = function (uid, karar, kayit) {
    if (kayit) globalThis.__emirler.push({ uid: uid, x: karar.x, y: karar.y });
    return _e(uid, karar, kayit);
  };
  return 'ok';
})()`;
vm.runInContext(kurKod, ctx, { filename: 'wisci-kur.js' });

parentPort.on('message', (msg) => {
    if (msg.tip !== 'ara') return;
    try {
        const kod = `(() => {
  const fork = JSON.parse(${JSON.stringify(msg.fork)});
  battleForkRestore(fork);
  let s = ${msg.now};
  /* ÖNGÖRÜ: emir ${msg.ileri} tik sonra inecek, o yüzden dünyayı O KADAR ilerletip
     oradan ara. Sim deterministik ve kontrolörler fork'un içinde olduğu için bu
     ilerletme ana iş parçacığınınkiyle BİREBİR aynı olmak zorunda — kapı bunu sınar. */
  for (let i = 0; i < ${msg.ileri}; i++) {
    s += BATTLE_TICK_MS;
    stepSim(s, BATTLE_TICK_SEC, battleControllersDrive, false);
    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, s);
  }
  const ilerHash = battleStateHash();
  globalThis.__emirler = [];
  battleLookaheadTick(s);
  return JSON.stringify({ emirler: globalThis.__emirler, ilerHash: ilerHash, tik: SIM.tick });
})()`;
        const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'wisci-ara.js' }));
        parentPort.postMessage({ tip: 'emir', emirler: r.emirler, ilerHash: r.ilerHash, tik: r.tik });
    } catch (e) {
        parentPort.postMessage({ tip: 'hata', mesaj: String(e && e.message || e) });
    }
});
