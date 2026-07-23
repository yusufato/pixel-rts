// ═══════════════════════════════════════════════════════════════════════════
//  PIXEL RTS — MASAÜSTÜ KABUĞU (Electron ana süreci)
//  ---------------------------------------------------------------------------
//  Oyun saf web teknolojisi olduğu için oyun kodu HİÇ değişmedi: index.html
//  hem tarayıcıda hem burada çalışır. Bu dosya yalnız pencereyi kuruyor.
//
//  Tasarım kararları:
//   • Tam ekran açılır (F11 ile pencere moduna geçilebilir) — "oyun hissi".
//   • Menü çubuğu yok; adres çubuğu yok.
//   • nodeIntegration KAPALI, contextIsolation AÇIK. Oyun DOM'u güvenilmeyen
//     içerik çalıştırmasa da bu varsayılan güvenli olan. Node'a ihtiyaç duyan
//     tek şey LLM köprüsü ve o preload üzerinden dar bir yüzeyle veriliyor.
//   • Kayıtlar localStorage'da; Electron'da da kalıcı (userData altında).
// ═══════════════════════════════════════════════════════════════════════════

const { app, BrowserWindow, Menu, globalShortcut, ipcMain, shell } = require('electron');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let win = null;

function createWindow() {
    win = new BrowserWindow({
        width: 1600,
        height: 900,
        minWidth: 1024,
        minHeight: 640,
        fullscreen: true,
        backgroundColor: '#07100c',      // yükleme anında beyaz parlama olmasın
        show: false,                     // hazır olunca göster (ani siyah kare yok)
        autoHideMenuBar: true,
        title: 'Pixel RTS',
        icon: path.join(ROOT, 'assets', 'icon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,              // preload'un LLM köprüsünü kurabilmesi için
            backgroundThrottling: false, // arka planda dünya simülasyonu yavaşlamasın
        },
    });

    Menu.setApplicationMenu(null);
    win.loadFile(path.join(ROOT, 'index.html'));
    win.once('ready-to-show', () => win.show());

    // Dış bağlantılar sistem tarayıcısında açılsın, oyun penceresi kaçırılmasın
    win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });

    win.on('closed', () => { win = null; });
}

// DUMAN TESTİ: `electron . --smoke` → pencereyi açar, sayfayı yükler, konsol
// hatalarını rapor eder ve kapanır. CI/otomatik doğrulama için.
const SMOKE = process.argv.includes('--smoke');

app.whenReady().then(() => {
    createWindow();

    if (SMOKE) {
        const problems = [];
        win.webContents.on('console-message', (_e, level, message) => {
            if (level >= 2) problems.push('konsol: ' + message);           // 2=warning, 3=error
        });
        win.webContents.on('render-process-gone', (_e, d) => problems.push('render öldü: ' + d.reason));
        win.webContents.on('did-fail-load', (_e, code, desc) => problems.push('yükleme hatası: ' + code + ' ' + desc));
        win.webContents.on('did-finish-load', async () => {
            // oyun global'leri gerçekten kuruldu mu?
            let probe = null;
            try {
                probe = await win.webContents.executeJavaScript(`(() => {
                    // GÖRSELLER: paketlemede bir varlık unutulursa <img> "broken" olur ve
                    // ilk drawImage oyun döngüsünü öldürür. Bu tam olarak yaşandı
                    // (icons.png files listesinde yoktu → savaş açılışında çökme).
                    // Duman testi artık her <img>'in GERÇEKTEN yüklendiğini doğruluyor.
                    const imgs = [...document.querySelectorAll('img')].map(i => ({
                        src: i.getAttribute('src'),
                        ok: i.complete && i.naturalWidth > 0,
                    }));
                    return {
                        story: typeof STORY,
                        council: typeof storyCouncilTick,
                        talks: typeof storyTalkTick,
                        chatter: typeof storyChatterTick,
                        tree: typeof CMDR_TREE,
                        nodes: (typeof storyBuildCities === 'function') ? storyBuildCities().length : -1,
                        bridge: typeof window.PIXEL,
                        images: imgs,
                        brokenImages: imgs.filter(i => !i.ok).map(i => i.src),
                    };
                })()`);
            } catch (e) { problems.push('sonda hatası: ' + e.message); }
            if (probe && probe.brokenImages && probe.brokenImages.length)
                problems.push('YÜKLENEMEYEN GÖRSEL: ' + probe.brokenImages.join(', ')
                              + '  → package.json "files" listesinde eksik olabilir');
            console.log('SMOKE_PROBE ' + JSON.stringify(probe));
            console.log('SMOKE_PROBLEMS ' + JSON.stringify(problems));
            console.log(problems.length ? 'SMOKE_FAIL' : 'SMOKE_OK');
            setTimeout(() => app.exit(problems.length ? 1 : 0), 150);
        });
        return;   // duman testinde kısayol kaydetme
    }

    // F11 tam ekran, F12 geliştirici araçları, Ctrl+R yeniden yükle
    globalShortcut.register('F11', () => { if (win) win.setFullScreen(!win.isFullScreen()); });
    globalShortcut.register('F12', () => { if (win) win.webContents.toggleDevTools(); });
    globalShortcut.register('CommandOrControl+R', () => { if (win) win.reload(); });

    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('will-quit', () => globalShortcut.unregisterAll());

// ── OYUNA AÇILAN DAR YÜZEY ─────────────────────────────────────────────────
ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    userData: app.getPath('userData'),
    desktop: true,
}));

// ── LLM KÖPRÜSÜ ────────────────────────────────────────────────────────────
// Model AYRI SÜREÇTE (electron/llm-host.js) çalışır — çıkarım iş parçacığını
// bloke ettiği için ana süreçte olsaydı pencere donardı.
// Model TEMBEL yüklenir: oyun ilk metin isteyene kadar RAM harcanmaz.
const { fork } = require('child_process');
const fsx = require('fs');

let llmChild = null, llmReady = false, llmError = null, llmPath = null;
let llmSeq = 0;
const llmPending = new Map();

// Model arama sırası: kurulum klasörü → userData → kullanıcının models klasörü
function findModel() {
    const cands = [
        path.join(process.resourcesPath || ROOT, 'models'),
        path.join(ROOT, 'models'),
        path.join(app.getPath('userData'), 'models'),
        path.join(app.getPath('home'), 'models'),
    ];
    for (const dir of cands) {
        let files = [];
        try { files = fsx.readdirSync(dir); } catch (_) { continue; }
        // çok parçalı modellerde ilk parça verilir; llama.cpp gerisini bulur
        const gguf = files.filter(f => /\.gguf$/i.test(f) && !/-0000[2-9]-of-/.test(f));
        if (!gguf.length) continue;
        // TÜRKÇE MODELİ TERCİH ET. Ölçüm (gram_bench, 3 model): genel amaçlı Qwen
        // biçime uyuyor ama Türkçe morfolojisi bozuk ("hamımlık", "önceliğ") ve bu
        // KODLA DÜZELTİLEMEZ. Türkçe-ayarlı Llama'nın Türkçesi temiz; tek kusuru
        // biçim iskelesi ve o doğrulayıcıda ayıklanıyor (kullanılabilir %44→%89).
        // O yüzden bir klasörde Türkçe model varsa onu seç, yoksa alfabetik ilk.
        const tr = gguf.filter(f => /turkish|cosmos|trendyol|llama-3.*tr|tr[-_]/i.test(f));
        return path.join(dir, (tr.length ? tr : gguf).sort()[0]);
    }
    return null;
}

function llmStart() {
    if (llmChild || llmError) return;
    llmPath = findModel();
    if (!llmPath) { llmError = 'model bulunamadı'; return; }
    try {
        llmChild = fork(path.join(__dirname, 'llm-host.js'), [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    } catch (e) { llmError = 'süreç başlatılamadı: ' + e.message; return; }

    llmChild.on('message', m => {
        if (!m) return;
        if (m.t === 'loaded') { llmReady = true; return; }
        if (m.t === 'error') { llmError = m.error; return; }
        if (m.t === 'gen') {
            const r = llmPending.get(m.id);
            if (r) { llmPending.delete(m.id); r(m.error ? null : m.text); }
        }
    });
    llmChild.on('exit', () => { llmChild = null; llmReady = false; for (const r of llmPending.values()) r(null); llmPending.clear(); });
    // gpuLayers: 0 = saf CPU. Geniş kitle varsayılanı; ölçümden sonra ayarlanacak.
    llmChild.send({ t: 'load', modelPath: llmPath, gpuLayers: 0 });
}

ipcMain.handle('llm:status', () => {
    if (!llmChild && !llmError) llmStart();
    return { ready: llmReady, error: llmError, model: llmPath ? path.basename(llmPath) : null };
});

ipcMain.handle('llm:generate', async (_e, req) => {
    if (!llmChild && !llmError) llmStart();
    if (!llmReady) return null;                       // hazır değilse oyun yedeğe düşer
    const id = ++llmSeq;
    llmChild.send({ t: 'gen', id, system: req.system, prompt: req.prompt, maxTokens: req.maxTokens, temperature: req.temperature });
    return new Promise(resolve => {
        llmPending.set(id, resolve);
        // ZAMAN AŞIMI 30 sn → 120 sn. Ölçüm: saf CPU'da 7B ~0.8 jeton/sn, tek diyalog
        // 36–54 sn sürüyor. 30 sn'lik sınır CPU'daki HER üretimi keserdi: model 4.5 GB
        // RAM tutar, bir çekirdeği doldurur ve sonuç HİÇBİR ZAMAN kullanılmazdı.
        // Oyun zaten bunu beklemiyor (ateşle-unut), o yüzden uzun sınır bedava.
        setTimeout(() => { if (llmPending.has(id)) { llmPending.delete(id); resolve(null); } }, 120000);
    });
});

app.on('will-quit', () => { if (llmChild) { try { llmChild.send({ t: 'stop' }); } catch (_) {} } });
