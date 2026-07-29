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
        const click = sel => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (el) el.click(); return !!el; })()`);
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
            const setZoom = z => js(`(() => { try { const cv=document.getElementById('storyCanvas'); storyCam.zoom=${z}; storyCenterCamOnPlayer(); storyClampCam(cv.width,cv.height); storyRender(); return {zoom:storyCam.zoom, pp:(typeof storyPP==='function'?storyPP():null), min:STORY._minZoom}; } catch(e){return {err:e.message};} })()`);
            // uzak (min zoom → düz)
            let info = await js(`(() => { const cv=document.getElementById('storyCanvas'); storyCam.zoom=STORY._minZoom||0.6; storyClampCam(cv.width,cv.height); storyRender(); return {zoom:storyCam.zoom, pp:storyPP(), min:STORY._minZoom}; })()`);
            console.log('MAPTEST_FAR ' + JSON.stringify(info)); await sleep(200); await shot('map-1-uzak-duz');
            info = await setZoom(2.2); console.log('MAPTEST_MID ' + JSON.stringify(info)); await sleep(200); await shot('map-2-orta');
            info = await setZoom(4.5); console.log('MAPTEST_NEAR ' + JSON.stringify(info)); await sleep(200); await shot('map-3-yakin-tilt');
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
            const res = await js(`(() => { try {
                const DRV = ${JSON.stringify(drvArg)};
                const pump = (n, useAi) => { const drv = useAi ? battleControllersDrive : null; for (let i=0;i<n && phase===PHASE.BATTLE;i++){ simulationTime+=BATTLE_TICK_MS; gameTime+=BATTLE_TICK_SEC; stepSim(simulationTime, BATTLE_TICK_SEC, drv, false); updateSupport(BATTLE_TICK_SEC, simulationTime); } };
                openAIVsAILab({ start:true, show:false, durationSec:240 }); SIM.headless = true;
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
                openBattlefieldSession({ mode:'quick', mapId:-2, seed:${SEED}, attackerSide:${forceRedAttacker ? 'true' : 'false'}, durationSec:240, playerMoney:1500, enemyMoney:1500, deployRes:null, deployPool:null, techBonus:null, techBonusRed:null, show:false });
                const blueManifest = battleBuildArmyManifest(1400, { maxUnits: 16, combatFocused: true });
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
                    openBattlefieldSession({ mode:'quick', mapId:-2, seed:${SEED}, attackerSide:true, durationSec:240, playerMoney:1500, enemyMoney:1500, deployRes:null, deployPool:null, techBonus:null, techBonusRed:null, show:false });
                    battleDeployManifest(battleBuildArmyManifest(1400, { maxUnits: 16, combatFocused: true }), false, { source: 'versus-blue' });
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
                openBattlefieldSession({ mode:'quick', mapId:-2, seed:${SEED}, attackerSide:true, durationSec:240, playerMoney:1500, enemyMoney:1500, deployRes:null, deployPool:null, techBonus:null, techBonusRed:null, show:false });
                battleDeployManifest(battleBuildArmyManifest(1400, { maxUnits: 16, combatFocused: true }), false, { source: 'selfplay-blue' });
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
                    openBattlefieldSession({ mode:'quick', mapId:-2, seed:${seed}, attackerSide:true, durationSec:240, playerMoney:1500, enemyMoney:1500, deployRes:null, deployPool:null, techBonus:null, techBonusRed:null, show:false });
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
                openBattlefieldSession({ mode:'quick', mapId:-2, seed:2024, attackerSide:true, durationSec:240, playerMoney:1500, enemyMoney:1500, deployRes:null, deployPool:null, techBonus:null, techBonusRed:null, show:false });
                battleDeployManifest(battleBuildArmyManifest(1400, { maxUnits: 16, combatFocused: true }), false, { source: 'snaptest-blue' });
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
                battleDeployManifest(battleBuildArmyManifest(1400, { maxUnits: 16, combatFocused: true }), false, { source: 'smoke-blue' });
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
                openBattlefieldSession({ mode:'quick', mapId:-2, seed:${SEED}, attackerSide:${forceRedAttacker ? 'true' : 'false'}, durationSec:240, playerMoney:1500, enemyMoney:1500, deployRes:null, deployPool:null, techBonus:null, techBonusRed:null, show:false });
                battleDeployManifest(battleBuildArmyManifest(${parseInt(process.env.BLUE_BUDGET || '1400', 10)}, { maxUnits: 16, combatFocused: ${(process.env.BLUE_COMBAT || 'combat') !== 'mixed'}, varied: ${process.env.SURROGATE === '1'} }), false, { source: 'sellive-blue' });
                if (${process.env.SURROGATE === '1'}) { BATTLE_SURROGATE_SIDE = false; }   // mavi = insan-taktiği vekil (money-metrik: insan-gibiyi yenme)
                BATTLE_UNIT_SELF_DEFENSE = ${process.env.NOSELFDEF === '1' ? 'false' : 'true'};   // ÖLÇÜM: mikro-fix etkisi
                BATTLE_FORCE_CONCENTRATE = ${process.env.CONC === '1' ? 'true' : 'false'};   // ÖLÇÜM: konsantrasyon kaldıracı
                startBattle(); window.requestAnimationFrame = () => 0;
                if (${useModel ? 'true' : 'false'}) { battleSelectorEnable(${JSON.stringify(MODEL)}, 'battle-red-ai'); BATTLE_SELECTOR_MIN_TICK = ${process.env.SEL_MIN || 0}; BATTLE_SELECTOR_MAX_TICK = ${process.env.SEL_MAX || 999999}; } else battleSelectorDisable();
                const ph = SIM.headless; SIM.headless = true;
                let ticks = 0; const maxT = Math.round(240 / BATTLE_TICK_SEC);
                try { while (ticks < maxT && phase === PHASE.BATTLE && !(SIM.battle && SIM.battle.winnerSide !== null && SIM.battle.winnerSide !== undefined)) { simulationTime+=BATTLE_TICK_MS; gameTime+=BATTLE_TICK_SEC; stepSim(simulationTime, BATTLE_TICK_SEC, battleControllersDrive, false); if (typeof updateSupport==='function') updateSupport(BATTLE_TICK_SEC, simulationTime); ticks++; } } finally { SIM.headless = ph; }
                battleSelectorDisable();
                const red = battleOracleForceValue(true), blue = battleOracleForceValue(false);
                const winner = (SIM.battle && SIM.battle.winnerSide !== undefined) ? SIM.battle.winnerSide : null;
                return { ticks, redVal: Math.round(red.effective), blueVal: Math.round(blue.effective), redCount: red.count, blueCount: blue.count, diff: Math.round(red.effective - blue.effective), winnerRed: winner === true, winnerBlue: winner === false, decided: winner !== null };
            } catch(e){ return { err:e.message, stack:(e.stack||'').slice(0,300) }; } })()`;
            const rows = [];
            for (const SEED of SEEDS) {
                const m = await js(runMatch(SEED, true));
                const b = await js(runMatch(SEED, false));
                if ((m && m.err) || (b && b.err)) { console.log('SELECTORLIVE_HATA seed=' + SEED + ' ' + JSON.stringify(m && m.err ? m : b)); continue; }
                const row = { seed: SEED, modelDiff: m.diff, baseDiff: b.diff, delta: m.diff - b.diff, modelWin: m.winnerRed, baseWin: b.winnerRed, modelRed: m.redVal, modelBlue: m.blueVal, baseRed: b.redVal, baseBlue: b.blueVal };
                rows.push(row);
                console.log('SELECTORLIVE seed=' + SEED + ' model(red-blue)=' + m.diff + ' baseline=' + b.diff + ' Δ=' + row.delta + ' modelKazandı=' + m.winnerRed + ' baseKazandı=' + b.winnerRed);
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
                openBattlefieldSession({ mode:'quick', mapId:-2, seed:${SEED}, attackerSide:${forceRedAttacker ? 'true' : 'false'}, durationSec:240, playerMoney:1500, enemyMoney:1500, deployRes:null, deployPool:null, techBonus:null, techBonusRed:null, show:false });
                battleDeployManifest(battleBuildArmyManifest(1400, { maxUnits: 16, combatFocused: true }), false, { source: 'oracledata-blue' });
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
                    openBattlefieldSession({ mode:'quick', mapId:-2, seed:${SEED}, attackerSide:${forceRedAttacker ? 'true' : 'false'}, durationSec:240, playerMoney:1500, enemyMoney:1500, deployRes:null, deployPool:null, techBonus:null, techBonusRed:null, show:false });
                    battleDeployManifest(battleBuildArmyManifest(1400, { maxUnits: 16, combatFocused: true }), false, { source: 'oracleseq-blue' });
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
                    openBattlefieldSession({ mode:'quick', mapId:-2, seed:${SEED}, attackerSide:${forceRedAttacker ? 'true' : 'false'}, durationSec:240, playerMoney:1500, enemyMoney:1500, deployRes:null, deployPool:null, techBonus:null, techBonusRed:null, show:false });
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
                openBattlefieldSession({ mode:'quick', mapId:-2, seed:2112, attackerSide:${redDefends ? 'false' : 'true'}, durationSec:240, playerMoney:1500, enemyMoney:1500, deployRes:null, deployPool:null, techBonus:null, techBonusRed:null, show:false });
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
            if (!info || info.sessionMode !== 'quick' ||
                info.engineVersion !== 'battlefield-v2-fixed50-microfix3' ||
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
                        tick: 241,
                        forceRatio: 0.4,
                        forcePosture: FORCE_POSTURE.DISADVANTAGE,
                        readiness: { hp: 0.2, ammo: 0.2 }
                    }, 241);
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
        fsx.writeFileSync(HUMAN_DATA_FILE, JSON.stringify(data));
        return { count: examples.length, total: data.examples.length };
    } catch (e) { return { error: String(e && e.message) }; }
});
ipcMain.handle('train:humanDataCount', () => {
    try { const d = JSON.parse(require('fs').readFileSync(HUMAN_DATA_FILE, 'utf8')); return { total: (d.examples || []).length }; }
    catch (_) { return { total: 0 }; }
});
// #5: her maçın TAM kaydını qa-runtime/last-match.json'a yaz (Claude gerçek maçı izlesin: donma/flank/yana-açılma).
const LAST_MATCH_FILE = app.isPackaged
    ? path.join(path.dirname(process.execPath), '..', '..', 'qa-runtime', 'last-match.json')
    : path.join(__dirname, '..', 'qa-runtime', 'last-match.json');
ipcMain.handle('train:saveMatchRecording', (_e, rec) => {
    try {
        if (!rec) return { ok: false };
        const fsx = require('fs');
        fsx.mkdirSync(path.dirname(LAST_MATCH_FILE), { recursive: true });
        fsx.writeFileSync(LAST_MATCH_FILE, JSON.stringify(rec));
        return { ok: true, bytes: JSON.stringify(rec).length };
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
