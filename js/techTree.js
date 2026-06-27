// ═══════════════════════════════════════════════════════════════════════════
//  TEKNOLOJİ AĞACI (PIXEL EUROPA — Faz-2 Adım 4)  — veri tablosu
//  Tasarım: TEKNOLOJI_AGACI.md (3-uzman konsey sentezi).
//  TEK ortak ağaç · 4 dal · ⭐puan yatırımı · ~16 tech · derinlik 3 · her tech = TAKAS.
//  Etki anahtarları storyComputeTechBonus (Story.js) tarafından TECH_BONUS'a çevrilir;
//  düello motoru (Unit.js applyTechSpawnBonus/applyTechCombatBonus) SADECE mavi birime uygular.
//  Anti-snowball: maliyet her alımda +%10; K3 için Dal-4'te ≥1 tech şart; K2 kardeş ikilemi.
// ═══════════════════════════════════════════════════════════════════════════

const TECH_TREE = {
    branches: [
        { key: 'armor', icon: '⛽', name: 'Zırh Doktrini', color: '#ff9a4c' },
        { key: 'mob',   icon: '👥', name: 'Seferberlik',   color: '#4cff7c' },
        { key: 'arty',  icon: '⭐', name: 'Topçu & Bilim',  color: '#ffd24c' },
        { key: 'state', icon: '🏛️', name: 'Devlet & Lojistik', color: '#4c9fff' },
    ],
    techs: [
        // ⛽ ZIRH DOKTRİNİ
        { id: 'diesel',    branch: 'armor', tier: 1, cost: 80,  name: 'Dizel Hatları',   desc: 'Zırhlı/araç deploy −%20 petrol',          prereq: [],                 effect: { oilCost: 0.80 } },
        { id: 'sloped',    branch: 'armor', tier: 2, cost: 140, name: 'Eğimli Zırh',     desc: 'Tank +%25 zırh (daha az hasar yer)',      prereq: ['diesel'], sibling: 'maneuver', effect: { tankArmor: 1.25 } },
        { id: 'maneuver',  branch: 'armor', tier: 2, cost: 120, name: 'Birleşik Manevra', desc: 'Mekanize+Zırhlı +%15 hız',               prereq: ['diesel'], sibling: 'sloped',   effect: { armorSpeed: 1.15 } },
        { id: 'heavybat',  branch: 'armor', tier: 3, cost: 240, name: 'Ağır Tabur',      desc: 'Tank +%25 dayanıklılık (bölgeyi tutar)', prereq: ['sloped'],         effect: { tankHp: 1.25 } },
        // 👥 SEFERBERLİK
        { id: 'conscript', branch: 'mob',   tier: 1, cost: 60,  name: 'Zorunlu Hizmet',  desc: 'Piyade deploy −%25 insan gücü',           prereq: [],                 effect: { manpowerCost: 0.75 } },
        { id: 'trench',    branch: 'mob',   tier: 2, cost: 100, name: 'Siper Kazısı',    desc: 'Piyade +%30 dayanıklılık',                prereq: ['conscript'], sibling: 'recon', effect: { infantryHp: 1.30 } },
        { id: 'recon',     branch: 'mob',   tier: 2, cost: 90,  name: 'İleri Keşif',     desc: 'Keşif görüşü +%40',                       prereq: ['conscript'], sibling: 'trench', effect: { reconVision: 1.40 } },
        { id: 'peoplearmy',branch: 'mob',   tier: 3, cost: 200, name: 'Halk Ordusu',     desc: 'Her fetihte +2 gazi piyade',              prereq: ['trench'],         effect: { conquestVets: 2 } },
        // ⭐ TOPÇU & BİLİM
        { id: 'barrel',    branch: 'arty',  tier: 1, cost: 90,  name: 'Namlu Standardı', desc: 'Topçu splash hasarı +%20',                prereq: [],                 effect: { artySplash: 1.20 } },
        { id: 'shrapnel',  branch: 'arty',  tier: 2, cost: 150, name: 'Şarapnel',        desc: 'Topçu piyadeye +%35 (anti-piyade)',       prereq: ['barrel'], sibling: 'shaped',  effect: { artyVsInf: 1.35 } },
        { id: 'shaped',    branch: 'arty',  tier: 2, cost: 140, name: 'Şekilli Şarj',    desc: 'Tanksavar tanka +%50 (anti-zırh)',        prereq: ['barrel'], sibling: 'shrapnel', effect: { atVsTank: 1.50 } },
        { id: 'barrage',   branch: 'arty',  tier: 3, cost: 260, name: 'Baraj Ateşi',     desc: 'Topçu atışı +%20 (ağır bombardıman)',     prereq: ['shrapnel'],       effect: { artyAtk: 1.20 } },
        // 🏛️ DEVLET & LOJİSTİK (çarpan/kapı — K3'leri açar)
        { id: 'tax',       branch: 'state', tier: 1, cost: 70,  name: 'Vergi Reformu',   desc: 'Tüm şehir +%15 ⭐puan geliri',             prereq: [],                 effect: { pointsIncome: 1.15 } },
        { id: 'intel',     branch: 'state', tier: 1, cost: 140, name: 'İstihbarat Ağı',  desc: 'Komşu düşman savunma gücü görünür',       prereq: [],                 effect: { intel: true } },
        { id: 'academy',   branch: 'state', tier: 2, cost: 130, name: 'Subay Okulu',     desc: 'Yeni komutan +1 başlangıç yeteneği',      prereq: ['tax'],            effect: { officer: 1 } },
        { id: 'wareco',    branch: 'state', tier: 3, cost: 220, name: 'Savaş Ekonomisi', desc: 'Tüm birim üretimi −%15 (3 kaynak)',       prereq: ['academy'],        effect: { allCost: 0.85 } },
    ],
};
// id → tech hızlı erişim
const TECH_BY_ID = {};
TECH_TREE.techs.forEach(t => { TECH_BY_ID[t.id] = t; });
