// ── AI SAĞLIK ÖLÇÜMÜ ──
// Amaç: "AI iyi mi kötü mü" sorusuna maç sonunda okunabilir cevap vermek.
// Tek soyut puan yerine üç bağımsız gösterge — hangisinin bozuk olduğu doğrudan görünür.
//
//  takas   : öldürdüğü değer / kaybettiği değer. 1.0 = başabaş. Kuvvet ekonomisinin özeti;
//            AI kazansa bile takas 0.6 ise pahalı kazanmıştır ve ayar gerekir.
//  temas   : sürenin yüzde kaçında çatışma vardı. Düşükse AI ya kaçıyor ya bulamıyor —
//            "AI hiçbir şey yapmıyor" şikayetinin sayısal karşılığı budur.
//  kararlılık: makro plan değişim sıklığı. Çok yüksekse AI kararsız (flip-flop),
//            sıfırsa hiç uyum sağlamamış. İkisi de kötü; ortası sağlıklı.
const AI_HEALTH_TARGETS = Object.freeze({
    exchangeGood: 1.25,      // bu ve üstü: kuvvet ekonomisi sağlıklı
    exchangePoor: 0.75,      // bu ve altı: AI değer kaybediyor
    contactGood: 0.55,       // sürenin %55'inde temas = aktif savaş
    contactPoor: 0.25,       // bunun altı: AI sahada kayıp
    planChangesPerMinGood: 8 // dakikada 8'den fazla plan değişimi = kararsızlık
});

function summarizeAiHealth(metrics) {
    const minutes = Math.max(1 / 60, metrics.durationSeconds / 60);
    // Kayıpsız maçlarda bölen sıfıra yaklaşıp oran anlamsız büyüyor; 99 tavanı
    // "pratikte kayıpsız" demektir ve raporu okunabilir tutar.
    const exchange = Math.min(99, metrics.enemyValueDestroyed / Math.max(1, metrics.aiValueLost));
    const contact = metrics.durationSeconds > 0
        ? Math.max(0, 1 - metrics.idleSeconds / metrics.durationSeconds)
        : 0;
    const planChangesPerMin = metrics.planSwitches / minutes;

    const notes = [];
    if (exchange >= AI_HEALTH_TARGETS.exchangeGood) notes.push('kuvvet ekonomisi kârda');
    else if (exchange <= AI_HEALTH_TARGETS.exchangePoor) notes.push('AI değer kaybediyor — commit eşiği yüksek olabilir');
    if (contact <= AI_HEALTH_TARGETS.contactPoor) notes.push('temas çok düşük — AI düşmanı bulamıyor veya kaçıyor');
    else if (contact >= AI_HEALTH_TARGETS.contactGood) notes.push('sürekli temas');
    if (planChangesPerMin > AI_HEALTH_TARGETS.planChangesPerMinGood) notes.push('plan çok sık değişiyor — histerezi zayıf');
    // Kazanan AI'nın plan değiştirmemesi kusur değil: ilk plan tuttuğu için değiştirmemiştir.
    // Uyarı yalnız uzun ve kazanılamamış maçlarda anlamlı.
    else if (metrics.planSwitches === 0 && metrics.durationSeconds > 90 && !metrics.aiWon) {
        notes.push('plan hiç değişmedi — AI duruma uyum sağlamıyor');
    }

    // Harf notu: takas baskın, temas ikincil. Kazanmak tek başına yeterli değil —
    // pahalı zafer de düşük not alır (kuvvet ekonomisi felsefesi).
    let score = 0;
    score += exchange >= 1.5 ? 2 : exchange >= AI_HEALTH_TARGETS.exchangeGood ? 1.5
           : exchange >= 0.95 ? 1 : exchange >= AI_HEALTH_TARGETS.exchangePoor ? 0.5 : 0;
    score += contact >= AI_HEALTH_TARGETS.contactGood ? 1 : contact >= AI_HEALTH_TARGETS.contactPoor ? 0.5 : 0;
    if (metrics.aiWon) score += 0.5;
    const grade = score >= 3 ? 'A' : score >= 2.25 ? 'B' : score >= 1.5 ? 'C' : score >= 0.75 ? 'D' : 'F';

    return {
        exchangeRatio: Math.round(exchange * 100) / 100,
        contactRatio: Math.round(contact * 100) / 100,
        planChangesPerMin: Math.round(planChangesPerMin * 10) / 10,
        grade,
        notes: notes.length ? notes : ['belirgin sorun görünmüyor']
    };
}

class BattleTelemetry {
    constructor() {
        this.reset();
    }

    reset() {
        this.started = false;
        this.finished = false;
        this.startTime = 0;
        this.lastDamageTime = 0;
        this.damageDealt = 0;
        this.damageTaken = 0;
        this.enemyValueDestroyed = 0;
        this.aiValueLost = 0;
        this.rearHits = 0;
        this.rearHitDamage = 0;
        this.idleSeconds = 0;
        this.scoutValuableSpots = 0;
        this.scoutSpotKeys = new Set();
        this.scoutDeaths = 0;
        this.antiArtilleryDamage = 0;
        this.supportKills = 0;
        this.fieldKills = 0;
        this.compressionSeconds = 0;
        this.fireBaseWaitSeconds = 0;
        this.pressureBreakSeconds = 0;
        this.antiArtilleryFallbacks = 0;
        this.lastOperationalSignalAt = 0;
        this.lastAntiArtilleryBlocked = false;
        this.doctrineDurations = {};
        this.doctrineSwitches = 0;
        this.currentDoctrine = null;
        this.lastDoctrineAt = 0;
        // Komutanın makro planı (ATTACK/HOLD/RUSH/REGROUP/ADVANCE) ve kuvvet dağılımı
        this.planDurations = {};
        this.planSwitches = 0;
        this.currentPlan = null;
        this.lastPlanAt = 0;
        this.roleSamples = 0;
        this.roleTotals = [0, 0, 0, 0];   // MAIN / PIN / FLANK / RESERVE
        this.summary = null;
    }

    start(now) {
        this.reset();
        this.started = true;
        this.startTime = now;
        this.lastDamageTime = now;
        this.lastDoctrineAt = now;
        this.lastPlanAt = now;
    }

    // Komutanın makro planı + rol dağılımı (Commander.js her karar döngüsünde çağırır).
    recordCommanderPlan(mode, roleCounts, now) {
        if (!this.started || this.finished || !mode) return;
        if (roleCounts) {
            for (let i = 0; i < 4; i++) this.roleTotals[i] += roleCounts[i] || 0;
            this.roleSamples++;
        }
        if (this.currentPlan === null) {
            this.currentPlan = mode;
            this.lastPlanAt = now;
            return;
        }
        if (mode === this.currentPlan) return;
        this.planDurations[this.currentPlan] =
            (this.planDurations[this.currentPlan] || 0) + Math.max(0, (now - this.lastPlanAt) / 1000);
        this.currentPlan = mode;
        this.lastPlanAt = now;
        this.planSwitches++;
    }

    recordDamage(attacker, target, amount, isRearHit, now) {
        if (!this.started || this.finished || amount <= 0) return;
        if (attacker.isRed) {
            this.damageDealt += amount;
            if (target.type === T.ARTILLERY) this.antiArtilleryDamage += amount;
            if (isRearHit) {
                this.rearHits++;
                this.rearHitDamage += amount;
            }
        } else {
            this.damageTaken += amount;
        }
        this.lastDamageTime = now;
    }

    recordKill(attacker, target) {
        if (!this.started || this.finished) return;
        const value = STATS[target.type].cost;
        if (attacker.isRed) {
            this.enemyValueDestroyed += value;
            if ([T.ARTILLERY, T.MEDIC, T.ENGINEER].includes(target.type)) this.supportKills++;
            if (trenches.some(field => field.isRed === target.isRed &&
                Math.hypot(target.x - field.x, target.y - field.y) < field.r)) {
                this.fieldKills++;
            }
        } else {
            this.aiValueLost += value;
            if (target.type === T.RECON) this.scoutDeaths++;
        }
    }

    update(dtSeconds, now) {
        if (!this.started || this.finished) return;
        if (now - this.lastDamageTime > 1000) this.idleSeconds += dtSeconds;
    }

    recordDoctrine(doctrine, now) {
        if (!this.started || this.finished || !doctrine) return;
        if (!this.currentDoctrine) {
            this.currentDoctrine = doctrine;
            this.lastDoctrineAt = now;
            return;
        }
        if (doctrine === this.currentDoctrine) return;
        const elapsed = Math.max(0, (now - this.lastDoctrineAt) / 1000);
        this.doctrineDurations[this.currentDoctrine] =
            (this.doctrineDurations[this.currentDoctrine] || 0) + elapsed;
        this.currentDoctrine = doctrine;
        this.lastDoctrineAt = now;
        this.doctrineSwitches++;
    }

    recordScoutSpot(scout, target) {
        if (!this.started || this.finished || !scout || !target) return;
        if (scout.type !== T.RECON || !scout.isRed) return;
        if (![T.ARTILLERY, T.MEDIC, T.ENGINEER].includes(target.type)) return;
        const key = `${scout.id}:${target.id}`;
        if (this.scoutSpotKeys.has(key)) return;
        this.scoutSpotKeys.add(key);
        this.scoutValuableSpots++;
    }

    recordOperationalSignals(signals, now) {
        if (!this.started || this.finished || !signals) return;
        if (!this.lastOperationalSignalAt) this.lastOperationalSignalAt = now;
        const dtSeconds = Math.max(0, (now - this.lastOperationalSignalAt) / 1000);
        if (signals.compressionMode) this.compressionSeconds += dtSeconds;
        if (signals.fireBaseWait) this.fireBaseWaitSeconds += dtSeconds;
        if (signals.pressureBreak) this.pressureBreakSeconds += dtSeconds;
        if (signals.antiArtilleryBlocked && !this.lastAntiArtilleryBlocked) {
            this.antiArtilleryFallbacks++;
        }
        this.lastAntiArtilleryBlocked = !!signals.antiArtilleryBlocked;
        this.lastOperationalSignalAt = now;
    }

    finish(playerWon, now) {
        if (this.finished) return this.summary;
        this.finished = true;
        if (this.currentDoctrine) {
            const elapsed = Math.max(0, (now - this.lastDoctrineAt) / 1000);
            this.doctrineDurations[this.currentDoctrine] =
                (this.doctrineDurations[this.currentDoctrine] || 0) + elapsed;
            this.currentDoctrine = null;
        }
        if (this.currentPlan) {
            this.planDurations[this.currentPlan] =
                (this.planDurations[this.currentPlan] || 0) + Math.max(0, (now - this.lastPlanAt) / 1000);
            this.currentPlan = null;
        }
        const durationSeconds = Math.max(0, (now - this.startTime) / 1000);
        const dominantDoctrine = Object.entries(this.doctrineDurations)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
        const metrics = {
            version: 6,
            durationSeconds,
            damageDealt: this.damageDealt,
            damageTaken: this.damageTaken,
            enemyValueDestroyed: this.enemyValueDestroyed,
            aiValueLost: this.aiValueLost,
            rearHits: this.rearHits,
            rearHitDamage: this.rearHitDamage,
            idleSeconds: this.idleSeconds,
            scoutValuableSpots: this.scoutValuableSpots,
            scoutDeaths: this.scoutDeaths,
            antiArtilleryDamage: this.antiArtilleryDamage,
            supportKills: this.supportKills,
            fieldKills: this.fieldKills,
            compressionSeconds: this.compressionSeconds,
            fireBaseWaitSeconds: this.fireBaseWaitSeconds,
            pressureBreakSeconds: this.pressureBreakSeconds,
            antiArtilleryFallbacks: this.antiArtilleryFallbacks,
            doctrineDurations: { ...this.doctrineDurations },
            doctrineSwitches: this.doctrineSwitches,
            dominantDoctrine,
            planDurations: { ...this.planDurations },
            planSwitches: this.planSwitches,
            dominantPlan: Object.entries(this.planDurations).sort((a, b) => b[1] - a[1])[0]?.[0] || '-',
            avgRoleSplit: this.roleSamples
                ? this.roleTotals.map(t => Math.round(t / this.roleSamples * 10) / 10)
                : [0, 0, 0, 0],
            difficulty: (typeof COMMANDER !== 'undefined' && COMMANDER.difficulty) || 'normal',
            cleanupActivated: (this.doctrineDurations.cleanup || 0) > 0 || (this.doctrineDurations.last_hunt || 0) > 0,
            physicalFinish: [BATTLE_OUTCOME.DEFENDER_ELIMINATED, BATTLE_OUTCOME.ATTACKER_ELIMINATED, BATTLE_OUTCOME.MUTUAL_COLLAPSE].includes(SIM.battle?.outcomeReason),
            lastHuntSeconds: this.doctrineDurations.last_hunt || 0,
            aiWon: playerWon === false,
            aiLost: playerWon === true,
            aiRole: battleRoleForSide(true),
            outcomeReason: SIM.battle?.outcomeReason || null,
            attackerSide: SIM.battle?.attackerSide ? 'red' : 'blue',
            timeRemaining: Math.max(0, SIM.battle?.remainingSec || 0),
            redWill: SIM.battle?.red?.will ?? 0,
            blueWill: SIM.battle?.blue?.will ?? 0
        };
        metrics.health = summarizeAiHealth(metrics);
        this.summary = metrics;

        try {
            localStorage.setItem('pixelRtsLastBattleTelemetry', JSON.stringify(metrics));
        } catch (error) {
            console.warn('Savaş telemetrisi kaydedilemedi.', error);
        }
        console.table(metrics);
        return metrics;
    }
}

const battleTelemetry = new BattleTelemetry();
