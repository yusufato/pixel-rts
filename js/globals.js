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
        // İlk açılışta merkez geçit, dağ sıraları ve güney konuşlanma alanı birlikte görünür.
        zoom = Math.max(ZOOM_MIN, Math.min(0.65, canvas.width / (WORLD_W * 0.78)));
        camera.x = Math.max(0, (WORLD_W - canvas.width / zoom) / 2);
        camera.y = Math.max(0, WORLD_H - (canvas.height - 100) / zoom);
        isCameraInitialized = true;
    }
}
window.addEventListener('resize', resize);

// Geniş, kuzey-güney doğrultusunda oynanan savaş alanı.
const WORLD_W = 3400;
const WORLD_H = 2300;

const TERRAIN = { NONE: 0, FOREST: 1, MOUNTAIN: 2 };
// ── SİMETRİK 3-MEVZİ HARİTASI ──
// 3 kontrol noktası (orta hat: x=880/1700/2520, y=1150) birer AÇIK güçlü-mevzi; etrafları
// araziyle çerçeveli. Kuzey-güney AYNA simetrik (her iki taraf için adil). Dağlar=geçit/görüş
// engeli, ormanlar=kanat örtüsü. Noktalar araziden açık (otomatik doğrulandı).
const terrainFeatures = [
    // Orta hat sırtları: 3 noktayı 3 şeride ayırır (aralarından dolanılır = manevra derinliği)
    { x: 1290, y: 1150, r: 200, type: TERRAIN.MOUNTAIN, seed: 21 },
    { x: 2110, y: 1150, r: 200, type: TERRAIN.MOUNTAIN, seed: 22 },

    // Merkez muhafız yüksek arazi (kuzey/güney ayna): merkez noktayı çetin objektif yapar
    { x: 1700, y: 620,  r: 235, type: TERRAIN.MOUNTAIN, seed: 23 },
    { x: 1700, y: 1680, r: 235, type: TERRAIN.MOUNTAIN, seed: 24 },

    // Sol/sağ şerit dağları (kuzey/güney ayna): dış noktaların yaklaşımını çerçeveler
    { x: 880,  y: 620,  r: 205, type: TERRAIN.MOUNTAIN, seed: 25 },
    { x: 880,  y: 1680, r: 205, type: TERRAIN.MOUNTAIN, seed: 26 },
    { x: 2520, y: 620,  r: 205, type: TERRAIN.MOUNTAIN, seed: 27 },
    { x: 2520, y: 1680, r: 205, type: TERRAIN.MOUNTAIN, seed: 28 },

    // Uzak kanat ormanları (sol/sağ kenar, orta hat): dış noktalara gizli kanat yolu
    { x: 300,  y: 1150, r: 270, type: TERRAIN.FOREST, seed: 11 },
    { x: 3100, y: 1150, r: 270, type: TERRAIN.FOREST, seed: 12 },

    // Köşe ormanları (kuzey/güney ayna): yaklaşım örtüsü + görsel doku
    { x: 560,  y: 930,  r: 230, type: TERRAIN.FOREST, seed: 31 },
    { x: 560,  y: 1370, r: 230, type: TERRAIN.FOREST, seed: 32 },
    { x: 2840, y: 930,  r: 230, type: TERRAIN.FOREST, seed: 33 },
    { x: 2840, y: 1370, r: 230, type: TERRAIN.FOREST, seed: 34 }
];

function seededRandom(seed) {
    let value = Math.sin(seed * 999.91) * 43758.5453;
    return value - Math.floor(value);
}

// ═══════════════════════════════════════════════════════════════════════════
//  SIM — SİMÜLASYON STATE'inin TEK konteyneri (FORGE-Core / Temiz Sayfa, Faz 1)
//  ----------------------------------------------------------------------------
//  NOT: "world" adı KULLANILMADI — main.js'te her event handler'da yerel
//  `const world = screenToWorld(...)` (koordinat) var; çakışmayı önlemek için SIM.
//  Büyüyerek units/trenches/controlPoints/vpScore/phase/gameTime/money alacak.
//  Faz 2'de serialize/deserialize/fork DOĞRUDAN bu nesneden çalışır.
//  Render-only state (decals/craters/particles/screenShake) SIM'e GİRMEZ → ayrı
//  `view`'a gidecek (Faz 1f): rollout'ta hesaplanmaz = determinizm + hız.
//
//  Deterministik RNG (Faz 0): SADECE sim yolu (deploy/ordu/ikmal). VFX Math.random
//  KALIR. Durum tek 32-bit tamsayı (SIM.rng.state) → tekrarlanabilir + fork'lanabilir.
// ═══════════════════════════════════════════════════════════════════════════
const SIM = {
    rng: { state: 0x9e3779b9 },   // FAZ 0'da SIM_RNG idi → Faz 1'de SIM.rng'ye taşındı
    // FAZ 1c: bölge/zafer state'i (ControlPoints.js reassign ediyordu → world canonical, alias-kırılması biter)
    controlPoints: [],
    vpScore: { red: 0, blue: 0 },
    vpWinner: null,               // null | true (MAVİ/oyuncu) | false (KIRMIZI/AI)
    headless: false,              // FAZ 1f: true = rollout (render-only VFX hesaplanmaz → hız + sim/view ayrımı)
};
const SIM_RNG = SIM.rng;        // geri-uyumluluk aliası: mevcut SIM_RNG.state okuma/yazmaları SIM.rng'ye düşer

// FAZ 3: AI arka-uç bayrağı (strangler). 'policy'=yeni TEMİZ KOMUTAN (Commander.js, VARSAYILAN —
// canlı test: tutarlı, halüsinasyonsuz), 'layered'=eski baroque (fallback/karşılaştırma).
// Konsoldan geçiş: useCleanAI(true/false). NOT: eğitim (SelfPlay) hâlâ LayeredAI genom kullanır (Faz 4'e kadar).
let AI_BACKEND = 'policy';
function useCleanAI(on = true) {
    AI_BACKEND = on ? 'policy' : 'layered';
    console.log(`AI_BACKEND = '${AI_BACKEND}' (${on ? 'TEMİZ KOMUTAN — kuvvet ekonomisi + bölge' : 'eski LayeredAI'})`);
    return AI_BACKEND;
}
function resetSimRng(seed) {
    SIM.rng.state = (seed >>> 0) || 0x9e3779b9;
}
// mulberry32 — hızlı, kaliteli dağılım, durumu tek tamsayı (tekrarlanabilir + serileştirilebilir)
function srand() {
    let a = (SIM_RNG.state = (SIM_RNG.state + 0x6D2B79F5) | 0);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function srandRange(min, max) { return min + srand() * (max - min); }   // [min, max)
function srandInt(n) { return Math.floor(srand() * n); }                 // 0..n-1

// Arazi detayları bir kez oluşturulur; her karede aynı yerde kaldıkları için harita titremez.
const groundDetails = [];
for (let i = 0; i < 950; i++) {
    const rx = seededRandom(i + 101);
    const ry = seededRandom(i + 701);
    groundDetails.push({
        x: rx * WORLD_W,
        y: ry * WORLD_H,
        size: 2 + seededRandom(i + 1401) * 7,
        tone: seededRandom(i + 2101)
    });
}

// Kodla üretilen sabit piksel savaş zemini: her açılışta aynı doku, iz ve enkaz görünür.
const GROUND_TILE_SIZE = 96;
const groundTiles = [];
for (let y = 0; y < WORLD_H; y += GROUND_TILE_SIZE) {
    for (let x = 0; x < WORLD_W; x += GROUND_TILE_SIZE) {
        const seed = x * 0.013 + y * 0.029 + 4001;
        groundTiles.push({ x, y, tone: seededRandom(seed) });
    }
}

const battlefieldProps = [];
const propTypes = ['mud', 'grass', 'stone', 'debris', 'scar'];
for (let i = 0; i < 360; i++) {
    battlefieldProps.push({
        x: seededRandom(i + 5101) * WORLD_W,
        y: seededRandom(i + 6101) * WORLD_H,
        size: 8 + seededRandom(i + 7101) * 28,
        type: propTypes[Math.floor(seededRandom(i + 8101) * propTypes.length)],
        angle: seededRandom(i + 9101) * Math.PI * 2,
        variant: seededRandom(i + 10101)
    });
}

for (const t of terrainFeatures) {
    if (t.type === TERRAIN.FOREST) {
        t.trees = [];
        const treeCount = Math.floor(t.r * t.r / 520);
        for (let i = 0; i < treeCount; i++) {
            const angle = seededRandom(t.seed * 1000 + i) * Math.PI * 2;
            const distance = Math.sqrt(seededRandom(t.seed * 2000 + i)) * t.r * 0.95;
            t.trees.push({
                x: t.x + Math.cos(angle) * distance,
                y: t.y + Math.sin(angle) * distance,
                r: 10 + seededRandom(t.seed * 3000 + i) * 13,
                color: seededRandom(t.seed * 4000 + i) > 0.55 ? '#183f25' : '#205532',
                offset: seededRandom(t.seed * 5000 + i) * Math.PI * 2
            });
        }
        t.trees.sort((a, b) => a.y - b.y);
    } else if (t.type === TERRAIN.MOUNTAIN) {
        t.peaks = [];
        for (let i = 0; i < 7; i++) {
            const angle = seededRandom(t.seed * 100 + i) * Math.PI * 2;
            const distance = seededRandom(t.seed * 200 + i) * t.r * 0.52;
            t.peaks.push({
                x: t.x + Math.cos(angle) * distance,
                y: t.y + Math.sin(angle) * distance,
                r: t.r * (0.24 + seededRandom(t.seed * 300 + i) * 0.24)
            });
        }
    }
}

const camera = { x: 0, y: 0 };
let zoom = 1.0;
const GAME_SPEED = 4.0;
const ZOOM_MIN = 0.35;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.08;
const CAM_SPEED = 8 * GAME_SPEED;
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
    [T.INFANTRY]: { hp: 260, atk: 14, speed: 0.54, range: 110, vision: 350, atkSpeed: 850, armor: 0, cost: 50, maxAmmo: 60, name: 'Piyade', desc: 'Çok yönlü ana hat askeri; sürüyle tanksavarı ezer', strong: [T.ENGINEER, T.MEDIC, T.ANTI_TANK, T.RECON], weak: [T.ARMOR, T.ARTILLERY, T.ARMOR_INFANTRY] },
    [T.MECH_INFANTRY]: { hp: 312, atk: 16, speed: 0.90, range: 130, vision: 400, atkSpeed: 780, armor: 1, cost: 80, maxAmmo: 100, name: 'Mekanize', desc: 'Hızlı kanatçı; teçhizatlı: tanka hafif anti (×1.6)', strong: [T.INFANTRY, T.RECON, T.ENGINEER, T.ARTILLERY], weak: [T.ANTI_TANK, T.ARMOR_INFANTRY] },
    [T.ARMOR_INFANTRY]: { hp: 390, atk: 13, speed: 0.40, range: 110, vision: 250, atkSpeed: 950, armor: 4, cost: 100, maxAmmo: 40, name: 'Zırhlı Piy.', desc: 'Ağır ön hat; teçhizatlı: tanka hafif anti (×1.6)', strong: [T.INFANTRY, T.MECH_INFANTRY, T.RECON], weak: [T.ARTILLERY, T.ANTI_TANK] },
    [T.RECON]: { hp: 143, atk: 8, speed: 1.35, range: 130, vision: 800, atkSpeed: 650, armor: 0, cost: 40, maxAmmo: 30, name: 'Keşif', desc: 'Sisin içini aydınlatan geniş görüşlü birim', strong: [T.ARTILLERY, T.MEDIC, T.ENGINEER], weak: [T.INFANTRY, T.MECH_INFANTRY, T.ARMOR_INFANTRY, T.ARMOR, T.ANTI_TANK] },
    [T.ENGINEER]: { hp: 234, atk: 6, speed: 0.45, range: 80, vision: 300, atkSpeed: 1100, armor: 0, cost: 60, maxAmmo: 20, name: 'İstihkam', desc: 'Siper+ikmal kurar; alanda araç/topçu/tanksavar onarılır', strong: [], weak: [T.INFANTRY, T.RECON, T.MECH_INFANTRY, T.ARMOR] },
    [T.MEDIC]: { hp: 117, atk: 0, speed: 0.60, range: 90, vision: 300, atkSpeed: 1000, armor: 0, cost: 70, maxAmmo: 0, name: 'Sağlıkçı', desc: 'Silahsız; organik dost birlikleri iyileştirir', strong: [], weak: [T.INFANTRY, T.RECON, T.MECH_INFANTRY, T.ARMOR, T.ANTI_TANK, T.ARTILLERY] },
    [T.ARMOR]: { hp: 780, atk: 20, speed: 0.48, range: 275, vision: 400, atkSpeed: 8000, armor: 8, cost: 200, maxAmmo: 15, name: 'Tank', desc: 'Ana Muharebe Tankı. Ağır vurur ama yavaş ateş eder (8 sn, 20 hasar)', strong: [T.INFANTRY, T.MECH_INFANTRY, T.ARMOR_INFANTRY, T.RECON, T.ENGINEER, T.MEDIC], weak: [T.ANTI_TANK, T.ARTILLERY] },
    [T.ANTI_TANK]: { hp: 195, atk: 25, speed: 0.45, range: 320, vision: 420, atkSpeed: 5000, armor: 0, cost: 100, maxAmmo: 12, name: 'Tanksavar', desc: 'Uzun menzilli sert zırh avcısı. Zırhlılara ×4.0 hasar ve %85 zırh delme (5 sn, 25 hasar)', strong: [T.ARMOR, T.MECH_INFANTRY, T.ARMOR_INFANTRY], weak: [T.INFANTRY, T.RECON, T.ARTILLERY] },
    [T.ARTILLERY]: { hp: 143, atk: 20, speed: 0.27, range: 350, vision: 300, atkSpeed: 10000, armor: 0, cost: 150, maxAmmo: 12, name: 'Topçu', desc: 'SADECE geniş alan hasarı (nokta atışı yok). CAM-TOP: keşif kadar kırılgan (110 can). Görüş için Keşif ister! (10 sn, 20 alan hasarı, 12 mermi)', strong: [T.INFANTRY, T.MECH_INFANTRY, T.ARMOR_INFANTRY, T.ARMOR], weak: [T.RECON] },
};

const AT_ARMOR_MULTIPLIER = 4.0;          // tanksavar → zırhlı: sert anti
const AT_ARMOR_PENETRATION = 0.85;
const EQUIPPED_AT_MULTIPLIER = 1.6;       // teçhizatlı piyade (mekanize/zırhlı piy.) → zırhlı: yumuşak anti
const EQUIPPED_AT_PENETRATION = 0.35;
const ARTILLERY_SPLASH_RADIUS = 120;      // 165→135: yayık birim splash'tan kaçar, topçu yenilebilir olur
const ARTILLERY_SPLASH_DAMAGE_RATIO = 0.95;
// Tank mermisi: dar ama gerçek alan hasarı (HE mermisi). Topçudan KÜÇÜK ve ZAYIF.
const TANK_SPLASH_RADIUS = 80;            // topçunun ~yarısı
const TANK_SPLASH_MIN = 0.30;             // kenar hasar oranı
const TANK_SPLASH_MAX = 0.65;             // merkeze yakın hasar oranı (asla %100 değil)
const ARTILLERY_SUPPRESSION_RADIUS = 150;

function calculateUnitDamage(attackerType, targetType, baseAttack, targetArmor) {
    const attackerStats = STATS[attackerType];
    const armoredTarget = [T.ARMOR, T.MECH_INFANTRY, T.ARMOR_INFANTRY].includes(targetType);
    let damage = baseAttack;
    let effectiveArmor = targetArmor;

    if (attackerType === T.ANTI_TANK && armoredTarget) {
        damage = baseAttack * AT_ARMOR_MULTIPLIER;            // tanksavar: sert tank antisi
        effectiveArmor *= 1 - AT_ARMOR_PENETRATION;
    } else if ((attackerType === T.MECH_INFANTRY || attackerType === T.ARMOR_INFANTRY) && armoredTarget) {
        damage = baseAttack * EQUIPPED_AT_MULTIPLIER;        // teçhizatlı piyade: yumuşak tank antisi
        effectiveArmor *= 1 - EQUIPPED_AT_PENETRATION;
    } else {
        if (attackerStats.strong.includes(targetType)) damage *= 1.5;
        if (attackerStats.weak.includes(targetType)) damage *= 0.5;
    }
    return Math.max(1, Math.floor(damage - effectiveArmor));
}

function capUnitArmor(type, armor) {
    if (type === T.ARMOR_INFANTRY) return Math.min(armor, 8);
    if (type === T.ARMOR) return Math.min(armor, 12);
    return Math.min(armor, 10);
}

function isMedicHealable(type) {
    return [T.INFANTRY, T.ARMOR_INFANTRY, T.ENGINEER, T.MEDIC].includes(type);
}

function isFieldRepairable(type) {
    return [T.MECH_INFANTRY, T.RECON, T.ARMOR, T.ANTI_TANK, T.ARTILLERY].includes(type);
}

const PHASE = { DEPLOY: 'deploy', BATTLE: 'battle', OVER: 'over' };
let phase = PHASE.DEPLOY;
let gameTime = 0;

const player = { money: 1500, kills: 0, unitsSpawned: 0 };
const enemy = { money: 1500, kills: 0, unitsSpawned: 0 };

const units = [];
const trenches = [];
// FAZ 1a: sim-dizilerini world'e alias bağla (const → asla reassign yok, alias güvenli).
// Mevcut kod `units`/`trenches` global'lerini kullanmaya devam eder; yeni motor-kodu `SIM.units` okur. İkisi AYNI dizi.
SIM.units = units;
SIM.trenches = trenches;
const SUPPLY_FIELD_DURATION_MS = 60000;
const craters = [];
const decals = []; // { x, y, type, size, alpha, angle }

let mouseScreenX = 500, mouseScreenY = 500;
let isDragging = false;
let dragStartX = 0, dragStartY = 0;
let selectedSpawnType = null;
// ─── LOCAL STORAGE (Öğrenen AI) ───
const MEMORY_KEY = 'pixelRtsMemory';
const GENOME_KEY = 'pixelRtsGenome';
const TRAINING_REPORT_KEY = 'pixelRtsLastTrainingReport';
const CHAMPION_ARCHIVE_KEY = 'pixelRtsChampionArchive';
const HALL_OF_FAME_KEY = 'pixelRtsHallOfFame';
const TACTIC_GENE_LIMITS = Object.freeze({
    vanguardAggression: [0.55, 1.50],
    vanguardPreferredRange: [0.50, 1.10],
    vanguardRetreat: [0.08, 0.48],
    flankAggression: [0.60, 1.65],
    flankPreferredRange: [0.50, 1.10],
    flankRetreat: [0.06, 0.45],
    supportAggression: [0.40, 1.25],
    supportPreferredRange: [0.65, 1.20],
    supportRetreat: [0.12, 0.62],
    flankRatio: [0.15, 0.65],
    flankWidth: [220, 650],
    cohesion: [0.25, 0.90],
    focusFire: [0.00, 1.00],
    targetArmorPriority: [0.40, 2.20],
    targetSupportPriority: [0.40, 2.20],
    executeTtk: [4.0, 14.0],
    kiteHp: [0.25, 0.60],
    resupplyAmmo: [0.04, 0.30],
    tacticalRetreatForceRatio: [0.55, 1.15],
    decisiveForceRatio: [1.05, 1.90],
    targetValueWeight: [0.55, 1.75],
    targetThreatWeight: [0.55, 1.85],
    finishBias: [0.50, 1.80],
    steeringSeparation: [0.55, 1.65],
    threatAvoidance: [0.20, 1.60],
    lossAversion: [1.00, 2.40],     // kuvvet ekonomisi k: 1.0 agresif (kayıp umursamaz) → 2.4 çok temkinli. Eğitim ayarlar.
    vpPressureWeight: [0.30, 2.20], // FAZ 2/4: bölgede geride isem tempo baskısı şiddeti (turtle'ı puanla zorla)
    punchFocus: [0.40, 2.00]        // FAZ 3/4: PUNCH'ın en ZAYIF savunulan noktayı seçme eğilimi
});
const DEFAULT_TACTIC_GENES = Object.freeze({
    vanguardAggression: 1.00,
    vanguardPreferredRange: 0.78,
    vanguardRetreat: 0.30,
    flankAggression: 1.10,
    flankPreferredRange: 0.82,
    flankRetreat: 0.25,
    supportAggression: 0.80,
    supportPreferredRange: 0.95,
    supportRetreat: 0.40,
    flankRatio: 0.35,
    flankWidth: 400,
    cohesion: 0.60,
    focusFire: 0.65,
    targetArmorPriority: 1.00,
    targetSupportPriority: 1.00,
    executeTtk: 7.00,
    kiteHp: 0.42,
    resupplyAmmo: 0.12,
    tacticalRetreatForceRatio: 0.85,
    decisiveForceRatio: 1.35,
    targetValueWeight: 1.00,
    targetThreatWeight: 1.00,
    finishBias: 1.00,
    steeringSeparation: 1.00,
    threatAvoidance: 1.00,
    lossAversion: 1.60,
    vpPressureWeight: 1.00,
    punchFocus: 1.00
});

function normalizeTacticGenes(genes = {}) {
    const oldAggression = Number.isFinite(genes.aggression) ? genes.aggression : 1.00;
    const oldRange = Number.isFinite(genes.preferredRange) ? genes.preferredRange : 0.82;
    const oldRetreat = Number.isFinite(genes.retreatThreshold) ? genes.retreatThreshold : 0.30;
    const migratedFallbacks = {
        vanguardAggression: oldAggression,
        vanguardPreferredRange: oldRange,
        vanguardRetreat: oldRetreat,
        flankAggression: oldAggression + 0.10,
        flankPreferredRange: oldRange,
        flankRetreat: oldRetreat * 0.85,
        supportAggression: oldAggression - 0.15,
        supportPreferredRange: oldRange + 0.08,
        supportRetreat: oldRetreat + 0.12
    };
    const normalized = {};
    for (const [name, limits] of Object.entries(TACTIC_GENE_LIMITS)) {
        const fallback = Number.isFinite(migratedFallbacks[name]) ? migratedFallbacks[name] : DEFAULT_TACTIC_GENES[name];
        const value = Number.isFinite(genes[name]) ? genes[name] : fallback;
        normalized[name] = Math.max(limits[0], Math.min(limits[1], value));
    }
    return normalized;
}

function getRoleTacticGenes(genes, squad) {
    const prefix = squad === SQUAD.FLANK ? 'flank' : squad === SQUAD.SUPPORT ? 'support' : 'vanguard';
    return {
        aggression: genes[`${prefix}Aggression`],
        preferredRange: genes[`${prefix}PreferredRange`],
        retreat: genes[`${prefix}Retreat`]
    };
}

let playerMeta = {};
let aiGenome = null;

try {
    playerMeta = JSON.parse(localStorage.getItem(MEMORY_KEY)) || {};
    aiGenome = JSON.parse(localStorage.getItem(GENOME_KEY));
} catch (e) {
    console.warn("LocalStorage access denied, using memory only.");
}

function isValidGenome(g) {
    return g && g.deployMatrix && g.deployMatrix.length === 9 && g.counterMatrix && g.counterMatrix.length === 9;
}
if (!isValidGenome(aiGenome)) {
    if (typeof TRAINED_BRAIN !== 'undefined' && isValidGenome(TRAINED_BRAIN)) {
        // Commit'lenmiş eğitilmiş beyin (git ile gelen kalıcı genom)
        aiGenome = JSON.parse(JSON.stringify(TRAINED_BRAIN));
        console.log('🧠 Commit\'li eğitilmiş beyin yüklendi (brain.js).');
    } else {
        aiGenome = {
            counterMatrix: [],
            deployMatrix: [],
            tacticGenes: normalizeTacticGenes()
        };
        for(let i=0; i<9; i++) {
            aiGenome.counterMatrix[i] = [1,1,1,1,1,1,1,1,1];
            aiGenome.deployMatrix[i] = [Math.random(), Math.random()];
        }
    }
}

// Eski kayıtları silmeden yeni taktik genlerine yükselt.
aiGenome.version = 4;
aiGenome.tacticGenes = normalizeTacticGenes(aiGenome.tacticGenes);
try {
    localStorage.setItem(GENOME_KEY, JSON.stringify(aiGenome));
} catch(e) {}

let battlePhase = 1; // 1: Advance (Formasyon Yürüyüşü), 2: Clash (Çatışma), 3: Flank (Kuşatma)
let aiDoctrine = 1; // 1: Ağır Örs, 2: Zırhlı Çekiç

function savePlayerMeta() {
    for (const u of SIM.units) {
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
    for (const u of SIM.units) {
        if (u.dead || u.isRed !== teamIsRed) continue;
        if (Math.hypot(u.x - targetX, u.y - targetY) <= STATS[u.type].vision) return true;
    }
    // Kendi güvenli üssünü her zaman görebilir
    if (!teamIsRed && targetY > WORLD_H * 0.7) return true; 
    if (teamIsRed && targetY < WORLD_H * 0.3) return true;
    return false;
}

function isInPlayerZone(worldX, worldY) {
    // Tek-oyuncu/host = Güney (alt). Çok-oyunculu guest (KIRMIZI) = Kuzey (üst).
    if (typeof myCanonicalSide !== 'undefined' && myCanonicalSide) return worldY < (WORLD_H * 0.4);
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
SIM.spatialGrid = spatialGrid;   // FAZ 1e: sim-ızgara SIM'de (fork: SIM.spatialGrid swap'lanır; canlıda aynı nesne)

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
    const candidates = SIM.spatialGrid.getNearby(midX, midY, rad);

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
