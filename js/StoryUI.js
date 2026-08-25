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
    { key: 'dunya', ad: 'DÜNYA', simgeler: ['🌍', '⚠️'] },
    // Ayrı GAZETE paneli kaldırıldı; manşetler buraya düşüyor (js/News.js).
    { key: 'manset', ad: 'MANŞET', simgeler: ['🗞️'] }
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

    /* ÇARPIT, kaldırılan gazete panelinden buraya taşındı. Düğme YALNIZ hâlâ
       çarpıtılabilir manşette çizilir (kendi devletin için kötü + 45 sn içinde),
       yani oyuncu her satırda ölü bir düğme görmez. Kalan süre yazılıyor çünkü
       pencere kaçırıldığında düğme sessizce kayboluyordu. */
    const carpitHtml = (k) => {
        if (k.haber == null || typeof storyNewsById !== 'function') return '';
        const rec = storyNewsById(k.haber);
        if (!rec || typeof storyNewsCanSpin !== 'function' || !storyNewsCanSpin(rec)) return '';
        const kalanSn = Math.max(0, Math.ceil(NEWS_SPIN_WINDOW - ((STORY.clock || 0) - rec.t)));
        return `<button type="button" class="story-flow-carpit" data-haber-carpit="${rec.id}"
            title="Bu manşet devletin için kötü. ${NEWS_SPIN_COST}⭐ ile çarpıt.">📢 ÇARPIT ${NEWS_SPIN_COST}⭐ · ${kalanSn}sn</button>`;
    };
    const satirlar = gosterilecek.length
        ? gosterilecek.map(k => `<div class="story-log-row${k.haber != null ? ' manset' : ''}">
            ${k.t != null ? `<time>${storyProjectionEscape(storyFlowZaman(k.t))}</time>` : ''}
            <span>${formatLog(k.m)}${carpitHtml(k)}</span></div>`).join('')
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
   sayı değişmiyor — `../docs/story/status/HIKAYE_MODU_UYGULAMA_DURUMU.md:344-354`'teki koşul bu. */
const STORY_TOOL_ROL_ONCELIK = Object.freeze({
    COMMANDER:     ['story-army-btn', 'story-city-btn', 'story-commander-btn', 'story-council-btn', 'story-talk-btn'],
    COMPANY_OWNER: ['story-economy-btn', 'story-tech-btn', 'story-city-btn', 'story-talk-btn', 'story-commander-btn'],
    MAYOR:         ['story-city-btn', 'story-economy-btn', 'story-council-btn', 'story-talk-btn'],
    EXECUTIVE:     ['story-council-btn', 'story-talk-btn', 'story-economy-btn', 'story-commander-btn'],
    AGENT:         ['story-talk-btn', 'story-council-btn', 'story-commander-btn'],
    CIVILIAN:      ['story-talk-btn', 'story-city-btn', 'story-economy-btn']
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

function storySeasonForUi() {
    const calendar = typeof storyCalendarNow === 'function'
        ? storyCalendarNow() : { seasonIndex: 0, year: STORY.year || 2032, label: '' };
    const seasons = [
        { name: 'KIŞ', color: '#b9dcff', detail: 'Kuzey enlemlerinde kar ve kış görünümü güçlenir.' },
        { name: 'İLKBAHAR', color: '#83e2a0', detail: 'Kar örtüsü çekilir; yeşil yüzeyler ve tarım dönemi belirginleşir.' },
        { name: 'YAZ', color: '#f0d66f', detail: 'Sıcak ve kuru yüzey görünümü güney enlemlerinde belirginleşir.' },
        { name: 'SONBAHAR', color: '#e3a45e', detail: 'Bitki örtüsü ve tarım yüzeyleri sonbahar paletine geçer.' }
    ];
    const season = seasons[Math.max(0, Math.min(3, Number(calendar.seasonIndex) || 0))];
    return Object.assign({ calendar }, season);
}

function storySeasonTooltip() {
    const season = storySeasonForUi();
    const worldState = storyWorldStateTooltip();
    return `${season.name} · ${season.calendar.label || season.calendar.year}\n${season.detail}`
        + (worldState ? `\n\nDünya dengesi\n${worldState}` : '');
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

/* innerHTML yazmak kapsayıcıdaki TÜM düğümleri değiştirir; içeride odaklanmış
   bir metin kutusu varsa odak ve imleç yok olur. Ölçüldü: AKIŞ arama kutusuna
   tıkladıktan 200 ms sonra odak `BODY`ye düşüyordu (panel saniyede bir yeniden
   çiziliyor). Yazarken sorun görünmüyordu çünkü `storyFlowBind` her tuş
   vuruşunda yeniden odaklıyor — kutuya tıklayıp düşünen oyuncu için görünüyordu.
   Burada odak/imleç yazmadan ÖNCE alınır, aynı id'li düğüme geri konur. */
function storyUiSetHtml(element, html) {
    if (!element || element.innerHTML === html) return false;
    const etkin = document.activeElement;
    const odakId = (etkin && etkin.id && element.contains(etkin) &&
        /^(INPUT|TEXTAREA)$/.test(etkin.tagName)) ? etkin.id : null;
    const bas = odakId ? etkin.selectionStart : null;
    const son = odakId ? etkin.selectionEnd : null;
    element.innerHTML = html;
    if (odakId) {
        const yeni = document.getElementById(odakId);
        if (yeni && yeni !== etkin) {
            yeni.focus();
            try { if (bas != null) yeni.setSelectionRange(bas, son); } catch (_) { /* type=search kısıtı */ }
        }
    }
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

/* ── KUSUR 15: gündem yönlendiriyordu ama karar verdirmiyordu ────────────────
   Kart yalnız "paneli aç" diyordu; kiminle konuşacağın, neye mal olacağı ve
   yetkinin yetip yetmediği hiçbir yerde görünmüyordu.

   İCAT YOK. Muhatap kanonik kurum kimliğinden türetiliyor (`institution:...`,
   `political:...`, `intelligence:...` — kurumun kendi türü ne yönettiğini
   söylüyor), bedelli eylemler ise motorun kendi oyuncu görünümünden geliyor:
   `storyCharacterActionPlayerView(...)` → `{ actionType, label, allowed, cost,
   reasons }`. Aynı API görüşme penceresinde zaten kullanılıyor (Talks.js).

   YÜRÜTME BURADA YOK. Kart kararı yalnız GÖSTERİR; tıklayınca mevcut ve
   doğrulanmış görüşme çalışma alanı açılır. Böylece dünya durumunu değiştiren
   tek yol tek yerde kalır — determinizm ve kayıt yolu riske girmez. */
const STORY_AGENDA_MUHATAP = Object.freeze({
    economy:    ['labor-organizer', 'finance', 'economy', 'trade'],
    governance: ['government-whip', 'executive', 'interior'],
    council:    ['government-whip', 'opposition-leader', 'executive'],
    region:     ['armed_forces', 'defense'],
    talk:       null,   // muhatap zaten görüşmenin karşı tarafı
    flow:       null
});

function storyAgendaMuhatap(action) {
    const anahtarlar = STORY_AGENDA_MUHATAP[action];
    if (!anahtarlar || typeof storyCharacterActionIdentities !== 'function') return null;
    if (typeof storyCharacterActionAIPlayerActorId !== 'function') return null;
    const kimlikler = storyCharacterActionIdentities();
    const oyuncuId = storyCharacterActionAIPlayerActorId();
    const oyuncu = oyuncuId ? kimlikler[oyuncuId] : null;
    if (!oyuncu) return null;
    // yalnız KENDİ ülkendeki makam sahipleri: yabancı kurum muhatap sayılmaz
    const adaylar = Object.keys(kimlikler)
        .map(k => kimlikler[k])
        .filter(a => a && a.countryId === oyuncu.countryId && a.id !== oyuncu.id
                     && (a.institutionId || a.serviceId));
    for (const anahtar of anahtarlar) {
        const bulunan = adaylar.find(a =>
            String(a.institutionId || a.serviceId || '').toLowerCase().includes(anahtar));
        if (bulunan) return bulunan;
    }
    return null;
}

function storyAgendaKararlarHtml(action) {
    const kisi = storyAgendaMuhatap(action);
    if (!kisi || typeof storyCharacterActionPlayerView !== 'function') return '';
    let gorunum = null;
    try { gorunum = storyCharacterActionPlayerView(kisi.id, {}); } catch (e) { return ''; }
    if (!gorunum || gorunum.disabled) return '';
    const eylemler = (gorunum.actions || []).slice(0, 3);
    if (!eylemler.length) return '';
    /* Stiller SATIR İÇİ: `style.css` paralel iş hattının commit'lenmemiş
       değişikliklerini taşıyor, o dosyaya dokunmak onların işini bu commit'e
       karıştırırdı (kusur 14'te de aynı yol izlendi). CSS'siz bırakılınca satır
       `MUHATAPAlp ÖzkanEmek Bloğu Sözcüsü` diye bitişik çıkıyordu — ölçüldü. */
    const kStil = 'display:inline-flex;gap:5px;align-items:baseline;';
    const satir = eylemler.map(a => {
        const bedel = a.cost && a.cost.key ? `${a.cost.key} ${a.cost.amount}` : 'bedelsiz';
        const engel = (a.reasons || [])[0] || (a.domainReasons || [])[0] || null;
        return `<button class="agenda-karar" style="${kStil}${a.allowed ? '' : 'opacity:.55;'}"`
            + ` data-agenda-kisi="${storyProjectionEscape(kisi.id)}"`
            + ` data-agenda-kisi-ad="${storyProjectionEscape(kisi.name || '')}"`
            + ` data-agenda-izin="${a.allowed ? '1' : '0'}"`
            + ` title="${storyProjectionEscape(engel ? 'Engel: ' + engel : 'Görüşme penceresinde uygulanır')}">`
            + `<b style="font-weight:400">${storyProjectionEscape(a.label || a.actionType)}</b>`
            + `<small style="opacity:.7">${storyProjectionEscape(a.allowed ? bedel : (engel || 'yetki yok'))}</small></button>`;
    }).join('');
    return `<div class="agenda-muhatap" style="display:flex;flex-wrap:wrap;gap:6px;align-items:baseline;margin:0 0 7px">`
        + `<span style="color:var(--wr-dim);font-size:7px;letter-spacing:1.4px">MUHATAP</span>`
        + `<b style="color:var(--wr-amber-bright);font-size:10px;font-weight:400">${storyProjectionEscape(kisi.name || '—')}</b>`
        + `<small style="color:var(--wr-muted);font-size:8px">${storyProjectionEscape(kisi.publicTitle || kisi.role || '')}</small></div>`
        + `<div class="agenda-kararlar" style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">${satir}</div>`;
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
        + storyAgendaKararlarHtml(item.action)   // kusur 15 — muhatap + bedelli kararlar
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

/* ── DURAKLATMA (SPACE + üstte gösterge) ─────────────────────────────────────
   Duraklatma tek yerden geçer: hem sağ üstteki düğme hem SPACE burayı çağırır.
   Sohbet kilidi (`_conversationPauseLease`) varken dünya zaten durmuş olur ve
   oyuncunun onu elle açması karakter görüşmesini bozar — o yüzden kilitliyken
   geçiş sessizce reddedilir, düğme de zaten `disabled`. */
function storyTogglePause(zorla) {
    if (typeof STORY === 'undefined') return false;
    if (STORY._conversationPauseLease) return false;
    STORY.paused = (zorla === undefined) ? !STORY.paused : !!zorla;
    storyPauseFlagUpdate();
    if (typeof storyRender === 'function') storyRender();
    return STORY.paused;
}

/* Gösterge yalnız GERÇEKTEN durmuş dünyada çıkar. Sohbet kilidi ve konsey
   oturumu da dünyayı durdurur ama onların kendi ekranı var; ikinci bir "durdu"
   rozeti göstermek gürültü olurdu. */
function storyPauseFlagUpdate() {
    if (typeof document === 'undefined' || typeof STORY === 'undefined') return;
    const goster = !!STORY.paused && !STORY._conversationPauseLease && !STORY._session;
    if (document.body.getAttribute('data-story-durak') !== (goster ? '1' : '0'))
        document.body.setAttribute('data-story-durak', goster ? '1' : '0');
    const bayrak = document.getElementById('story-pause-flag');
    if (bayrak && bayrak.getAttribute('aria-hidden') !== (goster ? 'false' : 'true'))
        bayrak.setAttribute('aria-hidden', goster ? 'false' : 'true');
}

const STORY_REGION_SITE_LABELS = Object.freeze({
    INDUSTRIAL: 'FABRİKA / SANAYİ TESİSİ', EXTRACTION: 'MADEN / ÇIKARIM TESİSİ',
    AGRICULTURE: 'TARIM TESİSİ', ENERGY: 'ENERJİ TESİSİ', LOGISTICS: 'LOJİSTİK TESİSİ',
    DEFENSE: 'SAVUNMA TESİSİ', CIVIC: 'KAMU TESİSİ', RESIDENTIAL: 'KONUT TESİSİ'
});
const STORY_REGION_USE_LABELS = Object.freeze({
    CORE: 'ŞEHİR MERKEZİ', RESIDENTIAL: 'KONUT İLÇESİ', INDUSTRIAL: 'SANAYİ İLÇESİ',
    CIVIC: 'KAMU İLÇESİ', DEFENSE: 'SAVUNMA İLÇESİ', LOGISTICS: 'LOJİSTİK İLÇESİ',
    AGRICULTURE: 'TARIM ALANI', EXTRACTION: 'MADEN ALANI'
});
const STORY_REGION_COVER_LABELS = Object.freeze({
    WATER: 'DENİZ', COAST: 'KIYI ARAZİSİ', OPEN_LAND: 'AÇIK ARAZİ',
    FOREST: 'ORMAN', MOUNTAIN: 'DAĞLIK ARAZİ', DRYLAND: 'KURAK ARAZİ'
});
const STORY_REGION_RESOURCE_LABELS = Object.freeze({
    NONE: 'YATAK YOK', PETROLEUM: 'PETROL', MINERAL: 'MİNERAL / MADEN CEVHERİ'
});
const STORY_REGION_CONSTRUCTION_LABELS = Object.freeze({
    RESIDENTIAL: 'KONUT VE YAŞAM ALANI',
    INDUSTRIAL: 'SANAYİ TESİSİ',
    LOGISTICS: 'LOJİSTİK MERKEZİ'
});
const STORY_REGION_OWNER_LABELS = Object.freeze({
    STATE: 'KAMU / KURUMSAL', DOMESTIC_PRIVATE: 'YERLİ ÖZEL SERMAYE',
    FOUNDER: 'BAĞIMSIZ KURUCU', FOREIGN_PRIVATE: 'YABANCI ÖZEL SERMAYE'
});
function storyRegionNumber(value) {
    const match = String(value == null ? '' : value).match(/(-?\d+)$/);
    return match ? Number(match[1]) : null;
}
function storyRegionFormatNumber(value) {
    return Math.max(0, Math.round(Number(value) || 0)).toLocaleString('tr-TR');
}
function storyRegionSelectionResolve(selected) {
    const fallback = selected ? { kind: 'CITY', nodeId: selected.id, regionId: `region:${selected.id}` } : null;
    const ref = STORY._selectedMapEntity;
    if (!ref || !selected) return fallback;
    if (ref.kind !== 'HEX' && storyRegionNumber(ref.regionId) !== Number(selected.id)) return fallback;
    if (ref.kind === 'CITY' || typeof storyHexSitesEnsure !== 'function') return fallback;
    try {
        const model = storyHexSitesEnsure();
        const land = model.landUseByCellId[String(ref.cellId)] || null;
        if (ref.kind === 'HEX') {
            const natural = typeof storyHexNaturalResourcesEnsure === 'function'
                ? storyHexNaturalResourcesEnsure() : null;
            const world = typeof storyHexWorldEnsure === 'function' ? storyHexWorldEnsure() : null;
            const index = Number(ref.cellIndex);
            const cover = natural && STORY_HEX_NATURAL_COVER_NAMES[
                Number(natural.coverCodes[index])
            ] || 'OPEN_LAND';
            const resource = natural && STORY_HEX_NATURAL_RESOURCE_NAMES[
                Number(natural.resourceCodes[index])
            ] || 'NONE';
            const deposit = natural && natural.depositByCellId[String(ref.cellId)] || null;
            const managementRecords = typeof storyHexLandManagementRecords === 'function'
                ? storyHexLandManagementRecords(String(ref.cellId)) : [];
            const administrativeAssigned = ref.assigned !== false
                && storyRegionNumber(ref.regionId) === Number(selected.id);
            return { kind: 'HEX', nodeId: selected.id, regionId: ref.regionId,
                cellId: ref.cellId, cellIndex: index, cover, resource, deposit,
                administrativeAssigned,
                nearestNodeId: administrativeAssigned ? null : selected.id,
                managementRecords,
                arableSuitabilityBps: natural && Number(natural.arableSuitabilityBps[index]) || 0,
                forestrySuitabilityBps: natural && Number(natural.forestrySuitabilityBps[index]) || 0,
                q: world && Number(world.qValues[index]), r: world && Number(world.rValues[index]) };
        }
        if (!land || storyRegionNumber(land.regionId) !== Number(selected.id)) return fallback;
        const siteIds = model.siteIdsByCellId[String(ref.cellId)] || [];
        const siteId = ref.siteId && siteIds.includes(String(ref.siteId))
            ? String(ref.siteId) : siteIds[0];
        const site = siteId ? model.siteById[siteId] : null;
        return { kind: site ? 'SITE' : 'DISTRICT', nodeId: selected.id,
            regionId: land.regionId, cellId: land.cellId, land, site };
    } catch (_) { return fallback; }
}
function storyRegionConstructionDossier(site) {
    if (!site || !site.sourceConstructionId) return null;
    const ledger = STORY.hexConstruction || { commands: [], applications: [] };
    const command = (ledger.commands || []).find(row =>
        String(row.id) === String(site.sourceConstructionId));
    if (!command) return null;
    const application = (ledger.applications || []).find(row =>
        String(row.commandId || '') === String(command.id)
        || String(row.correlationId || '') === String(command.correlationId || ''));
    const company = typeof storyCompanyById === 'function'
        ? storyCompanyById(command.companyId) : null;
    const applicant = typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(command.applicantActorId) : null;
    const requirements = command.requirements || {};
    const remainingDays = Math.max(0, Number(command.remainingDays) || 0);
    const durationDays = Math.max(1, Number(requirements.durationDays) || 1);
    const progress = Math.max(0, Math.min(100,
        Math.round((1 - remainingDays / durationDays) * 100)));
    const secondsPerYear = typeof STORY_CALENDAR !== 'undefined'
        ? Number(STORY_CALENDAR.secondsPerYear) || 120 : 120;
    const daysPerYear = typeof STORY_CALENDAR !== 'undefined'
        ? Number(STORY_CALENDAR.daysPerYear) || 360 : 360;
    const started = typeof storyCalendarAt === 'function'
        ? storyCalendarAt(Number(command.startedAt) || Number(command.submittedAt) || STORY.clock) : null;
    const expected = typeof storyCalendarAt === 'function'
        ? storyCalendarAt((Number(STORY.clock) || 0)
            + remainingDays / daysPerYear * secondsPerYear) : null;
    return { command, application, company, applicant, requirements,
        remainingDays, durationDays, progress, started, expected };
}
function storyRegionConstructionHtml(site, selected, cityButton) {
    const dossier = storyRegionConstructionDossier(site);
    if (!dossier) return '';
    const esc = storyProjectionEscape;
    const command = dossier.command;
    const req = dossier.requirements;
    const type = STORY_REGION_CONSTRUCTION_LABELS[command.projectType]
        || command.projectType || 'YAPI';
    const materialRows = Object.entries(req.materials || {}).map(([resourceId, quantity]) =>
        `<span><b>${esc(storyRegionLogisticsResourceLabel(resourceId))}</b><em>${storyRegionFormatNumber(quantity)}</em></span>`).join('');
    const authority = command.permission && command.permission.institutionId
        || dossier.application && dossier.application.authorityRequestId || 'KAYIT YOK';
    return `<div class="story-node-heading"><b>${esc(type)}</b><span class="story-node-state construction">İNŞAAT</span></div>`
        + `<div class="story-context-parent">${esc(selected.name)} idarî bölgesi · ${esc(site.cellId)} · PROJE ${esc(command.id)}</div>`
        + `<div class="story-construction-progress"><div><b>İLERLEME</b><span>%${dossier.progress}</span></div><progress max="100" value="${dossier.progress}" aria-label="İnşaat ilerlemesi yüzde ${dossier.progress}"></progress><small>${storyRegionFormatNumber(dossier.remainingDays)} dünya günü kaldı · Tahmini bitiş: ${esc(dossier.expected && dossier.expected.label || 'HESAPLANAMADI')}</small></div>`
        + `<div class="story-brief-grid"><div class="story-brief-cell">PROJE TÜRÜ<b>${esc(type)}</b></div>`
        + `<div class="story-brief-cell">DURUM<b>${esc(command.status || 'KAYIT YOK')}</b></div>`
        + `<div class="story-brief-cell">BAŞLAMA<b>${esc(dossier.started && dossier.started.label || 'KAYIT YOK')}</b></div>`
        + `<div class="story-brief-cell">TOPLAM SÜRE<b>${storyRegionFormatNumber(dossier.durationDays)} gün</b></div>`
        + `<div class="story-brief-cell">YATIRIMCI / YÜKLENİCİ<b>${esc(dossier.company && dossier.company.name || command.companyId || 'DOĞRULANMADI')}</b></div>`
        + `<div class="story-brief-cell">BAŞVURU SAHİBİ<b>${esc(dossier.applicant && dossier.applicant.name || command.applicantActorId || 'KAYIT YOK')}</b></div></div>`
        + `<div class="story-ownership"><small>FİNANSMAN VE KAYNAK REZERVASYONU</small><strong>TOPLAM ${storyRegionFormatNumber(req.cash)} KREDİ</strong>`
        + `<span><b>Yapım bütçesi</b><em>${storyRegionFormatNumber(req.constructionCash)}</em></span>`
        + `<span><b>Arsa / kullanım hakkı</b><em>${storyRegionFormatNumber(req.landCash)}</em></span>`
        + `<span><b>Ayrılmış işgücü</b><em>${storyRegionFormatNumber(req.workforce)} kişi</em></span>${materialRows}</div>`
        + `<div class="story-brief-note"><b>YETKİ VE SORUMLULUK</b><br>İzin / kurum kaydı: ${esc(authority)}<br>Çevresel maliyet: ${storyRegionFormatNumber(req.environmentalCost)} · Planlanan kapasite: ${storyRegionFormatNumber(req.capacity)}</div>`
        + cityButton;
}
function storyRegionOwnershipHtml(company) {
    if (!company) return '<span>Mülkiyet kaydı doğrulanmadı</span>';
    const rows = (company.owners || []).map(owner => {
        const label = STORY_REGION_OWNER_LABELS[owner.ownerType] || owner.ownerType || 'BİLİNMEYEN PAY';
        const percent = Math.round(Number(owner.shareBps) || 0) / 100;
        return `<span><b>${storyProjectionEscape(label)}</b><em>%${percent.toLocaleString('tr-TR')}</em></span>`;
    }).join('');
    return `<strong>${storyProjectionEscape(company.name || company.id)}</strong>${rows || '<span>Ortaklık payı yayımlanmadı</span>'}`;
}
function storyRegionPopulation(selected) {
    const regionId = `region:${selected.id}`;
    const population = typeof storyPopulationRegionView === 'function' ? storyPopulationRegionView(regionId) : null;
    const labor = typeof storyPopulationLaborSupply === 'function' ? storyPopulationLaborSupply(regionId, 1) : null;
    return {
        people: population ? storyRegionFormatNumber(population.populationPeople) : 'KAYIT YOK',
        workers: labor && labor.status !== 'UNAVAILABLE' ? storyRegionFormatNumber(labor.availableWorkersPeople) : 'KAYIT YOK'
    };
}
function storyRegionLocalOffice(selected) {
    const view = typeof storyInstitutionRegionView === 'function' ? storyInstitutionRegionView(`region:${selected.id}`) : null;
    const holder = view && view.institution && view.institution.officeHolder;
    return holder ? { name: holder.name,
        provisional: holder.actorType === 'COLLECTIVE_OFFICE' || /PRE_PHASE/.test(String(holder.model || '')) } : null;
}
function storyRegionPortTruth(selected) {
    if (!selected || typeof storyHexSettlementsEnsure !== 'function') return null;
    try {
        const model = storyHexSettlementsEnsure();
        const record = model && model.records && model.records[Number(selected.id)];
        if (!record || !record.requiredPort) return null;
        if (!record.port) {
            return {
                status: 'UNAVAILABLE',
                code: 'REQUIRED_PORT_UNRESOLVED',
                message: 'Zorunlu liman için geçerli fiziksel kıyı terminali bulunamadı.'
            };
        }
        const fallback = record.port.fallbackCode === 'LEGACY_GEOMETRY_FALLBACK';
        const hostRegionId = Number(record.port.hostRegionId);
        const host = (STORY.nodes || [])[hostRegionId];
        return {
            status: fallback ? 'FALLBACK' : 'DIRECT',
            code: record.port.fallbackCode || null,
            terminalId: record.port.terminalId,
            hostRegionId,
            hostRegionName: String(host && host.name || hostRegionId),
            distance: Math.max(0, Number(record.port.distance) || 0),
            message: fallback
                ? 'Kaynak kıyı geometrisi yetersiz olduğu için şehir, komşu bölgedeki fiziksel terminalden hizmet alıyor.'
                : 'Şehir kendi bölgesindeki fiziksel kıyı terminaline bağlı.'
        };
    } catch (_) {
        return null;
    }
}
const STORY_REGION_LOGISTICS_MODE_LABELS = Object.freeze({
    AUTO: 'EN UYGUN ROTAYI SEÇ', LAND: 'TIR KONVOYU', RAIL: 'YÜK TRENİ', SEA: 'KARGO GEMİSİ'
});
const STORY_REGION_LOGISTICS_STATE_LABELS = Object.freeze({
    QUEUED: 'TERMİNAL SIRASINDA', LOADING: 'YÜKLENİYOR', MOVING: 'YOLDA',
    WAITING: 'ENGELDE BEKLİYOR', TRANSFERRING: 'AKTARILIYOR',
    UNLOADING: 'BOŞALTILIYOR', DELIVERED: 'TESLİM EDİLDİ', LOST: 'KAYBEDİLDİ'
});
const STORY_REGION_LOGISTICS_HOLD_LABELS = Object.freeze({
    MARITIME_BLOCKADE: 'ABLUKADA BEKLİYOR',
    MARITIME_WEATHER_CLOSED: 'HAVA NEDENİYLE BEKLİYOR',
    PHYSICAL_SEGMENT_MISSING: 'FİZİKSEL HAT KAYIP',
    CORRIDOR_MISSING: 'KORİDOR KAYIP',
    TRANSIT_ACCESS_DENIED: 'GEÇİŞ İZNİ YOK',
    PHYSICAL_SEGMENT_BLOCKED: 'HAT HASARLI'
});
function storyRegionLogisticsResourceLabel(resourceId) {
    const definition = typeof STORY_RESOURCE_DEFINITIONS !== 'undefined'
        ? STORY_RESOURCE_DEFINITIONS.find(row => row.id === String(resourceId)) : null;
    return definition ? definition.label : String(resourceId || '').toLocaleUpperCase('tr-TR');
}
function storyRegionLogisticsDraft(selected) {
    const sourceRegionId = `region:${selected.id}`;
    let draft = STORY._regionLogisticsDraft;
    if (!draft || draft.sourceRegionId !== sourceRegionId) {
        const targets = (STORY.nodes || []).filter(node => node && node.id !== selected.id
            && Number(node.owner) === Number(selected.owner));
        const regional = typeof storyRegionalRegionView === 'function'
            ? storyRegionalRegionView(sourceRegionId) : null;
        const resources = typeof STORY_TRADE_TRANSPORTABLE !== 'undefined'
            ? STORY_TRADE_TRANSPORTABLE.slice() : [];
        resources.sort((a, b) => Number(regional && regional.stocks[b] || 0)
            - Number(regional && regional.stocks[a] || 0));
        draft = STORY._regionLogisticsDraft = {
            sourceRegionId, targetRegionId: targets[0] ? `region:${targets[0].id}` : '',
            resourceId: resources[0] || '', quantity: '1', transportMode: 'AUTO', feedback: ''
        };
    }
    return draft;
}
function storyRegionLogisticsShipmentEta(shipment) {
    const agent = shipment && shipment.transportAgent;
    const steps = shipment && shipment.physicalRoute && shipment.physicalRoute.steps || [];
    if (!agent || !steps.length) return Math.max(0, Number(shipment && shipment.legRemainingSeconds) || 0);
    let seconds = Math.max(0, Number(agent.phaseRemainingSeconds) || 0);
    const index = Math.max(0, Math.min(steps.length, Number(agent.stepIndex) || 0));
    for (let i = index; i < steps.length; i++) {
        const duration = Math.max(0, Number(steps[i].plannedDurationSeconds) || 0);
        seconds += i === index ? duration * (1 - Math.max(0, Math.min(1,
            Number(agent.stepProgressBps || 0) / 10000))) : duration;
    }
    if (index < steps.length) seconds += 0.5;
    return seconds;
}
function storyRegionLogisticsProgress(shipment) {
    const agent = shipment && shipment.transportAgent;
    const count = shipment && shipment.physicalRoute && shipment.physicalRoute.steps
        ? shipment.physicalRoute.steps.length : 0;
    if (!agent || !count) return 0;
    if (agent.state === 'UNLOADING' || agent.state === 'DELIVERED') return 100;
    return Math.max(0, Math.min(100, ((Number(agent.stepIndex) || 0)
        + Number(agent.stepProgressBps || 0) / 10000) / count * 100));
}
function storyRegionLogisticsPreview(selected, draft) {
    if (!draft.targetRegionId || !draft.resourceId
        || typeof storyRoutePlannerPlan !== 'function') return null;
    const modes = draft.transportMode === 'AUTO'
        ? (typeof storyTradePhysicalModes === 'function'
            ? storyTradePhysicalModes(draft.resourceId) : ['LAND'])
        : [draft.transportMode];
    return storyRoutePlannerPlan(draft.sourceRegionId, draft.targetRegionId, {
        modes: modes.filter(mode => ['LAND', 'RAIL', 'SEA'].includes(mode)),
        authorizedCountryIds: [`country:${selected.owner}`],
        minCapacity: Math.max(0, Number(draft.quantity) || 0),
        transferCost: typeof STORY_TRADE_TRANSFER_COST === 'number'
            ? STORY_TRADE_TRANSFER_COST : 0.1,
        transferLatencySeconds: typeof STORY_TRADE_TRANSFER_LATENCY_SECONDS === 'number'
            ? STORY_TRADE_TRANSFER_LATENCY_SECONDS : 2,
        knowledgeMode: 'TRUTH', useCache: true
    });
}
function storyRegionLogisticsHtml(selected) {
    const me = typeof storyPlayerState === 'function' ? storyPlayerState() : null;
    if (!me || Number(selected.owner) !== Number(me.id)
        || typeof storyTradeRegionView !== 'function'
        || typeof storyRegionalRegionView !== 'function') return '';
    const esc = storyProjectionEscape;
    const draft = storyRegionLogisticsDraft(selected);
    const regional = storyRegionalRegionView(draft.sourceRegionId);
    const trade = storyTradeRegionView(draft.sourceRegionId) || { incoming: [], outgoing: [] };
    const targets = (STORY.nodes || []).filter(node => node && node.id !== selected.id
        && Number(node.owner) === Number(me.id));
    const resources = typeof STORY_TRADE_TRANSPORTABLE !== 'undefined'
        ? STORY_TRADE_TRANSPORTABLE : [];
    const modes = typeof storyTradePhysicalModes === 'function'
        ? storyTradePhysicalModes(draft.resourceId) : ['LAND'];
    if (draft.transportMode !== 'AUTO' && !modes.includes(draft.transportMode)) draft.transportMode = 'AUTO';
    const stock = Math.max(0, Number(regional && regional.stocks[draft.resourceId]) || 0);
    const preview = storyRegionLogisticsPreview(selected, draft);
    const targetOptions = targets.map(node => `<option value="region:${node.id}"${draft.targetRegionId === `region:${node.id}` ? ' selected' : ''}>${esc(node.name)}</option>`).join('');
    const resourceOptions = resources.map(id => `<option value="${esc(id)}"${draft.resourceId === id ? ' selected' : ''}>${esc(storyRegionLogisticsResourceLabel(id))} · ${storyRegionFormatNumber(regional && regional.stocks[id] || 0)}</option>`).join('');
    const modeOptions = ['AUTO'].concat(modes).map(id => `<option value="${id}"${draft.transportMode === id ? ' selected' : ''}>${esc(STORY_REGION_LOGISTICS_MODE_LABELS[id] || id)}</option>`).join('');
    const shipments = trade.outgoing.concat(trade.incoming).slice(0, 8);
    const shipmentHtml = shipments.length ? shipments.map(shipment => {
        const outgoing = shipment.sourceRegionId === draft.sourceRegionId;
        const otherId = outgoing ? shipment.targetRegionId : shipment.sourceRegionId;
        const other = typeof storyTradeNode === 'function' ? storyTradeNode(otherId) : null;
        const agent = shipment.transportAgent || {};
        const stateBase = STORY_REGION_LOGISTICS_HOLD_LABELS[shipment.holdReason]
            || STORY_REGION_LOGISTICS_STATE_LABELS[agent.state]
            || (shipment.status === 'HELD' ? 'SEVKİYAT DURDU' : shipment.status);
        const state = agent.state === 'QUEUED' && Number(agent.terminalQueuePosition) > 0
            ? `${stateBase} · ${Number(agent.terminalQueuePosition)}. SIRA` : stateBase;
        const mode = STORY_REGION_LOGISTICS_MODE_LABELS[agent.mode || shipment.mode]
            || agent.vehicleClass || shipment.mode;
        const eta = storyRegionLogisticsShipmentEta(shipment);
        const progress = storyRegionLogisticsProgress(shipment);
        return `<div class="story-shipment-row${shipment.status === 'HELD' ? ' held' : ''}"><div><small>${outgoing ? 'GİDEN' : 'GELEN'} · ${esc(mode)}</small><b>${esc(storyRegionLogisticsResourceLabel(shipment.resourceId))} · ${storyRegionFormatNumber(shipment.quantity)}</b><span>${esc(selected.name)} ${outgoing ? '→' : '←'} ${esc(other && other.name || otherId)}</span></div><em>${esc(state)}<small>%${Math.round(progress)} · ${eta > 0 ? `~${eta.toFixed(1)} sn` : 'VARIŞ'}</small></em></div>`;
    }).join('') : '<div class="story-logistics-empty">Bu şehirde hareket hâlinde fiziksel sevkiyat yok.</div>';
    const maritimeWarnings = preview && preview.ok && typeof storyMaritimeConditionForCorridor === 'function'
        ? (preview.corridorIds || []).map(id => storyMaritimeConditionForCorridor(id))
            .filter(Boolean).map(row => row.blockaded ? 'ABLUKA'
                : Number(row.weatherFactorBps) < 10000
                    ? `DENİZ HIZI %${Math.round(Number(row.weatherFactorBps) / 100)}` : null)
            .filter(Boolean) : [];
    const previewHtml = preview && preview.ok
        ? `<div class="story-logistics-preview"><span>PLAN <b>${preview.modes.map(mode => STORY_REGION_LOGISTICS_MODE_LABELS[mode] || mode).join(' → ')}</b></span><span>ETA <b>${Number(preview.totalLatencySeconds || 0).toFixed(1)} sn</b></span><span>MALİYET <b>${Number(preview.totalCost || 0).toFixed(2)}</b></span><span>DARBOĞAZ <b>${storyRegionFormatNumber(preview.bottleneckCapacity)}</b></span><span>GÜVENİLİRLİK <b>%${Math.round(Number(preview.reliabilityBps || 0) / 100)}</b></span><span>AKTARMA <b>${(preview.transferRegionIds || []).length}</b></span>${maritimeWarnings.length ? `<span>DENİZ UYARISI <b>${esc(maritimeWarnings.join(' · '))}</b></span>` : ''}</div>`
        : `<div class="story-logistics-preview unavailable">ROTA ÖNİZLEMESİ: ${esc(preview && preview.reason || 'SEÇİM BEKLİYOR')}</div>`;
    return `<section class="story-logistics-box"><div class="story-logistics-title"><b>ŞEHİR LOJİSTİĞİ</b><span>${trade.outgoing.length} giden · ${trade.incoming.length} gelen</span></div><div class="story-logistics-stock">SEÇİLİ STOK <b>${storyRegionFormatNumber(stock)} · ${esc(storyRegionLogisticsResourceLabel(draft.resourceId))}</b></div><div class="story-logistics-form"><label>HEDEF ŞEHİR<select class="story-logistics-control" data-story-logistics-field="targetRegionId" id="story-logistics-target">${targetOptions}</select></label><label>YÜK<select class="story-logistics-control" data-story-logistics-field="resourceId" id="story-logistics-resource">${resourceOptions}</select></label><label>MİKTAR<input class="story-logistics-control" data-story-logistics-field="quantity" id="story-logistics-quantity" type="number" min="0.001" step="1" value="${esc(draft.quantity)}"></label><label>TAŞIMA<select class="story-logistics-control" data-story-logistics-field="transportMode" id="story-logistics-mode">${modeOptions}</select></label></div>${previewHtml}<button class="story-context-action story-logistics-dispatch" data-story-logistics-dispatch="1"${!targetOptions || !resources.length || !(preview && preview.ok) ? ' disabled' : ''}>SİPARİŞİ OLUŞTUR VE SEVK ET</button>${draft.feedback ? `<div class="story-logistics-feedback${draft.feedbackOk ? ' ok' : ' bad'}">${esc(draft.feedback)}</div>` : ''}<div class="story-shipment-list">${shipmentHtml}</div></section>`;
}
function storyRegionLogisticsDispatch() {
    const draft = STORY._regionLogisticsDraft;
    if (!draft || typeof storyTradeCreateOrder !== 'function'
        || typeof storyTradeDispatchOrder !== 'function') return { ok: false, code: 'LOGISTICS_API_MISSING' };
    const quantity = Math.max(0, Number(draft.quantity) || 0);
    const created = storyTradeCreateOrder({ sourceRegionId: draft.sourceRegionId,
        targetRegionId: draft.targetRegionId, resourceId: draft.resourceId, quantity,
        transportMode: draft.transportMode === 'AUTO' ? null : draft.transportMode,
        priority: 100, source: 'PLAYER_REGION_LOGISTICS_UI', exportReserveBps: 0 });
    if (!created.ok) return created;
    const dispatched = storyTradeDispatchOrder(created.order, quantity);
    if (!dispatched.ok) {
        created.order.status = 'CANCELLED';
        created.order.updatedAt = Number(STORY.clock) || 0;
        created.order.lastFailure = dispatched.code || 'DISPATCH_FAILED';
    }
    return dispatched.ok ? Object.assign({ order: created.order }, dispatched) : dispatched;
}
function storyRegionContextHtml(selected, selection, owner, basics) {
    const esc = storyProjectionEscape;
    const pop = storyRegionPopulation(selected);
    const office = storyRegionLocalOffice(selected);
    const portTruth = storyRegionPortTruth(selected);
    const portTruthHtml = !portTruth ? ''
        : portTruth.status === 'FALLBACK'
            ? `<div class=\"story-context-warning\"><b>KAYNAK COĞRAFYA UYARISI</b><br>${esc(portTruth.message)}<br>FİZİKSEL TERMİNAL: ${esc(portTruth.hostRegionName)} · #${esc(portTruth.terminalId)} · ${portTruth.distance.toFixed(1)} dünya birimi</div>`
            : portTruth.status === 'UNAVAILABLE'
                ? `<div class=\"story-context-warning\"><b>LİMAN BAĞLANTISI YOK</b><br>${esc(portTruth.message)}</div>`
                : `<div class=\"story-brief-note\">FİZİKSEL LİMAN: ${esc(portTruth.hostRegionName)} · TERMİNAL #${esc(portTruth.terminalId)}</div>`;
    const cityButton = `<button class=\"story-context-action\" data-story-enter-city=\"${selected.id}\">ŞEHRE GİR · ${esc(selected.name)}</button>`;
    if (selection && selection.kind === 'HEX') {
        const coverLabel = STORY_REGION_COVER_LABELS[selection.cover] || selection.cover;
        const resourceLabel = STORY_REGION_RESOURCE_LABELS[selection.resource] || selection.resource;
        const extraction = selection.deposit
            ? (typeof storyHexSitesEnsure === 'function'
                ? (storyHexSitesEnsure().sites || []).find(site => Number(site.cellIndex) === Number(selection.cellIndex)
                    && String(site.siteType) === 'EXTRACTION') : null)
            : null;
        const company = extraction && typeof storyCompanyById === 'function'
            ? storyCompanyById(extraction.ownerCompanyId) : null;
        const actionOptions = selection.administrativeAssigned
            && typeof storyHexLandManagementOptions === 'function'
            ? storyHexLandManagementOptions(selection) : [];
        const actionButtons = actionOptions.length
            ? `<div class=\"story-brief-note\"><b>ARAZİ YÖNETİMİ</b><br>${actionOptions.map(action =>
                `<button class=\"story-context-action\" data-story-hex-action=\"${esc(action.actionType)}\">${esc(action.label)}</button>`).join('')}</div>` : '';
        const managementRows = (selection.managementRecords || []).length
            ? `<div class=\"story-brief-note\"><b>AÇIK ARAZİ KAYITLARI</b><br>${selection.managementRecords.map(record =>
                `${esc(STORY_HEX_LAND_ACTIONS[record.actionType] && STORY_HEX_LAND_ACTIONS[record.actionType].label || record.actionType)} · ${esc(record.status)}`).join('<br>')}</div>` : '';
        const administrativeLabel = selection.administrativeAssigned
            ? `BAĞLI ŞEHİR: ${esc(selected.name)}`
            : `İDARİ BAĞ: YOK · EN YAKIN ŞEHİR: ${esc(selected.name)}`;
        const nearestCityButton = selection.administrativeAssigned ? cityButton
            : `<button class=\"story-context-action\" data-story-enter-city=\"${selected.id}\">EN YAKIN ŞEHİR DOSYASI · ${esc(selected.name)}</button>`;
        return `<div class=\"story-node-heading\"><b>${selection.administrativeAssigned ? `${esc(selected.name)} · ` : ''}${esc(coverLabel)}</b><span class=\"story-node-state\">${selection.administrativeAssigned ? 'ALTIGEN' : 'BAĞIMSIZ ALTIGEN'}</span></div>`
            + `<div class=\"story-context-parent\">${esc(selection.cellId)} · q${esc(selection.q)} / r${esc(selection.r)}</div>`
            + `<div class=\"story-brief-grid\"><div class=\"story-brief-cell\">ARAZİ ÖRTÜSÜ<b>${esc(coverLabel)}</b></div>`
            + `<div class=\"story-brief-cell\">DOĞAL KAYNAK<b>${esc(resourceLabel)}</b></div>`
            + `<div class=\"story-brief-cell\">TARIM UYGUNLUĞU<b>%${Math.round(selection.arableSuitabilityBps / 100)}</b></div>`
            + `<div class=\"story-brief-cell\">ORMANCILIK UYGUNLUĞU<b>%${Math.round(selection.forestrySuitabilityBps / 100)}</b></div></div>`
            + `<div class=\"story-brief-note\"><b>İDARİ VE FİZİKSEL BAĞ</b><br>${administrativeLabel}</div>`
            + (selection.deposit ? `<div class=\"story-brief-note\"><b>YATAK KAYDI</b><br>${esc(resourceLabel)} · ${extraction ? `faal çıkarım kapasitesi ${storyRegionFormatNumber(extraction.capacity)}` : 'çıkarım tesisi yok'}<br>${selection.administrativeAssigned ? 'Bağlı şehir' : 'En yakın şehir'}: ${esc(selected.name)}${company ? `<br>Sahip: ${esc(company.name)}` : ''}<br>Rezerv miktarı: henüz kanonik jeolojik ölçüm yok; sayı uydurulmadı.</div>` : '')
            + actionButtons + managementRows + nearestCityButton;
    }
    if (selection && selection.kind === 'SITE') {
        const site = selection.site;
        const constructionHtml = storyRegionConstructionHtml(site, selected, cityButton);
        if (constructionHtml) return constructionHtml;
        const company = typeof storyCompanyById === 'function' ? storyCompanyById(site.ownerCompanyId) : null;
        const operator = typeof storyCompanyById === 'function' ? storyCompanyById(site.operatorCompanyId) : null;
        const type = STORY_REGION_SITE_LABELS[site.siteType] || STORY_REGION_USE_LABELS[site.siteType] || site.siteType;
        return `<div class=\"story-node-heading\"><b>${esc(company && company.name || type)}</b><span class=\"story-node-state\">TESİS</span></div>`
            + `<div class=\"story-context-parent\">${esc(selected.name)} idarî bölgesine bağlı · ${esc(selection.cellId)}</div>`
            + `<div class=\"story-brief-grid\"><div class=\"story-brief-cell\">TESİS TÜRÜ<b>${esc(type)}</b></div>`
            + `<div class=\"story-brief-cell\">İŞLETEN<b>${esc(operator && operator.name || 'DOĞRULANMADI')}</b></div>`
            + `<div class=\"story-brief-cell\">KAPASİTE<b>${storyRegionFormatNumber(site.capacity)}</b></div>`
            + `<div class=\"story-brief-cell\">DURUM<b>${esc(site.operatingStatus || site.lifecycleState || 'KAYIT YOK')}</b></div></div>`
            + `<div class=\"story-ownership\"><small>MÜLKİYET DAĞILIMI</small>${storyRegionOwnershipHtml(company)}</div>`
            + `<div class=\"story-brief-note\">BÖLGE NÜFUSU: ${pop.people}<br>BÖLGEDE KULLANILABİLİR İŞGÜCÜ: ${pop.workers}</div>${cityButton}`;
    }
    if (selection && selection.kind === 'DISTRICT') {
        const land = selection.land;
        const use = STORY_REGION_USE_LABELS[land.activeUse] || land.activeUse || 'İLÇE';
        const sites = (land.siteIds || []).map(id => {
            try { return storyHexSitesEnsure().siteById[id]; } catch (_) { return null; }
        }).filter(Boolean);
        const owners = sites.map(site => typeof storyCompanyById === 'function' ? storyCompanyById(site.ownerCompanyId) : null).filter(Boolean);
        return `<div class=\"story-node-heading\"><b>${esc(selected.name)} · ${esc(use)}</b><span class=\"story-node-state\">İLÇE</span></div>`
            + `<div class=\"story-context-parent\">Fiziksel altıgen: ${esc(selection.cellId)}</div>`
            + `<div class=\"story-brief-grid\"><div class=\"story-brief-cell\">ARAZİ KULLANIMI<b>${esc(use)}</b></div>`
            + `<div class=\"story-brief-cell\">YAPI / TESİS<b>${sites.length}</b></div>`
            + `<div class=\"story-brief-cell\">ŞEHİR NÜFUSU<b>${pop.people}</b></div>`
            + `<div class=\"story-brief-cell\">BÖLGE İŞGÜCÜ<b>${pop.workers}</b></div></div>`
            + (owners.length ? `<div class=\"story-ownership\"><small>BU ALTIGENDEKİ SAHİPLER</small>${owners.map(storyRegionOwnershipHtml).join('')}</div>`
                : '<div class=\"story-brief-note\">Bu ilçede kayıtlı özel/kamusal yapı sahibi yok. İlçe nüfusu henüz altıgen bazında muhasebeleştirilmedi.</div>')
            + cityButton;
    }
    return `<div class=\"story-node-heading\"><b>${esc(selected.name)}</b><span class=\"story-node-state\" style=\"color:${basics.stateColor}\">${basics.stateText}</span></div>`
        + `<div class=\"story-brief-grid\"><div class=\"story-brief-cell\">TÜR<b>${esc(basics.type)}</b></div>`
        + `<div class=\"story-brief-cell\">KONTROL<b style=\"color:${owner && owner.color || '#ffe9bf'}\">${esc(owner && owner.name || '-')}</b></div>`
        + `<div class=\"story-brief-cell\">NÜFUS<b>${pop.people}</b></div><div class=\"story-brief-cell\">KULLANILABİLİR İŞGÜCÜ<b>${pop.workers}</b></div>`
        + `<div class=\"story-brief-cell\">BELEDİYE / YEREL MAKAM<b>${esc(office ? office.name : 'ATANMADI')}</b></div>`
        + `<div class=\"story-brief-cell\">GARNİZON<b>${esc(basics.force)}</b></div></div>`
        + (office && office.provisional ? '<div class=\"story-context-warning\">Geçici kolektif yerel makam; kişisel belediye başkanı karakter fazında bağlanacak.</div>' : '')
        + `<div class=\"story-brief-note\">${esc(basics.rewardLabel)}: ${esc(basics.reward)}<br>ORDU DOKTRİNİ: ${esc(basics.doctrine)}<br>SAVAŞ HARİTASI: ${esc(basics.mapName)}</div>${portTruthHtml}${cityButton}${storyRegionLogisticsHtml(selected)}`;
}
function storyRegionNearestNodeForCell(cell) {
    if (!cell) return null;
    const key = String(cell.id || cell.index);
    const cache = STORY._hexNearestRegionCache instanceof Map
        ? STORY._hexNearestRegionCache : (STORY._hexNearestRegionCache = new Map());
    if (cache.has(key)) return cache.get(key);
    const world = storyHexWorldEnsure();
    const wx = Number(cell.center && cell.center.x) / Math.max(1, Number(world.width)) * STORY_WORLD_W;
    const wy = Number(cell.center && cell.center.y) / Math.max(1, Number(world.height)) * STORY_WORLD_H;

    if (!STORY._cachedSettlementNodePositions || STORY._cachedSettlementNodePositions.length !== (STORY.nodes || []).length) {
        STORY._cachedSettlementNodePositions = (STORY.nodes || []).map(node => {
            if (!node) return null;
            const pos = typeof storyHexSettlementNodePosition === 'function'
                ? storyHexSettlementNodePosition(node, STORY_WORLD_W, STORY_WORLD_H)
                : { x: Number(node.lx) * STORY_WORLD_W, y: Number(node.ly) * STORY_WORLD_H };
            return { id: Number(node.id), x: pos.x, y: pos.y };
        }).filter(Boolean);
    }
    let nearest = null;
    let distance = Infinity;
    for (let i = 0; i < STORY._cachedSettlementNodePositions.length; i++) {
        const node = STORY._cachedSettlementNodePositions[i];
        const dx = node.x - wx;
        const dy = node.y - wy;
        const candidateDistance = dx * dx + dy * dy;
        if (candidateDistance < distance) {
            nearest = node.id;
            distance = candidateDistance;
        }
    }
    cache.set(key, nearest);
    return nearest;
}
function storyRegionEntityAtWorld(x, y, precalculatedCell) {
    if (typeof storyHexPoliticalCellAtWorld !== 'function' || typeof storyHexSitesEnsure !== 'function') return null;
    try {
        const cell = precalculatedCell || storyHexPoliticalCellAtWorld(x, y, STORY_WORLD_W, STORY_WORLD_H);
        if (!cell) return null;
        const model = storyHexSitesEnsure();
        const land = model.landUseByCellId[String(cell.id)] || null;
        if (!land) {
            const nodeId = cell.assigned ? Number(cell.regionId)
                : storyRegionNearestNodeForCell(cell);
            return { kind: 'HEX', cellId: cell.id,
                cellIndex: cell.index,
                regionId: cell.assigned ? `region:${cell.regionId}` : null,
                nodeId, assigned: !!cell.assigned };
        }
        const siteId = (model.siteIdsByCellId[String(cell.id)] || [])[0] || null;
        return { kind: siteId ? 'SITE' : 'DISTRICT', cellId: cell.id,
            siteId, regionId: land.regionId, nodeId: storyRegionNumber(land.regionId) };
    } catch (_) { return null; }
}
function storyRegionEntityAtCanvasPoint(x, y) {
    const targets = Array.isArray(STORY._mapStructurePickTargets)
        ? STORY._mapStructurePickTargets : [];
    for (let index = targets.length - 1; index >= 0; index--) {
        const target = targets[index];
        if (!target || target.hidden) continue;
        const rx = Math.max(8, Number(target.radiusX) || Number(target.radius) || 8);
        const ry = Math.max(8, Number(target.radiusY) || Number(target.radius) || 8);
        const dx = (Number(x) - Number(target.x)) / rx;
        const dy = (Number(y) - Number(target.y)) / ry;
        if (dx * dx + dy * dy > 1) continue;
        return {
            kind: target.kind,
            cellId: target.cellId || null,
            cellIndex: Number.isInteger(target.cellIndex) ? target.cellIndex : null,
            siteId: target.siteId || null,
            districtId: target.districtId || null,
            structureId: target.id || null,
            structureLabel: target.label || null,
            regionId: target.regionId || null,
            nodeId: Number(target.nodeId)
        };
    }
    return null;
}
function storyRegionCanvasPointFromEvent(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (event.clientX - rect.left) * (canvas.width / Math.max(1, rect.width)),
        y: (event.clientY - rect.top) * (canvas.height / Math.max(1, rect.height))
    };
}
function storySelectRegionEntityAtCanvasPoint(x, y) {
    const entity = storyRegionEntityAtCanvasPoint(x, y);
    if (!entity || !Number.isInteger(entity.nodeId) || !storyNode(entity.nodeId)) return false;
    storySelectNode(entity.nodeId, entity);
    return true;
}
function storySelectRegionEntityAtWorld(x, y) {
    const entity = storyRegionEntityAtWorld(x, y);
    if (!entity || !Number.isInteger(entity.nodeId) || !storyNode(entity.nodeId)) return false;
    storySelectNode(entity.nodeId, entity);
    return true;
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
            ((typeof storyCalendarNow === 'function') ? (() => {
                const season = storySeasonForUi();
                const detail = storyProjectionEscape(storySeasonTooltip());
                return `<div class="story-stat-chip t2 wide world-state detail-hover" tabindex="0" data-story-tooltip="${detail}" aria-label="${storyProjectionEscape(`${season.name} mevsimi. Mevsim ayrıntıları için odaklan.`)}">MEVSİM<b style="color:${season.color}">${season.name}</b></div>`;
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
        const force = hostile ? `${selected.garrison || 0} / ~${foeTotal}` : String(selected && selected.garrison || 0);
        const selection = storyRegionSelectionResolve(selected);
        const contextInfoHtml = selected ? storyRegionContextHtml(selected, selection, owner, {
            type, stateText, stateColor, mapName, doctrine, reward, rewardLabel, forceLabel, force
        }) : '<div class=\"story-brief-note\">Haritada bir şehir seçerek harekât brifingini aç.</div>';
        const legacyInfoHtml = selected ?
            `<div class="story-node-heading"><b>${selected.name}</b><span class="story-node-state" style="color:${stateColor}">${stateText}</span></div>` +
            `<div class="story-brief-grid">` +
                `<div class="story-brief-cell">TÜR<b>${type}</b></div>` +
                `<div class="story-brief-cell">KONTROL<b style="color:${owner?.color || '#ffe9bf'}">${owner?.name || '-'}</b></div>` +
                `<div class="story-brief-cell">SAVAŞ HARİTASI<b>${mapName}</b></div>` +
                `<div class="story-brief-cell">${forceLabel}<b>${hostile ? `${selected.garrison || 0} / ~${foeTotal}` : (selected.garrison || 0)}</b></div>` +
            `</div><div class="story-brief-note">${rewardLabel}: ${reward}<br>ORDU DOKTRİNİ: ${doctrine}</div>` :
            `<div class="story-brief-note">Haritada bir şehir seçerek harekât brifingini aç.</div>`;
        const logisticsFocused = document.activeElement && info.contains(document.activeElement)
            && document.activeElement.classList.contains('story-logistics-control');
        if (!logisticsFocused) storyUiSetHtml(info, contextInfoHtml);

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
    storyPauseFlagUpdate();
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
    storyCouncilClose(); storyTechClose(); storyCityClose(); storyEconomyClose();
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
    const key = `${STORY.playerStateId}|${sequence}`;
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
    const sequence = STORY.causality ? Number(STORY.causality.nextSequence) || 0 : 0;
    if (STORY._lastBadgeSequence === sequence && badge.dataset.sequence === String(sequence)) return;
    const projection = storyChangesProjection();
    const count = projection && !projection.disabled ? Math.max(0, Number(projection.badgeCount) || 0) : 0;
    badge.textContent = count > 99 ? '99+' : String(count || '');
    badge.classList.toggle('hidden', count === 0);
    badge.title = count ? `Son ${projection.recentSeconds || 60} saniyede ${count} görünür değişim` : '';
    STORY._lastBadgeSequence = sequence;
    badge.dataset.sequence = String(sequence);
}

function storyChangesOpen() {
    storyCouncilClose(); storyTechClose(); storyArmyClose(); storyCityClose();
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
    const count = obj => { let n = 0; for (const k in (obj || {})) n += obj[k] | 0; return n; };
    const others = storyPlayerCommanders().filter(x => !x.isPlayer);
    const busy = STORY.nodes.filter(n => n.owner === me.id && (n.q || []).length);
    const vets = STORY.veterans || [];
    const myArmyStr = Object.entries(c.army || {}).map(([k, v]) => `${k}:${v}`).join(',');
    const fp = `${c.id}:${c.node}:${Math.round(c.loyalty || 100)}|${myArmyStr}|`
        + others.map(x => `${x.id}:${x.node}:${count(x.army)}`).join(',') + '|'
        + busy.map(n => `${n.id}:${n.q.length}:${Math.ceil(Math.min(...n.q.map(j => j.t)))}`).join(',') + '|'
        + vets.length;

    if (STORY._armyLastFp === fp) return;
    STORY._armyLastFp = fp;

    const label = t => (typeof STATS !== 'undefined' && STATS[t] && STATS[t].name) ? STATS[t].name : t;
    const rows = obj => Object.keys(obj || {}).filter(k => (obj[k] | 0) > 0)
        .sort((a, b) => ((STATS[+b] && STATS[+b].cost) || 0) - ((STATS[+a] && STATS[+a].cost) || 0))
        .map(k => `<div class="army-row"><span>${label(+k)}</span><span class="army-ct">×${obj[k] | 0}</span></div>`).join('');

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
            let p = storyTechPriority(st, t, needs);
            if (st.playerTechPriority === t.id) p += 100000;
            if (p > bestScore) { bestScore = p; best = t; bestCost = s.cost; }
        }
        if (best) {
            st.techPoints -= bestCost;
            st.tech.push(best.id);
            if (st.playerTechPriority === best.id) st.playerTechPriority = null;
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
    const position = typeof storyHexSettlementNodePosition === 'function'
        ? storyHexSettlementNodePosition(node, STORY_WORLD_W, STORY_WORLD_H)
        : { x: node.lx * STORY_WORLD_W, y: node.ly * STORY_WORLD_H };
    if (typeof storyMapV2Enabled === 'function' && storyMapV2Enabled()) {
        STORY._cw = cv.width; STORY._ch = cv.height;
        storyMapV2CenterCamera(storyCam, position.x, position.y, cv.width, cv.height);
        storyClampCam(cv.width, cv.height);
        return;
    }
    STORY._cw = cv.width; STORY._ch = cv.height;                     // WARP: düğüm ekran ortasına
    storyCam.x = position.x - (cv.width / 2) / storyCam.zoom;
    storyCam.y = position.y - storyVyOf(0.5) / storyCam.zoom;
    storyClampCam(cv.width, cv.height);
}
function storyCouncilUpdate() {
    if (!STORY._councilOpen) return;
    const me = storyPlayerState(); if (!me) return;
    const isAdmin = !!(me.gov && me.gov.leader === 'player');
    const cmds = storyPlayerCommanders();
    const fp = `${isAdmin}|${Math.round(me.welfare)}|${me.reputation}|${Math.floor(me.res.oil)}|${Math.floor(me.res.manpower)}|${Math.floor(me.res.points)}|${STORY._dismissMode}|`
        + cmds.map(c => `${c.id}:${c.node}:${Math.round(c.loyalty || 0)}`).join(',');
    if (STORY._councilLastFp !== fp) {
        STORY._councilLastFp = fp;
        const banner = document.getElementById('council-admin-banner');
        const bannerHtml =
            `<div class="story-res">🏛️ Cumhurbaşkanı: <b style="color:${isAdmin ? '#4cff7c' : '#ffd24c'}">${isAdmin ? (STORY.commander ? STORY.commander.name + ' (SEN)' : 'SEN') : ((typeof storyPresidentName === 'function') ? storyPresidentName(me) : 'AI')}</b></div>`
            + storyBar('Refah', me.welfare, '#54e08a')
            + `<div class="story-res">🏅 İtibar <b>${me.reputation}/6</b>${isAdmin ? '' : (me.reputation >= 6 && me.welfare >= 60 ? ' <span style="color:#4cff7c">— seçime hazırsın!</span>' : ` <span style="color:#9fb3c8">(seçim: itibar≥6 + refah≥60)</span>`)}</div>`
            + (isAdmin ? `<div class="story-res" style="color:#4cff7c;font-size:12px">🎖️ Komutan yaratabilir/dağıtabilirsin.</div>` : `<div class="story-res" style="color:#9fb3c8;font-size:12px">🔒 Yönetici olunca komutanları yönetirsin.</div>`);
        storyUiSetHtml(banner, bannerHtml);
        const inc = STORY._incPerCmd || { oil: 0, manpower: 0, points: 0 };
        const tre = document.getElementById('council-treasury');
        const treasuryHtml = `<b>DEVLET HAZİNESİ</b>`
            + `<br><span style="color:#dfe7ef">PETROL ${Math.floor(me.res.oil)} · İNSAN ${Math.floor(me.res.manpower)} · PUAN ${Math.floor(me.res.points)}</span>`
            + `<br><span style="color:#9fb3c8;font-size:12px">${cmds.length} komutan · KİŞİ BAŞI/SN: PETROL +${inc.oil.toFixed(1)} · İNSAN +${inc.manpower.toFixed(1)} · PUAN +${inc.points.toFixed(1)}</span>`
            + `<div class="council-skill-legend">YETENEKLER · ⚔ SAVAŞ · 🕊 DİPLOMASİ · ⚙ İKTİSAT · ● SADAKAT</div>`;
        storyUiSetHtml(tre, treasuryHtml);
        const skSum = c => c.skills ? (c.skills.warrior + c.skills.diplomat + c.skills.economist) : 0;
        let bestId = -1, bestSum = -1;
        for (const c of cmds) { if (c.isPlayer) continue; const s = skSum(c); if (s > bestSum) { bestSum = s; bestId = c.id; } }
        const sorted = cmds.slice().sort((a, b) => (a.isPlayer !== b.isPlayer) ? (a.isPlayer ? -1 : 1) : (skSum(b) - skSum(a)));
        const list = document.getElementById('council-list');
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
        const acts = document.getElementById('council-actions');
        const createBtn = document.getElementById('council-create-btn');
        const dismissBtn = document.getElementById('council-dismiss-btn');
        if (acts) acts.classList.toggle('locked', !isAdmin);
        const extra = (me.gov && me.gov.commanders) ? me.gov.commanders.length : 0;
        const C = STORY_CMD_COST, afford = me.res.oil >= C && me.res.manpower >= C && me.res.points >= C, capFull = extra >= 9;
        if (createBtn) { createBtn.disabled = !isAdmin || capFull || !afford; createBtn.textContent = capFull ? '➕ Konsey dolu (10)' : ((!afford && isAdmin) ? '➕ Hazine yetersiz' : '➕ Komutan Yarat'); }
        if (dismissBtn) { dismissBtn.disabled = !isAdmin || extra === 0; dismissBtn.textContent = STORY._dismissMode ? '✓ Dağıtmayı Bitir' : '✖ Dağıt Modu'; }
        const laws = document.getElementById('council-lawbox');
        if (laws && typeof storyCouncilLawsHtml === 'function') storyUiSetHtml(laws, storyCouncilLawsHtml(me));
    }
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
        // KUSUR 15: karar düğmesi ÖNCE bakılır. Kart yürütmez; muhatabın görüşme
        // penceresini açar ve karar orada, mevcut doğrulanmış yoldan uygulanır.
        const karar = event.target.closest('[data-agenda-kisi]');
        if (karar) {
            if (typeof storyConversationWorkspaceOpen === 'function') {
                storyConversationWorkspaceOpen(karar.dataset.agendaKisi, karar.dataset.agendaKisiAd);
            } else if (typeof storyTalkOpen === 'function') {
                STORY._talkFocusCharacterId = karar.dataset.agendaKisi;
                storyTalkOpen();
            }
            return;
        }
        const button = event.target.closest('[data-story-agenda-action]');
        if (button) storyAgendaNavigate(button.dataset.storyAgendaAction, button.dataset.storyAgendaSub);
    });
    document.getElementById('story-pause-btn')?.addEventListener('click', () => storyTogglePause());
    /* SPACE = duraklat/devam. Yazarken tetiklenmemesi kritik: akış araması,
       sohbet kutusu ve karakter adı hep metin alanı — orada boşluk KARAKTERDİR.
       Ayrıca konsey oturumu açıkken dünya zaten durmuş oluyor, oraya karışmaz. */
    window.addEventListener('keydown', (event) => {
        if (event.code !== 'Space' && event.key !== ' ') return;
        if (document.body.getAttribute('data-screen') !== 'story') return;
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        const hedef = event.target;
        if (hedef && (hedef.isContentEditable ||
            /^(INPUT|TEXTAREA|SELECT)$/.test(hedef.tagName || ''))) return;
        // Düğmeye odaklıyken SPACE zaten o düğmeyi basar; iki kez duraklatmayalım.
        if (hedef && hedef.tagName === 'BUTTON') return;
        // Kampanya yüklü mü? (`STORY.active` — `STORY.world` diye bir alan YOK;
        // ilk yazdığım koruma tam da bu yüzden SPACE'i tamamen ölü bırakmıştı.)
        if (typeof STORY === 'undefined' || !STORY.active) return;
        event.preventDefault();
        storyTogglePause();
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
    document.getElementById('story-node-info')?.addEventListener('input', (event) => {
        const field = event.target.closest('[data-story-logistics-field]');
        if (!field || !STORY._regionLogisticsDraft) return;
        STORY._regionLogisticsDraft[field.dataset.storyLogisticsField] = field.value;
        STORY._regionLogisticsDraft.feedback = '';
    });
    document.getElementById('story-node-info')?.addEventListener('change', (event) => {
        const field = event.target.closest('[data-story-logistics-field]');
        if (!field || !STORY._regionLogisticsDraft) return;
        STORY._regionLogisticsDraft[field.dataset.storyLogisticsField] = field.value;
        STORY._regionLogisticsDraft.feedback = '';
        storyPanelUpdate();
    });
    document.getElementById('story-node-info')?.addEventListener('click', (event) => {
        const landAction = event.target.closest('[data-story-hex-action]');
        if (landAction) {
            const selected = storyNode(STORY.selectedNodeId);
            const selection = storyRegionSelectionResolve(selected);
            const result = typeof storyHexLandManagementSubmit === 'function'
                ? storyHexLandManagementSubmit(Object.assign({}, selection, {
                    actionType: landAction.dataset.storyHexAction
                })) : { ok: false, code: 'LAND_MANAGEMENT_UNAVAILABLE' };
            if (typeof storyFlash === 'function') storyFlash(result.ok
                ? result.record.outcome : (result.code === 'LAND_ACTION_ALREADY_OPEN'
                    ? 'Bu altıgen için aynı kayıt zaten açık.' : `Arazi işlemi açılamadı: ${result.code}`));
            storyPanelUpdate();
            return;
        }
        const dispatch = event.target.closest('[data-story-logistics-dispatch]');
        if (dispatch) {
            const result = storyRegionLogisticsDispatch();
            const labels = { NO_EXPORTABLE_STOCK: 'Seçilen yük için gönderilebilir stok yok.',
                NO_ROUTE: 'Bu taşıma türüyle fiziksel rota bulunamadı.',
                CORRIDOR_CAPACITY_EXHAUSTED: 'Koridor kapasitesi dolu.',
                TRANSPORT_MODE_NOT_AVAILABLE: 'Bu yük seçilen araçla taşınamaz.',
                PHYSICAL_ROUTE_RESERVATION_UNAVAILABLE: 'Fiziksel yol rezervasyonu kurulamadı.',
                INVALID_ORDER_QUANTITY: 'Miktar sıfırdan büyük olmalı.' };
            if (STORY._regionLogisticsDraft) {
                STORY._regionLogisticsDraft.feedbackOk = !!result.ok;
                STORY._regionLogisticsDraft.feedback = result.ok
                    ? `${storyRegionFormatNumber(result.shipment && result.shipment.quantity || 0)} birim fiziksel sevkiyata çıktı.`
                    : (labels[result.code] || `Sevk reddedildi: ${result.code || 'BİLİNMEYEN HATA'}`);
            }
            storyPanelUpdate();
            return;
        }
        const button = event.target.closest('[data-story-enter-city]');
        if (!button) return;
        const nodeId = Number(button.dataset.storyEnterCity);
        if (storyNode(nodeId)) storySelectNode(nodeId);
        if (typeof storyCityOpen === 'function') storyCityOpen();
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
        if (button.classList.contains('infrastructure-route-mode')) {
            const result = typeof storyInfrastructureRoutePlayerChooseMode === 'function'
                ? storyInfrastructureRoutePlayerChooseMode(button.dataset.from, button.dataset.mode)
                : { ok: false, code: 'INFRASTRUCTURE_ROUTE_UI_UNAVAILABLE' };
            if (!result.ok && typeof storyFlash === 'function') storyFlash(`Ulaşım türü seçilemedi: ${result.code}`);
            return (typeof storyEconomyUpdate === 'function') && storyEconomyUpdate();
        }
        if (button.classList.contains('infrastructure-route-select')) {
            const result = typeof storyInfrastructureRoutePlayerSelect === 'function'
                ? storyInfrastructureRoutePlayerSelect(button.dataset.from, button.dataset.to, button.dataset.mode)
                : { ok: false, code: 'INFRASTRUCTURE_ROUTE_UI_UNAVAILABLE' };
            if (!result.ok && typeof storyFlash === 'function') storyFlash(`Güzergâh taslağı açılamadı: ${result.code}`);
            return (typeof storyEconomyUpdate === 'function') && storyEconomyUpdate();
        }
        if (button.classList.contains('infrastructure-route-cancel')) {
            if (typeof storyInfrastructureRoutePlayerCancelDraft === 'function') storyInfrastructureRoutePlayerCancelDraft();
            return (typeof storyEconomyUpdate === 'function') && storyEconomyUpdate();
        }
        if (button.classList.contains('infrastructure-route-submit')) {
            const result = typeof storyInfrastructureRoutePlayerSubmitDraft === 'function'
                ? storyInfrastructureRoutePlayerSubmitDraft()
                : { ok: false, code: 'INFRASTRUCTURE_ROUTE_UI_UNAVAILABLE' };
            if (typeof storyFlash === 'function') storyFlash(result.ok
                ? 'Fiziksel güzergâh şantiyesi başladı.' : `Güzergâh başlatılamadı: ${result.code}`);
            return (typeof storyEconomyUpdate === 'function') && storyEconomyUpdate();
        }
        if (button.classList.contains('infrastructure-right-of-way-request')) {
            const sourceEvidence = button.dataset.evidenceKind ? {
                kind: button.dataset.evidenceKind,
                id: button.dataset.evidenceId,
                routeKey: button.dataset.routeKey,
                targetRegionId: button.dataset.region
            } : null;
            const result = typeof storyInfrastructureRightOfWayPlayerRequest === 'function'
                ? storyInfrastructureRightOfWayPlayerRequest(
                    button.dataset.region, Number(button.dataset.compensation) || 0, sourceEvidence)
                : { ok: false, code: 'RIGHT_OF_WAY_UI_UNAVAILABLE' };
            if (typeof storyFlash === 'function') storyFlash(result.ok
                ? 'Diplomatik geçiş hakkı talebi hedef yürütmeye gönderildi.'
                : `Geçiş hakkı talebi açılamadı: ${result.code}`);
            return (typeof storyEconomyUpdate === 'function') && storyEconomyUpdate();
        }
        if (button.classList.contains('infrastructure-right-of-way-counter')) {
            const result = typeof storyInfrastructureRightOfWayPlayerRespondCounter === 'function'
                ? storyInfrastructureRightOfWayPlayerRespondCounter(
                    button.dataset.request, button.dataset.action)
                : { ok: false, code: 'RIGHT_OF_WAY_COUNTER_UI_UNAVAILABLE' };
            if (typeof storyFlash === 'function') storyFlash(result.ok
                ? (button.dataset.action === 'ACCEPT'
                    ? 'Karşı teklif kabul edildi; geçiş hakkı rota dosyasına işlendi.'
                    : 'Karşı teklif reddedildi.')
                : `Karşı teklif yanıtlanamadı: ${result.code}`);
            return (typeof storyEconomyUpdate === 'function') && storyEconomyUpdate();
        }
        if (button.classList.contains('infrastructure-proposal-decision')) {
            const result = typeof storyInfrastructureRoutePlayerDecideProposal === 'function'
                ? storyInfrastructureRoutePlayerDecideProposal(
                    button.dataset.proposalId, button.dataset.decision)
                : { ok: false, code: 'INFRASTRUCTURE_PROPOSAL_UI_UNAVAILABLE' };
            if (typeof storyFlash === 'function') storyFlash(result.ok
                ? (button.dataset.decision === 'APPROVE'
                    ? 'Şirket teklifi onaylandı ve fiziksel şantiye başladı.'
                    : 'Şirket teklifi reddedildi; escrow şirkete iade edildi.')
                : `Teklif kararı uygulanamadı: ${result.code}`);
            return (typeof storyEconomyUpdate === 'function') && storyEconomyUpdate();
        }
        if (button.classList.contains('hex-construction-begin')) {
            const view = STORY._economyView;
            const result = typeof storyHexConstructionPlayerBegin === 'function'
                ? storyHexConstructionPlayerBegin(view && view.regionId, button.dataset.projectType)
                : { ok: false, code: 'CONSTRUCTION_UI_UNAVAILABLE' };
            if (!result.ok && typeof storyFlash === 'function') storyFlash(`İmar taslağı açılamadı: ${result.code}`);
            return (typeof storyEconomyUpdate === 'function') && storyEconomyUpdate();
        }
        if (button.classList.contains('hex-construction-cancel')) {
            if (typeof storyHexConstructionPlayerCancelDraft === 'function') storyHexConstructionPlayerCancelDraft();
            return;
        }
        if (button.classList.contains('hex-construction-submit')) {
            const result = typeof storyHexConstructionPlayerSubmitDraft === 'function'
                ? storyHexConstructionPlayerSubmitDraft()
                : { ok: false, code: 'CONSTRUCTION_UI_UNAVAILABLE' };
            if (typeof storyFlash === 'function') storyFlash(result.ok
                ? 'İmar başvurusu yerel kurumun karar zincirine gönderildi.'
                : `İmar başvurusu gönderilemedi: ${result.code}`);
            return (typeof storyEconomyUpdate === 'function') && storyEconomyUpdate();
        }
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
    document.getElementById('economy-body')?.addEventListener('input', (event) => {
        const input = event.target.closest('.infrastructure-route-target-filter');
        if (!input) return;
        const normalize = value => String(value || '').normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('tr-TR').trim();
        const query = normalize(input.value);
        if (typeof storyInfrastructureRoutePlayerSetTargetFilter === 'function') {
            storyInfrastructureRoutePlayerSetTargetFilter(input.dataset.from, input.value);
        }
        const picker = input.closest('.city-infrastructure-target-picker');
        const buttons = picker ? [...picker.querySelectorAll('.infrastructure-route-select')] : [];
        let shown = 0;
        const limit = query ? 24 : 12;
        for (const button of buttons) {
            const match = !query || normalize(button.dataset.search).includes(query);
            const visible = match && shown < limit;
            button.hidden = !visible;
            if (visible) shown++;
        }
        const count = picker && picker.querySelector('.infrastructure-route-target-count');
        if (count) count.textContent = `${shown} / ${buttons.length} hedef gösteriliyor`;
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
            const nodes = STORY.nodes || [];
            let posCache = STORY._nodePositionsCache;
            if (!posCache || posCache.length !== nodes.length) {
                posCache = STORY._nodePositionsCache = nodes.map(n => {
                    const pos = typeof storyHexSettlementNodePosition === 'function'
                        ? storyHexSettlementNodePosition(n, STORY_WORLD_W, STORY_WORLD_H)
                        : { x: n.lx * STORY_WORLD_W, y: n.ly * STORY_WORLD_H };
                    return { id: n.id, x: pos.x, y: pos.y };
                });
            }
            for (let i = 0; i < posCache.length; i++) {
                const p = posCache[i];
                const dx = p.x - wx, dy = p.y - wy;
                const d = dx * dx + dy * dy;
                if (d < hd) { hd = d; hit = p.id; }
            }
            return hit;
        };
        // SÜRÜKLE-PAN: basılı tutup gez = kamera; kısa tık (sürüklemeden) = düğüm seç
        // WARP: imlecin altındaki DÜNYA noktası parmağa yapışsın diye s2w farkıyla kaydır
        let dragging = false, moved = false, lastX = 0, lastY = 0, mapRenderFrame = 0;
        const scheduleMapRender = () => {
            if (mapRenderFrame) return;
            mapRenderFrame = requestAnimationFrame(() => {
                mapRenderFrame = 0;
                storyRender();
            });
        };
        const finishMapInteraction = () => {
            STORY._mapInteracting = false;
            if (STORY._mapInteractionTimer) {
                clearTimeout(STORY._mapInteractionTimer);
                STORY._mapInteractionTimer = null;
            }
            scheduleMapRender();
        };
        cv.addEventListener('mousedown', (e) => {
            dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY;
            STORY._mapInteracting = true;
        });
        window.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            STORY._mapInteracting = true;
            if (Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY) > 3) moved = true;
            STORY._cw = cv.width; STORY._ch = cv.height;
            const rect = cv.getBoundingClientRect(), sc = cv.width / rect.width, scy = cv.height / rect.height;
            const a = storyS2W((lastX - rect.left) * sc, (lastY - rect.top) * scy);
            const b = storyS2W((e.clientX - rect.left) * sc, (e.clientY - rect.top) * scy);
            storyCam.x += a.x - b.x; storyCam.y += a.y - b.y; lastX = e.clientX; lastY = e.clientY;
            storyClampCam(cv.width, cv.height); cv.style.cursor = 'grabbing'; scheduleMapRender();
        });
        window.addEventListener('mouseup', (e) => {
            const wasDragging = dragging;
            STORY._mapInteracting = false;
            if (dragging && !moved) {
                if (STORY._hexConstructionPickMode && typeof storyHexConstructionPlayerPickCell === 'function') {
                    const picked = storyHexConstructionPlayerPickCell(STORY._hoverHexCellId);
                    if (!picked.ok && typeof storyFlash === 'function') storyFlash('Bu altıgen seçili proje için uygun değil.');
                    dragging = false; cv.style.cursor = 'grab'; scheduleMapRender();
                    return;
                }
                // ŞEHRE GİR paneli açıkken harita tıklaması paneli KAPATMAZ, odağı o şehre taşır
                // (şehir seçmek panelin doğal kullanımı — kapatmak akışı bozardı).
                if (STORY._cityOpen || STORY._economyOpen) {
                    const point = storyRegionCanvasPointFromEvent(cv, e);
                    const w = worldFromEvent(e), hit = pickNode(w.x, w.y);
                    if (storySelectRegionEntityAtCanvasPoint(point.x, point.y)) {
                        if (STORY._economyOpen && typeof storyEconomyUpdate === 'function') storyEconomyUpdate();
                    } else if (hit >= 0) {
                        storySelectNode(hit);
                        if (STORY._economyOpen && typeof storyEconomyUpdate === 'function') storyEconomyUpdate();
                    } else if (storySelectRegionEntityAtWorld(w.x, w.y)) {
                        if (STORY._economyOpen && typeof storyEconomyUpdate === 'function') storyEconomyUpdate();
                    } else {
                        if (STORY._cityOpen) storyCityClose();
                        if (STORY._economyOpen) storyEconomyClose();
                    }
                }
                else if (STORY._councilOpen || STORY._techOpen || STORY._armyOpen) { storyCouncilClose(); storyTechClose(); storyArmyClose(); }   // diğer paneller: haritaya tık = kapat
                else {
                    const point = storyRegionCanvasPointFromEvent(cv, e);
                    const w = worldFromEvent(e), hit = pickNode(w.x, w.y);
                    if (storySelectRegionEntityAtCanvasPoint(point.x, point.y)) { /* exact visible structure */ }
                    else if (hit >= 0) storySelectNode(hit);
                    else storySelectRegionEntityAtWorld(w.x, w.y);
                }
            }
            dragging = false; cv.style.cursor = 'grab';
            if (wasDragging) {
                STORY._mapInteracting = false;
                scheduleMapRender();
            }
        });
        let hoverFrame = 0;
        let lastHoverPoint = null;
        const processHover = () => {
            hoverFrame = 0;
            if (!lastHoverPoint || dragging) return;
            const pt = lastHoverPoint;
            const w = storyS2W(pt.mx, pt.my);
            const prevHoverId = STORY._hoverHexCellId;
            let currentCell = null;
            if (typeof storyHexPoliticalCellAtWorld === 'function') {
                currentCell = storyHexPoliticalCellAtWorld(w.x, w.y, STORY_WORLD_W, STORY_WORLD_H);
                STORY._hoverHexCellId = currentCell ? currentCell.id : null;
            }
            const structureEntity = storyRegionEntityAtCanvasPoint(pt.mx, pt.my);
            const regionEntity = structureEntity || (currentCell ? storyRegionEntityAtWorld(w.x, w.y, currentCell) : null);
            const targetCursor = STORY._hexConstructionPickMode
                && STORY._hexConstructionDraft
                && STORY._hexConstructionDraft.candidateCellIds.includes(STORY._hoverHexCellId)
                ? 'crosshair' : (pickNode(w.x, w.y) >= 0 || regionEntity ? 'pointer' : 'grab');
            if (cv.style.cursor !== targetCursor) {
                cv.style.cursor = targetCursor;
            }
            if (STORY._hoverHexCellId !== prevHoverId) {
                scheduleMapRender();
            }
        };
        cv.addEventListener('mousemove', (e) => {            // hover imleci (sürüklemiyorken)
            if (dragging) return;
            const rect = cv.getBoundingClientRect();
            const sc = cv.width / rect.width, scy = cv.height / rect.height;
            lastHoverPoint = {
                mx: (e.clientX - rect.left) * sc,
                my: (e.clientY - rect.top) * scy,
                cx: e.clientX - rect.left,
                cy: e.clientY - rect.top
            };
            if (!hoverFrame) {
                hoverFrame = requestAnimationFrame(processHover);
            }
        });
        cv.addEventListener('mouseleave', () => {
            STORY._hoverHexCellId = null;
            if (hoverFrame) { cancelAnimationFrame(hoverFrame); hoverFrame = 0; }
        });
        // ZOOM: fare tekerleği (imlecin altındaki dünya-noktası sabit kalır)
        cv.addEventListener('wheel', (e) => {
            e.preventDefault();
            STORY._mapInteracting = true;
            const rect = cv.getBoundingClientRect();
            const mx = (e.clientX - rect.left) * (cv.width / rect.width);
            const my = (e.clientY - rect.top) * (cv.height / rect.height);
            STORY._cw = cv.width; STORY._ch = cv.height;
            const wpt = storyS2W(mx, my);               // imleç altındaki dünya noktası (warp)
            storyCam.zoom = Math.max(storyMinZoom(cv.width, cv.height), Math.min(5, storyCam.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
            // aynı ekran noktası aynı dünya noktasını göstersin: cam = dünya − vec/z
            const flatV2 = typeof storyMapV2Enabled === 'function' && storyMapV2Enabled();
            const u = my / cv.height, vy = flatV2 ? my : storyVyOf(u);
            const vx = flatV2 ? mx : (mx - cv.width / 2) / storySxOf(u) + cv.width / 2;
            storyCam.x = wpt.x - vx / storyCam.zoom; storyCam.y = wpt.y - vy / storyCam.zoom;
            storyClampCam(cv.width, cv.height); scheduleMapRender();
            if (STORY._mapInteractionTimer) clearTimeout(STORY._mapInteractionTimer);
            STORY._mapInteractionTimer = setTimeout(finishMapInteraction, 120);
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

function storyTechSetPriority(techId, options) {
    const st = storyPlayerState();
    const tech = typeof TECH_BY_ID !== 'undefined' ? TECH_BY_ID[String(techId)] : null;
    if (!st || !tech) return { ok: false, code: 'TECH_NOT_FOUND' };
    const status = storyTechStatusFor(st.tech || [], tech);
    if (status.state !== 'available') return { ok: false, code: 'TECH_NOT_AVAILABLE', status };
    const before = st.playerTechPriority || null;
    st.playerTechPriority = tech.id;
    return { ok: true, receipt: { ledger: 'states', stateId: st.id, before, after: tech.id,
        requiredFund: status.cost, actorId: options && options.actorId || null } };
}