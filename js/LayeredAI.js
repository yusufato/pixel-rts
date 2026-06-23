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
        const losingMath = forceRatio < 0.72;
        const winningMath = forceRatio > (genes.decisiveForceRatio ?? 1.35);
        const badTrade = (state.valueTradeRatio ?? 0) > 1.18 && !winningMath;
        const bleedingUnderFire = (state.damageEfficiency ?? 1) < 0.85 && state.visibleEnemies > 0 && !winningMath;
        const antiArtilleryBlocked = state.antiArtilleryBlocked || state.antiArtilleryCooldown;
        const enemyRetreating = state.enemyRetreating && state.visibleEnemies > 0;
        const stalledUnderContact = state.idlePressure > 35 && state.visibleEnemies > 0;
        const styleWall = state.pressureFailure && state.visibleEnemies > 0;
        const armorWall = state.armorScreenThreat && state.visibleEnemies > 0;
        const lastHuntOpportunity = state.enemyUnits.length > 0 && state.enemyUnits.length <= 2 &&
            (state.visibleEnemies > 0 || state.recentContact || winningMath);
        const antiArtilleryOpportunity = state.visibleEnemies > 0 && state.enemyProfile.artillery > 0 &&
            state.enemyUnits.length > 2;
        const siegeBreakOpportunity = state.visibleEnemies > 0 &&
            (state.enemyInFields >= Math.max(1, state.visibleEnemies * 0.35) ||
                state.enemyProfile.artillery > 0 && state.enemyProfile.support / Math.max(1, state.enemyProfile.total) > 0.35);
        const cleanupOpportunity = state.visibleEnemies > 0 &&
            (state.enemyUnits.length <= 3 || winningMath && state.enemyUnits.length <= Math.max(5, state.ownUnits.length * 0.45));
        const scores = {
            [AI_DOCTRINE.ADVANCE]: 1.0 + genes.vanguardAggression * 0.35 + (forceRatio - 1) * 0.25,
            [AI_DOCTRINE.HUNT]: state.visibleEnemies === 0 && !state.recentContact ? 2.8 : state.visibleEnemies === 0 ? 0.7 : -1,
            [AI_DOCTRINE.ENCIRCLE]: 0.5 + genes.flankRatio + state.enemyProfile.support / Math.max(1, state.enemyProfile.total) +
                (winningMath ? 0.55 : 0),
            [AI_DOCTRINE.BREAKTHROUGH]: 0.4 + state.armorRatio * 1.8 + genes.targetArmorPriority * 0.15 +
                (winningMath ? 0.85 : 0),
            [AI_DOCTRINE.ATTRITION]: 0.4 + state.supportRatio * 1.5 + genes.supportPreferredRange * 0.25 +
                (losingMath ? 0.9 : 0),
            [AI_DOCTRINE.CLEANUP]: cleanupOpportunity ? 4.8 + Math.max(0, forceRatio - 1) : -1.2,
            [AI_DOCTRINE.LAST_HUNT]: lastHuntOpportunity ? 6.4 + Math.max(0, forceRatio - 1) : -2.0,
            [AI_DOCTRINE.ANTI_ARTILLERY]: antiArtilleryOpportunity ? 5.2 + state.enemyProfile.artillery * 0.45 : -1.5,
            [AI_DOCTRINE.SIEGE_BREAK]: siegeBreakOpportunity ? 4.9 + state.enemyInFields * 0.25 : -1.4,
            [AI_DOCTRINE.REGROUP]: state.hpRatio < genes.vanguardRetreat + 0.08 || losingMath && state.hpRatio < 0.55 ? 3.2 : -0.4,
            [AI_DOCTRINE.LAST_STAND]: state.hpRatio < 0.22 ? 4.0 : -1
        };
        if (badTrade || bleedingUnderFire) {
            scores[AI_DOCTRINE.ATTRITION] += badTrade ? 2.4 : 1.3;
            scores[AI_DOCTRINE.REGROUP] += state.hpRatio < 0.82 ? 2.1 : 0.7;
            scores[AI_DOCTRINE.BREAKTHROUGH] -= 2.6;
            scores[AI_DOCTRINE.ANTI_ARTILLERY] -= badTrade ? 2.0 : 1.1;
            scores[AI_DOCTRINE.CLEANUP] -= 1.2;
            scores[AI_DOCTRINE.LAST_HUNT] -= 1.0;
        }
        if (antiArtilleryBlocked) {
            scores[AI_DOCTRINE.ANTI_ARTILLERY] -= 5.5;
            scores[AI_DOCTRINE.ENCIRCLE] += 2.4;
            scores[AI_DOCTRINE.SIEGE_BREAK] += 2.2;
            scores[AI_DOCTRINE.ATTRITION] += 1.6;
        }
        if (enemyRetreating) {
            scores[AI_DOCTRINE.ENCIRCLE] += 3.6;
            scores[AI_DOCTRINE.ATTRITION] += 1.4;
            scores[AI_DOCTRINE.ADVANCE] += 0.6;
            scores[AI_DOCTRINE.BREAKTHROUGH] -= 1.1;
            scores[AI_DOCTRINE.ANTI_ARTILLERY] -= 1.6;
        }
        if (stalledUnderContact) {
            scores[AI_DOCTRINE.ENCIRCLE] += 1.8;
            scores[AI_DOCTRINE.SIEGE_BREAK] += 1.4;
            scores[AI_DOCTRINE.ANTI_ARTILLERY] -= 1.8;
        }
        if (styleWall) {
            scores[AI_DOCTRINE.ENCIRCLE] += 3.2;
            scores[AI_DOCTRINE.BREAKTHROUGH] += 1.8;
            scores[AI_DOCTRINE.SIEGE_BREAK] -= 1.6;
            scores[AI_DOCTRINE.ATTRITION] -= 0.8;
        }
        if (armorWall) {
            scores[AI_DOCTRINE.BREAKTHROUGH] += 2.4;
            scores[AI_DOCTRINE.ENCIRCLE] += 1.2;
            scores[AI_DOCTRINE.SIEGE_BREAK] -= state.pressureFailure ? 2.2 : 0.6;
            scores[AI_DOCTRINE.ATTRITION] -= 0.4;
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
        let flankAssigned = 0;
        const flankTarget = Math.floor(ownUnits.length * genes.flankRatio);
        for (const unit of ownUnits) {
            if ([T.MEDIC, T.ARTILLERY, T.ENGINEER, T.ANTI_TANK].includes(unit.type)) unit.squad = SQUAD.SUPPORT;
            else if ([T.RECON, T.MECH_INFANTRY].includes(unit.type) || flankAssigned < flankTarget) {
                unit.squad = SQUAD.FLANK;
                flankAssigned++;
            } else unit.squad = SQUAD.VANGUARD;
        }
    }

    getObjectives(state, doctrine, modifiers, worldModel) {
        const genes = aiGenome.tacticGenes;
        const target = doctrine === AI_DOCTRINE.HUNT
            ? worldModel.getSearchTarget(state.ownUnits, state.now)
            : worldModel.getEstimatedCenter();
        let dx = target.x - state.center.x;
        let dy = target.y - state.center.y;
        const length = Math.max(1, Math.hypot(dx, dy));
        dx /= length;
        dy /= length;
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

        if (state.compressionMode && doctrine !== AI_DOCTRINE.CLEANUP && doctrine !== AI_DOCTRINE.LAST_HUNT) {
            const retreatVector = state.enemyRetreatVector || { x: dx, y: dy };
            const rvLength = Math.max(1, Math.hypot(retreatVector.x, retreatVector.y));
            const rvx = retreatVector.x / rvLength;
            const rvy = retreatVector.y / rvLength;
            const rvpx = -rvy;
            const rvpy = rvx;
            const pressure = Math.max(0, Math.min(1, ((state.idlePressure ?? 0) - 95) / 190));
            const baseCutDistance = Math.min(300, Math.max(150, 120 + (state.enemyRetreatScore ?? 0) * 220));
            const baseWide = Math.max(330, flankWidth * 1.08);
            const cutDistance = baseCutDistance * (1 - pressure) + 85 * pressure;
            const wide = baseWide * (1 - pressure) + 210 * pressure;
            const vanguardBack = 260 * (1 - pressure) + 145 * pressure;
            const supportBack = 470 * (1 - pressure) + 335 * pressure;
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
        const spacing = (90 - aiGenome.tacticGenes.cohesion * 50) * modifiers.spacing;
        let slot;
        if (unit.squad === SQUAD.FLANK) {
            const base = index % 2 === 0 ? objectives.flankLeft : objectives.flankRight;
            slot = { x: base.x + (index % 3 - 1) * spacing, y: base.y + Math.floor(index / 3) * spacing * 0.5 };
        } else if (unit.squad === SQUAD.SUPPORT) {
            slot = { x: objectives.support.x + (index % 5 - 2) * spacing, y: objectives.support.y - Math.floor(index / 5) * spacing };
        } else {
            slot = { x: objectives.vanguard.x + (index % 7 - 3) * spacing, y: objectives.vanguard.y + Math.floor(index / 7) * spacing * 0.55 };
        }
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
    constructor() {
        this.world = new AIWorldModel();
        this.navigator = new AIMountainNavigator();
        this.arbiter = new AICommandArbiter();
        this.bandit = new AIDoctrineBandit();
        this.director = new AIStrategicDirector(this.bandit);
        this.planner = new AISquadPlanner();
        this.lastUpdate = -Infinity;
        this.lastAdaptAt = 0;
        this.lastDamageDealt = 0;
        this.lastDamageTaken = 0;
        this.lastEnemyValueDestroyed = 0;
        this.lastAiValueLost = 0;
        this.lastEnemyCenter = null;
        this.lastEnemyCenterAt = -Infinity;
        this.enemyRetreatScore = 0;
        this.enemyRetreatVector = { x: 0, y: 1 };
        this.antiArtilleryStartAt = -Infinity;
        this.antiArtilleryDamageAt = 0;
        this.antiArtilleryCooldownUntil = -Infinity;
    }

    reset(now = 0) {
        this.world.reset();
        this.navigator.reset();
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
        this.enemyRetreatVector = { x: 0, y: 1 };
        this.antiArtilleryStartAt = -Infinity;
        this.antiArtilleryDamageAt = 0;
        this.antiArtilleryCooldownUntil = -Infinity;
        this.director.doctrine = AI_DOCTRINE.ADVANCE;
    }

    measureEnemyRetreat(now, visibleEnemies, center) {
        if (visibleEnemies.length === 0) {
            this.enemyRetreatScore = Math.max(0, this.enemyRetreatScore - 0.08);
            return {
                retreating: false,
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
        if (speed > 0.012) {
            this.enemyRetreatVector = { x: vx / speed, y: vy / speed };
        }
        this.lastEnemyCenter = { ...enemyCenter };
        this.lastEnemyCenterAt = now;

        return {
            retreating: this.enemyRetreatScore > 0.55,
            score: this.enemyRetreatScore,
            vector: { ...this.enemyRetreatVector }
        };
    }

    antiArtilleryStatus(now, previousDoctrine) {
        const damage = typeof battleTelemetry !== 'undefined' && battleTelemetry.started
            ? battleTelemetry.antiArtilleryDamage
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
        const ownUnits = units.filter(unit => unit.isRed && !unit.dead);
        if (ownUnits.length === 0) return;
        const enemyUnits = units.filter(unit => !unit.isRed && !unit.dead);
        const visibleEnemies = enemyUnits.filter(unit => canSee(true, unit.x, unit.y));

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
            trenches.some(field => !field.isRed && Math.hypot(enemyUnit.x - field.x, enemyUnit.y - field.y) < field.r)
        ).length;
        const liveDamageEfficiency = typeof battleTelemetry !== 'undefined'
            ? battleTelemetry.damageDealt / Math.max(1, battleTelemetry.damageTaken)
            : 1;
        const liveValueTradeRatio = typeof battleTelemetry !== 'undefined'
            ? battleTelemetry.aiValueLost / Math.max(1, battleTelemetry.enemyValueDestroyed)
            : 0;
        const enemyRetreat = this.measureEnemyRetreat(now, visibleEnemies, center);
        const antiArtilleryStatus = this.antiArtilleryStatus(now, this.director.doctrine);
        const idlePressure = typeof battleTelemetry !== 'undefined' && battleTelemetry.started
            ? battleTelemetry.idleSeconds
            : 0;
        const compressionSeconds = typeof battleTelemetry !== 'undefined' && battleTelemetry.started
            ? battleTelemetry.compressionSeconds || 0
            : 0;
        const fireBaseWaitSeconds = typeof battleTelemetry !== 'undefined' && battleTelemetry.started
            ? battleTelemetry.fireBaseWaitSeconds || 0
            : 0;
        const pressureFailure = visibleEnemies.length > 0 &&
            (idlePressure > 115 || compressionSeconds > 130) &&
            liveDamageEfficiency < 0.92;
        const state = {
            now,
            ownUnits,
            enemyUnits,
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
            compressionMode: enemyRetreat.retreating || idlePressure > 60 && visibleEnemies.length > 0,
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
        if (typeof battleTelemetry !== 'undefined') {
            battleTelemetry.recordDoctrine(doctrine, now);
            const reconUnits = ownUnits.filter(unit => unit.type === T.RECON);
            for (const scout of reconUnits) {
                for (const target of visibleEnemies) {
                    if (![T.ARTILLERY, T.MEDIC, T.ENGINEER].includes(target.type)) continue;
                    if (Math.hypot(scout.x - target.x, scout.y - target.y) <= scout.vision) {
                        battleTelemetry.recordScoutSpot(scout, target);
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
        const supportReadiness = this.measureSupportReadiness(ownUnits, visibleEnemies, objectives);
        const fireBaseOverdue = state.fireBaseWaitSeconds > 34 || state.pressureFailure;
        const prepareFireBase = visibleEnemies.length > 0 &&
            !cleanupMode &&
            !lastHuntMode &&
            !antiArtilleryMode &&
            !fireBaseOverdue &&
            !supportReadiness.ready &&
            combatAnalysis.forceRatio < 1.55;
        if (typeof battleTelemetry !== 'undefined') {
            battleTelemetry.recordOperationalSignals?.({
                compressionMode: state.compressionMode,
                fireBaseWait: prepareFireBase,
                pressureBreak: state.pressureFailure,
                antiArtilleryBlocked: state.antiArtilleryBlocked || state.antiArtilleryCooldown
            }, now);
        }
        this.manageEngineerFields(ownUnits, objectives, now);
        this.arbiter.beginCycle();
        const focusTarget = this.pickFocusTarget(visibleEnemies, doctrine, state);
        aiFocusTarget = focusTarget;

        let vanguardIndex = 0;
        let flankIndex = 0;
        let supportIndex = 0;
        for (const unit of ownUnits) {
            const combatTarget = this.pickUnitTarget(unit, visibleEnemies, focusTarget, state);
            const scoutAgainstArmor = !cleanupMode && unit.type === T.RECON && armorScreenThreat && combatTarget;
            const unitIsAntiArmor = [T.ANTI_TANK, T.ARTILLERY, T.ARMOR].includes(unit.type);
            const holdForCounters = !cleanupMode && armorScreenThreat && !state.pressureFailure &&
                unit.squad !== SQUAD.FLANK && !unitIsAntiArmor &&
                ![T.MEDIC, T.ENGINEER].includes(unit.type);
            const artilleryTarget = antiArtilleryMode
                ? visibleEnemies.find(enemy => enemy.type === T.ARTILLERY) || combatTarget
                : null;
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
            if (scoutSpotTarget && !cleanupMode && !lastHuntMode) {
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
                    .sort((a, b) => Math.hypot(a.x - unit.x, a.y - unit.y) - Math.hypot(b.x - unit.x, b.y - unit.y))[0]
                : null;
            if (antiTankArmorTarget && !cleanupMode) {
                const distance = Math.hypot(antiTankArmorTarget.x - unit.x, antiTankArmorTarget.y - unit.y);
                const hasFireLine = checkLineOfSight(unit.x, unit.y, antiTankArmorTarget.x, antiTankArmorTarget.y, unit, antiTankArmorTarget);
                const canFireSafely = hasFireLine && distance <= unit.range && distance >= unit.range * 0.58;
                const hold = this.fireBaseHoldPoint(unit, objectives, antiTankArmorTarget);
                this.arbiter.issue(unit, {
                    x: canFireSafely ? unit.x : hold.x,
                    y: canFireSafely ? unit.y : hold.y,
                    targetUnit: canFireSafely ? antiTankArmorTarget : null,
                    action: canFireSafely ? 'PROTECTED_AT_FIRE' : 'PROTECTED_AT_SETUP',
                    priority: AI_COMMAND_PRIORITY.LOGISTICS,
                    createdAt: now
                });
                if (!canFireSafely) unit.attackTarget = null;
            } else if (prepareFireBase && combatTarget &&
                [T.ARTILLERY, T.ANTI_TANK].includes(unit.type)) {
                const distance = Math.hypot(combatTarget.x - unit.x, combatTarget.y - unit.y);
                const hasFireLine = unit.type === T.ARTILLERY ||
                    checkLineOfSight(unit.x, unit.y, combatTarget.x, combatTarget.y, unit, combatTarget);
                const canFire = hasFireLine && distance <= unit.range;
                this.arbiter.issue(unit, {
                    x: canFire ? unit.x : objectives.support.x,
                    y: canFire ? unit.y : objectives.support.y,
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
                    targetUnit: raidTarget,
                    action: raidTarget ? 'BACKLINE_RAID' : 'COMPRESS_CUT',
                    priority: raidTarget ? AI_COMMAND_PRIORITY.LOGISTICS : AI_COMMAND_PRIORITY.COMBAT,
                    createdAt: now
                });
                if (!raidTarget) unit.attackTarget = null;
            } else if (compressionMode && combatTarget && unit.squad === SQUAD.VANGUARD &&
                ![T.ARTILLERY, T.ANTI_TANK].includes(unit.type)) {
                const distance = Math.hypot(combatTarget.x - unit.x, combatTarget.y - unit.y);
                const canFire = distance <= unit.range &&
                    checkLineOfSight(unit.x, unit.y, combatTarget.x, combatTarget.y, unit, combatTarget);
                this.arbiter.issue(unit, {
                    x: canFire ? unit.x : objectives.vanguard.x,
                    y: canFire ? unit.y : objectives.vanguard.y,
                    targetUnit: canFire ? combatTarget : null,
                    action: canFire ? 'PRESSURE_FIRE' : 'PRESSURE_HOLD',
                    priority: AI_COMMAND_PRIORITY.COMBAT,
                    createdAt: now
                });
                if (!canFire) unit.attackTarget = null;
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
            } else if (combatTarget) {
                const distance = Math.hypot(combatTarget.x - unit.x, combatTarget.y - unit.y);
                const hasFireLine = unit.type === T.ARTILLERY ||
                    checkLineOfSight(unit.x, unit.y, combatTarget.x, combatTarget.y, unit, combatTarget);
                const firingNow = hasFireLine && distance <= unit.range;
                const shouldExecute = decisionState === TacticalAI.UNIT_DECISION_STATE.EXECUTE;
                const shouldKite = !cleanupMode && decisionState === TacticalAI.UNIT_DECISION_STATE.KITE;
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

            const roleIndex = unit.squad === SQUAD.FLANK
                ? flankIndex++
                : unit.squad === SQUAD.SUPPORT
                    ? supportIndex++
                    : vanguardIndex++;
            const rawSlot = this.planner.slotFor(unit, roleIndex, objectives, modifiers);
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
        if (trenches.filter(field => field.isRed).length >= 1) return;
        for (const engineer of ownUnits) {
            if (engineer.type !== T.ENGINEER || engineer.buildTrenchTarget || now - engineer.lastFieldBuiltAt < 14000) continue;
            const protectedByField = trenches.some(field =>
                field.isRed && Math.hypot(field.x - engineer.x, field.y - engineer.y) < 430
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
            if ([T.ARMOR, T.MECH_INFANTRY, T.ARMOR_INFANTRY].includes(unit.type)) score += 1300 * aiGenome.tacticGenes.targetArmorPriority;
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
        if (!battleTelemetry.started || now - this.lastAdaptAt < 3000) return;
        const dealtDelta = battleTelemetry.damageDealt - this.lastDamageDealt;
        const takenDelta = battleTelemetry.damageTaken - this.lastDamageTaken;
        const valueGainDelta = battleTelemetry.enemyValueDestroyed - this.lastEnemyValueDestroyed;
        const valueLostDelta = battleTelemetry.aiValueLost - this.lastAiValueLost;
        const reward = dealtDelta - takenDelta * 1.25 + valueGainDelta * 2.2 - valueLostDelta * 3.4;
        this.bandit.record(doctrine, reward);
        this.lastDamageDealt = battleTelemetry.damageDealt;
        this.lastDamageTaken = battleTelemetry.damageTaken;
        this.lastEnemyValueDestroyed = battleTelemetry.enemyValueDestroyed;
        this.lastAiValueLost = battleTelemetry.aiValueLost;
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
    layeredAI.update(now);
}
