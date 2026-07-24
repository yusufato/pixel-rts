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
        radicals: facClamp(20 + Math.random() * 8),
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
function storyFacEvent(st, type) { const e = FAC_EVENTS[type]; if (e) storyFacApply(st, e.deltas, e.why); }

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
function storyFacStrikeMul(ownerId) {
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
        if (unr > 18) st.welfare = Math.max(0, st.welfare - (unr - 18) * 0.004 * dt);

        // GENEL GREV: radikal taşkınlık + küskün işçi sınıfı → üretim durur (soğumalı)
        if (f.radicals >= 62 && f.workers <= 42 && (STORY.clock - (st._lastStrike || -999)) > 120) {
            st._lastStrike = STORY.clock;
            st._strikeUntil = STORY.clock + 40;
            st.welfare = Math.max(0, st.welfare - 3);
            storyFacEvent(st, 'strike');   // buhar boşalır: radikaller iner, işçiler kazanım hisseder
            storyLog(`🪧 <b>${st.name}</b>'de GENEL GREV — üretim 40 sn yavaşlayacak.`);
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
    if (!st._facPrev) st._facPrev = Object.assign({}, st.factions);
    const rows = FACTIONS.map(fd => {
        const v = st.factions[fd.k], pv = st._facPrev[fd.k] ?? v;
        const trend = v - pv > 0.5 ? '<span style="color:#4cff7c">▲</span>' : (v - pv < -0.5 ? '<span style="color:#ff5a5a">▼</span>' : '<span style="color:#556">•</span>');
        const col = v < 35 ? '#ff5a5a' : (v < 48 ? '#ffd24c' : '#4cff7c');
        return `<div class="fac-row"><span class="fac-name">${fd.icon} ${fd.name}</span>`
            + `<div class="fac-track"><div class="fac-fill" style="width:${v}%;background:${col}"></div></div>`
            + `<b class="fac-val" style="color:${col}">${Math.round(v)}</b>${trend}</div>`;
    }).join('');
    st._facPrev = Object.assign({}, st.factions);
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
