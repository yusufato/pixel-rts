// ═══════════════════════════════════════════════════════════════
//  FAZ 2b — TAKTİK BLACKBOARD (paylaşımlı savaş panosu)
//  Kontrolör başına, her karar-tikinde perception'dan (yalnız görülen/hatırlanan düşman — HİLE YOK) kurulur.
//  Salt-veri (replayClone-güvenli): sonraki fazlar OKUR, karar üretmez (Faz 2 davranış-nötr).
//  Düşman-tahmin (uzay-zaman), tehdit/sektör haritası, objektif/çekilme hattı, engel geometrisi, kuşatma iskeleti.
// ═══════════════════════════════════════════════════════════════

let BATTLE_BLACKBOARD = true;   // A/B bayrağı: blackboard'ı kur (Faz 3+ okur). Kapatınca controller.blackboard=null.
let BATTLE_ANTI_ENVELOP = true; // A/B bayrağı: kuşatma tespiti → çekilme/toparlanma tepkisi (Faz 3).
let BATTLE_UNIT_MICRO = true;   // A/B bayrağı: birim mikrosu (menzile-yaklaş vb., Faz 5). Kapatınca eski hedef-üstüne-koş.
let BATTLE_ENDGAME_LOCK = true; // A/B bayrağı: anti-flip spazm + son-30sn plan-kilidi (Faz 6).
let BATTLE_POSTURE_GATE = true; // A/B bayrağı: taarruz-kapısı (SHAPE→STRIKE). Kapatınca eski role-only stand-off + koşulsuz self-close.

// Tip sınıf-DPS ağırlığı (tehdit haritası için): topçu/tanksavar/tank yüksek tehdit.
function bbThreatWeight(type) {
    if (typeof T === 'undefined') return 1;
    if (type === T.ARTILLERY) return 2.4;
    if (type === T.ANTI_TANK) return 2.0;
    if (type === T.ARMOR) return 1.8;
    if (type === T.MECH_INFANTRY || type === T.ARMOR_INFANTRY) return 1.2;
    return 1;
}

// FAZ 3a — KUŞATMA TESPİTİ: düşman kütlesinin öz-merkez etrafındaki açısal dağılımı + arka-tehdit + yem imzası.
// Yalnız perception (görülen+hatırlanan) → hile yok. Sonuç bb.envelopment'a yazılır; Faz 3b tepki üretir.
function bbDetectEnvelopment(bb, own, situation) {
    const env = { risk: 0, openFlank: null, encirclingClusters: [], recommendedResponse: null, rearThreat: false, baited: false };
    const enemies = bb.enemies || [];
    if (!enemies.length || !own.length) { bb.envelopment = env; return; }
    const isAtt = situation && situation.role === (typeof BATTLE_ROLE !== 'undefined' ? BATTLE_ROLE.ATTACKER : 'attacker');
    const c = bb.ownCentroid;
    // SAVUNAN KUŞATMA (gerçek maç verisi: savunma maçlarında %36-60 sarılma, tepki YOKtu — kuşatma-riski hep 0'dı).
    // Savunanın ilerleme-ekseni EVE bakar → "arka" bozulur. Düzeltme: DÜŞMAN-MERKEZİ eksenini kullan (red→düşman="ileri").
    // Gerçek kıskaç = düşman ARKAYA sızmış (along<0) VE en az bir yanda. Yalnız geniş-cephe baskısı ≠ kuşatma
    // (battleMatchMetrics'in %36-60 sarılmayı DOĞRU yakalayan çıpalarıyla aynı: along<-80, |side|>120, arka VE yan).
    if (!isAtt) {
        let ecx = 0, ecy = 0; for (const e of enemies) { ecx += e.x; ecy += e.y; } ecx /= enemies.length; ecy /= enemies.length;
        if (bb.enemyCoG) { ecx = bb.enemyCoG.x; ecy = bb.enemyCoG.y; }
        const dax = ecx - c.x, day = ecy - c.y, dl = Math.hypot(dax, day) || 1, fux = dax / dl, fuy = day / dl, fpx = -fuy, fpy = fux;
        let rear = 0, left = 0, right = 0, total = 0;
        for (const e of enemies) { const dx = e.x - c.x, dy = e.y - c.y; const along = dx * fux + dy * fuy, side = dx * fpx + dy * fpy; const w = e.estimatedStrength || 1; total += w; if (along < -80) rear += w; if (side < -120) left += w; else if (side > 120) right += w; }
        if (total <= 0) { bb.envelopment = env; return; }
        const rearFrac = rear / total, lf = left / total, rf = right / total;
        env.rearThreat = rear > 0;
        let risk = 0;
        if (rear > 0 && (left > 0 || right > 0)) risk = 0.45 + Math.min(0.3, rearFrac * 1.5) + ((lf > 0.1 && rf > 0.1) ? 0.2 : 0.05);   // arka+yan gerçek kıskaç
        else if (rearFrac > 0.15) risk = 0.3 + Math.min(0.2, rearFrac);                                                              // arkaya ciddi sızma
        env.risk = Math.max(0, Math.min(1, risk));
        env.openFlank = (lf > rf && lf > 0.1) ? 'left' : (rf > 0.1 ? 'right' : null);
        if (env.risk >= 0.5) {
            const ownVal = own.reduce((s, u) => s + ((typeof STATS !== 'undefined' && STATS[u.type] ? STATS[u.type].cost : 50) * (u.hpRatio != null ? u.hpRatio : 1)), 0);
            let acceptable = true;
            if (typeof stExpectedLoss === 'function') { const el = stExpectedLoss(ownVal, total, 10); acceptable = el.exchangeRatio >= 0.75; }
            // SAVUNAN tepkisi: hattı TOPLA (REGROUP=yanları objektife çek → 859px geniş cepheyi daralt). Ezici ise screen+çekil.
            env.recommendedResponse = acceptable ? 'CONSOLIDATE' : 'SCREEN_AND_WITHDRAW';
        }
        bb.envelopment = env;
        return;
    }
    const ux = bb.advanceAxis.x, uy = bb.advanceAxis.y, px = -uy, py = ux;
    // düşman kütlesini FRONT/LEFT/RIGHT/REAR bin'lerine böl (estimatedStrength ağırlıklı)
    let front = 0, left = 0, right = 0, rear = 0, total = 0;
    let leftMinTTA = Infinity, rightMinTTA = Infinity;
    for (const e of enemies) {
        const dx = e.x - c.x, dy = e.y - c.y;
        const along = dx * ux + dy * uy, side = dx * px + dy * py;
        const w = e.estimatedStrength || 1; total += w;
        // DEBRIEF (feint'e kanma): kanat/arka tehdidini KOMMİTMENT'le ölç — öz-merkeze YAKLAŞAN gerçek tehdit,
        // duran/uzaklaşan sadece FEINT (varlığıyla korkutur ama saldırmaz). Cephe tam sayılır; yan/arka commit'li.
        const dl = Math.hypot(dx, dy) || 1;
        const approach = -((e.vx || 0) * dx + (e.vy || 0) * dy) / dl;   // +: merkeze yaklaşıyor (px/tik)
        const commit = Math.max(0.3, Math.min(1, 0.55 + approach * 6));
        if (along < -100) rear += w * commit;
        else if (side < -140) { left += w * commit; const tta = (typeof stTimeToArrive === 'function') ? stTimeToArrive(e, c) : Math.hypot(dx, dy) / 200; if (tta < leftMinTTA) leftMinTTA = tta; }
        else if (side > 140) { right += w * commit; const tta = (typeof stTimeToArrive === 'function') ? stTimeToArrive(e, c) : Math.hypot(dx, dy) / 200; if (tta < rightMinTTA) rightMinTTA = tta; }
        else front += w;
    }
    if (total <= 0) { bb.envelopment = env; return; }
    const rearFrac = rear / total, leftFrac = left / total, rightFrac = right / total;
    const offFront = (rear + left + right) / total;
    // RİSK: cephe-dışı kütle + arka-tehdit + iki-yan kıskaç. 0..1.
    env.rearThreat = rear > 0;
    let risk = offFront * 0.5;
    if (rearFrac > 0.12) risk += 0.3;                         // düşman arkaya sızmış
    if (leftFrac > 0.12 && rightFrac > 0.12) risk += 0.3;     // iki yandan kıskaç
    env.risk = Math.max(0, Math.min(1, risk));
    env.openFlank = (leftFrac > rightFrac && leftFrac > 0.1) ? 'left' : (rightFrac > 0.1 ? 'right' : null);
    // YEM İMZASI: uzaklaşan tek keşif (kovalama tuzağı) + yanlardan kapanan kütle
    for (const e of enemies) {
        if (typeof T !== 'undefined' && e.typeEstimate === T.RECON) {
            const away = ((e.x - c.x) * e.vx + (e.y - c.y) * e.vy) > 0;   // öz-merkezden uzaklaşıyor
            if (away && (leftFrac > 0.1 || rightFrac > 0.1)) { env.baited = true; break; }
        }
    }
    // TEPKİ: tutmak sağkalır mı? stExpectedLoss ile takas oranı. Kabul edilebilirse konsantre, değilse screen+çekil.
    const ownVal = own.reduce((s, u) => s + ((typeof STATS !== 'undefined' && STATS[u.type] ? STATS[u.type].cost : 50) * (u.hpRatio != null ? u.hpRatio : 1)), 0);
    if (env.risk >= 0.55) {
        let acceptable = true;
        if (typeof stExpectedLoss === 'function') { const el = stExpectedLoss(ownVal, total, 10); acceptable = el.exchangeRatio >= 0.9; }
        env.recommendedResponse = acceptable ? 'CONSOLIDATE' : 'SCREEN_AND_WITHDRAW';
    }
    bb.envelopment = env;
}

function battleBuildBlackboard(controller, observation, situation) {
    if (!observation) return null;
    const side = controller.side;
    const own = observation.ownUnits || [];
    const contacts = (observation.contacts || []);
    // Öz kütle-merkezi
    let ocx = 0, ocy = 0; for (const u of own) { ocx += u.x; ocy += u.y; } if (own.length) { ocx /= own.length; ocy /= own.length; }

    // Objektif + ev + ilerleme ekseni + çekilme hattı (öz-merkezin gerisinde, eve doğru; yatay hat)
    const objective = (typeof battleObjectiveForSide === 'function') ? battleObjectiveForSide(side) : { x: ocx, y: ocy };
    const homeY = (typeof WORLD_H !== 'undefined') ? (side ? WORLD_H * 0.24 : WORLD_H * 0.76) : ocy;
    const homePoint = { x: (typeof WORLD_W !== 'undefined' ? WORLD_W * 0.5 : ocx), y: homeY };
    let ax = objective.x - ocx, ay = objective.y - ocy; const al = Math.hypot(ax, ay) || 1; const ux = ax / al, uy = ay / al;  // ileri birim-vektör
    // çekilme hattı: öz-merkezin ~200px GERİSİNDE (eve doğru), ilerleme eksenine dik yatay segment
    const rlcx = ocx - ux * 200, rlcy = ocy - uy * 200;
    const px = -uy, py = ux;   // eksene dik
    const HALF = (typeof WORLD_W !== 'undefined' ? WORLD_W * 0.35 : 700);
    const retreatLine = { a: { x: rlcx - px * HALF, y: rlcy - py * HALF }, b: { x: rlcx + px * HALF, y: rlcy + py * HALF }, normalToward: { x: -ux, y: -uy } };

    // Düşman listesi + uzay-zaman tahmini (görülen VE hatırlanan)
    const enemies = [];
    for (const c of contacts) {
        const p2 = (typeof stPredictEnemyPos === 'function') ? stPredictEnemyPos(c, 2) : { x: c.x, y: c.y, r: c.uncertaintyRadius || 0 };
        const p4 = (typeof stPredictEnemyPos === 'function') ? stPredictEnemyPos(c, 4) : { x: c.x, y: c.y, r: c.uncertaintyRadius || 0 };
        enemies.push({
            id: c.id, x: c.x, y: c.y, vx: c.velocityX || 0, vy: c.velocityY || 0,
            healthBand: c.healthBand, estimatedStrength: c.estimatedStrength || (typeof STATS !== 'undefined' && STATS[c.typeEstimate] ? STATS[c.typeEstimate].cost : 1),
            typeEstimate: c.typeEstimate, confidence: c.confidence, uncertaintyRadius: c.uncertaintyRadius,
            visible: c.visible, predicted: { t2: p2, t4: p4 }
        });
    }

    // Sektör raster (OPG 8×6=48): öz/düşman yoğunluk + tehdit (sınıf-DPS ağırlıklı)
    let ownSectors = null, enemySectors = null, threatMap = null, enemyCoG = null;
    if (typeof opgBuildContext === 'function') {
        const role = (situation && situation.role) || (typeof battleRoleForSide === 'function' ? battleRoleForSide(side) : null);
        const ctx = opgBuildContext(side, own, contacts, role);
        ownSectors = ctx.own; enemySectors = ctx.enemy; enemyCoG = ctx.enemyCoG;
        // tehdit haritası: düşman sektör-değeri × sınıf ağırlığı (yaklaşık — sektör başına baskın tip yok, contact'lardan biriktir)
        const N = (ownSectors && ownSectors.length) || 48;
        threatMap = new Float32Array(N);
        if (typeof opgSectorOf === 'function') {
            for (const c of contacts) { const si = opgSectorOf(c.x, c.y); if (si >= 0 && si < N) threatMap[si] += (c.estimatedStrength || 1) * bbThreatWeight(c.typeEstimate) * (c.confidence != null ? c.confidence : 1); }
        }
    }

    // Engel geometrisi (kaba terrain daireleri) — Faz 3 arka-rota kontrolü için ham malzeme
    const obstacles = (typeof terrainFeatures !== 'undefined' && Array.isArray(terrainFeatures))
        ? terrainFeatures.map(t => ({ x: t.x, y: t.y, r: t.r, type: t.type })) : [];

    const bb = {
        tick: (typeof SIM !== 'undefined' ? SIM.tick : 0), side,
        ownCentroid: { x: ocx, y: ocy }, advanceAxis: { x: ux, y: uy },
        objective, secondaryObjective: null, homePoint, retreatLine,
        enemies, ownSectors, enemySectors, threatMap, enemyCoG, obstacles,
        envelopment: { risk: 0, openFlank: null, encirclingClusters: [], recommendedResponse: null }
    };
    bbDetectEnvelopment(bb, own, situation);   // FAZ 3a: kuşatma tespiti (bb.envelopment doldurulur)
    return bb;
}

if (typeof module !== 'undefined') module.exports = { battleBuildBlackboard, bbThreatWeight };
