// ═══════════════════════════════════════════════════════════════════════════
//  ALTİGEN COĞRAFYA — HXD-2
//  ---------------------------------------------------------------------------
//  HexWorldV1 geometrisini kanonik StoryMapRaster kara/bölge kaynağıyla
//  birleştirir. Merkez piksel kararı yerine hücre alanını sabit örnek deseniyle
//  ölçer; kıyı ve ortak kenar geçişleri aynı rasterdan türetilir.
//
//  GEO.ranges gerçek bir yükseklik modeli değildir. Bu nedenle dağ koridoru
//  kategorik olarak kaydedilir; metre, min/max yükseklik veya eğim uydurulmaz.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_HEX_GEOGRAPHY_SCHEMA_VERSION = 1;
const STORY_HEX_GEOGRAPHY_ADAPTER_VERSION = 'story-hex-geography-1';
const STORY_HEX_GEOGRAPHY_ELEVATION_STATUS = 'UNAVAILABLE_NO_CANONICAL_SOURCE';
const STORY_HEX_TERRAIN_WATER = 0;
const STORY_HEX_TERRAIN_LAND = 1;
const STORY_HEX_TERRAIN_COAST = 2;
const STORY_HEX_TERRAIN_IMPASSABLE = 3;
const STORY_HEX_MOVEMENT_LAND = 1;
const STORY_HEX_MOVEMENT_WATER = 2;
const STORY_HEX_MOVEMENT_RIVER = 4;
const STORY_HEX_MOVEMENT_MOUNTAIN = 8;
const STORY_HEX_GEOGRAPHY_SAMPLE_RADII = Object.freeze([0, 0.38, 0.7, 0.92]);
const STORY_HEX_GEOGRAPHY_POLICY = Object.freeze({
    landTraversalCoverageBps: 5000,
    waterTraversalCoverageBps: 5000,
    mountainImpassableIntensityBps: 9000,
    mountainImpassableLandCoverageBps: 7000,
    mountainRangeRadiusFactor: 1.25,
    riverDistanceGeoPx: 3
});

let STORY_HEX_GEOGRAPHY_CACHE = null;
let STORY_HEX_GEOGRAPHY_TRANSIENT_RASTER = null;

function storyHexGeographyRasterEnsure() {
    const canonical = storyMapRasterEnsure();
    if (canonical) return canonical;
    // canonicalMapRaster kapalı A/B yolu doğrudan raster API'sinde null
    // kalmalıdır. Altıgen fiziksel katmanlar yine aynı GEO kaynağına ihtiyaç
    // duyar; bu nedenle STORY'ye yazılmayan, yalnız coğrafya adaptörünün
    // ömrü boyunca tutulan deterministik bir uyumluluk rasterı üret.
    if (typeof storyMapRasterEnabled !== 'function' || storyMapRasterEnabled()
        || typeof storyMapRasterCreate !== 'function'
        || typeof storyMapRasterSourceHash !== 'function'
        || typeof GEO === 'undefined' || !Array.isArray(GEO.land)) return null;
    const nodes = STORY.nodes || [];
    if (STORY_HEX_GEOGRAPHY_TRANSIENT_RASTER) {
        const cached = STORY_HEX_GEOGRAPHY_TRANSIENT_RASTER;
        const expected = storyMapRasterSourceHash(nodes, cached.width, cached.height);
        if (cached.sourceHash === expected) return cached;
    }
    const raster = storyMapRasterCreate({ nodes });
    raster.diagnostics = Object.assign({}, raster.diagnostics || {}, {
        loadMode: 'hex-transient-fallback'
    });
    STORY_HEX_GEOGRAPHY_TRANSIENT_RASTER = raster;
    return raster;
}

function storyHexGeographyHashInt(hash, value) {
    const integer = Number(value) | 0;
    for (let shift = 0; shift < 32; shift += 8) {
        hash ^= (integer >>> shift) & 255;
        hash = Math.imul(hash, 0x01000193);
    }
    return hash;
}

function storyHexGeographyHashArrays(arrays) {
    let hash = 0x811c9dc5;
    for (const values of arrays || []) {
        hash = storyHexGeographyHashInt(hash, values.length);
        for (let index = 0; index < values.length; index++) {
            hash = storyHexGeographyHashInt(hash, values[index]);
        }
    }
    return `fnv1a32:${(`00000000${(hash >>> 0).toString(16)}`).slice(-8)}`;
}

function storyHexGeographySourceHash(world, raster, geo) {
    const ranges = Array.isArray(geo && geo.ranges) ? geo.ranges : [];
    const rivers = Array.isArray(geo && geo.rivers) ? geo.rivers : [];
    return storyHexWorldHashText(JSON.stringify({
        schemaVersion: STORY_HEX_GEOGRAPHY_SCHEMA_VERSION,
        adapterVersion: STORY_HEX_GEOGRAPHY_ADAPTER_VERSION,
        worldLayoutHash: world.layoutHash,
        rasterSourceHash: raster.sourceHash,
        rasterLandHash: raster.landHash,
        rasterRegionHash: raster.regionHash,
        geoWidth: Number(geo && geo.W),
        geoHeight: Number(geo && geo.H),
        ranges,
        rivers,
        sampleRadii: STORY_HEX_GEOGRAPHY_SAMPLE_RADII,
        policy: STORY_HEX_GEOGRAPHY_POLICY
    }));
}

function storyHexGeographyRasterSample(raster, world, x, y) {
    const worldX = Number(x);
    const worldY = Number(y);
    if (worldX < 0 || worldY < 0 || worldX > world.width || worldY > world.height) return null;
    const rx = Math.max(0, Math.min(raster.width - 1, Math.floor(worldX / world.width * raster.width)));
    const ry = Math.max(0, Math.min(raster.height - 1, Math.floor(worldY / world.height * raster.height)));
    const offset = ry * raster.width + rx;
    return {
        land: raster.landMask[offset] === 1,
        regionId: Number(raster.regionIds[offset])
    };
}

function storyHexGeographySamplePoints(world, index) {
    const points = [];
    const cx = Number(world.centerX[index]);
    const cy = Number(world.centerY[index]);
    for (const fraction of STORY_HEX_GEOGRAPHY_SAMPLE_RADII) {
        if (fraction === 0) {
            points.push([cx, cy]);
            continue;
        }
        for (let direction = 0; direction < 6; direction++) {
            const angle = Math.PI / 180 * (60 * direction - 30);
            points.push([
                cx + world.radius * fraction * Math.cos(angle),
                cy + world.radius * fraction * Math.sin(angle)
            ]);
        }
    }
    return points;
}

function storyHexGeographyPointSegmentDistance(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const lengthSq = abx * abx + aby * aby;
    if (lengthSq <= 1e-12) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lengthSq));
    return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

function storyHexGeographyDistanceToPolyline(x, y, points) {
    if (!Array.isArray(points) || !points.length) return Infinity;
    if (points.length === 1) return Math.hypot(x - Number(points[0][0]), y - Number(points[0][1]));
    let best = Infinity;
    for (let index = 0; index < points.length - 1; index++) {
        const a = points[index];
        const b = points[index + 1];
        best = Math.min(best, storyHexGeographyPointSegmentDistance(
            x, y, Number(a[0]), Number(a[1]), Number(b[0]), Number(b[1])
        ));
    }
    return best;
}

function storyHexGeographyMountainIntensityBps(geoX, geoY, geo) {
    let intensity = 0;
    for (const range of (geo && geo.ranges) || []) {
        const radius = Math.max(1, Number(range && range.r) || 1)
            * STORY_HEX_GEOGRAPHY_POLICY.mountainRangeRadiusFactor;
        const distance = storyHexGeographyDistanceToPolyline(geoX, geoY, range && range.pts);
        if (distance > radius) continue;
        const strength = Math.max(0, Math.min(1, Number(range.str) || 0));
        intensity = Math.max(intensity, (1 - distance / radius) * strength);
    }
    return Math.max(0, Math.min(10000, Math.round(intensity * 10000)));
}

function storyHexGeographyRiverPresence(geoX, geoY, geo) {
    for (const river of (geo && geo.rivers) || []) {
        if (storyHexGeographyDistanceToPolyline(geoX, geoY, river)
            <= STORY_HEX_GEOGRAPHY_POLICY.riverDistanceGeoPx) return 1;
    }
    return 0;
}

function storyHexGeographyMajorityRegion(regionCounts) {
    let selected = -1;
    let selectedCount = -1;
    for (const key of Object.keys(regionCounts)) {
        const regionId = Number(key);
        const count = Number(regionCounts[key]);
        if (count > selectedCount || (count === selectedCount && regionId < selected)) {
            selected = regionId;
            selectedCount = count;
        }
    }
    return selected;
}

function storyHexGeographyCreate(options) {
    options = options || {};
    const world = options.world || storyHexWorldEnsure();
    const raster = options.raster || storyHexGeographyRasterEnsure();
    const geo = options.geo || (typeof GEO !== 'undefined' ? GEO : null);
    if (!world || !raster || !geo) throw new Error('HEX_GEOGRAPHY_SOURCE_MISSING');
    const sourceHash = storyHexGeographySourceHash(world, raster, geo);
    const terrainClass = new Uint8Array(world.cellCount);
    const landCoverageBps = new Uint16Array(world.cellCount);
    const regionIds = new Int16Array(world.cellCount);
    const landEdgeMask = new Uint8Array(world.cellCount);
    const waterEdgeMask = new Uint8Array(world.cellCount);
    const coastEdgeMask = new Uint8Array(world.cellCount);
    const movementMask = new Uint8Array(world.cellCount);
    const mountainIntensityBps = new Uint16Array(world.cellCount);
    const riverPresence = new Uint8Array(world.cellCount);
    regionIds.fill(-1);

    for (let index = 0; index < world.cellCount; index++) {
        const samples = storyHexGeographySamplePoints(world, index);
        let valid = 0;
        let land = 0;
        const regionCounts = Object.create(null);
        for (const point of samples) {
            const sample = storyHexGeographyRasterSample(raster, world, point[0], point[1]);
            if (!sample) continue;
            valid++;
            if (!sample.land) continue;
            land++;
            if (sample.regionId >= 0) regionCounts[sample.regionId] = (regionCounts[sample.regionId] || 0) + 1;
        }
        const coverage = valid ? Math.round(land / valid * 10000) : 0;
        landCoverageBps[index] = coverage;
        regionIds[index] = storyHexGeographyMajorityRegion(regionCounts);

        const geoX = Number(world.centerX[index]) / world.width * Number(geo.W);
        const geoY = Number(world.centerY[index]) / world.height * Number(geo.H);
        const mountain = storyHexGeographyMountainIntensityBps(geoX, geoY, geo);
        const river = storyHexGeographyRiverPresence(geoX, geoY, geo);
        mountainIntensityBps[index] = mountain;
        riverPresence[index] = river;

        const impassable = coverage >= STORY_HEX_GEOGRAPHY_POLICY.mountainImpassableLandCoverageBps
            && mountain >= STORY_HEX_GEOGRAPHY_POLICY.mountainImpassableIntensityBps;
        terrainClass[index] = impassable
            ? STORY_HEX_TERRAIN_IMPASSABLE
            : coverage === 0
                ? STORY_HEX_TERRAIN_WATER
                : coverage === 10000
                    ? STORY_HEX_TERRAIN_LAND
                    : STORY_HEX_TERRAIN_COAST;
        let movement = 0;
        if (!impassable && coverage >= STORY_HEX_GEOGRAPHY_POLICY.landTraversalCoverageBps) movement |= STORY_HEX_MOVEMENT_LAND;
        if (coverage <= STORY_HEX_GEOGRAPHY_POLICY.waterTraversalCoverageBps) movement |= STORY_HEX_MOVEMENT_WATER;
        if (river) movement |= STORY_HEX_MOVEMENT_RIVER;
        if (mountain > 0) movement |= STORY_HEX_MOVEMENT_MOUNTAIN;
        movementMask[index] = movement;
    }

    for (let index = 0; index < world.cellCount; index++) {
        const q = Number(world.qValues[index]);
        const r = Number(world.rValues[index]);
        for (let direction = 0; direction < STORY_HEX_WORLD_NEIGHBOR_DIRECTIONS.length; direction++) {
            const delta = STORY_HEX_WORLD_NEIGHBOR_DIRECTIONS[direction];
            const neighborIndex = storyHexWorldIndex(world, q + delta[0], r + delta[1]);
            if (neighborIndex < 0) continue;
            const x = (Number(world.centerX[index]) + Number(world.centerX[neighborIndex])) / 2;
            const y = (Number(world.centerY[index]) + Number(world.centerY[neighborIndex])) / 2;
            const sample = storyHexGeographyRasterSample(raster, world, x, y);
            if (!sample) continue;
            const bit = 1 << direction;
            if (sample.land) landEdgeMask[index] |= bit;
            else waterEdgeMask[index] |= bit;
            const opposite = (direction + 3) % 6;
            const differentMajority = (landCoverageBps[index] >= 5000)
                !== (landCoverageBps[neighborIndex] >= 5000);
            if (differentMajority || terrainClass[index] === STORY_HEX_TERRAIN_COAST
                || terrainClass[neighborIndex] === STORY_HEX_TERRAIN_COAST) {
                coastEdgeMask[index] |= bit;
                coastEdgeMask[neighborIndex] |= 1 << opposite;
            }
        }
    }

    const geographyHash = storyHexGeographyHashArrays([
        terrainClass, landCoverageBps, regionIds, landEdgeMask, waterEdgeMask,
        coastEdgeMask, movementMask, mountainIntensityBps, riverPresence
    ]);
    const byteLength = terrainClass.byteLength + landCoverageBps.byteLength + regionIds.byteLength
        + landEdgeMask.byteLength + waterEdgeMask.byteLength + coastEdgeMask.byteLength
        + movementMask.byteLength + mountainIntensityBps.byteLength + riverPresence.byteLength;
    return {
        schemaVersion: STORY_HEX_GEOGRAPHY_SCHEMA_VERSION,
        adapterVersion: STORY_HEX_GEOGRAPHY_ADAPTER_VERSION,
        worldLayoutHash: world.layoutHash,
        rasterSourceHash: raster.sourceHash,
        sourceHash,
        geographyHash,
        cellCount: world.cellCount,
        elevationStatus: STORY_HEX_GEOGRAPHY_ELEVATION_STATUS,
        terrainClass,
        landCoverageBps,
        regionIds,
        landEdgeMask,
        waterEdgeMask,
        coastEdgeMask,
        movementMask,
        mountainIntensityBps,
        riverPresence,
        diagnostics: { byteLength, loadMode: String(options.loadMode || 'runtime') }
    };
}

function storyHexGeographyValidate(geography, world, raster) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    const hexWorld = world || storyHexWorldEnsure();
    const mapRaster = raster || storyHexGeographyRasterEnsure();
    if (!geography || typeof geography !== 'object') {
        add('GEOGRAPHY_OBJECT', '$', 'HexGeography nesnesi zorunlu.');
        return { ok: false, issues };
    }
    if (geography.schemaVersion !== STORY_HEX_GEOGRAPHY_SCHEMA_VERSION) add('SCHEMA_VERSION', '$.schemaVersion', 'Coğrafya sürümü uyuşmuyor.');
    if (geography.adapterVersion !== STORY_HEX_GEOGRAPHY_ADAPTER_VERSION) add('ADAPTER_VERSION', '$.adapterVersion', 'Coğrafya adaptörü uyuşmuyor.');
    if (geography.worldLayoutHash !== hexWorld.layoutHash) add('WORLD_LAYOUT_HASH', '$.worldLayoutHash', 'HexWorld yerleşim karması uyuşmuyor.');
    if (geography.rasterSourceHash !== mapRaster.sourceHash) add('RASTER_SOURCE_HASH', '$.rasterSourceHash', 'Raster kaynak karması uyuşmuyor.');
    if (geography.elevationStatus !== STORY_HEX_GEOGRAPHY_ELEVATION_STATUS) add('ELEVATION_STATUS', '$.elevationStatus', 'Olmayan yükseklik kaynağı varmış gibi gösterilemez.');
    const fields = ['terrainClass', 'landCoverageBps', 'regionIds', 'landEdgeMask', 'waterEdgeMask', 'coastEdgeMask', 'movementMask', 'mountainIntensityBps', 'riverPresence'];
    for (const field of fields) {
        if (!geography[field] || geography[field].length !== hexWorld.cellCount) add('ARRAY_LENGTH', `$.${field}`, `${field} hücre sayısıyla uyuşmuyor.`);
    }
    if (!issues.length) {
        for (let index = 0; index < hexWorld.cellCount; index++) {
            const coverage = Number(geography.landCoverageBps[index]);
            const terrain = Number(geography.terrainClass[index]);
            if (coverage < 0 || coverage > 10000) add('COVERAGE_RANGE', `$.landCoverageBps[${index}]`, 'Kara kapsaması 0–10000 olmalı.');
            if (![0, 1, 2, 3].includes(terrain)) add('TERRAIN_CLASS', `$.terrainClass[${index}]`, 'Bilinmeyen arazi sınıfı.');
            if (coverage === 0 && terrain !== STORY_HEX_TERRAIN_WATER) add('WATER_CLASS', `$.terrainClass[${index}]`, 'Sıfır kara kapsaması WATER olmalı.');
            if (coverage > 0 && coverage < 10000 && terrain !== STORY_HEX_TERRAIN_COAST
                && terrain !== STORY_HEX_TERRAIN_IMPASSABLE) add('COAST_CLASS', `$.terrainClass[${index}]`, 'Karma kapsama COAST olmalı.');
            if (terrain === STORY_HEX_TERRAIN_IMPASSABLE
                && geography.mountainIntensityBps[index] < STORY_HEX_GEOGRAPHY_POLICY.mountainImpassableIntensityBps) {
                add('IMPASSABLE_SOURCE', `$.terrainClass[${index}]`, 'Geçilemez dağ hücresi kaynak eşiğini karşılamıyor.');
            }
            const q = Number(hexWorld.qValues[index]);
            const r = Number(hexWorld.rValues[index]);
            for (let direction = 0; direction < 6; direction++) {
                const delta = STORY_HEX_WORLD_NEIGHBOR_DIRECTIONS[direction];
                const neighbor = storyHexWorldIndex(hexWorld, q + delta[0], r + delta[1]);
                if (neighbor < 0) continue;
                const opposite = (direction + 3) % 6;
                for (const field of ['landEdgeMask', 'waterEdgeMask', 'coastEdgeMask']) {
                    const here = (geography[field][index] >> direction) & 1;
                    const there = (geography[field][neighbor] >> opposite) & 1;
                    if (here !== there) add('EDGE_ASYMMETRY', `$.${field}[${index}]`, `Kenar ${direction} komşusuyla simetrik değil.`);
                }
            }
            if (issues.length >= 50) break;
        }
        const expectedHash = storyHexGeographyHashArrays(fields.map(field => geography[field]));
        if (expectedHash !== geography.geographyHash) add('GEOGRAPHY_HASH', '$.geographyHash', 'Coğrafya checksum uyuşmuyor.');
    }
    return { ok: issues.length === 0, issues: issues.slice(0, 50) };
}

function storyHexGeographySummary(geography) {
    const counts = { WATER: 0, LAND: 0, COAST: 0, IMPASSABLE: 0 };
    let mountainCells = 0;
    let riverCells = 0;
    let landTraversableCells = 0;
    let waterTraversableCells = 0;
    for (let index = 0; index < geography.cellCount; index++) {
        const terrain = geography.terrainClass[index];
        if (terrain === STORY_HEX_TERRAIN_WATER) counts.WATER++;
        else if (terrain === STORY_HEX_TERRAIN_LAND) counts.LAND++;
        else if (terrain === STORY_HEX_TERRAIN_COAST) counts.COAST++;
        else if (terrain === STORY_HEX_TERRAIN_IMPASSABLE) counts.IMPASSABLE++;
        if (geography.mountainIntensityBps[index] > 0) mountainCells++;
        if (geography.riverPresence[index]) riverCells++;
        if (geography.movementMask[index] & STORY_HEX_MOVEMENT_LAND) landTraversableCells++;
        if (geography.movementMask[index] & STORY_HEX_MOVEMENT_WATER) waterTraversableCells++;
    }
    return { counts, mountainCells, riverCells, landTraversableCells, waterTraversableCells };
}

function storyHexGeographyEnsure() {
    const world = storyHexWorldEnsure();
    const raster = storyHexGeographyRasterEnsure();
    if (!world || !raster) return null;
    const expectedSourceHash = storyHexGeographySourceHash(world, raster, GEO);
    if (STORY_HEX_GEOGRAPHY_CACHE && STORY_HEX_GEOGRAPHY_CACHE.sourceHash === expectedSourceHash) {
        return STORY_HEX_GEOGRAPHY_CACHE;
    }
    const geography = storyHexGeographyCreate({ world, raster, geo: GEO, loadMode: 'runtime' });
    const validation = storyHexGeographyValidate(geography, world, raster);
    if (!validation.ok) throw new Error(`HEX_GEOGRAPHY_INVALID:${validation.issues.map(issue => issue.code).join(',')}`);
    STORY_HEX_GEOGRAPHY_CACHE = geography;
    return geography;
}

function storyHexGeographyResetCache() {
    STORY_HEX_GEOGRAPHY_CACHE = null;
    STORY_HEX_GEOGRAPHY_TRANSIENT_RASTER = null;
}

function storyHexGeographyCell(geography, world, q, r) {
    const index = storyHexWorldIndex(world, q, r);
    if (index < 0) return null;
    const names = ['WATER', 'LAND', 'COAST', 'IMPASSABLE'];
    return {
        id: storyHexWorldId(q, r),
        index,
        q: Number(q),
        r: Number(r),
        terrain: names[geography.terrainClass[index]] || 'UNKNOWN',
        landCoverageBps: Number(geography.landCoverageBps[index]),
        regionId: Number(geography.regionIds[index]),
        landEdgeMask: Number(geography.landEdgeMask[index]),
        waterEdgeMask: Number(geography.waterEdgeMask[index]),
        coastEdgeMask: Number(geography.coastEdgeMask[index]),
        movementMask: Number(geography.movementMask[index]),
        mountainIntensityBps: Number(geography.mountainIntensityBps[index]),
        river: geography.riverPresence[index] === 1,
        elevationStatus: geography.elevationStatus
    };
}

function storyHexGeographyResolveLandAnchor(geography, world, x, y, options) {
    options = options || {};
    const requested = storyHexWorldCellAt(world, x, y);
    const preferCoast = options.preferCoast === true;
    const maxDistance = Math.max(
        world.radius,
        Number(options.maxDistance) || world.radius * 6
    );
    let best = null;
    let fallback = null;
    for (let index = 0; index < world.cellCount; index++) {
        if (!(geography.movementMask[index] & STORY_HEX_MOVEMENT_LAND)) continue;
        if (geography.terrainClass[index] === STORY_HEX_TERRAIN_IMPASSABLE) continue;
        const dx = Number(world.centerX[index]) - Number(x);
        const dy = Number(world.centerY[index]) - Number(y);
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq > maxDistance * maxDistance) continue;
        const candidate = { index, distanceSq };
        if (!fallback || distanceSq < fallback.distanceSq
            || (distanceSq === fallback.distanceSq && index < fallback.index)) fallback = candidate;
        const coastal = geography.terrainClass[index] === STORY_HEX_TERRAIN_COAST
            || geography.coastEdgeMask[index] !== 0;
        if (preferCoast && !coastal) continue;
        if (!best || distanceSq < best.distanceSq
            || (distanceSq === best.distanceSq && index < best.index)) best = candidate;
    }
    const selected = best || fallback;
    if (!selected) return null;
    const q = Number(world.qValues[selected.index]);
    const r = Number(world.rValues[selected.index]);
    return {
        requested,
        resolved: {
            id: storyHexWorldId(q, r),
            index: selected.index,
            q,
            r,
            center: {
                x: Number(world.centerX[selected.index]),
                y: Number(world.centerY[selected.index])
            }
        },
        relocated: !requested || requested.index !== selected.index,
        distance: Math.sqrt(selected.distanceSq),
        preferredCoast: preferCoast,
        geography: storyHexGeographyCell(geography, world, q, r)
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STORY_HEX_GEOGRAPHY_SCHEMA_VERSION,
        STORY_HEX_GEOGRAPHY_ADAPTER_VERSION,
        STORY_HEX_GEOGRAPHY_ELEVATION_STATUS,
        STORY_HEX_TERRAIN_WATER,
        STORY_HEX_TERRAIN_LAND,
        STORY_HEX_TERRAIN_COAST,
        STORY_HEX_TERRAIN_IMPASSABLE,
        STORY_HEX_MOVEMENT_LAND,
        STORY_HEX_MOVEMENT_WATER,
        STORY_HEX_MOVEMENT_RIVER,
        STORY_HEX_MOVEMENT_MOUNTAIN,
        STORY_HEX_GEOGRAPHY_POLICY,
        storyHexGeographySourceHash,
        storyHexGeographyRasterSample,
        storyHexGeographyPointSegmentDistance,
        storyHexGeographyDistanceToPolyline,
        storyHexGeographyMountainIntensityBps,
        storyHexGeographyRiverPresence,
        storyHexGeographyCreate,
        storyHexGeographyValidate,
        storyHexGeographySummary,
        storyHexGeographyEnsure,
        storyHexGeographyResetCache,
        storyHexGeographyCell,
        storyHexGeographyResolveLandAnchor
    };
}
