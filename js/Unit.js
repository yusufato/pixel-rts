// ═══════════════════════════════════════════════════════════════
//  BİRLİK SINIFI
// ═══════════════════════════════════════════════════════════════
class Unit {
    constructor(type, x, y, isRed) {
        Unit.nextId = (Unit.nextId || 0) + 1;
        this.id = Unit.nextId;
        this.type = type;
        this.x = x;
        this.y = y;
        this.isRed = isRed;
        this.dead = false;
        this.selected = false;

        const s = STATS[type];
        this.maxHp = s.hp;
        this.hp = s.hp;
        this.atk = s.atk;
        this.baseSpeed = s.speed;
        this.speed = s.speed;
        this.range = s.range;
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

        this.targetX = x;
        this.targetY = y;
        this.attackTarget = null;
        this.manualTarget = null;
        this.manualMoveTarget = null;
        this.lastAttackTime = 0;
        this.isMovingToManualTarget = false;
        
        this.aiAction = 'ATTACK';

        this.panic = 0; // 0 to 100
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
        this.kills = 0;
        this.level = 0; // 0: Çaylak, 1: Deneyimli, 2: Gazi
        
        // Rütbe çarpanları (HP ve Atk için)
        this.xpBonus = 1.0;

        this.sx = SP_PAD + type * (SP_W + SP_PAD);
        this.sy = isRed ? (SP_PAD * 2 + SP_H) : SP_PAD;
        this.flashTimer = 0;
        this.scanTimer = srandInt(30);
    }

    update(now) {
        if (this.dead || phase !== PHASE.BATTLE) return;

        if (this.flashTimer > 0) this.flashTimer -= GAME_SPEED;
        if (this.revealTimer > 0) this.revealTimer -= GAME_SPEED;   // T3 PUSU: açıkta kalma süresi azalır → tekrar gizlenir
        this.scanTimer -= GAME_SPEED;
        
        if (this.suppression > 0) this.suppression -= 0.18 * GAME_SPEED;   // T1: yavaş decay → bastırma birikebilir (taktik kaynak)

        // Her ~30 frame'de bir çevreyi tara: düşman görüşü + birlik morali bağlamı
        if (this.scanTimer <= 0) {
            this.scanTimer = 30;
            const vRadius = STATS[this.type].vision;
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
        if (hpRatio < 0.3 && this.enemyInVision) panicGain += 10 / 60 * GAME_SPEED;            // yaralı + düşman karşıda
        if (outnumbered && this.enemyInVision) panicGain += (0.75 - ratio) * 14 / 60 * GAME_SPEED; // sayıca dezavantaj
        if (this.encirclement >= 0.5 && this.enemyInVision) panicGain += (this.encirclement - 0.375) * 34 / 60 * GAME_SPEED; // T3 KUŞATILMA (Cannae): etrafı sarılan birlik moral çöker → ENVELOP ödüllenir
        if (this.supplyCut && this.enemyInVision) panicGain += 5 / 60 * GAME_SPEED;             // T3 LOJİSTİK: ikmal hattı kesik → tedirginlik (geri çekil sinyali)
        if (this.fleeingNearby >= 2 && this.enemyInVision) panicGain += Math.min(this.fleeingNearby, 5) * 3 / 60 * GAME_SPEED; // bozgun yayılır (yalnız tehlike altında; güvende sönsün)
        if (this.suppression > 60) panicGain += 4 / 60 * GAME_SPEED;                            // ağır baskı altında
        if (this.leaderNearby) panicGain *= 0.55;  // yakındaki lider askerleri yatıştırır
        if (isLeader) panicGain *= 0.5;            // gaziler kolay kolay paniklemez

        // ── Panik AZALMASI (toparlanma kaynakları) ──
        let panicDecay = 5 * (now - this.lastAttackTime > 3000 ? 2 : 1) / 60 * GAME_SPEED;
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

        // Eşikler lider varlığına/rütbeye göre kayar: cesur birlikler daha geç bozulur
        const fleeThreshold = isLeader ? 88 : (this.leaderNearby ? 80 : 70);
        const rallyThreshold = this.leaderNearby ? 30 : 35;

        this.isPanicking = !this.lastStandMorale && this.panic > 50;
        if (!this.lastStandMorale && !this.isFleeing && this.panic > fleeThreshold && this.enemyInVision) {
            this.isFleeing = true;
            this.hasFledOnce = true;
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
            this.aiAction = 'FLEE';
            this.targetX = this.fleeTarget.x;
            this.targetY = this.fleeTarget.y;
            this.attackTarget = null;
        }

        const isConstructing = this.updateTerrainBonuses(now);
        this.updateEngineerBonus();

        if (isConstructing) {
            this.attackTarget = null;
            this.targetX = this.x;
            this.targetY = this.y;
            this.x = Math.max(UNIT_RADIUS, Math.min(WORLD_W - UNIT_RADIUS, this.x));
            this.y = Math.max(UNIT_RADIUS, Math.min(WORLD_H - UNIT_RADIUS, this.y));
            return;
        }

        if (this.type === T.MEDIC) this.healNearby(now);

        this.engageCombat(now);

        const _gridMode = (typeof MAP_MODE !== 'undefined' && MAP_MODE === 'grid');
        // NEHİR/YOL BULMA: düz hat su/dağla kapalıysa KÖPRÜDEN geçen yolu izle (deterministik A*)
        let _steerX = this.targetX, _steerY = this.targetY;
        if (_gridMode && typeof findPath === 'function') {
            this._navCd = (this._navCd || 0) - 1;
            const blocked = pathBlockedBetween(this.x, this.y, this.targetX, this.targetY);
            if (!blocked) {
                this._navPath = null;                                  // düz hat açık → doğrudan git
            } else {
                const goalMoved = (this._navGX === undefined) || Math.hypot(this.targetX - this._navGX, this.targetY - this._navGY) > 140;
                if (goalMoved || !this._navPath || this._navCd <= 0) {
                    this._navPath = findPath(this.x, this.y, this.targetX, this.targetY);
                    this._navIdx = 0; this._navGX = this.targetX; this._navGY = this.targetY; this._navCd = 24;
                }
                if (this._navPath && this._navPath.length) {
                    while (this._navIdx < this._navPath.length - 1 &&
                        Math.hypot(this.x - this._navPath[this._navIdx].x, this.y - this._navPath[this._navIdx].y) < CELL_W * 1.3) this._navIdx++;
                    const wp = this._navPath[Math.min(this._navIdx, this._navPath.length - 1)];
                    _steerX = wp.x; _steerY = wp.y;
                }
            }
        }

        let desiredX = this.targetX - this.x;
        let desiredY = this.targetY - this.y;
        const distToTarget = Math.sqrt(desiredX * desiredX + desiredY * desiredY);
        const movementSpeed = this.speed * GAME_SPEED;

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
                if (_gridMode && typeof isPassableAt === 'function') {
                    // sert engel: dağ/su (köprü hariç) geçilmez → eksen-bazlı kaydır
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
                if (this.type === T.ARMOR && Math.random() < 0.2) {
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

    updateTerrainBonuses(now) {
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
            this.supplyProgress += 0.035 * GAME_SPEED;
            if (this.supplyProgress >= 1) {
                const rounds = Math.floor(this.supplyProgress);
                this.ammo = Math.min(this.maxAmmo, this.ammo + rounds);
                this.supplyProgress -= rounds;
                if (this.ammo > 0 && this.aiAction === 'Cephanesiz') this.aiAction = 'ATTACK';
            }
        } else if (!this.inSupply) {
            this.supplyProgress = 0;
        }

        if (this.ammo > 0 && this.aiAction === 'Cephanesiz') this.aiAction = 'ATTACK';

        if (this.inSupply && isFieldRepairable(this.type) && this.hp < this.maxHp) {
            this.hp = Math.min(this.maxHp, this.hp + 0.18 * GAME_SPEED);
        }
        
        if (this.type === T.ENGINEER && this.buildTrenchTarget) {
            const tx = this.buildTrenchTarget.x;
            const ty = this.buildTrenchTarget.y;
            const dist = Math.hypot(this.x - tx, this.y - ty);
            
            if (dist > 10) {
                const dx = (tx - this.x) / dist;
                const dy = (ty - this.y) / dist;
                this.x += dx * this.speed * GAME_SPEED;
                this.y += dy * this.speed * GAME_SPEED;
            } else {
                this.buildTrenchTimer += GAME_SPEED / 60;
                if (Math.random() < 0.1 && typeof spawnHitSparks !== 'undefined') spawnHitSparks(this.x, this.y);
                if (this.buildTrenchTimer > 3.0) {
                    SIM.trenches.push({
                        x: this.x,
                        y: this.y,
                        r: 72,
                        isRed: this.isRed,
                        hp: 320,
                        maxHp: 320,
                        providesSupply: true,
                        createdAt: now,
                        expiresAt: now + SUPPLY_FIELD_DURATION_MS
                    });
                    this.buildTrenchTarget = null;
                    this.buildTrenchTimer = 0;
                    this.lastFieldBuiltAt = now;
                }
            }
            return true;
        }

        let currentSpeed = this.inForest ? this.baseSpeed * 0.7 : this.baseSpeed;
        if (this.isPanicking && !this.isFleeing) currentSpeed *= 0.7; // 30% slower when panicking but not fleeing yet
        if (this.suppression > PINNED_SUPPRESSION) currentSpeed *= 0.12;   // PINNED: yere yatar, ilerleyemez
        else if (this.suppression > 50) currentSpeed *= 0.5;               // ağır baskı: hız yarıya
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
            const healAmount = lowestHpUnit.type === T.ARMOR_INFANTRY ? 9 : 18;
            lowestHpUnit.hp = Math.min(lowestHpUnit.maxHp, lowestHpUnit.hp + healAmount);
            this.lastAttackTime = now;
        }
    }

    engageCombat(now) {
        if (this.type === T.MEDIC) return;

        // MÜTTEFİK (u.ally) artık DÜŞMAN AI'sinin AYNI dalını kullanır (aşağıdaki else) — commanderDriveAlly emir verir, bu dal icra eder (red ile birebir). Yalnız OYUNCUNUN birimleri manuel:
        if (!this.isRed && !this.ally) {
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
                if (this.scanTimer <= 0) {
                    const nearby = this.findBestVisibleEnemy();
                    if (nearby && nearby.dist <= this.range * 0.8) {
                        this.attackTarget = nearby.unit;
                    }
                    this.scanTimer = 15;
                }
                if (this.attackTarget) this.performAttack(now);
            }
        } else {
            if (this.aiAction === 'FLEE') { this.attackTarget = null; return; }

            if (this.attackTarget && (this.attackTarget.dead || !canSee(this.isRed, this.attackTarget.x, this.attackTarget.y) || Math.hypot(this.attackTarget.x - this.x, this.attackTarget.y - this.y) > this.range * 1.5)) {
                this.attackTarget = null;
            } else if (this.attackTarget && this.type !== T.ARTILLERY && !checkLineOfSight(this.x, this.y, this.attackTarget.x, this.attackTarget.y, this, this.attackTarget)) {
                this.attackTarget = null;
            }

            if (!this.attackTarget) {
                if (this.scanTimer <= 0) {
                    const nearby = this.findBestVisibleEnemy();
                    if (nearby && nearby.dist <= this.range) this.attackTarget = nearby.unit;
                    this.scanTimer = 30;
                }
            }

            if (this.attackTarget) {
                const d = Math.hypot(this.attackTarget.x - this.x, this.attackTarget.y - this.y);
                if (d <= this.range) {
                    // ADIM 1 — TEK NİYET KANALI: makro 'ÇEKİL' (DISENGAGE) dediyse birim DUR-VUR YAPMAZ; komutanın toplanma noktasına gider (targetX/Y'ye dokunma), yolda ateş eder = temiz savaşçı çekilme. Çelişme yapısal biter.
                    const disengage = this.intent && this.intent.posture === 'DISENGAGE';
                    if (!disengage) {
                        const roleGenes = getRoleTacticGenes(aiGenome.tacticGenes, this.squad ?? getSquadRole(this.type));
                        // ADIM 3: kite mesafesi KOMUTANIN rolünden (u.intent) gelir → rol-niyeti ile mikro-davranış TUTARLI; gen fallback yalnız niyet-yok (oyuncu)
                        const prefFrac = (this.intent && this.intent.preferredRange != null) ? this.intent.preferredRange : roleGenes.preferredRange;
                        const preferredDistance = this.range * prefFrac;
                        // ADIM 8: AKILLI KİTE — yalnız MENZİL + HIZ üstünlüğü varken kite et (yavaş/kısa-menzilli birim kite ederse yakalanıp DPS kaybeder, kötü takas)
                        const _tt = this.attackTarget.type;
                        const _canKite = this.type !== T.ARMOR_INFANTRY && STATS[this.type].range >= STATS[_tt].range * 0.95 && STATS[this.type].speed >= STATS[_tt].speed * 0.85;
                        if (d < preferredDistance * 0.72 && _canKite) {
                            const awayX = (this.x - this.attackTarget.x) / Math.max(1, d);
                            const awayY = (this.y - this.attackTarget.y) / Math.max(1, d);
                            this.targetX = this.x + awayX * preferredDistance * 0.45;
                            this.targetY = this.y + awayY * preferredDistance * 0.45;
                            this.aiAction = 'KITE';
                        } else if (this.aiAction === 'ATTACK') {
                            this.targetX = this.x;
                            this.targetY = this.y;
                        }
                    }
                    this.performAttack(now);
                }
            }
        }
    }

    // T3 PUSU: ormanda + yeni ateş etmemiş + kaçmıyor → gizli (sadece AMBUSH_DETECT içinden fark edilir)
    isConcealed() {
        return this.inForest && this.revealTimer <= 0 && !this.isFleeing;
    }

    findBestVisibleEnemy() {
        let bestTarget = null;
        let maxScore = -Infinity;
        
        const nearby = SIM.spatialGrid.getNearby(this.x, this.y, this.range * 1.5);
        for (const u of nearby) {
            if (u.dead || u.isRed === this.isRed) continue;
            
            const d = Math.hypot(u.x - this.x, u.y - this.y);
            if (d > this.range * 1.5) continue; 
            
            const _visR = this.vision * (1 + Math.max(0, (this.elevation || 0.5) - 0.45) * 0.55);   // T2: yüksekte görüş artar
            if (d > _visR && !canSee(this.isRed, u.x, u.y)) continue;
            if (u.isConcealed && u.isConcealed() && d > (this.type === T.RECON ? AMBUSH_DETECT * 2 : AMBUSH_DETECT)) continue;   // T3 PUSU/KEŞİF: gizli orman birimi uzaktan hedeflenemez (keşif 2× tespit)
            
            if (this.type !== T.ARTILLERY && !checkLineOfSight(this.x, this.y, u.x, u.y, this, u)) continue;
            
            const focusFire = this.isRed ? Math.max(0.45, aiGenome.tacticGenes.focusFire) : 0.65;
            let score = typeof TacticalAI !== 'undefined'
                ? TacticalAI.TargetScoring.score(this, u, {
                    genes: this.isRed ? aiGenome.tacticGenes : null,
                    focusTarget: (this.intent && this.intent.focusTarget) || null,   // ADIM 6: komutanın koordineli kill-target'ı (ölü aiFocusTarget yerine)
                    focusFire,
                    armorPriority: this.isRed ? aiGenome.tacticGenes.targetArmorPriority : 1,
                    supportPriority: this.isRed ? aiGenome.tacticGenes.targetSupportPriority : 1,
                    lineOfSight: true
                })
                : 10000 - d * (1.25 - focusFire * 0.5);
            
            if (this.intent && this.intent.focusTarget && u === this.intent.focusTarget) {
                score += 8000 * Math.max(0.6, aiGenome.tacticGenes.focusFire); // ADIM 6: komutanın kill-target'ına güçlü yoğunlaşma → tek-tek öldürme (canlı)
            }
            
            if (score > maxScore) {
                maxScore = score;
                bestTarget = { unit: u, dist: d };
            }
        }
        return bestTarget;
    }

    performAttack(now) {
        if (!this.attackTarget || this.attackTarget.dead || this.isFleeing) return;
        if (this.ammo <= 0 && this.type !== T.MEDIC) {
            this.aiAction = 'Cephanesiz';
            return;
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
            dmg *= _tgtArmored ? 2.6 : 2.0;
        } else if (angleDiff < 2 * Math.PI / 3) {   // YAN (60-120°): zırh kısmen delinir
            isFlankHit = true;
            dmg *= _tgtArmored ? 1.7 : 1.4;
        }                                           // ÖN (120-180°): zırh tam etkili (×1.0)

        // T2: YÜKSELTİ — sürekli yükselti farkı (her yerde): yüksekten sert, yokuş-yukarı zayıf
        const _eDelta = (this.elevation || 0.5) - (this.attackTarget.elevation || 0.5);
        if (_eDelta > 0.05) dmg *= 1 + Math.min(0.28, _eDelta * 1.6);
        else if (_eDelta < -0.05) dmg *= 1 - Math.min(0.20, -_eDelta * 1.3);

        if (_wasConcealed && this.type !== T.ARTILLERY) dmg *= AMBUSH_DMG_MULT;   // T3 PUSU: gizliden ilk atış sürprizi

        const primaryTarget = this.attackTarget;

        if (this.type === T.ARTILLERY) {
            // T1: TOPÇU GÖZCÜ ister — kendi LOS'u ya da dost gözcü hedefi görmeli (yoksa ateş edemez → keşifle eşleş)
            if (typeof artilleryHasSight === 'function' && !artilleryHasSight(this, primaryTarget)) { this.aiAction = 'Gözcü Yok'; return; }
            // ── TOPÇU: yalnızca geniş alan hasarı (nokta atışı YOK) ──
            const cx = primaryTarget.x, cy = primaryTarget.y;
            const splashNearby = SIM.spatialGrid.getNearby(cx, cy, ARTILLERY_SPLASH_RADIUS);
            for (const n of splashNearby) {
                if (n.dead || n.isRed === this.isRed) continue;       // sadece düşman birlikleri
                const distance = Math.hypot(n.x - cx, n.y - cy);
                if (distance > ARTILLERY_SPLASH_RADIUS) continue;
                const falloff = 1 - distance / ARTILLERY_SPLASH_RADIUS;
                const blastDmg = Math.max(1, Math.floor(
                    applyTechCombatBonus(this, n, calculateUnitDamage(this.type, n.type, this.atk * this.xpBonus, n.armor)) *
                    (0.5 + falloff * 0.5)
                ));
                const blastActual = Math.min(n.hp, blastDmg);
                n.hp -= blastDmg;
                n.panic += (blastDmg / n.maxHp) * 120;
                n.flashTimer = 5;
                if (typeof applyKnockback === 'function') applyKnockback(n, cx, cy, 1.6);
                n.suppression += 30;                                  // alan baskısı
                battleTelemetry.recordDamage(this, n, blastActual, false, now);
                if (n.isRed) { n.lastHitTime = now; n.distressX = this.x; n.distressY = this.y; }
                if (n.armor > 0 && typeof spawnHitSparks !== 'undefined') spawnHitSparks(n.x, n.y);
                if (n.hp <= 0 && !n.dead) {
                    n.dead = true;
                    battleTelemetry.recordKill(this, n);
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
                    if (n === primaryTarget) { this.attackTarget = null; this.manualTarget = null; }
                }
            }
            this.ammo--;
            this.lastAttackTime = now;
            this.revealTimer = AMBUSH_REVEAL_TICKS;   // T3 PUSU: ateş → açığa çık
            if (typeof spawnTracer !== 'undefined') spawnTracer(this.x, this.y, cx, cy, true);
            if (typeof spawnExplosion !== 'undefined') spawnExplosion(cx, cy, 1.7);
            if (typeof triggerScreenShake === 'function') triggerScreenShake(0.09);   // topçu patlaması (%80 azaltıldı)
            if (typeof triggerHitStop === 'function') triggerHitStop(3);
            return;
        }

        const actualDamage = Math.min(primaryTarget.hp, dmg);
        primaryTarget.hp -= dmg;
        battleTelemetry.recordDamage(this, primaryTarget, actualDamage, isRearHit, now);
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
                const blastActual = Math.min(n.hp, blastDmg);
                n.hp -= blastDmg;
                n.panic += (blastDmg / n.maxHp) * 120;
                n.flashTimer = 5;
                if (typeof applyKnockback === 'function') applyKnockback(n, cx, cy, 1.8);
                n.suppression += 25;
                battleTelemetry.recordDamage(this, n, blastActual, false, now);
                if (n.isRed) { n.lastHitTime = now; n.distressX = this.x; n.distressY = this.y; }
                if (n.armor > 0 && typeof spawnHitSparks !== 'undefined') spawnHitSparks(n.x, n.y);
                if (n.hp <= 0 && !n.dead) {
                    n.dead = true;
                    battleTelemetry.recordKill(this, n);
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
        
        if (this.type !== T.MEDIC) this.ammo--;

        this.lastAttackTime = now;
        this.revealTimer = AMBUSH_REVEAL_TICKS;   // T3 PUSU: ateş → açığa çık (gizlilik bozulur)
        
        if (typeof spawnTracer !== 'undefined') {
            spawnTracer(this.x, this.y, this.attackTarget.x, this.attackTarget.y, this.type === T.ARTILLERY);
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
            battleTelemetry.recordKill(this, primaryTarget);
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
        if (this.dead) return;

        if (this.isRed && phase === PHASE.BATTLE && !canSee(false, this.x, this.y)) return;
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
        if (this.ally) {   // OTONOM müttefik (dost-AI; oyuncu seçemez) → camgöbeği nokta
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
        if (UNIT_ROTATE) {
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(_ang);                                  // tüm sprite hedefe "düz" döner (yumuşak)
            if (_flash) ctx.filter = 'brightness(2.6) saturate(0.4)';
            ctx.drawImage(spriteSheet, this.sx, this.sy, SP_W, SP_H, -dw / 2, -dh / 2, dw, dh);
            ctx.restore();                                     // restore filter'ı da sıfırlar
        } else {
            if (_flash) ctx.filter = 'brightness(2.6) saturate(0.4)';
            ctx.drawImage(spriteSheet, this.sx, this.sy, SP_W, SP_H, s.x - dw / 2, s.y - dh / 2, dw, dh);
            if (_flash) ctx.filter = 'none';
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

        if (this.aiAction === 'Cephanesiz' && this.ammo <= 0) {
            ctx.fillStyle = '#ffa500';
            ctx.font = `${Math.max(10, 12 * zoom)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText('📦 Lojistik Gerek!', s.x, s.y - dh / 2 - 25 * zoom);
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
    for (let i = 0; i < SIM.units.length; i++) {
        if (SIM.units[i].dead) continue;
        const a = SIM.units[i];
        const nearby = SIM.spatialGrid.getNearby(a.x, a.y, MIN_DIST);
        for (let j = 0; j < nearby.length; j++) {
            const b = nearby[j];
            if (b.dead || a === b) continue;
            // Çift hesaplamayı önlemek için basit ID veya hafıza kontrolü yapılabilir
            // Ancak Spatial Hash içinde iki yönlü de itme olacağından overlap/2 yeterlidir.
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < MIN_DIST && dist > 0.01) {
                const overlap = (MIN_DIST - dist) / 2;
                a.x -= (dx/dist) * overlap; a.y -= (dy/dist) * overlap;
                b.x += (dx/dist) * overlap; b.y += (dy/dist) * overlap;
            }
        }
    }
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
}

function placeUnit(type, worldX, worldY, isRed) {
    const s = STATS[type];
    // GRID MODU: dağ/su (köprü hariç) üzerine birlik konmasın → en yakın geçilebilir noktaya sabitle
    if (typeof MAP_MODE !== 'undefined' && MAP_MODE === 'grid' && typeof isPassableAt === 'function' && !isPassableAt(worldX, worldY)) {
        const np = nearestPassable(worldX, worldY, 20);
        worldX = np.x; worldY = np.y;
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
        SIM.units.push(u);
        return true;
    }
    // FAZ-2 KAYNAK-BAZLI: AI(kırmızı) da HİKAYE düellosunda ilgili kaynaktan öder → anti-tank=puan-grubu SINIRLI (oyuncuyla SİMETRİK; "tüm birimler kendi kaynağından")
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
    // TEK-PARA: AI(kırmızı) Quick Match/MP + (mavi tek-para)
    const src = isRed ? enemy : player;
    if (src.money < s.cost) return false;
    src.money -= s.cost;
    src.unitsSpawned++;
    const u2 = new Unit(type, worldX, worldY, isRed);
    applyTechSpawnBonus(u2);   // TEKNOLOJİ: AI(kırmızı) hikaye-tech buff (Quick/MP'de TECH_BONUS_RED=null → no-op)
    SIM.units.push(u2);
    return true;
}
