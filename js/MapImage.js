// ═══════════════════════════════════════════════════════════════════════════
//  MapImage.js — ÇİZİLMİŞ HARİTA (PNG → arazi ızgarası). Gerçek, asimetrik harita.
//  Kullanıcı izohips/arazi haritasını çizer (pixil), PNG buraya ızgara olarak gömülür.
//  globals.js + MapData.js'ten SONRA yüklenir (WORLD_W/TERRAIN/terrainFeatures kullanır).
//
//  TEK GERÇEK KAYNAK: terrainGrid (150×100). Render + birim-fiziği (hareket/görüş/örtü/
//  yükselti) BUNDAN okur → çizimle birebir. AI makro-aklı için ızgaradan KABA daireler
//  türetilir (terrainFeatures) → 8 AI dosyası DEĞİŞMEDEN çalışır.
//  Determinizm: ızgara saf veri (RNG yok); ışın-tarama + hücre-örnekleme deterministik.
// ═══════════════════════════════════════════════════════════════════════════
const GRID_W = 150, GRID_H = 100;
const CELL_W = WORLD_W / GRID_W;          // 22.667
const CELL_H = WORLD_H / GRID_H;          // 23.0
let MAP_MODE = 'circle';                  // 'circle' (eski 10 harita) | 'grid' (çizilen harita)
let terrainGrid = null;                   // Uint8Array(GRID_W*GRID_H): TERRAIN enum değerleri
let bridgeSet = null;                     // Set('gx,gy') — köprü (geçilebilir su) hücreleri
let elevField = null;                     // Float32 yükselti alanı (dağ-yoğunluğu blur)
let terrainBakeCanvas = null, terrainBakeCtx = null;

// ── ÇİZİLEN HARİTA VERİSİ (pixil PNG'den çözüldü) — '.'=ova 'F'=orman 'M'=dağ 'W'=su ──
const DRAWN_MAP = {
    name: '🗺️ Çizilen Harita',
    grid: "...........................................................................................................FFFFFFFFFFMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM...........................................................................................................FFFFFFFFFFMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM...........................................................................................................FFFFFFFFFFFMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM..........................................................................................................FFFFFFFFFFFFMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM.........................................................................................................FFFFFFFFFFFFFMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM.........................................................................................................FFFFFFFFFFFFFMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM.........................................................................................................FFFFFFFFFFFFFMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM.........................................................................................................FFFFFFFFFFFFFMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWW........................................................................................................FFFFFFFFFFFFMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWWWW......................................................................................................FFFFFFFFFFFMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM.WWWWW.....................................................................................................FFFFFFFFFFFFMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM...WWW......................................................................................................FFFFFFFFFFFMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM....WWW......................................................................................................FFFFFFFFFFFMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM.....WWW......................................................................................................FFFFFFFFFFFMMMMMMMMMMMMMMMMMMMMMMMMMMMMM.....WWWW.....................................................................................................FFFFFFFFFFFMMMMMMMMMMMMMMMMMMMMMMMMMMMMM.......WWWW....................................................................................................FFFFFFFFFFFFMMMFFFFFFMMMMMMMMMMMMMMMMMM........WWWWW.........WWW.......................................................................................FFFFFFFFFFFFFFFFFFFFFMMMMMMMMMMMMMMMMM.........WWWWWWW...WWWWWWW......................................................................................FFFFFFFFFFFFFFFFFFFFFFMMMMMMMMMMMMMFFF............WWWWWWWWWWWWWW.......................................................................................FFFFFFFFFFFFFFFFFFFFFFFFMMMMMFFFFFFFF..............WWWWWWW..WWWWWWW...................................................................................FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF........................WWWWWWW...................................................................................FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF.............................WWW..................................................................................FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF.............................WWWW.................................................................................FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF..............................WWW.................................................................................FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF...............................WWWW..............................................................................FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF................................WWWW............................................................................FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF..................................WWWW.........................................................................FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF...................................WWWWWW......................................................................FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF.....................................WWWWWWWWW.................................................................FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF........................................WWWWWWWW...............................................................FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF................................................WWWWWW..............WW.............................................FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF....................................................WWWWW.............WW..............................................FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF.......................................................WWWWWW.........WWW..............................................FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF.........................................................WWWWWWWWWWWW.WW................................................FFFFFFFFFFFFFFFFFFFFFFFFFFFFF.......FF....................................................WWWWWWWWWWWW..................................................FFFFFFFFFFFFFFFFFFFFFFFFFFF.......FFFFFF........................................................WWWWW..................................................FFFFFFFFFFFFFFFFFFFFFFFFFF.......FFFFFFFF......................................................WWWWWW...................................................FFFFFFFFFFFFFFFFFFFFFFF........FFFFFFFFFF....................................................WW..WWWW......................................................FFFFFFFFFFFFFFFFF.........FFFFFFFFFFFF.................................................WWW...WWWW.......................................................FFFFFFFFFFFFFF..........FFFFFFFFFFFFFF...............................................WW.....WWWW.........................................................FFFFFFFFFF...........FFFFFFFFFFFFFFF.............................................WWW.......WWW..........................................................FFFFFFF............FFFFFFFFFFFFFFFFF...........................................WW.........WW...........................................................FFFFF.............FFFFFFFFFFFFFFFFFF..........................................WW.........WWW............................................................F...............FFFFFFFFFFFFFFFFFFFF....................................................WW............................................................................FFFFFFFFFFFFFFFFFFFFF...................................................WWW...........................................................................FFFFFFFFFFFFFFFFFFFFF....................................................WW...........................................................................FFFFFFFFFFFFFFFFFFFFFF...................................................WWW..........................................................................FFFFFFFFFFFFFFFFFFFFFF....................................................WW.........................................................................WFFFFFFFFFFFFFFFFFFFFFF....................................................WWW......................................................................WWWFFFFFFFFFFFFFFFFFFFFFF.....................................................WWW....................................................................WWWWMMMFFFFFFFFFFFFFFFFFFF.....................................................WWWW....................WW.............................................WWWWMMMMFFFFFFFFFFFFFFFFFF.......................................................WWW...................WW............................................WWWWWMMMMMFFFFFFFFFFFFFFFFF........................................................WWWW.................WW............................................WWWWWMMMMMMFFFFFFFFFFFFFFFFF........................................................WWWWWWWWWW..........WW...........................................WWWWWWMMMMMMMMMMFFFFFFFFFFFFF..........................................................WWWWWWWWWWWWW.....WW...........................................WWWWWWMMMMMMMMMMMFFFFFFFFFFFFF................................................................WWWWWWWWW..WW....WWWWWW.................................WWWWWWMMMMMMMMMMMFFFFFFFFFFFFF.....................................................................WWWWWWWWWWWWWWWWWWWWW..............................WWWWWWMMMMMMMMMMMFFFFFFFFFFFFF........................................................................WWWWWWWWWWW..WWWWWWWW...........................WWWWWWMMMMMMMMMMMFFFFFFFFFFFFF...........................................................................WW............WWWWWW.........................WWWWWWMMMMMMMMMMMFFFFFFFFFFFFF...........................................................................WW...............WWWW........................WWWWWWMMMMMMMMMMFFFFFFFFFFFFFF...........................................................................WW................WWWWW......................WWWWWWMMMMMMMMMMFFFFFFFFFFFFFFF..........................................................................WW.................WWWWW....................WWWWWWWMMMMMMMMMMFFFFFFFFFFFFFFF..........................................................................WW...................WWWWWW................WWWWWWWWMMMMMMMMMMFFFFFFFFFFFFFFF..........................................................................WW....................WWWWWWWW............WWWWWWWWWMMMMMMMMMMFFFFFFFFFFFFF.....................................................................................................WWWWWW..........WWWWWWWWWWMMMMMMMMMMFFFFFFFFFFFFF........................................................................................................WWW..........WWWWWWWWWWMMMMMMMMMMFFFFFFFFFFFF..........................................................................................................WWW........WWWWWWWWWWWMMMMMMMMMMFFFFFFFFFFFF...........................................................................................................WW........WWWWWWWWWWWMMMMMMMMMMFFFFFFFFFFFF...........................................................................................................WWW.......WWWWWWWWWWWMMMMMMMMMMFFFFFFFFFFFF............................................................................................................WWW......WWWWWWWWWWWMMMMMMMMMMMFFFFFFFFFFF............................................................................................................WWW......WWWWWWWWWWWMMMMMMMMMMMMFFFFFFFFFFF............................................................................................................WWW....WWWWWWWWWWWWMMMMMMMMMMMMFFFFFFFFFFF............................................................................................................WWW....WWWWWWWWWWWWMMMMMMMMMMMMFFFFFFFFFFF.............................................................................................................WW...WWWWWWWWWWWWWMMMMMMMMMMMFFFFFFFFFFFFF............................................................................................................WWWWWWWWWWWWWWWWWWMMMMMMMMMMMFFFFFFFFFFFFFFF...........................................................................................................WWWWWWWWWWWWWWWWWMMMMMMMMMMMFFFFFFFFFFFFFFFF..........................................................................................................WWWWWWWWWWWWWWWWWMMMMMMMMMMMFFFFFFFFFFFFFFFFF..........................................................................................................WWWWWWWWWWWWWWWWMMMMMMMMMMMFFFFFFFFFFFFFFFFFF.........................................................................................................WWWWWWWWWWWWWWWWMMMMMMMMMMMFFFFFFFFFFFFFFFFFFF....FFFFFF..............................................................................................WWWWWWWWWWWWWWWWMMMMMMMMMMMMFFFFFFFFFFFFFFFFFFFFFFFFFFFFF............................................................................................WWWWWWWWWWWWWWWWWMMMMMMMMMMMMMFFFFFFFFFFFFFFFFFFFFFFFFFFFFF..........................................................................................WWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF........................................................................................WWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF......................................................................................WWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMFFFFFFFFFFFFFFFFFFFFFFFFF.....................................................................................WWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMMFFFFFFFFFFFFFFFFFFFFFFF...................................................................................WWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMMMMFFFFFFFFFFFFFFFFFFFFF...................................................................................WWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMMMMMMMFFFFFFFFFFFFFFFFFF...................................................................................WWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMFFFFFFFFFFFFFFFFFF..................................................................................WWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMFFFFFFFFFFFFFFFFFF.................................................................................WWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMFFFFFFFFFFFFFFFFF.................................................................................WWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMFFFFFFFFFFFFFF................................................................................WWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMFFFFFFFFFFFF................................................................................WWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMFFFFFFFFFFFFFFF...........................................................................WWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMFFFFFFFFFFFFFFF..........................................................................WWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMFFFFFFFFFFFFFFF.........................................................................WWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMFFFFFFFFFFFFFFF.........................................................................WWWWWWWWWWWWWWWWWWWWWWWWWMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMFFFFFFFFFFFFFF.........................................................................WWWWWWWWWWWWWWWWWWWWWWWWW....MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMFFFFFFFFFFFFFFF........................................................................WWWWWWWWWWWWWWWWWWWWWWWWW.......MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMFFFFFFFFFFFFFFF.......................................................................WWWWWWWWWWWWWWWWWWWWWWWWWW",
    bridges: [[65,30],[66,30],[65,31],[66,31],[64,32],[65,32],[66,32],[64,33],[65,33],[63,34],[64,34],[65,34],[63,35],[64,35],[62,36],[63,36],[64,36],[62,37],[63,37],[61,38],[62,38],[63,38],[61,39],[62,39],[60,40],[61,40],[62,40],[60,41],[61,41],[60,42],[61,42],[99,50],[100,50],[99,51],[100,51],[99,52],[100,52],[99,53],[100,53],[99,54],[100,54],[99,55],[100,55],[99,56],[100,56],[99,57],[100,57],[99,58],[100,58],[99,59],[100,59],[99,60],[100,60],[99,61],[100,61],[99,62],[100,62],[99,63],[100,63]]
};

function _gi(gx, gy) { return gy * GRID_W + gx; }
function buildTerrainGrid(def) {
    terrainGrid = new Uint8Array(GRID_W * GRID_H);
    const M = { '.': 0, 'F': 1, 'M': 2, 'W': 4 };
    const s = def.grid;
    for (let i = 0; i < GRID_W * GRID_H; i++) terrainGrid[i] = M[s[i]] != null ? M[s[i]] : 0;
    bridgeSet = new Set((def.bridges || []).map(b => b[0] + ',' + b[1]));
    buildElevField();
}
function gridTypeCell(gx, gy) {
    if (gx < 0 || gy < 0 || gx >= GRID_W || gy >= GRID_H) return TERRAIN.MOUNTAIN;   // harita dışı = duvar
    return terrainGrid[_gi(gx, gy)];
}
function terrainTypeAt(wx, wy) {
    return gridTypeCell(Math.floor(wx / CELL_W), Math.floor(wy / CELL_H));
}
function isBridgeCell(gx, gy) { return bridgeSet != null && bridgeSet.has(gx + ',' + gy); }
function isBridgeAt(wx, wy) { return isBridgeCell(Math.floor(wx / CELL_W), Math.floor(wy / CELL_H)); }
function isPassableAt(wx, wy) {
    const gx = Math.floor(wx / CELL_W), gy = Math.floor(wy / CELL_H);
    const t = gridTypeCell(gx, gy);
    if (t === TERRAIN.MOUNTAIN) return false;
    if (t === TERRAIN.WATER) return isBridgeCell(gx, gy);
    return true;
}
// En yakın geçilebilir dünya-noktası (spiral arama) — deploy/itme için
function nearestPassable(wx, wy, maxR) {
    if (isPassableAt(wx, wy)) return { x: wx, y: wy };
    const gx0 = Math.floor(wx / CELL_W), gy0 = Math.floor(wy / CELL_H);
    const R = maxR || 24;
    for (let r = 1; r <= R; r++) {
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const gx = gx0 + dx, gy = gy0 + dy;
            if (gx < 0 || gy < 0 || gx >= GRID_W || gy >= GRID_H) continue;
            const t = gridTypeCell(gx, gy);
            const pass = t === TERRAIN.MOUNTAIN ? false : (t === TERRAIN.WATER ? isBridgeCell(gx, gy) : true);
            if (pass) return { x: (gx + 0.5) * CELL_W, y: (gy + 0.5) * CELL_H };
        }
    }
    return { x: wx, y: wy };
}
// ── YÜKSELTİ ALANI: dağ=1 / orman=0.18, box-blur ile yumuşat → 0..1 sürekli ──
function buildElevField() {
    let cur = new Float32Array(GRID_W * GRID_H);
    for (let i = 0; i < GRID_W * GRID_H; i++)
        cur[i] = terrainGrid[i] === TERRAIN.MOUNTAIN ? 1 : (terrainGrid[i] === TERRAIN.FOREST ? 0.18 : 0);
    for (let pass = 0; pass < 3; pass++) {
        const n = new Float32Array(GRID_W * GRID_H);
        for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) {
            let s = 0, c = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
                s += cur[ny * GRID_W + nx]; c++;
            }
            n[y * GRID_W + x] = s / c;
        }
        cur = n;
    }
    elevField = cur;
}
function gridElevationAt(wx, wy) {
    if (!elevField) return 0;
    const fx = wx / CELL_W - 0.5, fy = wy / CELL_H - 0.5;
    const x0 = Math.max(0, Math.min(GRID_W - 1, Math.floor(fx))), y0 = Math.max(0, Math.min(GRID_H - 1, Math.floor(fy)));
    const x1 = Math.min(GRID_W - 1, x0 + 1), y1 = Math.min(GRID_H - 1, y0 + 1);
    const tx = Math.max(0, Math.min(1, fx - x0)), ty = Math.max(0, Math.min(1, fy - y0));
    const a = elevField[y0 * GRID_W + x0], b = elevField[y0 * GRID_W + x1];
    const c2 = elevField[y1 * GRID_W + x0], d = elevField[y1 * GRID_W + x1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c2 * (1 - tx) + d * tx) * ty;
}
// ── IŞIN-TARAMA LOS: dağ her zaman keser; orman iki uç da dışındaysa keser ──
function gridLOSBlocked(x1, y1, x2, y2) {
    const t1 = terrainTypeAt(x1, y1), t2 = terrainTypeAt(x2, y2);
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    const steps = Math.ceil(len / (CELL_W * 0.6));
    if (steps <= 1) return false;
    for (let i = 1; i < steps; i++) {
        const x = x1 + dx * i / steps, y = y1 + dy * i / steps;
        const t = terrainTypeAt(x, y);
        if (t === TERRAIN.MOUNTAIN) return true;
        if (t === TERRAIN.FOREST && t1 !== TERRAIN.FOREST && t2 !== TERRAIN.FOREST) return true;
    }
    return false;
}
// ── AI için KABA daireler türet (terrainFeatures) — RENDER/LOS DEĞİL, sadece AI makro ──
function deriveCoarseFeatures() {
    terrainFeatures.length = 0;
    const B = 10;   // 10 hücre blok ≈ 227 dünya-px
    let seed = 700;
    for (let by = 0; by < GRID_H; by += B) for (let bx = 0; bx < GRID_W; bx += B) {
        let mC = 0, fC = 0, n = 0;
        for (let y = by; y < by + B && y < GRID_H; y++) for (let x = bx; x < bx + B && x < GRID_W; x++) {
            const t = terrainGrid[_gi(x, y)]; n++;
            if (t === TERRAIN.MOUNTAIN) mC++; else if (t === TERRAIN.FOREST) fC++;
        }
        const cx = (bx + B / 2) * CELL_W, cy = (by + B / 2) * CELL_H;
        if (mC > n * 0.45) terrainFeatures.push({ x: cx, y: cy, r: B * CELL_W * 0.62, type: TERRAIN.MOUNTAIN, seed: seed++ });
        else if (fC > n * 0.45) terrainFeatures.push({ x: cx, y: cy, r: B * CELL_W * 0.62, type: TERRAIN.FOREST, seed: seed++ });
    }
}
// ── RENDER: arazi ızgarasını dünya-canvas'a BİR KEZ bake et, sonra tek blit ──
function _cellHash(gx, gy, s) {            // 0..1 deterministik (tonlama için)
    let h = ((gx | 0) * 374761393 + (gy | 0) * 668265263 + (s | 0) * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const _GRASS = ['#46583a', '#4d603d', '#425438', '#506544', '#3f5035'];
function bakeGridTerrain() {
    if (typeof SIM !== 'undefined' && SIM.headless) return;
    if (typeof document === 'undefined' || !document.createElement) return;
    if (!terrainGrid) return;
    if (!terrainBakeCanvas) { terrainBakeCanvas = document.createElement('canvas'); terrainBakeCanvas.width = WORLD_W; terrainBakeCanvas.height = WORLD_H; terrainBakeCtx = terrainBakeCanvas.getContext('2d'); }
    const c = terrainBakeCtx;
    c.clearRect(0, 0, WORLD_W, WORLD_H);
    const tAt = (gx, gy) => (gx < 0 || gy < 0 || gx >= GRID_W || gy >= GRID_H) ? -1 : terrainGrid[_gi(gx, gy)];

    // 1) Taban hücreler
    for (let gy = 0; gy < GRID_H; gy++) for (let gx = 0; gx < GRID_W; gx++) {
        const t = terrainGrid[_gi(gx, gy)];
        const x = gx * CELL_W, y = gy * CELL_H, w = CELL_W + 1, h = CELL_H + 1;
        if (t === TERRAIN.WATER) {
            // kıyıya yakın su daha açık (sığ)
            let nearLand = false;
            for (let d = -1; d <= 1 && !nearLand; d++) for (let e = -1; e <= 1; e++) { const nt = tAt(gx + d, gy + e); if (nt !== TERRAIN.WATER && nt !== -1) { nearLand = true; break; } }
            c.fillStyle = nearLand ? '#5274c4' : '#3f5fb0';
            c.fillRect(x, y, w, h);
            if (_cellHash(gx, gy, 5) > 0.86) { c.fillStyle = 'rgba(180,205,245,0.30)'; c.fillRect(x + CELL_W * 0.3, y + CELL_H * 0.4, CELL_W * 0.4, CELL_H * 0.25); }   // dalga parıltısı
        } else if (t === TERRAIN.MOUNTAIN) {
            const v = _cellHash(gx, gy, 2);
            c.fillStyle = v > 0.66 ? '#727768' : v > 0.33 ? '#62675a' : '#545a4e';
            c.fillRect(x, y, w, h);
        } else if (t === TERRAIN.FOREST) {
            c.fillStyle = _cellHash(gx, gy, 3) > 0.5 ? '#2c4a2a' : '#264424';
            c.fillRect(x, y, w, h);
        } else {
            c.fillStyle = _GRASS[Math.floor(_cellHash(gx, gy, 1) * _GRASS.length)];
            c.fillRect(x, y, w, h);
        }
    }

    // 2) Kıyı çizgisi (kara, suya komşuysa koyu çizgi) + dağ etek gölgesi
    c.lineWidth = 2;
    for (let gy = 0; gy < GRID_H; gy++) for (let gx = 0; gx < GRID_W; gx++) {
        const t = terrainGrid[_gi(gx, gy)];
        const x = gx * CELL_W, y = gy * CELL_H;
        if (t !== TERRAIN.WATER) {
            // su komşusu var mı → kıyı kenarı
            const wR = tAt(gx + 1, gy) === TERRAIN.WATER, wL = tAt(gx - 1, gy) === TERRAIN.WATER;
            const wD = tAt(gx, gy + 1) === TERRAIN.WATER, wU = tAt(gx, gy - 1) === TERRAIN.WATER;
            if (wR || wL || wD || wU) {
                c.strokeStyle = 'rgba(30,45,80,0.55)'; c.beginPath();
                if (wR) { c.moveTo(x + CELL_W, y); c.lineTo(x + CELL_W, y + CELL_H); }
                if (wL) { c.moveTo(x, y); c.lineTo(x, y + CELL_H); }
                if (wD) { c.moveTo(x, y + CELL_H); c.lineTo(x + CELL_W, y + CELL_H); }
                if (wU) { c.moveTo(x, y); c.lineTo(x + CELL_W, y); }
                c.stroke();
            }
        }
    }

    // 3) Orman ağaç dokusu (deterministik nokta saçımı)
    for (let gy = 0; gy < GRID_H; gy++) for (let gx = 0; gx < GRID_W; gx++) {
        if (terrainGrid[_gi(gx, gy)] !== TERRAIN.FOREST) continue;
        const x = gx * CELL_W, y = gy * CELL_H;
        for (let k = 0; k < 2; k++) {
            const hx = _cellHash(gx, gy, 10 + k), hy = _cellHash(gx, gy, 20 + k), hr = _cellHash(gx, gy, 30 + k);
            const tx = x + hx * CELL_W, ty = y + hy * CELL_H, tr = 4 + hr * 4;
            c.fillStyle = 'rgba(8,20,10,0.40)'; c.beginPath(); c.ellipse(tx + tr * 0.3, ty + tr * 0.4, tr, tr * 0.6, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = hr > 0.5 ? '#1d4d28' : '#23592e'; c.beginPath(); c.arc(tx, ty, tr, 0, Math.PI * 2); c.fill();
        }
    }

    // 4) Dağ kaya dokusu (koyu benek)
    for (let gy = 0; gy < GRID_H; gy++) for (let gx = 0; gx < GRID_W; gx++) {
        if (terrainGrid[_gi(gx, gy)] !== TERRAIN.MOUNTAIN) continue;
        if (_cellHash(gx, gy, 40) < 0.5) continue;
        const x = gx * CELL_W, y = gy * CELL_H;
        c.fillStyle = 'rgba(35,38,32,0.45)';
        c.fillRect(x + CELL_W * 0.25, y + CELL_H * 0.3, CELL_W * 0.4, CELL_H * 0.3);
    }

    // 5) Köprüler (geçilebilir su-şeridi → ahşap)
    if (bridgeSet) {
        for (const key of bridgeSet) {
            const [gx, gy] = key.split(',').map(Number);
            const x = gx * CELL_W, y = gy * CELL_H;
            c.fillStyle = '#7a5a36'; c.fillRect(x, y, CELL_W + 1, CELL_H + 1);
            c.strokeStyle = 'rgba(60,42,22,0.8)'; c.lineWidth = 1.5;
            c.beginPath(); c.moveTo(x, y + CELL_H * 0.5); c.lineTo(x + CELL_W, y + CELL_H * 0.5); c.stroke();
        }
    }
}
function drawGridTerrain() {
    if (!terrainBakeCanvas) bakeGridTerrain();
    if (!terrainBakeCanvas) return;
    const viewW = canvas.width / zoom, viewH = canvas.height / zoom;
    const o = worldToScreen(camera.x, camera.y);
    ctx.drawImage(terrainBakeCanvas, camera.x, camera.y, viewW, viewH, o.x, o.y, canvas.width, canvas.height);
}

// ── ÇİZİLEN HARİTAYI UYGULA ──
function applyImageMap() {
    MAP_MODE = 'grid';
    buildTerrainGrid(DRAWN_MAP);
    deriveCoarseFeatures();                                   // AI uyumu (kaba daireler)
    if (typeof refreshSimTerrainCaches === 'function') refreshSimTerrainCaches();
    if (typeof currentElevSeed !== 'undefined') currentElevSeed = 4242;
    _elevDirty = true;
    terrainBakeCanvas = null;                                 // yeniden bake et
    if (typeof resetGroundCanvas === 'function') resetGroundCanvas();
    return -2;
}

// AÇILIŞ: çizilen harita varsayılan aktif harita (MapData.js applyMap(0)'ı ezer; AI.js sonra cache tazeler)
applyImageMap();
