// ═══════════════════════════════════════════════════════════════
//  BİRLİK SINIFI
// ═══════════════════════════════════════════════════════════════
function battleUnitVisibleToViewer(unit, viewerSide, phaseValue) {
    if (!unit || unit.dead) return false;
    if (unit.isRed === viewerSide) return true;
    if (phaseValue === PHASE.DEPLOY) return false;
    // HAVA-ARAMA RADARI: `targetIsAir` verilmezse canSee radarı hiç saymaz. Eskiden burada verilmiyordu →
    // radar bir uçağı bulsa bile ekranda/mini haritada GÖSTERMİYORDU (buna karşılık `airRadar` bayrağı
    // örneğe kopyalanmadığı için radar KARAYI açıyordu; ikisi birlikte tam ters davranış üretiyordu).
    if (phaseValue === PHASE.BATTLE) return canSee(viewerSide, unit.x, unit.y, unit.isAir);
    return true;
}

// RADAR TEMASI: birim YALNIZ hava-arama radarı sayesinde biliniyor mu? (göz teması yok)
// Böyle temaslar sprite olarak değil KIRMIZI temas işareti olarak çizilir — kullanıcı isteği:
// "siste kalan birim oyun haritasında KIRMIZI gösterilsin".
function battleRadarOnlyContact(unit, viewerSide) {
    if (!unit || unit.dead || unit.isRed === viewerSide) return false;
    if (typeof canSee !== 'function') return false;
    return canSee(viewerSide, unit.x, unit.y, unit.isAir) && !canSee(viewerSide, unit.x, unit.y, false);
}

class Unit {
    constructor(type, x, y, isRed) {
        Unit.nextId = (Unit.nextId || 0) + 1;
        this.id = Unit.nextId;
        this.type = type;
        const spawnPoint = typeof terrainSafePoint === 'function'
            ? terrainSafePoint(x, y, 30)
            : { x, y };
        this.x = spawnPoint.x;
        this.y = spawnPoint.y;
        this.isRed = isRed;
        this.controlOwner = isRed
            ? (typeof CONTROL_OWNER !== 'undefined' ? CONTROL_OWNER.ENEMY_AI : 'ENEMY_AI')
            : (typeof CONTROL_OWNER !== 'undefined' ? CONTROL_OWNER.PLAYER : 'PLAYER');
        this.controllerId = null;
        this.dead = false;
        this.selected = false;

        const s = STATS[type];
        this.isAir = !!(s && s.domain === 'air');   // FAZ 2: hava birimi — araziyi yok sayar, yalnız AA vurabilir
        // MISSION-KILL: mürettebatlı ZIRHLI ARAÇ (tank/ZMA/TD/SPAAG/SAM/topçu/keşif) → hasarda terk edilebilir → nötr → ele geçirilir
        this._crewed = !this.isAir && (s.armorType === 'heavy' || s.armorType === 'light') && !!(s.weapons && s.weapons.length);
        this.abandoned = false;
        this.maxHp = s.hp;
        this.hp = s.hp;
        this.atk = s.atk;
        this.baseSpeed = s.speed;
        this.speed = s.speed;
        this.range = s.range;
        this._baseRange = s.range;   // KOMUTA MENZILI: hale carpani her tik TABAN uzerinden uygulanir (birikme olmaz)
        this.groundRange = s.groundRange || 0;   // >0: KARA hedefe azami menzil (SPAAG: hava 975 / kara 480)
        this.vision = s.vision;
        this.atkSpeed = s.atkSpeed;
        this.baseArmor = s.armor;
        this.armor = s.armor;
        
        this.inForest = false;
        this.revealTimer = 0;        // T3 PUSU: >0 iken açıkta (yeni ateş etti), 0 iken ormanda gizlenebilir
        this.ghX = null; this.ghY = null; this.ghHp = this.hp; this.ghT = 0; this.ghVisible = false;   // görüş-belleği (rakip beni en-son nerede gördü) — NaN guard
        this.elevation = 0.5;
        this.inTrench = false;
        this.buildTrenchTarget = null;
        this.buildTrenchTimer = 0;
        this.supplyProgress = 0;
        this.lastFieldBuiltAt = -Infinity;

        this.targetX = this.x;
        this.targetY = this.y;
        this.attackTarget = null;
        this.manualTarget = null;
        this.manualMoveTarget = null;
        this.lastAttackTime = 0;
        this._hicAtesEtmedi = true;   // BATTLE_SPAWN_LOADED: ilk atış dolum beklemez (birim namluda mermiyle konuşlanır)
        this.isMovingToManualTarget = false;
        
        this.combatState = 'READY';

        this.panic = 0; // 0 to 100
        this.panicResistance = 0;
        this.isPanicking = false;
        this.isFleeing = false;
        this.fleeTarget = null;
        this.hasFledOnce = false;
        this.lastStandMorale = false;

        // ── Moral & kohezyon bağlamı (her taramada güncellenir) ──
        this.localForceRatio = 1;      // yerel dost gücü / düşman gücü
        this.leaderNearby = false;     // yakında deneyimli/gazi (lider) var mı
        this.fleeingNearby = 0;        // yakında kaçan dost sayısı (bozgun yayılımı)
        this.nearbyAllyStrength = 0;
        this.nearbyEnemyStrength = 0;
        this.encirclement = 0;         // T3 KUŞATILMA: etrafımı saran düşman açı-kapsaması 0..1 (8 sektör)
        this.supplyDist = 0;           // T3 LOJİSTİK: üs-kenarından uzaklık 0..1 (0=üste yakın, 1=derin cephe)
        this.supplyCut = false;        // T3 LOJİSTİK: ikmal hattım kesik mi (düşman benimle üs arasında) → ikmal durur
        this.lastNearbyAllyCount = 0;  // yoldaş kaybını tespit için

        this.suppression = 0; // 0 to 100
        this.facingAngle = isRed ? Math.PI / 2 : -Math.PI / 2;
        this.maxAmmo = s.maxAmmo;
        this.ammo = s.maxAmmo;
        // DOLAYLI ATEŞ (topçu/havan/ÇNRA/balistik): birincil silahı indirect → gözcü ister, LOS aramaz, dost-hattı aşar, alan-hasarı yapar.
        this.isIndirect = !!(s.weapons && s.weapons[0] && s.weapons[0].indirect);
        // TAŞIMA: YALNIZ NAKLİYE HELİKOPTERİ piyade taşır (kullanıcı isteği: nakliye-heli hariç birlik taşıması yok →
        // IFV/kara-araç transport-slot'u 0). loaded=araç içinde (gizli/hedeflenmez); carrier=taşıyıcı; cargo=yolcular.
        this.transportSlots = (s.transport && s.transport.slots && this.isAir) ? s.transport.slots : 0;
        this.transportAllows = (s.transport && s.transport.allows) ? s.transport.allows : null;
        this.cargo = [];
        this.loaded = false;
        this.carrier = null;
        // YAKIT/SORTİ (hava): uçarken yakar, düşük→üsse dön+ikmal, biter→düşer (kamikaze tek-yön hariç).
        this.maxFuel = (s.flight && s.flight.fuel) ? s.flight.fuel : 0;
        this.fuel = this.maxFuel;
        this.fuelBurn = (s.flight && s.flight.fuelBurn) ? s.flight.fuelBurn : 0;
        this._returningToBase = false;
        // YETENEKLER (abilities → mekanik): dig_in/garrison=siperlen, ambush/stay_hidden/infiltrate=mevzi-gizlen, overrun=ez.
        const _ab = s.abilities || [];
        this._canDigIn = _ab.includes('dig_in') || _ab.includes('garrison');
        this._canAmbush = _ab.includes('ambush') || _ab.includes('stay_hidden') || _ab.includes('infiltrate');
        this._canOverrun = _ab.includes('overrun');
        this._canHoldFire = _ab.includes('hold_fire');       // sabırlı: yalnız %70 menzilde ateşle (pusu disiplini)
        this._canMark = _ab.includes('mark_target');         // hedef işaretle → müttefik +%25 hasar
        this._canSabotage = _ab.includes('sabotage');        // destek/lojistik/komuta hedefe ×1.5 (arka-avcısı)
        this._autoAir = _ab.includes('auto_engage_air');     // hava hedefe öncelik (SPAAG)
        this._canRally = _ab.includes('rally');              // kaçan dostları topla (komuta)
        this._needsDeploy = _ab.includes('deploy');          // hareket sonrası ~2sn kurulum: isabet düşük
        this._canScoot = _ab.includes('shoot_and_scoot');    // ateş sonrası geri çekil (karşı-batarya kaç)
        this._topStrike = _ab.includes('strike_top_armor');  // kamikaze üstten dalar → zırhlıya üst-yön çarpanı
        const _rt0 = s.roleTags || [];   // FAZ2 AV-PAKETİ: kamikaze/komando/arka-avcısı → ana-hatta değil HVT'ye (destek/topçu/radar/AA) yönelir
        this._hvtHunter = _rt0.includes('assassin') || _rt0.includes('backline_hunter') || _rt0.includes('anti_support') || !!s.singleUse;
        this.jammable = s.jammable || 0;                     // KULLANICI-FIX: EH-karıştırmasına açıklık (drone/İHA 0.8-1.0) — EKSİKTİ → jamming ölü-koddu, artık aktif
        this._detect = s.detect || 0;                        // gizli düşmanı tespit yarıçapı çarpanı
        this._stationaryT = 0;   // kaç sn hareketsiz (siperlenme + pusu için)
        this.entrench = 0;       // 0..1 siperlenme (dig_in): gelen hasarı azaltır
        this.kills = 0;
        this.level = 0; // 0: Çaylak, 1: Deneyimli, 2: Gazi
        
        // Rütbe çarpanları (HP ve Atk için)
        this.xpBonus = 1.0;

        this.sx = SP_PAD + (typeof battleSpriteCol === 'function' ? battleSpriteCol(type) : type) * (SP_W + SP_PAD);
        this.sy = isRed ? (SP_PAD * 2 + SP_H) : SP_PAD;
        this.flashTimer = 0;
        this.scanTimer = srandInt(30);
        this._motionProbeX = this.x;
        this._motionProbeY = this.y;
        this._motionProbeTick = 0;
        this._motionStalls = 0;
        this._unstickPoint = null;
        this._unstickUntilTick = 0;
    }

    update(now, dtSec = GAME_SPEED / 60) {
        if (this.dead || phase !== PHASE.BATTLE) return;
        if (this.loaded) {   // TAŞINAN piyade: araçla birlikte gider, kendi AI'sı çalışmaz; taşıyıcı ölürse o da ölür
            if (!this.carrier || this.carrier.dead) { this.dead = true; this.loaded = false; return; }
            this.x = this.carrier.x; this.y = this.carrier.y;
            return;
        }
        if (this.abandoned) {   // TERK EDİLMİŞ ARAÇ (nötr/gri): durur, savaşmaz; yakınında İSTİHKAM varsa o taraf tamir edip ELE GEÇİRİR
            this.targetX = this.x; this.targetY = this.y; this.manualMoveTarget = null; this.isMovingToManualTarget = false;
            this.attackTarget = null;
            const near = SIM.spatialGrid.getNearby(this.x, this.y, 90);
            let repSide = null, repIsPlayer = false;
            for (const o of near) {
                if (o.dead || o.abandoned || o.type !== T.ENGINEER) continue;
                if (Math.hypot(o.x - this.x, o.y - this.y) < 82) { repSide = o.isRed; repIsPlayer = (o.controlOwner === 'PLAYER'); break; }
            }
            if (repSide !== null) {
                this.hp = Math.min(this.maxHp, this.hp + 0.55 * (dtSec * 60));   // istihkam sahada tamir eder
                // İMHA GEREKÇESİ İÇİN OLAY İŞARETİ: araç FİİLEN tamir ediliyor. Karşı taraf bunu görüp
                // ganimeti inkâr edebilir. Konuma dayalı gerekçe (yakında istihkâm var / etraf kalabalık)
                // ÖLÇÜLDÜ ve kural hâline geliyordu (teslim-sonrası atış 0.0 → 7.9-12.1); tamir OLAYI ise
                // nadir ve kesin: tamir yoksa araç zaten ele geçirilemez.
                this._tamirTick = SIM.tick; this._tamirSide = repSide;
                if (this.hp >= this.maxHp * 0.45) {   // yeterince onarıldı → ELE GEÇİRİLDİ (tamir eden tarafın olur)
                    this.abandoned = false; this.isRed = repSide;
                    this.controlOwner = repIsPlayer ? 'PLAYER' : (typeof CONTROL_OWNER !== 'undefined' ? CONTROL_OWNER.ENEMY_AI : 'ENEMY_AI');
                    this.controllerId = null; this.combatState = 'READY'; this.suppression = 0; this.panic = 0;
                    this.sy = this.isRed ? (SP_PAD * 2 + SP_H) : SP_PAD;   // sprite satırını yeni tarafın rengine çevir
                    this.facingAngle = this.isRed ? Math.PI / 2 : -Math.PI / 2;
                    if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) BATTLE_BALANCE.captured[repSide ? 'red' : 'blue']++;
                    if (typeof battleRecordLifeEvent === 'function') battleRecordLifeEvent({ kind: 'CAPTURE', unitId: this.id, side: repSide ? 'red' : 'blue', type: this.type, x: Math.round(this.x * 100) / 100, y: Math.round(this.y * 100) / 100 });
                }
            }
            return;
        }
        if (this._retired) {   // ONURLU-EMEKLİ HELO: yakıtsız ama dost-kenarda indi → donmuş (savaşmaz/uçmaz/çökmez), maç-sonuna dek sağ kalır
            this.targetX = this.x; this.targetY = this.y; this.manualMoveTarget = null; this.isMovingToManualTarget = false;
            this.attackTarget = null; this.manualTarget = null; this.fuel = 0;
            return;
        }
        // Eski denge 60 FPS kare adımına göre kuruluydu. frameScale, aynı oranları
        // koruyup simülasyonu render FPS'i ve multiplayer tick hızından bağımsız yapar.
        const frameScale = Math.max(0, dtSec * 60);

        if (this.flashTimer > 0) this.flashTimer -= frameScale;
        // T3 PUSU: açıkta kalma süresi azalır → tekrar gizlenir.
        // KUSUR (kullanıcı raporu 2026-08-09): "açığa çıkan birim GÖZÜMÜN ÖNÜNDE tekrar gizleniyor,
        // kötü görünüyor — sisin içine girmediği sürece gizlenmesin." HAKLI: sayaç, düşman ona
        // BAKARKEN de işliyordu ve birim izlenirken kayboluyordu.
        // DÜZELTME: sayaç YALNIZCA görülmediğinde (siste) işler. Görüş alanındayken açıkta kalır.
        // Determinist: `canSee` yalnız mesafe/görüş okur, RNG yok. Maliyet: yalnız AÇIKTAKİ birimler
        // için, kare başına bir `canSee` çağrısı.
        if (this.revealTimer > 0) {
            const _gorunuyor = (typeof canSee === 'function') && canSee(!this.isRed, this.x, this.y, this.isAir);
            if (!_gorunuyor) this.revealTimer -= frameScale;
        }
        this.scanTimer -= frameScale;

        if (this.suppression > 0) this.suppression -= 0.18 * frameScale;   // T1: yavaş decay → bastırma birikebilir (taktik kaynak)
        // Alan hasarı aynı tikte birden fazla kez bastırma ekleyebilir. Değer
        // sınırlandırılmazsa 250–300'e çıkar ve birlik onlarca saniye %12 hızda
        // kalır; bu taktiksel pinned değil, oyuncuya donma gibi görünen taşmadır.
        this.suppression = Math.max(0, Math.min(100, this.suppression));

        // Her ~30 frame'de bir çevreyi tara: düşman görüşü + birlik morali bağlamı
        if (this.scanTimer <= 0) {
            this.scanTimer = 30;
            const vRadius = this.vision;
            const vRadius2 = vRadius * vRadius;
            const MORALE_R2 = 280 * 280; // moral etkisi yarıçapı (yoldaşlık hissi)
            const SUPPLY_R2 = 470 * 470; // T3 lojistik: ikmal hattı kesme yarıçapı (biraz daha geniş)
            const homeSign = this.isRed ? -1 : 1;   // üs yönü: kırmızı=kuzey(-y), mavi=güney(+y)
            let enemySeen = false;
            let allyStr = 0, enemyStr = 0, allyCount = 0, leaderNear = false, fleeingNear = 0;
            let encSectors = 0;       // T3 KUŞATILMA: yakın düşmanların doldurduğu 8 sektör bit-maskesi
            let enemyHomeward = 0;    // T3 LOJİSTİK: benimle üs arasındaki düşman gücü (hat kesme)
            for (const u of SIM.units) {
                if (u.dead) continue;
                const ddx = u.x - this.x, ddy = u.y - this.y;
                const d2 = ddx * ddx + ddy * ddy;
                if (u.isRed !== this.isRed) {
                    // Düşman: görüş + yerel tehdit gücü
                    if (!enemySeen && d2 <= vRadius2) enemySeen = true;
                    if (d2 <= MORALE_R2) {
                        enemyStr += u.atk * (u.hp / Math.max(1, u.maxHp));
                        const sec = (Math.floor((Math.atan2(ddy, ddx) + Math.PI) / (Math.PI / 4)) & 7);   // 0..7 yön sektörü
                        encSectors |= (1 << sec);
                    }
                    if (d2 <= SUPPLY_R2 && (ddy * homeSign) > Math.abs(ddx) * 0.5) {   // üs yönünde (arkamda) düşman → hattı keser
                        enemyHomeward += u.atk * (u.hp / Math.max(1, u.maxHp));
                    }
                } else if (u !== this) {
                    // Dost: yerel destek gücü, lider varlığı, bozgun yayılımı
                    if (d2 <= MORALE_R2) {
                        allyStr += u.atk * (u.hp / Math.max(1, u.maxHp));
                        allyCount++;
                        if (u.level >= 1) leaderNear = true; // deneyimli/gazi = lider
                        if (u.isFleeing) fleeingNear++;
                    }
                }
            }
            this.enemyInVision = enemySeen;
            allyStr += this.atk * (this.hp / Math.max(1, this.maxHp)); // kendini de say (yalnız değilsin)
            this.nearbyEnemyStrength = enemyStr;
            this.nearbyAllyStrength = allyStr;
            this.localForceRatio = allyStr / (enemyStr + 1);
            let _ec = encSectors, _cnt = 0; while (_ec) { _cnt += _ec & 1; _ec >>= 1; }   // T3 KUŞATILMA: dolu sektör say
            this.encirclement = _cnt / 8;                                                  // 0=serbest, 1=tam sarılı (Cannae)
            this.supplyDist = this.isRed ? (this.y / WORLD_H) : (1 - this.y / WORLD_H);    // T3 LOJİSTİK: üsten uzaklık 0..1
            this.supplyCut = this.supplyDist > 0.22 && enemyHomeward > (this.atk * 1.4 + 6); // arkamda yeterli düşman → hat kesik
            this.leaderNearby = leaderNear;
            this.fleeingNearby = fleeingNear;
            // Çevredeki dost sayısı düştüyse → yoldaş kaybı şoku (tek seferlik panik sıçraması)
            const losses = this.lastNearbyAllyCount - allyCount;
            if (losses > 0 && this.enemyInVision && !this.lastStandMorale) {
                this.panic = Math.min(100, this.panic + Math.min(45, losses * 15));
            }
            this.lastNearbyAllyCount = allyCount;
        }

        /* ── İNSANSIZ PLATFORM PANİKLEMEZ (kullanıcı 2026-08-16) ──
           Drone'un içinde korkacak kimse yok. Bu yalnız "mantıksız görünüyor" meselesi
           de değildi: panikleyen kamikaze KAÇIYOR (fleeTarget'a yöneliyor) ve dahası
           `performAttack` ilk satırda `isFleeing` görünce geri dönüyor — yani drone
           hedefe dalsa BİLE patlayamıyordu. Ölçüldü (tools/kusur-teshis.js): 6 drone
           400 tikte 889 tik panik / 658 tik kaçış; 6'sı da temasa girdi ama 3'ü patladı.
           İnsanlı `drone_operator` etkilenmez (kategorisi 'uav' değil). */
        if (STATS[this.type] && STATS[this.type].unmanned) {
            this.panic = 0;
            this.isPanicking = false;
            this.isFleeing = false;
            this.fleeTarget = null;
            this.lastStandMorale = false;
        } else {

        const hpRatio = this.hp / Math.max(1, this.maxHp);
        if (this.hasFledOnce && hpRatio <= 0.25) {
            this.lastStandMorale = true;
            this.isFleeing = false;
            this.fleeTarget = null;
        } else if (hpRatio > 0.38) {
            this.hasFledOnce = false;
            this.lastStandMorale = false;
        }

        const isLeader = this.level >= 1;        // deneyimli/gazi = soğukkanlı lider
        const ratio = this.localForceRatio || 1;
        const outnumbered = ratio < 0.75;        // yerelde sayıca/güççe dezavantaj
        const dominant = ratio > 1.5;            // yerelde üstünlük → cesaret

        // ── Panik KAZANIMI (korku kaynakları) ──
        let panicGain = 0;
        if (hpRatio < 0.3 && this.enemyInVision) panicGain += 10 / 60 * frameScale;            // yaralı + düşman karşıda
        if (outnumbered && this.enemyInVision) panicGain += (0.75 - ratio) * 14 / 60 * frameScale; // sayıca dezavantaj
        if (this.encirclement >= 0.5 && this.enemyInVision) panicGain += (this.encirclement - 0.375) * 34 / 60 * frameScale; // T3 KUŞATILMA (Cannae): etrafı sarılan birlik moral çöker → ENVELOP ödüllenir
        if (this.supplyCut && this.enemyInVision) panicGain += 5 / 60 * frameScale;             // T3 LOJİSTİK: ikmal hattı kesik → tedirginlik (geri çekil sinyali)
        if (this.fleeingNearby >= 2 && this.enemyInVision) panicGain += Math.min(this.fleeingNearby, 5) * 3 / 60 * frameScale; // bozgun yayılır (yalnız tehlike altında; güvende sönsün)
        if (this.suppression > 60) panicGain += 4 / 60 * frameScale;                            // ağır baskı altında
        if (this.leaderNearby) panicGain *= 0.55;  // yakındaki lider askerleri yatıştırır
        if (isLeader) panicGain *= 0.5;            // gaziler kolay kolay paniklemez
        panicGain *= 1 - Math.max(0, Math.min(0.75, this.panicResistance || 0));

        // ── Panik AZALMASI (toparlanma kaynakları) ──
        let panicDecay = 5 * (now - this.lastAttackTime > 3000 ? 2 : 1) / 60 * frameScale;
        if (!this.enemyInVision) panicDecay *= 5;  // düşman yoksa hızla sakinleş
        if (this.leaderNearby) panicDecay *= 1.6;  // lider birliği toparlar
        if (dominant) panicDecay *= 1.5;           // kazandığımızı görmek moral verir

        // SÜRE-BAZLI RALLY: bir süredir kaçan birlik baskı altında OLSA BİLE toparlanır (panik sonsuz sürmez —
        // "düşman kovalarken birim savaşmıyor" sorununun çözümü). Net-decay: panik artık tek-yönlü artmaz.
        const fleeingLong = this.isFleeing && this.fleeSince != null && (now - this.fleeSince) > 4000;
        if (this.lastStandMorale) {
            this.panic -= panicDecay * 2;          // son direniş: korku kalmadı
        } else if (fleeingLong) {
            this.panic -= panicDecay * 5;          // uzun kaçış → ZORUNLU toparlanma → tekrar savaşır
        } else {
            this.panic += panicGain - panicDecay;  // HER ZAMAN net → baskı azalınca panik düşer (bir süre sonra biter)
        }
        this.panic = Math.max(0, Math.min(100, this.panic));

        // Eşikler lider varlığına/rütbeye göre kayar: cesur birlikler daha geç bozulur.
        // AGRESYON: AI (oyuncu-olmayan) birlikler SAVAŞÇI — "çekingen/kaçak" değil; ateş altında dururup savaşırlar.
        // Kullanıcı geri-bildirimi: "AI fazla çekiniyor savaşmaktan". Panik eşiği AI'da yüksek → kolay kolay kaçmaz.
        const aiBrave = this.controlOwner !== 'PLAYER' ? 16 : 0;
        const assaultResolve = ((SIM.tick - (this._pressingAssault || -99)) <= 2) ? 18 : 0;   // TAARRUZ: kapatan birim geri çekilmeye daha dirençli (kararlılık)
        const fleeThreshold = (isLeader ? 90 : (this.leaderNearby ? 84 : 76)) + aiBrave + assaultResolve;
        const rallyThreshold = (this.leaderNearby ? 30 : 35) + (this.controlOwner !== 'PLAYER' ? 8 : 0);   // AI daha çabuk toparlanır

        this.isPanicking = !this.lastStandMorale && this.panic > 50;
        if (!this.lastStandMorale && !this.isFleeing && this.panic > fleeThreshold && this.enemyInVision) {
            this.isFleeing = true;
            this.hasFledOnce = true;
            if (typeof battleRecordLifeEvent === 'function') {   // ANALİST OLAYI: panik/kaçış başlangıcı (geçiş — bir kez)
                battleRecordLifeEvent({ kind: 'PANIC', unitId: this.id, side: this.isRed ? 'red' : 'blue', type: this.type, x: Math.round(this.x * 100) / 100, y: Math.round(this.y * 100) / 100, panic: Math.round(this.panic * 100) / 100, suppression: Math.round((this.suppression || 0) * 100) / 100 });
            }
            this.fleeSince = now;                  // RALLY: kaçış başlangıç zamanı (süre-bazlı toparlanma)
            this.fleeTarget = {
                x: WORLD_W / 2 + (srand() * 400 - 200),
                y: this.isRed ? 200 : WORLD_H - 200
            };
        } else if (this.isFleeing && (this.panic < rallyThreshold || this.lastStandMorale)) {
            this.isFleeing = false;
            this.fleeSince = null;
            this.fleeTarget = null;
        }

        }   // ← insansız-platform kapısının kapanışı (yukarıda açıldı)

        if (this.isFleeing) {
            this.combatState = 'FLEE';
            const safeFlee = typeof terrainSafePoint === 'function'
                ? terrainSafePoint(this.fleeTarget.x, this.fleeTarget.y)
                : this.fleeTarget;
            this.fleeTarget = safeFlee;
            this.targetX = safeFlee.x;
            this.targetY = safeFlee.y;
            this.attackTarget = null;
        } else if (this.combatState === 'FLEE') {
            this.combatState = 'READY';
        }

        if (this.type === T.ENGINEER && this.controlOwner !== 'PLAYER') this.updateEngineerAI(now, dtSec);   // AI istihkam: terk-araç KAP + ileri SİPER/HELİPAD kur (aktif-yetenek → insan-simetrisi)
        if (this.type === T.DRONE_OPERATOR) this.updateOperatorPayload();   // DRONE-OPERATÖR: dost ikmal-alanında drone-bataryası dolar (oyuncu+AI ortak, koşulsuz-mekanik)
        if (this.type === T.DRONE_OPERATOR && this.controlOwner !== 'PLAYER') this.updateOperatorAI(now);   // AI operatör: HVT-görürse drone-sal (gated 'drone'-delta)

        const isConstructing = this.updateTerrainBonuses(now, frameScale);
        this.updateEngineerBonus();

        if (isConstructing) {
            this.attackTarget = null;
            this.targetX = this.x;
            this.targetY = this.y;
            this.x = Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS, this.x));
            this.y = Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS, this.y));
            return;
        }

        this.applyUnitAura(now);   // JENERİK AURA: heal/repair/resupply/komuta-halesi/jamming (STATS.aura'dan; medic dahil)

        // YETENEK: HAREKETSİZ takibi → dig_in siperlenme (gelen hasar azalır) + ambush mevzi-gizlenme (ilk-atış avantajı)
        {
            const _moved = Math.hypot(this.x - (this._lastEx != null ? this._lastEx : this.x), this.y - (this._lastEy != null ? this._lastEy : this.y)) > 2.5;
            this._lastEx = this.x; this._lastEy = this.y;
            if (_moved || this.isFleeing) this._stationaryT = 0; else this._stationaryT += dtSec;
            this.entrench = this._canDigIn ? Math.min(1, this._stationaryT / 8) : 0;   // ~8sn tam siper → gelen hasara -%35 (incomingDamageMult)
        }

        // KOMUTA MENZILI (pro-delta 'commandRange') — veride TANIMLI ama kodda KARSILIGI YOKTU:
        // command_vehicle aura'sinda `range: 0.08` yaziyordu, hicbir yerde okunmuyordu (olu veri).
        // Taban menzil uzerinden uygulanir; birikme yok. Tazelik kurali +%12 hasarla ayni (<=1 tik).
        if (this._baseRange != null) {
            const _haloR = (SIM.tick - (this.commandHaloTick || -999)) <= 1;
            const _mAcik = _haloR && typeof battleProDelta === 'function' && battleProDelta(this.isRed, 'commandRange');
            this.range = _mAcik ? this._baseRange * (1 + PRO_KOMUTA_MENZIL) : this._baseRange;
        }
        if (this.isAir && this.maxFuel > 0) this.updateFuel(now, dtSec);   // YAKIT: uçarken yak, düşük→üsse dön, biter→düş
        if (this.dead) return;                                             // yakıt bitip düştüyse

        if (!this._returningToBase) {   // üsse dönerken savaşmaz/taşımaz — yalnız eve uçar (targetX üsse ayarlı)
            if (this.transportSlots) this.updateTransport(now, dtSec);   // TAŞIMA: nakliye-heli piyade bindir-taşı-indir
            this.engageCombat(now);
            this._samCokluHedef(now, dtSec);          // SAM: aynı anda 2. hava hedefi (kullanıcı isteği)
            this.fireSecondaryWeapons(now, dtSec);   // ÇOKLU-SİLAH: 2. silah (MBT makinelisi anti-piyade / komando yıkım-şarjı) ayrı hedefe ateş eder
            this.attackEnemyBase(now, dtSec);        // YAPI: birim hedefi yoksa menzildeki düşman üssünü döv
            // BECERİ SIRASI: kuru birim zaten ateş edemez → ikmal, standoff'u ezer.
            // BECERİ SIRASI: jammer (silahsız, özel görev) → helo avı → ikmal → standoff.
            // SÖMÜRÜCÜ RAKİP HAVUZU en ÖNDE: dar-betikli bot, kod-AI'ın tüm hareket becerilerini ezer
            // (amacı iyi oynamak değil, ÖLÇÜLMÜŞ bir insan sömürüsünü birebir tekrarlamak).
            // Kapalıyken (varsayılan) tek bir bayrak okuması → eski davranış birebir aynı.
            const _somuru = (typeof exploiterHeloTaciz === 'function') && exploiterHeloTaciz(this);
            if (!_somuru && !this._komutaMerkez() && !this._ikmalRefakat() && !this._havaSemsiye() && !this._jammerSemsiye() && !this._jammerKonuslan() && !this._heloAvlan() && !this._ikmaleGit() && !this._dolayliYaklas() && !this._menzileGir()) this._standoffKac();   // hepsi ateşten SONRA → atışı kesmez, yalnız hareketi ezer
        }

        // NOT (B.1 runtime-ayrışma DENENDİ ve GERİ ALINDI): ölçüm max 15→15 / avg 4.42→4.44 (uzamsal-doygun: 15 birim sınırlı-sektörde
        // zaten ~optimum yayılır) + ayrışma dig_in-siperlenmeyi bozuyordu (net-zararlı). Alan-ateşinin karşılığı = FAZ C balistiği-öldür.

        const _gridMode = (typeof MAP_MODE !== 'undefined' && MAP_MODE === 'grid');
        // Hedef hangi sistemden gelirse gelsin (oyuncu/AI/replay/MP), su veya dağ
        // koordinatı simülasyonda kalamaz. Fizik duvarına çarpıp sonsuza dek
        // yürümeye çalışma burada yapısal olarak engellenir.
        if (_gridMode && !this.isAir && typeof terrainSafePoint === 'function' &&
            !isPassableAt(this.targetX, this.targetY)) {
            const safeTarget = terrainSafePoint(this.targetX, this.targetY);
            this.targetX = safeTarget.x;
            this.targetY = safeTarget.y;
            if (this.manualMoveTarget) {
                this.manualMoveTarget = { x: safeTarget.x, y: safeTarget.y };
            }
        }
        // NEHİR/YOL BULMA: düz hat su/dağla kapalıysa KÖPRÜDEN geçen yolu izle (deterministik A*). HAVA baypas eder (uçar).
        let _steerX = this.targetX, _steerY = this.targetY;
        if (_gridMode && !this.isAir && typeof findPath === 'function') {
            this._navCd = (this._navCd || 0) - frameScale;
            const blocked = pathBlockedBetween(this.x, this.y, this.targetX, this.targetY);
            if (!blocked) {
                this._navPath = null;                                  // düz hat açık → doğrudan git
            } else {
                const goalMoved = (this._navGX === undefined) || Math.hypot(this.targetX - this._navGX, this.targetY - this._navGY) > 140;
                if (goalMoved || !this._navPath || this._navCd <= 0) {
                    this._navPath = findPath(this.x, this.y, this.targetX, this.targetY);
                    // Normalde ilk hücre merkezi atlanır. Fakat birlik hücrenin
                    // kenarındaysa gerçek konumdan ikinci noktaya çizilen parça
                    // su/dağ köşesini kesebilir. Bu durumda önce kendi geçilebilir
                    // hücresinin merkezine gir; aksi hâlde rota var görünürken
                    // fizik adımı her kareyi reddedip birlik sonsuza dek bekler.
                    const _canReachSecond = this._navPath?.length > 1 &&
                        !pathBlockedBetween(
                            this.x,
                            this.y,
                            this._navPath[1].x,
                            this._navPath[1].y
                        );
                    this._navIdx = _canReachSecond ? 1 : 0;
                    this._navGX = this.targetX;
                    this._navGY = this.targetY;
                    this._navCd = 24;
                }
                if (this._navPath && this._navPath.length) {
                    // Köprü rotasındaki ardışık hücreler yaklaşık 23 px aralıklı.
                    // Eski 1.3 hücre toleransı zorunlu dönüş noktasını daha ona
                    // ulaşmadan "tamamlandı" sayıyor ve birliği su sınırına sürüyordu.
                    // 60 px'lik birlik merkezi dar geçitte dost çarpışması varken
                    // 8 px'lik eski toleransa her zaman oturamıyordu. 0.62 hücre,
                    // eski ve güvensiz 1.3 hücrenin hâlâ yarısından azdır; zorunlu
                    // dönüşü atlamadan köşe çevresindeki titreşimi bitirir.
                    const waypointArrivalRadius = Math.min(CELL_W, CELL_H) * 0.62;
                    while (this._navIdx < this._navPath.length - 1 &&
                        Math.hypot(
                            this.x - this._navPath[this._navIdx].x,
                            this.y - this._navPath[this._navIdx].y
                        ) < waypointArrivalRadius) this._navIdx++;
                    const wp = this._navPath[Math.min(this._navIdx, this._navPath.length - 1)];
                    _steerX = wp.x; _steerY = wp.y;
                }
            }
        }

        // HAREKET GÖZETMENİ: Birlik uzaktaki hedefe emirli olduğu hâlde iki
        // ölçüm boyunca yer değiştirmiyorsa kısa, deterministik bir yan-adım
        // uygula ve rota önbelleğini yenile. Stratejik hedef değişmeden kalır.
        const _probeAge = SIM.tick - (this._motionProbeTick || 0);
        if (_probeAge >= 20) {
            const _probeMoved = Math.hypot(
                this.x - this._motionProbeX,
                this.y - this._motionProbeY
            );
            const _probeTargetDistance = Math.hypot(
                this.targetX - this.x,
                this.targetY - this.y
            );
            this._motionStalls = _probeTargetDistance > 120 && _probeMoved < 8 &&
                this.suppression <= PINNED_SUPPRESSION
                ? (this._motionStalls || 0) + 1
                : 0;
            this._motionProbeX = this.x;
            this._motionProbeY = this.y;
            this._motionProbeTick = SIM.tick;
            // TITREME KOK-NEDENI (KULLANICI: "birlik titremeleri cok sinir bozucu... onunde birsey
            // olmamasina ragmen sola veya saga aciliyor"). Sikisma-cozme manevrasi 92px YANA adim attirir
            // ve tarafi HER DENEMEDE degistirir. Yan adim da ilerleme uretmezse yeni deneme gelir, taraf
            // ters doner -> tam gaz sag-sol pinpon. Kendini besleyen dongu.
            // HAVA: ucan birim araziye SIKISAMAZ (dag/su uzerinden ucar) -> bu manevra ona hic uygulanmamali.
            // OLCULDU (tools/titreme-tik.js): dron tam salinimda 13.49px'lik adimlarla ±yon degistiriyordu;
            // katki dagilimi hareket %100 / carpisma %0 -> kaynak bu manevra.
            if (this._motionStalls >= 1 && _gridMode &&
                !(battleUnstickFix() && this.isAir)) {
                const _goalAngle = Math.atan2(
                    this.targetY - this.y,
                    this.targetX - this.x
                );
                /* ── ENGEL VAR MI? (kullanıcı: "ortada hiçbir şey yokken çalışıyor") ──
                   Manevra bugüne dek YALNIZ "ilerleyemiyorum" sinyaline bakıyordu; önünde
                   gerçekten bir şey olup olmadığını hiç sormuyordu. İki gerçek engel türü var:
                   arazi (yol kapalı) ve önümdeki birim. İkisi de yoksa yana adım atmak
                   sebepsiz bir sağa-sola savruluştur. */
                let _engelArazi = false, _engelBirim = false;
                if (typeof pathBlockedBetween === 'function') {
                    _engelArazi = pathBlockedBetween(this.x, this.y, this.targetX, this.targetY);
                }
                {
                    const _ileriX = Math.cos(_goalAngle), _ileriY = Math.sin(_goalAngle);
                    const _bakis = UNIT_RADIUS * 2.6;         // bir birim boyu ileri
                    const _px = this.x + _ileriX * _bakis, _py = this.y + _ileriY * _bakis;
                    for (const o of SIM.spatialGrid.getNearby(_px, _py, _bakis)) {
                        if (o === this || o.dead || o.loaded || o.isAir !== this.isAir) continue;
                        // yalnız İLERİ yarım-düzlemdeki birim engeldir (arkamdaki beni tıkamaz)
                        if ((o.x - this.x) * _ileriX + (o.y - this.y) * _ileriY <= 0) continue;
                        if (Math.hypot(o.x - _px, o.y - _py) <= _bakis) { _engelBirim = true; break; }
                    }
                }
                if (SIM._unstickSayac) {
                    SIM._unstickSayac.tetik++;
                    if (_engelArazi) SIM._unstickSayac.arazi++;
                    if (_engelBirim) SIM._unstickSayac.birim++;
                    if (_engelArazi || _engelBirim) SIM._unstickSayac.engelVar++;
                    else SIM._unstickSayac.engelYok++;
                }
                // ENGEL YOKSA YANA ADIM YOK. Rota önbelleğini tazelemek yeter: birim
                // hedefine DÜZ gitmeye devam eder, 92px'lik sebepsiz savruluş olmaz.
                // (update()'ten `return` EDİLMEZ — o, birimin o tikteki tüm hareket ve
                //  muharebe işleyişini keserdi; yalnız MANEVRA atlanır.)
                const _bosTetik = battleUnstickEngelKontrol() && !_engelArazi && !_engelBirim;
                if (_bosTetik) {
                    this._navPath = null;
                    this._navCd = 0;
                    this._motionStalls = 0;
                    this._unstickPoint = null;
                    if (SIM._unstickSayac) SIM._unstickSayac.iptal = (SIM._unstickSayac.iptal || 0) + 1;
                } else {
                this._unstickAttempts = (this._unstickAttempts || 0) + 1;
                // Aynı taraftaki engel boyunca aynı başarısız yan-adımı
                // tekrarlama; her denemede tarafı deterministik olarak değiştir.
                // ── TARAF YAPIŞKANLIĞI (kullanıcı: kalabalıkta / emir sonrası titreme) ──
                // Tarafı HER denemede ters çevirmek, engelin etrafından dolaşmayı değil SALINIMI üretiyor:
                // sağa 92px → ilerleme yok → sola 92px → ilerleme yok → ... Gerçek engel-aşma tek yönde
                // ISRAR ister (duvar takibi). Bu yüzden taraf EPİZOT boyunca sabit kalır ve ancak 3
                // başarısız denemeden sonra değişir. Epizot, birim gerçekten ilerleyince sıfırlanır (aşağıda).
                if (!this._unstickPoint) this._unstickEpisodeTries = 0;
                this._unstickEpisodeTries = (this._unstickEpisodeTries || 0) + 1;
                const _sideBase = battleUnstickFix()
                    ? (this.id + Math.floor((this._unstickEpisodeTries - 1) / 3))
                    : (this.id + this._unstickAttempts);
                const _side = (_sideBase & 1) ? 1 : -1;
                const _escape = {
                    x: this.x + Math.cos(_goalAngle + _side * Math.PI / 2) * 92,
                    y: this.y + Math.sin(_goalAngle + _side * Math.PI / 2) * 92
                };
                this._unstickPoint = typeof terrainSafePoint === 'function'
                    ? terrainSafePoint(_escape.x, _escape.y, 30)
                    : _escape;
                this._unstickUntilTick = SIM.tick + 24;
                this._navPath = null;
                this._navCd = 0;
                this._motionStalls = 0;
                }   // ← engel-var dalının kapanışı
            }
        }
        if (this._unstickPoint && SIM.tick < this._unstickUntilTick) {
            _steerX = this._unstickPoint.x;
            _steerY = this._unstickPoint.y;
        } else if (this._unstickPoint) {
            this._unstickPoint = null;
            this._navPath = null;
            this._navCd = 0;
        }

        let desiredX = this.targetX - this.x;
        let desiredY = this.targetY - this.y;
        const distToTarget = Math.sqrt(desiredX * desiredX + desiredY * desiredY);
        const movementSpeed = this.speed * frameScale;

        // KULLANICI-FIX (hareket-titremesi "sağa-sola pinpon"): birim varınca DURUR; çarpışma-itmesi onu küçük-oynatınca YENİDEN-HAREKET
        // ETMESİN (arrived→push→re-move→push osilasyonu, çoklu-birim tek-noktaya kümelenince). HİSTEREZİS: holding'de yeniden-hareket
        // eşiği BÜYÜK (2.6×yarıçap) → küçük-itme absorbe; gerçek-yeni-emir (targetX belirgin-kayar → distToTarget büyür) eşiği aşar.
        // VARIŞ TOLERANSI: eski `movementSpeed + 1` HIZA BAĞLI bir ölü bölgeydi — 12 px/tik'lik keşif
        // aracına 13 px'lik emir verilince distToTarget eşiği aşamıyor ve birim HİÇ kımıldamıyordu
        // (ölçüldü: tools/yakin-emir-teshis.js). Tolerans artık hızdan bağımsız sabit; son adım aşağıda
        // kalan mesafeye kırpıldığı için birim hedefin tam üstüne oturur, eşiği tekrar tetiklemez.
        const _arriveTol = battleArriveFix() ? ARRIVE_TOLERANCE_PX : (movementSpeed + 1);
        const _reThreshold = this._holdingPos ? Math.max(_arriveTol, UNIT_RADIUS * 2.6) : _arriveTol;
        if (distToTarget > _reThreshold) {
            this._holdingPos = false;
            const _sdx = _steerX - this.x, _sdy = _steerY - this.y;
            const _sd = Math.hypot(_sdx, _sdy) || 1;
            let moveX = (_sdx / _sd) * movementSpeed;
            let moveY = (_sdy / _sd) * movementSpeed;

            if (!_gridMode) for (const t of terrainFeatures) {
                if (t.type === TERRAIN.MOUNTAIN) {
                    let dx = this.x - t.x;
                    let dy = this.y - t.y;
                    let distToMountain = Math.hypot(dx, dy);
                    if (distToMountain === 0) { dx = 0.1; dy = 0.1; distToMountain = 0.14; }
                    
                    const influenceRadius = t.r + UNIT_RADIUS + 80;
                    
                    if (distToMountain < influenceRadius) {
                        const pushForce = (influenceRadius - distToMountain) / influenceRadius; 
                        moveX += (dx / distToMountain) * movementSpeed * pushForce * 2.0;
                        moveY += (dy / distToMountain) * movementSpeed * pushForce * 2.0;
                        let dot = moveX * dx + moveY * dy;
                        if (dot < 0) {
                            let p1x = -dy / distToMountain; let p1y = dx / distToMountain;
                            let p2x = dy / distToMountain; let p2y = -dx / distToMountain;
                            
                            let dotP1 = p1x * desiredX + p1y * desiredY;
                            let dotP2 = p2x * desiredX + p2y * desiredY;
                            
                            let slideX = dotP1 > dotP2 ? p1x : p2x;
                            let slideY = dotP1 > dotP2 ? p1y : p2y;
                            
                            moveX += slideX * movementSpeed * 1.5;
                            moveY += slideY * movementSpeed * 1.5;
                        }
                    }
                }
            }
            
            const finalDist = Math.hypot(moveX, moveY);
            if (finalDist > 0) {
                // SON KISMİ ADIM: hedefe kalan mesafe bir tam adımdan küçükse adımı KIRP → birim
                // hedefin üstüne oturur (eski hâl: hep tam adım → 12 px'lik kuantum, hedefte 4-8 px
                // sapma + hıza bağlı ölü bölge). Rota (A*) izlenirken kırpma YOK: ara nokta nihai
                // hedeften yakın olabilir, kırparsak konvoy her ara noktada yavaşlar.
                const _onPath = !!(this._navPath && this._navPath.length) || !!this._unstickPoint;
                const _stepLen = (battleArriveFix() && !_onPath)
                    ? Math.min(movementSpeed, distToTarget)
                    : movementSpeed;
                let stepX = (moveX / finalDist) * _stepLen;
                let stepY = (moveY / finalDist) * _stepLen;
                if (_gridMode && !this.isAir && typeof isPassableAt === 'function') {
                    // sert engel: dağ/su (köprü hariç) geçilmez → eksen-bazlı kaydır. HAVA baypas (üstünden uçar).
                    let nx = this.x + stepX, ny = this.y + stepY;
                    if (!isPassableAt(nx, ny)) {
                        if (isPassableAt(this.x + stepX, this.y)) { ny = this.y; }
                        else if (isPassableAt(this.x, this.y + stepY)) { nx = this.x; }
                        else { nx = this.x; ny = this.y; }
                    }
                    this.x = nx; this.y = ny;
                } else {
                    this.x += stepX;
                    this.y += stepY;
                }
                this.facingAngle = Math.atan2(moveY, moveX);
                if (this.type === T.ARMOR && Math.random() < 1 - Math.pow(0.8, frameScale)) {
                    decals.push({ x: this.x, y: this.y, type: 'track', size: 12, angle: this.facingAngle, alpha: 0.3 });
                    if (decals.length > 5000) decals.shift();
                }
            }
        } else {
            this.isMovingToManualTarget = false;
            this._holdingPos = true;   // vardı → holding (küçük-itmelere histerezisle direnir, titreme biter)
        }

        if (this.attackTarget && !this.isFleeing) {
            this.facingAngle = Math.atan2(this.attackTarget.y - this.y, this.attackTarget.x - this.x);
        }
        this._zirhYonlendir();   // INTEL4-PRO 'armorFace': burnu HEDEFE değil BASKIN TEHDİDE dön (hareket+hedef yönünden SONRA)

        this.x = Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS, this.x));
        this.y = Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS, this.y));
    }

    updateTerrainBonuses(now, frameScale = GAME_SPEED) {
        this.inForest = false;
        this.inTrench = false;
        this.inSupply = false;
        if (typeof MAP_MODE !== 'undefined' && MAP_MODE === 'grid') {
            this.inForest = (typeof terrainTypeAt === 'function' && terrainTypeAt(this.x, this.y) === TERRAIN.FOREST);
        } else {
            for (const t of terrainFeatures) {
                if (t.type === TERRAIN.FOREST && Math.hypot(this.x - t.x, this.y - t.y) < t.r) { this.inForest = true; break; }
            }
        }
        this.elevation = (typeof elevationAt === 'function') ? elevationAt(this.x, this.y) : 0.5;   // T2: harita-geneli sürekli yükselti
        this.inHospital = false;
        for (const t of SIM.trenches) {
            if (t.isRed !== this.isRed || Math.hypot(this.x - t.x, this.y - t.y) >= t.r) continue;
            if (t.isHospital) { this.inHospital = true; continue; }   // hastane siper ÖRTÜSÜ saymaz (tesis, mevzi değil)
            this.inTrench = true;
            this.inSupply = t.providesSupply !== false;
            break;
        }
        // SAHRA HASTANESİ: içindeki dost PİYADE iyileşir (sağlıkçı halesiyle aynı hedef kitlesi).
        // Sağlıkçı gezerken hale taşır; hastane SABİT kalır — asıl farkı budur.
        // ÖLÇEK: saniye-başı, `applyUnitAura` ile AYNI (BATTLE_TICK_SEC). Buradaki eski `frameScale`
        // kullanımları (0.18 * frameScale) farklı bir ölçek — hastaneyi ona uydurursak hp/sn tutmaz.
        if (this.inHospital && this.hp < this.maxHp && this.hp > 0 && !this.dead &&
            STATS[this.type] && STATS[this.type].armorType === 'infantry') {
            const _dt = (typeof BATTLE_TICK_SEC !== 'undefined') ? BATTLE_TICK_SEC : 0.05;
            this.hp = Math.min(this.maxHp, this.hp + HASTANE_HEAL_SN * _dt);
        }

        if (this.inSupply && !this.supplyCut && this.ammo < this.maxAmmo) {   // T3 LOJİSTİK: hat kesikse siperde bile ikmal gelmez
            this.supplyProgress += 0.035 * frameScale;
            if (this.supplyProgress >= 1) {
                const rounds = Math.floor(this.supplyProgress);
                this.ammo = Math.min(this.maxAmmo, this.ammo + rounds);
                this.supplyProgress -= rounds;
                if (this.ammo > 0 && this.combatState === 'Cephanesiz') this.combatState = 'READY';
            }
        } else if (!this.inSupply) {
            this.supplyProgress = 0;
        }

        if (this.ammo > 0 && this.combatState === 'Cephanesiz') this.combatState = 'READY';

        if (this.inSupply && isFieldRepairable(this.type) && this.hp < this.maxHp) {
            this.hp = Math.min(this.maxHp, this.hp + 0.18 * frameScale);
        }
        
        // ── SAHRA HASTANESİ (kullanıcı: "sağlık aracı da hastane kursun, sipere göre biraz daha büyük") ──
        // Sağlıkçının HALESİ 300px ve kendisiyle birlikte gezer; hastane ise SABİT bir tesis: kurulduğu yerde
        // kalır, sağlıkçı ölse/gitse de çalışır. Yapı olarak siperle aynı listeye (SIM.trenches) yazılır —
        // böylece replay/fork/hash yolları zaten destekler (yeni koleksiyon = yeni determinizm riski).
        if (this.type === T.MEDIC && this.buildTrenchTarget) {
            const _hs = typeof terrainSafePoint === 'function'
                ? terrainSafePoint(this.buildTrenchTarget.x, this.buildTrenchTarget.y)
                : this.buildTrenchTarget;
            this.buildTrenchTarget = _hs;
            const _hd = Math.hypot(this.x - _hs.x, this.y - _hs.y);
            if (_hd > 10) {
                this.targetX = _hs.x; this.targetY = _hs.y;
                this.manualMoveTarget = { x: _hs.x, y: _hs.y };
                this.isMovingToManualTarget = true;
            } else {
                this.buildTrenchTimer += frameScale / 60;
                if (this.buildTrenchTimer > HASTANE_KURMA_SN) {
                    SIM.trenches.push({
                        x: this.x, y: this.y,
                        r: HASTANE_R,                 // siperden (SIPER_R) belirgin ama abartısız büyük
                        isRed: this.isRed,
                        hp: 260, maxHp: 260,
                        providesSupply: false,        // hastane MÜHİMMAT vermez — yalnız iyileştirir
                        providesAir: false,
                        isHospital: true,
                        healPerSec: HASTANE_HEAL_SN,
                        builderId: this.id,
                        refuelsLeft: null,
                        createdAt: now,
                        expiresAt: now + SUPPLY_FIELD_DURATION_MS
                    });
                    this.buildTrenchTarget = null;
                    this.buildTrenchTimer = 0;
                    this.lastFieldBuiltAt = now;
                }
            }
        }

        /* ── MAYIN ROTASI: istihkâm noktaya GİDER, durur, döşer, sonrakine yürür ──
           Eskiden mayınlar emir anında ışınlanıyordu. Artık her nokta bir görev:
           yürü → MINE_LAY_DIST'e gir → MINE_LAY_TIME kadar dur → mayını bırak → sıradaki.
           Böylece mayın döşemek zaman ve risk maliyeti olan bir iş olur. */
        if (this.mineRoute && this.mineRoute.length) {
            const _p = this.mineRoute[0];
            const _d = Math.hypot(this.x - _p.x, this.y - _p.y);
            if (_d > MINE_LAY_DIST) {
                this.targetX = _p.x;
                this.targetY = _p.y;
                this.manualMoveTarget = { x: _p.x, y: _p.y };
                this.isMovingToManualTarget = true;
                /* GÖREV VARKEN "VARDIM" HİSTEREZİSİ KAPALI. Hareket katmanı, birim bir kez
                   durduğunda yeniden-hareket eşiğini UNIT_RADIUS×2.6'ya (~83px) çıkarır
                   (kümelenmede itiş-osilasyonunu söndürmek için). Mayın rotasında bu ölü
                   kilit üretiyordu: istihkâm hedefe 43px kala duruyor, 34px'lik döşeme
                   mesafesine ASLA giremiyor, rota 12 noktada donuyordu (ölçüldü).
                   Aktif görevi olan birim "duruyor" sayılmaz. */
                this._holdingPos = false;
                /* EMNİYET ZAMAN AŞIMI: arazi süzgeci bir noktayı kaçırırsa ya da yol
                   kapanırsa rota sonsuza dek donmasın — ulaşılamayan nokta atlanır.
                   (Bu kilidi bir kez yaşadık; süzgeç ana çözüm, bu ikinci emniyet.) */
                this._mineWalkT = (this._mineWalkT || 0) + frameScale / 60;
                if (this._mineWalkT > MINE_WALK_TIMEOUT) {
                    this._mineWalkT = 0;
                    this.mineRoute.shift();
                    if (!this.mineRoute.length) { this.mineRoute = null; this.isMovingToManualTarget = false; }
                }
                return false;                       // YÜRÜYOR → inşa değil, normal hareket katmanı işlesin
            }
            this._mineWalkT = 0;
            this.targetX = this.x; this.targetY = this.y;
            this._mineLayTimer = (this._mineLayTimer || 0) + frameScale / 60;
            if (this._mineLayTimer >= MINE_LAY_TIME) {
                this._mineLayTimer = 0;
                SIM.mines.push({
                    x: _p.x, y: _p.y,
                    r: (typeof MINE_TRIGGER_R !== 'undefined' ? MINE_TRIGGER_R : 46),
                    isRed: this.isRed, armed: false, createdAt: now, armDelay: 1500
                });
                if (typeof BATTLE_CREDIT !== 'undefined' && BATTLE_CREDIT.on) battleKredi(this, 'mayin', 1);
                if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) BATTLE_BALANCE.minesLaid++;
                this.mineRoute.shift();
                if (!this.mineRoute.length) { this.mineRoute = null; this.isMovingToManualTarget = false; }
            }
            return true;                            // döşerken duruyor (inşa gibi)
        }

        if (this.type === T.ENGINEER && this.buildTrenchTarget) {
            const safeBuild = typeof terrainSafePoint === 'function'
                ? terrainSafePoint(this.buildTrenchTarget.x, this.buildTrenchTarget.y)
                : this.buildTrenchTarget;
            this.buildTrenchTarget = safeBuild;
            const tx = safeBuild.x;
            const ty = safeBuild.y;
            const dist = Math.hypot(this.x - tx, this.y - ty);
            
            if (dist > 10) {
                // Siper yürüyüşü ortak A* motorunu atlayıp su/dağı düz çizgide
                // deliyordu. Hedefi normal hareket katmanına bırak.
                this.targetX = tx;
                this.targetY = ty;
                this.manualMoveTarget = { x: tx, y: ty };
                this.isMovingToManualTarget = true;
                return false;
            } else {
                const _us = battleIstihkamUs();
                // ÜS SAYI SINIRI: kalıcı yapı sınırsız olursa saha üslerle dolar. Sınıra
                // gelindiyse inşa boşuna sürmesin — emri düşür (istihkâm başka işe döner).
                if (_us && battleUsSayisi(this.isRed) >= US_MAX_TARAF) {
                    this.buildTrenchTarget = null;
                    this.buildTrenchTimer = 0;
                    return true;
                }
                this.buildTrenchTimer += frameScale / 60;
                if (Math.random() < 0.1 && typeof spawnHitSparks !== 'undefined') spawnHitSparks(this.x, this.y);
                if (this.buildTrenchTimer > (_us ? US_INSA_SN : 3.0)) {
                    SIM.trenches.push({
                        x: this.x,
                        y: this.y,
                        r: _us ? US_R : SIPER_R,      // siper 130 → üs 190
                        isRed: this.isRed,
                        hp: _us ? US_HP : 320,
                        maxHp: _us ? US_HP : 320,
                        isBase: _us,                  // çizim/etiket bunu okur ("İLERİ ÜS")
                        providesSupply: true,
                        providesAir: true,            // hava birimi burada yakıt+mühimmat+TAMİR alır
                        builderId: this.id,           // KREDİ: üste tutulan dost-saniyesi ve dolum bu istihkâma yazılır
                        refuelsLeft: null,            // SINIRSIZ dolum (refuelsLeft=null → capLeft=Infinity)
                        createdAt: now,
                        // ÜS KALICIDIR. Eskiden 60sn sonra siliniyordu; oyuncu kurup ordusu
                        // oraya varmadan kayboluyordu. Artık yalnız YIKILARAK yok olur.
                        expiresAt: _us ? 0 : (now + SUPPLY_FIELD_DURATION_MS)
                    });
                    if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) BATTLE_BALANCE.fieldsBuilt = (BATTLE_BALANCE.fieldsBuilt || 0) + 1;
                    this.buildTrenchTarget = null;
                    this.buildTrenchTimer = 0;
                    this.lastFieldBuiltAt = now;
                }
            }
            return true;
        }

        let currentSpeed = this.inForest ? this.baseSpeed * 0.7 : this.baseSpeed;
        if (this.isPanicking && !this.isFleeing) currentSpeed *= 0.7; // 30% slower when panicking but not fleeing yet
        // TAARRUZ: hedefe kapatan birim ateş-altında PINNED olsa bile ilerlemeyi SÜRDÜRÜR (donup farmlanmaz) — pin cezası yarıya iner
        const _pressing = (SIM.tick - (this._pressingAssault || -99)) <= 2;
        if (this.suppression > PINNED_SUPPRESSION) currentSpeed *= _pressing ? 0.42 : 0.12;   // PINNED: yere yatar; taarruzda emekleyerek ilerler
        else if (this.suppression > 50) currentSpeed *= _pressing ? 0.8 : 0.5;                 // ağır baskı
        this.speed = currentSpeed;
        return false;
    }

    updateEngineerBonus() {
        this.armor = this.baseArmor + (this.inForest ? 3 : 0) + (this.inTrench ? 6 : 0);
        const nearby = SIM.spatialGrid.getNearby(this.x, this.y, 180);
        for (const u of nearby) {
            if (u.dead || u.type !== T.ENGINEER || u.isRed !== this.isRed || u === this) continue;
            if (Math.hypot(u.x - this.x, u.y - this.y) <= 180) { this.armor += 2; break; }
        }
        this.armor = capUnitArmor(this.type, this.armor);
    }

    healNearby(now) {
        if (now - this.lastAttackTime < this.atkSpeed) return;
        let lowestHpUnit = null;
        let lowestRatio = 1;
        const nearby = SIM.spatialGrid.getNearby(this.x, this.y, this.range);
        for (const u of nearby) {
            if (u.dead || u.isRed !== this.isRed || u === this || u.hp >= u.maxHp) continue;
            if (!isMedicHealable(u.type)) continue;
            const d = Math.hypot(u.x - this.x, u.y - this.y);
            const ratio = u.hp / u.maxHp;
            if (d <= this.range && ratio < lowestRatio) {
                lowestHpUnit = u; lowestRatio = ratio;
            }
        }
        if (lowestHpUnit) {
            const healAmount = 18;
            const _hpB = lowestHpUnit.hp;
            lowestHpUnit.hp = Math.min(lowestHpUnit.maxHp, lowestHpUnit.hp + healAmount);
            this.lastAttackTime = now;
            if (typeof battleRecordLifeEvent === 'function') {   // ANALİST OLAYI: sağlıkçı iyileştirmesi (kesikli → throttle gereksiz)
                battleRecordLifeEvent({ kind: 'HEAL', unitId: lowestHpUnit.id, side: lowestHpUnit.isRed ? 'red' : 'blue', type: lowestHpUnit.type, sourceId: this.id, x: Math.round(lowestHpUnit.x * 100) / 100, y: Math.round(lowestHpUnit.y * 100) / 100, hp: Math.round(_hpB * 100) / 100, maxHp: Math.round(lowestHpUnit.maxHp * 100) / 100 });
            }
        }
    }

    // DRONE-OPERATÖR ikmal-dolumu: operatör dost ikmal-kaynağı (resupply-aura=ikmal-kamyonu VEYA providesSupply-siper)
    // menzilindeyse drone-bataryası dolar (payloadCount<max, reloadMs'de +1). Koşulsuz-mekanik (oyuncu+AI ortak),
    // RNG-yok, u.fuel'e ASLA dokunmaz, tik-bazlı (BATTLE_TICK_SEC) → determinist. payloadCount+_reloadTimer hash'lenir.
    updateOperatorPayload() {
        const pc = STATS[this.type] && STATS[this.type].payload;
        if (!pc) return;
        const max = pc.count | 0;
        if (this.payloadCount == null) this.payloadCount = max;
        if (this.payloadCount >= max) { this._reloadTimer = 0; return; }
        const TP = (typeof TILE_PX !== 'undefined') ? TILE_PX : 35;
        let inSupply = false;
        for (const u of SIM.units) {   // dost resupply-aura kaynağı (ikmal-kamyonu) menzili
            if (u.dead || u === this || u.isRed !== this.isRed) continue;
            const a = STATS[u.type] && STATS[u.type].aura;
            if (!a || a.type !== 'resupply') continue;
            const rr = (a.radius || 3) * TP;
            const dx = u.x - this.x, dy = u.y - this.y;
            if (dx * dx + dy * dy <= rr * rr) { inSupply = true; break; }
        }
        if (!inSupply && SIM.trenches) {   // dost providesSupply-siper (ikmal-deposu) menzili
            for (const t of SIM.trenches) {
                if (t.isRed !== this.isRed || t.providesSupply === false || t.destroyed) continue;
                const rr = t.r || (t.radius ? t.radius * TP : 3 * TP);
                const dx = t.x - this.x, dy = t.y - this.y;
                if (dx * dx + dy * dy <= rr * rr) { inSupply = true; break; }
            }
        }
        if (!inSupply) { this._reloadTimer = 0; return; }
        const dt = (typeof BATTLE_TICK_SEC !== 'undefined') ? BATTLE_TICK_SEC : 0.05;
        this._reloadTimer = (this._reloadTimer || 0) + dt * 1000;
        if (this._reloadTimer >= pc.reloadMs) {
            this.payloadCount++;
            this._reloadTimer -= pc.reloadMs;
            if (typeof battleRecordLifeEvent === 'function') battleRecordLifeEvent({ kind: 'RELOAD', unitId: this.id, side: this.isRed ? 'red' : 'blue', type: this.type, payload: this.payloadCount, x: Math.round(this.x * 100) / 100, y: Math.round(this.y * 100) / 100 });
        }
    }

    // AI DRONE-OPERATÖR: mühimmatı varsa görüş-alanındaki EN DEĞERLİ düşmanı (radar/destek/topçu = anti_support neşter-rolü)
    // bul → oraya kamikaze-drone SAL, yoksa HOLD (dolum bekle). Gated 'drone'-delta (default-false → dormant, byte-aynı).
    // Piyade-yığınına harcamaz (değer-eşiği). Determinist (dist+id tiebreak, RNG-yok). updateEngineerAI-şablonu.
    updateOperatorAI(now) {
        // gated: 'drone' (jenerik) VEYA 'attack' = MUHARİP-DRONE doktrini (intel4). Saldıran-tarafta → anti-AT (perde-temizle);
        // savunan-tarafta → anti-armor (saldıranın mızrağını vur, _defHold). İkisi de off = davranış-yok = byte-aynı.
        const _droneDoctrine = typeof battleDelta === 'function' && battleDelta(this.isRed, 'attack');
        const _atkDrone = _droneDoctrine &&
            (typeof SIM !== 'undefined' && SIM.battle && (this.isRed === (SIM.battle.attackerSide === true)));   // operatör SALDIRAN-tarafta → AT-perde önceliği
        if (typeof battleDelta === 'function' && !battleDelta(this.isRed, 'drone') && !_droneDoctrine) return;
        const pc = STATS[this.type] && STATS[this.type].payload;
        const have = this.payloadCount != null ? this.payloadCount : (pc ? (pc.count | 0) : 0);
        if (have <= 0) return;   // mühimmat yok → ikmal bekle
        const TP = (typeof TILE_PX !== 'undefined') ? TILE_PX : 35;
        // KULLANICI-FIX ("drone salmıyor"): eski scanR=vision×35=385px ÇOK dardı → HVT'ler (radar/topçu backline'da) hep uzakta →
        // AI hiç salmıyordu. Fırlatma-menzili SERBEST (v1) → GÖRÜLEN (canSee) HVT'ye ~1800px'e dek sal (drone oraya uçar).
        const scanR = 1800;
        // FAZ-SAVUNMA (analist: operatör = savunmanın ANTI-MIZRAK ası): SAVUNAN-operatör dronu erken-taciz için HARCAMAZ,
        // düşman MIZRAĞI (MBT/TD) taahhüt edene dek TUTAR, sonra dalgayı mızrağın üstüne BOCA eder (strike_top ×2.2 → MBT'ye 540-800).
        const _defHold = (typeof SIM !== 'undefined' && SIM.battle && (this.isRed !== (SIM.battle.attackerSide === true)) &&
            (_droneDoctrine || (typeof battleDelta === 'function' && battleDelta(this.isRed, 'defense'))));   // muharip-drone doktrini: savunan dronu DİSİPLİNLİ (mızrak taahhüt edene dek tut, sonra boca) — serbest-fırlatma israfını önle
        // FAZ-SEAD-ADAPTİF (kayıp-atfı-2): saldıran-dronu AA-önce mi AT-önce mi? Sabit-öncelik iki savunma-tipini birden çözemedi
        // (AA-öncelik 909/777-crush ama 3141/2718-kayıp). Hedef-bölgedeki AA-değeri vs AT-değerini tart: AA-ağır→gök-aç(AA-önce),
        // AT-ağır→mızrak-koru(AT-önce). Determinist (değer-tabanlı tarama). Yalnız saldıran-drone (_atkDrone).
        let _aaFirst = false;
        if (_atkDrone) {
            let _aaThreat = 0, _atThreat = 0;
            for (const u of SIM.units) {
                if (u.dead || u.loaded || u.isRed === this.isRed || u.isAir) continue;
                const dx = u.x - this.x, dy = u.y - this.y; if (dx * dx + dy * dy > scanR * scanR) continue;
                const c = (STATS[u.type] && STATS[u.type].cost) || 0;
                if (u.type === T.SAM || u.type === T.MANPADS || u.type === T.SPAAG) _aaThreat += c;
                else if (u.type === T.ANTI_TANK || u.type === T.TANK_HUNTER) _atThreat += c;
            }
            _aaFirst = _aaThreat >= _atThreat && _aaThreat > 0;   // AA-değeri ≥ AT → önce gökyüzünü aç (ölçüm: bu basit-eşik 10/12; 1.25×-eşik 2024'ü bozdu 9/12)
        }
        let best = null, bestKey = -Infinity, bestIsSpear = false;
        for (const u of SIM.units) {
            if (u.dead || u.loaded || u.isRed === this.isRed || u.abandoned || u.isAir) continue;   // kara-warhead → hava vurmaz
            const d = Math.hypot(u.x - this.x, u.y - this.y);
            if (d > scanR) continue;
            if (d > this.vision * TP && typeof canSee === 'function' && !canSee(this.isRed, u.x, u.y, false)) continue;   // öz-görüş dışıysa dost-sensör görmeli
            const su = STATS[u.type] || {};
            const rt = su.roleTags || [];
            const isSpear = (u.type === T.ARMOR || u.type === T.TANK_HUNTER);   // MBT/TD = mızrak
            const isAT = (u.type === T.ANTI_TANK || u.type === T.TANK_HUNTER);   // AT-perde: Tanksavar Timi + Tank Avcısı
            const isAA = (u.type === T.SAM || u.type === T.MANPADS || u.type === T.SPAAG);   // AA-şemsiyesi: drone/hava avcısı
            const isIndirect = rt.includes('indirect_fire') || su.category === 'indirect';   // topçu/havan/ÇNRA (kara-biçen backline)
            let val = 0;   // MIZRAK(6) > radar(4) > destek(3.5) > topçu(3). Gövde/piyade = 0 (drone oraya harcanmaz).
            // FAZ-T2 (kayıp-atfı): SALDIRAN erimesi merkez-AT (Tank Avcısı+Tanksavar) → drone AT-perdesini temizler (val 7 > mızrak 6).
            // FAZ-SEAD (kayıp-atfı-2, FIX-B-sonrası): savunan AA (SAM 14+MANPADS 9/maç) saldıran-DRONLARINI düşürüp doktrini counter'lıyordu →
            // drone önce AA'yı sök (val 8: drone-avcısını kaldır→gök-açar+drone-attrition-durur), sonra AT-perde, sonra topçu (kara-biçen).
            if (_atkDrone && isAA) val = _aaFirst ? 8 : 7;          // adaptif: AA-ağır savunmada AA-önce (8), AT-ağırda AT'nin altında (7)
            else if (_atkDrone && isAT) val = _aaFirst ? 7 : 8;     // adaptif: AT-ağır savunmada AT-önce (8)
            else if (_atkDrone && isIndirect) val = 6;
            else if (isSpear) val = 6;   // pahalı-zırhı avla (strike_top ×2.2 mızrağı söker; savunmada anti-mızrak)
            else if (rt.includes('intel') || rt.includes('air_search')) val = 4;
            else if (su.category === 'support') val = 3.5;
            else if (su.category === 'artillery' || rt.includes('indirect')) val = 3;
            if (val < 3) continue;   // HVT değilse atla (piyade-yığınına dalış YOK)
            const key = val * 100000 - d;   // değer BİRİNCİL, yakınlık ikincil-tiebreak
            if (key > bestKey || (key === bestKey && best && u.id < best.id)) { bestKey = key; best = u; bestIsSpear = isSpear; }
        }
        if (_defHold && !bestIsSpear) return;   // SAVUNAN: mızrak taahhüt etmedi → TUT (support/harassment'a drone harcama)
        if (best) battleLaunchDrones(this, best.x, best.y);   // görülen en-değerli hedefe SAL (savunmada mızrağa boca)
    }

    // JENERİK AURA (veri-güdümlü, units-modern.json STATS.aura): her tik yakın birimlere etki.
    // heal/repair/resupply → doğrudan; command/jamming → tik-damgası (tüketim FAZ 2: accuracy/drone). Radius KARE→×TILE_PX. RNG yok.
    applyUnitAura(now) {
        const aura = STATS[this.type] && STATS[this.type].aura;
        if (!aura) return;
        const TP = (typeof TILE_PX !== 'undefined') ? TILE_PX : 35;
        const r = (aura.radius || 3) * TP, r2 = r * r;
        const dt = (typeof BATTLE_TICK_SEC !== 'undefined') ? BATTLE_TICK_SEC : 0.05;
        const nearby = SIM.spatialGrid.getNearby(this.x, this.y, r);
        if (aura.type === 'heal' || aura.type === 'repair') {
            const applies = aura.appliesTo || [];
            let low = null, lowR = 1.01;
            for (const u of nearby) {
                if (u.dead || u.isRed !== this.isRed || u === this || u.hp >= u.maxHp) continue;
                const at = STATS[u.type] && STATS[u.type].armorType;
                if (applies.length && !applies.includes(at)) continue;
                const dx = u.x - this.x, dy = u.y - this.y; if (dx * dx + dy * dy > r2) continue;
                const ratio = u.hp / u.maxHp; if (ratio < lowR) { low = u; lowR = ratio; }
            }
            if (low) {
                const _hpBefore = low.hp;
                low.hp = Math.min(low.maxHp, low.hp + (aura.hpPerSecond || 6) * dt);
                if (typeof BATTLE_CREDIT !== 'undefined' && BATTLE_CREDIT.on) {
                    battleKredi(this, 'iyilestirme', low.hp - _hpBefore);
                    if (_hpBefore < low.maxHp * 0.2 && low.hp >= low.maxHp * 0.2) battleKredi(this, 'kurtarma', 1);   // olum esiginden cikardi
                }
                // ANALİST OLAYI (throttle ~1s/birim): iyileşme/tamir
                if (typeof battleRecordLifeEvent === 'function' && (SIM.tick - (low._lastHealEvt || -999)) >= 20) {
                    low._lastHealEvt = SIM.tick;
                    battleRecordLifeEvent({ kind: aura.type === 'repair' ? 'REPAIR' : 'HEAL', unitId: low.id, side: low.isRed ? 'red' : 'blue', type: low.type, sourceId: this.id, x: Math.round(low.x * 100) / 100, y: Math.round(low.y * 100) / 100, hp: Math.round(_hpBefore * 100) / 100, maxHp: Math.round(low.maxHp * 100) / 100 });
                }
            }
        } else if (aura.type === 'resupply') {
            const rate = aura.ammoPerSecond || 1;   // MÜHİMMAT-EKONOMİSİ: topçu/ÇNRA ikmalsiz tek-çatışmalık, ikmal doldurur
            for (const u of nearby) {
                if (u.dead || u.isRed !== this.isRed || u === this || !u.maxAmmo || u.ammo >= u.maxAmmo) continue;
                const dx = u.x - this.x, dy = u.y - this.y; if (dx * dx + dy * dy > r2) continue;
                const _aBefore = u.ammo;
                u.ammo = Math.min(u.maxAmmo, u.ammo + rate * dt);
                if (typeof BATTLE_CREDIT !== 'undefined' && BATTLE_CREDIT.on) {
                    battleKredi(this, 'muhimmat', u.ammo - _aBefore);
                    if (_aBefore <= 0 && u.ammo > 0) battleKredi(this, 'kuruEngel', 1);   // KURU birimi tekrar atar hale getirdi
                }
                if (typeof battleRecordLifeEvent === 'function' && (SIM.tick - (u._lastSupplyEvt || -999)) >= 20) {
                    u._lastSupplyEvt = SIM.tick;
                    battleRecordLifeEvent({ kind: 'RESUPPLY', unitId: u.id, side: u.isRed ? 'red' : 'blue', type: u.type, sourceId: this.id, x: Math.round(u.x * 100) / 100, y: Math.round(u.y * 100) / 100, ammo: Math.round(_aBefore * 100) / 100, maxAmmo: Math.round(u.maxAmmo * 100) / 100 });
                }
            }
        } else if (aura.type === 'command') {
            for (const u of nearby) {   // KOMUTA HALESİ: dostları damgala → +%12 vuruş (performAttack) + moral-sağlamlık (baskı/panikten hızlı toparlanma)
                if (u.dead || u.isRed !== this.isRed || u === this) continue;
                const dx = u.x - this.x, dy = u.y - this.y;
                if (dx * dx + dy * dy <= r2) {
                    u.commandHaloTick = SIM.tick;
                    if (typeof BATTLE_CREDIT !== 'undefined' && BATTLE_CREDIT.on) battleKredi(this, 'haleTik', 1);
                    if (u.suppression > 0) u.suppression = Math.max(0, u.suppression - 12 * dt);   // komuta = soğukkanlılık
                    if (u.panic > 0) u.panic = Math.max(0, u.panic - (this._canRally ? 22 : 9) * dt);   // RALLY: komuta-aracı kaçan dostu HIZLA toplar
                    if (this._canRally && u.isFleeing && u.panic < 45) { u.isFleeing = false; u.combatState = 'READY';
                        if (typeof BATTLE_CREDIT !== 'undefined' && BATTLE_CREDIT.on) battleKredi(this, 'rally', 1); }   // RALLY: paniği düşene "dur, savaş"
                }
            }
        } else if (aura.type === 'jamming') {
            for (const u of nearby) {   // JAMMING: yakın DÜŞMAN UAV/drone'u damgala → engageCombat'ta ateş/dalış-iptali (jammable birim)
                if (u.dead || u.isRed === this.isRed) continue;
                const dx = u.x - this.x, dy = u.y - this.y;
                if (dx * dx + dy * dy <= r2) {
                    u.jammedTick = SIM.tick; u.jammedBy = this.id; u.jammedBySide = this.isRed ? 'red' : 'blue';   // JAM-telemetri: kim (id+taraf) jamladı
                    // KISMİ ETKİ: halenin ilan ettiği kontrol-kaybı oranı hedefe taşınır (varsayılan 1 = eski tam-felç).
                    u.jammedLoss = (aura.effects && aura.effects.uavControlLoss != null) ? aura.effects.uavControlLoss : 1;
                    if (typeof BATTLE_CREDIT !== 'undefined' && BATTLE_CREDIT.on) battleKredi(this, 'jamTik', 1);
                }
            }
        }
    }

    // ─── TAŞIMA: nakliye helikopteri piyadeyi BİNDİR → hatta TAŞI → İNDİR (süre-bazlı, deterministik) ───
    // Şimdilik yalnız SİLAHSIZ HAVA taşıyıcı (nakliye-heli) OTO-taşır; ZMA taşıma-verisi var ama savaşçı olduğu için oto-taşımaz.
    _transportAccepts(o) {
        if (!this.transportAllows || !this.transportAllows.includes('infantry')) return false;
        const st = STATS[o.type];
        return !!st && st.armorType === 'infantry';   // yaya birimleri (piyade/tanksavar/havan/manpads/komando/medic/istihkam)
    }
    _ferryUygun(o) {
        // AI-FERRY KABULU - _transportAccepts'ten DAR. KULLANICI RAPORU: "nakliye helolari her seyi
        // tasimaya calisiyor". Genis kural (armorType==='infantry') havan (dolayli, mevzi ister),
        // MANPADS (hava savunmasi, geriyi korur), sihhiyeci ve ISTIHKAM'i da aliyordu. Istihkam
        // helipadi KURAN birimdir; ferry onu cepheye tasiyinca helonun ikmal ussu hic kurulmuyor.
        // OYUNCU emri bu daraltmadan etkilenmez (manuel yol _transportAccepts kullanir).
        if (!this._transportAccepts(o)) return false;
        if (battleFerryFix(this.isRed)) {
            const id = (STATS[o.type] || {}).id;
            return id === 'infantry' || id === 'at_team' || id === 'commando';   // yalniz HAT piyadesi
        }
        return true;
    }
    _transportDropOne() {   // bir yolcuyu araç çevresine bırak (deterministik saçılım)
        const p = this.cargo.shift();
        if (!p) return;
        const ang = srand() * Math.PI * 2, dd = 35 + srand() * 45;
        if (typeof BATTLE_CREDIT !== 'undefined' && BATTLE_CREDIT.on) {
            battleKredi(this, 'tasinan', 1);
            if (p._bindigiY != null) battleKredi(this, 'tasimaMesafe', Math.abs(this.y - p._bindigiY));
        }
        p.loaded = false; p.carrier = null;
        p.x = this.x + Math.cos(ang) * dd; p.y = this.y + Math.sin(ang) * dd;
        p.targetX = p.x; p.targetY = p.y; p.manualMoveTarget = null; p.isMovingToManualTarget = false;
    }
    // OYUNCU-KONTROLLÜ taşıma: yalnız emirle çalışır — bindir-emri (sağ-tık piyade), indir-emri (U tuşu), manuel git.
    _updateTransportManual(now, dtSec) {
        if (this._unloadFlag && this.cargo.length > 0) {   // İNDİR emri: bulunduğun yerde hover + süre-bazlı bırak
            this.targetX = this.x; this.targetY = this.y; this.manualMoveTarget = null; this.isMovingToManualTarget = false;
            this._unloadTimer = (this._unloadTimer == null ? TRANSPORT_UNLOAD_TIME : this._unloadTimer) - dtSec;
            if (this._unloadTimer <= 0) { this._unloadTimer = TRANSPORT_UNLOAD_TIME; this._transportDropOne(); }
            if (this.cargo.length === 0) this._unloadFlag = false;
            return;
        }
        this._unloadFlag = false;
        if (this._loadOrderTargetId) {   // BİNDİR emri: hedefe uç, yaklaşınca süre-bazlı yükle
            const t = (typeof battleUnitById === 'function') ? battleUnitById(this._loadOrderTargetId) : null;
            if (!t || t.dead || t.loaded || this.cargo.length >= this.transportSlots || !this._transportAccepts(t)) {
                this._loadOrderTargetId = null; return;
            }
            const d = Math.hypot(t.x - this.x, t.y - this.y);
            if (d > TRANSPORT_LOAD_RADIUS) {
                this.targetX = t.x; this.targetY = t.y; this.manualMoveTarget = { x: t.x, y: t.y }; this.isMovingToManualTarget = true;
                this._loadTimer = TRANSPORT_LOAD_TIME;
            } else {
                this.targetX = this.x; this.targetY = this.y; this.manualMoveTarget = null; this.isMovingToManualTarget = false;
                this._loadTimer = (this._loadTimer == null ? TRANSPORT_LOAD_TIME : this._loadTimer) - dtSec;
                if (this._loadTimer <= 0) {
                    this._loadTimer = TRANSPORT_LOAD_TIME;
                    t.loaded = true; t.carrier = this; t.attackTarget = null; t.isFleeing = false; t._bindigiY = t.y; this.cargo.push(t);
                    this._loadOrderTargetId = null;   // bir emir = bir yolcu; oyuncu tekrar sağ-tıklar
                }
            }
        }
        // aksi halde: oyuncunun kendi move/attack emri geçerli — targetX'e DOKUNMA (taşıyıcı yolcusuyla gider)
    }
    updateTransport(now, dtSec) {
        const isFerry = this.isAir && (!STATS[this.type].weapons || STATS[this.type].weapons.length === 0);
        // taşınan yolcuları taşıyıcıyla birlikte konumla (her durumda)
        for (const p of this.cargo) { p.x = this.x; p.y = this.y; }

        if (this.controlOwner === 'PLAYER') { this._updateTransportManual(now, dtSec); return; }   // OYUNCU: yalnız emirle
        if (!isFerry) return;   // AI: YALNIZ nakliye-heli OTO-ferry (aşağıda). Kara-araç taşıması YOK (transportSlots zaten 0).

        const deliverY = this.isRed ? WORLD_H * 0.60 : WORLD_H * 0.40;   // dusman hattina dogru orta-ileri (intihar degil)
        const FIX = battleFerryFix(this.isRed);

        // ── FERRY AI - KULLANICI RAPORU + OLCUM (tools/nakliye-teshis.js, 6 tohum) ──
        // Kullanici (oyundan): "nakliye helolari birim tasirken cok titriyordu" ve "her seyi tasimaya
        // calisiyor, surekli bir sey tasimasina gerek yok". Olcum ayni tabloyu verdi: 12 helo omrunun
        // %92'sini YUKLU gecirdi, 10'u yakiti bitip KARGOSUYLA dustu (dusman yalniz 1'ini vurdu) ve
        // helo basina yalniz 2 yolcu tasindi. UC AYRI KUSUR:
        //   (1) KABUL COK GENIS  -> _ferryUygun (yukarida)
        //   (2) TEK YOLCUYLA SEFER: cargo>0 olur olmaz teslime kalkiyordu; 6 slotun 5'i bos gidiyordu.
        //       -> slotlar dolana / yakinda aday kalmayana kadar TOPLA, sonra kalk (_ferryKalkti).
        //   (3) TITREME: aday her tik yeniden seciliyor + esiklerde histerezis yok -> hover<->uc
        //       salinimi. -> aday kilidi (_ferryPickId, %30 mesafe indirimi), hover histerezisi
        //       (_ferryHover ile 1.6x yaricap) ve bosaltma mandali (_ferryBosaltiyor).
        // BOSTA: tasinacak sey yokken sahada dolasmak yakit yakar -> en yakin dost helipada don
        // (ustundeyken ikmal + tamir alir). Yakit-olumlerinin asil caresi budur.

        let cand = null, best = 1e9;
        if (this.cargo.length < this.transportSlots && !(FIX && this._ferryKalkti)) {
            for (const o of SIM.units) {
                if (o.dead || o.loaded || o === this || o.isRed !== this.isRed) continue;
                if (FIX ? !this._ferryUygun(o) : !this._transportAccepts(o)) continue;
                if (o.attackTarget || o.enemyInVision || o.isFleeing) continue;   // savasan/kacan piyadeyi cekme (cepheyi bozma)
                const ownHalf = this.isRed ? (o.y < WORLD_H * 0.5) : (o.y > WORLD_H * 0.5);
                if (!ownHalf) continue;                                          // yalniz geri-bolgedeki takviyeyi tasi
                if (FIX) {
                    // AMAC KAPISI: yolcu cepheye zaten yakinsa yuruyerek gider; tasimanin kazanci yok.
                    if (Math.abs(o.y - deliverY) < WORLD_H * FERRY_MIN_KAZANC) continue;
                    // SEFER BUTUNLUGU: yari-doluyken uzaktaki yolcu icin rotadan sapma.
                    if (this.cargo.length > 0 && Math.hypot(o.x - this.x, o.y - this.y) > FERRY_TOPLA_YARICAP) continue;
                }
                const d = Math.hypot(o.x - this.x, o.y - this.y);
                const dd = (FIX && this._ferryPickId === o.id) ? d * 0.7 : d;   // TITREME-FIX: kilitli adaya oncelik
                if (dd < best) { best = dd; cand = o; }
            }
        }
        if (FIX) this._ferryPickId = cand ? cand.id : null;

        if (cand) {
            const d = Math.hypot(cand.x - this.x, cand.y - this.y);
            const hoverR = (FIX && this._ferryHover) ? TRANSPORT_LOAD_RADIUS * 1.6 : TRANSPORT_LOAD_RADIUS;   // histerezis
            if (d > hoverR) {
                if (FIX) this._ferryHover = false;
                this.targetX = cand.x; this.targetY = cand.y;   // yolcuya uc
                this.manualMoveTarget = { x: cand.x, y: cand.y }; this.isMovingToManualTarget = true;
                this._loadTimer = TRANSPORT_LOAD_TIME;
            } else {
                if (FIX) this._ferryHover = true;
                this.targetX = this.x; this.targetY = this.y; this.manualMoveTarget = null; this.isMovingToManualTarget = false;   // hover
                this._loadTimer = (this._loadTimer == null ? TRANSPORT_LOAD_TIME : this._loadTimer) - dtSec;
                if (this._loadTimer <= 0) {
                    this._loadTimer = TRANSPORT_LOAD_TIME;
                    if (this.cargo.length < this.transportSlots) {
                        cand.loaded = true; cand.carrier = this; cand.attackTarget = null; cand.isFleeing = false;
                        cand._bindigiY = cand.y;   // KREDI: tasimanin kazandirdigi mesafe icin binis noktasi
                        this.cargo.push(cand);
                    }
                }
            }
            return;
        }
        if (FIX) this._ferryHover = false;

        if (this.cargo.length > 0) {
            // ── TESLIM: hatta yaklas, dusman yakininda veya hatta varinca INDIR ──
            if (FIX) this._ferryKalkti = true;   // aday kalmadi -> SEFER BASLADI
            let enemyNear = false;
            const near = SIM.spatialGrid.getNearby(this.x, this.y, TRANSPORT_UNLOAD_TRIGGER);
            for (const o of near) { if (!o.dead && !o.loaded && o.isRed !== this.isRed) { enemyNear = true; break; } }
            const atFront = this.isRed ? (this.y >= deliverY) : (this.y <= deliverY);
            if (enemyNear || atFront || (FIX && this._ferryBosaltiyor)) {
                if (FIX) this._ferryBosaltiyor = true;   // TITREME-FIX: bosaltma basladiysa bitene kadar surer
                this.targetX = this.x; this.targetY = this.y; this.manualMoveTarget = null; this.isMovingToManualTarget = false;
                this._unloadTimer = (this._unloadTimer == null ? TRANSPORT_UNLOAD_TIME : this._unloadTimer) - dtSec;
                if (this._unloadTimer <= 0) { this._unloadTimer = TRANSPORT_UNLOAD_TIME; this._transportDropOne(); }
            } else if (FIX) {
                // SABIT TESLIM NOKTASI. DURUSTLUK NOTU: bunu once "titremenin kok nedeni" sanip
                // ekledim ve OLCUM beni YALANLADI (UCUS-teslim ters-donus %82 -> %90, yani KOTULESTI).
                // Gercek kok-neden ayirma fizigiydi (asagida, ~satir 2766: `loaded` yolcu elenmiyordu).
                // Kilit yine de duruyor cunku: (a) sefer basinda id-turevli yanal ayrim veriyor, iki
                // helo ayni noktaya yiginlanmiyor, (b) hedef her tik yeniden yazilmadigi icin satir
                // 492'deki varis histerezisi calisabiliyor. Katkisi OLCULMEDI, notr kabul edilmeli.
                if (this._ferryTeslimX == null) {
                    const _ofs = ((this.id % 3) - 1) * 140;   // determinist yanal ayrim (helolar ust uste binmesin)
                    this._ferryTeslimX = Math.max(60, Math.min(WORLD_W - 60, this.x + _ofs));
                    this._ferryTeslimY = deliverY;
                }
                this.targetX = this._ferryTeslimX; this.targetY = this._ferryTeslimY;
                this.manualMoveTarget = { x: this._ferryTeslimX, y: this._ferryTeslimY }; this.isMovingToManualTarget = true;
            } else {
                this.targetX = this.x; this.targetY = deliverY;   // hatta dogru uc
                this.manualMoveTarget = { x: this.x, y: deliverY }; this.isMovingToManualTarget = true;
            }
            return;
        }

        if (FIX) {
            this._ferryKalkti = false; this._ferryBosaltiyor = false;   // sefer bitti
            this._ferryTeslimX = null; this._ferryTeslimY = null;   // teslim-noktasi kilidi birakilir
            // BOSTA -> en yakin dost helipada don (ikmal+tamir). Us yoksa oldugun yerde bekle.
            let ux = null, uy = null, ud = Infinity;
            for (const t of SIM.trenches) {
                if (t.isRed !== this.isRed || t.providesSupply === false || !t.providesAir) continue;
                const d = Math.hypot(this.x - t.x, this.y - t.y);
                if (d < ud) { ud = d; ux = t.x; uy = t.y; }
            }
            if (ux != null && ud > 40) { this.targetX = ux; this.targetY = uy; this.manualMoveTarget = { x: ux, y: uy }; this.isMovingToManualTarget = true; }
            else { this.targetX = this.x; this.targetY = this.y; this.manualMoveTarget = null; this.isMovingToManualTarget = false; }
        }
        this._loadTimer = TRANSPORT_LOAD_TIME;
    }

    // ── YAKIT/SORTİ (hava birimleri): uçarken yak → %30 altı üsse dön → üste ikmal → biter DÜŞER (kamikaze tek-yön hariç) ──
    /* ELE GEÇİRME TEHLİKE KAPISI — kullanıcının sahada gördüğü kusur.
       İstihkâm, terk edilmiş aracın üstüne düşman ateşi altında yürüyüp ölüyordu:
       kapma bloğu koşulsuz önceliktı ve aşağıdaki `closeThreat` kontrolüne hiç
       ulaşmıyordu. Burada İKİ nokta da sınanır — hedefin çevresi VE kendi çevresi;
       yalnız hedefe bakmak, yol boyunca pusuya yürümeyi engellemezdi.
       Yalnız GERÇEK tehdit sayılır: teslim olmuş/ölü/yüklü birim tehdit değildir,
       hava birimi de istihkâmı kovalamaz. */
    _kapmaTehlikeli(hedef) {
        if (typeof BATTLE_KAPMA_TEHLIKE !== 'undefined' && !BATTLE_KAPMA_TEHLIKE) return false;
        const tehditVar = (x, y, r) => {
            const yakin = SIM.spatialGrid.getNearby(x, y, r);
            for (const o of yakin) {
                if (o.dead || o.abandoned || o.loaded || o.isAir) continue;
                if (o.isRed === this.isRed) continue;
                if (Math.hypot(o.x - x, o.y - y) > r) continue;   // ızgara kutusu yarıçaptan geniş
                return true;
            }
            return false;
        };
        return tehditVar(hedef.x, hedef.y, KAPMA_TEHLIKE_R) ||
               tehditVar(this.x, this.y, KAPMA_KENDI_R);
    }

    // AI İSTİHKAM: aktif-yetenekleri kullan (insan-simetrisi) — (1) terk-edilmiş aracı ele geçir, (2) ileri siper/helipad kur.
    updateEngineerAI(now, dtSec) {
        if (this.buildTrenchTarget) return;   // zaten inşa ediyor
        // ÜS SINIRI DOLDUYSA inşa kararı hiç alınmasın (istihkâm kapma/tamir/mayına dönsün).
        const _usDolu = battleIstihkamUs() && battleUsSayisi(this.isRed) >= US_MAX_TARAF;
        // DURUŞ-BAĞI (analist): CONSOLIDATE (kazandık+lull) → kapma/tamir penceresi AÇIK; sahayı kontrol ettiğimiz için geometri gevşer.
        let _stance = null, _winning = false;
        {   // DETERMİNİZM: duruş SİM-durumundan (canlı kontrolör nesnesi replay'de YOK → sapma kaynağıydı)
            const _p = (SIM.ctrlPosture && this.controllerId) ? SIM.ctrlPosture[this.controllerId] : null;
            if (_p) { _stance = _p.stance; _winning = !!_p.win; }
        }
        const _consolidate = _stance === 'CONSOLIDATE';
        // (1) ELE GEÇİR (ÖNCELİK): terk-edilmiş araç (nötr, dost VEYA düşman-enkazı) → üstüne git; yanına varınca capture-logic onarıp taraf yapar
        let cap = null, capD = 1e9;
        for (const o of SIM.units) {
            if (o.dead || !o.abandoned) continue;
            // Geometri: normalde yalnız çok-derin düşman bölgesini atla; KAZANIRKEN/CONSOLIDATE'te sahayı tuttuğumuz için derine de git.
            const notDeep = (_consolidate || _winning) ? true : (this.isRed ? (o.y < WORLD_H * 0.70) : (o.y > WORLD_H * 0.30));
            if (!notDeep) continue;
            const d = Math.hypot(o.x - this.x, o.y - this.y);
            if (!(d < 1300 && d < capD)) continue;   // geniş yarıçap: enkaz değerli, uzaktan bile gidip kap
            if (this._kapmaTehlikeli(o)) continue;   // ama ölümüne değil (bkz. BATTLE_KAPMA_TEHLIKE)
            capD = d; cap = o;
        }
        if (cap) {
            if (capD > 70) { this.targetX = cap.x; this.targetY = cap.y; this.manualMoveTarget = { x: cap.x, y: cap.y }; this.isMovingToManualTarget = true; }
            else { this.targetX = this.x; this.targetY = this.y; this.manualMoveTarget = null; this.isMovingToManualTarget = false; }
            return;
        }
        // (1b) CONSOLIDATE TAMİR (analist): lull'da AĞIR-HASARLI dost aracı bul → yanına git (tamir-aurası oraya gelsin, doruk-noktasında kuvvet-yenile)
        if (_consolidate) {
            let rep = null, repD = 1e9;
            for (const o of SIM.units) {
                if (o.dead || o.abandoned || o.isRed !== this.isRed || o === this) continue;
                if (!(o.armorType === 'heavy' || o.armorType === 'light') || o.hp >= o.maxHp * 0.45) continue;   // yalnız ağır-hasarlı zırhlı
                const d = Math.hypot(o.x - this.x, o.y - this.y);
                if (d < 700 && d < repD) { repD = d; rep = o; }
            }
            if (rep && repD > 60) { this.targetX = rep.x; this.targetY = rep.y; this.manualMoveTarget = { x: rep.x, y: rep.y }; this.isMovingToManualTarget = true; return; }
        }
        // ILERI US (pro-delta 'engineerForward') — KULLANICI SORUSU: "helolar yakitsizliktan dusuyorsa
        // istihkam neden siper kazmiyor". OLCULDU (tools/istihkam-teshis.js, 3 tohum): helipad kapsamasi
        // macin yalnizca %40'i; istihkam tiklerinin %38.6'si "KENDI-YARISINDA-DEGIL" halinde geciyor ve
        // o halde HICBIR SEY kurmuyor. Saldiran orduda istihkam orduyla birlikte orta hatti geciyor ->
        // tam da helonun ikmale ihtiyac duydugu bolgede us kurmayi reddediyor. Guvenligi zaten 360px'lik
        // YAKIN-TEHDIT kapisi sagliyor; yari-saha cizgisi ayrica gerekli degil. Taraf-basi delta.
        const _ileriUs = (typeof battleProDelta === 'function') && battleProDelta(this.isRed, 'engineerForward');
        const _yariSinir = _ileriUs ? PRO_IST_ILERI_DERINLIK : 0.55;
        const inOwnHalf = this.isRed ? (this.y < WORLD_H * _yariSinir) : (this.y > WORLD_H * (1 - _yariSinir));
        let closeThreat = false;   // yakın-tehdit yoksa çalış (uzaktan görmek engel değil)
        const _cn = SIM.spatialGrid.getNearby(this.x, this.y, 360);
        for (const o of _cn) { if (!o.dead && !o.abandoned && o.isRed !== this.isRed) { closeThreat = true; break; } }
        if (!inOwnHalf || closeThreat || this.isFleeing || (this.suppression || 0) >= 25) return;
        // HAZIRLANMIŞ MEVZİ (2/2) — PRO 'holdZone': SAVUNAN istihkâmı siperi bulunduğu yere değil
        // ANA DİRENİŞ HATTINA, cephe boyunca ARALIKLI diker. Siper her birime +6 zırh + 0.30 örtü verir
        // (r=105) — yer tutmanın gerçek karşılığı budur; ölçümde savunanın yalnız %0-30'u siperlenebiliyordu.
        // İkmal mantığı (520px'te alan yoksa kur) savunma hattını değil lojistiği optimize ediyordu.
        {
            const _p2 = (SIM.ctrlPosture && this.controllerId) ? SIM.ctrlPosture[this.controllerId] : null;
            const _rolDef = _p2 && _p2.role === 'defender';
            if (PRO_HOLD_ENGINEER_LINE && _rolDef && typeof battleProDelta === 'function' && battleProDelta(this.isRed, 'holdZone') &&
                typeof proDepthToY === 'function') {
                const hatY = proDepthToY(this.isRed, PRO_HOLD_TRENCH_DEPTH);   // ana hattın GERİSİ (temas dışı, r=105 yine kapsar)
                let zincirVar = false;   // hattımda yakınımda zaten siper var mı? (yoksa zincirin bir halkasını ben dikerim)
                for (const t of SIM.trenches) {
                    if (t.isRed !== this.isRed) continue;
                    if (Math.hypot(t.x - this.x, t.y - hatY) < PRO_HOLD_TRENCH_GAP) { zincirVar = true; break; }
                }
                if (!zincirVar && !_usDolu) {
                    if (Math.abs(this.y - hatY) > 70) {   // önce hatta in
                        this.targetX = this.x; this.targetY = hatY;
                        this.manualMoveTarget = { x: this.x, y: hatY }; this.isMovingToManualTarget = true;
                        return;
                    }
                    this.buildTrenchTarget = { x: this.x, y: hatY };
                    return;
                }
            }
        }
        // (2) İLERİ SİPER/HELİPAD: yakında dost supply-field YOKSA → kur (kara-ikmal + helo yakıt)
        let hasField = false;
        for (const t of SIM.trenches) { if (t.isRed === this.isRed && t.providesSupply !== false && Math.hypot(t.x - this.x, t.y - this.y) < 520) { hasField = true; break; } }
        if (!hasField && !_usDolu) { this.buildTrenchTarget = { x: this.x, y: this.y }; return; }
        // (3) MAYIN: field kurulu → ileri-hatta mayın döşe (yakında dost mayın yoksa, ~her 3sn)
        const fwd = this.isRed ? (this.y > WORLD_H * 0.28) : (this.y < WORLD_H * 0.72);   // orta-ileri bölge (savunma hattı)
        if (!fwd) return;
        for (const m of SIM.mines) { if (m.isRed === this.isRed && Math.hypot(m.x - this.x, m.y - this.y) < 130) return; }   // yakında mayın var
        this._mineTimer = (this._mineTimer || 0) - dtSec;
        if (this._mineTimer <= 0) {
            this._mineTimer = 3.0;
            SIM.mines.push({ x: this.x, y: this.y, r: MINE_TRIGGER_R, isRed: this.isRed, armed: false, createdAt: now, armDelay: 1500 });
            if (typeof BATTLE_CREDIT !== 'undefined' && BATTLE_CREDIT.on) battleKredi(this, 'mayin', 1);
            if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) BATTLE_BALANCE.minesLaid++;
        }
    }

    updateFuel(now, dtSec) {
        const oneWay = STATS[this.type] && STATS[this.type].singleUse;   // kamikaze impact'e gider, dönmez
        const busyTransport = this.transportSlots > 0 && this.cargo && this.cargo.length > 0;   // yüklü taşıma önce teslim eder
        // HELO-ÜSSÜ (kullanıcı-redesign): KENAR-BEDAVA-DOLUM KALDIRILDI. Helo YALNIZ inşa-edilmiş dost üste (providesAir)
        // ve o üssün DOLUM-HAKKI (refuelsLeft) kaldığında yakıt alır. Her dock 1 hak tüketir → üs 2-kez doldurur, sonra kesilir.
        let overBase = null, overKey = null, overMine = false;   // şu an üzerinde olduğumuz kullanılabilir üs
        let baseX = null, baseY = null, baseD = Infinity;         // dönüş-hedefi: kapasitesi-kalan en-yakın üs
        for (const t of SIM.trenches) {
            if (t.isRed !== this.isRed || t.providesSupply === false || !t.providesAir) continue;
            const capLeft = (t.refuelsLeft == null) ? Infinity : t.refuelsLeft;
            const key = t.x + '|' + t.y;   // üs-kimliği (statik konum → determinist+serialize-edilebilir; trench-id gerektirmez)
            const mineReserved = (this._refuelBaseKey === key);
            const usable = capLeft > 0 || mineReserved;
            const d = Math.hypot(this.x - t.x, this.y - t.y);
            if (usable && d < baseD) { baseD = d; baseX = t.x; baseY = t.y; }
            if (usable && d < t.r && !overBase) { overBase = t; overKey = key; overMine = mineReserved; }
        }

        if (!oneWay && overBase && this.fuel < this.maxFuel) {   // ÜSTE İKMAL (~18sn tam dolum). KULLANICI-FIX: KAMİKAZE(oneWay) İKMAL ALMAZ (tek-yön) → dost-üs üstünden geçince dolup hiç-düşmeme + üs-hakkı-yeme bug'ı çözülür
            if (!overMine) {   // YENİ rezervasyon → 1 dolum-hakkı tüket (dock başına tek-hak)
                if (overBase.refuelsLeft != null) overBase.refuelsLeft--;
                if (typeof BATTLE_CREDIT !== 'undefined' && BATTLE_CREDIT.on && overBase.builderId != null) {
                    const _b = SIM.units.find(z => z.id === overBase.builderId);   // KREDİ: dolumu üssü KURAN alır
                    if (_b) battleKredi(_b, 'yakitDolum', 1);
                }
                this._refuelBaseKey = overKey;
                if (typeof battleRecordLifeEvent === 'function') battleRecordLifeEvent({ kind: 'REFUEL_DOCK', unitId: this.id, side: this.isRed ? 'red' : 'blue', type: this.type, refuelsLeft: overBase.refuelsLeft == null ? -1 : overBase.refuelsLeft, x: Math.round(this.x * 100) / 100, y: Math.round(this.y * 100) / 100 });
            }
            this.fuel = Math.min(this.maxFuel, this.fuel + (this.maxFuel / 18) * dtSec);
            if (this.maxHp > 0 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + (this.maxHp / 22) * dtSec);   // KULLANICI-FIX: üste TAMİR de (~22sn tam-onarım)
            if (this.fuel >= this.maxFuel * 0.9) this._returningToBase = false;   // doldu → göreve dön
            if (this.fuel >= this.maxFuel) this._refuelBaseKey = null;            // tam-doldu → rezervasyon biter (sonraki dock = yeni hak)
            return;
        }
        if (this._refuelBaseKey != null && !overBase) this._refuelBaseKey = null;   // üsten ayrıldı → rezervasyonu bırak

        this.fuel -= this.fuelBurn * dtSec;   // uçarken yakıt yanar
        if (this.fuel <= 0) {
            // KULLANICI-FIX: "üssüz de olsa DONMAMALI". Onurlu-emeklilik (donma) KALDIRILDI → yakıt bitince DÜŞER (helo+drone),
            // üs-var/yok fark etmez. Üs varsa zaten aşağıdaki RTB oraya götürür + ikmal eder (donma yok).
            this.fuel = 0; this.hp = 0; this.dead = true; return;
        }
        // ── KRİTİK YAKIT TABANI (BATTLE_HELO_KRITIK_YAKIT) ──
        // ÖLÇÜLDÜ (tools/nakliye-teshis.js, 6 tohum): nakliye helosu 6 slotuyla GERÇEKTEN taşıyor
        // (24 piyade yükledi, ömrünün %92'sini yüklü geçirdi) ama 12 helonun 10'u YAKITI BİTİP DÜŞTÜ
        // ve kargosundaki 10 piyadeyi de öldürdü. Düşman yalnız 1 tanesini vurdu.
        // KÖK NEDEN: aşağıdaki `!busyTransport` koşulu "önce teslim et" demek için konmuş — niyet
        // doğru ama TABANI YOK. Teslim noktası hiç bulunmazsa helo yakıtı bitene kadar uçuyor.
        // ÇÖZÜM: yakıt kritik eşiğin altına inince kargo şartı DÜŞER; üs varsa dönülür.
        // Kargoyla birlikte düşmektense kargoyu geri götürmek her hâlükârda daha iyidir.
        const kritikYakit = this.fuel <= this.maxFuel * battleHeloKritikYakit(this.isRed);
        if (!oneWay && (!busyTransport || kritikYakit) && baseX != null && this.fuel <= this.maxFuel * 0.30 && !this._returningToBase) {   // düşük + ÜS-VAR → dön. KULLANICI-FIX: üs-YOKSA RTB-etme (kenara-gidip-donma yok) → emir almaya devam et, yakıt bitince düşer
            this._returningToBase = true;
            if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) BATTLE_BALANCE.heloSorties++;
            if (typeof battleRecordLifeEvent === 'function') battleRecordLifeEvent({ kind: 'RTB', unitId: this.id, side: this.isRed ? 'red' : 'blue', type: this.type, fuel: Math.round((this.fuel || 0) * 100) / 100, maxFuel: Math.round((this.maxFuel || 0) * 100) / 100, x: Math.round(this.x * 100) / 100, y: Math.round(this.y * 100) / 100 });
        }
        if (this._returningToBase) {
            // KULLANICI-FIX: üs VARSA ona git (tek ikmal-noktası). Üs YOKSA (hiç yok / RTB sırasında yıkıldı) → RTB-İPTAL, emir almaya
            // devam et (kenara-gidip-donma YOK). Üssüz helo görevine devam eder, yakıtı biterse düşer.
            if (baseX == null) { this._returningToBase = false; }
            else {
                this.attackTarget = null; this.manualTarget = null;
                this.targetX = baseX; this.targetY = baseY;
                this.manualMoveTarget = { x: baseX, y: baseY }; this.isMovingToManualTarget = true;
            }
        }
    }

    engageCombat(now) {
        // SİLAHSIZ birimler savaşmaz (sağlıkçı/istihkam*/ikmal/HQ/EH/radar/nakliye-heli/keşif-İHA). *istihkamın hafif silahı var.
        const __w = STATS[this.type] && STATS[this.type].weapons;
        // ÖLÇÜLDÜ (tools/jam-teshis.js): Keşif İHA baloncukta 75 tik geçirip HİÇ karıştırılmadı.
        // Sebep: recon_uav'ın silahı YOK ("weapons": []) → bu erken dönüş jam bloğundan ÖNCE çalışıyor,
        // yani EH aracının en doğal hedefi (düşman gözünü kör etmek) hiç karıştırılmıyor. Ölü tasarım.
        // Düzeltme HAZIR ama VARSAYILAN KAPALI: açmak jammer'ı GÜÇLENDİRİR ve kullanıcı raporu
        // ("jammer dronlara karşı fazla güçlü") ters yönde — denge kararı kullanıcınındır.
        if (!__w || !__w.length) {
            if (!(typeof BATTLE_JAM_RECON !== 'undefined' && BATTLE_JAM_RECON) || !this.jammable) return;
        }
        // JAMMING (kullanıcı: "jammer↔drone counter'ını devreye sok"): EH-aracının jamming-alanındaki jammable UAV/drone
        // KONTROL-BAĞINI kaybeder → ateş/dalış YAPAMAZ (bu ve geçen tik damgalıysa). Kamikaze alan içinde dalamaz → hedefe
        // ulaşamadan yakıtı biter/düşer → EH = drone-red bölgesi. Determinist (RNG-yok, sadece tik-damgası). Artık this.jammable yüklü.
        // ── KISMİ KARIŞTIRMA (BATTLE_JAM_PARTIAL) ──
        // ÖLÇÜLDÜ ve KOD-VERİ UYUŞMAZLIĞI bulundu: UnitData'nın jamming halesi `uavControlLoss: 0.75`,
        // birim başına duyarlılık ise `jammable` 0.8-1.0 diyor. Kod ikisini de YOK SAYIYORDU —
        // `if (this.jammable && ...)` yalnız TRUTHY bakıyor → baloncuğa giren dron %100 felç.
        // Kullanıcı gözlemi ("jammer dronlara karşı fazla güçlü") bu YEREL mutlaklıktan geliyor.
        // (Küresel tablo tersi: yarıçap 400px = haritanın %2.9'u ve konumlandırma becerisi yok →
        //  ölçümde 2 jammer alan savunan, dron-ağırlıklı saldırgana karşı 2044 marj KAYBEDİYOR.
        //  Bunlar çelişmiyor: etki kademeli-geniş tasarlanmış, ikili-dar kodlanmış.)
        // ÇÖZÜM: RNG'siz görev-döngüsü. Her tik `guc` kadar birikir; 1'i aşınca O TİK karıştırılır.
        // Uzun vadede karıştırılan tik oranı tam olarak `guc` olur → determinist ve veriye sadık.
        let _jamAktif = false;
        if (this.jammable && typeof SIM !== 'undefined' && (SIM.tick - (this.jammedTick || -99)) <= 1) {
            const _kismi = (typeof BATTLE_JAM_PARTIAL === 'undefined' || BATTLE_JAM_PARTIAL);
            const _guc = _kismi ? Math.max(0, Math.min(1, (this.jammedLoss != null ? this.jammedLoss : 1) * this.jammable)) : 1;
            this._jamAcc = (this._jamAcc || 0) + _guc;
            if (this._jamAcc >= 1) { this._jamAcc -= 1; _jamAktif = true; }
        } else {
            this._jamAcc = 0;   // hale dışına çıktı → birikim sıfırlanır
        }
        if (_jamAktif) {
            this.combatState = 'Karıştırıldı';
            this._jamTik = (this._jamTik || 0) + 1;   // KARIŞTIRILAN tik sayacı (kamikaze boş-patlaması bunu sayar, duvar saatini değil)
            // JAM-TELEMETRİ (analist: INTERCEPT'in kardeşi — kim/kimi/kaç-sn/kaç-atış). jam-periyodu takibi:
            if (this._jamLastTick == null || (SIM.tick - this._jamLastTick) > 2) { this._jamStartTick = SIM.tick; this._jamBlocked = 0; }   // yeni jam-periyodu başladı
            this._jamLastTick = SIM.tick; this._jamBlocked = (this._jamBlocked || 0) + 1;   // engellenen angajman-fırsatı (tik)
            if (typeof battleRecordLifeEvent === 'function' && (SIM.tick - (this._lastJamEvt || -999)) >= 20) {   // ~1s throttle
                this._lastJamEvt = SIM.tick;
                const _ts = (typeof BATTLE_TICK_SEC !== 'undefined') ? BATTLE_TICK_SEC : 0.05;
                battleRecordLifeEvent({ kind: 'JAMMED', unitId: this.id, side: this.isRed ? 'red' : 'blue', type: this.type,
                    jammerId: this.jammedBy != null ? this.jammedBy : null, jammerSide: this.jammedBySide || null,   // ANALİST: kim/kimi (jammer-taraf + jamlanan-taraf) → drone↔jammer atfı netleşir
                    durationSec: Math.round((SIM.tick - (this._jamStartTick || SIM.tick)) * _ts * 100) / 100,
                    blockedShots: this._jamBlocked, x: Math.round(this.x * 100) / 100, y: Math.round(this.y * 100) / 100 });
            }
            // JAMMER↔DRONE (kullanıcı-spec): karıştırılan drone YÖNÜ SAPITILIP donar (kontrol-bağı kopar); tek-kullanımlık (kamikaze)
            // 5sn sürekli-jam'de BOŞ-NOKTADA infilak eder. Kontrol-dışı sayacını (_ctrlLostTick) paylaşır → jam+menzil-dışı birikir.
            this.targetX = this.x; this.targetY = this.y; this.isMovingToManualTarget = false;   // donuk (yön sapıtıldı)
            if (STATS[this.type] && STATS[this.type].singleUse) {
                if (!this._ctrlLostTick) this._ctrlLostTick = SIM.tick;
                // KISMİ KARIŞTIRMA: boş-patlama artık DUVAR SAATİNİ değil KARIŞTIRILAN TİKLERİ sayar.
                // Aksi hâlde %60 güçle karıştırılan dron da tam-felç gibi 5sn'de patlardı (kısmilik anlamsızlaşır).
                const _sayac = (typeof BATTLE_JAM_PARTIAL === 'undefined' || BATTLE_JAM_PARTIAL)
                    ? (this._jamTik || 0) : (SIM.tick - this._ctrlLostTick);
                if (_sayac >= 100) {   // 100 karıştırılmış tik (tam güçte = 5sn) → BOŞ-PATLA
                    if (typeof battleRecordLifeEvent === 'function') battleRecordLifeEvent({ kind: 'DRONE_LOST', unitId: this.id, side: this.isRed ? 'red' : 'blue', type: this.type, reason: 'jam-bos', jammerId: this.jammedBy != null ? this.jammedBy : null, x: Math.round(this.x * 100) / 100, y: Math.round(this.y * 100) / 100 });
                    this.hp = 0; this.dead = true; this.lastAttackTime = now; if (typeof spawnExplosion !== 'undefined') spawnExplosion(this.x, this.y, 1.6);
                }
            }
            return;
        }
        if (!__w || !__w.length) return;   // silahsız birim (keşif İHA): jam değerlendirildi, savaş mantığı yok

        // KAMİKAZE FIRE-AND-FORGET (kullanıcı: "dalıyor ama çarptığı yerde patlamıyor"): singleUse drone controlOwner/oyuncu-vision/
        // manualTarget'a BAĞLI OLMADAN en-yakın CANLI düşmana kararlı dalar. Eski playerControlled-yolu canSee-dip'inde manualTarget'ı
        // nullluyor → drone hedefi kaybedip bayat-noktaya uçuyor, hiç patlamıyordu. Bu blok hem oyuncu hem AI için tek-tip güvenilir dalış.
        if (STATS[this.type] && STATS[this.type].singleUse) {
            // ── OPERATÖR KONTROL-BÖLGESİ (900px, kullanıcı-spec) ──
            // Drone operatöre ≤900px iken KONTROLLÜ (oyuncu+AI: avlanır, hareket eder, hedefe kilitlenir). >900px (veya operatör ölü) →
            // KONTROL-KAYBI: en-yakın hedefi seç+dal; hedef yoksa 5sn SABİT bekle → patla. 5sn içinde operatör 900px'e yaklaşırsa
            // kontrol geri gelir (sayaç sıfırlanır). Determinist (mesafe+tik, RNG-yok). operatorId'siz (sağ-tık/eski-kamikaze)=daima kontrollü.
            const CTRL_R = 900;
            const _isPlayerDrone = this.controlOwner === 'PLAYER';
            let controlled = true, operatorAlive = (this.operatorId == null);   // operatörsüz (sağ-tık kamikaze) = daima kontrollü/canlı
            if (this.operatorId != null) {
                controlled = false;
                for (const op of SIM.units) { if (op.id === this.operatorId) { operatorAlive = !op.dead; if (!op.dead && Math.hypot(op.x - this.x, op.y - this.y) <= CTRL_R) controlled = true; break; } }
            }
            // ── OYUNCU-KOMUT ÖNCELİĞİ (kullanıcı-bug: "dronlar kontrolüme geçmiyor") ──
            // Kontrol-bölgesindeki OYUNCU dronu, fire-and-forget'ten ÖNCE oyuncunun emrini uygular: saldır-emri(manualTarget)→o hedefe dal;
            // git-emri(manualMoveTarget)→oraya uç (varınca aşağı hunt/bekle). Böylece dronlar seçilip komuta edilebilir (operatör yakınken).
            if (_isPlayerDrone && controlled) {
                if (this.manualTarget && !this.manualTarget.dead && !this.manualTarget.loaded) {
                    this._ctrlLostTick = 0; this.attackTarget = this.manualTarget;
                    const dM = Math.hypot(this.manualTarget.x - this.x, this.manualTarget.y - this.y);
                    if (dM <= 70) { this.targetX = this.x; this.targetY = this.y; this.performAttack(now); }
                    else { this.targetX = this.manualTarget.x; this.targetY = this.manualTarget.y; this.manualMoveTarget = { x: this.manualTarget.x, y: this.manualTarget.y }; this.isMovingToManualTarget = true; }
                    return;
                }
                if (this.isMovingToManualTarget && this.manualMoveTarget) {
                    const dG = Math.hypot(this.manualMoveTarget.x - this.x, this.manualMoveTarget.y - this.y);
                    if (dG > 40) { this._ctrlLostTick = 0; this.targetX = this.manualMoveTarget.x; this.targetY = this.manualMoveTarget.y; return; }   // git-emri: oraya uç
                }
            }
            let tgt = (this.attackTarget && !this.attackTarget.dead && !this.attackTarget.loaded) ? this.attackTarget : null;
            if (tgt) { this._diveLastX = tgt.x; this._diveLastY = tgt.y; }   // taahhüt-hedefin SON-KONUMU (her tik güncel)
            // KULLANICI-FIX (kontrol-dışı re-target YOK): drone taahhüt-hedefi ÖLÜNCE (kontrol-dışıyken) yeni-hedef SEÇMEZ →
            // hedefin son-konumuna git + varınca (~70px) PATLA (orada kimse yoksa hasarsız). Kontrollü drone normal re-target (operatör yönetir).
            if (!tgt && !controlled && this._diveLastX != null) {
                const dL = Math.hypot(this._diveLastX - this.x, this._diveLastY - this.y);
                if (dL <= 70) {
                    if (typeof battleRecordLifeEvent === 'function') battleRecordLifeEvent({ kind: 'DRONE_LOST', unitId: this.id, side: this.isRed ? 'red' : 'blue', type: this.type, reason: 'hedef-oldu-son-konum', operatorId: this.operatorId != null ? this.operatorId : null, x: Math.round(this.x * 100) / 100, y: Math.round(this.y * 100) / 100 });
                    this.hp = 0; this.dead = true; this.lastAttackTime = now; if (typeof spawnExplosion !== 'undefined') spawnExplosion(this.x, this.y, 1.6);
                } else { this.targetX = this._diveLastX; this.targetY = this._diveLastY; this.manualMoveTarget = { x: this._diveLastX, y: this._diveLastY }; this.isMovingToManualTarget = true; }
                return;
            }
            if (!tgt) {   // taahhüt-yok (taze) VEYA kontrollü → en yakın canlı KARA düşman (tarama-yarıçapı range×1.5). Determinist (dist+id).
                let bd = Infinity;
                for (const o of SIM.spatialGrid.getNearby(this.x, this.y, this.range * 1.5)) {
                    if (o.dead || o.loaded || o.isRed === this.isRed || o.abandoned || o.isAir) continue;
                    const d = Math.hypot(o.x - this.x, o.y - this.y);
                    if (d < bd || (d === bd && tgt && o.id < tgt.id)) { bd = d; tgt = o; }
                }
                if (tgt) { this._diveLastX = tgt.x; this._diveLastY = tgt.y; }   // yeni taahhüt → son-konumu başlat
            }
            if (tgt) {   // hedef var (kontrollü VEYA kontrol-dışı "en-yakını-seç") → dal; TEMAS-mesafesinde(~70px) patla (menzilden değil)
                this._ctrlLostTick = 0;
                this.attackTarget = tgt;
                const d = Math.hypot(tgt.x - this.x, tgt.y - this.y);
                if (d <= 70) { this.targetX = this.x; this.targetY = this.y; this.performAttack(now); }   // TEMAS → DAL/PATLA
                else { this.targetX = tgt.x; this.targetY = tgt.y; this.manualMoveTarget = { x: tgt.x, y: tgt.y }; this.isMovingToManualTarget = true; }   // dal-yaklaş
            } else if (controlled) {   // KONTROLLÜ + hedef-yok → atıldığı noktaya doğru ilerle (avlanmaya devam, operatör yakın)
                this._ctrlLostTick = 0;
                if (this.launchX != null && this.launchY != null) { this.targetX = this.launchX; this.targetY = this.launchY; this.manualMoveTarget = { x: this.launchX, y: this.launchY }; this.isMovingToManualTarget = true; }
            } else {   // KONTROL-DIŞI (operatör >900px veya ölü) + hedef-yok → SABİT bekle
                this.targetX = this.x; this.targetY = this.y; this.manualMoveTarget = { x: this.x, y: this.y }; this.isMovingToManualTarget = false;
                // SELF-İNFİLAK yalnız operatör ÖLÜ ise (kullanıcı-bug: operatör canlıyken dron patlıyordu → staging+kontrol bozuluyordu).
                // Operatör CANLI ama uzak → dron BEKLER (oyuncu operatörü getirip kontrol alabilir; AI'da da operatör yaklaşınca döner).
                // Operatör ÖLÜ → kontrol imkânsız → 5sn sonra boş-patla (kontrol-bağı gerçekten koptu).
                if (!operatorAlive) {
                    if (!this._ctrlLostTick) this._ctrlLostTick = SIM.tick;
                    if ((SIM.tick - this._ctrlLostTick) >= 100) {   // 5sn = 100 tik → BOŞ-PATLA (operatör öldü)
                        if (typeof battleRecordLifeEvent === 'function') battleRecordLifeEvent({ kind: 'DRONE_LOST', unitId: this.id, side: this.isRed ? 'red' : 'blue', type: this.type, reason: 'operator-oldu', operatorId: this.operatorId != null ? this.operatorId : null, x: Math.round(this.x * 100) / 100, y: Math.round(this.y * 100) / 100 });
                        this.hp = 0; this.dead = true; this.lastAttackTime = now; if (typeof spawnExplosion !== 'undefined') spawnExplosion(this.x, this.y, 1.6);
                    }
                } else { this._ctrlLostTick = 0; }   // operatör canlı → sayaç sıfır, bekle (patlamaz)
            }
            return;   // kamikaze kendi mantığını yürütür (normal combat-dalına girmez)
        }

        const playerControlled = this.controlOwner === 'PLAYER';
        if (playerControlled) {
            if (this.manualTarget && !this.manualTarget.dead && canSee(false, this.manualTarget.x, this.manualTarget.y, this.manualTarget.isAir)) {
                this.attackTarget = this.manualTarget;
            } else {
                this.manualTarget = null;
                if (!this.attackTarget || this.attackTarget.dead || !canSee(false, this.attackTarget.x, this.attackTarget.y, this.attackTarget.isAir) || Math.hypot(this.attackTarget.x - this.x, this.attackTarget.y - this.y) > this.range * 1.3) {
                    const nearby = this.findBestVisibleEnemy();
                    if (nearby && nearby.dist <= this.range) this.attackTarget = nearby.unit;
                    else this.attackTarget = null;
                }
            }

            if (this.attackTarget) {
                const d = Math.hypot(this.attackTarget.x - this.x, this.attackTarget.y - this.y);
                // HEDEFE ÖZEL MENZİL: `this.range` en uzun silahındır; o silah bu hedefi
                // vuramıyorsa birim boşuna duruyordu (SİHA 900'de bekleyip 600'lük
                // hava-hava füzesine hiç giremiyordu).
                if (d <= this.engageRangeFor(this.attackTarget)) {
                    if (this.manualTarget) { this.targetX = this.x; this.targetY = this.y; }
                    this.performAttack(now);
                } else if (this.manualTarget) {
                    this.targetX = this.attackTarget.x;
                    this.targetY = this.attackTarget.y;
                }
            } else if (this.isMovingToManualTarget) {
                // ATIŞ-SERBEST: hareket halindeyken de menzildeki GÖRÜNÜR düşmana GÜVENİLİR ateş
                // ("sınırın içine girdiyse + atış serbest → ateş"). Eski hâli tarama-gecikmesi + kısıtlı-menzille (0.8)
                // ateşi kaçırıyordu; artık her tikte tam menzilde edinir → hareketi bozmadan ateş eder.
                if (!this.attackTarget || this.attackTarget.dead ||
                    Math.hypot(this.attackTarget.x - this.x, this.attackTarget.y - this.y) > this.range) {
                    const nearby = this.findBestVisibleEnemy();
                    this.attackTarget = (nearby && nearby.dist <= this.range) ? nearby.unit : null;
                }
                if (this.attackTarget) this.performAttack(now);
            }
        } else if (this.manualTarget && !this.manualTarget.dead &&
                   canSee(this.isRed, this.manualTarget.x, this.manualTarget.y, this.manualTarget.isAir)) {
            // Denetleyici hedef SEÇER; birim yalnız emri icra eder. Burada karar/target scoring yoktur.
            this.attackTarget = this.manualTarget;
            const d = Math.hypot(this.attackTarget.x - this.x, this.attackTarget.y - this.y);
            // INTEL4 (flag-kapılı) HELO-NEŞTER: helo düşman-AA ZARFINA dalmasın (analist: "hat-yarma"=şemsiye-göbeği→400HP-cam ölür;
            // helo neşterdir, AA'sız yerde cerrahi iş). Helo VEYA emredilen-hedef bir AA-zarfının içindeyse → DIŞA kır (break-off).
            // Emergent: fire-brigade (zarf-dışı bekle), traş (zarf-dışı hedef vur), sömürü (AA ölünce zarf-yok→serbest av).
            let _heloBreak = false;
            if (this.isAir && typeof battleDelta === 'function' && battleDelta(this.isRed, 'helo') &&
                STATS[this.type] && STATS[this.type].weapons && STATS[this.type].weapons.length) {
                let aa = null, aaR = 0, aaD = Infinity;
                for (const o of SIM.spatialGrid.getNearby(this.x, this.y, 2200)) {
                    if (o.dead || o.loaded || o.isRed === this.isRed) continue;
                    const s = STATS[o.type]; if (!s || !(s.roleTags || []).includes('anti_air')) continue;
                    const dd = Math.hypot(o.x - this.x, o.y - this.y);
                    if (aa == null || dd < aaD || (dd === aaD && o.id < aa.id)) { aa = o; aaD = dd; aaR = (s.range || 0); }
                }
                if (aa) {
                    const env = aaR + 120;   // AA-zarfı + emniyet payı
                    const tInEnv = Math.hypot(this.attackTarget.x - aa.x, this.attackTarget.y - aa.y) <= env;
                    if (aaD <= env || tInEnv) {   // helo zarfta VEYA hedef zarfta → AA'dan DIŞA kır (env+60'a)
                        const bx = this.x - aa.x, by = this.y - aa.y, bd = Math.hypot(bx, by) || 1;
                        this.targetX = aa.x + (bx / bd) * (env + 60);
                        this.targetY = aa.y + (by / bd) * (env + 60);
                        this.attackTarget = null; this.isMovingToManualTarget = true;
                        _heloBreak = true;
                    }
                }
            }
            if (_heloBreak) {
                // zarf-dışına kırıldı (yukarıda targetX/Y ayarlandı) — bu tik angaje etme
            } else if (d <= this.engageRangeFor(this.attackTarget)) {   // hedefe özel menzil (bkz. engageRangeFor)
                this.targetX = this.x;
                this.targetY = this.y;
                this.performAttack(now);
            } else {
                // FAZ 5 MENZİLE-YAKLAŞ: SAVUNAN hedefin üstüne koşmasın, silah menziline (0.9×) girip HATTI TUTSUN
                // (blob + hat-kapalı + kuşatılma azalır). SALDIRAN ise kapatıp EZER (menzilde durursa düşman kaçar/
                // toparlanır → saldırı boğulur). Ölçüldü: savunma -26→+295, saldırıda stand-off zararlı. Bayraklı.
                let standOff = false;
                if (typeof BATTLE_UNIT_MICRO === 'undefined' || BATTLE_UNIT_MICRO) {
                    // DETERMİNİZM: duruş SİM-durumundan okunur (canlı kontrolör nesnesinden DEĞİL) → replay/fork birebir.
                    const gate = (SIM.ctrlPosture && this.controllerId) ? SIM.ctrlPosture[this.controllerId] : null;
                    if ((typeof BATTLE_POSTURE_GATE === 'undefined' || BATTLE_POSTURE_GATE) && gate && typeof gate.open === 'boolean') {
                        // TAARRUZ-KAPISI: kapı KAPALIYSA (koşullar/urgency STRIKE demiyorsa) role fark etmez —
                        // birim menzilde durup ŞEKİLLENDİRİR (menzilden ateşle yıprat). Kapı AÇILINCA kapat-ez.
                        // "AI STRIKE'ta doğmaz"; saldıran da koşullar sağlanana/urgency zorlayana dek kötü-takasa dalmaz.
                        standOff = !gate.open;
                    } else {
                        // Fallback (kapı kapalı/yok): eski davranış — savunan stand-off, saldıran press.
                        const role = gate && gate.role;
                        standOff = role != null && role !== (typeof BATTLE_ROLE !== 'undefined' ? BATTLE_ROLE.ATTACKER : 'attacker');
                    }
                }
                // FAZ4 R1 (analist damıtma, 'range'-delta): UZUN-menzilli birim (AT/TD/topçu/ÇNRA/helo, range≥520) STRIKE'ta bile
                // 0.9×menzilde durup vurur → menzil-üstünlüğünü İSRAF ETMEZ ("menzil-farkı katliamı" tersine; kullanıcı imzası:
                // her sınıf azami-menzilinin %85-96'sında ateşler). KISA-menzilli ana-çaba ucu (MBT450/piyade300) kapatıp EZER (değişmez).
                if (!standOff && this.range >= 520 && typeof battleDelta === 'function' && battleDelta(this.isRed, 'range')) standOff = true;
                // INTEL4-PRO 'assaultCohesion': DESTEKSİZ İLERLEME YOK. Ölçüldü: saldıran birim vurulduğu anda yerel
                // dost/düşman oranı kazanan saldırılarda ~10.8, kaybedenlerde ~3.4 (t=60'ta r=0.748). Yalnız kalan
                // birim kapatmaz — menzilde bekler, kütle toplanınca birlikte girer. Determinist (RNG yok).
                if (!standOff && typeof battleProDelta === 'function' && battleProDelta(this.isRed, 'assaultCohesion')) {
                    const _cp = (SIM.ctrlPosture && this.controllerId) ? SIM.ctrlPosture[this.controllerId] : null;
                    if (_cp && _cp.role === (typeof BATTLE_ROLE !== 'undefined' ? BATTLE_ROLE.ATTACKER : 'attacker')) {
                        let _dost = 0;
                        for (const f of SIM.spatialGrid.getNearby(this.x, this.y, PRO_COHESION_R)) {
                            if (f.dead || f === this || f.loaded || f.abandoned || f.isRed !== this.isRed) continue;
                            if (Math.hypot(f.x - this.x, f.y - this.y) <= PRO_COHESION_R && ++_dost >= PRO_COHESION_MIN) break;
                        }
                        // TEŞHİS SAYAÇLARI (BATTLE_BALANCE gate'li, hash-dışı, sim'i etkilemez): kural kaç kez
                        // değerlendirildi / kaç kez bağladı / kaç kez GERÇEKTEN davranış değiştirdi (d>menzil iken).
                        if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) {
                            BATTLE_BALANCE.proCohesionEval = (BATTLE_BALANCE.proCohesionEval || 0) + 1;
                            if (_dost < PRO_COHESION_MIN) {
                                BATTLE_BALANCE.proCohesionHold = (BATTLE_BALANCE.proCohesionHold || 0) + 1;
                                if (d > this.range) BATTLE_BALANCE.proCohesionBind = (BATTLE_BALANCE.proCohesionBind || 0) + 1;
                            }
                            BATTLE_BALANCE.proCohesionDostSum = (BATTLE_BALANCE.proCohesionDostSum || 0) + _dost;
                        }
                        // ÖLÇÜLDÜ ve GERİ ALINDI — "aktif toplanma" (dost kütlesinin merkezine git) denendi:
                        // mekanizma ÇALIŞTI (ort. yakın dost 1.05→4.7, bind %100→%24) ama SONUÇ KÖTÜLEŞTİ
                        // (saldıran 2/4→1/4, toplam 5/8→4/8). Sebep: yerel-oran = dost/DÜŞMAN. Kendi merkezine
                        // yığılmak dostu artırıyor ama düşman kütlesiyle burun buruna geldiği için ORANI
                        // değiştirmiyor (seed3141: ort-dost 1.05→4.7 ama t60 yerel-oran 0.71'de sabit).
                        // DERS: kazananların 10.8'lik oranı "çok dost" değil, "DÜŞMANIN ZAYIF OLDUĞU YERDE çok dost"
                        // demek — yani schwerpunkt. Doğru kaldıraç: düşmanın ZAYIF sektörüne yoğunlaşmak
                        // (mevcut sektör-komuta/ana-çaba altyapısının işi), kör yığılma değil.
                        if (_dost < PRO_COHESION_MIN) standOff = true;   // desteksiz: kapatma, menzilde tut
                    }
                }
                // ── INTEL4-PRO 'localRatio': YEREL ORAN KAPISI (rol farketmez) ──
                // TEŞHİS (tools/zirh-hasar-teshis.js, seed2024): zırhlılar ölürken çevrelerinde
                // ort. 4 dost / 12.3 DÜŞMAN vardı — yani 1:3 yerel dezavantaj (2/14, 4/17, 6/6).
                // O oranda yan-zırh çarpanının (×1.5) hiçbir önemi yok; nitekim armorFace
                // maruziyeti %37→%4 düşürdüğü hâlde ömrü değiştirmedi. Hasarın %76'sı zaten
                // DIRECT_FIRE, yani sorun 'yön' değil 'yer'.
                // Üstteki assaultCohesion bu vakayı KAÇIRIYOR: (a) yalnız SALDIRAN rolüne bakıyor —
                // ölenler savunandı, (b) yalnız DOSTU sayıyor, düşmanı saymıyor.
                // Bellekteki ders de buydu: "kazananların 10.8'lik oranı 'çok dost' değil,
                // DÜŞMANIN ZAYIF OLDUĞU YERDE çok dost demek" — kütle değil ORAN.
                // Kural: yerel dost/düşman oranı eşiğin altındaysa KAPATMA, menzilde tut.
                // Not: 'aktif toplanma' denenmiş ve zararlı çıkmıştı; bu onun aksine birimi
                // HAREKET ETTİRMEZ, yalnız ilerlemeyi keser (standOff).
                if (!standOff && !this.isIndirect && typeof battleProDelta === 'function' &&
                    battleProDelta(this.isRed, 'localRatio')) {
                    let _d = 0, _e = 0;
                    for (const o of SIM.spatialGrid.getNearby(this.x, this.y, PRO_RATIO_R)) {
                        if (o.dead || o.loaded || o.abandoned || o === this) continue;
                        if (Math.hypot(o.x - this.x, o.y - this.y) > PRO_RATIO_R) continue;
                        if (o.isRed === this.isRed) _d++; else _e++;
                    }
                    if (_e > 0 && (_d + 1) / _e < PRO_RATIO_MIN) {   // +1 = kendisi
                        standOff = true;
                        if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) {
                            BATTLE_BALANCE.localRatioBind = (BATTLE_BALANCE.localRatioBind || 0) + 1;
                        }
                    }
                }
                // ── INTEL4-PRO 'antiMatch': YEREL ÜSTÜNLÜK SAYIYLA DEĞİL ANTİ-EŞLEŞMEYLE ──
                // KULLANICI DOKTRİNİ: "kütleyi büyütücem diye piyadeleri dolaylının önüne koyarsan ölürler;
                // dolaylılar tanka vurursa hiçbir şey olmaz — birimleri ANTİ kullan."
                // Üstteki iki kural (assaultCohesion/localRatio) yalnız KAFA SAYAR: "5 piyade 3 tanka karşı"yı
                // 1.67 ile İYİ görür. ÖLÇÜLDÜ (tools/anti-eslesme.js): yerel kütlenin %22-27'si yanlış alet ve
                // temasların %19-23'ünde sayı ≥1.5 iken ETKİ <1.0 — yani kural kazandığını sanırken kaybediyor.
                // Hedef SEÇİMİ zaten anti-ağırlıklı (findBestVisibleEnemy); eksik olan KİMİN o dövüşte
                // BULUNDUĞU. Bu yüzden fren burada: yanlış alet kapatmaz, doğru alet girer.
                // Birim YENİDEN KONUMLANDIRILMAZ — "aktif toplanma" ölçülüp zararlı bulunmuştu (satır 1593).
                if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) {
                    BATTLE_BALANCE.antiMatchReach = (BATTLE_BALANCE.antiMatchReach || 0) + 1;   // teşhis: bu satıra kaç kez gelindi
                    if (typeof battleProDelta === 'function' && battleProDelta(this.isRed, 'antiMatch')) BATTLE_BALANCE.antiMatchOn = (BATTLE_BALANCE.antiMatchOn || 0) + 1;
                    if (standOff) BATTLE_BALANCE.antiMatchPreStand = (BATTLE_BALANCE.antiMatchPreStand || 0) + 1;
                }
                if (!standOff && typeof battleProDelta === 'function' && battleProDelta(this.isRed, 'antiMatch')) {
                    // KESİT NEREDE ALINIR: birimin ALTINDA değil, GİRECEĞİ DÖVÜŞÜN YERİNDE (hedefin çevresi).
                    // İlk sürüm kesiti birimin altından aldı ve HİÇ bağlamadı (ölçüldü: bind=0/3000 tik) —
                    // çünkü birim menzil dışından kapatırken düşman çoğu zaman 600px'in ötesinde kalıyor.
                    // Doğru soru "etrafımda ne var" değil, "GİTTİĞİM yerdeki karışıma karşı doğru alet miyim".
                    const _hx = this.attackTarget.x, _hy = this.attackTarget.y;
                    let _oDps = 0, _eDps = 0, _en = 0;
                    const _dostlar = [], _dusman = [];
                    for (const o of SIM.spatialGrid.getNearby(_hx, _hy, PRO_ANTI_R)) {
                        if (o.dead || o.loaded || o.abandoned) continue;
                        if (Math.hypot(o.x - _hx, o.y - _hy) > PRO_ANTI_R) continue;
                        if (o.isRed === this.isRed) { if (o !== this) _dostlar.push(o); } else _dusman.push(o);
                    }
                    _en = _dusman.length;
                    if (_en > 0) {
                        _dostlar.push(this);                                   // kendisi de kütlenin parçası
                        for (const f of _dostlar) {
                            let s = 0;
                            for (const e of _dusman) s += battleTypeDps(f.type, e.type);
                            _oDps += s / _en;                                  // birim başına ORTALAMA etki
                        }
                        for (const e of _dusman) {
                            let s = 0;
                            for (const f of _dostlar) s += battleTypeDps(e.type, f.type);
                            _eDps += s / _dostlar.length;
                        }
                        // (1) YEREL ETKİ ORANI: bu dövüşü kazanamıyorsak kapatma.
                        const _etkiKotu = _eDps > 0 && (_oDps / _eDps) < PRO_ANTI_MIN;
                        // (2) YANLIŞ ALET: bu karışıma karşı ben işe yaramıyorsam öne çıkmam (doğru alet girsin).
                        let _kendi = 0;
                        for (const e of _dusman) _kendi += battleTypeDps(this.type, e.type);
                        _kendi /= _en;
                        const _enIyi = battleTypeBestDps(this.type);
                        const _yanlisAlet = _enIyi > 0 && _kendi < PRO_ANTI_WRONG * _enIyi;
                        if (_etkiKotu || _yanlisAlet) {
                            standOff = true;
                            if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) {
                                BATTLE_BALANCE.antiMatchBind = (BATTLE_BALANCE.antiMatchBind || 0) + 1;
                                if (_yanlisAlet) BATTLE_BALANCE.antiMatchWrongTool = (BATTLE_BALANCE.antiMatchWrongTool || 0) + 1;
                                if (_etkiKotu) BATTLE_BALANCE.antiMatchBadRatio = (BATTLE_BALANCE.antiMatchBadRatio || 0) + 1;
                            }
                        }
                    }
                }
                if (standOff && d > this.range) {
                    const t = Math.max(0, (d - this.range * 0.9) / d);
                    this.targetX = this.x + (this.attackTarget.x - this.x) * t;
                    this.targetY = this.y + (this.attackTarget.y - this.y) * t;
                } else {
                    this.targetX = this.attackTarget.x;
                    this.targetY = this.attackTarget.y;
                    this._pressingAssault = SIM.tick;   // TAARRUZ: menzil-dışı hedefe kapatıyor → ateş-altında ilerlemeyi SÜRDÜR (pinned/panik direnci)
                }
                this.isMovingToManualTarget = true;
            }
        } else if (!playerControlled) {
            // ATIŞ-SERBEST (özsavunma) — ASIL MİKRO-FİX: kontrolör hedef vermese de, menzildeki GÖRÜNÜR düşmana
            // kendiliğinden ateş et (oyuncu birlikleriyle tam simetri). Eskiden AI birimi emirsizken idle kalıyor,
            // hareket/çekilme sırasında ateş yemeden eriyordu (12-1 ezilmelerin sebebi). Hareketi (targetX/Y) BOZMAZ;
            // sadece menzildekine ateş eder → çekilirken/manevrada da karşılık verir. findBestVisibleEnemy görünür+LOS
            // garantiler, performAttack güvenli. Kontrolör manualTarget verdiğinde (üst dal) onun odaklı-ateşi önceliklidir.
            this.manualTarget = null;
            if (typeof BATTLE_UNIT_SELF_DEFENSE === 'undefined' || BATTLE_UNIT_SELF_DEFENSE !== false) {
                const nearby = this.findBestVisibleEnemy();
                // TAARRUZ-KAPISI: emirsiz birim menzil-DIŞI düşmanı ancak kapı AÇIKKEN (STRIKE) kendiliğinden kovalar.
                // Kapı kapalıysa donmaz ama körlemesine de dalmaz — özsavunma (menzildekine ateş) sürer, hattı tutar.
                let selfCloseOK = true;
                if (typeof BATTLE_POSTURE_GATE === 'undefined' || BATTLE_POSTURE_GATE) {
                    const gate2 = (SIM.ctrlPosture && this.controllerId) ? SIM.ctrlPosture[this.controllerId] : null;   // SİM-durumu (replay/fork güvenli)
                    if (gate2 && typeof gate2.open === 'boolean') {
                        selfCloseOK = gate2.open;
                        // SONDAJ (probe): SHAPE'te KEŞİF birimi öne sokulup temas kurar (yoklama/aydınlatma) —
                        // ana kuvvet beklerken keşif düşmanı bulur → controller CONTACT'a geçer → kapı değerlendirir.
                        if (!selfCloseOK && gate2.stance === 'SHAPE' && typeof T !== 'undefined' && this.type === T.RECON) selfCloseOK = true;
                    }
                }
                // SEAD-BEKLE (kullanıcı-formülü exploit-evre): hava-vurucu (helo/İHA) düşman AA'sı YAKINDA-CANLIYKEN öne
                // sokulmaz → SEAD (ground'un AA'yı sökmesi) tamamlanana kadar bekler, sonra temizliğe girer (sağ kalır).
                if (selfCloseOK && this.isAir && STATS[this.type] && STATS[this.type].weapons && STATS[this.type].weapons.length) {
                    const _aaNear = SIM.spatialGrid.getNearby(this.x, this.y, 1400).some(o => !o.dead && !o.loaded && o.isRed !== this.isRed && STATS[o.type] && (STATS[o.type].roleTags || []).includes('anti_air'));
                    if (_aaNear) selfCloseOK = false;
                }
                // SABIRLI-ÖRÜMCEK (analist fizik-uyarısı): kara-AA (SAM 25px/s) HAVA hedefini KOVALAMAZ — helo 113px/s,
                // kovalayan SAM hep 4-kat-hızlı avın BİR-ÖNCEKİ konumuna yürür. Sabit kal: helo iş yapmak için dost-kümenin
                // 900px'ine girmek zorunda → av kendi ayağıyla zarfa gelir. (Kara-hedefe self-close serbest.)
                if (selfCloseOK && !this.isAir && nearby && nearby.unit && nearby.unit.isAir &&
                    (typeof battleDelta === 'function' && battleDelta(this.isRed, 'micro')) &&   // INTEL4-delta 'micro': sabırlı-örümcek
                    STATS[this.type] && (STATS[this.type].roleTags || []).includes('anti_air')) selfCloseOK = false;
                if (nearby && nearby.dist <= this.range) {
                    this.attackTarget = nearby.unit; this.performAttack(now);
                } else if (nearby && !this.isFleeing && !this.isIndirect && selfCloseOK &&
                           Math.hypot(this.targetX - this.x, this.targetY - this.y) < 40) {
                    // KENDİLİĞİNDEN KAPAT: kapı-açık+emirsiz+boşta AI birimi menzil-DIŞI düşmanı görüyorsa ÜSTÜNE YÜRÜ
                    // (kısa-menzil birim uzun-menzil ateşinde donup kalmasın → temas edebilsin). Emir varsa dokunmaz.
                    this.attackTarget = null;
                    this.targetX = nearby.unit.x; this.targetY = nearby.unit.y;
                    this._pressingAssault = SIM.tick;
                } else {
                    this.attackTarget = null;
                }
            } else {
                this.attackTarget = null;   // ÖLÇÜM: özsavunma KAPALI (eski davranış) — fix'in etkisini ölçmek için
            }
        }
    }

    // ── INTEL4-PRO 'armorFace': YÖNLÜ ZIRHI KORU (burnu baskın tehdide dön) ──
    // TEŞHİS (tools/zirh-teshis.js, seed2024, izole): yönlü-zırhlı birimlerin maruziyeti
    // ÖN %63 / YAN %27 / ARKA %10 — yani %37'si zırhın zayıf tarafından. Savunan MBT en kötüsü:
    // %42 / %56 / %1, yani zamanın YARIDAN FAZLASINDA yanını gösteriyor. MBT yan çarpanı ×1.5,
    // tanksavar arka çarpanı ×3.3 → bu doğrudan ₺ kaybı.
    // SEBEP: facingAngle önce HAREKET yönüne (satır 548), sonra ATIŞ HEDEFİNE (satır 560) kuruluyor.
    // İkisi de "beni kim vuruyor" sorusunu sormuyor: A'ya ateş ederken B yandan vuruyor.
    // Kural: burnu, o an SENİ VURABİLEN düşmanların hasar-ağırlıklı merkezine dön.
    // BEDAVA BECERİ: yalnız yön değişir, birim yerinden oynamaz — bugün elenen konumlandırma
    // becerilerinin (jammerPost/resupplyRun) aksine hareket maliyeti YOK. Ateşi de engellemez
    // (namlu-arkı kontrolü yok; hasar yalnız facingAngle'dan okunuyor).
    _zirhYonlendir() {
        if (typeof battleProDelta !== 'function' || !battleProDelta(this.isRed, 'armorFace')) return;
        if (this.dead || this.loaded || this.abandoned || this.isFleeing) return;
        if (this.controlOwner === 'PLAYER') return;   // oyuncunun birimini döndürmeyiz
        const st = STATS[this.type];
        if (!st || !st.armorFacing) return;           // yalnız yönlü-zırhı OLAN birim

        // BASKIN TEHDİT: beni ŞU AN vurabilen düşmanlar, hasar potansiyeline göre ağırlıklı.
        let vx = 0, vy = 0, agirlikTop = 0;
        for (const e of SIM.spatialGrid.getNearby(this.x, this.y, PRO_ARMORFACE_R)) {
            if (e.dead || e.loaded || e.abandoned || e.isRed === this.isRed) continue;
            const es = STATS[e.type];
            if (!es || !es.weapons || !es.weapons.length) continue;
            if (typeof unitCanEngage === 'function' && !unitCanEngage(es, st)) continue;   // bana vuramayan tehdit değil
            const d = Math.hypot(e.x - this.x, e.y - this.y);
            if (d > e.range || d < 1e-6) continue;                                          // menzilinde değilse şu an tehdit değil
            const w = (es.weapons[0].damage || 1);
            vx += ((e.x - this.x) / d) * w; vy += ((e.y - this.y) / d) * w; agirlikTop += w;
        }
        if (!agirlikTop) return;                       // vurabilen kimse yok → mevcut yön kalsın
        if (Math.hypot(vx, vy) < agirlikTop * PRO_ARMORFACE_MIN_BASKINLIK) return;   // tehdit HER YÖNDEN → dönmek anlamsız
        this.facingAngle = Math.atan2(vy, vx);
        if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) {
            BATTLE_BALANCE.armorFaceBind = (BATTLE_BALANCE.armorFaceBind || 0) + 1;
        }
    }

    // ── INTEL4-PRO 'indirectCreep': KISA MENZİLLİ DOLAYLI ATEŞ MENZİLE GİRER ──
    // TEŞHİS (tools/dolayli-bos-teshis.js, seed2024): savunanın dolaylı ateşi mühimmatı varken
    // tiklerin %48'inde MENZİLİNDE DÜŞMAN OLMADIĞI için boş duruyor. Görüş %0, ölü bölge %0,
    // hedefleme filtresi %0 — sebep tek başına KONUM.
    //   Havan  menzil  900px · en yakın düşman ort. 1165px (MENZİL DIŞI) · kendi hattının 760px gerisinde
    //   Topçu  menzil 1500px · en yakın düşman ort. 1216px (menzil içi)  → onun sorunu mühimmat, konum değil
    // Bu kural `standoff`un AYNADAKİ HÂLİ: o, uzun ölü bölgeli birimi geri çeker; bu, kısa menzilli
    // dolayı ateşi öne alır. GÜVENLİK ŞARTI: kendi ÖN HATTININ gerisinde kalır — bugün elenen
    // konumlandırma becerileri (jammerPost) tam da öne çıkıp öldükleri için düşmüştü.
    // Determinist: mesafe aritmetiği, RNG yok. Dönüş: true ise hareketi devraldı.
    _dolayliYaklas() {
        if (typeof battleProDelta !== 'function' || !battleProDelta(this.isRed, 'indirectCreep')) return false;
        if (this.dead || this.loaded || this.abandoned || this.isFleeing) return false;
        if (this.controlOwner === 'PLAYER' || !this.speed || !this.isIndirect) return false;
        if (this.range > PRO_ICREEP_MAX_MENZIL) return false;   // uzun menzilli (topçu/ÇNRA/balistik) bu kuralın konusu değil
        if (this.maxAmmo > 0 && this.ammo <= 0) return false;   // kuru birim öne gitmez

        // En yakın düşman: zaten menzildeyse dokunma (iş başında).
        let ex = 0, ey = 0, ed = Infinity;
        for (const e of SIM.units) {
            if (e.dead || e.loaded || e.abandoned || e.isRed === this.isRed) continue;
            const d = Math.hypot(e.x - this.x, e.y - this.y);
            if (d < ed) { ed = d; ex = e.x; ey = e.y; }
        }
        if (ed === Infinity || ed <= this.range * PRO_ICREEP_HEDEF) return false;

        // ÖN HAT: en ileri dost DOĞRUDAN-ateş birimi. Onun gerisinde kalırız — havan hattın önüne geçmez.
        let hatY = null;
        for (const f of SIM.units) {
            if (f.dead || f.loaded || f.abandoned || f.isRed !== this.isRed || f === this) continue;
            const fs = STATS[f.type];
            if (!fs || !fs.weapons || !fs.weapons.length) continue;
            if (fs.weapons[0].indirect) continue;
            if (hatY === null) hatY = f.y;
            else hatY = this.isRed ? Math.max(hatY, f.y) : Math.min(hatY, f.y);
        }
        if (hatY === null) return false;   // muharip hat yok → tek başına ilerlemez

        // Hedef: düşmanı menzilin PRO_ICREEP_HEDEF kesrine alacak nokta, ama hattın gerisinde.
        const t = (ed - this.range * PRO_ICREEP_HEDEF) / ed;
        let hx = this.x + (ex - this.x) * t, hy = this.y + (ey - this.y) * t;
        const sinir = this.isRed ? hatY - PRO_ICREEP_HAT_GERI : hatY + PRO_ICREEP_HAT_GERI;
        if (this.isRed ? hy > sinir : hy < sinir) hy = sinir;
        if (this.isRed ? hy <= this.y : hy >= this.y) return false;   // ileri gitmiyorsa dokunma

        this.targetX = hx; this.targetY = hy;
        this.isMovingToManualTarget = true;
        this._pressingAssault = 0;
        if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) {
            BATTLE_BALANCE.icreepBind = (BATTLE_BALANCE.icreepBind || 0) + 1;
        }
        return true;
    }


    /* ── MENZİLE GİR: kısa menzilli DOĞRUDAN ateş, düşmanın erişemeyeceği yerde beklemesin ──
       KULLANICININ 4 GERÇEK MAÇINDAN ÖLÇÜLDÜ (2026-08-18, docs/OYUNCU-MACLARI-BULGULAR.md):
         · AI ile oyuncu neredeyse AYNI mesafede duruyor (medyan 1137-1336px vs 1092-1125px)
         · ama menzile ORANI çok farklı: AI 2.17-3.09 · oyuncu 1.24-1.82
           (yani AI'nın silahı, düşmanın durduğu yere 2-3 kat yetmiyor)
         · ateş edebilir konumda geçen zaman: AI %12-22 · oyuncu %23-35
         · fırsat/canlı-örnek: AI 0.16 · oyuncu 0.31   (atış: 0.032 vs 0.078)
       AI'nın 20 silahlı biriminin 12'si kısa menzilli DOĞRUDAN ateş (tanksavar×8 525px,
       piyade×4 300px) ve onları öne çeken HİÇBİR ŞEY YOK. `_dolayliYaklas` yalnız DOLAYLI
       ateşe bakıyor (ve o da pro-kapılı).

       Bu kural onun doğrudan-ateş kardeşi. AYNI güvenlik yapısı:
         · yalnız hedefi OLMAYAN birim (menzilinde düşman varsa dokunma — iş başında)
         · yalnız düşman menzilin PRO_ICREEP_HEDEF katından UZAKSA
         · kendi ÖN HATTININ gerisinde kalır (tek başına dalmaz — kayıtlı kusur sınıfı:
           öne çıkıp ölen konumlandırma becerileri elendi)
         · kuru birim öne gitmez
       Determinist: mesafe aritmetiği, RNG yok. Dönüş: true ise hareketi devraldı.
       ⚠ VARSAYILAN KAPALI. Yaklaşmak ateş altına girmek demektir; kazanç mı kayıp mı
       olduğu maç kapısında ölçülür. */
    _menzileGir() {
        if (typeof BATTLE_MENZILE_GIR === 'undefined' || BATTLE_MENZILE_GIR !== true) return false;
        if (this.dead || this.loaded || this.abandoned || this.isFleeing) return false;
        if (this.controlOwner === 'PLAYER' || !this.speed) return false;
        if (this.isIndirect) return false;                      // dolaylı ateşin kendi kuralı var
        if (this.isAir || this._retired) return false;
        const _st = STATS[this.type];
        if (!_st || !_st.weapons || !_st.weapons.length) return false;   // silahsız birim öne gitmez
        if (this.range >= MENZILE_GIR_UST) return false;        // zaten uzun menzilli
        if (this.maxAmmo > 0 && this.ammo <= 0) return false;   // kuru birim öne gitmez

        let ex = 0, ey = 0, ed = Infinity;
        for (const e of SIM.units) {
            if (e.dead || e.loaded || e.abandoned || e.isRed === this.isRed) continue;
            if (e.isAir) continue;                              // kara birimi uçağa yürümez
            const d = Math.hypot(e.x - this.x, e.y - this.y);
            if (d < ed) { ed = d; ex = e.x; ey = e.y; }
        }
        if (ed === Infinity || ed <= this.range * MENZILE_GIR_HEDEF) return false;   // zaten menzilde/yakın
        if (ed > MENZILE_GIR_AZAMI) return false;               // çok uzak: harita boyu yürüyüş değil

        // ÖN HAT: en ileri dost doğrudan-ateş birimi. Onun ötesine TEK BAŞINA geçmeyiz.
        let hatY = null;
        for (const f of SIM.units) {
            if (f.dead || f.loaded || f.abandoned || f.isRed !== this.isRed || f === this) continue;
            const fs = STATS[f.type];
            if (!fs || !fs.weapons || !fs.weapons.length) continue;
            if (fs.weapons[0].indirect) continue;
            if (hatY === null) hatY = f.y;
            else hatY = this.isRed ? Math.max(hatY, f.y) : Math.min(hatY, f.y);
        }
        if (hatY === null) return false;

        const t = (ed - this.range * MENZILE_GIR_HEDEF) / ed;
        let hx = this.x + (ex - this.x) * t, hy = this.y + (ey - this.y) * t;
        const sinir = this.isRed ? hatY + MENZILE_GIR_HAT_ILERI : hatY - MENZILE_GIR_HAT_ILERI;
        if (this.isRed ? hy > sinir : hy < sinir) hy = sinir;
        if (this.isRed ? hy <= this.y : hy >= this.y) return false;   // ileri gitmiyorsa dokunma

        this.targetX = hx; this.targetY = hy;
        this.isMovingToManualTarget = true;
        this._holdingPos = false;
        if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) {
            BATTLE_BALANCE.menzileGirBind = (BATTLE_BALANCE.menzileGirBind || 0) + 1;
        }
        return true;
    }

    // ── INTEL4-PRO 'supplyEscort': İKMAL ARACI ATEŞ DESTEĞİNİN YANINDA DURUR ──
    // KULLANICI DOKTRİNİ: "topçuların yakınında sürekli bir ikmal aracı şart."
    // ÖLÇÜLDÜ (tools/ikmal-konum-teshis.js, seed2024): savunanın dolaylı birimleri ikmal halesinin
    // içinde yalnız %16 geçiriyor, %12 KURU duruyor ve ikmal aracı dolaylı-kümenin merkezine
    // ortalama 712px uzakta — hale ise 400px. Yani araç çoğu zaman menzil dışında.
    // Bu, elenen `resupplyRun`un TERSİ: orada topçu ikmale gidiyordu (mevziini terk edip Katman 2'de
    // düştü); burada ARAÇ topçuya geliyor. Topçu mevziinde kalır, aracın zaten tek işi budur.
    // Determinist: ihtiyaç-ağırlıklı merkez, RNG yok. Dönüş: true ise hareketi devraldı.
    _ikmalRefakat() {
        if (typeof battleProDelta !== 'function' || !battleProDelta(this.isRed, 'supplyEscort')) return false;
        if (this.dead || this.loaded || this.abandoned || this.isFleeing) return false;
        if (this.controlOwner === 'PLAYER' || !this.speed || this._returningToBase) return false;
        const st = STATS[this.type];
        const aura = st && st.aura;
        if (!aura || aura.type !== 'resupply') return false;
        const TP = (typeof TILE_PX !== 'undefined') ? TILE_PX : 100;
        const R = (aura.radius || 3) * TP;

        // MÜŞTERİ KÜMESİ: mühimmatı EKSİLEN dostlar; eksiklik × maliyet ile ağırlıklı.
        // Dolaylı ateşe ek ağırlık — mermisi bitince tamamen işlevsiz kalan sınıf odur.
        let cx = 0, cy = 0, w = 0;
        for (const f of SIM.units) {
            if (f.dead || f.loaded || f.abandoned || f.isRed !== this.isRed || f === this) continue;
            if (!f.maxAmmo) continue;
            const eksik = 1 - (f.ammo / f.maxAmmo);
            if (eksik <= PRO_SUPPLY_MIN_EKSIK) continue;
            const fs = STATS[f.type];
            const agirlik = eksik * ((fs && fs.cost) || 1) * (f.isIndirect ? PRO_SUPPLY_DOLAYLI_KAT : 1);
            cx += f.x * agirlik; cy += f.y * agirlik; w += agirlik;
        }
        if (!w) return false;   // kimsenin mühimmatı eksik değil → mevcut davranış
        cx /= w; cy /= w;

        // GÜVENLİK: ikmal aracı zırhsız ve silahsız. Görülen düşman ateşli KARA birimi yakınsa gitme.
        for (const e of SIM.units) {
            if (e.dead || e.loaded || e.abandoned || e.isRed === this.isRed || e.isAir) continue;
            const es = STATS[e.type];
            if (!es || !es.weapons || !es.weapons.length) continue;
            if (Math.hypot(e.x - this.x, e.y - this.y) <= PRO_SUPPLY_TEHDIT) return false;
        }

        const d = Math.hypot(cx - this.x, cy - this.y);
        if (d <= R * PRO_SUPPLY_ICERI) {   // küme zaten halede → dur (sürüklenme yok, ikmal aksamasın)
            this.targetX = this.x; this.targetY = this.y;
        } else {
            const t = (d - R * PRO_SUPPLY_ICERI) / d;
            this.targetX = this.x + (cx - this.x) * t;
            this.targetY = this.y + (cy - this.y) * t;
        }
        this.isMovingToManualTarget = true;
        this._pressingAssault = 0;
        if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) {
            BATTLE_BALANCE.supplyEscortBind = (BATTLE_BALANCE.supplyEscortBind || 0) + 1;
        }
        return true;
    }

    // ── INTEL4-PRO 'adUmbrella': HAVA SAVUNMASI ATIŞ NOKTASINI ÖRTER (KORUNANI DEĞİL) ──
    // ÖLÇÜLDÜ (2026-08-09, kullanıcının 26 GERÇEK maçı, tools/olduren-kaynak.js + helo-maruziyet.js):
    //   attack_helo AI kayıplarının %22'si — tek kalemde EN BÜYÜK katil (146 ölüm).
    //   Kurbanların %79'u hava savunma menzilinin İÇİNDEYDİ  → konumlandırma "yanlış yerde" DEĞİL.
    //   Ama HELONUN KENDİSİ vuruş anında menzilde yalnız %41, menzil∩görüş yalnız **%21**.
    //   Helo→en yakın AD medyan 1188px; o anda en yakın AD çoğunlukla manpads (825px) → MENZİL DIŞI.
    // KÖK NEDEN: helo 675px'ten atıyor, yani şemsiyenin ALTINDAKİ birimi şemsiyenin DIŞINDA durarak
    // öldürüyor. Kapsama yer birimini örtüyor, ona ateş edilen HAVA SAHASINI örtmüyor.
    // KATKIDA BULUNAN: air_defense kovası FIRE_SUPPORT'a bağlı (globals battleUnitRoleBucket) ve o grup
    // BattlePlanning.js:686-688'de bilerek derine çekiliyor ("en-uzun düşman doğrudan-ateş-zarfı ~675
    // DIŞINDA"). Topçu için doğru, hava savunması için tam ters — AD topçunun güvenlik mesafesini
    // miras alıyor. Bu kural o mirası birim katmanında telafi eder (planlama kovası bozulmadan).
    // KURAL: AD, koruduğu KARA kütlesinin merkezinden TEHDİT EKSENİ yönünde, zarfı düşmanın atış
    // noktalarına yetecek kadar ileri oturur. İleri gitme miktarı SABİT DEĞİL, geometriden türetilir:
    //   gereken erişim = kütleYarıçapı + düşmanHavaMenzili   →   ileri = gereken − kendiMenzili
    // GÜVENLİK (28% ölüm AI'ın hiç AD'si kalmamışken oluyor): görülen silahlı düşman KARA birimi
    // PRO_AD_TEHDIT içindeyse ilerleme; ve ileri miktarı PRO_AD_MAX_ILERI ile tavanlı.
    // Determinist: yalnız mesafe/menzil aritmetiği, RNG yok.
    _havaSemsiye() {
        if (typeof battleProDelta !== 'function' || !battleProDelta(this.isRed, 'adUmbrella')) return false;
        if (this.dead || this.loaded || this.abandoned || this.isFleeing) return false;
        if (this.controlOwner === 'PLAYER' || !this.speed || this._returningToBase) return false;
        const st = STATS[this.type];
        if (!st || st.category !== 'air_defense') return false;          // veriden türetilir, elle liste YOK
        // KENDİ hava menzili (hava hedefleyen silahların en uzunu)
        let benimMenzil = 0;
        for (const w of (st.weapons || [])) {
            if (Array.isArray(w.targets) && w.targets.includes('air')) benimMenzil = Math.max(benimMenzil, w.range || 0);
        }
        if (benimMenzil <= 0) return false;

        // 1) KORUNACAK KÜME: helonun vurduğu şey = KARA muharip dostlar (ölçüm: ifv/at_team/artillery/
        //    tank_destroyer/mbt ilk sıralarda). Maliyetle ağırlıklı merkez + kütle yarıçapı.
        let cx = 0, cy = 0, w = 0;
        const uyeler = [];
        for (const f of SIM.units) {
            if (f.dead || f.loaded || f.abandoned || f.isRed !== this.isRed || f === this) continue;
            if (f.isAir) continue;                                        // havadaki dostu şemsiye korumaz
            const fs = STATS[f.type];
            if (!fs) continue;
            const m = fs.cost || 0;
            if (m <= 0) continue;
            cx += f.x * m; cy += f.y * m; w += m;
            uyeler.push(f);
        }
        if (!w || uyeler.length < PRO_AD_MIN_KUME) return false;          // korunacak kütle yok → mevcut davranış
        cx /= w; cy /= w;
        // KÜTLE YARIÇAPI: en uzak %25'i dışarıda bırakan yarıçap (tek aykırı birim şemsiyeyi sürüklemesin)
        const mesafeler = uyeler.map(f => Math.hypot(f.x - cx, f.y - cy)).sort((a, b) => a - b);
        const kutleR = mesafeler[Math.floor(mesafeler.length * 0.75)] || 0;

        // 2) DÜŞMAN HAVA MENZİLİ: görülen düşman hava birimlerinin en uzun hava→yer menzili.
        //    Görülmüyorsa varsayılan (PRO_AD_VARSAYILAN_TEHDIT) — helo zaten çoğu zaman görünmüyor (%3.8).
        let dusMenzil = 0;
        for (const e of SIM.units) {
            if (e.dead || e.loaded || e.abandoned || e.isRed === this.isRed || !e.isAir) continue;
            const es = STATS[e.type];
            for (const wp of ((es && es.weapons) || [])) {
                if (Array.isArray(wp.targets) && wp.targets.includes('ground')) dusMenzil = Math.max(dusMenzil, wp.range || 0);
            }
        }
        if (dusMenzil <= 0) dusMenzil = PRO_AD_VARSAYILAN_TEHDIT;

        // 3) TEHDİT EKSENİ: kütleden düşman kara kütlesine doğru (helo düşman tarafından gelir).
        let ex = 0, ey = 0, ew = 0;
        for (const e of SIM.units) {
            if (e.dead || e.loaded || e.abandoned || e.isRed === this.isRed || e.isAir) continue;
            const es = STATS[e.type];
            const m = (es && es.cost) || 0;
            if (m <= 0) continue;
            ex += e.x * m; ey += e.y * m; ew += m;
        }
        let ux, uy;
        if (ew) {
            ex /= ew; ey /= ew;
            const d = Math.hypot(ex - cx, ey - cy);
            if (d < 1) return false;
            ux = (ex - cx) / d; uy = (ey - cy) / d;
        } else {                                                          // düşman kara birimi görünmüyor → harita ekseni
            uy = this.isRed ? 1 : -1; ux = 0;
        }

        // 4) GEREKEN İLERİ MESAFE — geometriden, sabit değil
        const gereken = kutleR + dusMenzil;
        let ileri = gereken - benimMenzil;
        if (ileri <= 0) return false;                                     // zarf zaten yetiyor → mevzi bozma
        ileri = Math.min(ileri, PRO_AD_MAX_ILERI);

        // 5) GÜVENLİK: silahlı düşman KARA birimi çok yakınsa ilerleme (AD'nin %28'lik yokluğu ölümcül)
        for (const e of SIM.units) {
            if (e.dead || e.loaded || e.abandoned || e.isRed === this.isRed || e.isAir) continue;
            const es = STATS[e.type];
            if (!es || !es.weapons || !es.weapons.length) continue;
            if (Math.hypot(e.x - this.x, e.y - this.y) <= PRO_AD_TEHDIT) return false;
        }

        const hx = cx + ux * ileri, hy = cy + uy * ileri;
        const d = Math.hypot(hx - this.x, hy - this.y);
        if (d <= PRO_AD_OLU_BOLGE) {                                      // yerinde → dur (titreme önleyici)
            this.targetX = this.x; this.targetY = this.y;
        } else {
            this.targetX = hx; this.targetY = hy;
        }
        this.isMovingToManualTarget = true;
        this._pressingAssault = 0;
        if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) {
            BATTLE_BALANCE.adUmbrellaBind = (BATTLE_BALANCE.adUmbrellaBind || 0) + 1;
        }
        return true;
    }

    // ── INTEL4-PRO 'jammerUmbrella': JAMMER KENDİ DEĞERLİ KÜMESİNİN ÜSTÜNE ŞEMSİYE KURAR ──
    // KULLANICI DOKTRİNİ ("şemsiye taktiğini uygulaması en iyisi, ben de onu uyguluyorum").
    // #29 jammerPost ELENDİ çünkü dronu KOVALAMAK jammer'ı öldürüyordu (kapsama %13→%6.8,
    // ölüm 120sn→45sn). Bu, tersi: dron zaten BİZİM yumuşak-değerli kümemize geliyor —
    // topçu/ÇNRA/havan, komuta aracı, ikmal, radar. Jammer oraya oturursa dron KENDİ AYAĞIYLA
    // baloncuğa girer; jammer da kendi hattının gerisinde güvende kalır.
    // 700px'lik yeni yarıçap (kullanıcı denge kararı) dron kovalamaya YETMEZ ama kendi
    // kümesini örtmeye RAHAT yeter — bu yüzden tek makul tasarım budur.
    // Determinist: maliyet-ağırlıklı merkez, RNG yok. Dönüş: true ise hareketi devraldı.
    _jammerSemsiye() {
        if (typeof battleProDelta !== 'function' || !battleProDelta(this.isRed, 'jammerUmbrella')) return false;
        if (this.dead || this.loaded || this.abandoned || this.isFleeing) return false;
        if (this.controlOwner === 'PLAYER' || !this.speed || this._returningToBase) return false;
        const st = STATS[this.type];
        const aura = st && st.aura;
        if (!aura || aura.type !== 'jamming') return false;
        const TP = (typeof TILE_PX !== 'undefined') ? TILE_PX : 100;
        const R = (aura.radius || 3) * TP;

        // KORUNACAK KÜME: dronun hedef aldığı YUMUŞAK-DEĞERLİ dostlar —
        // dolaylı ateş (topçu/ÇNRA/havan) + silahsız destek (komuta/ikmal/radar/EH). Maliyetle ağırlıklı.
        let cx = 0, cy = 0, w = 0;
        for (const f of SIM.units) {
            if (f.dead || f.loaded || f.abandoned || f.isRed !== this.isRed || f === this) continue;
            const fs = STATS[f.type];
            if (!fs) continue;
            const silahsiz = !fs.weapons || !fs.weapons.length;
            const dolayli = !!(fs.weapons && fs.weapons[0] && fs.weapons[0].indirect);
            if (!silahsiz && !dolayli) continue;                    // muharip hattı korumak jammer'ın işi değil
            const m = fs.cost || 0;
            if (m < PRO_JAM_HVT_MIN_TL) continue;                   // ucuz birim için mevzi bozulmaz
            cx += f.x * m; cy += f.y * m; w += m;
        }
        if (!w) return false;                                       // korunacak küme yok → mevcut davranış
        cx /= w; cy /= w;

        // GÜVENLİK: silahsız 300hp. Görülen düşman ateşli KARA birimi çok yakınsa ilerleme.
        for (const e of SIM.units) {
            if (e.dead || e.loaded || e.abandoned || e.isRed === this.isRed || e.isAir) continue;
            const es = STATS[e.type];
            if (!es || !es.weapons || !es.weapons.length) continue;
            if (Math.hypot(e.x - this.x, e.y - this.y) <= PRO_JAM_TEHDIT) return false;
        }

        const d = Math.hypot(cx - this.x, cy - this.y);
        if (d <= R * PRO_JAM_SEMSIYE_ICERI) {                       // küme zaten örtülü → dur (sürüklenme yok)
            this.targetX = this.x; this.targetY = this.y;
        } else {
            const t = (d - R * PRO_JAM_SEMSIYE_ICERI) / d;
            this.targetX = this.x + (cx - this.x) * t;
            this.targetY = this.y + (cy - this.y) * t;
        }
        this.isMovingToManualTarget = true;
        this._pressingAssault = 0;
        if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) {
            BATTLE_BALANCE.jammerUmbrellaBind = (BATTLE_BALANCE.jammerUmbrellaBind || 0) + 1;
        }
        return true;
    }

    // ── INTEL4-PRO 'jammerPost': JAMMER KENDİNİ DRON TRAFİĞİNE KONUŞLANDIRIR ──
    // KULLANICI TEŞHİSİ ("güçlü bir araç ama jammeri iyi konuşlandıramıyor") ÖLÇÜMLE ONAYLANDI
    // (tools/jammer-konum-teshis.js, seed2024): düşman dron örneklerinin yalnız %5.2'si jam
    // baloncuğunda; jammer en yakın düşman drona ortalama 1749px uzakta, oysa baloncuk 1143px.
    // Yani ~600px yanlış yerde duruyor. Üstelik hiç ölmüyor (derinlik 0.42, kendi yarısı) —
    // öne çıkmak için hem yer hem güvenlik var.
    // Kural: GÖRÜLEN düşman jammable birimlerin merkezini baloncuğa al; düşman ateşinden uzak dur;
    // kendi yarısının ötesine tavan koy. Determinist: yalnız mesafe + canSee (RNG yok).
    // Dönüş: true ise hareketi devraldı.
    _jammerKonuslan() {
        if (typeof battleProDelta !== 'function' || !battleProDelta(this.isRed, 'jammerPost')) return false;
        if (this.dead || this.loaded || this.abandoned || this.isFleeing) return false;
        if (this.controlOwner === 'PLAYER' || !this.speed || this._returningToBase) return false;
        const st = STATS[this.type];
        const aura = st && st.aura;
        if (!aura || aura.type !== 'jamming') return false;
        const TP = (typeof TILE_PX !== 'undefined') ? TILE_PX : 100;
        const R = (aura.radius || 3) * TP;

        // HEDEF: GÖRÜLEN düşman jammable birimlerin (dron/İHA) merkezi. Görülmeyeni kullanmak
        // kusursuz-bilgi olurdu — canSee ile sınırlı tutuluyor (AI'ın geri kalanıyla tutarlı).
        let cx = 0, cy = 0, n = 0;
        for (const e of SIM.units) {
            if (e.dead || e.loaded || e.abandoned || e.isRed === this.isRed || !e.jammable) continue;
            if (typeof canSee === 'function' && !canSee(this.isRed, e.x, e.y, e.isAir)) continue;
            cx += e.x; cy += e.y; n++;
        }
        if (!n) return false;   // görünür dron yok → mevcut davranış sürsün
        cx /= n; cy /= n;

        // GÜVENLİK: jammer SİLAHSIZ (300hp). Görülen düşman ATEŞLİ KARA birimine PRO_JAM_TEHDIT'ten
        // yakınsa ilerlemez — 480₺'yi bedavaya vermek kapsamadan daha pahalı.
        for (const e of SIM.units) {
            if (e.dead || e.loaded || e.abandoned || e.isRed === this.isRed || e.isAir) continue;
            const es = STATS[e.type];
            if (!es || !es.weapons || !es.weapons.length) continue;
            if (Math.hypot(e.x - this.x, e.y - this.y) <= PRO_JAM_TEHDIT) return false;
        }

        const d = Math.hypot(cx - this.x, cy - this.y);
        if (d <= R * PRO_JAM_ICERI) {   // merkez zaten baloncukta → dur, sürüklenme
            this.targetX = this.x; this.targetY = this.y;
            this.isMovingToManualTarget = true;
            if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) BATTLE_BALANCE.jammerPostBind = (BATTLE_BALANCE.jammerPostBind || 0) + 1;
            return true;
        }
        // Merkezi baloncuğa alacak kadar yaklaş (üstüne gitme).
        const t = (d - R * PRO_JAM_ICERI) / d;
        let hx = this.x + (cx - this.x) * t, hy = this.y + (cy - this.y) * t;
        // DERİNLİK TAVANI: kendi üssünden düşman üssüne doğru bu kesri aşma (silahsız birim istila etmez).
        const derin = this.isRed ? hy / WORLD_H : 1 - hy / WORLD_H;
        if (derin > PRO_JAM_DERINLIK) hy = this.isRed ? WORLD_H * PRO_JAM_DERINLIK : WORLD_H * (1 - PRO_JAM_DERINLIK);
        this.targetX = hx; this.targetY = hy;
        this.isMovingToManualTarget = true;
        this._pressingAssault = 0;
        if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) BATTLE_BALANCE.jammerPostBind = (BATTLE_BALANCE.jammerPostBind || 0) + 1;
        return true;
    }

    // ── INTEL4-PRO 'heloHunt': HAVA VURUCU AVLANIR (AA'nın örtmediği hedefe gider) ──
    // TEŞHİS (tools/helo-teshis.js, 3 tohum, pro AÇIK): SALDIRAN taarruz helosu ömrünün yalnız
    // %3-12'sinde menzilinde hedef buluyor (savunan helo %46-62) ve 12/12 mühimmatla, yani TAM YÜKLE
    // ölüyor. 800₺'lik birim maçta 1-2 atış yapıyor. Konumlandırma sorunu DEĞİL: ateşlerinin ortalaması
    // menzilinin %92'sinden ve AA zarfında geçirdiği süre %0-1 (yani standoff/SEAD zaten çalışıyor).
    // Eksik olan AVLANMA: helo ana kuvvetle birlikte oyalanıyor, hedefin bulunduğu yere GİTMİYOR.
    // Kural: menzilinde hedef yokken, düşman AA'sının ÖRTMEDİĞİ en yakın düşmana yaklaş.
    // AA örtüsü hem hedefin hem kendi konumunun çevresinde kontrol edilir → SEAD disiplini bozulmaz.
    // Dönüş: true ise hareketi devraldı.
    _heloAvlan() {
        if (typeof battleProDelta !== 'function' || !battleProDelta(this.isRed, 'heloHunt')) return false;
        if (this.dead || this.loaded || this.abandoned || this.isFleeing) return false;
        if (this.controlOwner === 'PLAYER' || !this.isAir || this._returningToBase) return false;
        const st = STATS[this.type];
        if (!st || st.singleUse || !st.weapons || !st.weapons.length) return false;   // kamikaze/nakliye bu kuralın konusu değil
        if (this.maxAmmo > 0 && this.ammo <= 0) return false;                          // kuru helo avlanmaz, üsse döner

        // Menzilinde vurabileceği hedef VARSA avlanma — zaten iş başında.
        for (const e of SIM.spatialGrid.getNearby(this.x, this.y, this.range)) {
            if (e.dead || e.loaded || e.abandoned || e.isRed === this.isRed) continue;
            if (typeof unitCanEngage === 'function' && !unitCanEngage(st, STATS[e.type])) continue;
            if (Math.hypot(e.x - this.x, e.y - this.y) <= this.range) { this._avBekle = 0; return false; }
        }
        // Kısa boşluklarda hemen fırlama (hedef yeni öldü, bir sonraki tikte yenisi girebilir).
        this._avBekle = (this._avBekle || 0) + 1;
        if (this._avBekle < PRO_HELO_BEKLE_TIK) return false;

        // Düşman AA'sının canlı listesi (bir kez topla — hem hedef hem kendi konumu için kullanılır).
        const aa = [];
        for (const e of SIM.units) {
            if (e.dead || e.loaded || e.abandoned || e.isRed === this.isRed) continue;
            const es = STATS[e.type];
            if (es && (es.roleTags || []).includes('anti_air')) aa.push(e);
        }
        const aaOrtuyor = (x, y) => {
            for (const a of aa) if (Math.hypot(a.x - x, a.y - y) <= PRO_HELO_AA_KACIN) return true;
            return false;
        };
        if (aaOrtuyor(this.x, this.y)) return false;   // SEAD: kendi üstümde AA varsa avlanma, mevcut kaçış davranışı sürsün

        // AA'nın örtmediği EN YAKIN vurulabilir düşman. Eşitlikte id küçük olan (determinist).
        let hx = null, hy = null, hd = Infinity, hid = Infinity;
        for (const e of SIM.units) {
            if (e.dead || e.loaded || e.abandoned || e.isRed === this.isRed) continue;
            if (typeof unitCanEngage === 'function' && !unitCanEngage(st, STATS[e.type])) continue;
            const d = Math.hypot(e.x - this.x, e.y - this.y);
            if (d >= hd && !(d === hd && e.id < hid)) continue;
            if (aaOrtuyor(e.x, e.y)) continue;
            hd = d; hx = e.x; hy = e.y; hid = e.id;
        }
        if (hx == null) return false;   // her hedef AA örtüsünde → mevcut davranış (bekle/SEAD) sürsün

        // Hedefin üstüne binme: kendi menzilinin PRO_HELO_YAKLAS kesrine kadar yaklaş.
        const dur = this.range * PRO_HELO_YAKLAS;
        if (hd > dur) {
            const t = (hd - dur) / hd;
            this.targetX = this.x + (hx - this.x) * t;
            this.targetY = this.y + (hy - this.y) * t;
        } else {
            this.targetX = this.x; this.targetY = this.y;
        }
        this.isMovingToManualTarget = true;

        if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) {
            BATTLE_BALANCE.heloHuntBind = (BATTLE_BALANCE.heloHuntBind || 0) + 1;
        }
        return true;
    }

    // ── INTEL4-PRO 'resupplyRun': KURUYAN BİRİM İKMALE GİDER ──
    // TEŞHİS (tools/muhimmat-teshis.js, seed2024): 8 tanksavar timi ÖMRÜNÜN %71-77'sini KURU geçiriyor
    // (84sn'de kuruyup maçın sonuna kadar boş şarjörle geziyorlar); toplam kuru-tik oranı %19.2.
    // Kuruyken en yakın ikmal aracı 1100-1600px uzakta ve kamyonun ikmal halesi yalnız 400px —
    // yani ikmal PASİF: kimse kimseye gitmiyor, birim rastgele yaklaşırsa doluyor.
    // Kural: kuruyan birim en yakın CANLI dost ikmal kaynağına yürür, dolunca göreve döner.
    // Histerezis (_ikmalYolunda) salınımı engeller. Determinist: yalnız mesafe + id-eşitlik bozucu.
    // Dönüş: true ise hareketi devraldı (standoff'u ezer — kuru birim zaten ateş edemez).
    _ikmaleGit() {
        if (typeof battleProDelta !== 'function' || !battleProDelta(this.isRed, 'resupplyRun')) return false;
        if (this.dead || this.loaded || this.abandoned || this.isFleeing) return false;
        if (this.controlOwner === 'PLAYER') return false;
        if (!this.speed || !this.maxAmmo) return false;
        const st = STATS[this.type];
        if (st && st.aura && st.aura.type === 'resupply') return false;   // ikmal aracının kendisi gitmez

        const oran = this.ammo / this.maxAmmo;
        if (this._ikmalYolunda && oran >= PRO_RESUPPLY_BIRAK) { this._ikmalYolunda = false; return false; }   // doldu → göreve dön
        if (!this._ikmalYolunda && oran > PRO_RESUPPLY_ESIK) return false;                                    // henüz kurumadı

        // En yakın CANLI dost ikmal kaynağı (araç halesi VEYA ikmal veren siper). Eşitlikte id küçük olan.
        const TP = (typeof TILE_PX !== 'undefined') ? TILE_PX : 35;
        let hx = null, hy = null, hd = Infinity, hr = 0, hid = Infinity;
        for (const u of SIM.units) {
            if (u.dead || u === this || u.isRed !== this.isRed) continue;
            const a = STATS[u.type] && STATS[u.type].aura;
            if (!a || a.type !== 'resupply') continue;
            const d = Math.hypot(u.x - this.x, u.y - this.y);
            if (d < hd || (d === hd && u.id < hid)) { hd = d; hx = u.x; hy = u.y; hr = (a.radius || 3) * TP; hid = u.id; }
        }
        if (SIM.trenches) {
            for (const t of SIM.trenches) {
                if (t.isRed !== this.isRed || t.providesSupply === false || t.destroyed) continue;
                const d = Math.hypot(t.x - this.x, t.y - this.y);
                if (d < hd) { hd = d; hx = t.x; hy = t.y; hr = t.r || (t.radius ? t.radius * TP : 3 * TP); hid = Infinity; }
            }
        }
        if (hx == null || hd > PRO_RESUPPLY_MAX_MESAFE) { this._ikmalYolunda = false; return false; }   // ulaşılabilir kaynak yok

        this._ikmalYolunda = true;
        if (hd <= hr * PRO_RESUPPLY_ICERI) {   // halenin içindeyiz → dur ve dol (kaynağın üstüne binme)
            this.targetX = this.x; this.targetY = this.y;
        } else {
            this.targetX = hx; this.targetY = hy;
        }
        this.isMovingToManualTarget = true;
        this._pressingAssault = 0;

        if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) {
            BATTLE_BALANCE.resupplyBind = (BATTLE_BALANCE.resupplyBind || 0) + 1;
        }
        return true;
    }

    // ── INTEL4-PRO 'standoff': ÖLÜ-BÖLGE YÖNETİMİ ──
    // Uzun ölü-bölgeli ateş-desteği birimi (ÇNRA 600px, balistik 1500px) tehdit ölü-bölgeye girdiğinde ateş
    // EDEMEZ hale gelir ve orada ölür. TEŞHİS: balistik 0 atışla 125sn'de öldü (bkz. BATTLE_INTEL4PRO_DELTAS.standoff).
    // Bu metot engageCombat'tan SONRA çalışır → bu tikin atışı zaten yapıldı, yalnız HAREKET hedefi ezilir.
    // Determinist: yalnız mesafe aritmetiği, RNG yok, canlı kontrolör nesnesi okunmaz.
    _komutaMerkez() {
        // KOMUTA MERKEZI (pro-delta 'commandCenter') — OLCULDU (tools/komuta-teshis.js, 3 tohum):
        // komuta araci hizi 1.5 oldugu icin dost kutle merkezinin ort. 436px ARKASINDA kaliyor.
        // Ilk sezgim "geri cekelim, HVT korunsun" idi; KARSI-OLGU beni yalanladi: 500px daha geri
        // cekmek kapsamayi %83 -> %48 dusuruyordu. Tersi dogru: tam merkezde otursa kapsama
        // %83 -> %92 olurdu ve arac kendi birliklerinin ICINDE, yalniz degil, kalirdi (onu
        // tanksavar+MBT, yani DOGRUDAN atis zirhlisi olduruyor).
        // TITREME DERSI (bkz. ferry): olu bolge disinda hedef her tik yeniden yazilmaz.
        if (typeof battleProDelta !== 'function' || !battleProDelta(this.isRed, 'commandCenter')) return false;
        if (this.dead || this.loaded || this.abandoned || this.isFleeing) return false;
        if (this.controlOwner === 'PLAYER') return false;   // oyuncunun emrini ezmeyiz
        const _a = STATS[this.type] && STATS[this.type].aura;
        if (!_a || _a.type !== 'command') return false;
        let cx = 0, cy = 0, cn = 0;
        for (const u of SIM.units) {
            if (u.dead || u.loaded || u.abandoned || u.isRed !== this.isRed || u === this) continue;
            const v = (STATS[u.type] && STATS[u.type].cost) || 0;
            if (!v) continue;
            cx += u.x * v; cy += u.y * v; cn += v;
        }
        if (!cn) return false;
        const gx = cx / cn, gy = cy / cn;
        const d = Math.hypot(gx - this.x, gy - this.y);
        if (d <= PRO_KOMUTA_OLU_BOLGE) {   // yeterince merkezdeyiz -> DUR (titreme yok)
            this.targetX = this.x; this.targetY = this.y;
            this.manualMoveTarget = null; this.isMovingToManualTarget = false;
            return true;
        }
        this.targetX = gx; this.targetY = gy;
        this.manualMoveTarget = { x: gx, y: gy }; this.isMovingToManualTarget = true;
        return true;
    }
    _standoffKac() {
        if (typeof battleProDelta !== 'function' || !battleProDelta(this.isRed, 'standoff')) return;
        if (this.dead || this.loaded || this.abandoned || this.isFleeing) return;
        if (this.controlOwner === 'PLAYER') return;   // oyuncunun emrini ezmeyiz
        if (!this.speed || this.isAir) return;        // yürüyemeyen/uçan bu kuralın konusu değil
        const st = STATS[this.type];
        const minR = st ? (st.minRange || 0) : 0;
        if (minR < PRO_STANDOFF_MIN_PX) return;       // kısa ölü-bölge (havan/obüs) zaten sorunsuz ateş ediyor

        // TEHDİT KÜTLESİ: ölü bölgeye girmiş (veya girmek üzere olan) düşmanların merkezi. Tekil "en yakın"
        // yerine kütle kullanılır → iki yönden gelen baskıda salınım (bir o yana bir bu yana) olmaz.
        const trip = minR * PRO_STANDOFF_TRIP;
        let tx = 0, ty = 0, n = 0, enYakin = Infinity;
        for (const e of SIM.spatialGrid.getNearby(this.x, this.y, trip)) {
            if (e.dead || e.loaded || e.abandoned || e.isRed === this.isRed) continue;
            const d = Math.hypot(e.x - this.x, e.y - this.y);
            if (d > trip) continue;
            tx += e.x; ty += e.y; n++;
            if (d < enYakin) enYakin = d;
        }
        if (!n) { this._standoffAktif = false; return; }

        // Geri çekilme yönü: tehdit kütlesinden UZAĞA. Merkez tam üstümüzdeyse (dejenere) hareket etme.
        const cx = tx / n, cy = ty / n;
        let vx = this.x - cx, vy = this.y - cy;
        let vl = Math.hypot(vx, vy);
        if (vl < 1e-6) { this._standoffAktif = false; return; }
        vx /= vl; vy /= vl;

        // Ne kadar geri? Kütleye olan mesafeyi minR×HEDEF'e çıkaracak kadar — ama menzil×TAVAN'ı aşmadan
        // (kendi azami menzilinden geriye kaçmak atışı yine keser) ve tek seferde ADIM'dan fazla değil.
        const dKutle = Math.hypot(this.x - cx, this.y - cy);
        const istenen = Math.min(minR * PRO_STANDOFF_HEDEF, this.range * PRO_STANDOFF_TAVAN);
        if (dKutle >= istenen) { this._standoffAktif = false; return; }
        const geri = Math.min(istenen - dKutle, PRO_STANDOFF_ADIM);

        this.targetX = this.x + vx * geri;
        this.targetY = this.y + vy * geri;
        this.isMovingToManualTarget = true;
        this._pressingAssault = 0;          // taarruz değil, mevzi değiştirme
        this._standoffAktif = true;

        // TEŞHİS SAYAÇLARI (BATTLE_BALANCE gate'li, hash-dışı — sim'i etkilemez)
        if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) {
            BATTLE_BALANCE.standoffBind = (BATTLE_BALANCE.standoffBind || 0) + 1;
            if (enYakin < minR) BATTLE_BALANCE.standoffOluBolge = (BATTLE_BALANCE.standoffOluBolge || 0) + 1;   // fiilen ateş edemez durumdaydı
        }
    }

    // T3 PUSU: ormanda + yeni ateş etmemiş + kaçmıyor → gizli (sadece AMBUSH_DETECT içinden fark edilir)
    isConcealed() {
        if (this.revealTimer > 0 || this.isFleeing) return false;
        if (this.inForest) return true;   // orman herkesi gizler
        // AÇIK-ALAN GİZLİLİĞİ: yüksek stealth-statlı birim (komando 0.85) açık alanda da sızıcı/pusucu (ateş edince açığa çıkar)
        const st = STATS[this.type];
        if (st && st.stealth >= 0.75) return true;
        // PUSU yeteneği (ambush/stay_hidden): mevzide ≥2sn bekleyen birim gizli (ilk-atış AMBUSH bonusu; tanksavar timi kimliği)
        return !!(this._canAmbush && this._stationaryT > 2);
    }

    /* Bu hedefe yaklaşma/ateş kararında kullanılacak menzil. `this.range` en uzun
       silahın menzilidir; hedefi o silah vuramıyorsa yanıltıcıdır (SİHA 900'de durup
       600'lük hava-hava füzesini hiç kullanamıyordu). Komuta-halesi menzil artışı
       korunur: sonuç asla this.range'i aşmaz. */
    engageRangeFor(target) {
        if (typeof BATTLE_ANGAJMAN_MENZIL !== 'undefined' && !BATTLE_ANGAJMAN_MENZIL) return this.range;   // A/B kolu: eski davranış
        if (!target || typeof unitEngageRange !== 'function') return this.range;
        const er = unitEngageRange(STATS[this.type], STATS[target.type]);
        return er > 0 ? Math.min(this.range, er) : this.range;
    }

    findBestVisibleEnemy() {
        let bestTarget = null;
        let bestScore = -Infinity;

        const nearby = SIM.spatialGrid.getNearby(this.x, this.y, this.range * 1.5);
        const __as = STATS[this.type], __minR = __as ? (__as.minRange || 0) : 0;
        // FAZ-SAVUNMA (analist anti-mızrak): SAVUNAN, gelen MBT/TD-mızrağına ODAKLANIR (2-3 MBT ≈ 2500-3000₺ yoğun-değer;
        // dağılmak yerine kilitlen → mission-kill: HP<%30+kritik = %55 terk → öldürmek şart değil, terk-ettir). Gated 'defense'.
        const _spearFocus = (typeof SIM !== 'undefined' && SIM.battle && (this.isRed !== (SIM.battle.attackerSide === true)) &&
            typeof battleDelta === 'function' && battleDelta(this.isRed, 'defense'));
        for (const u of nearby) {
            if (u.dead || u.isRed === this.isRed) continue;
            // TERK EDİLMİŞ araç NÖTR → normalde hedeflenmez. İSTİSNA: imha GEREKÇESİ varsa (düşman
            // istihkâmı tamire geliyor / zemin düşmanın) hedeflenebilir — yoksa AI, oyuncunun bilerek
            // patlatabildiği ganimeti hiç savunamaz (kullanıcı: "AI dezavantajlı olurdu").
            if (u.abandoned && !(battleTeslimAtesKes() && battleTeslimImhaGerekce(this.isRed, u))) continue;
            // HAVA/KARA UYGUNLUĞU: vuramayacağın hedefi hiç edinme (tank→hava=0, SAM→kara=0). Veri-güdümlü (weapon.targets).
            if (typeof unitCanEngage === 'function' && !unitCanEngage(__as, STATS[u.type])) continue;

            const d = Math.hypot(u.x - this.x, u.y - this.y);
            if (d > this.range * 1.5) continue;
            /* HOLD_FIRE (pusu disiplini): yalnız %70 menzilde ateşle — AMA MENZİL
               ÜSTÜNLÜĞÜN YOKSA. Sabır, düşman zaten sana gelmek zorundayken anlamlıdır;
               onu senden UZAKTAN vuramadığı için beklersin. Sen daha uzağa atabiliyorsan
               beklemek üstünlüğü karşılıksız teslim etmektir.
               ÖLÇÜLDÜ (TD 675 menzil vs MBT 450, aynı tohum, 1v1):
                 hold_fire açık  → ilk atış 462px → TD ÖLÜR   (tank 68 hp sağ)
                 hold_fire kapalı→ ilk atış 666px → TANK ÖLÜR (TD 198 hp sağ)
               hold_fire, TD'nin 225px'lik menzil üstünlüğünü 22px'e indiriyordu.
               MANPADS'ta kural DEĞİŞMEZ: menzili 825, taarruz helosununki 900 →
               üstünlüğü yok, pusu disiplini onun için hâlâ doğru. */
            if (this._canHoldFire && d > this.range * 0.7) {
                let _ustunluk = false;
                if (battleHoldFireStandoff() && typeof unitEngageRange === 'function') {
                    const _benim = this.engageRangeFor(u);
                    const _onun = unitEngageRange(STATS[u.type], STATS[this.type]);
                    _ustunluk = _benim > _onun;
                }
                if (!_ustunluk) continue;
            }
            if (this.groundRange > 0 && !u.isAir && d > this.groundRange) continue;   // KARA-MENZİL SINIRI: SPAAG karaya yalnız kısa menzilden (hava menzili tam)
            if (__minR > 0 && d < __minR) continue;   // MİN-MENZİL ölü-bölge: havan/topçu yakına vuramaz (komando bunu sömürür)

            const _visR = this.vision * (1 + Math.max(0, (this.elevation || 0.5) - 0.45) * 0.55);   // T2: yüksekte görüş artar
            if (d > _visR && !canSee(this.isRed, u.x, u.y, u.isAir)) continue;   // radar hava hedefini açar → SAM/SPAAG uzaktan tayin eder
            if (u.isConcealed && u.isConcealed() && d > AMBUSH_DETECT * (1 + this._detect * 1.5)) continue;   // DETECT: yüksek-detect birim gizli düşmanı daha uzaktan hedefler
            
            // YALNIZ-DOST LOS: düşman gövdeleri engel DEĞİL → en yakın (öndeki) düşman edinilir; sadece kendi
            // adamının perdelediği hedef atlanır (üstünden vurma). "Öndekini vur, arkadakine uğraşma."
            if (!this.isIndirect && !checkLineOfSight(this.x, this.y, u.x, u.y, this, u, this.isRed)) continue;
            
            // COUNTER-AĞIRLIKLI SEÇİM: "hangi birim hangiye" — counter'ladığın hedefi tercih et, yakınlık ikincil.
            // Tanksavar mek/zırhı (×4), piyade yumuşağı seçer; piyade mekanizeye boşuna erimez. Topçu sabit (nearest).
            let sc;
            if (this.isIndirect) {
                // INTEL4-PRO 'indirectMassing': mermi başına DEĞER. Varsayılan davranış en-yakın hedefe atmaktı
                // ("splash zaten alan") — ama şarjör 3-8 mermi ve ölçüldü ki savunanın topçu/havan/ÇNRA'sı t=60'ta
                // KURUYOR. Kütle-hedeflemesi: patlama yarıçapındaki düşman sayısını maksimize et, eşitlikte yakını seç.
                if (typeof battleProDelta === 'function' && battleProDelta(this.isRed, 'indirectMassing')) {
                    const _pwm = STATS[this.type] && STATS[this.type].weapons && STATS[this.type].weapons[0];
                    const _R = (_pwm && _pwm.aoe > 0) ? _pwm.aoe : ARTILLERY_SPLASH_RADIUS;
                    let _kutle = 0;
                    for (const n of SIM.spatialGrid.getNearby(u.x, u.y, _R)) {
                        if (n.dead || n.loaded || n.abandoned || n.isRed === this.isRed) continue;
                        if (Math.hypot(n.x - u.x, n.y - u.y) <= _R) _kutle++;
                    }
                    sc = _kutle * 100000 - d;   // önce kütle, eşitlikte yakınlık (determinist; RNG yok)
                    // KARŞI-BATARYA (kullanıcı doktrini): SALDIRANIN dolaylı ateşi, savunanın DOLAYLI birimlerini
                    // öncelikler — "toplu yürüyen saldırıyı yıpratan şey savunanın topçusu; önce onu sustur".
                    // Yalnız saldıran rolde: savunanın kendi topçusunu kovalaması hattı boş bırakır.
                    if (battleProDelta(this.isRed, 'counterBattery') && battleIsIndirectType(u.type)) {
                        const _cbp = (SIM.ctrlPosture && this.controllerId) ? SIM.ctrlPosture[this.controllerId] : null;
                        if (_cbp && _cbp.role === (typeof BATTLE_ROLE !== 'undefined' ? BATTLE_ROLE.ATTACKER : 'attacker')) sc += 400000;
                    }
                } else sc = -d;   // intel4 davranışı: en yakın/görülene
            }
            else {
                const arm = (typeof STATS !== 'undefined' && STATS[u.type]) ? STATS[u.type].armor : 0;
                let dmg = (typeof calculateUnitDamage === 'function') ? calculateUnitDamage(this.type, u.type, this.atk, arm) : this.atk;
                // HAVA-HAVA: calculateUnitDamage YALNIZ weapons[0]'ı okur. Helonun ATGM'i havaya 0 verir →
                // hava hedefi 0 puan alıp listenin sonuna düşerdi (kara hedefi bittiğinde ancak fark ederdi).
                // Birincil vuramıyorsa puanı vurabilen İKİNCİL silahtan hesapla → helo heloyu gerçekten AVLAR.
                if (dmg <= 0) dmg = this._ikincilHasar(u);
                sc = dmg / (1 + d * 0.012);   // counter-hasarı / yakınlık (yüksek=iyi eşleşme+yakın)
                // ── INTEL4-PRO 'killFocus': "SANİYEDE EN ÇOK DEĞER İMHA ET" ──
                // ÖLÇÜLDÜ (tools: ates dagilimi, 24 maç): yerel kümede 4.9 atıcı 1.8 AYRI hedefe atıyor
                // (oran 0.370) — iki beyinde de aynı. Sebebi burada: birim hedef skoru KALAN CANI HİÇ
                // OKUMUYOR (yalnız hasar/mesafe). Yaralı düşman ile tam canlı düşman aynı puanı alıyor,
                // dolayısıyla kimse bitirmeye yönelmiyor; herkes kendi "en iyi eşleşmesini" kovalıyor.
                // Ölçüt değer/ÖLDÜRME-SÜRESİ olunca odaklanma KENDİLİĞİNDEN doğar: bir hedef yaralandığı
                // an herkesin skorunda öne çıkar, ölür ve düşmanın ateş hacmi hemen düşer. Aşırı-öldürme
                // riski yok: hedef ölünce skordan çıkar, sıradakine geçilir. Determinist (RNG yok).
                if (typeof battleProDelta === 'function' && battleProDelta(this.isRed, 'killFocus') && dmg > 0) {
                    const _deger = (STATS[u.type] && STATS[u.type].cost) || 100;
                    const _kalan = Math.max(1, u.hp);
                    sc = (_deger * dmg / _kalan) / (1 + d * 0.012);   // birim zamanda imha edilen DEĞER
                }
                if (this._autoAir && u.isAir) sc *= 2.5;   // AUTO_ENGAGE_AIR: SPAAG önce havayı vurur (hava-savunma önceliği)
                if (_spearFocus && (u.type === T.ARMOR || u.type === T.TANK_HUNTER)) sc *= 2.8;   // SAVUNMA anti-mızrak: gelen MBT/TD'ye kilitlen
                // FAZ2 AV-PAKETİ ('drone'-delta): kamikaze/komando/arka-avcısı HVT'yi (destek/topçu/radar/AA/lojistik) ×3 tercih eder →
                // pahalı tek-kullanım varlığı ana-hatta harcanmaz (analist: kamikaze "yumak-cezalandırıcı"→"tekil-HVT-avcısı").
                if (this._hvtHunter && typeof battleDelta === 'function' && battleDelta(this.isRed, 'drone')) {
                    const _su = STATS[u.type] || {}, _rt = _su.roleTags || [];
                    if (_su.category === 'support' || _su.category === 'indirect' || _su.category === 'logistics' ||
                        _rt.includes('intel') || _rt.includes('air_search') || _rt.includes('anti_air')) sc *= 3;
                }
            }
            /* KARA BİRİMİ HAVAYI YALNIZ İKİNCİL SİLAHLA VURABİLİYORSA O HEDEF SON TERCİHTİR.
               Hedef edinme kapısı `unitCanEngage` (HERHANGİ silah), ateş kapısı ise
               `unitPrimaryCanEngage`. İkisi ayrışınca birim hedefe KİLİTLENİR ama birincil
               silahını ateşleyemez ("İkincil Silah" durumu). Tank makinelisi havaya
               açılınca MBT'nin helikoptere kilitlenip ANA TOPUNU boşa tutması bu yüzden
               mümkün oldu.

               KURAL DAR TUTULDU — yalnız KARA→HAVA. İlk denemede kural genel yazılmıştı;
               o hâliyle helo/SİHA'nın hava-hava füzesiyle vurduğu hedefi de düşürüyor ve
               tam da düzeltilmek istenen hava muharebesini baltalıyordu (hava birimi
               hedefe yaklaşmazsa 675/600px'lik füze menziline hiç giremez).
               NOT: ikincil silah zaten attackTarget'tan BAĞIMSIZ ateş eder
               (fireSecondaryWeapons) → bu düşürme makineliye ait ateşi engellemez. */
            if (u.isAir && (__as.domain || 'ground') === 'ground' &&
                typeof unitPrimaryCanEngage === 'function' && !unitPrimaryCanEngage(__as, STATS[u.type])) {
                sc = (sc > 0 ? sc * 0.02 : sc * 50) - 1e6;
            }
            if (sc > bestScore) {
                bestScore = sc;
                bestTarget = { unit: u, dist: d };
            }
        }
        return bestTarget;
    }

    // ATIŞ HATTI: tam önünde (dar koridor) bir DOST birlik varsa doğrudan-ateş yapamaz (kendi adamını vuramaz).
    // Topçu HARİÇ (havan/dolaylı ateş, üstünden aşar). Formasyonu anlamlı kılar: sıra ol, yığılma değil. Deterministik.
    friendlyLineBlocked(target) {
        const dx = target.x - this.x, dy = target.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) return false;
        const ux = dx / dist, uy = dy / dist;
        const half = UNIT_RADIUS * 1.15;   // dar koridor → sadece TAM önündeki dostu blokla (blob'u tıkamaz)
        const nearby = SIM.spatialGrid.getNearby((this.x + target.x) / 2, (this.y + target.y) / 2, dist / 2 + 50);
        for (const f of nearby) {
            if (f.dead || f === this || f === target || f.isRed !== this.isRed) continue;
            const px = f.x - this.x, py = f.y - this.y;
            const t = px * ux + py * uy;                       // shooter→target ekseninde izdüşüm
            if (t <= UNIT_RADIUS || t >= dist - UNIT_RADIUS * 0.5) continue;   // arada değil (kendi/hedef yakını hariç)
            const perp = Math.abs(-px * uy + py * ux);         // hattan dikey uzaklık
            if (perp < half) return true;                      // dost hattı kapatıyor → ateş edemez
        }
        return false;
    }

    // TEMİZ ADIM: önü dost-kapalı + temiz düşman yok → KÜÇÜK, İLERİ-ağırlıklı adımla ateş-hattına sokul.
    // Eski _seekClearShot 44px DİK kayıyordu (saçma yana-açılma + cephe genişlemesi). Bu: ileri 16 + yana 14
    // → arka-sıra öne dolar, geniş fan-out yok, boş beklemez. Zaten bir adıma gidip varmadıysa yeniden verme (jitter yok).
    _clearStep(target) {
        if (this.isMovingToManualTarget && this.manualMoveTarget &&
            Math.hypot(this.manualMoveTarget.x - this.x, this.manualMoveTarget.y - this.y) > UNIT_RADIUS) return;
        const dx = target.x - this.x, dy = target.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        const ux = dx / d, uy = dy / d, px = -uy, py = ux;
        let leftN = 0, rightN = 0;
        const nearby = SIM.spatialGrid.getNearby(this.x, this.y, 55);
        for (const f of nearby) { if (f.dead || f === this || f.isRed !== this.isRed) continue; const s = (f.x - this.x) * px + (f.y - this.y) * py; if (s > 0) leftN++; else rightN++; }
        const dir = leftN <= rightN ? 1 : -1;
        const nx = this.x + ux * 16 + px * dir * 14, ny = this.y + uy * 16 + py * dir * 14;
        const safe = (typeof terrainSafePoint === 'function') ? terrainSafePoint(nx, ny) : { x: nx, y: ny };
        this.targetX = safe.x; this.targetY = safe.y;
        this.manualMoveTarget = safe; this.isMovingToManualTarget = true;
    }

    // ÇOKLU-SİLAH: 2.+ silahlar (MBT eşgüdümlü makineli, komando yıkım-şarjı) BİRİNCİL saldırıdan bağımsız,
    // kendi menzil/rof/hedefiyle ateş eder → MBT tanka ana-topla + piyadeye makineliyle aynı anda vurur (birleşik-silah).
    // Beklenen-hasar (deterministik, RNG yok). Hedef seçimi id-eşitliğiyle deterministik.
    // İKİNCİL silahların bu hedefe karşı EN İYİ ham hasarı (0 = hiçbiri vuramaz). Determinist, RNG yok.
    // Hedef PUANLAMASI için: birincil silahın vuramadığı hedefin değeri buradan gelir.
    _ikincilHasar(target) {
        const ws = STATS[this.type] && STATS[this.type].weapons;
        const DM = (typeof UNITS_MODERN_DB !== 'undefined') ? UNITS_MODERN_DB.damageMatrix : null;
        if (!ws || ws.length < 2 || !DM) return 0;
        const dom = target.isAir ? 'air' : 'ground';
        const arm = STATS[target.type] ? STATS[target.type].armorType : 'infantry';
        let en = 0;
        for (let i = 1; i < ws.length; i++) {
            const w = ws[i];
            if (typeof weaponAktif === 'function' && !weaponAktif(w)) continue;
            if (!(w.targets || ['ground']).includes(dom)) continue;
            const eff = (DM[w.damageType] || {})[arm] || 0;
            if (eff <= 0) continue;
            const v = w.damage * (w.salvo || 1) * eff;
            if (v > en) en = v;
        }
        return en;
    }

    // ── SAM COKLU HEDEF (kullanici istegi 2026-08-09) ──
    // GEREKCE (kullanici): "2 helo ayni anda saldirdiginda hava ustunlugunu cok rahat kiriyor."
    // SAM'in ANA silahi tek seferde tek hedefe atiyordu; bu metod ANA silahla IKINCI bir HAVA
    // hedefine, ayri bekleme sayaci ve ayri muhimmat tuketimiyle ates eder. Toplam es-zamanli
    // hedef SAM_MAX_HEDEF (=2) ile sinirli. Kalip `fireSecondaryWeapons` ile AYNI (deferred-damage,
    // uzamsal-izgara, id ile esitlik bozma) → determinist, RNG yok.
    // KAPSAM: yalniz kategori 'air_defense' VE ana silahi havayi hedefleyebilen birim.
    _samCokluHedef(now, dtSec) {
        if (typeof BATTLE_SAM_MULTI_TARGET === 'undefined' || !BATTLE_SAM_MULTI_TARGET) return;
        if (this.dead || this.isFleeing || this.loaded || this.abandoned) return;
        const st = STATS[this.type];
        if (!st || st.category !== 'air_defense') return;
        const ws = st.weapons;
        if (!ws || !ws.length) return;
        const w = ws[0];
        if (!Array.isArray(w.targets) || !w.targets.includes('air')) return;
        if (typeof weaponAktif === 'function' && !weaponAktif(w)) return;
        const DM = (typeof UNITS_MODERN_DB !== 'undefined') ? UNITS_MODERN_DB.damageMatrix : null;
        if (!DM) return;
        const ekHedef = Math.max(0, (typeof SAM_MAX_HEDEF !== 'undefined' ? SAM_MAX_HEDEF : 2) - 1);
        if (ekHedef <= 0) return;

        const wr = w.range || 0; if (wr <= 0) return;
        const perShot = w.perShot > 0 ? w.perShot : 1;
        const kullanilan = new Set();
        if (this.attackTarget && !this.attackTarget.dead) kullanilan.add(this.attackTarget.id);

        for (let k = 0; k < ekHedef; k++) {
            const cdKey = '_samCd' + k;
            this[cdKey] = (this[cdKey] || 0) - dtSec;
            if (this[cdKey] > 0) continue;
            if (this.maxAmmo > 0 && this.ammo < perShot) return;      // kuru → ek atis yok
            const near = SIM.spatialGrid.getNearby(this.x, this.y, wr);
            let best = null, bestScore = -1;
            for (const n of near) {
                if (n.dead || n.loaded || n.abandoned || n.isRed === this.isRed) continue;
                if (!n.isAir) continue;                                // yalniz HAVA hedefi
                if (kullanilan.has(n.id)) continue;                    // ana hedef ve onceki ek hedef HARIC
                const d = Math.hypot(n.x - this.x, n.y - this.y);
                if (d > wr || (w.minRange && d < w.minRange)) continue;
                if (d > this.vision && !canSee(this.isRed, n.x, n.y, true)) continue;
                const arm = STATS[n.type] ? STATS[n.type].armorType : 'infantry';
                const eff = (DM[w.damageType] || {})[arm] || 0;
                if (eff <= 0) continue;
                const score = eff / (1 + d * 0.004);
                if (score > bestScore || (score === bestScore && best && n.id < best.id)) { bestScore = score; best = n; }
            }
            if (!best) continue;
            kullanilan.add(best.id);
            const arm = STATS[best.type] ? STATS[best.type].armorType : 'infantry';
            const eff = (DM[w.damageType] || {})[arm] || 0;
            const _bd = Math.hypot(best.x - this.x, best.y - this.y);
            let dmg = Math.max(1, Math.floor(w.damage * (w.salvo || 1) * eff * (this.xpBonus || 1) *
                weaponAccuracy(this, w, best, _bd) * incomingDamageMult(best)));
            if ((SIM.tick - (this.commandHaloTick || -999)) <= 1) dmg = Math.floor(dmg * 1.12);
            if (this._cmdShockUntil && SIM.tick < this._cmdShockUntil) dmg = Math.floor(dmg * 0.72);
            const _sTicks = battleFlightTicks(_bd, battleProjectileSpeed(this.type, true));
            SIM.pendingHits.push({
                kind: 'direct', evt: 'SECONDARY_FIRE',
                fireTick: (SIM.tick || 0), arriveTick: (SIM.tick || 0) + _sTicks, seq: SIM.pendingHitSeq++,
                atkId: this.id, atkType: this.type, atkIsRed: !!this.isRed, atkPower: this.atk * (this.xpBonus || 1),
                atkX: this.x, atkY: this.y,
                tgtId: best.id, dmg: dmg,
                isCrit: false, willAbandon: false, isRear: false, isFlank: false,
                flash: 4, panicMul: 80, supp: 0, knock: 0, splashR: 0,
                sparks: false, distress: false, xp: false
            });
            this[cdKey] = w.rof > 0 ? 1 / w.rof : 999;
            if (this.maxAmmo > 0) this.ammo = Math.max(0, this.ammo - perShot);
            if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) {
                BATTLE_BALANCE.samCokluBind = (BATTLE_BALANCE.samCokluBind || 0) + 1;
            }
            if (!SIM.headless && typeof spawnProjectile === 'function') {
                spawnProjectile(this.x, this.y, { x: best.x, y: best.y },
                    { homing: true, trail: true, impact: 'spark', color: '#bfe6ff', scale: 0.9,
                      speed: battleProjectileSpeed(this.type, true), maxLife: 3 });
            }
        }
    }

    /* ── DÜŞMAN ÜSSÜNÜ DÖV (kullanıcı 2026-08-16: "üssün canı olsun rakip üssü yıkabilsin") ──
       Üssün `hp`/`maxHp` alanı VARDI ama hiçbir yerde azalmıyordu: yapı yıkılamazdı,
       yalnız süresi dolunca silinirdi. Üs artık kalıcı olduğuna göre onu yıkmak da
       mümkün olmalı, yoksa kurulan her üs sonsuza dek durur.
       Veri zaten hazırdı: damageMatrix'te `structure` zırh tipi tanımlı ve bugüne dek
       HİÇ kullanılmamış (he 1.0 · shaped 0.9 · ap 0.6 · frag 0.2 · small_arms 0.1 ·
       sam 0.0). Yani topçu/ÇNRA üssü söker, tüfek neredeyse hiçbir şey yapmaz, SAM hiç.

       ÖNCELİK BİRİMDE: canlı birim hedefi varken yapıya dönülmez — aksi halde üs,
       ordunun ateşini üstüne çeken bir yem olurdu. */
    attackEnemyBase(now, dtSec) {
        if (this.dead || this.isFleeing || this.abandoned) return;
        if (!SIM.trenches || !SIM.trenches.length) return;
        const st = STATS[this.type];
        if (!st || !st.weapons || !st.weapons.length || st.singleUse) return;
        const w = st.weapons[0];
        if (typeof weaponAktif === 'function' && !weaponAktif(w)) return;
        if (!(w.targets || ['ground']).includes('ground')) return;   // yapı KARA hedeftir
        const DM = (typeof UNITS_MODERN_DB !== 'undefined') ? UNITS_MODERN_DB.damageMatrix : null;
        const eff = DM ? ((DM[w.damageType] || {}).structure || 0) : 0;
        if (eff <= 0) return;                                        // SAM yapıya işlemez
        if (this.maxAmmo > 0 && this.ammo <= 0) return;
        const menzil = this.groundRange > 0 ? Math.min(this.range, this.groundRange) : this.range;
        const minR = st.minRange || 0;

        /* ÖNCELİK BİRİMDE — ama yalnız DÖVEBİLDİĞİ birim hedefi varsa.
           İlk sürüm "attackTarget varsa çık" diyordu; ölçümde topçu, ölü bölgesindeki
           (minRange içi) bir birime kilitlenip 'Çok Yakın' durumunda donuyor ve üsse de
           ateş edemiyordu. Kilitli olmak, dövebiliyor olmak demek değil. */
        if (this.attackTarget && !this.attackTarget.dead) {
            const _t = this.attackTarget;
            const _td = Math.hypot(_t.x - this.x, _t.y - this.y);
            const _engellenmis =
                (minR > 0 && _td < minR) ||
                (typeof unitCanEngage === 'function' && !unitCanEngage(st, STATS[_t.type])) ||
                (_td > this.engageRangeFor(_t));
            if (!_engellenmis) return;
        }

        let hedef = null, hd = Infinity;
        for (const t of SIM.trenches) {
            if (t.isRed === this.isRed || t.hp == null || t.hp <= 0) continue;
            const d = Math.hypot(t.x - this.x, t.y - this.y);
            if (d > menzil || (minR > 0 && d < minR)) continue;
            if (d > this.vision && !canSee(this.isRed, t.x, t.y, false)) continue;   // görmediğini dövemez
            if (d < hd || (d === hd && hedef && (t.x + t.y) < (hedef.x + hedef.y))) { hd = d; hedef = t; }   // determinist
        }
        if (!hedef) return;

        let hiz = this.isPanicking ? this.atkSpeed * 1.5 : this.atkSpeed;
        if (this.suppression > PINNED_SUPPRESSION) hiz *= 2.4; else if (this.suppression > 50) hiz *= 1.5;
        if (now - this.lastAttackTime < hiz) return;
        this.lastAttackTime = now;
        this._hicAtesEtmedi = false;
        if (this.maxAmmo > 0) this.ammo = Math.max(0, this.ammo - 1);

        const dmg = Math.max(1, Math.floor(w.damage * (w.salvo || 1) * eff * (this.xpBonus || 1)));
        const oncekiHp = hedef.hp;
        hedef.hp -= dmg;
        this.combatState = 'Üs Dövüyor';
        if (typeof battleRecordCombatEvent === 'function') {
            battleRecordCombatEvent({
                kind: 'BASE_HIT', attackerId: this.id, attackerSide: this.isRed ? 'red' : 'blue',
                attackerType: this.type, targetId: -1, targetSide: hedef.isRed ? 'red' : 'blue',
                targetType: -1, damage: dmg, hpBefore: Math.round(oncekiHp),
                hpAfter: Math.round(Math.max(0, hedef.hp)), lethal: hedef.hp <= 0,
                attackerX: Math.round(this.x * 100) / 100, attackerY: Math.round(this.y * 100) / 100,
                targetX: Math.round(hedef.x * 100) / 100, targetY: Math.round(hedef.y * 100) / 100
            });
        }
        if (typeof BATTLE_CREDIT !== 'undefined' && BATTLE_CREDIT.on) battleKredi(this, 'hasar', Math.min(dmg, oncekiHp));
        if (!SIM.headless) {
            if (typeof spawnTracer === 'function') spawnTracer(this.x, this.y, hedef.x, hedef.y, !!this.isIndirect);
            if (hedef.hp <= 0 && typeof spawnExplosion === 'function') spawnExplosion(hedef.x, hedef.y, 2.2);
        }
        // hp<=0 olan yapıyı updateTrenches (sim tarafı) siler — burada listeye dokunulmaz.
    }

    fireSecondaryWeapons(now, dtSec) {
        const ws = STATS[this.type] && STATS[this.type].weapons;
        if (!ws || ws.length < 2 || this.isFleeing || this.dead) return;
        const DM = (typeof UNITS_MODERN_DB !== 'undefined') ? UNITS_MODERN_DB.damageMatrix : null;
        if (!DM) return;
        for (let wi = 1; wi < ws.length; wi++) {
            const w = ws[wi];
            if (typeof weaponAktif === 'function' && !weaponAktif(w)) continue;   // HAVA-HAVA kapalıysa o silah yok sayılır
            const cdKey = '_secCd' + wi;
            this[cdKey] = (this[cdKey] || 0) - dtSec;
            if (this[cdKey] > 0) continue;
            // MÜHİMMAT: perShot tanımlı ikincil silah depodan yer (helo hava-hava füzesi ATGM ile aynı 12'lik
            // depoyu paylaşır → hava muharebesi kara görevinden çalar). perShot yoksa eski davranış (MBT makinelisi bedava).
            if (w.perShot > 0 && this.maxAmmo > 0 && this.ammo < w.perShot) {
                if (SIM._silahSayac) SIM._silahSayac.cephanesiz = (SIM._silahSayac.cephanesiz || 0) + 1;
                continue;
            }
            const wr = w.range || 0; if (wr <= 0) continue;
            /* HEDEFE GÖRE MENZİL — birincil silahta zaten vardı (SPAAG karaya kısa),
               ikincilde okunmuyordu (ölü veri). Tank makinelisi havaya 300px, karaya
               450px: namlu havaya kısa erişir. */
            const _wrAir = (w.rangeByTarget && w.rangeByTarget.air) ? w.rangeByTarget.air : wr;
            const _wrGnd = (w.rangeByTarget && w.rangeByTarget.ground) ? w.rangeByTarget.ground : wr;
            const near = SIM.spatialGrid.getNearby(this.x, this.y, Math.max(_wrAir, _wrGnd));
            let best = null, bestScore = -1;
            for (const n of near) {
                if (n.dead || n.loaded || n.isRed === this.isRed || n.abandoned) continue;
                const dom = n.isAir ? 'air' : 'ground';
                if (!(w.targets || ['ground']).includes(dom)) continue;
                const d = Math.hypot(n.x - this.x, n.y - this.y);
                if (d > (n.isAir ? _wrAir : _wrGnd) || (w.minRange && d < w.minRange)) continue;
                if (d > this.vision && !canSee(this.isRed, n.x, n.y, n.isAir)) continue;
                if (n.isConcealed && n.isConcealed() && d > AMBUSH_DETECT) continue;
                const arm = STATS[n.type] ? STATS[n.type].armorType : 'infantry';
                const eff = (DM[w.damageType] || {})[arm] || 0;
                if (eff <= 0) continue;
                const score = eff / (1 + d * 0.004);
                if (score > bestScore || (score === bestScore && best && n.id < best.id)) { bestScore = score; best = n; }
            }
            if (!best) continue;
            const arm = STATS[best.type] ? STATS[best.type].armorType : 'infantry';
            const eff = (DM[w.damageType] || {})[arm] || 0;
            const _bd = Math.hypot(best.x - this.x, best.y - this.y);
            let dmg = Math.max(1, Math.floor(w.damage * (w.salvo || 1) * eff * (this.xpBonus || 1) * weaponAccuracy(this, w, best, _bd) * incomingDamageMult(best)));
            if ((SIM.tick - (this.commandHaloTick || -999)) <= 1) dmg = Math.floor(dmg * 1.12);   // komuta-halesi
            if (this._cmdShockUntil && SIM.tick < this._cmdShockUntil) dmg = Math.floor(dmg * 0.72);   // komuta-şoku (HQ öldü → emir-felci)
            // DEFERRED-DAMAGE: ikincil silahın mermisi de HAVADA yol alır; hasar VARIŞ-tik'inde iner (skaler-snapshot, srand-yok).
            const _sDist = Math.hypot(best.x - this.x, best.y - this.y);
            const _sSpeed = battleProjectileSpeed(this.type, !!best.isAir);
            const _sTicks = battleFlightTicks(_sDist, _sSpeed);
            SIM.pendingHits.push({
                kind: 'direct', evt: 'SECONDARY_FIRE',
                fireTick: (SIM.tick || 0), arriveTick: (SIM.tick || 0) + _sTicks, seq: SIM.pendingHitSeq++,
                atkId: this.id, atkType: this.type, atkIsRed: !!this.isRed, atkPower: this.atk * (this.xpBonus || 1),
                atkX: this.x, atkY: this.y,
                tgtId: best.id, dmg: dmg,
                isCrit: false, willAbandon: false, isRear: false, isFlank: false,
                flash: 4, panicMul: 80, supp: 0, knock: 0, splashR: 0,
                sparks: false, distress: false, xp: false   // ikincil silah: kıvılcım/imdat-çağrısı/seviye-atlama yok (eski davranış)
            });
            this[cdKey] = w.rof > 0 ? 1 / w.rof : 999;
            if (w.perShot > 0 && this.maxAmmo > 0) this.ammo = Math.max(0, this.ammo - w.perShot);
            if (SIM._silahSayac) {
                const _k = (STATS[this.type].id || this.type) + ':w' + wi;
                SIM._silahSayac[_k] = (SIM._silahSayac[_k] || 0) + 1;
            }
            if (!SIM.headless && typeof spawnProjectile === 'function') {
                const _tickSec = (typeof BATTLE_TICK_SEC !== 'undefined') ? BATTLE_TICK_SEC : 0.05;
                spawnProjectile(this.x, this.y, { x: best.x, y: best.y },   // ikincil silah (MBT makinelisi/komando şarjı) → hafif iz-mermi
                    { trail: false, impact: 'none', scale: 0.5, color: '#fff2a0', width: 1.2, homing: false, speed: _sSpeed, maxLife: _sTicks * _tickSec + 0.6 });
                if (typeof spawnTracer === 'function') spawnTracer(this.x, this.y, this.x + (best.x - this.x) * 0.06, this.y + (best.y - this.y) * 0.06, false);   // kısa namlu-alevi
            }
        }
    }

    performAttack(now) {
        /* KAÇAN BİRİM ATEŞ ETMEZ — ama TEK-KULLANIMLIK MÜHİMMAT bunun konusu değil.
           Kamikaze "ateş etmiyor", hedefe ÇARPIYOR; çarpma anında warhead'in patlamaması
           fiziksel olarak anlamsız. Kullanıcı hatası "hedefe çarptığında patlamıyor"un
           ikinci kökü buydu: drone panikleyip isFleeing olunca dalışı sürüyor ama
           patlama bu satırda sessizce iptal ediliyordu. (Birinci kök: insansız platformun
           hiç paniklememesi gerektiği — orada düzeltildi. Bu satır ikinci emniyet:
           dron başka bir yoldan kaçar duruma düşse bile temas patlamayı üretir.) */
        const _tekKullanim = !!(STATS[this.type] && STATS[this.type].singleUse);
        if (!this.attackTarget || this.attackTarget.dead || (this.isFleeing && !_tekKullanim)) return;
        // ── TESLİM OLMUŞ (terk edilmiş) HEDEFE ATEŞ ETME (kullanıcı hatası) ──
        // Mission-kill'de mürettebat aracı terk eder (`abandoned`, gri/nötr, "Terk Edildi"). Otomatik
        // hedefleme onu ZATEN dışlıyor (findBestVisibleEnemy) — ama o an ona KİLİTLİ olan birim kilidini
        // bırakmıyordu: tek kontrol `dead` idi. Sonuç: teslim olmuş araca ateş sürüyordu.
        // OYUNCUNUN ELİNDEN ALINMAZ: oyuncu bilerek "şuna saldır" dediyse (manualTarget) ateş DEVAM eder —
        // ele geçirilmesini engellemek meşru bir tercih. Yalnız OTOMATİK kilit bırakılır.
        if (this.attackTarget.abandoned && battleTeslimAtesKes()) {
            const _oyuncuEmri = (this.controlOwner === 'PLAYER' && this.manualTarget === this.attackTarget);
            // AI de GEREKÇEYLE patlatabilir (düşman istihkâmı tamire geliyor / zemin düşmanın) —
            // aksi halde ganimeti yalnız oyuncu koruyabilir/inkâr edebilirdi.
            const _gerekce = battleTeslimImhaGerekce(this.isRed, this.attackTarget);
            if (!_oyuncuEmri && !_gerekce) {
                this.attackTarget = null;
                this.combatState = 'Teslim Olmuş';
                return;
            }
        }
        if (this.maxAmmo > 0 && this.ammo <= 0 && this.type !== T.MEDIC) {   // maxAmmo=0 → mühimmat-sistemi YOK = SINIRSIZ (piyade/komando/istihkam tüfeği hep ateş eder); yalnız kapasiteli birim cephanesiz kalır
            // ANALİST-TELEMETRİ: AMMO_EMPTY — cephanesiz-kalış anı (AT-timi 4-atış + ÇNRA-salvo + topçu ekonomisi görünür; ikmal-muhasebesi altyapısı). Geçişte + throttle.
            if (this.combatState !== 'Cephanesiz' && typeof battleRecordLifeEvent === 'function' && (SIM.tick - (this._lastAmmoEvt || -999)) >= 40) {
                this._lastAmmoEvt = SIM.tick;
                battleRecordLifeEvent({ kind: 'AMMO_EMPTY', unitId: this.id, side: this.isRed ? 'red' : 'blue', type: this.type, maxAmmo: this.maxAmmo, x: Math.round(this.x * 100) / 100, y: Math.round(this.y * 100) / 100 });
            }
            this.combatState = 'Cephanesiz';
            return;
        }
        // HAVA/KARA UYGUNLUĞU: vuramayacağın hedefe ATEŞ ETME (mühimmat/cooldown boşa gitmesin). Emirli hedef de olabilir.
        if (typeof unitCanEngage === 'function' && !unitCanEngage(STATS[this.type], STATS[this.attackTarget.type])) {
            this.combatState = 'Vuramaz'; return;
        }
        // BİRİNCİL SİLAH KAPISI: hedefi yalnız İKİNCİL silah vurabiliyorsa birincil ateşi ATLA — hasar
        // hesabı (calculateUnitDamage) weapons[0]'ı okur, yani atış sıfır hasar verir ama cooldown/mühimmat
        // yakardı. Hedef KORUNUR (birim yaklaşmaya devam eder); vuruşu fireSecondaryWeapons yapar.
        // Bu kusur hava-hava öncesinde de vardı: MBT, alçak kamikaze dronu ap mermisiyle boşuna dövüyordu.
        if (typeof unitPrimaryCanEngage === 'function' &&
            !unitPrimaryCanEngage(STATS[this.type], STATS[this.attackTarget.type])) {
            this.combatState = 'İkincil Silah'; return;
        }
        // MİN-MENZİL ölü-bölge: havan/topçu/ÇNRA çok yakına ateş edemez.
        const __mr = STATS[this.type] ? (STATS[this.type].minRange || 0) : 0;
        if (__mr > 0 && Math.hypot(this.attackTarget.x - this.x, this.attackTarget.y - this.y) < __mr) {
            this.combatState = 'Çok Yakın'; return;
        }
        // KARA-MENZİL SINIRI: SPAAG karaya yalnız kısa menzilden ateş eder (hava menzili tam kalır)
        if (this.groundRange > 0 && !this.attackTarget.isAir &&
            Math.hypot(this.attackTarget.x - this.x, this.attackTarget.y - this.y) > this.groundRange) {
            this.combatState = 'Çok Uzak'; return;
        }
        // ── INTEL4-PRO 'ammoDiscipline': SAVUNANIN MÜHİMMAT YEDEĞİ ──
        // An-be-an teşhis: savunan ilk 50sn'de uzak menzilden aşırı ateşle mühimmatını yarılıyor; 3-5 birim kuruyor;
        // atış hacmi 4× düşüyor (ordusunun %70'i SAĞKEN) ve yaklaşan saldırganı durduramayıp siliniyor.
        // Kural: mühimmat yedek eşiğinin ALTINDAYKEN yalnız "kararlı menzil" içindeki hedefe ateş et — uzak tacizi kes.
        // Determinist (RNG yok); rol SİM-durumundan okunur (canlı kontrolör nesnesi OKUNMAZ).
        if (this.maxAmmo > 0 && typeof battleProDelta === 'function' && battleProDelta(this.isRed, 'ammoDiscipline') &&
            (this.ammo / this.maxAmmo) <= PRO_AMMO_RESERVE) {
            const _p = (SIM.ctrlPosture && this.controllerId) ? SIM.ctrlPosture[this.controllerId] : null;
            const _savunan = !!(_p && _p.role && _p.role !== (typeof BATTLE_ROLE !== 'undefined' ? BATTLE_ROLE.ATTACKER : 'attacker'));
            if (_savunan && Math.hypot(this.attackTarget.x - this.x, this.attackTarget.y - this.y) > this.range * PRO_AMMO_CLOSE_FRAC) {
                this.combatState = 'Mühimmat Tasarrufu'; return;
            }
        }
        // ATIŞ HATTI: önünde DOST varsa kendi adamının üstünden vuramaz (topçu hariç — dolaylı ateş).
        // En yakın TEMİZ (dost-engelsiz) düşmana geç = öndekini vur. Temiz düşman yoksa BOŞ BEKLEME —
        // küçük, İLERİ-ağırlıklı TEMİZ ADIM'la ateş-hattına sokul (arka-sıra öne dolar). Saçma yana-fan-out yok.
        if (!this.isIndirect && this.friendlyLineBlocked(this.attackTarget)) {
            const clear = this.findBestVisibleEnemy();   // findBestVisibleEnemy artık yalnız-dost LOS → dönen hedef dost-engelsiz
            if (clear && clear.dist <= this.range) {
                this.attackTarget = clear.unit;
            } else {
                this.combatState = 'Hat Kapalı';
                this._clearStep(this.attackTarget);   // dur-bekle DEĞİL: küçük ileri-adımla hatta gir
                return;
            }
        }
        
        let currentAtkSpeed = this.isPanicking ? this.atkSpeed * 1.5 : this.atkSpeed; 
        if (this.suppression > PINNED_SUPPRESSION) currentAtkSpeed *= 2.4;   // PINNED: ateş edemez gibi (çok nadir)
        else if (this.suppression > 50) currentAtkSpeed *= 1.5;             // baskı altında ateş yavaşlar
        // KULLANICI-FIX ("drone dokunuyor ama patlamıyor"): KAMİKAZE tek-kullanım → atış-cooldown'ı BYPASS. rof=0.02→atkSpeed=50s;
        // lastAttackTime=0 başlangıç → maçın ilk 50s'inde salınan drone `now<50000` iken cooldown-dolmamış sanılıp DALAMIYORDU.
        // ── KONUŞLANMIŞ BİRİM NAMLUSUNDA MERMİYLE GELİR (BATTLE_SPAWN_LOADED) ──
        // ÖLÇÜLDÜ (tools/gozcu-teshis.js): balistik füzenin atış bandında GÖRÜNÜR hedefi t=6sn'den beri vardı
        // (canlı tiklerinin %90.6'sı) ama ilk atışı ancak 67sn'de yaptı. Sebep AI değil: rof 0.015 → atkSpeed
        // 66.7sn ve lastAttackTime=0 başlangıcı, birimi maçın başında "daha doldurmadı" sayıyor. Yani birim
        // sahaya BOŞ namluyla çıkıyor. Etkilenenler: taktik füze 66.7sn · ÇNRA 20sn · yıkım şarjı 12.5sn ·
        // obüs 5.6sn (kalan silahlar ≤5sn, pratikte etkisiz). Yukarıdaki singleUse istisnası aynı hatanın
        // dron için zaten fark edilmiş dar bir yaması — bu, kuralın genel hâli.
        const _ilkAtisSerbest = (typeof BATTLE_SPAWN_LOADED === 'undefined' || BATTLE_SPAWN_LOADED) && this._hicAtesEtmedi;
        if (!_ilkAtisSerbest && now - this.lastAttackTime < currentAtkSpeed && !(STATS[this.type] && STATS[this.type].singleUse)) return;

        const _wasConcealed = this.isConcealed();   // T3 PUSU: gizliyken ateş → sürpriz bonusu + açığa çıkma

        let dmg = calculateUnitDamage(
            this.type,
            this.attackTarget.type,
            this.atk * this.xpBonus,
            this.attackTarget.armor
        );
        dmg = applyTechCombatBonus(this, this.attackTarget, dmg);   // TEKNOLOJİ: tanksavar→tank, vb. (mavi)

        // ── YÖNSEL HASAR (Flanking): ön/yan/arka arkı + yönlü-zırh (moral şoku aşağıda) ──
        const angleToTarget = Math.atan2(this.attackTarget.y - this.y, this.attackTarget.x - this.x);
        let angleDiff = Math.abs(angleToTarget - this.attackTarget.facingAngle);
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        angleDiff = Math.abs(angleDiff);
        // angleDiff: 0=tam ARKA, π/2=YAN, π=tam ÖN (hedef saldırgana bakıyor)
        const _tgtArmored = this.attackTarget.type === T.ARMOR || this.attackTarget.type === T.ARMOR_INFANTRY ||
                            this.attackTarget.type === T.ANTI_TANK || this.attackTarget.armor >= 4;
        let isRearHit = false, isFlankHit = false;
        if (angleDiff < Math.PI / 3) {              // ARKA (0-60°): zırh büyük ölçüde delinir
            isRearHit = true; isFlankHit = true;
            dmg *= facingDamageMult(this.attackTarget, 'rear', _tgtArmored);   // per-birim armorFacing (TD arka 0.3→3.3×)
        } else if (angleDiff < 2 * Math.PI / 3) {   // YAN (60-120°): zırh kısmen delinir
            isFlankHit = true;
            dmg *= facingDamageMult(this.attackTarget, 'side', _tgtArmored);   // per-birim (TD yan 0.5→2×, MBT yan 0.65→1.5×)
        }                                           // ÖN (120-180°): zırh tam etkili (×1.0)
        const _perkBonus = typeof _techBonusFor === 'function' ? _techBonusFor(this) : null;
        if (isFlankHit && _perkBonus && _perkBonus.firstFlankMul && !this._firstFlankPerkSpent) {
            dmg *= _perkBonus.firstFlankMul;
            this._firstFlankPerkSpent = true;
        }

        // T2: YÜKSELTİ — sürekli yükselti farkı (her yerde): yüksekten sert, yokuş-yukarı zayıf
        const _eDelta = (this.elevation || 0.5) - (this.attackTarget.elevation || 0.5);
        if (_eDelta > 0.05) dmg *= 1 + Math.min(0.28, _eDelta * 1.6);
        else if (_eDelta < -0.05) dmg *= 1 - Math.min(0.20, -_eDelta * 1.3);

        if (_wasConcealed && !this.isIndirect) dmg *= AMBUSH_DMG_MULT;   // T3 PUSU: gizliden ilk atış sürprizi (dolaylı ateş melee-pusu yapmaz)

        if ((SIM.tick - (this.commandHaloTick || -999)) <= 1) dmg *= 1.12;   // KOMUTA-HALESİ: HQ menzilindeki birim +%12 koordineli vuruş (komuta-aracı artık gerçek güç-çarpanı)
        if (this._cmdShockUntil && SIM.tick < this._cmdShockUntil) dmg *= 0.72;   // KOMUTA-ŞOKU: HQ öldü → 12sn emir-felci, koordinesiz-ateş −%28 (getiri-dengeli dezavantaj)

        // İSABET MODELİ (direct fire): menzil-sonu + hareketli-hedef + örtü → beklenen-hasar (deterministik). Dolaylı ateş kendi bloğunda uygular.
        if (!this.isIndirect) {
            const _pw0 = STATS[this.type].weapons && STATS[this.type].weapons[0];
            const _accDist = Math.hypot(this.attackTarget.x - this.x, this.attackTarget.y - this.y);
            let _m = weaponAccuracy(this, _pw0, this.attackTarget, _accDist);
            const _tst = STATS[this.attackTarget.type];
            if (this._canOverrun && _tst && _tst.armorType === 'infantry' && _accDist < 120) _m *= 1.5;   // OVERRUN: tank yakın piyadeyi ezer
            if (this._canSabotage && _tst && ['support', 'logistics', 'command'].includes(_tst.category)) _m *= 1.5;   // SABOTAJ: komando arka-hattı (medic/ikmal/HQ/EH) döver
            dmg = Math.max(1, Math.round(dmg * _m));
        }
        if (this._needsDeploy && this._stationaryT < 1.5) dmg = Math.max(1, Math.round(dmg * 0.4));   // DEPLOY: hareket sonrası ~1.5sn kurulum → zayıf ateş (scoot'un takası)
        dmg = Math.max(1, Math.round(dmg * incomingDamageMult(this.attackTarget)));   // SİPERLENME(-)/İŞARETLİ(+) hedef çarpanı

        if (this._canMark) this.attackTarget._markedTick = SIM.tick;   // İŞARETLE: komando/keşif → müttefikler bu hedefe +%25 (2sn)

        const primaryTarget = this.attackTarget;

        if (this.isIndirect) {
            // T1: DOLAYLI ATEŞ GÖZCÜ ister — kendi LOS'u ya da dost gözcü hedefi görmeli (yoksa ateş edemez → keşifle eşleş)
            if (typeof artilleryHasSight === 'function' && !artilleryHasSight(this, primaryTarget)) { this.combatState = 'Gözcü Yok'; return; }
            // ── DOLAYLI ATEŞ: VERİ-GÜDÜMLÜ ALAN HASARI (nokta atışı YOK) ──
            // GÜCE-GÖRE SPLASH: her silahın kendi aoe(px) + salvo + hasarı. Balistik aoe6=600px tek dev vuruş;
            // ÇNRA salvo12 × aoe2.5=250px → hedef çevresine SAÇILAN doygunluk; howitzer aoe3=300px; havan aoe2=200px.
            const _pw = STATS[this.type].weapons[0];
            const salvo = Math.max(1, _pw.salvo || 1);
            const blastR = _pw.aoe > 0 ? _pw.aoe : ARTILLERY_SPLASH_RADIUS;
            const beatenZone = salvo > 1 ? blastR * 1.3 : 0;   // salvo>1 → roketler "dövülen bölgeye" saçılır (tek birim hepsini yemez)
            // SALVO-PD (kullanıcı-kararı): ÇNRA gibi çok-mermili interceptable silahta SAM salvoyu KISMEN önler — ama SALVO-BÜTÇESİ (max 3 roket)
            // ile SAM-mühimmatı boşaltma-istismarı engellenir. Balistik (salvo1) eski eşik-kapılı yolda kalır.
            const _salvoPD = (salvo > 1 && _pw.interceptable);
            let _pdBudget = _salvoPD ? 3 : 0;
            const tcx = primaryTarget.x, tcy = primaryTarget.y;
            // İSABET (dolaylı): topçu/ÇNRA HAREKETLİ hedefe ıskalar (vsMoving 0.85) + menzil-sonu düşüşü → salvo-başı tek çarpan
            let _indAcc = weaponAccuracy(this, _pw, primaryTarget, Math.hypot(tcx - this.x, tcy - this.y));
            if (this._needsDeploy && this._stationaryT < 1.5) _indAcc *= 0.4;   // DEPLOY: topçu/balistik hareket sonrası kurulmadan zayıf ateş
            const _indSpeed = (this.type === T.MLRS ? 1150 : 850);              // roket uçuş hızı — hem hasar-varışı hem görsel bunu kullanır
            const _fxScale = Math.min(3, blastR / 180) * (salvo > 3 ? 1.4 : 1); // patlama görseli splash büyüklüğüne göre
            const _visScale = Math.min(1.5, 0.85 + _fxScale * 0.35);
            let _visLeft = 12;                                                  // görsel roket tavanı (12 salvo üstü çizilmez)
            for (let r = 0; r < salvo; r++) {
                let cx = tcx, cy = tcy;
                if (beatenZone > 0) {                          // deterministik düzgün-disk saçılım (SIM_RNG)
                    const ang = srand() * Math.PI * 2;
                    const dd = Math.sqrt(srand()) * beatenZone;
                    cx = tcx + Math.cos(ang) * dd; cy = tcy + Math.sin(ang) * dd;
                }
                // NOKTA-SAVUNMA: interceptable mermi düşman SAM menzilindeyse olasılıkla ÖNLENİR (füze harcar → doyurma işler).
                // ZAR FIRLATMADA atılır (srand-sırası korunur) ama SONUÇ HAVADA uygulanır: roket uçar, kesişme tik'inde vurulur.
                let _pdRes = 0; const _pdOut = {};
                if (_pw.interceptable && typeof battlePointDefenseIntercept === 'function') {
                    if (_salvoPD) {
                        if (_pdBudget > 0) {
                            _pdRes = battlePointDefenseIntercept(this, cx, cy, _pw.damage, true, _pdOut);   // salvo-modu: eşik-altı da önle
                            if (_pdRes !== 0) _pdBudget--;   // PD engage etti (ammo harcandı) → salvo-bütçesi düş (max 3 → SAM boşalmaz)
                        }
                    } else {
                        _pdRes = battlePointDefenseIntercept(this, cx, cy, _pw.damage, false, _pdOut);   // balistik: eşik-kapılı tek-mermi
                    }
                }
                // DEFERRED-DAMAGE: roket (cx,cy)'ye UÇAR; patlama varış-tik'inde, O ANDA orada olan birimlere iner.
                // Kuyruğa yalnız skaler gider; hasar varışta yeniden hesaplanır (hedef kaçtıysa mermi boş araziye düşer).
                const _tickSec = (typeof BATTLE_TICK_SEC !== 'undefined') ? BATTLE_TICK_SEC : 0.05;
                const _iFlight = battleFlightTicks(Math.hypot(cx - this.x, cy - this.y), _indSpeed);
                // ÖNLEME KESİŞMESİ: roket yolunun ~%60'ında vurulur (varıştan KESİN önce). Tümü fırlatma-anı skalerlerinden → determinist.
                const _killIn = (_pdRes === 1) ? Math.max(1, Math.min(_iFlight, Math.round(_iFlight * 0.6))) : 0;
                const _kf = _killIn / _iFlight;
                const _killX = this.x + (cx - this.x) * _kf, _killY = this.y + (cy - this.y) * _kf;
                SIM.pendingHits.push({
                    kind: 'blast', evt: 'ARTILLERY_SPLASH',
                    fireTick: (SIM.tick || 0), arriveTick: (SIM.tick || 0) + _iFlight, seq: SIM.pendingHitSeq++,
                    atkId: this.id, atkType: this.type, atkIsRed: !!this.isRed, atkPower: this.atk * this.xpBonus,
                    atkX: this.x, atkY: this.y,
                    cx: cx, cy: cy, blastR: blastR, suppR: blastR * 1.8, indAcc: _indAcc,   // suppR: bastırma-bölgesi hasar-yarıçapından geniş
                    killTick: _killIn ? (SIM.tick || 0) + _killIn : null, killX: _killX, killY: _killY   // önlendiyse: havada düşürülme tik'i + noktası
                });
                if (!SIM.headless && typeof spawnProjectile === 'function') {
                    // ROKET UÇUŞU: görsel GERÇEK çarpma noktasına gider ve hasarla AYNI anda patlar. Önlenen roket
                    // kesişme anında SÖNER (impact yok) — patlamayı kuyruk-işleyicisi tam o noktada üretir.
                    if (_visLeft > 0) {
                        _visLeft--;
                        spawnProjectile(this.x, this.y, { x: cx, y: cy }, _killIn
                            ? { homing: false, speed: _indSpeed, scale: _visScale, impact: 'none', maxLife: _killIn * _tickSec }
                            : { homing: false, speed: _indSpeed, scale: _visScale, maxLife: _iFlight * _tickSec + 0.6 });
                    }
                    // ÖNLEYİCİ FÜZE: SAM'den kesişme noktasına — hızı, gelen roketle AYNI ANDA orada olacak şekilde ayarlı
                    // (havada bizzat çarpışma görünür). Iskada da füze çıkar ama çarpışma olmaz (yanından geçip söner).
                    if (_pdRes !== 0 && _pdOut.id != null) {
                        const _mf = _pdRes === 1 ? _kf : 0.6;                       // ıskada da yolun ~%60'ına kadar git
                        const _mx = this.x + (cx - this.x) * _mf, _my = this.y + (cy - this.y) * _mf;
                        const _mt = Math.max(_tickSec, (_pdRes === 1 ? _killIn : Math.round(_iFlight * 0.6)) * _tickSec);
                        spawnProjectile(_pdOut.x, _pdOut.y, { x: _mx, y: _my },
                            { homing: false, trail: true, impact: 'none', color: '#9fd8ff', scale: 0.9,
                              speed: Math.hypot(_mx - _pdOut.x, _my - _pdOut.y) / _mt, maxLife: _mt });
                    }
                }
            }
            if (this.maxAmmo > 0) this.ammo = Math.max(0, this.ammo - 1);   // P2: ikmal KESİRLİ verebiliyor (0.5) + tüketim tam 1 → negatif mühimmat oluşuyordu; kelepçelendi
            this.lastAttackTime = now; this._hicAtesEtmedi = false;   // ilk atış yapıldı → bundan sonra normal dolum süresi
            this.revealTimer = AMBUSH_REVEAL_TICKS;   // T3 PUSU: ateş → açığa çık
            if (this._canScoot) {   // SHOOT-AND-SCOOT: ateş sonrası kendi tarafına ~180px geri çekil (karşı-batarya kaçış)
                const _by = this.isRed ? this.y - 180 : this.y + 180;
                const _sp = (typeof terrainSafePoint === 'function') ? terrainSafePoint(this.x, _by) : { x: this.x, y: _by };
                this.targetX = _sp.x; this.targetY = _sp.y; this.manualMoveTarget = _sp; this.isMovingToManualTarget = true;
            }
            // Roket görselleri artık salvo döngüsünde, GERÇEK çarpma noktalarına gönderiliyor (yukarıda) — burada yalnız namlu-alevi.
            if (!SIM.headless && typeof spawnTracer === 'function') {
                spawnTracer(this.x, this.y, this.x + (tcx - this.x) * 0.05, this.y + (tcy - this.y) * 0.05, true);   // fırlatma namlu-alevi
            }
            if (typeof triggerScreenShake === 'function') triggerScreenShake(Math.min(0.2, 0.09 * _fxScale));   // fırlatma geri-tepmesi (patlama-sarsıntısı varışta spawnExplosion'da)
            if (typeof triggerHitStop === 'function') triggerHitStop(3);
            return;
        }

        if (STATS[this.type].singleUse) {
            // ── KAMİKAZE / GEZİNEN MÜHİMMAT: hedefe DALIŞ → çarpma noktasında AĞIR alan-hasarı ──
            // Zırh-tipi fark etmez: warhead her kara şeyine ciddi hasar (en-iyi etki = max(he, shaped), taban 0.7).
            // Piyade 1.2 / hafif 1.2 / ağır 1.4 → dmg420 ile 504/504/588. Vurunca yok olur (tek-kullanım).
            const _pw = STATS[this.type].weapons[0];
            const blastR = _pw.aoe > 0 ? _pw.aoe : 100;
            // OPERATÖR-BAĞI: operatör-fırlatmalı drone'un kontrol-bağı kopmuşsa (operatör imha) → KÖR-DALIŞ ×0.6 (çökme-değil).
            // Anlık-hesap (mutable-cache YOK → hash-gerekmez), determinist tarama. operatorId yoksa (sağ-tık/eski-kamikaze) ceza-yok.
            let linkMult = 1;
            if (this.operatorId != null) {
                let opAlive = false;
                for (const op of SIM.units) { if (op.id === this.operatorId) { opAlive = !op.dead; break; } }
                if (!opAlive) linkMult = 0.6;
            }
            const DM = (typeof UNITS_MODERN_DB !== 'undefined') ? UNITS_MODERN_DB.damageMatrix : null;
            const kcx = primaryTarget.x, kcy = primaryTarget.y;
            const kNearby = SIM.spatialGrid.getNearby(kcx, kcy, blastR);
            // KULLANICI-FIX (drone splash-overkill "mezbaha"): tek-warhead ÇOĞALMASIN. TOPLAM-HASAR HAVUZU = warhead'in EN-YAKIN(dalış)
            // hedefe tam-hasarı; yakından-uzağa dağıt, her hedef payını alır, HAVUZ tükenince DUR. Overkill sonraki hedefe akar (yalnız
            // absorbe-edilen tüketir → israf yok). Tek-tank'a tam-hasar KORUNUR (anti-zırh); 5-piyade-kütlesinde ~2 birim alır (topçu-değil).
            const _kt = [];
            for (const n of kNearby) {
                if (n.dead || n.isRed === this.isRed || n.abandoned) continue;
                if (typeof unitCanEngage === "function" && !unitCanEngage(STATS[this.type], STATS[n.type])) continue;  // hava hedefe çarpmaz (kara warhead'i)
                const distance = Math.hypot(n.x - kcx, n.y - kcy);
                if (distance > blastR) continue;
                const arm = STATS[n.type] ? STATS[n.type].armorType : 'infantry';
                let eff = DM ? Math.max(0.7, DM.he?.[arm] || 0, DM.shaped?.[arm] || 0) : 1;
                const _af = STATS[n.type] && STATS[n.type].armorFacing;   // STRIKE_TOP_ARMOR: üstten dalış zayıf üst-zırhı bulur
                if (this._topStrike && _af && _af.top) eff *= Math.min(2.2, 1 / _af.top);
                const falloff = 1 - distance / blastR;
                const fullDmg = Math.max(1, Math.floor(
                    applyTechCombatBonus(this, n, this.atk * this.xpBonus * eff * incomingDamageMult(n)) * (0.6 + falloff * 0.4) * linkMult
                ));
                _kt.push({ n, distance, fullDmg });
            }
            _kt.sort((a, b) => (a.distance - b.distance) || (a.n.id - b.n.id));   // yakından-uzağa (determinist)
            let _pool = _kt.length ? _kt[0].fullDmg : 0;   // HAVUZ = en-yakın(dalış)-hedefin tam-hasarı
            for (const _e of _kt) {
                if (_pool <= 0) break;
                const n = _e.n;
                const blastDmg = Math.min(_pool, _e.fullDmg);   // bu hedefin payı (havuzla sınırlı)
                const hpBefore = n.hp;
                const blastActual = Math.min(n.hp, blastDmg);
                n.hp -= blastDmg;
                _pool -= blastActual;   // yalnız absorbe-edilen havuzu tüketir (overkill sonrakine akar)
                if (typeof battleRecordCombatEvent === 'function') {
                    battleRecordCombatEvent({
                        kind: 'KAMIKAZE_IMPACT', attackerId: this.id, attackerSide: this.isRed ? 'red' : 'blue',
                        attackerType: this.type, targetId: n.id, targetSide: n.isRed ? 'red' : 'blue', targetType: n.type,
                        damage: Math.round(blastActual * 100) / 100, hpBefore: Math.round(hpBefore * 100) / 100,
                        hpAfter: Math.round(Math.max(0, n.hp) * 100) / 100, lethal: n.hp <= 0,
                        attackerX: Math.round(this.x * 100) / 100, attackerY: Math.round(this.y * 100) / 100,
                        targetX: Math.round(n.x * 100) / 100, targetY: Math.round(n.y * 100) / 100
                    });
                }
                // KREDI: KAMIKAZE ucuncu bir hasar yolu — applyDirectHit/applyBlast'tan GECMEZ.
                // (Ilk surumde topcu ayni sebeple 0 gorunmustu; sarf-drone da 11 kez firlatilip
                // 0 hasar yaziyordu.) Hasar+panik+baski hem drone'a hem onu SALAN operatore yazilir.
                const _pK = n.panic, _sK = n.suppression;
                n.panic += (blastDmg / n.maxHp) * 140;
                n.flashTimer = 5;
                if (typeof applyKnockback === 'function') applyKnockback(n, kcx, kcy, 2.2);
                n.suppression += 35;
                if (typeof BATTLE_CREDIT !== 'undefined' && BATTLE_CREDIT.on) {
                    battleKredi(this, 'hasar', blastActual);
                    battleKredi(this, 'panik', Math.max(0, n.panic - _pK));
                    battleKredi(this, 'baski', Math.max(0, n.suppression - _sK));
                    if (n.hp <= 0) battleKredi(this, 'imhaDeger', (STATS[n.type] && STATS[n.type].cost) || 0);
                    if (this.operatorId != null) {
                        const _opK = SIM.units.find(z => z.id === this.operatorId);
                        if (_opK) {
                            battleKredi(_opK, 'droneHasar', blastActual);
                            if (n.hp <= 0) battleKredi(_opK, 'imhaDeger', (STATS[n.type] && STATS[n.type].cost) || 0);
                        }
                    }
                    battleKredi(n, 'emilen', blastActual);
                }
                if (n.isRed) { n.lastHitTime = now; n.distressX = this.x; n.distressY = this.y; }
                if (n.armor > 0 && typeof spawnHitSparks !== 'undefined') spawnHitSparks(n.x, n.y);
                if (n.hp <= 0 && !n.dead) {
                    n.dead = true;
                    if (this.isRed) enemy.kills++; else player.kills++;
                    decals.push(n.armor > 0
                        ? { x: n.x, y: n.y, type: 'wreck', size: 25, alpha: 1.0 }
                        : { x: n.x, y: n.y, type: 'blood', size: 10 + Math.random() * 15, alpha: 0.7 });
                    if (decals.length > 5000) decals.shift();
                    this.kills++;
                    if (n === primaryTarget) { this.attackTarget = null; this.manualTarget = null; }
                }
            }
            this.hp = 0; this.dead = true;   // tek-kullanım: dalışta yok olur
            this.lastAttackTime = now;
            if (typeof spawnExplosion !== 'undefined') spawnExplosion(kcx, kcy, 2.2);
            if (typeof triggerScreenShake === 'function') triggerScreenShake(0.12);
            if (typeof triggerHitStop === 'function') triggerHitStop(4);
            return;
        }

        // ── KRİTİK VURUŞ (deterministik srand): taban %6 + YAN +%12 + ARKA +%25. Kritik → ×1.8 hasar + mürettebat-terk şansı yüksek ──
        let _critChance = 0.06;
        if (isRearHit) _critChance += 0.25; else if (isFlankHit) _critChance += 0.12;
        const _isCrit = srand() < _critChance;
        if (_isCrit) dmg = Math.round(dmg * 1.8);

        // ── MISSION-KILL zarı FIRLATMA-anında atılır (srand-sırası korunur), UYGULAMA varışta ──
        // Öngörülen varış-sonrası hp (hedef.hp − dmg) ile zar; varışta canlı-önkoşul tutmazsa zar boşa çıkar (determinizm-güvenli).
        let _willAbandon = false;
        const _predHp = primaryTarget.hp - dmg;
        if (!primaryTarget.abandoned && primaryTarget._crewed && _predHp > 0 && _predHp < primaryTarget.maxHp * 0.30) {
            if (srand() < (_isCrit ? 0.55 : 0.14)) _willAbandon = true;   // kritik vuruşta terk şansı yüksek
        }

        // ── DEFERRED-DAMAGE (kullanıcı: "mermi ulaşmadan hasar olmamalı"): hasar BURADA hesaplanır, VARIŞ-tik'inde iner ──
        // Kuyruğa yalnız SKALER gider (canlı-referans YOK → fork/replay güvenli). Aynı hız VFX'e de verilir → görsel↔hasar eşzamanlı.
        const _fDist = Math.hypot(primaryTarget.x - this.x, primaryTarget.y - this.y);
        const _fSpeed = battleProjectileSpeed(this.type, !!primaryTarget.isAir);
        const _fTicks = battleFlightTicks(_fDist, _fSpeed);
        SIM.pendingHits.push({
            kind: 'direct', evt: 'DIRECT_FIRE',
            fireTick: (SIM.tick || 0), arriveTick: (SIM.tick || 0) + _fTicks, seq: SIM.pendingHitSeq++,
            atkId: this.id, atkType: this.type, atkIsRed: !!this.isRed, atkPower: this.atk * this.xpBonus,
            atkX: this.x, atkY: this.y,
            tgtId: primaryTarget.id, dmg: dmg,
            isCrit: _isCrit, willAbandon: _willAbandon, isRear: isRearHit, isFlank: isFlankHit,
            flash: 6, panicMul: 150,
            supp: this.type === T.ARMOR ? 0 : 15,   // tank alan-baskısını splash halkası yapar (eski davranış korunur)
            knock: this.type === T.ARMOR ? 4.5 : this.type === T.ANTI_TANK ? 3.5 : 2,
            splashR: this.type === T.ARMOR ? TANK_SPLASH_RADIUS : 0
        });

        // ── ATICI TARAFI (fırlatma-anı): mühimmat / cooldown / açığa-çıkma / geri-tepme ──
        if (this.maxAmmo > 0 && this.type !== T.MEDIC) this.ammo = Math.max(0, this.ammo - 1);   // SINIRSIZ birim (maxAmmo=0) tüketmez; P2: negatif-mühimmat kelepçesi
        this.lastAttackTime = now; this._hicAtesEtmedi = false;   // ilk atış yapıldı → bundan sonra normal dolum süresi
        this.revealTimer = AMBUSH_REVEAL_TICKS;   // T3 PUSU: ateş → açığa çık (gizlilik bozulur)
        if (typeof applyKnockback === 'function') applyKnockback(this, primaryTarget.x, primaryTarget.y, 1.1);   // namlu geri-tepmesi (render-only)
        if (this.type === T.ARMOR || this.type === T.ANTI_TANK) {
            if (typeof triggerScreenShake === 'function') triggerScreenShake(this.type === T.ARMOR ? 0.08 : 0.06);   // atış geri-tepmesi
            if (typeof triggerHitStop === 'function') triggerHitStop(2);
        }

        // MERMİ GÖRSELİ: artık TÜM direct-fire silahlarında mermi HAVADA yol alır — hız hasar-varışıyla AYNI.
        // GÜDÜMLÜ füze (SAM/MANPADS/taarruz-helo/SİHA) hedefe kitlenir (kaçarsa kıvrılır); namlu-mermisi fırlatma-anı
        // nişan noktasına düz uçar. Tracer artık yalnız kısa NAMLU-ALEVİ (asıl mermi projektil).
        if (!SIM.headless && typeof spawnProjectile === 'function') {
            const _homing = battleIsHomingWeapon(this.type);
            const _tickSec = (typeof BATTLE_TICK_SEC !== 'undefined') ? BATTLE_TICK_SEC : 0.05;
            const _fx = battleProjectileVisual(this.type);
            spawnProjectile(this.x, this.y, _homing ? primaryTarget : { x: primaryTarget.x, y: primaryTarget.y },
                Object.assign({}, _fx, { homing: _homing, speed: _fSpeed, maxLife: _fTicks * _tickSec + 0.6 }));
            const _isMG = this.type === T.INFANTRY || this.type === T.MECH_INFANTRY || this.type === T.ARMOR_INFANTRY;
            if (_isMG && typeof spawnMGTracer === 'function') spawnMGTracer(this.x, this.y, primaryTarget.x, primaryTarget.y);
            else if (!_homing && typeof spawnTracer === 'function') spawnTracer(this.x, this.y, this.x + (primaryTarget.x - this.x) * 0.06, this.y + (primaryTarget.y - this.y) * 0.06, false);   // kısa namlu-alevi
        }
    }

    draw() {
        if (this.dead || this.loaded) return;   // TAŞINAN piyade araç içinde → çizilmez

        const _viewerSide = (typeof myCanonicalSide !== 'undefined') ? myCanonicalSide : false;
        // Konuşlandırma istihbarat değildir: rakibin ordu bileşimi ve mevzisi
        // savaş başlamadan çizilmez. Savaşta da yalnız gerçek görüş çizer.
        if (!battleUnitVisibleToViewer(this, _viewerSide, phase)) return;
        // T3 PUSU: gizli düşman birimi yakından fark edilmiyorsa çizme (ormanda saklı)
        if (phase === PHASE.BATTLE && this.isConcealed && this.isConcealed()) {
            const _viewer = (typeof myCanonicalSide !== 'undefined') ? myCanonicalSide : false;
            if (this.isRed !== _viewer && typeof enemyDetectsConcealed === 'function' && !enemyDetectsConcealed(this, _viewer)) return;
        }

        // Knockback/recoil görsel ofseti (render-only; this.x/y'ye DOKUNMAZ) — yaylanarak söner
        if (this.voffX === undefined) { this.voffX = 0; this.voffY = 0; }
        this.voffX *= 0.82; this.voffY *= 0.82;
        if (Math.abs(this.voffX) < 0.05) this.voffX = 0;
        if (Math.abs(this.voffY) < 0.05) this.voffY = 0;
        // 60 FPS ARA-DEĞER: sim 20 Hz; ham this.x çizilirse birim 2 kare durup 3.'de sıçrar (hızlı
        // birimde 12+ px → "titreme"). unitRenderPos tik-başı konumla lerp eder; sim'e dokunmaz.
        const _rp = (typeof unitRenderPos === 'function') ? unitRenderPos(this) : this;
        const s = worldToScreen(_rp.x + this.voffX, _rp.y + this.voffY);
        const dw = drawW(), dh = drawH();

        if (s.x < -dw * 2 || s.x > canvas.width + dw * 2 || s.y < -dh * 2 || s.y > canvas.height + dh * 2) return;

        // ── RADAR TEMASI (sis içinde, yalnız radardan biliniyor) → KIRMIZI temas işareti, sprite YOK ──
        // Radar bir iz verir, teşhis vermez: birimin ne olduğu, canı, yönü bilinmez. Bu yüzden burada
        // çizim biter (return) — can çubuğu/menzil halkası/seçim kutusu da çizilmez.
        if (phase === PHASE.BATTLE && typeof battleRadarOnlyContact === 'function' &&
            battleRadarOnlyContact(this, _viewerSide)) {
            const _r = Math.max(4, dw * 0.42);
            const _puls = 0.55 + 0.45 * Math.abs(Math.sin((typeof gameTime !== 'undefined' ? gameTime : 0) * 3));
            ctx.save();
            ctx.strokeStyle = 'rgba(255,60,60,' + (0.45 + 0.4 * _puls).toFixed(3) + ')';
            ctx.lineWidth = Math.max(1.5, 2 * zoom);
            ctx.beginPath();                                  // eşkenar dörtgen = "tanımlanmamış temas"
            ctx.moveTo(s.x, s.y - _r); ctx.lineTo(s.x + _r, s.y);
            ctx.lineTo(s.x, s.y + _r); ctx.lineTo(s.x - _r, s.y);
            ctx.closePath(); ctx.stroke();
            ctx.fillStyle = 'rgba(255,60,60,0.18)'; ctx.fill();
            ctx.restore();
            return;
        }

        // Yumuşak dönüş (render-only): drawAngle facingAngle'a kademeli yaklaşır → "tık diye" dönmez
        if (this.drawAngle === undefined) this.drawAngle = this.facingAngle;
        let _da = this.facingAngle - this.drawAngle;
        while (_da > Math.PI) _da -= Math.PI * 2;
        while (_da < -Math.PI) _da += Math.PI * 2;
        this.drawAngle += _da * ((UNIT_TURN_RATE[this.type] || 0.09) * UNIT_TURN_SMOOTH);
        const _ang = this.drawAngle + UNIT_FACE_OFFSET;    // taraf-kutusu + seçim-çerçevesi açısı
        const _kw = dw * UNIT_BOX_SCALE, _kh = dh * UNIT_BOX_SCALE;          // DÖNEN kutu
        const _sw = dw * UNIT_SPRITE_SCALE, _sh = dh * UNIT_SPRITE_SCALE;    // DİK sprite (kutunun içi)
        // Kutu döndüğü için kapladığı alan açıya göre değişir; dışına konan işaretler
        // (can çubuğu, ön-burnu) 45°'de bile çakışmasın diye YARI KÖŞEGENe göre yerleşir.
        const _kr = _kh * Math.SQRT1_2;

        if (this.selected && !this.isRed) {
            ctx.strokeStyle = '#00ff55';
            ctx.lineWidth = 2;
            // KULLANICI (2026-08-09): "birimlerin arkasındaki o yeşil şeyi kaldır veya birimle aynı
            // şekilde döndür, gözükmesin." Kısa süre eksen-hizalı çizildi (çarpışma kutusunu göstersin
            // diye) ama 45° dönmüş sprite'ın arkasında koca bir kare olarak sırıtıyordu.
            // Çerçeve yeniden birimle BİRLİKTE döner ve sprite sınırına TAM oturur (payı yok) →
            // gövdenin arkasında kaybolur. Fizik kutusu yine eksen-hizalı AABB'dir; seçim göstergesi
            // fizik göstergesi değildir.
            // Çerçeve TARAF KUTUSUYLA aynı kare, aynı açı — ikisi tek parça okunur.
            // (Kullanıcı: "yeşil şeyler kutunun dönmesi ile dönmüyor.")
            if (UNIT_ROTATE) {
                ctx.save();
                ctx.translate(s.x, s.y);
                ctx.rotate(_ang);
                ctx.strokeRect(-_kw / 2, -_kh / 2, _kw, _kh);
                ctx.restore();
            } else {
                ctx.strokeRect(s.x - _kw / 2 - 3, s.y - _kh / 2 - 3, _kw + 6, _kh + 6);
            }
        }
        if (this.ally) {   // Müttefik birlik işareti
            ctx.fillStyle = 'rgba(90,220,255,0.95)';
            ctx.beginPath(); ctx.arc(s.x, s.y - dh / 2 - 4, 2.4, 0, Math.PI * 2); ctx.fill();
        }

        if (this.type === T.ENGINEER && !this.dead) {
            ctx.strokeStyle = this.isRed ? 'rgba(255,200,100,0.08)' : 'rgba(100,255,200,0.08)';
            ctx.fillStyle = this.isRed ? 'rgba(255,200,100,0.03)' : 'rgba(100,255,200,0.03)';
            ctx.beginPath(); ctx.arc(s.x, s.y, 180 * zoom, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
        }

        const _flash = this.flashTimer > 0;                    // hit-flash: vuruşta beyaza yakın parlama
        const _abFilter = this.abandoned ? 'grayscale(1) brightness(0.72)' : null;   // TERK: gri/tarafsız görünüm

        /* TARAF KUTUSU — mavinin arkasında mavi, kırmızının arkasında kırmızı.
           Eskiden bu kutu SPRITE'IN İÇİNDEydi (icons.png hücresi komple boyalıydı),
           yeni sanat saydam gelince taraf rengi kayboldu. Artık burada çizilir:
             · DÖNMEZ. UNIT_ROTATE=true olduğu için sprite'a gömülü kutu birimle
               birlikte dönüyordu; dik duran kutu okunur, dönen kare değil.
             · Sprite ölçeğinden BAĞIMSIZ. Birimler artık hücreyi farklı oranlarda
               dolduruyor (tank büyük, piyade küçük) ama taraf işareti hepsinde aynı
               boyda kalır — sim'de çarpışma yarıçapı da hepsinde aynıdır.
             · TERK edilmiş birim tarafsızdır → gri kutu. */
        if (spriteReady()) {
            // OPAK. Yarı saydamken altındaki arazi sızıyor ve kutu birimin parçası değil,
            // "arkaya düşen renk" gibi duruyordu (kullanıcı 2026-08-16).
            const _kutu = this.abandoned ? '150,150,150'
                : (this.isRed ? '220,40,40' : '64,96,220');
            ctx.save();
            if (UNIT_ROTATE) { ctx.translate(s.x, s.y); ctx.rotate(_ang); }
            else { ctx.translate(s.x, s.y); }
            ctx.fillStyle = 'rgb(' + _kutu + ')';
            ctx.fillRect(-_kw / 2, -_kh / 2, _kw, _kh);
            ctx.strokeStyle = 'rgba(0,0,0,0.55)';              // koyu kenar → yeşil arazide sınır okunur
            ctx.lineWidth = Math.max(1, zoom);
            ctx.strokeRect(-_kw / 2, -_kh / 2, _kw, _kh);
            ctx.restore();
        }

        /* SPRITE DİK ÇİZİLİR — dönen kutunun iç karesine oturur. Yön bilgisini artık
           kutunun kendisi (ve UNIT_FRONT_MARKER burnu) taşıyor. */
        if (_flash) ctx.filter = 'brightness(2.6) saturate(0.4)'; else if (_abFilter) ctx.filter = _abFilter;
        spriteReady() && ctx.drawImage(spriteSheet, this.sx, this.sy, SP_W, SP_H,
            s.x - _sw / 2, s.y - _sh / 2, _sw, _sh);
        if (_flash || _abFilter) ctx.filter = 'none';
        if (this.abandoned) {   // TERK göstergesi (tarafsız — tamir eden ele geçirir)
            ctx.fillStyle = '#ccc'; ctx.font = `${Math.max(10, 12 * zoom)}px Arial`; ctx.textAlign = 'center';
            ctx.fillText('🏳️ terk', s.x, s.y - dh / 2 - 10 * zoom);
        }

        // ÖN-işareti: facing yönüne bakan parlak burun → ön/arka net (arkadan kuşatılınca bile okunur)
        if (UNIT_FRONT_MARKER) {
            const fa = this.drawAngle;                          // yumuşak yön
            const cx = Math.cos(fa), cy = Math.sin(fa);
            const px = -cy, py = cx;                            // facing'e dik (taban yönü)
            const off = UNIT_FACE_OFFSET;                       // ön-uç = leading edge mesafesi (offset'e göre)
            const fr = (_kw / 2) * Math.abs(Math.cos(off)) + (_kh / 2) * Math.abs(Math.sin(off)) + 2 * zoom;
            const fx = s.x + cx * fr, fy = s.y + cy * fr;
            const tip = 5 * zoom, half = 3 * zoom;
            ctx.beginPath();
            ctx.moveTo(fx + cx * tip, fy + cy * tip);           // burun ucu
            ctx.lineTo(fx + px * half, fy + py * half);         // taban-sol
            ctx.lineTo(fx - px * half, fy - py * half);         // taban-sağ
            ctx.closePath();
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.lineWidth = Math.max(1, 0.6 * zoom);
            ctx.strokeStyle = 'rgba(0,0,0,0.6)';
            ctx.stroke();
        }

        // HİKAYE: GAZİ rütbesi (savaştan savaşa taşınan birim) — altın yıldız(lar) üstte
        if (this.veteran > 0) {
            ctx.fillStyle = '#ffd24c';
            ctx.font = `bold ${Math.max(7, 7 * zoom)}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText('★'.repeat(Math.min(3, this.veteran)), s.x, s.y - dh / 2 - 3 * zoom);
        }

        if (this.armor > this.baseArmor) {
            ctx.fillStyle = this.inForest ? '#4caf50' : '#44ffaa';
            ctx.font = `${Math.max(8, 8 * zoom)}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(this.inForest ? '🌲+🛡️' : '🛡️', s.x, s.y + dh / 2 + 10 * zoom);
        }

        if (this.isFleeing) {
            ctx.fillStyle = '#ff3333';
            ctx.font = `${Math.max(12, 12 * zoom)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText('🏃', s.x, s.y - dh / 2 - 15 * zoom);
        } else if (this.isPanicking) {
            ctx.fillStyle = '#00ccff';
            ctx.font = `${Math.max(10, 10 * zoom)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText('💧', s.x, s.y - dh / 2 - 12 * zoom);
        }

        if (this.level > 0) {
            ctx.fillStyle = '#ffea00';
            ctx.font = `${Math.max(10, 12 * zoom)}px Arial`;
            ctx.textAlign = 'center';
            const stars = this.level === 1 ? '★' : '★★';
            ctx.fillText(stars, s.x, s.y + dh / 2 + 25 * zoom);
        }

        if (this.combatState === 'Cephanesiz' && this.ammo <= 0) {
            ctx.fillStyle = '#ffa500';
            ctx.font = `${Math.max(10, 12 * zoom)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText('📦 Lojistik Gerek!', s.x, s.y - dh / 2 - 25 * zoom);
        }

        if (this.entrench >= 0.6) {   // SİPERLENDİ göstergesi (dig_in tam etkin)
            ctx.fillStyle = '#caa050';
            ctx.font = `${Math.max(9, 11 * zoom)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText('⛏', s.x + dw / 2 + 6 * zoom, s.y);
        }

        if (this.transportSlots > 0 && this.cargo.length > 0) {   // TAŞIMA: kaç yolcu bindi göster
            ctx.fillStyle = '#8ef';
            ctx.font = `bold ${Math.max(10, 12 * zoom)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(`🪖 ${this.cargo.length}/${this.transportSlots}`, s.x, s.y - dh / 2 - 25 * zoom);
        }

        if (this.isAir && this.maxFuel > 0) {   // YAKIT göstergesi (çubuk + kalan-saniye; düşük=kırmızı, dönüyor=uyarı)
            const fr = Math.max(0, this.fuel / this.maxFuel);
            // ÇUBUK kutuyla döner (can çubuğu gibi), YAZI dik kalır — dönen yazı okunmaz.
            const fw = dw * 0.9;
            ctx.save();
            ctx.translate(s.x, s.y);
            if (UNIT_ROTATE) ctx.rotate(_ang);
            const fx = -fw / 2, fy = _kh / 2 + 2 * zoom;      // kutunun alt kenarının hemen altı
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(fx, fy, fw, 3 * zoom);
            ctx.fillStyle = this._returningToBase ? '#ffcc00' : (fr < 0.3 ? '#ff5555' : '#55ff55');
            ctx.fillRect(fx, fy, fw * fr, 3 * zoom);
            ctx.restore();
            const _secs = this.fuelBurn > 0 ? Math.ceil(this.fuel / this.fuelBurn) : 0;   // kalan sorti saniyesi
            const _fty = s.y + _kr + 12 * zoom;               // yazı: dönen kutunun en dış köşesinin altında
            ctx.font = `${Math.max(9, 10 * zoom)}px Arial`; ctx.textAlign = 'center';
            if (this._returningToBase) { ctx.fillStyle = '#ffcc00'; ctx.fillText('⛽ üsse', s.x, _fty); }
            else if (fr < 0.5) { ctx.fillStyle = fr < 0.3 ? '#ff8888' : '#ffe08a'; ctx.fillText(`⛽${_secs}s`, s.x, _fty); }
        }

        /* CAN ÇUBUĞU (+ bastırma çubuğu, durum rozeti) KUTUYLA BİRLİKTE DÖNER.
           Kullanıcı 2026-08-16: "yeşil şeyler kutunun dönmesi ile dönmüyor."
           Dik duran çubuk, 45°'de elmasa dönen kutunun üstünde kopuk duruyordu;
           kutu uzayında çizilince her açıda kutunun üst kenarına yapışık kalır. */
        const barW = dw + 6;
        const barH = Math.max(3, 4 * zoom);
        const ratio = Math.max(0, this.hp / this.maxHp);
        ctx.save();
        ctx.translate(s.x, s.y);
        if (UNIT_ROTATE) ctx.rotate(_ang);
        const barX = -barW / 2;
        const barY = -_kh / 2 - barH - 2 * zoom;      // kutunun üst kenarının hemen üstü

        ctx.fillStyle = '#222'; ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = ratio > 0.5 ? '#4cff7c' : ratio > 0.25 ? '#ffaa00' : '#ff3333';
        ctx.fillRect(barX, barY, barW * ratio, barH);
        ctx.strokeStyle = '#000'; ctx.strokeRect(barX, barY, barW, barH);

        // ── OKUNABİLİRLİK: bastırma çubuğu (can altında) + durum rozeti (zoom-out'ta bile görünür) ──
        if (this.suppression > 5) {
            const supRatio = Math.min(1, this.suppression / 100);
            const sbY = barY + barH + 1 * zoom;
            const sbH = Math.max(2, 2 * zoom);
            ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(barX, sbY, barW, sbH);
            ctx.fillStyle = this.suppression > PINNED_SUPPRESSION ? '#ff3b3b' : this.suppression > 50 ? '#ff7b00' : '#ffd24c';   // PINNED=kırmızı, ağır=turuncu, hafif=sarı
            ctx.fillRect(barX, sbY, barW * supRatio, sbH);
        }
        // Durum rozeti: kaçış/ağır-baskı 3px nokta → kamera uzakken bile "kim eziliyor" okunur
        if (this.isFleeing || this.suppression > 50) {
            const dotR = Math.max(2.5, 2.5 * zoom);
            ctx.beginPath(); ctx.arc(barX - dotR - 2, barY + barH / 2, dotR, 0, Math.PI * 2);
            ctx.fillStyle = this.isFleeing ? '#ff2b2b' : (this.suppression > PINNED_SUPPRESSION ? '#ff3b3b' : '#ff9d2b');
            ctx.fill();
            ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke();
        }
        ctx.restore();

        // İnşaat Barı
        if (this.buildTrenchTimer > 0) {
            ctx.fillStyle = 'rgba(100, 100, 100, 0.8)';
            ctx.fillRect(s.x - 12*zoom, s.y - 16*zoom, 24*zoom, 4*zoom);
            ctx.fillStyle = '#ffcc00';
            ctx.fillRect(s.x - 12*zoom, s.y - 16*zoom, 24 * zoom * (this.buildTrenchTimer / 3.0), 4*zoom);
        }
    }
}

function resolveCollisions() {
    const MIN_DIST = UNIT_RADIUS * 1.9;
    // KARE SINIR: kutu çakışması köşeye kadar sürer → ızgara sorgusu KÖŞEGENİ kapsamalı,
    // yoksa çapraz duran çift hiç sınanmaz ve birimler köşeden iç içe geçer.
    const BOX = (typeof battleBoxCollision === 'function') && battleBoxCollision();
    const QUERY_R = BOX ? Math.hypot(UNIT_HALF_W * 2, UNIT_HALF_H * 2) : MIN_DIST;
    const gridMode = typeof MAP_MODE !== 'undefined' &&
        MAP_MODE === 'grid' &&
        typeof isPassableAt === 'function';

    // Hareket adımı araziyi kontrol eder; çarpışma itmesi de aynı kurala uymalıdır.
    // Önceki sürüm bu aşamada birlik merkezlerini su/dağ hücresine itebiliyordu.
    if (gridMode) {
        for (const unit of SIM.units) {
            if (unit.dead || unit.loaded) continue;   // YÜKLÜ yolcu taşıyıcısını takip eder (Unit.js:141); snap'lersek her tik taşıyıcı↔snap çakışır → IŞINLANMA
            if (unit.isAir || isPassableAt(unit.x, unit.y)) {   // HAVA: su/dağ üstünde uçar, karaya geri-itilmez
                unit._lastPassableX = unit.x;
                unit._lastPassableY = unit.y;
                continue;
            }
            const fallbackValid =
                Number.isFinite(unit._lastPassableX) &&
                Number.isFinite(unit._lastPassableY) &&
                isPassableAt(unit._lastPassableX, unit._lastPassableY);
            const safe = fallbackValid
                ? { x: unit._lastPassableX, y: unit._lastPassableY }
                : nearestPassable(unit.x, unit.y, 30);
            unit.x = safe.x;
            unit.y = safe.y;
        }
    }

    // TITREME KOK-NEDENI (KULLANICI: "nakliye helolari birim tasirken cok titriyordu") — OLCULDU:
    // ayirma dongusu yalniz `dead`'i eliyordu, `loaded`'i DEGIL. Yolcular her tik tasiyicinin TAM AYNI
    // koordinatina konur (updateTransport: p.x = this.x) -> mesafe ~0 -> asagidaki `dist <= 0.01` dali
    // devreye girip helo ile kendi kargosunu tam MIN_DIST/2 kadar birbirinden iter. Izde (tools/
    // helo-titreme-iz.js) helo "hold=1, mov=0" iken bile tik basina ~30px savruluyordu ve evre
    // kirilimi teslim ucusunda %90 yon-tersine-donus verdi. Aract icindeki yolcu fizige gorunmemeli
    // (hedeflemede zaten gorunmuyor). BATTLE_FERRY_FIX ile kapatilabilir (A-B izolasyonu).
    for (let i = 0; i < SIM.units.length; i++) {
        if (SIM.units[i].dead || (SIM.units[i].loaded && battleFerryFix(SIM.units[i].isRed))) continue;
        const a = SIM.units[i];
        const nearby = SIM.spatialGrid.getNearby(a.x, a.y, QUERY_R);
        for (let j = 0; j < nearby.length; j++) {
            const b = nearby[j];
            if (b.dead || a === b || (b.loaded && battleFerryFix(b.isRed))) continue;
            // ÇÜRÜTÜLEN HİPOTEZ (2026-08-07): "ayırma fiziği hava↔kara birimini itiyor, dron titremesi
            // bundan" denendi (`a.isAir !== b.isAir` → atla). Titreme AZALMADI, ARTTI (ort. ters/sn
            // 0.32 → 0.59). Yani dron salınımı çarpışma itmesinden DEĞİL. Kanıt: adım std'si SIFIR ve
            // her adım tam 13.5px (azami hız) — itme olsaydı adım boyu düzensiz olurdu. Geri alındı.
            // Her çifti yalnız bir kez çöz. İki yönlü çözüm dar geçitlerde gereksiz
            // itme biriktiriyor ve birlikleri engel hücresine taşıyabiliyordu.
            if (b.id <= a.id) continue;
            const bridgeTransit = gridMode &&
                typeof isBridgeAt === 'function' &&
                (isBridgeAt(a.x, a.y) || isBridgeAt(b.x, b.y));
            const friendlyRouteTransit = gridMode &&
                a.isRed === b.isRed &&
                ((a._navPath && a._navPath.length) ||
                 (b._navPath && b._navPath.length));
            // Tek birlik genişliğindeki köprüde sert dost çarpışması konvoyu
            // tamamen kilitliyordu. Dostlar ve geri çekilenler köprü üzerinde
            // yumuşak geçer; karşılıklı savaşan düşmanlar birbirini tutmaya devam eder.
            // Aynı şekilde aktif rota izleyen dost konvoyları birbirini bloke etmez.
            const softTransit = friendlyRouteTransit || (bridgeTransit &&
                (a.isRed === b.isRed || a.isFleeing || b.isFleeing));
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            // Tam aynı koordinat eski dist>0.01 koşulunda sonsuza kadar üst üste
            // kalıyordu. Kimliklerden türetilen ayırma yönü deterministiktir.
            if (dist <= 0.01) {
                const angle = ((a.id * 31 + b.id * 17) % 360) * Math.PI / 180;
                dx = Math.cos(angle) * 0.02;
                dy = Math.sin(angle) * 0.02;
                dist = 0.02;
            }
            let pushX = 0, pushY = 0;
            if (BOX) {
                // ── EKSEN-HIZALI KUTU (AABB) AYIRMA ──
                // Birim sprite'ı kadar (BASE_DRAW_W × BASE_DRAW_H) bir kutudur. Çakışma iki eksende
                // birden batma varsa vardır; itme EN AZ batan eksende yapılır (minimum translation
                // vector). Böylece yan yana duran birimler ızgaraya oturur ve köşe teması diagonal
                // savrulma üretmez — eski daire hem köşeleri iç içe alıyor hem kenarda boşluk bırakıyordu.
                const shrink = softTransit ? 0.78 : 1;
                const needX = UNIT_HALF_W * 2 * shrink;
                const needY = UNIT_HALF_H * 2 * shrink;
                const penX = needX - Math.abs(dx);
                const penY = needY - Math.abs(dy);
                if (penX > 0 && penY > 0) {
                    // TİTREME UYARISI (ölçüldü): "yalnız en az batan ekseni it" kuralı penX≈penY
                    // olduğunda her tik EKSEN DEĞİŞTİRİYOR → sağ-sol-yukarı-aşağı pinpon (4 tohumda
                    // ort. ters/sn 0.10 → 0.15). Süreksizliği kaldırmak için itme iki eksene
                    // SÜREKLİ bir ağırlıkla dağıtılır: bir eksen belirgin şekilde sığsa (penX≪penY)
                    // sonuç klasik MTV'ye iner, eşitlikte ise köşegen tek bir itme olur.
                    // Ağırlık KARESEL: sığ eksen baskın çıkar (penX=1,penY=10 → itmenin %99'u X'te,
                    // yani klasik MTV), eşitlikte ikiye bölünür (köşegen, tek yönlü, salınımsız).
                    const wsum = penX * penX + penY * penY;
                    const wX = penY * penY / wsum, wY = penX * penX / wsum;
                    pushX = (dx >= 0 ? 1 : -1) * (penX / 2) * wX;
                    pushY = (dy >= 0 ? 1 : -1) * (penY / 2) * wY;
                }
            } else {
                const requiredDist = softTransit ? MIN_DIST * 0.78 : MIN_DIST;
                if (dist < requiredDist) {
                    const overlap = (requiredDist - dist) / 2;
                    pushX = (dx / dist) * overlap;
                    pushY = (dy / dist) * overlap;
                }
            }
            if (pushX !== 0 || pushY !== 0) {
                const ax = a.x - pushX, ay = a.y - pushY;
                const bx = b.x + pushX, by = b.y + pushY;
                if (!gridMode || isPassableAt(ax, ay)) {
                    a.x = ax;
                    a.y = ay;
                }
                if (!gridMode || isPassableAt(bx, by)) {
                    b.x = bx;
                    b.y = by;
                }
            }
        }
    }

    if (!gridMode) {
        for (const u of SIM.units) {
            if (u.dead) continue;
            for (const t of terrainFeatures) {
                if (t.type === TERRAIN.MOUNTAIN) {
                    const dx = u.x - t.x; const dy = u.y - t.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const mountainMinDist = UNIT_RADIUS + t.r;
                    if (dist < mountainMinDist && dist > 0.01) {
                        const overlap = mountainMinDist - dist;
                        u.x += (dx / dist) * overlap; u.y += (dy / dist) * overlap;
                    }
                }
            }
        }
        return;
    }

    // Son savunma hattı: başka bir fizik etkisi (ör. knockback) geçilemez
    // hücreye soktuysa deterministik biçimde son güvenli konuma geri al.
    for (const unit of SIM.units) {
        if (unit.dead || unit.loaded) continue;   // YÜKLÜ yolcu taşıyıcısını takip eder — snap'ten muaf (ışınlanma önlenir)
        unit.x = Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS, unit.x));
        unit.y = Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS, unit.y));
        if (unit.isAir) continue;   // HAVA: su/dağ üstünde uçar — geçilebilir-snap'ten muaf (kara-birimi geri-atma bunu vurmasın)
        if (!isPassableAt(unit.x, unit.y)) {
            const fallbackValid =
                Number.isFinite(unit._lastPassableX) &&
                Number.isFinite(unit._lastPassableY) &&
                isPassableAt(unit._lastPassableX, unit._lastPassableY);
            const safe = fallbackValid
                ? { x: unit._lastPassableX, y: unit._lastPassableY }
                : nearestPassable(unit.x, unit.y, 30);
            unit.x = safe.x;
            unit.y = safe.y;
        }
        if (isPassableAt(unit.x, unit.y)) {
            unit._lastPassableX = unit.x;
            unit._lastPassableY = unit.y;
        }
    }
}

// DRONE-OPERATÖR: operatör mühimmatını (kamikaze-drone) FIRLAT — payloadCount drone, batarya FIRLATMADA başlar (spawn=tam-yakıt +
// 0-yakıtta-düşme Faz0'da koşulsuz). manualTarget=(tx,ty)'ye en-yakın CANLI düşman (garanti-dalış) yoksa noktaya-uç+oto-dalış.
// operatorId=kontrol-bağı (ölünce ×0.6 kör-dalış, dive'da hesaplanır). Determinist (srand-scatter, dist+id-tiebreak). Oyuncu+AI ortak.
function battleLaunchDrones(operator, tx, ty) {
    if (!operator || operator.dead) return false;
    const pc = STATS[operator.type] && STATS[operator.type].payload;
    if (!pc) return false;
    const max = pc.count | 0;
    if (operator.payloadCount == null) operator.payloadCount = max;   // ilk-kullanımda dolu
    if (operator.payloadCount <= 0) return false;                     // mühimmat yok
    // KRİTİK-FIX (kullanıcı: "drone salınmıyor"): global T yalnız BÜYÜK-harf takma-ad (T.KAMIKAZE) → T['loitering_munition'](id) UNDEFINED
    // → droneType null → spawn OLMUYORDU. payload.type bir ID-string; sayısal tipi STATS'tan id ile bul (fallback: T büyük-harf).
    let droneType = (typeof T !== 'undefined' && T[pc.type] != null) ? T[pc.type] : null;
    if (droneType == null) { for (const k in STATS) { if (STATS[k] && STATS[k].id === pc.type) { droneType = +k; break; } } }
    if (droneType == null || !STATS[droneType]) return false;
    let tgt = null, tgtD = Infinity;   // hedef-noktaya en-yakın canlı düşman (determinist)
    for (const o of SIM.units) {
        if (o.dead || o.loaded || o.isRed === operator.isRed) continue;
        const d = Math.hypot(o.x - tx, o.y - ty);
        if (d < tgtD || (d === tgtD && tgt && o.id < tgt.id)) { tgtD = d; tgt = o; }
    }
    // KULLANICI-FIX ("benim dronlarım çarpmıyor"): oyuncu-drone playerControlled-dalı manualTarget+HAREKET ister (AI-drone
    // manualTarget'ı null'layıp oto-dalar → etkilenmezdi). ÇÖZÜM: bir düşman varsa DAİMA hedefle (900px-kilit kalktı → tıklama
    // düşmandan uzağa düşse de en-yakına kamikaze) + tam hareket-alanı (targetX/Y + manualMoveTarget + isMovingToManualTarget) kur.
    const useTgt = !!tgt;   // sahada düşman varsa daima dal (kamikaze); yoksa noktaya-uç (oto-savunma dalışı)
    const n = operator.payloadCount;
    for (let k = 0; k < n; k++) {
        const ang = (typeof srand === 'function' ? srand() : 0) * Math.PI * 2;
        const rad = 20 + (typeof srand === 'function' ? srand() : 0) * 30;
        const drone = new Unit(droneType, operator.x + Math.cos(ang) * rad, operator.y + Math.sin(ang) * rad, operator.isRed);
        drone.controlOwner = operator.controlOwner;
        drone.controllerId = operator.controllerId;
        drone.operatorId = operator.id;   // kontrol-bağı
        drone.launchX = tx; drone.launchY = ty;   // SON-ATILAN KONUM: hedef-yoksa oraya-uç, varınca (kimse yoksa) self-infilak
        if (useTgt) {
            drone.manualTarget = tgt; drone.attackTarget = tgt;
            drone.targetX = tgt.x; drone.targetY = tgt.y;
            drone.manualMoveTarget = { x: tgt.x, y: tgt.y }; drone.isMovingToManualTarget = true;
        } else { drone.targetX = tx; drone.targetY = ty; drone.manualMoveTarget = { x: tx, y: ty }; drone.isMovingToManualTarget = true; }
        SIM.units.push(drone);
    }
    operator.payloadCount = 0;
    if (typeof battleRecordLifeEvent === 'function') battleRecordLifeEvent({ kind: 'LAUNCH', unitId: operator.id, side: operator.isRed ? 'red' : 'blue', type: operator.type, count: n, targetId: useTgt ? tgt.id : null, x: Math.round(operator.x * 100) / 100, y: Math.round(operator.y * 100) / 100 });
    return true;
}

function placeUnit(type, worldX, worldY, isRed) {
    const s = STATS[type];
    // GRID MODU: dağ/su (köprü hariç) üzerine birlik konmasın → en yakın geçilebilir noktaya sabitle
    if (typeof MAP_MODE !== 'undefined' && MAP_MODE === 'grid' && typeof isPassableAt === 'function' && !isPassableAt(worldX, worldY)) {
        const np = nearestPassable(worldX, worldY, 20);
        worldX = np.x; worldY = np.y;
    }
    // FAZ-3 HAVUZ: hikaye modunda oyuncu ŞEHİRLERDE ÜRETTİĞİ orduyu dizer — para değil ADET kısıtı.
    // DEPLOY_POOL null iken (Quick Match / MP / acil seferberlik) bu dal hiç çalışmaz.
    if (!isRed && typeof DEPLOY_POOL !== 'undefined' && DEPLOY_POOL) {
        if ((DEPLOY_POOL[type] | 0) <= 0) return false;
        DEPLOY_POOL[type]--;
        player.unitsSpawned++;
        const u = new Unit(type, worldX, worldY, isRed);
        applyTechSpawnBonus(u);
        if (typeof storyTagVeteran === 'function') storyTagVeteran(u);   // kıdem havuz birimine yapışır
        SIM.units.push(u);
        return true;
    }
    // FAZ-2 KAYNAK-BAZLI: OYUNCU (mavi) ilgili kaynak bütçesinden öder (zırhlı→petrol, piyade→insan, topçu→puan)
    if (!isRed && typeof DEPLOY_RES !== 'undefined' && DEPLOY_RES && DEPLOY_RES.blue) {
        const g = (typeof UNIT_RES_GROUP !== 'undefined' && UNIT_RES_GROUP[type]) || 'manpower';
        let cost = s.cost;   // TEKNOLOJİ: deploy-maliyeti indirimi (Dizel −petrol / Zorunlu Hizmet −insan / Savaş Ekonomisi −hepsi)
        if (typeof TECH_BONUS !== 'undefined' && TECH_BONUS) {
            let cm = TECH_BONUS.allCost || 1;
            if (g === 'oil' && TECH_BONUS.oilCost) cm *= TECH_BONUS.oilCost;
            if (g === 'manpower' && TECH_BONUS.manpowerCost) cm *= TECH_BONUS.manpowerCost;
            if (cm !== 1) cost = Math.max(1, Math.round(s.cost * cm));
        }
        if ((DEPLOY_RES.blue[g] || 0) < cost) return false;
        DEPLOY_RES.blue[g] -= cost;
        player.unitsSpawned++;
        const u = new Unit(type, worldX, worldY, isRed);
        applyTechSpawnBonus(u);   // TEKNOLOJİ: zırh/hız/görüş/hp spawn-buff (mavi)
        if (typeof storyTagVeteran === 'function') storyTagVeteran(u);   // KIDEM: acil seferberlikte de gaziler savaşır
        SIM.units.push(u);
        return true;
    }
    // FAZ-2 KAYNAK-BAZLI: kırmızı da hikâye düellosunda ilgili kaynaktan öder.
    if (isRed && typeof DEPLOY_RES !== 'undefined' && DEPLOY_RES && DEPLOY_RES.red) {
        const g = (typeof UNIT_RES_GROUP !== 'undefined' && UNIT_RES_GROUP[type]) || 'manpower';
        let cost = s.cost;
        if (typeof TECH_BONUS_RED !== 'undefined' && TECH_BONUS_RED) {
            let cm = TECH_BONUS_RED.allCost || 1;
            if (g === 'oil' && TECH_BONUS_RED.oilCost) cm *= TECH_BONUS_RED.oilCost;
            if (g === 'manpower' && TECH_BONUS_RED.manpowerCost) cm *= TECH_BONUS_RED.manpowerCost;
            if (cm !== 1) cost = Math.max(1, Math.round(s.cost * cm));
        }
        if ((DEPLOY_RES.red[g] || 0) < cost) return false;
        DEPLOY_RES.red[g] -= cost;
        enemy.unitsSpawned++;
        const u = new Unit(type, worldX, worldY, isRed);
        applyTechSpawnBonus(u);
        SIM.units.push(u);
        return true;
    }
    // TEK-PARA: kırmızı Quick Match/MP + mavi tek-para
    const src = isRed ? enemy : player;
    if (src.money < s.cost) return false;
    src.money -= s.cost;
    src.unitsSpawned++;
    const u2 = new Unit(type, worldX, worldY, isRed);
    applyTechSpawnBonus(u2);   // Kırmızı hikâye teknoloji bonusu (Quick/MP'de kapalı)
    SIM.units.push(u2);
    return true;
}
