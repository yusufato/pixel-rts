// ═══════════════════════════════════════════════════════════════════════════
//  MapData.js — 10 SAVAŞ HARİTASI (terrain layout'ları)
//  Hepsi WORLD_W=3400 / WORLD_H=2300, KUZEY-GÜNEY AYNA simetrik (adil 1v1).
//  globals.js'ten SONRA yüklenir (WORLD_W/TERRAIN kullanır). applyMap(id) bunları
//  terrainFeatures'a IN-PLACE doldurur → 8 dosyadaki canlı-dizi okumaları kırılmaz.
//  Hızlı Maç + Çok Oyunculu'da seçilebilir; Hikaye savaşları da bunları kullanır.
// ═══════════════════════════════════════════════════════════════════════════
const _M = TERRAIN.MOUNTAIN, _F = TERRAIN.FOREST, _H = TERRAIN.HILL;

const MAPS = [
    // 0 — ÜÇ SIRT (mevcut harita, BİREBİR — geri uyumluluk)
    { id: 0, name: 'Üç Sırt', features: [
        { x: 1290, y: 1150, r: 200, type: _M, seed: 21 },
        { x: 2110, y: 1150, r: 200, type: _M, seed: 22 },
        { x: 1700, y: 620,  r: 235, type: _M, seed: 23 },
        { x: 1700, y: 1680, r: 235, type: _M, seed: 24 },
        { x: 880,  y: 620,  r: 205, type: _M, seed: 25 },
        { x: 880,  y: 1680, r: 205, type: _M, seed: 26 },
        { x: 2520, y: 620,  r: 205, type: _M, seed: 27 },
        { x: 2520, y: 1680, r: 205, type: _M, seed: 28 },
        { x: 300,  y: 1150, r: 270, type: _F, seed: 11 },
        { x: 3100, y: 1150, r: 270, type: _F, seed: 12 },
        { x: 560,  y: 930,  r: 230, type: _F, seed: 31 },
        { x: 560,  y: 1370, r: 230, type: _F, seed: 32 },
        { x: 2840, y: 930,  r: 230, type: _F, seed: 33 },
        { x: 2840, y: 1370, r: 230, type: _F, seed: 34 }
    ]},
    // 1 — AÇIK OVA: az engel, geniş açık savaş (zırhlı/menzil avantajı)
    { id: 1, name: 'Açık Ova', features: [
        { x: 1700, y: 720,  r: 160, type: _M, seed: 101 },
        { x: 1700, y: 1580, r: 160, type: _M, seed: 102 },
        { x: 550,  y: 650,  r: 240, type: _F, seed: 103 },
        { x: 550,  y: 1650, r: 240, type: _F, seed: 104 },
        { x: 2850, y: 650,  r: 240, type: _F, seed: 105 },
        { x: 2850, y: 1650, r: 240, type: _F, seed: 106 }
    ]},
    // 2 — ORMAN LABİRENTİ: bol orman (kanat/pusu), dar koridorlar
    { id: 2, name: 'Orman Labirenti', features: [
        { x: 900,  y: 750,  r: 230, type: _F, seed: 111 },
        { x: 900,  y: 1550, r: 230, type: _F, seed: 112 },
        { x: 2500, y: 750,  r: 230, type: _F, seed: 113 },
        { x: 2500, y: 1550, r: 230, type: _F, seed: 114 },
        { x: 1700, y: 1150, r: 210, type: _F, seed: 115 },
        { x: 400,  y: 1150, r: 210, type: _F, seed: 116 },
        { x: 3000, y: 1150, r: 210, type: _F, seed: 117 },
        { x: 1300, y: 1150, r: 150, type: _M, seed: 118 },
        { x: 2100, y: 1150, r: 150, type: _M, seed: 119 }
    ]},
    // 3 — DAĞ GEÇİTLERİ: dağ duvarları 3 dar geçit bırakır (tıkaç savaşı)
    { id: 3, name: 'Dağ Geçitleri', features: [
        { x: 1290, y: 1150, r: 180, type: _M, seed: 121 },
        { x: 2110, y: 1150, r: 180, type: _M, seed: 122 },
        { x: 1700, y: 760,  r: 220, type: _M, seed: 123 },
        { x: 1700, y: 1540, r: 220, type: _M, seed: 124 },
        { x: 480,  y: 800,  r: 230, type: _F, seed: 125 },
        { x: 480,  y: 1500, r: 230, type: _F, seed: 126 },
        { x: 2920, y: 800,  r: 230, type: _F, seed: 127 },
        { x: 2920, y: 1500, r: 230, type: _F, seed: 128 }
    ]},
    // 4 — MERKEZ KALE: ağır merkez dağ yığını, açık kanatlar (kuşatma)
    { id: 4, name: 'Merkez Kale', features: [
        { x: 1700, y: 1150, r: 200, type: _F, seed: 131 },
        { x: 1450, y: 880,  r: 180, type: _M, seed: 132 },
        { x: 1950, y: 880,  r: 180, type: _M, seed: 133 },
        { x: 1450, y: 1420, r: 180, type: _M, seed: 134 },
        { x: 1950, y: 1420, r: 180, type: _M, seed: 135 },
        { x: 650,  y: 1150, r: 250, type: _F, seed: 136 },
        { x: 2750, y: 1150, r: 250, type: _F, seed: 137 }
    ]},
    // 5 — ÇİFTE KORİDOR: iki dikey orman-hattı, ikis ana saldırı şeridi
    { id: 5, name: 'Çifte Koridor', features: [
        { x: 1130, y: 700,  r: 220, type: _F, seed: 141 },
        { x: 1130, y: 1150, r: 220, type: _F, seed: 142 },
        { x: 1130, y: 1600, r: 220, type: _F, seed: 143 },
        { x: 2270, y: 700,  r: 220, type: _F, seed: 144 },
        { x: 2270, y: 1150, r: 220, type: _F, seed: 145 },
        { x: 2270, y: 1600, r: 220, type: _F, seed: 146 },
        { x: 1700, y: 1150, r: 120, type: _M, seed: 147 }
    ]},
    // 6 — KÖŞE KALELERİ: 4 köşe arazi, açık merkez (merkez kontrolü)
    { id: 6, name: 'Köşe Kaleleri', features: [
        { x: 620,  y: 640,  r: 250, type: _M, seed: 151 },
        { x: 620,  y: 1660, r: 250, type: _M, seed: 152 },
        { x: 2780, y: 640,  r: 250, type: _M, seed: 153 },
        { x: 2780, y: 1660, r: 250, type: _M, seed: 154 },
        { x: 1150, y: 950,  r: 200, type: _F, seed: 155 },
        { x: 1150, y: 1350, r: 200, type: _F, seed: 156 },
        { x: 2250, y: 950,  r: 200, type: _F, seed: 157 },
        { x: 2250, y: 1350, r: 200, type: _F, seed: 158 }
    ]},
    // 7 — ÇAPRAZ SIRTLAR: çapraz dağ dizileri (ayna), kanat manevrası
    { id: 7, name: 'Çapraz Sırtlar', features: [
        { x: 950,  y: 800,  r: 200, type: _M, seed: 161 },
        { x: 1350, y: 1000, r: 200, type: _M, seed: 162 },
        { x: 2450, y: 800,  r: 200, type: _M, seed: 163 },
        { x: 2050, y: 1000, r: 200, type: _M, seed: 164 },
        { x: 950,  y: 1500, r: 200, type: _M, seed: 165 },
        { x: 1350, y: 1300, r: 200, type: _M, seed: 166 },
        { x: 2450, y: 1500, r: 200, type: _M, seed: 167 },
        { x: 2050, y: 1300, r: 200, type: _M, seed: 168 },
        { x: 350,  y: 1150, r: 240, type: _F, seed: 169 },
        { x: 3050, y: 1150, r: 240, type: _F, seed: 170 }
    ]},
    // 8 — DAĞINIK TEPELER: bol küçük dağ, parçalı örtü (piyade dostu)
    { id: 8, name: 'Dağınık Tepeler', features: [
        { x: 750,  y: 850,  r: 140, type: _M, seed: 171 },
        { x: 750,  y: 1450, r: 140, type: _M, seed: 172 },
        { x: 2650, y: 850,  r: 140, type: _M, seed: 173 },
        { x: 2650, y: 1450, r: 140, type: _M, seed: 174 },
        { x: 1700, y: 720,  r: 150, type: _M, seed: 175 },
        { x: 1700, y: 1580, r: 150, type: _M, seed: 176 },
        { x: 1250, y: 1150, r: 150, type: _M, seed: 177 },
        { x: 2150, y: 1150, r: 150, type: _M, seed: 178 },
        { x: 500,  y: 1150, r: 200, type: _F, seed: 179 },
        { x: 2900, y: 1150, r: 200, type: _F, seed: 180 },
        { x: 1700, y: 1150, r: 170, type: _F, seed: 181 }
    ]},
    // 9 — GENİŞ CEPHE: orta hatta yatay orman kuşağı (cephe savaşı)
    { id: 9, name: 'Geniş Cephe', features: [
        { x: 600,  y: 1150, r: 230, type: _F, seed: 191 },
        { x: 1150, y: 1150, r: 230, type: _F, seed: 192 },
        { x: 1700, y: 1150, r: 230, type: _F, seed: 193 },
        { x: 2250, y: 1150, r: 230, type: _F, seed: 194 },
        { x: 2800, y: 1150, r: 230, type: _F, seed: 195 },
        { x: 1150, y: 700,  r: 180, type: _M, seed: 196 },
        { x: 2250, y: 700,  r: 180, type: _M, seed: 197 },
        { x: 1150, y: 1600, r: 180, type: _M, seed: 198 },
        { x: 2250, y: 1600, r: 180, type: _M, seed: 199 }
    ]}
];

let currentMapId = 0;

// HARİTA UYGULA — terrainFeatures'a IN-PLACE doldur (alias-güvenli), süsle, AI cache tazele.
function applyMap(id) {
    if (id === -2 && typeof applyImageMap === 'function') { currentMapId = -2; return applyImageMap(); }   // çizilen ızgara-harita
    if (typeof MAP_MODE !== 'undefined') MAP_MODE = 'circle';     // eski daire-haritaya dönüş
    if (typeof MAPS === 'undefined' || typeof terrainFeatures === 'undefined') return 0;
    currentMapId = ((id | 0) % MAPS.length + MAPS.length) % MAPS.length;
    if (typeof currentElevSeed !== 'undefined') { currentElevSeed = 7919 * (currentMapId + 1); _elevDirty = true; }   // T2: harita-bazlı yükselti tohumu (her harita farklı topografya)
    const src = MAPS[currentMapId].features;
    terrainFeatures.length = 0;                                  // REASSIGN değil → 8-dosya canlı okuma kırılmaz
    for (const f of src) terrainFeatures.push({ x: f.x, y: f.y, r: f.r, type: f.type, seed: f.seed });
    if (typeof decorateTerrain === 'function') decorateTerrain(terrainFeatures);
    if (typeof refreshSimTerrainCaches === 'function') refreshSimTerrainCaches();   // AI orman/dağ cache (AI.js)
    return currentMapId;
}

applyMap(0);   // AÇILIŞ: eski tek-harita (geri uyumlu, deploy sahnesi dolu)
