// ═══════════════════════════════════════════════════════════════════════════
//  TEMİZ KOMUTAN — Kuvvet Ekonomisi + Manevra Doktrini  (FORGE-Core)
//  ----------------------------------------------------------------------------
//  Tek tutarlı zincir: gözlem(SİS-İÇİ, MATCHUP+ARAZİ-farkında) → makro PLAN
//  {mod + ROL-grupları, histerezi} → executor. Hilesiz (yalnız canSee).
//
//  v4 (Faz A — "ne topak ne dağınık, gerçek askeri operasyon"):
//   • ROL sistemi: ANA-ÇABA(MAIN) + SABİTLEME(PIN) + KANAT(FLANK) + YEDEK(RESERVE).
//     Bölme YALNIZ ATTACK/TERRITORY'de; RUSH/REGROUP'ta tek-kütle korunur (regresyon yok).
//   • ARAZİ-FARKINDA effHP: siper/orman düşmanı "zor öldürülür" → tehdidi yüksek →
//     AI siper-killbox'a frontal koşmaz, KANAT'tan zayıf yarıyı sarar.
//   • FLANK kırılgan-av: hızlı birimler düşman topçu/AT'ını yandan imha.
//   • RESERVE: MAIN erirse/temas olursa dökülür (asimetrik histerezi).
//  Öğrenilebilir genom (23 gen); self-play evirir. İnsan-gibi (histerezi+kişilik+jitter).
//  AI_BACKEND==='policy' (varsayılan) iken canlı RED'i bu komutan sürer.
// ═══════════════════════════════════════════════════════════════════════════

const ROLE = { MAIN: 0, PIN: 1, FLANK: 2, RESERVE: 3 };

// ── ÖĞRENİLEBİLİR PARAMETRELER ──
const DEFAULT_COMMANDER_GENES = {
    decisionMs:        1400,   // makro-karar histerezi
    commitK:           1.05,   // ATTACK eşiği: ownVal ≥ foeThreat×commitK
    regroupK:          0.75,   // REGROUP eşiği
    spread:            70,     // normal yumruk sıkılığı (Lanchester)
    schwerpunktK:      1.5,    // bölge seçimi: savunulan noktaya gitme cezası
    wNotOwned:         700, wEnemyOwned: 400, wDist: 0.15, nearR: 560,
    standoff:          0.85, artyRange: 240, focusR: 340,
    // all-arty fix
    artyThreatDiscount: 0.5, rushArtyK: 0.45, ambushK: 1.6, artySpread: 195,
    // FAZ A — manevra doktrini
    coverTrench:       0.60,   // effHP: siperdeki düşman tehdit çarpanı (+%60) → frontal-suicide önler
    coverForest:       0.35,   // effHP: ormandaki düşman
    reserveShare:      0.15,   // ordunun ne kadarı YEDEK tutulur
    flankDepth:        0.80,   // KANAT derinliği (×nearR)
    flankMinForce:     0.20,   // FLANK için min kuvvet payı (altındaysa flank iptal → parçalanma engeli)
    pinStandoff:       0.88,   // PIN sabitleyici geride-durma
    commitReserveK:    0.35    // MAIN bu oranda erirse YEDEK dökülür
};
const COMMANDER_GENE_LIMITS = {
    decisionMs: [600, 3000], commitK: [0.75, 2.0], regroupK: [0.3, 1.0], spread: [40, 160],
    schwerpunktK: [0.6, 3.0], wNotOwned: [200, 1500], wEnemyOwned: [0, 1000], wDist: [0, 0.5],
    nearR: [380, 900], standoff: [0.55, 0.95], artyRange: [180, 320], focusR: [180, 520],
    artyThreatDiscount: [0.3, 1.0], rushArtyK: [0.25, 0.7], ambushK: [1.2, 2.5], artySpread: [165, 320],
    coverTrench: [0.2, 1.0], coverForest: [0.1, 0.7], reserveShare: [0, 0.35], flankDepth: [0.4, 1.2],
    flankMinForce: [0, 0.5], pinStandoff: [0.6, 0.95], commitReserveK: [0.2, 0.6]
};
let commanderGenome = Object.assign({}, DEFAULT_COMMANDER_GENES);
// KALICILIK: eğitilmiş genom localStorage'da varsa yükle (reload'da kalır; yeni genler DEFAULT'tan tamamlanır)
try { const _sv = localStorage.getItem('cmdrGenome'); if (_sv) commanderGenome = Object.assign({}, DEFAULT_COMMANDER_GENES, JSON.parse(_sv)); } catch (_) {}

const TURTLE_COMMANDER_GENES = Object.assign({}, DEFAULT_COMMANDER_GENES, {
    commitK: 2.0, regroupK: 1.0, decisionMs: 2200, standoff: 0.92, rushArtyK: 0.6, flankDepth: 1.1, reserveShare: 0.25
});
const AGGRO_COMMANDER_GENES = Object.assign({}, DEFAULT_COMMANDER_GENES, {
    commitK: 0.80, regroupK: 0.45, decisionMs: 1000, spread: 100, rushArtyK: 0.35, flankMinForce: 0.10, reserveShare: 0.05
});

// ── İNSANLAŞTIRMA: kişilikler + stokastik karar ──
const COMMANDER_PERSONALITIES = {
    dengeli:  () => Object.assign({}, DEFAULT_COMMANDER_GENES),
    agresif:  () => Object.assign({}, DEFAULT_COMMANDER_GENES, { commitK: 0.85, regroupK: 0.50, decisionMs: 1100, spread: 95, standoff: 0.80, rushArtyK: 0.35, flankMinForce: 0.10 }),
    temkinli: () => Object.assign({}, DEFAULT_COMMANDER_GENES, { commitK: 1.40, regroupK: 0.95, decisionMs: 1900, standoff: 0.92, schwerpunktK: 2.0, flankDepth: 1.1 })
};
function commanderSetPersonality(name) {
    const make = COMMANDER_PERSONALITIES[name] || COMMANDER_PERSONALITIES.dengeli;
    commanderGenome = make();
    console.log(`Komutan kişiliği: ${COMMANDER_PERSONALITIES[name] ? name : 'dengeli'}`);
    return name;
}
const COMMANDER_DECISION_JITTER = 0.12;

// ── RUNTIME STATE ──
const COMMANDER = {
    plan:         { red: null, blue: null, ally: null },
    lastDecision: { red: -1e9, blue: -1e9, ally: -1e9 },
    rushStartFoe: { red: null, blue: null, ally: null },
    mainRefVal:   { red: 0, blue: 0, ally: 0 },        // ATTACK girişinde MAIN değeri (yedek-tetik)
    reserveDumped:{ red: false, blue: false, ally: false }, // yedek döküldü mü
    advisor: null   // ADIM 4: Foresight danışmanı (taraf başına instance; commanderReset'te oluşur)
};
function commanderReset() {
    for (const k of ['red', 'blue', 'ally']) {
        COMMANDER.plan[k] = null; COMMANDER.lastDecision[k] = -1e9;
        COMMANDER.rushStartFoe[k] = null; COMMANDER.mainRefVal[k] = 0; COMMANDER.reserveDumped[k] = false;
    }
    // ADIM 4: FORESIGHT danışmanları (taraf başına 1; histerez için kalıcı, savaş başında taze)
    COMMANDER.advisor = (typeof LookaheadAdvisor !== 'undefined')
        ? { red: new LookaheadAdvisor(true), blue: new LookaheadAdvisor(false), ally: new LookaheadAdvisor(false) }
        : null;
}

function cmdrValue(u) { return STATS[u.type].cost * (u.hp / Math.max(1, u.maxHp)); }
function cmdrDist2(a, bx, by) { const dx = a.x - bx, dy = a.y - by; return dx * dx + dy * dy; }
function cmdrClamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function cmdrFragileRanged(u) { return STATS[u.type].range > 300 && u.maxHp < 160; }

// Tehdit-değeri: ARAZİ (siper/orman → yüksek) + korumasız-topçu (düşük). Hilesiz (canSee'den okunur).
function cmdrThreatValue(u, foes, G) {
    let v = cmdrValue(u);
    const cover = (u.inTrench ? G.coverTrench : 0) + (u.inForest ? G.coverForest : 0);
    if (cover > 0) v *= (1 + cover);                 // siper/orman düşmanı = zor av → frontal commit etme
    if (cmdrFragileRanged(u)) {
        let guarded = false;
        for (const e of foes) { if (e === u || cmdrFragileRanged(e)) continue; if (cmdrDist2(e, u.x, u.y) < 150 * 150) { guarded = true; break; } }
        if (!guarded) v *= G.artyThreatDiscount;     // açık topçu = kolay av
    }
    return v;
}

// ── ANA SÜRÜCÜ ──
function commanderDrive(side, now) {
    const G = commanderGenome, key = side ? 'red' : 'blue';
    const own = [], foes = [];
    for (const u of SIM.units) {
        if (u.dead) continue;
        if (u.isRed === side) own.push(u);
        else if (canSee(side, u.x, u.y)) foes.push(u);
    }
    if (!own.length) return;

    if (now - COMMANDER.lastDecision[key] >= G.decisionMs || COMMANDER.plan[key] == null) {
        COMMANDER.lastDecision[key] = now;
        let ownVal = 0, oCx = 0, oCy = 0;
        for (const u of own) { const v = cmdrValue(u); ownVal += v; oCx += u.x * v; oCy += u.y * v; }
        oCx /= (ownVal || 1); oCy /= (ownVal || 1);
        let foeThreat = 0, fCx = 0, fCy = 0, foeRaw = 0, foeArtyRaw = 0, aCx = 0, aCy = 0, foeHasArty = false;
        for (const e of foes) {
            const tv = cmdrThreatValue(e, foes, G); foeThreat += tv; fCx += e.x * tv; fCy += e.y * tv;
            const rv = cmdrValue(e); foeRaw += rv;
            if (cmdrFragileRanged(e)) { foeHasArty = true; foeArtyRaw += rv; aCx += e.x * rv; aCy += e.y * rv; }
        }
        if (foeThreat > 0) { fCx /= foeThreat; fCy /= foeThreat; }
        if (foeArtyRaw > 0) { aCx /= foeArtyRaw; aCy /= foeArtyRaw; }
        const foeArtyShare = foeRaw > 0 ? foeArtyRaw / foeRaw : 0;

        // ADIM 4: FORESIGHT danışmanı (TEK danışman → cmdrDecide'a GİRDİ; gerçekçi Lanchester intihar-charge'ı önler + Schwerpunkt yoğunlaştırır)
        let adv = null;
        if (COMMANDER.advisor && COMMANDER.advisor[key] && foes.length) {
            const enemyStatic = foes.some(e => e.inTrench || e.inForest);   // kazılı/ormanlı düşman = charge pahalı
            adv = COMMANDER.advisor[key].decide(own, foes, null, now, enemyStatic);
        }
        const plan = cmdrDecide(side, key, foes, ownVal, foeThreat, foeArtyShare, oCx, oCy, fCx, fCy, aCx, aCy, foeHasArty, G, adv);
        plan.foeHasArty = foeHasArty;

        // YEDEK tetiği: ATTACK girişinde MAIN-referansı; eridiyse veya temas → dök
        if (plan.mode === 'ATTACK') {
            if (COMMANDER.mainRefVal[key] <= 0) COMMANDER.mainRefVal[key] = ownVal;
            if (ownVal < COMMANDER.mainRefVal[key] * (1 - G.commitReserveK)) COMMANDER.reserveDumped[key] = true;
        } else { COMMANDER.mainRefVal[key] = 0; COMMANDER.reserveDumped[key] = false; }

        cmdrAssignRoles(side, key, own, foes, plan, ownVal, oCx, oCy, fCx, fCy, G);
        let _kt = null, _ktS = -Infinity;   // ADIM 6: KOORDİNELİ ODAK ATEŞ — en "sulu" düşman (kırılgan yüksek-değer: topçu/AT) kill-target
        for (const e of foes) { const s = cmdrValue(e) / Math.max(40, e.hp) * (cmdrFragileRanged(e) ? 2.2 : 1); if (s > _ktS) { _ktS = s; _kt = e; } }
        plan.killTarget = _kt;
        COMMANDER.plan[key] = plan;
    }
    const plan = COMMANDER.plan[key];
    plan._focusUsed = 0; plan._focusCap = (plan.killTarget && !plan.killTarget.dead) ? Math.max(2, Math.ceil((plan.killTarget.hp || 100) / 70)) : 0;   // ADIM 6: hedefi öldürecek kadar nişancı (overkill yok)
    for (const u of own) cmdrOrderUnit(u, side, plan, foes, G);
}

// ── MÜTTEFİK SÜRÜCÜ (OTONOM DOST-AI) — commanderDrive'ın İZOLE kopyası; own=yalnız u.ally, foes=KIRMIZI.
//    key='ally' (red state'e dokunmaz), side=false (mavi geometri: güney üs, kuzeye taarruz). Kırmızı AI birebir kullanılır.
function commanderDriveAlly(now) {
    const G = commanderGenome, key = 'ally', side = false;
    const own = [], foes = [];
    for (const u of SIM.units) {
        if (u.dead) continue;
        if (u.ally) own.push(u);                                  // TEK FARK: oyuncu birimleri değil, yalnız MÜTTEFİK
        else if (u.isRed && canSee(side, u.x, u.y)) foes.push(u); // düşman = KIRMIZI (mavi görüşü)
    }
    if (!own.length) return;

    if (now - COMMANDER.lastDecision[key] >= G.decisionMs || COMMANDER.plan[key] == null) {
        COMMANDER.lastDecision[key] = now;
        let ownVal = 0, oCx = 0, oCy = 0;
        for (const u of own) { const v = cmdrValue(u); ownVal += v; oCx += u.x * v; oCy += u.y * v; }
        oCx /= (ownVal || 1); oCy /= (ownVal || 1);
        let foeThreat = 0, fCx = 0, fCy = 0, foeRaw = 0, foeArtyRaw = 0, aCx = 0, aCy = 0, foeHasArty = false;
        for (const e of foes) {
            const tv = cmdrThreatValue(e, foes, G); foeThreat += tv; fCx += e.x * tv; fCy += e.y * tv;
            const rv = cmdrValue(e); foeRaw += rv;
            if (cmdrFragileRanged(e)) { foeHasArty = true; foeArtyRaw += rv; aCx += e.x * rv; aCy += e.y * rv; }
        }
        if (foeThreat > 0) { fCx /= foeThreat; fCy /= foeThreat; }
        if (foeArtyRaw > 0) { aCx /= foeArtyRaw; aCy /= foeArtyRaw; }
        const foeArtyShare = foeRaw > 0 ? foeArtyRaw / foeRaw : 0;

        // ADIM 4: FORESIGHT danışmanı (TEK danışman → cmdrDecide'a GİRDİ; gerçekçi Lanchester intihar-charge'ı önler + Schwerpunkt yoğunlaştırır)
        let adv = null;
        if (COMMANDER.advisor && COMMANDER.advisor[key] && foes.length) {
            const enemyStatic = foes.some(e => e.inTrench || e.inForest);   // kazılı/ormanlı düşman = charge pahalı
            adv = COMMANDER.advisor[key].decide(own, foes, null, now, enemyStatic);
        }
        const plan = cmdrDecide(side, key, foes, ownVal, foeThreat, foeArtyShare, oCx, oCy, fCx, fCy, aCx, aCy, foeHasArty, G, adv);
        plan.foeHasArty = foeHasArty;

        if (plan.mode === 'ATTACK') {
            if (COMMANDER.mainRefVal[key] <= 0) COMMANDER.mainRefVal[key] = ownVal;
            if (ownVal < COMMANDER.mainRefVal[key] * (1 - G.commitReserveK)) COMMANDER.reserveDumped[key] = true;
        } else { COMMANDER.mainRefVal[key] = 0; COMMANDER.reserveDumped[key] = false; }

        cmdrAssignRoles(side, key, own, foes, plan, ownVal, oCx, oCy, fCx, fCy, G);
        let _kt = null, _ktS = -Infinity;   // ADIM 6: KOORDİNELİ ODAK ATEŞ — en "sulu" düşman (kırılgan yüksek-değer: topçu/AT) kill-target
        for (const e of foes) { const s = cmdrValue(e) / Math.max(40, e.hp) * (cmdrFragileRanged(e) ? 2.2 : 1); if (s > _ktS) { _ktS = s; _kt = e; } }
        plan.killTarget = _kt;
        COMMANDER.plan[key] = plan;
    }
    const plan = COMMANDER.plan[key];
    plan._focusUsed = 0; plan._focusCap = (plan.killTarget && !plan.killTarget.dead) ? Math.max(2, Math.ceil((plan.killTarget.hp || 100) / 70)) : 0;   // ADIM 6: hedefi öldürecek kadar nişancı (overkill yok)
    for (const u of own) cmdrOrderUnit(u, side, plan, foes, G);
}

// Makro karar: RUSH > ATTACK > REGROUP > TERRITORY (matchup-farkında, histerezi+jitter)
function cmdrDecide(side, key, foes, ownVal, foeThreat, foeArtyShare, oCx, oCy, fCx, fCy, aCx, aCy, foeHasArty, G, adv) {
    const jit = 1 + (srand() - 0.5) * COMMANDER_DECISION_JITTER;
    // ADIM 4: FORESIGHT WITHDRAW override — danışmanın gerçekçi Lanchester'ı "en iyi saldırı bile ağır aleyhte" diyorsa, kaba kuvvet-oranı ne derse desin ÇEKİL (intihar-charge önle)
    if (adv && adv.posture === 'WITHDRAW') { COMMANDER.rushStartFoe[key] = null; return cmdrRegroupPlan(side, foes, oCx, oCy, fCx, fCy); }
    // SCHWERPUNKT: danışman bir hedef kümesi önerdiyse ATTACK odağını oraya kaydır (kuvvet yoğunlaştırma — parça-parça imha)
    const sx = (adv && adv.target) ? adv.target.x : fCx, sy = (adv && adv.target) ? adv.target.y : fCy;
    if (foes.length && foeArtyShare >= G.rushArtyK && ownVal >= foeThreat * 0.6 * jit) {
        if (COMMANDER.rushStartFoe[key] == null) COMMANDER.rushStartFoe[key] = foeThreat;
        if (foeThreat > COMMANDER.rushStartFoe[key] * G.ambushK) { COMMANDER.rushStartFoe[key] = null; return cmdrRegroupPlan(side, foes, oCx, oCy, fCx, fCy); }
        return { x: aCx || fCx, y: aCy || fCy, mode: 'RUSH' };
    }
    COMMANDER.rushStartFoe[key] = null;
    // ADIM 5: SCHMITT HİSTEREZİ — kesin üstün→ATTACK, kesin zayıf→REGROUP, ARADAKİ BANT→ÖNCEKİ MODU KORU (postür titremez, AI kararlı durur)
    if (foes.length) {
        if (ownVal >= foeThreat * G.commitK * jit) return { x: sx, y: sy, mode: 'ATTACK' };
        if (ownVal < foeThreat * G.regroupK * jit) return cmdrRegroupPlan(side, foes, oCx, oCy, fCx, fCy);
        const prevMode = COMMANDER.plan[key] && COMMANDER.plan[key].mode;   // bant içi yapışkan (flip-flop önle)
        if (prevMode === 'ATTACK' || prevMode === 'RUSH') return { x: sx, y: sy, mode: 'ATTACK' };
        if (prevMode === 'REGROUP') return cmdrRegroupPlan(side, foes, oCx, oCy, fCx, fCy);
    }
    const bestPt = cmdrBestPoint(side, foes, oCx, oCy, G);
    if (bestPt) return { x: bestPt.x, y: bestPt.y, mode: 'TERRITORY' };
    if (foes.length) return { x: sx, y: sy, mode: 'ATTACK' };
    return { x: WORLD_W / 2, y: WORLD_H / 2, mode: 'TERRITORY' };
}

// ROL ATAMA + grup-hedefleri. Bölme yalnız ATTACK/TERRITORY; RUSH/REGROUP'ta tek-kütle (korunur).
function cmdrAssignRoles(side, key, own, foes, plan, ownVal, oCx, oCy, fCx, fCy, G) {
    const single = { x: plan.x, y: plan.y };
    plan.groups = { 0: single, 1: single, 2: single, 3: single };
    if (plan.mode === 'RUSH' || plan.mode === 'REGROUP' || !foes.length) {
        for (const u of own) u.cmdrRole = ROLE.MAIN;     // tek-kütle (over-engineer kalkanı)
        return;
    }
    // eksenler: axis düşmana doğru, perp dik
    let ax = fCx - oCx, ay = fCy - oCy, aL = Math.hypot(ax, ay) || 1; ax /= aL; ay /= aL;
    const px = -ay, py = ax;
    // KANAT: düşman topağının dik-eksende ZAYIF yarısı
    let L = 0, R = 0;
    for (const e of foes) { const s = (e.x - fCx) * px + (e.y - fCy) * py; if (s < 0) L += cmdrValue(e); else R += cmdrValue(e); }
    const sgn = (L < R) ? -1 : 1;
    plan.groups[ROLE.MAIN]    = { x: fCx, y: fCy };
    plan.groups[ROLE.PIN]     = { x: fCx - ax * (G.nearR * (1 - G.pinStandoff)), y: fCy - ay * (G.nearR * (1 - G.pinStandoff)) };
    plan.groups[ROLE.FLANK]   = { x: fCx + px * sgn * G.flankDepth * G.nearR, y: fCy + py * sgn * G.flankDepth * G.nearR };
    plan.groups[ROLE.RESERVE] = { x: oCx - ax * 260, y: oCy - ay * 260 };

    const dumped = COMMANDER.reserveDumped[key];
    let flankVal = 0;
    for (const u of own) {
        const r = STATS[u.type].range, sp = STATS[u.type].speed;
        if (u.type === T.ARTILLERY || u.type === T.ANTI_TANK || r > G.artyRange) u.cmdrRole = ROLE.PIN;   // sabitleyici
        else if (sp >= 0.85 && plan.mode === 'ATTACK') { u.cmdrRole = ROLE.FLANK; flankVal += cmdrValue(u); }   // hızlı → kanat
        else u.cmdrRole = ROLE.MAIN;
    }
    // YEDEK ayır (dökülmediyse): MAIN'den en sağlıklıları reserveShare×ownVal'e kadar
    if (!dumped && G.reserveShare > 0) {
        const target = G.reserveShare * ownVal;
        const mains = own.filter(u => u.cmdrRole === ROLE.MAIN).sort((a, b) => (b.hp / b.maxHp) - (a.hp / a.maxHp));
        let rv = 0;
        for (const u of mains) { if (rv >= target) break; u.cmdrRole = ROLE.RESERVE; rv += cmdrValue(u); }
    }
    // KORUMA: yetersiz kanat → boşalt (parçalanma engeli)
    if (flankVal < G.flankMinForce * ownVal) for (const u of own) if (u.cmdrRole === ROLE.FLANK) u.cmdrRole = ROLE.MAIN;
}

function cmdrRegroupPlan(side, foes, oCx, oCy, fCx, fCy) {
    let maxR = 200;
    for (const e of foes) { const r = STATS[e.type].range; if (r > maxR) maxR = r; }
    let ux = oCx - fCx, uy = oCy - fCy, L = Math.hypot(ux, uy) || 1; ux /= L; uy /= L;
    const x = cmdrClamp(fCx + ux * (maxR + 220), UNIT_RADIUS, WORLD_W - UNIT_RADIUS);
    const yHome = side ? WORLD_H * 0.30 : WORLD_H * 0.70;
    const y = side ? Math.min(fCy + uy * (maxR + 220), yHome) : Math.max(fCy + uy * (maxR + 220), yHome);
    return { x, y: cmdrClamp(y, UNIT_RADIUS, WORLD_H - UNIT_RADIUS), mode: 'REGROUP' };
}

function cmdrBestPoint(side, foes, oCx, oCy, G) {
    const pts = SIM.controlPoints; if (!pts || !pts.length) return null;
    const mySide = side ? 'red' : 'blue', nearR2 = G.nearR * G.nearR;
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i]; if (p.owner === mySide) continue;
        let enNear = 0;
        for (const e of foes) if (cmdrDist2(e, p.x, p.y) < nearR2) enNear += cmdrValue(e);
        const s = G.wNotOwned + (p.owner ? G.wEnemyOwned : 0) - enNear * G.schwerpunktK - Math.hypot(oCx - p.x, oCy - p.y) * G.wDist;
        if (s > bestScore) { bestScore = s; best = p; }
    }
    return best;
}

// Tek birim emri: RECON-gözcü · RUSH · kendi-topçu standoff · ROL'e göre (MAIN/PIN/FLANK/RESERVE)
function cmdrOrderUnit(u, side, plan, foes, G) {
    const range = STATS[u.type].range, vision = STATS[u.type].vision;
    const isArty = range > G.artyRange, focusR2 = G.focusR * G.focusR;
    const role = u.cmdrRole || ROLE.MAIN;
    const gt = (plan.groups && plan.groups[role]) || { x: plan.x, y: plan.y };
    // ADIM 1+3 — TEK NİYET KANALI: makro niyet + ROL-tutarlı kite mesafesi. engageCombat İCRACI bunu okur (rol-taksonomi kopukluğu da biter: PIN/topçu geniş standoff, FLANK orta, MAIN yakın).
    let _pref = 0.62;   // MAIN: yakın angajman
    if (role === ROLE.PIN) _pref = 0.92; else if (role === ROLE.FLANK) _pref = 0.72; else if (role === ROLE.RESERVE) _pref = 0.85;
    // T3 TEMPO/C2: posture (büyük karar) komut-gecikmesiyle yerleşir — C2-bağlı(lider yakın) hızlı, izole yavaş (OODA sürtünmesi)
    const _desiredPosture = plan.mode === 'REGROUP' ? 'DISENGAGE' : (plan.mode === 'TERRITORY' ? 'HOLD' : 'ATTACK');
    if (!u.intent) u.intent = { posture: _desiredPosture, preferredRange: _pref };
    u.intent.preferredRange = _pref;          // menzil-tercihi hemen güncellenir (yalnız posture gecikir)
    u.intent.focusTarget = null;              // her döngü sıfırla (aşağıda yeniden atanabilir)
    if (_desiredPosture === u.intent.posture) {
        u._pendConfirm = 0; u._pendPosture = null;
    } else {
        if (u._pendPosture === _desiredPosture) u._pendConfirm = (u._pendConfirm || 0) + 1;
        else { u._pendPosture = _desiredPosture; u._pendConfirm = 1; }
        const _need = u.leaderNearby ? 1 : 3;  // C2-bağlı: 1 komutan-döngüsü; izole: 3 döngü gecikme
        if (u._pendConfirm >= _need) { u.intent.posture = _desiredPosture; u._pendConfirm = 0; u._pendPosture = null; }
    }
    u.c2Linked = !!u.leaderNearby;            // T3 NN girdisi: komuta-zincirine bağlı mıyım
    // ADIM 6: bu birim öncelikli kill-target'a YOĞUNLAŞSIN mı? (menzile yakın + cap dolmadı + çekilmiyor) → koordineli odak ateş
    if (plan.killTarget && !plan.killTarget.dead && (plan._focusUsed || 0) < (plan._focusCap || 0) && u.intent.posture !== 'DISENGAGE'
        && cmdrDist2(u, plan.killTarget.x, plan.killTarget.y) < (range * 1.3) * (range * 1.3)) {
        u.intent.focusTarget = plan.killTarget; plan._focusUsed = (plan._focusUsed || 0) + 1;
    }

    let nf = null, nfd2 = Infinity, na = null, nad2 = Infinity;
    for (const e of foes) {
        const d2 = cmdrDist2(u, e.x, e.y);
        if (d2 < nfd2) { nfd2 = d2; nf = e; }
        if (cmdrFragileRanged(e) && d2 < nad2) { nad2 = d2; na = e; }
    }

    // GÖZCÜ (RECON): öne atılmaz, görüş sağlar (rolden bağımsız)
    if (vision > 600 && range < 200) {
        u.aiAction = 'ATTACK';
        u.attackTarget = (nf && nfd2 < 160 * 160) ? nf : null;
        const back = side ? -130 : 130;
        cmdrMove(u, plan.x + ((u.id * 71) % 200 - 100), plan.y + back);
        return;
    }

    // RUSH: topçunun üstüne koş (tek-kütle; roller boş)
    if (plan.mode === 'RUSH' && !isArty) {
        const tgt = na || nf;
        u.cmdrCommit = true; u.aiAction = 'ATTACK'; u.attackTarget = tgt || null;
        cmdrMove(u, tgt ? tgt.x : plan.x, tgt ? tgt.y : plan.y);
        return;
    }
    u.cmdrCommit = false;

    // KENDİ TOPÇU/AT (genelde PIN): effRange standoff, hedef = gt (PIN sabitleme noktası)
    if (isArty && nf) {
        const eff = Math.min(range, vision), d = Math.sqrt(nfd2), standoff = eff * G.standoff;
        u.aiAction = 'ATTACK'; u.attackTarget = nf;
        if (d < standoff * 0.7) { const ux = (u.x - nf.x) / (d || 1), uy = (u.y - nf.y) / (d || 1); cmdrMove(u, u.x + ux * 150, u.y + uy * 150); }
        else if (d > eff) cmdrMove(u, gt.x, gt.y);
        return;
    }

    // YEDEK: gt'de bekle, yalnız dibindekine saldır
    if (role === ROLE.RESERVE) {
        u.aiAction = 'ATTACK'; u.attackTarget = (nf && nfd2 < 180 * 180) ? nf : null;
        cmdrMove(u, gt.x + ((u.id * 53) % 120 - 60), gt.y + ((u.id * 97) % 120 - 60));
        return;
    }

    // KANAT: zayıf yarıya yönel, KIRILGAN düşmanı (topçu/AT) yandan avla
    if (role === ROLE.FLANK) {
        u.aiAction = 'ATTACK';
        u.attackTarget = na || ((nf && nfd2 < focusR2) ? nf : null);
        cmdrMove(u, gt.x + ((u.id * 53) % 100 - 50), gt.y + ((u.id * 97) % 100 - 50));
        return;
    }

    // ANA-ÇABA (MAIN): gt'ye yığıl + odak ateş; foeHasArty iken splash-kaçınan halka
    u.aiAction = 'ATTACK';
    u.attackTarget = (nf && nfd2 < focusR2) ? nf : null;
    const eff = plan.foeHasArty ? Math.max(G.spread, G.artySpread) : G.spread;
    const ang = u.id * 2.39996;
    cmdrMove(u, gt.x + Math.cos(ang) * eff, gt.y + Math.sin(ang) * eff);
}

function cmdrMove(u, x, y) {
    u.targetX = cmdrClamp(x, UNIT_RADIUS, WORLD_W - UNIT_RADIUS);
    u.targetY = cmdrClamp(y, UNIT_RADIUS, WORLD_H - UNIT_RADIUS);
    u.manualTarget = null; u.manualMoveTarget = null; u.isMovingToManualTarget = false;
}
