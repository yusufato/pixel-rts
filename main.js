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
// Paketlenmiş Electron, bilinmeyen `--battletest` argümanını Chromium katmanında
// reddedebiliyor. Aynı testi kullanıcının açtığı EXE üzerinde çalıştırabilmek için
// yalnız yerel süreç ortamından etkinleşen ikinci, açık bir giriş sağlanır.
const BATTLETEST = process.argv.includes('--battletest') ||
    process.env.PIXEL_RTS_BATTLETEST === '1';
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
                    autoDeployedRedUnits: SIM.units.filter(unit => !unit.dead && unit.isRed).length,
                    autoDeployment: BATTLE_SESSION.aiDeployment || null,
                    grid: (typeof terrainGrid !== 'undefined' && terrainGrid) ? terrainGrid.length : -1,
                    feats: (typeof terrainFeatures !== 'undefined') ? terrainFeatures.length : -1 };
            } catch (e) { return { err: e.message }; } })()`);
            if (!info || info.sessionMode !== 'quick' || info.engineVersion !== 'battlefield-v2-fixed50' ||
                info.tickMs !== 50 || !info.sameStep || !info.hashReady || !info.replayReady) {
                problems.push('ortak savaş motoru doğrulanamadı: ' + JSON.stringify(info));
            } else if (!info.controllerReady || !info.perceptionReady ||
                !info.situationReady || !info.commitmentReady ||
                !info.planningReady || !info.executionReady || !info.bootstrapReady ||
                !info.deploymentReady || info.autoDeployedRedUnits < 1 ||
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
                            sameManifest:
                                blueAttackLab.blueHash === redAttackLab.blueHash &&
                                blueAttackLab.redHash === redAttackLab.redHash,
                            sameSeed: 919191
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
                !determinism.aiLab?.playerDefends?.redOrdered ||
                determinism.aiLab?.playerDefends?.blueOrdered ||
                determinism.aiLab?.playerDefends?.blueDamageReceived <= 0 ||
                determinism.aiLab?.playerDefends?.redDamageReceived <= 0 ||
                determinism.aiLab?.playerDefends?.winnerSide !== true ||
                determinism.aiLab?.playerDefends?.blueDamageReceived <=
                    determinism.aiLab?.playerDefends?.redDamageReceived * 1.5 ||
                determinism.aiLab?.playerDefends?.terrainViolationIds?.length > 0 ||
                determinism.aiLab?.playerDefends?.navigationStuckUnitIds?.length > 0 ||
                !determinism.aiLab?.playerAttacks?.redOrdered ||
                determinism.aiLab?.playerAttacks?.blueOrdered ||
                determinism.aiLab?.playerAttacks?.blueDamageReceived <= 0 ||
                determinism.aiLab?.playerAttacks?.redDamageReceived <= 0 ||
                determinism.aiLab?.playerAttacks?.winnerSide !== true ||
                determinism.aiLab?.playerAttacks?.blueDamageReceived <=
                    determinism.aiLab?.playerAttacks?.redDamageReceived * 1.5 ||
                determinism.aiLab?.playerAttacks?.terrainViolationIds?.length > 0 ||
                determinism.aiLab?.playerAttacks?.navigationStuckUnitIds?.length > 0 ||
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
                determinism.execution?.transitions < 2 ||
                !determinism.execution?.phases?.includes('ADVANCE') ||
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
            const packagedResultFile = process.env.PIXEL_RTS_BATTLETEST_RESULT;
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
