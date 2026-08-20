// ============================================================================
//  ALTİGEN KARA YOLLARI — HXD-7 spatial adapter
//  --------------------------------------------------------------------------
//  GEO_ROADS yalnız şehirler arası niyeti söyler. Görsel ve ileride fiziksel
//  taşıt rotası, kanonik HexWorld komşuluk zincirinden çıkar. Su ve geçilemez
//  dağ hücreleri kara yolu olarak kullanılamaz.
// ============================================================================

const STORY_HEX_ROADS_SCHEMA_VERSION = 1;
const STORY_HEX_ROADS_ADAPTER_VERSION = 'story-hex-roads-1';

function storyHexRoadDistance(world, a, b) {
    const aq = Number(world.qValues[a]), ar = Number(world.rValues[a]);
    const bq = Number(world.qValues[b]), br = Number(world.rValues[b]);
    return Math.max(Math.abs(aq - bq), Math.abs(ar - br),
        Math.abs((-aq - ar) - (-bq - br)));
}

function storyHexRoadHeapPush(heap, node) {
    heap.push(node);
    let index = heap.length - 1;
    while (index > 0) {
        const parent = (index - 1) >> 1;
        if (heap[parent].score <= node.score) break;
        heap[index] = heap[parent];
        index = parent;
    }
    heap[index] = node;
}

function storyHexRoadHeapPop(heap) {
    if (!heap.length) return null;
    const root = heap[0];
    const tail = heap.pop();
    if (heap.length) {
        let index = 0;
        while (true) {
            let child = index * 2 + 1;
            if (child >= heap.length) break;
            if (child + 1 < heap.length && heap[child + 1].score < heap[child].score) child++;
            if (heap[child].score >= tail.score) break;
            heap[index] = heap[child];
            index = child;
        }
        heap[index] = tail;
    }
    return root;
}

function storyHexRoadFindPath(world, geography, startIndex, endIndex) {
    if (!world || !geography || startIndex < 0 || endIndex < 0) return [];
    if (startIndex === endIndex) return [startIndex];
    const count = Number(world.cellCount) || 0;
    const costs = new Float64Array(count);
    costs.fill(Infinity);
    const previous = new Int32Array(count);
    previous.fill(-1);
    const closed = new Uint8Array(count);
    const heap = [];
    costs[startIndex] = 0;
    storyHexRoadHeapPush(heap, {
        index: startIndex,
        score: storyHexRoadDistance(world, startIndex, endIndex) * 10
    });
    while (heap.length) {
        const current = storyHexRoadHeapPop(heap);
        const index = current.index;
        if (closed[index]) continue;
        if (index === endIndex) break;
        closed[index] = 1;
        const q = Number(world.qValues[index]);
        const r = Number(world.rValues[index]);
        for (const delta of STORY_HEX_WORLD_NEIGHBOR_DIRECTIONS) {
            const next = storyHexWorldIndex(world, q + delta[0], r + delta[1]);
            if (next < 0 || closed[next]) continue;
            if (next !== endIndex && next !== startIndex
                && !(Number(geography.movementMask[next]) & STORY_HEX_MOVEMENT_LAND)) continue;
            const mountainPenalty = Number(geography.mountainIntensityBps[next] || 0) / 1800;
            const coastPenalty = Number(geography.landCoverageBps[next] || 0) < 8000 ? 2.5 : 0;
            const nextCost = costs[index] + 10 + mountainPenalty + coastPenalty;
            if (nextCost >= costs[next]) continue;
            costs[next] = nextCost;
            previous[next] = index;
            storyHexRoadHeapPush(heap, {
                index: next,
                score: nextCost + storyHexRoadDistance(world, next, endIndex) * 10
            });
        }
    }
    if (previous[endIndex] < 0) return [];
    const path = [];
    for (let cursor = endIndex; cursor >= 0; cursor = previous[cursor]) {
        path.push(cursor);
        if (cursor === startIndex) break;
    }
    if (path[path.length - 1] !== startIndex) return [];
    path.reverse();
    return path;
}

function storyHexRoadRegistryEnsure() {
    if (typeof storyHexWorldEnsure !== 'function'
        || typeof storyHexGeographyEnsure !== 'function'
        || typeof storyHexSettlementsEnsure !== 'function') return null;
    const world = storyHexWorldEnsure();
    const geography = storyHexGeographyEnsure();
    const settlements = storyHexSettlementsEnsure();
    const key = [STORY_HEX_ROADS_ADAPTER_VERSION, world.layoutHash,
        geography.geographyHash, settlements.settlementHash].join('|');
    if (STORY._hexRoadRegistry && STORY._hexRoadRegistry.key === key) {
        return STORY._hexRoadRegistry;
    }
    STORY._hexRoadRegistry = {
        schemaVersion: STORY_HEX_ROADS_SCHEMA_VERSION,
        adapterVersion: STORY_HEX_ROADS_ADAPTER_VERSION,
        key,
        world,
        geography,
        settlements,
        paths: new Map(),
        routeCount: 0,
        failedRouteCount: 0,
        failedRoutes: [],
        totalCellSteps: 0,
        waterStepCount: 0,
        invalidNeighborCount: 0
    };
    return STORY._hexRoadRegistry;
}

function storyHexRoadPath(cityAId, cityBId) {
    const registry = storyHexRoadRegistryEnsure();
    if (!registry) return [];
    const a = Number(cityAId), b = Number(cityBId);
    const low = Math.min(a, b), high = Math.max(a, b);
    const key = `${low}:${high}`;
    if (registry.paths.has(key)) return registry.paths.get(key);
    const start = Number(registry.settlements.coreCellIndices[low]);
    const end = Number(registry.settlements.coreCellIndices[high]);
    const indices = storyHexRoadFindPath(registry.world, registry.geography, start, end);
    if (!indices.length) {
        registry.failedRouteCount++;
        const cities = typeof GEO_CITIES !== 'undefined' ? GEO_CITIES : [];
        registry.failedRoutes.push({
            a: low,
            b: high,
            aName: cities[low] && cities[low].name || String(low),
            bName: cities[high] && cities[high].name || String(high)
        });
        registry.paths.set(key, []);
        return [];
    }
    let invalidNeighborCount = 0;
    let waterStepCount = 0;
    for (let index = 0; index < indices.length; index++) {
        const cellIndex = indices[index];
        if (!(Number(registry.geography.movementMask[cellIndex]) & STORY_HEX_MOVEMENT_LAND)) {
            waterStepCount++;
        }
        if (index && storyHexRoadDistance(registry.world, indices[index - 1], cellIndex) !== 1) {
            invalidNeighborCount++;
        }
    }
    const points = indices.map(cellIndex => ({
        x: Number(registry.world.centerX[cellIndex]),
        y: Number(registry.world.centerY[cellIndex]),
        cellIndex
    }));
    registry.routeCount++;
    registry.totalCellSteps += Math.max(0, points.length - 1);
    registry.waterStepCount += waterStepCount;
    registry.invalidNeighborCount += invalidNeighborCount;
    registry.paths.set(key, points);
    return points;
}

function storyHexRoadDiagnostics() {
    const registry = storyHexRoadRegistryEnsure();
    if (!registry) return { available: false };
    return {
        available: true,
        adapterVersion: registry.adapterVersion,
        key: registry.key,
        routeCount: registry.routeCount,
        failedRouteCount: registry.failedRouteCount,
        failedRoutes: registry.failedRoutes.slice(),
        totalCellSteps: registry.totalCellSteps,
        waterStepCount: registry.waterStepCount,
        invalidNeighborCount: registry.invalidNeighborCount,
        cachedPathCount: registry.paths.size
    };
}

// ============================================================================
//  FİZİKSEL ALTYAPI SEGMENTLERİ — HXD-7.1
//  Makro LAND koridorları, kullandıkları paylaşılan altıgen kenarlara ayrılır.
// ============================================================================

const STORY_HEX_INFRASTRUCTURE_SCHEMA_VERSION = 2;
const STORY_HEX_INFRASTRUCTURE_ADAPTER_VERSION = 'story-hex-infrastructure-segments-2';
const STORY_HEX_INFRASTRUCTURE_LIFECYCLES = Object.freeze([
    'CONSTRUCTION', 'OPERATING', 'DAMAGED', 'CLOSED', 'UNDER_REPAIR'
]);

function storyHexInfrastructureHashText(text) {
    let hash = 0x811c9dc5;
    for (const char of String(text || '')) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 0x01000193);
    }
    return `fnv1a32:${(`00000000${(hash >>> 0).toString(16)}`).slice(-8)}`;
}

function storyHexInfrastructureLegacyRegionId(regionId) {
    const match = /^region:(\d+)$/.exec(String(regionId || ''));
    return match ? Number(match[1]) : NaN;
}

function storyHexInfrastructureEdgeId(a, b) {
    return `segment:land:${Math.min(Number(a), Number(b))}:${Math.max(Number(a), Number(b))}`;
}

function storyHexInfrastructureSeaEdgeId(a, b) {
    return `segment:sea:${Math.min(Number(a), Number(b))}:${Math.max(Number(a), Number(b))}`;
}

function storyHexInfrastructureRailEdgeId(a, b) {
    return `segment:rail:${Math.min(Number(a), Number(b))}:${Math.max(Number(a), Number(b))}`;
}

function storyHexInfrastructurePortEdgeId(terminalId, landIndex, waterIndex) {
    return `segment:port:${Number(terminalId)}:${Number(landIndex)}:${Number(waterIndex)}`;
}

function storyHexInfrastructureWaterMask() {
    return typeof STORY_HEX_MOVEMENT_WATER !== 'undefined'
        ? Number(STORY_HEX_MOVEMENT_WATER) : 2;
}

function storyHexInfrastructureFindSeaPath(world, geography, startIndex, endIndex) {
    if (!world || !geography || startIndex < 0 || endIndex < 0) return [];
    if (startIndex === endIndex) return [startIndex];
    const count = Number(world.cellCount) || 0;
    const costs = new Float64Array(count);
    costs.fill(Infinity);
    const previous = new Int32Array(count);
    previous.fill(-1);
    const closed = new Uint8Array(count);
    const heap = [];
    const waterMask = storyHexInfrastructureWaterMask();
    costs[startIndex] = 0;
    storyHexRoadHeapPush(heap, {
        index: startIndex,
        score: storyHexRoadDistance(world, startIndex, endIndex) * 10
    });
    while (heap.length) {
        const current = storyHexRoadHeapPop(heap);
        const index = current.index;
        if (closed[index]) continue;
        if (index === endIndex) break;
        closed[index] = 1;
        const q = Number(world.qValues[index]);
        const r = Number(world.rValues[index]);
        for (const delta of STORY_HEX_WORLD_NEIGHBOR_DIRECTIONS) {
            const next = storyHexWorldIndex(world, q + delta[0], r + delta[1]);
            if (next < 0 || closed[next]) continue;
            const coverage = Number(geography.landCoverageBps[next] || 0);
            const water = !!(Number(geography.movementMask[next]) & waterMask);
            // Mixed coast cells can represent a raster-thin strait. They remain
            // expensive and explicit; solid land (or >70% land) is never a sea path.
            if (!water && coverage > 7000) continue;
            const coastPenalty = water ? coverage / 2500 : 18 + coverage / 1000;
            const nextCost = costs[index] + 10 + coastPenalty;
            if (nextCost >= costs[next]) continue;
            costs[next] = nextCost;
            previous[next] = index;
            storyHexRoadHeapPush(heap, {
                index: next,
                score: nextCost + storyHexRoadDistance(world, next, endIndex) * 10
            });
        }
    }
    if (previous[endIndex] < 0) return [];
    const path = [];
    for (let cursor = endIndex; cursor >= 0; cursor = previous[cursor]) {
        path.push(cursor);
        if (cursor === startIndex) break;
    }
    if (path[path.length - 1] !== startIndex) return [];
    path.reverse();
    return path;
}

function storyHexInfrastructureSeaSegmentKind(world, geography, a, b) {
    const waterMask = storyHexInfrastructureWaterMask();
    if (!(Number(geography.movementMask[a]) & waterMask)
        || !(Number(geography.movementMask[b]) & waterMask)) return 'STRAIT';
    const constrained = [a, b].some(index => {
        const q = Number(world.qValues[index]), r = Number(world.rValues[index]);
        const landDirections = [];
        for (let direction = 0; direction < STORY_HEX_WORLD_NEIGHBOR_DIRECTIONS.length; direction++) {
            const delta = STORY_HEX_WORLD_NEIGHBOR_DIRECTIONS[direction];
            const neighbor = storyHexWorldIndex(world, q + delta[0], r + delta[1]);
            if (neighbor >= 0 && !(Number(geography.movementMask[neighbor]) & waterMask)) {
                landDirections.push(direction);
            }
        }
        return landDirections.some(first => landDirections.some(second => {
            const gap = Math.abs(first - second);
            return gap >= 2 && gap <= 4;
        }));
    });
    return constrained ? 'STRAIT' : 'SEA_LANE';
}

function storyHexInfrastructureSegmentKind(geography, a, b) {
    const coverage = Math.min(Number(geography.landCoverageBps[a]) || 0,
        Number(geography.landCoverageBps[b]) || 0);
    const mountain = Math.max(Number(geography.mountainIntensityBps[a]) || 0,
        Number(geography.mountainIntensityBps[b]) || 0);
    if (coverage < 9400) return 'BRIDGE';
    if (mountain >= 7000) return 'TUNNEL';
    return 'ROAD';
}

function storyHexInfrastructureRailSegmentKind(geography, a, b) {
    const landKind = storyHexInfrastructureSegmentKind(geography, a, b);
    if (landKind === 'BRIDGE') return 'RAIL_BRIDGE';
    if (landKind === 'TUNNEL') return 'RAIL_TUNNEL';
    return 'RAIL_TRACK';
}

function storyHexInfrastructureBuild(world, geography, settlements, corridors) {
    const segmentsById = new Map();
    const corridorSegmentIds = {};
    const corridorCellPaths = {};
    const failedCorridors = [];
    const landCorridors = (corridors || []).filter(corridor => corridor && corridor.mode === 'LAND')
        .slice().sort((a, b) => String(a.id).localeCompare(String(b.id), 'en'));
    const railCorridors = (corridors || []).filter(corridor => corridor && corridor.mode === 'RAIL')
        .slice().sort((a, b) => String(a.id).localeCompare(String(b.id), 'en'));
    const seaCorridors = (corridors || []).filter(corridor => corridor && corridor.mode === 'SEA')
        .slice().sort((a, b) => String(a.id).localeCompare(String(b.id), 'en'));
    for (const corridor of landCorridors) {
        const cityA = storyHexInfrastructureLegacyRegionId(corridor.endpointRegionIds[0]);
        const cityB = storyHexInfrastructureLegacyRegionId(corridor.endpointRegionIds[1]);
        const start = Number(settlements.coreCellIndices[cityA]);
        const end = Number(settlements.coreCellIndices[cityB]);
        const path = Number.isInteger(start) && Number.isInteger(end)
            ? storyHexRoadFindPath(world, geography, start, end) : [];
        if (path.length < 2) {
            corridorSegmentIds[corridor.id] = [];
            failedCorridors.push({ corridorId: corridor.id,
                endpointRegionIds: corridor.endpointRegionIds.slice(),
                reason: 'NO_PHYSICAL_LAND_PATH' });
            continue;
        }
        const segmentIds = [];
        for (let index = 1; index < path.length; index++) {
            const a = Number(path[index - 1]), b = Number(path[index]);
            const id = storyHexInfrastructureEdgeId(a, b);
            let segment = segmentsById.get(id);
            if (!segment) {
                const dx = Number(world.centerX[a]) - Number(world.centerX[b]);
                const dy = Number(world.centerY[a]) - Number(world.centerY[b]);
                segment = {
                    schemaVersion: STORY_HEX_INFRASTRUCTURE_SCHEMA_VERSION,
                    id, mode: 'LAND', kind: storyHexInfrastructureSegmentKind(geography, a, b),
                    endpointCellIndices: [Math.min(a, b), Math.max(a, b)],
                    corridorIds: [],
                    lengthWorld: Math.round(Math.hypot(dx, dy) * 1000) / 1000,
                    baseCapacity: Math.max(1, Number(corridor.baseCapacity) || 1),
                    maintenanceBps: 10000, damageBps: 0, enabled: true,
                    lifecycleState: 'OPERATING', repairRemainingSeconds: 0
                };
                segmentsById.set(id, segment);
            }
            segment.baseCapacity = Math.max(segment.baseCapacity,
                Math.max(1, Number(corridor.baseCapacity) || 1));
            if (!segment.corridorIds.includes(corridor.id)) segment.corridorIds.push(corridor.id);
            segmentIds.push(id);
        }
        corridorSegmentIds[corridor.id] = segmentIds;
        corridorCellPaths[corridor.id] = path.slice();
    }
    for (const corridor of railCorridors) {
        const cityA = storyHexInfrastructureLegacyRegionId(corridor.endpointRegionIds[0]);
        const cityB = storyHexInfrastructureLegacyRegionId(corridor.endpointRegionIds[1]);
        const start = Number(settlements.coreCellIndices[cityA]);
        const end = Number(settlements.coreCellIndices[cityB]);
        const path = Number.isInteger(start) && Number.isInteger(end)
            ? storyHexRoadFindPath(world, geography, start, end) : [];
        if (path.length < 2) {
            corridorSegmentIds[corridor.id] = [];
            failedCorridors.push({ corridorId: corridor.id,
                endpointRegionIds: corridor.endpointRegionIds.slice(),
                reason: 'NO_PHYSICAL_RAIL_PATH' });
            continue;
        }
        const segmentIds = [];
        for (let index = 1; index < path.length; index++) {
            const a = Number(path[index - 1]), b = Number(path[index]);
            const id = storyHexInfrastructureRailEdgeId(a, b);
            let segment = segmentsById.get(id);
            if (!segment) {
                const dx = Number(world.centerX[a]) - Number(world.centerX[b]);
                const dy = Number(world.centerY[a]) - Number(world.centerY[b]);
                segment = {
                    schemaVersion: STORY_HEX_INFRASTRUCTURE_SCHEMA_VERSION,
                    id, mode: 'RAIL',
                    kind: storyHexInfrastructureRailSegmentKind(geography, a, b),
                    endpointCellIndices: [Math.min(a, b), Math.max(a, b)],
                    corridorIds: [],
                    lengthWorld: Math.round(Math.hypot(dx, dy) * 1000) / 1000,
                    baseCapacity: Math.max(1, Number(corridor.baseCapacity) || 1),
                    maintenanceBps: 10000, damageBps: 0, enabled: true,
                    lifecycleState: 'OPERATING', repairRemainingSeconds: 0
                };
                segmentsById.set(id, segment);
            }
            segment.baseCapacity = Math.max(segment.baseCapacity,
                Math.max(1, Number(corridor.baseCapacity) || 1));
            if (!segment.corridorIds.includes(corridor.id)) segment.corridorIds.push(corridor.id);
            segmentIds.push(id);
        }
        corridorSegmentIds[corridor.id] = segmentIds;
        corridorCellPaths[corridor.id] = path.slice();
    }
    for (const corridor of seaCorridors) {
        const cityA = storyHexInfrastructureLegacyRegionId(corridor.endpointRegionIds[0]);
        const cityB = storyHexInfrastructureLegacyRegionId(corridor.endpointRegionIds[1]);
        const terminalA = Number(settlements.portTerminalIds[cityA]);
        const terminalB = Number(settlements.portTerminalIds[cityB]);
        const start = Number(settlements.portWaterCellIndices[cityA]);
        const end = Number(settlements.portWaterCellIndices[cityB]);
        const path = terminalA >= 0 && terminalB >= 0 && start >= 0 && end >= 0
            ? storyHexInfrastructureFindSeaPath(world, geography, start, end) : [];
        if (!path.length) {
            corridorSegmentIds[corridor.id] = [];
            failedCorridors.push({ corridorId: corridor.id,
                endpointRegionIds: corridor.endpointRegionIds.slice(),
                reason: terminalA < 0 || terminalB < 0
                    ? 'MISSING_PHYSICAL_PORT_TERMINAL' : 'NO_PHYSICAL_SEA_PATH' });
            continue;
        }
        const segmentIds = [];
        for (const cityId of [cityA, cityB]) {
            const terminalId = Number(settlements.portTerminalIds[cityId]);
            const landIndex = Number(settlements.portLandCellIndices[cityId]);
            const waterIndex = Number(settlements.portWaterCellIndices[cityId]);
            const id = storyHexInfrastructurePortEdgeId(terminalId, landIndex, waterIndex);
            let segment = segmentsById.get(id);
            if (!segment) {
                const dx = Number(world.centerX[landIndex]) - Number(world.centerX[waterIndex]);
                const dy = Number(world.centerY[landIndex]) - Number(world.centerY[waterIndex]);
                segment = {
                    schemaVersion: STORY_HEX_INFRASTRUCTURE_SCHEMA_VERSION,
                    id, mode: 'SEA', kind: 'PORT_ACCESS',
                    endpointCellIndices: [landIndex, waterIndex],
                    terminalId, serviceCityIds: [cityId], corridorIds: [],
                    lengthWorld: Math.round(Math.hypot(dx, dy) * 1000) / 1000,
                    baseCapacity: Math.max(1, Number(corridor.baseCapacity) || 1),
                    maintenanceBps: 10000, damageBps: 0, enabled: true,
                    lifecycleState: 'OPERATING', repairRemainingSeconds: 0
                };
                segmentsById.set(id, segment);
            }
            segment.baseCapacity = Math.max(segment.baseCapacity,
                Math.max(1, Number(corridor.baseCapacity) || 1));
            if (!segment.serviceCityIds.includes(cityId)) segment.serviceCityIds.push(cityId);
            if (!segment.corridorIds.includes(corridor.id)) segment.corridorIds.push(corridor.id);
            segmentIds.push(id);
        }
        for (let index = 1; index < path.length; index++) {
            const a = Number(path[index - 1]), b = Number(path[index]);
            const id = storyHexInfrastructureSeaEdgeId(a, b);
            let segment = segmentsById.get(id);
            if (!segment) {
                const dx = Number(world.centerX[a]) - Number(world.centerX[b]);
                const dy = Number(world.centerY[a]) - Number(world.centerY[b]);
                segment = {
                    schemaVersion: STORY_HEX_INFRASTRUCTURE_SCHEMA_VERSION,
                    id, mode: 'SEA',
                    kind: storyHexInfrastructureSeaSegmentKind(world, geography, a, b),
                    endpointCellIndices: [Math.min(a, b), Math.max(a, b)],
                    corridorIds: [],
                    lengthWorld: Math.round(Math.hypot(dx, dy) * 1000) / 1000,
                    baseCapacity: Math.max(1, Number(corridor.baseCapacity) || 1),
                    maintenanceBps: 10000, damageBps: 0, enabled: true,
                    lifecycleState: 'OPERATING', repairRemainingSeconds: 0
                };
                segmentsById.set(id, segment);
            }
            segment.baseCapacity = Math.max(segment.baseCapacity,
                Math.max(1, Number(corridor.baseCapacity) || 1));
            if (!segment.corridorIds.includes(corridor.id)) segment.corridorIds.push(corridor.id);
            segmentIds.push(id);
        }
        corridorSegmentIds[corridor.id] = segmentIds;
        corridorCellPaths[corridor.id] = [
            Number(settlements.portLandCellIndices[cityA]),
            ...path,
            Number(settlements.portLandCellIndices[cityB])
        ];
    }
    const graphById = new Map((corridors || []).map(corridor => [corridor.id, corridor]));
    for (const corridor of corridors || []) {
        if (!['ENERGY', 'DATA'].includes(corridor.mode)) continue;
        const parent = graphById.get(corridor.parentCorridorId);
        if (parent && ['LAND', 'SEA'].includes(parent.mode) && corridorSegmentIds[parent.id]) {
            corridorSegmentIds[corridor.id] = corridorSegmentIds[parent.id].slice();
            for (const segmentId of corridorSegmentIds[corridor.id]) {
                const segment = segmentsById.get(segmentId);
                if (segment && !segment.corridorIds.includes(corridor.id)) segment.corridorIds.push(corridor.id);
            }
        }
    }
    const segments = Array.from(segmentsById.values()).sort((a, b) => a.id.localeCompare(b.id, 'en'));
    for (const segment of segments) segment.corridorIds.sort((a, b) => a.localeCompare(b, 'en'));
    return {
        schemaVersion: STORY_HEX_INFRASTRUCTURE_SCHEMA_VERSION,
        adapterVersion: STORY_HEX_INFRASTRUCTURE_ADAPTER_VERSION,
        topologyHash: storyHexInfrastructureHashText(segments.map(segment => [segment.id,
            segment.mode, segment.kind, segment.endpointCellIndices.join(':'), segment.corridorIds.join(','),
            segment.baseCapacity].join('|')).join('\n')),
        revision: 0,
        segments,
        segmentById: Object.fromEntries(segments.map(segment => [segment.id, segment])),
        corridorSegmentIds,
        corridorCellPaths,
        diagnostics: {
            sourceLandCorridorCount: landCorridors.length,
            sourceRailCorridorCount: railCorridors.length,
            sourceSeaCorridorCount: seaCorridors.length,
            physicalSegmentCount: segments.length,
            landSegmentCount: segments.filter(segment => segment.mode === 'LAND').length,
            railSegmentCount: segments.filter(segment => segment.mode === 'RAIL').length,
            seaSegmentCount: segments.filter(segment => segment.mode === 'SEA').length,
            portAccessSegmentCount: segments.filter(segment => segment.kind === 'PORT_ACCESS').length,
            straitSegmentCount: segments.filter(segment => segment.kind === 'STRAIT').length,
            sharedSegmentCount: segments.filter(segment => segment.corridorIds
                .filter(id => graphById.get(id)
                    && ['LAND', 'SEA', 'RAIL'].includes(graphById.get(id).mode)).length > 1).length,
            bridgeSegmentCount: segments.filter(segment => segment.kind === 'BRIDGE').length,
            tunnelSegmentCount: segments.filter(segment => segment.kind === 'TUNNEL').length,
            railBridgeSegmentCount: segments.filter(segment =>
                segment.kind === 'RAIL_BRIDGE').length,
            railTunnelSegmentCount: segments.filter(segment =>
                segment.kind === 'RAIL_TUNNEL').length,
            failedCorridorCount: failedCorridors.length,
            failedLandCorridorCount: failedCorridors.filter(row =>
                String(row.reason).includes('LAND')).length,
            failedSeaCorridorCount: failedCorridors.filter(row =>
                String(row.reason).includes('SEA')
                || String(row.reason).includes('PORT')).length,
            failedRailCorridorCount: failedCorridors.filter(row =>
                String(row.reason).includes('RAIL')).length,
            failedCorridors
        }
    };
}

function storyHexInfrastructureSegmentsEnsure() {
    if (typeof storyHexWorldEnsure !== 'function' || typeof storyHexGeographyEnsure !== 'function'
        || typeof storyHexSettlementsEnsure !== 'function'
        || typeof storyInfrastructureEnsure !== 'function') return null;
    const world = storyHexWorldEnsure(), geography = storyHexGeographyEnsure();
    const settlements = storyHexSettlementsEnsure(), graph = storyInfrastructureEnsure();
    if (!world || !geography || !settlements || !graph) return null;
    const key = [STORY_HEX_INFRASTRUCTURE_ADAPTER_VERSION, world.layoutHash,
        geography.geographyHash, settlements.settlementHash, graph.networkHash].join('|');
    if (STORY.hexInfrastructureSegments && STORY.hexInfrastructureSegments.key === key) {
        return STORY.hexInfrastructureSegments;
    }
    const registry = storyHexInfrastructureBuild(world, geography, settlements, graph.corridors);
    registry.key = key;
    registry.networkHash = graph.networkHash;
    registry.worldLayoutHash = world.layoutHash;
    STORY.hexInfrastructureSegments = registry;
    return registry;
}

function storyHexInfrastructureSegmentFactorBps(segment) {
    if (!segment || !segment.enabled || ['CONSTRUCTION', 'CLOSED'].includes(segment.lifecycleState)) return 0;
    const damage = Math.max(0, Math.min(10000, Number(segment.damageBps) || 0));
    const maintenance = Math.max(0, Math.min(10000, Number(segment.maintenanceBps) || 0));
    return Math.max(0, Math.floor((10000 - damage) * maintenance / 10000));
}

function storyHexInfrastructureCorridorFactorBps(corridorId) {
    // This is the hottest trade-routing read. Re-entering world/geography/
    // settlement/infrastructure ensure+validation for every corridor edge made
    // long simulations effectively unbounded. Topology mutations explicitly
    // clear the registry; ordinary capacity reads use the resident sidecar.
    const registry = typeof STORY !== 'undefined' && STORY.hexInfrastructureSegments
        ? STORY.hexInfrastructureSegments : storyHexInfrastructureSegmentsEnsure();
    if (!registry) return 10000;
    const id = String(corridorId);
    if (!Object.prototype.hasOwnProperty.call(registry.corridorSegmentIds, id)) return 10000;
    const segmentIds = registry.corridorSegmentIds[id];
    // A known LAND corridor with no physical chain is closed, not magically
    // passable. Sea crossings require an explicit bridge/tunnel/ferry/SEA path.
    if (!Array.isArray(segmentIds) || !segmentIds.length) return 0;
    return segmentIds.reduce((factor, id) => Math.min(factor,
        storyHexInfrastructureSegmentFactorBps(registry.segmentById[id])), 10000);
}

function storyHexInfrastructureSetSegmentDamage(segmentId, damageBps, options) {
    const registry = storyHexInfrastructureSegmentsEnsure();
    if (!registry) return { ok: false, code: 'SEGMENT_REGISTRY_UNAVAILABLE' };
    const segment = registry.segmentById[String(segmentId)];
    if (!segment) return { ok: false, code: 'SEGMENT_NOT_FOUND' };
    if (!Number.isFinite(Number(damageBps))) return { ok: false, code: 'INVALID_DAMAGE' };
    const previous = { damageBps: segment.damageBps, maintenanceBps: segment.maintenanceBps,
        enabled: segment.enabled, lifecycleState: segment.lifecycleState,
        repairRemainingSeconds: segment.repairRemainingSeconds };
    segment.damageBps = Math.max(0, Math.min(10000, Math.round(Number(damageBps))));
    if (options && Number.isFinite(Number(options.maintenanceBps))) {
        segment.maintenanceBps = Math.max(0, Math.min(10000, Math.round(Number(options.maintenanceBps))));
    }
    if (options && Object.prototype.hasOwnProperty.call(options, 'enabled')) segment.enabled = !!options.enabled;
    const lifecycle = options && String(options.lifecycleState || '').toUpperCase();
    if (lifecycle && STORY_HEX_INFRASTRUCTURE_LIFECYCLES.includes(lifecycle)) segment.lifecycleState = lifecycle;
    else if (!segment.enabled || segment.damageBps >= 10000) segment.lifecycleState = 'CLOSED';
    else if (segment.damageBps > 0) segment.lifecycleState = 'DAMAGED';
    else segment.lifecycleState = 'OPERATING';
    if (options && Number.isFinite(Number(options.repairRemainingSeconds))) {
        segment.repairRemainingSeconds = Math.max(0, Number(options.repairRemainingSeconds));
    }
    registry.revision++;
    if (STORY.infrastructureGraph) STORY.infrastructureGraph.damageRevision++;
    STORY._networkLayerKey = null;
    return { ok: true, segmentId: segment.id, previous,
        current: { damageBps: segment.damageBps, maintenanceBps: segment.maintenanceBps,
            enabled: segment.enabled, lifecycleState: segment.lifecycleState,
            repairRemainingSeconds: segment.repairRemainingSeconds,
            effectiveFactorBps: storyHexInfrastructureSegmentFactorBps(segment) },
        affectedCorridorIds: segment.corridorIds.slice(), revision: registry.revision };
}

function storyHexInfrastructureForSave() {
    const registry = storyHexInfrastructureSegmentsEnsure();
    if (!registry) return null;
    return { schemaVersion: registry.schemaVersion, adapterVersion: registry.adapterVersion,
        networkHash: registry.networkHash, topologyHash: registry.topologyHash,
        revision: registry.revision,
        states: registry.segments.filter(segment => segment.damageBps !== 0
            || segment.maintenanceBps !== 10000 || segment.enabled !== true
            || segment.lifecycleState !== 'OPERATING' || segment.repairRemainingSeconds !== 0)
            .map(segment => ({ id: segment.id, damageBps: segment.damageBps,
                maintenanceBps: segment.maintenanceBps, enabled: segment.enabled,
                lifecycleState: segment.lifecycleState,
                repairRemainingSeconds: segment.repairRemainingSeconds })) };
}

function storyHexInfrastructureRestore(saved) {
    STORY.hexInfrastructureSegments = null;
    const registry = storyHexInfrastructureSegmentsEnsure();
    if (!registry) return { ok: false, code: 'SEGMENT_REGISTRY_UNAVAILABLE' };
    if (!saved) return { ok: true, backfilled: true, registry };
    const legacyLandOnly = saved.schemaVersion === 1
        && saved.adapterVersion === 'story-hex-infrastructure-segments-1';
    if ((!legacyLandOnly && (saved.schemaVersion !== STORY_HEX_INFRASTRUCTURE_SCHEMA_VERSION
        || saved.adapterVersion !== STORY_HEX_INFRASTRUCTURE_ADAPTER_VERSION
        || saved.topologyHash !== registry.topologyHash))
        || saved.networkHash !== registry.networkHash
        || !Array.isArray(saved.states)) return { ok: false, code: 'SEGMENT_SAVE_INCOMPATIBLE' };
    for (const state of saved.states) {
        const segment = registry.segmentById[String(state && state.id)];
        if (!segment || !Number.isInteger(Number(state.damageBps)) || Number(state.damageBps) < 0
            || Number(state.damageBps) > 10000 || !Number.isInteger(Number(state.maintenanceBps))
            || Number(state.maintenanceBps) < 0 || Number(state.maintenanceBps) > 10000
            || typeof state.enabled !== 'boolean'
            || !STORY_HEX_INFRASTRUCTURE_LIFECYCLES.includes(String(state.lifecycleState))) {
            return { ok: false, code: 'SEGMENT_STATE_INVALID', segmentId: state && state.id };
        }
        segment.damageBps = Number(state.damageBps);
        segment.maintenanceBps = Number(state.maintenanceBps);
        segment.enabled = state.enabled;
        segment.lifecycleState = String(state.lifecycleState);
        segment.repairRemainingSeconds = Math.max(0, Number(state.repairRemainingSeconds) || 0);
    }
    registry.revision = Math.max(0, Number(saved.revision) | 0);
    return { ok: true, backfilled: false,
        migratedFromSchemaVersion: legacyLandOnly ? 1 : null, registry };
}

function storyHexInfrastructureReset() {
    STORY.hexInfrastructureSegments = null;
    return storyHexInfrastructureSegmentsEnsure();
}

function storyHexInfrastructureDiagnostics() {
    const registry = storyHexInfrastructureSegmentsEnsure();
    if (!registry) return { available: false };
    return Object.assign({ available: true, adapterVersion: registry.adapterVersion,
        topologyHash: registry.topologyHash, revision: registry.revision,
        damagedSegmentCount: registry.segments.filter(segment => segment.damageBps > 0).length,
        closedSegmentCount: registry.segments.filter(segment => !segment.enabled
            || segment.lifecycleState === 'CLOSED').length }, registry.diagnostics);
}
