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
    STORY._newsSeq = (STORY._newsSeq || 0) + 1;
    const rec = {
        id: STORY._newsSeq,
        t: Math.round(STORY.clock || 0),
        date: (typeof storyDateLabel === 'function') ? storyDateLabel() : '',
        arch, facts,
        headline: a.icon + ' ' + a.t(facts),
        llm: false, spun: false,
        badFor: a.bad ? facts[a.bad] : null,        // kimin için kötü haber (çarpıtılabilir)
    };
    STORY._news.unshift(rec);
    if (STORY._news.length > NEWS_MAX) STORY._news.pop();
    /* AYRI GAZETE PANELİ KALDIRILDI (kullanıcı raporu: "gazete ve gündem aynı").
       Ölçüm onu doğruladı: 360 oyun-saniyesinde gazete 3 manşet, akış 105 kayıt
       üretiyordu ve panel çoğu zaman "henüz manşet yok" yazıyordu. Manşet yine
       de GERÇEK içerik — akışta hiç görünmüyordu (ölçüldü: 0 eşleşme). Bu yüzden
       panel silindi ama manşet AKIŞ'a yazılıyor; ÇARPIT da orada kalıyor. */
    if (typeof storyLogHeadline === 'function') storyLogHeadline('🗞️ ' + rec.headline, rec.id);
    else if (typeof storyLog === 'function') storyLog('🗞️ ' + rec.headline);
    // LLM açıksa gazeteci ağzıyla yeniden yaz (ateşle-unut; şablon zaten basıldı)
    if (typeof llmEnrichNews === 'function') llmEnrichNews(rec);
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
    storySave(); if (typeof storyPanelUpdate === 'function') storyPanelUpdate();   // manşet AKIŞ satırında
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

/* ── AYRI GAZETE PANELİ KALDIRILDI ───────────────────────────────
   Kullanıcı raporu: "gazete ve gündem aynı, gazeteyi kaldır". Ölçüm onu
   doğruladı: 360 oyun-saniyesinde gazete 3 manşet üretirken akış 105 kayıt
   üretiyordu ve panel çoğu zaman "henüz manşet yok" yazıyordu.

   Ama manşet ve ÇARPIT GERÇEK içerikti; silinmedi, AKIŞ'a taşındı. Bu dosya
   artık veri + mekanik tutuyor, ekranı StoryUI akış çizicisi çiziyor. */
function storyNewsById(id) {
    return (STORY._news || []).find(r => r && r.id === id) || null;
}
function storyNewsSpinById(id) {
    const liste = STORY._news || [];
    const idx = liste.findIndex(r => r && r.id === id);
    if (idx >= 0) storyNewsSpin(idx);
}

if (typeof document !== 'undefined') {
    document.addEventListener('click', e => {
        const b = e.target && e.target.closest ? e.target.closest('[data-haber-carpit]') : null;
        if (b) storyNewsSpinById(+b.dataset.haberCarpit);
    });
}
