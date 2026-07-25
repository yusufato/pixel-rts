// ═══════════════════════════════════════════════════════════════════════════
//  DÜNYA ARAYÜZÜ — üst panel, konsey/teknoloji/ordu drawer'ları, bağlama
//  ---------------------------------------------------------------------------
//  Story.js'ten AYRILDI (davranış değişmedi, yalnız kod taşındı).
//  Story.js 2625 satıra çıkmıştı; okunabilirlik için uyumlu parçalara bölündü.
//  Küresel script düzeni: bu dosya Story.js'ten SONRA yüklenir. Hepsi fonksiyon
//  tanımı olduğu için (hoisting) çağrı sırası etkilenmez.
// ═══════════════════════════════════════════════════════════════════════════

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
            ((me.chips != null) ? `<div class="story-stat-chip" title="Elektronik stoku — tank/topçu üretimi ister">⚡<b>${Math.floor(me.chips)}</b></div>` : '') +
            ((me.inflation != null) ? `<div class="story-stat-chip${me.inflation > 15 ? ' urgent' : ''}" title="Enflasyon geliri kırpar, halkı yorar">ENF<b>%${me.inflation.toFixed(0)}</b></div>` : '') +
            `<div class="story-stat-chip wide">TARİH<b>${date}</b></div>` +
            ((typeof storyEra === 'function') ? (() => { const e = storyEra();
                return `<div class="story-stat-chip wide" title="${e.desc}">ÇAĞ<b style="color:${e.color}">${e.icon} ${e.name}</b></div>`; })() : '') +
            '';   // KONSEY geri-sayım çipi kaldırıldı (kullanıcı isteği) — takvim konsey panelinde
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
        const mapName = (typeof DRAWN_MAP !== 'undefined' && DRAWN_MAP.name) ? DRAWN_MAP.name : 'Çizilen Harita';
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
    storyCouncilClose(); storyTechClose(); storyCityClose(); if (typeof storyNewsClose === 'function') storyNewsClose();
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
        + ((typeof charDiceBadge === 'function') ? charDiceBadge(c.skills) : '')
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

    // 3) YOLDAKİ ÜRETİM (kuyrukta bekleyen siparişler — depo kaldırıldı)
    const busy = STORY.nodes.filter(n => n.owner === me.id && (n.q || []).length);
    const depTotal = busy.reduce((a, n) => a + n.q.length, 0);
    const depRows = busy.map(n => {
        const eta = Math.ceil(Math.min(...n.q.map(j => j.t)));
        const who = n.q.map(j => { const c = storyCommanderById(me.id, j.cmd); return c ? c.name.split(' ')[0] : '—'; });
        return `<div class="army-cmd-row"><span class="acr-n">🏭 ${n.name}</span>`
            + `<span class="acr-loc">${[...new Set(who)].join(', ')} için</span>`
            + `<span class="acr-ct">${n.q.length} · ${eta}sn</span></div>`;
    }).join('');
    html += `<div class="army-section"><div class="army-h">🏭 YOLDAKİ ÜRETİM <b>${depTotal} birlik</b></div>`
        + `<div class="army-note">Biten birlik <b>doğrudan sipariş eden komutanın ordusuna</b> katılır. Depo yok.</div>`
        + (busy.length ? `<div class="army-cmds">${depRows}</div>` : `<div class="army-note">Üretim kuyruğu boş — şehirlerine gir ve birlik bas.</div>`)
        + `</div>`;

    // 4) TOPLAM + GAZİLER
    html += `<div class="army-section"><div class="army-h">📊 DEVLET TOPLAMI</div>`
        + `<div class="army-tot"><span>Sefer orduları</span><b>${myN + othTotal}</b></div>`
        + `<div class="army-tot"><span>Yoldaki üretim</span><b>${depTotal}</b></div>`
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

    // KASAN bölümü kaldırıldı (kullanıcı: kasa ana panelde zaten görünüyor)
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
    STORY._cw = cv.width; STORY._ch = cv.height;                     // WARP: düğüm ekran ortasına
    storyCam.x = node.lx * STORY_WORLD_W - (cv.width / 2) / storyCam.zoom;
    storyCam.y = node.ly * STORY_WORLD_H - storyVyOf(0.5) / storyCam.zoom;
    storyClampCam(cv.width, cv.height);
}
function storyCouncilUpdate() {
    if (!STORY._councilOpen) return;
    const me = storyPlayerState(); if (!me) return;
    const isAdmin = !!(me.gov && me.gov.leader === 'player');
    const banner = document.getElementById('council-admin-banner');
    if (banner) banner.innerHTML =
        `<div class="story-res">🏛️ Cumhurbaşkanı: <b style="color:${isAdmin ? '#4cff7c' : '#ffd24c'}">${isAdmin ? (STORY.commander ? STORY.commander.name + ' (SEN)' : 'SEN') : ((typeof storyPresidentName === 'function') ? storyPresidentName(me) : 'AI')}</b></div>`
        + storyBar('Refah', me.welfare, '#54e08a')
        + `<div class="story-res">🏅 İtibar <b>${me.reputation}/6</b>${isAdmin ? '' : (me.reputation >= 6 && me.welfare >= 60 ? ' <span style="color:#4cff7c">— seçime hazırsın!</span>' : ` <span style="color:#9fb3c8">(seçim: itibar≥6 + refah≥60)</span>`)}</div>`
        + (isAdmin ? `<div class="story-res" style="color:#4cff7c;font-size:12px">🎖️ Komutan yaratabilir/dağıtabilirsin.</div>` : `<div class="story-res" style="color:#9fb3c8;font-size:12px">🔒 Yönetici olunca komutanları yönetirsin.</div>`);
    const cmds = storyPlayerCommanders();
    const myr = (STORY.commander && STORY.commander.res) || { oil: 0, manpower: 0, points: 0 };
    const inc = STORY._incPerCmd || { oil: 0, manpower: 0, points: 0 };
    const tre = document.getElementById('council-treasury');
    // 'Senin kasan' satırı kaldırıldı (kullanıcı: kasa ana panelde zaten görünüyor)
    if (tre) tre.innerHTML = `💰 Devlet hazinesi: ⛽<b>${Math.floor(me.res.oil)}</b> 👥<b>${Math.floor(me.res.manpower)}</b> ⭐<b>${Math.floor(me.res.points)}</b>`
        + `<br><span style="color:#9fb3c8;font-size:12px">${cmds.length} komutan · gelir/komutan ⛽${inc.oil.toFixed(1)} 👥${inc.manpower.toFixed(1)} ⭐${inc.points.toFixed(1)} /sn (sabit)</span>`;
    // EN GÜÇLÜ (oyuncu hariç) + sıralama (oyuncu üst, sonra skill-toplam azalan)
    const skSum = c => c.skills ? (c.skills.warrior + c.skills.diplomat + c.skills.economist) : 0;
    let bestId = -1, bestSum = -1;
    for (const c of cmds) { if (c.isPlayer) continue; const s = skSum(c); if (s > bestSum) { bestSum = s; bestId = c.id; } }
    const sorted = cmds.slice().sort((a, b) => (a.isPlayer !== b.isPlayer) ? (a.isPlayer ? -1 : 1) : (skSum(b) - skSum(a)));
    const list = document.getElementById('council-list');
    // CUMHURBAŞKANI KARTI: sivil lider komutan listesinin ÜSTÜNDE ayrı görünür —
    // 'başkan listede yok' karışıklığı biter (o bir komutan değil, devletin lideri).
    const presCard = (typeof storyPresidentName === 'function')
        ? `<div class="pres-card">🏛️ <b>${storyPresidentName(me)}</b> — Cumhurbaşkanı <span class="pres-note">${isAdmin ? '(sensin)' : '(sivil lider — komutan değildir)'}</span></div>` : '';
    if (list) list.innerHTML = presCard + sorted.map(c => {
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
            + ((typeof charDiceBadge === 'function') ? charDiceBadge(c.skills) : storyCouncilSkillBars(c.skills))
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
    const facbox = document.getElementById('council-facbox');
    if (facbox && typeof storyFacHtml === 'function') facbox.innerHTML = storyFacHtml(me);   // AŞAMA 2
    storyCouncilSyncTabs();
}
// Aktif sekmeyi göster/gizle (komutan listesi ↔ kanun/anayasa)
function storyCouncilSyncTabs() {
    const tab = STORY._councilTab || 'cmd';
    document.querySelectorAll('#council-tabs .ctab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById('council-tab-cmd')?.classList.toggle('hidden', tab !== 'cmd');
    document.getElementById('council-tab-law')?.classList.toggle('hidden', tab !== 'law');
    document.getElementById('council-tab-fac')?.classList.toggle('hidden', tab !== 'fac');
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
    document.getElementById('story-news-btn')?.addEventListener('click', () => (typeof storyNewsToggle === 'function') && storyNewsToggle());
    document.getElementById('news-close')?.addEventListener('click', () => (typeof storyNewsClose === 'function') && storyNewsClose());
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
        if (b.classList.contains('cb-sub')) { STORY._citySub = b.dataset.sub; return (typeof storyCityUpdate === 'function') && storyCityUpdate(); }
        if (b.classList.contains('cb-up')) return storyCityUpgrade(+b.dataset.node);   // (eski kayıt uyumu — düğme artık üretilmiyor)
        if (b.classList.contains('cb-gar')) return storyCityGarrison(+b.dataset.node);
        if (b.classList.contains('cb-build')) return prodBuild(+b.dataset.node, b.dataset.kind);
        if (b.classList.contains('cb-make')) return prodEnqueue(+b.dataset.node, +b.dataset.type);
        if (b.classList.contains('cb-cancel')) return prodCancel(+b.dataset.node, +b.dataset.idx);
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
            STORY._cw = cv.width; STORY._ch = cv.height;
            return storyS2W(mx, my);                    // 2.5D warp tersinimi (düz bölme değil)
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
        // WARP: imlecin altındaki DÜNYA noktası parmağa yapışsın diye s2w farkıyla kaydır
        let dragging = false, moved = false, lastX = 0, lastY = 0;
        cv.addEventListener('mousedown', (e) => { dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY; });
        window.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            if (Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY) > 3) moved = true;
            STORY._cw = cv.width; STORY._ch = cv.height;
            const rect = cv.getBoundingClientRect(), sc = cv.width / rect.width, scy = cv.height / rect.height;
            const a = storyS2W((lastX - rect.left) * sc, (lastY - rect.top) * scy);
            const b = storyS2W((e.clientX - rect.left) * sc, (e.clientY - rect.top) * scy);
            storyCam.x += a.x - b.x; storyCam.y += a.y - b.y; lastX = e.clientX; lastY = e.clientY;
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
            STORY._cw = cv.width; STORY._ch = cv.height;
            const wpt = storyS2W(mx, my);               // imleç altındaki dünya noktası (warp)
            storyCam.zoom = Math.max(storyMinZoom(cv.width, cv.height), Math.min(5, storyCam.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
            // aynı ekran noktası aynı dünya noktasını göstersin: cam = dünya − vec/z
            const u = my / cv.height, vy = storyVyOf(u), vx = (mx - cv.width / 2) / storySxOf(u) + cv.width / 2;
            storyCam.x = wpt.x - vx / storyCam.zoom; storyCam.y = wpt.y - vy / storyCam.zoom;
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
        else if (k === '-' || k === '_') { const c = document.getElementById('storyCanvas'); storyCam.zoom = Math.max(storyMinZoom(c ? c.width : 800, c ? c.height : 600), storyCam.zoom / 1.2); m = true; }
        if (m) { const c = document.getElementById('storyCanvas'); if (c) storyClampCam(c.width, c.height); storyRender(); e.preventDefault(); }
    });
    window.addEventListener('resize', () => {
        if (typeof APP_SCREEN === 'undefined' || APP_SCREEN !== 'story') return;
        const c = document.getElementById('storyCanvas'); storyResize(); if (c) storyClampCam(c.width, c.height); storyRender();
    });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', storyInit);
else storyInit();
