'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  ARAMA ↔ REPLAY KAPISI — canlıda arama açıkken kayıt hâlâ tekrar üretilebiliyor mu?
//
//  NEDEN ZORUNLU: arama canlı oyunda VARSAYILAN AÇIK hâle getirildi. Arama, birimlerin
//  hedeflerini DOĞRUDAN değiştiriyor. Replay ise "olay günlüğü + determinist sim"
//  mimarisi: replay'de arama KOŞMAZ, kayıttaki olaylar oynatılır. Emirler kaydedilmezse
//  canlıda sürüklenen birimler replay'de yerinde kalır → kayıt SESSİZCE bozulur.
//  (Kullanıcının "Ham JSON" telemetrisi ve tüm replay tabanlı teşhis buna bağlı.)
//
//  Bu yüzden `battleLookaheadEmirVer` NİHAİ emirleri 'lookahead-order' olarak yazar ve
//  `battleApplyRecordedEvent` onları geri koyar. Bu kapı o sözleşmeyi sınar.
//
//  NEGATİF KONTROL: kayıt kapatılırsa kapı DÜŞMELİ. Düşmüyorsa kapı ölçmüyordur
//  (bu projede "yeşil ama kör test" birden çok kez yaşandı).
//
//    node tools/arama-replay-kapisi.js [--tohum 4] [--maxtik 1200]
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const N = Math.max(1, Number(arg('--tohum', 4)) || 4);
const TOHUM0 = Number(arg('--tohum0', 500000)) || 500000;
const MAX_TIK = Number(arg('--maxtik', 1200)) || 1200;
/* --koruma N : emir ömrü koruması açıkken de kapı geçilmeli. ZORUNLU, çünkü koruma
   `applyBattleOrder` içinde SIM.tick ve `_laUntilTick` okuyor; kontrolör emri hem
   canlıda hem replay'de AYNI fonksiyondan geçtiği için kapı iki yolda da aynı kararı
   vermeli. Vermezse kayıt sessizce bozulur. */
const KORUMA = Math.max(0, Number(arg('--koruma', 0)) || 0);

function kos(ctx, seed, kayitAcik) {
    const kod = '(() => {' +
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
        'BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;' +
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;' +
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;' +
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;' +
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true,' +
        '  durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
        // KAYIT AÇIK olmalı: bu kapının ölçtüğü şey kaydın kendisi.
        'BATTLE_REPLAY_KAYITSIZ = false;' +
        'const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,' +
        '  brainIntel4:true, isAttacker:false, pro:false });' +
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;' +
        'battleDeployManifest(mv, false, { source:"replaykapi", ally:true });' +
        'startBattle(); SIM.headless = true;' +
        'BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false;' +
        'BATTLE_LA_EMIR_KORUMA = ' + KORUMA + ';' +
        // NEGATİF KONTROL kolu: emirleri KAYDETME (kapı bunu YAKALAMALI)
        (kayitAcik ? '' : 'const _eskiKayit = battleRecordEvent; battleRecordEvent = function(t, p, k){ if (t === "lookahead-order") return; return _eskiKayit(t, p, k); };') +
        'let st = 0, emir = 0;' +
        'while (SIM.tick < ' + MAX_TIK + ' && phase === PHASE.BATTLE) {' +
        '  if (SIM.battle && SIM.battle.winnerSide !== null) break;' +
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, true);' +
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
        '  battleLookaheadTick(st);' +
        '}' +
        'emir = BATTLE_LA_SAYAC.emir;' +
        'const laOlay = BATTLE_REPLAY.events.filter(e => e.type === "lookahead-order").length;' +
        'const canliTik = SIM.tick;' +
        'const kayit = exportBattleReplay();' +
        (kayitAcik ? '' : 'battleRecordEvent = _eskiKayit;') +
        // ── REPLAY: arama KOŞMAZ, yalnız kayıt oynatılır ──
        'BATTLE_LOOKAHEAD_RED = false; BATTLE_LOOKAHEAD_BLUE = false;' +
        'let sapma = null, replayTik = 0;' +
        'try {' +
        '  startBattleReplay(kayit); SIM.headless = true;' +
        '  let s2 = 0;' +
        '  while (SIM.tick < canliTik && phase === PHASE.BATTLE) {' +
        '    s2 += BATTLE_TICK_MS; stepSim(s2, BATTLE_TICK_SEC, battleReplayDrive, true);' +
        '    if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, s2);' +
        '  }' +
        '  replayTik = SIM.tick; sapma = BATTLE_REPLAY_DRIVER.divergence;' +
        '} catch (e) { sapma = { hata: String(e && e.message || e) }; }' +
        'return JSON.stringify({ seed:' + seed + ', emir, laOlay, canliTik, replayTik,' +
        '  sapma: sapma ? { tik: sapma.tick, hata: sapma.hata || null } : null });' +
        '})()';
    return JSON.parse(vm.runInContext(kod, ctx, { filename: 'rk-' + seed + '.js' }));
}

function main() {
    const { ctx, hatalar } = tezgahKur();
    if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }
    console.log('ARAMA <-> REPLAY KAPISI — ' + N + ' tohum, ' + MAX_TIK + ' tik');
    console.log('');
    let gecen = 0, negYakalandi = 0;
    for (let i = 0; i < N; i++) {
        const seed = TOHUM0 + i;
        const p = kos(ctx, seed, true);
        const ok = !p.sapma;
        if (ok) gecen++;
        console.log('  tohum ' + seed + '   emir ' + p.emir + '   kayitli-olay ' + p.laOlay +
            '   ' + (ok ? 'SAPMA YOK' : 'SAPMA @tik ' + (p.sapma.tik != null ? p.sapma.tik : '?') +
                (p.sapma.hata ? ' (' + p.sapma.hata + ')' : '')));
        if (p.emir > 0 && p.laOlay === 0) console.log('    ! emir uretildi ama HIC kaydedilmedi');
    }
    // ── NEGATİF KONTROL: kayıt kapalıyken kapı DÜŞMELİ ──
    console.log('');
    console.log('NEGATIF KONTROL (lookahead-order kaydi KAPALI — kapi bunu yakalamali):');
    const n = kos(ctx, TOHUM0, false);
    const yakalandi = !!n.sapma;
    if (yakalandi) negYakalandi = 1;
    console.log('  emir ' + n.emir + '   kayitli-olay ' + n.laOlay + '   ' +
        (yakalandi ? 'SAPMA YAKALANDI (kapi CALISIYOR)' : 'SAPMA YOK -> KAPI KOR!'));
    console.log('');
    const hepsi = (gecen === N) && (negYakalandi === 1);
    console.log('  SONUC: ' + gecen + '/' + N + ' pozitif temiz, negatif kontrol ' +
        (negYakalandi ? 'yakaladi' : 'KACIRDI'));
    console.log('  KAPI: ' + (hepsi ? 'GECTI' : 'DUSTU'));
    process.exit(hepsi ? 0 : 1);
}

main();
