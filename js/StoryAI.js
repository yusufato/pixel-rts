// ═══════════════════════════════════════════════════════════════════════════
//  KOMUTAN AI — özerk hareket, hedef değerlendirme, genelkurmay, kuşatma
//  ---------------------------------------------------------------------------
//  Story.js'ten AYRILDI (davranış değişmedi, yalnız kod taşındı).
//  Story.js 2625 satıra çıkmıştı; okunabilirlik için uyumlu parçalara bölündü.
//  Küresel script düzeni: bu dosya Story.js'ten SONRA yüklenir. Hepsi fonksiyon
//  tanımı olduğu için (hoisting) çağrı sırası etkilenmez.
// ═══════════════════════════════════════════════════════════════════════════

// ══ FAZ-2 ADIM 5: KOMUTAN AI — özerk hareket/fetih/savunma + sadakat/firar/darbe ══
// rastgele storyEnemyDrift/storyMaybeInvade KALDIRILDI → fetih komutanların KONUMUNDA olur (jetonlar artık gerçek aktör).
const CMD_PERSONA_AGGR = { agresif: 1.3, dengeli: 1.0, savunmacı: 0.5, fırsatçı: 1.15 };
function storyTechPowerMul(st) { return 1 + ((st && st.tech ? st.tech.length : 0) * 0.03); }   // teknolojili devlet daha güçlü savaşır
// FAZ-3: komutanın gücü artık ORDUSUNA dayanır. Eskiden yalnız kasasına (manpower) bakıyordu;
// savaşa gireceği birlikler ise havuzdan geliyordu. Kasası dolu ama şehri boş bir komutan
// "güçlüyüm" deyip saldırıya kalkıyor, sahaya hiç birlik çıkaramıyordu. ("3-4 komutan hiç
// ordusu olmadan zafer kazanacağına inanıyor.")
// FAZ-5: ordu artık komutanın ÜZERİNDE (cmd.army) — şehirde beklemiyor, onunla geziyor.
function storyCommanderArmy(cmd, st) {
    return (typeof cmdArmyCount === 'function') ? cmdArmyCount(cmd) : 0;
}
function storyCalcCommanderPower(cmd, st) {
    const base = 20 + ((cmd.skills && cmd.skills.warrior) || 0) * 12;   // liderlik katkısı (ordu olmadan tek başına az)
    const army = storyCommanderArmy(cmd, st) * 14;                       // ASIL güç: sevk edebileceği birlik sayısı
    const kasa = ((cmd.res && cmd.res.manpower) || 0) * 0.02;            // kasa artık ikincil (üretim potansiyeli)
    const loyF = 0.7 + ((cmd.loyalty == null ? 60 : cmd.loyalty) / 100) * 0.3;
    return Math.round((base + army + kasa) * storyTechPowerMul(st) * loyF);
}
function storyCalcDefenseStrength(node, st) {
    // FAZ-3: şehirde bekleyen ORDU HAVUZU da savunmaya katılır → storyEvalTarget/storyExposureAt
    // bu sayede "iyi savunulan şehre saldırma" davranışını ekstra AI kodu olmadan öğrenir.
    const poolStr = (typeof storyPoolPower === 'function') ? storyPoolPower(node) : 0;
    const militia = (typeof cityMilitiaFor === 'function') ? cityMilitiaFor(node) : 3;
    let s = 60 + militia * 8 + ((node.cities || 0) * 10) + ((node.garrison || 0) * 10) + poolStr, cmdStr = 0;
    if (st && st.gov) for (const c of storyStateCommanders(st)) {
        if (c.node === node.id) cmdStr += storyCalcCommanderPower(c, st);
        else if (node.neighbors.indexOf(c.node) >= 0) cmdStr += storyCalcCommanderPower(c, st) * 0.5;
    }
    // ŞEHİR SEVİYESİ TAHKİMATI: savaş-içi dayanıklılık bonusunun stratejik karşılığı —
    // AI gelişmiş şehre saldırmadan önce iki kez düşünür.
    const fort = 1 + ((typeof cityDefenseBonus === 'function') ? cityDefenseBonus(node) : 0);
    return Math.round((s + cmdStr) * storyTechPowerMul(st) * fort);
}
// ══ FAZ-2 ADIM 6: ŞEHİR GELİŞTİRME (seviye + garnizon) + 0-BÖLGE YENİLGİ ═══════
const CITY_UPGRADE_COST = [0, 300, 600];     // mevcut lvl → üst lvl maliyeti (⭐puan): 1→2=300, 2→3=600
const CITY_GARRISON_COST = 70;               // garnizon başı 70 👥insan gücü
function storyCityGarrisonCap(n) { return (n.level || 1) * 4; }   // lvl1=4, lvl2=8, lvl3=12
function storyCityUpgrade(nodeId) {
    const n = storyNode(nodeId); if (!n || n.owner !== STORY.playerStateId) return;
    const lvl = n.level || 1;
    if (lvl >= 3) { storyFlash('Şehir zaten maksimum seviye (3).'); return; }
    const cost = CITY_UPGRADE_COST[lvl] || 300;
    const pts = (STORY.commander && STORY.commander.res) ? STORY.commander.res.points : 0;
    if (pts < cost) { storyFlash(`⭐ Puan yetersiz (gerekli ${cost}, var ${Math.floor(pts)}).`); return; }
    STORY.commander.res.points -= cost; n.level = lvl + 1;
    storyLog(`🏗️ <b>${n.name}</b> seviye ${n.level} (gelir +%${Math.round((n.level - 1) * 40)}, garnizon kapasitesi ${storyCityGarrisonCap(n)}).`);
    storySave(); if (typeof storyCityUpdate === 'function') storyCityUpdate();
}
function storyCityGarrison(nodeId) {
    const n = storyNode(nodeId); if (!n || n.owner !== STORY.playerStateId) return;
    if ((n.garrison || 0) >= storyCityGarrisonCap(n)) { storyFlash(`Garnizon dolu (${storyCityGarrisonCap(n)}) — şehri yükselt.`); return; }
    const mp = (STORY.commander && STORY.commander.res) ? STORY.commander.res.manpower : 0;
    if (mp < CITY_GARRISON_COST) { storyFlash(`👥 İnsan gücü yetersiz (gerekli ${CITY_GARRISON_COST}).`); return; }
    STORY.commander.res.manpower -= CITY_GARRISON_COST; n.garrison = (n.garrison || 0) + 1;
    storyLog(`🛡️ <b>${n.name}</b> garnizonu ${n.garrison}/${storyCityGarrisonCap(n)} (savunma düellosunda birlik olarak savaşır).`);
    storySave(); if (typeof storyCityUpdate === 'function') storyCityUpdate();
}
// AI: her devlet ara sıra bir SINIR şehrini geliştirir (garnizon önceliği — savunma)
// AI ŞEHİR GELİŞTİRME + ÜRETİM → js/Production.js (storyAICityTick)
// Oyuncu havuzdan ordu sürerken AI'nın da üretmesi ADALET ŞARTI; aynı maliyetler, aynı motor.
// SAVUNMA düellosunda şehrin TABAN MİLİS + GARNİZONU ek savunan birlik olarak çıkar (otonom dost-AI)
const CITY_MILITIA_BASE = 3;   // her şehrin doğuştan milisi (düşman savunma base'i 250 ile SİMETRİ; garnizonsuz bile şehir savunmasız değil)
function storySpawnGarrison() {
    const ctx = STORY.battleCtx;
    if (!ctx || ctx.mode !== 'defense' || typeof T === 'undefined' || typeof Unit === 'undefined') return;
    const node = storyNode(ctx.nodeId); if (!node) return;
    // ŞEHİR SEVİYESİ: milis tabanı seviyeyle büyür (Sv.1=3, Sv.2=5, Sv.3=8)
    const base = (typeof cityMilitiaFor === 'function') ? cityMilitiaFor(node) : CITY_MILITIA_BASE;
    const g = Math.min(20, base + Math.min(storyCityGarrisonCap(node), node.garrison || 0));
    for (let i = 0; i < g; i++) {
        const type = (i % 3 === 0) ? T.ANTI_TANK : T.INFANTRY;
        const u = new Unit(type, 180 + (i % 10) * 52, (WORLD_H - 300) - Math.floor(i / 10) * 50, false);   // gazi/müttefik ile aynı güvenli dizilim bölgesi
        u.ally = true;
        if (typeof getSquadRole === 'function') u.squad = getSquadRole(type);
        if (typeof applyTechSpawnBonus === 'function') applyTechSpawnBonus(u);
        units.push(u); player.unitsSpawned++;
    }
    storyLog(`🛡️ ${node.name} (Sv.${node.level || 1}) milis + garnizonu: ${g} birlik savunmaya katıldı.`);
}

// ŞEHİR TAHKİMATI: savunma düellosunda ŞEHRİ TUTAN tarafın tüm birlikleri seviyeye göre
// dayanıklılık kazanır (Sv.2 +%25, Sv.3 +%45). "Seviye yükseltmenin anlamı yok" sorununun
// savaş-içi karşılığı budur: gelişmiş şehir gerçekten zor alınır.
function storyApplyCityFortification() {
    const ctx = STORY.battleCtx;
    if (!ctx || typeof cityDefenseBonus !== 'function') return;
    const node = storyNode(ctx.nodeId); if (!node) return;
    const bonus = cityDefenseBonus(node);
    if (bonus <= 0) return;
    // Savunan taraf: hikâyede savunma modunda MAVİ (oyuncu), saldırı modunda KIRMIZI (şehrin sahibi)
    const defenderIsRed = (ctx.mode === 'attack');
    let n = 0;
    for (const u of units) {
        if (u.dead || u.isRed !== defenderIsRed) continue;
        u.maxHp = Math.round(u.maxHp * (1 + bonus));
        u.hp = u.maxHp;
        u.baseArmor = (u.baseArmor || 0) + (node.level >= 3 ? 2 : 1);
        u.armor = u.baseArmor;
        n++;
    }
    if (n) storyLog(`🧱 ${node.name} tahkimatı: savunan ${n} birlik +%${Math.round(bonus * 100)} dayanıklılık.`);
}
// 0-BÖLGE YENİLGİ: oyuncu tüm şehirlerini kaybetti → kampanya bitti
function storyCheckPlayerDefeat() {
    if (STORY._gameOver || STORY.battleCtx) return false;   // savaş sürerken tetikleme (önce düello biter)
    if (STORY.nodes.some(n => n.owner === STORY.playerStateId)) return false;
    STORY._gameOver = true; STORY.paused = true;
    storyLog('💀 KAMPANYA BİTTİ — tüm bölgelerini kaybettin.'); storyRender();
    setTimeout(() => {
        if (confirm('💀 KAMPANYA BİTTİ!\n\nTüm bölgelerini kaybettin (0 şehir).\n\nYeni kampanya başlat? (İptal → ana menü)')) { storyNewCampaign(); storyResize(); storyRender(); }
        else { showScreen('menu'); }   // iptal → donuk ekranda kalma, menüye dön
    }, 60);
    return true;
}
// ── BİREY-KARAR: komutan kendi gücünü değerlendirir, BEKLENEN-DEĞER ile hedef seçer, kişiliğe göre risk alır ──
const CMD_WEAK_MANPOWER = 60;   // bu kasanın altında "zayıf" → saldırma; güvenli şehre çekilip gelirle toparlan
const CMD_PERSONA = {           // her kişilik = farklı BİREY (min kazanma + değer çarpanı + başkent-arar + dolaşır + RİSK-TEMKİNİ)
    agresif:   { minWin: 0.35, valMul: 1.30, capitalSeek: true,  wander: true,  caution: 0.5 },   // riske atılır, açıkta kalmayı umursamaz
    dengeli:   { minWin: 0.50, valMul: 1.00, capitalSeek: false, wander: true,  caution: 1.0 },
    savunmacı: { minWin: 0.70, valMul: 0.70, capitalSeek: false, wander: false, caution: 1.8 },   // çok temkinli, overextension'dan kaçar
    fırsatçı:  { minWin: 0.55, valMul: 1.20, capitalSeek: false, wander: true,  caution: 0.9 },   // hesaplı av
};
function storyCommanderWeak(cmd) { return ((cmd.res && cmd.res.manpower) || 0) < CMD_WEAK_MANPOWER; }

// ── ORDU TOPLAMA: ordusuz komutan saldırmaz, üretim yapılabilen şehre gider ──
// Havuz sistemine geçince stratejik katman "ordum var mı" sorusunu hiç sormuyordu.
// Bu iki fonksiyon o boşluğu kapatır: taarruz için en az MIN_ATTACK_ARMY birlik gerekir,
// yoksa komutan en yakın ÜRETİM şehrine (fabrika/kışla olan; yoksa başkent) yürür.
const MIN_ATTACK_ARMY = 3;
function storyProductionHome(st) {
    const owned = STORY.nodes.filter(n => n.owner === st.id);
    if (!owned.length) return null;
    const capId = (STORY._capitals && STORY._capitals[st.id] != null) ? STORY._capitals[st.id] : null;
    const cap = capId != null ? owned.find(n => n.id === capId) : null;
    if (cap && ((cap.fac | 0) || (cap.bar | 0))) return cap;                 // başkent üretim yapabiliyorsa oraya
    const prod = owned.filter(n => (n.fac | 0) || (n.bar | 0))
        .sort((a, b) => (((b.fac | 0) + (b.bar | 0)) - ((a.fac | 0) + (a.bar | 0))));
    return prod[0] || cap || owned[0];
}
// Ordusu yetersiz komutanı üretim merkezine doğru 1 adım yürütür. true → bu tick iş bitti.
function storyCommanderSeekArmy(cmd, st) {
    if (storyCommanderArmy(cmd, st) >= MIN_ATTACK_ARMY) return false;        // ordusu var, normal karar zincirine devam
    const home = storyProductionHome(st);
    if (!home) return false;
    if (cmd.node === home.id) return true;                                   // zaten üretim merkezindeyim → bekle, ordu birikiyor
    const step = storyStepToward(cmd.node, home.id, st);
    if (step >= 0 && step !== cmd.node) { cmd.node = step; return true; }
    return true;                                                             // yol yok ama saldırmaya da kalkma
}
// hedef şehrin DEĞERİ: kaynak/şehir + başkent + zayıf-devlet fırsatı
function storyTargetValue(node) {
    const owner = storyState(node.owner);
    let v = 10 + (node.cities || 0) * 8 + (node.oil || 0) * 10 + (node.pts || 0) * 6;
    if (owner && STORY._capitals && STORY._capitals[owner.id] === node.id) v += 30;   // başkent değerli
    if (owner && (owner.welfare < 35 || owner.reputation < 2)) v += 15;               // zayıf devlet = fırsat
    return v;
}
// ── ADIM 1.2 İLERİYE-BAKIŞ: bir düğüme yerleşirsem bana komşu DÜŞMAN KOMUTAN gücü = KARŞI-SALDIRI riski ──
// (Attila-tarzı: "şehri alırım ama açıkta kalırsam geri alınır / yan cephem çöker" — tuzağa düşme)
function storyExposureAt(node, st) {
    if (!node) return 0;
    let threat = 0;
    for (const nb of node.neighbors) {
        const n = storyNode(nb); if (!n || n.owner === st.id) continue;             // sadece DÜŞMAN komşular
        if (typeof storyIsHostile === 'function' && !storyIsHostile(st.id, n.owner)) continue;   // FAZ-6: antlaşmalı komşu tehdit değil
        const ns = storyState(n.owner); if (!ns || !ns.gov) continue;
        for (const c of storyStateCommanders(ns)) {                                 // o düşman şehrinde/komşusunda hareketli kuvvet
            if (c.node === nb) threat += storyCalcCommanderPower(c, ns);
            else if (n.neighbors.indexOf(c.node) >= 0) threat += storyCalcCommanderPower(c, ns) * 0.5;
        }
    }
    return threat;
}
// ── ADIM 1.1 DERİN DEĞERLENDİRME: değer × kazanma × (ileriye-bakış riski) × (konsolidasyon) — açgözlü tek-adım DEĞİL ──
function storyEvalTarget(cmd, st, t, atk, p) {
    const ts = storyState(t.owner); if (!ts) return null;
    const win = atk / (atk + storyCalcDefenseStrength(t, ts));
    // KİŞİLİK MOTORU (AŞAMA 1): devlet doktrini CUMHURBAŞKANINDAN türer ve asıl
    // kaldıracı RİSK EŞİĞİDİR. İlk sürüm yalnız EV'yi çarpıyordu; ölçüm (doctrine.js)
    // bunun etkisiz olduğunu yakaladı — hedef seçiminde mutlak eşik yok, EV çarpanı
    // sadece SIRALAMAYI değiştiriyor, saldırı kararını değil. Şahin lider riskli
    // hedefe de girer (minWin ×0.8), güvercin yalnız garanti işe girer (×1.2).
    const _doc = (typeof storyDoctrineAggr === 'function') ? storyDoctrineAggr(st) : 1;
    if (win < Math.min(0.95, p.minWin * (2 - _doc))) return null;                   // kişilik × doktrin risk eşiği
    // FAZ-10: ÇAĞ ETKİSİ — kaos/ateş çağında herkes daha atak, barışta daha çekingen
    const _eraAggr = (typeof storyEraEffects === 'function') ? (storyEraEffects().aggression || 1) : 1;
    let ev = storyTargetValue(t) * p.valMul * win * _eraAggr * _doc;
    // (1.2) İLERİYE-BAKIŞ — overextension cezası: alırsam karşı-saldırı gücü gücüme göre büyükse EV düşer (temkin kişiliğe bağlı)
    const exposure = storyExposureAt(t, st);
    ev /= (1 + (exposure / Math.max(atk, 1)) * (p.caution == null ? 1 : p.caution));
    // (1.1) KONSOLİDASYON — çevresi dost şehirlerse güvenli kazanç (kuşatılmış cep); derin düşman salient'i riskli
    let fr = 0, en = 0;
    for (const nb of t.neighbors) { const n = storyNode(nb); if (!n) continue; if (n.owner === st.id) fr++; else en++; }
    ev *= 0.8 + 0.4 * (fr / Math.max(1, fr + en));                                  // 0.8 (açık salient) .. 1.2 (kuşatılmış)
    if (t._siege && t._siege.by === st.id) ev *= 0.35;                              // zaten biz kuşatıyoruz → BAŞKA cepheye yayıl
    if (p.capitalSeek && STORY._capitals && STORY._capitals[ts.id] === t.id) ev += 40;
    return { t, ts, ev, win, exposure };
}
// zayıf komutan: en yakın GÜVENLİ iç şehre (ya da başkente) 1 adım çekilip toparlanır
function storyCommanderRecover(cmd, st) {
    const capId = STORY._capitals ? STORY._capitals[st.id] : null;
    const start = cmd.node, parent = {}; parent[start] = start; const q = [start]; let goal = null;
    while (q.length) {
        const cur = q.shift(); const node = storyNode(cur); if (!node) continue;
        const interior = !node.neighbors.some(nb => { const nn = storyNode(nb); return nn && nn.owner !== st.id; });
        if (cur !== start && (cur === capId || interior)) { goal = cur; break; }
        for (const nb of node.neighbors) { const nn = storyNode(nb); if (nn && nn.owner === st.id && !(nb in parent)) { parent[nb] = cur; q.push(nb); } }
    }
    if (goal == null) return;
    let step = goal; while (parent[step] !== start) step = parent[step];
    if (step !== start) cmd.node = step;
}
function storyCommanderDecide(cmd, st) {
    const node = storyNode(cmd.node); if (!node) return;
    const onFront = node.neighbors.some(nb => { const nn = storyNode(nb); return nn && nn.owner !== st.id; });
    // 1) ÖZ-KORUMA: kasası bitmişse SALDIRMA → cephedeyse güvenli şehre çekilip toparlan (plan dinlemez)
    if (storyCommanderWeak(cmd)) {
        if (onFront) { storyCommanderRecover(cmd, st); if (Math.random() < 0.12) storyLog(`🛡️ ${cmd.name} (${st.name}) yıpranmış — geri çekilip toparlanıyor.`); }
        return;
    }
    // 1.5) ORDU YOKSA SALDIRMA: havuzunda yeterli birlik yoksa üretim merkezine yürü.
    // (Savunma emri istisnadır — kuşatılan şehri terk etmesin.)
    const defending = cmd._objective && cmd._objective.kind === 'defend';
    if (!defending && storyCommanderSeekArmy(cmd, st)) return;
    // 2) GENELKURMAY EMRİ (1.3 KOORDİNASYON): devlet planındaki hedefi uygula → yığılma yok + savunma boyutlu
    if (storyExecuteObjective(cmd, st)) return;
    // 3) FALLBACK (emir yok/uygulanamadı) — bireysel mantık: takviye → ilerle → derin-EV
    const rein = storyReinforceStep(cmd, st);
    if (rein === cmd.node) return;                              // zaten kuşatılan dost şehirdeyim → savun (kal)
    if (rein >= 0) { cmd.node = rein; return; }                 // dost kuşatmasına doğru 1 adım ilerle
    if (!onFront) { storyCommanderAdvance(cmd, st); return; }   // cephe yoksa cepheye ilerle
    // DERİN BEKLENEN-DEĞER hedef seç → KUŞAT (değer × kazanma × ileriye-bakış-riski × konsolidasyon; açgözlü tek-adım DEĞİL)
    // FAZ-6 DİPLOMASİ: ateşkes/pakt/ittifak olan devlete saldırılmaz (antlaşma bozmak ayrı bir karardır)
    const enemies = node.neighbors.map(storyNode).filter(n => n && n.owner !== st.id
        && (typeof storyIsHostile !== 'function' || storyIsHostile(st.id, n.owner)));
    const p = CMD_PERSONA[cmd.personality] || CMD_PERSONA.dengeli;
    const atk = storyCalcCommanderPower(cmd, st);
    let best = null;
    for (const t of enemies) {
        const cand = storyEvalTarget(cmd, st, t, atk, p);       // 1.1 + 1.2: derin değerlendirme + ileriye-bakış
        if (cand && (!best || cand.ev > best.ev)) best = cand;
    }
    if (!best) { if (p.wander) storyCommanderAdvance(cmd, st); return; }   // güvenli/akıllı hedef yok: saldırgan başka cephe arar
    storyBeginSiege(st, best.t);                                // KUŞATMAYA al (storySiegeTick olgunlaşınca çözer; bu sürede savunan takviye gelir)
}
// komşu düşman yoksa: kendi topraklarında EN YAKIN CEPHE şehrine (düşman-komşulu) doğru 1 adım ilerle (BFS)
function storyCommanderAdvance(cmd, st) {
    const start = cmd.node, parent = {}; parent[start] = start;
    const q = [start]; let goal = null;
    while (q.length) {
        const cur = q.shift(); const node = storyNode(cur); if (!node) continue;
        if (cur !== start && node.neighbors.some(nb => { const nn = storyNode(nb); return nn && nn.owner !== st.id; })) { goal = cur; break; }   // cephe bulundu
        for (const nb of node.neighbors) { const nn = storyNode(nb); if (nn && nn.owner === st.id && !(nb in parent)) { parent[nb] = cur; q.push(nb); } }
    }
    if (goal == null) return false;
    let step = goal; while (parent[step] !== start) step = parent[step];   // start'tan sonraki İLK adım
    cmd.node = step; return true;
}
// ── ADIM 1.3 KOORDİNASYON: yön-bulma + GENELKURMAY (devlet komutanlarını TEK planda hedeflere dağıtır) ──
// fromId'den toId'ye İLK adım (BFS; SADECE kendi toprağından geçer, hedefin kendisi düşman olabilir)
function storyStepToward(fromId, toId, st) {
    if (fromId == null || toId == null || fromId === toId) return fromId;
    const parent = {}; parent[fromId] = fromId; const q = [fromId];
    while (q.length) {
        const cur = q.shift(); const n = storyNode(cur); if (!n) continue;
        for (const nb of n.neighbors) {
            if (nb in parent) continue;
            parent[nb] = cur;
            if (nb === toId) { let s = nb; while (parent[s] !== fromId) s = parent[s]; return s; }
            const nn = storyNode(nb); if (nn && nn.owner === st.id) q.push(nb);   // ara düğümler kendi toprağı olmalı
        }
    }
    return -1;
}
// nodeId'ye en yakın (hop) komutanı bul (BFS dışa)
function storyNearestCommander(list, nodeId) {
    const seen = {}; seen[nodeId] = true; const q = [nodeId];
    while (q.length) {
        const cur = q.shift();
        const here = list.find(c => c.node === cur); if (here) return here;
        const n = storyNode(cur); if (!n) continue;
        for (const nb of n.neighbors) if (!seen[nb]) { seen[nb] = true; q.push(nb); }
    }
    return list[0] || null;
}
const STAFF_REPLAN = 3;   // saniye: genelkurmay yeniden-planlama (kısa = yeni kuşatmaya hızlı savunma ataması)
function storyStaffPlan(st) {
    if (!st.gov) return;
    const cmds = storyStateCommanders(st).filter(c => c !== STORY.commander && !storyCommanderWeak(c));   // zayıflar kendi recover'ına bırakılır
    for (const c of cmds) c._objective = null;                 // taze plan
    if (!cmds.length) return;
    const free = cmds.slice();
    // STRATEJİ POSTÜRÜ: ekonomi + cephe yükü → konsolide(<0.7) / dengeli / genişle(>=1.0).
    // Tükenmiş ya da çok-cepheye-yayılmış devlet saldırıyı KISAR (intihari overextension yok; dünya nefes alır — ileride diplomasi rahatlatır).
    const fronts = STORY.nodes.filter(n => n.owner === st.id && n.neighbors.some(nb => { const m = storyNode(nb); return m && m.owner !== st.id; })).length;
    const avgMp = cmds.reduce((s, c) => s + ((c.res && c.res.manpower) || 0), 0) / cmds.length;
    const econF = Math.max(0.4, Math.min(1.2, avgMp / 200));                            // 200 başlangıç kasa = 1.0; tükenmiş → 0.4
    const loadF = Math.max(0.5, Math.min(1.2, cmds.length / Math.max(1, fronts)));      // az komutan + çok cephe = yayılmış → kıs
    const maxAttacks = (econF * loadF) < 0.7 ? 1 : ((econF * loadF) < 1.0 ? 2 : 99);    // konsolide: tek kritik hedef; güçlü: serbest
    // 1) SAVUNMA İHTİYAÇLARI: tehdit altındaki/kuşatılan kendi SINIR şehirleri → açığı kapatacak kadar komutan (fazlası değil)
    const defNeeds = [];
    for (const n of STORY.nodes) {
        if (n.owner !== st.id) continue;
        if (!n.neighbors.some(nb => { const m = storyNode(nb); return m && m.owner !== st.id
            && (typeof storyIsHostile !== 'function' || storyIsHostile(st.id, m.owner)); })) continue;   // sadece DÜŞMAN sınırı
        const threat = storyExposureAt(n, st); const besieged = !!(n._siege && n._siege.by !== st.id);
        if (threat <= 0 && !besieged) continue;
        const deficit = threat * (besieged ? 1.25 : 0.9) - storyCalcDefenseStrength(n, st);
        if (deficit > 0 || besieged) defNeeds.push({ node: n, deficit: Math.max(deficit, 1), urgency: (besieged ? 1e4 : 0) + threat });
    }
    defNeeds.sort((a, b) => b.urgency - a.urgency);
    const covered = {};
    const assignDef = (need) => {
        const c = storyNearestCommander(free, need.node.id); if (!c) return false;
        free.splice(free.indexOf(c), 1); c._objective = { kind: 'defend', node: need.node.id };
        if (c.node !== need.node.id) c._nextT = STORY.clock;   // ACİL: beklemeden yola çık
        covered[need.node.id] = (covered[need.node.id] || 0) + storyCalcCommanderPower(c, st);
        return true;
    };
    // PASS 1 — YAY: HER kuşatılan/tehdit şehrine EN AZ 1 savunan (5 şehir kuşatılıyorsa 2'ye yığılma YOK)
    for (const need of defNeeds) { if (!free.length) break; assignDef(need); }
    // PASS 2 — DERİNLEŞTİR: hâlâ açığı olan en acil şehirlere ek savunan
    for (const need of defNeeds) { while ((covered[need.node.id] || 0) < need.deficit && free.length) { if (!assignDef(need)) break; } }
    // 2) SALDIRI HEDEFLERİ: serbest komutanların komşusundaki düşman şehirler → değerliye YETERLİ güç, sonra SIRADAKİNE (YAYIL, yığılma yok)
    const targets = [], seen = {};
    for (const c of free) {
        const cn = storyNode(c.node); if (!cn) continue;
        for (const nb of cn.neighbors) {
            const t = storyNode(nb); if (!t || t.owner === st.id || seen[t.id]) continue;
            const ts = storyState(t.owner); if (!ts) continue;
            seen[t.id] = true;
            const pri = storyTargetValue(t) / (1 + storyExposureAt(t, st) / 200);   // maruziyet-ayarlı öncelik (1.1/1.2 ruhu: riskli salient = düşük)
            targets.push({ node: t, need: storyCalcDefenseStrength(t, ts) * 1.15, pri: pri });
        }
    }
    targets.sort((a, b) => b.pri - a.pri);
    let freePower = free.reduce((s, c) => s + storyCalcCommanderPower(c, st), 0), attacked = 0;
    for (const tg of targets) {
        if (!free.length || attacked >= maxAttacks) break;     // POSTÜR: konsolide modda az/tek saldırı (kalanlar savunmada/toparlanır)
        if (tg.need > freePower * 1.25) continue;              // bu hedef şu an ALINAMAZ → komutanları boşa harcama (atla, başka cepheye)
        let force = 0, took = false;
        while (free.length && force < tg.need) {
            const c = storyNearestCommander(free, tg.node.id); if (!c) break;
            free.splice(free.indexOf(c), 1); c._objective = { kind: 'attack', node: tg.node.id };
            const cp = storyCalcCommanderPower(c, st); force += cp; freePower -= cp; took = true;
        }
        if (took) attacked++;
    }
    // 3) KALAN komutanlar: cepheye ilerle
    for (const c of free) c._objective = { kind: 'advance', node: -1 };
}
// Genelkurmay emrini uygula; uyguladıysa true (bireysel fallback çalışmaz)
function storyExecuteObjective(cmd, st) {
    const obj = cmd._objective; if (!obj) return false;
    if (obj.kind === 'advance') return storyCommanderAdvance(cmd, st);
    if (obj.node == null) return false;
    const tgt = storyNode(obj.node), node = storyNode(cmd.node); if (!tgt || !node) return false;
    if (obj.kind === 'defend') {
        if (tgt.owner !== st.id) return false;                 // şehir artık bizde değil → emir geçersiz (fallback)
        if (cmd.node === obj.node) return true;                // savunmadayım → KAL
        const step = storyStepToward(cmd.node, obj.node, st);  // TEK ADIM (zıplama yok); hız acil-savunma sık-kararıyla (2s) sağlanır
        if (step >= 0 && step !== cmd.node) { cmd.node = step; return true; }
        return false;
    }
    if (obj.kind === 'attack') {
        if (tgt.owner === st.id) return false;                 // hedef alınmış → emir geçersiz
        if (node.neighbors.indexOf(obj.node) >= 0) { storyBeginSiege(st, tgt); return true; }   // bitişik → KUŞAT
        const step = storyStepToward(cmd.node, obj.node, st);  // kendi toprağından yaklaş
        if (step >= 0 && step !== cmd.node) { cmd.node = step; return true; }
        return false;
    }
    return false;
}
function storyAICommanderTick() {
    if (STORY.battleCtx) return;
    for (const st of STORY.states) {
        if (!st.gov) continue;                                   // OYUNCU devleti DAHİL: ek komutanlar özerk (savun/kuşat/ilerle); STORY.commander zaten gov'da değil (oyuncu kontrol eder)
        if ((st._nextStaff || 0) <= STORY.clock) { st._nextStaff = STORY.clock + STAFF_REPLAN; storyStaffPlan(st); }   // 1.3 GENELKURMAY: komutanları hedeflere dağıt
        for (const cmd of st.gov.commanders.slice()) {           // slice: tick içinde dizi değişse de güvenli
            if ((cmd._nextT || 0) > STORY.clock) continue;
            cmd._nextT = STORY.clock + 6 + Math.random() * 3;     // 6-9s kişisel cooldown → hepsi aynı anda saldırmaz
            storyCommanderDecide(cmd, st);
            if (cmd._objective && cmd._objective.kind === 'defend' && cmd.node !== cmd._objective.node) cmd._nextT = STORY.clock + 2;   // ACİL SAVUNMA: yolda → hızlı tekrar (yetişsin)
            if (STORY.battleCtx) return;                          // oyuncu düellosu açıldı → tick'i durdur
        }
    }
}
function storyPushBattle(cmd, won) {
    if (!cmd.recentBattles) cmd.recentBattles = [];
    cmd.recentBattles.push(won ? 1 : 0);
    if (cmd.recentBattles.length > 3) cmd.recentBattles.shift();
}
// AI-vs-AI: SOYUT çözüm (düello/confirm YOK), sadece log
// Komutanı oyundan KALDIR (öl). Oyuncu jetonu (STORY.commander) ASLA ölmez.
const CMD_DEATH_ON_LOSS = 0.45;  // yenilen komutanın ölme olasılığı (yoksa yaralı çekilir) → kayıplar gerçek bedel + düşman ordusu kalıcı erir (takviye dengeler)
function storyKillCommander(cmd, st) {
    if (!cmd || cmd === STORY.commander || cmd.isPlayer) return false;
    const list = (st && st.gov && st.gov.commanders) || null;
    if (list) { const i = list.indexOf(cmd); if (i >= 0) list.splice(i, 1); }
    return true;
}
function storyResolveAIBattle(cmd, st, target) {
    const tgtSt = storyState(target.owner); if (!tgtSt) return;
    const atk = storyCalcCommanderPower(cmd, st), def = storyCalcDefenseStrength(target, tgtSt);
    const win = Math.max(0.25, Math.min(0.90, atk / (atk + def * 1.15)));
    if (cmd.res) cmd.res.manpower = Math.max(0, cmd.res.manpower - 30);   // savaş maliyeti (kasa erir → snowball freni)
    const hit = Math.random() < win;
    storyPushBattle(cmd, hit);
    if (hit) {
        target.owner = st.id; storyCityRename(target); cmd.node = target.id;              // node.owner tek-gerçek-kaynak + jeton senkron
        st.welfare = Math.min(100, st.welfare + 1); tgtSt.welfare = Math.max(0, tgtSt.welfare - 3);
        cmd.loyalty = Math.min(100, (cmd.loyalty == null ? 60 : cmd.loyalty) + 3);
        for (const dc of ((tgtSt.gov ? tgtSt.gov.commanders : []).slice())) if (dc.node === target.id) {   // savunan komutan: ÖLÜR ya da kaçar
            if (Math.random() < CMD_DEATH_ON_LOSS) { storyKillCommander(dc, tgtSt); if (Math.random() < 0.5) storyLog(`☠️ ${dc.name} (${tgtSt.name}), ${target.name} savunmasında düştü.`); }
            else { const safe = target.neighbors.filter(n => { const sn = storyNode(n); return sn && sn.owner === tgtSt.id; }); if (safe.length) dc.node = safe[Math.floor(Math.random() * safe.length)]; dc.loyalty = Math.max(20, (dc.loyalty == null ? 60 : dc.loyalty) - 8); }
        }
        if (Math.random() < 0.5) storyLog(`⚔️ ${cmd.name} (${st.name}) <b>${target.name}</b>'i fethetti.`);
        storySave();
    } else {                                                     // SALDIRAN YENİLDİ → ÖLÜR ya da yaralı çekilir
        if (Math.random() < CMD_DEATH_ON_LOSS) { storyKillCommander(cmd, st); if (Math.random() < 0.5) storyLog(`☠️ ${cmd.name} (${st.name}), ${target.name} önünde bozguna uğrayıp düştü.`); }
        else { const safe = target.neighbors.filter(n => { const sn = storyNode(n); return sn && sn.owner === st.id; }); if (safe.length) cmd.node = safe[Math.floor(Math.random() * safe.length)]; cmd.loyalty = Math.max(0, (cmd.loyalty == null ? 60 : cmd.loyalty) - 5); }
        st.welfare = Math.max(0, st.welfare - 1);
    }
}
// AI komutan OYUNCUYA saldırır → SAVUNMA düellosu (tek kapı + 90s throttle, spam önleme)
function storyTriggerPlayerDefense(cmd, st, pNode, force) {
    if (!pNode || pNode.owner !== STORY.playerStateId) return;   // SADECE oyuncunun şehrine saldırı → düello
    if (STORY.battleCtx) return;
    if (!force && STORY.clock - (STORY._lastPlayerInvasion || 0) < 90) return;   // kuşatma olgunlaşması (force) throttle'ı atlar
    STORY._lastPlayerInvasion = STORY.clock;
    storyLog(`🛡️ ${st.name} komutanı ${cmd.name}, ${pNode.name} bölgene saldırıyor!`);
    if (confirm(`🛡️ SAVUNMA!\n\n${cmd.name} (${st.name}) ${pNode.name} bölgene saldırıyor.\n\nTamam = SAVUN (düello)\nİptal = bölgeyi savaşmadan bırak`)) {
        storyLaunchDefense(pNode.id, st.id, cmd.node);
    } else {
        const me = storyPlayerState();
        const nb = pNode.neighbors.map(storyNode).find(x => x && x.owner === me.id);   // kaybedilen şehirden komşu dost şehre çekil
        const fb = STORY.nodes.find(n => n.owner === me.id);
        const safe = nb ? nb.id : (fb ? fb.id : pNode.id);
        if (STORY.commander.node === pNode.id) STORY.commander.node = safe;
        for (const c of (me.gov ? me.gov.commanders : [])) if (c.node === pNode.id) c.node = safe;   // takviye eden dost komutanlar da çekilir
        pNode.owner = st.id; storyCityRename(pNode); cmd.node = pNode.id; pNode._siege = null;
        me.reputation = Math.max(0, me.reputation - 1); me.welfare = Math.max(0, me.welfare - 4);
        storyLog(`🏳️ ${pNode.name} savaşmadan ${st.name}'e bırakıldı (-itibar, -refah).`);
        storySave();
    }
}
// ── KUŞATMA (şehir hemen düşmez; takviye penceresi açılır) ──────────────────
const SIEGE_TIME = 18;   // saniye: kuşatma olgunlaşması (savunan komutanların ZORUNLU YÜRÜYÜŞle yetişmesine yetecek süre)
// yakında (≤3 adım, kendi toprağı) KUŞATILAN dost şehir varsa: oraya doğru 1 adım (oradaysa kal=savun); yoksa -1
function storyReinforceStep(cmd, st) {
    const start = cmd.node, sNode = storyNode(start);
    if (sNode && sNode.owner === st.id && sNode._siege && sNode._siege.by !== st.id) return start;   // burası kuşatılıyor → savun
    const parent = {}; parent[start] = start; const dep = {}; dep[start] = 0; const q = [start]; let goal = null;
    while (q.length && goal == null) {
        const cur = q.shift(); if (dep[cur] >= 3) continue;
        const node = storyNode(cur); if (!node) continue;
        for (const nb of node.neighbors) {
            const nn = storyNode(nb); if (!nn || nn.owner !== st.id || (nb in parent)) continue;
            parent[nb] = cur; dep[nb] = dep[cur] + 1;
            if (nn._siege && nn._siege.by !== st.id) { goal = nb; break; }
            q.push(nb);
        }
    }
    if (goal == null) return -1;
    let step = goal; while (parent[step] !== start) step = parent[step];
    return step;
}
function storyBeginSiege(st, target) {
    if (target._siege) return;                                  // zaten kuşatma altında
    target._siege = { by: st.id, since: STORY.clock };
    storyLog(`🏰 ${st.name}, <b>${target.name}</b> (${(storyState(target.owner) || {}).name || '?'}) şehrini KUŞATMAYA aldı! — savunmaya koşun.`);
    storySave();
}
// olgunlaşan kuşatmaları çöz (storyAdvance her ~2.5sn çağırır)
function storySiegeTick() {
    if (STORY.battleCtx) return;
    for (const node of STORY.nodes) {
        if (!node._siege) continue;
        const byState = storyState(node._siege.by);
        const besiegers = byState ? storyStateCommanders(byState).filter(c => c.node === node.id || node.neighbors.indexOf(c.node) >= 0) : [];
        if (!byState || !besiegers.length || node.owner === node._siege.by) { node._siege = null; continue; }   // kuşatan kalmadı/şehir alındı → kalk
        if (STORY.clock - node._siege.since < SIEGE_TIME) continue;   // olgunlaşmadı (takviye penceresi)
        storyResolveSiege(node, byState, besiegers);
        if (STORY.battleCtx) return;
    }
}
function storyResolveSiege(node, byState, besiegers) {
    if (!node || !node.neighbors || !byState) { if (node) node._siege = null; return; }   // bozuk düğüm güvenliği
    const atk = besiegers.reduce((a, c) => a + storyCalcCommanderPower(c, byState), 0);
    const defState = storyState(node.owner);
    const def = storyCalcDefenseStrength(node, defState);
    let lead = besiegers[0], lp = storyCalcCommanderPower(besiegers[0], byState);
    for (const c of besiegers) { const pw = storyCalcCommanderPower(c, byState); if (pw > lp) { lp = pw; lead = c; } }
    for (const c of besiegers) if (c.res) c.res.manpower = Math.max(0, c.res.manpower - 25);   // kuşatma yıpratması
    if (atk <= def * 1.12) {                                     // SAVUNMA DAYANDI → kuşatma KIRILDI (savunan lehine kenar → takviye anlamlı, snowball freni)
        node._siege = null;
        for (const c of besiegers) { c.loyalty = Math.max(0, (c.loyalty == null ? 60 : c.loyalty) - 3); storyPushBattle(c, false); }
        storyLog(`🛡️ <b>${node.name}</b> kuşatması KIRILDI — ${(defState || {}).name || 'savunma'} püskürttü!`);
        storySave();
        return;
    }
    storyPushBattle(lead, true);
    const pid = STORY.playerStateId;
    // DÜELLO YALNIZCA SENİN JETONUN (STORY.commander) bu şehirde/yanındaysa olur; her şey aynı kural (tüm devletler soyut)
    const scAdj = STORY.commander && (STORY.commander.node === node.id || node.neighbors.indexOf(STORY.commander.node) >= 0);
    if (node.owner === pid && scAdj) {                          // SENİN şehrin + jetonun orada → SAVUNMA düellosu (birleşik)
        if (STORY.clock - (STORY._lastPlayerInvasion || 0) < 15) return;   // confirm spam önle (kuşatma bekler)
        node._siege = null;
        storyTriggerPlayerDefense(lead, byState, node, true);
    } else if (byState.id === pid && scAdj) {                   // SEN kuşatıyorsun + jetonun orada → ASALT düellosu (birleşik)
        node._siege = null;
        storyLaunchBattle(node.id);
    } else {                                                     // jetonun UZAKTA / AI-vs-AI → SOYUT (düello YOK, "üzerinde olmadığın şehir" teklifi gelmez)
        if (node.owner === pid) { defState.reputation = Math.max(0, defState.reputation - 1); storyLog(`💥 <b>${node.name}</b> savunmasız düştü — jetonun uzaktaydı.`); }
        storySiegeConquer(node, byState, lead, defState);
    }
}
function storySiegeConquer(node, byState, lead, defState) {
    node._siege = null;
    node.owner = byState.id; storyCityRename(node); lead.node = node.id;
    if (typeof storyCaptureNodePool === 'function') storyCaptureNodePool(node);   // kuşatma düşünce şehirdeki ordu da dağılır
    byState.welfare = Math.min(100, byState.welfare + 1); if (defState) defState.welfare = Math.max(0, defState.welfare - 3);
    lead.loyalty = Math.min(100, (lead.loyalty == null ? 60 : lead.loyalty) + 4);
    if (defState && defState.gov) for (const dc of defState.gov.commanders.slice()) if (dc.node === node.id) {   // savunan: ÖLÜR ya da kaçar
        if (Math.random() < CMD_DEATH_ON_LOSS) { storyKillCommander(dc, defState); }
        else { const safe = node.neighbors.filter(n => { const sn = storyNode(n); return sn && sn.owner === defState.id; }); if (safe.length) dc.node = safe[Math.floor(Math.random() * safe.length)]; dc.loyalty = Math.max(20, (dc.loyalty == null ? 60 : dc.loyalty) - 6); }
    }
    storyLog(`🏰 ${byState.name}, <b>${node.name}</b>'i kuşatmayla DÜŞÜRDÜ.`);
    storySave();
}
