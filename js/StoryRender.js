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
// ZOOM-OUT SINIRI: tüm dünya (üst şerit dahil, sxOf(0) en geniş) ekrana ~1.15 marjla
// sığdığında dur → harita dışını çok gösterme (kullanıcı isteği). Yüksekliği de sığdır.
function storyMinZoom(w, h) {
    const zW = w / (STORY_WORLD_W * storySxOf(0) * 1.12);   // genişlik kısıtı (en geniş üst şerit)
    const zH = h / (STORY_WORLD_H * 1.06);                  // yükseklik kısıtı (vyOf(1)=h)
    return Math.max(zW, zH);
}
// kamerayı sınırlarda tut — WARP farkında. Ortalama: dünya merkezi EKRAN merkezine
// (warp yatay ölçeği W/2 etrafında olduğu için cam.x = WORLD/2 − (w/2)/z; sxOf ÇARPANI YOK
// — eski formül sxOf(0)'ı katıp sürekli sola kaydırıyordu).
function storyClampCam(w, h) {
    STORY._cw = w; STORY._ch = h;
    storyCam.zoom = Math.max(storyMinZoom(w, h), Math.min(5, storyCam.zoom));
    const z = storyCam.zoom;
    const visW = w / z / storySxOf(0);                // üst (en geniş) şeritte görünen dünya-genişliği
    if (visW >= STORY_WORLD_W) storyCam.x = STORY_WORLD_W / 2 - (w / 2) / z;   // sığıyor → dünya merkezini ekran merkezine
    else storyCam.x = Math.max(-w * 0.04 / z, Math.min(STORY_WORLD_W - visW * 0.92, storyCam.x));
    const visH = storyVyOf(1) / z;                    // görünen dünya-yüksekliği
    if (visH >= STORY_WORLD_H) storyCam.y = STORY_WORLD_H / 2 - storyVyOf(0.5) / z;
    else storyCam.y = Math.max(-visH * 0.06, Math.min(STORY_WORLD_H - visH * 0.86, storyCam.y));
}
function storyCenterCamOnPlayer() {
    const n = storyNode(STORY.commander.node), cv = document.getElementById('storyCanvas');
    if (!n || !cv) return;
    storyResize();
    STORY._cw = cv.width; STORY._ch = cv.height;                     // WARP: düğüm ekran ortasına (u=0.5)
    storyCam.x = n.lx * STORY_WORLD_W - (cv.width / 2) / storyCam.zoom;
    storyCam.y = n.ly * STORY_WORLD_H - storyVyOf(0.5) / storyCam.zoom;
    storyClampCam(cv.width, cv.height);
}

// Düğüm DÜNYA-konumu → EKRAN (2.5D warp). u = perspektif ölçeği (jeton boyutu).
function storyNodePixel(n) {
    const s = storyW2S(n.lx * STORY_WORLD_W, n.ly * STORY_WORLD_H);
    return { x: s.x, y: s.y, u: s.u };
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

// ── 2.5D PERSPEKTİF WARP (design teslimi "hologram" — mode-7 şerit warp) ─────
//  Komuta masası hologramı: harita ekrana yatık düşer. CSS transform DEĞİL,
//  canvas şerit-warp — çünkü tıklama (hit-test) tersinir olmalı. Tüm ekran↔dünya
//  dönüşümü storyW2S/storyS2W çiftinden geçer; render de giriş de aynı matematiği
//  kullanır → jeton nereye çizilirse tıklama oraya düşer.
//    u = ekranY/H (0=üst/uzak, 1=alt/yakın)
//    sxOf(u): satır yatay ölçeği — üst dar (uzak), alt geniş (yakın)
//    vyOf(u): ekran satırı → düz-görünüm y'si ; uOfVy: tersi
const STORY_PP = 0.5;                                 // eğim gücü — design v3 gerçekçi harita değeri
function storySxOf(u) { return (1 + STORY_PP * u) * (1 + STORY_PP * u) / (1 + STORY_PP); }
function storyVyOf(u) { const H = STORY._ch || 600; return H * (1 + STORY_PP) * u / (1 + STORY_PP * u); }
function storyUOfVy(vy) { const H = STORY._ch || 600; const v = vy / H; return v / (1 + STORY_PP - STORY_PP * v); }
// dünya (px) → ekran; döner {x,y,u}. u perspektif ölçeği için (jeton boyutu).
function storyW2S(wx, wy) {
    const W = STORY._cw || 800, z = storyCam.zoom;
    const vx = (wx - storyCam.x) * z, vy = (wy - storyCam.y) * z;
    const u = storyUOfVy(vy);
    return { x: (vx - W / 2) * storySxOf(u) + W / 2, y: u * (STORY._ch || 600), u };
}
// ekran → dünya (px) — tıklama/sürükleme/zoom tersinimi
function storyS2W(X, Y) {
    const W = STORY._cw || 800, H = STORY._ch || 600, z = storyCam.zoom;
    const u = Y / H, vy = storyVyOf(u), vx = (X - W / 2) / storySxOf(u) + W / 2;
    return { x: storyCam.x + vx / z, y: storyCam.y + vy / z };
}
// perspektif ölçeği: yakın (alt) büyük, uzak (üst) küçük (jeton/etiket boyutu)
function storyPScale(u) { return 0.62 + storySxOf(Math.max(0, Math.min(1, u))) * 0.5; }
// bir önbellek tuvalini (kendi çözünürlüğü, dünya 0..STORY_WORLD kaplar) warp'lı çiz.
// kx/ky KAYNAĞIN kendi boyutundan: terrain 1500px, owner overlay 300px olabilir.
function storyBlitWarp(g, src, alpha) {
    const W = STORY._cw, H = STORY._ch, z = storyCam.zoom, band = 3;
    const kx = src.width / STORY_WORLD_W, ky = src.height / STORY_WORLD_H;
    if (alpha != null) g.globalAlpha = alpha;
    for (let ys = 0; ys < H; ys += band) {
        const u0 = ys / H, u1 = Math.min(1, (ys + band) / H);
        const wy0 = storyCam.y + storyVyOf(u0) / z, wy1 = storyCam.y + storyVyOf(u1) / z;
        const sxc = storySxOf((u0 + u1) / 2);
        const srcXw = storyCam.x + (W / 2 * (1 - 1 / sxc)) / z, srcWw = W / (sxc * z);
        const sh = Math.max(0.01, (wy1 - wy0) * ky);
        try { g.drawImage(src, srcXw * kx, wy0 * ky, srcWw * kx, sh, 0, ys, W, band + 0.6); } catch (e) {}
    }
    if (alpha != null) g.globalAlpha = 1;
}

// (Eski terrain.png resim-yükleyici KALDIRILDI — file:// üzerinde getImageData "tainted canvas" hatası verdi.
//  Artık kara/deniz GÖMÜLÜ STORY_TERRAIN maskesinden okunur, terrain motorda boyanır → her yerde güvenli.)

// ── DESIGN "GERÇEKÇİ HARİTA" (v3) — rölyef + hillshade + batimetri ────────────
// Design ekibinin renderWorld tekniği (harita-yonleri.html) oyun terrain'ine taşındı:
// yükseklik alanı (kıyı mesafesi + gürültü + dağ sıraları) → biyom renkleri (enlem
// bantları: çöl/step/boreal + kar) → HILLSHADE (KB güneş) → batimetrik deniz (kıta
// sahanlığı→derin→abisal). Nehirler + kıyı/cephe mesh'leri üstüne çizilir. STATİK,
// bir kez üretilir (STORY._geoTerrain) — politik katman DİNAMİK kalır (owner overlay).
function _geoHash2(x, y) { let n = x * 374761393 + y * 668265263; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) >>> 0) / 4294967295; }
function _geoVNoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = _geoHash2(xi, yi), b = _geoHash2(xi + 1, yi), c = _geoHash2(xi, yi + 1), d = _geoHash2(xi + 1, yi + 1);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function _geoFbm(x, y, oct) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * _geoVNoise(x * f, y * f); f *= 2; a *= 0.5; } return s; }
function _geoDistT(mask, w, h, inside) {
    const D = new Float32Array(w * h), INF = 1e9;
    for (let i = 0; i < w * h; i++) D[i] = (mask[i] === inside) ? INF : 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; let d = D[i];
        if (x > 0) d = Math.min(d, D[i - 1] + 1); if (y > 0) d = Math.min(d, D[i - w] + 1);
        if (x > 0 && y > 0) d = Math.min(d, D[i - w - 1] + 1.41); if (x < w - 1 && y > 0) d = Math.min(d, D[i - w + 1] + 1.41); D[i] = d; }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; let d = D[i];
        if (x < w - 1) d = Math.min(d, D[i + 1] + 1); if (y < h - 1) d = Math.min(d, D[i + w] + 1);
        if (x < w - 1 && y < h - 1) d = Math.min(d, D[i + w + 1] + 1.41); if (x > 0 && y < h - 1) d = Math.min(d, D[i + w - 1] + 1.41); D[i] = d; }
    return D;
}
// enlem tahmini (GEO-y → lat): bbox lat 22..63'e doğrusal yakınsama (biyom bantları için yeterli)
function _geoLatAt(yGeo) { return 63 - (yGeo / GEO.H) * 41; }
function storyGeoTerrainCache() {
    if (STORY._geoTerrain) return STORY._geoTerrain;
    // GÜVENLİK: gerçek canvas gerektirir (createImageData/putImageData). jsdom stub'ında
    // ya da başarısızlıkta düz zemine düş — render çökmesin (testler + tarayıcı-dışı güvenli).
    try {
        const _t = document.createElement('canvas'); _t.width = 4; _t.height = 4;
        const _c = _t.getContext('2d'); const _im = _c.createImageData(2, 2);
        if (!_im || !_im.data || _im.data.length < 16) throw new Error('stub canvas');
    } catch (e) {
        const fb = document.createElement('canvas'); fb.width = 8; fb.height = 8;
        try { const c = fb.getContext('2d'); c.fillStyle = '#12321e'; c.fillRect(0, 0, 8, 8); } catch (_) {}
        STORY._geoTerrain = fb; return fb;
    }
    const GW = 820, GH = Math.round(GW * GEO.H / GEO.W), K = GW / GEO.W;
    const lm = new Uint8Array(GW * GH);
    // kara maskesi — GEO.land poligonları scanline (even-odd → iç denizler kendiliğinden)
    for (const ring of GEO.land) for (let gy = 0; gy < GH; gy++) {
        const y = (gy + 0.5) / K, xs = [];
        for (let i = 0; i < ring.length; i++) {
            const x1 = ring[i][0], y1 = ring[i][1], x2 = ring[(i + 1) % ring.length][0], y2 = ring[(i + 1) % ring.length][1];
            if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + (y - y1) / (y2 - y1) * (x2 - x1));
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) { const a = Math.max(0, Math.ceil(xs[k] * K - 0.5)), b = Math.min(GW - 1, Math.floor(xs[k + 1] * K - 0.5)); for (let gx = a; gx <= b; gx++) lm[gy * GW + gx] ^= 1; }
    }
    const distSea = _geoDistT(lm, GW, GH, 1), distLand = _geoDistT(lm, GW, GH, 0);
    // dağ yükseklik alanı — GEO.ranges (segment mesafesi)
    const mtn = new Float32Array(GW * GH);
    for (const rg of GEO.ranges) {
        const pts = rg.pts.map(p => [p[0] * K, p[1] * K]), rr = rg.r * K, rr2 = rr * rr, peak = rg.str;
        const segs = [];
        for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]]);
        if (!segs.length) segs.push([pts[0][0], pts[0][1], pts[0][0], pts[0][1]]);
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const s of segs) { x0 = Math.min(x0, s[0], s[2]); x1 = Math.max(x1, s[0], s[2]); y0 = Math.min(y0, s[1], s[3]); y1 = Math.max(y1, s[1], s[3]); }
        x0 = Math.max(0, Math.floor(x0 - rr)); x1 = Math.min(GW - 1, Math.ceil(x1 + rr)); y0 = Math.max(0, Math.floor(y0 - rr)); y1 = Math.min(GH - 1, Math.ceil(y1 + rr));
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            let best = 1e9;
            for (const [ax, ay, bx, by] of segs) { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy; let t = L > 0 ? ((x - ax) * dx + (y - ay) * dy) / L : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; const qx = ax + dx * t - x, qy = ay + dy * t - y, d = qx * qx + qy * qy; if (d < best) best = d; }
            if (best > rr2) continue;
            const t = 1 - Math.sqrt(best) / rr, ridge = 0.72 + 0.28 * _geoFbm(x * 0.09, y * 0.09, 3), v = peak * Math.pow(t, 1.45) * ridge, i = y * GW + x;
            if (v > mtn[i]) mtn[i] = v;
        }
    }
    // yükseklik
    const elev = new Float32Array(GW * GH);
    for (let i = 0; i < GW * GH; i++) { if (!lm[i]) continue; const x = i % GW, y = (i / GW) | 0; const coastal = Math.min(1, distSea[i] / 26); elev[i] = Math.min(1, coastal * 0.16 + _geoFbm(x * 0.035, y * 0.035, 4) * 0.17 + _geoFbm(x * 0.14, y * 0.14, 2) * 0.05 + mtn[i] * 0.92); }
    const lerp = (a, b, t) => a + (b - a) * t, mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
    const small = document.createElement('canvas'); small.width = GW; small.height = GH;
    const sc = small.getContext('2d'), img = sc.createImageData(GW, GH), px = img.data;
    for (let y = 0; y < GH; y++) { const lat = _geoLatAt(y / K);
        for (let x = 0; x < GW; x++) {
            const i = y * GW + x, o = i * 4;
            if (!lm[i]) { const d = distLand[i], shelf = Math.min(1, d / 16), deep = Math.min(1, d / 95); let c = mix([86, 150, 168], [42, 104, 140], shelf); c = mix(c, [16, 48, 84], deep * deep); c = mix(c, [10, 32, 62], Math.min(1, d / 220)); const n = (_geoFbm(x * 0.05, y * 0.05, 3) - 0.5) * 10; px[o] = c[0] + n; px[o + 1] = c[1] + n; px[o + 2] = c[2] + n; px[o + 3] = 255; continue; }
            const e = elev[i];
            const arid = lat < 32 ? 1 : lat < 37 ? (37 - lat) / 5 : 0, boreal = lat > 56 ? Math.min(1, (lat - 56) / 7) : 0;
            const inland = Math.min(1, distSea[i] / 70), steppe = Math.max(0, Math.min(1, (inland - 0.35) * 1.6)) * (lat < 50 ? 0.7 : 0.3);
            let c;
            if (e < 0.14) c = [104, 132, 86]; else if (e < 0.30) c = mix([104, 132, 86], [126, 138, 84], (e - 0.14) / 0.16);
            else if (e < 0.46) c = mix([126, 138, 84], [150, 138, 96], (e - 0.30) / 0.16); else if (e < 0.62) c = mix([150, 138, 96], [146, 124, 100], (e - 0.46) / 0.16);
            else if (e < 0.76) c = mix([146, 124, 100], [140, 132, 126], (e - 0.62) / 0.14); else c = mix([140, 132, 126], [240, 242, 246], Math.min(1, (e - 0.76) / 0.16));
            if (boreal > 0 && e < 0.6) c = mix(c, [62, 88, 66], boreal * 0.75);
            if (steppe > 0 && e < 0.5) c = mix(c, [164, 158, 104], steppe * 0.6);
            if (arid > 0 && e < 0.62) c = mix(c, [206, 180, 124], arid * 0.92);
            if (distSea[i] < 2.2) c = mix(c, [186, 176, 140], 0.35);
            const eL = elev[i - 1] || 0, eR = elev[i + 1] || 0, eU = elev[i - GW] || 0, eD = elev[i + GW] || 0;
            const nx = (eL - eR) * 7.5, ny = (eU - eD) * 7.5; let sh = (nx * 0.62 + ny * 0.62 + 1.0) / 2.0; sh = Math.max(0.35, Math.min(1.5, sh * 1.05 + 0.28));
            const amb = 1 + e * 0.06;
            px[o] = Math.max(0, Math.min(255, c[0] * sh * amb)); px[o + 1] = Math.max(0, Math.min(255, c[1] * sh * amb)); px[o + 2] = Math.max(0, Math.min(255, c[2] * sh * amb)); px[o + 3] = 255;
        }
    }
    sc.putImageData(img, 0, 0);
    // tam çözünürlük worldBase (pürüzsüz upscale) + nehirler + mesh'ler
    const BW = GEO.W, BH = GEO.H, base = document.createElement('canvas'); base.width = BW; base.height = BH;
    const ctx = base.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small, 0, 0, GW, GH, 0, 0, BW, BH);
    const poly = (arr, close) => { ctx.beginPath(); for (const line of arr) { line.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); if (close) ctx.closePath(); } };
    // nehirler
    for (const rv of GEO.rivers) { ctx.beginPath(); rv.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(24,58,84,.55)'; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = 'rgba(96,150,186,.85)'; ctx.lineWidth = 3; ctx.stroke(); }
    // iç sınır (kesikli) + kıyı + cephe
    ctx.setLineDash([7, 5]); poly(GEO.inner); ctx.strokeStyle = 'rgba(60,52,34,.45)'; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.stroke(); ctx.setLineDash([]);
    poly(GEO.coast); ctx.strokeStyle = 'rgba(28,44,58,.85)'; ctx.lineWidth = 1.8; ctx.stroke();
    poly(GEO.front); ctx.strokeStyle = 'rgba(70,16,16,.85)'; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#e04a4a'; ctx.lineWidth = 2.4; ctx.stroke();
    STORY._geoTerrain = base; return base;
}

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
    // ── GERÇEK AVRUPA KIYILARI (geoData poligonları → scanline even-odd raster) ──
    // Design teslimi: Natural Earth kıyı çizgileri. Delikler (iç denizler) even-odd
    // ile kendiliğinden çıkar. Politik katman aynı kalır: hücre → en yakın şehir.
    if (STORY._geoMap && typeof GEO !== 'undefined') {
        const w = 300, h = Math.round(300 * GEO.H / GEO.W);
        STORY_GW = w; STORY_GH = h;
        STORY_WORLD_W = 3000; STORY_WORLD_H = Math.round(3000 * h / w);
        const landMask = new Uint8Array(w * h);
        const sx = w / GEO.W, sy = h / GEO.H;
        for (const ring of GEO.land) {
            for (let gy = 0; gy < h; gy++) {
                const y = (gy + 0.5) / sy;
                const xs = [];
                for (let i = 0; i < ring.length; i++) {
                    const x1 = ring[i][0], y1 = ring[i][1];
                    const x2 = ring[(i + 1) % ring.length][0], y2 = ring[(i + 1) % ring.length][1];
                    if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + (y - y1) / (y2 - y1) * (x2 - x1));
                }
                xs.sort((a, b) => a - b);
                for (let k = 0; k + 1 < xs.length; k += 2) {
                    const a = Math.max(0, Math.ceil(xs[k] * sx - 0.5)), b = Math.min(w - 1, Math.floor(xs[k + 1] * sx - 0.5));
                    for (let gx = a; gx <= b; gx++) landMask[gy * w + gx] ^= 1;
                }
            }
        }
        const grid = new Array(w * h).fill(-1);
        for (let gy = 0; gy < h; gy++) for (let gx = 0; gx < w; gx++) {
            if (!landMask[gy * w + gx]) continue;
            const nx = (gx + 0.5) / w, ny = (gy + 0.5) / h;
            let best = -1, bd = Infinity;
            for (const n of nodes) { const dx = nx - n.lx, dy = ny - n.ly, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = n.id; } }
            grid[gy * w + gx] = best;
        }
        STORY._landGrid = grid; STORY._ownerKey = null; STORY._terrainCache = null;
        return;
    }
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
    // DESIGN "GERÇEKÇİ HARİTA" (v3): geo modda rölyef+hillshade+batimetri terrain'i kullan
    if (STORY._geoMap && typeof GEO !== 'undefined' && typeof storyGeoTerrainCache === 'function') {
        STORY._terrainCache = storyGeoTerrainCache(); return STORY._terrainCache;
    }
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
        // DESIGN v3: gerçekçi rölyef görünsün → politik tint HAFİF (sınır belirgin, iç bölge şeffaf)
        if (bord) g.fillStyle = `rgba(${oc[0] * 0.5 | 0},${oc[1] * 0.5 | 0},${oc[2] * 0.5 | 0},0.9)`;  // imparatorluk sınırı
        else g.fillStyle = `rgba(${oc[0]},${oc[1]},${oc[2]},0.20)`;                                     // iç bölge: rölyef görünsün
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
    STORY._cw = w; STORY._ch = h;
    g.clearRect(0, 0, w, h);
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#03080f'; g.fillRect(0, 0, w, h);   // hologram zemini (uzay/deniz karası)
    const z = storyCam.zoom;
    // (1) TERRAIN tabanı — 2.5D warp'lı şerit-blit (gerçek kıyı çizgileri yatık düşer)
    const terr = storyEnsureTerrainCache();
    storyBlitWarp(g, terr);
    // (2) DİNAMİK POLİTİK katman (sahip-rengi yarı-saydam) — warp'lı; fetihte renk anında değişir
    const ovl = storyEnsureOwnerOverlay();
    storyBlitWarp(g, ovl);
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
                const s = storyW2S(p[0] * STORY_WORLD_W, p[1] * STORY_WORLD_H);
                if (s.u < -0.04 || s.u > 1.05 || s.x < -8 || s.x > w + 8) continue;
                const sx = s.x, sy = s.y;
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
        // ŞEHİR/BAŞKENT işareti — pixel KARE (sahip rengi + siyah kontur), perspektif ölçekli
        const sc = storyPScale(p.u);
        const tierBoost = n.geo ? (n.level >= 3 ? 1.7 : n.level >= 2 ? 1.25 : 1) : 1;   // başkent/büyük şehir iri
        const sq = Math.round((isCmd ? 9 : 5.5) * sc * tierBoost);
        const px = Math.round(p.x), py = Math.round(p.y);
        g.fillStyle = '#000'; g.fillRect(px - sq - 1, py - sq - 1, 2 * sq + 2, 2 * sq + 2);
        g.fillStyle = st ? st.color : '#888';
        g.fillRect(px - sq, py - sq, 2 * sq, 2 * sq);
        // ── DESIGN İKONLARI: fabrika bacası / petrol kulesi / maden kazması / kışla flaması ──
        // Yakınlaşınca ya da büyük şehirlerde göster (uzak/küçük şehirde kalabalık yapmasın).
        const detail = storyCam.zoom > storyMinZoom(w, h) * 1.55 || (n.level || 1) >= 2;
        if (detail && p.u > -0.05 && p.u < 1.05 && px > -30 && px < w + 30) {
            const ic = Math.max(0.7, sc);
            if ((n.fac | 0) > 0) {                          // FABRİKA: gövde + baca sayısı = seviye
                const fx = px + sq + 2, fy = py - 2;
                g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(fx - 1, fy - 6 * ic, 10 * ic, 7 * ic);
                g.fillStyle = '#c8b070'; g.fillRect(fx, fy - 5 * ic, 8 * ic, 5.5 * ic);
                for (let k = 0; k < Math.min(n.fac | 0, 3); k++) { g.fillStyle = '#c8b070'; g.fillRect(fx + (1 + k * 3) * ic, fy - 9 * ic, 2 * ic, 4 * ic); g.fillStyle = '#ffb000'; g.fillRect(fx + (1 + k * 3) * ic, fy - 10 * ic, 2 * ic, 1.4 * ic); }
            }
            if (n.oil) {                                    // PETROL: turuncu kule üçgeni
                const ox = px - sq - 4 * ic, oy = py - 2;
                g.strokeStyle = '#ff8a00'; g.lineWidth = 1.4;
                g.beginPath(); g.moveTo(ox - 4 * ic, oy + 4 * ic); g.lineTo(ox, oy - 6 * ic); g.lineTo(ox + 4 * ic, oy + 4 * ic); g.stroke();
                g.fillStyle = '#ff8a00'; g.fillRect(ox - 1.5, oy - 7 * ic, 3, 3);
            }
            if (n.mine) {                                   // MADEN (puan): yeşil çapraz kazma
                const mx = px - sq - (n.oil ? 13 : 4) * ic, my = py - 2;
                g.strokeStyle = '#3cdc6e'; g.lineWidth = 1.6;
                g.beginPath(); g.moveTo(mx - 4 * ic, my - 4 * ic); g.lineTo(mx + 4 * ic, my + 4 * ic); g.moveTo(mx + 4 * ic, my - 4 * ic); g.lineTo(mx - 4 * ic, my + 4 * ic); g.stroke();
                g.fillStyle = '#3cdc6e'; g.fillRect(mx - 1.5, my - 1.5, 3, 3);
            }
            if ((n.bar | 0) > 0) {                          // KIŞLA: yeşil flama
                const kx = px + sq + 2, ky = py + 5 * ic;
                g.strokeStyle = '#4ade80'; g.lineWidth = 1.2;
                g.beginPath(); g.moveTo(kx, ky + 5 * ic); g.lineTo(kx, ky - 4 * ic); g.stroke();
                g.fillStyle = '#4ade80'; g.beginPath(); g.moveTo(kx, ky - 4 * ic); g.lineTo(kx + 6 * ic, ky - 2.2 * ic); g.lineTo(kx, ky - 0.5 * ic); g.closePath(); g.fill();
            }
        }
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
