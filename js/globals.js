// ═══════════════════════════════════════════════════════════════
//  PIXEL RTS – TAKTİKSEL SAVAŞ (Öğrenen AI, Savaş Sisi, Etki Haritası)
// ═══════════════════════════════════════════════════════════════
window.onerror = function(msg, url, lineNo, columnNo, error) {
    const errDiv = document.createElement('div');
    errDiv.style.position = 'absolute';
    errDiv.style.top = '50px';
    errDiv.style.left = '50px';
    errDiv.style.color = 'red';
    errDiv.style.fontSize = '24px';
    errDiv.style.zIndex = '999999';
    errDiv.style.background = 'black';
    errDiv.style.padding = '20px';
    errDiv.innerText = "ERROR: " + msg + " at line " + lineNo + "\n" + (error ? error.stack : "");
    document.body.appendChild(errDiv);
    return false;
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const spriteSheet = document.getElementById('spriteSheet');
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas.getContext('2d');

const fogCanvas = document.createElement('canvas');
const fogCtx = fogCanvas.getContext('2d');

let isCameraInitialized = false;
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    fogCanvas.width = canvas.width;
    fogCanvas.height = canvas.height;
    
    if (!isCameraInitialized && canvas.width > 0 && canvas.height > 0) {
        camera.x = WORLD_W / 2 - canvas.width / 2;
        camera.y = WORLD_H - canvas.height;
        isCameraInitialized = true;
    }
}
window.addEventListener('resize', resize);

const WORLD_W = 1600;
const WORLD_H = 3200;

const TERRAIN = { NONE: 0, FOREST: 1, MOUNTAIN: 2 };
const terrainFeatures = [
    { x: WORLD_W/2, y: WORLD_H/2, r: 160, type: TERRAIN.MOUNTAIN },
    { x: WORLD_W/2 - 350, y: WORLD_H/2, r: 120, type: TERRAIN.MOUNTAIN },
    { x: WORLD_W/2 + 350, y: WORLD_H/2, r: 120, type: TERRAIN.MOUNTAIN },
    { x: WORLD_W/2, y: WORLD_H/2 - 600, r: 220, type: TERRAIN.FOREST },
    { x: WORLD_W/2, y: WORLD_H/2 + 600, r: 220, type: TERRAIN.FOREST },
    { x: WORLD_W/2 - 350, y: WORLD_H/2 - 400, r: 220, type: TERRAIN.FOREST },
    { x: WORLD_W/2 + 350, y: WORLD_H/2 + 400, r: 220, type: TERRAIN.FOREST }
];

// Ormanlar için ağaçları önceden hesapla (Performans ve Görsellik)
for (const t of terrainFeatures) {
    if (t.type === TERRAIN.FOREST) {
        t.trees = [];
        const treeCount = Math.floor((t.r * t.r) / 80); // Çok daha yoğun orman (300'den 80'e düşürüldü)
        for(let i=0; i<treeCount; i++) {
            let a = Math.random() * Math.PI * 2;
            let d = Math.random() * t.r * 0.95;
            t.trees.push({
                x: t.x + Math.cos(a) * d,
                y: t.y + Math.sin(a) * d,
                r: 10 + Math.random() * 20, // Ağaç boyutları varyasyonu
                color: Math.random() > 0.6 ? '#163816' : (Math.random() > 0.5 ? '#1a4c1a' : '#225522'), // Gerçekçi ağaç renkleri
                offset: Math.random() * Math.PI * 2
            });
        }
        // Daha doğal görünüm için ağaçları y koordinatına göre sırala
        t.trees.sort((a,b) => a.y - b.y);
    }
}

const camera = { x: 0, y: 0 };
let zoom = 1.0;
const ZOOM_MIN = 0.35;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.08;
const CAM_SPEED = 8;
const EDGE_SCROLL_ZONE = 40;
const keys = {};

let screenShake = 0;
function triggerScreenShake(amount) {
    screenShake = amount;
}

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
function worldToScreen(wx, wy) {
    let shakeX = 0, shakeY = 0;
    if (screenShake > 0) {
        shakeX = (Math.random() - 0.5) * screenShake;
        shakeY = (Math.random() - 0.5) * screenShake;
    }
    return {
        x: (wx - camera.x) * zoom + shakeX,
        y: (wy - camera.y) * zoom + shakeY
    };
}

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

const SQUAD = { VANGUARD: 0, FLANK: 1, SUPPORT: 2 };
function getSquadRole(type) {
    if ([T.RECON, T.ARMOR_INFANTRY, T.MECH_INFANTRY].includes(type)) return SQUAD.FLANK;
    if ([T.ARTILLERY, T.ANTI_TANK, T.MEDIC].includes(type)) return SQUAD.SUPPORT;
    return SQUAD.VANGUARD;
}

// Vision stat added for Fog of War

const STATS = {
    [T.INFANTRY]: { hp: 200, atk: 14, speed: 0.72, range: 110, vision: 350, atkSpeed: 850, armor: 0, cost: 50, maxAmmo: 60, name: 'Piyade', desc: 'Çok yönlü ana hat askeri', strong: [T.ENGINEER, T.MEDIC, T.ANTI_TANK], weak: [T.ARMOR, T.ARTILLERY, T.ARMOR_INFANTRY] },
    [T.MECH_INFANTRY]: { hp: 240, atk: 16, speed: 1.20, range: 120, vision: 400, atkSpeed: 780, armor: 1, cost: 80, maxAmmo: 100, name: 'Mekanize', desc: 'Zırhlı personel taşıyıcıda hızlı piyade', strong: [T.INFANTRY, T.RECON, T.ENGINEER], weak: [T.ARMOR, T.ANTI_TANK, T.ARTILLERY] },
    [T.ARMOR_INFANTRY]: { hp: 360, atk: 11, speed: 0.52, range: 100, vision: 250, atkSpeed: 950, armor: 3, cost: 100, maxAmmo: 40, name: 'Zırhlı Piy.', desc: 'Ağır zırhlı, çok yavaş, dayanıklı duvar', strong: [T.INFANTRY, T.MECH_INFANTRY, T.RECON], weak: [T.ARTILLERY, T.ARMOR, T.ANTI_TANK] },
    [T.RECON]: { hp: 110, atk: 8, speed: 1.80, range: 130, vision: 800, atkSpeed: 650, armor: 0, cost: 40, maxAmmo: 30, name: 'Keşif', desc: 'Sisin içini aydınlatan geniş görüşlü birim', strong: [T.ARTILLERY, T.MEDIC, T.ENGINEER], weak: [T.INFANTRY, T.MECH_INFANTRY, T.ARMOR_INFANTRY, T.ARMOR, T.ANTI_TANK] },
    [T.ENGINEER]: { hp: 180, atk: 6, speed: 0.60, range: 80, vision: 300, atkSpeed: 1100, armor: 0, cost: 60, maxAmmo: 20, name: 'İstihkam', desc: 'Yakın dostlara +2 zırh bonusu verir', strong: [], weak: [T.INFANTRY, T.RECON, T.MECH_INFANTRY, T.ARMOR] },
    [T.MEDIC]: { hp: 90, atk: 0, speed: 0.80, range: 90, vision: 300, atkSpeed: 1000, armor: 0, cost: 70, maxAmmo: 0, name: 'Sağlıkçı', desc: 'Silahsız, dost birimleri iyileştirir', strong: [], weak: [T.INFANTRY, T.RECON, T.MECH_INFANTRY, T.ARMOR, T.ANTI_TANK, T.ARTILLERY] },
    [T.ARMOR]: { hp: 600, atk: 35, speed: 0.64, range: 275, vision: 400, atkSpeed: 1600, armor: 8, cost: 200, maxAmmo: 15, name: 'Tank', desc: 'Ana Muharebe Tankı. Küçük silahlar etkisiz', strong: [T.INFANTRY, T.MECH_INFANTRY, T.ARMOR_INFANTRY, T.RECON, T.ENGINEER, T.MEDIC], weak: [T.ANTI_TANK, T.ARTILLERY] },
    [T.ANTI_TANK]: { hp: 150, atk: 12, speed: 0.60, range: 160, vision: 350, atkSpeed: 1400, armor: 0, cost: 100, maxAmmo: 8, name: 'Tanksavar', desc: 'Zırhlılara x2.5 hasar, piyadeden kaçar', strong: [T.ARMOR, T.MECH_INFANTRY, T.ARMOR_INFANTRY], weak: [T.INFANTRY, T.RECON, T.ARTILLERY] },
    [T.ARTILLERY]: { hp: 130, atk: 40, speed: 0.36, range: 350, vision: 300, atkSpeed: 2800, armor: 0, cost: 150, maxAmmo: 10, name: 'Topçu', desc: 'Uzak menzil. Görüş için Keşif araçlarına muhtaçtır!', strong: [T.INFANTRY, T.MECH_INFANTRY, T.ARMOR_INFANTRY, T.ARMOR], weak: [T.RECON] },
};

const AT_ARMOR_MULTIPLIER = 2.5;
const PHASE = { DEPLOY: 'deploy', BATTLE: 'battle', OVER: 'over' };
let phase = PHASE.DEPLOY;
let gameTime = 0;

const player = { money: 1500, kills: 0, unitsSpawned: 0 };
const enemy = { money: 1500, kills: 0, unitsSpawned: 0 };

const units = [];
const trenches = [];
const craters = [];
const decals = []; // { x, y, type, size, alpha, angle }

let mouseScreenX = 500, mouseScreenY = 500;
let isDragging = false;
let dragStartX = 0, dragStartY = 0;
let selectedSpawnType = null;
let screenShake = 0;

// ─── LOCAL STORAGE (Öğrenen AI) ───
const MEMORY_KEY = 'pixelRtsMemory';
const GENOME_KEY = 'pixelRtsGenome';
let playerMeta = {};
let aiGenome = null;

try {
    playerMeta = JSON.parse(localStorage.getItem(MEMORY_KEY)) || {};
    aiGenome = JSON.parse(localStorage.getItem(GENOME_KEY));
} catch (e) {
    console.warn("LocalStorage access denied, using memory only.");
}

if (!aiGenome || !aiGenome.deployMatrix || aiGenome.deployMatrix.length !== 9 || !aiGenome.counterMatrix || aiGenome.counterMatrix.length !== 9) {
    aiGenome = {
        counterMatrix: [],
        deployMatrix: []
    };
    for(let i=0; i<9; i++) {
        aiGenome.counterMatrix[i] = [1,1,1,1,1,1,1,1,1];
        aiGenome.deployMatrix[i] = [Math.random(), Math.random()];
    }
    try {
        localStorage.setItem(GENOME_KEY, JSON.stringify(aiGenome));
    } catch(e) {}
}

let battlePhase = 1; // 1: Advance (Formasyon Yürüyüşü), 2: Clash (Çatışma), 3: Flank (Kuşatma)
let aiDoctrine = 1; // 1: Ağır Örs, 2: Zırhlı Çekiç

function savePlayerMeta() {
    for (const u of units) {
        if (!u.isRed) {
            playerMeta[u.type] = (playerMeta[u.type] || 0) + 1;
        }
    }
    try {
        localStorage.setItem(MEMORY_KEY, JSON.stringify(playerMeta));
    } catch (e) {}
}

// ─── SAVAŞ SİSİ KONTROLÜ (Team Vision) ───
function canSee(teamIsRed, targetX, targetY) {
    for (const u of units) {
        if (u.dead || u.isRed !== teamIsRed) continue;
        if (Math.hypot(u.x - targetX, u.y - targetY) <= STATS[u.type].vision) return true;
    }
    // Kendi güvenli üssünü her zaman görebilir
    if (!teamIsRed && targetY > WORLD_H * 0.7) return true; 
    if (teamIsRed && targetY < WORLD_H * 0.3) return true;
    return false;
}

function isInPlayerZone(worldX, worldY) {
    // Oyuncu artık Güney'de (Haritanın alt kısmında) yerleşecek.
    return worldY > (WORLD_H * 0.6);
}

// ─── UZAYSAL IZGARA (SPATIAL HASH GRID) ───
class SpatialGrid {
    constructor(width, height, cellSize) {
        this.cellSize = cellSize;
        this.cols = Math.ceil(width / cellSize);
        this.rows = Math.ceil(height / cellSize);
        this.cells = new Array(this.cols * this.rows).fill(null).map(() => []);
    }
    
    clear() {
        for(let i = 0; i < this.cells.length; i++) this.cells[i].length = 0;
    }
    
    insert(unit) {
        let cx = Math.floor(unit.x / this.cellSize);
        let cy = Math.floor(unit.y / this.cellSize);
        if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) return;
        this.cells[cy * this.cols + cx].push(unit);
    }
    
    getNearby(x, y, radius) {
        let result = [];
        let startCol = Math.max(0, Math.floor((x - radius) / this.cellSize));
        let endCol = Math.min(this.cols - 1, Math.floor((x + radius) / this.cellSize));
        let startRow = Math.max(0, Math.floor((y - radius) / this.cellSize));
        let endRow = Math.min(this.rows - 1, Math.floor((y + radius) / this.cellSize));
        
        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                let cell = this.cells[r * this.cols + c];
                for(let i = 0; i < cell.length; i++) result.push(cell[i]);
            }
        }
        return result;
    }
}
const spatialGrid = new SpatialGrid(WORLD_W, WORLD_H, 100);

// ─── GÖRÜŞ AÇISI ENGELİ (LINE OF SIGHT & FRIENDLY FIRE) ───
function checkLineOfSight(x1, y1, x2, y2, ignoreUnit1, ignoreUnit2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len === 0) return true;

    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
    const rad = Math.hypot(maxX - minX, maxY - minY) / 2;
    const candidates = spatialGrid.getNearby(midX, midY, rad);

    for (const u of candidates) {
        if (u.dead || u === ignoreUnit1 || u === ignoreUnit2) continue;
        
        // Dot product kullanarak noktanın doğru üzerine izdüşümü
        const dot = ((u.x - x1) * dx + (u.y - y1) * dy) / (len * len);
        // Doğru parçasının dışındaysa (arkasında veya ötesindeyse) yoksay
        if (dot < 0 || dot > 1) continue; 

        const projX = x1 + dot * dx;
        const projY = y1 + dot * dy;
        const distToLine = Math.hypot(u.x - projX, u.y - projY);
        
        // Askerin bedeni doğruyu kesiyorsa engel vardır
        if (distToLine < UNIT_RADIUS * 1.5) {
            return false;
        }
    }
    return true;
}

// Inicialize
resize();