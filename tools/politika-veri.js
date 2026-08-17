'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  POLİTİKA VERİSİ — aramanın kararlarını topla (R1: kendiyle oynama döngüsü)
//
//  NEDEN: arama, mevcut politikayı ÖLÇÜLMÜŞ biçimde yeniyor (+1262 marj, n=96, t 4.3).
//  AlphaZero'nun tüm motoru bu tek gözlemden ibarettir:
//      arama > politika  →  politikayı ARAMANIN ÇIKTISIYLA eğit  →  politika güçlenir
//  Biz bu döngüyü hiç kapatmadık: her maçta aramayı sıfırdan koşuyoruz ve öğrendiğimiz
//  hiçbir şey birikmiyor. Bu araç o birikimi başlatır.
//
//  AYRICA BÜTÇE DUVARINI DA ÇÖZER: ucuzlatmanın dört yolu da ölçüldü ve öldü
//  (1sn ufuk +33 · dönüşüm +191 · uzun periyot +153 · ışınlama vasat). Kazanç
//  ancak TAM konfigürasyonla geliyor ve o da bir çekirdeğin tamamını yiyor.
//  Damıtılmış politika ise ~1ms — canlı oyuna rollout GEREKMEDEN sığar.
//
//  HEDEF: her birim kararı için "arama nereye gitmeyi seçti" sınıfı.
//    sınıf 0        = yerinde kal
//    sınıf 1..24    = halka × yön (birime GÖRE, mutlak koordinat değil)
//  Böylece model harita konumundan bağımsız, göreli bir manevra dili öğrenir.
//
//  ⚠ GEÇMİŞ UYARISI: davranış klonlama bu projede bir kez denendi ve GERİ ÇEKİLDİ
//  (v2 klon 96 bağımsız maçta t −2.85). Ama o, tavanı ölçülüp ÇIKMAZ çıkmış bir
//  SEÇİCİ yaklaşımını klonluyordu. Burada öğretmen kanıtlanmış üstün bir arama.
//  Yine de sonuç varsayılmıyor — kapı `tools/rol-dengesi.js`.
//
//    node tools/politika-veri.js --mac 60 --tohumofs 100000 --out qa-runtime/politika/veri-0.jsonl
// ═══════════════════════════════════════════════════════════════════════════
const { tezgahKur } = require('./muharebe-tezgah.js');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const MAC = Math.max(1, Number(arg('--mac', 40)) || 40);
const OFS = Number(arg('--tohumofs', 100000)) || 100000;
const OUT = arg('--out', 'qa-runtime/politika/veri.jsonl');
const MAX_TIK = Number(arg('--maxtik', 7200)) || 7200;
// arama pahalı (~1 CPU-sn / oyun-sn). Tek taraf = yarı maliyet, ama tek tarafın
// dağılımını öğreniriz. İki taraf = tam maliyet, simetrik veri. Varsayılan: iki taraf.
const TARAF = String(arg('--taraf', 'iki'));
/* AĞ ÖN SÜZGECİ — CANLI KİPLE AYNI OLMAK ZORUNDA.
   Politika, hangi seçenek kümesi üzerinde eğitilirse çıkarımda da o kümeyi görmeli.
   LA_AG_ADAY, değer ağına sorulan aday sayısını belirler ve hem SIRALAMAYI (yani
   #1/#2'nin kim olduğunu) hem de yayılım kapısını değiştirir. Eğitim ile çıkarım
   burada ayrışırsa politika hiç görmediği bir seçim kümesine salınır ve bu MAÇ
   SONUCUNDAN GÖRÜLEMEZ — sessizce kötü oynar.
   ÖLÇÜLDÜ (tools/politika-kip-kapisi.js, 60sn oyun, tek taraf):
     LA_AG_ADAY=0 (hepsi) → politika kipi 61.8sn CPU (0.97× gerçek zaman, SIĞMAZ)
     LA_AG_ADAY=5         → politika kipi 15.1sn CPU (3.98× gerçek zaman, SIĞAR) */
const AG_ADAY = Number(arg('--agaday', 5));
/* --derin: kac aday GERCEKTEN oynatilsin (LA_DERIN).
   DEGER-AGI VERISI icin yukseltilir. Sebep dagilim uyusmazligi: cikarimda 25 adayin
   hepsini puanlamak isteyecegiz, ama etiket YALNIZ oynatilan adaylar icin var.
   derin=2 ile ag, "en iyi 2" disindaki adaylari HIC gormeden onlari puanlamaya
   calisirdi — bugun politika aginda tam bu sinif hata yasandi. */
const DERIN = Number(arg('--derin', 0));

function main() {
    const { ctx, hatalar } = tezgahKur();
    if (hatalar.length) { console.log('TEZGAH HATASI:\n  ' + hatalar.join('\n  ')); process.exit(1); }

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    const fd = fs.openSync(OUT, 'w');
    let toplam = 0;
    const t0 = Date.now();

    console.log('POLITIKA VERISI — aramanin kararlari');
    console.log('  mac: ' + MAC + '   tohum: ' + OFS + '..' + (OFS + MAC - 1));
    console.log('  LA_AG_ADAY: ' + AG_ADAY + '   LA_DERIN: ' + (DERIN || 'varsayilan'));

    for (let i = 0; i < MAC; i++) {
        const seed = OFS + i;
        const kod = '(() => {' +
            'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
            'BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;' +
            'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;' +
            'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;' +
            'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;' +
            'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true,' +
            '  durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
            'BATTLE_REPLAY.telemetry = null;' +
            'if (typeof BATTLE_REPLAY_KAYITSIZ !== "undefined") BATTLE_REPLAY_KAYITSIZ = true;' +
            'const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,' +
            '  brainIntel4:true, isAttacker:false, pro:false });' +
            'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;' +
            'battleDeployManifest(mv, false, { source:"politika", ally:true });' +
            'startBattle(); SIM.headless = true;' +
            'if (typeof LA_AG_ADAY !== "undefined") LA_AG_ADAY = ' + AG_ADAY + ';' +
            (DERIN > 0 ? ('if (typeof LA_DERIN !== "undefined") LA_DERIN = ' + DERIN + ';') : '') +
            // arama açık taraf(lar): iki taraf = simetrik veri, tek taraf = yarı maliyet
            'BATTLE_LOOKAHEAD_RED = ' + (TARAF !== 'mavi') + ';' +
            'BATTLE_LOOKAHEAD_BLUE = ' + (TARAF !== 'kirmizi') + ';' +
            'BATTLE_LA_KAYIT.on = true; BATTLE_LA_KAYIT.buf.length = 0;' +
            'let st = 0;' +
            'try { while (SIM.tick < ' + MAX_TIK + ' && phase === PHASE.BATTLE) {' +
            '  if (SIM.battle && SIM.battle.winnerSide !== null) break;' +
            '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
            '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st);' +
            '  battleLookaheadTick(st);' +
            '} } finally { BATTLE_LA_KAYIT.on = false; BATTLE_LOOKAHEAD_RED = false; BATTLE_LOOKAHEAD_BLUE = false; }' +
            'const oS = battleArmyObservation(true), oD = battleArmyObservation(false);' +
            'const nihai = Math.round(oS.effectiveValue - oD.effectiveValue);' +
            'const out = BATTLE_LA_KAYIT.buf.map(k => ({ r:k.r, s:k.s, b:k.b, o:k.o, k:k.k, y:k.y, e:k.e, tik:k.tik, nihai:nihai }));' +
            'BATTLE_LA_KAYIT.buf.length = 0;' +
            'return JSON.stringify({ seed:' + seed + ', ornek: out, sinif: battleLookaheadSinifSayisi(), bitis: SIM.tick });' +
            '})()';
        const r = JSON.parse(vm.runInContext(kod, ctx, { filename: 'pv-' + seed + '.js' }));
        for (const o of r.ornek) fs.writeSync(fd, JSON.stringify(o) + '\n');
        toplam += r.ornek.length;
        const sn = Math.round((Date.now() - t0) / 1000);
        process.stdout.write('  ' + (i + 1) + '/' + MAC + ' mac   ' + toplam + ' karar   ' + sn + 'sn\r');
    }
    fs.closeSync(fd);
    console.log('\n  TOPLAM: ' + toplam + ' karar -> ' + OUT);
    console.log('  (her kayit: durum + aramanin SECTIGI sinif; model "bu durumda bu birim nereye" ogrenir)');
}

main();
