// ═══════════════════════════════════════════════════════════════════════════
//  ÜRETİM & ORDU HAVUZU  (Hikâye modu — FAZ-3)
//  ---------------------------------------------------------------------------
//  Ordu artık savaşa girerken bütçeyle dizilmez; ŞEHİRLERDE üretilip havuzda
//  birikir. Fabrika zırhlı sınıfı, kışla yaya sınıfı basar. Üretim süreli bir
//  kuyruktan geçer, biten birlik o şehrin havuzuna düşer.
//
//  Tasarım kararları:
//   • Havuz DÜĞÜMDE tutulur (komutanda değil) → şehri kaybetmek orduyu da
//     kaybettirir; kalıcılık bedava gelir (nodes zaten storySave'de).
//   • Bina SEVİYE'dir (0-3), sayı değil → mevcut level/garrison diliyle aynı.
//   • Bina seviyesi ≤ şehir seviyesi → şehir yükseltmesi teknoloji kapısı olur.
//   • prodTick TÜM düğümleri gezer → oyuncu ve AI tek kod yolunu paylaşır.
// ═══════════════════════════════════════════════════════════════════════════

// ── BİNA ──
// Maliyet ⭐puan (şehir yükseltmesiyle aynı kasa). index = mevcut seviye → bir üstü.
const FACTORY_COST = [260, 480, 900];    // fabrika pahalı: ağır sanayi
const BARRACKS_COST = [150, 300, 560];   // kışla ucuz: piyade altyapısı
const PROD_MAX_LEVEL = 3;

// Fabrika = paletli/zırhlı sınıf. Kalan her şey kışlada üretilir.
const FACTORY_TYPES = [T.ARMOR, T.ANTI_TANK, T.ARMOR_INFANTRY];
function prodBuildingFor(type) { return FACTORY_TYPES.indexOf(type) >= 0 ? 'fac' : 'bar'; }
function prodBuildingName(kind) { return kind === 'fac' ? 'Fabrika' : 'Kışla'; }
function prodBuildCost(kind, lvl) {
    const tbl = kind === 'fac' ? FACTORY_COST : BARRACKS_COST;
    return tbl[lvl] != null ? tbl[lvl] : null;   // null = maksimum
}
// Bina şehirden ileri gidemez: Sv.3 tank fabrikası ancak Sv.3 şehirde kurulur.
function prodMaxBuildLevel(n) { return n.level || 1; }

// Seviye kilitleri — üretim kademelenir (Sv.1 kışla piyade, Sv.3 fabrika tank)
const PROD_UNLOCK = {
    bar: { 1: [T.INFANTRY, T.RECON], 2: [T.ENGINEER, T.MEDIC], 3: [T.MECH_INFANTRY, T.ARTILLERY] },
    fac: { 1: [T.ANTI_TANK], 2: [T.ARMOR_INFANTRY], 3: [T.ARMOR] }
};
function prodTypesFor(n, kind) {
    const lv = n[kind] | 0;
    let out = [];
    for (let i = 1; i <= lv; i++) out = out.concat(PROD_UNLOCK[kind][i] || []);
    return out;
}

// ── ÜRETİM SÜRESİ / KAPASİTE ──
const PROD_SPEED = [0, 1.0, 1.6, 2.2];   // bina seviyesi → hız çarpanı
function prodTime(n, kind, type) {
    const lv = Math.max(1, n[kind] | 0);
    const cost = (STATS[type] && STATS[type].cost) || 70;
    return Math.max(4, Math.round((cost / 12) / PROD_SPEED[lv]));   // tank ~11sn, piyade ~6sn
}
function prodSlots(n, kind) { return 2 + (n[kind] | 0); }
function prodQueueCount(n, kind) {
    let c = 0;
    for (const j of (n.q || [])) if (prodBuildingFor(j.type) === kind) c++;
    return c;
}
// Havuz tavanı: sonsuz yığılmayı engeller (tam gelişmiş Sv.3 şehir ≈ 36 birim)
function prodPoolCap(n) { return 6 + (n.level || 1) * 4 + ((n.fac | 0) + (n.bar | 0)) * 3; }
function prodPoolCount(n) {
    let c = 0;
    for (const k in (n.pool || {})) c += n.pool[k] | 0;
    return c;
}

// ── ESKİ KAYIT BACKFILL (storyCommanderBackfill deseni) ──
function storyNodeBackfill(n) {
    if (!n) return;
    if (n.level == null) n.level = 1;
    if (n.garrison == null) n.garrison = 0;
    if (n.fac == null) n.fac = 0;
    if (n.bar == null) n.bar = 0;
    if (!n.pool || typeof n.pool !== 'object') n.pool = {};
    if (!Array.isArray(n.q)) n.q = [];
    n._siege = null;   // kuşatma transient
}

// ── HAVUZ GÜCÜ (stratejik katman görsün) ──
// Şehirde bekleyen ordu savunma gücüne katılır → AI "iyi savunulan şehre saldırma"yı
// ekstra kod olmadan öğrenir (storyEvalTarget/storyExposureAt bunu okur).
function storyPoolPower(n) {
    let v = 0;
    for (const k in (n.pool || {})) v += ((STATS[+k] && STATS[+k].cost) || 70) * (n.pool[k] | 0);
    return Math.round(v / 20);   // 280'lik tank ≈ 14 puan (garnizon birimi = 10 ile aynı ölçek)
}

// ── BİNA KUR / YÜKSELT ──
function prodBuild(nodeId, kind) {
    const n = storyNode(nodeId);
    if (!n || n.owner !== STORY.playerStateId) return false;
    if (kind !== 'fac' && kind !== 'bar') return false;
    const lvl = n[kind] | 0;
    if (lvl >= PROD_MAX_LEVEL) { storyFlash(`${prodBuildingName(kind)} zaten maksimum seviye.`); return false; }
    if (lvl >= prodMaxBuildLevel(n)) {
        storyFlash(`Önce şehri yükselt — ${prodBuildingName(kind)} şehir seviyesini (Sv.${n.level || 1}) geçemez.`);
        return false;
    }
    const cost = prodBuildCost(kind, lvl);
    const w = STORY.commander && STORY.commander.res;
    if (!w || (w.points || 0) < cost) { storyFlash(`⭐ Puan yetersiz (gerekli ${cost}).`); return false; }
    w.points -= cost;
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
    if (prodPoolCount(n) + prodQueueCount(n, 'fac') + prodQueueCount(n, 'bar') >= prodPoolCap(n)) {
        storyFlash(`Havuz dolu (${prodPoolCap(n)}) — şehri veya binaları yükselt.`);
        return false;
    }
    const g = UNIT_RES_GROUP[type] || 'manpower';
    const cost = (STATS[type] && STATS[type].cost) || 70;
    const w = STORY.commander && STORY.commander.res;
    if (!w || (w[g] || 0) < cost) { storyFlash(`Kaynak yetersiz (${cost} ${g}).`); return false; }
    w[g] -= cost;
    const t = prodTime(n, kind, type);
    n.q.push({ type, t, tot: t });
    storySave();
    if (typeof storyCityUpdate === 'function') storyCityUpdate();
    return true;
}

// İptal → %50 iade (plan değiştirmeyi cezalandırır ama kilitlemez)
function prodCancel(nodeId, idx) {
    const n = storyNode(nodeId);
    if (!n || n.owner !== STORY.playerStateId || !n.q || !n.q[idx]) return false;
    const job = n.q[idx];
    const g = UNIT_RES_GROUP[job.type] || 'manpower';
    const back = Math.round(((STATS[job.type] && STATS[job.type].cost) || 70) * 0.5);
    const w = STORY.commander && STORY.commander.res;
    if (w) w[g] = (w[g] || 0) + back;
    n.q.splice(idx, 1);
    storyLog(`✖ ${STATS[job.type].name} üretimi iptal (+${back} iade).`);
    storySave();
    if (typeof storyCityUpdate === 'function') storyCityUpdate();
    return true;
}

// ── TICK: tüm düğümler (oyuncu + AI aynı motor) ──
// Fabrika ve kışla PARALEL hat işletir: biri tank yaparken diğeri piyade basar.
function prodTick(step) {
    if (typeof STORY === 'undefined' || !STORY.nodes) return;
    for (const n of STORY.nodes) {
        if (!n.q || !n.q.length) continue;
        const busy = { fac: 0, bar: 0 };
        for (const job of n.q) {
            const k = prodBuildingFor(job.type);
            if (busy[k]) continue;          // o bina bu tick zaten bir iş işliyor
            busy[k] = 1;
            job.t -= step;
        }
        for (let i = n.q.length - 1; i >= 0; i--) {
            if (n.q[i].t > 0) continue;
            const ty = n.q[i].type;
            n.q.splice(i, 1);
            if (prodPoolCount(n) >= prodPoolCap(n)) {   // tavan doluysa üretim beklemede kalır
                n.q.push({ type: ty, t: 1, tot: 1 });
                continue;
            }
            n.pool[ty] = (n.pool[ty] | 0) + 1;
            if (n.owner === STORY.playerStateId && typeof storyLog === 'function') {
                storyLog(`🏭 <b>${n.name}</b>: ${STATS[ty].name} hazır (havuz ${prodPoolCount(n)}/${prodPoolCap(n)}).`);
            }
        }
    }
}

// ── HAVUZ TOPLAMA (savaşa girerken) ──
// Savaş şehri + BİTİŞİK dost şehirler birleşir — storyForceNear'ın komutanlar için
// işlettiği kuralın aynısı. Bitişikler katılmazsa saldırıya uğrayan sınır şehri yalnız kalır.
function storyMusterPool(stateId, nodeId) {
    const node = storyNode(nodeId);
    if (!node) return { avail: {}, src: [] };
    const ids = [nodeId].concat(node.neighbors || []);
    const avail = {}, src = [];
    for (const id of ids) {
        const m = storyNode(id);
        if (!m || m.owner !== stateId || !m.pool) continue;
        const take = {};
        for (const k in m.pool) {
            const c = m.pool[k] | 0;
            if (c > 0) { avail[k] = (avail[k] | 0) + c; take[k] = c; }
        }
        if (Object.keys(take).length) src.push({ nodeId: id, counts: take });
    }
    return { avail, src };
}

// Havuzu kaynak düğümlerden DÜŞ (savaş başında) — kayıp kalıcı olsun diye
function storyDrainPool(src) {
    for (const s of (src || [])) {
        const n = storyNode(s.nodeId);
        if (!n || !n.pool) continue;
        for (const k in s.counts) {
            n.pool[k] = Math.max(0, (n.pool[k] | 0) - (s.counts[k] | 0));
            if (!n.pool[k]) delete n.pool[k];
        }
    }
}

// Savaş sonu iade: sağ kalanlar + hiç dizilmeyenler havuza döner
function storyReturnPool(counts, preferNode, stateId, src) {
    let target = null;
    if (preferNode && preferNode.owner === stateId) target = preferNode;        // savaşın şehri (fethettiysen ordun orada konuşlanır)
    if (!target) {                                                              // değilse kaynak düğümlerden hâlâ bizde olan ilki
        for (const s of (src || [])) { const n = storyNode(s.nodeId); if (n && n.owner === stateId) { target = n; break; } }
    }
    if (!target && STORY.commander) target = storyNode(STORY.commander.node);    // son çare: komutanın şehri
    if (!target || target.owner !== stateId) return 0;
    if (!target.pool) target.pool = {};
    let placed = 0;
    const cap = prodPoolCap(target);
    for (const k in (counts || {})) {
        let c = counts[k] | 0;
        while (c > 0 && prodPoolCount(target) < cap) { target.pool[k] = (target.pool[k] | 0) + 1; c--; placed++; }
    }
    return placed;
}

// ═══════════════════════════════════════════════════════════════════════════
//  ŞEHRE GİR PANELİ  (Story.js'ten taşındı — artık tüm şehir listesi değil, TEK şehir)
// ═══════════════════════════════════════════════════════════════════════════

// Odaktaki şehir: haritada seçtiğin (senin ise), yoksa komutanının bulunduğu şehir
function storyCityFocus() {
    const sel = storyNode(STORY.selectedNodeId);
    if (sel && sel.owner === STORY.playerStateId) return sel;
    return storyNode(STORY.commander && STORY.commander.node);
}

function storyCityOpen() {
    storyCouncilClose(); storyTechClose(); storyArmyClose();
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
        const afford = (wallet[g] || 0) >= s.cost;
        const sec = unlocked ? prodTime(n, kind, t) : prodTime({ [kind]: lv, level: n.level }, kind, t);
        html += unlocked
            ? `<button class="prod-btn cb-make" data-node="${n.id}" data-type="${t}" ${afford ? '' : 'disabled'} title="${s.name} — ${s.cost}${icon}, ${sec} sn">`
              + `<b>${s.name}</b><small>${icon}${s.cost} · ${sec}sn</small></button>`
            : `<button class="prod-btn locked" disabled title="Sv.${lv} gerekli"><b>${s.name}</b><small>🔒 Sv.${lv}</small></button>`;
    }
    return html;
}

function prodBuildingSection(n, kind, wallet) {
    const lvl = n[kind] | 0;
    const cost = prodBuildCost(kind, lvl);
    const icon = kind === 'fac' ? '🏭' : '🎖️';
    const label = kind === 'fac' ? 'FABRİKA' : 'KIŞLA';   // toUpperCase() Türkçe'de 'i'→'I' yapıyor, sabit metin kullanılır
    const maxed = lvl >= PROD_MAX_LEVEL;
    const cityBlocked = !maxed && lvl >= prodMaxBuildLevel(n);
    let head = `<div class="prod-head"><span>${icon} ${label} <b>Sv.${lvl}/${PROD_MAX_LEVEL}</b></span>`;
    if (maxed) head += `<span class="city-max">Maks</span>`;
    else if (cityBlocked) head += `<span class="prod-lock" title="Bina şehir seviyesini geçemez">🔒 Şehir Sv.${n.level || 1}</span>`;
    else head += `<button class="city-btn cb-build" data-node="${n.id}" data-kind="${kind}" ${(wallet.points || 0) < cost ? 'disabled' : ''}>`
        + `${lvl === 0 ? 'Kur' : `Sv.${lvl + 1}`} (${cost}⭐)</button>`;
    head += `</div>`;
    const body = lvl > 0
        ? `<div class="prod-grid">${prodUnitButtons(n, kind, wallet)}</div>`
        : `<div class="city-hint">${prodBuildingName(kind)} kurulmadı — bu sınıf birlikler üretilemez.</div>`;
    return `<div class="prod-sec">${head}${body}</div>`;
}

function prodQueueSection(n) {
    const q = n.q || [];
    if (!q.length) return `<div class="prod-sec"><div class="prod-head"><span>⏳ ÜRETİM</span><span class="city-max">kuyruk boş</span></div></div>`;
    let html = `<div class="prod-sec"><div class="prod-head"><span>⏳ ÜRETİM</span>`
        + `<span class="city-max">🏭 ${prodQueueCount(n, 'fac')}/${prodSlots(n, 'fac')} · 🎖️ ${prodQueueCount(n, 'bar')}/${prodSlots(n, 'bar')}</span></div>`;
    // Her binanın SIRADAKİ işi ilerler (paralel hat) — kalanlar "bekliyor"
    const active = { fac: 0, bar: 0 };
    q.forEach((job, i) => {
        const kind = prodBuildingFor(job.type);
        const running = !active[kind];
        if (running) active[kind] = 1;
        const pct = Math.max(0, Math.min(100, (1 - job.t / Math.max(1, job.tot)) * 100));
        html += `<div class="prod-row"><span class="prod-name">${kind === 'fac' ? '🏭' : '🎖️'} ${STATS[job.type].name}</span>`
            + `<i class="prod-bar"><b style="width:${pct.toFixed(0)}%"></b></i>`
            + `<span class="prod-eta">${running ? Math.ceil(job.t) + 's' : 'bekliyor'}</span>`
            + `<button class="city-btn cb-cancel" data-node="${n.id}" data-idx="${i}" title="İptal (%50 iade)">✖</button></div>`;
    });
    return html + `</div>`;
}

function prodPoolSection(n) {
    const pool = n.pool || {};
    const total = prodPoolCount(n), cap = prodPoolCap(n);
    let items = '';
    for (const k in pool) {
        const c = pool[k] | 0; if (c <= 0) continue;
        items += `<span class="pool-item">${STATS[+k].name} <b>×${c}</b></span>`;
    }
    return `<div class="prod-sec"><div class="prod-head"><span>⚔️ ORDU HAVUZU <b>${total}/${cap}</b></span></div>`
        + (items ? `<div class="pool-grid">${items}</div>`
                 : `<div class="city-hint">Havuz boş — savaşa girersen acil seferberlik milisi dizilir.</div>`)
        + `<div class="city-hint">Savaşa girince bu birlikleri sahaya SEN yerleştirirsin. Kayıplar havuzdan kalıcı düşer.</div></div>`;
}

function storyCityUpdate() {
    if (!STORY._cityOpen) return;
    const body = document.getElementById('city-body'); if (!body) return;
    const mine = STORY.nodes.filter(x => x.owner === STORY.playerStateId);
    const n = storyCityFocus();
    const title = document.getElementById('city-title');
    if (title) title.textContent = n ? n.name.toLocaleUpperCase('tr') : 'ŞEHİR';   // 'tr' şart: toUpperCase() 'i'→'I' yapar
    if (!n || n.owner !== STORY.playerStateId) { body.innerHTML = `<div class="city-hint">Hiç şehrin yok.</div>`; return; }

    const w = (STORY.commander && STORY.commander.res) || { oil: 0, manpower: 0, points: 0 };
    const lvl = n.level || 1, gar = n.garrison || 0, cap = storyCityGarrisonCap(n);
    const upCost = lvl < 3 ? CITY_UPGRADE_COST[lvl] : null;
    const here = (STORY.commander && STORY.commander.node === n.id) ? ' 📍' : '';
    const isCap = (STORY._capitals && STORY._capitals.indexOf(n.id) >= 0) ? ' ★' : '';

    // Şehirlerim şeridi — tam liste yerine navigasyon (hangi şehrimde ne var, tek bakışta)
    let chips = '';
    for (const c of mine.slice().sort((a, b) => ((b.level || 1) - (a.level || 1)) || (prodPoolCount(b) - prodPoolCount(a)))) {
        chips += `<button class="city-chip${c.id === n.id ? ' sel' : ''}" data-node="${c.id}" title="${c.name}">`
            + `${c.name} <em>Sv.${c.level || 1}</em>`
            + ((c.fac | 0) ? ` 🏭${c.fac}` : '') + ((c.bar | 0) ? ` 🎖️${c.bar}` : '')
            + (prodPoolCount(c) ? ` ⚔️${prodPoolCount(c)}` : '') + `</button>`;
    }

    body.innerHTML =
        `<div class="city-chips">${chips}</div>`
        + `<div class="city-top">🏰 <b>${n.name}</b>${here}${isCap} · Sv.${lvl}`
        + `<div class="city-stat">Gelir ⛽${n.oil || 0} 👥${n.cities || 0} ⭐${n.pts || 0} · kasan ⛽<b>${Math.floor(w.oil)}</b> 👥<b>${Math.floor(w.manpower)}</b> ⭐<b>${Math.floor(w.points)}</b></div>`
        + `<div class="city-acts">`
        + (upCost != null
            ? `<button class="city-btn cb-up" data-node="${n.id}" ${(w.points || 0) < upCost ? 'disabled' : ''}>🏗️ Şehir Sv.${lvl + 1} (${upCost}⭐)</button>`
            : `<span class="city-max">Şehir Maks Sv.3</span>`)
        + `</div></div>`
        + prodBuildingSection(n, 'fac', w)
        + prodBuildingSection(n, 'bar', w)
        + prodQueueSection(n)
        + `<div class="prod-sec"><div class="prod-head"><span>🛡️ GARNİZON <b>${gar}/${cap}</b></span>`
        + `<button class="city-btn cb-gar" data-node="${n.id}" ${(gar >= cap || (w.manpower || 0) < CITY_GARRISON_COST) ? 'disabled' : ''}>+1 (${CITY_GARRISON_COST}👥)</button></div>`
        + `<div class="city-hint">Savunma düellosunda birlik olarak savaşır; kuşatma savunmasını güçlendirir.</div></div>`
        + prodPoolSection(n);
}

// ── AI BÜTÇESİ: havuzdan türetilir ──
// Adalet şartı: kimse kurmadığı orduyu sahaya süremez. AI hâlâ tipli bütçe harcar
// (aiDeploy / DEPLOY_RES.red dalı değişmez) ama o bütçe artık GERÇEKTEN ürettiği ordunun değeri.
function storyPoolBudget(stateId, cityId, opts) {
    opts = opts || {};
    const m = storyMusterPool(stateId, cityId);
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
