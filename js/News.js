// ═══════════════════════════════════════════════════════════════════════════
//  GAZETE — MEDYA KATMANI (PLAN AŞAMA 4)
//  ---------------------------------------------------------------------------
//  10 yıllık yaşam testi tespiti: "on yılın tüm anlatısı kuru günlük satırlarıydı;
//  anlatılacak bir tarih birikmedi." Motor önemli olayları YAPILANDIRILMIŞ haber
//  kaydına çevirir; başlık önce ŞABLONDAN anında basılır, LLM açıksa arka planda
//  gazeteci ağzıyla YENİDEN yazar (yetişirse zenginleşir — oyun asla beklemez).
//
//  ÇARPITMA: oyuncu kendi devletiyle ilgili KÖTÜ haberi 45 sn içinde çarpıtabilir
//  (60⭐). Başarı basın güvenilirliğine bağlıdır: güvenilirlik yüksekken halk
//  yumuşar (refah/güven kısmen geri gelir), ama her çarpıtma güvenilirliği yer —
//  düşük güvenilirlikte çarpıtma TERS TEPER. Aydınlar her durumda soğur.
//  Sayılar motorda; LLM yalnız METİN yazar (çarpıtılmış başlık dahil).
// ═══════════════════════════════════════════════════════════════════════════

const NEWS_MAX = 30;

// Arketip şablonları: anında basılan yedek başlıklar (LLM yoksa/gecikirse bunlar kalır)
const NEWS_ARCH = {
    conquest: { icon: '💥', t: f => `${f.city} düştü — ${f.winner} bayrağı ${f.loser} surlarında`, bad: 'loser' },
    strike:   { icon: '🪧', t: f => `${f.st} genel grevde: üretim hatları durdu`, bad: 'st' },
    famine:   { icon: '🌾', t: f => `${f.st}'de karneler geri döndü — kıtlık resmî`, bad: 'st' },
    flight:   { icon: '💸', t: f => `${f.st} sermayesi kaçıyor: piyasalarda panik`, bad: 'st' },
    coup:     { icon: '🔥', t: f => `${f.st}'de DARBE — yönetim el değiştirdi`, bad: 'st' },
    law:      { icon: '⚖️', t: f => `${f.st} yeni rotasını çizdi: ${f.law}`, bad: null },
    treatyWar:{ icon: '⚔️', t: f => `${f.a} ile ${f.b} arasında SAVAŞ ilan edildi`, bad: null },
    treatyPeace:{ icon: '🕊️', t: f => `${f.a} ve ${f.b} masada anlaştı: ${f.kind}`, bad: null },
    era:      { icon: '🌍', t: f => `Dünya yeni bir döneme girdi: ${f.era}`, bad: null },
    level:    { icon: '🏙️', t: f => `${f.city} büyüdü — nüfus ${f.pop} bini aştı`, bad: null },
    demand:   { icon: '🗣️', t: f => `${f.st}: "${f.dem}" talebi ${f.res}`, bad: null },
};

function storyNews(arch, facts) {
    const a = NEWS_ARCH[arch]; if (!a) return null;
    if (!STORY._news) STORY._news = [];
    const rec = {
        t: Math.round(STORY.clock || 0),
        date: (typeof storyDateLabel === 'function') ? storyDateLabel() : '',
        arch, facts,
        headline: a.icon + ' ' + a.t(facts),
        llm: false, spun: false,
        badFor: a.bad ? facts[a.bad] : null,        // kimin için kötü haber (çarpıtılabilir)
    };
    STORY._news.unshift(rec);
    if (STORY._news.length > NEWS_MAX) STORY._news.pop();
    // LLM açıksa gazeteci ağzıyla yeniden yaz (ateşle-unut; şablon zaten basıldı)
    if (typeof llmEnrichNews === 'function') llmEnrichNews(rec);
    if (typeof storyNewsBadge === 'function') storyNewsBadge();
    if (STORY._newsOpen && typeof storyNewsUpdate === 'function') storyNewsUpdate();
    return rec;
}

// ── ÇARPITMA ───────────────────────────────────────────────────────────────
const NEWS_SPIN_COST = 60, NEWS_SPIN_WINDOW = 45;
function storyNewsCredBackfill(st) { if (st && st.pressCred == null) st.pressCred = 60; }
function storyNewsCanSpin(rec) {
    const me = storyPlayerState();
    return me && rec && !rec.spun && rec.badFor === me.name
        && (STORY.clock - rec.t) <= NEWS_SPIN_WINDOW;
}
function storyNewsSpin(idx) {
    const rec = (STORY._news || [])[idx]; const me = storyPlayerState();
    if (!rec || !me || !storyNewsCanSpin(rec)) return;
    storyNewsCredBackfill(me);
    const w = STORY.commander && STORY.commander.res;
    if (!w || w.points < NEWS_SPIN_COST) { storyFlash(`⭐ yetersiz (${NEWS_SPIN_COST} gerekli).`); return; }
    if (typeof storyBudgetDebit === 'function') {
        const paid = storyBudgetDebit(me, NEWS_SPIN_COST, 'media.spin', {
            commander: STORY.commander,
            commanderOnly: true,
            correlationId: `news-spin:${rec.id || STORY.clock}`
        });
        if (!paid.ok) { storyFlash(`⭐ yetersiz (${NEWS_SPIN_COST} gerekli).`); return; }
    } else w.points -= NEWS_SPIN_COST;
    rec.spun = true;
    // Aydınlar çarpıtmayı HER durumda görür (o yüzden bedava değil)
    if (me.factions) me.factions.intel = Math.max(5, me.factions.intel - 3);
    if (storyRandom('narrative') < me.pressCred / 100) {
        storyWelfareDelta(me, 'news.public_confidence', 3, {
            correlationId: `news:${rec.arch || 'spin'}:${Math.floor(STORY.clock || 0)}`
        });
        if (me.trust != null) me.trust = Math.min(100, me.trust + 3);
        me.pressCred = Math.max(5, me.pressCred - 5);
        rec.headline = '📢 ' + storyNewsSpinText(rec);
        storyLog(`📢 Devlet basını devrede: haber çarpıtıldı (halk yumuşadı, güvenilirlik ${Math.round(me.pressCred)}).`);
    } else {
        storyWelfareDelta(me, 'news.public_anxiety', -2, {
            correlationId: `news:${rec.arch || 'spin'}:${Math.floor(STORY.clock || 0)}`
        });
        me.pressCred = Math.max(5, me.pressCred - 9);
        storyLog(`🤥 Çarpıtma ELE ALINDI — kimse inanmadı (güvenilirlik ${Math.round(me.pressCred)}, refah −2).`);
    }
    if (typeof llmEnrichNews === 'function' && rec.spun) llmEnrichNews(rec);   // hükümet ağzıyla yeniden yaz
    storySave(); if (typeof storyNewsUpdate === 'function') storyNewsUpdate();
}
function storyNewsSpinText(rec) {
    const f = rec.facts || {};
    switch (rec.arch) {
        case 'conquest': return `${f.city}'de planlı taktik intikal — ordu yeni hatta güçlendi`;
        case 'strike': return `Üretimde kısa bakım molası — çalışanlarla verimlilik mutabakatı`;
        case 'famine': return `Gıda arzında mevsimsel düzenleme — stoklar kontrol altında`;
        case 'flight': return `Sermaye hareketleri "portföy çeşitlendirmesi" — ekonomi yönetimi kararlı`;
        default: return rec.headline.replace(/^[^\s]+\s/, '');
    }
}

// ── OLAY KAYNAKLARI İÇİN YARDIMCILAR (çağıran taraf tek satır yazar) ──────
function storyNewsConquest(node, winnerSt, loserSt) {
    if (!node || !winnerSt) return;
    storyNews('conquest', { city: node.name, winner: winnerSt.name, loser: loserSt ? loserSt.name : '?' });
}

// ── PANEL ──────────────────────────────────────────────────────────────────
function storyNewsOpen() {
    storyCouncilClose(); storyTechClose(); storyCityClose(); if (typeof storyArmyClose === 'function') storyArmyClose(); if (typeof storyEconomyClose === 'function') storyEconomyClose();
    STORY._newsOpen = true;
    const p = document.getElementById('news-panel');
    if (p) { p.classList.add('open'); p.setAttribute('aria-hidden', 'false'); }
    document.getElementById('story-news-btn')?.classList.add('active');
    STORY._newsSeen = (STORY._news || []).length;
    storyNewsBadge(); storyNewsUpdate();
}
function storyNewsClose() {
    STORY._newsOpen = false;
    const p = document.getElementById('news-panel');
    if (p) { p.classList.remove('open'); p.setAttribute('aria-hidden', 'true'); }
    document.getElementById('story-news-btn')?.classList.remove('active');
}
function storyNewsToggle() { STORY._newsOpen ? storyNewsClose() : storyNewsOpen(); }
function storyNewsBadge() {
    const b = document.getElementById('news-badge'); if (!b) return;
    const unseen = Math.max(0, (STORY._news || []).length - (STORY._newsSeen || 0));
    b.textContent = unseen > 0 ? String(Math.min(9, unseen)) : '';
    b.classList.toggle('hidden', unseen === 0 || STORY._newsOpen);
}
function storyNewsUpdate() {
    if (!STORY._newsOpen) return;
    const body = document.getElementById('news-body'); if (!body) return;
    const me = storyPlayerState(); if (me) storyNewsCredBackfill(me);
    const list = STORY._news || [];
    let html = `<div class="news-cred">🗞️ Basın güvenilirliği: <b>${me ? Math.round(me.pressCred) : '—'}</b>
        <small>Çarpıtma başarısı buna bağlı; her çarpıtma biraz yer. Aydınlar çarpıtmayı her durumda görür.</small></div>`;
    if (!list.length) html += `<div class="city-hint">Henüz doğrulanmış manşet yok. Savaş, ekonomik kırılma, yasa ve diplomasi olayları burada yayımlanır.</div>`;
    list.forEach((r, i) => {
        const spin = storyNewsCanSpin(r)
            ? `<button class="city-btn news-spin" data-idx="${i}">📢 ÇARPIT (${NEWS_SPIN_COST}⭐ · ${Math.max(0, Math.ceil(NEWS_SPIN_WINDOW - (STORY.clock - r.t)))}sn)</button>` : '';
        html += `<div class="news-card${r.spun ? ' spun' : ''}">
            <div class="news-h"><span>${r.date}</span>${r.llm ? '<span class="news-llm" title="Yapay anlatıcı yazdı">🤖</span>' : ''}</div>
            <div class="news-t">${r.headline}</div>
            ${r.body ? `<div class="news-b">${r.body}</div>` : ''}
            ${spin}</div>`;
    });
    body.innerHTML = html;
}
if (typeof document !== 'undefined') {
    document.addEventListener('click', e => {
        const b = e.target && e.target.closest ? e.target.closest('.news-spin') : null;
        if (b) storyNewsSpin(+b.dataset.idx);
    });
}
