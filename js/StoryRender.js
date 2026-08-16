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
    // Küçük paneller 2 Hz tazelenir. WorldV2 bilgi süzgeci kuran şehir ve ekonomi
    // dosyaları ayrı bütçededir: 1 Hz, oyuncu okurken/gezdirirken ayrıca ertelenir.
    if (STORY._councilOpen || STORY._armyOpen || STORY._techOpen || STORY._changesOpen) {
        STORY._accCouncil = (STORY._accCouncil || 0) + dt;
        if (STORY._accCouncil >= 0.5) {
            STORY._accCouncil = 0;
            if (STORY._councilOpen) storyCouncilUpdate();
            if (STORY._armyOpen) storyArmyUpdate();
            if (STORY._techOpen) storyTechUpdate();
            if (STORY._changesOpen) storyChangesUpdate();
        }
    }
    if (STORY._cityOpen || STORY._economyOpen) {
        STORY._accDossier = (STORY._accDossier || 0) + dt;
        if (STORY._accDossier >= 1) {
            STORY._accDossier = 0;
            if (STORY._cityOpen) storyCityUpdate();
            if (STORY._economyOpen && typeof storyEconomyUpdate === 'function') storyEconomyUpdate();
        }
    }
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
    if (typeof storyMapV2Enabled === 'function' && storyMapV2Enabled()) {
        return storyMapV2MinZoom(w, h, STORY_WORLD_W, STORY_WORLD_H);
    }
    // zoom-out sınırında p→0 (düz) → sxOf(0)=1. p'ye bağlanmaz (storyPP döngüsünü kırar).
    const zW = w / (STORY_WORLD_W * 1.12);                  // genişlik kısıtı
    const zH = h / (STORY_WORLD_H * 1.06);                  // yükseklik kısıtı
    return Math.max(zW, zH);
}
// kamerayı sınırlarda tut — WARP farkında. Ortalama: dünya merkezi EKRAN merkezine
// (warp yatay ölçeği W/2 etrafında olduğu için cam.x = WORLD/2 − (w/2)/z; sxOf ÇARPANI YOK
// — eski formül sxOf(0)'ı katıp sürekli sola kaydırıyordu).
function storyClampCam(w, h) {
    STORY._cw = w; STORY._ch = h;
    if (typeof storyMapV2Enabled === 'function' && storyMapV2Enabled()) {
        STORY._minZoom = storyMapV2ClampCamera(storyCam, w, h, STORY_WORLD_W, STORY_WORLD_H);
        STORY._mapRendererVersion = STORY_MAP_RENDERER_V2.version;
        return;
    }
    const mn = STORY._minZoom = storyMinZoom(w, h);        // storyPP bunu okur (eğim eğrisi)
    storyCam.zoom = Math.max(mn, Math.min(5, storyCam.zoom));
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
    if (typeof storyMapV2Enabled === 'function' && storyMapV2Enabled()) {
        STORY._cw = cv.width; STORY._ch = cv.height;
        storyMapV2CenterCamera(storyCam, n.lx * STORY_WORLD_W, n.ly * STORY_WORLD_H, cv.width, cv.height);
        storyClampCam(cv.width, cv.height);
        return;
    }
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
// EĞİM ZOOM'A BAĞLI (design "Harita 2.5D"): uzak (zoom-out) → düz tepeden görünüm (p≈0,
// tüm Avrupa okunur), yakın (zoom-in) → ~STORY_PP_MAX eğim (2.5D taktik his). p her frame
// storyCam.zoom + STORY._minZoom'dan hesaplanır; render VE hit-test aynı p'yi kullanır →
// tıklama doğruluğu korunur. Döngü yok: storyMinZoom p'ye bağlı değil (aşağıda sabit 1).
const STORY_PP_MAX = 0.6;                             // en yakın zoomda eğim gücü
function storyPP() {
    if (typeof storyMapV2Enabled === 'function' && storyMapV2Enabled()) return 0;
    const mn = STORY._minZoom || storyCam.zoom || 1;
    const zt = Math.max(0, Math.min(1, (storyCam.zoom / mn - 1) / 3.5));
    return STORY_PP_MAX * zt * zt * (3 - 2 * zt);     // smoothstep: uzak→0, yakın→tmax
}
function storySxOf(u) { const p = storyPP(); return (1 + p * u) * (1 + p * u) / (1 + p); }
function storyVyOf(u) { const p = storyPP(), H = STORY._ch || 600; return H * (1 + p) * u / (1 + p * u); }
function storyUOfVy(vy) { const p = storyPP(), H = STORY._ch || 600, v = vy / H; return v / (1 + p - p * v); }
// dünya (px) → ekran; döner {x,y,u}. u perspektif ölçeği için (jeton boyutu).
function storyW2S(wx, wy) {
    if (typeof storyMapV2Enabled === 'function' && storyMapV2Enabled()) {
        return storyMapV2WorldToScreen(wx, wy, storyCam);
    }
    const W = STORY._cw || 800, z = storyCam.zoom;
    const vx = (wx - storyCam.x) * z, vy = (wy - storyCam.y) * z;
    const u = storyUOfVy(vy);
    return { x: (vx - W / 2) * storySxOf(u) + W / 2, y: u * (STORY._ch || 600), u };
}
// ekran → dünya (px) — tıklama/sürükleme/zoom tersinimi
function storyS2W(X, Y) {
    if (typeof storyMapV2Enabled === 'function' && storyMapV2Enabled()) {
        return storyMapV2ScreenToWorld(X, Y, storyCam);
    }
    const W = STORY._cw || 800, H = STORY._ch || 600, z = storyCam.zoom;
    const u = Y / H, vy = storyVyOf(u), vx = (X - W / 2) / storySxOf(u) + W / 2;
    return { x: storyCam.x + vx / z, y: storyCam.y + vy / z };
}
// perspektif ölçeği: yakın (alt) büyük, uzak (üst) küçük (jeton/etiket boyutu)
function storyPScale(u) {
    if (typeof storyMapV2Enabled === 'function' && storyMapV2Enabled()) return 1;
    return 0.62 + storySxOf(Math.max(0, Math.min(1, u))) * 0.5;
}
function storyAdaptiveWarpEnabled() {
    return typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('render.adaptiveMapWarp');
}

function storyWarpBandSize(height) {
    if (!storyAdaptiveWarpEnabled()) return 3;
    const h = Math.max(1, Number(height) || 1);
    const base = Math.max(4, Math.min(7, Math.round(h / 220)));
    const minZoom = Math.max(0.0001, Number(STORY._minZoom) || Number(storyCam.zoom) || 1);
    const zoomRatio = Math.max(1, (Number(storyCam.zoom) || 1) / minZoom);
    return Math.max(4, base - (zoomRatio >= 3 ? 1 : 0));
}

function storyWarpValidate(g, src) {
    if (!g || typeof g.drawImage !== 'function') return { ok: false, code: 'CONTEXT_REQUIRED' };
    if (!src || !(Number(src.width) > 0) || !(Number(src.height) > 0)) return { ok: false, code: 'SOURCE_DIMENSIONS' };
    if (!(Number(STORY._cw) > 0) || !(Number(STORY._ch) > 0)) return { ok: false, code: 'VIEWPORT_DIMENSIONS' };
    if (!(Number(STORY_WORLD_W) > 0) || !(Number(STORY_WORLD_H) > 0)) return { ok: false, code: 'WORLD_DIMENSIONS' };
    if (!(Number(storyCam.zoom) > 0) || !Number.isFinite(storyCam.x) || !Number.isFinite(storyCam.y)) {
        return { ok: false, code: 'CAMERA_STATE' };
    }
    return { ok: true, code: null };
}

function storyWarpPlan() {
    const W = STORY._cw, H = STORY._ch, band = storyWarpBandSize(H);
    const key = [
        storyAdaptiveWarpEnabled() ? 'adaptive' : 'fixed',
        W, H, band,
        Math.round((Number(storyCam.zoom) || 0) * 1e6),
        Math.round((Number(STORY._minZoom) || 0) * 1e6)
    ].join('|');
    if (storyAdaptiveWarpEnabled() && STORY._warpPlanCache && STORY._warpPlanCache.key === key) {
        STORY._warpPlanStats = STORY._warpPlanStats || { hits: 0, misses: 0 };
        STORY._warpPlanStats.hits++;
        return STORY._warpPlanCache;
    }
    const rows = [];
    let maxScaleError = 0;
    for (let ys = 0; ys < H; ys += band) {
        const u0 = ys / H;
        const u1 = Math.min(1, (ys + band) / H);
        const um = (u0 + u1) / 2;
        const scale = storySxOf(um);
        const edge0 = storySxOf(u0);
        const edge1 = storySxOf(u1);
        maxScaleError = Math.max(
            maxScaleError,
            Math.abs(edge0 - scale) / Math.max(0.0001, edge0),
            Math.abs(edge1 - scale) / Math.max(0.0001, edge1)
        );
        rows.push({
            ys,
            drawHeight: Math.min(band, H - ys) + 0.6,
            vy0: storyVyOf(u0),
            vy1: storyVyOf(u1),
            scale
        });
    }
    const plan = {
        key,
        width: W,
        height: H,
        band,
        rows,
        drawCallsPerLayer: rows.length,
        maxScaleError
    };
    STORY._warpPlanStats = STORY._warpPlanStats || { hits: 0, misses: 0 };
    STORY._warpPlanStats.misses++;
    if (storyAdaptiveWarpEnabled()) STORY._warpPlanCache = plan;
    return plan;
}

// bir önbellek tuvalini (kendi çözünürlüğü, dünya 0..STORY_WORLD kaplar) warp'lı çiz.
// Plan terrain ve politik overlay arasında paylaşılır; çizim döngüsü hata yutmaz.
function storyBlitWarp(g, src, alpha) {
    if (typeof storyMapV2Enabled === 'function' && storyMapV2Enabled()) {
        const started = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
        const ok = storyMapV2Blit(g, src, alpha, storyCam, STORY._cw, STORY._ch, STORY_WORLD_W, STORY_WORLD_H);
        const ended = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
        STORY._warpLastFrame = { renderer: STORY_MAP_RENDERER_V2.version, band: STORY._ch,
            drawCallsPerLayer: ok ? 1 : 0, maxScaleError: 0,
            durationMs: Math.max(0, Math.round((ended - started) * 1000) / 1000) };
        STORY._warpLastError = ok ? null : { ok: false, code: 'V2_BLIT_FAILED' };
        return ok;
    }
    const validation = storyWarpValidate(g, src);
    if (!validation.ok) {
        STORY._warpLastError = validation;
        return false;
    }
    const started = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const W = STORY._cw, H = STORY._ch, z = storyCam.zoom;
    const kx = src.width / STORY_WORLD_W, ky = src.height / STORY_WORLD_H;
    // Tam uzak görünümde perspektif yoktur. Şeritlere bölmek hem gereksiz yüzlerce
    // drawImage çağrısı hem de piksel haritada yatay dikiş izi üretiyordu.
    if (Math.abs(storyPP()) < 0.000001) {
        if (alpha != null) g.globalAlpha = alpha;
        g.drawImage(src, storyCam.x * kx, storyCam.y * ky,
            (W / z) * kx, (H / z) * ky, 0, 0, W, H);
        if (alpha != null) g.globalAlpha = 1;
        STORY._warpLastFrame = { band: H, drawCallsPerLayer: 1, maxScaleError: 0,
            durationMs: 0, cache: Object.assign({}, STORY._warpPlanStats || {}) };
        STORY._warpLastError = null;
        return true;
    }
    const plan = storyWarpPlan();
    if (alpha != null) g.globalAlpha = alpha;
    for (const row of plan.rows) {
        const wy0 = storyCam.y + row.vy0 / z;
        const wy1 = storyCam.y + row.vy1 / z;
        const srcXw = storyCam.x + (W / 2 * (1 - 1 / row.scale)) / z;
        const srcWw = W / (row.scale * z);
        const sh = Math.max(0.01, (wy1 - wy0) * ky);
        g.drawImage(src, srcXw * kx, wy0 * ky, srcWw * kx, sh, 0, row.ys, W, row.drawHeight);
    }
    if (alpha != null) g.globalAlpha = 1;
    const ended = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    STORY._warpLastFrame = {
        band: plan.band,
        drawCallsPerLayer: plan.drawCallsPerLayer,
        maxScaleError: plan.maxScaleError,
        durationMs: Math.max(0, Math.round((ended - started) * 1000) / 1000),
        cache: Object.assign({}, STORY._warpPlanStats)
    };
    STORY._warpLastError = null;
    return true;
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
function _geoMixRgb(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
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
const STORY_MAP_ATLAS_SPECS = {
    mountains: { src: 'assets/maps/terrain-mountains-atlas-v2.png', cols: 4, rows: 4 },
    forests: { src: 'assets/maps/terrain-forests-atlas-v2.png', cols: 4, rows: 4 },
    settlements: { src: 'assets/maps/settlements-atlas-v2.png', cols: 4, rows: 4 },
    groundDetail: { src: 'assets/maps/ground-texture-atlas-v1.png', cols: 4, rows: 4 },
    terrainDetail: { src: 'assets/maps/terrain-detail-atlas-v2.png', cols: 4, rows: 4 },
    ruralEnvironment: { src: 'assets/maps/rural-environment-atlas-v1.png', cols: 4, rows: 4 },
    maritime: { src: 'assets/maps/maritime-atlas-v2.png', cols: 4, rows: 4 },
    seaDetail: { src: 'assets/maps/sea-detail-atlas-v2.png', cols: 4, rows: 4 }
};

// Harita resmi statik bir arka plan değildir. Atlaslar yalnız sunum katmanıdır;
// konum, seviye, biyom ve sahiplik canlı simülasyondan gelmeye devam eder.
function storyMapAtlasEnsure() {
    if (typeof Image === 'undefined') return null;
    if (STORY._mapAtlases) return STORY._mapAtlases;
    const atlases = STORY._mapAtlases = {};
    for (const key of Object.keys(STORY_MAP_ATLAS_SPECS)) {
        const spec = STORY_MAP_ATLAS_SPECS[key], img = new Image();
        atlases[key] = { img, ready: false, cols: spec.cols, rows: spec.rows };
        img.onload = () => {
            atlases[key].ready = true;
            if (key !== 'settlements') {
                STORY._geoTerrain = null;
                STORY._terrainCache = null;
            }
            if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => storyRender());
        };
        img.onerror = () => { atlases[key].failed = true; };
        img.src = spec.src;
    }
    return atlases;
}

function storyMapAtlasReady(key) {
    const all = storyMapAtlasEnsure();
    return !!(all && all[key] && all[key].ready && all[key].img.naturalWidth > 0);
}

function storyDrawAtlasCell(ctx, key, index, x, y, w, h, alpha, rotation, flipX) {
    const all = storyMapAtlasEnsure(), a = all && all[key];
    if (!a || !a.ready) return false;
    const count = a.cols * a.rows, cell = ((index % count) + count) % count;
    const col = cell % a.cols, row = Math.floor(cell / a.cols);
    const sw = a.img.naturalWidth / a.cols, sh = a.img.naturalHeight / a.rows;
    ctx.save();
    ctx.globalAlpha *= alpha == null ? 1 : alpha;
    ctx.imageSmoothingEnabled = false;
    if (rotation || flipX) {
        ctx.translate(Math.round(x), Math.round(y - h / 2));
        if (rotation) ctx.rotate(rotation);
        if (flipX) ctx.scale(-1, 1);
        ctx.drawImage(a.img, col * sw, row * sh, sw, sh,
            Math.round(-w / 2), Math.round(-h / 2), Math.round(w), Math.round(h));
    } else {
        ctx.drawImage(a.img, col * sw, row * sh, sw, sh,
            Math.round(x - w / 2), Math.round(y - h), Math.round(w), Math.round(h));
    }
    ctx.restore();
    return true;
}

function storyDrawGeoSettlements(ctx, S) {
    const CT = (typeof GEO_CITIES !== 'undefined') ? GEO_CITIES : [];
    const RD = (typeof GEO_ROADS !== 'undefined') ? GEO_ROADS : [];
    const P = (x, y) => [x * S, y * S];
    const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
    // yollar — ince, koyu kılıflı
    for (let ei = 0; ei < RD.length; ei++) { const e = RD[ei], a = CT[e[0]], b = CT[e[1]]; if (!a || !b) continue;
        const p0 = P(a.x, a.y), p1 = P(b.x, b.y);
        const dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.max(1, Math.hypot(dx, dy));
        const bend = Math.min(12 * S, len * .10) * (_geoHash2(ei * 17 + 3, 409) > .5 ? 1 : -1);
        const mx = (p0[0] + p1[0]) / 2 - dy / len * bend;
        const my = (p0[1] + p1[1]) / 2 + dx / len * bend;
        ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(mx, my, p1[0], p1[1]);
        ctx.strokeStyle = 'rgba(38,30,20,.76)'; ctx.lineWidth = 2.8 * S; ctx.stroke();
        ctx.strokeStyle = 'rgba(210,184,124,.92)'; ctx.lineWidth = 1.2 * S; ctx.stroke(); }
    // yerleşim kümeleri — tier'a göre boyut (başkent kule silueti dahil)
    const cluster = (lo, la, n, big) => { const [cx, cy] = P(lo, la);
        for (let i = 0; i < n; i++) { const a = i * 2.399, r = (big ? 1.6 + i * .62 : 1.2 + i * .5) * S;
            const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * .62;
            const w = (big ? (i % 3 === 0 ? 3 : 2) : 2) * S, h = (big ? (i % 4 === 0 ? 4 : 2) : 2) * S;
            rect(x + 1, y + 1, w, h, 'rgba(20,16,12,.55)');
            rect(x, y, w, h, i % 3 === 0 ? '#b8562f' : '#8f4a2c');
            rect(x, y, w, 1, '#d98a4a'); }
        if (big) { rect(cx - 1, cy - 7 * S, 2 * S, 7 * S, '#5c5348'); rect(cx - 2, cy - 9 * S, 4 * S, 2 * S, '#8e8375'); } };
    if (!storyMapAtlasReady('settlements')) {
        for (let i = 0; i < CT.length; i++) { const c = CT[i];
            if (c.tier >= 3) cluster(c.x, c.y, 15, true);
            else if (c.tier === 2) cluster(c.x, c.y, 7, false);
            else if (i % 3 === 0) cluster(c.x, c.y, 3, false); }
    }
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

function storyDrawGeoNaturalDetail(ctx, land, hgt, W, H, f) {
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // Deniz yüzeyi: seyrek, yönlü dalga çizgileri; kıyı ve rota okunurluğunu bozmaz.
    ctx.strokeStyle = 'rgba(116,181,202,.18)'; ctx.lineWidth = 1;
    for (let y = 9; y < H; y += 17) for (let x = 8 + ((y / 17) & 1) * 7; x < W; x += 29) {
        const i = y * W + x;
        if (land[i] || land[Math.min(W * H - 1, i + 4)] || _geoHash2(x, y) < .28) continue;
        const len = 3 + Math.floor(_geoHash2(x + 9, y + 3) * 5);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
    }
    // Orman kümeleri: tek renkli leke yerine küçük ağaç silüetleri. Yüksek dağa/çöle çizilmez.
    for (let y = 7; y < H - 7; y += 9) for (let x = 7; x < W - 7; x += 9) {
        const i = y * W + x;
        if (!land[i] || hgt[i] > .74) continue;
        const forest = _geoFbm(x * .022 / f + 200, y * .022 / f, 4);
        if (forest < .50 || _geoHash2(x + 31, y + 17) < .20) continue;
        const jx = Math.round((_geoHash2(x, y) - .5) * 5), jy = Math.round((_geoHash2(x + 2, y + 4) - .5) * 4);
        const tx = x + jx, ty = y + jy, size = forest > .63 ? 4 : 3;
        ctx.fillStyle = 'rgba(25,48,29,.72)';
        ctx.beginPath(); ctx.moveTo(tx, ty - size); ctx.lineTo(tx - size, ty + 2); ctx.lineTo(tx + size, ty + 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(83,116,59,.78)';
        ctx.beginPath(); ctx.moveTo(tx - 1, ty - size + 1); ctx.lineTo(tx - size + 1, ty + 1); ctx.lineTo(tx, ty + 1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(48,39,25,.75)'; ctx.fillRect(tx, ty + 2, 1, 2);
    }
    // Dağ sıraları: yükseklik alanından türetilen kaya/snow-cap silüetleri; konum oynanış rölyefiyle aynıdır.
    for (let y = 8; y < H - 8; y += 11) for (let x = 8; x < W - 8; x += 11) {
        const i = y * W + x, h = hgt[i];
        if (!land[i] || h < .62 || _geoHash2(x + 71, y + 29) < .18) continue;
        const size = Math.max(4, Math.min(8, Math.round(3 + h * 2.6)));
        const jx = Math.round((_geoHash2(x + 5, y) - .5) * 5), tx = x + jx, ty = y + 3;
        ctx.fillStyle = 'rgba(42,39,35,.72)';
        ctx.beginPath(); ctx.moveTo(tx, ty - size); ctx.lineTo(tx - size, ty + 3); ctx.lineTo(tx + size, ty + 3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(142,137,120,.92)';
        ctx.beginPath(); ctx.moveTo(tx, ty - size); ctx.lineTo(tx - size + 1, ty + 2); ctx.lineTo(tx - 1, ty); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(82,78,70,.92)';
        ctx.beginPath(); ctx.moveTo(tx, ty - size); ctx.lineTo(tx + size, ty + 3); ctx.lineTo(tx - 1, ty); ctx.closePath(); ctx.fill();
        if (h > 1.18) {
            ctx.fillStyle = 'rgba(232,231,215,.94)';
            ctx.beginPath(); ctx.moveTo(tx, ty - size); ctx.lineTo(tx - Math.ceil(size * .34), ty - Math.ceil(size * .42));
            ctx.lineTo(tx, ty - Math.ceil(size * .55)); ctx.lineTo(tx + Math.ceil(size * .3), ty - Math.ceil(size * .36)); ctx.closePath(); ctx.fill();
        }
    }
    ctx.restore();
}

function storyDrawGeoAtlasDetail(ctx, land, hgt, W, H, f, dLand, dSea) {
    if (!storyMapAtlasReady('mountains') && !storyMapAtlasReady('forests')
        && !storyMapAtlasReady('groundDetail') && !storyMapAtlasReady('terrainDetail')
        && !storyMapAtlasReady('seaDetail')
        && !storyMapAtlasReady('maritime')) return;

    // Sürekli zemin mikro-dokusu. Tam kare atlas hücreleri doğrudan ana
    // canvas'a basılmaz: önce ayrı katmanda birleştirilir, ardından gerçek kara
    // ve yükseklik maskesiyle kesilir. Böylece kıyıya taşma ve dağların üstünü
    // tarla dokusuyla kapatma olmaz; soft-light karışımı taban paletini korur.
    if (storyMapAtlasReady('groundDetail')) {
        const layer = document.createElement('canvas'); layer.width = W; layer.height = H;
        const lg = layer.getContext('2d'); lg.imageSmoothingEnabled = false;
        const tile = 96, step = 92;
        for (let y = -8; y < H + tile; y += step) for (let x = -8; x < W + tile; x += step) {
            const cx = Math.max(0, Math.min(W - 1, Math.round(x + tile / 2)));
            const cy = Math.max(0, Math.min(H - 1, Math.round(y + tile / 2)));
            const i = cy * W + cx;
            const dry = cy > GEO.desertY * .9;
            const mediterranean = !dry && cy > GEO.desertY * .68;
            const forestN = _geoFbm(cx * .022 / f + 200, cy * .022 / f, 4);
            const row = dry ? 3 : mediterranean ? 2 : forestN > .55 ? 1 : 0;
            const variant = row * 4 + Math.floor(_geoHash2(x + 2221, y + 991) * 4);
            storyDrawAtlasCell(lg, 'groundDetail', variant,
                x + tile / 2, y + tile, tile, tile, .92, 0,
                _geoHash2(x + 373, y + 2017) > .5);
        }
        const mask = document.createElement('canvas'); mask.width = W; mask.height = H;
        const mg = mask.getContext('2d'), mi = mg.createImageData(W, H), mo = mi.data;
        for (let i = 0; i < land.length; i++) {
            if (!land[i] || hgt[i] > .72 || (dLand && dLand[i] < 1.2 * f)) continue;
            mo[i * 4] = 255; mo[i * 4 + 1] = 255; mo[i * 4 + 2] = 255; mo[i * 4 + 3] = 255;
        }
        mg.putImageData(mi, 0, 0);
        lg.globalCompositeOperation = 'destination-in'; lg.drawImage(mask, 0, 0);
        ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = .38;
        ctx.drawImage(layer, 0, 0); ctx.restore();
    }

    // Büyük düz renk yüzeylerini kıran tarla/çayır/çalılık yamaları. Bunlar biyom
    // üretmez; mevcut biyomun üstüne aynı bölgenin görsel ayrıntısını bindirir.
    if (storyMapAtlasReady('terrainDetail')) {
        for (let y = 34; y < H - 30; y += 41) for (let x = 32; x < W - 30; x += 41) {
            const i = y * W + x, h = hgt[i];
            if (!land[i] || h > .72 || (dLand && dLand[i] < 3 * f)
                || _geoHash2(x + 1709, y + 313) < .26) continue;
            const dry = y > GEO.desertY * .9;
            const mediterranean = !dry && y > GEO.desertY * .68;
            const forestN = _geoFbm(x * .022 / f + 200, y * .022 / f, 4);
            const row = dry ? 3 : mediterranean ? 2 : forestN > .56 ? 1 : 0;
            const variant = row * 4 + Math.floor(_geoHash2(x + 41, y + 73) * 4);
            const size = 64 + _geoHash2(x + 101, y + 29) * 28;
            const jx = (_geoHash2(x + 7, y + 211) - .5) * 24;
            const jy = (_geoHash2(x + 113, y + 19) - .5) * 18;
            const rotation = (Math.floor(_geoHash2(x + 601, y + 47) * 4) * Math.PI) / 2;
            storyDrawAtlasCell(ctx, 'terrainDetail', variant, x + jx, y + jy + size * .5,
                size, size, dry ? .32 : .27, rotation, _geoHash2(x + 331, y + 151) > .5);
        }

        // İkinci, daha ince doku geçişi: büyük atlas adaları arasındaki boşlukları
        // doldurur. Aynı hücreyi yan yana basmamak için farklı hash alanı, küçük
        // ölçek, daha düşük alfa ve serbest açı kullanılır. Böylece atlasın 4x4
        // düzeni harita üzerinde okunmaz; yalnız yerel tarla/çalılık/taş izi kalır.
        for (let y = 19; y < H - 18; y += 27) for (let x = 17; x < W - 18; x += 27) {
            const jx = Math.round((_geoHash2(x + 2141, y + 631) - .5) * 18);
            const jy = Math.round((_geoHash2(x + 887, y + 1871) - .5) * 16);
            const tx = Math.max(1, Math.min(W - 2, x + jx));
            const ty = Math.max(1, Math.min(H - 2, y + jy));
            const i = ty * W + tx, h = hgt[i];
            if (!land[i] || h > .67 || (dLand && dLand[i] < 2.4 * f)) continue;
            const dry = ty > GEO.desertY * .9;
            const mediterranean = !dry && ty > GEO.desertY * .68;
            const forestN = _geoFbm(tx * .022 / f + 200, ty * .022 / f, 4);
            const regionalDensity = dry ? .34 : mediterranean ? .69
                : forestN > .60 ? .84 : forestN > .53 ? .72 : .57;
            if (_geoHash2(x + 1217, y + 2539) > regionalDensity) continue;
            const row = dry ? 3 : mediterranean ? 2 : forestN > .56 ? 1 : 0;
            const variant = row * 4 + Math.floor(_geoHash2(x + 337, y + 1019) * 4);
            const size = 29 + _geoHash2(x + 409, y + 1153) * 17;
            const rotation = (_geoHash2(x + 1741, y + 239) - .5) * Math.PI;
            storyDrawAtlasCell(ctx, 'terrainDetail', variant, tx, ty + size * .5,
                size, size * (.82 + _geoHash2(x + 541, y + 787) * .22),
                dry ? .16 : .13, rotation, _geoHash2(x + 1597, y + 349) > .5);
        }
    }

    // Deniz ayrıntıları tabana çok düşük alfa ile karışır; mavi birer daire gibi
    // görünmemeleri için yamalar birbirinden geniş aralıklarla yerleştirilir.
    if (storyMapAtlasReady('seaDetail')) {
        // Kıyı köpüğü: deniz mesafe alanına bağlıdır; dolayısıyla siyasi sınırdan
        // veya elle yerleştirilmiş bir sahil çizgisinden değil gerçek kara
        // maskesinden üretilir. Küçük atlas parçaları kıyı boyunca kırık bir
        // beyaz hat verir, fakat adaların üstüne ya da açık denize taşmaz.
        for (let y = 10; y < H - 10; y += 11) for (let x = 10; x < W - 10; x += 11) {
            const i = y * W + x, coast = dSea ? dSea[i] / f : 99;
            if (land[i] || coast < .7 || coast > 4.8
                || _geoHash2(x + 3001, y + 1187) < .36) continue;
            const variant = 12 + Math.floor(_geoHash2(x + 229, y + 187) * 4);
            const size = 17 + _geoHash2(x + 1291, y + 521) * 11;
            const rotation = (_geoHash2(x + 977, y + 1601) - .5) * Math.PI;
            storyDrawAtlasCell(ctx, 'seaDetail', variant, x, y + size * .32,
                size, size * .54, .24, rotation, _geoHash2(x + 431, y + 2237) > .5);
        }

        for (let y = 44; y < H - 36; y += 76) for (let x = 42; x < W - 38; x += 76) {
            const i = y * W + x;
            if (land[i] || _geoHash2(x + 811, y + 2027) < .22) continue;
            const col = Math.floor(_geoHash2(x + 83, y + 127) * 3);
            const row = Math.floor(_geoHash2(x + 269, y + 43) * 4);
            const size = 78 + _geoHash2(x + 23, y + 311) * 34;
            const rotation = (Math.floor(_geoHash2(x + 719, y + 97) * 4) * Math.PI) / 2;
            storyDrawAtlasCell(ctx, 'seaDetail', row * 4 + col, x, y + size * .5,
                size, size * .82, .11, rotation, _geoHash2(x + 31, y + 971) > .5);
        }
    }

    // Seyrek gemiler denizin ölçeğini ve ticaret hissini verir. Konumlar kara
    // maskesinden türetilir; statik resim haritayı veya sahipliği belirlemez.
    if (storyMapAtlasReady('maritime')) {
        for (let y = 58; y < H - 46; y += 112) for (let x = 58; x < W - 50; x += 112) {
            const i = y * W + x;
            if (land[i] || (dSea && dSea[i] < 13 * f) || _geoHash2(x + 199, y + 887) < .42) continue;
            const variant = Math.floor(_geoHash2(x + 401, y + 17) * 9);
            const size = 24 + _geoHash2(x + 61, y + 503) * 13;
            storyDrawAtlasCell(ctx, 'maritime', variant, x, y + size * .48,
                size, size, .88);
        }
    }
    if (storyMapAtlasReady('forests')) {
        for (let y = 24; y < H - 22; y += 34) for (let x = 24; x < W - 22; x += 34) {
            const i = y * W + x, density = _geoFbm(x * .022 / f + 200, y * .022 / f, 4);
            if (!land[i] || y > GEO.desertY * .9 || hgt[i] > .70
                || density < .39 || _geoHash2(x + 403, y + 97) < .10) continue;
            const jx = (_geoHash2(x + 5, y + 9) - .5) * 16, jy = (_geoHash2(x + 11, y + 3) - .5) * 10;
            const size = 50 + _geoHash2(x + 21, y + 33) * 28;
            const band = y < GEO.borealY * .9 ? 2 : (density > .61 ? 0 : 1);
            const variant = band * 4 + Math.floor(_geoHash2(x + 71, y + 17) * 4);
            storyDrawAtlasCell(ctx, 'forests', variant, x + jx, y + jy + size * .52,
                size, size, density > .58 ? .94 : .84,
                (_geoHash2(x + 1801, y + 271) - .5) * .32,
                _geoHash2(x + 991, y + 1433) > .5);
        }
    }
    if (storyMapAtlasReady('mountains')) {
        for (let ri = 0; ri < GEO.ranges.length; ri++) {
            const range = GEO.ranges[ri], pts = range.pts || [];
            for (let pi = 0; pi < pts.length; pi++) {
                const a = pts[pi], b = pts[Math.min(pi + 1, pts.length - 1)];
                // Range points are GEO-space coordinates. The old renderer used
                // a hard-coded .9 terrain scale; V2 builds at a different raster
                // density, so retaining .9 displaced and miniaturised every
                // mountain chain. Use the actual terrain scale supplied here.
                const gx = (a[0] + b[0]) * .5 * f, gy = (a[1] + b[1]) * .5 * f;
                const ix = Math.max(0, Math.min(W - 1, Math.round(gx)));
                const iy = Math.max(0, Math.min(H - 1, Math.round(gy)));
                if (!land[iy * W + ix]) continue;
                const dry = gy > GEO.desertY * .9, snowy = gy < GEO.borealY * 1.35 || (range.str || 0) > .92;
                const band = dry ? 3 : snowy ? 2 : (range.str || 0) > .72 ? 1 : 0;
                const variant = band * 4 + Math.floor(_geoHash2(ri * 31 + pi * 7, 991) * 4);
                const size = (52 + Math.min(1, Math.max(.2, range.str || .5)) * 25) * (f / .9);
                storyDrawAtlasCell(ctx, 'mountains', variant, gx, gy + size * .54,
                    size * 1.16, size, .92);
            }
        }
    }
}

function storyDrawSettlementSprite(ctx, node, px, py, farMap, scale, options) {
    if (!storyMapAtlasReady('settlements')) return null;
    const level = Math.max(1, Math.min(3, node.level | 0 || 1));
    const industrial = (node.fac | 0) >= 3;
    const row = industrial && level < 3 ? 2 : level >= 3 ? 3 : level - 1;
    const variant = row * 4 + Math.floor(storyHash((node.id | 0) * 17 + 5, row * 29 + 11) * 4);
    let size;
    if (typeof storyMapV2Enabled === 'function' && storyMapV2Enabled()) {
        const metrics = storyMapV2SettlementMetrics(node, Object.assign({
            cam: storyCam,
            minZoom: STORY._minZoom || storyMinZoom(STORY._cw || 800, STORY._ch || 600)
        }, options || {}));
        if (metrics.hidden) return metrics;
        size = metrics.size;
    } else {
        const base = farMap ? (level === 3 ? 50 : level === 2 ? (industrial ? 34 : 31) : 11)
            : (level === 3 ? 60 : level === 2 ? (industrial ? 43 : 39) : 25);
        size = Math.max(10, Math.round(base * Math.max(.76, scale)));
    }
    storyDrawAtlasCell(ctx, 'settlements', variant, px, py + Math.round(size * .27), size, size, 1);
    return { half: Math.max(4, Math.round(size * .31)), size };
}

function storyCoastalNetworkEnsure() {
    if (!STORY._landGrid || !STORY.nodes) return { ports: [], links: [] };
    const cached = STORY._coastalNetwork;
    if (cached && cached.grid === STORY._landGrid && cached.nodeCount === STORY.nodes.length) return cached;
    const grid = STORY._landGrid, ports = [];
    const at = (x, y) => (x < 0 || y < 0 || x >= STORY_GW || y >= STORY_GH)
        ? -2 : grid[y * STORY_GW + x];
    for (const node of STORY.nodes) {
        if ((node.level | 0) < 2) continue;
        const gx = Math.max(0, Math.min(STORY_GW - 1, Math.round(node.lx * (STORY_GW - 1))));
        const gy = Math.max(0, Math.min(STORY_GH - 1, Math.round(node.ly * (STORY_GH - 1))));
        let best = null;
        for (let r = 1; r <= 8 && !best; r++) {
            for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || at(gx + dx, gy + dy) !== -1) continue;
                const d = Math.hypot(dx, dy);
                if (!best || d < best.d) best = { x: gx + dx, y: gy + dy, d };
            }
        }
        if (!best) continue;
        ports.push({ node, lx: (best.x + .5) / STORY_GW, ly: (best.y + .5) / STORY_GH });
    }
    const waterRatio = (a, b) => {
        let water = 0, count = 0;
        for (let i = 2; i <= 18; i++) {
            const t = i / 20;
            const x = Math.round((a.lx + (b.lx - a.lx) * t) * (STORY_GW - 1));
            const y = Math.round((a.ly + (b.ly - a.ly) * t) * (STORY_GH - 1));
            if (at(x, y) === -1) water++;
            count++;
        }
        return count ? water / count : 0;
    };
    const links = [], seen = new Set();
    for (const a of ports) {
        const candidates = ports.filter(b => b !== a)
            .map(b => ({ b, d: Math.hypot(a.lx - b.lx, a.ly - b.ly) }))
            .filter(p => p.d < .24 && waterRatio(a, p.b) >= .58)
            .sort((p, q) => p.d - q.d).slice(0, 2);
        for (const p of candidates) {
            const key = a.node.id < p.b.node.id ? `${a.node.id}:${p.b.node.id}` : `${p.b.node.id}:${a.node.id}`;
            if (seen.has(key)) continue;
            seen.add(key); links.push({ a, b: p.b, key });
        }
    }
    STORY._coastalNetwork = { grid: STORY._landGrid, nodeCount: STORY.nodes.length, ports, links };
    return STORY._coastalNetwork;
}

function storyDrawMaritimeOverlay(ctx, farMap) {
    if (!storyMapAtlasReady('maritime')) return;
    const network = storyCoastalNetworkEnsure();
    ctx.save();
    ctx.setLineDash(farMap ? [2, 5] : [4, 7]);
    ctx.lineWidth = farMap ? 1 : 1.25;
    ctx.strokeStyle = 'rgba(186,216,207,.32)';
    for (const link of network.links) {
        const a = storyW2S(link.a.lx * STORY_WORLD_W, link.a.ly * STORY_WORLD_H);
        const b = storyW2S(link.b.lx * STORY_WORLD_W, link.b.ly * STORY_WORLD_H);
        if (a.u < -.08 || a.u > 1.08 || b.u < -.08 || b.u > 1.08) continue;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.max(1, Math.hypot(dx, dy));
        const bend = Math.min(22, len * .10) * (storyHash(link.a.node.id + 91, link.b.node.id + 37) > .5 ? 1 : -1);
        ctx.beginPath(); ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(mx - dy / len * bend, my + dx / len * bend, b.x, b.y);
        ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const port of network.ports) {
        const p = storyW2S(port.lx * STORY_WORLD_W, port.ly * STORY_WORLD_H);
        if (p.u < -.04 || p.u > 1.05) continue;
        const level = Math.max(2, port.node.level | 0);
        const size = Math.round((farMap ? (level >= 3 ? 19 : 15) : (level >= 3 ? 29 : 23)) * storyPScale(p.u));
        const variant = 9 + Math.floor(storyHash(port.node.id * 23 + 7, 601) * 7);
        storyDrawAtlasCell(ctx, 'maritime', variant, p.x, p.y + size * .3, size, size, .92);

        // Büyük kıyı merkezleri yalnız daha büyük bir liman simgesi almaz; liman
        // çevresinde küçük gemi trafiği de üretir. Bu görsel hareketlilik ekonomik
        // kapasiteden gelir ve hiçbir savaş/ulaşım kuralı yaratmaz.
        const activePort = level >= 3 || (port.node.fac | 0) >= 3;
        if (activePort) {
            const city = storyW2S(port.node.lx * STORY_WORLD_W, port.node.ly * STORY_WORLD_H);
            let ox = p.x - city.x, oy = p.y - city.y;
            const olen = Math.max(1, Math.hypot(ox, oy)); ox /= olen; oy /= olen;
            const tx = -oy, ty = ox;
            const traffic = farMap ? 1 : 2;
            for (let k = 0; k < traffic; k++) {
                const side = k === 0 ? 1 : -1;
                const shipSize = Math.round(size * (farMap ? .72 : .62));
                const sx = p.x + ox * (shipSize * .85) + tx * side * (size * .78);
                const sy = p.y + oy * (shipSize * .55) + ty * side * (size * .52);
                const shipVariant = Math.floor(storyHash(port.node.id * 41 + k * 13, 881) * 9);
                storyDrawAtlasCell(ctx, 'maritime', shipVariant, sx, sy + shipSize * .42,
                    shipSize, shipSize, .82, 0, side < 0);
            }
        }
    }
    ctx.restore();
}

function storySecondaryRoadsEnsure() {
    const CT = (typeof GEO_CITIES !== 'undefined') ? GEO_CITIES : [];
    const RD = (typeof GEO_ROADS !== 'undefined') ? GEO_ROADS : [];
    const cached = STORY._secondaryRoads;
    if (cached && cached.cityCount === CT.length && cached.grid === STORY._landGrid) return cached.links;
    if (!CT.length || !STORY._landGrid) return [];
    const primary = new Set(RD.map(e => e[0] < e[1] ? `${e[0]}:${e[1]}` : `${e[1]}:${e[0]}`));
    const seen = new Set(), links = [];
    const onLandRatio = (a, b) => {
        let land = 0, count = 0;
        for (let k = 1; k < 10; k++) {
            const t = k / 10;
            const gx = Math.max(0, Math.min(STORY_GW - 1, Math.round((a.x + (b.x - a.x) * t) / GEO.W * (STORY_GW - 1))));
            const gy = Math.max(0, Math.min(STORY_GH - 1, Math.round((a.y + (b.y - a.y) * t) / GEO.H * (STORY_GH - 1))));
            if (STORY._landGrid[gy * STORY_GW + gx] >= 0) land++;
            count++;
        }
        return count ? land / count : 0;
    };
    for (let i = 0; i < CT.length; i++) {
        const a = CT[i];
        const candidates = [];
        for (let j = 0; j < CT.length; j++) {
            // Roads follow terrain and trade geography, not current political
            // ownership. Cross-border links must survive conquests and treaties.
            if (i === j) continue;
            const b = CT[j], d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d >= 15 && d <= 108) candidates.push({ j, b, d });
        }
        candidates.sort((p, q) => p.d - q.d);
        for (const p of candidates.slice(0, a.tier >= 2 ? 2 : 1)) {
            const key = i < p.j ? `${i}:${p.j}` : `${p.j}:${i}`;
            if (seen.has(key) || primary.has(key) || onLandRatio(a, p.b) < .82) continue;
            seen.add(key); links.push({ a, b: p.b, key });
        }
    }
    STORY._secondaryRoads = { cityCount: CT.length, grid: STORY._landGrid, links };
    return links;
}

function storyDrawPrimaryRoadOverlay(ctx, farMap) {
    if (typeof storyMapV2Enabled !== 'function' || !storyMapV2Enabled()) return;
    const CT = (typeof GEO_CITIES !== 'undefined') ? GEO_CITIES : [];
    const RD = (typeof GEO_ROADS !== 'undefined') ? GEO_ROADS : [];
    const ratio = typeof storyMapV2ZoomRatio === 'function'
        ? storyMapV2ZoomRatio(storyCam, STORY._minZoom || storyCam.zoom) : 1;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < RD.length; i++) {
        const edge = RD[i], from = CT[edge[0]], to = CT[edge[1]];
        if (!from || !to) continue;
        const a = storyW2S(from.x / GEO.W * STORY_WORLD_W, from.y / GEO.H * STORY_WORLD_H);
        const b = storyW2S(to.x / GEO.W * STORY_WORLD_W, to.y / GEO.H * STORY_WORLD_H);
        if ((a.x < -80 && b.x < -80) || (a.x > STORY._cw + 80 && b.x > STORY._cw + 80)
            || (a.y < -80 && b.y < -80) || (a.y > STORY._ch + 80 && b.y > STORY._ch + 80)) continue;
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.max(1, Math.hypot(dx, dy));
        const bend = Math.min(farMap ? 6 : 18, len * .075) * (storyHash(i * 17 + 3, 409) > .5 ? 1 : -1);
        const mx = (a.x + b.x) / 2 - dy / len * bend;
        const my = (a.y + b.y) / 2 + dx / len * bend;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y);
        ctx.strokeStyle = farMap ? 'rgba(37,29,20,.58)' : 'rgba(30,24,18,.64)';
        ctx.lineWidth = farMap ? 1.35 : Math.min(3, 1.7 + ratio * .08); ctx.stroke();
        ctx.strokeStyle = farMap ? 'rgba(214,190,132,.50)' : 'rgba(214,190,132,.62)';
        ctx.lineWidth = farMap ? .55 : Math.min(1.2, .65 + ratio * .035); ctx.stroke();
    }
    ctx.restore();
}

function storyDrawSecondaryRoadOverlay(ctx, farMap) {
    const links = storySecondaryRoadsEnsure();
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const a = storyW2S(link.a.x / GEO.W * STORY_WORLD_W, link.a.y / GEO.H * STORY_WORLD_H);
        const b = storyW2S(link.b.x / GEO.W * STORY_WORLD_W, link.b.y / GEO.H * STORY_WORLD_H);
        if (a.u < -.06 || a.u > 1.06 || b.u < -.06 || b.u > 1.06) continue;
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.max(1, Math.hypot(dx, dy));
        const bend = Math.min(15, len * .08) * (storyHash(i * 31 + 17, 431) > .5 ? 1 : -1);
        const mx = (a.x + b.x) / 2 - dy / len * bend;
        const my = (a.y + b.y) / 2 + dx / len * bend;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y);
        ctx.strokeStyle = farMap ? 'rgba(35,27,18,.25)' : 'rgba(35,27,18,.40)';
        ctx.lineWidth = farMap ? .9 : 2.1; ctx.stroke();
        ctx.strokeStyle = farMap ? 'rgba(205,180,123,.28)' : 'rgba(205,180,123,.42)';
        ctx.lineWidth = farMap ? .34 : .8; ctx.stroke();
    }
    ctx.restore();
}
function storyGeoTerrainCache() {
    const mapPalette = typeof storyMapPaletteDescriptor === 'function'
        ? storyMapPaletteDescriptor()
        : { id: 'neutral', rgb: [1, 1, 1], lift: [0, 0, 0] };
    const mapPaletteKey = typeof storyMapPaletteKey === 'function'
        ? storyMapPaletteKey()
        : 'palette:neutral';
    if (STORY._geoTerrain && STORY._geoTerrainSource
        && STORY._geoTerrainSource.paletteKey === mapPaletteKey) {
        return STORY._geoTerrain;
    }
    // GÜVENLİK: gerçek canvas gerektirir (createImageData/putImageData). jsdom stub'ında düz zemine düş.
    try {
        const _t = document.createElement('canvas'); _t.width = 4; _t.height = 4;
        const _c = _t.getContext('2d'); const _im = _c.createImageData(2, 2);
        if (!_im || !_im.data || _im.data.length < 16) throw new Error('stub canvas');
    } catch (e) {
        const fb = document.createElement('canvas'); fb.width = 8; fb.height = 8;
        try { const c = fb.getContext('2d'); c.fillStyle = '#12321e'; c.fillRect(0, 0, 8, 8); } catch (_) {}
        STORY._geoTerrainSource = {
            adapterVersion: 'stub-canvas-fallback',
            paletteId: mapPalette.id,
            paletteKey: mapPaletteKey,
            width: fb.width,
            height: fb.height
        };
        STORY._geoTerrain = fb; return fb;
    }
    // V2 yakın görünüm tabanı: eski 0.9 ölçek (1350 px) 4.5x zoomda dev
    // piksellere/bulanıklığa dönüşüyordu. 1.6 ölçek tüm üretilmiş atlasları
    // korurken arazi tamponunu 2400 px'e çıkarır; dinamik politik katman ayrı kalır.
    const S = (typeof storyMapV2Enabled === 'function' && storyMapV2Enabled()) ? 1.6 : 0.9;
    const W = Math.round(GEO.W * S), H = Math.round(GEO.H * S), f = S / 0.95;   // f: prototip S=0.95 eşiklerini oranla
    const fbm = (x, y, o) => _geoFbm(x, y, o || 5);
    // 1) kara maskesi. Faz 14.2 açıkken GEO.land burada ikinci kez scanline
    // edilmez; terrain, politik overlay ve hit-test aynı kanonik maskeyi örnekler.
    let land = null;
    let terrainRaster = null;
    if (typeof storyMapRasterEnabled === 'function' && storyMapRasterEnabled()
        && typeof storyMapRasterResampleLand === 'function') {
        terrainRaster = storyMapRasterEnsure();
        land = storyMapRasterResampleLand(W, H);
    }
    if (!land) {
        land = new Uint8Array(W * H);
        for (const ring of GEO.land) for (let gy = 0; gy < H; gy++) {
            const y = (gy + 0.5) / S, xs = [];
            for (let i = 0; i < ring.length; i++) {
                const x1 = ring[i][0], y1 = ring[i][1], x2 = ring[(i + 1) % ring.length][0], y2 = ring[(i + 1) % ring.length][1];
                if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + (y - y1) / (y2 - y1) * (x2 - x1));
            }
            xs.sort((a, b) => a - b);
            for (let k = 0; k + 1 < xs.length; k += 2) {
                const a = Math.max(0, Math.ceil(xs[k] * S - 0.5));
                const b = Math.min(W - 1, Math.floor(xs[k + 1] * S - 0.5));
                for (let gx = a; gx <= b; gx++) land[gy * W + gx] ^= 1;
            }
        }
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
            if (dSea[i] <= 2.2 * f) col = _geoMixRgb(col, [91, 151, 168], .52);
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
            if (dLand[i] <= 1.5 * f) col = _geoMixRgb(col, [204, 181, 96], .42);
        }
        o[k] = Math.max(0, Math.min(255, Math.round(col[0] * mapPalette.rgb[0] + mapPalette.lift[0])));
        o[k + 1] = Math.max(0, Math.min(255, Math.round(col[1] * mapPalette.rgb[1] + mapPalette.lift[1])));
        o[k + 2] = Math.max(0, Math.min(255, Math.round(col[2] * mapPalette.rgb[2] + mapPalette.lift[2])));
        o[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // V2 yalnız gerçek raster atlaslarını kullanır. Eski prosedürel üçgen ağaç/
    // dağ işaretleri referanstaki doğal siluetleri debug sembollerine çeviriyordu.
    if (typeof storyMapV2Enabled !== 'function' || !storyMapV2Enabled()) {
        storyDrawGeoNaturalDetail(ctx, land, hgt, W, H, f);
    }
    storyDrawGeoAtlasDetail(ctx, land, hgt, W, H, f, dLand, dSea);
    // nehirler — çift hat
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const rv of rivers0) { ctx.beginPath(); ctx.moveTo(rv[0][0], rv[0][1]); for (let i = 1; i < rv.length; i++) ctx.lineTo(rv[i][0], rv[i][1]); ctx.strokeStyle = '#20364e'; ctx.lineWidth = Math.max(1, 3 * S); ctx.stroke(); ctx.strokeStyle = '#3e7096'; ctx.lineWidth = Math.max(1, 1.4 * S); ctx.stroke(); }
    // yerleşim / yol / maden / fabrika / petrol / kale (tampon ölçeğinde)
    // Legacy renderer baked roads, cities and resource marks into terrain.
    // V2 keeps them as independent world/UI layers so they preserve scale and
    // can change without rebuilding the physical map raster.
    if (typeof storyMapV2Enabled !== 'function' || !storyMapV2Enabled()) storyDrawGeoSettlements(ctx, S);
    STORY._geoTerrainSource = terrainRaster ? {
        adapterVersion: STORY_MAP_RASTER_ADAPTER_VERSION,
        sourceHash: terrainRaster.sourceHash,
        landHash: storyMapRasterHashBytes(land),
        paletteId: mapPalette.id,
        paletteKey: mapPaletteKey,
        width: W,
        height: H
    } : {
        adapterVersion: 'legacy-geo-scanline',
        paletteId: mapPalette.id,
        paletteKey: mapPaletteKey,
        width: W,
        height: H
    };
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
        if (typeof storyMapRasterEnabled === 'function' && storyMapRasterEnabled()
            && typeof storyMapRasterResample === 'function') {
            const canonical = storyMapRasterResample(w, h);
            if (canonical) {
                STORY._landGrid = Array.from(canonical.regionIds);
                STORY._landGridSource = {
                    adapterVersion: STORY_MAP_RASTER_ADAPTER_VERSION,
                    sourceHash: canonical.sourceHash,
                    landHash: canonical.landHash,
                    regionHash: canonical.regionHash,
                    width: w,
                    height: h
                };
                if (typeof storyInvalidateMapCaches === 'function'
                    && storyInvalidateMapCaches('derived', 'land-grid-rebuilt').ok) {
                    // Merkezî kapı, mevcut kara gridini koruyup türetilmiş render cache'lerini temizledi.
                } else {
                    STORY._ownerKey = null;
                    STORY._ownerCache = null;
                    STORY._terrainCache = null;
                    STORY._geoTerrain = null;
                }
                return;
            }
        }
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
        STORY._landGrid = grid; STORY._landGridSource = { adapterVersion: 'legacy-geo-scanline' };
        if (!(typeof storyInvalidateMapCaches === 'function'
            && storyInvalidateMapCaches('derived', 'land-grid-rebuilt').ok)) {
            STORY._ownerKey = null; STORY._ownerCache = null; STORY._terrainCache = null; STORY._geoTerrain = null;
        }
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
        STORY._landGrid = grid;
        if (!(typeof storyInvalidateMapCaches === 'function'
            && storyInvalidateMapCaches('derived', 'land-grid-rebuilt').ok)) {
            STORY._ownerKey = null; STORY._terrainCache = null; STORY._geoTerrain = null;
        }
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
    STORY._landGrid = grid;
    if (!(typeof storyInvalidateMapCaches === 'function'
        && storyInvalidateMapCaches('derived', 'land-grid-rebuilt').ok)) {
        STORY._ownerKey = null; STORY._terrainCache = null; STORY._geoTerrain = null;
    }
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
    if (typeof storyPoliticalOverlayEnabled === 'function'
        && storyPoliticalOverlayEnabled()
        && typeof storyPoliticalOverlayEnsureCanvas === 'function') {
        const canonicalCanvas = storyPoliticalOverlayEnsureCanvas();
        if (canonicalCanvas) return canonicalCanvas;
    }
    if (!STORY._landGrid) storyBuildLandGrid();
    const key = STORY.nodes.map(n => n.owner).join(',');
    if (STORY._ownerCache && STORY._ownerKey === key) return STORY._ownerCache;
    let cv = STORY._ownerCache;
    if (!cv || cv.width !== STORY_GW || cv.height !== STORY_GH) {
        cv = document.createElement('canvas');
        cv.width = STORY_GW;
        cv.height = STORY_GH;
        STORY._ownerCache = cv;
    }
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
        if (bord) g.fillStyle = `rgba(${oc[0] * 0.5 | 0},${oc[1] * 0.5 | 0},${oc[2] * 0.5 | 0},0.68)`; // imparatorluk sınırı
        else g.fillStyle = `rgba(${oc[0]},${oc[1]},${oc[2]},0.10)`;                                    // iç bölge: rölyef görünsün
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
    // V2 local LOD: high-frequency ground atlas is drawn live in world space.
    // It is not baked into the low-resolution overview raster, so zooming in
    // reveals fields/forest texture instead of magnifying old terrain pixels.
    if (typeof storyMapV2Enabled === 'function' && storyMapV2Enabled()
        && typeof storyMapV2DrawGroundDetail === 'function') storyMapV2DrawGroundDetail(g);
    // (2) DİNAMİK POLİTİK katman (sahip-rengi yarı-saydam) — warp'lı; fetihte renk anında değişir
    const ovl = storyEnsureOwnerOverlay();
    storyBlitWarp(g, ovl);
    // V2 inhabited-world layer. Rural clusters stay in canonical world space,
    // are clipped by the shared land raster and sit below roads/cities. This
    // keeps political ownership readable without leaving the continent empty.
    if (typeof storyMapV2Enabled === 'function' && storyMapV2Enabled()
        && typeof storyMapV2DrawRuralEnvironment === 'function') {
        storyMapV2DrawRuralEnvironment(g);
    }
    STORY._imgMode = false;
    // War Room renk işlemi: arazi okunur kalırken amber terminal kontrastına yaklaşır.
    if (typeof storyMapV2Enabled !== 'function' || !storyMapV2Enabled()) {
        g.fillStyle = 'rgba(2,8,4,0.12)'; g.fillRect(0, 0, w, h);
        g.strokeStyle = 'rgba(255,176,0,0.025)'; g.lineWidth = 1;
        for (let gx = 0; gx < w; gx += 60) { g.beginPath(); g.moveTo(gx, 0); g.lineTo(gx, h); g.stroke(); }
        for (let gy = 0; gy < h; gy += 60) { g.beginPath(); g.moveTo(0, gy); g.lineTo(w, gy); g.stroke(); }
    }

    const farMap = storyCam.zoom <= storyMinZoom(w, h) * 1.25;
    const mapZoomRatio = typeof storyMapV2ZoomRatio === 'function'
        ? storyMapV2ZoomRatio(storyCam, STORY._minZoom || storyCam.zoom)
        : storyCam.zoom / Math.max(.0001, storyMinZoom(w, h));
    storyDrawMaritimeOverlay(g, farMap);
    storyDrawPrimaryRoadOverlay(g, farMap);
    storyDrawSecondaryRoadOverlay(g, farMap);
    // (3) Kaynak işaretleri — uzak görünümde gizlenir; stratejik harita şehir
    // atlası ve önemli etiketlerle okunur, debug noktalarıyla değil.
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
        if (!farMap) {
            drawMarks(STORY_TERRAIN.oil, '#ff8a00', 2);     // petrol
            drawMarks(STORY_TERRAIN.pts, '#3cdc6e', 2);     // puan
        }
    }

    const cmdNode = STORY.commander.node;
    const adj = storyNode(cmdNode) ? storyNode(cmdNode).neighbors : [];
    const labelBoxes = [];

    // KOMUTANIN ulaşabildiği komşu bağlantıları (yeşil=kendi bölge, kırmızı=saldırı) — sade
    const cmdP = storyNode(cmdNode) ? storyNodePixel(storyNode(cmdNode), w, h) : null;
    if (cmdP) {
        g.save();
        g.setLineDash(farMap ? [2, 7] : [3, 9]);
        g.lineWidth = farMap ? .65 : .75;
        for (const mId of adj) {
            const m = storyNode(mId); const b = storyNodePixel(m, w, h);
            g.strokeStyle = (m.owner === STORY.playerStateId) ? 'rgba(120,235,160,0.16)' : 'rgba(255,90,90,0.22)';
            g.beginPath(); g.moveTo(cmdP.x, cmdP.y); g.lineTo(b.x, b.y); g.stroke();
        }
        g.restore();
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
        const sq = Math.max(2, Math.round((isCmd ? (farMap ? 6 : 9) : (farMap ? 3.2 : 5.5))
            * sc * (farMap ? Math.min(tierBoost, 1.25) : tierBoost)));
        const px = Math.round(p.x), py = Math.round(p.y);
        const settlement = storyDrawSettlementSprite(g, n, px, py, farMap, sc, {
            commander: isCmd, selected: isSelected, actionable: attackable || moveable
        });
        const cityHidden = !!(settlement && settlement.hidden);
        if (!settlement) {
            g.fillStyle = '#000'; g.fillRect(px - sq - 1, py - sq - 1, 2 * sq + 2, 2 * sq + 2);
            g.fillStyle = st ? st.color : '#888';
            g.fillRect(px - sq, py - sq, 2 * sq, 2 * sq);
        } else if (cityHidden) {
            // Overview LOD: minor settlements are removed instead of enlarged.
        } else if (settlement.minor) {
            g.fillStyle = '#080b08'; g.fillRect(px - 2, py - 2, 5, 5);
            g.fillStyle = st ? st.color : '#888'; g.fillRect(px - 1, py - 1, 3, 3);
        } else if (settlement.size >= 8) {
            const ownerHalf = Math.max(3, Math.round(settlement.half * .82));
            g.fillStyle = '#090b08'; g.fillRect(px - ownerHalf - 1, py + 1, ownerHalf * 2 + 2, 3);
            g.fillStyle = st ? st.color : '#888'; g.fillRect(px - ownerHalf, py + 2, ownerHalf * 2, 1);
        }
        // ── DESIGN İKONLARI: fabrika bacası / petrol kulesi / maden kazması / kışla flaması ──
        // Yakınlaşınca ya da büyük şehirlerde göster (uzak/küçük şehirde kalabalık yapmasın).
        const detail = !farMap && mapZoomRatio >= 7.5
            && ((n.level || 1) >= 2 || (settlement && settlement.size >= 28));
        if (!cityHidden && detail && p.u > -0.05 && p.u < 1.05 && px > -30 && px < w + 30) {
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
            const visualSeconds = Number.isFinite(STORY._lastFrameT)
                ? STORY._lastFrameT / 1000
                : STORY.clock;
            const pulse = Math.round(3 + 2 * (1 + Math.sin(visualSeconds * 4 + n.id)));
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
        // Referans-stili stratejik şehir etiketi. Sadece final ekran uzayında çizilir;
        // böylece terrain/politik katman altında kaybolmaz ve zoom ile okunur kalır.
        const labelEligible = (n.level || 1) >= 2
            || (settlement && settlement.size >= 26)
            || isSelected || attackable || moveable;
        if (!cityHidden && labelEligible && !isCmd) {
            const label = String(n.name || '').toLocaleUpperCase('tr-TR');
            const labelSize = farMap ? ((n.level || 1) >= 3 ? 9 : 7) : ((n.level || 1) >= 3 ? 10 : 9);
            g.font = `bold ${labelSize}px monospace`; g.textAlign = 'left'; g.textBaseline = 'middle';
            const tw = Math.ceil(g.measureText(label).width), lh = labelSize + 3;
            const spriteFoot = settlement ? Math.round(settlement.size * .30) : sq;
            const bx = px - Math.round(tw / 2) - 3, by = py + spriteFoot + 4;
            const box = { x: bx, y: by, w: tw + 6, h: lh };
            if (!labelBoxes.some(p => box.x < p.x + p.w + 3 && box.x + box.w + 3 > p.x
                && box.y < p.y + p.h + 2 && box.y + box.h + 2 > p.y)) {
                labelBoxes.push(box);
                g.fillStyle = 'rgba(7,13,10,.88)'; g.fillRect(box.x, box.y, box.w, box.h);
                g.strokeStyle = (n.level || 1) >= 3 ? '#e0bd54' : 'rgba(142,164,122,.9)'; g.lineWidth = 1;
                g.strokeRect(box.x + .5, box.y + .5, box.w - 1, box.h - 1);
                g.fillStyle = '#e7dfbd'; g.fillText(label, box.x + 3, box.y + box.h / 2 + .5);
            }
        }
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
            const token = farMap ? 3 : 4;
            const cx = Math.round(cp.x + (i - (list.length - 1) / 2) * (farMap ? 5 : 7)), cy = Math.round(cp.y - (farMap ? 9 : 13));
            g.beginPath(); g.moveTo(cx, cy - token); g.lineTo(cx - token, cy + token); g.lineTo(cx + token, cy + token); g.closePath();
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
