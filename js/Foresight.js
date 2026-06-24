// ═══════════════════════════════════════════════════════════════
//  İLERİYE-BAKIŞ DANIŞMANI (Lookahead Advisor)
//  ----------------------------------------------------------------
//  "Şunu yaparsam ne olur?" sorusunu kafadan oynatır. Eşit kuvvette
//  düelloyu kazanmanın yolu: kuvveti DAR bir noktaya yığıp (Schwerpunkt)
//  yerel üstünlük kurmak + sadece matematik lehteyken girmek.
//
//  Hızlı katman: odak-ateş Lanchester tahmincisi (her tick, ucuz).
//  Hibrit yavaş katman: gerçek-motor kalibrasyonu (SelfPlay, sonraki adım).
//
//  Komuta zincirine DANIŞMAN olarak bağlanır: çıktısı (Schwerpunkt noktası,
//  posture, manevra) LayeredAI'nin karar noktalarına girdi olur.
// ═══════════════════════════════════════════════════════════════

const ADVISOR_POSTURE = { COMMIT: 'COMMIT', HOLD: 'HOLD', WITHDRAW: 'WITHDRAW', SIEGE: 'SIEGE' };
const ADVISOR_MANEUVER = { FRONTAL: 'FRONTAL', FLANK: 'FLANK', ENVELOP: 'ENVELOP' };

// Hızlı tahmincinin kalibre edilebilir katsayıları (hibrit: gerçek-motor bunları ayarlar).
const FORESIGHT_CALIB = {
    lossAversion: 1.6,        // k: net = düşman_kaybı − k×kendi_kaybım. >1 = kendi birimim daha kıymetli (min kayıp)
    dpsEfficiency: 0.85,      // gerçekte birimler hep menzilde/ateşte değil → ham DPS'i kıs
    splashBonus: 1.35,        // tank/topçu yumuşak yığına karşı alan hasarı çarpanı
    flankSurpriseSec: 4.0,    // kanat baskın penceresi süresi
    flankEnemyMult: 0.40,     // o pencerede düşman ateşi çarpanı
    envelopDelaySec: 3.0,     // kuşatmada kendi gücüm geç devreye girer
    envelopMyMult: 0.55,      // o pencerede benim ateş çarpanım
    horizonSec: 9.0,
    dt: 0.5
};

class LookaheadAdvisor {
    constructor(side) {
        this.side = side;
        this.plan = null;
        this.planAt = -1e9;
        this.lastEval = null;
        this.COMMIT_HOLD_MS = 3000;   // histerez: planı en az bu kadar tut
        this.SWITCH_MARGIN = 220;     // yeni plan eskisini bu kadar geçmezse değiştirme
        this.WITHDRAW_NET = -160;     // en iyi saldırı bile bu kadar aleyhteyse çekil
        this.CLUSTER_RADIUS = 260;
        this.MAX_CLUSTERS = 3;
    }

    unitValue(u) { return (STATS[u.type] && STATS[u.type].cost) || 50; }
    armorOf(u) { return (typeof u.armor === 'number') ? u.armor : ((STATS[u.type] && STATS[u.type].armor) || 0); }
    isSupport(t) { return t === T.ARTILLERY || t === T.MEDIC || t === T.ENGINEER || t === T.ANTI_TANK; }
    isSoft(t) { return t === T.INFANTRY || t === T.MECH_INFANTRY || t === T.RECON || t === T.ARMOR_INFANTRY || this.isSupport(t); }

    // ── DÜŞMANI KÜMELE (Schwerpunkt adayları) ──
    clusterEnemies(enemies) {
        const clusters = [];
        for (const e of enemies) {
            let best = null, bd = this.CLUSTER_RADIUS;
            for (const c of clusters) {
                const d = Math.hypot(c.cx - e.x, c.cy - e.y);
                if (d < bd) { bd = d; best = c; }
            }
            if (best) {
                best.units.push(e);
                best.sx += e.x; best.sy += e.y;
                best.cx = best.sx / best.units.length;
                best.cy = best.sy / best.units.length;
            } else {
                clusters.push({ units: [e], sx: e.x, sy: e.y, cx: e.x, cy: e.y });
            }
        }
        for (const c of clusters) c.value = c.units.reduce((s, u) => s + this.unitValue(u), 0);
        clusters.sort((a, b) => b.value - a.value);
        return clusters.slice(0, this.MAX_CLUSTERS);
    }

    // Saldırgan a, hedef t'ye saniyede ham hasar
    dpsAToB(a, tDef) {
        const s = STATS[a.type];
        if (!s || s.atk <= 0) return 0;
        const perHit = calculateUnitDamage(a.type, tDef.type, s.atk, tDef.armor);
        return (perHit / (s.atkSpeed / 1000)) * FORESIGHT_CALIB.dpsEfficiency;
    }

    // Bir tarafın bir adımlık ateşini uygula (odak ateş: tek hedefe yığ, ölürse sonrakine taşı)
    applyVolley(attackers, defenders, dt, mode, globalMult) {
        const liveAtt = attackers.filter(u => u.hp > 0 && STATS[u.type] && STATS[u.type].atk > 0);
        if (!liveAtt.length) return;
        const softCount = defenders.filter(d => d.hp > 0 && this.isSoft(d.type)).length;

        let budget = dt;            // bu adımda harcanacak "zaman"
        let guard = 0;
        while (budget > 1e-3 && guard++ < 12) {
            const live = defenders.filter(d => d.hp > 0);
            if (!live.length) return;
            // odak hedefi seç
            let target = null, bestScore = -1;
            for (const d of live) {
                let score = this.unitValue(d) / Math.max(1, d.hp + d.armor * 5); // öldürülebilirlik
                if (mode === 'support' && this.isSupport(d.type)) score += 3;     // kuşatma: önce destek
                if (score > bestScore) { bestScore = score; target = d; }
            }
            // bu hedefe toplam DPS
            let dps = 0;
            for (const a of liveAtt) {
                let d = this.dpsAToB(a, target);
                if ((a.type === T.ARMOR || a.type === T.ARTILLERY) && softCount >= 3) d *= FORESIGHT_CALIB.splashBonus;
                dps += d;
            }
            dps *= globalMult;
            if (dps <= 0) return;
            const timeToKill = (target.hp) / dps;
            if (timeToKill >= budget) {
                target.hp -= dps * budget;
                budget = 0;
            } else {
                target.hp = 0;       // öldü, kalan süre sonraki hedefe
                budget -= timeToKill;
            }
        }
    }

    // ── ÇEKİRDEK: bir çarpışmanın sonucunu tahmin et ──
    predictEngagement(mine, foe, opts) {
        opts = opts || {};
        const A = mine.map(u => ({ type: u.type, hp: u.hp, armor: this.armorOf(u), val: this.unitValue(u) }));
        const B = foe.map(u => ({ type: u.type, hp: u.hp, armor: this.armorOf(u), val: this.unitValue(u) }));
        if (!A.length || !B.length) return { net: 0, myLoss: 0, enemyLoss: 0, Arem: 0, Brem: 0, win: false };
        const Ainit = A.reduce((s, u) => s + u.val, 0);
        const Binit = B.reduce((s, u) => s + u.val, 0);
        if (opts.enemyArmorBonus) B.forEach(u => u.armor += opts.enemyArmorBonus);
        if (opts.myArmorBonus) A.forEach(u => u.armor += opts.myArmorBonus);

        const dt = FORESIGHT_CALIB.dt;
        const horizon = opts.horizon || FORESIGHT_CALIB.horizonSec;
        const myMode = opts.maneuver === ADVISOR_MANEUVER.ENVELOP ? 'support' : 'kill';
        let t = 0, guard = 0;
        while (t < horizon && guard++ < 60 && A.some(u => u.hp > 0) && B.some(u => u.hp > 0)) {
            // benim ateşim (kuşatmada ilk pencerede zayıf — gücüm yolda; charge'ta damla-damla geliş)
            let myMult = 1;
            if (opts.maneuver === ADVISOR_MANEUVER.ENVELOP && t < FORESIGHT_CALIB.envelopDelaySec) myMult = FORESIGHT_CALIB.envelopMyMult;
            if (opts.myTrickleSec && t < opts.myTrickleSec) myMult *= (opts.myTrickleMult || 1);
            this.applyVolley(A, B, dt, myMode, myMult);
            // düşman ateşi (kanatta ilk pencerede baskın → zayıf; savunmacı ilk vuruş üstünlüğü → güçlü)
            let enMult = opts.enemyDpsMult || 1;
            if (opts.maneuver === ADVISOR_MANEUVER.FLANK && t < FORESIGHT_CALIB.flankSurpriseSec) enMult *= FORESIGHT_CALIB.flankEnemyMult;
            if (opts.enemyEarlySec && t < opts.enemyEarlySec) enMult *= (opts.enemyEarlyMult || 1);
            this.applyVolley(B, A, dt, 'kill', enMult);
            t += dt;
        }
        const Arem = A.filter(u => u.hp > 0).reduce((s, u) => s + u.val, 0);
        const Brem = B.filter(u => u.hp > 0).reduce((s, u) => s + u.val, 0);
        const myLoss = Ainit - Arem;
        const enemyLoss = Binit - Brem;
        // ÇEKİRDEK METRİK: net = düşman kaybı − k×kendi kaybım (kayıp-kaçınması).
        // k GENOMDAN gelir (eğitim AI'nın temkin/agresiflik kişiliğini ayarlar); opts.lossAversion override eder (birim vetosu 1.0 kullanır).
        const k = (opts.lossAversion != null) ? opts.lossAversion
            : ((typeof aiGenome !== 'undefined' && aiGenome && aiGenome.tacticGenes && Number.isFinite(aiGenome.tacticGenes.lossAversion))
                ? aiGenome.tacticGenes.lossAversion : FORESIGHT_CALIB.lossAversion);
        return { net: enemyLoss - k * myLoss, myLoss, enemyLoss, Arem, Brem, win: Brem <= 1 || Arem > Brem };
    }

    // ── BİRİM-SEVİYESİ YEREL TAKAS ── (aşağıdan yukarı kuvvet ekonomisi)
    // Birim: "yakınımdaki dost+düşmanla bu yerel kavga lehime mi?" Değilse düşman ateşine YÜRÜMEZ,
    // yoğunlaşmayı bekler. Yakında düşman yoksa serbesttir (ilerleyebilir). Damla-damla ölümü kaynağında keser.
    localExchange(unit, ownUnits, visibleEnemies) {
        const R = 340;
        const foes = visibleEnemies.filter(e => {
            if (e.dead) return false;
            const d = Math.hypot(e.x - unit.x, e.y - unit.y);
            return d < R || d < ((STATS[e.type] && STATS[e.type].range) || 0) + 40;
        });
        if (foes.length === 0) return { favorable: true, net: 0, hasFoes: false };
        const friends = ownUnits.filter(u => !u.dead && STATS[u.type] && STATS[u.type].atk > 0 &&
            Math.hypot(u.x - unit.x, u.y - unit.y) < R);
        // Birim vetosu intiharı önler (1'e çok), eşit/lehte kavgaya izin verir → paralizi yok.
        // Stratejik kayıp-kaçınması (k=1.6) ORDU seviyesinde; burada ham takasa bakarız (yumuşak eşik).
        const r = this.predictEngagement(friends, foes, { horizon: 6, lossAversion: 1.0 });
        return { favorable: r.enemyLoss >= r.myLoss * 0.85, net: r.net, hasFoes: true };
    }

    // ── PLAN: en iyi (Schwerpunkt × manevra × posture) ──
    evaluate(ownUnits, visibleEnemies, enemyStatic) {
        const combat = ownUnits.filter(u => !u.dead && STATS[u.type] && STATS[u.type].atk > 0);
        if (combat.length < 1 || visibleEnemies.length < 1) return null;
        const clusters = this.clusterEnemies(visibleEnemies);
        if (!clusters.length) return null;

        const inTrench = (typeof trenches !== 'undefined') &&
            trenches.some(f => f.isRed === this.side);
        const longRange = combat.filter(u => u.type === T.ANTI_TANK || u.type === T.ARTILLERY);
        const candidates = [];

        for (const c of clusters) {
            for (const M of [ADVISOR_MANEUVER.FRONTAL, ADVISOR_MANEUVER.FLANK, ADVISOR_MANEUVER.ENVELOP]) {
                // SALDIR (COMMIT): tüm muharebe gücünü bu kümeye yığ.
                // GERÇEKÇİLİK: savunan (sabit) düşmana charge çok pahalı — kazılı +zırh, savunmacı ilk vuruş
                // üstünlüğü, ve birimlerim damla-damla gelir (8 sn ×0.3). Bu olmadan tahminci charge'ı kazanır sanıp
                // intihar ettiriyordu (canlı: 1500'e 200 kayıp).
                const opts = { maneuver: M };
                if (enemyStatic) {
                    opts.enemyArmorBonus = 6;
                    opts.myTrickleSec = 8; opts.myTrickleMult = 0.3;
                    opts.enemyEarlySec = 6; opts.enemyEarlyMult = 1.3;
                }
                const r = this.predictEngagement(combat, c.units, opts);
                candidates.push({
                    posture: ADVISOR_POSTURE.COMMIT, maneuver: M,
                    target: { x: c.cx, y: c.cy }, clusterValue: c.value,
                    net: r.net, win: r.win, myLoss: r.myLoss, enemyLoss: r.enemyLoss
                });
            }
            // KUŞATMA (SIEGE): düşman sabit + uzun menzil birim varsa → dışarıdan bombala, kuvvet koru.
            // Düşman menzil dışında kalır (enemyDpsMult düşük), ben yavaş ama güvenli yıpratırım.
            if (enemyStatic && longRange.length >= 1) {
                const s = this.predictEngagement(longRange, c.units, {
                    maneuver: ADVISOR_MANEUVER.FRONTAL, enemyDpsMult: 0.15, horizon: 14
                });
                candidates.push({
                    posture: ADVISOR_POSTURE.SIEGE, maneuver: ADVISOR_MANEUVER.FRONTAL,
                    target: { x: c.cx, y: c.cy }, clusterValue: c.value,
                    net: s.net + 20, win: s.win, myLoss: s.myLoss, enemyLoss: s.enemyLoss
                });
            }
            // TUT (HOLD): orduyu koru, düşmanı menzile çek, savunma üstünlüğünü topla.
            // Gerçekçi & sabit küçük değer (brawl simüle ETME — tutarsak temas sınırlıdır). Kaybedilecek
            // bir charge yerine savunmayı seçtirir; siperde daha değerli. SIEGE bunu geçebilir (kazanır).
            candidates.push({
                posture: ADVISOR_POSTURE.HOLD, maneuver: ADVISOR_MANEUVER.FRONTAL,
                target: { x: c.cx, y: c.cy }, clusterValue: c.value,
                net: inTrench ? 45 : 12, win: false, myLoss: 0, enemyLoss: 0
            });
        }

        candidates.sort((a, b) => b.net - a.net);
        const best = candidates[0];

        // ÇEKİL: en iyi seçenek bile belirgin aleyhteyse, kuvveti tek kütle koru
        if (best.net < this.WITHDRAW_NET) {
            return {
                posture: ADVISOR_POSTURE.WITHDRAW, maneuver: ADVISOR_MANEUVER.FRONTAL,
                target: best.target, net: best.net, win: false,
                myLoss: best.myLoss, enemyLoss: best.enemyLoss,
                confidence: Math.min(1, Math.abs(best.net) / 500),
                alt: best
            };
        }
        best.confidence = Math.min(1, Math.abs(best.net) / 500);
        return best;
    }

    // Dış arayüz: histerezli plan (LayeredAI her tick çağırır)
    decide(ownUnits, visibleEnemies, combatAnalysis, now, enemyStatic) {
        const fresh = this.evaluate(ownUnits, visibleEnemies, enemyStatic);
        this.lastEval = fresh;
        if (!fresh) { this.plan = null; return null; }
        // histerez: mevcut planı koru, yeni plan yeterince iyiyse değiştir
        if (this.plan &&
            (now - this.planAt) < this.COMMIT_HOLD_MS &&
            fresh.posture === this.plan.posture &&
            (fresh.net - (this.plan.net || 0)) < this.SWITCH_MARGIN) {
            // eski planın hedefini taze konuma güncelle (düşman hareket etti)
            if (fresh.target) this.plan.target = fresh.target;
            this.plan.net = fresh.net;
            this.plan.confidence = fresh.confidence;
            return this.plan;
        }
        const changed = !this.plan || this.plan.posture !== fresh.posture || this.plan.maneuver !== fresh.maneuver;
        this.plan = fresh;
        this.planAt = now;
        // Şeffaflık: konsolda FORESIGHT_DEBUG=true ise her yeni karar yazılır (danışman nasıl düşünüyor?)
        if (changed && typeof window !== 'undefined' && window.FORESIGHT_DEBUG) {
            const sd = this.side ? 'KIRMIZI' : 'MAVİ';
            console.log(`[Danışman ${sd}] ${fresh.posture}/${fresh.maneuver} · net=${Math.round(fresh.net)} · güven=${(fresh.confidence || 0).toFixed(2)}`);
        }
        return this.plan;
    }

    reset() { this.plan = null; this.planAt = -1e9; this.lastEval = null; }
}

if (typeof window !== 'undefined') {
    window.LookaheadAdvisor = LookaheadAdvisor;
    window.ADVISOR_POSTURE = ADVISOR_POSTURE;
    window.ADVISOR_MANEUVER = ADVISOR_MANEUVER;
    window.FORESIGHT_CALIB = FORESIGHT_CALIB;
}
