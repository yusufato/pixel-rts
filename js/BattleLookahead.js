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
const BATTLE_LA_SAYAC = { atlanan: 0, arananan: 0, emir: 0, ileriKazandi: 0, geriKazandi: 0, ayniPlan: 0, farkliAmaEsitSkor: 0, agKullanildi: 0, marjKullanildi: 0, rakipYayilimTop: 0, rakipOlcum: 0 };

let BATTLE_LOOKAHEAD_RED = false;    // saldıran (kırmızı) ileri-bakış kullansın mı
let BATTLE_LOOKAHEAD_BLUE = false;

const LA_PERIYOT_TIK = 100;   // kaç tikte bir arama (100 = 5sn)
let LA_BIRIM = 20;            // kapsam: ordunun tamamına yakını (A3)
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
const LA_UFUK = 100;          // rollout ufku (tik) — 100 = 5sn
const LA_EMIR_SURESI = 120;   // verilen emir kaç tik korunur (AI onu hemen ezmesin)

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
    const out = [{ x: u.x, y: u.y, kal: true }];
    for (let h = 1; h <= LA_HALKA; h++) {
        const rr = LA_YARICAP * h / LA_HALKA;
        for (let k = 0; k < LA_YON; k++) {
            const a = (Math.PI * 2 * k) / LA_YON + (h % 2 ? 0 : Math.PI / LA_YON);
            const px = u.x + Math.cos(a) * rr, py = u.y + Math.sin(a) * rr;
            if (px < 60 || py < 60 || px > WORLD_W - 60 || py > WORLD_H - 60) continue;
            if (typeof isPassableAt === 'function' && !isPassableAt(px, py)) continue;
            out.push({ x: px, y: py, kal: false });
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
    const adaylar = battleLookaheadAdaylar(u0);
    if (adaylar.length < 3) return null;

    /* 1) ELEME. Ağ açıksa adaylar AĞ skoruna göre sıralanır (eleme ölçümünde analitikten
       biraz iyi: K=3'te %50 vs %45), yoksa analitik.
       ÖNEMLİ: sıralama ve kapı AYNI skoru kullanmalı. İlk sürümde adaylar ANALİTİĞE göre
       sıralanıp kapı AĞA bakıyordu — kapı "analitik-en-iyi"yi ağla puanlıyordu, oysa eşik
       "ağ-en-iyi" dağılımından türetilmişti. Uyumsuzluk kararların %87'sini kesti. */
    const _agAcik = LA_AG_KAPI && typeof battleLookaheadAgSkor === 'function' && battleValueNetHazir();
    for (const a of adaylar) {
        a._s = battleLookaheadStatik(u0, a.x, a.y);
        a._ag = _agAcik ? battleLookaheadAgSkor(u0, a.x, a.y) : null;
    }
    const _puan = a => (_agAcik && a._ag != null) ? a._ag : a._s;
    adaylar.sort((a, b) => (_puan(b) - _puan(a)) || (a.x - b.x) || (a.y - b.y));

    /* YAYILIM KAPISI: en iyi aday "yerinde kal"dan belirgin iyi değilse bu karar
       önemsizdir → hiç oynatma. Rollout'un %100'ü buradan tasarruf edilir. */
    /* KAPI — artık AĞ skoruna bakar. Analitik skor bedava ama ağ daha isabetli
       (eleme ölçümünde K=3'te %50 vs %45). Kapı bir BİRİMİ tümüyle atlıyor, yani
       isabet doğrudan tasarrufa çevriliyor: gereksiz birimde 2 rollout kazanılır.
       Ağ yoksa (model yüklenmemiş) analitik skora düşer. */
    const _kal = adaylar.find(a => a.kal);
    if (_kal) {
        const _esik = (_agAcik && _kal._ag != null) ? LA_AG_ESIK : LA_YAYILIM_ESIK;
        if ((_puan(adaylar[0]) - _puan(_kal)) < _esik) {
            if (typeof BATTLE_LA_SAYAC !== 'undefined') BATTLE_LA_SAYAC.atlanan++;
            return null;
        }
    }
    if (typeof BATTLE_LA_SAYAC !== 'undefined') BATTLE_LA_SAYAC.arananan++;

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
    return (enIyi && !enIyi.kal) ? { x: enIyi.x, y: enIyi.y, skor: enIyiSkor } : null;
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
        const hedefler = SIM.units
            .filter(u => !u.dead && u.isRed === isRed && !u.loaded && !u.abandoned && !u.isAir)
            .sort((a, b) => (((STATS[b.type] && STATS[b.type].cost) || 0) - ((STATS[a.type] && STATS[a.type].cost) || 0)) || (a.id - b.id))
            .slice(0, LA_BIRIM)
            .map(u => u.id);
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
        battleLookaheadAgSkor };
}
