// ═══════════════════════════════════════════════════════════════════════════
//  SADAKAT · FİRAR · DARBE — komutanların devlete bağlılığı
//  ---------------------------------------------------------------------------
//  Story.js'ten AYRILDI (davranış değişmedi, yalnız kod taşındı).
//  Story.js 2625 satıra çıkmıştı; okunabilirlik için uyumlu parçalara bölündü.
//  Küresel script düzeni: bu dosya Story.js'ten SONRA yüklenir. Hepsi fonksiyon
//  tanımı olduğu için (hoisting) çağrı sırası etkilenmez.
// ═══════════════════════════════════════════════════════════════════════════

// ── SADAKAT / FİRAR / DARBE ──
function storyApplyLoyaltyDrift() {
    for (const st of STORY.states) {
        if (!st.gov) continue;
        const wf = (st.welfare - 50) * 0.02;                     // refah yüksek→sadakat artar
        for (const cmd of st.gov.commanders) {
            if (cmd === STORY.commander) continue;               // oyuncu jetonu sabit (100)
            const rb = cmd.recentBattles || [];
            const wr = rb.length ? (rb.reduce((a, b) => a + b, 0) / rb.length - 0.5) * 0.3 : 0;   // galibiyet→sadakat
            const per = { agresif: -0.10, dengeli: 0, savunmacı: 0.15, fırsatçı: -0.12 }[cmd.personality] || 0;
            const dip = ((cmd.skills && cmd.skills.diplomat) || 0) * 0.05;   // DİPLOMAT: sadakat istikrarı (firar/darbe direnci)
            // TABAN EROZYON -0.15 → -0.04: eski değerde başlangıç refahında (50, yani wf=0) net drift
            // NEGATİF kalıyordu ve komutanlar hiçbir şey yapılmasa bile 1.5-3 dakikada firar eşiğine
            // (35) iniyordu. Sadakat kaybı KÖTÜ YÖNETİMİN sonucu olmalı, varsayılan durum değil.
            let drift = -0.04 + wf + wr + per + dip;
            // KONSEY: Propaganda/Sansür/Aristokrat Subaylık + anayasa → NEGATİF drift'i yumuşatır
            // (pozitif drift'e dokunmaz: sadakat kazanmayı ucuzlatmaz, kaybetmeyi zorlaştırır)
            const hold = (st._techBonus && st._techBonus.loyaltyHold) || 1;
            if (drift < 0 && hold < 1) drift *= hold;
            let nl = (cmd.loyalty == null ? 60 : cmd.loyalty) + drift * 0.5;   // dt=0.5
            // SADAKAT TABANI: devlet ayakta ve refah makulse komutan bir eşiğin altına düşmez.
            // Bu olmadan uzun barış dönemleri tüm kadroyu eritiyordu.
            if (st.welfare >= 45) nl = Math.max(nl, 38);
            cmd.loyalty = Math.max(0, Math.min(100, nl));
        }
    }
}
function storyStateStr(st) { return st.res.oil + st.res.manpower + st.res.points; }
function storyStateHealth(st) { return (st.welfare + st.reputation * 10) / 2; }
function storyCommanderDefectTo(cmd, fromSt, toSt, atNode) {
    if (typeof storyEraEvent === 'function') storyEraEvent('firar');   // FAZ-10: çalkantı ölçümü
    const i = fromSt.gov.commanders.indexOf(cmd); if (i >= 0) fromSt.gov.commanders.splice(i, 1);
    if (!toSt.gov) toSt.gov = { leader: 'ai', commanders: [] };
    cmd.st = toSt.id;   // FAZ-8: firar edince devlet bağı da taşınır
    toSt.gov.commanders.push(cmd);
    cmd.loyalty = 55; cmd.recentBattles = []; cmd._nextT = 0; cmd._lastDefect = STORY.clock;
    if (atNode != null) cmd.node = atNode;
}
// 0 ŞEHİRLİK devlet → komutanları teslim olur (bulundukları şehrin sahibine katılır) / sahipsizse dağılır
// KOMUTAN TAKVİYESİ: ölümle tükenmesin — şehri olan devletler YAVAŞ yeni komutan yetiştirir (infinite değil: tavanlı + seyrek + refah-kapılı)
// KOMUTAN TAKVİYESİ — konsey/yönetici boşalan kadroyu doldurur.
// ESKİ FORMÜL ÖLÜM SARMALI ÜRETİYORDU: tavan `3 + şehir/4` idi, 19 şehirde 7 çıkıyordu —
// oysa kampanya 10 komutanla başlıyor. `cur >= cap` olduğu için takviye HİÇ tetiklenmiyordu;
// komutanlar öldükçe şehir de kaybediliyor, tavan daha da düşüyor, kadro bir daha toparlanamıyordu.
// Yeni formül başlangıç kadrosuyla uyumlu ve TABANI var: devlet ne kadar küçülürse küçülsün
// çekirdek kadro (4) korunur, böylece geri dönüş mümkün olur.
const CMD_CAP_MIN = 4;
function storyCommanderCap(st) {
    const owned = STORY.nodes.filter(n => n.owner === st.id).length;
    // KONSEY: Genelkurmay tech'i, Halk Komiserleri kanunu ve anayasa kadroyu genişletir/daraltır
    const extra = (st._techBonus && st._techBonus.cmdCap) || 0;
    return Math.max(CMD_CAP_MIN, Math.min(12, 4 + Math.floor(owned / 3) + extra));
}
function storyReplenishCommanders() {
    for (const st of STORY.states) {
        if (!st.gov) continue;
        const owned = STORY.nodes.filter(n => n.owner === st.id); if (!owned.length) continue;
        const cur = storyStateCommanders(st).length;
        const cap = storyCommanderCap(st);
        if (cur >= cap) continue;
        // Kadro kritikse (yarıdan az) refah şartı aranmaz ve zar atılmaz — çöküş engellenir.
        const critical = cur < Math.ceil(cap / 2);
        if (!critical) {
            if (st.welfare < 20) continue;              // sağlıklı kadroda çöken devlet mobilize edemez
            if (Math.random() > 0.5) continue;          // seyrek takviye
        }
        const capId = (STORY._capitals && STORY._capitals[st.id] != null) ? STORY._capitals[st.id] : null;
        const at = (capId != null && owned.some(n => n.id === capId)) ? capId : owned[0].id;
        const nc = storyCreateCommander(st.id, at);
        if (nc && st.isPlayer) storyLog(`🎖️ Konsey yeni komutan atadı: <b>${nc.name}</b> (kadro ${cur + 1}/${cap}).`);
        else if (nc && Math.random() < 0.4) storyLog(`🎖️ ${st.name} yeni komutan yetiştirdi: ${nc.name}.`);
    }
}
function storyDissolveDeadStates() {
    for (const st of STORY.states) {
        if (st.isPlayer || !st.gov || !st.gov.commanders.length) continue;
        if (STORY.nodes.some(n => n.owner === st.id)) continue;   // hâlâ şehri var
        for (const cmd of st.gov.commanders.slice()) {
            const node = storyNode(cmd.node), conq = node ? storyState(node.owner) : null;
            if (conq && !conq.isPlayer && conq.gov) { storyCommanderDefectTo(cmd, st, conq, cmd.node); cmd.loyalty = 45; }
            else { const i = st.gov.commanders.indexOf(cmd); if (i >= 0) st.gov.commanders.splice(i, 1); }
        }
        if (!st.gov.commanders.length) storyLog(`🏴 ${st.name} tarih sahnesinden silindi.`);
    }
}
function storyApplyDefections() {
    for (const st of STORY.states) {
        if (!st.gov) continue;
        for (const cmd of st.gov.commanders.slice()) {           // slice: iterasyon sırasında değişir
            if (cmd === STORY.commander) continue;
            if ((cmd.loyalty == null ? 60 : cmd.loyalty) >= 35) continue;
            if (STORY.clock - (cmd._lastDefect == null ? -999 : cmd._lastDefect) < 120) continue;   // firar cooldown (ping-pong önle)
            const node = storyNode(cmd.node); if (!node) continue;
            let best = null, bestScore = 1.3;                    // eşik 1.3 (daha güçlü+sağlıklı komşuya)
            for (const nb of node.neighbors) {
                const nn = storyNode(nb); if (!nn || nn.owner === st.id) continue;
                const ts = storyState(nn.owner); if (!ts || ts.isPlayer) continue;   // oyuncuya firar YOK (MVP)
                const score = storyStateStr(ts) / Math.max(1, storyStateStr(st)) + storyStateHealth(ts) / Math.max(1, storyStateHealth(st));
                if (score > bestScore) { bestScore = score; best = { ts, node: nb }; }
            }
            if (best) { const old = st.name; storyCommanderDefectTo(cmd, st, best.ts, best.node); storyLog(`🚪 ${cmd.name}, ${old}'den <b>${best.ts.name}</b>'e firar etti!`); storySave(); }
        }
    }
}
function storyApplyCoups() {
    for (const st of STORY.states) {
        if (!st.gov) continue;
        const disloyal = st.gov.commanders.filter(c => c !== STORY.commander && (c.loyalty == null ? 60 : c.loyalty) < 40);
        if (disloyal.length < 3) continue;
        if (disloyal.some(c => c.skills && c.skills.diplomat >= 4)) continue;   // güçlü diplomat koalisyonu böler (sadık tutar)
        const avg = disloyal.reduce((a, c) => a + c.loyalty, 0) / disloyal.length;
        if (st.isPlayer && st.gov.leader === 'player' && STORY.clock - (STORY._coupWarnT == null ? -999 : STORY._coupWarnT) > 25) {
            STORY._coupWarnT = STORY.clock;                       // darbe ÖNCESİ adil uyarı (oyuncuya tepki şansı)
            storyFlash('⚠️ Komutanların huzursuz (düşük sadakat) — refahı yükselt yoksa DARBE riski!');
        }
        if (Math.random() >= 0.2 + ((40 - avg) / 40) * 0.5) continue;   // taban %30→%20 (oyuncuya adil)
        if (st.isPlayer && st.gov.leader === 'player') {         // ── OYUNCU DARBESİ (dramatik risk) ──
            st.gov.leader = 'ai'; st.isAdmin = false;
            st.reputation = Math.max(0, st.reputation - 4); st.welfare = Math.max(0, st.welfare - 20);
            for (const c of disloyal) c.loyalty = 50;
            storyFlash('🔥 DARBE! Komutan konseyi seni devirdi — yöneticiliği KAYBETTİN. Refahı/sadakati yükselt, yeniden seçil.');
            if (typeof storyCouncilUpdate === 'function') storyCouncilUpdate();
            if (typeof storyPanelUpdate === 'function') storyPanelUpdate();
        } else {                                                 // ── AI DARBESİ: kaos, 1-2 sınır şehri komşuya geçer ──
            let flipped = 0;
            for (const n of STORY.nodes) {
                if (n.owner !== st.id || flipped >= 2) continue;
                const nb = n.neighbors.map(storyNode).find(m => m && m.owner !== st.id && !((storyState(m.owner) || {}).isPlayer));
                if (nb) { n.owner = nb.owner; flipped++; }
            }
            for (const c of disloyal) c.loyalty = 50;
            st.welfare = Math.max(0, st.welfare - 8);
            if (flipped) storyLog(`⚔️ ${st.name}'de DARBE — kaos, ${flipped} bölge kontrolden çıktı.`);
        }
        storySave();
    }
}
