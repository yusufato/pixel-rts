// ═══════════════════════════════════════════════════════════════════════════
//  FRAKSİYON KATMANI (PLAN AŞAMA 2) — toplumun oyuna cevabı
//  ---------------------------------------------------------------------------
//  10 yıllık oyun-yaşama testi tespiti: "5 şehir kaybettim, toplum hiç tepki
//  vermedi; refah amaçsızca salındı." Bu katman o boşluğu doldurur: her devlette
//  5 çıkar grubu yaşar, kanunlara/savaşlara/refaha TEPKİ verir ve öfkesi mevcut
//  kanallardan (sadakat erimesi, refah, darbe riski, üretim) geri teper.
//
//  İLKE: Sayılar motorda. Girdiler deterministik tablolar (kanun→fraksiyon
//  deltası), çıktılar MEVCUT borulara bağlanır — paralel ikinci ekonomi kurulmaz:
//    öfke → sadakat erimesi (StorySocial drift'ine terim)
//    öfke → refah sızıntısı (yüksek unrest yavaşça refah yer)
//    ordu öfkesi → darbe olasılığı çarpanı (storyApplyCoups)
//    radikaller+işçi öfkesi → GENEL GREV (üretim yavaşlar; prodTick çarpanı)
//    fraksiyon öfkesi → konsey oyu (kızgın fraksiyonun sevdiği teklif ağırlaşır —
//    konseyin kendini düzeltme deseninin topluma genellenmesi)
//  AI simetrisi bedava: her şey devlet üstünde, tüm devletler aynı motoru koşar.
// ═══════════════════════════════════════════════════════════════════════════

const FACTIONS = [
    { k: 'workers',  icon: '⚒️', name: 'İşçiler & Sendikalar' },
    { k: 'business', icon: '🏦', name: 'Sermaye & Şirketler' },
    { k: 'military', icon: '🎖️', name: 'Ordu & Emniyet' },
    { k: 'intel',    icon: '📰', name: 'Aydınlar & Basın' },
    { k: 'radicals', icon: '🔥', name: 'Militan Gruplar' },
];
const FAC_KEYS = FACTIONS.map(f => f.k);
function facClamp(v) { return Math.max(5, Math.min(95, Math.round(v * 10) / 10)); }

// ── AÇILIŞ TAVRI — devletin liderinden (cumhurbaşkanı eksenleri) türer ──────
// Şahin lider orduyu ısıtır, otoriter lider aydınları soğutur… Oyuncunun
// devletinde oyuncunun karakter-ekranı eksenleri %20 karışır (ünlü komutanın
// kim olduğunu toplum bilir; AŞAMA 1 sorularının fraksiyon ön-tavrı budur).
function storyFacInit(st) {
    const p = (st.gov && st.gov.president && st.gov.president.axes) || { hawk: 50, auth: 50, pop: 50, nat: 50 };
    let ax = p;
    if (st.isPlayer && STORY.commander && STORY.commander.axes) {
        const m = STORY.commander.axes;
        ax = { hawk: p.hawk * 0.8 + m.hawk * 0.2, auth: p.auth * 0.8 + m.auth * 0.2,
               pop: p.pop * 0.8 + m.pop * 0.2,   nat: p.nat * 0.8 + m.nat * 0.2 };
    }
    st.factions = {
        workers:  facClamp(50 + (ax.pop - 50) * 0.35 - (ax.auth - 50) * 0.10),
        business: facClamp(50 - (ax.pop - 50) * 0.30 - (ax.nat - 50) * 0.15 + (ax.auth - 50) * 0.05),
        military: facClamp(50 + (ax.hawk - 50) * 0.35 + (ax.auth - 50) * 0.15),
        intel:    facClamp(50 - (ax.auth - 50) * 0.40 + (50 - ax.hawk) * 0.10),
        radicals: facClamp(20 + storyRandom('society') * 8),
    };
    st._facLog = [];
}
function storyFacInitAll() { for (const st of STORY.states) storyFacInit(st); }
function storyFacBackfill(st) { if (!st.factions) storyFacInit(st); if (!st._facLog) st._facLog = []; }

// ── KANUN/ANAYASA → FRAKSİYON TEPKİSİ (deterministik tablo) ────────────────
// Anahtar 'slot.opsiyon' (opsiyon id'leri slotlar arası benzersiz değil: economy.free ≠ press.free)
const FAC_LAW = {
    'conscription.volunteer': { workers: 4, military: -4 },
    'conscription.draft':     { military: 5, workers: -3 },
    'conscription.total':     { military: 8, workers: -6, business: -3, radicals: 4 },
    'economy.free':           { business: 7, workers: -3, intel: 1 },
    'economy.mixed':          { workers: 2, business: 2 },
    'economy.command':        { business: -7, military: 4, workers: 2, radicals: 2 },
    'industry.private':       { business: 6, workers: -2 },
    'industry.state':         { workers: 3, business: -2, military: 2 },
    'industry.heavy':         { military: 6, workers: -4, business: -2, radicals: 3 },
    'tax.low':                { business: 4, workers: 3, military: -3 },
    'tax.moderate':           { business: 1, workers: 1 },
    'tax.heavy':              { business: -6, workers: -4, military: 3, radicals: 3 },
    'press.free':             { intel: 8, workers: 2, military: -3 },
    'press.guided':           { intel: -5, military: 3 },
    'press.censor':           { intel: -10, military: 5, radicals: 5, business: -2 },
    'officers.merit':         { intel: 4, military: 2, workers: 2 },
    'officers.noble':         { military: 3, workers: -3, intel: -3, business: 2 },
    'officers.commissar':     { military: -2, workers: 3, radicals: 3, intel: -2 },
    'land.estates':           { business: 6, workers: -5, radicals: 2 },
    'land.reform':            { workers: 6, business: -4 },
    'education.war':          { military: 6, intel: -4 },
    'education.technical':    { business: 4, intel: 3, workers: 2 },
    'education.public':       { workers: 5, intel: 5, military: -2 },
};
const FAC_CONST = {
    monarchy: { intel: 3, business: 2 },
    absolute: { military: 5, intel: -8, radicals: 5, business: -2 },
    republic: { intel: 7, workers: 4, business: 3, military: -4 },
    junta:    { military: 10, intel: -10, workers: -5, radicals: 6, business: -4 },
    council:  { workers: 7, intel: 2, business: -5, military: -2 },
};

function storyFacApply(st, deltas, why) {
    if (!st || !deltas) return;
    storyFacBackfill(st);
    const parts = [];
    for (const k in deltas) {
        if (st.factions[k] == null) continue;
        st.factions[k] = facClamp(st.factions[k] + deltas[k]);
        if (Math.abs(deltas[k]) >= 2) parts.push(`${(FACTIONS.find(f => f.k === k) || {}).icon || ''}${deltas[k] > 0 ? '+' : ''}${deltas[k]}`);
    }
    if (why && parts.length) {
        st._facLog.unshift(`${why}: ${parts.join(' ')}`);
        if (st._facLog.length > 6) st._facLog.pop();
        // KULLANICI İSTEĞİ: oyuncunun devletindeki fraksiyon tepkileri ANA KAYITTA
        // görünsün — "arka planda ben görmeden olup bitiyor" şikâyetinin cevabı.
        if (st.isPlayer && typeof storyLog === 'function') storyLog(`⚖️ ${why}: ${parts.join(' ')}`);
    }
}
function storyFacOnLaw(st, slotKey, optId, optName) { storyFacApply(st, FAC_LAW[slotKey + '.' + optId], optName || (slotKey + '.' + optId)); }
function storyFacOnConstitution(st, cid, cname) { storyFacApply(st, FAC_CONST[cid], cname || cid); }

// ── OLAYLAR (fetih, firar, darbe) ──────────────────────────────────────────
const FAC_EVENTS = {
    cityLost: { deltas: { military: -3, radicals: 2, business: -1 }, why: 'Şehir kaybı' },
    cityWon:  { deltas: { military: 2, business: 1 },                 why: 'Fetih' },
    defect:   { deltas: { radicals: 2, intel: -1 },                   why: 'Komutan firarı' },
    coup:     { deltas: { radicals: -10, intel: -3, business: -4 },   why: 'Darbe' },
    strike:   { deltas: { radicals: -10, workers: 4 },                 why: 'Genel grev' },
};
const FAC_EVENT_NOTICE = Object.freeze({
    cityLost: {
        severity: 'high', title: 'ŞEHİR KAYBI TOPLUMU SARSTI',
        summary: 'Ordu yönetimin yeterliliğini sorguluyor; radikal gruplar kaybı propaganda malzemesine çevirdi.',
        consequence: 'Ordu desteği düşer, radikaller güçlenir ve huzursuzluk baskısı artabilir.'
    },
    cityWon: {
        severity: 'positive', title: 'FETİH DESTEĞİ YÜKSELTTİ',
        summary: 'Zafer, güvenlik kurumlarının ve iş çevrelerinin yönetime desteğini güçlendirdi.',
        consequence: 'Ordu ve sermaye desteği kısa vadede yükselir.'
    },
    defect: {
        severity: 'high', title: 'KOMUTAN FİRARI GÜVENİ SARSTI',
        summary: 'Bir komutanın saf değiştirmesi devlet içindeki güç gruplarına yönetimin denetimini sorgulattı.',
        consequence: 'Radikal hareketler cesaretlenir; bilgi kurumlarının güveni aşınır.'
    },
    coup: {
        severity: 'critical', title: 'DARBE SİYASİ DENGEYİ DEĞİŞTİRDİ',
        summary: 'İktidarın zorla değişmesi toplumsal blokları yeniden hizaladı.',
        consequence: 'Radikaller geçici olarak bastırılır; aydınlar ve sermaye güven kaybeder.'
    },
    strike: {
        severity: 'critical', title: 'GENEL GREV BAŞLADI',
        summary: 'Radikal örgütlenme ile işçi hoşnutsuzluğu birleşti; üretim hatları yavaşladı.',
        consequence: 'Üretim 40 saniye boyunca %55 düşer; refah doğrudan zarar görür.'
    }
});

function storyFactionNoticeBadgeUpdate() {
    const badge = document.getElementById('story-economy-badge');
    if (!badge) return;
    const count = (STORY._factionNoticeQueue || []).length + (STORY._factionNoticeCurrent ? 1 : 0);
    badge.textContent = count > 9 ? '9+' : (count ? String(count) : '');
    badge.classList.toggle('hidden', count === 0);
    badge.title = count ? `${count} okunmamış toplumsal olay` : '';
}

function storyFactionDeltaText(deltas) {
    return Object.entries(deltas || {}).map(([key, value]) => {
        const faction = FACTIONS.find(item => item.k === key);
        return `${faction ? `${faction.icon} ${faction.name}` : key}: ${value > 0 ? '+' : ''}${value}`;
    }).join(' · ');
}

function storyFactionNotice(notice) {
    if (!notice || !storyPlayerState()) return false;
    if (!STORY._factionNoticeQueue) STORY._factionNoticeQueue = [];
    const normalized = {
        id: String(notice.id || `fac-${Math.floor(STORY.clock || 0)}-${STORY._factionNoticeQueue.length}`),
        key: String(notice.key || 'faction'),
        severity: String(notice.severity || 'medium'),
        title: String(notice.title || 'FRAKSİYON TEPKİSİ'),
        summary: String(notice.summary || ''),
        consequence: String(notice.consequence || ''),
        deltas: Object.assign({}, notice.deltas || {}),
        collectiveActionId: notice.collectiveActionId == null ? null : String(notice.collectiveActionId),
        responseOptions: Array.isArray(notice.responseOptions)
            ? notice.responseOptions.map(String).filter(mode => (
                typeof STORY_COLLECTIVE_RESPONSES !== 'undefined'
                && STORY_COLLECTIVE_RESPONSES.includes(mode)
            ))
            : [],
        observedAt: Number(STORY.clock) || 0
    };
    const duplicate = STORY._factionNoticeCurrent && STORY._factionNoticeCurrent.id === normalized.id
        || STORY._factionNoticeQueue.some(item => item.id === normalized.id);
    if (duplicate) return false;
    STORY._factionNoticeQueue.push(normalized);
    if (STORY._factionNoticeQueue.length > 20) STORY._factionNoticeQueue.splice(0, STORY._factionNoticeQueue.length - 20);
    storyFactionNoticeShowNext();
    return true;
}

function storyFactionNoticeShowNext() {
    if (!STORY._factionNoticeCurrent && STORY._factionNoticeQueue && STORY._factionNoticeQueue.length) {
        STORY._factionNoticeCurrent = STORY._factionNoticeQueue.shift();
    }
    const notice = STORY._factionNoticeCurrent;
    const modal = document.getElementById('faction-event-modal');
    if (!modal || !notice) {
        if (modal) modal.classList.add('hidden');
        storyFactionNoticeBadgeUpdate();
        return;
    }
    modal.className = `faction-event-modal severity-${notice.severity}`;
    const kicker = document.getElementById('faction-event-kicker');
    const title = document.getElementById('faction-event-title');
    const body = document.getElementById('faction-event-body');
    if (kicker) kicker.textContent = notice.severity === 'critical' ? 'ACİL TOPLUMSAL KRİZ' : 'TOPLUMSAL OLAY';
    if (title) title.textContent = notice.title;
    if (body) {
        const esc = typeof storyProjectionEscape === 'function' ? storyProjectionEscape : value => String(value || '');
        body.innerHTML = `<p>${esc(notice.summary)}</p>`
            + (notice.consequence ? `<div class="faction-event-effect"><span>OYUNA ETKİSİ</span><b>${esc(notice.consequence)}</b></div>` : '')
            + (Object.keys(notice.deltas).length ? `<div class="faction-event-deltas">${esc(storyFactionDeltaText(notice.deltas))}</div>` : '');
    }
    const responses = document.getElementById('faction-event-responses');
    if (responses) {
        const labels = {
            CONCEDE: ['TALEBİ KABUL ET', 'Kısa vadede tansiyonu düşürür; sorun çözülmezse verilen taviz güven kaybına döner.'],
            NEGOTIATE: ['MÜZAKERE ET', 'Hareketi bitirmez; radikalleşmeyi yavaşlatır ve çözüm için zaman kazandırır.'],
            SUPPRESS: ['BASTIR', 'Eylemi dağıtır; bastırma hafızası sonraki sefer radikalleşmeyi büyütür.'],
            IGNORE: ['GÖRMEZDEN GEL', 'Anlık siyasi bedel ödemez; alttaki sorun ve örgütlenme olduğu gibi sürer.']
        };
        responses.innerHTML = notice.collectiveActionId
            ? notice.responseOptions.map(mode => {
                const row = labels[mode] || [mode, ''];
                return `<button class="story-btn collective-response response-${mode.toLowerCase()}" data-collective-response="${mode}" title="${row[1]}">${row[0]}</button>`;
            }).join('')
            : '';
        responses.classList.toggle('hidden', !responses.innerHTML);
    }
    storyFactionNoticeBadgeUpdate();
    setTimeout(() => document.getElementById('faction-event-close')?.focus(), 0);
}

function storyFactionNoticeClose() {
    STORY._factionNoticeCurrent = null;
    const modal = document.getElementById('faction-event-modal');
    if (modal) modal.classList.add('hidden');
    storyFactionNoticeShowNext();
}

// Zaman asimina ugrayan toplumsal yanit penceresi artik eylem defterinde
// gecersizdir. Kuyrukta veya ekranda birakilirsa oyuncuya calismayan secenekler
// sunar; kimlik uzerinden atomik olarak temizle ve siradaki gercek olayi ac.
function storyFactionNoticeExpireCollective(movementId) {
    const id = String(movementId || '');
    if (!id) return false;
    let removed = false;
    if (Array.isArray(STORY._factionNoticeQueue)) {
        const before = STORY._factionNoticeQueue.length;
        STORY._factionNoticeQueue = STORY._factionNoticeQueue.filter(
            notice => String(notice && notice.collectiveActionId || '') !== id
        );
        removed = STORY._factionNoticeQueue.length !== before;
    }
    if (STORY._factionNoticeCurrent
        && String(STORY._factionNoticeCurrent.collectiveActionId || '') === id) {
        STORY._factionNoticeCurrent = null;
        const modal = document.getElementById('faction-event-modal');
        if (modal) modal.classList.add('hidden');
        removed = true;
        storyFactionNoticeShowNext();
    } else {
        storyFactionNoticeBadgeUpdate();
    }
    return removed;
}

function storyFactionNoticeOpenEconomy() {
    STORY._factionNoticeCurrent = null;
    const modal = document.getElementById('faction-event-modal');
    if (modal) modal.classList.add('hidden');
    if (typeof storyEconomyOpen === 'function') storyEconomyOpen('fraksiyonlar');
    storyFactionNoticeBadgeUpdate();
}

function storyFactionNoticeRespond(mode) {
    const notice = STORY._factionNoticeCurrent;
    if (!notice || !notice.collectiveActionId || typeof storyCollectiveRespond !== 'function') return false;
    const result = storyCollectiveRespond(notice.collectiveActionId, String(mode), { actor: 'PLAYER_GOVERNMENT' });
    if (!result || !result.ok) return false;
    if (typeof storyLog === 'function') storyLog(`⚖️ Toplumsal eyleme yanıt: <b>${String(mode)}</b>.`);
    storyFactionNoticeClose();
    return true;
}

function storyFacEvent(st, type) {
    if (typeof storyTelemetryEvent === 'function' && st) {
        storyTelemetryEvent(`society.${type}`, { stateId: st.id });
    }
    const e = FAC_EVENTS[type]; if (e) storyFacApply(st, e.deltas, e.why);
    if (st && st.isPlayer && e) {
        const notice = FAC_EVENT_NOTICE[type] || {};
        storyFactionNotice({
            id: `fac-event-${type}-${Math.floor(STORY.clock || 0)}`,
            key: type,
            severity: notice.severity,
            title: notice.title || e.why,
            summary: notice.summary || e.why,
            consequence: notice.consequence || '',
            deltas: e.deltas
        });
    }
    if (typeof storyEconEvent === 'function') storyEconEvent(st, type);   // AŞAMA 3: güven/enflasyon da tepki verir
}

// ── ÖFKE (unrest) ve DIŞA VURUMLARI ────────────────────────────────────────
// 0..~50. En mutsuz ana fraksiyon + radikal taşkınlık belirler.
function storyFacUnrest(st) {
    if (!st || !st.factions) return 0;
    const f = st.factions;
    const worst = Math.min(f.workers, f.business, f.military, f.intel);
    return Math.max(0, (50 - worst) * 0.6 + Math.max(0, f.radicals - 50) * 0.5);
}
// Darbe olasılığı çarpanı: ordu küskünse cunta cesaretlenir, ordu memnunsa yönetimi korur.
function storyFacCoupMul(st) {
    const m = st && st.factions ? st.factions.military : 50;
    if (m <= 35) return 1.5;
    if (m <= 45) return 1.2;
    if (m >= 65) return 0.7;
    return 1;
}
// Grev üretim çarpanı (prodTick her iş için çağırır)
function storyFacStrikeMul(ownerId, regionId) {
    if (typeof storyCollectiveEnabled === 'function' && storyCollectiveEnabled()
        && typeof storyCollectiveRegionProductionMultiplier === 'function') {
        return storyCollectiveRegionProductionMultiplier(regionId);
    }
    const st = (typeof storyState === 'function') ? storyState(ownerId) : null;
    return (st && st._strikeUntil && st._strikeUntil > (STORY.clock || 0)) ? 0.45 : 1;
}

// ── SÜREKLİ SÜRÜCÜLER (2 sn'de bir; storyAdvance bağlar) ───────────────────
function storyFactionsTick(dt) {
    for (const st of STORY.states) {
        if (!STORY.nodes.some(n => n.owner === st.id)) continue;   // ölü devlet
        storyFacBackfill(st);
        const f = st.factions;
        const atWar = STORY.states.some(s => s.id !== st.id && typeof storyIsHostile === 'function'
            && storyIsHostile(st.id, s.id) && STORY.nodes.some(n => n.owner === s.id));
        // işçiler refahı izler; radikaller sefaletten beslenir
        f.workers = facClamp(f.workers + (st.welfare - f.workers) * 0.004 * dt);
        const radTarget = 20 + Math.max(0, 45 - st.welfare) * 0.9;
        f.radicals = facClamp(f.radicals + (radTarget - f.radicals) * 0.006 * dt);
        // savaş: orduyu ısıtır, aydın ve sermayeyi yorar; barış tersi (daha yavaş)
        if (atWar) { f.military = facClamp(f.military + 0.010 * dt); f.intel = facClamp(f.intel - 0.008 * dt); f.business = facClamp(f.business - 0.006 * dt); }
        else { f.military = facClamp(f.military - 0.004 * dt); f.intel = facClamp(f.intel + 0.004 * dt); f.business = facClamp(f.business + 0.004 * dt); }
        // ortalamaya hafif dönüş (kalıcı kutuplaşma kanun/olay ister, kendiliğinden değil)
        for (const k of ['business', 'military', 'intel']) f[k] = facClamp(f[k] + (50 - f[k]) * 0.0015 * dt);

        // ÖFKE → REFAH SIZINTISI (eşikli: mutlu toplumda sıfır maliyet)
        const unr = storyFacUnrest(st);
        if (unr > 18) storyWelfareDelta(st, 'society.unrest', -(unr - 18) * 0.004 * dt, {
            continuous: true,
            correlationId: `systemic-pressure:${st.id}`
        });

        // OYUNCUYA SES: eşik aşımlarında uyarı (yalnız oyuncu devleti, anahtar başına 90 sn)
        if (st.isPlayer) {
            if (!st._facWarn) st._facWarn = {};
            const warn = (key, payload) => {
                if ((STORY.clock - (st._facWarn[key] || -999)) <= 90) return;
                st._facWarn[key] = STORY.clock;
                storyFactionNotice(Object.assign({
                    id: `fac-warning-${key}-${Math.floor(STORY.clock || 0)}`,
                    key,
                    severity: 'high'
                }, payload));
            };
            if (f.military <= 35) warn('mil', {
                title: 'ORDU YÖNETİMDEN UZAKLAŞIYOR',
                summary: `Ordu desteği ${Math.round(f.military)} seviyesine düştü.`,
                consequence: 'Darbe olasılığı ×1.5. Zafer veya güvenlik kurumlarını gözeten bir kanun baskıyı azaltabilir.'
            });
            if (f.radicals >= 58 && f.workers <= 45) warn('rad', {
                title: 'GENEL GREV EŞİĞİNE YAKLAŞILDI',
                summary: 'Radikal hareketler güçlenirken işçi desteği kritik eşiğin altına indi.',
                consequence: 'Koşullar sürerse genel grev üretimi %55 yavaşlatacak. Refah veya işçi desteği yükseltilmeli.'
            });
            if (f.intel <= 30) warn('int', {
                title: 'BASIN VE AYDINLAR MUHALEFETE GEÇTİ',
                summary: `Aydınlar ve basın desteği ${Math.round(f.intel)} seviyesine düştü.`,
                consequence: 'Sansürün gevşetilmesi veya eğitim yatırımı bu bloğu yumuşatabilir.'
            });
        }
        // GENEL GREV: radikal taşkınlık + küskün işçi sınıfı → üretim durur (soğumalı)
        const _collectiveOwnsStrike = typeof storyCollectiveEnabled === 'function' && storyCollectiveEnabled();
        if (!_collectiveOwnsStrike && f.radicals >= 62 && f.workers <= 42 && (STORY.clock - (st._lastStrike || -999)) > 120) {
            st._lastStrike = STORY.clock;
            st._strikeUntil = STORY.clock + 40;
            storyWelfareDelta(st, 'society.general_strike', -3, {
                correlationId: `strike:${st.id}:${Math.floor(STORY.clock || 0)}`
            });
            storyFacEvent(st, 'strike');   // buhar boşalır: radikaller iner, işçiler kazanım hisseder
            storyLog(`🪧 <b>${st.name}</b>'de GENEL GREV — üretim 40 sn yavaşlayacak.`);
            if (typeof storyNews === 'function') storyNews('strike', { st: st.name });
            if (typeof storyEraEvent === 'function') storyEraEvent('grev');
        }
    }
}

// ── KONSEY OYUNA ETKİ — kızgın fraksiyonun sevdiği teklif ağırlaşır ────────
// storyCouncilContext'in "kriz kendini düzeltir" deseninin topluma genellenmesi:
// fraksiyon 50'nin altına düştükçe onu memnun edecek seçenek konseyde puan kazanır
// (yatıştırma), 50 üstü fraksiyonu daha da şımartmak puan KAYBETTİRİR (küçük).
function storyFacScore(optFac, st) {
    if (!optFac || !st || !st.factions) return 0;
    let s = 0;
    for (const k in optFac) {
        const cur = st.factions[k]; if (cur == null) continue;
        s += optFac[k] * ((55 - cur) / 50) * 0.9;
    }
    return Math.max(-6, Math.min(6, s));
}
// Kanun/anayasa seçeneklerine _fac iliştir (yükleme anında bir kez; tally hızlı kalır)
(function facAttach() {
    if (typeof LAW_SLOTS !== 'undefined') for (const s of LAW_SLOTS) for (const o of s.options) o._fac = FAC_LAW[s.key + '.' + o.id] || null;
    if (typeof CONSTITUTIONS !== 'undefined') for (const c of CONSTITUTIONS) c._fac = FAC_CONST[c.id] || null;
})();

// ── UI — konsey çekmecesinde FRAKSİYONLAR sekmesi ──────────────────────────
function storyFacHtml(st) {
    if (!st) return '';
    storyFacBackfill(st);
    const rows = FACTIONS.map(fd => {
        const v = st.factions[fd.k];
        const trend = '<span style="color:#556">•</span>';
        const col = v < 35 ? '#ff5a5a' : (v < 48 ? '#ffd24c' : '#4cff7c');
        return `<div class="fac-row"><span class="fac-name">${fd.icon} ${fd.name}</span>`
            + `<div class="fac-track"><div class="fac-fill" style="width:${v}%;background:${col}"></div></div>`
            + `<b class="fac-val" style="color:${col}">${Math.round(v)}</b>${trend}</div>`;
    }).join('');
    const unr = Math.round(storyFacUnrest(st));
    const strike = st._strikeUntil && st._strikeUntil > STORY.clock ? ' · 🪧 <b style="color:#ff5a5a">GREV SÜRÜYOR</b>' : '';
    const logs = (st._facLog || []).slice(0, 3).map(l => `<div class="fac-log">${l}</div>`).join('');
    return `<div class="fac-box">${rows}
        <div class="fac-unrest">Huzursuzluk: <b style="color:${unr > 25 ? '#ff5a5a' : (unr > 12 ? '#ffd24c' : '#4cff7c')}">${unr}</b>${strike}</div>
        ${logs ? `<div class="fac-logs"><div class="fac-logs-t">SON TEPKİLER</div>${logs}</div>` : ''}
        <div class="fac-hint">Kanunlar, savaşlar ve refah fraksiyonları oynatır. Küskün ordu darbeyi kolaylaştırır;
        öfkeli radikaller + küskün işçiler GREV çıkarır; genel huzursuzluk refahı ve sadakati kemirir.
        Konseyde kızgın fraksiyonun istediği teklif ağırlık kazanır.</div></div>`;
}
