'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  TARAYICI KAPISI KOŞUCUSU — headless Edge/Chrome + CDP, GERÇEK bekleme ile
//
//  NEDEN VAR: `--virtual-time-budget --dump-dom` bu iş için ÇALIŞMIYOR. Sayfa işçiyi
//  beklerken ana iş parçacığı BOŞTA kalıyor, sanal zaman anında doluyor ve DOM işçi
//  daha cevap vermeden dökülüyor — kapı hep "yarım" görünüyordu. (Ölçüldü: çıktı her
//  seferinde "işçi HAZIR" satırında kesiliyordu.)
//
//  Bu araç yerine CDP kullanır: sayfayı açar, `window.__KAPI_SONUC` dolana kadar GERÇEK
//  zamanda yoklar, sonra hem sonucu hem sayfa metnini basar. Konsol hataları da toplanır
//  (sessiz çöküş "kapı düştü" ile karışmasın).
//
//    node tools/tarayici-kapi-kos.js [--url <adres>] [--sure 600] [--port 9444]
// ═══════════════════════════════════════════════════════════════════════════
const { spawn } = require('node:child_process');
const fs = require('node:fs');

function arg(a, d) { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : d; }
const URL_ = arg('--url', 'http://localhost:8123/tools/worker-tarayici-kapisi.html');
const SURE = Math.max(10, Number(arg('--sure', 600)) || 600);        // saniye
const PORT = Number(arg('--port', 9444)) || 9444;

const ADAYLAR = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
];
const TARAYICI = ADAYLAR.find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
if (!TARAYICI) { console.log('TARAYICI BULUNAMADI:\n  ' + ADAYLAR.join('\n  ')); process.exit(1); }

const bekle = (ms) => new Promise(c => setTimeout(c, ms));

(async () => {
    /* HER KOSUDA TAZE PROFIL — kalici profil kullanilinca tarayici js/ dosyalarini
       ONBELLEKTEN veriyor ve kodda yapilan duzeltme sayfaya HIC ULASMIYOR. Bu, "duzeltme
       ise yaramadi" gibi gorunen ama aslinda eski kodu olcen bir tuzak (yasandi). */
    const profil = 'C:/Users/osman/AppData/Local/Temp/claude/cdp-profil-' + PORT + '-' + process.pid;
    const p = spawn(TARAYICI, [
        '--headless=new', '--disable-gpu', '--no-sandbox', '--mute-audio',
        '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
        '--user-data-dir=' + profil, '--disable-application-cache', '--media-cache-size=1',
        '--disk-cache-size=1', '--remote-debugging-port=' + PORT, URL_
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    p.stderr.on('data', d => { stderr += d.toString(); });

    // CDP hedefini bul (tarayıcı açılana kadar dene)
    let hedef = null;
    for (let i = 0; i < 60 && !hedef; i++) {
        await bekle(500);
        try {
            const r = await fetch('http://127.0.0.1:' + PORT + '/json');
            const liste = await r.json();
            hedef = liste.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
        } catch (e) { /* henüz açılmadı */ }
    }
    if (!hedef) { console.log('CDP HEDEFI BULUNAMADI (tarayici acilmadi?)'); p.kill(); process.exit(1); }

    const ws = new WebSocket(hedef.webSocketDebuggerUrl);
    let sonId = 0;
    const bekleyen = new Map();
    const konsol = [];
    await new Promise((c, r) => { ws.onopen = c; ws.onerror = r; });
    ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id && bekleyen.has(m.id)) { bekleyen.get(m.id)(m.result); bekleyen.delete(m.id); return; }
        if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
            konsol.push((m.params.args || []).map(a => a.value || a.description || '').join(' '));
        }
        if (m.method === 'Runtime.exceptionThrown') {
            const d = m.params.exceptionDetails || {};
            konsol.push('EXCEPTION: ' + (d.exception && d.exception.description || d.text));
        }
    };
    const cagir = (method, params) => new Promise(c => {
        const id = ++sonId; bekleyen.set(id, c);
        ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
    await cagir('Runtime.enable');

    const t0 = Date.now();
    let sonuc = null;
    while ((Date.now() - t0) / 1000 < SURE) {
        const r = await cagir('Runtime.evaluate', {
            expression: 'JSON.stringify(window.__KAPI_SONUC || null)', returnByValue: true
        });
        const v = r && r.result && r.result.value;
        if (v && v !== 'null') { sonuc = JSON.parse(v); break; }
        await bekle(1000);
    }
    const metin = await cagir('Runtime.evaluate', {
        expression: '(document.getElementById("cikti")||{}).innerText || ""', returnByValue: true
    });
    console.log((metin && metin.result && metin.result.value) || '(cikti yok)');
    if (konsol.length) {
        console.log('');
        console.log('KONSOL HATALARI:');
        for (const k of konsol.slice(0, 12)) console.log('  ' + k);
    }
    console.log('');
    console.log('SONUC: ' + (sonuc ? JSON.stringify(sonuc) : 'YOK (' + SURE + 'sn icinde tamamlanmadi)'));
    try { ws.close(); } catch (e) {}
    p.kill();
    try { fs.rmSync(profil, { recursive: true, force: true }); } catch (e) {}
    process.exit(sonuc && sonuc.gecti ? 0 : 1);
})().catch(e => { console.log('HATA: ' + (e && e.stack || e)); process.exit(1); });
