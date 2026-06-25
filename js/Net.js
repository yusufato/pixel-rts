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

function netStatus(text, cls) {
    const el = document.getElementById('mp-status');
    if (el) { el.textContent = text; el.className = 'mp-badge ' + (cls || ''); }
}

function netConnect(ip, port) {
    port = port || 8080;
    try { if (Net.ws) Net.ws.close(); } catch (_) {}
    Net.connected = false; netStatus('● Bağlanıyor…', '');
    let url;
    try { url = 'ws://' + ip.trim() + ':' + port; Net.ws = new WebSocket(url); }
    catch (_) { netStatus('● Geçersiz adres', 'err'); return; }
    Net.ws.onopen = () => { Net.connected = true; netStatus('● Bağlı', 'ok'); netSend({ type: 'list' }); };
    Net.ws.onclose = () => { Net.connected = false; netStatus('● Bağlantı kapandı', 'err'); };
    Net.ws.onerror = () => { netStatus('● Bağlantı hatası (IP / firewall / sunucu?)', 'err'); };
    Net.ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } netOnMessage(m); };
}

function netSend(o) {
    try { if (Net.ws && Net.connected) Net.ws.send(JSON.stringify(o)); } catch (_) {}
}

function netOnMessage(m) {
    switch (m.type) {
        case 'rooms':       netRenderRooms(m.rooms || []); break;
        case 'created':
            Net.room = m.room; Net.role = 'host'; Net.seed = m.seed;
            netStatus('● Oda kuruldu — rakip bekleniyor…', 'ok');
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
