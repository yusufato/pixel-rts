// ═══════════════════════════════════════════════════════════════════════════
//  TEKNOLOJİ AĞACI (PIXEL EUROPA)  — veri tablosu
//  TEK ortak ağaç · 5 dal · ⭐puan yatırımı · 40 tech · derinlik 4 · her tech = TAKAS.
//  Etki anahtarları storyComputeTechBonusFor (Story.js) tarafından TECH_BONUS'a çevrilir;
//  düello motoru (globals.js applyTechSpawnBonus/applyTechCombatBonus) birime uygular,
//  stratejik anahtarlar (prodSpeed/poolCap/buildCost/cityDefense/cmdCap/loyalty) Production.js
//  ve Story.js tarafından okunur.
//  Anti-snowball: maliyet her alımda +%10; K3 için Devlet dalında ≥1 tech; K4 için ≥8 tech;
//  K2 kardeş ikilemi (biri alınırsa diğeri kilitlenir → her devlet farklı doktrin geliştirir).
//  ARTIK KONSEY OYLAR: hangi tech alınacağına komutanlar oy verir, yönetici karar verir (Council.js).
// ═══════════════════════════════════════════════════════════════════════════

const TECH_TREE = {
    branches: [
        { key: 'armor', icon: '⛽', name: 'Zırh Doktrini',     color: '#ff9a4c' },
        { key: 'mob',   icon: '👥', name: 'Seferberlik',       color: '#4cff7c' },
        { key: 'arty',  icon: '⭐', name: 'Topçu & Bilim',      color: '#ffd24c' },
        { key: 'state', icon: '🏛️', name: 'Devlet & Lojistik',  color: '#4c9fff' },
        { key: 'ind',   icon: '🏭', name: 'Sanayi & Üretim',    color: '#c78cff' },
    ],
    techs: [
        // ══ ⛽ ZIRH DOKTRİNİ — pahalı, vurucu, petrole bağımlı ══
        { id: 'diesel',    branch: 'armor', tier: 1, cost: 80,  name: 'Dizel Hatları',    desc: 'Zırhlı/araç deploy −%20 petrol',           prereq: [],                                  effect: { oilCost: 0.80 } },
        { id: 'tracks',    branch: 'armor', tier: 1, cost: 70,  name: 'Palet Teknolojisi', desc: 'Zırhlı sınıf +%10 hız',                   prereq: [],                                  effect: { armorSpeed: 1.10 } },
        { id: 'sloped',    branch: 'armor', tier: 2, cost: 140, name: 'Eğimli Zırh',      desc: 'Tank +%25 zırh (daha az hasar yer)',       prereq: ['diesel'],  sibling: 'maneuver',    effect: { tankArmor: 1.25 } },
        { id: 'maneuver',  branch: 'armor', tier: 2, cost: 120, name: 'Birleşik Manevra', desc: 'Mekanize+Zırhlı +%15 hız',                 prereq: ['diesel'],  sibling: 'sloped',      effect: { armorSpeed: 1.15 } },
        { id: 'heavybat',  branch: 'armor', tier: 3, cost: 240, name: 'Ağır Tabur',       desc: 'Tank +%25 dayanıklılık (bölgeyi tutar)',   prereq: ['sloped'],                          effect: { tankHp: 1.25 } },
        { id: 'blitz',     branch: 'armor', tier: 3, cost: 230, name: 'Yıldırım Harbi',   desc: 'Tank atışı +%20 (hızlı yarma)',            prereq: ['maneuver'],                        effect: { tankAtk: 1.20 } },
        { id: 'mainbattle',branch: 'armor', tier: 4, cost: 400, name: 'Muharebe Tankı',   desc: 'Tank +%20 dayanıklılık, +%15 zırh',        prereq: ['heavybat'],                        effect: { tankHp: 1.20, tankArmor: 1.15 } },
        { id: 'armorfist', branch: 'armor', tier: 4, cost: 380, name: 'Zırhlı Yumruk',    desc: 'Mekanize+Zırhlı piyade +%25 dayanıklılık', prereq: ['blitz'],                           effect: { mechHp: 1.25 } },

        // ══ 👥 SEFERBERLİK — ucuz, kalabalık, insan gücüne bağımlı ══
        { id: 'conscript', branch: 'mob',   tier: 1, cost: 60,  name: 'Zorunlu Hizmet',   desc: 'Piyade deploy −%25 insan gücü',            prereq: [],                                  effect: { manpowerCost: 0.75 } },
        { id: 'drill',     branch: 'mob',   tier: 1, cost: 75,  name: 'Talim Nizamı',     desc: 'Piyade atışı +%15',                        prereq: [],                                  effect: { infantryAtk: 1.15 } },
        { id: 'trench',    branch: 'mob',   tier: 2, cost: 100, name: 'Siper Kazısı',     desc: 'Piyade +%30 dayanıklılık',                 prereq: ['conscript'], sibling: 'recon',     effect: { infantryHp: 1.30 } },
        { id: 'recon',     branch: 'mob',   tier: 2, cost: 90,  name: 'İleri Keşif',      desc: 'Keşif görüşü +%40',                        prereq: ['conscript'], sibling: 'trench',    effect: { reconVision: 1.40 } },
        { id: 'peoplearmy',branch: 'mob',   tier: 3, cost: 200, name: 'Halk Ordusu',      desc: 'Her fetihte +2 gazi piyade',               prereq: ['trench'],                          effect: { conquestVets: 2 } },
        { id: 'infiltrate',branch: 'mob',   tier: 3, cost: 210, name: 'Sızma Taktiği',    desc: 'Tüm birlikler +%8 hız',                    prereq: ['recon'],                           effect: { allSpeed: 1.08 } },
        { id: 'reserves',  branch: 'mob',   tier: 4, cost: 360, name: 'Yedek Ordu',       desc: 'Her şehrin ordu kapasitesi +6',            prereq: ['peoplearmy'],                      effect: { poolCap: 6 } },
        { id: 'veterancy', branch: 'mob',   tier: 4, cost: 390, name: 'Gazi Nizamı',      desc: 'TÜM birlikler +%12 dayanıklılık',          prereq: ['infiltrate'],                      effect: { allHp: 1.12 } },

        // ══ ⭐ TOPÇU & BİLİM — menzil, karşı-zırh, uzmanlık ══
        { id: 'barrel',    branch: 'arty',  tier: 1, cost: 90,  name: 'Namlu Standardı',  desc: 'Topçu splash hasarı +%20',                 prereq: [],                                  effect: { artySplash: 1.20 } },
        { id: 'ballistics',branch: 'arty',  tier: 1, cost: 85,  name: 'Balistik Hesap',   desc: 'Topçu atışı +%12',                         prereq: [],                                  effect: { artyAtk: 1.12 } },
        { id: 'shrapnel',  branch: 'arty',  tier: 2, cost: 150, name: 'Şarapnel',         desc: 'Topçu piyadeye +%35 (anti-piyade)',        prereq: ['barrel'],  sibling: 'shaped',      effect: { artyVsInf: 1.35 } },
        { id: 'shaped',    branch: 'arty',  tier: 2, cost: 140, name: 'Şekilli Şarj',     desc: 'Tanksavar tanka +%50 (anti-zırh)',         prereq: ['barrel'],  sibling: 'shrapnel',    effect: { atVsTank: 1.50 } },
        { id: 'barrage',   branch: 'arty',  tier: 3, cost: 260, name: 'Baraj Ateşi',      desc: 'Topçu atışı +%20 (ağır bombardıman)',      prereq: ['shrapnel'],                        effect: { artyAtk: 1.20 } },
        { id: 'atgun',     branch: 'arty',  tier: 3, cost: 250, name: 'Ağır Tanksavar',   desc: 'Tanksavar +%30 dayanıklılık',              prereq: ['shaped'],                          effect: { atHp: 1.30 } },
        { id: 'counterbat',branch: 'arty',  tier: 4, cost: 410, name: 'Karşı Batarya',    desc: 'Topçu atışı +%15, splash +%15',            prereq: ['barrage'],                         effect: { artyAtk: 1.15, artySplash: 1.15 } },
        { id: 'rocketry',  branch: 'arty',  tier: 4, cost: 395, name: 'Roketatar',        desc: 'Topçu splash +%30 (alan silahı)',          prereq: ['atgun'],                           effect: { artySplash: 1.30 } },

        // ══ 🏛️ DEVLET & LOJİSTİK — çarpan/kapı; K3'leri açar ══
        { id: 'tax',       branch: 'state', tier: 1, cost: 70,  name: 'Vergi Reformu',    desc: 'Tüm şehir +%15 ⭐puan geliri',              prereq: [],                                  effect: { pointsIncome: 1.15 } },
        { id: 'intel',     branch: 'state', tier: 1, cost: 140, name: 'İstihbarat Ağı',   desc: 'Komşu düşman savunma gücü görünür',        prereq: [],                                  effect: { intel: true } },
        { id: 'academy',   branch: 'state', tier: 2, cost: 130, name: 'Subay Okulu',      desc: 'Yeni komutan +1 başlangıç yeteneği',       prereq: ['tax'],                             effect: { officer: 1 } },
        { id: 'railways',  branch: 'state', tier: 2, cost: 160, name: 'Demiryolu Ağı',    desc: '⛽petrol ve 👥insan geliri +%15',           prereq: ['tax'],                             effect: { oilIncome: 1.15, manIncome: 1.15 } },
        { id: 'wareco',    branch: 'state', tier: 3, cost: 220, name: 'Savaş Ekonomisi',  desc: 'Tüm birim üretimi −%15 (3 kaynak)',        prereq: ['academy'],                         effect: { allCost: 0.85 } },
        { id: 'genstaff',  branch: 'state', tier: 3, cost: 270, name: 'Genelkurmay',      desc: 'Komutan kadrosu +1 (daha geniş konsey)',   prereq: ['academy'],                         effect: { cmdCap: 1 } },
        { id: 'propaganda',branch: 'state', tier: 4, cost: 370, name: 'Propaganda Bakanlığı', desc: 'Sadakat erimesi −%50 (firar/darbe azalır)', prereq: ['wareco'],                    effect: { loyaltyHold: 0.50 } },
        { id: 'fortress',  branch: 'state', tier: 4, cost: 350, name: 'Tahkimat Dairesi', desc: 'Tüm şehirlerin savunması +%15',            prereq: ['railways'],                        effect: { cityDefense: 0.15 } },

        // ══ 🏭 SANAYİ & ÜRETİM — şehir üretim hattına doğrudan bağlı ══
        { id: 'assembly',  branch: 'ind',   tier: 1, cost: 75,  name: 'Montaj Hattı',     desc: 'Birim üretim süresi −%15',                 prereq: [],                                  effect: { prodSpeed: 0.85 } },
        { id: 'quarry',    branch: 'ind',   tier: 1, cost: 80,  name: 'Maden İşletmesi',  desc: '⛽petrol geliri +%12',                      prereq: [],                                  effect: { oilIncome: 1.12 } },
        { id: 'massprod',  branch: 'ind',   tier: 2, cost: 155, name: 'Seri Üretim',      desc: 'Üretim süresi −%15 daha (hız doktrini)',   prereq: ['assembly'], sibling: 'precision',  effect: { prodSpeed: 0.85 } },
        { id: 'precision', branch: 'ind',   tier: 2, cost: 165, name: 'Hassas İmalat',    desc: 'TÜM birlikler +%8 dayanıklılık (kalite)',  prereq: ['assembly'], sibling: 'massprod',   effect: { allHp: 1.08 } },
        { id: 'depots',    branch: 'ind',   tier: 3, cost: 235, name: 'İkmal Depoları',   desc: 'Her şehrin ordu kapasitesi +8',            prereq: ['massprod'],                        effect: { poolCap: 8 } },
        { id: 'engineer',  branch: 'ind',   tier: 3, cost: 245, name: 'İstihkam Bürosu',  desc: 'Bina inşa/yükseltme −%25',                 prereq: ['precision'],                       effect: { buildCost: 0.75 } },
        { id: 'warfactory',branch: 'ind',   tier: 4, cost: 420, name: 'Savaş Fabrikaları', desc: 'Üretim süresi −%20, bina −%15',           prereq: ['depots'],                          effect: { prodSpeed: 0.80, buildCost: 0.85 } },
        { id: 'standard',  branch: 'ind',   tier: 4, cost: 385, name: 'Standardizasyon',  desc: 'Birim maliyeti −%10, kapasite +6',         prereq: ['engineer'],                        effect: { allCost: 0.90, poolCap: 6 } },
    ],
};
// id → tech hızlı erişim
const TECH_BY_ID = {};
TECH_TREE.techs.forEach(t => { TECH_BY_ID[t.id] = t; });
