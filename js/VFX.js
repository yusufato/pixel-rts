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
        // Ekran titremesi (trauma ölçeği: topçu ateş geri-tepmesi; %80 azaltıldı)
        if (typeof triggerScreenShake !== 'undefined') triggerScreenShake(0.05);
    } else if (Math.random() < 0.5) {
        // %50 ihtimalle kısa mermi izi (Tracer)
        let tracerLen = Math.min(dist * 0.3, 40); // Sadece yolun küçük bir kısmı
        let targetX = x1 + dirX * (10 + tracerLen);
        let targetY = y1 + dirY * (10 + tracerLen);
        particles.push(new Particle(x1 + dirX * 10, y1 + dirY * 10, 0, 0, 0.04, 1.5, '#ffee88', true, { x: targetX, y: targetY }, true));
    }
}

// ROKET/FÜZE (kullanıcı: "roket sıkan birimlerin roketlerini HAVADA görmek istiyorum"): fırlatma→hedef arası UÇAN parlak mermi +
// kuyruk + duman-pufu. Görsel-only (headless atlar → determinizm etkilenmez). ÇNRA/balistik/ATGM için.
function spawnRocket(x1, y1, x2, y2, scale = 1) {
    if (SIM.headless) return;
    const dx = x2 - x1, dy = y2 - y1, dist = Math.hypot(dx, dy);
    if (dist === 0) return;
    const dirX = dx / dist, dirY = dy / dist;
    const vpf = 16;                                   // px/kare (~960px/s) — havada görünür roket hızı
    const travel = Math.min(1.3, dist / (vpf * 60));  // uçuş süresi (s): fırlatmadan hedefe
    particles.push(new Particle(x1 + dirX * 12, y1 + dirY * 12, dirX * vpf, dirY * vpf, travel, 2.8 * scale, '#ffd27f', true, { x: x2, y: y2 }, true));   // UÇAN roket gövdesi (parlak, kuyruklu)
    particles.push(new Particle(x1 + dirX * 10, y1 + dirY * 10, 0, 0, 0.06, 6 * scale, '#ff8800', false, null, true));                                      // namlu alevi
    for (let i = 0; i < 3; i++)                        // fırlatma dumanı-pufu (iz başlangıcı)
        particles.push(new Particle(x1 + dirX * (10 + i * 9), y1 + dirY * (10 + i * 9), (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4 - 0.2, 0.4 + Math.random() * 0.3, 3 + Math.random() * 3, '#8a8a8a'));
}

// MAKİNELİ MERMİ İZİ (kullanıcı: "makineli birimler atış yaptıklarında SİLİK bir mermi izi çıkarsınlar"): ince, kısa, silik tracer +
// küçük namlu-parıltısı — her atışta (piyade/mekanize). Görsel-only.
function spawnMGTracer(x1, y1, x2, y2) {
    if (SIM.headless) return;
    const dx = x2 - x1, dy = y2 - y1, dist = Math.hypot(dx, dy);
    if (dist === 0) return;
    const dirX = dx / dist, dirY = dy / dist;
    particles.push(new Particle(x1 + dirX * 8, y1 + dirY * 8, 0, 0, 0.035, 1.6, '#ffee88', false, null, true));   // silik namlu-parıltısı
    const len = Math.min(dist * 0.55, 70);
    particles.push(new Particle(x1 + dirX * 8, y1 + dirY * 8, dirX * 24, dirY * 24, 0.05, 0.9, '#fff2a0', true, { x: x1 + dirX * (8 + len), y: y1 + dirY * (8 + len) }, true));   // ince kısa tracer (silik)
}

// ── PROJEKTİL SİSTEMİ (kullanıcı: "roket havada uçsun, hedefe ULAŞINCA patlasın") ──
// Görsel-only (headless atlar → determinizm ETKİLENMEZ; sim-hasarı zaten anlık uygulanır, bu yalnız patlama-görselini uçuş-varışına erteler).
// GÜDÜMLÜ (homing): hedef-birime kitlenir, o hareket edince peşinden kıvrılır (SAM/MANPADS/helo/SİHA). GÜDÜMSÜZ: sabit noktaya (havan/topçu/ÇNRA/balistik).
const projectiles = [];
class Projectile {
    constructor(x1, y1, target, opts = {}) {
        this.x = x1; this.y = y1;
        this.homingUnit = (opts.homing && target && typeof target === 'object' && ('hp' in target)) ? target : null;   // canlı-birim → takip
        this.tx = target.x; this.ty = target.y;
        this.speed = opts.speed || 720;        // px/s
        this.scale = opts.scale || 1;
        this.color = opts.color || '#ffd27f';
        this.maxLife = opts.maxLife || 3.0;    // güvenlik-tavanı (hedef kaçarsa)
        this.trailT = 0;
        // KARA-MERMİSİ AYRIMI (deferred-damage): namlu mermisi roket DEĞİL — duman-izi bırakmaz, varışta patlamaz.
        // trail: duman-izi bırakır mı; impact: varış efekti ('explosion' roket/füze | 'spark' namlu mermisi | 'none' hafif silah).
        this.trail = opts.trail !== false;
        this.impact = opts.impact || 'explosion';
        this.width = opts.width || (this.impact === 'none' ? 1.2 : 2.4);
    }
    update(dt) {
        if (this.homingUnit && !this.homingUnit.dead) { this.tx = this.homingUnit.x; this.ty = this.homingUnit.y; }   // GÜDÜM: canlı hedefi izle
        const dx = this.tx - this.x, dy = this.ty - this.y, dist = Math.hypot(dx, dy);
        const step = this.speed * dt;
        this.maxLife -= dt;
        if (dist <= step || dist < 14 || this.maxLife <= 0) {   // VARIŞ → tipine göre efekt (hedefe ULAŞINCA)
            if (this.impact === 'explosion' && typeof spawnExplosion === 'function') spawnExplosion(this.tx, this.ty, this.scale);
            else if (this.impact === 'spark' && typeof spawnHitSparks === 'function') spawnHitSparks(this.tx, this.ty);
            return true;
        }
        this.x += dx / dist * step; this.y += dy / dist * step;
        if (!this.trail) return false;   // namlu mermisi: duman-izi YOK
        this.trailT -= dt;
        if (this.trailT <= 0) {   // duman-izi (arka)
            this.trailT = 0.028;
            particles.push(new Particle(this.x, this.y, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, 0.35, 2 + Math.random() * 2, '#9a9a9a'));
        }
        return false;
    }
    draw(ctx) {
        const s = worldToScreen(this.x, this.y);
        const dd = Math.hypot(this.tx - this.x, this.ty - this.y) || 1;
        const bx = (this.tx - this.x) / dd, by = (this.ty - this.y) / dd;   // yön (kuyruk için)
        ctx.globalAlpha = 1;
        ctx.strokeStyle = this.color; ctx.lineWidth = this.width * zoom;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - bx * 12 * zoom, s.y - by * 12 * zoom); ctx.stroke();   // roket-gövde+kuyruk
        ctx.fillStyle = '#fff3c0';
        ctx.beginPath(); ctx.arc(s.x, s.y, 1.8 * zoom, 0, Math.PI * 2); ctx.fill();   // parlak burun
        ctx.globalAlpha = 1;
    }
}
function spawnProjectile(x1, y1, target, opts) {
    if (SIM.headless || !target) return;
    projectiles.push(new Projectile(x1, y1, target, opts || {}));
    if (projectiles.length > 400) projectiles.splice(0, projectiles.length - 400);
}
function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        if (projectiles[i].update(dt)) projectiles.splice(i, 1);
    }
}
function drawProjectiles(ctx) {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of projectiles) { if (canSee(false, p.x, p.y)) p.draw(ctx); }
    ctx.globalCompositeOperation = 'source-over';
}

function updateParticles(dt) {
    updateProjectiles(dt);   // projektiller (roket/füze uçuşu) — parçacıklarla aynı döngüde
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
    if (typeof drawProjectiles === 'function') drawProjectiles(ctx);   // uçan roket/füzeler (görünür-alan)
}

// ── HASAR SAYILARI (yükselip sönen; AYNI hedefte BİRİKTİRİR → kalabalık olmaz) ──
const floatTexts = [];
function addDamageNumber(target, amount, isCrit) {
    if (SIM.headless) return;
    amount = Math.round(amount);
    if (amount <= 0) return;
    const f = target._dmgFloat;
    if (f && f.life > 0) {                 // aktif sayı varsa BİRİKTİR + tazele
        f.value += amount; f.text = '' + f.value;
        f.life = f.maxLife; f.vy = -22;
        if (isCrit) f.crit = true;
        return;
    }
    const nf = { x: target.x + (Math.random() * 8 - 4), y: target.y - 8, vy: -22, value: amount, text: '' + amount, life: 0.7, maxLife: 0.7, crit: !!isCrit };
    floatTexts.push(nf);
    target._dmgFloat = nf;
    if (floatTexts.length > 120) floatTexts.shift();
}
function updateFloatTexts(dt) {            // GERÇEK dt ile (game-speed'den bağımsız ~0.7s görünür)
    for (let i = floatTexts.length - 1; i >= 0; i--) {
        const f = floatTexts[i];
        f.y += f.vy * dt; f.vy *= 0.92; f.life -= dt;
        if (f.life <= 0) floatTexts.splice(i, 1);
    }
}
function drawFloatTexts(ctx) {
    if (typeof zoom !== 'undefined' && zoom < 0.5) return;   // çok uzakta gizle (kalabalık olmasın)
    ctx.textAlign = 'center';
    for (const f of floatTexts) {
        if (!canSee(false, f.x, f.y)) continue;
        const s = worldToScreen(f.x, f.y);
        const a = Math.max(0, f.life / f.maxLife);
        const size = (f.crit ? 15 : 11) * Math.min(1.4, zoom) * (0.75 + 0.25 * a);
        ctx.globalAlpha = a;
        ctx.font = `bold ${size}px monospace`;
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.strokeText(f.text, s.x, s.y);
        ctx.fillStyle = f.crit ? '#ffdd33' : '#ffffff';     // crit (arkadan-vuruş) = altın
        ctx.fillText(f.text, s.x, s.y);
    }
    ctx.globalAlpha = 1;
}
