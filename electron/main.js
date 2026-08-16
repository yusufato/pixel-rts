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

// ── BAŞSIZ TEST KİPİ (bellek düzeltmesi) ───────────────────────────
// ÖLÇÜLDÜ: başsız bir test koşusu 5.5-5.9GB tutuyordu ve bunun 4.9GB'i RENDERER DEĞİL
// ANA (browser) SÜRECİNDEYDİ — renderer yalnız 411MB, sayfanın JS yığını 54MB, canvas 6MB.
// Sebep: createWindow TAM EKRAN pencere açıyor ve ready-to-show'da GERÇEKTEN gösteriyordu;
// GPU kapalı olduğu için tam-ekran yüzey yazılımla sistem RAM'inde besleniyordu. Testte hiç
// çizim gerekmiyor (SIM.headless=true, rAF iptal) → pencere küçük ve GİZLİ kalır.
// Kullanıcının makinesi 12 paralel işçiyle bu yüzden dondu.
const TEST_BAYRAKLARI = new Set(["--smoke","--uitest","--battletest","--maptest","--ailab","--realrepro","--grammartest","--forktest","--recipeab","--recipebase","--membreak","--recipeaudit","--zonedrift","--ratiotest","--comptest","--armydump","--budgetprobe","--intel4pro","--matchtimeline","--intel4selfplay","--intel4exam","--pdtest","--divdiag","--defersoak","--defertest","--benchmark","--liverepro","--oracletest","--versus","--selfplay","--varietytest","--coach","--coachwatch","--learntest","--humancapture","--snaptest","--doctrinetournament","--handicaprec","--gradrec","--profilecheck","--vshandicap","--vsrec","--ablation","--vstournament","--ladder","--aibattery","--modelsmoke","--selectorlive","--oracledata","--oracleseq","--oracledagger","--diagvs","--unitdump","--fixverify","--precisiontest","--replaycheck","--playtest","--hudtest","--beyintest","--izle"]);
const TEST_KIPI = process.argv.some(a => TEST_BAYRAKLARI.has(a));

function createWindow() {
    win = new BrowserWindow({
        width: 1600,
        height: 900,
        minWidth: 1024,
        minHeight: 640,
        fullscreen: !TEST_KIPI,          // testte tam ekran YOK (4.9GB'lik ana-süreç yüzeyi)
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
    if (!TEST_KIPI) win.once('ready-to-show', () => win.show());   // testte pencere hiç gösterilmez

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
const LLM_SELFTEST = process.argv.includes('--llm-selftest') ||
    process.argv.includes('llm-selftest') ||
    process.env.PIXEL_RTS_LLM_SELFTEST === '1';
// GERÇEK-ARAYÜZ TESTİ: `--uitest [--shots <klasör>]` → oyunu AÇAR, menüden karakter
// ekranına ve dünya haritasına GERÇEKTEN tıklar, her adımın EKRAN GÖRÜNTÜSÜNÜ kaydeder.
// Neden var: jsdom testleri DOM'u doğrular ama GÖRÜNÜRLÜĞÜ doğrulayamaz — karakter
// ekranı CSS beyaz-listesinde olmadığı için kabuk gizlenip alttaki savaş kanvası
// açığa çıkmıştı ve bunu yalnız oyunu gerçekten açan biri görebildi (kullanıcı gördü).
// Bu test o sınıf hatayı otomatik yakalar; görüntüler insan gözüyle de incelenebilir.
const UITEST = process.argv.includes('--uitest');
// ARAYUZ YERLESIM TESTI: paneller cakisiyor mu / dizim kunyesi doluyor mu (olculur, goz karari degil)
const HUDTEST = process.argv.includes('--hudtest');
// Paketlenmiş Electron, bilinmeyen `--battletest` argümanını Chromium katmanında
// reddedebiliyor. Aynı testi kullanıcının açtığı EXE üzerinde çalıştırabilmek için
// yalnız yerel süreç ortamından etkinleşen ikinci, açık bir giriş sağlanır.
const BATTLETEST = process.argv.includes('--battletest') ||
    process.argv.includes('battletest') ||
    process.env.PIXEL_RTS_BATTLETEST === '1';
const _shotsIdx = process.argv.indexOf('--shots');
const SHOTS_DIR = _shotsIdx >= 0 ? process.argv[_shotsIdx + 1] : path.join(require('os').tmpdir(), 'pixel-uitest');

app.whenReady().then(() => {
    if (LLM_SELFTEST) {
        const fsSelftest = require('fs');
        const llmSelftestResultFile = process.env.PIXEL_RTS_LLM_SELFTEST_RESULT ||
            (process.argv.includes('llm-selftest')
                ? path.join(require('os').tmpdir(), 'pixel-rts-llm-selftest-result.json')
                : null);
        const finishLLMSelftest = (status, details, exitCode) => {
            const result = {
                status,
                model: llmPath ? path.basename(llmPath) : null,
                ...details
            };
            if (llmSelftestResultFile) {
                try {
                    fsSelftest.writeFileSync(
                        llmSelftestResultFile,
                        JSON.stringify(result, null, 2),
                        'utf8'
                    );
                } catch (error) {
                    console.log('LLM_SELFTEST_RESULT_WRITE_FAIL ' + error.message);
                }
            }
            setTimeout(() => app.exit(exitCode), 150);
        };
        llmStart();
        const t0 = Date.now();
        const tick = setInterval(() => {
            if (llmError) {
                console.log('LLM_SELFTEST_FAIL yükleme: ' + llmError);
                clearInterval(tick);
                finishLLMSelftest('LLM_SELFTEST_FAIL', {
                    stage: 'load',
                    error: llmError
                }, 1);
                return;
            }
            if (Date.now() - t0 > 90000) {
                console.log('LLM_SELFTEST_FAIL zaman aşımı (model yüklenmedi)');
                clearInterval(tick);
                finishLLMSelftest('LLM_SELFTEST_FAIL', {
                    stage: 'load',
                    error: 'model yükleme zaman aşımı'
                }, 1);
                return;
            }
            if (!llmReady) return;
            clearInterval(tick);
            const id = ++llmSeq;
            llmChild.send({ t: 'gen', id, system: 'Sadece Türkçe, tam 2 replik yaz, "İsim: söz" biçiminde.',
                prompt: 'KONUŞANLAR:\n- Demir Paşa\n- Kaya Bey\nDURUM: Maaşlar ödenmedi.', maxTokens: 90, temperature: 0.4 });
            const handler = m => {
                if (!m || m.t !== 'gen' || m.id !== id) return;
                llmChild.off('message', handler);
                console.log('LLM_SELFTEST_MODEL ' + (llmPath ? path.basename(llmPath) : '?'));
                if (m.error) {
                    console.log('LLM_SELFTEST_FAIL üretim: ' + m.error);
                    finishLLMSelftest('LLM_SELFTEST_FAIL', {
                        stage: 'generate',
                        error: m.error
                    }, 1);
                } else {
                    const output = String(m.text || '').trim();
                    console.log('LLM_SELFTEST_OUT ' + JSON.stringify(output));
                    console.log('LLM_SELFTEST_OK');
                    finishLLMSelftest('LLM_SELFTEST_OK', {
                        stage: 'generate',
                        output,
                        durationMs: Date.now() - t0
                    }, 0);
                }
            };
            llmChild.on('message', handler);
        }, 300);
        return;
    }

    // HARİTA TESTİ: `--maptest [--shots <klasör>]` → karakter yarat → dünya haritası;
    // uzak/orta/yakın zoom ekran görüntüsü + node hit-test round-trip (tıklama doğruluğu).
    if (process.argv.includes('--maptest')) {
        createWindow();
        const fsx2 = require('fs');
        try { fsx2.mkdirSync(SHOTS_DIR, { recursive: true }); } catch (_) {}
        const problems = [];
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) problems.push('konsol: ' + message); });
        win.webContents.on('render-process-gone', (_e, d) => problems.push('render öldü: ' + d.reason));
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        const shot = async name => { try { const img = await win.webContents.capturePage(); fsx2.writeFileSync(path.join(SHOTS_DIR, name + '.png'), img.toPNG()); } catch (_) {} };
        const canvasShot = async name => {
            try {
                const dataUrl = await js(`(() => { const cv = document.getElementById('storyCanvas'); return cv ? cv.toDataURL('image/png') : null; })()`);
                if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
                    problems.push('saf harita canvas çıktısı alınamadı');
                    return false;
                }
                fsx2.writeFileSync(path.join(SHOTS_DIR, name + '.png'), Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
                return true;
            } catch (error) {
                problems.push('saf harita PNG: ' + error.message);
                return false;
            }
        };
        const click = sel => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (el) el.click(); return !!el; })()`);
        const settlePaint = () => js(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
        win.webContents.on('did-finish-load', async () => {
            await sleep(1200);
            await js(`window.confirm = () => false; window.alert = () => {};`);
            await click('#btn-new-story'); await sleep(400);
            await click('.wr-state-card'); await sleep(300);
            await click('#btn-story-start'); await sleep(500);
            await js(`(() => { const n = document.getElementById('char-name'); if (n) { n.value = 'Harita Test'; n.dispatchEvent(new Event('input')); } })()`);
            await click('#char-next'); await sleep(300);
            for (let i = 0; i < 12; i++) { await click('.char-opt'); await sleep(100); }
            await click('#char-go'); await sleep(1400);
            const setZoom = z => js(`(() => { try { const cv=document.getElementById('storyCanvas'); storyCam.zoom=${z}; storyCenterCamOnPlayer(); storyClampCam(cv.width,cv.height); storyRender(); const sizes={}; for(const level of [1,2,3]){ const nd=STORY.nodes.find(n=>(n.level|0)===level); if(nd&&typeof storyMapV2SettlementMetrics==='function'){ const m=storyMapV2SettlementMetrics(nd,{cam:storyCam,minZoom:STORY._minZoom}); sizes[level]=m.hidden?0:m.size; }} return {zoom:storyCam.zoom, pp:(typeof storyPP==='function'?storyPP():null), min:STORY._minZoom,renderer:STORY._mapRendererVersion||'legacy',settlementPx:sizes}; } catch(e){return {err:e.message};} })()`);
            // uzak (min zoom → düz)
            let info = await js(`(() => { const cv=document.getElementById('storyCanvas'); storyCam.zoom=STORY._minZoom||0.6; storyClampCam(cv.width,cv.height); storyRender(); const sizes={}; for(const level of [1,2,3]){ const nd=STORY.nodes.find(n=>(n.level|0)===level); if(nd&&typeof storyMapV2SettlementMetrics==='function'){ const m=storyMapV2SettlementMetrics(nd,{cam:storyCam,minZoom:STORY._minZoom}); sizes[level]=m.hidden?0:m.size; }} return {zoom:storyCam.zoom,pp:storyPP(),min:STORY._minZoom,renderer:STORY._mapRendererVersion||'legacy',settlementPx:sizes}; })()`);
            console.log('MAPTEST_FAR ' + JSON.stringify(info)); await sleep(200); await settlePaint(); await shot('map-1-uzak-duz'); await canvasShot('map-saf');
            info = await setZoom(2.2); console.log('MAPTEST_MID ' + JSON.stringify(info)); await sleep(200); await settlePaint(); await shot('map-2-orta'); await canvasShot('map-2-orta-saf');
            info = await setZoom(4.5); console.log('MAPTEST_NEAR ' + JSON.stringify(info)); await sleep(200); await settlePaint(); await shot('map-3-yakin-tilt'); await canvasShot('map-3-yakin-saf');
            // HIT-TEST round-trip: her node için ekran-konumu → storyS2W → dünya; ortalama hata (px)
            const rt = await js(`(() => { try {
                let n=0, sumErr=0, maxErr=0;
                for (const nd of STORY.nodes) {
                    const sp = storyNodePixel(nd);
                    if (sp.u < 0 || sp.u > 1) continue;
                    const back = storyS2W(sp.x, sp.y);
                    const wx = nd.lx*STORY_WORLD_W, wy = nd.ly*STORY_WORLD_H;
                    const e = Math.hypot(back.x-wx, back.y-wy); sumErr+=e; maxErr=Math.max(maxErr,e); n++;
                }
                return { n, ortHata:+(sumErr/Math.max(1,n)).toFixed(3), maxHata:+maxErr.toFixed(3) };
            } catch(e){ return {err:e.message}; } })()`);
            console.log('MAPTEST_HITTEST ' + JSON.stringify(rt));
            console.log('MAPTEST_PROBLEMS ' + JSON.stringify(problems.slice(0, 6)));
            console.log('MAPTEST_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // AI LAB: `--ailab` → runAIVsAILabDiagnostics ile düz-hat vs KANAT yapan oyuncu-vekili
    // senaryolarını koşup kırmızı AI'nın kanata dayanıklılığını ölçer (AI'ye bonus YOK).
    // ── BEYIN BAGLANMA TESTI: `--beyintest` ──────────────────────────────────────────────
    // Kullanici karari (2026-08-10): iki AI kalir (intel3-pro, intel4); beonai PASIF; HIKAYE savaslari
    // intel4 ile oynanir (dusman + muttefik). Bunlar KOD OKUYARAK degil OLCEREK dogrulanir: hikaye
    // savasi gercekten acilir ve bayraklar/kontrolorler okunur. Ayrica Hizli Mac'ta secilebilen
    // beyin listesi ve varsayilan sinanir.
    if (process.argv.includes('--beyintest')) {
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        const sorunlar = [];
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) sorunlar.push('konsol: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            // 1) HIZLI MAC: secilebilir beyinler + varsayilan
            const qm = await js(`(() => {
                const btn = [...document.querySelectorAll('#qm-brain button')].map(b => b.dataset.brain);
                const secili = (document.querySelector('#qm-brain button.selected') || {}).dataset;
                return { butonlar: btn, varsayilan: secili ? secili.brain : null,
                    tabloAnahtar: Object.keys(typeof QM_BEYIN !== 'undefined' ? QM_BEYIN : {}),
                    beonaiBaglanir: Object.values(typeof QM_BEYIN !== 'undefined' ? QM_BEYIN : {}).some(v => v.beonai) };
            })()`);
            if (!qm.butonlar || qm.butonlar.length !== 2) sorunlar.push('Hizli Mac: 2 beyin bekleniyordu, var: ' + JSON.stringify(qm.butonlar));
            if (qm.butonlar && (qm.butonlar.indexOf('intel3pro') < 0 || qm.butonlar.indexOf('intel4') < 0)) sorunlar.push('Hizli Mac: intel3pro+intel4 olmali');
            if (qm.varsayilan !== 'intel4') sorunlar.push('Hizli Mac: varsayilan intel4 olmali, su an ' + qm.varsayilan);
            if (qm.beonaiBaglanir) sorunlar.push('beonai HALA baglanabiliyor (pasif olmali)');
            // 2) HIKAYE SAVASI: gercekten ac, bayraklari ve kontrolor beyinlerini oku
            const hik = await js(`(() => {
                if (typeof storyNewGame === 'function') { try { storyNewGame('TUR'); } catch (e) {} }
                if (typeof STORY === 'undefined' || !STORY) return { hata: 'STORY yok' };
                STORY.battleCtx = { mode: 'attack', durationSec: 120, attacker: 0, defender: 1, enemyStateId: 1 };
                try { storyEnterBattle({ mapId: -2 }); } catch (e) { return { hata: 'storyEnterBattle: ' + e.message }; }
                return { red: BATTLE_INTEL4_RED, blue: BATTLE_INTEL4_BLUE,
                    proRed: BATTLE_INTEL4PRO_RED, proBlue: BATTLE_INTEL4PRO_BLUE,
                    beonaiRed: BATTLE_BEONAI_RED, beonaiBlue: BATTLE_BEONAI_BLUE,
                    oturum: (typeof BATTLE_SESSION !== 'undefined') ? BATTLE_SESSION.mode : null,
                    kontrolorler: [...(typeof BATTLE_CONTROLLERS !== 'undefined' ? BATTLE_CONTROLLERS.values() : [])]
                        .map(c => c.id + ':' + (typeof battleBrainIntel4 === 'function' ? battleBrainIntel4(c.side) : '?')) };
            })()`);
            if (hik.hata) sorunlar.push('Hikaye: ' + hik.hata);
            else {
                if (hik.oturum !== 'story') sorunlar.push('Hikaye: oturum modu story degil (' + hik.oturum + ')');
                if (hik.red !== true) sorunlar.push('Hikaye: DUSMAN intel4 degil');
                if (hik.blue !== true) sorunlar.push('Hikaye: MUTTEFIK intel4 degil');
                if (hik.proRed || hik.proBlue) sorunlar.push('Hikaye: intel4-pro baglanmis olmamali');
                if (hik.beonaiRed || hik.beonaiBlue) sorunlar.push('Hikaye: beonai baglanmis olmamali');
            }
            // 3) ROSTER KAPSAMI: hikaye URETIMI rosterin kacini aciyor? (kullanici: "hikayede bu 25
            //    birlik kullanilmiyor"). Once 8 gercek + 1 HAYALET tip aciliyordu (T.ARMOR_INFANTRY
            //    UnitLoader LEGACY tablosunda tanimli degil). Artik kilit rosterden turetilir.
            const ros = await js(`(() => {
                if (typeof prodUnlockTable !== 'function' || typeof STATS === 'undefined') return { hata: 'uretim yok' };
                const t = prodUnlockTable();
                const acik = new Set();
                let hayalet = 0;
                // BINA LISTESI ELLE YAZILMAZ: alti binaya gecince ['bar','fac'] sabiti testi
                // 9/26'da birakti ve OYUNU degil TESTI kirdi. Kaynak tek: PROD_KINDS.
                const kinds = (typeof PROD_KINDS !== 'undefined') ? PROD_KINDS : Object.keys(t);
                for (const b of kinds) for (const lv of [1, 2, 3])
                    for (const tip of (t[b][lv] || [])) { if (STATS[tip]) acik.add(tip); else hayalet++; }
                const toplam = Object.keys(STATS).map(Number).filter(Number.isFinite).length;
                const eksik = Object.keys(STATS).map(Number).filter(Number.isFinite)
                    .filter(x => !acik.has(x)).map(x => STATS[x].id);
                return { rosterToplam: toplam, uretilebilir: acik.size, hayalet, eksik };
            })()`);
            if (ros.hata) sorunlar.push('Roster: ' + ros.hata);
            else {
                if (ros.hayalet > 0) sorunlar.push('Roster: ' + ros.hayalet + ' HAYALET tip (STATS karsiligi yok)');
                if (ros.uretilebilir !== ros.rosterToplam) sorunlar.push('Roster: ' + ros.uretilebilir + '/' + ros.rosterToplam + ' uretilebilir, eksik: ' + JSON.stringify(ros.eksik));
            }
            // 4) ZORLUK DUGMESI: KOLAY → dusman intel3-pro (taban), ZOR → dusman intel4.
            //    MUTTEFIK HER IKI HALDE de intel4 (zorluk rakibi ayarlar, oyuncunun tarafini sakatlamaz).
            const zor = await js(`(() => {
                const btn = [...document.querySelectorAll('#screen-story-setup .wr-option-row[data-setting="difficulty"] button')]
                    .map(b => b.dataset.value);
                const sonuc = {};
                for (const mod of ['easy', 'hard']) {
                    STORY.cfg.difficulty = mod;
                    try { storyEnterBattle({ mapId: -2 }); } catch (e) { return { hata: mod + ': ' + e.message }; }
                    sonuc[mod] = { dusman: BATTLE_INTEL4_RED, muttefik: BATTLE_INTEL4_BLUE };
                }
                return { butonlar: btn, ...sonuc };
            })()`);
            if (zor.hata) sorunlar.push('Zorluk: ' + zor.hata);
            else {
                if (!zor.butonlar || zor.butonlar.length !== 2) sorunlar.push('Zorluk: kolay/zor dugmesi yok (' + JSON.stringify(zor.butonlar) + ')');
                if (zor.easy && zor.easy.dusman !== false) sorunlar.push('KOLAY: dusman intel4 kalmis (intel3-pro olmali)');
                if (zor.hard && zor.hard.dusman !== true) sorunlar.push('ZOR: dusman intel4 degil');
                if ((zor.easy && !zor.easy.muttefik) || (zor.hard && !zor.hard.muttefik)) sorunlar.push('Muttefik her iki zorlukta da intel4 olmali');
            }
            console.log('BEYINTEST_ZORLUK ' + JSON.stringify(zor));
            console.log('BEYINTEST_ROSTER ' + JSON.stringify(ros));
            console.log('BEYINTEST_QM ' + JSON.stringify(qm));
            console.log('BEYINTEST_HIKAYE ' + JSON.stringify(hik));
            console.log('BEYINTEST_PROBLEMS ' + JSON.stringify(sorunlar.slice(0, 8)));
            console.log(sorunlar.length ? 'BEYINTEST_FAIL' : 'BEYINTEST_OK');
            setTimeout(() => app.exit(sorunlar.length ? 1 : 0), 300);
        });
        return;
    }

    // ── SEYIRCI KIPI: `--izle [--seed N] [--sn 240] [--her 10] [--shots <klasor>]` ───────────────
    // Kullanici: "bizzat oyunu calistirip iki AI'nin savasini kare kare izleyeceksin, senin icin sis yok,
    // iki tarafi da gorup oynayis tarzinin profilini cikartacaksin."
    // GERCEK oyun penceresi acilir (jsdom tezgahi degil): KIRMIZI = intel4-pro, MAVI = duz intel4, iki taraf
    // da AI. Izleyici icin SIS KAPALI (canSee her zaman true) → iki ordu da tam gorunur. Belirli araliklarla
    // ekran goruntusu + o anin sayisal ozeti alinir; sonda hepsi tek dosyaya yazilir.
    if (process.argv.includes('--izle')) {
        const _sIdx = process.argv.indexOf('--seed');
        const IZ_SEED = _sIdx >= 0 ? (Number(process.argv[_sIdx + 1]) >>> 0) : 100000;
        const _nIdx = process.argv.indexOf('--sn');
        const IZ_SN = _nIdx >= 0 ? Number(process.argv[_nIdx + 1]) : 240;
        const _hIdx = process.argv.indexOf('--her');
        const IZ_HER = _hIdx >= 0 ? Number(process.argv[_hIdx + 1]) : 12;
        // Taraf/rol degistirilebilir: taraf yanliligi ile rol yanliligi ayri ayri izlenebilsin.
        const _pIdx = process.argv.indexOf('--prokirmizi');
        const PRO_K = _pIdx >= 0 ? process.argv[_pIdx + 1] !== '0' : true;
        const _aIdx = process.argv.indexOf('--kirmizisaldiran');
        const KIRMIZI_SALDIRAN = _aIdx >= 0 ? process.argv[_aIdx + 1] !== '0' : true;
        createWindow();
        const fsz = require('fs');
        const DIR = path.join(SHOTS_DIR, 'izle-' + IZ_SEED + '-pro' + (PRO_K ? 'K' : 'M') + '-sal' + (KIRMIZI_SALDIRAN ? 'K' : 'M'));
        try { fsz.mkdirSync(DIR, { recursive: true }); } catch (_) {}
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        const shot = async name => { await sleep(300); try { const img = await win.webContents.capturePage(); fsz.writeFileSync(path.join(DIR, name + '.png'), img.toPNG()); } catch (_) {} };
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            const kur = await js(`(() => {
                // SIS KAPALI (yalniz izleyici icin, SIM'e dokunmaz): canSee sarmalanir → her sey gorunur.
                // Bu bir RENDER/gorunurluk kancasidir; AI kendi canSee'sini cagirmaz, BattlePerception kullanir.
                BATTLE_SPECTATE = true;   // sis KATMANI kapali (drawFogOfWar erken doner)
                if (!window.__izleSisKapali) {
                    window.__izleGercekCanSee = canSee;
                    window.canSee = function () { return true; };
                    window.__izleSisKapali = true;
                }
                BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
                BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;
                BATTLE_INTEL4PRO_RED = ${PRO_K ? 'true' : 'false'};
                BATTLE_INTEL4PRO_BLUE = ${PRO_K ? 'false' : 'true'};
                if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
                if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = true;
                if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;
                openBattlefieldSession({ mode:'quick', mapId:-2, seed:${IZ_SEED}, attackerSide:${KIRMIZI_SALDIRAN},
                    durationSec:${IZ_SN}, playerMoney:6500, enemyMoney:6500 });
                if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
                // MAVI ordu: duz intel4, AI surer (oyuncu karismaz) → saf AI vs AI.
                battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true,
                    brainIntel4:true, isAttacker:${!KIRMIZI_SALDIRAN}, pro:${!PRO_K} }), false, { source:'izle', ally:true });
                startBattle();
                showScreen('game');
                // Tum haritayi gor: kamerayi ortala, uzaklas.
                zoom = Math.min((window.innerWidth - 20) / WORLD_W, (window.innerHeight - 140) / WORLD_H);
                camera.x = 0; camera.y = 0;
                return { kirmizi: SIM.units.filter(u => u.isRed).length, mavi: SIM.units.filter(u => !u.isRed).length,
                    zoom: +zoom.toFixed(3), sure: SIM.battle ? SIM.battle.durationSec : null };
            })()`);
            console.log('IZLE_KURULUM ' + JSON.stringify(kur));
            // O ANIN SAYISAL OZETI: iki tarafin agirlik merkezi, yayilimi, temas mesafesi, atesteki birim
            // sayisi, ilerleme. Ekran goruntusuyle AYNI ana ait → gorsel ile sayi birbirini dogrular.
            const ozetJS = `(() => {
                const yan = k => { const a = []; for (const u of SIM.units) if (!u.dead && !u.loaded && u.isRed === k) a.push(u); return a; };
                const olc = a => { if (!a.length) return null;
                    const cx = a.reduce((s,u)=>s+u.x,0)/a.length, cy = a.reduce((s,u)=>s+u.y,0)/a.length;
                    const yay = Math.sqrt(a.reduce((s,u)=>s+(u.x-cx)**2+(u.y-cy)**2,0)/a.length);
                    let ates = 0, hasarli = 0, hp = 0, maxhp = 0, muh = 0, maxmuh = 0, bastirilmis = 0;
                    for (const u of a) { if (u.attackTarget && !u.attackTarget.dead) ates++; if (u.hp < u.maxHp) hasarli++;
                        hp += u.hp; maxhp += u.maxHp; muh += (u.ammo||0); maxmuh += (u.maxAmmo||0); if ((u.suppression||0) > 0) bastirilmis++; }
                    return { n: a.length, cx: Math.round(cx), cy: Math.round(cy), yayilim: Math.round(yay),
                        ates, hasarli, bastirilmis, can: Math.round(hp/Math.max(1,maxhp)*100),
                        muhimmat: maxmuh ? Math.round(muh/maxmuh*100) : null }; };
                const K = olc(yan(true)), M = olc(yan(false));
                let enYakin = 1e9, temasta = 0;
                for (const a of yan(true)) for (const b of yan(false)) { const d = Math.hypot(a.x-b.x, a.y-b.y);
                    if (d < enYakin) enYakin = d; }
                for (const a of yan(true)) { for (const b of yan(false)) if (Math.hypot(a.x-b.x,a.y-b.y) <= (a.range||0)) { temasta++; break; } }
                const oK = battleArmyObservation(true), oM = battleArmyObservation(false);
                const p = id => { const q = (SIM.ctrlPosture || {})[id]; return q ? (q.role + '/' + q.stance) : null; };
                return { sn: Math.round((SIM.battle && SIM.battle.elapsedSec) || 0), tik: SIM.tick,
                    kirmizi: K, mavi: M, enYakin: Math.round(enYakin), kirmiziMenzilde: temasta,
                    marj: Math.round(oK.effectiveValue - oM.effectiveValue),
                    durus: Object.keys(SIM.ctrlPosture || {}).map(id => id + ':' + p(id)).join(' | '),
                    bitti: phase !== PHASE.BATTLE };
            })()`;
            const kayit = [];
            for (let i = 0; i * IZ_HER <= IZ_SN; i++) {
                const hedefSn = i * IZ_HER;
                // Oyun GERCEK ZAMANDA kosuyor (gameLoop) — belirli saniyeye gelene kadar bekle.
                // Oyun ekran-goruntusu + offscreen pencere yuzunden gercek-zamanin ~0.25 hizinda
                // kosuyor; bekleme tavani buna gore (yoksa mac yarida kesiliyor).
                for (let bek = 0; bek < 700; bek++) {
                    const d = await js(`(() => ({ sn: Math.round((SIM.battle && SIM.battle.elapsedSec) || 0), bitti: phase !== PHASE.BATTLE }))()`);
                    if (!d || d.bitti || d.sn >= hedefSn) break;
                    await sleep(150);
                }
                const o = await js(ozetJS);
                const ad = 'kare-' + String(i).padStart(3, '0') + '-sn' + String(o && o.sn != null ? o.sn : hedefSn).padStart(3, '0');
                await shot(ad);
                kayit.push(Object.assign({ kare: ad }, o));
                console.log('IZLE ' + JSON.stringify(o));
                if (o && o.bitti) break;
            }
            const son = await js(`(() => { const b = SIM.battle || {};
                return { kazanan: b.winnerSide === true ? 'KIRMIZI' : (b.winnerSide === false ? 'MAVI' : 'berabere'), proTaraf: '${PRO_K ? 'KIRMIZI' : 'MAVI'}',
                    sebep: b.outcomeReason, sn: Math.round(b.elapsedSec || 0) }; })()`);
            console.log('IZLE_SONUC ' + JSON.stringify(son));
            try { fsz.writeFileSync(path.join(DIR, 'izle.json'), JSON.stringify({ seed: IZ_SEED, kurulum: kur, sonuc: son, kareler: kayit }, null, 2), 'utf8'); } catch (_) {}
            console.log('IZLE_DIR ' + DIR);
            console.log('IZLE_OK');
            setTimeout(() => app.exit(0), 400);
        });
        return;
    }

    if (process.argv.includes('--ailab')) {
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            const run = (label, cfg) => js(`(() => { try {
                const r = runAIVsAILabDiagnostics(${JSON.stringify(cfg)});
                return { label:'${label}', win:r.winnerColor, why:r.outcomeReason, dur:+r.durationSeconds.toFixed(0),
                    Rsag:r.redSurvivors, Bsag:r.blueSurvivors, Raldi:+(r.redDamageReceived||0).toFixed(0), Baldi:+(r.blueDamageReceived||0).toFixed(0),
                    Rplan:r.redPlan, Rphase:(r.redOperationPhases||[]).join('>'), terrIhlal:(r.terrainViolationIds||[]).length, stuck:(r.navigationStuckUnitIds||[]).length };
            } catch(e){ return {label:'${label}', err:e.message}; } })()`);
            const scen = [
                ['duz-hat: mavi vekil DÜZ saldırır, kırmızı savunur', { playerSurrogateSide: false, scriptedAdvance: true, durationSec: 240 }],
                ['KANAT: mavi vekil KUŞATIR, kırmızı savunur',        { playerSurrogateSide: false, surrogateManeuver: 'flank', durationSec: 240 }],
                ['duz-hat: kırmızı vekil DÜZ saldırır, mavi savunur', { playerSurrogateSide: true, scriptedAdvance: true, durationSec: 240 }],
                ['KANAT: kırmızı vekil KUŞATIR, mavi savunur',        { playerSurrogateSide: true, surrogateManeuver: 'flank', durationSec: 240 }],
            ];
            for (const [label, cfg] of scen) { const r = await run(label, cfg); console.log('AILAB ' + JSON.stringify(r)); await sleep(150); }
            console.log('AILAB_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // GERÇEK-REPRO: `--realrepro <kayit.json>` → kullanıcının kaydının TAM initialState'inden başlar,
    // CANLIYA çevirir (battleControllersDrive) → taze hashParts'lı kayıt üretir → replay edip hangi
    // hash-parçasının (g/b/u/t/s) saptığını gösterir. Kullanıcı-döngüsü GEREKMEZ.
    if (process.argv.includes('--realrepro')) {
        const _rrIdx = process.argv.indexOf('--realrepro');
        let _rrPath = process.argv[_rrIdx + 1];
        if (!_rrPath || _rrPath.startsWith('--')) {
            // path verilmediyse Downloads'taki en son ham kaydı bul
            try {
                const dl = require('path').join(require('os').homedir(), 'Downloads');
                const files = require('fs').readdirSync(dl).filter(f => f.startsWith('pixel-rts-ham-savas-kaydi-') && f.endsWith('.json'))
                    .map(f => ({ f, t: require('fs').statSync(require('path').join(dl, f)).mtimeMs })).sort((a, b) => b.t - a.t);
                if (files.length) _rrPath = require('path').join(dl, files[0].f);
            } catch (e) {}
        }
        let _rrReplay = null;
        try {
            const raw = JSON.parse(require('fs').readFileSync(_rrPath, 'utf8'));
            _rrReplay = raw.replay || raw;   // export {format,...,replay} ya da düz replay
        } catch (e) { console.log('REALREPRO_HATA kayıt okunamadı: ' + (e && e.message) + ' path=' + _rrPath); app.exit(1); return; }
        console.log('REALREPRO_KAYIT ' + _rrPath + ' events=' + (_rrReplay.events || []).length + ' hashes=' + (_rrReplay.hashes || []).length);
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            // 1) Kullanıcının kaydının TAM initialState'ini yükle → sonra CANLI kayıt moduna çevir.
            //    Kontrolörler tick 0'da taze başlar (initialState controller iç-durumu içermez) — kullanıcının
            //    gerçek savaşındaki tick-0 koşuluyla aynı. Böylece controller-order kayıt/replay yolunu üretiriz.
            const setup = await js(`(() => { try {
                const userRec = ${JSON.stringify(_rrReplay)};
                startBattleReplay(userRec);                 // TAM initialState geri yükle (units/seed/rng/terrain)
                // CANLIYA çevir: replay sürücüsünü kapat, kayıt tamponunu temizle, mevcut durumu yeni initial yap
                BATTLE_REPLAY_DRIVER.active = false;
                BATTLE_REPLAY_DRIVER.source = null;
                BATTLE_REPLAY_DRIVER.eventIndex = 0;
                BATTLE_REPLAY_DRIVER.divergence = null;
                BATTLE_REPLAY.events = [];
                BATTLE_REPLAY.hashes = [];
                if (BATTLE_REPLAY.telemetry) { BATTLE_REPLAY.telemetry.samples = []; BATTLE_REPLAY.telemetry.combatEvents = []; BATTLE_REPLAY.telemetry.controllerDecisions = []; }
                BATTLE_REPLAY.playback = false;
                // KRİTİK: kontrolörleri kur (quick-match gibi: red-ai + blue-ally-ai). Canlı sürücü her tick
                // battleControllersSyncOwnership çağırıp controlOwner/controllerId'yi (hash'li) değiştirir;
                // replay'de kontrolör olmadığından sync çalışmaz → sapma hipotezi burada test edilir.
                configureBattleControllers(battleDefaultControllerConfigs({ mode: 'quick' }));
                battleCaptureInitialState();                // taze initial (hashParts'lı örnekler bundan sonra kaydolur)
                phase = PHASE.BATTLE;
                const own = {}; for (const u of SIM.units) if(!u.dead){ const k=(u.controlOwner||'null'); own[k]=(own[k]||0)+1; }
                return { redUnits: SIM.units.filter(u=>u.isRed&&!u.dead).length, blueUnits: SIM.units.filter(u=>!u.isRed&&!u.dead).length, ctrlCount: BATTLE_CONTROLLERS.size, ownerDagilim: own, driverActive: BATTLE_REPLAY_DRIVER.active, tick: SIM.tick };
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,400) }; } })()`);
            console.log('REALREPRO_SETUP ' + JSON.stringify(setup));
            // 2) GERÇEK gameLoop(t) fonksiyonunu elle sentetik timestamp'lerle pompala — rAF hidden pencerede
            //    tetiklenmediği için. Bu, TAM canlı yolu (checkGameOver/updateUI/accumulator/spawnDeathVfx=true/
            //    battleControllersDrive) deterministik koşturur; --liverepro'nun atladığı her şey dahil.
            const pump = await js(`(() => { try {
                window.requestAnimationFrame = () => 0;   // gerçek rAF self-scheduling'i kes → tam kontrol
                lastFrameTime = 0;
                for (let i = 1; i <= 160; i++) { gameLoop(i * 50); if (SIM.battle && SIM.battle.winnerSide !== null) break; }
                return { simTick: SIM.tick, winnerSide: (SIM.battle?SIM.battle.winnerSide:null), hashSayisi: (BATTLE_REPLAY.hashes||[]).length };
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,300) }; } })()`);
            console.log('REALREPRO_PUMP ' + JSON.stringify(pump));
            // 3) kaydı export et + replay et + hash-parça karşılaştır
            const res = await js(`(() => { try {
                const rec = exportBattleReplay();
                const recordedTick = SIM.tick;
                const recHashes = (rec.hashes||[]).map(h=>({tick:h.tick,hash:h.hash}));
                const samples = (rec.telemetry&&rec.telemetry.samples)||[];
                const minimal = { version:rec.version, engineVersion:rec.engineVersion, session:rec.session, initialState:rec.initialState, events:rec.events, hashes:rec.hashes };
                const r = runBattleReplayTicks(minimal);
                const repMap = new Map((r.hashes||[]).map(h=>[h.tick,h.hash]));
                let firstDiv=null; for (const h of recHashes){ if(repMap.has(h.tick) && repMap.get(h.tick)!==h.hash){ firstDiv={tick:h.tick, kayit:h.hash, replay:repMap.get(h.tick)}; break; } }
                let parca=null;
                if (firstDiv){ const smp = samples.find(s=>s.tick===firstDiv.tick); if (smp && smp.hashParts && typeof battleStateHashParts==='function'){ const lp=battleStateHashParts(), pf={}; for(const k of ['g','b','u','t','s']) if(smp.hashParts[k]!==lp[k]) pf[k]={kayit:smp.hashParts[k], replay:lp[k]}; parca=pf; } }
                return { canliTick: recordedTick, hashSayisi: recHashes.length, ctrlOrder:(rec.events||[]).filter(e=>e.type==='controller-order').length, playerMove:(rec.events||[]).filter(e=>e.type==='player-move').length, ilkOrnekHashParts: samples[0]?!!samples[0].hashParts:null, firstDivergence: firstDiv, hashParcaFark: parca };
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,400) }; } })()`);
            console.log('REALREPRO ' + JSON.stringify(res));
            console.log('REALREPRO_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // GRAMER TESTİ: `--grammartest` → orta-savaşta operationGrammarGenerate 16-64 GEÇERLİ aday üretiyor mu,
    // doğrulayıcı geçersizi reddediyor mu (Faz 0/3c operationGrammar.v1 doğrulaması).
    if (process.argv.includes('--grammartest')) {
        createWindow();
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await new Promise(r => setTimeout(r, 1400));
            const res = await js(`(() => { try {
                const pump = n => { for (let i=0;i<n && phase===PHASE.BATTLE;i++){ simulationTime+=BATTLE_TICK_MS; gameTime+=BATTLE_TICK_SEC; stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false); updateSupport(BATTLE_TICK_SEC, simulationTime); } };
                openAIVsAILab({ start:true, show:false, durationSec:240 }); SIM.headless = true;
                pump(400);   // orta-savaş, temaslar oluşsun
                const ctrl = BATTLE_CONTROLLERS.get('battle-red-ai') || [...BATTLE_CONTROLLERS.values()][0];
                const own = ctrl.units();
                const contacts = (ctrl.lastObservation && ctrl.lastObservation.contacts) || [];
                const ctx = opgBuildContext(ctrl.side, own, contacts, ctrl.lastSituation && ctrl.lastSituation.role);
                const cands = operationGrammarGenerate(ctx);
                const allValid = cands.every(c => operationGrammarValidate(c, ctx).valid);
                const byIntent = {}; for (const c of cands) byIntent[c.intent] = (byIntent[c.intent]||0)+1;
                // negatif test: geçersiz aday reddedilmeli
                const bad = operationGrammarValidate({ intent:'FLY', mainSector:999, tempo:'x', pursuitLimit:1, allocation:{main:2,fixing:0,flank:0,reserve:0}, phases:[{name:'NOPE'}] }, ctx);
                return { rol: ctx.role, ownGuc: Math.round(ctx.ownTotal), dusmanGuc: Math.round(ctx.enemyTotal),
                    temasSayisi: contacts.length, enemyCoG: ctx.enemyCoG, zayifDusmanSektor: ctx.weakestEnemySector,
                    adaySayisi: cands.length, aralikta_16_64: cands.length>=16 && cands.length<=64, hepsiGecerli: allValid,
                    intentDagilimi: byIntent, negatifTest_reddedildi: !bad.valid, negatifHataSayisi: bad.errors.length,
                    ornekAday: cands[Math.floor(cands.length/2)] };
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,400) }; } })()`);
            console.log('GRAMMARTEST ' + JSON.stringify(res));
            console.log('GRAMMARTEST_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // FORK TEŞHİSİ: `--forktest` → orta-savaşta durumu yakala; orijinali sürdür (hash A) vs snapshot'tan
    // sürdür (hash B). A≠B ise mevcut snapshot bir FORK için EKSİK (BattleForkState.v1 ne eklemeli?).
    if (process.argv.includes('--forktest')) {
        createWindow();
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await new Promise(r => setTimeout(r, 1400));
            const drvArg = process.argv.includes('--withai') ? 'ai' : 'null';
            const withPro = process.argv.includes('--withpro');   // intel4-pro deltalari (standoff dahil) ACIKKEN fork-esitligi
            const res = await js(`(() => { try {
                const DRV = ${JSON.stringify(drvArg)};
                const pump = (n, useAi) => { const drv = useAi ? battleControllersDrive : null; for (let i=0;i<n && phase===PHASE.BATTLE;i++){ simulationTime+=BATTLE_TICK_MS; gameTime+=BATTLE_TICK_SEC; stepSim(simulationTime, BATTLE_TICK_SEC, drv, false); updateSupport(BATTLE_TICK_SEC, simulationTime); } };
                openAIVsAILab({ start:true, show:false, durationSec:240 }); SIM.headless = true;
                // NOT: bayraklar lab AÇILDIKTAN SONRA kurulur — openAIVsAILab beyin bayraklarini kendi atiyor,
                // once kurulursa eziliyordu (uc kolda da ayni hash cikmasi bunu ele verdi).
                if (${withPro}) { BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true; }
                if (${process.argv.includes('--nostandoff')}) BATTLE_INTEL4PRO_DELTAS.standoff = false;   // izole kontrol kolu
                pump(300, true);                                  // orta-savaşa AI ile ilerle (temas + hedefler)
                const fork = battleForkCapture(); const useAi = DRV==='ai';
                // A) ORİJİNAL devam (BattleForkState.v1 ile fork)
                const hashA=[]; for (let i=0;i<300;i+=20){ pump(20, useAi); hashA.push({tick:SIM.tick, hash:battleStateHash()}); }
                const origU = new Map(SIM.units.filter(u=>!u.dead).map(u=>[u.id,{x:u.x,y:u.y,hp:u.hp,tx:u.targetX,ty:u.targetY,at:(u.attackTarget&&!u.attackTarget.dead)?u.attackTarget.id:0,sup:u.suppression||0}]));
                // B) FORK'tan devam
                battleForkRestore(replayClone(fork));
                const hashB=[]; for (let i=0;i<300;i+=20){ pump(20, useAi); hashB.push({tick:SIM.tick, hash:battleStateHash()}); }
                let firstDiv=null; for (let k=0;k<hashA.length;k++){ if(hashA[k].hash!==hashB[k].hash){ firstDiv={tick:hashA[k].tick, A:hashA[k].hash, B:hashB[k].hash}; break; } }
                const diffs=[]; for (const u of SIM.units){ if(u.dead)continue; const o=origU.get(u.id); if(!o)continue; const d={};
                    if(Math.abs(o.x-u.x)>0.5)d.x=[+o.x.toFixed(1),+u.x.toFixed(1)];
                    if(Math.abs(o.hp-u.hp)>0.5)d.hp=[+o.hp.toFixed(0),+u.hp.toFixed(0)];
                    if(Math.abs((o.tx||0)-(u.targetX||0))>0.5)d.targetX=[+(o.tx||0).toFixed(0),+(u.targetX||0).toFixed(0)];
                    if((o.at||0)!==((u.attackTarget&&!u.attackTarget.dead)?u.attackTarget.id:0))d.attackTarget=[o.at||0,(u.attackTarget&&!u.attackTarget.dead)?u.attackTarget.id:0];
                    if(Object.keys(d).length)diffs.push({id:u.id, ...d}); }
                return { forkTutarli: !firstDiv, ilkSapma: firstDiv, sonuctaSapanBirim: diffs.length, ornekFark: diffs.slice(0,5) };
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,400) }; } })()`);
            console.log('FORKTEST ' + JSON.stringify(res));
            console.log('FORKTEST_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // TARIF CAPRAZ KOSUCUSU: `--recipeab [--tarifler yol] [--seeds a,b] [--sal ad|*] [--sav ad|*]`
    // FAZ 2/3/4'un motoru. Saldiran-tarifi x savunan-tarifi x tohum. IKI TARAF DA ayni beyin (intel4,
    // pro-delta YOK) -> TEK DEGISKEN kompozisyon. Her hucrede kazanc + effectiveValue MARJI raporlanir
    // (marj daha dusuk varyansli; 3 tohumda tek basina kazanc oranina guvenilmez - plan 8.5).
    // Erken pencere (t=120sn) ayrica olculur -> sagkalim yanliligi kalkani (plan 8.4).
    if (process.argv.includes('--recipeab')) {
        const _ai = (bayrak, vars) => { const i = process.argv.indexOf(bayrak); return i >= 0 ? String(process.argv[i + 1]) : vars; };
        const TARIF_YOL = _ai('--tarifler', 'qa-runtime/tarifler.json');
        const AB_SEEDS = _ai('--seeds', '2024,777,909').split(',').map(Number).filter(Boolean);
        const SAL_F = _ai('--sal', '*'), SAV_F = _ai('--sav', '*');
        const AB_OUT = _ai('--out', 'qa-runtime/recipe-ab.json');   // paralel kosucu icin: her surec kendi dosyasina yazar
        const AB_SESSIZ = process.argv.includes('--sessiz');        // paralel modda hucre satirlarini bastirma
        createWindow();
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        const fsx = require('fs');
        win.webContents.on('did-finish-load', async () => {
            await new Promise(r => setTimeout(r, 1400));
            let tarifler;
            try { tarifler = JSON.parse(fsx.readFileSync(TARIF_YOL, 'utf8')); }
            catch (e) { console.log('TARIF_OKUNAMADI ' + TARIF_YOL + ': ' + e.message); app.exit(1); return; }
            const sec = (f) => f === '*' ? tarifler : tarifler.filter(t => f.split(',').indexOf(t.ad) >= 0);
            const SAL = sec(SAL_F), SAV = sec(SAV_F);
            if (!SAL.length || !SAV.length) { console.log('TARIF_SECIMI_BOS'); app.exit(1); return; }
            const TOPLAM = SAL.length * SAV.length * AB_SEEDS.length;
            console.log('CAPRAZ: ' + SAL.length + ' saldiran x ' + SAV.length + ' savunan x ' + AB_SEEDS.length + ' tohum = ' + TOPLAM + ' mac');
            const hucreler = [];
            let n = 0;
            for (const tSal of SAL) {
                for (const tSav of SAV) {
                    const macs = [];
                    for (const seed of AB_SEEDS) {
                        const r = await js('(() => { try {' +
                            'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
                            'BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;' +
                            'BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;' +
                            'if (typeof BATTLE_POSTURE_GATE !== "undefined") BATTLE_POSTURE_GATE = true;' +
                            'if (typeof BATTLE_SECTOR_COMMAND !== "undefined") BATTLE_SECTOR_COMMAND = true;' +
                            (tSal.heuristik ? ('BATTLE_RECIPE_RED = null; if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = ' + (tSal.varied === false ? 'false' : 'true') + ';') : 'BATTLE_RECIPE_RED = ' + JSON.stringify(tSal) + ';') +
                            'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
                            (tSav.heuristik ? ('if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = ' + (tSav.varied === false ? 'false' : 'true') + '; const mv = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:' + (tSav.varied === false ? 'false' : 'true') + ', brainIntel4:true, isAttacker:false, pro:false });') : 'const mv = battleBuildArmyManifest(6500, { maxUnits:48, recipe: ' + JSON.stringify(tSav) + ' });') +
                            'if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;' +
                            'battleDeployManifest(mv, false, { source:"recipeab-sav", ally:true });' +
                            'const salDeger = SIM.units.filter(u => u.isRed).reduce((s,u)=>s+((STATS[u.type]&&STATS[u.type].cost)||0),0);' +
                            'startBattle(); window.requestAnimationFrame = () => 0;' +
                            'const ph = SIM.headless; SIM.headless = true; let st = 0;' +
                            'const sipKab = (isRed) => { let w=0,k=0; for (const u of SIM.units) { if (u.dead||u.isRed!==isRed) continue; const c=(STATS[u.type]&&STATS[u.type].cost)||1; w+=c; if (u._canDigIn) k+=c; } return w?k/w:0; };' +
                            'const kabSal = sipKab(true), kabSav = sipKab(false);' +
                            'let erken = null;' +
                            'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {' +
                            '  st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
                            '  if (typeof updateSupport==="function") updateSupport(BATTLE_TICK_SEC, st);' +
                            '  if (SIM.tick === 2400) { const a=battleArmyObservation(true), d=battleArmyObservation(false); erken = { sal:Math.round(a.effectiveValue), sav:Math.round(d.effectiveValue) }; }' +
                            '} } finally { SIM.headless = ph; }' +
                            'const oS = battleArmyObservation(true), oD = battleArmyObservation(false);' +
                            'const b = SIM.battle || {}; BATTLE_RECIPE_RED = null;' +
                            'return { seed:' + seed + ', kazanan:(b.winnerSide===true?"sal":b.winnerSide===false?"sav":"-"), sebep:b.outcomeReason||null,' +
                            '  marj: Math.round(oS.effectiveValue - oD.effectiveValue), erken, salDeger, savDeger: mv.totalValue,' +
                            '  salSapma: mv.tarifDenetim ? null : null, savSapma: mv.tarifDenetim ? mv.tarifDenetim.maxSapma : null,' +
                            '  siperKab: { sal:+kabSal.toFixed(3), sav:+kabSav.toFixed(3) }, bitisSn: Math.round(SIM.tick*BATTLE_TICK_SEC) };' +
                            '} catch(e){ BATTLE_RECIPE_RED = null; return { err:e.message, stack:(e.stack||"").slice(0,300) }; } })()');
                        n++;
                        if (!r || r.err) { console.log('AB_HATA ' + n + ' ' + (r && r.err)); continue; }
                        macs.push(r);
                    }
                    const gal = macs.filter(m => m.kazanan === 'sal').length;
                    const marjOrt = macs.length ? Math.round(macs.reduce((s, m) => s + m.marj, 0) / macs.length) : 0;
                    const erk = macs.filter(m => m.erken);
                    const erkenOrt = erk.length ? Math.round(erk.reduce((s, m) => s + (m.erken.sal - m.erken.sav), 0) / erk.length) : null;
                    const h = { sal: tSal.ad, sav: tSav.ad, mac: macs.length, salGalibiyet: gal, marj: marjOrt, erkenMarj: erkenOrt,
                        ordu: { sal: macs[0] ? macs[0].salDeger : null, sav: macs[0] ? macs[0].savDeger : null },
                        siperKab: macs[0] ? macs[0].siperKab : null, maclar: macs };
                    hucreler.push(h);
                    if (!AB_SESSIZ) console.log('  [' + n + '/' + TOPLAM + '] SAL ' + h.sal + '  vs  SAV ' + h.sav +
                        '  -> saldiran ' + gal + '/' + macs.length + '  marj ' + (marjOrt >= 0 ? '+' : '') + marjOrt +
                        '  (erken ' + (erkenOrt == null ? '-' : (erkenOrt >= 0 ? '+' : '') + erkenOrt) + ')  ordu ' + h.ordu.sal + '/' + h.ordu.sav + ' TL');
                }
            }
            const pad = (x, n2) => String(x).slice(0, n2).padStart(n2);
            console.log('');
            console.log('=== KAZANC MATRISI (satir=saldiran, hucre="galibiyet | marj") ===');
            const basliklar = SAV.map(t => t.ad);
            console.log('saldiran \\ savunan'.padEnd(26) + basliklar.map(a => pad(a, 20)).join(''));
            for (const tSal of SAL) {
                const satir = basliklar.map(sv => {
                    const h = hucreler.find(x => x.sal === tSal.ad && x.sav === sv);
                    return pad(h ? (h.salGalibiyet + '/' + h.mac + ' | ' + (h.marj >= 0 ? '+' : '') + h.marj) : '-', 20);
                }).join('');
                console.log(String(tSal.ad).slice(0, 25).padEnd(26) + satir);
            }
            console.log('');
            console.log('=== SATIR ORTALAMASI (en iyi SALDIRAN tarifi) ===');
            for (const tSal of SAL) {
                const hs = hucreler.filter(x => x.sal === tSal.ad);
                const g = hs.reduce((s, h) => s + h.salGalibiyet, 0), m = hs.reduce((s, h) => s + h.mac, 0);
                const mj = hs.length ? Math.round(hs.reduce((s, h) => s + h.marj, 0) / hs.length) : 0;
                const enKotu = hs.length ? Math.min.apply(null, hs.map(h => h.marj)) : 0;
                console.log('  ' + String(tSal.ad).padEnd(26) + 'galibiyet ' + g + '/' + m + '   ort.marj ' + (mj >= 0 ? '+' : '') + mj + '   EN KOTU hucre ' + (enKotu >= 0 ? '+' : '') + enKotu);
            }
            console.log('');
            console.log('=== SUTUN ORTALAMASI (en iyi SAVUNAN tarifi) ===');
            for (const sv of basliklar) {
                const hs = hucreler.filter(x => x.sav === sv);
                const g = hs.reduce((s, h) => s + (h.mac - h.salGalibiyet), 0), m = hs.reduce((s, h) => s + h.mac, 0);
                const mj = hs.length ? Math.round(-hs.reduce((s, h) => s + h.marj, 0) / hs.length) : 0;
                const enKotu = hs.length ? Math.min.apply(null, hs.map(h => -h.marj)) : 0;
                console.log('  ' + String(sv).padEnd(26) + 'galibiyet ' + g + '/' + m + '   ort.marj ' + (mj >= 0 ? '+' : '') + mj + '   EN KOTU hucre ' + (enKotu >= 0 ? '+' : '') + enKotu);
            }
            try { fsx.mkdirSync('qa-runtime', { recursive: true }); fsx.writeFileSync(AB_OUT, JSON.stringify(hucreler, null, 1)); } catch (e) {}
            console.log('');
            console.log('RECIPEAB_OK ' + hucreler.length + ' hucre / ' + n + ' mac');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // FAZ 1 TABAN HARITASI: `--recipebase` -> mevcut AI'in FIILI kategori paylarini rol basina cikarir (R0)
    // ve kullanicinin kendi listelerini (qa-runtime/kompozisyonlar.json) ayni birimle olcer (RU).
    // Cikti dogrudan tarif formatinda yazilir -> qa-runtime/tarifler-taban.json (FAZ 2/3 girdisi).
    // Kod degil OLCUM: mevcut sezgisel uretici 6 tohum x 2 rol kosulup TL-agirlikli ortalama alinir.
    if (process.argv.includes('--recipebase')) {
        createWindow();
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        const fsx = require('fs');
        win.webContents.on('did-finish-load', async () => {
            await new Promise(r => setTimeout(r, 1400));
            const SEEDS = [2024, 777, 909, 3141, 2718, 5150];
            const out = await js('(() => { try {' +
                'const KATS = RECIPE_CATEGORIES;' +
                'const paySay = (types) => { const tv = types.reduce((s,t)=>s+STATS[t].cost,0)||1; const o={};' +
                '  for (const k of KATS) { const v = types.reduce((s,t)=>s+(deploymentTypeCategory(t)===k?STATS[t].cost:0),0); if (v>0) o[k]=v/tv; } return o; };' +
                'const tipSay = (types) => { const tv = types.reduce((s,t)=>s+STATS[t].cost,0)||1; const o={};' +
                '  for (const t of types) { const id = STATS[t].id || String(t); o[id] = (o[id]||0) + STATS[t].cost/tv; } return o; };' +
                'const roller = {};' +
                'const seeds = ' + JSON.stringify(SEEDS) + ';' +
                'for (const rol of ["attacker","defender"]) {' +
                '  const toplam = {}, tipToplam = {}, adetToplam = {}; let n = 0, degerToplam = 0;' +
                '  for (const seed of seeds) {' +
                '    SIM_RNG.state = 0x9e3779b9;' +
                '    BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
                '    BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;' +
                '    if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = true;' +
                '    openBattlefieldSession({ mode:"quick", mapId:-2, seed:seed, attackerSide:(rol==="attacker"), durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
                '    if (typeof BATTLE_FORCE_VARIED !== "undefined") BATTLE_FORCE_VARIED = false;' +
                '    const m = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:(rol==="attacker"), pro:false });' +
                '    const pay = paySay(m.types), tp = tipSay(m.types);' +
                '    for (const k in pay) toplam[k] = (toplam[k]||0) + pay[k];' +
                '    for (const k in tp) tipToplam[k] = (tipToplam[k]||0) + tp[k];' +
                '    for (const t of m.types) { const id = STATS[t].id || String(t); adetToplam[id] = (adetToplam[id]||0) + 1; }' +
                '    degerToplam += m.totalValue; n++;' +
                '  }' +
                '  const paylar = {}; for (const k in toplam) paylar[k] = +(toplam[k]/n).toFixed(4);' +
                '  const tipPaylari = {}; for (const k in tipToplam) tipPaylari[k] = +(tipToplam[k]/n).toFixed(4);' +
                '  const adet = {}; for (const k in adetToplam) adet[k] = +(adetToplam[k]/n).toFixed(2);' +
                '  roller[rol] = { paylar, tipPaylari, adet, ortDeger: Math.round(degerToplam/n), n };' +
                '}' +
                'return { roller };' +
                '} catch(e){ return { err:e.message, stack:(e.stack||"").slice(0,400) }; } })()');
            if (!out || out.err) { console.log('BASE_HATA ' + (out && out.err) + ' ' + (out && out.stack)); app.exit(1); return; }
            // kullanici listeleri node tarafindan gonderilir (window.__KOMP yerine dogrudan)
            let komp = [];
            try { komp = JSON.parse(fsx.readFileSync('qa-runtime/kompozisyonlar.json', 'utf8')); } catch (e) {}
            const ru = await js('(() => { try {' +
                'const KATS = RECIPE_CATEGORIES;' +
                'const paySay = (types) => { const tv = types.reduce((s,t)=>s+STATS[t].cost,0)||1; const o={};' +
                '  for (const k of KATS) { const v = types.reduce((s,t)=>s+(deploymentTypeCategory(t)===k?STATS[t].cost:0),0); if (v>0) o[k]=+(v/tv).toFixed(4); } return o; };' +
                'const tipSay = (types) => { const tv = types.reduce((s,t)=>s+STATS[t].cost,0)||1; const o={};' +
                '  for (const t of types) { const id = STATS[t].id || String(t); o[id] = +(((o[id]||0) + STATS[t].cost/tv)).toFixed(4); } return o; };' +
                'const komp = ' + JSON.stringify(komp) + ';' +
                'const res = [];' +
                'for (const K of komp) { if (!K.birimler) continue;' +
                '  const types = []; const eksik = [];' +
                '  for (const id of Object.keys(K.birimler).sort()) { const t = deploymentResolveType(id); if (t == null) { eksik.push(id); continue; }' +
                '    for (let i=0;i<K.birimler[id];i++) types.push(t); }' +
                '  res.push({ ad: K.ad, deger: types.reduce((s,t)=>s+STATS[t].cost,0), birim: types.length, paylar: paySay(types), tipPaylari: tipSay(types), eksik });' +
                '}' +
                'return res;' +
                '} catch(e){ return { err:e.message }; } })()');
            const yaz = (baslik, paylar, ek) => {
                const ks = Object.keys(paylar).sort((a, b) => paylar[b] - paylar[a]);
                console.log(baslik + (ek || ''));
                console.log('     ' + ks.map(k => k + ' %' + (paylar[k] * 100).toFixed(1)).join('  '));
            };
            console.log('=== R0: MEVCUT AI (6 tohum ortalamasi, 6500 TL) ===');
            for (const rol of ['attacker', 'defender']) {
                const r = out.roller[rol];
                yaz('  R0-' + rol, r.paylar, '  (ort. deger ' + r.ortDeger + ' TL)');
                const enCok = Object.keys(r.adet).sort((a, b) => r.adet[b] - r.adet[a]).slice(0, 10);
                console.log('     adet/mac: ' + enCok.map(k => k + ' ' + r.adet[k]).join('  '));
            }
            console.log('');
            console.log('=== RU: KULLANICI LISTELERI ===');
            if (ru && !ru.err) for (const k of ru) {
                yaz('  ' + k.ad, k.paylar, '  (' + k.deger + ' TL, ' + k.birim + ' birim)');
                if (k.eksik.length) console.log('     TANIMSIZ: ' + k.eksik.join(', '));
            } else console.log('  RU_HATA ' + (ru && ru.err));
            // TARIF DOSYASI YAZ
            const tarifler = [];
            for (const rol of ['attacker', 'defender']) {
                const r = out.roller[rol];
                tarifler.push({ ad: 'R0-' + rol, rol, paylar: r.paylar, tipPaylari: r.tipPaylari, zorunlu: {}, tavan: {}, artik: [] });
            }
            if (ru && !ru.err) for (const k of ru) {
                tarifler.push({ ad: 'RU-' + k.ad, rol: null, paylar: k.paylar, tipPaylari: k.tipPaylari, zorunlu: {}, tavan: {}, artik: [] });
            }
            try { fsx.mkdirSync('qa-runtime', { recursive: true }); fsx.writeFileSync('qa-runtime/tarifler-taban.json', JSON.stringify(tarifler, null, 1)); } catch (e) {}
            console.log('');
            console.log('RECIPEBASE_OK -> qa-runtime/tarifler-taban.json (' + tarifler.length + ' tarif)');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // BELLEK TESHISI: `--membreak` -> bir mac kosar ve bellegin NEREDE oldugunu doker.
    // Gerekce: bassiz tek isci ZIRVE 5.8GB olculdu (kullanici makinesi 12 isciyle dondu).
    // V8 yigin siniri (--max-old-space-size=768) hic etkilemedi -> bellek V8 YIGINININ DISINDA.
    // Buyuk supheliler: dunya-cozunurluklu canvas'lar (5100x3450x4B = 70MB/adet) ve typed array'ler.
    // MAC-BASI BELLEK BIRIKIMI: `--memleak [--maclar N] [--render]` -> ayni surecte N mac kosar ve
    // HER MACTAN SONRA surec-basi bellegi doker. Amac: birikim RENDERER'da mi, GPU'da mi, BROWSER'da mi?
    // Olculen sorun: Electron'da her ek mac ~1.4GB birakiyor; ayni kod jsdom'da HIC buyumuyor
    // (12 mac 451MB) -> sizinti JS mantiginda degil. --render ile cizim ACIK kosulur (gercek oyun kosulu).
    if (process.argv.includes('--memleak')) {
        const _mi = process.argv.indexOf('--maclar');
        const MAC_SAYISI = _mi >= 0 ? Math.max(1, Number(process.argv[_mi + 1]) || 3) : 3;
        const RENDER = process.argv.includes('--render');
        createWindow();
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await new Promise(r => setTimeout(r, 1400));
            const dok = async (etiket) => {
                const r = await js('(() => { const m = performance.memory || {};' +
                    'return { yigin: Math.round((m.usedJSHeapSize||0)/1e6),' +
                    '  birim: (typeof SIM !== "undefined" && SIM.units) ? SIM.units.length : -1,' +
                    '  mermi: (typeof SIM !== "undefined" && SIM.projectiles) ? SIM.projectiles.length : -1,' +
                    '  dekal: (typeof SIM !== "undefined" && SIM.decals) ? SIM.decals.length : -1,' +
                    '  parca: (typeof particles !== "undefined" && particles) ? particles.length : -1,' +
                    '  siper: (typeof SIM !== "undefined" && SIM.trenches) ? SIM.trenches.length : -1,' +
                    '  olay: (typeof BATTLE_REPLAY !== "undefined" && BATTLE_REPLAY.events) ? BATTLE_REPLAY.events.length : -1,' +
                    '  ornek: (typeof BATTLE_REPLAY !== "undefined" && BATTLE_REPLAY.telemetry) ? BATTLE_REPLAY.telemetry.samples.length : -1,' +
                    '  canvas: document.querySelectorAll("canvas").length,' +
                    '  canvasMB: Math.round([...document.querySelectorAll("canvas")].reduce((s,c)=>s+c.width*c.height*4,0)/1e6) };' +
                    '})()');
                const met = {};
                for (const m of app.getAppMetrics()) {
                    const t = String(m.type);
                    met[t] = (met[t] || 0) + Math.round((m.memory && m.memory.workingSetSize || 0) / 1024);
                }
                const mu = process.memoryUsage();
                console.log(etiket.padEnd(16) +
                    'JSyigin ' + String(r.yigin).padStart(4) + 'MB | ' +
                    Object.keys(met).sort().map(k => k + ' ' + met[k] + 'MB').join('  ') +
                    ' | anaRSS ' + Math.round(mu.rss / 1e6) + 'MB');
                console.log('                 birim ' + r.birim + ' mermi ' + r.mermi + ' dekal ' + r.dekal +
                    ' parcacik ' + r.parca + ' siper ' + r.siper + ' replayOlay ' + r.olay + ' telemetriOrnek ' + r.ornek +
                    ' | canvas ' + r.canvas + ' adet ~' + r.canvasMB + 'MB');
                return met;
            };
            await dok('0) acilis');
            const TOHUM = [2024, 777, 909, 3141, 2718, 5150, 111, 222, 333, 444, 555, 666];
            for (let i = 0; i < MAC_SAYISI; i++) {
                const seed = TOHUM[i % TOHUM.length];
                const hata = await js('(() => { try {' +
                    'BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
                    'openBattlefieldSession({ mode:"quick", mapId:-2, seed:' + seed + ', attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
                    'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"memleak", ally:true });' +
                    'startBattle();' +
                    (RENDER ? '' : 'window.requestAnimationFrame = () => 0;') +
                    'const ph = SIM.headless; SIM.headless = ' + (RENDER ? 'false' : 'true') + '; let st = 0;' +
                    'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) { st += BATTLE_TICK_MS;' +
                    '  stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, ' + (RENDER ? 'true' : 'false') + ');' +
                    '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st); } } finally { SIM.headless = ph; }' +
                    'return null; } catch(e){ return e.message; } })()');
                if (hata) console.log('  MAC HATASI: ' + hata);
                await dok((i + 1) + ') mac' + (i + 1));
            }
            console.log('MEMLEAK_OK (render=' + RENDER + ')');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }
    if (process.argv.includes('--membreak')) {
        createWindow();
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await new Promise(r => setTimeout(r, 1400));
            const olc = async (etiket) => {
                const r = await js('(() => { const m = performance.memory || {};' +
                    'let cn = 0, cpx = 0, big = [];' +
                    'const say = (c, ad) => { if (!c || !c.width) return; cn++; const px = c.width*c.height; cpx += px;' +
                    '  if (px*4 > 20e6) big.push(ad + " " + c.width + "x" + c.height + " ~" + Math.round(px*4/1e6) + "MB"); };' +
                    'for (const c of document.querySelectorAll("canvas")) say(c, "dom:" + (c.id || "?"));' +
                    'for (const k of Object.keys(window)) { try { const v = window[k];' +
                    '  if (v && v.nodeName === "CANVAS") say(v, "win:" + k);' +
                    '  else if (v && typeof v === "object" && v.canvas && v.canvas.nodeName === "CANVAS") say(v.canvas, "ctx:" + k);' +
                    '  else if (ArrayBuffer.isView(v) && v.byteLength > 20e6) big.push("TA:" + k + " ~" + Math.round(v.byteLength/1e6) + "MB");' +
                    '} catch(e){} }' +
                    'return { yigin: Math.round((m.usedJSHeapSize||0)/1e6), yiginToplam: Math.round((m.totalJSHeapSize||0)/1e6),' +
                    '  yiginSinir: Math.round((m.jsHeapSizeLimit||0)/1e6), canvasSayisi: cn, canvasMB: Math.round(cpx*4/1e6), buyuk: big };' +
                    '})()');
                const rss = process.memoryUsage ? 0 : 0;
                void rss;
                console.log(etiket.padEnd(22) + 'JS yigin ' + String(r.yigin).padStart(5) + 'MB (toplam ' + r.yiginToplam +
                    ', sinir ' + r.yiginSinir + ')   canvas ' + r.canvasSayisi + ' adet ~' + r.canvasMB + 'MB');
                if (r.buyuk && r.buyuk.length) console.log('    BUYUK: ' + r.buyuk.join(' | '));
                return r;
            };
            await olc('1) sayfa yuklendi');
            await js('(() => { BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;' +
                'openBattlefieldSession({ mode:"quick", mapId:-2, seed:2024, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });' +
                'battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false }), false, { source:"mem", ally:true });' +
                'startBattle(); window.requestAnimationFrame = () => 0; return 1; })()');
            await olc('2) mac basladi');
            await js('(() => { const ph = SIM.headless; SIM.headless = true; let st = 0;' +
                'try { while (SIM.tick < 3600 && phase === PHASE.BATTLE) { st += BATTLE_TICK_MS;' +
                '  stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
                '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st); } } finally { SIM.headless = ph; } return SIM.tick; })()');
            await olc('3) 180sn simule');
            const t = await js('(() => { const T = BATTLE_REPLAY.telemetry || {};' +
                'const say = (a) => Array.isArray(a) ? a.length : 0;' +
                'return { ornek: say(T.samples), muharebe: say(T.combatEvents), yasam: say(T.lifeEvents),' +
                '  karar: say(T.controllerDecisions), perf: say(T.performance), olay: say(BATTLE_REPLAY.events),' +
                '  bekleyen: (SIM.pendingHits||[]).length, dekal: (SIM.decals||[]).length, mermi: (SIM.projectiles||[]).length,' +
                '  jsonMB: Math.round(JSON.stringify(T).length/1e6) }; })()');
            console.log('    TELEMETRI: ornek ' + t.ornek + ', muharebe-olay ' + t.muharebe + ', yasam-olay ' + t.yasam +
                ', karar ' + t.karar + ', replay-olay ' + t.olay + ', dekal ' + t.dekal + '  -> JSON ~' + t.jsonMB + 'MB');
            await js('(() => { const ph = SIM.headless; SIM.headless = true; let st = SIM.tick*BATTLE_TICK_MS;' +
                'try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) { st += BATTLE_TICK_MS;' +
                '  stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);' +
                '  if (typeof updateSupport === "function") updateSupport(BATTLE_TICK_SEC, st); } } finally { SIM.headless = ph; } return SIM.tick; })()');
            await olc('4) mac bitti');
            const mu = process.memoryUsage();
            console.log('    ANA SUREC V8: rss ' + Math.round(mu.rss / 1e6) + 'MB, heap ' + Math.round(mu.heapUsed / 1e6) +
                'MB, external ' + Math.round((mu.external || 0) / 1e6) + 'MB, arrayBuffers ' + Math.round((mu.arrayBuffers || 0) / 1e6) + 'MB');
            for (const m of app.getAppMetrics()) {
                const w = m.memory || {};
                console.log('    METRIK ' + String(m.type).padEnd(12) + 'pid ' + String(m.pid).padEnd(8) +
                    'workingSet ' + Math.round((w.workingSetSize || 0) / 1024) + 'MB  zirve ' + Math.round((w.peakWorkingSetSize || 0) / 1024) + 'MB');
            }
            console.log('MEMBREAK_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // TARİF DENETİMİ: `--recipeaudit [--tarifler yol]` → FAZ 0 kabul kapısı.
    // (a) tarif→ordu BYTE-TEKRARLANABİLİR mi (aynı tarif 3 kez = aynı hash)
    // (b) bütçe kaçağı 0 mı (560₺ vakası tekrarlamasın)
    // (c) hedef pay ↔ gerçek pay sapması ne kadar (>%5 RAPORLANIR, gizlenmez)
    if (process.argv.includes('--recipeaudit')) {
        const _ti = process.argv.indexOf('--tarifler');
        const TARIF_YOL = _ti >= 0 ? String(process.argv[_ti + 1]) : 'qa-runtime/tarifler.json';
        createWindow();
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        const fsx = require('fs');
        win.webContents.on('did-finish-load', async () => {
            await new Promise(r => setTimeout(r, 1400));
            let tarifler;
            try { tarifler = JSON.parse(fsx.readFileSync(TARIF_YOL, 'utf8')); }
            catch (e) { console.log('TARIF_OKUNAMADI ' + TARIF_YOL + ': ' + e.message); app.exit(1); return; }
            let hata = 0;
            const rapor = [];
            for (const tarif of tarifler) {
                const r = await js(`(() => { try {
                    const tarif = ${JSON.stringify(tarif)};
                    // BYTE-TEKRARLANABİLİRLİK: aynı tarif 3 kez kurulur, hash'ler eşit olmalı (RNG sızıntısı yakalanır)
                    const hashler = [], denetimler = [];
                    for (let i = 0; i < 3; i++) {
                        SIM_RNG.state = (12345 + i * 977) | 0;   // KASITLI FARKLI TOHUM: tarif modu tohumdan BAĞIMSIZ olmalı
                        const m = battleBuildArmyManifest(6500, { maxUnits:48, recipe: tarif });
                        hashler.push(m.hash); denetimler.push(m.tarifDenetim);
                    }
                    const d = denetimler[0];
                    const tekrarlanabilir = hashler[0] === hashler[1] && hashler[1] === hashler[2];
                    // birim dökümü (insan-okunur)
                    SIM_RNG.state = 999;
                    const m0 = battleBuildArmyManifest(6500, { maxUnits:48, recipe: tarif });
                    const dokum = Object.keys(m0.counts).map(Number).sort((a,b)=>a-b)
                        .map(t => m0.counts[t] + '× ' + (STATS[t].name || t)).join(', ');
                    return { ad: d.tarif, tekrarlanabilir, hash: hashler[0], denetim: d, dokum, birim: m0.totalUnits };
                } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,300) }; } })()`);
                if (!r || r.err) { console.log('TARIF_HATA ' + (r && r.err)); hata++; continue; }
                const d = r.denetim;
                const sapmaStr = Object.keys(d.sapma).sort().map(k => k + ' ' + (d.sapma[k] >= 0 ? '+' : '') + (d.sapma[k] * 100).toFixed(1) + '%').join('  ');
                console.log('── TARİF ' + r.ad + ' ── birim ' + r.birim + ' · harcanan ' + d.harcanan + '₺ / ' + d.butce + '₺' +
                    ' · harcanmayan ' + d.harcanmayan + '₺ · KAÇAK ' + d.kacak + '₺' +
                    ' · tekrarlanabilir ' + (r.tekrarlanabilir ? 'EVET' : 'HAYIR') + ' · maxSapma ' + (d.maxSapma * 100).toFixed(1) + '%');
                console.log('     pay sapması: ' + sapmaStr);
                console.log('     kadro: ' + r.dokum);
                if (d.uyarilar.length) console.log('     UYARI: ' + d.uyarilar.join(' | '));
                if (!r.tekrarlanabilir) { console.log('     ✗ TEKRARLANABİLİRLİK KIRIK'); hata++; }
                if (d.kacak !== 0) { console.log('     ✗ BÜTÇE KAÇAĞI ' + d.kacak + '₺'); hata++; }
                if (Math.abs(d.maxSapma) > 0.05) console.log('     ! pay sapması %5 üstü (rapor edildi, hata sayılmaz)');
                const ikiz = rapor.find(x => x.hash === r.hash);
                if (ikiz) console.log('     ! KOR EKSEN: kadro ' + ikiz.ad + ' ile BIREBIR AYNI -> bu eksen olculmemis sayilir');
                rapor.push(r);
            }
            try { fsx.mkdirSync('qa-runtime', { recursive:true }); fsx.writeFileSync('qa-runtime/recipe-audit.json', JSON.stringify(rapor, null, 1)); } catch(e) {}
            console.log(hata === 0 ? 'RECIPEAUDIT_OK (' + rapor.length + ' tarif)' : 'RECIPEAUDIT_KIRMIZI (' + hata + ' hata)');
            setTimeout(() => app.exit(hata === 0 ? 0 : 1), 300);
        });
        return;
    }

    // BÖLGE-KAYMASI: `--zonedrift [--seeds a,b]` → KULLANICI İDDİASI'nın ölçümü: "AI her iki rolde de
    // BENİM hattıma yaklaşıyor; savunma rolünde kendi bölgesinde konuşlanıp zamana oynamalı".
    // Taraflar Y'de ayrık (kırmızı üst y-küçük, mavi alt y-büyük), orta hat WORLD_H/2.
    // derinlik = birimin KENDİ arka kenarından orta hatta olan yolun kaçta kaçında (0=kendi dip, 1=orta hat, >1=düşman yarısı).
    // Ağırlık ₺ ile alınır (bir piyade ile bir MBT aynı ağırlıkta sayılmasın).
    if (process.argv.includes('--zonedrift')) {
        const _zi = process.argv.indexOf('--seeds');
        const ZSEEDS = _zi >= 0 ? String(process.argv[_zi + 1] || '').split(',').map(Number).filter(Boolean) : [2024, 777, 909, 3141, 2718, 5150];
        // --pro <delta> → SAVUNAN tarafta (mavi) yalnız o pro-deltası açık; ordu dizilimi yine pro-suz (tek değişken).
        const _zp = process.argv.indexOf('--pro');
        const ZONLY = _zp >= 0 ? String(process.argv[_zp + 1] || '') : null;
        // --hold hat,derin,tavan,ihtiyatDerin  → PRO_HOLD_* süpürmesi (ör: --hold 0.85,0.60,1.0,0)
        const _zh = process.argv.indexOf('--hold');
        const ZHOLD = _zh >= 0 ? String(process.argv[_zh + 1] || '').split(',') : null;
        createWindow();
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        const fsx = require('fs');
        win.webContents.on('did-finish-load', async () => {
            await new Promise(r => setTimeout(r, 1400));
            const hepsi = [];
            for (const seed of ZSEEDS) {
                const r = await js(`(() => { try {
                    BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
                    BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;
                    const _zonly = ${ZONLY ? "'" + ZONLY + "'" : 'null'};
                    if (_zonly) { for (const k of Object.keys(BATTLE_INTEL4PRO_DELTAS)) BATTLE_INTEL4PRO_DELTAS[k] = (k === _zonly); }
                    const _zh2 = ${ZHOLD ? JSON.stringify(ZHOLD) : 'null'};
                    if (_zh2) { PRO_HOLD_LINE_DEPTH = +_zh2[0]; PRO_HOLD_DEEP_DEPTH = +_zh2[1]; PRO_HOLD_MAX_DEPTH = +_zh2[2]; PRO_HOLD_RESERVE_DEEP = _zh2[3] === '1'; if (_zh2[4] != null) PRO_HOLD_COVER_R = +_zh2[4]; if (_zh2[5] != null) PRO_HOLD_TRENCH_GAP = +_zh2[5]; if (_zh2[6] != null) { PRO_HOLD_ENGINEER_LINE = _zh2[6] !== '0'; PRO_HOLD_TRENCH_DEPTH = Math.abs(+_zh2[6]) || PRO_HOLD_TRENCH_DEPTH; } }
                    BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = !!_zonly;   // savunan = mavi
                    if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
                    if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = true;
                    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;
                    openBattlefieldSession({ mode:'quick', mapId:-2, seed:${seed}, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
                    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
                    battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false, pro:false }), false, { source:'zone-blue', ally:true });
                    startBattle(); window.requestAnimationFrame = () => 0;
                    const mid = WORLD_H / 2;
                    // attackerSide:true => KIRMIZI saldıran, MAVİ savunan
                    const derinlik = (u) => u.isRed ? (u.y / mid) : ((WORLD_H - u.y) / mid);
                    const olc = (isRed) => {
                        let w = 0, sd = 0, gecen = 0, gecenW = 0, enIleri = 0;
                        for (const u of SIM.units) {
                            if (u.dead || u.isRed !== isRed) continue;
                            const c = (STATS[u.type] && STATS[u.type].cost) || 1;
                            const d = derinlik(u);
                            w += c; sd += c * d;
                            if (d > 1) { gecen++; gecenW += c; }
                            if (d > enIleri) enIleri = d;
                        }
                        return { w, d: w ? sd / w : null, gecen, gecenW, enIleri };
                    };
                    // SİPERLENME: ₺-ağırlıklı ortalama entrench (0..1). Yalnız dig_in/garrison'lu birimler >0 olabilir.
                    const sip = (isRed) => { let w=0,t=0; for (const u of SIM.units) { if (u.dead||u.isRed!==isRed) continue; const c=(STATS[u.type]&&STATS[u.type].cost)||1; w+=c; t+=c*(u.entrench||0); } return w?t/w:0; };
                    // SİPER-KABİLİYETİ: ordunun ne kadarlık ₺'si hiç siperlenebiliyor?
                    const sipKab = (isRed) => { let w=0,k=0; for (const u of SIM.units) { if (u.dead||u.isRed!==isRed) continue; const c=(STATS[u.type]&&STATS[u.type].cost)||1; w+=c; if (u._canDigIn) k+=c; } return w?k/w:0; };
                    // ÖRTÜ: ₺-ağırlıklı, orman/siper içindeki birim payı (hazırlanmış-mevzi doktrininin doğrudan ölçüsü)
                    const ortu = (isRed) => { let w=0,t=0; for (const u of SIM.units) { if (u.dead||u.isRed!==isRed) continue; const c=(STATS[u.type]&&STATS[u.type].cost)||1; w+=c; if (u.inForest||u.inTrench) t+=c; } return w?t/w:0; };
                    const amo = (isRed) => { let n=0,t=0; for (const u of SIM.units) { if (u.dead||u.isRed!==isRed||!(u.maxAmmo>0)) continue; n++; t+=(u.ammo||0)/u.maxAmmo; } return n?t/n:1; };
                    const ph = SIM.headless; SIM.headless = true; let st = 0;
                    const kova = [];
                    let baslangic = null;
                    try {
                        while (SIM.tick < 7300 && phase === PHASE.BATTLE) {
                            st += BATTLE_TICK_MS;
                            stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
                            if (typeof updateSupport === 'function') updateSupport(BATTLE_TICK_SEC, st);
                            if (SIM.tick === 1) baslangic = { sal: olc(true), sav: olc(false) };
                            if (SIM.tick % 400 === 0) {   // her 20sn
                                const sal = olc(true), sav = olc(false);
                                const oSal = battleArmyObservation(true), oSav = battleArmyObservation(false);
                                kova.push({ sn: Math.round(SIM.tick * BATTLE_TICK_SEC),
                                    salD: sal.d != null ? +sal.d.toFixed(3) : null, savD: sav.d != null ? +sav.d.toFixed(3) : null,
                                    savGecenW: sav.gecenW, salGecenW: sal.gecenW,
                                    savIleri: +sav.enIleri.toFixed(2), salKalan: sal.w, savKalan: sav.w,
                                    salEff: Math.round(oSal.effectiveValue), savEff: Math.round(oSav.effectiveValue),
                                    salAmo: +amo(true).toFixed(2), savAmo: +amo(false).toFixed(2),
                                    savSiper: +sip(false).toFixed(3), salSiper: +sip(true).toFixed(3),
                                    savOrtu: +ortu(false).toFixed(3), savSiperYapi: SIM.trenches.filter(t => !t.isRed).length });
                            }
                        }
                    } finally { SIM.headless = ph; }
                    const b = SIM.battle || {};
                    return { seed:${seed}, baslangic:{ sal:+baslangic.sal.d.toFixed(3), sav:+baslangic.sav.d.toFixed(3) }, kova,
                        siperKabiliyet:{ sav:+sipKab(false).toFixed(3), sal:+sipKab(true).toFixed(3) },
                        kazanan:(b.winnerSide===true?'saldiran(red)':b.winnerSide===false?'savunan(blue)':'-'), sebep:b.outcomeReason||null };
                } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,300) }; } })()`);
                if (!r || r.err) { console.log('ZONE_ERR seed=' + seed + ' ' + (r && r.err)); continue; }
                hepsi.push(r);
                const zirve = r.kova.reduce((a, k) => (k.savD || 0) > (a.savD || 0) ? k : a, r.kova[0] || { savD: 0 });
                const gecTik = r.kova.find(k => k.savD > 1);
                const gecW = r.kova.reduce((m, k) => Math.max(m, k.savGecenW), 0);
                console.log('ZONE seed=' + r.seed + ' | savunan derinlik t0=' + r.baslangic.sav + ' -> ZİRVE ' + (zirve.savD) + ' (t=' + zirve.sn + 'sn)' +
                    ' | orta hattı GEÇTİ: ' + (gecTik ? 'EVET t=' + gecTik.sn + 'sn' : 'hayır') +
                    ' | düşman yarısındaki max ₺: ' + gecW + ' | kazanan ' + r.kazanan + ' (' + r.sebep + ')');
                console.log('     ÖRTÜ: savunan ₺-payı orman/siperde ' + r.kova.filter((_, i) => i % 3 === 0).map(k => k.sn + ':' + k.savOrtu).join(' ') + ' | kurulu siper ' + (r.kova[r.kova.length-1] || {}).savSiperYapi);
                console.log('     seyir(sn:savD/salD): ' + r.kova.filter((_, i) => i % 2 === 0).map(k => k.sn + ':' + k.savD + '/' + k.salD).join('  '));
            }
            try { fsx.mkdirSync('qa-runtime', { recursive:true }); fsx.writeFileSync('qa-runtime/zonedrift.json', JSON.stringify(hepsi, null, 1)); } catch(e) {}
            const kaz = hepsi.filter(r => r.kazanan.indexOf('savunan') === 0).length;
            console.log('ZONEDRIFT_OK  savunan ' + kaz + '/' + hepsi.length + (ZHOLD ? '  hold=' + ZHOLD.join(',') : '') + (ZONLY ? '  delta=' + ZONLY : '  TABAN'));
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // KUVVET-ORANI KAPISI: `--ratiotest [--pro]` → SAVUNANIN kuvvet-oranı gerçeği yansıtıyor mu ve
    // STRIKE kapısı açılabiliyor mu? Handikap kurulumu (savunan ZENGİN, saldıran fakir) ile sınar:
    // eski hatada savunan +%46 üstünlükle bile kendini 1.00 sanıyor ve hiç taarruz etmiyordu.
    if (process.argv.includes('--ratiotest')) {
        const _pi = process.argv.indexOf('--pro');
        const PROARG = _pi >= 0 ? (process.argv[_pi + 1] || 'both') : 'none';
        const PRO_RED = PROARG === 'red' || PROARG === 'both';
        const PRO_BLUE = PROARG === 'blue' || PROARG === 'both';
        const PRO = PRO_RED;
        createWindow();
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await new Promise(r => setTimeout(r, 1400));
            for (const seed of [2024, 777, 909]) {
                const out = await js(`(() => { try {
                    BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
                    BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;
                    BATTLE_INTEL4PRO_RED = ${PRO_RED}; BATTLE_INTEL4PRO_BLUE = ${PRO_BLUE};
                    if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
                    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;
                    // HANDİKAP: mavi saldıran 4410₺ (fakir), kırmızı savunan 6460₺ (zengin) — kullanıcının maçıyla aynı oran
                    openBattlefieldSession({ mode:'quick', mapId:-2, seed:${seed}, attackerSide:false, durationSec:360, playerMoney:4410, enemyMoney:6460, show:false });
                    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
                    battleDeployManifest(battleBuildArmyManifest(4410, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:true, pro:${PRO_BLUE} }), false, { source:'ratiotest-blue', ally:true });
                    startBattle(); window.requestAnimationFrame = () => 0;
                    const ph = SIM.headless; SIM.headless = true; let st = 0;
                    let ilkOran = null, maxOran = -1, strikeVar = false, ilkStrike = null;
                    const gercek = () => { let b=0,r2=0; for (const u of SIM.units){ if(u.dead)continue; const c=(STATS[u.type]&&STATS[u.type].cost)||0; if(u.isRed)r2+=c; else b+=c;} return r2/(b||1); };
                    let ilkGercek = null;
                    try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) {
                        st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
                        if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, st);
                        const c = BATTLE_CONTROLLERS.get('battle-red-ai');
                        const fr = c && c.lastSituation ? c.lastSituation.forceRatio : null;
                        if (fr != null) { if (ilkOran == null) { ilkOran = fr; ilkGercek = gercek(); } if (fr > maxOran) maxOran = fr; }
                        const p = SIM.ctrlPosture ? SIM.ctrlPosture['battle-red-ai'] : null;
                        if (p && p.stance === 'STRIKE') { if (!strikeVar) ilkStrike = SIM.tick; strikeVar = true; }
                    } } finally { SIM.headless = ph; }
                    const b2 = SIM.battle || {};
                    return { seed:${seed}, ilkOran, ilkGercek: +ilkGercek.toFixed(2), maxOran: +maxOran.toFixed(2),
                        savunanSTRIKE: strikeVar, ilkStrikeSn: ilkStrike!=null?Math.round(ilkStrike*BATTLE_TICK_SEC):null,
                        kazanan:(b2.winnerSide===true?'red(savunan)':b2.winnerSide===false?'blue(saldiran)':'-'), sebep:b2.outcomeReason||null };
                } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,300) }; } })()`);
                if (!out || out.err) { console.log('RATIO_ERR ' + (out && out.err)); continue; }
                console.log('RATIO seed' + out.seed + ' | savunanın t0 oranı ' + out.ilkOran + ' (GERÇEK ' + out.ilkGercek + ')' +
                    ' | max ' + out.maxOran + ' | STRIKE ' + (out.savunanSTRIKE ? 'VAR t=' + out.ilkStrikeSn + 'sn' : 'YOK') +
                    ' | kazanan ' + out.kazanan + ' (' + out.sebep + ')');
            }
            console.log('RATIOTEST_OK (pro=' + PROARG + ')');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // KOMPOZİSYON TEST ALANI: `--comptest [--list dosya.json] [--seeds 2024,777]`
    // Kullanıcının verdiği ordu listelerini SABİT DÜŞMANA karşı koşar. KONTROL: düşman (kırmızı) her koşuda
    // AYNI tohumla otomatik dizilir ve bizim listemizden ETKİLENMEZ (kırmızı önce dizilir). Ayrıca savaş
    // başlamadan SIM_RNG sabit bir değere kilitlenir → farklı birim sayıları RNG akışını kaydırmasın.
    // Böylece TEK DEĞİŞKEN bizim kompozisyonumuz olur.
    // NOT: iki tarafı da AI komuta eder (insan mikrosu yok) → ölçülen şey KOMPOZİSYON, komuta değil.
    if (process.argv.includes('--comptest')) {
        const _li = process.argv.indexOf('--list');
        const listPath = (_li >= 0 && process.argv[_li + 1] && !process.argv[_li + 1].startsWith('--')) ? process.argv[_li + 1] : 'qa-runtime/kompozisyonlar.json';
        const _si = process.argv.indexOf('--seeds');
        const SEEDS = (_si >= 0 && process.argv[_si + 1] && !process.argv[_si + 1].startsWith('--'))
            ? process.argv[_si + 1].split(',').map(Number).filter(Number.isFinite) : [2024, 777];
        let LISTE;
        try { LISTE = JSON.parse(require('fs').readFileSync(listPath, 'utf8')); }
        catch (e) { console.log('COMPTEST_HATA liste okunamadı: ' + listPath + ' — ' + e.message); app.exit(1); return; }
        createWindow();
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await new Promise(r => setTimeout(r, 1400));
            const sonuc = [];
            for (const seed of SEEDS) {
                for (const komp of LISTE) {
                    if (komp.seed != null && komp.seed !== seed) continue;   // tohum-basi liste destegi
                    const r = await js(`(() => { try {
                        const KOMP = ${JSON.stringify(komp)};
                        BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
                        BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;
                        BATTLE_INTEL4PRO_RED = false; BATTLE_INTEL4PRO_BLUE = false;   // saf karşılaştırma: pro katmanı KAPALI
                        if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
                        if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = true;
                        // attackerSide:false → MAVİ saldıran (kullanıcının oynadığı kurulumla aynı), kırmızı savunan AI
                        openBattlefieldSession({ mode:'quick', mapId:-2, seed:${seed}, attackerSide:false, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
                        // KIRMIZI KONTROL PARMAK-İZİ (bizim listemizden bağımsız olmalı)
                        const kirmizi = {}; let kTut = 0;
                        for (const u of SIM.units) { if (u.dead || !u.isRed) continue; const s = STATS[u.type] || {};
                            kirmizi[s.id || u.type] = (kirmizi[s.id || u.type] || 0) + 1; kTut += (s.cost || 0); }
                        const kIz = Object.keys(kirmizi).sort().map(k => k + ':' + kirmizi[k]).join(',');
                        // MAVİ = kullanıcının listesi (ya da taban:true ise AI'ın kendi manifesti = KONTROL)
                        if (KOMP.taban === true) {
                            const _mf = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:true });
                            battleDeployManifest(_mf, false, { source:'comptest-taban', ally:true });
                            SIM_RNG.state = 123456789;
                            startBattle(); window.requestAnimationFrame = () => 0; battleBalanceReset(true);
                            const ph0 = SIM.headless; SIM.headless = true; let st0 = 0;
                            try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) { st0 += BATTLE_TICK_MS; stepSim(st0, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, st0); } } finally { SIM.headless = ph0; }
                            const rep0 = battleBalanceReport(); battleBalanceReset(false);
                            const b0 = SIM.battle || {};
                            let rv0=0, bv0=0; for (const u of SIM.units) { if (u.dead) continue; const c=(STATS[u.type]&&STATS[u.type].cost)||0; if (u.isRed) rv0+=c; else bv0+=c; }
                            const kat0 = {}; for (const ti of _mf.types) { const s = STATS[ti]; kat0[s.category] = (kat0[s.category]||0) + s.cost; }
                            return { ad: KOMP.ad, seed:${seed}, maliyet: _mf.totalValue, birim: _mf.totalUnits,
                                kategori: Object.fromEntries(Object.entries(kat0).map(([k,v]) => [k, +(v/_mf.totalValue*100).toFixed(1)])),
                                kirmiziIz: kIz, kirmiziTut: kTut,
                                kazanan: (b0.winnerSide===true?'red':b0.winnerSide===false?'blue':'-'), sebep: b0.outcomeReason||null,
                                bizKazandik: b0.winnerSide === false, kalanBiz: bv0, kalanDusman: rv0, takas: rep0.tradeRatio || null };
                        }
                        const types = []; let bTut = 0; const eksik = [];
                        for (const [uid, adet] of Object.entries(KOMP.birimler || {})) {
                            const ti = (typeof UNIT_ID_BY_INDEX !== 'undefined') ? UNIT_ID_BY_INDEX.indexOf(uid) : -1;
                            if (ti < 0 || !STATS[ti]) { eksik.push(uid); continue; }
                            for (let i = 0; i < adet; i++) { types.push(ti); bTut += STATS[ti].cost; }
                        }
                        if (eksik.length) return { err: 'bilinmeyen birim: ' + eksik.join(',') };
                        battleDeployManifest({ types, counts:{}, totalUnits: types.length, totalValue: bTut }, false, { source:'comptest', ally:true });
                        // RNG KİLİDİ: birim sayısı farklı olsa da savaş aynı akışla koşsun (tek değişken = kompozisyon)
                        SIM_RNG.state = 123456789;
                        startBattle(); window.requestAnimationFrame = () => 0; battleBalanceReset(true);
                        const ph = SIM.headless; SIM.headless = true; let st = 0;
                        try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) { st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, st); } } finally { SIM.headless = ph; }
                        const rep = battleBalanceReport(); battleBalanceReset(false);
                        const b = SIM.battle || {};
                        let rv=0, bv=0; for (const u of SIM.units) { if (u.dead) continue; const c=(STATS[u.type]&&STATS[u.type].cost)||0; if (u.isRed) rv+=c; else bv+=c; }
                        // kategori payları
                        const kat = {}; for (const ti of types) { const s = STATS[ti]; kat[s.category] = (kat[s.category]||0) + s.cost; }
                        return { ad: KOMP.ad, seed:${seed}, maliyet: bTut, birim: types.length,
                            kategori: Object.fromEntries(Object.entries(kat).map(([k,v]) => [k, +(v/bTut*100).toFixed(1)])),
                            kirmiziIz: kIz, kirmiziTut: kTut,
                            kazanan: (b.winnerSide===true?'red':b.winnerSide===false?'blue':'-'), sebep: b.outcomeReason||null,
                            bizKazandik: b.winnerSide === false, kalanBiz: bv, kalanDusman: rv,
                            takas: rep.tradeRatio || null };
                    } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,300) }; } })()`);
                    if (!r || r.err) { console.log('COMPTEST_ERR ' + komp.ad + ' seed' + seed + ': ' + (r && r.err)); continue; }
                    sonuc.push(r);
                    console.log('COMP seed' + seed + ' | ' + String(r.ad).padEnd(18) + ' | ' + String(r.maliyet).padStart(4) + '₺/' + String(r.birim).padStart(2) + 'birim | ' +
                        (r.bizKazandik ? 'KAZANDIK' : 'kaybettik') + ' (' + r.sebep + ') | kalan biz ' + r.kalanBiz + ' düşman ' + r.kalanDusman);
                }
            }
            // KONTROL DOĞRULAMASI: aynı tohumda kırmızı her koşuda AYNI mı?
            const izler = {};
            for (const s of sonuc) { (izler[s.seed] = izler[s.seed] || new Set()).add(s.kirmiziIz); }
            for (const sd in izler) console.log('KONTROL seed' + sd + ': düşman ordusu ' + (izler[sd].size === 1 ? 'SABİT ✓' : '⚠️ DEĞİŞMİŞ (' + izler[sd].size + ' farklı)'));
            console.log('COMPTEST ' + JSON.stringify(sonuc.map(s => ({ ad: s.ad, seed: s.seed, kaz: s.bizKazandik, kat: s.kategori, maliyet: s.maliyet }))));
            try { require('fs').writeFileSync('qa-runtime/comptest-sonuc.json', JSON.stringify(sonuc, null, 1)); } catch(e) {}
            console.log('COMPTEST_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // ORDU DÖKÜMÜ: `--armydump [--seeds a,b]` → maçın kurulumunu yapıp İKİ TARAFIN ordusunu birim-birim döker
    // (adet, birim maliyeti, toplam ₺, bütçe payı). Amaç: insanın aynı orduyla oynayıp "neden kaybediyor"u görmesi.
    if (process.argv.includes('--armydump')) {
        const _si = process.argv.indexOf('--seeds');
        const SEEDS = (_si >= 0 && process.argv[_si + 1] && !process.argv[_si + 1].startsWith('--'))
            ? process.argv[_si + 1].split(',').map(Number).filter(Number.isFinite) : [3141, 909];
        createWindow();
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await new Promise(r => setTimeout(r, 1400));
            for (const seed of SEEDS) {
                const out = await js(`(() => { try {
                    BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
                    BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;
                    BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;
                    if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
                    if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = true;
                    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;
                    openBattlefieldSession({ mode:'quick', mapId:-2, seed:${seed}, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
                    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
                    // MANIFEST MUHASEBESI: builder kendi defterine gore ne harcadi, gercek deger ne?
                    const _mf = battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false, pro: BATTLE_INTEL4PRO_BLUE });
                    const _mfDenetim = { baslangic: _mf.initialBudget && _mf.initialBudget.money,
                        kalan: _mf.remaining && _mf.remaining.money,
                        defterHarcama: (_mf.initialBudget && _mf.initialBudget.money) - (_mf.remaining && _mf.remaining.money),
                        gercekDeger: _mf.totalValue, birim: _mf.totalUnits,
                        defterToplam: Object.values(_mf.spent||{}).reduce((s,v)=>s+v,0),
                        spentVar: !!_mf.spent };
                    battleDeployManifest(_mf, false, { source:'dump-blue', ally:true });
                    startBattle();
                    const dok = (isRed) => { const m = {};
                        for (const u of SIM.units) { if (u.dead || u.isRed !== isRed) continue;
                            const s = STATS[u.type] || {}; const key = s.name || s.id || ('t'+u.type);
                            const a = m[key] || (m[key] = { adet:0, birim: s.cost||0, kategori: s.category, menzil: s.range, id: s.id });
                            a.adet++; }
                        const rows = Object.entries(m).map(([ad,v]) => ({ ad, ...v, toplam: v.adet*v.birim }))
                            .sort((a,b) => b.toplam - a.toplam);
                        const tut = rows.reduce((s,r)=>s+r.toplam,0);
                        return { rows, tut, birimSayisi: rows.reduce((s,r)=>s+r.adet,0) }; };
                    // MOTORUN KENDI MUHASEBESI: dagitimdan sonra kalan para. Eger 0/negatif degilse motor
                    // "6500 harcadim" saniyor ama konuslanan deger daha yuksek demektir (muhasebe kacagi).
                    return { kirmizi: dok(true), mavi: dok(false), butce: 6500, mfDenetim: _mfDenetim,
                        kalanPara: { kirmizi: Math.round(enemy.money), mavi: Math.round(player.money) },
                        asim: { kirmizi: dok(true).tut - 6500, mavi: dok(false).tut - 6500 } };
                } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,300) }; } })()`);
                if (!out || out.err) { console.log('ARMYDUMP_ERR ' + (out && out.err)); continue; }
                console.log('\n### seed ' + seed + ' BÜTÇE DENETİMİ (tavan 6500₺): kırmızı ' + out.kirmizi.tut +
                    '₺ (' + (out.asim.kirmizi >= 0 ? '+' : '') + out.asim.kirmizi + ') · mavi ' + out.mavi.tut +
                    '₺ (' + (out.asim.mavi >= 0 ? '+' : '') + out.asim.mavi + ')' +
                    (out.asim.kirmizi > 0 || out.asim.mavi > 0 ? '   ⚠️ AŞIM VAR' : '') +
                    '  | motorun kalan parası: kırmızı ' + out.kalanPara.kirmizi + '₺, mavi ' + out.kalanPara.mavi + '₺');
                console.log('    MANIFEST DENETİMİ (mavi): başlangıç ' + out.mfDenetim.baslangic + '₺, kalan ' +
                    out.mfDenetim.kalan + '₺ → defter-harcama ' + out.mfDenetim.defterHarcama +
                    '₺  ama GERÇEK DEĞER ' + out.mfDenetim.gercekDeger + '₺  | spent-defteri toplam ' + out.mfDenetim.defterToplam + '₺ (var mı: ' + out.mfDenetim.spentVar + ')  (KAÇAK ' +
                    (out.mfDenetim.gercekDeger - out.mfDenetim.defterHarcama) + '₺)');
                for (const [taraf, etiket] of [['kirmizi', 'KIRMIZI = SALDIRAN'], ['mavi', 'MAVI = SAVUNAN']]) {
                    const d = out[taraf];
                    console.log('\n=== seed ' + seed + ' · ' + etiket + ' · ' + d.birimSayisi + ' birim · ' + d.tut + '₺ ===');
                    console.log('  adet  birim                         kategori     menzil  birim₺   toplam₺   pay');
                    for (const r of d.rows) {
                        console.log('  ' + String(r.adet).padStart(3) + '   ' + String(r.ad).padEnd(28) +
                            String(r.kategori || '-').padEnd(12) + String(r.menzil || 0).padStart(6) +
                            String(r.birim).padStart(8) + String(r.toplam).padStart(10) +
                            '   %' + (r.toplam / d.tut * 100).toFixed(1));
                    }
                }
            }
            console.log('\nARMYDUMP_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // BÜTÇE SONDAJI: `--budgetprobe [--mults 1,1.25,1.5]` → AYNA maçta saldırana kademeli bütçe üstünlüğü verip
    // DENGE NOKTASINI bulur. Amaç TEŞHİS: saldıranın %30'luk kazanma oranı bir AI kusuru mu yoksa senaryo/kural
    // yapısı mı? (Tarihsel 3:1 kuralı gerçekçi olabilir.) Denge 1.0'a yakınsa doktrin, uzaksa yapısal.
    // NOT: MEZUNİYET her zaman EŞİT bütçeyle koşulur (kullanıcı kuralı) — bu yalnız teşhis aracıdır.
    if (process.argv.includes('--budgetprobe')) {
        const _mi = process.argv.indexOf('--mults');
        const MULTS = (_mi >= 0 && process.argv[_mi + 1] && !process.argv[_mi + 1].startsWith('--'))
            ? process.argv[_mi + 1].split(',').map(Number).filter(n => n > 0) : [1.0, 1.25, 1.5];
        const SEEDS = [2024, 777, 909, 3141];
        createWindow();
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await new Promise(r => setTimeout(r, 1400));
            const sonuc = [];
            for (const mult of MULTS) {
                let kaz = 0, n = 0; const detay = [];
                for (const seed of SEEDS) {
                    for (const redAttacks of [true, false]) {
                        const atkB = Math.round(6500 * mult), defB = 6500;
                        const redB = redAttacks ? atkB : defB, blueB = redAttacks ? defB : atkB;
                        const r = await js(`(() => { try {
                            BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
                            BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;
                            BATTLE_INTEL4PRO_RED = true; BATTLE_INTEL4PRO_BLUE = true;   // ayna: iki taraf da pro
                            if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
                            if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = true;
                            if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;
                            openBattlefieldSession({ mode:'quick', mapId:-2, seed:${seed}, attackerSide:${redAttacks}, durationSec:360, playerMoney:${blueB}, enemyMoney:${redB}, show:false });
                            if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
                            battleDeployManifest(battleBuildArmyManifest(${blueB}, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker: !, pro: BATTLE_INTEL4PRO_BLUE }), false, { source:'probe-blue', ally:true });
                            startBattle(); window.requestAnimationFrame = () => 0;
                            const ph = SIM.headless; SIM.headless = true; let st = 0;
                            try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) { st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, st); } } finally { SIM.headless = ph; }
                            const b = SIM.battle || {};
                            let rv=0,bv=0; for (const u of SIM.units) { if (u.dead) continue; const c=(STATS[u.type]&&STATS[u.type].cost)||0; if (u.isRed) rv+=c; else bv+=c; }
                            return { kazanan:(b.winnerSide===true?'red':b.winnerSide===false?'blue':'-'), sebep:b.outcomeReason||null,
                                saldiranKazandi: b.winnerSide==null?null:((b.winnerSide===true)===${redAttacks}),
                                kalanSaldiran: ${redAttacks}?rv:bv, kalanSavunan: ${redAttacks}?bv:rv };
                        } catch(e){ return { err:e.message }; } })()`);
                        if (!r || r.err) { console.log('PROBE_ERR ' + (r && r.err)); continue; }
                        n++; if (r.saldiranKazandi) kaz++;
                        detay.push({ seed, saldiran: redAttacks ? 'red' : 'blue', kazandi: r.saldiranKazandi, sebep: r.sebep });
                    }
                }
                const pct = n ? +(kaz / n * 100).toFixed(1) : 0;
                sonuc.push({ mult, saldiranButce: Math.round(6500 * mult), mac: n, saldiranGalibiyet: kaz, yuzde: pct });
                console.log('PROBE mult=' + mult + ' (saldiran ' + Math.round(6500 * mult) + '₺ vs savunan 6500₺) -> saldiran ' + kaz + '/' + n + ' = %' + pct);
            }
            console.log('BUDGETPROBE ' + JSON.stringify(sonuc));
            console.log('BUDGETPROBE_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // INTEL4-PRO MEZUNİYET KAPISI: `--intel4pro` → intel4-pro vs intel4 (MEZUN sürüm), 6 tohum × 2 rol = 12 maç.
    // KULLANICI ÖLÇÜTÜ: pro ≥%75 (9/12) üstünlük sağlarsa MEZUN olur. Her maçta yalnız BİR taraf pro (adil).
    // İki taraf da intel4-beyni + gerçek-oyun deltaları; tek fark pro-katmanı (ammoDiscipline vb.).
    // Mühimmat akışı da ölçülür (P1'in hedeflediği mekanizma gerçekten değişti mi).
    if (process.argv.includes('--intel4pro')) {
        // `--only <delta>` → TEK DELTA İZOLE A/B: pro tarafta yalnız o delta açık, ötekiler kapalı; ayrıca
        // ordu dizilimi İKİ TARAFTA DA pro-suz kurulur (kompozisyon farkı karışmasın) → tek değişken kalır.
        const _oi = process.argv.indexOf('--only');
        const ONLY = _oi >= 0 ? String(process.argv[_oi + 1] || '') : null;
        const _si = process.argv.indexOf('--seeds');
        const SEEDARG = _si >= 0 ? String(process.argv[_si + 1] || '').split(',').map(Number).filter(Boolean) : null;
        createWindow();
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        const fsx = require('fs');
        win.webContents.on('did-finish-load', async () => {
            await new Promise(r => setTimeout(r, 1400));
            const SEEDS = SEEDARG && SEEDARG.length ? SEEDARG : [2024, 777, 909, 3141, 2718, 5150];
            const maclar = [];
            for (const seed of SEEDS) {
                for (const proIsRed of [true, false]) {
                    const r = await js(`(() => { try {
                        BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;                 // iki taraf da intel4
                        BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;
                        BATTLE_INTEL4PRO_RED = ${proIsRed}; BATTLE_INTEL4PRO_BLUE = ${!proIsRed};   // tek fark: pro-katmanı
                        const _only = ${ONLY ? "'" + ONLY + "'" : 'null'};
                        if (_only) { for (const k of Object.keys(BATTLE_INTEL4PRO_DELTAS)) BATTLE_INTEL4PRO_DELTAS[k] = (k === _only); }
                        // İZOLE modda kırmızının OTO-dizilimi de pro-suz olmalı (BattleDeployment BATTLE_INTEL4PRO_RED'i okur):
                        // bunu açılış anında geçici kapatıp oturum kurulduktan sonra geri veriyoruz → tek değişken runtime deltası.
                        const _proRedGercek = BATTLE_INTEL4PRO_RED;
                        if (_only) BATTLE_INTEL4PRO_RED = false;
                        if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
                        if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = true;
                        if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;
                        openBattlefieldSession({ mode:'quick', mapId:-2, seed:${seed}, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
                        if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
                        BATTLE_INTEL4PRO_RED = _proRedGercek;
                        battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker:false, pro: _only ? false : BATTLE_INTEL4PRO_BLUE }), false, { source:'pro-blue', ally:true });
                        startBattle(); window.requestAnimationFrame = () => 0; battleBalanceReset(true);
                        const ph = SIM.headless; SIM.headless = true; let st = 0;
                        // MÜHİMMAT AKIŞI: P1'in hedefi savunanın erken tükenmesini önlemek → t=60'ta oran + kuru birim
                        const muh = (isRed) => { let n=0,s=0,bos=0; for (const u of SIM.units) { if (u.dead||u.isRed!==isRed||!(u.maxAmmo>0)) continue; n++; s+=(u.ammo||0)/u.maxAmmo; if ((u.ammo||0)<=0) bos++; } return { amo:n?+(s/n).toFixed(2):null, bos }; };
                        let t60 = null, bitisTick = null;
                        try {
                            while (SIM.tick < 7300 && phase === PHASE.BATTLE) {
                                st += BATTLE_TICK_MS;
                                stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
                                if (typeof updateSupport === 'function') updateSupport(BATTLE_TICK_SEC, st);
                                if (SIM.tick === 1200) t60 = { red: muh(true), blue: muh(false) };   // t=60sn
                                if (bitisTick == null && SIM.battle && SIM.battle.winnerSide !== null) bitisTick = SIM.tick;
                            }
                        } finally { SIM.headless = ph; }
                        const rep = battleBalanceReport(); battleBalanceReset(false);
                        const b = SIM.battle || {};
                        const proKazandi = (b.winnerSide === true) === ${proIsRed};
                        let rv=0, bv=0; for (const u of SIM.units) { if (u.dead) continue; const c=(STATS[u.type]&&STATS[u.type].cost)||0; if (u.isRed) rv+=c; else bv+=c; }
                        return { seed:${seed}, proTaraf:${proIsRed}?'red':'blue', kazanan:(b.winnerSide===true?'red':b.winnerSide===false?'blue':'-'),
                            proKazandi: b.winnerSide==null?null:proKazandi, sebep:b.outcomeReason||null,
                            gercekBitisSn: bitisTick!=null?Math.round(bitisTick*BATTLE_TICK_SEC):null,
                            kalan:{ pro:${proIsRed}?rv:bv, intel4:${proIsRed}?bv:rv }, muh60:t60,
                            yogunluk: rep.localDensity||null };
                    } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,300) }; } })()`);
                    if (r && r.err) { console.log('PRO_ERR seed=' + seed + ' ' + r.err); continue; }
                    maclar.push(r);
                    console.log('PRO_MAC ' + maclar.length + '/12 seed=' + seed + ' pro=' + r.proTaraf + ' kazanan=' + r.kazanan +
                        ' proKazandi=' + r.proKazandi + ' (' + r.sebep + ') bitis=' + r.gercekBitisSn + 'sn');
                }
            }
            const karar = maclar.filter(m => m.proKazandi !== null);
            const g = karar.filter(m => m.proKazandi).length;
            const pct = karar.length ? +(g / karar.length * 100).toFixed(1) : 0;
            const ozet = { mac: maclar.length, kararli: karar.length, proGalibiyet: g, yuzde: pct,
                mezun: pct >= 75, esik: '>=75% (9/12)', izole: ONLY || 'tum-pro-katmani' };
            console.log('INTEL4PRO_OZET ' + JSON.stringify(ozet));
            try { fsx.mkdirSync('qa-runtime', { recursive:true }); fsx.writeFileSync((ONLY ? 'qa-runtime/intel4pro-ab-' + ONLY + '.json' : 'qa-runtime/intel4pro-gate.json'), JSON.stringify({ ozet, maclar }, null, 1)); } catch(e) {}
            console.log(ozet.mezun ? 'INTEL4PRO_MEZUN' : 'INTEL4PRO_HENUZ_DEGIL');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // MAÇ ZAMAN-SERİSİ: `--matchtimeline [--seeds a,b]` → maçı AN BE AN çözer. Toplamlar sağkalım-yanlılığıyla
    // kirli olduğu için (kazanan iyi görünür çünkü kazanmıştır) burada 10sn'lik kovalarda AKIŞ ölçülür:
    // taraf-başı canlı-₺, o kovada kaybedilen ₺, atış/öldürme sayısı, TOPLAM HASAR ve **ORTALAMA ANGAJMAN MESAFESİ**
    // (FAZ-4 R1 doktrininin doğrudan ölçüsü). Ayrıca KARAR-TİKİ: üstünlüğün işaretinin bir daha dönmediği an.
    // Veriyi BATTLE_FORENSIC'ten DEĞİL (2048 halka-tampon erken evreyi düşürür) canlı olay-kancasından toplar.
    if (process.argv.includes('--matchtimeline')) {
        const _si = process.argv.indexOf('--seeds');
        const SEEDS = (_si >= 0 && process.argv[_si + 1] && !process.argv[_si + 1].startsWith('--'))
            ? process.argv[_si + 1].split(',').map(s => parseInt(s, 10)).filter(Number.isFinite) : [2024, 777];
        createWindow();
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        const fsx = require('fs');
        win.webContents.on('did-finish-load', async () => {
            await new Promise(r => setTimeout(r, 1400));
            const hepsi = [];
            for (const seed of SEEDS) {
                for (const redAttacks of [true, false]) {
                    const r = await js(`(() => { try {
                        const KOVA = 200;   // 10 sn
                        BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
                        BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;
                        // --pro red|blue|both : pro-katmanını seçilen tarafta aç (ucuz yineleme; mezuniyet kapısı ayrı)
                        BATTLE_INTEL4PRO_RED = ${JSON.stringify(process.argv.includes('--pro') ? (process.argv[process.argv.indexOf('--pro') + 1] || 'both') : 'none')} === 'red' || ${JSON.stringify(process.argv.includes('--pro') ? (process.argv[process.argv.indexOf('--pro') + 1] || 'both') : 'none')} === 'both';
                        BATTLE_INTEL4PRO_BLUE = ${JSON.stringify(process.argv.includes('--pro') ? (process.argv[process.argv.indexOf('--pro') + 1] || 'both') : 'none')} === 'blue' || ${JSON.stringify(process.argv.includes('--pro') ? (process.argv[process.argv.indexOf('--pro') + 1] || 'both') : 'none')} === 'both';
                        if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
                        if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = true;
                        if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;
                        openBattlefieldSession({ mode:'quick', mapId:-2, seed:${seed}, attackerSide:${redAttacks}, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
                        if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
                        battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker: !, pro: BATTLE_INTEL4PRO_BLUE }), false, { source:'timeline-blue', ally:true });
                        startBattle(); window.requestAnimationFrame = () => 0;
                        battleBalanceReset(true);   // kohezyon teşhis sayaçları için (hash-dışı)
                        // OLAY KANCASI: hasar/mesafe/öldürme akışını kovalara topla (halka-tampona bağımlı DEĞİL)
                        const kova = {};
                        const K = (t) => { const i = Math.floor(t/KOVA); return kova[i] || (kova[i] = {
                            red:{ ev:0, kill:0, dmg:0, distSum:0, tip:{}, indEv:0, indDmg:0, cbDmg:0, yerelN:0, yerelDost:0, yerelDusman:0 }, blue:{ ev:0, kill:0, dmg:0, distSum:0, tip:{}, indEv:0, indDmg:0, cbDmg:0, yerelN:0, yerelDost:0, yerelDusman:0 } }); };
                        // DOLAYLI/DOĞRUDAN AYRIMI: "yumuşatma ateşi gerçekte ne kadar iş yapıyor" sorusunu ayırt eder
                        const _indTip = new Set(); for (const k in STATS) { const s = STATS[k];
                            if (s && (s.category === 'indirect' || (s.weapons && s.weapons[0] && s.weapons[0].indirect))) _indTip.add(+k); }
                        const oRec = battleRecordCombatEvent;
                        window.battleRecordCombatEvent = function (d) {
                            try {
                                const s = d.attackerSide === 'red' ? 'red' : 'blue';
                                const b = K(SIM.tick || 0)[s];
                                b.ev++; if (d.lethal) b.kill++; b.dmg += (d.damage || 0);
                                if (_indTip.has(d.attackerType)) { b.indEv++; b.indDmg += (d.damage || 0); }
                                // KARŞI-BATARYA: DÜŞMANIN DOLAYLI birimlerine verilen hasar (kullanıcı doktrini:
                                // "savunanın dolaylı ateşi toplanmış saldırı hattını yıpratır" → önce onu sustur).
                                if (_indTip.has(d.targetType)) b.cbDmg += (d.damage || 0);
                                // YEREL KUVVET ORANI (KURBANIN gözünden): vurulan birimin 600px çevresinde kaç DOST, kaç DÜŞMAN?
                                // Global bütçe eşitken bile kurban sürekli yerel olarak azsa kusur YOĞUNLAŞMA'dır.
                                if (d.targetX != null) {
                                    const vs = d.targetSide === 'red';   // kurbanın tarafı
                                    let dost = 0, dusman = 0;
                                    for (const q of SIM.spatialGrid.getNearby(d.targetX, d.targetY, 600)) {
                                        if (q.dead || q.loaded) continue;
                                        if (Math.hypot(q.x - d.targetX, q.y - d.targetY) > 600) continue;
                                        if (q.isRed === vs) dost++; else dusman++;
                                    }
                                    const kb = K(SIM.tick || 0)[vs ? 'red' : 'blue'];   // KURBAN tarafına yaz
                                    kb.yerelN++; kb.yerelDost += dost; kb.yerelDusman += dusman;
                                }
                                if (d.attackerX != null && d.targetX != null) b.distSum += Math.hypot(d.targetX-d.attackerX, d.targetY-d.attackerY);
                                const tn = (typeof UNIT_ID_BY_INDEX !== 'undefined' && UNIT_ID_BY_INDEX[d.attackerType]) || ('t'+d.attackerType);
                                b.tip[tn] = (b.tip[tn]||0)+1;
                            } catch(_) {}
                            return oRec(d);
                        };
                        const ph = SIM.headless; SIM.headless = true; let st = 0;
                        const seri = [];
                        const deger = (isRed) => { let v=0; for (const u of SIM.units) if (!u.dead && u.isRed===isRed) v += (STATS[u.type]&&STATS[u.type].cost)||0; return v; };
                        // MÜHİMMAT/BASTIRMA durumu: "ordusu sağ ama ateşi kesildi" hipotezini sınamak için
                        const durum = (isRed) => { let n=0, amoN=0, amoSum=0, bos=0, supSum=0; const bosTip={}, dusukTip={};
                            for (const u of SIM.units) { if (u.dead || u.isRed!==isRed) continue; n++; supSum += (u.suppression||0);
                                if (u.maxAmmo > 0) { amoN++; const f=(u.ammo||0)/u.maxAmmo; amoSum += f;
                                    const tn = (typeof UNIT_ID_BY_INDEX !== 'undefined' && UNIT_ID_BY_INDEX[u.type]) || ('t'+u.type);
                                    if ((u.ammo||0) <= 0) { bos++; bosTip[tn]=(bosTip[tn]||0)+1; }
                                    else if (f <= 0.34) dusukTip[tn]=(dusukTip[tn]||0)+1; } }
                            // TEMASTA: kendi silah menzilinde CANLI düşmanı olan birim sayısı. (a) "kütle zarfa yürüyor" ile
                            // (c) "damla damla varıyor" hipotezlerini ayırt eder: temas eğrisi sıçrıyorsa toplu, sürünüyorsa parça parça.
                            let temas = 0;
                            for (const u of SIM.units) { if (u.dead || u.isRed!==isRed || !(u.range>0)) continue;
                                for (const e of SIM.units) { if (e.dead || e.isRed===isRed || e.loaded) continue;
                                    if (Math.hypot(e.x-u.x, e.y-u.y) <= u.range) { temas++; break; } } }
                            return { n, amo: amoN ? +(amoSum/amoN).toFixed(2) : null, bosMuh: bos, sup: n ? Math.round(supSum/n) : 0, bosTip, dusukTip, temas }; };
                        try {
                            while (SIM.tick < 7300 && phase === PHASE.BATTLE) {
                                st += BATTLE_TICK_MS;
                                stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
                                if (typeof updateSupport === 'function') updateSupport(BATTLE_TICK_SEC, st);
                                if ((SIM.tick % KOVA) === 0) {
                                    const i = SIM.tick/KOVA - 1, b = kova[i] || { red:{ev:0,kill:0,dmg:0,distSum:0,tip:{},indEv:0,indDmg:0,cbDmg:0,yerelN:0,yerelDost:0,yerelDusman:0}, blue:{ev:0,kill:0,dmg:0,distSum:0,tip:{},indEv:0,indDmg:0,cbDmg:0,yerelN:0,yerelDost:0,yerelDusman:0} };
                                    const rp = SIM.ctrlPosture ? SIM.ctrlPosture['battle-red-ai'] : null;
                                    const bp = SIM.ctrlPosture ? SIM.ctrlPosture['battle-blue-ally-ai'] : null;
                                    seri.push({ sn: Math.round(SIM.tick*BATTLE_TICK_SEC), redVal: deger(true), blueVal: deger(false),
                                        rD: durum(true), bD: durum(false),
                                        r:{ ev:b.red.ev, kill:b.red.kill, dmg:Math.round(b.red.dmg), dist: b.red.ev ? Math.round(b.red.distSum/b.red.ev) : 0, durus: rp?rp.stance:null, ind: Math.round(b.red.indDmg), indEv: b.red.indEv, cb: Math.round(b.red.cbDmg), yN: b.red.yerelN, yD: b.red.yerelDost, yE: b.red.yerelDusman },
                                        b:{ ev:b.blue.ev, kill:b.blue.kill, dmg:Math.round(b.blue.dmg), dist: b.blue.ev ? Math.round(b.blue.distSum/b.blue.ev) : 0, durus: bp?bp.stance:null, ind: Math.round(b.blue.indDmg), indEv: b.blue.indEv, cb: Math.round(b.blue.cbDmg), yN: b.blue.yerelN, yD: b.blue.yerelDost, yE: b.blue.yerelDusman } });
                                }
                            }
                        } finally { SIM.headless = ph; window.battleRecordCombatEvent = oRec; }
                        // KARAR-TİKİ: farkın işaretinin bir daha DÖNMEDİĞİ ilk an
                        const fark = seri.map(x => x.redVal - x.blueVal);
                        const sonIsaret = Math.sign(fark[fark.length-1] || 0);
                        let karar = null;
                        for (let i = fark.length-1; i >= 0; i--) { if (Math.sign(fark[i]) !== sonIsaret) { karar = seri[Math.min(i+1, seri.length-1)].sn; break; } }
                        // genel angajman mesafesi (R1 doktrini)
                        let rd=0,re=0,bd=0,be=0;
                        for (const i in kova) { rd+=kova[i].red.distSum; re+=kova[i].red.ev; bd+=kova[i].blue.distSum; be+=kova[i].blue.ev; }
                        const bt = SIM.battle||{};
                        const _bb = (typeof BATTLE_BALANCE !== 'undefined') ? BATTLE_BALANCE : {};
                        const kohezyon = { eval: _bb.proCohesionEval||0, hold: _bb.proCohesionHold||0, bind: _bb.proCohesionBind||0,
                            ortDost: _bb.proCohesionEval ? +((_bb.proCohesionDostSum||0)/_bb.proCohesionEval).toFixed(2) : null };
                        battleBalanceReset(false);
                        return { seed:${seed}, redAttacks:${redAttacks}, kazanan:(bt.winnerSide===true?'red':bt.winnerSide===false?'blue':'-'), sebep:bt.outcomeReason||null, kohezyon,
                            kararSn: karar, ortMesafe:{ red: re?Math.round(rd/re):0, blue: be?Math.round(bd/be):0 }, seri };
                    } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,300) }; } })()`);
                    if (r && r.err) { console.log('TIMELINE_ERR ' + r.err); continue; }
                    hepsi.push(r);
                    console.log('TIMELINE seed=' + r.seed + ' redAtk=' + r.redAttacks + ' kazanan=' + r.kazanan + ' (' + r.sebep + ') kararSn=' + r.kararSn +
                        ' ortMesafe red=' + r.ortMesafe.red + ' blue=' + r.ortMesafe.blue);
                }
            }
            try { fsx.mkdirSync('qa-runtime', { recursive: true }); fsx.writeFileSync('qa-runtime/match-timeline.json', JSON.stringify(hepsi, null, 1));
                console.log('TIMELINE_DOSYA qa-runtime/match-timeline.json'); } catch(e) { console.log('TIMELINE_YAZMA_HATA ' + e.message); }
            console.log('TIMELINE_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // INTEL4 AYNA SELF-PLAY: `--intel4selfplay [--seeds n]` → intel4 KENDİNE karşı, 16 tohum × 2 rol (saldıran taraf
    // takaslanır) = 32 maç. Ayna olduğu için galibiyet farkı BEYİN farkı değil ROL/HARİTA yanlılığıdır; asıl ürün
    // `battleBalanceReport()` toplamlarıdır: hangi birim parasını kazanıyor, kayıp-₺ bandı, blob (yerel-yoğunluk),
    // kamikaze verimi, duruş dağılımı. Bundan FAZ 2/3/4 kabul metrikleri ve geliştirme planı çıkar.
    // KONFİGÜRASYON: GERÇEK OYUNDAKİ beyin (varsayılan deltalar + defense/range/drone) — vsrec'in "tüm deltalar" kurulumu DEĞİL.
    if (process.argv.includes('--intel4selfplay')) {
        const _si = process.argv.indexOf('--seeds');
        const N_SEED = (_si >= 0 && /^\d+$/.test(process.argv[_si + 1] || '')) ? parseInt(process.argv[_si + 1], 10) : 16;
        createWindow();
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        const fsx = require('fs');
        win.webContents.on('did-finish-load', async () => {
            await new Promise(r => setTimeout(r, 1400));
            const SEEDS = [2024, 777, 909, 3141, 2718, 5150, 1453, 1071, 8080, 4242, 1234, 6789, 31337, 9001, 555, 12321].slice(0, N_SEED);
            const maclar = [];
            for (const seed of SEEDS) {
                for (const redAttacks of [true, false]) {
                    const r = await js(`(() => { try {
                        if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
                        if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = true;
                        BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;              // AYNA: iki taraf da intel4
                        BATTLE_INTEL4_DELTAS.defense = true; BATTLE_INTEL4_DELTAS.range = true; BATTLE_INTEL4_DELTAS.drone = true;   // gerçek-oyun beyni
                        if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;
                        openBattlefieldSession({ mode:'quick', mapId:-2, seed:${seed}, attackerSide:${redAttacks}, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
                        if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
                        battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:true, isAttacker: !, pro: BATTLE_INTEL4PRO_BLUE }), false, { source:'selfplay-blue', ally:true });
                        startBattle(); window.requestAnimationFrame = () => 0; battleBalanceReset(true);
                        const ph = SIM.headless; SIM.headless = true; let st = 0;
                        const durus = { red:{}, blue:{} }; let ilkStrikeRed = null, ilkStrikeBlue = null;
                        try {
                            while (SIM.tick < 7300 && phase === PHASE.BATTLE) {
                                st += BATTLE_TICK_MS;
                                stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
                                if (typeof updateSupport === 'function') updateSupport(BATTLE_TICK_SEC, st);
                                const pr = SIM.ctrlPosture ? SIM.ctrlPosture['battle-red-ai'] : null;
                                const pb = SIM.ctrlPosture ? SIM.ctrlPosture['battle-blue-ally-ai'] : null;
                                if (pr && pr.stance) { durus.red[pr.stance] = (durus.red[pr.stance]||0)+1; if (pr.stance==='STRIKE' && ilkStrikeRed==null) ilkStrikeRed = SIM.tick; }
                                if (pb && pb.stance) { durus.blue[pb.stance] = (durus.blue[pb.stance]||0)+1; if (pb.stance==='STRIKE' && ilkStrikeBlue==null) ilkStrikeBlue = SIM.tick; }
                            }
                        } finally { SIM.headless = ph; }
                        const rep = battleBalanceReport(); battleBalanceReset(false);
                        const b = SIM.battle || {};
                        // kayıp ₺: her tarafın KAYBETTİĞİ değer = karşı tarafın killValue'su
                        const kv = rep.tradeRatio || {};
                        const canli = { red:0, blue:0 };
                        for (const u of SIM.units) { if (u.dead) continue; const c=(STATS[u.type]&&STATS[u.type].cost)||0; if (u.isRed) canli.red+=c; else canli.blue+=c; }
                        return { seed:${seed}, redAttacks:${redAttacks}, kazanan:(b.winnerSide===true?'red':b.winnerSide===false?'blue':'-'),
                            sebep:b.outcomeReason||null, bitisTick:SIM.tick,
                            kalanDeger:canli, takas:kv, durus, ilkStrike:{ red:ilkStrikeRed, blue:ilkStrikeBlue },
                            // ALAN ADLARI battleBalanceReport ile BİREBİR olmalı (ilk sürümde 'dispersal'/'abandoned' yazılmıştı →
                            // sessizce null/0 dönüyordu ve "terk mekaniği ölü" gibi SAHTE bulgu üretti).
                            yogunluk: rep.localDensity || null, dagilim: rep.dispersalIndex || null,
                            kamikaze: rep.kamikaze || null, griArac: rep.grayVehicle || null,
                            sektorDoluluk: rep.sectorOccupancy || null, anaCabaKaymasi: rep.mainEffortShifts || null,
                            taarruzBastirilmisPct: rep.assaultSuppressedPct, mayinOldurme: rep.mineKills, heloSorti: rep.heloSorties,
                            birim: (rep.rows||[]).map(x=>({ id:x.id, dep:x.dep, dmg:x.dmg, kills:x.kills, deaths:x.deaths, cost:x.cost, dpc:x.dmgPerCost })),
                            kirmiziBayrak: rep.redFlags || [] };
                    } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,300) }; } })()`);
                    if (r && r.err) { console.log('SELFPLAY_ERR seed=' + seed + ' redAtk=' + redAttacks + ' ' + r.err); continue; }
                    maclar.push(r);
                    console.log('SELFPLAY_MAC ' + maclar.length + '/' + (SEEDS.length*2) + ' seed=' + seed + ' redAtk=' + redAttacks +
                        ' kazanan=' + r.kazanan + ' (' + r.sebep + ') tick=' + r.bitisTick);
                }
            }
            // ── TOPLAM ÇIKARIM ──
            const sald = maclar.filter(m => (m.kazanan === 'red') === m.redAttacks && m.kazanan !== '-').length;
            const sav = maclar.filter(m => m.kazanan !== '-' && ((m.kazanan === 'red') !== m.redAttacks)).length;
            const berabere = maclar.filter(m => m.kazanan === '-').length;
            const birimToplam = {};
            for (const m of maclar) for (const b of (m.birim || [])) {
                const a = birimToplam[b.id] || (birimToplam[b.id] = { dep:0, dmg:0, kills:0, deaths:0, cost:b.cost });
                a.dep += b.dep; a.dmg += b.dmg; a.kills += b.kills; a.deaths += b.deaths;
            }
            const birimSirali = Object.entries(birimToplam).map(([id,a]) => ({ id, dep:a.dep, cost:a.cost,
                dmgPerCost: a.dep ? +(a.dmg/(a.dep*a.cost)).toFixed(3) : 0,
                killsPer100: a.dep ? +(a.kills/(a.dep*a.cost/100)).toFixed(2) : 0,
                olumOrani: a.dep ? +(a.deaths/a.dep).toFixed(2) : 0 })).sort((x,y) => x.dmgPerCost - y.dmgPerCost);
            const bayrakSay = {};
            for (const m of maclar) for (const f of (m.kirmiziBayrak || [])) bayrakSay[f] = (bayrakSay[f]||0)+1;
            const ozet = { mac: maclar.length, saldiranGalibiyet: sald, savunanGalibiyet: sav, berabere,
                saldiranKazanmaYuzdesi: maclar.length ? +(sald/(maclar.length-berabere)*100).toFixed(1) : 0,
                enVerimsizBirimler: birimSirali.slice(0, 8), enVerimliBirimler: birimSirali.slice(-5).reverse(),
                kirmiziBayrakSikligi: bayrakSay };
            console.log('SELFPLAY_OZET ' + JSON.stringify(ozet));
            try { fsx.mkdirSync('qa-runtime', { recursive: true }); fsx.writeFileSync('qa-runtime/intel4-selfplay.json', JSON.stringify({ ozet, maclar }, null, 1));
                console.log('SELFPLAY_DOSYA qa-runtime/intel4-selfplay.json'); } catch(e) { console.log('SELFPLAY_YAZMA_HATA ' + e.message); }
            console.log('SELFPLAY_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // INTEL4-PRO ARA-SINAV: `--intel4exam` → planın 4 tohumunu (2 saldırı + 2 savunma, 6500₺) koşar ve FAZ-kabul
    // ölçütlerini TEK ÇIKTIDA verir: (1) intel4 galibiyet kaydı, (2) FAZ-0 kabulü "tek-tik duruş devrilmesi = 0",
    // (3) FAZ-1 kabulü "saldıranın ilk STRIKE'ı ≤ t=90s", (4) duruş histogramı + gerekçe dağılımı.
    // --vsrec'in hafif ikizi: aynı kurulum ama 145 MB ham-JSON YAZMAZ (ara-sınav sık koşulacak).
    // Duruşu SIM.ctrlPosture'dan okur (sim-durumu) → kontrolör nesnesine dokunmadan, replay-güvenli ölçüm.
    if (process.argv.includes('--intel4exam')) {
        createWindow();
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await new Promise(r => setTimeout(r, 1400));
            const out = await js(`(() => { try {
                const SENARYO = [
                    { rol:'intel4-saldiri', intel4IsRed:true,  seed:2024 },
                    { rol:'intel4-saldiri', intel4IsRed:true,  seed:777  },
                    { rol:'intel4-savunma', intel4IsRed:false, seed:2024 },
                    { rol:'intel4-savunma', intel4IsRed:false, seed:777  }
                ];
                const STRIKE_LIMIT_TICK = 1800;   // FAZ-1 kabulü: ilk STRIKE <= t=90s
                const sonuc = [];
                for (const sc of SENARYO) {
                    if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
                    if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = true;
                    for (const k in BATTLE_INTEL4_DELTAS) BATTLE_INTEL4_DELTAS[k] = true;   // tam intel4-beyni (vsrec ile aynı)
                    BATTLE_INTEL4_RED = sc.intel4IsRed; BATTLE_INTEL4_BLUE = !sc.intel4IsRed;
                    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;
                    openBattlefieldSession({ mode:'quick', mapId:-2, seed:sc.seed, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
                    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
                    battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4: BATTLE_INTEL4_BLUE, isAttacker:false }), false, { source:'exam-blue', ally:true });
                    startBattle(); window.requestAnimationFrame = () => 0;
                    const ph = SIM.headless; SIM.headless = true; let st = 0;
                    // kırmızı DAİMA saldıran (vsrec ile aynı) → saldıranın kontrolörü 'battle-red-ai'
                    const izle = { 'battle-red-ai':{ son:null, uzunluk:0, tekTik:0, ilkStrike:null, ilkStrikeSebep:null, hist:{}, sebepHist:{}, gecis:0 },
                                   'battle-blue-ally-ai':{ son:null, uzunluk:0, tekTik:0, ilkStrike:null, ilkStrikeSebep:null, hist:{}, sebepHist:{}, gecis:0 } };
                    try {
                        while (SIM.tick < 7300 && phase === PHASE.BATTLE) {
                            st += BATTLE_TICK_MS;
                            stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false);
                            if (typeof updateSupport === 'function') updateSupport(BATTLE_TICK_SEC, st);
                            for (const cid in izle) {
                                const p = SIM.ctrlPosture ? SIM.ctrlPosture[cid] : null;
                                const s = p ? (p.stance || null) : null;
                                const z = izle[cid];
                                if (s) z.hist[s] = (z.hist[s] || 0) + 1;
                                if (s === 'STRIKE' && z.ilkStrike == null) {
                                    z.ilkStrike = SIM.tick;
                                    // NEDEN STRIKE? gateReason yalnız ÖLÇÜM için canlı kontrolörden okunur (sim'e dokunmaz).
                                    const c = (typeof BATTLE_CONTROLLERS !== 'undefined') ? BATTLE_CONTROLLERS.get(cid) : null;
                                    z.ilkStrikeSebep = (c && c.lastSituation && c.lastSituation.operationalPosture) ? c.lastSituation.operationalPosture.gateReason : null;
                                }
                                if (s === 'STRIKE') {
                                    const c2 = (typeof BATTLE_CONTROLLERS !== 'undefined') ? BATTLE_CONTROLLERS.get(cid) : null;
                                    const gr = (c2 && c2.lastSituation && c2.lastSituation.operationalPosture) ? c2.lastSituation.operationalPosture.gateReason : null;
                                    if (gr) z.sebepHist[gr] = (z.sebepHist[gr] || 0) + 1;
                                }
                                if (s !== z.son) {
                                    if (z.son != null) { z.gecis++; if (z.uzunluk === 1) z.tekTik++; }   // önceki duruş TEK TİK sürdüyse = devrilme
                                    z.son = s; z.uzunluk = 1;
                                } else z.uzunluk++;
                            }
                        }
                    } finally { SIM.headless = ph; }
                    const b = SIM.battle || {};
                    const intel4Kazandi = (b.winnerSide === true) === sc.intel4IsRed;
                    const sald = izle['battle-red-ai'];   // saldıran daima kırmızı
                    sonuc.push({ rol: sc.rol, seed: sc.seed,
                        kazanan: (b.winnerSide===true?'red':b.winnerSide===false?'blue':'-'),
                        intel4Kazandi: (b.winnerSide == null) ? null : intel4Kazandi,
                        sebep: b.outcomeReason || null, bitisTick: SIM.tick,
                        saldiranIlkStrikeTick: sald.ilkStrike, saldiranIlkStrikeSn: sald.ilkStrike == null ? null : +(sald.ilkStrike*BATTLE_TICK_SEC).toFixed(1),
                        saldiranIlkStrikeSebep: sald.ilkStrikeSebep, saldiranSebepHist: sald.sebepHist,
                        tekTikDevrilme: { kirmizi: izle['battle-red-ai'].tekTik, mavi: izle['battle-blue-ally-ai'].tekTik },
                        durusGecisi: { kirmizi: izle['battle-red-ai'].gecis, mavi: izle['battle-blue-ally-ai'].gecis },
                        durusHist: { kirmizi: izle['battle-red-ai'].hist, mavi: izle['battle-blue-ally-ai'].hist },
                        kalan: { kirmizi: SIM.units.filter(u=>!u.dead&&u.isRed).length, mavi: SIM.units.filter(u=>!u.dead&&!u.isRed).length } });
                    for (const k in BATTLE_INTEL4_DELTAS) BATTLE_INTEL4_DELTAS[k] = true;
                    BATTLE_INTEL4_RED = false; BATTLE_INTEL4_BLUE = false;
                }
                const galip = sonuc.filter(r => r.intel4Kazandi === true).length;
                const tekTikToplam = sonuc.reduce((s,r) => s + r.tekTikDevrilme.kirmizi + r.tekTikDevrilme.mavi, 0);
                // FAZ-1 kabulü YALNIZ intel4 SALDIRIRKEN geçerli (savunma maçlarında saldıran intel3pro'dur — onun geç
                // STRIKE'ı intel4'ün kusuru değildir). İlk sürümde bu ayrım yoktu → metrik yanıltıcıydı.
                const saldiriMaclari = sonuc.filter(r => r.rol === 'intel4-saldiri');
                const gecStrike = saldiriMaclari.filter(r => r.saldiranIlkStrikeTick == null || r.saldiranIlkStrikeTick > STRIKE_LIMIT_TICK).length;
                return { ozet: { intel4Galibiyet: galip + '/' + sonuc.length,
                    faz0_tekTikDevrilme: tekTikToplam, faz0_kabul: tekTikToplam === 0,
                    faz1_gecKalanStrike: gecStrike, faz1_kabul: gecStrike === 0 }, mac: sonuc };
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,500) }; } })()`);
            console.log('INTEL4EXAM ' + JSON.stringify(out));
            console.log('INTEL4EXAM_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // HAVADA ÖNLEME KAPISI: `--pdtest` → ÇNRA salvosu SAM kapsamına atılır. Doğrulanan: önlenen roket UÇAR ve
    // kesişme tik'inde kuyruktan düşer (hasar YOK), kesişme noktası fırlatma↔çarpma DOĞRUSU ÜZERİNDE ve varıştan ÖNCEDİR.
    if (process.argv.includes('--pdtest')) {
        createWindow();
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await new Promise(r => setTimeout(r, 1400));
            const out = await js(`(() => { try {
                // Tek senaryo koşucusu: kırmızı ÇNRA mavi hedefe salvo atar, mavi SAM kapsamdadır.
                // opts.helo: 'yakin' (SAM menzilinde) | 'uzak' (görünür ama menzil dışı) | yok. opts.samAmmo: başlangıç füzesi.
                const senaryo = (ad, opts) => {
                    openBattlefieldSession({ mode:'quick', mapId:-2, seed:2024, attackerSide:true, durationSec:300, playerMoney:0, enemyMoney:0, deployRes:null, deployPool:null, techBonus:null, techBonusRed:null, show:false });
                    startBattle(); window.requestAnimationFrame = () => 0; SIM.headless = true;
                    artilleryHasSight = () => true;              // gözcü koşulu test konusu DEĞİL (PD mekaniği sınanıyor)
                    SIM.units.length = 0;                        // kontrollü saha
                    const mk = (t,x,y,r) => { const u = new Unit(t,x,y,r); SIM.units.push(u); return u; };
                    const mlrs = mk(T.MLRS, 1200, 600, true);    // kırmızı ÇNRA (salvo 12, interceptable)
                    mlrs.vision = 4000;                          // hedefi kendi görsün (görüş test konusu değil)
                    const sam  = mk(T.SAM, 1200, 2050, false);   // mavi SAM (çarpma noktası menzilinde)
                    sam.vision = 4000;                           // hava tehdidini BİLSİN (bilinen-hava-kuvveti koşulu)
                    if (opts.samAmmo != null) sam.ammo = opts.samAmmo;
                    const tgt  = mk(T.INFANTRY, 1200, 2100, false);
                    let helo = null;
                    // 'yakin': SAM menzilinde (1650) ama helikopterin KENDİ menzili (ATGM 900) dışında → SAM'i öldüremez,
                    // böylece "SAM öldüğü için önleme olmadı" yanılgısı elenir; ölçülen şey gerçekten uçak-önceliğidir.
                    if (opts.helo === 'yakin') helo = mk(T.ATTACK_HELO, 2400, 2050, true);
                    if (opts.helo === 'uzak')  helo = mk(T.ATTACK_HELO, 1200, 5200, true);   // görünür ama SAM menzili DIŞINDA
                    if (helo) { helo.manualMoveTarget = { x: helo.x, y: helo.y }; helo.isMovingToManualTarget = true; helo.speed = 0; helo.baseSpeed = 0; }
                    mlrs.lastAttackTime = -9e9; mlrs.attackTarget = tgt; mlrs.manualTarget = tgt;
                    phase = PHASE.BATTLE;                        // startBattle boş sahada deploy'da kalıyor → savaşı elle aç
                    const q = SIM.pendingHits;
                    const gorulen = new Map(), silinen = new Map(), patlayan = new Set();
                    const oB = applyBlast; window.applyBlast = function(h,n){ patlayan.add(h.seq); return oB(h,n); };
                    for (let i = 0; i < 130 && phase === PHASE.BATTLE; i++) {   // SAM'in uçağa ateş etmesine yetecek süre (rof 0.3 → ~67 tik)
                        const once = new Set(q.map(h=>h.seq));
                        simulationTime += BATTLE_TICK_MS; gameTime += BATTLE_TICK_SEC;
                        mlrs.attackTarget = tgt; mlrs.manualTarget = tgt;   // hedefi sabit tut (yeniden-hedefleme testi bozmasın)
                        if (helo && !helo.dead) { helo.x = helo.targetX = opts.helo === 'yakin' ? 2400 : 1200; helo.y = helo.targetY = opts.helo === 'yakin' ? 2050 : 5200; }
                        stepSim(simulationTime, BATTLE_TICK_SEC, null, false);
                        updateSupport(BATTLE_TICK_SEC, simulationTime);
                        for (const h of q) if (!gorulen.has(h.seq)) gorulen.set(h.seq, { seq:h.seq, fireTick:h.fireTick, arriveTick:h.arriveTick,
                            killTick:h.killTick, ax:h.atkX, ay:h.atkY, cx:h.cx, cy:h.cy, kx:h.killX, ky:h.killY });
                        const sonra = new Set(q.map(h=>h.seq));
                        for (const s of once) if (!sonra.has(s)) silinen.set(s, SIM.tick - 1);
                    }
                    window.applyBlast = oB;
                    const hepsi = [...gorulen.values()];
                    const onlenen = hepsi.filter(h => h.killTick != null);
                    const ihlal = { yanlisTiktaDusme:0, onlenenPatladi:0, kesismeDogruDisi:0, kesismeVaristanSonra:0, silinmedi:0 };
                    const ornek = [];
                    for (const h of onlenen) {
                        const sil = silinen.get(h.seq);
                        if (sil == null) ihlal.silinmedi++; else if (sil !== h.killTick) ihlal.yanlisTiktaDusme++;
                        if (patlayan.has(h.seq)) ihlal.onlenenPatladi++;
                        if (h.killTick > h.arriveTick || h.killTick <= h.fireTick) ihlal.kesismeVaristanSonra++;
                        const dTam = Math.hypot(h.cx-h.ax, h.cy-h.ay), dKes = Math.hypot(h.kx-h.ax, h.ky-h.ay);
                        const f = dTam > 0 ? dKes/dTam : 0;
                        const capraz = Math.abs((h.cx-h.ax)*(h.ky-h.ay) - (h.cy-h.ay)*(h.kx-h.ax)) / (dTam || 1);   // doğrudan sapma (px)
                        if (capraz > 1 || f <= 0 || f > 1.0001) ihlal.kesismeDogruDisi++;
                        if (ornek.length < 2) ornek.push({ fireTick:h.fireTick, killTick:h.killTick, arriveTick:h.arriveTick,
                            yolOrani:+f.toFixed(3), dogrudanSapma:+capraz.toFixed(3), silindigiTick:sil, patladiMi:patlayan.has(h.seq) });
                    }
                    return { ad, salvoKuyruk: hepsi.length, havadaOnlenen: onlenen.length,
                        samMuhimmatBas: opts.samAmmo != null ? opts.samAmmo : 8, samMuhimmatSon: Math.round(sam.ammo),
                        heloOldu: helo ? !!helo.dead : null, hedefHp: Math.round(tgt.hp), ihlal, ornek,
                        sam: { cs: sam.combatState, hedef: sam.attackTarget ? sam.attackTarget.id : 0, dead: sam.dead,
                               heloMesafe: helo ? Math.round(Math.hypot(helo.x-sam.x, helo.y-sam.y)) : null, menzil: sam.range,
                               heloHp: helo ? Math.round(helo.hp) : null } };
                };
                return [
                    senaryo('A_hava_yok', {}),                                  // taban: önleme OLMALI
                    senaryo('B_hava_menzilde', { helo:'yakin' }),               // uçak önceliği: önleme OLMAMALI
                    senaryo('C_hava_bilinir_yedek3', { helo:'uzak', samAmmo:3 }),// yedek kuralı: önleme OLMAMALI
                    senaryo('D_hava_bilinir_bol_muhimmat', { helo:'uzak', samAmmo:8 })  // yedek üstünde: önleme OLMALI
                ];
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,500) }; } })()`);
            console.log('PDTEST ' + JSON.stringify(out));
            const bek = { A_hava_yok: 'var', B_hava_menzilde: 'yok', C_hava_bilinir_yedek3: 'yok', D_hava_bilinir_bol_muhimmat: 'var' };
            const ok = Array.isArray(out) && out.length === 4 && out.every(r =>
                r.ihlal && Object.values(r.ihlal).every(v => v === 0) && r.salvoKuyruk > 0 &&
                r.sam && r.sam.dead === false &&                                   // SAM ölmemiş olmalı (yoksa "önleme yok" sonucu anlamsız)
                (bek[r.ad] === 'var' ? r.havadaOnlenen > 0 : r.havadaOnlenen === 0)) &&
                // B: uçak önceliği KANITI — SAM füzelerini mermiye değil UÇAĞA harcamış olmalı
                out.find(r => r.ad === 'B_hava_menzilde').samMuhimmatSon < out.find(r => r.ad === 'B_hava_menzilde').samMuhimmatBas &&
                // C: yedek kuralı KANITI — füze HİÇ harcanmamış (3 yedek dokunulmadan durmalı)
                out.find(r => r.ad === 'C_hava_bilinir_yedek3').samMuhimmatSon === 3;
            console.log(ok ? 'PDTEST_OK' : 'PDTEST_FAIL');
            setTimeout(() => app.exit(ok ? 0 : 1), 300);
        });
        return;
    }

    // SAPMA TİK-TİK İZ SÜRÜCÜ: `--divdiag` → canlı ve replay'i AYNI tik sayısı koşturur, izlenen birimlerin
    // her tikteki durumunu kaydeder ve İLK ayrışan tik'i + o tik civarındaki iki izi yan yana döker.
    // (Hash yalnız 20 tikte bir örneklendiğinden gerçek ilk-sapma tik'i hash'in gösterdiğinden ERKEN olabilir.)
    if (process.argv.includes('--divdiag')) {
        createWindow();
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await new Promise(r => setTimeout(r, 1400));
            const out = await js(`(() => { try {
                const N = 470;
                // HİPOTEZ TESTİ: --nomicro ile Unit.update'in KONTROLÖR-OKUYAN mikro bloğu kapatılır.
                // Sapma kayboluyorsa kök-neden kanıtlanır (sim, replay'de var olmayan canlı kontrolör durumunu okuyor).
                if (${process.argv.includes('--nomicro')}) { BATTLE_UNIT_MICRO = false; BATTLE_POSTURE_GATE = false; }   // let-bağlantısı: window'a yazmak İŞE YARAMAZ
                const izle = (u) => ({ id:u.id, tx:Math.round((u.targetX??u.x)*100)/100, ty:Math.round((u.targetY??u.y)*100)/100,
                    x:Math.round(u.x*100)/100, y:Math.round(u.y*100)/100, ammo:Math.round((u.ammo||0)*100)/100,
                    mm:!!u.isMovingToManualTarget, mt:(u.manualTarget?u.manualTarget.id:0),
                    at:(u.attackTarget&&!u.attackTarget.dead)?u.attackTarget.id:0, cs:u.combatState||null,
                    lat:Math.round(u.lastAttackTime||0), rev:Math.round(u.revealTimer||0) });
                const trace = (WATCH) => { const m = {}; for (const u of SIM.units) if (WATCH.includes(u.id) && !u.dead) m[u.id] = izle(u); return m; };
                // ── 1) CANLI ──
                openBattlefieldSession({ mode:'quick', mapId:-2, seed:2024, attackerSide:true, durationSec:300, playerMoney:5000, enemyMoney:5000, deployRes:null, deployPool:null, techBonus:null, techBonusRed:null, show:false });
                battleDeployManifest(battleBuildArmyManifest(5000, { maxUnits: 40, combatFocused: true }), false, { source:'divdiag-blue' });
                startBattle(); window.requestAnimationFrame = () => 0; SIM.headless = true;
                const WATCH = SIM.units.map(u => u.id);   // TÜM birimler — dar liste gerçek ilk-sapmayı kaçırıyordu
                const canliIz = {};
                for (let i = 0; i < N && phase === PHASE.BATTLE; i++) {
                    simulationTime += BATTLE_TICK_MS; gameTime += BATTLE_TICK_SEC;
                    stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false);
                    updateSupport(BATTLE_TICK_SEC, simulationTime);
                    canliIz[SIM.tick] = trace(WATCH);
                }
                const rec = exportBattleReplay();
                const canliSonTick = SIM.tick;
                // ── 2) REPLAY (aynı tik sayısı, aynı iz) ──
                startBattleReplay(replayClone({ version:rec.version, engineVersion:rec.engineVersion, session:rec.session, initialState:rec.initialState, events:rec.events, hashes:rec.hashes }));
                const repIz = {};
                for (let i = 0; i < N && phase === PHASE.BATTLE; i++) {
                    simulationTime += BATTLE_TICK_MS; gameTime += BATTLE_TICK_SEC;
                    stepSim(simulationTime, BATTLE_TICK_SEC, battleReplayDrive, false);
                    updateSupport(BATTLE_TICK_SEC, simulationTime);
                    repIz[SIM.tick] = trace(WATCH);
                }
                // ── 3) İLK AYRIŞAN TİK ──
                const alanlar = ['tx','ty','x','y','ammo','mm','mt','at','cs','lat','rev'];
                let ilk = null;
                for (let t = 1; t <= Math.min(canliSonTick, N) && !ilk; t++) {
                    const a = canliIz[t], b = repIz[t]; if (!a || !b) continue;
                    for (const id of WATCH) {
                        const ua = a[id], ub = b[id];
                        if (!ua !== !ub) { ilk = { tick:t, id, fark:'varlik' }; break; }
                        if (!ua) continue;
                        for (const f of alanlar) if (ua[f] !== ub[f]) { ilk = { tick:t, id, alan:f, canli:ua[f], replay:ub[f] }; break; }
                        if (ilk) break;
                    }
                }
                const pencere = [];
                if (ilk) for (let t = Math.max(1, ilk.tick - 3); t <= Math.min(canliSonTick, ilk.tick + 2); t++) {
                    pencere.push({ tick:t, canli: canliIz[t] ? canliIz[t][ilk.id] : null, replay: repIz[t] ? repIz[t][ilk.id] : null });
                }
                const emirler = (rec.events || []).filter(e => ilk && e.tick >= ilk.tick - 25 && e.tick <= ilk.tick + 2)
                    .map(e => ({ tick:e.tick, tur:e.type, emir:(e.payload||{}).kind||null, veren:(e.payload||{}).issuedBy||null,
                        birimler:((e.payload||{}).unitIds||[]).filter(x => WATCH.includes(x)),
                        hedefler:((e.payload||{}).destinations||[]).filter(x => WATCH.includes(x.id)).map(x=>({id:x.id,x:Math.round(x.x),y:Math.round(x.y)})) }))
                    .filter(e => e.birimler.length || e.hedefler.length);
                return { izlenen: WATCH, canliSonTick, ilkAyrisma: ilk, pencere, emirler };
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,500) }; } })()`);
            console.log('DIVDIAG ' + JSON.stringify(out));
            console.log('DIVDIAG_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // DEFERRED-DAMAGE SOAK: `--defersoak [--seeds a,b,c]` → ÇOKLU-TOHUM determinizm + invaryant taraması.
    // Her tohumda: (1) kuyruk invaryantları, (2) UÇUŞTAKİ-MERMİLİ FORK-EŞİTLİĞİ (fork sınırı kuyruk DOLUYKEN alınır →
    // pendingHits serialize/restore doğru mu), (3) hedefin uçuşta kaçtığı AoE sayısı (mermi boş araziye düşüyor mu).
    if (process.argv.includes('--defersoak')) {
        const _si = process.argv.indexOf('--seeds');
        const SEEDS = (_si >= 0 && process.argv[_si + 1] && !process.argv[_si + 1].startsWith('--'))
            ? process.argv[_si + 1].split(',').map(s => parseInt(s, 10)).filter(n => Number.isFinite(n))
            : [2024, 777, 909, 3141, 5150];
        createWindow();
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await new Promise(r => setTimeout(r, 1400));
            const out = await js(`(() => { try {
                const SEEDS = ${JSON.stringify(SEEDS)};
                const rapor = [];
                for (const seed of SEEDS) {
                    // FORK-TEMİZ senaryo (--forktest ile aynı: ai-lab) — quick-match+manifest yolunda fork-eşitliği
                    // deferred-damage'tan BAĞIMSIZ olarak zaten bozuk (kuyruk boşken de sapıyor: kontrolör/oturum durumu
                    // fork'a girmiyor). Burada pendingHits'in fork-serileştirmesini TEMİZ zeminde sınıyoruz.
                    openAIVsAILab({ start:true, show:false, durationSec:300, seed, budget:3000 }); SIM.headless = true;
                    window.requestAnimationFrame = () => 0;
                    const S = { denetim:true, giren:0, inen:0, bosaGiden:0, patlayan:0, bosAlan:0, badEarly:0, badSameTick:0, badLate:0, maxKuyruk:0 };
                    const arr = SIM.pendingHits;
                    const origPush = Array.prototype.push.bind(arr);
                    arr.push = (...hs) => {
                        if (S.denetim) for (const h of hs) {
                            S.giren++;
                            const f = h.arriveTick - (SIM.tick || 0);
                            if (f < 1) S.badEarly++;
                            if (h.arriveTick <= h.fireTick) S.badSameTick++;
                        }
                        return origPush(...hs);
                    };
                    const oD = applyDirectHit, oB = applyBlast;
                    window.applyDirectHit = function (hit, now) {
                        if (S.denetim) { if ((SIM.tick||0) !== hit.arriveTick) S.badLate++; const t = battleUnitById(hit.tgtId); if (!t || t.dead) S.bosaGiden++; else S.inen++; }
                        return oD(hit, now);
                    };
                    window.applyBlast = function (hit, now) {
                        if (S.denetim) {
                            if ((SIM.tick||0) !== hit.arriveTick) S.badLate++;
                            S.patlayan++;
                            let n = 0;   // hasar-yarıçapında düşman var mı? yoksa mermi BOŞ ARAZİYE düştü (hedef uçuşta kaçtı)
                            for (const u of SIM.spatialGrid.getNearby(hit.cx, hit.cy, hit.blastR)) {
                                if (u.dead || u.isRed === hit.atkIsRed || u.abandoned) continue;
                                if (Math.hypot(u.x - hit.cx, u.y - hit.cy) <= hit.blastR) { n++; break; }
                            }
                            if (!n) S.bosAlan++;
                        }
                        return oB(hit, now);
                    };
                    // KONTROLÖR NOTU: battleForkCapture SİM durumunu kaydeder, AI-kontrolörünün İÇ HAFIZASINI değil.
                    // Bu yüzden fork-eşitliği (--forktest ile aynı yöntem) kontrolör KAPALI pompalanır — ölçülen şey
                    // sim-durumunun (birimler + uçuştaki mermiler) fork sınırından birebir geçip geçmediği.
                    const pump = (n, useAi) => { const drv = useAi ? battleControllersDrive : null; for (let i=0;i<n && phase===PHASE.BATTLE;i++){ simulationTime+=BATTLE_TICK_MS; gameTime+=BATTLE_TICK_SEC; stepSim(simulationTime, BATTLE_TICK_SEC, drv, false); updateSupport(BATTLE_TICK_SEC, simulationTime); if (arr.length > S.maxKuyruk) S.maxKuyruk = arr.length; if (SIM.battle && SIM.battle.winnerSide !== null) return false; } return true; };
                    // FORK-EŞİTLİĞİ ölçer: A) orijinal devam  B) fork'tan devam → hash dizileri birebir olmalı
                    const forkParity = () => {
                        S.denetim = false;                          // fork/restore sayaçları kirletmesin
                        const fork = battleForkCapture();
                        const hA = []; for (let i=0;i<400;i+=20){ pump(20, false); hA.push(battleStateHash()); }
                        battleForkRestore(replayClone(fork));
                        const hB = []; for (let i=0;i<400;i+=20){ pump(20, false); hB.push(battleStateHash()); }
                        S.denetim = true;
                        for (let k=0;k<hA.length;k++) if (hA[k] !== hB[k]) return { adim:k, A:hA[k], B:hB[k] };
                        return null;
                    };
                    // 1) Kuyruk DOLUYKEN fork (asıl sınav: uçuştaki mermi fork sınırından geçiyor mu)
                    let bekle = 0; while (arr.length === 0 && bekle < 2000 && phase === PHASE.BATTLE) { pump(10, true); bekle += 10; }
                    const forkKuyruk = arr.length, forkTick = SIM.tick;
                    const forkSapma = forkParity();
                    // 2) İZOLASYON: kuyruk BOŞKEN fork — burada da sapıyorsa sorun deferred-damage'ta DEĞİL (senaryo/kontrolör)
                    let bos = 0; while (arr.length > 0 && bos < 300 && phase === PHASE.BATTLE) { pump(5, true); bos += 5; }
                    const bosForkKuyruk = arr.length, bosForkTick = SIM.tick;
                    const bosForkSapma = (bosForkKuyruk === 0) ? forkParity() : 'kuyruk-bosalmadi';
                    // 3) Kalan savaşı invaryant denetimiyle koştur
                    // SAYAÇ NOTU: fork fazlarında denetim kapalı olduğundan inen+patlayanAoE toplamı giren'i birkaç adım aşabilir
                    // (fork-restore, denetim kapalıyken kuyruğa geri koyduğu vuruşlar sonra sayılan bir varış üretir). Kaçak değil.
                    pump(1500, true);
                    delete arr.push; window.applyDirectHit = oD; window.applyBlast = oB;
                    rapor.push({ seed, forkTick, forkKuyrukDolu: forkKuyruk, forkEsit: !forkSapma, forkSapma,
                        bosKuyrukFork: { tick: bosForkTick, kuyruk: bosForkKuyruk, esit: bosForkSapma === null, sapma: bosForkSapma },
                        giren: S.giren, inen: S.inen, bosaGiden: S.bosaGiden, patlayanAoE: S.patlayan, bosAraziyeDusen: S.bosAlan,
                        ihlal: { firlatmaTikindeHasar: S.badEarly + S.badSameTick, yanlisTiktaVaris: S.badLate }, maxKuyruk: S.maxKuyruk, sonTick: SIM.tick });
                }
                return rapor;
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,400) }; } })()`);
            console.log('DEFERSOAK ' + JSON.stringify(out));
            const ok = Array.isArray(out) && out.length > 0 && out.every(r =>
                r.forkEsit && r.forkKuyrukDolu > 0 && r.giren > 0 && r.ihlal.firlatmaTikindeHasar === 0 && r.ihlal.yanlisTiktaVaris === 0);
            console.log(ok ? 'DEFERSOAK_OK' : 'DEFERSOAK_FAIL');
            setTimeout(() => app.exit(ok ? 0 : 1), 300);
        });
        return;
    }

    // DEFERRED-DAMAGE KAPISI: `--defertest` → "mermi ulaşmadan HİÇBİR birimde hasar olmasın" iddiasını ÖLÇER.
    // Kuyruğa giren her vuruşun uçuş-süresi ≥1 tik mi (badEarly), varış tam arriveTick'te mi (badLate), fırlatma-tik'inde
    // hasar var mı (badSameTick); ayrıca uçuş-tik dağılımı + fizzle (hedef uçuşta öldü) + kuyruk derinliği raporlanır.
    if (process.argv.includes('--defertest')) {
        createWindow();
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await new Promise(r => setTimeout(r, 1400));
            const res = await js(`(() => { try {
                // TAM ORDU (40 birim, 5000₺) → tank/ZMA/topçu/helo dahil YOĞUN temas: her silah sınıfı kuyruktan geçsin
                openBattlefieldSession({ mode:'quick', mapId:-2, seed:2024, attackerSide:true, durationSec:240, playerMoney:5000, enemyMoney:5000, deployRes:null, deployPool:null, techBonus:null, techBonusRed:null, show:false });
                battleDeployManifest(battleBuildArmyManifest(5000, { maxUnits: 40, combatFocused: true }), false, { source: 'defertest-blue' });
                startBattle(); window.requestAnimationFrame = () => 0; SIM.headless = true;
                const S = { kuyrugaGiren:0, inen:0, bosaGiden:0, patlayan:0, onlenen:0, badKill:0, badOnlenenPatladi:0, badEarly:0, badSameTick:0, badLate:0, maxKuyruk:0,
                            ucusMin:1e9, ucusMax:0, ucusToplam:0, tipDagilim:{} };
                const arr = SIM.pendingHits || [];
                const origPush = Array.prototype.push.bind(arr);
                arr.push = (h) => {                                   // FIRLATMA denetimi
                    S.kuyrugaGiren++;
                    const f = h.arriveTick - (SIM.tick || 0);
                    if (f < 1) S.badEarly++;                          // aynı tik'te inecek mermi = İHLAL
                    if (h.arriveTick <= h.fireTick) S.badSameTick++;
                    if (h.killTick != null) { S.onlenen++; if (h.killTick <= (SIM.tick||0) || h.killTick > h.arriveTick) S.badKill++; }   // kesişme fırlatmadan SONRA, varıştan ÖNCE/EŞİT olmalı
                    S.ucusToplam += f; if (f < S.ucusMin) S.ucusMin = f; if (f > S.ucusMax) S.ucusMax = f;
                    const k = (typeof UNIT_ID_BY_INDEX !== 'undefined' && UNIT_ID_BY_INDEX[h.atkType]) || ('t' + h.atkType);
                    (S.tipDagilim[k] = S.tipDagilim[k] || { n:0, ucus:0 }).n++; S.tipDagilim[k].ucus += f;
                    return origPush(h);
                };
                const origApply = (typeof applyDirectHit === 'function') ? applyDirectHit : null;
                if (origApply) window.applyDirectHit = function (hit, now) {          // TEK-HEDEF varış denetimi
                    if ((SIM.tick || 0) !== hit.arriveTick) S.badLate++;   // erken/geç uygulama = İHLAL
                    const t = battleUnitById(hit.tgtId);
                    if (!t || t.dead) S.bosaGiden++; else S.inen++;
                    return origApply(hit, now);
                };
                const origBlast = (typeof applyBlast === 'function') ? applyBlast : null;
                if (origBlast) window.applyBlast = function (hit, now) {              // AoE varış denetimi
                    if ((SIM.tick || 0) !== hit.arriveTick) S.badLate++;
                    if (hit.killTick != null) S.badOnlenenPatladi++;                  // ÖNLENEN mermi hasar veremez = İHLAL
                    S.patlayan++;
                    return origBlast(hit, now);
                };
                const bas = { mavi: SIM.units.filter(u=>!u.dead&&!u.isRed).length, kirmizi: SIM.units.filter(u=>!u.dead&&u.isRed).length };
                for (let i = 0; i < 4000 && phase === PHASE.BATTLE; i++) {
                    simulationTime += BATTLE_TICK_MS; gameTime += BATTLE_TICK_SEC;
                    stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false);
                    updateSupport(BATTLE_TICK_SEC, simulationTime);
                    if (arr.length > S.maxKuyruk) S.maxKuyruk = arr.length;
                    if (SIM.battle && SIM.battle.winnerSide !== null) break;
                }
                const tip = {}; for (const k in S.tipDagilim) tip[k] = { atis: S.tipDagilim[k].n, ortUcusTik: +(S.tipDagilim[k].ucus / S.tipDagilim[k].n).toFixed(2) };
                const olay = {}; for (const e of ((typeof BATTLE_FORENSIC!=='undefined'&&BATTLE_FORENSIC.buf)||[])) olay[e.kind] = (olay[e.kind]||0)+1;
                // DETERMİNİZM ÖLÇÜMÜ (RAPOR, kapı DEĞİL): aynı ağır-savaşı replay et. NOT: bu senaryoda canlı↔replay
                // sapması deferred-damage'tan ÖNCE de vardı (ölçüldü: taban ~tik 480) → ayrı bir hata; burada yalnız
                // GERİLEME takibi için raporlanır. Sıkı determinizm kapısı --forktest (fork-eşitliği, temiz).
                delete arr.push;   // enstrümantasyonu kaldır (replay temiz koşsun)
                if (origApply) window.applyDirectHit = origApply;
                if (origBlast) window.applyBlast = origBlast;
                // ARAZİ PARMAK-İZİ: replay AYNI haritayı mı üretiyor? (terrainSafePoint araziye bağlı → arazi saparsa hedefler sapar)
                const araziIzi = () => { try { if (typeof terrainGrid === 'undefined' || !terrainGrid) return 'yok';
                    let h = 2166136261 >>> 0; for (let i = 0; i < terrainGrid.length; i++) { h ^= terrainGrid[i]; h = Math.imul(h, 16777619) >>> 0; }
                    return (h >>> 0).toString(16) + ':' + terrainGrid.length + ':' + (typeof MAP_MODE !== 'undefined' ? MAP_MODE : '?'); } catch(e){ return 'hata'; } };
                const canliArazi = araziIzi();
                const rec = exportBattleReplay();
                const canliHash = (rec.hashes || []).map(h => ({ tick: h.tick, hash: h.hash }));
                const rr = runBattleReplayTicks({ version: rec.version, engineVersion: rec.engineVersion, session: rec.session, initialState: rec.initialState, events: rec.events, hashes: rec.hashes });
                const repMap = new Map((rr.hashes || []).map(h => [h.tick, h.hash]));
                let sapma = null;
                for (const h of canliHash) { if (repMap.has(h.tick) && repMap.get(h.tick) !== h.hash) { sapma = { tick: h.tick, canli: h.hash, replay: repMap.get(h.tick) }; break; } }
                // TEŞHİS: sapma tik'inde hangi hash-PARÇASI (g=global/rng, b=savaş, u=birimler, t=arazi/mayın, s=destek+uçuştaki-mermiler)
                // ayrışıyor + o tik'te hangi birim alanları farklı. Replay sapma anında durduğu için canlı durum SIM'de duruyor.
                let parcaFark = null, birimFark = null;
                if (sapma) {
                    const smp = ((rec.telemetry && rec.telemetry.samples) || []).find(s => s.tick === sapma.tick);
                    if (smp && smp.hashParts && typeof battleStateHashParts === 'function') {
                        const lp = battleStateHashParts(); parcaFark = {};
                        for (const k of ['g','b','u','t','s']) if (smp.hashParts[k] !== lp[k]) parcaFark[k] = { canli: smp.hashParts[k], replay: lp[k] };
                    }
                    if (smp && smp.units) {
                        const recU = new Map(smp.units.map(u => [u.id, u])); birimFark = []; const sapanIds = [];
                        for (const u of SIM.units) {
                            const r = recU.get(u.id); if (!r) { birimFark.push({ id: u.id, fark: 'replay-fazla' }); continue; }
                            const d = {}; const c = (k, rv, lv) => { const a = Math.round((rv ?? 0) * 100), b = Math.round((lv ?? 0) * 100); if (a !== b) d[k] = { canli: a / 100, replay: b / 100 }; };
                            const e = (k, rv, lv) => { if ((rv ?? null) !== (lv ?? null)) d[k] = { canli: rv, replay: lv }; };
                            c('x', r.x, u.x); c('y', r.y, u.y); c('hp', r.hp, u.hp); c('ammo', r.ammo, u.ammo); c('suppression', r.suppression, u.suppression);
                            c('targetX', r.targetX, u.targetX); c('targetY', r.targetY, u.targetY);
                            e('owner', r.owner || null, u.controlOwner || null); e('controllerId', r.controllerId || null, u.controllerId || null);
                            e('attackTargetId', r.attackTargetId || 0, (u.attackTarget && !u.attackTarget.dead) ? u.attackTarget.id : 0);
                            e('manuelHareket', !!r.isMovingToManualTarget, !!u.isMovingToManualTarget); e('combatState', r.combatState || null, u.combatState || null);
                            if (Object.keys(d).length) { sapanIds.push(u.id); birimFark.push({ id: u.id, tip: (typeof UNIT_ID_BY_INDEX !== 'undefined' ? UNIT_ID_BY_INDEX[u.type] : u.type), taraf: u.isRed?'red':'blue', ...d }); }
                        }
                        // SAPAN BİRİMLERE AİT KAYITLI EMİRLER (sapma penceresinde): emir var mı, hedefi ne, hangi kontrolör verdi
                        const pencere = (rec.events || []).filter(ev => ev.tick >= sapma.tick - 80 && ev.tick <= sapma.tick).map(ev => {
                            const p = ev.payload || {};
                            const ilgili = (p.destinations || []).filter(x => sapanIds.includes(x.id)).map(x => ({ id:x.id, x:Math.round(x.x), y:Math.round(x.y) }));
                            const idler = (p.unitIds || []).filter(x => sapanIds.includes(x));
                            if (!ilgili.length && !idler.length) return null;
                            return { tick: ev.tick, tur: ev.type, emir: p.kind || null, veren: p.issuedBy || null, hedefler: ilgili, birimler: idler };
                        }).filter(Boolean);
                        birimFark = { sapanBirim: birimFark.length, ornek: birimFark.slice(0, 4), sapanIds, pencereEmirleri: pencere.slice(-8), pencereEmirSayisi: pencere.length };
                    }
                }
                const replayArazi = araziIzi();
                // Replay bağlamında, kayıtlı emir-hedeflerinin terrainSafePoint sonucu ne? (canlı değerle karşılaştır)
                let safePointDeneme = null;
                if (sapma && birimFark && birimFark.pencereEmirleri) {
                    const son = [...birimFark.pencereEmirleri].reverse().find(e => e.hedefler && e.hedefler.length);
                    if (son) safePointDeneme = son.hedefler.map(h => { const s = terrainSafePoint(h.x, h.y); return { id: h.id, istenen: [h.x, h.y], replaySafe: [Math.round(s.x), Math.round(s.y)] }; });
                }
                const determinizm = { hashSayisi: canliHash.length, karsilastirilan: canliHash.filter(h => repMap.has(h.tick)).length, ilkSapma: sapma,
                    arazi: { canli: canliArazi, replay: replayArazi, ayni: canliArazi === replayArazi }, safePointDeneme, parcaFark, birimFark };
                return { tick: SIM.tick, ordu: bas, son: { mavi: SIM.units.filter(u=>!u.dead&&!u.isRed).length, kirmizi: SIM.units.filter(u=>!u.dead&&u.isRed).length }, olay,
                    kuyrugaGiren: S.kuyrugaGiren, inen: S.inen, bosaGiden: S.bosaGiden, patlayanAoE: S.patlayan, havadaOnlenen: S.onlenen,
                    ihlal: { firlatmaTikindeHasar: S.badEarly + S.badSameTick, yanlisTiktaVaris: S.badLate,
                             gecersizKesisme: S.badKill, onlenenMermiPatladi: S.badOnlenenPatladi },
                    ucusTik: { min: S.kuyrugaGiren ? S.ucusMin : 0, max: S.ucusMax, ort: S.kuyrugaGiren ? +(S.ucusToplam / S.kuyrugaGiren).toFixed(2) : 0 },
                    maxKuyruk: S.maxKuyruk, kuyrukKalan: arr.length, tipDagilim: tip, determinizm };
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,400) }; } })()`);
            console.log('DEFERTEST ' + JSON.stringify(res));
            const ok = res && !res.err && res.ihlal && res.ihlal.firlatmaTikindeHasar === 0 && res.ihlal.yanlisTiktaVaris === 0 &&
                res.ihlal.gecersizKesisme === 0 && res.ihlal.onlenenMermiPatladi === 0 && res.kuyrugaGiren > 0;
            console.log(ok ? 'DEFERTEST_OK' : 'DEFERTEST_FAIL');
            setTimeout(() => app.exit(ok ? 0 : 1), 300);
        });
        return;
    }

    // THROUGHPUT BENCHMARK: `--benchmark` → headless tick hızı + fork(capture/restore) maliyeti ölçer,
    // karşı-olgusal eğitim örneğinin gerçek maliyetini ve 10k örnek süresini türetir (Faz 0/2).
    if (process.argv.includes('--benchmark')) {
        createWindow();
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await new Promise(r => setTimeout(r, 1400));
            const res = await js(`(() => { try {
                const now = () => performance.now();
                const pump = n => { for (let i=0;i<n && phase===PHASE.BATTLE;i++){ simulationTime+=BATTLE_TICK_MS; gameTime+=BATTLE_TICK_SEC; stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false); updateSupport(BATTLE_TICK_SEC, simulationTime); } };
                // kur + orta-savaşa ilerle (temas), sonra durumu yakala
                openAIVsAILab({ start: true, show: false, durationSec: 240 }); SIM.headless = true;
                pump(300);
                battleCaptureInitialState(); const snap = replayClone(BATTLE_REPLAY.initialState);
                // 1) HAM THROUGHPUT: N tik koş (savaş biterse gerçek tik say)
                const t0 = now(); const startTick = SIM.tick; pump(4000); const ranT = SIM.tick - startTick; const ms1 = now()-t0;
                const ticksPerSec = ranT/(ms1/1000); const xRealtime = ticksPerSec/20;   // gerçek-zaman = 20 tik/sn
                // 2) FORK maliyeti (capture + clone + restore)
                let fc=0; const F=50; for (let i=0;i<F;i++){ const a=now(); battleCaptureInitialState(); const s=replayClone(BATTLE_REPLAY.initialState); battleRestoreInitialState(s); fc+=now()-a; }
                const forkMs = fc/F;
                // 3) ROLLOUT maliyeti (restore + 600 tik = 30 sn sim)
                let rc=0; const R=12; for (let i=0;i<R;i++){ battleRestoreInitialState(replayClone(snap)); const a=now(); pump(600); rc+=now()-a; }
                const rolloutMs = rc/R;
                // 4) TÜRETİLEN maliyetler
                const rolloutsPerExample = 32*6;                       // 32 aday × 6 gizli-durum varyasyonu
                const exampleMs = rolloutsPerExample * rolloutMs;
                const ex10kHours = (10000 * exampleMs) / 3.6e6;
                const round = x => Math.round(x*100)/100;
                return {
                    hamThroughput: { kosanTik: ranT, ms: round(ms1), tikSaniye: Math.round(ticksPerSec), xGercekZaman: round(xRealtime) },
                    forkMs: round(forkMs), rolloutMs_600tik: round(rolloutMs),
                    ornekBasi: { rollout: rolloutsPerExample, ms: Math.round(exampleMs), saniye: round(exampleMs/1000) },
                    on10kOrnek: { tekProses_saat: round(ex10kHours), '8paralel_saat': round(ex10kHours/8) },
                    rolloutSaniye: Math.round(1000/rolloutMs*100)/100
                };
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,400) }; } })()`);
            console.log('BENCHMARK ' + JSON.stringify(res));
            console.log('BENCHMARK_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // CANLI-REPRO: `--liverepro` → CANLI yolu (headless=false, spawnDeathVfx=true, AI sürücü) taklit
    // ederek bir savaş kaydeder, sonra AYNI kaydı replay eder (spawnDeathVfx=false) ve sapma tik'inde
    // hangi hash bileşeninin (özellikle SIM_RNG.state) ayrıldığını kesin gösterir.
    if (process.argv.includes('--liverepro')) {
        createWindow();
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        const _PB = process.argv.includes('--playerblue'), _NI = process.argv.includes('--noinject');
        win.webContents.on('did-finish-load', async () => {
            await new Promise(r => setTimeout(r, 1400));
            const res = await js(`(() => { try {
                // 1) Savaşı kur (AI vs AI) ve CANLI yolu taklit et
                openAIVsAILab({ start: true, show: false, durationSec: 240 });
                SIM.headless = false;                       // CANLI: render/VFX açık
                // GERÇEK MAÇ TAKLİDİ: mavi'yi OYUNCU-sahipli yap (blue-ally-ai fantom → guard atlar, komut vermez)
                if (${_PB}) {
                    for (const u of SIM.units) if (!u.dead && !u.isRed) { u.controlOwner = (typeof CONTROL_OWNER!=='undefined'?CONTROL_OWNER.PLAYER:'PLAYER'); u.controllerId = null; }
                    if (typeof battleControllersSyncOwnership === 'function') battleControllersSyncOwnership();
                }
                const noInject = ${_NI};
                const liveRng = {};                         // tick → SIM_RNG.state
                const N = 1600;
                const blueIds = SIM.units.filter(u => !u.dead && !u.isRed).slice(0, 4).map(u => u.id);
                let injected = 0;
                for (let i = 0; i < N && phase === PHASE.BATTLE; i++) {
                    // OYUNCU KOMUT ENJEKSİYONU (kuyruk üzerinden): kuyruk stepSim başında flush olur → tik-sınırı
                    if (!noInject && (i === 40 || i === 90 || i === 140) && blueIds.length) {
                        pendingPlayerCommands.push({ type: 'player-move', payload: {
                            unitIds: blueIds, x: 900, y: 1150 + i,
                            destinations: blueIds.map((id, k) => ({ id, x: 900 + k * 40, y: 1150 + i }))
                        } });
                        injected++;
                    }
                    simulationTime += BATTLE_TICK_MS; gameTime += BATTLE_TICK_SEC;
                    stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, true);  // spawnDeathVfx=TRUE (canlı)
                    updateSupport(BATTLE_TICK_SEC, simulationTime);
                    if ((SIM.tick % 20) === 0) liveRng[SIM.tick] = SIM_RNG.state >>> 0;
                    if (SIM.battle && SIM.battle.winnerSide !== null) break;
                }
                const rec = exportBattleReplay();
                const liveHashes = (rec.hashes || []).map(h => ({ tick: h.tick, hash: h.hash }));
                // 2) Aynı kaydı REPLAY et (spawnDeathVfx=false)
                const rr = runBattleReplayTicks(rec);
                const repMap = new Map((rr.hashes || []).map(h => [h.tick, h.hash]));
                const repRng = SIM_RNG.state >>> 0;         // replay sonu RNG
                // 3) İlk sapma + o tik'te live vs replay RNG
                let firstDiv = null;
                for (const h of liveHashes) { if (repMap.has(h.tick) && repMap.get(h.tick) !== h.hash) { firstDiv = { tick: h.tick, live: h.hash, replay: repMap.get(h.tick) }; break; } }
                const playerMoveEvents = (rec.events || []).filter(e => e.type === 'player-move').length;
                return { liveHeadless:false, kayitTick: SIM.tick, liveHashCount: liveHashes.length,
                    enjekteKomut: injected, kayittakiPlayerMove: playerMoveEvents,
                    firstDivergence: firstDiv, divergenceVarMi: !!firstDiv, replayDriverDiverge: rr.divergence };
            } catch(e){ return { err: e.message, stack:(e.stack||'').slice(0,400) }; } })()`);
            console.log('LIVEREPRO ' + JSON.stringify(res));
            console.log('LIVEREPRO_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // ORACLE TAVAN TESTİ: `--oracletest` → savaş kur, temas noktalarına ilerle, her noktada TÜM gramer
    // adaylarını rollout et + varsayılan kod-AI'ı rollout et → regret = oracle − chosen. Ortalama regret
    // büyükse ML eğitimi GO (gramer+rollout anlamlı fark üretiyor), ≈0 ise NO-GO. (SAVAS-AI-PLAN §3A)
    if (process.argv.includes('--oracletest')) {
        const oi = process.argv.indexOf('--oracletest');
        const rolloutSec = parseFloat(process.argv[oi + 1]) || 20;
        const decisionTicks = (process.argv[oi + 2] || '500,700,900').split(',').map(n => parseInt(n, 10));
        const forceRedAttacker = process.argv[oi + 3] === '1' || process.argv[oi + 3] === 'redattack';
        const seedCount = Math.max(1, Math.min(8, parseInt(process.argv[oi + 4] || '3', 10)));
        const SEEDS = [1001, 2002, 3003, 4004, 5005, 6006, 7007, 8008].slice(0, seedCount);
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            const evals = [];
            // TAZE MAÇ / eval (izole): her (seed, karar-noktası) için sıfırdan kur + o tik'e ilerle + değerlendir.
            // Böylece bir eval'in fork/restore artığı sonraki eval'i perturbe etmez (ana zaman çizgisi tekrar
            // kullanılmaz) → tekrarlanabilir, izole regret ölçümü.
            const setupJs = (SEED) => `(() => { try {
                openBattlefieldSession({ mode:'quick', mapId:-2, seed:${SEED}, attackerSide:${forceRedAttacker ? 'true' : 'false'}, durationSec:240, playerMoney:5000, enemyMoney:5000, deployRes:null, deployPool:null, techBonus:null, techBonusRed:null, show:false });
                const blueManifest = battleBuildArmyManifest(5000, { maxUnits: 40, combatFocused: true });
                battleDeployManifest(blueManifest, false, { source: 'oracle-blue' });
                startBattle();
                window.requestAnimationFrame = () => 0;
                return { seed: BATTLE_SESSION.seed, red: SIM.units.filter(u=>u.isRed&&!u.dead).length, blue: SIM.units.filter(u=>!u.isRed&&!u.dead).length, attackerSide: BATTLE_SESSION.attackerSide };
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,300) }; } })()`;
            for (const SEED of SEEDS) {
                for (const dt of decisionTicks) {
                    const setup = await js(setupJs(SEED));
                    if (setup && setup.err) { console.log('ORACLE_SETUP_HATA seed=' + SEED + ' tick=' + dt + ' ' + setup.err); continue; }
                    const adv = await js(`(() => { try {
                        const target = ${dt}; const ph = SIM.headless; SIM.headless = true;
                        try { while (SIM.tick < target && phase === PHASE.BATTLE) { simulationTime += BATTLE_TICK_MS; gameTime += BATTLE_TICK_SEC; stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, simulationTime); } } finally { SIM.headless = ph; }
                        return { tick: SIM.tick, phase: phase };
                    } catch(e){ return { err:e.message }; } })()`);
                    if (!adv || adv.err || adv.phase !== 'battle') { console.log('ORACLE_ATLA seed=' + SEED + ' tick=' + dt + ' ' + JSON.stringify(adv)); continue; }
                    const ev = await js(`(() => { try { return battleOracleEvaluate({ sideRed: true, rolloutSec: ${rolloutSec} }); } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,400) }; } })()`);
                    if (ev && ev.err) { console.log('ORACLE_EVAL_HATA seed=' + SEED + ' tick=' + dt + ' ' + ev.err); continue; }
                    ev.seed = SEED;
                    console.log('ORACLE_EVAL seed=' + SEED + ' tick=' + dt + ' regret=' + ev.regret + ' tavan=' + ev.regretCeiling + ' chosen=' + ev.chosen.scalar + ' oracle=' + (ev.oracle ? ev.oracle.scalar + '(' + ev.oracle.intent + ')' : '-') + ' aktif=' + ev.active + ' mesafe=' + ev.minEnemyDist);
                    evals.push(ev);
                }
            }
            // özet — YALNIZ "aktif" (temas/çarpışma olan) noktalar sayılır; temassız noktalarda regret anlamsız
            const active = evals.filter(e => e.active);
            if (active.length) {
                const signed = active.map(e => e.regret);
                const ceiling = active.map(e => e.regretCeiling);
                const avgSigned = signed.reduce((a, b) => a + b, 0) / signed.length;
                const avgCeiling = ceiling.reduce((a, b) => a + b, 0) / ceiling.length;
                const chosenAvg = active.reduce((a, e) => a + e.chosen.scalar, 0) / active.length;
                const oracleAvg = active.reduce((a, e) => a + (e.oracle ? e.oracle.scalar : 0), 0) / active.length;
                const beatCount = active.filter(e => e.regret > Math.max(20, Math.abs(e.chosen.scalar) * 0.12)).length;
                // TAVAN regret ana metrik (mükemmel seçici sürdürmeyi de seçebilir). Noktaların yarısında
                // anlamlı headroom + ortalama tavan yüksekse GO.
                const relCeiling = active.reduce((a, e) => a + (Math.abs(e.chosen.scalar) > 1 ? e.regretCeiling / Math.abs(e.chosen.scalar) : 0), 0) / active.length;
                const go = avgCeiling > 40 && (beatCount / active.length) >= 0.4;
                const verdict = go
                    ? 'GO — gramer+rollout, noktaların ' + beatCount + '/' + active.length + "'inde varsayılanı anlamlı yeniyor → seçici model eğitmek mantıklı"
                    : 'NO-GO — headroom yetersiz; önce gramer/rollout/ödül (ve mid-icra momentum sorunu) gözden geçir';
                console.log('ORACLE_OZET ' + JSON.stringify({
                    aktifNokta: active.length, toplamNokta: evals.length,
                    tavanRegretOrt: +avgCeiling.toFixed(1), isaretliRegretOrt: +avgSigned.toFixed(1), goreliTavan: +relCeiling.toFixed(2),
                    varsayilaniYenenNokta: beatCount, chosenOrt: +chosenAvg.toFixed(1), oracleOrt: +oracleAvg.toFixed(1),
                    tavanRegretler: ceiling, isaretliRegretler: signed, mesafeler: active.map(e => e.minEnemyDist), verdict
                }));
            } else if (evals.length) {
                console.log('ORACLE_OZET ' + JSON.stringify({ aktifNokta: 0, toplamNokta: evals.length, not: 'hiçbir karar noktasında çarpışma olmadı — karar tik\'lerini temas anına yaklaştır', mesafeler: evals.map(e => e.minEnemyDist) }));
            } else {
                console.log('ORACLE_OZET {"nokta":0,"not":"değerlendirme yapılamadı"}');
            }
            console.log('ORACLE_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // KAFA-KAFAYA: `--versus <redModel> <blueModel> <seedCount>` → red=modelA vs blue=modelB (ikisi de aktif).
    // Kim kazanıyor + kalan-kuvvet farkı. İki yönlü çalıştır (A-B, B-A) → rol dengelenir, adil karşılaştırma.
    if (process.argv.includes('--versus')) {
        const vi = process.argv.indexOf('--versus');
        const redFile = process.argv[vi + 1], blueFile = process.argv[vi + 2];
        const seedCount = Math.max(1, Math.min(16, parseInt(process.argv[vi + 3] || '6', 10)));
        let RED, BLUE;
        try { RED = JSON.parse(require('fs').readFileSync(redFile, 'utf8')); BLUE = JSON.parse(require('fs').readFileSync(blueFile, 'utf8')); }
        catch (e) { console.log('VERSUS_HATA ' + e.message); app.exit(1); return; }
        console.log('VERSUS red=' + require('path').basename(redFile) + ' vs blue=' + require('path').basename(blueFile));
        const SEEDS = Array.from({ length: seedCount }, (_, i) => 1001 + i * 1111);
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            let redW = 0, blueW = 0, draw = 0, sumDiff = 0, n = 0;
            for (const SEED of SEEDS) {
                const m = await js(`(() => { try {
                    openBattlefieldSession({ mode:'quick', mapId:-2, seed:${SEED}, attackerSide:true, durationSec:240, playerMoney:5000, enemyMoney:5000, deployRes:null, deployPool:null, techBonus:null, techBonusRed:null, show:false });
                    battleDeployManifest(battleBuildArmyManifest(5000, { maxUnits: 40, combatFocused: true }), false, { source: 'versus-blue' });
                    startBattle(); window.requestAnimationFrame = () => 0;
                    battleSelectorDisable();
                    battleSelectorEnableFor('battle-red-ai', ${JSON.stringify(RED)});
                    battleSelectorEnableFor('battle-blue-ally-ai', ${JSON.stringify(BLUE)});
                    BATTLE_SELECTOR_MIN_TICK = 500; BATTLE_SELECTOR_MAX_TICK = 999999;
                    const ph=SIM.headless; SIM.headless=true; let t=0; const maxT=Math.round(240/BATTLE_TICK_SEC);
                    try { while (t<maxT && phase===PHASE.BATTLE && !(SIM.battle && SIM.battle.winnerSide!==null && SIM.battle.winnerSide!==undefined)) { simulationTime+=BATTLE_TICK_MS; gameTime+=BATTLE_TICK_SEC; stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, simulationTime); t++; } } finally { SIM.headless=ph; }
                    battleSelectorDisable();
                    const red=battleOracleForceValue(true), blue=battleOracleForceValue(false);
                    const w=(SIM.battle && SIM.battle.winnerSide!==undefined)?SIM.battle.winnerSide:null;
                    return { diff: Math.round(red.effective-blue.effective), redWin: w===true, blueWin: w===false, decided: w!==null };
                } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,300) }; } })()`);
                if (m && m.err) { console.log('VERSUS_MAC_HATA seed=' + SEED + ' ' + m.err); continue; }
                n++; sumDiff += m.diff;
                if (m.redWin) redW++; else if (m.blueWin) blueW++; else draw++;
                console.log('VERSUS seed=' + SEED + ' fark(red-blue)=' + m.diff + ' kazanan=' + (m.redWin ? 'RED' : m.blueWin ? 'BLUE' : 'karar-yok'));
            }
            console.log('VERSUS_OZET ' + JSON.stringify({ mac: n, redGalibiyet: redW, blueGalibiyet: blueW, kararsiz: draw, ortFark_red_blue: n ? Math.round(sumDiff / n) : 0 }));
            console.log('VERSUS_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // SELF-PLAY TEST: `--selfplay <redModel> <blueModel> <seedCount>` → red=modelA, blue=modelB (model-vs-model).
    // Mavi-model kod-AI'dan daha zorlu bir rakip mi (red'in üstünlüğü düşüyor mu) ölçer → arms-race kanıtı.
    if (process.argv.includes('--selfplay')) {
        const pi = process.argv.indexOf('--selfplay');
        const redFile = process.argv[pi + 1] || require('path').join(__dirname, '..', 'qa-runtime', 'selector-model-v4.json');
        const blueFile = process.argv[pi + 2] || redFile;
        const seedCount = Math.max(1, Math.min(16, parseInt(process.argv[pi + 3] || '6', 10)));
        let RED, BLUE;
        try { RED = JSON.parse(require('fs').readFileSync(redFile, 'utf8')); BLUE = JSON.parse(require('fs').readFileSync(blueFile, 'utf8')); }
        catch (e) { console.log('SELFPLAY_MODEL_HATA ' + e.message); app.exit(1); return; }
        console.log('SELFPLAY red=' + require('path').basename(redFile) + ' blue=' + require('path').basename(blueFile));
        const SEEDS = Array.from({ length: seedCount }, (_, i) => 1001 + i * 1111);
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            // blueUsesModel: true → blue de model; false → blue kod-AI (kıyas baz)
            const runMatch = (SEED, blueUsesModel) => `(() => { try {
                openBattlefieldSession({ mode:'quick', mapId:-2, seed:${SEED}, attackerSide:true, durationSec:240, playerMoney:5000, enemyMoney:5000, deployRes:null, deployPool:null, techBonus:null, techBonusRed:null, show:false });
                battleDeployManifest(battleBuildArmyManifest(5000, { maxUnits: 40, combatFocused: true }), false, { source: 'selfplay-blue' });
                startBattle(); window.requestAnimationFrame = () => 0;
                battleSelectorDisable();
                battleSelectorEnableFor('battle-red-ai', ${JSON.stringify(RED)});
                if (${blueUsesModel ? 'true' : 'false'}) battleSelectorEnableFor('battle-blue-ally-ai', ${JSON.stringify(BLUE)});
                BATTLE_SELECTOR_MIN_TICK = 500; BATTLE_SELECTOR_MAX_TICK = 999999;
                const ph = SIM.headless; SIM.headless = true; let ticks=0; const maxT=Math.round(240/BATTLE_TICK_SEC);
                try { while (ticks < maxT && phase === PHASE.BATTLE && !(SIM.battle && SIM.battle.winnerSide !== null && SIM.battle.winnerSide !== undefined)) { simulationTime+=BATTLE_TICK_MS; gameTime+=BATTLE_TICK_SEC; stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, simulationTime); ticks++; } } finally { SIM.headless = ph; }
                battleSelectorDisable();
                const red = battleOracleForceValue(true), blue = battleOracleForceValue(false);
                const w = (SIM.battle && SIM.battle.winnerSide !== undefined) ? SIM.battle.winnerSide : null;
                return { diff: Math.round(red.effective - blue.effective), redWin: w===true, blueUsedModel:${blueUsesModel ? 'true' : 'false'} };
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,300) }; } })()`;
            const rows = [];
            for (const SEED of SEEDS) {
                const mm = await js(runMatch(SEED, true));    // red-model vs blue-MODEL
                const mc = await js(runMatch(SEED, false));   // red-model vs blue-kodAI
                if ((mm && mm.err) || (mc && mc.err)) { console.log('SELFPLAY_HATA seed=' + SEED + ' ' + JSON.stringify(mm && mm.err ? mm : mc)); continue; }
                rows.push({ seed: SEED, vsBlueModel: mm.diff, vsBlueCode: mc.diff, redWinVsModel: mm.redWin, redWinVsCode: mc.redWin });
                console.log('SELFPLAY seed=' + SEED + ' red-fark: vs-blue-MODEL=' + mm.diff + ' vs-blue-kodAI=' + mc.diff + ' (blue-model daha zorluysa fark DÜŞER)');
            }
            if (rows.length) {
                const avgVsModel = rows.reduce((a, r) => a + r.vsBlueModel, 0) / rows.length;
                const avgVsCode = rows.reduce((a, r) => a + r.vsBlueCode, 0) / rows.length;
                const winVsModel = rows.filter(r => r.redWinVsModel).length, winVsCode = rows.filter(r => r.redWinVsCode).length;
                console.log('SELFPLAY_OZET ' + JSON.stringify({
                    mac: rows.length, redFark_vsBlueModel: +avgVsModel.toFixed(0), redFark_vsBlueKodAI: +avgVsCode.toFixed(0),
                    redGalibiyet_vsModel: winVsModel, redGalibiyet_vsKod: winVsCode,
                    yorum: avgVsModel < avgVsCode - 100 ? 'blue-MODEL daha ZORLU rakip (arms-race işe yarar → self-play DAgger topla)' : 'blue-model ≈ kod-AI (rol-uyumsuzluğu olabilir; blue defender)'
                }));
            } else console.log('SELFPLAY_OZET {"mac":0}');
            console.log('SELFPLAY_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // ORDU ÇEŞİTLİLİĞİ TESTİ: `--varietytest` → farklı seed'lerde varied ordu kompozisyonu değişiyor mu (dengeli mi)
    if (process.argv.includes('--varietytest')) {
        createWindow();
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('did-finish-load', async () => {
            await new Promise(r => setTimeout(r, 1400));
            const out = await js(`(() => { try {
                const TN = { 0:'Piy', 1:'Mek', 2:'ZPiy', 3:'Keş', 4:'İst', 5:'Sağ', 6:'Tank', 7:'TnkSvr', 8:'Topçu' };
                const res = [];
                for (const seed of [1001, 2002, 3003, 4004, 5005]) {
                    resetSimRng(seed);
                    const m = battleBuildArmyManifest(1500, { maxUnits: 16, combatFocused: true, varied: true });
                    const comp = {}; for (const t of m.types) comp[TN[t]||t] = (comp[TN[t]||t]||0)+1;
                    res.push({ seed, birim: m.types.length, kompozisyon: comp });
                }
                // sabit (varied YOK) kıyas
                resetSimRng(1001); const fixed = battleBuildArmyManifest(1500, { maxUnits: 16, combatFocused: true });
                const fc = {}; for (const t of fixed.types) fc[TN[t]||t] = (fc[TN[t]||t]||0)+1;
                return { varied: res, sabit: fc };
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,300) }; } })()`);
            if (out && out.varied) {
                for (const v of out.varied) console.log('VT seed=' + v.seed + ' → ' + Object.entries(v.kompozisyon).map(([k, n]) => k + ':' + n).join(' '));
                console.log('VT SABİT → ' + Object.entries(out.sabit).map(([k, n]) => k + ':' + n).join(' '));
            } else console.log('VT ' + JSON.stringify(out));
            console.log('VARIETYTEST_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // KOÇ (Faz 7): `--coach [metrikDosyasi]` → Coder-14B'yi (llm-host) yükle, eğitim metriklerini ver,
    // sıradaki deney önerisini al + parse et. Genel narrator (Türkçe-Llama) DEĞİL — teknik/ML uzmanı koç.
    if (process.argv.includes('--coach')) {
        const ci = process.argv.indexOf('--coach');
        const coach = require('../js/BattleCoach.js');
        const coderPath = path.join(__dirname, '..', 'models', 'Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf');
        if (!require('fs').existsSync(coderPath)) { console.log('COACH_HATA Coder-14B yok (KOC-INDIR.bat çalıştır): ' + coderPath); app.exit(1); return; }
        // metrikler: dosyadan (production) veya örnek (test) — gerçek turnuva sonuçları
        let rounds = [{ round: 'v4', devRegret: 25, opponents: [{ budget: 1400, delta: 326 }, { budget: 1700, delta: 861 }, { budget: 1600, delta: -324 }] }];
        const mFile = process.argv[ci + 1];
        if (mFile && !mFile.startsWith('--')) { try { rounds = JSON.parse(require('fs').readFileSync(mFile, 'utf8')).rounds || rounds; } catch (e) {} }
        // gpuLayers: 'auto'|sayı|'cpu'. 14B 8GB VRAM'e sığmayabilir → az katman GPU + gerisi RAM, ya da CPU.
        let gpu = process.argv[ci + 2] || 'cpu';   // varsayılan CPU (14B 8GB VRAM'e sığmıyor; 16GB RAM'e sığar, offline koç için hız kritik değil)
        if (gpu === 'cpu') gpu = 0; else if (gpu !== 'auto') gpu = parseInt(gpu, 10);
        console.log('COACH_YUKLENIYOR Coder-14B gpuLayers=' + gpu + ' (~1-2 dk)...');
        const child = fork(path.join(__dirname, 'llm-host.js'), [], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
        const t0 = Date.now();
        child.on('message', m => {
            if (!m) return;
            if (m.t === 'error') { console.log('COACH_LLM_HATA ' + m.error); try { child.kill(); } catch (_) {} app.exit(1); }
            else if (m.t === 'loaded') {
                console.log('COACH_MODEL_YUKLENDI (' + ((Date.now() - t0) / 1000).toFixed(0) + 's)');
                child.send({ t: 'gen', id: 1, system: coach.BATTLE_COACH_SYSTEM, prompt: coach.battleCoachPrompt(rounds), maxTokens: 120, temperature: 0.3 });
            } else if (m.t === 'gen') {
                console.log('COACH_HAM_YANIT ' + JSON.stringify((m.text || m.error || '').slice(0, 400)));
                const proposal = coach.battleCoachParseProposal(m.text || '');
                console.log('COACH_ONERI ' + JSON.stringify(proposal));
                if (proposal) console.log('COACH_TUR_PARAM ' + JSON.stringify(coach.battleCoachProposalToRoundParams(proposal)));
                console.log('COACH_OK (' + ((Date.now() - t0) / 1000).toFixed(0) + 's toplam)');
                try { child.send({ t: 'stop' }); } catch (_) {}
                setTimeout(() => app.exit(0), 400);
            }
        });
        child.on('exit', () => { });
        child.send({ t: 'load', modelPath: coderPath, gpuLayers: gpu });
        return;
    }

    // KOÇ İZLE: `--coachwatch [matchFile]` → maçı KARE-KARE özete çevir + Coder-14B'ye 3.şahıs izlet → taktik analiz.
    // matchFile yoksa qa-runtime/last-match.json. Kullanıcı: "koç tüm oyunu 3.şahıs kare-kare izlesin".
    if (process.argv.includes('--coachwatch')) {
        const wi = process.argv.indexOf('--coachwatch');
        const watch = require('../js/BattleWatch.js');
        const coderPath = path.join(__dirname, '..', 'models', 'Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf');
        if (!require('fs').existsSync(coderPath)) { console.log('COACHWATCH_HATA Coder-14B yok (KOC-INDIR.bat): ' + coderPath); app.exit(1); return; }
        let matchFile = process.argv[wi + 1];
        if (!matchFile || matchFile.startsWith('--')) matchFile = path.join(__dirname, '..', 'qa-runtime', 'last-match.json');
        // ÇOKLU-MAÇ: `--coachwatch all` (veya bir klasör) → qa-runtime/matches/ içindeki SON N maçı birden izle
        // (kullanıcı: "koç sadece son maçı izliyor"). Toplu analiz + en-öğretici maçın kare-kare açılımı.
        const fs0 = require('fs');
        let digest, isMulti = false;
        const matchesDir = path.join(__dirname, '..', 'qa-runtime', 'matches');
        const wantAll = (matchFile === 'all') || (() => { try { return fs0.statSync(matchFile).isDirectory(); } catch (_) { return false; } })();
        if (wantAll) {
            const dir = (matchFile === 'all') ? matchesDir : matchFile;
            let files = [];
            try { files = fs0.readdirSync(dir).filter(f => /^match-\d+\.json$/.test(f)).sort(); } catch (_) {}
            if (!files.length) { console.log('COACHWATCH_HATA maç geçmişi boş: ' + dir + ' (birkaç maç oyna, sonra tekrar dene)'); app.exit(1); return; }
            const recs = [];
            for (const f of files) { try { recs.push(JSON.parse(fs0.readFileSync(path.join(dir, f), 'utf8'))); } catch (_) {} }
            digest = watch.battleMultiMatchDigest(recs); isMulti = true;
            console.log('COACHWATCH_COKLU ' + recs.length + ' maç yüklendi (' + dir + ')');
        } else {
            let recording = null;
            try { recording = JSON.parse(fs0.readFileSync(matchFile, 'utf8')); }
            catch (e) { console.log('COACHWATCH_HATA maç okunamadı: ' + matchFile + ' ' + e.message); app.exit(1); return; }
            digest = watch.battleMatchDigest(recording);
        }
        console.log('═══ KOÇA GİDEN KARE-KARE ÖZET ═══\n' + digest + '\n═══════════════════════════════\n');
        let gpu = process.argv[wi + 2] || 'cpu';
        if (gpu === 'cpu') gpu = 0; else if (gpu !== 'auto') gpu = parseInt(gpu, 10);
        console.log('COACHWATCH_YUKLENIYOR Coder-14B gpuLayers=' + gpu + ' (~1-2 dk yükleme + ~2-4 dk analiz)...');
        const child = fork(path.join(__dirname, 'llm-host.js'), [], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
        const t0 = Date.now();
        child.on('message', m => {
            if (!m) return;
            if (m.t === 'error') { console.log('COACHWATCH_LLM_HATA ' + m.error); try { child.kill(); } catch (_) {} app.exit(1); }
            else if (m.t === 'loaded') {
                console.log('COACHWATCH_MODEL_YUKLENDI (' + ((Date.now() - t0) / 1000).toFixed(0) + 's), analiz ediliyor...');
                child.send({ t: 'gen', id: 1, system: watch.BATTLE_WATCH_SYSTEM, prompt: (isMulti ? watch.battleMultiMatchPrompt(digest) : watch.battleWatchPrompt(digest)), maxTokens: 350, temperature: 0.4 });
            } else if (m.t === 'gen') {
                console.log('\n═══ KOÇUN ANALİZİ (3.şahıs) ═══\n' + (m.text || m.error || '(boş)') + '\n═══════════════════════════════');
                console.log('COACHWATCH_OK (' + ((Date.now() - t0) / 1000).toFixed(0) + 's toplam)');
                try { child.send({ t: 'stop' }); } catch (_) {}
                setTimeout(() => app.exit(0), 400);
            }
        });
        child.on('exit', () => { });
        // contextSize koçun uzun digest'ini (~1500 kelime) + 350 çıktı için: 2560. Çoklu-maç özet+kare-kare için 3072. gpuLayers ~28.
        child.send({ t: 'load', modelPath: coderPath, gpuLayers: gpu, contextSize: (isMulti ? 3072 : 2560) });
        return;
    }

    // ÖĞRENME KANCASI TEŞHİSİ: `--learntest` → GERÇEK oyun yolu (quickMatchStart interactive) startBattle
    // kancasının capture'ı açıp açmadığını + tam maçta snapshot yakalanıp yakalanmadığını + checkGameOver
    // maç-sonu etiketle/kaydet'in çalışıp çalışmadığını doğrular.
    if (process.argv.includes('--learntest')) {
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            const setup = await js(`(() => { try {
                quickMatchStart();   // GERÇEK yol: interactive=true (show belirtilmedi)
                battleDeployManifest(battleBuildArmyManifest(700, { maxUnits: 10, combatFocused: true }), false, { source: 'learntest-blue' });   // zayıf blue → maç hızlı biter → checkGameOver tetiklenir
                startBattle();       // KANCA: model + (BATTLE_LEARN_FROM_MATCH ise) capture açılmalı
                return { interactive: BATTLE_SESSION.interactive, mode: BATTLE_SESSION.mode, learnFlag: (typeof BATTLE_LEARN_FROM_MATCH!=='undefined'?BATTLE_LEARN_FROM_MATCH:'?'), captureOn: (typeof BATTLE_TRAIN_CAPTURE!=='undefined'?BATTLE_TRAIN_CAPTURE:'?'), modelEnabled: !!(BATTLE_SELECTOR_MODELS && BATTLE_SELECTOR_MODELS['battle-red-ai']), minTick: BATTLE_SELECTOR_MIN_TICK };
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,300) }; } })()`);
            console.log('LEARNTEST_SETUP ' + JSON.stringify(setup));
            // maçı gameLoop ile OYNAT (checkGameOver doğal tetiklensin) — snapshot yakalama stepSim kancasında
            const play = await js(`(() => { try {
                window.requestAnimationFrame = () => 0; lastFrameTime = 0;
                let snapAtEnd = 0;
                for (let i = 1; i <= 4000; i++) { if (phase !== PHASE.BATTLE) break; if (typeof BATTLE_DECISION_SNAPSHOTS!=='undefined') snapAtEnd = BATTLE_DECISION_SNAPSHOTS.length; gameLoop(i * 50); }
                return { tick: SIM.tick, phase: phase, snapshotsBeforeEnd: snapAtEnd, snapshotsNow: (typeof BATTLE_DECISION_SNAPSHOTS!=='undefined'?BATTLE_DECISION_SNAPSHOTS.length:'?'), winner: (SIM.battle?SIM.battle.winnerSide:null) };
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,300) }; } })()`);
            console.log('LEARNTEST_PLAY ' + JSON.stringify(play));
            await sleep(4000);   // checkGameOver'ın setTimeout etiketleme+kaydet'i için bekle
            const saved = await js(`(() => { try { return { learnMsgVar: !!document.getElementById('learn-msg'), pixelTrain: !!(window.PIXEL && window.PIXEL.train) }; } catch(e){ return { err:e.message }; } })()`);
            console.log('LEARNTEST_SAVED ' + JSON.stringify(saved));
            console.log('LEARNTEST_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // İNSAN-MAÇI YAKALA (Faz 6): `--humancapture <blueBudget> <macSayisi> <outFile>` → N maç oyna (rakip =
    // insan-proxy), her maçta kırmızının karar-durumlarını YAKALA + Oracle-ETİKETLE → insan-dağılımı eğitim verisi.
    // Gerçek oyunda blue=insan; burada kod-AI proxy ile TAM zinciri kanıtlar. Sonra warm-start retrain (INSAN-EGIT.bat).
    if (process.argv.includes('--humancapture')) {
        const hi = process.argv.indexOf('--humancapture');
        const blueBudget = parseInt(process.argv[hi + 1] || '1400', 10);
        const matches = Math.max(1, Math.min(20, parseInt(process.argv[hi + 2] || '6', 10)));
        const outFile = process.argv[hi + 3] || require('path').join(__dirname, '..', 'qa-runtime', 'human-data.json');
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            const allExamples = [];
            for (let m = 0; m < matches; m++) {
                const seed = 3000 + m * 777;
                const res = await js(`(() => { try {
                    openBattlefieldSession({ mode:'quick', mapId:-2, seed:${seed}, attackerSide:true, durationSec:240, playerMoney:5000, enemyMoney:5000, deployRes:null, deployPool:null, techBonus:null, techBonusRed:null, show:false });
                    battleDeployManifest(battleBuildArmyManifest(${blueBudget}, { maxUnits: 16, combatFocused: true }), false, { source: 'human-blue' });
                    startBattle(); window.requestAnimationFrame = () => 0;
                    battleSelectorEnableFor('battle-red-ai', BATTLE_SELECTOR_TRAINED_MODEL); BATTLE_SELECTOR_MIN_TICK = 500; BATTLE_SELECTOR_MAX_TICK = 999999;
                    battleTrainCaptureReset(true);
                    const ph = SIM.headless; SIM.headless = true;
                    try { while (SIM.tick < 1600 && phase === PHASE.BATTLE && !(SIM.battle && SIM.battle.winnerSide!==null && SIM.battle.winnerSide!==undefined)) { simulationTime+=BATTLE_TICK_MS; gameTime+=BATTLE_TICK_SEC; stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, simulationTime); } } finally { SIM.headless = ph; }
                    const yak = BATTLE_DECISION_SNAPSHOTS.length;
                    const labeled = battleLabelDecisionSnapshots({ rolloutSec: 10 });
                    battleTrainCaptureReset(false);
                    return { yakalanan: yak, etiketlenen: labeled.count, examples: labeled.examples };
                } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,300) }; } })()`);
                if (res && res.err) { console.log('HUMANCAP_HATA maç=' + m + ' ' + res.err); continue; }
                for (const ex of (res.examples || [])) allExamples.push(ex);
                console.log('HUMANCAP maç=' + m + ' seed=' + seed + ' yakalanan=' + res.yakalanan + ' etiketlenen=' + res.etiketlenen + ' toplam=' + allExamples.length);
            }
            try {
                require('fs').writeFileSync(outFile, JSON.stringify({ meta: { createdBy: 'humancapture', human: true, blueBudget, matches, exampleCount: allExamples.length }, examples: allExamples }));
                console.log('HUMANCAP_YAZILDI ' + outFile + ' örnek=' + allExamples.length);
            } catch (e) { console.log('HUMANCAP_YAZMA_HATA ' + e.message); }
            console.log('HUMANCAP_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // SNAPSHOT TESTİ (Faz 6): `--snaptest` → maç sırasında kırmızının karar-durumlarını YAKALA → maç sonrası
    // Oracle-ETİKETLE → insan-maçı DAgger verisi. (Gerçekte blue=insan; burada kod-AI ile mekanizma kanıtı.)
    if (process.argv.includes('--snaptest')) {
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            const out = await js(`(() => { try {
                openBattlefieldSession({ mode:'quick', mapId:-2, seed:2024, attackerSide:true, durationSec:240, playerMoney:5000, enemyMoney:5000, deployRes:null, deployPool:null, techBonus:null, techBonusRed:null, show:false });
                battleDeployManifest(battleBuildArmyManifest(5000, { maxUnits: 40, combatFocused: true }), false, { source: 'snaptest-blue' });
                startBattle(); window.requestAnimationFrame = () => 0;
                battleSelectorEnableFor('battle-red-ai', BATTLE_SELECTOR_TRAINED_MODEL); BATTLE_SELECTOR_MIN_TICK = 500; BATTLE_SELECTOR_MAX_TICK = 999999;
                battleTrainCaptureReset(true);    // "bu maçtan öğren" AÇIK → karar-durumları yakalanır
                // maçı oyna (headless stepSim loop; yakalama stepSim kancasında, rollout değil → çalışır)
                const ph = SIM.headless; SIM.headless = true;
                try { while (SIM.tick < 1400 && phase === PHASE.BATTLE) { simulationTime+=BATTLE_TICK_MS; gameTime+=BATTLE_TICK_SEC; stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, simulationTime); } } finally { SIM.headless = ph; }
                const yakalanan = BATTLE_DECISION_SNAPSHOTS.length;
                // MAÇ SONRASI: yakalanan karar-durumlarını Oracle ile etiketle → eğitim verisi
                const labeled = battleLabelDecisionSnapshots({ rolloutSec: 10 });
                battleTrainCaptureReset(false);
                // örnek: bir etiketlenmiş durumun oracle-seçimi
                const s0 = labeled.examples[0];
                const ornek = s0 ? { tick: s0.snapTick, human: s0.human, adaySayisi: s0.rows.length, enIyiOdul: Math.max(...s0.rows.map(r=>r.reward)).toFixed(0), stateLen: s0.stateFeatures.length } : null;
                // dosyaya yaz (orkestratör bunu insan-verisi olarak merge edebilir)
                try { require('fs').writeFileSync('qa-runtime/human-dagger-test.json', JSON.stringify({ meta:{createdBy:'snaptest', human:true, exampleCount: labeled.count}, examples: labeled.examples })); } catch(e){}
                return { yakalananSnapshot: yakalanan, etiketlenen: labeled.count, ornek };
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,400) }; } })()`);
            console.log('SNAPTEST ' + JSON.stringify(out));
            console.log('SNAPTEST_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // DOKTRİN RPS-TURNUVASI: `--doctrinetournament` → her doktrin her doktrine karşı (9×9), kısa maçlar → taş-kağıt-makas matrisi.
    // "Farklı-ama-dengeli" iddiasını ölçer: bir doktrin hepsini yeniyorsa denge-vidası orada. RED=doktrin-a(saldıran), BLUE=doktrin-b.
    if (process.argv.includes('--doctrinetournament')) {
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            const out = await js(`(() => { try {
                const N = (typeof BATTLE_DOCTRINE_NAMES !== 'undefined') ? BATTLE_DOCTRINE_NAMES.length : 9;
                const names = (typeof BATTLE_DOCTRINE_NAMES !== 'undefined') ? BATTLE_DOCTRINE_NAMES : [];
                const CAP = 2400;   // TAM 120s (durationSec) → maç çözülür (elenme/süre-dolması); dereceli kuvvet-oranı metriği
                const seeds = [2024];   // ilk-okuma 1 tohum (81 maç); gürültülü ama RPS-yönü verir
                const adv = []; for (let a=0;a<N;a++){ adv[a]=[]; for(let b=0;b<N;b++) adv[a][b]=0; }
                for (let a=0;a<N;a++){
                    for (let b=0;b<N;b++){
                        BATTLE_FORCE_VARIED = true; BATTLE_FORCE_DOCTRINE = a;   // RED = doktrin a (oto-deploy içinde)
                        openBattlefieldSession({ mode:'quick', mapId:-2, seed:seeds[0], attackerSide:true, durationSec:120, playerMoney:5000, enemyMoney:5000, show:false });
                        BATTLE_FORCE_DOCTRINE = b;   // BLUE = doktrin b
                        battleDeployManifest(battleBuildArmyManifest(5000, { maxUnits: 40, combatFocused: true, varied: true }), false, { source:'tourney-blue' });
                        BATTLE_FORCE_DOCTRINE = null; BATTLE_FORCE_VARIED = false;
                        startBattle(); window.requestAnimationFrame = () => 0;
                        const ph = SIM.headless; SIM.headless = true;
                        try { while (SIM.tick < CAP && phase === PHASE.BATTLE) { simulationTime+=BATTLE_TICK_MS; gameTime+=BATTLE_TICK_SEC; stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, simulationTime); } } finally { SIM.headless = ph; }
                        // DERECELİ METRİK: maç-sonu kalan kuvvet-oranı (red-doktrini a avantajı; >1 = a baskın, <1 = b baskın)
                        let rv=0, bv=0;
                        for (const u of SIM.units) { if (u.dead || u.abandoned) continue; const c=(STATS[u.type]&&STATS[u.type].cost)||0; if (u.isRed) rv+=c; else bv+=c; }
                        adv[a][b] = +(rv/(bv||1)).toFixed(2);
                    }
                }
                // Sıralama: doktrinin saldıran-olarak ORTALAMA avantajı (satır ortalaması, yüksek=güçlü doktrin)
                const totals = adv.map((row,a)=>({ d:names[a]||a, avg:+(row.reduce((s,v)=>s+v,0)/row.length).toFixed(2) })).sort((x,y)=>y.avg-x.avg);
                return { names, adv, totals, seedsPerCell: seeds.length, metric: 'red-kalan/blue-kalan (maç-sonu, >1=red-doktrini baskın)' };
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,400) }; } })()`);
            console.log('TOURNAMENT ' + JSON.stringify(out));
            console.log('TOURNAMENT_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // HANDİKAP-KAYIT: `--handicaprec` → intel4-5000 (kırmızı, VARIED=gerçek-oyun-gibi) vs OYUNCU-META-vekil-6000 (mavi)
    // maçlarını CANLI-MAÇ ile AYNI ham-JSON formatında (samples+combatEvents+lifeEvents) qa-runtime/handicap-matches/ altına
    // yazar → kullanıcı uzman-analiste götürür ("asıl beceri kendinden üstün birini yendiğinde başlar", handikap KORUNUR).
    if (process.argv.includes('--handicaprec')) {
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        const fsx = require('fs');
        const outDir = path.join(__dirname, '..', 'qa-runtime', 'handicap-matches');
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            const scenarios = [
                { role: 'saldiran', redAttacks: true, seed: 5150 },
                { role: 'saldiran', redAttacks: true, seed: 2024 },
                { role: 'saldiran', redAttacks: true, seed: 777 },
                { role: 'savunan', redAttacks: false, seed: 2024 },
                { role: 'savunan', redAttacks: false, seed: 777 },
            ];
            try { fsx.mkdirSync(outDir, { recursive: true }); } catch (_) {}
            for (const sc of scenarios) {
                const json = await js(`(() => { try {
                    if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
                    if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = true;
                    for (const k in BATTLE_INTEL4_DELTAS) BATTLE_INTEL4_DELTAS[k] = true;   // TAM intel4-beyni (iki taraf da) — gerçek-oyundaki gibi
                    BATTLE_INTEL4_RED = true; BATTLE_INTEL4_BLUE = true;
                    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;   // kırmızı GERÇEK-OYUNDAKİ gibi varied (doktrin+imza-floor+rol-farkında)
                    openBattlefieldSession({ mode:'quick', mapId:-2, seed:${sc.seed}, attackerSide:${sc.redAttacks}, durationSec:360, playerMoney:5000, enemyMoney:5000, show:false });
                    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
                    BATTLE_FORCE_DOCTRINE = (typeof BATTLE_DOCTRINE_PLAYER_META !== 'undefined') ? BATTLE_DOCTRINE_PLAYER_META : null;   // VEKİL=oyuncu-meta 6000
                    battleDeployManifest(battleBuildArmyManifest(6000, { maxUnits: 48, combatFocused: true, varied: true, brainIntel4: true }), false, { source:'handicap-blue', ally: true });
                    BATTLE_FORCE_DOCTRINE = null;
                    startBattle(); window.requestAnimationFrame = () => 0;
                    const ph = SIM.headless; SIM.headless = true;
                    let simulationTime = 0;
                    try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) { simulationTime += BATTLE_TICK_MS; stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, simulationTime); } } finally { SIM.headless = ph; }
                    const b = SIM.battle || {};
                    const summary = { winnerSide: b.winnerSide ?? null, outcomeReason: b.outcomeReason || null, elapsedSec: b.elapsedSec || 0, endTick: SIM.tick,
                        redUnits: SIM.units.filter(u=>!u.dead && u.isRed).length, blueUnits: SIM.units.filter(u=>!u.dead && !u.isRed).length };
                    return JSON.stringify(exportBattleDiagnosticReport(summary));
                } catch (e) { return 'ERR ' + e.message + ' | ' + e.stack; } })()`);
                if (typeof json === 'string' && json.startsWith('ERR')) { console.log('HANDICAPREC_ERR ' + sc.role + '/' + sc.seed + ': ' + json.slice(0, 300)); continue; }
                const file = path.join(outDir, `handicap-${sc.role}-seed${sc.seed}.json`);
                try { fsx.writeFileSync(file, json); const w = JSON.parse(json).replay?.telemetry?.finalSummary; console.log('HANDICAPREC ' + file + ' (' + (json.length/1024/1024).toFixed(2) + ' MB) kazanan=' + (w ? (w.winnerSide===true?'KIRMIZI':w.winnerSide===false?'MAVİ':'-') : '?') + ' ' + (w?w.outcomeReason:'') + ' redSag=' + (w?w.redUnits:'?') + ' blueSag=' + (w?w.blueUnits:'?')); }
                catch (e) { console.log('HANDICAPREC_WRITE_ERR ' + file + ': ' + e.message); }
            }
            console.log('HANDICAPREC_DONE ' + outDir);
            app.quit();
        });
        return;
    }
    // MEZUNİYET-KAYIT: `--gradrec [--half-att|--half-def]` → MEZUNİYET-CONFIG'inde (intel3pro-beyni vs intel4-beyni, 6500v6500,
    // attack default-ON, VARIED) 12 base-seri maçını CANLI-MAÇ ile AYNI ham-JSON (samples+combatEvents+lifeEvents) döker →
    // analist an-an izler. Her maç tamamlandıkça yazılır (timeout'ta kısmi kayıt kalır). qa-runtime/graduation-matches/ altına.
    if (process.argv.includes('--gradrec')) {
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        const fsx = require('fs');
        const outDir = path.join(__dirname, '..', 'qa-runtime', 'graduation-matches');
        const SEEDS = [909, 3141, 2718, 2024, 777, 5150];
        let scenarios = [];
        for (const seed of SEEDS) {
            scenarios.push({ seed, intel4IsRed: true, role: 'saldiran' });    // intel4=kırmızı SALDIRAN
            scenarios.push({ seed, intel4IsRed: false, role: 'savunan' });    // intel4=mavi SAVUNAN (kırmızı=intel3pro saldırır)
        }
        if (process.argv.includes('--half-att')) scenarios = scenarios.filter(s => s.intel4IsRed);   // süre: yalnız 6 saldıran
        if (process.argv.includes('--half-def')) scenarios = scenarios.filter(s => !s.intel4IsRed);  // süre: yalnız 6 savunan
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            try { fsx.mkdirSync(outDir, { recursive: true }); } catch (_) {}
            for (const sc of scenarios) {
                const json = await js(`(() => { try {
                    if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
                    if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = true;
                    BATTLE_INTEL4_RED = ${sc.intel4IsRed} === true; BATTLE_INTEL4_BLUE = ${sc.intel4IsRed} !== true;   // intel3pro-vs-intel4 (deltalar VARSAYILAN: attack=ON)
                    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;
                    openBattlefieldSession({ mode:'quick', mapId:-2, seed:${sc.seed}, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });   // kırmızı DAİMA saldırır
                    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
                    battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4: BATTLE_INTEL4_BLUE, isAttacker:false }), false, { source:'gradrec-blue', ally:true });   // mavi=savunan (kırmızı saldırır)
                    startBattle(); window.requestAnimationFrame = () => 0;
                    const ph = SIM.headless; SIM.headless = true;
                    let simulationTime = 0;
                    try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) { simulationTime += BATTLE_TICK_MS; stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, simulationTime); } } finally { SIM.headless = ph; }
                    const b = SIM.battle || {};
                    const summary = { winnerSide: b.winnerSide ?? null, outcomeReason: b.outcomeReason || null, elapsedSec: b.elapsedSec || 0, endTick: SIM.tick,
                        intel4Side: ${sc.intel4IsRed} === true ? 'red' : 'blue', intel4Role: '${sc.role}',
                        redUnits: SIM.units.filter(u=>!u.dead && u.isRed).length, blueUnits: SIM.units.filter(u=>!u.dead && !u.isRed).length };
                    return JSON.stringify(exportBattleDiagnosticReport(summary));
                } catch (e) { return 'ERR ' + e.message + ' | ' + e.stack; } })()`);
                if (typeof json === 'string' && json.startsWith('ERR')) { console.log('GRADREC_ERR ' + sc.role + '/' + sc.seed + ': ' + json.slice(0, 300)); continue; }
                const file = path.join(outDir, `grad-intel4-${sc.role}-seed${sc.seed}.json`);
                try { fsx.writeFileSync(file, json); const w = JSON.parse(json).replay?.telemetry?.finalSummary; console.log('GRADREC ' + file + ' (' + (json.length/1024/1024).toFixed(2) + ' MB) kazanan=' + (w ? (w.winnerSide===true?'KIRMIZI':w.winnerSide===false?'MAVİ':'-') : '?') + ' ' + (w?w.outcomeReason:'') + ' redSag=' + (w?w.redUnits:'?') + ' blueSag=' + (w?w.blueUnits:'?')); }
                catch (e) { console.log('GRADREC_WRITE_ERR ' + file + ': ' + e.message); }
            }
            console.log('GRADREC_DONE ' + outDir);
            app.quit();
        });
        return;
    }
    // TEHDİT-PROFİLİ KONTROL: `--profilecheck` → red=intel4+profile SAVUNUR, vekil(area-alpha'lı) SALDIRIR → red areaAlpha tespit etmeli.
    // Ölçer: detection-latency, tespit-edilen-sınıflar, VE flag-ON determinizm (aynı-seed 2 koşu → battleStateHash aynı mı).
    if (process.argv.includes('--profilecheck')) {
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            const out = await js(`(() => { try {
                function runOnce(seed, intel4On) {
                    if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
                    if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = true;
                    for (const k in BATTLE_INTEL4_DELTAS) BATTLE_INTEL4_DELTAS[k] = true;
                    BATTLE_INTEL4_RED = !!intel4On; BATTLE_INTEL4_BLUE = false;   // red=intel4(geniş-cephe+profil) vs intel3pro(konsantre)
                    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;
                    openBattlefieldSession({ mode:'quick', mapId:-2, seed, attackerSide:false, durationSec:360, playerMoney:5000, enemyMoney:5000, show:false });  // red SAVUNUR
                    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
                    BATTLE_FORCE_DOCTRINE = (typeof BATTLE_DOCTRINE_PLAYER_META !== 'undefined') ? BATTLE_DOCTRINE_PLAYER_META : null;
                    battleDeployManifest(battleBuildArmyManifest(6000, { maxUnits:48, combatFocused:true, varied:true, brainIntel4:false }), false, { source:'profilecheck-blue', ally:true });
                    BATTLE_FORCE_DOCTRINE = null;
                    startBattle(); window.requestAnimationFrame = () => 0; if (typeof battleBalanceReset === 'function') battleBalanceReset(true);
                    const ph = SIM.headless; SIM.headless = true; let st = 0;
                    try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) { st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, st); } } finally { SIM.headless = ph; }
                    const redCtrl = [...BATTLE_CONTROLLERS.values()].find(c => c.side === true);
                    const tp = redCtrl && redCtrl.perception && redCtrl.perception._threatProfile;
                    const prof = (typeof threatProfileToTelemetry === 'function') ? threatProfileToTelemetry(tp) : null;
                    const rep = (typeof battleBalanceReport === 'function') ? battleBalanceReport() : null;
                    const ld = rep && rep.localDensity ? rep.localDensity.red : null;   // kırmızı(savunan) yerel-yoğunluk
                    if (typeof battleBalanceReset === 'function') battleBalanceReset(false);
                    const hash = (typeof battleStateHash === 'function') ? battleStateHash() : '?';
                    return { prof, hash, endTick: SIM.tick, ld };
                }
                const on = runOnce(2024, true);    // intel4 (geniş-cephe savunma)
                const off = runOnce(2024, false);  // intel3pro (konsantre)
                for (const k in BATTLE_INTEL4_DELTAS) BATTLE_INTEL4_DELTAS[k] = (k !== 'profile'); BATTLE_INTEL4_RED = false; BATTLE_INTEL4_BLUE = false;
                return JSON.stringify({ hash: on.hash, endTick: on.endTick, profile: on.prof, localDensityIntel4: on.ld, localDensityIntel3pro: off.ld });
            } catch (e) { return 'ERR ' + e.message + ' | ' + (e.stack||''); } })()`);
            console.log('PROFILECHECK ' + out);
            console.log('PROFILECHECK_OK');
            app.quit();
        });
        return;
    }
    // HANDİKAP-AYRIŞTIRICI: `--vshandicap` → full-intel4 kırpık-bütçe vs intel3pro-5000. Paritede coin-flip; handikapta
    // beyin-farkı belirginleşir. intel4 -X₺'de bile ~%50 tutuyorsa GERÇEKTEN daha iyi (sürüm-farkının ₺-fiyatı = düştüğü nokta).
    if (process.argv.includes('--vshandicap')) {
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            const out = await js(`(() => { try {
                const CAP = 7300;
                function runMatch(seed, intel4IsRed, i4Budget) {
                    if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
                    if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = true;
                    for (const k in BATTLE_INTEL4_DELTAS) BATTLE_INTEL4_DELTAS[k] = true;
                    BATTLE_INTEL4_RED = (intel4IsRed === true); BATTLE_INTEL4_BLUE = (intel4IsRed !== true);
                    const redBudget = intel4IsRed ? i4Budget : 5000, blueBudget = intel4IsRed ? 5000 : i4Budget;
                    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;
                    openBattlefieldSession({ mode:'quick', mapId:-2, seed, attackerSide:true, durationSec:360, playerMoney:5000, enemyMoney:redBudget, show:false });
                    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
                    battleDeployManifest(battleBuildArmyManifest(blueBudget, { maxUnits:48, combatFocused:true, varied:true, brainIntel4: BATTLE_INTEL4_BLUE }), false, { source:'vsh-blue', ally:true });
                    startBattle(); window.requestAnimationFrame = () => 0; battleBalanceReset(true);
                    const ph = SIM.headless; SIM.headless = true; let st = 0;
                    try { while (SIM.tick < CAP && phase === PHASE.BATTLE) { st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, st); } } finally { SIM.headless = ph; }
                    const rep = battleBalanceReport(); battleBalanceReset(false);
                    const wRed = rep.winner === 'red', wBlue = rep.winner === 'blue';
                    return { i4Won: (wRed || wBlue) ? (wRed === intel4IsRed) : null };
                }
                const rows = [];
                for (const b of [4750, 4500, 4250]) {
                    let w = 0, t = 0;
                    for (const seed of [2024, 777]) for (const A of [true, false]) {
                        const r = runMatch(seed, A, b);
                        if (r.i4Won !== null) { t++; if (r.i4Won) w++; }
                    }
                    rows.push({ intel4Budget: b, deficit: b - 5000, intel4Wins: w, of: t, winPct: t ? Math.round(w/t*1000)/10 : 0 });
                    if (w * 3 < t) break;   // intel4 <%33'e düştü → alt-eşik bulundu
                }
                for (const k in BATTLE_INTEL4_DELTAS) BATTLE_INTEL4_DELTAS[k] = true; BATTLE_INTEL4_RED = false; BATTLE_INTEL4_BLUE = false;
                return JSON.stringify(rows);
            } catch (e) { return 'ERR ' + e.message + ' | ' + e.stack; } })()`);
            console.log('VSHANDICAP ' + out);
            console.log('VSHANDICAP_OK');
            app.quit();
        });
        return;
    }
    // SÜRÜM-KAYIT: `--vsrec` → intel3pro-beyni vs intel4-beyni (tam-deltalar) 4 maçı CANLI-MAÇ ham-JSON formatında kaydeder
    // (2 intel4-saldırı, 2 intel4-savunma; 5000v5000 adil = beyin-karşılaştırması). Kullanıcı analiste götürür.
    if (process.argv.includes('--vsrec')) {
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        const fsx = require('fs');
        const outDir = path.join(__dirname, '..', 'qa-runtime', 'vs-matches');
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            const scenarios = [
                { role: 'intel4-saldiri', intel4IsRed: true, seed: 2024 },
                { role: 'intel4-saldiri', intel4IsRed: true, seed: 777 },
                { role: 'intel4-savunma', intel4IsRed: false, seed: 2024 },
                { role: 'intel4-savunma', intel4IsRed: false, seed: 777 },
            ];
            try { fsx.mkdirSync(outDir, { recursive: true }); } catch (_) {}
            for (const sc of scenarios) {
                const json = await js(`(() => { try {
                    if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
                    if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = true;
                    for (const k in BATTLE_INTEL4_DELTAS) BATTLE_INTEL4_DELTAS[k] = true;   // tam intel4-beyni
                    BATTLE_INTEL4_RED = ${sc.intel4IsRed};  BATTLE_INTEL4_BLUE = ${!sc.intel4IsRed};
                    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;
                    openBattlefieldSession({ mode:'quick', mapId:-2, seed:${sc.seed}, attackerSide:true, durationSec:360, playerMoney:6500, enemyMoney:6500, show:false });
                    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
                    battleDeployManifest(battleBuildArmyManifest(6500, { maxUnits:48, combatFocused:true, varied:true, brainIntel4: BATTLE_INTEL4_BLUE, isAttacker:false }), false, { source:'vsrec-blue', ally:true });   // --vsrec: kırmızı DAİMA saldıran → mavi=savunan → savunan-AT-tabanı devrede
                    startBattle(); window.requestAnimationFrame = () => 0;
                    const ph = SIM.headless; SIM.headless = true; let st = 0;
                    try { while (SIM.tick < 7300 && phase === PHASE.BATTLE) { st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, st); } } finally { SIM.headless = ph; }
                    const b = SIM.battle || {};
                    const intel4IsRed = ${sc.intel4IsRed};
                    const winnerIsIntel4 = (b.winnerSide === true) === intel4IsRed;
                    const summary = { winnerSide: b.winnerSide ?? null, winner: (b.winnerSide===true?'red':b.winnerSide===false?'blue':'-'), winnerIsIntel4, outcomeReason: b.outcomeReason || null, elapsedSec: b.elapsedSec || 0, endTick: SIM.tick,
                        intel4Side: intel4IsRed?'red':'blue', redUnits: SIM.units.filter(u=>!u.dead&&u.isRed).length, blueUnits: SIM.units.filter(u=>!u.dead&&!u.isRed).length };
                    for (const k in BATTLE_INTEL4_DELTAS) BATTLE_INTEL4_DELTAS[k] = true;
                    BATTLE_INTEL4_RED = false; BATTLE_INTEL4_BLUE = false;
                    return JSON.stringify(exportBattleDiagnosticReport(summary));
                } catch (e) { return 'ERR ' + e.message + ' | ' + e.stack; } })()`);
                if (typeof json === 'string' && json.startsWith('ERR')) { console.log('VSREC_ERR ' + sc.role + '/' + sc.seed + ': ' + json.slice(0, 300)); continue; }
                const file = path.join(outDir, 'vs-intel3pro-vs-intel4-' + sc.role + '-seed' + sc.seed + '.json');
                try { fsx.writeFileSync(file, json); const w = JSON.parse(json).replay?.telemetry?.finalSummary; console.log('VSREC ' + file + ' (' + (json.length/1024/1024).toFixed(2) + ' MB) kazanan=' + (w?w.winner:'?') + ' intel4-kazandı=' + (w?w.winnerIsIntel4:'?') + ' ' + (w?w.outcomeReason:'')); }
                catch (e) { console.log('VSREC_WRITE_ERR ' + file + ': ' + e.message); }
            }
            console.log('VSREC_DONE ' + outDir);
            app.quit();
        });
        return;
    }
    // PER-DELTA ABLATION: `--ablation [delta1,delta2,...]` → her intel4-deltasını TEK açıp intel3pro'ya karşı ölçer
    // (intel3pro + yalnız-delta-X vs intel3pro) → yardım-eden tut, zarar-veren at. Default tüm 6 delta.
    if (process.argv.includes('--ablation')) {
        const _ai = process.argv.indexOf('--ablation');
        const _darg = (process.argv[_ai + 1] && !process.argv[_ai + 1].startsWith('--')) ? process.argv[_ai + 1] : 'stance,shock,deblob,helo,comp,micro';
        const _deltas = JSON.stringify(_darg.split(','));
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            const out = await js(`(() => { try {
                const CAP = 7300, DELTAS = ${_deltas}, ALL = Object.keys(BATTLE_INTEL4_DELTAS);   // tüm deltalar (yeni: defense/backbone/range/drone dahil)
                function runMatch(seed, intel4IsRed, redAttacks) {
                    if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
                    if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = true;
                    BATTLE_INTEL4_RED = (intel4IsRed === true); BATTLE_INTEL4_BLUE = (intel4IsRed !== true);
                    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;
                    openBattlefieldSession({ mode:'quick', mapId:-2, seed, attackerSide:redAttacks, durationSec:360, playerMoney:5000, enemyMoney:5000, show:false });
                    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
                    battleDeployManifest(battleBuildArmyManifest(5000, { maxUnits:48, combatFocused:true, varied:true, brainIntel4: BATTLE_INTEL4_BLUE }), false, { source:'ablation-blue', ally:true });
                    startBattle(); window.requestAnimationFrame = () => 0; battleBalanceReset(true);
                    const ph = SIM.headless; SIM.headless = true; let st = 0;
                    try { while (SIM.tick < CAP && phase === PHASE.BATTLE) { st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, st); } } finally { SIM.headless = ph; }
                    const rep = battleBalanceReport(); battleBalanceReset(false);
                    return { winner: rep.winner, tr: rep.tradeRatio };
                }
                const SEEDS = [2024, 777];   // 2 tohum ×2 rol/taraf = 4 maç (izolasyon hızı)
                const results = [];
                for (const dk of DELTAS) {
                    const _on = dk.split('+');   // 'a+b+c' = combo (hepsi açık); tek 'a' = yalnız-a
                    for (const k of ALL) BATTLE_INTEL4_DELTAS[k] = _on.includes(k);
                    let w = 0, l = 0, tI4 = 0, tI3 = 0;
                    for (const seed of SEEDS) {
                        for (const A of [true, false]) {
                            const m = runMatch(seed, A, true);
                            const wRed = m.winner === 'red', wBlue = m.winner === 'blue';
                            if (wRed || wBlue) { ((wRed === A) ? w++ : l++); }
                            tI4 += A ? (m.tr.redDestroyed||0) : (m.tr.blueDestroyed||0);
                            tI3 += A ? (m.tr.blueDestroyed||0) : (m.tr.redDestroyed||0);
                        }
                    }
                    const tot = w + l;
                    results.push({ delta: dk, deltaWins: w, intel3proWins: l, of: tot, winPct: tot ? Math.round(w/tot*1000)/10 : 0, takas: tI3 > 0 ? Math.round(tI4/tI3*100)/100 : null,
                        verdict: tot ? (w > l ? 'YARDIM' : w < l ? 'ZARAR' : 'NÖTR') : '-' });
                }
                for (const k of ALL) BATTLE_INTEL4_DELTAS[k] = true; BATTLE_INTEL4_RED = false; BATTLE_INTEL4_BLUE = false;
                return JSON.stringify(results);
            } catch (e) { return 'ERR ' + e.message + ' | ' + e.stack; } })()`);
            console.log('ABLATION ' + out);
            console.log('ABLATION_OK');
            app.quit();
        });
        return;
    }
    // SÜRÜM-TURNUVASI: `--vstournament` → intel3pro-beyni (flag-off) vs intel4-beyni (flag-on) AYNI motorda.
    // "Selefini yenemeyen sürüm yayınlanmaz" regresyon-kapısı. 3 katman: temel-seri (role-swap) + handikap-merdiveni + ayna-teşhis.
    if (process.argv.includes('--vstournament')) {
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            const out = await js(`(() => { try {
                const CAP = 7300, STD = 6500;   // MEZUNİYET-BÜTÇESİ: 6500 (dizilim-şablonu bununla kalibre; slider-varsayılanı da 6500)
                if (${process.argv.includes('--attack')}) { BATTLE_INTEL4_DELTAS.attack = true; }   // FAZ-T1 ÖLÇÜMÜ: taarruz-doktrini ON (battleDelta gate'i sayesinde YALNIZ intel4-beyinli taraf alır)
                // Tek maç: intel4IsRed=intel4-beyni hangi tarafta; bothIntel4=ayna (iki taraf da intel4). redBudget/blueBudget ₺.
                function runMatch(seed, intel4IsRed, redAttacks, redBudget, blueBudget, bothIntel4) {
                    if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
                    if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = true;
                    BATTLE_INTEL4_RED = bothIntel4 ? true : (intel4IsRed === true);
                    BATTLE_INTEL4_BLUE = bothIntel4 ? true : (intel4IsRed !== true);
                    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;   // her iki taraf da varied-doktrin ordu (floor yalnız intel4-tarafında)
                    openBattlefieldSession({ mode:'quick', mapId:-2, seed, attackerSide:redAttacks, durationSec:360, playerMoney:blueBudget, enemyMoney:redBudget, show:false });
                    if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
                    // blue isAttacker: kırmızı-saldırmıyorsa mavi-saldıran (savunan-AT-tabanı doğru tarafa uygulansın; red-floor autoDeploy'da config.attackerSide ile)
                    battleDeployManifest(battleBuildArmyManifest(blueBudget, { maxUnits:48, combatFocused:true, varied:true, brainIntel4: BATTLE_INTEL4_BLUE, isAttacker: !redAttacks }), false, { source:'vstourney-blue', ally:true });
                    startBattle(); window.requestAnimationFrame = () => 0; battleBalanceReset(true);
                    const ph = SIM.headless; SIM.headless = true; let st = 0;
                    try { while (SIM.tick < CAP && phase === PHASE.BATTLE) { st += BATTLE_TICK_MS; stepSim(st, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, st); } } finally { SIM.headless = ph; }
                    const rep = battleBalanceReport();
                    // TEŞHİS (erime-mekanizması): FORENSIC-buf son-kuyruğu (~son 2048 olay = maç-sonu erime-fazı). SALDIRANIN ölen
                    // birimlerini ÖLDÜREN-tipe + öldüren-x-bandına (L/C/R sektör) göre dök → saldıran cepheden-takasla mı (C) yoksa
                    // açık-flank enfilade'ıyla mı (L/R) eriyor. Saf-okuma (sim-mutasyon yok, determinizm etkilenmez).
                    const attSide = intel4IsRed ? 'red' : 'blue';   // INTEL4-tarafın kayıpları (saldıran-maç=saldıran, savunan-maç=savunan → her iki erimeyi de dök)
                    const WW = (typeof WORLD_W !== 'undefined') ? WORLD_W : 6000;
                    const attr = {};
                    try { for (const e of BATTLE_FORENSIC.buf) {
                        if (!e.lethal || e.targetSide !== attSide) continue;
                        const kt = e.attackerType, kx = (e.attackerX != null ? e.attackerX : (e.targetX || 0));
                        const band = kx < WW/3 ? 'L' : (kx < 2*WW/3 ? 'C' : 'R');
                        const nm = (typeof STATS !== 'undefined' && STATS[kt] && STATS[kt].name) ? STATS[kt].name : ('t'+kt);
                        const a = attr[nm] || (attr[nm] = { n:0, L:0, C:0, R:0 }); a.n++; a[band]++;
                    } } catch(e) {}
                    battleBalanceReset(false);
                    return { winner: rep.winner, tr: rep.tradeRatio, endTick: SIM.tick, outcome: rep.outcomeReason, maxDom: rep.maxDominanceRatio, attr,
                        redSurv: SIM.units.filter(u=>!u.dead&&u.isRed).length, blueSurv: SIM.units.filter(u=>!u.dead&&!u.isRed).length };
                }
                // ── 1) TEMEL-SERİ: her tohum 2 maç — (A) intel4=kırmızı-saldıran, (B) intel4=mavi-savunan → rol+taraf dengeli, 5000v5000
                const SEEDS = [909, 3141, 2718, 2024, 777, 5150];   // T0-ÖLÇÜM: 12-maç base + maxDom (taarruz-aciz<1.0 mi eşik-ulaşılmaz≈1.0 mi)
                let i4w = 0, i3w = 0; const series = []; let trI4 = 0, trI3 = 0;
                const _runBase = ${!process.argv.includes('--ladder') && !process.argv.includes('--mirror')};   // MEZUNİYET: base yalnız bayraksız; --ladder/--mirror kendi chunk'ında base'i atlar (süre)
                for (const seed of (_runBase ? SEEDS : [])) {
                    for (const A of [true, false]) {   // A=true: intel4=kırmızı-saldıran; A=false: intel4=mavi-savunan
                        const m = runMatch(seed, A, true, STD, STD, false);
                        const wRed = m.winner === 'red', wBlue = m.winner === 'blue';
                        const i4Won = wRed === A;   // intel4=kırmızıysa A=true → kırmızı-kazanç intel4-kazanç
                        if (wRed || wBlue) { i4Won ? i4w++ : i3w++; }
                        const i4Destroyed = A ? (m.tr.redDestroyed||0) : (m.tr.blueDestroyed||0);
                        const i3Destroyed = A ? (m.tr.blueDestroyed||0) : (m.tr.redDestroyed||0);
                        trI4 += i4Destroyed; trI3 += i3Destroyed;
                        series.push({ seed, intel4:(A?'red':'blue'), winner:(m.winner||'-'), i4Won:(wRed||wBlue)?i4Won:null, outcome:m.outcome, maxDom:m.maxDom, att:m.attr });
                    }
                }
                const total = i4w + i3w;
                const winPct = total ? Math.round((i4w / total) * 1000) / 10 : 0;
                // ── 2) HANDİKAP-MERDİVENİ: intel4 kazanıyorsa (winPct≥60) bütçesini kırp → yenilmeye-başladığı ₺ = sürüm-farkı
                const ladder = [];
                if (${process.argv.includes('--ladder')}) {   // MEZUNİYET CHUNK-2: handikap-merdiveni (ayrı chunk, base atlanır)
                    for (const b of [5800, 5000, 4200, 3400, 2600]) {   // intel4-bütçesi kırpılır (STD=6500'e göre -700/-1500/-2300/-3100/-3900); yenilmeye-başladığı ₺ = sürüm-üstünlüğü
                        let lw = 0, lt = 0;
                        for (const seed of [909, 3141, 2718]) {
                            // intel4=kırmızı-saldıran, kırpılmış bütçe; intel3pro=mavi STD (tam-doktrin dahil, attack default-ON)
                            const m = runMatch(seed, true, true, b, STD, false);
                            if (m.winner === 'red' || m.winner === 'blue') { lt++; if (m.winner === 'red') lw++; }   // intel4=kırmızı
                        }
                        ladder.push({ intel4Budget: b, handicap: STD - b, intel4Wins: lw, of: lt });
                        if (lw * 2 < lt) break;   // çoğunluğu kaybetti → ₺-eşiği bulundu
                    }
                }
                // ── 3) AYNA-TEŞHİS: intel4-vs-intel4, eşit 5000, roller sabit (kırmızı hep saldırır) → savunan sistematik mi kazanıyor
                let mirrorDef = 0, mirrorAtt = 0, mirrorTot = 0;
                for (const seed of ${JSON.stringify(process.argv.includes('--mirror') ? [909, 3141, 2718, 2024, 777, 5150] : [])}) {   // MEZUNİYET CHUNK-3: ayna (intel4-vs-intel4, denge-kontrolü)
                    const m = runMatch(seed, true, true, STD, STD, true);   // both intel4; red attacks
                    if (m.winner === 'red') { mirrorAtt++; mirrorTot++; } else if (m.winner === 'blue') { mirrorDef++; mirrorTot++; }
                }
                BATTLE_INTEL4_RED = false; BATTLE_INTEL4_BLUE = false;
                return JSON.stringify({
                    series: { matches: total, intel4Wins: i4w, intel3proWins: i3w, winPct,
                        tradeRatio: trI3 > 0 ? Math.round((trI4/trI3)*100)/100 : null, gate: (winPct >= 65 ? 'GECTI(≥65)' : winPct >= 60 ? 'SINIRDA(60-65)' : 'KALDI(<60)'), detail: series },
                    ladder, mirror: { defenderWins: mirrorDef, attackerWins: mirrorAtt, of: mirrorTot,
                        note: (mirrorTot && mirrorDef > mirrorAtt) ? 'SAVUNAN-SİSTEMATİK → zafer-koşulu sorunu (bölge-puanı aciliyeti)' : 'dengeli' }
                });
            } catch (e) { return 'ERR ' + e.message + ' | ' + e.stack; } })()`);
            console.log('VSTOURNAMENT ' + out);
            console.log('VSTOURNAMENT_OK');
            app.quit();
        });
        return;
    }
    // AI KABUL-BATARYASI: `--aibattery` → 3 seed × TAM-EKONOMİ maçı (5000v5000) → tip-başı hasar dağılımı +
    // takas-oranı + KIRMIZI-BAYRAK (savaş birimi ama katkı~sıfır). Her AI değişikliğinin sabit kabul-testi.
    if (process.argv.includes('--aibattery')) {
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            const out = await js(`(() => { try {
                const seeds = [2024, 777, 5150];
                const CAP = 7300;   // tam 360s (KULLANICI-KARARI 6dk) + küçük marj → süre-dolması + margin-zaferi tetiklensin (yoksa maç çözülmeden kesilir, kazanan BOŞ)
                function runBattery(gateOn, redAttacks, sectorOn) {
                    if (redAttacks === undefined) redAttacks = true;
                    if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = gateOn;
                    if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = !!sectorOn;
                    const agg = {}; const trade = { red:0, blue:0 }; const winners = [];
                    const ctr = { abandoned:0, capRed:0, capBlue:0, vehDestroyed:0, kamiDep:0, kamiVal:0, assTicks:0, assSupp:0, sorties:0, fields:0, minesLaid:0, mineKills:0,
                        posR:{SHAPE:0,POSITION:0,STRIKE:0,CONSOLIDATE:0,PRESERVE:0}, posB:{SHAPE:0,POSITION:0,STRIKE:0,CONSOLIDATE:0,PRESERVE:0}, fsRed:[], fsBlue:[], endTicks:[],
                        intByMin:{}, strikeWinRed:0, strikeWinBlue:0,
                        dispRed:0, dispBlue:0, soRed:{left:0,center:0,right:0}, soBlue:{left:0,center:0,right:0}, shiftR:0, shiftB:0 };
                    for (const seed of seeds) {
                        if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = true;   // ÖLÇÜM-GERÇEKÇİLİĞİ: kırmızı AI (auto-deploy) GERÇEK-OYUNDAKİ gibi VARIED ordu dizsin (doktrin+imza-floor+rol-farkında) — yoksa batarya base-army'yi ölçer, gerçek AI'ı değil
                        openBattlefieldSession({ mode:'quick', mapId:-2, seed, attackerSide:redAttacks, durationSec:360, playerMoney:5000, enemyMoney:5000, show:false });   // KULLANICI-KARARI: 6dk (saldıran imhayı bitirsin)
                        if (typeof BATTLE_FORCE_VARIED !== 'undefined') BATTLE_FORCE_VARIED = false;
                        BATTLE_FORCE_DOCTRINE = (typeof BATTLE_DOCTRINE_PLAYER_META !== 'undefined') ? BATTLE_DOCTRINE_PLAYER_META : null;   // VEKİL=OYUNCU-META (kullanıcının 5-maç profili → gerçekçi rakip)
                        battleDeployManifest(battleBuildArmyManifest(6000, { maxUnits: 48, combatFocused: true, varied: true }), false, { source:'aibattery-blue', ally: true });   // KULLANICI-KRİTER: VEKİL 6000₺ (intel3pro 5000 vs vekil 6000; AI 3/3 yenerse BAŞARILI — handikap-testi)
                        BATTLE_FORCE_DOCTRINE = null;
                        startBattle(); window.requestAnimationFrame = () => 0;
                        battleBalanceReset(true);
                        const ph = SIM.headless; SIM.headless = true;
                        try { while (SIM.tick < CAP && phase === PHASE.BATTLE) { simulationTime+=BATTLE_TICK_MS; gameTime+=BATTLE_TICK_SEC; stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, simulationTime); } } finally { SIM.headless = ph; }
                        const rep = battleBalanceReport();
                        winners.push(rep.winner); ctr.endTicks.push(SIM.tick); trade.red += rep.tradeRatio.redDestroyed; trade.blue += rep.tradeRatio.blueDestroyed;
                        for (const r of rep.rows) { const a = agg[r.id] || (agg[r.id]={dep:0,dmg:0,kills:0,deaths:0,cost:r.cost,combat:r.combat}); a.dep+=r.dep; a.dmg+=r.dmg; a.kills+=r.kills; a.deaths+=r.deaths; }
                        ctr.abandoned += BATTLE_BALANCE.abandoned; ctr.capRed += BATTLE_BALANCE.captured.red; ctr.capBlue += BATTLE_BALANCE.captured.blue;
                        ctr.assTicks += BATTLE_BALANCE.assaultTicks; ctr.assSupp += BATTLE_BALANCE.assaultSuppTicks; ctr.sorties += BATTLE_BALANCE.heloSorties; ctr.fields += BATTLE_BALANCE.fieldsBuilt;
                        ctr.vehDestroyed += rep.grayVehicle.vehDestroyed; ctr.kamiDep += rep.kamikaze.deployed; ctr.kamiVal += rep.kamikaze.valueDestroyed;
                        ctr.minesLaid += BATTLE_BALANCE.minesLaid; ctr.mineKills += BATTLE_BALANCE.mineKills;
                        for (const k in ctr.posR) ctr.posR[k]+=BATTLE_BALANCE.posture.red[k]; for (const k in ctr.posB) ctr.posB[k]+=BATTLE_BALANCE.posture.blue[k];
                        ctr.fsRed.push(BATTLE_BALANCE.firstStrikeTick.red); ctr.fsBlue.push(BATTLE_BALANCE.firstStrikeTick.blue);
                        for (const c of rep.intensityCurve) { const b = ctr.intByMin[c.min] || (ctr.intByMin[c.min]={sum:0,n:0}); b.sum+=c.pct; b.n++; }
                        ctr.strikeWinRed += BATTLE_BALANCE.strikeWindows.red; ctr.strikeWinBlue += BATTLE_BALANCE.strikeWindows.blue;
                        ctr.dispRed += rep.dispersalIndex.red; ctr.dispBlue += rep.dispersalIndex.blue;
                        for (const k of ['left','center','right']) { ctr.soRed[k] += rep.sectorOccupancy.red[k]; ctr.soBlue[k] += rep.sectorOccupancy.blue[k]; }
                        ctr.shiftR += rep.mainEffortShifts.red; ctr.shiftB += rep.mainEffortShifts.blue;
                        battleBalanceReset(false);
                    }
                    const rows = Object.keys(agg).map(id => { const a=agg[id]; return { id, dep:a.dep, dmg:a.dmg, kills:a.kills, deaths:a.deaths, combat:a.combat, cost:a.cost, dmgPerCost:+(a.dmg/((a.dep*a.cost)||1)).toFixed(3), killsPer100:+(a.kills/((a.dep*a.cost/100)||1)).toFixed(2) }; }).sort((x,y)=>y.dmgPerCost-x.dmgPerCost);
                    const redFlags = rows.filter(r=>r.combat && r.dep>0 && r.dmg < r.dep*r.cost*0.002).map(r=>r.id);
                    return { gate:gateOn, redAttacks, seeds, winners, endTicks:ctr.endTicks,
                        redWins: winners.filter(w=>w==='red').length, blueWins: winners.filter(w=>w==='blue').length,
                        tradeRatio:{ red:Math.round(trade.red), blue:Math.round(trade.blue), ratio:+((trade.red||0)/(trade.blue||1)).toFixed(2) },
                        firstStrike:{ red:ctr.fsRed, blue:ctr.fsBlue }, posture:{ red:ctr.posR, blue:ctr.posB },
                        strikeWindows:{ red:ctr.strikeWinRed, blue:ctr.strikeWinBlue },
                        intensityCurve: Object.keys(ctr.intByMin).sort((a,b)=>a-b).map(mi=>({ min:+mi, pct:+(ctr.intByMin[mi].sum/ctr.intByMin[mi].n).toFixed(2) })),
                        grayVehicle:{ abandoned:ctr.abandoned, captured:{red:ctr.capRed,blue:ctr.capBlue}, vehDestroyed:ctr.vehDestroyed, abandonRatio:(ctr.vehDestroyed+ctr.abandoned)>0?+(ctr.abandoned/(ctr.vehDestroyed+ctr.abandoned)).toFixed(2):0 },
                        kamikaze:{ deployed:ctr.kamiDep, valueDestroyed:ctr.kamiVal, valuePerUnit:ctr.kamiDep?+(ctr.kamiVal/ctr.kamiDep).toFixed(2):0 },
                        assaultSuppressedPct:ctr.assTicks?+(ctr.assSupp/ctr.assTicks).toFixed(2):0, heloSorties:ctr.sorties, fieldsBuilt:ctr.fields,
                        mines:{ laid:ctr.minesLaid, kills:ctr.mineKills },
                        dispersalIndex:{ red:+(ctr.dispRed/seeds.length).toFixed(3), blue:+(ctr.dispBlue/seeds.length).toFixed(3) },
                        sectorOccupancy:{ red:{left:+(ctr.soRed.left/seeds.length).toFixed(2),center:+(ctr.soRed.center/seeds.length).toFixed(2),right:+(ctr.soRed.right/seeds.length).toFixed(2)},
                                          blue:{left:+(ctr.soBlue.left/seeds.length).toFixed(2),center:+(ctr.soBlue.center/seeds.length).toFixed(2),right:+(ctr.soBlue.right/seeds.length).toFixed(2)} },
                        mainEffortShifts:{ red:+(ctr.shiftR/seeds.length).toFixed(1), blue:+(ctr.shiftB/seeds.length).toFixed(1) },
                        redFlags };
                }
                const on = runBattery(true, true, false);    // saldıran-kırmızı, kapı-açık, sektör-KAPALI (blob baseline)
                const sec = runBattery(true, true, true);     // saldıran-kırmızı, kapı-açık, sektör-AÇIK (anti-blob A/B)
                const def = runBattery(true, false, true);   // SAVUNAN-kırmızı, SEKTÖR-AÇIK (savunan-yayılma testi — off'ta yayılma devreye girmiyordu)
                if (typeof BATTLE_POSTURE_GATE !== 'undefined') BATTLE_POSTURE_GATE = true;
                if (typeof BATTLE_SECTOR_COMMAND !== 'undefined') BATTLE_SECTOR_COMMAND = false;
                return { on, sec, def };
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,500) }; } })()`);
            console.log('AIBATTERY ' + JSON.stringify(out));
            console.log('AIBATTERY_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // MODEL SMOKE: `--modelsmoke` → GERÇEK oyun yolu (quickMatchStart→startBattle→otomatik-kanca) modeli
    // etkinleştiriyor mu + savaş çalışıyor mu doğrular (exe'ye gömülü model entegrasyonu testi).
    if (process.argv.includes('--modelsmoke')) {
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            const out = await js(`(() => { try {
                const modelVar = (typeof BATTLE_SELECTOR_TRAINED_MODEL !== 'undefined');
                quickMatchStart();   // gerçek yol: interactive=true
                battleDeployManifest(battleBuildArmyManifest(5000, { maxUnits: 40, combatFocused: true }), false, { source: 'smoke-blue' });
                startBattle();       // KANCA burada tetiklenir
                const enabledAtStart = (typeof BATTLE_SELECTOR_MODELS !== 'undefined' && !!BATTLE_SELECTOR_MODELS['battle-red-ai']);
                const target = Object.keys(BATTLE_SELECTOR_MODELS || {}).join(',');
                window.requestAnimationFrame = () => 0; const ph = SIM.headless; SIM.headless = true;
                try { while (SIM.tick < 900 && phase === PHASE.BATTLE) { simulationTime+=BATTLE_TICK_MS; gameTime+=BATTLE_TICK_SEC; stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, simulationTime); } } finally { SIM.headless = ph; }
                const c = BATTLE_SELECTOR_CACHES['battle-red-ai'];
                const modelDroveAfterContact = !!(c && c.tick > 0);   // model en az bir seçim yaptı mı
                return { modelVarDefined: modelVar, interactive: BATTLE_SESSION.interactive, enabledAtStart, target, minTick: BATTLE_SELECTOR_MIN_TICK, tick: SIM.tick, modelSecimYapti: modelDroveAfterContact, red: SIM.units.filter(u=>u.isRed&&!u.dead).length, blue: SIM.units.filter(u=>!u.isRed&&!u.dead).length };
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,400) }; } })()`);
            console.log('MODELSMOKE ' + JSON.stringify(out));
            console.log('MODELSMOKE_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // CANLI SEÇİCİ: `--selectorlive <modelFile> <seedCount> <redAttack>` → eğitilmiş modeli KIRMIZI'ya bağla,
    // tam maç oynat (model-red vs kod-blue) vs baseline (kod-red vs kod-blue) → sonuç farkını raporlar.
    if (process.argv.includes('--selectorlive')) {
        const si = process.argv.indexOf('--selectorlive');
        const modelFile = process.argv[si + 1] || require('path').join(__dirname, '..', 'qa-runtime', 'selector-model.json');
        const seedCount = Math.max(1, Math.min(16, parseInt(process.argv[si + 2] || '6', 10)));
        const forceRedAttacker = process.argv[si + 3] === '1' || process.argv[si + 3] === 'redattack';
        let MODEL = null;
        try { MODEL = JSON.parse(require('fs').readFileSync(modelFile, 'utf8')); }
        catch (e) { console.log('SELECTORLIVE_MODEL_HATA ' + e.message + ' path=' + modelFile); app.exit(1); return; }
        console.log('SELECTORLIVE_MODEL yüklendi D=' + MODEL.D + ' H=' + MODEL.H + ' ' + (MODEL.stateVersion || '') + '/' + (MODEL.candidateVersion || ''));
        const SEEDS = Array.from({ length: seedCount }, (_, i) => 1001 + i * 1111);
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            // maç koştur: useModel true ise seçici KIRMIZI'ya bağlı. Tam savaşı oynat, kırmızı net değerini döndür.
            const runMatch = (SEED, useModel) => `(() => { try {
                openBattlefieldSession({ mode:'quick', mapId:-2, seed:${SEED}, attackerSide:${forceRedAttacker ? 'true' : 'false'}, durationSec:240, playerMoney:5000, enemyMoney:5000, deployRes:null, deployPool:null, techBonus:null, techBonusRed:null, show:false });
                battleDeployManifest(battleBuildArmyManifest(${parseInt(process.env.BLUE_BUDGET || '5000', 10)}, { maxUnits: 40, combatFocused: ${(process.env.BLUE_COMBAT || 'combat') !== 'mixed'}, varied: ${process.env.SURROGATE === '1'} }), false, { source: 'sellive-blue' });
                if (${process.env.SURROGATE === '1'}) { BATTLE_SURROGATE_SIDE = false; }   // mavi = insan-taktiği vekil (money-metrik: insan-gibiyi yenme)
                BATTLE_SURROGATE_ENVELOP = ${process.env.ENVELOP === '1' ? 'true' : 'false'};   // ÖLÇÜM: vekil KUŞATIR (saldıran) → anti-kuşatma etkisi ölçülebilir
                BATTLE_UNIT_SELF_DEFENSE = ${process.env.NOSELFDEF === '1' ? 'false' : 'true'};   // ÖLÇÜM: mikro-fix etkisi
                BATTLE_FORCE_CONCENTRATE = ${process.env.CONC === '1' ? 'true' : 'false'};   // ÖLÇÜM: konsantrasyon kaldıracı
                startBattle(); window.requestAnimationFrame = () => 0;
                if (${useModel ? 'true' : 'false'}) { battleSelectorEnable(${JSON.stringify(MODEL)}, 'battle-red-ai'); BATTLE_SELECTOR_MIN_TICK = ${process.env.SEL_MIN || 0}; BATTLE_SELECTOR_MAX_TICK = ${process.env.SEL_MAX || 999999}; } else battleSelectorDisable();
                const ph = SIM.headless; SIM.headless = true;
                let ticks = 0; const maxT = Math.round(240 / BATTLE_TICK_SEC);
                let surrTot = 0, surrN = 0, maxRedRisk = 0;   // ÖLÇÜM: KIRMIZI(savunan) sarılma-karesi + tespit-riski
                let fireTot = 0, notFiring = 0, blockedC = 0, redSamp = 0;   // ÖLÇÜM: menzilde-AMA-ateşsiz + 'Hat Kapalı' (ateş-fix)
                try { while (ticks < maxT && phase === PHASE.BATTLE && !(SIM.battle && SIM.battle.winnerSide !== null && SIM.battle.winnerSide !== undefined)) { simulationTime+=BATTLE_TICK_MS; gameTime+=BATTLE_TICK_SEC; stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, simulationTime); ticks++;
                    if (ticks % 10 === 0) {
                        const R=[],B=[]; for(const u of SIM.units){ if(u.dead)continue; (u.isRed?R:B).push(u); }
                        for(const u of R){ redSamp++; if(u.combatState==='Hat Kapalı')blockedC++; let inR=false; for(const f of B){const dx=f.x-u.x,dy=f.y-u.y; if(dx*dx+dy*dy<=u.range*u.range){inR=true;break;}} if(inR){fireTot++; if(!u.attackTarget)notFiring++;} }
                        if (R.length>=2 && B.length){
                            let rcx=0,rcy=0; for(const u of R){rcx+=u.x;rcy+=u.y;} rcx/=R.length;rcy/=R.length;
                            let bcx=0,bcy=0; for(const u of B){bcx+=u.x;bcy+=u.y;} bcx/=B.length;bcy/=B.length;
                            const ax=bcx-rcx,ay=bcy-rcy,al=Math.hypot(ax,ay)||1,ux=ax/al,uy=ay/al,pxx=-uy,pyy=ux;
                            let back=0,lft=0,rgt=0;
                            for(const f of B){const dx=f.x-rcx,dy=f.y-rcy,a2=dx*ux+dy*uy,sd=dx*pxx+dy*pyy; if(a2<-80)back++; if(sd<-120)lft++; else if(sd>120)rgt++;}
                            surrN++; if(back>0&&(lft>0||rgt>0)) surrTot++;
                        }
                        const ctrl = (typeof BATTLE_CONTROLLERS!=='undefined')?BATTLE_CONTROLLERS.get('battle-red-ai'):null;
                        const rk = ctrl && ctrl.blackboard && ctrl.blackboard.envelopment ? (ctrl.blackboard.envelopment.risk||0) : 0;
                        if (rk>maxRedRisk) maxRedRisk=rk;
                    }
                } } finally { SIM.headless = ph; }
                battleSelectorDisable();
                const red = battleOracleForceValue(true), blue = battleOracleForceValue(false);
                const winner = (SIM.battle && SIM.battle.winnerSide !== undefined) ? SIM.battle.winnerSide : null;
                return { ticks, redVal: Math.round(red.effective), blueVal: Math.round(blue.effective), redCount: red.count, blueCount: blue.count, diff: Math.round(red.effective - blue.effective), winnerRed: winner === true, winnerBlue: winner === false, decided: winner !== null, surroundedPct: surrN?Math.round(100*surrTot/surrN):0, maxRedRisk: +maxRedRisk.toFixed(2), inRangeNotFiringPct: fireTot?Math.round(100*notFiring/fireTot):0, blockedPct: redSamp?Math.round(100*blockedC/redSamp):0 };
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,300) }; } })()`;
            const rows = [];
            for (const SEED of SEEDS) {
                const m = await js(runMatch(SEED, true));
                const b = await js(runMatch(SEED, false));
                if ((m && m.err) || (b && b.err)) { console.log('SELECTORLIVE_HATA seed=' + SEED + ' ' + JSON.stringify(m && m.err ? m : b)); continue; }
                const row = { seed: SEED, modelDiff: m.diff, baseDiff: b.diff, delta: m.diff - b.diff, modelWin: m.winnerRed, baseWin: b.winnerRed, modelRed: m.redVal, modelBlue: m.blueVal, baseRed: b.redVal, baseBlue: b.blueVal, modelSurr: m.surroundedPct, baseSurr: b.surroundedPct, modelRisk: m.maxRedRisk, baseRisk: b.maxRedRisk };
                rows.push(row);
                console.log('SELECTORLIVE seed=' + SEED + ' model(red-blue)=' + m.diff + ' baseline=' + b.diff + ' Δ=' + row.delta + ' modelKazandı=' + m.winnerRed + ' baseKazandı=' + b.winnerRed + ' | sarılma% m=' + m.surroundedPct + ' b=' + b.surroundedPct + ' | menzilde-ateşsiz% m=' + m.inRangeNotFiringPct + ' b=' + b.inRangeNotFiringPct + ' | Hat-Kapalı% m=' + m.blockedPct + ' b=' + b.blockedPct);
            }
            if (rows.length) {
                const avgDelta = rows.reduce((a, r) => a + r.delta, 0) / rows.length;
                const modelWins = rows.filter(r => r.modelWin).length, baseWins = rows.filter(r => r.baseWin).length;
                const avgModel = rows.reduce((a, r) => a + r.modelDiff, 0) / rows.length;
                const avgBase = rows.reduce((a, r) => a + r.baseDiff, 0) / rows.length;
                console.log('SELECTORLIVE_OZET ' + JSON.stringify({
                    mac: rows.length, ortModelFark: +avgModel.toFixed(0), ortBaselineFark: +avgBase.toFixed(0),
                    ortDelta: +avgDelta.toFixed(0), modelGalibiyet: modelWins, baselineGalibiyet: baseWins,
                    yorum: avgDelta > 20 ? 'MODEL kod-AI baseline\'dan İYİ (canlı entegrasyon çalışıyor)' : (avgDelta < -20 ? 'model baseline\'dan KÖTÜ — sadakat/thrash/eğitim gözden geçir' : 'model ≈ baseline (nötr)')
                }));
            } else console.log('SELECTORLIVE_OZET {"mac":0}');
            console.log('SELECTORLIVE_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // ORACLE VERİ TOPLAMA: `--oracledata <rolloutSec> <ticks> <redAttack> <seedCount> [<outFile>]` → çok
    // (seed, karar-noktası) için collectDataset ile eğitim tuple'ları üretir, JSON dosyaya yazar (Faz 3 seçici
    // model eğitim seti). Her örnek = { stateFeatures, rows:[{features, reward}] } (listwise sıralama verisi).
    if (process.argv.includes('--oracledata')) {
        const di = process.argv.indexOf('--oracledata');
        const rolloutSec = parseFloat(process.argv[di + 1]) || 15;
        const decisionTicks = (process.argv[di + 2] || '600,720,840').split(',').map(n => parseInt(n, 10));
        const forceRedAttacker = process.argv[di + 3] === '1' || process.argv[di + 3] === 'redattack';
        const seedCount = Math.max(1, Math.min(16, parseInt(process.argv[di + 4] || '6', 10)));
        const outFile = process.argv[di + 5] || require('path').join(__dirname, '..', 'qa-runtime', 'oracle-dataset.json');
        // sideRed: hangi tarafı optimize et (true=kırmızı varsayılan; false=mavi → savunma modeli için)
        const sideRed = process.argv[di + 6] !== 'blue' && process.argv[di + 6] !== '0';
        const SEEDS = Array.from({ length: seedCount }, (_, i) => 1001 + i * 1111);
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            const examples = [];
            const setupJs = (SEED) => `(() => { try {
                openBattlefieldSession({ mode:'quick', mapId:-2, seed:${SEED}, attackerSide:${forceRedAttacker ? 'true' : 'false'}, durationSec:240, playerMoney:5000, enemyMoney:5000, deployRes:null, deployPool:null, techBonus:null, techBonusRed:null, show:false });
                battleDeployManifest(battleBuildArmyManifest(5000, { maxUnits: 40, combatFocused: true }), false, { source: 'oracledata-blue' });
                startBattle(); window.requestAnimationFrame = () => 0; return { ok:true };
            } catch(e){ return { err:e.message }; } })()`;
            let nActive = 0;
            for (const SEED of SEEDS) {
                for (const dt of decisionTicks) {
                    const s = await js(setupJs(SEED));
                    if (s && s.err) { console.log('ORACLEDATA_SETUP_HATA seed=' + SEED + ' ' + s.err); continue; }
                    const adv = await js(`(() => { try { const ph=SIM.headless; SIM.headless=true; try { while (SIM.tick < ${dt} && phase===PHASE.BATTLE) { simulationTime+=BATTLE_TICK_MS; gameTime+=BATTLE_TICK_SEC; stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, simulationTime); } } finally { SIM.headless=ph; } return { phase }; } catch(e){ return { err:e.message }; } })()`);
                    if (!adv || adv.err || adv.phase !== 'battle') continue;
                    const ev = await js(`(() => { try { return battleOracleEvaluate({ sideRed:${sideRed}, rolloutSec:${rolloutSec}, collectDataset:true }); } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,300) }; } })()`);
                    if (!ev || ev.err || !ev.dataset) { if (ev && ev.err) console.log('ORACLEDATA_EVAL_HATA seed=' + SEED + ' tick=' + dt + ' ' + ev.err); continue; }
                    ev.dataset.seed = SEED;
                    examples.push(ev.dataset);
                    if (ev.active) nActive++;
                    console.log('ORACLEDATA_ORNEK seed=' + SEED + ' tick=' + dt + ' aktif=' + ev.active + ' aday=' + ev.dataset.rows.length + ' odulAralik=[' + Math.min(...ev.dataset.rows.map(r => r.reward)).toFixed(0) + ',' + Math.max(...ev.dataset.rows.map(r => r.reward)).toFixed(0) + ']');
                }
            }
            // dosyaya yaz
            const stateLen = examples.length ? examples[0].stateFeatures.length : 0;
            const candLen = (examples.length && examples[0].rows.length) ? examples[0].rows[0].features.length : 0;
            const meta = {
                createdBy: 'oracledata', stateVersion: examples[0] ? examples[0].stateVersion : null,
                candidateVersion: examples[0] ? examples[0].candidateVersion : null,
                stateFeatureLen: stateLen, candidateFeatureLen: candLen,
                exampleCount: examples.length, activeCount: nActive,
                totalRows: examples.reduce((a, e) => a + e.rows.length, 0),
                seeds: SEEDS, decisionTicks, rolloutSec, redAttacker: forceRedAttacker
            };
            try {
                require('fs').mkdirSync(require('path').dirname(outFile), { recursive: true });
                require('fs').writeFileSync(outFile, JSON.stringify({ meta, examples }));
                console.log('ORACLEDATA_YAZILDI ' + outFile + ' ' + JSON.stringify(meta));
            } catch (e) { console.log('ORACLEDATA_YAZMA_HATA ' + e.message); }
            console.log('ORACLEDATA_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // SEKANS VERİ (GRU §2.3): `--oracleseq <rolloutSec> <ticks> <redAttack> <seedCount> [<outFile>]` → her maç
    // İÇİNDE ardışık karar noktalarında değerlendirir (maç sürdürülür, taze DEĞİL) → sıralı sekanslar üretir.
    // GRU maç-içi hafızayı bu sekanslardan öğrenir. (Eval fork-artığı küçük gürültü → GRU için kabul.)
    if (process.argv.includes('--oracleseq')) {
        const qi = process.argv.indexOf('--oracleseq');
        const rolloutSec = parseFloat(process.argv[qi + 1]) || 12;
        const decisionTicks = (process.argv[qi + 2] || '500,650,800,950').split(',').map(n => parseInt(n, 10));
        const forceRedAttacker = process.argv[qi + 3] === '1' || process.argv[qi + 3] === 'redattack';
        const seedCount = Math.max(1, Math.min(20, parseInt(process.argv[qi + 4] || '10', 10)));
        const outFile = process.argv[qi + 5] || require('path').join(__dirname, '..', 'qa-runtime', 'oracle-sequences.json');
        const SEEDS = Array.from({ length: seedCount }, (_, i) => 1001 + i * 1111);
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            const sequences = [];
            for (const SEED of SEEDS) {
                const s = await js(`(() => { try {
                    openBattlefieldSession({ mode:'quick', mapId:-2, seed:${SEED}, attackerSide:${forceRedAttacker ? 'true' : 'false'}, durationSec:240, playerMoney:5000, enemyMoney:5000, deployRes:null, deployPool:null, techBonus:null, techBonusRed:null, show:false });
                    battleDeployManifest(battleBuildArmyManifest(5000, { maxUnits: 40, combatFocused: true }), false, { source: 'oracleseq-blue' });
                    startBattle(); window.requestAnimationFrame = () => 0; return { ok:true };
                } catch(e){ return { err:e.message }; } })()`);
                if (s && s.err) { console.log('ORACLESEQ_SETUP_HATA seed=' + SEED + ' ' + s.err); continue; }
                const seq = [];
                for (const dt of decisionTicks) {
                    const adv = await js(`(() => { try { const ph=SIM.headless; SIM.headless=true; try { while (SIM.tick < ${dt} && phase===PHASE.BATTLE) { simulationTime+=BATTLE_TICK_MS; gameTime+=BATTLE_TICK_SEC; stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, simulationTime); } } finally { SIM.headless=ph; } return { phase }; } catch(e){ return { err:e.message }; } })()`);
                    if (!adv || adv.err || adv.phase !== 'battle') break;
                    const ev = await js(`(() => { try { const e = battleOracleEvaluate({ sideRed:true, rolloutSec:${rolloutSec}, collectDataset:true }); return e && e.dataset ? { d:e.dataset, active:e.active } : { skip:true }; } catch(e){ return { err:e.message }; } })()`);
                    if (!ev || ev.err || ev.skip || !ev.active) continue;
                    seq.push(ev.d);
                }
                if (seq.length >= 2) { sequences.push(seq); console.log('ORACLESEQ seed=' + SEED + ' adım=' + seq.length); }
            }
            const meta = {
                createdBy: 'oracleseq', stateVersion: sequences[0] ? sequences[0][0].stateVersion : null,
                candidateVersion: sequences[0] ? sequences[0][0].candidateVersion : null,
                sequenceCount: sequences.length, totalSteps: sequences.reduce((a, s) => a + s.length, 0),
                seeds: SEEDS, decisionTicks, rolloutSec, redAttacker: forceRedAttacker
            };
            try {
                require('fs').mkdirSync(require('path').dirname(outFile), { recursive: true });
                require('fs').writeFileSync(outFile, JSON.stringify({ meta, sequences }));
                console.log('ORACLESEQ_YAZILDI ' + outFile + ' ' + JSON.stringify(meta));
            } catch (e) { console.log('ORACLESEQ_YAZMA_HATA ' + e.message); }
            console.log('ORACLESEQ_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // DAGGER (on-policy): `--oracledagger <modelFile> <rolloutSec> <ticks> <redAttack> <seedCount> [<outFile>]`
    // Model savaşı SÜRERKEN (selector aktif, tick≥minTick) her karar noktasında modeli geçici kapatıp TEMİZ
    // Oracle etiketi alır → modelin KENDİ ziyaret ettiği (on-policy) durumları etiketler. Dağıtım kaymasını
    // kapatır: model kendi trajesindeki durumlarda doğru aday seçmeyi öğrenir. (DAgger, review: on-policy düzeltme.)
    if (process.argv.includes('--oracledagger')) {
        const gi = process.argv.indexOf('--oracledagger');
        const modelFile = process.argv[gi + 1] || require('path').join(__dirname, '..', 'qa-runtime', 'selector-model.json');
        const rolloutSec = parseFloat(process.argv[gi + 2]) || 12;
        const decisionTicks = (process.argv[gi + 3] || '550,700,850,1000,1150,1300').split(',').map(n => parseInt(n, 10));
        const forceRedAttacker = process.argv[gi + 4] === '1' || process.argv[gi + 4] === 'redattack';
        const seedCount = Math.max(1, Math.min(20, parseInt(process.argv[gi + 5] || '10', 10)));
        const outFile = process.argv[gi + 6] || require('path').join(__dirname, '..', 'qa-runtime', 'oracle-dagger.json');
        // LİG: rakip (blue) çeşitliliği — bütçe + kompozisyon farklı rakiplere karşı veri
        const blueBudget = parseInt(process.argv[gi + 7] || '1400', 10);
        const blueCombat = (process.argv[gi + 8] || 'combat') !== 'mixed';   // 'mixed' → combatFocused=false
        // TAKTİK-VEKİLİ modu: SURROGATE=1 → mavi (rakip) insan-gibi taktiği (konsantre+odaklı-ateş) oynar,
        // kırmızı (model) VARIED ordu komuta eder → AI insan-tarzına karşı, çeşitli ordularla eğitilir.
        const SURRO = process.env.SURROGATE === '1';
        const minTick = Math.min(...decisionTicks) - 50;
        let MODEL = null;
        try { MODEL = JSON.parse(require('fs').readFileSync(modelFile, 'utf8')); }
        catch (e) { console.log('DAGGER_MODEL_HATA ' + e.message); app.exit(1); return; }
        console.log('DAGGER_MODEL yüklendi D=' + MODEL.D + ' H=' + MODEL.H + ' minTick=' + minTick);
        const SEEDS = Array.from({ length: seedCount }, (_, i) => 1001 + i * 1111);
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            const examples = [];
            for (const SEED of SEEDS) {
                const s = await js(`(() => { try {
                    if (${SURRO}) { BATTLE_FORCE_VARIED = true; }
                    openBattlefieldSession({ mode:'quick', mapId:-2, seed:${SEED}, attackerSide:${forceRedAttacker ? 'true' : 'false'}, durationSec:240, playerMoney:5000, enemyMoney:5000, deployRes:null, deployPool:null, techBonus:null, techBonusRed:null, show:false });
                    battleDeployManifest(battleBuildArmyManifest(${blueBudget}, { maxUnits: 16, combatFocused: ${blueCombat}, varied: ${SURRO} }), false, { source: 'dagger-blue' });
                    if (${SURRO}) { BATTLE_SURROGATE_SIDE = false; BATTLE_SURROGATE_DEFENSIVE = ${forceRedAttacker}; }   // mavi=vekil; kırmızı saldırırsa mavi SAVUNUR (usta insan savunması)
                    startBattle(); window.requestAnimationFrame = () => 0;
                    battleSelectorEnable(${JSON.stringify(MODEL)}, 'battle-red-ai'); BATTLE_SELECTOR_MIN_TICK = ${minTick}; BATTLE_SELECTOR_MAX_TICK = 999999;
                    return { ok:true };
                } catch(e){ return { err:e.message }; } })()`);
                if (s && s.err) { console.log('DAGGER_SETUP_HATA seed=' + SEED + ' ' + s.err); continue; }
                let collected = 0;
                for (const dt of decisionTicks) {
                    // MODEL SÜRERKEN karar tik'ine ilerle (on-policy trajesi)
                    const adv = await js(`(() => { try { const ph=SIM.headless; SIM.headless=true; try { while (SIM.tick < ${dt} && phase===PHASE.BATTLE) { simulationTime+=BATTLE_TICK_MS; gameTime+=BATTLE_TICK_SEC; stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, simulationTime); } } finally { SIM.headless=ph; } return { phase, tick:SIM.tick }; } catch(e){ return { err:e.message }; } })()`);
                    if (!adv || adv.err || adv.phase !== 'battle') break;
                    // MODELİ KAPAT → temiz Oracle etiketi (default rollout kod-AI olsun) → tekrar AÇ
                    const ev = await js(`(() => { try {
                        const savedModels = BATTLE_SELECTOR_MODELS; BATTLE_SELECTOR_MODELS = {};
                        const e = battleOracleEvaluate({ sideRed:true, rolloutSec:${rolloutSec}, collectDataset:true });
                        BATTLE_SELECTOR_MODELS = savedModels;
                        return e && e.dataset ? { d:e.dataset, active:e.active } : { skip:true };
                    } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,300) }; } })()`);
                    if (!ev || ev.err || ev.skip || !ev.active) continue;
                    ev.d.seed = SEED; ev.d.onPolicy = true;
                    examples.push(ev.d); collected++;
                }
                console.log('DAGGER seed=' + SEED + ' on-policy örnek=' + collected);
            }
            const meta = {
                createdBy: 'oracledagger', onPolicy: true, modelD: MODEL.D,
                stateVersion: examples[0] ? examples[0].stateVersion : null, candidateVersion: examples[0] ? examples[0].candidateVersion : null,
                exampleCount: examples.length, totalRows: examples.reduce((a, e) => a + e.rows.length, 0),
                seeds: SEEDS, decisionTicks, rolloutSec, redAttacker: forceRedAttacker
            };
            try {
                require('fs').mkdirSync(require('path').dirname(outFile), { recursive: true });
                require('fs').writeFileSync(outFile, JSON.stringify({ meta, examples }));
                console.log('DAGGER_YAZILDI ' + outFile + ' ' + JSON.stringify(meta));
            } catch (e) { console.log('DAGGER_YAZMA_HATA ' + e.message); }
            console.log('DAGGER_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // TEŞHİS (vs1600 zaafı): `--diagvs <model> <blueBudget> <ticks>` → SURROGATE=1 maçta, her karar tik'inde
    // Oracle-en-iyi aday (intent+ödül) vs kod-AI-default vs MODEL-seçimi → gramer mi yetersiz, model mi yanlış seçiyor?
    if (process.argv.includes('--diagvs')) {
        const di = process.argv.indexOf('--diagvs');
        const modelFile = process.argv[di + 1] || require('path').join(__dirname, '..', 'qa-runtime', 'selector-model.json');
        const blueBudget = parseInt(process.argv[di + 2] || '1600', 10);
        const ticks = (process.argv[di + 3] || '700,900,1100').split(',').map(n => parseInt(n, 10));
        let MODEL = null;
        try { MODEL = JSON.parse(require('fs').readFileSync(modelFile, 'utf8')); } catch (e) { console.log('DIAG_HATA ' + e.message); app.exit(1); return; }
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            const redDefends = process.env.DEF === '1';   // DEF=1 → kırmızı(AI) SAVUNUR, mavi(vekil) SALDIRIR (kullanıcının gerçek senaryosu)
            await js(`(() => { BATTLE_FORCE_VARIED = true; window.__DIAGMODEL = ${JSON.stringify(MODEL)};
                openBattlefieldSession({ mode:'quick', mapId:-2, seed:2112, attackerSide:${redDefends ? 'false' : 'true'}, durationSec:240, playerMoney:5000, enemyMoney:5000, deployRes:null, deployPool:null, techBonus:null, techBonusRed:null, show:false });
                battleDeployManifest(battleBuildArmyManifest(${blueBudget}, { maxUnits:16, combatFocused:true, varied:true }), false, { source:'diag-blue' });
                BATTLE_SURROGATE_SIDE = false; BATTLE_SURROGATE_DEFENSIVE = ${redDefends ? 'false' : 'true'}; startBattle(); window.requestAnimationFrame = () => 0; return 1; })()`);
            console.log('DIAG vs' + blueBudget + ' (SURROGATE=insan-taktiği). intent’ler: attack/assault=saldırı, defend/hold/screen=savunma\n');
            for (const dt of ticks) {
                const r = await js(`(() => { try {
                    const ph=SIM.headless; SIM.headless=true; try { while (SIM.tick < ${dt} && phase===PHASE.BATTLE) { simulationTime+=BATTLE_TICK_MS; gameTime+=BATTLE_TICK_SEC; stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, simulationTime); } } finally { SIM.headless=ph; }
                    if (phase!==PHASE.BATTLE) return { done:true };
                    const savedModels = BATTLE_SELECTOR_MODELS; BATTLE_SELECTOR_MODELS = {};
                    const ev = battleOracleEvaluate({ sideRed:true, rolloutSec:10, collectDataset:true });
                    BATTLE_SELECTOR_MODELS = savedModels;
                    if (!ev || !ev.dataset || !ev.active) return { skip:true, tick:SIM.tick };
                    const ds = ev.dataset, rew = ds.rows.map(r=>r.reward), best = Math.max(...rew);
                    let bs=-Infinity, pick=0; for (let c=0;c<ds.rows.length;c++){ const x=ds.stateFeatures.concat(ds.rows[c].features); const s=selForward(window.__DIAGMODEL,x).out; if(s>bs){bs=s;pick=c;} }
                    const byIntent = {}; for (const row of ds.rows) { if (byIntent[row.intent]==null || row.reward>byIntent[row.intent]) byIntent[row.intent]=row.reward; }
                    return { tick:SIM.tick, oracle:ev.oracle, chosen:ev.chosen, top5:ev.top5, byIntent,
                        modelPick:{ intent:ds.rows[pick].intent, sector:ds.rows[pick].mainSector, reward:ds.rows[pick].reward },
                        modelRegret:+(best-rew[pick]).toFixed(1) };
                } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,200) }; } })()`);
                if (!r || r.done) { console.log('  (maç bitti)'); break; }
                if (r.err) { console.log('  tick=' + dt + ' HATA ' + r.err); continue; }
                if (r.skip) { console.log('  tick=' + r.tick + ' (temas yok, aday yok)'); continue; }
                console.log('── tick=' + r.tick + ' ──');
                console.log('  Oracle-EN-İYİ : ' + r.oracle.intent + '/' + r.oracle.mainSector + '  ödül=' + r.oracle.scalar);
                console.log('  kod-AI-default: ödül=' + r.chosen.scalar);
                console.log('  MODEL-seçim   : ' + r.modelPick.intent + '/' + r.modelPick.sector + '  ödül=' + r.modelPick.reward + '  → regret=' + r.modelRegret);
                console.log('  intent-başı-EN-İYİ: ' + Object.entries(r.byIntent).sort((a,b)=>b[1]-a[1]).map(([k,v]) => k + '(' + v.toFixed(0) + ')').join('  '));
            }
            console.log('\nYORUM: Oracle-en-iyi SAVUNMA ise + model SALDIRI seçiyorsa → MODEL sorunu (eğitim).');
            console.log('       Oracle-en-iyi de düşük/saldırı + hepsi kötü ise → GRAMER sorunu (savunma operasyonu yok).');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // BİRİM İZLE: `--unitdump <json> <unitId> <tick>` → kaydı verilen tick'e replay eder, o birimin TÜM
    // alanlarını (hash-dışı dahil) dökip kayıtlı örnekle karşılaştırır → hash-dışı gizli sapmayı bulur.
    if (process.argv.includes('--unitdump')) {
        const i = process.argv.indexOf('--unitdump');
        let file = process.argv[i + 1], uid = parseInt(process.argv[i + 2] || '23', 10), ticks = (process.argv[i + 3] || '430,440,450').split(',').map(n => parseInt(n, 10));
        if (!file || file.startsWith('--')) { try { const dl = require('path').join(require('os').homedir(), 'Downloads'); const fl = require('fs').readdirSync(dl).filter(f => f.startsWith('pixel-rts-ham-savas-kaydi-') && f.endsWith('.json')).map(f => ({ f, t: require('fs').statSync(require('path').join(dl, f)).mtimeMs })).sort((a, b) => b.t - a.t); if (fl.length) file = require('path').join(dl, fl[0].f); } catch (e) {} }
        let rep; try { rep = (JSON.parse(require('fs').readFileSync(file, 'utf8')).replay); } catch (e) { console.log('UNITDUMP_FAIL ' + e.message); app.exit(1); return; }
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            const out = await js(`(() => { try {
                const base = ${JSON.stringify(rep)}; const uid = ${uid}; const ticks = ${JSON.stringify(ticks)};
                const samples = (base.telemetry&&base.telemetry.samples)||[];
                const results = [];
                for (const T of ticks) {
                    const r = runBattleReplayTicks(base, T);
                    const u = SIM.units.find(z=>z.id===uid);
                    const rep = u ? { x:+u.x.toFixed(3), y:+u.y.toFixed(3), tX:+(u.targetX||0).toFixed(3), tY:+(u.targetY||0).toFixed(3), mov:!!u.isMovingToManualTarget, mmt:(u.manualMoveTarget?(+u.manualMoveTarget.x.toFixed(1)+','+ +u.manualMoveTarget.y.toFixed(1)):null), mt:(u.manualTarget?u.manualTarget.id:null), scanTimer:u.scanTimer, cs:u.combatState, attId:(u.attackTarget&&!u.attackTarget.dead?u.attackTarget.id:0), buildTrench:(u.buildTrenchTimer||0), navLen:(u.navPath?u.navPath.length:0) } : null;
                    const smp = samples.find(s=>s.tick===T); const su = smp ? smp.units.find(z=>z.id===uid) : null;
                    const kayit = su ? { x:+su.x.toFixed(3), y:+su.y.toFixed(3), tX:+(su.targetX||0).toFixed(3), tY:+(su.targetY||0).toFixed(3), mov:!!su.isMovingToManualTarget, mt:su.manualTargetId, cs:su.combatState, attId:su.attackTargetId, navLen:su.navPathLength } : null;
                    results.push({ tick:T, replay:rep, kayit:kayit });
                }
                return results;
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,400) }; } })()`);
            console.log('UNITDUMP ' + JSON.stringify(out));
            console.log('UNITDUMP_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // FIX DOĞRULAMA: `--fixverify` → gerçek quick-match deploy (kesirli pozisyonlar) → capture (tam-precision
    // fix'li) → capture'ın >2 ondalık koruduğunu + uzun canlı pump'ta REPLAY sıfır sapmasını teyit eder.
    if (process.argv.includes('--fixverify')) {
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            const out = await js(`(() => { try {
                quickMatchStart();
                const blueManifest = battleBuildArmyManifest(1200, { maxUnits: 14, combatFocused: true });
                battleDeployManifest(blueManifest, false, { source: 'fixverify-blue' });
                startBattle();
                // Gerçek oyundaki gibi KESİRLİ sub-0.01 pozisyonlar enjekte et (deploy çakışma-oturmasının
                // ürettiği duruma denk) → sonra YENİDEN capture et. Fix'liyse tam precision korunur.
                let k = 0; for (const u of SIM.units) { if (u.dead) continue; u.x = u.x + 0.0033333 + k*1e-4; u.y = u.y + 0.0071717; k++; }
                BATTLE_REPLAY.events = []; BATTLE_REPLAY.hashes = [];
                if (BATTLE_REPLAY.telemetry) { BATTLE_REPLAY.telemetry.samples = []; BATTLE_REPLAY.telemetry.combatEvents = []; BATTLE_REPLAY.telemetry.controllerDecisions = []; }
                battleCaptureInitialState();
                // capture fix'li mi: kaydedilen initialState x'lerinde >2 ondalık VAR mı (tam precision korundu mu)
                const iu = BATTLE_REPLAY.initialState.units;
                let fracX = 0, ornek = null;
                for (const u of iu) { const s = String(u.x); const dec = s.includes('.') ? s.split('.')[1].length : 0; if (dec > 2) { fracX++; if(!ornek) ornek = { id:u.id, x:u.x }; } }
                // uzun canlı pump → replay → sapma
                window.requestAnimationFrame = () => 0; lastFrameTime = 0;
                for (let i = 1; i <= 400; i++) { gameLoop(i * 50); if (SIM.battle && SIM.battle.winnerSide !== null) break; }
                const rec = exportBattleReplay();
                const minimal = { version:rec.version, engineVersion:rec.engineVersion, session:rec.session, initialState:rec.initialState, events:rec.events, hashes:rec.hashes };
                const r = runBattleReplayTicks(minimal);
                const repMap = new Map((r.hashes||[]).map(h=>[h.tick,h.hash]));
                let firstDiv=null; for (const h of (rec.hashes||[])){ if(repMap.has(h.tick) && repMap.get(h.tick)!==h.hash){ firstDiv={tick:h.tick, kayit:h.hash, replay:repMap.get(h.tick)}; break; } }
                return { canliTick: SIM.tick, hashSayisi:(rec.hashes||[]).length, capturedFullPrecisionUnits: fracX, ornekTamX: ornek, firstDivergence: firstDiv };
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,400) }; } })()`);
            console.log('FIXVERIFY ' + JSON.stringify(out));
            console.log('FIXVERIFY_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // PRECISION TESTİ: `--precisiontest <json>` → unit 14'ün başlangıç x'ini ince grid'le perturbe eder,
    // tick-20 hash'in kayıtlı "expected" (dcb24eaf) değerine dönüp dönmediğini arar. Dönüyorsa sapma
    // KESİN olarak initialState'te x/y'nin 2 ondalığa yuvarlanmasından (tam-precision kaybı) kaynaklanıyor.
    if (process.argv.includes('--precisiontest')) {
        const idx = process.argv.indexOf('--precisiontest');
        let file = process.argv[idx + 1];
        if (!file || file.startsWith('--')) {
            try { const dl = require('path').join(require('os').homedir(), 'Downloads'); const fl = require('fs').readdirSync(dl).filter(f => f.startsWith('pixel-rts-ham-savas-kaydi-') && f.endsWith('.json')).map(f => ({ f, t: require('fs').statSync(require('path').join(dl, f)).mtimeMs })).sort((a, b) => b.t - a.t); if (fl.length) file = require('path').join(dl, fl[0].f); } catch (e) {}
        }
        let raw; try { raw = JSON.parse(require('fs').readFileSync(file, 'utf8')); } catch (e) { console.log('PRECTEST_FAIL ' + e.message); app.exit(1); return; }
        const rep = raw.replay || raw;
        const expectedTick20 = (rep.hashes || []).find(h => h.tick === 20);
        createWindow();
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('did-finish-load', async () => {
            await sleep(1400);
            const res = await js(`(() => { try {
                const base = ${JSON.stringify(rep)};
                const expected = ${JSON.stringify(expectedTick20 ? expectedTick20.hash : null)};
                const results = [];
                // dx grid: -0.01 .. +0.01, 0.001 adım. Her denemede unit 14'ün başlangıç x'i base+dx.
                const baseX = base.initialState.units.find(u=>u.id===14).x;
                for (let i=-10; i<=10; i++) {
                    const dx = i/1000;
                    const mod = JSON.parse(JSON.stringify(base));
                    const u14 = mod.initialState.units.find(u=>u.id===14);
                    u14.x = baseX + dx;
                    const r = runBattleReplayTicks(mod, 20);
                    const h20 = (r.hashes||[]).find(h=>h.tick===20);
                    const hash = h20 ? h20.hash : (r.hash||null);
                    results.push({ dx:+dx.toFixed(3), x:+u14.x.toFixed(4), hash, eslesme: hash===expected });
                }
                const hit = results.find(r=>r.eslesme);
                return { expected, baseX, hit: hit||null, tumSonuc: results };
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,400) }; } })()`);
            console.log('PRECTEST ' + JSON.stringify(res));
            console.log('PRECTEST_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // KAYIT DENETİMİ: `--replaycheck <json>` → ham savaş kaydını REPLAY eder ve yeniden
    // hesaplanan durum hash'lerini kayıtlı hash'lerle tik tik karşılaştırır. Sapma YOKSA
    // kayıt savaşı birebir yeniden üretiyor = sim'i etkileyen her şey kaydedilmiş. Sapma
    // VARSA o tik'ten önce canlıda olan ama kaydedilmeyen bir şey var = kayıt boşluğu.
    if (process.argv.includes('--replaycheck')) {
        const idx = process.argv.indexOf('--replaycheck');
        const file = process.argv[idx + 1];
        const fsr = require('fs');
        let raw;
        try { raw = JSON.parse(fsr.readFileSync(file, 'utf8')); }
        catch (e) { console.log('REPLAYCHECK_FAIL okuma: ' + e.message); app.exit(1); return; }
        const rep = raw.replay || raw;
        const minimal = {
            version: rep.version, engineVersion: rep.engineVersion, session: rep.session,
            initialState: rep.initialState, events: rep.events, hashes: rep.hashes,
            _samples: (rep.telemetry && rep.telemetry.samples) || []   // sapma tik'inde alan-farkı için
        };
        createWindow();
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.log('KONSOL: ' + message); });
        win.webContents.on('did-finish-load', async () => {
            await new Promise(r => setTimeout(r, 1500));
            const setup = await js('(() => { try { window.__R = ' + JSON.stringify(minimal) + '; return { srcEngine:(typeof BATTLE_ENGINE_VERSION!=="undefined"?BATTLE_ENGINE_VERSION:"?"), jsonEngine:window.__R.engineVersion, events:window.__R.events.length, hashes:window.__R.hashes.length, initUnits:(window.__R.initialState.units||[]).length, session:window.__R.session }; } catch(e){ return {err:e.message}; } })()');
            console.log('REPLAYCHECK_SETUP ' + JSON.stringify(setup));
            const res = await js(`(() => { try {
                const r = runBattleReplayTicks(window.__R);
                const recorded = window.__R.hashes || [];
                const recordedLastTick = Math.max(0, ...recorded.map(h => h.tick || 0));
                const out = { initialMatched: r.initial && r.initial.matched, divergence: r.divergence,
                    replayReachedTick: r.tick, recordedLastTick, recordedHashes: recorded.length };
                // SAPMA TİK'İNDE ALAN FARKI: replay birimleri (SIM.units, sapma tik'inde) vs kayıtlı örnek
                if (r.divergence) {
                    const dt = r.divergence.tick;
                    const sample = (window.__R._samples || []).find(s => s.tick === dt);
                    if (sample) {
                        const recU = new Map((sample.units || []).map(u => [u.id, u]));
                        const diffs = [];
                        for (const u of SIM.units) {
                            const rec = recU.get(u.id); if (!rec) { diffs.push({ id: u.id, fark: 'replay-fazla' }); continue; }
                            const d = {};
                            // HASH-BİREBİR karşılaştırma: hash Math.round(field*100) kullanıyor → aynı ölçekte
                            // tam-sayı karşılaştır (tolerans YOK). Gevşek tolerans (0.5) hash'i değiştiren ama
                            // görünmeyen sapmaları kaçırıyordu — bu yüzden "sapanBirimSayisi:0 ama hash sapıyor".
                            const cmpH = (k, rv, lv, scale) => { const a = Math.round((rv ?? 0) * scale), b = Math.round((lv ?? 0) * scale); if (a !== b) d[k] = { kayit: a / scale, replay: b / scale, ham: { kayit: rv, replay: lv } }; };
                            cmpH('x', rec.x, u.x, 100); cmpH('y', rec.y, u.y, 100); cmpH('hp', rec.hp, u.hp, 100);
                            cmpH('ammo', rec.ammo, u.ammo, 100); cmpH('suppression', rec.suppression, u.suppression, 100);
                            cmpH('targetX', rec.targetX, u.targetX, 100); cmpH('targetY', rec.targetY, u.targetY, 100);   // hash: round(*100)
                            // bilgi amaçlı (hash'te DEĞİL): panic/facing/speed — gevşek tolerans yeterli
                            const cmp = (k, rv, lv, tol) => { if (Math.abs((rv ?? 0) - (lv ?? 0)) > (tol || 0)) d['~'+k] = { kayit: +(+rv).toFixed(3), replay: +(+lv).toFixed(3) }; };
                            cmp('panic', rec.panic, u.panic, 0.5); cmp('facingAngle', rec.facingAngle, u.facingAngle, 0.01); cmp('speed', rec.speed, u.speed, 0.01);
                            const uAt = (u.attackTarget && !u.attackTarget.dead) ? u.attackTarget.id : 0;
                            if (rec.attackTargetId != null && (rec.attackTargetId||0) !== uAt) d.attackTarget = { kayit: rec.attackTargetId||0, replay: uAt };
                            if (rec.isMovingToManualTarget != null && (!!rec.isMovingToManualTarget) !== (!!u.isMovingToManualTarget)) d.movingManual = { kayit: !!rec.isMovingToManualTarget, replay: !!u.isMovingToManualTarget };
                            if ((rec.combatState||'') !== (u.combatState||'')) d.combatState = { kayit: rec.combatState, replay: u.combatState };
                            if ((!!rec.fleeing) !== (!!u.isFleeing)) d.fleeing = { kayit: !!rec.fleeing, replay: !!u.isFleeing };
                            if ((!!rec.enemyInVision) !== (!!u.enemyInVision)) d.enemyInVision = { kayit: !!rec.enemyInVision, replay: !!u.enemyInVision };
                            if (rec.owner != null && (rec.owner||'') !== (u.controlOwner||'')) d.owner = { kayit: rec.owner, replay: u.controlOwner };
                            if (rec.controllerId !== undefined && (rec.controllerId||'') !== (u.controllerId||'')) d.controllerId = { kayit: rec.controllerId, replay: u.controllerId };
                            if (Object.keys(d).length) diffs.push({ id: u.id, side: u.isRed?'red':'blue', type: u.type, ...d });
                        }
                        out.sapmaTik = dt; out.sapanBirimSayisi = diffs.length; out.ilkFarklar = diffs.slice(0, 6);
                        // battle bloğu (hash'te: elapsedSec*1000 + attackerSide + winnerSide + outcomeReason)
                        const sb = sample.battle || {}, lb = SIM.battle || {};
                        out.battleFark = {
                            elapsedKayit: sb.elapsedSec, elapsedReplay: +(lb.elapsedSec||0).toFixed(4), elapsedHashEsit: (Math.round((sb.elapsedSec||0)*1000) === Math.round((lb.elapsedSec||0)*1000)),
                            winnerKayit: sb.winnerSide ?? null, winnerReplay: lb.winnerSide ?? null,
                            outcomeKayit: sb.outcomeReason||null, outcomeReplay: lb.outcomeReason||null
                        };
                        out.destekCooldown = (typeof supportCooldowns!=='undefined') ? JSON.stringify(supportCooldowns) : null;
                        out.trenchSayisi = (SIM.trenches||[]).length;
                        // BİRİM SAYISI/VARLIK: kayıt vs replay (kayıtta olup replay'de olmayan bir birim → farklı hash)
                        const recIds = new Set((sample.units||[]).map(u=>u.id)), repIds = new Set(SIM.units.filter(u=>!u.dead).map(u=>u.id));
                        const kayitFazla = [...recIds].filter(id=>!repIds.has(id)), replayFazla = [...repIds].filter(id=>!recIds.has(id));
                        out.birimSayisi = { kayit: recIds.size, replay: repIds.size, kayittaFazla: kayitFazla, replaydeFazla: replayFazla };
                        // ally karşılaştırması (örnekte varsa) + pendingSupportSpawns
                        let allyFark=[]; for (const u of SIM.units){ if(u.dead)continue; const rec=recU.get(u.id); if(rec && rec.ally!=null && (!!rec.ally)!==(!!u.ally)) allyFark.push(u.id); }
                        out.allyFark = allyFark;
                        out.pendingSupport = (typeof pendingSupportSpawns!=='undefined') ? (pendingSupportSpawns||[]).length : null;
                        // KESİN: hash-parça karşılaştırması (hangi bölüm sapıyor: g=global b=battle u=birimler t=trench s=destek)
                        if (sample.hashParts && typeof battleStateHashParts==='function') {
                            const rp = sample.hashParts, lp = battleStateHashParts(), parcaFark = {};
                            for (const k of ['g','b','u','t','s']) if (rp[k] !== lp[k]) parcaFark[k] = { kayit: rp[k], replay: lp[k] };
                            out.hashParcaFark = parcaFark;
                        }
                        // KESİN: kayıtlı simRng/para vs replay (sapma RNG'de mi bookkeeping'de mi hedefte mi?)
                        out.simRng = { kayit: (sample.simRng ?? null), replay: (typeof SIM_RNG!=='undefined'?SIM_RNG.state>>>0:null), esit: (sample.simRng === (SIM_RNG.state>>>0)) };
                        out.para = { pKayit: sample.pMoney, pReplay: Math.round((player.money||0)*100)/100, eKayit: sample.eMoney, eReplay: Math.round((enemy.money||0)*100)/100 };
                        // GLOBAL/BOOKKEEPING (örnekte yok → replay değerini raporla): RNG, para, elapsed, hedefleme
                        let tgtDiffN = 0, atkDiffN = 0;
                        out.replayGlobals = {
                            simRngState: (typeof SIM_RNG!=='undefined'?SIM_RNG.state>>>0:null),
                            playerMoney: (typeof player!=='undefined'?Math.round(player.money||0):null),
                            enemyMoney: (typeof enemy!=='undefined'?Math.round(enemy.money||0):null),
                            elapsedSec: (SIM.battle?+(SIM.battle.elapsedSec||0).toFixed(4):null),
                            trenchCount: (SIM.trenches||[]).length, activeSupports: (typeof activeSupports!=='undefined'?activeSupports.length:null),
                            unitsWithTarget: SIM.units.filter(u=>!u.dead && u.attackTarget).length,
                            unitsMovingManual: SIM.units.filter(u=>!u.dead && u.isMovingToManualTarget).length
                        };
                    } else out.not = 'sapma tik icin ornek yok';
                }
                return out;
            } catch(e){ return { err: e.message, stack:(e.stack||'').slice(0,400) }; } })()`);
            console.log('REPLAYCHECK_RESULT ' + JSON.stringify(res));
            console.log('REPLAYCHECK_OK');
            setTimeout(() => app.exit(0), 300);
        });
        return;
    }

    // SAVAŞ TESTİ: `--battletest [--shots <klasör>]` → Hızlı Maç ile çizilen haritada
    // deploy fazına girer, yakın + uzak ekran görüntüsü alır (arazi doğru render'lanıyor mu).
    if (BATTLETEST) {
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
                    sessionMode: (typeof BATTLE_SESSION !== 'undefined') ? BATTLE_SESSION.mode : '?',
                    engineVersion: (typeof BATTLE_SESSION !== 'undefined') ? BATTLE_SESSION.engineVersion : '?',
                    tickMs: (typeof BATTLE_TICK_MS !== 'undefined') ? BATTLE_TICK_MS : -1,
                    sameStep: typeof stepSim === 'function',
                    hashReady: typeof battleStateHash === 'function',
                    replayReady: typeof exportBattleReplay === 'function',
                    controllerReady: typeof BattleController === 'function' && typeof applyBattleOrder === 'function',
                    perceptionReady: typeof BattlePerception === 'function',
                    situationReady: typeof SituationAnalyzer === 'function' &&
                        typeof CourseOfActionGenerator === 'function' &&
                        typeof CourseOfActionEvaluator === 'function',
                    commitmentReady: typeof PlanCommitmentManager === 'function' &&
                        typeof evaluatePlanAbort === 'function',
                    planningReady: typeof BattleOperationalPlanner === 'function' &&
                        typeof ForceOrganizer === 'function' &&
                        typeof OperationalObjectiveSelector === 'function' &&
                        typeof TaskContractPlanner === 'function',
                    executionReady: typeof TaskExecutionManager === 'function' &&
                        typeof TASK_EXECUTION_PHASE === 'object',
                    bootstrapReady: typeof battleDefaultControllerConfigs === 'function' &&
                        typeof battleControllersSyncOwnership === 'function',
                    deploymentReady: typeof battleBuildArmyManifest === 'function' &&
                        typeof battleAutoDeploySession === 'function' &&
                        typeof openAIVsAILab === 'function',
                    deployEnemyHidden: typeof battleUnitVisibleToViewer === 'function' &&
                        SIM.units.filter(unit => unit.isRed !== myCanonicalSide)
                            .every(unit => !battleUnitVisibleToViewer(unit, myCanonicalSide, phase)),
                    autoDeployedRedUnits: SIM.units.filter(unit => !unit.dead && unit.isRed).length,
                    autoDeployment: BATTLE_SESSION.aiDeployment || null,
                    grid: (typeof terrainGrid !== 'undefined' && terrainGrid) ? terrainGrid.length : -1,
                    feats: (typeof terrainFeatures !== 'undefined') ? terrainFeatures.length : -1 };
            } catch (e) { return { err: e.message }; } })()`);
            // ── MOTOR SURUMU KONTROLU (bayat sabit duzeltildi, 2026-08-08) ──
            // ESKI: `info.engineVersion !== 'battlefield-v2-fixed50-microfix3'` — ANTIK bir dizge
            // SABIT yazilmisti. Motor o gunden beri v4'e gecti ve surumu davranis degisikliklerini
            // isaretlemek icin BILEREK yukseltiyoruz. Yani bu kapi her surum yukseltmesinde
            // kendiliginden KIRMIZIYA donuyordu ve gercek regresyonlari gizliyordu.
            // YENI: sabit dizge yerine, SAYFANIN bildirdigi surum DISKTEKI kaynakla eslesiyor mu
            // diye bakilir. Kontrolun asil amaci buydu: "yuklenen motor, sandigimiz motor mu?"
            // Boylece surum yukseltmek kapiyi kirmizilastirmaz ama BAYAT/yanlis build yakalanir.
            let _beklenenMotor = null;
            try {
                const _src = fsx2.readFileSync(path.join(__dirname, '..', 'js', 'BattleSession.js'), 'utf8');
                const _m = /BATTLE_ENGINE_VERSION\s*=\s*'([^']+)'/.exec(_src);
                if (_m) _beklenenMotor = _m[1];
            } catch (e) { /* okunamazsa asagida raporlanir */ }
            if (!info || info.sessionMode !== 'quick' ||
                !info.engineVersion || !_beklenenMotor || info.engineVersion !== _beklenenMotor ||
                info.tickMs !== 50 || !info.sameStep || !info.hashReady || !info.replayReady) {
                problems.push('ortak savaş motoru doğrulanamadı: ' + JSON.stringify(info));
            } else if (!info.controllerReady || !info.perceptionReady ||
                !info.situationReady || !info.commitmentReady ||
                !info.planningReady || !info.executionReady || !info.bootstrapReady ||
                !info.deploymentReady || !info.deployEnemyHidden ||
                info.autoDeployedRedUnits < 1 ||
                !info.autoDeployment?.manifestHash) {
                problems.push('ortak savaş motoru doğrulanamadı: ' + JSON.stringify(info));
            }
            console.log('BATTLETEST_INFO ' + JSON.stringify(info));
            await sleep(400);
            await shot('battle-a-deploy');
            await js(`(() => { try { window.__z0 = zoom; for (let i=0;i<5;i++){ zoom *= 0.84; } } catch(e){} })()`);
            await sleep(500);
            await shot('battle-b-genel');
            const determinism = await js(`(() => {
                try {
                    openBattlefieldSession({
                        mode: 'quick', mapId: -2, seed: 424242,
                        attackerSide: false, durationSec: 240,
                        playerMoney: 5000, enemyMoney: 5000,
                        deployRes: null, deployPool: null,
                        techBonus: null, techBonusRed: null,
                        controllers: [{
                            id: 'test-red',
                            side: true,
                            owner: 'ENEMY_AI',
                            decisionIntervalTicks: 10
                        }, {
                            id: 'test-blue-ally',
                            side: false,
                            owner: 'ALLY_AI',
                            decisionIntervalTicks: 10
                        }],
                        autoDeployAI: false,
                        show: false
                    });
                    const blue = nearestPassable(WORLD_W * 0.5, WORLD_H * 0.55, 20);
                    const red = nearestPassable(blue.x + 90, blue.y, 20);
                    const farBlue = nearestPassable(WORLD_W * 0.12, WORLD_H * 0.88, 20);
                    placeUnit(T.INFANTRY, blue.x, blue.y, false);
                    placeUnit(T.INFANTRY, red.x, red.y, true);
                    placeUnit(T.INFANTRY, farBlue.x, farBlue.y, false);
                    const blueUnit = SIM.units.find(unit => !unit.isRed);
                    const redUnit = SIM.units.find(unit => unit.isRed);
                    const farBlueUnit = SIM.units.filter(unit => !unit.isRed).find(unit => unit.id !== blueUnit.id);
                    farBlueUnit.ally = true;
                    startBattle();
                    const testController = BATTLE_CONTROLLERS.get('test-red');
                    const allyController = BATTLE_CONTROLLERS.get('test-blue-ally');
                    const quickDefaults = battleDefaultControllerConfigs({ mode: 'quick' });
                    const storyDefaults = battleDefaultControllerConfigs({ mode: 'story' });
                    const multiplayerDefaults = battleDefaultControllerConfigs({ mode: 'multiplayer' });
                    const controllerCountAtStart = BATTLE_CONTROLLERS.size;
                    const controllerProfileAtStart = BATTLE_SESSION.controllerProfile;
                    const ownershipAtStart = {
                        playerOwner: blueUnit.controlOwner,
                        playerControllerId: blueUnit.controllerId,
                        allyOwner: farBlueUnit.controlOwner,
                            allyControllerId: farBlueUnit.controllerId,
                            enemyOwner: redUnit.controlOwner,
                            enemyControllerId: redUnit.controllerId,
                            playerSelectable: playerCanControlBattleUnit(blueUnit),
                            allySelectable: playerCanControlBattleUnit(farBlueUnit),
                            enemySelectable: playerCanControlBattleUnit(redUnit)
                    };
                    const redStart = { x: redUnit.x, y: redUnit.y };
                    testController.update(simulationTime);
                    const observation = testController.lastObservation;
                    const situation = testController.lastSituation;
                    const candidates = testController.candidatePlans;
                    const rankedPlans = testController.rankedPlans;
                    const selectedPlan = testController.currentPlan;
                    const operationalPlan = testController.operationalPlan;
                    const fakeController = { id: 'commitment-test' };
                    const manager = new PlanCommitmentManager(fakeController);
                    const stableSituation = {
                        ...situation,
                        tick: 0,
                        friendlyValue: 100,
                        forceRatio: 1,
                        forcePosture: FORCE_POSTURE.PARITY,
                        contactState: CONTACT_STATE.CONTACT,
                        contactConfidence: 1,
                        readiness: { hp: 1, ammo: 1 },
                        role: BATTLE_ROLE.DEFENDER,
                        timePressure: 0
                    };
                    const initialCommit = manager.select([
                        { kind: BATTLE_PLAN_KIND.HOLD, score: 60, reason: 'test' },
                        { kind: BATTLE_PLAN_KIND.MAIN_ATTACK, score: 50, reason: 'test' }
                    ], stableSituation, 0);
                    const lockedDecision = manager.select([
                        { kind: BATTLE_PLAN_KIND.MAIN_ATTACK, score: 100, reason: 'test' },
                        { kind: BATTLE_PLAN_KIND.HOLD, score: 60, reason: 'test' }
                    ], stableSituation, 10);
                    const marginSwitch = manager.select([
                        { kind: BATTLE_PLAN_KIND.MAIN_ATTACK, score: 100, reason: 'test' },
                        { kind: BATTLE_PLAN_KIND.HOLD, score: 60, reason: 'test' }
                    ], stableSituation, 240);
                    const emergencyDecision = manager.select([
                        { kind: BATTLE_PLAN_KIND.MAIN_ATTACK, score: 95, reason: 'test' },
                        { kind: BATTLE_PLAN_KIND.DISENGAGE, score: 70, reason: 'test' }
                    ], {
                        ...stableSituation,
                        // BAYAT BEKLENTI DUZELTMESI (olculdu 2026-08-08): eskiden tik 241 soruluyordu,
                        // yani plan tik 240'ta baglandiktan 1 TIK SONRA. FAZ 6'da eklenen ANTI-FLIP
                        // korumasi, gercek-acil olmayan iptallerde asgari sure dayatir ("0.5sn'lik
                        // saldir/toparlan spazmi biter"). OLCULDU: degisim 1/4/8 tikte ENGELLI,
                        // 16 tikte serbest. Yani test, korumanin BILEREK engelledigi ani sinayip
                        // "DISENGAGE gelmedi" diyordu -> kusur AI'da degil, beklentinin tarihinde.
                        // Artik pencere disindan (256) soruluyor: acil-durumda DISENGAGE davranisi
                        // gercekten sinanir, anti-flip penceresi degil.
                        tick: 256,
                        forceRatio: 0.4,
                        forcePosture: FORCE_POSTURE.DISADVANTAGE,
                        readiness: { hp: 0.2, ammo: 0.2 }
                    }, 256);
                    const syntheticPlanner = new BattleOperationalPlanner({
                        id: 'planning-test',
                        side: true
                    });
                    const syntheticObservation = {
                        tick: 12,
                        side: true,
                        ownUnits: [
                            { id: 101, type: T.INFANTRY, x: 1500, y: 500, hpRatio: 1, ammoRatio: 1 },
                            { id: 102, type: T.MECH_INFANTRY, x: 1550, y: 500, hpRatio: 1, ammoRatio: 1 },
                            { id: 103, type: T.ARMOR_INFANTRY, x: 1600, y: 500, hpRatio: 1, ammoRatio: 1 },
                            { id: 104, type: T.ARMOR, x: 1650, y: 500, hpRatio: 1, ammoRatio: 1 },
                            { id: 105, type: T.ANTI_TANK, x: 1700, y: 500, hpRatio: 1, ammoRatio: 1 },
                            { id: 106, type: T.RECON, x: 1750, y: 500, hpRatio: 1, ammoRatio: 1 },
                            { id: 107, type: T.ARTILLERY, x: 1800, y: 500, hpRatio: 1, ammoRatio: 1 },
                            { id: 108, type: T.MEDIC, x: 1850, y: 500, hpRatio: 1, ammoRatio: 1 }
                        ],
                        contacts: [
                            {
                                id: 901, typeEstimate: T.INFANTRY, x: 1300, y: 1200,
                                healthBand: 'HEALTHY', confidence: 1, visible: true
                            },
                            {
                                id: 902, typeEstimate: T.ARMOR, x: 2200, y: 1250,
                                healthBand: 'DAMAGED', confidence: 0.7, visible: false
                            }
                        ]
                    };
                    const syntheticPlan = syntheticPlanner.build({
                        id: 'planning-test:1',
                        kind: BATTLE_PLAN_KIND.FIX_AND_FLANK
                    }, syntheticObservation, stableSituation);
                    const firstGroupSignature = syntheticPlan.taskGroups
                        .map(group => group.role + ':' + group.unitIds.join(',')).join('|');
                    const stableOrganization = syntheticPlanner.build({
                        id: 'planning-test:1',
                        kind: BATTLE_PLAN_KIND.FIX_AND_FLANK
                    }, {
                        ...syntheticObservation,
                        tick: 22,
                        ownUnits: syntheticObservation.ownUnits.map(unit => ({
                            ...unit,
                            hpRatio: unit.id === 104 ? 0.5 : unit.hpRatio
                        }))
                    }, stableSituation);
                    const secondGroupSignature = stableOrganization.taskGroups
                        .map(group => group.role + ':' + group.unitIds.join(',')).join('|');
                    const firstContractSignature = syntheticPlan.taskContracts
                        .map(contract => contract.id + ':' +
                            contract.route.map(point => point.x + ',' + point.y).join('>'))
                        .join('|');
                    const secondContractSignature = stableOrganization.taskContracts
                        .map(contract => contract.id + ':' +
                            contract.route.map(point => point.x + ',' + point.y).join('>'))
                        .join('|');
                    const requiredContractFields = [
                        'objective', 'task', 'formation', 'route', 'engagementRule',
                        'preferredRange', 'tempo', 'phaseLine', 'supportRequest',
                        'abortCondition', 'fallbackPosition', 'pursuitLimit'
                    ];
                    const hiddenAttackRejected = testController.issueOrder({
                        kind: BATTLE_ORDER_KIND.ATTACK,
                        unitIds: [redUnit.id],
                        targetId: farBlueUnit.id,
                        reason: 'hidden-target-must-fail'
                    }) === false;
                    const syntheticExecutor = new TaskExecutionManager({
                        id: 'execution-test',
                        side: true
                    });
                    const syntheticMovementObservation = {
                        ...syntheticObservation,
                        contacts: []
                    };
                    const syntheticExecutionStart = syntheticExecutor.decide(
                        syntheticPlan,
                        syntheticMovementObservation,
                        12
                    );
                    const syntheticAbortObservation = {
                        ...syntheticMovementObservation,
                        tick: 13,
                        ownUnits: syntheticMovementObservation.ownUnits.map(unit => ({
                            ...unit,
                            hpRatio: 0.1,
                            ammoRatio: 0.1
                        }))
                    };
                    const syntheticAbort = syntheticExecutor.decide(
                        syntheticPlan,
                        syntheticAbortObservation,
                        13
                    );
                    for (let i = 0; i < 80 && phase === PHASE.BATTLE; i++) {
                        simulationTime += BATTLE_TICK_MS;
                        gameTime += BATTLE_TICK_SEC;
                        stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false);
                        updateSupport(BATTLE_TICK_SEC, simulationTime);
                        if (SIM.battle && SIM.battle.winnerSide !== null) break;
                    }
                    const replay = exportBattleReplay();
                    const executionBeforeReplay = {
                        controllerIssuedOrder: testController.decisionHistory.length > 0,
                        orderEvents: replay.events.filter(event => event.type === 'controller-order').length,
                        orderKinds: [...new Set(replay.events
                            .filter(event => event.type === 'controller-order')
                            .map(event => event.payload.kind))].sort(),
                        movedDistance: Math.round(Math.hypot(
                            redUnit.x - redStart.x,
                            redUnit.y - redStart.y
                        ) * 100) / 100,
                        damageDealt: Math.round((blueUnit.maxHp - blueUnit.hp) * 100) / 100,
                        transitions: testController.taskExecutor.transitionHistory.length,
                        phases: [...new Set(testController.taskExecutor.transitionHistory
                            .map(transition => transition.current))].sort(),
                        allyControllerIssuedOrder: allyController.decisionHistory.length > 0
                    };
                    const verification = verifyBattleReplayDeterminism(replay);
                    const moneyManifestA = battleBuildArmyManifest(1500);
                    const moneyManifestB = battleBuildArmyManifest(1500);
                    const storyManifest = battleBuildArmyManifest({
                        oil: 500,
                        manpower: 700,
                        points: 300
                    });
                    const terrainHardBlock = runTerrainHardBlockDiagnostics();
                    const blueAttackLab = runAIVsAILabDiagnostics({
                        budget: 1500,
                        seed: 919191,
                        attackerSide: false,
                        durationSec: 240
                    });
                    const redAttackLab = runAIVsAILabDiagnostics({
                        budget: 1500,
                        seed: 919191,
                        attackerSide: true,
                        durationSec: 240
                    });
                    const playerDefendsLab = runAIVsAILabDiagnostics({
                        budget: 1500,
                        seed: 919191,
                        attackerSide: true,
                        durationSec: 240,
                        playerSurrogateSide: false,
                        scriptedAdvance: false
                    });
                    const playerAttacksLab = runAIVsAILabDiagnostics({
                        budget: 1500,
                        seed: 919191,
                        attackerSide: false,
                        durationSec: 240,
                        playerSurrogateSide: false,
                        scriptedAdvance: true
                    });
                    const reportedPlayerAttacksLab = runAIVsAILabDiagnostics({
                        budget: 1500,
                        seed: 2682944358,
                        attackerSide: false,
                        durationSec: 240,
                        playerSurrogateSide: false,
                        scriptedAdvance: true
                    });
                    const reportedPlayerDefendsLab = runAIVsAILabDiagnostics({
                        budget: 1500,
                        seed: 2683121660,
                        attackerSide: true,
                        durationSec: 240,
                        playerSurrogateSide: false,
                        scriptedAdvance: false
                    });
                    const latestPlayerAttacksLab = runAIVsAILabDiagnostics({
                        budget: 1500,
                        seed: 2726784107,
                        attackerSide: false,
                        durationSec: 240,
                        playerSurrogateSide: false,
                        scriptedAdvance: true
                    });
                    const latestPlayerDefendsLab = runAIVsAILabDiagnostics({
                        budget: 1500,
                        seed: 2727165555,
                        attackerSide: true,
                        durationSec: 240,
                        playerSurrogateSide: false,
                        scriptedAdvance: false
                    });
                    return {
                        matched: verification.matched,
                        firstHash: verification.first.hash,
                        secondHash: verification.second.hash,
                        firstTick: verification.first.tick,
                        secondTick: verification.second.tick,
                        firstDivergence: verification.first.divergence,
                        secondDivergence: verification.second.divergence,
                        recordedHashes: replay.hashes.length,
                        visibleContacts: observation.contacts.map(contact => contact.id),
                        nearDetected: observation.contacts.some(contact => contact.id === blueUnit.id),
                        farLeaked: observation.contacts.some(contact => contact.id === farBlueUnit.id),
                        situationFinite: Number.isFinite(situation.friendlyValue) &&
                            Number.isFinite(situation.estimatedEnemyValue) &&
                            Number.isFinite(situation.forceRatio),
                        contactState: situation.contactState,
                        forcePosture: situation.forcePosture,
                        candidatePlans: candidates.map(candidate => candidate.kind),
                        rankedPlans: rankedPlans.map(candidate => ({ kind: candidate.kind, score: candidate.score })),
                        selectedPlan: selectedPlan?.kind || null,
                        deployment: {
                            deterministicManifest: moneyManifestA.hash === moneyManifestB.hash,
                            moneyManifestHash: moneyManifestA.hash,
                            moneyUnits: moneyManifestA.totalUnits,
                            moneyValue: moneyManifestA.totalValue,
                            storyUnits: storyManifest.totalUnits,
                            storyValue: storyManifest.totalValue,
                            storyGroupsUsed: Object.entries(storyManifest.initialBudget)
                                .filter(([group]) => group !== 'money')
                                .every(([group, initial]) =>
                                    storyManifest.remaining[group] < initial
                                )
                        },
                        terrainHardBlock,
                        aiLab: {
                            blueAttacks: blueAttackLab,
                            redAttacks: redAttackLab,
                            playerDefends: playerDefendsLab,
                            playerAttacks: playerAttacksLab,
                            reportedPlayerAttacks: reportedPlayerAttacksLab,
                            reportedPlayerDefends: reportedPlayerDefendsLab,
                            latestPlayerAttacks: latestPlayerAttacksLab,
                            latestPlayerDefends: latestPlayerDefendsLab,
                            sameManifest:
                                blueAttackLab.blueHash === redAttackLab.blueHash &&
                                blueAttackLab.redHash === redAttackLab.redHash,
                            sameSeed: 919191
                        },
                        telemetryCapture: {
                            samples: BATTLE_REPLAY.telemetry?.samples?.length || 0,
                            combatEvents: BATTLE_REPLAY.telemetry?.combatEvents?.length || 0,
                            controllerDecisions:
                                BATTLE_REPLAY.telemetry?.controllerDecisions?.length || 0,
                            exportReady: typeof exportBattleDiagnosticReport === 'function',
                            exportFormat: typeof exportBattleDiagnosticReport === 'function'
                                ? exportBattleDiagnosticReport().format
                                : null
                        },
                        bootstrap: {
                            controllerProfile: controllerProfileAtStart,
                            controllerCount: controllerCountAtStart,
                            quickStoryParity: JSON.stringify(quickDefaults) === JSON.stringify(storyDefaults),
                            defaultControllerIds: quickDefaults.map(config => config.id).sort(),
                            multiplayerControllerCount: multiplayerDefaults.length,
                            ownershipAtStart
                        },
                        execution: {
                            ...executionBeforeReplay,
                            hiddenAttackRejected,
                            syntheticInitialOrderCount: syntheticExecutionStart?.orders?.length || 0,
                            syntheticInitialKinds: [...new Set(
                                (syntheticExecutionStart?.orders || []).map(order => order.kind)
                            )].sort(),
                            syntheticAbortOrderCount: syntheticAbort?.orders?.length || 0,
                            syntheticAbortReasons: (syntheticAbort?.orders || [])
                                .map(order => order.reason)
                                .filter(reason => reason.includes(':ABORT:'))
                        },
                        operational: {
                            allocationComplete: operationalPlan?.allocationComplete === true,
                            objectiveContactId: operationalPlan?.objective?.contactId ?? null,
                            sourceContactIds: operationalPlan?.objective?.sourceContactIds || [],
                            farContactLeaked: operationalPlan?.objective?.sourceContactIds?.includes(farBlueUnit.id) || false,
                            issuesOrders: operationalPlan?.issuesOrders === true,
                            syntheticAllocationComplete: syntheticPlan.allocationComplete,
                            syntheticRoles: syntheticPlan.taskGroups.map(group => group.role),
                            syntheticSourceContacts: syntheticPlan.objective.sourceContactIds,
                            stableOrganization: firstGroupSignature === secondGroupSignature,
                            contractsComplete: syntheticPlan.contractsComplete,
                            contractCount: syntheticPlan.taskContracts.length,
                            contractFieldsComplete: syntheticPlan.taskContracts.every(contract =>
                                requiredContractFields.every(field =>
                                    Object.prototype.hasOwnProperty.call(contract, field)
                                )
                            ),
                            routesPassable: syntheticPlan.taskContracts.every(contract =>
                                contract.route.every(point => isPassableAt(point.x, point.y)) &&
                                isPassableAt(contract.fallbackPosition.x, contract.fallbackPosition.y) &&
                                isPassableAt(contract.destination.x, contract.destination.y)
                            ),
                            contractsNonExecutable: syntheticPlan.taskContracts.every(contract =>
                                contract.executable === false
                            ),
                            stableContracts: firstContractSignature === secondContractSignature
                        },
                        commitment: {
                            initial: initialCommit.currentKind,
                            locked: lockedDecision.currentKind,
                            lockedChanged: lockedDecision.changed,
                            margin: marginSwitch.currentKind,
                            emergency: emergencyDecision.currentKind,
                            emergencyReason: emergencyDecision.abortReason,
                            transitions: manager.transitionHistory.length
                        },
                        rankingFinite: rankedPlans.every(candidate => Number.isFinite(candidate.score)) &&
                            rankedPlans.every((candidate, index) => index === 0 || rankedPlans[index - 1].score >= candidate.score)
                    };
                } catch (error) {
                    return { matched: false, error: error.stack || error.message };
                }
            })()`);
            const recordedBattleFiles = String(
                process.env.PIXEL_RTS_BATTLE_RECORDINGS || ''
            ).split(path.delimiter).map(file => file.trim()).filter(Boolean);
            determinism.recordedPlayerMatches = [];
            for (const recordingFile of recordedBattleFiles) {
                try {
                    const recording = JSON.parse(
                        fsx2.readFileSync(recordingFile, 'utf8')
                    );
                    const result = await js(
                        `runRecordedPlayerVsAIDiagnostics(${JSON.stringify(recording)})`
                    );
                    determinism.recordedPlayerMatches.push({
                        file: recordingFile,
                        result
                    });
                    if (!result ||
                        (result.playerEventsApplied !== result.playerEventsTotal &&
                            result.newOutcome?.winnerSide === null) ||
                        result.newOutcome?.winnerSide !== true ||
                        result.terrainViolationIds?.length > 0) {
                        problems.push(
                            'ham oyuncu savaşı yeniden oynatılamadı: ' +
                            recordingFile + ' ' + JSON.stringify(result)
                        );
                    }
                } catch (error) {
                    problems.push(
                        'ham oyuncu savaşı okunamadı: ' +
                        recordingFile + ' ' + error.message
                    );
                }
            }
            if (!determinism || !determinism.matched || !determinism.nearDetected ||
                determinism.farLeaked || !determinism.situationFinite ||
                !determinism.candidatePlans?.length || !determinism.rankingFinite ||
                !determinism.selectedPlan ||
                !determinism.deployment?.deterministicManifest ||
                determinism.deployment?.moneyUnits < 6 ||
                determinism.deployment?.storyUnits < 6 ||
                !determinism.deployment?.storyGroupsUsed ||
                determinism.terrainHardBlock?.passed !== true ||
                !determinism.aiLab?.sameManifest ||
                !determinism.aiLab?.blueAttacks?.equalManifest ||
                !determinism.aiLab?.redAttacks?.equalManifest ||
                determinism.aiLab?.blueAttacks?.unitsPerSide < 6 ||
                determinism.aiLab?.redAttacks?.unitsPerSide < 6 ||
                !determinism.aiLab?.blueAttacks?.contactEver ||
                !determinism.aiLab?.redAttacks?.contactEver ||
                !determinism.aiLab?.blueAttacks?.blueOrdered ||
                !determinism.aiLab?.blueAttacks?.redOrdered ||
                !determinism.aiLab?.redAttacks?.blueOrdered ||
                !determinism.aiLab?.redAttacks?.redOrdered ||
                determinism.aiLab?.blueAttacks?.blueDamageReceived <= 0 ||
                determinism.aiLab?.blueAttacks?.redDamageReceived <= 0 ||
                determinism.aiLab?.redAttacks?.blueDamageReceived <= 0 ||
                determinism.aiLab?.redAttacks?.redDamageReceived <= 0 ||
                determinism.aiLab?.blueAttacks?.winnerSide === null ||
                determinism.aiLab?.redAttacks?.winnerSide === null ||
                determinism.aiLab?.blueAttacks?.terrainViolationIds?.length > 0 ||
                determinism.aiLab?.redAttacks?.terrainViolationIds?.length > 0 ||
                determinism.aiLab?.blueAttacks?.navigationStuckUnitIds?.length > 0 ||
                determinism.aiLab?.redAttacks?.navigationStuckUnitIds?.length > 0 ||
                determinism.aiLab?.blueAttacks?.navFailureUnitIds?.length > 0 ||
                determinism.aiLab?.redAttacks?.navFailureUnitIds?.length > 0 ||
                determinism.aiLab?.blueAttacks?.maxFriendlyOverlapPairs > 0 ||
                determinism.aiLab?.redAttacks?.maxFriendlyOverlapPairs > 0 ||
                !determinism.aiLab?.playerDefends?.redOrdered ||
                determinism.aiLab?.playerDefends?.blueOrdered ||
                determinism.aiLab?.playerDefends?.blueDamageReceived <= 0 ||
                determinism.aiLab?.playerDefends?.redDamageReceived <= 0 ||
                determinism.aiLab?.playerDefends?.terrainViolationIds?.length > 0 ||
                determinism.aiLab?.playerDefends?.navigationStuckUnitIds?.length > 0 ||
                determinism.aiLab?.playerDefends?.maxFriendlyOverlapPairs > 0 ||
                !determinism.aiLab?.playerAttacks?.redOrdered ||
                determinism.aiLab?.playerAttacks?.blueOrdered ||
                determinism.aiLab?.playerAttacks?.blueDamageReceived <= 0 ||
                determinism.aiLab?.playerAttacks?.redDamageReceived <= 0 ||
                determinism.aiLab?.playerAttacks?.terrainViolationIds?.length > 0 ||
                determinism.aiLab?.playerAttacks?.navigationStuckUnitIds?.length > 0 ||
                determinism.aiLab?.reportedPlayerDefends?.navigationStuckUnitIds?.length > 0 ||
                determinism.aiLab?.reportedPlayerDefends?.maxFriendlyOverlapPairs > 0 ||
                determinism.aiLab?.reportedPlayerAttacks?.navigationStuckUnitIds?.length > 0 ||
                determinism.aiLab?.latestPlayerAttacks?.navigationStuckUnitIds?.length > 0 ||
                determinism.aiLab?.latestPlayerAttacks?.maxFriendlyOverlapPairs > 0 ||
                determinism.aiLab?.latestPlayerDefends?.navigationStuckUnitIds?.length > 0 ||
                determinism.aiLab?.latestPlayerDefends?.maxFriendlyOverlapPairs > 0 ||
                determinism.telemetryCapture?.samples < 2 ||
                determinism.telemetryCapture?.combatEvents < 1 ||
                determinism.telemetryCapture?.controllerDecisions < 1 ||
                determinism.telemetryCapture?.exportFormat !== 'pixel-rts-battle-diagnostic' ||
                determinism.bootstrap?.controllerProfile !== 'common-battle-ai-v1' ||
                determinism.bootstrap?.controllerCount !== 2 ||
                !determinism.bootstrap?.quickStoryParity ||
                determinism.bootstrap?.defaultControllerIds?.join(',') !==
                    'battle-blue-ally-ai,battle-red-ai' ||
                determinism.bootstrap?.multiplayerControllerCount !== 0 ||
                determinism.bootstrap?.ownershipAtStart?.playerOwner !== 'PLAYER' ||
                determinism.bootstrap?.ownershipAtStart?.playerControllerId !== null ||
                determinism.bootstrap?.ownershipAtStart?.allyOwner !== 'ALLY_AI' ||
                determinism.bootstrap?.ownershipAtStart?.allyControllerId !== 'test-blue-ally' ||
                determinism.bootstrap?.ownershipAtStart?.enemyOwner !== 'ENEMY_AI' ||
                determinism.bootstrap?.ownershipAtStart?.enemyControllerId !== 'test-red' ||
                determinism.bootstrap?.ownershipAtStart?.playerSelectable !== true ||
                determinism.bootstrap?.ownershipAtStart?.allySelectable !== false ||
                determinism.bootstrap?.ownershipAtStart?.enemySelectable !== false ||
                !determinism.execution?.controllerIssuedOrder ||
                !determinism.execution?.allyControllerIssuedOrder ||
                !determinism.execution?.hiddenAttackRejected ||
                determinism.execution?.orderEvents < 1 ||
                !determinism.execution?.orderKinds?.includes('MOVE') ||
                (determinism.execution?.movedDistance <= 0 &&
                    determinism.execution?.damageDealt <= 0) ||
                determinism.execution?.transitions < 1 ||
                !determinism.execution?.phases?.includes('ASSEMBLE') ||
                determinism.execution?.syntheticInitialOrderCount !== 7 ||
                determinism.execution?.syntheticInitialKinds?.join(',') !== 'MOVE' ||
                determinism.execution?.syntheticAbortOrderCount < 1 ||
                determinism.execution?.syntheticAbortReasons?.length < 1 ||
                !determinism.operational?.allocationComplete ||
                determinism.operational?.farContactLeaked ||
                determinism.operational?.issuesOrders ||
                !determinism.operational?.syntheticAllocationComplete ||
                !determinism.operational?.stableOrganization ||
                !determinism.operational?.contractsComplete ||
                determinism.operational?.contractCount !== 7 ||
                !determinism.operational?.contractFieldsComplete ||
                !determinism.operational?.routesPassable ||
                !determinism.operational?.contractsNonExecutable ||
                !determinism.operational?.stableContracts ||
                !['MAIN', 'FIXING', 'FLANK', 'FIRE_SUPPORT', 'RECON', 'SUPPORT', 'RESERVE']
                    .every(role => determinism.operational?.syntheticRoles?.includes(role)) ||
                determinism.operational?.syntheticSourceContacts?.join(',') !== '901,902' ||
                determinism.commitment?.initial !== 'HOLD' ||
                determinism.commitment?.locked !== 'HOLD' ||
                determinism.commitment?.lockedChanged !== false ||
                determinism.commitment?.margin !== 'MAIN_ATTACK' ||
                determinism.commitment?.emergency !== 'DISENGAGE' ||
                determinism.commitment?.emergencyReason !== 'CRITICAL_READINESS' ||
                determinism.commitment?.transitions !== 3) {
                problems.push('savaş AI karar sözleşmesi bozuk: ' + JSON.stringify(determinism));
            }
            console.log('BATTLETEST_DETERMINISM ' + JSON.stringify(determinism));
            console.log('BATTLETEST_SHOTS ' + SHOTS_DIR);
            console.log('BATTLETEST_PROBLEMS ' + JSON.stringify(problems.slice(0, 8)));
            console.log(problems.length ? 'BATTLETEST_FAIL' : 'BATTLETEST_OK');
            const packagedResultFile = process.env.PIXEL_RTS_BATTLETEST_RESULT ||
                (process.argv.includes('battletest')
                    ? path.join(require('os').tmpdir(), 'pixel-rts-battletest-result.json')
                    : null);
            if (packagedResultFile) {
                try {
                    fsx2.writeFileSync(packagedResultFile, JSON.stringify({
                        status: problems.length ? 'BATTLETEST_FAIL' : 'BATTLETEST_OK',
                        problems: problems.slice(0, 8),
                        info,
                        determinism,
                        shotsDirectory: SHOTS_DIR
                    }, null, 2), 'utf8');
                } catch (error) {
                    console.log('BATTLETEST_RESULT_WRITE_FAIL ' + error.message);
                    problems.push('paket test sonucu yazılamadı: ' + error.message);
                }
            }
            setTimeout(() => app.exit(problems.length ? 1 : 0), 300);
        });
        return;
    }

    // ── ARAYÜZ YERLEŞİM TESTİ: `--hudtest [--shots <klasör>]` ──────────────────────────────
    // Kullanıcı kusur raporu (2026-08-09): "üst üste binmiş düzelt" + "birim dizerken tıkladığımız
    // birimin özelliklerini göstersin". Bunlar göz kararıyla değil ÖLÇÜLEREK sınanır: paneller gerçek
    // tarayıcıda çizilir, `getBoundingClientRect` ile KESİŞİYOR MU diye bakılır. Ekran görüntüsü de
    // alınır ama karar geometriye aittir — "bende düzgün görünüyor" bir kanıt değildir.
    if (HUDTEST) {
        createWindow();
        const fsx3 = require('fs');
        try { fsx3.mkdirSync(SHOTS_DIR, { recursive: true }); } catch (_) {}
        const problems = [];
        win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) problems.push('konsol: ' + message); });
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const js = code => win.webContents.executeJavaScript(code, true).catch(e => 'JSHATA: ' + e.message);
        // capturePage SON BIRLESTIRILMIS kareyi verir; hemen cagirinca bir onceki ekrani yakalar
        // (yasandi: 'hizlimac' cekimi menuyu gosterdi). Once bir kare bekle.
        const shot = async name => { await sleep(400); try { const img = await win.webContents.capturePage(); fsx3.writeFileSync(path.join(SHOTS_DIR, name + '.png'), img.toPNG()); } catch (_) {} };
        const click = sel => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (el) el.click(); return !!el; })()`);
        win.webContents.on('did-finish-load', async () => {
            await sleep(1200);
            // 1) HIZLI MAÇ — ileri ayarlar KAPALI mı, düğmeler kutuyla çakışıyor mu?
            await click('#btn-quick-match'); await sleep(500);
            const qm = await js(`(() => {
                const d = document.querySelector('.qm-advanced');
                // OLCUT SECIMI (yasanan tuzak): kapali <details> icerigini Chromium display:none YAPMAZ —
                // content-visibility ile cizmez ama LAYOUT KUTUSU durur. Bu yuzden offsetWidth/getClientRects
                // "gizli degil" der ve yanlis alarm uretir. Sadelesmenin gercek olcutu KUTU BOYU: ileri
                // ayarlar acilinca kutu ne kadar uzuyor? Ayrica checkVisibility gercek gorunurlugu verir.
                const box = document.querySelector('#screen-quickmatch .qm-box');
                const yuk = () => box ? Math.round(box.getBoundingClientRect().height) : -1;
                const kapaliYuk = yuk();
                if (d) { d.open = true; }
                const acikYuk = yuk();
                if (d) { d.open = false; }
                const gorunurMu = e => !!e && typeof e.checkVisibility === 'function'
                    && e.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true });
                const kesis = (a, b) => { if (!a || !b) return false; const r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect();
                    return r1.right > r2.left + 1 && r2.right > r1.left + 1 && r1.bottom > r2.top + 1 && r2.bottom > r1.top + 1; };
                return { ileriVar: !!d, ileriKapali: !!d && !d.open,
                    ekran: document.body.getAttribute('data-screen'),
                    beyinGizli: !gorunurMu(document.getElementById('qm-brain')),
                    tohumGizli: !gorunurMu(document.getElementById('qm-seed')),
                    kutuKapali: kapaliYuk, kutuAcik: acikYuk, kisalma: acikYuk - kapaliYuk,
                    kutuDugmeCakismasi: kesis(document.querySelector('#screen-quickmatch .qm-box'), document.querySelector('#screen-quickmatch .menu-side')) };
            })()`);
            await shot('hud-1-hizlimac');
            if (!qm.ileriVar) problems.push('Hızlı Maç: .qm-advanced yok');
            if (qm.ileriVar && !qm.ileriKapali) problems.push('Hızlı Maç: ileri ayarlar açık başlıyor');
            if (!qm.beyinGizli) problems.push('Hızlı Maç: Rakip AI hâlâ görünür (sadeleşmedi)');
            if (!qm.tohumGizli) problems.push('Hızlı Maç: Tohum hâlâ görünür (sadeleşmedi)');
            if (!(qm.kisalma > 60)) problems.push('Hızlı Maç: ileri ayarlar kutuyu kısaltmıyor (kisalma=' + qm.kisalma + ')');
            if (qm.ekran !== 'quickmatch') problems.push('Hızlı Maç: ekran açılmadı (data-screen=' + qm.ekran + ')');
            if (qm.kutuDugmeCakismasi) problems.push('Hızlı Maç: kutu ile düğme sütunu çakışıyor');

            // 2) DİZİM — birim künyesi tıklayınca doluyor mu?
            await click('#btn-qm-start'); await sleep(1100);
            const kartBos = await js(`(() => { const c = document.getElementById('deploy-unit-card');
                return { var: !!c, gorunur: !!c && c.offsetParent !== null, bos: !!c && c.classList.contains('is-empty') }; })()`);
            const tiklandi = await js(`(() => { const b = document.querySelector('.spawn-cat'); if (b) { b.click(); return 'kategori'; }
                const s = document.querySelector('.spawn-btn'); if (s) { s.click(); return 'birim'; } return null; })()`);
            await sleep(250);
            if (tiklandi === 'kategori') { await js(`(() => { const s = document.querySelector('.spawn-btn'); if (s) s.click(); return !!s; })()`); await sleep(250); }
            const kartDolu = await js(`(() => { const c = document.getElementById('deploy-unit-card'); if (!c) return null;
                return { bos: c.classList.contains('is-empty'), baslik: (c.querySelector('.duc-head h4') || {}).textContent || null,
                    istatistik: c.querySelectorAll('.duc-stat').length }; })()`);
            await shot('hud-2-dizim');
            if (!kartBos.var) problems.push('Dizim: #deploy-unit-card yok');
            else if (!kartBos.gorunur) problems.push('Dizim: birim künyesi görünmüyor (gizli panel)');
            if (!kartDolu || kartDolu.bos) problems.push('Dizim: birime tıklandı ama künye BOŞ kaldı');
            else if (!kartDolu.baslik || kartDolu.istatistik < 6) problems.push('Dizim: künye eksik (başlık/istatistik yok)');

            // 3) SAVAŞ — yetenek paneli ile emir paneli ÇAKIŞIYOR MU?
            // Önce sahaya GERÇEK oyuncu birliği koy: yoksa seçilecek bir şey olmaz ve yetenek paneli
            // hiç açılmaz → çakışma sınanamaz (ilk koşuda tam bu oldu, test kendini yakaladı).
            const konan = await js(`(() => {
                const kenar = (typeof myCanonicalSide !== 'undefined') ? myCanonicalSide : false;
                const tipler = [T.ENGINEER, T.INFANTRY, T.ARMOR].filter(t => t != null && STATS[t]);
                let n = 0;
                for (const t of tipler) {
                    const x = WORLD_W * 0.5 + n * 120, y = kenar ? WORLD_H * 0.12 : WORLD_H * 0.88;
                    if (typeof placeUnit === 'function' && typeof isInPlayerZone === 'function' && isInPlayerZone(x, y)) { placeUnit(t, x, y, kenar); n++; }
                }
                return n;
            })()`);
            await sleep(200);
            if (!konan) problems.push('Savaş: test sahaya birlik koyamadı (çakışma sınaması zayıflar)');
            await js(`(() => { if (typeof startBattle === 'function') startBattle(); return true; })()`); await sleep(900);
            const faz = await js(`(() => document.body.getAttribute('data-phase'))()`);
            if (faz !== 'battle') problems.push('Savaş: faz battle olmadı (data-phase=' + faz + ')');
            const cakisma = await js(`(() => {
                // Yetenek panelini gerçekten aç: oyuncunun bir birimini seç, sonra paneli tazele.
                let sec = 0;
                for (const u of units) { if (typeof playerCanControlBattleUnit === 'function' && playerCanControlBattleUnit(u) && !u.dead) { u.selected = true; sec++; if (sec >= 1) break; } }
                if (typeof _abilityPanelSig !== 'undefined') _abilityPanelSig = null;
                if (typeof refreshAbilityPanelIfChanged === 'function') refreshAbilityPanelIfChanged();
                const a = document.getElementById('ui-abilities'), o = document.getElementById('battle-orders');
                if (!a || !o) return { hata: 'panel yok' };
                const ra = a.getBoundingClientRect(), ro = o.getBoundingClientRect();
                const acik = a.offsetParent !== null && ra.height > 0;
                const kesis = acik && ra.right > ro.left + 1 && ro.right > ra.left + 1 && ra.bottom > ro.top + 1 && ro.bottom > ra.top + 1;
                return { secili: sec, yetenekAcik: acik, kesis: kesis,
                    yetenek: [Math.round(ra.top), Math.round(ra.bottom)], emir: [Math.round(ro.top), Math.round(ro.bottom)],
                    ekranDisi: ro.bottom > window.innerHeight + 1 || ra.top < -1 };
            })()`);
            await shot('hud-3-savas');
            if (cakisma && cakisma.hata) problems.push('Savaş: ' + cakisma.hata);
            else if (cakisma) {
                if (!cakisma.yetenekAcik) problems.push('Savaş: yetenek paneli açılmadı (çakışma sınanamadı)');
                if (cakisma.kesis) problems.push('Savaş: yetenek paneli ile emir paneli ÇAKIŞIYOR ' + JSON.stringify(cakisma));
                if (cakisma.ekranDisi) problems.push('Savaş: sol yığın ekran dışına taşıyor ' + JSON.stringify(cakisma));
            }

            console.log('HUDTEST_QM ' + JSON.stringify(qm));
            console.log('HUDTEST_DIZIM ' + JSON.stringify({ kart: kartBos, dolu: kartDolu }));
            console.log('HUDTEST_CAKISMA ' + JSON.stringify(cakisma));
            console.log('HUDTEST_SHOTS ' + SHOTS_DIR);
            console.log('HUDTEST_PROBLEMS ' + JSON.stringify(problems.slice(0, 8)));
            console.log(problems.length ? 'HUDTEST_FAIL' : 'HUDTEST_OK');
            setTimeout(() => app.exit(problems.length ? 1 : 0), 300);
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

// FAZ 6: insan-maçı öğrenme verisi — oyun maç sonu etiketlenmiş örnekleri buraya APPEND eder.
// PAKETLENMİŞ exe'de __dirname asar içi (READ-ONLY) → yazamaz. app.isPackaged ise exe konumundan repo'yu
// bul: <repo>/dist-recorder/win-unpacked/exe → path.dirname(execPath)/../.. = <repo> → qa-runtime yazılabilir.
const HUMAN_DATA_FILE = app.isPackaged
    ? path.join(path.dirname(process.execPath), '..', '..', 'qa-runtime', 'human-data.json')
    : path.join(__dirname, '..', 'qa-runtime', 'human-data.json');
ipcMain.handle('train:saveHumanData', (_e, examples) => {
    try {
        if (!Array.isArray(examples) || !examples.length) return { count: 0, total: 0 };
        const fsx = require('fs');
        fsx.mkdirSync(path.dirname(HUMAN_DATA_FILE), { recursive: true });
        let data = { meta: { createdBy: 'in-game', human: true }, examples: [] };
        try { data = JSON.parse(fsx.readFileSync(HUMAN_DATA_FILE, 'utf8')); } catch (_) {}
        if (!Array.isArray(data.examples)) data.examples = [];
        for (const ex of examples) data.examples.push(ex);
        data.meta = data.meta || {}; data.meta.exampleCount = data.examples.length;
        // dosyanın motor-sürüm dağılımı (INSAN-EGIT bunu görüp yalnız güncel-motoru adapte eder)
        const evTail = examples[examples.length - 1] && examples[examples.length - 1].engineVersion;
        if (evTail) data.meta.lastEngineVersion = evTail;
        fsx.writeFileSync(HUMAN_DATA_FILE, JSON.stringify(data));
        return { count: examples.length, total: data.examples.length };
    } catch (e) { return { error: String(e && e.message) }; }
});
// KOMUTAN MODU: canlı saha ↔ emir dosya alışverişi. Renderer sahayı yazar + emir okur; dış-komutan (Claude) tersini yapar.
const COMMANDER_DIR = path.dirname(HUMAN_DATA_FILE);   // qa-runtime
const STORY_DIALOGUE_LOG_FILE = path.join(COMMANDER_DIR, 'story-dialogue-log.jsonl');
const STORY_DIALOGUE_LOG_MAX_BYTES = 8 * 1024 * 1024;
function storyDialogueLogText(value, maxLength) {
    return String(value == null ? '' : value)
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
        .slice(0, maxLength);
}
ipcMain.handle('diagnostics:appendStoryDialogue', (_e, entry) => {
    try {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return { ok: false, error: 'INVALID_ENTRY' };
        const eventType = storyDialogueLogText(entry.eventType, 32);
        if (!['TURN_CREATED', 'RESPONSE_ENRICHED'].includes(eventType)) return { ok: false, error: 'INVALID_EVENT' };
        const row = {
            schemaVersion: 1,
            recordedAt: new Date().toISOString(),
            eventType,
            gameClock: Number.isFinite(Number(entry.gameClock)) ? Number(entry.gameClock) : 0,
            sessionId: storyDialogueLogText(entry.sessionId, 120),
            responseId: storyDialogueLogText(entry.responseId, 160),
            turnSequence: Math.max(0, Math.min(200, Number(entry.turnSequence) || 0)),
            listener: {
                actorId: storyDialogueLogText(entry.listener && entry.listener.actorId, 160),
                name: storyDialogueLogText(entry.listener && entry.listener.name, 120),
                role: storyDialogueLogText(entry.listener && entry.listener.role, 80)
            },
            playerText: storyDialogueLogText(entry.playerText, 1200),
            characterText: storyDialogueLogText(entry.characterText, 1200),
            speechAct: storyDialogueLogText(entry.speechAct, 64),
            discourseAct: storyDialogueLogText(entry.discourseAct, 64),
            dialogueMoveId: storyDialogueLogText(entry.dialogueMoveId, 120),
            source: storyDialogueLogText(entry.source, 96),
            enrichmentStatus: storyDialogueLogText(entry.enrichmentStatus, 48),
            llmValidationCode: storyDialogueLogText(entry.llmValidationCode, 64),
            llmUsed: entry.llmUsed === true
        };
        if (!row.sessionId || !row.responseId || !row.playerText || !row.characterText) {
            return { ok: false, error: 'MISSING_VISIBLE_TURN' };
        }
        const fsx = require('fs');
        fsx.mkdirSync(COMMANDER_DIR, { recursive: true });
        try {
            if (fsx.statSync(STORY_DIALOGUE_LOG_FILE).size >= STORY_DIALOGUE_LOG_MAX_BYTES) {
                const rotated = `${STORY_DIALOGUE_LOG_FILE}.1`;
                try { fsx.unlinkSync(rotated); } catch (_) {}
                fsx.renameSync(STORY_DIALOGUE_LOG_FILE, rotated);
            }
        } catch (_) {}
        fsx.appendFileSync(STORY_DIALOGUE_LOG_FILE, `${JSON.stringify(row)}\n`, 'utf8');
        return { ok: true, file: STORY_DIALOGUE_LOG_FILE };
    } catch (e) { return { ok: false, error: String(e && e.message) }; }
});
ipcMain.handle('commander:writeState', (_e, state) => {
    try {
        const fsx = require('fs');
        fsx.mkdirSync(COMMANDER_DIR, { recursive: true });
        fsx.writeFileSync(path.join(COMMANDER_DIR, 'commander-state.json'), JSON.stringify(state));
        return { ok: true };
    } catch (e) { return { error: String(e && e.message) }; }
});
ipcMain.handle('commander:readOrders', (_e, turn) => {
    try {
        const fsx = require('fs');
        const f = path.join(COMMANDER_DIR, 'commander-orders.json');
        if (!fsx.existsSync(f)) return null;
        const data = JSON.parse(fsx.readFileSync(f, 'utf8'));
        if (data && data.turn === turn) return data;   // yalnız İSTENEN turun emirleri (eski/erken emir yok)
        return null;
    } catch (e) { return null; }
});
ipcMain.handle('train:humanDataCount', () => {
    try { const d = JSON.parse(require('fs').readFileSync(HUMAN_DATA_FILE, 'utf8')); return { total: (d.examples || []).length }; }
    catch (_) { return { total: 0 }; }
});
// #5: her maçın TAM kaydını qa-runtime/last-match.json'a yaz (Claude gerçek maçı izlesin: donma/flank/yana-açılma).
const LAST_MATCH_FILE = app.isPackaged
    ? path.join(path.dirname(process.execPath), '..', '..', 'qa-runtime', 'last-match.json')
    : path.join(__dirname, '..', 'qa-runtime', 'last-match.json');
const MATCHES_DIR = path.join(path.dirname(LAST_MATCH_FILE), 'matches');   // koç SON N maçı birden izlesin diye geçmiş
ipcMain.handle('train:saveMatchRecording', (_e, rec) => {
    try {
        if (!rec) return { ok: false };
        const fsx = require('fs');
        const json = JSON.stringify(rec);
        fsx.mkdirSync(path.dirname(LAST_MATCH_FILE), { recursive: true });
        fsx.writeFileSync(LAST_MATCH_FILE, json);
        // GEÇMİŞ: döngüsel matches/ klasörüne de yaz (koç --coachwatch all → son N maçı birden görür). Son 8'i tut.
        try {
            fsx.mkdirSync(MATCHES_DIR, { recursive: true });
            const existing = fsx.readdirSync(MATCHES_DIR).filter(f => /^match-\d+\.json$/.test(f)).sort();
            const nextIdx = existing.length ? (parseInt(existing[existing.length - 1].match(/\d+/)[0], 10) + 1) : 1;
            fsx.writeFileSync(path.join(MATCHES_DIR, 'match-' + String(nextIdx).padStart(4, '0') + '.json'), json);
            const after = fsx.readdirSync(MATCHES_DIR).filter(f => /^match-\d+\.json$/.test(f)).sort();
            for (const old of after.slice(0, Math.max(0, after.length - 8))) { try { fsx.unlinkSync(path.join(MATCHES_DIR, old)); } catch (_) {} }
        } catch (_) {}
        return { ok: true, bytes: json.length };
    } catch (e) { return { error: String(e && e.message) }; }
});

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
    // Testlerde model ASLA yüklenmez: başsız koşularda anlatıcı kullanılmıyor ve
    // 4.9GB'lik model paralel işçi sayısını tek başına çökertiyordu.
    if (typeof TEST_KIPI !== 'undefined' && TEST_KIPI) { llmError = 'test kipinde LLM kapalı'; return; }
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
        if (m.t === 'count') {
            const r = llmPending.get(m.id);
            if (r) { llmPending.delete(m.id); r(m.error ? null : Number(m.tokens)); }
        }
    });
    llmChild.on('exit', () => { llmChild = null; llmReady = false; for (const r of llmPending.values()) r(null); llmPending.clear(); });
    // gpuLayers: 'auto' → node-llama-cpp VRAM'e sığdığı kadar katmanı GPU'ya koyar,
    // gerisini CPU'da bırakır. GPU'lu makinede diyalog ~1 sn, GPU'suzda ~45 sn ama
    // çalışır. Ölçüm: bench --gpu 99 ile 24-50 jeton/sn alındı, yani bu makinede GPU
    // yolu çalışıyor. Sığdırma başarısız olursa host 'error' yollar, oyun şablona düşer.
    // Hikâye sohbeti son turları ve karakter bağlamını birlikte taşır. 1024,
    // ikinci mesajdan sonra geçmişi kırpıyordu. Turkish-Llama'nın gerçek eğitim
    // tavanı 8192'dir; daha büyük değer bağlam taşması uyarısı ve sahte kapasite
    // üretir. GPU katman seçimi yine otomatiktir.
    llmChild.send({ t: 'load', modelPath: llmPath, gpuLayers: 'auto', contextSize: 8192 });
}

// ── BELLEK DÜZELTMESİ: durum yoklaması ARTIK MODELİ YÜKLEMEZ ────────────────
// ÖLÇÜLDÜ: oyun açılıp menüde beklerken 5.38GB tüketiyordu. Süreç dağılımı:
//   llm-host 4900MB · gpu 496MB · renderer 129MB · ana 94MB
// Yani yükün %85'i dil modeliydi ve KULLANICI ANLATICIYI HİÇ AÇMASA BİLE yükleniyordu:
// js/LLM.js açılışta llmProbe() → llm:status → llmStart() → GGUF modeli belleğe.
// Artık durum yoklaması saf bilgi döndürür; model YALNIZ gerçekten kullanılacağı an
// yüklenir (llm:generate) ya da kullanıcı anlatıcıyı açınca (llm:start).
ipcMain.handle('llm:status', () => ({
    ready: llmReady,
    error: llmError,
    model: llmPath ? path.basename(llmPath) : null,
    yuklendi: !!llmChild,                 // model süreci ayakta mı
    modelVar: !!(llmPath || findModel())  // diskte model var mı (yüklemeden)
}));

// Açık istek: kullanıcı yapay anlatıcıyı açtı → modeli şimdi yükle.
ipcMain.handle('llm:start', () => {
    if (TEST_KIPI) return { ready: false, error: 'test kipinde LLM kapalı', model: null };
    if (!llmChild && !llmError) llmStart();
    return { ready: llmReady, error: llmError, model: llmPath ? path.basename(llmPath) : null };
});

ipcMain.handle('llm:generate', async (_e, req) => {
    req = req || {};
    if (!llmChild && !llmError) llmStart();
    if (!llmReady) return null;                       // hazır değilse oyun yedeğe düşer
    const id = ++llmSeq;
    llmChild.send({
        t: 'gen', id, system: req.system, prompt: req.prompt,
        maxTokens: req.maxTokens, temperature: req.temperature,
        jsonSchema: req.jsonSchema
    });
    return new Promise(resolve => {
        llmPending.set(id, resolve);
        // ZAMAN AŞIMI 30 sn → 120 sn. Ölçüm: saf CPU'da 7B ~0.8 jeton/sn, tek diyalog
        // 36–54 sn sürüyor. 30 sn'lik sınır CPU'daki HER üretimi keserdi: model 4.5 GB
        // RAM tutar, bir çekirdeği doldurur ve sonuç HİÇBİR ZAMAN kullanılmazdı.
        // Oyun zaten bunu beklemiyor (ateşle-unut), o yüzden uzun sınır bedava.
        setTimeout(() => { if (llmPending.has(id)) { llmPending.delete(id); resolve(null); } }, 120000);
    });
});

ipcMain.handle('llm:tokenCount', async (_e, text) => {
    if (!llmReady || !llmChild) return null;
    const id = ++llmSeq;
    llmChild.send({ t: 'count', id, text: String(text || '') });
    return new Promise(resolve => {
        llmPending.set(id, resolve);
        setTimeout(() => { if (llmPending.has(id)) { llmPending.delete(id); resolve(null); } }, 10000);
    });
});

app.on('will-quit', () => { if (llmChild) { try { llmChild.send({ t: 'stop' }); } catch (_) {} } });
