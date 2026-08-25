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
    
    // Canlı fiziksel araç süzülmesi 60 Hz tam akıcılıkta kalır
    if (typeof storyTransportContinuousAdvance === 'function') {
        storyTransportContinuousAdvance(dt);
    }
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
    // Statik dünya hareketli ajanların tikine bağlanamaz. Kamera/seçim olayları
    // zaten anlık storyRender çağırır; simülasyon tarafında yalnız gerçekten
    // görünür dünya durumu değişince ağır katman yeniden çizilir.
    STORY._worldVisualCheckAcc = (STORY._worldVisualCheckAcc || 0) + dt;
    if (!STORY._worldVisualStateKey || STORY._worldVisualCheckAcc >= 1.0) {
        STORY._worldVisualCheckAcc = 0;
        const visualKey = storyWorldVisualStateKey();
        if (visualKey !== STORY._worldVisualStateKey) {
            STORY._worldVisualStateKey = visualKey;
            storyRender();
        }
    }
    // Üst/sağ HUD statik haritayı yeniden çizmeden 2 Hz canlı kalır.
    STORY._panelUpdateAcc = (STORY._panelUpdateAcc || 0) + dt;
    if (STORY._panelUpdateAcc >= .5) {
        STORY._panelUpdateAcc = 0;
        storyPanelUpdate();
    }
    storyRenderTransportOverlay();
}

function storyWorldVisualStateKey() {
    const nodes = (STORY.nodes || []).map(node => node ? [
        node.id, node.owner, node.level | 0, node.fac | 0,
        node.oil ? 1 : 0, node.mine ? 1 : 0, node.bar | 0,
        node.geo ? 1 : 0
    ].join(':') : '-').join(',');
    const invalidation = STORY._mapCacheInvalidation || {};
    return [
        'world-visual-state-3', nodes,
        STORY.commander && STORY.commander.node,
        STORY.selectedNodeId,
        STORY.hexConstruction && STORY.hexConstruction.version || 0,
        STORY.hexLandManagement && STORY.hexLandManagement.version || 0,
        STORY.infrastructureWorks && STORY.infrastructureWorks.revision || 0,
        STORY.physicalInfrastructure && STORY.physicalInfrastructure.revision || 0,
        Number(invalidation.revision) || 0,
        typeof storyCalendarNow === 'function' ? storyCalendarNow().seasonIndex : 0
    ].join('|');
}

function storyResize(force) {
    const cv = document.getElementById('storyCanvas');
    if (!cv) return;
    if (!force && STORY._cw && STORY._ch && cv.width === STORY._cw && cv.height === STORY._ch) return;
    const w = cv.clientWidth || 800, h = cv.clientHeight || 600;
    if (cv.width !== w) cv.width = w;
    if (cv.height !== h) cv.height = h;
    STORY._cw = w; STORY._ch = h;
    const transport = document.getElementById('storyTransportCanvas');
    if (transport) {
        if (transport.width !== w) transport.width = w;
        if (transport.height !== h) transport.height = h;
    }
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
    const position = typeof storyHexSettlementNodePosition === 'function'
        ? storyHexSettlementNodePosition(n, STORY_WORLD_W, STORY_WORLD_H)
        : { x: n.lx * STORY_WORLD_W, y: n.ly * STORY_WORLD_H };
    if (typeof storyMapV2Enabled === 'function' && storyMapV2Enabled()) {
        STORY._cw = cv.width; STORY._ch = cv.height;
        storyMapV2CenterCamera(storyCam, position.x, position.y, cv.width, cv.height);
        storyClampCam(cv.width, cv.height);
        return;
    }
    STORY._cw = cv.width; STORY._ch = cv.height;                     // WARP: düğüm ekran ortasına (u=0.5)
    storyCam.x = position.x - (cv.width / 2) / storyCam.zoom;
    storyCam.y = position.y - storyVyOf(0.5) / storyCam.zoom;
    storyClampCam(cv.width, cv.height);
}

// Düğüm DÜNYA-konumu → EKRAN (2.5D warp). u = perspektif ölçeği (jeton boyutu).
function storyNodePixel(n) {
    const position = typeof storyHexSettlementNodePosition === 'function'
        ? storyHexSettlementNodePosition(n, STORY_WORLD_W, STORY_WORLD_H)
        : { x: n.lx * STORY_WORLD_W, y: n.ly * STORY_WORLD_H };
    const s = storyW2S(position.x, position.y);
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
    // Etkileşim/sürükleme sırasında veya düz görünümde şerit kesim yerine
    // donanım hızlandırmalı tek parça drawImage kullanılır (26 ms -> 0.1 ms).
    if (STORY._mapInteracting || Math.abs(storyPP()) < 0.000001) {
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
    // 4x4 modern atlas: konut / kamusal-ticari / sanayi-lojistik / metropol.
    // Eski v2 atlasındaki sur, kubbe ve kırmızı kiremit dili 2032 dünyasını
    // tarihî gösteriyordu; dosya rollback için korunuyor, canlı harita v3'tür.
    settlements: { src: 'assets/maps/settlements-atlas-modern-v3.png', cols: 4, rows: 4 },
    constructionModern: { src: 'assets/maps/urban-construction-atlas-modern-v1.png', cols: 4, rows: 4 },
    urbanClimateModern: { src: 'assets/maps/urban-climate-atlas-modern-v1.png', cols: 4, rows: 4 },
    urbanFunctionalModern: { src: 'assets/maps/urban-functional-atlas-modern-v1.png', cols: 4, rows: 4 },
    urbanFunctionalBorealModern: { src: 'assets/maps/urban-functional-boreal-modern-v1.png', cols: 4, rows: 4 },
    urbanFunctionalDryModern: { src: 'assets/maps/urban-functional-dry-modern-v1.png', cols: 4, rows: 4 },
    urbanDamageModern: { src: 'assets/maps/urban-damage-atlas-modern-v1.png', cols: 4, rows: 4 },
    specialFacilitiesModern: { src: 'assets/maps/special-facilities-atlas-modern-v1.png', cols: 4, rows: 4 },
    industrialSectorsModern: { src: 'assets/maps/industrial-sector-atlas-modern-v1.png', cols: 3, rows: 2 },
    landUseModern: { src: 'assets/maps/land-use-atlas-modern-v1.png', cols: 4, rows: 4 },
    groundDetail: { src: 'assets/maps/ground-texture-atlas-v1.png', cols: 4, rows: 4 },
    seasonalGround: { src: 'assets/maps/seasonal-ground-atlas-v1.png', cols: 4, rows: 4 },
    terrainDetail: { src: 'assets/maps/terrain-detail-atlas-v2.png', cols: 4, rows: 4 },
    ruralEnvironment: { src: 'assets/maps/rural-environment-atlas-v1.png', cols: 4, rows: 4 },
    geographyVarietyModern: { src: 'assets/maps/geography-variety-atlas-modern-v1.png', cols: 4, rows: 4 },
    maritime: { src: 'assets/maps/maritime-atlas-v2.png', cols: 4, rows: 4 },
    modernPorts: { src: 'assets/maps/modern-port-terminal-atlas-v1.png', cols: 4, rows: 4 },
    seaDetail: { src: 'assets/maps/sea-detail-atlas-v2.png', cols: 4, rows: 4 },
    transportRoad: { src: 'assets/maps/transport-road-convoy-modern-v1.png', cols: 1, rows: 1 },
    transportRail: { src: 'assets/maps/transport-freight-train-modern-v1.png', cols: 1, rows: 1 },
    transportSea: { src: 'assets/maps/transport-cargo-ship-modern-v1.png', cols: 1, rows: 1 },
    conflictFireOverlay: { src: 'assets/maps/conflict-fire-overlay-modern-v1.png', cols: 1, rows: 1 }
};

const STORY_SETTLEMENT_ATLAS_KEYS = Object.freeze([
    'settlements', 'urbanClimateModern', 'urbanFunctionalModern',
    'urbanFunctionalBorealModern', 'urbanFunctionalDryModern',
    'urbanDamageModern', 'specialFacilitiesModern',
    'industrialSectorsModern',
    'conflictFireOverlay'
]);

function storySettlementAtlasesReady() {
    return STORY_SETTLEMENT_ATLAS_KEYS.every(key => storyMapAtlasReady(key));
}

// Harita resmi statik bir arka plan değildir. Atlaslar yalnız sunum katmanıdır;
// konum, seviye, biyom ve sahiplik canlı simülasyondan gelmeye devam eder.
function storyMapAtlasEnsure() {
    if (typeof Image === 'undefined') return null;
    if (STORY._mapAtlases) return STORY._mapAtlases;
    const atlases = STORY._mapAtlases = {};
    for (const key of Object.keys(STORY_MAP_ATLAS_SPECS)) {
        const spec = STORY_MAP_ATLAS_SPECS[key], img = new Image();
        img.decoding = 'async';
        try { img.fetchPriority = key === 'settlements' ? 'high' : 'auto'; } catch (_) {}
        atlases[key] = { img, ready: false, cols: spec.cols, rows: spec.rows };
        img.onload = () => {
            atlases[key].ready = true;
            if (key === 'seasonalGround') {
                try {
                    const sw = img.naturalWidth / 4, sh = img.naturalHeight / 4;
                    atlases[key].seasonTiles = Array.from({ length: 4 }, (_, row) => {
                        // Mirror the authored seasonal source around both axes.
                        // The resulting canvas is a real-asset-backed seamless
                        // texture: repeated world coverage no longer exposes the
                        // four hard rectangular seams seen in the first winter pass.
                        const source = document.createElement('canvas');
                        source.width = 192; source.height = 192;
                        source.getContext('2d').drawImage(img, 0, row * sh, sw, sh,
                            0, 0, source.width, source.height);
                        const tile = document.createElement('canvas');
                        tile.width = 384; tile.height = 384;
                        const paint = tile.getContext('2d');
                        for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
                            paint.save();
                            paint.translate(x * 192 + (x ? 192 : 0),
                                y * 192 + (y ? 192 : 0));
                            paint.scale(x ? -1 : 1, y ? -1 : 1);
                            paint.drawImage(source, 0, 0, 192, 192);
                            paint.restore();
                        }
                        return tile;
                    });
                } catch (_) {}
            }
            if (key === 'modernPorts') {
                // Force the large generated atlas through decode/upload while
                // the player is still in menu/character creation. Otherwise
                // Chromium pays that cost on the first map paint slice.
                try {
                    const warm = document.createElement('canvas');
                    warm.width = 16; warm.height = 16;
                    const warmPaint = warm.getContext('2d');
                    warmPaint.drawImage(img, 0, 0, 16, 16);
                    atlases[key].warmCanvas = warm;
                } catch (_) {}
            }
            const ownsHexSurface = ['mountains', 'forests', 'groundDetail', 'seasonalGround',
                'terrainDetail', 'ruralEnvironment', 'geographyVarietyModern',
                'settlements', 'landUseModern'].includes(key);
            if (ownsHexSurface && typeof storyMapV2InvalidateHexNaturalContents === 'function') {
                storyMapV2InvalidateHexNaturalContents('atlas-ready:' + key);
            } else if (ownsHexSurface) {
                STORY._hexNaturalContentsKey = null;
            }
            if (STORY_SETTLEMENT_ATLAS_KEYS.includes(key)) {
                STORY._settlementLayerKey = null;
                STORY._settlementWorldLayers = null;
            }
            if (key === 'maritime' || key === 'modernPorts') {
                STORY._networkLayerKey = null;
                STORY._portWorldLayer = null;
            }
            // V2 owns atlas detail in its incremental hex surface. Rebuilding
            // the multi-million-pixel procedural base for every decoded image
            // used to stall the main thread repeatedly and postpone cities.
            if ((typeof storyMapV2Enabled !== 'function' || !storyMapV2Enabled())
                && key !== 'settlements') {
                STORY._geoTerrain = null;
                STORY._terrainCache = null;
            }
            if (typeof requestAnimationFrame === 'function' && !STORY._atlasRenderFrame) {
                STORY._atlasRenderFrame = requestAnimationFrame(() => {
                    STORY._atlasRenderFrame = 0;
                    if (typeof storyRender === 'function'
                        && (typeof APP_SCREEN === 'undefined' || APP_SCREEN === 'story')) storyRender();
                });
            }
        };
        img.onerror = () => { atlases[key].failed = true; };
        img.src = spec.src;
    }
    return atlases;
}

// Start local image I/O while the player is still in the menu/character flow.
// The first map frame can therefore draw settlements immediately instead of
// waiting for the 2.2 MB city atlas to be requested and decoded on demand.
function storyMapAtlasWarmup() {
    try { storyMapAtlasEnsure(); } catch (_) {}
}
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', storyMapAtlasWarmup, { once: true });
    } else storyMapAtlasWarmup();
}

function storyMapAtlasReady(key) {
    const all = storyMapAtlasEnsure();
    return !!(all && all[key] && all[key].ready && all[key].img.naturalWidth > 0);
}

function storyDrawAtlasCell(ctx, key, index, x, y, w, h, alpha, rotation, flipX) {
    const all = storyMapAtlasEnsure(), a = all && all[key];
    if (!a || !a.ready) return false;
    const placementPolicy = typeof storyVisualAtlasPlacementPolicy === 'function'
        ? storyVisualAtlasPlacementPolicy(key) : null;
    if (placementPolicy) {
        if (!placementPolicy.allowRotation) rotation = 0;
        if (!placementPolicy.allowFlip) flipX = false;
    }
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
    const hexContentsMode = typeof storyMapV2Enabled === 'function' && storyMapV2Enabled();

    const cityAnchors = [];
    if (typeof STORY !== 'undefined' && STORY && Array.isArray(STORY.nodes)) {
        for (const node of STORY.nodes) {
            let wx = Number(node && node.lx) * STORY_WORLD_W;
            let wy = Number(node && node.ly) * STORY_WORLD_H;
            if (typeof storyHexSettlementNodePosition === 'function') {
                const point = storyHexSettlementNodePosition(node, STORY_WORLD_W, STORY_WORLD_H);
                if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
                    wx = point.x; wy = point.y;
                }
            }
            if (Number.isFinite(wx) && Number.isFinite(wy)) cityAnchors.push({
                x: wx / STORY_WORLD_W * W,
                y: wy / STORY_WORLD_H * H,
                radius: (26 + Math.max(1, Number(node.level) || 1) * 10) * f
            });
        }
    }
    const nearCity = (x, y, padding) => {
        for (const city of cityAnchors) {
            const radius = city.radius + Math.max(0, Number(padding) || 0);
            const dx = city.x - x, dy = city.y - y;
            if (dx * dx + dy * dy < radius * radius) return true;
        }
        return false;
    };

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
    if (!hexContentsMode && storyMapAtlasReady('terrainDetail')) {
        for (let y = 34; y < H - 30; y += 41) for (let x = 32; x < W - 30; x += 41) {
            const i = y * W + x, h = hgt[i];
            if (!land[i] || h > .72
                || _geoHash2(x + 1709, y + 313) < .26) continue;
            const dry = y > GEO.desertY * .9;
            const mediterranean = !dry && y > GEO.desertY * .68;
            const forestN = _geoFbm(x * .022 / f + 200, y * .022 / f, 4);
            const row = dry ? 3 : mediterranean ? 2 : forestN > .56 ? 1 : 0;
            const variant = row * 4 + Math.floor(_geoHash2(x + 41, y + 73) * 4);
            const size = 64 + _geoHash2(x + 101, y + 29) * 28;
            if (dLand && dLand[i] < size * .56) continue;
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
            if (!land[i] || h > .67) continue;
            const dry = ty > GEO.desertY * .9;
            const mediterranean = !dry && ty > GEO.desertY * .68;
            const forestN = _geoFbm(tx * .022 / f + 200, ty * .022 / f, 4);
            const regionalDensity = dry ? .34 : mediterranean ? .69
                : forestN > .60 ? .84 : forestN > .53 ? .72 : .57;
            if (_geoHash2(x + 1217, y + 2539) > regionalDensity) continue;
            const row = dry ? 3 : mediterranean ? 2 : forestN > .56 ? 1 : 0;
            const variant = row * 4 + Math.floor(_geoHash2(x + 337, y + 1019) * 4);
            const size = 29 + _geoHash2(x + 409, y + 1153) * 17;
            if (dLand && dLand[i] < size * .54) continue;
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
        const canonicalCoast = typeof storyMapV2Enabled === 'function' && storyMapV2Enabled();
        if (!canonicalCoast) {
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

    // Açık denizde statik dekor gemisi çizilmez. Görünen her taşıt gerçek bir
    // ShipmentV2/seyahat kaydına bağlı olacak; aksi halde harita oyuncuya var
    // olmayan ticaret ve hareket bilgisi veriyordu.
    if (!hexContentsMode && storyMapAtlasReady('forests')) {
        for (let y = 24; y < H - 22; y += 34) for (let x = 24; x < W - 22; x += 34) {
            const i = y * W + x, density = _geoFbm(x * .022 / f + 200, y * .022 / f, 4);
            if (!land[i] || y > GEO.desertY * .9 || hgt[i] > .70
                || density < .39 || _geoHash2(x + 403, y + 97) < .10) continue;
            const jx = (_geoHash2(x + 5, y + 9) - .5) * 16, jy = (_geoHash2(x + 11, y + 3) - .5) * 10;
            const size = 50 + _geoHash2(x + 21, y + 33) * 28;
            if ((dLand && dLand[i] < size * .52) || nearCity(x + jx, y + jy, size * .42)) continue;
            const band = y < GEO.borealY * .9 ? 2 : (density > .61 ? 0 : 1);
            const variant = band * 4 + Math.floor(_geoHash2(x + 71, y + 17) * 4);
            storyDrawAtlasCell(ctx, 'forests', variant, x + jx, y + jy + size * .52,
                size, size, density > .58 ? .94 : .84,
                (_geoHash2(x + 1801, y + 271) - .5) * .32,
                _geoHash2(x + 991, y + 1433) > .5);
        }
    }
    if (!hexContentsMode && storyMapAtlasReady('mountains')) {
        const mountainPlacements = [];
        for (let ri = 0; ri < GEO.ranges.length; ri++) {
            const range = GEO.ranges[ri], pts = range.pts || [];
            const chain = typeof storyMapV2MountainPlacements === 'function'
                ? storyMapV2MountainPlacements(range, f, ri)
                : pts.slice(0, -1).map((a, pi) => {
                    const b = pts[pi + 1];
                    const size = (52 + Math.min(1, Math.max(.2, range.str || .5)) * 25) * (f / .9);
                    return { x: (a[0] + b[0]) * .5 * f, y: (a[1] + b[1]) * .5 * f,
                        size, rotation: 0, flipX: false, segment: pi, part: 0 };
                });
            for (const placement of chain) mountainPlacements.push({ ri, range, placement });
        }
        mountainPlacements.sort((a, b) => a.placement.y - b.placement.y || a.ri - b.ri);
        for (const entry of mountainPlacements) {
                const { ri, range, placement } = entry;
                // Range points are GEO-space coordinates. The old renderer used
                // a hard-coded .9 terrain scale; V2 builds at a different raster
                // density, so retaining .9 displaced and miniaturised every
                // mountain chain. Use the actual terrain scale supplied here.
                const gx = placement.x, gy = placement.y;
                const ix = Math.max(0, Math.min(W - 1, Math.round(gx)));
                const iy = Math.max(0, Math.min(H - 1, Math.round(gy)));
                const placementIndex = iy * W + ix;
                if (!land[placementIndex]) continue;
                const dry = gy > GEO.desertY * .9, snowy = gy < GEO.borealY * 1.35 || (range.str || 0) > .92;
                const band = dry ? 3 : snowy ? 2 : (range.str || 0) > .72 ? 1 : 0;
                const variant = band * 4 + Math.floor(_geoHash2(
                    ri * 31 + placement.segment * 7 + placement.part * 13, 991
                ) * 4);
                const size = placement.size;
                if ((dLand && dLand[placementIndex] < size * .48)
                    || nearCity(gx, gy, size * .72)) continue;
                storyDrawAtlasCell(ctx, 'mountains', variant, gx, gy + size * .54,
                    size * 1.12, size, .87, placement.rotation, placement.flipX);
        }
    }
}

function storySettlementLandScore(raster, wx, wy, radiusWorld, centerOffsetYWorld) {
    if (!raster) return 9;
    const isLand = typeof storyMapRasterIsLand === 'function'
        ? storyMapRasterIsLand
        : (r, nx, ny) => (typeof storyMapRasterSample === 'function' ? storyMapRasterSample(r, nx, ny).land : true);
    const rx = Math.max(1, Number(radiusWorld) || 1) / STORY_WORLD_W;
    const ry = Math.max(1, Number(radiusWorld) || 1) / STORY_WORLD_H;
    const nx = wx / STORY_WORLD_W;
    const ny = (wy + (Number(centerOffsetYWorld) || 0)) / STORY_WORLD_H;
    let score = 0;
    if (isLand(raster, nx, ny)) score++;
    if (isLand(raster, nx - rx, ny)) score++;
    if (isLand(raster, nx + rx, ny)) score++;
    if (isLand(raster, nx, ny - ry)) score++;
    if (isLand(raster, nx, ny + ry)) score++;
    if (isLand(raster, nx - rx * .72, ny - ry * .72)) score++;
    if (isLand(raster, nx + rx * .72, ny - ry * .72)) score++;
    if (isLand(raster, nx - rx * .72, ny + ry * .72)) score++;
    if (isLand(raster, nx + rx * .72, ny + ry * .72)) score++;
    return score;
}

function storyDrawSettlementSprite(ctx, node, px, py, farMap, scale, options) {
    if (!storySettlementAtlasesReady()) return null;
    const urbanFootprint = options && options.urbanFootprint;
    // Legacy `node.level` remains a compatibility fallback only. Once HXD-6
    // exists, the visible city tier follows its live population and physical
    // footprint, so growth/building changes can actually change the atlas row.
    const level = storySettlementVisualLevel(node, urbanFootprint);
    const industrial = urbanFootprint
        ? !!(urbanFootprint.requested && urbanFootprint.requested.industrial > 0)
        : (node.fac | 0) >= 3;
    const coreVisualRecipe = typeof storyVisualUrbanPresentationRecipe === 'function'
        ? storyVisualUrbanPresentationRecipe({
            node,
            urbanFootprint,
            kind: 'CORE',
            visualLevel: level,
            industrial,
            physicalSites: options && options.physicalSites,
            year: typeof STORY !== 'undefined' ? STORY.year : 2010
        }) : typeof storyVisualUrbanRecipe === 'function'
            ? storyVisualUrbanRecipe({
                node, urbanFootprint, kind: 'CORE', visualLevel: level, industrial,
                physicalSites: options && options.physicalSites,
                year: typeof STORY !== 'undefined' ? STORY.year : 2010
            }) : null;
    const row = coreVisualRecipe ? coreVisualRecipe.atlasRow
        : (industrial && level < 3 ? 2 : level >= 3 ? 3 : level - 1);
    const variant = coreVisualRecipe && Number.isInteger(coreVisualRecipe.atlasCell)
        ? coreVisualRecipe.atlasCell
        : row * 4 + Math.floor(storyHash((node.id | 0) * 17 + 5, row * 29 + 11) * 4);
    const coreAtlasKey = coreVisualRecipe && coreVisualRecipe.atlasKey || 'settlements';
    let size;
    if (typeof storyMapV2Enabled === 'function' && storyMapV2Enabled()) {
        const metrics = storyMapV2SettlementMetrics(node, Object.assign({
            cam: storyCam,
            minZoom: STORY._minZoom || storyMinZoom(STORY._cw || 800, STORY._ch || 600),
            visualLevel: level
        }, options || {}));
        if (metrics.hidden) return metrics;
        size = metrics.size;
    } else {
        const base = farMap ? (level === 3 ? 50 : level === 2 ? (industrial ? 34 : 31) : 11)
            : (level === 3 ? 60 : level === 2 ? (industrial ? 43 : 39) : 25);
        size = Math.max(10, Math.round(base * Math.max(.76, scale)));
    }
    const raster = typeof storyMapRasterEnsure === 'function' ? storyMapRasterEnsure() : null;
    let visualPx = px, visualPy = py;
    if (urbanFootprint && Array.isArray(urbanFootprint.districts)
        && typeof storyHexWorldEnsure === 'function') {
        const world = storyHexWorldEnsure();
        const candidates = urbanFootprint.districts.filter(district => district
            && district.center && district.kind !== 'LOGISTICS');
        let bestScore = -1;
        for (const district of candidates) {
            const wx = Number(district.center.x) / Number(world.width) * STORY_WORLD_W;
            const wy = Number(district.center.y) / Number(world.height) * STORY_WORLD_H;
            const spriteWorldSize = size / Math.max(.0001, storyCam.zoom);
            const score = storySettlementLandScore(raster, wx, wy,
                spriteWorldSize * .50, -spriteWorldSize * .26);
            if (score > bestScore) {
                const point = storyW2S(wx, wy);
                bestScore = score; visualPx = point.x; visualPy = point.y;
            }
        }
    }
    if (!(options && options.disableDistricts)
        && typeof storyMapV2SettlementDistrictMetrics === 'function') {
        const district = storyMapV2SettlementDistrictMetrics(node, Object.assign({
            cam: storyCam,
            minZoom: STORY._minZoom || storyMinZoom(STORY._cw || 800, STORY._ch || 600),
            visualLevel: level
        }, options || {}));
        if (district.visible && urbanFootprint && Array.isArray(urbanFootprint.districts)) {
            const world = storyHexWorldEnsure();
            for (let index = 1; index < urbanFootprint.districts.length; index++) {
                const urbanDistrict = urbanFootprint.districts[index];
                const wx = Number(urbanDistrict.center.x) / Number(world.width) * STORY_WORLD_W;
                const wy = Number(urbanDistrict.center.y) / Number(world.height) * STORY_WORLD_H;
                const point = storyW2S(wx, wy);
                const physicalSites = options && options.physicalSites;
                const physicalSiteIds = physicalSites && physicalSites.siteIdsByCellId
                    && physicalSites.siteIdsByCellId[urbanDistrict.id] || [];
                const physicalSite = physicalSiteIds.length && physicalSites.siteById
                    ? physicalSites.siteById[physicalSiteIds[0]] : null;
                const districtVisualRecipe = typeof storyVisualUrbanPresentationRecipe === 'function'
                    ? storyVisualUrbanPresentationRecipe({
                        node,
                        urbanFootprint,
                        district: urbanDistrict,
                        physicalSites,
                        physicalSite,
                        kind: urbanDistrict.kind,
                        visualLevel: level,
                        industrial,
                        year: typeof STORY !== 'undefined' ? STORY.year : 2010
                    }) : typeof storyVisualUrbanRecipe === 'function'
                        ? storyVisualUrbanRecipe({
                            node, urbanFootprint, district: urbanDistrict, physicalSites,
                            physicalSite, kind: urbanDistrict.kind, visualLevel: level,
                            industrial, year: typeof STORY !== 'undefined' ? STORY.year : 2010
                        }) : null;
                let districtRow = districtVisualRecipe ? districtVisualRecipe.atlasRow : 0;
                if (!districtVisualRecipe && urbanDistrict.kind === 'INDUSTRIAL') districtRow = 2;
                else if (!districtVisualRecipe && urbanDistrict.kind === 'CIVIC') districtRow = 1;
                else if (!districtVisualRecipe && urbanDistrict.kind === 'DEFENSE') districtRow = 1;
                else if (!districtVisualRecipe && urbanDistrict.kind === 'LOGISTICS') districtRow = 2;
                const districtVariant = districtVisualRecipe
                    && Number.isInteger(districtVisualRecipe.atlasCell)
                    ? districtVisualRecipe.atlasCell
                    : districtRow * 4 + Math.floor(storyHash(
                        (node.id | 0) * 37 + index * 29, districtRow * 113 + 7
                    ) * 4);
                const districtAtlasKey = districtVisualRecipe
                    && districtVisualRecipe.atlasKey || 'settlements';
                const districtWorldSize = district.sizePx
                    / Math.max(.0001, storyCam.zoom);
                if (storySettlementLandScore(raster, wx, wy,
                    districtWorldSize * .50, -districtWorldSize * .26) < 9) continue;
                storyDrawAtlasCell(ctx, districtAtlasKey, districtVariant,
                    point.x, point.y + district.sizePx * .24,
                    district.sizePx, district.sizePx, .92,
                    (storyHash(index * 31 + (node.id | 0), 557) - .5) * .12,
                    storyHash(index * 17 + (node.id | 0), 997) > .5);
                if (districtVisualRecipe && districtVisualRecipe.fireOverlay) {
                    storyDrawAtlasCell(ctx,
                        districtVisualRecipe.fireOverlayAtlasKey || 'conflictFireOverlay',
                        Number(districtVisualRecipe.fireOverlayAtlasCell) || 0,
                        point.x, point.y - district.sizePx * .02,
                        district.sizePx * 1.08, district.sizePx * 1.32, .88);
                }
            }
        } else if (district.visible && typeof storyMapRasterEnsure === 'function'
            && typeof storyMapRasterSample === 'function') {
            // Rollback fallback: HXD-6 modülü yüklenmezse eski ekran-uzayı saçılımı.
            const raster = storyMapRasterEnsure();
            const baseAngle = storyHash((node.id | 0) * 83 + 19, 761) * Math.PI * 2;
            for (let index = 0; index < district.count; index++) {
                const angle = baseAngle + index / district.count * Math.PI * 2
                    + (storyHash((node.id | 0) * 41 + index * 17, 911) - .5) * .42;
                const radialPx = district.spreadPx * (.54
                    + storyHash((node.id | 0) * 101 + index * 23, 313) * .46);
                const anchor = typeof storyHexSettlementNodePosition === 'function'
                    ? storyHexSettlementNodePosition(node, STORY_WORLD_W, STORY_WORLD_H)
                    : { x: node.lx * STORY_WORLD_W, y: node.ly * STORY_WORLD_H };
                const wx = anchor.x + Math.cos(angle) * radialPx / storyCam.zoom;
                const wy = anchor.y + Math.sin(angle) * radialPx / storyCam.zoom;
                if (!storyMapRasterSample(raster, wx / STORY_WORLD_W, wy / STORY_WORLD_H).land) continue;
                const point = storyW2S(wx, wy);
                const districtRow = level >= 3 && index % 4 === 0 ? 1 : 0;
                const districtVariant = districtRow * 4 + Math.floor(storyHash(
                    (node.id | 0) * 37 + index * 29, districtRow * 113 + 7
                ) * 4);
                storyDrawAtlasCell(ctx, 'settlements', districtVariant,
                    point.x, point.y + district.sizePx * .24,
                    district.sizePx, district.sizePx, .92,
                    (storyHash(index * 31 + (node.id | 0), 557) - .5) * .12,
                    storyHash(index * 17 + (node.id | 0), 997) > .5);
            }
        }
    }
    storyDrawAtlasCell(ctx, coreAtlasKey, variant, visualPx,
        visualPy + Math.round(size * .27), size, size, 1);
    if (coreVisualRecipe && coreVisualRecipe.fireOverlay) {
        storyDrawAtlasCell(ctx,
            coreVisualRecipe.fireOverlayAtlasKey || 'conflictFireOverlay',
            Number(coreVisualRecipe.fireOverlayAtlasCell) || 0,
            visualPx, visualPy, size * 1.08, size * 1.32, .88);
    }
    return { half: Math.max(4, Math.round(size * .31)), size,
        visualX: visualPx, visualY: visualPy };
}

function storySettlementVisualLevel(node, urbanFootprint) {
    const populationPeople = Math.max(0,
        Number(urbanFootprint && urbanFootprint.populationPeople) || 0);
    const districtCount = urbanFootprint && Array.isArray(urbanFootprint.districts)
        ? urbanFootprint.districts.length : 0;
    return urbanFootprint
        ? (populationPeople >= 60000 || districtCount >= 7 ? 3
            : populationPeople >= 25000 || districtCount >= 4 ? 2 : 1)
        : Math.max(1, Math.min(3, node.level | 0 || 1));
}

function storyDrawPhysicalConstructionSites(ctx, physicalSitesModel, mapZoomRatio) {
    if (!physicalSitesModel || !Array.isArray(physicalSitesModel.sites)
        || !storyMapAtlasReady('constructionModern') || mapZoomRatio < 2.2
        || typeof storyHexWorldEnsure !== 'function') return 0;
    const world = storyHexWorldEnsure();
    const commands = STORY.hexConstruction && Array.isArray(STORY.hexConstruction.commands)
        ? STORY.hexConstruction.commands : [];
    const commandById = new Map(commands.map(command => [String(command.id), command]));
    let drawn = 0;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const constructionSites = Array.isArray(physicalSitesModel.constructionSites)
        ? physicalSitesModel.constructionSites : physicalSitesModel.sites;
    for (const site of constructionSites) {
        if (!site || !site.sourceConstructionId) continue;
        const command = commandById.get(String(site.sourceConstructionId));
        if (!command || !['BUILDING', 'COMPLETED'].includes(command.status)) continue;
        const cellIndex = Number(site.cellIndex);
        if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= Number(world.cellCount)) continue;
        const wx = Number(world.centerX[cellIndex]) / Number(world.width) * STORY_WORLD_W;
        const wy = Number(world.centerY[cellIndex]) / Number(world.height) * STORY_WORLD_H;
        const point = storyW2S(wx, wy);
        if (point.u < -.06 || point.u > 1.06 || point.x < -120 || point.x > STORY._cw + 120
            || point.y < -120 || point.y > STORY._ch + 120) continue;
        const recipe = typeof storyVisualConstructionRecipe === 'function'
            ? storyVisualConstructionRecipe({ command, physicalSite: site, year: STORY.year }) : null;
        if (!recipe || recipe.assetMissing || !Number.isInteger(recipe.atlasCell)) continue;
        const edgeWorld = Number(world.radius) / Number(world.width) * STORY_WORLD_W;
        const edgePoint = storyW2S(wx + edgeWorld, wy);
        const hexWidthPx = Math.max(1, Math.abs(edgePoint.x - point.x) * 2);
        const size = Math.max(24, Math.min(112, Math.round(hexWidthPx * 1.72)));
        storyDrawAtlasCell(ctx, recipe.atlasKey, recipe.atlasCell,
            point.x, point.y + size * .42, size, size * .74, 1, 0, false);
        if (command.status === 'BUILDING' && mapZoomRatio >= 4.2) {
            const barW = Math.max(18, Math.round(size * .58));
            const barX = Math.round(point.x - barW / 2), barY = Math.round(point.y + size * .31);
            ctx.fillStyle = 'rgba(3,8,7,.88)'; ctx.fillRect(barX - 1, barY - 1, barW + 2, 5);
            ctx.fillStyle = '#4cff7c';
            ctx.fillRect(barX, barY, Math.round(barW * recipe.progressBps / 10000), 3);
        }
        drawn++;
    }
    ctx.restore();
    STORY._physicalConstructionRender = {
        adapterVersion: 'construction-visual-catalog-1',
        drawn,
        catalogVersion: typeof STORY_VISUAL_CATALOG_VERSION !== 'undefined'
            ? STORY_VISUAL_CATALOG_VERSION : null
    };
    return drawn;
}

function storyBuildSparseSettlementWorldLayer(mode, urbanModel, physicalSitesModel,
    worldPositions) {
    const renderScale = Math.max(1, Number(mode && mode.renderScale) || 1);
    // 512px tiles made a local 8x district view issue dozens of GPU blits and
    // made the overview traverse hundreds of sparse textures. 1024px stays
    // comfortably inside Chromium texture limits while cutting draw calls and
    // duplicate city padding by roughly four times.
    const tileSize = 1024;
    const tileNodes = new Map();
    const visualPositions = Object.create(null);
    const maxWidth = STORY_WORLD_W * renderScale;
    const maxHeight = STORY_WORLD_H * renderScale;
    const hexWorld = typeof storyHexWorldEnsure === 'function' ? storyHexWorldEnsure() : null;
    for (const node of STORY.nodes || []) {
        const anchor = typeof storyHexSettlementNodePosition === 'function'
            ? storyHexSettlementNodePosition(node, STORY_WORLD_W, STORY_WORLD_H)
            : { x: Number(node.lx) * STORY_WORLD_W, y: Number(node.ly) * STORY_WORLD_H };
        worldPositions[node.id] = { x: Number(anchor.x), y: Number(anchor.y) };
        let minX = Number(anchor.x), maxX = minX, minY = Number(anchor.y), maxY = minY;
        const footprint = urbanModel && urbanModel.records && urbanModel.records[node.id];
        if (!mode.disableDistricts && hexWorld && footprint
            && Array.isArray(footprint.districts)) {
            for (const district of footprint.districts) {
                if (!district || !district.center) continue;
                const wx = Number(district.center.x) / Number(hexWorld.width) * STORY_WORLD_W;
                const wy = Number(district.center.y) / Number(hexWorld.height) * STORY_WORLD_H;
                minX = Math.min(minX, wx); maxX = Math.max(maxX, wx);
                minY = Math.min(minY, wy); maxY = Math.max(maxY, wy);
            }
        }
        const padWorld = 34;
        const tx0 = Math.max(0, Math.floor((minX - padWorld) * renderScale / tileSize));
        const ty0 = Math.max(0, Math.floor((minY - padWorld) * renderScale / tileSize));
        const tx1 = Math.min(Math.ceil(maxWidth / tileSize) - 1,
            Math.floor((maxX + padWorld) * renderScale / tileSize));
        const ty1 = Math.min(Math.ceil(maxHeight / tileSize) - 1,
            Math.floor((maxY + padWorld) * renderScale / tileSize));
        for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
            const key = `${tx}:${ty}`;
            if (!tileNodes.has(key)) tileNodes.set(key, []);
            tileNodes.get(key).push({ node, anchor, footprint });
        }
    }
    const tiles = [];
    for (const [key, entries] of tileNodes) {
        const [gridX, gridY] = key.split(':').map(Number);
        const tx = gridX * tileSize, ty = gridY * tileSize;
        const tw = Math.min(tileSize, maxWidth - tx);
        const th = Math.min(tileSize, maxHeight - ty);
        if (!(tw > 0) || !(th > 0)) continue;
        storyCam.x = tx / renderScale; storyCam.y = ty / renderScale;
        storyCam.zoom = renderScale; STORY._cw = tw; STORY._ch = th;
        const tileCanvas = document.createElement('canvas');
        tileCanvas.width = tw; tileCanvas.height = th;
        const paint = tileCanvas.getContext('2d');
        paint.clearRect(0, 0, tw, th); paint.imageSmoothingEnabled = false;
        for (const entry of entries) {
            const result = storyDrawSettlementSprite(
                paint, entry.node, entry.anchor.x, entry.anchor.y, false, 1, {
                    actionable: true,
                    minZoom: mode.minZoom,
                    disableDistricts: !!mode.disableDistricts,
                    urbanFootprint: entry.footprint,
                    physicalSites: physicalSitesModel
                }
            );
            const anchorPx = entry.anchor.x * renderScale;
            const anchorPy = entry.anchor.y * renderScale;
            if (result && !result.hidden && anchorPx >= tx && anchorPx < tx + tw
                && anchorPy >= ty && anchorPy < ty + th) {
                visualPositions[entry.node.id] = {
                    x: (Number(result.visualX) + tx) / renderScale,
                    y: (Number(result.visualY) + ty) / renderScale
                };
            }
        }
        const tile = { x: tx, y: ty, width: tw, height: th,
            canvas: tileCanvas, bitmap: tileCanvas, bitmapFailed: false };
        tiles.push(tile);
    }
    return {
        tiles, visualPositions, worldPositions,
        cityCount: (STORY.nodes || []).length,
        worldScale: renderScale,
        sparse: true,
        estimatedBytes: tiles.reduce((sum, tile) => sum + tile.width * tile.height * 4, 0)
    };
}

function storySettlementWorldLayersEnsure(urbanModel, physicalSitesModel) {
    const visualPeriodValue = typeof storyVisualPeriodForYear === 'function'
        ? storyVisualPeriodForYear(STORY.year) : (Number(STORY.year) || 0);
    const visualPeriod = visualPeriodValue && typeof visualPeriodValue === 'object'
        ? (visualPeriodValue.id || visualPeriodValue.key
            || JSON.stringify(visualPeriodValue)) : visualPeriodValue;
    const token = [
        'settlement-world-layers-9-settlementvisualhash-tiles1024',
        storySettlementAtlasesReady() ? 'ready' : 'loading',
        urbanModel && urbanModel.footprintHash || 'no-urban',
        physicalSitesModel && (physicalSitesModel.settlementVisualHash || physicalSitesModel.visualHash || physicalSitesModel.registryHash) || 'no-sites',
        visualPeriod
    ].join('|');
    if (STORY._settlementWorldLayers
        && STORY._settlementWorldLayers.token === token) {
        STORY._settlementWorldLayers.hits++;
        return STORY._settlementWorldLayers;
    }
    if (!storySettlementAtlasesReady()) return null;

    const started = typeof performance !== 'undefined' && performance.now
        ? performance.now() : Date.now();
    const saved = {
        x: storyCam.x, y: storyCam.y, zoom: storyCam.zoom,
        cw: STORY._cw, ch: STORY._ch
    };
    const modes = [
        // CORE is used only below district LOD. A 30-world-unit capital at 2x
        // owns 60 source pixels, enough for its largest 2.2x on-screen size;
        // the 8x district layer takes over before closer inspection.
        { id: 'CORE', minZoom: 1, renderScale: 2,
            sparse: true, disableDistricts: true },
        { id: 'DISTRICTS', minZoom: .25,
            renderScale: Number(typeof STORY_MAP_RENDERER_V2 !== 'undefined'
                && STORY_MAP_RENDERER_V2.districtRasterScale) || 3,
            sparse: true }
    ];
    const layers = Object.create(null);
    const tileSize = 1024;
    const worldPositions = Object.create(null);
    try {
        storyCam.x = 0;
        storyCam.y = 0;
        for (const mode of modes) {
            if (mode.sparse) {
                layers[mode.id] = storyBuildSparseSettlementWorldLayer(
                    mode, urbanModel, physicalSitesModel, worldPositions
                );
                continue;
            }
            storyCam.zoom = mode.renderScale;
            STORY._cw = STORY_WORLD_W * mode.renderScale;
            STORY._ch = STORY_WORLD_H * mode.renderScale;
            const canvas = document.createElement('canvas');
            canvas.width = STORY_WORLD_W * mode.renderScale;
            canvas.height = STORY_WORLD_H * mode.renderScale;
            const paint = canvas.getContext('2d');
            paint.clearRect(0, 0, canvas.width, canvas.height);
            paint.imageSmoothingEnabled = false;
            const visualPositions = Object.create(null);
            let cityCount = 0;
            for (const node of STORY.nodes || []) {
                const anchor = typeof storyHexSettlementNodePosition === 'function'
                    ? storyHexSettlementNodePosition(node, STORY_WORLD_W, STORY_WORLD_H)
                    : { x: Number(node.lx) * STORY_WORLD_W, y: Number(node.ly) * STORY_WORLD_H };
                worldPositions[node.id] = { x: Number(anchor.x), y: Number(anchor.y) };
                const result = storyDrawSettlementSprite(
                    paint, node, anchor.x, anchor.y, false, 1, {
                        actionable: true,
                        minZoom: mode.minZoom,
                        urbanFootprint: urbanModel && urbanModel.records[node.id],
                        physicalSites: physicalSitesModel
                    }
                );
                if (!result || result.hidden) continue;
                visualPositions[node.id] = {
                    x: Number(result.visualX) / mode.renderScale,
                    y: Number(result.visualY) / mode.renderScale
                };
                cityCount++;
            }
            // Chromium büyük ve çoğunlukla saydam bir dünya canvas'ından her kare
            // kırpma yaparken yazılım rasterine düşebiliyor. Kompozisyon yine bir
            // kez yapılır; ardından kalıcı RAM karolarına ayrılır ve büyük geçici
            // yüzey bırakılır. Kamera yalnız görünür karoları çizer.
            const tiles = [];
            for (let ty = 0; ty < canvas.height; ty += tileSize) {
                for (let tx = 0; tx < canvas.width; tx += tileSize) {
                    const tw = Math.min(tileSize, canvas.width - tx);
                    const th = Math.min(tileSize, canvas.height - ty);
                    const tileCanvas = document.createElement('canvas');
                    tileCanvas.width = tw;
                    tileCanvas.height = th;
                    const tilePaint = tileCanvas.getContext('2d');
                    tilePaint.imageSmoothingEnabled = false;
                    tilePaint.drawImage(canvas, tx, ty, tw, th, 0, 0, tw, th);
                    const tile = { x: tx, y: ty, width: tw, height: th,
                        canvas: tileCanvas, bitmap: null, bitmapFailed: false };
                    tiles.push(tile);
                    if (typeof createImageBitmap === 'function') {
                        createImageBitmap(tileCanvas).then(bitmap => {
                            tile.bitmap = bitmap;
                            tile.canvas.width = 1;
                            tile.canvas.height = 1;
                        }).catch(() => {
                            tile.bitmapFailed = true;
                        });
                    }
                }
            }
            canvas.width = 1;
            canvas.height = 1;
            layers[mode.id] = { tiles, visualPositions, worldPositions, cityCount,
                worldScale: mode.renderScale,
                estimatedBytes: STORY_WORLD_W * STORY_WORLD_H * 4
                    * mode.renderScale * mode.renderScale };
        }
    } finally {
        storyCam.x = saved.x;
        storyCam.y = saved.y;
        storyCam.zoom = saved.zoom;
        STORY._cw = saved.cw;
        STORY._ch = saved.ch;
    }
    const finished = typeof performance !== 'undefined' && performance.now
        ? performance.now() : Date.now();
    STORY._settlementWorldLayerBuildSerial =
        (Number(STORY._settlementWorldLayerBuildSerial) || 0) + 1;
    const previous = STORY._settlementWorldLayers;
    if (previous && previous.layers) {
        for (const layer of Object.values(previous.layers)) storyReleaseWorldRamLayer(layer);
    }
    STORY._settlementWorldLayers = {
        token,
        layers,
        builds: 1,
        hits: 0,
        buildMs: finished - started,
        estimatedBytes: Object.values(layers).reduce((sum, layer) =>
            sum + Number(layer.estimatedBytes || 0), 0),
        buildSerial: STORY._settlementWorldLayerBuildSerial
    };
    return STORY._settlementWorldLayers;
}

function storyDrawSettlementWorldLayer(ctx, worldLayers, mapZoomRatio) {
    if (!worldLayers || !worldLayers.layers) return null;
    const mode = Number(mapZoomRatio) >= 3.4 ? 'DISTRICTS' : 'CORE';
    const layer = worldLayers.layers[mode];
    if (!layer || !Array.isArray(layer.tiles)) return null;
    const drawnTileCount = storyDrawWorldRamLayer(ctx, layer);
    return {
        mode,
        layer,
        drawnTileCount,
        bitmapReadyCount: layer.tiles.reduce((count, tile) =>
            count + (tile.bitmap ? 1 : 0), 0)
    };
}

function storyCoastalNetworkEnsure() {
    if (!STORY._landGrid || !STORY.nodes) return { ports: [], links: [] };
    if (typeof storyHexSettlementsEnsure === 'function') {
        const settlements = storyHexSettlementsEnsure();
        const hexWorld = storyHexWorldEnsure();
        const physical = typeof storyHexInfrastructureSegmentsEnsure === 'function'
            ? storyHexInfrastructureSegmentsEnsure() : null;
        const cachedHex = STORY._coastalNetwork;
        if (cachedHex && cachedHex.settlementHash === settlements.settlementHash
            && cachedHex.physicalHash === (physical && physical.topologyHash || null)) return cachedHex;
        const coastRaster = typeof storyMapRasterEnsure === 'function'
            ? storyMapRasterEnsure() : null;
        const ports = settlements.records.filter(record => record.port).map(record => {
            const land = record.port.land && record.port.land.center || {};
            const water = record.port.water && record.port.water.center || {};
            const landX = Number(land.x), landY = Number(land.y);
            const waterX = Number(water.x), waterY = Number(water.y);
            // The terminal building belongs to the coast edge, not to the
            // centre of the navigable water hex. Keep a slight land bias so
            // the quay visibly touches the shore while its waterside faces
            // the canonical adjacent water cell.
            const coastDx = waterX - landX, coastDy = waterY - landY;
            let coastT = .38;
            if (coastRaster) {
                const isLand = typeof storyMapRasterIsLand === 'function'
                    ? storyMapRasterIsLand
                    : (r, nx, ny) => (typeof storyMapRasterSample === 'function' ? storyMapRasterSample(r, nx, ny).land : true);
                let lo = 0, hi = 1;
                for (let step = 0; step < 10; step++) {
                    const mid = (lo + hi) * .5;
                    const wx = (landX + coastDx * mid) / Number(hexWorld.width);
                    const wy = (landY + coastDy * mid) / Number(hexWorld.height);
                    if (isLand(coastRaster, wx, wy)) lo = mid;
                    else hi = mid;
                }
                coastT = Math.max(.08, Math.min(.92, lo - .035));
            }
            coastT = typeof storyMapV2CoastalAnchorRatio === 'function'
                ? storyMapV2CoastalAnchorRatio(coastT)
                : Math.max(.06, Math.min(.48, coastT * .46));
            const anchorX = landX + coastDx * coastT;
            const anchorY = landY + coastDy * coastT;
            return {
                node: STORY.nodes[record.cityId],
                terminalId: record.port.terminalId,
                lx: anchorX / Number(hexWorld.width),
                ly: anchorY / Number(hexWorld.height),
                waterLx: waterX / Number(hexWorld.width),
                waterLy: waterY / Number(hexWorld.height),
                coastAngle: Math.atan2(waterY - landY, waterX - landX)
            };
        }).filter(port => !!port.node);
        const byName = new Map(ports.map(port => [String(port.node.name), port]));
        const links = [];
        const seen = new Set();
        for (const pair of (typeof STORY_INFRASTRUCTURE_SEA_LINKS !== 'undefined'
            ? STORY_INFRASTRUCTURE_SEA_LINKS : [])) {
            const a = byName.get(String(pair && pair[0]));
            const b = byName.get(String(pair && pair[1]));
            if (!a || !b) continue;
            const key = a.node.id < b.node.id
                ? `${a.node.id}:${b.node.id}` : `${b.node.id}:${a.node.id}`;
            if (!seen.has(key)) {
                seen.add(key);
                const corridorId = `corridor:sea:${key}`;
                const cellPath = physical && physical.corridorCellPaths
                    && physical.corridorCellPaths[corridorId] || [];
                const route = cellPath.map(cellIndex => ({
                    cellIndex: Number(cellIndex),
                    lx: Number(hexWorld.centerX[cellIndex]) / Number(hexWorld.width),
                    ly: Number(hexWorld.centerY[cellIndex]) / Number(hexWorld.height)
                }));
                links.push({ a, b, key, corridorId, route });
            }
        }
        STORY._coastalNetwork = {
            settlementHash: settlements.settlementHash,
            physicalHash: physical && physical.topologyHash || null,
            nodeCount: STORY.nodes.length,
            ports,
            links
        };
        return STORY._coastalNetwork;
    }
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

function storyDrawPortTerminals(ctx, ports) {
    if (!storyMapAtlasReady('modernPorts')) return 0;
    let drawn = 0;
    for (const port of ports || []) {
        const placement = typeof storyVisualPlacementDecision === 'function'
            ? storyVisualPlacementDecision({
                atlasKey: 'modernPorts',
                hexDomain: 'COAST',
                landCoverageBps: 6000,
                port: true,
                node: port.node
            }) : null;
        if (placement && !placement.ok) continue;
        const p = storyW2S(port.lx * STORY_WORLD_W, port.ly * STORY_WORLD_H);
        if (p.u < -.04 || p.u > 1.05) continue;
        const level = Math.max(2, port.node.level | 0);
        const metrics = typeof storyMapV2PortMetrics === 'function'
            ? storyMapV2PortMetrics(level, { cam: storyCam })
            : { size: (level >= 3 ? 10 : 8) * storyCam.zoom };
        const size = Math.max(1, (Number(metrics.size) || 1) * 1.48);
        const variant = Math.floor(storyHash(port.node.id * 23 + 7, 601) * 16) % 16;
        // Raster limanlar döndürülmez. Canvas rotasyonu piksel atlasını yeniden
        // örnekleyip bulanık/dişli gösteriyordu. Kıyı doğruluğu port hücresinin
        // fiziksel konumundan gelir; yönlü atlas ileride ayrı hücrelerle çözülür.
        storyDrawAtlasCell(ctx, 'modernPorts', variant, p.x, p.y + size * .48,
            size, size, .98, 0, false);
        drawn++;
    }
    return drawn;
}

function storyDrawMaritimeOverlay(ctx, farMap, includePorts) {
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
        const route = (link.route || []).map(point =>
            storyW2S(point.lx * STORY_WORLD_W, point.ly * STORY_WORLD_H));
        if (route.length >= 2) {
            if (typeof storyMapV2TraceRoundedPath === 'function') {
                storyMapV2TraceRoundedPath(ctx, route);
            } else {
                ctx.beginPath(); ctx.moveTo(route[0].x, route[0].y);
                for (let index = 1; index < route.length; index++) {
                    ctx.lineTo(route[index].x, route[index].y);
                }
            }
        } else {
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            const dx = b.x - a.x, dy = b.y - a.y;
            const len = Math.max(1, Math.hypot(dx, dy));
            const bend = Math.min(22, len * .10)
                * (storyHash(link.a.node.id + 91, link.b.node.id + 37) > .5 ? 1 : -1);
            ctx.beginPath(); ctx.moveTo(a.x, a.y);
            ctx.quadraticCurveTo(mx - dy / len * bend, my + dx / len * bend, b.x, b.y);
        }
        ctx.stroke();
    }
    ctx.setLineDash([]);
    if (includePorts !== false) storyDrawPortTerminals(ctx, network.ports);
    ctx.restore();
}

function storyDrawPhysicalLandOverlay(ctx, farMap) {
    if (typeof storyHexInfrastructureSegmentsEnsure !== 'function'
        || typeof storyHexInfrastructureSegmentFactorBps !== 'function'
        || typeof storyHexWorldEnsure !== 'function') return 0;
    const registry = STORY.hexInfrastructureSegments
        || storyHexInfrastructureSegmentsEnsure();
    const world = storyHexWorldEnsure();
    if (!registry || !world) return 0;
    const roads = registry._landRoads || (registry._landRoads = registry.segments.filter(segment => segment.mode === 'LAND'));
    const coords = registry._landRoadCoords || (registry._landRoadCoords = roads.map(segment => ({
        xa: Number(world.centerX[segment.endpointCellIndices[0]]),
        ya: Number(world.centerY[segment.endpointCellIndices[0]]),
        xb: Number(world.centerX[segment.endpointCellIndices[1]]),
        yb: Number(world.centerY[segment.endpointCellIndices[1]])
    })));
    const ptsA = new Array(coords.length);
    const ptsB = new Array(coords.length);
    for (let i = 0; i < coords.length; i++) {
        const c = coords[i];
        ptsA[i] = storyW2S(c.xa, c.ya);
        ptsB[i] = storyW2S(c.xb, c.yb);
    }
    const drawPass = (width, color) => {
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.beginPath();
        for (let i = 0; i < ptsA.length; i++) {
            ctx.moveTo(ptsA[i].x, ptsA[i].y);
            ctx.lineTo(ptsB[i].x, ptsB[i].y);
        }
        ctx.stroke();
    };
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // Roads describe connectivity without becoming the darkest object on the
    // terrain. Thin earth/aggregate passes preserve the canonical hex edge
    // route while avoiding the heavy black polygon look at junctions.
    drawPass(farMap ? 1.05 : 1.65, farMap
        ? 'rgba(54,47,38,.48)' : 'rgba(48,43,36,.58)');
    drawPass(farMap ? .42 : .68, farMap
        ? 'rgba(194,174,132,.58)' : 'rgba(174,155,119,.66)');
    const damageRev = (STORY.infrastructureDamage && STORY.infrastructureDamage.revision) || 0;
    if (registry._damagedLandRoadsRev !== damageRev || !registry._damagedLandRoads) {
        registry._damagedLandRoads = roads.filter(segment => storyHexInfrastructureSegmentFactorBps(segment) < 10000);
        registry._damagedLandRoadsRev = damageRev;
    }
    const damagedRoads = registry._damagedLandRoads;
    if (damagedRoads && damagedRoads.length > 0) {
        for (let i = 0; i < damagedRoads.length; i++) {
            const segment = damagedRoads[i];
            const factor = storyHexInfrastructureSegmentFactorBps(segment);
            if (factor >= 10000) continue;
            const a = Number(segment.endpointCellIndices[0]);
            const b = Number(segment.endpointCellIndices[1]);
            const pa = storyW2S(Number(world.centerX[a]), Number(world.centerY[a]));
            const pb = storyW2S(Number(world.centerX[b]), Number(world.centerY[b]));
            ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
            ctx.strokeStyle = factor <= 0 ? 'rgba(118,22,18,.96)'
                : factor < 5000 ? 'rgba(211,74,28,.92)' : 'rgba(229,151,42,.84)';
            ctx.lineWidth = farMap ? 1.5 : 2.5;
            if (factor <= 0 && typeof ctx.setLineDash === 'function') ctx.setLineDash([3, 2]);
            ctx.stroke();
            if (typeof ctx.setLineDash === 'function') ctx.setLineDash([]);
        }
    }
    ctx.restore();
    return roads.length;
}

function storyMapStructurePickRegistryRefresh(urbanModel, physicalSitesModel, mapZoomRatio) {
    const targets = [];
    if (!urbanModel || !Array.isArray(urbanModel.records)
        || typeof storyHexWorldEnsure !== 'function') {
        STORY._mapStructurePickTargets = targets;
        return targets;
    }
    const world = storyHexWorldEnsure();
    const siteIdsByCellId = physicalSitesModel && physicalSitesModel.siteIdsByCellId || {};
    const siteById = physicalSitesModel && physicalSitesModel.siteById || {};
    const visible = (point, radius) => point && point.u > -.08 && point.u < 1.08
        && point.x > -radius && point.x < STORY._cw + radius
        && point.y > -radius && point.y < STORY._ch + radius;
    for (const record of urbanModel.records) {
        if (!record || !Array.isArray(record.districts)) continue;
        const node = STORY.nodes && STORY.nodes[record.cityId];
        if (!node) continue;
        const visualLevel = storySettlementVisualLevel(node, record);
        const districtMetrics = typeof storyMapV2SettlementDistrictMetrics === 'function'
            ? storyMapV2SettlementDistrictMetrics(node, {
                cam: storyCam,
                minZoom: STORY._minZoom || storyMinZoom(STORY._cw || 800, STORY._ch || 600),
                visualLevel
            }) : { visible: mapZoomRatio >= 2.2, sizePx: 28 };
        if (districtMetrics.visible) {
            for (let index = 1; index < record.districts.length; index++) {
                const district = record.districts[index];
                if (!district || !district.center) continue;
                const wx = Number(district.center.x) / Number(world.width) * STORY_WORLD_W;
                const wy = Number(district.center.y) / Number(world.height) * STORY_WORLD_H;
                const point = storyW2S(wx, wy);
                const size = Math.max(18, Number(districtMetrics.sizePx) || 28);
                if (!visible(point, size)) continue;
                const siteId = (siteIdsByCellId[String(district.id)] || [])[0] || null;
                const site = siteId ? siteById[siteId] : null;
                targets.push({
                    id: siteId || `district:${district.id}`,
                    kind: site ? 'SITE' : 'DISTRICT',
                    siteId,
                    districtId: district.id,
                    cellId: district.id,
                    cellIndex: Number(district.index),
                    nodeId: Number(record.cityId),
                    regionId: `region:${record.cityId}`,
                    label: site && (site.sectorId || site.siteType) || district.kind || 'DISTRICT',
                    x: point.x,
                    y: point.y + size * .12,
                    radiusX: Math.max(11, size * .48),
                    radiusY: Math.max(11, size * .42)
                });
            }
        }
    }
    const constructionSites = physicalSitesModel && Array.isArray(physicalSitesModel.constructionSites)
        ? physicalSitesModel.constructionSites : [];
    for (const site of constructionSites) {
        const cellIndex = Number(site && site.cellIndex);
        if (!site || !Number.isInteger(cellIndex) || cellIndex < 0
            || cellIndex >= Number(world.cellCount)) continue;
        const wx = Number(world.centerX[cellIndex]) / Number(world.width) * STORY_WORLD_W;
        const wy = Number(world.centerY[cellIndex]) / Number(world.height) * STORY_WORLD_H;
        const point = storyW2S(wx, wy);
        const edgeWorld = Number(world.radius) / Number(world.width) * STORY_WORLD_W;
        const edgePoint = storyW2S(wx + edgeWorld, wy);
        const size = Math.max(24, Math.min(112,
            Math.round(Math.abs(edgePoint.x - point.x) * 2 * 1.72)));
        if (!visible(point, size)) continue;
        targets.push({
            id: site.id,
            kind: 'SITE',
            siteId: site.id,
            cellId: site.cellId,
            cellIndex,
            nodeId: Number(site.cityId),
            regionId: site.regionId,
            label: site.siteType || 'CONSTRUCTION',
            x: point.x,
            y: point.y + size * .18,
            radiusX: Math.max(12, size * .46),
            radiusY: Math.max(12, size * .38)
        });
    }
    STORY._mapStructurePickTargets = targets;
    STORY._mapStructurePickDiagnostics = {
        adapterVersion: 'visible-structure-picks-1',
        targetCount: targets.length,
        siteCount: targets.filter(row => row.kind === 'SITE').length,
        districtCount: targets.filter(row => row.kind === 'DISTRICT').length
    };
    return targets;
}

function storyDrawPhysicalRailOverlay(ctx, farMap) {
    if (typeof storyHexInfrastructureSegmentsEnsure !== 'function'
        || typeof storyHexInfrastructureSegmentFactorBps !== 'function'
        || typeof storyHexWorldEnsure !== 'function') return 0;
    const registry = STORY.hexInfrastructureSegments
        || storyHexInfrastructureSegmentsEnsure();
    const world = storyHexWorldEnsure();
    if (!registry || !world) return 0;
    const rails = registry._railSegments || (registry._railSegments = registry.segments.filter(segment => segment.mode === 'RAIL'));
    const coords = registry._railCoords || (registry._railCoords = rails.map(segment => ({
        xa: Number(world.centerX[segment.endpointCellIndices[0]]),
        ya: Number(world.centerY[segment.endpointCellIndices[0]]),
        xb: Number(world.centerX[segment.endpointCellIndices[1]]),
        yb: Number(world.centerY[segment.endpointCellIndices[1]])
    })));
    const ptsA = new Array(coords.length);
    const ptsB = new Array(coords.length);
    for (let i = 0; i < coords.length; i++) {
        const c = coords[i];
        ptsA[i] = storyW2S(c.xa, c.ya);
        ptsB[i] = storyW2S(c.xb, c.yb);
    }
    const drawPass = (width, color, dash) => {
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        if (typeof ctx.setLineDash === 'function') ctx.setLineDash(dash || []);
        ctx.beginPath();
        for (let i = 0; i < ptsA.length; i++) {
            ctx.moveTo(ptsA[i].x, ptsA[i].y);
            ctx.lineTo(ptsB[i].x, ptsB[i].y);
        }
        ctx.stroke();
    };
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    drawPass(farMap ? .95 : 1.45, 'rgba(36,40,37,.62)', []);
    drawPass(farMap ? .38 : .58, 'rgba(218,202,150,.72)', farMap ? [2, 2] : [3, 3]);
    if (typeof ctx.setLineDash === 'function') ctx.setLineDash([]);
    const damageRev = (STORY.infrastructureDamage && STORY.infrastructureDamage.revision) || 0;
    if (registry._damagedRailSegmentsRev !== damageRev || !registry._damagedRailSegments) {
        registry._damagedRailSegments = rails.filter(segment => storyHexInfrastructureSegmentFactorBps(segment) < 10000);
        registry._damagedRailSegmentsRev = damageRev;
    }
    const damagedRails = registry._damagedRailSegments;
    if (damagedRails && damagedRails.length > 0) {
        for (let i = 0; i < damagedRails.length; i++) {
            const segment = damagedRails[i];
            const factor = storyHexInfrastructureSegmentFactorBps(segment);
            if (factor >= 10000) continue;
            const a = Number(segment.endpointCellIndices[0]);
            const b = Number(segment.endpointCellIndices[1]);
            const pa = storyW2S(Number(world.centerX[a]), Number(world.centerY[a]));
            const pb = storyW2S(Number(world.centerX[b]), Number(world.centerY[b]));
            ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
            ctx.strokeStyle = factor <= 0 ? 'rgba(142,28,22,.98)'
                : factor < 5000 ? 'rgba(224,83,27,.95)' : 'rgba(234,164,50,.9)';
            ctx.lineWidth = farMap ? 1.4 : 2.1;
            if (factor <= 0 && typeof ctx.setLineDash === 'function') ctx.setLineDash([3, 2]);
            ctx.stroke();
            if (typeof ctx.setLineDash === 'function') ctx.setLineDash([]);
        }
    }
    ctx.restore();
    return rails.length;
}

function storyDrawInfrastructureRouteConstructionOverlay(ctx, farMap) {
    const ledger = STORY.infrastructureWorks;
    const world = typeof storyHexWorldEnsure === 'function' ? storyHexWorldEnsure() : null;
    const commands = ledger && Array.isArray(ledger.routeCommands)
        ? ledger.routeCommands.filter(command => command.status === 'IN_PROGRESS') : [];
    if (!world || !commands.length) return 0;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const command of commands) {
        const path = command.pathCellIndices || [];
        if (path.length < 2) continue;
        ctx.beginPath();
        path.forEach((cellIndex, index) => {
            const point = storyW2S(Number(world.centerX[cellIndex]), Number(world.centerY[cellIndex]));
            if (!index) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
        });
        ctx.strokeStyle = command.mode === 'RAIL' ? 'rgba(255,184,55,.94)'
            : command.mode === 'SEA' ? 'rgba(72,205,231,.94)' : 'rgba(238,138,42,.9)';
        ctx.lineWidth = farMap ? 2 : 3.5;
        if (typeof ctx.setLineDash === 'function') ctx.setLineDash(farMap ? [3, 3] : [7, 4]);
        ctx.stroke();
    }
    if (typeof ctx.setLineDash === 'function') ctx.setLineDash([]);
    ctx.restore();
    return commands.length;
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
            seen.add(key); links.push({ a, b: p.b, key, aId: i, bId: p.j });
        }
    }
    STORY._secondaryRoads = { cityCount: CT.length, grid: STORY._landGrid, links };
    return links;
}

function storyTraceHexRoad(ctx, cityAId, cityBId) {
    if (typeof storyHexRoadPath !== 'function') return null;
    const cells = storyHexRoadPath(cityAId, cityBId);
    if (!cells || cells.length < 2) return null;
    const points = cells.map(cell => Object.assign(storyW2S(cell.x, cell.y), {
        cellIndex: Number(cell.cellIndex)
    }));
    if (typeof storyMapV2TraceRoundedPath === 'function') {
        storyMapV2TraceRoundedPath(ctx, points);
    } else {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let index = 1; index < points.length; index++) {
            ctx.lineTo(points[index].x, points[index].y);
        }
    }
    return points;
}

function storyDrawPhysicalRoadCondition(ctx, route, farMap) {
    if (!route || route.length < 2
        || typeof storyHexInfrastructureSegmentsEnsure !== 'function'
        || typeof storyHexInfrastructureEdgeId !== 'function'
        || typeof storyHexInfrastructureSegmentFactorBps !== 'function') return 0;
    const registry = STORY.hexInfrastructureSegments
        || storyHexInfrastructureSegmentsEnsure();
    if (!registry) return 0;
    let drawn = 0;
    for (let index = 1; index < route.length; index++) {
        const a = route[index - 1], b = route[index];
        const segment = registry.segmentById[
            storyHexInfrastructureEdgeId(a.cellIndex, b.cellIndex)
        ];
        if (!segment) continue;
        const factor = storyHexInfrastructureSegmentFactorBps(segment);
        if (factor >= 10000) continue;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = factor <= 0 ? 'rgba(118,22,18,.96)'
            : factor < 5000 ? 'rgba(211,74,28,.92)' : 'rgba(229,151,42,.84)';
        ctx.lineWidth = farMap ? 1.5 : 2.5;
        if (factor <= 0 && typeof ctx.setLineDash === 'function') ctx.setLineDash([3, 2]);
        ctx.stroke();
        if (typeof ctx.setLineDash === 'function') ctx.setLineDash([]);
        drawn++;
    }
    return drawn;
}

function storyDrawPrimaryRoadOverlay(ctx, farMap) {
    if (typeof storyMapV2Enabled !== 'function' || !storyMapV2Enabled()) return;
    const CT = (typeof GEO_CITIES !== 'undefined') ? GEO_CITIES : [];
    const RD = (typeof GEO_ROADS !== 'undefined') ? GEO_ROADS : [];
    const ratio = typeof storyMapV2ZoomRatio === 'function'
        ? storyMapV2ZoomRatio(storyCam, STORY._minZoom || storyCam.zoom) : 1;
    const localFade = farMap ? 1 : Math.max(.48, 1 - Math.max(0, ratio - 3) * .045);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < RD.length; i++) {
        const edge = RD[i], from = CT[edge[0]], to = CT[edge[1]];
        if (!from || !to) continue;
        const fromPosition = typeof storyHexSettlementNodePosition === 'function' && STORY.nodes[edge[0]]
            ? storyHexSettlementNodePosition(STORY.nodes[edge[0]], STORY_WORLD_W, STORY_WORLD_H)
            : { x: from.x / GEO.W * STORY_WORLD_W, y: from.y / GEO.H * STORY_WORLD_H };
        const toPosition = typeof storyHexSettlementNodePosition === 'function' && STORY.nodes[edge[1]]
            ? storyHexSettlementNodePosition(STORY.nodes[edge[1]], STORY_WORLD_W, STORY_WORLD_H)
            : { x: to.x / GEO.W * STORY_WORLD_W, y: to.y / GEO.H * STORY_WORLD_H };
        const a = storyW2S(fromPosition.x, fromPosition.y);
        const b = storyW2S(toPosition.x, toPosition.y);
        if ((a.x < -80 && b.x < -80) || (a.x > STORY._cw + 80 && b.x > STORY._cw + 80)
            || (a.y < -80 && b.y < -80) || (a.y > STORY._ch + 80 && b.y > STORY._ch + 80)) continue;
        const route = storyTraceHexRoad(ctx, edge[0], edge[1]);
        if (!route) continue;
        ctx.strokeStyle = farMap ? 'rgba(44,35,27,.64)' : `rgba(31,27,23,${(.69 * localFade).toFixed(3)})`;
        ctx.lineWidth = farMap ? 1.7 : Math.min(2.55, 2.05 + ratio * .04); ctx.stroke();
        ctx.strokeStyle = farMap ? 'rgba(177,157,116,.64)' : `rgba(126,115,91,${(.72 * localFade).toFixed(3)})`;
        ctx.lineWidth = farMap ? .74 : Math.min(1.18, .88 + ratio * .018); ctx.stroke();
        storyDrawPhysicalRoadCondition(ctx, route, farMap);
    }
    ctx.restore();
}

function storyDrawSecondaryRoadOverlay(ctx, farMap) {
    const links = storySecondaryRoadsEnsure();
    const ratio = typeof storyMapV2ZoomRatio === 'function'
        ? storyMapV2ZoomRatio(storyCam, STORY._minZoom || storyCam.zoom) : 1;
    const localFade = farMap ? 1 : Math.max(.42, 1 - Math.max(0, ratio - 3) * .055);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const fromPosition = typeof storyHexSettlementNodePosition === 'function' && STORY.nodes[link.aId]
            ? storyHexSettlementNodePosition(STORY.nodes[link.aId], STORY_WORLD_W, STORY_WORLD_H)
            : { x: link.a.x / GEO.W * STORY_WORLD_W, y: link.a.y / GEO.H * STORY_WORLD_H };
        const toPosition = typeof storyHexSettlementNodePosition === 'function' && STORY.nodes[link.bId]
            ? storyHexSettlementNodePosition(STORY.nodes[link.bId], STORY_WORLD_W, STORY_WORLD_H)
            : { x: link.b.x / GEO.W * STORY_WORLD_W, y: link.b.y / GEO.H * STORY_WORLD_H };
        const a = storyW2S(fromPosition.x, fromPosition.y);
        const b = storyW2S(toPosition.x, toPosition.y);
        if (a.u < -.06 || a.u > 1.06 || b.u < -.06 || b.u > 1.06) continue;
        const route = storyTraceHexRoad(ctx, link.aId, link.bId);
        if (!route) continue;
        ctx.strokeStyle = farMap ? 'rgba(42,34,27,.38)' : `rgba(36,31,26,${(.51 * localFade).toFixed(3)})`;
        ctx.lineWidth = farMap ? 1.25 : 1.85; ctx.stroke();
        ctx.strokeStyle = farMap ? 'rgba(161,145,112,.42)' : `rgba(137,124,99,${(.50 * localFade).toFixed(3)})`;
        ctx.lineWidth = farMap ? .54 : .82; ctx.stroke();
    }
    ctx.restore();
}

function storyNetworkLayerKey(farMap) {
    const atlasState = ['maritime', 'settlements'].map(key => (
        typeof storyMapAtlasReady === 'function' && storyMapAtlasReady(key) ? 1 : 0
    )).join('');
    const nodeState = (STORY.nodes || []).map(node => (
        `${Number(node.level) || 0}:${Number(node.fac) || 0}`
    )).join(',');
    const settlements = typeof storyHexSettlementsEnsure === 'function'
        ? storyHexSettlementsEnsure() : null;
    const roadRegistry = typeof storyHexRoadRegistryEnsure === 'function'
        ? storyHexRoadRegistryEnsure() : null;
    const physicalSegments = typeof storyHexInfrastructureSegmentsEnsure === 'function'
        ? storyHexInfrastructureSegmentsEnsure() : null;
    return [
        'network-world-layers-4-canonical-segments',
        STORY_WORLD_W, STORY_WORLD_H,
        atlasState, nodeState,
        settlements && settlements.settlementHash || '-',
        roadRegistry && roadRegistry.key || '-',
        physicalSegments && physicalSegments.topologyHash || '-',
        physicalSegments && physicalSegments.revision || 0,
        STORY.infrastructureWorks && STORY.infrastructureWorks.revision || 0,
        typeof GEO_ROADS !== 'undefined' ? GEO_ROADS.length : 0,
        typeof STORY_INFRASTRUCTURE_SEA_LINKS !== 'undefined'
            ? STORY_INFRASTRUCTURE_SEA_LINKS.length : 0
    ].join('|');
}

function storyScreenLayerViewSnapshot() {
    return {
        x: Number(storyCam.x) || 0,
        y: Number(storyCam.y) || 0,
        zoom: Math.max(.0001, Number(storyCam.zoom) || 1)
    };
}

function storyDrawScreenLayerForCamera(ctx, canvas, view) {
    if (!canvas) return;
    if (!view) {
        ctx.drawImage(canvas, 0, 0);
        return;
    }
    // Camera changes transform an existing semantic-band cache. Exact x/y/zoom
    // values are no longer cache invalidators, so ending a wheel gesture does
    // not rebuild every road, port, city and label from zero.
    const currentZoom = Math.max(.0001, Number(storyCam.zoom) || 1);
    const scale = currentZoom / Math.max(.0001, Number(view.zoom) || 1);
    const dx = (Number(view.x) - Number(storyCam.x)) * currentZoom;
    const dy = (Number(view.y) - Number(storyCam.y)) * currentZoom;
    if (Math.abs(scale - 1) < .000001 && Math.abs(dx) < .01 && Math.abs(dy) < .01) {
        ctx.drawImage(canvas, 0, 0);
        return;
    }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, dx, dy, canvas.width * scale, canvas.height * scale);
    ctx.restore();
}

function storyReleaseWorldRamLayer(layer) {
    if (!layer || !Array.isArray(layer.tiles)) return;
    if (layer._viewCacheCanvas) {
        layer._viewCacheCanvas.width = 1;
        layer._viewCacheCanvas.height = 1;
        layer._viewCacheCanvas = null;
        layer._viewCacheKey = null;
    }
    if (layer.interactionBitmap && typeof layer.interactionBitmap.close === 'function') {
        try { layer.interactionBitmap.close(); } catch (_error) { /* best effort */ }
        layer.interactionBitmap = null;
    }
    for (const tile of layer.tiles) {
        if (tile && tile.bitmap && typeof tile.bitmap.close === 'function') {
            try { tile.bitmap.close(); } catch (_error) { /* best effort */ }
        }
        if (tile && tile.canvas) {
            tile.canvas.width = 1;
            tile.canvas.height = 1;
        }
    }
}

function storyCreateWorldRamLayer(canvas, metadata) {
    if (!canvas) return null;
    const worldScale = Math.max(.1, Math.min(1,
        Number(metadata && metadata.worldScale) || 1));
    if (worldScale < .999) {
        const reduced = document.createElement('canvas');
        reduced.width = Math.max(1, Math.round(canvas.width * worldScale));
        reduced.height = Math.max(1, Math.round(canvas.height * worldScale));
        const reducedPaint = reduced.getContext('2d');
        reducedPaint.imageSmoothingEnabled = true;
        reducedPaint.imageSmoothingQuality = 'high';
        reducedPaint.drawImage(canvas, 0, 0, canvas.width, canvas.height,
            0, 0, reduced.width, reduced.height);
        canvas.width = 1;
        canvas.height = 1;
        canvas = reduced;
    }
    const tileSize = 1024;
    const width = Number(canvas.width) || 0;
    const height = Number(canvas.height) || 0;
    let interactionBitmapPromise = null;
    const interactionScale = .5;
    if (typeof createImageBitmap === 'function' && width > 1 && height > 1) {
        const interactionCanvas = document.createElement('canvas');
        interactionCanvas.width = Math.max(1, Math.round(width * interactionScale));
        interactionCanvas.height = Math.max(1, Math.round(height * interactionScale));
        const interactionPaint = interactionCanvas.getContext('2d');
        interactionPaint.imageSmoothingEnabled = true;
        interactionPaint.imageSmoothingQuality = 'high';
        interactionPaint.drawImage(canvas, 0, 0, width, height,
            0, 0, interactionCanvas.width, interactionCanvas.height);
        interactionBitmapPromise = createImageBitmap(interactionCanvas).then(bitmap => {
            interactionCanvas.width = 1; interactionCanvas.height = 1;
            return bitmap;
        }).catch(() => null);
    }
    const tiles = [];
    for (let ty = 0; ty < height; ty += tileSize) {
        for (let tx = 0; tx < width; tx += tileSize) {
            const tw = Math.min(tileSize, width - tx);
            const th = Math.min(tileSize, height - ty);
            const tileCanvas = document.createElement('canvas');
            tileCanvas.width = tw;
            tileCanvas.height = th;
            const paint = tileCanvas.getContext('2d');
            paint.imageSmoothingEnabled = false;
            paint.drawImage(canvas, tx, ty, tw, th, 0, 0, tw, th);
            const tile = { x: tx, y: ty, width: tw, height: th,
                canvas: tileCanvas, bitmap: tileCanvas, bitmapFailed: false };
            tiles.push(tile);
        }
    }
    canvas.width = 1;
    canvas.height = 1;
    const layer = Object.assign({
        tiles,
        interactionBitmap: null,
        interactionScale,
        width,
        height,
        tileSize,
        estimatedBytes: width * height * 4
    }, metadata || {});
    if (interactionBitmapPromise) interactionBitmapPromise.then(bitmap => {
        if (bitmap) layer.interactionBitmap = bitmap;
    });
    return layer;
}

function storyDrawWorldRamLayer(ctx, layer) {
    if (!ctx || !layer || !Array.isArray(layer.tiles)) return 0;
    const zoom = Math.max(.0001, Number(storyCam.zoom) || 1);
    const worldScale = Math.max(.1, Number(layer.worldScale) || 1);
    // Re-cropping every persistent tile at 60 Hz is pure duplicate work while
    // the camera is unchanged. Cache one exact viewport composite. Interactive
    // drag deliberately bypasses it and keeps drawing canonical RAM tiles, so
    // newly exposed roads and cities remain visible before mouse release.
    const canCacheView = !STORY._mapInteracting
        && Number(STORY._cw) > 0 && Number(STORY._ch) > 0;
    const viewCacheKey = canCacheView ? [
        Number(STORY._cw), Number(STORY._ch),
        Number(storyCam.x).toFixed(5), Number(storyCam.y).toFixed(5),
        zoom.toFixed(6), worldScale
    ].join('|') : null;
    if (canCacheView && layer._viewCacheCanvas
        && layer._viewCacheKey === viewCacheKey) {
        ctx.drawImage(layer._viewCacheCanvas, 0, 0);
        layer._viewCacheHits = (Number(layer._viewCacheHits) || 0) + 1;
        return Number(layer._viewCacheDrawnTiles) || 0;
    }
    let drawCtx = ctx;
    if (canCacheView) {
        let cacheCanvas = layer._viewCacheCanvas;
        if (!cacheCanvas || cacheCanvas.width !== Number(STORY._cw)
            || cacheCanvas.height !== Number(STORY._ch)) {
            cacheCanvas = document.createElement('canvas');
            cacheCanvas.width = Number(STORY._cw);
            cacheCanvas.height = Number(STORY._ch);
            layer._viewCacheCanvas = cacheCanvas;
        }
        drawCtx = cacheCanvas.getContext('2d');
        drawCtx.clearRect(0, 0, cacheCanvas.width, cacheCanvas.height);
    }
    const viewWorldLeft = Number(storyCam.x) || 0;
    const viewWorldTop = Number(storyCam.y) || 0;
    const viewLeft = viewWorldLeft * worldScale;
    const viewTop = viewWorldTop * worldScale;
    const viewRight = viewLeft + Number(STORY._cw || 0) / zoom * worldScale;
    const viewBottom = viewTop + Number(STORY._ch || 0) / zoom * worldScale;
    let drawn = 0;
    drawCtx.save();
    drawCtx.imageSmoothingEnabled = false;
    const interactionBitmap = STORY._mapInteracting && layer.interactionBitmap;
    const selectedBitmap = interactionBitmap || null;
    const selectedScale = Number(layer.interactionScale) || .5;
    if (selectedBitmap) {
        const x0 = Math.max(0, viewLeft), y0 = Math.max(0, viewTop);
        const x1 = Math.min(Number(layer.width), viewRight);
        const y1 = Math.min(Number(layer.height), viewBottom);
        if (x1 > x0 && y1 > y0) {
            drawCtx.drawImage(selectedBitmap,
                x0 * selectedScale, y0 * selectedScale,
                (x1 - x0) * selectedScale, (y1 - y0) * selectedScale,
                (x0 - viewLeft) * zoom / worldScale,
                (y0 - viewTop) * zoom / worldScale,
                (x1 - x0) * zoom / worldScale,
                (y1 - y0) * zoom / worldScale);
            drawn = 1;
        }
    } else for (const tile of layer.tiles) {
        if (tile.x + tile.width < viewLeft || tile.x > viewRight
            || tile.y + tile.height < viewTop || tile.y > viewBottom) continue;
        const source = tile.bitmap || tile.canvas;
        if (!source || !(source.width > 1) || !(source.height > 1)) continue;
        const x0 = Math.max(tile.x, viewLeft);
        const y0 = Math.max(tile.y, viewTop);
        const x1 = Math.min(tile.x + tile.width, viewRight);
        const y1 = Math.min(tile.y + tile.height, viewBottom);
        const width = x1 - x0;
        const height = y1 - y0;
        if (!(width > 0) || !(height > 0)) continue;
        drawCtx.drawImage(source,
            x0 - tile.x, y0 - tile.y, width, height,
            (x0 - viewLeft) * zoom / worldScale,
            (y0 - viewTop) * zoom / worldScale,
            width * zoom / worldScale, height * zoom / worldScale);
        drawn++;
    }
    drawCtx.restore();
    if (canCacheView) {
        layer._viewCacheKey = viewCacheKey;
        layer._viewCacheDrawnTiles = drawn;
        layer._viewCacheBuilds = (Number(layer._viewCacheBuilds) || 0) + 1;
        ctx.drawImage(layer._viewCacheCanvas, 0, 0);
    }
    return drawn;
}

function storyDrawIncomingSettlementsDuringPan(ctx, view, farMap, mapZoomRatio,
    cmdNode, adj, urbanModel, physicalSitesModel) {
    if (!STORY._mapInteracting || !view || !ctx) return { drawn: 0, nodeIds: [] };
    const clock = () => typeof performance !== 'undefined' && performance.now
        ? performance.now() : Date.now();
    const started = clock();
    let metricMs = 0, paintMs = 0, textMs = 0;
    const currentZoom = Math.max(.0001, Number(storyCam.zoom) || 1);
    const scale = currentZoom / Math.max(.0001, Number(view.zoom) || 1);
    const left = (Number(view.x) - Number(storyCam.x)) * currentZoom;
    const top = (Number(view.y) - Number(storyCam.y)) * currentZoom;
    const right = left + STORY._cw * scale;
    const bottom = top + STORY._ch * scale;
    const nodeIds = [];
    const hexWorld = typeof storyHexWorldEnsure === 'function'
        ? storyHexWorldEnsure() : null;
    for (const node of STORY.nodes || []) {
        const urbanRecord = urbanModel && urbanModel.records[node.id];
        const core = urbanRecord && urbanRecord.core && urbanRecord.core.center;
        const wx = core && hexWorld
            ? Number(core.x) / Number(hexWorld.width) * STORY_WORLD_W
            : Number(node.lx) * STORY_WORLD_W;
        const wy = core && hexWorld
            ? Number(core.y) / Number(hexWorld.height) * STORY_WORLD_H
            : Number(node.ly) * STORY_WORLD_H;
        const p = storyW2S(wx, wy);
        if (p.u < -0.08 || p.u > 1.08 || p.x < -140 || p.x > STORY._cw + 140
            || p.y < -140 || p.y > STORY._ch + 140) continue;
        // Önce yalnız geometrik kapsamı sınarız. Her node için tam şehir
        // tarifi/ilçe arazi skoru çıkarmak sürükleme karesini gereksiz pahalı yapar.
        const margin = 78;
        const covered = p.x - margin >= left && p.x + margin <= right
            && p.y - margin >= top && p.y + margin <= bottom;
        if (covered) continue;
        const urbanFootprint = urbanRecord;
        const populationPeople = Math.max(0,
            Number(urbanFootprint && urbanFootprint.populationPeople) || 0);
        const districtCount = urbanFootprint && Array.isArray(urbanFootprint.districts)
            ? urbanFootprint.districts.length : 0;
        const visualLevel = urbanFootprint
            ? (populationPeople >= 60000 || districtCount >= 7 ? 3
                : populationPeople >= 25000 || districtCount >= 4 ? 2 : 1)
            : Math.max(1, Math.min(3, node.level | 0 || 1));
        const metrics = typeof storyMapV2SettlementMetrics === 'function'
            ? (() => { const at = clock(); const value = storyMapV2SettlementMetrics(node, {
                cam: storyCam, minZoom: STORY._minZoom || storyCam.zoom,
                visualLevel,
                commander: node.id === cmdNode,
                selected: node.id === STORY.selectedNodeId,
                actionable: adj.indexOf(node.id) >= 0
            }); metricMs += clock() - at; return value; })()
            : { size: farMap ? 10 : 24, hidden: false };
        if (metrics.hidden) continue;
        const px = Math.round(p.x), py = Math.round(p.y);
        const sizePx = Math.max(4, Number(metrics.size) || (farMap ? 10 : 24));
        const half = Math.max(3, Math.round(sizePx * .28));
        const state = storyState(node.owner);
        const paintStarted = clock();
        // Geçici sürükleme LOD'u: GPU atlas kopyası yapmaz. Fare bırakılınca
        // aynı noktadaki tam şehir/ilçe canvas'ı normal şekilde yeniden kurulur.
        ctx.fillStyle = 'rgba(5,10,8,.94)';
        ctx.fillRect(px - half - 2, py - half - 2, half * 2 + 4, half * 2 + 4);
        ctx.fillStyle = '#aeb9aa';
        ctx.fillRect(px - half, py - Math.round(half * .35), half * 2, Math.round(half * 1.35));
        ctx.fillStyle = '#d2d7c8';
        ctx.fillRect(px - Math.round(half * .65), py - half, Math.max(2, Math.round(half * .45)), half);
        ctx.fillRect(px + Math.round(half * .12), py - Math.round(half * .72),
            Math.max(2, Math.round(half * .40)), Math.round(half * .72));
        ctx.fillStyle = state && state.color || '#7cd89b';
        ctx.fillRect(px - half, py + half - 2, half * 2, 2);
        paintMs += clock() - paintStarted;
        const labelEligible = (node.level || 1) >= 2 || node.id === STORY.selectedNodeId
            || adj.indexOf(node.id) >= 0;
        if (labelEligible) {
            const textStarted = clock();
            const label = String(node.name || '').toLocaleUpperCase('tr-TR');
            const size = storyMapLabelFontSize(node, farMap, STORY._cw, STORY._ch);
            ctx.font = `bold ${size}px monospace`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            const y = py + Math.max(5, Math.round(sizePx * .3)) + 4;
            const width = Math.ceil(ctx.measureText(label).width) + 6;
            ctx.fillStyle = 'rgba(7,13,10,.9)';
            ctx.fillRect(px - width / 2, y, width, size + 4);
            ctx.fillStyle = '#e7dfbd'; ctx.fillText(label, px, y + 2);
            textMs += clock() - textStarted;
        }
        nodeIds.push(node.id);
    }
    return { drawn: nodeIds.length, nodeIds,
        totalMs: clock() - started, metricMs, paintMs, textMs };
}

function storyNetworkWorldLayersEnsure() {
    const key = storyNetworkLayerKey(false);
    if (STORY._networkWorldLayers && STORY._networkWorldLayers.key === key) {
        STORY._networkWorldLayers.hits++;
        return STORY._networkWorldLayers;
    }
    if (!storyMapAtlasReady('maritime')) return null;
    const started = typeof performance !== 'undefined' && performance.now
        ? performance.now() : Date.now();
    const saved = { x: storyCam.x, y: storyCam.y, zoom: storyCam.zoom,
        cw: STORY._cw, ch: STORY._ch };
    const layers = Object.create(null);
    try {
        storyCam.x = 0; storyCam.y = 0; storyCam.zoom = 1;
        STORY._cw = STORY_WORLD_W; STORY._ch = STORY_WORLD_H;
        for (const mode of [{ id: 'OVERVIEW', farMap: true }, { id: 'LOCAL', farMap: false }]) {
            const canvas = document.createElement('canvas');
            canvas.width = STORY_WORLD_W;
            canvas.height = STORY_WORLD_H;
            const paint = canvas.getContext('2d');
            paint.clearRect(0, 0, canvas.width, canvas.height);
            paint.imageSmoothingEnabled = false;
            storyDrawMaritimeOverlay(paint, mode.farMap, false);
            // Draw each physical land edge exactly once. Legacy primary plus
            // decorative secondary routes could form parallel figure-eights
            // between the same cities and were not the simulation topology.
            storyDrawPhysicalLandOverlay(paint, mode.farMap);
            storyDrawPhysicalRailOverlay(paint, mode.farMap);
            storyDrawInfrastructureRouteConstructionOverlay(paint, mode.farMap);
            layers[mode.id] = storyCreateWorldRamLayer(canvas, {
                mode: mode.id,
                worldScale: typeof STORY_MAP_RENDERER_V2 !== 'undefined'
                    ? STORY_MAP_RENDERER_V2.networkRasterScale : 1
            });
        }
    } finally {
        storyCam.x = saved.x; storyCam.y = saved.y; storyCam.zoom = saved.zoom;
        STORY._cw = saved.cw; STORY._ch = saved.ch;
    }
    const previous = STORY._networkWorldLayers;
    if (previous && previous.layers) {
        for (const layer of Object.values(previous.layers)) storyReleaseWorldRamLayer(layer);
    }
    const finished = typeof performance !== 'undefined' && performance.now
        ? performance.now() : Date.now();
    STORY._networkWorldLayers = {
        key,
        layers,
        hits: 0,
        builds: (Number(previous && previous.builds) || 0) + 1,
        buildMs: finished - started,
        estimatedBytes: Object.values(layers).reduce(
            (total, layer) => total + Number(layer && layer.estimatedBytes || 0), 0)
    };
    STORY._networkLayerKey = key;
    return STORY._networkWorldLayers;
}

function storyPortWorldLayerEnsure() {
    const network = storyCoastalNetworkEnsure();
    const renderScale = Number(typeof STORY_MAP_RENDERER_V2 !== 'undefined'
        && STORY_MAP_RENDERER_V2.portRasterScale) || 2;
    const key = `port-world-layer-3-raster-coast-edge|${storyNetworkLayerKey(false)}|${renderScale}`;
    if (STORY._portWorldLayer && STORY._portWorldLayer.key === key) {
        STORY._portWorldLayer.hits++;
        return STORY._portWorldLayer;
    }
    if (!storyMapAtlasReady('modernPorts')) return null;
    const started = typeof performance !== 'undefined' && performance.now
        ? performance.now() : Date.now();
    const saved = { x: storyCam.x, y: storyCam.y, zoom: storyCam.zoom,
        cw: STORY._cw, ch: STORY._ch };
    const tileSize = 256;
    const maxWidth = STORY_WORLD_W * renderScale;
    const maxHeight = STORY_WORLD_H * renderScale;
    const tilePorts = new Map();
    for (const port of network.ports || []) {
        const px = port.lx * STORY_WORLD_W * renderScale;
        const py = port.ly * STORY_WORLD_H * renderScale;
        const pad = 14 * renderScale;
        const tx0 = Math.max(0, Math.floor((px - pad) / tileSize));
        const ty0 = Math.max(0, Math.floor((py - pad) / tileSize));
        const tx1 = Math.min(Math.ceil(maxWidth / tileSize) - 1, Math.floor((px + pad) / tileSize));
        const ty1 = Math.min(Math.ceil(maxHeight / tileSize) - 1, Math.floor((py + pad) / tileSize));
        for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
            const tileKey = `${tx}:${ty}`;
            if (!tilePorts.has(tileKey)) tilePorts.set(tileKey, []);
            tilePorts.get(tileKey).push(port);
        }
    }
    const tiles = [];
    try {
        for (const [tileKey, ports] of tilePorts) {
            const [gx, gy] = tileKey.split(':').map(Number);
            const tx = gx * tileSize, ty = gy * tileSize;
            const tw = Math.min(tileSize, maxWidth - tx);
            const th = Math.min(tileSize, maxHeight - ty);
            storyCam.x = tx / renderScale; storyCam.y = ty / renderScale;
            storyCam.zoom = renderScale; STORY._cw = tw; STORY._ch = th;
            const canvas = document.createElement('canvas');
            canvas.width = tw; canvas.height = th;
            const paint = canvas.getContext('2d');
            paint.clearRect(0, 0, tw, th); paint.imageSmoothingEnabled = false;
            storyDrawPortTerminals(paint, ports);
            const tile = { x: tx, y: ty, width: tw, height: th,
                canvas, bitmap: canvas, bitmapFailed: false };
            tiles.push(tile);
        }
    } finally {
        storyCam.x = saved.x; storyCam.y = saved.y; storyCam.zoom = saved.zoom;
        STORY._cw = saved.cw; STORY._ch = saved.ch;
    }
    const previous = STORY._portWorldLayer;
    if (previous && previous.layer) storyReleaseWorldRamLayer(previous.layer);
    const layer = {
        tiles, worldScale: renderScale, mode: 'PORTS', sparse: true,
        estimatedBytes: tiles.reduce((sum, tile) => sum + tile.width * tile.height * 4, 0)
    };
    STORY._portWorldLayer = {
        key, layer, hits: 0,
        builds: (Number(previous && previous.builds) || 0) + 1,
        buildMs: (typeof performance !== 'undefined' && performance.now
            ? performance.now() : Date.now()) - started
    };
    return STORY._portWorldLayer;
}

function storyDrawNetworkLayer(ctx, farMap) {
    const cache = storyNetworkWorldLayersEnsure();
    if (!cache) return;
    const mode = farMap ? 'OVERVIEW' : 'LOCAL';
    const layer = cache.layers[mode];
    const portCache = storyPortWorldLayerEnsure();
    const exactKey = [
        'network-screen-composite-1', cache.key,
        portCache && portCache.key || '-', mode,
        STORY._cw, STORY._ch,
        Number(storyCam.x).toFixed(5), Number(storyCam.y).toFixed(5),
        Number(storyCam.zoom).toFixed(6)
    ].join('|');
    let screen = STORY._networkScreenComposite;
    if (!screen || !screen.canvas || screen.canvas.width !== STORY._cw
        || screen.canvas.height !== STORY._ch || screen.mode !== mode
        || screen.sourceKey !== `${cache.key}|${portCache && portCache.key || '-'}`) {
        if (screen && screen.bitmap && typeof screen.bitmap.close === 'function') {
            screen.bitmap.close();
        }
        const canvas = document.createElement('canvas');
        canvas.width = STORY._cw; canvas.height = STORY._ch;
        screen = STORY._networkScreenComposite = {
            canvas, key: null, sourceKey: `${cache.key}|${portCache && portCache.key || '-'}`,
            mode, view: null, drawnTiles: 0, drawnPortTiles: 0,
            bitmap: null, bitmapKey: null, bitmapPromiseKey: null,
            builds: 0, hits: 0
        };
    }
    const reuseInteraction = !!(STORY._mapInteracting && screen.key);
    const rebuild = !reuseInteraction && screen.key !== exactKey;
    if (rebuild || !screen.key) {
        const paint = screen.canvas.getContext('2d');
        paint.clearRect(0, 0, screen.canvas.width, screen.canvas.height);
        screen.drawnTiles = storyDrawWorldRamLayer(paint, layer);
        screen.drawnPortTiles = portCache
            ? storyDrawWorldRamLayer(paint, portCache.layer) : 0;
        screen.key = exactKey;
        screen.view = storyScreenLayerViewSnapshot();
        screen.builds++;
    } else {
        screen.hits++;
    }
    storyDrawScreenLayerForCamera(ctx, screen.canvas, screen.view);
    const drawnTiles = screen.drawnTiles;
    const drawnPortTiles = screen.drawnPortTiles;
    STORY._networkLayerDiagnostics = {
        key: cache.key,
        mode,
        rebuilt: cache.hits === 0 && cache.builds > 0,
        reusedInteraction: reuseInteraction,
        compositeVersion: 'network-screen-composite-1',
        compositeBuilds: screen.builds,
        compositeHits: screen.hits,
        compositeBitmapReady: !!(screen.bitmap && screen.bitmapKey === screen.key),
        buildMs: cache.buildMs,
        builds: cache.builds,
        hits: cache.hits,
        ramResident: true,
        estimatedBytes: cache.estimatedBytes
            + Number(portCache && portCache.layer && portCache.layer.estimatedBytes || 0),
        portRasterScale: portCache && portCache.layer && portCache.layer.worldScale || 0,
        portTileCount: portCache && portCache.layer && portCache.layer.tiles
            ? portCache.layer.tiles.length : 0,
        drawnPortTiles,
        tileCount: layer && layer.tiles ? layer.tiles.length : 0,
        bitmapReadyCount: layer && layer.tiles ? layer.tiles.reduce(
            (count, tile) => count + (tile.bitmap ? 1 : 0), 0) : 0,
        drawnTiles,
        hexRoads: typeof storyHexRoadDiagnostics === 'function'
            ? storyHexRoadDiagnostics() : null
    };
}

function storyMapLabelFontSize(node, farMap, width, height) {
    const level = Math.max(1, Number(node && node.level) || 1);
    const base = farMap ? (level >= 3 ? 11 : 9) : (level >= 3 ? 13 : 10);
    const pixels = Math.max(1, Number(width) || STORY._cw || 1280)
        * Math.max(1, Number(height) || STORY._ch || 720);
    const viewportScale = Math.max(1, Math.min(1.5,
        Math.sqrt(pixels / (1280 * 720))));
    return Math.max(8, Math.round(base * viewportScale));
}

function storyDrawTransportAgents(ctx, mapZoomRatio) {
    if (typeof storyTransportRenderSnapshot !== 'function'
        || typeof storyHexWorldEnsure !== 'function') return null;
    const world = storyHexWorldEnsure();
    const renderNow = typeof performance !== 'undefined' && performance.now
        ? performance.now() : Date.now();
    const snapshot = storyTransportRenderSnapshot({
        world,
        zoomRatio: mapZoomRatio,
        materializeZoomRatio: 0.05
    });
    if (!snapshot || !Array.isArray(snapshot.displayAgents || snapshot.agents)) return null;
    const worldScaleX = STORY_WORLD_W / Math.max(1, Number(world.width) || 1);
    const worldScaleY = STORY_WORLD_H / Math.max(1, Number(world.height) || 1);
    const transitionMs = 250;
    const tracks = STORY._transportVisualTracks instanceof Map
        ? STORY._transportVisualTracks : (STORY._transportVisualTracks = new Map());
    const seenTrackIds = STORY._seenTrackIds || (STORY._seenTrackIds = new Set());
    seenTrackIds.clear();
    let visible = 0;
    let interpolated = 0;
    let targetChanges = 0;
    const presentationSamples = STORY._presentationSamples || (STORY._presentationSamples = []);
    presentationSamples.length = 0;
    const stateCounts = Object.create(null);
    let longestQueue = 0;
    const lodScale = Math.min(1.0, Math.max(0.4, Number(mapZoomRatio || 1) * 0.45));
    const slotSize = Math.max(10, Math.round(20 * lodScale));
    const visualSlots = STORY._visualSlots || (STORY._visualSlots = new Set());
    visualSlots.clear();
    let densityCulled = 0;
    const displayAgents = snapshot.displayAgents || snapshot.agents;
    const _agentTrackCache = STORY._agentTrackCache || (STORY._agentTrackCache = new WeakMap());
    const camZoom = typeof storyCam !== 'undefined' && storyCam && storyCam.zoom ? storyCam.zoom : 1;
    const camX = typeof storyCam !== 'undefined' && storyCam && storyCam.x ? storyCam.x : 0;
    const camY = typeof storyCam !== 'undefined' && storyCam && storyCam.y ? storyCam.y : 0;
    const halfW = (STORY._cw / 2) / camZoom + 100;
    const halfH = (STORY._ch / 2) / camZoom + 100;
    const minWorldX = camX - halfW;
    const maxWorldX = camX + halfW;
    const minWorldY = camY - halfH;
    const maxWorldY = camY + halfH;
    for (const agent of displayAgents) {
        const wx = agent.x * worldScaleX;
        const wy = agent.y * worldScaleY;
        if (wx < minWorldX || wx > maxWorldX || wy < minWorldY || wy > maxWorldY) continue;
        let trackId = agent.presentationTrackId;
        if (!trackId) {
            trackId = _agentTrackCache.get(agent);
            if (!trackId) {
                trackId = String(agent.authorityType || 'TRANSPORT') + ':' + String(agent.authorityId || agent.agentId);
                _agentTrackCache.set(agent, trackId);
            }
        }
        seenTrackIds.add(trackId);
        const isContinuous = typeof storyTransportContinuousAdvance === 'function' && STORY._lastFrameT;
        const posX = isContinuous ? agent.x : (typeof storyTransportPresentationResolve === 'function'
            ? storyTransportPresentationResolve(tracks.get(trackId), agent, renderNow, transitionMs).x : agent.x);
        const posY = isContinuous ? agent.y : (typeof storyTransportPresentationResolve === 'function'
            ? storyTransportPresentationResolve(tracks.get(trackId), agent, renderNow, transitionMs).y : agent.y);
        const p = storyW2S(posX * worldScaleX, posY * worldScaleY);
        if (p.x < -40 || p.x > STORY._cw + 40 || p.y < -40 || p.y > STORY._ch + 40) continue;
        if (mapZoomRatio < 0.15) {
            const slotKey = typeof storyTransportScreenSlotKey === 'function'
                ? storyTransportScreenSlotKey(p.x, p.y, slotSize)
                : ((Math.floor(p.x / slotSize) * 10000 + Math.floor(p.y / slotSize)) | 0);
            if (visualSlots.has(slotKey)) {
                densityCulled++;
                continue;
            }
            visualSlots.add(slotKey);
        }
        visible++;
        const representedCount = Math.max(1,
            Number(agent.shipmentCount || 0) + Number(agent.journeyCount || 0));
        stateCounts[agent.state] = (stateCounts[agent.state] || 0) + representedCount;
        longestQueue = Math.max(longestQueue,
            Number(agent.terminalQueuePosition) || 0);
        const near = mapZoomRatio >= 0.8;
        const size = Math.max(8, Math.round((agent.vehicleClass === 'CARGO_SHIP' ? 20 : agent.vehicleClass === 'FREIGHT_TRAIN' ? 16 : 14) * lodScale));
        const visual = typeof storyVisualTransportAsset === 'function'
            ? storyVisualTransportAsset(agent.vehicleClass, STORY.year, agent) : null;
        const baseSpriteSize = agent.vehicleClass === 'CARGO_SHIP' ? [58, 39]
            : agent.vehicleClass === 'FREIGHT_TRAIN' ? [64, 36] : [46, 31];
        const spriteSize = [Math.max(16, Math.round(baseSpriteSize[0] * lodScale)), Math.max(10, Math.round(baseSpriteSize[1] * lodScale))];
        const flipSprite = !!(visual && visual.mirrorForReverse
            && Math.cos(Number(agent.angle) || 0) < 0);

        const drewSprite = !!(visual && visual.ok
            && storyDrawAtlasCell(ctx, visual.atlasKey, visual.atlasCell,
                p.x, p.y + spriteSize[1] / 2, spriteSize[0], spriteSize[1], 1,
                0, flipSprite));
        if (!drewSprite) {
            ctx.save();
            ctx.translate(Math.round(p.x), Math.round(p.y));
            ctx.rotate(Number(agent.angle) || 0);
            ctx.lineWidth = near ? 1.5 : 1;
            ctx.strokeStyle = agent.state === 'WAITING' ? '#ff5d5d' : '#07100b';
            ctx.fillStyle = agent.vehicleClass === 'CARGO_SHIP' ? '#56b9e9'
                : agent.vehicleClass === 'FREIGHT_TRAIN' ? '#d5d9df' : '#f0ad2f';
            if (agent.vehicleClass === 'CARGO_SHIP') {
                ctx.beginPath();
                ctx.moveTo(size * .62, 0);
                ctx.lineTo(size * .2, size * .34);
                ctx.lineTo(-size * .55, size * .25);
                ctx.lineTo(-size * .55, -size * .25);
                ctx.lineTo(size * .2, -size * .34);
                ctx.closePath();
                ctx.fill(); ctx.stroke();
            } else if (agent.vehicleClass === 'FREIGHT_TRAIN') {
                for (let index = 0; index < (near ? 3 : 2); index++) {
                    ctx.fillRect(-size * .58 + index * size * .42,
                        -size * .22, size * .34, size * .44);
                    ctx.strokeRect(-size * .58 + index * size * .42,
                        -size * .22, size * .34, size * .44);
                }
            } else {
                ctx.fillRect(-size * .52, -size * .28, size * .68, size * .56);
                ctx.strokeRect(-size * .52, -size * .28, size * .68, size * .56);
                ctx.fillRect(size * .16, -size * .22, size * .34, size * .44);
                ctx.strokeRect(size * .16, -size * .22, size * .34, size * .44);
            }
            ctx.restore();
        }
        if (near && agent.state !== 'MOVING') {
            ctx.save();
            const blocked = agent.state === 'WAITING';
            const queued = agent.state === 'QUEUED';
            const phase = agent.state === 'LOADING' ? 'YÜK'
                : agent.state === 'UNLOADING' ? 'İNDİR'
                    : agent.state === 'TRANSFERRING' ? 'AKTAR'
                        : blocked ? 'DURDU'
                            : queued ? 'SIRA ' + Math.max(1,
                                Number(agent.terminalQueuePosition) || 1) : agent.state;
            const phaseProgress = Math.max(0, Math.min(10000,
                Number(agent.phaseProgressBps) || 0));
            ctx.strokeStyle = blocked ? '#ff5d5d'
                : queued ? '#f6d365' : '#5ee58c';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(Math.round(p.x), Math.round(p.y), 10, 0, Math.PI * 2);
            ctx.stroke();
            if (!blocked && !queued && phaseProgress > 0) {
                ctx.strokeStyle = '#f6d365';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(Math.round(p.x), Math.round(p.y), 10,
                    -Math.PI / 2,
                    -Math.PI / 2 + Math.PI * 2 * phaseProgress / 10000);
                ctx.stroke();
            }
            ctx.font = 'bold 8px monospace';
            const labelWidth = Math.max(31, Math.ceil(ctx.measureText(phase).width) + 8);
            const labelX = Math.round(p.x - labelWidth / 2);
            const labelY = Math.round(p.y - 25);
            ctx.fillStyle = '#07100b';
            ctx.fillRect(labelX, labelY, labelWidth, 11);
            ctx.strokeStyle = blocked ? '#ff5d5d'
                : queued ? '#f6d365' : '#5ee58c';
            ctx.lineWidth = 1;
            ctx.strokeRect(labelX + .5, labelY + .5, labelWidth - 1, 10);
            ctx.fillStyle = ctx.strokeStyle;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(phase, Math.round(p.x), labelY + 5.5);
            ctx.restore();
        }
        if (agent.aggregate && representedCount > 1) {
            ctx.fillStyle = '#07100b';
            ctx.fillRect(Math.round(p.x + 5), Math.round(p.y - 10), 14, 10);
            ctx.fillStyle = '#f6d365';
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(String(representedCount), Math.round(p.x + 12), Math.round(p.y - 2));
        }
    }
    for (const key of Array.from(tracks.keys())) {
        if (!seenTrackIds.has(key)) tracks.delete(key);
    }
    STORY._transportRenderDiagnostics = {
        mode: snapshot.mode,
        activeShipments: snapshot.shipmentCount,
        activeJourneys: snapshot.journeyCount,
        passengerCount: snapshot.passengerCount,
        renderedAgents: visible,
        interpolatedAgents: interpolated,
        targetChanges,
        snapshotReused: false,
        snapshotTransitionMs: transitionMs,
        transitionMs,
        rotationFreeSprites: true,
        visualTrackCount: tracks.size,
        presentationSamples,
        cargoQuantity: snapshot.cargoQuantity,
        stateCounts,
        longestQueue,
        densityCulledAgents: densityCulled,
        visualSlotPx: slotSize
    };
    return snapshot;
}

function storyRenderTransportOverlay() {
    const cv = document.getElementById('storyTransportCanvas');
    if (!cv) return null;
    const base = document.getElementById('storyCanvas');
    if (base && (cv.width !== STORY._cw || cv.height !== STORY._ch)) {
        cv.width = STORY._cw || base.width;
        cv.height = STORY._ch || base.height;
    }
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = false;
    const mapZoomRatio = typeof storyMapV2ZoomRatio === 'function'
        ? storyMapV2ZoomRatio(storyCam, STORY._minZoom || storyCam.zoom)
        : storyCam.zoom / Math.max(.0001, storyMinZoom(cv.width, cv.height));
    const started = typeof performance !== 'undefined' && performance.now
        ? performance.now() : Date.now();
    storyDrawHoverHex(ctx);
    const snapshot = storyDrawTransportAgents(ctx, mapZoomRatio);
    const finished = typeof performance !== 'undefined' && performance.now
        ? performance.now() : Date.now();
    if (STORY._showPerfHud !== false) {
        storyDrawPerfHud(ctx, cv.width, cv.height);
    }
    STORY._transportOverlayDiagnostics = {
        adapterVersion: 'transport-overlay-60hz-2',
        frameMs: finished - started,
        width: cv.width,
        height: cv.height,
        activeAgents: snapshot && snapshot.agents ? snapshot.agents.length : 0,
        staticWorldRedrawn: false
    };
    return snapshot;
}

function storyDrawPerfHud(ctx, width, height) {
    if (!STORY._perfMetrics) {
        const initNow = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
        STORY._perfMetrics = {
            frames: 0,
            fps: 60,
            lastFpsUpdate: initNow
        };
    }
    const metrics = STORY._perfMetrics;
    const now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    metrics.frames++;
    if (now - metrics.lastFpsUpdate >= 500) {
        metrics.fps = Math.round((metrics.frames * 1000) / Math.max(1, now - metrics.lastFpsUpdate));
        metrics.frames = 0;
        metrics.lastFpsUpdate = now;
    }

    const fps = metrics.fps || 60;
    const simMs = STORY._lastStepLatencyMs != null ? STORY._lastStepLatencyMs.toFixed(1) : '0.0';
    const speed = STORY.time && STORY.time.speed ? STORY.time.speed : 1;
    const text = `FPS: ${fps} | Sim: ${simMs}ms | ${speed}x`;

    ctx.save();
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';

    const padding = 6;
    const textWidth = ctx.measureText(text).width;
    const x = width - 12;
    const y = 8;

    ctx.fillStyle = 'rgba(10, 15, 20, 0.75)';
    ctx.strokeStyle = fps < 45 ? '#e74c3c' : (fps < 55 ? '#f39c12' : '#2ecc71');
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x - textWidth - padding * 2, y, textWidth + padding * 2, 20, 4);
    } else {
        ctx.rect(x - textWidth - padding * 2, y, textWidth + padding * 2, 20);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ecf0f1';
    ctx.fillText(text, x - padding, y + 4);
    ctx.restore();
}

function storySettlementLayerKey(farMap, mapZoomRatio, width, height, cmdNode, adj,
    urbanSourceHash, physicalSitesSourceHash) {
    const atlasState = storySettlementAtlasesReady() ? 'ready' : 'loading';
    const nodeState = (STORY.nodes || []).map(node => [
        node.id, node.owner, node.level | 0, node.fac | 0,
        node.oil ? 1 : 0, node.mine ? 1 : 0, node.bar | 0,
        node.geo ? 1 : 0
    ].join(':')).join(',');
    const invalidation = STORY._mapCacheInvalidation || {};
    const band = typeof storyMapV2VisualZoomBand === 'function'
        ? storyMapV2VisualZoomBand(storyCam, STORY._minZoom || storyCam.zoom)
        : (farMap ? 'OVERVIEW' : 'LOCAL');
    const bucket = typeof storyMapV2CameraBucket === 'function'
        ? storyMapV2CameraBucket(storyCam, width, height) : '0:0';
    return [
        'settlement-screen-layer-1', width, height,
        band, bucket, farMap ? 1 : 0, atlasState,
        String(urbanSourceHash || 'no-urban-footprint'),
        String(physicalSitesSourceHash || 'no-physical-sites'),
        STORY.playerStateId, cmdNode, STORY.selectedNodeId,
        (adj || []).join(','), Number(invalidation.revision) || 0, nodeState
    ].join('|');
}

function storyCommanderLayerKey(settlementLayerKey, farMap, cmdNode, adj) {
    const commanderState = (STORY.states || []).map(state => {
        const commanders = state && state.gov && Array.isArray(state.gov.commanders)
            ? state.gov.commanders : [];
        return `${state.id}:${commanders.map(commander => commander.node).join('.')}`;
    }).join(',');
    const siegeState = (STORY.nodes || []).filter(node => node._siege)
        .map(node => node.id).join(',');
    return [
        'commander-screen-layer-1', settlementLayerKey, farMap ? 1 : 0,
        cmdNode, STORY.selectedNodeId, (adj || []).join(','),
        commanderState, siegeState
    ].join('|');
}

function storyPaintHexGridOverlay(ctx, zoomRatio) {
    if (!(Number(zoomRatio) >= 4.2)
        || typeof storyHexVisibleCellIndices !== 'function'
        || typeof storyHexWorldEnsure !== 'function'
        || typeof storyMapV2Enabled !== 'function'
        || !storyMapV2Enabled()) return 0;
    const world = storyHexWorldEnsure();
    const geography = typeof storyHexGeographyEnsure === 'function'
        ? storyHexGeographyEnsure() : null;
    const visibleWidth = STORY._cw / storyCam.zoom;
    const visibleHeight = STORY._ch / storyCam.zoom;
    const indices = storyHexVisibleCellIndices({
        minX: storyCam.x,
        minY: storyCam.y,
        maxX: storyCam.x + visibleWidth,
        maxY: storyCam.y + visibleHeight
    }, STORY_WORLD_W, STORY_WORLD_H);
    const scaleX = STORY_WORLD_W / world.width;
    const scaleY = STORY_WORLD_H / world.height;
    let visibleLand = 0;
    let visibleWater = 0;
    let visibleImpassable = 0;
    const rad = Number(world.radius);
    const rcos = rad * 0.8660254037844386 * scaleX;
    const rsin = rad * 0.5 * scaleY;
    const rtop = rad * scaleY;
    const traceHex = index => {
        const cx = Number(world.centerX[index]) * scaleX;
        const cy = Number(world.centerY[index]) * scaleY;
        const p0 = storyW2S(cx + rcos, cy - rsin);
        const p1 = storyW2S(cx + rcos, cy + rsin);
        const p2 = storyW2S(cx, cy + rtop);
        const p3 = storyW2S(cx - rcos, cy + rsin);
        const p4 = storyW2S(cx - rcos, cy - rsin);
        const p5 = storyW2S(cx, cy - rtop);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.lineTo(p5.x, p5.y);
        ctx.closePath();
    };
    ctx.save();
    ctx.beginPath();
    for (const index of indices) {
        if (geography) {
            const terrain = Number(geography.terrainClass[index]);
            if (terrain === STORY_HEX_TERRAIN_WATER) visibleWater++;
            else visibleLand++;
            if (terrain === STORY_HEX_TERRAIN_IMPASSABLE) visibleImpassable++;
        }
        traceHex(index);
    }
    ctx.strokeStyle = Number(zoomRatio) >= 7
        ? 'rgba(232,211,148,.12)' : 'rgba(232,211,148,.07)';
    ctx.lineWidth = Number(zoomRatio) >= 7 ? .75 : .55;
    ctx.stroke();
    if (geography && visibleImpassable > 0) {
        ctx.beginPath();
        for (const index of indices) {
            if (Number(geography.terrainClass[index]) !== STORY_HEX_TERRAIN_IMPASSABLE) continue;
            traceHex(index);
        }
        ctx.fillStyle = 'rgba(68,43,24,.24)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(238,211,154,.34)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    const constructionDraft = STORY._hexConstructionDraft;
    const candidateIds = constructionDraft && Array.isArray(constructionDraft.candidateCellIds)
        ? new Set(constructionDraft.candidateCellIds) : null;
    if (candidateIds && candidateIds.size) {
        ctx.beginPath();
        for (const index of indices) {
            const cellId = storyHexWorldId(Number(world.qValues[index]), Number(world.rValues[index]));
            if (!candidateIds.has(cellId)) continue;
            traceHex(index);
        }
        ctx.fillStyle = 'rgba(62,255,144,.12)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(62,255,144,.82)';
        ctx.lineWidth = 1.35;
        ctx.stroke();
    }
    const selectedConstructionId = String(constructionDraft && constructionDraft.selectedCellId || '');
    if (selectedConstructionId) {
        const selected = indices.find(index => storyHexWorldId(
            Number(world.qValues[index]), Number(world.rValues[index])
        ) === selectedConstructionId);
        if (selected != null) {
            ctx.beginPath();
            traceHex(selected);
            ctx.fillStyle = 'rgba(255,191,38,.22)'; ctx.fill();
            ctx.strokeStyle = 'rgba(255,191,38,.95)'; ctx.lineWidth = 2; ctx.stroke();
        }
    }
    ctx.restore();
    STORY._hexGridDiagnostics = {
        visibleCellCount: indices.length,
        visibleLand,
        visibleWater,
        visibleImpassable,
        geographyHash: geography ? geography.geographyHash : null,
        rasterSourceHash: geography ? geography.rasterSourceHash : null,
        zoomRatio: Number(zoomRatio),
        constructionCandidateCount: candidateIds ? candidateIds.size : 0,
        constructionSelectedCellId: selectedConstructionId || null
    };
    return indices.length;
}

function storyDrawHexGridOverlay(ctx, zoomRatio) {
    if (!(Number(zoomRatio) >= 4.2)
        || typeof storyMapV2Enabled !== 'function' || !storyMapV2Enabled()) return 0;
    const band = typeof storyMapV2VisualZoomBand === 'function'
        ? storyMapV2VisualZoomBand(storyCam, STORY._minZoom || storyCam.zoom) : 'LOCAL';
    const bucket = typeof storyMapV2CameraBucket === 'function'
        ? storyMapV2CameraBucket(storyCam, STORY._cw, STORY._ch) : '0:0';
    const geography = typeof storyHexGeographyEnsure === 'function'
        ? storyHexGeographyEnsure() : null;
    const key = [STORY._cw, STORY._ch, band, bucket,
        geography && geography.geographyHash || '-',
        STORY._hexConstructionDraft
            ? `${STORY._hexConstructionDraft.projectType}:${STORY._hexConstructionDraft.selectedCellId || '-'}:${(STORY._hexConstructionDraft.candidateCellIds || []).join(',')}`
            : '-'].join('|');
    let cache = STORY._hexGridLayerCache;
    if (!cache || !cache.canvas || cache.canvas.width !== STORY._cw
        || cache.canvas.height !== STORY._ch) {
        const canvas = document.createElement('canvas');
        canvas.width = STORY._cw; canvas.height = STORY._ch;
        cache = STORY._hexGridLayerCache = { canvas, key: null, view: null, count: 0 };
    }
    const reuseInteraction = !!(STORY._mapInteracting && cache.key === key);
    if (!reuseInteraction && cache.key !== key) {
        const paint = cache.canvas.getContext('2d');
        paint.clearRect(0, 0, cache.canvas.width, cache.canvas.height);
        cache.count = storyPaintHexGridOverlay(paint, zoomRatio);
        cache.key = key;
        cache.view = storyScreenLayerViewSnapshot();
        cache.diagnostics = Object.assign({}, STORY._hexGridDiagnostics);
    } else if (cache.diagnostics) {
        STORY._hexGridDiagnostics = Object.assign({}, cache.diagnostics, {
            cached: true, reusedInteraction: reuseInteraction
        });
    }
    storyDrawScreenLayerForCamera(ctx, cache.canvas, cache.view);
    return cache.count;
}

function storyDrawHoverHex(ctx) {
    const hoverId = STORY._hoverHexCellId;
    if (!hoverId) return;
    let hoverParsed = STORY._hoverHexParsed;
    if (!hoverParsed || hoverParsed.id !== hoverId) {
        const parts = String(hoverId).split(':');
        hoverParsed = STORY._hoverHexParsed = {
            id: hoverId,
            q: parts.length >= 3 ? Number(parts[1]) : NaN,
            r: parts.length >= 3 ? Number(parts[2]) : NaN
        };
    }
    const q = hoverParsed.q, r = hoverParsed.r;
    if (Number.isFinite(q) && Number.isFinite(r) && typeof storyHexWorldCorners === 'function') {
        const world = typeof storyHexWorldEnsure === 'function' ? storyHexWorldEnsure() : null;
        if (world) {
            const scaleX = STORY_WORLD_W / world.width;
            const scaleY = STORY_WORLD_H / world.height;
            const corners = storyHexWorldCorners(world, q, r);
            if (corners && corners.length) {
                ctx.save();
                ctx.beginPath();
                const first = storyW2S(corners[0].x * scaleX, corners[0].y * scaleY);
                ctx.moveTo(first.x, first.y);
                for (let corner = 1; corner < corners.length; corner++) {
                    const pt = storyW2S(corners[corner].x * scaleX, corners[corner].y * scaleY);
                    ctx.lineTo(pt.x, pt.y);
                }
                ctx.closePath();
                ctx.fillStyle = 'rgba(255,191,38,.12)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,191,38,.85)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.restore();
            }
        }
    }
}

function storyDrawPoliticalBorderLayer(ctx) {
    if (typeof storyDrawHexPoliticalBorders !== 'function') return 0;
    return storyDrawHexPoliticalBorders(ctx);
}

function storyGeoTerrainCache() {
    const terrainStyleVersion = 'geo-terrain-modern-clean-v1';
    const mapPalette = typeof storyMapPaletteDescriptor === 'function'
        ? storyMapPaletteDescriptor()
        : { id: 'neutral', rgb: [1, 1, 1], lift: [0, 0, 0] };
    const mapPaletteKey = typeof storyMapPaletteKey === 'function'
        ? storyMapPaletteKey()
        : 'palette:neutral';
    if (STORY._geoTerrain && STORY._geoTerrainSource
        && STORY._geoTerrainSource.paletteKey === mapPaletteKey
        && STORY._geoTerrainSource.styleVersion === terrainStyleVersion) {
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
            styleVersion: terrainStyleVersion,
            width: fb.width,
            height: fb.height
        };
        STORY._geoTerrain = fb; return fb;
    }
    // V2 yakın görünüm tabanı: eski 0.9 ölçek (1350 px) 4.5x zoomda dev
    // piksellere/bulanıklığa dönüşüyordu. 1.6 ölçek tüm üretilmiş atlasları
    // korurken arazi tamponunu 2400 px'e çıkarır; dinamik politik katman ayrı kalır.
    const cleanV2 = typeof storyMapV2Enabled === 'function' && storyMapV2Enabled();
    const S = cleanV2 ? 1.6 : 0.9;
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
    // sırtlar (tampon uzayında)
    const ranges = GEO.ranges.map(r => ({ pts: r.pts.map(p => [p[0] * S, p[1] * S]), r: Math.max(7 * f, r.r * S * 1.5), str: r.str }));
    // 3) yükseklik alanı — taban (deniz batimetri + kara kıyı eğimi + fBm)
    const hgt = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!land[i]) { hgt[i] = -Math.min(1, dSea[i] / (73 * f)); continue; }
        // V2'de yükseltiyi iki kez çizme: taban yalnız yumuşak renk/toprak
        // değişimi taşır, gerçek sıradağ silueti dağ atlasının sorumluluğudur.
        let h = Math.min(1, dLand[i] / (41 * f)) * (cleanV2 ? .09 : .28);
        h += (fbm(x * .012 / f, y * .012 / f, 5) - .45) * (cleanV2 ? .10 : .30);
        h += (fbm(x * .05 / f + 40, y * .05 / f, 3) - .5) * (cleanV2 ? .018 : .05);
        hgt[i] = h;
    }
    // sırt bindirmesi — yalnız her sıranın bbox'ı içinde (perf); boy/kol gürültüsüyle tek koni oluşmaz
    if (!cleanV2) for (const R of ranges) {
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
            // V2 draws its own canonical gold/foam contour. Keep the bathymetric
            // shelf blue and restrained; the former pale-grey 52% mix produced
            // a cloudy halo wider than the actual shoreline at regional zoom.
            if (dSea[i] <= 2.2 * f) col = _geoMixRgb(col, [35, 112, 151], .27);
        } else {
            const h = hgt[i];
            const hx = (hgt[Math.min(W - 1, x + 1) + y * W] - hgt[Math.max(0, x - 1) + y * W]);
            const hy = (hgt[x + Math.min(H - 1, y + 1) * W] - hgt[x + Math.max(0, y - 1) * W]);
            const sh = Math.max(-1, Math.min(1, (-hx - hy)
                * (cleanV2 ? 3.2 : (h > .7 ? 13 : 7))));
            const shade = sh > (cleanV2 ? .42 : .28) ? 1
                : sh < (cleanV2 ? -.42 : -.28) ? -1 : 0;
            let pal, t;
            const forestN = fbm(x * .022 / f + 200, y * .022 / f, 4);
            if (!cleanV2 && h > .95) { pal = PL.rock; const snowH = 1.72, patch = fbm(x * .06 / f + 300, y * .06 / f + 120, 3); t = (h > snowH && patch > .52) ? .8 + Math.min(1, (h - snowH) / .2) * .2 : Math.min(.44, (h - .95) / .8); }
            else if (y < borY + (fbm(x * .009 / f, y * .009 / f + 5, 3) - .5) * 150 * f) { pal = PL.boreal; t = .25 + h * .8; }
            else if (y > desY + (fbm(x * .009 / f + 30, y * .009 / f, 3) - .5) * 150 * f && h < .6) { pal = PL.dry; t = .2 + h * 1.1; }
            else if (forestN > .49 && h < .74) { pal = PL.forest; t = (forestN - .49) * 4.6 + h * .6; }
            else { pal = PL.plain; t = .18 + h * 1.5; }
            const dense = h > .62 ? 1.45 : dLand[i] < 10 * f ? 1.25 : pal === PL.forest ? .85 : .45;
            col = pick(pal, Math.max(0, Math.min(1, t))
                + shade * (cleanV2 ? .07 : (h > .7 ? .3 : .16)), x, y, dense);
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
    if (!cleanV2) storyDrawGeoAtlasDetail(ctx, land, hgt, W, H, f, dLand, dSea);
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
        styleVersion: terrainStyleVersion,
        width: W,
        height: H
    } : {
        adapterVersion: 'legacy-geo-scanline',
        paletteId: mapPalette.id,
        paletteKey: mapPaletteKey,
        styleVersion: terrainStyleVersion,
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
        STORY_WORLD_W = 3000; STORY_WORLD_H = Math.round(3000 * h / w);
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
function storyFastTerrainCacheV2() {
    const raster = typeof storyMapRasterEnsure === 'function' ? storyMapRasterEnsure() : null;
    if (!raster || !raster.landMask) return null;
    const palette = typeof storyMapPaletteDescriptor === 'function'
        ? storyMapPaletteDescriptor() : { id: 'neutral', rgb: [1, 1, 1], lift: [0, 0, 0] };
    const paletteKey = typeof storyMapPaletteKey === 'function'
        ? storyMapPaletteKey() : 'palette:neutral';
    const styleVersion = 'geo-terrain-v2-fast-base-1';
    if (STORY._geoTerrain && STORY._geoTerrain.width === raster.width && STORY._geoTerrain.height === raster.height
        && STORY._geoTerrainSource
        && STORY._geoTerrainSource.paletteKey === paletteKey
        && STORY._geoTerrainSource.styleVersion === styleVersion) return STORY._geoTerrain;
    const W = raster.width, H = raster.height;
    const cv = (STORY._geoTerrain && STORY._geoTerrain.width === W && STORY._geoTerrain.height === H)
        ? STORY._geoTerrain : document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const image = ctx.createImageData(W, H), out = image.data;
    let seaDistance = raster._seaDistance;
    if (!seaDistance && typeof _geoDistT === 'function') {
        seaDistance = raster._seaDistance = _geoDistT(raster.landMask, W, H, 0);
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, p = i * 4;
        let color;
        if (!raster.landMask[i]) {
            const depth = seaDistance ? Math.min(1, Number(seaDistance[i]) / 70) : 1;
            const shallow = 1 - depth;
            color = [29 + shallow * 35, 62 + shallow * 53, 103 + shallow * 55];
        } else {
            const latitude = y / Math.max(1, H - 1);
            const noise = (storyHash(x * 3 + 17, y * 5 + 29) - .5) * 12;
            if (latitude > .72) color = [157 + noise, 142 + noise, 99 + noise * .5];
            else if (latitude < .25) color = [70 + noise * .4, 91 + noise, 68 + noise * .4];
            else color = [101 + noise * .5, 128 + noise, 72 + noise * .4];
        }
        out[p] = Math.max(0, Math.min(255, Math.round(color[0] * palette.rgb[0] + palette.lift[0])));
        out[p + 1] = Math.max(0, Math.min(255, Math.round(color[1] * palette.rgb[1] + palette.lift[1])));
        out[p + 2] = Math.max(0, Math.min(255, Math.round(color[2] * palette.rgb[2] + palette.lift[2])));
        out[p + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    STORY._geoTerrainSource = {
        adapterVersion: 'story-fast-terrain-v2-1', sourceHash: raster.sourceHash,
        landHash: raster.landHash, paletteId: palette.id, paletteKey,
        styleVersion, width: W, height: H
    };
    STORY._geoTerrain = cv;
    return cv;
}

function storyEnsureTerrainCache() {
    if (STORY._terrainCache) return STORY._terrainCache;
    if (!STORY._landGrid) storyBuildLandGrid();
    if (typeof storyMapV2Enabled === 'function' && storyMapV2Enabled()) {
        const fast = storyFastTerrainCacheV2();
        if (fast) { STORY._terrainCache = fast; return fast; }
    }
    // DESIGN "GERÇEKÇİ HARİTA" (v3): geo modda rölyef+hillshade+batimetri terrain'i kullan
    if (STORY._geoMap && typeof GEO !== 'undefined' && typeof storyGeoTerrainCache === 'function') {
        STORY._terrainCache = storyGeoTerrainCache(); return STORY._terrainCache;
    }
    const cv = document.createElement('canvas'); cv.width = STORY_GW; cv.height = STORY_GH;
    const g = cv.getContext('2d'); const grid = STORY._landGrid;
    const img = g.createImageData(STORY_GW, STORY_GH);
    const out = img.data;
    const at = (x, y) => (x < 0 || y < 0 || x >= STORY_GW || y >= STORY_GH) ? -1 : grid[y * STORY_GW + x];
    for (let gy = 0; gy < STORY_GH; gy++) {
        const row = gy * STORY_GW;
        const normY = (gy + 0.5) / STORY_GH;
        for (let gx = 0; gx < STORY_GW; gx++) {
            const idx = row + gx;
            const p = idx * 4;
            const id = grid[idx], hsh = storyHash(gx * 3 + 1, gy * 3 + 7);
            if (id < 0) {
                const coast = (at(gx - 1, gy) >= 0 || at(gx + 1, gy) >= 0 || at(gx, gy - 1) >= 0 || at(gx, gy + 1) >= 0);
                if (coast) { out[p] = 64; out[p + 1] = 118; out[p + 2] = 158; }
                else { const s = Math.floor(hsh * 9); out[p] = 20 + s; out[p + 1] = 60 + s; out[p + 2] = 92 + s; }
            } else {
                const t = storyTerrainColor(normY, hsh);
                out[p] = t[0]; out[p + 1] = t[1]; out[p + 2] = t[2];
            }
            out[p + 3] = 255;
        }
    }
    g.putImageData(img, 0, 0);
    STORY._terrainCache = cv; return cv;
}

// (2) DİNAMİK POLİTİK katman — her kara hücresi SAHİBİNİN rengiyle yarı-saydam; imparatorluk sınırı koyu+opak;
//  deniz şeffaf (terrain görünür). Sahiplik değişince yeniden çizilir (fetih → renk anında değişir).
function storyEnsureOwnerOverlay() {
    if (typeof storyHexPoliticalOverlayEnsureCanvas === 'function') {
        const hexCanvas = storyHexPoliticalOverlayEnsureCanvas();
        if (hexCanvas) return hexCanvas;
    }
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
    const img = g.createImageData(STORY_GW, STORY_GH);
    const out = img.data;
    const ownerAt = (x, y) => { if (x < 0 || y < 0 || x >= STORY_GW || y >= STORY_GH) return -1; const id = grid[y * STORY_GW + x]; return id < 0 ? -1 : STORY.nodes[id].owner; };
    for (let gy = 0; gy < STORY_GH; gy++) {
        const row = gy * STORY_GW;
        for (let gx = 0; gx < STORY_GW; gx++) {
            const idx = row + gx;
            const id = grid[idx];
            if (id < 0) continue;                              // deniz → şeffaf (terrain görünür)
            const p = idx * 4;
            const ow = STORY.nodes[id].owner;
            const oc = storyHexRgb((storyState(ow) || {}).color || '#888888');
            const bord = (ownerAt(gx + 1, gy) !== ow && ownerAt(gx + 1, gy) !== -1) || (ownerAt(gx, gy + 1) !== ow && ownerAt(gx, gy + 1) !== -1)
                      || (ownerAt(gx - 1, gy) !== ow && ownerAt(gx - 1, gy) !== -1) || (ownerAt(gx, gy - 1) !== ow && ownerAt(gx, gy - 1) !== -1);
            if (bord) {
                out[p] = oc[0] * 0.5 | 0;
                out[p + 1] = oc[1] * 0.5 | 0;
                out[p + 2] = oc[2] * 0.5 | 0;
                out[p + 3] = 173; // 0.68 * 255
            } else {
                out[p] = oc[0];
                out[p + 1] = oc[1];
                out[p + 2] = oc[2];
                out[p + 3] = 26; // 0.10 * 255
            }
        }
    }
    g.putImageData(img, 0, 0);
    STORY._ownerKey = key; return cv;
}

function storyRender() {
    STORY._staticWorldRenderCount = Math.max(0,
        Number(STORY._staticWorldRenderCount) || 0) + 1;
    const renderClock = typeof performance !== 'undefined' && performance.now
        ? () => performance.now() : () => Date.now();
    const renderStarted = renderClock();
    let renderMark = renderStarted;
    const renderLayers = {};
    const markRenderLayer = name => {
        const now = renderClock();
        renderLayers[name] = now - renderMark;
        renderMark = now;
    };
    const cv = document.getElementById('storyCanvas');
    if (!cv) return;
    if (!STORY._cw || !STORY._ch || cv.width !== STORY._cw || cv.height !== STORY._ch) storyResize();
    const g = cv.getContext('2d');
    const w = STORY._cw || cv.width, h = STORY._ch || cv.height;
    storyClampCam(w, h);
    g.clearRect(0, 0, w, h);
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#03080f'; g.fillRect(0, 0, w, h);   // hologram zemini (uzay/deniz karası)
    markRenderLayer('setup');
    const z = storyCam.zoom;
    // (1) TERRAIN tabanı — 2.5D warp'lı şerit-blit (gerçek kıyı çizgileri yatık düşer)
    const terr = storyEnsureTerrainCache();
    storyBlitWarp(g, terr);
    markRenderLayer('terrain');
    // Civilization-style V2 surface. The high-resolution atlas is composed
    // once in canonical world space; zoom only samples it and never rebuilds
    // an additional screen-sized ground layer.
    if (typeof storyMapV2Enabled === 'function' && storyMapV2Enabled()
        && typeof storyMapV2DrawHexNaturalContents === 'function') {
        storyMapV2DrawHexNaturalContents(g);
    }
    markRenderLayer('hexSurface');
    // (2) DİNAMİK POLİTİK katman (sahip-rengi yarı-saydam) — warp'lı; fetihte renk anında değişir
    const ovl = storyEnsureOwnerOverlay();
    storyBlitWarp(g, ovl);
    markRenderLayer('political');
    if (typeof storyMapV2Enabled === 'function' && storyMapV2Enabled()
        && typeof storyDrawHexPoliticalBorders === 'function') storyDrawPoliticalBorderLayer(g);
    markRenderLayer('politicalBorders');
    // Canonical coastline is intentionally live and screen-space. It is
    // derived from the same land mask as terrain/politics, so zoom can change
    // stroke weight without letting either layer drift into the sea.
    if (typeof storyMapV2Enabled === 'function' && storyMapV2Enabled()
        && typeof storyMapV2DrawCoastline === 'function') storyMapV2DrawCoastline(g);
    markRenderLayer('coastline');
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
    storyDrawHexGridOverlay(g, mapZoomRatio);
    storyDrawNetworkLayer(g, farMap);
    markRenderLayer('hexAndNetworks');
    // Hareketli sevkiyatlar ayrı şeffaf canvas'ta 60 Hz çizilir. Burada çizmek
    // her 0,25 sn konum değişiminde tüm statik haritayı tekrar birleştiriyordu.
    markRenderLayer('transportAgents');
    // (3) Kaynak işaretleri — uzak görünümde gizlenir; stratejik harita şehir
    // atlası ve önemli etiketlerle okunur, debug noktalarıyla değil.
    if ((typeof storyMapV2Enabled !== 'function' || !storyMapV2Enabled())
        && typeof STORY_TERRAIN !== 'undefined') {
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
    const urbanModel = typeof storyHexUrbanFootprintsEnsure === 'function'
        ? storyHexUrbanFootprintsEnsure() : null;
    const physicalSitesModel = typeof storyHexSitesEnsure === 'function'
        ? storyHexSitesEnsure() : null;
    const settlementLayerKey = storySettlementLayerKey(
        farMap, mapZoomRatio, w, h, cmdNode, adj,
        urbanModel && urbanModel.sourceHash,
        physicalSitesModel && physicalSitesModel.sourceHash
    );
    // Şehirler artık kamera bölgesine bağlı ekran canvas'ına yeniden çizilmez.
    // Her şehir/ilçe kompozisyonu küçük bir RAM bitmap'idir; kamera yalnız hazır
    // bitmap'i taşır. Böylece fare bırakma, bucket veya zoom değişimi şehir
    // üretimi tetiklemez.
    if (STORY._settlementLayerCanvas) {
        STORY._settlementLayerCanvas.width = 1;
        STORY._settlementLayerCanvas.height = 1;
        STORY._settlementLayerCanvas = null;
    }
    const settlementWorldLayers = storySettlementWorldLayersEnsure(
        urbanModel, physicalSitesModel
    );
    const settlementWorldBuildsBefore = settlementWorldLayers
        ? settlementWorldLayers.builds : 0;
    const settlementFrameStarted = typeof performance !== 'undefined' && performance.now
        ? performance.now() : Date.now();
    const settlementG = g;
    const labelBoxes = [];
    const visibleSettlementNodeIds = [];
    const settlementWorldPositions = settlementWorldLayers
        && settlementWorldLayers.layers
        && (settlementWorldLayers.layers.CORE || settlementWorldLayers.layers.DISTRICTS)
        && (settlementWorldLayers.layers.CORE || settlementWorldLayers.layers.DISTRICTS).worldPositions;

    // KOMUTANIN ulaşabildiği komşu bağlantıları (yeşil=kendi bölge, kırmızı=saldırı) — sade
    const cmdWorldPosition = settlementWorldPositions
        && settlementWorldPositions[cmdNode];
    const cmdP = storyNode(cmdNode)
        ? (cmdWorldPosition
            ? storyW2S(cmdWorldPosition.x, cmdWorldPosition.y)
            : storyNodePixel(storyNode(cmdNode), w, h)) : null;
    if (cmdP) {
        g.save();
        g.setLineDash(farMap ? [2, 7] : [3, 9]);
        g.lineWidth = farMap ? .65 : .75;
        for (const mId of adj) {
            const m = storyNode(mId);
            const mWorldPosition = settlementWorldPositions
                && settlementWorldPositions[mId];
            const b = mWorldPosition
                ? storyW2S(mWorldPosition.x, mWorldPosition.y)
                : storyNodePixel(m, w, h);
            g.strokeStyle = (m.owner === STORY.playerStateId) ? 'rgba(120,235,160,0.16)' : 'rgba(255,90,90,0.22)';
            g.beginPath(); g.moveTo(cmdP.x, cmdP.y); g.lineTo(b.x, b.y); g.stroke();
        }
        g.restore();
    }
    const settlementWorldDrawStarted = typeof performance !== 'undefined' && performance.now
        ? performance.now() : Date.now();
    const activeSettlementWorldLayer = storyDrawSettlementWorldLayer(
        g, settlementWorldLayers, mapZoomRatio
    );
    storyDrawPhysicalConstructionSites(g, physicalSitesModel, mapZoomRatio);
    if (!STORY._mapInteracting) {
        storyMapStructurePickRegistryRefresh(urbanModel, physicalSitesModel, mapZoomRatio);
    }
    const settlementWorldDrawFinished = typeof performance !== 'undefined' && performance.now
        ? performance.now() : Date.now();
    const settlementOverlayStarted = settlementWorldDrawFinished;

    // DÜĞÜMLER
    const _labelWidthCache = STORY._labelWidthCache || (STORY._labelWidthCache = new Map());
    for (const n of STORY.nodes) {
        const cachedWorldPosition = activeSettlementWorldLayer
            && activeSettlementWorldLayer.layer.worldPositions[n.id];
        const p = cachedWorldPosition
            ? storyW2S(cachedWorldPosition.x, cachedWorldPosition.y)
            : storyNodePixel(n, w, h);
        if (p.u < -0.08 || p.u > 1.08 || p.x < -120 || p.x > w + 120
            || p.y < -120 || p.y > h + 120) continue;
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
        let px = Math.round(p.x), py = Math.round(p.y);
        const visualLevel = Math.max(1, Math.min(3, Number(n.level) || 1));
        const settlementWorldSize = visualLevel >= 3 ? 22 : (visualLevel === 2 ? 14 : 8);
        const settlementSize = Math.max(4, farMap ? (visualLevel >= 3 ? 14 : 10) : settlementWorldSize * z);
        const settlementHalf = Math.max(3, settlementSize * .31);
        const visualWorld = activeSettlementWorldLayer
            && activeSettlementWorldLayer.layer.visualPositions[n.id];
        const visualPoint = visualWorld
            ? storyW2S(visualWorld.x, visualWorld.y) : p;
        if (Number.isFinite(visualPoint.x) && Number.isFinite(visualPoint.y)) {
            px = Math.round(visualPoint.x);
            py = Math.round(visualPoint.y);
        }
        visibleSettlementNodeIds.push(n.id);
        const markerHalf = Math.max(3, Math.round(settlementHalf));
        if (settlementSize >= 8) {
            const ownerHalf = Math.max(3, Math.round(settlementHalf * .82));
            settlementG.fillStyle = '#090b08'; settlementG.fillRect(px - ownerHalf - 1, py + 1, ownerHalf * 2 + 2, 3);
            settlementG.fillStyle = st ? st.color : '#888'; settlementG.fillRect(px - ownerHalf, py + 2, ownerHalf * 2, 1);
        }
        // ── DESIGN İKONLARI: fabrika bacası / petrol kulesi / maden kazması / kışla flaması ──
        // Yakınlaşınca ya da büyük şehirlerde göster (uzak/küçük şehirde kalabalık yapmasın).
        const detail = !farMap && mapZoomRatio >= 7.5
            && ((n.level || 1) >= 2 || settlementSize >= 28);
        if (detail && p.u > -0.05 && p.u < 1.05 && px > -30 && px < w + 30) {
            const ic = Math.max(0.7, sc);
            if ((n.fac | 0) > 0) {                          // FABRİKA: gövde + baca sayısı = seviye
                const fx = px + markerHalf + 2, fy = py - 2;
                settlementG.fillStyle = 'rgba(0,0,0,.7)'; settlementG.fillRect(fx - 1, fy - 6 * ic, 10 * ic, 7 * ic);
                settlementG.fillStyle = '#c8b070'; settlementG.fillRect(fx, fy - 5 * ic, 8 * ic, 5.5 * ic);
                for (let k = 0; k < Math.min(n.fac | 0, 3); k++) { settlementG.fillStyle = '#c8b070'; settlementG.fillRect(fx + (1 + k * 3) * ic, fy - 9 * ic, 2 * ic, 4 * ic); settlementG.fillStyle = '#ffb000'; settlementG.fillRect(fx + (1 + k * 3) * ic, fy - 10 * ic, 2 * ic, 1.4 * ic); }
            }
            if (n.oil) {                                    // PETROL: turuncu kule üçgeni
                const ox = px - markerHalf - 4 * ic, oy = py - 2;
                settlementG.strokeStyle = '#ff8a00'; settlementG.lineWidth = 1.4;
                settlementG.beginPath(); settlementG.moveTo(ox - 4 * ic, oy + 4 * ic); settlementG.lineTo(ox, oy - 6 * ic); settlementG.lineTo(ox + 4 * ic, oy + 4 * ic); settlementG.stroke();
                settlementG.fillStyle = '#ff8a00'; settlementG.fillRect(ox - 1.5, oy - 7 * ic, 3, 3);
            }
            if (n.mine) {                                   // MADEN (puan): yeşil çapraz kazma
                const mx = px - markerHalf - (n.oil ? 13 : 4) * ic, my = py - 2;
                settlementG.strokeStyle = '#3cdc6e'; settlementG.lineWidth = 1.6;
                settlementG.beginPath(); settlementG.moveTo(mx - 4 * ic, my - 4 * ic); settlementG.lineTo(mx + 4 * ic, my + 4 * ic); settlementG.moveTo(mx + 4 * ic, my - 4 * ic); settlementG.lineTo(mx - 4 * ic, my + 4 * ic); settlementG.stroke();
                settlementG.fillStyle = '#3cdc6e'; settlementG.fillRect(mx - 1.5, my - 1.5, 3, 3);
            }
            if ((n.bar | 0) > 0) {                          // KIŞLA: yeşil flama
                const kx = px + markerHalf + 2, ky = py + 5 * ic;
                settlementG.strokeStyle = '#4ade80'; settlementG.lineWidth = 1.2;
                settlementG.beginPath(); settlementG.moveTo(kx, ky + 5 * ic); settlementG.lineTo(kx, ky - 4 * ic); settlementG.stroke();
                settlementG.fillStyle = '#4ade80'; settlementG.beginPath(); settlementG.moveTo(kx, ky - 4 * ic); settlementG.lineTo(kx + 6 * ic, ky - 2.2 * ic); settlementG.lineTo(kx, ky - 0.5 * ic); settlementG.closePath(); settlementG.fill();
            }
        }
        // saldırılabilir → kırmızı nabız kare-halka ; ilerlenebilir → yeşil kare-halka
        if (moveable) {
            settlementG.strokeStyle = 'rgba(120,235,160,0.75)'; settlementG.lineWidth = 2;
            settlementG.strokeRect(px - markerHalf - 3, py - markerHalf - 3,
                2 * (markerHalf + 3), 2 * (markerHalf + 3));
        }
        if (isSelected) {
            const r = markerHalf + 6;
            const lift = Math.round(settlementSize * .20);
            settlementG.strokeStyle = '#ffb000'; settlementG.lineWidth = 2;
            settlementG.strokeRect(px - r, py - r - lift, r * 2, r * 2);
        }
        // Referans-stili stratejik şehir etiketi. Sadece final ekran uzayında çizilir;
        // böylece terrain/politik katman altında kaybolmaz ve zoom ile okunur kalır.
        const labelEligible = (n.level || 1) >= 2
            || settlementSize >= 26
            || isSelected || attackable || moveable;
        if (labelEligible) {
            const label = n._upperName || (n._upperName = String(n.name || '').toLocaleUpperCase('tr-TR'));
            const labelSize = storyMapLabelFontSize(n, farMap, w, h);
            const cacheKey = label + ':' + labelSize;
            let tw = _labelWidthCache.get(cacheKey);
            if (tw == null) {
                settlementG.font = `bold ${labelSize}px monospace`;
                tw = Math.ceil(settlementG.measureText(label).width);
                _labelWidthCache.set(cacheKey, tw);
            }
            const lh = labelSize + 3;
            const spriteFoot = Math.round(settlementSize * .30);
            const bx = px - Math.round(tw / 2) - 3, by = py + spriteFoot + 4;
            const box = { x: bx, y: by, w: tw + 6, h: lh };
            if (!labelBoxes.some(p => box.x < p.x + p.w + 3 && box.x + box.w + 3 > p.x
                && box.y < p.y + p.h + 2 && box.y + box.h + 2 > p.y)) {
                labelBoxes.push(box);
                settlementG.font = `bold ${labelSize}px monospace`; settlementG.textAlign = 'left'; settlementG.textBaseline = 'middle';
                settlementG.fillStyle = 'rgba(7,13,10,.88)'; settlementG.fillRect(box.x, box.y, box.w, box.h);
                settlementG.strokeStyle = (n.level || 1) >= 3 ? '#e0bd54' : 'rgba(142,164,122,.9)'; settlementG.lineWidth = 1;
                settlementG.strokeRect(box.x + .5, box.y + .5, box.w - 1, box.h - 1);
                settlementG.fillStyle = st ? st.color : '#9aa58c'; settlementG.fillRect(box.x + 1, box.y + 1, 2, box.h - 2);
                settlementG.fillStyle = '#e7dfbd'; settlementG.fillText(label, box.x + 4, box.y + box.h / 2 + .5);
            }
        }
    }
    const settlementFrameFinished = typeof performance !== 'undefined' && performance.now
        ? performance.now() : Date.now();
    const newSpriteBuilds = settlementWorldLayers
        ? settlementWorldLayers.builds - settlementWorldBuildsBefore : 0;
    STORY._settlementLayerKey = settlementLayerKey;
    STORY._settlementLayerView = storyScreenLayerViewSnapshot();
    STORY._settlementLayerDiagnostics = {
        adapterVersion: 'settlement-world-bitmap-tiles-1',
        width: w,
        height: h,
        farMap: !!farMap,
        visibleLabelCount: labelBoxes.length,
        visibleSettlementCount: visibleSettlementNodeIds.length,
        persistentSpriteCount: settlementWorldLayers ? 2 : 0,
        persistentSpriteBuilds: settlementWorldLayers ? settlementWorldLayers.builds : 0,
        persistentSpriteHits: settlementWorldLayers ? settlementWorldLayers.hits : 0,
        persistentBuildSerial: settlementWorldLayers ? settlementWorldLayers.buildSerial : 0,
        estimatedSpriteBytes: settlementWorldLayers ? settlementWorldLayers.estimatedBytes : 0,
        worldLayerMode: activeSettlementWorldLayer && activeSettlementWorldLayer.mode || null,
        worldLayerDrawnTiles: activeSettlementWorldLayer
            ? activeSettlementWorldLayer.drawnTileCount : 0,
        worldLayerBitmapReady: activeSettlementWorldLayer
            ? activeSettlementWorldLayer.bitmapReadyCount : 0,
        newSpriteBuilds,
        buildMs: newSpriteBuilds ? settlementFrameFinished - settlementFrameStarted : 0,
        drawMs: settlementFrameFinished - settlementFrameStarted,
        worldDrawMs: settlementWorldDrawFinished - settlementWorldDrawStarted,
        overlayDrawMs: settlementFrameFinished - settlementOverlayStarted,
        reusedInteraction: !!STORY._mapInteracting,
        rebuiltForInteraction: false,
        reusedCameraTransform: false,
        liveIncomingCount: visibleSettlementNodeIds.length,
        liveIncomingNodeIds: visibleSettlementNodeIds,
        liveIncomingTiming: { totalMs: 0, metricMs: 0, paintMs: 0, textMs: 0 }
    };
    // Attack rings stay live while the expensive settlement atlas remains cached.
    const visualSeconds = Number.isFinite(STORY._lastFrameT)
        ? STORY._lastFrameT / 1000 : STORY.clock;
    for (const nodeId of adj) {
        const n = storyNode(nodeId);
        if (!n || n.owner === STORY.playerStateId) continue;
        const attackWorldPosition = settlementWorldPositions
            && settlementWorldPositions[nodeId];
        const p = attackWorldPosition
            ? storyW2S(attackWorldPosition.x, attackWorldPosition.y)
            : storyNodePixel(n, w, h);
        if (p.u < -0.08 || p.u > 1.08 || p.x < -80 || p.x > w + 80
            || p.y < -80 || p.y > h + 80) continue;
        const metrics = typeof storyMapV2SettlementMetrics === 'function'
            ? storyMapV2SettlementMetrics(n, {
                cam: storyCam, minZoom: STORY._minZoom || storyCam.zoom,
                actionable: true
            })
            : { half: farMap ? 4 : 7 };
        const markerHalf = Math.max(3, Math.round(metrics.half || 4));
        const pulse = Math.round(3 + 2 * (1 + Math.sin(visualSeconds * 4 + n.id)));
        g.strokeStyle = 'rgba(255,70,70,0.95)'; g.lineWidth = 2;
        g.strokeRect(Math.round(p.x) - markerHalf - pulse,
            Math.round(p.y) - markerHalf - pulse,
            2 * (markerHalf + pulse), 2 * (markerHalf + pulse));
    }
    markRenderLayer('settlements');
    // FAZ-2: TÜM KOMUTANLARI çiz (devlet-renkli küçük token, şehrin üstünde dizili)
    // KUŞATMA göstergesi: kuşatılan şehirde kırmızı çift-halka + terminal etiketi
    const commanderLayerKey = storyCommanderLayerKey(
        settlementLayerKey, farMap, cmdNode, adj
    );
    let commanderLayer = STORY._commanderLayerCanvas;
    if (!commanderLayer || commanderLayer.width !== w || commanderLayer.height !== h) {
        commanderLayer = document.createElement('canvas');
        commanderLayer.width = w;
        commanderLayer.height = h;
        STORY._commanderLayerCanvas = commanderLayer;
        STORY._commanderLayerKey = null;
    }
    const commanderLayerInteractionReuse = !!(STORY._mapInteracting && STORY._commanderLayerKey);
    const commanderLayerRebuild = !commanderLayerInteractionReuse
        && STORY._commanderLayerKey !== commanderLayerKey;
    const commanderLayerStarted = commanderLayerRebuild
        ? (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) : 0;
    const commanderG = commanderLayer.getContext('2d');
    if (commanderLayerRebuild) {
        commanderG.clearRect(0, 0, w, h);
        commanderG.imageSmoothingEnabled = false;
    }
    if (commanderLayerRebuild) for (const node of STORY.nodes) {
        if (!node._siege) continue;
        const sp = storyNodePixel(node);
        commanderG.lineWidth = 2; commanderG.strokeStyle = 'rgba(255,80,40,0.95)';
        commanderG.beginPath(); commanderG.arc(sp.x, sp.y, 10, 0, Math.PI * 2); commanderG.stroke();
        commanderG.strokeStyle = 'rgba(255,80,40,0.45)';
        commanderG.beginPath(); commanderG.arc(sp.x, sp.y, 14, 0, Math.PI * 2); commanderG.stroke();
        commanderG.font = '8px monospace'; commanderG.textAlign = 'center'; commanderG.fillStyle = '#ffce4c';
        commanderG.fillText('SIEGE', sp.x, sp.y - 17);
    }
    const cmdByCity = {};
    if (commanderLayerRebuild && !farMap) for (const st of STORY.states) for (const c of (st.gov && st.gov.commanders ? st.gov.commanders : [])) { if (c.node == null || !storyNode(c.node)) continue; (cmdByCity[c.node] = cmdByCity[c.node] || []).push(st.id); }
    if (commanderLayerRebuild && !farMap) for (const cityId in cmdByCity) {
        const node = storyNode(+cityId); if (!node) continue;
        const cp = storyNodePixel(node); const list = cmdByCity[cityId];
        if (cp.u < -0.05 || cp.u > 1.05 || cp.x < -40 || cp.x > w + 40
            || cp.y < -40 || cp.y > h + 40) continue;
        // Overview uses city art, not a second carpet of military triangles.
        // Regional/local views reveal only the commander's current tactical
        // neighborhood and cap stacked tokens to keep the settlement legible.
        const cityNumber = +cityId;
        if (cityNumber === cmdNode || (cityNumber !== STORY.selectedNodeId
            && adj.indexOf(cityNumber) < 0)) continue;
        const visibleCount = Math.min(3, list.length);
        const cityMetrics = typeof storyMapV2SettlementMetrics === 'function'
            ? storyMapV2SettlementMetrics(node, { cam: storyCam, minZoom: STORY._minZoom || storyCam.zoom })
            : { half: 8 };
        for (let i = 0; i < visibleCount; i++) {
            const token = 3;
            const cx = Math.round(cp.x + (i - (visibleCount - 1) / 2) * 6);
            const cy = Math.round(cp.y - Math.max(9, (cityMetrics.half || 8) + 7));
            commanderG.beginPath(); commanderG.moveTo(cx, cy - token); commanderG.lineTo(cx - token, cy + token); commanderG.lineTo(cx + token, cy + token); commanderG.closePath();
            commanderG.fillStyle = (storyState(list[i]) || {}).color || '#fff'; commanderG.fill();
            commanderG.lineWidth = 1; commanderG.strokeStyle = '#000'; commanderG.stroke();
        }
    }
    if (commanderLayerRebuild) {
        const commanderLayerFinished = typeof performance !== 'undefined' && performance.now
            ? performance.now() : Date.now();
        STORY._commanderLayerKey = commanderLayerKey;
        STORY._commanderLayerView = storyScreenLayerViewSnapshot();
        STORY._commanderLayerDiagnostics = {
            adapterVersion: 'commander-screen-layer-1',
            width: w, height: h, farMap: !!farMap,
            buildMs: commanderLayerFinished - commanderLayerStarted,
            reusedInteraction: false,
            rebuiltForInteraction: !!STORY._mapInteracting
        };
    } else if (STORY._commanderLayerDiagnostics) {
        STORY._commanderLayerDiagnostics.buildMs = 0;
        STORY._commanderLayerDiagnostics.reusedInteraction = commanderLayerInteractionReuse;
        STORY._commanderLayerDiagnostics.reusedCameraTransform = true;
    }
    storyDrawScreenLayerForCamera(g, commanderLayer, STORY._commanderLayerView);
    // KONSEY: tıklanan komutanın şehrinde yeşil nabız halka (~1.5sn, 30 kare)
    if (STORY._pulse > 0 && STORY._pulseNode != null) {
        const pn = storyNode(STORY._pulseNode);
        if (pn) { const pp = storyNodePixel(pn), t = STORY._pulse / 30, r = 14 + (1 - t) * 24;
            g.strokeStyle = `rgba(76,255,124,${(t * 0.9).toFixed(2)})`; g.lineWidth = 3;
            g.beginPath(); g.arc(pp.x, pp.y, r, 0, Math.PI * 2); g.stroke(); }
        STORY._pulse--;
    }
    markRenderLayer('commanders');
    STORY._renderLayerTimings = Object.assign(renderLayers, {
        total: renderClock() - renderStarted,
        zoomRatio: typeof mapZoomRatio === 'number' ? mapZoomRatio : null
    });
}
