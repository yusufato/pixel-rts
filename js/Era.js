// ═══════════════════════════════════════════════════════════════════════════
//  DÜNYA ÇAĞI (PIXEL EUROPA — Faz-10)
//  ---------------------------------------------------------------------------
//  "Kaos olan bir dünya, barış olan bir dünya, gri bir dünya..."
//
//  Dünyanın karakteri ANLATILAN değil, ÖLÇÜLEN bir şeydir. Bu dosya dünyanın
//  gerçek durumundan (savaş oranı, refah, çalkantı, sınır oynaklığı, teknoloji)
//  bir ÇAĞ türetir ve o çağ oyunu geri besler:
//     · AI saldırganlığı        (kaos çağında herkes daha atak)
//     · sohbet/kulis ağırlıkları (barışta ticaret, kaosta komplo konuşulur)
//     · konsey gündemi tonu
//  Böylece her kampanya kendi karakterini kazanır — LLM olmadan da.
//
//  LLM eklenince bu katman ONUN BAĞLAMI olur: model çağı bilir, sahneyi ona
//  göre yazar. Yani anlatı önce mekanikte var olur, LLM onu SÖZE döker.
//  Bu sıra önemli: LLM kapalıyken de dünya farklı farklı hikâyeler üretir.
// ═══════════════════════════════════════════════════════════════════════════

// ── ÖLÇÜMLER ───────────────────────────────────────────────────────────────
// Hepsi 0..1 aralığına normalize edilir; çağ sınıflandırması bunlara bakar.
function storyEraMetrics() {
    const live = STORY.states.filter(s => STORY.nodes.some(n => n.owner === s.id));
    const cl = v => Math.max(0, Math.min(1, v));
    if (live.length < 2) return { war: 0, welfare: 0.5, turmoil: 0, volatility: 0, tech: 0, live: live.length };

    // 1) SAVAŞ ORANI — komşu devlet çiftlerinin kaçı savaşta?
    let pairs = 0, wars = 0;
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        pairs++;
        if (typeof storyIsHostile === 'function' && storyIsHostile(live[i].id, live[j].id)) wars++;
    }
    const war = pairs ? wars / pairs : 0;

    // 2) REFAH — yaşayan devletlerin ortalaması
    const welfare = cl(live.reduce((a, s) => a + (s.welfare == null ? 50 : s.welfare), 0) / live.length / 100);

    // 3) ÇALKANTI — son dönemde darbe/firar/ahit bozma + düşük sadakat
    let loySum = 0, loyN = 0;
    for (const s of live) for (const c of storyStateCommanders(s)) { loySum += (c.loyalty == null ? 60 : c.loyalty); loyN++; }
    const avgLoy = loyN ? loySum / loyN : 60;
    const recent = (STORY._eraEvents || []).filter(e => (STORY.clock || 0) - e.t < 3 * YEAR_SECONDS).length;
    const turmoil = cl(((70 - avgLoy) / 70) * 0.65 + cl(recent / 6) * 0.35);

    // 4) OYNAKLIK — yılda kaç şehir el değiştiriyor
    const flips = (STORY._eraFlips || []).filter(t => (STORY.clock || 0) - t < 2 * YEAR_SECONDS).length;
    const volatility = cl(flips / 14);

    // 5) TEKNOLOJİ — ortalama tech / ağacın boyu
    const total = (typeof TECH_TREE !== 'undefined') ? TECH_TREE.techs.length : 42;
    const tech = cl(live.reduce((a, s) => a + ((s.tech || []).length), 0) / live.length / total);

    return { war, welfare, turmoil, volatility, tech, live: live.length };
}

// ── AYARLAMA (kalibrasyon) ─────────────────────────────────────────────────
// Ham ölçümler teorik olarak 0..1 ama GERÇEK oyunda dar bir bantta geziyor:
// 6 kampanya × 1200sn ölçümünde savaş 0.57-0.86, refah 0.46-0.64, çalkantı
// 0.13-0.34 çıktı. 0..1 varsayan puanlama bu yüzden ayırt edemiyordu ve
// dünyanın %79'u "GRİ ÇAĞ" oluyordu. Ölçümler gözlenen banda göre yeniden
// ölçeklenir → aynı fark artık çağları gerçekten ayırıyor.
// NOT: adı bilerek uzun. Tüm scriptler aynı window'u paylaşıyor; '_n' gibi genel bir
// küresel ad başka bir yerdeki değişkenle çarpışıp bu fonksiyonu eziyordu
// ("_n is not a function" → çağ sistemi çöküyordu).
function eraNorm(v, lo, hi) { return Math.max(0, Math.min(1, (v - lo) / (hi - lo))); }
function storyEraShape(m) {
    return {
        war:        eraNorm(m.war,        0.45, 0.95),
        welfare:    eraNorm(m.welfare,    0.30, 0.75),
        turmoil:    eraNorm(m.turmoil,    0.05, 0.45),
        volatility: eraNorm(m.volatility, 0.00, 0.80),
        tech:       eraNorm(m.tech,       0.00, 0.50),
    };
}

// ── ÇAĞLAR ─────────────────────────────────────────────────────────────────
// score(m): 0..1 — ölçümlere ne kadar uyuyor. En yüksek puanlı çağ seçilir.
// (m artık storyEraShape'ten geçmiş, kalibre edilmiş değerlerdir.)
const ERAS = [
    {
        id: 'chaos', name: 'KAOS ÇAĞI', icon: '🔥', color: '#ff5a5a',
        desc: 'Devletler parçalanıyor, komutanlar ayaklanıyor, kimse kimsenin ahdine güvenmiyor.',
        score: m => m.war * 0.35 + m.turmoil * 0.4 + (1 - m.welfare) * 0.25,
        effects: { aggression: 1.35, plotWeight: 2.2, tradeWeight: 0.4, welfareDrift: -0.02 },
    },
    {
        id: 'fire', name: 'ATEŞ ÇAĞI', icon: '⚔️', color: '#ff9a4c',
        desc: 'Cepheler durmadan kayıyor. Ordular büyük, barış kısa, haritalar sık çiziliyor.',
        score: m => m.war * 0.45 + m.volatility * 0.4 + m.welfare * 0.15,
        effects: { aggression: 1.25, plotWeight: 1.2, tradeWeight: 0.7, welfareDrift: -0.01 },
    },
    {
        id: 'cold', name: 'SOĞUK DENGE', icon: '🧊', color: '#9fd2ff',
        desc: 'Silahlar susuyor ama kimse rahat değil. Antlaşmalar imzalanıyor, güven imzalanmıyor.',
        score: m => (1 - m.war) * 0.4 + (1 - m.volatility) * 0.3 + (1 - Math.abs(m.welfare - 0.5) * 2) * 0.3,
        effects: { aggression: 0.85, plotWeight: 1.5, tradeWeight: 1.3, welfareDrift: 0 },
    },
    {
        id: 'peace', name: 'UZUN BARIŞ', icon: '🕊️', color: '#4cff7c',
        desc: 'Sınırlar donmuş, kasalar dolu. Kimse ilk kurşunu atmak istemiyor.',
        score: m => (1 - m.war) * 0.45 + m.welfare * 0.4 + (1 - m.turmoil) * 0.15,
        effects: { aggression: 0.7, plotWeight: 0.6, tradeWeight: 1.8, welfareDrift: 0.02 },
    },
    {
        id: 'golden', name: 'ALTIN ÇAĞ', icon: '👑', color: '#ffd24c',
        desc: 'Zenginlik ve bilim aynı anda yükseliyor. Tarihçiler bu yılları özleyerek yazacak.',
        score: m => m.welfare * 0.4 + m.tech * 0.4 + (1 - m.turmoil) * 0.2,
        effects: { aggression: 0.9, plotWeight: 0.8, tradeWeight: 1.5, welfareDrift: 0.015 },
    },
    {
        id: 'gray', name: 'GRİ ÇAĞ', icon: '🌫️', color: '#cfd8d2',
        desc: 'Ne savaş ne barış. Hiçbir şey olmuyor ve herkes bir şeyin olmasını bekliyor.',
        score: m => 0.30 + (1 - Math.abs(m.war - 0.5) * 2) * 0.22 + (1 - Math.abs(m.welfare - 0.5) * 2) * 0.22,
        effects: { aggression: 1.0, plotWeight: 1.0, tradeWeight: 1.0, welfareDrift: 0 },
    },
];
const ERA_BY_ID = {}; ERAS.forEach(e => { ERA_BY_ID[e.id] = e; });

// Çağ HEMEN değişmez: yeni aday belirgin biçimde öndeyse ve bir süre öyle kaldıysa geçilir.
// (Aksi hâlde etiket her tick'te titrer ve "çağ" hissi kaybolur.)
const ERA_SWITCH_MARGIN = 0.06;    // aday, mevcut çağı bu kadar geçmeli
const ERA_SWITCH_HOLD = 45;        // ve bu kadar saniye önde kalmalı

function storyEraEval() {
    const raw = storyEraMetrics();
    const m = storyEraShape(raw);          // kalibre edilmiş: puanlama bunun üstünden
    let best = ERAS[0], bestS = -Infinity;
    for (const e of ERAS) { const s = e.score(m); if (s > bestS) { bestS = s; best = e; } }
    return { era: best, score: bestS, metrics: raw, shape: m };
}
function storyEra() {
    if (!STORY._era) {
        const r = storyEraEval();
        STORY._era = { id: r.era.id, since: STORY.clock || 0, cand: null, candSince: 0 };
    }
    return ERA_BY_ID[STORY._era.id] || ERA_BY_ID.gray;
}
function storyEraEffects() { return (storyEra() || {}).effects || ERA_BY_ID.gray.effects; }

function storyEraTick() {
    const r = storyEraEval();
    if (!STORY._era) { STORY._era = { id: r.era.id, since: STORY.clock || 0, cand: null, candSince: 0 }; return; }
    const cur = ERA_BY_ID[STORY._era.id] || ERA_BY_ID.gray;
    const curS = cur.score(r.shape);
    STORY._eraMetrics = r.metrics;

    if (r.era.id === STORY._era.id || r.score < curS + ERA_SWITCH_MARGIN) {
        STORY._era.cand = null; STORY._era.candSince = 0;
        return;
    }
    if (STORY._era.cand !== r.era.id) { STORY._era.cand = r.era.id; STORY._era.candSince = STORY.clock || 0; return; }
    if ((STORY.clock || 0) - STORY._era.candSince < ERA_SWITCH_HOLD) return;

    const old = cur;
    STORY._era = { id: r.era.id, since: STORY.clock || 0, cand: null, candSince: 0 };
    if (typeof storyLog === 'function')
        storyLog(`🌍 <b>ÇAĞ DEĞİŞTİ</b> — ${old.icon} ${old.name} bitti, <span style="color:${r.era.color}">${r.era.icon} ${r.era.name}</span> başladı.`);
}

// ── OLAY KAYDI (ölçümleri besler) ──────────────────────────────────────────
// Darbe/firar/ahit bozma gibi sarsıcı olaylar buraya düşer; çalkantı ölçümü okur.
function storyEraEvent(kind) {
    if (!STORY._eraEvents) STORY._eraEvents = [];
    STORY._eraEvents.push({ t: STORY.clock || 0, kind });
    if (STORY._eraEvents.length > 40) STORY._eraEvents.splice(0, STORY._eraEvents.length - 40);
}
// Şehir el değiştirdi — oynaklık ölçümü okur.
function storyEraFlip() {
    if (!STORY._eraFlips) STORY._eraFlips = [];
    STORY._eraFlips.push(STORY.clock || 0);
    if (STORY._eraFlips.length > 60) STORY._eraFlips.splice(0, STORY._eraFlips.length - 60);
}

// ── PANEL PARÇASI ──────────────────────────────────────────────────────────
function storyEraHtml() {
    const e = storyEra();
    const m = STORY._eraMetrics || storyEraMetrics();
    const yrs = ((STORY.clock || 0) - ((STORY._era && STORY._era.since) || 0)) / YEAR_SECONDS;
    const bar = (label, v, col) => `<div class="era-bar"><span>${label}</span>`
        + `<i><b style="width:${Math.round(v * 100)}%;background:${col}"></b></i></div>`;
    return `<div class="talk-sec"><div class="talk-h">🌍 DÜNYANIN HÂLİ</div>`
        + `<div class="era-card" style="border-left-color:${e.color}">`
        + `<div class="era-name" style="color:${e.color}">${e.icon} ${e.name}</div>`
        + `<div class="era-desc">${e.desc}</div>`
        + `<div class="era-since">${yrs.toFixed(1)} yıldır sürüyor</div>`
        + bar('Savaş', m.war, '#ff5a5a')
        + bar('Refah', m.welfare, '#4cff7c')
        + bar('Çalkantı', m.turmoil, '#ffd24c')
        + bar('Oynaklık', m.volatility, '#ff9a4c')
        + bar('Teknoloji', m.tech, '#9fd2ff')
        + `</div></div>`;
}
