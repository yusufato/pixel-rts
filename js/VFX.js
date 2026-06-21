const particles = [];

class Particle {
    constructor(x, y, vx, vy, life, size, color, isTracer = false, tracerTarget = null) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.maxLife = life;
        this.size = size;
        this.color = color;
        this.isTracer = isTracer;
        this.tracerTarget = tracerTarget;
    }

    update(dt) {
        this.x += this.vx * dt * 60;
        this.y += this.vy * dt * 60;
        if (!this.isTracer) {
            this.vx *= 0.92; // Sürtünme
            this.vy *= 0.92;
        }
        this.life -= dt;
    }

    draw(ctx) {
        let alpha = Math.max(0, this.life / this.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.color;

        const s = worldToScreen(this.x, this.y);
        const zSize = this.size * zoom;

        if (this.isTracer && this.tracerTarget) {
            // Işın kılıcı yerine kısa, gerçekçi bir mermi izi (Tracer)
            const dx = this.vx;
            const dy = this.vy;
            const len = Math.max(1, Math.hypot(dx, dy));
            const tailLength = this.size * 5; // Merminin hızına/boyutuna göre kısa bir kuyruk
            
            ctx.lineWidth = zSize;
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s.x - (dx / len) * tailLength * zoom, s.y - (dy / len) * tailLength * zoom);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.arc(s.x, s.y, zSize, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
    }
}

function spawnExplosion(x, y) {
    const count = 15;
    for (let i = 0; i < count; i++) {
        let angle = Math.random() * Math.PI * 2;
        let speed = Math.random() * 3 + 1;
        let life = 0.3 + Math.random() * 0.4;
        let size = 2 + Math.random() * 4;
        let color = Math.random() > 0.5 ? '#ffaa00' : '#ff4444';
        particles.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, life, size, color));
    }
    // Dumanlar
    for (let i = 0; i < 5; i++) {
        let angle = Math.random() * Math.PI * 2;
        let speed = Math.random() * 1;
        let life = 0.5 + Math.random() * 0.5;
        let size = 5 + Math.random() * 8;
        particles.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, life, size, '#555555'));
    }
    
    // Yerde krater/savaş izi bırak
    craters.push({
        x: x + (Math.random() * 10 - 5),
        y: y + (Math.random() * 10 - 5),
        r: 10 + Math.random() * 15,
        alpha: 0.6 + Math.random() * 0.4
    });
    // Optimizasyon: Haritada çok krater birikmesin
    if (craters.length > 300) craters.shift();
}

function spawnHitSparks(x, y) {
    const count = 5;
    for (let i = 0; i < count; i++) {
        let angle = Math.random() * Math.PI * 2;
        let speed = Math.random() * 2 + 0.5;
        let life = 0.15 + Math.random() * 0.15;
        let size = 1 + Math.random() * 2;
        particles.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, life, size, '#ffff00'));
    }
}

function spawnTracer(x1, y1, x2, y2, isArtillery = false) {
    // Işın kılıcı yerine kısa "Muzzle Flash" (Namlu Alevi) ve çok kısa mermi izi
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return;
    
    const dirX = dx / dist;
    const dirY = dy / dist;
    
    // Namlu Alevi (Muzzle Flash)
    let flashSize = isArtillery ? 8 : 3;
    let flashColor = isArtillery ? '#ff8800' : '#ffffaa';
    particles.push(new Particle(x1 + dirX * 10, y1 + dirY * 10, 0, 0, 0.05, flashSize, flashColor));
    
    if (isArtillery) {
        // Ekran titremesi (Screen Shake)
        if (typeof triggerScreenShake !== 'undefined') triggerScreenShake(10);
    } else if (Math.random() < 0.5) {
        // %50 ihtimalle kısa mermi izi (Tracer)
        let tracerLen = Math.min(dist * 0.3, 40); // Sadece yolun küçük bir kısmı
        let targetX = x1 + dirX * (10 + tracerLen);
        let targetY = y1 + dirY * (10 + tracerLen);
        particles.push(new Particle(x1 + dirX * 10, y1 + dirY * 10, 0, 0, 0.04, 1.5, '#ffee88', true, { x: targetX, y: targetY }));
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update(dt);
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles(ctx) {
    // Savaş sisi içinde kalan partiküllerin görünmemesi için FOG canvası altına çizeceğiz
    for (const p of particles) {
        // Görüş alanı dışındaysa çizme
        if (!canSee(false, p.x, p.y)) continue;
        p.draw(ctx);
    }
}
