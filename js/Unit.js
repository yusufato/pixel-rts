// ═══════════════════════════════════════════════════════════════
//  BİRLİK SINIFI
// ═══════════════════════════════════════════════════════════════
class Unit {
    constructor(type, x, y, isRed) {
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
        this.atkSpeed = s.atkSpeed;
        this.baseArmor = s.armor;
        this.armor = s.armor;
        
        this.inForest = false;
        this.inTrench = false;
        this.buildTrenchTarget = null;
        this.buildTrenchTimer = 0;

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
        this.scanTimer = Math.floor(Math.random() * 30);
    }

    update(now) {
        if (this.dead || phase !== PHASE.BATTLE) return;

        if (this.flashTimer > 0) this.flashTimer--;
        
        if (this.suppression > 0) this.suppression -= 0.3; // Saniyede ~18 azalır

        // Her 30 frame'de bir etrafta düşman var mı kontrol et
        if (this.scanTimer <= 0) {
            let found = false;
            const vRadius = STATS[this.type].vision;
            for (const u of units) {
                if (!u.dead && u.isRed !== this.isRed && Math.hypot(u.x - this.x, u.y - this.y) <= vRadius) {
                    found = true; break;
                }
            }
            this.enemyInVision = found;
        }

        let panicDecay = 5 * (now - this.lastAttackTime > 3000 ? 2 : 1) / 60;
        
        if (this.hp / this.maxHp < 0.3 && this.enemyInVision) {
            this.panic += 10 / 60; // Sadece düşman görürken düşük candan panik alır
        } else {
            if (!this.enemyInVision) panicDecay *= 5; // Düşman yoksa 5 kat hızlı sakinleş
            this.panic -= panicDecay;
        }
        this.panic = Math.max(0, Math.min(100, this.panic));
        
        this.isPanicking = this.panic > 50;
        this.isFleeing = (this.panic > 70) && this.enemyInVision;

        if (this.isFleeing) {
            this.aiAction = 'Kaçıyor';
            // Güvenli bölge oyuncu için Güney (Aşağı), Yapay zeka için Kuzey (Yukarı)
            this.targetX = WORLD_W / 2 + (Math.random() * 400 - 200);
            this.targetY = this.isRed ? 200 : WORLD_H - 200;
            this.attackTarget = null;
        }

        this.updateTerrainBonuses();
        this.updateEngineerBonus();

        if (this.type === T.MEDIC) this.healNearby(now);

        this.engageCombat(now);

        let desiredX = this.targetX - this.x;
        let desiredY = this.targetY - this.y;
        const distToTarget = Math.sqrt(desiredX * desiredX + desiredY * desiredY);

        if (distToTarget > this.speed + 1) {
            let moveX = (desiredX / distToTarget) * this.speed;
            let moveY = (desiredY / distToTarget) * this.speed;

            for (const t of terrainFeatures) {
                if (t.type === TERRAIN.MOUNTAIN) {
                    let dx = this.x - t.x;
                    let dy = this.y - t.y;
                    let distToMountain = Math.hypot(dx, dy);
                    if (distToMountain === 0) { dx = 0.1; dy = 0.1; distToMountain = 0.14; }
                    
                    const influenceRadius = t.r + UNIT_RADIUS + 80;
                    
                    if (distToMountain < influenceRadius) {
                        const pushForce = (influenceRadius - distToMountain) / influenceRadius; 
                        moveX += (dx / distToMountain) * this.speed * pushForce * 2.0;
                        moveY += (dy / distToMountain) * this.speed * pushForce * 2.0;
                        let dot = moveX * dx + moveY * dy;
                        if (dot < 0) {
                            let p1x = -dy / distToMountain; let p1y = dx / distToMountain;
                            let p2x = dy / distToMountain; let p2y = -dx / distToMountain;
                            
                            let dotP1 = p1x * desiredX + p1y * desiredY;
                            let dotP2 = p2x * desiredX + p2y * desiredY;
                            
                            let slideX = dotP1 > dotP2 ? p1x : p2x;
                            let slideY = dotP1 > dotP2 ? p1y : p2y;
                            
                            moveX += slideX * this.speed * 1.5;
                            moveY += slideY * this.speed * 1.5;
                        }
                    }
                }
            }
            
            const finalDist = Math.hypot(moveX, moveY);
            if (finalDist > 0) {
                this.x += (moveX / finalDist) * this.speed;
                this.y += (moveY / finalDist) * this.speed;
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

    updateTerrainBonuses() {
        this.inForest = false;
        this.inTrench = false;
        for (const t of terrainFeatures) {
            if (t.type === TERRAIN.FOREST) {
                if (Math.hypot(this.x - t.x, this.y - t.y) < t.r) {
                    this.inForest = true; break;
                }
            }
        }
        for (const t of trenches) {
            if (Math.hypot(this.x - t.x, this.y - t.y) < t.r) {
                this.inTrench = true;
                break;
            }
        }
        
        if (this.type === T.ENGINEER && this.buildTrenchTarget) {
            const tx = this.buildTrenchTarget.x;
            const ty = this.buildTrenchTarget.y;
            const dist = Math.hypot(this.x - tx, this.y - ty);
            
            if (dist > 10) {
                const dx = (tx - this.x) / dist;
                const dy = (ty - this.y) / dist;
                this.x += dx * this.speed;
                this.y += dy * this.speed;
            } else {
                this.buildTrenchTimer += 1/60;
                if (Math.random() < 0.1 && typeof spawnHitSparks !== 'undefined') spawnHitSparks(this.x, this.y);
                if (this.buildTrenchTimer > 3.0) {
                    trenches.push({ x: this.x, y: this.y, r: 40, isRed: this.isRed, hp: 250 });
                    this.buildTrenchTarget = null;
                    this.buildTrenchTimer = 0;
                }
            }
            return;
        }

        let currentSpeed = this.inForest ? this.baseSpeed * 0.7 : this.baseSpeed;
        if (this.isPanicking && !this.isFleeing) currentSpeed *= 0.7; // 30% slower when panicking but not fleeing yet
        if (this.suppression > 50) currentSpeed *= 0.5; // Baskı ateşi hızı yarıya düşürür
        this.speed = currentSpeed;
    }

    updateEngineerBonus() {
        this.armor = this.baseArmor + (this.inForest ? 3 : 0) + (this.inTrench ? 6 : 0);
        const nearby = spatialGrid.getNearby(this.x, this.y, 180);
        for (const u of nearby) {
            if (u.dead || u.type !== T.ENGINEER || u.isRed !== this.isRed || u === this) continue;
            if (Math.hypot(u.x - this.x, u.y - this.y) <= 180) { this.armor += 2; break; }
        }
    }

    healNearby(now) {
        if (now - this.lastAttackTime < this.atkSpeed) return;
        let lowestHpUnit = null;
        let lowestRatio = 1;
        const nearby = spatialGrid.getNearby(this.x, this.y, this.range);
        for (const u of nearby) {
            if (u.dead || u.isRed !== this.isRed || u === this || u.hp >= u.maxHp) continue;
            if (u.type === T.ARMOR || u.type === T.MECH_INFANTRY) continue;
            const d = Math.hypot(u.x - this.x, u.y - this.y);
            const ratio = u.hp / u.maxHp;
            if (d <= this.range && ratio < lowestRatio) {
                lowestHpUnit = u; lowestRatio = ratio;
            }
        }
        if (lowestHpUnit) {
            lowestHpUnit.hp = Math.min(lowestHpUnit.maxHp, lowestHpUnit.hp + 18);
            this.lastAttackTime = now;
        }
    }

    engageCombat(now) {
        if (this.type === T.MEDIC) return;

        if (!this.isRed) {
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

            if (this.attackTarget && (this.attackTarget.dead || !canSee(true, this.attackTarget.x, this.attackTarget.y) || Math.hypot(this.attackTarget.x - this.x, this.attackTarget.y - this.y) > this.range * 1.5)) {
                this.attackTarget = null;
            } else if (this.attackTarget && this.type !== T.ARTILLERY && !checkLineOfSight(this.x, this.y, this.attackTarget.x, this.attackTarget.y, this, this.attackTarget)) {
                this.attackTarget = null;
            }

            if (!this.attackTarget) {
                if (this.scanTimer <= 0) {
                    const nearby = this.findBestVisibleEnemy();
                    if (nearby && nearby.dist <= this.range) this.attackTarget = nearby.unit;
                    this.scanTimer = 30;
                } else {
                    this.scanTimer--;
                }
            }

            if (this.attackTarget) {
                const d = Math.hypot(this.attackTarget.x - this.x, this.attackTarget.y - this.y);
                if (d <= this.range) {
                    if (this.aiAction === 'ATTACK') { this.targetX = this.x; this.targetY = this.y; }
                    this.performAttack(now);
                }
            }
        }
    }

    findBestVisibleEnemy() {
        let bestTarget = null;
        let maxScore = -Infinity;
        
        const nearby = spatialGrid.getNearby(this.x, this.y, this.range * 1.5);
        for (const u of nearby) {
            if (u.dead || u.isRed === this.isRed) continue;
            
            const d = Math.hypot(u.x - this.x, u.y - this.y);
            if (d > this.range * 1.5) continue; 
            
            if (d > this.vision && !canSee(this.isRed, u.x, u.y)) continue; 
            
            if (this.type !== T.ARTILLERY && !checkLineOfSight(this.x, this.y, u.x, u.y, this, u)) continue;
            
            let score = 10000 - d; 
            score += (1 - (u.hp / u.maxHp)) * 5000;
            
            if (u.type === T.ARTILLERY || u.type === T.MEDIC || u.type === T.ENGINEER) score += 3000;
            
            if (this.isRed && typeof aiFocusTarget !== 'undefined' && u === aiFocusTarget) score += 8000;
            
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
        if (this.suppression > 50) currentAtkSpeed *= 1.5; // Baskı altında ateş yavaşlar
        if (now - this.lastAttackTime < currentAtkSpeed) return;

        let dmg = this.atk * this.xpBonus;
        const myStats = STATS[this.type];

        if (myStats.strong.includes(this.attackTarget.type)) dmg = Math.floor(dmg * 1.5);
        if (myStats.weak.includes(this.attackTarget.type)) dmg = Math.floor(dmg * 0.5);

        if (this.type === T.ANTI_TANK &&
            (this.attackTarget.type === T.ARMOR || this.attackTarget.type === T.MECH_INFANTRY || this.attackTarget.type === T.ARMOR_INFANTRY)) {
            dmg = Math.floor(this.atk * AT_ARMOR_MULTIPLIER);
        }

        // Yönsel Hasar (Flanking)
        const angleToTarget = Math.atan2(this.attackTarget.y - this.y, this.attackTarget.x - this.x);
        let angleDiff = Math.abs(angleToTarget - this.attackTarget.facingAngle);
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        angleDiff = Math.abs(angleDiff);
        
        // Eğer mermi, hedefin baktığı yön ile aynı açıda geliyorsa (arkadan vuruyorsa)
        if (angleDiff < Math.PI / 3) {
            dmg *= 2; // Arkadan x2 hasar!
        }

        dmg = Math.max(1, dmg - this.attackTarget.armor);
        this.attackTarget.hp -= dmg;
        this.attackTarget.flashTimer = 6;
        
        this.attackTarget.panic += (dmg / this.attackTarget.maxHp) * 150;
        
        // Baskı Ateşi Uygulama
        if (this.type === T.ARTILLERY || this.type === T.ARMOR) {
            const blastNearby = spatialGrid.getNearby(this.attackTarget.x, this.attackTarget.y, 100);
            for(let n of blastNearby) {
                if(n.isRed === this.attackTarget.isRed) n.suppression += 40;
            }
        } else {
            this.attackTarget.suppression += 15;
        }
        
        if (this.type !== T.MEDIC) this.ammo--;
        
        this.lastAttackTime = now;
        
        if (typeof spawnTracer !== 'undefined') {
            spawnTracer(this.x, this.y, this.attackTarget.x, this.attackTarget.y, this.type === T.ARTILLERY);
        }
        if (this.attackTarget.armor > 0 && typeof spawnHitSparks !== 'undefined') {
            spawnHitSparks(this.attackTarget.x, this.attackTarget.y);
        }
        
        if (this.attackTarget.isRed) {
            this.attackTarget.lastHitTime = now;
            this.attackTarget.distressX = this.x;
            this.attackTarget.distressY = this.y;
        }

        if (this.attackTarget.hp <= 0) {
            this.attackTarget.dead = true;
            if(this.isRed) enemy.kills++; else player.kills++;
            
            // Kan ve Savaş Kalıntısı (Decals)
            if ([T.INFANTRY, T.MECH_INFANTRY, T.RECON, T.ENGINEER, T.MEDIC, T.ANTI_TANK].includes(this.attackTarget.type)) {
                decals.push({ x: this.attackTarget.x, y: this.attackTarget.y, type: 'blood', size: 10 + Math.random()*15, alpha: 0.7 });
            } else {
                decals.push({ x: this.attackTarget.x, y: this.attackTarget.y, type: 'wreck', size: 25, alpha: 1.0 });
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

        const s = worldToScreen(this.x, this.y);
        const dw = drawW(), dh = drawH();

        if (s.x < -dw * 2 || s.x > canvas.width + dw * 2 || s.y < -dh * 2 || s.y > canvas.height + dh * 2) return;

        if (this.selected && !this.isRed) {
            ctx.strokeStyle = '#00ff55';
            ctx.lineWidth = 2;
            ctx.strokeRect(s.x - dw / 2 - 3, s.y - dh / 2 - 3, dw + 6, dh + 6);
        }

        if (this.type === T.ENGINEER && !this.dead) {
            ctx.strokeStyle = this.isRed ? 'rgba(255,200,100,0.08)' : 'rgba(100,255,200,0.08)';
            ctx.fillStyle = this.isRed ? 'rgba(255,200,100,0.03)' : 'rgba(100,255,200,0.03)';
            ctx.beginPath(); ctx.arc(s.x, s.y, 180 * zoom, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
        }

        if (this.flashTimer > 0) ctx.globalAlpha = 0.5;
        ctx.drawImage(spriteSheet, this.sx, this.sy, SP_W, SP_H, s.x - dw / 2, s.y - dh / 2, dw, dh);
        ctx.globalAlpha = 1.0;

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

        if (this.aiAction === 'Cephanesiz') {
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
    for (let i = 0; i < units.length; i++) {
        if (units[i].dead) continue;
        const a = units[i];
        const nearby = spatialGrid.getNearby(a.x, a.y, MIN_DIST);
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
    for (const u of units) {
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
    const src = isRed ? enemy : player;
    const s = STATS[type];
    if (src.money < s.cost) return false;
    src.money -= s.cost;
    src.unitsSpawned++;
    units.push(new Unit(type, worldX, worldY, isRed));
    return true;
}