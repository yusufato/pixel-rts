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
    // SEKTÖR-KOMUTA: "kutsal ihtiyat" — bir sektöre bağlanmaz, karar-noktasında sürülür (analist %20-25). CONCENTRATE'i geçersizler.
    if (typeof BATTLE_SECTOR_COMMAND !== 'undefined' && BATTLE_SECTOR_COMMAND === true) {
        return situation?.role === BATTLE_ROLE.DEFENDER ? 0.25 : 0.20;
    }
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

function planningRoleShares(planKind, defenderWide) {
    // INTEL4 GENİŞ-CEPHE SAVUNMA (analist+kullanıcı: aoe600-tepe düşürmenin GERÇEK yolu): SAVUNAN kuvveti tehdit-sektörüne
    // YIĞMAK yerine 3 sektöre ~eşit-böl → her sektör ~1/3 → yerel-yoğunluk-tepesi 15→~5-6. (Konsantrasyon-tavizi: ihtiyat
    // tehdit-sektörünü takviye eder.) Kullanıcının ~%0.10-geniş-cephe savunma-stilinin AI karşılığı.
    if (defenderWide) {
        return { [TASK_GROUP_ROLE.MAIN]: 0.40, [TASK_GROUP_ROLE.FIXING]: 0.34, [TASK_GROUP_ROLE.FLANK]: 0.26 };
    }
    // SEKTÖR-KOMUTA: Schwerpunkt dağılımı — MAIN ana-çaba (bir sektöre), FIXING ekonomi-of-force (geniş cephe), FLANK yardımcı.
    if (typeof BATTLE_SECTOR_COMMAND !== 'undefined' && BATTLE_SECTOR_COMMAND === true) {
        return { [TASK_GROUP_ROLE.MAIN]: 0.55, [TASK_GROUP_ROLE.FIXING]: 0.30, [TASK_GROUP_ROLE.FLANK]: 0.15 };
    }
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
            const r = battleUnitRoleBucket(unit.type);   // roleTags/category-güdümlü (25-birim)
            if (r === TASK_GROUP_ROLE.RECON) buckets[TASK_GROUP_ROLE.RECON].push(unit);
            else if (r === TASK_GROUP_ROLE.FIRE_SUPPORT) buckets[TASK_GROUP_ROLE.FIRE_SUPPORT].push(unit);
            else if (r === TASK_GROUP_ROLE.SUPPORT) buckets[TASK_GROUP_ROLE.SUPPORT].push(unit);
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
        // INTEL4 geniş-cephe savunma (gated 'deblob'): SAVUNAN → eşit-böl (yerel-yoğunluk-tepesini düşür)
        const _DEFW = (typeof BATTLE_ROLE !== 'undefined') ? BATTLE_ROLE.DEFENDER : 'defender';
        const _defenderWide = situation && situation.role === _DEFW &&
            typeof battleDelta === 'function' && this.controller && battleDelta(this.controller.side, 'deblob');
        const shares = planningRoleShares(plan?.kind, _defenderWide);
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

function planningFormation(role, planKind, defenderSpread, areaAlphaThreat, defenseXwide) {
    // FAZ3 'defense' (analist Suçlu-2): SAVUNAN ana/sabitleme → TAM-CEPHE garnizon (≥600px yerel-ayrım, L≤~6). 'deblob'-WIDE'dan güçlü.
    if (defenseXwide && (role === TASK_GROUP_ROLE.MAIN || role === TASK_GROUP_ROLE.FIXING)) return 'DEFENSE_GRID_XWIDE';
    // INTEL4 'deblob' (analist #4): SAVUNAN ana/sabitleme grupları GENİŞ ızgara → yumak yerine savunma-hattı.
    // areaAlphaThreat (TEHDİT-PROFİLİ 'profile' reaksiyonu): balistik/topçu teyit → DAHA geniş ızgara (aoe600'de ≤2-3).
    if (defenderSpread && (role === TASK_GROUP_ROLE.MAIN || role === TASK_GROUP_ROLE.FIXING)) return areaAlphaThreat ? 'DEFENSE_GRID_WIDE' : 'DEFENSE_GRID';
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

// DEBRIEF (arazi): ön-hat/tutan gruplar ORMAN-örtüsü arasın (+3 zırh + gizlenme/pusu). Topçu/keşif/flank HARİÇ
// (topçu/keşif LOS/görüş ister, flank hız ister). Az yarıçap → yalnız ZATEN yakın ormana snap (saldırıyı saptırmaz).
function planningCoverPoint(point, role) {
    if (typeof terrainFeatures === 'undefined' || !Array.isArray(terrainFeatures) || typeof TERRAIN === 'undefined') return point;
    if (role === TASK_GROUP_ROLE.FIRE_SUPPORT || role === TASK_GROUP_ROLE.RECON || role === TASK_GROUP_ROLE.FLANK) return point;
    let best = null, bestD = 170;
    for (const t of terrainFeatures) {
        if (t.type !== TERRAIN.FOREST) continue;
        const d = Math.hypot(t.x - point.x, t.y - point.y);
        if (d < bestD) { bestD = d; best = t; }
    }
    if (!best) return point;
    const dx = best.x - point.x, dy = best.y - point.y, dl = Math.hypot(dx, dy) || 1;
    const pull = Math.min(bestD, (best.r || 60) * 0.6);   // orman kenarına gir (tam ortaya gömülme)
    return planningSafePoint({ x: point.x + (dx / dl) * pull, y: point.y + (dy / dl) * pull });
}

// SEKTÖR-KOMUTA (anti-blob): cephe 3 x-band'a bölünür (left/center/right, situationSectorForX ile IDENTIK eşik).
const SECTOR_NAMES = ['left', 'center', 'right'];
function sectorBand(name) {
    if (name === 'left') return { xMin: 0, xMax: WORLD_W / 3 };
    if (name === 'right') return { xMin: WORLD_W * 2 / 3, xMax: WORLD_W };
    return { xMin: WORLD_W / 3, xMax: WORLD_W * 2 / 3 };
}
function sectorCenterX(name) {
    if (name === 'left') return WORLD_W / 6;
    if (name === 'right') return WORLD_W * 5 / 6;
    return WORLD_W / 2;
}
// DÜŞMAN-UYARLAMALI KONSANTRASYON (anti-blob AMA gücü koru): ana-çaba = düşmanın EN ÇOK olduğu sektör (dövüş orada);
// MAIN+FIXING oraya YIĞILIR (~%85, konsantrasyon korunur), FLANK bitişikten SARAR (pincer), RECON üçüncüyü perdeler.
// Boş sektöre kütle GÖNDERMEZ (yoğunlaşan rakibe karşı dağılmayı önler). group.sector davranış-nötr ek-alan.
function assignSectors(taskGroups, situation, controller) {
    if (!(typeof BATTLE_SECTOR_COMMAND !== 'undefined' && BATTLE_SECTOR_COMMAND)) return;
    const st = controller && (controller.sectorState || (controller.sectorState = { mainSector: null, mainSectorLockUntilTick: 0, reserveCommittedTick: -1, mainEffortShiftCount: 0 }));
    // Aday ana-çaba = düşman kütlesinin en çok olduğu sektör. Temas yoksa center. Tiebreak: SECTOR_NAMES sırası.
    let candidate = 'center', bestEnemy = 0;
    if (situation && situation.sectors) {
        for (const name of SECTOR_NAMES) {
            const s = situation.sectors[name];
            if (s && s.enemyValue > bestEnemy) { bestEnemy = s.enemyValue; candidate = name; }
        }
    }
    // NOT (FAZ-T2 ölçümü): schwerpunkt'u "en-zayıf düşman sektörü"ne kaydırma DENENDİ → yapısal NO-OP. Bu harita tek-eksenli
    // cephe-çatışması: weakestEnemySector (en-yüksek dost/düşman oranı) DAİMA = düşman-kütlesinin-olduğu-sektör = saldıranın-zaten-
    // yığıldığı center. Kaçılacak açık-flank yok → kaydırma byte-aynı. Erime maneuver-değil CEPHEDEN-SÖMÜRÜ sorunu (T2-fire/T3/T4).
    // FAZ 4 HİSTEREZİS: mevcut ana-çaba 70s kilitli kalır (titreme/kuvvet-savurma önlenir); ancak kilit bitince VEYA
    // düşman belirgin-kaydıysa (aday-sektör mevcudun 1.5×'i) kayar. Deterministik (SIM.tick, RNG yok).
    const now = (typeof SIM !== 'undefined' && SIM.tick) || 0;
    let mainSector = (st && SECTOR_NAMES.includes(st.mainSector)) ? st.mainSector : candidate;
    if (candidate !== mainSector) {
        const curVal = (situation && situation.sectors && situation.sectors[mainSector] && situation.sectors[mainSector].enemyValue) || 0;
        const strongShift = bestEnemy > curVal * 1.5;
        if (now >= ((st && st.mainSectorLockUntilTick) || 0) || strongShift) mainSector = candidate;
    }
    if (st && st.mainSector !== mainSector) { st.mainSector = mainSector; st.mainSectorLockUntilTick = now + 1400; st.mainEffortShiftCount = (st.mainEffortShiftCount || 0) + 1; }
    const adj = mainSector === 'right' ? 'center' : (mainSector === 'center' ? 'left' : 'center');   // ana-çabaya bitişik
    const third = SECTOR_NAMES.find(s => s !== mainSector && s !== adj) || adj;
    const DEF = (typeof BATTLE_ROLE !== 'undefined') ? BATTLE_ROLE.DEFENDER : 'defender';
    const isDefender = situation && situation.role === DEF;
    // ASSEMBLY-AREA DOKTRİNİ (analist anti-yumak): SAVUNAN her zaman YAYILIR (geniş hat). SALDIRAN hazırlıkta (STRIKE-DIŞI)
    // YAYILIR (assembly, alan-ateşine=ÇNRA mezar sunmaz), yalnız HÜCUM anında (STRIKE) konsantre olur.
    const striking = situation && situation.operationalPosture && situation.operationalPosture.stance === 'STRIKE';
    const spread = isDefender || !striking;
    for (const g of taskGroups) {
        if (spread) {
            // GENİŞ HAT / ASSEMBLY: grupları AYRI sektörlere yay (yumak→alan-ateşi mezarı çözülür)
            if (g.role === TASK_GROUP_ROLE.MAIN) g.sector = mainSector;
            else if (g.role === TASK_GROUP_ROLE.FIXING) g.sector = adj;
            else if (g.role === TASK_GROUP_ROLE.FLANK) g.sector = third;
            else if (g.role === TASK_GROUP_ROLE.RECON) g.sector = third;
            else g.sector = null;
        } else {
            // SALDIRAN STRIKE: enemy-adaptif KONSANTRASYON (kütle düşman-sektörüne + FLANK ±420 pincer) — hücum anı
            if (g.role === TASK_GROUP_ROLE.MAIN || g.role === TASK_GROUP_ROLE.FIXING || g.role === TASK_GROUP_ROLE.FLANK) g.sector = mainSector;
            else if (g.role === TASK_GROUP_ROLE.RECON) g.sector = adj;
            else g.sector = null;
        }
    }
}
function planningContractDestination(controller, group, objective, friendlyCentroid) {
    const origin = group.centroid || friendlyCentroid || objective;
    // SEKTÖR-KOMUTA: grup kendi sektörünün ORTASINA nişan alır (tek-global objektif yerine) → gruplar 3 ayrı x'e yayılır.
    let aim = objective;
    let _defDeep = false;   // FAZ3 omurga-geri: savunan ateş-destek/AA/lojistik düşman-zarfı DIŞINDA (dest'te derin tutulur)
    if (typeof BATTLE_SECTOR_COMMAND !== 'undefined' && BATTLE_SECTOR_COMMAND && group.sector) {
        let ax = sectorCenterX(group.sector), ay = objective.y;
        // KONUŞLANMA (kullanıcı): STRIKE DEĞİLKEN yığılma yerine kendi bölgesinde DAĞINIK savunma-konuşlanması.
        const sit = controller && controller.lastSituation;
        const stance = sit && sit.operationalPosture && sit.operationalPosture.stance;
        const isAtt = !sit || sit.role !== (typeof BATTLE_ROLE !== 'undefined' ? BATTLE_ROLE.DEFENDER : 'defender');
        if (stance && stance !== 'STRIKE') {
            // FAZ3 'defense'-delta (analist Suçlu-2): SAVUNAN ana/sabitleme garnizonu TAM-CEPHE merkezine oturur (sektör-kenarına
            // sıkışıp XWIDE-yayılımı dünya-sınırına çarpmasın) → 600px-ızgara cepheyi baştan-sona kaplar (L≤~6). MAIN sola, FIXING sağa hafif kayık.
            const _defX = !isAtt && typeof battleDelta === 'function' && battleDelta(controller.side, 'defense');
            if (_defX && (group.role === TASK_GROUP_ROLE.MAIN || group.role === TASK_GROUP_ROLE.FIXING)) {
                ax = WORLD_W / 2 + (group.role === TASK_GROUP_ROLE.MAIN ? -120 : 120);
            }
            // MAIN/FIXING sektör içinde AYRI x → cepheyi kapla (aynı noktaya blob'lanma). STRIKE'ta tekrar yığılır (3/3 korunur).
            else if (group.role === TASK_GROUP_ROLE.MAIN) ax -= 240;
            else if (group.role === TASK_GROUP_ROLE.FIXING) ax += 240;
            // y-DERİNLİK (kapı-kapalı): SAVUNAN kendi-hattına çekilir; SALDIRAN ise ANALİST-FIX (POSITION'da erime):
            // toplanma-bölgesi düşman ateş-zarfından GERİDE (temas hattında değil) → STRIKE'a kadar hayatta kalır, STRIKE'ta ileri.
            const homeY = controller.side ? WORLD_H * 0.30 : WORLD_H * 0.70;
            if (!isAtt) ay = objective.y * 0.4 + homeY * 0.6;   // savunma-hattı (mostly geri)
            else ay = objective.y * 0.42 + homeY * 0.58;        // ANALİST-FIX2: saldıran assembly ATEŞ-ZARFI DIŞINA (~%58 geri) — STRIKE-öncesi erime biter, STRIKE'ta ileri-hücum
            // FAZ3 OMURGA-GERİ (analist 42.7-dersi): SAVUNAN ateş-desteği/AA/lojistik en-uzun düşman doğrudan-ateş-zarfı(~675)+tampon
            // DIŞINDA → topçu/SAM TD menziline girip 50s'de sökülmesin. Bu roller tam-derinliğe (homeY) çekilir.
            if (_defX && (group.role === TASK_GROUP_ROLE.FIRE_SUPPORT || group.role === TASK_GROUP_ROLE.SUPPORT)) { ay = homeY; _defDeep = true; }
        }
        aim = { x: ax, y: ay };
    }
    objective = aim;
    let dest;
    if (group.role === TASK_GROUP_ROLE.FLANK) dest = planningChooseFlankPoint(objective, origin);
    else if (group.role === TASK_GROUP_ROLE.FIRE_SUPPORT) dest = _defDeep ? planningSafePoint(objective) : planningPointBetween(origin, objective, 0.55);   // savunan: derin-mevzi; saldıran: erken-destek
    else if (group.role === TASK_GROUP_ROLE.RECON) dest = planningPointBetween(origin, objective, 0.72);          // keşif ÖNDE tarar+gözcülük eder (topçunun 0.55'inin önünde → dolaylı ateşe göz olur), ama hedefe tam dalmaz
    else if (group.role === TASK_GROUP_ROLE.SUPPORT) dest = _defDeep ? planningSafePoint(objective) : planningPointBetween(origin, objective, 0.3);
    else if (group.role === TASK_GROUP_ROLE.RESERVE) dest = planningPointBetween(origin, objective, 0.2);
    else dest = planningSafePoint(objective);
    return planningCoverPoint(dest, group.role);   // arazi: uygun roller orman-örtüsüne çekilir
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
            // TEHDİT-PROFİLİ reaksiyon-girdileri (savunan-yayılma + areaAlpha-teyit → daha-geniş ızgara)
            const _defSpread = (typeof battleDelta === 'function' && this.controller && battleDelta(this.controller.side, 'deblob') &&
                this.controller.lastSituation && this.controller.lastSituation.role === (typeof BATTLE_ROLE !== 'undefined' ? BATTLE_ROLE.DEFENDER : 'defender'));
            const _areaAlpha = _defSpread && (typeof battleThreatActive === 'function') && battleThreatActive(this.controller, 'areaAlpha');
            if (_areaAlpha && typeof battleProfileMarkReaction === 'function') battleProfileMarkReaction(this.controller, 'areaAlpha', 'grid_wide', SIM.tick);
            // FAZ3 'defense'-delta (analist Suçlu-2): SAVUNAN → tam-cephe garnizon (XWIDE). deblob'dan bağımsız gated anahtar.
            const _defXwide = (typeof battleDelta === 'function' && this.controller && battleDelta(this.controller.side, 'defense') &&
                this.controller.lastSituation && this.controller.lastSituation.role === (typeof BATTLE_ROLE !== 'undefined' ? BATTLE_ROLE.DEFENDER : 'defender'));
            return {
                id: `${plan.id}:${group.role}`,
                planId: plan.id,
                planKind: plan.kind,
                groupRole: group.role,
                unitIds: group.unitIds.slice(),
                task,
                objective: replayClone(objective),
                destination,
                formation: planningFormation(group.role, plan.kind, _defSpread, _areaAlpha, _defXwide),
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

    // FAZ 2d: bu tikin rol-gruplarını geçen tikin gruplarıyla birim-ID Jaccard örtüşmesiyle eşle → kararlı groupId.
    // Deterministik (RNG yok). groupId sim'i etkilemez (yalnız ek alan); Faz 3'te screen-grubu kimliği için tüketilir.
    assignPersistentGroupIds(taskGroups) {
        const prev = this._groupRegistry || [];
        const used = new Set();
        for (const g of taskGroups) {
            const ids = new Set(g.unitIds);
            let best = null, bestJ = 0.34;
            for (const p of prev) {
                if (used.has(p.groupId) || p.role !== g.role) continue;
                let inter = 0; for (const id of p.unitIds) if (ids.has(id)) inter++;
                const uni = (p.unitIds.length + g.unitIds.length - inter) || 1;
                const j = inter / uni;
                if (j > bestJ) { bestJ = j; best = p; }
            }
            if (best) { g.groupId = best.groupId; used.add(best.groupId); }
            else g.groupId = (this._nextGroupId = (this._nextGroupId || 0) + 1);
        }
        this._groupRegistry = taskGroups.map(g => ({ groupId: g.groupId, role: g.role, unitIds: g.unitIds.slice() }));
    }

    build(committedPlan, observation, situation) {
        if (!committedPlan || !observation || !situation) {
            this.lastPlan = null;
            return null;
        }
        const objective = this.objectiveSelector.select(committedPlan, observation, situation);
        const taskGroups = this.forceOrganizer.organize(committedPlan, observation, situation);
        this.assignPersistentGroupIds(taskGroups);   // FAZ 2d: kalıcı groupId (plan değişse de grup kimliği korunur)
        assignSectors(taskGroups, situation, this.controller);   // SEKTÖR-KOMUTA: muharip grupları sektörlere ata (group.sector)
        const taskContracts = this.taskContractPlanner.build(
            committedPlan,
            objective,
            taskGroups,
            observation
        );
        for (const c of taskContracts) { const g = taskGroups.find(tg => tg.role === c.groupRole); if (g) { c.groupId = g.groupId; c.sector = g.sector; } }
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
