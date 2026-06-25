// ═══════════════════════════════════════════════════════════════════════════
//  MP.js — LOCKSTEP MAÇ MOTORU (PIXEL RTS çok oyunculu 1v1)
//  Deterministik motorun üstüne ince katman: iki PC aynı seed + aynı komut-dizisi
//  → BİREBİR aynı maç. Ağdan SADECE seed + komut + hash geçer (tam-state DEĞİL).
//  Sabit-tick input-delay lockstep (klasik RTS). Tek-insan-vs-AI'ya DOKUNMAZ:
//  MP.active=false iken bu dosyanın hiçbir fonksiyonu çağrılmaz, myCanonicalSide=false.
// ═══════════════════════════════════════════════════════════════════════════

var myCanonicalSide = false;   // false=host(MAVİ/güney) · true=guest(KIRMIZI/kuzey). Tek-oyunculuda HEP false.

const MP = {
    active: false, desync: false,
    tick: 0, acc: 0, lastTs: null, stalls: 0,
    pending: {}, localCmds: {}, sentUpTo: -1,
    myHash: {}, peerHash: {},
    mySide: 'blue', foeSide: 'red',
    myDeployReady: false, myDeployList: null, peerDeploy: null   // serbest-deploy
};

const MP_TICK_MS = 50;        // 20 Hz sabit-tick
let MP_INPUT_DELAY = 3;       // tick cinsinden komut gecikmesi (LAN=3≈150ms; bulut=6≈300ms internet için)
const MP_HASH_PERIOD = 30;    // her 30 tick'te desync-hash
const MP_MAX_STEPS = 6;       // bir frame'de en çok kaç tick simüle (catch-up sınırı)

// ── KAMERAYI KENDİ ORDUMA ORTALA (yerel — ağa gitmez) ──
function mpCameraToMyArmy() {
    if (typeof camera === 'undefined' || typeof zoom === 'undefined') return;
    const viewH = (canvas.height - 100) / zoom;                 // -100: alt araç-çubuğu payı (clampCamera ile tutarlı)
    const myY = myCanonicalSide ? WORLD_H * 0.16 : WORLD_H * 0.84;
    camera.x = WORLD_W / 2 - (canvas.width / zoom) / 2;
    camera.y = myY - viewH / 2;
    if (typeof clampCamera === 'function') clampCamera();
}

// ── LOBİ EŞLEŞTİ → DEPLOY FAZI (her oyuncu KENDİ ordusunu dizer) ──
function mpEnterDeploy() {
    MP.active = true; MP.desync = false;
    MP.myDeployReady = false; MP.myDeployList = null; MP.peerDeploy = null;
    MP.mySide = (Net.role === 'host') ? 'blue' : 'red';
    MP.foeSide = (MP.mySide === 'blue') ? 'red' : 'blue';
    myCanonicalSide = (Net.role !== 'host');                    // host=MAVİ(false/güney), guest=KIRMIZI(true/kuzey)
    MP_INPUT_DELAY = (typeof NET_MODE !== 'undefined' && NET_MODE === 'cloud') ? 6 : 3;

    SIM.units.length = 0;                                       // temiz deploy sahnesi (yerel önizleme)
    if (SIM.trenches) SIM.trenches.length = 0;
    if (typeof player !== 'undefined') player.money = 1500;     // host bütçesi (MAVİ)
    if (typeof enemy !== 'undefined') enemy.money = 1500;       // guest bütçesi (KIRMIZI)
    phase = PHASE.DEPLOY;                                       // lockstep DEPLOY'da DÖNMEZ (sadece BATTLE)

    if (typeof showScreen === 'function') showScreen('game');
    mpCameraToMyArmy();
    const sb = document.getElementById('ui-spawn-bar'); if (sb) { sb.style.opacity = '1'; sb.style.pointerEvents = 'auto'; }
    const sbtn = document.getElementById('start-btn'); if (sbtn) sbtn.classList.add('hidden');
    const tbtn = document.getElementById('train-ai-btn'); if (tbtn) tbtn.classList.add('hidden');
    const rbtn = document.getElementById('mp-ready-btn'); if (rbtn) rbtn.classList.remove('hidden');
    netStatus('● ORDUNU DİZ — sen ' + (myCanonicalSide ? 'KIRMIZI (kuzey)' : 'MAVİ (güney)') + ', bitince ✅ HAZIR', 'ok');
}

// ── HAZIR: kendi ordumu karşıya yolla ──
function mpReadyDeploy() {
    if (!MP.active || MP.myDeployReady) return;
    const mine = SIM.units.filter(u => !u.dead && u.isRed === myCanonicalSide);
    if (!mine.length) { alert('Önce en az bir birim diz, sonra HAZIR.'); return; }
    MP.myDeployList = mine.map(u => ({ t: u.type, x: Math.round(u.x), y: Math.round(u.y) }));
    MP.myDeployReady = true;
    netSend({ type: 'deploy', side: MP.mySide, units: MP.myDeployList });
    const sb = document.getElementById('ui-spawn-bar'); if (sb) { sb.style.opacity = '0.3'; sb.style.pointerEvents = 'none'; }
    const rbtn = document.getElementById('mp-ready-btn'); if (rbtn) rbtn.classList.add('hidden');
    netStatus('● Hazırsın — rakip bekleniyor…', 'ok');
    if (Net.role === 'host') mpTryStartFromHost();
}

// ── HOST iki ordu da hazırsa → start yay + maçı başlat ──
function mpTryStartFromHost() {
    if (Net.role !== 'host' || !MP.myDeployList || !MP.peerDeploy) return;
    const blue = MP.myDeployList;   // host = MAVİ
    const red = MP.peerDeploy;      // guest = KIRMIZI
    netSend({ type: 'start', seed: Net.seed, blue: blue, red: red });
    mpStartBattle(Net.seed, blue, red);
}

// ── DETERMİNİSTİK MAÇ KURULUMU (İKİ PC AYNI: önce TÜM mavi, sonra TÜM kırmızı → id eşleşir) ──
function mpStartBattle(seed, blue, red) {
    MP.active = true; MP.desync = false;
    MP.tick = 0; MP.acc = 0; MP.lastTs = null; MP.stalls = 0;
    MP.pending = {}; MP.localCmds = {}; MP.sentUpTo = -1;
    MP.myHash = {}; MP.peerHash = {};

    Unit.nextId = 0;
    if (typeof resetSimRng === 'function') resetSimRng((seed >>> 0) || 1);
    SIM.units.length = 0;                                       // ÖNİZLEME birimlerini SİL → start listesinden yeniden kur
    if (SIM.trenches) SIM.trenches.length = 0;
    for (const d of (blue || [])) SIM.units.push(new Unit(d.t, d.x, d.y, false));   // MAVİ önce → id 1..N
    for (const d of (red || []))  SIM.units.push(new Unit(d.t, d.x, d.y, true));    // KIRMIZI sonra → id N+1..
    if (typeof player !== 'undefined') player.money = 0;
    if (typeof enemy !== 'undefined') enemy.money = 0;

    phase = PHASE.BATTLE;
    if (typeof initControlPoints === 'function') initControlPoints();
    if (typeof battleTelemetry !== 'undefined' && battleTelemetry.start) battleTelemetry.start(0);
    mpCameraToMyArmy();
    const sb = document.getElementById('ui-spawn-bar'); if (sb) { sb.style.opacity = '0.3'; sb.style.pointerEvents = 'none'; }
    const ph = document.getElementById('ui-phase'); if (ph) ph.style.display = 'none';
    const rbtn = document.getElementById('mp-ready-btn'); if (rbtn) rbtn.classList.add('hidden');
    const us = document.getElementById('ui-support'); if (us) us.classList.add('hidden');   // MP'de destek kapalı (setTimeout=desync)
    netStatus('● Maç başladı — sen ' + (myCanonicalSide ? 'KIRMIZI' : 'MAVİ'), 'ok');
}

// ── KOMUT YAYINLA (sağ-tık) → execTick'e kuyrukla (ANINDA UYGULANMAZ) ──
function mpEmitCommand(kind, ids, x, y) {
    if (!MP.active || MP.desync || !ids.length) return;
    const K = Math.max(MP.tick + MP_INPUT_DELAY, MP.sentUpTo + 1);
    (MP.localCmds[K] || (MP.localCmds[K] = [])).push({ kind: kind, ids: ids, x: Math.round(x), y: Math.round(y) });
}

// ── girişimi gelecek tick'lere kadar gönder (boşsa boş-komut = heartbeat + bariyer) ──
function mpFlushInputs() {
    const target = MP.tick + MP_INPUT_DELAY;
    while (MP.sentUpTo < target) {
        const K = MP.sentUpTo + 1;
        const cmds = MP.localCmds[K] || [];
        delete MP.localCmds[K];
        (MP.pending[K] || (MP.pending[K] = {}))[MP.mySide] = cmds;   // kendi tarafım yerelde biliniyor
        netSend({ type: 'cmd', tick: K, side: MP.mySide, cmds: cmds });
        MP.sentUpTo = K;
    }
}

// ── SABİT-TICK LOCKSTEP DÖNGÜSÜ (gameLoop MP dalı çağırır) ──
function mpStep(timestamp) {
    if (!MP.active || MP.desync) return;
    if (MP.lastTs == null) MP.lastTs = timestamp;
    let fdt = timestamp - MP.lastTs; MP.lastTs = timestamp;
    if (fdt > 250) fdt = 250;                       // sekme-değişimi koruması
    MP.acc += fdt;
    mpFlushInputs();
    let steps = 0;
    while (MP.acc >= MP_TICK_MS && steps < MP_MAX_STEPS) {
        const T = MP.tick;
        const slot = MP.pending[T];
        if (!slot || slot.blue === undefined || slot.red === undefined) {
            MP.stalls++;
            break;                                  // STALL: rakibin tick komutunu bekle (acc'yi TÜKETME)
        }
        // her tick = MP_TICK_MS gerçek-süre AMA GAME_SPEED× oyun-zamanı (tek-oyuncuyla aynı tempo).
        // now (cooldown saati) ile dtSec TUTARLI olmalı: now-artışı(ms) === dtSec(sn)×1000.
        const dtSec = (MP_TICK_MS / 1000) * GAME_SPEED;
        const now = T * MP_TICK_MS * GAME_SPEED;     // = T*200ms oyun-zamanı (50ms×4)
        stepSim(now, dtSec, () => mpApplyTick(T), true);
        delete MP.pending[T];
        MP.tick = T + 1;
        MP.acc -= MP_TICK_MS;
        steps++;
        if (MP.tick % MP_HASH_PERIOD === 0) {
            const h = lsStateHash();
            netSend({ type: 'hash', tick: MP.tick, hash: h });
            MP.myHash[MP.tick] = h; mpTryCompare(MP.tick);
        }
        mpFlushInputs();
    }
}

// stepSim driveAI olarak: o tick'in HEM mavi HEM kırmızı komutlarını uygula
function mpApplyTick(T) {
    const slot = MP.pending[T];
    if (!slot) return;
    mpApplyCmds(slot.blue, false);   // MAVİ komutları ÖNCE
    mpApplyCmds(slot.red, true);     // KIRMIZI SONRA — SABİT SIRA (determinizm şartı)
}

function mpUnitById(id) {
    const us = SIM.units;
    for (let i = 0; i < us.length; i++) if (us[i].id === id) return us[i];
    return null;
}

function mpResolveAttackTarget(x, y, sideIsRed) {
    // sis'siz MUTLAK en-yakın düşman (iki PC'de AYNI — canSee KULLANMA, yoksa ıraksar)
    let best = null, bestD = 45;
    const us = SIM.units;
    for (let i = 0; i < us.length; i++) {
        const u = us[i];
        if (u.dead || u.isRed === sideIsRed) continue;
        const d = Math.hypot(u.x - x, u.y - y);
        if (d < bestD) { bestD = d; best = u; }
    }
    return best;
}

function mpApplyCmds(cmds, sideIsRed) {
    if (!cmds || !cmds.length) return;
    for (const c of cmds) {
        const us = [];
        for (const id of c.ids) { const u = mpUnitById(id); if (u && !u.dead && u.isRed === sideIsRed) us.push(u); }
        if (!us.length) continue;
        if (c.kind === 'attack') {
            const foe = mpResolveAttackTarget(c.x, c.y, sideIsRed);
            if (foe) { us.forEach(u => { u.manualTarget = foe; u.manualMoveTarget = null; u.isMovingToManualTarget = false; }); continue; }
            // görünür düşman yoksa hareket gibi davran (aşağı düşer)
        }
        const count = us.length, cols = Math.ceil(Math.sqrt(count)), spacing = UNIT_RADIUS * 2.5;
        us.forEach((u, i) => {
            const row = Math.floor(i / cols), col = i % cols;
            const ox = (col - (cols - 1) / 2) * spacing, oy = (row - (Math.ceil(count / cols) - 1) / 2) * spacing;
            u.targetX = c.x + ox; u.targetY = c.y + oy;
            u.manualTarget = null; u.manualMoveTarget = { x: c.x + ox, y: c.y + oy };
            u.isMovingToManualTarget = true; u.attackTarget = null;
        });
    }
}

// ── DESYNC HASH (FNV-1a, id-sıralı → iterasyon kayması yakalanmaz) ──
function lsStateHash() {
    let h = 0x811c9dc5 >>> 0;
    const mix = (v) => { h = (h ^ (v >>> 0)) >>> 0; h = Math.imul(h, 0x01000193) >>> 0; };
    const us = SIM.units.slice().sort((a, b) => a.id - b.id);
    for (const u of us) {
        mix(u.id); mix(Math.round(u.x * 16)); mix(Math.round(u.y * 16));
        mix(Math.round((u.hp || 0) * 16)); mix(u.isRed ? 1 : 0);
    }
    if (SIM.rng && typeof SIM.rng.state === 'number') mix(SIM.rng.state >>> 0);
    mix(Math.round((SIM.vpScore || 0) * 16));
    return h >>> 0;
}
function mpTryCompare(tick) {
    const a = MP.myHash[tick], b = MP.peerHash[tick];
    if (a != null && b != null) {
        if (a !== b) mpDesync(tick);
        delete MP.myHash[tick]; delete MP.peerHash[tick];
    }
}
function mpDesync(tick) {
    if (MP.desync) return;
    MP.desync = true;
    netStatus('⚠️ SENKRON KOPTU (tick ' + tick + ')', 'err');
    alert('⚠️ Senkron koptu (tick ' + tick + '). Maç durduruldu.\nİki PC AYNI sürüm + AYNI Chrome olmalı (git pull ile eşitle).');
}

// ── AĞ MESAJLARI (Net.js default → mpGameMessage) ──
function mpGameMessage(m) {
    if (m.type === 'deploy') {                          // rakip ordusunu yolladı
        MP.peerDeploy = m.units || [];
        netStatus(MP.myDeployReady ? '● Rakip hazır — başlıyor…' : '● Rakip hazır — sen de diz + HAZIR', 'ok');
        if (Net.role === 'host') mpTryStartFromHost();
        return;
    }
    if (m.type === 'start') { mpStartBattle(m.seed, m.blue, m.red); return; }   // guest: aynı ordu, deterministik
    if (m.type === 'cmd') {
        (MP.pending[m.tick] || (MP.pending[m.tick] = {}))[m.side] = m.cmds || [];
        return;
    }
    if (m.type === 'hash') { MP.peerHash[m.tick] = m.hash; mpTryCompare(m.tick); return; }
}

// ── lobi olayları (Net.js çağırır) ── her iki taraf DEPLOY'a girer (host start YOLLAMAZ — Hazır'da yollar)
function mpBeginMatch() {
    mpEnterDeploy();
}
function mpOnPeerLeft() {
    if (MP.active) alert('Rakip ayrıldı. Menüye dönülüyor.');
    MP.active = false; MP.desync = false;
    MP.myDeployReady = false; MP.myDeployList = null; MP.peerDeploy = null;
    if (typeof showScreen === 'function') showScreen('menu');
}
