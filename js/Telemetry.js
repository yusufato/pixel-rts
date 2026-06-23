// Savaş davranışlarını karşılaştırmak için ortak ödül modeli.
const TACTICAL_REWARD_WEIGHTS = Object.freeze({
    damageDealt: 1.0,
    damageTaken: -1.15,
    enemyValueDestroyed: 2.4,
    aiValueLost: -3.8,
    rearHitDamage: 0.75,
    victory: 950,
    defeat: -900,
    draw: -350,
    deadlock: -900,
    adjudicated: -450,
    physicalFinish: 700,
    cleanupFinish: 260,
    scoutValuableSpot: 120,
    scoutDeath: -180,
    antiArtilleryDamage: 1.6,
    supportKill: 240,
    fieldKill: 180,
    lastHuntSecond: -5,
    fastVictoryPerSecond: 3,
    idlePerSecond: -2,
    longIdlePerSecond: -6,
    efficientTrade: 2.2,
    recklessValueLoss: -2.8
});

function calculateTacticalReward(metrics) {
    const w = TACTICAL_REWARD_WEIGHTS;
    const fastVictoryBonus = metrics.aiWon
        ? Math.max(0, 120 - metrics.durationSeconds) * w.fastVictoryPerSecond
        : 0;
    const longIdlePenalty = Math.max(0, metrics.idleSeconds - 45) * w.longIdlePerSecond;
    const tradeMargin = (metrics.enemyValueDestroyed ?? 0) - (metrics.aiValueLost ?? 0);
    const efficientTradeBonus = tradeMargin > 0 ? tradeMargin * w.efficientTrade : 0;
    const recklessLossPenalty = Math.max(0, (metrics.aiValueLost ?? 0) - (metrics.enemyValueDestroyed ?? 0) * 1.15) *
        Math.abs(w.recklessValueLoss);

    return (
        metrics.damageDealt * w.damageDealt +
        metrics.damageTaken * w.damageTaken +
        metrics.enemyValueDestroyed * w.enemyValueDestroyed +
        metrics.aiValueLost * w.aiValueLost +
        metrics.rearHitDamage * w.rearHitDamage +
        (metrics.aiWon ? w.victory : metrics.aiLost ? w.defeat : w.draw) +
        (metrics.deadlock ? w.deadlock : 0) +
        (metrics.adjudicated ? w.adjudicated : 0) +
        (metrics.physicalFinish && metrics.aiWon ? w.physicalFinish : 0) +
        (metrics.cleanupActivated && metrics.physicalFinish && metrics.aiWon ? w.cleanupFinish : 0) +
        (metrics.scoutValuableSpots ?? 0) * w.scoutValuableSpot +
        (metrics.scoutDeaths ?? 0) * w.scoutDeath +
        (metrics.antiArtilleryDamage ?? 0) * w.antiArtilleryDamage +
        (metrics.supportKills ?? 0) * w.supportKill +
        (metrics.fieldKills ?? 0) * w.fieldKill +
        (metrics.lastHuntSeconds ?? 0) * w.lastHuntSecond +
        efficientTradeBonus -
        recklessLossPenalty +
        fastVictoryBonus +
        metrics.idleSeconds * w.idlePerSecond +
        longIdlePenalty
    );
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
        this.summary = null;
    }

    start(now) {
        this.reset();
        this.started = true;
        this.startTime = now;
        this.lastDamageTime = now;
        this.lastDoctrineAt = now;
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
        const durationSeconds = Math.max(0, (now - this.startTime) / 1000);
        const dominantDoctrine = Object.entries(this.doctrineDurations)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
        const metrics = {
            version: 5,
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
            cleanupActivated: (this.doctrineDurations.cleanup || 0) > 0 || (this.doctrineDurations.last_hunt || 0) > 0,
            physicalFinish: playerWon !== 'draw',
            lastHuntSeconds: this.doctrineDurations.last_hunt || 0,
            aiWon: playerWon === false,
            aiLost: playerWon === true
        };
        metrics.reward = calculateTacticalReward(metrics);
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
