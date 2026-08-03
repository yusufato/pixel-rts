// ═══════════════════════════════════════════════════════════════
//  BİRİM YÜKLEYİCİ — units-modern.json (veri-modeli) → motor-içi sayısal-indeksli STATS köprüsü.
//  24 string-ID'ye sayısal tip-indeksi atar; roster'dan motor-uyumlu STATS üretir (mevcut kod STATS[type].hp/range
//  okumaya devam eder) + yeni alanlar (armorType, weapons[], minRange, aura, flight, domain, roleTags, targets).
//  Ölçek: 1 kare (tile) = TILE_PX px. Determinizm: saf-veri, RNG yok. UNIT_FEATURES = UnitFeatures(db) (türetme).
// ═══════════════════════════════════════════════════════════════

// 1 kare = 100px → menzil/görüş haritaya oranla yeterince uzun (piyade görüş 7→700px, ~%14 harita; tank menzil 6→600).
// Eski 35 çok kısaydı (görüş %7 → birimler düşmanı göremeyip ATEŞ ETMİYORDU). Harita da 1.5x büyüdü (5100×3450 = 51×34 kare).
const TILE_PX = 100;
// GÖRÜŞ tam TILE_PX (uzak-görür, ateş eder); MENZİL 0.75× (kullanıcı "biraz kısalt"); HIZ 0.25× (kullanıcı "yavaşlat, taktik üreteyim").
// Görüş > menzil kalır → birim düşmanı görür, yaklaşır, sonra ateş eder (taktik pencere açılır).
const RANGE_SCALE = 0.75;
const SPEED_SCALE = 0.25;
const RANGE_PX = TILE_PX * RANGE_SCALE;       // menzil ölçeği (görüşten kısa)
const SPEED_TILE_TO_ENGINE = (TILE_PX / 20) * SPEED_SCALE;   // roster tiles/sn → motor hız (piyade 1.0→1.25 = 25px/sn, taktik-tempo)

function unitLoaderBuild(db) {
    const T = {};              // stringId → sayısal indeks
    const ID_BY_INDEX = [];    // indeks → stringId
    const STATS = {};          // indeks → motor-uyumlu tanım
    const CONST = {};          // enum-uyumu için T.INFANTRY gibi BÜYÜK-harf takma adlar
    // roster ID → eski enum BÜYÜK-harf adı (mevcut koddaki T.INFANTRY vб. referansları yaşasın)
    const LEGACY = {
        infantry: 'INFANTRY', ifv: 'MECH_INFANTRY', mbt: 'ARMOR', at_team: 'ANTI_TANK',
        artillery: 'ARTILLERY', scout_vehicle: 'RECON', engineer: 'ENGINEER', medic: 'MEDIC',
        // yeni tipler için de BÜYÜK-harf ad (roleTags/kod okunurluğu)
        mortar_team: 'MORTAR', commando: 'COMMANDO', tank_destroyer: 'TANK_HUNTER',
        mlrs: 'MLRS', ballistic_missile: 'BALLISTIC', counter_battery_radar: 'COUNTER_BATTERY',
        manpads_team: 'MANPADS', spaag: 'SPAAG', sam_battery: 'SAM', attack_helo: 'ATTACK_HELO', transport_helo: 'TRANSPORT_HELO',
        recon_uav: 'RECON_UAV', armed_uav: 'UCAV', loitering_munition: 'KAMIKAZE',
        ew_vehicle: 'EW', supply_truck: 'SUPPLY', command_vehicle: 'HQ',
        drone_operator: 'DRONE_OPERATOR'
    };

    db.units.forEach((u, i) => {
        T[u.id] = i;
        ID_BY_INDEX[i] = u.id;
        const big = LEGACY[u.id] || u.id.toUpperCase();
        CONST[big] = i;

        const weapons = (u.weapons || []).map(w => ({
            name: w.name, damage: w.damage, damageType: w.damageType,
            range: Math.round((w.range || 0) * RANGE_PX),
            minRange: Math.round((w.minRange || 0) * RANGE_PX),
            rof: w.rof, salvo: w.salvo || 1, aoe: (w.aoe || 0) * TILE_PX,
            targets: w.targets || ['ground'], indirect: !!w.indirect,
            interceptable: !!w.interceptable,   // nokta-savunma (SAM) bu mermiyi önleyebilir mi
            consumesSelf: !!w.consumesSelf, accuracy: w.accuracy || null,
            rangeByTarget: w.rangeByTarget
                ? { air: Math.round((w.rangeByTarget.air || 0) * RANGE_PX), ground: Math.round((w.rangeByTarget.ground || 0) * RANGE_PX) }
                : null
        }));
        const primary = weapons[0] || null;
        const maxRange = weapons.length ? Math.max(...weapons.map(w => w.range)) : 0;
        // KARA-MENZİL SINIRI: rangeByTarget.ground varsa, KARA hedefe bu kısa menzilden ateş eder (hava menzili tam kalır).
        // Örn. SPAAG: hava 975 (radar-güdümlü) ama karaya 480 (namlu tazyiki) → "en iyi anti-piyade" istismarı biter.
        const groundRange = (primary && primary.rangeByTarget && primary.rangeByTarget.ground) ? primary.rangeByTarget.ground : 0;
        const minRange = weapons.length ? Math.min(...weapons.filter(w => w.minRange > 0).map(w => w.minRange).concat([Infinity])) : 0;
        const domain = u.armorType === 'air' ? 'air' : 'ground';
        const anyAirTarget = weapons.some(w => (w.targets || []).includes('air'));
        const anyGroundTarget = weapons.some(w => (w.targets || []).includes('ground'));

        STATS[i] = {
            // — motor-uyumlu eski alanlar (mevcut kod bunları okur) —
            hp: u.hp, atk: primary ? primary.damage : 0,
            speed: +((u.speed || 0) * SPEED_TILE_TO_ENGINE).toFixed(4),
            tileSpeed: u.speed || 0,   // ham roster hızı (tile/sn) — accuracy hareket-cezası hesabı için

            range: maxRange || Math.round((u.vision || 0) * TILE_PX),   // silahsızsa görüş menzil sayılır (keşif)
            groundRange: groundRange,   // >0 ise KARA hedefe azami menzil (hava menzili = range); 0 = sınır yok
            vision: Math.round((u.vision || 0) * TILE_PX),
            atkSpeed: primary && primary.rof > 0 ? Math.round(1000 / primary.rof) : 100000,
            armor: u.armorValue || 0, cost: u.cost.resource,
            maxAmmo: u.ammo ? u.ammo.capacity : 0, name: u.name,
            desc: (u.roleTags || []).join(', '),
            strong: [], weak: [],   // eski counter dizileri artık kullanılmaz (damageMatrix devrede)
            // — YENİ alanlar (yeni motor bunları okur) —
            id: u.id, index: i, category: u.category, tier: u.tier, abilities: u.abilities || [],
            armorType: u.armorType, armorValue: u.armorValue || 0, armorFacing: u.armorFacing || null,
            domain, targets: anyAirTarget && anyGroundTarget ? 'both' : anyAirTarget ? 'air' : 'ground',
            weapons, minRange: (minRange === Infinity ? 0 : minRange),
            ammo: u.ammo || null, aura: u.aura || null, flight: u.flight || null,
            payload: u.payload || null,   // KRİTİK-FIX: drone-operatör payload'ı (loitering_munition ×2) — eksikti → operatör HİÇ drone salmıyordu
            transport: u.transport || null, stealth: u.stealth || 0, detect: u.detect || 0,
            airRadar: !!u.airRadar,   // hava-arama radarı: görüşü YALNIZ hava hedeflerini açar (görüş-desteği)
            pointDefense: u.pointDefense || null,   // NOKTA-SAVUNMA (SAM): gelen interceptable mermiyi olasılıkla önler
            emissions: u.emissions || 0, jammable: u.jammable || 0, singleUse: !!u.singleUse,
            provides: u.provides || [], requires: u.requires || [], roleTags: u.roleTags || [],
            supply: u.cost.supply || 0, buildTime: u.cost.buildTime || 0,
            explodesOnDeath: u.explodesOnDeath || null, onDeath: u.onDeath || null,
            resupplyRate: u.ammo ? u.ammo.resupplyRate : 0
        };
    });

    // görüş çarpanı yok (roster zaten mutlak); ama eski koddaki UNIT_*_MULTIPLIER döngüsü ARTIK ÇALIŞMAMALI (globals.js'te kalkacak).
    return { T, STATS, ID_BY_INDEX, CONST, TILE_PX };
}

// hava/kara uygunluk: attacker'ın herhangi bir silahı target'ın domain'ini vurabiliyor mu?
function unitCanEngage(attackerStats, targetStats) {
    if (!attackerStats || !targetStats || !attackerStats.weapons) return false;
    const tDomain = targetStats.domain || 'ground';
    for (const w of attackerStats.weapons) {
        if ((w.targets || []).includes(tDomain)) return true;
    }
    // KULLANICI-FIX: small_arms'lı kara-birim (piyade/komando + tüfekli) ALÇAK KAMİKAZE-DRONE'a (air+singleUse) ateş edebilir →
    // dron artık ground-bağışık değil (small_arms vs air ×0.15 = zayıf-ama-sayıca-söker). Helo/İHA (singleUse-değil) etkilenmez.
    if (tDomain === 'air' && targetStats.singleUse) {
        for (const w of attackerStats.weapons) {
            if (w.damageType === 'small_arms') return true;
        }
    }
    return false;
}

// Global kur (script-tag). node için de export.
let UNIT_FEATURES = null;
if (typeof UNITS_MODERN_DB !== 'undefined' && typeof UnitFeatures !== 'undefined') {
    UNIT_FEATURES = new UnitFeatures(UNITS_MODERN_DB);
}

if (typeof module !== 'undefined') module.exports = { unitLoaderBuild, unitCanEngage, TILE_PX };
