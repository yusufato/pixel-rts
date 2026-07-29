const supportCooldowns = {
    paradrop: 0
};

const MAX_CD_PARADROP = 30;  // 30 Saniye
const PARADROP_COST = STATS[T.INFANTRY].cost * 3;

const activeSupports = [];
const pendingSupportSpawns = [];

class Plane {
    constructor(type, targetX, targetY) {
        this.type = type;
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
            if (this.type === 'paradrop') {
                this.dropParas(now);
            }
        }
        
        // Hedefi çok geçtiyse uçağı sil
        return this.x > this.targetX + WORLD_W;
    }

    dropParas(now) {
        // Gerçek-zaman setTimeout kullanılmaz. Spawn olayı ortak simülasyon saatine yazılır.
        for (let i = 0; i < 3; i++) {
            const dropX = this.targetX + (srand() * 150 - 75);
            const dropY = this.targetY + (srand() * 150 - 75);
            pendingSupportSpawns.push({
                spawnAt: now + 1000,
                type: T.INFANTRY,
                x: dropX,
                y: dropY,
                isRed: false
            });
        }
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

function triggerParadrop(x, y) {
    if (supportCooldowns.paradrop > 0 || player.money < PARADROP_COST) return false;
    player.money -= PARADROP_COST;
    supportCooldowns.paradrop = MAX_CD_PARADROP;
    activeSupports.push(new Plane('paradrop', x, y));
    if (typeof battleRecordEvent === 'function') {
        battleRecordEvent('support-paradrop', {
            x: Math.round(x * 100) / 100,
            y: Math.round(y * 100) / 100
        });
    }
    return true;
}

function updateSupport(dt, now) {
    if (supportCooldowns.paradrop > 0) supportCooldowns.paradrop = Math.max(0, supportCooldowns.paradrop - dt);

    for (let i = pendingSupportSpawns.length - 1; i >= 0; i--) {
        const spawn = pendingSupportSpawns[i];
        if (now < spawn.spawnAt) continue;
        SIM.units.push(new Unit(spawn.type, spawn.x, spawn.y, spawn.isRed));
        if (!spawn.isRed) player.unitsSpawned++;
        else enemy.unitsSpawned++;
        pendingSupportSpawns.splice(i, 1);
    }

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
