const particles = [];

class Particle {
    constructor(x, y, vx, vy, life, size, color, isTracer = false, tracerTarget = null, additive = false) {
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
        this.additive = additive;   // true → 'lighter' blend (sıcak VFX: ateş/namlu/kıvılcım/tracer parlar)
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

function spawnExplosion(x, y, scale = 1) {
    if (SIM.headless) return;   // FAZ 1f: rollout'ta render-only VFX yok
    // 1) Parlak beyaz çekirdek (1. kare gözü kilitler) — additive
    particles.push(new Particle(x, y, 0, 0, 0.07, 6 * scale, '#ffffff', false, null, true));
    // 2) Additive ateş topu (beyaz→turuncu→kırmızı renk geçişi → sıcak görünür)
    const fireCount = Math.round(13 * scale);
    for (let i = 0; i < fireCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 3 + 1) * scale;
        const life = 0.22 + Math.random() * 0.35;
        const size = (2 + Math.random() * 4) * scale;
        const r = Math.random();
        const color = r > 0.66 ? '#fff3c0' : r > 0.33 ? '#ffaa00' : '#ff4400';
        particles.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, life, size, color, false, null, true));
    }
    // 3) Yükselen duman (yukarı vy yanlı; additive DEĞİL) — sahayı 'yaralar'
    const smokeCount = Math.round(5 * scale);
    for (let i = 0; i < smokeCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 1;
        const life = 0.6 + Math.random() * 0.6;
        const size = (5 + Math.random() * 8) * scale;
        particles.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 0.5, life, size, '#555555'));
    }
    // 4) Kalıcı krater (baked-ground)
    craters.push({ x: x + (Math.random() * 10 - 5), y: y + (Math.random() * 10 - 5), r: (10 + Math.random() * 15) * scale, alpha: 0.6 + Math.random() * 0.4 });
    if (craters.length > 300) craters.shift();
}

function spawnHitSparks(x, y) {
    if (SIM.headless) return;   // FAZ 1f: rollout'ta render-only VFX yok
    const count = 5;
    for (let i = 0; i < count; i++) {
        let angle = Math.random() * Math.PI * 2;
        let speed = Math.random() * 2 + 0.5;
        let life = 0.15 + Math.random() * 0.15;
        let size = 1 + Math.random() * 2;
        particles.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, life, size, '#ffee44', false, null, true));
    }
}

function spawnTracer(x1, y1, x2, y2, isArtillery = false) {
    if (SIM.headless) return;   // FAZ 1f: rollout'ta render-only VFX yok
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
    particles.push(new Particle(x1 + dirX * 10, y1 + dirY * 10, 0, 0, 0.05, flashSize, flashColor, false, null, true));
    
    if (isArtillery) {
        // Ekran titremesi (trauma ölçeği: topçu ateş geri-tepmesi)
        if (typeof triggerScreenShake !== 'undefined') triggerScreenShake(0.3);
    } else if (Math.random() < 0.5) {
        // %50 ihtimalle kısa mermi izi (Tracer)
        let tracerLen = Math.min(dist * 0.3, 40); // Sadece yolun küçük bir kısmı
        let targetX = x1 + dirX * (10 + tracerLen);
        let targetY = y1 + dirY * (10 + tracerLen);
        particles.push(new Particle(x1 + dirX * 10, y1 + dirY * 10, 0, 0, 0.04, 1.5, '#ffee88', true, { x: targetX, y: targetY }, true));
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update(dt);
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }
    // Fill-rate bütçesi: additive 'lighter' pahalı → tavanı koru (en eskiyi at)
    if (particles.length > 1500) particles.splice(0, particles.length - 1500);
}

function drawParticles(ctx) {
    // Pass 1: normal partiküller (duman/toz) — fog dışındakiler çizilmez
    for (const p of particles) {
        if (p.additive) continue;
        if (!canSee(false, p.x, p.y)) continue;
        p.draw(ctx);
    }
    // Pass 2: SICAK partiküller (ateş/namlu/kıvılcım/tracer) — additive 'lighter' = parlama/bloom
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
        if (!p.additive) continue;
        if (!canSee(false, p.x, p.y)) continue;
        p.draw(ctx);
    }
    ctx.globalCompositeOperation = 'source-over';
}
