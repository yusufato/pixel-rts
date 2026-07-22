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
const STORY_STATE_DEFS = [
    { name: 'Türk Cumhuriyeti',  color: '#4cff7c' },   // 0 OYUNCU — başkent Türkiye
    { name: 'İber Birliği',      color: '#ff8a3c' },   // 1 başkent İspanya
    { name: 'Britanya Krallığı', color: '#e34c4c' },   // 2 başkent İngiltere
    { name: 'Cermen Birliği',    color: '#e0d24c' },   // 3 başkent Almanya
    { name: 'Kuzey Birliği',     color: '#4cc8ff' },   // 4 başkent İsveç
    { name: 'Slav Federasyonu',  color: '#b07cff' },   // 5 başkent Rusya
    { name: 'Mağrip Birliği',    color: '#d98cc0' },   // 6 başkent Cezayir (Kuzey Afrika)
    { name: 'Arap Birliği',      color: '#cfa14c' }     // 7 başkent Suudi Arabistan (Orta Doğu)
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
function storyCityName(id) { return 'Şehir ' + (id + 1); }
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
function storyBuildCities() {
    const C = (typeof STORY_TERRAIN !== 'undefined' && STORY_TERRAIN.cities) || [];
    if (!C.length) return storyBuildEurope();     // güvenlik: şehir verisi yoksa eski ülke sistemi
    const nodes = C.map((p, id) => ({
        id, name: storyCityName(id), lx: p[0], ly: p[1], owner: 0, mapId: id % MAPS_LEN(),
        neighbors: [], cities: 1, oil: 0, pts: 0, level: 1, garrison: 0,  // FAZ-2 Adım 6: seviye(1-3)+garnizon
        fac: 0, bar: 0, pool: {}, q: []   // FAZ-3: fabrika/kışla seviyesi + ordu havuzu + üretim kuyruğu
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
const STORY_CMD_TITLES = ['Bey', 'Paşa', 'Komutan', 'Ağa'];
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
        army: {},                                        // FAZ-5: SEFER ORDUSU — komutanla birlikte gezer (şehir deposu ayrı)
        node: (node != null ? node : (cap != null ? cap : 0))
    };
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
    STORY.commander = { id: 0, name: 'Komutan (Sen)', isPlayer: true, personality: 'oyuncu', loyalty: 100, skills: { warrior: 4, diplomat: 3, economist: 3 }, res: { oil: Math.round(200 * abundance), manpower: Math.round(200 * abundance), points: Math.round(200 * abundance) }, node: (STORY._capitals && STORY._capitals[playerStateId]) || 0, xp: 0, score: 0, victories: 0, rank: 1, activePerks: [], rewardMods: {}, army: {} };
    storyInitGovernments();                            // her devlete AI komutan + hükümet iskeleti
    STORY.veterans = [];
    // OYUNCU tech'i = kendi devletinin tech dizisi (AYNI dizi nesnesi) → storyTechPowerMul/konsey
    // oyuncu devletinde de doğru çalışır; iki ayrı liste tutmanın yol açtığı sapma biter.
    STORY.tech = STORY.states[playerStateId].tech;
    STORY._techBonus = null;
    STORY._nextCouncil = (typeof COUNCIL_PERIOD_YEARS !== 'undefined') ? COUNCIL_PERIOD_YEARS * YEAR_SECONDS : 240;   // FAZ-4: ilk konsey 2. yılda
    STORY._councilNo = 0;
    STORY._session = null;
    STORY.rel = {};                                     // FAZ-6: diplomasi ilişki/antlaşma tablosu
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
        storyBuildLandGrid();                     // kayıttan pixel kara-maskeyi yeniden üret
        storyAssignDeposits();                    // şehir/kaynak işaretlerini ülkelere ata (ekonomi)
        STORY.playerStateId = d.playerStateId | 0;
        // Başkentler: eski kayıtlarda yok → yeniden üret (yoksa capitalSeek ve komutan konumlanması bozulur)
        STORY._capitals = (Array.isArray(d.caps) && d.caps.length) ? d.caps : storyPickCapitals(STORY.nodes, STORY.states.length);
        STORY.commander = d.commander || { node: 0 };
        storyCommanderBackfill(STORY.commander);
        // FAZ-2: hükümet backfill (eksik kayıt güvenliği) + komutan-id sayacını ilerlet
        let _mx = (STORY.commander && STORY.commander.id) || 0;
        if (STORY.commander && !STORY.commander.res) STORY.commander.res = { oil: 200, manpower: 200, points: 200 };
        for (const st of STORY.states) {
            if (!st.gov) st.gov = { leader: (st.isPlayer && st.isAdmin) ? 'player' : 'ai', commanders: [] };
            st._nextStaff = 0;   // 1.3: genelkurmay hemen yeniden-planlasın
            for (const c of (st.gov.commanders || [])) { if ((c.id || 0) > _mx) _mx = c.id; if (!c.res) c.res = { oil: 200, manpower: 200, points: 200 }; if (!c.recentBattles) c.recentBattles = []; if (!c.army || typeof c.army !== 'object') c.army = {}; delete c._nextT; delete c._lastDefect; delete c._objective; }   // FAZ-2 Adım 5/6: transient temizlik (+1.3 emir)
        }
        _storyCmdNextId = _mx + 1;
        STORY._lastPlayerInvasion = 0; STORY._accCmdAI = 0; STORY._accLoyalty = 0; STORY._accSocial = 0;   // komutan-AI sayaçları sıfırla
        // FAZ-2 Adım 4 + FAZ-4: devlet tech/kanun/anayasa backfill + bonus (eski kayıtlar konsey öncesinden gelir)
        for (const st of STORY.states) {
            if (!st.tech) st.tech = []; if (st.techPoints == null) st.techPoints = 0;
            if (!st.laws) st.laws = {}; if (!st.constitution) st.constitution = 'monarchy';
            storyStateComputeTech(st);
        }
        for (const n of STORY.nodes) storyNodeBackfill(n);   // kuşatma temizliği + seviye/garnizon/bina/havuz/kuyruk backfill (Production.js)
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
    if (active.indexOf('logistics') >= 0) DEPLOY_RES.blue.oil += 200;
    if (active.indexOf('mobilization') >= 0) DEPLOY_RES.blue.manpower += 150;
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
            node.owner = inv.id;                  // KAYBET → bölge düşmana geçer
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
            node.owner = me.id;                   // FETHET
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
    if (STORY._session) return;   // FAZ-4: KONSEY TOPLANTIDA — dünya durur (olay), oyuncu karar verene kadar
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
            // 1.5 EKONOMİST: lojistik becerisi → DAHA BÜYÜK gelir payı (toplam korunur; komutanlar gerçek birey)
            let wsum = 0; for (const c of cmds) wsum += 1 + (((c.skills && c.skills.economist) || 0) * 0.12); wsum = wsum || 1;
            for (const c of cmds) {
                if (!c.res) c.res = { oil: 0, manpower: 0, points: 0 };
                const w = (1 + (((c.skills && c.skills.economist) || 0) * 0.12)) / wsum;
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
        if (typeof storyAutoLoadArmies === 'function') storyAutoLoadArmies();   // FAZ-5: komutanlar durdukları şehrin deposunu orduya SEVK eder
        storyAICommanderTick();                                                 // hareket/fetih/oyuncuya saldırı
    }
    STORY._accLoyalty = (STORY._accLoyalty || 0) + dtSec;
    if (STORY._accLoyalty >= 0.5) { STORY._accLoyalty = 0; storyApplyLoyaltyDrift(); } // sadakat drift
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
    STORY._accCityDev = (STORY._accCityDev || 0) + dtSec;
    if (STORY._accCityDev >= 10) { STORY._accCityDev = 0; if (typeof storyAICityTick === 'function') storyAICityTick(); }   // AI: garnizon/şehir/bina geliştirir + ordu üretir
    STORY._accReplenish = (STORY._accReplenish || 0) + dtSec;
    if (STORY._accReplenish >= 12) { STORY._accReplenish = 0; storyReplenishCommanders(); }   // ölen komutanları YAVAŞ telafi (dünya boşalmasın)
    if (storyCheckPlayerDefeat()) return;   // ADIM 6: 0-bölge → kampanya bitti
}

// FAZ-1.5: oyuncu bölgesine komşu en güçlü düşman → savunma savaşı (oyuncu seçer: savun / bölgeyi bırak)
// ══ FAZ-2 ADIM 5: KOMUTAN AI — özerk hareket/fetih/savunma + sadakat/firar/darbe ══
// rastgele storyEnemyDrift/storyMaybeInvade KALDIRILDI → fetih komutanların KONUMUNDA olur (jetonlar artık gerçek aktör).
const CMD_PERSONA_AGGR = { agresif: 1.3, dengeli: 1.0, savunmacı: 0.5, fırsatçı: 1.15 };
function storyTechPowerMul(st) { return 1 + ((st && st.tech ? st.tech.length : 0) * 0.03); }   // teknolojili devlet daha güçlü savaşır
// FAZ-3: komutanın gücü artık ORDUSUNA dayanır. Eskiden yalnız kasasına (manpower) bakıyordu;
// savaşa gireceği birlikler ise havuzdan geliyordu. Kasası dolu ama şehri boş bir komutan
// "güçlüyüm" deyip saldırıya kalkıyor, sahaya hiç birlik çıkaramıyordu. ("3-4 komutan hiç
// ordusu olmadan zafer kazanacağına inanıyor.")
// FAZ-5: ordu artık komutanın ÜZERİNDE (cmd.army) — şehirde beklemiyor, onunla geziyor.
function storyCommanderArmy(cmd, st) {
    return (typeof cmdArmyCount === 'function') ? cmdArmyCount(cmd) : 0;
}
function storyCalcCommanderPower(cmd, st) {
    const base = 20 + ((cmd.skills && cmd.skills.warrior) || 0) * 12;   // liderlik katkısı (ordu olmadan tek başına az)
    const army = storyCommanderArmy(cmd, st) * 14;                       // ASIL güç: sevk edebileceği birlik sayısı
    const kasa = ((cmd.res && cmd.res.manpower) || 0) * 0.02;            // kasa artık ikincil (üretim potansiyeli)
    const loyF = 0.7 + ((cmd.loyalty == null ? 60 : cmd.loyalty) / 100) * 0.3;
    return Math.round((base + army + kasa) * storyTechPowerMul(st) * loyF);
}
function storyCalcDefenseStrength(node, st) {
    // FAZ-3: şehirde bekleyen ORDU HAVUZU da savunmaya katılır → storyEvalTarget/storyExposureAt
    // bu sayede "iyi savunulan şehre saldırma" davranışını ekstra AI kodu olmadan öğrenir.
    const poolStr = (typeof storyPoolPower === 'function') ? storyPoolPower(node) : 0;
    const militia = (typeof cityMilitiaFor === 'function') ? cityMilitiaFor(node) : 3;
    let s = 60 + militia * 8 + ((node.cities || 0) * 10) + ((node.garrison || 0) * 10) + poolStr, cmdStr = 0;
    if (st && st.gov) for (const c of storyStateCommanders(st)) {
        if (c.node === node.id) cmdStr += storyCalcCommanderPower(c, st);
        else if (node.neighbors.indexOf(c.node) >= 0) cmdStr += storyCalcCommanderPower(c, st) * 0.5;
    }
    // ŞEHİR SEVİYESİ TAHKİMATI: savaş-içi dayanıklılık bonusunun stratejik karşılığı —
    // AI gelişmiş şehre saldırmadan önce iki kez düşünür.
    const fort = 1 + ((typeof cityDefenseBonus === 'function') ? cityDefenseBonus(node) : 0);
    return Math.round((s + cmdStr) * storyTechPowerMul(st) * fort);
}
// ══ FAZ-2 ADIM 6: ŞEHİR GELİŞTİRME (seviye + garnizon) + 0-BÖLGE YENİLGİ ═══════
const CITY_UPGRADE_COST = [0, 300, 600];     // mevcut lvl → üst lvl maliyeti (⭐puan): 1→2=300, 2→3=600
const CITY_GARRISON_COST = 70;               // garnizon başı 70 👥insan gücü
function storyCityGarrisonCap(n) { return (n.level || 1) * 4; }   // lvl1=4, lvl2=8, lvl3=12
function storyCityUpgrade(nodeId) {
    const n = storyNode(nodeId); if (!n || n.owner !== STORY.playerStateId) return;
    const lvl = n.level || 1;
    if (lvl >= 3) { storyFlash('Şehir zaten maksimum seviye (3).'); return; }
    const cost = CITY_UPGRADE_COST[lvl] || 300;
    const pts = (STORY.commander && STORY.commander.res) ? STORY.commander.res.points : 0;
    if (pts < cost) { storyFlash(`⭐ Puan yetersiz (gerekli ${cost}, var ${Math.floor(pts)}).`); return; }
    STORY.commander.res.points -= cost; n.level = lvl + 1;
    storyLog(`🏗️ <b>${n.name}</b> seviye ${n.level} (gelir +%${Math.round((n.level - 1) * 40)}, garnizon kapasitesi ${storyCityGarrisonCap(n)}).`);
    storySave(); if (typeof storyCityUpdate === 'function') storyCityUpdate();
}
function storyCityGarrison(nodeId) {
    const n = storyNode(nodeId); if (!n || n.owner !== STORY.playerStateId) return;
    if ((n.garrison || 0) >= storyCityGarrisonCap(n)) { storyFlash(`Garnizon dolu (${storyCityGarrisonCap(n)}) — şehri yükselt.`); return; }
    const mp = (STORY.commander && STORY.commander.res) ? STORY.commander.res.manpower : 0;
    if (mp < CITY_GARRISON_COST) { storyFlash(`👥 İnsan gücü yetersiz (gerekli ${CITY_GARRISON_COST}).`); return; }
    STORY.commander.res.manpower -= CITY_GARRISON_COST; n.garrison = (n.garrison || 0) + 1;
    storyLog(`🛡️ <b>${n.name}</b> garnizonu ${n.garrison}/${storyCityGarrisonCap(n)} (savunma düellosunda birlik olarak savaşır).`);
    storySave(); if (typeof storyCityUpdate === 'function') storyCityUpdate();
}
// AI: her devlet ara sıra bir SINIR şehrini geliştirir (garnizon önceliği — savunma)
// AI ŞEHİR GELİŞTİRME + ÜRETİM → js/Production.js (storyAICityTick)
// Oyuncu havuzdan ordu sürerken AI'nın da üretmesi ADALET ŞARTI; aynı maliyetler, aynı motor.
// SAVUNMA düellosunda şehrin TABAN MİLİS + GARNİZONU ek savunan birlik olarak çıkar (otonom dost-AI)
const CITY_MILITIA_BASE = 3;   // her şehrin doğuştan milisi (düşman savunma base'i 250 ile SİMETRİ; garnizonsuz bile şehir savunmasız değil)
function storySpawnGarrison() {
    const ctx = STORY.battleCtx;
    if (!ctx || ctx.mode !== 'defense' || typeof T === 'undefined' || typeof Unit === 'undefined') return;
    const node = storyNode(ctx.nodeId); if (!node) return;
    // ŞEHİR SEVİYESİ: milis tabanı seviyeyle büyür (Sv.1=3, Sv.2=5, Sv.3=8)
    const base = (typeof cityMilitiaFor === 'function') ? cityMilitiaFor(node) : CITY_MILITIA_BASE;
    const g = Math.min(20, base + Math.min(storyCityGarrisonCap(node), node.garrison || 0));
    for (let i = 0; i < g; i++) {
        const type = (i % 3 === 0) ? T.ANTI_TANK : T.INFANTRY;
        const u = new Unit(type, 180 + (i % 10) * 52, (WORLD_H - 300) - Math.floor(i / 10) * 50, false);   // gazi/müttefik ile aynı güvenli dizilim bölgesi
        u.ally = true;
        if (typeof getSquadRole === 'function') u.squad = getSquadRole(type);
        if (typeof applyTechSpawnBonus === 'function') applyTechSpawnBonus(u);
        units.push(u); player.unitsSpawned++;
    }
    storyLog(`🛡️ ${node.name} (Sv.${node.level || 1}) milis + garnizonu: ${g} birlik savunmaya katıldı.`);
}

// ŞEHİR TAHKİMATI: savunma düellosunda ŞEHRİ TUTAN tarafın tüm birlikleri seviyeye göre
// dayanıklılık kazanır (Sv.2 +%25, Sv.3 +%45). "Seviye yükseltmenin anlamı yok" sorununun
// savaş-içi karşılığı budur: gelişmiş şehir gerçekten zor alınır.
function storyApplyCityFortification() {
    const ctx = STORY.battleCtx;
    if (!ctx || typeof cityDefenseBonus !== 'function') return;
    const node = storyNode(ctx.nodeId); if (!node) return;
    const bonus = cityDefenseBonus(node);
    if (bonus <= 0) return;
    // Savunan taraf: hikâyede savunma modunda MAVİ (oyuncu), saldırı modunda KIRMIZI (şehrin sahibi)
    const defenderIsRed = (ctx.mode === 'attack');
    let n = 0;
    for (const u of units) {
        if (u.dead || u.isRed !== defenderIsRed) continue;
        u.maxHp = Math.round(u.maxHp * (1 + bonus));
        u.hp = u.maxHp;
        u.baseArmor = (u.baseArmor || 0) + (node.level >= 3 ? 2 : 1);
        u.armor = u.baseArmor;
        n++;
    }
    if (n) storyLog(`🧱 ${node.name} tahkimatı: savunan ${n} birlik +%${Math.round(bonus * 100)} dayanıklılık.`);
}
// 0-BÖLGE YENİLGİ: oyuncu tüm şehirlerini kaybetti → kampanya bitti
function storyCheckPlayerDefeat() {
    if (STORY._gameOver || STORY.battleCtx) return false;   // savaş sürerken tetikleme (önce düello biter)
    if (STORY.nodes.some(n => n.owner === STORY.playerStateId)) return false;
    STORY._gameOver = true; STORY.paused = true;
    storyLog('💀 KAMPANYA BİTTİ — tüm bölgelerini kaybettin.'); storyRender();
    setTimeout(() => {
        if (confirm('💀 KAMPANYA BİTTİ!\n\nTüm bölgelerini kaybettin (0 şehir).\n\nYeni kampanya başlat? (İptal → ana menü)')) { storyNewCampaign(); storyResize(); storyRender(); }
        else { showScreen('menu'); }   // iptal → donuk ekranda kalma, menüye dön
    }, 60);
    return true;
}
// ── BİREY-KARAR: komutan kendi gücünü değerlendirir, BEKLENEN-DEĞER ile hedef seçer, kişiliğe göre risk alır ──
const CMD_WEAK_MANPOWER = 60;   // bu kasanın altında "zayıf" → saldırma; güvenli şehre çekilip gelirle toparlan
const CMD_PERSONA = {           // her kişilik = farklı BİREY (min kazanma + değer çarpanı + başkent-arar + dolaşır + RİSK-TEMKİNİ)
    agresif:   { minWin: 0.35, valMul: 1.30, capitalSeek: true,  wander: true,  caution: 0.5 },   // riske atılır, açıkta kalmayı umursamaz
    dengeli:   { minWin: 0.50, valMul: 1.00, capitalSeek: false, wander: true,  caution: 1.0 },
    savunmacı: { minWin: 0.70, valMul: 0.70, capitalSeek: false, wander: false, caution: 1.8 },   // çok temkinli, overextension'dan kaçar
    fırsatçı:  { minWin: 0.55, valMul: 1.20, capitalSeek: false, wander: true,  caution: 0.9 },   // hesaplı av
};
function storyCommanderWeak(cmd) { return ((cmd.res && cmd.res.manpower) || 0) < CMD_WEAK_MANPOWER; }

// ── ORDU TOPLAMA: ordusuz komutan saldırmaz, üretim yapılabilen şehre gider ──
// Havuz sistemine geçince stratejik katman "ordum var mı" sorusunu hiç sormuyordu.
// Bu iki fonksiyon o boşluğu kapatır: taarruz için en az MIN_ATTACK_ARMY birlik gerekir,
// yoksa komutan en yakın ÜRETİM şehrine (fabrika/kışla olan; yoksa başkent) yürür.
const MIN_ATTACK_ARMY = 3;
function storyProductionHome(st) {
    const owned = STORY.nodes.filter(n => n.owner === st.id);
    if (!owned.length) return null;
    const capId = (STORY._capitals && STORY._capitals[st.id] != null) ? STORY._capitals[st.id] : null;
    const cap = capId != null ? owned.find(n => n.id === capId) : null;
    if (cap && ((cap.fac | 0) || (cap.bar | 0))) return cap;                 // başkent üretim yapabiliyorsa oraya
    const prod = owned.filter(n => (n.fac | 0) || (n.bar | 0))
        .sort((a, b) => (((b.fac | 0) + (b.bar | 0)) - ((a.fac | 0) + (a.bar | 0))));
    return prod[0] || cap || owned[0];
}
// Ordusu yetersiz komutanı üretim merkezine doğru 1 adım yürütür. true → bu tick iş bitti.
function storyCommanderSeekArmy(cmd, st) {
    if (storyCommanderArmy(cmd, st) >= MIN_ATTACK_ARMY) return false;        // ordusu var, normal karar zincirine devam
    const home = storyProductionHome(st);
    if (!home) return false;
    if (cmd.node === home.id) return true;                                   // zaten üretim merkezindeyim → bekle, ordu birikiyor
    const step = storyStepToward(cmd.node, home.id, st);
    if (step >= 0 && step !== cmd.node) { cmd.node = step; return true; }
    return true;                                                             // yol yok ama saldırmaya da kalkma
}
// hedef şehrin DEĞERİ: kaynak/şehir + başkent + zayıf-devlet fırsatı
function storyTargetValue(node) {
    const owner = storyState(node.owner);
    let v = 10 + (node.cities || 0) * 8 + (node.oil || 0) * 10 + (node.pts || 0) * 6;
    if (owner && STORY._capitals && STORY._capitals[owner.id] === node.id) v += 30;   // başkent değerli
    if (owner && (owner.welfare < 35 || owner.reputation < 2)) v += 15;               // zayıf devlet = fırsat
    return v;
}
// ── ADIM 1.2 İLERİYE-BAKIŞ: bir düğüme yerleşirsem bana komşu DÜŞMAN KOMUTAN gücü = KARŞI-SALDIRI riski ──
// (Attila-tarzı: "şehri alırım ama açıkta kalırsam geri alınır / yan cephem çöker" — tuzağa düşme)
function storyExposureAt(node, st) {
    if (!node) return 0;
    let threat = 0;
    for (const nb of node.neighbors) {
        const n = storyNode(nb); if (!n || n.owner === st.id) continue;             // sadece DÜŞMAN komşular
        if (typeof storyIsHostile === 'function' && !storyIsHostile(st.id, n.owner)) continue;   // FAZ-6: antlaşmalı komşu tehdit değil
        const ns = storyState(n.owner); if (!ns || !ns.gov) continue;
        for (const c of storyStateCommanders(ns)) {                                 // o düşman şehrinde/komşusunda hareketli kuvvet
            if (c.node === nb) threat += storyCalcCommanderPower(c, ns);
            else if (n.neighbors.indexOf(c.node) >= 0) threat += storyCalcCommanderPower(c, ns) * 0.5;
        }
    }
    return threat;
}
// ── ADIM 1.1 DERİN DEĞERLENDİRME: değer × kazanma × (ileriye-bakış riski) × (konsolidasyon) — açgözlü tek-adım DEĞİL ──
function storyEvalTarget(cmd, st, t, atk, p) {
    const ts = storyState(t.owner); if (!ts) return null;
    const win = atk / (atk + storyCalcDefenseStrength(t, ts));
    if (win < p.minWin) return null;                                                // kişiliğin risk eşiği
    let ev = storyTargetValue(t) * p.valMul * win;
    // (1.2) İLERİYE-BAKIŞ — overextension cezası: alırsam karşı-saldırı gücü gücüme göre büyükse EV düşer (temkin kişiliğe bağlı)
    const exposure = storyExposureAt(t, st);
    ev /= (1 + (exposure / Math.max(atk, 1)) * (p.caution == null ? 1 : p.caution));
    // (1.1) KONSOLİDASYON — çevresi dost şehirlerse güvenli kazanç (kuşatılmış cep); derin düşman salient'i riskli
    let fr = 0, en = 0;
    for (const nb of t.neighbors) { const n = storyNode(nb); if (!n) continue; if (n.owner === st.id) fr++; else en++; }
    ev *= 0.8 + 0.4 * (fr / Math.max(1, fr + en));                                  // 0.8 (açık salient) .. 1.2 (kuşatılmış)
    if (t._siege && t._siege.by === st.id) ev *= 0.35;                              // zaten biz kuşatıyoruz → BAŞKA cepheye yayıl
    if (p.capitalSeek && STORY._capitals && STORY._capitals[ts.id] === t.id) ev += 40;
    return { t, ts, ev, win, exposure };
}
// zayıf komutan: en yakın GÜVENLİ iç şehre (ya da başkente) 1 adım çekilip toparlanır
function storyCommanderRecover(cmd, st) {
    const capId = STORY._capitals ? STORY._capitals[st.id] : null;
    const start = cmd.node, parent = {}; parent[start] = start; const q = [start]; let goal = null;
    while (q.length) {
        const cur = q.shift(); const node = storyNode(cur); if (!node) continue;
        const interior = !node.neighbors.some(nb => { const nn = storyNode(nb); return nn && nn.owner !== st.id; });
        if (cur !== start && (cur === capId || interior)) { goal = cur; break; }
        for (const nb of node.neighbors) { const nn = storyNode(nb); if (nn && nn.owner === st.id && !(nb in parent)) { parent[nb] = cur; q.push(nb); } }
    }
    if (goal == null) return;
    let step = goal; while (parent[step] !== start) step = parent[step];
    if (step !== start) cmd.node = step;
}
function storyCommanderDecide(cmd, st) {
    const node = storyNode(cmd.node); if (!node) return;
    const onFront = node.neighbors.some(nb => { const nn = storyNode(nb); return nn && nn.owner !== st.id; });
    // 1) ÖZ-KORUMA: kasası bitmişse SALDIRMA → cephedeyse güvenli şehre çekilip toparlan (plan dinlemez)
    if (storyCommanderWeak(cmd)) {
        if (onFront) { storyCommanderRecover(cmd, st); if (Math.random() < 0.12) storyLog(`🛡️ ${cmd.name} (${st.name}) yıpranmış — geri çekilip toparlanıyor.`); }
        return;
    }
    // 1.5) ORDU YOKSA SALDIRMA: havuzunda yeterli birlik yoksa üretim merkezine yürü.
    // (Savunma emri istisnadır — kuşatılan şehri terk etmesin.)
    const defending = cmd._objective && cmd._objective.kind === 'defend';
    if (!defending && storyCommanderSeekArmy(cmd, st)) return;
    // 2) GENELKURMAY EMRİ (1.3 KOORDİNASYON): devlet planındaki hedefi uygula → yığılma yok + savunma boyutlu
    if (storyExecuteObjective(cmd, st)) return;
    // 3) FALLBACK (emir yok/uygulanamadı) — bireysel mantık: takviye → ilerle → derin-EV
    const rein = storyReinforceStep(cmd, st);
    if (rein === cmd.node) return;                              // zaten kuşatılan dost şehirdeyim → savun (kal)
    if (rein >= 0) { cmd.node = rein; return; }                 // dost kuşatmasına doğru 1 adım ilerle
    if (!onFront) { storyCommanderAdvance(cmd, st); return; }   // cephe yoksa cepheye ilerle
    // DERİN BEKLENEN-DEĞER hedef seç → KUŞAT (değer × kazanma × ileriye-bakış-riski × konsolidasyon; açgözlü tek-adım DEĞİL)
    // FAZ-6 DİPLOMASİ: ateşkes/pakt/ittifak olan devlete saldırılmaz (antlaşma bozmak ayrı bir karardır)
    const enemies = node.neighbors.map(storyNode).filter(n => n && n.owner !== st.id
        && (typeof storyIsHostile !== 'function' || storyIsHostile(st.id, n.owner)));
    const p = CMD_PERSONA[cmd.personality] || CMD_PERSONA.dengeli;
    const atk = storyCalcCommanderPower(cmd, st);
    let best = null;
    for (const t of enemies) {
        const cand = storyEvalTarget(cmd, st, t, atk, p);       // 1.1 + 1.2: derin değerlendirme + ileriye-bakış
        if (cand && (!best || cand.ev > best.ev)) best = cand;
    }
    if (!best) { if (p.wander) storyCommanderAdvance(cmd, st); return; }   // güvenli/akıllı hedef yok: saldırgan başka cephe arar
    storyBeginSiege(st, best.t);                                // KUŞATMAYA al (storySiegeTick olgunlaşınca çözer; bu sürede savunan takviye gelir)
}
// komşu düşman yoksa: kendi topraklarında EN YAKIN CEPHE şehrine (düşman-komşulu) doğru 1 adım ilerle (BFS)
function storyCommanderAdvance(cmd, st) {
    const start = cmd.node, parent = {}; parent[start] = start;
    const q = [start]; let goal = null;
    while (q.length) {
        const cur = q.shift(); const node = storyNode(cur); if (!node) continue;
        if (cur !== start && node.neighbors.some(nb => { const nn = storyNode(nb); return nn && nn.owner !== st.id; })) { goal = cur; break; }   // cephe bulundu
        for (const nb of node.neighbors) { const nn = storyNode(nb); if (nn && nn.owner === st.id && !(nb in parent)) { parent[nb] = cur; q.push(nb); } }
    }
    if (goal == null) return false;
    let step = goal; while (parent[step] !== start) step = parent[step];   // start'tan sonraki İLK adım
    cmd.node = step; return true;
}
// ── ADIM 1.3 KOORDİNASYON: yön-bulma + GENELKURMAY (devlet komutanlarını TEK planda hedeflere dağıtır) ──
// fromId'den toId'ye İLK adım (BFS; SADECE kendi toprağından geçer, hedefin kendisi düşman olabilir)
function storyStepToward(fromId, toId, st) {
    if (fromId == null || toId == null || fromId === toId) return fromId;
    const parent = {}; parent[fromId] = fromId; const q = [fromId];
    while (q.length) {
        const cur = q.shift(); const n = storyNode(cur); if (!n) continue;
        for (const nb of n.neighbors) {
            if (nb in parent) continue;
            parent[nb] = cur;
            if (nb === toId) { let s = nb; while (parent[s] !== fromId) s = parent[s]; return s; }
            const nn = storyNode(nb); if (nn && nn.owner === st.id) q.push(nb);   // ara düğümler kendi toprağı olmalı
        }
    }
    return -1;
}
// nodeId'ye en yakın (hop) komutanı bul (BFS dışa)
function storyNearestCommander(list, nodeId) {
    const seen = {}; seen[nodeId] = true; const q = [nodeId];
    while (q.length) {
        const cur = q.shift();
        const here = list.find(c => c.node === cur); if (here) return here;
        const n = storyNode(cur); if (!n) continue;
        for (const nb of n.neighbors) if (!seen[nb]) { seen[nb] = true; q.push(nb); }
    }
    return list[0] || null;
}
const STAFF_REPLAN = 3;   // saniye: genelkurmay yeniden-planlama (kısa = yeni kuşatmaya hızlı savunma ataması)
function storyStaffPlan(st) {
    if (!st.gov) return;
    const cmds = storyStateCommanders(st).filter(c => c !== STORY.commander && !storyCommanderWeak(c));   // zayıflar kendi recover'ına bırakılır
    for (const c of cmds) c._objective = null;                 // taze plan
    if (!cmds.length) return;
    const free = cmds.slice();
    // STRATEJİ POSTÜRÜ: ekonomi + cephe yükü → konsolide(<0.7) / dengeli / genişle(>=1.0).
    // Tükenmiş ya da çok-cepheye-yayılmış devlet saldırıyı KISAR (intihari overextension yok; dünya nefes alır — ileride diplomasi rahatlatır).
    const fronts = STORY.nodes.filter(n => n.owner === st.id && n.neighbors.some(nb => { const m = storyNode(nb); return m && m.owner !== st.id; })).length;
    const avgMp = cmds.reduce((s, c) => s + ((c.res && c.res.manpower) || 0), 0) / cmds.length;
    const econF = Math.max(0.4, Math.min(1.2, avgMp / 200));                            // 200 başlangıç kasa = 1.0; tükenmiş → 0.4
    const loadF = Math.max(0.5, Math.min(1.2, cmds.length / Math.max(1, fronts)));      // az komutan + çok cephe = yayılmış → kıs
    const maxAttacks = (econF * loadF) < 0.7 ? 1 : ((econF * loadF) < 1.0 ? 2 : 99);    // konsolide: tek kritik hedef; güçlü: serbest
    // 1) SAVUNMA İHTİYAÇLARI: tehdit altındaki/kuşatılan kendi SINIR şehirleri → açığı kapatacak kadar komutan (fazlası değil)
    const defNeeds = [];
    for (const n of STORY.nodes) {
        if (n.owner !== st.id) continue;
        if (!n.neighbors.some(nb => { const m = storyNode(nb); return m && m.owner !== st.id
            && (typeof storyIsHostile !== 'function' || storyIsHostile(st.id, m.owner)); })) continue;   // sadece DÜŞMAN sınırı
        const threat = storyExposureAt(n, st); const besieged = !!(n._siege && n._siege.by !== st.id);
        if (threat <= 0 && !besieged) continue;
        const deficit = threat * (besieged ? 1.25 : 0.9) - storyCalcDefenseStrength(n, st);
        if (deficit > 0 || besieged) defNeeds.push({ node: n, deficit: Math.max(deficit, 1), urgency: (besieged ? 1e4 : 0) + threat });
    }
    defNeeds.sort((a, b) => b.urgency - a.urgency);
    const covered = {};
    const assignDef = (need) => {
        const c = storyNearestCommander(free, need.node.id); if (!c) return false;
        free.splice(free.indexOf(c), 1); c._objective = { kind: 'defend', node: need.node.id };
        if (c.node !== need.node.id) c._nextT = STORY.clock;   // ACİL: beklemeden yola çık
        covered[need.node.id] = (covered[need.node.id] || 0) + storyCalcCommanderPower(c, st);
        return true;
    };
    // PASS 1 — YAY: HER kuşatılan/tehdit şehrine EN AZ 1 savunan (5 şehir kuşatılıyorsa 2'ye yığılma YOK)
    for (const need of defNeeds) { if (!free.length) break; assignDef(need); }
    // PASS 2 — DERİNLEŞTİR: hâlâ açığı olan en acil şehirlere ek savunan
    for (const need of defNeeds) { while ((covered[need.node.id] || 0) < need.deficit && free.length) { if (!assignDef(need)) break; } }
    // 2) SALDIRI HEDEFLERİ: serbest komutanların komşusundaki düşman şehirler → değerliye YETERLİ güç, sonra SIRADAKİNE (YAYIL, yığılma yok)
    const targets = [], seen = {};
    for (const c of free) {
        const cn = storyNode(c.node); if (!cn) continue;
        for (const nb of cn.neighbors) {
            const t = storyNode(nb); if (!t || t.owner === st.id || seen[t.id]) continue;
            const ts = storyState(t.owner); if (!ts) continue;
            seen[t.id] = true;
            const pri = storyTargetValue(t) / (1 + storyExposureAt(t, st) / 200);   // maruziyet-ayarlı öncelik (1.1/1.2 ruhu: riskli salient = düşük)
            targets.push({ node: t, need: storyCalcDefenseStrength(t, ts) * 1.15, pri: pri });
        }
    }
    targets.sort((a, b) => b.pri - a.pri);
    let freePower = free.reduce((s, c) => s + storyCalcCommanderPower(c, st), 0), attacked = 0;
    for (const tg of targets) {
        if (!free.length || attacked >= maxAttacks) break;     // POSTÜR: konsolide modda az/tek saldırı (kalanlar savunmada/toparlanır)
        if (tg.need > freePower * 1.25) continue;              // bu hedef şu an ALINAMAZ → komutanları boşa harcama (atla, başka cepheye)
        let force = 0, took = false;
        while (free.length && force < tg.need) {
            const c = storyNearestCommander(free, tg.node.id); if (!c) break;
            free.splice(free.indexOf(c), 1); c._objective = { kind: 'attack', node: tg.node.id };
            const cp = storyCalcCommanderPower(c, st); force += cp; freePower -= cp; took = true;
        }
        if (took) attacked++;
    }
    // 3) KALAN komutanlar: cepheye ilerle
    for (const c of free) c._objective = { kind: 'advance', node: -1 };
}
// Genelkurmay emrini uygula; uyguladıysa true (bireysel fallback çalışmaz)
function storyExecuteObjective(cmd, st) {
    const obj = cmd._objective; if (!obj) return false;
    if (obj.kind === 'advance') return storyCommanderAdvance(cmd, st);
    if (obj.node == null) return false;
    const tgt = storyNode(obj.node), node = storyNode(cmd.node); if (!tgt || !node) return false;
    if (obj.kind === 'defend') {
        if (tgt.owner !== st.id) return false;                 // şehir artık bizde değil → emir geçersiz (fallback)
        if (cmd.node === obj.node) return true;                // savunmadayım → KAL
        const step = storyStepToward(cmd.node, obj.node, st);  // TEK ADIM (zıplama yok); hız acil-savunma sık-kararıyla (2s) sağlanır
        if (step >= 0 && step !== cmd.node) { cmd.node = step; return true; }
        return false;
    }
    if (obj.kind === 'attack') {
        if (tgt.owner === st.id) return false;                 // hedef alınmış → emir geçersiz
        if (node.neighbors.indexOf(obj.node) >= 0) { storyBeginSiege(st, tgt); return true; }   // bitişik → KUŞAT
        const step = storyStepToward(cmd.node, obj.node, st);  // kendi toprağından yaklaş
        if (step >= 0 && step !== cmd.node) { cmd.node = step; return true; }
        return false;
    }
    return false;
}
function storyAICommanderTick() {
    if (STORY.battleCtx) return;
    for (const st of STORY.states) {
        if (!st.gov) continue;                                   // OYUNCU devleti DAHİL: ek komutanlar özerk (savun/kuşat/ilerle); STORY.commander zaten gov'da değil (oyuncu kontrol eder)
        if ((st._nextStaff || 0) <= STORY.clock) { st._nextStaff = STORY.clock + STAFF_REPLAN; storyStaffPlan(st); }   // 1.3 GENELKURMAY: komutanları hedeflere dağıt
        for (const cmd of st.gov.commanders.slice()) {           // slice: tick içinde dizi değişse de güvenli
            if ((cmd._nextT || 0) > STORY.clock) continue;
            cmd._nextT = STORY.clock + 6 + Math.random() * 3;     // 6-9s kişisel cooldown → hepsi aynı anda saldırmaz
            storyCommanderDecide(cmd, st);
            if (cmd._objective && cmd._objective.kind === 'defend' && cmd.node !== cmd._objective.node) cmd._nextT = STORY.clock + 2;   // ACİL SAVUNMA: yolda → hızlı tekrar (yetişsin)
            if (STORY.battleCtx) return;                          // oyuncu düellosu açıldı → tick'i durdur
        }
    }
}
function storyPushBattle(cmd, won) {
    if (!cmd.recentBattles) cmd.recentBattles = [];
    cmd.recentBattles.push(won ? 1 : 0);
    if (cmd.recentBattles.length > 3) cmd.recentBattles.shift();
}
// AI-vs-AI: SOYUT çözüm (düello/confirm YOK), sadece log
// Komutanı oyundan KALDIR (öl). Oyuncu jetonu (STORY.commander) ASLA ölmez.
const CMD_DEATH_ON_LOSS = 0.45;  // yenilen komutanın ölme olasılığı (yoksa yaralı çekilir) → kayıplar gerçek bedel + düşman ordusu kalıcı erir (takviye dengeler)
function storyKillCommander(cmd, st) {
    if (!cmd || cmd === STORY.commander || cmd.isPlayer) return false;
    const list = (st && st.gov && st.gov.commanders) || null;
    if (list) { const i = list.indexOf(cmd); if (i >= 0) list.splice(i, 1); }
    return true;
}
function storyResolveAIBattle(cmd, st, target) {
    const tgtSt = storyState(target.owner); if (!tgtSt) return;
    const atk = storyCalcCommanderPower(cmd, st), def = storyCalcDefenseStrength(target, tgtSt);
    const win = Math.max(0.25, Math.min(0.90, atk / (atk + def * 1.15)));
    if (cmd.res) cmd.res.manpower = Math.max(0, cmd.res.manpower - 30);   // savaş maliyeti (kasa erir → snowball freni)
    const hit = Math.random() < win;
    storyPushBattle(cmd, hit);
    if (hit) {
        target.owner = st.id; cmd.node = target.id;              // node.owner tek-gerçek-kaynak + jeton senkron
        st.welfare = Math.min(100, st.welfare + 1); tgtSt.welfare = Math.max(0, tgtSt.welfare - 3);
        cmd.loyalty = Math.min(100, (cmd.loyalty == null ? 60 : cmd.loyalty) + 3);
        for (const dc of ((tgtSt.gov ? tgtSt.gov.commanders : []).slice())) if (dc.node === target.id) {   // savunan komutan: ÖLÜR ya da kaçar
            if (Math.random() < CMD_DEATH_ON_LOSS) { storyKillCommander(dc, tgtSt); if (Math.random() < 0.5) storyLog(`☠️ ${dc.name} (${tgtSt.name}), ${target.name} savunmasında düştü.`); }
            else { const safe = target.neighbors.filter(n => { const sn = storyNode(n); return sn && sn.owner === tgtSt.id; }); if (safe.length) dc.node = safe[Math.floor(Math.random() * safe.length)]; dc.loyalty = Math.max(20, (dc.loyalty == null ? 60 : dc.loyalty) - 8); }
        }
        if (Math.random() < 0.5) storyLog(`⚔️ ${cmd.name} (${st.name}) <b>${target.name}</b>'i fethetti.`);
        storySave();
    } else {                                                     // SALDIRAN YENİLDİ → ÖLÜR ya da yaralı çekilir
        if (Math.random() < CMD_DEATH_ON_LOSS) { storyKillCommander(cmd, st); if (Math.random() < 0.5) storyLog(`☠️ ${cmd.name} (${st.name}), ${target.name} önünde bozguna uğrayıp düştü.`); }
        else { const safe = target.neighbors.filter(n => { const sn = storyNode(n); return sn && sn.owner === st.id; }); if (safe.length) cmd.node = safe[Math.floor(Math.random() * safe.length)]; cmd.loyalty = Math.max(0, (cmd.loyalty == null ? 60 : cmd.loyalty) - 5); }
        st.welfare = Math.max(0, st.welfare - 1);
    }
}
// AI komutan OYUNCUYA saldırır → SAVUNMA düellosu (tek kapı + 90s throttle, spam önleme)
function storyTriggerPlayerDefense(cmd, st, pNode, force) {
    if (!pNode || pNode.owner !== STORY.playerStateId) return;   // SADECE oyuncunun şehrine saldırı → düello
    if (STORY.battleCtx) return;
    if (!force && STORY.clock - (STORY._lastPlayerInvasion || 0) < 90) return;   // kuşatma olgunlaşması (force) throttle'ı atlar
    STORY._lastPlayerInvasion = STORY.clock;
    storyLog(`🛡️ ${st.name} komutanı ${cmd.name}, ${pNode.name} bölgene saldırıyor!`);
    if (confirm(`🛡️ SAVUNMA!\n\n${cmd.name} (${st.name}) ${pNode.name} bölgene saldırıyor.\n\nTamam = SAVUN (düello)\nİptal = bölgeyi savaşmadan bırak`)) {
        storyLaunchDefense(pNode.id, st.id, cmd.node);
    } else {
        const me = storyPlayerState();
        const nb = pNode.neighbors.map(storyNode).find(x => x && x.owner === me.id);   // kaybedilen şehirden komşu dost şehre çekil
        const fb = STORY.nodes.find(n => n.owner === me.id);
        const safe = nb ? nb.id : (fb ? fb.id : pNode.id);
        if (STORY.commander.node === pNode.id) STORY.commander.node = safe;
        for (const c of (me.gov ? me.gov.commanders : [])) if (c.node === pNode.id) c.node = safe;   // takviye eden dost komutanlar da çekilir
        pNode.owner = st.id; cmd.node = pNode.id; pNode._siege = null;
        me.reputation = Math.max(0, me.reputation - 1); me.welfare = Math.max(0, me.welfare - 4);
        storyLog(`🏳️ ${pNode.name} savaşmadan ${st.name}'e bırakıldı (-itibar, -refah).`);
        storySave();
    }
}
// ── KUŞATMA (şehir hemen düşmez; takviye penceresi açılır) ──────────────────
const SIEGE_TIME = 18;   // saniye: kuşatma olgunlaşması (savunan komutanların ZORUNLU YÜRÜYÜŞle yetişmesine yetecek süre)
// yakında (≤3 adım, kendi toprağı) KUŞATILAN dost şehir varsa: oraya doğru 1 adım (oradaysa kal=savun); yoksa -1
function storyReinforceStep(cmd, st) {
    const start = cmd.node, sNode = storyNode(start);
    if (sNode && sNode.owner === st.id && sNode._siege && sNode._siege.by !== st.id) return start;   // burası kuşatılıyor → savun
    const parent = {}; parent[start] = start; const dep = {}; dep[start] = 0; const q = [start]; let goal = null;
    while (q.length && goal == null) {
        const cur = q.shift(); if (dep[cur] >= 3) continue;
        const node = storyNode(cur); if (!node) continue;
        for (const nb of node.neighbors) {
            const nn = storyNode(nb); if (!nn || nn.owner !== st.id || (nb in parent)) continue;
            parent[nb] = cur; dep[nb] = dep[cur] + 1;
            if (nn._siege && nn._siege.by !== st.id) { goal = nb; break; }
            q.push(nb);
        }
    }
    if (goal == null) return -1;
    let step = goal; while (parent[step] !== start) step = parent[step];
    return step;
}
function storyBeginSiege(st, target) {
    if (target._siege) return;                                  // zaten kuşatma altında
    target._siege = { by: st.id, since: STORY.clock };
    storyLog(`🏰 ${st.name}, <b>${target.name}</b> (${(storyState(target.owner) || {}).name || '?'}) şehrini KUŞATMAYA aldı! — savunmaya koşun.`);
    storySave();
}
// olgunlaşan kuşatmaları çöz (storyAdvance her ~2.5sn çağırır)
function storySiegeTick() {
    if (STORY.battleCtx) return;
    for (const node of STORY.nodes) {
        if (!node._siege) continue;
        const byState = storyState(node._siege.by);
        const besiegers = byState ? storyStateCommanders(byState).filter(c => c.node === node.id || node.neighbors.indexOf(c.node) >= 0) : [];
        if (!byState || !besiegers.length || node.owner === node._siege.by) { node._siege = null; continue; }   // kuşatan kalmadı/şehir alındı → kalk
        if (STORY.clock - node._siege.since < SIEGE_TIME) continue;   // olgunlaşmadı (takviye penceresi)
        storyResolveSiege(node, byState, besiegers);
        if (STORY.battleCtx) return;
    }
}
function storyResolveSiege(node, byState, besiegers) {
    if (!node || !node.neighbors || !byState) { if (node) node._siege = null; return; }   // bozuk düğüm güvenliği
    const atk = besiegers.reduce((a, c) => a + storyCalcCommanderPower(c, byState), 0);
    const defState = storyState(node.owner);
    const def = storyCalcDefenseStrength(node, defState);
    let lead = besiegers[0], lp = storyCalcCommanderPower(besiegers[0], byState);
    for (const c of besiegers) { const pw = storyCalcCommanderPower(c, byState); if (pw > lp) { lp = pw; lead = c; } }
    for (const c of besiegers) if (c.res) c.res.manpower = Math.max(0, c.res.manpower - 25);   // kuşatma yıpratması
    if (atk <= def * 1.12) {                                     // SAVUNMA DAYANDI → kuşatma KIRILDI (savunan lehine kenar → takviye anlamlı, snowball freni)
        node._siege = null;
        for (const c of besiegers) { c.loyalty = Math.max(0, (c.loyalty == null ? 60 : c.loyalty) - 3); storyPushBattle(c, false); }
        storyLog(`🛡️ <b>${node.name}</b> kuşatması KIRILDI — ${(defState || {}).name || 'savunma'} püskürttü!`);
        storySave();
        return;
    }
    storyPushBattle(lead, true);
    const pid = STORY.playerStateId;
    // DÜELLO YALNIZCA SENİN JETONUN (STORY.commander) bu şehirde/yanındaysa olur; her şey aynı kural (tüm devletler soyut)
    const scAdj = STORY.commander && (STORY.commander.node === node.id || node.neighbors.indexOf(STORY.commander.node) >= 0);
    if (node.owner === pid && scAdj) {                          // SENİN şehrin + jetonun orada → SAVUNMA düellosu (birleşik)
        if (STORY.clock - (STORY._lastPlayerInvasion || 0) < 15) return;   // confirm spam önle (kuşatma bekler)
        node._siege = null;
        storyTriggerPlayerDefense(lead, byState, node, true);
    } else if (byState.id === pid && scAdj) {                   // SEN kuşatıyorsun + jetonun orada → ASALT düellosu (birleşik)
        node._siege = null;
        storyLaunchBattle(node.id);
    } else {                                                     // jetonun UZAKTA / AI-vs-AI → SOYUT (düello YOK, "üzerinde olmadığın şehir" teklifi gelmez)
        if (node.owner === pid) { defState.reputation = Math.max(0, defState.reputation - 1); storyLog(`💥 <b>${node.name}</b> savunmasız düştü — jetonun uzaktaydı.`); }
        storySiegeConquer(node, byState, lead, defState);
    }
}
function storySiegeConquer(node, byState, lead, defState) {
    node._siege = null;
    node.owner = byState.id; lead.node = node.id;
    if (typeof storyCaptureNodePool === 'function') storyCaptureNodePool(node);   // kuşatma düşünce şehirdeki ordu da dağılır
    byState.welfare = Math.min(100, byState.welfare + 1); if (defState) defState.welfare = Math.max(0, defState.welfare - 3);
    lead.loyalty = Math.min(100, (lead.loyalty == null ? 60 : lead.loyalty) + 4);
    if (defState && defState.gov) for (const dc of defState.gov.commanders.slice()) if (dc.node === node.id) {   // savunan: ÖLÜR ya da kaçar
        if (Math.random() < CMD_DEATH_ON_LOSS) { storyKillCommander(dc, defState); }
        else { const safe = node.neighbors.filter(n => { const sn = storyNode(n); return sn && sn.owner === defState.id; }); if (safe.length) dc.node = safe[Math.floor(Math.random() * safe.length)]; dc.loyalty = Math.max(20, (dc.loyalty == null ? 60 : dc.loyalty) - 6); }
    }
    storyLog(`🏰 ${byState.name}, <b>${node.name}</b>'i kuşatmayla DÜŞÜRDÜ.`);
    storySave();
}
// ── SADAKAT / FİRAR / DARBE ──
function storyApplyLoyaltyDrift() {
    for (const st of STORY.states) {
        if (!st.gov) continue;
        const wf = (st.welfare - 50) * 0.02;                     // refah yüksek→sadakat artar
        for (const cmd of st.gov.commanders) {
            if (cmd === STORY.commander) continue;               // oyuncu jetonu sabit (100)
            const rb = cmd.recentBattles || [];
            const wr = rb.length ? (rb.reduce((a, b) => a + b, 0) / rb.length - 0.5) * 0.3 : 0;   // galibiyet→sadakat
            const per = { agresif: -0.10, dengeli: 0, savunmacı: 0.15, fırsatçı: -0.12 }[cmd.personality] || 0;
            const dip = ((cmd.skills && cmd.skills.diplomat) || 0) * 0.05;   // DİPLOMAT: sadakat istikrarı (firar/darbe direnci)
            // TABAN EROZYON -0.15 → -0.04: eski değerde başlangıç refahında (50, yani wf=0) net drift
            // NEGATİF kalıyordu ve komutanlar hiçbir şey yapılmasa bile 1.5-3 dakikada firar eşiğine
            // (35) iniyordu. Sadakat kaybı KÖTÜ YÖNETİMİN sonucu olmalı, varsayılan durum değil.
            let drift = -0.04 + wf + wr + per + dip;
            // KONSEY: Propaganda/Sansür/Aristokrat Subaylık + anayasa → NEGATİF drift'i yumuşatır
            // (pozitif drift'e dokunmaz: sadakat kazanmayı ucuzlatmaz, kaybetmeyi zorlaştırır)
            const hold = (st._techBonus && st._techBonus.loyaltyHold) || 1;
            if (drift < 0 && hold < 1) drift *= hold;
            let nl = (cmd.loyalty == null ? 60 : cmd.loyalty) + drift * 0.5;   // dt=0.5
            // SADAKAT TABANI: devlet ayakta ve refah makulse komutan bir eşiğin altına düşmez.
            // Bu olmadan uzun barış dönemleri tüm kadroyu eritiyordu.
            if (st.welfare >= 45) nl = Math.max(nl, 38);
            cmd.loyalty = Math.max(0, Math.min(100, nl));
        }
    }
}
function storyStateStr(st) { return st.res.oil + st.res.manpower + st.res.points; }
function storyStateHealth(st) { return (st.welfare + st.reputation * 10) / 2; }
function storyCommanderDefectTo(cmd, fromSt, toSt, atNode) {
    const i = fromSt.gov.commanders.indexOf(cmd); if (i >= 0) fromSt.gov.commanders.splice(i, 1);
    if (!toSt.gov) toSt.gov = { leader: 'ai', commanders: [] };
    toSt.gov.commanders.push(cmd);
    cmd.loyalty = 55; cmd.recentBattles = []; cmd._nextT = 0; cmd._lastDefect = STORY.clock;
    if (atNode != null) cmd.node = atNode;
}
// 0 ŞEHİRLİK devlet → komutanları teslim olur (bulundukları şehrin sahibine katılır) / sahipsizse dağılır
// KOMUTAN TAKVİYESİ: ölümle tükenmesin — şehri olan devletler YAVAŞ yeni komutan yetiştirir (infinite değil: tavanlı + seyrek + refah-kapılı)
// KOMUTAN TAKVİYESİ — konsey/yönetici boşalan kadroyu doldurur.
// ESKİ FORMÜL ÖLÜM SARMALI ÜRETİYORDU: tavan `3 + şehir/4` idi, 19 şehirde 7 çıkıyordu —
// oysa kampanya 10 komutanla başlıyor. `cur >= cap` olduğu için takviye HİÇ tetiklenmiyordu;
// komutanlar öldükçe şehir de kaybediliyor, tavan daha da düşüyor, kadro bir daha toparlanamıyordu.
// Yeni formül başlangıç kadrosuyla uyumlu ve TABANI var: devlet ne kadar küçülürse küçülsün
// çekirdek kadro (4) korunur, böylece geri dönüş mümkün olur.
const CMD_CAP_MIN = 4;
function storyCommanderCap(st) {
    const owned = STORY.nodes.filter(n => n.owner === st.id).length;
    // KONSEY: Genelkurmay tech'i, Halk Komiserleri kanunu ve anayasa kadroyu genişletir/daraltır
    const extra = (st._techBonus && st._techBonus.cmdCap) || 0;
    return Math.max(CMD_CAP_MIN, Math.min(12, 4 + Math.floor(owned / 3) + extra));
}
function storyReplenishCommanders() {
    for (const st of STORY.states) {
        if (!st.gov) continue;
        const owned = STORY.nodes.filter(n => n.owner === st.id); if (!owned.length) continue;
        const cur = storyStateCommanders(st).length;
        const cap = storyCommanderCap(st);
        if (cur >= cap) continue;
        // Kadro kritikse (yarıdan az) refah şartı aranmaz ve zar atılmaz — çöküş engellenir.
        const critical = cur < Math.ceil(cap / 2);
        if (!critical) {
            if (st.welfare < 20) continue;              // sağlıklı kadroda çöken devlet mobilize edemez
            if (Math.random() > 0.5) continue;          // seyrek takviye
        }
        const capId = (STORY._capitals && STORY._capitals[st.id] != null) ? STORY._capitals[st.id] : null;
        const at = (capId != null && owned.some(n => n.id === capId)) ? capId : owned[0].id;
        const nc = storyCreateCommander(st.id, at);
        if (nc && st.isPlayer) storyLog(`🎖️ Konsey yeni komutan atadı: <b>${nc.name}</b> (kadro ${cur + 1}/${cap}).`);
        else if (nc && Math.random() < 0.4) storyLog(`🎖️ ${st.name} yeni komutan yetiştirdi: ${nc.name}.`);
    }
}
function storyDissolveDeadStates() {
    for (const st of STORY.states) {
        if (st.isPlayer || !st.gov || !st.gov.commanders.length) continue;
        if (STORY.nodes.some(n => n.owner === st.id)) continue;   // hâlâ şehri var
        for (const cmd of st.gov.commanders.slice()) {
            const node = storyNode(cmd.node), conq = node ? storyState(node.owner) : null;
            if (conq && !conq.isPlayer && conq.gov) { storyCommanderDefectTo(cmd, st, conq, cmd.node); cmd.loyalty = 45; }
            else { const i = st.gov.commanders.indexOf(cmd); if (i >= 0) st.gov.commanders.splice(i, 1); }
        }
        if (!st.gov.commanders.length) storyLog(`🏴 ${st.name} tarih sahnesinden silindi.`);
    }
}
function storyApplyDefections() {
    for (const st of STORY.states) {
        if (!st.gov) continue;
        for (const cmd of st.gov.commanders.slice()) {           // slice: iterasyon sırasında değişir
            if (cmd === STORY.commander) continue;
            if ((cmd.loyalty == null ? 60 : cmd.loyalty) >= 35) continue;
            if (STORY.clock - (cmd._lastDefect == null ? -999 : cmd._lastDefect) < 120) continue;   // firar cooldown (ping-pong önle)
            const node = storyNode(cmd.node); if (!node) continue;
            let best = null, bestScore = 1.3;                    // eşik 1.3 (daha güçlü+sağlıklı komşuya)
            for (const nb of node.neighbors) {
                const nn = storyNode(nb); if (!nn || nn.owner === st.id) continue;
                const ts = storyState(nn.owner); if (!ts || ts.isPlayer) continue;   // oyuncuya firar YOK (MVP)
                const score = storyStateStr(ts) / Math.max(1, storyStateStr(st)) + storyStateHealth(ts) / Math.max(1, storyStateHealth(st));
                if (score > bestScore) { bestScore = score; best = { ts, node: nb }; }
            }
            if (best) { const old = st.name; storyCommanderDefectTo(cmd, st, best.ts, best.node); storyLog(`🚪 ${cmd.name}, ${old}'den <b>${best.ts.name}</b>'e firar etti!`); storySave(); }
        }
    }
}
function storyApplyCoups() {
    for (const st of STORY.states) {
        if (!st.gov) continue;
        const disloyal = st.gov.commanders.filter(c => c !== STORY.commander && (c.loyalty == null ? 60 : c.loyalty) < 40);
        if (disloyal.length < 3) continue;
        if (disloyal.some(c => c.skills && c.skills.diplomat >= 4)) continue;   // güçlü diplomat koalisyonu böler (sadık tutar)
        const avg = disloyal.reduce((a, c) => a + c.loyalty, 0) / disloyal.length;
        if (st.isPlayer && st.gov.leader === 'player' && STORY.clock - (STORY._coupWarnT == null ? -999 : STORY._coupWarnT) > 25) {
            STORY._coupWarnT = STORY.clock;                       // darbe ÖNCESİ adil uyarı (oyuncuya tepki şansı)
            storyFlash('⚠️ Komutanların huzursuz (düşük sadakat) — refahı yükselt yoksa DARBE riski!');
        }
        if (Math.random() >= 0.2 + ((40 - avg) / 40) * 0.5) continue;   // taban %30→%20 (oyuncuya adil)
        if (st.isPlayer && st.gov.leader === 'player') {         // ── OYUNCU DARBESİ (dramatik risk) ──
            st.gov.leader = 'ai'; st.isAdmin = false;
            st.reputation = Math.max(0, st.reputation - 4); st.welfare = Math.max(0, st.welfare - 20);
            for (const c of disloyal) c.loyalty = 50;
            storyFlash('🔥 DARBE! Komutan konseyi seni devirdi — yöneticiliği KAYBETTİN. Refahı/sadakati yükselt, yeniden seçil.');
            if (typeof storyCouncilUpdate === 'function') storyCouncilUpdate();
            if (typeof storyPanelUpdate === 'function') storyPanelUpdate();
        } else {                                                 // ── AI DARBESİ: kaos, 1-2 sınır şehri komşuya geçer ──
            let flipped = 0;
            for (const n of STORY.nodes) {
                if (n.owner !== st.id || flipped >= 2) continue;
                const nb = n.neighbors.map(storyNode).find(m => m && m.owner !== st.id && !((storyState(m.owner) || {}).isPlayer));
                if (nb) { n.owner = nb.owner; flipped++; }
            }
            for (const c of disloyal) c.loyalty = 50;
            st.welfare = Math.max(0, st.welfare - 8);
            if (flipped) storyLog(`⚔️ ${st.name}'de DARBE — kaos, ${flipped} bölge kontrolden çıktı.`);
        }
        storySave();
    }
}

// ── RENDER (rAF, gameLoop story dalından çağrılır) ───────────────────────────
function storyWorldFrame(timestamp) {
    const last = STORY._lastFrameT || timestamp;
    let dt = (timestamp - last) / 1000;
    STORY._lastFrameT = timestamp;
    if (dt > 0.5) dt = 0.5;          // sekme arka plandayken sıçramayı engelle
    storyAdvance(dt);
    // KONSEY açıkken ~0.5sn'de bir paneli tazele (yaşayan-dünya değerleri; render-throttle'a binmesin, titremesin)
    if (STORY._councilOpen || STORY._armyOpen || STORY._techOpen || STORY._cityOpen) { STORY._accCouncil = (STORY._accCouncil || 0) + dt; if (STORY._accCouncil >= 0.5) { STORY._accCouncil = 0; if (STORY._councilOpen) storyCouncilUpdate(); if (STORY._armyOpen) storyArmyUpdate(); if (STORY._techOpen) storyTechUpdate(); if (STORY._cityOpen) storyCityUpdate(); } }
    // ~20fps render throttle (harita çoğunlukla durağan; pulse animasyonu için sürekli)
    if (timestamp - (STORY._lastRenderT || 0) >= 50) {
        STORY._lastRenderT = timestamp;
        storyRender();
    }
}

function storyResize() {
    const cv = document.getElementById('storyCanvas');
    if (!cv) return;
    const w = cv.clientWidth || 800, h = cv.clientHeight || 600;
    if (cv.width !== w) cv.width = w;
    if (cv.height !== h) cv.height = h;
}
// kamerayı dünya sınırlarında tut (zoom dahil görünen alan = w/zoom; dünya küçükse ortala)
function storyClampCam(w, h) {
    const vw = w / storyCam.zoom, vh = h / storyCam.zoom;
    if (STORY_WORLD_W <= vw) storyCam.x = (STORY_WORLD_W - vw) / 2;
    else storyCam.x = Math.max(0, Math.min(STORY_WORLD_W - vw, storyCam.x));
    if (STORY_WORLD_H <= vh) storyCam.y = (STORY_WORLD_H - vh) / 2;
    else storyCam.y = Math.max(0, Math.min(STORY_WORLD_H - vh, storyCam.y));
}
function storyCenterCamOnPlayer() {
    const n = storyNode(STORY.commander.node), cv = document.getElementById('storyCanvas');
    if (!n || !cv) return;
    storyResize();
    storyCam.x = n.lx * STORY_WORLD_W - (cv.width / storyCam.zoom) / 2;
    storyCam.y = n.ly * STORY_WORLD_H - (cv.height / storyCam.zoom) / 2;
    storyClampCam(cv.width, cv.height);
}

// Düğüm DÜNYA-konumu → EKRAN (kamera kaydır + zoom ölçek)
function storyNodePixel(n) {
    return { x: (n.lx * STORY_WORLD_W - storyCam.x) * storyCam.zoom, y: (n.ly * STORY_WORLD_H - storyCam.y) * storyCam.zoom };
}

// ── İKİ-KATMAN HARİTA (dinamik dünya): ───────────────────────────────────────────────────────
//  (1) TERRAIN tabanı — KULLANICININ çizdiği yazısız/politikasız fiziksel harita (terrain.png);
//      yoksa prosedürel terrain yedeği. STATİK.
//  (2) DİNAMİK POLİTİK katman — her ülke (Voronoi bölge) o anki SAHİBİNİN rengiyle yarı-saydam boyanır;
//      fetihte renk anında değişir → imparatorluklar büyür/küçülür. Sahiplik değişince yeniden çizilir.
//  Düşük-çöz hücre → nearest-neighbor upscale = chunky pixel. BÜYÜK dünya + KAMERA (sürükle/WASD).
let STORY_GW = 320, STORY_GH = 180;                  // politik/terrain hücre çözünürlüğü (terrain resmi gelince RESMİN çözünürlüğüne ayarlanır)
let STORY_WORLD_W = 3200, STORY_WORLD_H = 1800;      // dünya piksel boyutu (terrain resmi gelince oranına göre güncellenir)
const storyCam = { x: 0, y: 0, zoom: 1 };            // kamera: sol-üst köşe (dünya px) + zoom (fare tekerleği)

// (Eski terrain.png resim-yükleyici KALDIRILDI — file:// üzerinde getImageData "tainted canvas" hatası verdi.
//  Artık kara/deniz GÖMÜLÜ STORY_TERRAIN maskesinden okunur, terrain motorda boyanır → her yerde güvenli.)

// ülke kara-yarıçapı (normalize, prosedürel yedek için): büyükler geniş, adalar küçük → kıta + deniz (36 bölge)
const EUROPE_LAND_R = [
    0.034, 0.040, 0.040, 0.058, 0.060, 0.032, 0.052, 0.032, 0.030, 0.050,   //0-9
    0.058, 0.052, 0.052, 0.038, 0.050, 0.034, 0.034, 0.040, 0.040, 0.050,   //10-19
    0.040, 0.042, 0.046, 0.060, 0.085, 0.060, 0.044, 0.030, 0.040, 0.058,   //20-29
    0.080, 0.058, 0.066, 0.040, 0.070, 0.052                                //30-35
];

function storyHexRgb(hex) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [136, 136, 136];
}
// prosedürel arazi rengi (terrain.png yoksa): kuzey yeşil → güney çöl + dağ kahve + pixel doku
function storyTerrainColor(ny, hsh) {
    if (hsh > 0.90) return [120, 102, 70];
    if (ny > 0.70) { const v = 0.88 + hsh * 0.22; return [Math.min(255, 202 * v | 0), Math.min(255, 172 * v | 0), Math.min(255, 110 * v | 0)]; }
    const north = Math.max(0, 0.32 - ny) * 1.2, v = 0.82 + hsh * 0.26;
    return [Math.min(255, (92 - north * 55) * v | 0), Math.min(255, (142 - north * 36) * v | 0), Math.min(255, (80 - north * 18) * v | 0)];
}
function storyHash(x, y) { let h = (x * 73856093) ^ (y * 19349663); h = (h ^ (h >>> 13)) >>> 0; return (h % 1024) / 1024; }

// KARA-MASKE + ülke bölgeleri (her hücre = ülke-id ya da -1 deniz).
//  GÖMÜLÜ STORY_TERRAIN varsa (kullanıcının çizdiği harita, terrainData.js) ondan → getImageData YOK = file:// güvenli.
//  Yoksa PROSEDÜREL radius-blob yedeği.
function storyBuildLandGrid() {
    const nodes = STORY.nodes;
    if (typeof STORY_TERRAIN !== 'undefined' && STORY_TERRAIN.land) {
        const w = STORY_TERRAIN.w, h = STORY_TERRAIN.h, mask = STORY_TERRAIN.land;
        STORY_GW = w; STORY_GH = h;
        STORY_WORLD_W = 3000; STORY_WORLD_H = Math.round(3000 * h / w);   // dünya = harita oranı, ~3000 geniş → NN upscale
        const grid = new Array(w * h).fill(-1);
        for (let gy = 0; gy < h; gy++) {
            for (let gx = 0; gx < w; gx++) {
                if (mask.charCodeAt(gy * w + gx) !== 49) continue;        // '1' = kara
                const nx = (gx + 0.5) / w, ny = (gy + 0.5) / h;
                let best = -1, bd = Infinity;
                for (const n of nodes) { const dx = nx - n.lx, dy = ny - n.ly, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = n.id; } }
                grid[gy * w + gx] = best;
            }
        }
        STORY._landGrid = grid; STORY._ownerKey = null; STORY._terrainCache = null;
        return;
    }
    // PROSEDÜREL yedek (gömülü harita yoksa): ülke radius-blob → kıta + deniz
    const grid = new Array(STORY_GW * STORY_GH).fill(-1);
    for (let gy = 0; gy < STORY_GH; gy++) {
        for (let gx = 0; gx < STORY_GW; gx++) {
            const nx = (gx + 0.5) / STORY_GW, ny = (gy + 0.5) / STORY_GH;
            let best = -1, bestD = Infinity;
            for (const n of nodes) { const dx = nx - n.lx, dy = ny - n.ly, d = dx * dx + dy * dy; if (d < bestD) { bestD = d; best = n.id; } }
            if (best < 0) continue;
            const r = (EUROPE_LAND_R[best] != null) ? EUROPE_LAND_R[best] : 0.05;
            const jitter = (storyHash(gx, gy) - 0.5) * 0.024;
            if (Math.sqrt(bestD) <= r + jitter) grid[gy * STORY_GW + gx] = best;
        }
    }
    STORY._landGrid = grid; STORY._ownerKey = null; STORY._terrainCache = null;
}

// (1) TERRAIN tabanı — prosedürel (terrain.png yoksa). STATİK (arazi rengi, sahip YOK).
function storyEnsureTerrainCache() {
    if (STORY._terrainCache) return STORY._terrainCache;
    if (!STORY._landGrid) storyBuildLandGrid();
    const cv = document.createElement('canvas'); cv.width = STORY_GW; cv.height = STORY_GH;
    const g = cv.getContext('2d'); const grid = STORY._landGrid;
    const at = (x, y) => (x < 0 || y < 0 || x >= STORY_GW || y >= STORY_GH) ? -1 : grid[y * STORY_GW + x];
    for (let gy = 0; gy < STORY_GH; gy++) for (let gx = 0; gx < STORY_GW; gx++) {
        const id = grid[gy * STORY_GW + gx], hsh = storyHash(gx * 3 + 1, gy * 3 + 7);
        if (id < 0) {
            const coast = (at(gx - 1, gy) >= 0 || at(gx + 1, gy) >= 0 || at(gx, gy - 1) >= 0 || at(gx, gy + 1) >= 0);
            if (coast) g.fillStyle = 'rgb(64,118,158)';
            else { const s = Math.floor(hsh * 9); g.fillStyle = `rgb(${20 + s},${60 + s},${92 + s})`; }
        } else { const t = storyTerrainColor((gy + 0.5) / STORY_GH, hsh); g.fillStyle = `rgb(${t[0]},${t[1]},${t[2]})`; }
        g.fillRect(gx, gy, 1, 1);
    }
    STORY._terrainCache = cv; return cv;
}

// (2) DİNAMİK POLİTİK katman — her kara hücresi SAHİBİNİN rengiyle yarı-saydam; imparatorluk sınırı koyu+opak;
//  deniz şeffaf (terrain görünür). Sahiplik değişince yeniden çizilir (fetih → renk anında değişir).
function storyEnsureOwnerOverlay() {
    if (!STORY._landGrid) storyBuildLandGrid();
    const key = STORY.nodes.map(n => n.owner).join(',');
    if (STORY._ownerCache && STORY._ownerKey === key) return STORY._ownerCache;
    let cv = STORY._ownerCache;
    if (!cv) { cv = document.createElement('canvas'); cv.width = STORY_GW; cv.height = STORY_GH; STORY._ownerCache = cv; }
    const g = cv.getContext('2d'); g.clearRect(0, 0, STORY_GW, STORY_GH);
    const grid = STORY._landGrid;
    const ownerAt = (x, y) => { if (x < 0 || y < 0 || x >= STORY_GW || y >= STORY_GH) return -1; const id = grid[y * STORY_GW + x]; return id < 0 ? -1 : STORY.nodes[id].owner; };
    for (let gy = 0; gy < STORY_GH; gy++) for (let gx = 0; gx < STORY_GW; gx++) {
        const id = grid[gy * STORY_GW + gx];
        if (id < 0) continue;                              // deniz → şeffaf (terrain görünür)
        const ow = STORY.nodes[id].owner;
        const oc = storyHexRgb((storyState(ow) || {}).color || '#888888');
        const bord = (ownerAt(gx + 1, gy) !== ow && ownerAt(gx + 1, gy) !== -1) || (ownerAt(gx, gy + 1) !== ow && ownerAt(gx, gy + 1) !== -1)
                  || (ownerAt(gx - 1, gy) !== ow && ownerAt(gx - 1, gy) !== -1) || (ownerAt(gx, gy - 1) !== ow && ownerAt(gx, gy - 1) !== -1);
        if (bord) g.fillStyle = `rgba(${oc[0] * 0.45 | 0},${oc[1] * 0.45 | 0},${oc[2] * 0.45 | 0},0.95)`;  // imparatorluk sınırı
        else g.fillStyle = `rgba(${oc[0]},${oc[1]},${oc[2]},0.40)`;                                          // iç bölge: terrain görünsün
        g.fillRect(gx, gy, 1, 1);
    }
    STORY._ownerKey = key; return cv;
}

function storyRender() {
    const cv = document.getElementById('storyCanvas');
    if (!cv) return;
    storyResize();
    const g = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    storyClampCam(w, h);
    g.clearRect(0, 0, w, h);
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#235a7e'; g.fillRect(0, 0, w, h);   // dünya kenarı boşluğu / deniz zemini
    const z = storyCam.zoom;
    // (1) TERRAIN tabanı — gömülü kullanıcı haritasından (STORY_TERRAIN) prosedürel boyanır; kamera+zoom, crisp
    const terr = storyEnsureTerrainCache();
    g.drawImage(terr, 0, 0, STORY_GW, STORY_GH, -storyCam.x * z, -storyCam.y * z, STORY_WORLD_W * z, STORY_WORLD_H * z);
    // (2) DİNAMİK POLİTİK katman (sahip-rengi yarı-saydam) — terrain üstüne; fetihte renk anında değişir
    const ovl = storyEnsureOwnerOverlay();
    g.drawImage(ovl, 0, 0, STORY_GW, STORY_GH, -storyCam.x * z, -storyCam.y * z, STORY_WORLD_W * z, STORY_WORLD_H * z);
    STORY._imgMode = false;
    // War Room renk işlemi: arazi okunur kalırken amber terminal kontrastına yaklaşır.
    g.fillStyle = 'rgba(2,8,4,0.30)'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,176,0,0.055)'; g.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 60) { g.beginPath(); g.moveTo(gx, 0); g.lineTo(gx, h); g.stroke(); }
    for (let gy = 0; gy < h; gy += 60) { g.beginPath(); g.moveTo(0, gy); g.lineTo(w, gy); g.stroke(); }

    // (3) ŞEHİR/KAYNAK işaretleri (🔴şehir/insan, 🟠petrol, 🟢puan) — dünya konumları, kamera+zoom
    if (typeof STORY_TERRAIN !== 'undefined') {
        const drawMarks = (arr, col, sz) => {
            for (const p of (arr || [])) {
                const sx = (p[0] * STORY_WORLD_W - storyCam.x) * z, sy = (p[1] * STORY_WORLD_H - storyCam.y) * z;
                if (sx < -8 || sy < -8 || sx > w + 8 || sy > h + 8) continue;
                g.fillStyle = '#000'; g.fillRect(sx - sz - 1, sy - sz - 1, 2 * sz + 2, 2 * sz + 2);
                g.fillStyle = col; g.fillRect(sx - sz, sy - sz, 2 * sz, 2 * sz);
            }
        };
        drawMarks(STORY_TERRAIN.oil, '#ff8a00', 2);     // petrol
        drawMarks(STORY_TERRAIN.pts, '#3cdc6e', 2);     // puan
        drawMarks(STORY_TERRAIN.cities, '#ff3636', 2);  // şehir (insan gücü)
    }

    const cmdNode = STORY.commander.node;
    const adj = storyNode(cmdNode) ? storyNode(cmdNode).neighbors : [];

    // KOMUTANIN ulaşabildiği komşu bağlantıları (yeşil=kendi bölge, kırmızı=saldırı) — sade
    const cmdP = storyNode(cmdNode) ? storyNodePixel(storyNode(cmdNode), w, h) : null;
    if (cmdP) {
        g.lineWidth = 2;
        for (const mId of adj) {
            const m = storyNode(mId); const b = storyNodePixel(m, w, h);
            g.strokeStyle = (m.owner === STORY.playerStateId) ? 'rgba(120,235,160,0.5)' : 'rgba(255,90,90,0.6)';
            g.beginPath(); g.moveTo(cmdP.x, cmdP.y); g.lineTo(b.x, b.y); g.stroke();
        }
    }

    // DÜĞÜMLER
    for (const n of STORY.nodes) {
        const p = storyNodePixel(n, w, h);
        const st = storyState(n.owner);
        const isCmd = (n.id === cmdNode);
        const isSelected = (n.id === STORY.selectedNodeId);
        const attackable = (adj.indexOf(n.id) >= 0 && n.owner !== STORY.playerStateId);
        const moveable = (adj.indexOf(n.id) >= 0 && n.owner === STORY.playerStateId);
        // ŞEHİR/BAŞKENT işareti — pixel KARE (sahip rengi + siyah kontur)
        const sq = isCmd ? 9 : 6;
        const px = Math.round(p.x), py = Math.round(p.y);
        g.fillStyle = '#000'; g.fillRect(px - sq - 1, py - sq - 1, 2 * sq + 2, 2 * sq + 2);
        g.fillStyle = st ? st.color : '#888';
        g.fillRect(px - sq, py - sq, 2 * sq, 2 * sq);
        // saldırılabilir → kırmızı nabız kare-halka ; ilerlenebilir → yeşil kare-halka
        if (attackable) {
            const pulse = Math.round(3 + 2 * (1 + Math.sin(STORY.clock * 4 + n.id)));
            g.strokeStyle = 'rgba(255,70,70,0.95)'; g.lineWidth = 2;
            g.strokeRect(px - sq - pulse, py - sq - pulse, 2 * (sq + pulse), 2 * (sq + pulse));
        } else if (moveable) {
            g.strokeStyle = 'rgba(120,235,160,0.75)'; g.lineWidth = 2;
            g.strokeRect(px - sq - 3, py - sq - 3, 2 * (sq + 3), 2 * (sq + 3));
        }
        if (isSelected) {
            const r = sq + 8;
            g.strokeStyle = '#ffb000'; g.lineWidth = 2;
            g.strokeRect(px - r, py - r, r * 2, r * 2);
            g.fillStyle = '#ffe9bf'; g.font = '9px monospace'; g.textAlign = 'center'; g.textBaseline = 'bottom';
            g.fillText('SELECT', px, py - r - 3);
        }
        // (harita üstünde YAZI YOK — kullanıcı isteği; ülke adları yan panelde gösterilir)
        // oyuncu komutanı — şehir merkezinde kısa terminal etiketi
        if (isCmd) {
            g.font = 'bold 8px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillStyle = '#060a06'; g.fillRect(px - 12, py - 5, 24, 10);
            g.fillStyle = '#ffd27a'; g.fillText('CMD', px, py + 1);
        }
    }
    // FAZ-2: TÜM KOMUTANLARI çiz (devlet-renkli küçük token, şehrin üstünde dizili)
    // KUŞATMA göstergesi: kuşatılan şehirde kırmızı çift-halka + terminal etiketi
    for (const node of STORY.nodes) {
        if (!node._siege) continue;
        const sp = storyNodePixel(node);
        g.lineWidth = 2; g.strokeStyle = 'rgba(255,80,40,0.95)';
        g.beginPath(); g.arc(sp.x, sp.y, 10, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = 'rgba(255,80,40,0.45)';
        g.beginPath(); g.arc(sp.x, sp.y, 14, 0, Math.PI * 2); g.stroke();
        g.font = '8px monospace'; g.textAlign = 'center'; g.fillStyle = '#ffce4c';
        g.fillText('SIEGE', sp.x, sp.y - 17);
    }
    const cmdByCity = {};
    for (const st of STORY.states) for (const c of (st.gov && st.gov.commanders ? st.gov.commanders : [])) { if (c.node == null || !storyNode(c.node)) continue; (cmdByCity[c.node] = cmdByCity[c.node] || []).push(st.id); }
    for (const cityId in cmdByCity) {
        const node = storyNode(+cityId); if (!node) continue;
        const cp = storyNodePixel(node); const list = cmdByCity[cityId];
        for (let i = 0; i < list.length; i++) {
            const cx = Math.round(cp.x + (i - (list.length - 1) / 2) * 7), cy = Math.round(cp.y - 13);
            g.beginPath(); g.moveTo(cx, cy - 4); g.lineTo(cx - 4, cy + 4); g.lineTo(cx + 4, cy + 4); g.closePath();
            g.fillStyle = (storyState(list[i]) || {}).color || '#fff'; g.fill();
            g.lineWidth = 1; g.strokeStyle = '#000'; g.stroke();
        }
    }
    // KONSEY: tıklanan komutanın şehrinde yeşil nabız halka (~1.5sn, 30 kare)
    if (STORY._pulse > 0 && STORY._pulseNode != null) {
        const pn = storyNode(STORY._pulseNode);
        if (pn) { const pp = storyNodePixel(pn), t = STORY._pulse / 30, r = 14 + (1 - t) * 24;
            g.strokeStyle = `rgba(76,255,124,${(t * 0.9).toFixed(2)})`; g.lineWidth = 3;
            g.beginPath(); g.arc(pp.x, pp.y, r, 0, Math.PI * 2); g.stroke(); }
        STORY._pulse--;
    }
    storyPanelUpdate();
}

// ── PANEL (HTML, throttled innerHTML) ────────────────────────────────────────
function storyPanelUpdate() {
    const me = storyPlayerState(); if (!me) return;
    const stats = document.getElementById('story-stats');
    if (stats) {
        const myr = (STORY.commander && STORY.commander.res) || { oil: 0, manpower: 0, points: 0 };
        // FAZ-4 TAKVİM: "gün" yerine mevsim+yıl. Konseye kalan süre de burada görünür.
        const date = (typeof storyDateLabel === 'function') ? storyDateLabel() : `GÜN ${1 + Math.floor((STORY.clock || 0) / 60)}`;
        const toCouncil = (typeof YEAR_SECONDS !== 'undefined') ? Math.max(0, (STORY._nextCouncil || 0) - (STORY.clock || 0)) : null;
        const cSoon = toCouncil != null && toCouncil <= 30;
        stats.innerHTML =
            `<div class="story-stat-chip identity" style="--state-color:${me.color}">DEVLET<b>${me.name}</b></div>` +
            `<div class="story-stat-chip">PETROL<b>${Math.floor(myr.oil)}</b></div>` +
            `<div class="story-stat-chip">İNSAN<b>${Math.floor(myr.manpower)}</b></div>` +
            `<div class="story-stat-chip">PUAN<b>${Math.floor(myr.points)}</b></div>` +
            `<div class="story-stat-chip">GAZİ<b>${(STORY.veterans || []).length}</b></div>` +
            `<div class="story-stat-chip wide">TARİH<b>${date}</b></div>` +
            (toCouncil != null ? `<div class="story-stat-chip${cSoon ? ' urgent' : ''}">KONSEY<b>${(toCouncil / YEAR_SECONDS).toFixed(1)} yıl</b></div>` : '');
    }
    const info = document.getElementById('story-node-info');
    const action = document.getElementById('story-action-btn');
    if (info) {
        const cmd = STORY.commander ? storyNode(STORY.commander.node) : null;
        const selected = storyNode(STORY.selectedNodeId) || cmd;
        const owner = selected ? storyState(selected.owner) : null;
        const adjacent = !!(cmd && selected && cmd.neighbors.indexOf(selected.id) >= 0);
        const current = !!(cmd && selected && cmd.id === selected.id);
        const hostile = !!(selected && selected.owner !== me.id);
        const capital = !!(selected && STORY._capitals && STORY._capitals.indexOf(selected.id) >= 0);
        const type = selected ? (selected._siege ? 'KUŞATMA' : capital ? 'KARARGAH' : selected.oil > 0 ? 'PETROL MERKEZİ' : selected.pts > 0 ? 'SANAYİ MERKEZİ' : 'ŞEHİR') : '-';
        const stateText = current ? 'KOMUTA MERKEZİ' : adjacent ? (hostile ? 'AKTİF CEPHE' : 'ERİŞİLEBİLİR') : 'MENZİL DIŞI';
        const stateColor = current ? '#4ade80' : adjacent ? (hostile ? '#ff6b6b' : '#ffb000') : '#6e6330';
        const mapName = (typeof MAPS !== 'undefined' && selected && MAPS[selected.mapId]) ? MAPS[selected.mapId].name : `Saha ${(selected?.mapId || 0) + 1}`;
        const foeValue = hostile && owner ? storyEnemyForceBudget(owner.id, selected.id) : null;
        const foeTotal = foeValue ? Math.floor(foeValue.oil + foeValue.manpower + foeValue.points) : 0;
        const reward = hostile ? '+120 puan · fetih · veteran ilerlemesi' : current ? 'Komuta ve ikmal merkezi' : 'Güvenli intikal';
        info.innerHTML = selected ?
            `<div class="story-node-heading"><b>${selected.name}</b><span class="story-node-state" style="color:${stateColor}">${stateText}</span></div>` +
            `<div class="story-brief-grid">` +
                `<div class="story-brief-cell">TÜR<b>${type}</b></div>` +
                `<div class="story-brief-cell">KONTROL<b style="color:${owner?.color || '#ffe9bf'}">${owner?.name || '-'}</b></div>` +
                `<div class="story-brief-cell">MUHAREBE SAHASI<b>${mapName}</b></div>` +
                `<div class="story-brief-cell">GARNİZON / GÜÇ<b>${hostile ? `${selected.garrison || 0} / ~${foeTotal}` : (selected.garrison || 0)}</b></div>` +
            `</div><div class="story-brief-note">BEKLENEN SONUÇ: ${reward}<br>DOKTRİN: ${(STORY.cfg.doctrine || 'combined').toUpperCase()}</div>` :
            `<div class="story-brief-note">Haritada bir şehir seçerek harekât brifingini aç.</div>`;

        if (action) {
            action.disabled = current || !adjacent;
            action.classList.toggle('hostile', hostile && adjacent);
            action.textContent = current ? 'KOMUTA MERKEZİNDESİN' : !adjacent ? 'MENZİL DIŞI' : hostile ? 'HAREKÂTA GEÇ' : 'BÖLGEYE İLERLE';
        }
    }
    const log = document.getElementById('story-log');
    if (log) log.innerHTML = STORY.log.map(l => `<div class="story-log-row">${l}</div>`).join('');
    const pb = document.getElementById('story-pause-btn');
    if (pb) { pb.textContent = STORY.paused ? 'DEVAM' : 'DURAKLAT'; pb.title = STORY.paused ? 'Devam' : 'Duraklat'; }
}
function storyBar(label, val, color) {
    const v = Math.max(0, Math.min(100, val));
    return `<div class="story-bar-wrap"><span>${label}</span><div class="story-bar"><div style="width:${v}%;background:${color}"></div></div><span>${Math.round(v)}</span></div>`;
}

// ══ FAZ-2 ADIM 3: KONSEY (hükümet) DRAWER ═══════════════════════════════════
const STORY_CMD_COST = 120;   // yeni komutan maliyeti (her kaynaktan)
function storyCouncilOpen() {
    storyTechClose(); storyArmyClose(); storyCityClose();   // tek panel açık kalsın
    STORY._councilOpen = true;
    const p = document.getElementById('council-panel');
    if (p) { p.classList.add('open'); p.setAttribute('aria-hidden', 'false'); }
    document.getElementById('story-council-btn')?.classList.add('active');
    storyCouncilUpdate();
}
function storyCouncilClose() {
    STORY._councilOpen = false; STORY._dismissMode = false;
    const p = document.getElementById('council-panel');
    if (p) { p.classList.remove('open'); p.setAttribute('aria-hidden', 'true'); }
    document.getElementById('council-confirm')?.classList.add('hidden');
    document.getElementById('story-council-btn')?.classList.remove('active');
}
function storyCouncilToggle() { STORY._councilOpen ? storyCouncilClose() : storyCouncilOpen(); }
// TEKNOLOJİ paneli (placeholder — Adım 4'te dolacak)
function storyTechOpen() {
    storyCouncilClose(); storyArmyClose(); storyCityClose();
    STORY._techOpen = true;
    const p = document.getElementById('tech-panel');
    if (p) { p.classList.add('open'); p.setAttribute('aria-hidden', 'false'); }
    document.getElementById('story-tech-btn')?.classList.add('active');
    storyTechUpdate();
}
function storyTechClose() {
    STORY._techOpen = false;
    const p = document.getElementById('tech-panel');
    if (p) { p.classList.remove('open'); p.setAttribute('aria-hidden', 'true'); }
    document.getElementById('story-tech-btn')?.classList.remove('active');
}
function storyTechToggle() { STORY._techOpen ? storyTechClose() : storyTechOpen(); }
// ORDUM paneli — komutan kartı + ordu bütçesi (kasan) + gaziler
function storyArmyOpen() {
    storyCouncilClose(); storyTechClose(); storyCityClose();
    STORY._armyOpen = true;
    const p = document.getElementById('army-panel');
    if (p) { p.classList.add('open'); p.setAttribute('aria-hidden', 'false'); }
    document.getElementById('story-army-btn')?.classList.add('active');
    storyArmyUpdate();
}
function storyArmyClose() {
    STORY._armyOpen = false;
    const p = document.getElementById('army-panel');
    if (p) { p.classList.remove('open'); p.setAttribute('aria-hidden', 'true'); }
    document.getElementById('story-army-btn')?.classList.remove('active');
}
function storyArmyToggle() { STORY._armyOpen ? storyArmyClose() : storyArmyOpen(); }
// 🏗️ ŞEHRE GİR paneli → js/Production.js (storyCityOpen/Close/Toggle/Update + üretim UI'ı)
// ORDUM paneli — DEVLETİN TAMAMI: senin sefer ordun, diğer komutanların orduları,
// şehir depoları ve gaziler. (Eskiden yalnız kasa + gazi listesi vardı; "tüm ordum görünsün".)
function storyArmyUpdate() {
    if (!STORY._armyOpen) return;
    const c = STORY.commander; const body = document.getElementById('army-body');
    if (!body || !c) return;
    const me = storyPlayerState(); if (!me) return;
    const label = t => (typeof STATS !== 'undefined' && STATS[t] && STATS[t].name) ? STATS[t].name : t;
    const rows = obj => Object.keys(obj || {}).filter(k => (obj[k] | 0) > 0)
        .sort((a, b) => ((STATS[+b] && STATS[+b].cost) || 0) - ((STATS[+a] && STATS[+a].cost) || 0))
        .map(k => `<div class="army-row"><span>${label(+k)}</span><span class="army-ct">×${obj[k] | 0}</span></div>`).join('');
    const count = obj => { let n = 0; for (const k in (obj || {})) n += obj[k] | 0; return n; };

    // 1) SENİN SEFER ORDUN
    const myN = count(c.army), myCap = cmdArmyCap(c);
    const here = storyNode(c.node);
    let html = `<div class="army-card"><div class="army-name">🎖️ ${c.name}</div>`
        + storyCouncilSkillBars(c.skills)
        + `<div class="army-sub">Sadakat <b style="color:${storyLoyColor(c.loyalty || 100)}">${Math.round(c.loyalty || 100)}/100</b> · 📍 ${here ? here.name : '—'}</div></div>`;
    html += `<div class="army-section"><div class="army-h">⚔️ SEFER ORDUN <b>${myN}/${myCap}</b></div>`
        + `<div class="army-note">Bu ordu <b>seninle birlikte gezer</b> — saldırıya bunu götürürsün. Kapasite savaş yeteneğine bağlı.</div>`
        + (myN ? `<div class="army-list">${rows(c.army)}</div>`
               : `<div class="army-note" style="color:#ff8a8a">Ordun yok! Bir şehrine git, <b>ŞEHRE GİR</b> panelinden depodan sevk al.</div>`)
        + `</div>`;

    // 2) DİĞER KOMUTANLARIN SEFER ORDULARI
    const others = storyPlayerCommanders().filter(x => !x.isPlayer);
    const othRows = others.map(x => {
        const n = count(x.army), cap = cmdArmyCap(x), nd = storyNode(x.node);
        const col = n === 0 ? '#ff8a8a' : (n >= cap * 0.6 ? '#4cff7c' : '#ffd24c');
        return `<div class="army-cmd-row"><span class="acr-n">${storyPersonaIcon(x.personality)} ${x.name}</span>`
            + `<span class="acr-loc">📍 ${nd ? nd.name : '—'}</span>`
            + `<span class="acr-ct" style="color:${col}">${n}/${cap}</span></div>`;
    }).join('');
    const othTotal = others.reduce((a, x) => a + count(x.army), 0);
    html += `<div class="army-section"><div class="army-h">🎖️ DİĞER KOMUTANLAR <b>${othTotal} birlik</b></div>`
        + (others.length ? `<div class="army-cmds">${othRows}</div>` : `<div class="army-note">Konseyde başka komutan yok.</div>`)
        + `</div>`;

    // 3) ŞEHİR DEPOLARI (üretilip sevk bekleyen)
    const depots = STORY.nodes.filter(n => n.owner === me.id && count(n.pool) > 0)
        .sort((a, b) => count(b.pool) - count(a.pool));
    const depTotal = depots.reduce((a, n) => a + count(n.pool), 0);
    const depRows = depots.map(n => {
        const has = storyPlayerCommanders().some(x => x.node === n.id);
        return `<div class="army-cmd-row"><span class="acr-n">🏭 ${n.name}</span>`
            + `<span class="acr-loc">${has ? 'komutan var — sevk edilebilir' : 'sevk bekliyor'}</span>`
            + `<span class="acr-ct">${count(n.pool)}/${prodPoolCap(n)}</span></div>`;
    }).join('');
    html += `<div class="army-section"><div class="army-h">🏭 ŞEHİR DEPOLARI <b>${depTotal} birlik</b></div>`
        + `<div class="army-note">Depodaki birlikler bulundukları şehri <b>savunur</b> ama saldırıya gitmez — komutan gelip sevk almalı.</div>`
        + (depots.length ? `<div class="army-cmds">${depRows}</div>` : `<div class="army-note">Depolar boş — şehirlerinde üretim yap.</div>`)
        + `</div>`;

    // 4) TOPLAM + GAZİLER
    html += `<div class="army-section"><div class="army-h">📊 DEVLET TOPLAMI</div>`
        + `<div class="army-tot"><span>Sefer orduları</span><b>${myN + othTotal}</b></div>`
        + `<div class="army-tot"><span>Şehir depoları</span><b>${depTotal}</b></div>`
        + `<div class="army-tot big"><span>TÜM ORDU</span><b>${myN + othTotal + depTotal}</b></div></div>`;

    const vets = STORY.veterans || [];
    const groups = {};
    for (const v of vets) { const k = v.type + '|' + (v.vet | 0); groups[k] = (groups[k] || 0) + 1; }
    const vetRows = Object.keys(groups).sort((a, b) => (+b.split('|')[1]) - (+a.split('|')[1])).map(k => {
        const t = k.split('|')[0], lvl = Math.max(1, +k.split('|')[1] || 1);
        return `<div class="army-vet-row"><span>${label(+t)}</span><span class="army-star">${'★'.repeat(Math.min(5, lvl))} sv${lvl}</span><span class="army-ct">×${groups[k]}</span></div>`;
    }).join('');
    html += `<div class="army-section"><div class="army-h">🎖️ GAZİLER <b>${vets.length}/14</b></div>`
        + `<div class="army-note">Savaştan sağ çıkanların kıdemi sonraki düelloda birliklerine yapışır (+%12/seviye dayanıklılık).</div>`
        + (vets.length ? `<div class="army-vets">${vetRows}</div>` : `<div class="army-note">Henüz gazi yok — bir düelloyu kazan.</div>`)
        + `</div>`;

    const r = c.res || { oil: 0, manpower: 0, points: 0 };
    html += `<div class="army-section"><div class="army-h">💰 KASAN</div><span class="army-res">⛽ ${Math.floor(r.oil)} · 👥 ${Math.floor(r.manpower)} · ⭐ ${Math.floor(r.points)}</span>`
        + `<div class="army-note">Üretim, bina ve şehir yükseltmeleri bu kasadan ödenir.</div></div>`;
    body.innerHTML = html;
}
// ── TEKNOLOJİ AĞACI (Faz-2 Adım 4 — HER devlet kendi tech'ini geliştirir) ─────
const TECH_COST_MULT = 2.5;   // tüm tech fiyatları ×2.5 (daha stratejik/kıt yatırım)
function storyTechHasIn(ids, id) { return !!(ids && ids.indexOf(id) >= 0); }
function storyTechCostFor(ids, tech) { return Math.round(tech.cost * TECH_COST_MULT * Math.pow(1.1, (ids || []).length)); }   // ×2.5 + her alımda +%10
// {state:'researched'|'available'|'locked', reason, cost} — verilen tech listesine göre
function storyTechStatusFor(ids, tech) {
    ids = ids || [];
    if (storyTechHasIn(ids, tech.id)) return { state: 'researched', cost: 0 };
    const cost = storyTechCostFor(ids, tech);
    for (const p of (tech.prereq || [])) if (!storyTechHasIn(ids, p)) return { state: 'locked', reason: (TECH_BY_ID[p] ? TECH_BY_ID[p].name : p) + ' gerekli', cost };
    if (tech.sibling && storyTechHasIn(ids, tech.sibling)) return { state: 'locked', reason: (TECH_BY_ID[tech.sibling] ? TECH_BY_ID[tech.sibling].name : '') + ' seçildi (kardeş)', cost };
    if (tech.tier >= 3 && !ids.some(id => TECH_BY_ID[id] && TECH_BY_ID[id].branch === 'state'))
        return { state: 'locked', reason: 'Çağ Kapısı: Devlet dalında ≥1 tech şart', cost };
    if (tech.tier >= 4 && ids.length < 8)
        return { state: 'locked', reason: `Çağ Kapısı: ≥8 teknoloji şart (${ids.length}/8)`, cost };
    return { state: 'available', cost };
}
// ÇARPAN anahtarları: tech/kanun/anayasa etkisi → TECH_BONUS alanı
const BONUS_MUL_MAP = {
    oilCost: 'oilCost', manpowerCost: 'manpowerCost', allCost: 'allCost',
    tankArmor: 'tankArmor', tankHp: 'tankHp', tankAtk: 'tankAtkMul', armorSpeed: 'armorSpeed',
    reconVision: 'reconVision', infantryHp: 'infantryHp', infantryAtk: 'infantryAtkMul',
    mechHp: 'mechHp', atHp: 'atHp', allHp: 'allHp', allSpeed: 'allSpeed',
    artySplash: 'artySplashMul', artyVsInf: 'artyVsInfMul', artyAtk: 'artyAtkMul', atVsTank: 'atVsTankMul',
    pointsIncome: 'pointsIncome', oilIncome: 'oilIncome', manIncome: 'manIncome',
    prodSpeed: 'prodSpeed', buildCost: 'buildCost', loyaltyHold: 'loyaltyHold',
};
const BONUS_ADD_KEYS = { conquestVets: 1, officer: 1, poolCap: 1, cmdCap: 1, cityDefense: 1 };
// etki nesneleri listesi → bonus (ekonomist sinerjisi ×(1+0.05·eco); indirim+buff iki yönde güçlenir)
function storyComputeBonusFrom(effects, eco) {
    if (!effects || !effects.length) return null;
    const synF = 1 + 0.05 * (eco || 0);
    const b = {};
    const mul = (key, v) => { b[key] = Math.max(0.2, (b[key] || 1) * (1 + (v - 1) * synF)); };
    for (const eff of effects) {
        if (!eff) continue;
        for (const k in eff) {
            if (BONUS_MUL_MAP[k]) mul(BONUS_MUL_MAP[k], eff[k]);
            else if (BONUS_ADD_KEYS[k]) b[k] = (b[k] || 0) + eff[k];
            else if (k === 'intel') b.intel = true;
        }
    }
    return b;
}
// devletin YÜRÜRLÜKTEKİ tüm etkileri: teknoloji + konsey kanunları + anayasa
function storyStateEffects(st) {
    const out = [];
    for (const id of (st.tech || [])) { const t = TECH_BY_ID[id]; if (t && t.effect) out.push(t.effect); }
    if (typeof LAW_SLOT_BY_KEY !== 'undefined') {
        const laws = st.laws || {};
        for (const k in laws) { const o = lawOption(k, laws[k]); if (o && o.effect) out.push(o.effect); }
    }
    if (typeof CONSTITUTION_BY_ID !== 'undefined') { const c = storyConstitution(st); if (c && c.effect) out.push(c.effect); }
    return out;
}
// eski imza (yalnız tech listesi) — dış çağrılar için korunur
function storyComputeTechBonusFor(ids, eco) {
    const eff = []; for (const id of (ids || [])) { const t = TECH_BY_ID[id]; if (t && t.effect) eff.push(t.effect); }
    return storyComputeBonusFrom(eff, eco);
}
// devletin en iyi ekonomisti (AI tech sinerjisi)
function storyStateBestEco(st) { let m = 0; for (const c of storyStateCommanders(st)) if (c.skills && c.skills.economist > m) m = c.skills.economist; return m; }
function storyStateComputeTech(st) { st._techBonus = storyComputeBonusFrom(storyStateEffects(st), storyStateBestEco(st)); return st._techBonus; }
// — OYUNCU sarmalayıcıları (STORY.tech = oyuncu devletinin tech dizisi, AYNI nesne) —
function storyTechHas(id) { return storyTechHasIn(STORY.tech, id); }
function storyTechCost(tech) { return storyTechCostFor(STORY.tech, tech); }
function storyTechStatus(tech) { return storyTechStatusFor(STORY.tech, tech); }
// Oyuncunun bonusu = devletinin bonusu (kanun/anayasa dahil); STORY._techBonus ile devletinki AYNI nesne.
function storyComputeTechBonus() {
    const st = storyPlayerState();
    if (!st) { STORY._techBonus = storyComputeTechBonusFor(STORY.tech, 0); return STORY._techBonus; }
    st._techBonus = storyComputeBonusFrom(storyStateEffects(st), (STORY.commander && STORY.commander.skills && STORY.commander.skills.economist) || 0);
    STORY._techBonus = st._techBonus;
    return STORY._techBonus;
}
// — RUTİN AR-GE: her devlet (OYUNCU DAHİL) techPoints'iyle en ucuz UYGUN tech'i alır.
// Bu "kendiliğinden ilerleyen bilim"dir; YÖN veren karar konseydedir (storyCouncilApply).
// Oyuncu devleti de dahil çünkü aksi hâlde AI serbest ilerlerken oyuncu yalnız 2 yılda bir
// tech alırdı — ölçümde AI 700sn'de 5-12 tech'e çıkıyordu, oyuncu 2'de kalıyordu.
// ── YÖNETİCİ AR-GE ÖNCELİĞİ ──
// "en ucuzu al" yanlıştı: devlet neye ihtiyacı olduğuna bakmadan rastgele bir dalı dolduruyordu.
// Yönetici artık DURUMA bakar. Yalnız K1-K2 (basit) teknolojiler bu yoldan gelir;
// K3-K4 ağır kararlar KONSEY oylamasına kalır ("ana kanunlar yine seçimle").
const ADMIN_TECH_MAX_TIER = 2;
// İHTİYAÇLAR SÜREKLİ (0..1) ölçülür, eşikli değil. Eşikli ilk sürümde "ordu az mı?" gibi
// sorular kampanyanın başında hep aynı cevabı veriyordu ve yönetim altı farklı krizde de
// aynı teknolojiyi seçiyordu (ölçüm: 6 senaryonun 4'ünde tepe seçim aynı). Süreklilik +
// daha güçlü ağırlıklar kararı gerçekten duruma bağlar.
function storyStateNeeds(st) {
    const cl = v => Math.max(0, Math.min(1, v));
    const owned = STORY.nodes.filter(n => n.owner === st.id);
    const nOwn = owned.length || 1;
    const hostileAdj = STORY.nodes.filter(n => n.owner !== st.id && (n.neighbors || []).some(id => { const q = storyNode(id); return q && q.owner === st.id; })).length;
    let field = 0, depot = 0, build = 0;
    for (const c of storyStateCommanders(st)) field += (typeof cmdArmyCount === 'function') ? cmdArmyCount(c) : 0;
    for (const n of owned) { for (const k in (n.pool || {})) depot += n.pool[k] | 0; build += (n.fac | 0) + (n.bar | 0); }
    const cs = storyStateCommanders(st);
    const loy = cs.length ? cs.reduce((a, c) => a + (c.loyalty == null ? 60 : c.loyalty), 0) / cs.length : 60;
    return {
        army:  cl((4 - (field + depot) / nOwn) / 4),                    // ordu/şehir < 4 → ihtiyaç
        threat: cl(hostileAdj / nOwn),                                  // düşman komşu oranı
        money: cl((450 - (st.techPoints || 0)) / 450),
        welfare: cl((50 - (st.welfare == null ? 50 : st.welfare)) / 50),
        loyalty: cl((62 - loy) / 62),
        infra: cl((nOwn * 2 - build) / (nOwn * 2)),                     // şehir başına 2 bina hedefi
        staff: cl((storyCommanderCap(st) - cs.length) / 4),
    };
}
// needs: çağıran hesaplayıp geçer (bir tick'te bir kez). Devlet nesnesinde ÖNBELLEKLENMEZ —
// orada tutulsa kayda serileşir ve bayatlar.
function storyTechPriority(st, tech, needs) {
    const N = needs || storyStateNeeds(st);
    const e = tech.effect || {}, b = tech.branch;
    let s = 4 - tech.tier;                                              // erken kademe hafif tercihli (belirleyici DEĞİL)
    if (e.prodSpeed)                       s += N.army * 20 + N.infra * 6;
    if (e.poolCap)                         s += N.army * 18;
    if (e.allCost || e.oilCost || e.manpowerCost) s += N.army * 10 + N.welfare * 9;
    if (e.buildCost)                       s += N.infra * 17;
    if (e.cityDefense)                     s += N.threat * 26;
    if (e.tankHp || e.tankArmor || e.tankAtk || e.infantryHp || e.infantryAtk
        || e.allHp || e.mechHp || e.atHp || e.artyAtk || e.artySplash
        || e.artyVsInf || e.atVsTank)      s += N.threat * 16 + (1 - N.army) * 9;
    if (e.pointsIncome)                    s += N.money * 25;   // ⭐puan = Ar-Ge yakıtı: fon bitince en acil ihtiyaç
    if (e.oilIncome || e.manIncome)        s += N.money * 14 + N.army * 6;
    if (e.loyaltyHold)                     s += N.loyalty * 28;
    if (e.officer)                         s += N.staff * 13;
    if (e.cmdCap)                          s += N.staff * 15;
    if (e.intel)                           s += N.threat * 9;
    if (e.reconVision)                     s += N.threat * 7;
    if (e.armorSpeed || e.allSpeed)        s += 3 + (1 - N.army) * 4;
    if (e.conquestVets)                    s += (1 - N.army) * 11;
    // aynı dalı sonsuz doldurmasın (doktrin çeşitliliği)
    const inBranch = (st.tech || []).filter(id => TECH_BY_ID[id] && TECH_BY_ID[id].branch === b).length;
    return s - inBranch * 2.0;
}
function storyAIResearch() {
    for (const st of STORY.states) {
        if (!st.tech) st.tech = []; if (st.techPoints == null) st.techPoints = 0;
        const needs = storyStateNeeds(st);                           // tick başına bir kez okunan durum
        let best = null, bestCost = 0, bestScore = -Infinity;
        for (const t of TECH_TREE.techs) {
            if (t.tier > ADMIN_TECH_MAX_TIER) continue;              // ağır teknoloji = konsey kararı
            const s = storyTechStatusFor(st.tech, t);
            if (s.state !== 'available' || s.cost > st.techPoints) continue;
            const p = storyTechPriority(st, t, needs);
            if (p > bestScore) { bestScore = p; best = t; bestCost = s.cost; }
        }
        if (best) {
            st.techPoints -= bestCost;
            st.tech.push(best.id);
            storyStateComputeTech(st);
            if (st.isPlayer) { storyComputeTechBonus(); storyLog(`🔬 Yönetim Ar-Ge kararı: <b>${best.name}</b> (−${bestCost}⭐ araştırma fonu)`); }
            else if (Math.random() < 0.45) storyLog(`⚙️ ${st.name} teknoloji geliştirdi: <b>${best.name}</b>`);
        }
    }
}
// TEKNOLOJİ ARTIK SATIN ALINMAZ — KONSEY KARARIDIR.
// Kullanıcı isteği: "teknoloji ağacı geliştirmeleri konsey toplandığında tüm komutanlar seçim
// yapar, son fikri yönetici koyar". Dükkân mantığı kaldırıldı; iki yol kaldı:
//   1) RUTİN AR-GE  — araştırma fonu yeterse en ucuz uygun tech kendiliğinden gelir
//   2) KONSEY KARARI — 2 yılda bir, komutanlar oylar, yönetici pahalı/stratejik olanı seçer
function storyTechBuy(id) {
    const tech = TECH_BY_ID[id]; if (!tech) return;
    storyFlash(`🏛️ ${tech.name} bir KONSEY kararıdır — toplantıda oylanır, Ar-Ge fonu yeterse kendiliğinden gelir.`);
}
function storyTechUpdate() {
    if (!STORY._techOpen) return;
    const body = document.getElementById('tech-body'); if (!body || typeof TECH_TREE === 'undefined') return;
    const me = storyPlayerState();
    const fund = me ? Math.floor(me.techPoints || 0) : 0;
    const count = (STORY.tech || []).length;
    const toC = Math.max(0, (STORY._nextCouncil || 0) - (STORY.clock || 0));
    let html = `<div class="tech-top">🔬 Ar-Ge fonu: <b>${fund}⭐</b> · Araştırılan: <b>${count}/${TECH_TREE.techs.length}</b>`
        + `<div class="tech-hint">Teknoloji <b>satın alınmaz</b> — fon yeterse en ucuz uygun tech kendiliğinden gelir; pahalı/stratejik olanı <b>KONSEY</b> seçer (sonraki toplantı: ${(toC / YEAR_SECONDS).toFixed(1)} yıl).</div>`
        + `<div class="tech-hint">Maliyet her alımda +%10 · K3 için Devlet dalında ≥1 tech · K4 için ≥8 tech · K2 kardeşlerden biri</div></div><div class="tech-cols">`;
    for (const br of TECH_TREE.branches) {
        html += `<div class="tech-col"><div class="tech-col-h" style="color:${br.color}">${br.icon} ${br.name}</div>`;
        for (let tier = 1; tier <= 4; tier++) {
            for (const t of TECH_TREE.techs.filter(x => x.branch === br.key && x.tier === tier)) {
                const s = storyTechStatus(t);
                const badge = s.state === 'researched' ? '✓ Araştırıldı' : (s.state === 'locked' ? '🔒' : `${s.cost}⭐`);
                html += `<div class="tech-node ${s.state}" data-tech="${t.id}">`
                    + `<div class="tn-head"><span class="tn-name">${t.name}</span><span class="tn-badge">${badge}</span></div>`
                    + `<div class="tn-desc">${t.desc}</div>`
                    + (s.state === 'locked' && s.reason ? `<div class="tn-lock">${s.reason}</div>` : '')
                    + `</div>`;
            }
        }
        html += `</div>`;
    }
    html += `</div>`;   // tech-cols kapat
    // RAKİP DEVLETLERİN teknoloji durumu (stratejik farkındalık: kime saldırmak riskli?)
    const rivals = STORY.states.filter(s => !s.isPlayer && STORY.nodes.some(n => n.owner === s.id));
    if (rivals.length) {
        html += `<div class="tech-rivals"><div class="tech-col-h" style="color:#ff8a8a">⚔️ Rakip teknolojileri</div>`;
        for (const r of rivals.slice().sort((a, b) => (b.tech ? b.tech.length : 0) - (a.tech ? a.tech.length : 0)))
            html += `<div class="tech-rival-row"><span style="color:${r.color}">⬤ ${r.name}</span><span><b>${(r.tech || []).length}</b> tech</span></div>`;
        html += `</div>`;
    }
    body.innerHTML = html;
}
function storyLoyColor(l) { return l >= 70 ? '#4cff7c' : (l >= 40 ? '#ffd24c' : '#ff5a5a'); }
function storyPersonaIcon(p) { return { agresif: '🎯', savunmacı: '🛡️', fırsatçı: '🦊', dengeli: '⚖️', oyuncu: '👑' }[p] || '⚖️'; }   // komutan bireysel doğası
function storyCouncilSkillBars(sk) {
    const bar = (val, col, lbl) => `<div class="cr-bar" title="${lbl} ${val || 0}/6"><i style="width:${Math.round((val || 0) / 6 * 100)}%;background:${col};${(val || 0) === 0 ? 'opacity:.35' : ''}"></i></div>`;
    return `<div class="cr-skills">${bar(sk && sk.warrior, '#ff7a4c', 'Savaşçı')}${bar(sk && sk.diplomat, '#4c9fff', 'Diplomat')}${bar(sk && sk.economist, '#ffd24c', 'Ekonomist')}</div>`;
}
function storyCamCenterOn(node) {
    const cv = document.getElementById('storyCanvas'); if (!cv || !node) return;
    storyResize();   // boyut tazele (bayat cv.width fix)
    storyCam.x = node.lx * STORY_WORLD_W - (cv.width / storyCam.zoom) / 2;
    storyCam.y = node.ly * STORY_WORLD_H - (cv.height / storyCam.zoom) / 2;
    storyClampCam(cv.width, cv.height);
}
function storyCouncilUpdate() {
    if (!STORY._councilOpen) return;
    const me = storyPlayerState(); if (!me) return;
    const isAdmin = !!(me.gov && me.gov.leader === 'player');
    const banner = document.getElementById('council-admin-banner');
    if (banner) banner.innerHTML =
        `<div class="story-res">🏛️ Yönetici: <b style="color:${isAdmin ? '#4cff7c' : '#ffd24c'}">${isAdmin ? 'SEN (Komutan)' : 'AI Cumhurbaşkanı'}</b></div>`
        + storyBar('Refah', me.welfare, '#54e08a')
        + `<div class="story-res">🏅 İtibar <b>${me.reputation}/6</b>${isAdmin ? '' : (me.reputation >= 6 && me.welfare >= 60 ? ' <span style="color:#4cff7c">— seçime hazırsın!</span>' : ` <span style="color:#9fb3c8">(seçim: itibar≥6 + refah≥60)</span>`)}</div>`
        + (isAdmin ? `<div class="story-res" style="color:#4cff7c;font-size:12px">🎖️ Komutan yaratabilir/dağıtabilirsin.</div>` : `<div class="story-res" style="color:#9fb3c8;font-size:12px">🔒 Yönetici olunca komutanları yönetirsin.</div>`);
    const cmds = storyPlayerCommanders();
    const myr = (STORY.commander && STORY.commander.res) || { oil: 0, manpower: 0, points: 0 };
    const inc = STORY._incPerCmd || { oil: 0, manpower: 0, points: 0 };
    const tre = document.getElementById('council-treasury');
    if (tre) tre.innerHTML = `💰 Devlet hazinesi: ⛽<b>${Math.floor(me.res.oil)}</b> 👥<b>${Math.floor(me.res.manpower)}</b> ⭐<b>${Math.floor(me.res.points)}</b>`
        + `<br>🎖️ <b style="color:#4cff7c">Senin kasan</b> (savaşa bununla girersin): ⛽<b>${Math.floor(myr.oil)}</b> 👥<b>${Math.floor(myr.manpower)}</b> ⭐<b>${Math.floor(myr.points)}</b>`
        + `<br><span style="color:#9fb3c8;font-size:12px">${cmds.length} komutan · gelir/komutan ⛽${inc.oil.toFixed(1)} 👥${inc.manpower.toFixed(1)} ⭐${inc.points.toFixed(1)} /sn (sabit)</span>`;
    // EN GÜÇLÜ (oyuncu hariç) + sıralama (oyuncu üst, sonra skill-toplam azalan)
    const skSum = c => c.skills ? (c.skills.warrior + c.skills.diplomat + c.skills.economist) : 0;
    let bestId = -1, bestSum = -1;
    for (const c of cmds) { if (c.isPlayer) continue; const s = skSum(c); if (s > bestSum) { bestSum = s; bestId = c.id; } }
    const sorted = cmds.slice().sort((a, b) => (a.isPlayer !== b.isPlayer) ? (a.isPlayer ? -1 : 1) : (skSum(b) - skSum(a)));
    const list = document.getElementById('council-list');
    if (list) list.innerHTML = sorted.map(c => {
        const node = storyNode(c.node);
        const front = (node && node.owner !== me.id) ? ' <span class="front">· cephe-gerisi</span>' : '';
        const loc = node ? ('📍 ' + node.name + front) : '📍 —';
        const col = c.isPlayer ? '#4cff7c' : ((storyState(me.id) || {}).color || '#888');
        const star = (c.id === bestId) ? ' ⭐' : '';
        const self = c.isPlayer ? ' <span class="cr-self">◆ SEN</span>' : '';
        const loy = Math.round(c.loyalty || 0), risk = loy < 40 ? ' risk' : '';
        const showX = (STORY._dismissMode && !c.isPlayer) ? '' : ' hidden';
        return `<div class="council-row${c.isPlayer ? ' is-player' : ''}" data-node="${c.node}" data-cmd-id="${c.id}">`
            + `<span class="cr-token" style="background:${col}"></span>`
            + `<div class="cr-main"><div class="cr-name"><span title="${c.personality}">${storyPersonaIcon(c.personality)}</span> ${c.name}${self}${star}</div><div class="cr-loc">${loc}</div></div>`
            + storyCouncilSkillBars(c.skills)
            + `<div class="cr-loyalty${risk}" title="Sadakat ${loy}/100"><span class="cr-loy-dot" style="background:${storyLoyColor(loy)}"></span>${loy}</div>`
            + `<button class="cr-dismiss${showX}" data-cmd-id="${c.id}" title="Kov">✖</button></div>`;
    }).join('');
    // yönetici-yetkileri
    const acts = document.getElementById('council-actions');
    const createBtn = document.getElementById('council-create-btn');
    const dismissBtn = document.getElementById('council-dismiss-btn');
    if (acts) acts.classList.toggle('locked', !isAdmin);
    const extra = (me.gov && me.gov.commanders) ? me.gov.commanders.length : 0;
    const C = STORY_CMD_COST, afford = me.res.oil >= C && me.res.manpower >= C && me.res.points >= C, capFull = extra >= 9;
    if (createBtn) { createBtn.disabled = !isAdmin || capFull || !afford; createBtn.textContent = capFull ? '➕ Konsey dolu (10)' : ((!afford && isAdmin) ? '➕ Hazine yetersiz' : '➕ Komutan Yarat'); }
    if (dismissBtn) { dismissBtn.disabled = !isAdmin || extra === 0; dismissBtn.textContent = STORY._dismissMode ? '✓ Dağıtmayı Bitir' : '✖ Dağıt Modu'; }
    // FAZ-4: yürürlükteki anayasa + kanunlar + sonraki toplantı sayacı (KANUNLAR sekmesi)
    const laws = document.getElementById('council-lawbox');
    if (laws && typeof storyCouncilLawsHtml === 'function') laws.innerHTML = storyCouncilLawsHtml(me);
    storyCouncilSyncTabs();
}
// Aktif sekmeyi göster/gizle (komutan listesi ↔ kanun/anayasa)
function storyCouncilSyncTabs() {
    const tab = STORY._councilTab || 'cmd';
    document.querySelectorAll('#council-tabs .ctab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById('council-tab-cmd')?.classList.toggle('hidden', tab !== 'cmd');
    document.getElementById('council-tab-law')?.classList.toggle('hidden', tab !== 'law');
}
function storyCouncilCreate() {
    const me = storyPlayerState(); if (!me || !(me.gov && me.gov.leader === 'player')) return;
    if (me.gov.commanders.length >= 9) return;
    const C = STORY_CMD_COST, ok = me.res.oil >= C && me.res.manpower >= C && me.res.points >= C;
    const cc = document.getElementById('council-confirm'); if (!cc) return;
    cc.classList.remove('hidden');
    cc.innerHTML = `Yeni komutan başkentte belirecek. Maliyet: <span class="${ok ? 'ok' : 'bad'}">⛽${C} 👥${C} ⭐${C}</span>${ok ? '' : ' <span class="bad">(hazine yetersiz)</span>'}<div class="cc-btns"><button class="story-btn" id="cc-yes" ${ok ? '' : 'disabled'}>Onayla</button><button class="story-btn" id="cc-no">Vazgeç</button></div>`;
    document.getElementById('cc-no').onclick = () => cc.classList.add('hidden');
    document.getElementById('cc-yes').onclick = () => {
        const m2 = storyPlayerState();   // state objesi araya yeniden atanmış olabilir → taze çöz (stale-ref fix)
        if (!m2 || !(m2.gov && m2.gov.leader === 'player')) { cc.classList.add('hidden'); return; }
        if (m2.res.oil < C || m2.res.manpower < C || m2.res.points < C) { cc.classList.add('hidden'); return; }
        m2.res.oil -= C; m2.res.manpower -= C; m2.res.points -= C;
        const cmd = storyCreateCommander(m2.id, (STORY._capitals && STORY._capitals[m2.id] != null) ? STORY._capitals[m2.id] : 0);
        storyLog('➕ Yeni komutan: ' + (cmd ? cmd.name : '?'));
        storySave(); cc.classList.add('hidden'); storyCouncilUpdate(); storyRender();
    };
}
function storyCouncilDismiss(cmdId) {
    const me = storyPlayerState(); if (!me || !(me.gov && me.gov.leader === 'player')) return;
    const idx = me.gov.commanders.findIndex(c => c.id === cmdId); if (idx < 0) return;
    const name = me.gov.commanders[idx].name, last = me.gov.commanders.length === 1;
    const cc = document.getElementById('council-confirm'); if (!cc) return;
    cc.classList.remove('hidden');
    cc.innerHTML = `<b>${name}</b> komutanını dağıt? <span style="color:#9fb3c8">(kovulan ileride bağımsızlaşıp başka devlete geçebilir)</span>${last ? '<br><span class="bad">Bu son ek komutanın — dağıtırsan sadece sen kalırsın.</span>' : ''}<div class="cc-btns"><button class="story-btn" id="cc-yes" style="border-color:#ff5a5a;color:#ff9a9a">Dağıt</button><button class="story-btn" id="cc-no">Vazgeç</button></div>`;
    document.getElementById('cc-no').onclick = () => cc.classList.add('hidden');
    document.getElementById('cc-yes').onclick = () => {
        const m2 = storyPlayerState();   // taze çöz (stale-ref fix)
        if (!m2 || !(m2.gov && m2.gov.leader === 'player')) { cc.classList.add('hidden'); return; }
        const cmd = m2.gov.commanders.find(c => c.id === cmdId);
        if (cmd) {
            // kovulan komutan EN YAKIN düşman devlete KÜSKÜN katılır (iyi komutanı kovmak = düşmanı güçlendirmek)
            const node = storyNode(cmd.node); let dest = null;
            if (node) for (const nb of node.neighbors) { const nn = storyNode(nb); if (nn && nn.owner !== m2.id) { const ts = storyState(nn.owner); if (ts && !ts.isPlayer && ts.gov) { dest = { ts, node: nb }; break; } } }
            if (!dest) { const others = STORY.states.filter(s => !s.isPlayer && s.gov && STORY.nodes.some(n => n.owner === s.id)); if (others.length) { const ts = others[Math.floor(Math.random() * others.length)], c2 = STORY.nodes.find(n => n.owner === ts.id); dest = { ts, node: c2 ? c2.id : cmd.node }; } }
            if (dest) { storyCommanderDefectTo(cmd, m2, dest.ts, dest.node); cmd.loyalty = 40; storyLog(`✖ ${name} kovuldu → küskün, <b>${dest.ts.name}</b>'e katıldı!`); }
            else { const i = m2.gov.commanders.findIndex(c => c.id === cmdId); if (i >= 0) m2.gov.commanders.splice(i, 1); storyLog('✖ ' + name + ' dağıtıldı.'); }
        } else storyFlash('Komutan artık konseyde değil.');
        storySave(); cc.classList.add('hidden'); storyCouncilUpdate(); storyRender();
    };
}

// ── BAĞLAMA (DOM hazır olunca) ───────────────────────────────────────────────
function storyInit() {
    if (STORY._inited) return;
    STORY._inited = true;
    document.getElementById('story-pause-btn')?.addEventListener('click', () => { STORY.paused = !STORY.paused; storyRender(); });
    document.getElementById('story-save-btn')?.addEventListener('click', () => { storySave(); storyFlash(STORY._lastSaveOk ? 'Kaydedildi 💾' : 'Kaydedilemedi (localStorage?)'); });
    document.getElementById('story-menu-btn')?.addEventListener('click', () => { storySave(); showScreen('menu'); });
    document.getElementById('story-action-btn')?.addEventListener('click', () => {
        if (STORY.selectedNodeId != null) storyNodeClicked(STORY.selectedNodeId);
    });
    document.getElementById('story-return-btn')?.addEventListener('click', storyReturnToWorld);
    // KONSEY + TEKNOLOJİ drawer bağlamaları (sol araç çubuğu)
    document.getElementById('story-council-btn')?.addEventListener('click', storyCouncilToggle);
    document.getElementById('council-close')?.addEventListener('click', storyCouncilClose);
    document.getElementById('story-tech-btn')?.addEventListener('click', storyTechToggle);
    document.getElementById('tech-close')?.addEventListener('click', storyTechClose);
    document.getElementById('tech-body')?.addEventListener('click', (e) => {   // tech-node tıkla → araştır (sadece 'available')
        const node = e.target.closest('.tech-node.available'); if (node && node.dataset.tech) storyTechBuy(node.dataset.tech);
    });
    document.getElementById('story-army-btn')?.addEventListener('click', storyArmyToggle);
    document.getElementById('army-close')?.addEventListener('click', storyArmyClose);
    document.getElementById('story-city-btn')?.addEventListener('click', storyCityToggle);
    document.getElementById('city-close')?.addEventListener('click', storyCityClose);
    document.getElementById('city-body')?.addEventListener('click', (e) => {   // ŞEHRE GİR: navigasyon + şehir/bina/üretim/garnizon
        const b = e.target.closest('button'); if (!b || b.disabled) return;
        if (b.classList.contains('city-chip')) {   // şeritten şehir seç → odağı değiştir + kamerayı götür
            STORY.selectedNodeId = +b.dataset.node;
            storyCityUpdate();
            const nd = storyNode(+b.dataset.node); if (nd) storyCamCenterOn(nd);
            return;
        }
        if (b.classList.contains('cb-up')) return storyCityUpgrade(+b.dataset.node);
        if (b.classList.contains('cb-gar')) return storyCityGarrison(+b.dataset.node);
        if (b.classList.contains('cb-build')) return prodBuild(+b.dataset.node, b.dataset.kind);
        if (b.classList.contains('cb-make')) return prodEnqueue(+b.dataset.node, +b.dataset.type);
        if (b.classList.contains('cb-cancel')) return prodCancel(+b.dataset.node, +b.dataset.idx);
        // FAZ-5 SEVK: şehir deposu ↔ komutanın sefer ordusu
        if (b.classList.contains('cb-load')) {
            const n = storyNode(+b.dataset.node);
            const moved = storyLoadArmy(STORY.commander, n);
            if (moved) storyLog(`🚚 <b>${n.name}</b>: ${moved} birlik sefer ordusuna alındı (${cmdArmyCount(STORY.commander)}/${cmdArmyCap(STORY.commander)}).`);
            else storyFlash('Sevk edilemedi — depo boş ya da sefer ordun dolu.');
            storySave(); storyCityUpdate(); storyArmyUpdate(); storyRender();
            return;
        }
        if (b.classList.contains('cb-unload')) {
            const n = storyNode(+b.dataset.node);
            const moved = storyUnloadArmy(STORY.commander, n);
            if (moved) storyLog(`🚚 <b>${n.name}</b>: ${moved} birlik depoya bırakıldı.`);
            else storyFlash('Bırakılamadı — ordun boş ya da depo dolu.');
            storySave(); storyCityUpdate(); storyArmyUpdate(); storyRender();
            return;
        }
    });
    // KONSEY SEKMELERİ: komutan listesi ile kanun/anayasa artık ayrı ekranlarda (panel sıkışmasın)
    document.getElementById('council-tabs')?.addEventListener('click', (e) => {
        const t = e.target.closest('.ctab'); if (!t) return;
        STORY._councilTab = t.dataset.tab;
        storyCouncilSyncTabs();
        storyCouncilUpdate();
    });
    document.getElementById('council-create-btn')?.addEventListener('click', storyCouncilCreate);
    document.getElementById('council-dismiss-btn')?.addEventListener('click', () => { STORY._dismissMode = !STORY._dismissMode; storyCouncilUpdate(); });
    document.getElementById('council-list')?.addEventListener('click', (e) => {
        const x = e.target.closest('.cr-dismiss');
        if (x) { storyCouncilDismiss(+x.dataset.cmdId); return; }
        const row = e.target.closest('.council-row');
        if (row) { const node = storyNode(+row.dataset.node); if (node) { storyCamCenterOn(node); STORY._pulseNode = node.id; STORY._pulse = 30; storyRender(); } }
    });
    const cv = document.getElementById('storyCanvas');
    if (cv) {
        const worldFromEvent = (e) => {
            const rect = cv.getBoundingClientRect();
            const mx = (e.clientX - rect.left) * (cv.width / rect.width);
            const my = (e.clientY - rect.top) * (cv.height / rect.height);
            return { x: mx / storyCam.zoom + storyCam.x, y: my / storyCam.zoom + storyCam.y };
        };
        const pickNode = (wx, wy) => {
            let hit = -1, hd = 34 * 34;
            for (const n of STORY.nodes) {
                const dx = n.lx * STORY_WORLD_W - wx, dy = n.ly * STORY_WORLD_H - wy;
                const d = dx * dx + dy * dy;
                if (d < hd) { hd = d; hit = n.id; }
            }
            return hit;
        };
        // SÜRÜKLE-PAN: basılı tutup gez = kamera; kısa tık (sürüklemeden) = düğüm seç
        let dragging = false, moved = false, lastX = 0, lastY = 0;
        cv.addEventListener('mousedown', (e) => { dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY; });
        window.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const dx = e.clientX - lastX, dy = e.clientY - lastY;
            if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
            storyCam.x -= dx / storyCam.zoom; storyCam.y -= dy / storyCam.zoom; lastX = e.clientX; lastY = e.clientY;
            storyClampCam(cv.width, cv.height); cv.style.cursor = 'grabbing'; storyRender();
        });
        window.addEventListener('mouseup', (e) => {
            if (dragging && !moved) {
                // ŞEHRE GİR paneli açıkken harita tıklaması paneli KAPATMAZ, odağı o şehre taşır
                // (şehir seçmek panelin doğal kullanımı — kapatmak akışı bozardı).
                if (STORY._cityOpen) {
                    const w = worldFromEvent(e), hit = pickNode(w.x, w.y);
                    if (hit >= 0) storySelectNode(hit); else storyCityClose();
                }
                else if (STORY._councilOpen || STORY._techOpen || STORY._armyOpen) { storyCouncilClose(); storyTechClose(); storyArmyClose(); }   // diğer paneller: haritaya tık = kapat
                else { const w = worldFromEvent(e), hit = pickNode(w.x, w.y); if (hit >= 0) storySelectNode(hit); }
            }
            dragging = false; cv.style.cursor = 'grab';
        });
        cv.addEventListener('mousemove', (e) => {            // hover imleci (sürüklemiyorken)
            if (dragging) return;
            const w = worldFromEvent(e);
            cv.style.cursor = pickNode(w.x, w.y) >= 0 ? 'pointer' : 'grab';
        });
        // ZOOM: fare tekerleği (imlecin altındaki dünya-noktası sabit kalır)
        cv.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = cv.getBoundingClientRect();
            const mx = (e.clientX - rect.left) * (cv.width / rect.width);
            const my = (e.clientY - rect.top) * (cv.height / rect.height);
            const wx = mx / storyCam.zoom + storyCam.x, wy = my / storyCam.zoom + storyCam.y;
            storyCam.zoom = Math.max(0.4, Math.min(5, storyCam.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
            storyCam.x = wx - mx / storyCam.zoom; storyCam.y = wy - my / storyCam.zoom;
            storyClampCam(cv.width, cv.height); storyRender();
        }, { passive: false });
        cv.style.cursor = 'grab';
    }
    // KAMERA: WASD / ok tuşları (yalnız story ekranındayken)
    window.addEventListener('keydown', (e) => {
        if (typeof APP_SCREEN === 'undefined' || APP_SCREEN !== 'story') return;
        if (e.key === 'Escape') { if (STORY._councilOpen || STORY._techOpen || STORY._armyOpen || STORY._cityOpen) { storyCouncilClose(); storyTechClose(); storyArmyClose(); storyCityClose(); e.preventDefault(); } return; }
        const s = 90 / storyCam.zoom; let m = false;
        const k = e.key.toLowerCase();
        if (k === 'a' || k === 'arrowleft') { storyCam.x -= s; m = true; }
        else if (k === 'd' || k === 'arrowright') { storyCam.x += s; m = true; }
        else if (k === 'w' || k === 'arrowup') { storyCam.y -= s; m = true; }
        else if (k === 's' || k === 'arrowdown') { storyCam.y += s; m = true; }
        else if (k === '+' || k === '=') { storyCam.zoom = Math.min(5, storyCam.zoom * 1.2); m = true; }
        else if (k === '-' || k === '_') { storyCam.zoom = Math.max(0.4, storyCam.zoom / 1.2); m = true; }
        if (m) { const c = document.getElementById('storyCanvas'); if (c) storyClampCam(c.width, c.height); storyRender(); e.preventDefault(); }
    });
    window.addEventListener('resize', () => {
        if (typeof APP_SCREEN === 'undefined' || APP_SCREEN !== 'story') return;
        const c = document.getElementById('storyCanvas'); storyResize(); if (c) storyClampCam(c.width, c.height); storyRender();
    });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', storyInit);
else storyInit();
