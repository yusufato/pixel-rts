// Seçilen harekât tarzını hedefe ve görev gruplarına çevirir.
// Düşman hakkında yalnızca BattlePerception observation temaslarını kullanır.

const TASK_GROUP_ROLE = Object.freeze({
    MAIN: 'MAIN',
    FIXING: 'FIXING',
    FLANK: 'FLANK',
    FIRE_SUPPORT: 'FIRE_SUPPORT',
    RECON: 'RECON',
    SUPPORT: 'SUPPORT',
    RESERVE: 'RESERVE'
});

const TASK_CONTRACT_KIND = Object.freeze({
    SEIZE_OBJECTIVE: 'SEIZE_OBJECTIVE',
    HOLD_OBJECTIVE: 'HOLD_OBJECTIVE',
    FIX_ENEMY: 'FIX_ENEMY',
    TURN_FLANK: 'TURN_FLANK',
    SUPPORT_BY_FIRE: 'SUPPORT_BY_FIRE',
    RECONNOITER: 'RECONNOITER',
    SUSTAIN_FORCE: 'SUSTAIN_FORCE',
    REMAIN_IN_RESERVE: 'REMAIN_IN_RESERVE',
    REGROUP: 'REGROUP',
    COVER_WITHDRAWAL: 'COVER_WITHDRAWAL',
    WITHDRAW: 'WITHDRAW'
});

function planningRound(value) {
    return Math.round(value * 100) / 100;
}

function planningClampPoint(point) {
    return {
        x: planningRound(Math.max(0, Math.min(WORLD_W, point.x))),
        y: planningRound(Math.max(0, Math.min(WORLD_H, point.y)))
    };
}

function planningSafePoint(point) {
    const clamped = planningClampPoint(point);
    if (typeof nearestPassable !== 'function') return clamped;
    return planningClampPoint(nearestPassable(clamped.x, clamped.y, 30));
}

function planningPointBetween(from, to, ratio) {
    return planningSafePoint({
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio
    });
}

function planningRouteCost(from, to) {
    if (typeof findPathCells !== 'function' ||
        typeof CELL_W === 'undefined' || typeof CELL_H === 'undefined') {
        return Math.hypot(to.x - from.x, to.y - from.y);
    }
    const cells = findPathCells(
        Math.floor(from.x / CELL_W),
        Math.floor(from.y / CELL_H),
        Math.floor(to.x / CELL_W),
        Math.floor(to.y / CELL_H)
    );
    if (!cells?.length) return Infinity;
    let cost = 0;
    for (let index = 1; index < cells.length; index++) {
        cost += Math.hypot(
            cells[index][0] - cells[index - 1][0],
            cells[index][1] - cells[index - 1][1]
        );
    }
    return cost;
}

function planningPointOnPath(points, ratio) {
    if (!points?.length) return null;
    if (points.length === 1) return planningSafePoint(points[0]);
    const lengths = [];
    let total = 0;
    for (let index = 1; index < points.length; index++) {
        const length = Math.hypot(
            points[index].x - points[index - 1].x,
            points[index].y - points[index - 1].y
        );
        lengths.push(length);
        total += length;
    }
    const target = total * ratio;
    let travelled = 0;
    for (let index = 1; index < points.length; index++) {
        const segment = lengths[index - 1];
        if (travelled + segment >= target) {
            const localRatio = segment > 0 ? (target - travelled) / segment : 0;
            return planningPointBetween(points[index - 1], points[index], localRatio);
        }
        travelled += segment;
    }
    return planningSafePoint(points[points.length - 1]);
}

function planningRoutePoints(origin, destination) {
    const path = typeof findPath === 'function'
        ? findPath(origin.x, origin.y, destination.x, destination.y)
        : null;
    const points = path?.length >= 2 ? path : [origin, destination];
    return [
        planningPointOnPath(points, 0.25),
        planningPointOnPath(points, 0.65),
        planningSafePoint(destination)
    ].filter(Boolean);
}

function planningHealthFactor(band) {
    if (band === 'HEALTHY') return 1;
    if (band === 'DAMAGED') return 0.66;
    return 0.33;
}

function planningContactValue(contact) {
    return (STATS[contact.typeEstimate]?.cost || 0) *
        planningHealthFactor(contact.healthBand) *
        Math.max(0, Math.min(1, contact.confidence || 0));
}

function planningUnitValue(unit) {
    return (STATS[unit.type]?.cost || 0) *
        Math.max(0, Math.min(1, unit.hpRatio || 0));
}

function planningSector(x) {
    if (x < WORLD_W / 3) return 'left';
    if (x > WORLD_W * 2 / 3) return 'right';
    return 'center';
}

function planningMissionObjective(controller, situation) {
    if (typeof battleObjectiveForSide === 'function') {
        return planningSafePoint(battleObjectiveForSide(controller.side));
    }
    const enemyY = controller.side ? WORLD_H * 0.8 : WORLD_H * 0.2;
    const ownY = controller.side ? WORLD_H * 0.2 : WORLD_H * 0.8;
    return planningSafePoint({
        x: WORLD_W * 0.5,
        y: situation?.role === BATTLE_ROLE.DEFENDER ? ownY : enemyY
    });
}

function planningFriendlyCentroid(observation) {
    const units = observation?.ownUnits || [];
    if (!units.length) return null;
    return planningClampPoint({
        x: units.reduce((sum, unit) => sum + unit.x, 0) / units.length,
        y: units.reduce((sum, unit) => sum + unit.y, 0) / units.length
    });
}

function planningCenterOfGravity(contacts) {
    if (!contacts.length) return null;
    let totalWeight = 0;
    let x = 0;
    let y = 0;
    const sectorWeights = { left: 0, center: 0, right: 0 };
    for (const contact of contacts) {
        const weight = Math.max(0.01, planningContactValue(contact));
        totalWeight += weight;
        x += contact.x * weight;
        y += contact.y * weight;
        sectorWeights[planningSector(contact.x)] += weight;
    }
    const dominantSector = Object.keys(sectorWeights)
        .sort((a, b) => (sectorWeights[b] - sectorWeights[a]) || a.localeCompare(b))[0];
    return {
        ...planningClampPoint({ x: x / totalWeight, y: y / totalWeight }),
        confidence: planningRound(
            contacts.reduce((sum, contact) => sum + contact.confidence, 0) / contacts.length
        ),
        dominantSector,
        estimatedValue: planningRound(totalWeight),
        sourceContactIds: contacts.map(contact => contact.id).sort((a, b) => a - b)
    };
}

function planningFocusContact(kind, contacts, friendlyCentroid) {
    if (!contacts.length) return null;
    const scored = contacts.map(contact => {
        let score = planningContactValue(contact);
        if (kind === BATTLE_PLAN_KIND.FIRE_PREPARATION) {
            if (contact.typeEstimate === T.ARTILLERY) score += 180;
            if (contact.typeEstimate === T.ARMOR) score += 100;
            score += contact.visible ? 60 : -80;
        } else if (kind === BATTLE_PLAN_KIND.COUNTERATTACK && friendlyCentroid) {
            score += Math.max(0, 800 - Math.hypot(
                contact.x - friendlyCentroid.x,
                contact.y - friendlyCentroid.y
            )) * 0.2;
        } else if (kind === BATTLE_PLAN_KIND.MAIN_ATTACK ||
            kind === BATTLE_PLAN_KIND.FIX_AND_FLANK) {
            score += contact.confidence * 80;
        }
        return { contact, score };
    });
    scored.sort((a, b) => (b.score - a.score) || a.contact.id - b.contact.id);
    return scored[0].contact;
}

class OperationalObjectiveSelector {
    constructor(controller) {
        this.controller = controller;
    }

    select(plan, observation, situation) {
        if (!plan || !observation) return null;
        const contacts = (observation.contacts || [])
            .filter(contact => contact.confidence >= 0.2)
            .map(replayClone)
            .sort((a, b) => a.id - b.id);
        const friendlyCentroid = planningFriendlyCentroid(observation);
        const missionObjective = planningMissionObjective(this.controller, situation);
        const centerOfGravity = planningCenterOfGravity(contacts);
        const focus = planningFocusContact(plan.kind, contacts, friendlyCentroid);
        let target = missionObjective;
        let targetKind = 'MISSION_OBJECTIVE';
        let contactId = null;
        let confidence = 1;

        if (plan.kind === BATTLE_PLAN_KIND.HOLD && friendlyCentroid) {
            target = missionObjective;
            targetKind = 'DEFENSIVE_OBJECTIVE';
        } else if (plan.kind === BATTLE_PLAN_KIND.REGROUP && friendlyCentroid) {
            target = planningClampPoint({
                x: friendlyCentroid.x,
                y: friendlyCentroid.y + (this.controller.side ? -180 : 180)
            });
            targetKind = 'REGROUP_POINT';
        } else if (plan.kind === BATTLE_PLAN_KIND.DISENGAGE && friendlyCentroid) {
            target = planningClampPoint({
                x: friendlyCentroid.x,
                y: this.controller.side ? WORLD_H * 0.12 : WORLD_H * 0.88
            });
            targetKind = 'FALLBACK_POINT';
        } else if (focus && plan.kind !== BATTLE_PLAN_KIND.SEARCH &&
            plan.kind !== BATTLE_PLAN_KIND.ADVANCE) {
            target = planningSafePoint(focus);
            targetKind = focus.visible ? 'VISIBLE_CONTACT' : 'ESTIMATED_CONTACT';
            contactId = focus.id;
            confidence = planningRound(focus.confidence);
        }

        return {
            kind: targetKind,
            x: target.x,
            y: target.y,
            sector: planningSector(target.x),
            contactId,
            confidence,
            centerOfGravity,
            sourceContactIds: contacts.map(contact => contact.id).sort((a, b) => a - b)
        };
    }
}

function planningReserveRatio(situation, planKind) {
    // KONSANTRASYON: rezervi minimuma indir (tüm kuvveti çatışmaya sok) — insan-konsantrasyonuna karşı.
    if (typeof BATTLE_FORCE_CONCENTRATE !== 'undefined' && BATTLE_FORCE_CONCENTRATE === true) return 0.1;
    let ratio = situation?.role === BATTLE_ROLE.DEFENDER ? 0.27 : 0.2;
    if ((situation?.contactConfidence || 0) < 0.45) ratio += 0.08;
    if (planKind === BATTLE_PLAN_KIND.MAIN_ATTACK ||
        planKind === BATTLE_PLAN_KIND.FIX_AND_FLANK) ratio -= 0.05;
    if (planKind === BATTLE_PLAN_KIND.HOLD) ratio += 0.03;
    if (situation?.role === BATTLE_ROLE.ATTACKER) {
        ratio -= (situation.timePressure || 0) * 0.08;
    }
    const minimum = situation?.role === BATTLE_ROLE.ATTACKER ? 0.08 : 0.15;
    return Math.max(minimum, Math.min(0.35, ratio));
}

function planningCombatAffinity(unit, role) {
    if (role === TASK_GROUP_ROLE.FLANK) {
        if (unit.type === T.MECH_INFANTRY) return 40;
        if (unit.type === T.ARMOR) return 30;
        if (unit.type === T.INFANTRY) return 10;
        return 0;
    }
    if (role === TASK_GROUP_ROLE.FIXING) {
        if (unit.type === T.ARMOR_INFANTRY) return 40;
        if (unit.type === T.ANTI_TANK) return 35;
        if (unit.type === T.INFANTRY) return 30;
        return 5;
    }
    if (unit.type === T.ARMOR) return 40;
    if (unit.type === T.ARMOR_INFANTRY) return 30;
    if (unit.type === T.INFANTRY || unit.type === T.MECH_INFANTRY) return 20;
    return 10;
}

function planningRoleShares(planKind) {
    // KONSANTRASYON: tüm kuvveti MAIN'e yığ (dağılımı kapat) — insan-konsantrasyonuna karşı test/kaldıraç.
    if (typeof BATTLE_FORCE_CONCENTRATE !== 'undefined' && BATTLE_FORCE_CONCENTRATE === true) {
        return { [TASK_GROUP_ROLE.MAIN]: 1, [TASK_GROUP_ROLE.FIXING]: 0, [TASK_GROUP_ROLE.FLANK]: 0 };
    }
    if (planKind === BATTLE_PLAN_KIND.HOLD) {
        return { [TASK_GROUP_ROLE.MAIN]: 1, [TASK_GROUP_ROLE.FIXING]: 0, [TASK_GROUP_ROLE.FLANK]: 0 };
    }
    if (planKind === BATTLE_PLAN_KIND.FIX_AND_FLANK) {
        return { [TASK_GROUP_ROLE.MAIN]: 0.45, [TASK_GROUP_ROLE.FIXING]: 0.25, [TASK_GROUP_ROLE.FLANK]: 0.3 };
    }
    if (planKind === BATTLE_PLAN_KIND.COUNTERATTACK) {
        return { [TASK_GROUP_ROLE.MAIN]: 0.55, [TASK_GROUP_ROLE.FIXING]: 0.15, [TASK_GROUP_ROLE.FLANK]: 0.3 };
    }
    if (planKind === BATTLE_PLAN_KIND.DISENGAGE) {
        return { [TASK_GROUP_ROLE.MAIN]: 0.75, [TASK_GROUP_ROLE.FIXING]: 0.25, [TASK_GROUP_ROLE.FLANK]: 0 };
    }
    if (planKind === BATTLE_PLAN_KIND.FIRE_PREPARATION) {
        return { [TASK_GROUP_ROLE.MAIN]: 0.55, [TASK_GROUP_ROLE.FIXING]: 0.35, [TASK_GROUP_ROLE.FLANK]: 0.1 };
    }
    return { [TASK_GROUP_ROLE.MAIN]: 0.75, [TASK_GROUP_ROLE.FIXING]: 0.25, [TASK_GROUP_ROLE.FLANK]: 0 };
}

function planningGroup(role, units) {
    const ordered = units.slice().sort((a, b) => a.id - b.id);
    const value = ordered.reduce((sum, unit) => sum + planningUnitValue(unit), 0);
    return {
        role,
        unitIds: ordered.map(unit => unit.id),
        value: planningRound(value),
        centroid: ordered.length ? planningClampPoint({
            x: ordered.reduce((sum, unit) => sum + unit.x, 0) / ordered.length,
            y: ordered.reduce((sum, unit) => sum + unit.y, 0) / ordered.length
        }) : null,
        composition: ordered.reduce((result, unit) => {
            result[unit.type] = (result[unit.type] || 0) + 1;
            return result;
        }, {})
    };
}

class ForceOrganizer {
    constructor(controller) {
        this.controller = controller;
        this.cachedPlanId = null;
        this.cachedUnitSignature = null;
        this.cachedGroups = [];
    }

    organize(plan, observation, situation) {
        const units = (observation?.ownUnits || []).slice().sort((a, b) => a.id - b.id);
        const signature = units.map(unit => unit.id).join(',');
        if (this.cachedPlanId === plan?.id && this.cachedUnitSignature === signature) {
            return replayClone(this.cachedGroups);
        }

        const buckets = {};
        for (const role of Object.values(TASK_GROUP_ROLE)) buckets[role] = [];
        const combat = [];
        for (const unit of units) {
            if (unit.type === T.RECON) buckets[TASK_GROUP_ROLE.RECON].push(unit);
            else if (unit.type === T.ARTILLERY) buckets[TASK_GROUP_ROLE.FIRE_SUPPORT].push(unit);
            else if (unit.type === T.ENGINEER || unit.type === T.MEDIC) buckets[TASK_GROUP_ROLE.SUPPORT].push(unit);
            else combat.push(unit);
        }

        const reserveRatio = planningReserveRatio(situation, plan?.kind);
        const combatValue = combat.reduce((sum, unit) => sum + planningUnitValue(unit), 0);
        const reserveTarget = combatValue * reserveRatio;
        let reserveValue = 0;
        const reserveIds = new Set();
        while (combat.length - reserveIds.size > 1 && reserveValue < reserveTarget) {
            const candidates = combat
                .filter(unit => !reserveIds.has(unit.id))
                .map(unit => {
                    const value = planningUnitValue(unit);
                    const readinessScore = (unit.hpRatio + unit.ammoRatio) * 100 +
                        (unit.type === T.MECH_INFANTRY ? 30 : unit.type === T.ARMOR ? 20 : 0);
                    return {
                        unit,
                        value,
                        targetError: Math.abs(reserveTarget - (reserveValue + value)),
                        readinessScore
                    };
                })
                .sort((a, b) => (a.targetError - b.targetError) ||
                    (b.readinessScore - a.readinessScore) ||
                    a.unit.id - b.unit.id);
            const choice = candidates[0];
            if (!choice) break;
            const currentError = Math.abs(reserveTarget - reserveValue);
            if (reserveIds.size && choice.targetError >= currentError) break;
            reserveIds.add(choice.unit.id);
            reserveValue += choice.value;
        }
        buckets[TASK_GROUP_ROLE.RESERVE] = combat.filter(unit => reserveIds.has(unit.id));

        const available = combat.filter(unit => !reserveIds.has(unit.id));
        const availableValue = available.reduce((sum, unit) => sum + planningUnitValue(unit), 0);
        const shares = planningRoleShares(plan?.kind);
        const unassigned = new Set(available.map(unit => unit.id));
        for (const role of [TASK_GROUP_ROLE.FIXING, TASK_GROUP_ROLE.FLANK]) {
            const target = availableValue * shares[role];
            let assignedValue = 0;
            const candidates = available.slice().sort((a, b) =>
                (planningCombatAffinity(b, role) - planningCombatAffinity(a, role)) ||
                (planningUnitValue(b) - planningUnitValue(a)) ||
                a.id - b.id
            );
            for (const unit of candidates) {
                if (unassigned.size <= 1) break;
                if (!unassigned.has(unit.id) || assignedValue >= target || shares[role] <= 0) continue;
                buckets[role].push(unit);
                unassigned.delete(unit.id);
                assignedValue += planningUnitValue(unit);
            }
        }
        buckets[TASK_GROUP_ROLE.MAIN] = available.filter(unit => unassigned.has(unit.id));

        this.cachedPlanId = plan?.id || null;
        this.cachedUnitSignature = signature;
        this.cachedGroups = Object.values(TASK_GROUP_ROLE)
            .map(role => planningGroup(role, buckets[role]))
            .filter(group => group.unitIds.length > 0);
        return replayClone(this.cachedGroups);
    }
}

function planningGroupPreferredRange(group) {
    let total = 0;
    let count = 0;
    for (const [type, amount] of Object.entries(group.composition || {})) {
        const stats = STATS[Number(type)];
        if (!stats || amount <= 0) continue;
        total += stats.range * amount;
        count += amount;
    }
    return count ? Math.round(total / count) : 100;
}

function planningTaskFor(role, planKind) {
    if (planKind === BATTLE_PLAN_KIND.DISENGAGE) {
        if (role === TASK_GROUP_ROLE.FIXING || role === TASK_GROUP_ROLE.FIRE_SUPPORT) {
            return TASK_CONTRACT_KIND.COVER_WITHDRAWAL;
        }
        return TASK_CONTRACT_KIND.WITHDRAW;
    }
    if (planKind === BATTLE_PLAN_KIND.REGROUP) return TASK_CONTRACT_KIND.REGROUP;
    if (planKind === BATTLE_PLAN_KIND.HOLD && [
        TASK_GROUP_ROLE.MAIN,
        TASK_GROUP_ROLE.FIXING,
        TASK_GROUP_ROLE.FLANK
    ].includes(role)) return TASK_CONTRACT_KIND.HOLD_OBJECTIVE;
    if (role === TASK_GROUP_ROLE.MAIN) {
        return planKind === BATTLE_PLAN_KIND.HOLD
            ? TASK_CONTRACT_KIND.HOLD_OBJECTIVE
            : TASK_CONTRACT_KIND.SEIZE_OBJECTIVE;
    }
    if (role === TASK_GROUP_ROLE.FIXING) return TASK_CONTRACT_KIND.FIX_ENEMY;
    if (role === TASK_GROUP_ROLE.FLANK) return TASK_CONTRACT_KIND.TURN_FLANK;
    if (role === TASK_GROUP_ROLE.FIRE_SUPPORT) return TASK_CONTRACT_KIND.SUPPORT_BY_FIRE;
    if (role === TASK_GROUP_ROLE.RECON) return TASK_CONTRACT_KIND.RECONNOITER;
    if (role === TASK_GROUP_ROLE.SUPPORT) return TASK_CONTRACT_KIND.SUSTAIN_FORCE;
    return TASK_CONTRACT_KIND.REMAIN_IN_RESERVE;
}

function planningFormation(role, planKind) {
    if (role === TASK_GROUP_ROLE.MAIN) {
        return planKind === BATTLE_PLAN_KIND.HOLD ? 'LINE' : 'WEDGE';
    }
    if (role === TASK_GROUP_ROLE.FIXING) return 'LINE';
    if (role === TASK_GROUP_ROLE.FLANK) return 'ECHELON';
    if (role === TASK_GROUP_ROLE.FIRE_SUPPORT) return 'DISPERSED_LINE';
    if (role === TASK_GROUP_ROLE.RECON) return 'SCREEN';
    return 'COLUMN';
}

function planningEngagementRule(role, objective) {
    if (role === TASK_GROUP_ROLE.FIRE_SUPPORT) return 'OBSERVED_TARGETS_ONLY';
    if (role === TASK_GROUP_ROLE.RECON) return 'SELF_DEFENSE_AND_REPORT';
    if (role === TASK_GROUP_ROLE.SUPPORT) return 'SELF_DEFENSE';
    if (role === TASK_GROUP_ROLE.RESERVE) return 'HOLD_FIRE';
    if (objective.kind === 'ESTIMATED_CONTACT') return 'CONFIRM_BEFORE_FIRE';
    if (role === TASK_GROUP_ROLE.FIXING) return 'SUPPRESS_CONFIRMED_CONTACT';
    return 'ENGAGE_CONFIRMED_CONTACT';
}

function planningTempo(role, planKind) {
    if (planKind === BATTLE_PLAN_KIND.DISENGAGE) return 'WITHDRAWAL';
    if (planKind === BATTLE_PLAN_KIND.REGROUP) return 'RAPID_TRANSIT';
    if (role === TASK_GROUP_ROLE.FLANK) return 'RAPID_TRANSIT';
    if (role === TASK_GROUP_ROLE.RECON) return 'STEALTH';
    if (role === TASK_GROUP_ROLE.FIRE_SUPPORT ||
        role === TASK_GROUP_ROLE.SUPPORT ||
        role === TASK_GROUP_ROLE.RESERVE) return 'HOLD';
    if (planKind === BATTLE_PLAN_KIND.HOLD) return 'HOLD';
    return 'COMBAT_ADVANCE';
}

function planningFallbackPoint(controller, origin) {
    return planningSafePoint({
        x: origin.x,
        y: origin.y + (controller.side ? -320 : 320)
    });
}

function planningChooseFlankPoint(objective, origin) {
    const leftDesired = planningClampPoint({ x: objective.x - 420, y: objective.y });
    const rightDesired = planningClampPoint({ x: objective.x + 420, y: objective.y });
    const left = planningSafePoint(leftDesired);
    const right = planningSafePoint(rightDesired);
    const leftCorrection = Math.hypot(left.x - leftDesired.x, left.y - leftDesired.y);
    const rightCorrection = Math.hypot(right.x - rightDesired.x, right.y - rightDesired.y);
    const leftCost = planningRouteCost(origin || objective, left) + leftCorrection / 25;
    const rightCost = planningRouteCost(origin || objective, right) + rightCorrection / 25;
    return rightCost < leftCost ? right : left;
}

function planningContractDestination(controller, group, objective, friendlyCentroid) {
    const origin = group.centroid || friendlyCentroid || objective;
    if (group.role === TASK_GROUP_ROLE.FLANK) return planningChooseFlankPoint(objective, origin);
    if (group.role === TASK_GROUP_ROLE.FIRE_SUPPORT) {
        return planningPointBetween(origin, objective, 0.45);
    }
    if (group.role === TASK_GROUP_ROLE.RECON) {
        return planningPointBetween(origin, objective, 0.72);
    }
    if (group.role === TASK_GROUP_ROLE.SUPPORT) {
        return planningPointBetween(origin, objective, 0.3);
    }
    if (group.role === TASK_GROUP_ROLE.RESERVE) {
        return planningPointBetween(origin, objective, 0.2);
    }
    return planningSafePoint(objective);
}

function planningAbortCondition(role) {
    if (role === TASK_GROUP_ROLE.RECON) {
        return { minStrengthRatio: 0.7, minAmmoRatio: 0.15, maxIsolationDistance: 650, onPlanAbort: true };
    }
    if (role === TASK_GROUP_ROLE.FIRE_SUPPORT || role === TASK_GROUP_ROLE.SUPPORT) {
        return { minStrengthRatio: 0.55, minAmmoRatio: 0.2, maxIsolationDistance: 550, onPlanAbort: true };
    }
    if (role === TASK_GROUP_ROLE.RESERVE) {
        return { minStrengthRatio: 0.65, minAmmoRatio: 0.3, maxIsolationDistance: 450, onPlanAbort: true };
    }
    return { minStrengthRatio: 0.45, minAmmoRatio: 0.2, maxIsolationDistance: 750, onPlanAbort: true };
}

function planningSupportRequests(role, availableRoles) {
    const requests = [];
    if ([TASK_GROUP_ROLE.MAIN, TASK_GROUP_ROLE.FIXING, TASK_GROUP_ROLE.FLANK].includes(role)) {
        if (availableRoles.has(TASK_GROUP_ROLE.FIRE_SUPPORT)) requests.push('FIRE_SUPPORT');
        if (availableRoles.has(TASK_GROUP_ROLE.RECON)) requests.push('RECON_SCREEN');
    }
    if (role === TASK_GROUP_ROLE.FIRE_SUPPORT &&
        availableRoles.has(TASK_GROUP_ROLE.RECON)) requests.push('TARGET_OBSERVATION');
    if (role === TASK_GROUP_ROLE.SUPPORT) requests.push('PROTECTED_ROUTE');
    return requests;
}

class TaskContractPlanner {
    constructor(controller) {
        this.controller = controller;
        this.cachedKey = null;
        this.cachedContracts = [];
    }

    contractKey(plan, objective, groups) {
        const groupSignature = groups
            .map(group => `${group.role}:${group.unitIds.join(',')}`)
            .sort()
            .join('|');
        return [
            plan.id,
            objective.kind,
            objective.contactId ?? '-',
            Math.round(objective.x / 120),
            Math.round(objective.y / 120),
            groupSignature
        ].join(':');
    }

    build(plan, objective, groups, observation) {
        const key = this.contractKey(plan, objective, groups);
        if (key === this.cachedKey) return replayClone(this.cachedContracts);
        const friendlyCentroid = planningFriendlyCentroid(observation) || planningSafePoint(objective);
        const availableRoles = new Set(groups.map(group => group.role));
        this.cachedContracts = groups.map(group => {
            const origin = group.centroid || friendlyCentroid;
            const destination = planningContractDestination(
                this.controller,
                group,
                objective,
                friendlyCentroid
            );
            const route = planningRoutePoints(origin, destination);
            const rallyPoint = route[0] || planningPointBetween(origin, destination, 0.25);
            const phaseLine = route[1] || planningPointBetween(rallyPoint, destination, 0.65);
            const fallbackPosition = planningFallbackPoint(this.controller, origin);
            const task = planningTaskFor(group.role, plan.kind);
            const pursuitLimit = group.role === TASK_GROUP_ROLE.FLANK ? 420 :
                group.role === TASK_GROUP_ROLE.MAIN ? 260 :
                    group.role === TASK_GROUP_ROLE.FIXING ? 120 : 0;
            return {
                id: `${plan.id}:${group.role}`,
                planId: plan.id,
                planKind: plan.kind,
                groupRole: group.role,
                unitIds: group.unitIds.slice(),
                task,
                objective: replayClone(objective),
                destination,
                formation: planningFormation(group.role, plan.kind),
                route,
                engagementRule: planningEngagementRule(group.role, objective),
                preferredRange: planningGroupPreferredRange(group),
                tempo: planningTempo(group.role, plan.kind),
                phaseLine,
                supportRequest: planningSupportRequests(group.role, availableRoles),
                abortCondition: planningAbortCondition(group.role),
                fallbackPosition,
                pursuitLimit,
                initialStrengthValue: group.value,
                issuedAtTick: observation.tick,
                executable: false
            };
        }).sort((a, b) => a.groupRole.localeCompare(b.groupRole));
        this.cachedKey = key;
        return replayClone(this.cachedContracts);
    }
}

class BattleOperationalPlanner {
    constructor(controller) {
        this.controller = controller;
        this.objectiveSelector = new OperationalObjectiveSelector(controller);
        this.forceOrganizer = new ForceOrganizer(controller);
        this.taskContractPlanner = new TaskContractPlanner(controller);
        this.lastPlan = null;
    }

    build(committedPlan, observation, situation) {
        if (!committedPlan || !observation || !situation) {
            this.lastPlan = null;
            return null;
        }
        const objective = this.objectiveSelector.select(committedPlan, observation, situation);
        const taskGroups = this.forceOrganizer.organize(committedPlan, observation, situation);
        const taskContracts = this.taskContractPlanner.build(
            committedPlan,
            objective,
            taskGroups,
            observation
        );
        const assignedIds = taskGroups.flatMap(group => group.unitIds).sort((a, b) => a - b);
        const ownIds = observation.ownUnits.map(unit => unit.id).sort((a, b) => a - b);
        this.lastPlan = {
            planId: committedPlan.id,
            kind: committedPlan.kind,
            generatedAtTick: observation.tick,
            objective,
            taskGroups,
            taskContracts,
            reserveRatioTarget: planningRound(planningReserveRatio(situation, committedPlan.kind)),
            allocationComplete: assignedIds.length === ownIds.length &&
                assignedIds.every((id, index) => id === ownIds[index]),
            contractsComplete: taskContracts.length === taskGroups.length &&
                taskContracts.every(contract => contract.unitIds.length > 0),
            issuesOrders: false
        };
        return this.lastPlan;
    }
}
