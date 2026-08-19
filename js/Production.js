// ═══════════════════════════════════════════════════════════════════════════
//  ÜRETİM & ORDU HAVUZU  (Hikâye modu — FAZ-3)
//  ---------------------------------------------------------------------------
//  Ordu savaşa girerken bütçeyle dizilmez; ŞEHİRLERDE ÜRETİLİR. Fabrika zırhlı
//  sınıfı, kışla yaya sınıfı basar. Üretim süreli bir kuyruktan geçer ve biten
//  birlik DOĞRUDAN SİPARİŞİ VEREN KOMUTANIN sefer ordusuna katılır.
//  (FAZ-8: şehir deposu kaldırıldı — "ürettiğim birlik bana gelsin".)
//
//  Tasarım kararları:
//   • Ordu KOMUTANDA durur, komutanla gezer; şehirde bekleyen depo yoktur.
//     Teslim edilemeyen birlik garnizona yazılır (asla buharlaşmaz).
//   • Bina SEVİYE'dir (0-3), sayı değil → mevcut level/garrison diliyle aynı.
//   • Bina seviyesi ≤ şehir seviyesi → şehir yükseltmesi teknoloji kapısı olur.
//   • prodTick TÜM düğümleri gezer → oyuncu ve AI tek kod yolunu paylaşır.
// ═══════════════════════════════════════════════════════════════════════════

// ── BİNA ──
// Maliyet ⭐puan (şehir yükseltmesiyle aynı kasa). index = mevcut seviye → bir üstü.
// Maliyet ÖZGÜN DEĞERİNDE. Bir ara düşürülmüştü (220/380/620) ama ölçüm bunun
// dünyayı hızlandırıp dengeyi bozduğunu gösterdi: 900sn'de ortalama şehir 9.0 → 5.5,
// üç devletin refahı sıfırlandı. Tank görünürlüğü sorununu çözen şey maliyet değil,
// kilit YAPISIydı (aşağıdaki PROD_UNLOCK notuna bakınız).
const PROD_MAX_LEVEL = 3;

// ═══ ALTI ASKERİ BİNA + BAĞIMLILIK GRAFİĞİ (kullanıcı kararı, 2026-08-10) ═══
// GEREKÇE: iki bina (kışla/fabrika) 26 birimlik roster için fazla dardı — her şey aynı iki kilide
// bağlıydı ve "hava üssü olmadan saldırı helikopteri" gibi anlamsız durumlar oluşuyordu.
// BAĞIMLILIK: binalar birbirine bağlı bir yapı kurar — sanayi olmadan topçu parkı, ağır sanayi
// olmadan hava üssü kurulamaz. Böylece şehir gelişimi bir SIRA izler, her şey paralel açılmaz.
//
// ÖLÇÜLMÜŞ RİSK (dürüstlük notu): 152 şehirde yalnız 4'ünde Sv.3 kışla, 8'inde Sv.3 fabrika vardı.
// Yatırımı 2 binadan 6'ya bölmek üst kademeyi DAHA DA nadirleştirebilir. Bağımlılık grafiği bunu
// kısmen dengeler (yatırım sıraya girer, dağılmaz) ama etkisi ÖLÇÜLMELİ:
// tools/hikaye-roster-kapsama.js ile "sahaya çıkan tip sayısı" öncesi/sonrası karşılaştırılır.
const PROD_BUILDINGS = {
    bar: { ad: 'Kışla',                 ikon: '🎖️', maliyet: [150, 300, 560] },
    fac: { ad: 'Fabrika',               ikon: '🏭', maliyet: [260, 480, 900] },
    // İHTİSAS BİNALARI: KURMAK UCUZ, ÖLÇEKLEMEK PAHALI.
    // ÖLÇÜLDÜ (900 sn, 152 şehir): ilk maliyetler kışla/fabrika bandındayken hava üssü 0, topçu parkı 3,
    // hava savunma 2 şehirde kalıyordu — ön koşul binaları (kışla+fabrika) bütçeyi bitiriyor, ihtisas
    // binasına sıra hiç gelmiyordu. Bir hava savunma MEVZİİ kurmanın ağır sanayi kadar pahalı olması
    // zaten yanlıştı: mevzi/park kurulur, asıl yatırım onu büyütmektedir. Sv.1 düşürüldü, üst kademeler
    // pahalı bırakıldı → çeşitlilik erişilebilir, derinlik hâlâ tercih gerektiriyor.
    art: { ad: 'Topçu Parkı',           ikon: '💥', maliyet: [120, 340, 700] },
    air: { ad: 'Hava Üssü',             ikon: '🚁', maliyet: [170, 430, 860] },
    sup: { ad: 'Destek Üssü',           ikon: '🩺', maliyet: [ 90, 250, 520] },
    aad: { ad: 'Hava Savunma Mevzii',   ikon: '🛡️', maliyet: [110, 310, 640] }
};
const PROD_KINDS = Object.keys(PROD_BUILDINGS);
// ── EKONOMİNİN GÖRDÜĞÜ SANAYİ/SAVUNMA HACMİ ──
// Ekonomi katmanı bir şehrin gelişmişliğini yıllardır "fabrika + kışla" diye ölçüyordu; iki bina
// varken bu, TOPLAM askerî-sınai yatırıma eşitti. Altı binaya geçince aynı yatırım altıya bölündü,
// fabrika/kışla seviyeleri düştü ve ekonomi bunu "şehir geriledi" diye okudu. Aşağıdaki iki ölçü
// toplamı korur: yalnız fac/bar varken ESKİ DEĞERİN AYNISINI verir, ihtisas binaları eklendikçe
// yatırımı geri sayar. Ayrım işlevsel: üretim tesisi (tezgâh, işçi) ile askerî tesis (personel, mevzi).
function prodIndustryLevel(n) { return ((n && n.fac) | 0) + ((n && n.art) | 0); }
function prodDefenseLevel(n) {
    return ((n && n.bar) | 0) + ((n && n.air) | 0) + ((n && n.aad) | 0) + ((n && n.sup) | 0);
}
function prodInfraLevel(n) { return prodIndustryLevel(n) + prodDefenseLevel(n); }
// DERİNLİK = Sv.1'in ÜSTÜNDEKİ yatırım. "Şehir zaten gelişmiş mi?" sorusunda kullanılır.
// Toplam seviyeyle ölçmek konseyde ters teşvik üretiyordu: topçu parkı fabrika ister, ama fabrikası
// olan şehir "gelişmiş" sayılıp yatırım listesinin dibine düşüyordu — ihtisas binası kurulabilecek
// şehirler, seçilme şansı en düşük şehirler oluyordu. Temel bina sahipliği artık ceza değil.
function prodDepthLevel(n) {
    let d = 0; for (const k of PROD_KINDS) d += Math.max(0, ((n && n[k]) | 0) - 1);
    return d;
}
// BİNA ÖN KOŞULU: `bina Sv.N` kurmak için başka binalarda gereken asgari seviye.
// Okunuşu: art'ı Sv.1 yapmak için fac ≥ 1; Sv.3 yapmak için fac ≥ 2 gerekir.
const PROD_BUILD_REQ = {
    bar: { 1: {},              2: {},                3: { sup: 1 } },
    fac: { 1: { bar: 1 },      2: { bar: 2 },        3: { bar: 2, sup: 1 } },
    art: { 1: { fac: 1 },      2: { fac: 1 },        3: { fac: 2 } },
    aad: { 1: { fac: 1 },      2: { fac: 1 },        3: { fac: 2, sup: 1 } },
    air: { 1: { fac: 2 },      2: { fac: 2, sup: 1 },3: { fac: 3, sup: 2 } },
    sup: { 1: { bar: 1 },      2: { bar: 1 },        3: { bar: 2 } }
};
// BİRİM ÖN KOŞULU: kendi binası yetmez, BAŞKA bina da gerekir (kullanıcı örneği: balistik füze
// için fabrika Sv.2). Yalnız istisnalar yazılır; listede olmayan birim kendi binasıyla üretilir.
const PROD_UNIT_REQ = {
    ballistic_missile:     { fac: 2 },        // füze gövdesi ağır sanayi ister
    sam_battery:           { sup: 1 },        // uzun menzilli SAM radar/lojistik omurgası ister
    counter_battery_radar: { sup: 1 },
    ew_vehicle:            { sup: 2 },
    armed_uav:             { sup: 1 },        // silahlı İHA veri bağı ister
    attack_helo:           { fac: 2 },        // saldırı helosu ağır bakım ister
    command_vehicle:       { sup: 2 }
};
function prodBuildReqFor(kind, level) {
    const t = PROD_BUILD_REQ[kind];
    return (t && t[Math.max(1, Math.min(3, level))]) || {};
}
// Ön koşul sağlanıyor mu + eksikse okunabilir sebep (UI'de "neden kuramıyorum" görünsün)
function prodReqDurumu(n, req) {
    const eksik = [];
    for (const k of Object.keys(req || {})) {
        if ((n[k] | 0) < req[k]) eksik.push(`${PROD_BUILDINGS[k].ad} Sv.${req[k]}`);
    }
    return { tamam: eksik.length === 0, eksik };
}
function prodBuildReqMet(n, kind, level) { return prodReqDurumu(n, prodBuildReqFor(kind, level)).tamam; }
function prodUnitReqMet(n, type) {
    const s = (typeof STATS !== 'undefined') ? STATS[type] : null;
    const req = (s && PROD_UNIT_REQ[s.id]) || null;
    return !req || prodReqDurumu(n, req).tamam;
}

// ── 26-BİRİM ROSTERİ HİKÂYE MODUNA (kullanıcı: "hikâye modunda bu 25 birlik kullanılmıyor") ──
// TEŞHİS: hikâye üretimi ROSTERİN YALNIZ 8'İNİ açıyordu (infantry, scout_vehicle, engineer, medic,
// ifv, artillery, at_team, mbt) — yani modern rosterin üçte biri. Üstelik `T.ARMOR_INFANTRY` takma adı
// UnitLoader'ın LEGACY tablosunda HİÇ TANIMLI DEĞİL (ifv → 'MECH_INFANTRY'), dolayısıyla hem
// FACTORY_TYPES hem de fabrika Sv.2 kilidi `undefined` bir tip taşıyordu: sessiz hayalet kayıt.
// ÇÖZÜM — ELLE LİSTE DEĞİL VERİDEN TÜRETME: bina ve kilit seviyesi rosterin KENDİ `category` ve
// `tier` alanlarından çıkar. Roster değişince (yeni birim, kademe değişimi) hikâye modu kendiliğinden
// uyar; bir daha "motorda var ama seferde yok" durumu oluşamaz.
//   BİNA  : araç/hava/hava-savunma/İHA → FABRİKA · yaya, dolaylı-tim, destek, lojistik, komuta → KIŞLA
//   KİLİT : roster kademesi (tier) → bina seviyesi; tier 4 (balistik) en üst kademeye düşer
function prodCategoryOf(type) {
    const s = (typeof STATS !== 'undefined') ? STATS[type] : null;
    return (s && s.category) ? s.category : 'infantry';
}
// KATEGORİ → BİNA (veriden; roster değişirse eşleme kendiliğinden uyar)
function prodBuildingFor(type) {
    const cat = prodCategoryOf(type);
    // 'indirect' AYRIMI: havan bir TİM (yaya) → kışla; ÇNRA/balistik araçtır → topçu parkı.
    if (cat === 'indirect') {
        const s = (typeof STATS !== 'undefined') ? STATS[type] : null;
        return (s && s.armorType === 'infantry') ? 'bar' : 'art';
    }
    if (cat === 'armor' || cat === 'recon') return 'fac';
    if (cat === 'air' || cat === 'uav') return 'air';
    if (cat === 'air_defense') return 'aad';
    if (cat === 'support' || cat === 'logistics' || cat === 'command') return 'sup';
    return 'bar';   // infantry ve tanımsız kalan her şey
}
function prodBuildingName(kind) { return (PROD_BUILDINGS[kind] || {}).ad || kind; }
function prodBuildingIcon(kind) { return (PROD_BUILDINGS[kind] || {}).ikon || '🏗️'; }
// KONSEY/TEKNOLOJİ etkileri: şehrin SAHİBİ devletin bonusu (oyuncu ve AI aynı yolu kullanır)
function prodStateBonus(n) {
    if (!n || n.owner == null || typeof storyState !== 'function') return null;
    const st = storyState(n.owner);
    return (st && st._techBonus) || null;
}
function prodBuildCost(kind, lvl, n) {
    const tbl = (PROD_BUILDINGS[kind] || {}).maliyet || PROD_BUILDINGS.bar.maliyet;
    const base = tbl[lvl] != null ? tbl[lvl] : null;   // null = maksimum
    if (base == null) return null;
    const tb = n ? prodStateBonus(n) : null;           // İstihkam Bürosu / Teknik Okullar: bina ucuzlar
    let m = (tb && tb.buildCost) || 1;
    // FAZ-7: İstihkamcı yeteneği — YALNIZ oyuncunun kendi kasasından ödediği inşaat
    if (typeof cmdrBonus === 'function' && n && n.owner === STORY.playerStateId) m *= cmdrBonus(STORY.commander).buildCost;
    return m === 1 ? base : Math.max(10, Math.round(base * m));
}
// Bina, şehir seviyesinin BİR ÜSTÜNE kadar çıkabilir.
// Eskiden bina ≤ şehir seviyesiydi. Şehirler nadiren yükseldiği için tüm dünya Sv.1'de
// kilitleniyordu: ölçümde 8 devletin 8'i de yalnız piyade+tanksavar üretebiliyordu
// (tank/topçu/mekanize hiç sahaya çıkmıyordu). Bir seviyelik pay, şehir yükseltmesini
// hâlâ anlamlı tutarken ordunun tek tipe hapsolmasını önler.
function prodMaxBuildLevel(n) { return Math.min(PROD_MAX_LEVEL, (n.level || 1) + 1); }

// Seviye kilitleri — üretim kademelenir.
// MEKANİZE Sv.3'ten Sv.2'ye alındı: Sv.3 kışla şehir Sv.2 gerektiriyor ve pratikte
// hiç ulaşılamıyordu; orta sınıf birlikler oyunda görünmüyordu.
// TANK Sv.3'ten Sv.2'ye ALINDI. Sv.3 fabrika tek şehirde 4 yükseltme demekti
// (şehir Sv.2 + fabrika 0→1→2→3) ve ölçümde 4 kampanya × 1800sn'de tank üretebilen
// şehir ortalama 1.3, üretilen tank 2 çıkıyordu — oyunda var olan bir birim
// pratikte hiç görünmüyordu. Maliyet düşürmek ve yatırımı yoğunlaştırmak yetmedi;
// sorun tuning değil YAPIYDI.
// Sv.3 anlamsız kalmıyor: PROD_SPEED[3]=2.2 ile SERİ ÜRETİM kademesi oluyor
// (yeni birim değil, aynı birimi iki kattan hızlı basmak).
// ROSTERDEN TÜRETİLİR (bkz. prodBuildingFor notu). Tek seferlik kurulur ve önbelleklenir:
// STATS sabittir, her çağrıda yeniden taramak gereksiz. Deterministik (tip indeksine göre sıralı).
let _PROD_UNLOCK = null;
function prodUnlockTable() {
    if (_PROD_UNLOCK) return _PROD_UNLOCK;
    const t = {};
    for (const k of PROD_KINDS) t[k] = { 1: [], 2: [], 3: [] };
    if (typeof STATS !== 'undefined') {
        const tipler = Object.keys(STATS).map(Number).filter(x => Number.isFinite(x)).sort((a, b) => a - b);
        // BİNA-İÇİ KADEME NORMALİZASYONU: roster kademesini DOĞRUDAN bina seviyesine yazmak,
        // en ucuz birimi tier-2 olan binaları (Topçu Parkı, Hava Savunma) Sv.1'de BOŞ bırakıyordu —
        // oyuncu binayı kurar, hiçbir şey üretemez. Onun yerine her binanın KENDİ kademeleri
        // sıralanıp 1..3'e eşlenir: en ucuz sınıfı Sv.1'de açılır, üstü sırayla gelir.
        // Böylece "kurduğum bina işe yaramıyor" durumu yapısal olarak oluşamaz.
        const kademeler = {};
        for (const tip of tipler) {
            const st = STATS[tip]; if (!st) continue;
            const kind = prodBuildingFor(tip);
            (kademeler[kind] = kademeler[kind] || new Set()).add(st.tier || 1);
        }
        const eslem = {};
        for (const kind of Object.keys(kademeler)) {
            const sirali = [...kademeler[kind]].sort((a, b) => a - b);
            eslem[kind] = {};
            sirali.forEach((tier, i) => { eslem[kind][tier] = Math.min(3, i + 1); });
        }
        for (const tip of tipler) {
            const st = STATS[tip];
            if (!st) continue;
            const kind = prodBuildingFor(tip);
            const lv = (eslem[kind] && eslem[kind][st.tier || 1]) || 1;
            t[kind][lv].push(tip);
        }
    }
    _PROD_UNLOCK = t;
    return t;
}
// Geriye dönük ad (eski kod/araçlar PROD_UNLOCK okuyabilir)
const PROD_UNLOCK = new Proxy({}, { get: (_, k) => prodUnlockTable()[k] });
// ── KADEME = BİNA + ŞEHİR (ölçümle eklendi, 2026-08-10) ──
// Altı binaya bölünce ÖLÇÜLDÜ: sahaya çıkan tip sayısı 15/26 → 10/26'ya DÜŞTÜ. Sebep kilit değil
// YATIRIMIN BÖLÜNMESİ: 900 sn'de topçu parkı 1, hava üssü 1, hava savunma 2 şehirde kurulabilmişti;
// her binayı ayrı ayrı Sv.3'e çıkarmak imkânsız. Kademe artık İKİ yatırımın toplamı:
//     kademe = bina seviyesi + şehir seviyesi − 1   (1..3 arası)
// Yani üst sınıfa iki yoldan ulaşılır: binayı büyüt VEYA şehri büyüt. Küçük şehirde uzmanlaşmış
// bina hâlâ temel sınıfı verir; başkentte tek seviye bina bile üst sınıfı açar. Şehir yükseltmesi
// böylece TÜM sınıflarda anlam kazanır (eski şikâyet: "şehir yükseltmenin anlamı yok").
function prodKademe(n, kind) {
    if ((n[kind] | 0) <= 0) return 0;                       // bina yoksa hiçbir kademe açık değil
    return Math.max(1, Math.min(3, (n[kind] | 0) + (n.level | 0) - 1));
}
function prodTypesFor(n, kind) {
    const lv = prodKademe(n, kind);
    const tbl = prodUnlockTable()[kind] || {};
    let out = [];
    for (let i = 1; i <= lv; i++) out = out.concat(tbl[i] || []);
    // BİRİM ÖN KOŞULU: kendi binası yeter sayılmaz — balistik füze fabrika Sv.2 ister vb.
    return out.filter(t => prodUnitReqMet(n, t));
}

// ── ÜRETİM SÜRESİ / KAPASİTE ──
const PROD_SPEED = [0, 1.0, 1.6, 2.2];   // bina seviyesi → hız çarpanı
function prodTime(n, kind, type) {
    const lv = Math.max(1, n[kind] | 0);
    const cost = (STATS[type] && STATS[type].cost) || 70;
    const tb = prodStateBonus(n);                                   // Montaj Hattı / Seri Üretim / Cunta: süre kısalır
    let sp = (tb && tb.prodSpeed) || 1;
    // FAZ-7: oyuncunun İDARE dalı (Lojistikçi/Levazım Reisi) KENDİ şehirlerinde hızlandırır
    if (typeof cmdrBonus === 'function' && n.owner === STORY.playerStateId) sp *= cmdrBonus(STORY.commander).prodSpeed;
    return Math.max(3, Math.round((cost / 12) / PROD_SPEED[lv] * sp));   // tank ~11sn, piyade ~6sn
}
function prodSlots(n, kind) { return 2 + (n[kind] | 0); }
function prodQueueCount(n, kind) {
    let c = 0;
    for (const j of (n.q || [])) if (prodBuildingFor(j.type) === kind) c++;
    return c;
}
// Havuz tavanı: altyapı + KOMUTAN KAPASİTESİ.
// Şehirde duran komutanın savaşçı yeteneği ne kadar ordunun sevk-idare edilebileceğini
// belirler — yetenekli komutanın olduğu şehir daha büyük ordu besler, komutansız şehir
// yalnız altyapı kadarını tutar. Tüm devletler için geçerli (storyForceAt taraf-agnostik).
const PROD_CMD_CAP_PER_SKILL = 3;   // warrior 0-6 → +0..+18 birim
function prodCommanderCap(n) {
    if (n.owner == null || typeof storyForceAt !== 'function') return 0;
    let best = 0;
    for (const c of storyForceAt(n.owner, n.id)) {
        const w = (c.skills && c.skills.warrior) || 0;
        if (w > best) best = w;
    }
    return best * PROD_CMD_CAP_PER_SKILL;
}
// (FAZ-8) Depo kaldırıldı. Bu iki yardımcı yalnız ESKİ KAYIT GÖÇÜ için duruyor:
// poolCap teknoloji/kanun etkisi artık komutan ordu kapasitesine değil, garnizon
// tavanına yansır (storyCityGarrisonCap).
function prodPoolCount(n) {
    let c = 0;
    for (const k in (n.pool || {})) c += n.pool[k] | 0;
    return c;
}

// ── ESKİ KAYIT BACKFILL (storyCommanderBackfill deseni) ──
function storyNodeBackfill(n, options) {
    if (!n) return;
    if (n.level == null) n.level = 1;
    if (n.garrison == null) n.garrison = 0;
    if (n.fac == null) n.fac = 0;
    if (n.bar == null) n.bar = 0;
    if (!n.pool || typeof n.pool !== 'object') n.pool = {};
    if (!Array.isArray(n.q)) n.q = [];
    // Eski bazı kayıtlarda üretim işi `type` alanı olmadan kalmıştı. Bu kayıt
    // kuyruğu kilitliyor ve ŞEHİR > ORDU görünümünü tamamen çökertiyordu.
    if (typeof STATS !== 'undefined') {
        n.q = n.q.filter(job => job && STATS[job.type] && Number.isFinite(Number(job.t)));
    }
    if (!(options && options.preserveRuntime)) n._siege = null;
}

// ── ŞEHİR SEVİYESİNİN ANLAMI ──
// Seviye yükseltmek eskiden yalnız gelir (+%40) veriyordu ve pahalı olduğu için değmiyordu.
// Artık dört şey birden açar: SAVUNMA bonusu (savaşta tahkimat), daha çok MİLİS, daha büyük
// GARNİZON tavanı ve daha yüksek BİNA tavanı (prodMaxBuildLevel).
const CITY_DEFENSE_BONUS = [0, 0.10, 0.25, 0.45];   // seviye → savunan birliklere HP/zırh avantajı
const CITY_MILITIA_BY_LEVEL = [0, 3, 5, 8];         // seviye → savunma düellosundaki taban milis
const CITY_UPGRADE_GAIN = [null, 'savunma +%25, milis 5', 'savunma +%45, milis 8', null];
function cityMilitiaFor(n) { return CITY_MILITIA_BY_LEVEL[n.level || 1] || 3; }
// Şehir savunması = seviye + sahibinin KONSEY kararları (Tahkimat Dairesi / Harp Akademileri)
function cityDefenseBonus(n) {
    const tb = prodStateBonus(n);
    return (CITY_DEFENSE_BONUS[n.level || 1] || 0) + ((tb && tb.cityDefense) || 0);
}

// ── HAVUZ GÜCÜ (stratejik katman görsün) ──
// Şehirde bekleyen ordu savunma gücüne katılır → AI "iyi savunulan şehre saldırma"yı
// ekstra kod olmadan öğrenir (storyEvalTarget/storyExposureAt bunu okur).
// (FAZ-8) Depo kalmadığı için 0 döner. Şehirde duran komutanların gücü zaten
// storyCalcDefenseStrength içinde storyCalcCommanderPower ile sayılıyor — burada
// tekrar saymak çift-sayım olurdu.
function storyPoolPower(n) { return 0; }

// ── BİNA KUR / YÜKSELT ──
function prodBuild(nodeId, kind) {
    const n = storyNode(nodeId);
    if (!n || n.owner !== STORY.playerStateId) return false;
    if (PROD_KINDS.indexOf(kind) < 0) return false;
    const lvl = n[kind] | 0;
    if (lvl >= PROD_MAX_LEVEL) { storyFlash(`${prodBuildingName(kind)} zaten maksimum seviye.`); return false; }
    if (lvl >= prodMaxBuildLevel(n)) {
        storyFlash(`Önce şehri yükselt — ${prodBuildingName(kind)} şehir seviyesini (Sv.${n.level || 1}) geçemez.`);
        return false;
    }
    // BİNA ÖN KOŞULU: binalar birbirine bağlı bir yapı kurar (sanayi olmadan topçu parkı yok).
    // Eksikse sebebi AÇIKÇA söylenir — oyuncu "neden kuramıyorum" diye tahmin etmesin.
    const _req = prodReqDurumu(n, prodBuildReqFor(kind, lvl + 1));
    if (!_req.tamam) {
        storyFlash(`${prodBuildingName(kind)} Sv.${lvl + 1} için önce: ${_req.eksik.join(' + ')}`);
        return false;
    }
    const cost = prodBuildCost(kind, lvl, n);
    const w = STORY.commander && STORY.commander.res;
    if (!w || (w.points || 0) < cost) { storyFlash(`⭐ Puan yetersiz (gerekli ${cost}).`); return false; }
    if (typeof storyBudgetDebit === 'function') {
        const paid = storyBudgetDebit(n.owner, cost, `build.${kind}`, {
            commander: STORY.commander,
            commanderOnly: true,
            correlationId: `build:${n.id}:${kind}:${lvl + 1}`
        });
        if (!paid.ok) { storyFlash(`⭐ Puan yetersiz (gerekli ${cost}).`); return false; }
    } else w.points -= cost;
    if (typeof storyResourceFlow === 'function') {
        storyResourceFlow(n.owner, `expense.build.${kind}`, { points: -cost }, {
            correlationId: `build:${n.id}:${kind}:${lvl + 1}`
        });
    }
    n[kind] = lvl + 1;
    storyLog(`🏭 <b>${n.name}</b>: ${prodBuildingName(kind)} Sv.${n[kind]} kuruldu.`);
    storySave();
    if (typeof storyCityUpdate === 'function') storyCityUpdate();
    return true;
}

// ── ÜRETİM KUYRUĞU ──
// Ödeme kuyruğa GİRERKEN yapılır: bedava sınırsız kuyruk sömürüsünü kapatır,
// muhasebe tek noktada kalır (storyCityUpgrade ile aynı kasa mantığı).
function prodEnqueue(nodeId, type) {
    const n = storyNode(nodeId);
    if (!n || n.owner !== STORY.playerStateId) return false;
    const kind = prodBuildingFor(type);
    if (prodTypesFor(n, kind).indexOf(type) < 0) {
        storyFlash(`${prodBuildingName(kind)} seviyesi bu birim için yetersiz.`);
        return false;
    }
    if (prodQueueCount(n, kind) >= prodSlots(n, kind)) { storyFlash(`${prodBuildingName(kind)} kuyruğu dolu.`); return false; }
    // FAZ-8: ŞEHİR DEPOSU KALDIRILDI — ürettiğin birlik SENİN ordunla buluşur.
    // Tavan artık depo değil, kendi sefer ordunun kapasitesi (yoldakiler dahil).
    const cmd = STORY.commander;
    if (cmdArmyCount(cmd) + prodPendingFor(cmd) >= cmdArmyCap(cmd)) {
        storyFlash(`Sefer ordun dolu (${cmdArmyCount(cmd)}/${cmdArmyCap(cmd)}) — savaş yeteneğini yükselt ya da orduyu kullan.`);
        return false;
    }
    // AŞAMA 3: ⚡ELEKTRONİK kapısı — tank/topçu modern sanayi ister
    const _stE = storyState(n.owner);
    if (typeof storyEconChipNeeds === 'function' && storyEconChipNeeds(type) > 0
        && _stE && (_stE.chips || 0) < storyEconChipNeeds(type)) {
        storyFlash(`⚡ Elektronik stoku yetersiz (${Math.floor(_stE.chips || 0)}/${storyEconChipNeeds(type)}) — Sv.2+ şehirler ve gelişmiş fabrikalar üretir.`);
        return false;
    }
    const g = UNIT_RES_GROUP[type] || 'manpower';
    const cost = (STATS[type] && STATS[type].cost) || 70;
    const w = cmd && cmd.res;
    if (!w || (w[g] || 0) < cost) { storyFlash(`Kaynak yetersiz (${cost} ${g}).`); return false; }
    if (g === 'points' && typeof storyBudgetDebit === 'function') {
        const paid = storyBudgetDebit(n.owner, cost, 'production.points', {
            commander: cmd,
            commanderOnly: true,
            correlationId: `production:${n.id}:${type}:${cmd.id}`
        });
        if (!paid.ok) return false;
    } else w[g] -= cost;
    if (typeof storyResourceFlow === 'function') {
        storyResourceFlow(n.owner, `expense.production.${g}`, { [g]: -cost }, {
            correlationId: `production:${n.id}:${type}:${cmd.id}`
        });
    }
    const t = prodTime(n, kind, type);
    n.q.push({ type, t, tot: t, cmd: cmd.id });   // cmd = birliğin teslim edileceği komutan
    if (typeof storyEconChipGate === 'function') storyEconChipGate(storyState(n.owner), type);   // AŞAMA 3: ⚡ düşümü
    storySave();
    if (typeof storyCityUpdate === 'function') storyCityUpdate();
    return true;
}

// İptal → %50 iade (plan değiştirmeyi cezalandırır ama kilitlemez)
function prodCancel(nodeId, idx) {
    const n = storyNode(nodeId);
    if (!n || n.owner !== STORY.playerStateId || !n.q || !n.q[idx]) return false;
    const job = n.q[idx];
    const stat = STATS[job.type];
    if (!stat) {
        n.q.splice(idx, 1);
        storySave();
        if (typeof storyCityUpdate === 'function') storyCityUpdate();
        return true;
    }
    const g = UNIT_RES_GROUP[job.type] || 'manpower';
    const back = Math.round((stat.cost || 70) * 0.5);
    const w = STORY.commander && STORY.commander.res;
    if (w && g === 'points' && typeof storyBudgetCredit === 'function') {
        storyBudgetCredit(n.owner, back, 'production.refund', {
            commander: STORY.commander,
            correlationId: `production-cancel:${n.id}:${job.type}:${job.cmd}`
        });
    } else if (w) w[g] = (w[g] || 0) + back;
    if (w && typeof storyResourceFlow === 'function') {
        storyResourceFlow(n.owner, `refund.production.${g}`, { [g]: back }, {
            correlationId: `production-cancel:${n.id}:${job.type}:${job.cmd}`
        });
    }
    n.q.splice(idx, 1);
    storyLog(`✖ ${stat.name} üretimi iptal (+${back} iade).`);
    storySave();
    if (typeof storyCityUpdate === 'function') storyCityUpdate();
    return true;
}

// Bir komutanın TÜM şehirlerdeki yoldaki siparişleri (kapasite hesabına girer)
function prodPendingFor(cmd) {
    if (!cmd) return 0;
    let c = 0;
    for (const n of STORY.nodes) for (const j of (n.q || [])) if (j && STATS[j.type] && j.cmd === cmd.id) c++;
    return c;
}
// ── GARNİZON KOMPOZİSYONU ──
// Eskiden garnizon yalnız bir SAYIydı (n.garrison) ve teslim edilen birliğin TİPİ atılıyordu.
// Sonuç: şehir topçu parkı kurup havan üretse bile savunma düellosunda sahaya hep
// piyade+tanksavar çıkıyordu (storySpawnGarrison'da elle yazılı ikili). Roster 26 birime
// açıldığına göre garnizon da ürettiğini yansıtmalı. n.garrisonUnits tipleri sayar;
// n.garrison ile TOPLAMI daima eşit tutulur, fazlası "tipsiz" sayılıp piyadeye düşer.
function storyGarrisonAdd(n, type) {
    if (!n || !STATS[type]) return;
    if (!n.garrisonUnits) n.garrisonUnits = {};
    n.garrisonUnits[type] = (n.garrisonUnits[type] | 0) + 1;
}
// k birlik eksilt: EN UCUZ tip önce gider (ağır teçhizat şehirde kalır — kuşatmada mantıklı olan bu)
function storyGarrisonRemove(n, k) {
    if (!n || !n.garrisonUnits) return;
    let kalan = Math.max(0, k | 0);
    const sirali = Object.keys(n.garrisonUnits).map(Number)
        .sort((a, b) => (((STATS[a] && STATS[a].cost) || 70) - ((STATS[b] && STATS[b].cost) || 70)) || (a - b));
    for (const t of sirali) {
        if (kalan <= 0) break;
        const d = Math.min(kalan, n.garrisonUnits[t] | 0);
        n.garrisonUnits[t] -= d; kalan -= d;
        if ((n.garrisonUnits[t] | 0) <= 0) delete n.garrisonUnits[t];
    }
}
// Savunma düellosunda sahaya çıkacak garnizon tipleri (uzunluk = istenen birlik sayısı).
// Kayıtlı tip yetmezse kalanı piyade/tanksavar tabanıyla doldurulur — eski kayıtlar da çalışır.
function storyGarrisonComposition(n, adet) {
    const out = [];
    const gu = (n && n.garrisonUnits) || {};
    for (const k of Object.keys(gu).map(Number).sort((a, b) => a - b)) {
        for (let i = 0; i < (gu[k] | 0) && out.length < adet; i++) if (STATS[k]) out.push(k);
    }
    for (let i = out.length; i < adet; i++) out.push((i % 3 === 0) ? T.ANTI_TANK : T.INFANTRY);
    return out;
}

// TESLİMAT: biten birlik sipariş eden komutanın SEFER ORDUSUNA katılır.
// Komutan ölmüş/ordusu dolmuşsa o şehirdeki başka bir dost komutana, o da yoksa
// GARNİZONA yazılır — üretim asla buharlaşmaz.
function prodDeliver(n, type, cmdId) {
    if (!STATS[type]) return 'invalid';
    const st = storyState(n.owner);
    let target = null;
    if (st && cmdId != null) target = storyCommanderById(st.id, cmdId);
    if (target && cmdArmyCount(target) >= cmdArmyCap(target)) target = null;
    if (!target && st) {
        for (const c of storyStateCommanders(st)) {
            if (c.node === n.id && cmdArmyCount(c) < cmdArmyCap(c)) { target = c; break; }
        }
    }
    if (target) {
        if (!target.army) target.army = {};
        target.army[type] = (target.army[type] | 0) + 1;
        if (target.isPlayer && typeof storyLog === 'function')
            storyLog(`🏭 <b>${n.name}</b>: ${STATS[type].name} ordana katıldı (${cmdArmyCount(target)}/${cmdArmyCap(target)}).`);
        return 'army';
    }
    const cap = storyCityGarrisonCap(n);
    if ((n.garrison | 0) < cap) {
        n.garrison = (n.garrison | 0) + 1;
        storyGarrisonAdd(n, type);                       // TİP KORUNUR: savunmada gerçekten bu birlik çıkar
        if (n.owner === STORY.playerStateId && typeof storyLog === 'function')
            storyLog(`🛡️ <b>${n.name}</b>: ${STATS[type].name} teslim edilemedi (ordu dolu) → garnizona katıldı.`);
        return 'garrison';
    }
    if (n.owner === STORY.playerStateId && typeof storyLog === 'function')
        storyLog(`⚠️ <b>${n.name}</b>: ${STATS[type].name} teslim edilemedi — ordu ve garnizon dolu.`);
    return 'lost';
}

// ── TICK: tüm düğümler (oyuncu + AI aynı motor) ──
// Fabrika ve kışla PARALEL hat işletir: biri tank yaparken diğeri piyade basar.
function prodTick(step) {
    if (typeof STORY === 'undefined' || !STORY.nodes) return;
    for (const n of STORY.nodes) {
        if (!n.q || !n.q.length) continue;
        n.q = n.q.filter(job => job && STATS[job.type] && Number.isFinite(Number(job.t)));
        if (!n.q.length) continue;
        const busy = { fac: 0, bar: 0 };
        for (const job of n.q) {
            const k = prodBuildingFor(job.type);
            if (busy[k]) continue;          // o bina bu tick zaten bir iş işliyor
            busy[k] = 1;
            job.t -= step * ((typeof storyFacStrikeMul === 'function') ? storyFacStrikeMul(n.owner, n.id) : 1);   // AŞAMA 2: grev
        }
        for (let i = n.q.length - 1; i >= 0; i--) {
            if (n.q[i].t > 0) continue;
            const ty = n.q[i].type;
            const cmdId = n.q[i].cmd;
            n.q.splice(i, 1);
            prodDeliver(n, ty, cmdId);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SEFER ORDUSU — ordu KOMUTANIN ÜZERİNDEDİR, komutanla birlikte gezer.
//  Üretilen birlik doğrudan sipariş eden komutanın ordusuna katılır (depo yok).
//  Kapasite komutanın savaş yeteneğine + gelişim ağacına bağlıdır.
// ═══════════════════════════════════════════════════════════════════════════
const CMD_ARMY_BASE = 6, CMD_ARMY_PER_SKILL = 3;   // savaşçı 0-6 → 6..24 birlik
// Komutanın ordu tavanı = taban + savaş yeteneği + gelişim ağacı + DEVLET kararları.
// FAZ-8: 'poolCap' etkisi (Yedek Ordu, İkmal Depoları, Zorunlu Askerlik, Topyekûn
// Seferberlik, Askeri Cunta…) depo kalkınca boşta kalmıştı — açıklamaları "ordu
// kapasitesi +N" diyordu ama hiçbir şeye bağlı değildi. Artık doğal karşılığına,
// sefer ordusu tavanına bağlanıyor. Devlet başına ölçeklendiği için komutan başına
// üçte biri uygulanır (yoksa 10 komutanlı devlet tek kanunla 100 birlik kazanırdı).
function cmdArmyCap(cmd) {
    if (!cmd) return 0;
    const w = (cmd.skills && cmd.skills.warrior) || 0;
    const t = (typeof cmdrIsPlayerToken === 'function' && cmdrIsPlayerToken(cmd)) ? cmdrBonus(cmd).armyCap : 0;
    const st = (cmd.st != null && typeof storyState === 'function') ? storyState(cmd.st) : null;
    const pc = (st && st._techBonus && st._techBonus.poolCap) || 0;
    return CMD_ARMY_BASE + w * CMD_ARMY_PER_SKILL + t + Math.round(pc / 3);
}
function cmdArmyCount(cmd) {
    let c = 0;
    for (const k in ((cmd && cmd.army) || {})) c += cmd.army[k] | 0;
    return c;
}
function cmdArmyPower(cmd) {
    let v = 0;
    for (const k in ((cmd && cmd.army) || {})) v += ((STATS[+k] && STATS[+k].cost) || 70) * (cmd.army[k] | 0);
    return Math.round(v / 20);
}
// devletin TOPLAM ordusu (tüm sefer orduları) — panel/istatistik
function storyStateArmyTotals(st) {
    const field = {};
    for (const cmd of storyStateCommanders(st)) for (const k in (cmd.army || {})) field[k] = (field[k] | 0) + (cmd.army[k] | 0);
    return { field, depot: {} };   // depot: geriye dönük uyumluluk (artık hep boş)
}

// ── SAVAŞA GİRERKEN KUVVET TOPLAMA ──
// Depo yok: savaşan şey komutanların SEFER ORDULARIDIR. Şehrin savunmasına
// garnizon/milis ayrıca katılır (storySpawnGarrison + cityMilitiaFor).
function storyMusterArmy(cmd, node, includeCity, stateId) {
    const avail = {}, src = [];
    if (cmd && cmd.army) {
        const take = {};
        for (const k in cmd.army) { const c = cmd.army[k] | 0; if (c > 0) { avail[k] = (avail[k] | 0) + c; take[k] = c; } }
        if (Object.keys(take).length) src.push({ cmdId: cmd.id, stateId: stateId, counts: take });
    }
    return { avail, src };
}
// O şehirde duran TÜM dost komutanların orduları birleşir (yığılma anlamlı olsun)
function storyMusterAt(stateId, nodeId, includeCity) {
    const st = storyState(stateId);
    const avail = {}, src = [];
    if (st) for (const cmd of storyStateCommanders(st)) {
        if (cmd.node !== nodeId || !cmd.army) continue;
        const take = {};
        for (const k in cmd.army) { const c = cmd.army[k] | 0; if (c > 0) { avail[k] = (avail[k] | 0) + c; take[k] = c; } }
        if (Object.keys(take).length) src.push({ cmdId: cmd.id, stateId: stateId, counts: take });
    }
    return { avail, src };
}
function storyCommanderById(stateId, id) {
    const st = storyState(stateId); if (!st) return null;
    for (const c of storyStateCommanders(st)) if (c.id === id) return c;
    return null;
}

// Kuvveti kaynağından DÜŞ (savaş başında) — kayıp kalıcı olsun diye
function storyDrainPool(src) {
    for (const s of (src || [])) {
        if (s.cmdId != null) {
            const cmd = storyCommanderById(s.stateId, s.cmdId);
            if (!cmd || !cmd.army) continue;
            for (const k in s.counts) {
                cmd.army[k] = Math.max(0, (cmd.army[k] | 0) - (s.counts[k] | 0));
                if (!cmd.army[k]) delete cmd.army[k];
            }
        }
    }
}

// Savaş sonu iade: sağ kalanlar + dizilmeyenler ÖNCE komutanın sefer ordusuna döner
// (ordu komutanla gezer), kapasite taşarsa bulunduğu şehrin deposuna düşer.
function storyReturnPool(counts, preferNode, stateId, src) {
    let placed = 0;
    // 1) sefer ordusu: kuvveti veren komutan(lar)
    const cmds = [];
    for (const s of (src || [])) if (s.cmdId != null) { const c = storyCommanderById(s.stateId != null ? s.stateId : stateId, s.cmdId); if (c) cmds.push(c); }
    if (!cmds.length && stateId === STORY.playerStateId && STORY.commander) cmds.push(STORY.commander);
    for (const cmd of cmds) {
        if (!cmd.army) cmd.army = {};
        const cap = cmdArmyCap(cmd);
        for (const k in (counts || {})) {
            while ((counts[k] | 0) > 0 && cmdArmyCount(cmd) < cap) { cmd.army[k] = (cmd.army[k] | 0) + 1; counts[k]--; placed++; }
        }
    }
    // 2) ordu kapasitesini aşan kısım: şehrin GARNİZONUNA yazılır (depo yok)
    let target = null;
    if (preferNode && preferNode.owner === stateId) target = preferNode;
    if (!target && cmds.length) target = storyNode(cmds[0].node);
    if (target && target.owner === stateId) {
        const cap = storyCityGarrisonCap(target);
        for (const k in (counts || {})) {
            while ((counts[k] | 0) > 0 && (target.garrison | 0) < cap) { target.garrison = (target.garrison | 0) + 1; counts[k]--; placed++; }
        }
    }
    return placed;
}

// ═══════════════════════════════════════════════════════════════════════════
//  ŞEHRE GİR PANELİ  (Story.js'ten taşındı — artık tüm şehir listesi değil, TEK şehir)
// ═══════════════════════════════════════════════════════════════════════════

// Odaktaki şehir: haritada seçtiğin herhangi bir şehir; seçim yoksa komutanının şehri.
// Sahiplik, yeni şehir dosyasının bilgi filtresinde yönetilir. Yabancı şehri burada
// reddetmek harita → şehir inceleme akışını tamamen kırıyordu.
function storyCityFocus() {
    const sel = storyNode(STORY.selectedNodeId);
    if (sel) return sel;
    return storyNode(STORY.commander && STORY.commander.node);
}

function storyCityOpen() {
    storyCouncilClose(); storyTechClose(); storyArmyClose(); if (typeof storyEconomyClose === 'function') storyEconomyClose();
    STORY._cityOpen = true;
    const p = document.getElementById('city-panel');
    if (p) { p.classList.add('open'); p.setAttribute('aria-hidden', 'false'); }
    document.getElementById('story-city-btn')?.classList.add('active');
    storyCityUpdate();
}
function storyCityClose() {
    STORY._cityOpen = false;
    const p = document.getElementById('city-panel');
    if (p) { p.classList.remove('open'); p.setAttribute('aria-hidden', 'true'); }
    document.getElementById('story-city-btn')?.classList.remove('active');
}
function storyCityToggle() { STORY._cityOpen ? storyCityClose() : storyCityOpen(); }

// Üretilebilir birim düğmeleri (kilitliler de gösterilir — hedef görünür olsun)
function prodUnitButtons(n, kind, wallet) {
    const open = prodTypesFor(n, kind);
    const all = [];
    for (let lv = 1; lv <= PROD_MAX_LEVEL; lv++) for (const t of (PROD_UNLOCK[kind][lv] || [])) all.push({ t, lv });
    if (!all.length) return '';
    let html = '';
    for (const { t, lv } of all) {
        const s = STATS[t]; if (!s) continue;
        const g = UNIT_RES_GROUP[t] || 'manpower';
        const icon = g === 'oil' ? '⛽' : g === 'points' ? '⭐' : '👥';
        const unlocked = open.indexOf(t) >= 0;
        const _chipNeed = (typeof storyEconChipNeeds === 'function') ? storyEconChipNeeds(t) : 0;
        const _stB = storyState(n.owner);
        const _chipOk = _chipNeed === 0 || (_stB && (_stB.chips || 0) >= _chipNeed);
        const afford = (wallet[g] || 0) >= s.cost && _chipOk;
        const sec = unlocked ? prodTime(n, kind, t) : prodTime({ [kind]: lv, level: n.level }, kind, t);
        html += unlocked
            ? `<button class="prod-btn cb-make" data-node="${n.id}" data-type="${t}" ${afford ? '' : 'disabled'} title="${s.name} — ${s.cost}${icon}${_chipNeed ? ' + ' + _chipNeed + '⚡' : ''}, ${sec} sn${_chipOk ? '' : ' — ⚡ stok yok'}">`
              + `<b>${s.name}</b><small>${icon}${s.cost}${_chipNeed ? ' ⚡' + _chipNeed : ''} · ${sec}sn</small></button>`
            : `<button class="prod-btn locked" disabled title="Seviye ${lv} gerekli"><b>${s.name}</b><small>🔒 SEVİYE ${lv}</small></button>`;
    }
    return html;
}

// Bina açıklaması VERİDEN üretilir: hangi kademede hangi birimler açılıyor + bağımlılığı.
// Elle yazılmış metin roster değişince yalan söylerdi (eski hâli "Seviye 3 topçu" diyordu,
// oysa topçu artık Topçu Parkı'nda üretiliyor).
function prodBinaAciklama(kind) {
    const t = prodUnlockTable()[kind] || {};
    const ad = tip => (STATS[tip] && STATS[tip].name) || tip;
    const par = [];
    for (const lv of [1, 2, 3]) {
        const l = (t[lv] || []).map(ad);
        if (l.length) par.push(`Sv.${lv} ${l.join(', ')}`);
    }
    const r = prodBuildReqFor(kind, 1);
    const on = Object.keys(r).length ? ` · Ön koşul: ${Object.keys(r).map(k => `${PROD_BUILDINGS[k].ad} Sv.${r[k]}`).join(' + ')}` : '';
    return (par.join(' · ') || 'Bu binada üretilebilir birim yok.') + on;
}

// manage=true → 🏗️ BİNALAR alt-görünümü (kur/yükselt burada); manage=false → ana
// görünüm (yalnız üretim düğmeleri — bina işlemleri BİNALAR'a taşındı, kullanıcı isteği)
function prodBuildingSection(n, kind, wallet, manage) {
    const lvl = n[kind] | 0;
    const cost = prodBuildCost(kind, lvl, n);
    const icon = prodBuildingIcon(kind);
    const label = (PROD_BUILDINGS[kind] || {}).ad || kind;
    const maxed = lvl >= PROD_MAX_LEVEL;
    const cityBlocked = !maxed && lvl >= prodMaxBuildLevel(n);
    // ÖN KOŞUL: bina bağımlılık grafiği (bkz. PROD_BUILD_REQ). Eksikse düğme yerine SEBEP gösterilir.
    const req = prodReqDurumu(n, prodBuildReqFor(kind, lvl + 1));
    let head = `<div class="prod-head"><span>${icon} ${label} <b>Seviye ${lvl}/${PROD_MAX_LEVEL}</b></span>`;
    if (maxed) head += `<span class="city-max">EN YÜKSEK</span>`;
    else if (cityBlocked) head += `<span class="prod-lock" title="Bina şehir seviyesini en fazla 1 aşar — şehir büyüsün">🔒 ŞEHİR SEVİYESİ ${n.level || 1}</span>`;
    else if (!req.tamam) head += `<span class="prod-lock" title="Bina bağımlılığı">🔒 ÖNCE ${req.eksik.join(' + ')}</span>`;
    else if (manage) head += `<button class="city-btn cb-build" data-node="${n.id}" data-kind="${kind}" ${(wallet.points || 0) < cost ? 'disabled' : ''}>`
        + `${lvl === 0 ? 'KUR' : `SEVİYE ${lvl + 1}`} (${cost} PUAN)</button>`;
    head += `</div>`;
    const body = manage
        ? `<div class="city-hint">${prodBinaAciklama(kind)}</div>`
        : (lvl > 0
            ? `<div class="prod-grid">${prodUnitButtons(n, kind, wallet)}</div>`
            : `<div class="city-hint">${prodBuildingName(kind)} kurulmadı — 🏗️ BİNALAR bölümünden kur.</div>`);
    return `<div class="prod-sec">${head}${body}</div>`;
}

function prodQueueSection(n) {
    const q = (n.q || []).filter(job => job && STATS[job.type]);
    if (!q.length) return `<div class="prod-sec"><div class="prod-head"><span>⏳ ÜRETİM</span><span class="city-max">kuyruk boş</span></div></div>`;
    let html = `<div class="prod-sec"><div class="prod-head"><span>⏳ ÜRETİM</span>`
        + `<span class="city-max">${PROD_KINDS.filter(k => (n[k] | 0) > 0)
            .map(k => `${prodBuildingIcon(k)} ${prodQueueCount(n, k)}/${prodSlots(n, k)}`).join(' · ') || 'bina yok'}</span></div>`;
    // Her binanın SIRADAKİ işi ilerler (paralel hat) — kalanlar "bekliyor"
    const active = { fac: 0, bar: 0 };
    q.forEach((job, i) => {
        const kind = prodBuildingFor(job.type);
        const running = !active[kind];
        if (running) active[kind] = 1;
        const pct = Math.max(0, Math.min(100, (1 - job.t / Math.max(1, job.tot)) * 100));
        html += `<div class="prod-row"><span class="prod-name">${prodBuildingIcon(kind)} ${STATS[job.type].name}</span>`
            + `<i class="prod-bar"><b style="width:${pct.toFixed(0)}%"></b></i>`
            + `<span class="prod-eta">${running ? Math.ceil(job.t) + 's' : 'bekliyor'}</span>`
            + `<button class="city-btn cb-cancel" data-node="${n.id}" data-idx="${i}" title="İptal (%50 iade)">✖</button></div>`;
    });
    return html + `</div>`;
}

// (FAZ-8) Depo paneli yerine: bu şehirde kimin ordusu var + garnizon durumu.
function prodPoolSection(n) {
    const st = storyState(n.owner);
    const here = st ? storyStateCommanders(st).filter(c => c.node === n.id) : [];
    const rows = here.map(c => {
        const cnt = cmdArmyCount(c), cap = cmdArmyCap(c);
        const col = cnt === 0 ? '#ff8a8a' : (cnt >= cap * 0.6 ? '#4cff7c' : '#ffd24c');
        return `<div class="pool-cmd"><span>${c.isPlayer ? '👑' : '🎖️'} ${c.name}</span>`
            + `<b style="color:${col}">${cnt}/${cap}</b></div>`;
    }).join('');
    const gar = n.garrison | 0, gcap = storyCityGarrisonCap(n);
    const pend = (n.q || []).length;
    return `<div class="prod-sec"><div class="prod-head"><span>⚔️ BU ŞEHİRDEKİ ORDU</span>`
        + `<span class="city-max">🛡️ garnizon ${gar}/${gcap}</span></div>`
        + (rows ? `<div class="pool-cmds">${rows}</div>`
                : `<div class="city-hint">Burada komutan yok — üretim yapabilmek için bir komutan gerekir.</div>`)
        + `<div class="city-hint">Ürettiğin birlik <b>doğrudan senin sefer ordunla</b> buluşur; ordun doluysa garnizona yazılır.`
        + (pend ? ` Şu an <b>${pend}</b> sipariş yolda.` : '') + `</div></div>`;
}

function storyCityUpdate() {
    if (!STORY._cityOpen) return;
    if (typeof storyCityDossierEnabled === 'function'
        && storyCityDossierEnabled()
        && typeof storyCityDossierUpdate === 'function') {
        return storyCityDossierUpdate();
    }
    const body = document.getElementById('city-body'); if (!body) return;
    const mine = STORY.nodes.filter(x => x.owner === STORY.playerStateId);
    const n = storyCityFocus();
    const title = document.getElementById('city-title');
    if (title) title.textContent = n ? n.name.toLocaleUpperCase('tr') : 'ŞEHİR';   // 'tr' şart: toUpperCase() 'i'→'I' yapar
    if (!n || n.owner !== STORY.playerStateId) { body.innerHTML = `<div class="city-hint">Hiç şehrin yok.</div>`; return; }

    const w = (STORY.commander && STORY.commander.res) || { oil: 0, manpower: 0, points: 0 };
    const lvl = n.level || 1, gar = n.garrison || 0, cap = storyCityGarrisonCap(n);
    const here = (STORY.commander && STORY.commander.node === n.id) ? ' 📍' : '';
    const isCap = (STORY._capitals && STORY._capitals.indexOf(n.id) >= 0) ? ' ★' : '';
    // ORGANİK BÜYÜME göstergesi: nüfus/zenginlik çubukları + sonraki seviye eşiği
    const req = (typeof CITY_LVL_REQ !== 'undefined') ? CITY_LVL_REQ[lvl] : null;
    const gbar = (lbl, val, target) => {
        const pct = Math.max(0, Math.min(100, target ? val / target * 100 : 100));
        return `<div class="city-grow"><span>${lbl}</span><i><b style="width:${pct.toFixed(0)}%"></b></i><em>${Math.round(val)}${target ? '/' + target : ''}</em></div>`;
    };
    const sub = STORY._citySub === 'binalar';

    const top =
        `<div class="city-top">🏰 <b>${n.name}</b>${here}${isCap} · Sv.${lvl} <span class="city-lvl">${mine.length} şehrin var</span>`
        + `<div class="city-stat">Gelir ⛽${n.oil || 0} 👥${n.cities || 0} ⭐${n.pts || 0} · 🛡️ savunma <b>+%${Math.round((CITY_DEFENSE_BONUS[lvl] || 0) * 100)}</b> · milis <b>${cityMilitiaFor(n)}</b></div>`
        + (req
            ? gbar('👥 Nüfus (bin)', n.pop || 0, req.pop) + gbar('💰 Zenginlik', n.wealth || 0, req.wealth)
              + `<div class="city-hint">Şehir <b>kendiliğinden</b> büyür: refah, binalar, kaynak yatakları hızlandırır; kuşatma, grev, huzursuzluk durdurur. İki eşik dolunca <b>Sv.${lvl + 1}</b>.</div>`
            : `<div class="city-hint">Şehir en yüksek seviyede — nüfus ${Math.round(n.pop || 0)}k.</div>`)
        + `<div class="city-acts">${STORY._citySub && STORY._citySub !== 'genel'
            ? `<button class="city-btn cb-sub" data-sub="genel">← ŞEHRE DÖN</button>`
            : `<button class="city-btn cb-sub" data-sub="binalar">🏗️ BİNALAR</button>
               <button class="city-btn cb-sub" data-sub="ordu">⚔️ ORDU ÜRET</button>`}</div>`
        + `</div>`;

    if (STORY._citySub === 'binalar') {   // 🏗️ BİNALAR: fabrika + kışla kur/yükselt
        body.innerHTML = top
            + PROD_KINDS.map(k => prodBuildingSection(n, k, w, true)).join('')
            + `<div class="city-hint">Bina seviyesi şehir seviyesini en fazla 1 aşar; şehir büyüdükçe tavan açılır.</div>`;
        return;
    }
    if (STORY._citySub === 'ordu') {      // ⚔️ ORDU ÜRET: birim üretimi burada (kullanıcı isteği)
        body.innerHTML = top
            + PROD_KINDS.filter(k => (n[k] | 0) > 0).map(k => prodBuildingSection(n, k, w, false)).join('')
            + prodQueueSection(n);
        return;
    }
    // GENEL görünüm: özet — üretim ORDU ÜRET'te, binalar BİNALAR'da (panel ferahladı)
    body.innerHTML = top
        + prodQueueSection(n)
        + `<div class="prod-sec"><div class="prod-head"><span>🛡️ GARNİZON <b>${gar}/${cap}</b></span>`
        + `<button class="city-btn cb-gar" data-node="${n.id}" ${(gar >= cap || (w.manpower || 0) < CITY_GARRISON_COST) ? 'disabled' : ''}>+1 (${CITY_GARRISON_COST}👥)</button></div>`
        + `<div class="city-hint">Savunma düellosunda birlik olarak savaşır; kuşatma savunmasını güçlendirir.</div></div>`
        + prodPoolSection(n);
}

// ── KIDEM: gaziler ayrı bedava ordu değil, havuz birimine yapışan kalite ──
// Eskiden storySpawnVeterans 14 birimi bedava sahaya koyuyordu; bu, "üretilmemiş ordu
// sahaya çıkmasın" kuralını delerdi. Artık aynı tipteki havuz birimine kıdem etiketi geçer.
function storyTagVeteran(u) {
    const vs = STORY._battleVets;
    if (!vs || !vs.length) return;
    const i = vs.findIndex(v => v.type === u.type && !v._used);
    if (i < 0) return;
    vs[i]._used = 1;
    const lvl = Math.max(1, vs[i].vet | 0);
    u.veteran = lvl;
    u.maxHp = Math.round(u.maxHp * (1 + 0.12 * lvl));
    u.hp = u.maxHp;
}

// ═══════════════════════════════════════════════════════════════════════════
//  AI ŞEHİR YÖNETİMİ  (Story.js:storyAICityDevelop'tan taşındı + üretim eklendi)
//  Oyuncu havuzdan ordu sürerken AI'nın da üretmesi ADALET ŞARTIDIR.
//  Maliyetler oyuncuyla birebir aynı; devletin en zengin komutanı öder.
// ═══════════════════════════════════════════════════════════════════════════

// AI için bina kur/yükselt (oyuncunun prodBuild'iyle aynı kurallar, farkı: sahiplik kontrolü ve kasa)
function aiTryBuild(n, st, payer) {
    // ALTI BİNA + BAĞIMLILIK: "en geri kalanı kur" sırası artık altı bina üzerinden işler.
    // ÖN KOŞULU SAĞLANMAYAN bina atlanır — yoksa AI parası varken kuramadığı binayı deneyip
    // her turu boşa harcar (ve sıradaki binaya hiç geçmez). Determinist: seviye, sonra sabit ad sırası.
    const kinds = PROD_KINDS.slice().sort((a, b) => ((n[a] | 0) - (n[b] | 0)) || (a < b ? -1 : 1));
    for (const kind of kinds) {
        const lvl = n[kind] | 0;
        if (lvl >= PROD_MAX_LEVEL || lvl >= prodMaxBuildLevel(n)) continue;
        if (!prodBuildReqMet(n, kind, lvl + 1)) continue;   // bina bağımlılığı sağlanmadı
        const cost = prodBuildCost(kind, lvl, n);
        if (!payer || !payer.res || (payer.res.points || 0) < cost) continue;
        if (typeof storyBudgetDebit === 'function') {
            const paid = storyBudgetDebit(st, cost, `build.${kind}`, {
                commander: payer,
                commanderOnly: true,
                correlationId: `build:${n.id}:${kind}:${lvl + 1}`
            });
            if (!paid.ok) continue;
        } else payer.res.points -= cost;
        if (typeof storyResourceFlow === 'function') {
            storyResourceFlow(st, `expense.build.${kind}`, { points: -cost }, {
                correlationId: `build:${n.id}:${kind}:${lvl + 1}`
            });
        }
        n[kind] = lvl + 1;
        return true;
    }
    return false;
}

// AI üretim doktrini: sınır şehri savunma ağırlıklı, iç şehir eldeki en iyi birim
function aiTryProduce(n, st, cmds) {
    const isBorder = (n.neighbors || []).some(nb => { const m = storyNode(nb); return m && m.owner !== n.owner; });
    let open = [];
    for (const k of PROD_KINDS) open = open.concat(prodTypesFor(n, k));
    // AŞAMA 3: ⚡ stoku yetmeyen tipler AI için de kapalı (tam simetri)
    if (typeof storyEconChipNeeds === 'function') {
        const _stC = storyState(n.owner);
        open = open.filter(t => storyEconChipNeeds(t) === 0 || (_stC && (_stC.chips || 0) >= storyEconChipNeeds(t)));
    }
    if (!open.length) return false;
    // ORDU DENGESİ: "hep en pahalıyı bas" kuralı orduyu tek tip yapıyordu — ölçümde 8 devletin
    // 8'i de yalnız piyade+tanksavar üretiyordu. Artık komutanın ELİNDEKİ eksik sınıf tercih
    // edilir: cephede savunma sınıfları, geride vurucu güç ağırlık kazanır.
    const payerCmd = cmds[0];
    const have = (payerCmd && payerCmd.army) || {};
    // SAVUNMA SINIFI — roster 26 birime açıldığı için ELLE ÜÇLÜ LİSTE yetmez oldu (eski hâli
    // [ANTI_TANK, INFANTRY, ENGINEER] idi; sınır şehirleri MANPADS/SPAAG/SAM/havan hiç tercih etmiyordu).
    // Veriden türet: zemin tutan ve gelen taarruzu kıran sınıflar — yaya, hava savunma, tahkimat.
    const prodSavunmaSinifi = t => {
        const s = STATS[t]; if (!s) return false;
        const rt = s.roleTags || [];
        return s.category === 'infantry' || s.category === 'air_defense' ||
            rt.indexOf('anti_armor') >= 0 || rt.indexOf('anti_air') >= 0 || rt.indexOf('line_holder') >= 0 ||
            (s.abilities || []).indexOf('build_trench') >= 0;
    };
    const weightOf = t => {
        let wgt = 10;
        wgt -= Math.min(8, (have[t] | 0) * 2.2);                        // elinde çoksa cazibesi düşer
        if (isBorder && prodSavunmaSinifi(t)) wgt += 5;                  // cephede savunma sınıfı (veriden)
        if (!isBorder) wgt += ((STATS[t] && STATS[t].cost) || 70) / 60; // geride vurucu güç
        return Math.max(0.6, wgt);
    };
    let tot = 0; const ws = open.map(t => { const v = weightOf(t); tot += v; return v; });
    let r = storyRandom('production') * tot, wanted = open[0];
    for (let i = 0; i < open.length; i++) { r -= ws[i]; if (r <= 0) { wanted = open[i]; break; } }

    const kind = prodBuildingFor(wanted);
    if (prodQueueCount(n, kind) >= prodSlots(n, kind)) return false;
    const g = UNIT_RES_GROUP[wanted] || 'manpower';
    const cost = (STATS[wanted] && STATS[wanted].cost) || 70;
    const payer = cmds.slice().sort((a, b) => ((b.res && b.res[g]) || 0) - ((a.res && a.res[g]) || 0))[0];
    if (!payer || !payer.res || (payer.res[g] || 0) < cost) return false;
    // FAZ-8: depo yok. Komutanın ordusu doluysa üretim DURMAZ — fazlası garnizona yazılır
    // (prodDeliver). Tamamen durdurulunca dünyanın toplam kuvveti çöküyordu: ölçümde
    // 8 devletin 2'si eleniyor, ortalama 11.1 → 7.8 şehre düşüyordu. Garnizon artık
    // ordunun doğal yedeği: şehir savunması beslenmeye devam eder.
    const armyFull = cmdArmyCount(payer) + prodPendingFor(payer) >= cmdArmyCap(payer);
    if (armyFull && (n.garrison | 0) >= storyCityGarrisonCap(n)) return false;   // ordu DA garnizon DA dolu
    if (g === 'points' && typeof storyBudgetDebit === 'function') {
        const paid = storyBudgetDebit(st, cost, 'production.points', {
            commander: payer,
            commanderOnly: true,
            correlationId: `production:${n.id}:${wanted}:${payer.id}`
        });
        if (!paid.ok) return false;
    } else payer.res[g] -= cost;
    if (typeof storyResourceFlow === 'function') {
        storyResourceFlow(st, `expense.production.${g}`, { [g]: -cost }, {
            correlationId: `production:${n.id}:${wanted}:${payer.id}`
        });
    }
    const t = prodTime(n, kind, wanted);
    n.q.push({ type: wanted, t, tot: t, cmd: payer.id });
    if (typeof storyEconChipGate === 'function') storyEconChipGate(storyState(n.owner), wanted);   // AŞAMA 3: AI ⚡ düşümü
    return true;
}

// ── KOMUTAN YEREL YATIRIMI (TÜM devletler, OYUNCUNUN devleti dahil) ──
// "sadece ben garnizon koymayayım, komutanlar da dinamik olsun."
// Her komutan DURDUĞU şehre kendi kasasından yatırım yapar. Öncelik durumsaldır:
// cephe şehrinde garnizon, geride üretim altyapısı. Oyuncunun kendi jetonu hariç
// (senin kasan senin kararın) — ama devletindeki diğer komutanlar artık pasif değil.
const CMD_INVEST_CHANCE = 0.5;    // her tick'te komutan başına yatırım olasılığı
const CMD_GARRISON_SOFT_CAP = 4;  // komutan garnizonu bu sayıya kadar takviye eder, ötesi israf
const HEAVY_INVEST_POINTS = 900;  // bu eşiğin üstünde kasa → ağır sanayi yatırımı (üst kademe bina/şehir)
// ÖNCELİK SIRASI ÖNEMLİ: ilk sürümde garnizon en başta geliyordu ve komutanlar bütün
// insan gücünü garnizona yatırıp ORDU KURMUYORDU. Ölçümde oyuncu devletinin garnizonu
// 9→39 çıkarken sefer ordusu 22'de takılıyor, AI 536'ya ulaşıp oyuncuyu 731sn'de siliyordu.
// Artık ÖNCE ORDU: komutan kendi seferi ordusunu doldurmadan altyapıya/garnizona geçmez.
function storyCommanderCityTick() {
    for (const st of STORY.states) {
        if (!st.gov) continue;
        for (const cmd of storyStateCommanders(st)) {
            if (cmd.isPlayer) continue;                       // oyuncunun kasasına karışma
            if (storyRandom('production') > CMD_INVEST_CHANCE) continue;
            const n = storyNode(cmd.node);
            if (!n || n.owner !== st.id || !cmd.res) continue;
            const front = (n.neighbors || []).some(nb => { const m = storyNode(nb); return m && m.owner !== st.id; });
            const gar = n.garrison || 0, garCap = Math.min(CMD_GARRISON_SOFT_CAP, storyCityGarrisonCap(n));
            const hungry = cmdArmyCount(cmd) < cmdArmyCap(cmd) * 0.75;   // ordusu eksik mi?

            // 0) ALTYAPI GERİ KALDIYSA önce bina: Sv.1 bina yalnız piyade/keşif/tanksavar
            // üretebiliyor. Ölçümde tüm dünya burada kilitlenip tek tip orduya düşüyordu,
            // bu yüzden bina yükseltmesi ordu üretiminin ÖNÜNE alındı (ucuzsa ve gerekliyse).
            const weakInfra = ((n.bar | 0) < 2 || (n.fac | 0) < 2) && (n.bar | 0) + (n.fac | 0) < 4;
            if (weakInfra && storyRandom('production') < 0.55 && aiTryBuild(n, st, cmd)) continue;

            // 1) ORDU EKSİK → üret (savaşan ordu her şeyden önce gelir)
            if (hungry && aiTryProduce(n, st, [cmd])) continue;
            // 2) CEPHE ŞEHRİ + garnizon çok zayıf → asgari savunma refleksi
            if (front && gar < garCap && cmd.res.manpower >= CITY_GARRISON_COST) {
                cmd.res.manpower -= CITY_GARRISON_COST; n.garrison = gar + 1;
                continue;
            }
            // 3) altyapı eksik → bina kur (üretim kapasitesi uzun vadeli ordu demektir)
            if (aiTryBuild(n, st, cmd)) continue;
            // 4) ORGANİK BÜYÜME: şehir seviyesi artık SATIN ALINMAZ — komutan parası
            // şehrin zenginliğine akar, büyümeyi hızlandırır (nüfus/zenginlik eşiği bekler).
            if ((n.level || 1) < 3 && cmd.res.points >= 120 && storyRandom('production') < 0.4) {
                const paid = typeof storyBudgetDebit === 'function'
                    ? storyBudgetDebit(st, 120, 'city.investment', {
                        commander: cmd,
                        commanderOnly: true,
                        correlationId: `city-investment:${n.id}:${cmd.id}`
                    }).ok
                    : (cmd.res.points -= 120, true);
                if (paid) { n.wealth = (n.wealth || 0) + 6; continue; }
            }
            // 5) geride kalan garnizon boşluğu (yalnız yumuşak tavana kadar)
            if (gar < garCap && cmd.res.manpower >= CITY_GARRISON_COST) {
                cmd.res.manpower -= CITY_GARRISON_COST; n.garrison = gar + 1;
                continue;
            }
            // 6) ordu doluysa bile üretime devam (depo birikir, diğer komutanlar sevk alır)
            aiTryProduce(n, st, [cmd]);
        }
    }
}

// DEVLET DÜZEYİ GELİŞTİRME — komutanın bulunmadığı GERİ şehirler de gelişsin.
// Bu döngü eskiden yalnız AI devletleri için çalışıyordu; komutan-düzeyi yatırım eklenince
// AI hem devlet hem komutan katmanından yatırım yapar, oyuncunun devleti yalnız komutan
// katmanından yapar oldu. Ölçüm: oyuncu 19→1 şehre düştü, AI sefer ordusu 881'e çıktı.
// Artık TÜM devletler için çalışır (oyuncunun KENDİ kasası hariç — o senin kararın).
// ── SANAYİ MERKEZLERİ ──
// Komutanlar durdukları şehre yatırım yapıyor ve sürekli hareket ettikleri için yatırım
// 80 şehre dağılıyordu: ölçümde 4 kampanyada tank üretebilen şehir ortalama 0.8, üretilen
// tank 0 idi (devletlerde 3750⭐ birikmişken). Ağır sanayi YOĞUNLAŞMA ister.
// Her devlet birkaç şehri sanayi merkezi seçer ve devlet bütçesi ORAYA akar.
const INDUSTRY_CENTERS = 3;
function storyIndustrialCenters(st) {
    const owned = STORY.nodes.filter(n => n.owner === st.id);
    if (!owned.length) return [];
    const capId = (STORY._capitals || [])[st.id];
    const val = n => (n.oil || 0) * 2 + (n.pts || 0) * 2 + (n.cities || 0) * 1.5
        + (n.id === capId ? 10 : 0)                                    // başkent daima merkez
        + ((n.fac | 0) + (n.bar | 0)) * 2 + (n.level || 1) * 2;        // başlanmış işi bitir
    return owned.sort((a, b) => val(b) - val(a)).slice(0, INDUSTRY_CENTERS);
}
// Merkezde sıradaki mantıklı yatırım: şehir tavanı bina tavanını kısıtlıyorsa şehri,
// değilse binayı yükselt. Ödeme devletin en zengin komutanından.
function storyInvestCenter(st, n, payer) {
    if (!payer || !payer.res) return false;
    const facBlocked = (n.fac | 0) >= prodMaxBuildLevel(n) && (n.fac | 0) < PROD_MAX_LEVEL;
    const barBlocked = (n.bar | 0) >= prodMaxBuildLevel(n) && (n.bar | 0) < PROD_MAX_LEVEL;
    // ORGANİK BÜYÜME: seviye satın alınmaz. Bina tavana dayandıysa merkez, devlet
    // parasını şehre ZENGİNLİK olarak enjekte eder — büyüme hızlanır, eşik dolunca
    // seviye kendiliğinden gelir (storyCityGrowthTick).
    if ((facBlocked || barBlocked) && (n.level || 1) < 3) {
        if ((payer.res.points || 0) >= 120) {
            const paid = typeof storyBudgetDebit === 'function'
                ? storyBudgetDebit(st, 120, 'city.investment', {
                    commander: payer,
                    commanderOnly: true,
                    correlationId: `city-investment:${n.id}:${payer.id}`
                }).ok
                : (payer.res.points -= 120, true);
            if (paid) { n.wealth = (n.wealth || 0) + 6; return true; }
        }
        return false;
    }
    return aiTryBuild(n, st, payer);
}


// ── ORGANİK ŞEHİR BÜYÜMESİ (kullanıcı isteği) ──────────────────────────────
// "Şehir yükselmesi puanla değil; nüfusu artarak, parasal zenginleşerek KENDİ
// KENDİNE olmalı." Taban ölçümü bunu destekledi: satın-almalı sistemde 600 sn'de
// 82 şehrin SIFIRI yükselmişti — sistem fiilen ölüydü.
// Sürücüler: refah + binalar + kaynak yatakları büyütür; kuşatma, grev ve
// huzursuzluk durdurur/yavaşlatır. AI yatırımları artık şehre ZENGİNLİK enjekte
// eder (satın alma yerine) — para hâlâ anlamlı, ama seviye organik gelir.
const CITY_LVL_REQ = [null, { pop: 30, wealth: 18 }, { pop: 70, wealth: 55 }];   // → Sv.2, → Sv.3
function storyCityGrowthTick(dt) {
    for (const n of STORY.nodes) {
        const st = storyState(n.owner); if (!st) continue;
        if (n.pop == null) {                                   // göç: eski kayıt / yeni düğüm
            const lv = n.level || 1;
            n.pop = 10 + (lv - 1) * 28 + storyRandom('production') * 4;
            n.wealth = (lv - 1) * 20;
        }
        if (n._siege) continue;                                // kuşatılan şehir büyümez
        const strike = typeof storyCollectiveEnabled === 'function' && storyCollectiveEnabled()
            && typeof storyCollectiveRegionStrikeActive === 'function'
            ? storyCollectiveRegionStrikeActive(n.id)
            : st._strikeUntil && st._strikeUntil > (STORY.clock || 0);
        const unr = (typeof storyFacUnrest === 'function') ? storyFacUnrest(st) : 0;
        const infra = prodInfraLevel(n);                       // ALTI BİNA: tesis toplamı
        const bootstrapPlanning = typeof storyFeatureEnabled !== 'function'
            || storyFeatureEnabled('economy.bootstrapPlanning');
        if (bootstrapPlanning) {
            const needs = typeof storyNeedsRegionView === 'function'
                ? storyNeedsRegionView(`region:${Number(n.id)}`)
                : null;
            const foodAccess = needs ? Math.max(0, Math.min(1,
                Number(needs.foodAccessBps) / 10000)) : 1;
            const energyAccess = needs ? Math.max(0, Math.min(1,
                Number(needs.energyAccessBps) / 10000)) : 1;
            const essentialAccess = Math.min(foodAccess, energyAccess);
            const annualRate = Math.max(-0.025, Math.min(0.025,
                0.008
                + (Number(st.welfare) - 50) * 0.00015
                - (1 - essentialAccess) * 0.03
                - unr * 0.00008
            ));
            const years = Math.max(0, Number(dt) || 0)
                / ((typeof STORY_CALENDAR !== 'undefined'
                    && Number(STORY_CALENDAR.secondsPerYear)) || 120);
            const strikeMultiplier = strike ? 0.25 : 1;
            // Eski dünyanın 140 binlik tavanı başlangıç yapı stokunun uyumluluk
            // karşılığıdır. Yalnız tamamlanma makbuzlu yeni konut bu tavanı açar;
            // çizilmiş fakat tamamlanmamış ilçe nüfus kapasitesi üretmez.
            const housingPopulationCap = typeof storyHexConstructionHousingPopulationCap === 'function'
                ? storyHexConstructionHousingPopulationCap(`region:${Number(n.id)}`, 140)
                : 140;
            n.pop = Math.max(4, Math.min(
                housingPopulationCap,
                n.pop + n.pop * annualRate * years * strikeMultiplier
            ));
        } else {
            let g = 0.012 + (st.welfare - 40) * 0.0009 + infra * 0.005 + ((n.oil || 0) + (n.pts || 0)) * 0.002 - unr * 0.0006;
            if (strike) g *= 0.25;
            n.pop = Math.max(4, Math.min(140, n.pop + g * dt));
        }
        // Katsayılar ölçümle kalibre: ilk değerlerde 600 sn'de yalnız 2-5 şehir Sv.2
        // olabiliyordu (hedef bant 5-20) — darboğaz zenginlik birikimindeydi.
        n.wealth = Math.max(0, Math.min(200, (n.wealth || 0)
            + (0.012 + (n.pts || 0) * 0.007 + prodIndustryLevel(n) * 0.010) * (Math.max(10, st.welfare) / 50) * dt));
        const req = CITY_LVL_REQ[n.level || 1];
        if (req && n.pop >= req.pop && n.wealth >= req.wealth) {
            n.level = (n.level || 1) + 1;
            if (n.owner === STORY.playerStateId) {
                storyLog(`🏙️ <b>${n.name}</b> büyüdü — <b>Sv.${n.level}</b> (nüfus ${Math.round(n.pop)}k). Bina tavanı yükseldi.`);
                if (typeof storyFlash === 'function') storyFlash(`🏙️ ${n.name} Sv.${n.level} oldu`);
                if (typeof storyNews === 'function') storyNews('level', { city: n.name, pop: Math.round(n.pop) });
            } else if (typeof storyNews === 'function' && storyRandom('production') < 0.15) {
                storyNews('level', { city: n.name, pop: Math.round(n.pop) });
            }
        }
    }
}

function storyAICityTick() {
    storyCommanderCityTick();   // önce komutanların yerel yatırımı (oyuncu devleti dahil)
    for (const st of STORY.states) {
        if (!st.gov) continue;
        const owned = STORY.nodes.filter(n => n.owner === st.id); if (!owned.length) continue;
        const border = owned.filter(n => n.neighbors.some(nb => { const m = storyNode(nb); return m && m.owner !== st.id; }));
        const pick = border.length ? border : owned;
        const n = pick[storyRandomInt('production', pick.length)];
        const cmds = storyStateCommanders(st).filter(c => !c.isPlayer);   // oyuncunun kasasına dokunma
        if (!cmds.length) continue;

        // AĞIR SANAYİ: devlet bütçesinin bir kısmı sanayi merkezlerine akar (yoğunlaşma).
        // Bu olmadan yatırım 80 şehre dağılıyor ve hiçbiri tank/topçu kademesine çıkamıyordu.
        if (storyRandom('production') < 0.55) {
            const centers = storyIndustrialCenters(st);
            const rich = cmds.slice().sort((a, b) => ((b.res && b.res.points) || 0) - ((a.res && a.res.points) || 0))[0];
            let done = false;
            for (const c of centers) { if (storyInvestCenter(st, c, rich)) { done = true; break; } }
            if (done) continue;
        }
        const rich = g => cmds.slice().sort((a, b) => ((b.res && b.res[g]) || 0) - ((a.res && a.res[g]) || 0))[0];
        // SİMETRİK MALİYET: oyuncuyla AYNI — garnizon 70👥, şehir 300/600⭐, bina FACTORY/BARRACKS_COST
        const r = storyRandom('production');
        if (r < 0.28) {
            const p = rich('manpower');
            if ((n.garrison || 0) < storyCityGarrisonCap(n) && p && p.res && p.res.manpower >= CITY_GARRISON_COST) {
                p.res.manpower -= CITY_GARRISON_COST; n.garrison = (n.garrison || 0) + 1;
            }
        } else if (r < 0.45) {
            // ORGANİK BÜYÜME: devlet parası şehrin zenginliğine akar (seviye kendiliğinden)
            const p = rich('points');
            if ((n.level || 1) < 3 && p && p.res && p.res.points >= 120) {
                const paid = typeof storyBudgetDebit === 'function'
                    ? storyBudgetDebit(st, 120, 'city.investment', {
                        commander: p,
                        commanderOnly: true,
                        correlationId: `city-investment:${n.id}:${p.id}`
                    }).ok
                    : (p.res.points -= 120, true);
                if (paid) n.wealth = (n.wealth || 0) + 6;
            }
        } else if (r < 0.68) {
            aiTryBuild(n, st, rich('points'));
        } else {
            aiTryProduce(n, st, cmds);
        }
    }
}

// ── FETİH: havuz ganimet/imha ──
// Şehir el değiştirince orada bekleyen ordu yok olur; küçük bir kısmı fatihe kalır.
// Snowball'u sınırlar ama "şehri almak orduyu da almaktır" hissini korur.
function storyCaptureNodePool(n) {
    if (typeof storyEraFlip === 'function') storyEraFlip();   // FAZ-10: oynaklık ölçümü
    if (!n) return;
    const keep = {};
    for (const k in (n.pool || {})) {
        const c = n.pool[k] | 0;
        const g = Math.floor(c * 0.25);
        if (g > 0) keep[k] = g;
    }
    n.pool = keep;
    n.q = [];   // üretim kuyruğu fetihle dağılır
}

// ── AI BÜTÇESİ: havuzdan türetilir ──
// Adalet şartı: kimse kurmadığı orduyu sahaya süremez. AI hâlâ tipli bütçe harcar
// DEPLOY_RES.red bütçesi artık gerçekten üretilen ordunun değeridir.
function storyPoolBudget(stateId, cityId, opts) {
    opts = opts || {};
    // SEFER ORDUSU modeli: o şehirde duran komutanların orduları (+ savunmada şehrin deposu).
    // Eskiden komşu şehirlerin havuzları da toplanıyordu; artık ordu komutanla gezdiği için
    // "kim oradaysa o savaşır" kuralı geçerli — oyuncuyla birebir aynı.
    const m = storyMusterAt(stateId, cityId, !!opts.garrison);
    const b = { oil: 0, manpower: 0, points: 0 };
    for (const k in m.avail) {
        const t = +k, g = UNIT_RES_GROUP[t] || 'manpower';
        b[g] += ((STATS[t] && STATS[t].cost) || 70) * (m.avail[k] | 0);
    }
    const node = storyNode(cityId);
    if (opts.garrison && node) b.manpower += (node.garrison || 0) * 50;
    if (opts.floor) b.manpower = Math.max(b.manpower, opts.floor);
    const st = storyState(stateId);
    const div = (st && st._techBonus && st._techBonus.allCost) || 1;
    for (const g in b) b[g] = Math.max(0, Math.min(4200, Math.round(b[g] / div)));
    return { budget: b, src: m.src };
}
