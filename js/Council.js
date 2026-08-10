// ═══════════════════════════════════════════════════════════════════════════
//  KONSEY & TAKVİM (PIXEL EUROPA — Faz-4)
//  · TAKVİM: 1 yıl = 120 sn, 4 mevsim. STORY.clock üzerine ince bir katman.
//  · KONSEY: her 2 yılda bir BAŞKENTTE toplanır, DÜNYA DURUR (olay).
//    Gündem maddeleri: teknoloji · kanun · anayasa · atama · devlet önergesi.
//    Tüm komutanlar OY VERİR, YÖNETİCİ son kararı koyar (konseyi ezmek sadakate mal olur).
//  · Bu motor TÜM DEVLETLER için çalışır — AI devletleri sessizce aynı gündemi çözer.
//  Etki anahtarları techTree.js ile ORTAK; Story.js storyComputeBonusFrom() ile birleştirir.
// ═══════════════════════════════════════════════════════════════════════════

// ── TAKVİM ───────────────────────────────────────────────────────────────────
const YEAR_SECONDS = 120;                 // 1 oyun-yılı = 120 sn
const COUNCIL_PERIOD_YEARS = 2;           // konsey 2 yılda bir toplanır
const STORY_START_YEAR = 2032;   // MODERN ÇAĞ: kurgusal yakın gelecek
const SEASON_NAMES = ['İLKBAHAR', 'YAZ', 'SONBAHAR', 'KIŞ'];
const SEASON_ICONS = ['🌱', '☀️', '🍂', '❄️'];

function storyYear() {
    return typeof storyCalendarNow === 'function'
        ? storyCalendarNow().year
        : STORY_START_YEAR + Math.floor((STORY.clock || 0) / YEAR_SECONDS);
}
function storyYearFloat() { return (STORY.clock || 0) / YEAR_SECONDS; }
function storySeasonIdx() {
    return typeof storyCalendarNow === 'function'
        ? storyCalendarNow().seasonIndex
        : Math.min(3, Math.floor(((STORY.clock || 0) % YEAR_SECONDS) / (YEAR_SECONDS / 4)));
}
// TARİH: kullanıcı isteğiyle SAYISAL biçim (GG.AA.YYYY). 1 yıl = 120 sn → 360 kurgu
// günü; gün/ay oyun saatinden türer. Mevsim fonksiyonları içeride yaşamaya devam
// eder (çağ/konsey metinleri mevsim havasını kullanabilir).
function storyDayOfYear() {
    return typeof storyCalendarNow === 'function'
        ? storyCalendarNow().dayOfYear
        : Math.floor(((STORY.clock || 0) % YEAR_SECONDS) / YEAR_SECONDS * 360);
}
function storyDateLabel() {
    if (typeof storyCalendarNow === 'function') return storyCalendarNow().label;
    const d = storyDayOfYear();
    const gg = String(1 + (d % 30)).padStart(2, '0'), aa = String(1 + Math.floor(d / 30)).padStart(2, '0');
    return `${gg}.${aa}.${storyYear()}`;
}
function storyDateShort() { return storyDateLabel(); }

// ── KANUNLAR (her slot = tek seçim; konsey değiştirir) ───────────────────────
// appeal: komutanın oyunu belirler (warrior/diplomat/economist katsayısı + aggr kişilik ağırlığı)
const LAW_SLOTS = [
    { key: 'conscription', icon: '🎖️', name: 'Askerlik Düzeni', options: [
        { id: 'volunteer', name: 'Gönüllü Ordu',          desc: 'Piyade −%10 insan gücü · refah +4',                 effect: { manpowerCost: 0.90 }, welfare: 4,  appeal: { diplomat: 1.3, economist: 0.4, aggr: -1 } },
        { id: 'draft',     name: 'Zorunlu Askerlik',      desc: 'Ordu kapasitesi +4 · refah −3',                     effect: { poolCap: 4 },         welfare: -3, appeal: { warrior: 1.1, aggr: 1 } },
        { id: 'total',     name: 'Topyekûn Seferberlik',  desc: 'Kapasite +8, üretim −%10 süre · refah −8',          effect: { poolCap: 8, prodSpeed: 0.90 }, welfare: -8, appeal: { warrior: 1.8, aggr: 2.2, economist: -0.6 } },
    ]},
    { key: 'economy', icon: '💰', name: 'Ekonomi Düzeni', options: [
        { id: 'free',      name: 'Serbest Piyasa',        desc: '⭐puan geliri +%15 · refah +3',                      effect: { pointsIncome: 1.15 }, welfare: 3,  appeal: { economist: 1.5, diplomat: 0.5, aggr: -0.8 } },
        { id: 'mixed',     name: 'Karma Ekonomi',         desc: '⛽ ve 👥 geliri +%8 · dengeli',                      effect: { oilIncome: 1.08, manIncome: 1.08 }, welfare: 1, appeal: { economist: 0.9, diplomat: 0.6 } },
        { id: 'command',   name: 'Kumanda Ekonomisi',     desc: 'Birim maliyeti −%12, bina −%15 · refah −5',         effect: { allCost: 0.88, buildCost: 0.85 }, welfare: -5, appeal: { warrior: 1.2, economist: 0.7, aggr: 1.2 } },
    ]},
    { key: 'industry', icon: '🏭', name: 'Sanayi Politikası', options: [
        { id: 'private',   name: 'Özel Sanayi',           desc: '⭐puan geliri +%10 · refah +3',                      effect: { pointsIncome: 1.10 }, welfare: 3,  appeal: { economist: 1.4, aggr: -0.6 } },
        { id: 'state',     name: 'Devlet Fabrikaları',    desc: 'Üretim süresi −%12 · bina −%10',                    effect: { prodSpeed: 0.88, buildCost: 0.90 }, welfare: 0, appeal: { economist: 0.8, warrior: 0.8 } },
        { id: 'heavy',     name: 'Ağır Sanayi Seferberliği', desc: 'Üretim −%20 süre, kapasite +5 · refah −6',       effect: { prodSpeed: 0.80, poolCap: 5 }, welfare: -6, appeal: { warrior: 1.6, aggr: 1.8, diplomat: -0.5 } },
    ]},
    { key: 'tax', icon: '🧾', name: 'Vergi Rejimi', options: [
        { id: 'low',       name: 'Düşük Vergi',           desc: 'Refah +6 · gelir artışı yok',                       effect: {},                     welfare: 6,  appeal: { diplomat: 1.4, aggr: -1 } },
        { id: 'moderate',  name: 'Ilımlı Vergi',          desc: 'Tüm gelir +%8 · refah +1',                          effect: { pointsIncome: 1.08, oilIncome: 1.08, manIncome: 1.08 }, welfare: 1, appeal: { economist: 1.2, diplomat: 0.4 } },
        { id: 'heavy',     name: 'Ağır Vergi',            desc: 'Tüm gelir +%18 · refah −7',                         effect: { pointsIncome: 1.18, oilIncome: 1.18, manIncome: 1.18 }, welfare: -7, appeal: { economist: 1.6, warrior: 0.5, diplomat: -1.2 } },
    ]},
    { key: 'press', icon: '📰', name: 'Basın & Bilgi', options: [
        { id: 'free',      name: 'Özgür Basın',           desc: 'Refah +5 · sadakat dalgalı',                        effect: {},                     welfare: 5,  appeal: { diplomat: 1.6, aggr: -1.2 } },
        { id: 'guided',    name: 'Denetimli Basın',       desc: 'Sadakat erimesi −%25',                              effect: { loyaltyHold: 0.75 },  welfare: 0,  appeal: { diplomat: 0.5, warrior: 0.6 } },
        { id: 'censor',    name: 'Sıkı Sansür',           desc: 'Sadakat erimesi −%55 · refah −6',                   effect: { loyaltyHold: 0.45 },  welfare: -6, appeal: { warrior: 1.3, aggr: 1.4, diplomat: -1.4 } },
    ]},
    { key: 'officers', icon: '🎓', name: 'Subay Sınıfı', options: [
        { id: 'merit',     name: 'Liyakat Sistemi',       desc: 'Yeni komutan +1 yetenek · refah +2',                effect: { officer: 1 },         welfare: 2,  appeal: { economist: 1.0, diplomat: 1.0 } },
        { id: 'noble',     name: 'Kurmay Kastı',   desc: 'Sadakat erimesi −%30 · refah −3',                   effect: { loyaltyHold: 0.70 },  welfare: -3, appeal: { warrior: 0.7, diplomat: 0.8, economist: -0.5 } },
        { id: 'commissar', name: 'Siyasi Komiserler',      desc: 'Komutan kadrosu +1, sadakat −%20 erime · refah −4', effect: { cmdCap: 1, loyaltyHold: 0.80 }, welfare: -4, appeal: { warrior: 1.2, aggr: 1.3 } },
    ]},
    { key: 'land', icon: '🌾', name: 'Tarım Politikası', options: [
        { id: 'estates',   name: 'Endüstriyel Tarım',      desc: '⛽petrol geliri +%12 · refah −4',                    effect: { oilIncome: 1.12 },    welfare: -4, appeal: { economist: 1.3, diplomat: -0.8 } },
        { id: 'reform',    name: 'Toprak Reformu',        desc: '👥insan geliri +%12 · refah +5',                     effect: { manIncome: 1.12 },    welfare: 5,  appeal: { diplomat: 1.5, economist: 0.3 } },
    ]},
    { key: 'education', icon: '📚', name: 'Eğitim Siyaseti', options: [
        { id: 'war',       name: 'Askeri Akademiler',      desc: 'Şehir savunması +%10 · yeni komutan +1 yetenek',    effect: { cityDefense: 0.10, officer: 1 }, welfare: 0, appeal: { warrior: 1.5, aggr: 1 } },
        { id: 'technical', name: 'Teknik Okullar',        desc: 'Üretim süresi −%10, bina −%10',                     effect: { prodSpeed: 0.90, buildCost: 0.90 }, welfare: 1, appeal: { economist: 1.4 } },
        { id: 'public',    name: 'Devlet Okulları',       desc: 'Refah +7 · ⭐puan geliri +%6',                       effect: { pointsIncome: 1.06 }, welfare: 7,  appeal: { diplomat: 1.7, aggr: -1 } },
    ]},
];
const LAW_SLOT_BY_KEY = {}; LAW_SLOTS.forEach(s => { LAW_SLOT_BY_KEY[s.key] = s; });
function lawOption(slotKey, optId) {
    const s = LAW_SLOT_BY_KEY[slotKey]; if (!s) return null;
    return s.options.find(o => o.id === optId) || null;
}

// ── ANAYASA (tek slot; nadir ve ağır karar) ──────────────────────────────────
const CONSTITUTIONS = [
    { id: 'monarchy',  icon: '👑', name: 'Parlamenter Sistem', desc: 'Denge düzeni — ne güçlü ne zayıf.',
      effect: {}, welfare: 0, appeal: { diplomat: 0.8 } },
    { id: 'absolute',  icon: '🏰', name: 'Otokratik Başkanlık',      desc: 'Sadakat erimesi −%40 · kadro −1 · refah −5',
      effect: { loyaltyHold: 0.60, cmdCap: -1 }, welfare: -5, appeal: { warrior: 0.9, aggr: 1.2, diplomat: -1.5 } },
    { id: 'republic',  icon: '🏛️', name: 'Liberal Demokrasi',      desc: 'Refah +10 · ⭐puan +%12 · darbe direnci',
      effect: { pointsIncome: 1.12, loyaltyHold: 0.85 }, welfare: 10, appeal: { diplomat: 2.0, economist: 0.8, aggr: -1.5 } },
    { id: 'junta',     icon: '⚔️', name: 'Askeri Cunta',    desc: 'Kapasite +10, üretim −%15 süre · refah −12',
      effect: { poolCap: 10, prodSpeed: 0.85 }, welfare: -12, appeal: { warrior: 2.2, aggr: 2.5, diplomat: -2 } },
    { id: 'council',   icon: '🤝', name: 'Halk Meclisi',    desc: 'Kadro +2 · birim −%10 maliyet · refah +4',
      effect: { cmdCap: 2, allCost: 0.90 }, welfare: 4, appeal: { diplomat: 1.4, economist: 1.2, warrior: -0.5 } },
];
const CONSTITUTION_BY_ID = {}; CONSTITUTIONS.forEach(c => { CONSTITUTION_BY_ID[c.id] = c; });
function storyConstitution(st) { return CONSTITUTION_BY_ID[(st && st.constitution) || 'monarchy'] || CONSTITUTIONS[0]; }

// ── DEVLET ÖNERGELERİ (tek seferlik; gündeme çeşni katar) ────────────────────
// apply(st): anında etki. Maliyet devlet hazinesinden (komutan kasalarından orantılı) düşer.
const COUNCIL_MOTIONS = [
    { id: 'winter', wf: 8, loy: 0,   icon: '🧣', name: 'Kışlık İkmal Programı',  desc: 'Refah +8 · hazineden 120⛽',        cost: { oil: 120 },      appeal: { diplomat: 1.4 },              apply: st => { storyWelfareDelta(st, 'council.motion.winter', 8); } },
    { id: 'parade', wf: 0, loy: 8,   icon: '🥁', name: 'Askerî Geçit Töreni',    desc: 'Tüm komutanlar +8 sadakat · 90⭐',  cost: { points: 90 },    appeal: { warrior: 1.2, aggr: 0.8 },    apply: st => { for (const c of storyStateCommanders(st)) c.loyalty = Math.min(100, (c.loyalty == null ? 60 : c.loyalty) + 8); } },
    { id: 'amnesty', wf: -3, loy: 14,  icon: '🕊️', name: 'Genel Af',               desc: 'Sadakati düşük komutanlar +14 · refah −3', cost: {},        appeal: { diplomat: 1.6, aggr: -1 },    apply: st => { storyWelfareDelta(st, 'council.motion.amnesty', -3); for (const c of storyStateCommanders(st)) if ((c.loyalty || 60) < 55) c.loyalty = Math.min(100, (c.loyalty || 60) + 14); } },
    { id: 'roads', wf: 0, loy: 0,    icon: '🛤️', name: 'Otoyol Yatırım Programı', desc: 'Her şehir +1 zenginlik · gerçek bütçe gideri 150⭐', cost: { points: 150 }, appeal: { economist: 1.5 },      apply: st => { for (const n of STORY.nodes) if (n.owner === st.id) n.wealth = (Number(n.wealth) || 0) + 1; } },
    { id: 'veterans', wf: 6, loy: 5, icon: '🎖️', name: 'Gazi Maaşları',          desc: 'Refah +6 · sadakat +5 · 100👥',     cost: { manpower: 100 }, appeal: { diplomat: 1.1, warrior: 0.8 }, apply: st => { storyWelfareDelta(st, 'council.motion.veterans', 6); for (const c of storyStateCommanders(st)) c.loyalty = Math.min(100, (c.loyalty == null ? 60 : c.loyalty) + 5); } },
    { id: 'granary', wf: 5, loy: 0,  icon: '🌾', name: 'Stratejik Gıda Rezervi',    desc: 'Refah +5 · tüm komutanlara +30👥',  cost: { oil: 60 },       appeal: { economist: 1.2, diplomat: 0.7 }, apply: st => { storyWelfareDelta(st, 'council.motion.granary', 5); for (const c of storyStateCommanders(st)) { if (c.res) c.res.manpower += 30; } } },
    { id: 'arsenal', wf: 0, loy: 0,  icon: '🔧', name: 'Cephanelik Genişletmesi', desc: 'Başkente +1 fabrika seviyesi · 140⛽', cost: { oil: 140 },   appeal: { warrior: 1.5, aggr: 1 },      apply: st => { const cap = storyNode((STORY._capitals || [])[st.id]); if (cap && cap.owner === st.id) cap.fac = Math.min(3, (cap.fac | 0) + 1); } },
    { id: 'barracks', wf: 0, loy: 0, icon: '🏕️', name: 'Kışla Modernizasyonu',      desc: 'Başkente +1 kışla seviyesi · 120👥', cost: { manpower: 120 }, appeal: { warrior: 1.3 },              apply: st => { const cap = storyNode((STORY._capitals || [])[st.id]); if (cap && cap.owner === st.id) cap.bar = Math.min(3, (cap.bar | 0) + 1); } },
    { id: 'purge', wf: 4, loy: 0,    icon: '🗡️', name: 'Ordu Tasfiyesi',         desc: 'En sadakatsiz komutan görevden alınır · refah +4', cost: {}, appeal: { warrior: 0.6, aggr: 1.4, diplomat: -1.6 }, apply: st => {
        if (!st.gov || !st.gov.commanders.length) return;
        let worst = null; for (const c of st.gov.commanders) if (!c.isPlayer && (!worst || (c.loyalty || 60) < (worst.loyalty || 60))) worst = c;
        if (worst) { const i = st.gov.commanders.indexOf(worst); if (i >= 0) st.gov.commanders.splice(i, 1); storyWelfareDelta(st, 'council.motion.purge', 4); }
    }},
    { id: 'medals', wf: 0, loy: 10,   icon: '🏅', name: 'Madalya Yönetmeliği',    desc: 'Muharip komutanlar +10 sadakat · 70⭐', cost: { points: 70 }, appeal: { warrior: 1.4 },              apply: st => { for (const c of storyStateCommanders(st)) if ((c.skills && c.skills.warrior) >= 4) c.loyalty = Math.min(100, (c.loyalty == null ? 60 : c.loyalty) + 10); } },
    { id: 'census', wf: 0, loy: 0,   icon: '📋', name: 'Nüfus Sayımı',           desc: 'Tüm komutanlara +45👥 +45⛽ · 80⭐',  cost: { points: 80 },   appeal: { economist: 1.3 },             apply: st => { for (const c of storyStateCommanders(st)) { if (!c.res) continue; c.res.manpower += 45; c.res.oil += 45; } } },
    { id: 'austerity', wf: -6, loy: 0,icon: '✂️', name: 'Tasarruf Tedbirleri',    desc: 'Refah −6 · güven +8 · enflasyon −2; para yaratmaz', cost: {}, appeal: { economist: 0.9, diplomat: -1 }, apply: st => { storyWelfareDelta(st, 'council.motion.austerity', -6); st.marketConfidence = Math.min(100, (Number(st.marketConfidence) || 50) + 8); st.inflation = Math.max(2, (Number(st.inflation) || 2) - 2); } },
    { id: 'festival', wf: 9, loy: 0, icon: '🎪', name: 'Millî Bayram',           desc: 'Refah +9 · 60⭐ 60⛽',                cost: { points: 60, oil: 60 }, appeal: { diplomat: 1.5, aggr: -0.7 }, apply: st => { storyWelfareDelta(st, 'council.motion.festival', 9); } },
    { id: 'reserve', wf: 0, loy: 0,  icon: '🛡️', name: 'İhtiyat Kuvvet Fonu',    desc: 'Başkent garnizonu +1 · 90👥',        cost: { manpower: 90 },  appeal: { warrior: 1.1, aggr: -0.4 },   apply: st => { const cap = storyNode((STORY._capitals || [])[st.id]); if (cap && cap.owner === st.id) cap.garrison = Math.min(6, (cap.garrison | 0) + 1); } },
];
const MOTION_BY_ID = {}; COUNCIL_MOTIONS.forEach(m => { MOTION_BY_ID[m.id] = m; });

// ── OY MODELİ ────────────────────────────────────────────────────────────────
// Deterministik serpinti: aynı (komutan, seçenek) çifti hep aynı küçük sapmayı alır
// → oylar ne hepsi aynı, ne de her tick'te değişken (kaydet/yükle tutarlı).
function _councilHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }

// ÜLKENİN HÂLİ — konsey boşlukta oy vermez.
// Ölçümde (8 devlet × 900sn) yalnız kişilikle oy veren konsey açlık içindeyken bile
// refah-düşürücü kanunları seçiyor, refah çöküşü sadakat sarmalını besliyordu:
// kanunsuz konsey 12.0 şehir / 36 refah, kanunlu konsey 8.5 şehir / 28 refah veriyordu.
// Artık kriz derinleştikçe refah/sadakat getiren seçenekler ağırlık kazanır — konsey
// kendi kendini düzeltir. Tüm devletler (AI dahil) aynı modeli kullanır.
function storyCouncilContext(st) {
    const wf = (st && st.welfare == null) ? 50 : st.welfare;
    const cmds = (typeof storyStateCommanders === 'function') ? storyStateCommanders(st) : [];
    const loy = cmds.length ? cmds.reduce((a, c) => a + (c.loyalty == null ? 60 : c.loyalty), 0) / cmds.length : 60;
    return {
        welfareNeed: Math.max(0, Math.min(1, (55 - wf) / 55)),   // refah 55+ → 0, refah 0 → 1
        loyaltyNeed: Math.max(0, Math.min(1, (62 - loy) / 62)),  // sadakat 62+ → 0
    };
}
function storyCouncilVoteScore(cmd, optId, appeal, ctx, wfDelta, loyDelta) {
    const sk = cmd.skills || { warrior: 3, diplomat: 3, economist: 3 };
    const aggr = (typeof CMD_PERSONA_AGGR !== 'undefined' && CMD_PERSONA_AGGR[cmd.personality]) || 1;
    const a = appeal || {};
    let s = 6;
    s += (a.warrior   || 0) * (sk.warrior   || 0);
    s += (a.diplomat  || 0) * (sk.diplomat  || 0);
    s += (a.economist || 0) * (sk.economist || 0);
    s += (a.aggr      || 0) * (aggr - 1) * 8;
    // KİŞİLİK MOTORU (AŞAMA 1): ideolojik eksenler de oy verir. Şahin, savaşçıl
    // teklife; otoriter, refah kırpan sert düzene; halkçı, refah artıran teklife
    // yatkındır. Katsayılar bilinçli küçük — ölçülmüş konsey dengesini devirmesin
    // (yön doğrulaması chartest.js'te, denge 8×900sn kıyaslamasında).
    const ax = cmd.axes;
    if (ax) {
        s += ((ax.hawk - 50) / 50) * (a.aggr || 0) * 2.0;
        s += ((ax.auth - 50) / 50) * ((wfDelta || 0) < 0 ? 1.2 : -0.6);
        s += ((ax.pop  - 50) / 50) * ((wfDelta || 0) > 0 ? 1.2 : -0.6);
    }
    if (ctx) {
        // Kriz baskısı: refah/sadakat ihtiyacı arttıkça o eksendeki teklif ağırlaşır.
        // Diplomat komutan halkın hâlini daha çok umursar, agresif komutan daha az.
        const care = 0.7 + ((sk.diplomat || 0) * 0.09) - ((aggr - 1) * 0.35);
        s += ctx.welfareNeed * (wfDelta  || 0) * 0.95 * care;
        s += ctx.loyaltyNeed * (loyDelta || 0) * 0.85 * care;
    }
    s += _councilHash(cmd.id + '|' + optId) * 3.0;   // kişisel serpinti
    return s;
}
// Bir gündem maddesi için tüm komutanların oyu → { byOption: {id:[cmd..]}, winner, tally }
// playerVote: oyuncunun ELLE verdiği oy — kendi jetonunun hesaplanmış tercihinin yerine geçer.
function storyCouncilTally(item, commanders, st, playerVote) {
    const ctx = st ? storyCouncilContext(st) : (item._ctx || null);
    const byOption = {}; item.options.forEach(o => { byOption[o.id] = []; });
    for (const c of commanders) {
        if (c.isPlayer && playerVote && byOption[playerVote]) {
            byOption[playerVote].push(c);
            // FAZ-7 SİYASET DALI: Hatip/Kral Yapıcı → oyun birden çok oy sayılır
            const extra = (typeof cmdrBonus === 'function') ? cmdrBonus(c).voteWeight : 0;
            for (let i = 0; i < extra; i++) byOption[playerVote].push({ id: -1 - i, name: c.name, isPlayer: true, _proxy: true, personality: c.personality, loyalty: c.loyalty });
            continue;
        }
        let best = null, bestS = -Infinity;
        for (const o of item.options) {
            // AŞAMA 2: kızgın fraksiyonun sevdiği teklif konseyde ağırlaşır (yatıştırma).
            // Katsayı storyFacScore içinde ±6 ile sınırlı — konsey dengesi ölçülü kalır.
            const s = storyCouncilVoteScore(c, o.id, o.appeal, ctx, o.welfare, o.loyGain)
                    + ((typeof storyFacScore === 'function' && o._fac) ? storyFacScore(o._fac, st) : 0)
                    + ((typeof storyEconVoteTerm === 'function') ? storyEconVoteTerm(item, o.id, st) : 0);   // AŞAMA 3: enflasyon tepkisi
            if (s > bestS) { bestS = s; best = o; }
        }
        if (best) byOption[best.id].push(c);
    }
    let winner = item.options[0], wn = -1;
    for (const o of item.options) { const n = byOption[o.id].length; if (n > wn) { wn = n; winner = o; } }
    return { byOption, winner, count: wn };
}

// ── GÜNDEM ÜRETİMİ (oyuncu ve AI aynı fonksiyon → simetri garanti) ───────────
// sessionNo: kaçıncı konsey (anayasa maddesi seyrekliği için)
function storyCouncilBuildAgenda(st, sessionNo) {
    const items = [];
    const rnd = (salt) => _councilHash(st.id + '|' + sessionNo + '|' + salt);

    // 1) TEKNOLOJİ — AĞIR kararlar konseye gelir (K3-K4). Basit K1-K2 teknolojileri
    // yönetim kendi Ar-Ge fonundan duruma göre geçer (storyTechPriority) — konseyi
    // önemsiz maddelerle meşgul etmeyelim. K3+ yoksa mevcut olanlara düşülür.
    const allAvail = TECH_TREE.techs.filter(t => storyTechStatusFor(st.tech || [], t).state === 'available');
    const heavy = allAvail.filter(t => t.tier > (typeof ADMIN_TECH_MAX_TIER !== 'undefined' ? ADMIN_TECH_MAX_TIER : 2));
    const avail = heavy.length ? heavy : allAvail;
    if (avail.length) {
        const pool = avail.slice().sort((a, b) => (a.cost - b.cost) + (rnd(a.id) - rnd(b.id)) * 120);
        const picked = [], seenBranch = {};
        for (const t of pool) { if (picked.length >= 3) break; if (seenBranch[t.branch] && picked.length < 2) continue; seenBranch[t.branch] = 1; picked.push(t); }
        for (const t of pool) { if (picked.length >= 3) break; if (picked.indexOf(t) < 0) picked.push(t); }
        const BR_APPEAL = { armor: { warrior: 1.2, aggr: 1.0 }, mob: { warrior: 0.9, diplomat: 0.5 }, arty: { warrior: 1.0, economist: 0.5 }, state: { economist: 1.2, diplomat: 0.9 }, ind: { economist: 1.5 } };
        items.push({
            kind: 'tech', icon: '🔬', title: 'ARAŞTIRMA BÜTÇESİ',
            desc: 'Bu dönem hangi teknoloji geliştirilsin? Maliyet devlet ⭐puanından karşılanır.',
            options: picked.map(t => {
                const c = storyTechCostFor(st.tech || [], t);
                return { id: t.id, name: t.name, desc: t.desc + ` · ${c}⭐`, meta: (TECH_TREE.branches.find(b => b.key === t.branch) || {}).name, appeal: BR_APPEAL[t.branch] || {}, techCost: c };
            }),
        });
    }

    // 2) KANUN — bir slot seç, mevcut olan dışındaki seçenekleri öner (+ "değişiklik yok")
    const slot = LAW_SLOTS[Math.floor(rnd('law') * LAW_SLOTS.length) % LAW_SLOTS.length];
    if (slot) {
        const cur = (st.laws || {})[slot.key];
        const curWf = cur ? ((lawOption(slot.key, cur) || {}).welfare || 0) : 0;
        const opts = slot.options.filter(o => o.id !== cur).map(o => ({
            id: o.id, name: o.name, desc: o.desc, meta: 'KANUN', appeal: o.appeal, lawSlot: slot.key,
            welfare: (o.welfare || 0) - curWf,   // oylanan şey DEĞİŞİM: mevcut kanuna göre refah farkı
        }));
        opts.push({ id: '_keep', name: cur ? 'Mevcut Kanun Kalsın' : 'Düzenleme Yapılmasın', desc: cur ? (lawOption(slot.key, cur) || {}).name || '—' : 'Bu alanda kanun çıkarılmaz.', meta: 'STATÜKO', appeal: { diplomat: 0.4 }, welfare: 0 });
        items.push({ kind: 'law', icon: slot.icon, title: slot.name.toLocaleUpperCase('tr'), desc: `${slot.name} yeniden düzenlensin mi?`, options: opts, lawSlot: slot.key });
    }

    // 3) ANAYASA — her 3. konseyde (nadir, ağır)
    if (sessionNo > 0 && sessionNo % 3 === 0) {
        const cur = (st.constitution || 'monarchy');
        const others = CONSTITUTIONS.filter(c => c.id !== cur);
        const pick = others.slice().sort((a, b) => rnd(a.id) - rnd(b.id)).slice(0, 2);
        items.push({
            kind: 'constitution', icon: '📜', title: 'ANAYASA GÖRÜŞMESİ',
            desc: 'Devletin temel düzeni tartışmaya açıldı. Bu karar her şeyi etkiler.',
            options: pick.map(c => ({ id: c.id, name: c.icon + ' ' + c.name, desc: c.desc, meta: 'ANAYASA', appeal: c.appeal, welfare: (c.welfare || 0) - (storyConstitution(st).welfare || 0) }))
                .concat([{ id: '_keep', name: '📜 ' + storyConstitution(st).name + ' Sürsün', desc: 'Mevcut anayasa korunur.', meta: 'STATÜKO', appeal: { diplomat: 0.6, economist: 0.4 }, welfare: 0 }]),
        });
    }

    // 4) ATAMA — kadro eksikse yeni komutan
    const cap = (typeof storyCommanderCap === 'function') ? storyCommanderCap(st) : 6;
    const cur = storyStateCommanders(st).length;
    if (cur < cap) {
        items.push({
            kind: 'appoint', icon: '🎖️', title: 'KOMUTAN ATAMASI',
            desc: `Kadro ${cur}/${cap} — konsey boş makama aday gösteriyor.`,
            options: [
                { id: 'warrior',   name: 'Muharip Subay',   desc: 'Yüksek savaş becerisi — cephe komutanı.',      meta: 'ADAY', appeal: { warrior: 1.6, aggr: 1.2 } },
                { id: 'economist', name: 'Lojistik Subayı',  desc: 'Yüksek iktisat becerisi — gelir payı büyür.',  meta: 'ADAY', appeal: { economist: 1.6 } },
                { id: 'diplomat',  name: 'Kurmay Diplomat',  desc: 'Yüksek diplomasi — sadakat istikrarı sağlar.', meta: 'ADAY', appeal: { diplomat: 1.6, aggr: -0.8 } },
                { id: '_none',     name: 'Makam Boş Kalsın', desc: 'Hazine korunur, kadro genişlemez.',            meta: 'RET',  appeal: { economist: 0.5, diplomat: -0.3 } },
            ],
        });
    }

    // 4.5) İNŞAAT PROGRAMI — yönetici DEVLET HAZİNESİNDEN şehirlerde bina yaptırır.
    // Oyuncunun kendi kasasıyla tek tek kurmasından farklı: bu bir devlet yatırımıdır ve
    // konsey onaylar. Aday şehirler: başkent + en gelişmeye muhtaç cephe/üretim şehirleri.
    const mine = STORY.nodes.filter(n => n.owner === st.id);
    if (mine.length) {
        const capId = (STORY._capitals || [])[st.id];
        const score = n => {
            let v = (n.oil || 0) * 2 + (n.cities || 0) * 1.5 + (n.pts || 0) * 2 + (n.level || 1) * 2;
            if (n.id === capId) v += 8;                                    // başkent önceliklidir
            v -= prodDepthLevel(n) * 3;                                    // DERİNLİĞİ cezalandır, temeli değil
            const front = (n.neighbors || []).some(id => { const q = storyNode(id); return q && q.owner !== st.id; });
            if (front) v += 5;                                             // cephe şehri tahkim edilmeli
            return v + rnd('site' + n.id) * 6;
        };
        const sites = mine.slice().sort((a, b) => score(b) - score(a)).slice(0, 3);
        const opts = [];
        for (const n of sites) {
            // o şehir için en anlamlı tek iş: eksik binayı kur, yoksa şehri yükselt
            // ALTI BİNA: konsey yalnız kışla/fabrika öneriyordu; ihtisas binalarını devlet yatırımı
            // hiç tanımıyordu (onları yalnız komutanların yerel yatırımı kuruyordu). Artık ön koşulu
            // sağlanan tüm binalar aday.
            // NOT — GEREKÇE DÜZELTMESİ: bu değişikliği ilk yazarken "900 sn'de 152 şehrin hiçbirinde
            // ihtisas binası yok" ölçümüne dayanmıştım; o okuma YANLIŞTI (harness snapshot'ı yalnız
            // fac/bar taşıyordu, dünyada 42/14/57/54 şehirde bina vardı). Değişiklik yine de doğru:
            // devlet hazinesinin altı binadan dördünü görememesi için bir sebep yok. Ama etkisi
            // "sıfırdan başlatmak" değil, "devlet yatırımını komutan yatırımıyla aynı repertuara açmak".
            // ÖNCE GENİŞLİK, SONRA DERİNLİK: temel bina YOKSA o kurulur; temeli varsa en düşük
            // seviyeli bina büyür (aynı seviyede temel önce). Maliyet eğrisi de bunu söylüyor:
            // kurmak ucuz, ölçeklemek pahalı. (İlk sürümde kışla/fabrika koşulsuz öndeydi ve
            // tavana varmadan sıra ihtisas binalarına hiç gelmiyordu.)
            const temel = { bar: 1, fac: 1 };
            let kind = null, best = null;
            for (const k of PROD_KINDS) {
                const lvl = n[k] | 0;
                if (lvl >= prodMaxBuildLevel(n) || lvl >= PROD_MAX_LEVEL) continue;
                if (!prodBuildReqMet(n, k, lvl + 1)) continue;             // bağımlılık sağlanmadı
                const oncelik = (temel[k] && lvl === 0) ? -1                // temeli olmayan şehir önce onu kurar
                    : lvl * 2 + (temel[k] ? 0 : 1);                        // sonra en geri kalmış bina büyür
                if (!best || oncelik < best.oncelik) best = { k, lvl, oncelik };
            }
            if (best) kind = best.k;
            if (kind) {
                const lvl = n[kind] | 0, cost = prodBuildCost(kind, lvl, n);
                if (cost != null) opts.push({
                    id: `b|${n.id}|${kind}`, name: `${prodBuildingIcon(kind)} ${n.name}: ${prodBuildingName(kind)} Sv.${lvl + 1}`,
                    desc: `${cost}⭐ devlet hazinesinden · ${prodBinaAciklama(kind)}`,
                    meta: 'İNŞAAT', appeal: kind === 'fac' ? { warrior: 1.2, economist: 0.8 } : { warrior: 0.9, economist: 0.9 },
                });
            } else if ((n.level || 1) < 3) {
                const cost = CITY_UPGRADE_COST[n.level || 1];
                if (cost != null) opts.push({
                    id: `u|${n.id}`, name: `🏗️ ${n.name}: Şehir Sv.${(n.level || 1) + 1}`,
                    desc: `${cost}⭐ devlet hazinesinden · ${CITY_UPGRADE_GAIN[n.level || 1] || 'gelir + kapasite'}`,
                    meta: 'İNŞAAT', appeal: { economist: 1.4, diplomat: 0.5 },
                });
            }
        }
        // ÇOK BİNALI PROGRAM: tek tek bina kurmak 2 yılda bir olduğu için altyapı asla
        // yetişmiyordu (ölçüm: 8 devletin 8'i de Sv.1'de kalıp yalnız piyade+tanksavar
        // üretebiliyordu). Konsey artık kapsamlı program da onaylayabilir.
        if (opts.length >= 2) {
            const multi = opts.slice(0, 3).map(o => o.id);
            let mCost = 0;
            for (const id of multi) {
                const pr = id.split('|'), nd = storyNode(+pr[1]);
                if (!nd) continue;
                mCost += (pr[0] === 'b') ? (prodBuildCost(pr[2], nd[pr[2]] | 0, nd) || 0)
                                         : (CITY_UPGRADE_COST[nd.level || 1] || 0);
            }
            mCost = Math.round(mCost * 0.85);   // toplu iş indirimi
            opts.push({
                id: 'M|' + multi.join(';'),
                name: `🏗️🏗️ KAPSAMLI PROGRAM (${multi.length} şehir)`,
                desc: `${mCost}⭐ · yukarıdaki ${multi.length} işin hepsi birden · toplu iş indirimi %15`,
                meta: 'PROGRAM', appeal: { economist: 1.6, warrior: 0.8, aggr: 0.5 },
            });
        }
        if (opts.length) {
            opts.push({ id: '_none', name: '⏭️ İnşaat Yapılmasın', desc: 'Hazine korunur.', meta: 'RET', appeal: { economist: 0.5 }, welfare: 0 });
            items.push({ kind: 'build', icon: '🏗️', title: 'İNŞAAT PROGRAMI', desc: 'Devlet hazinesinden hangi şehirlere yatırım yapılsın?', options: opts });
        }
    }

    // 5) DEVLET ÖNERGESİ — havuzdan 3 farklı önerge + ret
    const mpool = COUNCIL_MOTIONS.slice().sort((a, b) => rnd(a.id) - rnd(b.id)).slice(0, 3);
    items.push({
        kind: 'motion', icon: '📌', title: 'DEVLET ÖNERGELERİ',
        desc: 'Konseyin önündeki tek seferlik tedbirler. Yalnız biri kabul edilebilir.',
        options: mpool.map(m => ({ id: m.id, name: m.icon + ' ' + m.name, desc: m.desc, meta: 'ÖNERGE', appeal: m.appeal, welfare: m.wf || 0, loyGain: m.loy || 0 }))
            .concat([{ id: '_none', name: '⏭️ Önerge Yok', desc: 'Hazine korunur, tedbir alınmaz.', meta: 'RET', appeal: { economist: 0.6 }, welfare: 0 }]),
    });

    return items;
}

// ── KARAR UYGULAMA (oyuncu ve AI ortak) ─────────────────────────────────────
function storyCouncilPayFromState(st, cost) {
    if (!cost) return true;
    const cmds = storyStateCommanders(st); if (!cmds.length) return false;
    for (const k in cost) { let have = 0; for (const c of cmds) have += (c.res && c.res[k]) || 0; if (have < cost[k]) return false; }
    for (const k in cost) {
        if (k === 'points' && typeof storyBudgetDebit === 'function') {
            const paid = storyBudgetDebit(st, cost[k], 'council', {
                correlationId: `council:${st.id}:${STORY._councilNo || 0}`
            });
            if (!paid.ok) return false;
            continue;
        }
        let need = cost[k];
        const rich = cmds.slice().sort((a, b) => ((b.res && b.res[k]) || 0) - ((a.res && a.res[k]) || 0));
        for (const c of rich) { if (need <= 0) break; if (!c.res) continue; const take = Math.min(need, c.res[k]); c.res[k] -= take; need -= take; }
    }
    if (typeof storyResourceFlow === 'function') {
        storyResourceFlow(st, 'expense.council', {
            oil: -(Number(cost.oil) || 0),
            manpower: -(Number(cost.manpower) || 0),
            points: -(Number(cost.points) || 0)
        }, {
            correlationId: `council:${st.id}:${STORY._councilNo || 0}`
        });
    }
    return true;
}
// item + seçilen option id → devlete uygula. Döner: kısa log metni (veya null)
function storyCouncilApply(st, item, optId) {
    if (!optId || optId === '_keep' || optId === '_none') return null;
    if (typeof storyTelemetryEvent === 'function') {
        storyTelemetryEvent('council.decision', {
            stateId: st && st.id,
            itemKind: item && item.kind,
            optionId: optId
        }, {
            correlationId: `council:${st && st.id}:${STORY._councilNo || 0}`
        });
    }
    if (item.kind === 'tech') {
        const opt = item.options.find(o => o.id === optId); if (!opt) return null;
        if (!storyCouncilPayFromState(st, { points: opt.techCost })) return `⭐ hazine yetersiz — <b>${opt.name}</b> ertelendi`;
        if (!st.tech) st.tech = [];
        if (st.tech.indexOf(optId) < 0) st.tech.push(optId);
        storyStateComputeTech(st);
        if (st.isPlayer && typeof storyComputeTechBonus === 'function') storyComputeTechBonus();
        return `🔬 <b>${opt.name}</b> araştırıldı`;
    }
    if (item.kind === 'law') {
        const o = lawOption(item.lawSlot, optId); if (!o) return null;
        if (!st.laws) st.laws = {};
        st.laws[item.lawSlot] = optId;
        if (o.welfare) storyWelfareDelta(st, `council.law.${item.lawSlot}.${optId}`, o.welfare);
        if (typeof storyFacOnLaw === 'function') storyFacOnLaw(st, item.lawSlot, optId, o.name);   // AŞAMA 2: toplum tepkisi
        if (typeof storyNews === 'function' && (st.isPlayer || storyRandom('governance') < 0.25)) storyNews('law', { st: st.name, law: o.name });
        storyStateComputeTech(st);
        if (st.isPlayer && typeof storyComputeTechBonus === 'function') storyComputeTechBonus();
        return `⚖️ <b>${o.name}</b> kanunlaştı`;
    }
    if (item.kind === 'constitution') {
        const c = CONSTITUTION_BY_ID[optId]; if (!c) return null;
        st.constitution = optId;
        if (c.welfare) storyWelfareDelta(st, `council.constitution.${optId}`, c.welfare);
        if (typeof storyFacOnConstitution === 'function') storyFacOnConstitution(st, optId, c.name);   // AŞAMA 2
        storyStateComputeTech(st);
        if (st.isPlayer && typeof storyComputeTechBonus === 'function') storyComputeTechBonus();
        return `📜 Yeni anayasa: <b>${c.name}</b>`;
    }
    if (item.kind === 'appoint') {
        if (!storyCouncilPayFromState(st, { oil: 90, manpower: 90, points: 90 })) return '🎖️ Hazine yetersiz — atama yapılamadı';
        const nc = storyCreateCommanderFor(st.id, optId);
        return nc ? `🎖️ <b>${nc.name}</b> komutanlığa atandı` : null;
    }
    if (item.kind === 'talk') {                       // sohbetten gelen devlet meselesi
        const opt = item.options.find(o => o.id === optId);
        if (!opt || typeof opt._run !== 'function') return null;
        let r = null;
        try { r = opt._run({}); } catch (_) { r = null; }
        if (r && r.fail) return r.fail;
        return (r && r.msg) || null;
    }
    if (item.kind === 'build') {
        if (String(optId).charAt(0) === 'M') {                       // KAPSAMLI PROGRAM
            const ids = String(optId).slice(2).split(';');
            let total = 0; const plan = [];
            for (const id of ids) {
                const pr = id.split('|'), nd = storyNode(+pr[1]);
                if (!nd || nd.owner !== st.id) continue;
                if (pr[0] === 'b') {
                    const lvl = nd[pr[2]] | 0;
                    if (lvl >= PROD_MAX_LEVEL || lvl >= prodMaxBuildLevel(nd)) continue;
                    const c = prodBuildCost(pr[2], lvl, nd); if (c == null) continue;
                    total += c; plan.push({ n: nd, kind: pr[2], lvl });
                } else {
                    const lvl = nd.level || 1; if (lvl >= 3) continue;
                    const c = CITY_UPGRADE_COST[lvl]; if (c == null) continue;
                    total += c; plan.push({ n: nd, up: true, lvl });
                }
            }
            if (!plan.length) return null;
            total = Math.round(total * 0.85);
            if (!storyCouncilPayFromState(st, { points: total })) return `🏗️ Hazine yetersiz — kapsamlı program ertelendi (${total}⭐)`;
            const done = [];
            for (const j of plan) {
                if (j.up) { j.n.level = j.lvl + 1; done.push(`${j.n.name} Sv.${j.n.level}`); }
                else { j.n[j.kind] = j.lvl + 1; done.push(`${j.n.name} ${prodBuildingName(j.kind)} Sv.${j.n[j.kind]}`); }
            }
            return `🏗️ Kapsamlı program: <b>${done.join(' · ')}</b> (−${total}⭐)`;
        }
        const parts = String(optId).split('|');
        const n = storyNode(+parts[1]);
        if (!n || n.owner !== st.id) return '🏗️ Şehir artık elimizde değil — inşaat iptal';
        if (parts[0] === 'b') {
            const kind = parts[2], lvl = n[kind] | 0;
            if (lvl >= PROD_MAX_LEVEL || lvl >= prodMaxBuildLevel(n)) return null;
            const cost = prodBuildCost(kind, lvl, n);
            if (!storyCouncilPayFromState(st, { points: cost })) return `🏗️ Hazine yetersiz — <b>${n.name}</b> inşaatı ertelendi`;
            n[kind] = lvl + 1;
            return `🏗️ <b>${n.name}</b>: ${prodBuildingName(kind)} Sv.${n[kind]} kuruldu`;
        }
        const lvl = n.level || 1;
        if (lvl >= 3) return null;
        const cost = CITY_UPGRADE_COST[lvl];
        if (!storyCouncilPayFromState(st, { points: cost })) return `🏗️ Hazine yetersiz — <b>${n.name}</b> yükseltmesi ertelendi`;
        n.level = lvl + 1;
        return `🏗️ <b>${n.name}</b> Sv.${n.level}'e yükseldi`;
    }
    if (item.kind === 'motion') {
        const m = MOTION_BY_ID[optId]; if (!m) return null;
        if (!storyCouncilPayFromState(st, m.cost)) return `📌 Hazine yetersiz — <b>${m.name}</b> reddedildi`;
        try { m.apply(st); } catch (e) { /* önerge güvenliği: hiçbir önerge dünyayı çökertmesin */ }
        return `📌 <b>${m.name}</b> kabul edildi`;
    }
    return null;
}

// ── KONSEY OTURUMU ──────────────────────────────────────────────────────────
// Dünya saatinden tetiklenir: her COUNCIL_PERIOD_YEARS yılda bir, TÜM devletler.
function storyCouncilDue() {
    const per = COUNCIL_PERIOD_YEARS * YEAR_SECONDS;
    if (STORY._nextCouncil == null) STORY._nextCouncil = per;   // ilk konsey 2. yılda
    return (STORY.clock || 0) >= STORY._nextCouncil;
}
function storyCouncilTick() {
    if (!storyCouncilDue()) return;
    const per = COUNCIL_PERIOD_YEARS * YEAR_SECONDS;
    STORY._nextCouncil = (STORY._nextCouncil || per) + per;
    STORY._councilNo = (STORY._councilNo || 0) + 1;
    const sessionNo = STORY._councilNo;

    // AI devletleri sessizce çözer
    for (const st of STORY.states) {
        if (st.isPlayer) continue;
        if (!st.gov || !storyStateCommanders(st).length) continue;
        if (!storyCouncilHasCapital(st)) { storyCouncilNoCapitalPenalty(st); continue; }
        storyCouncilResolveAI(st, sessionNo);
    }
    // Oyuncu devleti: DÜNYA DURUR, oturum açılır
    const me = storyPlayerState();
    if (!me || !me.gov) return;
    if (!storyCouncilHasCapital(me)) { storyCouncilNoCapitalPenalty(me); return; }
    storyCouncilSessionOpen(me, sessionNo);
}
function storyCouncilHasCapital(st) {
    const capId = (STORY._capitals || [])[st.id];
    const cap = capId != null ? storyNode(capId) : null;
    return !!(cap && cap.owner === st.id);
}
function storyCouncilNoCapitalPenalty(st) {
    storyWelfareDelta(st, 'council.no_capital', -6, {
        correlationId: `council:no-capital:${st.id}:${STORY._councilNo || 0}`
    });
    for (const c of storyStateCommanders(st)) c.loyalty = Math.max(0, (c.loyalty == null ? 60 : c.loyalty) - 6);
    if (st.isPlayer) storyLog(`🏛️ <b>KONSEY TOPLANAMADI</b> — başkentin elinde değil! Refah ve sadakat düştü.`);
}
// AI: komutanlar oylar, lider (en yüksek savaş+diplomasi) çoğunluğu %75 ihtimalle onaylar
function storyCouncilResolveAI(st, sessionNo) {
    const items = storyCouncilBuildAgenda(st, sessionNo);
    const cmds = storyStateCommanders(st);
    const logs = [];
    for (const item of items) {
        const t = storyCouncilTally(item, cmds, st);
        const ctx = storyCouncilContext(st);
        let choice = t.winner;
        // yönetici vetosu: %25 ihtimalle kendi tercihini dayatır (sadakat bedeliyle)
        const lead = cmds.slice().sort((a, b) => ((b.skills?.warrior || 0) + (b.skills?.diplomat || 0)) - ((a.skills?.warrior || 0) + (a.skills?.diplomat || 0)))[0];
        if (lead && _councilHash(st.id + '|' + sessionNo + '|veto|' + item.kind) < 0.25) {
            let best = null, bestS = -Infinity;
            for (const o of item.options) { const s = storyCouncilVoteScore(lead, o.id, o.appeal, ctx, o.welfare, o.loyGain); if (s > bestS) { bestS = s; best = o; } }
            if (best && best.id !== choice.id) { choice = best; for (const c of cmds) if (c !== lead) c.loyalty = Math.max(0, (c.loyalty == null ? 60 : c.loyalty) - 3); }
        }
        const msg = storyCouncilApply(st, item, choice.id);
        if (msg) logs.push(msg);
    }
    // dünya haberi: her AI konseyinden en fazla 1 satır (log taşmasın)
    if (logs.length && _councilHash(st.id + '|news|' + sessionNo) < 0.5)
        storyLog(`🏛️ <span style="color:${st.color}">${st.name}</span> konseyi: ${logs[0]}`);
}

// ── OLAĞANÜSTÜ KONSEY ──────────────────────────────────────────────────────
// Devleti bağlayan kararlar (ültimatom, ittifak, ortak savaş, ahdi bozma) tek bir
// komutanın şahsi kararı olamaz — konsey acilen toplanır. Oyuncu yöneticiyse son
// sözü söyler, değilse oy verir. AI devletlerinde sessizce çözülür.
// Olağanüstü toplantı ARALIĞI. Ölçümde kısıtsız hâli 15 yılda 49 oturum üretiyordu —
// yani her 3-4 dakikada bir dünyayı durduran modal. Konsey ancak gerçekten olağanüstü
// olduğunda toplanmalı; sıradan elçi trafiği kuyruğa/yöneticiye gider.
const COUNCIL_URGENT_GAP_YEARS = 1.5;
function storyCouncilUrgentReady() {
    const gap = COUNCIL_URGENT_GAP_YEARS * YEAR_SECONDS;
    return (STORY.clock || 0) - (STORY._lastUrgent == null ? -1e9 : STORY._lastUrgent) >= gap;
}
function storyCouncilCall(st, item, reason) {
    if (!st || !item) return false;
    if (!storyStateCommanders(st).length) return false;
    // OYUNCU devletinde kısıt geçerli: çok sık toplanma oyunu kesintiye çevirir.
    if (st.isPlayer && !storyCouncilUrgentReady()) return false;
    STORY._councilNo = (STORY._councilNo || 0) + 1;
    if (!st.isPlayer) {                                   // AI devleti: sessiz karar
        const cmds = storyStateCommanders(st);
        const t = storyCouncilTally(item, cmds, st);
        storyCouncilApply(st, item, t.winner.id);
        return true;
    }
    if (STORY._session) return false;                     // zaten toplantıdayız
    STORY._lastUrgent = STORY.clock || 0;
    storyCouncilSessionOpen(st, STORY._councilNo, { items: [item], urgent: true, reason: reason || '' });
    storyLog(`🚨 <b>OLAĞANÜSTÜ KONSEY</b> — ${reason || 'devlet meselesi görüşülüyor'}`);
    return true;
}

// ── OYUNCU OTURUMU (dünya durur) ────────────────────────────────────────────
// opts.items  → hazır gündem (olağanüstü toplantı); yoksa olağan gündem üretilir
// opts.urgent → başlıkta "OLAĞANÜSTÜ" yazar ve sebebi gösterilir
// Oyuncu cevaplamazsa dünya süresiz donuyordu. Gerçek zamanlı bir emniyet süresi
// sonunda konsey ÇOĞUNLUK kararıyla kendi kendine kapanır (kararı konsey verir,
// oyuncu sadece söz hakkını kaçırmış olur).
const COUNCIL_AFK_MS = 180000;   // 3 dakika
function storyCouncilAfkCheck() {
    const S = STORY._session; if (!S || !S.openedAt) return;
    if (Date.now() - S.openedAt < COUNCIL_AFK_MS) return;
    let g = 0;
    while (STORY._session && g++ < 30) storyCouncilSessionNext();
    if (typeof storyLog === 'function') storyLog('⏳ Konsey seni bekleyemedi — kararlar çoğunlukla alındı.');
}
function storyCouncilSessionOpen(st, sessionNo, opts) {
    opts = opts || {};
    const items = opts.items || storyCouncilBuildAgenda(st, sessionNo);
    if (!items.length) return;
    const capId = (STORY._capitals || [])[st.id];
    const cap = storyNode(capId);
    // OLAĞANÜSTÜ toplantıda konsey nerede olursan ol toplanır (kriz beklemez);
    // ama "konseyi ezme" yetkisi yine başkentte olmayı gerektirir.
    const atCapital = !!(STORY.commander && STORY.commander.node === capId);
    STORY._session = {
        stateId: st.id, sessionNo, items, idx: 0, choices: {},
        atCapital, capName: cap ? cap.name : '—',
        urgent: !!opts.urgent, reason: opts.reason || '', openedAt: Date.now(),
        isAdmin: !!(st.gov && st.gov.leader === 'player'),
        overrides: 0, results: [], myVote: {},
    };
    storyCouncilSessionRender();
    const el = document.getElementById('council-session');
    if (el) el.classList.remove('hidden');
}
function storyCouncilSessionRender() {
    const S = STORY._session; if (!S) return;
    const st = storyState(S.stateId); if (!st) return;
    const item = S.items[S.idx]; if (!item) return;
    const cmds = storyStateCommanders(st);
    if (S.myVote[S.idx] == null) S.myVote[S.idx] = storyCouncilDefaultVote(item, STORY.commander, st);   // kendi eğilimin işaretli gelir
    const myVote = S.myVote[S.idx];
    const tally = storyCouncilTally(item, cmds, st, myVote);
    S._tally = tally;

    const head = document.getElementById('cs-head');
    if (head) head.innerHTML =
        `<div class="cs-eyebrow">${storyDateLabel()} · ${S.capName} · ${S.urgent ? '⚠️ OLAĞANÜSTÜ ÇAĞRI' : COUNCIL_PERIOD_YEARS + ' YILLIK OLAĞAN TOPLANTI'}</div>`
        + `<h2 class="cs-title">${S.urgent ? 'OLAĞANÜSTÜ KONSEY' : 'KONSEY TOPLANTISI'}</h2>`
        + (S.reason ? `<div class="cs-reason">${S.reason}</div>` : '')
        + `<div class="cs-role">${S.isAdmin ? (S.atCapital ? '🏛️ <b style="color:#4cff7c">YÖNETİCİSİN — son sözü sen söylersin</b>' : '📡 <b style="color:#ffd24c">YÖNETİCİSİN ama başkentte değilsin — konseyi ezemezsin</b>') : ('🗳️ <b style="color:#9fb3c8">Bir oyun var; kararı Cumhurbaşkanı ' + ((typeof storyPresidentName === 'function') ? storyPresidentName(storyPlayerState()) : '') + ' verir</b>')}</div>`;

    const canOverride = S.isAdmin && S.atCapital;
    const decided = canOverride ? myVote : tally.winner.id;    // fiilen ne uygulanacak
    const overriding = canOverride && myVote !== tally.winner.id;

    const body = document.getElementById('cs-body');
    if (body) body.innerHTML =
        `<div class="cs-item-h"><span class="cs-item-ic">${item.icon}</span><div><div class="cs-item-t">${item.title}</div><div class="cs-item-d">${item.desc}</div></div></div>`
        + `<div class="cs-options">` + item.options.map(o => {
            const voters = tally.byOption[o.id] || [];
            const isWin = o.id === tally.winner.id;
            const isMine = o.id === myVote;
            const isDec = o.id === decided;
            const chips = voters.map(c => `<span class="cs-voter${c.isPlayer ? ' me' : ''}" title="${c.name} · sadakat ${Math.round(c.loyalty || 0)}">${c.isPlayer ? '◆' : (typeof storyPersonaIcon === 'function' ? storyPersonaIcon(c.personality) : '●')} ${c.name.split(' ')[0]}</span>`).join('');
            const tags = (isWin ? ' · ÇOĞUNLUK' : '') + (isDec && !isWin ? ' · KARAR' : '');
            return `<button class="cs-opt${isMine ? ' sel' : ''}${isWin ? ' major' : ''}${isDec ? ' decided' : ''}" data-opt="${o.id}">`
                + `<div class="cs-opt-h"><b>${o.name}</b><span class="cs-opt-meta">${o.meta || ''}</span></div>`
                + `<div class="cs-opt-d">${o.desc}</div>`
                + `<div class="cs-votes"><span class="cs-vc">${voters.length} oy${tags}</span>${chips}${isMine ? '<span class="cs-myvote">◆ OYUN</span>' : ''}</div>`
                + `</button>`;
        }).join('') + `</div>`
        + (overriding ? `<div class="cs-warn">⚠️ Konsey çoğunluğunu eziyorsun — <b>tüm komutanların sadakati −${(typeof cmdrBonus === 'function' && cmdrBonus(STORY.commander).overrideCost != null) ? cmdrBonus(STORY.commander).overrideCost : 5}</b> düşecek.</div>` : '')
        + (!S.isAdmin && myVote !== tally.winner.id
            ? `<div class="cs-warn">🗳️ Oyun <b>${(item.options.find(o => o.id === myVote) || {}).name}</b>, ama konsey <b>${tally.winner.name}</b> diyor — karar çoğunluğun. Yönetici olursan son sözü sen söylersin.</div>` : '')
        + (S.isAdmin && !S.atCapital
            ? `<div class="cs-warn">📡 Yöneticisin ama <b>${S.capName}</b>'da değilsin — bu toplantıda yalnız oy verebilirsin.</div>` : '');

    const foot = document.getElementById('cs-foot');
    if (foot) foot.innerHTML =
        `<div class="cs-prog">MADDE <b>${S.idx + 1}</b> / ${S.items.length}`
        + `<span class="cs-role-mini">${canOverride ? '🏛️ son söz sende' : '🗳️ oy hakkın var'}</span></div>`
        + `<button id="cs-next" class="story-btn cs-next">${S.idx + 1 < S.items.length ? (canOverride ? 'KARARI ONAYLA →' : 'OYUNU VER →') : 'TOPLANTIYI KAPAT'}</button>`;
}
// OYUNCU HER ZAMAN OY VERİR. (Önceki sürüm yönetici olmayan oyuncuyu tamamen dışarıda
// bırakıyordu: seçim tıklaması daha ilk satırda reddediliyor, karar oyuncu adına
// otomatik hesaplanıyordu. Konseyin bütün anlamı katılmaktı.)
//   · oy       → tabloyu değiştirir, beraberliği bozabilir  (herkes)
//   · nihai söz → çoğunluğu ezer, sadakate mal olur          (yönetici + başkentte)
function storyCouncilSessionPick(optId) {
    const S = STORY._session; if (!S) return;
    S.myVote[S.idx] = optId;                                  // OY: daima serbest
    if (S.isAdmin && S.atCapital) S.choices[S.idx] = optId;   // NİHAİ SÖZ: yalnız başkentteki yönetici
    else if (!S.isAdmin && !S._toldVoteOnly) { S._toldVoteOnly = 1; storyFlash('Oyun kaydedildi — kararı konsey çoğunluğu verir. Yönetici olursan son sözü sen söylersin.'); }
    else if (S.isAdmin && !S.atCapital && !S._toldAway) { S._toldAway = 1; storyFlash(`Oyun kaydedildi. Konseyi ezmek için ${S.capName}'da olmalısın.`); }
    storyCouncilSessionRender();
}
// Oyuncunun kişilik/yeteneklerinden türeyen VARSAYILAN tercih (oy vermeden önce işaretli gelir)
function storyCouncilDefaultVote(item, cmd, st) {
    const ctx = storyCouncilContext(st);
    let best = null, bestS = -Infinity;
    for (const o of item.options) {
        const s = storyCouncilVoteScore(cmd, o.id, o.appeal, ctx, o.welfare, o.loyGain);
        if (s > bestS) { bestS = s; best = o; }
    }
    return best ? best.id : (item.options[0] || {}).id;
}
function storyCouncilSessionNext() {
    const S = STORY._session; if (!S) return;
    const st = storyState(S.stateId); if (!st) { storyCouncilSessionClose(); return; }
    const item = S.items[S.idx];
    // Oyuncunun oyu tabloya DAHİL (beraberliği bozabilir); nihai sözü yalnız başkentteki yönetici koyar.
    const tally = S._tally || storyCouncilTally(item, storyStateCommanders(st), st, S.myVote[S.idx]);
    const canOverride = S.isAdmin && S.atCapital;
    const chosen = (canOverride && S.choices[S.idx]) ? S.choices[S.idx] : tally.winner.id;
    if (chosen !== tally.winner.id) {                         // konseyi ezmenin bedeli
        S.overrides++;
        // FAZ-7: 'Sopa' yeteneği bedeli düşürür (5 → 2)
        const pen = (typeof cmdrBonus === 'function' && cmdrBonus(STORY.commander).overrideCost != null)
            ? cmdrBonus(STORY.commander).overrideCost : 5;
        for (const c of storyStateCommanders(st)) if (!c.isPlayer) c.loyalty = Math.max(0, (c.loyalty == null ? 60 : c.loyalty) - pen);
    }
    const msg = storyCouncilApply(st, item, chosen);
    if (msg) S.results.push(msg);
    S.idx++;
    if (S.idx >= S.items.length) {
        storyLog(`🏛️ <b>KONSEY (${storyDateShort()})</b> — ${S.results.length ? S.results.join(' · ') : 'karar alınmadı'}`);
        if (S.overrides) storyLog(`⚠️ Konseyi ${S.overrides} kez ezdin — komutanların sadakati sarsıldı.`);
        storyCouncilSessionClose();
        if (typeof storySave === 'function') storySave();
        return;
    }
    storyCouncilSessionRender();
}
function storyCouncilSessionClose() {
    STORY._session = null;
    const el = document.getElementById('council-session');
    if (el) el.classList.add('hidden');
    if (typeof storyPanelUpdate === 'function') storyPanelUpdate();
    if (typeof storyRender === 'function') storyRender();
}

// ── KANUN/ANAYASA PANELİ (KONSEY drawer'ında gösterim) ──────────────────────
function storyCouncilLawsHtml(st) {
    const laws = st.laws || {};
    const rows = LAW_SLOTS.map(s => {
        const o = laws[s.key] ? lawOption(s.key, laws[s.key]) : null;
        return `<div class="cl-row"><span class="cl-ic">${s.icon}</span><span class="cl-slot">${s.name}</span>`
            + `<span class="cl-val${o ? '' : ' none'}">${o ? o.name : '— düzenlenmedi'}</span></div>`;
    }).join('');
    const c = storyConstitution(st);
    const next = Math.max(0, (STORY._nextCouncil || COUNCIL_PERIOD_YEARS * YEAR_SECONDS) - (STORY.clock || 0));
    return `<div class="council-laws">`
        + `<div class="cl-head">📜 ANAYASA</div>`
        + `<div class="cl-const">${c.icon} <b>${c.name}</b><div class="cl-cd">${c.desc}</div></div>`
        + `<div class="cl-head">⚖️ YÜRÜRLÜKTEKİ KANUNLAR</div>${rows}`
        + `<div class="cl-next">🏛️ Sonraki konsey: <b>${Math.ceil(next / YEAR_SECONDS * 4) / 4} yıl</b> sonra (${storyDateLabel()})</div>`
        + `</div>`;
}

// ── OLAY BAĞLAMA ────────────────────────────────────────────────────────────
function storyCouncilSessionBind() {
    const body = document.getElementById('cs-body');
    if (body) body.addEventListener('click', e => {
        const b = e.target.closest('[data-opt]'); if (b) storyCouncilSessionPick(b.dataset.opt);
    });
    const foot = document.getElementById('cs-foot');
    if (foot) foot.addEventListener('click', e => {
        if (e.target.closest('#cs-next')) storyCouncilSessionNext();
    });
}
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', storyCouncilSessionBind);
    else storyCouncilSessionBind();
}
