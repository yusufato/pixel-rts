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
    /* ARKA TAMPON, ELEMANIN KENDİ ÖLÇÜSÜNDEN türetilir — window.innerWidth'ten DEĞİL.
       Yerleştirme fazında style.css tuvali `calc(100% - 330px)` daraltıyor (ordu
       kompozisyonu paneline yer açmak için) ama arka tampon pencere genişliğinde
       kalıyordu: 1522 piksellik tampon 1192 piksellik kutuya sıkışıyor ve savaş
       alanı DİKEY olarak %28 geriliyordu. Ölçüldü — çarpıklık (dikey/yatay ölçek):
           yerleştirme 1.2757   ·   savaş 0.9992
       Savaşta tuval tam genişlik olduğu için kusur yalnız yerleştirmede görünüyordu;
       birimler orada basık/uzun çiziliyordu. CSS genişliği FAZ DEĞİŞİMİNDE de
       değiştiği için (resize olayı tetiklenmez) bu eşitleme her karede yapılır. */
    const _w = Math.max(1, canvas.clientWidth || window.innerWidth);
    const _h = Math.max(1, canvas.clientHeight || window.innerHeight);
    if (canvas.width !== _w || canvas.height !== _h) {
        canvas.width = _w;
        canvas.height = _h;
        fogCanvas.width = _w;
        fogCanvas.height = _h;
    }


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

const SP_W = 320, SP_H = 320, SP_PAD = 30;   // icons.png: hücre 320×320, pad 30 (sx=30+type×350, sy kırmızı=380)

/* SPRITE-SÜTUN — sayfanın GERÇEK genişliğinden türetilir, sabit sayı değil.
   Eski sayfa 25 sütundu (8780 px) ve 26. birim `drone_operator` boş ikon
   almasın diye kamikaze(18) sprite'ına eşleniyordu. Yeni sanat 26 birimin
   hepsini ayrı çiziyor (9130 px). İkisi de çalışsın diye takma ad artık
   KOŞULLU: sayfada o sütun VARSA kendi ikonu, yoksa eski yedek.
   Böylece görsel değişimi ile kod değişimi birbirini beklemez. */
function battleSpriteSutunSayisi() {
    if (typeof spriteSheet === 'undefined' || !spriteSheet || !spriteSheet.naturalWidth) return 0;
    return Math.max(0, Math.floor((spriteSheet.naturalWidth - SP_PAD) / (SP_W + SP_PAD)));
}
function battleSpriteCol(type) {
    if (typeof T === 'undefined' || type !== T.DRONE_OPERATOR || T.KAMIKAZE == null) return type;
    return battleSpriteSutunSayisi() > type ? type : T.KAMIKAZE;
}
const BASE_DRAW_SCALE = 0.20;
const BASE_DRAW_W = SP_W * BASE_DRAW_SCALE;
const BASE_DRAW_H = SP_H * BASE_DRAW_SCALE;
const UNIT_RADIUS = Math.max(BASE_DRAW_W, BASE_DRAW_H) / 2;

// ── BİRİM YÖNELİMİ (render-only; sim facingAngle'ı zaten hesaplıyor → eğitim/MP etkilenmez) ──
/* DÖNEN KUTU, DİK SPRITE (kullanıcı 2026-08-16: "birlik resmi dönmesin, kutusu dönsün").
   Eskiden sprite dönüyordu; artık taraf kutusu (mavi/kırmızı) + seçim çerçevesi facing
   yönüne döner, birimin çizimi DİK durur — pixel-art yamuk açılarda bozulmaz.

   GEOMETRİ: dönen bir karenin içine sığan en büyük DİK kare, kenarının 1/√2'sidir.
   Sprite kutunun içinde kalsın diye kutu bir miktar büyütülür ve sprite tam o
   içteki kareye oturtulur — böylece 45°'de bile taşma olmaz. */
const UNIT_ROTATE = true;            // taraf kutusu + seçim çerçevesi facing yönüne döner
const UNIT_BOX_SCALE = 1.18;                             // kutu kenarı = dw × bu
const UNIT_SPRITE_SCALE = UNIT_BOX_SCALE / Math.SQRT2;   // dik sprite = dönen kutunun iç karesi
const UNIT_FACE_OFFSET = Math.PI / 2;// ÖN = dikdörtgenin UZUN kenarı (geniş cephe öne); kısa-kenar-ön istersen 0 yap
const UNIT_TURN_SMOOTH = 0.5;        // GLOBAL dönüş hız çarpanı (hepsini topluca ayarla; 0.5 = yarı hız) — kullanıcı isteği: dönüş çok hızlıydı, yarıya indirildi
/* YÖN-ÇEVİRME (render-only). icons.png YANDAN çizilmiş piksel-art ve hücrelerin TAMAMI
   SAĞA bakıyor; çizim kodunda hiçbir yerde yatay çevirme yoktu. Sonuç: sola yürüyen tank
   namlusunu geriye doğru tutuyordu, sola koşan piyade geri geri gidiyordu. Yandan sanatla
   yönü göstermenin doğru yolu budur (döndürmek profil sanatı bozar — sprite bu yüzden dik
   çiziliyor). Simülasyona dokunmaz: yalnız draw() içinde, headless'ta hiç çalışmaz.
   ⚠ HİSTEREZİS ZORUNLU: dikeye yakın açılarda cos(θ) sıfır civarında salınır ve sprite her
   karede taraf değiştirir. Bu deponun "birlik titremesi" dersi tam olarak buydu — eşiksiz
   her karede yön değiştiren bir şey yazma. Eşik aşılmadıkça önceki yön KORUNUR. */
const UNIT_SPRITE_FLIP = true;
const UNIT_FLIP_ESIK = 0.25;         // |cos| bunun altındaysa (dikeye yakın) yön DEĞİŞMEZ

/* MANGA ÇİZİMİ (render-only). KULLANICI: "piyade 5 kişi ancak tek tek bir çatı altında ve
   resim ile gösteriliyor." Doğru: bir piyade birimi tek sprite olarak çiziliyordu.
   Askerler AYRI VARLIK yapılmaz — varlık sayısını ~5× artırır ve ileri-bakış aramasının
   maliyetini aynı oranda katlar (arama bu projenin en büyük ölçülmüş kazancı: ufuk +980).
   CoH da mangayı tek komuta nesnesi olarak tutar, yalnız N figür ÇİZER. Biz de öyle:
   simülasyon tek birim, çizim N figür. Ölü sayısı can oranından düşer — manga eridikçe
   ekranda da erir. Ofsetler birim kimliğinden türetilir → sabit dizilim, titremez. */
const UNIT_SQUAD_RENDER = true;
const UNIT_SQUAD_N = 5;              // tam canda kaç figür
const UNIT_SQUAD_YAY = 0.62;         // figür ofsetlerinin sprite genişliğine oranı
const UNIT_SQUAD_OLCEK = 0.58;       // her figür tek-sprite'a göre bu oranda küçülür
// Manga çizilecek tipler: yaya (armorType 'infantry'). Araç/uçak tek gövdedir.
function battleMangaMi(type) {
    if (typeof UNIT_SQUAD_RENDER === 'undefined' || !UNIT_SQUAD_RENDER) return false;
    const s = (typeof STATS !== 'undefined') ? STATS[type] : null;
    return !!(s && s.armorType === 'infantry');
}

// ── RENDER ARA-DEĞERİ (60 FPS pürüzsüzlüğü; SİM'e DOKUNMAZ) ──
// Sim sabit 20 Hz adım atar (BATTLE_TICK_MS=50), ekran 60 fps çizer. Ara-değer yoksa birim iki kare
// DURUR üçüncüde SIÇRAR. Hızlı birimde adım 12+ px olduğundan bu, gözle "titreme/bozulma" olarak görünür.
// ÖLÇÜLDÜ (tools/titreme-tik.js, tohum 202): sim-içi konum salınımı en kötü 0.61 ters/sn — görünür eşik
// olan 1/sn'nin ALTINDA; çarpışma katkısı 0, shoot-and-scoot (mlrs) 0.01. Yani kalan titreme SİMDEN DEĞİL
// çizim tarafındandır. Bu yüzden düzeltme yalnız render'da: `u._rpx/_rpy` (tik başındaki konum) ile
// `u.x/u.y` arasında RENDER_ALPHA kadar lerp. Hash'e girmez, headless'te hiç yazılmaz.
let BATTLE_RENDER_INTERP = true;
let RENDER_ALPHA = 1;                // gameLoop her karede tazeler: kalan akümülatör / BATTLE_TICK_MS
const RENDER_INTERP_MAX_JUMP = 90;   // bundan büyük sıçrama = ışınlanma (unstick/spawn/snap) → ara-değer yok
function unitRenderPos(u) {
    if (!BATTLE_RENDER_INTERP || u._rpx === undefined) return { x: u.x, y: u.y };
    const dx = u.x - u._rpx, dy = u.y - u._rpy;
    if ((dx * dx + dy * dy) > RENDER_INTERP_MAX_JUMP * RENDER_INTERP_MAX_JUMP) return { x: u.x, y: u.y };
    const a = RENDER_ALPHA;
    return { x: u._rpx + dx * a, y: u._rpy + dy * a };
}
// KONSANTRASYON: AI kuvvetini sektörlere BÖLMEK yerine TEK kütlede yığar + rezervi minimuma indirir → odaklı-ateşle
// yerel üstünlük (insanın kazanma tarzı). ÖLÇÜLDÜ: savunmada -980→-327, saldırıda +15→+620, normal rakipte regresyon yok.
// Dağılım AI'nın asıl zaafıydı; bu onu her senaryoda dramatik güçlendirir. false = eski dağıtan davranış.
let BATTLE_FORCE_CONCENTRATE = true;
// SEKTÖR-KOMUTA (anti-blob): cepheyi sektörlere böl + her gruba sorumluluk-alanı+sınır, ana-çabayı bir sektöre yoğunlaştır,
// ihtiyatı kutsal tut. AÇIKKEN CONCENTRATE'in tek-kütle/tek-hedef davranışını sektör-katmanıyla değiştirir (fazlı, ölçüm-güdümlü).
// A/B KANITLANDI (düşman-uyarlamalı): saldıran 2/3→3/3, dağılım +%52, determinizm korundu → VARSAYILAN AÇIK + version bump.
let BATTLE_SECTOR_COMMAND = true;
// KADRO YAMA YIGINI — DENETLENDI (2026-08-08). Tedarik tahsisi kokunden duzeltildikten sonra ustundeki
// telafi yamalari 2^5 faktoriyel ile (1024 mac, 5 grup: imza/taban/hava/mizrak/omurga) sinandi.
// SONUC: kanita dayanarak kaldirilacak yama YOK. Ana etkilerin hicbiri |t|>=2 degil; ustelik imza (2/16),
// mizrak (3/16), omurga (1/16) cok SEYREK tetikleniyor -> olculemedi (etkisiz DEGIL). Tek iyi-guclendirilmis
// tahmin `taban`: 16/16 calisiyor, kapatmak -114 (t -0.80) => faydali, kaldi.
// `hava` grubu (SAM tabani + radar takasi) bu yapilandirmada KANITLI OLU: 1024 macta tam sifir fark,
// 16/16 konuslandirmada kadro birebir ayni. Kod SILINMEDI (baska butce/roster/mod'da tetiklenebilir) ama
// bu konfigurasyonda hicbir sey yapmiyor. Olcum iskelesi (BATTLE_KADRO_YAMALARI) soz verildigi gibi KALDIRILDI.
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
// TARAF-BAŞI DELTA (tuzak B3): tek global bayrakla A/B yapılırsa değişiklik İKİ TARAFI da etkiler ve
// etki birbirini götürür. Pro katmanında (BATTLE_INTEL4PRO_DELTAS_RED/_BLUE) bu kalıp zaten vardı;
// intel4 deltalarında yoktu. Varsayılan null = eski davranış (byte-aynı).
let BATTLE_INTEL4_DELTAS_RED = null;
let BATTLE_INTEL4_DELTAS_BLUE = null;
function battleDelta(isRed, key) {
    if (!battleBrainIntel4(isRed)) return false;
    const per = isRed ? BATTLE_INTEL4_DELTAS_RED : BATTLE_INTEL4_DELTAS_BLUE;
    if (per && per[key] !== undefined) return per[key] !== false;
    return BATTLE_INTEL4_DELTAS[key] !== false;
}

// ─── INTEL4-PRO KATMANI ───────────────────────────────────────────────────────────────────────────
// intel4-pro = intel4 + aşağıdaki deltalar. intel4 MEZUN OLDU (intel3pro'yu geçti); pro artık intel4'e karşı ölçülür.
// Mezuniyet ölçütü (kullanıcı): 6 tohum × 2 rol = 12 maç, **≥%75 (9/12)** üstünlük → `--intel4pro`.
// Taraf-başı bayrak: bir maçta YALNIZ bir taraf pro olur (adil karşılaştırma). Varsayılan ikisi de kapalı.
const BATTLE_INTEL4PRO_DELTAS = {
    // P1: SAVUNAN MÜHİMMAT DİSİPLİNİ. An-be-an teşhis (../docs/battle-ai/reports/INTEL4PRO-AN-BE-AN-TESHIS.md): savunan ilk 50sn'de
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
    // P5 (KÖK NEDEN — ../docs/battle-ai/reports/KUVVET-ORANI-HATASI.md): kuvvet-oranı istihbarat tabanı, AI'ın KENDİ başlangıç değeri
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
    localRatio: false,
    // ── 'antiMatch' (KULLANICI DOKTRİNİ): yerel üstünlük SAYIYLA değil ANTİ-EŞLEŞMEYLE ölçülür ──
    // İki fren: (1) yerel ETKİ oranı eşiğin altındaysa kapatma, (2) sen o karışıma karşı YANLIŞ ALETSEN
    // kapatma (doğru alet girsin). Hiçbir birimi yeniden konumlandırmaz — "aktif toplanma" ölçülüp
    // zararlı bulunmuştu (Unit.js:1593), bu onun aksine yalnız İLERLEMEYİ keser.
    // ÖLÇÜLMEDEN AÇILMAZ: varsayılan KAPALI.
    antiMatch: false,
    // ── 'armCommand' — TÜMEN KOMUTASI (kullanıcı fikri, 2026-08-09) ──
    // "Piyade tümeni, zırhlı tümeni, dolaylı tümeni kendi komutalarıyla yönetilsin; böylece tüm tümenler
    // detaylı bir savaş taktiği oluşturur." Teknik karşılığı: her muharip grup, kendi BİLEŞİMİNİN en çok
    // hasar verdiği düşman kümesine nişan alır (BattlePlanning.planningAntiAim). Anti-eşleşme burada FREN
    // değil GÖREV DAĞITIM ÖLÇÜTÜ — birim yanlış dövüşe hiç gönderilmez. ÖLÇÜLMEDEN AÇILMAZ.
    armCommand: false,
    // ── 'massMatch' — KÜTLE-İÇİ ANTİ DİZİLİM (kütleyi BÖLMEDEN eşleşme) ──
    // armCommand'ın dersi: orduyu anti-kümelere dağıtmak hem yayılımı artırdı hem etki-oranını düşürdü.
    // Bu delta kütleyi hiç bölmez: hedef, formasyon ve menzil-katmanı aynı; yalnız AYNI DERİNLİKTEKİ
    // birimler yanal olarak yeniden dizilir (tanksavar zırha bakan yüze, piyade piyadeye bakan yüze).
    // ⛔ ACILDI ve GERI ALINDI (2026-08-10). Kesif havuzlarinda (D,E) ucu birlikte +242/+210 verdi
    // (t 2.7 duyurdum) ama BAGIMSIZ havuzlarda (F,G) +41 ve −39 → ortalama SIFIR. Galibiyet farki da
    // bagimsiz havuzlarda %51.6 vs %50.3 (±1.55, anlamsiz). SECIM YANLILIGI: mekanizmayi buldugum
    // havuzda olcmek onu abartiyor — bu, ayni gun DORDUNCU kez yasandi. Kod+olcum duruyor, varsayilan KAPALI.
    massMatch: false,
    // ── 'destLock' — KARAR DONGUSU HEDEF KILIDI ──
    // Olculdu: birim dakikada 6.4 kez 220px+ hedef degistiriyor, net yer degistirmesinin 4 KATI yol
    // yuruyor ve ilk temasta kuvvetin yalniz %12'si olay yerinde. Calkantinin %54'u kontrolor emri.
    // Bu delta grup hedefini kilitler: kucuk suruklenme yok sayilir, buyuk degisiklik beklemeye tabidir;
    // gercek yeniden-yonelim (>1200px) ve varis kilidi deler. ISLEYIS: BattleExecution.executionLockedPoint.
    destLock: false,
    // ── 'killFocus' — SANIYEDE EN COK DEGER IMHA ET (dogal odaklanmis ates) ──
    // Olculdu: yerel kumede 4.9 atici 1.8 AYRI hedefe atiyor (0.370) — iki beyinde de ayni. Sebep:
    // birim hedef skoru KALAN CANI okumuyor (yalniz hasar/mesafe), yarali dusman one cikmiyor.
    // Skor deger*hasar/kalan-can olunca odaklanma kendiliginden dogar ve dusmanin ates hacmi hizla duser.
    killFocus: false,
    // ── 'heloMass' — SALDIRI HELIKOPTERI KUTLESI (olculmus insan ustunlugu) ──
    // attack_helo AI kayiplarinin %22'si (26 gercek mac) ama AI ordu basina yalniz 0.48 tane aliyor.
    // Ucus disiplini `helo_harass` botunda zaten yazili; tek basina acmak baglamadi (23/48) cunku
    // ortada helo YOK. Bu delta agirligi carpar -> kuvvet insanin kozunu fiilen kullanabilir hale gelir.
    // ⛔ bkz. massMatch notu — ucu birlikte acilmis, bagimsiz havuzlarda sifir cikip GERI ALINMISTI.
    heloMass: false,
    // ── 'heloDoctrine' — INSAN UCUS DISIPLINI (BattleExploiters.exploiterHeloTaciz) ──
    // 26 gercek oyuncu macindan turetilmis: dusman AD zarfinin DISINDA kal (medyan 1188px), deger
    // avla, guvenli atis noktasi yoksa GIRME. Bugune dek yalniz test-rakibi botuydu; olculup pro'nun
    // kendi yetenegi yapildi. TEK BASINA +83 (t 0.59); heloMass ile birlikte anlamli.
    heloDoctrine: false,
    // P14 — KISA MENZİLLİ DOLAYLI ATEŞ MENZİLE GİRER (BECERİ). TEŞHİS: savunan dolaylısı mühimmatı
    // varken tiklerin %48'inde MENZİLİNDE DÜŞMAN OLMADIĞI için boş duruyor (görüş %0, ölü bölge %0,
    // filtre %0 — sebep tek başına KONUM). Havan menzil 900px, en yakın düşman ort. 1165px.
    // `standoff`un aynadaki hâli; güvenlik şartı: kendi ön hattının gerisinde kalır.
    //
    // ÖLÇÜLDÜ ve **KATMAN 1'DE ELENDİ** → VARSAYILAN KAPALI.
    // MEKANİZMA ÇALIŞTI: havan kendi hattının 760px gerisinden 350px'e ilerledi (tam tasarlandığı gibi).
    // AMA HEDEF METRİĞİ OYNAMADI ve varyans devasa (izole A/B, havan örnek sayısı ve menzil-yok oranı):
    //   seed2024  445 örn %65 menzil-yok  →  170 örn %65   (2.6× erken öldü, oran aynı)
    //   seed3141  288 örn %26             →  151 örn %26   (erken öldü, oran aynı)
    //   seed777   166 örn %48             → 1460 örn %12   (çok yaşadı, oran düzeldi — ama %54 GÖRÜNMEZ)
    // Yani öne çıkmak menzil sorununu GÖRÜŞ sorununa takas ediyor ve hayatta kalma savruluyor.
    // DAHA DERİN SEBEP: havanın menzilinde düşman olmamasının kaynağı havanın kendi konumu değil,
    // SAVUNAN KUVVETİN TAMAMININ geride ve yayılmış durması. Bu birim katmanında çözülmüyor —
    // zırhlı teşhisinin (§17) vardığı yerin aynısı: doğru katman KUVVET DAĞILIMI.
    indirectCreep: false,
    // P15 — İKMAL ARACI ATEŞ DESTEĞİNİN YANINDA DURUR (KULLANICI DOKTRİNİ: "topçuların yakınında
    // sürekli bir ikmal aracı şart"). ÖLÇÜLDÜ: savunan dolaylısı ikmal halesinde yalnız %16 geçiriyor,
    // %12 kuru; araç dolaylı-kümeye ort. 712px uzakta, hale 400px. Elenen `resupplyRun`un TERSİ —
    // orada topçu mevziini terk ediyordu, burada ARAÇ geliyor.
    //
    // ÖLÇÜLDÜ ve **ELENDİ** → VARSAYILAN KAPALI — ama doktrin YANLIŞ DEĞİL, kısıt BAŞKA YERDE.
    // MEKANİZMA ÇALIŞTI: araç→dolaylı-küme mesafesi 712px → 442px, hale içinde geçen süre
    // %16 → %27 (yer olan tohumlarda %23→%64, %24→%56).
    // AMA ATIŞA DÖNMEDİ (9 tohum, toplam dolaylı atış):
    //   kapalı 33 32 20 16 16 59 40  25  2   (ort 27.0)
    //   açık   81 20 10 27 11 38 17 106 24   (ort 37.1)
    //   4 tohum iyi / 5 tohum kötü; fark +10.1 ama SE ±11.7 → sıfırdan ayırt edilemiyor.
    // SEBEP: mühimmat BAĞLAYICI KISIT DEĞİL. Dolaylı birim KURU geçen süre %12, HEDEFSİZ geçen
    // süre %48 (tools/dolayli-bos-teshis.js). Mermi yetiştirmek, ateş edecek hedef yokken atış
    // üretmiyor. Zaten kapsaması %83-85 olan tohumlarda bile atış 16-20'de kalıyor — kanıt bu.
    // Kod duruyor: hedef sorunu çözülürse (savunan duruşu/kompozisyonu) bu kural yeniden anlam kazanır.
    supplyEscort: false,
    // P16 — GÖZCÜSÜZ KESKİN NİŞANCI ALINMAZ (kompozisyon katmanı). ÖLÇÜLDÜ: balistik füzenin hedefi
    // geometrik olarak zamanın %100'ünde menzilinde ama GÖRÜNÜR oranı %0-3; keşifsiz orduda 4/6
    // tohumda HİÇ ateş etmiyor. 2 keşif İHA + 2 keşif aracı zorunlu kılınınca 1/6'ya iniyor ve
    // ilk atış 156-192sn → 11-20sn. Menzili görüşünün katından fazla olan birim varsa gözcü şart.
    spotterRequirement: true,
    // P17 — KÜÇÜK ŞARJÖRLÜ BİRİM İKMALSİZ ALINMAZ (gözcü kuralının kardeşi). ÖLÇÜLDÜ: ÇNRA
    // mühimmatı 3; ilk 60-85sn'de bitiyor ve ömrünün %85'i KURU geçiyor, ikmal aldığı 0.
    // Sebep: orduda HİÇ ikmal aracı yok (22 birim, 0 araç) — ikmal-refakat kuralı da bu yüzden
    // hiç bağlamıyordu. Şarjörü küçük ve pahalı birim, ikmal kaynağı olmadan tek-atımlıktır.
    logisticsRequirement: true,
    // P18 — YAKITLI HAVA BİRİMİ ÜSSÜZ ALINMAZ (kural ailesinin ÜÇÜNCÜ üyesi). ÖLÇÜLDÜ: nakliye
    // helosu gerçekten taşıyor (24 piyade, ömrünün %92'si yüklü) ama 12 helonun 10'u YAKITI BİTİP
    // DÜŞTÜ ve kargosundaki 10 piyadeyi de öldürdü. Helo yalnız `providesAir` siperinde yakıt alır,
    // o siperi İSTİHKÂM kurar, orduda istihkâm YOK (0) → hiçbir üs kurulmuyor.
    airBaseRequirement: true,
    // P19 — İLERİ ÜS. Kullanıcı sordu: "helolar yakıtsızlıktan düşüyorsa istihkâm neden siper
    // kazmıyor". ÖLÇÜLDÜ: helipad kapsaması maçın yalnız %40'ı; istihkâm tiklerinin %38.6'sı
    // "kendi yarısında değil" hâlinde geçiyor ve o hâlde HİÇBİR ŞEY kurmuyor.
    engineerForward: false,   // ÖLÇÜLMEDEN AÇILMAZ
    // P20 — KOMUTA MERKEZİ. ÖLÇÜLDÜ: komuta aracı (speed 1.5) kütle merkezinin 436px ARKASINDA
    // kalıyor; hale dost değerin %83'ünü tutuyor, tam merkezde %92 tutardı. 500px daha geri
    // çekmek ise %48'e düşürüyordu (ilk sezgim yanlıştı, karşı-olgu yalanladı).
    commandCenter: false,   // K2'DE ELENDİ (6 tohum): kapsama %84→%94 ama kazandırdığı hasar 0.98→0.97 ₺ (değişmedi)
    // P21 — KOMUTA MENZİLİ. Veride `range: 0.08` tanımlıydı ama kodda karşılığı YOKTU (ölü veri).
    // Kullanıcı kararı: "ne işe yarıyor ona göre silelim veya işleyelim" → uygulandı, ölçülecek.
    commandRange: false,   // ÖLÇÜLMEDEN AÇILMAZ
    // P22 — HAVA SAVUNMA ŞEMSİYESİ (KULLANICI DOKTRİNİ + ÖLÇÜM). 26 gerçek oyuncu maçı:
    // attack_helo AI kayıplarının %22'si (tek kalemde en büyük katil). Kurbanların %79'u AD
    // menzilindeydi ama HELONUN KENDİSİ vuruş anında menzil∩görüşünde yalnız %21 — helo 675px'ten,
    // şemsiyenin DIŞINDA durarak şemsiyenin ALTINDAKİ birimi öldürüyor. Kural: AD, korunan kara
    // kütlesinin tehdit ekseninde, zarfı düşmanın ATIŞ NOKTALARINA yetecek kadar ileri oturur.
    adUmbrella: false   // ÖLÇÜLMEDEN AÇILMAZ
};
// ── 'airBaseRequirement' PARAMETRELERİ (aranabilir) ──
let PRO_USSU_MIN_TL = 300;   // bu değerin altındaki hava birimi için ordu bozulmaz
let PRO_USSU_MIN = 1;        // orduda bulunması gereken en az üs-kurucu (istihkâm)
// ── 'logisticsRequirement' PARAMETRELERİ (aranabilir) ──
let PRO_LOJISTIK_KUCUK_SARJOR = 4;   // şarjörü bu değere kadar olan birim "ikmale bağımlı" sayılır
let PRO_LOJISTIK_MIN_TL = 300;       // ucuz birim için ordu bozulmaz
let PRO_LOJISTIK_MIN = 1;            // orduda bulunması gereken en az ikmal kaynağı
// Zorunlu destek birimi için en fazla kaç muharip satılabilir (tarif çözücüsü bütçenin ~%99'unu
// harcadığı için kurallar aksi hâlde parayı bulamıyor ve sessizce bağlamıyordu).
let PRO_DESTEK_SATIS_TAVAN = 3;   // 2 iken lojistik kurali 240 TL ile 250 TL"lik araca ULASAMIYORDU (olculdu)
// ── 'spotterRequirement' PARAMETRELERİ (aranabilir) ──
let PRO_SPOTTER_KAT = 3;    // menzil > görüş × bu kat ise "gözcü gerektiren" birim sayılır
let PRO_SPOTTER_MIN = 3;    // orduda bulunması gereken en az keşif birimi sayısı (KARA hedefi)
// HAVA tarafı ayrı: hava hedefini YALNIZ airRadar açar (rosterde tek taşıyıcı counter_battery_radar).
// SAM menzil 1650 / görüş 900 = 1.83 → kara eşiği (3) onu yakalamıyor, bu yüzden ayrı ve düşük eşik.
let PRO_SPOTTER_HAVA_KAT = 1.5;
let PRO_SPOTTER_HAVA_MIN = 1;
// ── 'supplyEscort' PARAMETRELERİ (aranabilir) ──
let PRO_SUPPLY_MIN_EKSIK = 0.15;    // mühimmat eksikliği bunun altındaki birim müşteri sayılmaz
let PRO_SUPPLY_DOLAYLI_KAT = 3;     // dolaylı ateşe ağırlık katı (mermisi bitince tamamen işlevsiz)
let PRO_SUPPLY_ICERI = 0.60;        // küme merkezini halenin bu kesrine al
let PRO_SUPPLY_TEHDIT = 900;        // görülen düşman ateşli kara birimi bu kadar yakınsa ilerleme
// ── 'indirectCreep' PARAMETRELERİ (aranabilir) ──
let PRO_ICREEP_MAX_MENZIL = 1200;   // bu menzilin ÜSTÜNDEKİ dolaylı birim kural-dışı (topçu 1500 hariç)
let PRO_ICREEP_HEDEF = 0.80;        // düşmanı menzilin bu kesrine al (kenarında değil, rahat içinde)
let PRO_ICREEP_HAT_GERI = 250;      // kendi ön hattının en az bu kadar gerisinde kal
// ── 'armorFace' PARAMETRELERİ (aranabilir) ──
let PRO_ARMORFACE_R = 2200;              // tehdit taraması yarıçapı (en uzun doğrudan-ateş menzilini kapsar)
let PRO_ARMORFACE_MIN_BASKINLIK = 0.35;  // tehdit vektörü bu kadar yönlü değilse (her yönden) dönme
// ── 'antiMatch' PARAMETRELERİ (KULLANICI DOKTRİNİ, 2026-08-09) ──
// "AI gördüğü tüm alanlarda karşı tarafa ANTİ olan birliklerini vuruşturmalı. Kütleyi büyütücem diye
//  piyadeleri dolaylının önüne koyarsan ölürler; dolaylılar tanka vurursa hiçbir şey olmaz."
// ÖLÇÜLDÜ (tools/anti-eslesme.js, 16 maç): temas anındaki yerel dost kütlesinin **%22-27'si YANLIŞ ALET**
// (yerel düşman karışımına karşı DPS'i, kendi en iyi hedefine karşı DPS'inin %20'sinin altında) ve
// temasların **%19-23'ünde** sayı-oranı ≥1.5 (mevcut kurallar "iyi" der) iken ETKİ-oranı <1.0 (dövüş kaybediliyor).
// Mevcut `assaultCohesion`/`localRatio` yalnız KAFA SAYAR; bu delta aynı kapıyı ETKİ ile kurar.
let PRO_ANTI_R = 600;         // yerel kesit yarıçapı (localRatio ile aynı — karşılaştırılabilir kalsın)
let PRO_ANTI_MIN = 1.0;       // yerel ETKİ oranı (dost DPS / düşman DPS) bunun altındaysa kapatma
let PRO_ANTI_WRONG = 0.20;    // kendi DPS'i en-iyi hedefine karşı olanın bu katından azsa "yanlış alet"
// TİP×TİP DPS ÖNBELLEĞİ: motorun KENDİ hasar matrisinden türetilir (BattleForecast.forecastDpsVs ile aynı
// formül; o dosya oyunda yüklü değil). Saf aritmetik + statik veri → determinist, RNG yok, hash'e girmez.
const _ANTI_DPS = new Map();
function battleTypeDps(aType, bType) {
    const key = aType * 1000 + bType;
    const hit = _ANTI_DPS.get(key);
    if (hit !== undefined) return hit;
    const A = STATS[aType], B = STATS[bType];
    const DM = (typeof UNITS_MODERN_DB !== 'undefined') ? UNITS_MODERN_DB.damageMatrix : null;
    let dps = 0;
    if (A && B && DM) {
        const arm = B.armorType || 'infantry';
        for (const w of (A.weapons || [])) {
            if (!w || !(w.damage > 0)) continue;
            if (typeof weaponCanEngage === 'function' && !weaponCanEngage(w, B)) continue;
            const eff = (DM[w.damageType] || {})[arm] || 0;
            if (eff <= 0) continue;
            const rof = (w.rof > 0) ? w.rof : 1, perShot = (w.perShot > 0) ? w.perShot : 1;
            const acc = (w.accuracy && Number.isFinite(w.accuracy.base)) ? Math.max(0.05, Math.min(1, w.accuracy.base)) : 1;
            dps += w.damage * eff * rof * perShot * acc;
        }
    }
    _ANTI_DPS.set(key, dps);
    return dps;
}
const _ANTI_BEST = new Map();
function battleTypeBestDps(aType) {
    const hit = _ANTI_BEST.get(aType);
    if (hit !== undefined) return hit;
    let m = 0;
    for (const t in STATS) { const v = battleTypeDps(aType, Number(t)); if (v > m) m = v; }
    _ANTI_BEST.set(aType, m);
    return m;
}
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

// ── HAVA-HAVA MUHAREBESİ (kullanıcı hatası: "helo, heloyu vuramıyor") ──
// ÖLÇÜLDÜ: havaya ateş edebilen YALNIZ üç birim vardı (manpads/spaag/sam_battery). Taarruz helosunun
// ATGM podu ve SİHA'nın hassas mühimmatı `targets:["ground"]` — üstelik damageMatrix'te shaped→air = 0.
// Yani iki hava birimi birbirini HEDEF BİLE EDİNEMİYORDU; gökyüzü tamamen yer-tabanlı AA'ya bırakılmıştı.
// DÜZELTME veri-güdümlü: her ikisine `airToAir` işaretli İKİNCİL silah (sam tipi, hedef yalnız 'air',
// mühimmat tüketir). Motor tarafında üç kusur da kapatıldı (Unit.js):
//   1) hedef PUANLAMASI birincil silaha bakıyordu → hava hedefi 0 puan alıp en sona düşüyordu
//   2) birincil ATEŞ kapısı `unitCanEngage` (HERHANGİ silah) idi → helo ATGM'ini sıfır hasarla boşaltırdı
//   3) ikincil silah mühimmat tüketmiyordu → sınırsız füze olurdu
// Simetrik mekanik (iki tarafa + oyuncuya aynı), determinist (RNG yok). A/B için tek anahtar.
let BATTLE_HAVA_HAVA = true;

// ── SIKISMA-COZME DÜZELTMESİ (kullanıcı: "birlik titremeleri çok sinir bozucu") ──
// `Unit.update` sıkışma sezince 92px YANA adım attırır ve tarafı her denemede ters çevirir. Yan adım
// da ilerleme üretmezse yeni deneme gelir → sağa-sola tam gaz salınım. Uçan birim araziye sıkışamaz,
// yine de manevrayı yiyordu. Ölçüldü: dron salınımında katkı hareket %100 / çarpışma %0.
// Simetrik mekanik (iki tarafa + oyuncuya aynı), determinist (RNG yok).
// ── TESLİM OLMUŞ HEDEFE ATEŞ KESME (kullanıcı: "beyaz bayrak çekmiş birimlere atış ediyorlar") ──
// Mission-kill'de mürettebat aracı terk eder → araç `abandoned` (gri/nötr, hiçbir tarafın kuvvet
// sayımına girmez, istihkâm tamir edip ele geçirebilir). Otomatik hedefleme onu zaten dışlıyordu ama
// `performAttack` yalnız `dead` kontrolü yapıyordu → o an kilitli olan birim ateşe devam ediyordu.
// OYUNCU EMRİ KORUNUR (kullanıcı şartı): manuel saldır-emri verilmişse ateş sürer.
// ── SIKIŞMA MANEVRASI: ENGEL KONTROLÜ (kullanıcı 2026-08-16) ──
// "çarpışmadan kaçınma bazen ortada hiçbir şey yokken çalışıyor ve birlikler sağa/sola
// gereksiz hareket ediyor." Manevra yalnız "ilerleyemiyorum" sinyaline bakıyordu; önünde
// gerçekten engel (arazi VEYA birim) olup olmadığını hiç sormuyordu.
// ÖLÇÜLDÜ (tools/kusur-teshis.js, 3 maç): 298 tetiğin 124'ünde (%41.6) hiçbir engel yoktu.
// Açıkken engelsiz tetik yana-adım üretmez, yalnız rota önbelleği tazelenir.
// ── HEDEFE ÖZEL ANGAJMAN MENZİLİ (kullanıcı 2026-08-16: "SİHA havadan havaya atış yapamıyor") ──
// Yaklaşma/ateş kararı `STATS.range` (EN UZUN silah) ile veriliyordu. SİHA'nın menzili 900'dür
// (yer mühimmatı) ama hava-hava füzesi 600'dür: helikoptere kilitlenen SİHA 800px'te "menzildeyim"
// deyip DURUYOR ve füzesini hiç kullanamıyordu. Açıkken menzil, hedefin alan-tipini gerçekten
// vurabilen silahlardan hesaplanır. ÖLÇÜLDÜ: 800px'ten emirde en yakın mesafe 800 → 595, atış 0 → 1.
let BATTLE_ANGAJMAN_MENZIL = true;

// ── HOLD_FIRE YALNIZ MENZİL ÜSTÜNLÜĞÜ YOKKEN (2026-08-16) ──
// `hold_fire` (pusu disiplini) birimi menzilinin %70'ine kadar susturuyordu. Tank avcısında bu,
// varlık sebebini yok ediyordu: menzil 675, eşik 472, düşman tankın menzili 450 → 225px'lik
// üstünlük 22px'e iniyordu. ÖLÇÜLDÜ (1v1, aynı tohum): açıkken TD ölüyor (tank 68 hp sağ),
// kapalıyken tank ölüyor (TD 198 hp sağ). Yeni kural: düşman seni senin ona attığından daha
// uzaktan vurabiliyorsa sabır DOĞRU (MANPADS 825 vs helo 900) — vuramıyorsa sabır zarar.
let BATTLE_HOLD_FIRE_STANDOFF = true;
function battleHoldFireStandoff() {
    return (typeof BATTLE_HOLD_FIRE_STANDOFF === 'undefined') || BATTLE_HOLD_FIRE_STANDOFF;
}

let BATTLE_UNSTICK_ENGEL = true;
function battleUnstickEngelKontrol() {
    return (typeof BATTLE_UNSTICK_ENGEL === 'undefined') || BATTLE_UNSTICK_ENGEL;
}

let BATTLE_TESLIM_ATES_KES = true;
function battleTeslimAtesKes() {
    return (typeof BATTLE_TESLIM_ATES_KES === 'undefined') || BATTLE_TESLIM_ATES_KES;
}

// ── AI'IN "İMHA GEREKÇESİ" (kullanıcı: "yoksa AI dezavantajlı olurdu") ──
// Oyuncu teslim olmuş aracı bilerek patlatabiliyorsa AI da patlatabilmeli — ama KEYFÎ değil, GEREKÇEYLE.
// Terk edilmiş araç, düşman İSTİHKÂMI 82px'te tamir edip %45 canda ELE GEÇİRDİĞİ için gerçek bir
// ganimettir. İki somut gerekçe (deterministik, RNG yok):
//   1. TAMİR TEHDİDİ  — düşman istihkâmı 140px içinde (82px'lik yakalama menziline girmek üzere)
//   2. ZEMİN DÜŞMANIN — 300px'te düşman birimi bizden en az 2 fazla (araç büyük olasılıkla onların olur)
// Gerekçe yoksa ateş kesilir; yani "boş yere teslim olanı vurma" davranışı korunur.
// ÖLÇÜLDÜ — eşikler GEVŞEK olamaz: ilk deneme (istihkâm 140px, zemin 300px, fark ≥2) teslim-sonrası
// atışı 0.0'dan 12.1'e fırlattı (tabandaki 6.3'ten bile kötü), çünkü cephe hattında "düşman biraz daha
// kalabalık" koşulu neredeyse HEP sağlanıyor. Gerekçe İSTİSNA olmalı, kural değil:
// yoğunluk = düşman ≥3 VE fark ≥3, ve yarıçap 300 değil 200px (aracın gerçekten dibinde).
const TESLIM_IMHA_TAMIR_TIK = 20;   // 1 saniye: tamir kesilince gerekçe de düşer
function battleTeslimImhaGerekce(isRed, tgt) {
    if (!tgt || !tgt.abandoned || typeof SIM === 'undefined') return false;
    // TEK GEREKÇE: araç FİİLEN karşı tarafça tamir ediliyor (son TESLIM_IMHA_TAMIR_TIK tik içinde).
    // Tamir yoksa araç ele geçirilemez — yani imha için savunulabilir bir sebep de yoktur.
    if (tgt._tamirTick == null || tgt._tamirSide == null) return false;
    if (tgt._tamirSide === isRed) return false;                       // kendi tarafımız tamir ediyorsa vurmayız
    return (SIM.tick - tgt._tamirTick) <= TESLIM_IMHA_TAMIR_TIK;
}

// ── KANAT ACLIGI DUZELTMESI (olculdu 2026-08-08) ──
// Kuvvet bolusumu rolleri SIRAYLA doyuruyordu (once FIXING, sonra FLANK) ve FIXING havuzu tuketince
// FLANK'a hic sira gelmiyordu (`unassigned.size <= 1` korumasi dongusu kiriyordu). --battletest'in
// sentetik kurgusunda (8 birim) FLANK UC yapilandirmada da BOS kaldi, payi 0.30 iken bile.
// Yani "kucuk kuvvet kanat acmaz" bir tasarim tercihi degil, tahsis SIRASININ yan etkisiydi.
// Yeni: tek gecis, her adimda oransal acigi en buyuk role ver (en-buyuk-kalan). Determinist.
// ── HEDEF KUTLE (adim 3 / madde 1) ──
// Aday "hangi SEKTORE gideyim" diyor; oyuncunun olculen ustunlugu ise "hangi DUSMAN YIGININI ezeyim"
// (temas aninda 8.9 dost / 1.2 dusman; AI 6.9 / 3.4). Sektor toplami bu soruyu cevaplayamaz —
// 8x6 izgara yigini bolebilir. Kumeler gercek yakinliga gore hesaplanir ve hedef listesine eklenir.
// OLCULDU (tohum 202, tik 1800): 780 guclu 3-birimlik zayif grup (sektor 43) aday listesinde YOKTU.
// VARSAYILAN KAPALI: kendi kapisini gecene kadar acilmaz (kosan tavan olcumleri de bozulmasin).
// ── AKIN: "tek basina gezeni gafil avlamak" (kullanici doktrini) ──
// KULLANICI: "hizli hareket edip tek basina gezen birligi gafil avlamak; once hedef sec, dogru ani
// bekle, kisa bir taarruzla indir, cekil veya devam et."
// OLCULDU (tools/gafil-avlama-teshis.js, 291 olum): AI olumlerinin %52'si KUTLE-KUTLEYE, gafil
// avlama yalniz %14. Oyuncunun temas aninda 1.2 dusman gormesi YAYILDIGI icin degil YALNIZ KALANI
// sectigi icin (dost sayisi benzer: 8.9 vs 6.9).
// NEDEN YIGILMA DEGIL: gecmiste "aktif toplanma" denendi, oran SABIT kaldi (ana kutleye yiginca
// dusmanin ana kutlesiyle karsilasiyorsun). Bu yuzden mudahale HEDEF SECIMIDIR.
// Taraf-basi (tuzak B3). Varsayilan KAPALI: kendi kapisini gecene kadar acilmaz.
// ── ANGAJMAN KABUL/RET (kullanici doktrini) ──
// KULLANICI: "AI savunmasi taarruzu SADECE ustun oldugunu goruyorsa yapmali."
// OLCULDU (kullanicinin 3 savunma maci, guncel motor, rakip beonai): AI hazir savunmaya taarruz
// etti; oldurmelerinin %78'i KUTLE ICINDE oldu ve maclar 27-0 / 26-11 / 26-7 bitti. Hucum karari
// yerel orana BAKMIYORDU (sure dolunca ya da %8 hasar gorunce kalkiyordu).
// Kural: FIRE_WINDOW -> ASSAULT gecisi yerel ustunluk sartina baglanir. Ustunluk yoksa ates
// penceresinde KALINIR — kullanicinin "iki taraf da yumaksa dolayli atislar is yapar" noktasi.
// Taraf-basi (tuzak B3). Varsayilan KAPALI: kendi kapisini gecene kadar acilmaz.
let BATTLE_ANGAJMAN = false;
let BATTLE_ANGAJMAN_RED = null, BATTLE_ANGAJMAN_BLUE = null;
function battleAngajman(isRed) {
    const v = isRed ? BATTLE_ANGAJMAN_RED : BATTLE_ANGAJMAN_BLUE;
    return v == null ? ((typeof BATTLE_ANGAJMAN === 'undefined') || BATTLE_ANGAJMAN) : !!v;
}
const ANGAJMAN_R = 900;        // hedef cevresinde kuvvet sayma yaricapi
const ANGAJMAN_ESIK = 1.30;    // hucum icin gereken YEREL oran (dost/dusman)
// BAGLANMA SAYACI (tuzak B2): kural bakti mi, kac kez reddetti?
let BATTLE_ANGAJMAN_SAYAC = { bakilan: 0, reddedilen: 0 };

let BATTLE_AKIN = false;
// BAGLANMA SAYACI: kural gercekten calisti mi? Sifirsa akin HIC tetiklenmemis demektir (tuzak B2 —
// bu kural ilk yazildiginda `observation.ownUnits`ta `speed` alani olmadigi icin tam bunu yasadi).
let BATTLE_AKIN_SAYAC = { emir: 0, taarruz: 0 };
let BATTLE_AKIN_RED = null, BATTLE_AKIN_BLUE = null;
function battleAkin(isRed) {
    const v = isRed ? BATTLE_AKIN_RED : BATTLE_AKIN_BLUE;
    return v == null ? ((typeof BATTLE_AKIN === 'undefined') || BATTLE_AKIN) : !!v;
}
const AKIN_R = 600;              // izole sayilma cemberi (balistigin ayak izi; olcum de bunu kullandi)
const AKIN_IZOLE_DOST = 1;       // hedefin R icinde EN FAZLA bu kadar kendi dostu olabilir
const AKIN_ASGARI_AKINCI = 3;    // "saldiran >=3" — olcumdeki gafil-avlama tanimiyla ayni
const AKIN_AZAMI_AKINCI = 5;     // kutleyi bozmamak icin tavan
const AKIN_VURUS_MESAFE = 520;   // bu mesafeye giren akinci "hazir" sayilir; taarruz o zaman baslar
const AKIN_AZAMI_MESAFE = 2200;  // bundan uzaktaki izole hedefe akin duzenlenmez
const AKIN_AZAMI_TIK = 600;      // 30sn: akin takilip kalmasin

let BATTLE_GRAMMAR_KUTLE = false;

let BATTLE_FLANK_FIX = true;
function battleFlankFix() {
    return (typeof BATTLE_FLANK_FIX === 'undefined') || BATTLE_FLANK_FIX;
}

// ── VARIŞ EŞİĞİ / SON KISMİ ADIM (kullanıcı: "birliği kendine çok yakın bir konuma göndermeye
// çalıştığımda gitmiyor" — `_holdingPos` sıfırlaması YETMEDİ, İKİNCİ eşik buydu) ──
// ÖLÇÜLDÜ (tools/yakin-emir-teshis.js, scout_vehicle 12 px/tik): 4/8/11/13 px'lik emirlerde birim
// HİÇ KIMILDAMIYOR (netYer 0). Sebep: eski eşik `movementSpeed + 1` idi ve adım hep TAM hız
// atılıyordu → hıza bağlı bir ÖLÜ BÖLGE. 16-40 px'te de 12 px'lik kuantumdan 4-8 px eksik kalıyordu.
// DÜZELTME: (a) varış toleransı hızdan bağımsız küçük bir sabit, (b) son adım kalan mesafeye
// KIRPILIR (rota izlenirken kırpma yok — ara nokta hedeften yakın olabilir).
// SİM davranışı değişir → determinizm hash'leri ve AI ölçüt tabanları kayar (bilerek).
// SEYIRCI KIPI (`--izle`): sis cizilmez + her birim gorunur sayilir. Yalniz IZLEME icindir;
// simulasyona ve AI algisina (BattlePerception) DOKUNMAZ, varsayilani kapalidir.
let BATTLE_SPECTATE = false;

// Son açılan savaş oturumunun yapılandırması ("Tekrar Oyna" bununla aynı maçı yeniden kurar).
let LAST_BATTLE_CONFIG = null;

// ── KARE ÇARPIŞMA SINIRI (kullanıcı: "birim sınırları daire değil KENDİ BOYUTUNDA kare olsun") ──
// Birim sprite'ı 64×64 px çizilir ama çarpışma yarıçap 32'lik bir DAİRE ile çözülüyordu; görülen
// dikdörtgen ile çarpışan daire birbirini tutmuyordu (köşeler iç içe geçiyor, kenarlar boşluk bırakıyor).
// Artık ayırma eksen-hizalı KUTU (AABB) ile yapılır: en az batma ekseninde itilir — köşeye takılma yok,
// dizilim ızgaraya oturur. Seçim çerçevesi de bu kutuyu çizer → GÖRÜLEN = ÇARPIŞAN.
// SİM DEĞİŞİKLİĞİ: determinizm hash'leri ve AI ölçüt tabanları kayar (listede bilerek EN SONA konmuştu).
let BATTLE_BOX_COLLISION = true;
const UNIT_HALF_W = BASE_DRAW_W / 2;
const UNIT_HALF_H = BASE_DRAW_H / 2;
function battleBoxCollision() {
    return (typeof BATTLE_BOX_COLLISION === 'undefined') || BATTLE_BOX_COLLISION;
}

// 'heloMass' carpani: attack_helo agirligi bu kat artar (butce sabit -> baska birimden kisilir).
let PRO_HELO_WEIGHT_MULT = 3;

let BATTLE_ARRIVE_FIX = true;
const ARRIVE_TOLERANCE_PX = 1.5;
function battleArriveFix() {
    return (typeof BATTLE_ARRIVE_FIX === 'undefined') || BATTLE_ARRIVE_FIX;
}

let BATTLE_UNSTICK_FIX = true;
function battleUnstickFix() {
    return (typeof BATTLE_UNSTICK_FIX === 'undefined') || BATTLE_UNSTICK_FIX;
}


// ── HEDEF UYGUNLUĞU: AI, VURAMAYACAĞI hedefe SALDIR emri vermesin ──
// Hava-hava ölçümü sırasında çıktı: AI'nın SALDIR emri hedefin vurulabilir olup olmadığına HİÇ bakmıyordu
// (`js/BattleController.js` yalnız "düşman tarafta mı" diye soruyordu). ÖLÇÜLDÜ: tüm hedef kilitlerinin
// %44.6'sı birimin hiç vuramayacağı hedefe — havan→İHA 92, MBT→SİHA 58, MANPADS→kara birliği 19 örnek.
// Böyle bir birim nişan alıp BEKLER (combatState 'Vuramaz'), ateş etmez. Yani ordunun yarıya yakın
// kilit-tik'i boşa gidiyordu. Emir atlanınca birim KENDİ otomatik hedef edinmesine döner — o yol
// uygunluğu zaten süzüyor (Unit.findBestVisibleEnemy → unitCanEngage).
// OYUNCU emri KAPSAM DIŞI: `player-attack` bilerek verilmiş bir emirdir, sessizce yutulmaz.
// Taraf-başı (tuzak B3: global bayrak A/B'de iki tarafı birden değiştirir). null = global değeri kullan.
let BATTLE_HEDEF_UYGUN = true;
let BATTLE_HEDEF_UYGUN_RED = null, BATTLE_HEDEF_UYGUN_BLUE = null;
function battleHedefUygun(isRed) {
    const v = isRed ? BATTLE_HEDEF_UYGUN_RED : BATTLE_HEDEF_UYGUN_BLUE;
    return v == null ? ((typeof BATTLE_HEDEF_UYGUN === 'undefined') || BATTLE_HEDEF_UYGUN) : !!v;
}

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

// ── KRİTİK YAKIT TABANI (mekanik düzeltmesi, iki tarafa+oyuncuya simetrik) ──
// Yüklü nakliye helosu "önce teslim et" kuralı yüzünden yakıt için üsse DÖNMÜYORDU (`!busyTransport`).
// ÖLÇÜLDÜ: 12 helonun 10'u yakıtı bitip düştü ve kargosundaki 10 piyadeyi de öldürdü; düşman
// yalnız 1 tanesini vurdu. Yakıt bu kesrin altına inince kargo şartı düşer ve üsse dönülür.
// OLCULDU ve GERI ALINDI (2026-08-08): `return_to_base` hasar-tetikli cekilme yazildi, BIND KANITI
// tetiklendigini dogruladi (4/4 helo, en dusuk can %19) ama TEK BIR HELIKOPTERI BILE KURTARMADI —
// esik %45'te de %75'te de olum orani %100 kaldi (24 ve 32 mac). Cekilme YANLIS ILAC: helo hava
// savunma zarfina girdikten sonra ne zaman kirarsa kirsin kacamiyor. Gercek care YAKLASIMDA
// (nap_of_earth arazi maskeleme / SEAD-once) — daha buyuk bir is, ayri ele alinmali.
let BATTLE_HELO_KRITIK_YAKIT = 0.12;
// TARAF-BASI ferry bayraklari (tuzak B3: global bayrak A/B'de iki tarafi birden degistirir).
// null = global degeri kullan.
let BATTLE_FERRY_FIX_RED = null, BATTLE_FERRY_FIX_BLUE = null;
let BATTLE_HELO_KRITIK_RED = null, BATTLE_HELO_KRITIK_BLUE = null;
function battleFerryFix(isRed) {
    const v = isRed ? BATTLE_FERRY_FIX_RED : BATTLE_FERRY_FIX_BLUE;
    return v == null ? ((typeof BATTLE_FERRY_FIX === 'undefined') || BATTLE_FERRY_FIX) : !!v;
}
function battleHeloKritikYakit(isRed) {
    const v = isRed ? BATTLE_HELO_KRITIK_RED : BATTLE_HELO_KRITIK_BLUE;
    if (v != null) return v;
    return (typeof BATTLE_HELO_KRITIK_YAKIT !== 'undefined') ? BATTLE_HELO_KRITIK_YAKIT : 0.12;
}
let BATTLE_INTEL4PRO_RED = false;
let BATTLE_INTEL4PRO_BLUE = false;
// Birim tipi DOLAYLI ateş mi (topçu/havan/ÇNRA/balistik)? Karşı-batarya hedeflemesi bunu kullanır.
function battleIsIndirectType(t) {
    const s = STATS[t];
    return !!(s && (s.category === 'indirect' || (s.weapons && s.weapons[0] && s.weapons[0].indirect)));
}
// TARAF-BASI DELTA GECERSIZ KILMA (tuzak B3): BATTLE_INTEL4PRO_DELTAS tek NESNEDIR; bir deltayi
// acinca IKI TARAF da alir ve A/B'de fark kimseye atfedilemez. Bu iki nesne yalniz o tarafta
// gecerli olan degerleri tasir (null = global degeri kullan). Demet savasi bunu kullanir.
let BATTLE_INTEL4PRO_DELTAS_RED = null, BATTLE_INTEL4PRO_DELTAS_BLUE = null;
/* ── TRİYAJ KANCASI (2026-08-20) ────────────────────────────────────────────────
   26 pro-delta var ve ÖNGÖRÜ pro DEĞİL — yani hiçbiri ÖNGÖRÜ kademesinde koşmuyor.
   Her birine ayrı kapsam bayrağı yazmak (bugün dördünü öyle yaptım) triyaj için çok
   pahalı. Bu dizi, adı geçen deltaları beyin şartından muaf tutar.

   ⚠ YALNIZ ÖLÇÜM İÇİN. Sevk edilecek bir delta kendi AÇIK bayrağını alır
   (BATTLE_IKMAL_REFAKAT_INTEL4 gibi) — "hangi ayarla koştu" sorusu sonradan
   tartışılmasın diye.
   ⚠ İLERİ-BAKIŞ İŞÇİSİNE TAŞINMAZ (dizi, ayar-parmakizine girmiyor). Yani arama
   AÇIKKEN kullanma: ana iplik ile işçi farklı beyinle koşar ve bu depoda bir kez
   yaşanmış "işçi farklı beyinle koşuyor" kusurunu geri getirir.
   Varsayılan null = davranış değişmez. */
let BATTLE_PRO_DELTA_TRIYAJ = null;
function battleProDelta(isRed, key) {
    if (BATTLE_PRO_DELTA_TRIYAJ && BATTLE_PRO_DELTA_TRIYAJ.indexOf(key) >= 0) return true;
    const _ov = isRed ? BATTLE_INTEL4PRO_DELTAS_RED : BATTLE_INTEL4PRO_DELTAS_BLUE;
    const _v = (_ov && Object.prototype.hasOwnProperty.call(_ov, key)) ? _ov[key] : BATTLE_INTEL4PRO_DELTAS[key];
    if (!_v) return false;
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
// TARİF MODU (FAZ 0, ../docs/battle-ai/plans/PLAN-KONUSLANDIRMA-CAPRAZLAMA.md): doluysa o tarafın ordusu kategori-paylarından
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
// ── BİRİM KREDİ DEFTERİ (kullanıcı: "her birimin kendi ödül mekanizması olmalı") ──
// NEDEN: bu oturumda tek bir `getiri` (imha değeri ÷ maliyet) lensi kullandık ve ÜÇ KEZ yanlış
// hedef gösterdi — topçu (x0.21), keşif (x0), IFV (x0.05; orduDAN ÇIKARINCA sonuç KÖTÜLEŞTİ).
// Sebep: her birimin işi farklı. Topçunun ürünü ölü değil PANİK'tir; istihkâmınki siperde tutulan
// dost-saniyesi ve doldurduğu helo yakıtıdır; keşfinki TEKİL görüştür.
// Defter bunları AYRI AYRI biriktirir. beonai'nin kredi-atama (credit assignment) sorununun da
// girdisi budur: "kim kazandırdı" sorusu tek sayıyla cevaplanamaz.
// DETERMİNİZM: yalnız toplama yapar, sim durumuna DOKUNMAZ, RNG kullanmaz. Varsayılan KAPALI.
const BATTLE_CREDIT = { on: false, birim: {} };
function battleKrediSifirla() { BATTLE_CREDIT.birim = {}; }
function battleKrediKayit(u) {
    if (!BATTLE_CREDIT.on || !u) return null;
    let r = BATTLE_CREDIT.birim[u.id];
    if (!r) {
        r = BATTLE_CREDIT.birim[u.id] = { tip: u.type, isRed: !!u.isRed,
            maliyet: (STATS[u.type] && STATS[u.type].cost) || 0,
            // HER BIRIMIN KENDI ISI AYRI SUTUN. Bir birim tek sutunla yargilanmaz.
            hasar: 0, panik: 0, baski: 0, imhaDeger: 0, emilen: 0,   // muharip
            siperTik: 0, yakitDolum: 0, mayin: 0, kapma: 0,          // istihkam
            gorusTekil: 0, tespit: 0,                                // kesif (gorus payi + ILK tespit)
            jamTik: 0,                                               // EH araci
            iyilestirme: 0, kurtarma: 0,                             // saglikci
            muhimmat: 0, kuruEngel: 0,                               // ikmal araci
            tasinan: 0, tasimaMesafe: 0,                             // nakliye helo
            droneHasar: 0,                                           // drone operatoru (cocugun hasari)
            haleTik: 0, rally: 0,                                    // komuta araci
            havaCaydirma: 0, havaHasar: 0 };                         // hava savunmasi (caydirma + UCAGA verilen hasar)
    }
    return r;
}
function battleKredi(u, alan, miktar) {
    if (!BATTLE_CREDIT.on || !u || !miktar) return;
    const r = battleKrediKayit(u);
    if (r) r[alan] = (r[alan] || 0) + miktar;
}

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
/* ═══ TAKTİK TESPİTİ — "rakip hangi ŞEMAYI uyguluyor?" ═══════════════════════════════
   İnanç katmanı (`updateThreatProfile`) "beni ne vurdu" der: areaAlpha / air / infiltrator
   / recon. Bu bir sınıf, bir ŞEMA değil. Karşı-plan kurabilmek için gereken şudur:
   *"rakip mesafede durup dolaylı ateşle yıpratma uyguluyor"*.

   İLK ŞEMA: STANDOFF_ATIS. Kullanıcının 4 gerçek maçından ölçüldü
   (../docs/battle-ai/reports/OYUNCU-MACLARI-BULGULAR.md) — oyuncunun fiilen uyguladığı şema buydu:
     · oyuncunun dolaylı isabeti 490, AI'nın 207 (2,4×)
     · AI birim başına oyuncunun 2 katı panikliyor (3,1 / 1,5)
     · AI'nın kısa menzilli birimleri düşmana ortalama 2,79× menzil uzakta

   ÜÇ KOŞUL BİRDEN aranır — biri tek başına yetmez:
     1. areaAlpha tespit edildi (forensik: dolaylı/AoE bir şey bize vuruyor)
     2. BASTIRILMA yüksek: birimlerimizin belirgin bir kısmı bastırılmış
     3. ERİŞEMİYORUZ: tahmini kaynak, bastırılan birimlerimizin menzilinin ötesinde

   Üçüncüsü şemayı "sadece topçu yiyoruz"dan ayıran şey. Karşılık verebiliyorsak bu bir
   ateş düellosudur, standoff değil — ve karşı-planı da farklıdır.

   ⚠ SAF FONKSİYON, DAVRANIŞA BAĞLI DEĞİL. Şu an yalnızca ölçüm aracı çağırıyor
   (tools/taktik-tespit-olcum.js). Önce isabetinin RASTGELE TABANA karşı ölçülmesi,
   sonra karşı-plana bağlanması gerekiyor — bu depoda bir modeli eğitilmediği işte
   kullanmak iki kez zarar verdi (9. tuzak). */
/* KARŞI-PLAN bayrakları. VARSAYILAN KAPALI: kapı geçene dek hiçbir maçta davranış
   değişmez. battleTaktikTespit() ile aynı yerde durur ki tespit ve tepki birlikte
   okunsun. ⚠ Karşı-plan inanç katmanına bağımlıdır: battleDelta(taraf, "profile")
   kapalıysa _threatProfile hiç dolmaz ve bayrak açık olsa bile SESSİZ NO-OP olur.
   Bu yüzden A/B kurarken profile HER İKİ KOLDA da açık olmalı — yoksa ölçülen şey
   karşı-plan değil 'inanç katmanını açmak' olur. */
let BATTLE_KARSI_PLAN = false;
let BATTLE_KARSI_PLAN_GUVEN = 0.55;   // battleTaktikTespit güveni bu eşiğin altındaysa tetiklenmez
/* Derin nişanı hangi gruplar alsın. 'flank' = yalnız kanat grubu baskın yapar (doktriner:
   MAIN düşman hattını sabitlerken FLANK topları sökmeye gider). 'mainflank' = kütle de gider
   (daha sert ama hattı yarmadan derine yürüme riski). Ölçülmeden varsayılan değiştirilmez. */
let BATTLE_KARSI_PLAN_KAPSAM = 'flank';
/* KAPATMA (konsantrasyon) bileseni AYRI bayrak — cunku ATFI KARISTIRIYORDU. Karsi-plan
   ilk surumde hem yayilmayi kapatiyor hem derin nisan veriyordu; olcumde kutle UZAKLASTI
   ve hangi bilesenin sorumlu oldugu okunamadi. Olculdu (n=3): konsantrasyon acikken
   ort. mesafe +238px (t 2.85) ve bir tohumda kuvvet 282px GERI gitti. Bilesen o yuzden
   varsayilan KAPALI; acilacaksa kendi kapisini gecerek acilir. */
let BATTLE_KARSI_PLAN_KAPAT = false;
/* KARSI-PLAN TELEMETRISI — varsayilan null: hicbir sey sayilmaz, davranis degismez.
   Olcum araci bunu bir nesneye set ederek kancalarin KAC KEZ ve NE ZAMAN calistigini
   okur. Gerekce: dolayli kanitla (mac sonucu ayni mi degil mi) donup durdum; nisanin
   uygulanip uygulanmadigini DOGRUDAN saymak gerekiyordu. */
let BATTLE_KP_TELEMETRI = null;
/* ATES-DESTEGI ILERI PAYI (kontrol kolu). Saldiranin ates-destegi normalde objektifin
   %55'ine gider (erken-destek). Karsi-plan 'topcu' kapsami mekanizma kapisini gecti
   (menzilde +39.7, gozcu +44.3, KILITLI +25.9 puan) — ama bu kazancin INANCTAN mi yoksa
   sadece "topcuyu ileri sur"den mi geldigini ayirmak gerekiyor. Bu bayrak o kontroldur:
   kosuldan bagimsiz ileri tasir. VARSAYILAN 0.55 = eski davranis, byte-ayni. */
let BATTLE_TOPCU_ILERI = 0.55;


/* ── IKMAL REFAKATI (yazilmis kuralin ONGORU'ye acilmasi) ─────────────────
   `_ikmalRefakat()` / pro-delta 'supplyEscort' zaten yazilmis ama pro deltasinda BILE
   kapali (supplyEscort:false) — yani hic sevk edilmemis, ve ONGORU pro olmadigi icin
   hic kosmuyor. Ayni kusuru bagimsiz olarak yeniden buldum, o yuzden IKISI YARISTIRILIR:

     BATTLE_IKMAL_TAKIP        (benim) — SUPPORT sozlesme hedefi tum fazlarda "muhtacin yanina"
     BATTLE_IKMAL_REFAKAT_INTEL4 (mevcut) — arac dolayli-kumenin yanina, dolayliya 3x agirlik,
                                 kumeyi halenin %60'ina alir, ve TEHDIT KAPISI var
                                 (PRO_SUPPLY_TEHDIT 900px: dusman yakinsa ilerlemez)

   Tehdit kapisi onemli: benim surumumde ikmal araci olen mac 3/6 -> 5/6 cikmisti.
   Mekanizma karsilastirmasi kazanani sever; kaybeden SILINIR (iki ayni-isi-yapan
   bayrak birakmak sonraki turda karisiklik uretir). VARSAYILAN KAPALI. */
let BATTLE_IKMAL_REFAKAT_INTEL4 = false;

/* ── TOPCU KUTLE-HEDEFLEME + KARSI-BATARYA (yazilmis kuralin ONGORU'ye acilmasi) ──
   Unit.js findBestVisibleEnemy: dolayli ates icin varsayilan puan `sc = -d` yani EN YAKIN.
   Kutle-hedefleme (patlama yaricapindaki dusman sayisini maksimize et) ve karsi-batarya
   onceligi (dusman dolaylisina +400000) YALNIZ pro beyninde kosuyor; ONGORU pro degil.
   Bu bayrak ikisini birden ONGORU icin acar (kod dali ortak, ayrilamiyorlar).
   ⚠ Pro katmani BUTUN OLARAK net zararli olculdu (2026-08-09) ve tek tek deltalar
   anlamli cikmadi — yani bu bir kazanc VAADI degil, bir OLCUM ADAYI.
   VARSAYILAN KAPALI. */
let BATTLE_TOPCU_KUTLE_INTEL4 = false;

/* ── KISA MENZILLI DOLAYLI ATES MENZILE GIRER (pro 'indirectCreep' -> ONGORU) ──
   Kuralin kendi teshisi: "dolayli ates muhimmati varken tiklerin %48'inde MENZILINDE
   DUSMAN OLMADIGI icin bos duruyor; gorus %0, olu bolge %0, hedefleme filtresi %0 —
   sebep tek basina KONUM." Bagimsiz olarak ayni sonuca vardim (tools/topcu-bosta.js):
   bosta gecen zamanin %37.7'si "menzilde hic dusman yok" kovasinda.
   Guvenlik sarti kuralin icinde: kendi ON HATTININ gerisinde kalir (PRO_ICREEP_HAT_GERI)
   — one cikip olen konumlandirma becerileri (jammerPost) bu yuzden elenmisti.
   VARSAYILAN KAPALI. */
let BATTLE_DOLAYLI_YAKLAS_INTEL4 = false;

/* ── YONLU ZIRHI KORU (pro 'armorFace' -> ONGORU) ────────────────────────
   Teshis: yonlu-zirhli birimlerin maruziyeti ON %63 / YAN %27 / ARKA %10 — yani
   %37'si zirhin zayif tarafindan. Savunan MBT en kotusu: %42/%56/%1.
   Sebep: facingAngle once HAREKET yonune, sonra ATIS HEDEFINE kuruluyor; ikisi de
   "beni kim vuruyor" sorusunu sormuyor. Kural: burnu, seni VURABILEN dusmanlarin
   hasar-agirlikli merkezine dondurur.
   ⭐ BEDAVA BECERI: yalnizca yon degisir, birim yerinden oynamaz ve atesi engellemez —
   bu yuzden indirectCreep'i eleyen "one cikip olme" tuzagina dusemez.
   VARSAYILAN KAPALI. */
let BATTLE_ZIRH_YONU_INTEL4 = false;

/* ── ANTI-ESLESME FRENI (pro 'antiMatch' -> ONGORU) ─────────────────────
   KULLANICI DOKTRINI: "kutleyi buyutucem diye piyadeleri dolaylinin onune koyarsan
   olurler; dolaylilar tanka vurursa hicbir sey olmaz — birimleri ANTI kullan."
   OLCULDU (tools/anti-eslesme.js, 16 mac): temas anindaki yerel dost kutlesinin
   %22-27'si YANLIS ALET, ve temaslarin %19-23'unde sayi-orani >=1.5 (mevcut kurallar
   "iyi" der) iken ETKI-orani <1.0 (dovus kaybediliyor).
   Mevcut assaultCohesion/localRatio yalniz KAFA SAYAR; bu delta ayni kapiyi ETKI ile kurar.
   FREN niteliginde: birim yeniden konumlandirilmaz, yalniz yanlis alet kapatmaz.
   VARSAYILAN KAPALI. */
let BATTLE_ANTI_ESLESME_INTEL4 = false;
/* TAAHHUT SURESI (tik). 0 = kilit yok (eski davranis, salinimli). 600 tik = 30sn.
   Gerekce ve olcum icin bkz. battleKarsiPlanAktif icindeki TAAHHUT blogu.
   Varsayilan 0 -> davranis DEGISMEZ; kilit ancak olcerek acilir. */
let BATTLE_KARSI_PLAN_SURE = 0;

const TAKTIK_BASTIRMA_ESIK = 0.3;    // birim "bastırılmış" sayılır (suppression)
const TAKTIK_BASTIRMA_PAY = 0.15;    // canlı birimlerin bu kadarı bastırılmışsa "yüksek"
const TAKTIK_ERISIM_CARPAN = 1.15;   // kaynak, menzilimizin bu katından uzaksa "erişemiyoruz"

function battleTaktikTespit(controller) {
    const bos = { taktik: null, guven: 0, kanit: null };
    if (!controller || !controller.perception) return bos;
    const cls = controller.perception._threatProfile && controller.perception._threatProfile.classes;
    if (!cls) return bos;                       // inanç katmanı kapalı (battleDelta 'profile')
    const alan = cls.areaAlpha;
    if (!alan || !alan.detected || !alan.estPos) return bos;

    const isRed = controller.side === true;
    let canli = 0, bastirilan = 0, erisemeyen = 0, bastirilanErisemeyen = 0;
    for (const u of SIM.units) {
        if (u.dead || u.loaded || u.abandoned || u.isRed !== isRed) continue;
        const st = STATS[u.type];
        if (!st || !st.weapons || !st.weapons.length) continue;   // silahsız birim şema kanıtı değil
        canli++;
        const bas = (u.suppression || 0) > TAKTIK_BASTIRMA_ESIK;
        if (bas) bastirilan++;
        const d = Math.hypot(alan.estPos.x - u.x, alan.estPos.y - u.y);
        const uzak = d > (u.range || 0) * TAKTIK_ERISIM_CARPAN;
        if (uzak) erisemeyen++;
        if (bas && uzak) bastirilanErisemeyen++;
    }
    if (!canli) return bos;

    const basPay = bastirilan / canli;
    const erisPay = erisemeyen / canli;
    if (basPay < TAKTIK_BASTIRMA_PAY) return bos;   // bastırılma yoksa şema yok

    /* GÜVEN: üç sinyalin ÇARPIMI değil, ağırlıklı ortalaması — biri zayıfsa şema yine
       de olabilir (ör. yeni başlamış bastırma). Ama üçü de gerekli olduğu için eşikler
       yukarıda ayrıca kapı görevi görüyor. */
    const guven = Math.min(1,
        0.40 * Math.min(1, alan.confidence) +
        0.35 * Math.min(1, basPay / 0.35) +
        0.25 * erisPay);

    return {
        taktik: 'STANDOFF_ATIS',
        guven: +guven.toFixed(3),
        kanit: { alanGuven: +(alan.confidence || 0).toFixed(2), bastirilanPay: +basPay.toFixed(3),
                 erisemeyenPay: +erisPay.toFixed(3), ikisiBirden: bastirilanErisemeyen,
                 canliSilahli: canli, kaynak: alan.estPos }
    };
}

/* KARŞI-PLAN AKTİF Mİ — tek karar noktası. Hem sektör ataması hem derin-nişan bunu sorar,
   böylece eşik/rol/bayrak mantığı iki yerde ayrışmaz.
   ⚠ ÖNBELLEK YOK, bilerek: sonucu kontrolör nesnesinde tutmak, ileri-bakış rollout'u
   SIM.tick'i ilerletirken canlı tarafın rollout'un değerini okumasına yol açardı — bu
   depoda bir kez yaşanmış sapma sınıfı (canlı↔replay). Maliyet: 48 birimlik bir döngü,
   plan çevriminde grup başına birkaç kez. Ölçülebilir değil.
   v1 KAPSAMI SALDIRAN: savunanın standoff cevabı (hattı bırakıp topa gitmek) ayrı bir
   maliyet doğurur ve ayrı ölçülmeli. */
function battleKarsiPlanAktif(controller) {
    if (typeof BATTLE_KARSI_PLAN === 'undefined' || !BATTLE_KARSI_PLAN) return null;
    if (!controller) return null;
    const DEF = (typeof BATTLE_ROLE !== 'undefined') ? BATTLE_ROLE.DEFENDER : 'defender';
    const sit = controller.lastSituation;
    if (sit && sit.role === DEF) return null;
    if (typeof battleTaktikTespit !== 'function') return null;
    const t = battleTaktikTespit(controller);
    const esik = (typeof BATTLE_KARSI_PLAN_GUVEN !== 'undefined') ? BATTLE_KARSI_PLAN_GUVEN : 0.55;
    const ok = !!(t && t.taktik === 'STANDOFF_ATIS' && t.guven >= esik && t.kanit && t.kanit.kaynak);
    if (BATTLE_KP_TELEMETRI) {
        BATTLE_KP_TELEMETRI.sorgu = (BATTLE_KP_TELEMETRI.sorgu | 0) + 1;
        if (ok) BATTLE_KP_TELEMETRI.aktif = (BATTLE_KP_TELEMETRI.aktif | 0) + 1;
    }

    /* ── TAAHHÜT (hysteresis) ────────────────────────────────────────────────────
       ÖLÇÜLEN SORUN (n=10, tools/karsi-plan-olcum.js): baskın SALINIYORDU. Birlik
       kaynağa doğru yürüyünce bastırma düşüyor -> tespit sönüyor -> baskın kalkıyor ->
       birlik görünür temasa dönüyor -> yeniden bastırılıyor -> baskın yeniden başlıyor.
       Sonuç: emir maç başına 3-27 kez, ve etkisi frekansla değişiyordu:
           baskın >= 10 olan 4 tohum -> kaynağa mesafe ort. -161px
           baskın <  10 olan 6 tohum -> ort. +95px
       Toplamda anlamsız (t -0.09), çünkü iki grup birbirini götürüyordu.

       Çözüm bu depoda zaten kullanılan desen: KİLİT. Sektör ana-çabası 70sn kilitli
       kalıyor (mainSectorLockUntilTick), hedef-odağı histerezis marjıyla korunuyor.
       Karşı-plan da bir kez tetiklenince BATTLE_KARSI_PLAN_SURE tik boyunca taahhüt
       eder: bastırma kesilse bile kaynağa yürümeye devam eder. Bir manevra, ancak
       tamamlanırsa manevradır.

       ⚠ Durum kontrolör nesnesinde tutuluyor — sectorState ile AYNI desen, aynı
       gerekçeyle kabul edilebilir. Tik ile anahtarlandığı için ileri-bakış rollout'u
       kendi tikinde okur/yazar. */
    const SURE = (typeof BATTLE_KARSI_PLAN_SURE !== 'undefined') ? (BATTLE_KARSI_PLAN_SURE | 0) : 0;
    if (SURE > 0) {
        const tik = (typeof SIM !== 'undefined' && SIM.tick) || 0;
        const durum = controller._karsiPlanDurum ||
            (controller._karsiPlanDurum = { bitisTik: 0, kaynak: null, guven: 0 });
        if (ok) {
            durum.bitisTik = tik + SURE;
            durum.kaynak = { x: t.kanit.kaynak.x, y: t.kanit.kaynak.y };
            durum.guven = t.guven;
            return t;
        }
        if (tik < durum.bitisTik && durum.kaynak) {
            if (BATTLE_KP_TELEMETRI) {
                BATTLE_KP_TELEMETRI.kilitli = (BATTLE_KP_TELEMETRI.kilitli | 0) + 1;
            }
            return { taktik: 'STANDOFF_ATIS', guven: durum.guven, kilit: true,
                kanit: { kaynak: durum.kaynak, taahhut: true } };
        }
        return null;
    }

    if (!ok) return null;
    return t;
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
const PRO_IST_ILERI_DERINLIK = 0.75;   // 'engineerForward' acikken istihkamin kurabildigi en derin nokta (harita orani)
// ── HAVA SAVUNMA PAYI CARPANI (aranabilir) ──
// AD agirliklari: MANPADS 0.04 + SPAAG 0.09 + SAM 0.025 = 0.155 (+ hava radari 0.015).
// 1 = eski davranis. TARAF-BASI (tuzak B3): global olsaydi iki taraf da ayni orduyu alir ve marj
// simetrik olarak sifirlanirdi — kaldiracin MAC DEGERI olculemezdi. Kapsam VERIDEN turetilir:
// kategori air_defense + hava radari + hava silahi tasiyan piyade (manpads_team).
let BATTLE_AD_WEIGHT_MULT_RED = 1;
let BATTLE_AD_WEIGHT_MULT_BLUE = 1;

// ── SEARCH / UNCERTAIN AYRIMI (aranabilir) ──
// OLCUM (26 gercek mac, 10952 karar): korlugun %82'si UNCERTAIN; puanlama ikili oldugu icin UNCERTAIN
// tam gorusle ayni −50'yi aliyordu → 1025 UNCERTAIN kararinin HICBIRINDE SEARCH secilmedi (%0.0).
// Ara deger NOTR secildi (odul degil): UNCERTAIN bloklari ort. 5.8sn ve %94'u kendiliginden CONTACT'a donuyor.
let BATTLE_SEARCH_UNCERTAIN = false;      // OLCULMEDEN ACILMAZ
let BATTLE_SEARCH_UNCERTAIN_SCORE = 0;    // CONTACT −50 · UNCERTAIN bu · NO_CONTACT +30
// ASIL KAPI ADAY URETIMINDE (BattleSituation CourseOfActionGenerator): UNCERTAIN'de SEARCH hic
// URETILMIYORDU. Taban puan DUSUK — HOLD 35, FIRE_PREPARATION ~50; amac kesfi mumkun kilmak,
// varsayilan tercih yapmak degil (UNCERTAIN bloklari zaten ort. 5.8sn suruyor).
let BATTLE_SEARCH_UNCERTAIN_BASE = 38;

// ── 'adUmbrella' PARAMETRELERI (aranabilir) ──
// OLCUM (26 gercek oyuncu maci): helo vurus aninda AD menzil∩gorusunde yalniz %21; helo->AD medyan
// 1188px; en yakin AD cogunlukla manpads (825px menzil) → menzil disi. Ileri mesafe SABIT DEGIL,
// geometriden turer: (kutleYaricapi + dusmanHavaMenzili) − kendiMenzili, asagidaki tavanla sinirli.
let PRO_AD_MAX_ILERI = 400;          // kutlenin onune en fazla bu kadar cikar (guvenlik: AD olurse semsiye biter)
let PRO_AD_TEHDIT = 700;             // silahli dusman KARA birimi bu kadar yakinsa ilerleme
let PRO_AD_OLU_BOLGE = 120;          // hedefe bu kadar yakinsa DUR (titreme onleyici)
let PRO_AD_MIN_KUME = 4;             // korunacak kara birimi sayisi bunun altindaysa mevzi bozma
let PRO_AD_VARSAYILAN_TEHDIT = 675;  // dusman havasi GORUNMUYORKEN varsayilan tehdit menzili (attack_helo)
let PRO_KOMUTA_OLU_BOLGE = 200;   // 'commandCenter': merkeze bu kadar yakinsa DUR (titreme onleyici olu bolge)
let PRO_KOMUTA_MENZIL = 0.08;   // 'commandRange': komuta halesindeki dostun menzil carpani (UnitData'daki aura.range)

// ── FERRY DUZELTMESI (kullanici raporu + olcum; iki tarafa ve oyuncuya simetrik) ──
// "nakliye helolari birim tasirken cok titriyordu" + "her seyi tasimaya calisiyor, surekli bir sey
// tasimasina gerek yok". Kapatilirsa ESKI davranis geri gelir (A/B icin).
let BATTLE_FERRY_FIX = true;

// ── GRAMER v2: KARAR UZAYI GENISLETMESI (olculmeden acilmaz) ──
// Tavan olculdu: mukemmel secici bile kod-AI'yi ancak +771 geciyor (t 1.80). Sorun ogrenmede degil
// secilecek sey azliginda. v2 tempo'ya gercek sonuc verir, allocation'i 3->7 yapar, sektor
// kaynaklarini genisletir ve 64 kotasini intent'ler arasinda ADIL dagitir.
// HIZLI MAC'ta secilen RAKIP BEYIN etiketi. Telemetriye her sifirlamada yeniden yazilir —
// `resetBattleState()` hem oturum acilisinda HEM startBattle'da cagriliyor, dolayisiyla oturum
// acildiktan sonra telemetriye dogrudan yazmak SILINIYORDU (yakalandi).
// Dizimde sag tik ile YERLESTIRILMIS birimi havuza iade (kullanici istegi).
// NOT: bir maçta "Mavi sag kalan 1 / oldurme 0" gorunce bunu sebep sanip KAPATMISTIM — YANLIS
// cikarimdi; kullanici o maci TEST icin oyle bitirmis. Kanit olmadan ozellik kapatilmaz. ACIK.
let BATTLE_DEPLOY_SAGTIK_IADE = true;

// Yesil formasyon onizlemesi (main.js). Kullanici once istedi, sonra vazgecti → varsayilan KAPALI.
let BATTLE_FORMASYON_ONIZLEME = false;

// Turuncu "SCHWERPUNKT" ana-caba ekseni (WarRoomUI). Kullanici kaldirilmasini istedi: cizgi
// kuvvetin KUTLE MERKEZINDEN cikip hedefe gidiyordu, bu da hedefi yanlis gosteriyordu.
let BATTLE_SCHWERPUNKT_EKSENI = false;

// ── SAM COKLU HEDEF (kullanici istegi 2026-08-09) ──
// GEREKCE (kullanici): "2 helo ayni anda saldirdiginda hava ustunlugunu cok rahat kiriyor."
// Olcumle uyumlu: helo AI kayiplarinin %22'si ve SAM (menzil 1650) tek seferde tek hedefe atiyordu.
// SAM ayni anda EN FAZLA SAM_MAX_HEDEF hava hedefine ates eder (ikinci hedef ayri bekleme + ayri
// muhimmat tuketir). Determinist: uzamsal-izgara + id ile esitlik bozma, RNG yok.
let BATTLE_SAM_MULTI_TARGET = true;
let SAM_MAX_HEDEF = 2;

// ── MAC DURAKLATMA (ESC) — kullanici kusur raporu 2026-08-09: "esc bastigimda oyun dursun ve
// pencere ciksin: mactan cik / maca devam et". Duraklatma DETERMINIZMI BOZMAZ: zaman biriktirilmez,
// tik atilmaz (komutan modunun `_cmdrMayStep` kalibinin aynisi). Replay/hash etkilenmez.
let BATTLE_PAUSED = false;

let BATTLE_RAKIP_BEYIN = null;
let BATTLE_GRAMMAR_V2 = false;
let BATTLE_GRAMMAR_KOTA = 64;
const FERRY_MIN_KAZANC = 0.22;      // yolcu cepheye harita-yuksekliginin %22'sinden yakinsa TASIMA (yuruyerek gider)
const FERRY_TOPLA_YARICAP = 520;    // yari-doluyken yeni yolcu icin bu mesafeden uzaga sapma (sefer butunlugu)
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
    // ═══ HAVA SAVUNMA ŞEMSİYESİ (2026-08-08, kullanıcı gözlemi + ölçüm) ═══
    // KULLANICI: "helom çok rahat geziyor; AI'nin hava savunması ŞEMSİYE gibi olmalı, hem birimler ordan
    // çok çıkmamalı hem hava savunma YAKIN durmalı."
    // KUSUR: hava savunma `anti_air` etiketi yüzünden combatTag alıyordu → MUHAREBE kovasına düşüyor →
    // MAIN/FIXING/FLANK ile birlikte HEDEFE yürüyordu. Oysa koruması gereken değerli varlıklar GERİDE:
    // ateş desteği 0.55, destek 0.3, ihtiyat 0.2. Şemsiye taarruzla öne gidince arka AÇIKTA kalıyordu.
    // ÖLÇÜLDÜ (kullanıcının 2 canlı maçı): AI birimlerinin yalnız %65'i bir hava-savunma menzilinde
    // (insanda %92); AI havadan 22 birim kaybetti (12'si şemsiye DIŞINDA), insan 1. Ve AI'ın DOLAYLI ATEŞ
    // birimlerini öldüren #1 sebep insanın saldırı helikopteri (hasarın %47'si, 8 ölümün 4'ü) — AI'ın
    // topçusu bu yüzden 453'e karşı yalnız 193 atış yapabildi ve ÇNRA'sı 3065'e karşı 511 hasar verdi.
    // ÇÖZÜM: hava savunma, KORUDUĞU ateş desteğiyle AYNI grupta konuşlanır (FIRE_SUPPORT hedefi:
    // saldıranda 0.55, savunanda derin mevzi). Şemsiye artık değerli arkanın üstünde.
    if (cat === 'air_defense') return TASK_GROUP_ROLE.FIRE_SUPPORT;
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
// ── SİPER / SAHRA HASTANESİ YARIÇAPLARI (kullanıcı isteği) ──
// Kıyas için ölçülen mevcut haleler (TILE_PX=100): sağlıkçı 300px · ikmal 400px · istihkâm tamir 300px.
// Siper 105px ile bunların yanında dardı → 130. Hastane siperden BİRAZ büyük (165), ama sağlıkçının
// gezici 300px halesinin altında: hastanenin üstünlüğü alan değil KALICILIK (sağlıkçı ölse de durur).
const SIPER_R = 130;            // eski 105 (ondan önce 72)
const HASTANE_R = 165;

/* ── İLERİ ÜS (kullanıcı 2026-08-16: "istihkâm aracı siper değil ÜS kursun") ──
   İstihkâmın kurduğu yapı işlev olarak zaten üstü (mühimmat + hava yakıt/tamir,
   sınırsız dolum) — ama 60 SANİYEDE yok oluyordu. Bir dakikada buharlaşan şey üs
   değildir: oyuncu kurar, ordusu oraya varmadan kaybolur.
   Üs = KALICI + daha geniş + daha dayanıklı, karşılığında daha uzun kurulum ve
   taraf başına SAYI SINIRI (kalıcı yapı sınırsız olursa saha üslerle dolar). */
const US_R = 190;               // siper 130 → üs 190 (sahra hastanesi 165'ten de geniş)
const US_HP = 700;              // siper 320 → üs 700 (kalıcı yapı yıkılabilir olmalı, kâğıt değil)
const US_INSA_SN = 6.0;         // siper 3.0sn → üs 6.0sn (kalıcılığın bedeli)
const US_MAX_TARAF = 4;         // taraf başına aynı anda en fazla 4 üs

/* ── ELE GEÇİRME TEHLİKE KAPISI ────────────────────────────────────────────
   KULLANICI SAHADA GÖRDÜ: istihkâm aracı beyaz bayrak çekmiş (terk edilmiş) aracın
   üstüne ÖLÜMÜNE yürüyor.

   KÖK NEDEN (js/Unit.js, updateEngineerAI): kapma bloğu KOŞULSUZ ÖNCELİKti ve `return`
   ile çıkıyordu. Aynı fonksiyonda 20 satır AŞAĞIDA duran `closeThreat` kontrolüne
   (kendi çevresinde 360px düşman) kapma yolu HİÇ ulaşmıyordu. Üstelik arama yarıçapı
   1300px — yani haritanın yarısındaki bir enkaz için düşman ateşine yürüyordu.

   Enkaz değerlidir ama istihkâm ondan pahalıdır: öldüğünde siper/üs, mayın ve tamir
   yeteneği de gider. Kapma İPTAL EDİLMİYOR, yalnız ölümcül olduğunda erteleniyor. */
let BATTLE_KAPMA_TEHLIKE = true;   // A/B kolu
const KAPMA_TEHLIKE_R = 420;       // hedefin çevresinde bu yarıçapta düşman varsa gitme
const KAPMA_KENDI_R = 360;         // kendi çevresindeki tehdit (closeThreat ile aynı ölçek)

/* ── TOPÇU ATEŞ DİSİPLİNİ (A/B kolu) — ateş edebilen dolaylı birim yerinden oynamasın ──
   Kullanıcının 4 gerçek maçından: AI'nın dolaylı birimleri zamanın %42'sinde hareket
   halinde, oyuncununkiler %13. Birim başına isabet AI 23,0 · oyuncu 44,5. Menzilde geçen
   zaman ise neredeyse aynı (%56 / %60) — yani konum değil, sürekli yolda olmak sorun.
   Kural: hedefi + mühimmatı olan dolaylı birim MOVE emrini yok sayar; BASTIRILMIŞSA
   yok saymaz (shoot-and-scoot meşru). Ayrıntı: js/BattleController.js `battleTopcuDuraganMi`.
   ⚠ VARSAYILAN KAPALI: yerinde kalmak karşı-batarya yemek olabilir, hükmü maç kapısı verir. */
/* ⭐ SEVK EDİLDİ 2026-08-21: AÇILDI. İki bağımsız maç kapısı, AYRIK tohum, AYNI ayar
   (LA_UFUK=300; LA_DERIN=5):
     T1   (CYBORG,  n=128, tohum 123000): +318  t 2.73  taban 326  -> 8 puanla altında
     M2-9 (makine2, n=128, tohum 228000): +544  t 4.09  taban 373  -> ANLAMLI
     HAVUZ n=256: +416  SE 87.8  t 4.74  taban 246  -> TABANIN ÜSTÜNDE
   Saldıran oranı: %87.5->%93.8 (T1) · %86.7->%96.1 (M2-9). İki makinede de aynı yönde.

   ⚠ HAVUZLAMANIN MEŞRULUĞU DENETLENDİ. Bir gün önce aynı soruyu M2-4 ile havuzlamayı
   denedim ve GERİ ÇEKTİM: aradaki commit (92ef7a9) iki VARSAYILANI gerçekten çevirmişti.
   Bu sefer iki kapının tabanları arasındaki js/ farkı satır satır denetlendi
   (git diff 82d586f 97b67f2): bütün davranış değişiklikleri `if (bayrak)` korumalı ve
   bayrakların hepsi varsayılan KAPALI; geri kalanı render kodu (headless çizmez); tek
   yapısal değişiklik (executionDestekHedefi çıkarması) birebir davranış-nötr doğrulandı.

   TEŞHİS (kullanıcının 4 gerçek maçından): AI'nın dolaylı birimleri zamanın %42'sinde
   HAREKET halinde (oyuncununki %13); birim başına isabet 23.0 vs 44.5. */
let BATTLE_TOPCU_DURAGAN = true;

/* ── MENZİLE GİR (A/B kolu) — kısa menzilli doğrudan ateş beklemesin ───────
   Kullanıcının 4 gerçek maçından ölçüldü: AI ile oyuncu aynı mesafede duruyor ama AI'nın
   silahı yetmiyor (mesafe/menzil oranı AI 2.17-3.09 · oyuncu 1.24-1.82). AI'nın 20 silahlı
   biriminin 12'si kısa menzilli doğrudan ateş ve onları öne çeken hiçbir kural yok —
   `_dolayliYaklas` yalnız dolaylı ateşe bakıyor ve o da pro-kapılı.
   Ayrıntı: ../docs/battle-ai/reports/OYUNCU-MACLARI-BULGULAR.md · kural: js/Unit.js `_menzileGir`.
   ⚠ VARSAYILAN KAPALI: yaklaşmak ateş altına girmektir, maç kapısı karar verir. */
/* ⭐ SEVK EDILDI 2026-08-20: ACILDI. Iki bagimsiz maç kapisi, ayrik tohum:
     M1  (CYBORG,  n=128): +748  t 2.73  taban 768  -> tabanin 20 birim ALTINDA
     M2-1(makine2, n=128): +1222 t 4.28  taban 799  -> GECTI
     HAVUZ n=256: +975  se 198  t 4.93  taban 554  -> TABANIN USTUNDE
   ⚠ MEKANIZMA KAPISI (M0) BUNU YANLIS GOSTERMISTI: "sag kalan 12.7->5.2, marj +2071->-160"
   diyordu ve ben negatif bekledim. Sebep: M0 kurali AI SAVUNURKEN olcuyor, mac kapisi
   SALDIRANI. Savunanin menzile yurumesi yanlis, saldiranin dogru. (../docs/battle-ai/research/OLCUM-TUZAKLARI.md
   8. tuzak.) Bu yuzden kural SALDIRAN icin acildi ve varsayilan boyle kaliyor. */
let BATTLE_MENZILE_GIR = true;
const MENZILE_GIR_HEDEF = 0.85;     // düşmanı kendi menzilinin bu kesrine alacak noktaya yürü
const MENZILE_GIR_UST = 900;        // bu menzilin üstündeki birim (havan/topçu sınıfı) konu dışı
const MENZILE_GIR_AZAMI = 2200;     // bundan uzak düşman için harita boyu yürüyüş yapılmaz
const MENZILE_GIR_HAT_ILERI = 120;  // kendi ön hattının en fazla bu kadar önüne geçebilir

/* ── KARŞI-BATARYA HERKESE (A/B kolu) ──────────────────────────────────────
   Kullanıcının 4 maçında kontrollü olarak bulundu: AI, kendisini öldüren düşman
   topçusuna 214 saniyede 1 kez ateş etti. Sebep `js/BattleTargeting.js`'teki `hasArea`
   koşulu — karşı-batarya önceliği yalnız ateş eden grubun KENDİSİNDE dolaylı ateş varsa
   uygulanıyor. Ayrıntılı gerekçe orada. VARSAYILAN KAPALI. */
let BATTLE_KARSI_BATARYA_HERKES = false;

/* ── AI DEMETİ (A/B kolu) — küçük düzeltmeleri BİRLİKTE ölçmek ─────────────
   ÖLÇÜM EKONOMİSİ: bu projede aranan etkiler 300-500 bandında ve maç marjı std ≈ 2600.
   Tek tek ölçmek arm başına n≈400-600 (2-3 saat) istiyor ve üç ayrı iş de tabanın
   altında kaldı:
     emir ömrü koruma 1 : +328 (t 2.20, n=384)   → ispatlanmadı
     lojistik yedek     : +364 (t 1.35, n=96)    → ispatlanmadı
     gözcü eşiği        : mekanizma −1.6 puan    → küçük
   Üçü BAĞIMSIZ mekanizmalar (emir ömrü = yürütme, lojistik = ikmal, gözcü = tespit).
   Bağımsızlarsa etkiler toplanır ve ~+1000'lik bir demet n=96'da SAPTANABİLİR.
   Bu bayrak üçünü birlikte açar; tek değişkenli A/B mümkün olsun diye ayrı tutuldu.
   ⚠ Demet geçerse tek tek hangisinin taşıdığı AYRI bir soru olarak kalır. */
let BATTLE_AI_DEMET = false;

/* ── LOJİSTİK KURALININ KAPSAMI (A/B kolu) ─────────────────────────────────
   Kullanıcının maçından çıktı: AI'nın TEK ikmal aracı 52sn'de öldü, sonrasında RESUPPLY
   sıfır (oyuncu 215) ve topçusu 170 saniye boş gezdi. Tezgâhta AYNI KURULUMDA (AI savunan
   + arama açık) doğrulandı: ikmal ölünce dolaylı ateşin cephanesi %59 → %3, örnek başına
   1.32 birim tamamen kuru — birimler ise ayakta. Yani sorun hayatta kalma değil İKMAL.
   `battleLojistikKuraliUygula` zaten yazılmış ama gözcü kuralıyla aynı boşlukta: yalnız
   `pro` beyninde koşuyor. VARSAYILAN = ESKİ DAVRANIŞ. Maç kapısı geçmeden açılmaz. */
let BATTLE_LOJISTIK_INTEL4 = false;   // kuralı intel4 (pro olmayan) ordulara da uygula
let BATTLE_LOJISTIK_MIN = 0;          // 0 = PRO_LOJISTIK_MIN kullan; 2 = yedek ikmal aracı

/* ── GÖZCÜ KURALININ KAPSAMI (A/B kolu) ────────────────────────────────────
   Kullanıcının gerçek maçında ölçüldü: AI topçusu ateş fırsatlarının %64'ünde
   "Gözcü Yok"; oyuncuda hiç yok (oyuncu 3 keşif, AI 1). Kural `battleGozcuKuraliUygula`
   zaten yazılmış ve balistik füzede ölçülerek işe yaradığı gösterilmiş, ama:
     · yalnız `pro` beyninde koşuyor (ÖNGÖRÜ pro DEĞİL → hiç çalışmıyor)
     · eşiği 3× (balistik için); topçu 2.50'de kalıyor → tetiklemiyor
   İkisi de buradan açılır. VARSAYILAN = ESKİ DAVRANIŞ (kapalı / 3×).
   ⚠ Gözcü almak bütçeden muharip birim eksiltir → maç kapısı geçmeden açılmaz. */
let BATTLE_GOZCU_INTEL4 = false;   // kuralı intel4 (pro olmayan) ordulara da uygula
let BATTLE_GOZCU_KAT = 3;          // menzil/görüş eşiği (2 → topçuyu kapsar)

/* ── ARAMA EMRİNİN ÖMRÜ (bit maskesi) ──────────────────────────────────────
   İleri-bakış araması bir birime "şuraya git" dediğinde `_laUntilTick` damgası
   koyuyordu ama o damga HİÇ OKUNMUYORDU: kod-AI kontrolörü bir sonraki karar
   turunda emri eziyordu.

   ÖLÇÜLDÜ (tools/emir-ezen.js, 2 maç / 217 emir) — ezmeyi ÜÇ farklı olaydan
   ayırdıktan sonra (varış / kal / gerçek ezme):
     · %85 gerçek ezme (yol yarıda kesildi), %15 varış
     · ezenin TAMAMI applyBattleOrder: MOVE %62 · ATTACK %22 · HOLD %8
     · MOVE ezmelerinin medyan yaşı 20 tik, %45'i TERS yönde, yalnız %2.8'i
       kaçan birim ve %4.6'sında düşman 400px içinde → TEPKİ DEĞİL
     · verilen her emrin %44.7'si "açıklanamayan" ezmeye uğruyor

   BİT MASKESİ, tek anahtar değil: üç ezenin profili çok farklı. ATTACK ezmesinin
   medyan yaşı 0 tik ve %33'ünde düşman 400px içinde — o meşru tepki OLABİLİR;
   MOVE için aynı savunma yok. Kapatılacak kısım ölçülerek seçilsin diye ayrık.
     1 = MOVE   2 = HOLD   4 = ATTACK   8 = FREE_FIRE      (0 = koruma yok)
   Öneri kolları: 1 (yalnız MOVE) · 3 (MOVE+HOLD) · 15 (tam).

   ⚠ Zorla tutturmak birimi öldürebilir → maç kapısından geçmeden VARSAYILAN AÇILMAZ.
   Kapı: tools/rol-dengesi-paralel.js --kol BATTLE_LA_EMIR_KORUMA --koldeger 0,N */
let BATTLE_LA_EMIR_KORUMA = 0;
const LA_KORUMA_MOVE = 1, LA_KORUMA_HOLD = 2, LA_KORUMA_ATTACK = 4, LA_KORUMA_SERBEST = 8;

// A/B kolu: kapalıyken eski geçici siper (r=130, hp=320, 3sn, 60sn ömür) geri gelir.
let BATTLE_ISTIHKAM_US = true;
function battleIstihkamUs() {
    return (typeof BATTLE_ISTIHKAM_US === 'undefined') || BATTLE_ISTIHKAM_US;
}
// Bir tarafın AYAKTA kaç üssü var (hastane sayılmaz — o ayrı bir tesis).
function battleUsSayisi(isRed) {
    if (typeof SIM === 'undefined' || !SIM.trenches) return 0;
    let n = 0;
    for (const t of SIM.trenches) {
        if (t.isRed !== isRed || t.isHospital || t.destroyed) continue;
        if (t.hp != null && t.hp <= 0) continue;
        n++;
    }
    return n;
}
const HASTANE_HEAL_SN = 5;      // hp/sn — sağlıkçı halesi 6/sn; hastane biraz düşük ama sabit ve sürekli
const HASTANE_KURMA_SN = 4.0;   // siper 3.0sn; hastane biraz daha uzun

const MINE_TRIGGER_R = 65;      // basma yarıçapı (birim merkezine) — geçen birimi daha güvenilir yakalar
const MINE_BLAST_R = 95;        // patlama alan-yarıçapı
const MINE_DAMAGE = 260;        // he tabanlı (zırhlıya alt-yön etkili); matris ile çarpılır
/* ── MAYIN ALANI (kullanıcı 2026-08-16: "mayını ne kadar alana yerleştireceğimi
      mausum ile alan yaparak seçmeliyim") ──
   Eskiden `lay_mines` birimin BULUNDUĞU noktaya tek mayın bırakıyordu. Artık oyuncu
   fareyle bir daire çiziyor ve mayınlar o dairenin içine DÜZENLİ ızgarayla dizilir.

   İki kural bu işi sömürüye kapatır:
     · ERİŞİM: mayın ancak döşeyen birimin MINE_LAY_REACH'i içine konur. Harita
       öbür ucuna daire çizip oraya mayın ışınlamak yok.
     · ADET: alan ne kadar büyük olursa olsun tek emirde MINE_AREA_MAX_ADET mayın.

   Izgara DETERMİNİST (RNG yok) ve ön izleme ile motor AYNI fonksiyonu çağırır —
   böylece oyuncunun gördüğü nokta sayısı ile döşenen sayı asla ayrışmaz. */
const MINE_AREA_MAX_R = 420;        // fareyle çizilebilecek en büyük yarıçap
const MINE_AREA_SPACING = 78;       // ızgara adımı (MINE_TRIGGER_R'den geniş → mayınlar üst üste binmez)
const MINE_AREA_MAX_ADET = 14;      // tek emirde en fazla mayın
/* İSTİHKÂM GİDEREK DÖŞER (kullanıcı 2026-08-16: "mayını istihkâm aracı giderek kursun").
   İlk sürüm mayınları emir anında ANINDA koyuyordu; bu yüzden "mayını ışınlamasın" diye
   bir erişim yarıçapı (460px) gerekmişti. Artık istihkâm noktadan noktaya YÜRÜYOR, yani
   mesafe sınırı gereksiz: gitmek zaman ve risk demek, sınırı mesafenin kendisi koyuyor. */
const MINE_LAY_DIST = 34;           // bu kadar yaklaşınca döşemeye başlar
const MINE_LAY_TIME = 0.9;          // her mayın için saniye (durup döşer)
const MINE_WALK_TIMEOUT = 12;       // bir noktaya bu kadar saniyede varamazsa o noktayı ATLA (kilit emniyeti)

// Tek bir altıgen ızgara (kaydırmalı satırlar), merkezden dışa determinist sıralı.
function mineIzgara(cx, cy, r, s) {
    const out = [];
    const n = Math.ceil(r / s) + 1;
    for (let gy = -n; gy <= n; gy++) {
        const y = cy + gy * s * 0.866;               // altıgen: satır aralığı √3/2
        const kaydir = (gy & 1) ? s * 0.5 : 0;       // tek satırlar yarım adım kayar
        for (let gx = -n - 1; gx <= n + 1; gx++) {
            const x = cx + gx * s + kaydir;
            const d = Math.hypot(x - cx, y - cy);
            if (d > r) continue;
            out.push({ x: x, y: y, d: d });
        }
    }
    out.sort((a, b) => (a.d - b.d) || (a.x - b.x) || (a.y - b.y));
    return out;
}

/* Merkez+yarıçaptan DETERMİNİST mayın noktaları.
   ADET SINIRINI KÜMELEYEREK DEĞİL SEYRELTEREK uygular. İlk sürüm sınırı aşınca
   merkezdeki ilk 14 noktayı alıyordu; sonuç: 200px daire ile 420px daire AYNI sıkı
   kümeyi veriyordu, yani "ne kadar alan" seçimi 200px'ten sonra hiçbir şey ifade
   etmiyordu. Artık ızgara adımı büyütülür: geniş alan aynı mayınları daha ARALIKLI
   dizer. Oyuncu böylece yoğunluk ↔ kapsama takası yapar. */
function mineAreaNoktalari(cx, cy, r) {
    if (!(r > 0)) return [{ x: cx, y: cy }];        // sürüklemeden bırakıldı → tek mayın
    let s = MINE_AREA_SPACING;
    let out = mineIzgara(cx, cy, r, s);
    let guard = 0;
    while (out.length > MINE_AREA_MAX_ADET && guard++ < 60) {
        s *= 1.12;
        out = mineIzgara(cx, cy, r, s);
    }
    return out.slice(0, MINE_AREA_MAX_ADET);         // emniyet (döngü tıkanırsa)
}
function mineAreaTahminAdet(r) { return mineAreaNoktalari(0, 0, r).length; }

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
// KUSUR (kullanıcı, 2026-08-09): "radar açıkken sağ-alt haritada düşmanın TAMAMI görünüyor".
// KÖK NEDEN: `airRadar` bayrağı YALNIZ STATS'te var (UnitLoader.js:88); Unit örneğine hiç kopyalanmıyor.
// Bu yüzden aşağıdaki `u.airRadar` her zaman undefined'dı → "radar karayı açmaz" kuralı HİÇ çalışmadı ve
// radarın 2500px görüşü tüm KARA düşmanını da açıyordu. Sis katmanı (main.js:1385) STATS'e de baktığı için
// oyun haritası doğru görünüyordu; mini harita ve HEDEFLEME yanlıştı — rapor tam olarak bu ayrımdı.
function unitHasAirRadar(u) {
    return !!(u && (u.airRadar || (typeof STATS !== 'undefined' && STATS[u.type] && STATS[u.type].airRadar)));
}
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
        if (unitHasAirRadar(u) && targetIsAir !== true) continue; // radar yalnız havayı açar
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
    // KREDİ: panik ve baskı ATIŞI YAPANA yazılır — topçunun asıl ürünü budur, ölü sayısı değil.
    const _pOnce = tgt.panic, _sOnce = tgt.suppression;
    tgt.panic += (dmg / tgt.maxHp) * (hit.panicMul || 150);
    if (hit.isFlank) tgt.panic += hit.isRear ? 18 : 9;   // yandan/arkadan vurulmak = moral ŞOKU
    if (hit.supp) tgt.suppression += hit.supp;
    if (BATTLE_CREDIT.on) {
        const _atk = atk || null;
        if (_atk) {
            battleKredi(_atk, 'hasar', actual);
            if (tgt.isAir) battleKredi(_atk, 'havaHasar', actual);   // AA birimlerinin ASIL urunu: ucaga verilen hasar
            battleKredi(_atk, 'panik', Math.max(0, tgt.panic - _pOnce));
            battleKredi(_atk, 'baski', Math.max(0, tgt.suppression - _sOnce));
            if (tgt.hp <= 0) battleKredi(_atk, 'imhaDeger', (STATS[tgt.type] && STATS[tgt.type].cost) || 0);
            // DRONE ATFI: sarf-malzemesi drone'un hasari onu SALAN operatore de yazilir
            if (_atk.operatorId != null) { const _op = battleUnitById(_atk.operatorId); if (_op) battleKredi(_op, 'droneHasar', actual); }
        }
        battleKredi(tgt, 'emilen', actual);
    }
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
        const _pO = n.panic, _sO = n.suppression;
        n.panic += (blastDmg / n.maxHp) * 120;
        n.flashTimer = 5;
        if (typeof applyKnockback === 'function') applyKnockback(n, cx, cy, 1.8);
        n.suppression += 25;
        if (typeof BATTLE_CREDIT !== 'undefined' && BATTLE_CREDIT.on) {   // KREDI: alan hasari da atisi yapana
            const _a = atk;   // HIZ: battleUnitById DOGRUSAL tarama; atk zaten parametre olarak geliyor
            if (_a) { battleKredi(_a, 'hasar', blastActual);
                battleKredi(_a, 'panik', Math.max(0, n.panic - _pO));
                battleKredi(_a, 'baski', Math.max(0, n.suppression - _sO));
                if (n.hp <= 0) battleKredi(_a, 'imhaDeger', (STATS[n.type] && STATS[n.type].cost) || 0); }
            if (_a && _a.operatorId != null) { const _op2 = battleUnitById(_a.operatorId); if (_op2) battleKredi(_op2, 'droneHasar', blastActual); }
            battleKredi(n, 'emilen', blastActual);
        }
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
        const _pB = n.panic, _sB = n.suppression;
        n.panic += (blastDmg / n.maxHp) * 120;
        n.flashTimer = 5;
        if (typeof applyKnockback === 'function') applyKnockback(n, cx, cy, 1.6);
        n.suppression += 30;                                  // alan baskısı
        if (typeof BATTLE_CREDIT !== 'undefined' && BATTLE_CREDIT.on) {   // KREDI: DOLAYLI atesin asil urunu burada
            const _a = atk;   // HIZ: battleUnitById DOGRUSAL tarama; atk zaten parametre olarak geliyor
            if (_a) { battleKredi(_a, 'hasar', blastActual);
                battleKredi(_a, 'panik', Math.max(0, n.panic - _pB));
                battleKredi(_a, 'baski', Math.max(0, n.suppression - _sB));
                if (n.hp <= 0) battleKredi(_a, 'imhaDeger', (STATS[n.type] && STATS[n.type].cost) || 0); }
            if (_a && _a.operatorId != null) { const _op2 = battleUnitById(_a.operatorId); if (_op2) battleKredi(_op2, 'droneHasar', blastActual); }
            battleKredi(n, 'emilen', blastActual);
        }
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
