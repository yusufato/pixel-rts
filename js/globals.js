// ═══════════════════════════════════════════════════════════════
//  PIXEL RTS – TAKTİKSEL SAVAŞ (Savaş Sisi, Etki Haritası)
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
// Sprite sayfası yüklenmediyse drawImage "broken state" hatası atar ve oyun
// döngüsünü komple öldürür. (Paketlemede icons.png unutulunca savaş açılışında
// tam olarak bu oldu.) Tek noktadan kontrol: eksikse çizim atlanır, oyun yaşar.
function spriteReady() {
    return !!(spriteSheet && spriteSheet.complete && spriteSheet.naturalWidth > 0);
}
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
const WORLD_W = 5100;   // 1.5x büyütüldü (3400→5100) — daha çok manevra alanı; GRID sabit (150×100) → terrain/köprüler otomatik ölçeklenir, birim boyu aynı
const WORLD_H = 3450;   // 2300→3450

// DESIGN v2 "Gerçekçi Arena": 5 yeni tip. Eski 0-4 DEĞİŞMEDİ (kayıt/MP uyumu).
// Yeni tipler render + geçilmezlik maskesinden türetilir; sim'in tek girdisi
// terrainFeatures LOS ve örtü hesapları için korunur.
const TERRAIN = { NONE: 0, FOREST: 1, MOUNTAIN: 2, HILL: 3, WATER: 4, MARSH: 5, ROCK: 6, URBAN: 7, FIELD: 8, ROAD: 9 };
// ── SİMETRİK 3-MEVZİ HARİTASI ──
// 3 kontrol noktası (orta hat: x=880/1700/2520, y=1150) birer AÇIK güçlü-mevzi; etrafları
// araziyle çerçeveli. Kuzey-güney AYNA simetrik (her iki taraf için adil). Dağlar=geçit/görüş
// engeli, ormanlar=kanat örtüsü. Noktalar araziden açık (otomatik doğrulandı).
// 10-HARİTA SİSTEMİ: terrainFeatures artık BOŞ başlar, MapData.js'teki applyMap(id)
// ile IN-PLACE doldurulur (length=0 + push → 8 dosyadaki canlı-dizi okumaları KIRILMAZ).
let terrainFeatures = [];
let DEBUG_TERRAIN = false;   // grid-harita teşhis overlay'i (sorun çözüldü → kapalı)

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
    tick: 0,                      // deterministik sim-saati — maç başında sıfırlanır
    headless: false,              // true = render-only VFX hesaplanmaz
};
const SIM_RNG = SIM.rng;        // geri-uyumluluk aliası: mevcut SIM_RNG.state okuma/yazmaları SIM.rng'ye düşer

// HIZLI MAÇ AYARLARI (Screens.js maç başında yazar, BattleRules/Commander okur)
// attackerSide: true = KIRMIZI saldırır; false = MAVİ saldırır.
// Saldıran süre dolmadan kırmak zorunda, savunan süreyi tüketirse kazanır.
let QUICK_MATCH_ATTACKER_SIDE = false;
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

// Bir haritanın orman ağaçlarını + dağ tepelerini üretir (applyMap çağırır). Eskiden
// yükleme-anı döngüsüydü; artık fonksiyon → her harita değişiminde yeniden süslenir.
function decorateTerrain(features) {
    for (const t of features) {
        if (t.type === TERRAIN.FOREST) {
            // Organik kenar poligonu (görsel; gameplay daire kalır)
            const FN = 16;
            t.orgPoly = [];
            for (let k = 0; k < FN; k++) {
                const ang = (k / FN) * Math.PI * 2;
                const r = t.r * (0.78 + seededRandom(t.seed * 71 + k * 13) * 0.44);
                t.orgPoly.push({ dx: Math.cos(ang) * r, dy: Math.sin(ang) * r });
            }
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
            // Organik kenar poligonu (görsel)
            const MN = 14;
            t.orgPoly = [];
            for (let k = 0; k < MN; k++) {
                const ang = (k / MN) * Math.PI * 2;
                const r = t.r * (0.80 + seededRandom(t.seed * 83 + k * 17) * 0.44);
                t.orgPoly.push({ dx: Math.cos(ang) * r, dy: Math.sin(ang) * r });
            }
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
}

const camera = { x: 0, y: 0 };
let zoom = 1.0;
// Simülasyonun akış hızı. Hem birim hareketini hem sim-saatini ölçekler, bu yüzden
// düşürmek dengeyi bozmaz: her şey (hareket, atış hızı, savaş süresi) aynı oranda yavaşlar,
// oyuncuya emir vermek için daha çok gerçek zaman kalır.
const GAME_SPEED = 1.0;
const ZOOM_MIN = 0.35;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.08;
const CAM_SPEED = 8;   // kamera kaydırma GAME_SPEED'den bağımsız tutulur (ayrı ayarlanabilsin)
const EDGE_SCROLL_ZONE = 40;
const keys = {};

// ── TRAUMA-tabanlı ekran sarsıntısı + darbe-donması + knockback (HEPSİ render-only; SIM'e GİRMEZ) ──
let screenShake = 0;            // TRAUMA değeri (0..SHAKE_MAX); worldToScreen'de trauma² uygulanır → tüfek≠nuke
let hitStopVisualMs = 0;        // yalnız sunum; savaş simülasyonunu asla durdurmaz
const SHAKE_MAX = 1.25;         // tavan trauma
const SHAKE_MAX_PX = 9;         // tam trauma'da max piksel kayma
function triggerScreenShake(amount) {
    if (typeof SIM !== 'undefined' && SIM.headless) return;
    screenShake = Math.min(SHAKE_MAX, screenShake + amount);   // biriktir (capped)
}
// Darbe-donması yalnız görsel sunum verisidir. Render/FPS savaş sonucunu değiştiremez.
function triggerHitStop(frames) {
    if (typeof SIM !== 'undefined' && SIM.headless) return;
    hitStopVisualMs = Math.max(hitStopVisualMs, Math.max(0, frames) * (1000 / 60));
}
// Knockback/recoil: SADECE görsel ofset (this.x/y'ye DOKUNMAZ → sim/determinizm/MP korunur)
function applyKnockback(t, srcX, srcY, amt) {
    if (typeof SIM !== 'undefined' && SIM.headless) return;
    const dx = t.x - srcX, dy = t.y - srcY;
    const d = Math.hypot(dx, dy) || 1;
    t.voffX = (t.voffX || 0) + (dx / d) * amt;
    t.voffY = (t.voffY || 0) + (dy / d) * amt;
    const m = Math.hypot(t.voffX, t.voffY);
    if (m > 7) { t.voffX *= 7 / m; t.voffY *= 7 / m; }         // tavan
}
// ── Subtle AUTO-KAMERA: belirleyici anda slow-mo + hafif zoom (tek-oyunculu; kamera-ele-geçirme YOK) ──
let timeScale = 1.0, cinemaZoom = 1.0, cinemaTimer = 0, cinemaCooldown = 0;
const CINEMA_DUR = 0.5;          // saniye (gerçek)
function triggerCinematic() {
    if (typeof SIM !== 'undefined' && SIM.headless) return;
    if (typeof MP !== 'undefined' && MP.active) return;
    if (cinemaCooldown > 0 || cinemaTimer > 0) return;
    cinemaTimer = CINEMA_DUR;
    cinemaCooldown = 5.0;        // seyrek tetikle → "özel" kalsın
}
function updateCinematic(dt) {
    if (cinemaCooldown > 0) cinemaCooldown -= dt;
    if (cinemaTimer > 0) {
        cinemaTimer -= dt;
        const e = Math.max(0, cinemaTimer / CINEMA_DUR);   // 1→0 (tetikte en güçlü, sonra söner)
        timeScale = 1 - 0.65 * e;                          // yalnız sunum değeri; simülasyon saatini etkilemez
        cinemaZoom = 1 + 0.14 * e;                         // 1.14 zoom → 1.0
    } else { timeScale = 1; cinemaZoom = 1; }
}

// Bastırma eşiği: bu üstünde birim PINNED (yere yatar, ilerleyemez, çok nadir ateş eder)
const PINNED_SUPPRESSION = 80;
// T3 PUSU: ormandaki birlik ateş edene kadar gizli → sadece yakından fark edilir; ateş edince açığa çıkar; ilk atış sürpriz bonusu
const AMBUSH_DETECT = 170;          // gizli orman birimi bu mesafeden yakın düşmanca fark edilir
const AMBUSH_REVEAL_TICKS = 150;    // ateş sonrası açıkta kalma (update başına GAME_SPEED düşer)
const AMBUSH_DMG_MULT = 1.45;       // gizliyken yapılan ilk atış sürpriz hasarı

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

// Fare olayını canvas'ın ÇİZİM (bitmap) uzayına çevirir.
// Şart: canvas'ın CSS boyutu bitmap boyutundan farklı olabiliyor — deploy fazında sağ panel
// için canvas 330px daraltılıyor (style.css). Ham e.clientX kullanılırsa tıklama ile birimin
// gerçekten konduğu yer arasında, sağa gidildikçe büyüyen bir kayma oluşur. Tüm fare
// okumaları bu fonksiyondan geçmeli; çizim kodu zaten bitmap uzayında çalışır.
function canvasPoint(e) {
    const r = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - r.left) * (canvas.width / (r.width || canvas.width)),
        y: (e.clientY - r.top) * (canvas.height / (r.height || canvas.height))
    };
}
function worldToScreen(wx, wy) {
    let shakeX = 0, shakeY = 0;
    if (screenShake > 0) {
        const s = screenShake * screenShake;                  // trauma² → küçük olay belli, büyük olay SLAM
        shakeX = (Math.random() - 0.5) * 2 * SHAKE_MAX_PX * s;
        shakeY = (Math.random() - 0.5) * 2 * SHAKE_MAX_PX * s;
    }
    return {
        x: (wx - camera.x) * zoom + shakeX,
        y: (wy - camera.y) * zoom + shakeY
    };
}

const SP_W = 320, SP_H = 320, SP_PAD = 30;   // yeni 25-sütun icons.png: hücre 320×320, pad 30 (8780×730; sx=30+type×350, sy kırmızı=380)
// SPRITE-SÜTUN: icons.png yalnız 25-sütun (indeks 0-24). 25+ eklenen birim mevcut bir sprite'a eşlenir → boş-ikon olmaz.
// drone_operator(25) → kamikaze-drone(18) ikonu (redesign: operatör kamikazenin yerini aldı → eski drone-görünümü kalsın).
function battleSpriteCol(type) {
    if (typeof T !== 'undefined' && type === T.DRONE_OPERATOR && T.KAMIKAZE != null) return T.KAMIKAZE;
    return type;
}
const BASE_DRAW_SCALE = 0.20;
const BASE_DRAW_W = SP_W * BASE_DRAW_SCALE;
const BASE_DRAW_H = SP_H * BASE_DRAW_SCALE;
const UNIT_RADIUS = Math.max(BASE_DRAW_W, BASE_DRAW_H) / 2;

// ── BİRİM YÖNELİMİ (render-only; sim facingAngle'ı zaten hesaplıyor → eğitim/MP etkilenmez) ──
const UNIT_ROTATE = true;            // tüm sprite facing yönüne döner (hedefe "düz" bakar)
const UNIT_FACE_OFFSET = Math.PI / 2;// ÖN = dikdörtgenin UZUN kenarı (geniş cephe öne); kısa-kenar-ön istersen 0 yap
const UNIT_TURN_SMOOTH = 0.5;        // GLOBAL dönüş hız çarpanı (hepsini topluca ayarla; 0.5 = yarı hız) — kullanıcı isteği: dönüş çok hızlıydı, yarıya indirildi
// KONSANTRASYON: AI kuvvetini sektörlere BÖLMEK yerine TEK kütlede yığar + rezervi minimuma indirir → odaklı-ateşle
// yerel üstünlük (insanın kazanma tarzı). ÖLÇÜLDÜ: savunmada -980→-327, saldırıda +15→+620, normal rakipte regresyon yok.
// Dağılım AI'nın asıl zaafıydı; bu onu her senaryoda dramatik güçlendirir. false = eski dağıtan davranış.
let BATTLE_FORCE_CONCENTRATE = true;
// SEKTÖR-KOMUTA (anti-blob): cepheyi sektörlere böl + her gruba sorumluluk-alanı+sınır, ana-çabayı bir sektöre yoğunlaştır,
// ihtiyatı kutsal tut. AÇIKKEN CONCENTRATE'in tek-kütle/tek-hedef davranışını sektör-katmanıyla değiştirir (fazlı, ölçüm-güdümlü).
// A/B KANITLANDI (düşman-uyarlamalı): saldıran 2/3→3/3, dağılım +%52, determinizm korundu → VARSAYILAN AÇIK + version bump.
let BATTLE_SECTOR_COMMAND = true;
// TARAF-BAŞI SEKTÖR-KOMUTA (null = global değeri kullan). GEREKÇE: kuvvet-dağılımı ölçümü
// (tools/kuvvet-dagilim-teshis.js) sektör-komutayı A/B'ye sokamadı çünkü bayrak GLOBAL —
// kapatınca İKİ taraf birden bloblaşıyor ve fark hangi tarafa ait bilinemiyor. Diğer tüm
// beyin bayrakları (INTEL4/INTEL4PRO/BEONAI/RECIPE) zaten taraf-başı; bu da hizalandı.
let BATTLE_SECTOR_COMMAND_RED = null;
let BATTLE_SECTOR_COMMAND_BLUE = null;
function battleSectorCommand(isRed) {
    const o = isRed ? BATTLE_SECTOR_COMMAND_RED : BATTLE_SECTOR_COMMAND_BLUE;
    return o == null ? (typeof BATTLE_SECTOR_COMMAND !== 'undefined' && !!BATTLE_SECTOR_COMMAND) : !!o;
}
// PER-SIDE BEYİN-FLAG (intel4-delta kapısı): "selefini yenemeyen sürüm yayınlanmaz" metodolojisi. intel4-BEYİN-deltaları
// (şok-tetiği, karşı-batarya, kompozisyon-floor, SAM-koloc, sabırlı-örümcek + yeni: STRIKE-dwell, savunan-de-blob, helo-neşter,
// hava-unlock) YALNIZ ilgili tarafın flag'i AÇIKken devreye girer = intel4-beyni; KAPALI = intel3pro-beyni (selef). Motor
// (radar-2000/margin/6dk) İKİ TARAFTA da paylaşılır → --vstournament AYNI motorda intel3pro-vs-intel4 BEYİN-farkını ölçer.
// Yeni-fixler için default-false (snaptest byte-aynı doğrulanır); turnuvada bir taraf açık/diğer kapalı.
let BATTLE_INTEL4_RED = false;
let BATTLE_INTEL4_BLUE = false;
function battleBrainIntel4(isRed) { return isRed ? BATTLE_INTEL4_RED : BATTLE_INTEL4_BLUE; }
// PER-DELTA ABLATION: intel4-beyni açıkken hangi deltaların DEVREDE olduğunu süz. Default hepsi-true=tam-intel4.
// --ablation her deltayı TEK açıp intel3pro'ya karşı ölçer → yardım-eden tut, zarar-veren at. (Global; beyin-flag'i kapalı tarafı etkilemez.)
// profile: TEHDİT-PROFİLİ sistemi (default-FALSE → default-off byte-aynı; diğerleri default-true=tam-intel4).
const BATTLE_INTEL4_DELTAS = { stance: true, shock: true, deblob: true, helo: true, comp: true, micro: true, profile: false, drone: false, defense: false, backbone: false, range: false, attack: true };   // attack=ON (kullanıcı-kararı): saldıran dron AT-perdesini temizler → 2/6→6/6, DET ✓ (yalnız AI-hedefleme, hash-yapı değişmez)
function battleDelta(isRed, key) { return battleBrainIntel4(isRed) && BATTLE_INTEL4_DELTAS[key] !== false; }

// ─── INTEL4-PRO KATMANI ───────────────────────────────────────────────────────────────────────────
// intel4-pro = intel4 + aşağıdaki deltalar. intel4 MEZUN OLDU (intel3pro'yu geçti); pro artık intel4'e karşı ölçülür.
// Mezuniyet ölçütü (kullanıcı): 6 tohum × 2 rol = 12 maç, **≥%75 (9/12)** üstünlük → `--intel4pro`.
// Taraf-başı bayrak: bir maçta YALNIZ bir taraf pro olur (adil karşılaştırma). Varsayılan ikisi de kapalı.
const BATTLE_INTEL4PRO_DELTAS = {
    // P1: SAVUNAN MÜHİMMAT DİSİPLİNİ. An-be-an teşhis (docs/INTEL4PRO-AN-BE-AN-TESHIS.md): savunan ilk 50sn'de
    // uzak menzilden aşırı ateşle mühimmatını yarılıyor, atış hacmi 4× düşüyor (ordusunun %70'i sağken) ve
    // yaklaşan saldırganı durduramayıp siliniyor. Çare: yedek eşiğinin altında UZAK hedefe ateş etme.
    // 1. DENEME — ÖLÇÜLDÜ, ETKİSİZ (pro 6/12=%50). Eşik (%45) yanma penceresinden (0.85→0.61) SONRA açılıyordu.
    // Temiz ölçüm için VARSAYILAN KAPALI bırakıldı; indirectMassing tek başına sınanıyor.
    ammoDiscipline: false,
    // P1b: DOLAYLI ATEŞ KÜTLE-HEDEFLEMESİ. An-be-an teşhis: savunanın kuruyan birimleri YALNIZCA dolaylı ateş
    // (topçu 1 + havan 2-3 + ÇNRA 1) ve t=60'ta hepsi boş; saldıranda hiç kuru birim yok. Sebep: dolaylı ateş
    // EN YAKIN görülen düşmana atıyor ("splash zaten alan" varsayımı) → 3-8 mermilik şarjör tek gezen keşif
    // aracına harcanıyor. Çare: mermiyi patlama yarıçapındaki düşman KÜTLESİNE göre seç (mermi başına değer).
    indirectMassing: true,
    // P3: SALDIRI BÜTÜNLÜĞÜ (yoğunlaşma). Ölçüm: saldıran birim VURULDUĞU ANDA çevresindeki dost/düşman oranı
    // kazanan saldırılarda ~10.8, kaybedenlerde ~3.4 (t=60'ta r=0.748; sağkalım-yanlılığı testi geçildi).
    // Yani saldırı, yerel üstünlük kurabildiğinde kazanıyor. Kural: DESTEKSİZ İLERLEME YOK — yakınında yeterli
    // dost yoksa saldıran birim kapatmaz, menzilde bekler (kütle toplansın). deblob'u iptal etmez: yalnız
    // ana-çabanın ucundaki tekil ilerlemeyi keser ("ana-çabada yoğunlaş, gerisinde dağıl").
    assaultCohesion: true,
    // P4 (KULLANICI DOKTRİNİ): "toplu yürüyen saldırı, savunanın dolaylı ateşiyle yıpranır → önce karşılıklı dolaylı
    // atışla savunanın topçusunu sustur." SALDIRANIN dolaylı ateşi, düşmanın DOLAYLI birimlerini öncelikler
    // (karşı-batarya). NOT: korelasyon bunu doğrulaMADI (erken pencerede r=0.077) — ama hiçbir AI bu doktrini
    // uygulamadığı için korelasyon test EDEMEZ (tedavide varyans yok). Bu yüzden uygulanıp A/B ile sınanıyor.
    counterBattery: true,
    // P5 (KÖK NEDEN — docs/KUVVET-ORANI-HATASI.md): kuvvet-oranı istihbarat tabanı, AI'ın KENDİ başlangıç değeri
    // yerine DÜŞMANIN İLAN EDİLMİŞ BÜTÇESİNDEN kurulur. Eskiden t=0'da oran daima tam 1.00 çıkıyor ve yalnızca
    // düşüyordu → forceRatio fiilen "kendi sağkalım yüzdem" idi ve STRIKE kapısı savunan için ULAŞILAMAZDI.
    trueForceRatio: true,
    // P6 (kullanıcı gözlemi, --zonedrift ile doğrulandı): SAVUNAN kendi bölgesini tutar, düşman hattına
    // yürümez. Eski emir-hattı derinlik ~1.04 (orta hattın ötesi) idi → savunan hiç savunmuyordu.
    // MEKANİK ÇALIŞIYOR (orta hat geçişi 3/6 → 0/6) ama VARSAYILAN KAPALI: mevcut savunan ordusu yer TUTAMIYOR
    // (₺'sinin yalnız %0-30'u siperlenebiliyor → ort. entrench 0.17 → ~%6 hasar azalması; tek istihkâm; %30+ dolaylı).
    // Yer tutmak inisiyatifi verip karşılığında ~hiçbir şey kazandırmıyor: savunan 6/6 → 4/6.
    // AÇILMADAN ÖNCE GEREKEN: savunan-rolüne özgü SAVUNMA KOMPOZİSYONU (siperlenebilen piyade + istihkâm + AT).
    holdZone: false,
    // P7 — ÖLÜ-BÖLGE YÖNETİMİ (BECERİ AÇIĞI; kullanıcı: "balistik ile sonuncu olmak beceri ister").
    // TEŞHİS (tools/balistik-teshis.js, seed2024): balistik füze 1050₺ (bütçenin %16'sı) ile alındı ve
    // TEK ATIŞ bile yapmadan 125sn'de öldü. Mekanik SAĞLAM — sorun AI'ın birimi kullanamaması:
    // minRange 1500px, düşman 40sn'de içeri girip bir daha çıkmıyor, AI birimde `relocate` yeteneği
    // OLMASINA RAĞMEN geri çekmiyor. İnsan oyuncu standoff mesafesini korur. Genel sorun DEĞİL:
    // aynı maçta havan 14/26/25, topçu 23, ÇNRA 8 atış yaptı — açık BÜYÜK ölü-bölgeye özgü.
    // Kural: tehdit ölü-bölgeye girerse tehdit kütlesinden uzaklaş, atış bandına geri dön.
    standoff: true,
    // P8 — KURUYAN BİRİM İKMALE GİDER (BECERİ #5). TEŞHİS (tools/muhimmat-teshis.js, seed2024):
    // 8 tanksavar timi ÖMRÜNÜN %71-77'sini KURU geçiriyor (84sn'de kuruyorlar, maç 365sn);
    // toplam kuru-tik oranı %19.2. Kuruyken en yakın ikmal aracı 1100-1600px uzakta, kamyon
    // halesi ise yalnız 400px → ikmal PASİF, kimse kimseye gitmiyor. Kural: kuruyan birim
    // en yakın canlı dost ikmal kaynağına yürür, dolunca göreve döner.
    //
    // ÖLÇÜLDÜ ve **KATMAN 2'DE ELENDİ** → VARSAYILAN KAPALI. Mekanizma çalışıyor (kuru-tik oranı
    // pro altında %3.9→%0.9 ve %2.7→%0.2, yani kalan kuruluğun ~%75'i silindi) AMA ordu daha çok
    // ateş ETMİYOR — yola çıkma maliyeti kazancı yiyor. Toplam atış (3 tohum): kapalı 736 ·
    // 800px 730 · 1200px 721 · 2500px 715. Hiçbir parametre kontrolü geçemedi.
    // ASIL SEBEP: teşhis pro-KAPALI yapılmıştı (kuru-tik %19.2/%11.3/%4.8) ama delta pro'ya bağlı;
    // pro yapılandırmasında sorun zaten küçük (%0.1-3.9). Yani doğru sorun, yanlış yapılandırma.
    // Kod ve parametreler DURUYOR: determinizm doğrulandı (forktest forkTutarli:true), ileride
    // parametre araması (Katman 5) veya intel4 tabanı için yeniden değerlendirilebilir.
    resupplyRun: false,
    // P9 — HAVA VURUCU AVLANIR (BECERİ #20'). TEŞHİS (tools/helo-teshis.js, 3 tohum, pro AÇIK):
    // SALDIRAN taarruz helosu ömrünün yalnız %3-12'sinde menzilinde hedef buluyor (savunan helo
    // %46-62) ve 12/12 mühimmatla — TAM YÜKLE — ölüyor. 800₺'lik birim maçta 1-2 atış yapıyor.
    // Konumlandırma sorunu DEĞİL: atışlarının ortalaması menzilinin %92'sinden, AA zarfında
    // geçirdiği süre %0-1. Eksik olan AVLANMA: helo ana kuvvetle oyalanıyor, hedefe GİTMİYOR.
    heloHunt: true,
    // P10 — JAMMER KONUŞLANDIRMA (BECERİ #29). KULLANICI TEŞHİSİ ölçümle onaylandı: düşman dron
    // örneklerinin yalnız %5.2'si jam baloncuğunda; jammer en yakın drona ort. 1749px uzakta,
    // baloncuk ise 1143px → ~600px yanlış yerde. Hiç ölmüyor (derinlik 0.42) → öne çıkmak için
    // hem yer hem güvenlik var. Jamming mekanizmasının üç ölü katmanı düzeltildikten SONRA
    // yazıldı; artık kapsamayı artıran her adım gerçek karşılık üretebilir.
    //
    // ÖLÇÜLDÜ ve **KATMAN 1'DE ELENDİ** → VARSAYILAN KAPALI. İzole A/B (pro her iki kolda açık,
    // yalnız bu anahtar değişti), dron-ağırlıklı saldırgana karşı 2 jammerli savunan:
    //   KONTROL (kapalı)          kapsama %13.0   jammer ölümü 120sn, 127sn
    //   tehdit 900  / derinlik .75 kapsama  %6.8  jammer ölümü  45sn,  69sn
    //   tehdit 1500 / derinlik .45 kapsama  %8.0  jammer ölümü  63sn,  97sn
    //   tehdit 2000 / derinlik .35 kapsama %13.0  (hiç bağlamadı = kontrolün aynısı)
    // Jammer'ı HAREKET ETTİREN her ayar kapsamayı DÜŞÜRÜYOR ve onu daha erken öldürüyor.
    // KÖK NEDEN — hipotez yanlıştı: dron trafiği DÜŞMAN KUVVETİNİN yanında; oraya yaklaşan
    // silahsız 300hp'lik birim ölüyor ve ölü jammer hiçbir şey örtmüyor.
    // GELECEK YÖNÜ (yazılmadı): dronu KOVALAMAK yerine dronun HEDEFİNİ örtmek — kendi topçu/
    // komuta/ikmal kümesinin üstüne şemsiye kurmak. Dron oraya zaten geliyor; jammer güvende kalır.
    jammerPost: false,
    // P12 — JAMMER ŞEMSİYESİ (KULLANICI DOKTRİNİ). jammerPost'un TERSİ: dronu kovalama, dronun
    // GELDİĞİ YERİ ört. Kendi yumuşak-değerli kümemiz (topçu/ÇNRA/havan + komuta/ikmal/radar)
    // zaten dronun hedefi; jammer oraya oturursa dron kendi ayağıyla baloncuğa girer ve jammer
    // kendi hattının gerisinde güvende kalır. 700px'lik yarıçap dron kovalamaya yetmez ama
    // kendi kümesini örtmeye rahat yeter.
    //
    // ÖLÇÜLDÜ ve **GEREKSİZ ÇIKTI** → VARSAYILAN KAPALI. AI jammer'ı ZATEN şemsiye konumunda
    // tutuyor: kendi yumuşak-değerli kümesinin merkezine ortalama **146-165px** mesafede duruyor
    // ve baloncuk 700px — yani küme zaten tam örtülü. Beceri onu maliyet-ağırlıklı merkeze
    // çekerek biraz UZAKLAŞTIRDI (246/208px) ve kapsamayı iyileştirmedi
    // (seed2024 %2.4→%1.9 · seed3141 %1.3→%1.2 · seed777 %1.0→%0.5).
    // ASIL SINIR BAŞKA: düşman AI'ın dronları bizim geri bölgemize yeterince gelmiyor, o yüzden
    // %1-2'lik kapsama tavanı konumlandırmayla değil DÜŞMANIN DAVRANIŞIYLA belirleniyor.
    // NOT (kullanıcı deneyimiyle uyum): oyuncu dronlarını değerli hedeflere sürdüğü için AI'ın
    // hazır şemsiyesine giriyor — jammer'ın "güçlü" hissedilmesinin sebebi büyük olasılıkla bu.
    jammerUmbrella: false,
    // P11 — YÖNLÜ ZIRHI KORU (BECERİ #10). TEŞHİS: yönlü-zırhlı maruziyeti ÖN %63 / YAN %27 /
    // ARKA %10; savunan MBT %42/%56/%1 (yarıdan fazlasında yanını gösteriyor). MBT yan ×1.5,
    // TD arka ×3.3. Sebep: facingAngle önce HAREKET yönüne, sonra ATIŞ HEDEFİNE kuruluyor —
    // ikisi de "beni kim vuruyor" sorusunu sormuyor. BEDAVA beceri: yalnız yön, hareket YOK.
    //
    // ÖLÇÜLDÜ ve **KATMAN 2'DE ELENDİ** → VARSAYILAN KAPALI.
    // KATMAN 1 ÇARPICI biçimde geçti: zayıf-taraf maruziyeti %37 → %4 (ÖN %63→%96, YAN %27→%4,
    // ARKA %10→%0) ve bedeli SIFIR (yalnız dönüş, hareket yok).
    // KATMAN 2 GEÇMEDİ: zırhlı birim ömrü 6 tohumda ort. 107sn → 105sn (113→142, 144→44, 124→124,
    // 90→89, 98→98, 73→132) — yön ilerlemesi hayatta kalmaya DÖNÜŞMÜYOR ve varyans çok yüksek.
    // MUHTEMEL SEBEP (sınanmadı): zırhlıya gelen hasarın çoğu yönün ÖNEMSİZ olduğu kaynaklardan —
    // dolaylı ateş//patlama alanı, hava, shaped-charge AT. facingDamageMult yalnız doğrudan-ateş
    // yolunda okunuyor. Sınamak için hasar kaynağı kırılımı gerekir (ayrı teşhis).
    armorFace: false,
    // P13 — YEREL ORAN KAPISI (BECERİ: zırhlı konuşlandırma). TEŞHİS: zırhlılar ölürken çevrelerinde
    // ort. 4 dost / 12.3 düşman vardı (1:3 dezavantaj). Hasarın %76'sı DIRECT_FIRE — yani sorun
    // 'yön' değil 'YER'. Mevcut assaultCohesion bunu kaçırıyor: yalnız SALDIRAN rolüne bakıyor
    // (ölenler savunandı) ve yalnız DOSTU sayıyor. Kural: yerel dost/düşman oranı eşiğin
    // altındaysa kapatma, menzilde tut. Birimi HAREKET ETTİRMEZ (eski 'aktif toplanma' zararlıydı).
    //
    // ÖLÇÜLDÜ: **HİÇ BAĞLAMADI (0 tik)** → VARSAYILAN KAPALI, ama teşhisi TERSİNE ÇEVİRDİ.
    // Kural `!standOff` koşuluna bağlıydı; o noktaya gelindiğinde standOff ZATEN true oluyor
    // (duruş kapısı `standOff = !gate.open` veya 'range' deltası menzil≥520 için). Yani zırhlı
    // İLERLEDİĞİ İÇİN ÖLMÜYOR — zaten menzilde duruyor, DÜŞMAN onun üstüne geliyor.
    // Ölüm derinlikleri bunu doğruluyor: 0.44-0.47, yani ORTA HAT civarı. Savunan zırhlı kendi
    // bölgesinde değil, ortada ve 1:3 dezavantajda ölüyor (bkz. holdZone deltası, o da kapalı).
    // DOĞRU MÜDAHALE KATMANI DEĞİŞTİ: birim-içi "kapatma kapısı" değil, KONTROLÖR seviyesinde
    // KUVVET DAĞILIMI — savunan kütlesini nereye koyuyor ve neden ince yayılıyor.
    localRatio: false
};
// ── 'armorFace' PARAMETRELERİ (aranabilir) ──
let PRO_ARMORFACE_R = 2200;              // tehdit taraması yarıçapı (en uzun doğrudan-ateş menzilini kapsar)
let PRO_ARMORFACE_MIN_BASKINLIK = 0.35;  // tehdit vektörü bu kadar yönlü değilse (her yönden) dönme
// ── 'localRatio' PARAMETRELERİ (aranabilir) ──
let PRO_RATIO_R = 600;      // yerel oran yarıçapı (ölçüm bu yarıçapta yapıldı: kazanan 10.8 / kaybeden 3.4)
let PRO_RATIO_MIN = 1.0;    // (dost+1)/düşman bunun altındaysa ilerleme — yerel dezavantajda kapatma
// ── 'jammerPost' PARAMETRELERİ (aranabilir) ──
let PRO_JAM_ICERI = 0.70;      // dron merkezini baloncuğun bu kesrine al (kenarında değil, içinde)
let PRO_JAM_TEHDIT = 900;      // görülen düşman ateşli KARA birimi bu kadar yakınsa ilerleme (silahsız 300hp)
let PRO_JAM_DERINLIK = 0.75;   // kendi üssünden düşman üssüne doğru bu kesri aşma
// ── 'jammerUmbrella' PARAMETRELERİ (aranabilir) ──
let PRO_JAM_HVT_MIN_TL = 300;        // korunacak dost bu değerin altındaysa mevzi bozulmaz
let PRO_JAM_SEMSIYE_ICERI = 0.45;    // kümenin merkezini baloncuğun bu kesrine al (merkeze otur)
// ── 'heloHunt' PARAMETRELERİ (aranabilir) ──
let PRO_HELO_AA_KACIN = 1200;   // düşman AA'sının bu yarıçapı içindeki hedefe gitme (SEAD disiplini)
let PRO_HELO_YAKLAS = 0.85;     // kendi menzilinin bu kesrine kadar yaklaş (hedefin üstüne binme)
let PRO_HELO_BEKLE_TIK = 20;    // menzilde hedef yokken bu kadar tik bekle, sonra avlan (1sn — thrash önler)
// ── 'resupplyRun' PARAMETRELERİ (aranabilir) ──
let PRO_RESUPPLY_ESIK = 0;          // bu mühimmat ORANINDA (ve altında) ikmale git. 0 = tamamen kuruyunca.
let PRO_RESUPPLY_BIRAK = 0.9;       // bu orana dolunca göreve dön (histerezis: salınımı keser)
let PRO_RESUPPLY_MAX_MESAFE = 2500; // bundan uzaktaki kaynağa gitme (haritayı boydan boya yürüme)
let PRO_RESUPPLY_ICERI = 0.75;      // halenin bu kesrine girince DUR ve dol (kaynağın üstüne binme)
// ── 'standoff' PARAMETRELERİ (elle yazıldı ama ARANABILIR: hepsi tek sayı, A/B süpürmesine açık) ──
let PRO_STANDOFF_MIN_PX = 600;   // bu ölü-bölgenin altındaki birim kural-dışı. 600px=8 grid → ÇNRA+balistik.
                                 // Havan (225) ve obüs (375) HARİÇ: onlar zaten sorunsuz ateş ediyor, geri
                                 // çekmek onları savaştan koparır. Eşik büyütülüp küçültülerek süpürülebilir.
let PRO_STANDOFF_TRIP = 1.15;    // tehdit minRange×TRIP içine girdiyse çekil (ölü bölgeye GİRMEDEN önce davran)
let PRO_STANDOFF_HEDEF = 1.35;   // hedeflenen standoff = minRange×HEDEF (atış bandının rahat içi)
let PRO_STANDOFF_TAVAN = 0.92;   // menzil×TAVAN'dan geriye kaçma — kendi azami menzilinden çıkmak atışı yine keser
let PRO_STANDOFF_ADIM = 300;     // tek değerlendirmede verilecek en fazla geri-hedef (px): sıçrama değil sürüklenme

// ── MEKANİK DÜZELTMESİ (AI becerisi DEĞİL, iki tarafa+oyuncuya simetrik) ──
// Konuşlanan birim namlusunda mermiyle gelir: İLK atış dolum süresi beklemez.
// ÖLÇÜLDÜ (tools/gozcu-teshis.js): balistik füzenin atış bandında GÖRÜNÜR hedefi t=6sn'den beri vardı
// (canlı tiklerinin %90.6'sı) ama ilk atışı 67sn'de yaptı — rof 0.015 → atkSpeed 66.7sn ve lastAttackTime=0
// başlangıcı birimi "daha doldurmadı" sayıyordu. Yani birim sahaya BOŞ namluyla çıkıyordu.
// Etkilenen: taktik füze 66.7sn · ÇNRA 20sn · yıkım şarjı 12.5sn · obüs 5.6sn (kalanlar ≤5sn, pratikte etkisiz).
// Unit.js'teki singleUse istisnası aynı hatanın dron için zaten fark edilmiş dar bir yamasıydı.
let BATTLE_SPAWN_LOADED = true;

// ── KISMİ KARIŞTIRMA (kullanıcı: "jammer dronlara karşı fazla güçlü") ──
// KOD-VERİ UYUŞMAZLIĞI: UnitData jamming halesi `uavControlLoss: 0.75` ve birim başına
// `jammable` 0.8-1.0 ilan ediyor; kod ikisini de yok sayıp %100 tam-felç uyguluyordu
// (`if (this.jammable && ...)` yalnız truthy bakıyor). Halenin `enemyAccuracy: -0.20` ve
// `enemyCommandRange: -0.5` etkileri ise HİÇ uygulanmamış (js'de tek atıf yok) — kayıtta.
// Açık: karıştırılan tik oranı = uavControlLoss × jammable (RNG'siz görev-döngüsü).
//   recon_uav 0.75×0.9=0.68 · armed_uav 0.75×0.8=0.60 · kamikaze 0.75×1.0=0.75
let BATTLE_JAM_PARTIAL = true;
// KEŞİF İHA'sını da karıştır. ÖLÜ TASARIM bulundu: recon_uav'ın silahı olmadığı için engageCombat
// erken dönüyor ve jam bloğuna hiç ulaşmıyordu (baloncukta 75 tik, karıştırılan 0) — EH aracının
// en doğal işi (düşman gözünü kör etmek) hiç çalışmıyordu.
// KULLANICI KARARI (2026-08-05): AÇILDI. Gerekçe: jammer küresel ölçümde net YÜK çıkıyor
// (yarıçap haritanın %2.9'u + konumlandırma becerisi yok); "fazla güçlü" hissi YEREL mutlaklıktan
// geliyordu ve o BATTLE_JAM_PARTIAL ile ayrıca giderildi. Yani bu iki değişiklik zıt yönde:
// kısmi-etki yerel gücü kırpar, keşif-jamı ölü tasarımı diriltir.
let BATTLE_JAM_RECON = true;
let BATTLE_INTEL4PRO_RED = false;
let BATTLE_INTEL4PRO_BLUE = false;
// Birim tipi DOLAYLI ateş mi (topçu/havan/ÇNRA/balistik)? Karşı-batarya hedeflemesi bunu kullanır.
function battleIsIndirectType(t) {
    const s = STATS[t];
    return !!(s && (s.category === 'indirect' || (s.weapons && s.weapons[0] && s.weapons[0].indirect)));
}
function battleProDelta(isRed, key) {
    if (!BATTLE_INTEL4PRO_DELTAS[key]) return false;
    return isRed ? BATTLE_INTEL4PRO_RED : BATTLE_INTEL4PRO_BLUE;
}
const PRO_AMMO_RESERVE = 0.45;      // mühimmat bu oranın altındayken tasarruf kipi (yedek = yakın savunma için)
const PRO_AMMO_CLOSE_FRAC = 0.60;   // "kararlı menzil" = kendi menzilinin %60'ı; bunun ötesine tasarruf kipinde ateş yok
// ÖLÇÜMLE HİZALI eşik: yerel-oran ölçümü 600px yarıçapta yapıldı ve kaybeden saldırılarda kurbanın çevresinde
// ~3.4 dost, kazananlarda ~10.8 dost vardı. R=420/min=3 denendi → kural ateşlendi ama SONUÇ DEĞİŞMEDİ (4/8→4/8):
// eşik zaten neredeyse hep sağlanıyordu. Ölçümün yarıçapına geçildi ve eşik kaybeden-bandının üstüne alındı.
const PRO_COHESION_R = 600;
const PRO_COHESION_MIN = 5;
const PRO_RALLY_R = 1200;           // toplanma arama yarıçapı — bu mesafedeki muharip dostların merkezine git
const PRO_AT_CAP = 4;                // SALDIRANDA tanksavar timi tavani (kullanici: "7 fazla, 3-4 yeter"); ustu sokulup para iade edilir
const PRO_RALLY_MIN_D = 150;        // merkez bu kadar yakınsa zaten toplanmışız (gereksiz salınım yapma)         // yüksek eşik orduyu dondurup süre-doldu beraberliği üretebilir → A/B ile izlenir.

// ── PRO 'holdZone': SAVUNAN KENDİ BÖLGESİNİ TUTAR (kullanıcı gözlemi + --zonedrift ölçümü) ──
// DERİNLİK birimi: 0 = kendi arka kenarı, 1 = orta hat, >1 = düşman yarısı. Konuşlanma derinliği ~0.24.
// ÖLÇÜLEN HATA: eski "savunma hattı" (homeY=0.30/0.70 + objektife %40 harman) derinlik ~1.04 veriyordu —
// yani savunanın emredilen hattı ORTA HATTIN ÖTESİNDEYDİ. Sonuç: 6/6 tohumda savunan ileri gitti,
// 3/6'da orta hattı geçti (seed5150'de 5450₺ düşman yarısında). Savunan zamana oynar: yer tutmak kazandırır.
let PRO_HOLD_LINE_DEPTH = 0.70;   // ana direniş hattı (MAIN/FIXING) — kendi yarısında, temas kurmaya yetecek kadar ileri
let PRO_HOLD_DEEP_DEPTH = 0.40;   // ateş-desteği/lojistik/AA omurgası — düşman doğrudan-ateş zarfının dışında
let PRO_HOLD_MAX_DEPTH = 0.88;    // hiçbir savunan grup bunu aşamaz (STRIKE dışı)
let PRO_HOLD_STRIKE_DEPTH = 1.00; // karşı-taarruzda tavan = ORTA HAT; savunan düşman yarısını istila etmez
// derinlik → dünya-y (kırmızı üstte y-küçük, mavi altta y-büyük). Saf fonksiyon → determinist.
let PRO_HOLD_RESERVE_DEEP = true;   // ihtiyat da derin mevzide mi? (A/B ile süpürülür)
// ── ÖLÇÜLDÜ ve KAPATILDI: "hazırlanmış mevzi" denemeleri (kod duruyor, varsayılan kapalı) ──
// Örtü-çıpası (hattı ormana oturt): savunan 4/6 → 1/6. Orman gruplarını kümeleyip cepheyi boşaltıyor + hız ×0.7.
// İstihkâm siper-zinciri: savunan 4/6 → 2/6 ve 6 tohumda TOPLAM 2 siper dikilebildi. Kök sebep: savunanın
// TEK istihkâmı aynı zamanda İKMAL AĞI (siper providesSupply); onu hatta zincir dikmeye yollayınca ordu
// mühimmatsız kalıyor — ki süre-sonu hazır-olma çarpanını (0.65+0.35×amo) kaybettiren mekanizma tam da buydu.
// TARİF MODU (FAZ 0, docs/PLAN-KONUSLANDIRMA-CAPRAZLAMA.md): doluysa o tarafın ordusu kategori-paylarından
// deterministik kurulur ve konuşlandırma sezgiselleri (ağırlık/jitter/imza-floor/takas/taban/mızrak/artık) DEVRE DIŞI.
let BATTLE_RECIPE_RED = null;
let BATTLE_RECIPE_BLUE = null;

let PRO_HOLD_COVER_R = 0;           // >0 ise ana direniş hattı bu yarıçaptaki ormana oturur. ÖLÇÜM: zararlı → 0.
let PRO_HOLD_ENGINEER_LINE = false; // savunan istihkâmı hat boyunca siper zinciri diksin mi?
// DÜZELTME (kullanıcı): ikmal aracının KENDİ resupply-aurası var (r=4→300px, 1.0 mühimmat/sn) → istihkâm ikmal
// ağının tek kaynağı DEĞİL, siper dikmekte serbest. İlk deneme başarısızdı çünkü siperi ANA DİRENİŞ HATTINA
// diktirdim: oradaki closeThreat koruması inşayı iptal ediyor ve tek istihkâm temas hattında ölüyor (6 tohum, 2 siper).
// Siper hattın GERİSİNE alınır — r=105 örtüsü geri yamaçtaki mevziyi yine kapsar, istihkâm ateş altında kalmaz.
let PRO_HOLD_TRENCH_GAP = 300;      // zincir aralığı (siper: +6 zırh, 0.30 örtü, r=105)
let PRO_HOLD_TRENCH_DEPTH = 0.58;   // siperlerin derinliği — ana hattın (0.70) GERİSİ, temas dışı
function proDepthToY(side, d) { return side ? (WORLD_H * 0.5) * d : WORLD_H - (WORLD_H * 0.5) * d; }
function proYToDepth(side, y) { return side ? (y / (WORLD_H * 0.5)) : ((WORLD_H - y) / (WORLD_H * 0.5)); }

// TEHDİT-PROFİLİ FORENSİK-RİNG (her-zaman-açık): battleRecordCombatEvent'in TEPESİNDE, telemetri-kapısından ÖNCE doldurulur —
// çünkü replay-playback'te telemetry.combatEvents doldurulMAZ; inanç-katmanı onu okursa canlı≠playback → replay kırılır.
// Bu ring Unit.js-emisyonuyla canlı+playback AYNI dolar. Saf-veri (sim-mutasyon yok) → determinist. Tüketiciler tick-ile okur.
const BATTLE_FORENSIC = { buf: [], cap: 2048, seq: 0 };
function battleForensicReset() { BATTLE_FORENSIC.buf.length = 0; BATTLE_FORENSIC.seq = 0; }

// TEHDİT-SINIFI taksonomisi (saf, statesiz): STATS[type]'tan tehdit-sınıf(lar)ını çıkar. Sıralı-dizi döner (bir birim çok-sınıf olabilir).
function battleThreatClassOf(type) {
    const s = (typeof STATS !== 'undefined') ? STATS[type] : null;
    if (!s) return [];
    const tags = s.roleTags || [];
    const w0 = (s.weapons && s.weapons[0]) || {};
    const out = {};
    // areaAlpha: stratejik/topçu VEYA dolaylı-ateş+büyük-aoe (balistik aoe=6, çnra/topçu/havan)
    if (tags.includes('strategic') || tags.includes('artillery') || tags.includes('anti_structure') ||
        (w0.indirect && (w0.aoe || 0) >= 2)) out.areaAlpha = 1;
    if (s.domain === 'air') out.air = 1;
    if (tags.includes('raider') || tags.includes('backline_hunter') || tags.includes('stealth') || tags.includes('infiltrate') || tags.includes('assassin')) out.infiltrator = 1;
    if (tags.includes('intel') || tags.includes('spotter')) out.recon = 1;
    return Object.keys(out).sort();
}
// TEHDİT-PROFİLİ sınıf-AKTİF mi (gated 'profile' + detected): reaksiyonlar bunu sorar.
function battleThreatActive(controller, className) {
    if (!controller || typeof battleDelta !== 'function' || !battleDelta(controller.side, 'profile')) return false;
    const cls = controller.perception && controller.perception._threatProfile && controller.perception._threatProfile.classes;
    return !!(cls && cls[className] && cls[className].detected);
}
// TEHDİT-PROFİLİ reaksiyon-İŞARETLE (reaction-latency kabul-metriği + telemetri): ilk-aktivasyonda _firstReactionTick + reactionsTriggered.
function battleProfileMarkReaction(controller, className, reactionName, tick) {
    const cls = controller && controller.perception && controller.perception._threatProfile && controller.perception._threatProfile.classes;
    const c = cls && cls[className]; if (!c) return;
    if (c._firstReactionTick == null) c._firstReactionTick = tick;
    if (!c.reactionsTriggered) c.reactionsTriggered = [];
    if (!c.reactionsTriggered.includes(reactionName)) c.reactionsTriggered.push(reactionName);
}
// Tip-bazlı dönüş çevikliği (kare-başı yaklaşma oranı 0..1) — tank/topçu ağır, piyade/keşif çevik; index = tip no
const UNIT_TURN_RATE = [
    0.11,  // 0 Piyade
    0.10,  // 1 Mekanize
    0.08,  // 2 Zırhlı Piyade (ağır)
    0.13,  // 3 Keşif (en çevik)
    0.09,  // 4 İstihkam
    0.11,  // 5 Sağlıkçı
    0.06,  // 6 Tank (ağır, yavaş döner)
    0.07,  // 7 Tanksavar (yavaş taret)
    0.045  // 8 Topçu (en yavaş döner)
];
const UNIT_FRONT_MARKER = true;      // ön/arka okunsun + kuşatmada kafa karışmasın diye facing'e bakan parlak ÖN-işareti

function drawW() { return BASE_DRAW_W * zoom; }
function drawH() { return BASE_DRAW_H * zoom; }

// ═══ BİRİM TİPLERİ + STATS artık VERİ-MODELİNDEN (units-modern.json via UnitLoader) üretilir ═══
// Yükleme sırası (index.html): UnitData.js → UnitFeatures.js → UnitLoader.js → globals.js.
// T = BÜYÜK-harf takma adlar (T.INFANTRY, T.ARMOR(mbt), T.SAM, T.MANPADS, ...); STATS[index] = motor-tanımı
// (hp,atk,speed,range,vision,atkSpeed,armor,cost,maxAmmo,name + YENİ: armorType,weapons[],aura,flight,domain,targets,minRange...).
// Eski UNIT_*_MULTIPLIER döngüsü KALKTI — roster mutlak değerler; loader zaten kare→px ölçekledi (TILE_PX=100, bkz. UnitLoader.js:10).
const __UNIT_LOAD = unitLoaderBuild(UNITS_MODERN_DB);
const T = __UNIT_LOAD.CONST;
const STATS = __UNIT_LOAD.STATS;
const UNIT_ID_BY_INDEX = __UNIT_LOAD.ID_BY_INDEX;

// FAZ-2 KAYNAK-BAZLI DEPLOY: her birim grubu kendi kaynağından ödenir
//  ⛽PETROL→zırhlı/araç, 👥İNSAN→piyade-ayak, ⭐PUAN→topçu/özel. (Hikaye düellosunda OYUNCU için aktif.)
// Kaynak-grubu (hikaye modu bütçesi) kategoriden türer: infantry→insan, armor/air/uav→petrol, gerisi→puan.
const UNIT_RES_GROUP = {};
for (let __i = 0; __i < UNIT_ID_BY_INDEX.length; __i++) {
    const __c = STATS[__i] ? STATS[__i].category : null;
    UNIT_RES_GROUP[__i] = (__c === 'infantry') ? 'manpower' : (__c === 'armor' || __c === 'air' || __c === 'uav') ? 'oil' : 'points';
}

const AT_ARMOR_MULTIPLIER = 4.0;          // tanksavar → zırhlı: sert anti
const AT_ARMOR_PENETRATION = 0.85;
const EQUIPPED_AT_MULTIPLIER = 1.6;       // teçhizatlı piyade (mekanize/zırhlı piy.) → zırhlı: yumuşak anti
const EQUIPPED_AT_PENETRATION = 0.35;
const ARTILLERY_SPLASH_RADIUS = 120;      // 165→135: yayık birim splash'tan kaçar, topçu yenilebilir olur
const ARTILLERY_SPLASH_DAMAGE_RATIO = 0.95;
// ─── TAŞIMA (nakliye helikopteri: piyade bindir-indir) ───
const TRANSPORT_LOAD_RADIUS = 95;         // yolcuyu almak için bu kadar yakın olmalı (hover)
const TRANSPORT_LOAD_TIME = 1.6;          // saniye/yolcu — biniş süresi (gerçekçi gecikme)
const TRANSPORT_UNLOAD_TIME = 0.7;        // saniye/yolcu — iniş süresi
const TRANSPORT_UNLOAD_TRIGGER = 420;     // düşman bu kadar yakınsa hemen indir (fast-rope)
// Tank mermisi: dar ama gerçek alan hasarı (HE mermisi). Topçudan KÜÇÜK ve ZAYIF.
const TANK_SPLASH_RADIUS = 80;            // topçunun ~yarısı
const TANK_SPLASH_MIN = 0.30;             // kenar hasar oranı
const TANK_SPLASH_MAX = 0.65;             // merkeze yakın hasar oranı (asla %100 değil)
const ARTILLERY_SUPPRESSION_RADIUS = 150;

// ─── MERMİ HIZLARI (px/sn) — DEFERRED-DAMAGE uçuş-süresi = mesafe/hız ───
// Aynı hız hem HASAR-varış-tik'ini hem VFX-projektilini besler → görsel ve hasar EŞZAMANLI (kullanıcı: "mermi ulaşmadan hasar olmasın").
// Güdümlü füze (SAM/MANPADS/taarruz-helo/SİHA) yavaş+takipli; namlu-mermisi (top/ap/makineli) hızlı. Stage-3'te hissiyata göre ayarlanır.
const PROJECTILE_SPEED_GUN = 1900;          // varsayılan namlu-mermisi
const PROJECTILE_SPEED_TANK = 2200;         // tank topu / tank-avcısı (en hızlı sabo)
const PROJECTILE_SPEED_MG = 2200;           // makineli/tüfek (piyade/komando/istihkam/keşif)
const PROJECTILE_SPEED_AUTOCANNON = 2000;   // ZMA / SPAAG namlu tazyiki
const PROJECTILE_SPEED_ATGM = 1600;         // AT-timi tanksavar füzesi
const PROJECTILE_SPEED_HOMING_GROUND = 800; // güdümlü füze — kara hedef (VFX ile birebir aynı)
const PROJECTILE_SPEED_HOMING_AIR = 1150;   // güdümlü füze — hava hedef
const PROJECTILE_MAX_FLIGHT_TICKS = 60;     // uçuş tavanı (3sn) — VFX maxLife ile hizalı, kuyruk şişmesin

// Güdümlü mi (hedefi takip eden füze)? Görsel homing + yavaş hız bu listeden.
function battleIsHomingWeapon(atkType) {
    return atkType === T.SAM || atkType === T.MANPADS || atkType === T.ATTACK_HELO || atkType === T.UCAV;
}
// Fırlatan tipe (ve hedefin hava olup olmadığına) göre mermi hızı.
function battleProjectileSpeed(atkType, targetIsAir) {
    if (battleIsHomingWeapon(atkType)) return targetIsAir ? PROJECTILE_SPEED_HOMING_AIR : PROJECTILE_SPEED_HOMING_GROUND;
    if (atkType === T.ARMOR || atkType === T.TANK_HUNTER) return PROJECTILE_SPEED_TANK;
    if (atkType === T.MECH_INFANTRY || atkType === T.SPAAG) return PROJECTILE_SPEED_AUTOCANNON;
    if (atkType === T.ANTI_TANK) return PROJECTILE_SPEED_ATGM;
    if (atkType === T.INFANTRY || atkType === T.COMMANDO || atkType === T.ENGINEER || atkType === T.RECON) return PROJECTILE_SPEED_MG;
    return PROJECTILE_SPEED_GUN;
}
// MERMİ GÖRSEL PROFİLİ (render-only): füze duman-izi bırakıp varışta patlar; namlu mermisi iz bırakmaz, varışta kıvılcım;
// hafif silah ince iz-mermi (efekt yok — kıvılcımı hasar-tarafı zaten üretir). Tüfek mermisi "patlamasın" diye ayrıldı.
function battleProjectileVisual(atkType) {
    if (battleIsHomingWeapon(atkType) || atkType === T.ANTI_TANK)
        return { trail: true, impact: 'explosion', scale: 1.05, color: '#ffd27f' };
    if (atkType === T.ARMOR || atkType === T.TANK_HUNTER || atkType === T.MECH_INFANTRY || atkType === T.SPAAG)
        return { trail: false, impact: 'spark', scale: 0.8, color: '#ffe9a8', width: 2.0 };
    return { trail: false, impact: 'none', scale: 0.5, color: '#fff2a0', width: 1.2 };
}
// Uçuş süresi TİK cinsinden (≥1 → hasar asla fırlatma-tik'inde inmez). Determinist: yalnız skalerlerden.
function battleFlightTicks(dist, speed) {
    const ts = (typeof BATTLE_TICK_SEC !== 'undefined') ? BATTLE_TICK_SEC : 0.05;
    const t = Math.round(dist / Math.max(1, speed * ts));
    return Math.max(1, Math.min(PROJECTILE_MAX_FLIGHT_TICKS, t));
}

// HASAR = beklenen-hasar (VERİ-GÜDÜMLÜ): silah-hasarı × damageMatrix[silah.damageType][hedef.armorType] × zırh-azaltma.
// Counter'lar artık damageMatrix'ten (ap→heavy 1.0, shaped→heavy 1.4, sam→air 1.6, ap→air 0, ...). Hardcode YOK.
// Matris 0 ise (ör. tank-topu→hava) hasar 0 → birim o hedefi vuramaz. Determinizm korunur (RNG yok; accuracy FAZ 1).
function calculateUnitDamage(attackerType, targetType, baseAttack, targetArmor) {
    const aS = STATS[attackerType], tS = STATS[targetType];
    if (!aS || !tS) return Math.max(1, Math.floor(baseAttack - (targetArmor || 0)));
    const w = aS.weapons && aS.weapons[0];
    const dmgType = w ? w.damageType : 'small_arms';
    const armorType = tS.armorType || 'infantry';
    const mult = (UNITS_MODERN_DB.damageMatrix[dmgType] || {})[armorType] || 0;
    if (mult === 0) return 0;
    const armorRed = 1 / (1 + (tS.armorValue || 0) * 0.06);   // UnitFeatures.effectiveHp ile tutarlı zırh-azaltma
    return Math.max(1, Math.round(baseAttack * mult * armorRed));
}

// ── İSABET MODELİ (accuracy) — BEKLENEN-HASAR çarpanı [0.15..1], deterministik (RNG yok) ──
// acc = base × menzil-düşüşü × hareket-cezası × örtü-cezası. optimalRange TILE→PX (×RANGE_PX). Veri yoksa 1 (tam isabet).
function weaponAccuracy(attacker, weapon, target, dist) {
    const acc = weapon && weapon.accuracy;
    if (!acc) return 1;
    let a = (acc.base != null) ? acc.base : 1;
    const optPx = (acc.optimalRange || 0) * (typeof RANGE_PX !== 'undefined' ? RANGE_PX : 75);
    const rng = weapon.range || 1;
    if (dist > optPx && rng > optPx) {
        a *= Math.max(0, 1 - (acc.falloff || 0) * (dist - optPx) / (rng - optPx));   // menzil-sonu isabet düşer
    }
    if (acc.vsMoving) {                                              // HAREKETLİ hedefe isabet cezası (topçu vsMoving 0.85 → hızlıya ıskalar)
        const tS = STATS[target.type];
        const moving = Math.hypot((target.targetX != null ? target.targetX : target.x) - target.x,
                                  (target.targetY != null ? target.targetY : target.y) - target.y) > 25;
        const tSpd = (moving && tS) ? (tS.tileSpeed || 0) : 0;
        a *= Math.max(0, 1 - acc.vsMoving * (tSpd / 4));
    }
    if (acc.ignoresCover != null) {                                 // ÖRTÜ cezası (orman/siper); ignoresCover=1 → yok say
        const cover = (target.inForest ? 0.4 : 0) + (target.inTrench ? 0.3 : 0);
        if (cover > 0) a *= Math.max(0, 1 - cover * (1 - acc.ignoresCover));
    }
    return Math.max(0.15, Math.min(1, a));   // taban 0.15
}

// ── HEDEFE GELEN HASAR ÇARPANI: siperlenme (dig_in) azaltır -%35; İŞARETLİ (mark_target) hedef +%25 (2sn=40 tik) ──
function incomingDamageMult(target) {
    let m = 1 - (target.entrench || 0) * 0.35;
    if ((SIM.tick - (target._markedTick || -999)) <= 40) m *= 1.25;   // komando/keşif işaretledi → müttefikler daha sert vurur
    return m;
}

// ── YÖNSEL ZIRH (armorFacing) — hedefin per-birim yan/arka zayıflığı: çarpan = 1/facing (TD yan 0.5→2×, arka 0.3→3.3×) ──
// Veri yoksa (piyade/topçu/destek) hafif sabit çarpan (yumuşak hedefte yön daha az anlamlı).
function facingDamageMult(target, zone, armored) {
    const af = STATS[target.type] && STATS[target.type].armorFacing;
    if (af && af[zone]) return Math.min(3.5, 1 / af[zone]);
    if (zone === 'rear') return armored ? 2.2 : 1.8;
    return armored ? 1.6 : 1.3;   // side
}

// ── TEKNOLOJİ AĞACI bonusları (SADECE hikaye düellosu; her birim KENDİ devletinin tech'ini alır) ──
// birimin tarafına göre doğru bonus seti (mavi=oyuncu / kırmızı=düşman); Quick Match/MP'de ikisi de null → no-op.
function _techBonusFor(unit) {
    if (!unit) return null;
    return unit.isRed ? (typeof TECH_BONUS_RED !== 'undefined' ? TECH_BONUS_RED : null)
                      : (typeof TECH_BONUS !== 'undefined' ? TECH_BONUS : null);
}
// SAVAŞ-ANI çarpanı: topçu splash/atk/anti-piyade, tanksavar→tank.
function applyTechCombatBonus(attacker, target, dmg) {
    const tb = _techBonusFor(attacker); if (!tb) return dmg;
    let m = 1;
    if (attacker.type === T.ARTILLERY) {
        if (tb.artySplashMul) m *= tb.artySplashMul;
        if (tb.artyAtkMul) m *= tb.artyAtkMul;
        if (tb.artyVsInfMul && (target.type === T.INFANTRY || target.type === T.MECH_INFANTRY || target.type === T.ARMOR_INFANTRY)) m *= tb.artyVsInfMul;
    }
    if (attacker.type === T.ANTI_TANK && target.type === T.ARMOR && tb.atVsTankMul) m *= tb.atVsTankMul;
    if (attacker.type === T.ARMOR && tb.tankAtkMul) m *= tb.tankAtkMul;                    // Yıldırım Harbi
    if (attacker.type === T.INFANTRY && tb.infantryAtkMul) m *= tb.infantryAtkMul;         // Talim Nizamı
    return m === 1 ? dmg : dmg * m;
}
// SPAWN-ANI stat buff: birim yaratılınca (placeUnit/gazi) zırh/hız/görüş/hp ölçekle (kendi tarafının tech'iyle).
function applyTechSpawnBonus(u) {
    const tb = _techBonusFor(u); if (!u || !tb) return;
    const t = u.type;
    if (t === T.ARMOR && tb.tankArmor) u.baseArmor = Math.round(u.baseArmor * tb.tankArmor);
    if (t === T.ARMOR && tb.tankHp) { u.maxHp = Math.round(u.maxHp * tb.tankHp); u.hp = u.maxHp; }
    if ((t === T.ARMOR || t === T.MECH_INFANTRY || t === T.ARMOR_INFANTRY) && tb.armoredHpMul) { u.maxHp = Math.round(u.maxHp * tb.armoredHpMul); u.hp = u.maxHp; }
    if ((t === T.ARMOR || t === T.MECH_INFANTRY || t === T.ARMOR_INFANTRY) && tb.armorSpeed) { u.baseSpeed *= tb.armorSpeed; u.speed = u.baseSpeed; }
    if (t === T.RECON && tb.reconVision) u.vision = Math.round(u.vision * tb.reconVision);
    if (t === T.INFANTRY && tb.infantryHp) { u.maxHp = Math.round(u.maxHp * tb.infantryHp); u.hp = u.maxHp; }
    if ((t === T.MECH_INFANTRY || t === T.ARMOR_INFANTRY) && tb.mechHp) { u.maxHp = Math.round(u.maxHp * tb.mechHp); u.hp = u.maxHp; }   // Zırhlı Yumruk
    if (t === T.ANTI_TANK && tb.atHp) { u.maxHp = Math.round(u.maxHp * tb.atHp); u.hp = u.maxHp; }                                      // Ağır Tanksavar
    if (tb.allHp) { u.maxHp = Math.round(u.maxHp * tb.allHp); u.hp = u.maxHp; }                                                          // Gazi Nizamı / Hassas İmalat
    if (tb.allSpeed) { u.baseSpeed *= tb.allSpeed; u.speed = u.baseSpeed; }                                                              // Sızma Taktiği
    if (tb.allArmorAdd) u.baseArmor += tb.allArmorAdd;
    if (tb.panicResistance) u.panicResistance = Math.max(u.panicResistance || 0, tb.panicResistance);
    if (u.baseArmor != null) u.armor = u.baseArmor;   // dinamik armor'ı taze tabana hizala
}

function capUnitArmor(type, armor) {
    const at = STATS[type] && STATS[type].armorType;
    if (at === 'heavy') return Math.min(armor, 12);
    if (at === 'light') return Math.min(armor, 8);
    return Math.min(armor, 10);
}

// SAĞLIKÇI organik (infantry-armor) birlikleri iyileştirir; İSTİHKAM araçları (light/heavy/air) onarır.
function isMedicHealable(type) {
    return !!(STATS[type] && STATS[type].armorType === 'infantry');
}

function isFieldRepairable(type) {
    const a = STATS[type] && STATS[type].armorType;
    return a === 'light' || a === 'heavy' || a === 'air';
}

// AI GÖREV-ROLÜ: birim tipini roleTags/category'den kovaya eşler (25-birim). null = combat (MAIN/FIXING/FLANK).
// TASK_GROUP_ROLE BattlePlanning.js'te tanımlı — çağrı-anında çözülür (savaşta, o dosya yüklü).
function battleUnitRoleBucket(type) {
    const s = STATS[type]; if (!s || typeof TASK_GROUP_ROLE === 'undefined') return null;
    const tags = s.roleTags || [], cat = s.category, hasW = (s.weapons || []).length > 0;
    // saldırgan roller (anti_armor/air/assassin vб.) → RECON'a atma; SİHA gibi silahlı-intel muharebede kalır.
    const combatTag = tags.includes('anti_armor') || tags.includes('anti_air') || tags.includes('assassin') ||
        tags.includes('breakthrough') || tags.includes('anti_infantry') || tags.includes('backline_hunter');
    if (!combatTag && (cat === 'recon' || tags.includes('intel') || tags.includes('spotter'))) return TASK_GROUP_ROLE.RECON;
    if (cat === 'indirect' || tags.includes('indirect_fire')) return TASK_GROUP_ROLE.FIRE_SUPPORT;
    if (cat === 'support' || cat === 'logistics' || cat === 'command' || !hasW ||
        tags.includes('sustain') || tags.includes('engineering') || tags.includes('logistics') ||
        tags.includes('command') || tags.includes('no_weapon')) return TASK_GROUP_ROLE.SUPPORT;
    return null;   // muharebe (MAIN/FIXING/FLANK)
}

const PHASE = { DEPLOY: 'deploy', BATTLE: 'battle', OVER: 'over' };
let phase = PHASE.DEPLOY;
let gameTime = 0;

const player = { money: 1500, kills: 0, unitsSpawned: 0 };
const enemy = { money: 1500, kills: 0, unitsSpawned: 0 };
// FAZ-2: kaynak-bazlı deploy bütçesi (null = tek-para modu/Quick Match/MP). { blue: {oil,manpower,points} }
//  Sadece mavi kaynak-kilitli; kırmızı birleşik enemy.money kullanır. Story bunu kurar.
let DEPLOY_RES = null;
// FAZ-3 HAVUZ DEPLOY: { [birimTipi]: kalanAdet } — hikaye modunda ŞEHİRLERDE ÜRETİLEN ordu.
// Para değil ADET kısıtı: "elimde tam 3 tank var" ifade edilebilsin diye DEPLOY_RES'ten ayrı tutulur.
// null = havuz modu KAPALI → placeUnit eski davranışını birebir korur (Quick Match / MP / acil seferberlik).
let DEPLOY_POOL = null;
let TECH_BONUS = null;       // hikaye tech bonusu — MAVİ (oyuncu devleti) birime (null = Quick Match/MP)
let TECH_BONUS_RED = null;   // hikaye tech bonusu — KIRMIZI (düşman devlet) birime (null = Quick Match/MP)

const units = [];
const trenches = [];
const mines = [];   // MAYIN: istihkam döşer; düşman kara-birimi basınca patlar (deterministik). Gizli — yalnız sahip + yüksek-detect görür.
// FAZ 1a: sim-dizilerini world'e alias bağla (const → asla reassign yok, alias güvenli).
// Mevcut kod `units`/`trenches` global'lerini kullanmaya devam eder; yeni motor-kodu `SIM.units` okur. İkisi AYNI dizi.
SIM.units = units;
SIM.trenches = trenches;
SIM.mines = mines;
// DEFERRED-DAMAGE (mermi-varışta): fırlatma-anında hesaplanıp VARIŞ-tik'inde uygulanan bekleyen-vuruşlar. Determinist (sabit-sıra
// (arriveTick,seq), srand-YOK, canlı-ref-YOK → yalnız skaler). pendingSupportSpawns analogu: fork+hash'te serialize, initialState'te t0-boş.
const pendingHits = [];
SIM.pendingHits = pendingHits;
SIM.pendingHitSeq = 0;   // monoton sıra-sayacı (deterministik push-sırası → sabit işleme-sırası). resetBattleState + restoreInitialState'te sıfırlanır.
// KONTROLÖR DURUŞU (SİM-DURUMU): { [controllerId]: { open, role, stance } }. Unit.update taarruz-kapısını/rolünü BURADAN okur.
// KÖK-NEDEN DÜZELTMESİ: eskiden sim kodu CANLI kontrolör nesnesini (BATTLE_CONTROLLERS.get(...).lastSituation) okuyordu; replay'de
// kontrolör HİÇ yok → aynı birim farklı hareket ediyordu (ölçüldü: sapma tik 451, mikro kapatılınca sapma SIFIR). Artık duruş
// sim-durumuna yazılıyor: hash'lenir, fork'lanır ve DEĞİŞTİĞİNDE replay'e olay olarak kaydedilir → canlı=replay=fork.
SIM.ctrlPosture = {};
// MAYIN sabitleri
const MINE_TRIGGER_R = 65;      // basma yarıçapı (birim merkezine) — geçen birimi daha güvenilir yakalar
const MINE_BLAST_R = 95;        // patlama alan-yarıçapı
const MINE_DAMAGE = 260;        // he tabanlı (zırhlıya alt-yön etkili); matris ile çarpılır
// Deterministik mayın güncellemesi: düşman kara-birimi tetiklerse patla (alan-hasarı), mayını kaldır.
function updateMines(now) {
    if (!SIM.mines.length) return;
    for (let i = SIM.mines.length - 1; i >= 0; i--) {
        const m = SIM.mines[i];
        if (!m.armed) { if (now - m.createdAt > (m.armDelay || 1500)) m.armed = true; else continue; }   // kurulum gecikmesi
        let trig = null;
        const near = SIM.spatialGrid.getNearby(m.x, m.y, MINE_TRIGGER_R);
        for (const u of near) {
            if (u.dead || u.loaded || u.isAir || u.abandoned || u.isRed === m.isRed) continue;   // yalnız DÜŞMAN kara-birimi tetikler
            if (Math.hypot(u.x - m.x, u.y - m.y) <= MINE_TRIGGER_R) { trig = u; break; }
        }
        if (!trig) continue;
        // PATLA: alan-hasarı (he), zırhlıya matris + alt-yön (mayın alttan vurur → zayıf top-armor)
        const blast = SIM.spatialGrid.getNearby(m.x, m.y, MINE_BLAST_R);
        for (const n of blast) {
            if (n.dead || n.loaded || n.isAir || n.isRed === m.isRed) continue;
            const d = Math.hypot(n.x - m.x, n.y - m.y); if (d > MINE_BLAST_R) continue;
            const falloff = 1 - d / MINE_BLAST_R;
            let dmg = calculateUnitDamageTyped ? calculateUnitDamageTyped('he', n, MINE_DAMAGE) : MINE_DAMAGE;
            const af = STATS[n.type] && STATS[n.type].armorFacing;
            if (af && af.top) dmg *= Math.min(2.0, 1 / af.top);   // alttan/üstten zayıf zırh
            dmg = Math.max(1, Math.floor(dmg * (0.55 + falloff * 0.45)));
            n.hp -= dmg; n.flashTimer = 6; n.suppression = Math.min(100, (n.suppression || 0) + 40);
            if (n.hp <= 0 && !n.dead) { n.dead = true; if (n.isRed) { if (typeof player !== 'undefined') player.kills++; } else { if (typeof enemy !== 'undefined') enemy.kills++; } if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) BATTLE_BALANCE.mineKills++; }
        }
        if (typeof spawnExplosion !== 'undefined') spawnExplosion(m.x, m.y, 1.8);
        if (typeof triggerScreenShake === 'function') triggerScreenShake(0.12);
        SIM.mines.splice(i, 1);   // mayın tek-kullanım
    }
}
// he-tipli mayın hasarı için yardımcı (calculateUnitDamage weapon[0]'a bağlı; mayın silahsız → tipli hesap)
function calculateUnitDamageTyped(dmgType, target, baseDamage) {
    const tS = STATS[target.type]; if (!tS) return baseDamage;
    const mult = (UNITS_MODERN_DB.damageMatrix[dmgType] || {})[tS.armorType || 'infantry'] || 0;
    if (mult === 0) return Math.max(1, Math.floor(baseDamage * 0.25));
    const armorRed = 1 / (1 + (tS.armorValue || 0) * 0.06);
    return Math.max(1, Math.round(baseDamage * mult * armorRed));
}
const SUPPLY_FIELD_DURATION_MS = 60000;
const craters = [];
const decals = []; // { x, y, type, size, alpha, angle }

// ── BAKED-GROUND: kalıcı savaş izleri (ceset/kan/scorch) world-uzaylı tek offscreen canvas'a STAMP ──
// Her kare N decal yeniden çizilmez; yeni decal'ler bir kez damgalanır, görünür bölge tek drawImage ile basılır.
let groundCanvas = null, groundCtx = null;
function initGroundCanvas() {
    if (typeof SIM !== 'undefined' && SIM.headless) return;
    if (typeof document === 'undefined' || !document.createElement) return;
    if (!groundCanvas) {
        groundCanvas = document.createElement('canvas');
        groundCanvas.width = WORLD_W; groundCanvas.height = WORLD_H;
        groundCtx = groundCanvas.getContext('2d');
    }
}
function resetGroundCanvas() {            // yeni maç → önceki izleri temizle
    initGroundCanvas();
    if (groundCtx) groundCtx.clearRect(0, 0, WORLD_W, WORLD_H);
    craters.length = 0; decals.length = 0;
}
function bakeGround() {                   // kuyruktaki yeni decal/crater'ları damgala, sonra kuyruğu boşalt
    if (typeof SIM !== 'undefined' && SIM.headless) return;
    if (!groundCtx) { initGroundCanvas(); if (!groundCtx) return; }
    for (const c of craters) {
        groundCtx.fillStyle = `rgba(10, 15, 10, ${c.alpha})`;
        groundCtx.beginPath(); groundCtx.arc(c.x, c.y, c.r, 0, Math.PI * 2); groundCtx.fill();
    }
    craters.length = 0;
    for (const d of decals) {
        groundCtx.save();
        groundCtx.translate(d.x, d.y);
        if (d.angle) groundCtx.rotate(d.angle);
        groundCtx.globalAlpha = d.alpha;
        if (d.type === 'blood') {
            groundCtx.fillStyle = '#6b0000';
            groundCtx.beginPath(); groundCtx.arc(0, 0, d.size, 0, Math.PI * 2); groundCtx.fill();
        } else if (d.type === 'track') {
            groundCtx.fillStyle = 'rgba(20, 15, 10, 0.4)';
            groundCtx.fillRect(-d.size, -d.size / 2, d.size * 2, d.size);
        } else if (d.type === 'wreck') {
            groundCtx.fillStyle = '#3a3a3a';
            groundCtx.fillRect(-d.size, -d.size, d.size * 2, d.size * 2);
            groundCtx.strokeStyle = '#222'; groundCtx.lineWidth = 2; groundCtx.strokeRect(-d.size, -d.size, d.size * 2, d.size * 2);
        }
        groundCtx.restore();
    }
    groundCtx.globalAlpha = 1;
    decals.length = 0;
}

// ── T2 YÜKSELTİ: harita-geneli SÜREKLİ yükselti alanı (deterministik fraktal value-noise) ──
// Daire-tepe yerine doğal heightmap; kuşbakışı topografik KONTUR çizgileriyle render. Yüksek-zemin avantajı HER YERDE.
let currentElevSeed = 7919;
let elevCanvas = null, elevCtx = null, _elevDirty = true;
function _eHash(ix, iy, seed) {                  // 32-bit integer hash → [0,1), saf aritmetik (bit-tutarlı)
    let h = ((ix | 0) * 374761393 + (iy | 0) * 668265263 + (seed | 0) * 1274126177) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) | 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967296;
}
function _eSmooth(t) { return t * t * (3 - 2 * t); }     // smoothstep (polinom; transcendental YOK)
function _eNoise(x, y, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = _eSmooth(x - x0), fy = _eSmooth(y - y0);
    const v00 = _eHash(x0, y0, seed), v10 = _eHash(x0 + 1, y0, seed);
    const v01 = _eHash(x0, y0 + 1, seed), v11 = _eHash(x0 + 1, y0 + 1, seed);
    const a = v00 + (v10 - v00) * fx, b = v01 + (v11 - v01) * fx;
    return a + (b - a) * fy;
}
function elevationAt(x, y) {                      // 0..1 yükseklik; grid modunda ızgaradan, yoksa her dağ=ayrı tepe
    if (typeof MAP_MODE !== 'undefined' && MAP_MODE === 'grid') {
        return (typeof gridElevationAt === 'function') ? gridElevationAt(x, y) : 0;
    }
    let e = 0;
    for (const f of terrainFeatures) {
        if (f.type !== TERRAIN.MOUNTAIN) continue;
        // Domain warp: örnek noktayı noise ile kaydır → organik/asimetrik tepe şekli
        const wx = x + f.r * 0.32 * (_eNoise(x / 215, y / 215, f.seed * 5    ) - 0.5) * 2;
        const wy = y + f.r * 0.32 * (_eNoise(x / 215, y / 215, f.seed * 5 + 3) - 0.5) * 2;
        const dist = Math.sqrt((wx - f.x) * (wx - f.x) + (wy - f.y) * (wy - f.y));
        const tt = Math.max(0, 1 - dist / (f.r * 1.9));
        e = Math.max(e, tt * tt * (3 - 2 * tt));    // max → tepeler iç içe geçmez
    }
    // Çok hafif arka plan dalgası (ova alanlarına derinlik)
    const s = currentElevSeed;
    e += (_eNoise(x / 960, y / 960, s) * 0.5 + _eNoise(x / 460, y / 460, s + 131) * 0.5) * 0.06 - 0.03;
    return Math.max(0, Math.min(1, e));
}
function bakeTerrainElevation() {                 // topo kontur: her dağ etrafında eşmerkezli halkalar
    _elevDirty = false;
    if (typeof SIM !== 'undefined' && SIM.headless) return;
    if (typeof document === 'undefined' || !document.createElement) return;
    if (!elevCanvas) { elevCanvas = document.createElement('canvas'); elevCanvas.width = WORLD_W; elevCanvas.height = WORLD_H; elevCtx = elevCanvas.getContext('2d'); }
    const c = elevCtx; c.clearRect(0, 0, WORLD_W, WORLD_H);
    const step = 50, cols = Math.ceil(WORLD_W / step), rows = Math.ceil(WORLD_H / step);
    const E = [];
    for (let j = 0; j <= rows; j++) { E[j] = []; for (let i = 0; i <= cols; i++) E[j][i] = elevationAt(i * step, j * step); }

    const gridMode = (typeof MAP_MODE !== 'undefined' && MAP_MODE === 'grid');

    // Geçiş 1: dağ bölgelerine hafif ısıl dolgu (yalnız circle modunda; grid'de zemin rengi tipi belli eder)
    if (!gridMode) {
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
            const avg = (E[j][i] + E[j][i + 1] + E[j + 1][i + 1] + E[j + 1][i]) * 0.25;
            if (avg < 0.08) continue;
            const alpha = Math.min(0.28, (avg - 0.08) * 0.30);
            c.fillStyle = `rgba(195,165,90,${alpha.toFixed(3)})`;
            c.fillRect(i * step, j * step, step + 1, step + 1);
        }
    }

    // Geçiş 2: topografik kontur çizgileri (marching squares) — dağ kütlelerini saran halkalar
    const levels = gridMode ? [0.14, 0.26, 0.40, 0.55, 0.72] : [0.10, 0.24, 0.38, 0.52, 0.68, 0.83];
    c.lineJoin = 'round'; c.lineCap = 'round';
    for (let li = 0; li < levels.length; li++) {
        const L = levels[li];
        c.lineWidth = (li % 3 === 2) ? 7 : 5;                       // her 3. çizgi "index" = biraz kalın
        const opacity = 0.48 + li * 0.08;
        c.strokeStyle = `rgba(125,95,42,${Math.min(1, opacity).toFixed(2)})`;
        c.beginPath();
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
            const x0 = i * step, y0 = j * step, x1 = x0 + step, y1 = y0 + step;
            const a = E[j][i], b = E[j][i + 1], cc = E[j + 1][i + 1], d = E[j + 1][i];
            const cs = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (cc > L ? 2 : 0) | (d > L ? 1 : 0);
            if (cs === 0 || cs === 15) continue;
            const TP = () => [x0 + step * ((L - a) / (b - a)), y0];
            const RT = () => [x1, y0 + step * ((L - b) / (cc - b))];
            const BT = () => [x0 + step * ((L - d) / (cc - d)), y1];
            const LF = () => [x0, y0 + step * ((L - a) / (d - a))];
            const sg = (p, q) => { c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); };
            switch (cs) {
                case 1: case 14: sg(LF(), BT()); break;
                case 2: case 13: sg(BT(), RT()); break;
                case 3: case 12: sg(LF(), RT()); break;
                case 4: case 11: sg(TP(), RT()); break;
                case 5: sg(LF(), TP()); sg(BT(), RT()); break;
                case 6: case 9: sg(TP(), BT()); break;
                case 7: case 8: sg(LF(), TP()); break;
                case 10: sg(LF(), BT()); sg(TP(), RT()); break;
            }
        }
        c.stroke();
    }
}

let mouseScreenX = 500, mouseScreenY = 500;
let isDragging = false;
let dragStartX = 0, dragStartY = 0;
let selectedSpawnType = null;

// ─── SAVAŞ SİSİ KONTROLÜ (Team Vision) ───
// targetIsAir verilirse: HAVA-ARAMA RADARI (airRadar) YALNIZ hava hedefini açar (görüş-desteği);
// normal birimler her şeyi görür (eskisi gibi). Radar karayı görmez → "sadece havayı görsün".
function canSee(teamIsRed, targetX, targetY, targetIsAir) {
    for (const u of SIM.units) {
        if (u.dead || u.isRed !== teamIsRed) continue;
        if (u.loaded) continue;                                   // TAŞINAN piyade görüş sağlamaz (araç içinde)
        // KARIŞTIRILAN İHA GÖRÜŞ SAĞLAMAZ (BATTLE_JAM_RECON). ÖLÇÜLDÜ: keşif İHA'sını karıştırmayı
        // açmak maç sonucunu HİÇ değiştirmedi (marj birebir aynı) — çünkü jamming yalnız ATEŞ ve
        // HAREKET'i kesiyordu; silahsız gözcü donuk hâlde bile görmeye devam ediyordu. Halenin
        // ilan ettiği şey ise KONTROL BAĞININ kopması. Bağ koptuysa görüntü de akmaz.
        if (u.jammable && typeof BATTLE_JAM_RECON !== 'undefined' && BATTLE_JAM_RECON &&
            typeof SIM !== 'undefined' && (SIM.tick - (u.jammedTick || -99)) <= 1) continue;
        if (u.airRadar && targetIsAir !== true) continue;         // radar yalnız havayı açar
        const vision = Number.isFinite(u.vision) ? u.vision : STATS[u.type].vision;
        if (Math.hypot(u.x - targetX, u.y - targetY) <= vision) return true;
    }
    // Kendi güvenli üssünü her zaman görebilir
    if (!teamIsRed && targetY > WORLD_H * 0.7) return true; 
    if (teamIsRed && targetY < WORLD_H * 0.3) return true;
    return false;
}

// ─── NOKTA-SAVUNMA (SAM füze-savar): gelen interceptable mermiyi (balistik/ÇNRA) düşman SAM önler mi? ───
// Deterministik (srand). Önleme bir SAM füzesi harcar (ammo) → doyurma saldırısı (çok füze) yine işler.
const POINT_DEFENSE_QUERY_R = 2200;   // ızgara-sorgu yarıçapı (en uzun SAM menzilini kapsar)
const POINT_DEFENSE_MIN_DAMAGE = 150; // SAM yalnız YÜKSEK-değerli mermiyi önler (balistik 600); ÇNRA roketi (55) gibi ucuz-çok mermiye füze harcamaz → "salvo SAM'ı boşaltma" istismarı biter
const POINT_DEFENSE_AIR_RESERVE = 3;  // KULLANICI-KURALI: rakibin BİLİNEN hava kuvveti varsa son 3 füze hava savunmasına saklanır (mermiye harcanmaz)

// HAVA TEHDİDİ (savunucu d'nin gözünden): known = d'nin tarafının GÖRDÜĞÜ düşman uçağı var mı; inRange = o an d'nin menzilinde mi.
// Determinist: canSee (sis) + sabit birim-sırası, RNG yok. Kontrolör/AI durumu OKUNMAZ (sim ↔ AI sınırı korunur).
function battleAirThreatFor(d) {
    const pdRange = d.range || 1000;
    let known = false, inRange = false;
    for (const u of SIM.units) {
        if (u.dead || u.loaded || !u.isAir || u.isRed === d.isRed) continue;
        if (typeof canSee === 'function' && !canSee(d.isRed, u.x, u.y, true)) continue;   // yalnız BİLİNEN (görülen) hava kuvveti
        known = true;
        if (Math.hypot(u.x - d.x, u.y - d.y) <= pdRange) { inRange = true; break; }        // menzilde → angaje edilebilir
    }
    return { known, inRange };
}
// Döner: 1=önlendi(engage+isabet), -1=engage+ıska(füze harcandı), 0=hiç PD-engage yok. salvoMode=true → eşik-altı mermiye de müdahale
// (ÇNRA salvo-PD; çağıran SALVO-BÜTÇESİ ile atış-sayısını sınırlar → SAM-mühimmatı boşaltma-istismarı yok).
// `out` (opsiyonel) verilirse ateşleyen savunucunun FIRLATMA-ANI skalerleri yazılır ({id,x,y}) → çağıran önleyici-füze
// görselini ve HAVADA kesişme noktasını bundan kurar (canlı-ref taşımaz).
function battlePointDefenseIntercept(shooter, x, y, incomingDamage, salvoMode, out) {
    if (!salvoMode && (incomingDamage || 0) < POINT_DEFENSE_MIN_DAMAGE) return 0;   // eşik-altı + salvo-modu-değil → müdahale yok (mühimmat korunur)
    const near = SIM.spatialGrid.getNearby(x, y, POINT_DEFENSE_QUERY_R);
    for (const d of near) {
        if (d.dead || d.loaded || d.isRed === shooter.isRed) continue;   // yalnız DÜŞMAN savunması
        const st = STATS[d.type];
        if (!st || !st.pointDefense || d.ammo <= 0) continue;            // savunma yeteneği + füzesi olmalı
        const pdRange = d.range || 1000;
        if (Math.hypot(d.x - x, d.y - y) > pdRange) continue;            // impact SAM menzilinde mi
        // ── KULLANICI-DOKTRİNİ: SAM'in ÖNCELİĞİ UÇAKTIR ──
        // (1) Menzilinde angaje edilebilir düşman uçağı VARSA füzeyi mermiye harcama (uçak+mermi aynı anda sınırı ihlal
        //     ediyorsa uçak önce). (2) Rakibin BİLİNEN hava kuvveti varsa son POINT_DEFENSE_AIR_RESERVE füze saklanır.
        const _air = battleAirThreatFor(d);
        if (_air.inRange || (_air.known && d.ammo <= POINT_DEFENSE_AIR_RESERVE)) {
            // ANALİST: neden önlemedi (görünmez karar olmasın) — savunucu-başı throttle, sim-durumuna dokunmaz
            if (typeof battleRecordLifeEvent === 'function' && (SIM.tick - (d._lastPdHold || -999)) >= 40) {
                d._lastPdHold = SIM.tick;
                battleRecordLifeEvent({ kind: 'PD_HOLD', unitId: d.id, side: d.isRed ? 'red' : 'blue', type: d.type,
                    reason: _air.inRange ? 'air_priority' : 'air_reserve', ammoLeft: Math.round(d.ammo),
                    x: Math.round(d.x * 100) / 100, y: Math.round(d.y * 100) / 100 });
            }
            continue;   // bu savunucu mermiye ateş etmez → sıradaki aday savunucuya bak
        }
        d.ammo = Math.max(0, d.ammo - 1);                                // önleme denemesi bir füze harcar (P2: negatif-mühimmat kelepçesi)
        d.lastAttackTime = SIM.tick;
        if (out) { out.id = d.id; out.x = d.x; out.y = d.y; }            // önleyici-füzenin çıkış noktası (fırlatma-anı skaleri)
        const _hit = srand() < (st.pointDefense.chance || 0.6);          // srand TEK tüketim (determinizm) — hem sonuç hem olay
        // ANALİST-FIX: INTERCEPT telemetri-olayı — PD oyunun en pahalı tek-atışlık etkileşimi, görünmez kalmasın (deneme/sonuç/mesafe/mühimmat)
        if (typeof battleRecordLifeEvent === 'function') battleRecordLifeEvent({ kind: 'INTERCEPT', unitId: d.id, side: d.isRed ? 'red' : 'blue', type: d.type, shooterType: shooter ? shooter.type : null, salvo: !!salvoMode, result: _hit ? 'hit' : 'miss', incomingDamage: Math.round(incomingDamage || 0), dist: Math.round(Math.hypot(d.x - x, d.y - y)), ammoLeft: Math.round(d.ammo), x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
        if (_hit) {
            // NOT: patlama artık BURADA değil — mermi HAVADA yol alır ve kesişme tik'inde (killTick) orada patlar
            // (battleProcessPendingHits). Eskiden hedefin üstünde patlıyordu; mermi hiç uçmuyordu.
            return 1;                                                    // MERMİ ÖNLENDİ (uçuş ortasında düşürülecek)
        }
        return -1;                                                       // deneme ıskaladı (füze harcandı, mermi geçti)
    }
    return 0;                                                            // hiç PD engage etmedi (ammo harcanmadı)
}

// ONDEATH-EFEKTLERİ (kullanıcı-kararı: command_shock uygula): yeni-ölen onDeath'li birim → tek-seferlik efekt. command_shock =
// komuta-aracı ölünce yarıçap-içi dostlara emir-felci (bastırma-şoku + 12sn koordinesiz-ateş −%28). Getiri-dengeli: güçlü halenin
// yüksek-risk dezavantajı. Determinist (mesafe+tik, RNG-yok). _deathFxDone yalnız onDeath'li birimde işaretlenir (serialize edilir).
// DEFERRED-DAMAGE VARIŞ-İŞLEYİCİSİ: fırlatma-anında push edilen bekleyen-vuruşlar arriveTick geldiğinde uygulanır. Determinist:
// (arriveTick,seq) sıralı, srand-YOK (tüm zar fire-time'da atıldı), skaler-snapshot'tan çalışır. stepSim'de battleApplyDeathEffects'ten
// HEMEN ÖNCE çağrılır (varışta-ölen birim aynı-tik onDeath-sweep'i alsın). Stage-0: kuyruk hep boş → davranış-değişmez.
function battleProcessPendingHits(now) {
    if (typeof SIM === 'undefined' || !SIM.pendingHits || !SIM.pendingHits.length) return;
    const q = SIM.pendingHits;
    const now2 = SIM.tick || 0;
    // ── HAVADA ÖNLEME (nokta-savunma): killTick'i gelen mermi UÇUŞ ORTASINDA düşürülür — hasar UYGULANMAZ,
    // patlama kesişme noktasında (önleyici füze görseli fırlatma-anında oraya yollandı → havada çarpışma görünür).
    // Varış işlemesinden ÖNCE: killTick == arriveTick olsa bile mermi hedefe ULAŞMAZ.
    for (let i = q.length - 1; i >= 0; i--) {
        const h = q[i];
        if (h.killTick != null && h.killTick <= now2) {
            q.splice(i, 1);
            if (!SIM.headless && typeof spawnExplosion === 'function') spawnExplosion(h.killX, h.killY, 0.9);   // görsel-only
        }
    }
    if (!q.length) return;
    const due = [];
    for (let i = q.length - 1; i >= 0; i--) {
        if (q[i].arriveTick <= now2) { due.push(q[i]); q.splice(i, 1); }
    }
    if (!due.length) return;
    due.sort((a, b) => (a.arriveTick - b.arriveTick) || (a.seq - b.seq));   // SABİT sıra: aynı-tik varışlar fırlatma-sırasıyla iner
    for (const hit of due) {
        if (hit.kind === 'direct') applyDirectHit(hit, now);
        else if (hit.kind === 'blast') applyBlast(hit, now);
    }
}

// Kimlikten canlı-birim çözümü (fork/replay güvenli: pending-hit yalnız id taşır, canlı-referans TAŞIMAZ).
function battleUnitById(id) {
    if (id == null || typeof SIM === 'undefined' || !SIM.units) return null;
    for (const u of SIM.units) { if (u.id === id) return u; }
    return null;
}

// ─── DEFERRED-DAMAGE: TEK-HEDEF vuruşunun VARIŞ-anı uygulaması ───
// srand KULLANMAZ — kritik/terk zarları fırlatma-anında atıldı, sonuçları hit'te taşınıyor. Hasar, fırlatma-skalerleri
// ile VARIŞ-anı hedef-durumunun saf fonksiyonu. Hedef uçuşta öldüyse mermi boşa gider (fizzle); ATICI öldüyse mermi
// yine iner (yan-skoru işler, per-birim XP atlanır).
function applyDirectHit(hit, now) {
    const tgt = battleUnitById(hit.tgtId);
    if (!tgt || tgt.dead) return;                       // hedef fırlatma↔varış arasında öldü → mermi boşa
    const atk = battleUnitById(hit.atkId);
    const atkAlive = !!(atk && !atk.dead);
    const dmg = hit.dmg;
    const hpBefore = tgt.hp;
    const actual = Math.min(tgt.hp, dmg);
    tgt.hp -= dmg;

    // MISSION-KILL: zar fırlatmada atıldı (willAbandon); burada YALNIZ canlı-önkoşul yeniden doğrulanır.
    // Boşa çıkan zar determinizm-güvenli (srand tüketimi fırlatma-anında zaten oldu).
    if (hit.willAbandon && !tgt.dead && !tgt.abandoned && tgt._crewed && tgt.hp > 0 && tgt.hp < tgt.maxHp * 0.30) {
        tgt.abandoned = true; tgt.abandonedTick = SIM.tick;
        tgt.attackTarget = null; tgt.manualTarget = null;
        tgt.isFleeing = false; tgt.isMovingToManualTarget = false;
        tgt.suppression = 0; tgt.panic = 0;
        tgt.combatState = 'Terk Edildi';
        if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) BATTLE_BALANCE.abandoned++;
        if (typeof battleRecordLifeEvent === 'function') battleRecordLifeEvent({ kind: 'ABANDON', unitId: tgt.id, side: tgt.isRed ? 'red' : 'blue', type: tgt.type, byId: hit.atkId, crit: !!hit.isCrit, x: Math.round(tgt.x * 100) / 100, y: Math.round(tgt.y * 100) / 100 });
    }

    if (typeof battleRecordCombatEvent === 'function') {
        battleRecordCombatEvent({
            kind: hit.evt || 'DIRECT_FIRE',
            attackerId: hit.atkId, attackerSide: hit.atkIsRed ? 'red' : 'blue', attackerType: hit.atkType,
            targetId: tgt.id, targetSide: tgt.isRed ? 'red' : 'blue', targetType: tgt.type,
            damage: Math.round(actual * 100) / 100,
            hpBefore: Math.round(hpBefore * 100) / 100,
            hpAfter: Math.round(Math.max(0, tgt.hp) * 100) / 100,
            lethal: tgt.hp <= 0,
            rearHit: !!hit.isRear, flankHit: !!hit.isFlank,
            attackerX: Math.round(hit.atkX * 100) / 100, attackerY: Math.round(hit.atkY * 100) / 100,   // FIRLATMA konumu
            targetX: Math.round(tgt.x * 100) / 100, targetY: Math.round(tgt.y * 100) / 100              // VARIŞ konumu
        });
    }

    tgt.flashTimer = hit.isCrit ? 8 : (hit.flash || 6);
    if (typeof addDamageNumber === 'function') addDamageNumber(tgt, actual, !!(hit.isCrit || hit.isRear));
    if (hit.knock && typeof applyKnockback === 'function') applyKnockback(tgt, hit.atkX, hit.atkY, hit.knock);
    tgt.panic += (dmg / tgt.maxHp) * (hit.panicMul || 150);
    if (hit.isFlank) tgt.panic += hit.isRear ? 18 : 9;   // yandan/arkadan vurulmak = moral ŞOKU
    if (hit.supp) tgt.suppression += hit.supp;
    if (hit.sparks !== false && tgt.armor > 0 && typeof spawnHitSparks !== 'undefined') spawnHitSparks(tgt.x, tgt.y);
    if (tgt.isRed) {
        tgt.lastHitTime = now;
        if (hit.distress !== false) { tgt.distressX = hit.atkX; tgt.distressY = hit.atkY; }
    }

    // TANK MERMİSİ = dar HE alanı: birincil tam vuruşunu aldı, ÇEVREDEKİLER varış-anı konumlarına göre splash yer.
    if (hit.splashR > 0) applyTankSplash(hit, tgt, now, atk, atkAlive);

    if (tgt.hp <= 0 && !tgt.dead) {
        tgt.dead = true;
        if (hit.atkIsRed) enemy.kills++; else player.kills++;
        battlePushDeathDecal(tgt);
        if (atkAlive) {
            atk.kills++;
            if (hit.xp !== false) {
                if (atk.kills === 3 && atk.level === 0) { atk.level = 1; atk.xpBonus = 1.15; atk.maxHp *= 1.15; atk.hp += atk.maxHp * 0.15; }
                else if (atk.kills === 7 && atk.level === 1) { atk.level = 2; atk.xpBonus = 1.30; atk.maxHp *= 1.15; atk.hp += atk.maxHp * 0.15; }
            }
            if (atk.attackTarget === tgt) { atk.attackTarget = null; atk.manualTarget = null; }
        }
    }
}

// Tank mermisinin dar HE halkası — VARIŞ noktasındaki (impact) birimlere. srand YOK; hasar fırlatma-skalerlerinden.
function applyTankSplash(hit, impactUnit, now, atk, atkAlive) {
    const cx = impactUnit.x, cy = impactUnit.y, R = hit.splashR;
    for (const n of SIM.spatialGrid.getNearby(cx, cy, R)) {
        if (n.dead) continue;
        if (n.isRed === hit.atkIsRed) {                        // dost: sadece baskı
            if (Math.hypot(n.x - cx, n.y - cy) <= R) n.suppression += 40;
            continue;
        }
        if (n === impactUnit) continue;                        // tam vuruşu aldı
        const distance = Math.hypot(n.x - cx, n.y - cy);
        if (distance > R) continue;
        const falloff = 1 - distance / R;
        const ratio = TANK_SPLASH_MIN + falloff * (TANK_SPLASH_MAX - TANK_SPLASH_MIN);
        const blastDmg = Math.max(1, Math.floor(calculateUnitDamage(hit.atkType, n.type, hit.atkPower, n.armor) * ratio));
        const hpBefore = n.hp;
        const blastActual = Math.min(n.hp, blastDmg);
        n.hp -= blastDmg;
        if (typeof battleRecordCombatEvent === 'function') {
            battleRecordCombatEvent({
                kind: 'TANK_SPLASH',
                attackerId: hit.atkId, attackerSide: hit.atkIsRed ? 'red' : 'blue', attackerType: hit.atkType,
                targetId: n.id, targetSide: n.isRed ? 'red' : 'blue', targetType: n.type,
                damage: Math.round(blastActual * 100) / 100,
                hpBefore: Math.round(hpBefore * 100) / 100,
                hpAfter: Math.round(Math.max(0, n.hp) * 100) / 100,
                lethal: n.hp <= 0,
                attackerX: Math.round(hit.atkX * 100) / 100, attackerY: Math.round(hit.atkY * 100) / 100,
                targetX: Math.round(n.x * 100) / 100, targetY: Math.round(n.y * 100) / 100
            });
        }
        n.panic += (blastDmg / n.maxHp) * 120;
        n.flashTimer = 5;
        if (typeof applyKnockback === 'function') applyKnockback(n, cx, cy, 1.8);
        n.suppression += 25;
        if (n.isRed) { n.lastHitTime = now; n.distressX = hit.atkX; n.distressY = hit.atkY; }
        if (n.armor > 0 && typeof spawnHitSparks !== 'undefined') spawnHitSparks(n.x, n.y);
        if (n.hp <= 0 && !n.dead) {
            n.dead = true;
            if (hit.atkIsRed) enemy.kills++; else player.kills++;
            battlePushDeathDecal(n);
            if (atkAlive) {
                atk.kills++;
                if (atk.kills === 3 && atk.level === 0) { atk.level = 1; atk.xpBonus = 1.15; atk.maxHp *= 1.15; atk.hp += atk.maxHp * 0.15; }
                else if (atk.kills === 7 && atk.level === 1) { atk.level = 2; atk.xpBonus = 1.30; atk.maxHp *= 1.15; atk.hp += atk.maxHp * 0.15; }
            }
        }
    }
}

// ─── DEFERRED-DAMAGE: DOLAYLI ATEŞ (AoE) mermisinin VARIŞ-anı patlaması ───
// Saçılım ve nokta-savunma zarları FIRLATMADA atıldı; burada srand YOK. Mermi (cx,cy)'ye iner ve O ANDA orada olan
// birimleri vurur — hedef uçuşta yer değiştirmişse mermi boş araziye düşer (fiziksel olarak doğru).
// Hasar VARIŞ-anı hedef-durumuna göre yeniden hesaplanır (zırh/siper/işaretli), atıcının fırlatma-skalerleriyle.
function applyBlast(hit, now) {
    const atk = battleUnitById(hit.atkId);
    const atkAlive = !!(atk && !atk.dead);
    const atkShim = { type: hit.atkType, isRed: hit.atkIsRed };   // tech-bonusu için saf skaler vekil (canlı-ref YOK)
    const cx = hit.cx, cy = hit.cy, blastR = hit.blastR, suppR = hit.suppR;
    for (const n of SIM.spatialGrid.getNearby(cx, cy, suppR)) {
        if (n.dead || n.isRed === hit.atkIsRed || n.abandoned) continue;   // sadece düşman (terk-edilmiş nötr atlanır)
        const distance = Math.hypot(n.x - cx, n.y - cy);
        if (distance > suppR) continue;
        if (distance > blastR) {   // hasar-dışı ama BASTIRMA halkası: pinler (isabet almadan sindirir)
            n.suppression = Math.min(100, n.suppression + 16);
            if (n.isRed) n.lastHitTime = now;
            continue;
        }
        const falloff = 1 - distance / blastR;
        const blastDmg = Math.max(1, Math.floor(
            applyTechCombatBonus(atkShim, n, calculateUnitDamage(hit.atkType, n.type, hit.atkPower, n.armor)) *
            (0.5 + falloff * 0.5) * hit.indAcc * incomingDamageMult(n)
        ));
        const hpBefore = n.hp;
        const blastActual = Math.min(n.hp, blastDmg);
        n.hp -= blastDmg;
        if (typeof battleRecordCombatEvent === 'function') {
            battleRecordCombatEvent({
                kind: hit.evt || 'ARTILLERY_SPLASH',
                attackerId: hit.atkId, attackerSide: hit.atkIsRed ? 'red' : 'blue', attackerType: hit.atkType,
                targetId: n.id, targetSide: n.isRed ? 'red' : 'blue', targetType: n.type,
                damage: Math.round(blastActual * 100) / 100,
                hpBefore: Math.round(hpBefore * 100) / 100,
                hpAfter: Math.round(Math.max(0, n.hp) * 100) / 100,
                lethal: n.hp <= 0,
                attackerX: Math.round(hit.atkX * 100) / 100, attackerY: Math.round(hit.atkY * 100) / 100,
                targetX: Math.round(n.x * 100) / 100, targetY: Math.round(n.y * 100) / 100
            });
        }
        n.panic += (blastDmg / n.maxHp) * 120;
        n.flashTimer = 5;
        if (typeof applyKnockback === 'function') applyKnockback(n, cx, cy, 1.6);
        n.suppression += 30;                                  // alan baskısı
        if (n.isRed) { n.lastHitTime = now; n.distressX = hit.atkX; n.distressY = hit.atkY; }
        if (n.armor > 0 && typeof spawnHitSparks !== 'undefined') spawnHitSparks(n.x, n.y);
        if (n.hp <= 0 && !n.dead) {
            n.dead = true;
            if (hit.atkIsRed) enemy.kills++; else player.kills++;
            battlePushDeathDecal(n);
            if (atkAlive) {
                atk.kills++;
                if (atk.kills === 3 && atk.level === 0) { atk.level = 1; atk.xpBonus = 1.15; atk.maxHp *= 1.15; atk.hp += atk.maxHp * 0.15; }
                else if (atk.kills === 7 && atk.level === 1) { atk.level = 2; atk.xpBonus = 1.30; atk.maxHp *= 1.15; atk.hp += atk.maxHp * 0.15; }
                if (atk.attackTarget === n) { atk.attackTarget = null; atk.manualTarget = null; }
            }
        }
    }
}

// Ölüm izi (kozmetik — Math.random SADECE görsel boyutta; sim-durumuna girmez).
function battlePushDeathDecal(u) {
    if (typeof decals === 'undefined') return;
    decals.push(isMedicHealable(u.type)
        ? { x: u.x, y: u.y, type: 'blood', size: 10 + Math.random() * 15, alpha: 0.7 }
        : { x: u.x, y: u.y, type: 'wreck', size: 25, alpha: 1.0 });
    if (decals.length > 5000) decals.shift();
}

function battleApplyDeathEffects(now) {
    if (typeof SIM === 'undefined' || !SIM.units) return;
    const _DM = (typeof UNITS_MODERN_DB !== 'undefined') ? UNITS_MODERN_DB.damageMatrix : null;
    for (const u of SIM.units) {
        if (!u.dead) continue;
        const st = STATS[u.type];
        const od = st && st.onDeath;
        const ex = st && st.explodesOnDeath;
        if ((!od && !ex) || u._deathFxDone) continue;
        u._deathFxDone = true;                                            // tek-seferlik (ölü kalır, tekrar-işlenmez)
        // İKMAL-ARACI PATLAMASI (kullanıcı-kararı: explodesOnDeath bağla): kaza-cephane-tutuşması → IFF-YOK ("yakınına risk"): dost+düşman
        // yarıçap-içi herkes he-hasarı yer (kendi kütleni ikmal-aracının yanına yığma + point-blank killer'ı cezalandır). Determinist.
        if (ex) {
            const TP = (typeof TILE_PX !== 'undefined') ? TILE_PX : 35;
            const R = (ex.aoe || 3) * TP, R2 = R * R;
            const dtype = ex.damageType || 'he';
            for (const n of SIM.spatialGrid.getNearby(u.x, u.y, R)) {
                if (n.dead || n === u || n.loaded || n.abandoned) continue;   // IFF-yok: dost da vurulur
                const dx = n.x - u.x, dy = n.y - u.y, d2 = dx * dx + dy * dy; if (d2 > R2) continue;
                const dist = Math.sqrt(d2), falloff = 1 - dist / R;
                const arm = STATS[n.type] ? STATS[n.type].armorType : 'infantry';
                const eff = (_DM && _DM[dtype]) ? (_DM[dtype][arm] || 0) : 1;
                const dmg = Math.max(1, Math.floor((ex.damage || 150) * eff * (0.5 + falloff * 0.5)));
                const hpBefore = n.hp; const actual = Math.min(n.hp, dmg);
                n.hp -= dmg; n.suppression = Math.min(100, (n.suppression || 0) + 30); n.flashTimer = 5;
                if (typeof battleRecordCombatEvent === 'function') battleRecordCombatEvent({ kind: 'SUPPLY_EXPLOSION', attackerId: u.id, attackerSide: u.isRed ? 'red' : 'blue', attackerType: u.type, targetId: n.id, targetSide: n.isRed ? 'red' : 'blue', targetType: n.type, damage: Math.round(actual * 100) / 100, hpBefore: Math.round(hpBefore * 100) / 100, hpAfter: Math.round(Math.max(0, n.hp) * 100) / 100, lethal: n.hp <= 0, attackerX: Math.round(u.x * 100) / 100, attackerY: Math.round(u.y * 100) / 100, targetX: Math.round(n.x * 100) / 100, targetY: Math.round(n.y * 100) / 100 });
                if (n.hp <= 0 && !n.dead) { n.dead = true; if (u.isRed) { if (typeof enemy !== 'undefined') enemy.kills++; } else if (typeof player !== 'undefined') player.kills++; }
            }
            if (typeof spawnExplosion !== 'undefined') spawnExplosion(u.x, u.y, 2.0);
        }
        if (od && od.effect === 'command_shock') {
            const TP = (typeof TILE_PX !== 'undefined') ? TILE_PX : 35;
            const R = (od.radius || 12) * TP, R2 = R * R;
            const _ts = (typeof BATTLE_TICK_SEC !== 'undefined') ? BATTLE_TICK_SEC : 0.05;
            const durTicks = Math.round((od.duration || 12) / _ts);        // 12sn → 240 tik
            let hit = 0;
            for (const f of SIM.units) {
                if (f.dead || f.isRed !== u.isRed || f === u || f.loaded) continue;
                const dx = f.x - u.x, dy = f.y - u.y; if (dx * dx + dy * dy > R2) continue;
                f._cmdShockUntil = (SIM.tick || 0) + durTicks;             // emir-felci penceresi (performAttack'ta ×0.72)
                f.suppression = Math.min(100, (f.suppression || 0) + 45);  // ani bastırma-şoku
                hit++;
            }
            if (typeof battleRecordLifeEvent === 'function') battleRecordLifeEvent({ kind: 'COMMAND_SHOCK', unitId: u.id, side: u.isRed ? 'red' : 'blue', type: u.type, affected: hit, durationSec: od.duration || 12, x: Math.round(u.x * 100) / 100, y: Math.round(u.y * 100) / 100 });
        }
    }
}

// T3 PUSU+KEŞİF: viewerIsRed tarafı gizli u'yu fark ediyor mu — KEŞİF birimi 2× mesafeden tespit eder (pusu-karşıtı)
function enemyDetectsConcealed(u, viewerIsRed) {
    const maxR = AMBUSH_DETECT * 2.5;
    const nearby = SIM.spatialGrid.getNearby(u.x, u.y, maxR);
    for (const o of nearby) {
        if (o.dead || o === u || o.isRed !== viewerIsRed || o.loaded) continue;
        // DETECT stat: yüksek-detect birim (keşif/scout/EH/manpads) gizli düşmanı DAHA UZAKTAN fark eder (1 + detect×1.5)
        const det = (STATS[o.type] && STATS[o.type].detect) || 0;
        const r = AMBUSH_DETECT * (1 + det * 1.5);
        if (Math.hypot(o.x - u.x, o.y - u.y) <= r) return true;
    }
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
        // DOLU HÜCRE İZİ (hız): clear() eskiden TÜM hücreleri geziyordu. Profil: her tik
        // çağrıldığı için toplam CPU'nun %9.2'siydi. Oysa dolu hücre sayısı en fazla birim
        // sayısı kadardır (~50), hücre sayısı ise binlerce. Davranış AYNI — boş hücrenin
        // uzunluğunu sıfırlamak zaten işlemsizdi.
        this.dolu = [];
    }

    clear() {
        for (let i = 0; i < this.dolu.length; i++) this.cells[this.dolu[i]].length = 0;
        this.dolu.length = 0;
    }

    insert(unit) {
        let cx = Math.floor(unit.x / this.cellSize);
        let cy = Math.floor(unit.y / this.cellSize);
        if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) return;
        const ix = cy * this.cols + cx;
        const cell = this.cells[ix];
        if (cell.length === 0) this.dolu.push(ix);   // ilk giren hücreyi izle (tekrar eklemez)
        cell.push(unit);
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
// blockingSide (isteğe bağlı): verilirse YALNIZ o taraftaki (dost) gövdeler engel sayılır; düşman gövdeler engellemez
// (hedef-edinmede "öndeki düşmanı vur, kendi adamının üstünden vurma" için). Verilmezse HER gövde engel (topçu-gözcü).
function checkLineOfSight(x1, y1, x2, y2, ignoreUnit1, ignoreUnit2, blockingSide) {
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
        if (blockingSide !== undefined && u.isRed !== blockingSide) continue;   // yalnız-dost modu: düşman gövde engel değil

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
    // ARAZİ engeli — grid modunda ışın-tarama; aksi halde daire-kesişim
    if (typeof MAP_MODE !== 'undefined' && MAP_MODE === 'grid') {
        if (typeof gridLOSBlocked === 'function' && gridLOSBlocked(x1, y1, x2, y2)) return false;
        return true;
    }
    // T1: orman/dağ çizgiyi kesiyorsa görüş kapanır (uçlardan biri arazinin İÇİNDEyse o arazi engellemez → ormanda yakın dövüş görür)
    if (typeof terrainFeatures !== 'undefined') {
        for (const t of terrainFeatures) {
            if (t.type !== TERRAIN.FOREST && t.type !== TERRAIN.MOUNTAIN) continue;
            const d1x = x1 - t.x, d1y = y1 - t.y, d2x = x2 - t.x, d2y = y2 - t.y;
            if (d1x * d1x + d1y * d1y <= t.r * t.r || d2x * d2x + d2y * d2y <= t.r * t.r) continue;
            const dotT = ((t.x - x1) * dx + (t.y - y1) * dy) / (len * len);
            if (dotT < 0 || dotT > 1) continue;
            const ex = t.x - (x1 + dotT * dx), ey = t.y - (y1 + dotT * dy);
            if (ex * ex + ey * ey < t.r * t.r) return false;
        }
    }
    return true;
}

// T1: TOPÇU GÖZCÜ — topçunun KENDİ LOS'u YA DA dost bir birim hedefi görüyor olmalı (all-arty dengesi: keşif ister)
function artilleryHasSight(shooter, target) {
    if (checkLineOfSight(shooter.x, shooter.y, target.x, target.y, shooter, target)) return true;
    const nearby = SIM.spatialGrid.getNearby(target.x, target.y, 850);
    for (const u of nearby) {
        if (u.dead || u === shooter || u.isRed !== shooter.isRed) continue;
        const dx = u.x - target.x, dy = u.y - target.y;
        const vis = STATS[u.type].vision;
        if (dx * dx + dy * dy <= vis * vis && checkLineOfSight(u.x, u.y, target.x, target.y, u, target)) return true;
    }
    return false;
}

// Inicialize
resize();
