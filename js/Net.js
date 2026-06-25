// ═══════════════════════════════════════════════════════════════════════════
//  Net.js — WebSocket istemcisi + LOBİ (PIXEL RTS LAN çok oyunculu)
//  Taşıma katmanı: bağlan / gönder / mesaj-dağıt. Lobi mesajlarını burada işler;
//  oyun-mesajlarını (cmd/deploy/start/hash) MP.js'e (varsa) iletir.
//  Determinizm motorda; ağ sadece seed + komut + hash taşır.
// ═══════════════════════════════════════════════════════════════════════════

const Net = {
    ws: null, connected: false,
    room: null, role: null, seed: null,   // 'host'(mavi/güney) | 'guest'(kırmızı/kuzey)
    selectedRoom: null
};

// İNTERNET (bulut relay) vs LAN modu: https'ten (Render) açılınca otomatik BULUT, localhost/file → LAN.
let NET_MODE = (location.protocol === 'https:') ? 'cloud' : 'lan';
function wsBase() { return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host; }

function netStatus(text, cls) {
    const el = document.getElementById('mp-status');
    if (el) { el.textContent = text; el.className = 'mp-badge ' + (cls || ''); }
}

function netConnect(ip, port, onReady) {
    netConnectUrl('ws://' + String(ip).trim() + ':' + (port || 8080), onReady);   // LAN (ip:port)
}
function netConnectUrl(url, onReady) {                                            // bulut (tam ws/wss URL)
    try { if (Net.ws) Net.ws.close(); } catch (_) {}
    Net.connected = false;
    try { Net.ws = new WebSocket(url); }
    catch (_) { netStatus('● Geçersiz adres', 'err'); return; }
    Net.ws.onopen = () => { Net.connected = true; netStatus('● Bağlı', 'ok'); if (onReady) onReady(); };
    Net.ws.onclose = () => { Net.connected = false; netStatus('● Bağlantı kapandı', 'err'); };
    Net.ws.onerror = () => { netStatus('● Bağlanamadı (sunucu açık mı? aynı ağ mı?)', 'err'); };
    Net.ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } netOnMessage(m); };
}

// ── ŞİFRE ↔ ADRES (sunucu make_code ile birebir aynı şema) ──
function netParseCode(code) {
    const packed = parseInt(String(code || '').trim().toUpperCase(), 36);
    if (!isFinite(packed) || packed <= 0) return null;
    const room = packed % 1000;
    const ipInt = Math.floor(packed / 1000) >>> 0;
    const ip = ((ipInt >>> 24) & 255) + '.' + ((ipInt >>> 16) & 255) + '.' + ((ipInt >>> 8) & 255) + '.' + (ipInt & 255);
    return { ip: ip, room: room };
}

// ── HOST: oda kur → kod al. BULUT: relay'e (wss, aynı origin) bağlan. LAN: localhost'a. ──
function mpCreateGame() {
    Net.code = null;
    if (NET_MODE === 'cloud') {
        netStatus('● Sunucuya bağlanılıyor (uyanması ~30sn sürebilir)…', '');
        netConnectUrl(wsBase(), () => netSend({ type: 'create', name: 'Oyun' }));
    } else {
        const host = (location.hostname && location.hostname.length) ? location.hostname : 'localhost';
        netStatus('● Sunucuya bağlanılıyor…', '');
        netConnect(host, 8080, () => netSend({ type: 'create', name: 'Oyun' }));
    }
    setTimeout(() => {                                  // teşhis: kod gelmezse nedenini söyle
        if (!Net.connected) netStatus(NET_MODE === 'cloud'
            ? '● Sunucuya ulaşılamadı — internet? (uyanıyor olabilir, birazdan tekrar dene)'
            : '● Sunucu çalışmıyor — "baslat.sh" / "baslat.bat" ile başlat', 'err');
        else if (!Net.code) netStatus('● Bağlandı ama kod gelmedi — sunucu güncel mi?', 'err');
    }, NET_MODE === 'cloud' ? 35000 : 4000);
}
// ── GUEST: koda göre bağlan → katıl. BULUT: relay'e + 4-haneli kod. LAN: şifreyi çöz + IP. ──
function mpJoinByCode(code) {
    code = String(code || '').trim();
    if (NET_MODE === 'cloud') {
        if (!code) { alert('Oda kodunu gir.'); return; }
        netStatus('● Bağlanılıyor (uyanması ~30sn sürebilir)…', '');
        netConnectUrl(wsBase(), () => netSend({ type: 'join', room: code.toUpperCase() }));
        return;
    }
    const p = netParseCode(code);
    if (!p) { alert('Geçersiz şifre. Host\'un verdiği şifreyi aynen gir.'); return; }
    netConnect(p.ip, 8080, () => netSend({ type: 'join', room: p.room }));
}

function netSend(o) {
    try { if (Net.ws && Net.connected) Net.ws.send(JSON.stringify(o)); } catch (_) {}
}

function netOnMessage(m) {
    switch (m.type) {
        case 'rooms':       netRenderRooms(m.rooms || []); break;
        case 'created':
            Net.room = m.room; Net.role = 'host'; Net.seed = m.seed; Net.code = m.code;
            netStatus('● Oda kuruldu — rakip bekleniyor…', 'ok');
            netShowCode(m.code);
            netSetWaiting(true);
            break;
        case 'joined':
            Net.room = m.room; Net.role = 'guest'; Net.seed = m.seed;
            netStatus('● Odaya katıldın — başlıyor…', 'ok');
            if (typeof mpBeginMatch === 'function') mpBeginMatch();
            else alert('Odaya katıldın (seed ' + m.seed + '). Lockstep maç motoru sonraki adımda.');
            break;
        case 'peer_joined':
            netStatus('● Rakip katıldı — başlıyor…', 'ok');
            if (typeof mpBeginMatch === 'function') mpBeginMatch();
            else alert('Rakip katıldı! Lockstep maç motoru sonraki adımda.');
            break;
        case 'error':       alert('⚠️ ' + (m.msg || 'Hata')); netSetWaiting(false); break;
        case 'peer_left':   if (typeof mpOnPeerLeft === 'function') mpOnPeerLeft(); else alert('Rakip ayrıldı.'); break;
        default:            if (typeof mpGameMessage === 'function') mpGameMessage(m);   // cmd/deploy/start/hash → MP.js
    }
}

function netRenderRooms(rooms) {
    const list = document.getElementById('mp-room-list');
    if (!list) return;
    if (!rooms.length) {
        list.innerHTML = '<div class="mp-empty">Açık oyun yok. "Oyun Oluştur" ile sen başlat.</div>';
        Net.selectedRoom = null;
        return;
    }
    list.innerHTML = rooms.map(r =>
        '<div class="mp-room" data-rid="' + r.id + '">' +
        '<span class="mp-room-name">🎮 ' + (r.name || ('Oyun #' + r.id)) + '</span>' +
        '<span class="mp-room-players">' + r.players + '/' + r.max + '</span></div>'
    ).join('');
    list.querySelectorAll('.mp-room').forEach(el => {
        el.addEventListener('click', () => {
            list.querySelectorAll('.mp-room').forEach(x => x.classList.remove('selected'));
            el.classList.add('selected');
            Net.selectedRoom = +el.dataset.rid;
        });
    });
}

function netSetWaiting(on) {
    const c = document.getElementById('btn-mp-create');
    const j = document.getElementById('btn-mp-join');
    if (c) c.disabled = on;
    if (j) j.disabled = on;
}

function netShowCode(code) {
    const show = document.getElementById('mp-code-show');
    const enter = document.getElementById('mp-code-enter');
    const el = document.getElementById('mp-code');
    if (el) {
        if (code) { el.textContent = code; el.style.fontSize = ''; }
        else { el.textContent = 'SUNUCU ESKİ'; el.style.fontSize = '15px'; el.title = 'Sunucuda: Ctrl+C → git pull → python3 mp_server.py'; }
    }
    if (show) { show.classList.remove('hidden'); show.style.display = 'block'; }
    if (enter) { enter.classList.add('hidden'); enter.style.display = 'none'; }
    // sunucu şifre yollamadıysa (eski sürüm) kullanıcıyı uyar
    if (!code) netStatus('● Sunucu eski — host: Ctrl+C → git pull → yeniden başlat', 'err');
}
