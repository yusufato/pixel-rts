// ═══════════════════════════════════════════════════════════════
//  BİRLİK SINIFI
// ═══════════════════════════════════════════════════════════════
function battleUnitVisibleToViewer(unit, viewerSide, phaseValue) {
    if (!unit || unit.dead) return false;
    if (unit.isRed === viewerSide) return true;
    if (phaseValue === PHASE.DEPLOY) return false;
    if (phaseValue === PHASE.BATTLE) return canSee(viewerSide, unit.x, unit.y);
    return true;
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
        this._detect = s.detect || 0;                        // gizli düşmanı tespit yarıçapı çarpanı
        this._stationaryT = 0;   // kaç sn hareketsiz (siperlenme + pusu için)
        this.entrench = 0;       // 0..1 siperlenme (dig_in): gelen hasarı azaltır
        this.kills = 0;
        this.level = 0; // 0: Çaylak, 1: Deneyimli, 2: Gazi
        
        // Rütbe çarpanları (HP ve Atk için)
        this.xpBonus = 1.0;

        this.sx = SP_PAD + type * (SP_W + SP_PAD);
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
        // Eski denge 60 FPS kare adımına göre kuruluydu. frameScale, aynı oranları
        // koruyup simülasyonu render FPS'i ve multiplayer tick hızından bağımsız yapar.
        const frameScale = Math.max(0, dtSec * 60);

        if (this.flashTimer > 0) this.flashTimer -= frameScale;
        if (this.revealTimer > 0) this.revealTimer -= frameScale;   // T3 PUSU: açıkta kalma süresi azalır → tekrar gizlenir
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

        if (this.isAir && this.maxFuel > 0) this.updateFuel(now, dtSec);   // YAKIT: uçarken yak, düşük→üsse dön, biter→düş
        if (this.dead) return;                                             // yakıt bitip düştüyse

        if (!this._returningToBase) {   // üsse dönerken savaşmaz/taşımaz — yalnız eve uçar (targetX üsse ayarlı)
            if (this.transportSlots) this.updateTransport(now, dtSec);   // TAŞIMA: nakliye-heli piyade bindir-taşı-indir
            this.engageCombat(now);
            this.fireSecondaryWeapons(now, dtSec);   // ÇOKLU-SİLAH: 2. silah (MBT makinelisi anti-piyade / komando yıkım-şarjı) ayrı hedefe ateş eder
        }

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
            if (this._motionStalls >= 1 && _gridMode) {
                const _goalAngle = Math.atan2(
                    this.targetY - this.y,
                    this.targetX - this.x
                );
                this._unstickAttempts = (this._unstickAttempts || 0) + 1;
                // Aynı taraftaki engel boyunca aynı başarısız yan-adımı
                // tekrarlama; her denemede tarafı deterministik olarak değiştir.
                const _side = ((this.id + this._unstickAttempts) & 1) ? 1 : -1;
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

        if (distToTarget > movementSpeed + 1) {
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
                let stepX = (moveX / finalDist) * movementSpeed;
                let stepY = (moveY / finalDist) * movementSpeed;
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
        }
        
        if (this.attackTarget && !this.isFleeing) {
            this.facingAngle = Math.atan2(this.attackTarget.y - this.y, this.attackTarget.x - this.x);
        }

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
        for (const t of SIM.trenches) {
            if (t.isRed === this.isRed && Math.hypot(this.x - t.x, this.y - t.y) < t.r) {
                this.inTrench = true;
                this.inSupply = t.providesSupply !== false;
                break;
            }
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
                this.buildTrenchTimer += frameScale / 60;
                if (Math.random() < 0.1 && typeof spawnHitSparks !== 'undefined') spawnHitSparks(this.x, this.y);
                if (this.buildTrenchTimer > 3.0) {
                    SIM.trenches.push({
                        x: this.x,
                        y: this.y,
                        r: 105,                       // 72→105: ikmal alanı genişletildi (kullanıcı "çok küçük")
                        isRed: this.isRed,
                        hp: 320,
                        maxHp: 320,
                        providesSupply: true,
                        providesAir: true,            // HELİPAD: hava birimi de burada yakıt + mühimmat alır (helo ikmal noktası)
                        createdAt: now,
                        expiresAt: now + SUPPLY_FIELD_DURATION_MS
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
                    if (u.suppression > 0) u.suppression = Math.max(0, u.suppression - 12 * dt);   // komuta = soğukkanlılık
                    if (u.panic > 0) u.panic = Math.max(0, u.panic - (this._canRally ? 22 : 9) * dt);   // RALLY: komuta-aracı kaçan dostu HIZLA toplar
                    if (this._canRally && u.isFleeing && u.panic < 45) { u.isFleeing = false; u.combatState = 'READY'; }   // RALLY: paniği düşene "dur, savaş"
                }
            }
        } else if (aura.type === 'jamming') {
            for (const u of nearby) {   // JAMMING: yakın DÜŞMANLARI damgala (drone etkisiz + isabet cezası → FAZ 2)
                if (u.dead || u.isRed === this.isRed) continue;
                const dx = u.x - this.x, dy = u.y - this.y; if (dx * dx + dy * dy <= r2) u.jammedTick = SIM.tick;
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
    _transportDropOne() {   // bir yolcuyu araç çevresine bırak (deterministik saçılım)
        const p = this.cargo.shift();
        if (!p) return;
        const ang = srand() * Math.PI * 2, dd = 35 + srand() * 45;
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
                    t.loaded = true; t.carrier = this; t.attackTarget = null; t.isFleeing = false; this.cargo.push(t);
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

        const deliverY = this.isRed ? WORLD_H * 0.60 : WORLD_H * 0.40;   // düşman hattına doğru orta-ileri (intihar değil)

        if (this.cargo.length > 0) {
            // ── TESLİM: hatta yaklaş, düşman yakınında veya hatta varınca İNDİR ──
            let enemyNear = false;
            const near = SIM.spatialGrid.getNearby(this.x, this.y, TRANSPORT_UNLOAD_TRIGGER);
            for (const o of near) { if (!o.dead && !o.loaded && o.isRed !== this.isRed) { enemyNear = true; break; } }
            const atFront = this.isRed ? (this.y >= deliverY) : (this.y <= deliverY);
            if (enemyNear || atFront) {
                this.targetX = this.x; this.targetY = this.y; this.manualMoveTarget = null; this.isMovingToManualTarget = false;
                this._unloadTimer = (this._unloadTimer == null ? TRANSPORT_UNLOAD_TIME : this._unloadTimer) - dtSec;
                if (this._unloadTimer <= 0) { this._unloadTimer = TRANSPORT_UNLOAD_TIME; this._transportDropOne(); }
            } else {
                this.targetX = this.x; this.targetY = deliverY;   // hatta doğru uç
                this.manualMoveTarget = { x: this.x, y: deliverY }; this.isMovingToManualTarget = true;
            }
            return;
        }

        // ── BOŞ: kendi yarısındaki, ateş-etmeyen (boşta) en yakın piyadeyi al ──
        let cand = null, best = 1e9;
        for (const o of SIM.units) {
            if (o.dead || o.loaded || o === this || o.isRed !== this.isRed) continue;
            if (!this._transportAccepts(o)) continue;
            if (o.attackTarget || o.enemyInVision || o.isFleeing) continue;   // savaşan/kaçan piyadeyi çekme (cepheyi bozma)
            const ownHalf = this.isRed ? (o.y < WORLD_H * 0.5) : (o.y > WORLD_H * 0.5);
            if (!ownHalf) continue;                                          // yalnız geri-bölgedeki takviyeyi taşı
            const d = Math.hypot(o.x - this.x, o.y - this.y);
            if (d < best) { best = d; cand = o; }
        }
        if (!cand) { this._loadTimer = TRANSPORT_LOAD_TIME; return; }
        const d = Math.hypot(cand.x - this.x, cand.y - this.y);
        if (d > TRANSPORT_LOAD_RADIUS) {
            this.targetX = cand.x; this.targetY = cand.y;   // yolcuya uç
            this.manualMoveTarget = { x: cand.x, y: cand.y }; this.isMovingToManualTarget = true;
            this._loadTimer = TRANSPORT_LOAD_TIME;
        } else {
            this.targetX = this.x; this.targetY = this.y; this.manualMoveTarget = null; this.isMovingToManualTarget = false;   // hover
            this._loadTimer = (this._loadTimer == null ? TRANSPORT_LOAD_TIME : this._loadTimer) - dtSec;
            if (this._loadTimer <= 0) {
                this._loadTimer = TRANSPORT_LOAD_TIME;
                if (this.cargo.length < this.transportSlots) {
                    cand.loaded = true; cand.carrier = this; cand.attackTarget = null; cand.isFleeing = false;
                    this.cargo.push(cand);                }
            }
        }
    }

    // ── YAKIT/SORTİ (hava birimleri): uçarken yak → %30 altı üsse dön → üste ikmal → biter DÜŞER (kamikaze tek-yön hariç) ──
    // AI İSTİHKAM: aktif-yetenekleri kullan (insan-simetrisi) — (1) terk-edilmiş aracı ele geçir, (2) ileri siper/helipad kur.
    updateEngineerAI(now, dtSec) {
        if (this.buildTrenchTarget) return;   // zaten inşa ediyor
        // DURUŞ-BAĞI (analist): CONSOLIDATE (kazandık+lull) → kapma/tamir penceresi AÇIK; sahayı kontrol ettiğimiz için geometri gevşer.
        let _stance = null, _winning = false;
        if (typeof BATTLE_CONTROLLERS !== 'undefined' && this.controllerId) {
            const _c = BATTLE_CONTROLLERS.get(this.controllerId);
            const _s = _c && _c.lastSituation;
            if (_s) { _stance = _s.operationalPosture && _s.operationalPosture.stance; _winning = (_s.forceRatio || 0) > 1.6; }
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
            if (d < 1300 && d < capD) { capD = d; cap = o; }   // geniş yarıçap: enkaz değerli, uzaktan bile gidip kap
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
        const inOwnHalf = this.isRed ? (this.y < WORLD_H * 0.55) : (this.y > WORLD_H * 0.45);
        let closeThreat = false;   // yakın-tehdit yoksa çalış (uzaktan görmek engel değil)
        const _cn = SIM.spatialGrid.getNearby(this.x, this.y, 360);
        for (const o of _cn) { if (!o.dead && !o.abandoned && o.isRed !== this.isRed) { closeThreat = true; break; } }
        if (!inOwnHalf || closeThreat || this.isFleeing || (this.suppression || 0) >= 25) return;
        // (2) İLERİ SİPER/HELİPAD: yakında dost supply-field YOKSA → kur (kara-ikmal + helo yakıt)
        let hasField = false;
        for (const t of SIM.trenches) { if (t.isRed === this.isRed && t.providesSupply !== false && Math.hypot(t.x - this.x, t.y - this.y) < 520) { hasField = true; break; } }
        if (!hasField) { this.buildTrenchTarget = { x: this.x, y: this.y }; return; }
        // (3) MAYIN: field kurulu → ileri-hatta mayın döşe (yakında dost mayın yoksa, ~her 3sn)
        const fwd = this.isRed ? (this.y > WORLD_H * 0.28) : (this.y < WORLD_H * 0.72);   // orta-ileri bölge (savunma hattı)
        if (!fwd) return;
        for (const m of SIM.mines) { if (m.isRed === this.isRed && Math.hypot(m.x - this.x, m.y - this.y) < 130) return; }   // yakında mayın var
        this._mineTimer = (this._mineTimer || 0) - dtSec;
        if (this._mineTimer <= 0) {
            this._mineTimer = 3.0;
            SIM.mines.push({ x: this.x, y: this.y, r: MINE_TRIGGER_R, isRed: this.isRed, armed: false, createdAt: now, armDelay: 1500 });
            if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) BATTLE_BALANCE.minesLaid++;
        }
    }

    updateFuel(now, dtSec) {
        const oneWay = STATS[this.type] && STATS[this.type].singleUse;   // kamikaze impact'e gider, dönmez
        const busyTransport = this.transportSlots > 0 && this.cargo && this.cargo.length > 0;   // yüklü taşıma önce teslim eder
        const atBaseEdge = this.isRed ? (this.y <= WORLD_H * 0.18) : (this.y >= WORLD_H * 0.82);
        // HELİPAD: dost ikmal-alanı (istihkam trench, providesAir) → helo orada yakıt+mühimmat alır; en yakınını da bul (dönüş hedefi)
        let overField = false, fieldX = null, fieldY = null, fieldD = Infinity;
        for (const t of SIM.trenches) {
            if (t.isRed !== this.isRed || t.providesSupply === false || !t.providesAir) continue;
            const d = Math.hypot(this.x - t.x, this.y - t.y);
            if (d < t.r) overField = true;
            if (d < fieldD) { fieldD = d; fieldX = t.x; fieldY = t.y; }
        }
        const atBase = atBaseEdge || overField;

        if (atBase && this.fuel < this.maxFuel) {   // ÜSTE/HELİPAD'DA İKMAL (~18sn tam dolum)
            this.fuel = Math.min(this.maxFuel, this.fuel + (this.maxFuel / 18) * dtSec);
            if (this.fuel >= this.maxFuel * 0.9) this._returningToBase = false;   // doldu → göreve dön
            return;
        }
        this.fuel -= this.fuelBurn * dtSec;   // uçarken yakıt yanar
        if (this.fuel <= 0) {
            this.fuel = 0;
            if (!oneWay) { this.hp = 0; this.dead = true; return; }   // yakıt bitti → düşer
        }
        if (!oneWay && !busyTransport && this.fuel <= this.maxFuel * 0.30 && !this._returningToBase) {   // düşük → dön (sortı tamamlandı)
            this._returningToBase = true;
            if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) BATTLE_BALANCE.heloSorties++;
            if (typeof battleRecordLifeEvent === 'function') battleRecordLifeEvent({ kind: 'RTB', unitId: this.id, side: this.isRed ? 'red' : 'blue', type: this.type, fuel: Math.round((this.fuel || 0) * 100) / 100, maxFuel: Math.round((this.maxFuel || 0) * 100) / 100, x: Math.round(this.x * 100) / 100, y: Math.round(this.y * 100) / 100 });
        }
        if (this._returningToBase) {   // en yakın HELİPAD'a (yoksa üs-kenarına) dön
            const baseEdgeY = this.isRed ? WORLD_H * 0.14 : WORLD_H * 0.86;
            const useField = (fieldX != null && fieldD < Math.abs(this.y - baseEdgeY));   // helipad daha yakınsa oraya
            this.attackTarget = null; this.manualTarget = null;
            this.targetX = useField ? fieldX : this.x;
            this.targetY = useField ? fieldY : baseEdgeY;
            this.manualMoveTarget = { x: this.targetX, y: this.targetY }; this.isMovingToManualTarget = true;
        }
    }

    engageCombat(now) {
        // SİLAHSIZ birimler savaşmaz (sağlıkçı/istihkam*/ikmal/HQ/EH/radar/nakliye-heli/keşif-İHA). *istihkamın hafif silahı var.
        const __w = STATS[this.type] && STATS[this.type].weapons;
        if (!__w || !__w.length) return;
        // JAMMING: EH-aracı alanındaki jammable drone bağlantısını kaybeder → ateş edemez (bu ve geçen tik damgalıysa).
        if (this.jammable && typeof SIM !== 'undefined' && (SIM.tick - (this.jammedTick || -99)) <= 1) { this.combatState = 'Karıştırıldı'; return; }

        const playerControlled = this.controlOwner === 'PLAYER';
        if (playerControlled) {
            if (this.manualTarget && !this.manualTarget.dead && canSee(false, this.manualTarget.x, this.manualTarget.y)) {
                this.attackTarget = this.manualTarget;
            } else {
                this.manualTarget = null;
                if (!this.attackTarget || this.attackTarget.dead || !canSee(false, this.attackTarget.x, this.attackTarget.y) || Math.hypot(this.attackTarget.x - this.x, this.attackTarget.y - this.y) > this.range * 1.3) {
                    const nearby = this.findBestVisibleEnemy();
                    if (nearby && nearby.dist <= this.range) this.attackTarget = nearby.unit;
                    else this.attackTarget = null;
                }
            }

            if (this.attackTarget) {
                const d = Math.hypot(this.attackTarget.x - this.x, this.attackTarget.y - this.y);
                if (d <= this.range) {
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
                   canSee(this.isRed, this.manualTarget.x, this.manualTarget.y)) {
            // Denetleyici hedef SEÇER; birim yalnız emri icra eder. Burada karar/target scoring yoktur.
            this.attackTarget = this.manualTarget;
            const d = Math.hypot(this.attackTarget.x - this.x, this.attackTarget.y - this.y);
            if (d <= this.range) {
                this.targetX = this.x;
                this.targetY = this.y;
                this.performAttack(now);
            } else {
                // FAZ 5 MENZİLE-YAKLAŞ: SAVUNAN hedefin üstüne koşmasın, silah menziline (0.9×) girip HATTI TUTSUN
                // (blob + hat-kapalı + kuşatılma azalır). SALDIRAN ise kapatıp EZER (menzilde durursa düşman kaçar/
                // toparlanır → saldırı boğulur). Ölçüldü: savunma -26→+295, saldırıda stand-off zararlı. Bayraklı.
                let standOff = false;
                if (typeof BATTLE_UNIT_MICRO === 'undefined' || BATTLE_UNIT_MICRO) {
                    const ctrl = (typeof BATTLE_CONTROLLERS !== 'undefined' && this.controllerId) ? BATTLE_CONTROLLERS.get(this.controllerId) : null;
                    const sit = ctrl && ctrl.lastSituation;
                    const gate = sit && sit.operationalPosture;
                    if ((typeof BATTLE_POSTURE_GATE === 'undefined' || BATTLE_POSTURE_GATE) && gate && typeof gate.strikeGateOpen === 'boolean') {
                        // TAARRUZ-KAPISI: kapı KAPALIYSA (koşullar/urgency STRIKE demiyorsa) role fark etmez —
                        // birim menzilde durup ŞEKİLLENDİRİR (menzilden ateşle yıprat). Kapı AÇILINCA kapat-ez.
                        // "AI STRIKE'ta doğmaz"; saldıran da koşullar sağlanana/urgency zorlayana dek kötü-takasa dalmaz.
                        standOff = !gate.strikeGateOpen;
                    } else {
                        // Fallback (kapı kapalı/yok): eski davranış — savunan stand-off, saldıran press.
                        const role = sit && sit.role;
                        standOff = role != null && role !== (typeof BATTLE_ROLE !== 'undefined' ? BATTLE_ROLE.ATTACKER : 'attacker');
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
                    const ctrl2 = (typeof BATTLE_CONTROLLERS !== 'undefined' && this.controllerId) ? BATTLE_CONTROLLERS.get(this.controllerId) : null;
                    const gate2 = ctrl2 && ctrl2.lastSituation && ctrl2.lastSituation.operationalPosture;
                    if (gate2 && typeof gate2.strikeGateOpen === 'boolean') {
                        selfCloseOK = gate2.strikeGateOpen;
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

    findBestVisibleEnemy() {
        let bestTarget = null;
        let bestScore = -Infinity;

        const nearby = SIM.spatialGrid.getNearby(this.x, this.y, this.range * 1.5);
        const __as = STATS[this.type], __minR = __as ? (__as.minRange || 0) : 0;
        for (const u of nearby) {
            if (u.dead || u.isRed === this.isRed || u.abandoned) continue;   // terk-edilmiş araç NÖTR → hedeflenmez
            // HAVA/KARA UYGUNLUĞU: vuramayacağın hedefi hiç edinme (tank→hava=0, SAM→kara=0). Veri-güdümlü (weapon.targets).
            if (typeof unitCanEngage === 'function' && !unitCanEngage(__as, STATS[u.type])) continue;

            const d = Math.hypot(u.x - this.x, u.y - this.y);
            if (d > this.range * 1.5) continue;
            if (this._canHoldFire && d > this.range * 0.7) continue;   // HOLD_FIRE: sabırlı — yalnız %70 menzilde ateşle (MANPADS/TD pusu disiplini)
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
            if (this.isIndirect) { sc = -d; }   // dolaylı ateş: en yakın/görülene (splash zaten alan)
            else {
                const arm = (typeof STATS !== 'undefined' && STATS[u.type]) ? STATS[u.type].armor : 0;
                const dmg = (typeof calculateUnitDamage === 'function') ? calculateUnitDamage(this.type, u.type, this.atk, arm) : this.atk;
                sc = dmg / (1 + d * 0.012);   // counter-hasarı / yakınlık (yüksek=iyi eşleşme+yakın)
                if (this._autoAir && u.isAir) sc *= 2.5;   // AUTO_ENGAGE_AIR: SPAAG önce havayı vurur (hava-savunma önceliği)
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
    fireSecondaryWeapons(now, dtSec) {
        const ws = STATS[this.type] && STATS[this.type].weapons;
        if (!ws || ws.length < 2 || this.isFleeing || this.dead) return;
        const DM = (typeof UNITS_MODERN_DB !== 'undefined') ? UNITS_MODERN_DB.damageMatrix : null;
        if (!DM) return;
        for (let wi = 1; wi < ws.length; wi++) {
            const w = ws[wi];
            const cdKey = '_secCd' + wi;
            this[cdKey] = (this[cdKey] || 0) - dtSec;
            if (this[cdKey] > 0) continue;
            const wr = w.range || 0; if (wr <= 0) continue;
            const near = SIM.spatialGrid.getNearby(this.x, this.y, wr);
            let best = null, bestScore = -1;
            for (const n of near) {
                if (n.dead || n.loaded || n.isRed === this.isRed || n.abandoned) continue;
                const dom = n.isAir ? 'air' : 'ground';
                if (!(w.targets || ['ground']).includes(dom)) continue;
                const d = Math.hypot(n.x - this.x, n.y - this.y);
                if (d > wr || (w.minRange && d < w.minRange)) continue;
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
            const hpBefore = best.hp;
            best.hp -= dmg;
            best.flashTimer = 4;
            best.panic += (dmg / best.maxHp) * 80;
            if (best.isRed) best.lastHitTime = now;
            if (typeof battleRecordCombatEvent === 'function') {
                battleRecordCombatEvent({
                    kind: 'SECONDARY_FIRE', attackerId: this.id, attackerSide: this.isRed ? 'red' : 'blue', attackerType: this.type,
                    targetId: best.id, targetSide: best.isRed ? 'red' : 'blue', targetType: best.type,
                    damage: Math.round(Math.min(hpBefore, dmg) * 100) / 100, hpBefore: Math.round(hpBefore * 100) / 100,
                    hpAfter: Math.round(Math.max(0, best.hp) * 100) / 100, lethal: best.hp <= 0,
                    attackerX: Math.round(this.x * 100) / 100, attackerY: Math.round(this.y * 100) / 100,
                    targetX: Math.round(best.x * 100) / 100, targetY: Math.round(best.y * 100) / 100
                });
            }
            if (typeof spawnTracer !== 'undefined') spawnTracer(this.x, this.y, best.x, best.y, false);
            this[cdKey] = w.rof > 0 ? 1 / w.rof : 999;
            if (best.hp <= 0 && !best.dead) {
                best.dead = true;
                if (this.isRed) enemy.kills++; else player.kills++;
                this.kills++;
                decals.push(best.armor > 0 ? { x: best.x, y: best.y, type: 'wreck', size: 25, alpha: 1.0 }
                    : { x: best.x, y: best.y, type: 'blood', size: 12, alpha: 0.7 });
                if (decals.length > 5000) decals.shift();
            }
        }
    }

    performAttack(now) {
        if (!this.attackTarget || this.attackTarget.dead || this.isFleeing) return;
        if (this.maxAmmo > 0 && this.ammo <= 0 && this.type !== T.MEDIC) {   // maxAmmo=0 → mühimmat-sistemi YOK = SINIRSIZ (piyade/komando/istihkam tüfeği hep ateş eder); yalnız kapasiteli birim cephanesiz kalır
            this.combatState = 'Cephanesiz';
            return;
        }
        // HAVA/KARA UYGUNLUĞU: vuramayacağın hedefe ATEŞ ETME (mühimmat/cooldown boşa gitmesin). Emirli hedef de olabilir.
        if (typeof unitCanEngage === 'function' && !unitCanEngage(STATS[this.type], STATS[this.attackTarget.type])) {
            this.combatState = 'Vuramaz'; return;
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
        if (now - this.lastAttackTime < currentAtkSpeed) return;

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
            const tcx = primaryTarget.x, tcy = primaryTarget.y;
            // İSABET (dolaylı): topçu/ÇNRA HAREKETLİ hedefe ıskalar (vsMoving 0.85) + menzil-sonu düşüşü → salvo-başı tek çarpan
            let _indAcc = weaponAccuracy(this, _pw, primaryTarget, Math.hypot(tcx - this.x, tcy - this.y));
            if (this._needsDeploy && this._stationaryT < 1.5) _indAcc *= 0.4;   // DEPLOY: topçu/balistik hareket sonrası kurulmadan zayıf ateş
            for (let r = 0; r < salvo; r++) {
                let cx = tcx, cy = tcy;
                if (beatenZone > 0) {                          // deterministik düzgün-disk saçılım (SIM_RNG)
                    const ang = srand() * Math.PI * 2;
                    const dd = Math.sqrt(srand()) * beatenZone;
                    cx = tcx + Math.cos(ang) * dd; cy = tcy + Math.sin(ang) * dd;
                }
                // NOKTA-SAVUNMA: interceptable mermi (balistik/ÇNRA) düşman SAM menzilindeyse olasılıkla ÖNLENİR (füze harcar → doyurma işler)
                if (_pw.interceptable && typeof battlePointDefenseIntercept === 'function' && battlePointDefenseIntercept(this, cx, cy, _pw.damage)) continue;
                const suppR = blastR * 1.8;   // BASTIRMA-BÖLGESİ hasar-yarıçapından geniş → dolaylı ateş "alan-inkârı" yapar
                const splashNearby = SIM.spatialGrid.getNearby(cx, cy, suppR);
                for (const n of splashNearby) {
                    if (n.dead || n.isRed === this.isRed || n.abandoned) continue;       // sadece düşman (terk-edilmiş nötr atlanır)
                    const distance = Math.hypot(n.x - cx, n.y - cy);
                    if (distance > suppR) continue;
                    if (distance > blastR) {   // hasar-dışı ama BASTIRMA halkası: pinler (isabet almadan sindirir → havan/topçu değeri)
                        n.suppression = Math.min(100, n.suppression + 16);
                        if (n.isRed) n.lastHitTime = now;
                        continue;
                    }
                    const falloff = 1 - distance / blastR;
                    const blastDmg = Math.max(1, Math.floor(
                        applyTechCombatBonus(this, n, calculateUnitDamage(this.type, n.type, this.atk * this.xpBonus, n.armor)) *
                        (0.5 + falloff * 0.5) * _indAcc * incomingDamageMult(n)
                    ));
                    const hpBefore = n.hp;
                    const blastActual = Math.min(n.hp, blastDmg);
                    n.hp -= blastDmg;
                    if (typeof battleRecordCombatEvent === 'function') {
                        battleRecordCombatEvent({
                            kind: 'ARTILLERY_SPLASH',
                            attackerId: this.id,
                            attackerSide: this.isRed ? 'red' : 'blue',
                            attackerType: this.type,
                            targetId: n.id,
                            targetSide: n.isRed ? 'red' : 'blue',
                            targetType: n.type,
                            damage: Math.round(blastActual * 100) / 100,
                            hpBefore: Math.round(hpBefore * 100) / 100,
                            hpAfter: Math.round(Math.max(0, n.hp) * 100) / 100,
                            lethal: n.hp <= 0,
                            attackerX: Math.round(this.x * 100) / 100,
                            attackerY: Math.round(this.y * 100) / 100,
                            targetX: Math.round(n.x * 100) / 100,
                            targetY: Math.round(n.y * 100) / 100
                        });
                    }
                    n.panic += (blastDmg / n.maxHp) * 120;
                    n.flashTimer = 5;
                    if (typeof applyKnockback === 'function') applyKnockback(n, cx, cy, 1.6);
                    n.suppression += 30;                                  // alan baskısı
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
                        if (this.kills === 3 && this.level === 0) { this.level = 1; this.xpBonus = 1.15; this.maxHp *= 1.15; this.hp += this.maxHp * 0.15; }
                        else if (this.kills === 7 && this.level === 1) { this.level = 2; this.xpBonus = 1.30; this.maxHp *= 1.15; this.hp += this.maxHp * 0.15; }
                        if (n === primaryTarget) { this.attackTarget = null; this.manualTarget = null; }
                    }
                }
            }
            if (this.maxAmmo > 0) this.ammo--;
            this.lastAttackTime = now;
            this.revealTimer = AMBUSH_REVEAL_TICKS;   // T3 PUSU: ateş → açığa çık
            if (this._canScoot) {   // SHOOT-AND-SCOOT: ateş sonrası kendi tarafına ~180px geri çekil (karşı-batarya kaçış)
                const _by = this.isRed ? this.y - 180 : this.y + 180;
                const _sp = (typeof terrainSafePoint === 'function') ? terrainSafePoint(this.x, _by) : { x: this.x, y: _by };
                this.targetX = _sp.x; this.targetY = _sp.y; this.manualMoveTarget = _sp; this.isMovingToManualTarget = true;
            }
            const _fxScale = Math.min(3, blastR / 180) * (salvo > 3 ? 1.4 : 1);   // patlama görseli splash büyüklüğüne göre
            if (typeof spawnTracer !== 'undefined') spawnTracer(this.x, this.y, tcx, tcy, true);
            if (typeof spawnExplosion !== 'undefined') spawnExplosion(tcx, tcy, 1.7 * _fxScale);
            if (typeof triggerScreenShake === 'function') triggerScreenShake(Math.min(0.2, 0.09 * _fxScale));
            if (typeof triggerHitStop === 'function') triggerHitStop(3);
            return;
        }

        if (STATS[this.type].singleUse) {
            // ── KAMİKAZE / GEZİNEN MÜHİMMAT: hedefe DALIŞ → çarpma noktasında AĞIR alan-hasarı ──
            // Zırh-tipi fark etmez: warhead her kara şeyine ciddi hasar (en-iyi etki = max(he, shaped), taban 0.7).
            // Piyade 1.2 / hafif 1.2 / ağır 1.4 → dmg420 ile 504/504/588. Vurunca yok olur (tek-kullanım).
            const _pw = STATS[this.type].weapons[0];
            const blastR = _pw.aoe > 0 ? _pw.aoe : 100;
            const DM = (typeof UNITS_MODERN_DB !== 'undefined') ? UNITS_MODERN_DB.damageMatrix : null;
            const kcx = primaryTarget.x, kcy = primaryTarget.y;
            const kNearby = SIM.spatialGrid.getNearby(kcx, kcy, blastR);
            for (const n of kNearby) {
                if (n.dead || n.isRed === this.isRed || n.abandoned) continue;
                if (typeof unitCanEngage === "function" && !unitCanEngage(STATS[this.type], STATS[n.type])) continue;  // hava hedefe çarpmaz (kara warhead'i)
                const distance = Math.hypot(n.x - kcx, n.y - kcy);
                if (distance > blastR) continue;
                const arm = STATS[n.type] ? STATS[n.type].armorType : 'infantry';
                let eff = DM ? Math.max(0.7, DM.he?.[arm] || 0, DM.shaped?.[arm] || 0) : 1;
                // STRIKE_TOP_ARMOR: kamikaze üstten dalar → zırhlının en zayıf üst-yönünü bulur (armorFacing.top düşük→çarpan yüksek)
                const _af = STATS[n.type] && STATS[n.type].armorFacing;
                if (this._topStrike && _af && _af.top) eff *= Math.min(2.2, 1 / _af.top);
                const falloff = 1 - distance / blastR;
                const blastDmg = Math.max(1, Math.floor(
                    applyTechCombatBonus(this, n, this.atk * this.xpBonus * eff * incomingDamageMult(n)) * (0.6 + falloff * 0.4)
                ));
                const hpBefore = n.hp;
                const blastActual = Math.min(n.hp, blastDmg);
                n.hp -= blastDmg;
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
                n.panic += (blastDmg / n.maxHp) * 140;
                n.flashTimer = 5;
                if (typeof applyKnockback === 'function') applyKnockback(n, kcx, kcy, 2.2);
                n.suppression += 35;
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
        if (_isCrit) { dmg = Math.round(dmg * 1.8); primaryTarget.flashTimer = 8; if (typeof addDamageNumber === 'function') addDamageNumber(primaryTarget, dmg, true); }

        const primaryHpBefore = primaryTarget.hp;
        const actualDamage = Math.min(primaryTarget.hp, dmg);
        primaryTarget.hp -= dmg;

        // ── MISSION-KILL: hasarlı zırhlı araç (patlamadı) → mürettebat TERK → nötr/gri → tamir eden ele geçirir ──
        if (!primaryTarget.dead && !primaryTarget.abandoned && primaryTarget._crewed &&
            primaryTarget.hp > 0 && primaryTarget.hp < primaryTarget.maxHp * 0.30) {
            const _bail = _isCrit ? 0.55 : 0.14;   // kritik vuruşta terk şansı yüksek
            if (srand() < _bail) {
                primaryTarget.abandoned = true; primaryTarget.abandonedTick = SIM.tick;
                primaryTarget.attackTarget = null; primaryTarget.manualTarget = null;
                primaryTarget.isFleeing = false; primaryTarget.isMovingToManualTarget = false;
                primaryTarget.suppression = 0; primaryTarget.panic = 0;
                primaryTarget.combatState = 'Terk Edildi';
                if (typeof BATTLE_BALANCE !== 'undefined' && BATTLE_BALANCE.on) BATTLE_BALANCE.abandoned++;
                if (typeof battleRecordLifeEvent === 'function') battleRecordLifeEvent({ kind: 'ABANDON', unitId: primaryTarget.id, side: primaryTarget.isRed ? 'red' : 'blue', type: primaryTarget.type, byId: this.id, crit: !!_isCrit, x: Math.round(primaryTarget.x * 100) / 100, y: Math.round(primaryTarget.y * 100) / 100 });
            }
        }

        if (typeof battleRecordCombatEvent === 'function') {
            battleRecordCombatEvent({
                kind: 'DIRECT_FIRE',
                attackerId: this.id,
                attackerSide: this.isRed ? 'red' : 'blue',
                attackerType: this.type,
                targetId: primaryTarget.id,
                targetSide: primaryTarget.isRed ? 'red' : 'blue',
                targetType: primaryTarget.type,
                damage: Math.round(actualDamage * 100) / 100,
                hpBefore: Math.round(primaryHpBefore * 100) / 100,
                hpAfter: Math.round(Math.max(0, primaryTarget.hp) * 100) / 100,
                lethal: primaryTarget.hp <= 0,
                rearHit: isRearHit,
                flankHit: isFlankHit,
                attackerX: Math.round(this.x * 100) / 100,
                attackerY: Math.round(this.y * 100) / 100,
                targetX: Math.round(primaryTarget.x * 100) / 100,
                targetY: Math.round(primaryTarget.y * 100) / 100
            });
        }
        primaryTarget.flashTimer = 6;
        if (typeof addDamageNumber === 'function') addDamageNumber(primaryTarget, actualDamage, isRearHit);
        // İMPACT his (render-only): hedef knockback + atıcı geri-tepme; ağır silah → trauma + darbe-donması
        if (typeof applyKnockback === 'function') {
            applyKnockback(primaryTarget, this.x, this.y, this.type === T.ARMOR ? 4.5 : this.type === T.ANTI_TANK ? 3.5 : 2);
            applyKnockback(this, primaryTarget.x, primaryTarget.y, 1.1);
        }
        if (this.type === T.ARMOR || this.type === T.ANTI_TANK) {
            if (typeof triggerScreenShake === 'function') triggerScreenShake(this.type === T.ARMOR ? 0.08 : 0.06);   // tank/tanksavar isabet (%80 azaltıldı)
            if (typeof triggerHitStop === 'function') triggerHitStop(2);
        }

        primaryTarget.panic += (dmg / primaryTarget.maxHp) * 150;
        if (isFlankHit) primaryTarget.panic += isRearHit ? 18 : 9;   // yandan/arkadan vurulmak = moral ŞOKU (bozguna iter)

        // Baskı Ateşi (sadece tank alan baskısı yapar; diğerleri tekil)
        if (this.type === T.ARMOR) {
            // Tank mermisi = dar HE alan hasarı. Birincil hedef tam vuruşunu zaten aldı;
            // çevredeki DİĞER düşmanlara ölçülü splash + baskı uygula.
            const cx = primaryTarget.x, cy = primaryTarget.y;
            const blastNearby = SIM.spatialGrid.getNearby(cx, cy, TANK_SPLASH_RADIUS);
            for (let n of blastNearby) {
                if (n.dead) continue;
                if (n.isRed === this.isRed) {                            // dost: sadece baskı
                    if (Math.hypot(n.x - cx, n.y - cy) <= TANK_SPLASH_RADIUS) n.suppression += 40;
                    continue;
                }
                if (n === primaryTarget) continue;                       // tam vuruşu aldı
                const distance = Math.hypot(n.x - cx, n.y - cy);
                if (distance > TANK_SPLASH_RADIUS) continue;
                const falloff = 1 - distance / TANK_SPLASH_RADIUS;
                const ratio = TANK_SPLASH_MIN + falloff * (TANK_SPLASH_MAX - TANK_SPLASH_MIN);
                const blastDmg = Math.max(1, Math.floor(
                    calculateUnitDamage(this.type, n.type, this.atk * this.xpBonus, n.armor) * ratio
                ));
                const hpBefore = n.hp;
                const blastActual = Math.min(n.hp, blastDmg);
                n.hp -= blastDmg;
                if (typeof battleRecordCombatEvent === 'function') {
                    battleRecordCombatEvent({
                        kind: 'TANK_SPLASH',
                        attackerId: this.id,
                        attackerSide: this.isRed ? 'red' : 'blue',
                        attackerType: this.type,
                        targetId: n.id,
                        targetSide: n.isRed ? 'red' : 'blue',
                        targetType: n.type,
                        damage: Math.round(blastActual * 100) / 100,
                        hpBefore: Math.round(hpBefore * 100) / 100,
                        hpAfter: Math.round(Math.max(0, n.hp) * 100) / 100,
                        lethal: n.hp <= 0,
                        attackerX: Math.round(this.x * 100) / 100,
                        attackerY: Math.round(this.y * 100) / 100,
                        targetX: Math.round(n.x * 100) / 100,
                        targetY: Math.round(n.y * 100) / 100
                    });
                }
                n.panic += (blastDmg / n.maxHp) * 120;
                n.flashTimer = 5;
                if (typeof applyKnockback === 'function') applyKnockback(n, cx, cy, 1.8);
                n.suppression += 25;
                if (n.isRed) { n.lastHitTime = now; n.distressX = this.x; n.distressY = this.y; }
                if (n.armor > 0 && typeof spawnHitSparks !== 'undefined') spawnHitSparks(n.x, n.y);
                if (n.hp <= 0 && !n.dead) {
                    n.dead = true;
                    if (this.isRed) enemy.kills++; else player.kills++;
                    if ([T.INFANTRY, T.MECH_INFANTRY, T.RECON, T.ENGINEER, T.MEDIC, T.ANTI_TANK].includes(n.type)) {
                        decals.push({ x: n.x, y: n.y, type: 'blood', size: 10 + Math.random() * 15, alpha: 0.7 });
                    } else {
                        decals.push({ x: n.x, y: n.y, type: 'wreck', size: 25, alpha: 1.0 });
                    }
                    if (decals.length > 5000) decals.shift();
                    this.kills++;
                    if (this.kills === 3 && this.level === 0) { this.level = 1; this.xpBonus = 1.15; this.maxHp *= 1.15; this.hp += this.maxHp * 0.15; }
                    else if (this.kills === 7 && this.level === 1) { this.level = 2; this.xpBonus = 1.30; this.maxHp *= 1.15; this.hp += this.maxHp * 0.15; }
                }
            }
        } else {
            primaryTarget.suppression += 15;
        }
        
        if (this.maxAmmo > 0 && this.type !== T.MEDIC) this.ammo--;   // SINIRSIZ birim (maxAmmo=0) mühimmat tüketmez

        // KAMİKAZE (tek-kullanım): vurunca kendini imha eder.
        if (STATS[this.type] && STATS[this.type].singleUse) { this.hp = 0; this.dead = true; }

        this.lastAttackTime = now;
        this.revealTimer = AMBUSH_REVEAL_TICKS;   // T3 PUSU: ateş → açığa çık (gizlilik bozulur)
        
        if (typeof spawnTracer !== 'undefined') {
            spawnTracer(this.x, this.y, this.attackTarget.x, this.attackTarget.y, this.isIndirect);
        }
        if (primaryTarget.armor > 0 && typeof spawnHitSparks !== 'undefined') {
            spawnHitSparks(primaryTarget.x, primaryTarget.y);
        }
        
        if (primaryTarget.isRed) {
            primaryTarget.lastHitTime = now;
            primaryTarget.distressX = this.x;
            primaryTarget.distressY = this.y;
        }

        if (primaryTarget.hp <= 0) {
            primaryTarget.dead = true;
            if(this.isRed) enemy.kills++; else player.kills++;
            
            // Kan ve Savaş Kalıntısı (Decals)
            if ([T.INFANTRY, T.MECH_INFANTRY, T.RECON, T.ENGINEER, T.MEDIC, T.ANTI_TANK].includes(primaryTarget.type)) {
                decals.push({ x: primaryTarget.x, y: primaryTarget.y, type: 'blood', size: 10 + Math.random()*15, alpha: 0.7 });
            } else {
                decals.push({ x: primaryTarget.x, y: primaryTarget.y, type: 'wreck', size: 25, alpha: 1.0 });
                // Enkaz siper olarak işlev görebilir (gelecekte trenches arrayine de eklenebilir)
            }
            if (decals.length > 5000) decals.shift();
            
            this.kills++;
            if (this.kills === 3 && this.level === 0) {
                this.level = 1; this.xpBonus = 1.15; this.maxHp *= 1.15; this.hp += this.maxHp * 0.15;
            } else if (this.kills === 7 && this.level === 1) {
                this.level = 2; this.xpBonus = 1.30; this.maxHp *= 1.15; this.hp += this.maxHp * 0.15;
            }
            
            this.attackTarget = null;
            this.manualTarget = null;
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
        const s = worldToScreen(this.x + this.voffX, this.y + this.voffY);
        const dw = drawW(), dh = drawH();

        if (s.x < -dw * 2 || s.x > canvas.width + dw * 2 || s.y < -dh * 2 || s.y > canvas.height + dh * 2) return;

        // Yumuşak dönüş (render-only): drawAngle facingAngle'a kademeli yaklaşır → "tık diye" dönmez
        if (this.drawAngle === undefined) this.drawAngle = this.facingAngle;
        let _da = this.facingAngle - this.drawAngle;
        while (_da > Math.PI) _da -= Math.PI * 2;
        while (_da < -Math.PI) _da += Math.PI * 2;
        this.drawAngle += _da * ((UNIT_TURN_RATE[this.type] || 0.09) * UNIT_TURN_SMOOTH);
        const _ang = this.drawAngle + UNIT_FACE_OFFSET;    // sprite + seçim-kutusu çizim açısı

        if (this.selected && !this.isRed) {
            ctx.strokeStyle = '#00ff55';
            ctx.lineWidth = 2;
            if (UNIT_ROTATE) {
                ctx.save();
                ctx.translate(s.x, s.y);
                ctx.rotate(_ang);                          // seçim kutusu birimle birlikte döner
                ctx.strokeRect(-dw / 2 - 3, -dh / 2 - 3, dw + 6, dh + 6);
                ctx.restore();
            } else {
                ctx.strokeRect(s.x - dw / 2 - 3, s.y - dh / 2 - 3, dw + 6, dh + 6);
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
        if (UNIT_ROTATE) {
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(_ang);                                  // tüm sprite hedefe "düz" döner (yumuşak)
            if (_flash) ctx.filter = 'brightness(2.6) saturate(0.4)'; else if (_abFilter) ctx.filter = _abFilter;
            spriteReady() && ctx.drawImage(spriteSheet, this.sx, this.sy, SP_W, SP_H, -dw / 2, -dh / 2, dw, dh);
            ctx.restore();                                     // restore filter'ı da sıfırlar
        } else {
            if (_flash) ctx.filter = 'brightness(2.6) saturate(0.4)'; else if (_abFilter) ctx.filter = _abFilter;
            spriteReady() && ctx.drawImage(spriteSheet, this.sx, this.sy, SP_W, SP_H, s.x - dw / 2, s.y - dh / 2, dw, dh);
            if (_flash || _abFilter) ctx.filter = 'none';
        }
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
            const fr = (dw / 2) * Math.abs(Math.cos(off)) + (dh / 2) * Math.abs(Math.sin(off)) + 2 * zoom;
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
            const fw = dw * 0.9, fx = s.x - fw / 2, fy = s.y + dh / 2 + 4 * zoom;
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(fx, fy, fw, 3 * zoom);
            ctx.fillStyle = this._returningToBase ? '#ffcc00' : (fr < 0.3 ? '#ff5555' : '#55ff55');
            ctx.fillRect(fx, fy, fw * fr, 3 * zoom);
            const _secs = this.fuelBurn > 0 ? Math.ceil(this.fuel / this.fuelBurn) : 0;   // kalan sorti saniyesi
            ctx.font = `${Math.max(9, 10 * zoom)}px Arial`; ctx.textAlign = 'center';
            if (this._returningToBase) { ctx.fillStyle = '#ffcc00'; ctx.fillText('⛽ üsse', s.x, fy + 14 * zoom); }
            else if (fr < 0.5) { ctx.fillStyle = fr < 0.3 ? '#ff8888' : '#ffe08a'; ctx.fillText(`⛽${_secs}s`, s.x, fy + 14 * zoom); }
        }

        const barW = dw + 6;
        const barH = Math.max(3, 4 * zoom);
        const barX = s.x - barW / 2;
        const barY = s.y - dh / 2 - 6 * zoom - 3;
        const ratio = Math.max(0, this.hp / this.maxHp);

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

    for (let i = 0; i < SIM.units.length; i++) {
        if (SIM.units[i].dead) continue;
        const a = SIM.units[i];
        const nearby = SIM.spatialGrid.getNearby(a.x, a.y, MIN_DIST);
        for (let j = 0; j < nearby.length; j++) {
            const b = nearby[j];
            if (b.dead || a === b) continue;
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
            const requiredDist = softTransit ? MIN_DIST * 0.78 : MIN_DIST;
            if (dist < requiredDist) {
                const overlap = (requiredDist - dist) / 2;
                const pushX = (dx / dist) * overlap;
                const pushY = (dy / dist) * overlap;
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
