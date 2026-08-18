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
    tur: 0, emir: 0, sapma: 0, gecKalan: 0, hata: 0,
    sonSure: 0, ortSure: 0
};

/* ÖNGÖRÜ PENCERESİ: işçinin bir tur ne kadar sürdüğü makineye göre değişir. Sabit
   vermek yerine ÖLÇÜLENDEN türetilir — yavaş makinede pencere büyür, hızlıda küçülür.
   20 tik = 1sn tampon; alt sınır 40 tik (2sn), üst sınır 200 tik (10sn). */
function battleLaWorkerPencere(sureMs) {
    var tik = Math.ceil((sureMs || 0) / (typeof BATTLE_TICK_MS !== 'undefined' ? BATTLE_TICK_MS : 50)) + 20;
    return Math.max(40, Math.min(200, tik));
}

function battleLaWorkerKur() {
    if (BATTLE_LA_WORKER.isci) return true;
    if (typeof Worker !== 'function') return false;                       // Worker yok
    if (typeof MP !== 'undefined' && MP && MP.active) return false;       // MP: lockstep, açılmaz
    try {
        var w = new Worker('js/lookahead-worker.js');
        w.onmessage = function (ev) { battleLaWorkerMesaj(ev.data || {}); };
        w.onerror = function (e) {
            BATTLE_LA_WORKER.hata++;
            BATTLE_LA_WORKER.acik = false;
            console.warn('[arama-worker] hata, köprü kapatıldı:', e && e.message);
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

    /* ÖNGÖRÜ DOĞRULAMASI — köprünün en önemli satırı. Emir, işçinin öngördüğü duruma
       göre hesaplandı; gerçekten o duruma mı indi? Hash tutmazsa emir yine uygulanır
       (kötü emir, emirsizlikten iyi olabilir) ama SAYILIR. Sapma sürekliyse öngörü
       penceresi yanlıştır ya da oyuncu araya giriyordur — ikisi de görünür olmalı. */
    if (m.ongoruHash && typeof battleStateHash === 'function' && SIM.tick === BATTLE_LA_WORKER.hedefTik) {
        if (battleStateHash() !== m.ongoruHash) BATTLE_LA_WORKER.sapma++;
    } else if (SIM.tick !== BATTLE_LA_WORKER.hedefTik) {
        BATTLE_LA_WORKER.gecKalan++;    // cevap penceresi kaçırdı (pencere büyüyecek)
    }

    var em = m.emirler || [];
    for (var i = 0; i < em.length; i++) {
        var u = SIM.units.find(function (x) { return x.id === em[i].uid; });
        if (!u || u.dead) continue;
        if (u.controlOwner === 'PLAYER') continue;    // oyuncunun birimine ASLA dokunma
        // `kayit=true` → 'lookahead-order' olarak replay'e yazılır (sözleşme korunur)
        battleLookaheadEmirVer(em[i].uid, { x: em[i].x, y: em[i].y }, true);
        BATTLE_LA_WORKER.emir++;
    }
}

/* Arama turunda `battleLookaheadTick` yerine BU çağrılır. Dönüş `true` ise tur işçiye
   devredildi ve ana iş parçacığı arama YAPMAZ. */
function battleLaWorkerTur(now) {
    if (!BATTLE_LA_WORKER.acik || !BATTLE_LA_WORKER.hazir) return false;
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
    'LA_PERIYOT_TIK', 'LA_BIRIM', 'LA_TUR_BIRIM', 'LA_YARICAP', 'LA_AG_ADAY', 'LA_AG_ESIK',
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
        gecKalan: w.gecKalan, hata: w.hata, ortSureMs: w.ortSure, pencereTik: w.ileri };
}

if (typeof module !== 'undefined') {
    module.exports = { battleLaWorkerKur, battleLaWorkerKapat, battleLaWorkerTur, battleLaWorkerDurum };
}
