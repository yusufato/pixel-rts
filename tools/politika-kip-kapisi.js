'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  POLİTİKA KİPİ KAPISI — kip GERÇEKTEN koşuyor mu, ve NE KADAR UCUZ?
//
//  İki soruyu ayrı ayrı yanıtlar:
//   1) YOL ÇALIŞIYOR MU: LA_POLITIKA=1 iken sayaçlar artıyor mu (emir üretiliyor mu)?
//      Sessizce hiçbir şey yapmayan bir kip, "kazanç yok" diye YANLIŞ okunurdu.
//   2) NE KADAR UCUZ: aynı maç üç kipte koşulup CPU süresi ölçülür.
//      Damıtmanın TEK gerekçesi bütçe duvarıdır; o duvarın aşıldığı ÖLÇÜLMELİ.
//
//  Bu bir KALİTE kapısı DEĞİL — kalite yalnız tools/rol-dengesi.js ile ölçülür.
//
//    node tools/politika-kip-kapisi.js [--tohum 700001] [--maxtik 1200]
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const TOHUM = Number(arg('--tohum', 700001)) || 700001;
const MAX_TIK = Number(arg('--maxtik', 1200)) || 1200;

function kos(ctx, ad, ayar) {
    const kod = '(() => {' +
        'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
        'BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;' +
        'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;' +
        'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;' +
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;' +
        'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + TOHUM + ', attackerSide:true,' +
        '  durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
        'BATTLE_REPLAY.telemetry = null;' +
        'if (typeof BATTLE_REPLAY_KAYITSIZ !== "undefined") BATTLE_REPLAY_KAYITSIZ = true;' +
        'const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,' +
        '  brainIntel4:true, isAttacker:false, pro:false });' +
        'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;' +
        'battleDeployManifest(mv, false, { source:"kip", ally:true });' +
        'startBattle(); SIM.headless = true;' +
        'for (const k in BATTLE_LA_SAYAC) BATTLE_LA_SAYAC[k] = 0;' +
        ayar +
        'let st = 0; let enKotu = 0, ikinci = 0;' +
        'try { while (SIM.tick < ' + MAX_TIK + ' && phase === PHASE.BATTLE) {' +
        '  if (SIM.battle && SIM.battle.winnerSide !== null) break;' +
        '  const _t0 = Date.now();' +
        '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
        '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
        '  battleLookaheadTick(st);' +
        /* EN KÖTÜ TEK-TİK: oyunu donduran ölçü BUDUR, ortalama değil. Kullanıcı
           "5 saniyede bir 2-3 saniye donuyor" dedi; ortalama verim 1.90× olmasına
           rağmen. İkinci en kötü de tutulur (tek aykırı değere aldanmamak için). */
        '  const _d = Date.now() - _t0;' +
        '  if (_d > enKotu) { ikinci = enKotu; enKotu = _d; } else if (_d > ikinci) { ikinci = _d; }' +
        '} } finally { BATTLE_LOOKAHEAD_RED = false; BATTLE_LOOKAHEAD_BLUE = false; LA_POLITIKA = 0; LA_AG_KAPI = true; LA_TIK_BIRIM = 0; BATTLE_LA_KUYRUK.length = 0; LA_UFUK = 100; LA_DERIN = 2; LA_PERIYOT_TIK = 100; LA_BIRIM = 20; }' +
        'const oS = battleArmyObservation(true), oD = battleArmyObservation(false);' +
        'return JSON.stringify({ sayac: BATTLE_LA_SAYAC, tik: SIM.tick, enKotu, ikinci,' +
        '  marj: Math.round(oS.effectiveValue - oD.effectiveValue),' +
        '  agHazir: (typeof battlePolicyNetHazir === "function") ? battlePolicyNetHazir() : false });' +
        '})()';
    const t0 = process.hrtime.bigint();
    const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'kip-' + ad + '.js' }));
    r.ms = Number(process.hrtime.bigint() - t0) / 1e6;
    r.ad = ad;
    return r;
}

function main() {
    const { ctx, hatalar } = tezgahKur();
    if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }

    console.log('POLITIKA KIPI KAPISI — tohum ' + TOHUM + ', ' + MAX_TIK + ' tik (' + (MAX_TIK / 20) + 'sn oyun)');
    console.log('');

    const kipler = [
        ['aramasiz', 'BATTLE_LOOKAHEAD_RED = false; BATTLE_LOOKAHEAD_BLUE = false;'],
        ['tam-arama', 'BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false; LA_POLITIKA = 0;'],
        ['politika', 'BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false; LA_POLITIKA = 1;'],
        /* AYRIŞTIRMA: politika kipinde rollout YOK, ama eleyici hâlâ her aday için
           DEĞER AĞINI çağırıyor (25 aday × 20 birim = 500 CNN geçişi/tur). Bu kol,
           maliyetin ne kadarının o eleyiciden geldiğini gösterir.
           UYARI: bu kol yalnız MALİYET ölçer — ağ kapalıyken sıralama ve `_ag`
           öznitelikleri değişir, yani politika eğitildiğinden farklı girdi görür.
           Kalite kolu olarak KULLANILAMAZ. */
        ['politika-agsiz', 'BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false; LA_POLITIKA = 1; LA_AG_KAPI = false;'],
        /* TİKE YAYILMIŞ arama: aynı iş, aynı kapsam — yalnız zamana dağıtılmış.
           Toplam CPU benzer kalmalı, EN KÖTÜ TİK ise çökmeli. Kullanıcının
           gördüğü donmanın çözümü tam olarak bu sütunda okunur. */
        ['arama-yayik', 'BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false; LA_POLITIKA = 0; LA_TIK_BIRIM = 1;'],
        /* CANLI ADAYLARI: en kotu tik'i KARE BUTCESINE indirmeye calisir.
           Tek birim karari = LA_DERIN+1 rollout x LA_UFUK sim tiki. Tikin ICINDE
           bolunemez (fork gercek sim ile ayni anda yasayamaz), o yuzden hitch'in
           tabani TEK BIRIM maliyetidir. Onu ancak rollout'u kisarak dusurebiliriz —
           ve bu KAZANCI DUSURUR (olculdu: 1sn ufuk +33). Takas acik yapilir. */
        ['canli-A', 'BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false; LA_POLITIKA = 0; LA_TIK_BIRIM = 1; LA_UFUK = 50;'],
        ['canli-B', 'BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false; LA_POLITIKA = 0; LA_TIK_BIRIM = 1; LA_UFUK = 50; LA_DERIN = 1;'],
        ['canli-C', 'BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false; LA_POLITIKA = 0; LA_TIK_BIRIM = 1; LA_UFUK = 40; LA_DERIN = 1; LA_PERIYOT_TIK = 60;'],
        /* D/E: KAPSAMI da kis. Yayma yalnizca isi DAGITIR, AZALTMAZ; toplam yuk
           %27'de kalirsa oyun donmaz ama surekli takilir. Asil rahatlama LA_BIRIM'den. */
        ['canli-D', 'BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false; LA_POLITIKA = 0; LA_TIK_BIRIM = 1; LA_UFUK = 50; LA_DERIN = 1; LA_BIRIM = 8;'],
        ['canli-E', 'BATTLE_LOOKAHEAD_RED = true; BATTLE_LOOKAHEAD_BLUE = false; LA_POLITIKA = 0; LA_TIK_BIRIM = 1; LA_UFUK = 60; LA_DERIN = 2; LA_BIRIM = 6;']
    ];
    const sonuc = kipler.map(([ad, ayar]) => kos(ctx, ad, ayar));

    const oyunMs = (MAX_TIK / 20) * 1000;
    console.log('kip'.padEnd(14) + 'CPU(ms)'.padStart(9) + 'oyun/CPU'.padStart(10) +
        'EN KOTU TIK'.padStart(13) + '2.kotu'.padStart(8) + 'emir'.padStart(7) + 'marj'.padStart(8));
    console.log('-'.repeat(69));
    for (const r of sonuc) {
        const gercekOyunMs = (r.tik / 20) * 1000;
        console.log(r.ad.padEnd(14) + String(Math.round(r.ms)).padStart(9) +
            (gercekOyunMs / r.ms).toFixed(2).padStart(10) +
            (String(r.enKotu) + 'ms').padStart(13) + (String(r.ikinci) + 'ms').padStart(8) +
            String(r.sayac.emir).padStart(7) + String(r.marj).padStart(8));
    }
    console.log('');
    console.log('  EN KOTU TIK = oyunu DONDURAN olcu. Bir kare 16.7ms (60 FPS).');
    console.log('  Verim ("oyun/CPU") yuksek olsa bile tek-tik yuksekse oyun DONAR.');
    const aramasiz = sonuc[0], tam = sonuc[1], pol = sonuc[2];
    console.log('');
    console.log('  "oyun/CPU" > 1 = gercek zamandan HIZLI (canli oyuna sigar).');
    console.log('');

    // ── KAPI 1: yol calisiyor mu ──
    const agHazir = pol.agHazir;
    if (!agHazir) {
        console.log('  ! POLITIKA MODELI YOK (js/BattlePolicyModel.js) — kip kendini kapatti.');
        console.log('    Bu bir HATA DEGIL, ama kip OLCULMEDI. Once model uretilmeli.');
        process.exit(0);
    }
    const yolCalisti = (pol.sayac.politikaEmir + pol.sayac.politikaKal) > 0;
    console.log('  KAPI 1 (yol calisiyor mu) : ' + (yolCalisti ? 'GECTI' : 'DUSTU') +
        '   politika karari ' + (pol.sayac.politikaEmir + pol.sayac.politikaKal));
    if (!yolCalisti) {
        console.log('    Kip sessizce hicbir sey yapmadi — "kazanc yok" diye YANLIS okunurdu.');
        process.exit(1);
    }

    // ── KAPI 2: gercekten ucuz mu ──
    const aramaEk = tam.ms - aramasiz.ms;
    const polEk = pol.ms - aramasiz.ms;
    const kat = polEk > 0 ? (aramaEk / polEk) : Infinity;
    console.log('  KAPI 2 (ucuzluk)          : arama +' + Math.round(aramaEk) + 'ms, politika +' +
        Math.round(polEk) + 'ms  ->  ' + (isFinite(kat) ? kat.toFixed(1) + ' KAT ucuz' : 'olculemedi'));
    const sigar = (pol.tik / 20) * 1000 / pol.ms > 1;
    console.log('  KAPI 3 (canliya sigar mi) : ' + (sigar ? 'GECTI' : 'DUSTU') +
        '   (tam arama: ' + ((tam.tik / 20) * 1000 / tam.ms > 1 ? 'sigiyor' : 'SIGMIYOR') + ')');
    console.log('');
    console.log('  NOT: bu kapi KALITE olcmez. Politikanin daha IYI oynayip oynamadigi');
    console.log('       yalniz tools/rol-dengesi.js ile (n>=48, eslestirilmis) belirlenir.');
}

main();
