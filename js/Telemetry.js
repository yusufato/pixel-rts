// ── KUVVET EKONOMİSİ ÖDÜL MODELİ ──
// Temel: "en az kayıpla en fazla hasar". Net değer (düşman_kaybı − k×kendi_kaybım) BASKIN terim.
// Kazanmak amaç değil, verimli takasların sonucu → intihar-galibiyet, verimli-yenilgiden daha kötü puan alır.
// Sabır artık cezalı değil (kuşatma/yoğunlaşma beklemek meşru); sadece TAM atalet hafif cezalı.
const TACTICAL_REWARD_WEIGHTS = Object.freeze({
    netValuePerPoint: 4.0,    // (enemyValueDestroyed − lossAversion×aiValueLost) × bu = baskın terim
    lossAversion: 1.6,        // k: kendi birimim daha kıymetli (Foresight ile aynı felsefe)
    damageDealt: 0.35,        // ikincil sinyal (değer zaten baskın)
    damageTaken: -0.45,
    rearHitDamage: 0.5,
    victory: 500,             // kazanmak önemli ama intiharı haklı çıkaracak kadar değil
    defeat: -380,
    draw: -120,               // verimli beraberlik, verimsiz galibiyete yakın olabilmeli
    deadlock: -300,
    adjudicated: -180,
    physicalFinish: 240,
    cleanupFinish: 110,
    scoutValuableSpot: 100,
    scoutDeath: -150,
    antiArtilleryDamage: 1.2,
    supportKill: 220,
    fieldKill: 160,
    lastHuntSecond: -4,
    fastVictoryPerSecond: 2,
    idlePerSecond: -0.35,     // sabır artık ~serbest (eski -2 sabrı cezalandırıp charge'a zorluyordu)
    longIdlePerSecond: -1.1   // sadece aşırı atalet (>120 sn) hafif cezalı
});

function calculateTacticalReward(metrics) {
    const w = TACTICAL_REWARD_WEIGHTS;
    const fastVictoryBonus = metrics.aiWon
        ? Math.max(0, 120 - metrics.durationSeconds) * w.fastVictoryPerSecond
        : 0;
    const longIdlePenalty = Math.max(0, metrics.idleSeconds - 120) * w.longIdlePerSecond;
    // ÇEKİRDEK: kayıp-kaçınmalı net değer (Foresight metriğiyle birebir aynı).
    const netValue = (metrics.enemyValueDestroyed ?? 0) - w.lossAversion * (metrics.aiValueLost ?? 0);

    return (
        netValue * w.netValuePerPoint +
        metrics.damageDealt * w.damageDealt +
        metrics.damageTaken * w.damageTaken +
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
