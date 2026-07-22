// ═══════════════════════════════════════════════════════════════════════════
//  ÜRETİM & ORDU HAVUZU  (Hikâye modu — FAZ-3)
//  ---------------------------------------------------------------------------
//  Ordu artık savaşa girerken bütçeyle dizilmez; ŞEHİRLERDE üretilip havuzda
//  birikir. Fabrika zırhlı sınıfı, kışla yaya sınıfı basar. Üretim süreli bir
//  kuyruktan geçer, biten birlik o şehrin havuzuna düşer.
//
//  Tasarım kararları:
//   • Havuz DÜĞÜMDE tutulur (komutanda değil) → şehri kaybetmek orduyu da
//     kaybettirir; kalıcılık bedava gelir (nodes zaten storySave'de).
//   • Bina SEVİYE'dir (0-3), sayı değil → mevcut level/garrison diliyle aynı.
//   • Bina seviyesi ≤ şehir seviyesi → şehir yükseltmesi teknoloji kapısı olur.
//   • prodTick TÜM düğümleri gezer → oyuncu ve AI tek kod yolunu paylaşır.
// ═══════════════════════════════════════════════════════════════════════════

// ── BİNA ──
// Maliyet ⭐puan (şehir yükseltmesiyle aynı kasa). index = mevcut seviye → bir üstü.
const FACTORY_COST = [260, 480, 900];    // fabrika pahalı: ağır sanayi
const BARRACKS_COST = [150, 300, 560];   // kışla ucuz: piyade altyapısı
const PROD_MAX_LEVEL = 3;

// Fabrika = paletli/zırhlı sınıf. Kalan her şey kışlada üretilir.
const FACTORY_TYPES = [T.ARMOR, T.ANTI_TANK, T.ARMOR_INFANTRY];
function prodBuildingFor(type) { return FACTORY_TYPES.indexOf(type) >= 0 ? 'fac' : 'bar'; }
function prodBuildingName(kind) { return kind === 'fac' ? 'Fabrika' : 'Kışla'; }
// KONSEY/TEKNOLOJİ etkileri: şehrin SAHİBİ devletin bonusu (oyuncu ve AI aynı yolu kullanır)
function prodStateBonus(n) {
    if (!n || n.owner == null || typeof storyState !== 'function') return null;
    const st = storyState(n.owner);
    return (st && st._techBonus) || null;
}
function prodBuildCost(kind, lvl, n) {
    const tbl = kind === 'fac' ? FACTORY_COST : BARRACKS_COST;
    const base = tbl[lvl] != null ? tbl[lvl] : null;   // null = maksimum
    if (base == null) return null;
    const tb = n ? prodStateBonus(n) : null;           // İstihkam Bürosu / Teknik Okullar: bina ucuzlar
    const m = (tb && tb.buildCost) || 1;
    return m === 1 ? base : Math.max(10, Math.round(base * m));
}
// Bina şehirden ileri gidemez: Sv.3 tank fabrikası ancak Sv.3 şehirde kurulur.
function prodMaxBuildLevel(n) { return n.level || 1; }

// Seviye kilitleri — üretim kademelenir (Sv.1 kışla piyade, Sv.3 fabrika tank)
const PROD_UNLOCK = {
    bar: { 1: [T.INFANTRY, T.RECON], 2: [T.ENGINEER, T.MEDIC], 3: [T.MECH_INFANTRY, T.ARTILLERY] },
    fac: { 1: [T.ANTI_TANK], 2: [T.ARMOR_INFANTRY], 3: [T.ARMOR] }
};
function prodTypesFor(n, kind) {
    const lv = n[kind] | 0;
    let out = [];
    for (let i = 1; i <= lv; i++) out = out.concat(PROD_UNLOCK[kind][i] || []);
    return out;
}

// ── ÜRETİM SÜRESİ / KAPASİTE ──
const PROD_SPEED = [0, 1.0, 1.6, 2.2];   // bina seviyesi → hız çarpanı
function prodTime(n, kind, type) {
    const lv = Math.max(1, n[kind] | 0);
    const cost = (STATS[type] && STATS[type].cost) || 70;
    const tb = prodStateBonus(n);                                   // Montaj Hattı / Seri Üretim / Cunta: süre kısalır
    const sp = (tb && tb.prodSpeed) || 1;
    return Math.max(3, Math.round((cost / 12) / PROD_SPEED[lv] * sp));   // tank ~11sn, piyade ~6sn
}
function prodSlots(n, kind) { return 2 + (n[kind] | 0); }
function prodQueueCount(n, kind) {
    let c = 0;
    for (const j of (n.q || [])) if (prodBuildingFor(j.type) === kind) c++;
    return c;
}
// Havuz tavanı: altyapı + KOMUTAN KAPASİTESİ.
// Şehirde duran komutanın savaşçı yeteneği ne kadar ordunun sevk-idare edilebileceğini
// belirler — yetenekli komutanın olduğu şehir daha büyük ordu besler, komutansız şehir
// yalnız altyapı kadarını tutar. Tüm devletler için geçerli (storyForceAt taraf-agnostik).
const PROD_CMD_CAP_PER_SKILL = 3;   // warrior 0-6 → +0..+18 birim
function prodCommanderCap(n) {
    if (n.owner == null || typeof storyForceAt !== 'function') return 0;
    let best = 0;
    for (const c of storyForceAt(n.owner, n.id)) {
        const w = (c.skills && c.skills.warrior) || 0;
        if (w > best) best = w;
    }
    return best * PROD_CMD_CAP_PER_SKILL;
}
function prodPoolCap(n) {
    const tb = prodStateBonus(n);   // Yedek Ordu / İkmal Depoları / Zorunlu Askerlik / Cunta: kapasite artar
    return 6 + (n.level || 1) * 4 + ((n.fac | 0) + (n.bar | 0)) * 3 + prodCommanderCap(n) + ((tb && tb.poolCap) || 0);
}
function prodPoolCount(n) {
    let c = 0;
    for (const k in (n.pool || {})) c += n.pool[k] | 0;
    return c;
}

// ── ESKİ KAYIT BACKFILL (storyCommanderBackfill deseni) ──
function storyNodeBackfill(n) {
    if (!n) return;
    if (n.level == null) n.level = 1;
    if (n.garrison == null) n.garrison = 0;
    if (n.fac == null) n.fac = 0;
    if (n.bar == null) n.bar = 0;
    if (!n.pool || typeof n.pool !== 'object') n.pool = {};
    if (!Array.isArray(n.q)) n.q = [];
    n._siege = null;   // kuşatma transient
}

// ── ŞEHİR SEVİYESİNİN ANLAMI ──
// Seviye yükseltmek eskiden yalnız gelir (+%40) veriyordu ve pahalı olduğu için değmiyordu.
// Artık dört şey birden açar: SAVUNMA bonusu (savaşta tahkimat), daha çok MİLİS, daha büyük
// ORDU KAPASİTESİ (prodPoolCap) ve daha yüksek BİNA tavanı (prodMaxBuildLevel).
const CITY_DEFENSE_BONUS = [0, 0.10, 0.25, 0.45];   // seviye → savunan birliklere HP/zırh avantajı
const CITY_MILITIA_BY_LEVEL = [0, 3, 5, 8];         // seviye → savunma düellosundaki taban milis
const CITY_UPGRADE_GAIN = [null, 'savunma +%25, milis 5', 'savunma +%45, milis 8', null];
function cityMilitiaFor(n) { return CITY_MILITIA_BY_LEVEL[n.level || 1] || 3; }
// Şehir savunması = seviye + sahibinin KONSEY kararları (Tahkimat Dairesi / Harp Akademileri)
function cityDefenseBonus(n) {
    const tb = prodStateBonus(n);
    return (CITY_DEFENSE_BONUS[n.level || 1] || 0) + ((tb && tb.cityDefense) || 0);
}

// ── HAVUZ GÜCÜ (stratejik katman görsün) ──
// Şehirde bekleyen ordu savunma gücüne katılır → AI "iyi savunulan şehre saldırma"yı
// ekstra kod olmadan öğrenir (storyEvalTarget/storyExposureAt bunu okur).
function storyPoolPower(n) {
    let v = 0;
    for (const k in (n.pool || {})) v += ((STATS[+k] && STATS[+k].cost) || 70) * (n.pool[k] | 0);
    return Math.round(v / 20);   // 280'lik tank ≈ 14 puan (garnizon birimi = 10 ile aynı ölçek)
}

// ── BİNA KUR / YÜKSELT ──
function prodBuild(nodeId, kind) {
    const n = storyNode(nodeId);
    if (!n || n.owner !== STORY.playerStateId) return false;
    if (kind !== 'fac' && kind !== 'bar') return false;
    const lvl = n[kind] | 0;
    if (lvl >= PROD_MAX_LEVEL) { storyFlash(`${prodBuildingName(kind)} zaten maksimum seviye.`); return false; }
    if (lvl >= prodMaxBuildLevel(n)) {
        storyFlash(`Önce şehri yükselt — ${prodBuildingName(kind)} şehir seviyesini (Sv.${n.level || 1}) geçemez.`);
        return false;
    }
    const cost = prodBuildCost(kind, lvl, n);
    const w = STORY.commander && STORY.commander.res;
    if (!w || (w.points || 0) < cost) { storyFlash(`⭐ Puan yetersiz (gerekli ${cost}).`); return false; }
    w.points -= cost;
    n[kind] = lvl + 1;
    storyLog(`🏭 <b>${n.name}</b>: ${prodBuildingName(kind)} Sv.${n[kind]} kuruldu.`);
    storySave();
    if (typeof storyCityUpdate === 'function') storyCityUpdate();
    return true;
}

// ── ÜRETİM KUYRUĞU ──
// Ödeme kuyruğa GİRERKEN yapılır: bedava sınırsız kuyruk sömürüsünü kapatır,
// muhasebe tek noktada kalır (storyCityUpgrade ile aynı kasa mantığı).
function prodEnqueue(nodeId, type) {
    const n = storyNode(nodeId);
    if (!n || n.owner !== STORY.playerStateId) return false;
    const kind = prodBuildingFor(type);
    if (prodTypesFor(n, kind).indexOf(type) < 0) {
        storyFlash(`${prodBuildingName(kind)} seviyesi bu birim için yetersiz.`);
        return false;
    }
    if (prodQueueCount(n, kind) >= prodSlots(n, kind)) { storyFlash(`${prodBuildingName(kind)} kuyruğu dolu.`); return false; }
    if (prodPoolCount(n) + prodQueueCount(n, 'fac') + prodQueueCount(n, 'bar') >= prodPoolCap(n)) {
        storyFlash(`Havuz dolu (${prodPoolCap(n)}) — şehri veya binaları yükselt.`);
        return false;
    }
    const g = UNIT_RES_GROUP[type] || 'manpower';
    const cost = (STATS[type] && STATS[type].cost) || 70;
    const w = STORY.commander && STORY.commander.res;
    if (!w || (w[g] || 0) < cost) { storyFlash(`Kaynak yetersiz (${cost} ${g}).`); return false; }
    w[g] -= cost;
    const t = prodTime(n, kind, type);
    n.q.push({ type, t, tot: t });
    storySave();
    if (typeof storyCityUpdate === 'function') storyCityUpdate();
    return true;
}

// İptal → %50 iade (plan değiştirmeyi cezalandırır ama kilitlemez)
function prodCancel(nodeId, idx) {
    const n = storyNode(nodeId);
    if (!n || n.owner !== STORY.playerStateId || !n.q || !n.q[idx]) return false;
    const job = n.q[idx];
    const g = UNIT_RES_GROUP[job.type] || 'manpower';
    const back = Math.round(((STATS[job.type] && STATS[job.type].cost) || 70) * 0.5);
    const w = STORY.commander && STORY.commander.res;
    if (w) w[g] = (w[g] || 0) + back;
    n.q.splice(idx, 1);
    storyLog(`✖ ${STATS[job.type].name} üretimi iptal (+${back} iade).`);
    storySave();
    if (typeof storyCityUpdate === 'function') storyCityUpdate();
    return true;
}

// ── TICK: tüm düğümler (oyuncu + AI aynı motor) ──
// Fabrika ve kışla PARALEL hat işletir: biri tank yaparken diğeri piyade basar.
function prodTick(step) {
    if (typeof STORY === 'undefined' || !STORY.nodes) return;
    for (const n of STORY.nodes) {
        if (!n.q || !n.q.length) continue;
        const busy = { fac: 0, bar: 0 };
        for (const job of n.q) {
            const k = prodBuildingFor(job.type);
            if (busy[k]) continue;          // o bina bu tick zaten bir iş işliyor
            busy[k] = 1;
            job.t -= step;
        }
        for (let i = n.q.length - 1; i >= 0; i--) {
            if (n.q[i].t > 0) continue;
            const ty = n.q[i].type;
            n.q.splice(i, 1);
            if (prodPoolCount(n) >= prodPoolCap(n)) {   // tavan doluysa üretim beklemede kalır
                n.q.push({ type: ty, t: 1, tot: 1 });
                continue;
            }
            n.pool[ty] = (n.pool[ty] | 0) + 1;
            if (n.owner === STORY.playerStateId && typeof storyLog === 'function') {
                storyLog(`🏭 <b>${n.name}</b>: ${STATS[ty].name} hazır (havuz ${prodPoolCount(n)}/${prodPoolCap(n)}).`);
            }
        }
    }
}

// ── HAVUZ TOPLAMA (savaşa girerken) ──
// Savaş şehri + BİTİŞİK dost şehirler birleşir — storyForceNear'ın komutanlar için
// işlettiği kuralın aynısı. Bitişikler katılmazsa saldırıya uğrayan sınır şehri yalnız kalır.
function storyMusterPool(stateId, nodeId) {
    const node = storyNode(nodeId);
    if (!node) return { avail: {}, src: [] };
    const ids = [nodeId].concat(node.neighbors || []);
    const avail = {}, src = [];
    for (const id of ids) {
        const m = storyNode(id);
        if (!m || m.owner !== stateId || !m.pool) continue;
        const take = {};
        for (const k in m.pool) {
            const c = m.pool[k] | 0;
            if (c > 0) { avail[k] = (avail[k] | 0) + c; take[k] = c; }
        }
        if (Object.keys(take).length) src.push({ nodeId: id, counts: take });
    }
    return { avail, src };
}

// ═══════════════════════════════════════════════════════════════════════════
//  SEFER ORDUSU — ordu KOMUTANIN ÜZERİNDEDİR, komutanla birlikte gezer
//  ---------------------------------------------------------------------------
//  Önceki model orduyu ŞEHİR havuzunda tutuyordu: ürettiğin birlikler o şehirde
//  kalıyor, komutanla yürümüyordu. İki katman ayrıldı:
//    n.pool   = ŞEHİR DEPOSU  — üretim buraya düşer, şehri SAVUNUR, taşınmaz
//    cmd.army = SEFER ORDUSU  — komutanla birlikte hareket eder, SALDIRIYA gider
//  Komutan dost şehirdeyken depodan orduya SEVK alır (storyLoadArmy); geri
//  bırakabilir (storyUnloadArmy). Kapasite komutanın savaş yeteneğine bağlı.
// ═══════════════════════════════════════════════════════════════════════════
const CMD_ARMY_BASE = 6, CMD_ARMY_PER_SKILL = 3;   // savaşçı 0-6 → 6..24 birlik
function cmdArmyCap(cmd) {
    if (!cmd) return 0;
    const w = (cmd.skills && cmd.skills.warrior) || 0;
    return CMD_ARMY_BASE + w * CMD_ARMY_PER_SKILL;
}
function cmdArmyCount(cmd) {
    let c = 0;
    for (const k in ((cmd && cmd.army) || {})) c += cmd.army[k] | 0;
    return c;
}
function cmdArmyPower(cmd) {
    let v = 0;
    for (const k in ((cmd && cmd.army) || {})) v += ((STATS[+k] && STATS[+k].cost) || 70) * (cmd.army[k] | 0);
    return Math.round(v / 20);
}
// ŞEHİR DEPOSU → SEFER ORDUSU. counts yoksa kapasite dolana dek en değerliden alır.
function storyLoadArmy(cmd, node, counts) {
    if (!cmd || !node || !node.pool) return 0;
    if (cmd.node !== node.id) return 0;                       // komutan o şehirde olmalı
    const st = storyState(node.owner);
    if (!st || !storyStateCommanders(st).some(c => c === cmd)) return 0;   // kendi şehri olmalı
    if (!cmd.army) cmd.army = {};
    const cap = cmdArmyCap(cmd);
    let moved = 0;
    const keys = counts ? Object.keys(counts)
        : Object.keys(node.pool).sort((a, b) => ((STATS[+b] && STATS[+b].cost) || 0) - ((STATS[+a] && STATS[+a].cost) || 0));
    for (const k of keys) {
        let want = counts ? (counts[k] | 0) : (node.pool[k] | 0);
        while (want > 0 && (node.pool[k] | 0) > 0 && cmdArmyCount(cmd) < cap) {
            node.pool[k]--; if (!node.pool[k]) delete node.pool[k];
            cmd.army[k] = (cmd.army[k] | 0) + 1;
            want--; moved++;
        }
    }
    return moved;
}
// SEFER ORDUSU → ŞEHİR DEPOSU (geri bırak)
function storyUnloadArmy(cmd, node, counts) {
    if (!cmd || !cmd.army || !node) return 0;
    if (cmd.node !== node.id || node.owner == null) return 0;
    if (!node.pool) node.pool = {};
    const cap = prodPoolCap(node);
    let moved = 0;
    for (const k of (counts ? Object.keys(counts) : Object.keys(cmd.army))) {
        let want = counts ? (counts[k] | 0) : (cmd.army[k] | 0);
        while (want > 0 && (cmd.army[k] | 0) > 0 && prodPoolCount(node) < cap) {
            cmd.army[k]--; if (!cmd.army[k]) delete cmd.army[k];
            node.pool[k] = (node.pool[k] | 0) + 1;
            want--; moved++;
        }
    }
    return moved;
}
// OTOMATİK SEVK — AI komutanları (ve oyuncunun devletindeki diğer komutanlar) durdukları
// dost şehirde depoyu orduya alır. Oyuncu bunu elle de yapabilir; otomatik sevk oyuncunun
// KENDİ jetonunu atlar (onun ordusuna karışmayalım).
function storyAutoLoadArmies() {
    for (const st of STORY.states) {
        if (!st.gov) continue;
        for (const cmd of storyStateCommanders(st)) {
            const n = storyNode(cmd.node);
            if (!n || n.owner !== st.id || !n.pool) continue;
            if (cmdArmyCount(cmd) >= cmdArmyCap(cmd)) continue;
            // OYUNCUNUN JETONU: sevk normalde SENİN kararın (ORDU paneli / ŞEHRE GİR).
            // Tek istisna: ordun TAMAMEN boşken dolu deponun üstünde duruyorsan levazım
            // seni yükler. Aksi hâlde farkında olmadan 2 milisle savaşa girme tuzağı doğuyor
            // ve pasif oyuncu ölçümünde devlet tamamen eleniyordu (8 senaryonun 3'ü sıfır).
            if (cmd.isPlayer && cmdArmyCount(cmd) > 0) continue;
            storyLoadArmy(cmd, n);
        }
    }
}
// devletin TOPLAM ordusu (sefer orduları + şehir depoları) — panel/istatistik
function storyStateArmyTotals(st) {
    const field = {}, depot = {};
    for (const cmd of storyStateCommanders(st)) for (const k in (cmd.army || {})) field[k] = (field[k] | 0) + (cmd.army[k] | 0);
    for (const n of STORY.nodes) { if (n.owner !== st.id) continue; for (const k in (n.pool || {})) depot[k] = (depot[k] | 0) + (n.pool[k] | 0); }
    return { field, depot };
}

// Savaşa girecek kuvvet: komutanın SEFER ORDUSU (+ savunmada şehrin DEPOSU).
// src kayıtları iki türlü olur: { cmdId } → sefer ordusundan, { nodeId } → şehir deposundan.
function storyMusterArmy(cmd, node, includeCity, stateId) {
    const avail = {}, src = [];
    if (cmd && cmd.army) {
        const take = {};
        for (const k in cmd.army) { const c = cmd.army[k] | 0; if (c > 0) { avail[k] = (avail[k] | 0) + c; take[k] = c; } }
        if (Object.keys(take).length) src.push({ cmdId: cmd.id, stateId: stateId, counts: take });
    }
    if (includeCity && node && node.pool && node.owner === stateId) {
        const take = {};
        for (const k in node.pool) { const c = node.pool[k] | 0; if (c > 0) { avail[k] = (avail[k] | 0) + c; take[k] = c; } }
        if (Object.keys(take).length) src.push({ nodeId: node.id, counts: take });
    }
    return { avail, src };
}
// O şehirde duran DOST komutanların ordularını da katar (yığılma anlamlı olsun)
function storyMusterAt(stateId, nodeId, includeCity) {
    const node = storyNode(nodeId), st = storyState(stateId);
    const avail = {}, src = [];
    if (st) for (const cmd of storyStateCommanders(st)) {
        if (cmd.node !== nodeId || !cmd.army) continue;
        const take = {};
        for (const k in cmd.army) { const c = cmd.army[k] | 0; if (c > 0) { avail[k] = (avail[k] | 0) + c; take[k] = c; } }
        if (Object.keys(take).length) src.push({ cmdId: cmd.id, stateId: stateId, counts: take });
    }
    if (includeCity && node && node.pool && node.owner === stateId) {
        const take = {};
        for (const k in node.pool) { const c = node.pool[k] | 0; if (c > 0) { avail[k] = (avail[k] | 0) + c; take[k] = c; } }
        if (Object.keys(take).length) src.push({ nodeId: node.id, counts: take });
    }
    return { avail, src };
}
function storyCommanderById(stateId, id) {
    const st = storyState(stateId); if (!st) return null;
    for (const c of storyStateCommanders(st)) if (c.id === id) return c;
    return null;
}

// Kuvveti kaynağından DÜŞ (savaş başında) — kayıp kalıcı olsun diye
function storyDrainPool(src) {
    for (const s of (src || [])) {
        if (s.cmdId != null) {
            const cmd = storyCommanderById(s.stateId, s.cmdId);
            if (!cmd || !cmd.army) continue;
            for (const k in s.counts) {
                cmd.army[k] = Math.max(0, (cmd.army[k] | 0) - (s.counts[k] | 0));
                if (!cmd.army[k]) delete cmd.army[k];
            }
            continue;
        }
        const n = storyNode(s.nodeId);
        if (!n || !n.pool) continue;
        for (const k in s.counts) {
            n.pool[k] = Math.max(0, (n.pool[k] | 0) - (s.counts[k] | 0));
            if (!n.pool[k]) delete n.pool[k];
        }
    }
}

// Savaş sonu iade: sağ kalanlar + dizilmeyenler ÖNCE komutanın sefer ordusuna döner
// (ordu komutanla gezer), kapasite taşarsa bulunduğu şehrin deposuna düşer.
function storyReturnPool(counts, preferNode, stateId, src) {
    let placed = 0;
    // 1) sefer ordusu: kuvveti veren komutan(lar)
    const cmds = [];
    for (const s of (src || [])) if (s.cmdId != null) { const c = storyCommanderById(s.stateId != null ? s.stateId : stateId, s.cmdId); if (c) cmds.push(c); }
    if (!cmds.length && stateId === STORY.playerStateId && STORY.commander) cmds.push(STORY.commander);
    for (const cmd of cmds) {
        if (!cmd.army) cmd.army = {};
        const cap = cmdArmyCap(cmd);
        for (const k in (counts || {})) {
            while ((counts[k] | 0) > 0 && cmdArmyCount(cmd) < cap) { cmd.army[k] = (cmd.army[k] | 0) + 1; counts[k]--; placed++; }
        }
    }
    // 2) taşan kısım: şehir deposu
    let target = null;
    if (preferNode && preferNode.owner === stateId) target = preferNode;
    if (!target) for (const s of (src || [])) { const n = s.nodeId != null ? storyNode(s.nodeId) : null; if (n && n.owner === stateId) { target = n; break; } }
    if (!target && cmds.length) target = storyNode(cmds[0].node);
    if (target && target.owner === stateId) {
        if (!target.pool) target.pool = {};
        const cap = prodPoolCap(target);
        for (const k in (counts || {})) {
            while ((counts[k] | 0) > 0 && prodPoolCount(target) < cap) { target.pool[k] = (target.pool[k] | 0) + 1; counts[k]--; placed++; }
        }
    }
    return placed;
}

// ═══════════════════════════════════════════════════════════════════════════
//  ŞEHRE GİR PANELİ  (Story.js'ten taşındı — artık tüm şehir listesi değil, TEK şehir)
// ═══════════════════════════════════════════════════════════════════════════

// Odaktaki şehir: haritada seçtiğin (senin ise), yoksa komutanının bulunduğu şehir
function storyCityFocus() {
    const sel = storyNode(STORY.selectedNodeId);
    if (sel && sel.owner === STORY.playerStateId) return sel;
    return storyNode(STORY.commander && STORY.commander.node);
}

function storyCityOpen() {
    storyCouncilClose(); storyTechClose(); storyArmyClose();
    STORY._cityOpen = true;
    const p = document.getElementById('city-panel');
    if (p) { p.classList.add('open'); p.setAttribute('aria-hidden', 'false'); }
    document.getElementById('story-city-btn')?.classList.add('active');
    storyCityUpdate();
}
function storyCityClose() {
    STORY._cityOpen = false;
    const p = document.getElementById('city-panel');
    if (p) { p.classList.remove('open'); p.setAttribute('aria-hidden', 'true'); }
    document.getElementById('story-city-btn')?.classList.remove('active');
}
function storyCityToggle() { STORY._cityOpen ? storyCityClose() : storyCityOpen(); }

// Üretilebilir birim düğmeleri (kilitliler de gösterilir — hedef görünür olsun)
function prodUnitButtons(n, kind, wallet) {
    const open = prodTypesFor(n, kind);
    const all = [];
    for (let lv = 1; lv <= PROD_MAX_LEVEL; lv++) for (const t of (PROD_UNLOCK[kind][lv] || [])) all.push({ t, lv });
    if (!all.length) return '';
    let html = '';
    for (const { t, lv } of all) {
        const s = STATS[t]; if (!s) continue;
        const g = UNIT_RES_GROUP[t] || 'manpower';
        const icon = g === 'oil' ? '⛽' : g === 'points' ? '⭐' : '👥';
        const unlocked = open.indexOf(t) >= 0;
        const afford = (wallet[g] || 0) >= s.cost;
        const sec = unlocked ? prodTime(n, kind, t) : prodTime({ [kind]: lv, level: n.level }, kind, t);
        html += unlocked
            ? `<button class="prod-btn cb-make" data-node="${n.id}" data-type="${t}" ${afford ? '' : 'disabled'} title="${s.name} — ${s.cost}${icon}, ${sec} sn">`
              + `<b>${s.name}</b><small>${icon}${s.cost} · ${sec}sn</small></button>`
            : `<button class="prod-btn locked" disabled title="Sv.${lv} gerekli"><b>${s.name}</b><small>🔒 Sv.${lv}</small></button>`;
    }
    return html;
}

function prodBuildingSection(n, kind, wallet) {
    const lvl = n[kind] | 0;
    const cost = prodBuildCost(kind, lvl, n);
    const icon = kind === 'fac' ? '🏭' : '🎖️';
    const label = kind === 'fac' ? 'FABRİKA' : 'KIŞLA';   // toUpperCase() Türkçe'de 'i'→'I' yapıyor, sabit metin kullanılır
    const maxed = lvl >= PROD_MAX_LEVEL;
    const cityBlocked = !maxed && lvl >= prodMaxBuildLevel(n);
    let head = `<div class="prod-head"><span>${icon} ${label} <b>Sv.${lvl}/${PROD_MAX_LEVEL}</b></span>`;
    if (maxed) head += `<span class="city-max">Maks</span>`;
    else if (cityBlocked) head += `<span class="prod-lock" title="Bina şehir seviyesini geçemez">🔒 Şehir Sv.${n.level || 1}</span>`;
    else head += `<button class="city-btn cb-build" data-node="${n.id}" data-kind="${kind}" ${(wallet.points || 0) < cost ? 'disabled' : ''}>`
        + `${lvl === 0 ? 'Kur' : `Sv.${lvl + 1}`} (${cost}⭐)</button>`;
    head += `</div>`;
    const body = lvl > 0
        ? `<div class="prod-grid">${prodUnitButtons(n, kind, wallet)}</div>`
        : `<div class="city-hint">${prodBuildingName(kind)} kurulmadı — bu sınıf birlikler üretilemez.</div>`;
    return `<div class="prod-sec">${head}${body}</div>`;
}

function prodQueueSection(n) {
    const q = n.q || [];
    if (!q.length) return `<div class="prod-sec"><div class="prod-head"><span>⏳ ÜRETİM</span><span class="city-max">kuyruk boş</span></div></div>`;
    let html = `<div class="prod-sec"><div class="prod-head"><span>⏳ ÜRETİM</span>`
        + `<span class="city-max">🏭 ${prodQueueCount(n, 'fac')}/${prodSlots(n, 'fac')} · 🎖️ ${prodQueueCount(n, 'bar')}/${prodSlots(n, 'bar')}</span></div>`;
    // Her binanın SIRADAKİ işi ilerler (paralel hat) — kalanlar "bekliyor"
    const active = { fac: 0, bar: 0 };
    q.forEach((job, i) => {
        const kind = prodBuildingFor(job.type);
        const running = !active[kind];
        if (running) active[kind] = 1;
        const pct = Math.max(0, Math.min(100, (1 - job.t / Math.max(1, job.tot)) * 100));
        html += `<div class="prod-row"><span class="prod-name">${kind === 'fac' ? '🏭' : '🎖️'} ${STATS[job.type].name}</span>`
            + `<i class="prod-bar"><b style="width:${pct.toFixed(0)}%"></b></i>`
            + `<span class="prod-eta">${running ? Math.ceil(job.t) + 's' : 'bekliyor'}</span>`
            + `<button class="city-btn cb-cancel" data-node="${n.id}" data-idx="${i}" title="İptal (%50 iade)">✖</button></div>`;
    });
    return html + `</div>`;
}

function prodPoolSection(n) {
    const pool = n.pool || {};
    const total = prodPoolCount(n), cap = prodPoolCap(n);
    const cmdCap = prodCommanderCap(n);
    let items = '';
    for (const k in pool) {
        const c = pool[k] | 0; if (c <= 0) continue;
        items += `<span class="pool-item">${STATS[+k].name} <b>×${c}</b></span>`;
    }
    // Komutan katkısı ayrıca gösterilir: "neden bu şehir daha çok ordu besliyor" sorusunun cevabı
    let capNote = `Altyapı ${cap - cmdCap}`;
    if (cmdCap > 0) {
        const who = storyForceAt(n.owner, n.id).slice().sort((a, b) => ((b.skills && b.skills.warrior) || 0) - ((a.skills && a.skills.warrior) || 0))[0];
        capNote += ` + komutan ${cmdCap} (${who ? who.name : '—'} ⚔️${(who && who.skills && who.skills.warrior) || 0})`;
    } else {
        capNote += ' · komutan yok — sevk-idare kapasitesi düşük';
    }
    // SEVK KONTROLÜ — depo ile komutanın sefer ordusu arasında birlik taşı.
    // Ordu artık komutanla gezdiği için bu panel "orduyu yola çıkarma" ekranıdır.
    const cmd = STORY.commander;
    const atHere = !!(cmd && cmd.node === n.id);
    const myN = (typeof cmdArmyCount === 'function') ? cmdArmyCount(cmd) : 0;
    const myCap = (typeof cmdArmyCap === 'function') ? cmdArmyCap(cmd) : 0;
    let ship = '';
    if (atHere) {
        const room = myCap - myN;
        ship = `<div class="ship-box"><div class="ship-h">🚚 SEVK — <b>${cmd.name}</b> burada · sefer ordun <b>${myN}/${myCap}</b></div>`
            + `<div class="ship-acts">`
            + `<button class="city-btn cb-load" data-node="${n.id}" ${(total <= 0 || room <= 0) ? 'disabled' : ''}>⬆️ Depodan Al (${Math.min(total, Math.max(0, room))})</button>`
            + `<button class="city-btn cb-unload" data-node="${n.id}" ${myN <= 0 ? 'disabled' : ''}>⬇️ Depoya Bırak (${myN})</button>`
            + `</div>`
            + (room <= 0 && total > 0 ? `<div class="city-hint" style="color:#ffd24c">Sefer ordun dolu — kapasite savaş yeteneğine bağlı (⚔️${(cmd.skills && cmd.skills.warrior) || 0}).</div>` : '')
            + `</div>`;
    } else {
        ship = `<div class="ship-box"><div class="ship-h">🚚 SEVK</div>`
            + `<div class="city-hint">Komutanın burada değil — sevk için <b>${n.name}</b>'a gel. Depodaki birlikler yalnız bu şehri savunur.</div></div>`;
    }
    return `<div class="prod-sec"><div class="prod-head"><span>🏭 ŞEHİR DEPOSU <b>${total}/${cap}</b></span></div>`
        + (items ? `<div class="pool-grid">${items}</div>`
                 : `<div class="city-hint">Depo boş — üretim yap, sonra komutanına sevk et.</div>`)
        + `<div class="city-hint">Kapasite: ${capNote}</div>`
        + ship
        + `</div>`;
}

function storyCityUpdate() {
    if (!STORY._cityOpen) return;
    const body = document.getElementById('city-body'); if (!body) return;
    const mine = STORY.nodes.filter(x => x.owner === STORY.playerStateId);
    const n = storyCityFocus();
    const title = document.getElementById('city-title');
    if (title) title.textContent = n ? n.name.toLocaleUpperCase('tr') : 'ŞEHİR';   // 'tr' şart: toUpperCase() 'i'→'I' yapar
    if (!n || n.owner !== STORY.playerStateId) { body.innerHTML = `<div class="city-hint">Hiç şehrin yok.</div>`; return; }

    const w = (STORY.commander && STORY.commander.res) || { oil: 0, manpower: 0, points: 0 };
    const lvl = n.level || 1, gar = n.garrison || 0, cap = storyCityGarrisonCap(n);
    const upCost = lvl < 3 ? CITY_UPGRADE_COST[lvl] : null;
    const here = (STORY.commander && STORY.commander.node === n.id) ? ' 📍' : '';
    const isCap = (STORY._capitals && STORY._capitals.indexOf(n.id) >= 0) ? ' ★' : '';

    body.innerHTML =
        `<div class="city-top">🏰 <b>${n.name}</b>${here}${isCap} · Sv.${lvl} <span class="city-lvl">${mine.length} şehrin var</span>`
        + `<div class="city-stat">Gelir ⛽${n.oil || 0} 👥${n.cities || 0} ⭐${n.pts || 0} · kasan ⛽<b>${Math.floor(w.oil)}</b> 👥<b>${Math.floor(w.manpower)}</b> ⭐<b>${Math.floor(w.points)}</b></div>`
        + `<div class="city-stat">🛡️ Savunma bonusu <b>+%${Math.round((CITY_DEFENSE_BONUS[lvl] || 0) * 100)}</b> · milis <b>${cityMilitiaFor(n)}</b> birlik · ordu kapasitesi <b>${prodPoolCap(n)}</b></div>`
        + `<div class="city-acts">`
        + (upCost != null
            ? `<button class="city-btn cb-up" data-node="${n.id}" ${(w.points || 0) < upCost ? 'disabled' : ''}>🏗️ Şehir Sv.${lvl + 1} (${upCost}⭐) — ${CITY_UPGRADE_GAIN[lvl] || ''}</button>`
            : `<span class="city-max">Şehir Maks Sv.3</span>`)
        + `</div></div>`
        + prodBuildingSection(n, 'fac', w)
        + prodBuildingSection(n, 'bar', w)
        + prodQueueSection(n)
        + `<div class="prod-sec"><div class="prod-head"><span>🛡️ GARNİZON <b>${gar}/${cap}</b></span>`
        + `<button class="city-btn cb-gar" data-node="${n.id}" ${(gar >= cap || (w.manpower || 0) < CITY_GARRISON_COST) ? 'disabled' : ''}>+1 (${CITY_GARRISON_COST}👥)</button></div>`
        + `<div class="city-hint">Savunma düellosunda birlik olarak savaşır; kuşatma savunmasını güçlendirir.</div></div>`
        + prodPoolSection(n);
}

// ── KIDEM: gaziler ayrı bedava ordu değil, havuz birimine yapışan kalite ──
// Eskiden storySpawnVeterans 14 birimi bedava sahaya koyuyordu; bu, "üretilmemiş ordu
// sahaya çıkmasın" kuralını delerdi. Artık aynı tipteki havuz birimine kıdem etiketi geçer.
function storyTagVeteran(u) {
    const vs = STORY._battleVets;
    if (!vs || !vs.length) return;
    const i = vs.findIndex(v => v.type === u.type && !v._used);
    if (i < 0) return;
    vs[i]._used = 1;
    const lvl = Math.max(1, vs[i].vet | 0);
    u.veteran = lvl;
    u.maxHp = Math.round(u.maxHp * (1 + 0.12 * lvl));
    u.hp = u.maxHp;
}

// ═══════════════════════════════════════════════════════════════════════════
//  AI ŞEHİR YÖNETİMİ  (Story.js:storyAICityDevelop'tan taşındı + üretim eklendi)
//  Oyuncu havuzdan ordu sürerken AI'nın da üretmesi ADALET ŞARTIDIR.
//  Maliyetler oyuncuyla birebir aynı; devletin en zengin komutanı öder.
// ═══════════════════════════════════════════════════════════════════════════

// AI için bina kur/yükselt (oyuncunun prodBuild'iyle aynı kurallar, farkı: sahiplik kontrolü ve kasa)
function aiTryBuild(n, st, payer) {
    const kinds = ['bar', 'fac'];
    for (const kind of kinds) {
        const lvl = n[kind] | 0;
        if (lvl >= PROD_MAX_LEVEL || lvl >= prodMaxBuildLevel(n)) continue;
        const cost = prodBuildCost(kind, lvl, n);
        if (!payer || !payer.res || (payer.res.points || 0) < cost) continue;
        payer.res.points -= cost;
        n[kind] = lvl + 1;
        return true;
    }
    return false;
}

// AI üretim doktrini: sınır şehri savunma ağırlıklı, iç şehir eldeki en iyi birim
function aiTryProduce(n, st, cmds) {
    const isBorder = (n.neighbors || []).some(nb => { const m = storyNode(nb); return m && m.owner !== n.owner; });
    const open = prodTypesFor(n, 'fac').concat(prodTypesFor(n, 'bar'));
    if (!open.length) return false;
    // Savunmada tanksavar+piyade, taarruzda en pahalı (en güçlü) birim
    let wanted;
    if (isBorder && Math.random() < 0.6) {
        const def = open.filter(t => t === T.ANTI_TANK || t === T.INFANTRY);
        wanted = def.length ? def[(Math.random() * def.length) | 0] : open[(Math.random() * open.length) | 0];
    } else {
        wanted = open.slice().sort((a, b) => (STATS[b].cost || 0) - (STATS[a].cost || 0))[0];
    }
    const kind = prodBuildingFor(wanted);
    if (prodQueueCount(n, kind) >= prodSlots(n, kind)) return false;
    if (prodPoolCount(n) >= prodPoolCap(n)) return false;
    const g = UNIT_RES_GROUP[wanted] || 'manpower';
    const cost = (STATS[wanted] && STATS[wanted].cost) || 70;
    const payer = cmds.slice().sort((a, b) => ((b.res && b.res[g]) || 0) - ((a.res && a.res[g]) || 0))[0];
    if (!payer || !payer.res || (payer.res[g] || 0) < cost) return false;
    payer.res[g] -= cost;
    const t = prodTime(n, kind, wanted);
    n.q.push({ type: wanted, t, tot: t });
    return true;
}

// ── KOMUTAN YEREL YATIRIMI (TÜM devletler, OYUNCUNUN devleti dahil) ──
// "sadece ben garnizon koymayayım, komutanlar da dinamik olsun."
// Her komutan DURDUĞU şehre kendi kasasından yatırım yapar. Öncelik durumsaldır:
// cephe şehrinde garnizon, geride üretim altyapısı. Oyuncunun kendi jetonu hariç
// (senin kasan senin kararın) — ama devletindeki diğer komutanlar artık pasif değil.
const CMD_INVEST_CHANCE = 0.5;    // her tick'te komutan başına yatırım olasılığı
const CMD_GARRISON_SOFT_CAP = 4;  // komutan garnizonu bu sayıya kadar takviye eder, ötesi israf
// ÖNCELİK SIRASI ÖNEMLİ: ilk sürümde garnizon en başta geliyordu ve komutanlar bütün
// insan gücünü garnizona yatırıp ORDU KURMUYORDU. Ölçümde oyuncu devletinin garnizonu
// 9→39 çıkarken sefer ordusu 22'de takılıyor, AI 536'ya ulaşıp oyuncuyu 731sn'de siliyordu.
// Artık ÖNCE ORDU: komutan kendi seferi ordusunu doldurmadan altyapıya/garnizona geçmez.
function storyCommanderCityTick() {
    for (const st of STORY.states) {
        if (!st.gov) continue;
        for (const cmd of storyStateCommanders(st)) {
            if (cmd.isPlayer) continue;                       // oyuncunun kasasına karışma
            if (Math.random() > CMD_INVEST_CHANCE) continue;
            const n = storyNode(cmd.node);
            if (!n || n.owner !== st.id || !cmd.res) continue;
            const front = (n.neighbors || []).some(nb => { const m = storyNode(nb); return m && m.owner !== st.id; });
            const gar = n.garrison || 0, garCap = Math.min(CMD_GARRISON_SOFT_CAP, storyCityGarrisonCap(n));
            const hungry = cmdArmyCount(cmd) < cmdArmyCap(cmd) * 0.75;   // ordusu eksik mi?

            // 1) ORDU EKSİK → üret (savaşan ordu her şeyden önce gelir)
            if (hungry && aiTryProduce(n, st, [cmd])) continue;
            // 2) CEPHE ŞEHRİ + garnizon çok zayıf → asgari savunma refleksi
            if (front && gar < garCap && cmd.res.manpower >= CITY_GARRISON_COST) {
                cmd.res.manpower -= CITY_GARRISON_COST; n.garrison = gar + 1;
                continue;
            }
            // 3) altyapı eksik → bina kur (üretim kapasitesi uzun vadeli ordu demektir)
            if (aiTryBuild(n, st, cmd)) continue;
            // 4) şehir yükselt (kapasite/savunma/gelir)
            if ((n.level || 1) < 3) {
                const cost = CITY_UPGRADE_COST[n.level || 1] || 300;
                if (cmd.res.points >= cost) { cmd.res.points -= cost; n.level = (n.level || 1) + 1; continue; }
            }
            // 5) geride kalan garnizon boşluğu (yalnız yumuşak tavana kadar)
            if (gar < garCap && cmd.res.manpower >= CITY_GARRISON_COST) {
                cmd.res.manpower -= CITY_GARRISON_COST; n.garrison = gar + 1;
                continue;
            }
            // 6) ordu doluysa bile üretime devam (depo birikir, diğer komutanlar sevk alır)
            aiTryProduce(n, st, [cmd]);
        }
    }
}

// DEVLET DÜZEYİ GELİŞTİRME — komutanın bulunmadığı GERİ şehirler de gelişsin.
// Bu döngü eskiden yalnız AI devletleri için çalışıyordu; komutan-düzeyi yatırım eklenince
// AI hem devlet hem komutan katmanından yatırım yapar, oyuncunun devleti yalnız komutan
// katmanından yapar oldu. Ölçüm: oyuncu 19→1 şehre düştü, AI sefer ordusu 881'e çıktı.
// Artık TÜM devletler için çalışır (oyuncunun KENDİ kasası hariç — o senin kararın).
function storyAICityTick() {
    storyCommanderCityTick();   // önce komutanların yerel yatırımı (oyuncu devleti dahil)
    for (const st of STORY.states) {
        if (!st.gov) continue;
        const owned = STORY.nodes.filter(n => n.owner === st.id); if (!owned.length) continue;
        const border = owned.filter(n => n.neighbors.some(nb => { const m = storyNode(nb); return m && m.owner !== st.id; }));
        const pick = border.length ? border : owned;
        const n = pick[(Math.random() * pick.length) | 0];
        const cmds = storyStateCommanders(st).filter(c => !c.isPlayer);   // oyuncunun kasasına dokunma
        if (!cmds.length) continue;
        const rich = g => cmds.slice().sort((a, b) => ((b.res && b.res[g]) || 0) - ((a.res && a.res[g]) || 0))[0];
        // SİMETRİK MALİYET: oyuncuyla AYNI — garnizon 70👥, şehir 300/600⭐, bina FACTORY/BARRACKS_COST
        const r = Math.random();
        if (r < 0.28) {
            const p = rich('manpower');
            if ((n.garrison || 0) < storyCityGarrisonCap(n) && p && p.res && p.res.manpower >= CITY_GARRISON_COST) {
                p.res.manpower -= CITY_GARRISON_COST; n.garrison = (n.garrison || 0) + 1;
            }
        } else if (r < 0.45) {
            const p = rich('points');
            if ((n.level || 1) < 3) {
                const cost = CITY_UPGRADE_COST[n.level || 1] || 300;
                if (p && p.res && p.res.points >= cost) { p.res.points -= cost; n.level = (n.level || 1) + 1; }
            }
        } else if (r < 0.68) {
            aiTryBuild(n, st, rich('points'));
        } else {
            aiTryProduce(n, st, cmds);
        }
    }
}

// ── FETİH: havuz ganimet/imha ──
// Şehir el değiştirince orada bekleyen ordu yok olur; küçük bir kısmı fatihe kalır.
// Snowball'u sınırlar ama "şehri almak orduyu da almaktır" hissini korur.
function storyCaptureNodePool(n) {
    if (!n) return;
    const keep = {};
    for (const k in (n.pool || {})) {
        const c = n.pool[k] | 0;
        const g = Math.floor(c * 0.25);
        if (g > 0) keep[k] = g;
    }
    n.pool = keep;
    n.q = [];   // üretim kuyruğu fetihle dağılır
}

// ── AI BÜTÇESİ: havuzdan türetilir ──
// Adalet şartı: kimse kurmadığı orduyu sahaya süremez. AI hâlâ tipli bütçe harcar
// (aiDeploy / DEPLOY_RES.red dalı değişmez) ama o bütçe artık GERÇEKTEN ürettiği ordunun değeri.
function storyPoolBudget(stateId, cityId, opts) {
    opts = opts || {};
    // SEFER ORDUSU modeli: o şehirde duran komutanların orduları (+ savunmada şehrin deposu).
    // Eskiden komşu şehirlerin havuzları da toplanıyordu; artık ordu komutanla gezdiği için
    // "kim oradaysa o savaşır" kuralı geçerli — oyuncuyla birebir aynı.
    const m = storyMusterAt(stateId, cityId, !!opts.garrison);
    const b = { oil: 0, manpower: 0, points: 0 };
    for (const k in m.avail) {
        const t = +k, g = UNIT_RES_GROUP[t] || 'manpower';
        b[g] += ((STATS[t] && STATS[t].cost) || 70) * (m.avail[k] | 0);
    }
    const node = storyNode(cityId);
    if (opts.garrison && node) b.manpower += (node.garrison || 0) * 50;
    if (opts.floor) b.manpower = Math.max(b.manpower, opts.floor);
    const st = storyState(stateId);
    const div = (st && st._techBonus && st._techBonus.allCost) || 1;
    for (const g in b) b[g] = Math.max(0, Math.min(4200, Math.round(b[g] / div)));
    return { budget: b, src: m.src };
}
