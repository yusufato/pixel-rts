// Görev sözleşmelerini safhalı ve tarafsız savaş emirlerine çevirir.
// Hedef doğrulaması yalnızca controller observation snapshot'ından yapılır.

const TASK_EXECUTION_PHASE = Object.freeze({
    ASSEMBLE: 'ASSEMBLE',
    ADVANCE: 'ADVANCE',
    ACTION: 'ACTION',
    HOLD: 'HOLD',
    WITHDRAW: 'WITHDRAW',
    COMPLETE: 'COMPLETE'
});

const TASK_ORDER_REFRESH_TICKS = 60;
const TASK_ACTION_REFRESH_TICKS = 30;
const TASK_ARRIVAL_RADIUS = 95;
const OPERATION_EXECUTION_PHASE = Object.freeze({
    ASSEMBLE: 'ASSEMBLE',
    FIRE_WINDOW: 'FIRE_WINDOW',
    ASSAULT: 'ASSAULT',
    EXPLOIT: 'EXPLOIT'
});
const OPERATION_ASSEMBLE_TIMEOUT_TICKS = Math.round(18 / BATTLE_TICK_SEC);
const OPERATION_FIRE_MIN_TICKS = Math.round(8 / BATTLE_TICK_SEC);
const OPERATION_FIRE_MAX_TICKS = Math.round(14 / BATTLE_TICK_SEC);
const OPERATION_ASSAULT_TO_EXPLOIT_TICKS = Math.round(18 / BATTLE_TICK_SEC);
const OPERATION_COMBAT_ROLES = new Set([
    TASK_GROUP_ROLE.MAIN,
    TASK_GROUP_ROLE.FIXING,
    TASK_GROUP_ROLE.FLANK
]);

function executionRound(value) {
    return Math.round(value * 100) / 100;
}

function executionSafePoint(point) {
    const x = Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS, point.x));
    const y = Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS, point.y));
    if (typeof nearestPassable !== 'function') return { x: executionRound(x), y: executionRound(y) };
    const safe = nearestPassable(x, y, 30);
    return {
        x: executionRound(Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS, safe.x))),
        y: executionRound(Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS, safe.y)))
    };
}

function executionUnits(contract, observation) {
    const ids = new Set(contract.unitIds || []);
    return (observation?.ownUnits || [])
        .filter(unit => ids.has(unit.id))
        .sort((a, b) => a.id - b.id);
}

function executionCentroid(units) {
    if (!units.length) return null;
    return {
        x: units.reduce((sum, unit) => sum + unit.x, 0) / units.length,
        y: units.reduce((sum, unit) => sum + unit.y, 0) / units.length
    };
}

function executionArrived(units, point, radius = TASK_ARRIVAL_RADIUS) {
    if (!units.length || !point) return false;
    const centroid = executionCentroid(units);
    return Math.hypot(centroid.x - point.x, centroid.y - point.y) <= radius;
}

function executionFormationOffset(index, count, formation, forwardX, forwardY) {
    const sideX = -forwardY;
    const sideY = forwardX;
    const centered = index - (count - 1) / 2;
    if (formation === 'COLUMN') {
        return { x: -forwardX * index * 48, y: -forwardY * index * 48 };
    }
    if (formation === 'WEDGE') {
        const row = Math.ceil(index / 2);
        const sign = index === 0 ? 0 : (index % 2 ? -1 : 1);
        return {
            x: -forwardX * row * 45 + sideX * sign * row * 42,
            y: -forwardY * row * 45 + sideY * sign * row * 42
        };
    }
    if (formation === 'ECHELON') {
        return {
            x: -forwardX * index * 32 + sideX * index * 48,
            y: -forwardY * index * 32 + sideY * index * 48
        };
    }
    const spacing = formation === 'DISPERSED_LINE' ? 82 : formation === 'SCREEN' ? 68 : 50;
    return { x: sideX * centered * spacing, y: sideY * centered * spacing };
}

function executionDistinctDestination(point, occupied, seed = 0) {
    const first = executionSafePoint(point);
    const free = candidate => occupied.every(other =>
        Math.hypot(candidate.x - other.x, candidate.y - other.y) >= 44
    );
    if (free(first)) return first;

    // nearestPassable, engel kenarında birden fazla formasyon yuvasını aynı
    // geçilebilir hücreye katlayabilir. Deterministik halka araması her birliğe
    // ayrı bir yuva vererek yığılmayı emir aşamasında engeller.
    for (let ring = 1; ring <= 8; ring++) {
        const radius = ring * 46;
        for (let step = 0; step < 12; step++) {
            const angle = ((step + seed) % 12) * (Math.PI * 2 / 12);
            const candidate = executionSafePoint({
                x: point.x + Math.cos(angle) * radius,
                y: point.y + Math.sin(angle) * radius
            });
            if (free(candidate)) return candidate;
        }
    }
    return first;
}

function executionMoveOrder(contract, units, point, reason) {
    const centroid = executionCentroid(units) || point;
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    const distance = Math.hypot(dx, dy) || 1;
    const forwardX = dx / distance;
    const forwardY = dy / distance;
    const occupied = [];
    // MENZİL-KATMANLI KOL (kombine kol): KISA-menzil ÖNE (düşük index=ön slot), UZUN-menzil ARKAYA.
    // → MBT/piyade önde temas eder, AT/TD/topçu arkadan üzerinden ateşler. Deterministik (id-tiebreak).
    const ordered = units.slice().sort((a, b) => {
        const ra = (typeof STATS !== 'undefined' && STATS[a.type]) ? (STATS[a.type].range || 0) : 0;
        const rb = (typeof STATS !== 'undefined' && STATS[b.type]) ? (STATS[b.type].range || 0) : 0;
        return ra - rb || a.id - b.id;
    });
    const destinations = ordered.map((unit, index) => {
        const offset = executionFormationOffset(
            index,
            units.length,
            contract.formation,
            forwardX,
            forwardY
        );
        const destination = executionDistinctDestination({
            x: point.x + offset.x,
            y: point.y + offset.y
        }, occupied, unit.id);
        occupied.push(destination);
        return { id: unit.id, x: destination.x, y: destination.y };
    });
    return {
        kind: BATTLE_ORDER_KIND.MOVE,
        unitIds: units.map(unit => unit.id),
        destinations,
        reason
    };
}

function executionHoldOrder(contract, units, reason) {
    return {
        kind: BATTLE_ORDER_KIND.HOLD,
        unitIds: units.map(unit => unit.id),
        reason: `${reason}:${contract.groupRole}`
    };
}

function executionContactDistanceToUnits(contact, units) {
    let distance = Infinity;
    for (const unit of units || []) {
        distance = Math.min(distance, Math.hypot(contact.x - unit.x, contact.y - unit.y));
    }
    return distance;
}

function executionVisibleTarget(contract, units, observation, options = {}) {
    const visible = (observation?.contacts || []).filter(contact => contact.visible);
    if (!visible.length) return null;
    const centroid = executionCentroid(units);
    if (!centroid) return null;
    const candidates = visible.map(contact => ({
        contact,
        unitDistance: executionContactDistanceToUnits(contact, units),
        centroidDistance: Math.hypot(contact.x - centroid.x, contact.y - centroid.y),
        objectiveDistance: Math.hypot(
            contact.x - contract.objective.x,
            contact.y - contract.objective.y
        )
    })).filter(item =>
        item.unitDistance <= (options.maxUnitDistance ?? Infinity)
    );
    if (!candidates.length) return null;

    // ORTAK FOCUS-FIRE: operasyon tek bir öncelikli hedef seçtiyse ve o hedef bu grubun menzilindeyse, HERKES ona
    // yüklensin → dağınık tek-tek vuruş yerine konsantre yıkım (insanın kazanma tarzı; "kağıtta değil mermide konsantrasyon").
    if (options.focusTargetId != null) {
        const focus = candidates.find(item => item.contact.id === options.focusTargetId);
        if (focus) return focus.contact;
    }

    const nearestDistance = Math.min(...candidates.map(item => item.unitDistance));
    const localBand = options.localBand ?? Math.max(140, contract.pursuitLimit || 0);
    const localCandidates = candidates.filter(item =>
        item.unitDistance <= nearestDistance + localBand
    );
    const healthPriority = contact =>
        contact.healthBand === 'CRITICAL' ? 32 :
            contact.healthBand === 'DAMAGED' ? 14 : 0;
    candidates.sort((a, b) =>
        (
            a.unitDistance +
            a.centroidDistance * 0.12 +
            a.objectiveDistance * 0.04 -
            (a.contact.id === contract.objective.contactId ? 35 : 0) -
            healthPriority(a.contact)
        ) -
        (
            b.unitDistance +
            b.centroidDistance * 0.12 +
            b.objectiveDistance * 0.04 -
            (b.contact.id === contract.objective.contactId ? 35 : 0) -
            healthPriority(b.contact)
        ) ||
        (b.contact.confidence - a.contact.confidence) ||
        a.contact.id - b.contact.id
    );
    localCandidates.sort((a, b) =>
        candidates.indexOf(a) - candidates.indexOf(b)
    );
    return localCandidates[0]?.contact || null;
}

function executionSelfDefenseTarget(contract, units, observation, options = {}) {
    const engagementFactor = Math.max(1, options.engagementFactor || 1.08);
    const defensiveRange = Math.max(
        105,
        (contract.preferredRange || 100) * engagementFactor
    );
    return executionVisibleTarget(contract, units, observation, {
        maxUnitDistance: defensiveRange,
        localBand: 90,
        focusTargetId: options.focusTargetId   // ortak focus'u ilet (menzildeyse herkes aynı hedefe)
    });
}

function executionAttackOrder(contract, units, target) {
    return {
        kind: BATTLE_ORDER_KIND.ATTACK,
        unitIds: units.map(unit => unit.id),
        targetId: target.id,
        reason: `TASK:${contract.id}:VISIBLE_CONTACT`
    };
}

function executionSelfDefenseAttackOrder(contract, units, target, options = {}) {
    const engagementFactor = Math.max(1, options.engagementFactor || 1.08);
    const firingUnits = units.filter(unit => {
        const range = STATS[unit.type]?.range || contract.preferredRange || 100;
        return Math.hypot(target.x - unit.x, target.y - unit.y) <=
            range * engagementFactor;
    });
    return firingUnits.length
        ? executionAttackOrder(contract, firingUnits, target)
        : null;
}

function executionExploitSearchPoint(contract, side, sweepIndex = 0) {
    // Eski temasın koordinatını tarama merkezi yapmak kuvvetin öldürdüğü ilk
    // hedefin etrafında sonsuza kadar dönmesine yol açıyordu. Temas yoksa
    // aranan şey tek bir birlik değil, savunma bölgesinin tamamıdır.
    const base = typeof battleObjectiveForSide === 'function'
        ? battleObjectiveForSide(side)
        : { x: WORLD_W * 0.5, y: side ? WORLD_H * 0.76 : WORLD_H * 0.24 };
    const forward = side ? 1 : -1;
    const patterns = {
        [TASK_GROUP_ROLE.MAIN]: [
            [0, 150], [-420, 240], [420, 240],
            [-700, 340], [700, 340], [0, 460]
        ],
        [TASK_GROUP_ROLE.FIXING]: [
            [-620, 130], [-260, 250], [260, 350], [620, 430]
        ],
        [TASK_GROUP_ROLE.FLANK]: [
            [620, 130], [760, 270], [360, 420],
            [-360, 420], [-760, 270]
        ],
        [TASK_GROUP_ROLE.RECON]: [
            [-820, 230], [820, 230], [0, 520]
        ],
        [TASK_GROUP_ROLE.RESERVE]: [
            [0, 80], [-360, 260], [360, 260], [0, 440]
        ]
    };
    const rolePattern = patterns[contract.groupRole] || patterns[TASK_GROUP_ROLE.MAIN];
    const index = Math.max(0, sweepIndex | 0) % rolePattern.length;
    const offset = rolePattern[index];
    return executionSafePoint({
        x: base.x + offset[0],
        y: base.y + offset[1] * forward
    });
}

function executionGroupReadiness(contract, units, friendlyCentroid) {
    const currentValue = units.reduce((sum, unit) =>
        sum + (STATS[unit.type]?.cost || 0) * Math.max(0, Math.min(1, unit.hpRatio)), 0);
    const initialValue = Math.max(1, contract.initialStrengthValue || currentValue);
    const ammo = units.length
        ? units.reduce((sum, unit) => sum + unit.ammoRatio, 0) / units.length
        : 0;
    const centroid = executionCentroid(units);
    const isolation = centroid && friendlyCentroid
        ? Math.hypot(centroid.x - friendlyCentroid.x, centroid.y - friendlyCentroid.y)
        : 0;
    return {
        strengthRatio: currentValue / initialValue,
        ammoRatio: ammo,
        isolation
    };
}

function executionAbortReason(contract, units, observation) {
    if (!units.length) return 'GROUP_ELIMINATED';
    if (contract.task === TASK_CONTRACT_KIND.WITHDRAW ||
        contract.task === TASK_CONTRACT_KIND.COVER_WITHDRAWAL) return null;
    const friendlyCentroid = executionCentroid(observation?.ownUnits || []);
    const readiness = executionGroupReadiness(contract, units, friendlyCentroid);
    const condition = contract.abortCondition || {};
    if (readiness.strengthRatio < (condition.minStrengthRatio || 0)) return 'STRENGTH_COLLAPSE';
    if (readiness.ammoRatio < (condition.minAmmoRatio || 0)) return 'AMMUNITION_LOW';
    // Köprü/boğaz geçişinde öncü grup doğal olarak ordunun geometrik
    // merkezinden uzaklaşır. Salt mesafe yüzünden sağlıklı bir taarruzu iptal
    // etmek, geçidi bulan bütün birlikleri başlangıç hattına geri gönderiyordu.
    // İzolasyon ancak grup aynı zamanda anlamlı ölçüde yıpranmışsa aborttur.
    if (readiness.isolation > (condition.maxIsolationDistance || Infinity) &&
        readiness.strengthRatio < 0.72) return 'GROUP_ISOLATED';
    return null;
}

class TaskExecutionManager {
    constructor(controller) {
        this.controller = controller;
        this.states = new Map();
        this.transitionHistory = [];
        this.operation = null;
        this.operationHistory = [];
        this.lastFireWindowTick = -Infinity;
        this.lastTelemetry = null;
    }

    coordinatedPlan(operationalPlan) {
        const role = this.controller?.lastSituation?.role;
        return role === BATTLE_ROLE.ATTACKER && [
            BATTLE_PLAN_KIND.FIRE_PREPARATION,
            BATTLE_PLAN_KIND.MAIN_ATTACK,
            BATTLE_PLAN_KIND.FIX_AND_FLANK
        ].includes(operationalPlan?.kind);
    }

    startOperation(operationalPlan, observation, tick) {
        this.operation = {
            planId: operationalPlan.planId,
            planKind: operationalPlan.kind,
            phase: OPERATION_EXECUTION_PHASE.ASSEMBLE,
            phaseStartedTick: tick,
            startedTick: tick,
            enemyValueAtStart: observation.estimatedEnemyValue || 0,
            fireEnemyValue: null,
            preparationOnly: operationalPlan.kind === BATTLE_PLAN_KIND.FIRE_PREPARATION,
            readyRatio: 0,
            transitionReason: 'OPERATION_STARTED'
        };
        this.operationHistory.push({
            tick,
            planId: operationalPlan.planId,
            previous: null,
            current: OPERATION_EXECUTION_PHASE.ASSEMBLE,
            reason: 'OPERATION_STARTED'
        });
        if (this.operationHistory.length > 120) this.operationHistory.shift();
    }

    transitionOperation(phase, tick, reason, observation) {
        if (!this.operation || this.operation.phase === phase) return;
        const previous = this.operation.phase;
        this.operation.phase = phase;
        this.operation.phaseStartedTick = tick;
        this.operation.transitionReason = reason;
        if (phase === OPERATION_EXECUTION_PHASE.FIRE_WINDOW) {
            this.operation.fireEnemyValue = observation.estimatedEnemyValue || 0;
        }
        if (phase === OPERATION_EXECUTION_PHASE.ASSAULT) {
            for (const state of this.states.values()) {
                if (state.phase === TASK_EXECUTION_PHASE.WITHDRAW ||
                    state.phase === TASK_EXECUTION_PHASE.COMPLETE) continue;
                state.phase = TASK_EXECUTION_PHASE.ADVANCE;
                state.waypointIndex = Math.max(1, state.waypointIndex || 0);
                state.lastOrderTick = -Infinity;
                state.lastOrderKind = null;
            }
        }
        this.operationHistory.push({
            tick,
            planId: this.operation.planId,
            previous,
            current: phase,
            reason
        });
        if (this.operationHistory.length > 120) this.operationHistory.shift();
    }

    assemblyReadyRatio(operationalPlan, observation) {
        const contracts = operationalPlan.taskContracts.filter(contract =>
            OPERATION_COMBAT_ROLES.has(contract.groupRole)
        );
        if (!contracts.length) return 1;
        let ready = 0;
        let total = 0;
        for (const contract of contracts) {
            const units = executionUnits(contract, observation);
            const weight = Math.max(1, contract.initialStrengthValue || units.length);
            total += weight;
            if (executionArrived(units, contract.route?.[0], 135)) ready += weight;
        }
        return total > 0 ? ready / total : 1;
    }

    updateOperation(operationalPlan, observation, tick) {
        if (!this.coordinatedPlan(operationalPlan)) {
            this.operation = null;
            return null;
        }
        if (!this.operation || this.operation.planId !== operationalPlan.planId) {
            this.startOperation(operationalPlan, observation, tick);
        }
        const operation = this.operation;
        const phaseAge = tick - operation.phaseStartedTick;
        if (operation.phase === OPERATION_EXECUTION_PHASE.ASSEMBLE) {
            operation.readyRatio = this.assemblyReadyRatio(operationalPlan, observation);
            const ready = operation.readyRatio >= 0.67;
            const timedOut = phaseAge >= OPERATION_ASSEMBLE_TIMEOUT_TICKS;
            if (ready || timedOut) {
                const recentlyPrepared =
                    tick - this.lastFireWindowTick <= OPERATION_FIRE_MAX_TICKS * 2;
                if (!operation.preparationOnly && recentlyPrepared) {
                    this.transitionOperation(
                        OPERATION_EXECUTION_PHASE.ASSAULT,
                        tick,
                        ready ? 'ASSEMBLED_AFTER_PREPARATION' : 'ASSEMBLY_TIMEOUT_AFTER_PREPARATION',
                        observation
                    );
                } else {
                    this.transitionOperation(
                        OPERATION_EXECUTION_PHASE.FIRE_WINDOW,
                        tick,
                        ready ? 'COMBAT_GROUPS_READY' : 'ASSEMBLY_TIMEOUT',
                        observation
                    );
                }
            }
        } else if (operation.phase === OPERATION_EXECUTION_PHASE.FIRE_WINDOW) {
            this.lastFireWindowTick = tick;
            if (!operation.preparationOnly) {
                const baseline = Math.max(1, operation.fireEnemyValue || 0);
                const enemyDamageRatio = Math.max(
                    0,
                    1 - (observation.estimatedEnemyValue || baseline) / baseline
                );
                if ((phaseAge >= OPERATION_FIRE_MIN_TICKS && enemyDamageRatio >= 0.08) ||
                    phaseAge >= OPERATION_FIRE_MAX_TICKS) {
                    this.transitionOperation(
                        OPERATION_EXECUTION_PHASE.ASSAULT,
                        tick,
                        enemyDamageRatio >= 0.08 ? 'FIRE_EFFECT_ACHIEVED' : 'FIRE_WINDOW_EXPIRED',
                        observation
                    );
                }
            }
        } else if (operation.phase === OPERATION_EXECUTION_PHASE.ASSAULT) {
            const baseline = Math.max(1, operation.enemyValueAtStart || 0);
            const enemyLossRatio = Math.max(
                0,
                1 - (observation.estimatedEnemyValue || baseline) / baseline
            );
            const urgent = (this.controller?.lastSituation?.timePressure || 0) >= 0.9;
            if (enemyLossRatio >= 0.3 || urgent ||
                phaseAge >= OPERATION_ASSAULT_TO_EXPLOIT_TICKS) {
                this.transitionOperation(
                    OPERATION_EXECUTION_PHASE.EXPLOIT,
                    tick,
                    enemyLossRatio >= 0.3 ? 'ENEMY_COHESION_BROKEN' :
                        urgent ? 'MISSION_TIME_CRITICAL' : 'ASSAULT_MOMENTUM',
                    observation
                );
            }
        }
        return this.operation;
    }

    coordinatedContractOrder(contract, operationalPlan, observation, tick) {
        const state = this.stateFor(contract, tick);
        const units = executionUnits(contract, observation);
        if (!units.length) {
            this.transition(state, TASK_EXECUTION_PHASE.COMPLETE, tick, 'GROUP_ELIMINATED');
            return null;
        }
        const phase = this.operation?.phase;
        if (phase === OPERATION_EXECUTION_PHASE.ASSEMBLE) {
            if (OPERATION_COMBAT_ROLES.has(contract.groupRole) ||
                contract.groupRole === TASK_GROUP_ROLE.RECON) {
                const engagementFactor = OPERATION_COMBAT_ROLES.has(contract.groupRole)
                    ? 1.45
                    : 1.08;
                const threat = executionSelfDefenseTarget(
                    contract,
                    units,
                    observation,
                    { engagementFactor, focusTargetId: this.focusForContract(contract) }
                );
                if (threat && (state.lastTargetId !== threat.id ||
                    this.shouldRefresh(state, tick, TASK_ACTION_REFRESH_TICKS))) {
                    const order = executionSelfDefenseAttackOrder(
                        contract,
                        units,
                        threat,
                        { engagementFactor }
                    );
                    if (order) return this.markOrder(state, order, tick);
                }
            }
            const point = contract.groupRole === TASK_GROUP_ROLE.FIRE_SUPPORT
                ? contract.destination
                : contract.route?.[0];
            if (!point) return null;
            if (executionArrived(units, point, 115)) {
                if (state.lastOrderKind === BATTLE_ORDER_KIND.HOLD) return null;
                return this.markOrder(
                    state,
                    executionHoldOrder(contract, units, `TASK:${contract.id}:ASSEMBLED`),
                    tick
                );
            }
            if (!this.shouldRefresh(state, tick)) return null;
            return this.markOrder(
                state,
                executionMoveOrder(contract, units, point, `TASK:${contract.id}:OPERATION_ASSEMBLE`),
                tick
            );
        }
        if (phase === OPERATION_EXECUTION_PHASE.FIRE_WINDOW) {
            if (contract.groupRole === TASK_GROUP_ROLE.FIRE_SUPPORT) {
                const target = executionVisibleTarget(contract, units, observation);
                if (target && (state.lastTargetId !== target.id ||
                    this.shouldRefresh(state, tick, TASK_ACTION_REFRESH_TICKS))) {
                    return this.markOrder(state, executionAttackOrder(contract, units, target), tick);
                }
                if (!executionArrived(units, contract.destination, 115) &&
                    this.shouldRefresh(state, tick)) {
                    return this.markOrder(
                        state,
                        executionMoveOrder(
                            contract,
                            units,
                            contract.destination,
                            `TASK:${contract.id}:FIRE_POSITION`
                        ),
                        tick
                    );
                }
                return null;
            }
            if (contract.groupRole === TASK_GROUP_ROLE.RECON) {
                const threat = executionSelfDefenseTarget(contract, units, observation);
                if (threat && (state.lastTargetId !== threat.id ||
                    this.shouldRefresh(state, tick, TASK_ACTION_REFRESH_TICKS))) {
                    const order = executionSelfDefenseAttackOrder(contract, units, threat);
                    if (order) return this.markOrder(state, order, tick);
                }
                const hasVisibleContact = (observation.contacts || [])
                    .some(contact => contact.visible);
                const observationPoint = hasVisibleContact
                    ? contract.route?.[0]
                    : contract.destination;
                if (observationPoint && !executionArrived(units, observationPoint, 115) &&
                    this.shouldRefresh(state, tick)) {
                    return this.markOrder(
                        state,
                        executionMoveOrder(
                            contract,
                            units,
                            observationPoint,
                            `TASK:${contract.id}:OBSERVATION_POSITION`
                        ),
                        tick
                    );
                }
                return null;
            }
            if (OPERATION_COMBAT_ROLES.has(contract.groupRole)) {
                const threat = executionSelfDefenseTarget(
                    contract,
                    units,
                    observation,
                    { engagementFactor: 1.45, focusTargetId: this.focusForContract(contract) }
                );
                if (threat && (state.lastTargetId !== threat.id ||
                    this.shouldRefresh(state, tick, TASK_ACTION_REFRESH_TICKS))) {
                    const order = executionSelfDefenseAttackOrder(
                        contract,
                        units,
                        threat,
                        { engagementFactor: 1.45 }
                    );
                    if (order) return this.markOrder(state, order, tick);
                }
            }
            if (state.lastOrderKind === BATTLE_ORDER_KIND.HOLD) return null;
            return this.markOrder(
                state,
                executionHoldOrder(contract, units, `TASK:${contract.id}:FIRE_WINDOW_HOLD`),
                tick
            );
        }

        let activeContract = contract;
        const reserveActivated = contract.groupRole === TASK_GROUP_ROLE.RESERVE &&
            (phase === OPERATION_EXECUTION_PHASE.EXPLOIT ||
             (this.controller?.lastSituation?.timePressure || 0) >= 0.72);
        if (reserveActivated) {
            activeContract = {
                ...contract,
                task: TASK_CONTRACT_KIND.SEIZE_OBJECTIVE,
                engagementRule: 'ENGAGE_CONFIRMED_CONTACT',
                formation: 'WEDGE',
                route: [
                    contract.route?.[1] || contract.phaseLine,
                    executionSafePoint(contract.objective)
                ].filter(Boolean)
            };
        }
        if (phase === OPERATION_EXECUTION_PHASE.EXPLOIT &&
            [
                TASK_GROUP_ROLE.MAIN,
                TASK_GROUP_ROLE.FIXING,
                TASK_GROUP_ROLE.FLANK,
                TASK_GROUP_ROLE.RECON,
                TASK_GROUP_ROLE.RESERVE
            ].includes(contract.groupRole) &&
            !(observation.contacts || []).some(contact => contact.visible)) {
            let searchPoint = executionExploitSearchPoint(
                activeContract,
                this.controller.side,
                state.exploitSweepIndex
            );
            if (executionArrived(units, searchPoint, 130)) {
                state.exploitSweepIndex = (state.exploitSweepIndex || 0) + 1;
                state.lastOrderTick = -Infinity;
                searchPoint = executionExploitSearchPoint(
                    activeContract,
                    this.controller.side,
                    state.exploitSweepIndex
                );
            }
            if (this.shouldRefresh(state, tick, TASK_ACTION_REFRESH_TICKS)) {
                return this.markOrder(
                    state,
                    executionMoveOrder(
                        activeContract,
                        units,
                        searchPoint,
                        `TASK:${contract.id}:EXPLOIT_SECTOR_SWEEP`
                    ),
                    tick
                );
            }
            return null;
        }
        return this.decideContract(activeContract, observation, tick);
    }

    stateFor(contract, tick) {
        let state = this.states.get(contract.id);
        if (!state) {
            state = {
                contractId: contract.id,
                phase: TASK_EXECUTION_PHASE.ASSEMBLE,
                waypointIndex: 0,
                lastOrderTick: -Infinity,
                lastOrderKind: null,
                lastTargetId: null,
                exploitSweepIndex: 0,
                abortReason: null,
                createdAtTick: tick
            };
            this.states.set(contract.id, state);
            this.recordTransition(state, null, TASK_EXECUTION_PHASE.ASSEMBLE, tick, 'CONTRACT_STARTED');
        }
        return state;
    }

    recordTransition(state, previous, current, tick, reason) {
        this.transitionHistory.push({
            tick,
            contractId: state.contractId,
            previous,
            current,
            reason
        });
        if (this.transitionHistory.length > 300) this.transitionHistory.shift();
    }

    transition(state, phase, tick, reason) {
        if (state.phase === phase) return;
        const previous = state.phase;
        state.phase = phase;
        this.recordTransition(state, previous, phase, tick, reason);
    }

    shouldRefresh(state, tick, interval = TASK_ORDER_REFRESH_TICKS) {
        return tick - state.lastOrderTick >= interval;
    }

    markOrder(state, order, tick) {
        state.lastOrderTick = tick;
        state.lastOrderKind = order.kind;
        state.lastTargetId = order.targetId ?? null;
        return order;
    }

    decideContract(contract, observation, tick) {
        const state = this.stateFor(contract, tick);
        const units = executionUnits(contract, observation);
        if (!units.length) {
            this.transition(state, TASK_EXECUTION_PHASE.COMPLETE, tick, 'GROUP_ELIMINATED');
            return null;
        }

        const abortReason = executionAbortReason(contract, units, observation);
        if (abortReason && state.phase !== TASK_EXECUTION_PHASE.WITHDRAW &&
            state.phase !== TASK_EXECUTION_PHASE.COMPLETE) {
            state.abortReason = abortReason;
            this.transition(state, TASK_EXECUTION_PHASE.WITHDRAW, tick, abortReason);
            state.lastOrderTick = -Infinity;
        }

        if (state.phase === TASK_EXECUTION_PHASE.WITHDRAW) {
            if (executionArrived(units, contract.fallbackPosition)) {
                this.transition(state, TASK_EXECUTION_PHASE.HOLD, tick, 'FALLBACK_REACHED');
                const order = executionHoldOrder(contract, units, `TASK:${contract.id}:FALLBACK`);
                return this.markOrder(state, order, tick);
            }
            if (!this.shouldRefresh(state, tick)) return null;
            return this.markOrder(
                state,
                executionMoveOrder(
                    contract,
                    units,
                    contract.fallbackPosition,
                    `TASK:${contract.id}:ABORT:${state.abortReason}`
                ),
                tick
            );
        }

        if (state.phase === TASK_EXECUTION_PHASE.ASSEMBLE ||
            state.phase === TASK_EXECUTION_PHASE.ADVANCE) {
            const route = contract.route || [];
            let waypoint = route[Math.min(state.waypointIndex, Math.max(0, route.length - 1))];
            if (!waypoint) {
                this.transition(state, TASK_EXECUTION_PHASE.ACTION, tick, 'NO_ROUTE');
            } else if (executionArrived(units, waypoint)) {
                state.waypointIndex += 1;
                if (state.waypointIndex >= route.length) {
                    this.transition(state, TASK_EXECUTION_PHASE.ACTION, tick, 'DESTINATION_REACHED');
                } else {
                    this.transition(state, TASK_EXECUTION_PHASE.ADVANCE, tick, 'PHASE_LINE_REACHED');
                    waypoint = route[state.waypointIndex];
                }
            }
            if (state.phase === TASK_EXECUTION_PHASE.ASSEMBLE ||
                state.phase === TASK_EXECUTION_PHASE.ADVANCE) {
                const threat = contract.engagementRule === 'HOLD_FIRE'
                    ? null
                    : executionSelfDefenseTarget(contract, units, observation);
                if (threat && (state.lastTargetId !== threat.id ||
                    this.shouldRefresh(state, tick, TASK_ACTION_REFRESH_TICKS))) {
                    const order = executionSelfDefenseAttackOrder(contract, units, threat);
                    if (order) return this.markOrder(state, order, tick);
                }
                if (!this.shouldRefresh(state, tick)) return null;
                return this.markOrder(
                    state,
                    executionMoveOrder(
                        contract,
                        units,
                        waypoint,
                        `TASK:${contract.id}:${state.phase}:WP${state.waypointIndex}`
                    ),
                    tick
                );
            }
        }

        if (state.phase === TASK_EXECUTION_PHASE.ACTION) {
            const selfDefenseOnly = [
                'SELF_DEFENSE',
                'SELF_DEFENSE_AND_REPORT'
            ].includes(contract.engagementRule);
            const canAttack = contract.engagementRule !== 'HOLD_FIRE';
            const target = !canAttack ? null :
                selfDefenseOnly
                    ? executionSelfDefenseTarget(contract, units, observation, { focusTargetId: this.focusForContract(contract) })
                    : executionVisibleTarget(contract, units, observation, { focusTargetId: this.focusForContract(contract) });
            if (target && (state.lastTargetId !== target.id ||
                this.shouldRefresh(state, tick, TASK_ACTION_REFRESH_TICKS))) {
                const order = selfDefenseOnly
                    ? executionSelfDefenseAttackOrder(contract, units, target)
                    : executionAttackOrder(contract, units, target);
                if (order) return this.markOrder(state, order, tick);
            }
            if (!target && state.lastOrderKind !== BATTLE_ORDER_KIND.HOLD) {
                this.transition(state, TASK_EXECUTION_PHASE.HOLD, tick, 'NO_VISIBLE_TARGET');
                return this.markOrder(
                    state,
                    executionHoldOrder(contract, units, `TASK:${contract.id}:NO_VISIBLE_TARGET`),
                    tick
                );
            }
        }
        if (state.phase === TASK_EXECUTION_PHASE.HOLD) {
            const selfDefenseOnly = [
                'SELF_DEFENSE',
                'SELF_DEFENSE_AND_REPORT'
            ].includes(contract.engagementRule);
            const canAttack = contract.engagementRule !== 'HOLD_FIRE';
            const target = !canAttack ? null :
                selfDefenseOnly
                    ? executionSelfDefenseTarget(contract, units, observation, { focusTargetId: this.focusForContract(contract) })
                    : executionVisibleTarget(contract, units, observation, { focusTargetId: this.focusForContract(contract) });
            if (target) {
                this.transition(state, TASK_EXECUTION_PHASE.ACTION, tick, 'VISIBLE_TARGET_ACQUIRED');
                const order = selfDefenseOnly
                    ? executionSelfDefenseAttackOrder(contract, units, target)
                    : executionAttackOrder(contract, units, target);
                if (order) return this.markOrder(state, order, tick);
            }
            const mustSearch = [
                BATTLE_PLAN_KIND.SEARCH,
                BATTLE_PLAN_KIND.ADVANCE
            ].includes(contract.planKind) || (
                this.controller?.lastSituation?.role === BATTLE_ROLE.ATTACKER &&
                contract.task === TASK_CONTRACT_KIND.SEIZE_OBJECTIVE
            );
            const searchCapable = [
                TASK_GROUP_ROLE.MAIN,
                TASK_GROUP_ROLE.FIXING,
                TASK_GROUP_ROLE.FLANK,
                TASK_GROUP_ROLE.RECON
            ].includes(contract.groupRole);
            if (!target && mustSearch && searchCapable &&
                this.shouldRefresh(state, tick, TASK_ACTION_REFRESH_TICKS)) {
                let searchPoint = executionExploitSearchPoint(
                    contract,
                    this.controller.side,
                    state.exploitSweepIndex
                );
                if (executionArrived(units, searchPoint, 130)) {
                    state.exploitSweepIndex = (state.exploitSweepIndex || 0) + 1;
                    searchPoint = executionExploitSearchPoint(
                        contract,
                        this.controller.side,
                        state.exploitSweepIndex
                    );
                }
                return this.markOrder(
                    state,
                    executionMoveOrder(
                        contract,
                        units,
                        searchPoint,
                        `TASK:${contract.id}:CONTACT_SEARCH`
                    ),
                    tick
                );
            }
            // ANALİST-FIX (savunan-yayılma icra): mustSearch değil ama SAVUNAN grubu sektör-savunma-pozisyonuna VARMADIYSA
            // oraya YAY (yumak→geniş hat; ÇNRA/havan alan-ateşi mezarı çözülür). Varınca durur → dig_in oto-siperlenir.
            if (!target && searchCapable && contract.destination &&
                this.controller?.lastSituation?.role === BATTLE_ROLE.DEFENDER &&
                !executionArrived(units, contract.destination, 150) &&
                this.shouldRefresh(state, tick, TASK_ACTION_REFRESH_TICKS)) {
                return this.markOrder(
                    state,
                    executionMoveOrder(contract, units, contract.destination, `TASK:${contract.id}:DEFENSE_SPREAD`),
                    tick
                );
            }
        }
        return null;
    }

    decide(operationalPlan, observation, tick = SIM.tick) {
        if (!operationalPlan?.taskContracts?.length || !observation) return null;
        const activeIds = new Set(operationalPlan.taskContracts.map(contract => contract.id));
        for (const id of this.states.keys()) {
            if (!activeIds.has(id)) this.states.delete(id);
        }
        const operation = this.updateOperation(operationalPlan, observation, tick);
        this.focusContactId = this.updateFocusContact(observation);   // ORTAK FOCUS: tüm muharip gruplar aynı hedefe
        const orders = operationalPlan.taskContracts
            .slice()
            .sort((a, b) => a.groupRole.localeCompare(b.groupRole))
            .map(contract => operation
                ? this.coordinatedContractOrder(
                    contract,
                    operationalPlan,
                    observation,
                    tick
                )
                : this.decideContract(contract, observation, tick))
            .filter(Boolean);
        this.lastTelemetry = {
            tick,
            planId: operationalPlan.planId,
            operation: operation ? replayClone(operation) : null,
            states: [...this.states.values()].map(replayClone)
                .sort((a, b) => a.contractId.localeCompare(b.contractId)),
            orderCount: orders.length
        };
        return orders.length ? {
            kind: 'TASK_EXECUTION',
            planId: operationalPlan.planId,
            orders,
            telemetry: replayClone(this.lastTelemetry)
        } : null;
    }

    // ORTAK FOCUS-FIRE hedefi: tüm muharip gruplar aynı önceliği döver → konsantre yıkım.
    // Sadece PERCEPTION (görünür contacts) — adil, sis-savaşına saygılı. Histerezis: mevcut focus görünür+canlı ise
    // koru (odak savrulmasını önle); ölünce/kaybolunca hepsi AYNI ANDA yeni önceliğe döner. Öncelik: kendi kütle-
    // merkezine EN YAKIN (ulaşılabilir) görünür düşman + yaralıya bonus (bitirici darbe).
    // SEKTÖR-KOMUTA: grup kendi sektörünün odağını kullanır (mainSector'daki KÜTLE aynı düşmana odaklanır = kazanan
    // konsantrasyon sektör-İÇİNDE korunur; FLANK kendi sektörüne). Sektör-off veya sektör yoksa global focus'a düşer.
    focusForContract(contract) {
        if (typeof BATTLE_SECTOR_COMMAND !== 'undefined' && BATTLE_SECTOR_COMMAND && contract && contract.sector && this.focusBySector) {
            const f = this.focusBySector[contract.sector];
            if (f != null) return f;
        }
        return this.focusContactId;
    }
    updateFocusContact(observation) {
        const visible = (observation.contacts || []).filter(c => c.visible);
        // SEKTÖR-KOMUTA: sektör-başına odak (contact'ın x-band'ına göre). Her sektörde en iyi hedef (scoreTarget / en-yakın).
        if (typeof BATTLE_SECTOR_COMMAND !== 'undefined' && BATTLE_SECTOR_COMMAND) {
            const own0 = observation.ownUnits || [];
            const bb0 = this.controller && this.controller.blackboard;
            const tw0 = (this.controller && this.controller.profile) ? this.controller.profile.targetingWeights : null;
            const byS = { left: null, center: null, right: null };
            const scoreS = { left: -Infinity, center: -Infinity, right: -Infinity };
            for (const c of visible) {
                const sec = (typeof situationSectorForX === 'function') ? situationSectorForX(c.x) : 'center';
                const s = (typeof scoreTarget === 'function') ? scoreTarget(c, own0, bb0, tw0) : -Math.hypot(c.x, c.y);
                if (s > scoreS[sec] || (s === scoreS[sec] && byS[sec] != null && c.id < byS[sec])) { scoreS[sec] = s; byS[sec] = c.id; }
            }
            this.focusBySector = byS;
        } else {
            this.focusBySector = null;
        }
        if (!visible.length) return null;
        if (this.focusContactId != null && visible.some(c => c.id === this.focusContactId)) return this.focusContactId;   // histerezis: mevcut odak görünürse koru
        const own = observation.ownUnits || [];
        // FAZ 4: tam hedef-skorlama (TTK + sınıf + yaralı + menzildeki-dost + korunma). Yüksek=iyi. Bayrakla A/B.
        if ((typeof BATTLE_TARGET_SCORING === 'undefined' || BATTLE_TARGET_SCORING) && typeof scoreTarget === 'function') {
            const bb = this.controller && this.controller.blackboard;
            const tw = (this.controller && this.controller.profile) ? this.controller.profile.targetingWeights : null;   // FAZ 7: profil ağırlıkları
            let best = null, bestScore = -Infinity;
            for (const c of visible) { const s = scoreTarget(c, own, bb, tw); if (s > bestScore || (s === bestScore && best && c.id < best.id)) { bestScore = s; best = c; } }
            return best ? best.id : null;
        }
        // Eski (en-yakın öz-merkeze + yaralı bonusu):
        let cx = 0, cy = 0;
        for (const u of own) { cx += u.x; cy += u.y; }
        if (own.length) { cx /= own.length; cy /= own.length; }
        let best = null, bestScore = Infinity;
        for (const c of visible) {
            const d = Math.hypot(c.x - cx, c.y - cy);
            const woundedBonus = c.healthBand === 'CRITICAL' ? 260 : c.healthBand === 'DAMAGED' ? 130 : 0;
            const score = d - woundedBonus;
            if (score < bestScore) { bestScore = score; best = c; }
        }
        return best ? best.id : null;
    }
}
