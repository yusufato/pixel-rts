// PHYSICAL TRANSPORT AGENTS - HXD-9A
// A shipment is the cargo authority. The agent only moves that shipment over
// the physical route; it never creates stock, money or decorative traffic.

const STORY_TRANSPORT_SCHEMA_VERSION = 2;
const STORY_TRANSPORT_ADAPTER_VERSION = 'story-transport-agent-2';
const STORY_TRANSPORT_LOADING_SECONDS = 0.5;
const STORY_TRANSPORT_UNLOADING_SECONDS = 0.5;
const STORY_TRANSPORT_TRANSFER_FALLBACK_SECONDS = 0.75;
const STORY_TRANSPORT_TERMINAL_SCHEMA_VERSION = 1;
const STORY_TRANSPORT_TERMINAL_ADAPTER_VERSION = 'story-transport-terminal-1';
const STORY_TRANSPORT_TERMINAL_SLOTS = Object.freeze({ LAND: 3, RAIL: 2, SEA: 1 });
const STORY_MARITIME_CONDITION_SCHEMA_VERSION = 1;
const STORY_MARITIME_CONDITION_ADAPTER_VERSION = 'story-maritime-condition-1';

function storyTransportClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyTransportRound(value, digits) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    const scale = 10 ** (digits == null ? 6 : digits);
    return Math.round(number * scale) / scale;
}

function storyTransportScreenSlotKey(x, y, cellSize) {
    const size = Math.max(24, Number(cellSize) || 56);
    return Math.floor((Number(x) || 0) / size) + ':'
        + Math.floor((Number(y) || 0) / size);
}

// Fixed-step simulation intentionally updates physical shipments every 0.25 s.
// The map must not expose that cadence as quarter-second teleports. This helper
// keeps a render-only, wall-clock track that eases from the last painted world
// position to the newest authoritative simulation position. It never writes
// back to a shipment, route, stock or clock record.
function storyTransportPresentationResolve(previous, target, nowMs, durationMs) {
    const targetX = Number(target && target.x) || 0;
    const targetY = Number(target && target.y) || 0;
    const now = Number(nowMs) || 0;
    const duration = Math.max(1, Number(durationMs) || 1);
    const sample = track => {
        if (!track) return { x: targetX, y: targetY, active: false };
        const ratio = Math.max(0, Math.min(1,
            (now - Number(track.startedAt || 0)) / Math.max(1, Number(track.durationMs) || 1)));
        return {
            x: Number(track.fromX) + (Number(track.toX) - Number(track.fromX)) * ratio,
            y: Number(track.fromY) + (Number(track.toY) - Number(track.fromY)) * ratio,
            active: ratio < 1
        };
    };
    if (!previous) {
        const track = { fromX: targetX, fromY: targetY, toX: targetX, toY: targetY,
            startedAt: now, durationMs: duration };
        return { track, x: targetX, y: targetY, active: false, targetChanged: false };
    }
    const changed = Math.abs(Number(previous.toX) - targetX) > 1e-7
        || Math.abs(Number(previous.toY) - targetY) > 1e-7;
    if (changed) {
        const current = sample(previous);
        const track = { fromX: current.x, fromY: current.y, toX: targetX, toY: targetY,
            startedAt: now, durationMs: duration };
        return { track, x: current.x, y: current.y, active: true, targetChanged: true };
    }
    const current = sample(previous);
    return { track: previous, x: current.x, y: current.y,
        active: current.active, targetChanged: false };
}

// Fixed-step simulation intentionally updates physical shipments every 0.25 s.
// The map must not expose that cadence as quarter-second teleports. This helper
// keeps a render-only, wall-clock track that eases from the last painted world
// position to the newest authoritative simulation position. It never writes
// back to a shipment, route, stock or clock record.
function storyTransportPresentationResolve(previous, target, nowMs, durationMs) {
    const targetX = Number(target && target.x) || 0;
    const targetY = Number(target && target.y) || 0;
    const now = Number(nowMs) || 0;
    const duration = Math.max(1, Number(durationMs) || 1);
    const sample = track => {
        if (!track) return { x: targetX, y: targetY, active: false };
        const ratio = Math.max(0, Math.min(1,
            (now - Number(track.startedAt || 0)) / Math.max(1, Number(track.durationMs) || 1)));
        return {
            x: Number(track.fromX) + (Number(track.toX) - Number(track.fromX)) * ratio,
            y: Number(track.fromY) + (Number(track.toY) - Number(track.fromY)) * ratio,
            active: ratio < 1
        };
    };
    if (!previous) {
        const track = { fromX: targetX, fromY: targetY, toX: targetX, toY: targetY,
            startedAt: now, durationMs: duration };
        return { track, x: targetX, y: targetY, active: false, targetChanged: false };
    }
    const changed = Math.abs(Number(previous.toX) - targetX) > 1e-7
        || Math.abs(Number(previous.toY) - targetY) > 1e-7;
    if (changed) {
        const current = sample(previous);
        const track = { fromX: current.x, fromY: current.y, toX: targetX, toY: targetY,
            startedAt: now, durationMs: duration };
        return { track, x: current.x, y: current.y, active: true, targetChanged: true };
    }
    const current = sample(previous);
    return { track: previous, x: current.x, y: current.y,
        active: current.active, targetChanged: false };
}

function storyTransportVehicleClass(mode) {
    return mode === 'SEA' ? 'CARGO_SHIP'
        : mode === 'RAIL' ? 'FREIGHT_TRAIN' : 'ROAD_CONVOY';
}

function storyMaritimeConditionLedgerCreate() {
    return { schemaVersion: STORY_MARITIME_CONDITION_SCHEMA_VERSION,
        adapterVersion: STORY_MARITIME_CONDITION_ADAPTER_VERSION,
        revision: 0, corridors: {} };
}

function storyMaritimeConditionReset() {
    STORY.maritimeConditions = storyMaritimeConditionLedgerCreate();
    return STORY.maritimeConditions;
}

function storyMaritimeConditionEnsure() {
    const ledger = STORY.maritimeConditions;
    if (!ledger || Number(ledger.schemaVersion) !== STORY_MARITIME_CONDITION_SCHEMA_VERSION
        || ledger.adapterVersion !== STORY_MARITIME_CONDITION_ADAPTER_VERSION
        || !ledger.corridors || typeof ledger.corridors !== 'object') {
        return storyMaritimeConditionReset();
    }
    return ledger;
}

function storyMaritimeConditionForSave() {
    return storyTransportClone(storyMaritimeConditionEnsure());
}

function storyMaritimeConditionRestore(saved) {
    if (!saved || Number(saved.schemaVersion) !== STORY_MARITIME_CONDITION_SCHEMA_VERSION
        || saved.adapterVersion !== STORY_MARITIME_CONDITION_ADAPTER_VERSION
        || !saved.corridors || typeof saved.corridors !== 'object') {
        return { ok: true, backfilled: true, ledger: storyMaritimeConditionReset() };
    }
    STORY.maritimeConditions = storyTransportClone(saved);
    return { ok: true, backfilled: false, ledger: STORY.maritimeConditions };
}

function storyMaritimeConditionSet(corridorId, spec) {
    const id = String(corridorId || '');
    if (!id) return { ok: false, code: 'MARITIME_CORRIDOR_REQUIRED' };
    const input = spec || {};
    const ledger = storyMaritimeConditionEnsure();
    const condition = {
        corridorId: id,
        weatherFactorBps: Math.max(0, Math.min(10000,
            Math.round(Number(input.weatherFactorBps == null ? 10000 : input.weatherFactorBps)))),
        blockaded: input.blockaded === true,
        blockadedByCountryId: input.blockadedByCountryId == null
            ? null : String(input.blockadedByCountryId),
        reason: input.reason == null ? null : String(input.reason),
        updatedAt: Number(STORY.clock) || 0
    };
    ledger.corridors[id] = condition;
    ledger.revision++;
    return { ok: true, condition: storyTransportClone(condition) };
}

function storyMaritimeConditionClear(corridorId) {
    const ledger = storyMaritimeConditionEnsure();
    const id = String(corridorId || '');
    const changed = Object.prototype.hasOwnProperty.call(ledger.corridors, id);
    if (changed) {
        delete ledger.corridors[id];
        ledger.revision++;
    }
    return { ok: true, changed };
}

function storyMaritimeConditionForCorridor(corridorId) {
    const row = storyMaritimeConditionEnsure().corridors[String(corridorId || '')];
    return row ? storyTransportClone(row) : null;
}

function storyTransportTerminalLedgerCreate() {
    return { schemaVersion: STORY_TRANSPORT_TERMINAL_SCHEMA_VERSION,
        adapterVersion: STORY_TRANSPORT_TERMINAL_ADAPTER_VERSION,
        revision: 0, terminals: {} };
}

function storyTransportTerminalReset() {
    STORY.transportTerminals = storyTransportTerminalLedgerCreate();
    return STORY.transportTerminals;
}

function storyTransportTerminalEnsure() {
    if (!STORY.transportTerminals
        || Number(STORY.transportTerminals.schemaVersion) !== STORY_TRANSPORT_TERMINAL_SCHEMA_VERSION
        || STORY.transportTerminals.adapterVersion !== STORY_TRANSPORT_TERMINAL_ADAPTER_VERSION) {
        return storyTransportTerminalReset();
    }
    return STORY.transportTerminals;
}

function storyTransportTerminalForSave() {
    return storyTransportClone(storyTransportTerminalEnsure());
}

function storyTransportTerminalRestore(saved) {
    if (!saved || Number(saved.schemaVersion) !== STORY_TRANSPORT_TERMINAL_SCHEMA_VERSION
        || saved.adapterVersion !== STORY_TRANSPORT_TERMINAL_ADAPTER_VERSION
        || !saved.terminals || typeof saved.terminals !== 'object') {
        return { ok: true, backfilled: true, ledger: storyTransportTerminalReset() };
    }
    STORY.transportTerminals = storyTransportClone(saved);
    return { ok: true, backfilled: false, ledger: STORY.transportTerminals };
}

function storyTransportTerminalKey(mode, cellIndex, operation) {
    return String(mode) + ':' + String(cellIndex) + ':' + String(operation);
}

function storyTransportTerminalRequest(shipment, operation) {
    const agent = shipment && shipment.transportAgent;
    if (!agent) return { ok: false, code: 'TRANSPORT_AGENT_REQUIRED' };
    const transferring = operation === 'TRANSFER';
    const terminalMode = transferring ? String(agent.transferToMode || agent.mode) : agent.mode;
    const cellIndex = operation === 'UNLOAD'
        ? Number(agent.nextCellIndex) : Number(agent.currentCellIndex);
    const operationKey = transferring
        ? `TRANSFER:${agent.mode}>${terminalMode}` : operation;
    const key = storyTransportTerminalKey(terminalMode, cellIndex, operationKey);
    const ledger = storyTransportTerminalEnsure();
    const slots = transferring ? Math.min(STORY_TRANSPORT_TERMINAL_SLOTS[agent.mode] || 1,
        STORY_TRANSPORT_TERMINAL_SLOTS[terminalMode] || 1)
        : STORY_TRANSPORT_TERMINAL_SLOTS[terminalMode] || 1;
    const terminal = ledger.terminals[key] || (ledger.terminals[key] = {
        key, mode: terminalMode, cellIndex, operation: operationKey, slots, active: [], queue: []
    });
    if (terminal.active.includes(agent.id)) {
        agent.terminalKey = key;
        agent.terminalQueuePosition = 0;
        return { ok: true, admitted: true, terminal };
    }
    if (!terminal.queue.includes(agent.id)) terminal.queue.push(agent.id);
    if (terminal.active.length < terminal.slots && terminal.queue[0] === agent.id) {
        terminal.queue.shift();
        terminal.active.push(agent.id);
        agent.terminalKey = key;
        agent.terminalQueuePosition = 0;
        agent.terminalWindow = { admittedAt: Number(STORY.clock) || 0,
            operation: operationKey, mode: terminalMode,
            plannedReleaseAt: storyTransportRound((Number(STORY.clock) || 0)
                + Math.max(0, Number(agent.phaseRemainingSeconds) || 0)) };
        ledger.revision++;
        return { ok: true, admitted: true, terminal };
    }
    agent.terminalKey = key;
    agent.terminalQueuePosition = terminal.queue.indexOf(agent.id) + 1;
    return { ok: true, admitted: false, position: agent.terminalQueuePosition,
        terminal };
}

function storyTransportTerminalRelease(shipment) {
    const agent = shipment && shipment.transportAgent;
    if (!agent || !agent.terminalKey) return { ok: true, changed: false };
    const ledger = storyTransportTerminalEnsure();
    const terminal = ledger.terminals[agent.terminalKey];
    if (!terminal) {
        agent.terminalKey = null;
        agent.terminalWindow = null;
        agent.terminalQueuePosition = null;
        return { ok: true, changed: false };
    }
    const before = terminal.active.length + terminal.queue.length;
    terminal.active = terminal.active.filter(id => id !== agent.id);
    terminal.queue = terminal.queue.filter(id => id !== agent.id);
    agent.terminalKey = null;
    agent.terminalWindow = null;
    agent.terminalQueuePosition = null;
    if (terminal.active.length + terminal.queue.length !== before) ledger.revision++;
    return { ok: true, changed: terminal.active.length + terminal.queue.length !== before };
}

function storyTransportSteps(route) {
    const steps = [];
    for (let legIndex = 0; legIndex < (route.microLegs || []).length; legIndex++) {
        const leg = route.microLegs[legIndex];
        const ids = leg.segmentIds || [];
        const cells = leg.cellIndices || [];
        const registry = storyHexInfrastructureSegmentsEnsure();
        const weights = ids.map(id => {
            const segment = registry && registry.segmentById[id];
            return Math.max(0.001, Number(segment && segment.lengthWorld) || 1);
        });
        const totalWeight = weights.reduce((sum, value) => sum + value, 0) || ids.length || 1;
        const legDuration = Math.max(0.001,
            Number(leg.plannedLatencySeconds) || Number(route.totalLatencySeconds) || 1);
        for (let index = 0; index < ids.length; index++) {
            steps.push({
                stepIndex: steps.length,
                legIndex,
                corridorId: String(leg.corridorId),
                mode: String(leg.mode),
                segmentId: String(ids[index]),
                fromCellIndex: Number(cells[index]),
                toCellIndex: Number(cells[index + 1]),
                plannedDurationSeconds: storyTransportRound(
                    legDuration * weights[index] / totalWeight)
            });
        }
    }
    return steps;
}

function storyTransportAttachShipment(shipment, route, reservation) {
    const steps = storyTransportSteps(route);
    if (!steps.length) return { ok: false, code: 'PHYSICAL_ROUTE_EMPTY' };
    shipment.transportVersion = STORY_TRANSPORT_SCHEMA_VERSION;
    shipment.transportAdapterVersion = STORY_TRANSPORT_ADAPTER_VERSION;
    shipment.routeId = String(route.routeId);
    shipment.routeReservationId = reservation && reservation.id || null;
    const transferCount = (route.transferRegionIds || []).length;
    const movingSeconds = (route.microLegs || []).reduce((sum, leg) =>
        sum + Math.max(0, Number(leg.plannedLatencySeconds) || 0), 0);
    const transferDurationSeconds = transferCount > 0
        ? Math.max(0, (Number(route.totalLatencySeconds) - movingSeconds) / transferCount)
        : 0;
    shipment.physicalRoute = {
        routeId: String(route.routeId),
        modes: (route.modes || []).map(String),
        corridorIds: (route.corridorIds || []).map(String),
        segmentIds: (route.segmentIds || []).map(String),
        transferRegionIds: (route.transferRegionIds || []).map(String),
        transferDurationSeconds: storyTransportRound(transferDurationSeconds),
        reliabilityBps: Number(route.reliabilityBps) || 0,
        plannedLatencySeconds: storyTransportRound(route.totalLatencySeconds),
        steps
    };
    shipment.transportAgent = {
        id: 'transport-agent:' + shipment.id,
        vehicleClass: storyTransportVehicleClass(steps[0].mode),
        mode: steps[0].mode,
        state: 'QUEUED',
        materialization: 'AGGREGATED',
        cargoShipmentId: shipment.id,
        cargoQuantity: Number(shipment.quantity),
        stepIndex: 0,
        stepProgressBps: 0,
        phaseRemainingSeconds: STORY_TRANSPORT_LOADING_SECONDS,
        currentCellIndex: steps[0].fromCellIndex,
        nextCellIndex: steps[0].toCellIndex,
        enteredStepAt: Number(STORY.clock) || 0,
        movedSeconds: 0,
        waitingSeconds: 0
    };
    const terminal = storyTransportTerminalRequest(shipment, 'LOAD');
    if (terminal.ok && terminal.admitted) shipment.transportAgent.state = 'LOADING';
    return { ok: true, shipment };
}

function storyTransportReleaseReservation(shipment, reason) {
    storyTransportTerminalRelease(shipment);
    if (!shipment || !shipment.routeReservationId
        || typeof storyRoutePlannerRelease !== 'function') return { ok: true, changed: false };
    const released = storyRoutePlannerRelease(
        shipment.routeReservationId, reason || 'SHIPMENT_FINISHED');
    if (released.ok) shipment.routeReservationReleasedAt = Number(STORY.clock) || 0;
    return released;
}

function storyTransportReplaceRoute(shipment, route, reason) {
    if (!shipment || !route || !route.ok) {
        return { ok: false, code: 'VALID_SHIPMENT_ROUTE_REQUIRED' };
    }
    const replaced = typeof storyRoutePlannerReplaceReservation === 'function'
        ? storyRoutePlannerReplaceReservation(
            shipment.routeReservationId, route, shipment.quantity, {
                ownerId: shipment.id,
                durationSeconds: Math.max(3600,
                    Number(route.totalLatencySeconds || 0) * 10),
                reason: reason || 'SHIPMENT_REROUTED'
            })
        : { ok: false, code: 'ROUTE_REPLACEMENT_API_MISSING' };
    if (!replaced.ok) return replaced;
    const attached = storyTransportAttachShipment(
        shipment, route, replaced.reservation);
    return attached.ok ? { ok: true, reservation: replaced.reservation,
        previous: replaced.previous, shipment } : attached;
}

function storyTransportSegmentFactor(segment) {
    return typeof storyHexInfrastructureSegmentFactorBps === 'function'
        ? storyHexInfrastructureSegmentFactorBps(segment) : 10000;
}

function storyTransportAdvanceShipment(shipment, dtSec) {
    const agent = shipment && shipment.transportAgent;
    const route = shipment && shipment.physicalRoute;
    if (!agent || !route || !Array.isArray(route.steps)) {
        return { moved: false, held: true, status: shipment && shipment.status,
            code: 'TRANSPORT_AGENT_INVALID' };
    }
    let budget = Math.max(0, Number(dtSec) || 0);
    let moved = false;
    while (budget > 1e-9 && ['IN_TRANSIT', 'HELD'].includes(shipment.status)) {
        if (agent.state === 'QUEUED') {
            const operation = agent.transferToMode ? 'TRANSFER'
                : agent.stepIndex >= route.steps.length ? 'UNLOAD' : 'LOAD';
            const terminal = storyTransportTerminalRequest(shipment, operation);
            if (!terminal.ok || !terminal.admitted) {
                agent.waitingSeconds = storyTransportRound(agent.waitingSeconds + budget);
                shipment.interruptionSeconds = storyTradeRound(
                    Number(shipment.interruptionSeconds || 0) + budget);
                return { moved, queued: true, held: false, status: shipment.status,
                    queuePosition: terminal.position || 0 };
            }
            agent.state = operation === 'LOAD' ? 'LOADING'
                : operation === 'TRANSFER' ? 'TRANSFERRING' : 'UNLOADING';
        }
        if (agent.state === 'LOADING' || agent.state === 'UNLOADING'
            || agent.state === 'TRANSFERRING') {
            shipment.status = 'IN_TRANSIT';
            shipment.holdReason = null;
            const used = Math.min(budget, Math.max(0, Number(agent.phaseRemainingSeconds) || 0));
            agent.phaseRemainingSeconds = storyTransportRound(
                Math.max(0, agent.phaseRemainingSeconds - used));
            budget -= used;
            if (agent.phaseRemainingSeconds > 1e-9) break;
            if (agent.state === 'LOADING') {
                storyTransportTerminalRelease(shipment);
                agent.state = 'MOVING';
                agent.enteredStepAt = Number(STORY.clock) || 0;
            } else if (agent.state === 'TRANSFERRING') {
                const nextMode = String(agent.transferToMode || agent.mode);
                storyTransportTerminalRelease(shipment);
                agent.mode = nextMode;
                agent.vehicleClass = storyTransportVehicleClass(nextMode);
                agent.transferFromMode = null;
                agent.transferToMode = null;
                agent.state = 'MOVING';
                agent.enteredStepAt = Number(STORY.clock) || 0;
            } else {
                storyTransportTerminalRelease(shipment);
                const completed = storyTradeCompleteShipment(shipment);
                return { moved, held: !completed.ok,
                    status: shipment.status, completion: completed };
            }
            continue;
        }
        const step = route.steps[agent.stepIndex];
        if (!step) {
            agent.state = 'QUEUED';
            agent.phaseRemainingSeconds = STORY_TRANSPORT_UNLOADING_SECONDS;
            continue;
        }
        const registry = (typeof STORY !== 'undefined' && STORY.hexInfrastructureSegments)
            || storyHexInfrastructureSegmentsEnsure();
        const segment = registry && registry.segmentById[step.segmentId];
        const corridor = typeof storyInfrastructureGetCorridor === 'function'
            ? storyInfrastructureGetCorridor(step.corridorId) : null;
        const ledger = typeof storyTradeEnsure === 'function' ? storyTradeEnsure() : null;
        let contract = null;
        if (ledger) {
            if (!ledger._contractsById || ledger._contractsByIdRevision !== (ledger.contracts || []).length) {
                ledger._contractsById = new Map((ledger.contracts || []).map(item => [item.id, item]));
                ledger._contractsByIdRevision = (ledger.contracts || []).length;
            }
            contract = ledger._contractsById.get(shipment.contractId);
        }
        const access = corridor && contract
            && typeof storyInfrastructureAuthorizedCountriesCanUse === 'function'
            ? storyInfrastructureAuthorizedCountriesCanUse(
                corridor, contract.partyCountryIds) : !!corridor;
        const macroFactorBps = corridor && corridor.enabled && access
            ? Math.max(0, 10000 - (Number(corridor.damageBps) || 0)) : 0;
        const maritime = step.mode === 'SEA'
            ? storyMaritimeConditionForCorridor(step.corridorId) : null;
        const maritimeFactorBps = maritime && maritime.blockaded
            ? 0 : Number(maritime
                ? (maritime.weatherFactorBps == null ? 10000 : maritime.weatherFactorBps)
                : 10000);
        const baseFactorBps = Math.min(
            storyTransportSegmentFactor(segment), macroFactorBps);
        const factorBps = Math.floor(baseFactorBps
            * Math.max(0, Math.min(10000, maritimeFactorBps)) / 10000);
        if (!segment || !corridor || !access || factorBps <= 0) {
            shipment.status = 'HELD';
            shipment.holdReason = maritime && maritime.blockaded ? 'MARITIME_BLOCKADE'
                : maritime && Number(maritime.weatherFactorBps) <= 0
                    ? 'MARITIME_WEATHER_CLOSED'
                    : !segment ? 'PHYSICAL_SEGMENT_MISSING'
                : !corridor ? 'CORRIDOR_MISSING'
                    : !access ? 'TRANSIT_ACCESS_DENIED'
                        : 'PHYSICAL_SEGMENT_BLOCKED';
            agent.state = 'WAITING';
            agent.waitingSeconds = storyTransportRound(agent.waitingSeconds + budget);
            shipment.interruptionSeconds = storyTradeRound(
                Number(shipment.interruptionSeconds || 0) + budget);
            return { moved, held: true, status: shipment.status,
                blockedSegmentId: step.segmentId,
                blockedCorridorId: step.corridorId };
        }
        if (agent.state === 'WAITING') {
            agent.state = 'MOVING';
            shipment.status = 'IN_TRANSIT';
            shipment.holdReason = null;
        }
        const duration = Math.max(0.001, Number(step.plannedDurationSeconds) || 0.001);
        const remainingBps = Math.max(0, 10000 - Number(agent.stepProgressBps || 0));
        const realNeeded = duration * remainingBps / 10000 / (factorBps / 10000);
        const used = Math.min(budget, realNeeded);
        const progress = used * (factorBps / 10000) / duration * 10000;
        agent.stepProgressBps = storyTransportRound(
            Math.min(10000, Number(agent.stepProgressBps || 0) + progress), 3);
        agent.movedSeconds = storyTransportRound(agent.movedSeconds + used);
        shipment.damageDelaySeconds = storyTradeRound(
            Number(shipment.damageDelaySeconds || 0)
            + used * (1 - baseFactorBps / 10000));
        if (step.mode === 'SEA' && maritime) {
            const weatherLoss = Math.max(0, baseFactorBps - factorBps) / 10000;
            shipment.weatherDelaySeconds = storyTradeRound(
                Number(shipment.weatherDelaySeconds || 0) + used * weatherLoss);
        }
        budget -= used;
        moved = moved || used > 0;
        if (agent.stepProgressBps < 9999.999) break;
        agent.currentCellIndex = step.toCellIndex;
        agent.stepIndex++;
        agent.stepProgressBps = 0;
        const next = route.steps[agent.stepIndex];
        const reachedLegBoundary = !next || next.legIndex !== step.legIndex;
        if (reachedLegBoundary) {
            shipment.legIndex = Math.min(shipment.corridorIds.length,
                Number(step.legIndex) + 1);
            shipment.currentRegionId = shipment.routeRegionIds[shipment.legIndex]
                || shipment.targetRegionId;
            if (shipment.pendingRedirectRegionId
                && typeof storyTradeApplyRedirect === 'function') {
                const redirected = storyTradeApplyRedirect(shipment);
                return { moved, held: !redirected.ok, rerouted: !!redirected.ok,
                    status: shipment.status, redirect: redirected };
            }
        }
        if (next) {
            agent.nextCellIndex = next.toCellIndex;
            if (String(next.mode) !== String(step.mode)) {
                agent.transferFromMode = String(step.mode);
                agent.transferToMode = String(next.mode);
                agent.state = 'QUEUED';
                agent.phaseRemainingSeconds = Math.max(0.001,
                    Number(route.transferDurationSeconds)
                    || STORY_TRANSPORT_TRANSFER_FALLBACK_SECONDS);
            } else {
                agent.mode = next.mode;
                agent.vehicleClass = storyTransportVehicleClass(next.mode);
                agent.enteredStepAt = Number(STORY.clock) || 0;
            }
        } else {
            shipment.legIndex = shipment.corridorIds.length;
            shipment.currentRegionId = shipment.targetRegionId;
            agent.nextCellIndex = agent.currentCellIndex;
            agent.state = 'QUEUED';
            agent.phaseRemainingSeconds = STORY_TRANSPORT_UNLOADING_SECONDS;
        }
    }
    return { moved, held: shipment.status === 'HELD', status: shipment.status };
}

function storyTransportShipmentValidate(shipment) {
    const issues = [];
    if (!shipment || Number(shipment.transportVersion) !== STORY_TRANSPORT_SCHEMA_VERSION) {
        return { ok: false, issues: ['TRANSPORT_VERSION'] };
    }
    if (shipment.transportAdapterVersion !== STORY_TRANSPORT_ADAPTER_VERSION) {
        issues.push('TRANSPORT_ADAPTER');
    }
    if (!shipment.routeId || !shipment.physicalRoute
        || !Array.isArray(shipment.physicalRoute.steps)
        || !shipment.physicalRoute.steps.length) issues.push('PHYSICAL_ROUTE');
    const agent = shipment.transportAgent;
    const liveAgentStates = ['QUEUED', 'LOADING', 'MOVING', 'WAITING',
        'TRANSFERRING', 'UNLOADING'];
    const terminalAgentState = {
        DELIVERED: 'DELIVERED',
        LOST: 'LOST',
        RETURNED: 'RETURNED'
    }[shipment.status];
    const agentStateMatchesShipment = ['IN_TRANSIT', 'HELD'].includes(shipment.status)
        ? !!agent && liveAgentStates.includes(agent.state)
        : !!agent && !!terminalAgentState && agent.state === terminalAgentState;
    if (!agent || agent.cargoShipmentId !== shipment.id
        || !agentStateMatchesShipment
        || !Number.isInteger(Number(agent.stepIndex))
        || Number(agent.stepIndex) < 0
        || Number(agent.stepIndex) > shipment.physicalRoute.steps.length) {
        issues.push('TRANSPORT_AGENT');
    }
    return { ok: issues.length === 0, issues };
}

function storyTransportProjection(shipment, world) {
    const agent = shipment && shipment.transportAgent;
    const route = shipment && shipment.physicalRoute;
    const hexWorld = world || (typeof storyHexWorldEnsure === 'function'
        ? storyHexWorldEnsure() : null);
    if (!agent || !route || !hexWorld || !Array.isArray(route.steps)
        || !hexWorld.centerX || !hexWorld.centerY) return null;
    const steps = route.steps;
    const stepIndex = Math.max(0, Math.min(steps.length,
        Math.floor(Number(agent.stepIndex) || 0)));
    const step = steps[Math.min(stepIndex, Math.max(0, steps.length - 1))];
    if (!step) return null;
    const fromCellIndex = stepIndex >= steps.length
        ? Number(step.toCellIndex) : Number(step.fromCellIndex);
    const toCellIndex = Number(step.toCellIndex);
    if (!Number.isInteger(fromCellIndex) || !Number.isInteger(toCellIndex)
        || fromCellIndex < 0 || fromCellIndex >= hexWorld.cellCount
        || toCellIndex < 0 || toCellIndex >= hexWorld.cellCount) return null;
    const progress = stepIndex >= steps.length ? 1
        : Math.max(0, Math.min(1, Number(agent.stepProgressBps || 0) / 10000));
    const fromX = Number(hexWorld.centerX[fromCellIndex]);
    const fromY = Number(hexWorld.centerY[fromCellIndex]);
    const toX = Number(hexWorld.centerX[toCellIndex]);
    const toY = Number(hexWorld.centerY[toCellIndex]);
    const phaseDurationSeconds = agent.state === 'LOADING'
        ? STORY_TRANSPORT_LOADING_SECONDS
        : agent.state === 'UNLOADING'
            ? STORY_TRANSPORT_UNLOADING_SECONDS
            : agent.state === 'TRANSFERRING'
                ? Math.max(STORY_TRANSPORT_TRANSFER_FALLBACK_SECONDS,
                    Number(route.transferDurationSeconds) || 0)
                : 0;
    const phaseRemainingSeconds = Math.max(0,
        Number(agent.phaseRemainingSeconds) || 0);
    const phaseProgressBps = phaseDurationSeconds > 0
        ? storyTransportRound(Math.max(0, Math.min(1,
            1 - phaseRemainingSeconds / phaseDurationSeconds)) * 10000, 3)
        : 0;
    return {
        authorityType: 'SHIPMENT',
        authorityId: String(shipment.id),
        shipmentId: String(shipment.id), agentId: String(agent.id),
        journeyId: null, actorId: null, passengerCount: 0,
        vehicleClass: String(agent.vehicleClass), mode: String(agent.mode),
        visualInstalledStage: agent.visualInstalledStage
            ?? agent.installedVisualStage
            ?? shipment.visualInstalledStage
            ?? shipment.installedVisualStage
            ?? 0,
        state: String(agent.state), status: String(shipment.status),
        cargoQuantity: Number(shipment.quantity) || 0,
        resourceId: String(shipment.resourceId || ''), stepIndex,
        progressBps: storyTransportRound(progress * 10000, 3),
        phaseProgressBps,
        phaseRemainingSeconds: storyTransportRound(phaseRemainingSeconds, 3),
        terminalKey: agent.terminalKey == null ? null : String(agent.terminalKey),
        terminalOperation: agent.terminalWindow && agent.terminalWindow.operation
            ? String(agent.terminalWindow.operation) : null,
        terminalQueuePosition: Number.isInteger(Number(agent.terminalQueuePosition))
            ? Number(agent.terminalQueuePosition) : null,
        currentCellIndex: fromCellIndex, nextCellIndex: toCellIndex,
        x: storyTransportRound(fromX + (toX - fromX) * progress),
        y: storyTransportRound(fromY + (toY - fromY) * progress),
        angle: Math.atan2(toY - fromY, toX - fromX)
    };
}

// Character simulation owns creation, routing, ETA and completion. The map
// accepts only an already-canonical journey carrying the same physical route
// and TransportAgentV2 contract as cargo; it never invents a passenger vehicle.
function storyCharacterTravelProjection(journey, world) {
    if (!journey || journey.routeAuthority !== 'CANONICAL'
        || Number(journey.transportVersion) !== STORY_TRANSPORT_SCHEMA_VERSION
        || journey.transportAdapterVersion !== STORY_TRANSPORT_ADAPTER_VERSION
        || !journey.actorId
        || !['QUEUED', 'TRAVELLING', 'HELD'].includes(String(journey.status))) return null;
    const projection = storyTransportProjection(journey, world);
    if (!projection) return null;
    return Object.assign(projection, {
        authorityType: 'CHARACTER_TRAVEL',
        authorityId: String(journey.id),
        shipmentId: null,
        journeyId: String(journey.id),
        actorId: String(journey.actorId),
        cargoQuantity: 0,
        resourceId: '',
        passengerCount: 1,
        status: String(journey.status)
    });
}

function storyTransportPrepareRenderSnapshot(snapshot) {
    const view = snapshot || { agents: [] };
    if (Array.isArray(view.displayAgents)) return view;
    const priority = row => row.journeyId ? 3
        : row.state !== 'MOVING' ? 2 : row.aggregate ? 1 : 0;
    view.displayAgents = (view.agents || []).map(agent => {
        const representedIds = (agent.shipmentIds || [])
            .concat(agent.journeyIds || []).sort().join(',');
        agent.presentationTrackId = agent.aggregate
            ? `aggregate:${agent.vehicleClass}:${representedIds || agent.currentCellIndex}`
            : String(agent.authorityType || 'TRANSPORT') + ':'
                + String(agent.authorityId || agent.agentId);
        agent.presentationPriority = priority(agent);
        return agent;
    }).sort((a, b) => b.presentationPriority - a.presentationPriority
        || String(a.presentationTrackId).localeCompare(String(b.presentationTrackId)));
    return view;
}

function storyTransportRenderSnapshot(options) {
    const opts = options || {};
    const ledger = opts.ledger || (typeof storyTradeEnsure === 'function'
        ? storyTradeEnsure() : null);
    const world = opts.world || (typeof storyHexWorldEnsure === 'function'
        ? storyHexWorldEnsure() : null);
    const materialized = Math.max(0, Number(opts.zoomRatio) || 0)
        >= Math.max(0.1, Number(opts.materializeZoomRatio) || 1.35);
    const projections = [];
    for (const shipment of (ledger && ledger.shipments) || []) {
        if (!['IN_TRANSIT', 'HELD'].includes(shipment.status)
            || Number(shipment.transportVersion) !== STORY_TRANSPORT_SCHEMA_VERSION) continue;
        const projection = storyTransportProjection(shipment, world);
        if (projection) projections.push(projection);
    }
    const characterJourneys = Array.isArray(opts.characterJourneys)
        ? opts.characterJourneys
        : typeof STORY !== 'undefined' && STORY.characterTravel
            && Array.isArray(STORY.characterTravel.journeys)
            ? STORY.characterTravel.journeys : [];
    for (const journey of characterJourneys) {
        const projection = storyCharacterTravelProjection(journey, world);
        if (projection) projections.push(projection);
    }
    const cargoQuantity = storyTransportRound(projections.reduce(
        (sum, row) => sum + row.cargoQuantity, 0));
    const journeyCount = projections.filter(row => row.journeyId).length;
    const passengerCount = projections.reduce(
        (sum, row) => sum + Number(row.passengerCount || 0), 0);
    if (materialized) return storyTransportPrepareRenderSnapshot({
        mode: 'MATERIALIZED', agents: projections,
        shipmentCount: projections.length - journeyCount, journeyCount,
        passengerCount, cargoQuantity });
    const groups = Object.create(null);
    for (const row of projections) {
        const key = row.vehicleClass + ':' + row.currentCellIndex;
        let group = groups[key];
        if (!group) group = groups[key] = Object.assign({}, row, {
            aggregate: true, shipmentIds: [], journeyIds: [],
            shipmentCount: 0, journeyCount: 0, passengerCount: 0, cargoQuantity: 0
        });
        if (row.shipmentId) {
            group.shipmentIds.push(row.shipmentId);
            group.shipmentCount++;
        }
        if (row.journeyId) {
            group.journeyIds.push(row.journeyId);
            group.journeyCount++;
            group.passengerCount += Number(row.passengerCount || 0);
        }
        group.cargoQuantity += row.cargoQuantity;
    }
    const agents = Object.keys(groups).sort().map(key => {
        groups[key].cargoQuantity = storyTransportRound(groups[key].cargoQuantity);
        return groups[key];
    });
    return storyTransportPrepareRenderSnapshot({ mode: 'AGGREGATED', agents,
        shipmentCount: projections.length - journeyCount, journeyCount,
        passengerCount, cargoQuantity });
}

function storyTransportMigrateLegacyShipments() {
    const ledger = typeof storyTradeEnsure === 'function' ? storyTradeEnsure() : null;
    const result = { ok: true, migrated: 0, deferred: 0, issues: [] };
    if (!ledger) return result;
    for (const shipment of ledger.shipments || []) {
        if (!['IN_TRANSIT', 'HELD'].includes(shipment.status)
            || Number(shipment.transportVersion) === STORY_TRANSPORT_SCHEMA_VERSION) continue;
        const contract = (ledger.contracts || []).find(row => row.id === shipment.contractId);
        const sourceRegionId = shipment.currentRegionId || shipment.sourceRegionId;
        const route = contract && typeof storyTradeFindRoute === 'function'
            ? storyTradeFindRoute(sourceRegionId, shipment.targetRegionId,
                contract, shipment.resourceId) : null;
        if (!route || !route.ok || !Array.isArray(route.regionIds)
            || !Array.isArray(route.corridorIds)
            || !Array.isArray(route.microLegs) || !route.microLegs.length) {
            result.deferred++;
            result.issues.push({ shipmentId: shipment.id, code: route && route.code
                || 'LEGACY_PHYSICAL_ROUTE_UNAVAILABLE' });
            continue;
        }
        const reservation = typeof storyRoutePlannerReserve === 'function'
            ? storyRoutePlannerReserve(route, shipment.quantity, {
                ownerId: shipment.id,
                durationSeconds: Math.max(3600,
                    Number(route.totalLatencySeconds || 0) * 10),
                reason: 'LEGACY_SHIPMENT_MIGRATION'
            }) : { ok: false, code: 'ROUTE_RESERVATION_API_MISSING' };
        if (!reservation.ok) {
            result.deferred++;
            result.issues.push({ shipmentId: shipment.id, code: reservation.code });
            continue;
        }
        const attached = storyTransportAttachShipment(shipment, route, reservation.reservation);
        if (!attached.ok) {
            if (typeof storyRoutePlannerRelease === 'function') {
                storyRoutePlannerRelease(reservation.reservation.id,
                    'LEGACY_MIGRATION_ATTACH_FAILED');
            }
            result.deferred++;
            result.issues.push({ shipmentId: shipment.id, code: attached.code });
            continue;
        }
        shipment.routeRegionIds = route.regionIds.slice();
        shipment.corridorIds = route.corridorIds.slice();
        shipment.legIndex = 0;
        shipment.currentRegionId = sourceRegionId;
        shipment.routeCostEstimate = storyTransportRound(
            Number(route.totalCost || 0) * Number(shipment.quantity || 0));
        shipment.routeLatencySeconds = storyTransportRound(route.totalLatencySeconds);
        shipment.legacyTransportMigratedAt = Number(STORY.clock) || 0;
        shipment.legacyTransportStatus = shipment.status;
        result.migrated++;
    }
    ledger.diagnostics = ledger.diagnostics || {};
    ledger.diagnostics.transportMigration = storyTransportClone(result);
    return result;
}
