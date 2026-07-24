// ═══════════════════════════════════════════════════════════════════════════
//  MAKROEKONOMİ (PLAN AŞAMA 3) — para artık bir sistem, cüzdan değil
//  ---------------------------------------------------------------------------
//  10 yıllık oyun-yaşama testi tespiti: "hazine 700↔1700 arasında anlamsızca
//  gidip geldi; şehirler düşerken piyasa sarsılmadı, hiçbir şey enflasyon
//  üretmedi." Bu katman dört göstergeyle o boşluğu doldurur:
//
//   📈 ENFLASYON (0-30): savaş + kumanda ekonomisi + güvensizlik sürükler.
//      Etki: TÜM gelirler kırpılır, refah sızar, işçiler öfkelenir.
//   🤝 PİYASA GÜVENİ (0-100): istikrar besler, kayıp/darbe/grev yıkar.
//      Etki: ⭐gelir çarpanı; dipte SERMAYE KAÇIŞI (hazine erir).
//   ⚡ ELEKTRONİK: Sv.2+ şehirler ve gelişmiş fabrikalar üretir; TANK ve TOPÇU
//      üretimi stok İSTER — stok yoksa modern ordu kurulamaz (arena kilidi AŞAMA 5).
//   🌾 GIDA: şehir kapasitesi ordu+nüfusu beslemeli; taşarsa KITLIK.
//
//   + FRAKSİYON TALEPLERİ: fraksiyonlar artık çubuk değil MUHATAP — belli
//     aralıklarla somut talep gelir (zam, fon, af...), kabul/ret kararının
//     bedeli vardır. AI başkanlar aynı taleplerle aynı kurallarla yüzleşir.
//
//  İLKE korunur: bütün sayılar motorda; girdiler deterministik, çıktılar mevcut
//  borulara bağlı (gelir tiki, refah, fraksiyonlar, üretim kapısı).
// ═══════════════════════════════════════════════════════════════════════════

const ECON_CHIP_COST = 2;                       // tank/topçu başına ⚡
const ECON_CHIP_TYPES = () => (typeof T !== 'undefined') ? [T.ARMOR, T.ARTILLERY] : [];

function storyEconBackfill(st) {
    if (st.inflation == null) st.inflation = 3 + Math.random() * 3;
    if (st.trust == null) st.trust = 55;
    if (st.chips == null) st.chips = 8;
}

// Gelir çarpanı: enflasyon herkesi kırpar, güven ⭐'ı oynatır (0.7x…1.15x bandı)
function storyEconIncomeMul(st) {
    if (!st || st.inflation == null) return { all: 1, points: 1 };
    const infMul = 1 - Math.min(0.35, st.inflation * 0.012);          // %30 enflasyon → −%35 gelir
    const trustMul = 0.85 + (st.trust / 100) * 0.3;                    // güven 0→0.85x, 100→1.15x
    return { all: infMul, points: trustMul };
}

// Olay kancası (Factions.storyFacEvent üzerinden çağrılır — tek entegrasyon noktası)
const ECON_EVENTS = {
    cityLost: { trust: -3 }, cityWon: { trust: 1.5 },
    coup: { trust: -12, inflation: 2 }, strike: { trust: -4 }, defect: { trust: -1.5 },
};
function storyEconEvent(st, type) {
    if (!st) return; storyEconBackfill(st);
    const e = ECON_EVENTS[type]; if (!e) return;
    if (e.trust) st.trust = Math.max(0, Math.min(100, st.trust + e.trust));
    if (e.inflation) st.inflation = Math.max(0, Math.min(30, st.inflation + e.inflation));
}

// ── FRAKSİYON TALEPLERİ ────────────────────────────────────────────────────
// Fraksiyon küskünleştikçe talep gelme olasılığı artar. Talep 60 sn masada kalır;
// süre dolarsa REDDEDİLMİŞ sayılır (kararsızlık da bir karardır).
const ECON_DEMANDS = {
    workers:  { id: 'zam',   name: 'Asgari ücret zammı',      cost: 180, icon: '⚒️',
                accept: { workers: 8, business: -4 },            reject: { workers: -4, radicals: 3 } },
    business: { id: 'tesvik', name: 'Vergi indirimi + teşvik', cost: 150, icon: '🏦',
                accept: { business: 8, workers: -3 },            reject: { business: -5 } },
    military: { id: 'fon',   name: 'Ordu modernizasyon fonu',  cost: 200, icon: '🎖️',
                accept: { military: 8 },                          reject: { military: -5 } },
    intel:    { id: 'basin', name: 'Üniversite & basın fonu',  cost: 120, icon: '📰',
                accept: { intel: 7 },                             reject: { intel: -4 } },
    radicals: { id: 'af',    name: 'Siyasi tutuklulara af',    cost: 0,   icon: '🔥',
                accept: { radicals: -8, military: -3 },           reject: { radicals: 4 } },
};
function storyEconSpawnDemand(st) {
    if (st._facDemand) return;                                    // masada talep varken yenisi gelmez
    const f = st.factions; if (!f) return;
    // en küskün fraksiyon konuşur (radikaller tersine: taşkınlık konuşturur)
    const cand = FAC_KEYS.map(k => ({ k, anger: k === 'radicals' ? (f[k] - 45) : (52 - f[k]) }))
        .filter(x => x.anger > 6).sort((a, b) => b.anger - a.anger);
    if (!cand.length || Math.random() > 0.5) return;
    const key = cand[0].k, d = ECON_DEMANDS[key]; if (!d) return;
    st._facDemand = { fac: key, until: (STORY.clock || 0) + 60 };
    if (st.isPlayer) {
        if (typeof storyFlash === 'function')
            storyFlash(`${d.icon} TALEP: ${d.name}${d.cost ? ` (${d.cost}⭐ hazineden)` : ''} — Konsey ▸ Fraksiyonlar'dan karar ver (60 sn).`);
        if (typeof storyLog === 'function')
            storyLog(`${d.icon} <b>TALEP</b>: ${d.name}${d.cost ? ` (${d.cost}⭐)` : ''} — 60 sn içinde karar ver (Konsey ▸ Fraksiyonlar).`);
    }
}
function storyEconResolveDemand(st, accept) {
    const dem = st._facDemand; if (!dem) return false;
    const d = ECON_DEMANDS[dem.fac]; st._facDemand = null;
    if (!d) return false;
    if (accept) {
        // hazineden öde: komutan kasalarından orantılı düşülür (devlet önergeleriyle aynı muhasebe)
        if (d.cost > 0) {
            const cmds = storyStateCommanders(st).filter(c => c.res);
            const tot = cmds.reduce((a, c) => a + c.res.points, 0);
            if (tot < d.cost) { storyFacApply(st, d.reject, d.name + ' (hazine yetersiz — RET)'); return false; }
            for (const c of cmds) c.res.points -= d.cost * (c.res.points / Math.max(1, tot));
        }
        storyFacApply(st, d.accept, d.name + ' (kabul)');
    } else {
        storyFacApply(st, d.reject, d.name + ' (ret)');
    }
    if (typeof storyNews === 'function' && (st.isPlayer || Math.random() < 0.2))
        storyNews('demand', { st: st.name, dem: d.name, res: accept ? 'kabul edildi' : 'reddedildi' });
    if (st.isPlayer && typeof storyCouncilUpdate === 'function') storyCouncilUpdate();
    return true;
}
// AI başkan kararı: kasası uygunsa ve eksen yakınlığı varsa kabul eder.
function storyEconAIDemand(st) {
    const dem = st._facDemand; if (!dem || st.isPlayer) return;
    const d = ECON_DEMANDS[dem.fac];
    const treasury = st.res ? st.res.points : 0;
    const p = st.gov && st.gov.president && st.gov.president.axes;
    let want = 0.5;
    if (p) {
        if (dem.fac === 'workers') want += (p.pop - 50) / 100;
        if (dem.fac === 'business') want += (50 - p.pop) / 100;
        if (dem.fac === 'military') want += (p.hawk - 50) / 100;
        if (dem.fac === 'intel') want += (50 - p.auth) / 100;
        if (dem.fac === 'radicals') want += (50 - p.auth) / 120;
    }
    const affordable = d.cost === 0 || treasury > d.cost * 2.2;
    storyEconResolveDemand(st, affordable && Math.random() < want);
}

// ── GIDA ENDEKSİ — şehirler ordu+nüfusu beslemeli ─────────────────────────
function storyEconFood(st) {
    const owned = STORY.nodes.filter(n => n.owner === st.id);
    if (!owned.length) return 1;
    // GERÇEK HARİTA KALİBRASYONU: 50 şehir tier'lı doğuyor (Sv.2 nüfus ~38k, Sv.3 ~66k).
    // Eski katsayılarla (kapasite 3+2L, yük 0.12·pop) büyük şehirler kendi nüfusunu
    // besleyemiyor, dünya kronik kıtlığa giriyordu (bench: ort. refah 30'a düştü).
    // Büyük şehir = büyük hinterlant: kapasite seviyeyle güçlü ölçeklenir.
    const capacity = owned.reduce((a, n) => a + 3 + (n.level || 1) * 4 + (n.cities || 0) * 2, 0);
    let army = 0;
    for (const c of storyStateCommanders(st)) army += (typeof cmdArmyCount === 'function') ? cmdArmyCount(c) : 0;
    const popLoad = owned.reduce((a, n) => a + (n.pop || 10) * 0.08, 0);
    return capacity / Math.max(1, army * 0.6 + popLoad);
}

// ── ANA TİK (4 sn) ─────────────────────────────────────────────────────────
function storyEconomyTick(dt) {
    for (const st of STORY.states) {
        if (!STORY.nodes.some(n => n.owner === st.id)) continue;
        storyEconBackfill(st);
        const atWar = STORY.states.some(s => s.id !== st.id && typeof storyIsHostile === 'function'
            && storyIsHostile(st.id, s.id) && STORY.nodes.some(n => n.owner === s.id));

        // ENFLASYON: savaş + kumanda ekonomisi körükler; barış + serbest piyasa soğutur (taban 2'ye)
        const lawEco = st.laws && st.laws.economy;
        let infDrift = (atWar ? 0.012 : -0.008) + (lawEco === 'command' ? 0.010 : (lawEco === 'free' ? -0.006 : 0));
        if (st.trust < 35) infDrift += 0.006;                       // güvensizlik pahalandırır
        st.inflation = Math.max(2, Math.min(30, st.inflation + infDrift * dt));
        if (st.inflation > 14) {                                    // yüksek enflasyonun toplumsal bedeli
            st.welfare = Math.max(0, st.welfare - (st.inflation - 14) * 0.003 * dt);
            if (st.factions) st.factions.workers = Math.max(5, st.factions.workers - (st.inflation - 14) * 0.004 * dt);
        }

        // GÜVEN: barışta ve düşük enflasyonda onarılır; yüksek enflasyon kemirir
        let trustDrift = (atWar ? -0.010 : 0.014) + (st.inflation > 15 ? -0.010 : 0.004);
        st.trust = Math.max(0, Math.min(100, st.trust + trustDrift * dt));
        // SERMAYE KAÇIŞI: güven dipte → para ülkeyi terk eder (120 sn soğumalı)
        if (st.trust < 30 && (STORY.clock - (st._lastFlight || -999)) > 120) {
            st._lastFlight = STORY.clock;
            for (const c of storyStateCommanders(st)) if (c.res) c.res.points *= 0.85;
            if (st.factions) st.factions.business = Math.max(5, st.factions.business - 5);
            st.trust += 8;                                          // kaçış sonrası kısmi rahatlama
            storyLog(`💸 <b>${st.name}</b>'de SERMAYE KAÇIŞI — hazine ⭐'ının %15'i yurt dışına çıktı.`);
            if (typeof storyNews === 'function') storyNews('flight', { st: st.name });
            if (typeof storyEraEvent === 'function') storyEraEvent('kacis');
        }

        // ⚡ ELEKTRONİK: Sv.2+ şehirler + gelişmiş fabrikalar üretir
        const owned = STORY.nodes.filter(n => n.owner === st.id);
        // ⚡ üretimi gerçek haritaya göre düşürüldü (çok sayıda Sv.2+ şehir 600sn'de
        // stoku 97'ye doyuruyordu — kapı anlamsızlaşıyordu; hedef ~15-30 bandı)
        const chipRate = owned.reduce((a, n) => a + ((n.level || 1) >= 2 ? 0.012 * (n.level - 1) : 0) + ((n.fac | 0) >= 2 ? 0.010 : 0), 0);
        st.chips = Math.min(99, st.chips + chipRate * dt);

        // 🌾 GIDA: kapasite aşılırsa kıtlık (90 sn soğumalı)
        const food = storyEconFood(st);
        if (food < 0.85 && (STORY.clock - (st._lastFamine || -999)) > 90) {
            st._lastFamine = STORY.clock;
            st.welfare = Math.max(0, st.welfare - 5);
            if (st.factions) st.factions.radicals = Math.min(95, st.factions.radicals + 4);
            storyLog(`🌾 <b>${st.name}</b>'de KITLIK — ordu ve nüfus şehirlerin besleyebileceğinden büyük (${(food * 100 | 0)}%).`);
            if (typeof storyNews === 'function') storyNews('famine', { st: st.name });
            if (st.isPlayer && typeof storyFlash === 'function') storyFlash('🌾 KITLIK — ordun ve nüfusun şehirlerini aştı: şehir kazan ya da orduyu küçült.');
        }

        // TALEPLER: masadaki süresi dolanı reddet; AI karar versin; yenisi doğsun (~48 sn'de bir zar)
        if (st._facDemand && STORY.clock > st._facDemand.until) storyEconResolveDemand(st, false);
        if (st._facDemand) storyEconAIDemand(st);
        st._accDemand = (st._accDemand || 0) + dt;
        if (st._accDemand >= 48) { st._accDemand = 0; storyEconSpawnDemand(st); }
    }
}

// ── ÜRETİM KAPISI: tank/topçu ⚡ ister ─────────────────────────────────────
function storyEconChipGate(st, type) {
    if (!st || ECON_CHIP_TYPES().indexOf(type) < 0) return true;
    storyEconBackfill(st);
    if (st.chips < ECON_CHIP_COST) return false;
    st.chips -= ECON_CHIP_COST;
    return true;
}
function storyEconChipNeeds(type) { return ECON_CHIP_TYPES().indexOf(type) >= 0 ? ECON_CHIP_COST : 0; }

// ── KONSEY OYU: enflasyon yüksekken soğutucu ekonomi kanunları ağırlaşır ───
// (AI'nın enflasyona TEPKİSİ budur — plan bunun test edilmesini istiyor)
function storyEconVoteTerm(item, optId, st) {
    if (!st || st.inflation == null || !item || item.lawSlot !== 'economy') return 0;
    const cooling = { free: 1.5, mixed: 0.5, command: -2.0 };
    return Math.max(0, st.inflation - 10) * 0.35 * (cooling[optId] || 0);
}

// ── UI: FRAKSİYONLAR sekmesine EKONOMİ bölümü + talep kartı ───────────────
function storyEconHtml(st) {
    if (!st) return '';
    storyEconBackfill(st);
    const infCol = st.inflation > 15 ? '#ff5a5a' : (st.inflation > 8 ? '#ffd24c' : '#4cff7c');
    const trCol = st.trust < 30 ? '#ff5a5a' : (st.trust < 50 ? '#ffd24c' : '#4cff7c');
    const food = storyEconFood(st);
    const foodCol = food < 0.85 ? '#ff5a5a' : (food < 1.1 ? '#ffd24c' : '#4cff7c');
    let dem = '';
    if (st._facDemand) {
        const d = ECON_DEMANDS[st._facDemand.fac];
        const left = Math.max(0, Math.ceil(st._facDemand.until - STORY.clock));
        dem = `<div class="fac-demand">${d.icon} <b>${d.name}</b>${d.cost ? ` · ${d.cost}⭐` : ''} <em>${left}sn</em>
            <div class="fd-btns"><button class="city-btn fd-btn" data-dem="1">KABUL</button>
            <button class="city-btn fd-btn" data-dem="0">REDDET</button></div>
            <div class="fac-log">Kabul: ${Object.entries(d.accept).map(([k, v]) => (FACTIONS.find(f => f.k === k) || {}).icon + (v > 0 ? '+' : '') + v).join(' ')}
             · Ret: ${Object.entries(d.reject).map(([k, v]) => (FACTIONS.find(f => f.k === k) || {}).icon + (v > 0 ? '+' : '') + v).join(' ')}</div></div>`;
    }
    return `<div class="fac-box econ-box"><div class="fac-logs-t">EKONOMİ</div>
        <div class="econ-row"><span>📈 Enflasyon</span><b style="color:${infCol}">%${st.inflation.toFixed(1)}</b><small>geliri kırpar, halkı yorar</small></div>
        <div class="econ-row"><span>🤝 Piyasa güveni</span><b style="color:${trCol}">${Math.round(st.trust)}</b><small>⭐ gelirini oynatır; dipte sermaye kaçar</small></div>
        <div class="econ-row"><span>⚡ Elektronik stoku</span><b>${Math.floor(st.chips)}</b><small>tank/topçu üretimi ${ECON_CHIP_COST}⚡ ister</small></div>
        <div class="econ-row"><span>🌾 Gıda dengesi</span><b style="color:${foodCol}">%${Math.round(food * 100)}</b><small>&lt;%85 kıtlık: şehirler orduyu beslemeli</small></div>
        ${dem}</div>`;
}

// Talep düğmeleri (konsey çekmecesi içinde) — tek küresel delegasyon
if (typeof document !== 'undefined') {
    document.addEventListener('click', e => {
        const b = e.target && e.target.closest ? e.target.closest('.fd-btn') : null;
        if (!b) return;
        const me = (typeof storyPlayerState === 'function') ? storyPlayerState() : null;
        if (me) { storyEconResolveDemand(me, b.dataset.dem === '1'); if (typeof storySave === 'function') storySave(); }
    });
}
