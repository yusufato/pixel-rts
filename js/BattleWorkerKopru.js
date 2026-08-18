/* ═══════════════════════════════════════════════════════════════════════════
   ARAMA WORKER KÖPRÜSÜ — ana iş parçacığı tarafı

   GÖREV: arama turu geldiğinde dünyayı (fork) işçiye yollar, cevabı beklemeden
   oyuna döner, emirler geldiğinde uygular. Ana iş parçacığında kalan yük tur başına
   yalnız serileştirme: ÖLÇÜLDÜ 10.3ms (fork 612KB), arama turunun %0.4'ü.

   ⚠ ÖNGÖRÜ VE ONUN DOĞRULAMASI
   İşçi dünyayı `LA_W_ILERI` tik ileri sarıp ORADAN arar; emir tam o ana iner. Bu,
   AI-vs-AI'da tam doğrudur (sim deterministik, kontrolörler + rngState fork'ta) ama
   OYUNCU o pencerede oynarsa öngörü sapar. Köprü bunu tahmin etmez, ÖLÇER: işçi
   öngördüğü durumun hash'ini gönderir, köprü emir indiği tikte kendi hash'iyle
   karşılaştırır. Sapma sayacı `BATTLE_LA_WORKER.sapma`'da birikir.

   ⚠ REPLAY VE ÇOK OYUNCULU
   Emirler `battleLookaheadEmirVer(..., true)` ile uygulanır → 'lookahead-order' olarak
   kaydedilir, yani replay sözleşmesi korunur (kapı: tools/arama-replay-kapisi.js).
   MP'de köprü AÇILMAZ: lockstep'te her istemcinin aynı anda aynı emri üretmesi gerekir,
   worker gecikmesi istemciden istemciye değişir → desync. (js/main.js zaten MP'de
   aramayı kapatıyor.)

   ⚠ KULLANIM: `index.html` bu dosyayı `js/BattleLookahead.js`'ten SONRA yüklemeli.
   ═══════════════════════════════════════════════════════════════════════════ */

var BATTLE_LA_WORKER = {
    acik: false,          // köprü kullanılıyor mu (kur() başarılıysa true)
    isci: null,
    hazir: false,
    bekleyen: 0,          // uçuşta olan istek (aynı anda en fazla 1)
    sonId: 0,
    gonderTik: 0,         // isteğin gönderildiği tik
    hedefTik: 0,          // emrin inmesi beklenen tik (gonderTik + ileri)
    ileri: 100,           // öngörü penceresi (tik) — ölçülen tur süresine göre ayarlanır
    bekleyenEmir: null,   // işçiden gelen ama vakti gelmemiş emirler
    tur: 0, emir: 0, sapma: 0, gecKalan: 0, hata: 0, isinmaAtlanan: 0,
    sonSure: 0, ortSure: 0
};

/* ÖNGÖRÜ PENCERESİ: işçinin bir tur ne kadar sürdüğü makineye göre değişir. Sabit
   vermek yerine ÖLÇÜLENDEN türetilir — yavaş makinede pencere büyür, hızlıda küçülür.
   20 tik = 1sn tampon; alt sınır 40 tik (2sn), üst sınır 200 tik (10sn). */
function battleLaWorkerPencere(sureMs) {
    var tik = Math.ceil((sureMs || 0) / (typeof BATTLE_TICK_MS !== 'undefined' ? BATTLE_TICK_MS : 50)) + 20;
    return Math.max(40, Math.min(200, tik));
}

/* İŞÇİ DOSYASININ YOLU — sayfaya göre DEĞİL, KÖPRÜNÜN KENDİ konumuna göre çözülür.
   KUSUR (ölçülerek bulundu, canlı kapı): sabit 'js/lookahead-worker.js' yazılıydı ve
   köprü `tools/` altındaki bir kapı sayfasından yüklenince yol `/tools/js/...` olup
   404 veriyordu. Köprü sessizce kapanıyor, oyun kısılmış ana-iplik aramasına düşüyordu —
   yani "worker açık" sanılan bir kurulumda worker HİÇ ÇALIŞMIYORDU. `currentScript`
   betik YÜKLENİRKEN okunur (sonra null olur), o yüzden burada bir kez hesaplanır. */
var BATTLE_LA_WORKER_URL = (function () {
    try {
        var s = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript.src : '';
        if (s) return s.replace(/[^/]*$/, 'lookahead-worker.js');
    } catch (e) {}
    return 'js/lookahead-worker.js';
})();

function battleLaWorkerKur() {
    if (BATTLE_LA_WORKER.isci) return true;
    if (typeof Worker !== 'function') return false;                       // Worker yok
    if (typeof MP !== 'undefined' && MP && MP.active) return false;       // MP: lockstep, açılmaz
    try {
        var w = new Worker(BATTLE_LA_WORKER_URL);
        w.onmessage = function (ev) { battleLaWorkerMesaj(ev.data || {}); };
        w.onerror = function (e) {
            BATTLE_LA_WORKER.hata++;
            BATTLE_LA_WORKER.acik = false;
            // Yolu da bas: en olası sebep işçi dosyasının bulunamaması (404).
            console.warn('[arama-worker] hata, köprü kapatıldı:', (e && e.message) || e,
                '| işçi yolu:', BATTLE_LA_WORKER_URL);
        };
        BATTLE_LA_WORKER.isci = w;
        BATTLE_LA_WORKER.acik = true;
        w.postMessage({
            tip: 'kur',
            oturum: {
                mapId: BATTLE_SESSION.requestedMapId != null ? BATTLE_SESSION.requestedMapId : BATTLE_SESSION.mapId,
                seed: BATTLE_SESSION.seed,
                attackerSide: BATTLE_SESSION.attackerSide,
                durationSec: BATTLE_SESSION.durationSec,
                playerMoney: 6500, enemyMoney: 6500
            }
        });
        return true;
    } catch (e) {
        console.warn('[arama-worker] kurulamadı:', e && e.message);
        BATTLE_LA_WORKER.acik = false;
        return false;
    }
}

function battleLaWorkerKapat() {
    if (BATTLE_LA_WORKER.isci) { try { BATTLE_LA_WORKER.isci.terminate(); } catch (e) {} }
    BATTLE_LA_WORKER.isci = null;
    BATTLE_LA_WORKER.acik = false;
    BATTLE_LA_WORKER.hazir = false;
    BATTLE_LA_WORKER.bekleyen = 0;
    BATTLE_LA_WORKER.bekleyenEmir = null;
}

function battleLaWorkerMesaj(m) {
    if (m.tip === 'hazir') { BATTLE_LA_WORKER.hazir = true; return; }
    if (m.tip === 'hata') {
        BATTLE_LA_WORKER.hata++;
        BATTLE_LA_WORKER.bekleyen = 0;
        console.warn('[arama-worker]', m.mesaj);
        return;
    }
    if (m.tip !== 'emir') return;
    BATTLE_LA_WORKER.bekleyen = 0;
    if (m.id !== BATTLE_LA_WORKER.sonId) return;      // bayat cevap (yeni tur başlamış)

    BATTLE_LA_WORKER.sonSure = m.sure | 0;
    BATTLE_LA_WORKER.ortSure = BATTLE_LA_WORKER.ortSure
        ? Math.round(BATTLE_LA_WORKER.ortSure * 0.7 + (m.sure | 0) * 0.3) : (m.sure | 0);
    BATTLE_LA_WORKER.ileri = battleLaWorkerPencere(BATTLE_LA_WORKER.ortSure);

    /* EMİRLER HEMEN DEĞİL, HEDEF TİKTE UYGULANIR.
       İşçi dünyayı `ileri` tik ileri sarıp ORADAN aradı; emir o ana aittir. Cevap
       genelde ERKEN döner (ölçüldü: tur ~1.4sn ≈ 28 tik, pencere ~49 tik). İlk sürüm
       emri geldiği anda uyguluyordu — yani GELECEĞE ait bir emri ŞİMDİ işliyordu; bu
       bayat emirden de kötüdür ve öngörü doğrulaması da anlamsızlaşıyordu (her cevap
       "geç kalan" sayılıyordu). Emir kuyruğa alınır, `battleLaWorkerTikUygula` onu
       hedef tikte indirir ve TAM O ANDA öngörü hash'ini doğrular. */
    BATTLE_LA_WORKER.bekleyenEmir = { emirler: m.emirler || [], ongoruHash: m.ongoruHash || null };
    battleLaWorkerTikUygula();
}

/* HER TİKTE çağrılır (battleLookaheadTick'in başından). Vakti gelen işçi emirlerini
   indirir. Ayrı fonksiyon olmasının sebebi: `battleLaWorkerTur` yalnız arama periyodu
   tiklerinde çağrılıyor, oysa hedef tik periyoda denk gelmeyebilir. */
function battleLaWorkerTikUygula() {
    var w = BATTLE_LA_WORKER;
    if (!w.bekleyenEmir) return;
    if (typeof SIM === 'undefined' || SIM.tick < w.hedefTik) return;   // vakti gelmedi

    var paket = w.bekleyenEmir;
    w.bekleyenEmir = null;

    /* ÖNGÖRÜ DOĞRULAMASI — köprünün en önemli satırı. Emir, işçinin öngördüğü duruma
       göre hesaplandı; gerçekten o duruma mı indi? Tutmazsa emir YİNE uygulanır (kötü
       emir emirsizlikten iyi olabilir) ama SAYILIR. AI-vs-AI'da sıfır olmalı; oyuncu
       o pencerede oynarsa artar — köprü bunu tahmin etmez, ölçer. */
    if (paket.ongoruHash && typeof battleStateHash === 'function') {
        if (SIM.tick === w.hedefTik) {
            if (battleStateHash() !== paket.ongoruHash) w.sapma++;
        } else {
            w.gecKalan++;      // hedef tik kaçırıldı (cevap çok geç geldi) — pencere büyüyecek
        }
    }
    var em = paket.emirler;
    for (var i = 0; i < em.length; i++) {
        var uid = em[i].uid;
        var u = SIM.units.find(function (x) { return x.id === uid; });
        if (!u || u.dead) continue;
        if (u.controlOwner === 'PLAYER') continue;    // oyuncunun birimine ASLA dokunma
        // `kayit=true` → 'lookahead-order' olarak replay'e yazılır (sözleşme korunur)
        battleLookaheadEmirVer(uid, { x: em[i].x, y: em[i].y }, true);
        w.emir++;
    }
}

/* Arama turunda `battleLookaheadTick` yerine BU çağrılır. Dönüş `true` ise tur işçiye
   devredildi ve ana iş parçacığı arama YAPMAZ. */
function battleLaWorkerTur(now) {
    if (!BATTLE_LA_WORKER.acik) return false;     // köprü yok/başarısız → ana iplik devralsın
    /* ISINMA: işçi kuruluyor (zinciri yükleyip oturumu açıyor, birkaç saniye). Bu turu
       ANA İPLİK ÜSTLENMEMELİ — ölçüldü: maç başındaki tek kare 5343ms sürüyordu, yani
       worker'lı kurulum donmayı ÇÖZMEK yerine maç başına yığıyordu. Bir-iki arama turunu
       atlamak, oyunu 5 saniye dondurmaktan iyidir. */
    if (!BATTLE_LA_WORKER.hazir) { BATTLE_LA_WORKER.isinmaAtlanan++; return true; }
    if (BATTLE_LA_WORKER.bekleyen) return true;   // hâlâ çalışıyor: tur ATLANIR (ikinci istek yığmaz)
    var fork;
    try {
        var g = (typeof BATTLE_SIM_GOLGE !== 'undefined') ? BATTLE_SIM_GOLGE : false;
        if (typeof BATTLE_SIM_GOLGE !== 'undefined') BATTLE_SIM_GOLGE = true;
        fork = JSON.stringify(battleForkCapture());
        if (typeof BATTLE_SIM_GOLGE !== 'undefined') BATTLE_SIM_GOLGE = g;
    } catch (e) {
        BATTLE_LA_WORKER.hata++;
        return false;                              // fork alınamadı → ana iş parçacığı devralsın
    }
    BATTLE_LA_WORKER.sonId++;
    BATTLE_LA_WORKER.bekleyen = 1;
    BATTLE_LA_WORKER.tur++;
    BATTLE_LA_WORKER.gonderTik = SIM.tick;
    BATTLE_LA_WORKER.hedefTik = SIM.tick + BATTLE_LA_WORKER.ileri;
    BATTLE_LA_WORKER.isci.postMessage({
        tip: 'ara', id: BATTLE_LA_WORKER.sonId, fork: fork, now: now,
        ayar: battleLaWorkerAyarTopla(),
        ileri: BATTLE_LA_WORKER.ileri,
        kirmizi: (typeof BATTLE_LOOKAHEAD_RED !== 'undefined') && BATTLE_LOOKAHEAD_RED === true,
        mavi: (typeof BATTLE_LOOKAHEAD_BLUE !== 'undefined') && BATTLE_LOOKAHEAD_BLUE === true,
        koruma: (typeof BATTLE_LA_EMIR_KORUMA !== 'undefined') ? (BATTLE_LA_EMIR_KORUMA | 0) : 0
    });
    return true;
}

/* AI AYAR YUZEYI — fork bunlari TASIMAZ ama davranisi belirlerler. Liste
   js/lookahead-worker.js icindeki LA_W_AYAR_ANAHTAR ile AYNI olmali; kaymasi
   "isci farkli beyinle kosuyor" kusurunu geri getirir (bir kez yasandi). */
var BATTLE_LA_AYAR_ANAHTAR = [
    'BATTLE_INTEL4_RED', 'BATTLE_INTEL4_BLUE', 'BATTLE_INTEL4PRO_RED', 'BATTLE_INTEL4PRO_BLUE',
    'BATTLE_POSTURE_GATE', 'BATTLE_SECTOR_COMMAND', 'BATTLE_SECTOR_COMMAND_RED', 'BATTLE_SECTOR_COMMAND_BLUE',
    'BATTLE_BEONAI_RED', 'BATTLE_BEONAI_BLUE', 'BATTLE_EXPLOITER_RED', 'BATTLE_EXPLOITER_BLUE',
    'BATTLE_FORCE_DOCTRINE', 'BATTLE_JAM_PARTIAL', 'BATTLE_JAM_RECON', 'BATTLE_SPAWN_LOADED',
    'BATTLE_KAPMA_TEHLIKE', 'BATTLE_ISTIHKAM_US', 'BATTLE_LA_EMIR_KORUMA',
    'LA_PERIYOT_TIK', 'LA_YARICAP', 'LA_AG_ADAY', 'LA_AG_ESIK',
    'LA_RAKIP', 'LA_SIRALI', 'LA_CIFT_YON', 'LA_HIZLI_YOL', 'LA_DEGER_AGI', 'LA_AG_MIN_TIK',
    'LA_POLITIKA', 'LA_EMIR_SURESI', 'LA_KANAL_AGIRLIK'
];
function battleLaWorkerAyarTopla() {
    var o = {};
    for (var i = 0; i < BATTLE_LA_AYAR_ANAHTAR.length; i++) {
        var k = BATTLE_LA_AYAR_ANAHTAR[i];
        try {
            var v = eval('typeof ' + k + ' === "undefined" ? undefined : ' + k);
            if (v !== undefined) o[k] = v;
        } catch (e) {}
    }
    return o;
}

function battleLaWorkerDurum() {
    var w = BATTLE_LA_WORKER;
    return { acik: w.acik, hazir: w.hazir, tur: w.tur, emir: w.emir, sapma: w.sapma,
        gecKalan: w.gecKalan, hata: w.hata, isinmaAtlanan: w.isinmaAtlanan,
        ortSureMs: w.ortSure, pencereTik: w.ileri };
}

if (typeof module !== 'undefined') {
    module.exports = { battleLaWorkerKur, battleLaWorkerKapat, battleLaWorkerTur,
        battleLaWorkerTikUygula, battleLaWorkerDurum };
}
