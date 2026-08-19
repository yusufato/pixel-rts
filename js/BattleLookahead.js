// ═══════════════════════════════════════════════════════════════════════════
//  İLERİ-BAKIŞ (LOOKAHEAD) — birime hamlesini OYNATARAK seçtirir
//
//  Kullanıcı fikri: "birimler geleceği görsün — A birimi 5sn/10sn sonra şu
//  noktalarda ne olur, cevabını verebilsin."
//
//  ÖLÇÜLMÜŞ TEMEL (tools/gelecek-yelpazesi.js, docs'ta commit geçmişi):
//    · aday nokta sayısı ~24'te doyuyor (+146 marj kazanç, t 3.0)
//    · dağılım AÇIYA değil MENZİLE yayılmalı (yön ikiye katlamak +2, halka +28)
//    · analitik ön eleme K=3'te kazancın %72'sini koruyor — ve BEDAVA
//      (1sn'lik ucuz rollout ile eleme yalnız %27 korur: mevzi değeri zamanla çıkar)
//    · maliyet: 24×~0 + 3×rollout
//
//  ─── MİMARİ KISIT ───
//  Kontrolör stepSim'İN İÇİNDE çalışır. Orada rollout yapmak stepSim'i kendi
//  içinde çağırmak olurdu: dış tikin döngüleri (SIM.units üzerinde gezinen
//  indeksler) fork/restore birimleri YENİDEN YARATTIĞI için bozulurdu.
//  Bu yüzden arama TİKLER ARASINDA çalışır: `battleLookaheadTick(now)` bir
//  tikin BİTİŞİYLE sonrakinin BAŞLANGICI arasında çağrılır.
//
//  ─── DETERMİNİZM ───
//  Arama fork alır, oynatır, GERİ YÜKLER. battleForkRestore rngState'i de geri
//  aldığı için dış simülasyon hiç etkilenmez; net etki yalnızca seçilen birime
//  verilen HAREKET EMRİdir. Emirler determinist bir sırayla üretilir (birim id,
//  aday sırası sabit; RNG yok) → replay/fork tekrar üretebilir.
//  ÖNKOŞUL: aynı fork'tan rollout'un tekrarlanabilir olması. Bu ayrı bir kapıyla
//  güvenceye alındı — tools/ileri-model-kapisi.js (27/27).
// ═══════════════════════════════════════════════════════════════════════════

// Teşhis sayaçları (hash DIŞI — simülasyona dokunmaz, yalnız ölçüm harness'i okur)
const BATTLE_LA_SAYAC = { atlanan: 0, arananan: 0, emir: 0, ileriKazandi: 0, geriKazandi: 0, ayniPlan: 0, farkliAmaEsitSkor: 0, agKullanildi: 0, marjKullanildi: 0, rakipYayilimTop: 0, rakipOlcum: 0, politikaKal: 0, politikaEmir: 0, kuyrukAtilan: 0, enKotuTikMs: 0, kademeElenen: 0 };

let BATTLE_LOOKAHEAD_RED = false;    // saldıran (kırmızı) ileri-bakış kullansın mı
let BATTLE_LOOKAHEAD_BLUE = false;

/* ── WORKER KİPİ: arama ana iş parçacığından ÇIKAR ────────────────────────
   Açıkken arama turu `js/lookahead-worker.js`'e devredilir ve ana iş parçacığı o tur
   hiç arama yapmaz. Kazanç: TAM ayar (ufuk 100 / derin 2) oynanabilir hâle gelir.
   Ölçülen gerekçe: tam ayar +735 (t 3.55, saptama tabanının üstünde) ama tur 2834ms —
   ana iş parçacığında koşarsa oyun donuyor (kullanıcı sahada gördü).

   Mimari ölçülerek doğrulandı (tools/worker-kapisi.js): emir eşitliği 3/3, öngörü
   eşitliği 3/3, negatif kontrol yakalıyor.

   ⚠ Varsayılan KAPALI: tarayıcıda uçtan uca sınanmadan açılmaz. `js/BattleWorkerKopru.js`
   yüklü değilse (ör. Node tezgâhı) kanca kendiliğinden atlanır. */
let BATTLE_LA_WORKER_KIP = false;

/* CANLI OYUNDA VARSAYILAN AÇIK.
   ÖLÇÜLDÜ (tools/rol-dengesi-paralel.js, n=128, eşleştirilmiş, tohum 100000+):
     aramasız  saldıran %37.5  marj −742
     arama     saldıran %49.2  marj  +97
     FARK +839, t 2.87  (saptama tabanı 819) → ANLAMLI
   Yani arama yalnız güçlendirmiyor, rol dengesini de %50'ye yaklaştırıyor.

   BÜTÇE: ağ ön süzgeciyle (LA_AG_ADAY=5) boş makinede 1.90× gerçek zaman ve arama
   YALNIZ AI birimlerinde koşar (oyuncunun birimleri süzgeçle dışarıda).
   Kare bütçesi aşılırsa `battleLookaheadTick` zaten periyodik (5sn'de bir).

   KAPALI TUTULACAK YERLER: replay (kayıt zaten emirleri taşıyor) ve çok-oyunculu
   (iki istemci bağımsız arama koşarsa lockstep sapar — ayrı karar). */
let BATTLE_LOOKAHEAD_LIVE = false;   // zorluk seciminden acilir (Screens.js QM_BEYIN.ongoru)

/* ARAMA PERİYODU. Dönüşüm denemesi (periyot sabit, BİRİM kıs) kazancı öldürdü
   (+191 t 0.47). Tersi denenmedi: birim sayısını KORU, periyodu UZAT. Kapsam tam
   kalır, maliyet zamana yayılır — canlı bütçe için tek kalan ucuz kaldıraç. */
let LA_PERIYOT_TIK = 100;     // kaç tikte bir arama (100 = 5sn)
let LA_BIRIM = 20;            // kapsam: ordunun tamamına yakını (A3)

/* ── TİKE YAYMA (canlı oyun donması) ──────────────────────────────────────
   KULLANICI RAPORU: "oyun her 5 saniyede bir 2-3 saniye donuyor."

   BENİM ÖLÇÜM HATAM: maliyeti "1.90× gerçek zaman" diye raporlamıştım. O sayı
   VERİM (60sn oyun / 31.6sn CPU). Ama oyunu donduran şey verim değil GECİKME:
   o 31.6sn'nin tamamı 12 turda, tur başına ~2.2sn'lik TEK BLOK hâlinde harcanıyor.
   Ortalama sığıyor, kare bütçesi patlıyor. Yol haritası bunu zaten yazmıştı
   ("karar başına iş dilimlenmeli") — okudum ve yine de blok hâlinde sevk ettim.

   ÇÖZÜM: turun birimleri KUYRUĞA alınır, her tik en fazla LA_TIK_BIRIM tanesi
   işlenir. Toplam iş ve kapsam AYNI kalır (20 birim, 5sn ufuk, 5sn periyot) —
   yalnız zamana yayılır. En kötü tek-tik maliyeti ~20 kat düşer.

   NEDEN TİK-BAZLI, DUVAR-SAATİ DEĞİL: "8ms dolana kadar işle" demek, kararları
   makine hızına bağlar → aynı tohum farklı makinede farklı oynar, ölçüm ve
   replay tekrar üretilemez olur. Tik-bazlı dilim determinist kalır.

   YAN ETKİ (bilinçli): birimler artık aynı ANDA değil, sırayla birkaç tik arayla
   karar veriyor. Sıralı taahhüt zaten bunu yapıyordu (her birim öncekinin emrini
   görüyordu); şimdi arada sim de ilerliyor, yani karar DAHA TAZE durumdan alınıyor.
   Ama bu, +839'un ölçüldüğü konfigürasyon DEĞİL → yeniden ölçülmeli.

   0 = yayma yok (tezgâh/ölçüm davranışı: tüm tur tek tikte). */
let LA_TIK_BIRIM = 0;
const BATTLE_LA_KUYRUK = [];   // bekleyen kararlar: {uid, isRed}
/* ── DÖNÜŞÜMLÜ ARAMA (canlı bütçe) ──
   ÖLÇÜLDÜ: kısa ufuk kazancı ÖLDÜRÜYOR (1sn ufuk +33 t 0.08 vs 5sn +1369 t 3.15).
   Yani bütçe UFUKTAN kısılamaz — kazanç gerçekten 5 saniye simüle etmekten geliyor.
   Kalan tek kaldıraç: her turda AZ birim ara, turlar arasında SIRAYLA dolaş.
   Kapsam zamana yayılır; anlık maliyet TUR_BIRIM/LA_BIRIM oranında düşer.
   Emir ömrü de uzatılmalı, yoksa birim sırası gelene kadar emirsiz kalır.
   0 = dönüşüm yok (tezgâh davranışı, kanıtlanmış konfigürasyon). */
let LA_TUR_BIRIM = 0;
/* YAYILIM KAPISI (bedava optimizasyon).
   ÖLÇÜLDÜ (tools/gelecek-yelpazesi.js): kararların %29'unda adaylar arası yayılım
   SIFIR — ne yaparsan yap sonuç aynı. Orada rollout saf israf. Analitik skorlar
   birbirine yakınsa karar önemsizdir; aramayı hiç başlatma.
   Eşik "düşman değeri" biriminde (analitik skorla aynı ölçek). */
const LA_YAYILIM_ESIK = 100;
/* Kapının SIKILIĞI dışarıdan ayarlanır (A/B). 1 = mevcut. Bkz. battleLookaheadEleVeKapi. */
let LA_KAPI_CARPAN = 1;
let LA_AG_KAPI = true;        // kapı ağ skoruna baksın (analitikten isabetli)
/* AĞ EŞİĞİ VERİDEN TÜRETİLDİ. İlk denemede 120 koydum ve kapı kararların %99.3'ünü
   kesti. Sebep öğretici: ağ TÜM MAÇIN sonucunu tahmin ediyor; tek bir birimi 600px
   oynatmak o tahmini çok az değiştiriyor. Yani ağ farkları analitik farklardan ~30 kat
   küçük — aynı ölçekte eşik koymak hatalıydı.
   ÖLÇÜLEN DAĞILIM (250 karar):
     ağ       p10 9.2 · medyan 18.5 · p75 34.9 · p90 55.8
     analitik p10 22  · medyan 551  · p75 1931 · p90 2914
   15 ≈ p40 → kararların ~%40'ı atlanır (analitik kapının %27'sinden fazla). */
const LA_AG_ESIK = 15;
/* AĞ ÖN SÜZGECİ: değer ağına kaç adayın sorulacağı (analitik olarak en iyi N).
   0 = hepsi (eski davranış, canlı bütçeye SIĞMIYOR — ölçüm battleLookaheadEleVeKapi'de).
   5, ölçülmüş "analitik ön eleme K=3 kazancın %72'sini korur" bulgusundan cömert seçildi. */
let LA_AG_ADAY = 5;
/* ⚠ Su uc deger `const` idi; A/B tezgahi onlari degistiremiyordu ve bir kapi acilsa
   "fark yok" diye SAHTE bir sonuc verirdi (iki kol da ayni degeri kosardi). `let`
   yapildi — davranis degismedi, yalnizca olculebilir hale geldiler. Tezgah artik
   kolun uygulandigini geri okuyup dogruluyor (tools/rol-dengesi.js). */
let LA_YON = 8;             // aday yönü
let LA_HALKA = 3;           // aday halkası (MENZİL çeşitliliği — ölçümde asıl kaldıraç)
let LA_YARICAP = 600;       // en dış halka
let LA_DERIN = 2;             // elemeden sonra GERÇEKTEN oynatılan aday (3→2: bütçe kapsama gitti)
/* ROLLOUT UFKU. Değer ağı zaten "bu durumdan maçın sonu ne" diye tahmin ettiği için
   ufkun UZUN olması gerekmez — kısa rollout birimi yola çıkarır, gerisini ağ söyler.
   (AlphaZero'da yaprak doğrudan değer ağıyla puanlanır, rollout yoktur.)
   A1 denemesi hiç-rollout'u sınadı ve düştü: ışınlanmış birim yürüyen birimle aynı
   değil. Kısa rollout ikisinin arası. Canlı oyun bütçesi için kritik: 5sn ufuk
   106ms, 1sn ufuk ~21ms. */
/* ARAMA HAVA BİRİMLERİNİ DE KAPSASIN MI (A/B kolu, varsayılan KAPALI).
   Gerekçe ve kamikaze istisnası için yukarıdaki süzgeç açıklamasına bak. */
let BATTLE_LA_HAVA = false;
/* KADEMELİ ELEME — bkz. battleLookaheadBirimKarari içindeki uzun açıklama.
   LA_KADEME = 0 -> kapalı (davranış birebir eski). >0 ise ön eleme rollout'unun tik sayısı.
   LA_KADEME_KALAN = tam ufka çıkacak finalist sayısı ("yerinde kal" hep yer alır). */
let LA_KADEME = 0;
let LA_KADEME_KALAN = 2;

let LA_UFUK = 100;            // rollout ufku (tik) — 100 = 5sn
let LA_EMIR_SURESI = 120;     // verilen emir kaç tik korunur (AI onu hemen ezmesin)
   /* dönüşümde emir ömrü, birimin sırasının tekrar gelmesine kadar yetmeli */

/* ── ORTAK KARAR: SIRALI TAAHHÜT (kullanıcı 2026-08-17) ──
   Kusur: beş birimin beşi de AYNI başlangıç durumuna bakıp karar veriyordu, sonra
   beş emir birden uygulanıyordu. Yani B, A'nın az önce aldığı kararı GÖRMÜYOR —
   A'nın eski davranışını varsayıyordu.

   TAM ÇAPRAZLAMA İMKÂNSIZ: 20 birim × 25 aday = 25^20 ≈ 10^28 kombinasyon.
   SIRALI TAAHHÜT bunun büyük kısmını DOĞRUSAL maliyetle alır:
     A'nın kararını ver → dünyaya İŞLE → B artık A'nın GERÇEK hamlesini görerek karar verir → ...
   Maliyet değişmez (aynı sayıda rollout), yalnız sıra değişir.

   Emir birime uygulandığı için sonraki birimin fork'u onu İÇİNDE taşır: fork,
   emir verildikten SONRA alınır. */
let LA_SIRALI = true;

/* ── ÇİFT YÖNLÜ SIRA (kullanıcı 2026-08-17: "hem A'dan hem son birimden başlasın") ──
   Sıralı taahhüdün zayıflığı: SIRA KEYFÎ. İlk karar veren birim diğerlerinden habersiz,
   son karar veren hepsini görüyor. Yani ortak plan, birimleri hangi sırayla sorduğumuza
   bağlı — ve hangi sıranın doğru olduğunu bilmiyoruz.
   ÇÖZÜM: iki sırayı da dene (değerliden ucuza, ucuzdan değerliye), ortaya çıkan İKİ
   ORTAK PLANI da oynat, iyisini uygula. Keyfîlik ölçüyle değiştirilmiş olur.
   Maliyet ~2.1x (iki geçiş + iki ortak-plan değerlendirmesi). */
/* ÖLÇÜLDÜ VE KAPATILDI: ters sıra 12 turun HİÇBİRİNDE kazanmadı, planların %90'ı
   zaten aynıydı. Maliyeti 2× — o bütçe KAPSAMA harcanınca 5 birim yerine 20 birim
   aranabiliyor. Mekanizma silinmedi, bayraklı duruyor. */
let LA_CIFT_YON = false;

/* Tek-sıra hızlı yolu. Yalnız DOĞRULAMA için kapatılabilir: kapalıyken eski
   (fork + atılan plan-rollout) yolu koşar. İkisinin AYNI sonucu vermesi gerekir;
   bu bayrak o eşitliği ölçülebilir kılar — "davranış aynı" demek yetmez. */
let LA_HIZLI_YOL = true;

/* ── DEĞER AĞI HEDEFİ (2026-08-17) ──
   ÖLÇÜLDÜ: argmax(marj@10sn) KARARSIZ bir hedef — 20sn'de kazancın %13'ü kalıyor.
   Elle yazılmış sekiz alternatif ölçü de global marjı geçemedi (%48 tavan).
   Değer ağı 10 saniyelik PENCEREYİ değil NİHAİ marjı tahmin eder (rho 0.864).
   Rollout artık "10sn sonra marj ne oldu" diye değil, "10sn sonraki DURUMDAN
   maçın sonu ne görünüyor" diye puanlanır.

   ERKEN OYUN KAPISI: ağın kendi doğruluğu zamana bağlı — 0-30sn'de rho 0.389,
   70sn+ 0.887. İlk saniyelerde ağa güvenmek gürültüyü hedef sanmak olur;
   o pencerede eski marj-deltası kullanılır. */
let LA_DEGER_AGI = true;

/* ── ÇOK KANALLI PUANLAMA (kullanıcı isteği) ────────────────────────────────
   SORUN: rollout TEK SAYIYLA puanlanıyor (değer ağı → nihai marj). Ödül defteri
   kurulurken ölçülmüştü: tek getiri lensi ÜÇ KEZ yanılttı. En net örnek topçu —
   imha lensinde getirisi ×0.04 ("işe yaramaz") ama ürünü imha değil BASKI (415.6).

   AĞIRLIKLAR ELLE VERİLMEDİ: bu projede sekiz elle yazılmış hedef ölçüsü denendi ve
   hiçbiri global marjı geçemedi. Ağırlıklar `tools/kredi-agirlik.py` ile 1600 maçtan
   türetildi (ridge, maç-bazlı ayrık test).

   ⚠ İKİ ÖLÇÜLMÜŞ UYARI — bu kip AÇILMADAN ÖNCE okunmalı:

   1) TOTOLOJİ. Ham regresyonda R² 0.930 çıkıyor ama bu sahte: `imhaDeger − emilen`
      zaten marjın TANIMI. Onlar skordan ÇIKARILDI (değer ağı onları zaten sayıyor;
      eklemek çift sayma olurdu). Kalan kanalların EK katkısı yalnız +0.0415 R².

   2) `baski` AĞIRLIĞI ~SIFIR (+0.0001). Yani maç düzeyinde baskının artık değeri YOK —
      çünkü maç bitene kadar değeri zaten marja dönüşmüş oluyor. AMA aramanın penceresi
      5 SANİYE; o pencerede baskı henüz marja dönüşmemiştir. Maç düzeyindeki regresyon
      bu soruyu GÖREMEZ. Yani buradaki ağırlık tablosu, tam da motive eden mekanizma
      için muhtemelen KÖR. Doğru alet, pencere-içi kredi akışını sonraki 30sn'lik marj
      değişimine bağlayan bir ölçüm olurdu — o veri henüz toplanmadı.

   Bazı katsayılar (kurtarma −53, panik −0.08) ters işaretli. Ortak-doğrusallık 0.95;
   tek tek işaretlere GÜVENİLMEZ. Elle düzeltilmedi — düzeltmek ölçümü kanıya çevirirdi.

   KARAR YERİ: yalnız maç kapısı (rol-dengesi-paralel --kol BATTLE_LA_KANAL). */
let BATTLE_LA_KANAL = false;      // ÖLÇÜLMEDİ → varsayılan KAPALI
const LA_KANAL_AGIRLIK = {        // TL/birim, tools/kredi-agirlik.py artık modeli (R² 0.299)
    iyilestirme: 0.9600, panik: -0.0787, muhimmat: 2.3615, mayin: 29.9592,
    kurtarma: -53.2304, yakitDolum: 0.1340, rally: 90.9107, haleTik: 0.0016,
    kuruEngel: 6.1189, jamTik: -0.0035, tasinan: 1.4994, baski: 0.0001
};

/* ── BİRİME KENDİNİ TANIT (kullanıcı isteği) ────────────────────────────────
   Kusur: aday, ORDUNUN TAMAMININ marjıyla puanlanıyor. Yani keşif aracı "şuraya
   gidersem ordunun marjı ne olur" diye soruyor — "GÖREVİMİ daha iyi yapar mıyım"
   diye değil. Tek bir birimin 600px oynaması global marjı zar zor kıpırdatır
   (ölçüldü: ağ farkları analitik farklardan ~30 kat küçük), yani rol katkısı
   gürültüde kayboluyor.

   Ödül defteri zaten "her birimin KENDİ işi ayrı sütun" diye kurulmuştu; burada o
   tasarım nihayet karara bağlanıyor: birimin KENDİ kanal üretimi, KENDİ rolünün
   kanallarıyla puanlanır. Topçu için baskı, keşif için görüş/tespit, istihkâm için
   siper/mayın/kapma, sağlıkçı için iyileştirme.

   ⚠ Bu ağırlıklar ROL EŞLEMESİDİR (hangi kanal kimin işi), BÜYÜKLÜK değil —
   büyüklük LA_KANAL_AGIRLIK'ten (veriden türetilmiş TL/birim) gelir. Yani elle
   verilen tek şey "kimin işi ne", ki o zaten birim tanımından okunan bir olgu.
   KARAR YERİ yine maç kapısı. */
let BATTLE_LA_ROL = false;        // ÖLÇÜLMEDİ → varsayılan KAPALI
let LA_ROL_CARPAN = 3.0;          // birimin KENDİ katkısı taraf-toplamına göre kaç kat sayılsın
const LA_ROL_KANAL = {
    artillery:   ['baski', 'panik'],
    mlrs:        ['baski', 'panik'],
    recon:       ['gorusTekil', 'tespit'],
    scout_vehicle: ['gorusTekil', 'tespit'],
    uav:         ['gorusTekil', 'tespit'],
    engineer:    ['siperTik', 'mayin', 'kapma'],
    medic:       ['iyilestirme', 'kurtarma'],
    supply:      ['muhimmat', 'yakitDolum', 'kuruEngel'],
    ew:          ['jamTik'],
    command:     ['haleTik', 'rally'],
    transport:   ['tasinan'],
    air_defense: ['havaCaydirma', 'havaHasar']
};

/* Birimin rol kanallarını bul. Önce UnitData'daki kategori/etiket, olmazsa tip adı.
   Eşleşme yoksa null → rol terimi o birim için hiç uygulanmaz (uydurma yapılmaz). */
function battleLaRolKanallari(u) {
    if (!u || typeof STATS === 'undefined') return null;
    const s = STATS[u.type]; if (!s) return null;
    const anahtarlar = [];
    if (s.id) anahtarlar.push(String(s.id));
    if (s.category) anahtarlar.push(String(s.category));
    for (const t of (s.roleTags || [])) anahtarlar.push(String(t));
    for (const a of anahtarlar) if (LA_ROL_KANAL[a]) return LA_ROL_KANAL[a];
    return null;
}

/* Birimin KENDİ kredi satırının anlık kopyası (yalnız rol kanalları). */
function battleLaRolTopla(uid, kanallar) {
    const t = {};
    for (const c of kanallar) t[c] = 0;
    if (typeof BATTLE_CREDIT === 'undefined' || !BATTLE_CREDIT.birim) return t;
    const b = BATTLE_CREDIT.birim[uid];
    if (b) for (const c of kanallar) t[c] = b[c] || 0;
    return t;
}
function battleLaRolSkor(uid, kanallar, oncesi) {
    const simdi = battleLaRolTopla(uid, kanallar);
    let s = 0;
    for (const c of kanallar) {
        const w = LA_KANAL_AGIRLIK[c];
        if (w == null) continue;   // veriden ağırlığı olmayan kanal (ör. ölü sütun) sayılmaz
        s += w * (simdi[c] - oncesi[c]);
    }
    return s * LA_ROL_CARPAN;
}

/* Defterin ANLIK toplamı (taraf başına). Fork bu defteri GERİ ALMAZ — bu yüzden
   çağıran, arama öncesi durumu saklayıp sonra geri yüklemek ZORUNDA; yoksa rollout'ta
   biriken kredi gerçek maçın defterine sızar ve telemetri çöpe döner. */
function battleLaKanalTopla(isRed) {
    const t = {};
    for (const c in LA_KANAL_AGIRLIK) t[c] = 0;
    if (typeof BATTLE_CREDIT === 'undefined' || !BATTLE_CREDIT.birim) return t;
    for (const id in BATTLE_CREDIT.birim) {
        const b = BATTLE_CREDIT.birim[id];
        if (!!b.isRed !== !!isRed) continue;
        for (const c in LA_KANAL_AGIRLIK) t[c] += (b[c] || 0);
    }
    return t;
}
function battleLaKanalSkor(oncesiK, oncesiM, isRed) {
    const k = battleLaKanalTopla(true), m = battleLaKanalTopla(false);
    let s = 0;
    for (const c in LA_KANAL_AGIRLIK) {
        const dK = (k[c] - oncesiK[c]), dM = (m[c] - oncesiM[c]);
        s += LA_KANAL_AGIRLIK[c] * (isRed ? (dK - dM) : (dM - dK));
    }
    return s;
}
/* Defteri derin kopyala / geri yükle (fork kapsamı dışında olduğu için elle). */
function battleLaKrediSakla() {
    if (typeof BATTLE_CREDIT === 'undefined') return null;
    const kop = {};
    for (const id in BATTLE_CREDIT.birim) kop[id] = Object.assign({}, BATTLE_CREDIT.birim[id]);
    return { on: BATTLE_CREDIT.on, birim: kop };
}
function battleLaKrediGeriYukle(sakli) {
    if (!sakli || typeof BATTLE_CREDIT === 'undefined') return;
    BATTLE_CREDIT.on = sakli.on;
    BATTLE_CREDIT.birim = sakli.birim;
}

/* ── POLİTİKA KİPİ (R1: damıtma) ────────────────────────────────────────────
   0 = kapalı (tam arama)
   1 = POLİTİKA TEK BAŞINA — rollout YOK, birim başına tek CNN geçişi.

   Neden bu kip var: kanıtlanmış kazanç (+1262, n=96, t 4.3) ~1 CPU-sn/oyun-sn
   harcıyor ve ucuzlatmanın DÖRT yolu da ölçüldü ve öldü (1sn ufuk +33 · dönüşüm
   +191 · uzun periyot +153 · ışınlama vasat). Kalan tek yol aramayı taklit eden
   bir ağ. Bu kip canlı oyuna sığan tek aday.

   ⚠ HENÜZ ÖLÇÜLMEDİ. Bu projede damıtma bir kez denendi ve GERİ ÇEKİLDİ (v2 klon,
   96 bağımsız maçta t −2.85). Farkı: o klon, tavanı ölçülüp ÇIKMAZ çıkmış bir
   seçiciyi taklit ediyordu; buradaki öğretmen kanıtlanmış üstün bir arama.
   Yine de sonuç VARSAYILMAZ — kapı tools/rol-dengesi.js. */
let LA_POLITIKA = 0;

/* ── RAKİP DE GELECEĞİ GÖRSÜN (kullanıcı 2026-08-17) ──
   Şu ana kadar her aday için TEK gelecek oynatıldı: "şuraya gidersem ve düşman
   HER ZAMANKİ GİBİ davranırsa ne olur". Eksik olan: düşman X yaparsa ne olur,
   Y yaparsa ne olur — ve ben EN KÖTÜ ihtimale göre mi seçmeliyim?

   RAKİP ÇEŞİTLENDİRME: düşman kontrolörünün yeniden-karar anını kaydırırız
   (0 / +20 / +40 tik). Aynı durumdan farklı anlarda plan yapan düşman farklı
   tepki verir. Determinist (RNG yok), ucuz, ve motor semantiğine dokunmaz.

   SEÇİM KURALI: EN KÖTÜ durum (minimax). Bir mevzi ancak düşmanın en iyi
   cevabına karşı da iyiyse gerçekten iyidir.

   MALİYET: aday × rakip-tepkisi. LA_RAKIP=3 ile üç kat.
   UYARI: çeşitlendirme GERÇEKTEN farklı gelecek üretmiyorsa bu üç kat BOŞA gider.
   Bu yüzden BATTLE_LA_SAYAC.rakipYayilim ile ölçülür — sıfırsa kapatılmalı. */
/* ÖLÇÜLDÜ VE KAPATILDI (48 tohum, eşleştirilmiş):
     yalnız değer ağı        marj +291  t 0.79   maliyet 1×
     + rakip modeli (3 tepki) marj +272  t 0.68   maliyet 2.7×
   Çeşitlendirme GERÇEKTİ (tepkiler arası yayılım 94 marj) ama en kötü duruma göre
   seçmek ölçülebilir kazanç getirmedi. 2.7 kat maliyet karşılıksız — ve o bütçe
   KAPSAMA (daha çok birim) harcanırsa ölçülmüş kaldıraç oradadır.
   Mekanizma SİLİNMEDİ: diğer eksenler geliştikten sonra tekrar denenebilir. */
let LA_RAKIP = 1;             // aday başına kaç düşman tepkisi (3 = minimax, ölçüldü: kazanç yok)
const LA_RAKIP_KAYMA = 20;    // tepkiler arası karar-anı kayması (tik)
const LA_AG_MIN_TIK = 600;    // 30sn — bundan önce ağ güvenilmez (rho 0.389)

/* ── KARAR DEFTERİ (R1: kendiyle oynama döngüsü) ──
   Arama, mevcut politikayı ölçülmüş biçimde yeniyor (+1262, n=96, t 4.3).
   AlphaZero'nun tüm motoru bu gözlemden ibarettir: arama > politika ise politikayı
   ARAMANIN ÇIKTISIYLA eğit. Bu defter o eğitim verisini toplar.
   Kayıt yalnız BATTLE_LA_KAYIT.on iken yapılır → normal oyunu HİÇ etkilemez. */
const BATTLE_LA_KAYIT = { on: false, buf: [], cap: 200000 };

/* SINIF = politika ağının çıktı uzayı: aday kafesindeki noktanın kimliği.
   0 = yerinde kal, sonra 1 + (halka-1)*LA_YON + yön.

   Sınıf, aday ÜRETİLİRKEN damgalanır (battleLookaheadAdaylar) — koordinattan geriye
   hesaplanmaz. Sebebi ölçülebilir: çift halkalar yarım sektör döndürülmüş
   (`+ Math.PI / LA_YON`), yani geri hesapta açı tam kova sınırına düşer ve
   yuvarlama yönü sınıfı kaydırır. Damgalama bunu tamamen ortadan kaldırır ve
   ters dönüşümü (sınıf → nokta) üreteç formülünün AYNISI yapar.

   Mutlak koordinat değil, birime GÖRE — böylece politika harita konumundan
   bağımsız bir manevra dili öğrenir. */
function battleLookaheadSinifSayisi() { return 1 + LA_HALKA * LA_YON; }

/* SINIF → NOKTA: üreteçle birebir aynı formül (politika ağı çıkarımında kullanılır). */
function battleLookaheadSinifNokta(u, sinif) {
    if (!u || !(sinif > 0) || sinif >= battleLookaheadSinifSayisi()) return { x: u.x, y: u.y };
    const h = Math.floor((sinif - 1) / LA_YON) + 1;
    const k = (sinif - 1) % LA_YON;
    const rr = LA_YARICAP * h / LA_HALKA;
    const a = (Math.PI * 2 * k) / LA_YON + (h % 2 ? 0 : Math.PI / LA_YON);
    return { x: u.x + Math.cos(a) * rr, y: u.y + Math.sin(a) * rr };
}

function battleLookaheadAcik(isRed) {
    return isRed ? BATTLE_LOOKAHEAD_RED === true : BATTLE_LOOKAHEAD_BLUE === true;
}

// ── ANALİTİK SKOR: adayı oynatmadan puanla (ölçümde 1sn'lik rollout'u 2.7× yendi) ──
// "Ben onları vurabiliyorum, onlar beni vuramıyor" geometrisi.
function battleLookaheadStatik(u, px, py) {
    const benim = STATS[u.type] ? (STATS[u.type].range || 0) : 0;
    let firsat = 0, maruz = 0, dost = 0;
    for (const o of SIM.units) {
        if (o.dead || o.loaded || o.abandoned) continue;
        const d = Math.hypot(o.x - px, o.y - py);
        const c = (STATS[o.type] && STATS[o.type].cost) || 0;
        if (o.isRed === u.isRed) { if (o.id !== u.id && d < 700) dost += c * (1 - d / 700); continue; }
        if (d <= benim) firsat += c;
        const onun = STATS[o.type] ? (STATS[o.type].range || 0) : 0;
        if (d <= onun) maruz += c;
    }
    return firsat - maruz * 2 + dost * 0.15;
}

/* ── AĞ-DOĞRUDAN SKOR (A1): adayı OYNATMADAN, ağa sorarak puanla ──
   Değer ağı zaten "bu durumdan maçın sonu ne" diye tahmin ediyor. Rollout'u ondan
   ÖNCE koymak için bir sebebimiz yok: birimi aday noktaya geçici olarak taşı, ağa sor,
   geri koy. FORK'A BİLE GEREK YOK — battleDurumOzellik SIM.units konumlarını doğrudan
   tarar, ızgarayı değil. Maliyet ~1ms (rollout 106ms).

   YAKLAŞIKLIK: birim oraya ışınlanmış gibi değerlendirilir; 5 saniyede YÜRÜYEREK
   gitmesi ve o sırada düşmanın yaptıkları hesaba katılmaz. Bu yüzden A1'in kapısı
   "rollout'la aynı adayı ne sıklıkla seçiyor" olmalı — ölçülmeden kullanılmaz. */
function battleLookaheadAgSkor(u, px, py) {
    if (typeof battleValueNetDurum !== 'function' || !battleValueNetHazir()) return null;
    const ex = u.x, ey = u.y;
    u.x = px; u.y = py;
    let v = null;
    try { v = battleValueNetDurum(); } finally { u.x = ex; u.y = ey; }
    if (v == null || !isFinite(v)) return null;
    return u.isRed ? v : -v;
}

// ── ADAY NOKTALAR: halkalı yelpaze (menzile yayılır), arazi süzgeçli ──
function battleLookaheadAdaylar(u) {
    const out = [{ x: u.x, y: u.y, kal: true, sinif: 0 }];
    for (let h = 1; h <= LA_HALKA; h++) {
        const rr = LA_YARICAP * h / LA_HALKA;
        for (let k = 0; k < LA_YON; k++) {
            const a = (Math.PI * 2 * k) / LA_YON + (h % 2 ? 0 : Math.PI / LA_YON);
            const px = u.x + Math.cos(a) * rr, py = u.y + Math.sin(a) * rr;
            if (px < 60 || py < 60 || px > WORLD_W - 60 || py > WORLD_H - 60) continue;
            if (typeof isPassableAt === 'function' && !isPassableAt(px, py)) continue;
            // sinif: kafes kimligi (karar defteri + politika agi cikti uzayi). Elenen
            // adaylar bosluk birakir -> dizi indisi DEGIL, kafes indisi kullanilir.
            out.push({ x: px, y: py, kal: false, sinif: 1 + (h - 1) * LA_YON + k });
        }
    }
    return out;
}

/* ADAY PUANI. Değer ağı açık ve güvenilir pencerede ise NİHAİ marj tahmini,
   değilse eski davranış (ufuk sonundaki marj deltası).
   Ağ kırmızı−mavi tahmin eder; savunan için işaret ters çevrilir. */
function battleLookaheadSkor(isRed, basMarj) {
    if (LA_DEGER_AGI && SIM.tick >= LA_AG_MIN_TIK &&
        typeof battleValueNetDurum === 'function' && battleValueNetHazir()) {
        const v = battleValueNetDurum();
        if (v != null && isFinite(v)) {
            BATTLE_LA_SAYAC.agKullanildi++;
            return isRed ? v : -v;
        }
    }
    BATTLE_LA_SAYAC.marjKullanildi++;
    return battleLookaheadMarj(isRed) - basMarj;
}

function battleLookaheadMarj(isRed) {
    const a = battleArmyObservation(isRed), d = battleArmyObservation(!isRed);
    return a.effectiveValue - d.effectiveValue;
}

/* TEK BİRİM İÇİN KARAR: adayları üret → analitik ele → ilk LA_DERIN'i OYNAT → en iyiyi seç.
   Dönüş: {x, y} veya null. Fork/restore burada yapılır; çağıran temiz durumla devam eder. */
function battleLookaheadBirimKarari(uid, isRed, now) {
    const u0 = SIM.units.find(x => x.id === uid);
    if (!u0 || u0.dead) return null;

    /* 1) ELEME + YAYILIM KAPISI — battleLookaheadEleVeKapi()'de.
       TEK KOPYA OLMAK ZORUNDA: politika kipi de aynı elemeyi/kapıyı kullanıyor.
       İki kopya olsaydı en ufak sapma, politikayı eğitildiğinden farklı bir karar
       nüfusuna salardı ve bu maç sonucuna bakarak GÖRÜLEMEZDİ. */
    const adaylar = battleLookaheadEleVeKapi(u0);
    if (!adaylar) {
        if (typeof BATTLE_LA_SAYAC !== 'undefined') BATTLE_LA_SAYAC.atlanan++;
        return null;
    }
    if (typeof BATTLE_LA_SAYAC !== 'undefined') BATTLE_LA_SAYAC.arananan++;

    // ELEYİCİNİN #1'i — karar defterine yazılır. "Rollout eleyiciyi ne sıklıkla
    // devirir?" sorusunun cevabı, politika damıtmanın DEĞER TAŞIYIP taşımadığını
    // belirler: hiç devirmiyorsa politika zaten elimizde olan ucuz eleyiciyi
    // öğreniyor demektir. Bedava ölçüm, tahmine bırakılmaz.
    const _eleyiciSinif = adaylar.length ? (adaylar[0].sinif | 0) : 0;

    const derin = adaylar.slice(0, LA_DERIN);
    // "yerinde kal" hep sınansın: aramanın zarar vermediğini garanti eden taban.
    if (!derin.some(a => a.kal)) { const k = adaylar.find(a => a.kal); if (k) derin.push(k); }

    // 2) DERİN DEĞERLENDİRME: her adayı gerçekten oynat — her RAKİP TEPKİSİ için ayrı.
    /* GÖLGE: buradan sonraki tikler OLMADI. Kayıt/hash/telemetri kapatılmazsa
       rollout'ların ürettiği olaylar replay'e sızar (ölçüldü: replay 120. tikte
       sapıyordu). Bayrak try/finally ile geri alınır — istisna kaçarsa oyun
       sessizce kayıtsız kalırdı. */
    const _golgeOnce = BATTLE_SIM_GOLGE;
    BATTLE_SIM_GOLGE = true;
    const fork = battleForkCapture();
    const bas = battleLookaheadMarj(isRed);
    /* ÇOK KANALLI PUANLAMA açıksa defter rollout boyunca çalışmalı. Defter fork
       KAPSAMI DIŞINDA olduğu için elle saklanır: aksi hâlde rollout'ta biriken kredi
       gerçek maçın defterine sızar ve "Ham JSON" telemetrisi çöpe döner. */
    const _defterGerek = BATTLE_LA_KANAL || BATTLE_LA_ROL;
    const _krediSakli = _defterGerek ? battleLaKrediSakla() : null;
    if (_defterGerek && typeof BATTLE_CREDIT !== 'undefined') {
        BATTLE_CREDIT.on = true;
        battleKrediKayit(u0);   // birimin satırı yoksa aç (rol terimi ondan okuyacak)
    }
    // ROL: birimin KENDİ görev kanalları (yoksa rol terimi uygulanmaz)
    const _rolKanal = BATTLE_LA_ROL ? battleLaRolKanallari(u0) : null;
    /* ── KADEMELİ ELEME (successive halving) — TAM GÜCÜ UCUZLATIR ────────────────
       ÖLÇÜLDÜ (tools/arama-profil.js, 2026-08-19): turun **%94,5'i** rollout, rollout'un
       %72,8'i `unit.update` + %17,9'u rakip kontrolörü. Yani maliyet tam olarak
       `aday × ufuk × birim` ile artıyor ve tam güçte (derin 5 × ufuk 300) birim başına
       1500 tik simülasyon demek. Eleyici ağı artık darboğaz DEĞİL (%2,9).

       Fikir: 5 adayın hepsini 300 tik oynatmak israf. Önce hepsini KISA (LA_KADEME tik)
       oynat, sonra yalnız finalistleri tam ufka çıkar.
         maliyet: 5×60 + 2×300 = 900   (tam güç 5×300 = 1500)  → %40 tasarruf

       ⚠ "YERİNDE KAL" ELENEMEZ. Ona hep bir finalist yeri ayrılır: kal adayı aramanın
       zarar vermediğini garanti eden tabandır (yukarıda bu yüzden zorla `derin`e ekleniyor).
       Kısa ön elemede tesadüfen kötü görünüp elenirse o garanti kaybolurdu.

       ⚠ YALNIZ VARSAYILAN KURULUMDA: kanal/rol defteri açıksa devreye GİRMEZ. O terimler
       aday başına defter deltası okuyor ve ön eleme araya rollout soktuğu için delta
       kirlenirdi. LA_RAKIP>1 ise de girmez (her adayın birden çok tepki rollout'u var).

       ⚠ VARSAYILAN KAPALI (LA_KADEME=0): davranışı değiştiren bir YAKLAŞIKLIK, maç kapısı
       hüküm verir. Determinist: eşitlikte skor→x→y sırası, RNG yok. */
    if (LA_KADEME > 0 && derin.length > LA_KADEME_KALAN &&
        Math.max(1, LA_RAKIP) === 1 && !BATTLE_LA_KANAL && !_rolKanal) {
        const on = [];
        for (const a of derin) {
            battleForkRestore(fork);
            const u = SIM.units.find(x => x.id === uid);
            if (!u) { on.push({ a, s: -Infinity }); continue; }
            u.controlOwner = 'PLAYER';
            u.manualTarget = null; u.attackTarget = null;
            u.targetX = a.x; u.targetY = a.y;
            u.manualMoveTarget = { x: a.x, y: a.y };
            u.isMovingToManualTarget = true; u._holdingPos = false;
            let s2 = now;
            for (let i = 0; i < LA_KADEME && phase === PHASE.BATTLE; i++) {
                s2 += BATTLE_TICK_MS;
                stepSim(s2, BATTLE_TICK_SEC, battleControllersDrive, false);
            }
            on.push({ a, s: battleLookaheadSkor(isRed, bas) });
        }
        on.sort((p, q) => (q.s - p.s) || (p.a.x - q.a.x) || (p.a.y - q.a.y));
        const kalAday = derin.find(x => x.kal);
        const secilen = [];
        for (const o of on) {
            if (secilen.length >= LA_KADEME_KALAN) break;
            secilen.push(o.a);
        }
        if (kalAday && !secilen.includes(kalAday)) secilen[secilen.length - 1] = kalAday;   // taban garantisi
        BATTLE_LA_SAYAC.kademeElenen += (derin.length - secilen.length);
        derin.length = 0;
        for (const a of secilen) derin.push(a);
        battleForkRestore(fork);
    }

    let enIyi = null, enIyiSkor = -Infinity;
    for (const a of derin) {
        const tepkiSkor = [];
        for (let rk = 0; rk < Math.max(1, LA_RAKIP); rk++) {
            battleForkRestore(fork);
            // Kanal deltası ADAY BAŞINA ölçülür: fork durumu geri alır ama defter almaz,
            // o yüzden başlangıç toplamı her rollout'tan hemen ÖNCE alınmalı.
            const _k0 = BATTLE_LA_KANAL ? battleLaKanalTopla(true) : null;
            const _m0 = BATTLE_LA_KANAL ? battleLaKanalTopla(false) : null;
            const _r0 = _rolKanal ? battleLaRolTopla(uid, _rolKanal) : null;
            const u = SIM.units.find(x => x.id === uid);
            if (!u) continue;
            u.controlOwner = 'PLAYER';                 // rollout içinde AI onu yeniden yönlendirmesin
            u.manualTarget = null; u.attackTarget = null;
            u.targetX = a.x; u.targetY = a.y;
            u.manualMoveTarget = { x: a.x, y: a.y };
            u.isMovingToManualTarget = true; u._holdingPos = false;
            // RAKİP TEPKİSİ k: düşman kontrolörü k*kayma tik SONRA yeniden plan yapar
            if (rk > 0 && typeof BATTLE_CONTROLLERS !== 'undefined') {
                for (const c of BATTLE_CONTROLLERS.values()) {
                    if (!c || c.side === isRed) continue;   // yalnız RAKİP
                    c.nextDecisionTick = (c.nextDecisionTick | 0) + rk * LA_RAKIP_KAYMA;
                }
            }
            let s = now;
            for (let i = 0; i < LA_UFUK && phase === PHASE.BATTLE; i++) {
                s += BATTLE_TICK_MS;
                stepSim(s, BATTLE_TICK_SEC, battleControllersDrive, false);
            }
            let _sk = battleLookaheadSkor(isRed, bas);
            // Kanal katkısı marj ölçeğinde (TL) olduğu için doğrudan toplanabilir.
            if (BATTLE_LA_KANAL && _k0) _sk += battleLaKanalSkor(_k0, _m0, isRed);
            // ROL: birimin KENDİ görev üretimi (aynı TL ölçeği, LA_ROL_CARPAN katıyla)
            if (_r0) _sk += battleLaRolSkor(uid, _rolKanal, _r0);
            tepkiSkor.push(_sk);
        }
        if (!tepkiSkor.length) continue;
        // EN KÖTÜ DURUM: mevzi ancak düşmanın en iyi cevabına karşı da iyiyse iyidir
        const skor = Math.min.apply(null, tepkiSkor);
        /* ADAYIN ROLLOUT SKORU — birim-koşullu değer ağının EĞİTİM HEDEFİ.
           Neden bu, "10sn sonraki marj" değil: global marj değişimi o andaki TÜM
           birimler için AYNI sayıdır. Ona "hangi birim" girdisini eklersek ağ o
           girdiyi gürültü olarak öğrenir — bugün politika ağında tam bu yaşandı
           (seçenekler girdide yokken tahminlerin %94'ü tek cevaba çöktü).
           Rollout skoru ise hem BİRİME hem ADAYA bağlı: "bu birim şuraya giderse
           5 saniyelik gerçek simülasyon sonunda değer ne olur". Ağ bunu öğrenirse
           ışınlama rollout'un YERİNE geçebilir — GPU'nun çarpanını harcanabilir
           kılan döviz kuru budur. Ve hesap zaten yapılıyor; yalnız atılıyordu. */
        a._skor = skor;
        if (tepkiSkor.length > 1) {
            BATTLE_LA_SAYAC.rakipYayilimTop += (Math.max.apply(null, tepkiSkor) - skor);
            BATTLE_LA_SAYAC.rakipOlcum++;
        }
        // eşitlikte determinist: önce skor, sonra x, sonra y
        if (skor > enIyiSkor || (skor === enIyiSkor && enIyi && (a.x < enIyi.x || (a.x === enIyi.x && a.y < enIyi.y)))) {
            enIyiSkor = skor; enIyi = a;
        }
    }
    battleForkRestore(fork);
    BATTLE_SIM_GOLGE = _golgeOnce;   // gölge biter: bundan sonrası GERÇEK
    // Defteri arama ÖNCESİ hâline döndür: rollout'ların kredisi gerçek maça sızmasın.
    if (_krediSakli) battleLaKrediGeriYukle(_krediSakli);

    /* ── KARAR DEFTERİ ────────────────────────────────────────────────────
       Öznitelik değer ağıyla AYNI kaynaktan (battleDurumOzellik) + birime özgü
       alanlar + SEÇENEKLERİN KENDİSİ.

       SEÇENEKLERİ YAZMAK ŞART — ölçülerek öğrenildi. İlk sürümde yalnız (durum, birim)
       yazılıyordu ve etiket "hangi seçenek" idi. O kurgu ÖĞRENİLEMEZ: arama #1 ile #2
       arasında seçim yapıyor, ama ağın girdisinde o iki noktanın NEREDE olduğu ya da
       ucuz skorun onları NASIL puanladığı hiç yoktu. Aynı durum + aynı birim, farklı
       aday geometrisi → ağ için AYIRT EDİLEMEZ. Sonuç: ağ tahminlerinin %94'ünü tek
       seçeneğe yığdı, yani bedava "hep #1" tabanına çöktü (doğruluk %42.2 vs taban %43.4).
       Veri hacmi sorunu DEĞİLDİ; girdi ayırt edici bilgiyi taşımıyordu.

       `k`: seçilen seçeneğin indeksi (0=#1, 1=#2, 2=kal) — etiket doğrudan budur.
       `o`: her seçenek için [sınıf, analitik skor, ağ skoru, dx, dy].
       Ölçekleme yok: ham yazılır, normalizasyon eğitimde (yalnız eğitim kümesinden).

       `elenen`: yayılım kapısına takılan kararlar buraya HİÇ gelmez; onlar "yerinde kal"
       örneği değil, "arama karar vermedi" durumudur. Karıştırılırsa model hareketsizliğe
       doğru yanlı eğitilir. */
    if (BATTLE_LA_KAYIT.on && BATTLE_LA_KAYIT.buf.length < BATTLE_LA_KAYIT.cap &&
        typeof battleDurumOzellik === 'function') {
        const _oz = battleDurumOzellik(16, 10);
        if (_oz) {
            const _u = SIM.units.find(x => x.id === uid);
            const _st = _u ? STATS[_u.type] : null;
            // 4 ondalık: ham dosya 5.7KB/kayıt idi, yuvarlamayla ~yarısı. Kayıp 1e-4,
            // özniteliklerin kendi gürültüsünün çok altında.
            const _yuv = (v) => Math.round(v * 1e4) / 1e4;
            /* SEÇENEK LİSTESİ, aramanın GERÇEKTEN oynattığı sırayla: `derin`.
               Buradan türetmek zorunlu — `adaylar.slice(0,2)` diye yeniden kurmak,
               "kal derin'de yoksa sonuna eklenir" kuralını kaçırır ve etiketi kaydırırdı. */
            const _sec = derin.map(a => [a.sinif | 0,
                _yuv(a._s == null ? 0 : a._s), _yuv(a._ag == null ? 0 : a._ag),
                _yuv((a.x - u0.x) / LA_YARICAP), _yuv((a.y - u0.y) / LA_YARICAP),
                // [5] ROLLOUT SKORU: birim-kosullu deger agi bunu ogrenecek.
                // Oynatilmamis aday olursa null kalir (egitimde ACIKCA atlanir).
                (a._skor == null || !isFinite(a._skor)) ? null : _yuv(a._skor),
                // [6..12] ADAY NOKTASININ CEVRESI: orman, siper, ikmal, yukselti,
                // tehdit-degeri, tehdit-sayisi, GELEN-ATES. Bugune kadar ag bunlarin
                // HICBIRINI gormuyordu — ortu tek basina hasari %70 degistirebiliyor,
                // ve havadaki mermi hic sayilmiyordu.
                ...battleLaNoktaCevresi(a.x, a.y, isRed).map(_yuv)]);
            const _k = enIyi ? derin.indexOf(enIyi) : -1;
            if (_k >= 0) BATTLE_LA_KAYIT.buf.push({
                r: _oz.r.map(_yuv), s: _oz.s.map(_yuv),
                /* BIRIM: konum, tip, HP, taraf, menzil, maliyet + SAVAS HAZIRLIGI.
                   Eskiden yalniz HP vardi; oysa 5 saniyede ne olacagini mühimmat,
                   bastirilma ve kacis hali dogrudan belirliyor — mühimmatsiz birim
                   mukemmel mevziye gitse de ates edemez. */
                b: _u ? [_u.x / WORLD_W, _u.y / WORLD_H, _u.type / 26,
                        _u.hp / Math.max(1, _u.maxHp), _u.isRed ? 1 : 0,
                        (_st && _st.range ? _st.range : 0) / 2000,
                        (_st && _st.cost ? _st.cost : 0) / 1000,
                        _u.maxAmmo ? (_u.ammo || 0) / _u.maxAmmo : 1,
                        (_u.suppression || 0) / 100,
                        _u.isFleeing ? 1 : 0,
                        _u.inForest ? 1 : 0,
                        _u.inTrench ? 1 : 0].map(_yuv) : null,
                o: _sec,            // seçenekler (ağın ARALARINDA seçim yaptığı şeyler)
                k: _k,              // ETİKET: seçilen seçeneğin indeksi
                y: enIyi ? (enIyi.sinif | 0) : 0,   // kafes sınıfı (teşhis)
                e: _eleyiciSinif,                   // eleyicinin #1'i (teşhis)
                tik: SIM.tick
            });
        }
    }
    return (enIyi && !enIyi.kal) ? { x: enIyi.x, y: enIyi.y, skor: enIyiSkor } : null;
}

/* ── ADAY NOKTASININ ÇEVRESİ ────────────────────────────────────────────────
   Değer ağının en büyük kör noktası: aday noktanın NEREDE olduğu hakkında hiçbir
   şey bilmiyordu. Oysa motorda örtü hasarı %70'e kadar azaltıyor
   (js/globals.js: cover = inForest*0.4 + inTrench*0.3) ve bu bilgi ne raster'da
   ne aday özniteliğinde geçiyordu. Ağ, ormana mı açık alana mı gidildiğini
   göremeden "orada ne olur" sorusunu cevaplamaya çalışıyordu.

   Hepsi noktanın SAF fonksiyonu (Unit.updateTerrainBonuses ile aynı kaynaklar),
   sim durumuna DOKUNMAZ. Maliyet: aday başına bir ızgara sorgusu — rollout'un
   yanında ölçülemez.
   Dönüş: [orman, kendi-siperi, ikmal, yükselti, tehdit-değeri, tehdit-sayısı, GELEN-ATEŞ] */
function battleLaNoktaCevresi(x, y, isRed) {
    let orman = 0;
    if (typeof MAP_MODE !== 'undefined' && MAP_MODE === 'grid') {
        orman = (typeof terrainTypeAt === 'function' && terrainTypeAt(x, y) === TERRAIN.FOREST) ? 1 : 0;
    } else if (typeof terrainFeatures !== 'undefined') {
        for (const t of terrainFeatures) {
            if (t.type === TERRAIN.FOREST && Math.hypot(x - t.x, y - t.y) < t.r) { orman = 1; break; }
        }
    }
    let siper = 0, ikmal = 0;
    for (const t of (SIM.trenches || [])) {
        if (t.isRed !== isRed || t.isHospital) continue;
        if (Math.hypot(x - t.x, y - t.y) >= t.r) continue;
        siper = 1; ikmal = (t.providesSupply !== false) ? 1 : 0; break;
    }
    const yuk = (typeof elevationAt === 'function') ? elevationAt(x, y) : 0.5;
    /* ── GELEN ATEŞ (kullanıcı: "rakibin ÇNRA'sı şu alana vuruyor haberi gidiyor mu") ──
       CEVAP BUGÜNE KADAR: HAYIR. `SIM.pendingHits` uçmakta olan her merminin nereye
       (cx,cy) ve ne zaman (arriveTick) düşeceğini, patlama yarıçapıyla birlikte TAM
       tutuyor. Ama kod taramasında bu veri yalnız PUSH ediliyor ve varış anında
       uygulanıyor — hiçbir karar yolunda OKUNMUYOR. Hiçbir birim baraj altından
       çekilmiyor, hiçbir aday puanı bunu görmüyor.
       Sonuç: üstüne baraj düşmek üzere olan nokta, güvenli noktayla AYNI görünüyordu.
       Rollout ise bunu görüyor (mermi 5sn içinde düşüyor) — eleyicinin kötü
       sıralamasının kaynaklarından biri bu olabilir.
       ÖLÇÜLDÜ: adayların %6.9'u rollout ufku içinde vuruluyor (orman %0, siper %9). */
    let gelen = 0;
    const _ufuk = (typeof LA_UFUK !== 'undefined') ? LA_UFUK : 100;
    for (const ph of (SIM.pendingHits || [])) {
        if (ph.atkIsRed === isRed) continue;                    // kendi ateşimiz tehdit değil
        if (ph.arriveTick > SIM.tick + _ufuk) continue;         // ufuk dışında düşecek
        const r = Math.max(ph.blastR || 0, ph.splashR || 0, ph.suppR || 0, 60);
        if (Math.hypot((ph.cx || 0) - x, (ph.cy || 0) - y) <= r) gelen += (ph.dmg || 0);
    }
    /* TEHDİT: bu noktayı MENZİLİNE ALAN düşmanların toplam değeri. Aday noktanın
       "vurulabilirliği" — rollout'un simüle ettiği şeyin en doğrudan vekili. */
    let tDeger = 0, tSay = 0;
    if (SIM.spatialGrid) {
        for (const o of SIM.spatialGrid.getNearby(x, y, 1400)) {
            if (o.dead || o.loaded || o.abandoned || o.isRed === isRed) continue;
            const d = Math.hypot(o.x - x, o.y - y);
            if (d > (o.range || 0)) continue;
            tDeger += ((STATS[o.type] && STATS[o.type].cost) || 0); tSay++;
        }
    }
    return [orman, siper, ikmal, yuk, tDeger / 3000, tSay / 12, gelen / 200];
}

/* ── ELEME + YAYILIM KAPISI, rollout'suz ────────────────────────────────────
   `battleLookaheadBirimKarari`nın ilk yarısı. Politika kipi bunu AYNEN kullanmak
   ZORUNDA: arama, kapıya takılan birimler için HİÇ karar üretmez ve o durumlar
   karar defterine de yazılmaz. Politikayı kapısız çalıştırmak, onu hiç görmediği
   bir karar nüfusunun üzerine salmak olur (eğitim/çıkarım dağılım uyuşmazlığı).
   Kapı zaten UCUZ — ölçülen maliyet rollout'ta, elemede değil.
   Dönüş: sıralı aday listesi, ya da kapıya takıldıysa null. */
function battleLookaheadEleVeKapi(u0) {
    let adaylar = battleLookaheadAdaylar(u0);
    if (adaylar.length < 3) return null;
    const _agAcik = LA_AG_KAPI && typeof battleLookaheadAgSkor === 'function' && battleValueNetHazir();
    // Analitik skor BEDAVA (rollout yok, ağ yok) — her zaman hepsine bakılır.
    for (const a of adaylar) a._s = battleLookaheadStatik(u0, a.x, a.y);

    /* ── AĞ ÖN SÜZGECİ: ağ yalnız analitik olarak en iyi LA_AG_ADAY adaya sorulur ──
       ÖLÇÜLDÜ (bu dosyanın başlığı): ağı HER adaya sormak, politika kipinin
       maliyetinin %100'üydü — rollout'suz kip 61.8sn, ağ eleyicisi kapalıyken 6.0sn
       (aramasız taban 6.1sn). Yani darboğaz rollout DEĞİL, aday başına değer-ağı
       çağrısı: 25 aday × 20 birim = 500 CNN geçişi/tur.
       Kısıtlamanın güvenli olduğu da ölçülmüş: analitik ön eleme K=3'te kazancın
       %72'sini koruyor ve bedava. LA_AG_ADAY=5 o ölçümden cömert seçildi.
       0 = süzgeç yok (eski davranış). */
    if (_agAcik && LA_AG_ADAY > 0 && adaylar.length > LA_AG_ADAY + 1) {
        const kal0 = adaylar.find(a => a.kal);
        const sirali = adaylar.slice().sort((a, b) => (b._s - a._s) || (a.x - b.x) || (a.y - b.y));
        const secili = sirali.slice(0, LA_AG_ADAY);
        // "yerinde kal" HER ZAMAN havuzda kalmalı: yayılım kapısı onu referans alıyor.
        if (kal0 && !secili.includes(kal0)) secili.push(kal0);
        adaylar = secili;
    }
    for (const a of adaylar) a._ag = _agAcik ? battleLookaheadAgSkor(u0, a.x, a.y) : null;

    const _puan = a => (_agAcik && a._ag != null) ? a._ag : a._s;
    adaylar.sort((a, b) => (_puan(b) - _puan(a)) || (a.x - b.x) || (a.y - b.y));
    const _kal = adaylar.find(a => a.kal);
    if (_kal) {
        /* KAPI ÇARPANI (A/B kolu) — kapı NE KADAR eliyor?
           ÖLÇÜLDÜ (worker'ın kendi raporu, 2026-08-18): tur başına aranan 33 / atlanan 61,
           yani arama kendisine verilen birimlerin ancak %35'i için rollout koşuyor.
           Belgelenen beklenti "%40 atlanır" idi; gerçek %65. Kapı bedava optimizasyon
           diye konmuştu ama bu oranda artık bir BÜTÇE KISITI gibi davranıyor olabilir.
           Çarpan 1 = mevcut davranış (varsayılan). 0.25 = kapı gevşer, daha çok birim
           aranır. Kazanç mı maliyet mi olduğu maç kapısında ölçülür. */
        const _carpan = (typeof LA_KAPI_CARPAN !== 'undefined' && LA_KAPI_CARPAN >= 0) ? LA_KAPI_CARPAN : 1;
        const _esik = ((_agAcik && _kal._ag != null) ? LA_AG_ESIK : LA_YAYILIM_ESIK) * _carpan;
        if ((_puan(adaylar[0]) - _puan(_kal)) < _esik) return null;
    }
    return adaylar;
}

/* ── POLİTİKA KİPİ: rollout YOK, tek ileri-geçiş ────────────────────────────
   Bütçe duvarının cevabı. Arama ~1 CPU-sn/oyun-sn harcıyor; bu yol birim başına
   tek CNN geçişi.
   `oz` çağıran tarafından bir kez hesaplanıp verilir: bir turda durum DEĞİŞMEZ
   (rollout yok), yani 20 birim için rasteri 20 kez üretmek saf israf olur.
   Dönüş: {x,y} ya da null (sınıf 0 = yerinde kal → emir verilmez). */
function battleLookaheadPolitikaKarari(uid, oz) {
    const u0 = SIM.units.find(x => x.id === uid);
    if (!u0 || u0.dead) return null;
    if (typeof battlePolicyNetHazir !== 'function' || !battlePolicyNetHazir()) return null;

    const adaylar = battleLookaheadEleVeKapi(u0);
    if (!adaylar) { BATTLE_LA_SAYAC.atlanan++; return null; }
    BATTLE_LA_SAYAC.arananan++;

    /* SEÇENEK LİSTESİ, aramanın kurduğuyla BİREBİR AYNI kural: ilk LA_DERIN aday,
       ve "yerinde kal" içlerinde yoksa sonuna eklenir. Politika tam da bu üçlü
       üzerinde eğitildi; başka bir liste kurmak onu eğitilmediği bir seçim
       kümesine sokardı. */
    const sec = adaylar.slice(0, LA_DERIN);
    if (!sec.some(a => a.kal)) { const k = adaylar.find(a => a.kal); if (k) sec.push(k); }

    const lg = battlePolicyNetBirim(u0, sec, oz);
    if (!lg || lg.length !== sec.length) return null;

    let en = 0;
    for (let i = 1; i < lg.length; i++) if (lg[i] > lg[en]) en = i;   // eşitlikte ilk: determinist
    const a = sec[en];
    if (!a || a.kal) { BATTLE_LA_SAYAC.politikaKal++; return null; }
    BATTLE_LA_SAYAC.politikaEmir++;
    return { x: a.x, y: a.y, skor: lg[en] };
}

/* `kayit`: emri REPLAY'e yaz. YALNIZ NİHAİ emirler için true olmalı.
   Neden parametre: bu fonksiyon deneme rollout'ları sırasında da çağrılıyor
   (sıralı taahhütte her aday sırası denenirken). Koşulsuz kaydetmek, hiç
   uygulanmamış deneme emirlerini replay'e sokar ve replay canlıdan sapardı.

   REPLAY SÖZLEŞMESİ: replay'de arama KOŞMAZ (js/main.js, gameLoop) — kayıttaki
   emirler oynatılır. Bu, kontrolör emirlerinin ('controller-order') izlediği
   desenin aynısıdır. Kaydedilmeseydi canlıda aramanın sürüklediği birimler
   replay'de yerinde kalır ve hash kontrolü sapma verirdi. */
function battleLookaheadEmirVer(uid, karar, kayit) {
    const u = SIM.units.find(x => x.id === uid);
    if (!u || u.dead) return;
    u.targetX = karar.x; u.targetY = karar.y;
    u.manualMoveTarget = { x: karar.x, y: karar.y };
    u.isMovingToManualTarget = true; u._holdingPos = false;
    u._laUntilTick = SIM.tick + LA_EMIR_SURESI;   // emrin ömrü (AI hemen ezmesin)
    BATTLE_LA_SAYAC.emir++;
    if (kayit && typeof battleRecordEvent === 'function') {
        battleRecordEvent('lookahead-order', { id: uid, x: karar.x, y: karar.y });
    }
}

/* TİKLER ARASINDA çağrılır. stepSim'in İÇİNDEN ÇAĞIRMA — fork/restore birimleri
   yeniden yaratır ve dış tikin döngülerini bozar. */
function battleLookaheadTick(now) {
    if (typeof SIM === 'undefined' || !SIM.units || phase !== PHASE.BATTLE) return;

    /* WORKER EMİRLERİ — HER TİKTE kontrol edilir, arama periyodunda değil. İşçi dünyayı
       k tik ileri sarıp oradan aradı; emir tam o tikte inmeli. Hedef tik periyoda denk
       gelmeyebileceği için bu kanca en başta, periyot kontrolünden ÖNCE durur. */
    if (typeof battleLaWorkerTikUygula === 'function') battleLaWorkerTikUygula();

    /* KUYRUK BOŞALTMA (tike yayma açıkken). Periyot tiki olmasa da her tikte
       birkaç bekleyen karar işlenir → tur tek blok yerine zamana yayılır. */
    if (LA_TIK_BIRIM > 0 && BATTLE_LA_KUYRUK.length) {
        let n = 0;
        while (BATTLE_LA_KUYRUK.length && n < LA_TIK_BIRIM) {
            const is = BATTLE_LA_KUYRUK.shift();
            n++;
            if (!battleLookaheadAcik(is.isRed)) continue;
            const k = battleLookaheadBirimKarari(is.uid, is.isRed, now);
            if (k) battleLookaheadEmirVer(is.uid, k, true);   // NİHAİ → replay'e yaz
        }
    }

    if ((SIM.tick % LA_PERIYOT_TIK) !== 0) return;

    /* ── WORKER'A DEVİR ────────────────────────────────────────────────────
       Köprü fork'u işçiye yollar ve HEMEN döner; emirler birkaç yüz ms sonra
       `battleLookaheadEmirVer(..., true)` ile uygulanır (replay sözleşmesi korunur).
       `true` dönerse bu tur ana iş parçacığında arama YAPILMAZ.
       Köprü yüklü değilse (Node tezgâhı, eski index.html) kanca sessizce atlanır —
       davranış birebir eskisi gibi kalır. */
    if (BATTLE_LA_WORKER_KIP && typeof battleLaWorkerTur === 'function') {
        if (typeof battleLaWorkerKur === 'function' &&
            typeof BATTLE_LA_WORKER !== 'undefined' && !BATTLE_LA_WORKER.isci) {
            battleLaWorkerKur();
        }
        if (battleLaWorkerTur(now)) return;
    }

    /* Yeni tur: eski kuyruk BOŞALTILIR. Bir önceki turun artıkları bu tura
       taşınırsa karar sırası kayar ve kuyruk hiç kapanmadan büyüyebilir
       (yavaş makinede sonsuz birikme). Kaçırılan karar, bir sonraki turda
       zaten yeniden değerlendirilecek. */
    if (LA_TIK_BIRIM > 0 && BATTLE_LA_KUYRUK.length) {
        BATTLE_LA_SAYAC.kuyrukAtilan += BATTLE_LA_KUYRUK.length;
        BATTLE_LA_KUYRUK.length = 0;
    }

    for (const isRed of [true, false]) {
        if (!battleLookaheadAcik(isRed)) continue;
        // En DEĞERLİ birimler: karar kaldıracı en yüksek olanlar. Determinist sıra.
        /* OYUNCUNUN BİRİMİNE ASLA DOKUNMA. Canlı oyunda arama iki tarafta da açık
           olabilir; oyuncunun kendi birimlerini arama sürüklerse oyun elinden alınmış
           olur. `controlOwner === 'PLAYER'` tek doğru süzgeç — hangi tarafın insan
           olduğunu tahmin etmeye gerek bırakmaz (sömürücü katmanı da aynı kuralı
           kullanıyor: js/BattleExploiters.js "oyuncunun birimine KARISMA"). */
        let _sirali = SIM.units
            /* HAVA BİRİMLERİ ARAMANIN DIŞINDAYDI. Ölçüm (kullanıcının 4 gerçek maçı,
               2026-08-19): arama emirlerin yalnız %10-19'unu veriyor ve helo bu projede
               "AI'nın 1 numaralı katili" olarak ölçülmüştü (%22) — yani aramanın hiç
               dokunmadığı bir sınıf, sonucun büyük bölümünü belirliyor. Bayrak açıkken
               helo/SİHA/keşif-İHA da aranır.
               KAMİKAZE HARİÇ ve bu bilerek: dalış taahhüdünü KENDİ mantığı yönetiyor
               (js/BattleController.js: "AI'nin hareket emri onu KAPSAMAZ" — titremenin
               kök nedeni buydu). Aramanın ona emir vermesi o kusuru geri getirirdi.
               ⚠ VARSAYILAN KAPALI: kapalıyken süzgeç birebir eskisi, davranış aynı. */
            .filter(u => !u.dead && u.isRed === isRed && !u.loaded && !u.abandoned &&
                         (!u.isAir || (typeof BATTLE_LA_HAVA !== 'undefined' && BATTLE_LA_HAVA === true &&
                                       typeof T !== 'undefined' && u.type !== T.KAMIKAZE)) &&
                         u.controlOwner !== 'PLAYER')
            .sort((a, b) => (((STATS[b.type] && STATS[b.type].cost) || 0) - ((STATS[a.type] && STATS[a.type].cost) || 0)) || (a.id - b.id))
            .slice(0, LA_BIRIM);
        /* DÖNÜŞÜM: tur indeksi TIK'ten türetilir → determinist (duvar saati DEĞİL).
           Duvar saatiyle dilimlemek replay ve çok-oyunculu lockstep'i bozardı. */
        if (LA_TUR_BIRIM > 0 && _sirali.length > LA_TUR_BIRIM) {
            const _tur = Math.floor(SIM.tick / LA_PERIYOT_TIK);
            const _pencere = Math.ceil(_sirali.length / LA_TUR_BIRIM);
            const _bas = (_tur % _pencere) * LA_TUR_BIRIM;
            _sirali = _sirali.slice(_bas, _bas + LA_TUR_BIRIM);
        }
        const hedefler = _sirali.map(u => u.id);

        /* POLİTİKA KİPİ: fork YOK, rollout YOK. Raster bir turda DEĞİŞMEZ (durum
           ilerletilmiyor), o yüzden 20 birim için tek kez hesaplanır — birim başına
           yeniden üretmek işin en pahalı parçasını 20'ye katlardı. */
        if (LA_POLITIKA === 1) {
            if (typeof battlePolicyNetHazir !== 'function' || !battlePolicyNetHazir()) continue;
            const _oz = battleDurumOzellik(BATTLE_POLICY_MODEL.gx, BATTLE_POLICY_MODEL.gy);
            if (!_oz) continue;
            for (const uid of hedefler) {
                const k = battleLookaheadPolitikaKarari(uid, _oz);
                if (k) battleLookaheadEmirVer(uid, k, true);   // NİHAİ → replay'e yaz
            }
            continue;
        }

        if (!LA_SIRALI) {
            // KÖR: tüm kararlar aynı başlangıç durumundan alınır, sonra birlikte uygulanır.
            const bekleyen = [];
            for (const uid of hedefler) {
                const k = battleLookaheadBirimKarari(uid, isRed, now);
                if (k) bekleyen.push([uid, k]);
            }
            for (const [uid, k] of bekleyen) battleLookaheadEmirVer(uid, k, true);   // NİHAİ → replay'e yaz
            continue;
        }

        /* SIRALI (+ istenirse ÇİFT YÖNLÜ). Bir sırayı dene: her birim kararını alır ve
           emri HEMEN uygulanır → sıradaki birim onu görerek karar verir. Sonra ortaya
           çıkan ORTAK PLAN oynatılıp puanlanır. */
        /* ── TEK SIRA HIZLI YOLU (LA_CIFT_YON kapalıyken) ────────────────────
           `dene()` ortak planı puanlamak için 100 tiklik TAM bir rollout koşuyor.
           Ama çift yön kapalıyken karşılaştırılacak İKİNCİ plan yok — o skor
           hesaplanıp ATILIYOR. Turun en pahalı tek parçası, sonucu kullanılmadan.

           Ayrıca dış fork/restore da gereksiz: `dene` emirleri uyguluyor, sonra
           taban geri yükleniyor, sonra AYNI emirler yeniden uygulanıyor.

           Bu yol ikisini de atlar: birim kararını al, emri HEMEN uygula (sıralı
           taahhüt korunur — sıradaki birim öncekinin gerçek hamlesini görür).
           DAVRANIŞ AYNI: rollout fork/restore ile tamamen geri alınıyordu.
           Eşitlik md5 ile doğrulandı (aynı tohumlarda birebir aynı çıktı).

           KAZANÇ: tur başına bir tam-plan rollout'u (~%20 maliyet) ve daha da
           önemlisi tur artık BÖLÜNEBİLİR hâle gelir — her birim kararı kendi
           içinde atomik (kendi fork/restore'u var), dış bariyer kalkınca kararlar
           tiklere yayılabilir. Canlı oyundaki 2-3sn'lik donmanın çözümü budur. */
        if (!LA_CIFT_YON && LA_HIZLI_YOL) {
            if (LA_TIK_BIRIM > 0) {
                // TİKE YAY: kararları kuyruğa koy, tikler boyunca işlensin.
                for (const uid of hedefler) BATTLE_LA_KUYRUK.push({ uid, isRed });
            } else {
                for (const uid of hedefler) {
                    const k = battleLookaheadBirimKarari(uid, isRed, now);
                    if (k) battleLookaheadEmirVer(uid, k, true);   // NİHAİ → replay'e yaz
                }
            }
            BATTLE_LA_SAYAC.ileriKazandi++;
            continue;
        }

        const taban = battleForkCapture();
        const dene = (sira) => {
            battleForkRestore(taban);
            const emirler = [];
            for (const uid of sira) {
                const k = battleLookaheadBirimKarari(uid, isRed, now);
                if (k) { battleLookaheadEmirVer(uid, k); emirler.push([uid, k]); }
            }
            const bas = battleLookaheadMarj(isRed);
            const _g2 = BATTLE_SIM_GOLGE;
            BATTLE_SIM_GOLGE = true;              // ortak-plan rollout'u da GÖLGE
            const f2 = battleForkCapture();
            let s2 = now;
            for (let i = 0; i < LA_UFUK && phase === PHASE.BATTLE; i++) {
                s2 += BATTLE_TICK_MS;
                stepSim(s2, BATTLE_TICK_SEC, battleControllersDrive, false);
            }
            const skor = battleLookaheadSkor(isRed, bas);
            battleForkRestore(f2);
            BATTLE_SIM_GOLGE = _g2;
            return { emirler, skor };
        };

        const ileri = dene(hedefler);
        let kazanan = ileri;
        if (LA_CIFT_YON && hedefler.length > 1) {
            const geri = dene(hedefler.slice().reverse());
            // eşitlikte İLERİ kazanır (determinist)
            // TEŞHİS: iki sıra AYNI planı mı üretiyor, yoksa farklı ama forward mı iyi?
            const ayniPlan = ileri.emirler.length === geri.emirler.length &&
                ileri.emirler.every(([id, k], i) => geri.emirler.some(([id2, k2]) =>
                    id2 === id && Math.abs(k2.x - k.x) < 1 && Math.abs(k2.y - k.y) < 1));
            if (ayniPlan) BATTLE_LA_SAYAC.ayniPlan++;
            else if (ileri.skor === geri.skor) BATTLE_LA_SAYAC.farkliAmaEsitSkor++;
            if (geri.skor > ileri.skor) { kazanan = geri; BATTLE_LA_SAYAC.geriKazandi++; }
            else BATTLE_LA_SAYAC.ileriKazandi++;
        }
        battleForkRestore(taban);
        for (const [uid, k] of kazanan.emirler) battleLookaheadEmirVer(uid, k, true);   // NİHAİ → replay'e yaz
    }
}

if (typeof module !== 'undefined') {
    module.exports = { battleLookaheadTick, battleLookaheadBirimKarari, battleLookaheadStatik,
        battleLookaheadAgSkor, battleLookaheadSinifNokta, battleLookaheadSinifSayisi,
        battleLookaheadEleVeKapi, battleLookaheadPolitikaKarari,
        battleLaKanalSkor, battleLaKanalTopla, battleLaRolKanallari, battleLaRolSkor };
}
