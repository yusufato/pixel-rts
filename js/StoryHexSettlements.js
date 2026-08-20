// ═══════════════════════════════════════════════════════════════════════════
//  ALTİGEN ŞEHİR VE LİMAN ANKRAJLARI — HXD-4
//  ---------------------------------------------------------------------------
//  Şehir çekirdeğini kendi idarî bölgesindeki geçilebilir kara hücresine,
//  limanı ise ayrı kıyı-kara ve komşu seyredilebilir-su terminaline bağlar.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_HEX_SETTLEMENT_SCHEMA_VERSION = 1;
const STORY_HEX_SETTLEMENT_ADAPTER_VERSION = 'story-hex-settlements-1';
const STORY_HEX_SETTLEMENT_COAST_DISTANCE = 16.1 * 2;
const STORY_HEX_SETTLEMENT_PORT_FALLBACK_MAX_DISTANCE = 16.1 * 8;
let STORY_HEX_SETTLEMENT_CACHE = null;

function storyHexSettlementHashArrays(arrays) {
    let hash = 0x811c9dc5;
    for (const values of arrays || []) {
        const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
        hash ^= bytes.length & 255;
        hash = Math.imul(hash, 0x01000193);
        for (let index = 0; index < bytes.length; index++) {
            hash ^= bytes[index];
            hash = Math.imul(hash, 0x01000193);
        }
    }
    return `fnv1a32:${(`00000000${(hash >>> 0).toString(16)}`).slice(-8)}`;
}

function storyHexSettlementRequiredPortNames() {
    const names = new Set();
    for (const pair of (typeof STORY_INFRASTRUCTURE_SEA_LINKS !== 'undefined'
        ? STORY_INFRASTRUCTURE_SEA_LINKS : [])) {
        for (const name of pair || []) names.add(String(name));
    }
    // HXD-7.4.2b: A commissioned player/AI sea corridor is also a durable
    // port requirement.  Keeping this in the settlement source contract makes
    // port terminals rebuild deterministically after save/load; the route is
    // never represented by a macro-only line whose endpoint has no quay.
    const routes = typeof STORY !== 'undefined' && STORY.infrastructureWorks
        && Array.isArray(STORY.infrastructureWorks.routes)
        ? STORY.infrastructureWorks.routes : [];
    const cities = typeof GEO_CITIES !== 'undefined' ? GEO_CITIES : [];
    for (const route of routes) {
        if (!route || String(route.mode).toUpperCase() !== 'SEA') continue;
        for (const regionId of [route.fromRegionId, route.toRegionId]) {
            const match = /^region:(\d+)$/.exec(String(regionId || ''));
            const city = match && cities[Number(match[1])];
            if (city && city.name != null) names.add(String(city.name));
        }
    }
    return names;
}

function storyHexSettlementSourceHash(world, geography, regions, cities) {
    return storyHexWorldHashText(JSON.stringify({
        schemaVersion: STORY_HEX_SETTLEMENT_SCHEMA_VERSION,
        adapterVersion: STORY_HEX_SETTLEMENT_ADAPTER_VERSION,
        worldLayoutHash: world.layoutHash,
        geographyHash: geography.geographyHash,
        membershipHash: regions.membershipHash,
        cities: (cities || []).map((city, id) => [id, city.name, city.x, city.y]),
        requiredPorts: [...storyHexSettlementRequiredPortNames()].sort(),
        coastDistance: STORY_HEX_SETTLEMENT_COAST_DISTANCE,
        fallbackMaxDistance: STORY_HEX_SETTLEMENT_PORT_FALLBACK_MAX_DISTANCE
    }));
}

function storyHexSettlementCellRecord(world, index) {
    if (index < 0 || index >= world.cellCount) return null;
    const q = Number(world.qValues[index]);
    const r = Number(world.rValues[index]);
    return {
        id: storyHexWorldId(q, r),
        index,
        q,
        r,
        center: { x: Number(world.centerX[index]), y: Number(world.centerY[index]) }
    };
}

function storyHexSettlementNearestCore(world, geography, regionId, x, y, occupied) {
    let best = null;
    for (let index = 0; index < world.cellCount; index++) {
        if (Number(geography.regionIds[index]) !== regionId) continue;
        if (!(geography.movementMask[index] & STORY_HEX_MOVEMENT_LAND)) continue;
        if (geography.terrainClass[index] === STORY_HEX_TERRAIN_IMPASSABLE) continue;
        if (occupied && occupied.has(index)) continue;
        const dx = Number(world.centerX[index]) - x;
        const dy = Number(world.centerY[index]) - y;
        const distanceSq = dx * dx + dy * dy;
        if (!best || distanceSq < best.distanceSq
            || (distanceSq === best.distanceSq && index < best.index)) best = { index, distanceSq };
    }
    return best;
}

function storyHexSettlementNearestPort(world, geography, regionId, x, y) {
    let best = null;
    for (let landIndex = 0; landIndex < world.cellCount; landIndex++) {
        if (regionId != null && Number(geography.regionIds[landIndex]) !== regionId) continue;
        if (!(geography.movementMask[landIndex] & STORY_HEX_MOVEMENT_LAND)) continue;
        if (geography.terrainClass[landIndex] === STORY_HEX_TERRAIN_IMPASSABLE) continue;
        const q = Number(world.qValues[landIndex]);
        const r = Number(world.rValues[landIndex]);
        for (let direction = 0; direction < 6; direction++) {
            if (!((Number(geography.waterEdgeMask[landIndex]) >> direction) & 1)) continue;
            const delta = STORY_HEX_WORLD_NEIGHBOR_DIRECTIONS[direction];
            const waterIndex = storyHexWorldIndex(world, q + delta[0], r + delta[1]);
            if (waterIndex < 0 || !(geography.movementMask[waterIndex] & STORY_HEX_MOVEMENT_WATER)) continue;
            const dx = Number(world.centerX[landIndex]) - x;
            const dy = Number(world.centerY[landIndex]) - y;
            const distanceSq = dx * dx + dy * dy;
            if (!best || distanceSq < best.distanceSq
                || (distanceSq === best.distanceSq && landIndex < best.landIndex)
                || (distanceSq === best.distanceSq && landIndex === best.landIndex
                    && waterIndex < best.waterIndex)) {
                best = { landIndex, waterIndex, direction, distanceSq };
            }
        }
    }
    return best;
}

function storyHexSettlementsCreate(options) {
    options = options || {};
    const world = options.world || storyHexWorldEnsure();
    const geography = options.geography || storyHexGeographyEnsure();
    const regions = options.regions || storyHexRegionsEnsure();
    const cities = options.cities || GEO_CITIES || [];
    const requiredPorts = storyHexSettlementRequiredPortNames();
    const cityCount = cities.length;
    const geometricCoreCellIndices = new Uint16Array(cityCount);
    const coreCellIndices = new Uint16Array(cityCount);
    const coreRelocationDistances = new Float32Array(cityCount);
    const portFlags = new Uint8Array(cityCount);
    const requiredPortFlags = new Uint8Array(cityCount);
    const portLandCellIndices = new Int16Array(cityCount);
    const portWaterCellIndices = new Int16Array(cityCount);
    const portWaterDirections = new Int8Array(cityCount);
    const portDistances = new Float32Array(cityCount);
    const portHostRegionIds = new Int16Array(cityCount);
    const portFallbackFlags = new Uint8Array(cityCount);
    const portTerminalIds = new Int16Array(cityCount);
    portLandCellIndices.fill(-1);
    portWaterCellIndices.fill(-1);
    portWaterDirections.fill(-1);
    portHostRegionIds.fill(-1);
    portTerminalIds.fill(-1);
    const occupiedCores = new Set();
    const records = [];
    const portTerminalUse = new Map();
    const terminals = [];
    let invalidGeometricCoreCount = 0;
    let relocatedCoreCount = 0;
    let maxCoreRelocationDistance = 0;
    let requiredPortCount = 0;
    let missingRequiredPortCount = 0;

    for (let cityId = 0; cityId < cityCount; cityId++) {
        const city = cities[cityId];
        const x = Number(city.x) / Number(GEO.W) * world.width;
        const y = Number(city.y) / Number(GEO.H) * world.height;
        const geometric = storyHexWorldCellAt(world, x, y);
        if (!geometric) throw new Error(`HEX_CITY_GEOMETRIC_ANCHOR_MISSING:${cityId}`);
        geometricCoreCellIndices[cityId] = geometric.index;
        const geometricValid = Number(geography.regionIds[geometric.index]) === cityId
            && !!(geography.movementMask[geometric.index] & STORY_HEX_MOVEMENT_LAND)
            && geography.terrainClass[geometric.index] !== STORY_HEX_TERRAIN_IMPASSABLE
            && !occupiedCores.has(geometric.index);
        if (!geometricValid) invalidGeometricCoreCount++;
        const resolved = geometricValid
            ? { index: geometric.index, distanceSq: (
                (Number(world.centerX[geometric.index]) - x) ** 2
                + (Number(world.centerY[geometric.index]) - y) ** 2
            ) }
            : storyHexSettlementNearestCore(world, geography, cityId, x, y, occupiedCores);
        if (!resolved) throw new Error(`HEX_CITY_LAND_ANCHOR_MISSING:${cityId}`);
        occupiedCores.add(resolved.index);
        coreCellIndices[cityId] = resolved.index;
        const coreDistance = Math.sqrt(resolved.distanceSq);
        coreRelocationDistances[cityId] = coreDistance;
        const relocated = resolved.index !== geometric.index;
        if (relocated) relocatedCoreCount++;
        maxCoreRelocationDistance = Math.max(maxCoreRelocationDistance, coreDistance);

        const port = storyHexSettlementNearestPort(world, geography, cityId, x, y);
        const fallbackPort = !port && requiredPorts.has(String(city.name))
            ? storyHexSettlementNearestPort(world, geography, null, x, y)
            : null;
        const fallbackUsable = !!fallbackPort
            && Math.sqrt(fallbackPort.distanceSq) <= STORY_HEX_SETTLEMENT_PORT_FALLBACK_MAX_DISTANCE;
        const selectedPort = port || (fallbackUsable ? fallbackPort : null);
        const portDistance = selectedPort ? Math.sqrt(selectedPort.distanceSq) : Infinity;
        const requiredPort = requiredPorts.has(String(city.name));
        const coastal = !!port && Math.sqrt(port.distanceSq) <= STORY_HEX_SETTLEMENT_COAST_DISTANCE;
        const hasPort = !!selectedPort && (requiredPort || coastal);
        requiredPortFlags[cityId] = requiredPort ? 1 : 0;
        if (requiredPort) requiredPortCount++;
        if (requiredPort && !hasPort) missingRequiredPortCount++;
        if (hasPort) {
            portFlags[cityId] = 1;
            portLandCellIndices[cityId] = selectedPort.landIndex;
            portWaterCellIndices[cityId] = selectedPort.waterIndex;
            portWaterDirections[cityId] = selectedPort.direction;
            portDistances[cityId] = portDistance;
            portHostRegionIds[cityId] = Number(geography.regionIds[selectedPort.landIndex]);
            portFallbackFlags[cityId] = port ? 0 : 1;
            const terminalKey = `${selectedPort.landIndex}:${selectedPort.waterIndex}`;
            if (!portTerminalUse.has(terminalKey)) {
                const terminal = {
                    terminalId: terminals.length,
                    key: terminalKey,
                    land: storyHexSettlementCellRecord(world, selectedPort.landIndex),
                    water: storyHexSettlementCellRecord(world, selectedPort.waterIndex),
                    direction: selectedPort.direction,
                    hostRegionId: Number(geography.regionIds[selectedPort.landIndex]),
                    serviceCityIds: []
                };
                terminals.push(terminal);
                portTerminalUse.set(terminalKey, terminal);
            }
            const terminal = portTerminalUse.get(terminalKey);
            terminal.serviceCityIds.push(cityId);
            portTerminalIds[cityId] = terminal.terminalId;
        }
        records.push({
            cityId,
            name: String(city.name),
            source: { geoX: Number(city.x), geoY: Number(city.y), worldX: x, worldY: y },
            geometricCore: storyHexSettlementCellRecord(world, geometric.index),
            core: storyHexSettlementCellRecord(world, resolved.index),
            geometricTerrain: storyHexGeographyCell(
                geography, world, geometric.q, geometric.r
            ),
            coreTerrain: storyHexGeographyCell(
                geography,
                world,
                Number(world.qValues[resolved.index]),
                Number(world.rValues[resolved.index])
            ),
            relocated,
            coreDistance,
            requiredPort,
            coastal,
            port: hasPort ? {
                land: storyHexSettlementCellRecord(world, selectedPort.landIndex),
                water: storyHexSettlementCellRecord(world, selectedPort.waterIndex),
                direction: selectedPort.direction,
                distance: portDistance,
                terminalId: Number(portTerminalIds[cityId]),
                serviceCityId: cityId,
                hostRegionId: Number(geography.regionIds[selectedPort.landIndex]),
                fallbackCode: port ? null : 'LEGACY_GEOMETRY_FALLBACK'
            } : null,
            missingPortFallback: fallbackPort ? {
                hostRegionId: Number(geography.regionIds[fallbackPort.landIndex]),
                hostRegionName: String((cities[Number(geography.regionIds[fallbackPort.landIndex])] || {}).name || ''),
                land: storyHexSettlementCellRecord(world, fallbackPort.landIndex),
                water: storyHexSettlementCellRecord(world, fallbackPort.waterIndex),
                direction: fallbackPort.direction,
                distance: Math.sqrt(fallbackPort.distanceSq)
            } : null
        });
    }
    const settlementHash = storyHexSettlementHashArrays([
        geometricCoreCellIndices, coreCellIndices, coreRelocationDistances,
        portFlags, requiredPortFlags, portLandCellIndices, portWaterCellIndices,
        portWaterDirections, portDistances, portHostRegionIds, portFallbackFlags,
        portTerminalIds
    ]);
    const byteLength = geometricCoreCellIndices.byteLength + coreCellIndices.byteLength
        + coreRelocationDistances.byteLength + portFlags.byteLength
        + requiredPortFlags.byteLength + portLandCellIndices.byteLength
        + portWaterCellIndices.byteLength + portWaterDirections.byteLength
        + portDistances.byteLength + portHostRegionIds.byteLength
        + portFallbackFlags.byteLength + portTerminalIds.byteLength;
    return {
        schemaVersion: STORY_HEX_SETTLEMENT_SCHEMA_VERSION,
        adapterVersion: STORY_HEX_SETTLEMENT_ADAPTER_VERSION,
        sourceHash: storyHexSettlementSourceHash(world, geography, regions, cities),
        geographyHash: geography.geographyHash,
        membershipHash: regions.membershipHash,
        settlementHash,
        cityCount,
        geometricCoreCellIndices,
        coreCellIndices,
        coreRelocationDistances,
        portFlags,
        requiredPortFlags,
        portLandCellIndices,
        portWaterCellIndices,
        portWaterDirections,
        portDistances,
        portHostRegionIds,
        portFallbackFlags,
        portTerminalIds,
        terminals,
        records,
        diagnostics: {
            loadMode: String(options.loadMode || 'runtime'),
            byteLength,
            invalidGeometricCoreCount,
            relocatedCoreCount,
            maxCoreRelocationDistance,
            uniqueCoreCount: occupiedCores.size,
            portCount: portFlags.reduce((sum, flag) => sum + flag, 0),
            requiredPortCount,
            missingRequiredPortCount,
            legacyGeometryFallbackPortCount: portFallbackFlags.reduce(
                (sum, flag) => sum + flag, 0
            ),
            legacyGeometryFallbackPortNames: records
                .filter(record => record.port && record.port.fallbackCode)
                .map(record => record.name),
            missingRequiredPortNames: records
                .filter(record => record.requiredPort && !record.port)
                .map(record => record.name),
            missingRequiredPortFallbacks: records
                .filter(record => record.requiredPort && !record.port)
                .map(record => ({ name: record.name, fallback: record.missingPortFallback })),
            uniquePortTerminalCount: terminals.length,
            sharedPortTerminals: terminals
                .filter(terminal => terminal.serviceCityIds.length > 1)
                .map(terminal => ({
                    terminal: terminal.key,
                    terminalId: terminal.terminalId,
                    cityIds: terminal.serviceCityIds.slice(),
                    cityNames: terminal.serviceCityIds.map(
                        id => String(cities[id] && cities[id].name || id)
                    )
                }))
        }
    };
}

function storyHexSettlementsValidate(model, world, geography, regions, cities) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    const hexWorld = world || storyHexWorldEnsure();
    const hexGeography = geography || storyHexGeographyEnsure();
    const hexRegions = regions || storyHexRegionsEnsure();
    const sourceCities = cities || GEO_CITIES || [];
    if (!model || typeof model !== 'object') return { ok: false, issues: [{ code: 'MODEL_REQUIRED', path: '$', message: 'HexSettlements zorunlu.' }] };
    if (model.schemaVersion !== STORY_HEX_SETTLEMENT_SCHEMA_VERSION) add('SCHEMA_VERSION', '$.schemaVersion', 'Yerleşim şeması uyuşmuyor.');
    if (model.adapterVersion !== STORY_HEX_SETTLEMENT_ADAPTER_VERSION) add('ADAPTER_VERSION', '$.adapterVersion', 'Yerleşim adaptörü uyuşmuyor.');
    if (model.geographyHash !== hexGeography.geographyHash) add('GEOGRAPHY_SOURCE', '$.geographyHash', 'Yerleşim yanlış coğrafyaya bağlı.');
    if (model.membershipHash !== hexRegions.membershipHash) add('MEMBERSHIP_SOURCE', '$.membershipHash', 'Yerleşim yanlış idarî üyeliğe bağlı.');
    if (model.cityCount !== sourceCities.length) add('CITY_COUNT', '$.cityCount', 'Şehir sayısı uyuşmuyor.');
    const fields = ['geometricCoreCellIndices', 'coreCellIndices', 'coreRelocationDistances',
        'portFlags', 'requiredPortFlags', 'portLandCellIndices', 'portWaterCellIndices',
        'portWaterDirections', 'portDistances', 'portHostRegionIds', 'portFallbackFlags',
        'portTerminalIds'];
    for (const field of fields) {
        if (!model[field] || model[field].length !== sourceCities.length) add('ARRAY_LENGTH', `$.${field}`, `${field} uzunluğu uyuşmuyor.`);
    }
    if (!Array.isArray(model.records) || model.records.length !== sourceCities.length) add('RECORD_LENGTH', '$.records', 'Şehir kayıtları eksik.');
    if (!Array.isArray(model.terminals)) add('TERMINAL_REGISTRY', '$.terminals', 'Fiziksel liman terminal sicili eksik.');
    if (!issues.length) {
        const coreSet = new Set();
        const terminalKeys = new Set();
        for (let terminalId = 0; terminalId < model.terminals.length; terminalId++) {
            const terminal = model.terminals[terminalId];
            const expectedKey = `${Number(terminal.land && terminal.land.index)}:${Number(terminal.water && terminal.water.index)}`;
            if (Number(terminal.terminalId) !== terminalId) add('TERMINAL_ID', `$.terminals[${terminalId}]`, 'Liman terminal kimliği sıralı ve kararlı olmalı.');
            if (terminal.key !== expectedKey || terminalKeys.has(expectedKey)) add('TERMINAL_UNIQUE', `$.terminals[${terminalId}]`, 'Aynı fiziksel kara/su terminali yalnız bir kez tanımlanmalı.');
            terminalKeys.add(expectedKey);
            if (!Array.isArray(terminal.serviceCityIds) || terminal.serviceCityIds.length === 0) add('TERMINAL_SERVICE', `$.terminals[${terminalId}].serviceCityIds`, 'Fiziksel terminal en az bir şehre hizmet etmeli.');
        }
        for (let cityId = 0; cityId < sourceCities.length; cityId++) {
            const core = Number(model.coreCellIndices[cityId]);
            if (core >= hexWorld.cellCount) add('CORE_INDEX', `$.coreCellIndices[${cityId}]`, 'Şehir çekirdeği dünya dışında.');
            else {
                if (coreSet.has(core)) add('CORE_COLLISION', `$.coreCellIndices[${cityId}]`, 'İki şehir aynı çekirdek hücresini paylaşamaz.');
                coreSet.add(core);
                if (Number(hexGeography.regionIds[core]) !== cityId) add('CORE_REGION', `$.coreCellIndices[${cityId}]`, 'Şehir çekirdeği kendi idarî bölgesinde değil.');
                if (!(hexGeography.movementMask[core] & STORY_HEX_MOVEMENT_LAND)
                    || hexGeography.terrainClass[core] === STORY_HEX_TERRAIN_IMPASSABLE) {
                    add('CORE_NOT_LAND', `$.coreCellIndices[${cityId}]`, 'Şehir çekirdeği geçilebilir kara olmalı.');
                }
            }
            const hasPort = Number(model.portFlags[cityId]) === 1;
            if (Number(model.requiredPortFlags[cityId]) === 1 && !hasPort) add('REQUIRED_PORT_MISSING', `$.portFlags[${cityId}]`, 'Mevcut deniz bağlantısı ucu limansız kalamaz.');
            if (!hasPort) {
                if (Number(model.portLandCellIndices[cityId]) !== -1
                    || Number(model.portWaterCellIndices[cityId]) !== -1
                    || Number(model.portHostRegionIds[cityId]) !== -1
                    || Number(model.portFallbackFlags[cityId]) !== 0
                    || Number(model.portTerminalIds[cityId]) !== -1) add('PORT_GHOST', `$.portFlags[${cityId}]`, 'Kapalı liman terminal hücresi taşıyamaz.');
                continue;
            }
            const land = Number(model.portLandCellIndices[cityId]);
            const water = Number(model.portWaterCellIndices[cityId]);
            const direction = Number(model.portWaterDirections[cityId]);
            const hostRegionId = Number(model.portHostRegionIds[cityId]);
            const fallback = Number(model.portFallbackFlags[cityId]) === 1;
            const terminalId = Number(model.portTerminalIds[cityId]);
            if (land < 0 || water < 0 || direction < 0 || direction >= 6) {
                add('PORT_TERMINAL_INDEX', `$.portLandCellIndices[${cityId}]`, 'Liman terminal kimlikleri geçersiz.');
                continue;
            }
            if (Number(hexGeography.regionIds[land]) !== hostRegionId
                || !(hexGeography.movementMask[land] & STORY_HEX_MOVEMENT_LAND)) add('PORT_LAND_REGION', `$.portLandCellIndices[${cityId}]`, 'Liman kara terminali kayıtlı ev sahibi bölgede olmalı.');
            if (!fallback && hostRegionId !== cityId) add('PORT_HOST_REGION', `$.portHostRegionIds[${cityId}]`, 'Normal liman kendi şehir bölgesinde olmalı.');
            if (fallback && (Number(model.requiredPortFlags[cityId]) !== 1
                || Number(model.portDistances[cityId]) > STORY_HEX_SETTLEMENT_PORT_FALLBACK_MAX_DISTANCE)) {
                add('PORT_FALLBACK_POLICY', `$.portFallbackFlags[${cityId}]`, 'Coğrafya fallback yalnız zorunlu ve mesafe tavanlı limanda kullanılabilir.');
            }
            if (!(hexGeography.movementMask[water] & STORY_HEX_MOVEMENT_WATER)) add('PORT_WATER_ACCESS', `$.portWaterCellIndices[${cityId}]`, 'Liman su terminali seyredilebilir olmalı.');
            const delta = STORY_HEX_WORLD_NEIGHBOR_DIRECTIONS[direction];
            const expectedWater = storyHexWorldIndex(
                hexWorld,
                Number(hexWorld.qValues[land]) + delta[0],
                Number(hexWorld.rValues[land]) + delta[1]
            );
            if (expectedWater !== water) add('PORT_EDGE', `$.portWaterCellIndices[${cityId}]`, 'Liman kara ve su terminali ortak kenarlı olmalı.');
            if (!((Number(hexGeography.waterEdgeMask[land]) >> direction) & 1)) add('PORT_WATER_EDGE', `$.portWaterDirections[${cityId}]`, 'Liman bağlantı kenarı su geçişi taşımıyor.');
            const terminal = model.terminals[terminalId];
            if (!terminal || Number(terminal.land.index) !== land
                || Number(terminal.water.index) !== water
                || !terminal.serviceCityIds.includes(cityId)) {
                add('PORT_TERMINAL_BINDING', `$.portTerminalIds[${cityId}]`, 'Şehir liman hizmeti fiziksel terminal siciliyle uyuşmuyor.');
            }
        }
        const expectedHash = storyHexSettlementHashArrays([
            model.geometricCoreCellIndices, model.coreCellIndices,
            model.coreRelocationDistances, model.portFlags, model.requiredPortFlags,
            model.portLandCellIndices, model.portWaterCellIndices,
            model.portWaterDirections, model.portDistances,
            model.portHostRegionIds, model.portFallbackFlags, model.portTerminalIds
        ]);
        if (model.settlementHash !== expectedHash) add('SETTLEMENT_HASH', '$.settlementHash', 'Yerleşim checksum uyuşmuyor.');
    }
    return { ok: issues.length === 0, issues: issues.slice(0, 50) };
}

function storyHexSettlementsEnsure() {
    const world = storyHexWorldEnsure();
    const geography = storyHexGeographyEnsure();
    const regions = storyHexRegionsEnsure();
    const sourceHash = storyHexSettlementSourceHash(world, geography, regions, GEO_CITIES || []);
    if (STORY_HEX_SETTLEMENT_CACHE && STORY_HEX_SETTLEMENT_CACHE.sourceHash === sourceHash) return STORY_HEX_SETTLEMENT_CACHE;
    const model = storyHexSettlementsCreate({ world, geography, regions, cities: GEO_CITIES, loadMode: 'runtime' });
    const validation = storyHexSettlementsValidate(model, world, geography, regions, GEO_CITIES);
    if (!validation.ok) throw new Error(`HEX_SETTLEMENTS_INVALID:${validation.issues.map(issue => issue.code).join(',')}:${JSON.stringify(model.diagnostics.missingRequiredPortFallbacks)}`);
    STORY_HEX_SETTLEMENT_CACHE = model;
    return model;
}

function storyHexSettlementsResetCache() {
    STORY_HEX_SETTLEMENT_CACHE = null;
}

// Render, hit-test and camera code must resolve a city through this single
// adapter. The legacy lx/ly coordinates remain a rollback fallback only.
function storyHexSettlementNodePosition(node, worldWidth, worldHeight) {
    const fallback = {
        x: Number(node && node.lx || 0) * Number(worldWidth || 0),
        y: Number(node && node.ly || 0) * Number(worldHeight || 0),
        cellId: null,
        source: 'LEGACY_NORMALIZED_FALLBACK'
    };
    if (!node || !Number.isInteger(Number(node.id))) return fallback;
    try {
        const world = storyHexWorldEnsure();
        const model = storyHexSettlementsEnsure();
        const record = model.records[Number(node.id)];
        if (!record || !record.core) return fallback;
        return {
            x: Number(record.core.center.x) / Number(world.width) * Number(worldWidth),
            y: Number(record.core.center.y) / Number(world.height) * Number(worldHeight),
            cellId: record.core.id,
            source: 'HEX_SETTLEMENT_CORE'
        };
    } catch (_) {
        return fallback;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STORY_HEX_SETTLEMENT_SCHEMA_VERSION,
        STORY_HEX_SETTLEMENT_ADAPTER_VERSION,
        STORY_HEX_SETTLEMENT_COAST_DISTANCE,
        STORY_HEX_SETTLEMENT_PORT_FALLBACK_MAX_DISTANCE,
        storyHexSettlementHashArrays,
        storyHexSettlementRequiredPortNames,
        storyHexSettlementSourceHash,
        storyHexSettlementNearestCore,
        storyHexSettlementNearestPort,
        storyHexSettlementsCreate,
        storyHexSettlementsValidate,
        storyHexSettlementsEnsure,
        storyHexSettlementsResetCache,
        storyHexSettlementNodePosition
    };
}
