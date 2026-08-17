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
const BATTLE_LA_SAYAC = { atlanan: 0, arananan: 0, emir: 0, ileriKazandi: 0, geriKazandi: 0, ayniPlan: 0, farkliAmaEsitSkor: 0, agKullanildi: 0, marjKullanildi: 0, rakipYayilimTop: 0, rakipOlcum: 0, politikaKal: 0, politikaEmir: 0 };

let BATTLE_LOOKAHEAD_RED = false;    // saldıran (kırmızı) ileri-bakış kullansın mı
let BATTLE_LOOKAHEAD_BLUE = false;

/* ARAMA PERİYODU. Dönüşüm denemesi (periyot sabit, BİRİM kıs) kazancı öldürdü
   (+191 t 0.47). Tersi denenmedi: birim sayısını KORU, periyodu UZAT. Kapsam tam
   kalır, maliyet zamana yayılır — canlı bütçe için tek kalan ucuz kaldıraç. */
let LA_PERIYOT_TIK = 100;     // kaç tikte bir arama (100 = 5sn)
let LA_BIRIM = 20;            // kapsam: ordunun tamamına yakını (A3)
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
const LA_YON = 8;             // aday yönü
const LA_HALKA = 3;           // aday halkası (MENZİL çeşitliliği — ölçümde asıl kaldıraç)
const LA_YARICAP = 600;       // en dış halka
let LA_DERIN = 2;             // elemeden sonra GERÇEKTEN oynatılan aday (3→2: bütçe kapsama gitti)
/* ROLLOUT UFKU. Değer ağı zaten "bu durumdan maçın sonu ne" diye tahmin ettiği için
   ufkun UZUN olması gerekmez — kısa rollout birimi yola çıkarır, gerisini ağ söyler.
   (AlphaZero'da yaprak doğrudan değer ağıyla puanlanır, rollout yoktur.)
   A1 denemesi hiç-rollout'u sınadı ve düştü: ışınlanmış birim yürüyen birimle aynı
   değil. Kısa rollout ikisinin arası. Canlı oyun bütçesi için kritik: 5sn ufuk
   106ms, 1sn ufuk ~21ms. */
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
    const fork = battleForkCapture();
    const bas = battleLookaheadMarj(isRed);
    let enIyi = null, enIyiSkor = -Infinity;
    for (const a of derin) {
        const tepkiSkor = [];
        for (let rk = 0; rk < Math.max(1, LA_RAKIP); rk++) {
            battleForkRestore(fork);
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
            tepkiSkor.push(battleLookaheadSkor(isRed, bas));
        }
        if (!tepkiSkor.length) continue;
        // EN KÖTÜ DURUM: mevzi ancak düşmanın en iyi cevabına karşı da iyiyse iyidir
        const skor = Math.min.apply(null, tepkiSkor);
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

    /* KARAR DEFTERİ: durum + aramanın SEÇTİĞİ sınıf. Öznitelik, değer ağıyla AYNI
       kaynaktan (battleDurumOzellik) + birime özgü alanlar — politika ağı "bu durumda
       BU birim nereye gitmeli" öğrenecek.

       `elenen`: yayılım kapısı yüzünden erken dönen kararlar buraya HİÇ gelmez; onlar
       "yerinde kal" örneği değil, "arama karar vermedi" durumudur. Karıştırılırsa model
       hareketsizliğe doğru yanlı eğitilir. */
    if (BATTLE_LA_KAYIT.on && BATTLE_LA_KAYIT.buf.length < BATTLE_LA_KAYIT.cap &&
        typeof battleDurumOzellik === 'function') {
        const _oz = battleDurumOzellik(16, 10);
        if (_oz) {
            const _u = SIM.units.find(x => x.id === uid);
            const _st = _u ? STATS[_u.type] : null;
            const _y = enIyi ? (enIyi.sinif | 0) : 0;
            // 4 ondalık: ham dosya 5.7KB/kayıt idi, yuvarlamayla ~yarısı. Kayıp 1e-4,
            // özniteliklerin kendi gürültüsünün çok altında.
            const _yuv = (v) => Math.round(v * 1e4) / 1e4;
            BATTLE_LA_KAYIT.buf.push({
                r: _oz.r.map(_yuv), s: _oz.s.map(_yuv),
                b: _u ? [_u.x / WORLD_W, _u.y / WORLD_H, _u.type / 26,
                        _u.hp / Math.max(1, _u.maxHp), _u.isRed ? 1 : 0,
                        (_st && _st.range ? _st.range : 0) / 2000,
                        (_st && _st.cost ? _st.cost : 0) / 1000].map(_yuv) : null,
                y: _y,
                e: _eleyiciSinif,   // eleyicinin #1'i (y ile farkı = rollout'un kattığı sinyal)
                tik: SIM.tick
            });
        }
    }
    return (enIyi && !enIyi.kal) ? { x: enIyi.x, y: enIyi.y, skor: enIyiSkor } : null;
}

/* ── ELEME + YAYILIM KAPISI, rollout'suz ────────────────────────────────────
   `battleLookaheadBirimKarari`nın ilk yarısı. Politika kipi bunu AYNEN kullanmak
   ZORUNDA: arama, kapıya takılan birimler için HİÇ karar üretmez ve o durumlar
   karar defterine de yazılmaz. Politikayı kapısız çalıştırmak, onu hiç görmediği
   bir karar nüfusunun üzerine salmak olur (eğitim/çıkarım dağılım uyuşmazlığı).
   Kapı zaten UCUZ — ölçülen maliyet rollout'ta, elemede değil.
   Dönüş: sıralı aday listesi, ya da kapıya takıldıysa null. */
function battleLookaheadEleVeKapi(u0) {
    const adaylar = battleLookaheadAdaylar(u0);
    if (adaylar.length < 3) return null;
    const _agAcik = LA_AG_KAPI && typeof battleLookaheadAgSkor === 'function' && battleValueNetHazir();
    for (const a of adaylar) {
        a._s = battleLookaheadStatik(u0, a.x, a.y);
        a._ag = _agAcik ? battleLookaheadAgSkor(u0, a.x, a.y) : null;
    }
    const _puan = a => (_agAcik && a._ag != null) ? a._ag : a._s;
    adaylar.sort((a, b) => (_puan(b) - _puan(a)) || (a.x - b.x) || (a.y - b.y));
    const _kal = adaylar.find(a => a.kal);
    if (_kal) {
        const _esik = (_agAcik && _kal._ag != null) ? LA_AG_ESIK : LA_YAYILIM_ESIK;
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

    const b = battlePolicyNetBirimOz(u0);
    const lg = b ? battlePolicyNetLogit(oz.r, oz.s, b) : null;
    if (!lg) return null;

    /* Politikanın seçtiği sınıf ÜRETİLEBİLİR olmayabilir: aday kafesindeki bazı
       noktalar arazi/sınır süzgecine takılıp elenmiş olabilir. O yüzden logit
       sırasında ilerleyip GERÇEKTEN var olan ilk adayı al — uydurma nokta üretme. */
    const sira = Array.from({ length: lg.length }, (_, i) => i);
    sira.sort((a, c) => (lg[c] - lg[a]) || (a - c));   // eşitlikte küçük sınıf: determinist
    for (const sinif of sira) {
        if (sinif === 0) { BATTLE_LA_SAYAC.politikaKal++; return null; }   // "yerinde kal"
        const a = adaylar.find(x => x.sinif === sinif);
        if (a) { BATTLE_LA_SAYAC.politikaEmir++; return { x: a.x, y: a.y, skor: lg[sinif] }; }
    }
    return null;
}

function battleLookaheadEmirVer(uid, karar) {
    const u = SIM.units.find(x => x.id === uid);
    if (!u || u.dead) return;
    u.targetX = karar.x; u.targetY = karar.y;
    u.manualMoveTarget = { x: karar.x, y: karar.y };
    u.isMovingToManualTarget = true; u._holdingPos = false;
    u._laUntilTick = SIM.tick + LA_EMIR_SURESI;   // emrin ömrü (AI hemen ezmesin)
    BATTLE_LA_SAYAC.emir++;
}

/* TİKLER ARASINDA çağrılır. stepSim'in İÇİNDEN ÇAĞIRMA — fork/restore birimleri
   yeniden yaratır ve dış tikin döngülerini bozar. */
function battleLookaheadTick(now) {
    if (typeof SIM === 'undefined' || !SIM.units || phase !== PHASE.BATTLE) return;
    if ((SIM.tick % LA_PERIYOT_TIK) !== 0) return;

    for (const isRed of [true, false]) {
        if (!battleLookaheadAcik(isRed)) continue;
        // En DEĞERLİ birimler: karar kaldıracı en yüksek olanlar. Determinist sıra.
        let _sirali = SIM.units
            .filter(u => !u.dead && u.isRed === isRed && !u.loaded && !u.abandoned && !u.isAir)
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
                if (k) battleLookaheadEmirVer(uid, k);
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
            for (const [uid, k] of bekleyen) battleLookaheadEmirVer(uid, k);
            continue;
        }

        /* SIRALI (+ istenirse ÇİFT YÖNLÜ). Bir sırayı dene: her birim kararını alır ve
           emri HEMEN uygulanır → sıradaki birim onu görerek karar verir. Sonra ortaya
           çıkan ORTAK PLAN oynatılıp puanlanır. */
        const taban = battleForkCapture();
        const dene = (sira) => {
            battleForkRestore(taban);
            const emirler = [];
            for (const uid of sira) {
                const k = battleLookaheadBirimKarari(uid, isRed, now);
                if (k) { battleLookaheadEmirVer(uid, k); emirler.push([uid, k]); }
            }
            const bas = battleLookaheadMarj(isRed);
            const f2 = battleForkCapture();
            let s2 = now;
            for (let i = 0; i < LA_UFUK && phase === PHASE.BATTLE; i++) {
                s2 += BATTLE_TICK_MS;
                stepSim(s2, BATTLE_TICK_SEC, battleControllersDrive, false);
            }
            const skor = battleLookaheadSkor(isRed, bas);
            battleForkRestore(f2);
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
        for (const [uid, k] of kazanan.emirler) battleLookaheadEmirVer(uid, k);
    }
}

if (typeof module !== 'undefined') {
    module.exports = { battleLookaheadTick, battleLookaheadBirimKarari, battleLookaheadStatik,
        battleLookaheadAgSkor, battleLookaheadSinifNokta, battleLookaheadSinifSayisi,
        battleLookaheadEleVeKapi, battleLookaheadPolitikaKarari };
}
