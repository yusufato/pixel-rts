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
// ── DESIGN "Harita 2.5D" (2026-07-27) — prosedürel gerçekçi Avrupa dünya haritası ──
// Design ekibinin build()+render() tekniği (Harita 2.5D.dc.html) oyun terrain'ine taşındı:
// yükseklik alanı (kıyı eğimi + fBm + BAĞLI dağ sırtları [sıra-çizgisi mesafesi, boy/kol
// gürültüsü] + nehir vadisi oyması) → sınırlı-paletli (ova5/orman5/dağ6/kuru4/boreal5/deniz6)
// pixel-art biyom + Bayer 4×4 dither → hillshade (KB güneş) → batimetrik deniz → nehir +
// yerleşim/yol/maden/fabrika/petrol/kale pixel-art'ı. Statik SİYASİ tint PORT EDİLMEDİ —
// oyunun dinamik owner-overlay'i canlı sahipliği zaten boyar (fetihle renk anında değişir).
// STATİK, bir kez üretilir (STORY._geoTerrain). Kaynak veri: js/geoData.js (GEO/GEO_CITIES/GEO_ROADS).
const STORY_FORTS = [[520, 560], [890, 690], [640, 470]];   // kale mevkileri (GEO uzayı) — geçit başları
function storyDrawGeoSettlements(ctx, S) {
    const CT = (typeof GEO_CITIES !== 'undefined') ? GEO_CITIES : [];
    const RD = (typeof GEO_ROADS !== 'undefined') ? GEO_ROADS : [];
    const P = (x, y) => [x * S, y * S];
    const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
    // yollar — ince, koyu kılıflı
    for (const e of RD) { const a = CT[e[0]], b = CT[e[1]]; if (!a || !b) continue;
        const p0 = P(a.x, a.y), p1 = P(b.x, b.y);
        ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]);
        ctx.strokeStyle = 'rgba(38,30,20,.75)'; ctx.lineWidth = 2.6 * S; ctx.stroke();
        ctx.strokeStyle = 'rgba(196,170,116,.9)'; ctx.lineWidth = 1 * S; ctx.stroke(); }
    // yerleşim kümeleri — tier'a göre boyut (başkent kule silueti dahil)
    const cluster = (lo, la, n, big) => { const [cx, cy] = P(lo, la);
        for (let i = 0; i < n; i++) { const a = i * 2.399, r = (big ? 1.6 + i * .62 : 1.2 + i * .5) * S;
            const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * .62;
            const w = (big ? (i % 3 === 0 ? 3 : 2) : 2) * S, h = (big ? (i % 4 === 0 ? 4 : 2) : 2) * S;
            rect(x + 1, y + 1, w, h, 'rgba(20,16,12,.55)');
            rect(x, y, w, h, i % 3 === 0 ? '#b8562f' : '#8f4a2c');
            rect(x, y, w, 1, '#d98a4a'); }
        if (big) { rect(cx - 1, cy - 7 * S, 2 * S, 7 * S, '#5c5348'); rect(cx - 2, cy - 9 * S, 4 * S, 2 * S, '#8e8375'); } };
    for (let i = 0; i < CT.length; i++) { const c = CT[i];
        if (c.tier >= 3) cluster(c.x, c.y, 15, true);
        else if (c.tier === 2) cluster(c.x, c.y, 7, false);
        else if (i % 3 === 0) cluster(c.x, c.y, 3, false); }
    // madenler — dağ eteğinde ocak ağzı + çatkı + pasa
    const mine = (lo, la) => { const [x, y] = P(lo, la);
        rect(x - 2, y, 5, 2, 'rgba(18,14,10,.6)'); rect(x - 2, y - 1, 5, 2, '#4a3f33'); rect(x - 1, y - 1, 3, 1, '#241d17');
        rect(x - 3, y - 4, 1, 4, '#6b5a3f'); rect(x + 2, y - 4, 1, 4, '#6b5a3f'); rect(x - 3, y - 5, 6, 1, '#8a7550');
        rect(x + 3, y, 3, 1, '#7d6a4a'); rect(x + 4, y + 1, 2, 1, '#5e5039'); };
    // fabrikalar — tuğla gövde + iki baca
    const factory = (lo, la) => { const [x, y] = P(lo, la);
        rect(x - 3, y + 1, 9, 2, 'rgba(18,14,10,.55)'); rect(x - 4, y - 2, 9, 4, '#6e4034'); rect(x - 4, y - 2, 9, 1, '#946152');
        rect(x - 2, y - 6, 2, 4, '#4f3a30'); rect(x + 2, y - 7, 2, 5, '#4f3a30'); rect(x - 2, y - 6, 2, 1, '#8a6a56'); rect(x + 2, y - 7, 2, 1, '#8a6a56'); };
    for (const c of CT) {
        if (c.mine > 0) mine(c.x + 11, c.y + 8);
        if (c.fac >= 3) factory(c.x - 13, c.y + 8);
        if (c.oil > 0) { const [x, y] = P(c.x + 14, c.y - 9);
            rect(x - 1, y - 6, 1, 6, '#5f5445'); rect(x + 1, y - 4, 1, 4, '#5f5445'); rect(x - 1, y - 7, 3, 1, '#8f8270'); rect(x - 2, y, 5, 1, '#3d3529'); } }
    // kaleler — geçit başları
    for (const ft of STORY_FORTS) { const [x, y] = P(ft[0], ft[1]);
        rect(x - 3, y - 2, 7, 5, 'rgba(20,16,12,.5)'); rect(x - 4, y - 3, 7, 5, '#7d7466'); rect(x - 4, y - 3, 7, 1, '#a39a88'); rect(x - 1, y - 6, 2, 4, '#8e8375'); }
}
function storyGeoTerrainCache() {
    if (STORY._geoTerrain) return STORY._geoTerrain;
    // GÜVENLİK: gerçek canvas gerektirir (createImageData/putImageData). jsdom stub'ında düz zemine düş.
    try {
        const _t = document.createElement('canvas'); _t.width = 4; _t.height = 4;
        const _c = _t.getContext('2d'); const _im = _c.createImageData(2, 2);
        if (!_im || !_im.data || _im.data.length < 16) throw new Error('stub canvas');
    } catch (e) {
        const fb = document.createElement('canvas'); fb.width = 8; fb.height = 8;
        try { const c = fb.getContext('2d'); c.fillStyle = '#12321e'; c.fillRect(0, 0, 8, 8); } catch (_) {}
        STORY._geoTerrain = fb; return fb;
    }
    const S = 0.9;                                          // GEO(1500×1180) → tampon ölçeği
    const W = Math.round(GEO.W * S), H = Math.round(GEO.H * S), f = S / 0.95;   // f: prototip S=0.95 eşiklerini oranla
    const fbm = (x, y, o) => _geoFbm(x, y, o || 5);
    // 1) kara maskesi — scanline even-odd (iç denizler kendiliğinden oyulur)
    const land = new Uint8Array(W * H);
    for (const ring of GEO.land) for (let gy = 0; gy < H; gy++) {
        const y = (gy + 0.5) / S, xs = [];
        for (let i = 0; i < ring.length; i++) {
            const x1 = ring[i][0], y1 = ring[i][1], x2 = ring[(i + 1) % ring.length][0], y2 = ring[(i + 1) % ring.length][1];
            if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + (y - y1) / (y2 - y1) * (x2 - x1));
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) { const a = Math.max(0, Math.ceil(xs[k] * S - 0.5)), b = Math.min(W - 1, Math.floor(xs[k + 1] * S - 0.5)); for (let gx = a; gx <= b; gx++) land[gy * W + gx] ^= 1; }
    }
    // 2) chamfer mesafeleri (karada kıyıya, denizde karaya)
    const dLand = _geoDistT(land, W, H, 1), dSea = _geoDistT(land, W, H, 0);
    const segd = (px, py, ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay, l = vx * vx + vy * vy; let t = l ? ((px - ax) * vx + (py - ay) * vy) / l : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; const dx = px - (ax + vx * t), dy = py - (ay + vy * t); return Math.sqrt(dx * dx + dy * dy); };
    // sırtlar (tampon uzayında) + nehirleri karaya kırp (denizde kalan parçaları at)
    const ranges = GEO.ranges.map(r => ({ pts: r.pts.map(p => [p[0] * S, p[1] * S]), r: Math.max(7 * f, r.r * S * 1.5), str: r.str }));
    const onLand = (x, y) => { const xi = Math.round(x), yi = Math.round(y); return xi >= 0 && yi >= 0 && xi < W && yi < H && land[yi * W + xi]; };
    const rivers0 = [];
    for (const rv of GEO.rivers) { let cur = []; for (const p of rv) { const bx = p[0] * S, by = p[1] * S; if (onLand(bx, by)) cur.push([bx, by]); else { if (cur.length > 1) rivers0.push(cur); cur = []; } } if (cur.length > 1) rivers0.push(cur); }
    // 3) yükseklik alanı — taban (deniz batimetri + kara kıyı eğimi + fBm)
    const hgt = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!land[i]) { hgt[i] = -Math.min(1, dSea[i] / (73 * f)); continue; }
        let h = Math.min(1, dLand[i] / (41 * f)) * .28;
        h += (fbm(x * .012 / f, y * .012 / f, 5) - .45) * .30;
        h += (fbm(x * .05 / f + 40, y * .05 / f, 3) - .5) * .05;
        hgt[i] = h;
    }
    // sırt bindirmesi — yalnız her sıranın bbox'ı içinde (perf); boy/kol gürültüsüyle tek koni oluşmaz
    for (const R of ranges) {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const p of R.pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
        const pad = R.r * 1.5;
        x0 = Math.max(0, Math.floor(x0 - pad)); x1 = Math.min(W - 1, Math.ceil(x1 + pad)); y0 = Math.max(0, Math.floor(y0 - pad)); y1 = Math.min(H - 1, Math.ceil(y1 + pad));
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            const i = y * W + x; if (!land[i]) continue;
            let d = 1e6; for (let k = 0; k < R.pts.length - 1; k++) d = Math.min(d, segd(x, y, R.pts[k][0], R.pts[k][1], R.pts[k + 1][0], R.pts[k + 1][1]));
            if (R.pts.length === 1) d = Math.hypot(x - R.pts[0][0], y - R.pts[0][1]);
            const rr = R.r * (.72 + .5 * fbm(x * .02 / f + 9, y * .02 / f + 3, 3));
            if (d < rr) { const t = 1 - d / rr, along = .55 + .9 * fbm(x * .028 / f + 11, y * .028 / f + 47, 3), spur = .78 + .5 * fbm(x * .085 / f + 70, y * .085 / f + 12, 3);
                hgt[i] += R.str * Math.pow(t, 1.85) * along * spur * 1.05; }
        }
    }
    // nehir vadisi oyması — yalnız segment bbox'ı içinde
    for (const rv of rivers0) for (let k = 0; k < rv.length - 1; k++) {
        const ax = rv[k][0], ay = rv[k][1], bx = rv[k + 1][0], by = rv[k + 1][1], vd = 25 * f;
        const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - vd)), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + vd));
        const y0 = Math.max(0, Math.floor(Math.min(ay, by) - vd)), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by) + vd));
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x; if (!land[i]) continue; const d = segd(x, y, ax, ay, bx, by); if (d < vd) hgt[i] -= (1 - d / vd) * .17; }
    }
    for (let i = 0; i < W * H; i++) if (land[i]) hgt[i] = Math.max(.005, Math.min(1.9, hgt[i]));
    // 4) render — sınırlı palet + Bayer dither + hillshade + batimetri
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, H), o = img.data;
    const PL = {
        plain: [[86, 109, 58], [104, 127, 64], [122, 144, 74], [139, 158, 88], [157, 172, 104]],
        forest: [[42, 66, 42], [52, 80, 48], [63, 93, 55], [75, 105, 63], [88, 116, 72]],
        rock: [[70, 66, 58], [88, 84, 74], [106, 101, 88], [126, 120, 104], [168, 164, 150], [206, 206, 200]],
        dry: [[142, 124, 84], [161, 142, 98], [180, 161, 116], [198, 180, 138]],
        boreal: [[46, 62, 50], [56, 74, 56], [66, 86, 62], [78, 96, 70], [90, 106, 80]],
        sea: [[24, 44, 74], [30, 56, 92], [38, 70, 110], [48, 86, 128], [62, 104, 146], [86, 128, 166]]
    };
    const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
    const desY = GEO.desertY * S, borY = GEO.borealY * S;
    const pick = (pal, t, x, y, jitter) => { const n = pal.length, b = (bayer[y & 3][x & 3] / 16 - .5) * jitter; let idx = Math.round(t * (n - 1) + b); idx = idx < 0 ? 0 : idx > n - 1 ? n - 1 : idx; return pal[idx]; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, k = i * 4; let col;
        if (!land[i]) {
            const t = 1 - Math.min(1, Math.pow(dSea[i] / (140 * f), .55));
            col = pick(PL.sea, t * .92 + (fbm(x * .03 / f, y * .03 / f, 3) - .5) * .12, x, y, .8);
        } else {
            const h = hgt[i];
            const hx = (hgt[Math.min(W - 1, x + 1) + y * W] - hgt[Math.max(0, x - 1) + y * W]);
            const hy = (hgt[x + Math.min(H - 1, y + 1) * W] - hgt[x + Math.max(0, y - 1) * W]);
            const sh = Math.max(-1, Math.min(1, (-hx - hy) * (h > .7 ? 13 : 7)));
            const shade = sh > .28 ? 1 : sh < -.28 ? -1 : 0;
            let pal, t;
            const forestN = fbm(x * .022 / f + 200, y * .022 / f, 4);
            if (h > .95) { pal = PL.rock; const snowH = 1.72, patch = fbm(x * .06 / f + 300, y * .06 / f + 120, 3); t = (h > snowH && patch > .52) ? .8 + Math.min(1, (h - snowH) / .2) * .2 : Math.min(.44, (h - .95) / .8); }
            else if (y < borY + (fbm(x * .009 / f, y * .009 / f + 5, 3) - .5) * 150 * f) { pal = PL.boreal; t = .25 + h * .8; }
            else if (y > desY + (fbm(x * .009 / f + 30, y * .009 / f, 3) - .5) * 150 * f && h < .6) { pal = PL.dry; t = .2 + h * 1.1; }
            else if (forestN > .49 && h < .74) { pal = PL.forest; t = (forestN - .49) * 4.6 + h * .6; }
            else { pal = PL.plain; t = .18 + h * 1.5; }
            const dense = h > .62 ? 1.45 : dLand[i] < 10 * f ? 1.25 : pal === PL.forest ? .85 : .45;
            col = pick(pal, Math.max(0, Math.min(1, t)) + shade * (h > .7 ? .3 : .16), x, y, dense);
        }
        o[k] = col[0]; o[k + 1] = col[1]; o[k + 2] = col[2]; o[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // nehirler — çift hat
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const rv of rivers0) { ctx.beginPath(); ctx.moveTo(rv[0][0], rv[0][1]); for (let i = 1; i < rv.length; i++) ctx.lineTo(rv[i][0], rv[i][1]); ctx.strokeStyle = '#20364e'; ctx.lineWidth = Math.max(1, 3 * S); ctx.stroke(); ctx.strokeStyle = '#3e7096'; ctx.lineWidth = Math.max(1, 1.4 * S); ctx.stroke(); }
    // yerleşim / yol / maden / fabrika / petrol / kale (tampon ölçeğinde)
    storyDrawGeoSettlements(ctx, S);
    STORY._geoTerrain = cv; return cv;
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
