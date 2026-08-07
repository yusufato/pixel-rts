// ═══════════════════════════════════════════════════════════════════════════
//  KOMUTAN GELİŞİM AĞACI (PIXEL EUROPA — Faz-7)
//  ---------------------------------------------------------------------------
//  Devlet teknolojisi KONSEY kararıdır; kişisel gelişim SENİN kararındır.
//  Eski 3-slotlu perk sistemi (WAR_ROOM_PERKS) buraya ERİTİLDİ: aynı id'ler
//  ağacın düğümleri oldu, "aç-kapa" yerine LİYAKAT PUANI ile KALICI açılıyor.
//  Böylece iki paralel ilerleme sistemi kalmadı.
//
//  Üç dal, üç oyun sistemine bağlanır:
//    ⚔️ HARP    → düello (zırh/hasar) + sefer ordusu kapasitesi
//    🏗️ İDARE   → üretim hızı, bina maliyeti, gelir payı
//    🕊️ SİYASET → konsey oy ağırlığı, ezme bedeli, sohbet/diplomasi
//
//  LİYAKAT PUANI (LP) = (rütbe−1)×3 + zafer sayısı.  Türetilmiş değerdir:
//  ayrı sayaç tutulmaz, kayıt bozulsa bile kendini onarır.
// ═══════════════════════════════════════════════════════════════════════════

const CMDR_LP_PER_RANK = 3;
const CMDR_TIER_RANK = { 1: 1, 2: 3, 3: 5 };   // kademe → gereken rütbe

const CMDR_TREE = {
    branches: [
        { key: 'war',  icon: '⚔️', name: 'HARP',    color: '#ff9a4c', desc: 'Düelloda üstünlük ve daha büyük sefer ordusu.' },
        { key: 'adm',  icon: '🏗️', name: 'İDARE',   color: '#4cff7c', desc: 'Üretim, inşaat ve gelir payı.' },
        { key: 'pol',  icon: '🕊️', name: 'SİYASET', color: '#9fd2ff', desc: 'Konsey ağırlığı, sadakat ve diplomasi.' },
    ],
    nodes: [
        // ══ ⚔️ HARP ══
        { id: 'drillmaster', branch: 'war', tier: 1, cost: 1, name: 'Talimci',        desc: 'Sefer ordusu kapasiten +3',                 prereq: [],              effect: { armyCap: 3 } },
        { id: 'schwerpunkt', branch: 'war', tier: 1, cost: 1, name: 'Ana Darbe',      desc: 'Taarruz emrinde birliklerin vuruşu %10 artar', prereq: [],              effect: { legacy: true } },
        { id: 'steel-wall',  branch: 'war', tier: 2, cost: 2, name: 'Çelik Duvar',    desc: 'Tüm birliklerine +1 zırh',                  prereq: ['drillmaster'], effect: { legacy: true } },
        { id: 'ambusher',    branch: 'war', tier: 2, cost: 2, name: 'Pusucu',         desc: 'İlk temas kanat hasarı +%15',               prereq: ['schwerpunkt'], effect: { legacy: true } },
        { id: 'morale',      branch: 'war', tier: 2, cost: 2, name: 'Kanaat Önderi',  desc: 'Birliklerinin panik direnci +%25',          prereq: ['schwerpunkt'], effect: { legacy: true } },
        { id: 'vanguard',    branch: 'war', tier: 3, cost: 3, name: 'Öncü Tümen',     desc: 'Kapasite +6 · tanklarına +%10 dayanıklılık', prereq: ['steel-wall'], effect: { armyCap: 6, tankHp: 1.10 } },
        { id: 'warlord',     branch: 'war', tier: 3, cost: 3, name: 'Serdar',         desc: '⚔️ Savaş yeteneğin kalıcı +1',               prereq: ['ambusher'],    effect: { skill: 'warrior' } },

        // ══ 🏗️ İDARE ══
        // 'logistics' ve 'mobilization' havuz sistemine geçişte ÖLÜ kalmıştı
        // (DEPLOY_RES.blue artık null → deploy bütçesine ekleme yapılmıyordu).
        // Yeni ekonomiye göre yeniden yorumlandı.
        { id: 'logistics',   branch: 'adm', tier: 1, cost: 1, name: 'Lojistikçi',     desc: 'Şehirlerindeki üretim %10 daha hızlı tamamlanır', prereq: [],              effect: { prodSpeed: 0.90 } },
        { id: 'mobilization',branch: 'adm', tier: 1, cost: 1, name: 'Seferberlik',    desc: 'Gelir payın +%15',                          prereq: [],              effect: { incomeShare: 1.15 } },
        { id: 'quarter',     branch: 'adm', tier: 2, cost: 2, name: 'Levazım Reisi',  desc: 'Üretim süresi −%15 daha',                   prereq: ['logistics'],   effect: { prodSpeed: 0.85 } },
        { id: 'builder',     branch: 'adm', tier: 2, cost: 2, name: 'İstihkamcı',     desc: 'Bina ve şehir yükseltme −%25 (senin kasan)', prereq: ['mobilization'], effect: { buildCost: 0.75 } },
        { id: 'warchest',    branch: 'adm', tier: 3, cost: 3, name: 'Hazinedar',      desc: 'Gelir payın +%25 daha',                     prereq: ['builder'],     effect: { incomeShare: 1.25 } },
        { id: 'industrial',  branch: 'adm', tier: 3, cost: 3, name: 'Sanayici',       desc: '🏗️ İktisat yeteneğin kalıcı +1',             prereq: ['quarter'],     effect: { skill: 'economist' } },

        // ══ 🕊️ SİYASET ══
        { id: 'orator',      branch: 'pol', tier: 1, cost: 1, name: 'Hatip',          desc: 'Konseydeki oyun 2 oy değerinde sayılır',   prereq: [],              effect: { voteWeight: 1 } },
        { id: 'patron',      branch: 'pol', tier: 1, cost: 1, name: 'Hami',           desc: 'Sohbetlerde sadakat kazanımların +%50',     prereq: [],              effect: { talkLoyMul: 1.5 } },
        { id: 'whip',        branch: 'pol', tier: 2, cost: 2, name: 'Parti Disiplini', desc: 'Konsey kararını zorlamanın sadakat kaybı 5 yerine 2 olur', prereq: ['orator'], effect: { overrideCost: 2 } },
        { id: 'spymaster',   branch: 'pol', tier: 2, cost: 2, name: 'İstihbarat Ağı', desc: 'Kulis ve rüşvet yazışmaları daha sık ele geçirilir', prereq: ['patron'], effect: { intrigue: 1 } },
        { id: 'kingmaker',   branch: 'pol', tier: 3, cost: 3, name: 'Kral Yapıcı',    desc: 'Konseyde oyun <b>4 oy</b> sayılır',         prereq: ['whip'],        effect: { voteWeight: 2 } },
        { id: 'statesman',   branch: 'pol', tier: 3, cost: 3, name: 'Devlet Adamı',   desc: '🕊️ Diplomasi yeteneğin kalıcı +1',           prereq: ['spymaster'],   effect: { skill: 'diplomat' } },
    ],
};
const CMDR_NODE_BY_ID = {}; CMDR_TREE.nodes.forEach(n => { CMDR_NODE_BY_ID[n.id] = n; });

// ── PUAN MUHASEBESİ (türetilmiş — ayrı sayaç yok) ──────────────────────────
function cmdrUnlocked(cmd) {
    const c = cmd || (typeof STORY !== 'undefined' && STORY.commander);
    return (c && Array.isArray(c.activePerks)) ? c.activePerks : [];
}
function cmdrHas(id, cmd) { return cmdrUnlocked(cmd).indexOf(id) >= 0; }
function cmdrTotalLP(cmd) {
    const c = cmd || STORY.commander; if (!c) return 0;
    // + lpBonus: karakter ekranı zar denkleştirmesi (21 − zar toplamı) — düşük zar
    // atan oyuncu gelişim bütçesiyle telafi edilir, "6/6/6 gelene dek bas" istismarı ölür.
    return Math.max(0, ((c.rank || 1) - 1) * CMDR_LP_PER_RANK + (c.victories || 0) + (c.lpBonus || 0));
}
function cmdrSpentLP(cmd) {
    let s = 0;
    for (const id of cmdrUnlocked(cmd)) { const n = CMDR_NODE_BY_ID[id]; if (n) s += n.cost; }
    return s;
}
function cmdrFreeLP(cmd) { return Math.max(0, cmdrTotalLP(cmd) - cmdrSpentLP(cmd)); }

function cmdrNodeStatus(node, cmd) {
    const c = cmd || STORY.commander;
    if (cmdrHas(node.id, c)) return { state: 'owned' };
    const needRank = CMDR_TIER_RANK[node.tier] || 1;
    if ((c.rank || 1) < needRank) return { state: 'locked', reason: `Rütbe ${needRank} gerekli` };
    for (const p of (node.prereq || [])) if (!cmdrHas(p, c)) return { state: 'locked', reason: `${(CMDR_NODE_BY_ID[p] || {}).name || p} gerekli` };
    if (cmdrFreeLP(c) < node.cost) return { state: 'poor', reason: `${node.cost} liyakat puanı gerekli` };
    return { state: 'open' };
}
function cmdrUnlock(id) {
    const c = STORY.commander; if (!c) return false;
    const node = CMDR_NODE_BY_ID[id]; if (!node) return false;
    const st = cmdrNodeStatus(node, c);
    if (st.state !== 'open') { if (typeof storyFlash === 'function') storyFlash(st.reason || 'Bu yetenek şu an açılamaz.'); return false; }
    if (!Array.isArray(c.activePerks)) c.activePerks = [];
    c.activePerks.push(id);
    // KALICI YETENEK ARTIŞI anında uygulanır (bonus tablosundan değil, gerçek skill'den)
    if (node.effect && node.effect.skill && c.skills) {
        c.skills[node.effect.skill] = Math.min(9, (c.skills[node.effect.skill] || 0) + 1);
    }
    if (typeof storyLog === 'function') storyLog(`🎖️ Yetenek açıldı: <b>${node.name}</b> (−${node.cost} liyakat)`);
    if (typeof storyComputeTechBonus === 'function') storyComputeTechBonus();
    if (typeof storySave === 'function') storySave();
    if (typeof warRoomRenderCommander === 'function') warRoomRenderCommander();
    return true;
}

// ── BONUS TOPLAMI ──────────────────────────────────────────────────────────
// Her çağrıda taze hesaplanır (ucuz: ≤18 düğüm) — bayat önbellek riski yok.
function cmdrBonus(cmd) {
    const b = { armyCap: 0, prodSpeed: 1, buildCost: 1, incomeShare: 1, voteWeight: 0, overrideCost: null, talkLoyMul: 1, intrigue: 0, tankHp: 1 };
    for (const id of cmdrUnlocked(cmd)) {
        const n = CMDR_NODE_BY_ID[id]; if (!n || !n.effect) continue;
        const e = n.effect;
        if (e.armyCap) b.armyCap += e.armyCap;
        if (e.prodSpeed) b.prodSpeed *= e.prodSpeed;
        if (e.buildCost) b.buildCost *= e.buildCost;
        if (e.incomeShare) b.incomeShare *= e.incomeShare;
        if (e.voteWeight) b.voteWeight += e.voteWeight;
        if (e.overrideCost != null) b.overrideCost = Math.min(b.overrideCost == null ? 99 : b.overrideCost, e.overrideCost);
        if (e.talkLoyMul) b.talkLoyMul *= e.talkLoyMul;
        if (e.intrigue) b.intrigue += e.intrigue;
        if (e.tankHp) b.tankHp *= e.tankHp;
    }
    return b;
}
// Oyuncunun jetonu mu? (bonuslar YALNIZ oyuncunun komutanına uygulanır)
function cmdrIsPlayerToken(cmd) { return !!(cmd && typeof STORY !== 'undefined' && cmd === STORY.commander); }

// ── ESKİ KAYIT GÖÇÜ ────────────────────────────────────────────────────────
// Eski sistemde activePerks 3 slotluk AÇ/KAPA listesiydi ve id'ler aynıydı →
// oldukları gibi "açılmış düğüm" sayılırlar. Harcanan puan toplamı serbest
// puanı aşarsa kazanılmış hak korunur (cmdrFreeLP zaten 0'a kırpar).
function cmdrMigrate(cmd) {
    const c = cmd || (typeof STORY !== 'undefined' && STORY.commander); if (!c) return;
    if (!Array.isArray(c.activePerks)) { c.activePerks = []; return; }
    c.activePerks = c.activePerks.filter(id => !!CMDR_NODE_BY_ID[id]);   // tanınmayan id'leri at
}

// ── UI ─────────────────────────────────────────────────────────────────────
function cmdrTreeHtml() {
    if (typeof STORY === 'undefined' || !STORY.commander) return '';
    const c = STORY.commander;
    const free = cmdrFreeLP(c), total = cmdrTotalLP(c), spent = cmdrSpentLP(c);
    let html = `<div class="ct-top">🎖️ Liyakat puanı: <b>${free}</b> serbest`
        + `<span class="ct-sub">(toplam ${total} · harcanan ${spent})</span>`
        + `<div class="ct-hint">Puan kazanma: her rütbe <b>+${CMDR_LP_PER_RANK}</b> · her zafer <b>+1</b>. `
        + `Açılan yetenek <b>kalıcıdır</b> — artık slot yok.</div></div>`;
    html += `<div class="ct-cols">`;
    for (const br of CMDR_TREE.branches) {
        html += `<div class="ct-col"><div class="ct-col-h" style="color:${br.color}">${br.icon} ${br.name}</div>`
            + `<div class="ct-col-d">${br.desc}</div>`;
        for (let tier = 1; tier <= 3; tier++) {
            const need = CMDR_TIER_RANK[tier];
            html += `<div class="ct-tier">K${tier} · rütbe ${need}+</div>`;
            for (const n of CMDR_TREE.nodes.filter(x => x.branch === br.key && x.tier === tier)) {
                const s = cmdrNodeStatus(n, c);
                const badge = s.state === 'owned' ? '✓ AÇIK' : (s.state === 'open' ? `${n.cost} LP` : '🔒');
                html += `<button class="ct-node ${s.state}" data-cmdr-node="${n.id}"${s.state === 'open' ? '' : ' disabled'}>`
                    + `<div class="ct-n-h"><span class="ct-n-name">${n.name}</span><span class="ct-n-badge">${badge}</span></div>`
                    + `<div class="ct-n-d">${n.desc}</div>`
                    + (s.reason ? `<div class="ct-n-lock">${s.reason}</div>` : '')
                    + `</button>`;
            }
        }
        html += `</div>`;
    }
    return html + `</div>`;
}
function cmdrTreeBind() {
    const grid = document.getElementById('commander-perk-grid');
    if (!grid) return;
    grid.addEventListener('click', e => {
        const b = e.target.closest('[data-cmdr-node]');
        if (b && !b.disabled) cmdrUnlock(b.dataset.cmdrNode);
    });
}
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cmdrTreeBind);
    else cmdrTreeBind();
}
