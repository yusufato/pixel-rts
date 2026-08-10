// ═══════════════════════════════════════════════════════════════════════════
//  SOHBET & DİPLOMASİ (PIXEL EUROPA — Faz-6)
//  ---------------------------------------------------------------------------
//  Dünyayı canlı ve beklenmedik kılan katman. Üç tür konuşma:
//    · İÇ SOHBET  — kendi komutanın sana gelir (talep, şikâyet, yemin, tehdit)
//    · KULİS      — komutanlar KENDİ ARALARINDA konuşur; sen kulağına çalınanı
//                   öğrenirsin (ittifaklar, dedikodu, komplo)
//    · DIŞ TEMAS  — yabancı devletin elçisi gelir → DİPLOMASİ buradan yürür
//                   (ateşkes, pakt, ittifak, haraç, ortak savaş, ihanet)
//
//  Diplomasi ayrı bir "ilişki paneli" değildir: ilişkiler bu konuşmalarla
//  değişir. Antlaşma da bir konuşmanın sonucudur.
// ═══════════════════════════════════════════════════════════════════════════

// ── DİPLOMASİ ZEMİNİ ────────────────────────────────────────────────────────
// Antlaşma katmanı. Modern dünya başlangıcında devletler barıştadır; savaş,
// kriz/ilişki bozulması ve açık bir savaş ilanı sonucu başlamalıdır.
const TREATIES = {
    war:      { name: 'Savaş',            icon: '⚔️', hostile: true,  color: '#ff5a5a' },
    peace:    { name: 'Barış',             icon: '🕊️', hostile: false, color: '#cfd8d2' },
    truce:    { name: 'Ateşkes',          icon: '🤍', hostile: false, color: '#ffd24c' },
    pact:     { name: 'Saldırmazlık',     icon: '📜', hostile: false, color: '#9fd2ff' },
    alliance: { name: 'İttifak',          icon: '🤝', hostile: false, color: '#4cff7c' },
};
const TRUCE_YEARS = 3;                 // ateşkes süresi (yıl)
function storyRelKey(a, b) { return Math.min(a, b) + '|' + Math.max(a, b); }
function storyInitialTreaty() {
    return (typeof storyFeatureEnabled === 'function' && storyFeatureEnabled('diplomacy.peacefulStart'))
        ? 'peace'
        : 'war';
}
function storyInitializeDiplomacy() {
    STORY.rel = {};
    const treaty = storyInitialTreaty();
    const states = Array.isArray(STORY.states) ? STORY.states : [];
    for (let i = 0; i < states.length; i++) {
        for (let j = i + 1; j < states.length; j++) {
            STORY.rel[storyRelKey(states[i].id, states[j].id)] = {
                v: 0,
                treaty,
                until: 0,
                since: 0,
                reason: 'campaign_start'
            };
        }
    }
    return Object.keys(STORY.rel).length;
}
function storyRel(a, b) {
    if (a === b) return null;
    if (!STORY.rel) STORY.rel = {};
    const k = storyRelKey(a, b);
    return STORY.rel[k] || (STORY.rel[k] = {
        v: 0,
        treaty: storyInitialTreaty(),
        until: 0,
        since: STORY.clock || 0,
        reason: 'lazy_backfill'
    });
}
function storyRelValue(a, b) { const r = storyRel(a, b); return r ? r.v : 0; }
function storyRelAdd(a, b, d, meta) {
    const r = storyRel(a, b); if (!r) return 0;
    meta = meta || {};
    const before = Number(r.v) || 0;
    const after = Math.max(-100, Math.min(100, before + (Number(d) || 0)));
    if (typeof storyCausalityRun !== 'function') { r.v = after; return r.v; }
    const receipt = storyCausalityRun({
        type: 'diplomacy.relation_adjust',
        eventType: 'diplomacy.relation_changed',
        actor: meta.actor || { type: 'state', id: a },
        target: { type: 'relation', id: storyRelKey(a, b) },
        payload: { stateA: a, stateB: b, delta: after - before, reason: meta.reason || 'diplomacy' },
        idempotencyKey: meta.idempotencyKey,
        correlationId: meta.correlationId || null
    }, () => {
        storyCausalitySet(r, 'v', after, {
            target: { type: 'relation', id: storyRelKey(a, b) },
            path: `relation:${storyRelKey(a, b)}.value`,
            source: meta.reason || 'diplomacy'
        });
        return after;
    });
    return receipt.duplicate ? before : receipt.result;
}
function storyTreaty(a, b) {
    const r = storyRel(a, b); if (!r) return 'alliance';
    if (r.treaty === 'truce' && (STORY.clock || 0) > (r.until || 0)) {
        storySetTreaty(a, b, storyInitialTreaty(), 0, { reason: 'truce.expired', silent: true });
    }   // ateşkes bitişi otomatik savaş ilanı değildir
    return r.treaty;
}
function storySetTreaty(a, b, t, years, meta) {
    const r = storyRel(a, b); if (!r) return;
    if (!Object.prototype.hasOwnProperty.call(TREATIES, t)) return;
    meta = meta || {};
    const prev = r.treaty;
    const until = years ? (STORY.clock || 0) + years * YEAR_SECONDS : 0;
    if (typeof storyCausalityRun === 'function') {
        const receipt = storyCausalityRun({
            type: 'diplomacy.treaty_set',
            eventType: 'diplomacy.treaty_changed',
            actor: meta.actor || { type: 'state', id: a },
            target: { type: 'relation', id: storyRelKey(a, b) },
            payload: {
                stateA: a,
                stateB: b,
                fromTreaty: prev,
                toTreaty: t,
                until,
                reason: meta.reason || 'diplomacy'
            },
            idempotencyKey: meta.idempotencyKey,
            correlationId: meta.correlationId || null
        }, () => {
            storyCausalitySet(r, 'treaty', t, {
                target: { type: 'relation', id: storyRelKey(a, b) },
                path: `relation:${storyRelKey(a, b)}.treaty`,
                source: meta.reason || 'diplomacy'
            });
            storyCausalitySet(r, 'until', until, {
                target: { type: 'relation', id: storyRelKey(a, b) },
                path: `relation:${storyRelKey(a, b)}.until`,
                source: meta.reason || 'diplomacy'
            });
            storyCausalitySet(r, 'since', STORY.clock || 0, {
                target: { type: 'relation', id: storyRelKey(a, b) },
                path: `relation:${storyRelKey(a, b)}.since`,
                source: meta.reason || 'diplomacy'
            });
            r.reason = meta.reason || 'diplomacy';
            return t;
        });
        if (receipt.duplicate) return receipt.result;
    } else {
        r.treaty = t;
        r.until = until;
        r.since = STORY.clock || 0;
        r.reason = meta.reason || 'diplomacy';
    }
    // AŞAMA 4: savaş ilanı ve barış manşetlik (oyuncu taraflıysa hep, değilse %30)
    if (!meta.silent && typeof storyNews === 'function' && prev !== t) {
        const A = storyState(a), B = storyState(b);
        const pid = STORY.playerStateId;
        const rel = (a === pid || b === pid) || storyRandom('diplomacy') < 0.3;
        if (A && B && rel) {
            if (t === 'war' && prev !== 'war') storyNews('treatyWar', { a: A.name, b: B.name });
            else if (prev === 'war' && t !== 'war') storyNews('treatyPeace', { a: A.name, b: B.name, kind: (typeof TREATIES !== 'undefined' && TREATIES[t]) ? TREATIES[t].name : t });
        }
    }
}
// AI hedeflemesinin sorduğu tek soru: buraya saldırabilir miyim?
function storyIsHostile(a, b) {
    if (a === b) return false;
    if (a == null || b == null) return true;
    return !!(TREATIES[storyTreaty(a, b)] || TREATIES.war).hostile;
}
// Antlaşmayı bozmak: ilişki çöker, dünyaya duyurulur (itibar meselesi)
function storyBreakTreaty(a, b, whoBroke) {
    const t = storyTreaty(a, b);
    if (t === 'war') return false;
    if (typeof storyCausalityRun !== 'function') {
        storySetTreaty(a, b, 'war', 0);
        storyRelAdd(a, b, -45);
        const A = storyState(whoBroke), B = storyState(whoBroke === a ? b : a);
        if (A && B) storyLog(`💥 <span style="color:${A.color}">${A.name}</span> antlaşmayı bozdu — <span style="color:${B.color}">${B.name}</span> ile yeniden SAVAŞ.`);
        for (const st of STORY.states) if (st.id !== whoBroke) storyRelAdd(whoBroke, st.id, -8);
        return true;
    }
    return !!storyCausalityRun({
        type: 'diplomacy.break_treaty',
        eventType: 'diplomacy.treaty_broken',
        actor: { type: 'state', id: whoBroke },
        target: { type: 'relation', id: storyRelKey(a, b) },
        payload: { stateA: a, stateB: b, previousTreaty: t }
    }, () => {
        storySetTreaty(a, b, 'war', 0, { actor: { type: 'state', id: whoBroke }, reason: 'treaty.broken' });
        storyRelAdd(a, b, -45, { actor: { type: 'state', id: whoBroke }, reason: 'treaty.broken' });
        const A = storyState(whoBroke), B = storyState(whoBroke === a ? b : a);
        if (A && B) storyLog(`💥 <span style="color:${A.color}">${A.name}</span> antlaşmayı bozdu — <span style="color:${B.color}">${B.name}</span> ile yeniden SAVAŞ.`);
        // dünyanın geri kalanı ahdine sadakatsizliği görür
        for (const st of STORY.states) if (st.id !== whoBroke) {
            storyRelAdd(whoBroke, st.id, -8, { actor: { type: 'state', id: whoBroke }, reason: 'treaty.reputation_cost' });
        }
        return true;
    }).result;
}
function storyStatesShareBorder(a, b) {
    return STORY.nodes.some(node => node.owner === a && node.neighbors.some(id => {
        const neighbor = storyNode(id);
        return neighbor && neighbor.owner === b;
    }));
}
function storyRelLabel(v) {
    if (v >= 60) return { t: 'Kardeş', c: '#4cff7c' };
    if (v >= 25) return { t: 'Dost', c: '#9fd2ff' };
    if (v >= -10) return { t: 'Mesafeli', c: '#cfd8d2' };
    if (v >= -45) return { t: 'Gergin', c: '#ffd24c' };
    return { t: 'Düşman', c: '#ff5a5a' };
}

// ── SOHBET MOTORU ───────────────────────────────────────────────────────────
const TALK_MAX_QUEUE = 6;              // kuyrukta en çok bu kadar bekler (spam olmasın)
const TALK_EXPIRE = 150;               // cevaplanmayan konuşma bu sürede düşer (sn)
const TALK_INTERVAL = 14;              // deneme aralığı (sn)

function _talkHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
function talkPick(arr) {
    if (!arr || !arr.length) return undefined;
    const trace = STORY._talkPickTrace;
    const rolledIndex = storyRandomInt('diplomacy', arr.length);
    if (trace && trace.mode === 'replay') {
        const token = trace.picks[trace.index++];
        if (token) {
            if (token.kind === 'id') {
                const found = arr.find(item => item && typeof item === 'object' && item.id === token.value);
                if (found) return found;
            } else if (token.kind === 'value') {
                const found = arr.find(item => item === token.value);
                if (found !== undefined) return found;
            } else if (Number.isInteger(token.index) && arr[token.index] !== undefined) {
                return arr[token.index];
            }
        }
    }
    const picked = arr[rolledIndex];
    if (trace && trace.mode === 'record') {
        trace.picks.push(
            picked && typeof picked === 'object' && picked.id != null
                ? { kind: 'id', value: picked.id, index: rolledIndex }
                : { kind: 'value', value: picked, index: rolledIndex }
        );
    }
    return picked;
}
function talkCmdName(c) { return c ? c.name : 'Bir komutan'; }
function talkLoy(c) { return c && c.loyalty != null ? c.loyalty : 60; }
// FAZ-7 'Hami' yeteneği: sohbetlerde SADAKAT KAZANIMLARI çarpanı (kayıplara dokunmaz).
// Şablonlar Math.min(100, talkLoy(x) + N) yazdığı için artışı tek noktadan ölçeklemek
// yerine yardımcı veriyoruz; kullanan şablonlar talkGain() üzerinden geçer.
function talkGain(n) {
    const m = (typeof cmdrBonus === 'function' && typeof STORY !== 'undefined') ? cmdrBonus(STORY.commander).talkLoyMul : 1;
    return Math.round(n * (m || 1));
}

// Konuşma bağlamı: motor bunu şablonlara verir
function storyTalkContext() {
    const me = storyPlayerState(); if (!me) return null;
    const mine = storyPlayerCommanders().filter(c => !c.isPlayer);
    const myNodes = STORY.nodes.filter(n => n.owner === me.id);
    // komşu devletler (sınırı olan)
    const neighborIds = {};
    for (const n of myNodes) for (const id of (n.neighbors || [])) {
        const q = storyNode(id);
        if (q && q.owner != null && q.owner !== me.id) neighborIds[q.owner] = 1;
    }
    const neighbors = Object.keys(neighborIds).map(id => storyState(+id)).filter(s => s && storyStateCommanders(s).length);
    return { me, mine, myNodes, neighbors, cmd: STORY.commander };
}

// ── ŞABLONLAR ───────────────────────────────────────────────────────────────
// Her şablon: when(ctx) uygunluk · weight(ctx) ağırlık · build(ctx) → {who, lines, options}
// Seçenek: { text, tip, run(t) } — run gerçek etkiyi uygular, kısa özet döner.
const TALK_TEMPLATES = [

    // ══════════ İÇ SOHBET — kendi komutanların ══════════
    {
        id: 'need-army', audience: 'player', kind: 'internal',
        when: c => c.mine.some(x => cmdArmyCount(x) === 0),
        weight: () => 3,
        build: c => {
            const who = talkPick(c.mine.filter(x => cmdArmyCount(x) === 0));
            const nd = storyNode(who.node);
            return { who, lines: [
                `${who.name}: "Efendim, ${nd ? nd.name : 'mevkiimde'} elimde tek er yok.`,
                `Depolar boş, cephe iki günlük yürüyüş mesafesinde. Ya bana birlik verin ya beni geri çekin."`,
            ], options: [
                { text: 'Kasandan 200 insan gücü gönder', tip: 'Sadakat +12 · sana 200👥 mal olur',
                  run: t => { const w = STORY.commander.res; if ((w.manpower || 0) < 200) return { fail: 'Kasanda yeterli insan gücü yok.' };
                      w.manpower -= 200; who.res.manpower = (who.res.manpower || 0) + 200; who.loyalty = Math.min(100, talkLoy(who) + talkGain(12));
                      return { msg: `${who.name} takviyeyi aldı (sadakat +12).` }; } },
                { text: '"Kendi başının çaresine bak."', tip: 'Sadakat −10 · bedava',
                  run: t => { who.loyalty = Math.max(0, talkLoy(who) - 10); return { msg: `${who.name} küstü (sadakat −10).` }; } },
                { text: '"Geri çekil, hattı kısaltıyoruz."', tip: 'Sadakat +4 · komutan başkente döner',
                  run: t => { const cap = (STORY._capitals || [])[c.me.id]; if (cap != null) who.node = cap;
                      who.loyalty = Math.min(100, talkLoy(who) + talkGain(4)); return { msg: `${who.name} başkente çekildi.` }; } },
            ] };
        }
    },
    {
        id: 'law-complaint', audience: 'player', kind: 'internal',
        when: c => c.mine.length > 0 && Object.keys(c.me.laws || {}).length > 0,
        weight: () => 2,
        build: c => {
            const who = talkPick(c.mine);
            const keys = Object.keys(c.me.laws);
            const k = talkPick(keys), o = lawOption(k, c.me.laws[k]);
            const slot = LAW_SLOT_BY_KEY[k];
            return { who, lines: [
                `${who.name}: "${slot ? slot.name : 'Bu kanun'} yüzünden birliklerim homurdanıyor.`,
                `«${o ? o.name : '—'}» sahada işlemiyor efendim. Konseyde bunu savunacak mısınız?"`,
            ], options: [
                { text: '"Haklısın, gelecek konseyde değiştireceğim."', tip: 'Sadakat +8 · söz veriyorsun',
                  run: t => { who.loyalty = Math.min(100, talkLoy(who) + talkGain(8)); STORY._promises = (STORY._promises || 0) + 1;
                      return { msg: `${who.name}'a söz verdin (sadakat +8).` }; } },
                { text: '"Kanun kanundur. Uygula."', tip: 'Sadakat −6 · refah +2 (otorite)',
                  run: t => { who.loyalty = Math.max(0, talkLoy(who) - 6); c.me.welfare = Math.min(100, c.me.welfare + 2);
                      return { msg: `Otoriteni gösterdin (refah +2, sadakat −6).` }; } },
                { text: '"Ne öneriyorsun?" (dinle)', tip: 'Sadakat +4 · onun eğilimini öğrenirsin',
                  run: t => { who.loyalty = Math.min(100, talkLoy(who) + talkGain(4));
                      const sk = who.skills || {};
                      const lean = sk.warrior >= sk.economist && sk.warrior >= sk.diplomat ? 'ordu ve tahkimat'
                                 : sk.economist >= sk.diplomat ? 'sanayi ve gelir' : 'halkın refahı';
                      return { msg: `${who.name} <b>${lean}</b> yanlısı çıktı (sadakat +4).` }; } },
            ] };
        }
    },
    {
        id: 'oath', audience: 'player', kind: 'internal',
        when: c => c.mine.some(x => talkLoy(x) >= 80),
        weight: () => 1.4,
        build: c => {
            const who = talkPick(c.mine.filter(x => talkLoy(x) >= 80));
            return { who, lines: [
                `${who.name}: "Efendim, şunu bilin isterim:`,
                `bu konseyde kim ne çevirirse çevirsin, benim kılıcım sizindir."`,
            ], options: [
                { text: '"Bunu unutmayacağım." (kabul)', tip: 'Sadakat +6 · ittifak kurulur',
                  run: t => { who.loyalty = Math.min(100, talkLoy(who) + talkGain(6)); who._sworn = true;
                      return { msg: `${who.name} sana <b>yeminli</b> — darbe girişimlerinde yanında.` }; } },
                { text: '"Sadakat sözle değil, sahada ölçülür."', tip: 'Sadakat −3 · ama saygı',
                  run: t => { who.loyalty = Math.max(0, talkLoy(who) - 3); return { msg: `${who.name} sessizce selam verdi.` }; } },
            ] };
        }
    },
    {
        id: 'ultimatum', audience: 'player', kind: 'internal',
        when: c => c.mine.some(x => talkLoy(x) < 38),
        weight: () => 3.5,
        build: c => {
            const who = talkPick(c.mine.filter(x => talkLoy(x) < 38));
            return { who, lines: [
                `${who.name}: "Açık konuşayım. Bu devlette adalet kalmadı.`,
                `Bana bir şehir verin ya da yolumuza ayrı devam edelim. Ordum benimle gelir."`,
            ], options: [
                { text: 'Bir şehrin valiliğini ver', tip: 'Sadakat +30 · o şehrin geliri ona akar',
                  run: t => { who.loyalty = Math.min(100, talkLoy(who) + talkGain(30)); who._governor = who.node;
                      const nd = storyNode(who.node);
                      return { msg: `${nd ? nd.name : 'Şehir'} valiliği ${who.name}'a verildi (sadakat +30).` }; } },
                { text: 'Kasandan rüşvet ver (300⭐)', tip: 'Sadakat +18 · 300⭐',
                  run: t => { const w = STORY.commander.res; if ((w.points || 0) < 300) return { fail: '⭐ Puanın yetmiyor.' };
                      if (typeof storyBudgetTransfer === 'function') {
                          const moved = storyBudgetTransfer(c.me, STORY.commander, who, 300, 'political.bribe', {
                              correlationId: `talk-bribe:${who.id}`
                          });
                          if (!moved.ok) return { fail: '⭐ Puanın yetmiyor.' };
                          const debtorActorId = t.speakerActorId || storyTalkCanonicalActorId(who);
                          const creditorActorId = `character:${STORY.playerStateId | 0}:${STORY.commander.id}`;
                          if (debtorActorId && typeof storyRelationshipAdjust === 'function') {
                              storyRelationshipAdjust(debtorActorId, creditorActorId, { debtBps: 2500 }, {
                                  source: 'talk.ultimatum.bribe', reason: 'PAID_POLITICAL_CONCESSION',
                                  sourceReceiptId: moved.transaction && moved.transaction.id,
                                  talkUid: t.uid, talkTemplateId: t.tpl,
                                  debtSummary: `${who.name}, 300⭐ siyasi ödeme karşılığında oyuncuya açık bir yükümlülük altına girdi.`
                              });
                          }
                      } else { w.points -= 300; who.res.points = (who.res.points || 0) + 300; }
                      who.loyalty = Math.min(100, talkLoy(who) + talkGain(18));
                      return { msg: `${who.name} sustu (sadakat +18, −300⭐).` }; } },
                { text: '"Git o zaman." (meydan oku)', tip: 'Firar riski · diğerlerine gözdağı',
                  run: t => { const others = c.mine.filter(x => x !== who);
                      for (const o of others) o.loyalty = Math.min(100, talkLoy(o) + talkGain(3));
                      who.loyalty = Math.max(0, talkLoy(who) - 15);
                      return { msg: `Meydan okudun — ${who.name} kudurdu, diğerleri hizaya geldi (+3).` }; } },
            ] };
        }
    },
    {
        id: 'front-warning', audience: 'player', kind: 'internal',
        when: c => c.neighbors.length > 0 && c.mine.length > 0,
        weight: () => 2,
        build: c => {
            const who = talkPick(c.mine);
            const foe = talkPick(c.neighbors);
            return { who, lines: [
                `${who.name}: "Keşif kollarım döndü efendim.`,
                `<span style="color:${foe.color}">${foe.name}</span> sınırda kuvvet yığıyor. Hazırlıklı olmalıyız."`,
            ], options: [
                { text: 'Cepheyi tahkim et (150👥)', tip: 'Sınır şehirlerine garnizon',
                  run: t => { const w = STORY.commander.res; if ((w.manpower || 0) < 150) return { fail: 'İnsan gücün yetmiyor.' };
                      w.manpower -= 150;
                      const front = c.myNodes.filter(n => (n.neighbors || []).some(id => { const q = storyNode(id); return q && q.owner === foe.id; }));
                      let g = 0; for (const n of front.slice(0, 2)) { n.garrison = Math.min(storyCityGarrisonCap(n), (n.garrison | 0) + 1); g++; }
                      return { msg: `${g} sınır şehri tahkim edildi (−150👥).` }; } },
                { text: 'Elçi gönder, niyetini öğren', tip: `İlişki +6 · ${foe.name} ile temas`,
                  run: t => { storyRelAdd(c.me.id, foe.id, 6);
                      return { msg: `<span style="color:${foe.color}">${foe.name}</span> ile temas kuruldu (ilişki +6).` }; } },
                { text: '"Bırak yığsın." (umursama)', tip: 'Bedava · risk sende',
                  run: t => ({ msg: 'Uyarı kayda geçti.' }) },
            ] };
        }
    },
    {
        id: 'broke', audience: 'admin', kind: 'internal',
        when: c => c.mine.some(x => ((x.res && x.res.points) || 0) < 60),
        weight: () => 1.8,
        build: c => {
            const who = talkPick(c.mine.filter(x => ((x.res && x.res.points) || 0) < 60));
            return { who, lines: [
                `${who.name}: "Kasam boş efendim. Ne bina kurabiliyorum ne birlik basabiliyorum.`,
                `Bölgemin geliri konseyde eriyor."`,
            ], options: [
                { text: 'Devlet hazinesinden fon aktar', tip: 'Diğer komutanlardan 250⭐ toplanır',
                  run: t => { const funded = typeof storyBudgetFundCommander === 'function'
                          ? storyBudgetFundCommander(c.me, who, 250, 'commander.funding', { correlationId: `talk-fund:${who.id}` })
                          : null;
                      if (funded ? !funded.ok : !storyCouncilPayFromState(c.me, { points: 250 })) return { fail: 'Devlet hazinesi yetersiz.' };
                      if (!funded) who.res.points = (who.res.points || 0) + 250;
                      who.loyalty = Math.min(100, talkLoy(who) + talkGain(9));
                      return { msg: `${who.name}'a 250⭐ aktarıldı (sadakat +9).` }; } },
                { text: '"Kendi bölgeni kendin kalkındır."', tip: 'Sadakat −7',
                  run: t => { who.loyalty = Math.max(0, talkLoy(who) - 7); return { msg: `${who.name} eli boş döndü (sadakat −7).` }; } },
            ] };
        }
    },

    // ══════════ KULİS — komutanlar kendi aralarında ══════════
    {
        id: 'clique', audience: 'player', kind: 'clique',
        when: c => c.mine.length >= 2,
        weight: () => (2 + ((typeof cmdrBonus === 'function' ? cmdrBonus(STORY.commander).intrigue : 0) * 2))
                     * ((typeof storyEraEffects === 'function') ? storyEraEffects().plotWeight : 1),
        build: c => {
            const a = talkPick(c.mine);
            const b = talkPick(c.mine.filter(x => x !== a)) || a;
            if (a === b) return null;
            return { who: a, other: b, lines: [
                `<i>Kulağına çalınan:</i> ${a.name} ile ${b.name} başkentte gizlice görüşmüş.`,
                `"...ikimiz birlikte istersek konsey bize karşı çıkamaz." — ${a.name}`,
            ], options: [
                { text: 'İkisini de çağır, açık konuş', tip: 'Sadakat +5/+5 · kulis dağılır',
                  run: t => { a.loyalty = Math.min(100, talkLoy(a) + talkGain(5)); b.loyalty = Math.min(100, talkLoy(b) + talkGain(5));
                      a._clique = b._clique = null;
                      return { msg: 'Kulis dağıldı — ikisi de açıklık için minnettar (+5).' }; } },
                { text: 'Birini kayır, ikisini böl', tip: `${a.name} +14 · ${b.name} −12`,
                  run: t => { a.loyalty = Math.min(100, talkLoy(a) + talkGain(14)); b.loyalty = Math.max(0, talkLoy(b) - 12);
                      return { msg: `${a.name} kazanıldı (+14), ${b.name} dışlandı (−12).` }; } },
                { text: 'Sessizce izle', tip: 'Kulis büyür ama bilgi sende',
                  run: t => { a._clique = b.id; b._clique = a.id;
                      return { msg: 'Kulisi izliyorsun — ikisi artık birlikte oy veriyor.' }; } },
            ] };
        }
    },
    {
        id: 'plot', audience: 'player', kind: 'clique',
        when: c => c.mine.filter(x => talkLoy(x) < 50).length >= 2,
        weight: () => (3 + ((typeof cmdrBonus === 'function' ? cmdrBonus(STORY.commander).intrigue : 0) * 2.5))
                     * ((typeof storyEraEffects === 'function') ? storyEraEffects().plotWeight : 1),
        build: c => {
            const low = c.mine.filter(x => talkLoy(x) < 50);
            const a = talkPick(low);
            const b = talkPick(low.filter(x => x !== a)) || a;
            if (a === b) return null;
            return { who: a, other: b, lines: [
                `<i>Sadık bir subay fısıldadı:</i> ${a.name} ve ${b.name} darbe konuşuyor.`,
                `"Konsey toplandığında başkent bizim olacak..."`,
            ], options: [
                { text: 'Elebaşını tutukla', tip: `${a.name} kadrodan atılır · diğerleri korkar`,
                  run: t => { const i = c.me.gov.commanders.indexOf(a); if (i >= 0) c.me.gov.commanders.splice(i, 1);
                      for (const o of c.mine) if (o !== a) o.loyalty = Math.max(0, talkLoy(o) - 4);
                      c.me.welfare = Math.max(0, c.me.welfare - 3);
                      return { msg: `${a.name} tutuklandı — konsey ürperdi (sadakat −4, refah −3).` }; } },
                { text: 'İkisini de satın al', tip: 'Sadakat +20/+20 · 400⭐',
                  run: t => { if (!storyCouncilPayFromState(c.me, { points: 400 })) return { fail: 'Hazine yetersiz.' };
                      a.loyalty = Math.min(100, talkLoy(a) + talkGain(20)); b.loyalty = Math.min(100, talkLoy(b) + talkGain(20));
                      return { msg: 'Komplo parayla söndürüldü (+20/+20, −400⭐).' }; } },
                { text: 'Sadıklarını topla, hazırlan', tip: 'Yeminli komutanlar +8 · komplo sürer',
                  run: t => { let n = 0; for (const o of c.mine) if (o._sworn) { o.loyalty = Math.min(100, talkLoy(o) + talkGain(8)); n++; }
                      return { msg: n ? `${n} yeminli komutan seferber edildi (+8).` : 'Yeminli komutanın yok — yalnızsın.' }; } },
            ] };
        }
    },
    {
        id: 'rivalry', audience: 'admin', kind: 'clique',
        when: c => c.mine.length >= 2,
        weight: () => 1.5,
        build: c => {
            const a = talkPick(c.mine);
            const b = talkPick(c.mine.filter(x => x !== a)) || a;
            if (a === b) return null;
            return { who: a, other: b, lines: [
                `<i>Karargâhta gerilim:</i> ${a.name} ile ${b.name} ikmal payı yüzünden kavga etti.`,
                `İkisi de senden taraf tutmanı bekliyor.`,
            ], options: [
                { text: `${a.name}'ı destekle`, tip: `+10 / −8`,
                  run: t => { a.loyalty = Math.min(100, talkLoy(a) + talkGain(10)); b.loyalty = Math.max(0, talkLoy(b) - 8);
                      return { msg: `${a.name} kayrıldı.` }; } },
                { text: `${b.name}'ı destekle`, tip: `−8 / +10`,
                  run: t => { b.loyalty = Math.min(100, talkLoy(b) + talkGain(10)); a.loyalty = Math.max(0, talkLoy(a) - 8);
                      return { msg: `${b.name} kayrıldı.` }; } },
                { text: 'İkisini de payla, kavgayı bitir', tip: 'Her ikisi +5 · 200⭐',
                  run: t => { if (!storyCouncilPayFromState(c.me, { points: 200 })) return { fail: 'Hazine yetersiz.' };
                      a.loyalty = Math.min(100, talkLoy(a) + talkGain(5)); b.loyalty = Math.min(100, talkLoy(b) + talkGain(5));
                      return { msg: 'Kavga parayla çözüldü (+5/+5, −200⭐).' }; } },
            ] };
        }
    },

    // ══════════ DIŞ TEMAS — DİPLOMASİ ══════════
    {
        id: 'envoy-truce', audience: 'admin', kind: 'foreign',
        when: c => c.neighbors.some(s => storyTreaty(c.me.id, s.id) === 'war'),
        weight: c => 3,
        build: c => {
            const foes = c.neighbors.filter(s => storyTreaty(c.me.id, s.id) === 'war');
            const foe = talkPick(foes);
            const env = talkPick(storyStateCommanders(foe)) || { name: 'Elçi' };
            const rel = storyRelValue(c.me.id, foe.id);
            return { who: env, foreign: foe, lines: [
                `<span style="color:${foe.color}">${foe.name}</span> elçisi ${env.name}:`,
                `"Sınırda iki taraf da kan kaybediyor. ${TRUCE_YEARS} yıllık ateşkes teklif ediyoruz.`,
                `Silahlar sussun, kimse toprak istemesin."`,
                `<i>Mevcut ilişki: ${storyRelLabel(rel).t} (${rel})</i>`,
            ], options: [
                { text: `Ateşkesi kabul et (${TRUCE_YEARS} yıl)`, tip: 'Saldırmazlar · ilişki +25',
                  run: t => { storySetTreaty(c.me.id, foe.id, 'truce', TRUCE_YEARS); storyRelAdd(c.me.id, foe.id, 25);
                      storyLog(`🤍 <span style="color:${foe.color}">${foe.name}</span> ile ${TRUCE_YEARS} yıllık ATEŞKES imzalandı.`);
                      return { msg: `Ateşkes yürürlükte — ${foe.name} sana saldırmaz.` }; } },
                { text: 'Reddet — "Toprak konuşulmadan barış olmaz."', tip: 'İlişki −15 · savaş sürer',
                  run: t => { storyRelAdd(c.me.id, foe.id, -15);
                      return { msg: `Teklif reddedildi (ilişki −15).` }; } },
                { text: 'Şart koş: ateşkes + 300⭐ tazminat', tip: 'Riskli — ilişkiye ve güce bağlı',
                  run: t => { const strong = storyStateStrength(c.me) > storyStateStrength(foe);
                      if (strong) { storySetTreaty(c.me.id, foe.id, 'truce', TRUCE_YEARS); storyRelAdd(c.me.id, foe.id, 8);
                          const paid = typeof storyBudgetCountryTransfer === 'function'
                              ? storyBudgetCountryTransfer(foe, c.me, 300, 'diplomacy.reparation', { correlationId: `reparation:${foe.id}:${c.me.id}` })
                              : null;
                          if (paid && !paid.ok) return { fail: 'Karşı taraf tazminatı ödeyemiyor.' };
                          if (!paid) for (const cm of storyStateCommanders(c.me)) { cm.res.points = (cm.res.points || 0) + Math.round(300 / storyStateCommanders(c.me).length); }
                          return { msg: `Güçlü taraf sensin — ateşkes + 300⭐ tazminat alındı.` }; }
                      storyRelAdd(c.me.id, foe.id, -20);
                      return { msg: `Küstahlık say���ldı — elçi masayı terk etti (ilişki −20).` }; } },
            ] };
        }
    },
    {
        id: 'envoy-pact', audience: 'admin', kind: 'foreign',
        when: c => c.neighbors.some(s => storyRelValue(c.me.id, s.id) >= 20 && storyTreaty(c.me.id, s.id) !== 'alliance' && storyTreaty(c.me.id, s.id) !== 'pact'),
        weight: () => 2.5,
        build: c => {
            const cand = c.neighbors.filter(s => storyRelValue(c.me.id, s.id) >= 20 && storyTreaty(c.me.id, s.id) !== 'alliance' && storyTreaty(c.me.id, s.id) !== 'pact');
            const foe = talkPick(cand);
            const env = talkPick(storyStateCommanders(foe)) || { name: 'Elçi' };
            return { who: env, foreign: foe, lines: [
                `<span style="color:${foe.color}">${foe.name}</span> elçisi ${env.name}:`,
                `"Aramızdaki hava yumuşadı. Süresiz saldırmazlık paktı öneriyoruz —`,
                `sınırlarımızı dondururuz, ikimiz de başka cephelere bakarız."`,
            ], options: [
                { text: 'Paktı imzala', tip: 'Süresiz saldırmazlık · ilişki +20',
                  run: t => { storySetTreaty(c.me.id, foe.id, 'pact', 0); storyRelAdd(c.me.id, foe.id, 20);
                      storyLog(`📜 <span style="color:${foe.color}">${foe.name}</span> ile SALDIRMAZLIK PAKTI.`);
                      return { msg: `Pakt imzalandı — bu sınır artık güvenli.` }; } },
                { text: 'Reddet, elini serbest tut', tip: 'İlişki −10 · saldırabilirsin',
                  run: t => { storyRelAdd(c.me.id, foe.id, -10); return { msg: 'Pakt reddedildi — elin serbest.' }; } },
            ] };
        }
    },
    {
        id: 'envoy-alliance', audience: 'council', kind: 'foreign',
        when: c => c.neighbors.some(s => storyRelValue(c.me.id, s.id) >= 55 && storyTreaty(c.me.id, s.id) !== 'alliance'),
        weight: () => 2.5,
        build: c => {
            const cand = c.neighbors.filter(s => storyRelValue(c.me.id, s.id) >= 55 && storyTreaty(c.me.id, s.id) !== 'alliance');
            const foe = talkPick(cand);
            const env = talkPick(storyStateCommanders(foe)) || { name: 'Elçi' };
            return { who: env, foreign: foe, lines: [
                `<span style="color:${foe.color}">${foe.name}</span> elçisi ${env.name}:`,
                `"Artık dost değil kardeşiz. İTTİFAK kuralım —`,
                `birimize saldıran ikimize saldırmış sayılsın."`,
            ], options: [
                { text: 'İttifakı kur 🤝', tip: 'İlişki +25 · ortak düşman kazanırsın',
                  run: t => { storySetTreaty(c.me.id, foe.id, 'alliance', 0); storyRelAdd(c.me.id, foe.id, 25);
                      // ittifak, müttefikin düşmanlarıyla arayı bozar
                      for (const s of STORY.states) if (s.id !== c.me.id && s.id !== foe.id && storyRelValue(foe.id, s.id) < -30) storyRelAdd(c.me.id, s.id, -12);
                      storyLog(`🤝 <span style="color:${foe.color}">${foe.name}</span> ile İTTİFAK kuruldu!`);
                      return { msg: `İttifak kuruldu — ama ${foe.name}'ın düşmanları artık senin de düşmanın.` }; } },
                { text: 'Dostluk yeter, ittifak bağlar', tip: 'İlişki −5 · bağımsız kalırsın',
                  run: t => { storyRelAdd(c.me.id, foe.id, -5); return { msg: 'İttifak reddedildi, dostluk sürüyor.' }; } },
            ] };
        }
    },
    {
        id: 'envoy-tribute', audience: 'council', kind: 'foreign',
        when: c => c.neighbors.some(s => storyStateStrength(s) > storyStateStrength(c.me) * 1.3),
        weight: () => 2.5,
        build: c => {
            const cand = c.neighbors.filter(s => storyStateStrength(s) > storyStateStrength(c.me) * 1.3);
            const foe = talkPick(cand);
            const env = talkPick(storyStateCommanders(foe)) || { name: 'Elçi' };
            return { who: env, foreign: foe, lines: [
                `<span style="color:${foe.color}">${foe.name}</span> elçisi ${env.name} masaya bir kâğıt bıraktı:`,
                `"Ordularımızı saydınız mı? Yıllık 400⭐ haraç ödersiniz, sınırlarınıza dokunmayız.`,
                `Ödemezseniz... bahar taarruzumuzu görürsünüz."`,
            ], options: [
                { text: 'Haracı öde (400⭐)', tip: '2 yıl ateşkes · refah −4 · onur kaybı',
                  run: t => { const paid = typeof storyBudgetCountryTransfer === 'function'
                          ? storyBudgetCountryTransfer(c.me, foe, 400, 'diplomacy.tribute', { correlationId: `tribute:${c.me.id}:${foe.id}` })
                          : null;
                      if (paid ? !paid.ok : !storyCouncilPayFromState(c.me, { points: 400 })) return { fail: 'Hazine yetersiz — ödeyemezsin.' };
                      storySetTreaty(c.me.id, foe.id, 'truce', 2); storyRelAdd(c.me.id, foe.id, 10);
                      c.me.welfare = Math.max(0, c.me.welfare - 4);
                      for (const cm of c.mine) cm.loyalty = Math.max(0, talkLoy(cm) - 5);
                      return { msg: `Haraç ödendi — 2 yıl ateşkes, ama konsey utandı (sadakat −5, refah −4).` }; } },
                { text: '"Gelin de alın." (reddet)', tip: 'İlişki −25 · komutanlar +8 sadakat',
                  run: t => { storyRelAdd(c.me.id, foe.id, -25);
                      for (const cm of c.mine) cm.loyalty = Math.min(100, talkLoy(cm) + talkGain(8));
                      c.me.welfare = Math.min(100, c.me.welfare + 3);
                      return { msg: `Haraç reddedildi — onur korundu (sadakat +8, refah +3), ama savaş yakın.` }; } },
                { text: 'Zaman kazan: "Konseye götüreyim."', tip: 'İlişki değişmez · saldırı gecikir',
                  run: t => { storySetTreaty(c.me.id, foe.id, 'truce', 1);
                      return { msg: 'Bir yıl kazandın — hazırlan.' }; } },
            ] };
        }
    },
    {
        id: 'envoy-joint-war', audience: 'council', kind: 'foreign',
        when: c => c.neighbors.length >= 2 && c.neighbors.some(s => storyRelValue(c.me.id, s.id) >= 10),
        weight: () => 2,
        build: c => {
            const friend = talkPick(c.neighbors.filter(s => storyRelValue(c.me.id, s.id) >= 10));
            const target = talkPick(c.neighbors.filter(s => s !== friend)) || null;
            if (!target) return null;
            const env = talkPick(storyStateCommanders(friend)) || { name: 'Elçi' };
            return { who: env, foreign: friend, lines: [
                `<span style="color:${friend.color}">${friend.name}</span> elçisi ${env.name}:`,
                `"<span style="color:${target.color}">${target.name}</span> ikimizin de sınırında oturuyor.`,
                `Aynı anda vuralım — toprağı paylaşırız, kimse tek başına kalmaz."`,
            ], options: [
                { text: 'Ortak savaşı kabul et', tip: `${friend.name} ile +30 · ${target.name} ile −35`,
                  run: t => { storyRelAdd(c.me.id, friend.id, 30); storySetTreaty(c.me.id, friend.id, 'pact', 0);
                      storyRelAdd(c.me.id, target.id, -35); storySetTreaty(c.me.id, target.id, 'war', 0);
                      storyRelAdd(friend.id, target.id, -30); storySetTreaty(friend.id, target.id, 'war', 0);
                      storyLog(`⚔️ <span style="color:${friend.color}">${friend.name}</span> ile birlikte <span style="color:${target.color}">${target.name}</span>'a karşı ortak harekât!`);
                      return { msg: `Ortak savaş — ${friend.name} ile pakt, ${target.name} ile savaş.` }; } },
                { text: `Reddet, ${target.name}'a haber uçur`, tip: `${target.name} ile +30 · ${friend.name} ile −30`,
                  run: t => { storyRelAdd(c.me.id, target.id, 30); storyRelAdd(c.me.id, friend.id, -30);
                      storySetTreaty(c.me.id, target.id, 'truce', TRUCE_YEARS);
                      return { msg: `İhbar ettin — ${target.name} minnettar (ateşkes), ${friend.name} öfkeli.` }; } },
                { text: 'Tarafsız kal', tip: 'İkisiyle de küçük gerginlik',
                  run: t => { storyRelAdd(c.me.id, friend.id, -8); storyRelAdd(c.me.id, target.id, 4);
                      return { msg: 'Tarafsız kaldın.' }; } },
            ] };
        }
    },
    {
        id: 'envoy-bribe', audience: 'player', kind: 'foreign',
        when: c => c.mine.some(x => talkLoy(x) < 55) && c.neighbors.length > 0,
        weight: () => 2.2 + ((typeof cmdrBonus === 'function' ? cmdrBonus(STORY.commander).intrigue : 0) * 2),
        build: c => {
            const foe = talkPick(c.neighbors);
            const who = talkPick(c.mine.filter(x => talkLoy(x) < 55));
            return { who, foreign: foe, lines: [
                `<i>Ele geçirilen mektup:</i> <span style="color:${foe.color}">${foe.name}</span>,`,
                `komutanın <b>${who.name}</b>'a altın ve toprak vaat etmiş.`,
                `Mektubun altında ${who.name}'ın mührü var — ama cevabı henüz belli değil.`,
            ], options: [
                { text: 'Yüzleştir ve affet', tip: 'Sadakat +22 · ilişki −12',
                  run: t => { who.loyalty = Math.min(100, talkLoy(who) + talkGain(22)); storyRelAdd(c.me.id, foe.id, -12);
                      return { msg: `${who.name} affedildi — minnettar (+22).` }; } },
                { text: 'Sessizce görevden al', tip: 'Kadrodan çıkar · diğerleri −5',
                  run: t => { const i = c.me.gov.commanders.indexOf(who); if (i >= 0) c.me.gov.commanders.splice(i, 1);
                      for (const o of c.mine) if (o !== who) o.loyalty = Math.max(0, talkLoy(o) - 5);
                      return { msg: `${who.name} tasfiye edildi — konsey tedirgin (−5).` }; } },
                { text: 'Çift taraflı oyna: sahte bilgi yolla', tip: `İlişki −20 · ${foe.name} yanlış yerden saldırır`,
                  run: t => { storyRelAdd(c.me.id, foe.id, -20); who.loyalty = Math.min(100, talkLoy(who) + talkGain(10));
                      const front = c.myNodes.filter(n => (n.neighbors || []).some(id => { const q = storyNode(id); return q && q.owner === foe.id; }));
                      for (const n of front.slice(0, 2)) n.garrison = Math.min(storyCityGarrisonCap(n), (n.garrison | 0) + 1);
                      return { msg: `Karşı istihbarat kuruldu — sınır takviye edildi, ${who.name} oyuna ortak (+10).` }; } },
            ] };
        }
    },
    {
        id: 'envoy-trade', audience: 'admin', kind: 'foreign',
        when: c => c.neighbors.some(s => storyRelValue(c.me.id, s.id) >= -20),
        weight: () => 1.8,
        build: c => {
            const foe = talkPick(c.neighbors.filter(s => storyRelValue(c.me.id, s.id) >= -20));
            const env = talkPick(storyStateCommanders(foe)) || { name: 'Elçi' };
            return { who: env, foreign: foe, lines: [
                `<span style="color:${foe.color}">${foe.name}</span> tüccar heyeti (${env.name}):`,
                `"Bizde petrol var, sizde insan gücü. Sınır kapısını açalım —`,
                `savaşırken bile ticaret döner, ikimiz de kazanırız."`,
            ], options: [
                { text: 'Ticareti aç: 200👥 ver, 300⛽ al', tip: 'İlişki +12',
                  run: t => { const cm = storyStateCommanders(c.me);
                      let have = cm.reduce((a, x) => a + ((x.res && x.res.manpower) || 0), 0);
                      if (have < 200) return { fail: 'İnsan gücün yetmiyor.' };
                      storyCouncilPayFromState(c.me, { manpower: 200 });
                      for (const x of cm) x.res.oil = (x.res.oil || 0) + Math.round(300 / cm.length);
                      storyRelAdd(c.me.id, foe.id, 12);
                      return { msg: `Ticaret açıldı: −200👥 +300⛽ (ilişki +12).` }; } },
                { text: 'Reddet — "Düşmanla ticaret olmaz."', tip: 'İlişki −8 · komutanlar +3',
                  run: t => { storyRelAdd(c.me.id, foe.id, -8);
                      for (const x of c.mine) x.loyalty = Math.min(100, talkLoy(x) + talkGain(3));
                      return { msg: 'Ticaret reddedildi (komutanlar +3 sadakat).' }; } },
            ] };
        }
    },
    {
        id: 'envoy-betray', audience: 'council', kind: 'foreign',
        when: c => c.neighbors.some(s => { const t = storyTreaty(c.me.id, s.id); return t === 'pact' || t === 'alliance' || t === 'truce'; }),
        weight: () => 1.4,
        build: c => {
            const ally = talkPick(c.neighbors.filter(s => { const t = storyTreaty(c.me.id, s.id); return t === 'pact' || t === 'alliance' || t === 'truce'; }));
            const who = talkPick(c.mine) || STORY.commander;
            const t = storyTreaty(c.me.id, ally.id);
            return { who, lines: [
                `${who.name}: "Efendim, <span style="color:${ally.color}">${ally.name}</span> ile ${(TREATIES[t] || {}).name} var —`,
                `sınırlarını boş bıraktılar. Şimdi vurursak iki şehri bir haftada alırız.`,
                `Ama ahdimizi bozmuş oluruz. Karar sizin."`,
            ], options: [
                { text: 'Ahde vefa — reddet', tip: 'İlişki +15 · tüm dünyada itibar +',
                  run: t2 => { storyRelAdd(c.me.id, ally.id, 15);
                      for (const s of STORY.states) if (s.id !== c.me.id) storyRelAdd(c.me.id, s.id, 4);
                      c.me.welfare = Math.min(100, c.me.welfare + 2);
                      return { msg: 'Ahdine sadık kaldın — dünyada itibarın arttı.' }; } },
                { text: 'Antlaşmayı boz, saldır', tip: 'Ani üstünlük · dünyada itibar çöker',
                  run: t2 => { storyBreakTreaty(c.me.id, ally.id, c.me.id);
                      const targets = STORY.nodes.filter(n => n.owner === ally.id && (n.neighbors || []).some(id => { const q = storyNode(id); return q && q.owner === c.me.id; }));
                      for (const n of targets.slice(0, 2)) {                                   // hazırlıksız yakalandılar
                          const kayip = Math.min(2, n.garrison | 0);
                          n.garrison = Math.max(0, (n.garrison | 0) - 2);
                          if (typeof storyGarrisonRemove === 'function') storyGarrisonRemove(n, kayip);
                      }
                      return { msg: `Ahdini bozdun — ${ally.name} sınırı savunmasız, ama dünya seni not etti.` }; } },
            ] };
        }
    },
];

// devletin kaba gücü (diplomaside "kim güçlü" sorusu)
function storyStateStrength(st) {
    if (!st) return 0;
    let s = STORY.nodes.filter(n => n.owner === st.id).length * 10;
    for (const c of storyStateCommanders(st)) s += (typeof cmdArmyCount === 'function' ? cmdArmyCount(c) : 0) * 2;
    return s * (typeof storyTechPowerMul === 'function' ? storyTechPowerMul(st) : 1);
}

// ── YETKİ YÖNLENDİRMESİ ────────────────────────────────────────────────────
// "Her şeyi ben yapıyorum, birçoğu konsey yöneticisinin işi gibi duruyor."
// Doğru: devlet hazinesi, kadro yönetimi ve antlaşma imzalamak yöneticinin işidir.
//   player  → şahsi mesele, daima sana gelir
//   admin   → yöneticiysen sana; değilse AI yönetici karar verir, sen HABER alırsın
//   council → devleti bağlar → OLAĞANÜSTÜ KONSEY (yöneticiysen son söz sende)
function storyTalkIsAdmin() {
    const me = storyPlayerState();
    return !!(me && me.gov && me.gov.leader === 'player');
}
// AI yönetici bir konuşmayı kendi başına çözer; oyuncu sonucu günlükten öğrenir.
function storyTalkResolveByAdmin(built, tpl, ctx) {
    const st = ctx.me;
    // yöneticinin tercihi: en yüksek diplomasi+iktisat yeteneğine sahip komutan gibi düşünür
    const lead = storyStateCommanders(st).filter(c => !c.isPlayer)
        .sort((a, b) => ((b.skills?.diplomat || 0) + (b.skills?.economist || 0))
                      - ((a.skills?.diplomat || 0) + (a.skills?.economist || 0)))[0];
    let pick = 0;
    if (lead) {
        // yönetici "işe yarar ama ucuz" olanı seçer: ilk uygulanabilir seçenek
        for (let i = 0; i < built.options.length; i++) {
            const probe = built.options[i];
            if (probe && probe.text && probe.text.indexOf('Reddet') < 0) { pick = i; break; }
        }
    }
    let res = null;
    try { res = built.options[pick].run({}); } catch (_) { res = null; }
    if (res && res.fail) { try { res = built.options[built.options.length - 1].run({}); } catch (_) { res = null; } }
    const who = lead ? lead.name : 'Yönetim';
    storyLog(`🏛️ <b>Yönetici kararı</b> (${who}): ${(res && res.msg) || 'mesele kapandı'}`);
    return true;
}
// Devlet meselesini olağanüstü konseye taşı: konuşma gündem MADDESİNE çevrilir.
function storyTalkToCouncil(built, tpl, ctx) {
    const item = {
        kind: 'talk', icon: '🕊️', title: (tpl.id.indexOf('envoy') === 0 ? 'DIŞ TEMAS' : 'DEVLET MESELESİ'),
        desc: built.lines.join(' '),
        options: built.options.map((o, i) => ({
            id: 'o' + i, name: o.text, desc: o.tip || '', meta: 'KARAR',
            appeal: o._appeal || { diplomat: 0.6 }, _run: o.run,
        })),
    };
    const reason = built.foreign
        ? `<span style="color:${built.foreign.color}">${built.foreign.name}</span> elçisi kapıda`
        : 'devleti bağlayan bir karar';
    return storyCouncilCall(ctx.me, item, reason);
}

// ── ÜRETİM DÖNGÜSÜ ──────────────────────────────────────────────────────────
function storyTalkTick(dtSec) {
    if (!STORY.active || STORY._session) return;
    if (typeof storyChatterTick === 'function') storyChatterTick(dtSec);   // komutanlar arası sohbet
    STORY._accTalk = (STORY._accTalk || 0) + dtSec;
    if (STORY._accTalk < TALK_INTERVAL) return;
    STORY._accTalk = 0;
    storyTalkRun();
}

function storyTalkRun(preferredTemplateId) {
    if (!STORY.active || STORY._session) return;
    if (!STORY._talks) STORY._talks = [];
    // süresi geçenleri düşür
    const expiredTalks = STORY._talks.filter(t => (STORY.clock || 0) - t.born >= TALK_EXPIRE);
    for (const talk of expiredTalks) {
        if (talk.memoryEpisodeId && typeof storyMemoryResolveEpisode === 'function') {
            storyMemoryResolveEpisode(talk.memoryEpisodeId, 'Yanıt verilmeden süresi doldu.');
        }
    }
    STORY._talks = STORY._talks.filter(t => (STORY.clock || 0) - t.born < TALK_EXPIRE);
    if (STORY._talks.length >= TALK_MAX_QUEUE) return;

    const ctx = storyTalkContext(); if (!ctx) return;
    const cand = TALK_TEMPLATES.filter(tp => { try { return tp.when(ctx); } catch (_) { return false; } });
    if (!cand.length) return;
    // ağırlıklı seçim
    let tot = 0; const ws = cand.map(tp => { const w = (typeof tp.weight === 'function' ? tp.weight(ctx) : 1) || 1; tot += w; return w; });
    let pick = preferredTemplateId ? cand.find(tp => tp.id === preferredTemplateId) : null;
    if (!pick) {
        let r = storyRandom('diplomacy') * tot;
        pick = cand[0];
        for (let i = 0; i < cand.length; i++) { r -= ws[i]; if (r <= 0) { pick = cand[i]; break; } }
    }
    const buildRng = typeof storyRngForSave === 'function' ? storyRngForSave() : null;
    const previousTrace = STORY._talkPickTrace;
    const buildTrace = { mode: 'record', picks: [] };
    STORY._talkPickTrace = buildTrace;
    let built = null;
    try { built = pick.build(ctx); } catch (_) { built = null; }
    finally { STORY._talkPickTrace = previousTrace; }
    if (!built || !built.options || !built.options.length) return;
    // aynı şablon üst üste kuyruğa girmesin
    if (STORY._talks.some(t => t.tpl === pick.id)) return;

    // YETKİ: kim karar verecek?
    const aud = pick.audience || 'player';
    if (aud === 'council') { if (storyTalkToCouncil(built, pick, ctx)) return; }
    else if (aud === 'admin' && !storyTalkIsAdmin()) { storyTalkResolveByAdmin(built, pick, ctx); return; }

    const uid = (STORY._talkUid = (STORY._talkUid || 0) + 1);
    const speakerActorId = storyTalkCanonicalActorId(built.who, built.foreign && built.foreign.id);
    const playerActorId = STORY.commander
        ? `character:${STORY.playerStateId | 0}:${STORY.commander.id}` : null;
    const episodeId = speakerActorId && playerActorId && typeof storyMemoryOpenEpisode === 'function'
        ? `character-memory:talk:${uid}` : null;
    if (episodeId) storyMemoryOpenEpisode({
        id: episodeId,
        topicKey: `talk-template:${pick.id}`,
        participantActorIds: [playerActorId, speakerActorId],
        summary: `${built.who ? built.who.name : 'Bir haberci'}: ${String((built.lines || [])[0] || pick.id).replace(/<[^>]+>/g, '')}`,
        unresolvedTopic: 'Oyuncunun cevabı bekleniyor.',
        importanceBps: pick.kind === 'crisis' ? 8500 : 6500,
        source: { talkUid: uid, talkTemplateId: pick.id }
    });
    STORY._talks.push({
        uid,
        tpl: pick.id, kind: pick.kind, born: STORY.clock || 0,
        title: built.who ? built.who.name : 'Haber',
        foreignId: built.foreign ? built.foreign.id : null,
        speakerActorId, memoryEpisodeId: episodeId,
        lines: built.lines, options: built.options, buildRng, buildPicks: buildTrace.picks,
    });
    storyTalkBadge();
    if (typeof storyFlash === 'function') {
        const ic = pick.kind === 'foreign' ? '🕊️' : (pick.kind === 'clique' ? '👁️' : '🗣️');
        storyFlash(`${ic} ${built.who ? built.who.name : 'Bir haberci'} seninle konuşmak istiyor.`);
    }
}

function storyTalkCanonicalActorId(who, fallbackStateId) {
    const identityLedger = typeof storyCharacterIdentityEnsure === 'function'
        ? storyCharacterIdentityEnsure() : null;
    const identities = identityLedger && identityLedger.identities || {};
    if (who === STORY.commander) {
        const playerId = `character:${STORY.playerStateId | 0}:${STORY.commander.id}`;
        return identities[playerId] ? playerId : null;
    }
    for (const state of (STORY.states || [])) {
        const commander = state.gov && Array.isArray(state.gov.commanders)
            ? state.gov.commanders.find(row => row === who || (who && row.id === who.id && row.name === who.name))
            : null;
        if (commander) {
            const id = `character:${state.id}:${commander.id}`;
            if (identities[id]) return id;
        }
    }
    const stateId = Number(fallbackStateId);
    const presidentId = Number.isInteger(stateId) ? `character:${stateId}:president` : null;
    return presidentId && identities[presidentId] ? presidentId : null;
}

// Bekleyen konuşmalar canlı `run` kapanışları taşır ve doğrudan JSON'a
// yazılamaz. Şablon kurulmadan hemen önceki RNG fotoğrafını saklarız; yüklemede
// aynı kapanışları yeniden kurup ardından kampanyanın kayıtlı RNG durumuna geri
// döneriz. Böylece hem seçenekler çalışır kalır hem de yükleme yeni rastgele
// sayı tüketmez.
function storyTalkRuntimeForSave() {
    return {
        schemaVersion: 1,
        nextUid: Math.max(0, Math.floor(Number(STORY._talkUid) || 0)),
        queue: (STORY._talks || []).map(talk => ({
            uid: talk.uid,
            tpl: talk.tpl,
            kind: talk.kind,
            born: talk.born,
            title: talk.title,
            foreignId: talk.foreignId == null ? null : talk.foreignId,
            speakerActorId: talk.speakerActorId || null,
            memoryEpisodeId: talk.memoryEpisodeId || null,
            lines: Array.isArray(talk.lines) ? talk.lines.slice() : [],
            options: (talk.options || []).map(option => ({
                text: option.text || '',
                tip: option.tip || ''
            })),
            buildRng: talk.buildRng || null,
            buildPicks: Array.isArray(talk.buildPicks) ? talk.buildPicks : []
        }))
    };
}

function storyTalkRuntimeRestore(saved) {
    const source = saved && typeof saved === 'object' ? saved : {};
    const queue = Array.isArray(source.queue) ? source.queue : [];
    const currentRng = typeof storyRngForSave === 'function' ? storyRngForSave() : null;
    const restored = [];

    for (const item of queue) {
        const template = TALK_TEMPLATES.find(candidate => candidate.id === item.tpl);
        let built = null;
        if (template && item.buildRng && typeof storyRngRestore === 'function') {
            const previousTrace = STORY._talkPickTrace;
            try {
                storyRngRestore(item.buildRng, item.buildRng.rootSeed);
                STORY._talkPickTrace = {
                    mode: 'replay',
                    picks: Array.isArray(item.buildPicks) ? item.buildPicks : [],
                    index: 0
                };
                const ctx = storyTalkContext();
                if (ctx) built = template.build(ctx);
            } catch (_) {
                built = null;
            } finally {
                STORY._talkPickTrace = previousTrace;
                if (currentRng) storyRngRestore(currentRng, currentRng.rootSeed);
            }
        }
        const fallbackOptions = Array.isArray(item.options) ? item.options.map(option => ({
            text: option.text || 'Kullanılamayan seçenek',
            tip: option.tip || '',
            run: () => ({ fail: 'Bu eski konuşma yeniden kurulamadı; süresi dolunca yenisi gelecektir.' })
        })) : [];
        const rebuiltOptions = built && Array.isArray(built.options) && built.options.length
            ? built.options.map((option, index) => Object.assign({}, option, {
                text: item.options && item.options[index] ? item.options[index].text : option.text,
                tip: item.options && item.options[index] ? item.options[index].tip : option.tip
            }))
            : null;
        restored.push({
            uid: Math.max(1, Math.floor(Number(item.uid) || 1)),
            tpl: item.tpl || 'legacy',
            kind: item.kind || (template && template.kind) || 'internal',
            born: Number.isFinite(Number(item.born)) ? Number(item.born) : (STORY.clock || 0),
            title: item.title || (built && built.who && built.who.name) || 'Haber',
            foreignId: item.foreignId == null ? null : item.foreignId,
            speakerActorId: item.speakerActorId || null,
            memoryEpisodeId: item.memoryEpisodeId || null,
            lines: Array.isArray(item.lines) ? item.lines.slice() : ((built && built.lines) || []),
            options: rebuiltOptions || fallbackOptions,
            buildRng: item.buildRng || null,
            buildPicks: Array.isArray(item.buildPicks) ? item.buildPicks : []
        });
    }
    STORY._talks = restored;
    STORY._talkUid = Math.max(
        Math.max(0, Math.floor(Number(source.nextUid) || 0)),
        ...restored.map(talk => talk.uid)
    );
    return restored.length;
}

// AI devletleri de kendi aralarında diplomasi yürütür (oyuncu görmese de dünya işler)
function storyAIDiplomacyTick() {
    const sts = STORY.states.filter(s => storyStateCommanders(s).length && STORY.nodes.some(n => n.owner === s.id));
    if (sts.length < 2) return;
    const a = talkPick(sts), b = talkPick(sts.filter(s => s !== a));
    if (!a || !b || a.isPlayer || b.isPlayer) return;   // oyuncunun diplomasisi SOHBETLE yürür
    const rel = storyRelValue(a.id, b.id), t = storyTreaty(a.id, b.id);
    const sa = storyStateStrength(a), sb = storyStateStrength(b);
    // güçler dengeliyse ve ilişki fena değilse yakınlaşırlar; biri çok güçlüyse zayıfı ezer
    const balance = Math.min(sa, sb) / Math.max(1, Math.max(sa, sb));
    if (t === 'war' && balance > 0.7 && rel > -30 && storyRandom('diplomacy') < 0.35) {
        storySetTreaty(a.id, b.id, 'truce', TRUCE_YEARS); storyRelAdd(a.id, b.id, 20);
        if (storyRandom('diplomacy') < 0.4) storyLog(`🤍 <span style="color:${a.color}">${a.name}</span> ile <span style="color:${b.color}">${b.name}</span> ateşkes imzaladı.`);
    } else if (t === 'truce' && rel >= 35 && storyRandom('diplomacy') < 0.3) {
        storySetTreaty(a.id, b.id, 'pact', 0); storyRelAdd(a.id, b.id, 10);
    } else if (
        t !== 'war'
        && balance < 0.45
        && (
            typeof storyFeatureEnabled !== 'function'
            || !storyFeatureEnabled('diplomacy.peacefulStart')
            || (
                rel <= -35
                && storyStatesShareBorder(a.id, b.id)
                && Math.max(
                    typeof storyDoctrineAggr === 'function' ? storyDoctrineAggr(a) : 1,
                    typeof storyDoctrineAggr === 'function' ? storyDoctrineAggr(b) : 1
                ) >= 1.05
            )
        )
        && storyRandom('diplomacy') < (
            typeof storyFeatureEnabled === 'function' && storyFeatureEnabled('diplomacy.peacefulStart') ? 0.12 : 0.25
        )
    ) {
        const strong = sa > sb ? a : b;
        storyBreakTreaty(a.id, b.id, strong.id);        // güçlü olan fırsatçılık eder
    } else {
        storyRelAdd(a.id, b.id, t === 'war' ? -2 : 2);  // savaş yıpratır, barış yakınlaştırır
    }
}

// ── UI ──────────────────────────────────────────────────────────────────────
const STORY_TALK_VIEWS = Object.freeze(['conversations', 'contacts', 'diplomacy']);
let STORY_TALK_BOUND = false;

function storyTalkActiveView() {
    const active = String(STORY._talkView || 'conversations');
    return STORY_TALK_VIEWS.includes(active) ? active : 'conversations';
}

function storyTalkViewTabsHtml(active) {
    const tabs = [
        ['conversations', 'SOHBET'],
        ['contacts', 'KARAKTERLER & TEMASLAR'],
        ['diplomacy', 'DİPLOMASİ']
    ];
    return `<nav class="talk-view-tabs" role="tablist" aria-label="Sohbet ve diplomasi görünümü">`
        + tabs.map(([id, label]) => `<button type="button" class="talk-view-tab${active === id ? ' active' : ''}" `
            + `role="tab" aria-selected="${active === id ? 'true' : 'false'}" data-talk-view="${id}">${label}</button>`).join('')
        + `</nav>`;
}

function storyTalkBadge() {
    const b = document.getElementById('story-talk-badge');
    const n = (STORY._talks || []).length;
    if (b) { b.textContent = n ? String(n) : ''; b.classList.toggle('hidden', !n); }
}
function storyTalkOpen() {
    if (typeof storyCouncilClose === 'function') storyCouncilClose();
    if (typeof storyTechClose === 'function') storyTechClose();
    if (typeof storyArmyClose === 'function') storyArmyClose();
    if (typeof storyCityClose === 'function') storyCityClose();
    if (typeof storyEconomyClose === 'function') storyEconomyClose();
    STORY._talkView = storyTalkActiveView();
    STORY._talkOpen = true;
    const p = document.getElementById('talk-panel');
    if (p) { p.classList.add('open'); p.setAttribute('aria-hidden', 'false'); }
    document.getElementById('story-talk-btn')?.classList.add('active');
    storyTalkUpdate();
}
function storyTalkClose() {
    if (typeof storyConversationWorkspaceClose === 'function') storyConversationWorkspaceClose();
    STORY._talkOpen = false;
    STORY._talkFocusCharacterId = null;
    STORY._talkFocusCharacterName = null;
    STORY._talkFocusRegionId = null;
    const p = document.getElementById('talk-panel');
    if (p) { p.classList.remove('open'); p.setAttribute('aria-hidden', 'true'); }
    document.getElementById('story-talk-btn')?.classList.remove('active');
}
function storyTalkToggle() { STORY._talkOpen ? storyTalkClose() : storyTalkOpen(); }

function storyTalkRemainingLabel(seconds) {
    const years = Math.max(0, Number(seconds) || 0) / YEAR_SECONDS;
    if (years >= 1) {
        const rounded = Math.ceil(years * 4) / 4;
        return `${rounded.toLocaleString('tr-TR')} yıl kaldı`;
    }
    const months = Math.max(1, Math.ceil(years * 12));
    return `${months} ay kaldı`;
}

const TALK_KIND_META = {
    internal: { ic: '🗣️', name: 'KOMUTANIN', c: '#4cff7c' },
    clique:   { ic: '👁️', name: 'KULİS',     c: '#c78cff' },
    foreign:  { ic: '🕊️', name: 'DIŞ TEMAS', c: '#9fd2ff' },
    crisis:   { ic: '⚠️', name: 'İÇ SİYASİ KRİZ', c: '#ff8f66' },
};

const STORY_TALK_CHARACTER_ACTION_COPY = Object.freeze({
    PERSUADE: Object.freeze({ detail: 'Hedefin sana duyduğu güven ve saygıyı kişisel nüfuz kullanarak artırır.' }),
    NEGOTIATE: Object.freeze({ detail: 'İki yönlü güveni güçlendirir, mevcut husumeti düşürür.' }),
    ALLY: Object.freeze({ detail: 'Yüksek güvenilirlik bedeliyle kalıcı kişisel ittifak kurar.' }),
    BETRAY: Object.freeze({ detail: 'Anlamlı bağı koparır; güveni yıkar, husumeti artırır ve ihanet hafızası bırakır.' }),
    ORDER: Object.freeze({ detail: 'Bu subay üzerinden seçili şehrin ihtiyatını kurum ve uygulama kapasitesi zincirine yollar.' }),
    SABOTAGE: Object.freeze({ detail: 'Kamusal fiziksel hedefte süreli gizli operasyon başlatır; sonuç, tespit ve fail atfı ayrı çözülür.' })
});

function storyTalkCharacterActionReason(action) {
    const reason = action && action.reasons && action.reasons[0];
    const cooldownSeconds = Math.ceil(Number(action && action.cooldownRemainingSeconds) || 0);
    const cooldownLabel = typeof storyTalkRemainingLabel === 'function'
        ? storyTalkRemainingLabel(cooldownSeconds).replace(/ kaldı$/, '')
        : `${cooldownSeconds} sn`;
    const labels = {
        SELF_TARGET_FORBIDDEN: 'Kendine karşı uygulanamaz.',
        ACTION_ON_COOLDOWN: `${cooldownLabel} sonra yeniden kullanılabilir.`,
        INSUFFICIENT_CAREER_RESOURCE: 'Kariyer kaynağın yetersiz.',
        NO_VERIFIED_CONTACT: 'Bu karakterle doğrulanmış temasın yok.',
        ALLIANCE_ALREADY_ACTIVE: 'Bu karakterle etkin ittifak zaten var.',
        BETRAYAL_REQUIRES_MEANINGFUL_TIE: 'İhanet için önce güven, saygı, borç veya ittifak bağı gerekir.',
        TARGET_NOT_FOUND: 'Hedef karakter bulunamadı.',
        ACTOR_NOT_FOUND: 'Oyuncu karakteri bulunamadı.',
        ORDER_TARGET_MUST_BE_MILITARY: 'Emir için askerî bir muhatap seçmelisin.',
        ORDER_GOVERNANCE_LOCKED: action && action.domainReasons && action.domainReasons[0]
            || 'Bu emir mevcut yetki, kaynak veya şehir koşullarında verilemiyor.',
        ORDER_REGION_TARGET_REQUIRED: 'Emir için bir şehir hedefi gerekiyor.',
        ACTOR_LACKS_INTELLIGENCE_SERVICE: 'Bu operasyon için doğrulanmış ajan ve servis yetkin yok.',
        SABOTAGE_ASSET_TARGET_REQUIRED: 'Operasyon için doğrulanmış fiziksel varlık gerekiyor.',
        SABOTAGE_ASSET_TARGET_NOT_FOUND: 'Hedef varlık güncel kamusal sicilde bulunamadı.',
        SABOTAGE_TARGET_MUST_BE_FOREIGN: 'Kendi ülkenin altyapısı bu yüzeyden hedeflenemez.',
        ACTION_LAYER_DISABLED: 'Karakter eylem sistemi kapalı.'
    };
    return labels[reason] || (reason ? `Kullanılamıyor: ${reason}` : 'Kullanılamıyor.');
}

function storyTalkCharacterActionCost(action) {
    const cost = action && action.cost || {};
    const domainCost = action && action.domainCost || {};
    if (Number(domainCost.manpower) > 0) return `${Number(domainCost.manpower)} insan gücü`;
    if (Number(domainCost.points) > 0) return `${Number(domainCost.points)} bütçe puanı`;
    if (!cost.key || !(Number(cost.amount) > 0)) return 'Bedel yok';
    const labels = { influence: 'nüfuz', credibility: 'güvenilirlik', autonomy: 'özerklik', capability: 'kapasite' };
    const available = Number(cost.available);
    return `${Number(cost.amount)} ${labels[cost.key] || cost.key}`
        + (Number.isFinite(available) ? ` · mevcut ${Math.round(available)}` : '');
}

function storyTalkCharacterActionHtml(targetActorId, targetRegionId) {
    if (typeof storyCharacterActionPlayerView !== 'function') return '';
    const view = storyCharacterActionPlayerView(targetActorId, {
        commandType: 'MOBILIZE_RESERVE', targetRegionId
    });
    if (!view || view.disabled) {
        return `<div class="talk-note">Hedefli karakter eylemleri şu anda kullanılamıyor.</div>`;
    }
    const esc = typeof storyCityDossierEscape === 'function'
        ? storyCityDossierEscape : value => String(value);
    return `<div class="talk-card character-action-card"><div class="talk-card-h">`
        + `<span>DOĞRUDAN EYLEMLER</span><span class="talk-age">${view.actions.length} aday</span></div>`
        + `<div class="talk-note">Bunlar sohbet süsü değildir: bedel harcar, ilişkiyi ve karakter hafızasını kalıcı değiştirir.</div>`
        + `<div class="talk-opts">${view.actions.map(action => {
            const copy = STORY_TALK_CHARACTER_ACTION_COPY[action.actionType] || { detail: '' };
            const status = action.allowed ? storyTalkCharacterActionCost(action) : storyTalkCharacterActionReason(action);
            return `<button class="talk-opt character-action-opt" data-character-action="${esc(action.actionType)}" `
                + `data-character-target="${esc(view.targetActorId)}" `
                + `data-character-region="${esc(action.domainContext && action.domainContext.targetRegionId || '')}" `
                + `data-character-command="${esc(action.domainContext && action.domainContext.commandType || '')}"`
                + `${action.allowed ? '' : ' disabled'}>`
                + `<b>${esc(action.label)}</b><span class="talk-tip">${esc(copy.detail)} ${esc(status)}</span></button>`;
        }).join('')}</div></div>`;
}

function storyTalkCharacterActionMessage(actionType, result) {
    const labels = { PERSUADE: 'İkna girişimi', NEGOTIATE: 'Müzakere', ALLY: 'Kişisel ittifak', BETRAY: 'İhanet', ORDER: 'Seferberlik emri', SABOTAGE: 'Sabotaj operasyonu' };
    if (result && result.ok && actionType === 'ORDER') return 'Seferberlik emri kurum zincirine alındı; saha sonucu uygulama kapasitesi tamamlandığında oluşacak.';
    if (result && result.ok && actionType === 'SABOTAGE') return 'Sabotaj operasyonu başlatıldı; fiziksel sonuç ve tespit 30 saniye sonra çözülecek.';
    if (result && result.ok) return `${labels[actionType] || actionType} uygulandı ve dünya kaydına işlendi.`;
    const action = result && result.candidate;
    return storyTalkCharacterActionReason(action || { reasons: [result && result.reason || 'ACTION_FAILED'] });
}

const STORY_TALK_CONVERSATION_STATUS = Object.freeze({
    REJECTED: 'GİRDİ REDDEDİLDİ',
    NEEDS_CLARIFICATION: 'AÇIKLAMA BEKLİYOR',
    READY_FOR_DOMAIN_REVIEW: 'MEKANİK İNCELEMEYE HAZIR',
    READY_FOR_REVIEW: 'İNCELEMEYE HAZIR',
    DOMAIN_REVIEW_NEEDS_EVIDENCE: 'MUHATAP KANIT BEKLİYOR',
    DOMAIN_REVIEW_COUNTER_OFFER: 'MUHATAP KARŞI TEKLİF VERDİ',
    DOMAIN_REVIEW_REJECTED: 'MUHATAP REDDETTİ',
    READY_FOR_NEGOTIATION: 'MÜZAKEREYE HAZIR',
    NEGOTIATION_DECLINED: 'GÖRÜŞME SONLANDI',
    NEGOTIATION_DEFERRED: 'GÖRÜŞME BEKLEMEDE'
});

function storyTalkConversationEscape(value) {
    if (typeof storyProjectionEscape === 'function') return storyProjectionEscape(value);
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

function storyTalkConversationDate(seconds) {
    return typeof storyCalendarAt === 'function'
        ? storyCalendarAt(Number(seconds) || 0).label
        : `T+${Math.max(0, Math.round(Number(seconds) || 0))}`;
}

function storyTalkConversationPlayerActorId() {
    return STORY.commander ? `character:${STORY.playerStateId | 0}:${STORY.commander.id}` : null;
}

function storyTalkConversationRelationHtml(listenerActorId) {
    const esc = storyTalkConversationEscape;
    const playerActorId = storyTalkConversationPlayerActorId();
    const relation = playerActorId && typeof storyRelationshipView === 'function'
        ? storyRelationshipView(listenerActorId, playerActorId) : null;
    if (!relation) return `<div class="conversation-empty">Bu kişinin sana dönük ilişki kaydı henüz oluşmadı.</div>`;
    const rows = [
        ['GÜVEN', relation.trustBps, 'positive'],
        ['SAYGI', relation.respectBps, 'positive'],
        ['ÇEKİNCE', relation.fearBps, 'warning'],
        ['BORÇ', relation.debtBps, 'warning'],
        ['HUSUMET', relation.hostilityBps, 'danger']
    ];
    return `<div class="conversation-relation-list">${rows.map(row => {
        const percent = Math.max(0, Math.min(100, Math.round((Number(row[1]) || 0) / 100)));
        return `<div class="conversation-relation-row"><span>${esc(row[0])}</span>`
            + `<div class="conversation-relation-track"><i class="${esc(row[2])}" style="width:${percent}%"></i></div>`
            + `<b>${percent}</b></div>`;
    }).join('')}</div>`;
}

function storyTalkConversationProfileHtml(listenerActorId) {
    const esc = storyTalkConversationEscape;
    const directory = typeof storyContactDirectoryBuild === 'function'
        ? storyContactDirectoryBuild() : null;
    const row = directory && directory.publicCharacters
        ? directory.publicCharacters.find(candidate => candidate.id === String(listenerActorId)) : null;
    const roleLabels = {
        EXECUTIVE: 'Devlet yöneticisi', POLITICAL_FIGURE: 'Siyasi isim',
        POLITICAL_CANDIDATE: 'Siyasi aday', COMMANDER: 'Komutan', AGENT: 'Ajan',
        COMPANY_OWNER: 'Şirket sahibi', COMPANY_EXECUTIVE: 'Şirket yöneticisi', MAYOR: 'Belediye başkanı'
    };
    const role = row && row.role || 'CHARACTER';
    const contact = row && row.own ? 'AYNI ÜLKE'
        : (row && row.directContact ? 'DOĞRULANMIŞ TEMAS' : 'KAMUSAL SİCİL');
    return `<div class="conversation-section-title">KİŞİ PROFİLİ</div>`
        + `<div class="conversation-profile-card"><span class="conversation-profile-status">${esc(contact)}</span>`
        + `<h3>${esc(row && row.name || STORY._talkFocusCharacterName || listenerActorId)}</h3>`
        + `<p>${esc(row && (row.publicTitle || roleLabels[role]) || roleLabels[role] || role)}</p>`
        + `<dl><div><dt>ÜLKE / KURUM</dt><dd>${esc(row && row.countryName || 'Bilinmiyor')}</dd></div>`
        + `<div><dt>ROL</dt><dd>${esc(roleLabels[role] || role)}</dd></div></dl></div>`
        + `<div class="conversation-section-title">SANA BAKIŞI</div>`
        + storyTalkConversationRelationHtml(listenerActorId)
        + `<div class="conversation-profile-note">Gizli kişilik değerleri gösterilmez. Profil, kamusal sicil ve doğrulanmış ilişkinizden oluşur.</div>`;
}

function storyTalkConversationKnownRecords(listenerActorId) {
    const playerActorId = storyTalkConversationPlayerActorId();
    if (!playerActorId || typeof storyContactDirectoryContext !== 'function') return [];
    const knowledge = storyContactDirectoryContext().knowledge || {};
    const paired = row => {
        const actors = [row.actorId, row.targetActorId, row.subjectActorId]
            .concat(row.relatedActorIds || [], row.holderActorIds || []).filter(Boolean);
        return actors.includes(playerActorId) && actors.includes(String(listenerActorId));
    };
    const actionLabels = {
        PERSUADE: 'İkna girişimi', NEGOTIATE: 'Müzakere kaydı', ALLY: 'Kişisel ittifak',
        BETRAY: 'İhanet kaydı', ORDER: 'Verilen emir', SABOTAGE: 'Operasyon kaydı'
    };
    const actions = (knowledge.characterActions || []).filter(row => paired(row) && row.status === 'APPLIED')
        .map(row => ({
            id: row.id, kind: actionLabels[row.actionType] || row.actionType,
            summary: row.actionType === 'ALLY' ? 'Kalıcı kişisel ittifak uygulandı.'
                : row.actionType === 'NEGOTIATE' ? 'İki taraflı müzakere sonuçlandı.'
                    : `${actionLabels[row.actionType] || row.actionType} dünya kaydına işlendi.`,
            status: row.status, at: Number(row.completedAt) || 0
        }));
    const memory = knowledge.characterMemory || {};
    const visibleKinds = new Set(['PROMISE', 'ALLIANCE', 'BETRAYAL', 'DEBT']);
    const milestones = Object.values(memory.milestones || {}).filter(row => paired(row) && visibleKinds.has(row.kind))
        .map(row => ({
            id: row.id, kind: ({ PROMISE: 'Verilen söz', ALLIANCE: 'İttifak bağı',
                BETRAYAL: 'İhanet hafızası', DEBT: 'Kişisel borç' })[row.kind] || row.kind,
            summary: row.summary, status: row.status, at: Number(row.createdAt) || 0
        }));
    return actions.concat(milestones).sort((a, b) => b.at - a.at || b.id.localeCompare(a.id, 'en')).slice(0, 12);
}

function storyTalkConversationRecordsHtml(listenerActorId) {
    const esc = storyTalkConversationEscape;
    const rows = storyTalkConversationKnownRecords(listenerActorId);
    if (!rows.length) return `<div class="conversation-empty">Bu kişiyle uygulanmış bir anlaşma, söz veya kalıcı bağ yok.</div>`;
    return rows.map(row => `<article class="conversation-record"><div><b>${esc(row.kind)}</b>`
        + `<time>${esc(storyTalkConversationDate(row.at))}</time></div><p>${esc(row.summary)}</p>`
        + `<span>${esc(row.status)}</span></article>`).join('');
}

function storyTalkConversationDomainReviewHtml(review) {
    if (!review || !review.response) return '';
    const esc = storyTalkConversationEscape;
    const statusClass = review.decision === 'REJECT' ? ' danger'
        : review.decision === 'PROCEED_TO_NEGOTIATION' ? ' ready' : '';
    const checks = (review.checks || []).map(row => {
        const label = row.status === 'PASS' ? 'DOĞRULANDI'
            : row.status === 'FAIL' ? 'ENGEL'
                : row.status === 'UNKNOWN' ? 'BİLİNMİYOR' : 'BEKLİYOR';
        return `<li class="${esc(String(row.status).toLocaleLowerCase('tr'))}"><b>${esc(label)}</b>`
            + `<span>${esc(row.publicText)}</span></li>`;
    }).join('');
    return `<section class="conversation-listener-response${statusClass}" data-domain-review="${esc(review.id)}">`
        + `<header><span>DOĞRULANMIŞ KARAKTER CEVABI</span><small>${esc(review.response.speechAct)}</small></header>`
        + `<blockquote>“${esc(review.response.text)}”</blockquote>`
        + `<ul>${checks}</ul>`
        + `<div class="conversation-safety-note">MUHATAP YALNIZ KENDİ ACTORBELIEF KAYITLARINI OKUDU · DÜNYA DEĞİŞMEDİ</div>`
        + `</section>`;
}

function storyTalkConversationResponseOptionsHtml(session) {
    const esc = storyTalkConversationEscape;
    const options = typeof storyConversationSessionResponseOptions === 'function'
        ? storyConversationSessionResponseOptions(session) : [];
    if (session.resolution) {
        const deferred = session.resolution.status === 'NEGOTIATION_DEFERRED';
        return `<section class="conversation-resolution${deferred ? '' : ' danger'}"><b>${deferred ? 'GÖRÜŞME BEKLEMEDE' : 'GÖRÜŞME SONLANDI'}</b>`
            + `<p>${deferred ? 'Yeni şirket kuruluşu ayrı bir mekanik işlemle tamamlanmadan bu taslak ilerlemeyecek.'
                : 'Teklif ve karşı teklif uygulanmadan kapatıldı.'}</p></section>`;
    }
    if (!options.length) {
        if (session.status !== 'READY_FOR_NEGOTIATION') return '';
        const negotiation = typeof storyNegotiationCaseBySession === 'function'
            ? storyNegotiationCaseBySession(session.id) : null;
        if (negotiation) {
            const current = (negotiation.versions || []).find(row => row.id === negotiation.currentVersionId);
            const pending = (negotiation.requiredApprovals || []).filter(row => row.status !== 'APPROVED').length;
            const negotiationLedger = typeof storyNegotiationSnapshot === 'function'
                ? storyNegotiationSnapshot() : null;
            const secretCount = Object.values(negotiationLedger && negotiationLedger.secrets || {})
                .filter(row => row.caseId === negotiation.id).length;
            const delivery = Object.values(negotiationLedger && negotiationLedger.deliveryObligations || {})
                .find(row => row.caseId === negotiation.id && row.versionId === negotiation.currentVersionId) || null;
            const lastReview = (negotiation.mechanicalReviews || [])
                .filter(row => row.versionId === negotiation.currentVersionId).slice(-1)[0] || null;
            const reviewText = lastReview
                ? `<p>MEKANİK ÖN KONTROL: ${esc(lastReview.status)} · ${esc((lastReview.blockerCodes || []).slice(0, 4).join(' · ') || 'engel yok')}</p>`
                : '';
            const preflightButton = negotiation.status === 'ACCEPTED_PENDING_APPROVAL'
                ? `<button class="story-btn" data-negotiation-mechanical-preflight="${esc(negotiation.id)}" `
                    + `data-negotiation-actor="${esc(session.playerActorId)}">MEKANİK ÖN KONTROL</button>`
                : '';
            const activateButton = negotiation.status === 'ACCEPTED_PENDING_APPROVAL'
                && lastReview && lastReview.status === 'READY'
                ? `<button class="story-btn" data-negotiation-delivery-activate="${esc(negotiation.id)}" `
                    + `data-negotiation-actor="${esc(session.playerActorId)}">SÖZLEŞMEYİ ETKİNLEŞTİR</button>`
                : '';
            const deliveryText = delivery
                ? `<p>TESLİM: ${esc(delivery.status)} · son tarih ${esc(storyTalkConversationDate(delivery.dueAt))} · `
                    + `${esc(delivery.quantity)} ${esc(delivery.resourceId)} · ödeme ${esc(delivery.paymentAmount)} · `
                    + `ceza ${esc(delivery.penaltyAmount)}</p>`
                : '';
            const mutationNotice = delivery
                ? 'Sözleşme gerçek sevkiyat, escrow ve teslim makbuzuna bağlıdır.'
                : 'Taraf kabulü fiziksel icra değildir; stok ve sevkiyat değişmedi.';
            return `<section class="conversation-ready negotiation-open"><b>MÜZAKERE VAKASI AÇIK</b>`
                + `<p>${esc(negotiation.id)} · sürüm ${esc(current && current.number || 1)} · ${esc(negotiation.status)}</p>`
                + reviewText + deliveryText
                + `<small>${pending} onay bekliyor · ${secretCount} kayıtlı gizli paylaşım. Gizli içerik bu özette gösterilmez. `
                + `${mutationNotice}</small>${preflightButton}${activateButton}</section>`;
        }
        return `<section class="conversation-ready"><b>DOĞRULANMIŞ MÜZAKERE HAZIRLIĞI</b>`
            + `<p>Taraflar ve temel iddialar görüşmeye hazır. Henüz sözleşme, ödeme veya sevkiyat oluşmadı.</p>`
            + `<button class="story-btn" data-negotiation-case-open="${esc(session.id)}">MÜZAKERE VAKASI AÇ</button></section>`;
    }
    return `<section class="conversation-response-actions"><header>CEVABINI SEÇ</header>`
        + `<p>Yalnız doğrulanabilen seçenekler gösterilir. Seçim fiziksel dünyayı veya sevkiyatı kendiliğinden değiştirmez.</p>`
        + `<div>${options.map(option => `<button class="conversation-response-option" `
            + `data-conversation-player-response="${esc(option.id)}" data-conversation-session="${esc(session.id)}">`
            + `<b>${esc(option.label)}</b><small>${esc(option.detail)}</small></button>`).join('')}</div></section>`;
}

function storyTalkConversationSessionHtml(listenerActorId, requestedSessionId) {
    if (typeof storyConversationSessionLatest !== 'function') return '';
    const esc = storyTalkConversationEscape;
    let session = requestedSessionId && typeof storyConversationSessionGet === 'function'
        ? storyConversationSessionGet(requestedSessionId) : null;
    if (session && session.listenerActorId !== String(listenerActorId)) session = null;
    if (!session && requestedSessionId) STORY._conversationWorkspaceSessionId = null;
    let html = `<section class="conversation-composer"><div class="conversation-composer-head">`
        + `<div><span>AKTİF KONUŞMA</span><small>${session ? esc(STORY_TALK_CONVERSATION_STATUS[session.status] || session.status) : 'YENİ TASLAK'}</small></div>`
        + (session ? `<button class="story-btn" data-conversation-new="1">YENİ KONUŞMA</button>` : '')
        + `</div>`;
    if (!session) {
        html += `<div class="conversation-empty-state"><b>SÖZ SENDE</b>`
            + `<p>Teklifini, sorunu veya talebini doğal biçimde yaz. Sistem belirsiz kısımları tek tek sorar; metin tek başına dünyayı değiştirmez.</p></div>`
            + `<label class="conversation-input-label" for="conversation-workspace-input">NE SÖYLEMEK İSTİYORSUN?</label>`
            + `<textarea id="conversation-workspace-input" data-conversation-input maxlength="1200" rows="7" `
            + `placeholder="Örn: İngiltere'den verdiğin çelik siparişini benim depoma yönlendirelim..."></textarea>`
            + `<div class="conversation-submit-row"><small>CTRL + ENTER ile gönderebilirsin.</small>`
            + `<button class="story-btn" data-conversation-send="${esc(listenerActorId)}">SÖZÜ ANALİZ ET VE TASLAĞA AL</button></div>`;
        return html + `</section>`;
    }
    html += `<article class="conversation-current"><div class="conversation-current-meta">`
        + `<time>${esc(storyTalkConversationDate(session.createdAt))}</time>`
        + `<span>${session.turns.length} açıklama</span></div>`
        + `<blockquote>${esc(session.initialText)}</blockquote>`
        + `<div class="conversation-understood"><span>ANLAŞILAN NİYET</span>`
        + `<b>${esc(session.analysis.speechAct)} · ${esc(session.analysis.playerIntent)}</b></div>`
        + `<div class="conversation-safety-note">DÜNYA DEĞİŞMEDİ · ${session.domainChecks.length} gerçek motor denetimi bekliyor</div>`;
    if (session.domainReview) html += storyTalkConversationDomainReviewHtml(session.domainReview);
    html += storyTalkConversationResponseOptionsHtml(session);
    if (session) {
        const question = session.questions.find(row => row.status === 'OPEN');
        if (question) {
            html += `<div class="conversation-question"><span>MUHATABIN NETLEŞTİRME İSTİYOR</span><h3>${esc(question.prompt)}</h3>`;
            if (question.options.length) {
                const visibleOptions = question.options.slice(0, 8);
                html += `<div class="conversation-options">${visibleOptions.map(option =>
                    `<button class="conversation-option" data-conversation-option="${esc(option.id)}" `
                    + `data-conversation-session="${esc(session.id)}" data-conversation-question="${esc(question.id)}">`
                    + `<b>${esc(option.label)}</b></button>`).join('')}</div>`
                    + (question.options.length > visibleOptions.length
                        ? `<div class="conversation-muted">${question.options.length} adaydan ilk ${visibleOptions.length} gösteriliyor.</div>` : '');
            } else {
                html += `<input data-conversation-reply maxlength="240" placeholder="Yanıtını yaz">`
                    + `<div class="conversation-submit-row"><small>CTRL + ENTER ile gönderebilirsin.</small><button class="story-btn" data-conversation-reply-send="1" `
                    + `data-conversation-session="${esc(session.id)}" data-conversation-question="${esc(question.id)}">YANITI TASLAĞA EKLE</button></div>`;
            }
            html += `</div>`;
        }
        if (session.status === 'READY_FOR_DOMAIN_REVIEW') {
            html += `<div class="conversation-ready"><b>TASLAK HAZIR</b><p>Açıklamalar tamamlandı. `
                + `Sahiplik, yetki, kapasite ve doğrulanmamış iddialar gerçek motor defterlerinden incelenmeden uygulanamaz.</p>`
                + `<button class="story-btn" data-conversation-domain-review="${esc(session.id)}">MEKANİK ÖN İNCELEMEYİ BAŞLAT</button></div>`;
        }
    }
    return html + `</article></section>`;
}

function storyTalkConversationHistoryHtml(listenerActorId) {
    const esc = storyTalkConversationEscape;
    const sessions = typeof storyConversationSessionList === 'function'
        ? storyConversationSessionList(listenerActorId) : [];
    if (!sessions.length) return `<div class="conversation-empty">Bu kişiyle kayıtlı eski konuşma yok.</div>`;
    return sessions.map(session => {
        const active = session.id === STORY._conversationWorkspaceSessionId;
        const openCount = session.questions.filter(row => row.status === 'OPEN').length;
        const excerpt = session.initialText.length > 104 ? `${session.initialText.slice(0, 101)}…` : session.initialText;
        return `<article class="conversation-history-row${active ? ' active' : ''}">`
            + `<div><time>${esc(storyTalkConversationDate(session.updatedAt))}</time>`
            + `<span>${esc(STORY_TALK_CONVERSATION_STATUS[session.status] || session.status)}</span></div>`
            + `<p>${esc(excerpt)}</p><small>${openCount ? `${openCount} açık soru` : 'Açıklamalar tamamlandı'}</small>`
            + `<button class="story-btn" data-conversation-resume="${esc(session.id)}"${active ? ' disabled' : ''}>`
            + `${active ? 'AÇIK' : (openCount ? 'DEVAM ET' : 'İNCELE')}</button></article>`;
    }).join('');
}

function storyConversationWorkspaceRender() {
    const modal = document.getElementById('conversation-workspace-modal');
    if (!modal || modal.classList.contains('hidden')) return;
    const listenerActorId = modal.dataset.listenerActorId || STORY._talkFocusCharacterId;
    if (!listenerActorId) return;
    const esc = storyTalkConversationEscape;
    const directory = typeof storyContactDirectoryBuild === 'function' ? storyContactDirectoryBuild() : null;
    const row = directory && directory.publicCharacters
        ? directory.publicCharacters.find(candidate => candidate.id === String(listenerActorId)) : null;
    const name = row && row.name || STORY._talkFocusCharacterName || listenerActorId;
    const role = row && (row.publicTitle || row.role) || 'Karakter';
    const country = row && row.countryName || 'Bilinmeyen kurum';
    const nameElement = document.getElementById('conversation-workspace-name');
    const metaElement = document.getElementById('conversation-workspace-meta');
    if (nameElement) nameElement.textContent = name;
    if (metaElement) metaElement.textContent = `${role} · ${country}`;
    const profile = document.getElementById('conversation-workspace-profile');
    const main = document.getElementById('conversation-workspace-main');
    const history = document.getElementById('conversation-workspace-history');
    if (profile) profile.innerHTML = storyTalkConversationProfileHtml(listenerActorId);
    if (main) main.innerHTML = storyTalkConversationSessionHtml(
        listenerActorId, STORY._conversationWorkspaceSessionId
    );
    if (history) history.innerHTML = `<div class="conversation-history-block"><div class="conversation-section-title">ÖNCEKİ KONUŞMALAR</div>`
        + storyTalkConversationHistoryHtml(listenerActorId) + `</div>`
        + `<div class="conversation-history-block"><div class="conversation-section-title">ANLAŞMALAR & KAYITLAR</div>`
        + storyTalkConversationRecordsHtml(listenerActorId) + `</div>`;
}

function storyConversationWorkspaceOpen(listenerActorId, name, requestedSessionId) {
    const modal = document.getElementById('conversation-workspace-modal');
    if (!modal || !listenerActorId) return false;
    STORY._talkFocusCharacterId = String(listenerActorId);
    if (name) STORY._talkFocusCharacterName = String(name);
    const latest = typeof storyConversationSessionLatest === 'function'
        ? storyConversationSessionLatest(listenerActorId) : null;
    STORY._conversationWorkspaceSessionId = requestedSessionId || (latest && latest.id) || null;
    modal.dataset.listenerActorId = String(listenerActorId);
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    storyConversationWorkspaceRender();
    const focusTarget = modal.querySelector('[data-conversation-input], [data-conversation-reply], [data-conversation-new]');
    if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus();
    return true;
}

function storyConversationWorkspaceClose() {
    const modal = document.getElementById('conversation-workspace-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    delete modal.dataset.listenerActorId;
}

function storyConversationWorkspaceHandleClick(event) {
    const modal = document.getElementById('conversation-workspace-modal');
    if (!modal) return;
    const resume = event.target.closest('[data-conversation-resume]');
    if (resume) {
        STORY._conversationWorkspaceSessionId = resume.dataset.conversationResume;
        storyConversationWorkspaceRender();
        return;
    }
    if (event.target.closest('[data-conversation-new]')) {
        STORY._conversationWorkspaceSessionId = null;
        storyConversationWorkspaceRender();
        modal.querySelector('[data-conversation-input]')?.focus();
        return;
    }
    const reviewButton = event.target.closest('[data-conversation-domain-review]');
    if (reviewButton && typeof storyConversationSessionReview === 'function') {
        const result = storyConversationSessionReview(reviewButton.dataset.conversationDomainReview);
        storyFlash(result && result.ok ? 'Muhatap kendi bilgisi ve yetkisiyle teklifi inceledi.'
            : `İnceleme başlatılamadı: ${result && result.code || 'UNKNOWN'}`);
        if (result && result.ok && typeof storySave === 'function') storySave();
        storyConversationWorkspaceRender();
        return;
    }
    const playerResponse = event.target.closest('[data-conversation-player-response]');
    if (playerResponse && typeof storyConversationSessionRespond === 'function') {
        const result = storyConversationSessionRespond(
            playerResponse.dataset.conversationSession,
            playerResponse.dataset.conversationPlayerResponse
        );
        storyFlash(result && result.ok
            ? (result.knowledgeMutation ? 'Kaynaklı kanıt muhataba sunuldu ve teklif yeniden incelendi.'
                : 'Cevabın görüşme taslağına işlendi.')
            : `Cevap reddedildi: ${result && result.code || 'UNKNOWN'}`);
        if (result && result.ok && typeof storySave === 'function') storySave();
        storyConversationWorkspaceRender();
        return;
    }
    const negotiationOpen = event.target.closest('[data-negotiation-case-open]');
    if (negotiationOpen && typeof storyNegotiationCaseOpen === 'function') {
        const result = storyNegotiationCaseOpen(negotiationOpen.dataset.negotiationCaseOpen);
        storyFlash(result && result.ok
            ? 'Sürümlü müzakere vakası açıldı; hiçbir fiziksel işlem uygulanmadı.'
            : `Müzakere vakası açılamadı: ${result && result.code || 'UNKNOWN'}`);
        if (result && result.ok && typeof storySave === 'function') storySave();
        storyConversationWorkspaceRender();
        return;
    }
    const negotiationPreflight = event.target.closest('[data-negotiation-mechanical-preflight]');
    if (negotiationPreflight && typeof storyNegotiationMechanicalPreflight === 'function') {
        const result = storyNegotiationMechanicalPreflight(
            negotiationPreflight.dataset.negotiationMechanicalPreflight,
            negotiationPreflight.dataset.negotiationActor
        );
        const blockers = result && result.review && result.review.blockerCodes || [];
        storyFlash(result && result.ok
            ? (result.code === 'PREFLIGHT_READY'
                ? 'Mekanik ön kontrol hazır; yine de fiziksel icra uygulanmadı.'
                : `Mekanik ön kontrol engellendi: ${blockers.slice(0, 3).join(', ')}`)
            : `Mekanik ön kontrol çalışmadı: ${result && result.code || 'UNKNOWN'}`);
        if (result && result.ok && typeof storySave === 'function') storySave();
        storyConversationWorkspaceRender();
        return;
    }
    const negotiationActivation = event.target.closest('[data-negotiation-delivery-activate]');
    if (negotiationActivation && typeof storyNegotiationDeliveryObligationCreate === 'function') {
        const result = storyNegotiationDeliveryObligationCreate(
            negotiationActivation.dataset.negotiationDeliveryActivate,
            negotiationActivation.dataset.negotiationActor
        );
        storyFlash(result && result.ok
            ? 'Sözleşme etkin: ödeme escrow’da, sevkiyat gerçek rotaya yönlendirildi ve son tarih izleniyor.'
            : `Sözleşme etkinleştirilemedi: ${result && result.code || 'UNKNOWN'}`);
        if (result && result.ok && typeof storySave === 'function') storySave();
        storyConversationWorkspaceRender();
        return;
    }
    const conversationSend = event.target.closest('[data-conversation-send]');
    if (conversationSend && typeof storyConversationSessionBegin === 'function') {
        const input = modal.querySelector('[data-conversation-input]');
        const result = storyConversationSessionBegin(input && input.value, {
            listenerActorId: conversationSend.dataset.conversationSend,
            focusRegionId: STORY._talkFocusRegionId
        });
        if (result && result.session) STORY._conversationWorkspaceSessionId = result.session.id;
        storyFlash(result && result.ok ? 'Sözün kaydedildi; belirsiz noktalar sırayla sorulacak.'
            : 'Bu söz güvenli biçimde analiz edilemedi.');
        if (typeof storySave === 'function') storySave();
        storyConversationWorkspaceRender();
        storyTalkUpdate();
        return;
    }
    const conversationOption = event.target.closest('[data-conversation-option]');
    if (conversationOption && typeof storyConversationSessionReply === 'function') {
        const result = storyConversationSessionReply(
            conversationOption.dataset.conversationSession,
            conversationOption.dataset.conversationQuestion,
            conversationOption.dataset.conversationOption
        );
        storyFlash(result && result.ok ? 'Açıklama taslağa eklendi.' : `Yanıt reddedildi: ${result && result.code || 'UNKNOWN'}`);
        if (result && result.ok && typeof storySave === 'function') storySave();
        storyConversationWorkspaceRender();
        return;
    }
    const conversationReply = event.target.closest('[data-conversation-reply-send]');
    if (conversationReply && typeof storyConversationSessionReply === 'function') {
        const input = modal.querySelector('[data-conversation-reply]');
        const result = storyConversationSessionReply(
            conversationReply.dataset.conversationSession,
            conversationReply.dataset.conversationQuestion,
            input && input.value
        );
        storyFlash(result && result.ok ? 'Açıklama taslağa eklendi.' : `Yanıt reddedildi: ${result && result.code || 'UNKNOWN'}`);
        if (result && result.ok && typeof storySave === 'function') storySave();
        storyConversationWorkspaceRender();
    }
}

function storyTalkUpdate() {
    if (!STORY._talkOpen) return;
    const body = document.getElementById('talk-body'); if (!body) return;
    const me = storyPlayerState(); if (!me) return;
    const active = storyTalkActiveView();
    STORY._talkView = active;
    let content = '';

    // Ağır karakter sicili yalnız oyuncu bu görünümü istediğinde kurulur.
    if (active === 'contacts') {
        content = typeof storyContactDirectoryBuild === 'function'
            && typeof storyContactDirectoryRenderHtml === 'function'
            ? storyContactDirectoryRenderHtml(storyContactDirectoryBuild())
            : `<div class="talk-sec"><div class="talk-note">Karakter sicili kullanılamıyor.</div></div>`;
    } else if (active === 'diplomacy') {
        const others = STORY.states.filter(s => s.id !== me.id && STORY.nodes.some(n => n.owner === s.id));
        const diploRows = others.map(s => {
            const v = storyRelValue(me.id, s.id), lab = storyRelLabel(v), t = TREATIES[storyTreaty(me.id, s.id)] || TREATIES.war;
            const pct = Math.round((v + 100) / 2);
            return `<div class="dip-row"><span class="dip-n" style="color:${s.color}">⬤ ${s.name}</span>`
                + `<span class="dip-t" style="color:${t.color}" title="${t.name}">${t.icon} ${t.name}</span>`
                + `<span class="dip-bar"><b style="width:${pct}%;background:${lab.c}"></b></span>`
                + `<span class="dip-v" style="color:${lab.c}" title="İlişki puanı ${v}">${lab.t} ${v > 0 ? '+' : ''}${v}</span></div>`;
        }).join('');
        content = `<div class="talk-sec"><div class="talk-h">🌍 DİPLOMASİ</div>`
            + `<div class="talk-note">Devlet ilişkileri ve yürürlükteki antlaşmalar. Karakter görüşmeleri ayrı Sohbet görünümündedir.</div>`
            + (diploRows || `<div class="talk-note">Sahnede başka devlet yok.</div>`) + `</div>`;
    } else {
        const talks = STORY._talks || [];
        const directedStatements = typeof storyCharacterSpeechPlayerInbox === 'function'
            ? storyCharacterSpeechPlayerInbox(6) : [];
        let directedHtml = '';
        if (directedStatements.length) {
            const esc = typeof storyProjectionEscape === 'function' ? storyProjectionEscape : value => String(value);
            directedHtml = `<div class="talk-sec character-statement-inbox"><div class="talk-h">◈ SANA SÖYLENENLER <b>${directedStatements.length}</b></div>`
                + `<div class="talk-note">Yalnız doğrudan sana yöneltilmiş karakter kararları gösterilir; başkalarının özel görüşmeleri açığa çıkmaz.</div>`
                + directedStatements.map(row => `<div class="talk-card"><div class="talk-card-h">`
                    + `<span>${esc(row.speakerName)}</span><span class="talk-age">${esc(row.speakerTitle || 'Karakter')}</span></div>`
                    + `<div class="talk-lines"><div>“${esc(row.text)}”</div></div></div>`).join('') + `</div>`;
        }

        let focusHtml = '';
        if (STORY._talkFocusCharacterId && STORY._talkFocusCharacterName) {
            const safeName = typeof storyCityDossierEscape === 'function'
                ? storyCityDossierEscape(STORY._talkFocusCharacterName)
                : String(STORY._talkFocusCharacterName);
            const sessionCount = typeof storyConversationSessionList === 'function'
                ? storyConversationSessionList(STORY._talkFocusCharacterId).length : 0;
            focusHtml = `<div class="talk-sec talk-focus"><div class="talk-h">HEDEFLİ KARAKTER TEMASI</div>`
                + `<div class="talk-card conversation-launch-card"><div class="talk-card-h"><span>${safeName}</span>`
                + `<span class="talk-age">${sessionCount} kayıtlı konuşma</span></div>`
                + `<div class="talk-note">Profil, eski görüşmeler, anlaşmalar ve yeni konuşma taslağı ayrı görüşme penceresinde açılır.</div>`
                + `<button class="story-btn conversation-launch" data-conversation-workspace-open="${storyTalkConversationEscape(STORY._talkFocusCharacterId)}">GÖRÜŞME PENCERESİNİ AÇ</button></div>`
                + storyTalkCharacterActionHtml(STORY._talkFocusCharacterId, STORY._talkFocusRegionId) + `</div>`;
        }
        content = focusHtml + directedHtml;

        // Faz 33: kriz bir tabloya bakılarak çözülmez; konuşma görünümünde kalır.
        const crisisView = typeof storyPoliticalCrisisPlayerView === 'function'
            ? storyPoliticalCrisisPlayerView() : null;
        if (crisisView && crisisView.activeCrisis) {
            const crisis = crisisView.activeCrisis;
            const leadName = storyPoliticalCrisisActorName(me, crisis.leadActorId);
            const loyalName = crisis.loyalistActorIds && crisis.loyalistActorIds.length
                ? storyPoliticalCrisisActorName(me, crisis.loyalistActorIds[0]) : 'Genelkurmay nöbetçi subayı';
            const esc = typeof storyProjectionEscape === 'function' ? storyProjectionEscape : value => String(value);
            const pct = value => `%${Math.round((Number(value) || 0) / 100)}`;
            content += `<div class="talk-sec political-crisis-workspace"><div class="talk-h">⚠️ İÇ SİYASİ KRİZ — ${esc(crisis.status)}</div>`
                + `<div class="talk-card crisis-card">`
                + `<div class="talk-card-h"><span style="color:${TALK_KIND_META.crisis.c}">👁️ ${esc(leadName)} ÇEVRESİ</span>`
                + `<span class="talk-age">Hazırlık ${pct(crisis.preparationBps)}</span></div>`
                + `<div class="talk-lines">`
                + `<div><b>${esc(loyalName)}:</b> “Komuta zincirinde emirlerinizi tartışan bir çevre var. İsimler ve hareketler artık aynı dosyada.”</div>`
                + `<div><b>${esc(leadName)}:</b> “Bizi yalnız sadakat puanıyla yargılamayın. Taleplerimizi dinlerseniz hâlâ konuşabiliriz.”</div>`
                + `<div class="talk-note">Koalisyon ${pct(crisis.coalitionBps)} · Karşı güç ${pct(crisis.counterBps)} · Bilgi ${pct(crisis.intelligenceBps)}. Sonuç zarla değil bu kaydın ilerleyişiyle belirlenir.</div>`
                + `</div><div class="talk-opts">`
                + `<button class="talk-opt" data-political-crisis-action="NEGOTIATE"><b>${esc(leadName)} ile doğrudan görüş</b><span class="talk-tip">25 komuta puanı · lider sadakati +7 · hazırlık ve koalisyon geriler</span></button>`
                + `<button class="talk-opt" data-political-crisis-action="SECURE_COMMAND"><b>${esc(loyalName)} ile komuta zincirini güvenceye al</b><span class="talk-tip">45 komuta puanı · kalıcı karşı güç oluşturur</span></button>`
                + `<button class="talk-opt" data-political-crisis-action="PUBLIC_ACCOUNT"><b>Kamu önünde açıklama yap</b><span class="talk-tip">2 itibar · bilgi ve karşı güç artar; komplo da sertleşebilir</span></button>`
                + `<button class="talk-opt" data-political-crisis-action="WAIT_AND_WATCH"><b>Müdahale etmeden izle</b><span class="talk-tip">Bedava · bilgi artar; karşı taraf 280 hazırlık kazanır</span></button>`
                + `</div></div></div>`;
        }

        content += `<div class="talk-sec"><div class="talk-h">💬 BEKLEYEN KONUŞMALAR <b>${talks.length}</b></div>`;
        if (!talks.length) content += `<div class="talk-note">Şu an seni arayan yok. Dünya döndükçe komutanların ve yabancı elçiler kapını çalacak.</div>`;
        for (const t of talks) {
            const m = TALK_KIND_META[t.kind] || TALK_KIND_META.internal;
            const age = Math.max(0, TALK_EXPIRE - ((STORY.clock || 0) - t.born));
            content += `<div class="talk-card" data-talk="${t.uid}">`
                + `<div class="talk-card-h"><span style="color:${m.c}">${m.ic} ${m.name}</span>`
                + `<span class="talk-age">${storyTalkRemainingLabel(age)}</span></div>`
                + `<div class="talk-lines">${t.lines.map(l => `<div>${l}</div>`).join('')}</div>`
                + `<div class="talk-opts">` + t.options.map((o, i) =>
                    `<button class="talk-opt" data-talk="${t.uid}" data-opt="${i}">`
                    + `<b>${o.text}</b>${o.tip ? `<span class="talk-tip">${o.tip}</span>` : ''}</button>`).join('')
                + `</div></div>`;
        }
        content += `</div>`;
        if (typeof storyChatterHtml === 'function') content += storyChatterHtml();
    }

    const html = storyTalkViewTabsHtml(active)
        + `<section class="talk-view-content" role="tabpanel" data-talk-view-panel="${active}">${content}</section>`;
    if (body.innerHTML !== html) {
        const sameView = body.dataset.talkActiveView === active;
        const previousScroll = Number(body.scrollTop) || 0;
        body.innerHTML = html;
        body.dataset.talkActiveView = active;
        if (sameView) body.scrollTop = previousScroll;
    }
}
function storyTalkAnswer(uid, optIdx) {
    const talks = STORY._talks || [];
    const t = talks.find(x => x.uid === uid); if (!t) return;
    const o = t.options[optIdx]; if (!o) return;
    const promiseCountBefore = Math.max(0, Math.floor(Number(STORY._promises) || 0));
    let res = null;
    try { res = o.run(t); } catch (e) { res = { fail: 'Bu seçenek uygulanamadı.' }; }
    if (res && res.fail) { storyFlash(res.fail); return; }         // başarısız → konuşma kuyrukta kalır
    if (t.memoryEpisodeId && typeof storyMemoryResolveEpisode === 'function') {
        storyMemoryResolveEpisode(t.memoryEpisodeId, (res && res.msg) || o.text || 'Karar verildi.');
    }
    const promiseCountAfter = Math.max(0, Math.floor(Number(STORY._promises) || 0));
    if (promiseCountAfter > promiseCountBefore && typeof storyMemoryRecordPromise === 'function') {
        const playerActorId = `character:${STORY.playerStateId | 0}:${STORY.commander.id}`;
        storyMemoryRecordPromise({
            subjectActorId: playerActorId, relatedActorId: t.speakerActorId,
            summary: `${o.text || 'Verilen söz'} — ${(res && res.msg) || 'Söz kayda geçti.'}`,
            importanceBps: 9500, talkTemplateId: t.tpl,
            source: { episodeId: t.memoryEpisodeId || null, talkUid: uid, talkTemplateId: t.tpl, promiseSequence: promiseCountAfter }
        });
    }
    STORY._talks = talks.filter(x => x.uid !== uid);
    const m = TALK_KIND_META[t.kind] || TALK_KIND_META.internal;
    storyLog(`${m.ic} <b>${t.title}</b> — ${(res && res.msg) || 'karar verildi'}`);
    storyTalkBadge();
    storyTalkUpdate();
    if (typeof storyPanelUpdate === 'function') storyPanelUpdate();
    if (typeof storyRender === 'function') storyRender();
    if (typeof storySave === 'function') storySave();
}

function storyTalkBind() {
    if (STORY_TALK_BOUND) return;
    STORY_TALK_BOUND = true;
    document.getElementById('story-talk-btn')?.addEventListener('click', storyTalkToggle);
    document.getElementById('talk-close')?.addEventListener('click', storyTalkClose);
    document.getElementById('talk-body')?.addEventListener('click', e => {
        const viewButton = e.target.closest('[data-talk-view]');
        if (viewButton) {
            const nextView = String(viewButton.dataset.talkView || '');
            if (STORY_TALK_VIEWS.includes(nextView) && STORY._talkView !== nextView) {
                STORY._talkView = nextView;
                storyTalkUpdate();
            }
            return;
        }
        const workspaceOpen = e.target.closest('[data-conversation-workspace-open]');
        if (workspaceOpen) {
            storyConversationWorkspaceOpen(
                workspaceOpen.dataset.conversationWorkspaceOpen,
                STORY._talkFocusCharacterName
            );
            return;
        }
        const conversationSend = e.target.closest('[data-conversation-send]');
        if (conversationSend && typeof storyConversationSessionBegin === 'function') {
            const input = document.querySelector('[data-conversation-input]');
            const result = storyConversationSessionBegin(input && input.value, {
                listenerActorId: conversationSend.dataset.conversationSend,
                focusRegionId: STORY._talkFocusRegionId
            });
            storyFlash(result && result.ok ? 'Sözün kaydedildi; belirsiz noktalar sırayla sorulacak.'
                : 'Bu söz güvenli biçimde analiz edilemedi.');
            if (typeof storySave === 'function') storySave();
            storyTalkUpdate();
            return;
        }
        const conversationOption = e.target.closest('[data-conversation-option]');
        if (conversationOption && typeof storyConversationSessionReply === 'function') {
            const result = storyConversationSessionReply(
                conversationOption.dataset.conversationSession,
                conversationOption.dataset.conversationQuestion,
                conversationOption.dataset.conversationOption
            );
            storyFlash(result && result.ok ? 'Açıklama taslağa eklendi.' : `Yanıt reddedildi: ${result && result.code || 'UNKNOWN'}`);
            if (result && result.ok && typeof storySave === 'function') storySave();
            storyTalkUpdate();
            return;
        }
        const conversationReply = e.target.closest('[data-conversation-reply-send]');
        if (conversationReply && typeof storyConversationSessionReply === 'function') {
            const input = document.querySelector('[data-conversation-reply]');
            const result = storyConversationSessionReply(
                conversationReply.dataset.conversationSession,
                conversationReply.dataset.conversationQuestion,
                input && input.value
            );
            storyFlash(result && result.ok ? 'Açıklama taslağa eklendi.' : `Yanıt reddedildi: ${result && result.code || 'UNKNOWN'}`);
            if (result && result.ok && typeof storySave === 'function') storySave();
            storyTalkUpdate();
            return;
        }
        const registryToggle = e.target.closest('[data-contact-registry-toggle]');
        if (registryToggle && typeof storyContactDirectoryToggleRegistry === 'function') {
            storyContactDirectoryToggleRegistry();
            return;
        }
        const contactButton = e.target.closest('[data-contact-character]');
        if (contactButton && typeof storyContactDirectoryOpenCharacter === 'function') {
            const opened = storyContactDirectoryOpenCharacter(
                contactButton.dataset.contactCharacter,
                contactButton.dataset.contactName
            );
            if (!opened) storyFlash('Bu karakterle doğrulanmış doğrudan temasın yok.');
            return;
        }
        const characterActionButton = e.target.closest('[data-character-action]');
        if (characterActionButton && typeof storyCharacterActionExecutePlayer === 'function') {
            const actionType = String(characterActionButton.dataset.characterAction || '').toUpperCase();
            const result = storyCharacterActionExecutePlayer(
                actionType,
                characterActionButton.dataset.characterTarget,
                {
                    commandType: characterActionButton.dataset.characterCommand,
                    targetRegionId: characterActionButton.dataset.characterRegion,
                    targetAssetId: characterActionButton.dataset.characterAsset,
                    assetType: characterActionButton.dataset.characterAssetType
                }
            );
            storyFlash(storyTalkCharacterActionMessage(actionType, result));
            if (result && result.ok) {
                const targetName = characterActionButton.dataset.characterTargetName
                    || STORY._talkFocusCharacterName || characterActionButton.dataset.characterTarget;
                storyLog(`👤 <b>${targetName}</b> — ${storyTalkCharacterActionMessage(actionType, result)}`);
                if (typeof storySave === 'function') storySave();
            }
            storyTalkUpdate();
            if (typeof storyPanelUpdate === 'function') storyPanelUpdate();
            if (typeof storyRender === 'function') storyRender();
            return;
        }
        const crisisButton = e.target.closest('[data-political-crisis-action]');
        if (crisisButton && typeof storyPoliticalCrisisAct === 'function') {
            const result = storyPoliticalCrisisAct(STORY.playerStateId, crisisButton.dataset.politicalCrisisAction);
            storyFlash(storyPoliticalCrisisActionMessage(crisisButton.dataset.politicalCrisisAction, result));
            storyTalkUpdate();
            if (typeof storyPanelUpdate === 'function') storyPanelUpdate();
            if (typeof storyRender === 'function') storyRender();
            return;
        }
        const b = e.target.closest('.talk-opt'); if (!b) return;
        storyTalkAnswer(+b.dataset.talk, +b.dataset.opt);
    });
    const workspace = document.getElementById('conversation-workspace-modal');
    workspace?.addEventListener('click', event => {
        if (event.target === workspace) {
            storyConversationWorkspaceClose();
            return;
        }
        storyConversationWorkspaceHandleClick(event);
    });
    document.getElementById('conversation-workspace-close')?.addEventListener('click', storyConversationWorkspaceClose);
    workspace?.addEventListener('keydown', event => {
        // Pencere içindeki tuşlar kameraya, savaş kısayollarına veya belge
        // dinleyicilerine ulaşmaz; yazı girdisinin varsayılan davranışı korunur.
        event.stopPropagation();
        if (event.key === 'Escape') {
            event.preventDefault();
            storyConversationWorkspaceClose();
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            const button = workspace.querySelector('[data-conversation-send], [data-conversation-reply-send]');
            if (button) {
                event.preventDefault();
                button.click();
            }
        }
    });
}
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', storyTalkBind);
    else storyTalkBind();
}
