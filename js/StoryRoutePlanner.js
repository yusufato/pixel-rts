// HIERARCHICAL MULTIMODAL ROUTE PLANNER - HXD-8
// Macro decisions use region corridors. Every selected corridor is expanded
// into the real ordered hex-edge chain before it can reserve capacity.

const STORY_ROUTE_PLANNER_SCHEMA_VERSION = 1;
const STORY_ROUTE_PLANNER_ADAPTER_VERSION = 'story-route-planner-1';
const STORY_ROUTE_PLANNER_MODES = Object.freeze(['LAND', 'RAIL', 'SEA']);
const STORY_ROUTE_PLANNER_RESERVATION_LIMIT = 4096;

function storyRoutePlannerCacheEnsure() {
    if (!STORY._routePlannerCache) STORY._routePlannerCache = new Map();
    if (!STORY._routePlannerCacheBySegment) STORY._routePlannerCacheBySegment = new Map();
    if (!STORY._routePlannerCacheByCorridor) STORY._routePlannerCacheByCorridor = new Map();
    if (!STORY._routePlannerCacheDependencies) STORY._routePlannerCacheDependencies = new Map();
    if (!STORY._routePlannerCacheStats) STORY._routePlannerCacheStats = {
        hits: 0, misses: 0, targetedInvalidations: 0, fullInvalidations: 0
    };
}

function storyRoutePlannerCacheUntrack(cacheKey) {
    storyRoutePlannerCacheEnsure();
    const dependencies = STORY._routePlannerCacheDependencies.get(cacheKey);
    if (dependencies) {
        for (const segmentId of dependencies.segmentIds || []) {
            const keys = STORY._routePlannerCacheBySegment.get(segmentId);
            if (!keys) continue;
            keys.delete(cacheKey);
            if (!keys.size) STORY._routePlannerCacheBySegment.delete(segmentId);
        }
        for (const corridorId of dependencies.corridorIds || []) {
            const keys = STORY._routePlannerCacheByCorridor.get(corridorId);
            if (!keys) continue;
            keys.delete(cacheKey);
            if (!keys.size) STORY._routePlannerCacheByCorridor.delete(corridorId);
        }
    }
    STORY._routePlannerCacheDependencies.delete(cacheKey);
    STORY._routePlannerCache.delete(cacheKey);
}

function storyRoutePlannerCacheTrack(cacheKey, corridorIds, segmentIds) {
    storyRoutePlannerCacheEnsure();
    storyRoutePlannerCacheUntrack(cacheKey);
    const dependencies = {
        corridorIds: [...new Set((corridorIds || []).map(String))],
        segmentIds: [...new Set((segmentIds || []).map(String))]
    };
    STORY._routePlannerCacheDependencies.set(cacheKey, dependencies);
    for (const corridorId of dependencies.corridorIds) {
        if (!STORY._routePlannerCacheByCorridor.has(corridorId)) {
            STORY._routePlannerCacheByCorridor.set(corridorId, new Set());
        }
        STORY._routePlannerCacheByCorridor.get(corridorId).add(cacheKey);
    }
    for (const segmentId of dependencies.segmentIds) {
        if (!STORY._routePlannerCacheBySegment.has(segmentId)) {
            STORY._routePlannerCacheBySegment.set(segmentId, new Set());
        }
        STORY._routePlannerCacheBySegment.get(segmentId).add(cacheKey);
    }
}

function storyRoutePlannerInvalidate(spec) {
    storyRoutePlannerCacheEnsure();
    spec = spec || {};
    if (spec.all) {
        const removed = STORY._routePlannerCache.size;
        STORY._routePlannerCache.clear();
        STORY._routePlannerCacheBySegment.clear();
        STORY._routePlannerCacheByCorridor.clear();
        STORY._routePlannerCacheDependencies.clear();
        STORY._routePlannerCacheStats.fullInvalidations++;
        return { ok: true, removed, full: true };
    }
    const keys = new Set();
    for (const segmentId of spec.segmentIds || []) {
        for (const key of STORY._routePlannerCacheBySegment.get(String(segmentId)) || []) {
            keys.add(key);
        }
    }
    for (const corridorId of spec.corridorIds || []) {
        for (const key of STORY._routePlannerCacheByCorridor.get(String(corridorId)) || []) {
            keys.add(key);
        }
    }
    for (const key of keys) storyRoutePlannerCacheUntrack(key);
    if (keys.size) STORY._routePlannerCacheStats.targetedInvalidations++;
    return { ok: true, removed: keys.size, full: false };
}

function storyRoutePlannerClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyRoutePlannerRound(value, digits) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    const scale = 10 ** (digits == null ? 6 : digits);
    return Math.round(number * scale) / scale;
}

function storyRoutePlannerHashText(text) {
    let hash = 0x811c9dc5;
    const value = String(text || '');
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return 'fnv1a32:' + ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}

function storyRoutePlannerEnsure(state) {
    state = state || STORY;
    if (!state.routePlanning
        || Number(state.routePlanning.schemaVersion) !== STORY_ROUTE_PLANNER_SCHEMA_VERSION) {
        state.routePlanning = {
            schemaVersion: STORY_ROUTE_PLANNER_SCHEMA_VERSION,
            adapterVersion: STORY_ROUTE_PLANNER_ADAPTER_VERSION,
            reservationSequence: 0,
            reservationRevision: 0,
            reservations: []
        };
    }
    const ledger = state.routePlanning;
    ledger.adapterVersion = STORY_ROUTE_PLANNER_ADAPTER_VERSION;
    ledger.reservationSequence = Math.max(0, Number(ledger.reservationSequence) | 0);
    ledger.reservationRevision = Math.max(0, Number(ledger.reservationRevision) | 0);
    if (!Array.isArray(ledger.reservations)) ledger.reservations = [];
    return ledger;
}

function storyRoutePlannerNow(options) {
    return Math.max(0, Number(options && options.now != null
        ? options.now : (typeof STORY !== 'undefined' && STORY.clock)) || 0);
}

function storyRoutePlannerExpire(now) {
    const ledger = storyRoutePlannerEnsure();
    let changed = false;
    const affectedSegmentIds = new Set();
    for (const reservation of ledger.reservations) {
        if (reservation.status === 'ACTIVE'
            && Number.isFinite(Number(reservation.expiresAt))
            && Number(reservation.expiresAt) <= now) {
            reservation.status = 'EXPIRED';
            reservation.releasedAt = now;
            for (const segmentId of reservation.segmentIds || []) {
                affectedSegmentIds.add(String(segmentId));
            }
            changed = true;
        }
    }
    if (changed) {
        ledger.reservationRevision++;
        storyRoutePlannerInvalidate({ segmentIds: [...affectedSegmentIds] });
    }
    if (ledger.reservations.length > STORY_ROUTE_PLANNER_RESERVATION_LIMIT) {
        const active = ledger.reservations.filter(item => item.status === 'ACTIVE');
        const history = ledger.reservations.filter(item => item.status !== 'ACTIVE')
            .slice(-(STORY_ROUTE_PLANNER_RESERVATION_LIMIT - active.length));
        ledger.reservations = history.concat(active);
    }
    return changed;
}

function storyRoutePlannerReservedBySegment(now) {
    storyRoutePlannerExpire(now);
    const totals = new Map();
    for (const reservation of storyRoutePlannerEnsure().reservations) {
        if (reservation.status !== 'ACTIVE') continue;
        for (const segmentId of reservation.segmentIds || []) {
            totals.set(segmentId, storyRoutePlannerRound(
                (totals.get(segmentId) || 0) + Number(reservation.amount || 0)));
        }
    }
    return totals;
}

function storyRoutePlannerSegmentCapacity(segment) {
    if (!segment) return 0;
    const factor = typeof storyHexInfrastructureSegmentFactorBps === 'function'
        ? storyHexInfrastructureSegmentFactorBps(segment) : 10000;
    return Math.max(0, Math.floor((Number(segment.baseCapacity) || 0) * factor / 10000));
}

function storyRoutePlannerPerceptionNormalize(view, now) {
    if (!view || typeof view !== 'object' || !Array.isArray(view.reports)) {
        return { ok: false, reason: 'PERCEPTION_REQUIRED' };
    }
    const bySubject = new Map();
    const reports = view.reports.slice().sort((a, b) =>
        String(a && a.id).localeCompare(String(b && b.id)));
    for (const report of reports) {
        const type = String(report && report.subjectType || '').toUpperCase();
        const subjectId = String(report && report.subjectId || '');
        const status = String(report && report.status || '').toUpperCase();
        const confidence = Math.max(0, Math.min(10000,
            Number(report && report.confidenceBps) || 0));
        if (!['SEGMENT', 'CORRIDOR'].includes(type) || !subjectId
            || !['UNKNOWN', 'RUMOR', 'ESTIMATED', 'VERIFIED'].includes(status)) continue;
        if (report.expiresAt != null && Number(report.expiresAt) <= now) continue;
        if (status === 'UNKNOWN' && confidence !== 0) continue;
        if (status === 'VERIFIED' && confidence !== 10000) continue;
        if (['RUMOR', 'ESTIMATED'].includes(status)
            && (confidence <= 0 || confidence >= 10000)) continue;
        const key = type + ':' + subjectId;
        const previous = bySubject.get(key);
        if (!previous || confidence > previous.confidenceBps
            || (confidence === previous.confidenceBps
                && Number(report.observedAt || 0) > Number(previous.observedAt || 0))) {
            bySubject.set(key, {
                id: String(report.id), subjectType: type, subjectId, status,
                confidenceBps: confidence,
                observedAt: Math.max(0, Number(report.observedAt) || 0),
                expiresAt: report.expiresAt == null ? null : Number(report.expiresAt),
                value: report.value && typeof report.value === 'object'
                    ? storyRoutePlannerClone(report.value) : null
            });
        }
    }
    const stable = [...bySubject.values()].sort((a, b) =>
        (a.subjectType + ':' + a.subjectId).localeCompare(
            b.subjectType + ':' + b.subjectId));
    const observerId = String(view.observerId || 'UNKNOWN_OBSERVER');
    return { ok: true, observerId,
        revision: Math.max(0, Number(view.revision) || 0), bySubject,
        fingerprint: storyRoutePlannerHashText(
            observerId + '|' + JSON.stringify(stable)) };
}

function storyRoutePlannerPerceivedFactor(subject, subjectType, options) {
    if (options.knowledgeMode !== 'PERCEIVED') {
        const factor = subjectType === 'SEGMENT'
            ? storyHexInfrastructureSegmentFactorBps(subject)
            : Math.max(0, subject.enabled
                ? 10000 - (Number(subject.damageBps) || 0) : 0);
        return { factorBps: factor, uncertain: false, observationId: null };
    }
    const perception = options._perception;
    const report = perception && perception.bySubject.get(
        subjectType + ':' + String(subject.id));
    if (report && report.status !== 'UNKNOWN' && report.value) {
        const enabled = report.value.enabled !== false;
        const damage = Math.max(0, Math.min(10000,
            Number(report.value.damageBps) || 0));
        const maintenance = subjectType === 'SEGMENT'
            ? Math.max(0, Math.min(10000,
                report.value.maintenanceBps == null
                    ? 10000 : Number(report.value.maintenanceBps)))
            : 10000;
        const reportedFactor = enabled
            ? Math.floor((10000 - damage) * maintenance / 10000) : 0;
        const cautious = Math.max(1, Math.min(9999,
            Number(options.unknownReliabilityBps) || 6500));
        const confidenceWeight = report.status === 'VERIFIED' ? 10000
            : report.status === 'RUMOR'
                ? Math.floor(report.confidenceBps / 2) : report.confidenceBps;
        const blendedFactor = Math.floor(
            (reportedFactor * confidenceWeight
                + cautious * (10000 - confidenceWeight)) / 10000);
        return { factorBps: blendedFactor,
        uncertain: report.status !== 'VERIFIED',
        observationId: report.id };
    }
    const policy = String(options.unknownPolicy || 'CAUTIOUS').toUpperCase();
    const fallback = policy === 'BLOCK_UNKNOWN' ? 0
        : policy === 'ASSUME_NOMINAL' ? 10000
            : Math.max(1, Math.min(9999,
                Number(options.unknownReliabilityBps) || 6500));
    return { factorBps: fallback, uncertain: true, observationId: null };
}

function storyRoutePlannerPhysicalLeg(corridor, fromRegionId, registry) {
    const sourcePath = registry && registry.corridorCellPaths
        && registry.corridorCellPaths[corridor.id];
    const sourceSegmentIds = registry && registry.corridorSegmentIds
        && registry.corridorSegmentIds[corridor.id];
    if (!Array.isArray(sourcePath) || sourcePath.length < 2
        || !Array.isArray(sourceSegmentIds) || !sourceSegmentIds.length) {
        return { ok: false, reason: 'PHYSICAL_CORRIDOR_MISSING', corridorId: corridor.id };
    }
    // Topology is immutable until the registry is reset. Build the ordered
    // corridor-edge lookup once instead of scanning ~955 world segments for
    // every hex step of every shipment plan.
    if (!registry._routeOrderedLegs) registry._routeOrderedLegs = {};
    let ordered = registry._routeOrderedLegs[corridor.id];
    if (!ordered) {
        const byEdge = new Map();
        for (const segmentId of sourceSegmentIds) {
            const segment = registry.segmentById && registry.segmentById[segmentId];
            const endpoints = segment && segment.endpointCellIndices || [];
            if (endpoints.length === 2) {
                byEdge.set(Number(endpoints[0]) + ':' + Number(endpoints[1]), segment);
            }
        }
        const forwardSegmentIds = [];
        for (let index = 1; index < sourcePath.length; index++) {
            const a = Number(sourcePath[index - 1]), b = Number(sourcePath[index]);
            const segment = byEdge.get(Math.min(a, b) + ':' + Math.max(a, b));
            if (!segment) return { ok: false, reason: 'PHYSICAL_CHAIN_BROKEN',
                corridorId: corridor.id, fromCellIndex: a, toCellIndex: b };
            forwardSegmentIds.push(segment.id);
        }
        ordered = { cellIndices: sourcePath.slice(), segmentIds: forwardSegmentIds };
        registry._routeOrderedLegs[corridor.id] = ordered;
    }
    const forward = String(corridor.endpointRegionIds[0]) === String(fromRegionId);
    const cellIndices = forward
        ? ordered.cellIndices.slice() : ordered.cellIndices.slice().reverse();
    const segmentIds = forward
        ? ordered.segmentIds.slice() : ordered.segmentIds.slice().reverse();
    const other = corridor.endpointRegionIds.find(
        id => String(id) !== String(fromRegionId));
    return { ok: true, corridorId: corridor.id, mode: corridor.mode,
        fromRegionId: String(fromRegionId), toRegionId: String(other),
        cellIndices, segmentIds };
}

function storyRoutePlannerAccessAllowed(corridor, options) {
    if (Array.isArray(options.authorizedCountryIds)
        && typeof storyInfrastructureAuthorizedCountriesCanUse === 'function') {
        return storyInfrastructureAuthorizedCountriesCanUse(
            corridor, options.authorizedCountryIds.map(String));
    }
    if (typeof storyInfrastructureActorCanUse === 'function') {
        return storyInfrastructureActorCanUse(corridor,
            options.actorCountryId == null ? null : String(options.actorCountryId));
    }
    return true;
}

function storyRoutePlannerCandidate(corridor, fromRegionId, registry, reserved, demand, options) {
    if (!corridor || !storyRoutePlannerAccessAllowed(corridor, options)) {
        return null;
    }
    const leg = storyRoutePlannerPhysicalLeg(corridor, fromRegionId, registry);
    if (!leg.ok) return null;
    const corridorPerception = storyRoutePlannerPerceivedFactor(
        corridor, 'CORRIDOR', options);
    let bottleneck = Math.floor((Number(corridor.baseCapacity) || 0)
        * corridorPerception.factorBps / 10000);
    let reliabilityBps = corridorPerception.factorBps;
    let lengthWorld = 0;
    const uncertainSegmentIds = [];
    const observationIds = corridorPerception.observationId
        ? [corridorPerception.observationId] : [];
    if (corridorPerception.uncertain) uncertainSegmentIds.push('corridor:' + corridor.id);
    for (const segmentId of leg.segmentIds) {
        const segment = registry.segmentById && registry.segmentById[segmentId];
        if (!segment || String(segment.mode) !== String(corridor.mode)) return null;
        const perceived = storyRoutePlannerPerceivedFactor(
            segment, 'SEGMENT', options);
        const factor = perceived.factorBps;
        const available = Math.max(0, Math.floor(
            (Number(segment.baseCapacity) || 0) * factor / 10000)
            - (reserved.get(segmentId) || 0));
        bottleneck = Math.min(bottleneck, available);
        reliabilityBps = Math.min(reliabilityBps, factor);
        if (perceived.uncertain) uncertainSegmentIds.push(segmentId);
        if (perceived.observationId) observationIds.push(perceived.observationId);
        lengthWorld += Math.max(0, Number(segment.lengthWorld) || 0);
    }
    if (bottleneck <= 0 || bottleneck + 1e-9 < demand) return null;
    const reliabilityRatio = Math.max(0.05, reliabilityBps / 10000);
    leg.uncertainSegmentIds = uncertainSegmentIds;
    leg.observationIds = [...new Set(observationIds)];
    leg.plannedLatencySeconds = storyRoutePlannerRound(
        Math.max(0, Number(corridor.latencySeconds) || 0)
        / Math.max(0.05, reliabilityBps / 10000));
    leg.plannedCostPerUnit = storyRoutePlannerRound(
        Math.max(0, Number(corridor.costPerUnit) || 0));
    leg.reliabilityBps = reliabilityBps;
    leg.bottleneckCapacity = bottleneck;
    return { corridor, leg, capacity: bottleneck, reliabilityBps,
        lengthWorld: storyRoutePlannerRound(lengthWorld),
        cost: Math.max(0, Number(corridor.costPerUnit) || 0),
        latency: Math.max(0, Number(corridor.latencySeconds) || 0) / reliabilityRatio };
}

function storyRoutePlannerCacheKey(from, to, modes, demand, options, graph, registry, ledger) {
    // Corridor access depends on live ownership as well as the static network.
    // A conquest must not reuse a route cached under the previous border regime.
    const ownershipFingerprint = storyRoutePlannerHashText(
        ((STORY && STORY.nodes) || []).map(node =>
            String(node && node.id) + ':' + String(node && node.owner)).join('|'));
    return [from, to, modes.join(','), storyRoutePlannerRound(demand),
        options.actorCountryId == null ? '' : String(options.actorCountryId),
        (options.authorizedCountryIds || []).map(String).sort().join(','),
        storyRoutePlannerRound(options.transferCost == null ? 8 : options.transferCost),
        storyRoutePlannerRound(options.transferLatencySeconds == null
            ? 25 : options.transferLatencySeconds),
        storyRoutePlannerRound(options.reliabilityWeight == null
            ? 0.5 : options.reliabilityWeight),
        String(options.knowledgeMode || 'TRUTH'),
        options._perception ? options._perception.fingerprint : '',
        String(options.unknownPolicy || 'CAUTIOUS'),
        storyRoutePlannerRound(options.unknownReliabilityBps || 6500),
        graph.networkHash || '', ownershipFingerprint,
        registry.topologyHash || ''].join('|');
}

function storyRoutePlannerPlan(fromRegionId, toRegionId, rawOptions) {
    const options = Object.assign({}, rawOptions || {});
    const graph = typeof storyInfrastructureEnsure === 'function'
        ? storyInfrastructureEnsure() : null;
    const registry = typeof storyHexInfrastructureSegmentsEnsure === 'function'
        ? storyHexInfrastructureSegmentsEnsure() : null;
    if (!graph || !registry) return { ok: false, reason: 'ROUTE_FOUNDATION_UNAVAILABLE' };
    const from = String(fromRegionId), to = String(toRegionId);
    options.knowledgeMode = String(options.knowledgeMode || 'TRUTH').toUpperCase();
    if (!['TRUTH', 'PERCEIVED'].includes(options.knowledgeMode)) {
        return { ok: false, reason: 'KNOWLEDGE_MODE_INVALID' };
    }
    if (options.knowledgeMode === 'PERCEIVED') {
        options._perception = storyRoutePlannerPerceptionNormalize(
            options.networkView, storyRoutePlannerNow(options));
        if (!options._perception.ok) return options._perception;
    }
    const regions = new Set(((STORY.regionModel && STORY.regionModel.regions) || [])
        .map(region => String(region.id)));
    if (!regions.has(from) || !regions.has(to)) {
        return { ok: false, reason: 'REGION_NOT_FOUND', regionIds: [], corridorIds: [] };
    }
    if (from === to) return { ok: true, routeId: storyRoutePlannerHashText(from),
        regionIds: [from], corridorIds: [], modes: [], microLegs: [], segmentIds: [],
        transferRegionIds: [], totalCost: 0, totalLatencySeconds: 0,
        reliabilityBps: 10000, bottleneckCapacity: Infinity, cacheHit: false };
    const modes = [...new Set((Array.isArray(options.modes) && options.modes.length
        ? options.modes : STORY_ROUTE_PLANNER_MODES).map(value => String(value).toUpperCase())
        .filter(mode => STORY_ROUTE_PLANNER_MODES.includes(mode)))].sort();
    if (!modes.length) return { ok: false, reason: 'MODE_NOT_SUPPORTED' };
    const demand = Math.max(0, Number(options.minCapacity) || Number(options.amount) || 0);
    const now = storyRoutePlannerNow(options);
    const ledger = storyRoutePlannerEnsure();
    const reserved = storyRoutePlannerReservedBySegment(now);
    const cacheEnabled = options.useCache !== false;
    const cacheKey = cacheEnabled
        ? storyRoutePlannerCacheKey(from, to, modes, demand,
            options, graph, registry, ledger) : null;
    if (cacheEnabled) {
        storyRoutePlannerCacheEnsure();
        const cached = STORY._routePlannerCache.get(cacheKey);
        if (cached) {
            STORY._routePlannerCacheStats.hits++;
            return Object.assign(storyRoutePlannerClone(cached), { cacheHit: true });
        }
        STORY._routePlannerCacheStats.misses++;
    }

    const transferCost = Math.max(0, Number(options.transferCost == null ? 8 : options.transferCost));
    const transferLatency = Math.max(0, Number(options.transferLatencySeconds == null
        ? 25 : options.transferLatencySeconds));
    const reliabilityWeight = Math.max(0, Number(options.reliabilityWeight == null
        ? 0.5 : options.reliabilityWeight));
    const adjacency = new Map();
    const dependencyCorridorIds = [];
    const dependencySegmentIds = [];
    for (const corridor of graph.corridors || []) {
        if (!modes.includes(String(corridor.mode))) continue;
        dependencyCorridorIds.push(String(corridor.id));
        for (const segmentId of registry.corridorSegmentIds[corridor.id] || []) {
            dependencySegmentIds.push(String(segmentId));
        }
        const endpoints = corridor.endpointRegionIds || [];
        if (endpoints.length !== 2) continue;
        const directions = [[String(endpoints[0]), String(endpoints[1])],
            [String(endpoints[1]), String(endpoints[0])]];
        for (const direction of directions) {
            const candidate = storyRoutePlannerCandidate(
                corridor, direction[0], registry, reserved, demand, options);
            if (!candidate) continue;
            if (!adjacency.has(direction[0])) adjacency.set(direction[0], []);
            adjacency.get(direction[0]).push(Object.assign(candidate, { next: direction[1] }));
        }
    }
    for (const edges of adjacency.values()) edges.sort((a, b) =>
        String(a.corridor.id).localeCompare(String(b.corridor.id)));

    const startKey = from + '|-';
    const best = new Map([[startKey, { regionId: from, lastMode: null,
        score: 0, tieKey: '', regionIds: [from], corridorIds: [], modes: [],
        microLegs: [], cost: 0, latency: 0, reliabilityBps: 10000,
        bottleneck: Infinity, transferRegionIds: [] }]]);
    const open = [startKey];
    let winner = null;
    while (open.length) {
        open.sort((a, b) => {
            const av = best.get(a), bv = best.get(b);
            return av.score - bv.score || av.tieKey.localeCompare(bv.tieKey);
        });
        const key = open.shift(), state = best.get(key);
        if (state.regionId === to) { winner = state; break; }
        for (const edge of adjacency.get(state.regionId) || []) {
            const transfer = !!state.lastMode && state.lastMode !== edge.corridor.mode;
            const nextCost = state.cost + edge.cost + (transfer ? transferCost : 0);
            const nextLatency = state.latency + edge.latency + (transfer ? transferLatency : 0);
            const nextReliability = Math.min(state.reliabilityBps, edge.reliabilityBps);
            const score = nextCost + nextLatency
                + (10000 - nextReliability) / 100 * reliabilityWeight;
            const corridorIds = state.corridorIds.concat(edge.corridor.id);
            const tieKey = corridorIds.join('|');
            const nextKey = edge.next + '|' + edge.corridor.mode;
            const previous = best.get(nextKey);
            if (!previous || score < previous.score - 1e-9
                || (Math.abs(score - previous.score) <= 1e-9
                    && tieKey.localeCompare(previous.tieKey) < 0)) {
                best.set(nextKey, { regionId: edge.next, lastMode: edge.corridor.mode,
                    score, tieKey, regionIds: state.regionIds.concat(edge.next),
                    corridorIds, modes: state.modes.concat(edge.corridor.mode),
                    microLegs: state.microLegs.concat(edge.leg),
                    cost: nextCost, latency: nextLatency,
                    reliabilityBps: nextReliability,
                    bottleneck: Math.min(state.bottleneck, edge.capacity),
                    transferRegionIds: transfer
                        ? state.transferRegionIds.concat(state.regionId)
                        : state.transferRegionIds.slice() });
                if (!open.includes(nextKey)) open.push(nextKey);
            }
        }
    }
    if (!winner) return { ok: false, reason: 'NO_ROUTE',
        regionIds: [], corridorIds: [], modes, demand };
    const segmentIds = winner.microLegs.flatMap(leg => leg.segmentIds);
    const uncertainSegmentIds = [...new Set(winner.microLegs.flatMap(
        leg => leg.uncertainSegmentIds || []))];
    const observationIds = [...new Set(winner.microLegs.flatMap(
        leg => leg.observationIds || []))];
    const result = { ok: true, schemaVersion: STORY_ROUTE_PLANNER_SCHEMA_VERSION,
        adapterVersion: STORY_ROUTE_PLANNER_ADAPTER_VERSION,
        routeId: storyRoutePlannerHashText(
            [from, to, winner.corridorIds.join('|'), segmentIds.join('|')].join('>')),
        fromRegionId: from, toRegionId: to, regionIds: winner.regionIds,
        corridorIds: winner.corridorIds, modes: winner.modes,
        microLegs: winner.microLegs, segmentIds,
        knowledgeMode: options.knowledgeMode,
        observerId: options._perception ? options._perception.observerId : null,
        uncertainSegmentIds, observationIds,
        transferRegionIds: winner.transferRegionIds,
        totalCost: storyRoutePlannerRound(winner.cost),
        totalLatencySeconds: storyRoutePlannerRound(winner.latency),
        reliabilityBps: winner.reliabilityBps,
        bottleneckCapacity: winner.bottleneck, demand,
        score: storyRoutePlannerRound(winner.score), cacheHit: false,
        revisions: { networkHash: graph.networkHash || null,
            macroDamage: Number(graph.damageRevision) || 0,
            physicalTopologyHash: registry.topologyHash || null,
            physical: Number(registry.revision) || 0,
            reservations: Number(ledger.reservationRevision) || 0 } };
    if (cacheEnabled) {
        storyRoutePlannerCacheTrack(cacheKey, dependencyCorridorIds, dependencySegmentIds);
        STORY._routePlannerCache.set(cacheKey, storyRoutePlannerClone(result));
        if (STORY._routePlannerCache.size > 512) {
            storyRoutePlannerCacheUntrack(STORY._routePlannerCache.keys().next().value);
        }
    }
    return result;
}

function storyRoutePlannerReserve(plan, amount, rawOptions) {
    const options = rawOptions || {};
    if (!plan || !plan.ok || !Array.isArray(plan.segmentIds) || !plan.segmentIds.length) {
        return { ok: false, code: 'VALID_ROUTE_REQUIRED' };
    }
    const quantity = Number(amount);
    if (!Number.isFinite(quantity) || quantity <= 0) {
        return { ok: false, code: 'INVALID_RESERVATION_AMOUNT' };
    }
    const registry = storyHexInfrastructureSegmentsEnsure();
    if (!registry) return { ok: false, code: 'SEGMENT_REGISTRY_UNAVAILABLE' };
    const now = storyRoutePlannerNow(options);
    const reserved = storyRoutePlannerReservedBySegment(now);
    const uniqueSegmentIds = [...new Set(plan.segmentIds.map(String))];
    const shortages = [];
    for (const segmentId of uniqueSegmentIds) {
        const segment = registry.segmentById && registry.segmentById[segmentId];
        const available = Math.max(0,
            storyRoutePlannerSegmentCapacity(segment) - (reserved.get(segmentId) || 0));
        if (!segment || available + 1e-9 < quantity) shortages.push({
            segmentId, available: storyRoutePlannerRound(available), requested: quantity
        });
    }
    if (shortages.length) {
        return { ok: false, code: 'ROUTE_CAPACITY_UNAVAILABLE', shortages };
    }
    const ledger = storyRoutePlannerEnsure();
    ledger.reservationSequence++;
    const duration = Math.max(1, Number(options.durationSeconds)
        || Number(plan.totalLatencySeconds) || 1);
    const reservation = {
        schemaVersion: STORY_ROUTE_PLANNER_SCHEMA_VERSION,
        id: 'route-reservation:' + ledger.reservationSequence,
        routeId: String(plan.routeId),
        ownerId: options.ownerId == null ? null : String(options.ownerId),
        amount: storyRoutePlannerRound(quantity),
        createdAt: now,
        expiresAt: storyRoutePlannerRound(now + duration),
        releasedAt: null,
        status: 'ACTIVE',
        corridorIds: (plan.corridorIds || []).map(String),
        segmentIds: uniqueSegmentIds
    };
    ledger.reservations.push(reservation);
    ledger.reservationRevision++;
    storyRoutePlannerInvalidate({ segmentIds: uniqueSegmentIds });
    return { ok: true, reservation: storyRoutePlannerClone(reservation) };
}

function storyRoutePlannerRelease(reservationId, reason, rawOptions) {
    const ledger = storyRoutePlannerEnsure();
    const reservation = ledger.reservations.find(
        item => item.id === String(reservationId));
    if (!reservation) return { ok: false, code: 'RESERVATION_NOT_FOUND' };
    if (reservation.status !== 'ACTIVE') {
        return { ok: true, changed: false, reservation: storyRoutePlannerClone(reservation) };
    }
    reservation.status = 'RELEASED';
    reservation.releaseReason = String(reason || 'RELEASED');
    reservation.releasedAt = storyRoutePlannerNow(rawOptions || {});
    ledger.reservationRevision++;
    storyRoutePlannerInvalidate({ segmentIds: reservation.segmentIds || [] });
    return { ok: true, changed: true, reservation: storyRoutePlannerClone(reservation) };
}

function storyRoutePlannerReplaceReservation(reservationId, plan, amount, rawOptions) {
    const options = rawOptions || {};
    const ledger = storyRoutePlannerEnsure();
    const previous = ledger.reservations.find(
        item => item.id === String(reservationId));
    if (!previous || previous.status !== 'ACTIVE') {
        return { ok: false, code: 'ACTIVE_RESERVATION_NOT_FOUND' };
    }
    if (!plan || !plan.ok || !Array.isArray(plan.segmentIds) || !plan.segmentIds.length) {
        return { ok: false, code: 'VALID_ROUTE_REQUIRED' };
    }
    const quantity = Number(amount);
    if (!Number.isFinite(quantity) || quantity <= 0) {
        return { ok: false, code: 'INVALID_RESERVATION_AMOUNT' };
    }
    const registry = storyHexInfrastructureSegmentsEnsure();
    const now = storyRoutePlannerNow(options);
    const reserved = storyRoutePlannerReservedBySegment(now);
    for (const segmentId of previous.segmentIds || []) {
        reserved.set(segmentId, Math.max(0,
            (reserved.get(segmentId) || 0) - Number(previous.amount || 0)));
    }
    const nextSegmentIds = [...new Set(plan.segmentIds.map(String))];
    const shortages = [];
    for (const segmentId of nextSegmentIds) {
        const segment = registry && registry.segmentById[segmentId];
        const available = Math.max(0,
            storyRoutePlannerSegmentCapacity(segment) - (reserved.get(segmentId) || 0));
        if (!segment || available + 1e-9 < quantity) shortages.push({
            segmentId, available: storyRoutePlannerRound(available), requested: quantity
        });
    }
    if (shortages.length) {
        return { ok: false, code: 'ROUTE_CAPACITY_UNAVAILABLE', shortages };
    }
    previous.status = 'REPLACED';
    previous.releasedAt = now;
    previous.releaseReason = String(options.reason || 'ROUTE_REPLACED');
    ledger.reservationSequence++;
    const duration = Math.max(1, Number(options.durationSeconds)
        || Number(plan.totalLatencySeconds) || 1);
    const reservation = {
        schemaVersion: STORY_ROUTE_PLANNER_SCHEMA_VERSION,
        id: 'route-reservation:' + ledger.reservationSequence,
        routeId: String(plan.routeId),
        ownerId: options.ownerId == null ? previous.ownerId : String(options.ownerId),
        amount: storyRoutePlannerRound(quantity),
        createdAt: now,
        expiresAt: storyRoutePlannerRound(now + duration),
        releasedAt: null,
        status: 'ACTIVE',
        replacesReservationId: previous.id,
        corridorIds: (plan.corridorIds || []).map(String),
        segmentIds: nextSegmentIds
    };
    previous.replacedByReservationId = reservation.id;
    ledger.reservations.push(reservation);
    ledger.reservationRevision++;
    storyRoutePlannerInvalidate({ segmentIds: [
        ...(previous.segmentIds || []), ...nextSegmentIds
    ] });
    return { ok: true, reservation: storyRoutePlannerClone(reservation),
        previous: storyRoutePlannerClone(previous) };
}

function storyRoutePlannerForSave() {
    const ledger = storyRoutePlannerEnsure();
    storyRoutePlannerExpire(storyRoutePlannerNow());
    return storyRoutePlannerClone({
        schemaVersion: ledger.schemaVersion,
        adapterVersion: ledger.adapterVersion,
        reservationSequence: ledger.reservationSequence,
        reservationRevision: ledger.reservationRevision,
        reservations: ledger.reservations
    });
}

function storyRoutePlannerRestore(saved) {
    delete STORY.routePlanning;
    storyRoutePlannerInvalidate({ all: true });
    const ledger = storyRoutePlannerEnsure();
    if (!saved) return { ok: true, backfilled: true, ledger };
    if (Number(saved.schemaVersion) !== STORY_ROUTE_PLANNER_SCHEMA_VERSION
        || String(saved.adapterVersion) !== STORY_ROUTE_PLANNER_ADAPTER_VERSION
        || !Array.isArray(saved.reservations)) {
        return { ok: false, code: 'ROUTE_PLANNER_SAVE_INCOMPATIBLE' };
    }
    const registry = storyHexInfrastructureSegmentsEnsure();
    const knownSegments = new Set((registry && registry.segments || [])
        .map(segment => String(segment.id)));
    const ids = new Set();
    for (const reservation of saved.reservations) {
        if (!reservation || !reservation.id || ids.has(String(reservation.id))
            || !['ACTIVE', 'RELEASED', 'EXPIRED', 'REPLACED'].includes(String(reservation.status))
            || !Number.isFinite(Number(reservation.amount)) || Number(reservation.amount) <= 0
            || !Array.isArray(reservation.segmentIds)
            || reservation.segmentIds.some(id => !knownSegments.has(String(id)))) {
            return { ok: false, code: 'ROUTE_RESERVATION_INVALID',
                reservationId: reservation && reservation.id };
        }
        ids.add(String(reservation.id));
    }
    STORY.routePlanning = storyRoutePlannerClone(saved);
    storyRoutePlannerEnsure();
    storyRoutePlannerExpire(storyRoutePlannerNow());
    return { ok: true, backfilled: false, ledger: STORY.routePlanning };
}

function storyRoutePlannerReset() {
    delete STORY.routePlanning;
    storyRoutePlannerInvalidate({ all: true });
    STORY._routePlannerCacheStats = {
        hits: 0, misses: 0, targetedInvalidations: 0, fullInvalidations: 0
    };
    return storyRoutePlannerEnsure();
}

function storyRoutePlannerDiagnostics() {
    const ledger = storyRoutePlannerEnsure();
    storyRoutePlannerExpire(storyRoutePlannerNow());
    return {
        schemaVersion: ledger.schemaVersion,
        adapterVersion: ledger.adapterVersion,
        reservationRevision: ledger.reservationRevision,
        activeReservations: ledger.reservations.filter(
            item => item.status === 'ACTIVE').length,
        reservedSegmentCount: storyRoutePlannerReservedBySegment(
            storyRoutePlannerNow()).size,
        cacheEntries: STORY._routePlannerCache ? STORY._routePlannerCache.size : 0,
        cacheStats: storyRoutePlannerClone(STORY._routePlannerCacheStats || {})
    };
}
