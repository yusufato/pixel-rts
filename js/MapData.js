// ═══════════════════════════════════════════════════════════════════════════
//  MapData.js — HARİTA UYGULAMA KÖPRÜSÜ
//  Artık TEK savaş haritası var: kullanıcının çizdiği ızgara-harita (MapImage.js).
//  Eski 10 daire-harita ve design v2 gerçekçi arenalar KALDIRILDI. applyMap(id)
//  imzası korundu (Story/MP/Screens çağırıyor) ama her çağrı çizilen haritayı yükler.
//  globals.js'ten SONRA, MapImage.js'ten ÖNCE yüklenir (applyImageMap orada tanımlı).
// ═══════════════════════════════════════════════════════════════════════════

let currentMapId = -2;   // -2 = çizilen harita (tek harita)

// HARİTA UYGULA — hangi id gelirse gelsin çizilen ızgara-haritayı yükler.
// (applyImageMap MapImage.js'te; MapData.js yüklenirken henüz tanımlı olmayabilir →
//  guard'lı. Açılış kurulumunu MapImage.js'in kendi applyImageMap() çağrısı yapar.)
function applyMap(id) {
    currentMapId = -2;
    if (typeof applyImageMap === 'function') return applyImageMap();
    return -2;
}
