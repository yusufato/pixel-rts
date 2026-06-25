#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
#  PIXEL RTS — LAN ÇOK OYUNCULU SUNUCU (lobi + lockstep relay)
#  Tek dosya, NO-NODE: websockets 10.4 (kurulu). Aynı port (8080): statik dosya
#  servisi + WebSocket lobi/relay. Determinizm motorda; sunucu sadece mesaj iletir.
#
#  ÇALIŞTIR (host PC):   python3 mp_server.py
#  Sonra İKİ PC tarayıcıdan aç:  http://<gösterilen-LAN-IP>:8080
#  (host localhost da olur). Firewall: Linux `sudo ufw allow 8080/tcp`,
#  Windows Defender → "özel ağda izin ver". AYNI Chrome/Chromium kullanın.
# ═══════════════════════════════════════════════════════════════════════════
import asyncio, json, socket, mimetypes, os, sys, http
import websockets

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
INDEX = 'oyna.html' if os.path.isfile(os.path.join(ROOT, 'oyna.html')) else 'index.html'

rooms = {}        # rid -> {id, name, seed, host, guest, started}
clients = {}      # ws  -> {room, role}
_next_rid = [1]
_next_seed = [123457]

def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80)); return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        s.close()

_B36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
def make_code(ip, room):
    """host LAN-IP + oda → tek okunabilir şifre (guest çözüp host'a bağlanır).
       packed = ip_int*1000 + oda; base36. İstemci Net.netParseCode ile çözer."""
    try:
        a, b, c, d = (int(x) for x in ip.split('.'))
    except Exception:
        a = b = c = d = 0
    packed = (((a << 24) | (b << 16) | (c << 8) | d) & 0xFFFFFFFF) * 1000 + (room % 1000)
    if packed == 0:
        return '0'
    out = ''
    while packed > 0:
        out = _B36[packed % 36] + out
        packed //= 36
    return out

def room_list():
    return [{'id': r['id'], 'name': r['name'],
             'players': (1 if r['host'] else 0) + (1 if r['guest'] else 0), 'max': 2}
            for r in rooms.values() if not r['started'] and r['guest'] is None]

async def send(ws, o):
    try:
        await ws.send(json.dumps(o))
    except Exception:
        pass

async def broadcast_lobby():
    rl = room_list()
    for ws, c in list(clients.items()):
        if c['room'] is None:
            await send(ws, {'type': 'rooms', 'rooms': rl})

async def peer_of(ws):
    c = clients.get(ws)
    if not c or c['room'] is None:
        return None
    r = rooms.get(c['room'])
    if not r:
        return None
    return r['guest'] if c['role'] == 'host' else r['host']

async def route(ws, m):
    t = m.get('type')
    c = clients[ws]

    if t == 'list':
        await send(ws, {'type': 'rooms', 'rooms': room_list()})

    elif t == 'create':
        rid = _next_rid[0]; _next_rid[0] += 1
        seed = _next_seed[0]; _next_seed[0] = (_next_seed[0] * 1103515245 + 12345) & 0x7fffffff
        rooms[rid] = {'id': rid, 'name': m.get('name', f'Oyun #{rid}'), 'seed': seed,
                      'host': ws, 'guest': None, 'started': False}
        c['room'] = rid; c['role'] = 'host'
        code = make_code(lan_ip(), rid)
        await send(ws, {'type': 'created', 'room': rid, 'seed': seed, 'role': 'host', 'code': code})
        await broadcast_lobby()

    elif t == 'join':
        rid = m.get('room')
        r = rooms.get(rid)
        if not r or r['guest'] is not None or r['started']:
            await send(ws, {'type': 'error', 'msg': 'Oda dolu veya yok'}); return
        r['guest'] = ws; c['room'] = rid; c['role'] = 'guest'
        await send(ws, {'type': 'joined', 'room': rid, 'seed': r['seed'], 'role': 'guest'})
        await send(r['host'], {'type': 'peer_joined'})
        await broadcast_lobby()

    elif t in ('cmd', 'deploy', 'start', 'hash', 'ready', 'chat'):
        # LOCKSTEP RELAY: mesajı odadaki DİĞER oyuncuya aynen ilet (sunucu yorumlamaz)
        if t == 'start':
            r = rooms.get(c['room'])
            if r: r['started'] = True
            await broadcast_lobby()
        peer = await peer_of(ws)
        if peer:
            await send(peer, m)

async def cleanup(ws):
    c = clients.pop(ws, None)
    if not c:
        return
    rid = c['room']
    if rid is not None and rid in rooms:
        r = rooms[rid]
        peer = r['guest'] if c['role'] == 'host' else r['host']
        if peer:
            await send(peer, {'type': 'peer_left'})
        # host ayrılırsa oda kapanır; guest ayrılırsa oda tekrar listelenebilir
        if c['role'] == 'host' or r['started']:
            rooms.pop(rid, None)
        else:
            r['guest'] = None
    await broadcast_lobby()

async def ws_handler(ws, path=None):
    clients[ws] = {'room': None, 'role': None}
    try:
        await send(ws, {'type': 'rooms', 'rooms': room_list()})
        async for raw in ws:
            try:
                m = json.loads(raw)
            except Exception:
                continue
            await route(ws, m)
    except Exception:
        pass
    finally:
        await cleanup(ws)

async def process_request(path, request_headers):
    # WebSocket upgrade isteği → websockets devralsın
    if request_headers.get('Upgrade', '').lower() == 'websocket':
        return None
    # HTTP GET → statik dosya servisi (oyunu host'la)
    rel = path.split('?')[0].lstrip('/')
    if rel == '':
        rel = INDEX
    fp = os.path.normpath(os.path.join(ROOT, rel))
    if not fp.startswith(ROOT) or not os.path.isfile(fp):
        return (http.HTTPStatus.NOT_FOUND, [('Content-Type', 'text/plain')], b'404 Not Found')
    ctype = mimetypes.guess_type(fp)[0] or 'application/octet-stream'
    with open(fp, 'rb') as f:
        body = f.read()
    return (http.HTTPStatus.OK,
            [('Content-Type', ctype), ('Content-Length', str(len(body))),
             ('Cache-Control', 'no-cache')], body)

async def main():
    ip = lan_ip()
    print('═' * 60)
    print('  PIXEL RTS — LAN ÇOK OYUNCULU SUNUCU')
    print('═' * 60)
    print(f'  Sunucu çalışıyor (port {PORT}).')
    print(f'  ► İKİ PC de tarayıcıdan aç:   http://{ip}:{PORT}')
    print(f'    (bu PC için:  http://localhost:{PORT})')
    print(f'  Firewall: Linux `sudo ufw allow {PORT}/tcp` · Windows: özel ağda izin ver.')
    print(f'  AYNI Chrome/Chromium kullanın. Kapatmak: Ctrl+C')
    print('═' * 60)
    async with websockets.serve(ws_handler, '0.0.0.0', PORT, process_request=process_request,
                                ping_interval=20, ping_timeout=20, max_size=2 ** 20):
        await asyncio.Future()  # sonsuza dek çalış

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print('\nSunucu kapatıldı.')
