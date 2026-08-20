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
    bekleyenTik: 0,       // isteğin gönderildiği tik (bekçi bunu kullanır)
    ustUsteHata: 0,       // arka arkaya cevapsız/başarısız tur
    dusen: 0,             // bekçinin iptal ettiği tur
    isciAyar: null,       // işçinin GERÇEKTEN kullandığı LA_* (ana ipliğinki DEĞİL)
    /* ÖNGÖRÜ SAPMA BÜYÜKLÜĞÜ (hash DEĞİL). hash tam-eşitlik arar ve insan oynarken
       neredeyse hep tutmaz; asıl soru KAÇ PİKSEL saptığıdır. */
    sapmaOlcum: 0,        // kaç turda büyüklük ölçülebildi
    sapmaPxTop: 0,        // ortalama birim konum hatası toplamı (px)
    sapmaPxEnKotu: 0,     // en kötü turdaki ortalama hata
    sapmaBirimTop: 0,     // 'ciddi sapan' birim oranı toplamı (>100px)
    sapmaKayipTop: 0,     // öngörüde olup gerçekte olmayan (ya da tersi) birim oranı
    aranan: 0, atlanan: 0,// tur başına rollout koşulan / yayılım kapısına takılan birim
    bosTur: 0,            // işçi cevapladı ama HİÇ emir yok (sessiz başarısızlık göstergesi)
    hizasiz: 0,           // işçi karar anına hizalayamadı (olmamalı)
    tur: 0, emir: 0, sapma: 0, gecKalan: 0, hata: 0, isinmaAtlanan: 0,
    /* SABIR: bir istek en fazla kaç tik bekletilir. İşçi turu ölçülen ~1.4-4.3sn
       (28-86 tik); 400 tik (20sn) bunun çok üstünde, yani yavaş makinede yanlış
       alarm vermez ama ölü işçiyi de maç boyu taşımaz. */
    sabirTik: 400, sabirTur: 3,
    sonSure: 0, ortSure: 0
};

/* ÖNGÖRÜ PENCERESİ: işçinin bir tur ne kadar sürdüğü makineye göre değişir. Sabit
   vermek yerine ÖLÇÜLENDEN türetilir — yavaş makinede pencere büyür, hızlıda küçülür.
   20 tik = 1sn tampon; alt sınır 40 tik (2sn), üst sınır 200 tik (10sn). */
function battleLaWorkerPencere(sureMs) {
    var tik = Math.ceil((sureMs || 0) / (typeof BATTLE_TICK_MS !== 'undefined' ? BATTLE_TICK_MS : 50)) + 20;
    tik = Math.max(40, Math.min(200, tik));
    /* KARAR ANINA HİZALA: arama yalnız `LA_PERIYOT_TIK` katlarında karar veriyor.
       Hizasız pencere → işçi boş dönüyor (bkz. js/lookahead-worker.js'teki kusur notu).
       İşçi bunu ayrıca kendi düzeltiyor; burada da hizalamak, gönderilen değerin
       gerçekte kullanılanla aynı olmasını sağlar (sayaçlar yanıltmasın). */
    var periyot = (typeof LA_PERIYOT_TIK !== 'undefined' && LA_PERIYOT_TIK > 0) ? LA_PERIYOT_TIK : 100;
    return Math.ceil(tik / periyot) * periyot;
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

/* ⚠ SAYAÇLARI MAÇ BAŞINDA SIFIRLA — YOKSA OTURUM BOYUNCA BİRİKİR.
   KUSUR (kullanıcının 4 gerçek maçında bulundu, 2026-08-19): işçi köprüsü aynı sayfada
   arka arkaya oynanan maçlarda kapanmıyor, sayaçlar sıfırlanmıyordu. Telemetriye yazılan
   `aramaWorker.emir` 4 maçta 169 / 279 / 369 / 463 göründü; oysa maç başına GERÇEK sayı
   169 / 110 / 90 / 94 idi (farklar `lookahead-order` olay sayısıyla BİREBİR eşleşti).
   Yani rapor 5 kata kadar şişikti ve "işçi emirlerinin çoğu replay'e yazılmıyor" gibi
   YANLIŞ bir motor kusuru şüphesi doğurdu. Motorda kusur YOKTU; alet yanlış sayıyordu.
   `tur`, `sapma`, `bosTur`, `aranan`, `atlanan` da aynı şekilde birikiyordu. */
function battleLaWorkerSayaclariSifirla() {
    var w = BATTLE_LA_WORKER;
    w.tur = 0; w.emir = 0; w.sapma = 0; w.gecKalan = 0; w.hata = 0;
    w.isinmaAtlanan = 0; w.dusen = 0; w.ustUsteHata = 0; w.bosTur = 0; w.hizasiz = 0;
    w.aranan = 0; w.atlanan = 0; w.ortSure = 0; w.sonSure = 0;
    w.ileri = 100;        // öngörü penceresi de taze başlar (ortSure sıfırlandı)
    w.bekleyenEmir = null; w.bekleyen = 0;   // önceki maçtan sarkan istek/emir kalmasın
    w.sapmaOlcum = 0; w.sapmaPxTop = 0; w.sapmaPxEnKotu = 0; w.sapmaBirimTop = 0; w.sapmaKayipTop = 0;
}

/* `yeniMac` AÇIKÇA verilir. Sıfırlamayı koşulsuz yapmak yanlış olurdu: köprü maç
   ORTASINDA bir hatadan sonra yeniden kurulabilir ve o zaman `hata`/`dusen` sayaçlarını
   silmek, kusuru raporun gözünden kaçırırdı. Yalnız `startBattle` yolu true geçer. */
function battleLaWorkerKur(yeniMac) {
    if (yeniMac === true) battleLaWorkerSayaclariSifirla();
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
    BATTLE_LA_WORKER.ustUsteHata = 0;                 // cevap geldi: bekçi sayacı sıfırlanır
    if (m.id !== BATTLE_LA_WORKER.sonId) return;      // bayat cevap (yeni tur başlamış)

    /* İŞÇİNİN KULLANDIĞI GERÇEK İLERİ SARMA — köprününki değil. İşçi pencereyi karar
       anına (LA_PERIYOT_TIK katı) hizalıyor; hedef tik ona göre hesaplanmazsa emirler
       yanlış tikte iner ve öngörü doğrulaması anlamsızlaşır. */
    if (m.gercekIleri != null) {
        BATTLE_LA_WORKER.ileri = m.gercekIleri | 0;
        BATTLE_LA_WORKER.hedefTik = BATTLE_LA_WORKER.gonderTik + (m.gercekIleri | 0);
    }
    if (m.kararAni === false) BATTLE_LA_WORKER.hizasiz++;
    if (m.ayarKullanilan) BATTLE_LA_WORKER.isciAyar = m.ayarKullanilan;
    if (m.aranan != null) BATTLE_LA_WORKER.aranan += m.aranan | 0;
    if (m.atlanan != null) BATTLE_LA_WORKER.atlanan += m.atlanan | 0;
    /* BOŞ TUR: işçi cevapladı ama emir yok. Birkaç boş tur normaldir (arama "yerinde kal"
       diyebilir); SÜREKLİ boş tur, aramanın hiç koşmadığının işaretidir — kullanıcının
       maçında tam bu oldu ve hiçbir sayaç kırmızı yanmıyordu. */
    if (!(m.emirler || []).length) BATTLE_LA_WORKER.bosTur++;

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
    /* ⚠ ongoruBirim'i de TASI: isci gonderiyordu ama pakete konmuyordu ve buyukluk
       olcumu sessizce hic kosmuyordu (sapmaOlcum 0). Olcum "0px" diye YANLIS bir rakam
       basmadi, "hic olculmedi" dedi — bu yuzden yakalandi. */
    BATTLE_LA_WORKER.bekleyenEmir = { emirler: m.emirler || [], ongoruHash: m.ongoruHash || null,
        ongoruBirim: m.ongoruBirim || null };
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
            /* ── BÜYÜKLÜK ÖLÇÜMÜ ──────────────────────────────────────────────
               `sapma` yalnız "birebir aynı mı" der. İnsan oynarken bu hep hayırdır ve
               tek başına yanıltıcıdır (bu hata bir kez yapıldı: 52/54'ten "öngörü hiç
               tutmuyor" sonucu çıkarıldı). Asıl ölçü: öngörülen konumlarla gerçek
               konumlar arasındaki ORTALAMA HATA ve ciddi sapan birim oranı. */
            if (paket.ongoruBirim && paket.ongoruBirim.length) {
                var gercek = new Map();
                for (var gi = 0; gi < SIM.units.length; gi++) {
                    var gu = SIM.units[gi];
                    if (!gu.dead) gercek.set(gu.id, gu);
                }
                var top = 0, n = 0, ciddi = 0, kayip = 0;
                for (var pi = 0; pi < paket.ongoruBirim.length; pi++) {
                    var e = paket.ongoruBirim[pi];
                    var u2 = gercek.get(e[0]);
                    if (!u2) { kayip++; continue; }          // öngörüde sağ, gerçekte ölmüş
                    var dd = Math.hypot(u2.x - e[1], u2.y - e[2]);
                    top += dd; n++;
                    if (dd > 100) ciddi++;
                }
                if (n) {
                    var ortHata = top / n;
                    w.sapmaOlcum++;
                    w.sapmaPxTop += ortHata;
                    if (ortHata > w.sapmaPxEnKotu) w.sapmaPxEnKotu = ortHata;
                    w.sapmaBirimTop += ciddi / n;
                    w.sapmaKayipTop += kayip / paket.ongoruBirim.length;
                }
            }
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
    if (BATTLE_LA_WORKER.bekleyen) {
        /* ── BEKÇİ ──────────────────────────────────────────────────────────
           KUSUR (kullanıcının gerçek maçında görüldü, 2026-08-18): işçi TEK tur
           cevapladı (tik 219, 6 emir) ve sonra sustu. `bekleyen` bir daha sıfırlanmadı,
           köprü 4440 tik boyunca her turu "hâlâ çalışıyor" diye ATLADI ve maçı baştan
           sona düz intel4 sürdü. Donma çözülmüştü ama ARAMA DA YOKTU — en kötü sessiz
           başarısızlık türü: her şey çalışıyor gibi görünüyor.
           Tek bir kayıp cevap aramayı MAÇ BOYU kapatamamalı. */
        if (SIM.tick - BATTLE_LA_WORKER.bekleyenTik > BATTLE_LA_WORKER.sabirTik) {
            BATTLE_LA_WORKER.bekleyen = 0;
            BATTLE_LA_WORKER.dusen++;
            BATTLE_LA_WORKER.ustUsteHata++;
            BATTLE_LA_WORKER.bekleyenEmir = null;
            /* ART ARDA başarısızlık → köprüyü kapat, ana iplik devralsın. Kısılmış ayarla
               arama, aramasızlıktan iyidir; sessizce arama-yok durumunda kalmaktan da. */
            if (BATTLE_LA_WORKER.ustUsteHata >= BATTLE_LA_WORKER.sabirTur) {
                console.warn('[arama-worker] ' + BATTLE_LA_WORKER.ustUsteHata +
                    ' tur üst üste cevapsız → köprü kapatıldı, arama ana iplikte sürüyor');
                battleLaWorkerKapat();
                return false;      // bu turu ANA İPLİK yapsın
            }
            return false;          // tek seferlik kayıp: bu turu ana iplik üstlensin
        }
        return true;   // hâlâ makul süre içinde çalışıyor: tur ATLANIR (ikinci istek yığmaz)
    }
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
    BATTLE_LA_WORKER.bekleyenTik = SIM.tick;
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
    'BATTLE_KARSI_PLAN', 'BATTLE_KARSI_PLAN_GUVEN', 'BATTLE_KARSI_PLAN_KAPSAM', 'BATTLE_KARSI_PLAN_KAPAT', 'BATTLE_KARSI_PLAN_SURE',
    'BATTLE_TOPCU_ILERI', 'BATTLE_IKMAL_TAKIP',
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
        dusen: w.dusen, ustUsteHata: w.ustUsteHata, bosTur: w.bosTur, hizasiz: w.hizasiz,
        isciAyar: w.isciAyar, aranan: w.aranan, atlanan: w.atlanan,
        sapmaOlcum: w.sapmaOlcum,
        sapmaPxOrt: w.sapmaOlcum ? Math.round(w.sapmaPxTop / w.sapmaOlcum) : null,
        sapmaPxEnKotu: Math.round(w.sapmaPxEnKotu),
        sapmaCiddiPay: w.sapmaOlcum ? +(w.sapmaBirimTop / w.sapmaOlcum).toFixed(3) : null,
        sapmaKayipPay: w.sapmaOlcum ? +(w.sapmaKayipTop / w.sapmaOlcum).toFixed(3) : null,
        ortSureMs: w.ortSure, pencereTik: w.ileri };
}

if (typeof module !== 'undefined') {
    module.exports = { battleLaWorkerKur, battleLaWorkerKapat, battleLaWorkerTur,
        battleLaWorkerTikUygula, battleLaWorkerDurum };
}
