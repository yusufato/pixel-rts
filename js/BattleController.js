// Tarafsız savaş denetleyicisi omurgası.
// Strateji üretmez; kontrol sahipliği, karar tick'i ve emir sözleşmesini tanımlar.

const CONTROL_OWNER = Object.freeze({
    PLAYER: 'PLAYER',
    ALLY_AI: 'ALLY_AI',
    ENEMY_AI: 'ENEMY_AI',
    MULTIPLAYER_REMOTE: 'MULTIPLAYER_REMOTE',
    REPLAY: 'REPLAY'
});

const BATTLE_ORDER_KIND = Object.freeze({
    MOVE: 'MOVE',
    ATTACK: 'ATTACK',
    HOLD: 'HOLD',
    FREE_FIRE: 'FREE_FIRE'
});

const BATTLE_CONTROLLERS = new Map();

function battleDefaultControllerConfigs(config = {}) {
    if (config.mode === 'multiplayer' || config.mode === 'replay') return [];
    return [
        {
            id: 'battle-blue-ally-ai',
            side: false,
            owner: CONTROL_OWNER.ALLY_AI,
            doctrine: 'combined',
            personality: 'balanced',
            decisionIntervalTicks: 10
        },
        {
            id: 'battle-red-ai',
            side: true,
            owner: CONTROL_OWNER.ENEMY_AI,
            doctrine: 'combined',
            personality: 'balanced',
            decisionIntervalTicks: 10
        }
    ];
}

function normalizeBattleOrder(order) {
    if (!order || !Object.values(BATTLE_ORDER_KIND).includes(order.kind)) {
        throw new Error('Geçersiz savaş emri.');
    }
    return {
        kind: order.kind,
        unitIds: [...new Set((order.unitIds || []).filter(Number.isFinite))].sort((a, b) => a - b),
        targetId: Number.isFinite(order.targetId) ? order.targetId : null,
        destinations: (order.destinations || []).map(destination => ({
            id: destination.id,
            x: Number(destination.x),
            y: Number(destination.y)
        })).filter(destination =>
            Number.isFinite(destination.id) &&
            Number.isFinite(destination.x) &&
            Number.isFinite(destination.y)
        ),
        reason: String(order.reason || ''),
        issuedBy: order.issuedBy || null
    };
}

function applyBattleOrder(rawOrder) {
    const order = normalizeBattleOrder(rawOrder);
    if (order.kind === BATTLE_ORDER_KIND.MOVE) {
        for (const destination of order.destinations) {
            const unit = battleUnitById(destination.id);
            if (!unit) continue;
            const safe = typeof terrainSafePoint === 'function'
                ? terrainSafePoint(destination.x, destination.y)
                : destination;
            unit.targetX = safe.x;
            unit.targetY = safe.y;
            unit.manualTarget = null;
            unit.manualMoveTarget = { x: safe.x, y: safe.y };
            unit.isMovingToManualTarget = true;
            unit.attackTarget = null;
        }
    } else if (order.kind === BATTLE_ORDER_KIND.ATTACK) {
        const target = battleUnitById(order.targetId);
        if (!target) return false;
        for (const id of order.unitIds) {
            const unit = battleUnitById(id);
            if (!unit || unit.isRed === target.isRed) continue;
            unit.manualTarget = target;
            unit.manualMoveTarget = null;
            unit.isMovingToManualTarget = false;
        }
    } else if (order.kind === BATTLE_ORDER_KIND.HOLD) {
        for (const id of order.unitIds) {
            const unit = battleUnitById(id);
            if (!unit) continue;
            unit.targetX = unit.x;
            unit.targetY = unit.y;
            unit.manualMoveTarget = null;
            unit.isMovingToManualTarget = false;
        }
    } else if (order.kind === BATTLE_ORDER_KIND.FREE_FIRE) {
        for (const id of order.unitIds) {
            const unit = battleUnitById(id);
            if (!unit) continue;
            unit.manualTarget = null;
            unit.manualMoveTarget = null;
            unit.isMovingToManualTarget = false;
        }
    }
    return true;
}

class BattleController {
    constructor(config = {}) {
        if (!config.id) throw new Error('BattleController için id zorunludur.');
        this.id = String(config.id);
        this.side = config.side === true;
        this.owner = config.owner || (this.side ? CONTROL_OWNER.ENEMY_AI : CONTROL_OWNER.ALLY_AI);
        this.mission = config.mission || null;
        this.doctrine = config.doctrine || 'combined';
        this.personality = config.personality || 'balanced';
        this.decisionIntervalTicks = Math.max(1, config.decisionIntervalTicks | 0 || 10);
        this.nextDecisionTick = 0;
        this.active = config.active !== false;
        this.currentPlan = null;
        this.decisionHistory = [];
        this.perception = typeof BattlePerception !== 'undefined' ? new BattlePerception(this) : null;
        this.lastObservation = null;
        this.situationAnalyzer = typeof SituationAnalyzer !== 'undefined' ? new SituationAnalyzer(this) : null;
        this.courseOfActionGenerator = typeof CourseOfActionGenerator !== 'undefined'
            ? new CourseOfActionGenerator()
            : null;
        this.courseOfActionEvaluator = typeof CourseOfActionEvaluator !== 'undefined'
            ? new CourseOfActionEvaluator(this)
            : null;
        this.planCommitment = typeof PlanCommitmentManager !== 'undefined'
            ? new PlanCommitmentManager(this, config.planCommitment)
            : null;
        this.operationalPlanner = typeof BattleOperationalPlanner !== 'undefined'
            ? new BattleOperationalPlanner(this)
            : null;
        this.executeOrders = config.executeOrders !== false;
        this.taskExecutor = typeof TaskExecutionManager !== 'undefined'
            ? new TaskExecutionManager(this)
            : null;
        this.lastSituation = null;
        this.candidatePlans = [];
        this.rankedPlans = [];
        this.lastPlanDecision = null;
        this.operationalPlan = null;
    }

    owns(unit) {
        if (!unit || unit.dead || unit.isRed !== this.side) return false;
        if (unit.controllerId) return unit.controllerId === this.id;
        return unit.controlOwner === this.owner;
    }

    units() {
        return SIM.units.filter(unit => this.owns(unit));
    }

    issueOrder(order) {
        const normalized = normalizeBattleOrder({ ...order, issuedBy: this.id });
        const ownedIds = new Set(this.units().map(unit => unit.id));
        normalized.unitIds = normalized.unitIds.filter(id => ownedIds.has(id));
        normalized.destinations = normalized.destinations.filter(destination => ownedIds.has(destination.id));
        if (!normalized.unitIds.length && !normalized.destinations.length) return false;
        if (normalized.kind === BATTLE_ORDER_KIND.ATTACK) {
            const visibleTarget = this.lastObservation?.contacts?.some(contact =>
                contact.id === normalized.targetId && contact.visible === true
            );
            if (!visibleTarget) return false;
        }
        const applied = applyBattleOrder(normalized);
        if (applied && typeof battleRecordEvent === 'function') {
            battleRecordEvent('controller-order', normalized);
        }
        return applied;
    }

    decide(_now, observation, _situation, _rankedPlans) {
        if (!this.executeOrders || !this.taskExecutor) return null;
        return this.taskExecutor.decide(this.operationalPlan, observation, SIM.tick);
    }

    update(now) {
        if (!this.active || SIM.tick < this.nextDecisionTick) return;
        this.nextDecisionTick = SIM.tick + this.decisionIntervalTicks;
        // Komuta edilen CANLI birlik yoksa tüm karar zincirini çalıştırma. Bu, Hızlı Maç'ta
        // oyuncu-sahipli tarafta oluşan FANTOM controller'ı (birim vermez, telemetriyi kirletir,
        // her tick boşa hesaplar) ve imha olmuş tarafı sessizce atlar. Sahiplik değişirse döner.
        if (!this.units().length) { this.lastPlanDecision = null; return; }
        this.lastObservation = this.perception ? this.perception.update(SIM.tick) : null;
        this.lastSituation = this.situationAnalyzer
            ? this.situationAnalyzer.analyze(this.lastObservation)
            : null;
        this.candidatePlans = this.courseOfActionGenerator
            ? this.courseOfActionGenerator.generate(this.lastSituation)
            : [];
        this.rankedPlans = this.courseOfActionEvaluator
            ? this.courseOfActionEvaluator.evaluate(this.candidatePlans, this.lastSituation)
            : this.candidatePlans;
        this.lastPlanDecision = this.planCommitment
            ? this.planCommitment.select(this.rankedPlans, this.lastSituation, SIM.tick)
            : null;
        this.currentPlan = this.planCommitment?.current
            ? replayClone(this.planCommitment.current)
            : null;
        this.operationalPlan = this.operationalPlanner
            ? this.operationalPlanner.build(
                this.currentPlan,
                this.lastObservation,
                this.lastSituation
            )
            : null;
        const decision = this.decide(now, this.lastObservation, this.lastSituation, this.rankedPlans);
        if (typeof battleRecordControllerDecision === 'function') {
            battleRecordControllerDecision(this, decision);
        }
        if (!decision) return;
        this.decisionHistory.push({ tick: SIM.tick, decision: replayClone(decision) });
        if (this.decisionHistory.length > 200) this.decisionHistory.shift();
        if (decision.order) this.issueOrder(decision.order);
        if (Array.isArray(decision.orders)) {
            for (const order of decision.orders) this.issueOrder(order);
        }
    }
}

function registerBattleController(config) {
    const controller = config instanceof BattleController ? config : new BattleController(config);
    if (BATTLE_CONTROLLERS.has(controller.id)) {
        throw new Error(`BattleController id çakışması: ${controller.id}`);
    }
    BATTLE_CONTROLLERS.set(controller.id, controller);
    return controller;
}

function configureBattleControllers(configs = []) {
    resetBattleControllers();
    return configs.map(registerBattleController);
}

function resetBattleControllers() {
    BATTLE_CONTROLLERS.clear();
}

function assignUnitController(unit, controllerId, owner = null) {
    if (!unit) return false;
    const controller = BATTLE_CONTROLLERS.get(controllerId);
    if (!controller || controller.side !== unit.isRed) return false;
    unit.controllerId = controller.id;
    unit.controlOwner = owner || controller.owner;
    if (typeof BATTLE_REPLAY !== 'undefined' && BATTLE_REPLAY.initialState &&
        typeof battleRecordEvent === 'function') {
        battleRecordEvent('controller-assignment', {
            unitId: unit.id,
            controllerId: controller.id,
            owner: unit.controlOwner
        });
    }
    return true;
}

function battleControllerFor(side, owner) {
    return [...BATTLE_CONTROLLERS.values()]
        .filter(controller => controller.side === side && controller.owner === owner)
        .sort((a, b) => a.id.localeCompare(b.id))[0] || null;
}

function battleControllersSyncOwnership() {
    if (!BATTLE_CONTROLLERS.size) return;
    const redController = battleControllerFor(true, CONTROL_OWNER.ENEMY_AI);
    const allyController = battleControllerFor(false, CONTROL_OWNER.ALLY_AI);
    for (const unit of SIM.units.slice().sort((a, b) => a.id - b.id)) {
        if (unit.dead) continue;
        if (unit.controlOwner === CONTROL_OWNER.MULTIPLAYER_REMOTE ||
            unit.controlOwner === CONTROL_OWNER.REPLAY) continue;
        if (unit.controllerId) {
            const assigned = BATTLE_CONTROLLERS.get(unit.controllerId);
            if (assigned && assigned.side === unit.isRed) {
                unit.controlOwner = assigned.owner;
                continue;
            }
            unit.controllerId = null;
        }
        if (unit.isRed && redController) {
            assignUnitController(unit, redController.id, CONTROL_OWNER.ENEMY_AI);
        } else if (!unit.isRed && unit.ally && allyController) {
            assignUnitController(unit, allyController.id, CONTROL_OWNER.ALLY_AI);
        } else if (!unit.isRed && !unit.ally) {
            unit.controlOwner = CONTROL_OWNER.PLAYER;
            unit.controllerId = null;
        }
    }
}

function battleControllersDrive(now) {
    battleControllersSyncOwnership();
    // TAKTİK-VEKİLİ: bir taraf insan-gibi taktiği (konsantre+odaklı-ateş) oynuyorsa onu kontrolör yerine vekil sürer.
    // Hem ilerlemede hem Oracle rollout'unda geçerli (bu fonksiyon her ikisinde de çağrılır) → etiketler de vekile göre.
    const surSide = (typeof BATTLE_SURROGATE_SIDE !== 'undefined') ? BATTLE_SURROGATE_SIDE : null;
    if (surSide !== null && typeof battleTacticalSurrogateDrive === 'function') battleTacticalSurrogateDrive(surSide);
    const ordered = [...BATTLE_CONTROLLERS.values()].sort((a, b) => a.id.localeCompare(b.id));
    for (const controller of ordered) {
        if (surSide !== null && controller.side === surSide) continue;   // vekil tarafının kod-kontrolörünü atla
        controller.update(now);
    }
}
