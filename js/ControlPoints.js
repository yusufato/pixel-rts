// ═══════════════════════════════════════════════════════════════
//  BÖLGE KONTROLÜ / ZAFER PUANLARI  (Territory / Victory Points)
//  ----------------------------------------------------------------
//  TURTLE-KIRICI yapısal mekanik: köşede oturan taraf merkez hattındaki
//  noktaları kaptırır → puanla KAYBEDER → savunmacı dışarı çıkıp çekişmek
//  zorunda kalır. Saldırı-savunma dengelenir; ve "kuvvet ekonomisi" temeli
//  nihayet zafere dönüşür (değer üstünlüğü → nokta tutma → puan → galibiyet).
//
//  3 nokta (merkez + 2 kanat) orta hatta. Tutulan her nokta sn'de puan;
//  eşiğe (VP_TARGET) ulaşan kazanır.
// ═══════════════════════════════════════════════════════════════

const VP_TARGET = 3000;          // kazanma eşiği (puan) — maç çok hızlı bitmesin (~2× uzun)
const VP_POINT_RADIUS = 250;     // ele geçirme yarıçapı (dünya px) — bölgeler daha dar/odaklı
const VP_CAPTURE_TIME = 6;       // tek başına nötrden sahipliğe (yarı menzil) süre referansı (sn)
const VP_SCORE_RATE = 5;         // tutulan nokta sn'de kaç puan

// FAZ 1c: SIM.controlPoints / SIM.vpScore / SIM.vpWinner artık world'de tanımlı (globals.js) — world CANONICAL.
// initControlPoints() bunları world üzerinde sıfırlar; tüm okumalar world.* üzerinden.

function initControlPoints() {
    const cy = WORLD_H * 0.5;
    SIM.controlPoints = [
        { name: 'Sol Mevzi', x: WORLD_W * 0.5 - 820, y: cy, r: VP_POINT_RADIUS, cap: 0, owner: null, contested: false },
        { name: 'Merkez',    x: WORLD_W * 0.5,        y: cy, r: VP_POINT_RADIUS, cap: 0, owner: null, contested: false },
        { name: 'Sağ Mevzi', x: WORLD_W * 0.5 + 820, y: cy, r: VP_POINT_RADIUS, cap: 0, owner: null, contested: false }
    ];
    SIM.vpScore = { red: 0, blue: 0 };
    SIM.vpWinner = null;
    SIM.tick = 0;   // öğrenen beyin: maç-başı sim-saati sıfırla (MP iki-PC intent-yaşı/bellek fazı aynı olsun)
}

// cap ∈ [-1,+1]: -1 = KIRMIZI(AI) sahibi, +1 = MAVİ(oyuncu) sahibi, 0 = nötr
function controlPointOwner(p) { return p.cap <= -0.999 ? 'red' : (p.cap >= 0.999 ? 'blue' : null); }

function updateControlPoints(dt, now) {
    if (!SIM.controlPoints.length || dt <= 0) return;
    const rate = 1 / VP_CAPTURE_TIME;
    for (const p of SIM.controlPoints) {
        let red = 0, blue = 0;
        const r2 = p.r * p.r;
        for (const u of SIM.units) {
            if (u.dead) continue;
            const dx = u.x - p.x, dy = u.y - p.y;
            if (dx * dx + dy * dy <= r2) { if (u.isRed) red++; else blue++; }
        }
        p.contested = red > 0 && blue > 0;
        if (red > 0 && blue === 0) p.cap = Math.max(-1, p.cap - rate * dt);        // KIRMIZI ele geçirir
        else if (blue > 0 && red === 0) p.cap = Math.min(1, p.cap + rate * dt);    // MAVİ ele geçirir
        // çekişmeli veya boş → değişmez (mevcut ele geçirme korunur, terk edince elde kalır)
        p.owner = controlPointOwner(p);
    }
    for (const p of SIM.controlPoints) {
        if (p.owner === 'red') SIM.vpScore.red += VP_SCORE_RATE * dt;
        else if (p.owner === 'blue') SIM.vpScore.blue += VP_SCORE_RATE * dt;
    }
    if (SIM.vpWinner === null) {
        if (SIM.vpScore.red >= VP_TARGET) SIM.vpWinner = false;       // AI/KIRMIZI kazandı (oyuncu kaybetti)
        else if (SIM.vpScore.blue >= VP_TARGET) SIM.vpWinner = true;  // oyuncu/MAVİ kazandı
    }
}

// Red(AI) için: kaç nokta tutuyor / rakip kaç tutuyor (AI karar yardımı)
function vpCounts() {
    let red = 0, blue = 0, open = 0;
    for (const p of SIM.controlPoints) {
        if (p.owner === 'red') red++;
        else if (p.owner === 'blue') blue++;
        else open++;
    }
    return { red, blue, open };
}

function drawControlPoints(ctx) {
    if (!SIM.controlPoints.length || phase !== PHASE.BATTLE) return;
    for (const p of SIM.controlPoints) {
        const s = worldToScreen(p.x, p.y);
        const rr = p.r * zoom;
        if (s.x < -rr || s.x > canvas.width + rr || s.y < -rr || s.y > canvas.height + rr) continue;
        const col = p.owner === 'red' ? '#ff5555' : p.owner === 'blue' ? '#4fb0ff' : '#dddddd';
        // bölge halkası
        ctx.beginPath();
        ctx.arc(s.x, s.y, rr, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(1.5, 3 * zoom);
        ctx.strokeStyle = p.contested ? '#ffd633' : col;
        ctx.globalAlpha = p.contested ? 0.85 : 0.55;
        ctx.setLineDash(p.owner ? [] : [10 * zoom, 8 * zoom]);
        ctx.stroke();
        ctx.setLineDash([]);
        // hafif dolgu
        ctx.globalAlpha = 0.07;
        ctx.fillStyle = col;
        ctx.fill();
        // ele geçirme göstergesi: |cap| oranında dolu iç daire
        const mag = Math.abs(p.cap);
        if (mag > 0.01) {
            ctx.globalAlpha = 0.22;
            ctx.fillStyle = p.cap < 0 ? '#ff5555' : '#4fb0ff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, rr * Math.min(1, mag), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        // bayrak işareti + isim
        const fontPx = Math.max(11, 15 * zoom);
        ctx.font = `bold ${fontPx}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#000';
        ctx.fillText('⚑', s.x + 1, s.y + fontPx * 0.35 + 1);
        ctx.fillStyle = col;
        ctx.fillText('⚑', s.x, s.y + fontPx * 0.35);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = `${Math.max(10, 13 * zoom)}px monospace`;
        ctx.fillText(p.name + (p.contested ? ' ⚔' : ''), s.x, s.y - rr - 6 * zoom);
    }
    ctx.textAlign = 'left';
}

// Ekran-uzayı skor HUD (üst orta)
function drawVpHud(ctx) {
    if (!SIM.controlPoints.length || phase !== PHASE.BATTLE) return;
    const w = 380, h = 16;
    const x = Math.round((canvas.width - w) / 2);
    const y = 12;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - 8, y - 6, w + 16, h + 40);
    // hedefe oran (KIRMIZI soldan, MAVİ sağdan)
    const rp = Math.min(1, SIM.vpScore.red / VP_TARGET);
    const bp = Math.min(1, SIM.vpScore.blue / VP_TARGET);
    const half = w / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#ff5555';
    ctx.fillRect(x + half - half * rp, y, half * rp, h);
    ctx.fillStyle = '#4fb0ff';
    ctx.fillRect(x + half, y, half * bp, h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + half - 1, y - 2, 2, h + 4);   // orta çizgi
    // sayılar
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ff8888';
    ctx.fillText(`KIRMIZI(AI) ${Math.floor(SIM.vpScore.red)}`, x, y + h + 16);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#9fd4ff';
    ctx.fillText(`${Math.floor(SIM.vpScore.blue)} SEN(MAVİ)`, x + w, y + h + 16);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    const c = vpCounts();
    ctx.fillText(`BÖLGE  ⚑${c.red} : ${c.blue}⚑  · hedef ${VP_TARGET}`, x + w / 2, y + h + 16);
    ctx.restore();
    ctx.textAlign = 'left';
}
