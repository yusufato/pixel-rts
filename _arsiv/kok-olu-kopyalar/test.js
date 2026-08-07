// ═══════════════════════════════════════════════════════════════
//  PIXEL RTS – TAKTİKSEL SAVAŞ (Öğrenen AI, Savaş Sisi, Etki Haritası)
// ═══════════════════════════════════════════════════════════════

const canvas = {width:2000,height:1000, classList:{add:()=>{}, remove:()=>{}}};
const ctx = {};
const spriteSheet = ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('spriteSheet');
const minimapCanvas = {width:200,height:100, addEventListener:()=>{}};
const minimapCtx = {};

const fogCanvas = ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).createElement('canvas');
const fogCtx = fogCanvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    fogCanvas.width = canvas.width;
    fogCanvas.height = canvas.height;
}
window.addEventListener('resize', resize);
resize();

const WORLD_W = 3200;
const WORLD_H = 1600;

const TERRAIN = { NONE: 0, FOREST: 1, MOUNTAIN: 2 };
const terrainFeatures = [
    { x: WORLD_W/2, y: WORLD_H/2, r: 160, type: TERRAIN.MOUNTAIN },
    { x: WORLD_W/2, y: WORLD_H/2 - 450, r: 120, type: TERRAIN.MOUNTAIN },
    { x: WORLD_W/2, y: WORLD_H/2 + 450, r: 120, type: TERRAIN.MOUNTAIN },
    { x: WORLD_W/2 - 400, y: WORLD_H/2 - 250, r: 220, type: TERRAIN.FOREST },
    { x: WORLD_W/2 + 400, y: WORLD_H/2 + 250, r: 220, type: TERRAIN.FOREST },
    { x: WORLD_W/2 - 400, y: WORLD_H/2 + 250, r: 220, type: TERRAIN.FOREST },
    { x: WORLD_W/2 + 400, y: WORLD_H/2 - 250, r: 220, type: TERRAIN.FOREST }
];

const camera = { x: 0, y: 0 };
let zoom = 1.0;
const ZOOM_MIN = 0.35;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.08;
const CAM_SPEED = 8;
const EDGE_SCROLL_ZONE = 40;
const keys = {};

window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const oldZoom = zoom;
    const minZoomX = canvas.width / WORLD_W;
    const minZoomY = (canvas.height - 100) / WORLD_H;
    const dynamicMinZoom = Math.max(ZOOM_MIN, minZoomX, minZoomY);
    
    if (e.deltaY < 0) zoom = Math.min(ZOOM_MAX, zoom + ZOOM_STEP);
    else zoom = Math.max(dynamicMinZoom, zoom - ZOOM_STEP);

    const worldBefore = screenToWorldRaw(mouseScreenX, mouseScreenY, oldZoom);
    const worldAfter = screenToWorldRaw(mouseScreenX, mouseScreenY, zoom);
    camera.x += worldBefore.x - worldAfter.x;
    camera.y += worldBefore.y - worldAfter.y;

    clampCamera();
}, { passive: false });

function clampCamera() {
    const viewW = canvas.width / zoom;
    const viewH = (canvas.height - 100) / zoom;
    camera.x = Math.max(0, Math.min(WORLD_W - viewW, camera.x));
    camera.y = Math.max(0, Math.min(WORLD_H - viewH, camera.y));
}

function updateCamera() {
    const spd = CAM_SPEED / zoom;
    if (keys['w'] || keys['arrowup']) camera.y -= spd;
    if (keys['s'] || keys['arrowdown']) camera.y += spd;
    if (keys['a'] || keys['arrowleft']) camera.x -= spd;
    if (keys['d'] || keys['arrowright']) camera.x += spd;

    if (phase !== PHASE.DEPLOY) {
        if (mouseScreenX < EDGE_SCROLL_ZONE) camera.x -= spd;
        if (mouseScreenX > canvas.width - EDGE_SCROLL_ZONE) camera.x += spd;
        if (mouseScreenY < EDGE_SCROLL_ZONE) camera.y -= spd;
        if (mouseScreenY > canvas.height - EDGE_SCROLL_ZONE - 100) camera.y += spd;
    }

    clampCamera();
}

function screenToWorldRaw(sx, sy, z) { return { x: sx / z + camera.x, y: sy / z + camera.y }; }
function screenToWorld(sx, sy) { return { x: sx / zoom + camera.x, y: sy / zoom + camera.y }; }
function worldToScreen(wx, wy) { return { x: (wx - camera.x) * zoom, y: (wy - camera.y) * zoom }; }

const SP_W = 300, SP_H = 220, SP_PAD = 30;
const BASE_DRAW_SCALE = 0.20;
const BASE_DRAW_W = SP_W * BASE_DRAW_SCALE;
const BASE_DRAW_H = SP_H * BASE_DRAW_SCALE;
const UNIT_RADIUS = Math.max(BASE_DRAW_W, BASE_DRAW_H) / 2;

function drawW() { return BASE_DRAW_W * zoom; }
function drawH() { return BASE_DRAW_H * zoom; }

const T = {
    INFANTRY: 0, MECH_INFANTRY: 1, ARMOR_INFANTRY: 2,
    RECON: 3, ENGINEER: 4, MEDIC: 5,
    ARMOR: 6, ANTI_TANK: 7, ARTILLERY: 8
};

// Vision stat added for Fog of War
const SQUAD = { VANGUARD: 0, FLANK: 1, SUPPORT: 2 };
function getSquadRole(type) {
    if ([T.RECON, T.ARMOR_INFANTRY].includes(type)) return SQUAD.FLANK;
    if ([T.ARTILLERY, T.SNIPER, T.ANTI_TANK, T.MEDIC].includes(type)) return SQUAD.SUPPORT;
    return SQUAD.VANGUARD;
}

const STATS = {
    [T.INFANTRY]: { hp: 100, atk: 14, speed: 0.72, range: 110, vision: 350, atkSpeed: 850, armor: 0, cost: 50, name: 'Piyade', desc: 'Çok yönlü ana hat askeri', strong: [T.ENGINEER, T.MEDIC, T.ANTI_TANK], weak: [T.ARMOR, T.ARTILLERY, T.ARMOR_INFANTRY] },
    [T.MECH_INFANTRY]: { hp: 120, atk: 16, speed: 1.20, range: 120, vision: 400, atkSpeed: 780, armor: 1, cost: 80, name: 'Mekanize', desc: 'Zırhlı personel taşıyıcıda hızlı piyade', strong: [T.INFANTRY, T.RECON, T.ENGINEER], weak: [T.ARMOR, T.ANTI_TANK, T.ARTILLERY] },
    [T.ARMOR_INFANTRY]: { hp: 180, atk: 11, speed: 0.52, range: 100, vision: 250, atkSpeed: 950, armor: 3, cost: 100, name: 'Zırhlı Piy.', desc: 'Ağır zırhlı, çok yavaş, dayanıklı duvar', strong: [T.INFANTRY, T.MECH_INFANTRY, T.RECON], weak: [T.ARTILLERY, T.ARMOR, T.ANTI_TANK] },
    [T.RECON]: { hp: 55, atk: 8, speed: 1.80, range: 130, vision: 800, atkSpeed: 650, armor: 0, cost: 40, name: 'Keşif', desc: 'Sisin içini aydınlatan geniş görüşlü birim', strong: [T.ARTILLERY, T.MEDIC, T.ENGINEER], weak: [T.INFANTRY, T.MECH_INFANTRY, T.ARMOR_INFANTRY, T.ARMOR, T.ANTI_TANK] },
    [T.ENGINEER]: { hp: 90, atk: 6, speed: 0.60, range: 80, vision: 300, atkSpeed: 1100, armor: 0, cost: 60, name: 'İstihkam', desc: 'Yakın dostlara +2 zırh bonusu verir', strong: [], weak: [T.INFANTRY, T.RECON, T.MECH_INFANTRY, T.ARMOR] },
    [T.MEDIC]: { hp: 45, atk: 0, speed: 0.80, range: 90, vision: 300, atkSpeed: 1000, armor: 0, cost: 70, name: 'Sağlıkçı', desc: 'Silahsız, dost birimleri iyileştirir', strong: [], weak: [T.INFANTRY, T.RECON, T.MECH_INFANTRY, T.ARMOR, T.ANTI_TANK, T.ARTILLERY] },
    [T.ARMOR]: { hp: 300, atk: 35, speed: 0.64, range: 275, vision: 400, atkSpeed: 1600, armor: 8, cost: 200, name: 'Tank', desc: 'Ana Muharebe Tankı. Küçük silahlar etkisiz', strong: [T.INFANTRY, T.MECH_INFANTRY, T.ARMOR_INFANTRY, T.RECON, T.ENGINEER, T.MEDIC], weak: [T.ANTI_TANK, T.ARTILLERY] },
    [T.ANTI_TANK]: { hp: 75, atk: 12, speed: 0.60, range: 160, vision: 350, atkSpeed: 1400, armor: 0, cost: 100, name: 'Tanksavar', desc: 'Zırhlılara x2.5 hasar, piyadeden kaçar', strong: [T.ARMOR, T.MECH_INFANTRY, T.ARMOR_INFANTRY], weak: [T.INFANTRY, T.RECON, T.ARTILLERY] },
    [T.ARTILLERY]: { hp: 65, atk: 40, speed: 0.36, range: 350, vision: 300, atkSpeed: 2800, armor: 0, cost: 150, name: 'Topçu', desc: 'Uzak menzil. Görüş için Keşif araçlarına muhtaçtır!', strong: [T.INFANTRY, T.MECH_INFANTRY, T.ARMOR_INFANTRY, T.ARMOR], weak: [T.RECON] },
};

const AT_ARMOR_MULTIPLIER = 2.5;
const PHASE = { DEPLOY: 'deploy', BATTLE: 'battle', OVER: 'over' };
let phase = PHASE.DEPLOY;
let gameTime = 0;

const player = { money: 1500, kills: 0, unitsSpawned: 0 };
const enemy = { money: 1500, kills: 0, unitsSpawned: 0 };

const units = [];

let mouseScreenX = 0, mouseScreenY = 0;
let isDragging = false;
let dragStartX = 0, dragStartY = 0;
let selectedSpawnType = null;

// ─── LOCAL STORAGE (Öğrenen AI) ───
const MEMORY_KEY = 'pixelRtsMemory';
const GENOME_KEY = 'pixelRtsGenome';
let playerMeta = JSON.parse(({getItem:()=>null, setItem:()=>{}}).getItem(MEMORY_KEY)) || {};
let aiGenome = JSON.parse(({getItem:()=>null, setItem:()=>{}}).getItem(GENOME_KEY));

if (!aiGenome || !aiGenome.neuralWeights || aiGenome.neuralWeights.length !== 30) {
    if (!aiGenome) {
        aiGenome = {
            counterMatrix: [],
            deployMatrix: []
        };
        for(let i=0; i<9; i++) {
            aiGenome.counterMatrix[i] = [1,1,1,1,1,1,1,1,1];
            aiGenome.deployMatrix[i] = [Math.random(), Math.random()];
        }
    }
    
    // 30 Girdi x 9 Çıktı Dev Sinir Ağı
    aiGenome.neuralWeights = [];
    for(let s=0; s<30; s++) {
        let w = [];
        for(let m=0; m<9; m++) {
            w.push((Math.random() * 2) - 1.0);
        }
        aiGenome.neuralWeights.push(w);
    }
    
    delete aiGenome.maneuverWeights;
    delete aiGenome.tacticMatrix;
    delete aiGenome.doctrines;
    ({getItem:()=>null, setItem:()=>{}}).setItem(GENOME_KEY, JSON.stringify(aiGenome));
}

function savePlayerMeta() {
    for (const u of units) {
        if (!u.isRed) {
            playerMeta[u.type] = (playerMeta[u.type] || 0) + 1;
        }
    }
    ({getItem:()=>null, setItem:()=>{}}).setItem(MEMORY_KEY, JSON.stringify(playerMeta));
}

// ─── SAVAŞ SİSİ KONTROLÜ (Team Vision) ───
function canSee(teamIsRed, targetX, targetY) {
    for (const u of units) {
        if (u.dead || u.isRed !== teamIsRed) continue;
        if (Math.hypot(u.x - targetX, u.y - targetY) <= STATS[u.type].vision) return true;
    }
    // Kendi güvenli üssünü her zaman görebilir
    if (!teamIsRed && targetX < WORLD_W * 0.3) return true; 
    if (teamIsRed && targetX > WORLD_W * 0.7) return true;
    return false;
}

function isInPlayerZone(worldX) {
    return worldX >= 50 && worldX <= WORLD_W / 2 - 50;
}

// ═══════════════════════════════════════════════════════════════
//  BİRLİK SINIFI
// ═══════════════════════════════════════════════════════════════
class Unit {
    constructor(type, x, y, isRed) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.isRed = isRed;
        this.dead = false;
        this.selected = false;

        const s = STATS[type];
        this.maxHp = s.hp;
        this.hp = s.hp;
        this.atk = s.atk;
        this.baseSpeed = s.speed;
        this.speed = s.speed;
        this.range = s.range;
        this.atkSpeed = s.atkSpeed;
        this.baseArmor = s.armor;
        this.armor = s.armor;
        this.inForest = false;

        this.targetX = x;
        this.targetY = y;
        this.attackTarget = null;
        this.manualTarget = null;
        this.manualMoveTarget = null;
        this.lastAttackTime = 0;
        this.isMovingToManualTarget = false;
        
        this.aiAction = 'ATTACK';

        this.sx = SP_PAD + type * (SP_W + SP_PAD);
        this.sy = isRed ? (SP_PAD * 2 + SP_H) : SP_PAD;
        this.flashTimer = 0;
    }

    update(now) {
        if (this.dead || phase !== PHASE.BATTLE) return;

        if (this.flashTimer > 0) this.flashTimer--;

        this.updateTerrainBonuses();
        this.updateEngineerBonus();

        if (this.type === T.MEDIC) this.healNearby(now);

        this.engageCombat(now);

        // MOVEMENT & OBSTACLE AVOIDANCE (Steering)
        let desiredX = this.targetX - this.x;
        let desiredY = this.targetY - this.y;
        const distToTarget = Math.sqrt(desiredX * desiredX + desiredY * desiredY);

        if (distToTarget > this.speed + 1) {
            let moveX = (desiredX / distToTarget) * this.speed;
            let moveY = (desiredY / distToTarget) * this.speed;

            // Dağlardan İtilme Vektörü
            for (const t of terrainFeatures) {
                if (t.type === TERRAIN.MOUNTAIN) {
                    const dx = this.x - t.x;
                    const dy = this.y - t.y;
                    const distToMountain = Math.sqrt(dx*dx + dy*dy);
                    const influenceRadius = t.r + UNIT_RADIUS + 120;
                    if (distToMountain < influenceRadius) {
                        const pushForce = (influenceRadius - distToMountain) / influenceRadius; 
                        const pushX = (dx / distToMountain) * this.speed * pushForce * 1.8;
                        const pushY = (dy / distToMountain) * this.speed * pushForce * 1.8;
                        moveX += pushX;
                        moveY += pushY;
                    }
                }
            }
            
            const finalDist = Math.hypot(moveX, moveY);
            if (finalDist > 0) {
                this.x += (moveX / finalDist) * this.speed;
                this.y += (moveY / finalDist) * this.speed;
            }
        } else {
            this.isMovingToManualTarget = false;
        }

        this.x = Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS, this.x));
        this.y = Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS, this.y));
    }

    updateTerrainBonuses() {
        this.inForest = false;
        for (const t of terrainFeatures) {
            if (t.type === TERRAIN.FOREST) {
                if (Math.hypot(this.x - t.x, this.y - t.y) < t.r) {
                    this.inForest = true; break;
                }
            }
        }
        this.speed = this.inForest ? this.baseSpeed * 0.7 : this.baseSpeed;
    }

    updateEngineerBonus() {
        this.armor = this.baseArmor + (this.inForest ? 3 : 0);
        for (const u of units) {
            if (u.dead || u.type !== T.ENGINEER || u.isRed !== this.isRed || u === this) continue;
            if (Math.hypot(u.x - this.x, u.y - this.y) <= 180) { this.armor += 2; break; }
        }
    }

    healNearby(now) {
        if (now - this.lastAttackTime < this.atkSpeed) return;
        let lowestHpUnit = null;
        let lowestRatio = 1;
        for (const u of units) {
            if (u.dead || u.isRed !== this.isRed || u === this || u.hp >= u.maxHp) continue;
            if (u.type === T.ARMOR || u.type === T.MECH_INFANTRY) continue;
            const d = Math.hypot(u.x - this.x, u.y - this.y);
            const ratio = u.hp / u.maxHp;
            if (d <= this.range && ratio < lowestRatio) {
                lowestHpUnit = u; lowestRatio = ratio;
            }
        }
        if (lowestHpUnit) {
            lowestHpUnit.hp = Math.min(lowestHpUnit.maxHp, lowestHpUnit.hp + 18);
            this.lastAttackTime = now;
        }
    }

    engageCombat(now) {
        if (this.type === T.MEDIC) return;

        if (!this.isRed) {
            // Player Combat
            if (this.manualTarget && !this.manualTarget.dead && canSee(false, this.manualTarget.x, this.manualTarget.y)) {
                this.attackTarget = this.manualTarget;
            } else {
                this.manualTarget = null;
                if (!this.attackTarget || this.attackTarget.dead || !canSee(false, this.attackTarget.x, this.attackTarget.y) || Math.hypot(this.attackTarget.x - this.x, this.attackTarget.y - this.y) > this.range * 1.3) {
                    const nearby = this.findClosestVisibleEnemy();
                    if (nearby && nearby.dist <= this.range) this.attackTarget = nearby.unit;
                    else this.attackTarget = null;
                }
            }

            if (this.attackTarget) {
                const d = Math.hypot(this.attackTarget.x - this.x, this.attackTarget.y - this.y);
                if (d <= this.range) {
                    if (this.manualTarget) { this.targetX = this.x; this.targetY = this.y; }
                    this.performAttack(now);
                } else if (this.manualTarget) {
                    this.targetX = this.attackTarget.x;
                    this.targetY = this.attackTarget.y;
                }
            } else if (this.isMovingToManualTarget) {
                const nearby = this.findClosestVisibleEnemy();
                if (nearby && nearby.dist <= this.range * 0.8) {
                    this.attackTarget = nearby.unit;
                    this.performAttack(now);
                }
            }
        } else {
            // AI Combat
            if (this.aiAction === 'FLEE') { this.attackTarget = null; return; }

            if (this.attackTarget && (this.attackTarget.dead || !canSee(true, this.attackTarget.x, this.attackTarget.y) || Math.hypot(this.attackTarget.x - this.x, this.attackTarget.y - this.y) > this.range * 1.5)) {
                this.attackTarget = null;
            }

            if (!this.attackTarget) {
                const nearby = this.findClosestVisibleEnemy();
                if (nearby && nearby.dist <= this.range) this.attackTarget = nearby.unit;
            }

            if (this.attackTarget) {
                const d = Math.hypot(this.attackTarget.x - this.x, this.attackTarget.y - this.y);
                if (d <= this.range) {
                    if (this.aiAction === 'ATTACK') { this.targetX = this.x; this.targetY = this.y; }
                    this.performAttack(now);
                }
            }
        }
    }

    findClosestVisibleEnemy() {
        let closest = null, closestDist = Infinity;
        for (const u of units) {
            if (u.dead || u.isRed === this.isRed) continue;
            // SADECE GÖRÜLEN DÜŞMANLAR HEDEFLENEBİLİR (FOG OF WAR)
            if (!canSee(this.isRed, u.x, u.y)) continue; 
            
            const d = Math.hypot(u.x - this.x, u.y - this.y);
            if (d < closestDist) { closest = u; closestDist = d; }
        }
        return closest ? { unit: closest, dist: closestDist } : null;
    }

    performAttack(now) {
        if (!this.attackTarget || this.attackTarget.dead) return;
        if (now - this.lastAttackTime < this.atkSpeed) return;

        let dmg = this.atk;
        const myStats = STATS[this.type];

        if (myStats.strong.includes(this.attackTarget.type)) dmg = Math.floor(dmg * 1.5);
        if (myStats.weak.includes(this.attackTarget.type)) dmg = Math.floor(dmg * 0.5);

        if (this.type === T.ANTI_TANK &&
            (this.attackTarget.type === T.ARMOR || this.attackTarget.type === T.MECH_INFANTRY || this.attackTarget.type === T.ARMOR_INFANTRY)) {
            dmg = Math.floor(this.atk * AT_ARMOR_MULTIPLIER);
        }

        dmg = Math.max(1, dmg - this.attackTarget.armor);
        this.attackTarget.hp -= dmg;
        this.attackTarget.flashTimer = 6;
        this.lastAttackTime = now;
        
        // HIVE MIND (YARDIM ÇAĞRISI)
        if (this.attackTarget.isRed) {
            this.attackTarget.lastHitTime = now;
            this.attackTarget.distressX = this.x; // Saldırganın konumu
            this.attackTarget.distressY = this.y;
        }

        if (this.attackTarget.hp <= 0) {
            this.attackTarget.dead = true;
            if(this.isRed) enemy.kills++; else player.kills++;
            this.attackTarget = null;
            this.manualTarget = null;
        }
    }

    draw() {
        if (this.dead) return;

        // FOG OF WAR RENDERING: Sisin içindeki düşman çizilmez
        if (this.isRed && phase === PHASE.BATTLE && !canSee(false, this.x, this.y)) return;

        const s = worldToScreen(this.x, this.y);
        const dw = drawW(), dh = drawH();

        if (s.x < -dw * 2 || s.x > canvas.width + dw * 2 || s.y < -dh * 2 || s.y > canvas.height + dh * 2) return;

        if (this.selected && !this.isRed) {
            ctx.strokeStyle = '#00ff55';
            ctx.lineWidth = 2;
            ctx.strokeRect(s.x - dw / 2 - 3, s.y - dh / 2 - 3, dw + 6, dh + 6);
        }

        if (this.type === T.ENGINEER && !this.dead) {
            ctx.strokeStyle = this.isRed ? 'rgba(255,200,100,0.08)' : 'rgba(100,255,200,0.08)';
            ctx.fillStyle = this.isRed ? 'rgba(255,200,100,0.03)' : 'rgba(100,255,200,0.03)';
            ctx.beginPath(); ctx.arc(s.x, s.y, 180 * zoom, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
        }

        if (this.flashTimer > 0) ctx.globalAlpha = 0.5;
        ctx.drawImage(spriteSheet, this.sx, this.sy, SP_W, SP_H, s.x - dw / 2, s.y - dh / 2, dw, dh);
        ctx.globalAlpha = 1.0;

        if (this.armor > this.baseArmor) {
            ctx.fillStyle = this.inForest ? '#4caf50' : '#44ffaa';
            ctx.font = `${Math.max(8, 8 * zoom)}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(this.inForest ? '🌲+🛡️' : '🛡️', s.x, s.y + dh / 2 + 10 * zoom);
        }

        const barW = dw + 6;
        const barH = Math.max(3, 4 * zoom);
        const barX = s.x - barW / 2;
        const barY = s.y - dh / 2 - 6 * zoom - 3;
        const ratio = Math.max(0, this.hp / this.maxHp);

        ctx.fillStyle = '#222'; ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = ratio > 0.5 ? '#4cff7c' : ratio > 0.25 ? '#ffaa00' : '#ff3333';
        ctx.fillRect(barX, barY, barW * ratio, barH);
        ctx.strokeStyle = '#000'; ctx.strokeRect(barX, barY, barW, barH);
    }
}

function resolveCollisions() {
    const MIN_DIST = UNIT_RADIUS * 1.9;
    for (let i = 0; i < units.length; i++) {
        if (units[i].dead) continue;
        for (let j = i + 1; j < units.length; j++) {
            if (units[j].dead) continue;
            const a = units[i], b = units[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < MIN_DIST && dist > 0.01) {
                const overlap = (MIN_DIST - dist) / 2;
                a.x -= (dx/dist) * overlap; a.y -= (dy/dist) * overlap;
                b.x += (dx/dist) * overlap; b.y += (dy/dist) * overlap;
            }
        }
    }
    for (const u of units) {
        if (u.dead) continue;
        for (const t of terrainFeatures) {
            if (t.type === TERRAIN.MOUNTAIN) {
                const dx = u.x - t.x; const dy = u.y - t.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const mountainMinDist = UNIT_RADIUS + t.r;
                if (dist < mountainMinDist && dist > 0.01) {
                    const overlap = mountainMinDist - dist;
                    u.x += (dx / dist) * overlap; u.y += (dy / dist) * overlap;
                }
            }
        }
    }
}

function placeUnit(type, worldX, worldY, isRed) {
    const src = isRed ? enemy : player;
    const s = STATS[type];
    if (src.money < s.cost) return false;
    src.money -= s.cost;
    src.unitsSpawned++;
    units.push(new Unit(type, worldX, worldY, isRed));
    return true;
}

canvas.addEventListener('mousemove', (e) => { mouseScreenX = e.clientX; mouseScreenY = e.clientY; });
canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.clientY > canvas.height - 110) return;
    if (phase === PHASE.DEPLOY && selectedSpawnType !== null) {
        const world = screenToWorld(e.clientX, e.clientY);
        if (isInPlayerZone(world.x) && world.y > 30 && world.y < WORLD_H - 30) {
            placeUnit(selectedSpawnType, world.x, world.y, false);
        }
        return;
    }
    isDragging = true; dragStartX = e.clientX; dragStartY = e.clientY;
    if (!e.shiftKey) units.forEach(u => { if (!u.isRed) u.selected = false; });
});
canvas.addEventListener('mouseup', (e) => {
    if (e.button !== 0 || !isDragging) return;
    isDragging = false;
    const minSX = Math.min(dragStartX, mouseScreenX), maxSX = Math.max(dragStartX, mouseScreenX);
    const minSY = Math.min(dragStartY, mouseScreenY), maxSY = Math.max(dragStartY, mouseScreenY);
    if (maxSX - minSX < 5 && maxSY - minSY < 5) {
        const world = screenToWorld(e.clientX, e.clientY);
        let bestUnit = null, bestDist = 30;
        for (const u of units) {
            if (u.dead || u.isRed) continue;
            const d = Math.hypot(u.x - world.x, u.y - world.y);
            if (d < bestDist) { bestUnit = u; bestDist = d; }
        }
        if (bestUnit) bestUnit.selected = true;
    } else {
        const topLeft = screenToWorld(minSX, minSY), bottomRight = screenToWorld(maxSX, maxSY);
        for (const u of units) {
            if (u.dead || u.isRed) continue;
            if (u.x >= topLeft.x && u.x <= bottomRight.x && u.y >= topLeft.y && u.y <= bottomRight.y) u.selected = true;
        }
    }
});
canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (phase === PHASE.DEPLOY) {
        selectedSpawnType = null;
        ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).querySelectorAll('.spawn-btn').forEach(b => b.classList.remove('selected-btn'));
        canvas.classList.remove('ghost-cursor');
        return;
    }
    if (phase !== PHASE.BATTLE) return;
    const world = screenToWorld(e.clientX, e.clientY);
    const selectedUnits = units.filter(u => u.selected && !u.isRed && !u.dead);
    if (selectedUnits.length === 0) return;

    let targetEnemy = null;
    for (const u of units) {
        if (u.dead || !u.isRed || !canSee(false, u.x, u.y)) continue;
        if (Math.hypot(u.x - world.x, u.y - world.y) < 30) { targetEnemy = u; break; }
    }
    if (targetEnemy) {
        selectedUnits.forEach(u => { u.manualTarget = targetEnemy; u.manualMoveTarget = null; u.isMovingToManualTarget = false; });
    } else {
        const count = selectedUnits.length;
        const cols = Math.ceil(Math.sqrt(count)), spacing = UNIT_RADIUS * 2.5;
        selectedUnits.forEach((u, i) => {
            const row = Math.floor(i / cols), col = i % cols;
            const offsetX = (col - (cols - 1) / 2) * spacing, offsetY = (row - (Math.ceil(count / cols) - 1) / 2) * spacing;
            u.targetX = world.x + offsetX; u.targetY = world.y + offsetY;
            u.manualTarget = null; u.manualMoveTarget = { x: world.x + offsetX, y: world.y + offsetY };
            u.isMovingToManualTarget = true; u.attackTarget = null;
        });
    }
});

// ═══════════════════════════════════════════════════════════════
//  ÖĞRENEN AI (Karşı-Ordu / Counter-Picking ve Etki Haritası)
// ═══════════════════════════════════════════════════════════════
const GRID_SIZE = 100;
const COLS = Math.ceil(WORLD_W / GRID_SIZE);
const ROWS = Math.ceil(WORLD_H / GRID_SIZE);
let influenceGrid = [];

function aiDeploy() {
    let currentMoney = enemy.money;
    
    // Geçmiş hafıza (Local Storage) + Şu anki haritadaki Mavi birimler
    let blueCounts = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0 };
    for (const type in playerMeta) blueCounts[type] += playerMeta[type] * 0.4; // %40 Hafıza etkisi
    for (const u of units) {
        if (!u.isRed) blueCounts[u.type] += 1;
    }

    // Ağırlık Sistemi (Genetik Algoritma Counter Geni kullanarak)
    let aiWeights = { 0:1, 1:1, 2:1, 3:1, 4:1, 5:1, 6:1, 7:1, 8:1 };
    
    for (let myType = 0; myType < 9; myType++) {
        for (let enemyType = 0; enemyType < 9; enemyType++) {
            aiWeights[myType] += blueCounts[enemyType] * aiGenome.counterMatrix[enemyType][myType];
        }
    }
    
    const buyUnit = (type, rx, ry) => {
        if (currentMoney >= STATS[type].cost) {
            placeUnit(type, rx, ry, true);
            currentMoney -= STATS[type].cost;
            return true;
        }
        return false;
    };

    let attempts = 0;
    while(currentMoney > 40 && attempts < 100) {
        let bestType = null;
        let maxW = -1;
        for (let t=0; t<9; t++) {
            if (aiWeights[t] > maxW && currentMoney >= STATS[t].cost) {
                maxW = aiWeights[t];
                bestType = t;
            }
        }

        if (bestType !== null) {
            // Genomdan Konum (Deploy) Genlerini Çek
            let xRatio = aiGenome.deployMatrix[bestType][0];
            let yRatio = aiGenome.deployMatrix[bestType][1];
            
            // XRatio 0 ise en ön safha (WORLD_W/2 + 50), 1 ise en arka (WORLD_W - 50)
            let rx = (WORLD_W / 2 + 50) + (xRatio * (WORLD_W / 2 - 100));
            // YRatio 0 ise en üst (0), 1 ise en alt (WORLD_H)
            let ry = yRatio * (WORLD_H - 100) + 50;
            
            // Birliklerin üst üste binip patlamasını (çarpışma) engellemek için hafif rastgelelik (Jitter)
            rx += (Math.random() * 60) - 30;
            ry += (Math.random() * 60) - 30;
            
            buyUnit(bestType, rx, ry);
            aiWeights[bestType] *= 0.5; 
        } else {
            break;
        }
        attempts++;
    }
}

function getNeuralInputs(myArmy, enemyArmy) {
    let inputs = new Array(30).fill(0);
    if (myArmy.length === 0) return inputs;
    
    for(let i=0; i<9; i++) inputs[i] = myArmy.filter(u => u.type === i).length / myArmy.length;
    if (enemyArmy.length > 0) {
        for(let i=0; i<9; i++) inputs[9 + i] = enemyArmy.filter(u => u.type === i).length / enemyArmy.length;
    }
    
    let myHP = 0, myMaxHP = 0, mySpeed = 0, myRange = 0;
    myArmy.forEach(u => { myHP += u.hp; myMaxHP += u.maxHp; mySpeed += STATS[u.type].speed; myRange += STATS[u.type].range; });
    inputs[18] = myHP / Math.max(1, myMaxHP);
    
    let enHP = 0, enMaxHP = 0, enSpeed = 0, enRange = 0;
    if (enemyArmy.length > 0) {
        enemyArmy.forEach(u => { enHP += u.hp; enMaxHP += u.maxHp; enSpeed += STATS[u.type].speed; enRange += STATS[u.type].range; });
        inputs[19] = enHP / Math.max(1, enMaxHP);
    }
    
    let myCx = 0, myCy = 0;
    myArmy.forEach(u => { myCx += u.x; myCy += u.y; });
    myCx /= myArmy.length; myCy /= myArmy.length;
    
    let enCx = 0, enCy = 0;
    if (enemyArmy.length > 0) {
        enemyArmy.forEach(u => { enCx += u.x; enCy += u.y; });
        enCx /= enemyArmy.length; enCy /= enemyArmy.length;
    }
    
    let myVar = 0;
    myArmy.forEach(u => myVar += Math.hypot(u.x - myCx, u.y - myCy));
    inputs[20] = (myVar / myArmy.length) / 500.0;
    
    let enVar = 0;
    if (enemyArmy.length > 0) {
        enemyArmy.forEach(u => enVar += Math.hypot(u.x - enCx, u.y - enCy));
        inputs[21] = (enVar / enemyArmy.length) / 500.0;
    }
    
    inputs[22] = (myArmy.length - enemyArmy.length) / Math.max(1, myArmy.length + enemyArmy.length);
    inputs[23] = enemyArmy.length > 0 ? 1.0 : -1.0;
    inputs[24] = enemyArmy.length > 0 ? Math.hypot(myCx - enCx, myCy - enCy) / 2000.0 : 1.0;
    inputs[25] = enemyArmy.length > 0 ? ((enCy / 1000.0) * 2.0) - 1.0 : 0.0;
    inputs[26] = (myCx / 2000.0);
    
    let cd = 0;
    myArmy.forEach(u => cd += (u.cooldown || 0));
    inputs[27] = (cd / myArmy.length) / 20.0;
    inputs[28] = ((mySpeed / Math.max(1, myArmy.length)) - (enSpeed / Math.max(1, enemyArmy.length))) / 2.0;
    inputs[29] = ((myRange / Math.max(1, myArmy.length)) - (enRange / Math.max(1, enemyArmy.length))) / 500.0;
    
    return inputs;
}

function computeNeuralOutputs(inputs, weights) {
    let outputs = new Array(9).fill(0);
    for(let o=0; o<9; o++) {
        for(let i=0; i<30; i++) outputs[o] += inputs[i] * weights[i][o];
        outputs[o] = Math.max(-4.0, Math.min(4.0, outputs[o])); 
    }
    return outputs;
}

let lastAiTacticTime = 0;
let currentNeuralOutputs = new Array(9).fill(0);
let maneuverLockTime = 0;
function updateAITactics(now) {
    if (now - lastAiTacticTime < 500) return;
    lastAiTacticTime = now;

    const redUnits = units.filter(u => u.isRed && !u.dead);
    if (redUnits.length === 0) return;
    
    const visibleBlueUnits = units.filter(u => !u.isRed && !u.dead && canSee(true, u.x, u.y));
    
    // Taktiksel Kararlılık (Hysteresis) - Neural Outputs kilitleniyor
    if (now > maneuverLockTime) {
        let inputs = getNeuralInputs(redUnits, visibleBlueUnits);
        currentNeuralOutputs = computeNeuralOutputs(inputs, aiGenome.neuralWeights);
        maneuverLockTime = now + 2000; // 2 saniye kilit
    }

    // ETKİ HARİTASI (INFLUENCE MAP) OLUŞTURMA
    influenceGrid = Array.from({length: COLS}, () => new Float32Array(ROWS));
    
    // 1. Görünen Düşmanlar (Mavi)
    for (const bu of units) {
        if (bu.dead || bu.isRed) continue;
        if (!canSee(true, bu.x, bu.y)) continue; // Sadece AI'nin Görebildiği mavi birimler

        const cx = Math.floor(bu.x / GRID_SIZE);
        const cy = Math.floor(bu.y / GRID_SIZE);
        const threat = bu.hp + STATS[bu.type].atk * 10;
        
        for (let ix = -3; ix <= 3; ix++) {
            for (let iy = -3; iy <= 3; iy++) {
                const nx = cx + ix, ny = cy + iy;
                if (nx>=0 && nx<COLS && ny>=0 && ny<ROWS) {
                    const dist = Math.sqrt(ix*ix + iy*iy);
                    if (dist <= 3) {
                        influenceGrid[nx][ny] += threat / (dist + 1); 
                    }
                }
            }
        }
    }
    
    // 2. Saldırıya Uğrayan Dost Birliklerin Yardım Çağrıları (HIVE MIND SOS)
    // Askerler vurulduğunda saldırgan görünmese bile oraya büyük bir tehdit sinyali (işaret fişeği) bırakılır.
    for (const ru of redUnits) {
        if (ru.lastHitTime && now - ru.lastHitTime < 4000) { // Son 4 saniye içinde vurulduysa
            const cx = Math.floor(ru.distressX / GRID_SIZE);
            const cy = Math.floor(ru.distressY / GRID_SIZE);
            const threat = 400; // Yüksek acil durum SOS tehdidi!
            
            for (let ix = -4; ix <= 4; ix++) {
                for (let iy = -4; iy <= 4; iy++) {
                    const nx = cx + ix, ny = cy + iy;
                    if (nx>=0 && nx<COLS && ny>=0 && ny<ROWS) {
                        const dist = Math.sqrt(ix*ix + iy*iy);
                        if (dist <= 4) {
                            influenceGrid[nx][ny] += threat / (dist + 1);
                        }
                    }
                }
            }
        }
    }

    // 3. Dost Gücü Haritası (ALLY MAP) - Sürü Zekası için
    let allyGrid = Array.from({length: COLS}, () => new Float32Array(ROWS));
    for (const ru of redUnits) {
        const cx = Math.floor(ru.x / GRID_SIZE);
        const cy = Math.floor(ru.y / GRID_SIZE);
        const power = ru.hp + STATS[ru.type].atk * 10;
        
        for (let ix = -3; ix <= 3; ix++) {
            for (let iy = -3; iy <= 3; iy++) {
                const nx = cx + ix, ny = cy + iy;
                if (nx>=0 && nx<COLS && ny>=0 && ny<ROWS) {
                    const dist = Math.sqrt(ix*ix + iy*iy);
                    if (dist <= 3) {
                        allyGrid[nx][ny] += power / (dist + 1);
                    }
                }
            }
        }
    }
    

    
    // GLOBAL YARDIM ÇAĞRISI (Açık SOS Varsa Tüm Haritaya Duyur)
    let activeSOS = false;
    let sosX = 0, sosY = 0;
    for (const ru of redUnits) {
        if (ru.lastHitTime && now - ru.lastHitTime < 4000) {
            activeSOS = true;
            sosX = ru.distressX;
            sosY = ru.distressY;
            break; // Sadece ilk SOS hedefini al
        }
    }

    for (const ru of redUnits) {
        // Çatışma mantığı (Unit.engageCombat) zaten AttackTarget ve KITE işlerini hallediyor.
        // Eğer hedefi yoksa, Etki Haritasını (Influence Map) okuyarak hareket et!
        if (ru.attackTarget) continue; 
        
        // LOKAL GÜÇ ANALİZİ (Sürü Zekası)
        const cx = Math.floor(ru.x / GRID_SIZE);
        const cy = Math.floor(ru.y / GRID_SIZE);
        let localEnemyPower = 0;
        let localAllyPower = 0;
        if (cx>=0 && cx<COLS && cy>=0 && cy<ROWS) {
            localEnemyPower = influenceGrid[cx][cy];
            localAllyPower = allyGrid[cx][cy];
        }
        
        let outmatched = (localEnemyPower > localAllyPower * 1.5);
        
        // Eğer canı %30'un altındaysa VEYA Düşman gücü dost gücünün 1.5 katından fazlaysa (Dezavantajlı)
        if (ru.hp < ru.maxHp * 0.3 || outmatched) {
            const medic = redUnits.find(u => u.type === T.MEDIC && u !== ru);
            if (medic) { 
                ru.aiAction = 'FLEE'; 
                ru.targetX = medic.x; 
                ru.targetY = medic.y; 
                continue; 
            }
        }

        ru.aiAction = 'ATTACK';
        
        let bestScore = -Infinity;
        let bestDir = {x: ru.x - 100, y: ru.y}; // Varsayılan: Sola ilerle
        
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
            const lookX = ru.x + Math.cos(angle) * 300;
            const lookY = ru.y + Math.sin(angle) * 300;
            if (lookX < 50 || lookX > WORLD_W - 50 || lookY < 50 || lookY > WORLD_H - 50) continue;
            
            const lx = Math.floor(lookX / GRID_SIZE);
            const ly = Math.floor(lookY / GRID_SIZE);
            const threat = influenceGrid[lx][ly];
            const allyScore = allyGrid[lx][ly]; // Sürü Zekası (Birliktelik puanı)
            
            let score = 0;
            
            // ─── SAF SİNİR AĞI ÇIKTILARI (PURE NEURAL CONTROLLER) ───
            let squad = getSquadRole(ru.type);
            let pushW = 0, threatW = 0, yBias = 0;
            
            if (squad === SQUAD.VANGUARD) {
                pushW = currentNeuralOutputs[0]; threatW = currentNeuralOutputs[1]; yBias = currentNeuralOutputs[2];
            } else if (squad === SQUAD.FLANK) {
                pushW = currentNeuralOutputs[3]; threatW = currentNeuralOutputs[4]; yBias = currentNeuralOutputs[5];
            } else {
                pushW = currentNeuralOutputs[6]; threatW = currentNeuralOutputs[7]; yBias = currentNeuralOutputs[8];
            }
            
            // Kör durumdayken de yayılmaya devam edebilmesi için yBias'a daha fazla etki ver.
            if (visibleBlueUnits.length === 0) {
                yBias *= (ru.y < WORLD_H/2) ? -1 : 1; 
            }
            
            if (outmatched) {
                // Eğer Sağlıkçı yoksa ve outmatched ise, genetiği geçici ezip düşmandan kaçmaya çalışır!
                threatW = -2.0; 
                pushW = -1.0; 
                score += allyScore * 3.0; // Hayatta kalmak için ana orduya doğru (dostların arasına) kaç!
            }
            
            // Sola (Düşman bölgesine) doğru yürüme isteği (Push geni)
            let dx = lookX - ru.x; 
            score += -dx * pushW * 1.5; 
            
            // Y Eksenine Yayılma (Kanat saldırısı, Kıskaç vb.)
            let dy = lookY - ru.y;
            score += dy * yBias * 1.5;
            
            // GLOBAL SÜRÜ MERKEZİ ÇEKİM GÜCÜ
            let distToCenter = Math.hypot(lookX - globalCx, lookY - globalCy);
            score -= distToCenter * 0.5; 
            
            if (visibleBlueUnits.length === 0) {
                score += allyScore * 1.5; 
            }
            
            // GLOBAL YARDIM ÇAĞRISI (SOS) ÇEKİM GÜCÜ
            if (activeSOS && threatW > 0) {
                // Eğer agresif bir birimse, haritanın neresinde olursa olsun yardıma koşar
                let distToSOS = Math.hypot(lookX - sosX, lookY - sosY);
                score -= distToSOS * 1.5; // SOS noktasına yaklaşmak yüksek puan verir
            }
            
            // Tehdide karşı davranış (Threat Seek geni)
            score += threat * threatW * 2.5;

            if (score > bestScore) {
                bestScore = score;
                bestDir = {x: lookX, y: lookY};
            }
        }
        ru.targetX = bestDir.x;
        ru.targetY = bestDir.y;
    }
}

// ─── UI & BUTONLAR ───
({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).querySelectorAll('.spawn-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (phase !== PHASE.DEPLOY) return;
        const type = parseInt(btn.dataset.type);
        if (selectedSpawnType === type) {
            selectedSpawnType = null;
            btn.classList.remove('selected-btn');
            canvas.classList.remove('ghost-cursor');
            return;
        }
        selectedSpawnType = type;
        ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).querySelectorAll('.spawn-btn').forEach(b => b.classList.remove('selected-btn'));
        btn.classList.add('selected-btn');
        canvas.classList.add('ghost-cursor');
    });

    btn.addEventListener('mouseenter', () => {
        const type = parseInt(btn.dataset.type);
        const s = STATS[type];
        const strongNames = s.strong.map(t => STATS[t].name).join(', ') || '-';
        const weakNames = s.weak.map(t => STATS[t].name).join(', ') || '-';
        ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('info-content').innerHTML = `
            <b style="color:#aaddff">${s.name}</b><br>
            ${s.desc}<br><br>
            ❤️ HP: ${s.hp} | ⚔️ ATK: ${s.atk}<br>
            🏃 Hız: ${(s.speed*2).toFixed(2)} | 📏 Menzil: ${s.range}<br>
            👁️ Görüş: ${s.vision} | 🛡️ Zırh: ${s.armor} | 💰 ${s.cost}<br><br>
            <span style="color:#4cff7c">✅ Güçlü: ${strongNames}</span><br>
            <span style="color:#ff6666">❌ Zayıf: ${weakNames}</span>
        `;
    });
    btn.addEventListener('mouseleave', () => {
        ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('info-content').innerHTML = 'Bir birim seç veya üzerine gel';
    });
});

function startBattle() {
    if (phase !== PHASE.DEPLOY) return;
    
    savePlayerMeta(); // Yapay zeka öğrenmesi için oyuncu stratejisini kaydet
    aiDeploy();       // Öğrenilen meta + sahaya göre karşı orduyu bas
    
    phase = PHASE.BATTLE;
    selectedSpawnType = null;
    canvas.classList.remove('ghost-cursor');

    ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('start-btn').classList.add('hidden');
    ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('train-ai-btn').classList.add('hidden');
    ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('phase-text').textContent = '⚔️ SAVAŞ! Sol tık: seç | Sağ tık: komut ver';
    ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('phase-text').style.color = '#ff4444';
    ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('ui-spawn-bar').style.opacity = '0.3';
    ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('ui-spawn-bar').style.pointerEvents = 'none';
    ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('ui-camera-hint').style.display = 'none';

    setTimeout(() => { ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('ui-phase').style.display = 'none'; }, 3000);
}

({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('start-btn').addEventListener('click', () => {
    if (units.filter(u => !u.isRed).length === 0) return;
    startBattle();
});
({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('restart-btn').addEventListener('click', () => location.reload());

// ═══════════════════════════════════════════════════════════════
//  ULTIMATE GENETİK ALGORİTMA (10.000 MAÇLIK 2D UZAYSAL SİMÜLASYON)
// ═══════════════════════════════════════════════════════════════
function cloneMatrix(mat) { return mat.map(row => [...row]); }

function mutateGenome(genome) {
    let newG = {
        counterMatrix: cloneMatrix(genome.counterMatrix),
        deployMatrix: cloneMatrix(genome.deployMatrix),
        neuralWeights: cloneMatrix(genome.neuralWeights)
    };
    
    const mutations = Math.floor(Math.random() * 5) + 1; 
    for(let i=0; i<mutations; i++) {
        let dice = Math.random();
        let r = Math.floor(Math.random() * 9);
        if (dice < 0.33) {
            let c = Math.floor(Math.random() * 9);
            newG.counterMatrix[r][c] += (Math.random() * 1.0) - 0.5;
            newG.counterMatrix[r][c] = Math.max(0.1, newG.counterMatrix[r][c]);
        } else if (dice < 0.66) {
            let c = Math.floor(Math.random() * 2);
            newG.deployMatrix[r][c] += (Math.random() * 0.4) - 0.2; 
            newG.deployMatrix[r][c] = Math.max(0, Math.min(1, newG.deployMatrix[r][c])); 
        } else {
            // Neural Weight Mutasyonu
            let ni = Math.floor(Math.random() * 30);
            let no = Math.floor(Math.random() * 9);
            newG.neuralWeights[ni][no] += (Math.random() * 2.0) - 1.0;
        }
    }
    return newG;
}

function generateMockArmy(money, qMat, enemyCounts) {
    let army = [];
    let weights = [1,1,1,1,1,1,1,1,1];
    for (let myType = 0; myType < 9; myType++) {
        for (let eType = 0; eType < 9; eType++) {
            weights[myType] += enemyCounts[eType] * qMat[eType][myType];
        }
    }
    let m = money;
    let attempts = 0;
    while(m > 40 && attempts < 50) {
        let bestT = null, maxW = -1;
        for (let t=0; t<9; t++) {
            if (weights[t] > maxW && m >= STATS[t].cost) { maxW = weights[t]; bestT = t; }
        }
        if (bestT !== null) {
            army.push({ type: bestT, hp: STATS[bestT].hp, maxHp: STATS[bestT].hp, atk: STATS[bestT].atk, armor: STATS[bestT].armor, speed: STATS[bestT].speed, range: STATS[bestT].range, vision: STATS[bestT].vision });
            m -= STATS[bestT].cost;
            weights[bestT] *= 0.5;
        }
        attempts++;
    }
    return army;
}

const META_ARMIES = [
    [10, 0, 0, 0, 0, 0, 0, 0, 0], // Sadece Piyade
    [0, 0, 0, 0, 0, 0, 7, 0, 0], // Sadece Tank
    [0, 0, 0, 5, 0, 0, 0, 0, 5], // Keşif + Topçu
    [2, 2, 2, 2, 1, 1, 1, 1, 1], // Dengeli
    [0, 0, 0, 0, 0, 0, 4, 7, 0]  // Tank + Tanksavar
];

function simulateSpatialMetaMatch(genome, metaCounts) {
    let myArmy = generateMockArmy(1500, genome.counterMatrix, metaCounts);
    
    // Genomdaki Deploy(Konum) genlerini askere yükle
    myArmy.forEach(u => {
        let xR = genome.deployMatrix[u.type][0];
        let yR = genome.deployMatrix[u.type][1];
        u.x = 2000 + (xR * 800); // Temsili AI Spawn Bölgesi
        u.y = yR * 1000;
        u.cooldown = 0;
    });

    let enemyArmy = [];
    for(let t=0; t<9; t++) {
        for(let i=0; i<metaCounts[t]; i++) {
            // Oyuncu Standart Dizilimi (Rastgele dağılım)
            enemyArmy.push({ 
                type: t, hp: STATS[t].hp, maxHp: STATS[t].hp, atk: STATS[t].atk, armor: STATS[t].armor,
                speed: STATS[t].speed, range: STATS[t].range, vision: STATS[t].vision,
                x: 200 + Math.random()*600, y: Math.random()*1000, cooldown: 0
            });
        }
    }
    
    // 2D Uzaysal Taktik Simülasyonu
    let ticks = 0;
    let simCurrentOutputs = new Array(9).fill(0);
    let simManeuverLockTime = -1;
    
    while(myArmy.length > 0 && enemyArmy.length > 0 && ticks < 400) {
        if (ticks > simManeuverLockTime) {
            let visibleEnemies = enemyArmy.filter(ub => {
                for(const ua of myArmy) {
                    if(Math.hypot(ua.x - ub.x, ua.y - ub.y) <= ua.vision) return true;
                }
                return false;
            });
            let inputs = getNeuralInputs(myArmy, visibleEnemies);
            simCurrentOutputs = computeNeuralOutputs(inputs, genome.neuralWeights);
            simManeuverLockTime = ticks + 40; // ~2 saniye kilit
        }

        // 1. YAPAY ZEKA (MY ARMY) HARAKET VE SALDIRISI (GENETİK TAKTİK İLE)
        for (const ua of myArmy) {
            if(ua.cooldown > 0) ua.cooldown--;
            
            let squad = getSquadRole(ua.type);
            ua.pushW = 0; ua.threatW = 0; ua.yBias = 0;
            
            if (squad === SQUAD.VANGUARD) {
                ua.pushW = simCurrentOutputs[0]; ua.threatW = simCurrentOutputs[1]; ua.yBias = simCurrentOutputs[2];
            } else if (squad === SQUAD.FLANK) {
                ua.pushW = simCurrentOutputs[3]; ua.threatW = simCurrentOutputs[4]; ua.yBias = simCurrentOutputs[5];
            } else {
                ua.pushW = simCurrentOutputs[6]; ua.threatW = simCurrentOutputs[7]; ua.yBias = simCurrentOutputs[8];
            }
            
            // Eğer körse ve yBias çıktıysa, köşelere açılmasını güçlendir.
            if (simCurrentOutputs[0] === 0) { // Sadece küçük bir hack, eğer tüm ağ sıfırsa bile hareket etsin
               // Görüş durumunda simCurrentOutputs zaten bunu halledecek.
            }
            
            // Sağlıkçılar (Medic) Simülasyonu - Dostları İyileştirir
            if (ua.type === T.MEDIC && ua.cooldown <= 0) {
                let lowestHpAlly = null; let lowestRatio = 1.0;
                for(const ally of myArmy) {
                    if (ally === ua) continue;
                    let d = Math.hypot(ua.x - ally.x, ua.y - ally.y);
                    let ratio = ally.hp / ally.maxHp;
                    if (d <= ua.range && ratio < 1.0 && ratio < lowestRatio) {
                        lowestRatio = ratio; lowestHpAlly = ally;
                    }
                }
                if (lowestHpAlly) {
                    lowestHpAlly.hp = Math.min(lowestHpAlly.maxHp, lowestHpAlly.hp + 18);
                    ua.cooldown = 15;
                }
            }
            
            // Lokal Güç Analizi (Sürü Zekası) Simülasyonu
            let localAllyPower = ua.hp + STATS[ua.type].atk * 10;
            let nearestMedic = null;
            let medicDist = 99999;
            for(const ally of myArmy) {
                if (ally === ua) continue;
                let d = Math.hypot(ua.x - ally.x, ua.y - ally.y);
                if (d < 300) localAllyPower += ally.hp + STATS[ally.type].atk * 10;
                if (ally.type === T.MEDIC) {
                    if (d < medicDist) { medicDist = d; nearestMedic = ally; }
                }
            }
            
            let localEnemyPower = 0;
            let nearestEnemy = null, minDist = 999999;
            for(const tb of enemyArmy) {
                let d = Math.hypot(ua.x - tb.x, ua.y - tb.y);
                if (d < 300 && d <= ua.vision) localEnemyPower += tb.hp + STATS[tb.type].atk * 10;
                // Düşmanı sadece görüş menziline girerse hedef alabilir
                if (d < minDist && d <= ua.vision) { minDist = d; nearestEnemy = tb; }
            }
            
            let outmatched = (localEnemyPower > localAllyPower * 1.5);
            
            if (outmatched && nearestMedic && ua.type !== T.MEDIC) {
                // Dezavantajlı durumda savaşmak yerine Medic'e koş (Seçenek A)
                let dx = nearestMedic.x - ua.x;
                let dy = nearestMedic.y - ua.y;
                let len = Math.max(1, Math.hypot(dx, dy));
                ua.x += (dx / len) * ua.speed * 15.0;
                ua.y += (dy / len) * ua.speed * 15.0;
                continue; // Çatışma kodunu atla
            }
            
            if (nearestEnemy && ua.type !== T.MEDIC) {
                if (minDist <= ua.range) {
                    if (ua.cooldown <= 0) {
                        let dmg = ua.atk;
                        if (STATS[ua.type].strong.includes(nearestEnemy.type)) dmg *= 1.5;
                        if (STATS[ua.type].weak.includes(nearestEnemy.type)) dmg *= 0.5;
                        if (ua.type === T.ANTI_TANK && (nearestEnemy.type === T.ARMOR || nearestEnemy.type === T.MECH_INFANTRY)) dmg *= 2.5;
                        dmg = Math.max(1, dmg - nearestEnemy.armor);
                        nearestEnemy.hp -= dmg;
                        ua.cooldown = 15;
                    }
                } else {
                    // Genetik Taktik Algoritması (Uzayda Hareket)
                    let vx = -ua.pushW * 5; // Düşman base'ine gitme isteği
                    let vy = 0;
                    
                    if (outmatched) {
                        ua.pushW = -1.0;
                        ua.threatW = -2.0;
                        vx = -ua.pushW * 5;
                    }
                    
                    let dx = nearestEnemy.x - ua.x;
                    let dy = nearestEnemy.y - ua.y;
                    let len = Math.max(1, Math.hypot(dx, dy));
                    // Tehdide(Düşmana) git veya uzaklaş (threatW)
                    vx += (dx / len) * ua.threatW * 5;
                    vy += (dy / len) * ua.threatW * 5;
                    
                    // Y Eksenine Yayılma (Kanat vb.)
                    vy += ua.yBias * 5;
                    
                    let vlen = Math.hypot(vx, vy);
                    if (vlen > 0) {
                        ua.x += (vx / vlen) * ua.speed * 15.0; // simülasyon hızı
                        ua.y += (vy / vlen) * ua.speed * 15.0;
                    }
                }
            } else {
                // SAVAŞ SİSİ MODU (Arama / Search Modu)
                // Hiçbir düşman göremiyor. Tamamen sola (oyuncunun yerine) ve PushW genine göre ilerle
                let vx = -ua.pushW * 5 - 10; // "-10" sola doğru sistematik ilerlemeyi garanti eder
                let vy = ua.yBias * 5; // Formasyonu koru
                let vlen = Math.hypot(vx, vy);
                if (vlen > 0) {
                    ua.x += (vx / vlen) * ua.speed * 15.0;
                    ua.y += (vy / vlen) * ua.speed * 15.0;
                }
            }
        }
        enemyArmy = enemyArmy.filter(u => u.hp > 0);
        if (enemyArmy.length === 0) break;
        
        // 2. OYUNCU (ENEMY ARMY) HARAKET VE SALDIRISI (STANDARD TAKTİK İLE)
        for (const ub of enemyArmy) {
            if(ub.cooldown > 0) ub.cooldown--;
            
            if (ub.type === T.MEDIC && ub.cooldown <= 0) {
                let lowestHpAlly = null; let lowestRatio = 1.0;
                for(const ally of enemyArmy) {
                    if (ally === ub) continue;
                    let d = Math.hypot(ub.x - ally.x, ub.y - ally.y);
                    let ratio = ally.hp / ally.maxHp;
                    if (d <= ub.range && ratio < 1.0 && ratio < lowestRatio) {
                        lowestRatio = ratio; lowestHpAlly = ally;
                    }
                }
                if (lowestHpAlly) {
                    lowestHpAlly.hp = Math.min(lowestHpAlly.maxHp, lowestHpAlly.hp + 18);
                    ub.cooldown = 15;
                }
            }
            
            let nearestAI = null, minDist = 999999;
            for(const ta of myArmy) {
                let d = Math.hypot(ub.x - ta.x, ub.y - ta.y);
                if (d < minDist) { minDist = d; nearestAI = ta; }
            }
            
            if (nearestAI && ub.type !== T.MEDIC) {
                if (minDist <= ub.range) {
                    if (ub.cooldown <= 0) {
                        let dmg = ub.atk;
                        if (STATS[ub.type].strong.includes(nearestAI.type)) dmg *= 1.5;
                        if (STATS[ub.type].weak.includes(nearestAI.type)) dmg *= 0.5;
                        if (ub.type === T.ANTI_TANK && (nearestAI.type === T.ARMOR || nearestAI.type === T.MECH_INFANTRY)) dmg *= 2.5;
                        dmg = Math.max(1, dmg - nearestAI.armor);
                        nearestAI.hp -= dmg;
                        ub.cooldown = 15;
                    }
                } else {
                    // Oyuncu Standart Davranış (Direkt Düşmana Yürü)
                    let dx = nearestAI.x - ub.x;
                    let dy = nearestAI.y - ub.y;
                    let len = Math.max(1, Math.hypot(dx, dy));
                    ub.x += (dx / len) * ub.speed * 15.0;
                    ub.y += (dy / len) * ub.speed * 15.0;
                }
            }
        }
        myArmy = myArmy.filter(u => u.hp > 0);
        ticks++;
    }
    
    // FITNESS FUNCTION: Düşmanı ÖLDÜRMEYE BÜYÜK ÖDÜL! (Aggressive hunting)
    let initialEnemyScore = 0;
    metaCounts.forEach((c, t) => initialEnemyScore += c * STATS[t].cost);
    
    let survivingEnemyScore = enemyArmy.reduce((sum, u) => sum + (u.hp / u.maxHp) * STATS[u.type].cost, 0);
    let survivingAiScore = myArmy.reduce((sum, u) => sum + (u.hp / u.maxHp) * STATS[u.type].cost, 0);
    
    let score = ((initialEnemyScore - survivingEnemyScore) * 3.0) + survivingAiScore;
    return score; 
}

function evaluateGenome(genome) {
    let totalScore = 0;
    for (const enemyCounts of META_ARMIES) {
        totalScore += simulateSpatialMetaMatch(genome, enemyCounts);
    }
    return totalScore;
}

({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('train-ai-btn').addEventListener('click', () => {
    // Arayüz metnini güncelle (2.000 maç vurgusu)
    ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('train-ai-btn').textContent = "🧠 AI Eğit (2.000 Maç)";
    ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('ai-training-screen').classList.remove('hidden');
    let epoch = 0;
    const TOTAL_EPOCHS = 2000;
    
    function runBatch() {
        for(let i=0; i<30; i++) { // Batch size 30 for faster processing
            if (epoch >= TOTAL_EPOCHS) break;
            
            let mutatedGenome = mutateGenome(aiGenome);
            
            let scoreCurrent = evaluateGenome(aiGenome);
            let scoreMutant = evaluateGenome(mutatedGenome);
            
            if (scoreMutant > scoreCurrent) {
                aiGenome = mutatedGenome;
            }
            epoch++;
        }
        
        const pct = (epoch / TOTAL_EPOCHS) * 100;
        ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('train-progress-bar').style.width = pct + '%';
        ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('train-progress-text').textContent = `%${pct.toFixed(1)} (${epoch} / ${TOTAL_EPOCHS})`;
        
        if (epoch < TOTAL_EPOCHS) {
            requestAnimationFrame(runBatch);
        } else {
            ({getItem:()=>null, setItem:()=>{}}).setItem(GENOME_KEY, JSON.stringify(aiGenome));
            setTimeout(() => {
                ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('ai-training-screen').classList.add('hidden');
                alert("2.000 Maçlık Taktiksel Evrim Tamamlandı! \n\nYapay zeka sadece karşı-birlik üretmeyi değil, savaş alanında kusursuz dizilişi ve konumlanma taktiklerini de öğrendi!");
            }, 500);
        }
    }
    
    requestAnimationFrame(runBatch);
});

minimapCanvas.addEventListener('click', (e) => {
    const rect = minimapCanvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    camera.x = mx * WORLD_W - (canvas.width / zoom) / 2;
    camera.y = my * WORLD_H - (canvas.height / zoom) / 2;
});

function checkGameOver() {
    if (phase !== PHASE.BATTLE) return;
    const blueAlive = units.some(u => !u.dead && !u.isRed);
    const redAlive = units.some(u => !u.dead && u.isRed);

    let won = null;
    if (!blueAlive && !redAlive) won = 'draw';
    else if (!blueAlive) won = false;
    else if (!redAlive) won = true;
    else return;

    phase = PHASE.OVER;
    const title = ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('game-over-title');
    if (won === 'draw') { title.textContent = '🤝 BERABERE!'; title.style.color = '#ffaa00'; }
    else if (won) { title.textContent = '🏆 ZAFER!'; title.style.color = '#4cff7c'; }
    else { title.textContent = '💀 YENİLDİN!'; title.style.color = '#ff4444'; }

    ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('score-table').innerHTML = `
        <div class="score-row"><span>Sonuç</span><span class="score-val">${won === 'draw' ? 'Berabere' : won ? 'Kazandın' : 'Kaybettin'}</span></div>
        <div class="score-row"><span>Öldürdüğün Düşman</span><span class="score-val">${player.kills}</span></div>
        <div class="score-row"><span>Ürettiğin Birim</span><span class="score-val">${player.unitsSpawned}</span></div>
        <div class="score-row"><span>Kaybettiğin Birim</span><span class="score-val">${enemy.kills}</span></div>
    `;
    ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('game-over-screen').classList.remove('hidden');
}

function updateUI() {
    ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('money').textContent = Math.floor(player.money);
    if (phase === PHASE.DEPLOY) {
        ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).querySelectorAll('.spawn-btn').forEach(btn => {
            const type = parseInt(btn.dataset.type);
            btn.classList.toggle('disabled', player.money < STATS[type].cost);
        });
    }

    if (phase === PHASE.BATTLE) {
        const sel = units.filter(u => u.selected && !u.isRed && !u.dead);
        if (sel.length === 1) {
            const u = sel[0];
            const s = STATS[u.type];
            ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('info-content').innerHTML = `
                <b style="color:#aaddff">${s.name}</b><br>
                ❤️ ${Math.floor(u.hp)}/${u.maxHp} | 🛡️ ${u.armor}<br>
                ⚔️ ATK: ${u.atk} | 📏 ${u.range}<br>
                👁️ ${s.vision} | ${u.attackTarget ? '<span style="color:#ff6666">Saldırıyor!</span>' : '<span style="color:#888">Bekleme</span>'}
            `;
        } else if (sel.length > 1) {
            ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).getElementById('info-content').innerHTML = `<b style="color:#aaddff">${sel.length} birim seçili</b><br>Sağ tık: hareket / saldır`;
        }
    }
}

// ─── ÇİZİM VE SAVAŞ SİSİ (Fog of War) ───
function drawMap() {
    ctx.fillStyle = '#3a5f3a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(0,0,0,0.07)';
    ctx.lineWidth = 1;
    const gridSize = 60;
    const startGX = Math.floor(camera.x / gridSize) * gridSize;
    const startGY = Math.floor(camera.y / gridSize) * gridSize;
    const viewW = canvas.width / zoom;
    const viewH = canvas.height / zoom;
    
    for (let gx = startGX; gx < camera.x + viewW; gx += gridSize) {
        const sx = (gx - camera.x) * zoom;
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, canvas.height); ctx.stroke();
    }
    for (let gy = startGY; gy < camera.y + viewH; gy += gridSize) {
        const sy = (gy - camera.y) * zoom;
        ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(canvas.width, sy); ctx.stroke();
    }

    for (const t of terrainFeatures) {
        const s = worldToScreen(t.x, t.y);
        if (s.x < -t.r * zoom || s.x > canvas.width + t.r * zoom || s.y < -t.r * zoom || s.y > canvas.height + t.r * zoom) continue;

        if (t.type === TERRAIN.FOREST) {
            ctx.fillStyle = 'rgba(20, 80, 20, 0.35)';
            ctx.beginPath(); ctx.arc(s.x, s.y, t.r * zoom, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(30, 100, 30, 0.6)';
            ctx.font = `${20 * zoom}px Arial`;
            ctx.fillText('🌲', s.x - 10*zoom, s.y); ctx.fillText('🌲', s.x + 20*zoom, s.y - 15*zoom); ctx.fillText('🌲', s.x - 20*zoom, s.y + 20*zoom);
        } else if (t.type === TERRAIN.MOUNTAIN) {
            ctx.fillStyle = '#4a4a4a';
            ctx.beginPath(); ctx.arc(s.x, s.y, t.r * zoom, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#222'; ctx.lineWidth = 2 * zoom; ctx.stroke();
            ctx.fillStyle = '#888'; ctx.font = `${30 * zoom}px Arial`; ctx.fillText('⛰️', s.x, s.y + 10*zoom);
        }
    }

    if (phase === PHASE.DEPLOY) {
        const ls = worldToScreen(50, 0); const le = worldToScreen(WORLD_W / 2 - 50, WORLD_H);
        ctx.fillStyle = 'rgba(40, 100, 255, 0.06)'; ctx.fillRect(ls.x, ls.y, le.x - ls.x, le.y - ls.y);
        ctx.strokeStyle = 'rgba(80, 160, 255, 0.25)'; ctx.lineWidth = 2; ctx.setLineDash([10, 6]); ctx.strokeRect(ls.x, ls.y, le.x - ls.x, le.y - ls.y);

        const rs = worldToScreen(WORLD_W / 2 + 50, 0); const re = worldToScreen(WORLD_W - 50, WORLD_H);
        ctx.fillStyle = 'rgba(255, 40, 40, 0.05)'; ctx.strokeRect(rs.x, rs.y, re.x - rs.x, re.y - rs.y);
        ctx.setLineDash([]);
    }

    const midS = worldToScreen(WORLD_W / 2, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(midS.x, 0); ctx.lineTo(midS.x, canvas.height); ctx.stroke(); ctx.setLineDash([]);
}

function drawFogOfWar() {
    // Savaş öncesi kendi base'ini aydınlat
    fogCtx.globalCompositeOperation = 'source-over';
    fogCtx.fillStyle = 'rgba(10, 15, 10, 0.95)';
    fogCtx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);

    fogCtx.globalCompositeOperation = 'destination-out';
    
    // Deploy phase: Base vision
    if (phase === PHASE.DEPLOY) {
        const baseView = worldToScreen(WORLD_W * 0.2, WORLD_H / 2);
        const grad = fogCtx.createRadialGradient(baseView.x, baseView.y, 100, baseView.x, baseView.y, 1200 * zoom);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        fogCtx.fillStyle = grad;
        fogCtx.beginPath();
        fogCtx.arc(baseView.x, baseView.y, 1200 * zoom, 0, Math.PI * 2);
        fogCtx.fill();
    }

    for (const u of units) {
        if (u.dead || u.isRed) continue;
        const s = worldToScreen(u.x, u.y);
        const vRadius = STATS[u.type].vision * zoom;
        
        if (s.x < -vRadius || s.x > canvas.width + vRadius || s.y < -vRadius || s.y > canvas.height + vRadius) continue;

        const grad = fogCtx.createRadialGradient(s.x, s.y, vRadius * 0.4, s.x, s.y, vRadius);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        
        fogCtx.fillStyle = grad;
        fogCtx.beginPath();
        fogCtx.arc(s.x, s.y, vRadius, 0, Math.PI * 2);
        fogCtx.fill();
    }
    
    ctx.drawImage(fogCanvas, 0, 0);
}

function drawGhost() {
    if (phase !== PHASE.DEPLOY || selectedSpawnType === null || mouseScreenY > canvas.height - 110) return;
    const world = screenToWorld(mouseScreenX, mouseScreenY);
    if (!isInPlayerZone(world.x)) return;

    const dw = drawW(), dh = drawH();
    ctx.globalAlpha = 0.45;
    const sx = SP_PAD + selectedSpawnType * (SP_W + SP_PAD);
    ctx.drawImage(spriteSheet, sx, SP_PAD, SP_W, SP_H, mouseScreenX - dw / 2, mouseScreenY - dh / 2, dw, dh);
    ctx.globalAlpha = 1.0;

    const range = STATS[selectedSpawnType].range;
    ctx.strokeStyle = 'rgba(0, 255, 120, 0.15)'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.arc(mouseScreenX, mouseScreenY, range * zoom, 0, Math.PI * 2); ctx.stroke();
    
    // Vision preview
    const vision = STATS[selectedSpawnType].vision;
    ctx.strokeStyle = 'rgba(255, 255, 200, 0.1)'; ctx.lineWidth = 1; ctx.setLineDash([2, 8]);
    ctx.beginPath(); ctx.arc(mouseScreenX, mouseScreenY, vision * zoom, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
}

function drawSelectionBox() {
    if (!isDragging || phase !== PHASE.BATTLE) return;
    ctx.strokeStyle = 'rgba(0, 255, 80, 0.5)'; ctx.fillStyle = 'rgba(0, 255, 80, 0.08)'; ctx.lineWidth = 1;
    ctx.fillRect(dragStartX, dragStartY, mouseScreenX - dragStartX, mouseScreenY - dragStartY);
    ctx.strokeRect(dragStartX, dragStartY, mouseScreenX - dragStartX, mouseScreenY - dragStartY);
}

function drawMinimap() {
    const mw = minimapCanvas.width = 200;
    const mh = minimapCanvas.height = 110;
    minimapCtx.fillStyle = '#1a221a';
    minimapCtx.fillRect(0, 0, mw, mh);

    minimapCtx.strokeStyle = 'rgba(255,255,255,0.2)'; minimapCtx.lineWidth = 1;
    minimapCtx.beginPath(); minimapCtx.moveTo(mw / 2, 0); minimapCtx.lineTo(mw / 2, mh); minimapCtx.stroke();

    for (const u of units) {
        if (u.dead) continue;
        // Düşman sis içindeyse minimap'te de gözükmez
        if (u.isRed && phase === PHASE.BATTLE && !canSee(false, u.x, u.y)) continue;
        
        const mx = (u.x / WORLD_W) * mw, my = (u.y / WORLD_H) * mh;
        minimapCtx.fillStyle = u.isRed ? '#ff4444' : '#4488ff';
        minimapCtx.fillRect(mx - 1.5, my - 1.5, 3, 3);
    }

    const vx = (camera.x / WORLD_W) * mw, vy = (camera.y / WORLD_H) * mh;
    const vw = ((canvas.width / zoom) / WORLD_W) * mw, vh = (((canvas.height - 100) / zoom) / WORLD_H) * mh;
    minimapCtx.strokeStyle = 'rgba(255,255,255,0.5)'; minimapCtx.lineWidth = 1;
    minimapCtx.strokeRect(vx, vy, vw, vh);
}

spriteSheet.addEventListener('load', () => {
    ({getElementById:()=>({addEventListener:()=>{}, classList:{add:()=>{}, remove:()=>{}}, style:{}}), querySelectorAll:()=>[]}).querySelectorAll('.btn-icon').forEach(c => {
        const col = parseInt(c.dataset.col);
        c.width = 44; c.height = 32;
        const bctx = c.getContext('2d');
        bctx.imageSmoothingEnabled = false;
        bctx.drawImage(spriteSheet, SP_PAD + col * (SP_W + SP_PAD), SP_PAD, SP_W, SP_H, 0, 0, 44, 32);
    });
});

let lastFrameTime = 0;
function gameLoop(timestamp) {
    if (!lastFrameTime) lastFrameTime = timestamp;
    const dt = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    updateCamera();

    if (phase === PHASE.BATTLE) {
        gameTime += dt / 1000;
        for (let i = units.length - 1; i >= 0; i--) { if (units[i].dead) units.splice(i, 1); }
        units.forEach(u => u.update(timestamp));
        resolveCollisions();
        updateAITactics(timestamp);
        checkGameOver();
    } else if (phase === PHASE.DEPLOY) {
        resolveCollisions();
    }

    drawMap();
    units.forEach(u => u.draw());
    drawFogOfWar();
    drawGhost();
    drawSelectionBox();
    drawMinimap();
    updateUI();

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);


// Run evaluation
console.log(evaluateGenome(aiGenome));