// ═══════════════════════════════════════════════════════════════
//  TAKTİK AI ÇEKİRDEĞİ
//  Lanchester + DPS/TTK + FSM/Behavior Tree + Steering + Target Scoring
// ═══════════════════════════════════════════════════════════════

const TACTICAL_AI_VERSION = 'combat-brain-v2-support-hunt';

const UNIT_VALUE_WEIGHT = Object.freeze({
    [T.INFANTRY]: 1.00,
    [T.MECH_INFANTRY]: 1.35,
    [T.ARMOR_INFANTRY]: 1.35,
    [T.RECON]: 1.20,
    [T.ENGINEER]: 1.65,
    [T.MEDIC]: 1.85,
    [T.ARMOR]: 2.20,
    [T.ANTI_TANK]: 2.00,
    [T.ARTILLERY]: 2.30
});

const UNIT_THREAT_WEIGHT = Object.freeze({
    [T.INFANTRY]: 1.00,
    [T.MECH_INFANTRY]: 1.25,
    [T.ARMOR_INFANTRY]: 0.95,
    [T.RECON]: 0.80,
    [T.ENGINEER]: 0.55,
    [T.MEDIC]: 0.20,
    [T.ARMOR]: 2.20,
    [T.ANTI_TANK]: 2.10,
    [T.ARTILLERY]: 2.55
});

const UNIT_DECISION_STATE = Object.freeze({
    FLEE: 'FLEE',
    RESUPPLY: 'RESUPPLY',
    EXECUTE: 'EXECUTE',
    KITE: 'KITE',
    HOLD_RANGE: 'HOLD_RANGE',
    ASSAULT: 'ASSAULT',
    SUPPORT: 'SUPPORT'
});

function tacticalDistSq(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
}

function tacticalClamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function tacticalNormalize(x, y) {
    const length = Math.max(0.0001, Math.sqrt(x * x + y * y));
    return { x: x / length, y: y / length, length };
}

const CombatMath = Object.freeze({
    damagePerShot(attackerType, targetType, attacker = null, target = null) {
        const attackerStats = STATS[attackerType];
        const targetStats = STATS[targetType];
        const attack = (attacker?.atk ?? attackerStats.atk) * (attacker?.xpBonus ?? 1);
        const armor = target?.armor ?? targetStats.armor;
        return calculateUnitDamage(attackerType, targetType, attack, armor);
    },

    dps(attackerType, targetType, attacker = null, target = null) {
        const attackerStats = STATS[attackerType];
        const attackSpeed = attacker?.atkSpeed ?? attackerStats.atkSpeed;
        if (attackerStats.atk <= 0 || attackSpeed <= 0) return 0;
        const panicFactor = attacker?.isPanicking ? 1 / 1.5 : 1;
        const suppressionFactor = attacker?.suppression > 50 ? 1 / 1.5 : 1;
        const ammoFactor = attacker && attacker.maxAmmo > 0
            ? tacticalClamp(attacker.ammo / Math.max(1, attacker.maxAmmo), 0.25, 1)
            : 1;
        return this.damagePerShot(attackerType, targetType, attacker, target) * (1000 / attackSpeed) *
            panicFactor * suppressionFactor * ammoFactor;
    },

    ttk(attacker, target) {
        const dps = this.dps(attacker.type, target.type, attacker, target);
        if (dps <= 0.01) return Infinity;
        return Math.max(0, target.hp) / dps;
    },

    unitCombatPower(unit, enemyMix = null) {
        if (!unit || unit.dead) return 0;
        const hpRatio = tacticalClamp(unit.hp / Math.max(1, unit.maxHp), 0.05, 1);
        const ammoRatio = unit.maxAmmo > 0 ? tacticalClamp(unit.ammo / Math.max(1, unit.maxAmmo), 0.15, 1) : 1;
        const targetTypes = enemyMix && enemyMix.length > 0 ? enemyMix : Object.values(T);
        let weightedDps = 0;
        for (const targetType of targetTypes) weightedDps += this.dps(unit.type, targetType, unit) / targetTypes.length;
        const rangeFactor = 0.75 + (unit.range / 350) * 0.25;
        const visionFactor = 0.85 + ((unit.vision ?? STATS[unit.type].vision) / 800) * 0.15;
        return weightedDps * Math.sqrt(Math.max(1, unit.hp + unit.armor * 18)) *
            hpRatio * ammoRatio * rangeFactor * visionFactor * (UNIT_THREAT_WEIGHT[unit.type] ?? 1);
    },

    lanchesterPower(army, enemyArmy = []) {
        const enemyMix = enemyArmy.length > 0 ? enemyArmy.map(unit => unit.type) : null;
        let linearPower = 0;
        let squarePower = 0;
        for (const unit of army) {
            if (unit.dead || unit.hp <= 0) continue;
            const power = this.unitCombatPower(unit, enemyMix);
            linearPower += power;
            squarePower += power * power;
        }
        return {
            linear: linearPower,
            square: Math.sqrt(squarePower),
            count: army.filter(unit => !unit.dead && unit.hp > 0).length
        };
    },

    forceRatio(ownArmy, enemyArmy) {
        const own = this.lanchesterPower(ownArmy, enemyArmy);
        const enemy = this.lanchesterPower(enemyArmy, ownArmy);
        return {
            own,
            enemy,
            ratio: own.square / Math.max(1, enemy.square),
            linearRatio: own.linear / Math.max(1, enemy.linear)
        };
    }
});

const InfluenceMaps = Object.freeze({
    threatAt(x, y, enemyUnits, radiusBoost = 0) {
        let threat = 0;
        for (const enemy of enemyUnits) {
            if (enemy.dead || enemy.hp <= 0) continue;
            const stats = STATS[enemy.type];
            const reach = stats.range + radiusBoost + stats.vision * 0.18;
            const dSq = tacticalDistSq(x, y, enemy.x, enemy.y);
            if (dSq > reach * reach) continue;
            const distance = Math.sqrt(dSq);
            const falloff = 1 - distance / Math.max(1, reach);
            threat += CombatMath.unitCombatPower(enemy) * falloff * (UNIT_THREAT_WEIGHT[enemy.type] ?? 1);
        }
        return threat;
    },

    friendlySupportAt(x, y, allies) {
        let support = 0;
        for (const ally of allies) {
            if (ally.dead || ally.hp <= 0) continue;
            const dSq = tacticalDistSq(x, y, ally.x, ally.y);
            const radius = ally.range + 160;
            if (dSq > radius * radius) continue;
            support += CombatMath.unitCombatPower(ally) * (1 - Math.sqrt(dSq) / radius);
        }
        return support;
    },

    positionScore(x, y, allies, enemies) {
        return this.friendlySupportAt(x, y, allies) - this.threatAt(x, y, enemies, 90);
    }
});

const TargetScoring = Object.freeze({
    score(unit, enemy, context = {}) {
        if (!unit || !enemy || enemy.dead) return -Infinity;
        const genes = context.genes || {};
        const targetValueWeight = context.targetValueWeight ?? genes.targetValueWeight ?? 1;
        const targetThreatWeight = context.targetThreatWeight ?? genes.targetThreatWeight ?? 1;
        const finishBias = context.finishBias ?? genes.finishBias ?? 1;
        const distance = Math.sqrt(tacticalDistSq(unit.x, unit.y, enemy.x, enemy.y));
        const lineOfSight = context.lineOfSight ?? true;
        const inRange = distance <= unit.range;
        const ttk = CombatMath.ttk(unit, enemy);
        const enemyDps = CombatMath.dps(enemy.type, unit.type, enemy, unit);
        const healthFinish = (1 - enemy.hp / Math.max(1, enemy.maxHp)) * 900;
        const value = STATS[enemy.type].cost * (UNIT_VALUE_WEIGHT[enemy.type] ?? 1) * targetValueWeight;
        const threat = enemyDps * 55 * (UNIT_THREAT_WEIGHT[enemy.type] ?? 1) * targetThreatWeight;
        const supportBonus = [T.ARTILLERY, T.MEDIC, T.ENGINEER].includes(enemy.type)
            ? 480 * (context.supportPriority ?? 1)
            : 0;
        const armorBonus = [T.ARMOR, T.MECH_INFANTRY, T.ARMOR_INFANTRY].includes(enemy.type)
            ? 420 * (context.armorPriority ?? 1)
            : 0;
        const supportHuntBonus = context.supportHunt && [T.ARTILLERY, T.MEDIC, T.ENGINEER, T.ANTI_TANK].includes(enemy.type)
            ? (enemy.type === T.ARTILLERY ? 7800 : enemy.type === T.MEDIC ? 6600 : enemy.type === T.ENGINEER ? 5600 : 4200)
            : 0;
        const armorScreenPenalty = context.supportHunt && [T.ARMOR, T.ARMOR_INFANTRY].includes(enemy.type)
            ? 2600
            : 0;
        const finishBonus = (ttk < 5 ? 720 : ttk < 10 ? 280 : 0) * Math.min(1.15, finishBias);
        const focusBonus = enemy === context.focusTarget
            ? (context.supportHunt ? 5200 : 900) * (context.focusFire ?? 0.6)
            : 0;
        const rangeBonus = inRange && lineOfSight ? 2200 : lineOfSight ? 500 : -800;
        const distancePenalty = distance * (1.05 - (context.focusFire ?? 0.6) * 0.35);
        return value + threat + healthFinish + supportBonus + armorBonus + supportHuntBonus +
            finishBonus + focusBonus + rangeBonus - distancePenalty - armorScreenPenalty - ttk * 18;
    },

    bestTarget(unit, enemies, context = {}) {
        let best = null;
        let bestScore = -Infinity;
        for (const enemy of enemies) {
            const score = this.score(unit, enemy, {
                ...context,
                lineOfSight: context.lineOfSightFor ? context.lineOfSightFor(unit, enemy) : context.lineOfSight
            });
            if (score > bestScore) {
                best = enemy;
                bestScore = score;
            }
        }
        return { unit: best, score: bestScore };
    }
});

const DecisionSystems = Object.freeze({
    decideUnitState(unit, context = {}) {
        const genes = context.genes || {};
        const resupplyAmmo = genes.resupplyAmmo ?? 0.12;
        const executeTtk = genes.executeTtk ?? 7;
        const kiteHp = genes.kiteHp ?? 0.42;
        const retreatForceRatio = genes.tacticalRetreatForceRatio ?? 0.85;
        const hpRatio = unit.hp / Math.max(1, unit.maxHp);
        const ammoRatio = unit.maxAmmo > 0 ? unit.ammo / Math.max(1, unit.maxAmmo) : 1;
        const forceRatio = context.forceRatio ?? 1;
        const target = context.target ?? null;
        const targetTtk = target ? CombatMath.ttk(unit, target) : Infinity;

        if (!unit.lastStandMorale &&
            (unit.isFleeing || hpRatio < 0.18 && forceRatio < retreatForceRatio)) {
            return UNIT_DECISION_STATE.FLEE;
        }
        if (unit.type !== T.MEDIC && ammoRatio <= resupplyAmmo) return UNIT_DECISION_STATE.RESUPPLY;
        if (target && targetTtk <= executeTtk && hpRatio > 0.25) return UNIT_DECISION_STATE.EXECUTE;
        if (target && hpRatio < kiteHp && forceRatio < 1.05 && unit.type !== T.ARMOR_INFANTRY) return UNIT_DECISION_STATE.KITE;
        if (target && targetTtk < executeTtk * 2.3) return UNIT_DECISION_STATE.HOLD_RANGE;
        if (unit.type === T.MEDIC || unit.type === T.ARTILLERY || unit.type === T.ANTI_TANK) return UNIT_DECISION_STATE.SUPPORT;
        return UNIT_DECISION_STATE.ASSAULT;
    }
});

const SteeringBehaviors = Object.freeze({
    steerPoint(unit, goal, allies = [], enemies = [], options = {}) {
        let vx = (goal.x - unit.x) * (options.seekWeight ?? 1.0);
        let vy = (goal.y - unit.y) * (options.seekWeight ?? 1.0);

        // Boids: ayrışma. Birlikler tek piksel topağına dönüşmesin.
        for (const ally of allies) {
            if (ally === unit || ally.dead) continue;
            const dx = unit.x - ally.x;
            const dy = unit.y - ally.y;
            const dSq = dx * dx + dy * dy;
            const separationRadius = options.separationRadius ?? 95;
            if (dSq > 0.01 && dSq < separationRadius * separationRadius) {
                const force = (1 - Math.sqrt(dSq) / separationRadius) * (options.separationWeight ?? 130);
                const n = tacticalNormalize(dx, dy);
                vx += n.x * force;
                vy += n.y * force;
            }
        }

        // Dağlardan erken kaçınma. Navigator rota çizer, steering de mikro savrulmayı azaltır.
        for (const terrain of terrainFeatures) {
            if (terrain.type !== TERRAIN.MOUNTAIN) continue;
            const dx = unit.x - terrain.x;
            const dy = unit.y - terrain.y;
            const avoidRadius = terrain.r + UNIT_RADIUS + 170;
            const dSq = dx * dx + dy * dy;
            if (dSq > 0.01 && dSq < avoidRadius * avoidRadius) {
                const force = (1 - Math.sqrt(dSq) / avoidRadius) * (options.terrainWeight ?? 260);
                const n = tacticalNormalize(dx, dy);
                vx += n.x * force;
                vy += n.y * force;
            }
        }

        // Tehlike alanından hafif kaçınma; topçu/tanksavar önünde gereksiz yığılmayı azaltır.
        for (const enemy of enemies) {
            if (enemy.dead) continue;
            const reach = enemy.range + 110;
            const dx = unit.x - enemy.x;
            const dy = unit.y - enemy.y;
            const dSq = dx * dx + dy * dy;
            if (dSq > 0.01 && dSq < reach * reach) {
                const force = (1 - Math.sqrt(dSq) / reach) *
                    (UNIT_THREAT_WEIGHT[enemy.type] ?? 1) * (options.threatWeight ?? 85);
                const n = tacticalNormalize(dx, dy);
                vx += n.x * force;
                vy += n.y * force;
            }
        }

        const n = tacticalNormalize(vx, vy);
        const step = Math.min(options.maxStep ?? 180, n.length);
        return {
            x: tacticalClamp(unit.x + n.x * step, UNIT_RADIUS, WORLD_W - UNIT_RADIUS),
            y: tacticalClamp(unit.y + n.y * step, UNIT_RADIUS, WORLD_H - UNIT_RADIUS)
        };
    }
});

const TacticalAI = Object.freeze({
    version: TACTICAL_AI_VERSION,
    CombatMath,
    InfluenceMaps,
    TargetScoring,
    DecisionSystems,
    SteeringBehaviors,
    UNIT_DECISION_STATE,
    unitValueWeight: UNIT_VALUE_WEIGHT,
    unitThreatWeight: UNIT_THREAT_WEIGHT,

    analyzeBattle(ownUnits, enemyUnits) {
        if (!enemyUnits || enemyUnits.length === 0) {
            const own = CombatMath.lanchesterPower(ownUnits, []);
            return {
                forceRatio: 1,
                linearForceRatio: 1,
                ownPower: own.square,
                enemyPower: 0,
                enemyThreat: 0
            };
        }
        const force = CombatMath.forceRatio(ownUnits, enemyUnits);
        return {
            forceRatio: force.ratio,
            linearForceRatio: force.linearRatio,
            ownPower: force.own.square,
            enemyPower: force.enemy.square,
            enemyThreat: enemyUnits.reduce((sum, unit) => sum + CombatMath.unitCombatPower(unit), 0)
        };
    }
});
