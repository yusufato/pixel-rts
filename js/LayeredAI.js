// ═══════════════════════════════════════════════════════════════
//  KATMANLI CANLI AI — Algı > Strateji > Manga > Komut > Adaptasyon
// ═══════════════════════════════════════════════════════════════

const AI_COMMAND_PRIORITY = Object.freeze({
    SEARCH: 30,
    STRATEGIC: 40,
    SQUAD: 60,
    COMBAT: 80,
    LOGISTICS: 90,
    SURVIVAL: 100
});

const AI_DOCTRINE = Object.freeze({
    ADVANCE: 'advance',
    HUNT: 'hunt',
    ENCIRCLE: 'encircle',
    BREAKTHROUGH: 'breakthrough',
    ATTRITION: 'attrition',
    CLEANUP: 'cleanup',
    LAST_HUNT: 'last_hunt',
    ANTI_ARTILLERY: 'anti_artillery',
    SIEGE_BREAK: 'siege_break',
    REGROUP: 'regroup',
    LAST_STAND: 'last_stand'
});

const AI_DOCTRINE_STORAGE_KEY = 'pixelRtsDoctrineMemory';

class AIWorldModel {
    constructor() {
        this.contacts = new Map();
        this.lastSightTime = -Infinity;
        this.lastKnownCenter = { x: WORLD_W / 2, y: WORLD_H * 0.82 };
        this.searchIndex = 0;
        this.searchChangedAt = -Infinity;
        this.searchWaypoints = [
            { x: WORLD_W * 0.50, y: WORLD_H * 0.62 },
            { x: WORLD_W * 0.25, y: WORLD_H * 0.70 },
            { x: WORLD_W * 0.75, y: WORLD_H * 0.70 },
            { x: WORLD_W * 0.12, y: WORLD_H * 0.84 },
            { x: WORLD_W * 0.88, y: WORLD_H * 0.84 },
            { x: WORLD_W * 0.50, y: WORLD_H * 0.92 }
        ];
    }

    reset() {
        this.contacts.clear();
        this.lastSightTime = -Infinity;
        this.lastKnownCenter = { x: WORLD_W / 2, y: WORLD_H * 0.82 };
        this.searchIndex = 0;
        this.searchChangedAt = -Infinity;
    }

    update(now, visibleEnemies) {
        const visibleIds = new Set();
        let sumX = 0;
        let sumY = 0;

        for (const enemyUnit of visibleEnemies) {
            visibleIds.add(enemyUnit.id);
            const previous = this.contacts.get(enemyUnit.id);
            const dt = previous ? Math.max(1, now - previous.seenAt) : 1;
            const vx = previous ? (enemyUnit.x - previous.x) / dt : 0;
            const vy = previous ? (enemyUnit.y - previous.y) / dt : 0;
            this.contacts.set(enemyUnit.id, {
                id: enemyUnit.id,
                type: enemyUnit.type,
                x: enemyUnit.x,
                y: enemyUnit.y,
                vx,
                vy,
                hpRatio: enemyUnit.hp / enemyUnit.maxHp,
                seenAt: now,
                confidence: 1
            });
            sumX += enemyUnit.x;
            sumY += enemyUnit.y;
        }

        if (visibleEnemies.length > 0) {
            this.lastSightTime = now;
            this.lastKnownCenter = { x: sumX / visibleEnemies.length, y: sumY / visibleEnemies.length };
        }

        for (const [id, contact] of this.contacts) {
            if (visibleIds.has(id)) continue;
            const age = now - contact.seenAt;
            contact.confidence = Math.max(0, 1 - age / 30000);
            contact.x = Math.max(0, Math.min(WORLD_W, contact.x + contact.vx * Math.min(age, 1500)));
            contact.y = Math.max(0, Math.min(WORLD_H, contact.y + contact.vy * Math.min(age, 1500)));
            contact.vx *= 0.72;
            contact.vy *= 0.72;
            if (contact.confidence <= 0) this.contacts.delete(id);
        }
    }

    getEstimatedCenter() {
        const trusted = [...this.contacts.values()].filter(contact => contact.confidence > 0.25);
        if (trusted.length === 0) return { ...this.lastKnownCenter };
        let weight = 0;
        let x = 0;
        let y = 0;
        for (const contact of trusted) {
            weight += contact.confidence;
            x += contact.x * contact.confidence;
            y += contact.y * contact.confidence;
        }
        return { x: x / weight, y: y / weight };
    }

    hasRecentContact(now, memoryMs = 5000) {
        return now - this.lastSightTime <= memoryMs;
    }

    getSearchTarget(ownUnits, now) {
        let target = this.searchWaypoints[this.searchIndex];
        const arrived = ownUnits.filter(unit => Math.hypot(unit.x - target.x, unit.y - target.y) < 300).length;
        const required = Math.max(2, Math.ceil(ownUnits.length * 0.35));
        if (now - this.searchChangedAt > 3500 && arrived >= required) {
            this.searchIndex = (this.searchIndex + 1) % this.searchWaypoints.length;
            this.searchChangedAt = now;
            target = this.searchWaypoints[this.searchIndex];
        }
        return { ...target };
    }

    getOpponentProfile(visibleEnemies) {
        const profile = { total: 0, armor: 0, support: 0, artillery: 0, fast: 0 };
        const source = visibleEnemies.length > 0
            ? visibleEnemies.map(unit => ({ type: unit.type, confidence: 1 }))
            : [...this.contacts.values()];
        for (const contact of source) {
            const confidence = contact.confidence ?? 1;
            profile.total += confidence;
            if ([T.ARMOR, T.MECH_INFANTRY, T.ARMOR_INFANTRY].includes(contact.type)) profile.armor += confidence;
            if ([T.ARTILLERY, T.MEDIC, T.ENGINEER, T.ANTI_TANK].includes(contact.type)) profile.support += confidence;
            if (contact.type === T.ARTILLERY) profile.artillery += confidence;
            if ([T.RECON, T.MECH_INFANTRY].includes(contact.type)) profile.fast += confidence;
        }
        return profile;
    }

    threatAt(x, y) {
        let threat = 0;
        for (const contact of this.contacts.values()) {
            const stats = STATS[contact.type];
            const distance = Math.max(1, Math.hypot(x - contact.x, y - contact.y));
            const reach = stats.range + stats.vision * 0.25;
            if (distance < reach) threat += contact.confidence * stats.atk * (1 - distance / reach);
        }
        return threat;
    }
}

// Dağları genişletilmiş daireler olarak kabul eden küçük bir görünürlük grafiği.
// Hedef dağın arkasındaysa birlik önce güvenli çevre düğümlerine, sonra hedefe gider.
class AIMountainNavigator {
    constructor() {
        this.states = new Map();
        // Unit.update içindeki dağ itme alanı r + UNIT_RADIUS + 80'dir.
        // Rota bunun dışında kalmalı; aksi halde planlayıcı ile hareket motoru zıt emir verir.
        this.collisionPadding = UNIT_RADIUS + 108;
        this.clearance = UNIT_RADIUS + 150;
    }

    reset() {
        this.states.clear();
    }

    mountains() {
        return terrainFeatures.filter(terrain => terrain.type === TERRAIN.MOUNTAIN);
    }

    distanceToSegment(point, start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const lengthSq = dx * dx + dy * dy;
        if (lengthSq <= 0.0001) return Math.hypot(point.x - start.x, point.y - start.y);
        const projection = Math.max(0, Math.min(1,
            ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq));
        return Math.hypot(point.x - (start.x + dx * projection), point.y - (start.y + dy * projection));
    }

    segmentClear(start, end) {
        for (const mountain of this.mountains()) {
            const radius = mountain.r + this.collisionPadding;
            const startDistance = Math.hypot(start.x - mountain.x, start.y - mountain.y);
            const endDistance = Math.hypot(end.x - mountain.x, end.y - mountain.y);

            // Çarpışma çözümü birliği güvenlik çemberinin içinde bırakmışsa dışarı çıkmasına izin ver.
            const startMovesOutward = (end.x - start.x) * (start.x - mountain.x) +
                (end.y - start.y) * (start.y - mountain.y) > 0;
            const endApproachesOutward = (start.x - end.x) * (end.x - mountain.x) +
                (start.y - end.y) * (end.y - mountain.y) > 0;
            if (startDistance < radius && endDistance > startDistance && startMovesOutward) continue;
            if (endDistance < radius && startDistance > endDistance && endApproachesOutward) continue;
            if (this.distanceToSegment(mountain, start, end) < radius) return false;
        }
        return true;
    }

    pointClear(point) {
        return this.mountains().every(mountain =>
            Math.hypot(point.x - mountain.x, point.y - mountain.y) >= mountain.r + this.collisionPadding
        );
    }

    nearestClearPoint(point, origin) {
        if (this.pointClear(point)) return { ...point };
        let best = null;
        let bestScore = Infinity;
        for (let radius = 70; radius <= 700; radius += 70) {
            for (let index = 0; index < 24; index++) {
                const angle = index / 24 * Math.PI * 2;
                const candidate = {
                    x: Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS, point.x + Math.cos(angle) * radius)),
                    y: Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS, point.y + Math.sin(angle) * radius))
                };
                if (!this.pointClear(candidate)) continue;
                const score = radius + Math.hypot(candidate.x - origin.x, candidate.y - origin.y) * 0.08;
                if (score < bestScore) {
                    best = candidate;
                    bestScore = score;
                }
            }
            if (best) break;
        }
        return best || { ...origin };
    }

    findGridPath(start, requestedGoal) {
        const goal = this.nearestClearPoint(requestedGoal, start);
        const cellSize = 85;
        const columns = Math.ceil(WORLD_W / cellSize);
        const rows = Math.ceil(WORLD_H / cellSize);
        const toCell = point => ({
            x: Math.max(0, Math.min(columns - 1, Math.floor(point.x / cellSize))),
            y: Math.max(0, Math.min(rows - 1, Math.floor(point.y / cellSize)))
        });
        const toPoint = cell => ({
            x: Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS, (cell.x + 0.5) * cellSize)),
            y: Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS, (cell.y + 0.5) * cellSize))
        });
        const key = (x, y) => y * columns + x;
        const startCell = toCell(start);
        const goalCell = toCell(goal);
        const startKey = key(startCell.x, startCell.y);
        const goalKey = key(goalCell.x, goalCell.y);
        const open = [startKey];
        const openSet = new Set(open);
        const cameFrom = new Map();
        const gScore = new Map([[startKey, 0]]);
        const fScore = new Map([[startKey, Math.hypot(goalCell.x - startCell.x, goalCell.y - startCell.y)]]);
        const directions = [
            [1, 0], [-1, 0], [0, 1], [0, -1],
            [1, 1], [1, -1], [-1, 1], [-1, -1]
        ];

        while (open.length > 0) {
            let bestIndex = 0;
            for (let index = 1; index < open.length; index++) {
                if ((fScore.get(open[index]) ?? Infinity) < (fScore.get(open[bestIndex]) ?? Infinity)) bestIndex = index;
            }
            const currentKey = open.splice(bestIndex, 1)[0];
            openSet.delete(currentKey);
            if (currentKey === goalKey) {
                const cells = [];
                let cursor = currentKey;
                while (cursor !== startKey) {
                    cells.unshift({ x: cursor % columns, y: Math.floor(cursor / columns) });
                    cursor = cameFrom.get(cursor);
                    if (cursor === undefined) return null;
                }
                const rawPath = cells.map(toPoint);
                rawPath.push(goal);

                // Gereksiz zikzakları sil; yalnızca dağ kümesini gerçekten dolaştıran dönemeçler kalır.
                const smoothed = [];
                let anchor = { ...start };
                let cursorIndex = 0;
                while (cursorIndex < rawPath.length) {
                    let farthest = cursorIndex;
                    for (let probe = rawPath.length - 1; probe >= cursorIndex; probe--) {
                        if (this.segmentClear(anchor, rawPath[probe])) {
                            farthest = probe;
                            break;
                        }
                    }
                    smoothed.push(rawPath[farthest]);
                    anchor = rawPath[farthest];
                    cursorIndex = farthest + 1;
                }
                return smoothed;
            }

            const current = { x: currentKey % columns, y: Math.floor(currentKey / columns) };
            const currentPoint = currentKey === startKey ? start : toPoint(current);
            for (const [dx, dy] of directions) {
                const neighbor = { x: current.x + dx, y: current.y + dy };
                if (neighbor.x < 0 || neighbor.x >= columns || neighbor.y < 0 || neighbor.y >= rows) continue;
                const neighborPoint = key(neighbor.x, neighbor.y) === goalKey ? goal : toPoint(neighbor);
                if (!this.pointClear(neighborPoint) || !this.segmentClear(currentPoint, neighborPoint)) continue;
                const neighborKey = key(neighbor.x, neighbor.y);
                const tentative = (gScore.get(currentKey) ?? Infinity) + Math.hypot(dx, dy);
                if (tentative >= (gScore.get(neighborKey) ?? Infinity)) continue;
                cameFrom.set(neighborKey, currentKey);
                gScore.set(neighborKey, tentative);
                fScore.set(neighborKey, tentative + Math.hypot(goalCell.x - neighbor.x, goalCell.y - neighbor.y));
                if (!openSet.has(neighborKey)) {
                    open.push(neighborKey);
                    openSet.add(neighborKey);
                }
            }
        }
        return null;
    }

    buildNodes(start, goal) {
        const nodes = [{ ...start }, { ...goal }];
        for (const mountain of this.mountains()) {
            const radius = mountain.r + this.clearance;
            for (let index = 0; index < 12; index++) {
                const angle = index / 12 * Math.PI * 2;
                nodes.push({
                    x: Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS, mountain.x + Math.cos(angle) * radius)),
                    y: Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS, mountain.y + Math.sin(angle) * radius))
                });
            }
        }
        return nodes;
    }

    findPath(start, goal) {
        const safeGoal = this.nearestClearPoint(goal, start);
        if (this.segmentClear(start, safeGoal)) return [{ ...safeGoal }];

        // Izgara araması, üst üste binen dağ güvenlik çemberlerini tek bir engel kümesi gibi dolaşır.
        const gridPath = this.findGridPath(start, safeGoal);
        if (gridPath && gridPath.length > 0) return gridPath;

        const nodes = this.buildNodes(start, safeGoal);
        const distances = new Array(nodes.length).fill(Infinity);
        const previous = new Array(nodes.length).fill(-1);
        const visited = new Array(nodes.length).fill(false);
        distances[0] = 0;

        for (let iteration = 0; iteration < nodes.length; iteration++) {
            let current = -1;
            for (let index = 0; index < nodes.length; index++) {
                if (!visited[index] && (current < 0 || distances[index] < distances[current])) current = index;
            }
            if (current < 0 || distances[current] === Infinity || current === 1) break;
            visited[current] = true;

            for (let neighbor = 0; neighbor < nodes.length; neighbor++) {
                if (neighbor === current || visited[neighbor] || !this.segmentClear(nodes[current], nodes[neighbor])) continue;
                const candidate = distances[current] + Math.hypot(
                    nodes[neighbor].x - nodes[current].x,
                    nodes[neighbor].y - nodes[current].y
                );
                if (candidate < distances[neighbor]) {
                    distances[neighbor] = candidate;
                    previous[neighbor] = current;
                }
            }
        }

        if (previous[1] < 0) return [this.escapePoint(start, safeGoal), { ...safeGoal }];
        const path = [];
        let cursor = 1;
        while (cursor > 0) {
            path.unshift({ ...nodes[cursor] });
            cursor = previous[cursor];
        }
        return path;
    }

    escapePoint(unit, goal) {
        const directionX = goal.x - unit.x;
        const directionY = goal.y - unit.y;
        const length = Math.max(1, Math.hypot(directionX, directionY));
        const candidates = [];
        for (const side of [1, -1]) {
            for (const lateral of [190, 280, 390]) {
                candidates.push({
                    x: Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS,
                        unit.x + directionX / length * 55 + (-directionY / length) * side * lateral)),
                    y: Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS,
                        unit.y + directionY / length * 55 + (directionX / length) * side * lateral))
                });
            }
        }
        const clearCandidate = candidates.find(candidate => this.pointClear(candidate) && this.segmentClear(unit, candidate));
        return clearCandidate || this.nearestClearPoint(candidates[0], unit);
    }

    nextTarget(unit, goal, now) {
        let state = this.states.get(unit.id);
        if (!state) {
            state = {
                goal: null,
                path: [],
                plannedAt: -Infinity,
                sampleAt: now,
                sampleX: unit.x,
                sampleY: unit.y,
                stuckCount: 0,
                escapeUntil: -Infinity,
                escape: null
            };
            this.states.set(unit.id, state);
        }

        if (now - state.sampleAt >= 900) {
            const moved = Math.hypot(unit.x - state.sampleX, unit.y - state.sampleY);
            const stillHasDistance = Math.hypot(goal.x - unit.x, goal.y - unit.y) > 120;
            const nearMountain = this.mountains().some(mountain =>
                Math.hypot(unit.x - mountain.x, unit.y - mountain.y) < mountain.r + this.clearance + 55
            );
            state.stuckCount = stillHasDistance && moved < (nearMountain ? 20 : 10) ? state.stuckCount + 1 : 0;
            state.sampleAt = now;
            state.sampleX = unit.x;
            state.sampleY = unit.y;
            if (state.stuckCount >= (nearMountain ? 1 : 2)) {
                state.escape = this.escapePoint(unit, goal);
                state.escapeUntil = now + (nearMountain ? 1900 : 1100);
                state.path = [];
                state.stuckCount = 0;
            }
        }

        if (state.escape && now < state.escapeUntil && Math.hypot(unit.x - state.escape.x, unit.y - state.escape.y) > 35) {
            unit.navigationState = 'ESCAPE';
            return state.escape;
        }

        const goalChanged = !state.goal || Math.hypot(goal.x - state.goal.x, goal.y - state.goal.y) > 110;
        const pathBlocked = state.path.length > 0 && !this.segmentClear(unit, state.path[0]);
        // Aynı hedef için yolu sürekli yeniden kurmak sağ/sol rota salınımı yaratıyordu.
        if (goalChanged || state.path.length === 0 || pathBlocked) {
            state.goal = { ...goal };
            state.path = this.findPath(unit, goal);
            state.plannedAt = now;
        }
        while (state.path.length > 1 && Math.hypot(unit.x - state.path[0].x, unit.y - state.path[0].y) < 55) {
            state.path.shift();
        }
        unit.navigationState = state.path.length > 1 ? 'DETOUR' : 'DIRECT';
        return state.path[0] || goal;
    }
}

class AICommandArbiter {
    constructor() {
        this.commands = new Map();
    }

    beginCycle() {
        this.commands.clear();
    }

    issue(unit, command) {
        const current = this.commands.get(unit.id);
        if (!current || command.priority > current.priority ||
            (command.priority === current.priority && command.createdAt >= current.createdAt)) {
            this.commands.set(unit.id, command);
        }
    }

    apply(unit, navigator, now) {
        const command = this.commands.get(unit.id);
        if (!command) return;
        unit.aiAction = command.action;
        if (command.targetUnit && !command.targetUnit.dead) unit.attackTarget = command.targetUnit;
        if (Number.isFinite(command.x) && Number.isFinite(command.y)) {
            const goal = {
                x: Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS, command.x)),
                y: Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS, command.y))
            };
            const next = navigator.nextTarget(unit, goal, now);
            unit.targetX = next.x;
            unit.targetY = next.y;
        }
    }
}

class AIDoctrineBandit {
    constructor() {
        this.stats = {};
        try {
            this.stats = JSON.parse(localStorage.getItem(AI_DOCTRINE_STORAGE_KEY)) || {};
        } catch (error) {
            this.stats = {};
        }
    }

    bonus(doctrine) {
        const record = this.stats[doctrine];
        if (!record || record.count === 0) return 0;
        return Math.max(-0.35, Math.min(0.35, record.value / Math.sqrt(record.count + 1) / 800));
    }

    record(doctrine, reward) {
        if (!doctrine) return;
        const record = this.stats[doctrine] || { count: 0, value: 0 };
        record.count++;
        record.value += reward;
        this.stats[doctrine] = record;
    }

    save() {
        try {
            localStorage.setItem(AI_DOCTRINE_STORAGE_KEY, JSON.stringify(this.stats));
        } catch (error) {}
    }
}

class AIStrategicDirector {
    constructor(bandit) {
        this.bandit = bandit;
        this.doctrine = AI_DOCTRINE.ADVANCE;
        this.lastChangeAt = -Infinity;
    }

    decide(now, state) {
        const genes = aiGenome.tacticGenes;
        const forceRatio = state.combat?.forceRatio ?? 1;
        const hp = state.hpRatio ?? 1;
        const own = state.ownUnits || [];

        // Kendi kompozisyonum (matchup analizi için)
        const myAntiArmor = own.filter(u => u.type === T.ANTI_TANK || u.type === T.ARTILLERY).length;

        // Durum okuması (ekonomi YOK: beklemek = kaybetmek → temkin sınırlı)
        const losingMath = forceRatio < 0.6;   // ancak ciddi ezilince geri çekil (eski 0.72 çok erken turtle yapıyordu)
        const winningMath = forceRatio > Math.min(genes.decisiveForceRatio ?? 1.35, 1.3); // kesin saldırı eşiği tavanı: genom aşırı temkin (1.69) öğrense bile ~1.3'te saldır
        const evenMath = forceRatio >= 0.9 && !winningMath;
        const badTrade = (state.valueTradeRatio ?? 0) > 1.12 && !winningMath;
        const bleeding = (state.damageEfficiency ?? 1) < 0.85 && state.visibleEnemies > 0 && !winningMath;
        const antiArtilleryBlocked = state.antiArtilleryBlocked || state.antiArtilleryCooldown;
        const enemyRetreating = state.enemyRetreating && state.visibleEnemies > 0;
        const stalled = state.idlePressure > 35 && state.visibleEnemies > 0;
        const armorWall = state.armorScreenThreat && state.visibleEnemies > 0;
        // Tank hattını kıracak gücüm var mı? (AT/topçu sayısı, kendi zırhım, ya da sayısal üstünlük)
        const canBreakArmor = myAntiArmor >= 2 || state.armorRatio > 0.4 || forceRatio > 1.15;

        // ── KATMAN 1: STRATEJİK DURUŞ (üst akıl) ──
        let posture;
        if (hp < 0.25) posture = 'LAST_STAND';
        else if (winningMath && hp > 0.5) posture = 'DECISIVE';          // kesin vuruş: topla, ez
        else if (losingMath || hp < 0.4) posture = 'DELAY';             // güç koru, taciz, fırsat bekle
        else if (evenMath && (bleeding || badTrade || (armorWall && !canBreakArmor))) posture = 'DEFENSE'; // tahkim et, bekle
        else posture = 'OFFENSE';
        this.posture = posture;

        // ── KATMAN 2: Fırsat tespitleri ──
        const lastHuntOpportunity = state.enemyUnits.length > 0 && state.enemyUnits.length <= 2 &&
            (state.visibleEnemies > 0 || state.recentContact || winningMath);
        const antiArtilleryOpportunity = state.visibleEnemies > 0 && state.enemyProfile.artillery > 0 &&
            state.enemyUnits.length > 2;
        const siegeBreakOpportunity = state.visibleEnemies > 0 && canBreakArmor &&
            (state.enemyInFields >= Math.max(1, state.visibleEnemies * 0.35) ||
                state.enemyProfile.artillery > 0 && state.enemyProfile.support / Math.max(1, state.enemyProfile.total) > 0.35);
        const cleanupOpportunity = state.visibleEnemies > 0 &&
            (state.enemyUnits.length <= 3 || winningMath && state.enemyUnits.length <= Math.max(5, own.length * 0.45));

        // ── KATMAN 3: Doktrin puanlama ──
        const scores = {
            [AI_DOCTRINE.ADVANCE]: 1.0 + genes.vanguardAggression * 0.35 + (forceRatio - 1) * 0.3,
            [AI_DOCTRINE.HUNT]: state.visibleEnemies === 0 && !state.recentContact ? 2.8 : state.visibleEnemies === 0 ? 0.7 : -1,
            [AI_DOCTRINE.ENCIRCLE]: 0.5 + genes.flankRatio + state.enemyProfile.support / Math.max(1, state.enemyProfile.total) +
                (winningMath ? 0.55 : 0),
            [AI_DOCTRINE.BREAKTHROUGH]: 0.3 + state.armorRatio * 1.7 + genes.targetArmorPriority * 0.15 +
                (winningMath ? 0.8 : 0),
            [AI_DOCTRINE.ATTRITION]: 0.6 + state.supportRatio * 1.4 + myAntiArmor * 0.3,
            [AI_DOCTRINE.CLEANUP]: cleanupOpportunity ? 4.8 + Math.max(0, forceRatio - 1) : -1.2,
            [AI_DOCTRINE.LAST_HUNT]: lastHuntOpportunity ? 6.4 + Math.max(0, forceRatio - 1) : -2.0,
            [AI_DOCTRINE.ANTI_ARTILLERY]: antiArtilleryOpportunity ? 3.4 + state.enemyProfile.artillery * 0.3 : -1.5,
            [AI_DOCTRINE.SIEGE_BREAK]: siegeBreakOpportunity ? 4.0 + state.enemyInFields * 0.2 : -1.4,
            [AI_DOCTRINE.REGROUP]: hp < genes.vanguardRetreat + 0.08 || losingMath && hp < 0.55 ? 3.2 : -0.4,
            [AI_DOCTRINE.LAST_STAND]: hp < 0.22 ? 4.0 : -1
        };

        // Duruş → doktrin ağırlıkları
        if (posture === 'DECISIVE') {
            scores[AI_DOCTRINE.ADVANCE] += 1.2; scores[AI_DOCTRINE.CLEANUP] += 1.0;
            scores[AI_DOCTRINE.ENCIRCLE] += 0.8; scores[AI_DOCTRINE.BREAKTHROUGH] += 0.6;
        } else if (posture === 'OFFENSE') {
            scores[AI_DOCTRINE.ADVANCE] += 0.6; scores[AI_DOCTRINE.ENCIRCLE] += 0.6;
        } else if (posture === 'DEFENSE') {
            // Ekonomi yok → saf turtle ölümcül. Tut ama YOĞUNLAŞ ve karşı vur.
            scores[AI_DOCTRINE.ATTRITION] += 1.2; scores[AI_DOCTRINE.ENCIRCLE] += 0.8;
            scores[AI_DOCTRINE.ADVANCE] += 0.4;
            scores[AI_DOCTRINE.BREAKTHROUGH] -= 1.5; scores[AI_DOCTRINE.SIEGE_BREAK] -= 1.0;
        } else if (posture === 'DELAY') {
            // Sonsuz çekilme = ölüm. Yıprat ama fırsatta yoğunlaşıp vur.
            scores[AI_DOCTRINE.ATTRITION] += 1.4; scores[AI_DOCTRINE.REGROUP] += 1.2;
            scores[AI_DOCTRINE.ENCIRCLE] += 0.4;
            scores[AI_DOCTRINE.BREAKTHROUGH] -= 2.0; scores[AI_DOCTRINE.SIEGE_BREAK] -= 1.8;
            scores[AI_DOCTRINE.ADVANCE] -= 0.8;
        }

        // Matchup ayarları
        if (badTrade || bleeding) {
            scores[AI_DOCTRINE.ATTRITION] += badTrade ? 1.2 : 0.7;
            scores[AI_DOCTRINE.REGROUP] += hp < 0.6 ? 1.4 : 0.4;   // sadece gerçekten düşük HP'de toparlan
            scores[AI_DOCTRINE.ENCIRCLE] += 0.5;                    // kötü takasta yan/arka ara
            scores[AI_DOCTRINE.BREAKTHROUGH] -= 1.8;
        }
        if (armorWall) {
            if (canBreakArmor) {
                scores[AI_DOCTRINE.ATTRITION] += 1.8;   // AT/topçu standoff
                scores[AI_DOCTRINE.ENCIRCLE] += 1.0;    // kanattan AT
                scores[AI_DOCTRINE.BREAKTHROUGH] += state.armorRatio > 0.4 ? 1.2 : -0.5;
            } else {
                // Tankı kıracak gücüm yok → yıprat/çekil, ASLA kör dalma
                scores[AI_DOCTRINE.ATTRITION] += 1.4;
                scores[AI_DOCTRINE.REGROUP] += 1.6;
                scores[AI_DOCTRINE.BREAKTHROUGH] -= 3.0;
                scores[AI_DOCTRINE.SIEGE_BREAK] -= 3.0;
            }
        }
        if (enemyRetreating) {
            scores[AI_DOCTRINE.ENCIRCLE] += 3.2;
            scores[AI_DOCTRINE.ADVANCE] += 0.6;
            scores[AI_DOCTRINE.ANTI_ARTILLERY] -= 1.4;
        }
        // ── FAZ 2: BÖLGE TEMPO BASKISI ── puan/bölge geride isem ve çekişilecek nokta varsa, tempoyu zorla.
        // Turtle eden insanı puanla cezalandırmak için noktalara baskı (pickTerritoryTarget hedefler;
        // localExchange vetosu suicidal charge'ı önler → güvenli yığılma).
        if (state.visibleEnemies > 0 && posture !== 'LAST_STAND') {
            const losingTerritory = (state.vpDeficit || 0) > 0 || (state.vpEnemy || 0) > (state.vpOwn || 0);
            const contestable = (state.vpOpen || 0) > 0 || (state.vpEnemy || 0) > 0;
            if (losingTerritory && contestable) {
                const w = (genes.vpPressureWeight != null) ? genes.vpPressureWeight : 1.0;
                scores[AI_DOCTRINE.ADVANCE] += 2.4 * w;
                scores[AI_DOCTRINE.ENCIRCLE] += 1.4 * w;
                scores[AI_DOCTRINE.ATTRITION] -= 1.0 * w;
                scores[AI_DOCTRINE.REGROUP] -= 0.8 * w;
            }
        }
        // Bu oyunda ekonomi/üs yok: BEKLEMEK = KAYBETMEK. Temas yoksa saldırıya zorla.
        if (state.idlePressure > 25 && state.visibleEnemies > 0 && posture !== 'LAST_STAND') {
            scores[AI_DOCTRINE.ADVANCE] += 4.0;
            scores[AI_DOCTRINE.ENCIRCLE] += 1.2;
            if (cleanupOpportunity) scores[AI_DOCTRINE.CLEANUP] += 1.5;
            scores[AI_DOCTRINE.ATTRITION] -= 2.2;   // turtle yapma, temasa gir
            scores[AI_DOCTRINE.REGROUP] -= 2.0;
            scores[AI_DOCTRINE.ANTI_ARTILLERY] -= 2.5; // topçu kovalama, ana kuvveti ez
        } else if (stalled) {
            scores[AI_DOCTRINE.ENCIRCLE] += 1.0;
        }
        if (antiArtilleryBlocked) {
            scores[AI_DOCTRINE.ANTI_ARTILLERY] -= 5.5;
            scores[AI_DOCTRINE.ENCIRCLE] += 1.5;
            scores[AI_DOCTRINE.ATTRITION] += 1.0;
        }
        // Güç üstünlüğü varsa: standoff/topçu-kovalama YOK → kapat ve ez (insanı yenmenin yolu).
        if (winningMath && hp > 0.45) {
            scores[AI_DOCTRINE.ADVANCE] += 1.8;
            scores[AI_DOCTRINE.CLEANUP] += 1.0;
            scores[AI_DOCTRINE.ANTI_ARTILLERY] -= 2.0;
            scores[AI_DOCTRINE.ATTRITION] -= 1.5;
            scores[AI_DOCTRINE.REGROUP] -= 1.5;
        }

        for (const doctrine of Object.keys(scores)) scores[doctrine] += this.bandit.bonus(doctrine);

        let selected = this.doctrine;
        let bestScore = scores[selected] ?? -Infinity;
        for (const [doctrine, score] of Object.entries(scores)) {
            if (score > bestScore) {
                selected = doctrine;
                bestScore = score;
            }
        }

        const critical = selected === AI_DOCTRINE.LAST_STAND || selected === AI_DOCTRINE.REGROUP;
        if (selected !== this.doctrine && (critical || now - this.lastChangeAt > 1800)) {
            this.doctrine = selected;
            this.lastChangeAt = now;
        }
        return this.doctrine;
    }

    modifiers() {
        const table = {
            [AI_DOCTRINE.ADVANCE]: { aggression: 1, flank: 1, spacing: 1 },
            [AI_DOCTRINE.HUNT]: { aggression: 1.18, flank: 1.15, spacing: 1.15 },
            [AI_DOCTRINE.ENCIRCLE]: { aggression: 1.02, flank: 1.45, spacing: 1.12 },
            [AI_DOCTRINE.BREAKTHROUGH]: { aggression: 1.12, flank: 0.88, spacing: 0.92 },
            [AI_DOCTRINE.ATTRITION]: { aggression: 0.78, flank: 0.95, spacing: 1.08 },
            [AI_DOCTRINE.CLEANUP]: { aggression: 1.7, flank: 0.55, spacing: 0.62 },
            [AI_DOCTRINE.LAST_HUNT]: { aggression: 1.9, flank: 0.72, spacing: 0.58 },
            [AI_DOCTRINE.ANTI_ARTILLERY]: { aggression: 0.96, flank: 1.85, spacing: 1.18 },
            [AI_DOCTRINE.SIEGE_BREAK]: { aggression: 0.92, flank: 1.25, spacing: 1.18 },
            [AI_DOCTRINE.REGROUP]: { aggression: 0.55, flank: 0.65, spacing: 0.72 },
            [AI_DOCTRINE.LAST_STAND]: { aggression: 1.5, flank: 0.8, spacing: 0.7 }
        };
        return table[this.doctrine];
    }
}

class AISquadPlanner {
    assign(ownUnits, genes) {
        // FAZ 1: merkez (pin) güçlü kalsın → kanat EN FAZLA %40 (gen daha yüksek dese de)
        const maxFlank = Math.max(1, Math.floor(ownUnits.length * Math.min(0.4, genes.flankRatio)));
        const combat = [];
        for (const unit of ownUnits) {
            if ([T.MEDIC, T.ARTILLERY, T.ENGINEER, T.ANTI_TANK].includes(unit.type)) unit.squad = SQUAD.SUPPORT;
            else combat.push(unit);
        }
        // kanat önceliği hızlılara (keşif/mekanize); gerisi merkezde pin
        combat.sort((a, b) =>
            ([T.RECON, T.MECH_INFANTRY].includes(a.type) ? 0 : 1) -
            ([T.RECON, T.MECH_INFANTRY].includes(b.type) ? 0 : 1));
        for (let i = 0; i < combat.length; i++) {
            combat[i].squad = i < maxFlank ? SQUAD.FLANK : SQUAD.VANGUARD;
        }
    }

    getObjectives(state, doctrine, modifiers, worldModel) {
        const genes = aiGenome.tacticGenes;
        // HEDEF ÖNCELİĞİ: (1) lehte kavga (COMMIT Schwerpunkt) → dövüş; (2) yoksa kontrol noktası → tut/çekiş
        // (turtle-kır: zafer puanı al, düşmanı dışarı zorla); (3) yoksa düşman merkezi.
        const advisorTarget = (state.advisor && state.advisor.posture === ADVISOR_POSTURE.COMMIT && state.advisor.target)
            ? state.advisor.target : null;
        const target = doctrine === AI_DOCTRINE.HUNT
            ? worldModel.getSearchTarget(state.ownUnits, state.now)
            : (advisorTarget || state.territoryTarget || worldModel.getEstimatedCenter());
        let dx = target.x - state.center.x;
        let dy = target.y - state.center.y;
        const length = Math.max(1, Math.hypot(dx, dy));
        dx /= length;
        dy /= length;
        this.dirX = dx; this.dirY = dy;   // birleşik-silah rol-derinliği için ilerleme yönü
        const px = -dy;
        const py = dx;
        const flankWidth = genes.flankWidth * modifiers.flank;
        const clampPoint = point => ({
            x: Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS, point.x)),
            y: Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS, point.y))
        });

        if (doctrine === AI_DOCTRINE.REGROUP) {
            return {
                target,
                vanguard: { x: WORLD_W / 2, y: 260 },
                flankLeft: { x: WORLD_W / 2 - 220, y: 300 },
                flankRight: { x: WORLD_W / 2 + 220, y: 300 },
                support: { x: WORLD_W / 2, y: 180 }
            };
        }

        if (doctrine === AI_DOCTRINE.ATTRITION) {
            // Yıpratma/savunma: geride ateş hattı kur, düşmanı menzile çek (kör dalma yok)
            const wideAt = Math.max(300, flankWidth * 0.7);
            return {
                target,
                vanguard: clampPoint({ x: target.x - dx * 300, y: target.y - dy * 300 }),
                flankLeft: clampPoint({ x: target.x + px * wideAt - dx * 210, y: target.y + py * wideAt - dy * 210 }),
                flankRight: clampPoint({ x: target.x - px * wideAt - dx * 210, y: target.y - py * wideAt - dy * 210 }),
                support: clampPoint({ x: target.x - dx * 430, y: target.y - dy * 430 })
            };
        }

        if (state.compressionMode && doctrine !== AI_DOCTRINE.CLEANUP && doctrine !== AI_DOCTRINE.LAST_HUNT) {
            const retreatVector = state.enemyRetreatVector || { x: dx, y: dy };
            const rvLength = Math.max(1, Math.hypot(retreatVector.x, retreatVector.y));
            const rvx = retreatVector.x / rvLength;
            const rvy = retreatVector.y / rvLength;
            const rvpx = -rvy;
            const rvpy = rvx;
            const pressure = Math.max(0, Math.min(1, ((state.idlePressure ?? 0) - 95) / 190));
            // Çember KAPANSIN: kanatlar yandan gelip silah menziline girsin, öncü hedefin üstüne kapansın
            const baseCutDistance = Math.min(140, Math.max(70, 60 + (state.enemyRetreatScore ?? 0) * 120));
            const baseWide = Math.max(180, flankWidth * 0.5);
            const cutDistance = baseCutDistance * (1 - pressure) + 40 * pressure;
            const wide = baseWide * (1 - pressure) + 120 * pressure;
            const vanguardBack = 90 * (1 - pressure) + 35 * pressure;
            const supportBack = 320 * (1 - pressure) + 230 * pressure;
            return {
                target,
                vanguard: clampPoint({ x: target.x - dx * vanguardBack, y: target.y - dy * vanguardBack }),
                flankLeft: clampPoint({ x: target.x + rvx * cutDistance + rvpx * wide, y: target.y + rvy * cutDistance + rvpy * wide }),
                flankRight: clampPoint({ x: target.x + rvx * cutDistance - rvpx * wide, y: target.y + rvy * cutDistance - rvpy * wide }),
                support: clampPoint({ x: target.x - dx * supportBack, y: target.y - dy * supportBack })
            };
        }

        if (doctrine === AI_DOCTRINE.CLEANUP) {
            return {
                target,
                vanguard: { x: target.x, y: target.y },
                flankLeft: { x: target.x + px * Math.min(160, flankWidth * 0.45) - dx * 20, y: target.y + py * Math.min(160, flankWidth * 0.45) - dy * 20 },
                flankRight: { x: target.x - px * Math.min(160, flankWidth * 0.45) - dx * 20, y: target.y - py * Math.min(160, flankWidth * 0.45) - dy * 20 },
                support: { x: target.x - dx * 170, y: target.y - dy * 170 }
            };
        }

        if (doctrine === AI_DOCTRINE.LAST_HUNT) {
            return {
                target,
                vanguard: { x: target.x, y: target.y },
                flankLeft: { x: target.x + px * 260 + dx * 90, y: target.y + py * 260 + dy * 90 },
                flankRight: { x: target.x - px * 260 + dx * 90, y: target.y - py * 260 + dy * 90 },
                support: { x: target.x - dx * 220, y: target.y - dy * 220 }
            };
        }

        if (doctrine === AI_DOCTRINE.ANTI_ARTILLERY) {
            return {
                target,
                vanguard: { x: target.x - dx * 240, y: target.y - dy * 240 },
                flankLeft: { x: target.x + px * Math.max(460, flankWidth) - dx * 90, y: target.y + py * Math.max(460, flankWidth) - dy * 90 },
                flankRight: { x: target.x - px * Math.max(460, flankWidth) - dx * 90, y: target.y - py * Math.max(460, flankWidth) - dy * 90 },
                support: { x: target.x - dx * 360, y: target.y - dy * 360 }
            };
        }

        if (doctrine === AI_DOCTRINE.SIEGE_BREAK) {
            return {
                target,
                vanguard: { x: target.x - dx * 330, y: target.y - dy * 330 },
                flankLeft: { x: target.x + px * Math.max(360, flankWidth * 0.9) - dx * 160, y: target.y + py * Math.max(360, flankWidth * 0.9) - dy * 160 },
                flankRight: { x: target.x - px * Math.max(360, flankWidth * 0.9) - dx * 160, y: target.y - py * Math.max(360, flankWidth * 0.9) - dy * 160 },
                support: { x: target.x - dx * 430, y: target.y - dy * 430 }
            };
        }

        return {
            target,
            vanguard: { x: target.x - dx * 90, y: target.y - dy * 90 },
            flankLeft: { x: target.x + px * flankWidth - dx * 40, y: target.y + py * flankWidth - dy * 40 },
            flankRight: { x: target.x - px * flankWidth - dx * 40, y: target.y - py * flankWidth - dy * 40 },
            support: { x: target.x - dx * 260, y: target.y - dy * 260 }
        };
    }

    slotFor(unit, index, objectives, modifiers) {
        const genes = aiGenome.tacticGenes;
        const formation = this.formation || 'flex';
        // Durumsal formasyon: mızrak ucu sık, geniş hat seyrek
        const spacingMul = formation === 'wedge' ? 0.8 : formation === 'line' ? 1.3 : 1.0;
        const spacing = (90 - genes.cohesion * 50) * modifiers.spacing * spacingMul;
        let slot;
        if (unit.squad === SQUAD.FLANK) {
            const base = index % 2 === 0 ? objectives.flankLeft : objectives.flankRight;
            slot = { x: base.x + (index % 3 - 1) * spacing, y: base.y + Math.floor(index / 3) * spacing * 0.5 };
        } else if (unit.squad === SQUAD.SUPPORT) {
            slot = { x: objectives.support.x + (index % 5 - 2) * spacing, y: objectives.support.y - Math.floor(index / 5) * spacing };
        } else {
            slot = { x: objectives.vanguard.x + (index % 7 - 3) * spacing, y: objectives.vanguard.y + Math.floor(index / 7) * spacing * 0.55 };
        }

        // ── BİRLEŞİK SİLAH ROL-DERİNLİĞİ ──
        // dir = düşmana doğru birim vektör. depth>0 = ön (düşmana doğru), depth<0 = geri.
        const dirX = this.dirX || 0, dirY = this.dirY || 0;
        let depth = 0;
        if (unit.isReserve) {
            depth = -220;                                            // YEDEK: derin geride bekler
        } else {
            switch (unit.type) {
                case T.ARMOR: depth = formation === 'wedge' ? 90 : 55; break;   // tank en önde (kalkan/çekiç)
                case T.INFANTRY:
                case T.ARMOR_INFANTRY: depth = -25; break;                       // piyade tankın hemen arkasında
                case T.ANTI_TANK: depth = 140; break;                            // tanksavar: derin destekten ÖNE çek → ekran
                case T.ARTILLERY: depth = 0; break;                              // topçu derin (support çapası)
                case T.MEDIC:
                case T.ENGINEER: depth = -60; break;                             // en derin
                default: depth = 0;
            }
        }
        slot.x += dirX * depth;
        slot.y += dirY * depth;
        return this.adjustForTerrain(slot, unit.squad);
    }

    adjustForTerrain(point, squad) {
        const adjusted = { ...point };
        for (const terrain of terrainFeatures) {
            const distance = Math.hypot(adjusted.x - terrain.x, adjusted.y - terrain.y);
            if (terrain.type === TERRAIN.MOUNTAIN && distance < terrain.r + 70) {
                const dx = (adjusted.x - terrain.x) / Math.max(1, distance);
                const dy = (adjusted.y - terrain.y) / Math.max(1, distance);
                adjusted.x = terrain.x + dx * (terrain.r + 90);
                adjusted.y = terrain.y + dy * (terrain.r + 90);
            }
            if (terrain.type === TERRAIN.FOREST && squad === SQUAD.SUPPORT && distance < terrain.r + 180) {
                adjusted.x = adjusted.x * 0.72 + terrain.x * 0.28;
                adjusted.y = adjusted.y * 0.72 + terrain.y * 0.28;
            }
        }
        return adjusted;
    }
}

class LayeredAIController {
    constructor(side = true, telemetry = (typeof battleTelemetry !== 'undefined' ? battleTelemetry : null)) {
        this.side = side;
        this.telemetry = telemetry;
        this.world = new AIWorldModel();
        this.navigator = new AIMountainNavigator();
        this.arbiter = new AICommandArbiter();
        this.bandit = new AIDoctrineBandit();
        this.director = new AIStrategicDirector(this.bandit);
        this.planner = new AISquadPlanner();
        this.advisor = (typeof LookaheadAdvisor !== 'undefined') ? new LookaheadAdvisor(side) : null;  // ileriye-bakış danışmanı
        this.advisorPlan = null;
        this.lastUpdate = -Infinity;
        this.lastAdaptAt = 0;
        this.lastDamageDealt = 0;
        this.lastDamageTaken = 0;
        this.lastEnemyValueDestroyed = 0;
        this.lastAiValueLost = 0;
        this.lastEnemyCenter = null;
        this.lastEnemyCenterAt = -Infinity;
        this.enemyRetreatScore = 0;
        this.enemyStaticScore = 0;
        this.enemyRetreatVector = { x: 0, y: 1 };
        this.antiArtilleryStartAt = -Infinity;
        this.antiArtilleryDamageAt = 0;
        this.antiArtilleryCooldownUntil = -Infinity;
    }

    reset(now = 0) {
        this.world.reset();
        this.navigator.reset();
        if (this.advisor) this.advisor.reset();
        this.advisorPlan = null;
        this.arbiter.beginCycle();
        this.lastUpdate = -Infinity;
        this.lastAdaptAt = now;
        this.lastDamageDealt = 0;
        this.lastDamageTaken = 0;
        this.lastEnemyValueDestroyed = 0;
        this.lastAiValueLost = 0;
        this.lastEnemyCenter = null;
        this.lastEnemyCenterAt = -Infinity;
        this.enemyRetreatScore = 0;
        this.enemyStaticScore = 0;
        this.enemyRetreatVector = { x: 0, y: 1 };
        this.antiArtilleryStartAt = -Infinity;
        this.antiArtilleryDamageAt = 0;
        this.antiArtilleryCooldownUntil = -Infinity;
        this.director.doctrine = AI_DOCTRINE.ADVANCE;
    }

    measureEnemyRetreat(now, visibleEnemies, center) {
        if (visibleEnemies.length === 0) {
            this.enemyRetreatScore = Math.max(0, this.enemyRetreatScore - 0.08);
            this.enemyStaticScore = Math.max(0, this.enemyStaticScore - 0.10);
            return {
                retreating: false,
                static: false,
                score: this.enemyRetreatScore,
                vector: { ...this.enemyRetreatVector }
            };
        }

        const enemyCenter = visibleEnemies.reduce((acc, unit) => ({
            x: acc.x + unit.x,
            y: acc.y + unit.y
        }), { x: 0, y: 0 });
        enemyCenter.x /= visibleEnemies.length;
        enemyCenter.y /= visibleEnemies.length;

        if (!this.lastEnemyCenter || now - this.lastEnemyCenterAt < 650) {
            if (!this.lastEnemyCenter) {
                this.lastEnemyCenter = { ...enemyCenter };
                this.lastEnemyCenterAt = now;
            }
            return {
                retreating: this.enemyRetreatScore > 0.58,
                static: this.enemyStaticScore > 0.55,
                score: this.enemyRetreatScore,
                vector: { ...this.enemyRetreatVector }
            };
        }

        const dt = Math.max(1, now - this.lastEnemyCenterAt);
        const vx = (enemyCenter.x - this.lastEnemyCenter.x) / dt;
        const vy = (enemyCenter.y - this.lastEnemyCenter.y) / dt;
        const speed = Math.hypot(vx, vy);
        const dx = enemyCenter.x - center.x;
        const dy = enemyCenter.y - center.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const awaySpeed = vx * dx / distance + vy * dy / distance;
        const movingAway = awaySpeed > 0.018 && speed > 0.016 && distance > 360;

        this.enemyRetreatScore = Math.max(0, Math.min(1,
            this.enemyRetreatScore + (movingAway ? 0.26 : -0.16)
        ));
        // SABİT/SAVUNMA tespiti: düşman merkezi neredeyse hiç kıpırdamıyorsa turtle yapıyor.
        const holding = speed < 0.011 && !movingAway;
        this.enemyStaticScore = Math.max(0, Math.min(1,
            this.enemyStaticScore + (holding ? 0.20 : -0.24)
        ));
        if (speed > 0.012) {
            this.enemyRetreatVector = { x: vx / speed, y: vy / speed };
        }
        this.lastEnemyCenter = { ...enemyCenter };
        this.lastEnemyCenterAt = now;

        return {
            retreating: this.enemyRetreatScore > 0.55,
            static: this.enemyStaticScore > 0.55,
            score: this.enemyRetreatScore,
            vector: { ...this.enemyRetreatVector }
        };
    }

    antiArtilleryStatus(now, previousDoctrine) {
        const damage = this.telemetry && this.telemetry.started
            ? this.telemetry.antiArtilleryDamage
            : 0;
        const cooldown = now < this.antiArtilleryCooldownUntil;
        if (previousDoctrine !== AI_DOCTRINE.ANTI_ARTILLERY) {
            if (!cooldown) {
                this.antiArtilleryStartAt = -Infinity;
                this.antiArtilleryDamageAt = damage;
            }
            return { blocked: cooldown, cooldown };
        }

        if (!Number.isFinite(this.antiArtilleryStartAt) || this.antiArtilleryStartAt < 0) {
            this.antiArtilleryStartAt = now;
            this.antiArtilleryDamageAt = damage;
            return { blocked: cooldown, cooldown };
        }

        const elapsed = now - this.antiArtilleryStartAt;
        const progress = damage - this.antiArtilleryDamageAt;
        if (progress >= 160) {
            this.antiArtilleryStartAt = now;
            this.antiArtilleryDamageAt = damage;
            return { blocked: cooldown, cooldown };
        }
        if (elapsed > 24000 && progress < 85) {
            this.antiArtilleryCooldownUntil = now + 18000;
            this.antiArtilleryStartAt = -Infinity;
            this.antiArtilleryDamageAt = damage;
            return { blocked: true, cooldown: true };
        }
        return { blocked: cooldown, cooldown };
    }

    measureSupportReadiness(ownUnits, visibleEnemies, objectives) {
        const fireSupport = ownUnits.filter(unit =>
            [T.ARTILLERY, T.ANTI_TANK].includes(unit.type) &&
            unit.hp > 0 &&
            unit.ammo > Math.max(0, unit.maxAmmo * 0.10)
        );
        if (visibleEnemies.length === 0 || fireSupport.length === 0) {
            return { ready: true, ratio: 1, readyCount: fireSupport.length, total: fireSupport.length };
        }

        let readyCount = 0;
        for (const unit of fireSupport) {
            const inFireBase = Math.hypot(unit.x - objectives.support.x, unit.y - objectives.support.y) < 260;
            const hasShot = visibleEnemies.some(enemy => {
                const distance = Math.hypot(unit.x - enemy.x, unit.y - enemy.y);
                const line = unit.type === T.ARTILLERY ||
                    checkLineOfSight(unit.x, unit.y, enemy.x, enemy.y, unit, enemy);
                return line && distance <= unit.range * 1.08;
            });
            if (hasShot || inFireBase) readyCount++;
        }

        const ratio = readyCount / Math.max(1, fireSupport.length);
        return {
            ready: ratio >= 0.55 || readyCount >= Math.min(2, fireSupport.length),
            ratio,
            readyCount,
            total: fireSupport.length
        };
    }

    fireBaseHoldPoint(unit, objectives, combatTarget = null) {
        const target = combatTarget || objectives.target;
        const dx = target.x - objectives.support.x;
        const dy = target.y - objectives.support.y;
        const length = Math.max(1, Math.hypot(dx, dy));
        const back = unit.squad === SQUAD.FLANK ? 300 : 380;
        const side = unit.squad === SQUAD.FLANK
            ? (unit.id % 2 === 0 ? 1 : -1) * 170
            : (unit.id % 5 - 2) * 55;
        return {
            x: Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS,
                target.x - dx / length * back + (-dy / length) * side)),
            y: Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS,
                target.y - dy / length * back + (dx / length) * side))
        };
    }

    update(now) {
        if (now - this.lastUpdate < 100) return;
        this.lastUpdate = now;
        const ownUnits = units.filter(unit => unit.isRed === this.side && !unit.dead);
        if (ownUnits.length === 0) return;
        const enemyUnits = units.filter(unit => unit.isRed !== this.side && !unit.dead);
        const visibleEnemies = enemyUnits.filter(unit => canSee(this.side, unit.x, unit.y));

        this.world.update(now, visibleEnemies);
        const center = ownUnits.reduce((acc, unit) => ({ x: acc.x + unit.x, y: acc.y + unit.y }), { x: 0, y: 0 });
        center.x /= ownUnits.length;
        center.y /= ownUnits.length;
        const totalHp = ownUnits.reduce((sum, unit) => sum + unit.hp, 0);
        const totalMaxHp = ownUnits.reduce((sum, unit) => sum + unit.maxHp, 0);
        const armorCount = ownUnits.filter(unit => [T.ARMOR, T.MECH_INFANTRY, T.ARMOR_INFANTRY].includes(unit.type)).length;
        const supportCount = ownUnits.filter(unit => [T.ARTILLERY, T.MEDIC, T.ENGINEER, T.ANTI_TANK].includes(unit.type)).length;
        const combatAnalysis = TacticalAI.analyzeBattle(ownUnits, visibleEnemies);
        const visibleArmor = visibleEnemies.filter(unit =>
            [T.ARMOR, T.MECH_INFANTRY, T.ARMOR_INFANTRY].includes(unit.type)
        );
        const enemyArmorPressure = visibleArmor.length / Math.max(1, visibleEnemies.length);
        const antiArmorReadyCount = ownUnits.filter(unit =>
            [T.ANTI_TANK, T.ARTILLERY, T.ARMOR].includes(unit.type) &&
            Math.hypot(unit.x - center.x, unit.y - center.y) < 780
        ).length;
        const antiArmorReady = antiArmorReadyCount >= Math.max(1, Math.ceil(visibleArmor.length * 0.45));
        const armorScreenThreat = visibleArmor.length >= 2 && enemyArmorPressure >= 0.45;
        const enemyInFields = visibleEnemies.filter(enemyUnit =>
            trenches.some(field => field.isRed !== this.side && Math.hypot(enemyUnit.x - field.x, enemyUnit.y - field.y) < field.r)
        ).length;
        const liveDamageEfficiency = this.telemetry
            ? this.telemetry.damageDealt / Math.max(1, this.telemetry.damageTaken)
            : 1;
        const liveValueTradeRatio = this.telemetry
            ? this.telemetry.aiValueLost / Math.max(1, this.telemetry.enemyValueDestroyed)
            : 0;
        const enemyRetreat = this.measureEnemyRetreat(now, visibleEnemies, center);
        const antiArtilleryStatus = this.antiArtilleryStatus(now, this.director.doctrine);
        const idlePressure = this.telemetry && this.telemetry.started
            ? this.telemetry.idleSeconds
            : 0;
        const compressionSeconds = this.telemetry && this.telemetry.started
            ? this.telemetry.compressionSeconds || 0
            : 0;
        const fireBaseWaitSeconds = this.telemetry && this.telemetry.started
            ? this.telemetry.fireBaseWaitSeconds || 0
            : 0;
        // Sabit (turtle) düşmanda boşta süre BEKLENİR — bu bir "başarısızlık" değil, kuşatma temposu.
        // O yüzden sabit düşmana karşı pressureFailure (charge zorlaması) tetiklenmez.
        const enemyStatic = !!enemyRetreat.static && visibleEnemies.length > 0;
        const pressureFailure = visibleEnemies.length > 0 &&
            !enemyStatic &&
            (idlePressure > 115 || compressionSeconds > 130) &&
            liveDamageEfficiency < 0.92;
        // ── İLERİYE-BAKIŞ DANIŞMANI ── ("şunu yaparsam ne olur?" → Schwerpunkt + posture)
        this.advisorPlan = (this.advisor && visibleEnemies.length > 0)
            ? this.advisor.decide(ownUnits, visibleEnemies, combatAnalysis, now, enemyStatic)
            : null;
        // ── BÖLGE HEDEFİ (PUNCH) ── lehte kavga yoksa, en ZAYIF savunulan kontrol noktasına yığ (turtle-kır).
        this.territoryTarget = this.pickTerritoryTarget(center, visibleEnemies);
        // ── FAZ 2: BÖLGE DURUŞU ── director'a tempo baskısı girdisi (geride isem zayıf noktayı zorla)
        let vpDeficit = 0, vpOwn = 0, vpEnemy = 0, vpOpen = 0;
        if (typeof SIM.controlPoints !== 'undefined' && SIM.controlPoints && SIM.controlPoints.length) {
            const mineOwner = this.side ? 'red' : 'blue';
            for (const p of SIM.controlPoints) {
                if (p.owner === mineOwner) vpOwn++; else if (p.owner) vpEnemy++; else vpOpen++;
            }
            if (typeof SIM.vpScore !== 'undefined' && SIM.vpScore) {
                const myS = this.side ? SIM.vpScore.red : SIM.vpScore.blue;
                const enS = this.side ? SIM.vpScore.blue : SIM.vpScore.red;
                vpDeficit = enS - myS;   // pozitif = bölgede GERİDEYİM (tempo zorlamalıyım)
            }
        }

        const state = {
            now,
            ownUnits,
            enemyUnits,
            advisor: this.advisorPlan,
            territoryTarget: this.territoryTarget,
            vpDeficit, vpOwn, vpEnemy, vpOpen,
            visibleEnemies: visibleEnemies.length,
            center,
            hpRatio: totalHp / Math.max(1, totalMaxHp),
            armorRatio: armorCount / ownUnits.length,
            supportRatio: supportCount / ownUnits.length,
            combat: combatAnalysis,
            enemyProfile: this.world.getOpponentProfile(visibleEnemies),
            recentContact: this.world.hasRecentContact(now),
            enemyInFields,
            damageEfficiency: liveDamageEfficiency,
            valueTradeRatio: liveValueTradeRatio,
            enemyRetreating: enemyRetreat.retreating,
            enemyRetreatScore: enemyRetreat.score,
            enemyRetreatVector: enemyRetreat.vector,
            enemyStatic,
            compressionMode: enemyRetreat.retreating,
            pressureFailure,
            armorScreenThreat,
            compressionSeconds,
            fireBaseWaitSeconds,
            antiArtilleryBlocked: antiArtilleryStatus.blocked,
            antiArtilleryCooldown: antiArtilleryStatus.cooldown,
            idlePressure
        };

        let doctrine = this.director.decide(now, state);
        if ((state.antiArtilleryBlocked || state.antiArtilleryCooldown) &&
            doctrine === AI_DOCTRINE.ANTI_ARTILLERY) {
            doctrine = state.enemyRetreating ? AI_DOCTRINE.ENCIRCLE : AI_DOCTRINE.SIEGE_BREAK;
            this.director.doctrine = doctrine;
        }
        // ── DANIŞMAN POSTURE OVERRIDE ── ileriye-bakış "bu kavga kazanılır/kaybedilir" diyorsa doktrini bük.
        // Temizlik/son-av (kazanıyoruz) modlarına dokunma; sadece yeterli güvende müdahale et.
        const adv = this.advisorPlan;
        if (adv && adv.confidence >= 0.22 &&
            doctrine !== AI_DOCTRINE.CLEANUP && doctrine !== AI_DOCTRINE.LAST_HUNT &&
            doctrine !== AI_DOCTRINE.HUNT) {
            if (adv.posture === ADVISOR_POSTURE.WITHDRAW) {
                doctrine = AI_DOCTRINE.REGROUP;        // matematik aleyhte → tek kütle çekil/topla
                this.director.doctrine = doctrine;
            } else if (adv.posture === ADVISOR_POSTURE.SIEGE) {
                doctrine = AI_DOCTRINE.ADVANCE;        // kuşatma: charge yok, topçu menzilde döver (siegeHold)
                this.director.doctrine = doctrine;
            } else if (adv.posture === ADVISOR_POSTURE.COMMIT &&
                (doctrine === AI_DOCTRINE.ATTRITION || doctrine === AI_DOCTRINE.REGROUP)) {
                doctrine = AI_DOCTRINE.ADVANCE;        // matematik lehte → bekleme, yığ ve gir (eridi → ölçülü ilerleme)
                this.director.doctrine = doctrine;
            } else if (adv.posture === ADVISOR_POSTURE.HOLD && doctrine === AI_DOCTRINE.ADVANCE) {
                doctrine = AI_DOCTRINE.ATTRITION;      // şimdi girme, ateş hattı kur, düşmanı menzile çek
                this.director.doctrine = doctrine;
            }
        }
        if (this.telemetry) {
            this.telemetry.recordDoctrine(doctrine, now);
            const reconUnits = ownUnits.filter(unit => unit.type === T.RECON);
            for (const scout of reconUnits) {
                for (const target of visibleEnemies) {
                    if (![T.ARTILLERY, T.MEDIC, T.ENGINEER].includes(target.type)) continue;
                    if (Math.hypot(scout.x - target.x, scout.y - target.y) <= scout.vision) {
                        this.telemetry.recordScoutSpot(scout, target);
                    }
                }
            }
        }
        const cleanupMode = doctrine === AI_DOCTRINE.CLEANUP || doctrine === AI_DOCTRINE.LAST_HUNT;
        const lastHuntMode = doctrine === AI_DOCTRINE.LAST_HUNT;
        const antiArtilleryMode = doctrine === AI_DOCTRINE.ANTI_ARTILLERY &&
            !state.antiArtilleryBlocked && !state.antiArtilleryCooldown;
        const siegeBreakMode = doctrine === AI_DOCTRINE.SIEGE_BREAK;
        const compressionMode = state.compressionMode && !cleanupMode && !lastHuntMode;
        const modifiers = this.director.modifiers();
        this.planner.assign(ownUnits, aiGenome.tacticGenes);
        const objectives = this.planner.getObjectives(state, doctrine, modifiers, this.world);
        this.planner.formation = this.selectFormation(state, doctrine);   // durumsal diziliş
        this.manageReserve(ownUnits, state, doctrine);                    // ana kuvvet + yedek
        const envelopment = this.chooseEnvelopment(state, doctrine, ownUnits, visibleEnemies, combatAnalysis);  // pin + flank manevrası
        const fortifyMode = (doctrine === AI_DOCTRINE.ATTRITION || doctrine === AI_DOCTRINE.REGROUP) &&
            trenches.some(f => f.isRed === this.side);   // savunmada siperden döv (+6 zırh)
        const supportReadiness = this.measureSupportReadiness(ownUnits, visibleEnemies, objectives);
        // ── KUŞATMA TUTUŞU ── düşman sabit ve danışman henüz COMMIT demiyorsa: charge yok, ateş üssünden döv.
        // Danışman SIEGE veya (düşman sabit & COMMIT değil) → topçu menzilde bombalar, ekran geride bekler.
        const advisorCommit = this.advisorPlan && this.advisorPlan.posture === ADVISOR_POSTURE.COMMIT;
        const siegeHold = !cleanupMode && !lastHuntMode && !antiArtilleryMode &&
            ((this.advisorPlan && this.advisorPlan.posture === ADVISOR_POSTURE.SIEGE) ||
             (state.enemyStatic && !advisorCommit));
        // Sabit düşmanda ateş üssü TERK EDİLMEZ (charge'a kaçma yok); sadece danışman COMMIT derse bırakılır.
        const fireBaseOverdue = (state.fireBaseWaitSeconds > 34 || state.pressureFailure) && !siegeHold;
        const prepareFireBase = visibleEnemies.length > 0 &&
            !cleanupMode &&
            !lastHuntMode &&
            !antiArtilleryMode &&
            !fireBaseOverdue &&
            (siegeHold || (!supportReadiness.ready && combatAnalysis.forceRatio < 1.55));
        if (this.telemetry) {
            this.telemetry.recordOperationalSignals?.({
                compressionMode: state.compressionMode,
                fireBaseWait: prepareFireBase,
                pressureBreak: state.pressureFailure,
                antiArtilleryBlocked: state.antiArtilleryBlocked || state.antiArtilleryCooldown
            }, now);
        }
        this.manageEngineerFields(ownUnits, objectives, now);

        // ── BİRLEŞİK SİLAH TASMASI ──
        // Piyade, ateş desteğini (tanksavar/topçu) çok geride bırakıp tek başına dalmasın.
        // Cephe desteğin temposunda topluca ilerlesin → parça parça saldırı + desteksiz tank dalışı önlenir.
        // Çapa yalnızca tanksavar (saldırı ekranı). Topçu max menzilden atar ve çok yavaştır (0.27);
        // onu çapaya katmak cepheyi sürünen topçuyu beklerken boşta bırakıyordu.
        const fireSupportUnits = ownUnits.filter(u =>
            !u.dead && u.type === T.ANTI_TANK && u.ammo > 0);
        let assaultAnchor = null;
        if (fireSupportUnits.length) {
            let ax = 0, ay = 0;
            for (const u of fireSupportUnits) { ax += u.x; ay += u.y; }
            assaultAnchor = { x: ax / fireSupportUnits.length, y: ay / fireSupportUnits.length };
        }
        const SUPPORT_LEASH = 300;   // piyade desteğin en fazla bu kadar önüne geçebilir
        // Çok beklediyse ya da ezici üstünlük varsa tasmayı bırak (sonsuz bekleme = idle olmasın)
        const leashRelease = state.fireBaseWaitSeconds > 30 || combatAnalysis.forceRatio > 1.6;

        this.arbiter.beginCycle();
        const focusTarget = this.pickFocusTarget(visibleEnemies, doctrine, state);
        if (this.side === true) aiFocusTarget = focusTarget;

        let vanguardIndex = 0;
        let flankIndex = 0;
        let supportIndex = 0;
        // ── FAZ 3: PIN ── güçlü düşman kütlesi varsa topçu sabit menzilden onu döver (ateşi çeker),
        // ana kuvvet (PUNCH) zayıf noktaya yığılır → düşman ateşi bölünür (eşit orduda yerel üstünlük).
        const advWithdraw = this.advisorPlan && this.advisorPlan.posture === ADVISOR_POSTURE.WITHDRAW;
        const pinMode = visibleEnemies.length >= 3 && !cleanupMode && !lastHuntMode && !advWithdraw;
        const enemyMass = this.world.getEstimatedCenter();
        for (const unit of ownUnits) {
            const combatTarget = this.pickUnitTarget(unit, visibleEnemies, focusTarget, state);
            const scoutAgainstArmor = !cleanupMode && unit.type === T.RECON && armorScreenThreat && combatTarget;
            const unitIsAntiArmor = [T.ANTI_TANK, T.ARTILLERY, T.ARMOR].includes(unit.type);
            const holdForCounters = !cleanupMode && armorScreenThreat &&
                unit.squad !== SQUAD.FLANK && !unitIsAntiArmor &&
                ![T.MEDIC, T.ENGINEER].includes(unit.type);
            const artilleryTarget = antiArtilleryMode
                ? visibleEnemies.find(enemy => enemy.type === T.ARTILLERY) || combatTarget
                : null;
            // Tasma: bu piyade desteğin çok mu önüne geçti?
            let leashAhead = -Infinity;
            if (assaultAnchor && combatTarget) {
                const ldx = combatTarget.x - assaultAnchor.x, ldy = combatTarget.y - assaultAnchor.y;
                const llen = Math.max(1, Math.hypot(ldx, ldy));
                leashAhead = ((unit.x - assaultAnchor.x) * ldx + (unit.y - assaultAnchor.y) * ldy) / llen;
            }
            const outranSupport = !leashRelease && !cleanupMode && !lastHuntMode && !antiArtilleryMode &&
                unit.squad === SQUAD.VANGUARD &&
                [T.INFANTRY, T.MECH_INFANTRY, T.ARMOR_INFANTRY].includes(unit.type) &&
                combatTarget && leashAhead > SUPPORT_LEASH;
            // EXPERT MİKRO — KUVVET KORUMA (hysteresis): yaralıyı medic'e çek, iyileşince geri dön.
            const preserveMedic = this.nearestLivingMedic(ownUnits, unit);
            const hpR = unit.hp / Math.max(1, unit.maxHp);
            if (unit.preserving) {
                if (hpR > 0.6 || !preserveMedic || combatAnalysis.forceRatio > 1.3 || unit.isFleeing) unit.preserving = false;
            } else if (!unit.isFleeing && preserveMedic && hpR < 0.32 && combatAnalysis.forceRatio < 1.2 &&
                !cleanupMode && !lastHuntMode &&
                [T.INFANTRY, T.MECH_INFANTRY, T.ARMOR_INFANTRY, T.ANTI_TANK].includes(unit.type)) {
                unit.preserving = true;
            }
            let decisionState = TacticalAI.DecisionSystems.decideUnitState(unit, {
                forceRatio: combatAnalysis.forceRatio,
                target: combatTarget,
                genes: aiGenome.tacticGenes
            });
            if (cleanupMode && combatTarget && unit.type !== T.MEDIC) {
                decisionState = TacticalAI.UNIT_DECISION_STATE.EXECUTE;
            }
            unit.aiDecisionState = decisionState;

            if (unit.isFleeing) {
                const flee = unit.fleeTarget || { x: WORLD_W / 2, y: 180 };
                this.arbiter.issue(unit, { ...flee, action: 'FLEE', priority: AI_COMMAND_PRIORITY.SURVIVAL, createdAt: now });
            }

            const supplyField = this.pickSupplyField(unit);
            if (unit.type !== T.MEDIC && supplyField &&
                (cleanupMode
                    ? unit.ammo <= 0
                    : decisionState === TacticalAI.UNIT_DECISION_STATE.RESUPPLY ||
                        unit.ammo <= Math.max(1, unit.maxAmmo * 0.15) || unit.aiAction === 'RESUPPLY')) {
                const supplied = unit.ammo >= unit.maxAmmo * 0.8;
                if (!supplied) {
                    this.arbiter.issue(unit, {
                        x: supplyField.x,
                        y: supplyField.y,
                        action: 'RESUPPLY',
                        priority: AI_COMMAND_PRIORITY.LOGISTICS,
                        createdAt: now
                    });
                } else if (unit.aiAction === 'RESUPPLY') {
                    unit.aiAction = 'ATTACK';
                }
            }

            const scoutSpotTarget = unit.type === T.RECON && visibleEnemies.length > 0
                ? this.pickScoutSpotTarget(unit, visibleEnemies) || combatTarget
                : null;
            if (unit.preserving && preserveMedic) {
                // Yaralı: dövüşü bırak, medic'e çekil, iyileş, geri dön (kuvvet koruma).
                this.arbiter.issue(unit, {
                    x: preserveMedic.x, y: preserveMedic.y,
                    action: 'PRESERVE',
                    priority: AI_COMMAND_PRIORITY.SURVIVAL,
                    createdAt: now
                });
                unit.attackTarget = null;
            } else if (pinMode && unit.type === T.ARTILLERY && combatTarget) {
                // PIN: topçu, güçlü düşman kütlesini sabit bombardıman menzilinden döver (ateşi kendine çeker).
                const d = Math.max(1, Math.hypot(unit.x - enemyMass.x, unit.y - enemyMass.y));
                const stand = unit.range * 0.9;
                const inRange = Math.hypot(combatTarget.x - unit.x, combatTarget.y - unit.y) <= unit.range;
                this.arbiter.issue(unit, {
                    x: inRange ? unit.x : Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS, enemyMass.x + (unit.x - enemyMass.x) / d * stand)),
                    y: inRange ? unit.y : Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS, enemyMass.y + (unit.y - enemyMass.y) / d * stand)),
                    targetUnit: inRange ? combatTarget : null,
                    action: 'PIN_BOMBARD',
                    priority: AI_COMMAND_PRIORITY.COMBAT,
                    createdAt: now
                });
                if (!inRange) unit.attackTarget = null;
            } else if (scoutSpotTarget && !cleanupMode && !lastHuntMode) {
                const distance = Math.max(1, Math.hypot(unit.x - scoutSpotTarget.x, unit.y - scoutSpotTarget.y));
                const observeDistance = Math.min(unit.vision * 0.78, Math.max(520, scoutSpotTarget.range + 260));
                this.arbiter.issue(unit, {
                    x: scoutSpotTarget.x + (unit.x - scoutSpotTarget.x) / distance * observeDistance,
                    y: scoutSpotTarget.y + (unit.y - scoutSpotTarget.y) / distance * observeDistance,
                    targetUnit: null,
                    action: 'RECON_OBSERVE',
                    priority: AI_COMMAND_PRIORITY.COMBAT,
                    createdAt: now
                });
                unit.attackTarget = null;
            } else if (holdForCounters && combatTarget &&
                [T.INFANTRY, T.ARMOR_INFANTRY, T.MECH_INFANTRY].includes(unit.type)) {
                const hold = this.fireBaseHoldPoint(unit, objectives, combatTarget);
                this.arbiter.issue(unit, {
                    x: hold.x,
                    y: hold.y,
                    targetUnit: null,
                    action: 'WAIT_AT_GUNS',
                    priority: AI_COMMAND_PRIORITY.COMBAT,
                    createdAt: now
                });
                unit.attackTarget = null;
            } else {
            const antiTankArmorTarget = unit.type === T.ANTI_TANK
                ? visibleEnemies
                    .filter(enemy => [T.ARMOR, T.MECH_INFANTRY, T.ARMOR_INFANTRY].includes(enemy.type))
                    .sort((a, b) => {
                        // Önce gerçek tankları (ARMOR), sonra en yakını hedefle
                        const ta = a.type === T.ARMOR ? 0 : 1;
                        const tb = b.type === T.ARMOR ? 0 : 1;
                        if (ta !== tb) return ta - tb;
                        return Math.hypot(a.x - unit.x, a.y - unit.y) - Math.hypot(b.x - unit.x, b.y - unit.y);
                    })[0]
                : null;
            if (antiTankArmorTarget && !cleanupMode) {
                const distance = Math.max(1, Math.hypot(antiTankArmorTarget.x - unit.x, antiTankArmorTarget.y - unit.y));
                const hasFireLine = checkLineOfSight(unit.x, unit.y, antiTankArmorTarget.x, antiTankArmorTarget.y, unit, antiTankArmorTarget);
                // Tanksavar tankın menzili (275) DIŞINDA ama kendi menzili (320) İÇİNDE dövüşmeli → tankı kite'la
                const standoff = unit.range * 0.92;        // ~294: tank menzilinin dışı
                const canFireSafely = hasFireLine && distance <= unit.range && distance >= unit.range * 0.86;
                const dirX = (unit.x - antiTankArmorTarget.x) / distance;
                const dirY = (unit.y - antiTankArmorTarget.y) / distance;
                const holdX = Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS, antiTankArmorTarget.x + dirX * standoff));
                const holdY = Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS, antiTankArmorTarget.y + dirY * standoff));
                this.arbiter.issue(unit, {
                    x: canFireSafely ? unit.x : holdX,
                    y: canFireSafely ? unit.y : holdY,
                    targetUnit: antiTankArmorTarget,   // hedefi koru: menzile girince ateş etsin
                    action: canFireSafely ? 'PROTECTED_AT_FIRE' : 'PROTECTED_AT_KITE',
                    priority: AI_COMMAND_PRIORITY.LOGISTICS,
                    createdAt: now
                });
            } else if (prepareFireBase && combatTarget &&
                [T.ARTILLERY, T.ANTI_TANK].includes(unit.type)) {
                const distance = Math.hypot(combatTarget.x - unit.x, combatTarget.y - unit.y);
                const hasFireLine = unit.type === T.ARTILLERY ||
                    checkLineOfSight(unit.x, unit.y, combatTarget.x, combatTarget.y, unit, combatTarget);
                const canFire = hasFireLine && distance <= unit.range;
                // Menzil dışındaysa: geriye park etme — bombardıman menziline (hedef−yön×menzil×0.9) yaklaş.
                // Sabit (turtle) düşmanı dışarıdan döver. Eskiden objectives.support çok geride kalıp topçu hiç ateş edemiyordu.
                const dd = Math.max(1, distance);
                const bombardX = Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS,
                    combatTarget.x + (unit.x - combatTarget.x) / dd * (unit.range * 0.9)));
                const bombardY = Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS,
                    combatTarget.y + (unit.y - combatTarget.y) / dd * (unit.range * 0.9)));
                this.arbiter.issue(unit, {
                    x: canFire ? unit.x : bombardX,
                    y: canFire ? unit.y : bombardY,
                    targetUnit: canFire ? combatTarget : null,
                    action: canFire ? 'FIRE_BASE_READY' : 'FIRE_BASE_SETUP',
                    priority: AI_COMMAND_PRIORITY.COMBAT,
                    createdAt: now
                });
                if (!canFire) unit.attackTarget = null;
            } else if (prepareFireBase && combatTarget &&
                ![T.RECON, T.MEDIC, T.ENGINEER].includes(unit.type)) {
                const distance = Math.hypot(combatTarget.x - unit.x, combatTarget.y - unit.y);
                const hasFireLine = checkLineOfSight(unit.x, unit.y, combatTarget.x, combatTarget.y, unit, combatTarget);
                const safeFire = hasFireLine && distance <= unit.range && distance > unit.range * 0.55;
                const hold = this.fireBaseHoldPoint(unit, objectives, combatTarget);
                this.arbiter.issue(unit, {
                    x: safeFire ? unit.x : hold.x,
                    y: safeFire ? unit.y : hold.y,
                    targetUnit: safeFire ? combatTarget : null,
                    action: safeFire ? 'SCREEN_FIRE_BASE' : 'WAIT_FIRE_BASE',
                    priority: AI_COMMAND_PRIORITY.COMBAT,
                    createdAt: now
                });
                if (!safeFire) unit.attackTarget = null;
            } else if (compressionMode && combatTarget && unit.squad === SQUAD.FLANK &&
                ![T.ARTILLERY, T.ANTI_TANK, T.MEDIC, T.ENGINEER].includes(unit.type)) {
                const cut = unit.id % 2 === 0 ? objectives.flankLeft : objectives.flankRight;
                const raidTarget = state.pressureFailure
                    ? this.pickBacklineRaidTarget(unit, visibleEnemies) || (
                        focusTarget && [T.ARTILLERY, T.MEDIC, T.ENGINEER, T.ANTI_TANK].includes(focusTarget.type)
                            ? focusTarget
                            : null
                    )
                    : null;
                this.arbiter.issue(unit, {
                    x: raidTarget ? raidTarget.x : cut.x,
                    y: raidTarget ? raidTarget.y : cut.y,
                    targetUnit: raidTarget || combatTarget,
                    action: raidTarget ? 'BACKLINE_RAID' : 'COMPRESS_CUT',
                    priority: raidTarget ? AI_COMMAND_PRIORITY.LOGISTICS : AI_COMMAND_PRIORITY.COMBAT,
                    createdAt: now
                });
            } else if (envelopment.active && !cleanupMode && !lastHuntMode && !antiArtilleryMode &&
                unit.squad === SQUAD.FLANK &&
                [T.INFANTRY, T.MECH_INFANTRY, T.RECON, T.ARMOR_INFANTRY].includes(unit.type)) {
                // GERÇEK MANEVRA: kanat birliği geniş yandan dolanıp düşman ARKA hattına iner (pin+flank).
                const E = envelopment.enemyCenter, sp = envelopment.perp;
                const sideProg = (unit.x - E.x) * sp.x + (unit.y - E.y) * sp.y;
                let wx, wy, tgt = null;
                if (sideProg < envelopment.wide * 0.7) {
                    // hâlâ yana açılıyor → düşmanın önüne girme, geniş yürü
                    wx = E.x + sp.x * envelopment.wide - (this.planner.dirX || 0) * 40;
                    wy = E.y + sp.y * envelopment.wide - (this.planner.dirY || 0) * 40;
                } else {
                    // yeterince yanda → arka hatta dal (topçu/AT/medic avı)
                    const deepFoe = this.pickBacklineRaidTarget(unit, visibleEnemies);
                    if (deepFoe) { wx = deepFoe.x; wy = deepFoe.y; tgt = deepFoe; }
                    else {
                        wx = E.x + (this.planner.dirX || 0) * envelopment.deep + sp.x * envelopment.wide * 0.5;
                        wy = E.y + (this.planner.dirY || 0) * envelopment.deep + sp.y * envelopment.wide * 0.5;
                    }
                }
                wx = Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS, wx));
                wy = Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS, wy));
                this.arbiter.issue(unit, {
                    x: wx, y: wy,
                    targetUnit: tgt,
                    action: 'ENVELOP',
                    priority: AI_COMMAND_PRIORITY.COMBAT,
                    createdAt: now
                });
                if (!tgt) unit.attackTarget = null;
            } else if (compressionMode && combatTarget && unit.squad === SQUAD.VANGUARD &&
                ![T.ARTILLERY, T.ANTI_TANK].includes(unit.type)) {
                const distance = Math.hypot(combatTarget.x - unit.x, combatTarget.y - unit.y);
                const canFire = distance <= unit.range &&
                    checkLineOfSight(unit.x, unit.y, combatTarget.x, combatTarget.y, unit, combatTarget);
                this.arbiter.issue(unit, {
                    x: canFire ? unit.x : combatTarget.x,
                    y: canFire ? unit.y : combatTarget.y,
                    targetUnit: combatTarget,
                    action: canFire ? 'PRESSURE_FIRE' : 'PRESSURE_CLOSE',
                    priority: AI_COMMAND_PRIORITY.COMBAT,
                    createdAt: now
                });
            } else if (lastHuntMode && combatTarget && [T.RECON, T.MECH_INFANTRY, T.ARMOR].includes(unit.type)) {
                this.arbiter.issue(unit, {
                    x: combatTarget.x,
                    y: combatTarget.y,
                    targetUnit: combatTarget,
                    action: 'LAST_HUNT_CHASE',
                    priority: AI_COMMAND_PRIORITY.COMBAT,
                    createdAt: now
                });
            } else if (lastHuntMode && combatTarget) {
                const distance = Math.max(1, Math.hypot(combatTarget.x - center.x, combatTarget.y - center.y));
                const ix = combatTarget.x - (combatTarget.x - center.x) / distance * Math.min(unit.range + 80, 360);
                const iy = combatTarget.y - (combatTarget.y - center.y) / distance * Math.min(unit.range + 80, 360);
                this.arbiter.issue(unit, {
                    x: ix,
                    y: iy,
                    targetUnit: unit.type === T.ARTILLERY || unit.type === T.ANTI_TANK ? combatTarget : null,
                    action: 'LAST_HUNT_CUT',
                    priority: AI_COMMAND_PRIORITY.COMBAT,
                    createdAt: now
                });
            } else if (antiArtilleryMode && artilleryTarget && unit.type === T.RECON) {
                const distance = Math.max(1, Math.hypot(unit.x - artilleryTarget.x, unit.y - artilleryTarget.y));
                const observeDistance = Math.min(unit.vision * 0.72, Math.max(460, artilleryTarget.range + 180));
                this.arbiter.issue(unit, {
                    x: artilleryTarget.x + (unit.x - artilleryTarget.x) / distance * observeDistance,
                    y: artilleryTarget.y + (unit.y - artilleryTarget.y) / distance * observeDistance,
                    action: 'SPOT_ARTILLERY',
                    priority: AI_COMMAND_PRIORITY.COMBAT,
                    createdAt: now
                });
                unit.attackTarget = null;
            } else if (antiArtilleryMode && artilleryTarget && [T.RECON, T.MECH_INFANTRY].includes(unit.type)) {
                const side = unit.id % 2 === 0 ? 1 : -1;
                const dx = artilleryTarget.x - center.x;
                const dy = artilleryTarget.y - center.y;
                const length = Math.max(1, Math.hypot(dx, dy));
                this.arbiter.issue(unit, {
                    x: artilleryTarget.x + (-dy / length) * side * 240,
                    y: artilleryTarget.y + (dx / length) * side * 240,
                    targetUnit: artilleryTarget,
                    action: 'FLANK_ARTILLERY',
                    priority: AI_COMMAND_PRIORITY.COMBAT,
                    createdAt: now
                });
            } else if (siegeBreakMode && !state.pressureFailure && combatTarget && ![T.ARTILLERY, T.ANTI_TANK, T.ARMOR].includes(unit.type)) {
                this.arbiter.issue(unit, {
                    x: objectives.vanguard.x,
                    y: objectives.vanguard.y,
                    action: 'SIEGE_HOLD',
                    priority: AI_COMMAND_PRIORITY.COMBAT,
                    createdAt: now
                });
                unit.attackTarget = null;
            } else if (scoutAgainstArmor) {
                const distance = Math.max(1, Math.hypot(unit.x - combatTarget.x, unit.y - combatTarget.y));
                const awayX = (unit.x - combatTarget.x) / distance;
                const awayY = (unit.y - combatTarget.y) / distance;
                const observeDistance = Math.min(unit.vision * 0.78, Math.max(420, combatTarget.range + 230));
                this.arbiter.issue(unit, {
                    x: combatTarget.x + awayX * observeDistance,
                    y: combatTarget.y + awayY * observeDistance,
                    action: 'SCOUT_ARMOR',
                    priority: AI_COMMAND_PRIORITY.COMBAT,
                    createdAt: now
                });
                unit.attackTarget = null;
            } else if (holdForCounters && combatTarget) {
                this.arbiter.issue(unit, {
                    x: objectives.support.x,
                    y: objectives.support.y,
                    action: 'WAIT_COUNTERS',
                    priority: AI_COMMAND_PRIORITY.COMBAT,
                    createdAt: now
                });
                unit.attackTarget = null;
            } else if (outranSupport) {
                // Destek geride kaldı: ilerleme, yerinde bekleyip menzildeysen ateş et (cephe toplansın).
                const distance = Math.hypot(combatTarget.x - unit.x, combatTarget.y - unit.y);
                const canFire = distance <= unit.range &&
                    checkLineOfSight(unit.x, unit.y, combatTarget.x, combatTarget.y, unit, combatTarget);
                this.arbiter.issue(unit, {
                    x: unit.x,
                    y: unit.y,
                    targetUnit: canFire ? combatTarget : null,
                    action: 'WAIT_SUPPORT',
                    priority: AI_COMMAND_PRIORITY.COMBAT,
                    createdAt: now
                });
                if (!canFire) unit.attackTarget = null;
            } else if (combatTarget) {
                const distance = Math.hypot(combatTarget.x - unit.x, combatTarget.y - unit.y);
                const hasFireLine = unit.type === T.ARTILLERY ||
                    checkLineOfSight(unit.x, unit.y, combatTarget.x, combatTarget.y, unit, combatTarget);
                const firingNow = hasFireLine && distance <= unit.range;
                const shouldExecute = decisionState === TacticalAI.UNIT_DECISION_STATE.EXECUTE;
                const shouldKite = !cleanupMode && decisionState === TacticalAI.UNIT_DECISION_STATE.KITE;
                // ── KUVVET EKONOMİSİ VETOSU (aşağıdan yukarı) ──
                // Yerel takas aleyhte ve henüz menzilde değilsem: düşman ateşine TEK BAŞIMA yürüme,
                // yerinde dur, cephe kütlesi büyüsün (yoğunlaşınca lehe döner → topluca gir). Menzildeysem kalıp döverim.
                const exch = (this.advisor && !cleanupMode && !lastHuntMode && !unit.isReserve)
                    ? this.advisor.localExchange(unit, ownUnits, visibleEnemies)
                    : null;
                const massWait = exch && exch.hasFoes && !exch.favorable && !shouldExecute && !firingNow;
                if (massWait) {
                    // Boşa ateş yeme: beni vurabilen en yakın tehdidin menzili DIŞINA çekil, orada kütleyi bekle.
                    let waitX = unit.x, waitY = unit.y, nf = null, nd = Infinity;
                    for (const e of visibleEnemies) {
                        const d = Math.hypot(e.x - unit.x, e.y - unit.y);
                        if (d < nd) { nd = d; nf = e; }
                    }
                    if (nf) {
                        const safe = ((STATS[nf.type] && STATS[nf.type].range) || 0) + 50;
                        if (nd < safe) {
                            const ax = (unit.x - nf.x) / Math.max(1, nd);
                            const ay = (unit.y - nf.y) / Math.max(1, nd);
                            waitX = Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS, nf.x + ax * safe));
                            waitY = Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS, nf.y + ay * safe));
                        }
                    }
                    this.arbiter.issue(unit, {
                        x: waitX, y: waitY,
                        targetUnit: null,
                        action: 'MASS_WAIT',
                        priority: AI_COMMAND_PRIORITY.COMBAT,
                        createdAt: now
                    });
                    unit.attackTarget = null;
                } else {
                    let commandX = firingNow && !shouldExecute ? unit.x : combatTarget.x;
                    let commandY = firingNow && !shouldExecute ? unit.y : combatTarget.y;
                    if (shouldKite && distance > 1) {
                        const awayX = (unit.x - combatTarget.x) / distance;
                        const awayY = (unit.y - combatTarget.y) / distance;
                        commandX = unit.x + awayX * unit.range * 0.45;
                        commandY = unit.y + awayY * unit.range * 0.45;
                    }
                    this.arbiter.issue(unit, {
                        // Ateş hattı açıksa hareket emri verme; kapalıysa navigator dağı dolaştırır.
                        x: commandX,
                        y: commandY,
                        targetUnit: combatTarget,
                        action: shouldExecute ? 'EXECUTE' : shouldKite ? 'KITE' : 'ATTACK',
                        priority: AI_COMMAND_PRIORITY.COMBAT,
                        createdAt: now
                    });
                }
            }
            }

            const roleIndex = unit.squad === SQUAD.FLANK
                ? flankIndex++
                : unit.squad === SQUAD.SUPPORT
                    ? supportIndex++
                    : vanguardIndex++;
            let rawSlot = this.planner.slotFor(unit, roleIndex, objectives, modifiers);
            if (fortifyMode && !unit.isReserve &&
                [T.INFANTRY, T.ARMOR_INFANTRY, T.ANTI_TANK].includes(unit.type)) {
                const trench = this.nearestFriendlyTrench(unit);
                if (trench && Math.hypot(trench.x - unit.x, trench.y - unit.y) < 620) {
                    const ang = roleIndex * 1.3;
                    const rad = Math.min((trench.r || 80) * 0.6, 36 + roleIndex * 12);
                    rawSlot = { x: trench.x + Math.cos(ang) * rad, y: trench.y + Math.sin(ang) * rad }; // siperden döv
                }
            }
            const slot = TacticalAI.SteeringBehaviors.steerPoint(unit, rawSlot, ownUnits, visibleEnemies, {
                separationRadius: doctrine === AI_DOCTRINE.BREAKTHROUGH ? 76 : 98,
                separationWeight: (lastHuntMode ? 52 : cleanupMode ? 70 : doctrine === AI_DOCTRINE.BREAKTHROUGH ? 90 : 145) *
                    (aiGenome.tacticGenes.steeringSeparation ?? 1),
                threatWeight: (lastHuntMode ? 10 : cleanupMode ? 18 : siegeBreakMode ? 105 : doctrine === AI_DOCTRINE.LAST_STAND ? 25 : 85) *
                    (aiGenome.tacticGenes.threatAvoidance ?? 1),
                terrainWeight: 280,
                maxStep: lastHuntMode ? 280 : cleanupMode ? 240 : doctrine === AI_DOCTRINE.HUNT ? 220 : 170
            });
            const priority = doctrine === AI_DOCTRINE.HUNT ? AI_COMMAND_PRIORITY.SEARCH : AI_COMMAND_PRIORITY.SQUAD;
            this.arbiter.issue(unit, {
                ...slot,
                action: doctrine === AI_DOCTRINE.HUNT ? 'SEARCH' : doctrine.toUpperCase(),
                priority,
                createdAt: now
            });
            this.arbiter.apply(unit, this.navigator, now);
        }

        battlePhase = doctrine === AI_DOCTRINE.ENCIRCLE ? 3 :
            doctrine === AI_DOCTRINE.REGROUP ? 4 :
                (doctrine === AI_DOCTRINE.LAST_STAND || doctrine === AI_DOCTRINE.CLEANUP || doctrine === AI_DOCTRINE.LAST_HUNT) ? 5 :
                    doctrine === AI_DOCTRINE.ANTI_ARTILLERY ? 3 :
                        doctrine === AI_DOCTRINE.SIEGE_BREAK ? 2 : 1;
        this.adaptDuringMatch(now, doctrine);
    }

    // Durumsal formasyon: AI bağlama göre dizilişe kendi karar verir.
    selectFormation(state, doctrine) {
        const fr = state.combat?.forceRatio ?? 1;
        // Yarma/üstünlük → mızrak ucu (yoğunlaş); savunma/azlık/zırh tehdidi → geniş hat; aksi → esnek
        if (doctrine === AI_DOCTRINE.BREAKTHROUGH || doctrine === AI_DOCTRINE.SIEGE_BREAK || fr > 1.4) return 'wedge';
        if (doctrine === AI_DOCTRINE.ATTRITION || doctrine === AI_DOCTRINE.REGROUP || state.armorScreenThreat || fr < 0.8) return 'line';
        return 'flex';
    }

    // Ana kuvvet + yedek: durumsal. Fırsat (üstünlük) ya da kriz (düşük HP) → yedeği sür; aksi → %30'u geride tut.
    manageReserve(ownUnits, state, doctrine) {
        for (const u of ownUnits) u.isReserve = false;
        const offensive = [AI_DOCTRINE.ADVANCE, AI_DOCTRINE.BREAKTHROUGH, AI_DOCTRINE.ENCIRCLE, AI_DOCTRINE.SIEGE_BREAK];
        if (!offensive.includes(doctrine)) return;
        const eligible = ownUnits.filter(u =>
            u.squad === SQUAD.VANGUARD && [T.INFANTRY, T.ARMOR_INFANTRY].includes(u.type));
        if (eligible.length < 4) return;
        const fr = state.combat?.forceRatio ?? 1;
        const winning = fr > 1.15;             // fırsat → yedeği şimdi sür (istismar)
        const crisis = state.hpRatio < 0.5;    // kriz → yedeği sür (gediği kapat / karşı saldırı)
        if (winning || crisis) return;         // commit: yedek yok, herkes ileri
        const count = Math.floor(eligible.length * 0.3);
        if (count <= 0) return;
        const enemyC = this.world.getEstimatedCenter();
        eligible.sort((a, b) =>
            Math.hypot(b.x - enemyC.x, b.y - enemyC.y) - Math.hypot(a.x - enemyC.x, a.y - enemyC.y));
        for (let i = 0; i < count; i++) eligible[i].isReserve = true;   // en geridekiler yedek
    }

    // GERÇEK MANEVRA: pin + flank. Açık kanadı seçer, kanat birliğini bu yönde kuşatmaya hazırlar.
    chooseEnvelopment(state, doctrine, ownUnits, visibleEnemies, combatAnalysis) {
        const offensive = [AI_DOCTRINE.ADVANCE, AI_DOCTRINE.BREAKTHROUGH, AI_DOCTRINE.ENCIRCLE].includes(doctrine);
        if (!offensive || visibleEnemies.length < 2) return { active: false };
        // DANIŞMAN MANEVRASI: ileriye-bakış varsa onun kararına uy — sadece ENVELOP dediğinde kuşat,
        // FRONTAL/FLANK dediğinde tüm ordu yoğun cepheden dövsün (kuşatma için kuvvet ayırma).
        const adv = this.advisorPlan;
        if (adv) {
            if (adv.posture !== ADVISOR_POSTURE.COMMIT || adv.maneuver !== ADVISOR_MANEUVER.ENVELOP) {
                return { active: false };
            }
        } else if (!combatAnalysis || combatAnalysis.forceRatio < 1.1) {
            // KONSANTRASYON İLKESİ (danışman yoksa yedek kural): yerel üstünlük yoksa kuşatma yok.
            return { active: false };
        }
        const flankers = ownUnits.filter(u => !u.dead && u.squad === SQUAD.FLANK &&
            [T.INFANTRY, T.MECH_INFANTRY, T.RECON, T.ARMOR_INFANTRY].includes(u.type));
        if (flankers.length < 2) return { active: false };
        const E = this.world.getEstimatedCenter();
        const dirX = this.planner.dirX || 0, dirY = this.planner.dirY || 0;
        const refP = { x: -dirY, y: dirX };
        let right = 0, left = 0;
        for (const e of visibleEnemies) {
            const s = (e.x - E.x) * refP.x + (e.y - E.y) * refP.y;
            if (s > 0) right++; else left++;
        }
        const sideSign = right <= left ? 1 : -1;   // daha BOŞ kanattan sar
        return {
            active: true,
            enemyCenter: E,
            perp: { x: refP.x * sideSign, y: refP.y * sideSign },
            wide: 260,
            deep: 200
        };
    }

    // PUNCH hedefi: zafer puanı için EN ZAYIF SAVUNULAN çekişilebilir noktaya yığ (turtle'ın zayıf omzuna vur).
    // Yakın + düşman savunması az + (düşmanınkini geri al / nötrü kap) önceliğiyle seç. punchFocus geni eğilimi ayarlar.
    pickTerritoryTarget(center, visibleEnemies) {
        if (typeof SIM.controlPoints === 'undefined' || !SIM.controlPoints || !SIM.controlPoints.length) return null;
        const mine = this.side ? 'red' : 'blue';
        const genes = aiGenome.tacticGenes;
        const punchFocus = (genes && genes.punchFocus) || 1.0;
        let best = null, bestScore = -Infinity;
        for (const p of SIM.controlPoints) {
            if (p.owner === mine && !p.contested) continue;          // zaten güvenle bizim → atla
            const d = Math.hypot(p.x - center.x, p.y - center.y);
            // Düşman savunma yoğunluğu (PUNCH: zayıf savunulanı seç)
            let enemyDef = 0;
            if (visibleEnemies) {
                for (const e of visibleEnemies) {
                    if (e.isRed === this.side || e.dead) continue;
                    if (Math.hypot(e.x - p.x, e.y - p.y) < p.r + 140) enemyDef += (STATS[e.type] && STATS[e.type].cost) || 50;
                }
            }
            let score = -d * 0.4 - enemyDef * 1.1 * punchFocus;      // yakın + ZAYIF savunulan
            if (p.owner && p.owner !== mine) score += 900;           // düşmanınkini geri al (puanı durdur)
            else if (!p.owner) score += 700;                         // nötrü kap
            if (p.contested) score += 250;                           // çekişmeyi pekiştir
            if (score > bestScore) { bestScore = score; best = p; }
        }
        return best ? { x: best.x, y: best.y } : null;
    }

    nearestFriendlyTrench(unit) {
        let best = null, bd = Infinity;
        for (const f of trenches) {
            if (f.isRed !== this.side) continue;
            const d = Math.hypot(f.x - unit.x, f.y - unit.y);
            if (d < bd) { bd = d; best = f; }
        }
        return best;
    }

    nearestLivingMedic(ownUnits, unit) {
        let best = null, bd = Infinity;
        for (const a of ownUnits) {
            if (a.dead || a.type !== T.MEDIC) continue;
            const d = Math.hypot(a.x - unit.x, a.y - unit.y);
            if (d < bd) { bd = d; best = a; }
        }
        return best;
    }

    pickSupplyField(unit) {
        let nearest = null;
        let bestDistance = Infinity;
        for (const field of trenches) {
            if (field.isRed !== unit.isRed || field.providesSupply === false) continue;
            const distance = Math.hypot(field.x - unit.x, field.y - unit.y);
            if (distance < bestDistance) {
                nearest = field;
                bestDistance = distance;
            }
        }
        return nearest;
    }

    manageEngineerFields(ownUnits, objectives, now) {
        if (now < 3500) return;
        if (trenches.filter(field => field.isRed === this.side).length >= 2) return;
        for (const engineer of ownUnits) {
            if (engineer.type !== T.ENGINEER || engineer.buildTrenchTarget || now - engineer.lastFieldBuiltAt < 14000) continue;
            const protectedByField = trenches.some(field =>
                field.isRed === this.side && Math.hypot(field.x - engineer.x, field.y - engineer.y) < 430
            );
            if (protectedByField) continue;
            const desired = this.planner.adjustForTerrain({
                x: engineer.x * 0.72 + objectives.support.x * 0.28,
                y: engineer.y * 0.72 + objectives.support.y * 0.28
            }, SQUAD.SUPPORT);
            engineer.buildTrenchTarget = {
                x: Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS, desired.x)),
                y: Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS, desired.y))
            };
            engineer.attackTarget = null;
        }
    }

    pickUnitTarget(unit, visibleEnemies, focusTarget, state = null) {
        const supportHunt = !!state?.pressureFailure;
        // SERT ODAK ATEŞ: ordu odak hedefi menzildeyse herkes ONU vurur → yoğunlaş, sil (Lanchester).
        // İstisna: tanksavar kendi doğal avını (zırh) vurmaya devam etsin.
        if (focusTarget && !focusTarget.dead && focusTarget.isRed !== unit.isRed && unit.type !== T.ANTI_TANK) {
            const fd = Math.hypot(focusTarget.x - unit.x, focusTarget.y - unit.y);
            const canHitFocus = fd <= unit.range * 1.25 &&
                (unit.type === T.ARTILLERY ||
                    checkLineOfSight(unit.x, unit.y, focusTarget.x, focusTarget.y, unit, focusTarget));
            if (canHitFocus) return focusTarget;
        }
        const result = TacticalAI.TargetScoring.bestTarget(unit, visibleEnemies, {
            genes: aiGenome.tacticGenes,
            focusTarget,
            focusFire: Math.max(0.45, aiGenome.tacticGenes.focusFire),
            armorPriority: aiGenome.tacticGenes.targetArmorPriority,
            supportPriority: supportHunt
                ? Math.max(2.2, aiGenome.tacticGenes.targetSupportPriority * 1.8)
                : aiGenome.tacticGenes.targetSupportPriority,
            supportHunt,
            lineOfSightFor: (attacker, enemy) => attacker.type === T.ARTILLERY ||
                checkLineOfSight(attacker.x, attacker.y, enemy.x, enemy.y, attacker, enemy)
        });
        if (unit.attackTarget && !unit.attackTarget.dead) {
            const keepCurrent = TacticalAI.TargetScoring.score(unit, unit.attackTarget, {
                genes: aiGenome.tacticGenes,
                focusTarget,
                focusFire: Math.max(0.45, aiGenome.tacticGenes.focusFire),
                armorPriority: aiGenome.tacticGenes.targetArmorPriority,
                supportPriority: supportHunt
                    ? Math.max(2.2, aiGenome.tacticGenes.targetSupportPriority * 1.8)
                    : aiGenome.tacticGenes.targetSupportPriority,
                supportHunt,
                lineOfSight: unit.type === T.ARTILLERY ||
                    checkLineOfSight(unit.x, unit.y, unit.attackTarget.x, unit.attackTarget.y, unit, unit.attackTarget)
            }) + 260;
            if (keepCurrent >= result.score) return unit.attackTarget;
        }
        return result.unit;
    }

    pickScoutSpotTarget(unit, visibleEnemies) {
        let best = null;
        let bestScore = -Infinity;
        for (const enemy of visibleEnemies) {
            const distance = Math.hypot(enemy.x - unit.x, enemy.y - unit.y);
            const typeScore = enemy.type === T.ARTILLERY ? 12000 :
                enemy.type === T.ARMOR ? 9800 :
                    enemy.type === T.ANTI_TANK ? 8600 :
                        enemy.type === T.MEDIC ? 7600 :
                            enemy.type === T.ENGINEER ? 6400 :
                                [T.MECH_INFANTRY, T.ARMOR_INFANTRY].includes(enemy.type) ? 5200 : 1800;
            const score = typeScore - distance * 1.6;
            if (score > bestScore) {
                bestScore = score;
                best = enemy;
            }
        }
        return best;
    }

    pickBacklineRaidTarget(unit, visibleEnemies) {
        let best = null;
        let bestScore = -Infinity;
        for (const enemy of visibleEnemies) {
            if (![T.ARTILLERY, T.MEDIC, T.ENGINEER, T.ANTI_TANK].includes(enemy.type)) continue;
            const distance = Math.hypot(enemy.x - unit.x, enemy.y - unit.y);
            const typeScore = enemy.type === T.ARTILLERY ? 12000 :
                enemy.type === T.MEDIC ? 9800 :
                    enemy.type === T.ENGINEER ? 8400 : 6600;
            const exposedBonus = enemy.hp / Math.max(1, enemy.maxHp) < 0.65 ? 1600 : 0;
            const lineBonus = unit.type === T.ARTILLERY ||
                checkLineOfSight(unit.x, unit.y, enemy.x, enemy.y, unit, enemy)
                ? 700
                : 0;
            const score = typeScore + exposedBonus + lineBonus - distance * 3.2;
            if (score > bestScore) {
                bestScore = score;
                best = enemy;
            }
        }
        return best;
    }

    pickFocusTarget(visibleEnemies, doctrine = null, state = null) {
        let best = null;
        let bestScore = -Infinity;
        const pressureFailure = !!state?.pressureFailure;
        const supportAlive = visibleEnemies.some(unit => [T.ARTILLERY, T.MEDIC, T.ENGINEER, T.ANTI_TANK].includes(unit.type));
        for (const unit of visibleEnemies) {
            let score = STATS[unit.type].cost * (TacticalAI.unitValueWeight[unit.type] ?? 1);
            score += (1 - unit.hp / unit.maxHp) * 2600 * Math.max(0.45, aiGenome.tacticGenes.focusFire);
            score += TacticalAI.CombatMath.unitCombatPower(unit) * 0.75;
            // ORDU-SEVİYESİ ODAK: çok birimimizin vurabildiği + çabuk ölecek hedefe yığ (Lanchester)
            if (state?.ownUnits) {
                let reach = 0;
                for (const own of state.ownUnits) {
                    if (own.dead) continue;
                    if (Math.hypot(own.x - unit.x, own.y - unit.y) <= own.range + 90) reach++;
                }
                score += reach * 850;                          // ulaşılabilirlik = yoğunlaşabilirlik
            }
            score += Math.max(0, 1 - unit.hp / 300) * 1700;    // düşük mutlak HP → tek volede bitir
            score += (STATS[unit.type].cost / Math.max(60, unit.hp)) * 1200;   // değer/HP: değerli + yumuşak = hızlı kill
            if ([T.ARMOR, T.MECH_INFANTRY, T.ARMOR_INFANTRY].includes(unit.type)) score += 500 * aiGenome.tacticGenes.targetArmorPriority;
            if ([T.ARTILLERY, T.MEDIC, T.ENGINEER].includes(unit.type)) score += 1700 * aiGenome.tacticGenes.targetSupportPriority;
            if (pressureFailure) {
                if (unit.type === T.ARTILLERY) score += 14000;
                else if (unit.type === T.MEDIC) score += 11000;
                else if (unit.type === T.ENGINEER) score += 9500;
                else if (unit.type === T.ANTI_TANK) score += 6500;
                else if (supportAlive && unit.type === T.ARMOR) score -= 1800;
                else if (supportAlive && unit.type === T.ARMOR_INFANTRY) score -= 900;
            }
            if (doctrine === AI_DOCTRINE.ANTI_ARTILLERY && unit.type === T.ARTILLERY) score += 12000;
            if (doctrine === AI_DOCTRINE.SIEGE_BREAK && [T.ARTILLERY, T.ENGINEER, T.MEDIC].includes(unit.type)) score += 5200;
            if (doctrine === AI_DOCTRINE.LAST_HUNT) score += (1 - unit.hp / Math.max(1, unit.maxHp)) * 6000;
            if (score > bestScore) {
                bestScore = score;
                best = unit;
            }
        }
        return best;
    }

    adaptDuringMatch(now, doctrine) {
        if (!this.telemetry || !this.telemetry.started || now - this.lastAdaptAt < 3000) return;
        const dealtDelta = this.telemetry.damageDealt - this.lastDamageDealt;
        const takenDelta = this.telemetry.damageTaken - this.lastDamageTaken;
        const valueGainDelta = this.telemetry.enemyValueDestroyed - this.lastEnemyValueDestroyed;
        const valueLostDelta = this.telemetry.aiValueLost - this.lastAiValueLost;
        const reward = dealtDelta - takenDelta * 1.25 + valueGainDelta * 2.2 - valueLostDelta * 3.4;
        this.bandit.record(doctrine, reward);
        this.lastDamageDealt = this.telemetry.damageDealt;
        this.lastDamageTaken = this.telemetry.damageTaken;
        this.lastEnemyValueDestroyed = this.telemetry.enemyValueDestroyed;
        this.lastAiValueLost = this.telemetry.aiValueLost;
        this.lastAdaptAt = now;
    }

    onBattleEnd(metrics) {
        const finishReward = (metrics.aiWon ? 800 : metrics.aiLost ? -500 : -100) - metrics.idleSeconds * 2;
        this.bandit.record(this.director.doctrine, finishReward);
        this.bandit.save();
    }
}

const layeredAI = new LayeredAIController();

function updateLayeredAI(now) {
    // FAZ 3 strangler: 'policy' iken canlı RED'i TEMİZ KOMUTAN sürer; yoksa eski baroque (fallback).
    if (typeof AI_BACKEND !== 'undefined' && AI_BACKEND === 'policy' && typeof commanderDrive === 'function') {
        commanderDrive(true, now);
    } else {
        layeredAI.update(now);
    }
    // MÜTTEFİK (OTONOM DOST-AI) — kırmızıdan bağımsız; yalnız hikaye düellosunda u.ally birim varsa sürer (Quick Match/MP no-op)
    if (typeof commanderDriveAlly === 'function' && units.some(u => u.ally && !u.dead)) commanderDriveAlly(now);
}
