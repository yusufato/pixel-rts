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
// Antlaşma katmanı. Varsayılan 'war': oyunun bugünkü davranışı korunur, diplomasi
// bunu yumuşatmak için kullanılır (aksi hâlde tüm dünya bir anda barışçı olurdu).
const TREATIES = {
    war:      { name: 'Savaş',            icon: '⚔️', hostile: true,  color: '#ff5a5a' },
    truce:    { name: 'Ateşkes',          icon: '🤍', hostile: false, color: '#ffd24c' },
    pact:     { name: 'Saldırmazlık',     icon: '📜', hostile: false, color: '#9fd2ff' },
    alliance: { name: 'İttifak',          icon: '🤝', hostile: false, color: '#4cff7c' },
};
const TRUCE_YEARS = 3;                 // ateşkes süresi (yıl)
function storyRelKey(a, b) { return Math.min(a, b) + '|' + Math.max(a, b); }
function storyRel(a, b) {
    if (a === b) return null;
    if (!STORY.rel) STORY.rel = {};
    const k = storyRelKey(a, b);
    return STORY.rel[k] || (STORY.rel[k] = { v: 0, treaty: 'war', until: 0 });
}
function storyRelValue(a, b) { const r = storyRel(a, b); return r ? r.v : 0; }
function storyRelAdd(a, b, d) {
    const r = storyRel(a, b); if (!r) return 0;
    r.v = Math.max(-100, Math.min(100, r.v + d));
    return r.v;
}
function storyTreaty(a, b) {
    const r = storyRel(a, b); if (!r) return 'alliance';
    if (r.treaty === 'truce' && (STORY.clock || 0) > (r.until || 0)) { r.treaty = 'war'; r.until = 0; }   // süresi doldu
    return r.treaty;
}
function storySetTreaty(a, b, t, years) {
    const r = storyRel(a, b); if (!r) return;
    r.treaty = t;
    r.until = years ? (STORY.clock || 0) + years * YEAR_SECONDS : 0;
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
    storySetTreaty(a, b, 'war', 0);
    storyRelAdd(a, b, -45);
    const A = storyState(whoBroke), B = storyState(whoBroke === a ? b : a);
    if (A && B) storyLog(`💥 <span style="color:${A.color}">${A.name}</span> antlaşmayı bozdu — <span style="color:${B.color}">${B.name}</span> ile yeniden SAVAŞ.`);
    // dünyanın geri kalanı ahdine sadakatsizliği görür
    for (const st of STORY.states) if (st.id !== whoBroke) storyRelAdd(whoBroke, st.id, -8);
    return true;
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
function talkPick(arr) { return arr[(Math.random() * arr.length) | 0]; }
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
                      w.points -= 300; who.res.points = (who.res.points || 0) + 300; who.loyalty = Math.min(100, talkLoy(who) + talkGain(18));
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
                  run: t => { if (!storyCouncilPayFromState(c.me, { points: 250 })) return { fail: 'Devlet hazinesi yetersiz.' };
                      who.res.points = (who.res.points || 0) + 250; who.loyalty = Math.min(100, talkLoy(who) + talkGain(9));
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
                          for (const cm of storyStateCommanders(c.me)) { cm.res.points = (cm.res.points || 0) + Math.round(300 / storyStateCommanders(c.me).length); }
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
                  run: t => { if (!storyCouncilPayFromState(c.me, { points: 400 })) return { fail: 'Hazine yetersiz — ödeyemezsin.' };
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
                      for (const n of targets.slice(0, 2)) n.garrison = Math.max(0, (n.garrison | 0) - 2);   // hazırlıksız yakalandılar
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
    if (!STORY._talks) STORY._talks = [];
    // süresi geçenleri düşür
    STORY._talks = STORY._talks.filter(t => (STORY.clock || 0) - t.born < TALK_EXPIRE);
    if (STORY._talks.length >= TALK_MAX_QUEUE) return;

    const ctx = storyTalkContext(); if (!ctx) return;
    const cand = TALK_TEMPLATES.filter(tp => { try { return tp.when(ctx); } catch (_) { return false; } });
    if (!cand.length) return;
    // ağırlıklı seçim
    let tot = 0; const ws = cand.map(tp => { const w = (typeof tp.weight === 'function' ? tp.weight(ctx) : 1) || 1; tot += w; return w; });
    let r = Math.random() * tot, pick = cand[0];
    for (let i = 0; i < cand.length; i++) { r -= ws[i]; if (r <= 0) { pick = cand[i]; break; } }
    let built = null;
    try { built = pick.build(ctx); } catch (_) { built = null; }
    if (!built || !built.options || !built.options.length) return;
    // aynı şablon üst üste kuyruğa girmesin
    if (STORY._talks.some(t => t.tpl === pick.id)) return;

    // YETKİ: kim karar verecek?
    const aud = pick.audience || 'player';
    if (aud === 'council') { if (storyTalkToCouncil(built, pick, ctx)) return; }
    else if (aud === 'admin' && !storyTalkIsAdmin()) { storyTalkResolveByAdmin(built, pick, ctx); return; }

    STORY._talks.push({
        uid: (STORY._talkUid = (STORY._talkUid || 0) + 1),
        tpl: pick.id, kind: pick.kind, born: STORY.clock || 0,
        title: built.who ? built.who.name : 'Haber',
        foreignId: built.foreign ? built.foreign.id : null,
        lines: built.lines, options: built.options,
    });
    storyTalkBadge();
    if (typeof storyFlash === 'function') {
        const ic = pick.kind === 'foreign' ? '🕊️' : (pick.kind === 'clique' ? '👁️' : '🗣️');
        storyFlash(`${ic} ${built.who ? built.who.name : 'Bir haberci'} seninle konuşmak istiyor.`);
    }
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
    if (t === 'war' && balance > 0.7 && rel > -30 && Math.random() < 0.35) {
        storySetTreaty(a.id, b.id, 'truce', TRUCE_YEARS); storyRelAdd(a.id, b.id, 20);
        if (Math.random() < 0.4) storyLog(`🤍 <span style="color:${a.color}">${a.name}</span> ile <span style="color:${b.color}">${b.name}</span> ateşkes imzaladı.`);
    } else if (t === 'truce' && rel >= 35 && Math.random() < 0.3) {
        storySetTreaty(a.id, b.id, 'pact', 0); storyRelAdd(a.id, b.id, 10);
    } else if (t !== 'war' && balance < 0.45 && Math.random() < 0.25) {
        const strong = sa > sb ? a : b;
        storyBreakTreaty(a.id, b.id, strong.id);        // güçlü olan fırsatçılık eder
    } else {
        storyRelAdd(a.id, b.id, t === 'war' ? -2 : 2);  // savaş yıpratır, barış yakınlaştırır
    }
}

// ── UI ──────────────────────────────────────────────────────────────────────
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
    STORY._talkOpen = true;
    const p = document.getElementById('talk-panel');
    if (p) { p.classList.add('open'); p.setAttribute('aria-hidden', 'false'); }
    document.getElementById('story-talk-btn')?.classList.add('active');
    storyTalkUpdate();
}
function storyTalkClose() {
    STORY._talkOpen = false;
    const p = document.getElementById('talk-panel');
    if (p) { p.classList.remove('open'); p.setAttribute('aria-hidden', 'true'); }
    document.getElementById('story-talk-btn')?.classList.remove('active');
}
function storyTalkToggle() { STORY._talkOpen ? storyTalkClose() : storyTalkOpen(); }

const TALK_KIND_META = {
    internal: { ic: '🗣️', name: 'KOMUTANIN', c: '#4cff7c' },
    clique:   { ic: '👁️', name: 'KULİS',     c: '#c78cff' },
    foreign:  { ic: '🕊️', name: 'DIŞ TEMAS', c: '#9fd2ff' },
};
function storyTalkUpdate() {
    if (!STORY._talkOpen) return;
    const body = document.getElementById('talk-body'); if (!body) return;
    const me = storyPlayerState(); if (!me) return;
    const talks = STORY._talks || [];

    // 0) DÜNYANIN HÂLİ (Era.js) — her şeyin bağlamı
    let eraHtml = (typeof storyEraHtml === 'function') ? storyEraHtml() : '';
    // 1) DİPLOMASİ TABLOSU — ilişkiler ve antlaşmalar
    const others = STORY.states.filter(s => s.id !== me.id && STORY.nodes.some(n => n.owner === s.id));
    const diploRows = others.map(s => {
        const v = storyRelValue(me.id, s.id), lab = storyRelLabel(v), t = TREATIES[storyTreaty(me.id, s.id)] || TREATIES.war;
        const pct = Math.round((v + 100) / 2);
        return `<div class="dip-row"><span class="dip-n" style="color:${s.color}">⬤ ${s.name}</span>`
            + `<span class="dip-t" style="color:${t.color}" title="${t.name}">${t.icon} ${t.name}</span>`
            + `<span class="dip-bar"><b style="width:${pct}%;background:${lab.c}"></b></span>`
            + `<span class="dip-v" style="color:${lab.c}">${lab.t}</span></div>`;
    }).join('');
    let html = eraHtml + `<div class="talk-sec"><div class="talk-h">🌍 DİPLOMASİ</div>`
        + `<div class="talk-note">İlişkiler <b>sohbetlerle</b> değişir — elçileri dinle, söz ver, ahdine sadık kal.</div>`
        + (diploRows || `<div class="talk-note">Sahnede başka devlet yok.</div>`) + `</div>`;

    // 2) BEKLEYEN KONUŞMALAR
    html += `<div class="talk-sec"><div class="talk-h">💬 BEKLEYEN KONUŞMALAR <b>${talks.length}</b></div>`;
    if (!talks.length) html += `<div class="talk-note">Şu an seni arayan yok. Dünya döndükçe komutanların ve yabancı elçiler kapını çalacak.</div>`;
    for (const t of talks) {
        const m = TALK_KIND_META[t.kind] || TALK_KIND_META.internal;
        const age = Math.max(0, TALK_EXPIRE - ((STORY.clock || 0) - t.born));
        html += `<div class="talk-card" data-talk="${t.uid}">`
            + `<div class="talk-card-h"><span style="color:${m.c}">${m.ic} ${m.name}</span>`
            + `<span class="talk-age" title="cevaplanmazsa düşer">${Math.ceil(age / YEAR_SECONDS * 4) / 4} yıl</span></div>`
            + `<div class="talk-lines">${t.lines.map(l => `<div>${l}</div>`).join('')}</div>`
            + `<div class="talk-opts">` + t.options.map((o, i) =>
                `<button class="talk-opt" data-talk="${t.uid}" data-opt="${i}">`
                + `<b>${o.text}</b>${o.tip ? `<span class="talk-tip">${o.tip}</span>` : ''}</button>`).join('')
            + `</div></div>`;
    }
    html += `</div>`;
    // KOMUTANLAR ARASI SOHBET (Chatter.js) — sen yalnız duyarsın
    if (typeof storyChatterHtml === 'function') html += storyChatterHtml();
    body.innerHTML = html;
}
function storyTalkAnswer(uid, optIdx) {
    const talks = STORY._talks || [];
    const t = talks.find(x => x.uid === uid); if (!t) return;
    const o = t.options[optIdx]; if (!o) return;
    let res = null;
    try { res = o.run(t); } catch (e) { res = { fail: 'Bu seçenek uygulanamadı.' }; }
    if (res && res.fail) { storyFlash(res.fail); return; }         // başarısız → konuşma kuyrukta kalır
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
    document.getElementById('story-talk-btn')?.addEventListener('click', storyTalkToggle);
    document.getElementById('talk-close')?.addEventListener('click', storyTalkClose);
    document.getElementById('talk-body')?.addEventListener('click', e => {
        const b = e.target.closest('.talk-opt'); if (!b) return;
        storyTalkAnswer(+b.dataset.talk, +b.dataset.opt);
    });
}
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', storyTalkBind);
    else storyTalkBind();
}
