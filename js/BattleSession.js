// Tek savaş alanı oturumu.
// Hızlı Maç, Hikâye, Multiplayer ve QA aynı reset, harita, RNG ve kural
// kurulumundan geçer. Modlar yalnız başlangıç verisi sağlar; motor değiştiremez.

const BATTLE_ENGINE_VERSION = 'battlefield-v2-fixed50-recorder2';
const BATTLE_TICK_MS = 50;
const BATTLE_TICK_SEC = BATTLE_TICK_MS / 1000;
const BATTLE_MAX_STEPS_PER_FRAME = 8;

const BATTLE_SESSION = {
    active: false,
    engineVersion: BATTLE_ENGINE_VERSION,
    mode: null,
    requestedMapId: -2,
    mapId: -2,
    seed: 1,
    attackerSide: false,
    durationSec: 240
};

const BATTLE_REPLAY = {
    version: 1,
    engineVersion: BATTLE_ENGINE_VERSION,
    session: null,
    initialState: null,
    events: [],
    hashes: [],
    telemetry: {
        schemaVersion: 1,
        sampleIntervalTicks: 10,
        samples: [],
        combatEvents: [],
        controllerDecisions: [],
        performance: [],
        finalSummary: null
    },
    playback: false
};

const BATTLE_REPLAY_DRIVER = {
    active: false,
    eventIndex: 0,
    source: null,
    divergence: null
};

function replayClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function battleResetReplay() {
    BATTLE_REPLAY.version = 1;
    BATTLE_REPLAY.engineVersion = BATTLE_ENGINE_VERSION;
    BATTLE_REPLAY.session = null;
    BATTLE_REPLAY.initialState = null;
    BATTLE_REPLAY.events.length = 0;
    BATTLE_REPLAY.hashes.length = 0;
    BATTLE_REPLAY.telemetry = {
        schemaVersion: 1,
        sampleIntervalTicks: 10,
        samples: [],
        combatEvents: [],
        controllerDecisions: [],
        performance: [],
        finalSummary: null
    };
    BATTLE_REPLAY.playback = false;
    BATTLE_REPLAY_DRIVER.active = false;
    BATTLE_REPLAY_DRIVER.eventIndex = 0;
    BATTLE_REPLAY_DRIVER.source = null;
    BATTLE_REPLAY_DRIVER.divergence = null;
    if (typeof battlePerformanceWindow !== 'undefined') {
        battlePerformanceWindow = {
            startedAt: 0,
            frames: 0,
            totalFrameMs: 0,
            maxFrameMs: 0,
            simulationSteps: 0,
            cappedFrames: 0
        };
    }
}

function battleTelemetryRound(value) {
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function battleTelemetryUnit(unit) {
    const targetDistance = Math.hypot(
        (unit.targetX ?? unit.x) - unit.x,
        (unit.targetY ?? unit.y) - unit.y
    );
    const pathBlocked = targetDistance > 2 &&
        typeof pathBlockedBetween === 'function'
        ? pathBlockedBetween(unit.x, unit.y, unit.targetX, unit.targetY)
        : false;
    return {
        id: unit.id,
        side: unit.isRed ? 'red' : 'blue',
        type: unit.type,
        owner: unit.controlOwner || null,
        controllerId: unit.controllerId || null,
        x: battleTelemetryRound(unit.x),
        y: battleTelemetryRound(unit.y),
        targetX: battleTelemetryRound(unit.targetX ?? unit.x),   // teşhis + karar-veri-seti (§5)
        targetY: battleTelemetryRound(unit.targetY ?? unit.y),
        attackTargetId: (unit.attackTarget && !unit.attackTarget.dead) ? unit.attackTarget.id : 0,
        isMovingToManualTarget: !!unit.isMovingToManualTarget,
        hp: battleTelemetryRound(Math.max(0, unit.hp)),
        maxHp: battleTelemetryRound(unit.maxHp),
        ammo: battleTelemetryRound(unit.ammo),
        maxAmmo: battleTelemetryRound(unit.maxAmmo),
        suppression: battleTelemetryRound(unit.suppression || 0),
        panic: battleTelemetryRound(unit.panic || 0),
        speed: battleTelemetryRound(unit.speed || 0),
        facingAngle: battleTelemetryRound(unit.facingAngle || 0),
        combatState: unit.combatState || null,
        fleeing: !!unit.isFleeing,
        panicking: !!unit.isPanicking,
        enemyInVision: !!unit.enemyInVision,
        inForest: !!unit.inForest,
        inTrench: !!unit.inTrench,
        supplyCut: !!unit.supplyCut,
        targetId: unit.attackTarget && !unit.attackTarget.dead ? unit.attackTarget.id : null,
        manualTargetId: unit.manualTarget && !unit.manualTarget.dead ? unit.manualTarget.id : null,
        targetX: battleTelemetryRound(unit.targetX ?? unit.x),
        targetY: battleTelemetryRound(unit.targetY ?? unit.y),
        targetDistance: battleTelemetryRound(targetDistance),
        movingToManualTarget: !!unit.isMovingToManualTarget,
        navPathLength: unit._navPath?.length || 0,
        navIndex: unit._navIdx || 0,
        navBlocked: !!pathBlocked,
        terrain: typeof terrainTypeAt === 'function'
            ? terrainTypeAt(unit.x, unit.y)
            : null
    };
}

function battleTelemetryController(controller) {
    const operation = controller.taskExecutor?.operation || null;
    return {
        id: controller.id,
        side: controller.side ? 'red' : 'blue',
        owner: controller.owner,
        currentPlan: controller.currentPlan?.kind || null,
        planId: controller.currentPlan?.id || null,
        role: controller.lastSituation?.role || null,
        contactState: controller.lastSituation?.contactState || null,
        forceRatio: battleTelemetryRound(controller.lastSituation?.forceRatio),
        contactConfidence: battleTelemetryRound(controller.lastSituation?.contactConfidence),
        timePressure: battleTelemetryRound(controller.lastSituation?.timePressure),
        visibleContactIds: (controller.lastObservation?.contacts || [])
            .filter(contact => contact.visible)
            .map(contact => contact.id)
            .sort((a, b) => a - b),
        operationPhase: operation?.phase || null,
        operationPlanKind: operation?.planKind || null,
        operationReadyRatio: battleTelemetryRound(operation?.readyRatio),
        taskStates: [...(controller.taskExecutor?.states?.values?.() || [])]
            .map(state => ({
                contractId: state.contractId,
                phase: state.phase,
                waypointIndex: state.waypointIndex,
                lastOrderKind: state.lastOrderKind,
                lastTargetId: state.lastTargetId,
                abortReason: state.abortReason
            }))
            .sort((a, b) => a.contractId.localeCompare(b.contractId))
    };
}

function battleCaptureTelemetrySample() {
    if (!BATTLE_SESSION.active || BATTLE_REPLAY.playback || !BATTLE_REPLAY.initialState) return;
    const telemetry = BATTLE_REPLAY.telemetry;
    if (!telemetry || (SIM.tick % telemetry.sampleIntervalTicks) !== 0) return;
    telemetry.samples.push({
        tick: SIM.tick || 0,
        seconds: battleTelemetryRound((SIM.tick || 0) * BATTLE_TICK_SEC),
        simRng: SIM_RNG.state >>> 0,                              // teşhis: RNG akış konumu (sapma izole için)
        pMoney: Math.round((player.money || 0) * 100) / 100,
        eMoney: Math.round((enemy.money || 0) * 100) / 100,
        hashParts: (typeof battleStateHashParts === 'function') ? battleStateHashParts() : null,   // teşhis: hangi hash-parçası sapıyor
        battle: {
            elapsedSec: battleTelemetryRound(SIM.battle?.elapsedSec || 0),
            remainingSec: battleTelemetryRound(SIM.battle?.remainingSec || 0),
            winnerSide: SIM.battle?.winnerSide ?? null,
            outcomeReason: SIM.battle?.outcomeReason || null
        },
        units: SIM.units
            .filter(unit => !unit.dead)
            .map(battleTelemetryUnit)
            .sort((a, b) => a.id - b.id),
        controllers: [...BATTLE_CONTROLLERS.values()]
            .map(battleTelemetryController)
            .sort((a, b) => a.id.localeCompare(b.id))
    });
}

function battleRecordCombatEvent(details = {}) {
    if (!BATTLE_SESSION.active || BATTLE_REPLAY.playback || !BATTLE_REPLAY.telemetry) return;
    if (BATTLE_REPLAY.telemetry.combatEvents.length >= 50000) return;
    BATTLE_REPLAY.telemetry.combatEvents.push({
        tick: SIM.tick || 0,
        seconds: battleTelemetryRound((SIM.tick || 0) * BATTLE_TICK_SEC),
        ...replayClone(details)
    });
}

function battleRecordControllerDecision(controller, decision) {
    if (!BATTLE_SESSION.active || BATTLE_REPLAY.playback || !BATTLE_REPLAY.telemetry) return;
    if (BATTLE_REPLAY.telemetry.controllerDecisions.length >= 4000) return;
    BATTLE_REPLAY.telemetry.controllerDecisions.push({
        tick: SIM.tick || 0,
        seconds: battleTelemetryRound((SIM.tick || 0) * BATTLE_TICK_SEC),
        controllerId: controller.id,
        side: controller.side ? 'red' : 'blue',
        observation: replayClone(controller.lastObservation),
        situation: replayClone(controller.lastSituation),
        candidatePlans: replayClone(controller.candidatePlans),
        rankedPlans: replayClone(controller.rankedPlans),
        committedPlan: replayClone(controller.currentPlan),
        operationalPlan: replayClone(controller.operationalPlan),
        execution: replayClone(decision)
    });
}

function battleRecordPerformanceSample(sample = {}) {
    if (!BATTLE_SESSION.active || BATTLE_REPLAY.playback || !BATTLE_REPLAY.telemetry) return;
    if (BATTLE_REPLAY.telemetry.performance.length >= 2000) return;
    BATTLE_REPLAY.telemetry.performance.push({
        tick: SIM.tick || 0,
        seconds: battleTelemetryRound((SIM.tick || 0) * BATTLE_TICK_SEC),
        ...replayClone(sample)
    });
}

function battleFinalizeTelemetry(summary) {
    if (!BATTLE_REPLAY.telemetry) return;
    battleCaptureTelemetrySample();
    BATTLE_REPLAY.telemetry.finalSummary = replayClone(summary);
}

function exportBattleDiagnosticReport(summary = null) {
    if (summary) battleFinalizeTelemetry(summary);
    return {
        format: 'pixel-rts-battle-diagnostic',
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        engineVersion: BATTLE_ENGINE_VERSION,
        replay: exportBattleReplay()
    };
}

function battleRecordEvent(type, payload = {}, tick = null) {
    if (!BATTLE_SESSION.active || BATTLE_REPLAY.playback) return;
    BATTLE_REPLAY.events.push({
        tick: Number.isFinite(tick) ? tick : (SIM.tick || 0),
        type,
        payload: replayClone(payload)
    });
}

function battleUnitSnapshot(unit) {
    return {
        id: unit.id,
        type: unit.type,
        isRed: !!unit.isRed,
        ally: !!unit.ally,
        controlOwner: unit.controlOwner || null,
        controllerId: unit.controllerId || null,
        // TAM PRECISION (yuvarlama YOK): initialState'ten yeniden başlayan replay, canlının kullandığı
        // birebir aynı pozisyondan başlamalı. x/y'yi 2 ondalığa yuvarlamak, tick-0 hash'i (o da yuvarlar)
        // eşleşse bile tam-precision simülasyonu saptırıyordu → sapma birikip hash sınırını geçiyordu.
        // Kanıt: u14 başlangıç x'ini 0.005 nudge'lamak kayıtlı hash'i birebir yeniden üretti. targetX/targetY
        // zaten tam precision'dı (asimetri buydu).
        x: unit.x,
        y: unit.y,
        hp: unit.hp,
        maxHp: unit.maxHp,
        atk: unit.atk,
        baseSpeed: unit.baseSpeed,
        speed: unit.speed,
        range: unit.range,
        vision: unit.vision,
        atkSpeed: unit.atkSpeed,
        baseArmor: unit.baseArmor,
        armor: unit.armor,
        maxAmmo: unit.maxAmmo,
        ammo: unit.ammo,
        veteran: unit.veteran || 0,
        level: unit.level || 0,
        xpBonus: unit.xpBonus || 1,
        panicResistance: unit.panicResistance || 0,
        facingAngle: unit.facingAngle || 0,
        targetX: unit.targetX,
        targetY: unit.targetY,
        scanTimer: unit.scanTimer,
        lastAttackTime: unit.lastAttackTime || 0
    };
}

function battleCaptureInitialState() {
    BATTLE_REPLAY.session = replayClone(BATTLE_SESSION);
    BATTLE_REPLAY.initialState = {
        units: SIM.units.filter(unit => !unit.dead).map(battleUnitSnapshot).sort((a, b) => a.id - b.id),
        trenches: (SIM.trenches || []).map(field => ({
            x: field.x,                 // TAM PRECISION (birim x/y ile aynı gerekçe — hash sınır-kayması)
            y: field.y,
            isRed: !!field.isRed,
            hp: field.hp,
            maxHp: field.maxHp || field.hp,
            r: field.r || 72,
            providesSupply: field.providesSupply !== false,
            createdAt: field.createdAt || 0,
            expiresAt: field.expiresAt || 0
        })),
        terrain: typeof terrainGrid !== 'undefined' && terrainGrid
            ? {
                gridWidth: GRID_W,
                gridHeight: GRID_H,
                cellWidth: CELL_W,
                cellHeight: CELL_H,
                worldWidth: WORLD_W,
                worldHeight: WORLD_H,
                cells: Array.from(terrainGrid),
                bridges: typeof bridgeSet !== 'undefined' && bridgeSet
                    ? [...bridgeSet].sort()
                    : []
            }
            : null,
        playerMoney: Math.round(player.money || 0),
        enemyMoney: Math.round(enemy.money || 0),
        rngState: SIM_RNG.state >>> 0
    };
    BATTLE_REPLAY.hashes.push({ tick: SIM.tick || 0, hash: battleStateHash() });
    return BATTLE_REPLAY.initialState;
}

function battleHashMix(hash, value) {
    const textValue = String(value);
    for (let i = 0; i < textValue.length; i++) {
        hash ^= textValue.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
}

function battleStateHash() {
    let hash = 2166136261 >>> 0;
    const mix = value => { hash = battleHashMix(hash, value); };
    mix(BATTLE_ENGINE_VERSION);
    mix(SIM.tick || 0);
    mix(SIM_RNG.state >>> 0);
    mix(Math.round((player.money || 0) * 100));
    mix(Math.round((enemy.money || 0) * 100));
    mix(Math.round((supportCooldowns?.paradrop || 0) * 1000));

    const battle = SIM.battle || {};
    mix(battle.attackerSide ? 1 : 0);
    mix(Math.round((battle.elapsedSec || 0) * 1000));
    mix(battle.winnerSide === null || battle.winnerSide === undefined ? '-' : battle.winnerSide ? 1 : 0);
    mix(battle.outcomeReason || '-');

    const orderedUnits = SIM.units.filter(unit => !unit.dead).slice().sort((a, b) => a.id - b.id);
    for (const unit of orderedUnits) {
        mix(unit.id); mix(unit.type); mix(unit.isRed ? 1 : 0); mix(unit.ally ? 1 : 0);
        mix(unit.controlOwner || '-'); mix(unit.controllerId || '-');
        mix(Math.round(unit.x * 100)); mix(Math.round(unit.y * 100));
        mix(Math.round(unit.hp * 100)); mix(Math.round((unit.ammo || 0) * 100));
        mix(Math.round((unit.suppression || 0) * 100));
        mix(unit.isFleeing ? 1 : 0);
        mix(unit.attackTarget && !unit.attackTarget.dead ? unit.attackTarget.id : 0);
        mix(Math.round((unit.targetX || 0) * 100)); mix(Math.round((unit.targetY || 0) * 100));
    }

    const orderedFields = (SIM.trenches || []).slice().sort((a, b) => (a.x - b.x) || (a.y - b.y));
    for (const field of orderedFields) {
        mix(Math.round(field.x * 100)); mix(Math.round(field.y * 100));
        mix(field.isRed ? 1 : 0); mix(Math.round((field.hp || 0) * 100)); mix(field.expiresAt || 0);
    }
    for (const spawn of pendingSupportSpawns || []) {
        mix(spawn.spawnAt); mix(spawn.type); mix(spawn.isRed ? 1 : 0);
        mix(Math.round(spawn.x * 100)); mix(Math.round(spawn.y * 100));
    }
    for (const support of activeSupports || []) {
        mix(support.type || '-'); mix(Math.round((support.x || 0) * 100));
        mix(Math.round((support.y || 0) * 100)); mix(Math.round((support.life || 0) * 1000));
        mix(support.payloadDropped ? 1 : 0);
    }
    return hash.toString(16).padStart(8, '0');
}

// TEŞHİS: hash'i PARÇALARA böler (hangi bölüm canlı↔replay sapıyor?). battleStateHash ile birebir
// aynı mix'ler, ama global/battle/birimler/trench/destek ayrı hash'lenir.
function battleStateHashParts() {
    const h = (fn) => { let x = 2166136261 >>> 0; const mix = v => { x = battleHashMix(x, v); }; fn(mix); return (x >>> 0).toString(16).padStart(8, '0'); };
    const battle = SIM.battle || {};
    const g = h(mix => { mix(BATTLE_ENGINE_VERSION); mix(SIM.tick || 0); mix(SIM_RNG.state >>> 0); mix(Math.round((player.money || 0) * 100)); mix(Math.round((enemy.money || 0) * 100)); mix(Math.round((supportCooldowns?.paradrop || 0) * 1000)); });
    const b = h(mix => { mix(battle.attackerSide ? 1 : 0); mix(Math.round((battle.elapsedSec || 0) * 1000)); mix(battle.winnerSide === null || battle.winnerSide === undefined ? '-' : battle.winnerSide ? 1 : 0); mix(battle.outcomeReason || '-'); });
    const u = h(mix => { for (const unit of SIM.units.filter(x => !x.dead).slice().sort((a, b2) => a.id - b2.id)) { mix(unit.id); mix(unit.type); mix(unit.isRed ? 1 : 0); mix(unit.ally ? 1 : 0); mix(unit.controlOwner || '-'); mix(unit.controllerId || '-'); mix(Math.round(unit.x * 100)); mix(Math.round(unit.y * 100)); mix(Math.round(unit.hp * 100)); mix(Math.round((unit.ammo || 0) * 100)); mix(Math.round((unit.suppression || 0) * 100)); mix(unit.isFleeing ? 1 : 0); mix(unit.attackTarget && !unit.attackTarget.dead ? unit.attackTarget.id : 0); mix(Math.round((unit.targetX || 0) * 100)); mix(Math.round((unit.targetY || 0) * 100)); } });
    const t = h(mix => { for (const f of (SIM.trenches || []).slice().sort((a, b2) => (a.x - b2.x) || (a.y - b2.y))) { mix(Math.round(f.x * 100)); mix(Math.round(f.y * 100)); mix(f.isRed ? 1 : 0); mix(Math.round((f.hp || 0) * 100)); mix(f.expiresAt || 0); } });
    const s = h(mix => { for (const sp of pendingSupportSpawns || []) { mix(sp.spawnAt); mix(sp.type); mix(sp.isRed ? 1 : 0); mix(Math.round(sp.x * 100)); mix(Math.round(sp.y * 100)); } for (const su of activeSupports || []) { mix(su.type || '-'); mix(Math.round((su.x || 0) * 100)); mix(Math.round((su.y || 0) * 100)); mix(Math.round((su.life || 0) * 1000)); mix(su.payloadDropped ? 1 : 0); } });
    return { g, b, u, t, s };
}

function battleMaybeRecordHash() {
    battleCaptureTelemetrySample();
    if (!BATTLE_SESSION.active || !BATTLE_REPLAY.initialState || (SIM.tick % 20) !== 0) return;
    const actual = battleStateHash();
    BATTLE_REPLAY.hashes.push({ tick: SIM.tick, hash: actual });
    if (BATTLE_REPLAY_DRIVER.active && !BATTLE_REPLAY_DRIVER.divergence) {
        const expected = battleExpectedHashAtTick(SIM.tick);
        if (expected && expected !== actual) {
            BATTLE_REPLAY_DRIVER.divergence = { tick: SIM.tick, expected, actual };
        }
    }
}

function exportBattleReplay() {
    return replayClone(BATTLE_REPLAY);
}

function battleRestoreUnit(snapshot) {
    const unit = new Unit(snapshot.type, snapshot.x, snapshot.y, !!snapshot.isRed);
    for (const key of [
        'maxHp', 'hp', 'atk', 'baseSpeed', 'speed', 'range', 'vision', 'atkSpeed',
        'baseArmor', 'armor', 'maxAmmo', 'ammo', 'veteran', 'level', 'xpBonus',
        'panicResistance', 'facingAngle', 'targetX', 'targetY', 'scanTimer', 'lastAttackTime'
    ]) {
        if (snapshot[key] !== undefined) unit[key] = snapshot[key];
    }
    unit.id = snapshot.id;
    unit.ally = !!snapshot.ally;
    unit.controlOwner = snapshot.controlOwner || (unit.isRed ? CONTROL_OWNER.ENEMY_AI : CONTROL_OWNER.PLAYER);
    unit.controllerId = snapshot.controllerId || null;
    unit.dead = false;
    unit.selected = false;
    unit.attackTarget = null;
    unit.manualTarget = null;
    unit.manualMoveTarget = null;
    unit.isMovingToManualTarget = false;
    return unit;
}

function battleRestoreInitialState(initialState) {
    SIM.units.length = 0;
    SIM.trenches.length = 0;
    Unit.nextId = 0;
    let maxId = 0;
    for (const snapshot of initialState.units || []) {
        const unit = battleRestoreUnit(snapshot);
        SIM.units.push(unit);
        maxId = Math.max(maxId, unit.id);
    }
    Unit.nextId = maxId;
    for (const field of initialState.trenches || []) {
        SIM.trenches.push(replayClone(field));
    }
    player.money = initialState.playerMoney || 0;
    enemy.money = initialState.enemyMoney || 0;
    SIM.tick = 0;
    simulationTime = 0;
    gameTime = 0;
    battleAccumulatorMs = 0;
    SIM_RNG.state = initialState.rngState >>> 0;
}

// ═══ BattleForkState.v1 — karşı-olgusal rollout için EKSİKSİZ fork ═══════════════════════
// initialState snapshot'ından FARKLI: tik/zaman + TÜM birim iç durumu (attackTarget dahil) +
// supports + rng korunur. Birim ref'leri (attackTarget/manualTarget) id ile serileşir, geri bağlanır.
function battleForkUnitSnapshot(u) {
    const s = {};
    for (const k in u) {
        if (!Object.prototype.hasOwnProperty.call(u, k)) continue;
        const v = u[k];
        if (typeof v === 'function') continue;
        if (k === 'attackTarget') { s.__attackTargetId = (v && !v.dead) ? v.id : null; continue; }
        if (k === 'manualTarget') { s.__manualTargetId = (v && !v.dead) ? v.id : null; continue; }
        s[k] = (v && typeof v === 'object') ? replayClone(v) : v;
    }
    return s;
}
function battleForkRestoreUnit(s) {
    const u = new Unit(s.type, s.x, s.y, !!s.isRed);   // ctor srandInt tüketir → rng SONRA resetlenir
    for (const k in s) {
        if (k === '__attackTargetId' || k === '__manualTargetId') continue;
        u[k] = (s[k] && typeof s[k] === 'object') ? replayClone(s[k]) : s[k];
    }
    u.dead = false;
    return u;
}
function battleForkCapture() {
    return {
        v: 1, tick: SIM.tick | 0,
        simTime: (typeof simulationTime !== 'undefined') ? simulationTime : 0,
        gTime: (typeof gameTime !== 'undefined') ? gameTime : 0,
        accMs: (typeof battleAccumulatorMs !== 'undefined') ? battleAccumulatorMs : 0,
        rngState: SIM_RNG.state >>> 0,
        playerMoney: player.money || 0, enemyMoney: enemy.money || 0,
        nextId: Unit.nextId || 0,
        units: SIM.units.filter(u => !u.dead).map(battleForkUnitSnapshot),
        trenches: (SIM.trenches || []).map(replayClone),
        activeSupports: (typeof activeSupports !== 'undefined') ? replayClone(activeSupports) : null,
        pendingSupportSpawns: (typeof pendingSupportSpawns !== 'undefined') ? replayClone(pendingSupportSpawns) : null,
        supportCooldowns: (typeof supportCooldowns !== 'undefined') ? replayClone(supportCooldowns) : null,
        battle: SIM.battle ? replayClone(SIM.battle) : null,
        controllers: (typeof battleForkCaptureControllers === 'function') ? battleForkCaptureControllers() : null
    };
}
function battleForkRestore(fork) {
    SIM.units.length = 0; SIM.trenches.length = 0;
    const byId = new Map();
    const snaps = fork.units || [];
    for (const s of snaps) { const u = battleForkRestoreUnit(s); SIM.units.push(u); byId.set(u.id, u); }
    for (let i = 0; i < snaps.length; i++) {
        const s = snaps[i], u = SIM.units[i];
        u.attackTarget = (s.__attackTargetId != null) ? (byId.get(s.__attackTargetId) || null) : null;
        u.manualTarget = (s.__manualTargetId != null) ? (byId.get(s.__manualTargetId) || null) : null;
    }
    for (const f of fork.trenches || []) SIM.trenches.push(replayClone(f));
    const restoreArr = (live, saved) => { if (typeof live === 'undefined' || !live || !saved) return; live.length = 0; for (const x of saved) live.push(replayClone(x)); };
    if (typeof activeSupports !== 'undefined') restoreArr(activeSupports, fork.activeSupports);
    if (typeof pendingSupportSpawns !== 'undefined') restoreArr(pendingSupportSpawns, fork.pendingSupportSpawns);
    if (typeof supportCooldowns !== 'undefined' && supportCooldowns && fork.supportCooldowns) { for (const k in supportCooldowns) delete supportCooldowns[k]; Object.assign(supportCooldowns, replayClone(fork.supportCooldowns)); }
    if (SIM.battle && fork.battle) Object.assign(SIM.battle, replayClone(fork.battle));
    player.money = fork.playerMoney || 0; enemy.money = fork.enemyMoney || 0;
    SIM.tick = fork.tick | 0;
    if (typeof simulationTime !== 'undefined') simulationTime = fork.simTime || 0;
    if (typeof gameTime !== 'undefined') gameTime = fork.gTime || 0;
    if (typeof battleAccumulatorMs !== 'undefined') battleAccumulatorMs = fork.accMs || 0;
    Unit.nextId = fork.nextId || 0;
    if (fork.controllers && typeof battleForkRestoreControllers === 'function') battleForkRestoreControllers(fork.controllers, byId);
    SIM_RNG.state = fork.rngState >>> 0;   // birim yaratımının tükettiği srand'ı geri al (EN SON)
}

// Controller iç durumu (nextDecisionTick + planCommitment + perception contact-hafızası + taskExecutor safha)
// — Map'ler entry-dizisine serileşir. Alt-sistem NESNELERİ korunur (yalnız veri alanları yüklenir → metodlar kalır).
function _forkCloneMap(m) { const out = []; if (m instanceof Map) for (const [k, v] of m) out.push([k, replayClone(v)]); return out; }
function _forkLoadMap(target, entries) { if (!(target instanceof Map)) return; target.clear(); for (const e of (entries || [])) target.set(e[0], replayClone(e[1])); }
function battleForkCaptureControllers() {
    if (typeof BATTLE_CONTROLLERS === 'undefined' || !BATTLE_CONTROLLERS) return null;
    const out = [];
    for (const c of BATTLE_CONTROLLERS.values()) {
        const cs = { id: c.id, nextDecisionTick: c.nextDecisionTick,
            currentPlan: replayClone(c.currentPlan), lastSituation: replayClone(c.lastSituation),
            lastObservation: replayClone(c.lastObservation), operationalPlan: replayClone(c.operationalPlan),
            candidatePlans: replayClone(c.candidatePlans), rankedPlans: replayClone(c.rankedPlans),
            lastPlanDecision: replayClone(c.lastPlanDecision), decisionHistory: replayClone(c.decisionHistory) };
        if (c.perception) cs.perc = { contacts: _forkCloneMap(c.perception.contacts), lastObservation: replayClone(c.perception.lastObservation), initialFriendlyValue: c.perception.initialFriendlyValue };
        if (c.planCommitment) cs.commit = { current: replayClone(c.planCommitment.current), sequence: c.planCommitment.sequence, transitionHistory: replayClone(c.planCommitment.transitionHistory), lastDecision: replayClone(c.planCommitment.lastDecision) };
        if (c.taskExecutor) cs.exec = { states: _forkCloneMap(c.taskExecutor.states), transitionHistory: replayClone(c.taskExecutor.transitionHistory), operation: replayClone(c.taskExecutor.operation), operationHistory: replayClone(c.taskExecutor.operationHistory), lastFireWindowTick: c.taskExecutor.lastFireWindowTick, lastTelemetry: replayClone(c.taskExecutor.lastTelemetry) };
        const op = c.operationalPlanner;
        if (op) cs.plan = { lastPlan: replayClone(op.lastPlan),
            fo: op.forceOrganizer ? { cachedPlanId: op.forceOrganizer.cachedPlanId, cachedUnitSignature: op.forceOrganizer.cachedUnitSignature, cachedGroups: replayClone(op.forceOrganizer.cachedGroups) } : null,
            tcp: op.taskContractPlanner ? { cachedKey: op.taskContractPlanner.cachedKey, cachedContracts: replayClone(op.taskContractPlanner.cachedContracts) } : null };
        out.push(cs);
    }
    return out;
}
function battleForkRestoreControllers(saved) {
    if (typeof BATTLE_CONTROLLERS === 'undefined' || !BATTLE_CONTROLLERS || !saved) return;
    for (const cs of saved) {
        const c = BATTLE_CONTROLLERS.get(cs.id); if (!c) continue;
        c.nextDecisionTick = cs.nextDecisionTick;
        c.currentPlan = replayClone(cs.currentPlan); c.lastSituation = replayClone(cs.lastSituation);
        c.lastObservation = replayClone(cs.lastObservation); c.operationalPlan = replayClone(cs.operationalPlan);
        c.candidatePlans = replayClone(cs.candidatePlans) || []; c.rankedPlans = replayClone(cs.rankedPlans) || [];
        c.lastPlanDecision = replayClone(cs.lastPlanDecision); c.decisionHistory = replayClone(cs.decisionHistory) || [];
        if (c.perception && cs.perc) { _forkLoadMap(c.perception.contacts, cs.perc.contacts); c.perception.lastObservation = replayClone(cs.perc.lastObservation); c.perception.initialFriendlyValue = cs.perc.initialFriendlyValue; }
        if (c.planCommitment && cs.commit) { c.planCommitment.current = replayClone(cs.commit.current); c.planCommitment.sequence = cs.commit.sequence; c.planCommitment.transitionHistory = replayClone(cs.commit.transitionHistory) || []; c.planCommitment.lastDecision = replayClone(cs.commit.lastDecision); }
        if (c.taskExecutor && cs.exec) { _forkLoadMap(c.taskExecutor.states, cs.exec.states); c.taskExecutor.transitionHistory = replayClone(cs.exec.transitionHistory) || []; c.taskExecutor.operation = replayClone(cs.exec.operation); c.taskExecutor.operationHistory = replayClone(cs.exec.operationHistory) || []; c.taskExecutor.lastFireWindowTick = cs.exec.lastFireWindowTick; c.taskExecutor.lastTelemetry = replayClone(cs.exec.lastTelemetry); }
        const op = c.operationalPlanner;
        if (op && cs.plan) { op.lastPlan = replayClone(cs.plan.lastPlan);
            if (op.forceOrganizer && cs.plan.fo) { op.forceOrganizer.cachedPlanId = cs.plan.fo.cachedPlanId; op.forceOrganizer.cachedUnitSignature = cs.plan.fo.cachedUnitSignature; op.forceOrganizer.cachedGroups = replayClone(cs.plan.fo.cachedGroups) || []; }
            if (op.taskContractPlanner && cs.plan.tcp) { op.taskContractPlanner.cachedKey = cs.plan.tcp.cachedKey; op.taskContractPlanner.cachedContracts = replayClone(cs.plan.tcp.cachedContracts) || []; } }
    }
}

function battleUnitById(id) {
    for (const unit of SIM.units) if (!unit.dead && unit.id === id) return unit;
    return null;
}

function battleApplyRecordedEvent(event) {
    const payload = event.payload || {};
    if (event.type === 'player-move') {
        for (const destination of payload.destinations || []) {
            const unit = battleUnitById(destination.id);
            if (!unit) continue;
            // KÖK NEDEN DÜZELTMESİ (canlı↔headless replay sapması): kayıttaki `destinations`
            // CANLI'da zaten terrainSafePoint'ten geçmiş NİHAİ hedeflerdir. Burada ikinci kez
            // terrainSafePoint uygulamak (fonksiyon idempotent değil) hedefi kaydırıp targetX/targetY
            // hash'ini saptırıyordu → replay ilk oyuncu-hareketinden sonra ~4-5 sn'de ayrılıyordu.
            // Kayıtlı nihai hedefi OLDUĞU GİBİ uygula (canlıyla bit-birebir).
            unit.targetX = destination.x;
            unit.targetY = destination.y;
            unit.manualTarget = null;
            unit.manualMoveTarget = { x: destination.x, y: destination.y };
            unit.isMovingToManualTarget = true;
            unit.attackTarget = null;
        }
    } else if (event.type === 'player-attack') {
        const target = battleUnitById(payload.targetId);
        if (!target) return;
        for (const id of payload.unitIds || []) {
            const unit = battleUnitById(id);
            if (!unit) continue;
            unit.manualTarget = target;
            unit.manualMoveTarget = null;
            unit.isMovingToManualTarget = false;
        }
    } else if (event.type === 'player-free-fire') {
        for (const id of payload.unitIds || []) {
            const unit = battleUnitById(id);
            if (!unit) continue;
            unit.manualTarget = null;
            unit.manualMoveTarget = null;
            unit.isMovingToManualTarget = false;
        }
    } else if (event.type === 'support-paradrop') {
        triggerParadrop(payload.x, payload.y);
    } else if (event.type === 'network-commands' && typeof mpApplyCmds === 'function') {
        mpApplyCmds(payload.blue || [], false);
        mpApplyCmds(payload.red || [], true);
    } else if (event.type === 'controller-assignment') {
        const unit = battleUnitById(payload.unitId);
        if (!unit) return;
        unit.controllerId = payload.controllerId || null;
        unit.controlOwner = payload.owner || unit.controlOwner;
    } else if (event.type === 'controller-order' && typeof applyBattleOrder === 'function') {
        applyBattleOrder(payload);
    }
}

function battleReplayDrive() {
    const driver = BATTLE_REPLAY_DRIVER;
    if (!driver.active || !driver.source) return;
    const events = driver.source.events || [];
    while (driver.eventIndex < events.length && events[driver.eventIndex].tick <= SIM.tick) {
        const event = events[driver.eventIndex++];
        if (event.type !== 'battle-start') battleApplyRecordedEvent(event);
    }
}

function battleExpectedHashAtTick(tick) {
    const source = BATTLE_REPLAY_DRIVER.source;
    if (!source) return null;
    const entry = (source.hashes || []).find(item => item.tick === tick);
    return entry ? entry.hash : null;
}

function startBattleReplay(replay) {
    const source = replayClone(replay);
    if (!source || source.version !== 1 || source.engineVersion !== BATTLE_ENGINE_VERSION ||
        !source.session || !source.initialState) {
        throw new Error('Replay bu savaş motoru sürümüyle uyumlu değil.');
    }

    openBattlefieldSession({
        mode: 'replay',
        mapId: source.session.requestedMapId ?? source.session.mapId,
        seed: source.session.seed,
        attackerSide: source.session.attackerSide,
        durationSec: source.session.durationSec,
        playerMoney: source.initialState.playerMoney,
        enemyMoney: source.initialState.enemyMoney,
        deployRes: null,
        deployPool: null,
        techBonus: null,
        techBonusRed: null,
        show: false
    });
    battleRestoreInitialState(source.initialState);
    phase = PHASE.BATTLE;
    document.body.setAttribute('data-phase', PHASE.BATTLE);
    initBattleRules({
        attackerSide: source.session.attackerSide,
        durationSec: source.session.durationSec
    });

    BATTLE_REPLAY.version = source.version;
    BATTLE_REPLAY.engineVersion = source.engineVersion;
    BATTLE_REPLAY.session = replayClone(source.session);
    BATTLE_REPLAY.initialState = replayClone(source.initialState);
    BATTLE_REPLAY.events = replayClone(source.events || []);
    BATTLE_REPLAY.hashes = [{ tick: 0, hash: battleStateHash() }];
    BATTLE_REPLAY.playback = true;

    BATTLE_REPLAY_DRIVER.active = true;
    BATTLE_REPLAY_DRIVER.eventIndex = 0;
    BATTLE_REPLAY_DRIVER.source = source;
    BATTLE_REPLAY_DRIVER.divergence = null;

    const expected = battleExpectedHashAtTick(0);
    const actual = battleStateHash();
    if (expected && expected !== actual) {
        BATTLE_REPLAY_DRIVER.divergence = { tick: 0, expected, actual };
    }
    return {
        expected,
        actual,
        matched: !expected || expected === actual
    };
}

function battleReplayStatus() {
    return {
        active: BATTLE_REPLAY_DRIVER.active,
        eventIndex: BATTLE_REPLAY_DRIVER.eventIndex,
        eventCount: BATTLE_REPLAY_DRIVER.source?.events?.length || 0,
        divergence: replayClone(BATTLE_REPLAY_DRIVER.divergence),
        tick: SIM.tick,
        hash: battleStateHash()
    };
}

function runBattleReplayTicks(replay, tickLimit = null) {
    const source = replayClone(replay);
    const recordedLastTick = Math.max(0, ...(source.hashes || []).map(item => item.tick || 0));
    const maxTicks = Number.isFinite(tickLimit) ? Math.max(0, tickLimit | 0) : recordedLastTick;
    const initial = startBattleReplay(source);

    while (SIM.tick < maxTicks && !BATTLE_REPLAY_DRIVER.divergence) {
        simulationTime += BATTLE_TICK_MS;
        gameTime += BATTLE_TICK_SEC;
        stepSim(simulationTime, BATTLE_TICK_SEC, battleReplayDrive, false);
        updateSupport(BATTLE_TICK_SEC, simulationTime);
        if (SIM.battle && SIM.battle.winnerSide !== null) break;
    }
    return {
        initial,
        tick: SIM.tick,
        hash: battleStateHash(),
        hashes: replayClone(BATTLE_REPLAY.hashes),
        divergence: replayClone(BATTLE_REPLAY_DRIVER.divergence)
    };
}

function verifyBattleReplayDeterminism(replay, tickLimit = null) {
    const first = runBattleReplayTicks(replay, tickLimit);
    const second = runBattleReplayTicks(replay, tickLimit);
    const firstTrace = first.hashes.map(item => `${item.tick}:${item.hash}`);
    const secondTrace = second.hashes.map(item => `${item.tick}:${item.hash}`);
    const matched = !first.divergence && !second.divergence &&
        first.hash === second.hash &&
        firstTrace.length === secondTrace.length &&
        firstTrace.every((value, index) => value === secondTrace[index]);
    return {
        matched,
        first,
        second,
        engineVersion: BATTLE_ENGINE_VERSION,
        tickMs: BATTLE_TICK_MS
    };
}

function resetBattleState() {
    if (typeof units !== 'undefined') units.length = 0;
    if (typeof trenches !== 'undefined') trenches.length = 0;
    if (typeof particles !== 'undefined') particles.length = 0;
    if (typeof activeSupports !== 'undefined') activeSupports.length = 0;
    if (typeof pendingSupportSpawns !== 'undefined') pendingSupportSpawns.length = 0;
    if (typeof craters !== 'undefined') craters.length = 0;
    if (typeof decals !== 'undefined') decals.length = 0;
    if (typeof supportCooldowns !== 'undefined') supportCooldowns.paradrop = 0;
    if (typeof SIM !== 'undefined') SIM.tick = 0;
    if (typeof resetBattleRules === 'function') resetBattleRules();
    if (typeof player !== 'undefined') { player.kills = 0; player.unitsSpawned = 0; }
    if (typeof enemy !== 'undefined') { enemy.kills = 0; enemy.unitsSpawned = 0; }
    if (typeof gameTime !== 'undefined') gameTime = 0;
    if (typeof simulationTime !== 'undefined') simulationTime = 0;
    if (typeof battleAccumulatorMs !== 'undefined') battleAccumulatorMs = 0;
    if (typeof phase !== 'undefined' && typeof PHASE !== 'undefined') phase = PHASE.DEPLOY;
    if (typeof selectedSpawnType !== 'undefined') selectedSpawnType = null;
    if (typeof deployCarried !== 'undefined') deployCarried = null;
    if (typeof warRoomResetBattleUI === 'function') warRoomResetBattleUI();
    if (typeof resetGroundCanvas === 'function') resetGroundCanvas();
    if (typeof resetBattleControllers === 'function') resetBattleControllers();
    BATTLE_SESSION.active = false;
    BATTLE_SESSION.mode = null;
    battleResetReplay();

    document.body.setAttribute('data-phase', 'deploy');
    document.getElementById('game-over-screen')?.classList.add('hidden');
    document.getElementById('start-btn')?.classList.remove('hidden');
    document.getElementById('mp-ready-btn')?.classList.add('hidden');
    document.getElementById('ui-support')?.classList.add('hidden');
    const spawn = document.getElementById('ui-spawn-bar');
    if (spawn) { spawn.style.opacity = '1'; spawn.style.pointerEvents = 'auto'; }
}

function openBattlefieldSession(config = {}) {
    const seed = Number.isFinite(config.seed) ? (config.seed >>> 0) || 1 : ((Date.now() >>> 0) || 1);
    const durationSec = Math.max(30, Number.isFinite(config.durationSec)
        ? config.durationSec
        : (typeof DEFAULT_BATTLE_DURATION_SEC !== 'undefined' ? DEFAULT_BATTLE_DURATION_SEC : 240));

    resetBattleState();

    BATTLE_SESSION.active = true;
    BATTLE_SESSION.engineVersion = BATTLE_ENGINE_VERSION;
    BATTLE_SESSION.interactive = config.show !== false;   // gerçek oyun (görünür) vs headless test — öğrenen-AI kancası buna bağlı
    BATTLE_SESSION.mode = config.mode || 'quick';
    BATTLE_SESSION.requestedMapId = Number.isFinite(config.mapId) ? config.mapId : -2;
    BATTLE_SESSION.mapId = BATTLE_SESSION.requestedMapId;
    BATTLE_SESSION.seed = seed;
    BATTLE_SESSION.attackerSide = config.attackerSide === true;
    BATTLE_SESSION.durationSec = durationSec;
    BATTLE_REPLAY.session = replayClone(BATTLE_SESSION);

    if (typeof QUICK_MATCH_ATTACKER_SIDE !== 'undefined') {
        QUICK_MATCH_ATTACKER_SIDE = BATTLE_SESSION.attackerSide;
    }
    if (typeof player !== 'undefined' && Number.isFinite(config.playerMoney)) player.money = config.playerMoney;
    if (typeof enemy !== 'undefined' && Number.isFinite(config.enemyMoney)) enemy.money = config.enemyMoney;
    if (typeof DEPLOY_RES !== 'undefined') DEPLOY_RES = config.deployRes ?? null;
    if (typeof DEPLOY_POOL !== 'undefined') DEPLOY_POOL = config.deployPool ?? null;
    if (typeof TECH_BONUS !== 'undefined') TECH_BONUS = config.techBonus ?? null;
    if (typeof TECH_BONUS_RED !== 'undefined') TECH_BONUS_RED = config.techBonusRed ?? null;

    if (typeof applyMap === 'function') applyMap(BATTLE_SESSION.requestedMapId);
    if (typeof currentMapId !== 'undefined' && Number.isFinite(currentMapId)) {
        BATTLE_SESSION.mapId = currentMapId;
    }
    if (typeof resetSimRng === 'function') resetSimRng(seed);

    const showTypedResources = !!(DEPLOY_RES && DEPLOY_RES.blue);
    ['res-oil', 'res-manpower', 'res-points'].forEach(id =>
        document.getElementById(id)?.classList.toggle('hidden', !showTypedResources));

    if (typeof configureBattleControllers === 'function') {
        const controllerConfigs = Array.isArray(config.controllers)
            ? config.controllers
            : (typeof battleDefaultControllerConfigs === 'function'
                ? battleDefaultControllerConfigs(config)
                : []);
        configureBattleControllers(controllerConfigs);
        BATTLE_SESSION.controllerProfile = controllerConfigs.length
            ? 'common-battle-ai-v1'
            : 'none';
    }
    if (typeof battleAutoDeploySession === 'function') {
        battleAutoDeploySession(config);
    }
    if (config.show !== false && typeof showScreen === 'function') showScreen('game');
    return BATTLE_SESSION;
}

function battlefieldRulesConfig() {
    return {
        attackerSide: BATTLE_SESSION.attackerSide === true,
        durationSec: BATTLE_SESSION.durationSec
    };
}
