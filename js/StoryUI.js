// ═══════════════════════════════════════════════════════════════════════════
//  DÜNYA ARAYÜZÜ — üst panel, konsey/teknoloji/ordu drawer'ları, bağlama
//  ---------------------------------------------------------------------------
//  Story.js'ten AYRILDI (davranış değişmedi, yalnız kod taşındı).
//  Story.js 2625 satıra çıkmıştı; okunabilirlik için uyumlu parçalara bölündü.
//  Küresel script düzeni: bu dosya Story.js'ten SONRA yüklenir. Hepsi fonksiyon
//  tanımı olduğu için (hoisting) çağrı sırası etkilenmez.
// ═══════════════════════════════════════════════════════════════════════════

// ── PANEL (HTML, throttled innerHTML) ────────────────────────────────────────
/* ── KUSUR 16: AKIŞ artık arşiv ──────────────────────────────────────────────
   Kırpma sınırı veride yükseldi (Story.js STORY_LOG_CAP); burası arama, tür
   filtresi ve sayaç ekliyor. Tür, mesajın BAŞ SİMGESİNDEN çıkarılıyor: 16 dosyada
   74 `storyLog(...)` çağrısı var ve hiçbirine tür parametresi eklenmedi — böylece
   yeni bir çağrı unutulduğunda kayıt kaybolmuyor, yalnız `DİĞER`e düşüyor. */
const STORY_FLOW_TURLER = [
    { key: 'hepsi', ad: 'HEPSİ', simgeler: null },
    { key: 'askeri', ad: 'ASKERÎ', simgeler: ['⚔️', '🛡️', '🎖️', '☠️', '💀', '💥', '🏰', '🏳️', '🏴', '🏆'] },
    { key: 'siyaset', ad: 'SİYASET', simgeler: ['🏛️', '⚖️', '🚨', '⏳', '📜', '👤'] },
    { key: 'ekonomi', ad: 'EKONOMİ', simgeler: ['💸', '🌾', '🏭', '🏗️', '🧱', '⚙️', '✖', '➕', '🚪', '🔬', '🏙️'] },
    { key: 'diplomasi', ad: 'DİPLOMASİ', simgeler: ['🤝', '👂', '🤍'] },
    { key: 'halk', ad: 'HALK', simgeler: ['🪧', '📢', '🤥'] },
    { key: 'dunya', ad: 'DÜNYA', simgeler: ['🌍', '⚠️'] }
];
const STORY_FLOW = { tur: 'hepsi', arama: '', hepsiniGoster: false };
const STORY_FLOW_ILK = 12;   // varsayılan görünen satır; "TÜMÜNÜ GÖSTER" açar

function storyFlowTur(metin) {
    const bas = String(metin || '').trim();
    for (const t of STORY_FLOW_TURLER) {
        if (!t.simgeler) continue;
        for (const s of t.simgeler) if (bas.startsWith(s)) return t.key;
    }
    return 'diger';
}

function storyFlowZaman(t) {
    if (t == null) return '';
    if (typeof storyDateShort === 'function') {
        try { return storyDateShort(t); } catch (e) { /* eski kayıt / imza uymuyor */ }
    }
    return 'GÜN ' + (1 + Math.floor(t / 60));
}

function storyFlowHtml(formatLog) {
    const hepsi = Array.isArray(STORY.log) ? STORY.log.map(storyLogNormalize) : [];
    const ara = STORY_FLOW.arama.trim().toLocaleLowerCase('tr');
    const suzulmus = hepsi.filter(k => {
        if (STORY_FLOW.tur !== 'hepsi' && storyFlowTur(k.m) !== STORY_FLOW.tur) return false;
        if (!ara) return true;
        // etiketleri at, düz metinde ara: kullanıcı <b> yazmıyor
        return k.m.replace(/<[^>]*>/g, '').toLocaleLowerCase('tr').includes(ara);
    });
    const gosterilecek = STORY_FLOW.hepsiniGoster ? suzulmus : suzulmus.slice(0, STORY_FLOW_ILK);

    const cipler = STORY_FLOW_TURLER.map(t => {
        const adet = t.simgeler
            ? hepsi.filter(k => storyFlowTur(k.m) === t.key).length
            : hepsi.length;
        if (!adet && t.key !== 'hepsi' && STORY_FLOW.tur !== t.key) return '';
        return `<button type="button" class="story-flow-chip" data-flow-tur="${t.key}"
            data-aktif="${STORY_FLOW.tur === t.key ? '1' : '0'}">${t.ad}<b>${adet}</b></button>`;
    }).join('');

    const satirlar = gosterilecek.length
        ? gosterilecek.map(k => `<div class="story-log-row">
            ${k.t != null ? `<time>${storyProjectionEscape(storyFlowZaman(k.t))}</time>` : ''}
            <span>${formatLog(k.m)}</span></div>`).join('')
        : `<div class="story-flow-bos">${ara || STORY_FLOW.tur !== 'hepsi'
            ? 'Bu süzgece uyan kayıt yok.' : 'Henüz kayıt yok.'}</div>`;

    const kalan = suzulmus.length - gosterilecek.length;
    return `<div class="story-flow-bar">
          <input type="search" id="story-flow-search" class="story-flow-search"
                 placeholder="akışta ara" value="${storyProjectionEscape(STORY_FLOW.arama)}">
          <div class="story-flow-chips">${cipler}</div>
        </div>
        <div class="story-flow-sayac">${suzulmus.length} / ${hepsi.length} kayıt</div>
        ${satirlar}
        ${kalan > 0 ? `<button type="button" id="story-flow-more" class="story-flow-more">${kalan} KAYIT DAHA GÖSTER</button>` : ''}
        ${STORY_FLOW.hepsiniGoster && suzulmus.length > STORY_FLOW_ILK
            ? `<button type="button" id="story-flow-less" class="story-flow-more">DARALT</button>` : ''}`;
}

/* Olaylar `storyUiSetHtml` ile yeniden yazıldığı için dinleyici düğüme değil
   KAPSAYICIYA bağlanır (delegasyon) — her güncellemede yeniden bağlamak gerekmez
   ve arama kutusu odağını kaybetmez. */
function storyFlowBind() {
    const log = document.getElementById('story-log');
    if (!log || log.dataset.flowBagli === '1') return;
    log.dataset.flowBagli = '1';
    log.addEventListener('click', ev => {
        const cip = ev.target.closest('[data-flow-tur]');
        if (cip) { STORY_FLOW.tur = cip.dataset.flowTur; STORY_FLOW.hepsiniGoster = false; storyPanelUpdate(); return; }
        if (ev.target.closest('#story-flow-more')) { STORY_FLOW.hepsiniGoster = true; storyPanelUpdate(); return; }
        if (ev.target.closest('#story-flow-less')) { STORY_FLOW.hepsiniGoster = false; storyPanelUpdate(); }
    });
    log.addEventListener('input', ev => {
        if (!ev.target.matches('#story-flow-search')) return;
        STORY_FLOW.arama = ev.target.value;
        STORY_FLOW.hepsiniGoster = false;
        storyPanelUpdate();
        const kutu = document.getElementById('story-flow-search');
        if (kutu) { kutu.focus(); kutu.setSelectionRange(kutu.value.length, kutu.value.length); }
    });
}

/* ── KUSUR 14: rol navigasyonu süzmüyordu ────────────────────────────────────
   Sekiz araç herkese aynı sırayla ve aynı ağırlıkta görünüyordu; komutan şirket
   ayrıntısı, şirket yöneticisi ordu kontrolü karıştırıyordu.

   TASARIM KARARI — GİZLEME YOK, İKİNCİLLEŞTİRME VAR. Rolün dışındaki aracı
   tamamen kaldırmak, oyuncunun gerçekten yapabildiği bir şeyi engelleyebilir
   (şirket yöneticisinin de sefer ordusu var: STORY.commander.army). Bu yüzden
   ikincil araçlar kaybolmuyor, tek tıklık bir şeritte toplanıyor. Erişim kaybı
   sıfır, sinyal net.

   DETERMİNİZM: yalnız DOM sınıfı/görünürlük. Dünya durumu, sıra, kayıt ve hiçbir
   sayı değişmiyor — `HIKAYE_MODU_UYGULAMA_DURUMU.md:344-354`'teki koşul bu. */
const STORY_TOOL_ROL_ONCELIK = Object.freeze({
    COMMANDER:     ['story-army-btn', 'story-city-btn', 'story-commander-btn', 'story-council-btn', 'story-talk-btn'],
    COMPANY_OWNER: ['story-economy-btn', 'story-tech-btn', 'story-city-btn', 'story-talk-btn', 'story-commander-btn'],
    MAYOR:         ['story-city-btn', 'story-economy-btn', 'story-council-btn', 'story-talk-btn', 'story-news-btn'],
    EXECUTIVE:     ['story-council-btn', 'story-news-btn', 'story-talk-btn', 'story-economy-btn', 'story-commander-btn'],
    AGENT:         ['story-talk-btn', 'story-news-btn', 'story-council-btn', 'story-commander-btn'],
    CIVILIAN:      ['story-talk-btn', 'story-news-btn', 'story-city-btn', 'story-economy-btn']
});
const STORY_TOOLS = { hepsi: false, uygulananRol: null };

function storyToolsApplyRole() {
    const kap = document.getElementById('story-tools');
    if (!kap) return;
    const rol = String((STORY.commander && STORY.commander.creationRole) || STORY.playerRole || 'COMMANDER').toUpperCase();
    const oncelik = STORY_TOOL_ROL_ONCELIK[rol];
    // Bilinmeyen rol → HERKESİ GERİ AÇ. Yalnız `return` demek yetmiyor: önceki
    // rolün gizlemesi DOM'da duruyordu ve bilinmeyen rol o düzeni miras alıyordu
    // (ölçüldü — `BILINMEYEN_ROL` CIVILIAN düzeninde kalmıştı). Yani yeni bir rol
    // eklenip buraya yazılmazsa araçlar sessizce kaybolurdu; tam kaçınmak
    // istediğim şey. Şimdi bilinmeyen rolde sekizi de görünür.
    if (!oncelik) {
        kap.removeAttribute('data-rol');
        kap.removeAttribute('data-hepsi');
        STORY_TOOLS.uygulananRol = rol;
        let n = 0;
        Array.prototype.forEach.call(kap.querySelectorAll('.tool-btn'), btn => {
            if (btn.id === 'story-tools-more') return;
            btn.dataset.ikincil = '0';
            btn.style.order = '';
            btn.style.display = '';
            // numaralar da DOM sırasına döner; önceki rolden kalan sıra kalmasın
            const etiket = btn.querySelector('b');
            const yeni = String(++n).padStart(2, '0');
            if (etiket && etiket.textContent !== yeni) etiket.textContent = yeni;
        });
        const eski = document.getElementById('story-tools-more');
        if (eski) eski.remove();
        return;
    }
    if (STORY_TOOLS.uygulananRol !== rol) {
        STORY_TOOLS.uygulananRol = rol;
        STORY_TOOLS.hepsi = false;   // rol değişince şerit kapanır
    }
    kap.dataset.rol = rol;
    kap.dataset.hepsi = STORY_TOOLS.hepsi ? '1' : '0';

    /* Görünürlük CSS sınıfıyla değil SATIR İÇİ stille yönetiliyor: `style.css`
       şu an paralel iş hattının commit'lenmemiş değişikliklerini taşıyor ve o
       dosyaya dokunmak onların işini benim commit'ime karıştırırdı. */
    let ikincil = 0;
    Array.prototype.forEach.call(kap.querySelectorAll('.tool-btn'), btn => {
        if (btn.id === 'story-tools-more') return;
        const sira = oncelik.indexOf(btn.id);
        const birincil = sira >= 0;
        btn.dataset.ikincil = birincil ? '0' : '1';
        // Sıra da role göre: birincil araçlar önce, kendi içinde öncelik sırasında.
        btn.style.order = birincil ? String(sira) : '99';
        btn.style.display = (birincil || STORY_TOOLS.hepsi) ? '' : 'none';
        if (!birincil) ikincil++;
    });

    /* Numaralar YENİDEN yazılır. `01`-`08` etiketleri kısayol DEĞİL, salt sıra
       göstergesi (story modunda rakam tuşu hiçbir araca bağlı değil — ölçüldü).
       Sırayı değiştirip numarayı bırakmak çubuğu `02 04 06 01 05` diye okutuyordu;
       yani etiket artık yalan söylüyordu. Görünen sıraya göre numaralanır.
       Yalnız `<b>` yazılır: rozet `<i>` düğümlerine dokunulmaz. */
    const gorunenSirali = Array.prototype.slice.call(kap.querySelectorAll('.tool-btn'))
        .filter(b => b.id !== 'story-tools-more')
        .sort((a, b) => (parseInt(a.style.order, 10) || 0) - (parseInt(b.style.order, 10) || 0));
    gorunenSirali.forEach((btn, i) => {
        const etiket = btn.querySelector('b');
        const yeni = String(i + 1).padStart(2, '0');
        if (etiket && etiket.textContent !== yeni) etiket.textContent = yeni;
    });

    let dugme = document.getElementById('story-tools-more');
    if (!ikincil) { if (dugme) dugme.remove(); return; }
    if (!dugme) {
        dugme = document.createElement('button');
        dugme.id = 'story-tools-more';
        dugme.className = 'tool-btn tool-more';
        dugme.type = 'button';
        dugme.addEventListener('click', () => {
            STORY_TOOLS.hepsi = !STORY_TOOLS.hepsi;
            storyToolsApplyRole();
        });
        kap.appendChild(dugme);
    }
    dugme.style.order = '98';
    dugme.title = STORY_TOOLS.hepsi ? 'Rolüne uygun araçlara dön' : 'Rolünün dışındaki araçları da göster';
    dugme.innerHTML = STORY_TOOLS.hepsi
        ? '<b>−</b><span>DARALT</span>'
        : `<b>+${ikincil}</b><span>ARAÇ</span>`;
}

function storyEraForUi() {
    if (STORY._era && typeof ERA_BY_ID !== 'undefined' && ERA_BY_ID[STORY._era.id]) return ERA_BY_ID[STORY._era.id];
    if (typeof storyEraEval === 'function') return storyEraEval().era;
    return typeof storyEra === 'function' ? storyEra() : null;
}

function storyWorldStateTooltip() {
    const era = storyEraForUi();
    if (!era) return '';
    const metrics = STORY._eraMetrics || (typeof storyEraMetrics === 'function' ? storyEraMetrics() : {});
    const since = typeof YEAR_SECONDS !== 'undefined'
        ? ((STORY.clock || 0) - ((STORY._era && STORY._era.since) || 0)) / YEAR_SECONDS
        : 0;
    const pct = value => Number.isFinite(Number(value)) ? `%${Math.round(Number(value) * 100)}` : '—';
    return `${era.icon} ${era.name}\n${era.desc}\n\n`
        + `Savaş ${pct(metrics.war)} · Refah ${pct(metrics.welfare)}\n`
        + `Çalkantı ${pct(metrics.turmoil)} · Oynaklık ${pct(metrics.volatility)}\n`
        + `Teknoloji ${pct(metrics.tech)} · ${since.toFixed(1)} yıldır sürüyor`;
}

function storyActivateDetailTooltips(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    root.querySelectorAll('.city-fact-grid > div small, .city-route-metrics').forEach(detail => {
        const host = detail.parentElement;
        // innerText Chromium'da her okumada stil/layout çözümleyebilir. Bu
        // metinler görünürlük hesabı istemeyen yeni panel düğümleri olduğundan
        // textContent aynı erişilebilir etiketi reflow tetiklemeden üretir.
        const parts = Array.from(detail.children, node => String(node.textContent || '').trim())
            .filter(Boolean);
        const text = parts.length
            ? parts.join(' · ')
            : String(detail.textContent || '').trim();
        if (!host || !text || host.dataset.storyTooltip) return;
        host.dataset.storyTooltip = text;
        host.classList.add('detail-hover');
        if (!host.hasAttribute('tabindex')) host.setAttribute('tabindex', '0');
        const primary = Array.from(host.children)
            .filter(node => node !== detail)
            .map(node => String(node.textContent || '').trim())
            .filter(Boolean)
            .join(' · ');
        host.setAttribute('aria-label', `${primary}${primary ? ' — ' : ''}${text}`);
        detail.classList.add('detail-tooltip-source');
    });
}

function storyUiSetHtml(element, html) {
    if (!element || element.innerHTML === html) return false;
    element.innerHTML = html;
    return true;
}

const STORY_BRIEF_TABS = Object.freeze(['agenda', 'region', 'flow']);
const STORY_AGENDA_SEVERITY = Object.freeze({ critical: 0, high: 1, watch: 2, stable: 3 });

function storyBriefSetTab(tab) {
    const selected = STORY_BRIEF_TABS.includes(tab) ? tab : 'agenda';
    STORY._briefTab = selected;
    for (const name of STORY_BRIEF_TABS) {
        const button = document.querySelector(`[data-story-brief-tab="${name}"]`);
        const panel = document.getElementById(name === 'agenda' ? 'story-agenda' : name === 'region' ? 'story-hud' : 'story-news');
        const active = name === selected;
        if (button) {
            button.classList.toggle('active', active);
            button.setAttribute('aria-selected', active ? 'true' : 'false');
            button.setAttribute('tabindex', active ? '0' : '-1');
        }
        if (panel) panel.classList.toggle('hidden', !active);
    }
}

function storyAgendaCollect(me) {
    const items = [];
    const add = (severity, title, detail, action, actionLabel, sub) => items.push({
        severity, title, detail, action, actionLabel, sub
    });
    const noticeCount = (STORY._factionNoticeQueue || []).length + (STORY._factionNoticeCurrent ? 1 : 0);
    if (noticeCount > 0) add(
        'critical', 'Toplumsal olay yanıt bekliyor',
        `${noticeCount} olay okunmadan veya yanıtlanmadan bekliyor.`,
        'economy', 'TOPLUMU AÇ', 'fraksiyonlar'
    );
    const pendingTalks = Array.isArray(STORY._talks) ? STORY._talks : [];
    if (pendingTalks.length) {
        const now = Number(STORY.clock) || 0;
        const expire = typeof TALK_EXPIRE === 'number' ? TALK_EXPIRE : (typeof YEAR_SECONDS === 'number' ? YEAR_SECONDS : 60);
        const nearest = pendingTalks.reduce((best, talk) => Math.min(
            best,
            Math.max(0, expire - (now - (Number(talk.born) || 0)))
        ), Number.POSITIVE_INFINITY);
        const soon = nearest <= expire * 0.35;
        const remaining = typeof storyTalkRemainingLabel === 'function'
            ? storyTalkRemainingLabel(nearest)
            : 'süresi dolmadan yanıt bekliyor';
        add(
            soon ? 'high' : 'watch',
            `${pendingTalks.length} görüşme yanıt bekliyor`,
            `En yakın görüşmenin ${remaining}. Yanıtsız kalan konular kapanabilir.`,
            'talk', 'GÖRÜŞMELERİ AÇ'
        );
    }
    if (me._strikeUntil && me._strikeUntil > (STORY.clock || 0)) add(
        'critical', 'Grev üretimi baskılıyor',
        `Eylem yaklaşık ${Math.max(1, Math.ceil(me._strikeUntil - (STORY.clock || 0)))} sn daha sürecek.`,
        'economy', 'ETKİYİ İNCELE', 'fraksiyonlar'
    );
    const welfare = Number(me.welfare);
    if (Number.isFinite(welfare) && welfare < 45) add(
        welfare < 25 ? 'critical' : 'high', 'Refah aşınıyor',
        `Refah ${Math.round(welfare)}/100. Kaynak katkılarını ve toplumsal baskıyı incele.`,
        'economy', 'NEDENLERİ AÇ', 'genel'
    );
    const inflation = Number(me.inflation);
    if (Number.isFinite(inflation) && inflation >= 15) add(
        inflation >= 28 ? 'critical' : 'high', 'Enflasyon kritik eşiğe yaklaşıyor',
        `Yıllık gösterge %${Math.round(inflation)}; gelir ve halk desteği aynı anda baskılanıyor.`,
        'economy', 'PİYASAYI AÇ', 'piyasa'
    );
    const capacity = typeof storyStateCapacityCountryView === 'function'
        ? storyStateCapacityCountryView(me.id) : null;
    if (capacity) {
        const failed = (capacity.implementationTickets || []).filter(ticket => (
            ticket.status === 'PAPER_ONLY' || ticket.status === 'DEGRADED'
        ));
        const queued = (capacity.implementationTickets || []).filter(ticket => ticket.status === 'QUEUED');
        if (failed.length) add(
            'high', 'Kararlar sahada eksik uygulanıyor',
            `${failed.length} uygulama kâğıt üzerinde kaldı veya düşük kaliteyle tamamlandı.`,
            'governance', 'YÖNETİMİ AÇ'
        );
        else if (queued.length) add(
            'watch', 'Uygulama kuyruğu oluştu',
            `${queued.length} yetkili karar idari kapasite bekliyor.`,
            'governance', 'KAPASİTEYİ İNCELE'
        );
    }
    const integrity = typeof storyIntegrityPublicView === 'function' && typeof storyIntegrityCountryView === 'function'
        ? storyIntegrityPublicView(storyIntegrityCountryView(me.id)) : null;
    if (integrity && integrity.openInvestigationCount > 0) add(
        'high', 'Resmî soruşturma açık',
        `${integrity.openInvestigationCount} dosya sonuç bekliyor; meşruiyet ve kurum güveni etkilenebilir.`,
        'governance', 'KURUMLARI AÇ'
    );
    const election = typeof storyElectionPublicView === 'function' && typeof storyElectionCountryView === 'function'
        ? storyElectionPublicView(storyElectionCountryView(me.id)) : null;
    if (election) {
        const active = (election.elections || []).find(row => row.status === 'CAMPAIGN');
        const contested = (election.elections || []).find(row => row.contest && !row.contest.resolved);
        if (contested) add(
            'high', 'Seçim sonucuna itiraz edildi',
            'Yetki devri kesinleşmeden kurumların kararı bekleniyor.',
            'governance', 'YÖNETİMİ AÇ'
        );
        else if (active) add(
            'watch', 'Seçim kampanyası sürüyor',
            `${active.candidates.length} aday listesi iktidar için yarışıyor.`,
            'governance', 'YÖNETİMİ AÇ'
        );
    }
    const politicalCrisis = typeof storyPoliticalCrisisPlayerView === 'function'
        ? storyPoliticalCrisisPlayerView() : null;
    if (politicalCrisis && politicalCrisis.activeCrisis) {
        const crisis = politicalCrisis.activeCrisis;
        const leadName = typeof storyPoliticalCrisisActorName === 'function'
            ? storyPoliticalCrisisActorName(me, crisis.leadActorId) : 'Bir komutan';
        const advanced = crisis.status === 'ULTIMATUM' || crisis.status === 'ATTEMPT';
        add(
            advanced ? 'critical' : 'high',
            `${leadName} çevresinde komuta krizi`,
            `${crisis.status} aşaması. Bu bir olasılık etiketi değil; aktörler hazırlık yapıyor ve karşı hamlen yanıt bekliyor.`,
            'talk', 'KARAKTERLERLE GÖRÜŞ'
        );
    }
    const cmd = STORY.commander ? storyNode(STORY.commander.node) : null;
    const selected = storyNode(STORY.selectedNodeId);
    if (cmd && selected && selected.owner !== me.id && cmd.neighbors.includes(selected.id)) add(
        'watch', `${selected.name} aktif cephede`,
        'Seçili komşu bölge için kuvvet ve beklenen sonuç brifingi hazır.',
        'region', 'BRİFİNGİ AÇ'
    );
    if (!items.length) add(
        'stable', 'Acil karar yok',
        'Dünya akıyor. Bir şehir seçebilir veya uzun vadeli panellerden birini açabilirsin.',
        'region', 'BÖLGEYE BAK'
    );
    return items.sort((a, b) => STORY_AGENDA_SEVERITY[a.severity] - STORY_AGENDA_SEVERITY[b.severity]).slice(0, 5);
}

function storyAgendaUpdate(me) {
    const summary = document.getElementById('story-agenda-summary');
    const list = document.getElementById('story-agenda-list');
    if (!summary || !list) return;
    const noticeCount = (STORY._factionNoticeQueue || []).length + (STORY._factionNoticeCurrent ? 1 : 0);
    const talkCount = Array.isArray(STORY._talks) ? STORY._talks.length : 0;
    const talkDeadlineKey = talkCount
        ? Math.floor(Math.min(...STORY._talks.map(talk => Number(talk.born) || 0)))
        : 0;
    const politicalCrisis = typeof storyPoliticalCrisisPlayerView === 'function'
        ? storyPoliticalCrisisPlayerView() : null;
    const crisisKey = politicalCrisis && politicalCrisis.activeCrisis
        ? `${politicalCrisis.activeCrisis.id}:${politicalCrisis.activeCrisis.status}:${politicalCrisis.activeCrisis.preparationBps}:${politicalCrisis.activeCrisis.counterBps}`
        : '-';
    const renderKey = [
        STORY.playerStateId, Math.floor((Number(STORY.clock) || 0) * 2), noticeCount,
        talkCount, talkDeadlineKey, crisisKey,
        Math.round(Number(me.welfare) || 0), Math.round(Number(me.inflation) || 0),
        me._strikeUntil && me._strikeUntil > (STORY.clock || 0) ? 1 : 0
    ].join('|');
    if (storyAgendaUpdate._lastKey === renderKey && list.childElementCount) return;
    storyAgendaUpdate._lastKey = renderKey;
    const items = storyAgendaCollect(me);
    const urgent = items.filter(item => item.severity === 'critical' || item.severity === 'high').length;
    const monitored = items.filter(item => item.severity === 'watch').length;
    const nextSummary = `<span class="story-kicker">ŞİMDİ</span>`
        + `<b>${urgent ? `${urgent} KONU DİKKAT İSTİYOR` : monitored ? `${monitored} KONU İZLEMEDE` : 'DURUM KONTROL ALTINDA'}</b>`
        + `<small>En önemli konular önce gösterilir. Ayrıntı ilgili çalışma alanında açılır.</small>`;
    const nextList = items.map(item => `<article class="story-agenda-item severity-${item.severity}">`
        + `<span>${item.severity === 'critical' ? 'ACİL' : item.severity === 'high' ? 'ÖNEMLİ' : item.severity === 'watch' ? 'İZLE' : 'SAKİN'}</span>`
        + `<h3>${storyProjectionEscape(item.title)}</h3>`
        + `<p>${storyProjectionEscape(item.detail)}</p>`
        + `<button data-story-agenda-action="${item.action}"${item.sub ? ` data-story-agenda-sub="${item.sub}"` : ''}>${storyProjectionEscape(item.actionLabel)}</button>`
        + `</article>`).join('');
    if (summary.innerHTML !== nextSummary) summary.innerHTML = nextSummary;
    if (list.innerHTML !== nextList) list.innerHTML = nextList;
}

function storyAgendaNavigate(action, sub) {
    if (action === 'economy') return storyEconomyOpen(sub);
    if (action === 'council') return storyCouncilOpen();
    if (action === 'governance') {
        STORY._councilTab = 'gov';
        return storyCouncilOpen();
    }
    if (action === 'talk') {
        STORY._talkView = 'conversations';
        return storyTalkOpen();
    }
    if (action === 'region') return storyBriefSetTab('region');
    if (action === 'flow') return storyBriefSetTab('flow');
}

function storyPanelUpdate() {
    const me = storyPlayerState(); if (!me) return;
    storyToolsApplyRole();   // kusur 14 — yalnız görünürlük/sıra, dünya durumu değişmez
    storyAgendaUpdate(me);
    const stats = document.getElementById('story-stats');
    if (stats) {
        const myr = (STORY.commander && STORY.commander.res) || { oil: 0, manpower: 0, points: 0 };
        // FAZ-4 TAKVİM: "gün" yerine mevsim+yıl. Konseye kalan süre de burada görünür.
        const date = (typeof storyDateLabel === 'function') ? storyDateLabel() : `GÜN ${1 + Math.floor((STORY.clock || 0) / 60)}`;
        const toCouncil = (typeof YEAR_SECONDS !== 'undefined') ? Math.max(0, (STORY._nextCouncil || 0) - (STORY.clock || 0)) : null;
        const cSoon = toCouncil != null && toCouncil <= 30;
        const statChip = (classes, label, value, detail, style) => {
            const safeDetail = storyProjectionEscape(detail);
            const safeLabel = storyProjectionEscape(`${label}: ${value}. Ayrıntılar için odaklan.`);
            return `<div class="story-stat-chip ${classes || ''} detail-hover" tabindex="0" data-story-tooltip="${safeDetail}" aria-label="${safeLabel}"${style ? ` style="${style}"` : ''}>${label}<b>${value}</b></div>`;
        };
        // KADEME — dar ekranda hangi çipin feda edileceği. Ölçüm: kutu = pencere − 579
        // (≤980'de başlık sütunu 190'a düştüğü için − 499).
        //   sınıfsız = daima kalır: DEVLET · PETROL · İNSAN · PUAN
        //   `t3`     = 900 px altında gizlenir: TARİH
        //   `t2`     = 1260 px altında gizlenir: GAZİ · ELEKTRONİK · ENF · ÇAĞ
        // TARİH'in GAZİ'den önce gelmesi bilinçli: gündem panelindeki süreler
        // ("1,25 yıl kaldı") takvime göre okunuyor, yani eyleme dönük. GAZİ salt
        // geriye dönük bir sayaç ve üst çubukta ona bağlı hiçbir karar yok.
        // Eskiden bu iş CSS'te
        // `.story-stat-chip:nth-of-type(n+4)` ile yapılıyordu; ELEKTRONİK ve ENF
        // koşullu üretildiği için (me.chips / me.inflation null olabilir) sıra
        // kayıyor ve HER DURUMDA FARKLI çipler gizleniyordu. Kademe artık burada,
        // üreten yerde işaretleniyor; CSS sıraya değil sınıfa bakıyor.
        const nextStatsHtml =
            statChip('identity', 'DEVLET', me.name, 'Oyuncu devletin. Harita renkleri ve ülke panellerindeki kayıtlar bu devlete aittir.', `--state-color:${me.color}`) +
            statChip('', 'PETROL', Math.floor(myr.oil), 'Komutan kasandaki petrol. Zırhlı birlik üretimi ve bazı askerî kararlar bunu harcar.') +
            statChip('', 'İNSAN', Math.floor(myr.manpower), 'Komutan kasandaki insan gücü. Birlik üretimi ve sefer ordusunu büyütmek için kullanılır.') +
            statChip('', 'PUAN', Math.floor(myr.points), 'Komutan kasandaki üretim ve karar puanı. Birlik, bina ve bazı siyasi eylemlerde kullanılır.') +
            statChip('t2', 'GAZİ', (STORY.veterans || []).length, 'Savaşlardan sonra kayda geçen toplam gazi sayısı.') +
            ((me.chips != null) ? statChip('t2 tip-right', 'ELEKTRONİK', Math.floor(me.chips), 'Devletin elektronik stoku. Tank ve topçu üretimi elektronik gerektirir.') : '') +
            ((me.inflation != null) ? statChip(`${me.inflation > 15 ? 'urgent ' : ''}t2 tip-right`, 'ENF', `%${me.inflation.toFixed(0)}`, 'Enflasyon gelir verimini azaltır ve halkın refah baskısını büyütür.') : '') +
            statChip('t3 wide tip-right', 'TARİH', date, 'Hikâye dünyasının mevcut tarihi. Dünya ilerledikçe ekonomi, kurumlar ve ilişkiler bu takvime göre değişir.') +
            ((typeof storyEra === 'function') ? (() => {
                const e = storyEraForUi();
                const detail = storyProjectionEscape(storyWorldStateTooltip());
                return `<div class="story-stat-chip t2 wide world-state detail-hover" tabindex="0" data-story-tooltip="${detail}" aria-label="${storyProjectionEscape(`${e.name}. Dünya durumu ayrıntıları için odaklan.`)}">ÇAĞ<b style="color:${e.color}">${e.icon} ${e.name}</b></div>`;
            })() : '') +
            '';   // KONSEY geri-sayım çipi kaldırıldı (kullanıcı isteği) — takvim konsey panelinde
        const tooltipHeld = [...stats.querySelectorAll('.detail-hover')].some(chip => (
            document.activeElement === chip
            || (typeof chip.matches === 'function' && chip.matches(':hover'))
        ));
        // Üst çubuk çok sık güncellenir. Aynı HTML'yi yeniden yazmak hover düğümünü
        // her karede yok edip tooltip'i 50 Hz titretiyordu. Hover/focus boyunca mevcut
        // düğüm korunur; ayrılınca ilk tikte güncel değerler tek seferde uygulanır.
        if (!tooltipHeld && stats.innerHTML !== nextStatsHtml) stats.innerHTML = nextStatsHtml;
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
        const rawMapName = (typeof DRAWN_MAP !== 'undefined' && DRAWN_MAP.name) ? DRAWN_MAP.name : 'Çizilen Harita';
        const mapName = /\u00c7izilen Harita/i.test(rawMapName)
            ? 'Standart taktik saha'
            : String(rawMapName).replace(/^[^\p{L}\p{N}]+/u, '');
        const doctrineLabels = { armor: 'Zırhlı Mızrak', combined: 'Birleşik Silahlar', defense: 'Derin Savunma' };
        const doctrine = doctrineLabels[STORY.cfg.doctrine] || 'Birleşik Silahlar';
        const foeValue = hostile && owner ? storyEnemyForceBudget(owner.id, selected.id) : null;
        const foeTotal = foeValue ? Math.floor(foeValue.oil + foeValue.manpower + foeValue.points) : 0;
        const reward = hostile ? '+120 puan · fetih · veteran ilerlemesi' : current ? 'Komuta ve ikmal merkezi' : 'Güvenli intikal';
        const rewardLabel = hostile ? 'ZAFER GETİRİSİ' : current ? 'BÖLGE İŞLEVİ' : 'İNTİKAL SONUCU';
        const forceLabel = hostile ? 'GARNİZON / TAHMİNİ GÜÇ' : 'GARNİZON';
        const nextInfoHtml = selected ?
            `<div class="story-node-heading"><b>${selected.name}</b><span class="story-node-state" style="color:${stateColor}">${stateText}</span></div>` +
            `<div class="story-brief-grid">` +
                `<div class="story-brief-cell">TÜR<b>${type}</b></div>` +
                `<div class="story-brief-cell">KONTROL<b style="color:${owner?.color || '#ffe9bf'}">${owner?.name || '-'}</b></div>` +
                `<div class="story-brief-cell">SAVAŞ HARİTASI<b>${mapName}</b></div>` +
                `<div class="story-brief-cell">${forceLabel}<b>${hostile ? `${selected.garrison || 0} / ~${foeTotal}` : (selected.garrison || 0)}</b></div>` +
            `</div><div class="story-brief-note">${rewardLabel}: ${reward}<br>ORDU DOKTRİNİ: ${doctrine}</div>` :
            `<div class="story-brief-note">Haritada bir şehir seçerek harekât brifingini aç.</div>`;
        storyUiSetHtml(info, nextInfoHtml);

        if (action) {
            action.disabled = current || !adjacent;
            action.classList.toggle('hostile', hostile && adjacent);
            action.textContent = current ? 'KOMUTA MERKEZİNDESİN' : !adjacent ? 'MENZİL DIŞI' : hostile ? 'HAREKÂTA GEÇ' : 'BÖLGEYE İLERLE';
        }
    }
    const log = document.getElementById('story-log');
    if (log) {
        const factionLabels = {
            '⚒️': 'İşçi desteği',
            '🏦': 'Sermaye desteği',
            '🎖️': 'Ordu desteği',
            '📰': 'Aydın desteği',
            '🔥': 'Radikal eğilim'
        };
        const formatLog = entry => {
            let value = String(entry == null ? '' : entry);
            for (const [icon, label] of Object.entries(factionLabels)) {
                value = value.replace(new RegExp(`${icon}([+-]\\d+(?:[.,]\\d+)?)`, 'g'), `${label} $1`);
            }
            return value;
        };
        storyUiSetHtml(log, storyFlowHtml(formatLog));
        storyFlowBind();
        // `index.html`'deki alt başlık "SON 6 KAYIT" diyordu; kırpma sınırı 240'a
        // çıkınca bu metin YANLIŞ hale geldi. index.html'e dokunmadan (o dosyada
        // paralel iş hattının commit'lenmemiş değişiklikleri var) burada düzeltilir.
        const ipucu = document.querySelector('.story-flow-hint');
        if (ipucu) {
            const dogru = 'EN YENİ OLAY ÜSTTE · SON ' + STORY_LOG_CAP + ' KAYIT ARŞİVLENİR';
            if (ipucu.textContent !== dogru) ipucu.textContent = dogru;
        }
    }
    const pb = document.getElementById('story-pause-btn');
    if (pb) {
        const conversationLocked = !!STORY._conversationPauseLease;
        const text = conversationLocked ? 'SOHBETTE DURAKLATILDI' : (STORY.paused ? 'DEVAM' : 'DURAKLAT');
        const title = conversationLocked
            ? 'Karakter görüşmesi kapanana kadar dünya zamanı durur'
            : (STORY.paused ? 'Devam' : 'Duraklat');
        if (pb.textContent !== text) pb.textContent = text;
        if (pb.title !== title) pb.title = title;
        if (pb.disabled !== conversationLocked) pb.disabled = conversationLocked;
    }
    const sb = document.getElementById('story-speed-btn');
    if (sb) {
        const speed = typeof storyClockSnapshot === 'function' ? storyClockSnapshot().speed : 1;
        const text = `${speed}× HIZ`;
        const title = `Dünya hızı: ${speed}×`;
        if (sb.textContent !== text) sb.textContent = text;
        if (sb.title !== title) sb.title = title;
    }
    if (typeof storyFactionNoticeBadgeUpdate === 'function') storyFactionNoticeBadgeUpdate();
}
function storyBar(label, val, color) {
    const v = Math.max(0, Math.min(100, val));
    return `<div class="story-bar-wrap"><span>${label}</span><div class="story-bar"><div style="width:${v}%;background:${color}"></div></div><span>${Math.round(v)}</span></div>`;
}

// ══ FAZ-2 ADIM 3: KONSEY (hükümet) DRAWER ═══════════════════════════════════
const STORY_CMD_COST = 120;   // yeni komutan maliyeti (her kaynaktan)
function storyCouncilOpen() {
    storyTechClose(); storyArmyClose(); storyCityClose(); storyEconomyClose();   // tek panel açık kalsın
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
    storyCouncilClose(); storyArmyClose(); storyCityClose(); storyEconomyClose();
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
    storyCouncilClose(); storyTechClose(); storyCityClose(); storyEconomyClose(); if (typeof storyNewsClose === 'function') storyNewsClose();
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

// EKONOMİ — şehir dosyasındaki ekonomik gerçekler ve fraksiyonlar tek yerde.
function storyEconomyOpen(sub) {
    storyCouncilClose(); storyTechClose(); storyArmyClose(); storyCityClose();
    if (typeof storyNewsClose === 'function') storyNewsClose();
    if (typeof storyTalkClose === 'function') storyTalkClose();
    STORY._economyOpen = true;
    if (sub && typeof STORY_ECONOMY_TABS !== 'undefined' && STORY_ECONOMY_TABS.includes(sub)) STORY._economySub = sub;
    const panel = document.getElementById('economy-panel');
    if (panel) { panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false'); }
    document.getElementById('story-economy-btn')?.classList.add('active');
    if (typeof storyEconomyUpdate === 'function') storyEconomyUpdate();
}
function storyEconomyClose() {
    STORY._economyOpen = false;
    const panel = document.getElementById('economy-panel');
    if (panel) { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); }
    document.getElementById('story-economy-btn')?.classList.remove('active');
}
function storyEconomyToggle() { STORY._economyOpen ? storyEconomyClose() : storyEconomyOpen(); }

// ══ FAZ 10.1: OYUNCU-GÖRÜNÜR DEĞİŞİM VE NEDEN PANELİ ═══════════════════════
function storyProjectionEscape(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function storyChangesProjection() {
    if (!STORY || !Array.isArray(STORY.states) || !STORY.states.length
        || typeof storyPlayerProjectionCurrent !== 'function') return null;
    const sequence = STORY.causality ? Number(STORY.causality.nextSequence) || 0 : 0;
    const key = `${STORY.playerStateId}|${sequence}|${Math.floor((Number(STORY.clock) || 0) * 2)}`;
    if (STORY._changeProjectionCache && STORY._changeProjectionCache.key === key) {
        return STORY._changeProjectionCache.value;
    }
    try {
        const value = storyPlayerProjectionCurrent({ maxItems: 40, recentSeconds: 60 });
        STORY._changeProjectionCache = { key, value };
        return value;
    } catch (error) {
        const value = {
            schemaVersion: 1,
            error: String(error && error.message ? error.message : error),
            badgeCount: 0,
            domains: {},
            domainCards: [],
            items: []
        };
        STORY._changeProjectionCache = { key, value };
        return value;
    }
}

function storyChangesBadgeUpdate() {
    const badge = document.getElementById('story-change-badge');
    if (!badge) return;
    const projection = storyChangesProjection();
    const count = projection && !projection.disabled ? Math.max(0, Number(projection.badgeCount) || 0) : 0;
    badge.textContent = count > 99 ? '99+' : String(count || '');
    badge.classList.toggle('hidden', count === 0);
    badge.title = count ? `Son ${projection.recentSeconds || 60} saniyede ${count} görünür değişim` : '';
}

function storyChangesOpen() {
    storyCouncilClose(); storyTechClose(); storyArmyClose(); storyCityClose();
    if (typeof storyNewsClose === 'function') storyNewsClose();
    if (typeof storyTalkClose === 'function') storyTalkClose();
    STORY._changesOpen = true;
    const panel = document.getElementById('story-change-panel');
    if (panel) { panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false'); }
    document.getElementById('story-change-btn')?.classList.add('active');
    storyChangesUpdate();
}

function storyChangesClose() {
    STORY._changesOpen = false;
    const panel = document.getElementById('story-change-panel');
    if (panel) { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); }
    document.getElementById('story-change-btn')?.classList.remove('active');
}

function storyChangesToggle() {
    STORY._changesOpen ? storyChangesClose() : storyChangesOpen();
}

function storyChangesFormatValue(value) {
    if (value == null) return '—';
    if (typeof value === 'number') return Math.abs(value) >= 100 ? Math.round(value).toLocaleString('tr-TR') : Number(value.toFixed(2)).toLocaleString('tr-TR');
    if (typeof value === 'string') {
        let match = /^country:(-?\d+)$/.exec(value);
        if (match) return (storyState(Number(match[1])) || {}).name || 'Bilinmeyen devlet';
        match = /^region:(-?\d+)$/.exec(value);
        if (match) return (storyNode(Number(match[1])) || {}).name || 'Bilinmeyen bölge';
        return value;
    }
    if (typeof value === 'object') {
        if (Number.isFinite(Number(value.min)) && Number.isFinite(Number(value.max))) {
            return `${storyChangesFormatValue(Number(value.min))}–${storyChangesFormatValue(Number(value.max))}`;
        }
        const resourceLabels = { oil: '⛽', manpower: '👥', points: '⭐' };
        const resourceParts = Object.keys(resourceLabels)
            .filter(key => Number(value[key]) !== 0 && Number.isFinite(Number(value[key])))
            .map(key => `${resourceLabels[key]}${Number(value[key]) > 0 ? '+' : ''}${storyChangesFormatValue(Number(value[key]))}`);
        if (resourceParts.length) return resourceParts.join(' ');
    }
    return 'Güncellendi';
}

function storyChangesItemValue(item) {
    if (item.precision !== 'EXACT') {
        return `KESİNLİK %${Math.round((item.knowledge.confidenceBps || 0) / 100)} · ${storyChangesFormatValue(item.visibleValue)}`;
    }
    if (item.delta != null) return storyChangesFormatValue(item.delta);
    return `${storyChangesFormatValue(item.before)} → ${storyChangesFormatValue(item.after)}`;
}

function storyChangesUpdate() {
    if (!STORY._changesOpen) return;
    const body = document.getElementById('story-change-body');
    if (!body) return;
    const projection = storyChangesProjection();
    if (!projection || projection.error) {
        storyUiSetHtml(body, `<div class="change-empty">Projeksiyon kurulamadı.<small>${storyProjectionEscape(projection && projection.error || 'Dünya hazır değil.')}</small></div>`);
        return;
    }
    if (projection.disabled) {
        storyUiSetHtml(body, '<div class="change-empty">Nedensellik görünümü özellik bayrağıyla kapalı.</div>');
        return;
    }

    const domainHtml = Object.values(projection.domains || {})
        .filter(domain => domain.itemCount > 0)
        .map(domain => `<span title="${storyProjectionEscape(domain.title)}">${storyProjectionEscape(domain.icon)} ${storyProjectionEscape(domain.title)} <b>${domain.itemCount}</b></span>`)
        .join('');
    const items = projection.items || [];
    if (!STORY._changeDetailId || !items.some(item => item.id === STORY._changeDetailId)) {
        STORY._changeDetailId = items.length ? items[0].id : null;
    }
    const selected = items.find(item => item.id === STORY._changeDetailId) || null;
    const rows = items.map(item => {
        const age = Math.max(0, Math.round((projection.generatedAt || 0) - item.observedAt));
        const cls = item.id === STORY._changeDetailId ? ' selected' : '';
        return `<button class="change-row${cls}" data-change-id="${storyProjectionEscape(item.id)}">`
            + `<span class="change-tone ${item.badge.tone.toLowerCase()}"></span>`
            + `<span class="change-main"><b>${storyProjectionEscape(item.subjectName)}</b><small>${storyProjectionEscape(item.badge.text)} · ${age} sn önce</small></span>`
            + `<em>${storyProjectionEscape(storyChangesItemValue(item))}</em></button>`;
    }).join('');
    const detail = selected
        ? `<section class="change-detail"><header><span>NEDEN DEĞİŞTİ?</span><b>${storyProjectionEscape(selected.subjectName)} · ${storyProjectionEscape(selected.label)}</b></header>`
            + `<div class="change-knowledge ${selected.precision === 'EXACT' ? 'verified' : 'uncertain'}">${selected.precision === 'EXACT' ? 'DOĞRULANMIŞ BİLGİ' : `KESİN OLMAYAN BİLGİ · %${Math.round((selected.knowledge.confidenceBps || 0) / 100)}`}</div>`
            + `<div class="change-trace">${selected.cause.steps.map((step, index) => (
                `<div class="change-step"><i>${String(index + 1).padStart(2, '0')}</i><span>${storyProjectionEscape(step.label)}</span></div>`
            )).join('')}</div>`
            + `<p>SONUÇ: <b>${storyProjectionEscape(storyChangesItemValue(selected))}</b></p></section>`
        : '<div class="change-empty">Henüz oyuncunun doğrulayabildiği kalıcı bir değişim yok.</div>';

    storyUiSetHtml(body, `<div class="change-summary"><span>SON ${projection.recentSeconds} SN</span><b>${projection.badgeCount} DEĞİŞİM</b></div>`
        + `<div class="change-domains">${domainHtml || '<span>GÖRÜNÜR KAYIT YOK</span>'}</div>`
        + `<div class="change-list">${rows || '<div class="change-empty">Dünya ilerledikçe doğrulanmış değişiklikler burada görünecek.</div>'}</div>`
        + detail);
}

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
        + ((typeof charDiceBadge === 'function') ? charDiceBadge(c.skills, true) : '')
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
    storyUiSetHtml(body, html);
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
    if (tech.sibling && storyTechHasIn(ids, tech.sibling)) return { state: 'locked', reason: (TECH_BY_ID[tech.sibling] ? TECH_BY_ID[tech.sibling].name : '') + ' seçildi; aynı ikiliden yalnız biri araştırılabilir', cost };
    if (tech.tier >= 3 && !ids.some(id => TECH_BY_ID[id] && TECH_BY_ID[id].branch === 'state'))
        return { state: 'locked', reason: 'Çağ Kapısı: Devlet dalında en az 1 teknoloji gerekli', cost };
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
            else if (storyRandom('governance') < 0.45) storyLog(`⚙️ ${st.name} teknoloji geliştirdi: <b>${best.name}</b>`);
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
        + `<div class="tech-hint">Teknoloji <b>satın alınmaz</b> — fon yeterse en ucuz uygun araştırma kendiliğinden tamamlanır; pahalı veya stratejik olanı <b>KONSEY</b> seçer (sonraki toplantı: ${(toC / YEAR_SECONDS).toFixed(1)} yıl).</div>`
        + `<div class="tech-hint">Maliyet her araştırmada %10 artar · Kademe 3 için Devlet dalında en az 1 teknoloji · Kademe 4 için toplam 8 teknoloji · Kademe 2 ikililerinden yalnız biri seçilebilir</div></div><div class="tech-cols">`;
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
            html += `<div class="tech-rival-row"><span style="color:${r.color}">⬤ ${r.name}</span><span><b>${(r.tech || []).length}</b> teknoloji</span></div>`;
        html += `</div>`;
    }
    storyUiSetHtml(body, html);
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
    const bannerHtml =
        `<div class="story-res">🏛️ Cumhurbaşkanı: <b style="color:${isAdmin ? '#4cff7c' : '#ffd24c'}">${isAdmin ? (STORY.commander ? STORY.commander.name + ' (SEN)' : 'SEN') : ((typeof storyPresidentName === 'function') ? storyPresidentName(me) : 'AI')}</b></div>`
        + storyBar('Refah', me.welfare, '#54e08a')
        + `<div class="story-res">🏅 İtibar <b>${me.reputation}/6</b>${isAdmin ? '' : (me.reputation >= 6 && me.welfare >= 60 ? ' <span style="color:#4cff7c">— seçime hazırsın!</span>' : ` <span style="color:#9fb3c8">(seçim: itibar≥6 + refah≥60)</span>`)}</div>`
        + (isAdmin ? `<div class="story-res" style="color:#4cff7c;font-size:12px">🎖️ Komutan yaratabilir/dağıtabilirsin.</div>` : `<div class="story-res" style="color:#9fb3c8;font-size:12px">🔒 Yönetici olunca komutanları yönetirsin.</div>`);
    storyUiSetHtml(banner, bannerHtml);
    const cmds = storyPlayerCommanders();
    const myr = (STORY.commander && STORY.commander.res) || { oil: 0, manpower: 0, points: 0 };
    const inc = STORY._incPerCmd || { oil: 0, manpower: 0, points: 0 };
    const tre = document.getElementById('council-treasury');
    // 'Senin kasan' satırı kaldırıldı (kullanıcı: kasa ana panelde zaten görünüyor)
    const treasuryHtml = `<b>DEVLET HAZİNESİ</b>`
        + `<br><span style="color:#dfe7ef">PETROL ${Math.floor(me.res.oil)} · İNSAN ${Math.floor(me.res.manpower)} · PUAN ${Math.floor(me.res.points)}</span>`
        + `<br><span style="color:#9fb3c8;font-size:12px">${cmds.length} komutan · KİŞİ BAŞI/SN: PETROL +${inc.oil.toFixed(1)} · İNSAN +${inc.manpower.toFixed(1)} · PUAN +${inc.points.toFixed(1)}</span>`
        + `<div class="council-skill-legend">YETENEKLER · ⚔ SAVAŞ · 🕊 DİPLOMASİ · ⚙ İKTİSAT · ● SADAKAT</div>`;
    storyUiSetHtml(tre, treasuryHtml);
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
    const listHtml = presCard + sorted.map(c => {
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
    storyUiSetHtml(list, listHtml);
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
    if (laws && typeof storyCouncilLawsHtml === 'function') storyUiSetHtml(laws, storyCouncilLawsHtml(me));
    if (typeof storyGovernanceUpdate === 'function') storyGovernanceUpdate();
    storyCouncilSyncTabs();
}
// Aktif sekmeyi göster/gizle (komutan listesi ↔ kanun/anayasa)
function storyCouncilSyncTabs() {
    const requested = STORY._councilTab || 'cmd';
    const tab = requested === 'law' || requested === 'gov' ? requested : 'cmd';
    STORY._councilTab = tab;
    document.querySelectorAll('#council-tabs .ctab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById('council-tab-cmd')?.classList.toggle('hidden', tab !== 'cmd');
    document.getElementById('council-tab-law')?.classList.toggle('hidden', tab !== 'law');
    document.getElementById('council-tab-gov')?.classList.toggle('hidden', tab !== 'gov');
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
        if (typeof storyCouncilPayFromState === 'function') {
            if (!storyCouncilPayFromState(m2, { oil: C, manpower: C, points: C })) {
                cc.classList.add('hidden');
                return;
            }
        } else {
            m2.res.oil -= C; m2.res.manpower -= C; m2.res.points -= C;
        }
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
            if (!dest) { const others = STORY.states.filter(s => !s.isPlayer && s.gov && STORY.nodes.some(n => n.owner === s.id)); if (others.length) { const ts = others[storyRandomInt('society', others.length)], c2 = STORY.nodes.find(n => n.owner === ts.id); dest = { ts, node: c2 ? c2.id : cmd.node }; } }
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
    storyBriefSetTab(STORY._briefTab || 'agenda');
    document.getElementById('story-brief-tabs')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-story-brief-tab]');
        if (button) storyBriefSetTab(button.dataset.storyBriefTab);
    });
    document.getElementById('story-brief-tabs')?.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const current = STORY_BRIEF_TABS.indexOf(STORY._briefTab || 'agenda');
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? STORY_BRIEF_TABS.length - 1
            : (current + (event.key === 'ArrowRight' ? 1 : -1) + STORY_BRIEF_TABS.length) % STORY_BRIEF_TABS.length;
        event.preventDefault();
        storyBriefSetTab(STORY_BRIEF_TABS[next]);
        document.querySelector(`[data-story-brief-tab="${STORY_BRIEF_TABS[next]}"]`)?.focus();
    });
    document.getElementById('story-agenda-list')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-story-agenda-action]');
        if (button) storyAgendaNavigate(button.dataset.storyAgendaAction, button.dataset.storyAgendaSub);
    });
    document.getElementById('story-pause-btn')?.addEventListener('click', () => {
        if (STORY._conversationPauseLease) return;
        STORY.paused = !STORY.paused;
        storyRender();
    });
    document.getElementById('story-speed-btn')?.addEventListener('click', () => {
        if (typeof storyClockCycleSpeed === 'function') storyClockCycleSpeed();
        storyPanelUpdate();
    });
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
    document.getElementById('story-economy-btn')?.addEventListener('click', storyEconomyToggle);
    document.getElementById('economy-close')?.addEventListener('click', storyEconomyClose);
    document.getElementById('faction-event-close')?.addEventListener('click', () => {
        if (typeof storyFactionNoticeClose === 'function') storyFactionNoticeClose();
    });
    document.getElementById('faction-event-economy')?.addEventListener('click', () => {
        if (typeof storyFactionNoticeOpenEconomy === 'function') storyFactionNoticeOpenEconomy();
    });
    document.getElementById('faction-event-responses')?.addEventListener('click', (e) => {
        const button = e.target.closest('button[data-collective-response]');
        if (!button || button.disabled) return;
        if (typeof storyFactionNoticeRespond === 'function') {
            storyFactionNoticeRespond(button.dataset.collectiveResponse);
        }
    });
    document.getElementById('economy-body')?.addEventListener('click', (e) => {
        const button = e.target.closest('button'); if (!button || button.disabled) return;
        if (button.classList.contains('economy-sub')) {
            STORY._economySub = button.dataset.sub;
            return (typeof storyEconomyUpdate === 'function') && storyEconomyUpdate();
        }
        if (button.classList.contains('city-route')) {
            const legacy = typeof storyCityDossierLegacyId === 'function' ? storyCityDossierLegacyId(button.dataset.region) : null;
            const node = legacy == null ? null : storyNode(legacy);
            if (!node) return;
            STORY.selectedNodeId = node.id;
            if (typeof storyCamCenterOn === 'function') storyCamCenterOn(node);
            return (typeof storyEconomyUpdate === 'function') && storyEconomyUpdate();
        }
    });
    document.getElementById('army-close')?.addEventListener('click', storyArmyClose);
    document.getElementById('story-city-btn')?.addEventListener('click', storyCityToggle);
    document.getElementById('city-close')?.addEventListener('click', storyCityClose);
    document.getElementById('city-body')?.addEventListener('click', (e) => {   // ŞEHRE GİR: navigasyon + şehir/bina/üretim/garnizon
        const b = e.target.closest('button'); if (!b || b.disabled) return;
        if (b.classList.contains('city-route')) return storyCityDossierOpenRegion(b.dataset.region);
        if (b.classList.contains('city-character')) return storyCityDossierOpenCharacter(b.dataset.character);
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
    document.getElementById('governance-body')?.addEventListener('click', (e) => {
        if (typeof storyGovernanceHandleClick === 'function') storyGovernanceHandleClick(e);
    });
    document.getElementById('governance-body')?.addEventListener('change', (e) => {
        if (typeof storyGovernanceHandleChange === 'function') storyGovernanceHandleChange(e);
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
            if (typeof storyMapPickNode === 'function') return storyMapPickNode(wx, wy);
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
                if (STORY._cityOpen || STORY._economyOpen) {
                    const w = worldFromEvent(e), hit = pickNode(w.x, w.y);
                    if (hit >= 0) {
                        storySelectNode(hit);
                        if (STORY._economyOpen && typeof storyEconomyUpdate === 'function') storyEconomyUpdate();
                    } else {
                        if (STORY._cityOpen) storyCityClose();
                        if (STORY._economyOpen) storyEconomyClose();
                    }
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
    // Metin girişi kamera kısayollarından bağımsızdır. Özellikle WASD,
    // görüşme metni yazılırken preventDefault ile yutulmamalıdır.
    const storyKeyboardTargetIsEditable = target => !!(target && target.closest
        && target.closest('input, textarea, select, [contenteditable="true"]'));

    // KAMERA: WASD / ok tuşları (yalnız story ekranındayken)
    window.addEventListener('keydown', (e) => {
        if (typeof APP_SCREEN === 'undefined' || APP_SCREEN !== 'story') return;
        if (storyKeyboardTargetIsEditable(e.target)) return;
        if (e.key === 'Escape') { if (STORY._councilOpen || STORY._techOpen || STORY._armyOpen || STORY._cityOpen || STORY._economyOpen) { storyCouncilClose(); storyTechClose(); storyArmyClose(); storyCityClose(); storyEconomyClose(); e.preventDefault(); } return; }
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
