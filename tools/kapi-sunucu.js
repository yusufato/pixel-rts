'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  KAPI SUNUCUSU — tarayıcı kapılarının ihtiyaç duyduğu asgari statik sunucu
//
//  NEDEN VAR: `tools/tarayici-kapi-kos.js` sayfayı `http://localhost:8123/...` üzerinden
//  açar (Worker `file://` altında çalışmaz — köken kısıtı). Sunucu şimdiye kadar ELLE
//  başlatılıyordu; gece kuyruğu bunu yapamadığı için canlı tarayıcı kapısı hiç
//  otomatik koşamadı. Bu dosya o boşluğu kapatır: bağımlılık yok, `node` yeter.
//
//    node tools/kapi-sunucu.js [--port 8123]      (Ctrl+C ile durur)
// ═══════════════════════════════════════════════════════════════════════════
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const PORT = Number(arg('--port', 8123)) || 8123;
const KOK = path.resolve(__dirname, '..');

const TIP = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
    const u = decodeURIComponent((req.url || '/').split('?')[0]);
    const dosya = path.resolve(KOK, '.' + u);
    // kök dışına çıkışı engelle
    if (!dosya.startsWith(KOK)) { res.writeHead(403); res.end('403'); return; }
    fs.readFile(dosya, (e, veri) => {
        if (e) { res.writeHead(404); res.end('404 ' + u); return; }
        /* ÖNBELLEK KAPALI: kalıcı önbellek bu projede bir düzeltmeyi yuttu ve
           "düzeltme işe yaramadı" gibi göründü (tarayıcı eski js'i servis ediyordu). */
        res.writeHead(200, { 'Content-Type': TIP[path.extname(dosya).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': 'no-store, no-cache, must-revalidate' });
        res.end(veri);
    });
}).listen(PORT, '127.0.0.1', () => console.log('kapi-sunucu: http://localhost:' + PORT + '/  kok=' + KOK));
