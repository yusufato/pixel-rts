// ═══════════════════════════════════════════════════════════════════════════
//  Story.js — HİKAYE / AÇIK-DÜNYA FAZ-1  (Modern çağ, yaşayan-dünya sandbox)
//  Düello motorunun ÜSTÜNE biner; çekirdek sim'e DOKUNMAZ. Komutan dünya-haritasında
//  gezer → komşu düşman bölgeye saldırır → 10 haritadan birinde DÜELLO (mevcut motor)
//  → kazan: bölgeyi fethet + itibar/kaynak, sağ kalanlar GAZİ (sonraki savaşa taşınır).
//  Kaynak (petrol/insan/puan) → ordu bütçesi. Refah+itibar → seçim → yönetici.
//  localStorage kalıcılık (bağışlayıcı roguelite). Tek-oyuncu/Hızlı-Maç/MP BOZULMADAN.
//
//  Determinizm NOTU: Hikaye META katmanı tek-oyunculu → Math.random/Date.now SERBEST
//  (lockstep sim DEĞİL). Sadece DÜELLO içi (stepSim) deterministik kalır.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_SAVE_KEY = 'pixelrts_story_v3';   // v3: 82-ŞEHİR hareket ağı (v1 ızgara / v2 36-ülke kayıtları yok sayılır)

// 8 BÜYÜK GÜÇ (her biri cumhuriyet). 0 = OYUNCU (Türkiye merkezli). Harita+panel rengi.
// MODERN ÇAĞ: devlet adları çağdaş blok/pakt diline çevrildi; `cult` anahtarı
// şehir adlandırma kültürünü seçer (fetheden şehre KENDİ kültüründen ad verir).
const STORY_STATE_DEFS = [
    { name: 'Türk Cumhuriyeti',   cult: 'tr', color: '#4cff7c' },   // 0 OYUNCU
    { name: 'İber Federasyonu',   cult: 'ib', color: '#ff8a3c' },   // 1
    { name: 'Britanya Topluluğu', cult: 'br', color: '#e34c4c' },   // 2
    { name: 'Cermen Federasyonu', cult: 'ge', color: '#e0d24c' },   // 3
    { name: 'Kuzey Paktı',        cult: 'no', color: '#4cc8ff' },   // 4
    { name: 'Slav Federasyonu',   cult: 'sl', color: '#b07cff' },   // 5
    { name: 'Mağrip Konseyi',     cult: 'mg', color: '#d98cc0' },   // 6
    { name: 'Arap Koalisyonu',    cult: 'ar', color: '#cfa14c' }     // 7
];
const STORY_RANKS = [
    { name: 'Teğmen', xp: 0 }, { name: 'Yüzbaşı', xp: 600 }, { name: 'Binbaşı', xp: 1400 },
    { name: 'Albay', xp: 2400 }, { name: 'Tümgeneral', xp: 3600 }, { name: 'Mareşal', xp: 5200 }
];

// ── HARİTA: 36 bölge (Avrupa+K.Afrika+Orta Doğu). lx,ly = harita üzerinde normalize konum 0..1.
//  Konumlar KULLANICININ terrain.png haritasına hizalandı (hepsi karada). Voronoi ile bölge atanır.
const EUROPE_PLACES = [
    { name: 'İrlanda',     lx: 0.175, ly: 0.390 }, //0
    { name: 'İngiltere',   lx: 0.245, ly: 0.410 }, //1
    { name: 'Portekiz',    lx: 0.135, ly: 0.660 }, //2
    { name: 'İspanya',     lx: 0.190, ly: 0.645 }, //3
    { name: 'Fransa',      lx: 0.303, ly: 0.545 }, //4
    { name: 'Hollanda',    lx: 0.345, ly: 0.410 }, //5
    { name: 'Almanya',     lx: 0.395, ly: 0.430 }, //6
    { name: 'Danimarka',   lx: 0.385, ly: 0.340 }, //7
    { name: 'İsviçre',     lx: 0.357, ly: 0.535 }, //8
    { name: 'İtalya',      lx: 0.405, ly: 0.620 }, //9
    { name: 'Norveç',      lx: 0.395, ly: 0.210 }, //10
    { name: 'İsveç',       lx: 0.455, ly: 0.220 }, //11
    { name: 'Finlandiya',  lx: 0.550, ly: 0.200 }, //12
    { name: 'Baltık',      lx: 0.495, ly: 0.300 }, //13
    { name: 'Polonya',     lx: 0.465, ly: 0.430 }, //14
    { name: 'Çekya',       lx: 0.420, ly: 0.470 }, //15
    { name: 'Avusturya',   lx: 0.430, ly: 0.500 }, //16
    { name: 'Macaristan',  lx: 0.470, ly: 0.500 }, //17
    { name: 'Sırbistan',   lx: 0.490, ly: 0.560 }, //18
    { name: 'Romanya',     lx: 0.545, ly: 0.520 }, //19
    { name: 'Bulgaristan', lx: 0.550, ly: 0.600 }, //20
    { name: 'Yunanistan',  lx: 0.510, ly: 0.670 }, //21
    { name: 'Belarus',     lx: 0.565, ly: 0.390 }, //22
    { name: 'Ukrayna',     lx: 0.610, ly: 0.455 }, //23
    { name: 'Rusya',       lx: 0.800, ly: 0.310 }, //24
    { name: 'Türkiye',     lx: 0.670, ly: 0.660 }, //25 ← OYUNCU başkenti
    { name: 'Suriye',      lx: 0.770, ly: 0.730 }, //26
    { name: 'İsrail',      lx: 0.763, ly: 0.805 }, //27
    { name: 'Ürdün',       lx: 0.795, ly: 0.810 }, //28
    { name: 'Irak',        lx: 0.880, ly: 0.760 }, //29
    { name: 'Suudi Ar.',   lx: 0.900, ly: 0.915 }, //30
    { name: 'Mısır',       lx: 0.690, ly: 0.915 }, //31
    { name: 'Libya',       lx: 0.550, ly: 0.885 }, //32
    { name: 'Tunus',       lx: 0.497, ly: 0.745 }, //33
    { name: 'Cezayir',     lx: 0.317, ly: 0.915 }, //34
    { name: 'Fas',         lx: 0.170, ly: 0.830 }  //35
];
// gerçek(çe) kara/deniz sınırları → savaş coğrafi yayılır (Avrupa + Akdeniz + Orta Doğu)
const EUROPE_EDGES = [
    // Batı/Orta Avrupa
    [2,3],[3,4],[3,35],[4,5],[4,6],[4,8],[4,9],[4,1],[1,0],[1,5],[5,6],[6,7],[6,8],[6,14],[6,15],
    [7,10],[7,11],[10,11],[10,12],[11,12],[11,13],[12,13],[12,24],[8,9],[8,16],[9,16],[9,18],[9,21],
    // Orta/Doğu Avrupa + Balkanlar
    [14,15],[14,13],[14,22],[14,23],[15,16],[15,17],[16,17],[16,18],[17,18],[17,19],[18,19],[18,20],
    [18,21],[19,20],[19,23],[20,21],[20,25],[21,25],[22,23],[22,13],[22,24],[23,24],
    // Orta Doğu
    [25,26],[25,29],[26,27],[26,28],[26,29],[27,28],[27,31],[28,29],[28,30],[29,30],[30,31],
    // Kuzey Afrika
    [31,32],[32,33],[32,34],[33,34],[34,35]
];
// başkentler (devlet → ülke-id). Oyuncu(0)=Türkiye. BFS tie-break'te oyuncu SON → dengeli başlar.
const EUROPE_CAPS = [
    { st: 1, n: 3 }, { st: 2, n: 1 }, { st: 3, n: 6 }, { st: 4, n: 11 },
    { st: 5, n: 24 }, { st: 6, n: 34 }, { st: 7, n: 30 }, { st: 0, n: 25 }
];

const STORY = {
    active: false,        // kampanya yüklü/çalışıyor mu?
    battleCtx: null,      // düello sürerken: { nodeId, attacker, defender }  (null = düello yok)
    states: [],           // [{ id, name, color, isPlayer, res:{oil,manpower,points}, welfare, reputation, isAdmin }]
    nodes: [],            // [{ id, name, gx, gy, lx, ly, owner, mapId, neighbors:[ids] }]
    playerStateId: 0,
    commander: { node: 0 },   // oyuncunun komutan-jetonu (hangi düğümde)
    veterans: [],         // [{ type, vet }] sağ kalan gazi-çekirdek (savaştan savaşa taşınır)
    cfg: { abundance: 1.0 },
    paused: false,        // dünya CANLI başlar (kaynak büyür, devletler kıpırdar); ⏸ ile durdurulabilir
    clock: 0,             // geçen dünya-zamanı (sn, sadece duraklatılmadıyken akar)
    log: [],              // son olaylar (panelde)
    _accResource: 0,      // kaynak biriktirme sayacı
    _accDrift: 0,         // düşman yayılma sayacı
    _lastRenderT: 0,      // render throttle
    _hoverNode: -1,
    selectedNodeId: null, // War Room brifingi için seçili şehir (komut verilene kadar yalnız UI state'i)
    _inited: false
};

// ── KÜÇÜK YARDIMCILAR ────────────────────────────────────────────────────────
function storyState(id) { return STORY.states[id]; }
function storyPlayerState() { return STORY.states[STORY.playerStateId]; }
function storyNode(id) { return STORY.nodes[id]; }
function storyLog(msg) { STORY.log.unshift(msg); if (STORY.log.length > 6) STORY.log.length = 6; }
function storyCommanderBackfill(cmd) {
    if (!cmd) return;
    if (cmd.xp == null) cmd.xp = 0;
    if (cmd.score == null) cmd.score = cmd.xp;
    if (cmd.victories == null) cmd.victories = 0;
    if (!Array.isArray(cmd.activePerks)) cmd.activePerks = [];
    if (!cmd.rewardMods) cmd.rewardMods = {};
    if (!cmd.army || typeof cmd.army !== 'object') cmd.army = {};   // FAZ-5: sefer ordusu (komutanla gezer)
    cmd.rank = Math.max(1, STORY_RANKS.filter(rank => cmd.xp >= rank.xp).length);
}

function storyHasSave() {
    try { return !!localStorage.getItem(STORY_SAVE_KEY); } catch (_) { return false; }
}

// ── DÜNYA ÜRETİMİ (gerçek Avrupa: ülke düğümleri + sınır komşuluğu + başkent-BFS sahiplik) ──
function storyBfsDist(nodes, srcId) {
    const dist = new Array(nodes.length).fill(Infinity);
    dist[srcId] = 0;
    const q = [srcId];
    while (q.length) {
        const u = q.shift();
        for (const v of nodes[u].neighbors) {
            if (dist[v] === Infinity) { dist[v] = dist[u] + 1; q.push(v); }
        }
    }
    return dist;
}
function storyBuildEurope() {
    const nodes = EUROPE_PLACES.map((p, id) => ({
        id, name: p.name, lx: p.lx, ly: p.ly, owner: 0, mapId: id % MAPS_LEN(), neighbors: []
    }));
    for (const e of EUROPE_EDGES) { nodes[e[0]].neighbors.push(e[1]); nodes[e[1]].neighbors.push(e[0]); }
    // her ülke → graf-mesafesi (BFS hop) en yakın başkente. EUROPE_CAPS sırası tie-break (oyuncu SON).
    const dists = EUROPE_CAPS.map(c => storyBfsDist(nodes, c.n));
    for (const node of nodes) {
        let best = 0, bestD = Infinity;
        for (let i = 0; i < EUROPE_CAPS.length; i++) {
            if (dists[i][node.id] < bestD) { bestD = dists[i][node.id]; best = i; }
        }
        node.owner = EUROPE_CAPS[best].st;
    }
    return nodes;
}
// ── 82 ŞEHİR HAREKET AĞI (Faz-2): STORY_TERRAIN.cities → düğümler; K-en-yakın komşuluk + bağlı; 8 başkent-BFS sahiplik ──
function storyCityName(id) { return 'Şehir ' + (id + 1); }   // yalnız ad-öncesi yer tutucu

// ── ŞEHİR ADLANDIRMA — kültürel üreteç ─────────────────────────────────────
// Her devletin taban×ek havuzu var (12×8=96 benzersiz ad ≥ 82 şehir). Ad,
// (şehir id, devlet) çiftinden DETERMİNİSTİK üretilir ve n.names'e önbelleklenir:
// aynı devlet şehri geri alınca ESKİ adı geri gelir (gerçek dünyadaki gibi —
// şehirlerin fatihe göre ayrı adları olur, rastgele değişip durmaz).
const CITY_NAME_PARTS = {
    tr: { b: ['Ak', 'Kara', 'Gök', 'Demir', 'Taş', 'Boz', 'Ulu', 'Yeşil', 'Ay', 'Gün', 'Er', 'Öz'],
          s: ['hisar', 'kent', 'şehir', 'ova', 'köprü', 'yaka', 'tepe', 'eli'] },
    ib: { b: ['Villa', 'Monte', 'Puerto', 'Torre', 'Costa', 'Rio', 'Sierra', 'Alta', 'Nueva', 'Vista', 'Casa', 'Vega'],
          s: ['verde', 'mar', 'luz', 'rey', 'sol', 'blanca', 'rosa', 'flor'] },
    br: { b: ['Ash', 'Ox', 'Win', 'Nor', 'Black', 'Stone', 'Fair', 'Wool', 'Kings', 'East', 'Grey', 'Mill'],
          s: ['ford', 'ton', 'bury', 'port', 'field', 'bridge', 'gate', 'mouth'] },
    ge: { b: ['Neu', 'Ober', 'Bad', 'Rhein', 'Stein', 'Wolfs', 'Grün', 'Falken', 'Eisen', 'Hoch', 'Rot', 'Linden'],
          s: ['burg', 'stadt', 'heim', 'feld', 'bach', 'hafen', 'berg', 'tal'] },
    no: { b: ['Nord', 'Björn', 'Ulv', 'Sten', 'Fjell', 'Ny', 'Öster', 'Vinter', 'Sol', 'Havs', 'Lund', 'Björk'],
          s: ['vik', 'borg', 'stad', 'fjord', 'havn', 'dal', 'ström', 'näs'] },
    sl: { b: ['Novo', 'Belo', 'Volgo', 'Petro', 'Zlato', 'Krasno', 'Staro', 'Mir', 'Sever', 'Serebro', 'Dnepro', 'Vostok'],
          s: ['grad', 'gorsk', 'pol', 'slavl', 'retsk', 'zavod', 'birsk', 'morsk'] },
    mg: { b: ['Ayn', 'Dar', 'Kasr', 'Vadi', 'Tel', 'Bordj', 'Sidi', 'Beni', 'Bab', 'Ksar', 'Ued', 'Ait'],
          s: [' Azrak', ' Kebir', ' Cedid', ' Beyda', ' Garbi', ' Şarki', ' Aliya', ' Sagira'] },
    ar: { b: ['Ras', 'Umm', 'Deyr', 'Cebel', 'Bahr', 'Ayn', 'Tel', 'Vadi', 'Kasr', 'Bab', 'Nahr', 'Reml'],
          s: [' Nur', ' Selam', ' Hayr', ' Şems', ' Feth', ' Emel', ' Zafer', ' Kamer'] },
};
function storyCityNameFor(id, stId) {
    const cult = (STORY_STATE_DEFS[stId] || {}).cult || 'tr';
    const p = CITY_NAME_PARTS[cult] || CITY_NAME_PARTS.tr;
    return p.b[id % p.b.length] + p.s[Math.floor(id / p.b.length) % p.s.length];
}
// Sahibi değişen (veya ilk kez adlanan) şehre sahibinin kültüründen ad ver.
// n.names önbelleği node içinde durduğu için kaydet/yükle ile birlikte yaşar.
function storyCityRename(n) {
    if (!n) return;
    // GERÇEK HARİTA: gerçek şehir adı kalıcıdır (İstanbul → 'Belozavod' olmaz).
    if (n.geo && typeof GEO_CITIES !== 'undefined' && GEO_CITIES[n.id]) { n.name = GEO_CITIES[n.id].name; return; }
    if (!n.names) n.names = {};
    if (!n.names[n.owner]) n.names[n.owner] = storyCityNameFor(n.id, n.owner);
    n.name = n.names[n.owner];
}
function storyDist2(a, b) { const dx = a.lx - b.lx, dy = a.ly - b.ly; return dx * dx + dy * dy; }
// kopuk bileşenleri en yakın çiftle birleştir → tek gezilebilir graf (her şehre ulaşılır)
function storyConnectComponents(nodes) {
    const comp = new Array(nodes.length).fill(-1); let nc = 0;
    for (let s = 0; s < nodes.length; s++) {
        if (comp[s] >= 0) continue;
        const q = [s]; comp[s] = nc;
        while (q.length) { const u = q.pop(); for (const v of nodes[u].neighbors) if (comp[v] < 0) { comp[v] = nc; q.push(v); } }
        nc++;
    }
    for (let c = 1; c < nc; c++) {
        let bi = -1, bj = -1, bd = Infinity;
        for (let i = 0; i < nodes.length; i++) {
            if (comp[i] !== c) continue;
            for (let j = 0; j < nodes.length; j++) { if (comp[j] === c) continue; const d = storyDist2(nodes[i], nodes[j]); if (d < bd) { bd = d; bi = i; bj = j; } }
        }
        if (bi >= 0) { nodes[bi].neighbors.push(bj); nodes[bj].neighbors.push(bi); const mg = comp[bj]; for (let i = 0; i < nodes.length; i++) if (comp[i] === c) comp[i] = mg; }
    }
}
// 8 başkent: oyuncu(0)=merkeze yakın şehir; gerisi farthest-point (yayılmış güçler)
function storyPickCapitals(nodes, k) {
    let p0 = 0, bd = Infinity;
    for (const n of nodes) { const dx = n.lx - 0.55, dy = n.ly - 0.5, d = dx * dx + dy * dy; if (d < bd) { bd = d; p0 = n.id; } }
    const caps = [p0];
    while (caps.length < k && caps.length < nodes.length) {
        let far = -1, fd = -1;
        for (const n of nodes) {
            if (caps.indexOf(n.id) >= 0) continue;
            let md = Infinity; for (const c of caps) { const d = storyDist2(n, nodes[c]); if (d < md) md = d; }
            if (md > fd) { fd = md; far = n.id; }
        }
        if (far < 0) break; caps.push(far);
    }
    return caps;
}
// ── GERÇEK AVRUPA (design teslimi "yeni avrupa harita"): 50 gerçek şehir,
// gerçek koridorlar, gerçek kıyı çizgisi (js/geoData.js — build adımıyla gömülü).
// Eski prosedürel yol yedek olarak durur (geoData yoksa / eski kayıtlar).
function storyBuildCitiesGeo() {
    STORY._geoMap = true;
    const nodes = GEO_CITIES.map((c, id) => ({
        id, name: c.name, lx: c.x / GEO.W, ly: c.y / GEO.H, owner: c.st, mapId: id % MAPS_LEN(),
        neighbors: [], cities: 1,
        oil: c.oil ? 2 : 0, pts: Math.max(0, c.tier - 1),        // yataklar: petrol şehirleri + büyük şehir ekonomisi
        level: c.tier, garrison: 0,                               // tier = başlangıç şehir seviyesi (organik büyüme devam eder)
        fac: Math.min(c.fac, c.tier + 1), bar: c.tier >= 2 ? 1 : 0,   // spec'teki fabrika seviyeleri (İstanbul 3 baca!)
        pool: {}, q: [], pop: null, wealth: 0, geo: 1, names: null
    }));
    // GERÇEK ADLAR KALICI: İstanbul her bayrak altında İstanbul'dur — fetih kültürel
    // ad üretmesin diye tüm sahipler için ad önbelleği gerçek adla doldurulur.
    for (const n of nodes) { n.names = {}; for (let s = 0; s < STORY_STATE_DEFS.length; s++) n.names[s] = n.name; }
    for (const [a, b] of GEO_ROADS) {
        if (nodes[a].neighbors.indexOf(b) < 0) nodes[a].neighbors.push(b);
        if (nodes[b].neighbors.indexOf(a) < 0) nodes[b].neighbors.push(a);
    }
    for (const a of nodes) {                                      // yolu olmayan şehir en yakın 2'ye bağlanır
        if (a.neighbors.length) continue;
        const near = nodes.filter(b => b !== a).sort((x, y) => storyDist2(a, x) - storyDist2(a, y)).slice(0, 2);
        for (const b of near) { a.neighbors.push(b.id); if (b.neighbors.indexOf(a.id) < 0) b.neighbors.push(a.id); }
    }
    storyConnectComponents(nodes);
    const caps = [];                                              // başkent: devletin tier-3 şehri
    for (let s = 0; s < STORY_STATE_DEFS.length; s++) {
        const cap = nodes.find(n => n.owner === s && n.level === 3) || nodes.find(n => n.owner === s);
        caps.push(cap ? cap.id : 0);
    }
    STORY._capitals = caps;
    for (const capId of caps) { const c = nodes[capId]; if (c) { c.fac = Math.max(1, c.fac); c.bar = Math.max(1, c.bar); c.garrison = 2; } }
    return nodes;
}
function storyBuildCities() {
    if (typeof GEO !== 'undefined' && typeof GEO_CITIES !== 'undefined') return storyBuildCitiesGeo();
    const C = (typeof STORY_TERRAIN !== 'undefined' && STORY_TERRAIN.cities) || [];
    if (!C.length) return storyBuildEurope();     // güvenlik: şehir verisi yoksa eski ülke sistemi
    const nodes = C.map((p, id) => ({
        id, name: storyCityName(id), lx: p[0], ly: p[1], owner: 0, mapId: id % MAPS_LEN(),
        neighbors: [], cities: 1, oil: 0, pts: 0, level: 1, garrison: 0,  // FAZ-2 Adım 6: seviye(1-3)+garnizon
        fac: 0, bar: 0, pool: {}, q: [],  // FAZ-3: fabrika/kışla seviyesi + ordu havuzu + üretim kuyruğu
        pop: null, wealth: 0              // ORGANİK BÜYÜME: nüfus(bin)/zenginlik — ilk büyüme tikinde tohumlanır
    }));
    const K = 3;   // KOMŞULUK: K en-yakın şehir (simetrik)
    for (const a of nodes) {
        const others = nodes.filter(b => b !== a).sort((x, y) => storyDist2(a, x) - storyDist2(a, y));
        for (let k = 0; k < K && k < others.length; k++) {
            const b = others[k];
            if (a.neighbors.indexOf(b.id) < 0) a.neighbors.push(b.id);
            if (b.neighbors.indexOf(a.id) < 0) b.neighbors.push(a.id);
        }
    }
    storyConnectComponents(nodes);
    // YATAKLAR: 🟠petrol / 🟢puan en yakın şehre (her şehir zaten 👥insan kaynağı: cities=1)
    const assignDep = (arr, key) => { for (const p of (arr || [])) { let bi = -1, bd = Infinity; for (const n of nodes) { const d = storyDist2({ lx: p[0], ly: p[1] }, n); if (d < bd) { bd = d; bi = n.id; } } if (bi >= 0) nodes[bi][key]++; } };
    if (typeof STORY_TERRAIN !== 'undefined') { assignDep(STORY_TERRAIN.oil, 'oil'); assignDep(STORY_TERRAIN.pts, 'pts'); }
    // 8 BAŞKENT + BFS sahiplik: her şehir graf-en-yakın başkentin devletine
    const caps = storyPickCapitals(nodes, STORY_STATE_DEFS.length);
    const dists = caps.map(ci => storyBfsDist(nodes, ci));
    for (const n of nodes) {
        let best = 0, bd = Infinity;
        for (let i = 0; i < caps.length; i++) if (dists[i][n.id] < bd) { bd = dists[i][n.id]; best = i; }
        n.owner = best;
    }
    STORY._capitals = caps;   // state index → başkent şehir id
    // ŞEHİR ADLARI: sahiplik belirlendikten sonra her şehir sahibinin kültüründen ad alır
    for (const n of nodes) storyCityRename(n);
    // FAZ-3 BAŞLANGIÇ ALTYAPISI: her devlet başkentinde hazır bir üretim çekirdeği bulur
    // (fabrika Sv.1 + kışla Sv.1 + garnizon 2). Sıfır altyapıyla başlamak oyuncuyu ilk
    // savaşlarda "acil seferberlik" yedeğine mahkûm ediyordu — üretim sistemi hiç devreye
    // girmiyordu. Diğer şehirler boş başlar; onları komutanlar geliştirir.
    for (const capId of caps) {
        const c = nodes[capId];
        if (!c) continue;
        c.fac = 1; c.bar = 1; c.garrison = 2;
    }
    return nodes;
}
// ── FAZ-2 HÜKÜMET/KONSEY: her devlette yönetici + bağımsız komutan-bireyler (bakanlar sonra) ──
const STORY_CMD_NAMES = ['Demir', 'Kaya', 'Aslan', 'Yıldırım', 'Bozkurt', 'Tunç', 'Çelik', 'Korkut', 'Alp', 'Barış', 'Ergin', 'Doğan', 'Şahin', 'Kartal', 'Volkan', 'Mert', 'Toprak', 'Bora', 'Kaan', 'Atilla'];
const STORY_CMD_TITLES = ['Paşa', 'Komutan'];   // MODERN: Bey/Ağa düştü; 'Paşa' çağdaş orduda hâlâ yaşar
const STORY_CMD_PERSONA = ['dengeli', 'agresif', 'savunmacı', 'fırsatçı'];
let _storyCmdNextId = 1;
function storyCommanderName() { return STORY_CMD_NAMES[Math.floor(Math.random() * STORY_CMD_NAMES.length)] + ' ' + STORY_CMD_TITLES[Math.floor(Math.random() * STORY_CMD_TITLES.length)]; }
function storyPickPersonality() { return STORY_CMD_PERSONA[Math.floor(Math.random() * STORY_CMD_PERSONA.length)]; }
function storyRollSkill() { return Math.floor(Math.random() * 7); }   // 0..6
// bir devlete yeni KOMUTAN-BİREY yarat (şehirde). 3 YETENEK: savaşçı/diplomat/ekonomist (0-6). Bağımsız akıl (mekanik sonra).
function storyCreateCommander(stateId, node) {
    const st = storyState(stateId); if (!st || !st.gov) return null;
    const cap = (STORY._capitals && STORY._capitals[stateId]);
    const cmd = {
        id: _storyCmdNextId++, name: storyCommanderName(), isPlayer: false,
        personality: storyPickPersonality(), loyalty: 55 + Math.floor(Math.random() * 40),
        skills: { warrior: storyRollSkill(), diplomat: storyRollSkill(), economist: storyRollSkill() },
        res: { oil: 200, manpower: 200, points: 200 },   // FAZ-2: komutanın KENDİ kasası (gelir payı birikir, savaşta bununla diziler)
        recentBattles: [],                               // FAZ-2 Adım 5: son ≤3 savaş (1=galip/0=mağlup) — sadakat formülü
        army: {},                                        // FAZ-5: SEFER ORDUSU — komutanla birlikte gezer
        st: stateId,                                     // FAZ-8: bağlı olduğu devlet (ordu tavanı için hızlı erişim)
        node: (node != null ? node : (cap != null ? cap : 0))
    };
    // KİŞİLİK MOTORU (AŞAMA 1): her komutan 4 ideolojik eksen taşır — oylar,
    // sadakat sürtünmesi ve bağ sürüklenmesi bunlardan beslenir.
    cmd.axes = (typeof charAxesFor === 'function') ? charAxesFor(cmd.personality) : null;
    const _tb = st._techBonus;                            // TEKNOLOJİ/KANUN (Subay Okulu, Liyakat): +1 yetenek — HER devlet için
    if (_tb && _tb.officer && cmd.skills) {
        const o = _tb.officer;
        cmd.skills.warrior = Math.min(6, cmd.skills.warrior + o);
        cmd.skills.diplomat = Math.min(6, cmd.skills.diplomat + o);
        cmd.skills.economist = Math.min(6, cmd.skills.economist + o);
    }
    st.gov.commanders.push(cmd);
    return cmd;
}
// KONSEY ATAMASI: konseyin seçtiği aday tipine göre yetenek eğilimli komutan (Council.js kullanır)
function storyCreateCommanderFor(stateId, bias) {
    const cap = (STORY._capitals && STORY._capitals[stateId]);
    const cmd = storyCreateCommander(stateId, cap);
    if (cmd && cmd.skills && cmd.skills[bias] != null) {
        cmd.skills[bias] = Math.min(6, Math.max(4, cmd.skills[bias] + 2));   // aday vaadi: seçilen alanda güçlü
        cmd.loyalty = Math.min(100, (cmd.loyalty || 60) + 10);               // konseyin atadığı → daha sadık başlar
    }
    return cmd;
}
// her devlete hükümet + 10 KOMUTAN (oyuncu devleti: 9 + oyuncu = 10), kendi şehirlerine dağılmış
function storyInitGovernments() {
    _storyCmdNextId = 1;
    for (const st of STORY.states) {
        st.gov = { leader: 'ai', commanders: [] };       // başta AI cumhurbaşkanı yönetir
        const cityIds = STORY.nodes.filter(n => n.owner === st.id).map(n => n.id);
        const pick = () => cityIds.length ? cityIds[Math.floor(Math.random() * cityIds.length)] : ((STORY._capitals && STORY._capitals[st.id]) || 0);
        const count = st.isPlayer ? 9 : 10;              // oyuncu devleti: +STORY.commander = 10
        for (let i = 0; i < count; i++) storyCreateCommander(st.id, pick());
    }
}
// bir devletin TÜM komutanları (oyuncu devletinde kontrol-jetonu da dahil)
function storyStateCommanders(st) {
    const extra = (st && st.gov && st.gov.commanders) ? st.gov.commanders : [];
    return (st && st.isPlayer) ? [STORY.commander, ...extra] : extra;
}
// oyuncunun TÜM komutanları (UI/yönetim için)
function storyPlayerCommanders() { return storyStateCommanders(storyPlayerState()); }
// bir devletin ORTALAMA komutan kasası (AI bütçesi: tek komutana denk güç, adil)
function storyAvgCommanderRes(st) {
    const cmds = storyStateCommanders(st), k = Math.max(1, cmds.length);
    const s = cmds.reduce((a, c) => { const r = c.res || { oil: 0, manpower: 0, points: 0 }; a.oil += r.oil; a.manpower += r.manpower; a.points += r.points; return a; }, { oil: 0, manpower: 0, points: 0 });
    return { oil: s.oil / k, manpower: s.manpower / k, points: s.points / k };
}

// FAZ-2 Adım 5+: bir ŞEHİRDE YIĞILI komutanlar (aynı devlet) — tek arenada birleşik ordu
function storyForceAt(stateId, nodeId) {
    const st = storyState(stateId); if (!st || nodeId == null) return [];
    return storyStateCommanders(st).filter(c => c.node === nodeId);
}
// savaş kuvveti: şehirde VEYA BİTİŞİĞİNDE olan komutanlar (yanına gitmek = orduya katılmak → birleşik düello)
function storyForceNear(stateId, nodeId) {
    const st = storyState(stateId), node = storyNode(nodeId);
    if (!st || !node) return [];
    return storyStateCommanders(st).filter(c => c.node === nodeId || node.neighbors.indexOf(c.node) >= 0);
}
function storySumRes(cmds) {
    return cmds.reduce((a, c) => { const r = c.res || { oil: 0, manpower: 0, points: 0 }; a.oil += r.oil; a.manpower += r.manpower; a.points += r.points; return a; }, { oil: 0, manpower: 0, points: 0 });
}

function storyNewCampaign(config = {}) {
    const requestedState = Number.isInteger(config.playerStateId) ? config.playerStateId : (STORY.playerStateId | 0);
    const playerStateId = Math.max(0, Math.min(STORY_STATE_DEFS.length - 1, requestedState));
    const abundance = Math.max(0.5, Math.min(1.5, Number.isFinite(+config.abundance) ? +config.abundance : (STORY.cfg.abundance || 1)));
    STORY.nodes = storyBuildCities();             // 82 ŞEHİR hareket ağı (önceki 36 ülke yerine)
    storyBuildLandGrid();                         // pixel kara-maske (şehir Voronoi politik katmanı)
    STORY.states = STORY_STATE_DEFS.map((def, id) => ({
        id, name: def.name, color: def.color, isPlayer: id === playerStateId,
        res: { oil: Math.round(600 * abundance), manpower: Math.round(600 * abundance), points: Math.round(600 * abundance) },
        tech: [], _techBonus: null, techPoints: 0,      // FAZ-2 Adım 4: HER devletin teknolojisi (AI dahil)
        laws: {}, constitution: 'monarchy',            // FAZ-4: konseyin çıkardığı kanunlar + anayasa (HER devlet)
        welfare: 50, reputation: 0, isAdmin: false,
        gov: { leader: 'ai', commanders: [] }          // FAZ-2 hükümet (storyInitGovernments doldurur)
    }));
    STORY.playerStateId = playerStateId;
    // OYUNCUNUN KOMUTANI = kontrol-jetonu (bağımsız bir komutan-birey)
    STORY.commander = { id: 0, name: 'Komutan (Sen)', isPlayer: true, personality: 'oyuncu', loyalty: 100, skills: { warrior: 4, diplomat: 3, economist: 3 }, res: { oil: Math.round(200 * abundance), manpower: Math.round(200 * abundance), points: Math.round(200 * abundance) }, node: (STORY._capitals && STORY._capitals[playerStateId]) || 0, xp: 0, score: 0, victories: 0, rank: 1, activePerks: [], rewardMods: {}, army: {}, st: playerStateId };
    storyInitGovernments();                            // her devlete AI komutan + hükümet iskeleti
    // AŞAMA 1: her devlete İSİMLİ cumhurbaşkanı ("AI Cumhurbaşkanı" etiketi öldü) +
    // oyuncunun karakter ekranı çıktısı (isim, zar, eksenler, tohumlar) uygulanır.
    if (typeof storyEnsurePresidents === 'function') storyEnsurePresidents();
    if (typeof charApply === 'function' && config.character) charApply(config.character);
    // AŞAMA 2: fraksiyonlar lider profilinden doğar (oyuncu devletinde karakter %20 karışır)
    if (typeof storyFacInitAll === 'function') storyFacInitAll();
    if (!STORY.commander.axes && typeof charAxesDefault === 'function') STORY.commander.axes = charAxesDefault();
    STORY.veterans = [];
    // OYUNCU tech'i = kendi devletinin tech dizisi (AYNI dizi nesnesi) → storyTechPowerMul/konsey
    // oyuncu devletinde de doğru çalışır; iki ayrı liste tutmanın yol açtığı sapma biter.
    STORY.tech = STORY.states[playerStateId].tech;
    STORY._techBonus = null;
    STORY._nextCouncil = (typeof COUNCIL_PERIOD_YEARS !== 'undefined') ? COUNCIL_PERIOD_YEARS * YEAR_SECONDS : 240;   // FAZ-4: ilk konsey 2. yılda
    STORY._councilNo = 0;
    STORY._session = null;
    STORY.rel = {};                                     // FAZ-6: diplomasi ilişki/antlaşma tablosu
    STORY._era = null; STORY._eraEvents = []; STORY._eraFlips = []; STORY._accEra = 0;   // FAZ-10 dünya çağı
    STORY._lastUrgent = null;
    STORY._talks = []; STORY._accTalk = 0; STORY._talkUid = 0;
    STORY.cfg = {
        abundance,
        doctrine: config.doctrine || STORY.cfg.doctrine || 'combined',
        fog: config.fog !== false
    };
    STORY.paused = false;
    STORY._gameOver = false;   // ADIM 6: yenilgi bayrağı sıfırla
    STORY.clock = 0;
    STORY.log = [];
    STORY.battleCtx = null;
    STORY.pendingReward = null;
    STORY.selectedNodeId = STORY.commander.node;
    STORY.active = true;
    storyLog(`${storyPlayerState().name} harekâtı başladı. Komşu düşman şehirlere saldırarak genişle.`);
    storySave();
}

function MAPS_LEN() { return (typeof MAPS !== 'undefined' && MAPS.length) ? MAPS.length : 10; }

// ── KALICILIK (localStorage, bağışlayıcı) ────────────────────────────────────
function storySave() {
    try {
        const data = {
            v: 2, states: STORY.states, nodes: STORY.nodes, playerStateId: STORY.playerStateId,
            commander: STORY.commander, veterans: STORY.veterans, tech: STORY.tech, cfg: STORY.cfg, pendingReward: STORY.pendingReward,
            clock: STORY.clock, log: STORY.log,
            caps: STORY._capitals,  // başkentler: kaydedilmezse yüklemede undefined kalıp AI başkent-hedeflemesi sessizce bozuluyordu
            nextCouncil: STORY._nextCouncil, councilNo: STORY._councilNo,  // FAZ-4: konsey takvimi (kanun/anayasa states içinde)
            era: STORY._era, eraEvents: STORY._eraEvents, eraFlips: STORY._eraFlips,   // FAZ-10 dünya çağı
            lastUrgent: STORY._lastUrgent,
            news: STORY._news,   // AŞAMA 4: gazete arşivi
            rel: STORY.rel   // FAZ-6: diplomasi (ilişki + antlaşma). Sohbet kuyruğu KAYDEDİLMEZ:
                             // seçenekler canlı fonksiyon taşır, serileşemez — yükleyince yenileri üretilir.
        };
        localStorage.setItem(STORY_SAVE_KEY, JSON.stringify(data));
        STORY._lastSaveOk = true;
    } catch (_) { STORY._lastSaveOk = false; }
}
function storyLoad() {
    try {
        const raw = localStorage.getItem(STORY_SAVE_KEY);
        if (!raw) return false;
        const d = JSON.parse(raw);
        if (!d || !d.nodes || !d.states) return false;
        STORY.states = d.states; STORY.nodes = d.nodes;
        STORY._geoMap = !!(STORY.nodes[0] && STORY.nodes[0].geo);   // gerçek-Avrupa kaydı mı?
        storyBuildLandGrid();                     // kayıttan pixel kara-maskeyi yeniden üret
        storyAssignDeposits();
        // MODERN GEÇİŞ backfill: eski kayıtlarda 'Şehir N' ve eski devlet adları var.
        // Devlet adı statik çeşnidir (kullanıcı verisi değil) → tanımdan tazelenir.
        for (const st of STORY.states) if (STORY_STATE_DEFS[st.id]) st.name = STORY_STATE_DEFS[st.id].name;
        for (const n of STORY.nodes) storyCityRename(n);                    // şehir/kaynak işaretlerini ülkelere ata (ekonomi)
        STORY.playerStateId = d.playerStateId | 0;
        // Başkentler: eski kayıtlarda yok → yeniden üret (yoksa capitalSeek ve komutan konumlanması bozulur)
        STORY._capitals = (Array.isArray(d.caps) && d.caps.length) ? d.caps : storyPickCapitals(STORY.nodes, STORY.states.length);
        STORY.commander = d.commander || { node: 0 };
        storyCommanderBackfill(STORY.commander);
        if (typeof cmdrMigrate === 'function') cmdrMigrate(STORY.commander);   // FAZ-7: eski 3-slot perk → ağaç düğümü
        STORY.commander.st = STORY.playerStateId;   // FAZ-8: ordu tavanı için devlet bağı
        // FAZ-2: hükümet backfill (eksik kayıt güvenliği) + komutan-id sayacını ilerlet
        let _mx = (STORY.commander && STORY.commander.id) || 0;
        if (STORY.commander && !STORY.commander.res) STORY.commander.res = { oil: 200, manpower: 200, points: 200 };
        for (const st of STORY.states) {
            if (!st.gov) st.gov = { leader: (st.isPlayer && st.isAdmin) ? 'player' : 'ai', commanders: [] };
            st._nextStaff = 0;   // 1.3: genelkurmay hemen yeniden-planlasın
            for (const c of (st.gov.commanders || [])) { c.st = st.id; if ((c.id || 0) > _mx) _mx = c.id; if (!c.res) c.res = { oil: 200, manpower: 200, points: 200 }; if (!c.recentBattles) c.recentBattles = []; if (!c.army || typeof c.army !== 'object') c.army = {}; if (!c.axes && typeof charAxesFor === 'function') c.axes = charAxesFor(c.personality); delete c._nextT; delete c._lastDefect; delete c._objective; }   // FAZ-2 Adım 5/6: transient temizlik (+1.3 emir)
        }
        _storyCmdNextId = _mx + 1;
        // AŞAMA 1 göçü: eski kayıtlarda eksen/cumhurbaşkanı yok → üret
        if (typeof storyEnsurePresidents === 'function') storyEnsurePresidents();
        if (STORY.commander && !STORY.commander.axes && typeof charAxesDefault === 'function') STORY.commander.axes = charAxesDefault();
        if (typeof storyFacBackfill === 'function') for (const st of STORY.states) storyFacBackfill(st);   // AŞAMA 2 göçü
        STORY._news = Array.isArray(d.news) ? d.news : [];   // AŞAMA 4: gazete arşivi
        STORY._lastPlayerInvasion = 0; STORY._accCmdAI = 0; STORY._accLoyalty = 0; STORY._accSocial = 0;   // komutan-AI sayaçları sıfırla
        // FAZ-2 Adım 4 + FAZ-4: devlet tech/kanun/anayasa backfill + bonus (eski kayıtlar konsey öncesinden gelir)
        for (const st of STORY.states) {
            if (!st.tech) st.tech = []; if (st.techPoints == null) st.techPoints = 0;
            if (!st.laws) st.laws = {}; if (!st.constitution) st.constitution = 'monarchy';
            storyStateComputeTech(st);
        }
        for (const n of STORY.nodes) storyNodeBackfill(n);   // kuşatma temizliği + seviye/garnizon/bina/kuyruk backfill (Production.js)
        // FAZ-8 GÖÇÜ: şehir deposu kaldırıldı. Eski kayıtta depoda bekleyen birlikler
        // o şehirdeki dost komutanın ordusuna, yer yoksa garnizona aktarılır — kaybolmaz.
        for (const n of STORY.nodes) {
            if (!n.pool || n.owner == null) continue;
            const st = storyState(n.owner);
            for (const k in n.pool) {
                let c = n.pool[k] | 0;
                while (c > 0) {
                    let taker = null;
                    if (st) for (const cm of storyStateCommanders(st)) {
                        if (cm.node === n.id && cmdArmyCount(cm) < cmdArmyCap(cm)) { taker = cm; break; }
                    }
                    if (taker) { if (!taker.army) taker.army = {}; taker.army[k] = (taker.army[k] | 0) + 1; }
                    else if ((n.garrison | 0) < storyCityGarrisonCap(n)) n.garrison = (n.garrison | 0) + 1;
                    else break;   // ne ordu ne garnizon yer var
                    c--;
                }
            }
            n.pool = {};
        }
        // ESKİ KAYIT ALTYAPI TELAFİSİ: üretim sisteminden önceki kayıtlarda hiçbir şehirde bina yok.
        // Bu hâlde havuz hep boş kalır, her savaş "acil seferberlik"e düşer ve oyuncu üretim
        // sistemini HİÇ göremez. Dünyada tek bir bina bile yoksa kayıt eskidir → başkentlere
        // yeni kampanyayla aynı çekirdeği ver (fabrika 1 + kışla 1), garnizonu en az 2'ye çek.
        if (!STORY.nodes.some(n => (n.fac | 0) || (n.bar | 0))) {
            for (const capId of (STORY._capitals || [])) {
                const c = storyNode(capId);
                if (!c) continue;
                c.fac = 1; c.bar = 1; c.garrison = Math.max(2, c.garrison || 0);
            }
        }
        STORY.veterans = d.veterans || [];
        STORY.pendingReward = d.pendingReward || null;
        // OYUNCU tech'i, devletinin tech dizisiyle AYNI nesne olmalı. Eski kayıtlarda oyuncu
        // tech'i yalnız d.tech'te duruyor, devletin dizisi boştu → önce birleştir, sonra referansla.
        const _pst = storyPlayerState();
        if (_pst) {
            if (!Array.isArray(_pst.tech)) _pst.tech = [];
            for (const id of (d.tech || [])) if (_pst.tech.indexOf(id) < 0) _pst.tech.push(id);
            STORY.tech = _pst.tech;
        } else STORY.tech = d.tech || [];
        storyComputeTechBonus();
        STORY.cfg = Object.assign({ abundance: 1.0, doctrine: 'combined', fog: true }, d.cfg || {});
        STORY.clock = d.clock || 0;
        // FAZ-4 konsey takvimi: eski kayıtta yoksa "bir sonraki 2-yıl sınırı"na hizala
        const _per = (typeof COUNCIL_PERIOD_YEARS !== 'undefined') ? COUNCIL_PERIOD_YEARS * YEAR_SECONDS : 240;
        STORY._nextCouncil = (d.nextCouncil != null) ? d.nextCouncil : (Math.floor(STORY.clock / _per) + 1) * _per;
        STORY._councilNo = d.councilNo || 0;
        STORY._session = null;
        STORY.rel = (d.rel && typeof d.rel === 'object') ? d.rel : {};   // FAZ-6 diplomasi
        STORY._era = d.era || null; STORY._eraEvents = d.eraEvents || []; STORY._eraFlips = d.eraFlips || [];   // FAZ-10
        STORY._lastUrgent = d.lastUrgent == null ? null : d.lastUrgent;
        STORY._talks = []; STORY._accTalk = 0;
        STORY.log = d.log || [];
        STORY.paused = false; STORY.battleCtx = null; STORY.selectedNodeId = STORY.commander.node; STORY.active = true;
        return true;
    } catch (_) { return false; }
}

// ── AÇ / GİRİŞ ───────────────────────────────────────────────────────────────
function storyOpen() {
    if (!STORY.active) {
        if (storyHasSave() && confirm('Kayıtlı kampanya bulundu.\n\nTamam = Devam Et   |   İptal = Yeni Kampanya')) {
            if (!storyLoad()) storyNewCampaign();
        } else {
            storyNewCampaign();
        }
    }
    storyEnterWorld();
}

function storyEnterWorld() {
    if (STORY.selectedNodeId == null || !storyNode(STORY.selectedNodeId)) STORY.selectedNodeId = STORY.commander.node;
    showScreen('story');
    storyResize();
    storyCenterCamOnPlayer();
    storyRender();
}

function storyContinue() {
    if (!STORY.active && !storyLoad()) {
        showScreen('story-setup');
        if (typeof warRoomSetupOpen === 'function') warRoomSetupOpen();
        return false;
    }
    storyEnterWorld();
    return true;
}

// ── KOMUTAN HAREKETİ + SALDIRI ───────────────────────────────────────────────
function storyAreAdjacent(aId, bId) {
    const a = storyNode(aId); return !!(a && a.neighbors.indexOf(bId) >= 0);
}
function storySelectNode(id) {
    if (!storyNode(id)) return;
    STORY.selectedNodeId = id;
    if (STORY._cityOpen && typeof storyCityUpdate === 'function') storyCityUpdate();   // ŞEHRE GİR açıksa panel yeni şehre döner
    storyRender();
}
function storyNodeClicked(id) {
    if (STORY.battleCtx) return;
    const cmdNode = STORY.commander.node;
    if (id === cmdNode) return;
    if (!storyAreAdjacent(cmdNode, id)) { storyFlash('Sadece komşu bölgeye gidebilir/saldırabilirsin.'); return; }
    const node = storyNode(id);
    if (node.owner === STORY.playerStateId) {
        STORY.commander.node = id;                 // kendi bölgene ilerle; komutanlar BAĞIMSIZ — sana yapışmaz
        if (node._siege && storyState(node._siege.by)) {   // KUŞATILAN şehrine geldin → HEMEN savunma düellosu (bekleme/bensiz-bitiş yok)
            const enemyId = node._siege.by, bs = storyState(enemyId);
            const lead = (bs && bs.gov) ? bs.gov.commanders.find(c => c.node === id || node.neighbors.indexOf(c.node) >= 0) : null;
            node._siege = null;
            storyLaunchDefense(id, enemyId, lead ? lead.node : id);
            return;
        }
        storySave(); storyRender();
    } else {
        const def = storyState(node.owner);
        if (confirm(`⚔️ ${node.name} (${def.name}) bölgesine SALDIR?\n\nHaritada düello başlayacak. Sağ kalan birlikler gazi olur.`)) {
            storyLaunchBattle(id);
        }
    }
}
function storyFlash(msg) { storyLog('⚠️ ' + msg); storyPanelUpdate(); }

// ── DÜELLO KÖPRÜSÜ: dünya → düello motoru (FAZ-2 KAYNAK-BAZLI) ────────────────
// kaynak-bazlı per-pool bütçe (oyuncu): stok → o kaynağın deploy bütçesi (350..2100; ~30 piyade = tam-gelişmiş insan-gücü)
function storyResBudget(stock) { return Math.max(350, Math.min(2100, Math.round(250 + (stock || 0) * 0.5))); }
// oyuncu KENDİ KOMUTANININ KASASIYLA deploy eder (devletin tüm hazinesiyle DEĞİL!) — kaynak-kilitli
function storySetPlayerDeployRes() {
    // SEN sadece KENDİ jetonunun bütçesini dizip yönetirsin; MÜTTEFİK komutanlar KENDİ ordularını dizip OTONOM (dost-AI) savaşır
    const r = (STORY.commander && STORY.commander.res) || { oil: 0, manpower: 0, points: 0 };
    DEPLOY_RES = { blue: { oil: storyResBudget(r.oil), manpower: storyResBudget(r.manpower), points: storyResBudget(r.points) } };
    const active = STORY.commander.activePerks || [];
    // (FAZ-7) 'logistics'/'mobilization' ARTIK BURADA DEĞİL: havuz sistemine geçince
    // DEPLOY_RES.blue null'lanıyordu ve bu iki satır hiç işlemiyordu — ölü koddu.
    // Yetenekler gelişim ağacında üretim hızı / gelir payı olarak yeniden yorumlandı.
    const cityId = STORY.battleCtx ? STORY.battleCtx.nodeId : (STORY.commander && STORY.commander.node);
    STORY._battleAllyList = storyForceNear(STORY.playerStateId, cityId).filter(c => c !== STORY.commander);   // savaş şehri/yanındaki dost komutanlar → otonom dizilir
}
// düşman bütçesi = stage'deki YIĞILI komutanlar birleşir (yoksa ortalama); birleşik tek-para
// DÜŞMAN bütçesi = SİMETRİK (oyuncuyla AYNI ekonomi): stage'deki düşman komutanların KENDİ kasaları toplanır.
// Kapak/rubber-band YOK — güçlü/teknolojili/yığılı devlet GERÇEKTEN güçlü (boş şehir = floor, zayıf).
// SAVUNMA bütçesi → TİPLİ {oil,manpower,points} (AI da oyuncu gibi tipli havuzdan dizer; anti-tank=puan SINIRLI).
// Şehirdeki komutan tam, bitişikteki yarım. Milis tabanı çoğu PİYADE (insan gücü) → boş şehir anti-tank/topçu YIĞAMAZ.
// FAZ-3: AI bütçesi artık kasadan değil ÜRETTİĞİ ORDUDAN türer — oyuncu havuzdan
// dizerken AI'nın sınırsız kasa-bütçesiyle dizmesi adaletsiz olurdu. Fabrika kurmamış
// devlet tank dizemez (b.oil ≈ 0). aiDeploy ve DEPLOY_RES.red dalı hiç değişmez.
function storyEnemyForceBudget(stateId, cityId) {
    const st = storyState(stateId), node = storyNode(cityId);
    if (!st || !node) return { oil: 40, manpower: 200, points: 40 };
    if (typeof storyPoolBudget === 'function') {
        const r = storyPoolBudget(stateId, cityId, { garrison: true, floor: 170 });
        STORY._redPoolSrc = r.src;   // savaş sonu: AI'nın sağ kalanları havuzuna döner
        return r.budget;
    }
    return { oil: 40, manpower: 170 + (node.garrison || 0) * 50, points: 40 };
}
// SALDIRI bütçesi → TİPLİ; SADECE saldıran komutanların kendi kaynağı (milis/garnizon YOK; "sadece komutanlar saldırır").
// Komutanın puanı yoksa anti-tank diziyemez → "imkânsız sayıda anti-tank" biter.
// SALDIRI bütçesi → saldıran devletin O CEPHEDEKİ havuzu (garnizon/milis YOK: "sadece ordu saldırır")
function storyAttackerForceBudget(stateId, cityId) {
    const st = storyState(stateId), node = storyNode(cityId);
    if (!st || !node) return { oil: 40, manpower: 200, points: 40 };
    if (typeof storyPoolBudget === 'function') {
        // Saldıran kendi topraklarından gelir: havuzu SALDIRANIN cephe şehirlerinden topla
        const stage = (STORY.battleCtx && STORY.battleCtx.enemyStageNode != null) ? STORY.battleCtx.enemyStageNode : cityId;
        const r = storyPoolBudget(stateId, stage, { floor: 120 });
        STORY._redPoolSrc = r.src;
        return r.budget;
    }
    return { oil: 40, manpower: 120, points: 40 };
}
// (intel gösterimi için) ortalama-kasa tahmini bütçe
function storyEnemyBudget(state) {
    const a = storyAvgCommanderRes(state);
    let budget = storyResBudget(a.oil) + storyResBudget(a.manpower) + storyResBudget(a.points);
    if (state && state._techBonus && state._techBonus.allCost) budget = Math.round(budget / (state._techBonus.allCost || 1));
    return budget;
}

// OYUNCU SALDIRISI: komşu düşman bölgeye (oyuncu=mavi/saldıran, düşman=kırmızı/savunan)
function storyLaunchBattle(targetNodeId) {
    const node = storyNode(targetNodeId);
    const attacker = storyPlayerState();
    const defender = storyState(node.owner);
    node._siege = null;                            // oyuncu bizzat saldırıyor → varsa kuşatma çözülür
    STORY.battleCtx = { nodeId: targetNodeId, attacker: attacker.id, defender: defender.id, enemyStateId: defender.id, mode: 'attack' };
    storySetPlayerDeployRes();                    // oyuncu YIĞIN-kaynak (yanındaki dost komutanlar birleşir)
    const _eb = storyEnemyForceBudget(defender.id, targetNodeId);   // TİPLİ: AI da OYUNCU gibi kendi kaynak havuzlarından dizer (anti-tank=puan sınırlı)
    DEPLOY_RES.red = _eb; enemy.money = _eb.oil + _eb.manpower + _eb.points;   // enemy.money = toplam (aiDeploy heuristikleri için)
    storyEnterBattle(node);
}
// DÜŞMAN SALDIRISI (Faz-1.5): oyuncunun bölgesi savunulur (oyuncu=mavi/SAVUNAN, düşman=kırmızı/saldıran)
function storyLaunchDefense(playerNodeId, enemyStateId, enemyStageNode) {
    const node = storyNode(playerNodeId);
    const me = storyPlayerState();
    STORY.battleCtx = { nodeId: playerNodeId, attacker: enemyStateId, defender: me.id, enemyStateId: enemyStateId, enemyStageNode: (enemyStageNode != null ? enemyStageNode : null), mode: 'defense' };
    storySetPlayerDeployRes();                    // savunan oyuncu YIĞIN-kaynak (mavi)
    const _eb = storyAttackerForceBudget(enemyStateId, playerNodeId);   // TİPLİ: saldıran AI kendi kaynak havuzlarından (milis/garnizon yok)
    DEPLOY_RES.red = _eb; enemy.money = _eb.oil + _eb.manpower + _eb.points;
    storyEnterBattle(node);
}
// ORTAK: bölgenin haritasında DEPLOY'a gir (oyuncu hep mavi/güney, gaziler ön-yerleşir)
function storyEnterBattle(node) {
    if (typeof storyCouncilClose === 'function') storyCouncilClose();   // savaş tam-ekran → drawer'ları kapat
    if (typeof storyTechClose === 'function') storyTechClose();
    if (typeof storyArmyClose === 'function') storyArmyClose();
    if (typeof storyCityClose === 'function') storyCityClose();
    const activePerks = STORY.commander.activePerks || [];
    TECH_BONUS = Object.assign({}, STORY._techBonus || {});   // MAVİ = oyuncu devleti tech + komutan perkleri
    if (activePerks.indexOf('steel-wall') >= 0) TECH_BONUS.allArmorAdd = 1;
    if (activePerks.indexOf('ambusher') >= 0) TECH_BONUS.firstFlankMul = 1.15;
    if (activePerks.indexOf('morale') >= 0) TECH_BONUS.panicResistance = 0.25;
    if (STORY.commander.rewardMods?.armoredHpMul) TECH_BONUS.armoredHpMul = STORY.commander.rewardMods.armoredHpMul;
    const _foeId = STORY.battleCtx ? (STORY.battleCtx.enemyStateId != null ? STORY.battleCtx.enemyStateId : (STORY.battleCtx.mode === 'attack' ? STORY.battleCtx.defender : STORY.battleCtx.attacker)) : null;
    const _foe = (_foeId != null) ? storyState(_foeId) : null;
    TECH_BONUS_RED = (_foe && _foe._techBonus) || null;   // KIRMIZI = DÜŞMAN devlet tech (AI birimlerine); savaş sonu temizlenir
    if (typeof applyMap === 'function') applyMap(node.mapId);
    storyResetBattlefield();
    storySetupPlayerPool(node);   // FAZ-3: şehirlerde ÜRETİLEN ordu → DEPLOY_POOL (yetersizse acil seferberlik)
    storySpawnAllies();   // MÜTTEFİK komutanlar KENDİ ordularını dizer → OTONOM dost-AI (sen sadece KENDİ ordunu yönetirsin)
    storySpawnGarrison();  // ADIM 6: savunmada şehir GARNİZONU ek birlik (otonom)
    showScreen('game');
    storyCameraToDeployZone();
}

// FAZ-3: oyuncunun savaşa süreceği ordu = şehir havuzları (savaş şehri + bitişik dost şehirler).
// Havuz kaynak düğümlerden HEMEN düşülür → kayıp kalıcı olur; sağ kalanlar savaş sonu iade edilir.
// KİLİTLENME KORUMASI: ordun TAMAMEN bittiyse sahaya çıkacak bir şey kalmaz ve oyun
// kilitlenir. O yüzden yalnız havuz SIFIRken 2 piyadelik acil milis verilir — savunmayı
// kurtarmaya yetmez, sadece "hiç birlik dizemiyorum" durumunu engeller.
// (Eskiden eşik 4'tü ve eski bütçe sistemi yarı güçle devreye giriyordu; bu, üretim
// yapmayan oyuncunun kaynakla ordu dizmeye devam etmesi anlamına geliyordu.)
const EMERGENCY_MILITIA = 2;
function storySetupPlayerPool(node) {
    DEPLOY_POOL = null;
    STORY._poolSrc = null;
    // KIDEM her iki modda da geçerli: acil seferberlikte de gazilerin savaşa katılmalı.
    // (Eskiden yalnız havuz dalında kuruluyordu; havuz boşken gaziler tamamen kayboluyordu.)
    STORY._battleVets = (STORY.veterans || []).map(v => ({ type: v.type, vet: v.vet }));
    const me = STORY.playerStateId;
    // SEFER ORDUSU: komutanının yanındaki ordu savaşa girer. SAVUNMADA bulunduğun şehrin
    // deposu da katılır (depodaki birlikler zaten oradadır); SALDIRIDA yalnız yanındakiler.
    const defending = !!(STORY.battleCtx && STORY.battleCtx.mode === 'defense');
    const muster = (typeof storyMusterArmy === 'function')
        ? storyMusterArmy(STORY.commander, node, defending, me)
        : { avail: {}, src: [] };
    let total = 0;
    for (const k in muster.avail) total += muster.avail[k] | 0;

    storySetPlayerDeployRes();                           // müttefik listesi (_battleAllyList) için gerekli
    DEPLOY_RES.blue = null;                              // mavi para dalına GİRMEZ — hikâyede daima adet kısıtı

    if (total <= 0) {                                    // ordu TAMAMEN bitti → sadece kilitlenmeyi önle
        DEPLOY_POOL = {};
        DEPLOY_POOL[T.INFANTRY] = EMERGENCY_MILITIA;
        STORY._poolSrc = null;
        storyLog(`⚠️ Ordun yok — ACİL SEFERBERLİK: yalnızca ${EMERGENCY_MILITIA} milis piyade. Şehirlerinde üretim yap!`);
        return;
    }
    DEPLOY_POOL = {};
    for (const k in muster.avail) DEPLOY_POOL[k] = muster.avail[k] | 0;
    STORY._poolSrc = muster.src;
    storyDrainPool(muster.src);                          // havuz şehirlerden çıktı: kayıp artık kalıcı
    storyLog(`⚔️ ${total} birlik sahaya sevk edildi (şehir havuzlarından).`);
}

// SAVAŞ ALANINI DEPLOY'a SIFIRLA (startBattle'ın tersi — reload olmadan yeni maç)
function storyResetBattlefield() {
    units.length = 0;
    if (typeof resetGroundCanvas === 'function') resetGroundCanvas();   // önceki maçın savaş izlerini temizle
    if (typeof resetBattleRules === 'function') resetBattleRules();
    // Hızlı Maç'ta seçilen AI zorluğu kampanyaya sızmasın: sefer daima dengeli komutanla oynanır.
    if (typeof commanderSetDifficulty === 'function') commanderSetDifficulty('normal');
    player.kills = 0; player.unitsSpawned = 0;
    enemy.kills = 0; enemy.unitsSpawned = 0;
    phase = PHASE.DEPLOY;
    document.body.setAttribute('data-phase', PHASE.DEPLOY);
    if (typeof selectedSpawnType !== 'undefined') selectedSpawnType = null;
    if (typeof deployCarried !== 'undefined') deployCarried = null;   // elde taşınan birlik ölü referans kalmasın
    // UI'yı yerleştirme durumuna geri al
    document.getElementById('game-over-screen')?.classList.add('hidden');
    document.getElementById('start-btn')?.classList.remove('hidden');
    document.getElementById('mp-ready-btn')?.classList.add('hidden');
    const sbar = document.getElementById('ui-spawn-bar');
    if (sbar) { sbar.style.opacity = '1'; sbar.style.pointerEvents = 'auto'; }
    document.getElementById('ui-support')?.classList.add('hidden');
    const pt = document.getElementById('phase-text');
    if (pt) { pt.textContent = '⚔️ ORDUNU YERLEŞTİR (şehir havuzundan)'; pt.style.color = ''; }
    const uiPhase = document.getElementById('ui-phase'); if (uiPhase) uiPhase.style.display = '';
    const camHint = document.getElementById('ui-camera-hint'); if (camHint) camHint.style.display = '';
    // FAZ-2: deploy HUD'unda 3 kaynak DEPLOY BÜTÇESİNİ göster (sol üst) — değerleri updateUI canlı doldurur
    ['res-oil', 'res-manpower', 'res-points'].forEach(id => document.getElementById(id)?.classList.remove('hidden'));
}

// GAZİLER (FAZ-3): artık bedava ayrı ordu DEĞİL — kıdem havuzdan dizilen birime yapışır.
// Bkz. storyTagVeteran (Production.js): STORY.veterans listesi kalite katmanı olarak kullanılır.
// MÜTTEFİK komutanlar — OTONOM dost-AI (mavi ama oyuncu komut veremez; kendi savaşır).
// FAZ-3: kasalarından BEDAVA ordu dizmeleri kaldırıldı. Eskiden her müttefik komutan
// ~1050 tek-para bütçeyle 40 birime kadar diziyordu; savaş şehri + komşularındaki 3 komutan
// oyunun ilk dakikasında ~30 bedava birim demekti. Artık aynı şehir havuzundan pay alırlar:
// üretilmemiş hiçbir birlik sahaya çıkmaz, müttefik desteği de gerçek bir maliyete dayanır.
const ALLY_POOL_SHARE = 0.30;   // havuzun bu oranı otonom müttefiklere, kalanı oyuncunun elinde
function storySpawnAllies() {
    const allies = (STORY._battleAllyList || []).filter(Boolean);
    if (!allies.length || typeof T === 'undefined' || typeof Unit === 'undefined') return;
    if (!DEPLOY_POOL) return;   // acil seferberlik (havuz yok) → müttefik de dizmez, simetrik

    // Havuzdan müttefik payını AYIR (oyuncunun dizebileceği adetten düşülür)
    let quota = 0;
    for (const k in DEPLOY_POOL) quota += DEPLOY_POOL[k] | 0;
    quota = Math.min(Math.floor(quota * ALLY_POOL_SHARE), allies.length * 6);
    if (quota < 1) return;

    // UCUZDAN pahalıya pay al: ana vurucu güç (tank/topçu) OYUNCUDA kalsın, müttefik
    // destek/kitle birlikleriyle savaşsın. Tersi denendi ve müttefikler tüm tankları alıp
    // oyuncuyu ana kuvvetinden ediyordu — kendi ordunu yönetememek kötü bir his.
    const types = Object.keys(DEPLOY_POOL)
        .filter(k => (DEPLOY_POOL[k] | 0) > 0)
        .sort((a, b) => ((STATS[+a] && STATS[+a].cost) || 0) - ((STATS[+b] && STATS[+b].cost) || 0));
    let placed = 0;
    for (const k of types) {
        const type = +k;
        while ((DEPLOY_POOL[k] | 0) > 0 && placed < quota) {
            DEPLOY_POOL[k]--;
            const x = 140 + (placed % 14) * 50, y = (WORLD_H - 380) - Math.floor(placed / 14) * 54;
            const u = new Unit(type, x, y, false);
            u.ally = true;                                  // OTONOM dost-AI işareti
            if (typeof getSquadRole === 'function') u.squad = getSquadRole(type);
            if (typeof applyTechSpawnBonus === 'function') applyTechSpawnBonus(u);
            units.push(u); player.unitsSpawned++; placed++;
        }
        if (placed >= quota) break;
    }
    if (placed) storyLog(`🤝 ${allies.length} müttefik komutan ordunun ${placed} birliğini devraldı (otonom savaşır).`);
}
function storyCameraToDeployZone() {
    try {
        if (typeof camera === 'undefined') return;
        camera.x = WORLD_W / 2 - (canvas.width / zoom) / 2;
        camera.y = WORLD_H - (canvas.height / zoom) - 40;
        if (typeof clampCamera === 'function') clampCamera();
    } catch (_) {}
}

// ── DÜELLO BİTTİ: sonucu dünyaya işle (main.js checkGameOver çağırır) ─────────
//  won: MAVİ-perspektifli (true = oyuncu kazandı, false = AI, 'draw' = berabere)
function storyOnBattleEnd(won, telemetrySummary) {
    const ctx = STORY.battleCtx;
    if (!ctx) return;
    const node = storyNode(ctx.nodeId);
    const me = storyPlayerState();
    const foe = storyState(ctx.defender) || { id: ctx.defender, name: '?', welfare: 50, gov: null };   // güvenlik: devlet erimiş olsa bile çökme

    // SAĞ KALANLAR → GAZİ (tip + seviye taşınır, cap 14)
    const survivors = units.filter(u => !u.isRed && !u.dead && !u.ally);   // müttefik (otonom) birimler senin gazin olmaz
    const newVets = survivors.map(u => ({ type: u.type, vet: Math.max(1, (u.veteran | 0)) + 1 }));
    newVets.sort((a, b) => b.vet - a.vet);
    STORY.veterans = newVets.slice(0, 14);

    // FAZ-3 HAVUZ İADESİ: sahaya sürülmeyenler + sağ kalanlar havuza döner; ÖLENLER kalıcı gider.
    // (Havuz savaş başında kaynak şehirlerden düşülmüştü — kayıp muhasebesi böyle kapanır.)
    if (DEPLOY_POOL && typeof storyReturnPool === 'function') {
        const back = {};
        for (const k in DEPLOY_POOL) { const c = DEPLOY_POOL[k] | 0; if (c > 0) back[k] = (back[k] | 0) + c; }
        // Müttefik birlikler de havuzdan pay almıştı → sağ kalanları havuza döner (gazi olmazlar ama ordu senindir)
        for (const u of units) if (!u.isRed && !u.dead) back[u.type] = (back[u.type] | 0) + 1;
        const kept = storyReturnPool(back, node, me.id, STORY._poolSrc);
        const lost = units.filter(u => !u.isRed && u.dead).length;
        if (kept || lost) storyLog(`⚔️ Ordu dönüşü: ${kept} birlik havuza döndü, ${lost} birlik kayboldu.`);
    }
    // AI TARAFI SİMETRİK: kırmızının sağ kalanları kendi havuzuna döner, ölenler kalıcı gider.
    // Böylece kazandığın savaş düşmanın ordusunu GERÇEKTEN eritir (sadece -30 insan gücü değil).
    if (STORY._redPoolSrc && typeof storyReturnPool === 'function') {
        const foeId = (ctx.mode === 'defense') ? ctx.attacker : ctx.defender;
        const redBack = {};
        for (const u of units) if (u.isRed && !u.dead) redBack[u.type] = (redBack[u.type] | 0) + 1;
        storyReturnPool(redBack, null, foeId, STORY._redPoolSrc);
        STORY._redPoolSrc = null;
    }

    const winText = (won === true);
    storyCommanderBackfill(STORY.commander);
    const roleBonus = winText ? 120 : 0;
    const timeBonus = winText && ctx.mode === 'defense'
        ? Math.round(Math.max(0, telemetrySummary?.durationSeconds || 0) * 0.35)
        : winText
            ? Math.round(Math.max(0, telemetrySummary?.timeRemaining || 0) * 0.5)
            : 0;
    const xpEarned = Math.max(0, Math.round(
        (telemetrySummary?.aiValueLost || 0) -
        (telemetrySummary?.enemyValueDestroyed || 0) * 0.45 +
        roleBonus + timeBonus
    ));
    STORY.commander.xp += xpEarned;
    STORY.commander.score += xpEarned;
    if (winText) STORY.commander.victories++;
    storyCommanderBackfill(STORY.commander);
    STORY.pendingReward = { won, xpEarned, survivors: STORY.veterans.length, nodeName: node.name };
    if (ctx.mode === 'defense') {
        // SAVUNMA: düşman (ctx.attacker) oyuncunun node'una saldırdı
        const inv = storyState(ctx.attacker) || { id: ctx.attacker, name: '?', welfare: 50, gov: null };   // güvenlik: null-deref önle
        if (winText) {
            me.reputation += 1; me.welfare = Math.min(100, me.welfare + 3);
            inv.welfare = Math.max(0, inv.welfare - 3);
            if (ctx.enemyStageNode != null && inv.gov) { const ec = inv.gov.commanders.find(c => c.node === ctx.enemyStageNode); if (ec) ec.loyalty = Math.max(0, (ec.loyalty == null ? 60 : ec.loyalty) - 5); }   // püskürtülen saldıran → sadakat düşer
            storyLog(`🛡️ ${node.name} SAVUNULDU! ${inv.name} püskürtüldü (+itibar). Gazi: ${STORY.veterans.length}`);
        } else if (won === 'draw') {
            storyLog(`🤝 ${node.name} savunmasında berabere — bölge sende kaldı. Gazi: ${STORY.veterans.length}`);
        } else {
            node.owner = inv.id; storyCityRename(node); if (typeof storyFacEvent === 'function') { storyFacEvent(me, 'cityLost'); storyFacEvent(inv, 'cityWon'); } if (typeof storyNewsConquest === 'function') storyNewsConquest(node, inv, me);                  // KAYBET → bölge düşmana geçer
            if (typeof storyCaptureNodePool === 'function') storyCaptureNodePool(node);   // şehirdeki havuz imha, %25'i fatihe
            const nbOwn = node.neighbors.map(storyNode).find(x => x && x.owner === me.id);   // komşu dost şehre çekil
            const fb = STORY.nodes.find(n => n.owner === me.id);
            const safeId = nbOwn ? nbOwn.id : (fb ? fb.id : null);
            if (safeId != null) {
                if (STORY.commander.node === node.id) STORY.commander.node = safeId;
                for (const c of (me.gov ? me.gov.commanders : [])) if (c.node === node.id) c.node = safeId;   // dost komutanlar da çekilir
            } else {
                storyFlash('💀 Son bölgeni de kaybettin! Komşu bir şehri geri alarak toparlanmaya çalış.');   // 0-bölge tam yenilgi: Adım 6
            }
            if (ctx.enemyStageNode != null && inv.gov) { const ec = inv.gov.commanders.find(c => c.node === ctx.enemyStageNode); if (ec) ec.node = node.id; }   // galip saldıran şehre ilerler
            me.reputation = Math.max(0, me.reputation - 1); me.welfare = Math.max(0, me.welfare - 4);
            storyLog(`💀 ${node.name} DÜŞTÜ! ${inv.name} bölgeyi aldı (-itibar, -refah). Gazi: ${STORY.veterans.length}`);
        }
    } else {
        // SALDIRI: oyuncu komşu düşman node'una saldırdı (ctx.defender = düşman)
        if (winText) {
            node.owner = me.id; storyCityRename(node); if (typeof storyFacEvent === 'function') { storyFacEvent(me, 'cityWon'); storyFacEvent(storyState(STORY.battleCtx && STORY.battleCtx.enemyStateId), 'cityLost'); } if (typeof storyNewsConquest === 'function') storyNewsConquest(node, me, storyState(STORY.battleCtx && STORY.battleCtx.enemyStateId));                   // FETHET
            if (typeof storyCaptureNodePool === 'function') storyCaptureNodePool(node);   // savunanın havuzu imha, %25'i sana
            STORY.commander.node = node.id;       // komutan ilerler
            me.reputation += 1; me.welfare = Math.min(100, me.welfare + 3);
            if (STORY.commander.res) STORY.commander.res.points += 120;   // ganimet → fetheden komutanın KENDİ kasası
            if (STORY._techBonus && STORY._techBonus.conquestVets) {      // TEKNOLOJİ (Halk Ordusu): fetihte +gazi piyade
                for (let i = 0; i < STORY._techBonus.conquestVets; i++) STORY.veterans.push({ type: T.INFANTRY, vet: 1 });
                STORY.veterans = STORY.veterans.slice(0, 14);
            }
            foe.welfare = Math.max(0, foe.welfare - 4);
            storyLog(`🏆 ${node.name} fethedildi! (+itibar, +120 puan)  Gazi: ${STORY.veterans.length}`);
        } else if (won === 'draw') {
            me.welfare = Math.max(0, me.welfare - 1);
            storyLog(`🤝 ${node.name} önünde berabere. Bölge ${foe.name}'de kaldı. Gazi: ${STORY.veterans.length}`);
        } else {
            me.reputation = Math.max(0, me.reputation - 1); me.welfare = Math.max(0, me.welfare - 3);
            storyLog(`💀 ${node.name} saldırısı başarısız. Gazi: ${STORY.veterans.length} (kalanlar geri çekildi)`);
        }
    }

    // SİMETRİK SAVAŞ MALİYETİ: AI-vs-AI ile aynı — kasalar erir (snowball freni). Oyuncu + müttefik + savaşan düşman komutanı -30👥.
    const warDebit = c => { if (c && c.res) c.res.manpower = Math.max(0, c.res.manpower - 30); };
    warDebit(STORY.commander);
    for (const a of (STORY._battleAllyList || [])) {   // MÜTTEFİK: maliyet öde + sonuca göre sadakat (seninle savaşan komutan sana güvenir/küser)
        warDebit(a);
        if (a && a.recentBattles) { a.recentBattles.push(winText ? 1 : 0); if (a.recentBattles.length > 3) a.recentBattles.shift(); }
        if (a && a.loyalty != null) a.loyalty = Math.max(0, Math.min(100, a.loyalty + (winText ? 2 : -1)));
    }
    const eSt = storyState(ctx.mode === 'defense' ? ctx.attacker : ctx.defender) || { name: '?', gov: null };   // düşman devlet (inv blok-kapsamlıydı → ctx'ten direkt: BUG fix)
    const eLead = (eSt && eSt.gov && ctx.enemyStageNode != null) ? eSt.gov.commanders.find(c => c.node === ctx.enemyStageNode) : null;
    warDebit(eLead);
    // KOMUTAN ÖLÜMÜ (düello stake): KAZANDIYSAN düşman komutanı düşer (düşman ordusu kalıcı erir); KAYBEDERSEN savaşan müttefik düşebilir (JETON ölmez)
    if (winText && eLead && eSt && Math.random() < CMD_DEATH_ON_LOSS) { const nm = eLead.name; storyKillCommander(eLead, eSt); storyLog(`☠️ ${nm} (${eSt.name}) düelloda öldürüldü.`); }
    else if (won === false) {
        const meSt = storyPlayerState();
        for (const a of (STORY._battleAllyList || [])) if (a && Math.random() < CMD_DEATH_ON_LOSS * 0.7) { const nm = a.name; storyKillCommander(a, meSt); storyLog(`☠️ Müttefik komutan ${nm}, ${node.name} savaşında düştü.`); }
    }

    // SEÇİM: itibar + refah eşiği → yönetici ol (Faz-1 kilometre taşı; çok-komutan Faz-2)
    if (!me.isAdmin && me.reputation >= 6 && me.welfare >= 60) {
        me.isAdmin = true;
        if (me.gov) me.gov.leader = 'player';      // YÖNETİCİ oldun → komutan yarat/dağıt, kaynak böl (konsey ekranı)
        storyLog('🎖️ HALK SENİ SEÇTİ — Artık YÖNETİCİSİN! Komutan yaratıp orduları yönetebilirsin (Konsey).');
    }

    STORY.battleCtx = null;
    storySave();

    // game-over ekranını HİKAYE moduna çevir: "Dünyaya Dön" göster, "Tekrar Oyna" gizle
    document.getElementById('restart-btn')?.classList.add('hidden');
    const rb = document.getElementById('story-return-btn');
    if (rb) rb.classList.add('hidden');
    if (typeof warRoomShowCampaignResult === 'function') warRoomShowCampaignResult(STORY.pendingReward);
}

function storyClaimReward(reward) {
    if (!STORY.pendingReward || !reward) return false;
    storyCommanderBackfill(STORY.commander);
    if (reward === 'logistics') {
        STORY.commander.res.oil += 150; STORY.commander.res.manpower += 150; STORY.commander.res.points += 150;
    } else if (reward === 'veterans') {
        STORY.veterans.push({ type: T.ARMOR, vet: 2 }, { type: T.ARMOR, vet: 2 });
        STORY.veterans = STORY.veterans.slice(0, 14);
    } else if (reward === 'steel') {
        STORY.commander.rewardMods.armoredHpMul = (STORY.commander.rewardMods.armoredHpMul || 1) * 1.08;
    } else return false;
    STORY.pendingReward = null;
    storySave();
    storyReturnToWorld();
    return true;
}

function storyReturnToWorld() {
    DEPLOY_RES = null;   // kaynak-bazlı deploy bitti → tek-para moduna dön (Quick Match güvenli)
    DEPLOY_POOL = null; STORY._poolSrc = null; STORY._battleVets = null;   // FAZ-3: havuz modu kapat (Quick Match/MP güvenli)
    TECH_BONUS = null; TECH_BONUS_RED = null;   // teknoloji bonusları savaş-dışı KAPALI (Quick Match/MP güvenli)
    ['res-oil', 'res-manpower', 'res-points'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    document.getElementById('game-over-screen')?.classList.add('hidden');
    document.getElementById('campaign-result-panel')?.classList.add('hidden');
    document.getElementById('story-return-btn')?.classList.add('hidden');
    document.getElementById('restart-btn')?.classList.remove('hidden');   // normal mod için geri-aç
    phase = PHASE.OVER;   // sim duruyor; dünya ekranı devralır
    showScreen('story');
    storyResize();
    storyCenterCamOnPlayer();
    storyRender();
}

// ŞEHİR/KAYNAK işaretlerini en-yakın ülkeye ata (her ülke kendi bölgesindeki işaretlerden gelir alır)
function storyAssignDeposits() {
    for (const n of STORY.nodes) { n.cities = 0; n.oil = 0; n.pts = 0; }
    if (typeof STORY_TERRAIN === 'undefined') return;
    const assign = (arr, key) => {
        for (const p of (arr || [])) {
            let best = -1, bd = Infinity;
            for (const n of STORY.nodes) { const dx = p[0] - n.lx, dy = p[1] - n.ly, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = n.id; } }
            if (best >= 0) STORY.nodes[best][key]++;
        }
    };
    assign(STORY_TERRAIN.cities, 'cities');
    assign(STORY_TERRAIN.oil, 'oil');
    assign(STORY_TERRAIN.pts, 'pts');
}

// ── DÜNYA SİMÜLASYONU (gerçek-zaman, duraklatılabilir) ────────────────────────
function storyAdvance(dtSec) {
    if (STORY.paused) return;
    if (STORY._session) {         // FAZ-4: KONSEY TOPLANTIDA — dünya durur (olay)
        if (typeof storyCouncilAfkCheck === 'function') storyCouncilAfkCheck();   // ama süresiz değil
        return;
    }
    STORY.clock += dtSec;
    // FAZ-4: KONSEY TAKVİMİ — her 2 yılda bir TÜM devletlerde toplanır (AI sessiz, oyuncu modal)
    if (typeof storyCouncilTick === 'function') { storyCouncilTick(); if (STORY._session) return; }
    // KAYNAK: her sahip olunan düğüm → sahibine petrol/insan/puan biriktirir
    STORY._accResource += dtSec;
    if (STORY._accResource >= 1.0) {
        const step = STORY._accResource; STORY._accResource = 0;
        const ab = STORY.cfg.abundance || 1;
        // 1) Her devletin GELİRİNİ topla (sahip olduğu şehirlerden): 🟠petrol/🔴şehir-insan/🟢puan
        const inc = {};
        for (const n of STORY.nodes) {
            if (n.owner == null || !storyState(n.owner)) continue;
            const o = inc[n.owner] || (inc[n.owner] = { oil: 0, manpower: 0, points: 0 });
            const lv = 1 + (((n.level || 1) - 1) * 0.4);   // ŞEHİR SEVİYESİ geliri ölçekler: lvl2=+%40, lvl3=+%80
            o.oil      += (0.4 + (n.oil    || 0) * 0.7) * lv * ab * step;
            o.manpower += (0.4 + (n.cities || 0) * 0.5) * lv * ab * step;
            o.points   += (0.4 + (n.pts    || 0) * 0.7) * lv * ab * step;
        }
        // TEKNOLOJİ + KANUN (Vergi Reformu, Vergi Rejimi, Demiryolu…): HER devletin gelir çarpanları
        for (const st of STORY.states) {
            const tb = st._techBonus, o = inc[st.id];
            if (!tb || !o) continue;
            if (tb.pointsIncome) o.points *= tb.pointsIncome;
            if (tb.oilIncome) o.oil *= tb.oilIncome;
            if (tb.manIncome) o.manpower *= tb.manIncome;
        }
        // 2) Geliri KOMUTANLARA EŞİT dağıt (her komutanın kendi kasası birikir); state.res = toplam; gelir/komutan SABİT
        for (const st of STORY.states) {
            const cmds = storyStateCommanders(st), k = Math.max(1, cmds.length);
            const o = inc[st.id] || { oil: 0, manpower: 0, points: 0 };
            // AŞAMA 3 MAKROEKONOMİ: enflasyon TÜM gelirleri kırpar (%30 → −%35),
            // piyasa güveni ⭐'ı oynatır (0.85x…1.15x). Para artık iklime bağlı.
            if (typeof storyEconIncomeMul === 'function') {
                const _em = storyEconIncomeMul(st);
                o.oil *= _em.all; o.manpower *= _em.all; o.points *= _em.all * _em.points;
            }
            // 1.5 EKONOMİST: lojistik becerisi → DAHA BÜYÜK gelir payı (toplam korunur; komutanlar gerçek birey)
            // FAZ-7: Seferberlik/Hazinedar yetenekleri oyuncunun PAYINI büyütür (toplam gelir sabit)
            const _shareOf = c => (1 + (((c.skills && c.skills.economist) || 0) * 0.12))
                * ((typeof cmdrIsPlayerToken === 'function' && cmdrIsPlayerToken(c)) ? cmdrBonus(c).incomeShare : 1);
            let wsum = 0; for (const c of cmds) wsum += _shareOf(c); wsum = wsum || 1;
            for (const c of cmds) {
                if (!c.res) c.res = { oil: 0, manpower: 0, points: 0 };
                const w = _shareOf(c) / wsum;
                c.res.oil += o.oil * w; c.res.manpower += o.manpower * w; c.res.points += o.points * w;
            }
            st.res.oil = cmds.reduce((a, c) => a + (c.res ? c.res.oil : 0), 0);
            st.res.manpower = cmds.reduce((a, c) => a + (c.res ? c.res.manpower : 0), 0);
            st.res.points = cmds.reduce((a, c) => a + (c.res ? c.res.points : 0), 0);
            if (st.isPlayer) STORY._incPerCmd = { oil: o.oil / k / step, manpower: o.manpower / k / step, points: o.points / k / step };
            // AR-GE BÜTÇESİ: puan gelirinin %60'ı, HER devlet için (oyuncu dahil).
            // Eskiden yalnız AI biriktiriyordu; oyuncu tech'i elle satın alıyordu → asimetriydi.
            // Artık ikisi de aynı havuzdan, aynı hızda ilerler; yön KONSEY kararıdır.
            st.techPoints = Math.min(4000, (st.techPoints || 0) + (o.points || 0) * 0.6);
        }
    }
    // FAZ-3: ŞEHİR ÜRETİMİ — kuyruktaki birlikler ilerler, bitenler havuza düşer (oyuncu + AI aynı motor)
    STORY._accProd = (STORY._accProd || 0) + dtSec;
    if (STORY._accProd >= 1.0) { const s = STORY._accProd; STORY._accProd = 0; if (typeof prodTick === 'function') prodTick(s); }
    // FAZ-2 Adım 5: KOMUTAN AI — rastgele drift/invade KALDIRILDI; komutanlar kendi konum/güç/kişilikleriyle davranır
    STORY._accCmdAI = (STORY._accCmdAI || 0) + dtSec;
    if (STORY._accCmdAI >= 1.0) {
        STORY._accCmdAI = 0;
        storyAICommanderTick();                                                 // hareket/fetih/oyuncuya saldırı
    }
    STORY._accLoyalty = (STORY._accLoyalty || 0) + dtSec;
    if (STORY._accLoyalty >= 0.5) { STORY._accLoyalty = 0; storyApplyLoyaltyDrift(); } // sadakat drift
    STORY._accEcon = (STORY._accEcon || 0) + dtSec;
    if (STORY._accEcon >= 4) { const _edt = STORY._accEcon; STORY._accEcon = 0; if (typeof storyEconomyTick === 'function') storyEconomyTick(_edt); }   // AŞAMA 3 makroekonomi
    STORY._accGrow = (STORY._accGrow || 0) + dtSec;
    if (STORY._accGrow >= 5) { const _gdt = STORY._accGrow; STORY._accGrow = 0; if (typeof storyCityGrowthTick === 'function') storyCityGrowthTick(_gdt); }   // organik şehir büyümesi
    STORY._accFac = (STORY._accFac || 0) + dtSec;
    if (STORY._accFac >= 2) { const _fdt = STORY._accFac; STORY._accFac = 0; if (typeof storyFactionsTick === 'function') storyFactionsTick(_fdt); }   // AŞAMA 2 fraksiyonlar
    STORY._accSocial = (STORY._accSocial || 0) + dtSec;
    if (STORY._accSocial >= 4) { STORY._accSocial = 0; storyDissolveDeadStates(); storyApplyDefections(); storyApplyCoups(); }   // ölü-devlet + firar + darbe (seyrek)
    STORY._accSiege = (STORY._accSiege || 0) + dtSec;
    if (STORY._accSiege >= 2.5) { STORY._accSiege = 0; storySiegeTick(); }   // olgunlaşan kuşatmaları çöz
    // FAZ-2 Adım 4: AI devletleri ORGANİK teknoloji geliştirir (techPoints yeterse)
    STORY._accTech = (STORY._accTech || 0) + dtSec;
    if (STORY._accTech >= 8) { STORY._accTech = 0; storyAIResearch(); }
    // FAZ-6: SOHBET (komutan/kulis/elçi) + AI'ler arası diplomasi
    if (typeof storyTalkTick === 'function') storyTalkTick(dtSec);
    STORY._accDip = (STORY._accDip || 0) + dtSec;
    if (STORY._accDip >= 11) { STORY._accDip = 0; if (typeof storyAIDiplomacyTick === 'function') storyAIDiplomacyTick(); }
    // FAZ-10: DÜNYA ÇAĞI — dünyanın karakteri ölçülür, AI ve sohbet ona göre davranır
    STORY._accEra = (STORY._accEra || 0) + dtSec;
    if (STORY._accEra >= 6) { STORY._accEra = 0; if (typeof storyEraTick === 'function') storyEraTick(); }
    STORY._accCityDev = (STORY._accCityDev || 0) + dtSec;
    if (STORY._accCityDev >= 10) { STORY._accCityDev = 0; if (typeof storyAICityTick === 'function') storyAICityTick(); }   // AI: garnizon/şehir/bina geliştirir + ordu üretir
    STORY._accReplenish = (STORY._accReplenish || 0) + dtSec;
    if (STORY._accReplenish >= 12) { STORY._accReplenish = 0; storyReplenishCommanders(); }   // ölen komutanları YAVAŞ telafi (dünya boşalmasın)
    if (storyCheckPlayerDefeat()) return;   // ADIM 6: 0-bölge → kampanya bitti
}

// FAZ-1.5: oyuncu bölgesine komşu en güçlü düşman → savunma savaşı (oyuncu seçer: savun / bölgeyi bırak)
