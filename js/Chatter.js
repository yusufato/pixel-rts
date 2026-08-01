// ═══════════════════════════════════════════════════════════════════════════
//  KOMUTANLAR ARASI SOHBET (PIXEL EUROPA — Faz-9)
//  ---------------------------------------------------------------------------
//  "İç sohbet komutanlar arası rastgele konuşma olmalı."
//  Bu dosya sabit senaryo şablonu DEĞİL, bir BİRLEŞİM üretecidir: konuşan çift,
//  konu, tavır ve cümle parçaları ayrı ayrı seçilir. 8 konu × 5 tavır × 4 kişilik
//  × değişken cümle parçaları → aynı iki cümleyi ezberlemek zorlaşır.
//
//  Konuşmalar DÜNYAYI DEĞİŞTİRİR: komutanlar arası BAĞ (cmd.bonds) kurulur,
//  sadakat kayar, hizipler doğar. Sen çoğunu haber olarak görürsün; yalnız
//  seni ilgilendiren ya da yönetici olarak müdahale edebileceğin anlarda
//  kapını çalar.
// ═══════════════════════════════════════════════════════════════════════════

// ── KOMUTANLAR ARASI BAĞ ───────────────────────────────────────────────────
// cmd.bonds[otherId] = -100..100  (düşmanlık ↔ yoldaşlık)
function cmdBond(a, b) {
    if (!a || !b) return 0;
    if (!a.bonds) a.bonds = {};
    return a.bonds[b.id] || 0;
}
function cmdBondAdd(a, b, d) {
    if (!a || !b || a === b) return 0;
    if (!a.bonds) a.bonds = {};
    if (!b.bonds) b.bonds = {};
    const v = Math.max(-100, Math.min(100, (a.bonds[b.id] || 0) + d));
    a.bonds[b.id] = v; b.bonds[a.id] = v;   // bağ karşılıklıdır
    return v;
}
function cmdBondLabel(v) {
    if (v >= 55) return { t: 'yoldaş', c: '#4cff7c' };
    if (v >= 20) return { t: 'yakın', c: '#9fd2ff' };
    if (v >= -20) return { t: 'mesafeli', c: '#cfd8d2' };
    if (v >= -55) return { t: 'gergin', c: '#ffd24c' };
    return { t: 'hasım', c: '#ff5a5a' };
}

// ── CÜMLE PARÇALARI ────────────────────────────────────────────────────────
const CH_OPEN = [
    'karargâh çadırında', 'akşam yemeğinde', 'cephe teftişinde', 'tren yolculuğunda',
    'harita başında', 'kışla avlusunda', 'operasyon merkezinde', 'sabah içtimasından sonra',
];
const CH_TONE = {
    agresif:    ['sertçe', 'masaya vurarak', 'küçümseyerek', 'sabırsızca'],
    dengeli:    ['ölçülü bir sesle', 'düşünerek', 'sakince', 'omuz silkerek'],
    'savunmacı':['temkinli', 'alçak sesle', 'kaşlarını çatarak', 'içini çekerek'],
    'fırsatçı': ['gülümseyerek', 'göz kırparak', 'kelimeleri seçerek', 'yan gözle bakarak'],
    oyuncu:     ['kısaca', 'net biçimde', 'düşünerek', 'sertçe'],
};
function chTone(c) { const a = CH_TONE[c && c.personality] || CH_TONE.dengeli; return a[storyRandomInt('narrative', a.length)]; }
function chPick(a) { return a[storyRandomInt('narrative', a.length)]; }

// ── KONULAR ────────────────────────────────────────────────────────────────
// each: when(ctx,a,b) · lines(ctx,a,b) → [A repliği, B repliği] · effect(ctx,a,b)
// Etki: bağ (bond), sadakat, bazen refah. Konu dünyadan beslenir.
const CH_TOPICS = [
    {
        id: 'front', w: 3,
        when: (c) => c.frontName,
        lines: (c, a, b) => [
            `${a.name} ${chTone(a)}: "${c.frontName} hattı çok ince. Bir taarruzda orayı kaybederiz."`,
            cmdBond(a, b) >= 0
                ? `${b.name}: "Katılıyorum. Konseye birlikte götürelim."`
                : `${b.name} ${chTone(b)}: "Sen kendi hattına bak. Benim bölgem sağlam."`,
        ],
        effect: (c, a, b) => cmdBond(a, b) >= 0
            ? { bond: 8, msg: 'cephe konusunda anlaştılar' }
            : { bond: -6, msg: 'cephe tartışması sertleşti' },
    },
    {
        id: 'law', w: 2.5,
        when: (c) => c.lawName,
        lines: (c, a, b) => [
            `${a.name} ${chTone(a)}: "«${c.lawName}» sahada işlemiyor. Kâğıt üstünde güzel, çamurda değil."`,
            (b.skills && b.skills.diplomat) >= 4
                ? `${b.name}: "Kanun kanundur. Konseyde değiştirmek varken söylenmenin anlamı yok."`
                : `${b.name} ${chTone(b)}: "Ben de aynısını düşünüyordum ama yüksek sesle söylemedim."`,
        ],
        effect: (c, a, b) => (b.skills && b.skills.diplomat) >= 4
            ? { bond: -5, loyA: -2, msg: 'kanun tartışmasında ters düştüler' }
            : { bond: 10, loyA: -3, loyB: -3, msg: 'kanundan ikisi de şikâyetçi' },
    },
    {
        id: 'rival-state', w: 2.5,
        when: (c) => c.rival,
        lines: (c, a, b) => [
            `${a.name}: "<span style="color:${c.rival.color}">${c.rival.name}</span> ile bu iş ${chPick(['er ya da geç', 'bu bahar', 'kışa kalmadan'])} kapışmaya varır."`,
            (a.personality === 'agresif' || b.personality === 'agresif')
                ? `${b.name} ${chTone(b)}: "Varsın varsın. Beklemek işimize gelmiyor."`
                : `${b.name} ${chTone(b)}: "Acele etme. Ordumuz iki cepheyi kaldırmaz."`,
        ],
        effect: (c, a, b) => (a.personality === 'agresif' && b.personality === 'agresif')
            ? { bond: 12, rel: -6, msg: `${c.rival.name} üzerine savaş dili sertleşti` }
            : { bond: 4, msg: `${c.rival.name} konuşuldu` },
    },
    {
        id: 'player', w: 2,
        when: () => true,
        lines: (c, a, b) => {
            const loy = (a.loyalty == null ? 60 : a.loyalty);
            return loy >= 65
                ? [`${a.name} ${chTone(a)}: "Komutanımız hakkında ne dersen de, bizi savaş meydanında yalnız bırakmadı."`,
                   `${b.name}: "${chPick(['Doğru.', 'Şimdilik.', 'Göreceğiz.'])} ${chPick(['Sadakat karşılıklıdır.', 'Ben sözüme sadığım.', 'Zaman gösterir.'])}"`]
                : [`${a.name} ${chTone(a)}: "Komutanımız bizi hiç dinlemiyor. Kararlar başkentte alınıyor, ölen biziz."`,
                   `${b.name} ${chTone(b)}: "${chPick(['Sesini alçalt.', 'Bunu duyan olursa fena olur.', 'Yanlış da sayılmazsın.'])}"`];
        },
        effect: (c, a, b) => ((a.loyalty == null ? 60 : a.loyalty) >= 65)
            ? { bond: 6, loyB: 3, msg: 'komutan hakkında iyi konuştular' }
            : { bond: 8, loyB: -4, msg: 'komutan hakkında söylendiler', notice: true },
    },
    {
        id: 'supply', w: 2,
        when: (c, a) => ((a.res && a.res.points) || 0) < 200,
        lines: (c, a, b) => [
            `${a.name} ${chTone(a)}: "Kasam boş. Ne bina ne birlik. Senin bölgenden bir şeyler kopar mı?"`,
            cmdBond(a, b) >= 20
                ? `${b.name}: "Ne lazımsa söyle, aramızda hesap mı var?"`
                : `${b.name} ${chTone(b)}: "Herkes kendi payına baksın. Ben de zor idare ediyorum."`,
        ],
        effect: (c, a, b) => {
            if (cmdBond(a, b) >= 20 && b.res && b.res.points > 150) {
                const st = storyState(a.st);
                if (typeof storyBudgetTransfer === 'function') {
                    const moved = storyBudgetTransfer(st, b, a, 120, 'commander.aid', {
                        correlationId: `chatter-aid:${b.id}:${a.id}`
                    });
                    if (!moved.ok) return { bond: -7, msg: 'ikmal yardımı karşılanamadı' };
                } else {
                    b.res.points -= 120; a.res.points = (a.res.points || 0) + 120;
                }
                return { bond: 10, msg: `${b.name}, ${a.name}'a 120⭐ yardım etti` };
            }
            return { bond: -7, msg: 'ikmal yardımı reddedildi' };
        },
    },
    {
        id: 'glory', w: 2,
        when: (c, a) => (a.victories || 0) > 0 || (a.skills && a.skills.warrior >= 4),
        lines: (c, a, b) => [
            `${a.name} ${chTone(a)}: "${chPick(['Son harekâtta', 'Geçen kışta', 'O kuşatmada'])} benim tümen olmasaydı hat çökerdi."`,
            (b.skills && b.skills.warrior) >= (a.skills && a.skills.warrior)
                ? `${b.name} ${chTone(b)}: "Tuhaf, ben oradaydım ve seni göremedim."`
                : `${b.name}: "Hakkını yemem, iyi iş çıkardın."`,
        ],
        effect: (c, a, b) => ((b.skills && b.skills.warrior) >= (a.skills && a.skills.warrior))
            ? { bond: -12, msg: 'övünme kavgaya döndü' }
            : { bond: 9, loyA: 2, msg: 'başarı takdir edildi' },
    },
    {
        id: 'welfare', w: 1.8,
        when: (c) => c.st.welfare < 45,
        lines: (c, a, b) => [
            `${a.name} ${chTone(a)}: "Köylerde ekmek yok. Askerin ailesi açsa o asker savaşmaz."`,
            `${b.name}: "${chPick(['Konsey bunu görmüyor.', 'Vergiyi hafifletmeliler.', 'Refah düşerse ordu dağılır.'])}"`,
        ],
        effect: (c, a, b) => ({ bond: 9, loyA: -2, loyB: -2, msg: 'halkın hâlinden dertlendiler', notice: true }),
    },
    {
        id: 'old-feud', w: 1.5,
        when: (c, a, b) => cmdBond(a, b) <= -30,
        lines: (c, a, b) => [
            `${a.name} ${chTone(a)}: "Seninle aynı masada oturmak zorunda olmasam otururmuydum sanıyorsun?"`,
            `${b.name} ${chTone(b)}: "${chPick(['Kapı orada.', 'Duygu karşılıklı.', 'Bir gün hesaplaşırız.'])}"`,
        ],
        effect: (c, a, b) => ({ bond: -10, loyA: -2, loyB: -2, msg: 'eski husumet alevlendi', notice: true }),
    },
];

// Konuların LLM'e verilecek DURUM açıklaması (birleşim üreteci kendi cümlesini
// yazar; model aynı durumu kendi diliyle yeniden yazsın diye bu ayrı tutulur).
const CH_TOPIC_DESC = {
    front:        'Cephe hattının çok ince olduğunu, bir taarruzda çökeceğini tartışıyorlar.',
    law:          'Yürürlükteki bir kanunun sahada işlemediğinden yakınıyorlar.',
    'rival-state':'Komşu düşman devletle savaşın kaçınılmaz olup olmadığını tartışıyorlar.',
    player:       'Kendi komutanları hakkında konuşuyorlar — biri savunuyor, diğeri kuşkulu.',
    supply:       'Biri kasasının boş olduğunu söylüyor, diğerinden yardım istiyor.',
    glory:        'Biri son harekâttaki payıyla övünüyor, diğeri bunu yalanlıyor.',
    welfare:      'Halkın açlığından ve ordunun moralinin bozukluğundan dertleniyorlar.',
    'old-feud':   'Eski bir husumet yüzünden birbirlerine sert konuşuyorlar.',
};

// ── ÜRETEÇ ─────────────────────────────────────────────────────────────────
const CHATTER_INTERVAL = 9;     // deneme aralığı (sn) — sohbetten daha sık, çünkü çoğu HABER
function storyChatterTick(dtSec) {
    if (!STORY.active || STORY._session) return;
    STORY._accChat = (STORY._accChat || 0) + dtSec;
    if (STORY._accChat < CHATTER_INTERVAL) return;
    STORY._accChat = 0;
    storyChatterRun();
}

function storyChatterRun() {
    if (!STORY.active || STORY._session) return;
    const me = storyPlayerState(); if (!me) return;
    const cmds = storyStateCommanders(me).filter(c => !c.isPlayer);
    if (cmds.length < 2) return;

    // konuşan çift: aynı şehirde ya da komşu şehirlerde olanlar daha olası
    const a = chPick(cmds);
    const near = cmds.filter(c => c !== a && (c.node === a.node
        || ((storyNode(a.node) || {}).neighbors || []).indexOf(c.node) >= 0));
    const b = near.length && storyRandom('narrative') < 0.75 ? chPick(near) : chPick(cmds.filter(c => c !== a));
    if (!b || a === b) return;

    // bağlam
    const myNodes = STORY.nodes.filter(n => n.owner === me.id);
    const frontNode = myNodes.find(n => (n.neighbors || []).some(id => {
        const q = storyNode(id); return q && q.owner !== me.id && storyIsHostile(me.id, q.owner);
    }));
    const lawKeys = Object.keys(me.laws || {});
    const lawK = lawKeys.length ? chPick(lawKeys) : null;
    const rivals = STORY.states.filter(s => s.id !== me.id && STORY.nodes.some(n => n.owner === s.id)
        && storyIsHostile(me.id, s.id));
    const ctx = {
        st: me,
        frontName: frontNode ? frontNode.name : null,
        lawName: lawK ? ((lawOption(lawK, me.laws[lawK]) || {}).name || null) : null,
        rival: rivals.length ? chPick(rivals) : null,
    };

    const cand = CH_TOPICS.filter(t => { try { return t.when(ctx, a, b); } catch (_) { return false; } });
    if (!cand.length) return;
    let tot = 0; const ws = cand.map(t => { tot += t.w; return t.w; });
    let r = storyRandom('narrative') * tot, topic = cand[0];
    for (let i = 0; i < cand.length; i++) { r -= ws[i]; if (r <= 0) { topic = cand[i]; break; } }

    let lines, eff;
    try { lines = topic.lines(ctx, a, b); eff = topic.effect(ctx, a, b) || {}; } catch (_) { return; }

    // etkileri uygula
    if (eff.bond) cmdBondAdd(a, b, eff.bond);
    // KİŞİLİK MOTORU (AŞAMA 1): eksen yakınlığı bağı sürükler — benzer görüşler
    // klikleşir, zıtlar her sohbette biraz soğur. Darbe koalisyonları böylece
    // rastgele değil KİŞİLİKTEN doğar (mesafe<22 → +1, mesafe>45 → −1).
    if (a.axes && b.axes) {
        const _ad = (Math.abs(a.axes.hawk - b.axes.hawk) + Math.abs(a.axes.auth - b.axes.auth)
                   + Math.abs(a.axes.pop - b.axes.pop) + Math.abs(a.axes.nat - b.axes.nat)) / 4;
        cmdBondAdd(a, b, _ad < 22 ? 1 : (_ad > 45 ? -1 : 0));
    }
    if (eff.loyA) a.loyalty = Math.max(0, Math.min(100, (a.loyalty == null ? 60 : a.loyalty) + eff.loyA));
    if (eff.loyB) b.loyalty = Math.max(0, Math.min(100, (b.loyalty == null ? 60 : b.loyalty) + eff.loyB));
    if (eff.rel && ctx.rival) storyRelAdd(me.id, ctx.rival.id, eff.rel);

    // kaydet: sohbet defteri (panelde okunur), en fazla 12 kayıt
    if (!STORY._chatter) STORY._chatter = [];
    STORY._chatter.unshift({
        t: Math.round(STORY.clock || 0), date: storyDateShort(),
        a: a.name, b: b.name, aId: a.id, bId: b.id, nodeId: a.node,
        topic: topic.id, lines, msg: eff.msg || '', bond: cmdBond(a, b),
        node: (storyNode(a.node) || {}).name || '—', where: chPick(CH_OPEN),
    });
    if (STORY._chatter.length > 12) STORY._chatter.length = 12;

    // LLM ZENGİNLEŞTİRMESİ (varsa): kayıt zaten oyuna girdi ve birleşim üreteciyle
    // yazıldı. Model yetişirse metni değiştirir, yetişmezse hiçbir şey olmaz.
    const _rec = STORY._chatter[0];
    const _me = STORY.commander;
    const _involves = _me && (a.id === _me.id || b.id === _me.id);
    const _here = _me && a.node === _me.node;
    // KULLANICI İSTEĞİ: duyabildiğin sohbet ANA KAYITTA da görünsün (takip edilebilir)
    if ((_involves || _here) && typeof storyLog === 'function' && _rec.lines && _rec.lines[0])
        storyLog(`👂 ${_involves ? '<b>Seninle</b> konuştu' : 'Kulağına çalındı'}: ${String(_rec.lines[0]).replace(/<[^>]+>/g, '').slice(0, 80)}${_rec.lines.length > 1 ? '…' : ''} <small>(05 SOHBET)</small>`);
    if (typeof llmEnrichChatter === 'function') {
        const desc = (CH_TOPIC_DESC[topic.id] || topic.id);
        // Oyuncunun KATILDIĞI sohbet uzun karşılıklı diyaloğa dönüşür (AŞAMA 4)
        if (_involves && typeof llmEnrichChatterLong === 'function') llmEnrichChatterLong(_rec, a, b, desc);
        else llmEnrichChatter(_rec, a, b, desc);
    }

    // dikkat çeken konuşmalar muharebe kaydına da düşer (hepsi değil — log taşmasın)
    if (eff.notice) storyLog(`👂 <b>${a.name}</b> ile <b>${b.name}</b>: ${eff.msg}`);
    if (typeof storyTalkBadge === 'function') storyTalkBadge();
}

// ── PANEL PARÇASI (SOHBET drawer'ında) ─────────────────────────────────────
function storyChatterHtml() {
    const all = STORY._chatter || [];
    const me = storyPlayerState();
    // KULLANICI İSTEĞİ: dedikodu her yerden duyulmaz — yalnız BULUNDUĞUN ŞEHİRDEKİ
    // konuşmalar ve SENİN katıldıkların görünür (uzaktakiler yaşamaya devam eder,
    // bağları yine değiştirir; sadece kulağına gelmez).
    const myId = STORY.commander ? STORY.commander.id : -1;
    const myNode = STORY.commander ? STORY.commander.node : -1;
    const myNodeName = (storyNode(myNode) || {}).name;
    const list = all.filter(c => c.aId === myId || c.bId === myId
        || c.nodeId === myNode || (c.nodeId == null && c.node === myNodeName));
    let html = `<div class="talk-sec"><div class="talk-h">👂 KOMUTANLAR ARASI <b>${list.length}</b>${all.length > list.length ? ` <small style="color:#667">(${all.length - list.length} uzakta)</small>` : ''}</div>`
        + `<div class="talk-note">Yalnız <b>bulunduğun şehirdeki</b> konuşmaları ve sana söylenenleri duyarsın. Uzak şehirlerdeki dedikodu yaşamaya devam eder — kulağına gelmez.</div>`;
    if (!list.length) html += `<div class="talk-note">Bu şehirde kulağına bir şey çalınmadı — komutanlarının olduğu bir şehre git.</div>`;
    for (const c of list) {
        const lab = cmdBondLabel(c.bond);
        html += `<div class="chat-card">`
            + `<div class="chat-h"><span>${c.date} · ${c.node} · ${c.where}</span>`
            + `<span style="color:${lab.c}">${lab.t}</span></div>`
            + c.lines.map(l => `<div class="chat-line">${l}</div>`).join('')
            + (c.msg ? `<div class="chat-msg">→ ${c.msg}</div>` : '')
            + `</div>`;
    }
    html += `</div>`;
    // hizip tablosu: kimler birbirine yakın
    if (me) {
        const cs = storyStateCommanders(me).filter(x => !x.isPlayer);
        const pairs = [];
        for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
            const v = cmdBond(cs[i], cs[j]);
            if (Math.abs(v) >= 25) pairs.push({ a: cs[i], b: cs[j], v });
        }
        pairs.sort((x, y) => Math.abs(y.v) - Math.abs(x.v));
        if (pairs.length) {
            html += `<div class="talk-sec"><div class="talk-h">🔗 HİZİPLER VE HUSUMETLER</div>`
                + `<div class="talk-note">Yakın komutanlar konseyde birlikte oy verme eğilimindedir.</div>`;
            for (const p of pairs.slice(0, 6)) {
                const lab = cmdBondLabel(p.v);
                html += `<div class="dip-row"><span class="dip-n">${p.a.name}</span>`
                    + `<span class="dip-t" style="color:${lab.c}">${p.v > 0 ? '🤝' : '⚡'}</span>`
                    + `<span class="dip-n">${p.b.name}</span>`
                    + `<span class="dip-v" style="color:${lab.c}">${lab.t}</span></div>`;
            }
            html += `</div>`;
        }
    }
    return html;
}
