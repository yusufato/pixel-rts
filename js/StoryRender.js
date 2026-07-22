// ═══════════════════════════════════════════════════════════════════════════
//  DÜNYA HARİTASI ÇİZİMİ — iki katmanlı harita, jetonlar, animasyon
//  ---------------------------------------------------------------------------
//  Story.js'ten AYRILDI (davranış değişmedi, yalnız kod taşındı).
//  Story.js 2625 satıra çıkmıştı; okunabilirlik için uyumlu parçalara bölündü.
//  Küresel script düzeni: bu dosya Story.js'ten SONRA yüklenir. Hepsi fonksiyon
//  tanımı olduğu için (hoisting) çağrı sırası etkilenmez.
// ═══════════════════════════════════════════════════════════════════════════

// ── RENDER (rAF, gameLoop story dalından çağrılır) ───────────────────────────
function storyWorldFrame(timestamp) {
    const last = STORY._lastFrameT || timestamp;
    let dt = (timestamp - last) / 1000;
    STORY._lastFrameT = timestamp;
    if (dt > 0.5) dt = 0.5;          // sekme arka plandayken sıçramayı engelle
    storyAdvance(dt);
    // KONSEY açıkken ~0.5sn'de bir paneli tazele (yaşayan-dünya değerleri; render-throttle'a binmesin, titremesin)
    if (STORY._councilOpen || STORY._armyOpen || STORY._techOpen || STORY._cityOpen) { STORY._accCouncil = (STORY._accCouncil || 0) + dt; if (STORY._accCouncil >= 0.5) { STORY._accCouncil = 0; if (STORY._councilOpen) storyCouncilUpdate(); if (STORY._armyOpen) storyArmyUpdate(); if (STORY._techOpen) storyTechUpdate(); if (STORY._cityOpen) storyCityUpdate(); } }
    // ~20fps render throttle (harita çoğunlukla durağan; pulse animasyonu için sürekli)
    if (timestamp - (STORY._lastRenderT || 0) >= 50) {
        STORY._lastRenderT = timestamp;
        storyRender();
    }
}

function storyResize() {
    const cv = document.getElementById('storyCanvas');
    if (!cv) return;
    const w = cv.clientWidth || 800, h = cv.clientHeight || 600;
    if (cv.width !== w) cv.width = w;
    if (cv.height !== h) cv.height = h;
}
// kamerayı dünya sınırlarında tut (zoom dahil görünen alan = w/zoom; dünya küçükse ortala)
function storyClampCam(w, h) {
    const vw = w / storyCam.zoom, vh = h / storyCam.zoom;
    if (STORY_WORLD_W <= vw) storyCam.x = (STORY_WORLD_W - vw) / 2;
    else storyCam.x = Math.max(0, Math.min(STORY_WORLD_W - vw, storyCam.x));
    if (STORY_WORLD_H <= vh) storyCam.y = (STORY_WORLD_H - vh) / 2;
    else storyCam.y = Math.max(0, Math.min(STORY_WORLD_H - vh, storyCam.y));
}
function storyCenterCamOnPlayer() {
    const n = storyNode(STORY.commander.node), cv = document.getElementById('storyCanvas');
    if (!n || !cv) return;
    storyResize();
    storyCam.x = n.lx * STORY_WORLD_W - (cv.width / storyCam.zoom) / 2;
    storyCam.y = n.ly * STORY_WORLD_H - (cv.height / storyCam.zoom) / 2;
    storyClampCam(cv.width, cv.height);
}

// Düğüm DÜNYA-konumu → EKRAN (kamera kaydır + zoom ölçek)
function storyNodePixel(n) {
    return { x: (n.lx * STORY_WORLD_W - storyCam.x) * storyCam.zoom, y: (n.ly * STORY_WORLD_H - storyCam.y) * storyCam.zoom };
}

// ── İKİ-KATMAN HARİTA (dinamik dünya): ───────────────────────────────────────────────────────
//  (1) TERRAIN tabanı — KULLANICININ çizdiği yazısız/politikasız fiziksel harita (terrain.png);
//      yoksa prosedürel terrain yedeği. STATİK.
//  (2) DİNAMİK POLİTİK katman — her ülke (Voronoi bölge) o anki SAHİBİNİN rengiyle yarı-saydam boyanır;
//      fetihte renk anında değişir → imparatorluklar büyür/küçülür. Sahiplik değişince yeniden çizilir.
//  Düşük-çöz hücre → nearest-neighbor upscale = chunky pixel. BÜYÜK dünya + KAMERA (sürükle/WASD).
let STORY_GW = 320, STORY_GH = 180;                  // politik/terrain hücre çözünürlüğü (terrain resmi gelince RESMİN çözünürlüğüne ayarlanır)
let STORY_WORLD_W = 3200, STORY_WORLD_H = 1800;      // dünya piksel boyutu (terrain resmi gelince oranına göre güncellenir)
const storyCam = { x: 0, y: 0, zoom: 1 };            // kamera: sol-üst köşe (dünya px) + zoom (fare tekerleği)

// (Eski terrain.png resim-yükleyici KALDIRILDI — file:// üzerinde getImageData "tainted canvas" hatası verdi.
//  Artık kara/deniz GÖMÜLÜ STORY_TERRAIN maskesinden okunur, terrain motorda boyanır → her yerde güvenli.)

// ülke kara-yarıçapı (normalize, prosedürel yedek için): büyükler geniş, adalar küçük → kıta + deniz (36 bölge)
const EUROPE_LAND_R = [
    0.034, 0.040, 0.040, 0.058, 0.060, 0.032, 0.052, 0.032, 0.030, 0.050,   //0-9
    0.058, 0.052, 0.052, 0.038, 0.050, 0.034, 0.034, 0.040, 0.040, 0.050,   //10-19
    0.040, 0.042, 0.046, 0.060, 0.085, 0.060, 0.044, 0.030, 0.040, 0.058,   //20-29
    0.080, 0.058, 0.066, 0.040, 0.070, 0.052                                //30-35
];

function storyHexRgb(hex) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [136, 136, 136];
}
// prosedürel arazi rengi (terrain.png yoksa): kuzey yeşil → güney çöl + dağ kahve + pixel doku
function storyTerrainColor(ny, hsh) {
    if (hsh > 0.90) return [120, 102, 70];
    if (ny > 0.70) { const v = 0.88 + hsh * 0.22; return [Math.min(255, 202 * v | 0), Math.min(255, 172 * v | 0), Math.min(255, 110 * v | 0)]; }
    const north = Math.max(0, 0.32 - ny) * 1.2, v = 0.82 + hsh * 0.26;
    return [Math.min(255, (92 - north * 55) * v | 0), Math.min(255, (142 - north * 36) * v | 0), Math.min(255, (80 - north * 18) * v | 0)];
}
function storyHash(x, y) { let h = (x * 73856093) ^ (y * 19349663); h = (h ^ (h >>> 13)) >>> 0; return (h % 1024) / 1024; }

// KARA-MASKE + ülke bölgeleri (her hücre = ülke-id ya da -1 deniz).
//  GÖMÜLÜ STORY_TERRAIN varsa (kullanıcının çizdiği harita, terrainData.js) ondan → getImageData YOK = file:// güvenli.
//  Yoksa PROSEDÜREL radius-blob yedeği.
function storyBuildLandGrid() {
    const nodes = STORY.nodes;
    if (typeof STORY_TERRAIN !== 'undefined' && STORY_TERRAIN.land) {
        const w = STORY_TERRAIN.w, h = STORY_TERRAIN.h, mask = STORY_TERRAIN.land;
        STORY_GW = w; STORY_GH = h;
        STORY_WORLD_W = 3000; STORY_WORLD_H = Math.round(3000 * h / w);   // dünya = harita oranı, ~3000 geniş → NN upscale
        const grid = new Array(w * h).fill(-1);
        for (let gy = 0; gy < h; gy++) {
            for (let gx = 0; gx < w; gx++) {
                if (mask.charCodeAt(gy * w + gx) !== 49) continue;        // '1' = kara
                const nx = (gx + 0.5) / w, ny = (gy + 0.5) / h;
                let best = -1, bd = Infinity;
                for (const n of nodes) { const dx = nx - n.lx, dy = ny - n.ly, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = n.id; } }
                grid[gy * w + gx] = best;
            }
        }
        STORY._landGrid = grid; STORY._ownerKey = null; STORY._terrainCache = null;
        return;
    }
    // PROSEDÜREL yedek (gömülü harita yoksa): ülke radius-blob → kıta + deniz
    const grid = new Array(STORY_GW * STORY_GH).fill(-1);
    for (let gy = 0; gy < STORY_GH; gy++) {
        for (let gx = 0; gx < STORY_GW; gx++) {
            const nx = (gx + 0.5) / STORY_GW, ny = (gy + 0.5) / STORY_GH;
            let best = -1, bestD = Infinity;
            for (const n of nodes) { const dx = nx - n.lx, dy = ny - n.ly, d = dx * dx + dy * dy; if (d < bestD) { bestD = d; best = n.id; } }
            if (best < 0) continue;
            const r = (EUROPE_LAND_R[best] != null) ? EUROPE_LAND_R[best] : 0.05;
            const jitter = (storyHash(gx, gy) - 0.5) * 0.024;
            if (Math.sqrt(bestD) <= r + jitter) grid[gy * STORY_GW + gx] = best;
        }
    }
    STORY._landGrid = grid; STORY._ownerKey = null; STORY._terrainCache = null;
}

// (1) TERRAIN tabanı — prosedürel (terrain.png yoksa). STATİK (arazi rengi, sahip YOK).
function storyEnsureTerrainCache() {
    if (STORY._terrainCache) return STORY._terrainCache;
    if (!STORY._landGrid) storyBuildLandGrid();
    const cv = document.createElement('canvas'); cv.width = STORY_GW; cv.height = STORY_GH;
    const g = cv.getContext('2d'); const grid = STORY._landGrid;
    const at = (x, y) => (x < 0 || y < 0 || x >= STORY_GW || y >= STORY_GH) ? -1 : grid[y * STORY_GW + x];
    for (let gy = 0; gy < STORY_GH; gy++) for (let gx = 0; gx < STORY_GW; gx++) {
        const id = grid[gy * STORY_GW + gx], hsh = storyHash(gx * 3 + 1, gy * 3 + 7);
        if (id < 0) {
            const coast = (at(gx - 1, gy) >= 0 || at(gx + 1, gy) >= 0 || at(gx, gy - 1) >= 0 || at(gx, gy + 1) >= 0);
            if (coast) g.fillStyle = 'rgb(64,118,158)';
            else { const s = Math.floor(hsh * 9); g.fillStyle = `rgb(${20 + s},${60 + s},${92 + s})`; }
        } else { const t = storyTerrainColor((gy + 0.5) / STORY_GH, hsh); g.fillStyle = `rgb(${t[0]},${t[1]},${t[2]})`; }
        g.fillRect(gx, gy, 1, 1);
    }
    STORY._terrainCache = cv; return cv;
}

// (2) DİNAMİK POLİTİK katman — her kara hücresi SAHİBİNİN rengiyle yarı-saydam; imparatorluk sınırı koyu+opak;
//  deniz şeffaf (terrain görünür). Sahiplik değişince yeniden çizilir (fetih → renk anında değişir).
function storyEnsureOwnerOverlay() {
    if (!STORY._landGrid) storyBuildLandGrid();
    const key = STORY.nodes.map(n => n.owner).join(',');
    if (STORY._ownerCache && STORY._ownerKey === key) return STORY._ownerCache;
    let cv = STORY._ownerCache;
    if (!cv) { cv = document.createElement('canvas'); cv.width = STORY_GW; cv.height = STORY_GH; STORY._ownerCache = cv; }
    const g = cv.getContext('2d'); g.clearRect(0, 0, STORY_GW, STORY_GH);
    const grid = STORY._landGrid;
    const ownerAt = (x, y) => { if (x < 0 || y < 0 || x >= STORY_GW || y >= STORY_GH) return -1; const id = grid[y * STORY_GW + x]; return id < 0 ? -1 : STORY.nodes[id].owner; };
    for (let gy = 0; gy < STORY_GH; gy++) for (let gx = 0; gx < STORY_GW; gx++) {
        const id = grid[gy * STORY_GW + gx];
        if (id < 0) continue;                              // deniz → şeffaf (terrain görünür)
        const ow = STORY.nodes[id].owner;
        const oc = storyHexRgb((storyState(ow) || {}).color || '#888888');
        const bord = (ownerAt(gx + 1, gy) !== ow && ownerAt(gx + 1, gy) !== -1) || (ownerAt(gx, gy + 1) !== ow && ownerAt(gx, gy + 1) !== -1)
                  || (ownerAt(gx - 1, gy) !== ow && ownerAt(gx - 1, gy) !== -1) || (ownerAt(gx, gy - 1) !== ow && ownerAt(gx, gy - 1) !== -1);
        if (bord) g.fillStyle = `rgba(${oc[0] * 0.45 | 0},${oc[1] * 0.45 | 0},${oc[2] * 0.45 | 0},0.95)`;  // imparatorluk sınırı
        else g.fillStyle = `rgba(${oc[0]},${oc[1]},${oc[2]},0.40)`;                                          // iç bölge: terrain görünsün
        g.fillRect(gx, gy, 1, 1);
    }
    STORY._ownerKey = key; return cv;
}

function storyRender() {
    const cv = document.getElementById('storyCanvas');
    if (!cv) return;
    storyResize();
    const g = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    storyClampCam(w, h);
    g.clearRect(0, 0, w, h);
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#235a7e'; g.fillRect(0, 0, w, h);   // dünya kenarı boşluğu / deniz zemini
    const z = storyCam.zoom;
    // (1) TERRAIN tabanı — gömülü kullanıcı haritasından (STORY_TERRAIN) prosedürel boyanır; kamera+zoom, crisp
    const terr = storyEnsureTerrainCache();
    g.drawImage(terr, 0, 0, STORY_GW, STORY_GH, -storyCam.x * z, -storyCam.y * z, STORY_WORLD_W * z, STORY_WORLD_H * z);
    // (2) DİNAMİK POLİTİK katman (sahip-rengi yarı-saydam) — terrain üstüne; fetihte renk anında değişir
    const ovl = storyEnsureOwnerOverlay();
    g.drawImage(ovl, 0, 0, STORY_GW, STORY_GH, -storyCam.x * z, -storyCam.y * z, STORY_WORLD_W * z, STORY_WORLD_H * z);
    STORY._imgMode = false;
    // War Room renk işlemi: arazi okunur kalırken amber terminal kontrastına yaklaşır.
    g.fillStyle = 'rgba(2,8,4,0.30)'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,176,0,0.055)'; g.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 60) { g.beginPath(); g.moveTo(gx, 0); g.lineTo(gx, h); g.stroke(); }
    for (let gy = 0; gy < h; gy += 60) { g.beginPath(); g.moveTo(0, gy); g.lineTo(w, gy); g.stroke(); }

    // (3) ŞEHİR/KAYNAK işaretleri (🔴şehir/insan, 🟠petrol, 🟢puan) — dünya konumları, kamera+zoom
    if (typeof STORY_TERRAIN !== 'undefined') {
        const drawMarks = (arr, col, sz) => {
            for (const p of (arr || [])) {
                const sx = (p[0] * STORY_WORLD_W - storyCam.x) * z, sy = (p[1] * STORY_WORLD_H - storyCam.y) * z;
                if (sx < -8 || sy < -8 || sx > w + 8 || sy > h + 8) continue;
                g.fillStyle = '#000'; g.fillRect(sx - sz - 1, sy - sz - 1, 2 * sz + 2, 2 * sz + 2);
                g.fillStyle = col; g.fillRect(sx - sz, sy - sz, 2 * sz, 2 * sz);
            }
        };
        drawMarks(STORY_TERRAIN.oil, '#ff8a00', 2);     // petrol
        drawMarks(STORY_TERRAIN.pts, '#3cdc6e', 2);     // puan
        drawMarks(STORY_TERRAIN.cities, '#ff3636', 2);  // şehir (insan gücü)
    }

    const cmdNode = STORY.commander.node;
    const adj = storyNode(cmdNode) ? storyNode(cmdNode).neighbors : [];

    // KOMUTANIN ulaşabildiği komşu bağlantıları (yeşil=kendi bölge, kırmızı=saldırı) — sade
    const cmdP = storyNode(cmdNode) ? storyNodePixel(storyNode(cmdNode), w, h) : null;
    if (cmdP) {
        g.lineWidth = 2;
        for (const mId of adj) {
            const m = storyNode(mId); const b = storyNodePixel(m, w, h);
            g.strokeStyle = (m.owner === STORY.playerStateId) ? 'rgba(120,235,160,0.5)' : 'rgba(255,90,90,0.6)';
            g.beginPath(); g.moveTo(cmdP.x, cmdP.y); g.lineTo(b.x, b.y); g.stroke();
        }
    }

    // DÜĞÜMLER
    for (const n of STORY.nodes) {
        const p = storyNodePixel(n, w, h);
        const st = storyState(n.owner);
        const isCmd = (n.id === cmdNode);
        const isSelected = (n.id === STORY.selectedNodeId);
        const attackable = (adj.indexOf(n.id) >= 0 && n.owner !== STORY.playerStateId);
        const moveable = (adj.indexOf(n.id) >= 0 && n.owner === STORY.playerStateId);
        // ŞEHİR/BAŞKENT işareti — pixel KARE (sahip rengi + siyah kontur)
        const sq = isCmd ? 9 : 6;
        const px = Math.round(p.x), py = Math.round(p.y);
        g.fillStyle = '#000'; g.fillRect(px - sq - 1, py - sq - 1, 2 * sq + 2, 2 * sq + 2);
        g.fillStyle = st ? st.color : '#888';
        g.fillRect(px - sq, py - sq, 2 * sq, 2 * sq);
        // saldırılabilir → kırmızı nabız kare-halka ; ilerlenebilir → yeşil kare-halka
        if (attackable) {
            const pulse = Math.round(3 + 2 * (1 + Math.sin(STORY.clock * 4 + n.id)));
            g.strokeStyle = 'rgba(255,70,70,0.95)'; g.lineWidth = 2;
            g.strokeRect(px - sq - pulse, py - sq - pulse, 2 * (sq + pulse), 2 * (sq + pulse));
        } else if (moveable) {
            g.strokeStyle = 'rgba(120,235,160,0.75)'; g.lineWidth = 2;
            g.strokeRect(px - sq - 3, py - sq - 3, 2 * (sq + 3), 2 * (sq + 3));
        }
        if (isSelected) {
            const r = sq + 8;
            g.strokeStyle = '#ffb000'; g.lineWidth = 2;
            g.strokeRect(px - r, py - r, r * 2, r * 2);
            g.fillStyle = '#ffe9bf'; g.font = '9px monospace'; g.textAlign = 'center'; g.textBaseline = 'bottom';
            g.fillText('SELECT', px, py - r - 3);
        }
        // (harita üstünde YAZI YOK — kullanıcı isteği; ülke adları yan panelde gösterilir)
        // oyuncu komutanı — şehir merkezinde kısa terminal etiketi
        if (isCmd) {
            g.font = 'bold 8px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillStyle = '#060a06'; g.fillRect(px - 12, py - 5, 24, 10);
            g.fillStyle = '#ffd27a'; g.fillText('CMD', px, py + 1);
        }
    }
    // FAZ-2: TÜM KOMUTANLARI çiz (devlet-renkli küçük token, şehrin üstünde dizili)
    // KUŞATMA göstergesi: kuşatılan şehirde kırmızı çift-halka + terminal etiketi
    for (const node of STORY.nodes) {
        if (!node._siege) continue;
        const sp = storyNodePixel(node);
        g.lineWidth = 2; g.strokeStyle = 'rgba(255,80,40,0.95)';
        g.beginPath(); g.arc(sp.x, sp.y, 10, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = 'rgba(255,80,40,0.45)';
        g.beginPath(); g.arc(sp.x, sp.y, 14, 0, Math.PI * 2); g.stroke();
        g.font = '8px monospace'; g.textAlign = 'center'; g.fillStyle = '#ffce4c';
        g.fillText('SIEGE', sp.x, sp.y - 17);
    }
    const cmdByCity = {};
    for (const st of STORY.states) for (const c of (st.gov && st.gov.commanders ? st.gov.commanders : [])) { if (c.node == null || !storyNode(c.node)) continue; (cmdByCity[c.node] = cmdByCity[c.node] || []).push(st.id); }
    for (const cityId in cmdByCity) {
        const node = storyNode(+cityId); if (!node) continue;
        const cp = storyNodePixel(node); const list = cmdByCity[cityId];
        for (let i = 0; i < list.length; i++) {
            const cx = Math.round(cp.x + (i - (list.length - 1) / 2) * 7), cy = Math.round(cp.y - 13);
            g.beginPath(); g.moveTo(cx, cy - 4); g.lineTo(cx - 4, cy + 4); g.lineTo(cx + 4, cy + 4); g.closePath();
            g.fillStyle = (storyState(list[i]) || {}).color || '#fff'; g.fill();
            g.lineWidth = 1; g.strokeStyle = '#000'; g.stroke();
        }
    }
    // KONSEY: tıklanan komutanın şehrinde yeşil nabız halka (~1.5sn, 30 kare)
    if (STORY._pulse > 0 && STORY._pulseNode != null) {
        const pn = storyNode(STORY._pulseNode);
        if (pn) { const pp = storyNodePixel(pn), t = STORY._pulse / 30, r = 14 + (1 - t) * 24;
            g.strokeStyle = `rgba(76,255,124,${(t * 0.9).toFixed(2)})`; g.lineWidth = 3;
            g.beginPath(); g.arc(pp.x, pp.y, r, 0, Math.PI * 2); g.stroke(); }
        STORY._pulse--;
    }
    storyPanelUpdate();
}
