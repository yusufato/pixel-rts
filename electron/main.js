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
// LLM ÖZ-SINAMASI: `Pixel RTS.exe --llm-selftest` → modeli PAKETLENMİŞ çalışma
// ortamında yükler, tek diyalog üretir, sonucu basıp çıkar. Paketlenmiş kurulumda
// node-llama-cpp'nin doğal ikililerini (asar dışından) gerçekten yükleyip
// üretebildiğini kanıtlar — GUI açmadan, tam da kullanıcının çalıştıracağı exe ile.
const LLM_SELFTEST = process.argv.includes('--llm-selftest');
// GERÇEK-ARAYÜZ TESTİ: `--uitest [--shots <klasör>]` → oyunu AÇAR, menüden karakter
// ekranına ve dünya haritasına GERÇEKTEN tıklar, her adımın EKRAN GÖRÜNTÜSÜNÜ kaydeder.
// Neden var: jsdom testleri DOM'u doğrular ama GÖRÜNÜRLÜĞÜ doğrulayamaz — karakter
// ekranı CSS beyaz-listesinde olmadığı için kabuk gizlenip alttaki savaş kanvası
// açığa çıkmıştı ve bunu yalnız oyunu gerçekten açan biri görebildi (kullanıcı gördü).
// Bu test o sınıf hatayı otomatik yakalar; görüntüler insan gözüyle de incelenebilir.
const UITEST = process.argv.includes('--uitest');
const _shotsIdx = process.argv.indexOf('--shots');
const SHOTS_DIR = _shotsIdx >= 0 ? process.argv[_shotsIdx + 1] : path.join(require('os').tmpdir(), 'pixel-uitest');

app.whenReady().then(() => {
    if (LLM_SELFTEST) {
        llmStart();
        const t0 = Date.now();
        const tick = setInterval(() => {
            if (llmError) { console.log('LLM_SELFTEST_FAIL yükleme: ' + llmError); clearInterval(tick); app.exit(1); return; }
            if (Date.now() - t0 > 90000) { console.log('LLM_SELFTEST_FAIL zaman aşımı (model yüklenmedi)'); clearInterval(tick); app.exit(1); return; }
            if (!llmReady) return;
            clearInterval(tick);
            const id = ++llmSeq;
            llmChild.send({ t: 'gen', id, system: 'Sadece Türkçe, tam 2 replik yaz, "İsim: söz" biçiminde.',
                prompt: 'KONUŞANLAR:\n- Demir Paşa\n- Kaya Bey\nDURUM: Maaşlar ödenmedi.', maxTokens: 90, temperature: 0.4 });
            const handler = m => {
                if (!m || m.t !== 'gen' || m.id !== id) return;
                llmChild.off('message', handler);
                console.log('LLM_SELFTEST_MODEL ' + (llmPath ? path.basename(llmPath) : '?'));
                if (m.error) { console.log('LLM_SELFTEST_FAIL üretim: ' + m.error); app.exit(1); }
                else { console.log('LLM_SELFTEST_OUT ' + JSON.stringify(String(m.text || '').trim())); console.log('LLM_SELFTEST_OK'); app.exit(0); }
            };
            llmChild.on('message', handler);
        }, 300);
        return;
    }

    // SAVAŞ TESTİ: `--battletest [--shots <klasör>]` → Hızlı Maç ile çizilen haritada
    // deploy fazına girer, yakın + uzak ekran görüntüsü alır (arazi doğru render'lanıyor mu).
    if (process.argv.includes('--battletest')) {
        createWindow();
        const fsx2 = require('fs');
        try { fsx2.mkdirSync(SHOTS_DIR, { recursive: true }); } catch (_) {}
        const problems = [];
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) problems.push('konsol: ' + message); });
        win.webContents.on('render-process-gone', (_e, d) => problems.push('render öldü: ' + d.reason));
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        const shot = async name => { try { const img = await win.webContents.capturePage(); fsx2.writeFileSync(path.join(SHOTS_DIR, name + '.png'), img.toPNG()); } catch (_) {} };
        const click = sel => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (el) el.click(); return !!el; })()`);
        win.webContents.on('did-finish-load', async () => {
            await sleep(1200);
            await click('#btn-quick-match'); await sleep(400);
            await click('#btn-qm-start'); await sleep(900);
            const info = await js(`(() => { try {
                return { mode: (typeof MAP_MODE !== 'undefined') ? MAP_MODE : '?',
                    mapId: (typeof currentMapId !== 'undefined') ? currentMapId : '?',
                    map: (typeof DRAWN_MAP !== 'undefined') ? DRAWN_MAP.name : '?',
                    grid: (typeof terrainGrid !== 'undefined' && terrainGrid) ? terrainGrid.length : -1,
                    feats: (typeof terrainFeatures !== 'undefined') ? terrainFeatures.length : -1 };
            } catch (e) { return { err: e.message }; } })()`);
            console.log('BATTLETEST_INFO ' + JSON.stringify(info));
            await sleep(400);
            await shot('battle-a-deploy');
            await js(`(() => { try { window.__z0 = zoom; for (let i=0;i<5;i++){ zoom *= 0.84; } } catch(e){} })()`);
            await sleep(500);
            await shot('battle-b-genel');
            console.log('BATTLETEST_SHOTS ' + SHOTS_DIR);
            console.log('BATTLETEST_PROBLEMS ' + JSON.stringify(problems.slice(0, 8)));
            console.log('BATTLETEST_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    if (UITEST) {
        createWindow();
        const fsx2 = require('fs');
        try { fsx2.mkdirSync(SHOTS_DIR, { recursive: true }); } catch (_) {}
        const problems = [];
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) problems.push('konsol: ' + message); });
        win.webContents.on('render-process-gone', (_e, d) => problems.push('render öldü: ' + d.reason));
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        const shot = async name => {
            try { const img = await win.webContents.capturePage(); fsx2.writeFileSync(path.join(SHOTS_DIR, name + '.png'), img.toPNG()); }
            catch (e) { problems.push('görüntü alınamadı ' + name + ': ' + e.message); }
        };
        const click = sel => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'YOK ' + ${JSON.stringify(sel)}; el.click(); return 'ok'; })()`);
        // GÖRÜNÜRLÜK: DOM'da olmak yetmez — kutusu sıfırdan büyük ve display:none olmayan ata zinciri gerekir
        const vis = sel => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false;
            const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; })()`);
        const screenName = () => js(`document.body.getAttribute('data-screen')`);

        win.webContents.on('did-finish-load', async () => {
            const expect = async (step, cond, info) => {
                const okk = await cond;
                console.log('UITEST_STEP ' + step + ' ' + (okk ? 'OK' : 'FAIL') + (info ? ' ' + info : ''));
                if (!okk) problems.push('adım ' + step);
                return okk;
            };
            await sleep(1200); await shot('01-menu');
            await expect('menu', (async () => (await screenName()) === 'menu' && (await vis('#btn-new-story')))());

            await click('#btn-new-story'); await sleep(500); await shot('02-kurulum');
            await expect('kurulum', (async () => (await screenName()) === 'story-setup')());

            await click('.wr-state-card'); await sleep(400); await shot('03-devlet-secildi');
            await click('#btn-story-start'); await sleep(700); await shot('04-karakter-zar');
            // ASIL DENETİM: karakter ekranı GÖRÜNÜR olmalı, savaş kanvası değil
            await expect('karakter-görünür', (async () =>
                (await screenName()) === 'story-character' && (await vis('#char-body')) && (await vis('#char-roll')))(),
                'screen=' + (await screenName()));

            await click('#char-roll'); await sleep(200);
            await click('#char-next'); await sleep(400); await shot('05-soru-1');
            await expect('sorular', vis('.char-opt'));
            for (let i = 0; i < 12; i++) {
                await click('.char-opt'); await sleep(150);
                if (i === 6) await shot('06-soru-7');
            }
            await sleep(300); await shot('07-ozet');
            await expect('özet', vis('#char-go'));

            await click('#char-go'); await sleep(1500); await shot('08-dunya-haritasi');
            await expect('dünya', (async () => (await screenName()) === 'story')(), 'screen=' + (await screenName()));

            console.log('UITEST_SHOTS ' + SHOTS_DIR);
            console.log('UITEST_PROBLEMS ' + JSON.stringify(problems));
            console.log(problems.length ? 'UITEST_FAIL' : 'UITEST_OK');
            setTimeout(() => app.exit(problems.length ? 1 : 0), 200);
        });
        return;
    }

    // OYUN-YAŞAMA TESTİ: `--playtest [--years N] [--shots <klasör>]` → karakter yaratır,
    // sonra dünyada N YIL yaşar: konseylerde oy kullanır, saldırıya uğrarsa karar verir,
    // her yıl harita + panel görüntüsü alır, yıl-yıl dünya durumunu JSON raporlar.
    // Amaç: sonraki geliştirme aşamalarının (fraksiyon/ekonomi/medya) gerekçesini
    // varsayımdan değil YAŞANMIŞ oyundan çıkarmak.
    if (process.argv.includes('--playtest')) {
        createWindow();
        const yi = process.argv.indexOf('--years');
        const YEARS = yi >= 0 ? Math.max(1, parseInt(process.argv[yi + 1], 10) || 10) : 10;
        const fsx2 = require('fs');
        try { fsx2.mkdirSync(SHOTS_DIR, { recursive: true }); } catch (_) {}
        const problems = [];
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) problems.push('konsol: ' + message); });
        win.webContents.on('render-process-gone', (_e, d) => problems.push('render öldü: ' + d.reason));
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        const shot = async name => { try { const img = await win.webContents.capturePage(); fsx2.writeFileSync(path.join(SHOTS_DIR, name + '.png'), img.toPNG()); } catch (_) {} };
        const click = sel => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (el) el.click(); return !!el; })()`);

        win.webContents.on('did-finish-load', async () => {
            await sleep(1200);
            // savunma teklifi: küçük şehirde çekil, başkent/büyük şehirde savaşma yerine yine çekil
            // (arena otomasyonu ayrı iş; pasif savunma da meşru bir oyuncu stili)
            await js(`window.confirm = () => false; window.alert = () => {};`);
            // karakter yarat (uitest ile aynı yol)
            await click('#btn-new-story'); await sleep(400);
            await click('.wr-state-card'); await sleep(300);
            await click('#btn-story-start'); await sleep(500);
            await js(`(() => { const n = document.getElementById('char-name'); if (n) { n.value = 'Fable Paşa'; n.dispatchEvent(new Event('input')); } })()`);
            await click('#char-next'); await sleep(300);
            for (let i = 0; i < 12; i++) { await click('.char-opt'); await sleep(120); }
            await shot('00-karakter-ozeti');
            await click('#char-go'); await sleep(1200);
            await shot('yil-0-baslangic');

            const report = [];
            let councilShots = 0;
            for (let y = 1; y <= YEARS; y++) {
                // 1 yıl = 120 oyun-sn; 30'luk parçalarla ilerlet, arada konsey/duruma bak
                for (let c = 0; c < 4; c++) {
                    await js(`(() => { STORY.paused = false; for (let i = 0; i < 30; i++) storyAdvance(1.0); STORY.paused = true; })()`);
                    const ses = await js(`!!STORY._session`);
                    if (ses) {
                        if (councilShots < 2) { await shot('konsey-oturumu-' + (++councilShots)); }
                        // KONSEYDE YAŞA: her maddede kişiliğime uyan oyu ver, sonra ilerle
                        await js(`(() => { let g = 0; while (STORY._session && g++ < 24) {
                            try { const S = STORY._session, item = S.items && S.items[S.idx];
                                  if (item && item.options && item.options.length && typeof storyCouncilSessionPick === 'function')
                                      storyCouncilSessionPick(item.options[Math.floor(Math.random() * item.options.length)].id);
                            } catch (_) {}
                            storyCouncilSessionNext();
                        } })()`);
                    }
                    await sleep(60);
                }
                const snap = JSON.parse(await js(`JSON.stringify((() => {
                    const me = storyPlayerState();
                    const cmds = storyStateCommanders(me);
                    const host = STORY.states.filter(s => s.id !== me.id && STORY.nodes.some(n => n.owner === s.id)
                        && (typeof storyIsHostile === 'function' && storyIsHostile(me.id, s.id))).length;
                    return {
                        yil: storyYear(), sehir: STORY.nodes.filter(n => n.owner === me.id).length,
                        refah: Math.round(me.welfare), hazine: Math.round(me.res.points),
                        kasam: Math.round((STORY.commander.res || {}).points || 0),
                        ordum: (typeof cmdArmyCount === 'function') ? cmdArmyCount(STORY.commander) : -1,
                        sadakat: Math.round(cmds.reduce((a, c) => a + (c.loyalty || 0), 0) / Math.max(1, cmds.length)),
                        cag: (typeof storyEra === 'function' && storyEra()) ? storyEra().name : '?',
                        dusman: host, canli: STORY.states.filter(s => STORY.nodes.some(n => n.owner === s.id)).length,
                        sohbet: (STORY._chatter || []).length, gorusme: (STORY._talks || []).length,
                        sonOlay: (STORY.log[0] || '').replace(/<[^>]+>/g, '').slice(0, 90),
                    };
                })())`));
                report.push(snap);
                console.log('PLAYTEST_YIL ' + JSON.stringify(snap));
                await shot('yil-' + y);
            }
            // yıl 10 panelleri: konsey çekmecesi + sohbet defteri
            await click('#story-council-btn'); await sleep(400); await shot('panel-konsey');
            await click('.ctab[data-tab="fac"]'); await sleep(300); await shot('panel-fraksiyonlar');
            await click('#story-council-btn'); await sleep(200);
            await click('#story-city-btn'); await sleep(400); await shot('panel-sehir');
            await click('.cb-sub'); await sleep(300); await shot('panel-binalar');
            await click('#story-city-btn'); await sleep(200);
            await click('#story-commander-btn'); await sleep(500); await shot('panel-komutan-agaci');
            await click('#commander-back-btn'); await sleep(200);
            await click('#story-news-btn'); await sleep(400); await shot('panel-gazete');
            await click('#story-news-btn'); await sleep(200);
            await click('#story-army-btn'); await sleep(400); await shot('panel-ordu');
            console.log('PLAYTEST_SHOTS ' + SHOTS_DIR);
            console.log('PLAYTEST_PROBLEMS ' + JSON.stringify(problems.slice(0, 5)));
            console.log('PLAYTEST_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

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
    // gpuLayers: 'auto' → node-llama-cpp VRAM'e sığdığı kadar katmanı GPU'ya koyar,
    // gerisini CPU'da bırakır. GPU'lu makinede diyalog ~1 sn, GPU'suzda ~45 sn ama
    // çalışır. Ölçüm: bench --gpu 99 ile 24-50 jeton/sn alındı, yani bu makinede GPU
    // yolu çalışıyor. Sığdırma başarısız olursa host 'error' yollar, oyun şablona düşer.
    llmChild.send({ t: 'load', modelPath: llmPath, gpuLayers: 'auto' });
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
