const supportCooldowns = {
    airstrike: 0, // Kalan saniye
    paradrop: 0,
    supplydrop: 0
};

const MAX_CD_AIRSTRIKE = 45; // 45 Saniye
const MAX_CD_PARADROP = 30;  // 30 Saniye
const MAX_CD_SUPPLY = 20;    // 20 Saniye

const activeSupports = [];

class Plane {
    constructor(type, targetX, targetY) {
        this.type = type; // 'airstrike' veya 'paradrop'
        this.targetX = targetX;
        this.targetY = targetY;
        
        // Uçak ekranın başından girip sonuna gidecek (soldan sağa)
        this.x = targetX - WORLD_W;
        this.y = targetY;
        this.speed = 1200; // Dünya birimi / saniye
        this.payloadDropped = false;
        this.life = 0; // Uçuş süresi
    }

    update(dt, now) {
        this.x += this.speed * dt;
        this.life += dt;

        if (!this.payloadDropped && this.x >= this.targetX - 200) {
            this.payloadDropped = true;
            if (this.type === 'airstrike') {
                this.dropBombs();
            } else if (this.type === 'paradrop') {
                this.dropParas();
            } else if (this.type === 'supplydrop') {
                this.dropSupply();
            }
        }
        
        // Hedefi çok geçtiyse uçağı sil
        return this.x > this.targetX + WORLD_W;
    }

    dropBombs() {
        // Hedefe 5 adet sıralı bomba düşür
        for (let i = 0; i < 5; i++) {
            let dropX = this.targetX + (i - 2) * 150;
            let dropY = this.targetY + (Math.random() * 100 - 50);
            
            // Bomba yere düşme gecikmesi simülasyonu
            setTimeout(() => {
                spawnExplosion(dropX, dropY);
                // Alan Hasarı (AoE)
                const hitTargets = spatialGrid.getNearby(dropX, dropY, 200);
                for (const u of hitTargets) {
                    if (u.dead) continue;
                    const d = Math.hypot(u.x - dropX, u.y - dropY);
                    if (d < 200) {
                        let damage = 250 * (1 - d / 200); // Merkeze yaklaştıkça artan hasar
                        u.hp -= Math.max(1, damage - u.armor);
                        if (u.hp <= 0) {
                            u.dead = true;
                            if (u.isRed) enemy.kills++; else player.kills++;
                        }
                    }
                }
            }, i * 150 + 500); // 500ms bomba düşme süresi + aralıklı
        }
    }

    dropParas() {
        // 3 Paraşütçü indir (Şimdilik direkt oluşturuyoruz, gelecekte paraşüt animasyonu eklenebilir)
        for (let i = 0; i < 3; i++) {
            let dropX = this.targetX + (Math.random() * 150 - 75);
            let dropY = this.targetY + (Math.random() * 150 - 75);
            
            setTimeout(() => {
                units.push(new Unit(T.INFANTRY, dropX, dropY, false));
                player.unitsSpawned++;
            }, 1000);
        }
    }

    dropSupply() {
        setTimeout(() => {
            const hitTargets = spatialGrid.getNearby(this.targetX, this.targetY, 400);
            for (const u of hitTargets) {
                // Uçak oyuncuya aitse sadece oyuncu birimlerini, AI'ya aitse AI birimlerini yeniler.
                // Şimdilik sadece oyuncu çağırıyor varsayalım (ileride AI.js'den de çağrılabilir)
                if (!u.dead && Math.hypot(u.x - this.targetX, u.y - this.targetY) < 400) {
                    u.ammo = u.maxAmmo;
                }
            }
        }, 1000);
    }

    draw(ctx) {
        // Uçağın devasa gölgesi
        const s = worldToScreen(this.x, this.y);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.beginPath();
        ctx.moveTo(0, -20 * zoom);
        ctx.lineTo(40 * zoom, 0);
        ctx.lineTo(0, 20 * zoom);
        ctx.lineTo(-40 * zoom, 0);
        ctx.fill();
        ctx.restore();
    }
}

function triggerAirstrike(x, y) {
    if (supportCooldowns.airstrike > 0) return false;
    supportCooldowns.airstrike = MAX_CD_AIRSTRIKE;
    activeSupports.push(new Plane('airstrike', x, y));
    return true;
}

function triggerParadrop(x, y) {
    if (supportCooldowns.paradrop > 0) return false;
    supportCooldowns.paradrop = MAX_CD_PARADROP;
    activeSupports.push(new Plane('paradrop', x, y));
    return true;
}

function triggerSupply(x, y) {
    if (supportCooldowns.supplydrop > 0) return false;
    supportCooldowns.supplydrop = MAX_CD_SUPPLY;
    activeSupports.push(new Plane('supplydrop', x, y));
    return true;
}

function updateSupport(dt, now) {
    if (supportCooldowns.airstrike > 0) supportCooldowns.airstrike -= dt;
    if (supportCooldowns.paradrop > 0) supportCooldowns.paradrop -= dt;
    if (supportCooldowns.supplydrop > 0) supportCooldowns.supplydrop -= dt;

    for (let i = activeSupports.length - 1; i >= 0; i--) {
        const isDone = activeSupports[i].update(dt, now);
        if (isDone) {
            activeSupports.splice(i, 1);
        }
    }
}

function drawSupport(ctx) {
    for (const plane of activeSupports) {
        plane.draw(ctx);
    }
}
