'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const dialogueScenarioLab = require('./story-dialogue-scenario-lab');

const ROOT = path.resolve(__dirname, '..');
const STORY_SOURCES = [
    // GERCEK ROSTER once: T/STATS/UNIT_RES_GROUP bunlardan uretilir (prelude'daki sahte tanim kaldirildi)
    'js/UnitData.js',
    'js/UnitFeatures.js',
    'js/UnitLoader.js',
    'js/terrainData.js',
    'js/techTree.js',
    'js/geoData.js',
    'js/Story.js',
    'js/StoryFeatures.js',
    'js/StoryRegions.js',
    'js/StoryActivation.js',
    'js/StoryAggregation.js',
    'js/StoryInfrastructure.js',
    'js/StoryResources.js',
    'js/StoryProductionSectors.js',
    'js/StoryPopulation.js',
    'js/StoryRegionalEconomy.js',
    'js/StoryTrade.js',
    'js/StoryMarket.js',
    'js/StoryBudget.js',
    'js/StoryNeeds.js',
    'js/StoryCompanies.js',
    'js/StoryOpinion.js',
    'js/StoryCollectiveAction.js',
    'js/StoryHumanMigration.js',
    'js/StoryPowerCenters.js',
    'js/StoryInstitutions.js',
    'js/StoryStateCapacity.js',
    'js/StoryElections.js',
    'js/StoryIntegrity.js',
    'js/StoryPoliticalCrisis.js',
    'js/StoryGovernance.js',
    'js/StoryCommerce.js',
    'js/StoryEconomicAI.js',
    'js/StoryMapRasterAsset.js',
    'js/StoryMapRaster.js',
    'js/StoryPoliticalOverlay.js',
    'js/StoryMapCache.js',
    'js/StoryRng.js',
    'js/StoryClock.js',
    'js/StoryScheduler.js',
    'js/StoryCausality.js',
    'js/StoryWorldV2.js',
    'js/PlayerKnowledge.js',
    'js/StoryProjection.js',
    'js/StoryCityDossier.js',
    'js/StoryMigration.js',
    'js/StoryTelemetry.js',
    'js/StoryAI.js',
    'js/StorySocial.js',
    'js/Character.js',
    'js/CharacterRoleQuestions.js',
    'js/StoryCharacters.js',
    'js/StoryRelationships.js',
    'js/StoryMemory.js',
    'js/StoryDecisionTrace.js',
    'js/StoryCharacterActions.js',
    'js/StoryContacts.js',
    'js/Factions.js',
    'js/Economy.js',
    'js/News.js',
    'js/StoryRender.js',
    'js/StoryUI.js',
    'js/Production.js',
    'js/Council.js',
    'js/LLM.js',
    'js/StoryCharacterArbiter.js',
    'js/StoryCharacterSpeech.js',
    'js/StoryConversationUnderstanding.js',
    'js/StoryNegotiation.js',
    'js/StoryMechanicalContracts.js',
    'js/Era.js',
    'js/Talks.js',
    'js/CommanderTree.js'
];

function mulberry32(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) | 0;
        let value = Math.imul(state ^ (state >>> 15), 1 | state);
        value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function fakeCanvasContext(canvas) {
    const noOp = () => {};
    return new Proxy({
        canvas,
        fillRect: () => {
            canvas.__fillRectCalls = (canvas.__fillRectCalls || 0) + 1;
        },
        drawImage: () => {
            canvas.__drawImageCalls = (canvas.__drawImageCalls || 0) + 1;
        },
        putImageData: imageData => {
            canvas.__putImageDataCalls = (canvas.__putImageDataCalls || 0) + 1;
            canvas.__lastImageData = imageData;
        },
        measureText: text => ({ width: String(text || '').length * 8 }),
        createImageData: (width, height) => ({
            width,
            height,
            data: new Uint8ClampedArray(width * height * 4)
        }),
        getImageData: (_x, _y, width, height) => ({
            width,
            height,
            data: new Uint8ClampedArray(width * height * 4)
        }),
        createLinearGradient: () => ({ addColorStop: noOp }),
        createRadialGradient: () => ({ addColorStop: noOp })
    }, {
        get(target, property) {
            if (property in target) return target[property];
            return noOp;
        },
        set(target, property, value) {
            target[property] = value;
            return true;
        }
    });
}

function createRuntime(seed) {
    const html = '<!doctype html><html><body>'
        + '<canvas id="storyCanvas"></canvas>'
        + '<div id="story-stats"></div>'
        + '<aside id="story-brief-panel">'
        + '<nav id="story-brief-tabs" role="tablist">'
        + '<button id="story-tab-agenda" class="story-brief-tab active" data-story-brief-tab="agenda" role="tab" aria-selected="true"></button>'
        + '<button id="story-tab-region" class="story-brief-tab" data-story-brief-tab="region" role="tab" aria-selected="false"></button>'
        + '<button id="story-tab-flow" class="story-brief-tab" data-story-brief-tab="flow" role="tab" aria-selected="false"></button></nav>'
        + '<section id="story-agenda"><div id="story-agenda-summary"></div><div id="story-agenda-list"></div></section>'
        + '<div id="story-hud" class="hidden"><span id="story-era"></span><div id="story-node-info"></div><button id="story-action-btn"></button></div>'
        + '<div id="story-news" class="hidden"><div id="story-log"></div></div></aside>'
        + '<button id="story-city-btn"></button>'
        + '<aside id="city-panel" aria-hidden="true"><span id="city-title"></span>'
        + '<button id="city-close"></button><div id="city-body"></div></aside>'
        + '<button id="story-economy-btn"><i id="story-economy-badge" class="tool-badge hidden"></i></button>'
        + '<aside id="economy-panel" aria-hidden="true"><span id="economy-title"></span>'
        + '<button id="economy-close"></button><div id="economy-body"></div></aside>'
        + '<button id="story-talk-btn"></button>'
        + '<aside id="talk-panel" aria-hidden="true"><button id="talk-close"></button>'
        + '<div id="talk-body"></div></aside>'
        + '<div id="conversation-workspace-modal" class="conversation-workspace-modal hidden" role="dialog" aria-modal="true">'
        + '<section class="conversation-workspace-shell"><header class="conversation-workspace-header">'
        + '<span id="conversation-workspace-name"></span><span id="conversation-workspace-meta"></span>'
        + '<button id="conversation-workspace-close"></button></header><div class="conversation-workspace-layout">'
        + '<aside id="conversation-workspace-profile"></aside><main id="conversation-workspace-main"></main>'
        + '<aside id="conversation-workspace-history"></aside></div></section></div>'
        + '<button id="story-council-btn"></button>'
        + '<aside id="council-panel" aria-hidden="true"><button id="council-close"></button>'
        + '<div id="council-admin-banner"></div><div id="council-tabs">'
        + '<button class="ctab active" data-tab="cmd"></button><button class="ctab" data-tab="law"></button>'
        + '<button class="ctab" data-tab="gov"></button></div>'
        + '<div id="council-tab-cmd"><div id="council-treasury"></div><div id="council-list"></div>'
        + '<div id="council-confirm" class="hidden"></div><div id="council-actions">'
        + '<button id="council-create-btn"></button><button id="council-dismiss-btn"></button></div></div>'
        + '<div id="council-tab-law" class="hidden"><div id="council-lawbox"></div></div>'
        + '<div id="council-tab-gov" class="hidden"><div id="governance-body"></div></div></aside>'
        + '<div id="faction-event-modal" class="hidden" role="dialog" aria-modal="true">'
        + '<span id="faction-event-kicker"></span><h2 id="faction-event-title"></h2>'
        + '<div id="faction-event-body"></div><div id="faction-event-responses" class="hidden"></div>'
        + '<button id="faction-event-economy"></button>'
        + '<button id="faction-event-close"></button></div>'
        + '</body></html>';
    const dom = new JSDOM(html, {
        url: 'https://pixel-rts.invalid/',
        runScripts: 'outside-only',
        pretendToBeVisual: true
    });
    const { window } = dom;
    const seeded = mulberry32(seed);
    const storage = new Map();

    window.Math.random = seeded;
    window.Date.now = () => 1_700_000_000_000;
    window.alert = () => {};
    window.confirm = () => false;
    window.prompt = () => null;
    window.requestAnimationFrame = () => 0;
    window.cancelAnimationFrame = () => {};
    window.HTMLCanvasElement.prototype.getContext = function getContext() {
        if (!this.__storyHarnessContext) this.__storyHarnessContext = fakeCanvasContext(this);
        return this.__storyHarnessContext;
    };
    Object.defineProperty(window, 'localStorage', {
        value: {
            getItem: key => storage.has(key) ? storage.get(key) : null,
            setItem: (key, value) => storage.set(key, String(value)),
            removeItem: key => storage.delete(key),
            clear: () => storage.clear()
        }
    });

    const context = dom.getInternalVMContext();
    vm.runInContext(`
        // ── GERCEK ROSTER (2026-08-10) ──
        // Burada 9 birimlik SAHTE bir STATS duruyordu (T.ARMOR_INFANTRY dahil — o takma ad gercek
        // motorda HIC YOK). Sonuc: hikaye testleri, sevk edilen 26-birimlik rosteri HIC sinamiyordu
        // ve "T.ARMOR_INFANTRY" hayaleti yillarca gorunmedi. Artik gercek roster yuklenir
        // (UnitData → UnitFeatures → UnitLoader, asagidaki STORY_SOURCES basinda) ve T/STATS/
        // UNIT_RES_GROUP oradan gelir. Testler bundan boyle sevk edilenle ayni veriyi gorur.
        let DEPLOY_RES = null;
        let DEPLOY_POOL = null;
        let TECH_BONUS = null;
        let TECH_BONUS_RED = null;
        let phase = 'over';
        const PHASE = { DEPLOY: 'deploy', BATTLE: 'battle', OVER: 'over' };
        const units = [];
        const MAPS = new Array(10).fill(null);
        function showScreen() {}
    `, context, { filename: 'story-harness-prelude.js' });

    for (const relativePath of STORY_SOURCES) {
        const absolutePath = path.join(ROOT, relativePath);
        const source = fs.readFileSync(absolutePath, 'utf8');
        vm.runInContext(source, context, { filename: relativePath });
        // ROSTER KOPRUSU: oyunda T/STATS/UNIT_RES_GROUP globals.js'te kurulur, ama globals.js savas
        // tarafidir ve hikaye tezgahina yuklenemez (koca bagimlilik zinciri). Bu yuzden ayni uc satiri
        // burada, UnitLoader yuklenir yuklenmez kurariz — kaynak AYNI (unitLoaderBuild), kopya veri yok.
        if (relativePath === 'js/UnitLoader.js') {
            vm.runInContext(`
                const __UL = unitLoaderBuild(UNITS_MODERN_DB);
                const T = __UL.CONST;
                const STATS = __UL.STATS;
                const UNIT_ID_BY_INDEX = __UL.ID_BY_INDEX;
                const UNIT_RES_GROUP = {};
                for (let __i = 0; __i < UNIT_ID_BY_INDEX.length; __i++) {
                    const __c = STATS[__i] ? STATS[__i].category : null;
                    UNIT_RES_GROUP[__i] = (__c === 'infantry') ? 'manpower'
                        : (__c === 'armor' || __c === 'air' || __c === 'uav') ? 'oil' : 'points';
                }
            `, context, { filename: 'story-harness-roster.js' });
        }
    }

    // Headless koşuda insan modalı veya gerçek savaş ekranı simülasyonu durdurmamalı.
    // Bu adaptörler yalnız test VM'inde yaşar; oyun kaynaklarını değiştirmez.
    vm.runInContext(`
        const __storyBuildLandGridReal = storyBuildLandGrid;
        const __storyPanelUpdateReal = storyPanelUpdate;
        function __storyResolveOpenCouncil() {
            let guard = 0;
            while (STORY._session && guard++ < 40) storyCouncilSessionNext();
            if (STORY._session) throw new Error('Headless konsey 40 adımda kapanmadı.');
        }
        storyBuildLandGrid = function storyBuildLandGridHeadless() {
            STORY._landGrid = null;
            STORY._ownerKey = null;
            STORY._terrainCache = null;
        };
        storyCouncilAfkCheck = function storyCouncilAfkCheckHeadless() {
            __storyResolveOpenCouncil();
        };
        storyRender = function storyRenderHeadless() {};
        storyPanelUpdate = function storyPanelUpdateHeadless() {};
        storyLaunchBattle = function storyLaunchBattleHeadless() {};
        storyLaunchDefense = function storyLaunchDefenseHeadless() {};
        storyCheckPlayerDefeat = function storyCheckPlayerDefeatHeadless() { return false; };
        globalThis.__storyHarness = {
            newCampaign: config => storyNewCampaign(config),
            advance: seconds => {
                let remaining = Math.max(0, Number(seconds) || 0);
                while (remaining > 1e-12) {
                    __storyResolveOpenCouncil();
                    const clock = storyClockSnapshot();
                    const wallTick = clock.fixedStepSeconds / Math.max(1, clock.speed);
                    const slice = Math.min(remaining, wallTick);
                    storyAdvance(slice);
                    __storyResolveOpenCouncil();
                    remaining = Math.max(0, remaining - slice);
                }
            },
            setSpeed: speed => storyClockSetSpeed(speed),
            clockSnapshot: () => storyClockSnapshot(),
            schedulerSnapshot: () => storySchedulerSnapshot(),
            causalitySnapshot: () => storyCausalitySnapshot(),
            causalityTrace: id => storyCausalityTrace(id),
            causalityValidate: ledger => storyCausalityValidate(ledger),
            causalityValidateWorld: ledger => storyCausalityValidateWorldConsistency(ledger),
            causalityRestore: ledger => storyCausalityRestore(ledger),
            causalityGuardCycle: depth => {
                let executed = 0;
                const blocked = [];
                const descend = remaining => storyCausalityRun({
                    type: 'test.guard.loop',
                    eventType: 'test.guard.loop',
                    target: { type: 'test', id: 'same' }
                }, () => {
                    executed++;
                    if (remaining > 0) {
                        const child = descend(remaining - 1);
                        if (child && child.guarded) blocked.push(child.reason);
                    }
                    return true;
                });
                const receipt = descend(Math.max(0, Number(depth) || 0));
                return { executed, blocked, receipt, guard: storyCausalitySnapshot().guard };
            },
            causalityGuardEventFlood: count => {
                let applied = 0, blocked = 0;
                const receipt = storyCausalityRun({
                    type: 'test.guard.event_flood',
                    target: { type: 'test', id: 'event-root' }
                }, () => {
                    for (let i = 0; i < Math.max(0, Number(count) || 0); i++) {
                        const child = storyCausalityRun({
                            type: 'test.guard.child.' + i,
                            target: { type: 'test', id: i }
                        }, () => { applied++; return true; });
                        if (child.guarded) blocked++;
                    }
                    return true;
                });
                return { applied, blocked, receipt, guard: storyCausalitySnapshot().guard };
            },
            causalityGuardEffectFlood: count => {
                let applied = 0, blocked = 0;
                const receipt = storyCausalityRun({
                    type: 'test.guard.effect_flood',
                    target: { type: 'test', id: 'effect-root' }
                }, () => {
                    for (let i = 0; i < Math.max(0, Number(count) || 0); i++) {
                        const effect = storyCausalityRecordEffect({
                            target: { type: 'test', id: i },
                            path: 'test:' + i + '.value',
                            operation: 'SET',
                            before: 0,
                            after: 1,
                            source: 'test.guard.effect_flood'
                        });
                        if (effect) applied++; else blocked++;
                    }
                    return true;
                });
                return { applied, blocked, receipt, guard: storyCausalitySnapshot().guard };
            },
            causalityGuardWindowFlood: count => {
                let applied = 0, blocked = 0;
                for (let i = 0; i < Math.max(0, Number(count) || 0); i++) {
                    const receipt = storyCausalityRun({
                        type: 'test.guard.window',
                        target: { type: 'test', id: i }
                    }, () => { applied++; return true; });
                    if (receipt.guarded) blocked++;
                }
                return { applied, blocked, guard: storyCausalitySnapshot().guard };
            },
            causalityGuardInvariantProbe: () => {
                const st = STORY.states[0];
                const node = STORY.nodes[0];
                const commander = st.gov && st.gov.commanders[0];
                const before = {
                    welfare: st.welfare,
                    owner: node.owner,
                    commanderNode: commander ? commander.node : null
                };
                const attempts = {};
                attempts.welfare = storyCausalityRun({
                    type: 'test.guard.invalid_welfare',
                    target: { type: 'state', id: st.id }
                }, () => storyCausalitySet(st, 'welfare', 999, {
                    target: { type: 'state', id: st.id },
                    path: 'state:' + st.id + '.welfare'
                })).result;
                attempts.owner = storyCausalityRun({
                    type: 'test.guard.invalid_owner',
                    target: { type: 'region', id: node.id }
                }, () => storyCausalitySet(node, 'owner', 999, {
                    target: { type: 'region', id: node.id },
                    path: 'region:' + node.id + '.ownerId'
                })).result;
                attempts.resource = storyCausalityRun({
                    type: 'test.guard.invalid_resource',
                    target: { type: 'state', id: st.id }
                }, () => !!storyCausalityRecordEffect({
                    target: { type: 'state', id: st.id },
                    path: 'state:' + st.id + '.resources',
                    operation: 'DELTA',
                    before: null,
                    after: null,
                    delta: { oil: NaN, manpower: 0, points: 0 }
                })).result;
                if (commander) {
                    attempts.node = storyCausalityRun({
                        type: 'test.guard.invalid_node',
                        target: { type: 'character', id: commander.id }
                    }, () => storyCausalitySet(commander, 'node', 999999, {
                        target: { type: 'character', id: commander.id },
                        path: 'character:' + commander.id + '.node'
                    })).result;
                }
                return {
                    before,
                    after: {
                        welfare: st.welfare,
                        owner: node.owner,
                        commanderNode: commander ? commander.node : null
                    },
                    attempts,
                    guard: storyCausalitySnapshot().guard
                };
            },
            causalityGuardConsistencyProbe: () => {
                const st = STORY.states[0];
                storyWelfareDelta(st, 'test.guard.consistency', -5, {
                    idempotencyKey: 'test:guard:consistency'
                });
                const ledger = storyCausalitySnapshot();
                const expected = st.welfare;
                st.welfare = expected + 1;
                const broken = storyCausalityValidateWorldConsistency(ledger);
                st.welfare = expected;
                const repaired = storyCausalityValidateWorldConsistency(ledger);
                return { expected, broken, repaired };
            },
            causalityWelfareCommand: (stateId, amount, idempotencyKey) => storyWelfareDelta(
                stateId,
                'test.causality',
                amount,
                { idempotencyKey, correlationId: 'test:causality:welfare' }
            ),
            causalityTransfer: (nodeId, toStateId, idempotencyKey) => storyTransferNodeOwnership(
                nodeId,
                toStateId,
                {
                    idempotencyKey,
                    reason: 'test.causality.transfer',
                    actor: { type: 'state', id: toStateId },
                    correlationId: 'test:causality:transfer'
                }
            ),
            causalityTreaty: (a, b, treaty, years, idempotencyKey) => storySetTreaty(
                a,
                b,
                treaty,
                years,
                {
                    idempotencyKey,
                    reason: 'test.causality.treaty',
                    silent: true
                }
            ),
            causalityRelAdd: (a, b, amount, idempotencyKey) => storyRelAdd(
                a,
                b,
                amount,
                {
                    idempotencyKey,
                    reason: 'test.causality.relation'
                }
            ),
            causalityMove: (stateId, commanderId, toNodeId) => {
                const st = storyState(stateId);
                const commander = st && st.gov
                    ? st.gov.commanders.find(item => item.id === commanderId)
                    : null;
                return storyMoveCommander(commander, toNodeId, { reason: 'test.causality.move' });
            },
            causalityResourceFlow: (stateId, source, delta, idempotencyKey) => storyResourceFlow(
                stateId,
                source,
                delta,
                { idempotencyKey, correlationId: 'test:causality:resource' }
            ),
            telemetryTick: () => storyTelemetryTick(),
            rngSnapshot: () => storyRngSnapshot(),
            rngNext: (stream, count) => {
                const values = [];
                for (let i = 0; i < Math.max(0, Number(count) || 0); i++) values.push(storyRandom(stream));
                return values;
            },
            calendarAt: seconds => storyCalendarAt(seconds),
            setPaused: paused => { STORY.paused = !!paused; },
            putSavedRaw: raw => localStorage.setItem(STORY_SAVE_KEY, String(raw)),
            loadNow: () => storyLoad(),
            completeBattle: (won, summary) => {
                const target = STORY.nodes.find(n => n.owner !== STORY.playerStateId);
                if (!target) throw new Error('Savaş telemetrisi için düşman bölge bulunamadı.');
                STORY.battleCtx = {
                    nodeId: target.id,
                    attacker: STORY.playerStateId,
                    defender: target.owner,
                    enemyStateId: target.owner,
                    enemyStageNode: null,
                    mode: 'attack'
                };
                storyOnBattleEnd(won, summary || {});
            },
            state: () => STORY,
            // ROSTER KAPSAMA OLCUMU icin salt-okunur erisim (tools/hikaye-roster-kapsama.js):
            // uretim kilidi rosterden turetiliyor; 'uretilebilir' ile 'fiilen uretiliyor' AYRI seylerdir.
            stats: () => STATS,
            prodTypes: (node, kind) => (typeof prodTypesFor === 'function' ? prodTypesFor(node, kind) : []),
            // INSA TESHISI: bir binanin nicin hic kurulmadigini VM icinden okumak icin
            // (tahminle ug rasmak yerine kurallari tek tek sinamak). Salt-okunur.
            insaTeshis: () => {
                const out = { sehir: 0, maxSeviye: {}, onkosulOk: {}, adayOk: {} };
                for (const k of PROD_KINDS) { out.maxSeviye[k] = 0; out.onkosulOk[k] = 0; out.adayOk[k] = 0; }
                for (const n of STORY.nodes) {
                    out.sehir++;
                    for (const k of PROD_KINDS) {
                        const lvl = n[k] | 0;
                        out.maxSeviye[k] = Math.max(out.maxSeviye[k], lvl);
                        if (lvl < prodMaxBuildLevel(n) && lvl < PROD_MAX_LEVEL) out.adayOk[k]++;
                        if (prodBuildReqMet(n, k, lvl + 1)) out.onkosulOk[k]++;
                    }
                }
                return out;
            },
            characterIdentityLedger: () => storyCharacterIdentitySnapshot(),
            characterIdentityReset: () => storyCharacterIdentityReset(),
            characterBindPlayerRole: () => storyCharacterBindPlayerRole(),
            validateCharacterIdentityLedger: ledger => storyCharacterIdentityValidate(ledger),
            characterIdentityView: actorId => storyCharacterIdentityView(actorId),
            characterRankOptions: (actorId, options) => storyCharacterRankOptions(actorId, options),
            characterConversationStrategy: (actorId, context) => storyCharacterConversationStrategy(actorId, context),
            characterCreationPolicy: role => storyCharacterCreationRolePolicy(role),
            characterQuestionAt: (theme, stage, previousTag, role) => charQuestionAt(theme, stage, previousTag, role),
            characterDecisionPreview: (theme, optionTag) => storyCharacterDecisionPreview(theme, optionTag),
            characterCreationValidate: character => storyCharacterCreationValidate(character),
            characterCreationOutcome: actorId => storyCharacterCreationOutcomeView(actorId),
            characterCreationSummary: actorId => storyCharacterCreationSummary(actorId),
            relationshipLedger: () => storyRelationshipSnapshot(),
            validateRelationshipLedger: ledger => storyRelationshipValidate(ledger),
            relationshipView: (fromActorId, toActorId) => storyRelationshipView(fromActorId, toActorId),
            relationshipAdjust: (fromActorId, toActorId, deltas, meta) => storyRelationshipAdjust(fromActorId, toActorId, deltas, meta),
            characterMemoryLedger: () => storyMemorySnapshot(),
            characterMemorySummary: () => storyMemorySummary(),
            validateCharacterMemoryLedger: ledger => storyMemoryValidate(ledger),
            characterMemoryAddRecent: (actorId, input) => storyMemoryAddRecent(actorId, input),
            characterMemoryRecall: (actorId, query) => storyMemoryRecallForActor(actorId, query),
            characterMemoryOpenEpisode: input => storyMemoryOpenEpisode(input),
            characterMemoryResolveEpisode: (id, resolution) => storyMemoryResolveEpisode(id, resolution),
            characterMemoryAddMilestone: input => storyMemoryAddMilestone(input),
            characterMemoryResolveMilestone: (id, status) => storyMemoryResolveMilestone(id, status),
            characterActionLedger: () => storyCharacterActionSnapshot(),
            validateCharacterActionLedger: ledger => storyCharacterActionValidate(ledger),
            characterActionCandidate: input => storyCharacterActionCandidate(input),
            characterActionCandidates: (actorId, targetActorId, domainContexts) => storyCharacterActionCandidates(actorId, targetActorId, domainContexts),
            characterActionExecute: input => storyCharacterActionExecute(input),
            characterActionPlayerView: (targetActorId, domainContext) => storyCharacterActionPlayerView(targetActorId, domainContext),
            characterActionExecutePlayer: (actionType, targetActorId, domainContext) => storyCharacterActionExecutePlayer(actionType, targetActorId, domainContext),
            characterActionAIRankActor: actorId => storyCharacterActionAIRankActor(actorId),
            characterActionAISelection: () => storyCharacterActionAISelection(),
            characterActionSyncDomains: () => storyCharacterActionSyncDomainReceipts(),
            characterActionTick: dt => storyCharacterActionTick(dt),
            characterActionSummary: () => storyCharacterActionSummary(),
            characterActionArbiterRecentDecisions: (actorId, limit) => storyCharacterActionArbiterRecentDecisions(actorId, limit),
            characterActionArbiterDecisionRecord: (pending, input) => storyCharacterActionArbiterDecisionRecord(pending, input),
            decisionContextBuild: (actorId, ranked, options) => storyDecisionContextV2Build(actorId, ranked, options),
            decisionTraceBuild: (decisionId, context, input) => storyDecisionTraceV2Build(decisionId, context, input),
            decisionTracePlayerView: (traceId, viewerActorId) => storyDecisionTraceV2PlayerView(traceId, viewerActorId),
            decisionTracePlayerExplanation: (traceId, viewerActorId) => storyDecisionTraceV2PlayerExplanation(traceId, viewerActorId),
            decisionTraceValidate: (contexts, traces, decisions) => storyDecisionTraceV2Validate(contexts, traces, decisions),
            characterArbiterBuildRequest: (actorId, options) => storyCharacterArbiterBuildRequest(actorId, options),
            characterArbiterSystem: () => STORY_CHARACTER_ARBITER_SYSTEM,
            characterArbiterPrompt: request => storyCharacterArbiterPrompt(request),
            characterArbiterJsonSchema: request => storyCharacterArbiterJsonSchema(request),
            characterArbiterValidate: (request, raw) => storyCharacterArbiterValidate(request, raw),
            characterArbiterFallback: (request, reason) => storyCharacterArbiterFallback(request, reason),
            characterArbiterResolve: (request, raw) => storyCharacterArbiterResolve(request, raw),
            characterArbiterAsk: (actorId, options) => storyCharacterArbiterAsk(actorId, options),
            characterArbiterSetLiveAdapter: adapter => storyCharacterArbiterSetLiveAdapter(adapter),
            characterArbiterLiveAvailable: () => storyCharacterArbiterLiveAvailable(),
            characterArbiterLiveDispatch: request => storyCharacterArbiterLiveDispatch(request),
            characterArbiterLiveTake: (requestId, contextHash) => storyCharacterArbiterLiveTake(requestId, contextHash),
            characterArbiterLiveReset: options => storyCharacterArbiterLiveReset(options),
            characterArbiterDiagnostics: () => storyCharacterArbiterDiagnostics(),
            characterSpeechRealizeDecision: (decision, options) => storyCharacterSpeechRealizeDecision(decision, options),
            characterSpeechValidateRealization: realization => storyCharacterSpeechValidateRealization(realization),
            characterSpeechPlayerInbox: limit => storyCharacterSpeechPlayerInbox(limit),
            characterDialogueRealize: (input, options) => storyCharacterDialogueRealize(input, options),
            characterDialogueValidate: realization => storyCharacterDialogueValidate(realization),
            characterDialogueSimilarityBps: (left, right) => storyCharacterDialogueSimilarityBps(left, right),
            characterDialogueSemanticSimilarityBps: (left, right) => storyCharacterDialogueSemanticSimilarityBps(left, right),
            conversationAnalyze: (text, options) => storyConversationAnalyze(text, options),
            conversationValidate: analysis => storyConversationValidate(analysis),
            conversationContract: () => storyConversationContract(),
            conversationSessionBegin: (text, options) => storyConversationSessionBegin(text, options),
            conversationSessionReply: (sessionId, questionId, answer) => storyConversationSessionReply(sessionId, questionId, answer),
            conversationSessionFollowUp: (sessionId, text) => storyConversationSessionFollowUp(sessionId, text),
            conversationLLMParseReply: (text, context) => {
                const raw = String(text || '').trim();
                const wrapped = raw.startsWith('{') ? raw : JSON.stringify({ reply: raw });
                const history = context && context.history || [];
                const fallback = history.length ? String(history[history.length - 1].text || '') : '';
                return storyConversationSocialLLMParse(wrapped, fallback, context && context.playerText || '');
            },
            conversationDiscourseContext: (session, options) => storyConversationDiscourseContext(session, options),
            conversationDiscourseTokenEstimate: text => storyConversationDiscourseTokenEstimate(text),
            conversationHistoryTokenBudget: () => STORY_CONVERSATION_HISTORY_TOKEN_BUDGET,
            conversationSessionEventDecision: (sessionId, optionId) => (
                storyConversationSessionEventDecision(sessionId, optionId)
            ),
            conversationEventAnchorResolve: (input, listenerActorId) => (
                storyConversationSessionResolveEventAnchor(input, listenerActorId)
            ),
            conversationSessionReview: sessionId => storyConversationSessionReview(sessionId),
            conversationSessionResponseOptions: sessionId => storyConversationSessionResponseOptions(sessionId),
            conversationSessionRespond: (sessionId, optionId) => storyConversationSessionRespond(sessionId, optionId),
            conversationActorBeliefView: actorId => storyConversationActorBeliefView(actorId),
            conversationSessionGet: sessionId => storyConversationSessionGet(sessionId),
            conversationSessionList: listenerActorId => storyConversationSessionList(listenerActorId),
            conversationSessionLatest: listenerActorId => storyConversationSessionLatest(listenerActorId),
            conversationSessionSnapshot: () => storyConversationSessionSnapshot(),
            conversationSessionValidate: ledger => storyConversationSessionValidateLedger(ledger),
            conversationSessionRestore: ledger => storyConversationSessionRestore(ledger),
            negotiationCaseOpen: sessionId => storyNegotiationCaseOpen(sessionId),
            negotiationCaseGet: caseId => storyNegotiationCaseGet(caseId),
            negotiationCaseBySession: sessionId => storyNegotiationCaseBySession(sessionId),
            negotiationCaseList: actorId => storyNegotiationCaseList(actorId),
            negotiationCaseCounter: (caseId, actorId, patch) => storyNegotiationCaseCounter(caseId, actorId, patch),
            negotiationCaseAccept: (caseId, actorId, versionId) => storyNegotiationCaseAccept(caseId, actorId, versionId),
            negotiationMechanicalPreflight: (caseId, actorId) => storyNegotiationMechanicalPreflight(caseId, actorId),
            negotiationDeliveryObligationCreate: (caseId, actorId) => (
                storyNegotiationDeliveryObligationCreate(caseId, actorId)
            ),
            negotiationDeliveryTick: () => storyNegotiationDeliveryTick(),
            negotiationDeliverySchedule: (term, startAt) => storyNegotiationDeliverySchedule(term, startAt),
            negotiationPenaltyQuote: (payment, penalty) => storyNegotiationPenaltyQuote(payment, penalty),
            negotiationHash: value => storyNegotiationHash(value),
            negotiationMechanicalGrounding: candidate => storyNegotiationMechanicalGrounding(candidate),
            negotiationVersionFixture: (caseRow, proposerActorId, terms, source) => (
                storyNegotiationVersion(caseRow, proposerActorId, terms, source, null)
            ),
            negotiationPartyApprovalsFixture: (caseRow, acceptedActorIds) => (
                storyNegotiationPartyApprovals(caseRow, acceptedActorIds)
            ),
            negotiationPromiseCreate: (caseId, actorId, obligationCode, dueInSeconds) => storyNegotiationPromiseCreate(caseId, actorId, obligationCode, dueInSeconds),
            negotiationDiplomaticIncidentReview: (candidateId, actorId) => (
                storyNegotiationDiplomaticIncidentReview(candidateId, actorId)
            ),
            negotiationDiplomaticProtestExecute: (candidateId, requestId) => (
                storyNegotiationDiplomaticProtestExecute(candidateId, requestId)
            ),
            negotiationConstitutionalWarExecute: (candidateId, requestId) => (
                storyNegotiationConstitutionalWarExecute(candidateId, requestId)
            ),
            negotiationConstitutionalPeaceExecute: (candidateId, requestIds) => (
                storyNegotiationConstitutionalPeaceExecute(candidateId, requestIds)
            ),
            negotiationFixtureEnableWarReview: candidateId => {
                const candidate = STORY.negotiations && STORY.negotiations.consequenceCandidates[candidateId];
                const review = candidate && candidate.diplomaticReview;
                if (!review) return { ok: false };
                review.damageAssessment.totals.verifiedDirectLoss = 300;
                review.damageAssessment.totals.uncompensatedDamage = 300;
                review.verifiedEconomicDamage = 300;
                review.thresholds.damagePassed = true;
                review.thresholds.hostilityPassed = true;
                review.thresholds.lawfulWarRoute = true;
                review.warCandidate = {
                    kind: 'DECLARE_WAR_REVIEW', status: 'AWAITING_CONSTITUTIONAL_AUTHORITY',
                    executable: false, evidenceClass: 'TEST_FIXTURE'
                };
                candidate.warCandidate = JSON.parse(JSON.stringify(review.warCandidate));
                candidate.blockedReasons = [];
                review.blockedReasons = [];
                return { ok: true, fixture: true };
            },
            negotiationFixtureStateSnapshot: () => ({
                negotiations: JSON.parse(JSON.stringify(STORY.negotiations)),
                institutions: JSON.parse(JSON.stringify(STORY.institutions)),
                rel: JSON.parse(JSON.stringify(STORY.rel || {}))
            }),
            negotiationFixtureStateRestore: snapshot => {
                STORY.negotiations = JSON.parse(JSON.stringify(snapshot.negotiations));
                STORY.institutions = JSON.parse(JSON.stringify(snapshot.institutions));
                STORY.rel = JSON.parse(JSON.stringify(snapshot.rel));
                return true;
            },
            negotiationSecretShare: (caseId, fromActorId, toActorId, sourceBeliefId) => storyNegotiationSecretShare(caseId, fromActorId, toActorId, sourceBeliefId),
            negotiationSecretAuthorize: (secretId, ownerActorId, recipientActorId) => storyNegotiationSecretAuthorize(secretId, ownerActorId, recipientActorId),
            negotiationSecretDisclose: (secretId, discloserActorId, recipientActorId) => storyNegotiationSecretDisclose(secretId, discloserActorId, recipientActorId),
            negotiationSecretReportLeak: (secretId, disclosureId, reporterActorId) => storyNegotiationSecretReportLeak(secretId, disclosureId, reporterActorId),
            negotiationTick: () => storyNegotiationTick(),
            negotiationSnapshot: () => storyNegotiationSnapshot(),
            negotiationValidate: ledger => storyNegotiationValidate(ledger),
            negotiationRestore: ledger => storyNegotiationRestore(ledger),
            mechanicalContractGet: contractId => storyMechanicalContractGet(contractId),
            mechanicalContractList: actorId => storyMechanicalContractList(actorId),
            mechanicalContractSnapshot: () => storyMechanicalContractSnapshot(),
            mechanicalContractValidate: ledger => storyMechanicalContractValidate(ledger),
            mechanicalContractRestore: ledger => storyMechanicalContractRestore(ledger),
            mechanicalContractTypes: () => STORY_MECHANICAL_CONTRACT_TYPES.slice(),
            conversationWorkspaceOpen: (listenerActorId, name, sessionId, anchor) => (
                storyConversationWorkspaceOpen(listenerActorId, name, sessionId, anchor)
            ),
            conversationWorkspaceClose: () => storyConversationWorkspaceClose(),
            conversationWorkspaceRender: options => storyConversationWorkspaceRender(options),
            contactDirectoryBuild: () => storyContactDirectoryBuild(),
            contactDirectoryRenderHtml: view => storyContactDirectoryRenderHtml(view),
            talkUpdate: () => storyTalkUpdate(),
            talkBind: () => storyTalkBind(),
            conversationWorkspaceRender: options => storyConversationWorkspaceRender(options),
            talkRun: templateId => storyTalkRun(templateId),
            talkQueue: () => JSON.parse(JSON.stringify((STORY._talks || []).map(talk => ({
                uid: talk.uid, tpl: talk.tpl, speakerActorId: talk.speakerActorId,
                memoryEpisodeId: talk.memoryEpisodeId,
                options: (talk.options || []).map(option => ({ text: option.text, tip: option.tip }))
            })))),
            talkAnswer: (uid, optionIndex) => storyTalkAnswer(uid, optionIndex),
            diplomacySnapshot: () => JSON.parse(JSON.stringify(STORY.rel || {})),
            relationValue: (a, b) => storyRelValue(a, b),
            treaty: (a, b) => storyTreaty(a, b),
            setTreaty: (a, b, treaty, years, meta) => storySetTreaty(a, b, treaty, years, meta),
            relationAdd: (a, b, delta, meta) => storyRelAdd(a, b, delta, meta),
            isHostile: (a, b) => storyIsHostile(a, b),
            telemetry: () => storyTelemetryExport(),
            worldV2: () => storyWorldV2ExportValidated(),
            emptyWorldV2: options => storyWorldV2CreateEmpty(options),
            validateWorldV2: world => storyWorldV2Validate(world),
            regionSnapshot: () => storyRegionSnapshot(),
            regionModel: () => storyRegionForSave(),
            validateRegionModel: model => storyRegionModelValidate(model, STORY.nodes, STORY.states),
            validateRegionModelAgainst: (model, nodes, states) => storyRegionModelValidate(
                model,
                nodes,
                states || STORY.states
            ),
            activationSnapshot: () => storyActivationSnapshot(),
            validateActivation: snapshot => storyActivationValidate(snapshot),
            activationBatch: (systemId, tick) => storyActivationBatch(systemId, tick),
            activationDue: (regionId, systemId, tick) => storyActivationDue(regionId, systemId, tick),
            activationPolicy: () => storyActivationForSave(),
            aggregationSnapshot: () => storyAggregationSnapshot(),
            validateAggregationSnapshot: snapshot => storyAggregationSnapshotValidate(snapshot),
            aggregationCapsule: regionId => storyAggregationCreateCapsule(regionId),
            validateAggregationCapsule: capsule => storyAggregationCapsuleValidate(capsule),
            aggregationToCold: (regionId, sourceNode) => storyAggregationToCold(regionId, sourceNode),
            aggregationToHot: coldState => storyAggregationToHot(coldState),
            aggregationSignature: items => storyAggregationConservationSignature(items),
            aggregationWorldSignature: items => storyAggregationWorldConservation(items),
            aggregationDistribute: (total, keys, salt, precision) => storyAggregationDistribute(total, keys, salt, precision),
            aggregationHash: value => storyAggregationHash(value),
            aggregationStable: value => storyAggregationStable(value),
            aggregationPolicy: () => storyAggregationForSave(),
            infrastructureSnapshot: () => storyInfrastructureSnapshot(),
            validateInfrastructureSnapshot: snapshot => storyInfrastructureSnapshotValidate(snapshot),
            infrastructureGraph: () => storyInfrastructureClone(STORY.infrastructureGraph),
            validateInfrastructureGraph: graph => storyInfrastructureGraphValidate(graph),
            infrastructureForSave: () => storyInfrastructureForSave(),
            infrastructureCorridorIds: (regionId, mode) => storyInfrastructureCorridorIdsForRegion(regionId, mode),
            infrastructureSetDamage: (corridorId, damageBps, options) => storyInfrastructureSetDamage(corridorId, damageBps, options),
            infrastructureFindRoute: (fromRegionId, toRegionId, options) => storyInfrastructureFindRoute(fromRegionId, toRegionId, options),
            infrastructureResolveFlow: flow => storyInfrastructureResolveFlow(flow),
            infrastructureResolveFlows: flows => storyInfrastructureResolveFlows(flows),
            infrastructureStable: value => storyInfrastructureStable(value),
            resourceCatalogSnapshot: () => storyResourceCatalogSnapshot(),
            resourceUnitResolve: (resourceId, unit, amount) => storyResourceUnitResolve(resourceId, unit, amount),
            validateResourceCatalog: catalog => storyResourceCatalogValidate(catalog),
            resourceTaxonomyForSave: () => storyResourceTaxonomyForSave(),
            resourceLegacyToCanonical: legacy => storyResourceLegacyToCanonical(legacy),
            resourceCanonicalToLegacy: (view, fallback) => storyResourceCanonicalToLegacy(view, fallback),
            resourceCatalogInvalidCase: kind => {
                const candidate = storyResourceCatalogSnapshot();
                if (kind === 'duplicate') {
                    candidate.resources.push(storyResourceClone(candidate.resources[0]));
                } else if (kind === 'producer') {
                    candidate.resources[0].producers = [];
                } else if (kind === 'consumer') {
                    candidate.resources[0].consumers = [];
                } else if (kind === 'unit') {
                    candidate.resources[0].unit.precision = 99;
                } else if (kind === 'shortage') {
                    candidate.resources[0].shortageEffects = [];
                } else if (kind === 'hash') {
                    candidate.catalogHash = 'fnv1a32:badc0ffe';
                } else if (kind === 'unknown') {
                    candidate.resources[0].id = 'unobtainium';
                    candidate.catalogHash = storyResourceHash(storyResourceCanonicalPayload(
                        candidate.resources,
                        candidate.legacyMappings
                    ));
                } else if (kind === 'legacy-mode') {
                    candidate.legacyMappings[0].readMode = 'MATERIALIZE';
                    candidate.catalogHash = storyResourceHash(storyResourceCanonicalPayload(
                        candidate.resources,
                        candidate.legacyMappings
                    ));
                }
                return storyResourceCatalogValidate(candidate);
            },
            productionCatalogSnapshot: () => storyProductionCatalogSnapshot(),
            validateProductionCatalog: catalog => storyProductionCatalogValidate(catalog),
            productionForSave: () => storyProductionForSave(),
            productionEvaluate: (sectorId, request) => storyProductionEvaluate(sectorId, request),
            companyProductionViability: (regionId, sectorId) => (
                storyCompanyProductionViability(regionId, sectorId)
            ),
            companyMarketPrice: (regionId, resourceId) => (
                storyCompanyMarketPrice(regionId, resourceId)
            ),
            companyBaseValues: () => storyCompanyClone(STORY_COMPANY_BASE_VALUE),
            commerceUnitPrice: (regionId, resourceId) => (
                storyCommerceUnitPrice(regionId, resourceId)
            ),
            populationSummary: () => storyPopulationSummary(),
            populationLedger: () => storyPopulationClone(STORY.population),
            validatePopulationLedger: ledger => storyPopulationValidate(ledger),
            populationForSave: () => storyPopulationForSave(),
            populationRegionView: regionId => storyPopulationRegionView(regionId),
            populationCountryView: countryId => storyPopulationCountryView(countryId),
            populationLaborSupply: (regionId, worldDays) => storyPopulationLaborSupply(regionId, worldDays),
            populationTick: dt => storyPopulationTick(dt),
            needsSummary: () => storyNeedsSummary(),
            needsLedger: () => storyNeedsClone(STORY.needsWelfare),
            validateNeedsLedger: ledger => storyNeedsValidate(ledger),
            needsForSave: () => storyNeedsForSave(),
            needsRegionView: regionId => storyNeedsRegionView(regionId),
            needsCountryView: countryId => storyNeedsCountryView(countryId),
            needsCohortView: cohortId => storyNeedsCohortView(cohortId),
            needsTick: dt => storyNeedsTick(dt),
            opinionSummary: options => storyOpinionSummary(options),
            opinionLedger: () => storyOpinionClone(STORY.publicOpinion),
            opinionExpandSaved: saved => storyOpinionExpandSaved(saved),
            validateOpinionLedger: ledger => storyOpinionValidate(ledger),
            opinionForSave: () => storyOpinionForSave(),
            opinionRegionView: regionId => storyOpinionRegionView(regionId),
            opinionCountryView: countryId => storyOpinionCountryView(countryId),
            opinionCohortView: cohortId => storyOpinionCohortView(cohortId),
            opinionTick: dt => storyOpinionTick(dt),
            opinionAdvanceRecord: (previous, sample) => storyOpinionAdvanceRecord(previous, sample),
            collectiveSummary: () => storyCollectiveSummary(),
            collectiveLedger: () => storyCollectiveClone(STORY.collectiveAction),
            validateCollectiveLedger: ledger => storyCollectiveValidate(ledger),
            collectiveForSave: () => storyCollectiveForSave(),
            collectiveCountryView: countryId => storyCollectiveCountryView(countryId),
            collectiveRegionView: regionId => storyCollectiveRegionView(regionId),
            collectiveTick: dt => storyCollectiveTick(dt),
            collectiveRespond: (movementId, mode, options) => storyCollectiveRespond(movementId, mode, options),
            collectiveAdvanceMovement: (previous, sample) => storyCollectiveAdvanceMovement(previous, sample),
            collectiveApplyResponsePure: (movement, mode, at) => storyCollectiveApplyResponsePure(movement, mode, at),
            humanMigrationSummary: () => storyHumanMigrationSummary(),
            humanMigrationLedger: () => storyHumanMigrationClone(STORY.humanMigration),
            validateHumanMigrationLedger: ledger => storyHumanMigrationValidate(ledger),
            humanMigrationForSave: () => storyHumanMigrationForSave(),
            humanMigrationCountryView: countryId => storyHumanMigrationCountryView(countryId),
            humanMigrationRegionView: regionId => storyHumanMigrationRegionView(regionId),
            humanMigrationTick: dt => storyHumanMigrationTick(dt),
            powerCenterSummary: () => storyPowerCenterSummary(),
            powerCenterLedger: () => storyPowerCenterClone(STORY.powerCenters),
            validatePowerCenterLedger: ledger => storyPowerCenterValidate(ledger),
            powerCenterForSave: () => storyPowerCenterForSave(),
            powerCenterCountryView: countryId => storyPowerCenterCountryView(countryId),
            powerCenterRegionView: regionId => storyPowerCenterRegionView(regionId),
            powerCenterPublicView: value => storyPowerCenterPublicView(value),
            powerCenterOrganizationForProblem: (countryId, problemType) => (
                storyPowerCenterOrganizationForProblem(countryId, problemType)
            ),
            powerCenterTick: dt => storyPowerCenterTick(dt),
            institutionSummary: () => storyInstitutionSummary(),
            institutionLedger: () => storyInstitutionClone(STORY.institutions),
            validateInstitutionLedger: ledger => storyInstitutionValidate(ledger),
            institutionForSave: () => storyInstitutionForSave(),
            institutionCountryView: countryId => storyInstitutionCountryView(countryId),
            institutionRegionView: regionId => storyInstitutionRegionView(regionId),
            institutionPublicView: value => storyInstitutionPublicView(value),
            institutionSubmit: input => storyInstitutionSubmitAction(input),
            institutionApprove: (requestId, input) => storyInstitutionApproveAction(requestId, input),
            institutionExecute: (requestId, input) => storyInstitutionExecuteAction(requestId, input),
            institutionTick: dt => storyInstitutionTick(dt),
            stateCapacitySummary: () => storyStateCapacitySummary(),
            stateCapacityLedger: () => storyStateCapacityClone(STORY.stateCapacity),
            validateStateCapacityLedger: ledger => storyStateCapacityValidate(ledger),
            stateCapacityForSave: () => storyStateCapacityForSave(),
            stateCapacityCountryView: countryId => storyStateCapacityCountryView(countryId),
            stateCapacityRegionView: regionId => storyStateCapacityRegionView(regionId),
            stateCapacityPublicView: value => storyStateCapacityPublicView(value),
            stateCapacityTick: dt => storyStateCapacityTick(dt),
            electionSummary: () => storyElectionSummary(),
            electionLedger: () => storyElectionClone(STORY.elections),
            validateElectionLedger: ledger => storyElectionValidate(ledger),
            electionForSave: () => storyElectionForSave(),
            electionCountryView: countryId => storyElectionCountryView(countryId),
            electionPublicView: value => storyElectionPublicView(value),
            electionExecutiveHolder: countryId => storyElectionExecutiveHolder(countryId),
            electionShouldContest: (marginBps, ruleOfLawBps) => storyElectionShouldContest(marginBps, ruleOfLawBps),
            electionTick: dt => storyElectionTick(dt),
            integritySummary: () => storyIntegritySummary(),
            integrityLedger: () => storyIntegrityClone(STORY.integrity),
            validateIntegrityLedger: ledger => storyIntegrityValidate(ledger),
            integrityForSave: () => storyIntegrityForSave(),
            integrityCountryView: countryId => storyIntegrityCountryView(countryId),
            integrityPublicView: value => storyIntegrityPublicView(value),
            integrityRegisterProcurement: spec => storyIntegrityRegisterProcurement(spec),
            integrityOpenInvestigation: (caseId, requestId) => storyIntegrityOpenInvestigation(caseId, requestId),
            integrityResolveInvestigation: caseId => storyIntegrityResolveInvestigation(caseId),
            integrityTick: dt => storyIntegrityTick(dt),
            politicalCrisisSummary: () => storyPoliticalCrisisSummary(),
            politicalCrisisLedger: () => storyPoliticalCrisisClone(STORY.politicalCrises),
            validatePoliticalCrisisLedger: ledger => storyPoliticalCrisisValidate(ledger),
            politicalCrisisForSave: () => storyPoliticalCrisisForSave(),
            politicalCrisisCountryView: countryId => storyPoliticalCrisisCountryView(countryId),
            politicalCrisisPublicView: value => storyPoliticalCrisisPublicView(value),
            politicalCrisisAct: (countryId, actionId, options) => storyPoliticalCrisisAct(countryId, actionId, options),
            politicalCrisisTick: dt => storyPoliticalCrisisTick(dt),
            governanceView: () => storyGovernancePlayerView(),
            governanceActionView: (actionId, regionId) => storyGovernanceActionView(actionId, regionId),
            governanceUpdate: () => storyGovernanceUpdate(),
            governanceSubmit: (actionId, regionId) => storyGovernanceSubmit(actionId, regionId),
            governanceTick: dt => storyGovernanceTick(dt),
            governanceHtml: () => {
                const view = storyGovernanceUpdate();
                const body = document.getElementById('governance-body');
                return { view, text: body ? body.textContent || '' : '', html: body ? body.innerHTML || '' : '' };
            },
            politicalCrisisTalkHtml: () => {
                STORY._talkOpen = true;
                storyTalkUpdate();
                const body = document.getElementById('talk-body');
                return body ? { text: body.textContent || '', html: body.innerHTML || '' } : null;
            },
            populationTransferCohorts: (origin, destination, requested, options) => (
                storyPopulationTransferCohorts(origin, destination, requested, options)
            ),
            factionNoticeCurrent: () => storyCollectiveClone(STORY._factionNoticeCurrent),
            factionNotices: () => storyCollectiveClone([
                ...(STORY._factionNoticeCurrent ? [STORY._factionNoticeCurrent] : []),
                ...(STORY._factionNoticeQueue || [])
            ]),
            factionNoticeHtml: () => {
                const modal = document.getElementById('faction-event-modal');
                return modal ? { text: modal.textContent || '', html: modal.innerHTML || '' } : null;
            },
            productionCatalogInvalidCase: kind => {
                const candidate = storyProductionCatalogSnapshot();
                if (kind === 'duplicate') {
                    candidate.sectors.push(storyProductionClone(candidate.sectors[0]));
                } else if (kind === 'unknown-resource') {
                    candidate.sectors[0].recipe.inputs[0].resourceId = 'unobtainium';
                    candidate.catalogHash = storyProductionHash(storyProductionCanonicalPayload(candidate.sectors));
                } else if (kind === 'unit') {
                    candidate.sectors[0].recipe.inputs[0].unitId = 'barrel';
                    candidate.catalogHash = storyProductionHash(storyProductionCanonicalPayload(candidate.sectors));
                } else if (kind === 'quantity') {
                    candidate.sectors[0].recipe.inputs[0].quantity = 0;
                    candidate.catalogHash = storyProductionHash(storyProductionCanonicalPayload(candidate.sectors));
                } else if (kind === 'endowment') {
                    candidate.sectors[0].recipe.endowments = [];
                    candidate.catalogHash = storyProductionHash(storyProductionCanonicalPayload(candidate.sectors));
                } else if (kind === 'ex-nihilo') {
                    candidate.sectors[0].recipe.inputs = [];
                    candidate.sectors[0].recipe.endowments = [];
                    candidate.catalogHash = storyProductionHash(storyProductionCanonicalPayload(candidate.sectors));
                } else if (kind === 'mass-gain') {
                    candidate.sectors[3].recipe.outputs[0].materialEquivalentTonsPerUnit = 100;
                    candidate.catalogHash = storyProductionHash(storyProductionCanonicalPayload(candidate.sectors));
                } else if (kind === 'producer') {
                    candidate.sectors[0].producerClass = 'DEFENSE_INDUSTRY';
                    candidate.catalogHash = storyProductionHash(storyProductionCanonicalPayload(candidate.sectors));
                } else if (kind === 'resource-link') {
                    candidate.resourceCatalogHash = 'fnv1a32:badc0ffe';
                } else if (kind === 'hash') {
                    candidate.catalogHash = 'fnv1a32:badc0ffe';
                }
                return storyProductionCatalogValidate(candidate);
            },
            regionalSummary: () => storyRegionalSummary(),
            regionalLedger: () => storyRegionalClone(STORY.regionalEconomy),
            validateRegionalLedger: (ledger, options) => storyRegionalValidate(ledger, options),
            regionalForSave: () => storyRegionalForSave(),
            regionalRegionView: regionId => storyRegionalRegionView(regionId),
            regionalStockDelta: (regionId, resourceId, amount, options) => storyRegionalStockDelta(regionId, resourceId, amount, options),
            regionalCommitProduction: (regionId, proposal) => storyRegionalCommitProduction(regionId, proposal),
            regionalAllocateDemands: (regionId, demands) => storyRegionalAllocateDemands(regionId, demands),
            regionalTick: dt => storyRegionalEconomyTick(dt),
            tradeSummary: () => storyTradeSummary(),
            tradeLedger: () => storyTradeClone(STORY.tradeLogistics),
            validateTradeLedger: ledger => storyTradeValidate(ledger),
            tradeForSave: () => storyTradeForSave(),
            tradeRegionView: regionId => storyTradeRegionView(regionId),
            tradeCreateOrder: spec => storyTradeCreateOrder(spec),
            tradeDispatchOrder: (orderId, maxQuantity) => storyTradeDispatchOrder(orderId, maxQuantity),
            tradePlanDomesticDistribution: spec => storyTradePlanDomesticDistribution(spec),
            tradeCommitDomesticDistribution: spec => storyTradeCommitDomesticDistribution(spec),
            tradeProductionOpportunityView: options => storyTradeProductionOpportunityView(options),
            tradeProductionAdmissionPlan: options => storyTradeProductionAdmissionPlan(options),
            tradeRedirectShipment: (shipmentId, targetRegionId, options) => storyTradeRedirectShipment(shipmentId, targetRegionId, options),
            tradeLoseShipment: (shipmentId, reason) => storyTradeLoseShipment(shipmentId, reason),
            tradeTick: (dt, options) => storyTradeLogisticsTick(dt, options),
            tradeInvalidCase: kind => {
                const candidate = storyTradeClone(STORY.tradeLogistics);
                if (kind === 'policy') candidate.policyHash = 'fnv1a32:badc0ffe';
                else if (kind === 'network') candidate.networkHash = 'fnv1a32:badc0ffe';
                else if (kind === 'negative') candidate.totals.dispatched.food = -1;
                else if (kind === 'cargo') candidate.totals.dispatched.food += 1;
                else if (kind === 'route' && candidate.shipments.length) {
                    candidate.shipments[0].routeRegionIds = [];
                } else if (kind === 'distribution-total' && candidate.distributionBatches
                    && candidate.distributionBatches.length) {
                    candidate.distributionBatches[0].quantity += 1;
                }
                return storyTradeValidate(candidate);
            },
            marketSummary: () => storyMarketSummary(),
            marketLedger: () => storyMarketClone(STORY.marketPrices),
            validateMarketLedger: ledger => storyMarketValidate(ledger),
            marketForSave: () => storyMarketForSave(),
            marketRegionView: regionId => storyMarketRegionView(regionId),
            marketCountryView: countryId => storyMarketCountryView(countryId),
            marketTradeQuote: (sourceRegionId, targetRegionId, resourceId, quantity) => (
                storyMarketTradeQuote(sourceRegionId, targetRegionId, resourceId, quantity)
            ),
            marketEvaluatePrice: (resourceId, currentIndex, signal) => (
                storyMarketEvaluatePrice(resourceId, currentIndex, signal)
            ),
            marketTick: dt => storyMarketPriceTick(dt),
            marketInvalidCase: kind => {
                const candidate = storyMarketClone(STORY.marketPrices);
                if (kind === 'policy') candidate.policyHash = 'fnv1a32:badc0ffe';
                else if (kind === 'network') candidate.networkHash = 'fnv1a32:badc0ffe';
                else if (kind === 'price') {
                    const regionId = Object.keys(candidate.regions)[0];
                    candidate.regions[regionId].resources.food.priceIndex = -1;
                } else if (kind === 'labor') {
                    const regionId = Object.keys(candidate.regions)[0];
                    candidate.regions[regionId].resources.labor.priceIndex = 100;
                } else if (kind === 'region') {
                    delete candidate.regions[Object.keys(candidate.regions)[0]];
                }
                return storyMarketValidate(candidate);
            },
            budgetSummary: () => storyBudgetSummary(),
            budgetLedger: () => storyBudgetClone(STORY.stateBudget),
            validateBudgetLedger: (ledger, options) => storyBudgetValidate(ledger, options),
            budgetForSave: () => storyBudgetForSave(),
            budgetCountryView: countryId => storyBudgetCountryView(countryId),
            budgetDebit: (stateId, amount, source, options) => storyBudgetDebit(stateId, amount, source, options),
            budgetTransfer: (stateId, from, to, amount, source, options) => (
                storyBudgetTransfer(stateId, from, to, amount, source, options)
            ),
            budgetCredit: (stateId, amount, source, options) => storyBudgetCredit(stateId, amount, source, options),
            budgetDebt: (stateId, amount, source, options) => storyBudgetIssueDebt(stateId, amount, source, options),
            budgetPrint: (stateId, amount, source, options) => storyBudgetPrintMoney(stateId, amount, source, options),
            budgetReserveNegotiatedPayment: spec => storyBudgetReserveNegotiatedPayment(spec),
            budgetReleaseNegotiatedPayment: (reservationId, reason) => storyBudgetReleaseNegotiatedPayment(reservationId, reason),
            budgetSettleNegotiatedPayment: (reservationId, details) => (
                storyBudgetSettleNegotiatedPayment(reservationId, details)
            ),
            budgetInvalidCase: kind => {
                const candidate = storyBudgetClone(STORY.stateBudget);
                const countryId = Object.keys(candidate.countries)[0];
                const country = candidate.countries[countryId];
                if (kind === 'policy') candidate.policyHash = 'fnv1a32:badc0ffe';
                else if (kind === 'cash') country.accounts['ASSET:CASH'] = -1;
                else if (kind === 'posting' && country.journal.length) {
                    country.journal[country.journal.length - 1].postings[0].amount += 1;
                } else if (kind === 'country') delete candidate.countries[countryId];
                return storyBudgetValidate(candidate, { checkWalletMirrors: false });
            },
            companySummary: () => storyCompanySummary(),
            commerceSummary: () => storyCommerceSummary(),
            commerceReset: options => {
                STORY.companyEconomy.commerce = storyCommerceCreateLedger(options);
                return storyCommerceClone(STORY.companyEconomy.commerce);
            },
            commerceLedger: () => storyCommerceClone(
                STORY.companyEconomy && STORY.companyEconomy.commerce
            ),
            validateCommerceLedger: (commerce, options) => storyCommerceValidate(
                commerce,
                STORY.companyEconomy,
                options
            ),
            companyLedger: () => storyCompanyClone(STORY.companyEconomy),
            validateCompanyLedger: ledger => storyCompanyValidate(ledger),
            companyForSave: () => storyCompanyForSave(),
            companyRegionView: regionId => storyCompanyRegionView(regionId),
            companyCountryView: countryId => storyCompanyCountryView(countryId),
            companyWarehouseOccupancy: (warehouseId, resourceId) => storyCompanyWarehouseOccupancy(warehouseId, resourceId),
            companyPayContractPenalty: (fromCompanyId, toCompanyId, amount, details) => (
                storyCompanyPayContractPenalty(fromCompanyId, toCompanyId, amount, details)
            ),
            companyLoan: (companyId, amount, options) => storyCompanyRequestLoan(companyId, amount, options),
            companyInvest: (companyId, regionId, options) => storyCompanyStartInvestment(companyId, regionId, options),
            companySubmitApplication: spec => storyCompanySubmitApplication(spec),
            companyFundApplication: (applicationId, stateId, amount) => (
                storyCompanyFundApplication(applicationId, stateId, amount)
            ),
            companyApproveApplication: (applicationId, stateId) => (
                storyCompanyApproveLicense(applicationId, stateId)
            ),
            companyRegisterApplication: applicationId => storyCompanyRegisterApplication(applicationId),
            companyLobby: (companyId, amount, options) => storyCompanyLobby(companyId, amount, options),
            companyTick: dt => storyCompanyTick(dt),
            companyInvalidCase: kind => {
                const candidate = storyCompanyClone(STORY.companyEconomy);
                if (kind === 'policy') candidate.policyHash = 'fnv1a32:badc0ffe';
                else if (kind === 'cash') {
                    const companyId = Object.keys(candidate.companies)[0];
                    candidate.companies[companyId].accounts['ASSET:CASH'] = -1;
                } else if (kind === 'ownership') {
                    const companyId = Object.keys(candidate.companies)[0];
                    candidate.companies[companyId].owners[0].shareBps += 1;
                } else if (kind === 'facility') {
                    const facilityId = Object.keys(candidate.facilities)[0];
                    candidate.facilities[facilityId].ownerCompanyId = 'company:missing';
                } else if (kind === 'money') candidate.marketClearingCash += 1;
                return storyCompanyValidate(candidate);
            },
            economicAISummary: () => storyEconomicAISummary(),
            economicAILedger: () => storyEconomicAIClone(STORY.economicAI),
            validateEconomicAILedger: ledger => storyEconomicAIValidate(ledger),
            economicAIForSave: () => storyEconomicAIForSave(),
            economicAICompanyCandidates: companyId => storyEconomicAICompanyCandidates(companyId),
            economicAICountryView: countryId => storyEconomicAICountryView(countryId),
            economicAITick: dt => storyEconomicAITick(dt),
            economicAIInvalidCase: kind => {
                const candidate = storyEconomicAIClone(STORY.economicAI);
                if (kind === 'policy') candidate.policyHash = 'fnv1a32:badc0ffe';
                else if (kind === 'sequence') candidate.decisionSequence = -1;
                else if (kind === 'action' && candidate.decisions.length) {
                    candidate.decisions[0].selectedAction = 'CHEAT_RESOURCES';
                } else if (kind === 'score' && candidate.decisions.length) {
                    candidate.decisions[0].candidates[0].score = Infinity;
                }
                return storyEconomicAIValidate(candidate);
            },
            regionalTamperedCommit: (regionId, proposal) => {
                const candidate = storyRegionalClone(proposal);
                const outputId = Object.keys(candidate.produced || {})[0];
                if (outputId) candidate.produced[outputId].quantity += 1000;
                candidate.proposalHash = storyProductionHash(storyRegionalProposalPayload(candidate));
                return storyRegionalCommitProduction(regionId, candidate);
            },
            regionalInvalidCase: kind => {
                const candidate = storyRegionalClone(STORY.regionalEconomy);
                if (kind === 'negative') {
                    const regionId = Object.keys(candidate.regions)[0];
                    candidate.regions[regionId].stocks.food = -1;
                } else if (kind === 'missing-region') {
                    delete candidate.regions[Object.keys(candidate.regions)[0]];
                } else if (kind === 'policy') {
                    candidate.policyHash = 'fnv1a32:badc0ffe';
                } else if (kind === 'topology') {
                    candidate.topologyHash = 'fnv1a32:badc0ffe';
                } else if (kind === 'missing-resource') {
                    const regionId = Object.keys(candidate.regions)[0];
                    delete candidate.regions[regionId].stocks.food;
                }
                return storyRegionalValidate(candidate);
            },
            mapRasterEnsure: () => storyMapRasterEnsure(),
            mapRasterCreate: options => storyMapRasterCreate(options),
            validateMapRaster: raster => storyMapRasterValidate(raster),
            mapRasterDiagnostics: () => storyMapRasterDiagnostics(),
            mapRasterResample: (width, height) => storyMapRasterResample(width, height),
            mapRasterResampleLand: (width, height) => storyMapRasterResampleLand(width, height),
            mapRasterCoverage: (width, height) => storyMapRasterCoverageAt(width, height),
            mapRasterSample: (x, y) => storyMapRasterSample(storyMapRasterEnsure(), x, y),
            mapRasterPickWorld: (x, y) => storyMapPickNode(x, y),
            mapRasterSameInstance: () => storyMapRasterEnsure() === storyMapRasterEnsure(),
            mapRasterHashBytes: values => storyMapRasterHashBytes(values),
            mapCacheDiagnostics: () => storyMapCacheDiagnostics(),
            mapCacheInvalidate: (scope, reason, details) => storyInvalidateMapCaches(scope, reason, details),
            mapCacheContractProbe: () => {
                const imageHash = canvas => {
                    const data = canvas && canvas.__lastImageData && canvas.__lastImageData.data;
                    return data ? storyMapRasterHashBytes(data) : 'image:none';
                };
                const originalEraState = STORY._era ? Object.assign({}, STORY._era) : null;
                STORY._cw = 1280;
                STORY._ch = 720;
                STORY._minZoom = 1;
                storyCam.x = 0;
                storyCam.y = 0;
                storyCam.zoom = 1;
                const firstRaster = storyMapRasterEnsure();
                __storyBuildLandGridReal();
                const firstTerrain = storyEnsureTerrainCache();
                const firstOwner = storyPoliticalOverlayEnsureCanvas();
                const firstOwnerSource = Object.assign({}, STORY._ownerOverlaySource);
                const firstWarp = storyWarpPlan();
                const firstTerrainSource = Object.assign({}, STORY._geoTerrainSource);
                const firstTerrainHash = imageHash(firstTerrain);

                const ownershipEvent = storyInvalidateMapCaches(
                    'ownership',
                    'test-ownership-change'
                );
                const ownershipTerrain = storyEnsureTerrainCache();
                const ownershipOwner = storyPoliticalOverlayEnsureCanvas();
                const ownershipOwnerSource = Object.assign({}, STORY._ownerOverlaySource);
                const ownershipWarp = storyWarpPlan();
                const ownershipSameRaster = firstRaster === STORY.canonicalMapRaster;
                const ownershipSameTerrain = firstTerrain === ownershipTerrain;
                const ownershipSameOwnerCanvas = firstOwner === ownershipOwner;
                const ownershipSameWarp = firstWarp === ownershipWarp;

                const currentEra = STORY._era && STORY._era.id ? STORY._era.id : 'gray';
                const nextEra = currentEra === 'cold' ? 'fire' : 'cold';
                const eraTransition = storyEraTransitionTo(nextEra, 'test-era-change');
                const eraTerrain = storyEnsureTerrainCache();
                const eraTerrainSource = Object.assign({}, STORY._geoTerrainSource);
                const eraOwner = storyPoliticalOverlayEnsureCanvas();
                const eraWarp = storyWarpPlan();
                const eraOwnerRevision = Number(STORY._ownerOverlaySource.revision);
                const eraOwnerUnchanged = eraOwner === ownershipOwner
                    && eraOwnerRevision === ownershipOwnerSource.revision;
                const eraWarpUnchanged = eraWarp === ownershipWarp;

                const oldColor = STORY.states[0].color;
                STORY.states[0].color = oldColor === '#010203' ? '#040506' : '#010203';
                const paletteEvent = storyInvalidateMapCaches(
                    'palette',
                    'test-state-palette-change',
                    { stateId: STORY.states[0].id }
                );
                const paletteTerrain = storyEnsureTerrainCache();
                const paletteOwner = storyPoliticalOverlayEnsureCanvas();
                const paletteOwnerSource = Object.assign({}, STORY._ownerOverlaySource);

                const viewportEvent = storyInvalidateMapCaches('viewport', 'test-viewport-change');
                const viewportTerrain = storyEnsureTerrainCache();
                const viewportOwner = storyPoliticalOverlayEnsureCanvas();
                const viewportWarp = storyWarpPlan();

                const beforeInvalid = storyMapCacheDiagnostics();
                const invalidEvent = storyInvalidateMapCaches('unknown', 'test-invalid');
                const afterInvalid = storyMapCacheDiagnostics();

                const geometryEvent = storyInvalidateMapCaches('geometry', 'test-geometry-change');
                const afterGeometryClear = storyMapCacheDiagnostics();
                const rebuiltRaster = storyMapRasterEnsure();
                __storyBuildLandGridReal();
                const rebuiltTerrain = storyEnsureTerrainCache();
                const rebuiltOwner = storyPoliticalOverlayEnsureCanvas();
                const rebuiltWarp = storyWarpPlan();
                STORY.states[0].color = oldColor;
                STORY._era = originalEraState;
                storyInvalidateMapCaches('palette', 'test-contract-restore');
                storyEnsureTerrainCache();
                storyPoliticalOverlayEnsureCanvas();

                return {
                    first: {
                        paletteId: firstTerrainSource.paletteId,
                        paletteKey: firstTerrainSource.paletteKey,
                        terrainHash: firstTerrainHash,
                        ownerRevision: firstOwnerSource.revision
                    },
                    ownership: {
                        event: ownershipEvent,
                        sameRaster: ownershipSameRaster,
                        sameTerrain: ownershipSameTerrain,
                        sameOwnerCanvas: ownershipSameOwnerCanvas,
                        ownerRevisionDelta: ownershipOwnerSource.revision - firstOwnerSource.revision,
                        sameWarp: ownershipSameWarp
                    },
                    era: {
                        transition: eraTransition,
                        terrainRebuilt: eraTerrain !== ownershipTerrain,
                        terrainHashChanged: imageHash(eraTerrain) !== firstTerrainHash,
                        paletteChanged: eraTerrainSource.paletteKey !== firstTerrainSource.paletteKey,
                        ownerUnchanged: eraOwnerUnchanged,
                        warpUnchanged: eraWarpUnchanged
                    },
                    palette: {
                        event: paletteEvent,
                        terrainRebuilt: paletteTerrain !== eraTerrain,
                        ownerCanvasReused: paletteOwner === eraOwner,
                        ownerRevisionDelta: paletteOwnerSource.revision - ownershipOwnerSource.revision
                    },
                    viewport: {
                        event: viewportEvent,
                        terrainUnchanged: viewportTerrain === paletteTerrain,
                        ownerUnchanged: viewportOwner === paletteOwner,
                        warpRebuilt: viewportWarp !== eraWarp
                    },
                    invalid: {
                        event: invalidEvent,
                        revisionUnchanged: beforeInvalid.lastInvalidation.revision
                            === afterInvalid.lastInvalidation.revision
                    },
                    geometry: {
                        event: geometryEvent,
                        cleared: afterGeometryClear.populated,
                        rasterRebuilt: rebuiltRaster !== firstRaster,
                        sourceHashStable: rebuiltRaster.sourceHash === firstRaster.sourceHash,
                        terrainReady: !!rebuiltTerrain,
                        ownerReady: !!rebuiltOwner,
                        warpReady: !!rebuiltWarp
                    },
                    diagnostics: storyMapCacheDiagnostics()
                };
            },
            mapRasterAssetDecode: asset => storyMapRasterAssetDecode(asset),
            mapRasterAssetSnapshot: () => {
                const asset = globalThis.STORY_MAP_RASTER_ASSET_V1;
                return asset ? Object.assign({}, asset, {
                    payloadChunks: Array.isArray(asset.payloadChunks) ? asset.payloadChunks.slice() : []
                }) : null;
            },
            mapRasterAssetInvalidCase: kind => {
                const source = globalThis.STORY_MAP_RASTER_ASSET_V1;
                if (!source) return storyMapRasterAssetDecode(null);
                const candidate = Object.assign({}, source, {
                    payloadChunks: source.payloadChunks.slice()
                });
                if (kind === 'schema') candidate.schemaVersion++;
                else if (kind === 'source') candidate.sourceHash = 'fnv1a32:badc0ffe';
                else if (kind === 'encoding') candidate.encoding = 'unknown-rle';
                else if (kind === 'payload-hash') candidate.payloadHash = 'fnv1a32:badc0ffe';
                else if (kind === 'run-count') candidate.runCount++;
                else if (kind === 'truncated') {
                    const joined = candidate.payloadChunks.join('');
                    candidate.payloadChunks = [joined.slice(0, Math.max(0, joined.length - 8))];
                }
                return storyMapRasterAssetDecode(candidate);
            },
            mapRasterAssetFallbackCase: kind => {
                const original = globalThis.STORY_MAP_RASTER_ASSET_V1;
                let candidate = null;
                if (original) {
                    candidate = Object.assign({}, original, { payloadChunks: original.payloadChunks.slice() });
                    if (kind === 'source') candidate.sourceHash = 'fnv1a32:badc0ffe';
                    else if (kind === 'payload') candidate.payloadHash = 'fnv1a32:badc0ffe';
                }
                globalThis.STORY_MAP_RASTER_ASSET_V1 = kind === 'missing' ? null : candidate;
                storyMapRasterInvalidate('test-asset-fallback');
                const raster = storyMapRasterEnsure();
                const result = {
                    sourceHash: raster.sourceHash,
                    landHash: raster.landHash,
                    regionHash: raster.regionHash,
                    diagnostics: Object.assign({}, raster.diagnostics),
                    failure: STORY._mapRasterAssetFailure
                        ? JSON.parse(JSON.stringify(STORY._mapRasterAssetFailure))
                        : null
                };
                globalThis.STORY_MAP_RASTER_ASSET_V1 = original;
                storyMapRasterInvalidate('test-asset-restore');
                return result;
            },
            politicalOverlayCreate: () => storyPoliticalOverlayCreate(),
            politicalOverlayHashBytes: values => storyPoliticalOverlayHashBytes(values),
            validatePoliticalOverlay: overlay => storyPoliticalOverlayValidate(overlay),
            politicalOverlayDiagnostics: () => storyPoliticalOverlayDiagnostics(),
            politicalOverlayEnsureCanvas: () => {
                const canvas = storyPoliticalOverlayEnsureCanvas();
                return canvas ? {
                    width: canvas.width,
                    height: canvas.height,
                    fillRectCalls: Number(canvas.__fillRectCalls) || 0,
                    putImageDataCalls: Number(canvas.__putImageDataCalls) || 0,
                    source: STORY._ownerOverlaySource ? Object.assign({}, STORY._ownerOverlaySource) : null
                } : null;
            },
            politicalOverlayAudit: () => {
                const raster = storyMapRasterEnsure();
                const overlay = STORY._ownerOverlayData || storyPoliticalOverlayCreate({ raster });
                let seaAlphaLeaks = 0;
                let landAlphaMissing = 0;
                let seaBorderLeaks = 0;
                let invalidLandAlpha = 0;
                let interiorPixels = 0;
                let borderPixels = 0;
                for (let index = 0; index < raster.landMask.length; index++) {
                    const alpha = overlay.rgba[index * 4 + 3];
                    if (!raster.landMask[index]) {
                        if (alpha !== 0) seaAlphaLeaks++;
                        if (overlay.borderMask[index]) seaBorderLeaks++;
                        continue;
                    }
                    if (alpha === 0) landAlphaMissing++;
                    if (alpha !== 51 && alpha !== 230) invalidLandAlpha++;
                    if (overlay.borderMask[index]) borderPixels++;
                    else interiorPixels++;
                }
                return {
                    validation: storyPoliticalOverlayValidate(overlay, raster),
                    seaAlphaLeaks,
                    landAlphaMissing,
                    seaBorderLeaks,
                    invalidLandAlpha,
                    interiorPixels,
                    borderPixels,
                    rgbaHash: overlay.rgbaHash,
                    borderHash: overlay.borderHash
                };
            },
            politicalOverlayTransferProbe: () => {
                const firstCanvas = storyPoliticalOverlayEnsureCanvas();
                const firstSource = Object.assign({}, STORY._ownerOverlaySource);
                const cachedCanvas = storyPoliticalOverlayEnsureCanvas();
                const cachedSource = Object.assign({}, STORY._ownerOverlaySource);
                const node = STORY.nodes.find(candidate => STORY.states.some(
                    state => state.id !== candidate.owner
                ));
                const fromOwner = node.owner;
                const toState = STORY.states.find(state => state.id !== fromOwner);
                const transferred = storyTransferNodeOwnership(node, toState.id, {
                    reason: 'test.political-overlay-transfer',
                    idempotencyKey: 'test:political-overlay:' + node.id
                });
                const invalidation = STORY._ownerOverlayInvalidation
                    ? Object.assign({}, STORY._ownerOverlayInvalidation)
                    : null;
                const rebuiltCanvas = storyPoliticalOverlayEnsureCanvas();
                const rebuiltSource = Object.assign({}, STORY._ownerOverlaySource);
                return {
                    nodeId: node.id,
                    fromOwner,
                    toOwner: toState.id,
                    transferred,
                    sameCanvasOnCacheHit: firstCanvas === cachedCanvas,
                    sameCanvasAfterTransfer: firstCanvas === rebuiltCanvas,
                    firstSource,
                    cachedSource,
                    rebuiltSource,
                    invalidation,
                    fillRectCalls: Number(rebuiltCanvas.__fillRectCalls) || 0,
                    putImageDataCalls: Number(rebuiltCanvas.__putImageDataCalls) || 0
                };
            },
            politicalOverlayInvalidCase: kind => {
                const raster = storyMapRasterEnsure();
                const source = storyPoliticalOverlayCreate({ raster });
                const candidate = Object.assign({}, source, {
                    rgba: source.rgba.slice(),
                    borderMask: source.borderMask.slice(),
                    diagnostics: Object.assign({}, source.diagnostics)
                });
                if (kind === 'source') candidate.sourceHash = 'fnv1a32:badc0ffe';
                else if (kind === 'owner') candidate.ownerHash = 'fnv1a32:badc0ffe';
                else if (kind === 'dimension') candidate.width--;
                else if (kind === 'rgba-checksum') candidate.rgbaHash = 'fnv1a32:badc0ffe';
                else if (kind === 'border-checksum') candidate.borderHash = 'fnv1a32:badc0ffe';
                else if (kind === 'sea-alpha') {
                    const index = raster.landMask.findIndex(value => value === 0);
                    candidate.rgba[index * 4 + 3] = 1;
                    candidate.rgbaHash = storyPoliticalOverlayHashBytes(candidate.rgba);
                } else if (kind === 'border-value') {
                    const index = raster.landMask.findIndex(value => value === 1);
                    candidate.borderMask[index] = 2;
                    candidate.borderHash = storyPoliticalOverlayHashBytes(candidate.borderMask);
                } else if (kind === 'border-topology') {
                    const index = candidate.borderMask.findIndex((value, offset) => (
                        raster.landMask[offset] === 1 && value === 0
                    ));
                    candidate.borderMask[index] = 1;
                    candidate.borderHash = storyPoliticalOverlayHashBytes(candidate.borderMask);
                }
                return storyPoliticalOverlayValidate(candidate, raster);
            },
            warpRun: (width, height, zoomRatio, adaptive) => {
                STORY.featureFlags['render.adaptiveMapWarp'] = !!adaptive;
                STORY._cw = Number(width);
                STORY._ch = Number(height);
                STORY._minZoom = 1;
                STORY._warpPlanCache = null;
                STORY._warpPlanStats = { hits: 0, misses: 0 };
                storyCam.x = 0;
                storyCam.y = 0;
                storyCam.zoom = Math.max(1, Number(zoomRatio) || 1);
                const source = document.createElement('canvas');
                source.width = 820;
                source.height = 645;
                const target = document.createElement('canvas');
                target.width = Number(width);
                target.height = Number(height);
                const context = target.getContext('2d');
                const started = performance.now();
                const first = storyBlitWarp(context, source);
                const second = storyBlitWarp(context, source);
                const durationMs = performance.now() - started;
                const plan = storyWarpPlan();
                let maxRoundTripError = 0;
                for (const point of [[0, 0], [STORY_WORLD_W * 0.25, STORY_WORLD_H * 0.35], [STORY_WORLD_W * 0.8, STORY_WORLD_H * 0.75]]) {
                    const screen = storyW2S(point[0], point[1]);
                    const world = storyS2W(screen.x, screen.y);
                    maxRoundTripError = Math.max(
                        maxRoundTripError,
                        Math.abs(world.x - point[0]),
                        Math.abs(world.y - point[1])
                    );
                }
                return {
                    first,
                    second,
                    width: Number(width),
                    height: Number(height),
                    zoomRatio: Number(zoomRatio),
                    adaptive: !!adaptive,
                    band: plan.band,
                    rows: plan.rows.length,
                    drawCalls: Number(target.__drawImageCalls) || 0,
                    durationMs: Math.round(durationMs * 1000) / 1000,
                    maxScaleError: plan.maxScaleError,
                    maxRoundTripError,
                    cache: Object.assign({}, STORY._warpPlanStats),
                    lastFrame: Object.assign({}, STORY._warpLastFrame)
                };
            },
            warpInvalidSource: () => {
                STORY._cw = 1280;
                STORY._ch = 720;
                storyCam.zoom = 1;
                const target = document.createElement('canvas');
                const ok = storyBlitWarp(target.getContext('2d'), { width: 0, height: 0 });
                return { ok, error: STORY._warpLastError ? Object.assign({}, STORY._warpLastError) : null };
            },
            mapRasterInvalidCase: kind => {
                const source = storyMapRasterEnsure();
                const candidate = Object.assign({}, source, {
                    landMask: source.landMask.slice(),
                    regionIds: source.regionIds.slice(),
                    diagnostics: Object.assign({}, source.diagnostics)
                });
                if (kind === 'source') candidate.sourceHash = 'fnv1a32:badc0ffe';
                else if (kind === 'land-value') {
                    const index = candidate.landMask.findIndex(value => value === 1);
                    candidate.landMask[index] = 2;
                    candidate.landHash = storyMapRasterHashBytes(candidate.landMask);
                } else if (kind === 'sea-region') {
                    const index = candidate.landMask.findIndex(value => value === 0);
                    candidate.regionIds[index] = 0;
                    candidate.regionHash = storyMapRasterHashBytes(candidate.regionIds);
                } else if (kind === 'land-region') {
                    const index = candidate.landMask.findIndex(value => value === 1);
                    candidate.regionIds[index] = 32767;
                    candidate.regionHash = storyMapRasterHashBytes(candidate.regionIds);
                } else if (kind === 'checksum') candidate.landHash = 'fnv1a32:badc0ffe';
                else if (kind === 'length') candidate.landMask = candidate.landMask.slice(1);
                return storyMapRasterValidate(candidate);
            },
            mapBuildRenderCaches: () => {
                STORY._geoTerrain = null;
                STORY._geoTerrainSource = null;
                STORY._ownerCache = null;
                STORY._ownerKey = null;
                __storyBuildLandGridReal();
                const terrain = storyGeoTerrainCache();
                const overlay = storyEnsureOwnerOverlay();
                return {
                    terrain: {
                        width: terrain.width,
                        height: terrain.height,
                        source: STORY._geoTerrainSource ? Object.assign({}, STORY._geoTerrainSource) : null
                    },
                    overlay: {
                        width: overlay.width,
                        height: overlay.height,
                        source: STORY._ownerOverlaySource
                            ? Object.assign({}, STORY._ownerOverlaySource)
                            : (STORY._landGridSource ? Object.assign({}, STORY._landGridSource) : null),
                        fillRectCalls: Number(overlay.__fillRectCalls) || 0,
                        putImageDataCalls: Number(overlay.__putImageDataCalls) || 0
                    }
                };
            },
            mapBuildOwnerOverlayReal: () => {
                STORY._ownerCache = null;
                STORY._ownerKey = null;
                STORY._ownerOverlayData = null;
                STORY._ownerOverlaySource = null;
                __storyBuildLandGridReal();
                const overlay = storyEnsureOwnerOverlay();
                return {
                    width: overlay.width,
                    height: overlay.height,
                    source: STORY._ownerOverlaySource
                        ? Object.assign({}, STORY._ownerOverlaySource)
                        : (STORY._landGridSource ? Object.assign({}, STORY._landGridSource) : null),
                    fillRectCalls: Number(overlay.__fillRectCalls) || 0,
                    putImageDataCalls: Number(overlay.__putImageDataCalls) || 0
                };
            },
            mapBuildLandGridReal: () => {
                __storyBuildLandGridReal();
                return {
                    width: STORY_GW,
                    height: STORY_GH,
                    worldWidth: STORY_WORLD_W,
                    worldHeight: STORY_WORLD_H,
                    grid: STORY._landGrid ? STORY._landGrid.slice() : [],
                    source: STORY._landGridSource ? Object.assign({}, STORY._landGridSource) : null
                };
            },
            cityDossierBuild: nodeId => storyCityDossierBuild(nodeId),
            validateCityDossier: view => storyCityDossierValidate(view),
            cityDossierPerfReset: () => storyCityDossierPanelReset(),
            cityDossierPerf: () => storyCityDossierPanelPerfSnapshot(),
            renderCityDossier: (nodeId, tab) => {
                STORY.selectedNodeId = Number(nodeId);
                STORY._citySub = String(tab || 'genel');
                STORY._cityOpen = true;
                const panel = document.getElementById('city-panel');
                if (panel) {
                    panel.classList.add('open');
                    panel.setAttribute('aria-hidden', 'false');
                }
                storyCityUpdate();
                return {
                    html: document.getElementById('city-body')?.innerHTML || '',
                    text: document.getElementById('city-body')?.textContent || '',
                    title: document.getElementById('city-title')?.textContent || '',
                    tab: STORY._citySub,
                    selectedNodeId: STORY.selectedNodeId,
                    ariaHidden: document.getElementById('city-panel')?.getAttribute('aria-hidden')
                };
            },
            renderEconomy: (nodeId, tab) => {
                STORY.selectedNodeId = Number(nodeId);
                STORY._economySub = String(tab || 'genel');
                STORY._economyOpen = true;
                const panel = document.getElementById('economy-panel');
                if (panel) {
                    panel.classList.add('open');
                    panel.setAttribute('aria-hidden', 'false');
                }
                storyEconomyUpdate();
                return {
                    html: document.getElementById('economy-body')?.innerHTML || '',
                    text: document.getElementById('economy-body')?.textContent || '',
                    title: document.getElementById('economy-title')?.textContent || '',
                    tab: STORY._economySub,
                    selectedNodeId: STORY.selectedNodeId,
                    ariaHidden: document.getElementById('economy-panel')?.getAttribute('aria-hidden')
                };
            },
            cityDossierOpenRegion: regionId => storyCityDossierOpenRegion(regionId),
            cityDossierOpenEvent: changeId => storyCityDossierOpenEvent(changeId),
            cityDossierOpenCharacter: characterId => storyCityDossierOpenCharacter(characterId),
            cityDossierUiState: () => ({
                selectedNodeId: STORY.selectedNodeId,
                cityOpen: !!STORY._cityOpen,
                economyOpen: !!STORY._economyOpen,
                talkOpen: !!STORY._talkOpen,
                talkFocusCharacterId: STORY._talkFocusCharacterId || null,
                talkText: document.getElementById('talk-body')?.textContent || '',
                talkHtml: document.getElementById('talk-body')?.innerHTML || ''
            }),
            activationUiState: input => {
                input = input || {};
                if (input.selectedNodeId != null) STORY.selectedNodeId = Number(input.selectedNodeId);
                if (input.cityOpen != null) STORY._cityOpen = !!input.cityOpen;
                if (input.councilOpen != null) STORY._councilOpen = !!input.councilOpen;
                if (input.changesOpen != null) STORY._changesOpen = !!input.changesOpen;
                if (input.camera && typeof storyCam === 'object') {
                    if (Number.isFinite(Number(input.camera.x))) storyCam.x = Number(input.camera.x);
                    if (Number.isFinite(Number(input.camera.y))) storyCam.y = Number(input.camera.y);
                    if (Number.isFinite(Number(input.camera.zoom))) storyCam.zoom = Number(input.camera.zoom);
                }
                return {
                    selectedNodeId: STORY.selectedNodeId,
                    cityOpen: !!STORY._cityOpen,
                    councilOpen: !!STORY._councilOpen,
                    changesOpen: !!STORY._changesOpen,
                    camera: typeof storyCam === 'object'
                        ? { x: storyCam.x, y: storyCam.y, zoom: storyCam.zoom }
                        : null
                };
            },
            activationMovePlayer: nodeId => {
                const target = storyNode(Number(nodeId));
                if (!target) return false;
                STORY.commander.node = target.id;
                return true;
            },
            playerKnowledge: (world, playerCountryId) => storyPlayerKnowledgeProject(world, playerCountryId),
            validatePlayerKnowledge: view => storyPlayerKnowledgeValidate(view),
            samplePlayerFact: input => storyPlayerVisibleFact(input),
            playerDomainProjection: (world, knowledge, ledger, options) => storyPlayerDomainProjection(world, knowledge, ledger, options),
            validatePlayerProjection: (view, knowledge, ledger) => storyPlayerProjectionValidate(view, knowledge, ledger),
            currentPlayerProjection: options => storyPlayerProjectionCurrent(options),
            renderPlayerChanges: () => {
                const projection = storyPlayerProjectionCurrent({ maxItems: 100 });
                const panel = document.getElementById('story-change-panel');
                return {
                    panelRemoved: !panel,
                    projectedItemCount: (projection.items || []).length,
                    projectedStepCount: (projection.items || []).reduce((sum, item) => (
                        sum + (item.cause && Array.isArray(item.cause.steps) ? item.cause.steps.length : 0)
                    ), 0)
                };
            },
            factionNoticeProbe: type => {
                const me = storyPlayerState();
                storyFacEvent(me, type || 'cityLost');
                const modal = document.getElementById('faction-event-modal');
                return {
                    visible: !!modal && !modal.classList.contains('hidden'),
                    role: modal ? modal.getAttribute('role') : null,
                    title: document.getElementById('faction-event-title')?.textContent || '',
                    body: document.getElementById('faction-event-body')?.textContent || '',
                    badgeHidden: document.getElementById('story-economy-badge')?.classList.contains('hidden')
                };
            },
            topBarWorldState: () => {
                __storyPanelUpdateReal();
                const chip = document.querySelector('.story-stat-chip.world-state');
                const stats = document.getElementById('story-stats');
                if (chip) chip.focus();
                const heldChip = document.querySelector('.story-stat-chip.world-state');
                __storyPanelUpdateReal();
                const stableWhileFocused = heldChip === document.querySelector('.story-stat-chip.world-state');
                return {
                    text: chip ? chip.textContent : '',
                    tooltip: chip ? chip.getAttribute('data-story-tooltip') : '',
                    focusable: chip ? chip.getAttribute('tabindex') : null,
                    html: stats ? stats.innerHTML : '',
                    eraAvailable: typeof storyEra === 'function',
                    stableWhileFocused
                };
            },
            commandCenter: () => {
                __storyPanelUpdateReal();
                const items = storyAgendaCollect(storyPlayerState());
                const summary = document.getElementById('story-agenda-summary');
                const list = document.getElementById('story-agenda-list');
                const agendaTab = document.getElementById('story-tab-agenda');
                const regionTab = document.getElementById('story-tab-region');
                storyBriefSetTab('region');
                const regionState = {
                    selected: regionTab && regionTab.getAttribute('aria-selected'),
                    agendaHidden: document.getElementById('story-agenda')?.classList.contains('hidden'),
                    regionHidden: document.getElementById('story-hud')?.classList.contains('hidden')
                };
                storyBriefSetTab('agenda');
                return {
                    tabCount: document.querySelectorAll('[data-story-brief-tab]').length,
                    tablistRole: document.getElementById('story-brief-tabs')?.getAttribute('role'),
                    agendaSelected: agendaTab && agendaTab.getAttribute('aria-selected'),
                    itemCount: items.length,
                    severities: items.map(item => item.severity),
                    summaryText: summary ? summary.textContent : '',
                    listText: list ? list.textContent : '',
                    html: list ? list.innerHTML : '',
                    actionCount: list ? list.querySelectorAll('[data-story-agenda-action]').length : 0,
                    regionState
                };
            },
            savedRaw: () => localStorage.getItem(STORY_SAVE_KEY),
            saveNow: () => storySave(),
            saveStatus: () => ({ ok: STORY._lastSaveOk === true, error: STORY._lastSaveError || null }),
            migrateRaw: raw => storyMigrationV3RawToV2(raw),
            migrateStorage: (storage, keys) => storyMigrateV3Storage(storage, keys),
            welfareDelta: (stateId, source, amount, meta) => storyWelfareDelta(stateId, source, amount, meta)
        };
    `, context, { filename: 'story-harness-adapters.js' });

    // Uzun kabul paketi yuzlerce yalitilmis jsdom/VM dunyasi kurar. window.close
    // kaynaklari kapatir fakat V8 eski baglamlari 4 GB sinirina dek toplamayi
    // erteleyebilir. npm test --expose-gc ile calistiginda yalniz yuksek heap
    // basincinda kapatilmis dunyalari topla; oyun runtime'ina dokunmaz.
    const jsdomClose = window.close.bind(window);
    let runtimeClosed = false;
    window.close = () => {
        if (!runtimeClosed) {
            runtimeClosed = true;
            jsdomClose();
        }
        if (typeof global.gc === 'function'
            && process.memoryUsage().heapUsed >= 768 * 1024 * 1024) {
            global.gc();
        }
    };

    return { dom, api: window.__storyHarness };
}

function round(value, digits = 4) {
    if (!Number.isFinite(value)) return value;
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function stateSnapshot(story) {
    return {
        clock: round(story.clock),
        rng: story.rng && story.rng.streams ? {
            schemaVersion: story.rng.schemaVersion,
            rootSeed: story.rng.rootSeed,
            streams: Object.fromEntries(Object.keys(story.rng.streams).sort().map(name => [
                name,
                {
                    state: story.rng.streams[name].state,
                    calls: story.rng.streams[name].calls
                }
            ]))
        } : null,
        scheduler: story.scheduler ? {
            schemaVersion: story.scheduler.schemaVersion,
            sequence: story.scheduler.sequence,
            processedSeconds: round(story.scheduler.processedSeconds),
            tasks: Object.fromEntries(Object.keys(story.scheduler.tasks || {}).map(taskId => [
                taskId,
                {
                    elapsedSeconds: round(story.scheduler.tasks[taskId].elapsedSeconds),
                    runCount: story.scheduler.tasks[taskId].runCount,
                    lastRunSequence: story.scheduler.tasks[taskId].lastRunSequence
                }
            ]))
        } : null,
        population: story.population ? {
            schemaVersion: story.population.schemaVersion,
            policyHash: story.population.policyHash,
            revision: story.population.revision,
            regions: Object.fromEntries(Object.keys(story.population.regions || {}).sort().map(regionId => {
                const region = story.population.regions[regionId];
                return [regionId, {
                    countryId: region.countryId,
                    populationPeople: region.populationPeople,
                    cohorts: region.cohorts.map(row => ({
                        id: row.id,
                        shareBps: row.shareBps,
                        membersPeople: row.membersPeople
                    }))
                }];
            }))
        } : null,
        needsWelfare: story.needsWelfare ? {
            schemaVersion: story.needsWelfare.schemaVersion,
            policyHash: story.needsWelfare.policyHash,
            tickSequence: story.needsWelfare.tickSequence,
            regions: Object.fromEntries(Object.keys(story.needsWelfare.regions || {}).sort().map(regionId => {
                const region = story.needsWelfare.regions[regionId];
                return [regionId, {
                    countryId: region.countryId,
                    populationPeople: region.populationPeople,
                    foodAccessBps: region.foodAccessBps,
                    energyAccessBps: region.energyAccessBps,
                    incomeSecurityBps: region.incomeSecurityBps,
                    unemploymentRiskBps: region.unemploymentRiskBps,
                    securityBps: region.securityBps,
                    publicServicesBps: region.publicServicesBps,
                    wellbeingBps: region.wellbeingBps,
                    cohorts: region.cohorts.map(row => ({
                        cohortId: row.cohortId,
                        wellbeingBps: row.wellbeingBps,
                        primaryPressure: row.primaryPressure
                    }))
                }];
            }))
        } : null,
        publicOpinion: story.publicOpinion ? {
            schemaVersion: story.publicOpinion.schemaVersion,
            policyHash: story.publicOpinion.policyHash,
            populationRevision: story.publicOpinion.populationRevision,
            tickSequence: story.publicOpinion.tickSequence,
            cohorts: Object.fromEntries(Object.keys(story.publicOpinion.cohorts || {}).sort().map(cohortId => {
                const cohort = story.publicOpinion.cohorts[cohortId];
                return [cohortId, {
                    regionId: cohort.regionId,
                    countryId: cohort.countryId,
                    membersPeople: cohort.membersPeople,
                    rememberedSeverityBps: cohort.rememberedSeverityBps,
                    dominantProblemType: cohort.dominantProblemType,
                    dominantBlamedActorId: cohort.dominantBlamedActorId,
                    records: cohort.records.map(record => ({
                        id: record.id,
                        state: record.state,
                        episodeCount: record.episodeCount,
                        currentPressureBps: record.currentPressureBps,
                        rememberedSeverityBps: record.rememberedSeverityBps,
                        peakSeverityBps: record.peakSeverityBps
                    }))
                }];
            }))
        } : null,
        collectiveAction: story.collectiveAction ? {
            schemaVersion: story.collectiveAction.schemaVersion,
            policyHash: story.collectiveAction.policyHash,
            tickSequence: story.collectiveAction.tickSequence,
            sourceOpinionTick: story.collectiveAction.sourceOpinionTick,
            movements: Object.fromEntries(Object.keys(story.collectiveAction.movements || {}).sort().map(movementId => {
                const movement = story.collectiveAction.movements[movementId];
                return [movementId, {
                    countryId: movement.countryId,
                    problemType: movement.problemType,
                    blamedActorId: movement.blamedActorId,
                    affectedShareBps: movement.affectedShareBps,
                    severityBps: movement.severityBps,
                    organizationBps: movement.organizationBps,
                    mobilizationBps: movement.mobilizationBps,
                    radicalizationBps: movement.radicalizationBps,
                    suppressionMemoryBps: movement.suppressionMemoryBps,
                    concessionTrustBps: movement.concessionTrustBps,
                    stage: movement.stage,
                    actionCount: movement.actionCount,
                    pendingResponse: movement.pendingResponse,
                    lastResponse: movement.lastResponse
                }];
            })),
            events: (story.collectiveAction.events || []).map(event => ({
                id: event.id,
                sequence: event.sequence,
                type: event.type,
                movementId: event.movementId,
                stage: event.stage,
                responseMode: event.responseMode || null
            }))
        } : null,
        humanMigration: story.humanMigration ? {
            schemaVersion: story.humanMigration.schemaVersion,
            policyHash: story.humanMigration.policyHash,
            tickSequence: story.humanMigration.tickSequence,
            nextFlowSequence: story.humanMigration.nextFlowSequence,
            flows: (story.humanMigration.flows || []).map(flow => ({
                id: flow.id,
                status: flow.status,
                kind: flow.kind,
                cause: flow.cause,
                originRegionId: flow.originRegionId,
                destinationRegionId: flow.destinationRegionId,
                originCountryId: flow.originCountryId,
                destinationCountryId: flow.destinationCountryId,
                people: flow.people,
                cohorts: flow.cohorts,
                departedAt: round(flow.departedAt),
                arrivalAt: round(flow.arrivalAt),
                completedAt: flow.completedAt == null ? null : round(flow.completedAt),
                attempts: flow.attempts,
                route: flow.route,
                evidence: flow.evidence,
                populationDelta: flow.populationDelta == null ? null : flow.populationDelta
            })),
            events: (story.humanMigration.events || []).map(event => ({
                id: event.id,
                type: event.type,
                at: round(event.at),
                flowId: event.flowId,
                people: event.people,
                reason: event.reason
            }))
        } : null,
        powerCenters: story.powerCenters ? {
            schemaVersion: story.powerCenters.schemaVersion,
            policyHash: story.powerCenters.policyHash,
            tickSequence: story.powerCenters.tickSequence,
            centers: Object.fromEntries(Object.keys(story.powerCenters.centers || {}).sort().map(centerId => {
                const center = story.powerCenters.centers[centerId];
                return [centerId, {
                    countryId: center.countryId,
                    type: center.type,
                    status: center.status,
                    leader: center.leader,
                    supportBase: center.supportBase,
                    resources: center.resources,
                    organizationBps: center.organizationBps,
                    influenceBps: center.influenceBps,
                    alignmentBps: center.alignmentBps,
                    independenceBps: center.independenceBps,
                    capabilities: center.capabilities,
                    goals: center.goals,
                    actionLimits: center.actionLimits
                }];
            })),
            events: (story.powerCenters.events || []).map(event => ({
                id: event.id,
                type: event.type,
                at: round(event.at),
                centerId: event.centerId,
                countryId: event.countryId,
                previousLeaderId: event.previousLeaderId || null,
                nextLeaderId: event.nextLeaderId || null,
                previousInfluenceBps: event.previousInfluenceBps == null ? null : event.previousInfluenceBps,
                nextInfluenceBps: event.nextInfluenceBps == null ? null : event.nextInfluenceBps
            }))
        } : null,
        institutions: story.institutions ? {
            schemaVersion: story.institutions.schemaVersion,
            policyHash: story.institutions.policyHash,
            tickSequence: story.institutions.tickSequence,
            sourceSignature: story.institutions.sourceSignature,
            countries: story.institutions.countries,
            requests: story.institutions.requests,
            events: story.institutions.events
        } : null,
        stateCapacity: story.stateCapacity ? {
            schemaVersion: story.stateCapacity.schemaVersion,
            policyHash: story.stateCapacity.policyHash,
            institutionPolicyHash: story.stateCapacity.institutionPolicyHash,
            tickSequence: story.stateCapacity.tickSequence,
            countries: story.stateCapacity.countries,
            regions: story.stateCapacity.regions,
            tickets: story.stateCapacity.tickets,
            events: story.stateCapacity.events
        } : null,
        elections: story.elections ? {
            schemaVersion: story.elections.schemaVersion,
            policyHash: story.elections.policyHash,
            tickSequence: story.elections.tickSequence,
            nextElectionSequence: story.elections.nextElectionSequence,
            nextMandateSequence: story.elections.nextMandateSequence,
            countries: story.elections.countries,
            elections: story.elections.elections,
            mandates: story.elections.mandates,
            events: story.elections.events
        } : null,
        diplomacy: Object.fromEntries(Object.keys(story.rel || {}).sort().map(key => {
            const relation = story.rel[key] || {};
            return [key, {
                value: round(relation.v || 0),
                treaty: relation.treaty || null,
                until: round(relation.until || 0),
                since: round(relation.since || 0),
                reason: relation.reason || null
            }];
        })),
        regionalEconomy: story.regionalEconomy ? {
            schemaVersion: story.regionalEconomy.schemaVersion,
            policyHash: story.regionalEconomy.policyHash,
            tickSequence: story.regionalEconomy.tickSequence,
            transactionSequence: story.regionalEconomy.transactionSequence,
            lastTickAt: round(story.regionalEconomy.lastTickAt),
            regions: Object.fromEntries(Object.keys(story.regionalEconomy.regions || {}).sort().map(regionId => {
                const region = story.regionalEconomy.regions[regionId];
                return [regionId, {
                    stocks: Object.fromEntries(Object.keys(region.stocks || {}).sort().map(
                        id => [id, round(region.stocks[id])]
                    )),
                    endowments: Object.fromEntries(Object.keys(region.endowments || {}).sort().map(
                        key => [key, round(region.endowments[key])]
                    )),
                    sectorCapacity: Object.fromEntries(Object.keys(region.sectorCapacity || {}).sort().map(
                        key => [key, round(region.sectorCapacity[key])]
                    ))
                }];
            })),
            totals: JSON.parse(JSON.stringify(story.regionalEconomy.totals || {})),
            shortages: (story.regionalEconomy.shortages || []).map(item => ({
                id: item.id,
                tickSequence: item.tickSequence,
                regionId: item.regionId,
                consumerType: item.consumerType,
                resourceId: item.resourceId,
                requested: round(item.requested),
                delivered: round(item.delivered),
                unmet: round(item.unmet),
                cause: item.cause
            }))
        } : null,
        tradeLogistics: story.tradeLogistics ? {
            schemaVersion: story.tradeLogistics.schemaVersion,
            policyHash: story.tradeLogistics.policyHash,
            tickSequence: story.tradeLogistics.tickSequence,
            contractSequence: story.tradeLogistics.contractSequence,
            orderSequence: story.tradeLogistics.orderSequence,
            shipmentSequence: story.tradeLogistics.shipmentSequence,
            amendmentSequence: story.tradeLogistics.amendmentSequence,
            lastTickAt: round(story.tradeLogistics.lastTickAt),
            contracts: JSON.parse(JSON.stringify(story.tradeLogistics.contracts || [])),
            orders: JSON.parse(JSON.stringify(story.tradeLogistics.orders || [])),
            shipments: JSON.parse(JSON.stringify(story.tradeLogistics.shipments || [])),
            amendments: JSON.parse(JSON.stringify(story.tradeLogistics.amendments || [])),
            capacityWindow: JSON.parse(JSON.stringify(story.tradeLogistics.capacityWindow || {})),
            totals: JSON.parse(JSON.stringify(story.tradeLogistics.totals || {}))
        } : null,
        marketPrices: story.marketPrices ? {
            schemaVersion: story.marketPrices.schemaVersion,
            policyHash: story.marketPrices.policyHash,
            tickSequence: story.marketPrices.tickSequence,
            eventSequence: story.marketPrices.eventSequence,
            lastTickAt: round(story.marketPrices.lastTickAt),
            regions: Object.fromEntries(Object.keys(story.marketPrices.regions || {}).sort().map(regionId => {
                const region = story.marketPrices.regions[regionId];
                return [regionId, {
                    ownerCountryId: region.ownerCountryId,
                    householdCpi: round(region.householdCpi),
                    producerPriceIndex: round(region.producerPriceIndex),
                    resources: Object.fromEntries(Object.keys(region.resources || {}).sort().map(resourceId => {
                        const resource = region.resources[resourceId];
                        return [resourceId, {
                            status: resource.status,
                            priceIndex: resource.priceIndex == null ? null : round(resource.priceIndex),
                            targetIndex: resource.targetIndex == null ? null : round(resource.targetIndex),
                            lastChangeBps: resource.lastChangeBps,
                            band: resource.band,
                            signals: resource.signals ? JSON.parse(JSON.stringify(resource.signals)) : null
                        }];
                    }))
                }];
            })),
            countries: JSON.parse(JSON.stringify(story.marketPrices.countries || {})),
            events: JSON.parse(JSON.stringify(story.marketPrices.events || []))
        } : null,
        companyEconomy: story.companyEconomy ? {
            schemaVersion: story.companyEconomy.schemaVersion,
            policyHash: story.companyEconomy.policyHash,
            tickSequence: story.companyEconomy.tickSequence,
            transactionSequence: story.companyEconomy.transactionSequence,
            lastTickAt: round(story.companyEconomy.lastTickAt),
            openingMoneySupply: round(story.companyEconomy.openingMoneySupply),
            externalMoneyInflow: round(story.companyEconomy.externalMoneyInflow),
            marketClearingCash: round(story.companyEconomy.marketClearingCash),
            applicationEscrow: round(story.companyEconomy.applicationEscrow),
            companies: JSON.parse(JSON.stringify(story.companyEconomy.companies || {})),
            banks: JSON.parse(JSON.stringify(story.companyEconomy.banks || {})),
            facilities: JSON.parse(JSON.stringify(story.companyEconomy.facilities || {})),
            warehouses: JSON.parse(JSON.stringify(story.companyEconomy.warehouses || {})),
            applications: JSON.parse(JSON.stringify(story.companyEconomy.applications || [])),
            projects: JSON.parse(JSON.stringify(story.companyEconomy.projects || []))
        } : null,
        economicAI: story.economicAI ? {
            schemaVersion: story.economicAI.schemaVersion,
            policyHash: story.economicAI.policyHash,
            tickSequence: story.economicAI.tickSequence,
            decisionSequence: story.economicAI.decisionSequence,
            preparationSequence: story.economicAI.preparationSequence || 0,
            lastTickAt: round(story.economicAI.lastTickAt),
            elapsedDays: round(story.economicAI.elapsedDays),
            lastActorDecisionDay: JSON.parse(JSON.stringify(story.economicAI.lastActorDecisionDay || {})),
            preparations: JSON.parse(JSON.stringify(story.economicAI.preparations || [])),
            decisions: JSON.parse(JSON.stringify(story.economicAI.decisions || [])),
            totals: JSON.parse(JSON.stringify(story.economicAI.totals || {}))
        } : null,
        states: story.states.map(state => ({
            id: state.id,
            name: state.name,
            isPlayer: !!state.isPlayer,
            welfare: round(state.welfare),
            reputation: round(state.reputation),
            inflation: round(state.inflation || 0),
            marketConfidence: round(state.marketConfidence || 0),
            techPoints: round(state.techPoints || 0),
            res: {
                oil: round(state.res && state.res.oil || 0),
                manpower: round(state.res && state.res.manpower || 0),
                points: round(state.res && state.res.points || 0)
            },
            factions: state.factions && typeof state.factions === 'object'
                ? Object.fromEntries(Object.keys(state.factions).sort().map(key => [key, round(state.factions[key])]))
                : {},
            commanders: ((state.gov && state.gov.commanders) || []).map(commander => ({
                id: commander.id,
                node: commander.node,
                loyalty: round(commander.loyalty || 0),
                army: commander.army || {}
            }))
        })),
        nodes: story.nodes.map(node => ({
            id: node.id,
            owner: node.owner,
            level: node.level || 1,
            garrison: node.garrison || 0,
            // ALTI BINA: snapshot yillarca yalniz fac/bar tasiyordu. Bu yalnizca eksik rapor degil,
            // DETERMINIZM KOR NOKTASIydi: topcu parki/hava ussu/destek ussu/hava savunma stateHash'e
            // hic girmedigi icin o alanlardaki sapmayi hicbir test goremezdi. Uzerine, olcum araci
            // bu snapshot'i okuyup "ihtisas binasi 0" diye rapor ediyordu — dunyada 42/14/57/54 sehirde
            // kuruluyken. Yanlis teshise yol acti; alanlar artik tam yaziliyor.
            fac: node.fac || 0,
            bar: node.bar || 0,
            art: node.art || 0,
            air: node.air || 0,
            sup: node.sup || 0,
            aad: node.aad || 0,
            pop: round(node.pop || 0),
            wealth: round(node.wealth || 0)
        })),
        era: story._era && story._era.id || story._era || null,
        newsCount: Array.isArray(story._news) ? story._news.length : 0,
        eraEventCount: Array.isArray(story._eraEvents) ? story._eraEvents.length : 0
    };
}

function hashSnapshot(snapshot) {
    return crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

function aggregate(story) {
    const unrestFor = state => {
        const factions = state && state.factions;
        if (!factions) return 0;
        const main = ['workers', 'business', 'military', 'intel']
            .map(key => Number(factions[key]))
            .filter(Number.isFinite);
        if (!main.length) return 0;
        const worst = Math.min(...main);
        const radicals = Number(factions.radicals) || 0;
        return Math.max(0, (50 - worst) * 0.6 + Math.max(0, radicals - 50) * 0.5);
    };
    const stateValues = story.states.map(state => ({
        welfare: Number(state.welfare) || 0,
        inflation: Number(state.inflation) || 0,
        unrest: unrestFor(state)
    }));
    const owners = new Map();
    for (const node of story.nodes) owners.set(node.owner, (owners.get(node.owner) || 0) + 1);
    const resources = story.states.reduce((total, state) => {
        total.oil += Number(state.res && state.res.oil) || 0;
        total.manpower += Number(state.res && state.res.manpower) || 0;
        total.points += Number(state.res && state.res.points) || 0;
        return total;
    }, { oil: 0, manpower: 0, points: 0 });
    const average = key => round(stateValues.reduce((sum, value) => sum + value[key], 0) / Math.max(1, stateValues.length));
    const needsCountries = story.needsWelfare && story.needsWelfare.countries
        ? Object.values(story.needsWelfare.countries)
        : [];
    const needsAverage = field => {
        let total = 0;
        let weight = 0;
        for (const country of needsCountries) {
            const population = Math.max(0, Number(country.populationPeople) || 0);
            total += (Number(country[field]) || 0) * population;
            weight += population;
        }
        return weight > 0 ? Math.round(total / weight) : null;
    };
    return {
        clock: round(story.clock),
        paused: !!story.paused,
        councilSessionActive: !!story._session,
        gameOver: !!story._gameOver,
        averageWelfare: average('welfare'),
        minWelfare: round(Math.min(...stateValues.map(value => value.welfare))),
        maxWelfare: round(Math.max(...stateValues.map(value => value.welfare))),
        averageInflation: average('inflation'),
        averageUnrest: average('unrest'),
        totalResources: {
            oil: round(resources.oil),
            manpower: round(resources.manpower),
            points: round(resources.points)
        },
        territoryByState: Object.fromEntries([...owners.entries()].sort((a, b) => a[0] - b[0])),
        activeStates: [...owners.keys()].filter(owner => owner != null).length,
        newsCount: Array.isArray(story._news) ? story._news.length : 0,
        needs: {
            foodAccessBps: needsAverage('foodAccessBps'),
            energyAccessBps: needsAverage('energyAccessBps'),
            wellbeingBps: needsAverage('wellbeingBps')
        }
    };
}

function assertFiniteWorld(story) {
    if (story.states.length !== 8) throw new Error(`8 devlet bekleniyordu, ${story.states.length} bulundu.`);
    if (story.nodes.length < 36) throw new Error(`En az 36 bölge bekleniyordu, ${story.nodes.length} bulundu.`);
    for (const state of story.states) {
        const fields = [
            ['welfare', state.welfare],
            ['reputation', state.reputation],
            ['oil', state.res && state.res.oil],
            ['manpower', state.res && state.res.manpower],
            ['points', state.res && state.res.points]
        ];
        for (const [name, value] of fields) {
            if (!Number.isFinite(Number(value))) throw new Error(`Devlet ${state.id} için ${name} sonlu değil: ${value}`);
        }
        if (state.welfare < 0 || state.welfare > 100) {
            throw new Error(`Devlet ${state.id} refah sınırı dışında: ${state.welfare}`);
        }
    }
    for (const node of story.nodes) {
        if (!Number.isInteger(node.owner) || node.owner < 0 || node.owner >= story.states.length) {
            throw new Error(`Bölge ${node.id} geçersiz sahibe sahip: ${node.owner}`);
        }
    }
}

function runStorySimulation(options = {}) {
    const seed = (options.seed == null ? 2032 : options.seed) >>> 0;
    const seconds = Math.max(1, Number(options.seconds) || 900);
    const step = Math.max(0.1, Number(options.step) || 1);
    const sampleEvery = Math.max(step, Number(options.sampleEvery) || 30);
    const runtime = createRuntime(seed);
    const samples = [];
    let nextSample = 0;
    const startedAt = process.hrtime.bigint();

    try {
        runtime.api.newCampaign({
            seed,
            playerStateId: options.playerStateId == null ? 0 : options.playerStateId,
            abundance: options.abundance == null ? 1 : options.abundance,
            doctrine: options.doctrine || 'combined',
            fog: options.fog !== false,
            featureFlags: options.featureFlags
        });
        const story = runtime.api.state();
        assertFiniteWorld(story);
        samples.push(aggregate(story));
        nextSample += sampleEvery;

        for (let elapsed = 0; elapsed < seconds; elapsed += step) {
            runtime.api.advance(Math.min(step, seconds - elapsed));
            assertFiniteWorld(story);
            if (story.clock + 1e-9 >= nextSample) {
                samples.push(aggregate(story));
                nextSample += sampleEvery;
            }
        }

        const snapshot = stateSnapshot(story);
        const telemetry = runtime.api.telemetry();
        const causality = runtime.api.causalitySnapshot();
        const causalityValidation = runtime.api.causalityValidate(causality);
        const causalityWorldConsistency = runtime.api.causalityValidateWorld(causality);
        const regionalValidation = runtime.api.validateRegionalLedger(
            runtime.api.regionalLedger(),
            { checkNodeMirrors: true }
        );
        const regionalLedgerForDiagnostics = runtime.api.regionalLedger();
        const regionalOperationalSummary = {
            productionHoldsByCode: {},
            productionHoldsBySector: {},
            productionBottlenecks: {},
            productionRequested: {},
            productionUnmet: {},
            demandRequested: {},
            demandDelivered: {},
            demandUnmet: {},
            producedLastTick: {},
            productionConsumedLastTick: {},
            producingRegionsByResource: {},
            countryBreakdown: {}
        };
        const countryOperationalRow = regionId => {
            const populationRegion = story.population && story.population.regions
                ? story.population.regions[regionId]
                : null;
            const countryId = String(populationRegion && populationRegion.countryId || 'country:unknown');
            if (!regionalOperationalSummary.countryBreakdown[countryId]) {
                regionalOperationalSummary.countryBreakdown[countryId] = {
                    countryId,
                    regionCount: 0,
                    populationPeople: 0,
                    stocks: {},
                    producedLastTick: {},
                    productionRequested: {},
                    productionConsumed: {},
                    productionUnmet: {},
                    productionInputOperatingReserve: {},
                    productionInputDomesticAvailable: {},
                    demandRequested: {},
                    demandDelivered: {},
                    demandUnmet: {},
                    commerceInventory: {},
                    productionInputOrdersByResourceStatus: {},
                    productionInputOrderFailures: {},
                    productionInputInboundByResourceStatus: {},
                    productionInputOutboundByResourceStatus: {},
                    blockingBottlenecks: {},
                    agricultureEnergyBlockingRegions: 0,
                    agricultureEnergyBlockers: []
                };
            }
            return {
                row: regionalOperationalSummary.countryBreakdown[countryId],
                populationRegion
            };
        };
        const addCountryResource = (row, field, resourceId, quantity) => {
            row[field][resourceId] = round(
                (row[field][resourceId] || 0) + Number(quantity || 0)
            );
        };
        for (const region of Object.values((regionalLedgerForDiagnostics && regionalLedgerForDiagnostics.regions) || {})) {
            const lastTick = region.lastTick || {};
            const countryContext = countryOperationalRow(region.regionId);
            const countryRow = countryContext.row;
            countryRow.regionCount++;
            countryRow.populationPeople += Math.max(
                0,
                Number(countryContext.populationRegion && countryContext.populationRegion.populationPeople) || 0
            );
            for (const [resourceId, quantity] of Object.entries(region.stocks || {})) {
                addCountryResource(countryRow, 'stocks', resourceId, quantity);
            }
            for (const resourceId of [
                'industrial_parts', 'energy', 'raw_materials', 'electronics'
            ]) {
                const stock = Math.max(0, Number(region.stocks && region.stocks[resourceId]) || 0);
                const requested = Math.max(0, Number(
                    lastTick.productionRequestedByResource
                        && lastTick.productionRequestedByResource[resourceId]
                ) || 0);
                const consumed = Math.max(0, Number(
                    lastTick.productionConsumedByResource
                        && lastTick.productionConsumedByResource[resourceId]
                ) || 0);
                const unmet = Math.max(0, Number(
                    lastTick.productionUnmetByResource
                        && lastTick.productionUnmetByResource[resourceId]
                ) || 0);
                const blockingInputShortage = (lastTick.productionBottlenecks || []).some(
                    bottleneck => bottleneck.key === resourceId
                        && ['INPUT_SHORTAGE', 'STOCK_UNAVAILABLE'].includes(bottleneck.code)
                        && bottleneck.severity === 'BLOCKING'
                );
                const localProductionNeed = Math.min(
                    requested,
                    consumed + (blockingInputShortage ? Math.min(unmet, stock) : 0)
                );
                const localConsumerNeed = Math.max(0, Number(
                    lastTick.demandRequestedByResource
                        && lastTick.demandRequestedByResource[resourceId]
                ) || 0);
                const operatingReserve = localProductionNeed + localConsumerNeed;
                addCountryResource(
                    countryRow,
                    'productionInputOperatingReserve',
                    resourceId,
                    operatingReserve
                );
                addCountryResource(
                    countryRow,
                    'productionInputDomesticAvailable',
                    resourceId,
                    Math.max(0, stock - operatingReserve)
                );
            }
            for (const hold of (lastTick.productionHolds || [])) {
                const code = String(hold.code || 'UNKNOWN');
                const sectorId = String(hold.sectorId || 'unknown');
                regionalOperationalSummary.productionHoldsByCode[code] =
                    (regionalOperationalSummary.productionHoldsByCode[code] || 0) + 1;
                regionalOperationalSummary.productionHoldsBySector[sectorId] =
                    (regionalOperationalSummary.productionHoldsBySector[sectorId] || 0) + 1;
            }
            for (const bottleneck of (lastTick.productionBottlenecks || [])) {
                const key = [
                    bottleneck.sectorId || 'unknown',
                    bottleneck.code || 'UNKNOWN',
                    bottleneck.key || 'unknown',
                    bottleneck.severity || 'unknown'
                ].join('|');
                regionalOperationalSummary.productionBottlenecks[key] =
                    (regionalOperationalSummary.productionBottlenecks[key] || 0) + 1;
                if (bottleneck.severity === 'BLOCKING') {
                    countryRow.blockingBottlenecks[key] =
                        (countryRow.blockingBottlenecks[key] || 0) + 1;
                }
                if (bottleneck.sectorId === 'agriculture'
                    && bottleneck.key === 'energy'
                    && bottleneck.severity === 'BLOCKING') {
                    countryRow.agricultureEnergyBlockingRegions++;
                }
            }
            if ((lastTick.productionBottlenecks || []).some(bottleneck => (
                bottleneck.sectorId === 'agriculture'
                    && bottleneck.key === 'energy'
                    && bottleneck.severity === 'BLOCKING'
            ))) {
                countryRow.agricultureEnergyBlockers.push({
                    regionId: region.regionId,
                    energyStock: round(Math.max(0, Number(region.stocks && region.stocks.energy) || 0)),
                    energyProductionRequested: round(Math.max(0, Number(
                        lastTick.productionRequestedByResource
                            && lastTick.productionRequestedByResource.energy
                    ) || 0)),
                    energyProductionConsumed: round(Math.max(0, Number(
                        lastTick.productionConsumedByResource
                            && lastTick.productionConsumedByResource.energy
                    ) || 0)),
                    energyProductionUnmet: round(Math.max(0, Number(
                        lastTick.productionUnmetByResource
                            && lastTick.productionUnmetByResource.energy
                    ) || 0)),
                    energyDemandRequested: round(Math.max(0, Number(
                        lastTick.demandRequestedByResource
                            && lastTick.demandRequestedByResource.energy
                    ) || 0))
                });
            }
            for (const [resourceId, quantity] of Object.entries(lastTick.productionRequestedByResource || {})) {
                regionalOperationalSummary.productionRequested[resourceId] = round(
                    (regionalOperationalSummary.productionRequested[resourceId] || 0) + Number(quantity || 0)
                );
                addCountryResource(countryRow, 'productionRequested', resourceId, quantity);
            }
            for (const [resourceId, quantity] of Object.entries(lastTick.productionUnmetByResource || {})) {
                regionalOperationalSummary.productionUnmet[resourceId] = round(
                    (regionalOperationalSummary.productionUnmet[resourceId] || 0) + Number(quantity || 0)
                );
                addCountryResource(countryRow, 'productionUnmet', resourceId, quantity);
            }
            for (const [resourceId, quantity] of Object.entries(lastTick.demandRequestedByResource || {})) {
                regionalOperationalSummary.demandRequested[resourceId] = round(
                    (regionalOperationalSummary.demandRequested[resourceId] || 0) + Number(quantity || 0)
                );
                addCountryResource(countryRow, 'demandRequested', resourceId, quantity);
            }
            for (const [resourceId, quantity] of Object.entries(lastTick.demandDeliveredByResource || {})) {
                regionalOperationalSummary.demandDelivered[resourceId] = round(
                    (regionalOperationalSummary.demandDelivered[resourceId] || 0) + Number(quantity || 0)
                );
                addCountryResource(countryRow, 'demandDelivered', resourceId, quantity);
            }
            for (const [resourceId, quantity] of Object.entries(lastTick.demandUnmetByResource || {})) {
                regionalOperationalSummary.demandUnmet[resourceId] = round(
                    (regionalOperationalSummary.demandUnmet[resourceId] || 0) + Number(quantity || 0)
                );
                addCountryResource(countryRow, 'demandUnmet', resourceId, quantity);
            }
            for (const [resourceId, quantity] of Object.entries(lastTick.producedByResource || {})) {
                regionalOperationalSummary.producedLastTick[resourceId] = round(
                    (regionalOperationalSummary.producedLastTick[resourceId] || 0) + Number(quantity || 0)
                );
                addCountryResource(countryRow, 'producedLastTick', resourceId, quantity);
            }
            for (const [resourceId, quantity] of Object.entries(lastTick.productionConsumedByResource || {})) {
                regionalOperationalSummary.productionConsumedLastTick[resourceId] = round(
                    (regionalOperationalSummary.productionConsumedLastTick[resourceId] || 0)
                        + Number(quantity || 0)
                );
                addCountryResource(countryRow, 'productionConsumed', resourceId, quantity);
            }
            for (const [resourceId, quantity] of Object.entries(lastTick.producedByResource || {})) {
                if (Number(quantity) <= 1e-9) continue;
                regionalOperationalSummary.producingRegionsByResource[resourceId] =
                    (regionalOperationalSummary.producingRegionsByResource[resourceId] || 0) + 1;
            }
        }
        const regionalSummary = runtime.api.regionalSummary();
        const populationLedger = runtime.api.populationLedger();
        const populationValidation = populationLedger
            ? runtime.api.validatePopulationLedger(populationLedger)
            : { ok: true, disabled: true, issues: [] };
        const populationSummary = runtime.api.populationSummary();
        const needsLedger = runtime.api.needsLedger();
        const needsValidation = needsLedger
            ? runtime.api.validateNeedsLedger(needsLedger)
            : { ok: true, disabled: true, issues: [] };
        const needsSummary = runtime.api.needsSummary();
        const opinionLedger = runtime.api.opinionLedger();
        const opinionValidation = opinionLedger
            ? runtime.api.validateOpinionLedger(opinionLedger)
            : { ok: true, disabled: true, issues: [] };
        const opinionSummary = runtime.api.opinionSummary({
            includeStorageMetrics: options.includeOpinionStorageMetrics === true
        });
        const collectiveLedger = runtime.api.collectiveLedger();
        const collectiveValidation = collectiveLedger
            ? runtime.api.validateCollectiveLedger(collectiveLedger)
            : { ok: true, disabled: true, issues: [] };
        const collectiveSummary = runtime.api.collectiveSummary();
        const humanMigrationLedger = runtime.api.humanMigrationLedger();
        const humanMigrationValidation = humanMigrationLedger
            ? runtime.api.validateHumanMigrationLedger(humanMigrationLedger)
            : { ok: true, disabled: true, issues: [] };
        const humanMigrationSummary = runtime.api.humanMigrationSummary();
        const powerCenterLedger = runtime.api.powerCenterLedger();
        const powerCenterValidation = powerCenterLedger
            ? runtime.api.validatePowerCenterLedger(powerCenterLedger)
            : { ok: true, disabled: true, issues: [] };
        const powerCenterSummary = runtime.api.powerCenterSummary();
        const institutionLedger = runtime.api.institutionLedger();
        const institutionValidation = institutionLedger
            ? runtime.api.validateInstitutionLedger(institutionLedger)
            : { ok: true, disabled: true, issues: [] };
        const institutionSummary = runtime.api.institutionSummary();
        const stateCapacityLedger = runtime.api.stateCapacityLedger();
        const stateCapacityValidation = stateCapacityLedger
            ? runtime.api.validateStateCapacityLedger(stateCapacityLedger)
            : { ok: true, disabled: true, issues: [] };
        const stateCapacitySummary = runtime.api.stateCapacitySummary();
        const electionLedger = runtime.api.electionLedger();
        const electionValidation = electionLedger
            ? runtime.api.validateElectionLedger(electionLedger)
            : { ok: true, disabled: true, issues: [] };
        const electionSummary = runtime.api.electionSummary();
        const integrityLedger = runtime.api.integrityLedger();
        const integrityValidation = integrityLedger
            ? runtime.api.validateIntegrityLedger(integrityLedger)
            : { ok: true, disabled: true, issues: [] };
        const integritySummary = runtime.api.integritySummary();
        const politicalCrisisLedger = runtime.api.politicalCrisisLedger();
        const politicalCrisisValidation = politicalCrisisLedger
            ? runtime.api.validatePoliticalCrisisLedger(politicalCrisisLedger)
            : { ok: true, disabled: true, issues: [] };
        const politicalCrisisSummary = runtime.api.politicalCrisisSummary();
        const characterMemoryLedger = runtime.api.characterMemoryLedger();
        const characterMemoryValidation = characterMemoryLedger
            ? runtime.api.validateCharacterMemoryLedger(characterMemoryLedger)
            : { ok: true, disabled: true, issues: [] };
        const characterMemorySummary = runtime.api.characterMemorySummary();
        const characterActionLedger = runtime.api.characterActionLedger();
        const characterActionValidation = characterActionLedger
            ? runtime.api.validateCharacterActionLedger(characterActionLedger)
            : { ok: true, disabled: true, issues: [] };
        const characterActionSummary = runtime.api.characterActionSummary();
        const tradeValidation = runtime.api.validateTradeLedger(runtime.api.tradeLedger());
        const tradeSummary = runtime.api.tradeSummary();
        // The full counterfactual/Pareto observer is an explicit report, not a
        // mandatory cost of every small harness probe. Production remains
        // directly callable through runtime.api; callers opt in when they need
        // the decision audit.
        const includeTradeDecisionObserver = options.includeTradeProductionOpportunityView === true;
        const tradeDecisionObserverBeforeHash = includeTradeDecisionObserver
            ? hashSnapshot(stateSnapshot(story))
            : null;
        const fullTradeProductionOpportunityView = includeTradeDecisionObserver
            ? runtime.api.tradeProductionOpportunityView({ includeAll: true })
            : null;
        const tradeProductionAdmissionPlan = includeTradeDecisionObserver
            ? runtime.api.tradeProductionAdmissionPlan({
                opportunityView: fullTradeProductionOpportunityView
            })
            : {
                disabled: true,
                skipped: true,
                reason: 'NOT_REQUESTED',
                selected: [],
                actions: [],
                summary: {}
            };
        const tradeDecisionObserverAfterHash = includeTradeDecisionObserver
            ? hashSnapshot(stateSnapshot(story))
            : null;
        const tradeDecisionObserverNeutral = includeTradeDecisionObserver
            ? tradeDecisionObserverBeforeHash === tradeDecisionObserverAfterHash
            : null;
        const tradeProductionOpportunityView = includeTradeDecisionObserver
            ? Object.assign({}, fullTradeProductionOpportunityView, {
                opportunities: (fullTradeProductionOpportunityView.opportunities || []).slice(0, 120)
            })
            : {
                disabled: true,
                skipped: true,
                reason: 'NOT_REQUESTED',
                opportunities: [],
                summary: {}
            };
        const tradeLedgerForDiagnostics = runtime.api.tradeLedger();
        const tradeOperationalSummary = {
            ordersBySourceStatus: {},
            orderFailures: {},
            shipmentsBySourceStatus: {},
            activeCargoBySourceResource: {},
            activeLatencyBySource: {},
            crossBorderOrders: 0,
            companyBuyerOrders: 0,
            crossBorderDeliveredShipments: 0
        };
        const diagnosticOrders = new Map();
        for (const order of (tradeLedgerForDiagnostics && tradeLedgerForDiagnostics.orders) || []) {
            diagnosticOrders.set(order.id, order);
            const source = String(order.source || 'UNKNOWN');
            const status = String(order.status || 'UNKNOWN');
            const key = `${source}|${status}`;
            tradeOperationalSummary.ordersBySourceStatus[key] =
                (tradeOperationalSummary.ordersBySourceStatus[key] || 0) + 1;
            if (order.sellerCountryId !== order.buyerCountryId) {
                tradeOperationalSummary.crossBorderOrders++;
                if (order.buyerCompanyId) tradeOperationalSummary.companyBuyerOrders++;
            }
            if (order.lastFailure) {
                const failureKey = `${source}|${order.resourceId}|${order.lastFailure}`;
                tradeOperationalSummary.orderFailures[failureKey] =
                    (tradeOperationalSummary.orderFailures[failureKey] || 0) + 1;
            }
            if (source.startsWith('AUTO_PRODUCTION_INPUT')) {
                const countryRow = regionalOperationalSummary.countryBreakdown[order.buyerCountryId];
                if (countryRow) {
                    const orderKey = `${order.resourceId}|${status}`;
                    countryRow.productionInputOrdersByResourceStatus[orderKey] =
                        (countryRow.productionInputOrdersByResourceStatus[orderKey] || 0) + 1;
                    if (order.lastFailure) {
                        const failureKey = `${order.resourceId}|${order.lastFailure}`;
                        countryRow.productionInputOrderFailures[failureKey] =
                            (countryRow.productionInputOrderFailures[failureKey] || 0) + 1;
                    }
                }
            }
        }
        for (const shipment of (tradeLedgerForDiagnostics && tradeLedgerForDiagnostics.shipments) || []) {
            const order = diagnosticOrders.get(shipment.orderId);
            const source = String(order && order.source || 'UNKNOWN');
            const status = String(shipment.status || 'UNKNOWN');
            const key = `${source}|${status}`;
            tradeOperationalSummary.shipmentsBySourceStatus[key] =
                (tradeOperationalSummary.shipmentsBySourceStatus[key] || 0) + 1;
            if (status === 'DELIVERED'
                && shipment.sellerCountryId !== shipment.buyerCountryId) {
                tradeOperationalSummary.crossBorderDeliveredShipments++;
            }
            if (source.startsWith('AUTO_PRODUCTION_INPUT')) {
                const inboundCountry = regionalOperationalSummary.countryBreakdown[shipment.buyerCountryId];
                const outboundCountry = regionalOperationalSummary.countryBreakdown[shipment.sellerCountryId];
                const resourceStatusKey = `${shipment.resourceId}|${status}`;
                if (inboundCountry) {
                    inboundCountry.productionInputInboundByResourceStatus[resourceStatusKey] = round(
                        (inboundCountry.productionInputInboundByResourceStatus[resourceStatusKey] || 0)
                            + Number(shipment.quantity || 0)
                    );
                }
                if (outboundCountry) {
                    outboundCountry.productionInputOutboundByResourceStatus[resourceStatusKey] = round(
                        (outboundCountry.productionInputOutboundByResourceStatus[resourceStatusKey] || 0)
                            + Number(shipment.quantity || 0)
                    );
                }
            }
            if (['IN_TRANSIT', 'HELD'].includes(status)) {
                const cargoKey = `${source}|${shipment.resourceId}`;
                tradeOperationalSummary.activeCargoBySourceResource[cargoKey] = round(
                    (tradeOperationalSummary.activeCargoBySourceResource[cargoKey] || 0)
                        + Number(shipment.quantity || 0)
                );
                const latency = tradeOperationalSummary.activeLatencyBySource[source]
                    || (tradeOperationalSummary.activeLatencyBySource[source] = {
                        shipments: 0,
                        totalSeconds: 0,
                        maxSeconds: 0
                    });
                const seconds = Math.max(0, Number(shipment.routeLatencySeconds) || 0);
                latency.shipments++;
                latency.totalSeconds = round(latency.totalSeconds + seconds);
                latency.maxSeconds = round(Math.max(latency.maxSeconds, seconds));
            }
        }
        for (const latency of Object.values(tradeOperationalSummary.activeLatencyBySource)) {
            latency.averageSeconds = round(latency.totalSeconds / Math.max(1, latency.shipments));
        }
        const marketValidation = runtime.api.validateMarketLedger(runtime.api.marketLedger());
        const marketSummary = runtime.api.marketSummary();
        const budgetValidation = runtime.api.validateBudgetLedger(
            runtime.api.budgetLedger(),
            { checkWalletMirrors: true }
        );
        const budgetSummary = runtime.api.budgetSummary();
        const companyLedger = runtime.api.companyLedger();
        const companyValidation = companyLedger
            ? runtime.api.validateCompanyLedger(companyLedger)
            : { ok: true, disabled: true, issues: [] };
        const companySummary = runtime.api.companySummary();
        const commerceLedger = runtime.api.commerceLedger();
        for (const lot of (commerceLedger && commerceLedger.inventories) || []) {
            if (!/^region:\d+$/.test(String(lot.regionId || ''))) continue;
            const countryContext = countryOperationalRow(lot.regionId);
            addCountryResource(
                countryContext.row,
                'commerceInventory',
                lot.resourceId,
                Math.max(0, Number(lot.quantity) || 0)
            );
        }
        const commerceValidation = commerceLedger
            ? runtime.api.validateCommerceLedger(commerceLedger, { checkPhysicalMirrors: true })
            : { ok: true, disabled: true, issues: [] };
        const commerceSummary = runtime.api.commerceSummary();
        const economicAILedger = runtime.api.economicAILedger();
        const economicAIValidation = economicAILedger
            ? runtime.api.validateEconomicAILedger(economicAILedger)
            : { ok: true, disabled: true, issues: [] };
        const economicAISummary = runtime.api.economicAISummary();
        const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        const result = {
            schemaVersion: 1,
            harnessVersion: 'story-headless-v1',
            seed,
            requestedSeconds: seconds,
            simulatedSeconds: round(story.clock),
            stepSeconds: step,
            stateHash: hashSnapshot(snapshot),
            wallTimeMs: round(elapsedMs, 2),
            samples,
            final: aggregate(story),
            telemetry,
            causality,
            causalityValidation,
            causalityWorldConsistency,
            regionalValidation,
            regionalOperationalSummary,
            regionalSummary,
            populationValidation,
            populationSummary,
            needsValidation,
            needsSummary,
            opinionValidation,
            opinionSummary,
            collectiveValidation,
            collectiveSummary,
            humanMigrationValidation,
            humanMigrationSummary,
            powerCenterValidation,
            powerCenterSummary,
            institutionValidation,
            institutionSummary,
            stateCapacityValidation,
            stateCapacitySummary,
            electionValidation,
            electionSummary,
            integrityValidation,
            integritySummary,
            politicalCrisisValidation,
            politicalCrisisSummary,
            characterMemoryValidation,
            characterMemorySummary,
            characterActionValidation,
            characterActionSummary,
            tradeValidation,
            tradeSummary,
            tradeProductionOpportunityView,
            tradeProductionAdmissionPlan,
            tradeDecisionObserverNeutral,
            tradeOperationalSummary,
            marketValidation,
            marketSummary,
            budgetValidation,
            budgetSummary,
            companyValidation,
            companySummary,
            commerceValidation,
            commerceSummary,
            economicAIValidation,
            economicAISummary,
            snapshot
        };
        if (options.includeDebugLedgers) {
            result.debugLedgers = {
                regional: regionalLedgerForDiagnostics,
                commerce: commerceLedger,
                company: companyLedger,
                trade: tradeLedgerForDiagnostics,
                infrastructure: runtime.api.infrastructureGraph()
            };
        }
        return result;
    } finally {
        runtime.dom.window.close();
    }
}

function probeWelfareGate(seed = 2032, featureFlags) {
    const runtime = createRuntime(seed >>> 0);
    try {
        runtime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags
        });
        const story = runtime.api.state();
        const before = story.states[0].welfare;
        runtime.api.welfareDelta(0, 'test.continuous-a', -1, { continuous: true, correlationId: 'test-pressure' });
        runtime.api.welfareDelta(0, 'test.continuous-b', -1, { continuous: true, correlationId: 'test-pressure' });
        const telemetry = runtime.api.telemetry();
        return {
            before,
            after: story.states[0].welfare,
            applied: story.states[0].welfare - before,
            featureFlags: telemetry.meta.featureFlags,
            welfareTotals: telemetry.welfareTotals
        };
    } finally {
        runtime.dom.window.close();
    }
}

function probeBattleTelemetry(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    try {
        runtime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true
        });
        runtime.api.completeBattle('draw', {
            engineVersion: 'battlefield-v2-fixed50',
            seed: 424242,
            durationSeconds: 123.5,
            timeRemaining: 116.5,
            blueKills: 4,
            redKills: 3,
            blueSurvivors: 8,
            redSurvivors: 7,
            outcomeReason: 'time_expired'
        });
        const telemetry = runtime.api.telemetry();
        return {
            counter: telemetry.counters['battle.completed'] || 0,
            event: telemetry.events.find(event => event.type === 'battle.completed') || null
        };
    } finally {
        runtime.dom.window.close();
    }
}

function probeWorldV2(seed = 2032, seconds = 10) {
    const runtime = createRuntime(seed >>> 0);
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        for (let elapsed = 0; elapsed < seconds; elapsed++) runtime.api.advance(1);
        const story = runtime.api.state();
        const beforeUiSnapshot = stateSnapshot(story);
        const beforeHash = hashSnapshot(beforeUiSnapshot);
        const world = runtime.api.worldV2();
        const validation = runtime.api.validateWorldV2(world);
        const originalName = world.countries[0].name;
        world.countries[0].name = '__projection_mutation__';
        const freshWorld = runtime.api.worldV2();
        const afterHash = hashSnapshot(stateSnapshot(story));
        const missingField = structuredClone(freshWorld);
        delete missingField.countries;
        const unknownField = structuredClone(freshWorld);
        unknownField.debugOnly = true;
        const duplicateId = structuredClone(freshWorld);
        duplicateId.countries.push(structuredClone(duplicateId.countries[0]));
        const brokenReference = structuredClone(freshWorld);
        brokenReference.regions[0].ownerId = 'country:missing';
        const invalidClock = structuredClone(freshWorld);
        invalidClock.clock.gameTime = 'not-a-number';
        const emptyWorld = runtime.api.emptyWorldV2({ seed, campaignId: 'story:test-empty' });
        const knowledgeWorld = structuredClone(freshWorld);
        const foreignCountry = knowledgeWorld.countries.find(country => country.id !== 'country:0');
        foreignCountry.resources = { oil: 987654321, manpower: 987654321, points: 987654321 };
        foreignCountry.welfare = 98.7654321;
        const knowledge = runtime.api.playerKnowledge(knowledgeWorld, 'country:0');
        let invalidUnknownRejected = false;
        try {
            runtime.api.samplePlayerFact({
                id: 'fact:test:invalid',
                subjectId: 'country:1',
                field: 'secret',
                value: 987654321,
                status: 'UNKNOWN',
                confidenceBps: 5000,
                source: { type: 'TEST' },
                observedAt: 0
            });
        } catch (_) {
            invalidUnknownRejected = true;
        }
        const estimatedFact = runtime.api.samplePlayerFact({
            id: 'fact:test:estimated',
            subjectId: 'country:1',
            field: 'welfare',
            value: { min: 40, max: 60 },
            status: 'ESTIMATED',
            confidenceBps: 6000,
            source: { type: 'INTELLIGENCE_REPORT', id: 'report:test' },
            observedAt: 10
        });
        const rumorFact = runtime.api.samplePlayerFact({
            id: 'fact:test:rumor',
            subjectId: 'character:1:1',
            field: 'intent',
            value: 'COUP_RISK',
            status: 'RUMOR',
            confidenceBps: 2500,
            source: { type: 'RUMOR', id: 'rumor:test' },
            observedAt: 10
        });
        return {
            beforeHash,
            afterHash,
            validation,
            isolated: freshWorld.countries[0].name === originalName,
            invalidCases: {
                missingField: runtime.api.validateWorldV2(missingField),
                unknownField: runtime.api.validateWorldV2(unknownField),
                duplicateId: runtime.api.validateWorldV2(duplicateId),
                brokenReference: runtime.api.validateWorldV2(brokenReference),
                invalidClock: runtime.api.validateWorldV2(invalidClock)
            },
            emptyWorldValidation: runtime.api.validateWorldV2(emptyWorld),
            knowledge: {
                validation: runtime.api.validatePlayerKnowledge(knowledge),
                secretLeaked: JSON.stringify(knowledge).includes('987654321')
                    || JSON.stringify(knowledge).includes('98.7654321'),
                ownResources: knowledge.countries.find(country => country.id === 'country:0').resources,
                foreignResources: knowledge.countries.find(country => country.id === foreignCountry.id).resources,
                invalidUnknownRejected,
                estimatedFact,
                rumorFact
            },
            world: freshWorld
        };
    } finally {
        runtime.dom.window.close();
    }
}

function createObservedStorage(initial) {
    const values = new Map(Object.entries(initial || {}).map(([key, value]) => [key, String(value)]));
    const writes = [];
    return {
        writes,
        getItem(key) {
            return values.has(String(key)) ? values.get(String(key)) : null;
        },
        setItem(key, value) {
            const normalizedKey = String(key);
            const normalizedValue = String(value);
            writes.push({ key: normalizedKey, value: normalizedValue });
            values.set(normalizedKey, normalizedValue);
        },
        value(key) {
            return values.has(String(key)) ? values.get(String(key)) : null;
        }
    };
}

function probeMigration(seed = 2032, seconds = 10) {
    const runtime = createRuntime(seed >>> 0);
    const keys = {
        source: 'pixelrts_story_v3',
        backup: 'pixelrts_story_v3_backup_phase5',
        target: 'pixelrts_story_world_v2',
        report: 'pixelrts_story_v3_migration_report'
    };
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        for (let elapsed = 0; elapsed < seconds; elapsed++) runtime.api.advance(1);
        runtime.api.saveNow();

        const story = runtime.api.state();
        const beforeHash = hashSnapshot(stateSnapshot(story));
        const sourceRaw = runtime.api.savedRaw();
        const source = JSON.parse(sourceRaw);
        const prepared = runtime.api.migrateRaw(sourceRaw);

        const successStorage = createObservedStorage({ [keys.source]: sourceRaw });
        const success = runtime.api.migrateStorage(successStorage, keys);
        const targetRaw = successStorage.value(keys.target);
        const target = targetRaw ? JSON.parse(targetRaw) : null;
        const targetValidation = target ? runtime.api.validateWorldV2(target) : { ok: false, issues: [] };
        const reportRaw = successStorage.value(keys.report);
        const storedReport = reportRaw ? JSON.parse(reportRaw) : null;

        const countryResourcesMatch = !!target && source.states.every(state => {
            const country = target.countries.find(candidate => candidate.legacyId === Number(state.id));
            const resources = state.res && typeof state.res === 'object' ? state.res : {};
            return !!country
                && country.resources.oil === (Number.isFinite(Number(resources.oil)) ? Number(resources.oil) : 0)
                && country.resources.manpower === (Number.isFinite(Number(resources.manpower)) ? Number(resources.manpower) : 0)
                && country.resources.points === (Number.isFinite(Number(resources.points)) ? Number(resources.points) : 0);
        });
        const regionOwnersMatch = !!target && source.nodes.every(node => {
            const region = target.regions.find(candidate => candidate.legacyId === Number(node.id));
            return !!region && region.ownerId === `country:${node.owner}`;
        });
        const expectedPlayerCommanderId = source.commander && source.commander.id != null
            ? `character:${source.playerStateId}:${source.commander.id}`
            : null;
        const expectedPlayerRole = source.commander && source.commander.creationRole
            ? String(source.commander.creationRole) : 'COMMANDER';
        const playerCommanderMatch = !expectedPlayerCommanderId || (
            target
            && target.characters.some(character => (
                character.id === expectedPlayerCommanderId
                && character.role === expectedPlayerRole
            ))
        );

        const malformedRaw = '{"v":2';
        const malformedStorage = createObservedStorage({ [keys.source]: malformedRaw });
        const malformed = runtime.api.migrateStorage(malformedStorage, keys);

        const invalidRaw = JSON.stringify({ v: 2, states: [], nodes: [], playerStateId: 0 });
        const invalidStorage = createObservedStorage({ [keys.source]: invalidRaw });
        const invalid = runtime.api.migrateStorage(invalidStorage, keys);

        const backupConflictStorage = createObservedStorage({
            [keys.source]: sourceRaw,
            [keys.backup]: '__different_backup__'
        });
        const backupConflict = runtime.api.migrateStorage(backupConflictStorage, keys);

        const targetConflictStorage = createObservedStorage({
            [keys.source]: sourceRaw,
            [keys.target]: '{"meta":{"schemaVersion":999}}'
        });
        const targetConflict = runtime.api.migrateStorage(targetConflictStorage, keys);

        const afterHash = hashSnapshot(stateSnapshot(story));
        return {
            beforeHash,
            afterHash,
            sourceRaw,
            prepared: {
                ok: prepared.ok,
                sourceChecksum: prepared.sourceChecksum,
                targetChecksum: prepared.targetChecksum,
                report: JSON.parse(JSON.stringify(prepared.report || null))
            },
            success: {
                ok: success.ok,
                stage: success.stage,
                writes: successStorage.writes.map(write => write.key),
                sourceUnchanged: successStorage.value(keys.source) === sourceRaw,
                backupExact: successStorage.value(keys.backup) === sourceRaw,
                targetValidation,
                storedReport,
                counts: target ? {
                    countries: target.countries.length,
                    regions: target.regions.length,
                    characters: target.characters.length,
                    militaryForces: target.militaryForces.length,
                    events: target.events.length
                } : null,
                clock: target ? target.clock : null,
                rng: target && target.diagnostics ? target.diagnostics.rng : null,
                scheduler: target && target.diagnostics ? target.diagnostics.scheduler : null,
                sourceCounts: {
                    countries: source.states.length,
                    regions: source.nodes.length
                },
                countryResourcesMatch,
                regionOwnersMatch,
                playerCommanderMatch
            },
            malformed: {
                ok: malformed.ok,
                stage: malformed.stage,
                writes: malformedStorage.writes.length,
                sourceUnchanged: malformedStorage.value(keys.source) === malformedRaw
            },
            invalid: {
                ok: invalid.ok,
                stage: invalid.stage,
                writes: invalidStorage.writes.length,
                sourceUnchanged: invalidStorage.value(keys.source) === invalidRaw
            },
            backupConflict: {
                ok: backupConflict.ok,
                stage: backupConflict.stage,
                writes: backupConflictStorage.writes.length,
                sourceUnchanged: backupConflictStorage.value(keys.source) === sourceRaw
            },
            targetConflict: {
                ok: targetConflict.ok,
                stage: targetConflict.stage,
                writes: targetConflictStorage.writes.length,
                sourceUnchanged: targetConflictStorage.value(keys.source) === sourceRaw
            }
        };
    } finally {
        runtime.dom.window.close();
    }
}

function storyFramePattern(durationSeconds, fps) {
    const duration = Math.max(0, Number(durationSeconds) || 0);
    const frame = 1 / Math.max(1, Number(fps) || 1);
    const result = [];
    let remaining = duration;
    while (remaining > 1e-12) {
        const step = Math.min(frame, remaining);
        result.push(step);
        remaining = Math.max(0, remaining - step);
    }
    return result;
}

function storyJitterPattern(durationSeconds) {
    const source = [0.011, 0.023, 0.008, 0.041, 0.017, 0.029, 0.013, 0.019];
    const result = [];
    let remaining = Math.max(0, Number(durationSeconds) || 0);
    let index = 0;
    while (remaining > 1e-12) {
        const step = Math.min(source[index++ % source.length], remaining);
        result.push(step);
        remaining = Math.max(0, remaining - step);
    }
    return result;
}

function runClockPattern(seed, realDuration, speed, pattern, featureFlags) {
    const runtime = createRuntime(seed >>> 0);
    try {
        runtime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags
        });
        runtime.api.setSpeed(speed);
        for (const dt of pattern) runtime.api.advance(dt);
        const story = runtime.api.state();
        const snapshot = stateSnapshot(story);
        const worldOnly = Object.assign({}, snapshot);
        delete worldOnly.scheduler;
        return {
            hash: hashSnapshot(snapshot),
            worldHash: hashSnapshot(worldOnly),
            gameTime: round(story.clock, 9),
            clock: runtime.api.clockSnapshot()
        };
    } finally {
        runtime.dom.window.close();
    }
}

function probeDeterministicClock(seed = 2032, gameDuration = 30) {
    const duration = Math.max(1, Number(gameDuration) || 30);
    const fps30 = runClockPattern(seed, duration, 1, storyFramePattern(duration, 30));
    const fps60 = runClockPattern(seed, duration, 1, storyFramePattern(duration, 60));
    const fps144 = runClockPattern(seed, duration, 1, storyFramePattern(duration, 144));
    const jitter = runClockPattern(seed, duration, 1, storyJitterPattern(duration));
    const speed2 = runClockPattern(seed, duration / 2, 2, storyFramePattern(duration / 2, 60));
    const speed4 = runClockPattern(seed, duration / 4, 4, storyFramePattern(duration / 4, 60));
    const legacy30 = runClockPattern(
        seed,
        duration,
        1,
        storyFramePattern(duration, 30),
        { 'time.fixedStep': false }
    );
    const legacy144 = runClockPattern(
        seed,
        duration,
        1,
        storyFramePattern(duration, 144),
        { 'time.fixedStep': false }
    );

    const pauseRuntime = createRuntime(seed >>> 0);
    let pause;
    try {
        pauseRuntime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        pauseRuntime.api.advance(2.125);
        const beforeStory = pauseRuntime.api.state();
        const before = {
            hash: hashSnapshot(stateSnapshot(beforeStory)),
            gameTime: beforeStory.clock,
            clock: pauseRuntime.api.clockSnapshot()
        };
        pauseRuntime.api.setPaused(true);
        pauseRuntime.api.advance(10);
        const afterStory = pauseRuntime.api.state();
        pause = {
            before,
            after: {
                hash: hashSnapshot(stateSnapshot(afterStory)),
                gameTime: afterStory.clock,
                clock: pauseRuntime.api.clockSnapshot()
            }
        };
    } finally {
        pauseRuntime.dom.window.close();
    }

    const saveRuntime = createRuntime(seed >>> 0);
    let savedRaw;
    let savedClock;
    try {
        saveRuntime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        saveRuntime.api.advance(12.125);
        saveRuntime.api.saveNow();
        savedRaw = saveRuntime.api.savedRaw();
        savedClock = saveRuntime.api.clockSnapshot();
    } finally {
        saveRuntime.dom.window.close();
    }

    const loadRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        loadRuntime.api.putSavedRaw(savedRaw);
        const loaded = loadRuntime.api.loadNow();
        const beforeAdvance = loadRuntime.api.clockSnapshot();
        const beforeGameTime = loadRuntime.api.state().clock;
        loadRuntime.api.advance(0.125);
        restored = {
            loaded,
            savedClock,
            beforeAdvance,
            beforeGameTime,
            afterAdvance: loadRuntime.api.clockSnapshot(),
            afterGameTime: loadRuntime.api.state().clock
        };
    } finally {
        loadRuntime.dom.window.close();
    }

    const calendarRuntime = createRuntime(seed >>> 0);
    let calendar;
    try {
        calendar = {
            start: calendarRuntime.api.calendarAt(0),
            yearEnd: calendarRuntime.api.calendarAt(119.999),
            nextYear: calendarRuntime.api.calendarAt(120),
            tenYears: calendarRuntime.api.calendarAt(1200)
        };
    } finally {
        calendarRuntime.dom.window.close();
    }

    return {
        duration,
        patterns: { fps30, fps60, fps144, jitter },
        speeds: { speed1: fps60, speed2, speed4 },
        legacy: {
            fps30: legacy30,
            fps144: legacy144,
            frameDependent: legacy30.hash !== legacy144.hash
        },
        pause,
        restored,
        calendar
    };
}

function storyDeterministicSaveSnapshot(api) {
    api.saveNow();
    const saved = JSON.parse(api.savedRaw());
    // Duvar saatiyle ölçülen p95/ortalama süre dünya durumunun parçası değildir.
    // Olaylar ve sayaçlar deterministiktir; yalnız performans örneklerini dışla.
    if (saved.telemetry && saved.telemetry.performance) delete saved.telemetry.performance;
    return saved;
}

function storyDiffPaths(left, right, pathName = '$', result = []) {
    if (result.length >= 40) return result;
    if (Object.is(left, right)) return result;
    const leftObject = left && typeof left === 'object';
    const rightObject = right && typeof right === 'object';
    if (!leftObject || !rightObject || Array.isArray(left) !== Array.isArray(right)) {
        result.push({ path: pathName, left, right });
        return result;
    }
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(left, key) || !Object.prototype.hasOwnProperty.call(right, key)) {
            result.push({ path: `${pathName}.${key}`, left: left[key], right: right[key] });
        } else {
            storyDiffPaths(left[key], right[key], `${pathName}.${key}`, result);
        }
        if (result.length >= 40) break;
    }
    return result;
}

function probeSchedulerRegistry(seed = 2032) {
    const expectedOrder = [
        'resource', 'production', 'commander-ai', 'loyalty', 'economy',
        'city-growth', 'population', 'human-migration', 'institutions', 'power-centers', 'population-needs',
        'factions', 'society', 'state-capacity', 'elections', 'integrity', 'political-crisis', 'character-actions', 'negotiation-deadlines', 'siege', 'technology',
        'chatter', 'talks', 'diplomacy', 'era', 'city-development',
        'replenishment'
    ];

    const cadenceRuntime = createRuntime(seed >>> 0);
    let cadence;
    try {
        cadenceRuntime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        cadenceRuntime.api.advance(14);
        const atBoundary = cadenceRuntime.api.schedulerSnapshot();
        cadenceRuntime.api.advance(0.25);
        cadence = {
            atBoundary,
            afterQuarter: cadenceRuntime.api.schedulerSnapshot()
        };
    } finally {
        cadenceRuntime.dom.window.close();
    }

    const registry = runClockPattern(seed, 30, 1, storyFramePattern(30, 60));
    const legacy = runClockPattern(
        seed,
        30,
        1,
        storyFramePattern(30, 60),
        { 'scheduler.registry': false }
    );

    const sourceRuntime = createRuntime(seed >>> 0);
    let checkpointRaw;
    let continuous;
    try {
        sourceRuntime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        sourceRuntime.api.advance(73.125);
        sourceRuntime.api.saveNow();
        checkpointRaw = sourceRuntime.api.savedRaw();
        sourceRuntime.api.advance(90.875);
        continuous = storyDeterministicSaveSnapshot(sourceRuntime.api);
    } finally {
        sourceRuntime.dom.window.close();
    }

    const resumedRuntime = createRuntime(seed >>> 0);
    let resumed;
    try {
        resumedRuntime.api.putSavedRaw(checkpointRaw);
        const loaded = resumedRuntime.api.loadNow();
        const restoredScheduler = resumedRuntime.api.schedulerSnapshot();
        const checkpoint = JSON.parse(checkpointRaw);
        if (checkpoint.telemetry && checkpoint.telemetry.performance) delete checkpoint.telemetry.performance;
        const immediatelyResaved = storyDeterministicSaveSnapshot(resumedRuntime.api);
        resumedRuntime.api.advance(90.875);
        resumed = {
            loaded,
            restoredScheduler,
            checkpointDifferences: storyDiffPaths(checkpoint, immediatelyResaved),
            snapshot: storyDeterministicSaveSnapshot(resumedRuntime.api)
        };
    } finally {
        resumedRuntime.dom.window.close();
    }

    const legacySave = JSON.parse(checkpointRaw);
    delete legacySave.scheduler;
    delete legacySave.runtime;
    const fallbackRuntime = createRuntime(seed >>> 0);
    let fallback;
    try {
        fallbackRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        fallback = {
            loaded: fallbackRuntime.api.loadNow(),
            scheduler: fallbackRuntime.api.schedulerSnapshot()
        };
    } finally {
        fallbackRuntime.dom.window.close();
    }

    return {
        expectedOrder,
        cadence,
        ab: {
            registryHash: registry.worldHash,
            legacyHash: legacy.worldHash
        },
        continuation: {
            continuousHash: hashSnapshot(continuous),
            resumedHash: hashSnapshot(resumed.snapshot),
            equal: JSON.stringify(continuous) === JSON.stringify(resumed.snapshot),
            differences: storyDiffPaths(continuous, resumed.snapshot),
            checkpointDifferences: resumed.checkpointDifferences,
            loaded: resumed.loaded,
            restoredScheduler: resumed.restoredScheduler
        },
        fallback
    };
}

const STORY_RNG_TEST_STREAMS = [
    'world', 'character', 'military', 'economy', 'society',
    'production', 'diplomacy', 'narrative', 'governance'
];

function storyRngSequences(api, count) {
    return Object.fromEntries(STORY_RNG_TEST_STREAMS.map(name => [name, api.rngNext(name, count)]));
}

function probeRngStreams(seed = 2032) {
    const sourceRuntime = createRuntime(seed >>> 0);
    let savedRaw;
    let savedSnapshot;
    let expectedAfterSave;
    let initialSnapshot;
    try {
        sourceRuntime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        initialSnapshot = sourceRuntime.api.rngSnapshot();
        sourceRuntime.api.advance(60);
        sourceRuntime.api.saveNow();
        savedRaw = sourceRuntime.api.savedRaw();
        savedSnapshot = sourceRuntime.api.rngSnapshot();
        expectedAfterSave = storyRngSequences(sourceRuntime.api, 8);
    } finally {
        sourceRuntime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const snapshot = restoredRuntime.api.rngSnapshot();
        const actualAfterLoad = storyRngSequences(restoredRuntime.api, 8);
        restored = { loaded, snapshot, actualAfterLoad };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const sameSeedRuntime = createRuntime(seed >>> 0);
    const differentSeedRuntime = createRuntime((seed + 1) >>> 0);
    let sameSeed;
    let differentSeed;
    try {
        sameSeedRuntime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        differentSeedRuntime.api.newCampaign({ seed: seed + 1, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        sameSeed = {
            snapshot: sameSeedRuntime.api.rngSnapshot(),
            military: sameSeedRuntime.api.rngNext('military', 12)
        };
        differentSeed = {
            snapshot: differentSeedRuntime.api.rngSnapshot(),
            military: differentSeedRuntime.api.rngNext('military', 12)
        };
    } finally {
        sameSeedRuntime.dom.window.close();
        differentSeedRuntime.dom.window.close();
    }

    const isolatedBaseRuntime = createRuntime(seed >>> 0);
    const isolatedNoiseRuntime = createRuntime(seed >>> 0);
    let isolated;
    try {
        isolatedBaseRuntime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        isolatedNoiseRuntime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const baselineMilitary = isolatedBaseRuntime.api.rngNext('military', 16);
        isolatedNoiseRuntime.api.rngNext('narrative', 100);
        const militaryAfterNarrativeNoise = isolatedNoiseRuntime.api.rngNext('military', 16);
        isolated = { baselineMilitary, militaryAfterNarrativeNoise };
    } finally {
        isolatedBaseRuntime.dom.window.close();
        isolatedNoiseRuntime.dom.window.close();
    }

    const coupledBaseRuntime = createRuntime(seed >>> 0);
    const coupledNoiseRuntime = createRuntime(seed >>> 0);
    let coupled;
    try {
        const featureFlags = { 'rng.streams': false };
        coupledBaseRuntime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true, featureFlags });
        coupledNoiseRuntime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true, featureFlags });
        const baselineMilitary = coupledBaseRuntime.api.rngNext('military', 16);
        coupledNoiseRuntime.api.rngNext('narrative', 100);
        const militaryAfterNarrativeNoise = coupledNoiseRuntime.api.rngNext('military', 16);
        coupled = { baselineMilitary, militaryAfterNarrativeNoise };
    } finally {
        coupledBaseRuntime.dom.window.close();
        coupledNoiseRuntime.dom.window.close();
    }

    const withoutRng = JSON.parse(savedRaw);
    delete withoutRng.rng;
    const fallbackRaw = JSON.stringify(withoutRng);
    const fallbackA = createRuntime(seed >>> 0);
    const fallbackB = createRuntime(seed >>> 0);
    let fallback;
    try {
        fallbackA.api.putSavedRaw(fallbackRaw);
        fallbackB.api.putSavedRaw(fallbackRaw);
        const loadedA = fallbackA.api.loadNow();
        const loadedB = fallbackB.api.loadNow();
        fallback = {
            loadedA,
            loadedB,
            snapshotA: fallbackA.api.rngSnapshot(),
            snapshotB: fallbackB.api.rngSnapshot()
        };
    } finally {
        fallbackA.dom.window.close();
        fallbackB.dom.window.close();
    }

    const invalidRuntime = createRuntime(seed >>> 0);
    let unknownRejected = false;
    try {
        invalidRuntime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        try {
            invalidRuntime.api.rngNext('typo-stream', 1);
        } catch (_) {
            unknownRejected = true;
        }
    } finally {
        invalidRuntime.dom.window.close();
    }

    return {
        initialSnapshot,
        savedSnapshot,
        expectedAfterSave,
        restored,
        sameSeed,
        differentSeed,
        isolated,
        coupled,
        fallback,
        unknownRejected
    };
}

function probeCausalityLedger(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let enabled;
    let savedRaw;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = runtime.api.state();
        const welfareBefore = story.states[0].welfare;
        const firstWelfare = runtime.api.causalityWelfareCommand(0, -5, 'test:welfare:once');
        const duplicateWelfare = runtime.api.causalityWelfareCommand(0, -5, 'test:welfare:once');
        const welfareAfter = story.states[0].welfare;

        const transferNode = story.nodes.find(node => node.owner === 0);
        if (!transferNode) throw new Error('Nedensellik probu için oyuncu bölgesi bulunamadı.');
        const telemetryBefore = runtime.api.telemetry().counters['territory.owner_changed'] || 0;
        const transferApplied = runtime.api.causalityTransfer(transferNode.id, 1, 'test:transfer:once');
        const telemetryImmediate = runtime.api.telemetry().counters['territory.owner_changed'] || 0;
        runtime.api.telemetryTick();
        const telemetryAfterTick = runtime.api.telemetry().counters['territory.owner_changed'] || 0;

        runtime.api.causalityTreaty(0, 1, 'truce', 2, 'test:treaty:once');
        runtime.api.causalityRelAdd(0, 1, 17, 'test:relation:once');
        runtime.api.causalityResourceFlow(0, 'test.resource', { oil: 0, manpower: 0, points: -7 }, 'test:resource:once');
        const movingCommander = story.states[0].gov && story.states[0].gov.commanders[0];
        const moveFrom = movingCommander ? movingCommander.node : null;
        const moveTarget = moveFrom == null
            ? null
            : (story.nodes[moveFrom].neighbors || [])[0];
        const moveApplied = movingCommander && moveTarget != null
            ? runtime.api.causalityMove(0, movingCommander.id, moveTarget)
            : false;
        const ledger = runtime.api.causalitySnapshot();
        const welfareEffect = ledger.effects.find(effect => effect.path === 'state:0.welfare');
        const ownerEffect = ledger.effects.find(effect => effect.path === `region:${transferNode.id}.ownerId`);
        const treatyEffect = ledger.effects.find(effect => effect.path === 'relation:0|1.treaty');
        const relationEffect = ledger.effects.find(effect => effect.path === 'relation:0|1.value');
        const resourceEffect = ledger.effects.find(effect => effect.path === 'state:0.resources' && effect.source === 'test.resource');
        const movementEffect = movingCommander
            ? ledger.effects.find(effect => effect.path === `character:${movingCommander.id}.node` && effect.source === 'test.causality.move')
            : null;
        const trace = welfareEffect ? runtime.api.causalityTrace(welfareEffect.id) : null;

        let invalidKeyRejected = false;
        try { runtime.api.causalityWelfareCommand(0, -1, ''); } catch (_) { invalidKeyRejected = true; }

        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        enabled = {
            welfareBefore,
            firstWelfare,
            duplicateWelfare,
            welfareAfter,
            transferApplied,
            transferNodeId: transferNode.id,
            telemetryBefore,
            telemetryImmediate,
            telemetryAfterTick,
            ledger,
            welfareEffect,
            ownerEffect,
            treatyEffect,
            relationEffect,
            resourceEffect,
            movementEffect,
            moveApplied,
            moveFrom,
            moveTarget,
            trace,
            invalidKeyRejected
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const before = restoredRuntime.api.causalitySnapshot();
        const nextCommandId = before.nextCommandId;
        restoredRuntime.api.causalityWelfareCommand(0, -1, 'test:welfare:after-load');
        const after = restoredRuntime.api.causalitySnapshot();
        restored = {
            loaded,
            before,
            after,
            continuedCommandId: `command:${nextCommandId}`,
            exact: JSON.stringify(before) === JSON.stringify(JSON.parse(savedRaw).causality)
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'causality.ledger': false }
        });
        const story = disabledRuntime.api.state();
        const before = story.states[0].welfare;
        disabledRuntime.api.causalityWelfareCommand(0, -5, 'test:disabled');
        const ledger = disabledRuntime.api.causalitySnapshot();
        disabled = {
            before,
            after: story.states[0].welfare,
            commands: ledger.commands.length,
            events: ledger.events.length,
            effects: ledger.effects.length
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    return { enabled, restored, disabled };
}

function probeCausalityGuards(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let guarded;
    let corrupt;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const cycle = runtime.api.causalityGuardCycle(20);
        const eventFlood = runtime.api.causalityGuardEventFlood(100);
        const effectFlood = runtime.api.causalityGuardEffectFlood(150);
        const invariants = runtime.api.causalityGuardInvariantProbe();
        const consistency = runtime.api.causalityGuardConsistencyProbe();
        const ledger = runtime.api.causalitySnapshot();
        guarded = {
            cycle,
            eventFlood,
            effectFlood,
            invariants,
            consistency,
            ledger,
            validation: runtime.api.causalityValidate(ledger)
        };

        const damaged = JSON.parse(JSON.stringify(ledger));
        if (!damaged.effects.length) throw new Error('Bozuk kayıt probu için etki bulunamadı.');
        damaged.effects[0].eventId = 'world-event:missing';
        const validationBeforeRestore = runtime.api.causalityValidate(damaged);
        runtime.api.causalityRestore(damaged);
        const restored = runtime.api.causalitySnapshot();
        corrupt = {
            validationBeforeRestore,
            restored,
            validationAfterRestore: runtime.api.causalityValidate(restored)
        };
    } finally {
        runtime.dom.window.close();
    }

    const windowRuntime = createRuntime(seed >>> 0);
    let windowFlood;
    try {
        windowRuntime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        windowFlood = windowRuntime.api.causalityGuardWindowFlood(600);
    } finally {
        windowRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'causality.guards': false }
        });
        disabled = disabledRuntime.api.causalityGuardInvariantProbe();
    } finally {
        disabledRuntime.dom.window.close();
    }

    const normalOn = runStorySimulation({ seed, seconds: 60 });
    const normalOff = runStorySimulation({
        seed,
        seconds: 60,
        featureFlags: { 'causality.guards': false }
    });
    return {
        guarded,
        corrupt,
        windowFlood,
        disabled,
        ab: {
            onHash: normalOn.stateHash,
            offHash: normalOff.stateHash,
            equal: normalOn.stateHash === normalOff.stateHash
        }
    };
}

function probeStoryProjection(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main;
    let savedRaw;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = runtime.api.state();
        runtime.api.causalityWelfareCommand(0, -4, 'test:projection:own-welfare');
        runtime.api.causalityWelfareCommand(1, -7, 'test:projection:foreign-welfare');
        runtime.api.causalityResourceFlow(0, 'test.resource', { oil: 0, manpower: 0, points: -11 }, 'test:projection:resource');
        const publicNode = story.nodes.find(node => node.owner === 1);
        if (!publicNode) throw new Error('Projeksiyon probu için yabancı bölge bulunamadı.');
        runtime.api.causalityTransfer(publicNode.id, 2, 'test:projection:transfer');

        const beforeHash = hashSnapshot(stateSnapshot(story));
        const world = runtime.api.worldV2();
        const ledger = runtime.api.causalitySnapshot();
        const worldBefore = JSON.stringify(world);
        const ledgerBefore = JSON.stringify(ledger);
        const knowledge0 = runtime.api.playerKnowledge(world, 'country:0');
        const knowledge1 = runtime.api.playerKnowledge(world, 'country:1');
        const player0 = runtime.api.playerDomainProjection(world, knowledge0, ledger, { maxItems: 100 });
        const player1 = runtime.api.playerDomainProjection(world, knowledge1, ledger, { maxItems: 100 });
        const afterHash = hashSnapshot(stateSnapshot(story));

        const foreignEffect = ledger.effects.find(effect => effect.path === 'state:1.welfare');
        const ownEffect = ledger.effects.find(effect => effect.path === 'state:0.welfare');
        const publicEffect = ledger.effects.find(effect => effect.path === `region:${publicNode.id}.ownerId`);
        if (!foreignEffect || !ownEffect || !publicEffect) {
            throw new Error('Projeksiyon probu gerekli nedensellik etkilerini üretemedi.');
        }

        const estimatedKnowledge = structuredClone(knowledge0);
        const estimatedFact = runtime.api.samplePlayerFact({
            id: 'fact:country:1:welfare',
            subjectId: 'country:1',
            field: 'welfare',
            value: { min: 35, max: 65 },
            status: 'ESTIMATED',
            confidenceBps: 6200,
            source: { type: 'INTELLIGENCE_REPORT', id: 'report:projection' },
            observedAt: world.clock.gameTime
        });
        const factIndex = estimatedKnowledge.facts.findIndex(fact => (
            fact.subjectId === 'country:1' && fact.field === 'welfare'
        ));
        estimatedKnowledge.facts[factIndex] = estimatedFact;
        const country1 = estimatedKnowledge.countries.find(country => country.id === 'country:1');
        country1.welfare = estimatedFact;
        const estimated = runtime.api.playerDomainProjection(world, estimatedKnowledge, ledger, { maxItems: 100 });

        const player0Foreign = player0.items.find(item => item.effectId === foreignEffect.id) || null;
        const player1Foreign = player1.items.find(item => item.effectId === foreignEffect.id) || null;
        const estimatedForeign = estimated.items.find(item => item.effectId === foreignEffect.id) || null;
        const player0Own = player0.items.find(item => item.effectId === ownEffect.id) || null;
        const player0Public = player0.items.find(item => item.effectId === publicEffect.id) || null;
        const player1Public = player1.items.find(item => item.effectId === publicEffect.id) || null;

        const damagedEstimated = structuredClone(estimated);
        const damagedEstimatedItem = damagedEstimated.items.find(item => item.effectId === foreignEffect.id);
        damagedEstimatedItem.precision = 'EXACT';
        damagedEstimatedItem.before = 777777;
        const damagedEstimatedValidation = runtime.api.validatePlayerProjection(
            damagedEstimated,
            estimatedKnowledge,
            ledger
        );

        const hiddenLeak = structuredClone(player0);
        hiddenLeak.items.push(structuredClone(player1Foreign));
        const hiddenLeakValidation = runtime.api.validatePlayerProjection(hiddenLeak, knowledge0, ledger);

        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        const ui = runtime.api.renderPlayerChanges();
        main = {
            beforeHash,
            afterHash,
            worldUnchanged: JSON.stringify(world) === worldBefore,
            ledgerUnchanged: JSON.stringify(ledger) === ledgerBefore,
            player0,
            player1,
            estimated,
            validation0: runtime.api.validatePlayerProjection(player0, knowledge0, ledger),
            validation1: runtime.api.validatePlayerProjection(player1, knowledge1, ledger),
            validationEstimated: runtime.api.validatePlayerProjection(estimated, estimatedKnowledge, ledger),
            foreignEffectId: foreignEffect.id,
            ownEffectId: ownEffect.id,
            publicEffectId: publicEffect.id,
            player0Foreign,
            player1Foreign,
            estimatedForeign,
            player0Own,
            player0Public,
            player1Public,
            damagedEstimatedValidation,
            hiddenLeakValidation,
            ui,
            exactSecretLeakedToPlayer0: JSON.stringify(player0).includes('777777')
                || JSON.stringify(player0).includes(String(foreignEffect.before))
                    && !!player0Foreign,
            currentBeforeSave: runtime.api.currentPlayerProjection({ maxItems: 100 })
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const currentAfterLoad = restoredRuntime.api.currentPlayerProjection({ maxItems: 100 });
        restored = {
            loaded,
            currentAfterLoad,
            equal: JSON.stringify(main.currentBeforeSave) === JSON.stringify(currentAfterLoad)
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'projection.causalityUi': false }
        });
        disabled = disabledRuntime.api.currentPlayerProjection();
    } finally {
        disabledRuntime.dom.window.close();
    }

    const normalOn = runStorySimulation({ seed, seconds: 60 });
    const normalOff = runStorySimulation({
        seed,
        seconds: 60,
        featureFlags: { 'projection.causalityUi': false }
    });
    return {
        main,
        restored,
        disabled,
        ab: {
            onHash: normalOn.stateHash,
            offHash: normalOff.stateHash,
            equal: normalOn.stateHash === normalOff.stateHash
        }
    };
}

function probeRegionModel(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main;
    let savedRaw;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = runtime.api.state();
        const modelBefore = runtime.api.regionModel();
        const snapshotBefore = runtime.api.regionSnapshot();
        const validation = runtime.api.validateRegionModel(modelBefore);
        const worldBefore = runtime.api.worldV2();
        const topologyHashBefore = modelBefore.topologyHash;
        const transferNode = story.nodes.find(node => node.owner !== 1);
        if (!transferNode) throw new Error('RegionModel probu için devredilebilir bölge bulunamadı.');
        const transferApplied = runtime.api.causalityTransfer(
            transferNode.id,
            1,
            'test:region-model:owner-transfer'
        );
        const snapshotAfter = runtime.api.regionSnapshot();
        const modelAfter = runtime.api.regionModel();
        const worldAfter = runtime.api.worldV2();
        const dynamicAfter = snapshotAfter.regions.find(region => region.legacyId === transferNode.id);
        const worldDynamicAfter = worldAfter.regions.find(region => region.legacyId === transferNode.id);

        const invalidNodes = structuredClone(story.nodes);
        invalidNodes[0].id = 999999;
        const invalidLiveValidation = runtime.api.validateRegionModelAgainst(
            modelAfter,
            invalidNodes,
            structuredClone(story.states)
        );

        const collectiveValidationBeforeSave = runtime.api.validateCollectiveLedger(
            runtime.api.collectiveLedger()
        );
        let collectiveForSaveError = null;
        try { runtime.api.collectiveForSave(); } catch (error) {
            collectiveForSaveError = String(error && error.message || error);
        }
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        const savedPayload = JSON.parse(savedRaw);
        main = {
            saveOk: story._lastSaveOk === true,
            saveError: story._lastSaveError || null,
            collectiveValidationBeforeSave,
            collectiveForSaveError,
            savedNodeOwner: savedPayload.nodes[transferNode.id].owner,
            opinionValidation: runtime.api.validateOpinionLedger(runtime.api.opinionLedger()),
            count: story.nodes.length,
            validation,
            topologyHashBefore,
            topologyHashAfter: modelAfter.topologyHash,
            modelBefore,
            snapshotBefore,
            worldBefore,
            transferNodeId: transferNode.id,
            transferApplied,
            dynamicOwnerAfter: dynamicAfter && dynamicAfter.ownerId,
            worldOwnerAfter: worldDynamicAfter && worldDynamicAfter.ownerId,
            invalidLiveValidation,
            identityMatches: modelBefore.regions.every((region, index) => (
                region.legacyId === index
                && region.id === `region:${index}`
                && region.center.x === story.nodes[index].lx
                && region.center.y === story.nodes[index].ly
            )),
            topologyMatches: modelBefore.regions.every(region => (
                JSON.stringify(region.neighborIds)
                === JSON.stringify(
                    [...new Set(story.nodes[region.legacyId].neighbors)]
                        .sort((a, b) => a - b)
                        .map(id => `region:${id}`)
                )
            )),
            v2Validation: runtime.api.validateWorldV2(worldAfter),
            savedModel: savedPayload.regionModel
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const model = restoredRuntime.api.regionModel();
        const snapshot = restoredRuntime.api.regionSnapshot();
        restored = {
            loaded,
            model,
            snapshot,
            validation: restoredRuntime.api.validateRegionModel(model),
            exactModel: JSON.stringify(model) === JSON.stringify(main.savedModel),
            owner: snapshot.regions.find(region => region.legacyId === main.transferNodeId).ownerId
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const legacySave = JSON.parse(savedRaw);
    delete legacySave.regionModel;
    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        const loaded = legacyRuntime.api.loadNow();
        const model = legacyRuntime.api.regionModel();
        legacy = {
            loaded,
            model,
            validation: legacyRuntime.api.validateRegionModel(model)
        };
    } finally {
        legacyRuntime.dom.window.close();
    }

    const corruptSave = JSON.parse(savedRaw);
    corruptSave.regionModel.regions[0].neighborIds = ['region:missing'];
    const corruptRuntime = createRuntime(seed >>> 0);
    let corrupt;
    try {
        corruptRuntime.api.putSavedRaw(JSON.stringify(corruptSave));
        const loaded = corruptRuntime.api.loadNow();
        const model = corruptRuntime.api.regionModel();
        corrupt = {
            loaded,
            model,
            validation: corruptRuntime.api.validateRegionModel(model)
        };
    } finally {
        corruptRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'world.regionModel': false }
        });
        const snapshot = disabledRuntime.api.regionSnapshot();
        const world = disabledRuntime.api.worldV2();
        disabled = {
            snapshot,
            worldValidation: disabledRuntime.api.validateWorldV2(world),
            regionCount: world.regions.length
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const normalOn = runStorySimulation({
        seed,
        seconds: 60,
        featureFlags: { 'economy.tradeLogistics': false }
    });
    const normalOff = runStorySimulation({
        seed,
        seconds: 60,
        featureFlags: {
            'world.regionModel': false,
            'economy.tradeLogistics': false
        }
    });
    return {
        main,
        restored,
        legacy,
        corrupt,
        disabled,
        ab: {
            onHash: normalOn.stateHash,
            offHash: normalOff.stateHash,
            equal: normalOn.stateHash === normalOff.stateHash
        }
    };
}

function probeRegionActivation(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main;
    let savedRaw;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = runtime.api.state();
        const beforeHash = hashSnapshot(stateSnapshot(story));
        const snapshot = runtime.api.activationSnapshot();
        const validation = runtime.api.validateActivation(snapshot);
        const commanderBefore = snapshot.regions.find(region => region.legacyId === story.commander.node);
        const uiBefore = runtime.api.activationUiState({});
        runtime.api.activationUiState({
            selectedNodeId: story.nodes.length - 1,
            cityOpen: true,
            councilOpen: true,
            changesOpen: true,
            camera: { x: 1234.5, y: 678.25, zoom: 3.75 }
        });
        const afterUiSnapshot = runtime.api.activationSnapshot();
        const afterUiHash = hashSnapshot(stateSnapshot(story));

        const batchesA = [];
        const batchesB = [];
        const runCounts = new Map(snapshot.regions.map(region => [region.legacyId, 0]));
        for (let tick = 0; tick < 20; tick++) {
            const batchA = runtime.api.activationBatch('economy', tick);
            const batchB = runtime.api.activationBatch('economy', tick);
            batchesA.push(batchA);
            batchesB.push(batchB);
            for (const regionId of batchA) runCounts.set(regionId, (runCounts.get(regionId) || 0) + 1);
        }
        const cadenceMatches = snapshot.regions.every(region => (
            runCounts.get(region.legacyId) === 20 / region.budget.cadenceTicks
        ));
        const benchmarkStarted = process.hrtime.bigint();
        for (let index = 0; index < 250; index++) {
            runtime.api.activationBatch('benchmark', index);
        }
        const benchmarkMs = Number(process.hrtime.bigint() - benchmarkStarted) / 1e6;

        const coldTarget = snapshot.regions.find(region => region.level === 'COLD');
        if (!coldTarget) throw new Error('Aktivasyon probu COLD hedef üretemedi.');
        const moved = runtime.api.activationMovePlayer(coldTarget.legacyId);
        const afterMove = runtime.api.activationSnapshot();
        const movedRegion = afterMove.regions.find(region => region.legacyId === coldTarget.legacyId);
        const oldCommander = afterMove.regions.find(region => region.legacyId === commanderBefore.legacyId);

        const damaged = structuredClone(snapshot);
        damaged.regions[1].id = damaged.regions[0].id;
        damaged.regions[0].level = 'LAVA';
        const damagedValidation = runtime.api.validateActivation(damaged);

        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        main = {
            beforeHash,
            afterUiHash,
            uiBefore,
            uiAfter: runtime.api.activationUiState({}),
            snapshot,
            afterUiSnapshot,
            validation,
            commanderBefore,
            uiNeutral: JSON.stringify(snapshot) === JSON.stringify(afterUiSnapshot),
            batchesRepeatable: JSON.stringify(batchesA) === JSON.stringify(batchesB),
            cadenceMatches,
            benchmark: {
                batches: 250,
                wallTimeMs: Math.round(benchmarkMs * 1000) / 1000,
                averageMs: Math.round(benchmarkMs / 250 * 1000000) / 1000000
            },
            moved,
            coldTarget,
            movedRegion,
            oldCommander,
            afterMove,
            damagedValidation,
            savedPolicy: JSON.parse(savedRaw).activationPolicy
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const snapshot = restoredRuntime.api.activationSnapshot();
        restored = {
            loaded,
            policy: restoredRuntime.api.activationPolicy(),
            snapshot,
            validation: restoredRuntime.api.validateActivation(snapshot),
            exactPolicy: JSON.stringify(restoredRuntime.api.activationPolicy()) === JSON.stringify(main.savedPolicy),
            exactSnapshot: JSON.stringify(snapshot) === JSON.stringify(main.afterMove)
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const legacySave = JSON.parse(savedRaw);
    delete legacySave.activationPolicy;
    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        const loaded = legacyRuntime.api.loadNow();
        const policy = legacyRuntime.api.activationPolicy();
        const snapshot = legacyRuntime.api.activationSnapshot();
        legacy = {
            loaded,
            policy,
            snapshot,
            validation: legacyRuntime.api.validateActivation(snapshot)
        };
    } finally {
        legacyRuntime.dom.window.close();
    }

    const corruptSave = JSON.parse(savedRaw);
    corruptSave.activationPolicy.topologyHash = 'fnv1a32:deadbeef';
    const corruptRuntime = createRuntime(seed >>> 0);
    let corrupt;
    try {
        corruptRuntime.api.putSavedRaw(JSON.stringify(corruptSave));
        const loaded = corruptRuntime.api.loadNow();
        const policy = corruptRuntime.api.activationPolicy();
        const snapshot = corruptRuntime.api.activationSnapshot();
        corrupt = {
            loaded,
            policy,
            snapshot,
            validation: corruptRuntime.api.validateActivation(snapshot)
        };
    } finally {
        corruptRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'world.regionActivation': false }
        });
        const snapshot = disabledRuntime.api.activationSnapshot();
        disabled = {
            snapshot,
            batch: disabledRuntime.api.activationBatch('economy', 0),
            validation: disabledRuntime.api.validateActivation(snapshot),
            worldValidation: disabledRuntime.api.validateWorldV2(disabledRuntime.api.worldV2())
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const baselineRuntime = createRuntime(seed >>> 0);
    const uiRuntime = createRuntime(seed >>> 0);
    let uiOutcome;
    try {
        const config = { seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true };
        baselineRuntime.api.newCampaign(config);
        uiRuntime.api.newCampaign(config);
        for (let elapsed = 0; elapsed < 60; elapsed++) {
            baselineRuntime.api.advance(1);
            uiRuntime.api.activationUiState({
                selectedNodeId: (elapsed * 17) % uiRuntime.api.state().nodes.length,
                cityOpen: elapsed % 2 === 0,
                councilOpen: elapsed % 3 === 0,
                changesOpen: elapsed % 5 === 0,
                camera: {
                    x: elapsed * 43.25,
                    y: elapsed * 19.5,
                    zoom: 1 + (elapsed % 4)
                }
            });
            uiRuntime.api.advance(1);
        }
        const baselineSnapshot = stateSnapshot(baselineRuntime.api.state());
        const uiSnapshot = stateSnapshot(uiRuntime.api.state());
        uiOutcome = {
            baselineHash: hashSnapshot(baselineSnapshot),
            uiHash: hashSnapshot(uiSnapshot),
            equal: JSON.stringify(baselineSnapshot) === JSON.stringify(uiSnapshot),
            differences: storyDiffPaths(baselineSnapshot, uiSnapshot)
        };
    } finally {
        baselineRuntime.dom.window.close();
        uiRuntime.dom.window.close();
    }

    const normalOn = runStorySimulation({ seed, seconds: 60 });
    const normalOff = runStorySimulation({
        seed,
        seconds: 60,
        featureFlags: { 'world.regionActivation': false }
    });
    return {
        main,
        restored,
        legacy,
        corrupt,
        disabled,
        uiOutcome,
        ab: {
            onHash: normalOn.stateHash,
            offHash: normalOff.stateHash,
            equal: normalOn.stateHash === normalOff.stateHash
        }
    };
}

function probeRegionAggregation(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main;
    let savedRaw;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        runtime.api.advance(5);
        const story = runtime.api.state();
        const beforeUiSnapshot = stateSnapshot(story);
        const beforeHash = hashSnapshot(beforeUiSnapshot);
        const snapshot = runtime.api.aggregationSnapshot();
        const validation = runtime.api.validateAggregationSnapshot(snapshot);
        const liveConservation = runtime.api.aggregationWorldSignature(story.nodes);

        const benchmarkStarted = process.hrtime.bigint();
        const coldStates = story.nodes.map(node => runtime.api.aggregationToCold(node.id));
        const hotStates = coldStates.map(cold => runtime.api.aggregationToHot(cold));
        const benchmarkMs = Number(process.hrtime.bigint() - benchmarkStarted) / 1e6;
        const allCapsulesValid = coldStates.every(cold => (
            cold && cold.mode === 'COLD'
            && runtime.api.validateAggregationCapsule(cold.capsule).ok
        ));
        const allHydrated = hotStates.every(hot => hot && hot.ok);
        const allExact = hotStates.every((hot, index) => (
            runtime.api.aggregationStable(hot.node)
            === runtime.api.aggregationStable(story.nodes[index])
        ));
        const coldConservation = runtime.api.aggregationWorldSignature(coldStates);

        const fixture = structuredClone(story.nodes[0]);
        fixture.pool = { 0: 3, 6: 2 };
        fixture.q = [
            { type: 0, t: 3.25, tot: 6, cmd: 11 },
            { type: 6, t: 8.5, tot: 12, cmd: 12 }
        ];
        fixture.stocks = { food: 123.456, energy: 78.9, steel: 41 };
        fixture.companyIds = ['company:z', 'company:a'];
        fixture.pendingEvents = [
            { id: 'regional-event:2', type: 'strike' },
            { id: 'regional-event:1', type: 'shortage' }
        ];
        fixture._siege = { by: (fixture.owner + 1) % story.states.length, since: 12.5 };
        fixture.futureLayer = {
            schemaVersion: 7,
            nested: { values: [1, 2, 3], label: 'gelecek-alan-korunumu' }
        };
        const fixtureCold = runtime.api.aggregationToCold(fixture.id, fixture);
        const fixtureHot = runtime.api.aggregationToHot(fixtureCold);
        const fixtureExact = fixtureHot.ok
            && runtime.api.aggregationStable(fixtureHot.node) === runtime.api.aggregationStable(fixture);

        const distributionA = runtime.api.aggregationDistribute(
            100.007,
            ['cohort:c', 'cohort:a', 'cohort:g', 'cohort:b', 'cohort:f', 'cohort:d', 'cohort:e'],
            'region:0:population',
            3
        );
        const distributionB = runtime.api.aggregationDistribute(
            100.007,
            ['cohort:g', 'cohort:f', 'cohort:e', 'cohort:d', 'cohort:c', 'cohort:b', 'cohort:a'],
            'region:0:population',
            3
        );
        const distributionTotal = Object.values(distributionA).reduce((sum, value) => sum + value, 0);

        const damagedPayload = structuredClone(fixtureCold.capsule);
        damagedPayload.payload.pop = (Number(damagedPayload.payload.pop) || 0) + 1;
        const damagedPayloadValidation = runtime.api.validateAggregationCapsule(damagedPayload);
        const damagedHot = runtime.api.aggregationToHot(Object.assign({}, fixtureCold, { capsule: damagedPayload }));

        const damagedSummary = structuredClone(fixtureCold.capsule);
        damagedSummary.summary.population += 100;
        const damagedSummaryValidation = runtime.api.validateAggregationCapsule(damagedSummary);

        const invalidTopologyFixture = structuredClone(fixture);
        invalidTopologyFixture.neighbors = invalidTopologyFixture.neighbors.slice(1);
        const invalidTopologyCold = runtime.api.aggregationToCold(invalidTopologyFixture.id, invalidTopologyFixture);

        const uiBefore = runtime.api.aggregationSnapshot();
        runtime.api.activationUiState({
            selectedNodeId: story.nodes.length - 1,
            cityOpen: true,
            councilOpen: true,
            changesOpen: true,
            camera: { x: 2048, y: 1024, zoom: 4 }
        });
        const uiAfter = runtime.api.aggregationSnapshot();
        const afterHash = hashSnapshot(stateSnapshot(story));

        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        main = {
            beforeHash,
            afterHash,
            snapshot,
            validation,
            liveConservation,
            coldConservation,
            allCapsulesValid,
            allHydrated,
            allExact,
            fixtureCold,
            fixtureHot,
            fixtureExact,
            distributionA,
            distributionB,
            distributionTotal: Math.round(distributionTotal * 1000) / 1000,
            damagedPayloadValidation,
            damagedSummaryValidation,
            damagedHot,
            invalidTopologyCold,
            uiNeutral: JSON.stringify(uiBefore) === JSON.stringify(uiAfter),
            benchmark: {
                regions: story.nodes.length,
                wallTimeMs: Math.round(benchmarkMs * 1000) / 1000,
                averageRoundTripMs: Math.round(benchmarkMs / story.nodes.length * 1000000) / 1000000
            },
            savedPolicy: JSON.parse(savedRaw).aggregationPolicy,
            savedSnapshot: runtime.api.aggregationSnapshot()
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const policy = restoredRuntime.api.aggregationPolicy();
        const snapshot = restoredRuntime.api.aggregationSnapshot();
        restored = {
            loaded,
            policy,
            snapshot,
            validation: restoredRuntime.api.validateAggregationSnapshot(snapshot),
            exactPolicy: JSON.stringify(policy) === JSON.stringify(main.savedPolicy),
            exactSnapshot: JSON.stringify(snapshot) === JSON.stringify(main.savedSnapshot)
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const legacySave = JSON.parse(savedRaw);
    delete legacySave.aggregationPolicy;
    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        const loaded = legacyRuntime.api.loadNow();
        const policy = legacyRuntime.api.aggregationPolicy();
        const snapshot = legacyRuntime.api.aggregationSnapshot();
        legacy = {
            loaded,
            policy,
            snapshot,
            validation: legacyRuntime.api.validateAggregationSnapshot(snapshot)
        };
    } finally {
        legacyRuntime.dom.window.close();
    }

    const corruptSave = JSON.parse(savedRaw);
    corruptSave.aggregationPolicy.topologyHash = 'fnv1a32:badc0ffe';
    const corruptRuntime = createRuntime(seed >>> 0);
    let corrupt;
    try {
        corruptRuntime.api.putSavedRaw(JSON.stringify(corruptSave));
        const loaded = corruptRuntime.api.loadNow();
        const policy = corruptRuntime.api.aggregationPolicy();
        const snapshot = corruptRuntime.api.aggregationSnapshot();
        corrupt = {
            loaded,
            policy,
            snapshot,
            validation: corruptRuntime.api.validateAggregationSnapshot(snapshot)
        };
    } finally {
        corruptRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'world.regionAggregation': false }
        });
        const snapshot = disabledRuntime.api.aggregationSnapshot();
        const transition = disabledRuntime.api.aggregationToCold(0);
        disabled = {
            snapshot,
            transition,
            validation: disabledRuntime.api.validateAggregationSnapshot(snapshot),
            worldValidation: disabledRuntime.api.validateWorldV2(disabledRuntime.api.worldV2())
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const normalOn = runStorySimulation({ seed, seconds: 60 });
    const normalOff = runStorySimulation({
        seed,
        seconds: 60,
        featureFlags: { 'world.regionAggregation': false }
    });
    return {
        main,
        restored,
        legacy,
        corrupt,
        disabled,
        ab: {
            onHash: normalOn.stateHash,
            offHash: normalOff.stateHash,
            equal: normalOn.stateHash === normalOff.stateHash
        }
    };
}

function probeInfrastructureGraph(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main;
    let savedRaw;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = runtime.api.state();
        const beforeHash = hashSnapshot(stateSnapshot(story));
        const snapshotBefore = runtime.api.infrastructureSnapshot();
        const validation = runtime.api.validateInfrastructureSnapshot(snapshotBefore);
        const graphBefore = runtime.api.infrastructureGraph();
        const worldBefore = runtime.api.worldV2();
        const worldValidation = runtime.api.validateWorldV2(worldBefore);

        const landCorridors = snapshotBefore.corridors.filter(corridor => corridor.mode === 'LAND');
        const first = landCorridors[0];
        const second = landCorridors.find(corridor => (
            !corridor.endpointRegionIds.some(regionId => first.endpointRegionIds.includes(regionId))
        ));
        if (!first || !second) throw new Error('Faz 14 kesinti probu için iki bağımsız kara koridoru bulunamadı.');
        const firstEnergy = snapshotBefore.corridors.find(corridor => (
            corridor.mode === 'ENERGY' && corridor.parentCorridorId === first.id
        ));
        const firstData = snapshotBefore.corridors.find(corridor => (
            corridor.mode === 'DATA' && corridor.parentCorridorId === first.id
        ));
        if (!firstEnergy || !firstData) throw new Error('Faz 14 fiziksel koridorunun enerji/veri katmanı eksik.');

        const flows = [
            { id: 'flow:linked-cut', mode: 'LAND', demand: 100, corridorIds: [first.id] },
            { id: 'flow:unrelated', mode: 'LAND', demand: 100, corridorIds: [second.id] },
            { id: 'flow:energy-layer', mode: 'ENERGY', demand: 100, corridorIds: [firstEnergy.id] },
            { id: 'flow:data-layer', mode: 'DATA', demand: 100, corridorIds: [firstData.id] }
        ];
        const flowsBefore = runtime.api.infrastructureResolveFlows(flows);
        const routeBefore = runtime.api.infrastructureFindRoute(
            first.endpointRegionIds[0],
            first.endpointRegionIds[1],
            { mode: 'LAND' }
        );
        const routeRepeat = runtime.api.infrastructureFindRoute(
            first.endpointRegionIds[0],
            first.endpointRegionIds[1],
            { mode: 'LAND' }
        );

        const accessExpected = [...new Set(first.endpointRegionIds.map(regionId => {
            const legacyId = Number(regionId.split(':')[1]);
            return `country:${story.nodes[legacyId].owner}`;
        }))].sort();
        const accessMatches = JSON.stringify(first.access.countryIds) === JSON.stringify(accessExpected);

        const damageResult = runtime.api.infrastructureSetDamage(first.id, 10000);
        const snapshotAfterCut = runtime.api.infrastructureSnapshot();
        const flowsAfter = runtime.api.infrastructureResolveFlows(flows);
        const routeAfter = runtime.api.infrastructureFindRoute(
            first.endpointRegionIds[0],
            first.endpointRegionIds[1],
            { mode: 'LAND' }
        );
        const afterHash = hashSnapshot(stateSnapshot(story));

        const uiBefore = runtime.api.infrastructureSnapshot();
        runtime.api.activationUiState({
            selectedNodeId: story.nodes.length - 1,
            cityOpen: true,
            councilOpen: true,
            changesOpen: true,
            camera: { x: 4096, y: 2048, zoom: 3.5 }
        });
        const uiAfter = runtime.api.infrastructureSnapshot();

        const invalidCapacityGraph = structuredClone(graphBefore);
        invalidCapacityGraph.corridors[0].baseCapacity = 0;
        const invalidCapacity = runtime.api.validateInfrastructureGraph(invalidCapacityGraph);

        const invalidDamageGraph = structuredClone(graphBefore);
        invalidDamageGraph.corridors[0].damageBps = 10001;
        const invalidDamage = runtime.api.validateInfrastructureGraph(invalidDamageGraph);

        const duplicateGraph = structuredClone(graphBefore);
        duplicateGraph.corridors.push(structuredClone(duplicateGraph.corridors[0]));
        const duplicate = runtime.api.validateInfrastructureGraph(duplicateGraph);

        const brokenParentGraph = structuredClone(graphBefore);
        const overlay = brokenParentGraph.corridors.find(corridor => corridor.mode === 'ENERGY');
        overlay.parentCorridorId = 'corridor:land:missing';
        const brokenParent = runtime.api.validateInfrastructureGraph(brokenParentGraph);

        const brokenRegionGraph = structuredClone(graphBefore);
        brokenRegionGraph.corridors[0].endpointRegionIds[0] = 'region:999999';
        const brokenRegion = runtime.api.validateInfrastructureGraph(brokenRegionGraph);

        const routePairs = landCorridors.slice(0, 100).map(corridor => corridor.endpointRegionIds);
        const benchmarkStarted = process.hrtime.bigint();
        const benchmarkRoutes = routePairs.map(endpoints => runtime.api.infrastructureFindRoute(
            endpoints[0],
            endpoints[1],
            { mode: 'LAND' }
        ));
        const benchmarkMs = Number(process.hrtime.bigint() - benchmarkStarted) / 1e6;

        runtime.api.infrastructureSetDamage(first.id, 4200);
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        const savedPayload = JSON.parse(savedRaw);
        const savedGraph = runtime.api.infrastructureGraph();
        const savedSnapshot = runtime.api.infrastructureSnapshot();
        main = {
            beforeHash,
            afterHash,
            snapshotBefore,
            snapshotAfterCut,
            validation,
            worldValidation,
            worldBefore,
            graphBefore,
            damageResult,
            firstCorridorId: first.id,
            secondCorridorId: second.id,
            firstEnergyId: firstEnergy.id,
            firstDataId: firstData.id,
            flowsBefore,
            flowsAfter,
            routeBefore,
            routeRepeat,
            routeAfter,
            accessExpected,
            accessMatches,
            uiNeutral: JSON.stringify(uiBefore) === JSON.stringify(uiAfter),
            invalidCapacity,
            invalidDamage,
            duplicate,
            brokenParent,
            brokenRegion,
            allBenchmarkRoutesFound: benchmarkRoutes.every(route => route.ok),
            benchmark: {
                routes: benchmarkRoutes.length,
                wallTimeMs: Math.round(benchmarkMs * 1000) / 1000,
                averageRouteMs: Math.round(benchmarkMs / benchmarkRoutes.length * 1000000) / 1000000
            },
            regionCorridorCoverage: worldBefore.regions.every(region => (
                region.logistics
                && Array.isArray(region.logistics.corridorIds)
                && region.logistics.corridorIds.length > 0
            )),
            savedPolicy: savedPayload.infrastructureGraph,
            savedSnapshot,
            compactBytes: JSON.stringify(savedPayload.infrastructureGraph).length,
            fullGraphBytes: JSON.stringify(savedGraph).length
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const policy = restoredRuntime.api.infrastructureForSave();
        const snapshot = restoredRuntime.api.infrastructureSnapshot();
        restored = {
            loaded,
            policy,
            snapshot,
            validation: restoredRuntime.api.validateInfrastructureSnapshot(snapshot),
            exactPolicy: JSON.stringify(policy) === JSON.stringify(main.savedPolicy),
            exactSnapshot: JSON.stringify(snapshot) === JSON.stringify(main.savedSnapshot)
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const legacySave = JSON.parse(savedRaw);
    delete legacySave.infrastructureGraph;
    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        const loaded = legacyRuntime.api.loadNow();
        const policy = legacyRuntime.api.infrastructureForSave();
        const snapshot = legacyRuntime.api.infrastructureSnapshot();
        legacy = {
            loaded,
            policy,
            snapshot,
            validation: legacyRuntime.api.validateInfrastructureSnapshot(snapshot)
        };
    } finally {
        legacyRuntime.dom.window.close();
    }

    const corruptSave = JSON.parse(savedRaw);
    corruptSave.infrastructureGraph.networkHash = 'fnv1a32:badc0ffe';
    const corruptRuntime = createRuntime(seed >>> 0);
    let corrupt;
    try {
        corruptRuntime.api.putSavedRaw(JSON.stringify(corruptSave));
        const loaded = corruptRuntime.api.loadNow();
        const policy = corruptRuntime.api.infrastructureForSave();
        const snapshot = corruptRuntime.api.infrastructureSnapshot();
        corrupt = {
            loaded,
            policy,
            snapshot,
            validation: corruptRuntime.api.validateInfrastructureSnapshot(snapshot)
        };
    } finally {
        corruptRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'world.infrastructureGraph': false }
        });
        const snapshot = disabledRuntime.api.infrastructureSnapshot();
        disabled = {
            snapshot,
            validation: disabledRuntime.api.validateInfrastructureSnapshot(snapshot),
            damage: disabledRuntime.api.infrastructureSetDamage('corridor:land:0:1', 10000),
            corridorIds: disabledRuntime.api.infrastructureCorridorIds('region:0'),
            worldValidation: disabledRuntime.api.validateWorldV2(disabledRuntime.api.worldV2())
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const normalOn = runStorySimulation({
        seed,
        seconds: 60,
        featureFlags: { 'economy.tradeLogistics': false }
    });
    const normalOff = runStorySimulation({
        seed,
        seconds: 60,
        featureFlags: {
            'world.infrastructureGraph': false,
            'economy.tradeLogistics': false
        }
    });
    return {
        main,
        restored,
        legacy,
        corrupt,
        disabled,
        ab: {
            onHash: normalOn.stateHash,
            offHash: normalOff.stateHash,
            changed: normalOn.stateHash !== normalOff.stateHash,
            onMigrationValidation: normalOn.humanMigrationValidation,
            offMigrationValidation: normalOff.humanMigrationValidation,
            onMigrationSummary: normalOn.humanMigrationSummary,
            offMigrationSummary: normalOff.humanMigrationSummary
        }
    };
}

function probeResourceTaxonomy(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main;
    let savedRaw;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = runtime.api.state();
        const beforeHash = hashSnapshot(stateSnapshot(story));
        const snapshot = runtime.api.resourceCatalogSnapshot();
        const validation = runtime.api.validateResourceCatalog(snapshot);
        const world = runtime.api.worldV2();
        const worldValidation = runtime.api.validateWorldV2(world);
        const legacyFixture = { oil: 123.25, manpower: 456.5, points: 789.75 };
        const canonicalView = runtime.api.resourceLegacyToCanonical(legacyFixture);
        const roundTrip = runtime.api.resourceCanonicalToLegacy(canonicalView, legacyFixture);
        const afterHash = hashSnapshot(stateSnapshot(story));
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        const savedPayload = JSON.parse(savedRaw);
        main = {
            beforeHash,
            afterHash,
            uiNeutral: beforeHash === afterHash,
            snapshot,
            validation,
            worldValidation,
            worldDiagnostics: world.diagnostics.resourceTaxonomy,
            legacyFixture,
            canonicalView,
            roundTrip,
            invalid: {
                duplicate: runtime.api.resourceCatalogInvalidCase('duplicate'),
                producer: runtime.api.resourceCatalogInvalidCase('producer'),
                consumer: runtime.api.resourceCatalogInvalidCase('consumer'),
                unit: runtime.api.resourceCatalogInvalidCase('unit'),
                shortage: runtime.api.resourceCatalogInvalidCase('shortage'),
                hash: runtime.api.resourceCatalogInvalidCase('hash'),
                unknown: runtime.api.resourceCatalogInvalidCase('unknown'),
                legacyMode: runtime.api.resourceCatalogInvalidCase('legacy-mode')
            },
            savedPolicy: savedPayload.resourceTaxonomy,
            compactBytes: JSON.stringify(savedPayload.resourceTaxonomy).length,
            fullCatalogBytes: JSON.stringify(snapshot).length,
            legacyStateResources: story.states.map(state => Object.assign({}, state.res))
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const policy = restoredRuntime.api.resourceTaxonomyForSave();
        const snapshot = restoredRuntime.api.resourceCatalogSnapshot();
        restored = {
            loaded,
            policy,
            snapshot,
            validation: restoredRuntime.api.validateResourceCatalog(snapshot),
            exactPolicy: JSON.stringify(policy) === JSON.stringify(main.savedPolicy),
            resourcesPreserved: JSON.stringify(restoredRuntime.api.state().states.map(state => state.res))
                === JSON.stringify(main.legacyStateResources)
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const legacySave = JSON.parse(savedRaw);
    delete legacySave.resourceTaxonomy;
    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        const loaded = legacyRuntime.api.loadNow();
        const snapshot = legacyRuntime.api.resourceCatalogSnapshot();
        legacy = {
            loaded,
            snapshot,
            validation: legacyRuntime.api.validateResourceCatalog(snapshot),
            resourcesPreserved: JSON.stringify(legacyRuntime.api.state().states.map(state => state.res))
                === JSON.stringify(main.legacyStateResources)
        };
    } finally {
        legacyRuntime.dom.window.close();
    }

    const corruptSave = JSON.parse(savedRaw);
    corruptSave.resourceTaxonomy.catalogHash = 'fnv1a32:badc0ffe';
    const corruptRuntime = createRuntime(seed >>> 0);
    let corrupt;
    try {
        corruptRuntime.api.putSavedRaw(JSON.stringify(corruptSave));
        const loaded = corruptRuntime.api.loadNow();
        const snapshot = corruptRuntime.api.resourceCatalogSnapshot();
        corrupt = {
            loaded,
            snapshot,
            validation: corruptRuntime.api.validateResourceCatalog(snapshot),
            resourcesPreserved: JSON.stringify(corruptRuntime.api.state().states.map(state => state.res))
                === JSON.stringify(main.legacyStateResources)
        };
    } finally {
        corruptRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'economy.resourceTaxonomy': false }
        });
        const snapshot = disabledRuntime.api.resourceCatalogSnapshot();
        const world = disabledRuntime.api.worldV2();
        disabled = {
            snapshot,
            validation: disabledRuntime.api.validateResourceCatalog(snapshot),
            worldValidation: disabledRuntime.api.validateWorldV2(world),
            diagnostics: world.diagnostics.resourceTaxonomy
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const normalOn = runStorySimulation({
        seed,
        seconds: 60,
        featureFlags: { 'economy.regionalStocks': false }
    });
    const normalOff = runStorySimulation({
        seed,
        seconds: 60,
        featureFlags: {
            'economy.resourceTaxonomy': false,
            'economy.regionalStocks': false
        }
    });
    return {
        main,
        restored,
        legacy,
        corrupt,
        disabled,
        ab: {
            onHash: normalOn.stateHash,
            offHash: normalOff.stateHash,
            equal: normalOn.stateHash === normalOff.stateHash
        }
    };
}

function probeProductionSectors(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main;
    let savedRaw;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = runtime.api.state();
        const beforeHash = hashSnapshot(stateSnapshot(story));
        const snapshot = runtime.api.productionCatalogSnapshot();
        const validation = runtime.api.validateProductionCatalog(snapshot);
        const world = runtime.api.worldV2();
        const worldValidation = runtime.api.validateWorldV2(world);
        const abundant = {
            food: 1000,
            energy: 1000,
            raw_materials: 1000,
            industrial_parts: 1000,
            electronics: 1000,
            military_supplies: 1000,
            labor: 1000,
            capital: 1000
        };
        const endowments = {
            arable_capacity: 1000,
            energy_potential: 1000,
            mineral_reserve: 1000
        };
        const ready = {};
        for (const sector of snapshot.sectors) {
            ready[sector.id] = runtime.api.productionEvaluate(sector.id, {
                requestedCycles: 2,
                capacityUnits: 2,
                efficiencyBps: 10000,
                availableQuantities: abundant,
                endowments
            });
        }
        const constrainedInputs = Object.assign({}, abundant, { raw_materials: 0.75 });
        const constrainedBefore = JSON.stringify(constrainedInputs);
        const partial = runtime.api.productionEvaluate('civil_industry', {
            requestedCycles: 4,
            capacityUnits: 10,
            efficiencyBps: 10000,
            availableQuantities: constrainedInputs,
            endowments
        });
        const partialAgain = runtime.api.productionEvaluate('civil_industry', {
            requestedCycles: 4,
            capacityUnits: 10,
            efficiencyBps: 10000,
            availableQuantities: constrainedInputs,
            endowments
        });
        const blocked = runtime.api.productionEvaluate('advanced_tech', {
            requestedCycles: 2,
            capacityUnits: 2,
            efficiencyBps: 10000,
            availableQuantities: {},
            endowments: {}
        });
        const capacityLimited = runtime.api.productionEvaluate('defense_industry', {
            requestedCycles: 4,
            capacityUnits: 1,
            efficiencyBps: 5000,
            availableQuantities: abundant,
            endowments
        });
        const unknownSector = runtime.api.productionEvaluate('unknown', {
            requestedCycles: 1,
            capacityUnits: 1,
            availableQuantities: abundant,
            endowments
        });
        const invalidRequest = runtime.api.productionEvaluate('agriculture', {
            requestedCycles: -1,
            capacityUnits: 1,
            availableQuantities: abundant,
            endowments
        });
        const afterHash = hashSnapshot(stateSnapshot(story));
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        const savedPayload = JSON.parse(savedRaw);
        main = {
            beforeHash,
            afterHash,
            stateNeutral: beforeHash === afterHash,
            snapshot,
            validation,
            worldValidation,
            worldDiagnostics: world.diagnostics.productionSectors,
            ready,
            partial,
            deterministicProposal: JSON.stringify(partial) === JSON.stringify(partialAgain),
            inputImmutable: constrainedBefore === JSON.stringify(constrainedInputs),
            blocked,
            capacityLimited,
            unknownSector,
            invalidRequest,
            invalid: {
                duplicate: runtime.api.productionCatalogInvalidCase('duplicate'),
                unknownResource: runtime.api.productionCatalogInvalidCase('unknown-resource'),
                unit: runtime.api.productionCatalogInvalidCase('unit'),
                quantity: runtime.api.productionCatalogInvalidCase('quantity'),
                endowment: runtime.api.productionCatalogInvalidCase('endowment'),
                exNihilo: runtime.api.productionCatalogInvalidCase('ex-nihilo'),
                massGain: runtime.api.productionCatalogInvalidCase('mass-gain'),
                producer: runtime.api.productionCatalogInvalidCase('producer'),
                resourceLink: runtime.api.productionCatalogInvalidCase('resource-link'),
                hash: runtime.api.productionCatalogInvalidCase('hash')
            },
            savedPolicy: savedPayload.productionSectors,
            compactBytes: JSON.stringify(savedPayload.productionSectors).length,
            fullCatalogBytes: JSON.stringify(snapshot).length,
            legacyStateResources: story.states.map(state => Object.assign({}, state.res))
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const policy = restoredRuntime.api.productionForSave();
        const snapshot = restoredRuntime.api.productionCatalogSnapshot();
        restored = {
            loaded,
            policy,
            snapshot,
            validation: restoredRuntime.api.validateProductionCatalog(snapshot),
            exactPolicy: JSON.stringify(policy) === JSON.stringify(main.savedPolicy),
            resourcesPreserved: JSON.stringify(restoredRuntime.api.state().states.map(state => state.res))
                === JSON.stringify(main.legacyStateResources)
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const legacySave = JSON.parse(savedRaw);
    delete legacySave.productionSectors;
    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        const loaded = legacyRuntime.api.loadNow();
        const snapshot = legacyRuntime.api.productionCatalogSnapshot();
        legacy = {
            loaded,
            snapshot,
            validation: legacyRuntime.api.validateProductionCatalog(snapshot),
            resourcesPreserved: JSON.stringify(legacyRuntime.api.state().states.map(state => state.res))
                === JSON.stringify(main.legacyStateResources)
        };
    } finally {
        legacyRuntime.dom.window.close();
    }

    const corruptSave = JSON.parse(savedRaw);
    corruptSave.productionSectors.catalogHash = 'fnv1a32:badc0ffe';
    const corruptRuntime = createRuntime(seed >>> 0);
    let corrupt;
    try {
        corruptRuntime.api.putSavedRaw(JSON.stringify(corruptSave));
        const loaded = corruptRuntime.api.loadNow();
        const snapshot = corruptRuntime.api.productionCatalogSnapshot();
        corrupt = {
            loaded,
            snapshot,
            validation: corruptRuntime.api.validateProductionCatalog(snapshot),
            resourcesPreserved: JSON.stringify(corruptRuntime.api.state().states.map(state => state.res))
                === JSON.stringify(main.legacyStateResources)
        };
    } finally {
        corruptRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'economy.productionSectors': false }
        });
        const snapshot = disabledRuntime.api.productionCatalogSnapshot();
        const world = disabledRuntime.api.worldV2();
        disabled = {
            snapshot,
            validation: disabledRuntime.api.validateProductionCatalog(snapshot),
            evaluation: disabledRuntime.api.productionEvaluate('agriculture', {
                requestedCycles: 1,
                capacityUnits: 1,
                availableQuantities: {},
                endowments: {}
            }),
            worldValidation: disabledRuntime.api.validateWorldV2(world),
            diagnostics: world.diagnostics.productionSectors
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const normalOn = runStorySimulation({
        seed,
        seconds: 60,
        featureFlags: { 'economy.regionalStocks': false }
    });
    const normalOff = runStorySimulation({
        seed,
        seconds: 60,
        featureFlags: {
            'economy.productionSectors': false,
            'economy.regionalStocks': false
        }
    });
    return {
        main,
        restored,
        legacy,
        corrupt,
        disabled,
        ab: {
            onHash: normalOn.stateHash,
            offHash: normalOff.stateHash,
            equal: normalOn.stateHash === normalOff.stateHash
        }
    };
}

function probePeacefulDiplomacy(seed = 2032) {
    const treatyCounts = relations => Object.values(relations || {}).reduce((counts, relation) => {
        const treaty = relation && relation.treaty || 'missing';
        counts[treaty] = (counts[treaty] || 0) + 1;
        return counts;
    }, {});
    const runtime = createRuntime(seed >>> 0);
    let main;
    let savedRaw;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const initialRelations = runtime.api.diplomacySnapshot();
        const ownersBefore = runtime.api.state().nodes.map(node => node.owner);
        runtime.api.setTreaty(0, 1, 'truce', 0.001, {
            reason: 'probe.truce',
            silent: true
        });
        runtime.api.advance(0.25);
        const expiredTreaty = runtime.api.treaty(0, 1);
        runtime.api.advance(119.75);
        const finalRelations = runtime.api.diplomacySnapshot();
        const ownersAfter = runtime.api.state().nodes.map(node => node.owner);
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        main = {
            initialCount: Object.keys(initialRelations).length,
            initialTreaties: treatyCounts(initialRelations),
            initialAllNonHostile: runtime.api.state().states.every(a => runtime.api.state().states.every(
                b => a.id === b.id || !runtime.api.isHostile(a.id, b.id)
            )),
            expiredTreaty,
            finalTreaties: treatyCounts(finalRelations),
            ownersStable: JSON.stringify(ownersBefore) === JSON.stringify(ownersAfter),
            ownerChangeEvents: runtime.api.telemetry().counters['territory.owner_changed'] || 0,
            relations: finalRelations
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const relations = restoredRuntime.api.diplomacySnapshot();
        restored = {
            loaded,
            relationCount: Object.keys(relations).length,
            treaties: treatyCounts(relations),
            exact: JSON.stringify(relations) === JSON.stringify(main.relations)
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'diplomacy.peacefulStart': false }
        });
        const relations = disabledRuntime.api.diplomacySnapshot();
        disabled = {
            relationCount: Object.keys(relations).length,
            treaties: treatyCounts(relations),
            hostile: disabledRuntime.api.isHostile(0, 1)
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    // A/B PENCERESI 120 -> 240 sn. Bu bir gevsetme DEGIL, olculmus tempo degisiminin yansimasi:
    // alti bina + on kosul zinciri (fabrika kisla ister, topcu parki fabrika ister) erken yatirimi
    // boluyor ve ilk fetih 120 sn'nin otesine kayiyor. OLCULDU (tohum 2032): 120sn'de 0 fetih,
    // 240sn'de 2 fetih; baris kolu 240 sn'de de 0'da kaliyor. Yani A/B hala TEMIZ ayrisiyor —
    // pencere dar oldugu icin iki kol da 0 gorunuyor ve karsi-test ayirt edemez hale geliyordu.
    const AB_SANIYE = 240;
    const on = runStorySimulation({
        seed,
        seconds: AB_SANIYE,
        featureFlags: { 'diplomacy.peacefulStart': true }
    });
    const off = runStorySimulation({
        seed,
        seconds: AB_SANIYE,
        featureFlags: { 'diplomacy.peacefulStart': false }
    });
    return {
        main,
        restored,
        disabled,
        ab: {
            onHash: on.stateHash,
            offHash: off.stateHash,
            changed: on.stateHash !== off.stateHash,
            onTerritory: on.final.territoryByState,
            offTerritory: off.final.territoryByState,
            onActiveStates: on.final.activeStates,
            offActiveStates: off.final.activeStates,
            onOwnerChanges: on.telemetry.counters['territory.owner_changed'] || 0,
            offOwnerChanges: off.telemetry.counters['territory.owner_changed'] || 0
        }
    };
}

function probeRegionalEconomy(seed = 2032) {
    const conservationDelta = (initial, final, totals) => Object.fromEntries(
        Object.keys(initial).sort().map(resourceId => {
            const expected = (Number(initial[resourceId]) || 0)
                + (Number(totals.externalInflow[resourceId]) || 0)
                + (Number(totals.cohortLaborSupply && totals.cohortLaborSupply[resourceId]) || 0)
                + (Number(totals.financialBridgeInflow && totals.financialBridgeInflow[resourceId]) || 0)
                + (Number(totals.produced[resourceId]) || 0)
                - (Number(totals.consumed[resourceId]) || 0)
                - (Number(totals.decayed[resourceId]) || 0)
                - (Number(totals.financialBridgeOutflow && totals.financialBridgeOutflow[resourceId]) || 0);
            const delta = Math.round(((Number(final[resourceId]) || 0) - expected) * 1e6) / 1e6;
            return [resourceId, Object.is(delta, -0) ? 0 : delta];
        })
    );
    const runtime = createRuntime(seed >>> 0);
    let main;
    let savedRaw;
    try {
        runtime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            // Faz 17'nin kaynak korunumu sözleşmesi, sonraki fazların satış
            // mutabakatından bağımsız ölçülmelidir. Varsayılan oyun akışı ayrı
            // uçtan uca simülasyonlarda bütün özellikler açıkken sınanır.
            featureFlags: { 'economy.saleSettlement': false }
        });
        const story = runtime.api.state();
        const legacyResourcesBefore = story.states.map(state => Object.assign({}, state.res));
        // The Phase 17 contract must test shortage recording explicitly, not
        // assume that a normally calibrated first tick always happens to be
        // short. Remove food and food capacity from one deterministic region
        // before the conservation baseline is captured.
        const shortageNode = story.nodes.slice().sort((a, b) => Number(a.id) - Number(b.id))[0];
        const shortageRegionId = `region:${Number(shortageNode.id)}`;
        const shortageRegion = story.regionalEconomy.regions[shortageRegionId];
        runtime.api.regionalStockDelta(
            shortageRegionId,
            'food',
            -Math.max(0, Number(shortageRegion.stocks.food) || 0),
            { type: 'TEST_FIXTURE', source: 'probe.visible-shortage' }
        );
        shortageRegion.sectorCapacity.agriculture = 0;
        const initialSummary = runtime.api.regionalSummary();
        const tick = runtime.api.regionalTick(4);
        const ledger = runtime.api.regionalLedger();
        const validation = runtime.api.validateRegionalLedger(ledger, { checkNodeMirrors: true });
        const finalSummary = runtime.api.regionalSummary();
        const world = runtime.api.worldV2();
        const worldValidation = runtime.api.validateWorldV2(world);
        const ownNode = story.nodes.find(node => node.owner === story.playerStateId);
        const foreignNode = story.nodes.find(node => node.owner !== story.playerStateId);
        const ownDossier = runtime.api.cityDossierBuild(ownNode.id);
        const foreignDossier = runtime.api.cityDossierBuild(foreignNode.id);
        const capsule = runtime.api.aggregationCapsule(ownNode.id);
        const capsuleValidation = runtime.api.validateAggregationCapsule(capsule);
        const initialStockTotals = initialSummary.stockTotals;
        const finalStockTotals = finalSummary.stockTotals;
        const stockConservationDelta = conservationDelta(
            initialStockTotals,
            finalStockTotals,
            finalSummary.flowTotals
        );
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        const savedPayload = JSON.parse(savedRaw);
        main = {
            initialSummary,
            finalSummary,
            tick,
            ledger,
            validation,
            worldValidation,
            worldDiagnostics: world.diagnostics.regionalEconomy,
            stockConservationDelta,
            legacyResourcesPreserved: JSON.stringify(story.states.map(state => state.res))
                === JSON.stringify(legacyResourcesBefore),
            ownDossier,
            foreignDossier,
            capsule,
            capsuleValidation,
            capsuleStocksMatch: JSON.stringify(capsule.payload.stocks)
                === JSON.stringify(runtime.api.regionalRegionView(ownNode.id).stocks),
            invalid: {
                negative: runtime.api.regionalInvalidCase('negative'),
                missingRegion: runtime.api.regionalInvalidCase('missing-region'),
                policy: runtime.api.regionalInvalidCase('policy'),
                topology: runtime.api.regionalInvalidCase('topology'),
                missingResource: runtime.api.regionalInvalidCase('missing-resource')
            },
            savedLedger: savedPayload.regionalEconomy,
            legacyStateResources: legacyResourcesBefore
        };
    } finally {
        runtime.dom.window.close();
    }

    const atomicRuntime = createRuntime(seed >>> 0);
    let atomic;
    try {
        atomicRuntime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'economy.saleSettlement': false }
        });
        const ledger = atomicRuntime.api.regionalLedger();
        const regionId = Object.keys(ledger.regions).find(id => ledger.regions[id].sectorCapacity.civil_industry > 0);
        for (const resourceId of ['energy', 'raw_materials', 'industrial_parts', 'electronics', 'military_supplies', 'labor', 'capital']) {
            const before = atomicRuntime.api.regionalRegionView(regionId).stocks[resourceId];
            atomicRuntime.api.regionalStockDelta(regionId, resourceId, 1000 - before, {
                type: 'TEST_FIXTURE',
                source: 'probe.atomic'
            });
        }
        const beforeView = atomicRuntime.api.regionalRegionView(regionId);
        const proposal = atomicRuntime.api.productionEvaluate('civil_industry', {
            requestedCycles: 1,
            capacityUnits: 1,
            efficiencyBps: 10000,
            availableQuantities: beforeView.stocks,
            endowments: beforeView.endowments
        });
        const validCommit = atomicRuntime.api.regionalCommitProduction(regionId, proposal);
        const afterValid = atomicRuntime.api.regionalRegionView(regionId);
        const tamperProposal = atomicRuntime.api.productionEvaluate('civil_industry', {
            requestedCycles: 1,
            capacityUnits: 1,
            efficiencyBps: 10000,
            availableQuantities: afterValid.stocks,
            endowments: afterValid.endowments
        });
        const beforeTamper = JSON.stringify(atomicRuntime.api.regionalRegionView(regionId));
        const tamperedCommit = atomicRuntime.api.regionalTamperedCommit(regionId, tamperProposal);
        const tamperAtomic = beforeTamper === JSON.stringify(atomicRuntime.api.regionalRegionView(regionId));
        const staleProposal = atomicRuntime.api.productionEvaluate('civil_industry', {
            requestedCycles: 1,
            capacityUnits: 1,
            efficiencyBps: 10000,
            availableQuantities: afterValid.stocks,
            endowments: afterValid.endowments
        });
        const rawBeforeZero = atomicRuntime.api.regionalRegionView(regionId).stocks.raw_materials;
        atomicRuntime.api.regionalStockDelta(regionId, 'raw_materials', -rawBeforeZero, {
            type: 'TEST_FIXTURE',
            source: 'probe.insufficient'
        });
        const beforeStale = JSON.stringify(atomicRuntime.api.regionalRegionView(regionId));
        const staleCommit = atomicRuntime.api.regionalCommitProduction(regionId, staleProposal);
        const staleAtomic = beforeStale === JSON.stringify(atomicRuntime.api.regionalRegionView(regionId));

        const foodBefore = atomicRuntime.api.regionalRegionView(regionId).stocks.food;
        atomicRuntime.api.regionalStockDelta(regionId, 'food', 10 - foodBefore, {
            type: 'TEST_FIXTURE',
            source: 'probe.priority'
        });
        const allocation = atomicRuntime.api.regionalAllocateDemands(regionId, [
            {
                id: 'demand:test:household:food',
                consumerType: 'HOUSEHOLDS',
                resourceId: 'food',
                quantity: 8,
                priority: 100,
                minFillBps: 8500,
                mayUseReserve: true,
                reason: 'TEST_BASIC_NEED'
            },
            {
                id: 'demand:test:company:food',
                consumerType: 'COMPANIES',
                resourceId: 'food',
                quantity: 8,
                priority: 70,
                minFillBps: 6000,
                mayUseReserve: false,
                reason: 'TEST_LOW_PRIORITY'
            }
        ]);
        const priorityFinal = atomicRuntime.api.regionalRegionView(regionId);
        atomicRuntime.api.regionalStockDelta(regionId, 'food', 100, {
            type: 'TEST_FIXTURE',
            source: 'probe.shortage-resolution'
        });
        const resolvedAllocation = atomicRuntime.api.regionalAllocateDemands(regionId, [{
            id: 'demand:test:company:food:resolved',
            consumerType: 'COMPANIES',
            resourceId: 'food',
            quantity: 1,
            priority: 70,
            minFillBps: 6000,
            mayUseReserve: false,
            reason: 'TEST_LOW_PRIORITY'
        }]);
        const resolvedShortage = atomicRuntime.api.regionalRegionView(regionId).shortages
            .find(item => item.consumerType === 'COMPANIES' && item.resourceId === 'food');
        atomic = {
            regionId,
            proposal,
            validCommit,
            beforeView,
            afterValid,
            expectedRawAfter: Math.round((beforeView.stocks.raw_materials - 1.5) * 1e6) / 1e6,
            expectedPartsAfter: Math.round((beforeView.stocks.industrial_parts + 1) * 1e6) / 1e6,
            tamperedCommit,
            tamperAtomic,
            staleCommit,
            staleAtomic,
            allocation,
            priorityFinal,
            resolvedAllocation,
            resolvedShortage
        };
    } finally {
        atomicRuntime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const ledger = restoredRuntime.api.regionalLedger();
        restored = {
            loaded,
            ledger,
            validation: restoredRuntime.api.validateRegionalLedger(ledger, { checkNodeMirrors: true }),
            exactLedger: JSON.stringify(ledger) === JSON.stringify(main.savedLedger),
            resourcesPreserved: JSON.stringify(restoredRuntime.api.state().states.map(state => state.res))
                === JSON.stringify(main.legacyStateResources)
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const legacySave = JSON.parse(savedRaw);
    delete legacySave.regionalEconomy;
    for (const node of legacySave.nodes) delete node.stocks;
    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        const loaded = legacyRuntime.api.loadNow();
        const ledger = legacyRuntime.api.regionalLedger();
        legacy = {
            loaded,
            ledger,
            validation: legacyRuntime.api.validateRegionalLedger(ledger, { checkNodeMirrors: true }),
            resourcesPreserved: JSON.stringify(legacyRuntime.api.state().states.map(state => state.res))
                === JSON.stringify(main.legacyStateResources)
        };
    } finally {
        legacyRuntime.dom.window.close();
    }

    const corruptSave = JSON.parse(savedRaw);
    const corruptRegionId = Object.keys(corruptSave.regionalEconomy.regions)[0];
    corruptSave.regionalEconomy.regions[corruptRegionId].stocks.food = -1;
    const corruptRuntime = createRuntime(seed >>> 0);
    let corrupt;
    try {
        corruptRuntime.api.putSavedRaw(JSON.stringify(corruptSave));
        const loaded = corruptRuntime.api.loadNow();
        const ledger = corruptRuntime.api.regionalLedger();
        corrupt = {
            loaded,
            ledger,
            validation: corruptRuntime.api.validateRegionalLedger(ledger, { checkNodeMirrors: true }),
            resourcesPreserved: JSON.stringify(corruptRuntime.api.state().states.map(state => state.res))
                === JSON.stringify(main.legacyStateResources)
        };
    } finally {
        corruptRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'economy.regionalStocks': false }
        });
        const world = disabledRuntime.api.worldV2();
        disabled = {
            summary: disabledRuntime.api.regionalSummary(),
            tick: disabledRuntime.api.regionalTick(4),
            nodeStocksPresent: disabledRuntime.api.state().nodes.some(node => node.stocks != null),
            worldValidation: disabledRuntime.api.validateWorldV2(world),
            diagnostics: world.diagnostics.regionalEconomy
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const normalOn = runStorySimulation({
        seed,
        seconds: 60,
        featureFlags: { 'economy.tradeLogistics': false }
    });
    const normalOff = runStorySimulation({
        seed,
        seconds: 60,
        featureFlags: {
            'economy.regionalStocks': false,
            'economy.tradeLogistics': false
        }
    });
    const stripRegional = snapshot => {
        const copy = JSON.parse(JSON.stringify(snapshot));
        delete copy.regionalEconomy;
        // Faz 24 yaşam koşulları bölgesel tahsislerin türetilmiş yeni çıktısıdır;
        // eski oynanış eşitliği karşılaştırmasına dahil edilmez.
        delete copy.needsWelfare;
        // Faz 25 de yalnız Faz 24 sonucunun türetilmiş, salt-okunur hafızasıdır.
        delete copy.publicOpinion;
        // Faz 26, Faz 25 kapandiginda bagimlilik geregi kapanan yeni turetilmis
        // durumdur; Faz 17'nin eski oynanis esitligi karsilastirmasina girmez.
        delete copy.collectiveAction;
        // Faz 27 de yukaridaki zincirin ardilidir; bolgesel ekonomi kapaliyken
        // bagimlilik geregi kapanan bu defter eski Faz 17 fiziksel durumuna ait degildir.
        delete copy.humanMigration;
        // Faz 28-31 aynı toplumsal kanıt zincirinin yönetişim çıktılarıdır.
        // Bölgesel stok kapısı kapandığında bağımlılık çözümleyicisi bu defterleri de
        // kapatır; Faz 17'nin eski fiziksel sonuç karşılaştırmasına dahil edilmezler.
        delete copy.powerCenters;
        delete copy.institutions;
        delete copy.stateCapacity;
        delete copy.elections;
        return copy;
    };
    return {
        main,
        atomic,
        restored,
        legacy,
        corrupt,
        disabled,
        ab: {
            onHash: normalOn.stateHash,
            offHash: normalOff.stateHash,
            regionalChanged: normalOn.stateHash !== normalOff.stateHash,
            legacyOnHash: hashSnapshot(stripRegional(normalOn.snapshot)),
            legacyOffHash: hashSnapshot(stripRegional(normalOff.snapshot)),
            legacyGameplayEqual: hashSnapshot(stripRegional(normalOn.snapshot))
                === hashSnapshot(stripRegional(normalOff.snapshot))
        }
    };
}

function probeTradeLogistics(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main;
    let savedRaw;
    let legacyActiveRaw;
    try {
        runtime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            // Faz 18–20 lojistik/escrow sözleşmesi, Faz 22.1E'nin sahipli
            // fiziksel lot katmanından bağımsız sınanır. Faz 22.1E lot ve satış
            // korunumunu kendi probunda ve varsayılan uçtan uca koşuda sınar.
            featureFlags: { 'economy.saleSettlement': false }
        });
        const story = runtime.api.state();
        const sourceNode = story.nodes.find(node => (node.neighbors || []).some(
            neighborId => story.nodes[neighborId] && story.nodes[neighborId].owner === node.owner
        ));
        const targetNode = sourceNode && story.nodes[(sourceNode.neighbors || []).find(
            neighborId => story.nodes[neighborId] && story.nodes[neighborId].owner === sourceNode.owner
        )];
        if (!sourceNode || !targetNode) throw new Error('Ticaret probu için aynı devlete ait komşu bölge bulunamadı.');
        const sourceRegionId = `region:${sourceNode.id}`;
        const targetRegionId = `region:${targetNode.id}`;
        const countryId = `country:${sourceNode.owner}`;
        const sourceView = runtime.api.regionalRegionView(sourceRegionId);
        const targetBefore = runtime.api.regionalRegionView(targetRegionId).stocks.food;
        const sourceDesired = sourceView.safeTargets.food * 1.25 + 50;
        runtime.api.regionalStockDelta(sourceRegionId, 'food', sourceDesired - sourceView.stocks.food, {
            type: 'TEST_FIXTURE',
            source: 'probe.trade.dispatch'
        });
        const sourceBefore = runtime.api.regionalRegionView(sourceRegionId).stocks.food;
        const created = runtime.api.tradeCreateOrder({
            sourceRegionId,
            targetRegionId,
            resourceId: 'food',
            quantity: 10,
            source: 'TEST_MANUAL_CONTRACT'
        });
        const dispatched = created.ok ? runtime.api.tradeDispatchOrder(created.order.id, 10) : created;
        const sourceAfterDispatch = runtime.api.regionalRegionView(sourceRegionId).stocks.food;
        const targetAfterDispatch = runtime.api.regionalRegionView(targetRegionId).stocks.food;
        const shipment = dispatched.shipment;
        const titleBeforeDelivery = shipment && shipment.titleOwnerCountryId;
        const corridorId = shipment && shipment.corridorIds[0];
        const damage = runtime.api.infrastructureSetDamage(corridorId, 10000);
        const blockedTick = runtime.api.tradeTick(20, { autoBalance: false, dispatchOpen: false });
        const heldShipment = runtime.api.tradeLedger().shipments.find(item => item.id === shipment.id);
        const targetWhileHeld = runtime.api.regionalRegionView(targetRegionId).stocks.food;
        runtime.api.infrastructureSetDamage(corridorId, 0);
        for (let index = 0; index < 30; index++) {
            const live = runtime.api.tradeLedger().shipments.find(item => item.id === shipment.id);
            if (!live || live.status === 'DELIVERED') break;
            runtime.api.tradeTick(4, { autoBalance: false, dispatchOpen: false });
        }
        const deliveredShipment = runtime.api.tradeLedger().shipments.find(item => item.id === shipment.id);
        const sourceAfterDelivery = runtime.api.regionalRegionView(sourceRegionId).stocks.food;
        const targetAfterDelivery = runtime.api.regionalRegionView(targetRegionId).stocks.food;

        const alternateNode = story.nodes.find(node => node.owner === targetNode.owner
            && node.id !== sourceNode.id
            && node.id !== targetNode.id
            && runtime.api.infrastructureFindRoute(sourceRegionId, `region:${node.id}`, {
                modes: ['LAND', 'SEA'],
                authorizedCountryIds: [countryId]
            }).ok);
        if (!alternateNode) throw new Error('Ticaret yönlendirme probu için erişilebilir alternatif depo bulunamadı.');
        const alternateRegionId = `region:${alternateNode.id}`;
        const oldTargetBeforeRedirect = runtime.api.regionalRegionView(targetRegionId).stocks.food;
        const alternateBeforeRedirect = runtime.api.regionalRegionView(alternateRegionId).stocks.food;
        const replenishView = runtime.api.regionalRegionView(sourceRegionId);
        const replenishTarget = replenishView.safeTargets.food * 1.25 + 20;
        runtime.api.regionalStockDelta(sourceRegionId, 'food', replenishTarget - replenishView.stocks.food, {
            type: 'TEST_FIXTURE',
            source: 'probe.trade.redirect'
        });
        runtime.api.tradeTick(0.25, { autoBalance: false, dispatchOpen: false });
        const redirectOrder = runtime.api.tradeCreateOrder({
            sourceRegionId,
            targetRegionId,
            resourceId: 'food',
            quantity: 5,
            source: 'TEST_REDIRECT'
        });
        const redirectDispatch = runtime.api.tradeDispatchOrder(redirectOrder.order.id, 5);
        const redirect = runtime.api.tradeRedirectShipment(
            redirectDispatch.shipment.id,
            alternateRegionId,
            { authorizedByCountryId: countryId }
        );
        for (let index = 0; index < 40; index++) {
            const live = runtime.api.tradeLedger().shipments.find(item => item.id === redirectDispatch.shipment.id);
            if (!live || live.status === 'DELIVERED') break;
            runtime.api.tradeTick(4, { autoBalance: false, dispatchOpen: false });
        }
        const redirectedShipment = runtime.api.tradeLedger().shipments.find(
            item => item.id === redirectDispatch.shipment.id
        );
        const oldTargetAfterRedirect = runtime.api.regionalRegionView(targetRegionId).stocks.food;
        const alternateAfterRedirect = runtime.api.regionalRegionView(alternateRegionId).stocks.food;

        runtime.api.tradeTick(0.25, { autoBalance: false, dispatchOpen: false });
        const route = runtime.api.infrastructureFindRoute(sourceRegionId, targetRegionId, {
            modes: ['LAND', 'SEA'],
            authorizedCountryIds: [countryId]
        });
        const firstCorridor = runtime.api.infrastructureSnapshot().corridors.find(
            item => item.id === route.corridorIds[0]
        );
        const sharedCapacity = firstCorridor.effectiveCapacity;
        const capacitySource = runtime.api.regionalRegionView(sourceRegionId);
        const capacityStock = capacitySource.safeTargets.food * 1.25 + sharedCapacity * 2 + 5;
        runtime.api.regionalStockDelta(sourceRegionId, 'food', capacityStock - capacitySource.stocks.food, {
            type: 'TEST_FIXTURE',
            source: 'probe.trade.capacity'
        });
        const capacityOrderA = runtime.api.tradeCreateOrder({
            sourceRegionId, targetRegionId, resourceId: 'food', quantity: sharedCapacity, source: 'TEST_CAPACITY_A'
        });
        const capacityOrderB = runtime.api.tradeCreateOrder({
            sourceRegionId, targetRegionId, resourceId: 'food', quantity: sharedCapacity, source: 'TEST_CAPACITY_B'
        });
        const capacityDispatchA = runtime.api.tradeDispatchOrder(capacityOrderA.order.id, sharedCapacity);
        const capacityDispatchB = runtime.api.tradeDispatchOrder(capacityOrderB.order.id, sharedCapacity);

        runtime.api.tradeTick(0.25, { autoBalance: false, dispatchOpen: false });
        const borderSource = story.nodes.find(node => (node.neighbors || []).some(
            neighborId => story.nodes[neighborId] && story.nodes[neighborId].owner !== node.owner
        ));
        const borderTarget = borderSource && story.nodes[(borderSource.neighbors || []).find(
            neighborId => story.nodes[neighborId] && story.nodes[neighborId].owner !== borderSource.owner
        )];
        if (!borderSource || !borderTarget) throw new Error('Sahiplik devri probu için sınır komşusu bulunamadı.');
        const borderSourceId = `region:${borderSource.id}`;
        const borderTargetId = `region:${borderTarget.id}`;
        const borderSourceCountryId = `country:${borderSource.owner}`;
        const borderTargetCountryId = `country:${borderTarget.owner}`;
        const borderBuyerBudgetBefore = runtime.api.budgetCountryView(borderTargetCountryId);
        const borderSellerBudgetBefore = runtime.api.budgetCountryView(borderSourceCountryId);
        const borderStock = runtime.api.regionalRegionView(borderSourceId);
        const borderDesired = borderStock.safeTargets.food * 1.25 + 10;
        runtime.api.regionalStockDelta(borderSourceId, 'food', borderDesired - borderStock.stocks.food, {
            type: 'TEST_FIXTURE',
            source: 'probe.trade.title-transfer'
        });
        const borderOrder = runtime.api.tradeCreateOrder({
            sourceRegionId: borderSourceId,
            targetRegionId: borderTargetId,
            resourceId: 'food',
            quantity: 3,
            source: 'TEST_CROSS_BORDER'
        });
        if (!borderOrder.ok) {
            throw new Error(`Sınır ticareti test siparişi kurulamadı: ${JSON.stringify(borderOrder)}`);
        }
        const borderSellerCompanyId = borderOrder.order.sellerCompanyId;
        const borderSellerCompanyBefore = borderSellerCompanyId
            ? runtime.api.companyLedger().companies[borderSellerCompanyId]
            : null;
        const borderDispatch = runtime.api.tradeDispatchOrder(borderOrder.order.id, 3);
        if (!borderDispatch.ok) {
            throw new Error(`Sınır ticareti test sevkiyatı kurulamadı: ${JSON.stringify(borderDispatch)}`);
        }
        const borderBuyerBudgetReserved = runtime.api.budgetCountryView(borderTargetCountryId);
        const borderSellerBudgetReserved = runtime.api.budgetCountryView(borderSourceCountryId);
        const borderTitleBefore = borderDispatch.shipment.titleOwnerCountryId;
        runtime.api.saveNow();
        legacyActiveRaw = runtime.api.savedRaw();
        for (let index = 0; index < 20; index++) {
            const live = runtime.api.tradeLedger().shipments.find(item => item.id === borderDispatch.shipment.id);
            if (!live || live.status === 'DELIVERED') break;
            runtime.api.tradeTick(4, { autoBalance: false, dispatchOpen: false });
        }
        const borderDelivered = runtime.api.tradeLedger().shipments.find(
            item => item.id === borderDispatch.shipment.id
        );
        const borderBuyerBudgetAfter = runtime.api.budgetCountryView(borderTargetCountryId);
        const borderSellerBudgetAfter = runtime.api.budgetCountryView(borderSourceCountryId);
        const borderSellerCompanyAfter = borderSellerCompanyId
            ? runtime.api.companyLedger().companies[borderSellerCompanyId]
            : null;
        const borderSettlement = runtime.api.budgetLedger().settlements.find(
            item => item.id === borderDelivered.settlementReservationId
        );

        const ownDossier = runtime.api.cityDossierBuild(sourceNode.id);
        const foreignNode = story.nodes.find(node => node.owner !== story.playerStateId);
        const foreignDossier = runtime.api.cityDossierBuild(foreignNode.id);
        const validation = runtime.api.validateTradeLedger(runtime.api.tradeLedger());
        const summary = runtime.api.tradeSummary();
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        main = {
            sourceRegionId,
            targetRegionId,
            alternateRegionId,
            created,
            dispatched,
            sourceBefore,
            sourceAfterDispatch,
            sourceAfterDelivery,
            targetBefore,
            targetAfterDispatch,
            targetWhileHeld,
            targetAfterDelivery,
            titleBeforeDelivery,
            deliveredShipment,
            damage,
            blockedTick,
            heldShipment,
            redirect,
            redirectedShipment,
            oldTargetBeforeRedirect,
            oldTargetAfterRedirect,
            alternateBeforeRedirect,
            alternateAfterRedirect,
            sharedCapacity,
            capacityDispatchA,
            capacityDispatchB,
            borderSourceCountryId,
            borderTargetCountryId,
            borderBuyerBudgetBefore,
            borderSellerBudgetBefore,
            borderBuyerBudgetReserved,
            borderSellerBudgetReserved,
            borderBuyerBudgetAfter,
            borderSellerBudgetAfter,
            borderSellerCompanyId,
            borderSellerCompanyBefore,
            borderSellerCompanyAfter,
            borderSettlement,
            borderTitleBefore,
            borderDelivered,
            validation,
            summary,
            ownDossier,
            foreignDossier,
            invalid: {
                policy: runtime.api.tradeInvalidCase('policy'),
                network: runtime.api.tradeInvalidCase('network'),
                negative: runtime.api.tradeInvalidCase('negative'),
                cargo: runtime.api.tradeInvalidCase('cargo'),
                route: runtime.api.tradeInvalidCase('route')
            },
            savedLedger: JSON.parse(savedRaw).tradeLogistics,
            savedRegionalEconomy: JSON.parse(savedRaw).regionalEconomy
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const ledger = restoredRuntime.api.tradeLedger();
        restored = {
            loaded,
            ledger,
            validation: restoredRuntime.api.validateTradeLedger(ledger),
            exactLedger: JSON.stringify(ledger) === JSON.stringify(main.savedLedger),
            regionalUnchanged: JSON.stringify(restoredRuntime.api.regionalLedger())
                === JSON.stringify(main.savedRegionalEconomy)
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const legacyActiveSave = JSON.parse(legacyActiveRaw);
    delete legacyActiveSave.stateBudget;
    const legacyActiveShipment = legacyActiveSave.tradeLogistics.shipments.find(
        item => item.id === main.borderDelivered.id
    );
    delete legacyActiveShipment.settlementReservationId;
    delete legacyActiveShipment.settlementAmount;
    delete legacyActiveShipment.priceQuote;
    const legacyActiveOrder = legacyActiveSave.tradeLogistics.orders.find(
        item => item.id === legacyActiveShipment.orderId
    );
    if (legacyActiveOrder) {
        legacyActiveOrder.settlementStatus = 'CLEARING_PENDING_PRICE';
        delete legacyActiveOrder.priceQuote;
    }
    legacyActiveSave.tradeLogistics.diagnostics.priceSettlementActive = false;
    const legacyActiveRuntime = createRuntime(seed >>> 0);
    let legacyActive;
    try {
        legacyActiveRuntime.api.putSavedRaw(JSON.stringify(legacyActiveSave));
        const loaded = legacyActiveRuntime.api.loadNow();
        const shipment = legacyActiveRuntime.api.tradeLedger().shipments.find(
            item => item.id === legacyActiveShipment.id
        );
        const settlement = shipment && legacyActiveRuntime.api.budgetLedger().settlements.find(
            item => item.id === shipment.settlementReservationId
        );
        legacyActive = {
            loaded,
            shipment,
            settlement,
            tradeValidation: legacyActiveRuntime.api.validateTradeLedger(legacyActiveRuntime.api.tradeLedger()),
            budgetValidation: legacyActiveRuntime.api.validateBudgetLedger(legacyActiveRuntime.api.budgetLedger()),
            diagnostics: legacyActiveRuntime.api.tradeLedger().diagnostics
        };
    } finally {
        legacyActiveRuntime.dom.window.close();
    }

    const legacySave = JSON.parse(savedRaw);
    delete legacySave.tradeLogistics;
    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        const loaded = legacyRuntime.api.loadNow();
        legacy = {
            loaded,
            ledger: legacyRuntime.api.tradeLedger(),
            validation: legacyRuntime.api.validateTradeLedger(legacyRuntime.api.tradeLedger()),
            regionalUnchanged: JSON.stringify(legacyRuntime.api.regionalLedger())
                === JSON.stringify(legacySave.regionalEconomy)
        };
    } finally {
        legacyRuntime.dom.window.close();
    }

    const corruptSave = JSON.parse(savedRaw);
    corruptSave.tradeLogistics.policyHash = 'fnv1a32:badc0ffe';
    const corruptRuntime = createRuntime(seed >>> 0);
    let corrupt;
    try {
        corruptRuntime.api.putSavedRaw(JSON.stringify(corruptSave));
        const loaded = corruptRuntime.api.loadNow();
        corrupt = {
            loaded,
            ledger: corruptRuntime.api.tradeLedger(),
            validation: corruptRuntime.api.validateTradeLedger(corruptRuntime.api.tradeLedger()),
            regionalUnchanged: JSON.stringify(corruptRuntime.api.regionalLedger())
                === JSON.stringify(corruptSave.regionalEconomy)
        };
    } finally {
        corruptRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'economy.tradeLogistics': false }
        });
        disabled = {
            summary: disabledRuntime.api.tradeSummary(),
            tick: disabledRuntime.api.tradeTick(4),
            ledger: disabledRuntime.api.tradeLedger()
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const on = runStorySimulation({ seed, seconds: 120 });
    const off = runStorySimulation({
        seed,
        seconds: 120,
        featureFlags: { 'economy.tradeLogistics': false }
    });
    return {
        main,
        restored,
        legacyActive,
        legacy,
        corrupt,
        disabled,
        ab: {
            onHash: on.stateHash,
            offHash: off.stateHash,
            changed: on.stateHash !== off.stateHash,
            onTrade: on.tradeSummary,
            offTrade: off.tradeSummary,
            onStocks: on.regionalSummary.stockTotals,
            offStocks: off.regionalSummary.stockTotals
        }
    };
}

function probeDomesticDistributionContract(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main;
    let savedRaw;
    try {
        runtime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'economy.saleSettlement': true }
        });
        const story = runtime.api.state();
        let selection = null;
        for (const sourceNode of story.nodes) {
            const countryId = `country:${sourceNode.owner}`;
            const candidates = story.nodes
                .filter(node => node.owner === sourceNode.owner && node.id !== sourceNode.id)
                .map(node => ({
                    node,
                    route: runtime.api.infrastructureFindRoute(
                        `region:${sourceNode.id}`,
                        `region:${node.id}`,
                        { modes: ['ENERGY'], authorizedCountryIds: [countryId] }
                    )
                }))
                .filter(candidate => candidate.route.ok
                    && candidate.route.corridorIds
                    && candidate.route.corridorIds.length);
            if (candidates.length >= 2) {
                selection = { sourceNode, countryId, targets: candidates.slice(0, 2) };
                break;
            }
        }
        if (!selection) {
            throw new Error('İç dağıtım probu için iki enerji bacaklı aynı ülke ağı bulunamadı.');
        }
        const sourceRegionId = `region:${selection.sourceNode.id}`;
        const targetRegionIds = selection.targets.map(candidate => `region:${candidate.node.id}`);
        const quantities = [3, 2];
        const sourceView = runtime.api.regionalRegionView(sourceRegionId);
        const desiredSourceStock = sourceView.safeTargets.energy + 50;
        runtime.api.regionalStockDelta(
            sourceRegionId,
            'energy',
            desiredSourceStock - sourceView.stocks.energy,
            { type: 'TEST_FIXTURE', source: 'probe.domestic-distribution' }
        );
        runtime.api.commerceReset({ backfilled: true });

        const physicalTotal = () => Object.values(runtime.api.regionalLedger().regions)
            .reduce((sum, region) => sum + Number(region.stocks.energy || 0), 0);
        const commerceTotal = () => runtime.api.commerceLedger().inventories
            .filter(lot => lot.resourceId === 'energy')
            .reduce((sum, lot) => sum + Number(lot.quantity || 0), 0);
        const sourceBefore = runtime.api.regionalRegionView(sourceRegionId).stocks.energy;
        const targetsBefore = targetRegionIds.map(
            regionId => runtime.api.regionalRegionView(regionId).stocks.energy
        );
        const physicalBefore = physicalTotal();
        const commerceBefore = commerceTotal();
        const spec = {
            sourceRegionId,
            resourceId: 'energy',
            exportReserveBps: 0,
            priority: 140,
            source: 'PROBE_DOMESTIC_DISTRIBUTION',
            legs: targetRegionIds.map((targetRegionId, index) => ({
                targetRegionId,
                quantity: quantities[index]
            }))
        };
        const admission = runtime.api.tradePlanDomesticDistribution(spec);
        const committed = runtime.api.tradeCommitDomesticDistribution(spec);
        const sourceAfterDispatch = runtime.api.regionalRegionView(sourceRegionId).stocks.energy;
        const targetsAfterDispatch = targetRegionIds.map(
            regionId => runtime.api.regionalRegionView(regionId).stocks.energy
        );
        const inTransitLedger = runtime.api.tradeLedger();
        const inTransitBatch = inTransitLedger.distributionBatches[0];
        const cargoReceipts = inTransitBatch.legs.map(leg => {
            const shipment = inTransitLedger.shipments.find(row => row.id === leg.shipmentId);
            const lots = runtime.api.commerceLedger().inventories.filter(
                lot => lot.regionId === `shipment:${shipment.id}`
                    && lot.resourceId === 'energy'
            );
            return {
                legId: leg.id,
                shipmentId: shipment.id,
                quantity: shipment.quantity,
                corridorIds: shipment.corridorIds,
                lotQuantity: round(lots.reduce(
                    (sum, lot) => sum + Number(lot.quantity || 0),
                    0
                )),
                ownerIds: [...new Set(lots.map(lot => lot.ownerId))].sort()
            };
        });
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();

        for (let index = 0; index < 80; index++) {
            const batch = runtime.api.tradeLedger().distributionBatches[0];
            if (batch.status === 'DELIVERED') break;
            runtime.api.tradeTick(4, { autoBalance: false, dispatchOpen: false });
        }
        const deliveredLedger = runtime.api.tradeLedger();
        const deliveredBatch = deliveredLedger.distributionBatches[0];
        const targetsAfterDelivery = targetRegionIds.map(
            regionId => runtime.api.regionalRegionView(regionId).stocks.energy
        );
        const physicalAfter = physicalTotal();
        const commerceAfter = commerceTotal();
        const foreignNode = story.nodes.find(node => node.owner !== selection.sourceNode.owner);
        const crossBorderPlan = runtime.api.tradePlanDomesticDistribution({
            sourceRegionId,
            resourceId: 'energy',
            legs: [
                { targetRegionId: targetRegionIds[0], quantity: 1 },
                { targetRegionId: `region:${foreignNode.id}`, quantity: 1 }
            ]
        });
        main = {
            sourceRegionId,
            targetRegionIds,
            quantities,
            admission,
            committed,
            sourceBefore,
            sourceAfterDispatch,
            targetsBefore,
            targetsAfterDispatch,
            targetsAfterDelivery,
            physicalBefore: round(physicalBefore),
            physicalAfter: round(physicalAfter),
            commerceBefore: round(commerceBefore),
            commerceAfter: round(commerceAfter),
            inTransitBatch,
            deliveredBatch,
            cargoReceipts,
            crossBorderPlan,
            tradeValidation: runtime.api.validateTradeLedger(deliveredLedger),
            commerceValidation: runtime.api.validateCommerceLedger(
                runtime.api.commerceLedger(),
                { checkPhysicalMirrors: true }
            ),
            invalidTotal: runtime.api.tradeInvalidCase('distribution-total'),
            summary: runtime.api.tradeSummary()
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        const saved = JSON.parse(savedRaw);
        restoredRuntime.api.putSavedRaw(savedRaw);
        restored = {
            loaded: restoredRuntime.api.loadNow(),
            tradeExact: false,
            commerceExact: false,
            tradeValidation: null,
            commerceValidation: null
        };
        restored.tradeExact = JSON.stringify(restoredRuntime.api.tradeLedger())
            === JSON.stringify(saved.tradeLogistics);
        restored.commerceExact = JSON.stringify(restoredRuntime.api.commerceLedger())
            === JSON.stringify(saved.companyEconomy.commerce);
        restored.tradeValidation = restoredRuntime.api.validateTradeLedger(
            restoredRuntime.api.tradeLedger()
        );
        restored.commerceValidation = restoredRuntime.api.validateCommerceLedger(
            restoredRuntime.api.commerceLedger(),
            { checkPhysicalMirrors: true }
        );
    } finally {
        restoredRuntime.dom.window.close();
    }
    return { main, restored };
}

function probeMarketPrices(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let savedRaw;
    let main;
    try {
        runtime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: {
                'economy.stateBudget': false,
                'economy.saleSettlement': false
            }
        });
        const story = runtime.api.state();
        runtime.api.regionalTick(4);
        runtime.api.tradeTick(4, { autoBalance: false, dispatchOpen: false });

        const sourceNode = story.nodes.find(node => (
            (node.neighbors || []).some(neighborId => story.nodes[neighborId]
                && story.nodes[neighborId].owner === node.owner)
        ));
        const targetNode = sourceNode && story.nodes[(sourceNode.neighbors || []).find(
            neighborId => story.nodes[neighborId] && story.nodes[neighborId].owner === sourceNode.owner
        )];
        if (!sourceNode || !targetNode) throw new Error('Faz 19 probu icin ayni ulkede bagli iki bolge bulunamadi.');
        const sourceRegionId = `region:${sourceNode.id}`;
        const targetRegionId = `region:${targetNode.id}`;
        const countryId = `country:${sourceNode.owner}`;

        const sourceView = runtime.api.regionalRegionView(sourceRegionId);
        const desiredSource = sourceView.safeTargets.food * 1.25 + 20;
        runtime.api.regionalStockDelta(sourceRegionId, 'food', desiredSource - sourceView.stocks.food, {
            type: 'TEST_FIXTURE',
            source: 'probe.market.route-risk'
        });
        const order = runtime.api.tradeCreateOrder({
            sourceRegionId,
            targetRegionId,
            resourceId: 'food',
            quantity: 5,
            source: 'TEST_MARKET_ROUTE_RISK'
        });
        if (!order.ok) {
            throw new Error(`Faz 19 rota-riski siparişi kurulamadı: ${JSON.stringify(order)}`);
        }
        const dispatch = runtime.api.tradeDispatchOrder(order.order.id, 5);
        if (!dispatch.ok) {
            throw new Error(`Faz 19 rota-riski sevkiyatı kurulamadı: ${JSON.stringify(dispatch)}`);
        }
        const corridorId = dispatch.shipment.corridorIds[0];
        runtime.api.infrastructureSetDamage(corridorId, 10000);
        runtime.api.tradeTick(20, { autoBalance: false, dispatchOpen: false });

        const regionalBefore = JSON.stringify(runtime.api.regionalLedger());
        const tradeBefore = JSON.stringify(runtime.api.tradeLedger());
        const legacyInflationBefore = JSON.stringify(story.states.map(state => state.inflation));
        const marketTick = runtime.api.marketTick(4);
        const regionalAfter = JSON.stringify(runtime.api.regionalLedger());
        const tradeAfter = JSON.stringify(runtime.api.tradeLedger());
        const legacyInflationAfter = JSON.stringify(story.states.map(state => state.inflation));
        const targetMarket = runtime.api.marketRegionView(targetRegionId);
        const targetFood = targetMarket.resources.food;
        const indicativeQuote = runtime.api.marketTradeQuote(sourceRegionId, targetRegionId, 'food', 5);
        const noRiskSignal = Object.assign({}, targetFood.signals, {
            inboundHeld: 0,
            routeDamageBps: 0
        });
        const noRiskEvaluation = runtime.api.marketEvaluatePrice('food', targetFood.previousIndex, noRiskSignal);
        const riskEvaluation = runtime.api.marketEvaluatePrice('food', targetFood.previousIndex, targetFood.signals);

        let alternating = 100;
        let alternatingMin = alternating;
        let alternatingMax = alternating;
        for (let index = 0; index < 200; index++) {
            const result = runtime.api.marketEvaluatePrice('food', alternating, {
                stockCoverageRatio: index % 2 ? 0.99 : 1.01,
                fillBps: 10000,
                flowGapRatio: 0,
                safeTarget: 100,
                requested: 10,
                inboundHeld: 0,
                routeDamageBps: 0
            });
            alternating = result.nextIndex;
            alternatingMin = Math.min(alternatingMin, alternating);
            alternatingMax = Math.max(alternatingMax, alternating);
        }
        const zeroStock = runtime.api.marketEvaluatePrice('food', 100, {
            stockCoverageRatio: 0,
            fillBps: 0,
            flowGapRatio: 1,
            safeTarget: 100,
            requested: 10,
            inboundHeld: 0,
            routeDamageBps: 0
        });
        const surplus = runtime.api.marketEvaluatePrice('food', 100, {
            stockCoverageRatio: 5,
            fillBps: 10000,
            flowGapRatio: -1,
            safeTarget: 100,
            requested: 10,
            inboundHeld: 0,
            routeDamageBps: 0
        });

        const ledger = runtime.api.marketLedger();
        const validation = runtime.api.validateMarketLedger(ledger);
        const world = runtime.api.worldV2();
        const worldValidation = runtime.api.validateWorldV2(world);
        const ownKnowledge = runtime.api.playerKnowledge(world, `country:${story.playerStateId}`);
        const ownRegion = ownKnowledge.regions.find(region => region.ownerId.value === `country:${story.playerStateId}`);
        const foreignRegion = ownKnowledge.regions.find(region => region.ownerId.value !== `country:${story.playerStateId}`);
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        main = {
            sourceRegionId,
            targetRegionId,
            countryId,
            marketTick,
            validation,
            worldValidation,
            summary: runtime.api.marketSummary(),
            targetFood,
            indicativeQuote,
            routeRiskIntegrated: {
                shipmentStatus: runtime.api.tradeLedger().shipments.find(item => item.id === dispatch.shipment.id).status,
                inboundHeld: targetFood.signals.inboundHeld,
                routeDamageBps: targetFood.signals.routeDamageBps,
                noRiskTarget: noRiskEvaluation.targetIndex,
                riskTarget: riskEvaluation.targetIndex
            },
            readOnly: {
                regionalUnchanged: regionalBefore === regionalAfter,
                tradeUnchanged: tradeBefore === tradeAfter,
                legacyInflationUnchanged: legacyInflationBefore === legacyInflationAfter
            },
            alternating: {
                final: alternating,
                min: alternatingMin,
                max: alternatingMax,
                spread: alternatingMax - alternatingMin
            },
            zeroStock,
            surplus,
            labor: targetMarket.resources.labor,
            capital: targetMarket.resources.capital,
            ownMarketFact: ownRegion.market,
            foreignMarketFact: foreignRegion.market,
            invalid: {
                policy: runtime.api.marketInvalidCase('policy'),
                network: runtime.api.marketInvalidCase('network'),
                price: runtime.api.marketInvalidCase('price'),
                labor: runtime.api.marketInvalidCase('labor'),
                region: runtime.api.marketInvalidCase('region')
            },
            savedLedger: JSON.parse(savedRaw).marketPrices,
            savedRegional: JSON.parse(savedRaw).regionalEconomy,
            savedTrade: JSON.parse(savedRaw).tradeLogistics
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const ledger = restoredRuntime.api.marketLedger();
        restored = {
            loaded,
            validation: restoredRuntime.api.validateMarketLedger(ledger),
            exact: JSON.stringify(ledger) === JSON.stringify(main.savedLedger),
            regionalUnchanged: JSON.stringify(restoredRuntime.api.regionalLedger()) === JSON.stringify(main.savedRegional),
            tradeUnchanged: JSON.stringify(restoredRuntime.api.tradeLedger()) === JSON.stringify(main.savedTrade)
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const legacySave = JSON.parse(savedRaw);
    delete legacySave.marketPrices;
    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        const loaded = legacyRuntime.api.loadNow();
        legacy = {
            loaded,
            ledger: legacyRuntime.api.marketLedger(),
            validation: legacyRuntime.api.validateMarketLedger(legacyRuntime.api.marketLedger()),
            regionalUnchanged: JSON.stringify(legacyRuntime.api.regionalLedger()) === JSON.stringify(legacySave.regionalEconomy),
            tradeUnchanged: JSON.stringify(legacyRuntime.api.tradeLedger()) === JSON.stringify(legacySave.tradeLogistics)
        };
    } finally {
        legacyRuntime.dom.window.close();
    }

    const corruptSave = JSON.parse(savedRaw);
    corruptSave.marketPrices.policyHash = 'fnv1a32:badc0ffe';
    const corruptRuntime = createRuntime(seed >>> 0);
    let corrupt;
    try {
        corruptRuntime.api.putSavedRaw(JSON.stringify(corruptSave));
        const loaded = corruptRuntime.api.loadNow();
        corrupt = {
            loaded,
            ledger: corruptRuntime.api.marketLedger(),
            validation: corruptRuntime.api.validateMarketLedger(corruptRuntime.api.marketLedger()),
            regionalUnchanged: JSON.stringify(corruptRuntime.api.regionalLedger()) === JSON.stringify(corruptSave.regionalEconomy),
            tradeUnchanged: JSON.stringify(corruptRuntime.api.tradeLedger()) === JSON.stringify(corruptSave.tradeLogistics)
        };
    } finally {
        corruptRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'economy.marketPrices': false }
        });
        disabled = {
            summary: disabledRuntime.api.marketSummary(),
            tick: disabledRuntime.api.marketTick(4),
            ledger: disabledRuntime.api.marketLedger()
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const on = runStorySimulation({
        seed,
        seconds: 120,
        featureFlags: {
            'economy.stateBudget': false,
            'economy.saleSettlement': false
        }
    });
    const off = runStorySimulation({
        seed,
        seconds: 120,
        featureFlags: {
            'economy.marketPrices': false,
            'economy.stateBudget': false,
            'economy.saleSettlement': false
        }
    });
    const stripMarket = snapshot => {
        const copy = JSON.parse(JSON.stringify(snapshot));
        delete copy.marketPrices;
        return copy;
    };
    return {
        main,
        restored,
        legacy,
        corrupt,
        disabled,
        ab: {
            onHash: on.stateHash,
            offHash: off.stateHash,
            changed: on.stateHash !== off.stateHash,
            physicalEqual: hashSnapshot(stripMarket(on.snapshot)) === hashSnapshot(stripMarket(off.snapshot)),
            onMarket: on.marketSummary,
            offMarket: off.marketSummary
        }
    };
}

function probeStateBudget(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let savedRaw;
    let main;
    try {
        runtime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'economy.saleSettlement': false }
        });
        const story = runtime.api.state();
        const stateId = 0;
        const countryId = 'country:0';
        const opening = runtime.api.budgetCountryView(countryId);
        const debit = runtime.api.budgetDebit(stateId, 100, 'test.public_spending', {
            correlationId: 'test:budget:debit'
        });
        const afterDebit = runtime.api.budgetCountryView(countryId);
        const credit = runtime.api.budgetCredit(stateId, 40, 'test.tax_revenue', {
            correlationId: 'test:budget:credit'
        });
        const afterCredit = runtime.api.budgetCountryView(countryId);
        const beforeRejected = runtime.api.budgetCountryView(countryId);
        const rejected = runtime.api.budgetDebit(stateId, 99999999, 'test.impossible_spending', {
            correlationId: 'test:budget:rejected'
        });
        const afterRejected = runtime.api.budgetCountryView(countryId);
        const debt = runtime.api.budgetDebt(stateId, 200, 'test.bond', {
            correlationId: 'test:budget:debt'
        });
        const afterDebt = runtime.api.budgetCountryView(countryId);
        const inflationBeforePrint = Number(story.states[0].inflation) || 2;
        const confidenceBeforePrint = Number(story.states[0].marketConfidence) || 50;
        const issuance = runtime.api.budgetPrint(stateId, 50, 'test.money_issue', {
            correlationId: 'test:budget:issuance'
        });
        const afterIssuance = runtime.api.budgetCountryView(countryId);
        const ownDossier = runtime.api.cityDossierBuild(story.nodes.find(node => node.owner === 0).id);
        const foreignDossier = runtime.api.cityDossierBuild(story.nodes.find(node => node.owner !== 0).id);
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        main = {
            opening,
            debit,
            afterDebit,
            credit,
            afterCredit,
            rejected,
            rejectedAtomic: beforeRejected.cash === afterRejected.cash
                && beforeRejected.debt === afterRejected.debt
                && beforeRejected.tradeEscrow === afterRejected.tradeEscrow,
            debt,
            afterDebt,
            issuance,
            afterIssuance,
            inflationBeforePrint,
            inflationAfterPrint: story.states[0].inflation,
            confidenceBeforePrint,
            confidenceAfterPrint: story.states[0].marketConfidence,
            validation: runtime.api.validateBudgetLedger(runtime.api.budgetLedger(), { checkWalletMirrors: true }),
            invalid: {
                policy: runtime.api.budgetInvalidCase('policy'),
                cash: runtime.api.budgetInvalidCase('cash'),
                posting: runtime.api.budgetInvalidCase('posting'),
                country: runtime.api.budgetInvalidCase('country')
            },
            ownBudgetFact: ownDossier.facts.budget,
            foreignBudgetFact: foreignDossier.facts.budget,
            budgetTabText: runtime.api.renderEconomy(story.nodes.find(node => node.owner === 0).id, 'butce').text
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const savedBudget = JSON.parse(savedRaw).stateBudget;
        restored = {
            loaded,
            validation: restoredRuntime.api.validateBudgetLedger(
                restoredRuntime.api.budgetLedger(),
                { checkWalletMirrors: true }
            ),
            exactLedger: JSON.stringify(restoredRuntime.api.budgetLedger()) === JSON.stringify(savedBudget)
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        const legacySave = JSON.parse(savedRaw);
        delete legacySave.stateBudget;
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        const loaded = legacyRuntime.api.loadNow();
        legacy = {
            loaded,
            validation: legacyRuntime.api.validateBudgetLedger(
                legacyRuntime.api.budgetLedger(),
                { checkWalletMirrors: true }
            ),
            diagnostics: legacyRuntime.api.budgetLedger().diagnostics
        };
    } finally {
        legacyRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'economy.stateBudget': false }
        });
        disabled = {
            summary: disabledRuntime.api.budgetSummary(),
            ledger: disabledRuntime.api.budgetLedger()
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const on = runStorySimulation({
        seed,
        seconds: 120,
        featureFlags: { 'economy.saleSettlement': false }
    });
    const off = runStorySimulation({
        seed,
        seconds: 120,
        featureFlags: {
            'economy.stateBudget': false,
            'economy.saleSettlement': false
        }
    });
    return {
        main,
        restored,
        legacy,
        disabled,
        ab: {
            onHash: on.stateHash,
            offHash: off.stateHash,
            changed: on.stateHash !== off.stateHash,
            onBudget: on.budgetSummary,
            offBudget: off.budgetSummary,
            pointDelta: round(on.final.totalResources.points - off.final.totalResources.points)
        }
    };
}

function probeCompaniesBanks(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let savedRaw;
    let main;
    try {
        runtime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'economy.saleSettlement': false }
        });
        const story = runtime.api.state();
        const opening = runtime.api.companySummary();
        const node = story.nodes.find(candidate => candidate.owner === 0
            && runtime.api.companyRegionView(`region:${candidate.id}`).facilities.some(
                facility => facility.sectorId === 'civil_industry'
            ));
        if (!node) throw new Error('Sirket yatirim probu icin oyuncuya ait sanayi tesisi bulunamadi.');
        const regionId = `region:${node.id}`;
        const companyId = runtime.api.companyRegionView(regionId).facilities.find(
            facility => facility.sectorId === 'civil_industry'
        ).ownerCompanyId;
        const companyBeforeLoan = runtime.api.companyLedger().companies[companyId];
        const bankId = companyBeforeLoan.bankId;
        const bankBeforeLoan = runtime.api.companyLedger().banks[bankId];
        const loan = runtime.api.companyLoan(companyId, 100, { correlationId: 'probe:company:loan' });
        const companyAfterLoan = runtime.api.companyLedger().companies[companyId];
        const bankAfterLoan = runtime.api.companyLedger().banks[bankId];

        const regionalBeforeFixture = runtime.api.regionalRegionView(regionId);
        runtime.api.regionalStockDelta(
            regionId,
            'industrial_parts',
            Math.max(0, 30 - regionalBeforeFixture.stocks.industrial_parts),
            { type: 'TEST_FIXTURE', source: 'probe.company.investment' }
        );
        const capacityBefore = runtime.api.regionalRegionView(regionId).sectorCapacity.civil_industry;
        const stockBeforeInvestment = runtime.api.regionalRegionView(regionId).stocks.industrial_parts;
        const investment = runtime.api.companyInvest(companyId, regionId);
        const capacityDuring = runtime.api.regionalRegionView(regionId).sectorCapacity.civil_industry;
        const stockAfterInvestment = runtime.api.regionalRegionView(regionId).stocks.industrial_parts;
        const companyDuringInvestment = runtime.api.companyLedger().companies[companyId];
        const projectTick = runtime.api.companyTick(60);
        const capacityAfter = runtime.api.regionalRegionView(regionId).sectorCapacity.civil_industry;
        const completedProject = runtime.api.companyLedger().projects.find(
            project => project.id === investment.project.id
        );

        const lobbyBefore = runtime.api.companyLedger().companies[companyId].lobbyInfluence;
        const lobby = runtime.api.companyLobby(companyId, 10, {
            target: 'INDUSTRIAL_POLICY',
            disclosed: true
        });
        const lobbyAfter = runtime.api.companyLedger().companies[companyId].lobbyInfluence;

        const countBeforeApplication = Object.keys(runtime.api.companyLedger().companies).length;
        const application = runtime.api.companySubmitApplication({
            countryId: 0,
            sectorId: 'civil_industry',
            name: 'Anadolu Celik Sanayi A.S.',
            proposedOwnerId: 'character:player',
            foundingCapital: 120
        });
        const prematureRegistration = runtime.api.companyRegisterApplication(application.application.id);
        const funding = runtime.api.companyFundApplication(application.application.id, 0, 120);
        const stillPremature = runtime.api.companyRegisterApplication(application.application.id);
        const license = runtime.api.companyApproveApplication(application.application.id, 0);
        const registration = runtime.api.companyRegisterApplication(application.application.id);
        const countAfterApplication = Object.keys(runtime.api.companyLedger().companies).length;

        const ownNode = story.nodes.find(candidate => candidate.owner === 0);
        const foreignNode = story.nodes.find(candidate => candidate.owner !== 0);
        const ownDossier = runtime.api.cityDossierBuild(ownNode.id);
        const foreignDossier = runtime.api.cityDossierBuild(foreignNode.id);
        const companyTabText = runtime.api.renderEconomy(ownNode.id, 'sirketler').text;
        const validation = runtime.api.validateCompanyLedger(runtime.api.companyLedger());
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        main = {
            opening,
            regionId,
            companyId,
            companyBeforeLoan,
            bankBeforeLoan,
            loan,
            companyAfterLoan,
            bankAfterLoan,
            capacityBefore,
            capacityDuring,
            capacityAfter,
            stockBeforeInvestment,
            stockAfterInvestment,
            investment,
            companyDuringInvestment,
            projectTick,
            completedProject,
            lobbyBefore,
            lobby,
            lobbyAfter,
            application,
            prematureRegistration,
            funding,
            stillPremature,
            license,
            registration,
            countBeforeApplication,
            countAfterApplication,
            ownCompanyFact: ownDossier.facts.companyEconomy,
            foreignCompanyFact: foreignDossier.facts.companyEconomy,
            companyTabText,
            validation,
            invalid: {
                policy: runtime.api.companyInvalidCase('policy'),
                cash: runtime.api.companyInvalidCase('cash'),
                ownership: runtime.api.companyInvalidCase('ownership'),
                facility: runtime.api.companyInvalidCase('facility'),
                money: runtime.api.companyInvalidCase('money')
            }
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const savedLedger = JSON.parse(savedRaw).companyEconomy;
        restored = {
            loaded,
            validation: restoredRuntime.api.validateCompanyLedger(restoredRuntime.api.companyLedger()),
            exactLedger: JSON.stringify(restoredRuntime.api.companyLedger()) === JSON.stringify(savedLedger)
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        const legacySave = JSON.parse(savedRaw);
        delete legacySave.companyEconomy;
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        const loaded = legacyRuntime.api.loadNow();
        legacy = {
            loaded,
            validation: legacyRuntime.api.validateCompanyLedger(legacyRuntime.api.companyLedger()),
            diagnostics: legacyRuntime.api.companyLedger().diagnostics
        };
    } finally {
        legacyRuntime.dom.window.close();
    }

    const corruptRuntime = createRuntime(seed >>> 0);
    let corrupt;
    try {
        const corruptSave = JSON.parse(savedRaw);
        corruptSave.companyEconomy.policyHash = 'fnv1a32:badc0ffe';
        corruptRuntime.api.putSavedRaw(JSON.stringify(corruptSave));
        const loaded = corruptRuntime.api.loadNow();
        corrupt = {
            loaded,
            validation: corruptRuntime.api.validateCompanyLedger(corruptRuntime.api.companyLedger()),
            diagnostics: corruptRuntime.api.companyLedger().diagnostics
        };
    } finally {
        corruptRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'economy.companiesBanks': false }
        });
        disabled = {
            summary: disabledRuntime.api.companySummary(),
            ledger: disabledRuntime.api.companyLedger()
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const on = runStorySimulation({
        seed,
        seconds: 120,
        featureFlags: { 'economy.saleSettlement': false }
    });
    const off = runStorySimulation({
        seed,
        seconds: 120,
        featureFlags: {
            'economy.companiesBanks': false,
            'economy.saleSettlement': false
        }
    });
    return {
        main,
        restored,
        legacy,
        corrupt,
        disabled,
        ab: {
            onHash: on.stateHash,
            offHash: off.stateHash,
            changed: on.stateHash !== off.stateHash,
            onCompanies: on.companySummary,
            offCompanies: off.companySummary,
            onCapital: on.regionalSummary.stockTotals.capital,
            offCapital: off.regionalSummary.stockTotals.capital
        }
    };
}

function probeProductionUnitEconomics(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    try {
        runtime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'economy.saleSettlement': true }
        });
        const catalog = runtime.api.productionCatalogSnapshot();
        const baseValues = runtime.api.companyBaseValues();
        const facilities = Object.values(runtime.api.companyLedger().facilities || {});
        const rows = [];
        for (const sector of catalog.sectors) {
            const facility = facilities.find(candidate => candidate.sectorId === sector.id);
            if (!facility) continue;
            const regionId = facility.regionId;
            let workingCapitalRequired = 0;
            let physicalInputCost = 0;
            const inputs = [];
            for (const input of (sector.recipe.inputs || [])) {
                if (input.resourceId === 'capital') {
                    workingCapitalRequired += Math.max(0, Number(input.quantity) || 0);
                    continue;
                }
                if (!Object.prototype.hasOwnProperty.call(baseValues, input.resourceId)) continue;
                const unitPrice = runtime.api.commerceUnitPrice(regionId, input.resourceId);
                const cost = round(Math.max(0, Number(input.quantity) || 0) * unitPrice);
                physicalInputCost = round(physicalInputCost + cost);
                inputs.push({
                    resourceId: input.resourceId,
                    quantity: Number(input.quantity),
                    unitPrice,
                    cost
                });
            }
            let expectedRevenue = 0;
            const outputs = [];
            for (const output of (sector.recipe.outputs || [])) {
                const unitPrice = runtime.api.commerceUnitPrice(regionId, output.resourceId);
                const revenue = round(Math.max(0, Number(output.quantity) || 0) * unitPrice);
                expectedRevenue = round(expectedRevenue + revenue);
                outputs.push({
                    resourceId: output.resourceId,
                    quantity: Number(output.quantity),
                    unitPrice,
                    revenue
                });
            }
            const legacyFullCost = round(workingCapitalRequired + physicalInputCost);
            rows.push({
                sectorId: sector.id,
                regionId,
                workingCapitalRequired: round(workingCapitalRequired),
                physicalInputCost,
                legacyFullCost,
                expectedRevenue,
                marginWithCapitalExpensed: round(expectedRevenue - legacyFullCost),
                marginWithCapitalReserved: round(expectedRevenue - physicalInputCost),
                inputs,
                outputs,
                currentViability: runtime.api.companyProductionViability(regionId, sector.id)
            });
        }
        return { seed, rows };
    } finally {
        runtime.dom.window.close();
    }
}

function probeSaleSettlement(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    try {
        runtime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'economy.saleSettlement': true }
        });
        const story = runtime.api.state();
        const node = story.nodes.find(candidate => (
            runtime.api.companyRegionView(`region:${candidate.id}`).facilities || []
        ).some(facility => facility.sectorId === 'agriculture'));
        if (!node) throw new Error('Satis probu icin tarim tesisi bulunamadi.');
        const regionId = `region:${node.id}`;
        const facility = runtime.api.companyRegionView(regionId).facilities.find(
            row => row.sectorId === 'agriculture'
        );
        const companyId = facility.ownerCompanyId;
        let regional = runtime.api.regionalRegionView(regionId);
        if (regional.stocks.energy < 5) {
            runtime.api.regionalStockDelta(regionId, 'energy', 5 - regional.stocks.energy, {
                type: 'TEST_FIXTURE', source: 'probe.sale.energy'
            });
        }
        regional = runtime.api.regionalRegionView(regionId);
        if (regional.stocks.labor < 10) {
            runtime.api.regionalStockDelta(regionId, 'labor', 10 - regional.stocks.labor, {
                type: 'TEST_FIXTURE', source: 'probe.sale.labor'
            });
        }
        runtime.api.commerceReset({ backfilled: true });

        const moneyTotal = ledger => round(
            Object.values(ledger.companies).reduce(
                (sum, company) => sum + Math.max(0, Number(company.accounts['ASSET:CASH']) || 0)
                    + Math.max(0, Number(company.accounts['ASSET:PROJECT_ESCROW']) || 0)
                    + Math.max(0, Number(company.accounts['ASSET:TRADE_ESCROW']) || 0),
                0
            )
            + Object.values(ledger.banks).reduce((sum, bank) => sum + Number(bank.reserves || 0), 0)
            + Number(ledger.marketClearingCash || 0)
            + Number(ledger.applicationEscrow || 0)
        );

        const companyBefore = runtime.api.companyLedger().companies[companyId];
        const companyRevenueBefore = Number(companyBefore.cumulative.revenue || 0);
        const moneyBefore = moneyTotal(runtime.api.companyLedger());
        const beforeRegion = runtime.api.regionalRegionView(regionId);
        const proposal = runtime.api.productionEvaluate('agriculture', {
            requestedCycles: 1,
            capacityUnits: 1,
            efficiencyBps: 10000,
            availableQuantities: Object.assign({}, beforeRegion.stocks, {
                capital: Number(companyBefore.accounts['ASSET:CASH'])
            }),
            endowments: beforeRegion.endowments
        });
        const production = runtime.api.regionalCommitProduction(regionId, proposal);
        const afterProductionLedger = runtime.api.companyLedger();
        const companyAfterProduction = afterProductionLedger.companies[companyId];
        const afterProductionRegion = runtime.api.regionalRegionView(regionId);
        const commerceAfterProduction = runtime.api.commerceLedger();
        const producedLot = commerceAfterProduction.inventories.find(lot => (
            lot.regionId === regionId
            && lot.resourceId === 'food'
            && lot.ownerId === companyId
            && lot.source === 'PRODUCTION'
            && lot.quantity > 0
        ));
        const productionValidation = runtime.api.validateCommerceLedger(
            commerceAfterProduction,
            { checkPhysicalMirrors: true }
        );

        const sale = runtime.api.regionalAllocateDemands(regionId, [{
            id: 'demand:probe:household:food',
            consumerType: 'HOUSEHOLDS',
            resourceId: 'food',
            quantity: 0.5,
            priority: 100,
            minFillBps: 8500,
            mayUseReserve: true,
            reason: 'PROBE_REAL_SALE'
        }]);
        const finalLedger = runtime.api.companyLedger();
        const companyAfterSale = finalLedger.companies[companyId];
        const finalCommerce = runtime.api.commerceLedger();
        const saleInvoice = finalCommerce.invoices.find(invoice => (
            invoice.correlationId === 'demand:probe:household:food'
        ));
        const finalValidation = runtime.api.validateCompanyLedger(finalLedger);
        const commerceValidation = runtime.api.validateCommerceLedger(
            finalCommerce,
            { checkPhysicalMirrors: true }
        );
        const moneyAfter = moneyTotal(finalLedger);
        const buyerCompany = Object.values(finalLedger.companies).find(company => (
            company.id !== companyId
            && company.countryId === companyAfterSale.countryId
            && company.status === 'OPERATING'
        ));
        if (!buyerCompany) throw new Error('Satis probu icin ikinci sirket bulunamadi.');
        const sellerRevenueBeforeCompanySale = Number(companyAfterSale.cumulative.revenue || 0);
        const buyerCashBeforeCompanySale = Number(buyerCompany.accounts['ASSET:CASH'] || 0);
        const companySale = runtime.api.regionalAllocateDemands(regionId, [{
            id: 'demand:probe:company:food',
            consumerType: 'COMPANIES',
            buyerCompanyId: buyerCompany.id,
            resourceId: 'food',
            quantity: 0.25,
            priority: 70,
            minFillBps: 6000,
            mayUseReserve: true,
            reason: 'PROBE_COMPANY_INPUT_SALE'
        }]);
        const afterCompanySaleLedger = runtime.api.companyLedger();
        const afterCompanySaleCommerce = runtime.api.commerceLedger();
        const companyInvoice = afterCompanySaleCommerce.invoices.find(invoice => (
            invoice.correlationId === 'demand:probe:company:food'
        ));
        const afterCompanySaleValidation = runtime.api.validateCompanyLedger(afterCompanySaleLedger);
        const afterCompanyCommerceValidation = runtime.api.validateCommerceLedger(
            afterCompanySaleCommerce,
            { checkPhysicalMirrors: true }
        );
        runtime.api.saveNow();
        const savedRaw = runtime.api.savedRaw();
        const restoredRuntime = createRuntime(seed >>> 0);
        let restored;
        try {
            restoredRuntime.api.putSavedRaw(savedRaw);
            const loaded = restoredRuntime.api.loadNow();
            const restoredCompany = restoredRuntime.api.companyLedger();
            const restoredCommerce = restoredRuntime.api.commerceLedger();
            restored = {
                loaded,
                exactCommerce: JSON.stringify(restoredCommerce)
                    === JSON.stringify(JSON.parse(savedRaw).companyEconomy.commerce),
                companyValidation: restoredRuntime.api.validateCompanyLedger(restoredCompany),
                commerceValidation: restoredRuntime.api.validateCommerceLedger(
                    restoredCommerce,
                    { checkPhysicalMirrors: true }
                )
            };
        } finally {
            restoredRuntime.dom.window.close();
        }

        const control = runStorySimulation({ seed, seconds: 20 });
        const enabledExplicit = runStorySimulation({
            seed,
            seconds: 20,
            featureFlags: { 'economy.saleSettlement': true }
        });
        const disabledExplicit = runStorySimulation({
            seed,
            seconds: 20,
            featureFlags: { 'economy.saleSettlement': false }
        });
        return {
            regionId,
            companyId,
            proposal,
            production,
            before: {
                company: companyBefore,
                region: beforeRegion,
                money: moneyBefore,
                revenue: companyRevenueBefore
            },
            afterProduction: {
                company: companyAfterProduction,
                region: afterProductionRegion,
                commerce: commerceAfterProduction,
                producedLot,
                validation: productionValidation,
                money: moneyTotal(afterProductionLedger)
            },
            sale,
            afterSale: {
                company: companyAfterSale,
                commerce: finalCommerce,
                invoice: saleInvoice,
                companyValidation: finalValidation,
                commerceValidation,
                money: moneyAfter
            },
            companySale,
            afterCompanySale: {
                buyerCompanyId: buyerCompany.id,
                sellerRevenueBefore: sellerRevenueBeforeCompanySale,
                seller: afterCompanySaleLedger.companies[companyId],
                buyerCashBefore: buyerCashBeforeCompanySale,
                buyer: afterCompanySaleLedger.companies[buyerCompany.id],
                invoice: companyInvoice,
                companyValidation: afterCompanySaleValidation,
                commerceValidation: afterCompanyCommerceValidation,
                money: moneyTotal(afterCompanySaleLedger)
            },
            restored,
            ab: {
                defaultHash: control.stateHash,
                explicitOnHash: enabledExplicit.stateHash,
                explicitOffHash: disabledExplicit.stateHash,
                defaultMatchesExplicitOn: control.stateHash === enabledExplicit.stateHash,
                explicitOffDiffers: control.stateHash !== disabledExplicit.stateHash
            }
        };
    } finally {
        runtime.dom.window.close();
    }
}

function probeSaleSettlementResume(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let savedRaw;
    let before;
    try {
        runtime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'economy.saleSettlement': true }
        });
        for (let elapsed = 0; elapsed < 20; elapsed++) runtime.api.advance(1);
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        const company = runtime.api.companyLedger();
        const budget = runtime.api.budgetLedger();
        const orphanCandidate = JSON.parse(JSON.stringify(budget));
        for (const settlement of orphanCandidate.settlements) {
            if (settlement.status === 'RESERVED' && settlement.payerType === 'COMPANY') {
                settlement.status = 'RELEASED';
            }
        }
        const orphanValidation = runtime.api.validateBudgetLedger(
            orphanCandidate,
            { checkWalletMirrors: true }
        );
        before = {
            tradeEscrow: round(Object.values(company.companies).reduce(
                (sum, row) => sum + Number(row.accounts['ASSET:TRADE_ESCROW'] || 0),
                0
            )),
            companyReservations: budget.settlements.filter(
                row => row.status === 'RESERVED' && row.payerType === 'COMPANY'
            ).length,
            companyValidation: runtime.api.validateCompanyLedger(company),
            budgetValidation: runtime.api.validateBudgetLedger(budget, { checkWalletMirrors: true }),
            tradeValidation: runtime.api.validateTradeLedger(runtime.api.tradeLedger()),
            orphanEscrowRejected: !orphanValidation.ok
                && orphanValidation.issues.some(row => row.code === 'BUDGET_COMPANY_ESCROW_MISMATCH')
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const saved = JSON.parse(savedRaw);
        const exact = {
            company: JSON.stringify(restoredRuntime.api.companyLedger())
                === JSON.stringify(saved.companyEconomy),
            budget: JSON.stringify(restoredRuntime.api.budgetLedger())
                === JSON.stringify(saved.stateBudget),
            trade: JSON.stringify(restoredRuntime.api.tradeLedger())
                === JSON.stringify(saved.tradeLogistics)
        };
        for (let elapsed = 0; elapsed < 8; elapsed++) restoredRuntime.api.advance(1);
        return {
            loaded,
            before,
            exact,
            after: {
                companyValidation: restoredRuntime.api.validateCompanyLedger(
                    restoredRuntime.api.companyLedger()
                ),
                budgetValidation: restoredRuntime.api.validateBudgetLedger(
                    restoredRuntime.api.budgetLedger(),
                    { checkWalletMirrors: true }
                ),
                tradeValidation: restoredRuntime.api.validateTradeLedger(
                    restoredRuntime.api.tradeLedger()
                )
            }
        };
    } finally {
        restoredRuntime.dom.window.close();
    }
}

function probeEconomicAI(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let savedRaw;
    let main;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        runtime.api.advance(120);
        const ledger = runtime.api.economicAILedger();
        const summary = runtime.api.economicAISummary();
        const applied = ledger.decisions.filter(row => row.execution.status === 'APPLIED');
        const companyApplied = applied.filter(row => row.actorType === 'COMPANY');
        const playerStateAutonomous = ledger.decisions.filter(row => (
            row.actorType === 'STATE' && row.actorId === 'country:0'
        ));
        const firstApplied = companyApplied[0] || null;
        const world = runtime.api.worldV2();
        const knowledge = runtime.api.playerKnowledge(world, 'country:0');
        const ownCountry = knowledge.countries.find(row => row.id === 'country:0');
        const foreignCountry = knowledge.countries.find(row => row.id !== 'country:0');
        const ownNode = runtime.api.state().nodes.find(row => row.owner === 0);
        const companyTabText = runtime.api.renderEconomy(ownNode.id, 'sirketler').text;
        main = {
            summary,
            companySummary: runtime.api.companySummary(),
            validation: runtime.api.validateEconomicAILedger(ledger),
            companyValidation: runtime.api.validateCompanyLedger(runtime.api.companyLedger()),
            budgetValidation: runtime.api.validateBudgetLedger(
                runtime.api.budgetLedger(),
                { checkWalletMirrors: true }
            ),
            regionalValidation: runtime.api.validateRegionalLedger(
                runtime.api.regionalLedger(),
                { checkNodeMirrors: true }
            ),
            firstApplied,
            appliedCount: applied.length,
            companyAppliedCount: companyApplied.length,
            playerStateAutonomousCount: playerStateAutonomous.length,
            ownPolicyFact: ownCountry.economicPolicy,
            foreignPolicyFact: foreignCountry.economicPolicy,
            companyTabText,
            invalid: {
                policy: runtime.api.economicAIInvalidCase('policy'),
                sequence: runtime.api.economicAIInvalidCase('sequence'),
                action: runtime.api.economicAIInvalidCase('action'),
                score: runtime.api.economicAIInvalidCase('score')
            }
        };
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
    } finally {
        runtime.dom.window.close();
    }

    const grantRuntime = createRuntime(seed >>> 0);
    let stateGrant;
    try {
        grantRuntime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = grantRuntime.api.state();
        const state = story.states.find(row => !row.isPlayer);
        const company = Object.values(story.companyEconomy.companies).find(row => (
            row.countryId === `country:${state.id}` && row.sectorId === 'agriculture'
        ));
        const facility = company.facilityIds.map(id => story.companyEconomy.facilities[id]).find(Boolean);
        const region = story.regionalEconomy.regions[facility.regionId];
        grantRuntime.api.companyLoan(company.id, 400, { correlationId: 'probe:economic-ai:max-debt' });
        const liveCash = story.companyEconomy.companies[company.id].accounts['ASSET:CASH'];
        grantRuntime.api.companyLobby(company.id, liveCash, {
            target: 'TEST_FIXTURE_CASH_DEPLETION',
            disclosed: true
        });
        grantRuntime.api.regionalStockDelta(
            facility.regionId,
            'industrial_parts',
            Math.max(0, 30 - Number(region.stocks.industrial_parts)),
            { type: 'TEST_FIXTURE', source: 'probe.economic-ai.state-grant' }
        );
        if (Number(region.stocks.food) > 0) {
            grantRuntime.api.regionalStockDelta(
                facility.regionId,
                'food',
                -Number(region.stocks.food),
                { type: 'TEST_FIXTURE', source: 'probe.economic-ai.state-grant' }
            );
        }
        const market = story.marketPrices.regions[facility.regionId].resources.food;
        market.priceIndex = 600;
        market.targetIndex = 600;
        market.signals = Object.assign({}, market.signals, { fillBps: 0 });
        const stateCashBefore = grantRuntime.api.budgetCountryView(state.id).cash;
        const companyCashBefore = story.companyEconomy.companies[company.id].accounts['ASSET:CASH'];
        const tick = grantRuntime.api.economicAITick(30);
        const decisions = grantRuntime.api.economicAILedger().decisions;
        const grantDecision = decisions.find(row => (
            row.actorType === 'STATE'
            && row.actorId === `country:${state.id}`
            && row.selectedAction === 'TARGETED_CAPACITY_GRANT'
        ));
        stateGrant = {
            tick,
            stateId: state.id,
            companyId: company.id,
            decision: grantDecision || null,
            stateCashBefore,
            stateCashAfter: grantRuntime.api.budgetCountryView(state.id).cash,
            companyCashBefore,
            companyCashAfter: story.companyEconomy.companies[company.id].accounts['ASSET:CASH'],
            economicValidation: grantRuntime.api.validateEconomicAILedger(
                grantRuntime.api.economicAILedger()
            ),
            companyValidation: grantRuntime.api.validateCompanyLedger(
                grantRuntime.api.companyLedger()
            ),
            budgetValidation: grantRuntime.api.validateBudgetLedger(
                grantRuntime.api.budgetLedger(),
                { checkWalletMirrors: true }
            )
        };
    } finally {
        grantRuntime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const savedLedger = JSON.parse(savedRaw).economicAI;
        restored = {
            loaded,
            validation: restoredRuntime.api.validateEconomicAILedger(
                restoredRuntime.api.economicAILedger()
            ),
            exactLedger: JSON.stringify(restoredRuntime.api.economicAILedger())
                === JSON.stringify(savedLedger)
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        const legacySave = JSON.parse(savedRaw);
        delete legacySave.economicAI;
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        const loaded = legacyRuntime.api.loadNow();
        legacy = {
            loaded,
            validation: legacyRuntime.api.validateEconomicAILedger(
                legacyRuntime.api.economicAILedger()
            ),
            diagnostics: legacyRuntime.api.economicAILedger().diagnostics
        };
    } finally {
        legacyRuntime.dom.window.close();
    }

    const corruptRuntime = createRuntime(seed >>> 0);
    let corrupt;
    try {
        const corruptSave = JSON.parse(savedRaw);
        corruptSave.economicAI.policyHash = 'fnv1a32:badc0ffe';
        corruptRuntime.api.putSavedRaw(JSON.stringify(corruptSave));
        const loaded = corruptRuntime.api.loadNow();
        corrupt = {
            loaded,
            validation: corruptRuntime.api.validateEconomicAILedger(
                corruptRuntime.api.economicAILedger()
            ),
            diagnostics: corruptRuntime.api.economicAILedger().diagnostics
        };
    } finally {
        corruptRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'economy.economicAI': false }
        });
        disabled = {
            summary: disabledRuntime.api.economicAISummary(),
            ledger: disabledRuntime.api.economicAILedger()
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const on = runStorySimulation({ seed, seconds: 360 });
    const off = runStorySimulation({
        seed,
        seconds: 360,
        featureFlags: { 'economy.economicAI': false }
    });
    return {
        main,
        stateGrant,
        restored,
        legacy,
        corrupt,
        disabled,
        ab: {
            onHash: on.stateHash,
            offHash: off.stateHash,
            changed: on.stateHash !== off.stateHash,
            onEconomicAI: on.economicAISummary,
            offEconomicAI: off.economicAISummary,
            onCompanies: on.companySummary,
            offCompanies: off.companySummary,
            onShortages: on.regionalSummary.shortageCount,
            offShortages: off.regionalSummary.shortageCount,
            onCriticalPrices: on.marketSummary.criticalCount,
            offCriticalPrices: off.marketSummary.criticalCount
        }
    };
}

function probeCityDossier(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = runtime.api.state();
        const worldAtStart = runtime.api.worldV2();
        const ownCharacterRegionId = (worldAtStart.characters.find(character => (
            character.ownerId === `country:${story.playerStateId}` && character.regionId
        )) || {}).regionId;
        const ownCharacterNodeId = ownCharacterRegionId
            ? Number(String(ownCharacterRegionId).split(':')[1])
            : null;
        const ownCharacterNode = Number.isInteger(ownCharacterNodeId)
            ? story.nodes[ownCharacterNodeId]
            : null;
        const ownNode = ownCharacterNode && ownCharacterNode.owner === story.playerStateId
            && runtime.api.infrastructureCorridorIds(`region:${ownCharacterNode.id}`).length > 0
            ? ownCharacterNode
            : story.nodes.find(node => node.owner === story.playerStateId
                && runtime.api.infrastructureCorridorIds(`region:${node.id}`).length > 0);
        const foreignNode = story.nodes.find(node => node.owner !== story.playerStateId);
        if (!ownNode || !foreignNode) throw new Error('Faz 14.1 probu için kendi/yabancı şehir bulunamadı.');

        const beforeUiSnapshot = stateSnapshot(story);
        const beforeHash = hashSnapshot(beforeUiSnapshot);
        const ownView = runtime.api.cityDossierBuild(ownNode.id);
        const ownValidation = runtime.api.validateCityDossier(ownView);
        runtime.api.cityDossierPerfReset();
        const ownGeneral = runtime.api.renderCityDossier(ownNode.id, 'genel');
        const panelPerfAfterFirst = runtime.api.cityDossierPerf();
        let ownGeneralRepeat = ownGeneral;
        for (let index = 0; index < 25; index++) {
            ownGeneralRepeat = runtime.api.renderCityDossier(ownNode.id, 'genel');
        }
        const panelPerfAfterRepeat = runtime.api.cityDossierPerf();
        const ownPopulation = runtime.api.renderCityDossier(ownNode.id, 'nufus');
        const ownInstitutions = runtime.api.renderCityDossier(ownNode.id, 'kurumlar');
        const ownEconomy = runtime.api.renderEconomy(ownNode.id, 'genel');
        const ownMarket = runtime.api.renderEconomy(ownNode.id, 'piyasa');
        const ownLogistics = runtime.api.renderEconomy(ownNode.id, 'lojistik');
        const ownFactions = runtime.api.renderEconomy(ownNode.id, 'fraksiyonlar');
        const ownCharacters = runtime.api.renderCityDossier(ownNode.id, 'karakterler');
        const panelPerfBeforeRevisit = runtime.api.cityDossierPerf();
        const ownGeneralAfterTabTour = runtime.api.renderCityDossier(ownNode.id, 'genel');
        const panelPerfAfterRevisit = runtime.api.cityDossierPerf();
        const panelPerfBeforeHeavyRevisit = runtime.api.cityDossierPerf();
        const ownPopulationRepeat = runtime.api.renderCityDossier(ownNode.id, 'nufus');
        const ownInstitutionsRepeat = runtime.api.renderCityDossier(ownNode.id, 'kurumlar');
        const panelPerfAfterHeavyRevisit = runtime.api.cityDossierPerf();
        const cacheTourNodes = story.nodes.filter(node => node.id !== ownNode.id).slice(0, 3);
        for (const node of cacheTourNodes) runtime.api.renderCityDossier(node.id, 'genel');
        const panelPerfBeforeCityReturn = runtime.api.cityDossierPerf();
        const ownGeneralAfterCityTour = runtime.api.renderCityDossier(ownNode.id, 'genel');
        const panelPerfAfterCityReturn = runtime.api.cityDossierPerf();
        runtime.api.renderCityDossier(ownNode.id, 'nufus');
        const cityBody = runtime.dom.window.document.getElementById('city-body');
        const tooltipHost = cityBody && cityBody.querySelector('.detail-hover');
        if (cityBody) cityBody.scrollTop = 137;
        const tooltipNodeBefore = tooltipHost;
        if (tooltipHost) tooltipHost.dispatchEvent(new runtime.dom.window.MouseEvent('pointerover', { bubbles: true }));
        runtime.api.cityDossierPerfReset();
        runtime.api.renderCityDossier(ownNode.id, 'nufus');
        const interactionPerf = runtime.api.cityDossierPerf();
        const tooltipNodeWhileHeld = cityBody && cityBody.querySelector('.detail-hover');
        if (tooltipHost) tooltipHost.dispatchEvent(new runtime.dom.window.MouseEvent('pointerout', { bubbles: true }));
        runtime.api.renderCityDossier(ownNode.id, 'nufus');
        const stableInteraction = {
            tooltipAvailable: !!tooltipHost,
            tooltipNodeStable: tooltipNodeBefore === tooltipNodeWhileHeld,
            interactionDeferred: interactionPerf.interactionDefers > 0,
            scrollPreserved: !!cityBody && cityBody.scrollTop === 137,
            afterRefresh: runtime.api.cityDossierPerf()
        };
        runtime.api.renderEconomy(ownNode.id, 'genel');
        const economyBody = runtime.dom.window.document.getElementById('economy-body');
        const economyTooltip = economyBody && economyBody.querySelector('.detail-hover');
        if (economyBody) economyBody.scrollTop = 91;
        if (economyTooltip) economyTooltip.dispatchEvent(new runtime.dom.window.MouseEvent('pointerover', { bubbles: true }));
        runtime.api.cityDossierPerfReset();
        runtime.api.renderEconomy(ownNode.id, 'genel');
        const economyInteractionPerf = runtime.api.cityDossierPerf();
        const economyTooltipWhileHeld = economyBody && economyBody.querySelector('.detail-hover');
        if (economyTooltip) economyTooltip.dispatchEvent(new runtime.dom.window.MouseEvent('pointerout', { bubbles: true }));
        runtime.api.renderEconomy(ownNode.id, 'genel');
        const stableEconomyInteraction = {
            tooltipAvailable: !!economyTooltip,
            tooltipNodeStable: economyTooltip === economyTooltipWhileHeld,
            interactionDeferred: economyInteractionPerf.interactionDefers > 0,
            scrollPreserved: !!economyBody && economyBody.scrollTop === 91,
            afterRefresh: runtime.api.cityDossierPerf()
        };
        const topBarWorldState = runtime.api.topBarWorldState();
        const afterUiSnapshot = stateSnapshot(story);
        const afterUiHash = hashSnapshot(afterUiSnapshot);
        const factionNotice = runtime.api.factionNoticeProbe('cityLost');
        const commandCenter = runtime.api.commandCenter();

        const corridor = ownView.corridors[0];
        const routeOpened = corridor
            ? runtime.api.cityDossierOpenRegion(corridor.destinationRegionId)
            : false;
        const routeState = runtime.api.cityDossierUiState();

        runtime.api.renderCityDossier(ownNode.id, 'karakterler');
        const playerActorId = `character:${story.playerStateId}:${story.commander.id}`;
        const character = ownView.characters.find(row => row.id !== playerActorId);
        if (!character) throw new Error('Faz 37 UI probu için oyuncu dışında hedef karakter bulunamadı.');
        const characterOpened = character
            ? runtime.api.cityDossierOpenCharacter(character.id)
            : false;
        const characterState = runtime.api.cityDossierUiState();
        const characterActionView = runtime.api.characterActionPlayerView(character.id);
        const actionButtons = Array.from(runtime.dom.window.document.querySelectorAll('[data-character-action]'));
        const persuadeButton = actionButtons.find(button => button.dataset.characterAction === 'PERSUADE');
        const actionReceiptsBefore = runtime.api.characterActionSummary().receiptCount;
        // JSDOM kaynakları belge hâlâ `loading` iken senkron yükler; gerçek EXE'deki
        // tek DOMContentLoaded turunu burada açıkça tetikleyip delegasyon bağını sınarız.
        runtime.dom.window.document.dispatchEvent(new runtime.dom.window.Event('DOMContentLoaded'));
        if (persuadeButton) persuadeButton.click();
        const characterActionSummaryAfter = runtime.api.characterActionSummary();
        const characterStateAfterAction = runtime.api.cityDossierUiState();
        const playerActionReceipt = Object.values(runtime.api.characterActionLedger().receipts || {})
            .find(row => row.decisionSource === 'PLAYER_UI' && row.actionType === 'PERSUADE'
                && row.targetActorId === character.id);

        const foreignSentinels = {
            population: 987654321,
            wealth: 876543210,
            garrison: 765432109,
            oil: 654321098,
            factory: 543210987
        };
        foreignNode.pop = foreignSentinels.population;
        foreignNode.wealth = foreignSentinels.wealth;
        foreignNode.garrison = foreignSentinels.garrison;
        foreignNode.oil = foreignSentinels.oil;
        foreignNode.fac = foreignSentinels.factory;
        const foreignView = runtime.api.cityDossierBuild(foreignNode.id);
        const foreignValidation = runtime.api.validateCityDossier(foreignView);
        const foreignGeneral = runtime.api.renderCityDossier(foreignNode.id, 'genel');
        const foreignPopulation = runtime.api.renderCityDossier(foreignNode.id, 'nufus');
        const foreignMarket = runtime.api.renderEconomy(foreignNode.id, 'piyasa');
        const foreignLogistics = runtime.api.renderEconomy(foreignNode.id, 'lojistik');

        const targetState = story.states.find(state => state.id !== foreignNode.owner
            && state.id !== story.playerStateId
            && story.nodes.some(node => node.owner === state.id));
        let eventNavigation = {
            historyCount: 0,
            opened: false,
            tooltipVisibleInMarkup: false,
            changePanelAbsent: true
        };
        if (targetState) {
            runtime.api.causalityTransfer(
                foreignNode.id,
                targetState.id,
                `phase14.1:history:${foreignNode.id}:${targetState.id}`
            );
            const historyView = runtime.api.cityDossierBuild(foreignNode.id);
            const firstEvent = historyView.history[0];
            const historyUi = runtime.api.renderCityDossier(foreignNode.id, 'tarih');
            const opened = firstEvent
                ? runtime.api.cityDossierOpenEvent(firstEvent.id)
                : false;
            eventNavigation = {
                historyCount: historyView.history.length,
                opened,
                tooltipVisibleInMarkup: historyUi.html.includes('data-story-tooltip='),
                changePanelAbsent: !runtime.dom.window.document.getElementById('story-change-panel')
            };
        }
        const hiddenTexts = Object.values(foreignSentinels).map(String);
        main = {
            ownNodeId: ownNode.id,
            foreignNodeId: foreignNode.id,
            beforeHash,
            afterUiHash,
            uiNeutral: beforeHash === afterUiHash,
            uiDifferences: storyDiffPaths(beforeUiSnapshot, afterUiSnapshot),
            ownView,
            ownValidation,
            ownGeneral,
            panelOptimization: {
                sameHtml: ownGeneralRepeat.html === ownGeneral.html,
                afterFirst: panelPerfAfterFirst,
                afterRepeat: panelPerfAfterRepeat,
                revisitSameHtml: ownGeneralAfterTabTour.html === ownGeneral.html,
                beforeRevisit: panelPerfBeforeRevisit,
                afterRevisit: panelPerfAfterRevisit,
                heavyTabsSameHtml: ownPopulationRepeat.html === ownPopulation.html
                    && ownInstitutionsRepeat.html === ownInstitutions.html,
                beforeHeavyRevisit: panelPerfBeforeHeavyRevisit,
                afterHeavyRevisit: panelPerfAfterHeavyRevisit,
                cityReturnSameHtml: ownGeneralAfterCityTour.html === ownGeneral.html,
                cityTourCount: cacheTourNodes.length,
                beforeCityReturn: panelPerfBeforeCityReturn,
                afterCityReturn: panelPerfAfterCityReturn,
                stableInteraction,
                stableEconomyInteraction
            },
            ownPopulation,
            ownInstitutions,
            ownEconomy,
            ownMarket,
            ownLogistics,
            ownFactions,
            ownCharacters,
            topBarWorldState,
            commandCenter,
            factionNotice,
            routeOpened,
            routeState,
            characterOpened,
            characterState,
            characterActions: {
                view: characterActionView,
                buttonCount: actionButtons.length,
                enabledButtonCount: actionButtons.filter(button => !button.disabled).length,
                persuadeClicked: !!persuadeButton,
                receiptAdded: characterActionSummaryAfter.receiptCount === actionReceiptsBefore + 1,
                receipt: playerActionReceipt || null,
                cooldownVisibleAfterAction: /sonra yeniden kullanılabilir/.test(characterStateAfterAction.talkText),
                talkTextAfterAction: characterStateAfterAction.talkText,
                validation: runtime.api.validateCharacterActionLedger(runtime.api.characterActionLedger())
            },
            foreignView,
            foreignValidation,
            foreignGeneral,
            foreignPopulation,
            foreignMarket,
            foreignLogistics,
            foreignSentinels,
            foreignSentinelLeaked: hiddenTexts.some(text => (
                foreignGeneral.html.includes(text)
                || foreignPopulation.html.includes(text)
                || foreignMarket.html.includes(text)
                || foreignLogistics.html.includes(text)
                || JSON.stringify(foreignView).includes(text)
            )),
            eventNavigation
        };
    } finally {
        runtime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'ui.cityDossier': false }
        });
        const story = disabledRuntime.api.state();
        const ownNode = story.nodes.find(node => node.owner === story.playerStateId);
        disabled = disabledRuntime.api.cityDossierBuild(ownNode.id);
    } finally {
        disabledRuntime.dom.window.close();
    }

    const normalOn = runStorySimulation({ seed, seconds: 60 });
    const normalOff = runStorySimulation({
        seed,
        seconds: 60,
        featureFlags: { 'ui.cityDossier': false }
    });
    return {
        main,
        disabled,
        ab: {
            onHash: normalOn.stateHash,
            offHash: normalOff.stateHash,
            equal: normalOn.stateHash === normalOff.stateHash
        }
    };
}

function probeCanonicalMapRaster(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main;
    try {
        runtime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'render.imageDataPoliticalOverlay': false }
        });
        const story = runtime.api.state();
        const beforeHash = hashSnapshot(stateSnapshot(story));
        const raster = runtime.api.mapRasterEnsure();
        const validation = runtime.api.validateMapRaster(raster);
        const diagnostics = runtime.api.mapRasterDiagnostics();
        const worldMapDiagnostics = runtime.api.worldV2().diagnostics.mapRaster;
        const repeat = runtime.api.mapRasterEnsure();
        const sameInstance = runtime.api.mapRasterSameInstance();
        const overlay = runtime.api.mapRasterResample(300, Math.round(300 * raster.height / raster.width));
        const landGrid = runtime.api.mapBuildLandGridReal();
        const renderCacheStarted = process.hrtime.bigint();
        const renderCaches = runtime.api.mapBuildRenderCaches();
        const renderCacheMs = Number(process.hrtime.bigint() - renderCacheStarted) / 1e6;
        const afterHash = hashSnapshot(stateSnapshot(story));

        let gridMismatch = 0;
        let seaRegionLeaks = 0;
        let landRegionMissing = 0;
        for (let index = 0; index < overlay.regionIds.length; index++) {
            if (Number(landGrid.grid[index]) !== Number(overlay.regionIds[index])) gridMismatch++;
            if (!overlay.landMask[index] && overlay.regionIds[index] !== -1) seaRegionLeaks++;
            if (overlay.landMask[index] && overlay.regionIds[index] < 0) landRegionMissing++;
        }

        const terrainWidth = Math.round(1500 * 0.9);
        const terrainHeight = Math.round(1180 * 0.9);
        const terrainLand = runtime.api.mapRasterResampleLand(terrainWidth, terrainHeight);
        let terrainOverlayCoastDifferences = 0;
        for (let y = 0; y < overlay.height; y++) {
            const terrainY = Math.min(terrainHeight - 1, Math.floor((y + 0.5) * terrainHeight / overlay.height));
            for (let x = 0; x < overlay.width; x++) {
                const terrainX = Math.min(terrainWidth - 1, Math.floor((x + 0.5) * terrainWidth / overlay.width));
                if (overlay.landMask[y * overlay.width + x] !== terrainLand[terrainY * terrainWidth + terrainX]) {
                    terrainOverlayCoastDifferences++;
                }
            }
        }

        const landIndex = raster.regionIds.findIndex(regionId => regionId >= 0);
        const seaIndex = raster.landMask.findIndex(value => value === 0);
        const landX = landIndex % raster.width;
        const landY = Math.floor(landIndex / raster.width);
        const seaX = seaIndex % raster.width;
        const seaY = Math.floor(seaIndex / raster.width);
        const landPick = runtime.api.mapRasterPickWorld(
            (landX + 0.5) / raster.width * landGrid.worldWidth,
            (landY + 0.5) / raster.height * landGrid.worldHeight
        );
        const seaPick = runtime.api.mapRasterPickWorld(
            (seaX + 0.5) / raster.width * landGrid.worldWidth,
            (seaY + 0.5) / raster.height * landGrid.worldHeight
        );

        main = {
            beforeHash,
            afterHash,
            uiNeutral: beforeHash === afterHash,
            validation,
            diagnostics,
            worldMapDiagnostics,
            raster: {
                schemaVersion: raster.schemaVersion,
                adapterVersion: raster.adapterVersion,
                width: raster.width,
                height: raster.height,
                sourceHash: raster.sourceHash,
                landHash: raster.landHash,
                regionHash: raster.regionHash,
                landCells: raster.diagnostics.landCells,
                seaCells: raster.diagnostics.seaCells,
                regionCount: raster.diagnostics.regionCount,
                buildMs: raster.diagnostics.buildMs
            },
            repeatHashesEqual: raster.sourceHash === repeat.sourceHash
                && raster.landHash === repeat.landHash
                && raster.regionHash === repeat.regionHash,
            sameInstance,
            overlay: {
                width: overlay.width,
                height: overlay.height,
                landHash: overlay.landHash,
                regionHash: overlay.regionHash,
                gridMismatch,
                seaRegionLeaks,
                landRegionMissing,
                source: landGrid.source
            },
            renderCaches: {
                terrain: renderCaches.terrain,
                overlay: renderCaches.overlay,
                wallTimeMs: Math.round(renderCacheMs * 1000) / 1000
            },
            terrain: {
                width: terrainWidth,
                height: terrainHeight,
                overlayCoastDifferences: terrainOverlayCoastDifferences,
                overlayCells: overlay.landMask.length,
                differenceRatio: Math.round(terrainOverlayCoastDifferences / overlay.landMask.length * 1e8) / 1e8
            },
            hitTest: {
                expectedLandRegionId: Number(raster.regionIds[landIndex]),
                landPick,
                seaPick
            },
            invalid: {
                source: runtime.api.mapRasterInvalidCase('source'),
                landValue: runtime.api.mapRasterInvalidCase('land-value'),
                seaRegion: runtime.api.mapRasterInvalidCase('sea-region'),
                landRegion: runtime.api.mapRasterInvalidCase('land-region'),
                checksum: runtime.api.mapRasterInvalidCase('checksum'),
                length: runtime.api.mapRasterInvalidCase('length')
            }
        };
    } finally {
        runtime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'world.canonicalMapRaster': false }
        });
        disabled = {
            diagnostics: disabledRuntime.api.mapRasterDiagnostics(),
            raster: disabledRuntime.api.mapRasterEnsure()
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const normalOn = runStorySimulation({ seed, seconds: 60 });
    const normalOff = runStorySimulation({
        seed,
        seconds: 60,
        featureFlags: { 'world.canonicalMapRaster': false }
    });
    return {
        main,
        disabled,
        ab: {
            onHash: normalOn.stateHash,
            offHash: normalOff.stateHash,
            equal: normalOn.stateHash === normalOff.stateHash
        }
    };
}

function probePoliticalOverlay(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = runtime.api.state();
        const beforeHash = hashSnapshot(stateSnapshot(story));
        const buildStarted = process.hrtime.bigint();
        const first = runtime.api.politicalOverlayEnsureCanvas();
        const firstBuildWallMs = Number(process.hrtime.bigint() - buildStarted) / 1e6;
        const afterBuildHash = hashSnapshot(stateSnapshot(story));
        const audit = runtime.api.politicalOverlayAudit();
        const transfer = runtime.api.politicalOverlayTransferProbe();
        main = {
            uiNeutral: beforeHash === afterBuildHash,
            first,
            firstBuildWallMs: Math.round(firstBuildWallMs * 1000) / 1000,
            audit,
            transfer,
            diagnostics: runtime.api.politicalOverlayDiagnostics(),
            invalid: {
                source: runtime.api.politicalOverlayInvalidCase('source'),
                owner: runtime.api.politicalOverlayInvalidCase('owner'),
                dimension: runtime.api.politicalOverlayInvalidCase('dimension'),
                rgbaChecksum: runtime.api.politicalOverlayInvalidCase('rgba-checksum'),
                borderChecksum: runtime.api.politicalOverlayInvalidCase('border-checksum'),
                seaAlpha: runtime.api.politicalOverlayInvalidCase('sea-alpha'),
                borderValue: runtime.api.politicalOverlayInvalidCase('border-value'),
                borderTopology: runtime.api.politicalOverlayInvalidCase('border-topology')
            }
        };
    } finally {
        runtime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'render.imageDataPoliticalOverlay': false }
        });
        const legacyStarted = process.hrtime.bigint();
        const legacyRender = disabledRuntime.api.mapBuildOwnerOverlayReal();
        const legacyWallMs = Number(process.hrtime.bigint() - legacyStarted) / 1e6;
        disabled = {
            diagnostics: disabledRuntime.api.politicalOverlayDiagnostics(),
            directCanvas: disabledRuntime.api.politicalOverlayEnsureCanvas(),
            render: legacyRender,
            wallTimeMs: Math.round(legacyWallMs * 1000) / 1000
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const normalOn = runStorySimulation({ seed, seconds: 60 });
    const normalOff = runStorySimulation({
        seed,
        seconds: 60,
        featureFlags: { 'render.imageDataPoliticalOverlay': false }
    });
    return {
        main,
        disabled,
        ab: {
            onHash: normalOn.stateHash,
            offHash: normalOff.stateHash,
            equal: normalOn.stateHash === normalOff.stateHash
        }
    };
}

function probePrebuiltMapRaster(seed = 2032) {
    const assetRuntime = createRuntime(seed >>> 0);
    let asset;
    try {
        assetRuntime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = assetRuntime.api.state();
        const beforeHash = hashSnapshot(stateSnapshot(story));
        const started = process.hrtime.bigint();
        const raster = assetRuntime.api.mapRasterEnsure();
        const wallMs = Number(process.hrtime.bigint() - started) / 1e6;
        const afterHash = hashSnapshot(stateSnapshot(story));
        const snapshot = assetRuntime.api.mapRasterAssetSnapshot();
        asset = {
            uiNeutral: beforeHash === afterHash,
            wallMs: Math.round(wallMs * 1000) / 1000,
            hashes: {
                sourceHash: raster.sourceHash,
                landHash: raster.landHash,
                regionHash: raster.regionHash
            },
            diagnostics: Object.assign({}, raster.diagnostics),
            asset: snapshot ? {
                schemaVersion: snapshot.schemaVersion,
                adapterVersion: snapshot.adapterVersion,
                encoding: snapshot.encoding,
                width: snapshot.width,
                height: snapshot.height,
                sourceHash: snapshot.sourceHash,
                landHash: snapshot.landHash,
                regionHash: snapshot.regionHash,
                payloadHash: snapshot.payloadHash,
                runCount: snapshot.runCount,
                rawPixelCount: snapshot.rawPixelCount,
                payloadBytes: snapshot.payloadBytes
            } : null,
            invalid: {
                schema: assetRuntime.api.mapRasterAssetInvalidCase('schema'),
                source: assetRuntime.api.mapRasterAssetInvalidCase('source'),
                encoding: assetRuntime.api.mapRasterAssetInvalidCase('encoding'),
                payloadHash: assetRuntime.api.mapRasterAssetInvalidCase('payload-hash'),
                runCount: assetRuntime.api.mapRasterAssetInvalidCase('run-count'),
                truncated: assetRuntime.api.mapRasterAssetInvalidCase('truncated')
            },
            fallback: {
                missing: assetRuntime.api.mapRasterAssetFallbackCase('missing'),
                source: assetRuntime.api.mapRasterAssetFallbackCase('source'),
                payload: assetRuntime.api.mapRasterAssetFallbackCase('payload')
            }
        };
    } finally {
        assetRuntime.dom.window.close();
    }

    const generatedRuntime = createRuntime(seed >>> 0);
    let generated;
    try {
        generatedRuntime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'world.prebuiltMapRaster': false }
        });
        const started = process.hrtime.bigint();
        const raster = generatedRuntime.api.mapRasterEnsure();
        const wallMs = Number(process.hrtime.bigint() - started) / 1e6;
        generated = {
            wallMs: Math.round(wallMs * 1000) / 1000,
            hashes: {
                sourceHash: raster.sourceHash,
                landHash: raster.landHash,
                regionHash: raster.regionHash
            },
            diagnostics: Object.assign({}, raster.diagnostics)
        };
    } finally {
        generatedRuntime.dom.window.close();
    }

    const normalOn = runStorySimulation({ seed, seconds: 60 });
    const normalOff = runStorySimulation({
        seed,
        seconds: 60,
        featureFlags: { 'world.prebuiltMapRaster': false }
    });
    return {
        asset,
        generated,
        ab: {
            onHash: normalOn.stateHash,
            offHash: normalOff.stateHash,
            equal: normalOn.stateHash === normalOff.stateHash
        }
    };
}

function probeAdaptiveMapWarp(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = runtime.api.state();
        const beforeHash = hashSnapshot(stateSnapshot(story));
        const adaptive720 = runtime.api.warpRun(1280, 720, 1, true);
        const adaptive1080 = runtime.api.warpRun(1920, 1080, 1, true);
        const adaptive1440 = runtime.api.warpRun(2560, 1440, 1, true);
        const adaptiveClose = runtime.api.warpRun(1920, 1080, 4, true);
        const fixed1080 = runtime.api.warpRun(1920, 1080, 1, false);
        const invalid = runtime.api.warpInvalidSource();
        const afterHash = hashSnapshot(stateSnapshot(story));
        main = {
            uiNeutral: beforeHash === afterHash,
            adaptive720,
            adaptive1080,
            adaptive1440,
            adaptiveClose,
            fixed1080,
            invalid,
            callReduction1080: 1 - adaptive1080.rows / fixed1080.rows
        };
    } finally {
        runtime.dom.window.close();
    }
    const normalOn = runStorySimulation({ seed, seconds: 60 });
    const normalOff = runStorySimulation({
        seed,
        seconds: 60,
        featureFlags: { 'render.adaptiveMapWarp': false }
    });
    return {
        main,
        ab: {
            onHash: normalOn.stateHash,
            offHash: normalOff.stateHash,
            equal: normalOn.stateHash === normalOff.stateHash
        }
    };
}

function probeMapCacheInvalidation(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = runtime.api.state();
        const beforeHash = hashSnapshot(stateSnapshot(story));
        const contract = runtime.api.mapCacheContractProbe();
        const afterHash = hashSnapshot(stateSnapshot(story));
        main = {
            uiNeutral: beforeHash === afterHash,
            contract
        };
    } finally {
        runtime.dom.window.close();
    }
    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'render.mapCacheInvalidation': false }
        });
        disabled = {
            diagnostics: disabledRuntime.api.mapCacheDiagnostics(),
            invalidation: disabledRuntime.api.mapCacheInvalidate('era', 'disabled-probe')
        };
    } finally {
        disabledRuntime.dom.window.close();
    }
    const normalOn = runStorySimulation({ seed, seconds: 60 });
    const normalOff = runStorySimulation({
        seed,
        seconds: 60,
        featureFlags: { 'render.mapCacheInvalidation': false }
    });
    return {
        main,
        disabled,
        ab: {
            onHash: normalOn.stateHash,
            offHash: normalOff.stateHash,
            equal: normalOn.stateHash === normalOff.stateHash
        }
    };
}

function probePopulationCohorts(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main;
    let savedRaw;
    let savedLedger;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = runtime.api.state();
        const ledger = runtime.api.populationLedger();
        const world = runtime.api.worldV2();
        const knowledge = runtime.api.playerKnowledge(world, 'country:0');
        const ownWorldRegion = world.regions.find(region => region.ownerId === 'country:0');
        const foreignWorldRegion = world.regions.find(region => region.ownerId !== 'country:0');
        const ownKnowledge = knowledge.regions.find(region => region.id === ownWorldRegion.id);
        const foreignKnowledge = knowledge.regions.find(region => region.id === foreignWorldRegion.id);
        const regionIds = Object.keys(ledger.regions);
        const liveRegionExact = regionIds.every(regionId => {
            const node = story.nodes[Number(regionId.split(':')[1])];
            const livePopulation = Number.isFinite(Number(node.pop)) && Number(node.pop) > 0
                ? Number(node.pop)
                : 10 + Math.max(0, (Number(node.level) || 1) - 1) * 28;
            return ledger.regions[regionId].populationPeople === Math.round(livePopulation * 1000)
                && ledger.regions[regionId].cohorts.reduce((sum, row) => sum + row.membersPeople, 0)
                    === ledger.regions[regionId].populationPeople;
        });
        const countryExact = Object.values(ledger.countries).every(country => (
            country.populationPeople === Object.values(ledger.regions)
                .filter(region => region.countryId === country.countryId)
                .reduce((sum, region) => sum + region.populationPeople, 0)
        ));
        const firstRegionId = regionIds[0];
        const labor = runtime.api.populationLaborSupply(firstRegionId, 1);
        runtime.api.regionalTick(4);
        const regionalAfterLabor = runtime.api.regionalLedger();
        const scarceRegion = story.population.regions[firstRegionId];
        for (const cohort of scarceRegion.cohorts) cohort.shareBps = cohort.profileKey === 'children' ? 10000 : 0;
        runtime.api.populationTick(5);
        const scarceLabor = runtime.api.populationLaborSupply(firstRegionId, 1);
        runtime.api.regionalTick(4);
        const scarceRegionalTick = runtime.api.regionalLedger().regions[firstRegionId].lastTick;
        const node = story.nodes[Number(firstRegionId.split(':')[1])];
        const beforePopulation = ledger.regions[firstRegionId].populationPeople;
        const beforeOwner = node.owner;
        const livePopulation = Number.isFinite(Number(node.pop)) && Number(node.pop) > 0
            ? Number(node.pop)
            : 10 + Math.max(0, (Number(node.level) || 1) - 1) * 28;
        node.pop = livePopulation + 0.137;
        node.owner = beforeOwner === 0 ? 1 : 0;
        runtime.api.populationTick(5);
        const reconciled = runtime.api.populationRegionView(firstRegionId);
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        savedLedger = runtime.api.populationLedger();
        const migrated = runtime.api.migrateRaw(savedRaw);
        main = {
            validation: runtime.api.validatePopulationLedger(runtime.api.populationLedger()),
            worldValidation: runtime.api.validateWorldV2(runtime.api.worldV2()),
            knowledgeValidation: runtime.api.validatePlayerKnowledge(knowledge),
            summary: runtime.api.populationSummary(),
            liveRegionExact,
            countryExact,
            distinctDistributions: new Set(regionIds.slice(0, 24).map(regionId => (
                ledger.regions[regionId].cohorts.map(row => row.shareBps).join(',')
            ))).size,
            worldCohortCount: world.populationCohorts.length,
            ownCensus: ownKnowledge.populationCohorts,
            foreignCensus: foreignKnowledge.populationCohorts,
            labor,
            regionalLabor: regionalAfterLabor.regions[firstRegionId].lastTick.labor,
            cohortLaborTotal: regionalAfterLabor.totals.cohortLaborSupply.labor,
            externalLaborTotal: regionalAfterLabor.totals.externalInflow.labor,
            laborScarcity: {
                labor: scarceLabor,
                consumedLabor: scarceRegionalTick.productionConsumedByResource.labor,
                producedTotal: Object.values(scarceRegionalTick.producedByResource).reduce((sum, value) => sum + value, 0),
                validation: runtime.api.validatePopulationLedger(runtime.api.populationLedger())
            },
            migration: {
                ok: migrated.ok,
                cohortCount: migrated.ok ? migrated.world.populationCohorts.length : 0,
                validation: migrated.ok ? runtime.api.validateWorldV2(migrated.world) : null
            },
            reconciliation: {
                beforePopulation,
                expectedPopulation: Math.round(node.pop * 1000),
                actualPopulation: reconciled.populationPeople,
                expectedCountryId: `country:${node.owner}`,
                actualCountryId: reconciled.countryId,
                cohortTotal: reconciled.cohorts.reduce((sum, row) => sum + row.membersPeople, 0)
            }
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        restored = {
            loaded,
            validation: restoredRuntime.api.validatePopulationLedger(restoredRuntime.api.populationLedger()),
            exact: JSON.stringify(restoredRuntime.api.populationLedger()) === JSON.stringify(savedLedger)
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const legacySave = JSON.parse(savedRaw);
    delete legacySave.population;
    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        legacy = {
            loaded: legacyRuntime.api.loadNow(),
            validation: null,
            diagnostics: null
        };
        legacy.validation = legacyRuntime.api.validatePopulationLedger(legacyRuntime.api.populationLedger());
        legacy.diagnostics = legacyRuntime.api.populationLedger().diagnostics;
    } finally {
        legacyRuntime.dom.window.close();
    }

    const corruptSave = JSON.parse(savedRaw);
    const corruptRegionId = Object.keys(corruptSave.population.regions)[0];
    corruptSave.population.regions[corruptRegionId].cohorts[0].membersPeople++;
    const corruptRuntime = createRuntime(seed >>> 0);
    let corrupt;
    try {
        corruptRuntime.api.putSavedRaw(JSON.stringify(corruptSave));
        corrupt = {
            loaded: corruptRuntime.api.loadNow(),
            validation: null,
            diagnostics: null
        };
        corrupt.validation = corruptRuntime.api.validatePopulationLedger(corruptRuntime.api.populationLedger());
        corrupt.diagnostics = corruptRuntime.api.populationLedger().diagnostics;
    } finally {
        corruptRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'population.cohorts': false }
        });
        disabled = {
            summary: disabledRuntime.api.populationSummary(),
            ledger: disabledRuntime.api.populationLedger(),
            worldCohortCount: disabledRuntime.api.worldV2().populationCohorts.length
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const on = runStorySimulation({ seed, seconds: 20 });
    const off = runStorySimulation({ seed, seconds: 20, featureFlags: { 'population.cohorts': false } });
    return { main, restored, legacy, corrupt, disabled, ab: { onHash: on.stateHash, offHash: off.stateHash, changed: on.stateHash !== off.stateHash } };
}

function probeNeedsWelfare(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main;
    let savedRaw;
    let savedLedger;
    try {
        runtime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            // Faz 24 kendi legacy ulke-capli _strikeUntil vekilini sinar.
            // Faz 26 acikken canli oyun yalniz kanitli bolgesel grevi kabul eder.
            featureFlags: {
                'economy.saleSettlement': false,
                'society.collectiveAction': false
            }
        });
        const story = runtime.api.state();
        const ownNode = story.nodes.find(node => node.owner === story.playerStateId);
        const foreignNode = story.nodes.find(node => node.owner !== story.playerStateId);
        if (!ownNode || !foreignNode) throw new Error('Faz 24 probu icin kendi/yabanci bolge bulunamadi.');
        const regionId = `region:${ownNode.id}`;
        const childId = `cohort:${ownNode.id}:children`;
        const adultPublicId = `cohort:${ownNode.id}:adult_public`;
        const adultServicesId = `cohort:${ownNode.id}:adult_services`;

        runtime.api.regionalTick(4);
        runtime.api.needsTick(5);
        const baselineRegion = runtime.api.needsRegionView(regionId);
        const baselineChild = runtime.api.needsCohortView(childId);
        const baselineAdultPublic = runtime.api.needsCohortView(adultPublicId);
        const baselineAdultServices = runtime.api.needsCohortView(adultServicesId);

        const welfareBefore = story.states.map(state => state.welfare);
        runtime.api.needsTick(5);
        const welfareAfter = story.states.map(state => state.welfare);

        const regional = story.regionalEconomy.regions[regionId];
        runtime.api.regionalStockDelta(regionId, 'food', -Math.max(0, Number(regional.stocks.food) || 0), {
            type: 'TEST_FIXTURE',
            source: 'probe.needs.food-shock'
        });
        runtime.api.regionalStockDelta(regionId, 'energy', -Math.max(0, Number(regional.stocks.energy) || 0), {
            type: 'TEST_FIXTURE',
            source: 'probe.needs.energy-shock'
        });
        for (const sectorId of Object.keys(regional.sectorCapacity || {})) regional.sectorCapacity[sectorId] = 0;
        runtime.api.regionalTick(4);
        runtime.api.needsTick(5);
        const shockedRegion = runtime.api.needsRegionView(regionId);
        const shockedChild = runtime.api.needsCohortView(childId);
        const shockedAdultPublic = runtime.api.needsCohortView(adultPublicId);
        const physicalAllocations = runtime.api.regionalLedger().regions[regionId].lastTick.allocations;

        const ownerState = story.states.find(state => state.id === ownNode.owner);
        ownerState._strikeUntil = story.clock + 100;
        runtime.api.needsTick(5);
        const strikeAdultServices = runtime.api.needsCohortView(adultServicesId);

        ownNode._siege = { by: foreignNode.owner, since: story.clock };
        runtime.api.needsTick(5);
        const siegeRegion = runtime.api.needsRegionView(regionId);

        const world = runtime.api.worldV2();
        const knowledge = runtime.api.playerKnowledge(world, `country:${story.playerStateId}`);
        const ownKnowledge = knowledge.regions.find(region => region.id === regionId);
        const foreignKnowledge = knowledge.regions.find(region => region.id === `region:${foreignNode.id}`);
        const populationUi = runtime.api.renderCityDossier(ownNode.id, 'nufus');

        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        savedLedger = runtime.api.needsLedger();
        const savedPayloadLedger = JSON.parse(savedRaw).needsWelfare;
        const migrated = runtime.api.migrateRaw(savedRaw);
        const migratedRegion = migrated.ok ? migrated.world.regions.find(region => region.id === regionId) : null;
        const migratedChild = migrated.ok ? migrated.world.populationCohorts.find(cohort => cohort.id === childId) : null;
        main = {
            validation: runtime.api.validateNeedsLedger(savedLedger),
            saveOk: story._lastSaveOk === true,
            worldValidation: runtime.api.validateWorldV2(world),
            knowledgeValidation: runtime.api.validatePlayerKnowledge(knowledge),
            summary: runtime.api.needsSummary(),
            saveExact: JSON.stringify(savedPayloadLedger) === JSON.stringify(savedLedger),
            baseline: {
                region: baselineRegion,
                child: baselineChild,
                adultPublic: baselineAdultPublic,
                adultServices: baselineAdultServices
            },
            legacyWelfareUntouched: JSON.stringify(welfareBefore) === JSON.stringify(welfareAfter),
            shock: {
                region: shockedRegion,
                child: shockedChild,
                adultPublic: shockedAdultPublic,
                childWellbeingDropBps: baselineChild.wellbeingBps - shockedChild.wellbeingBps,
                adultPublicWellbeingDropBps: baselineAdultPublic.wellbeingBps - shockedAdultPublic.wellbeingBps,
                householdFoodAllocation: physicalAllocations.find(row => row.consumerType === 'HOUSEHOLDS' && row.resourceId === 'food') || null,
                householdEnergyAllocation: physicalAllocations.find(row => row.consumerType === 'HOUSEHOLDS' && row.resourceId === 'energy') || null
            },
            strike: {
                baselineIncomeSecurityBps: baselineAdultServices.incomeSecurityBps,
                activeIncomeSecurityBps: strikeAdultServices.incomeSecurityBps
            },
            siege: {
                baselineSecurityBps: baselineRegion.securityBps,
                activeSecurityBps: siegeRegion.securityBps
            },
            knowledge: {
                own: ownKnowledge.needsWelfare,
                foreign: foreignKnowledge.needsWelfare
            },
            ui: {
                hasLivingConditions: populationUi.text.includes('YA\u015eAM KO\u015eULLARI'),
                hasProxyDisclosure: populationUi.text.includes('\u00fccret de\u011fil, istihdam vekili')
            },
            migration: {
                ok: migrated.ok,
                validation: migrated.ok ? runtime.api.validateWorldV2(migrated.world) : null,
                regionNeedsPreserved: !!(migratedRegion && migratedRegion.needsWelfare),
                cohortNeedsPreserved: !!(migratedChild && migratedChild.needsWelfare),
                unmappedNeeds: !!(migrated.ok
                    && migrated.world.diagnostics.migration.unmappedTopLevelFields.includes('needsWelfare'))
            }
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        restored = { loaded: restoredRuntime.api.loadNow(), validation: null, exact: false, firstDifference: null };
        const restoredLedger = restoredRuntime.api.needsLedger();
        restored.validation = restoredRuntime.api.validateNeedsLedger(restoredLedger);
        restored.diagnostics = restoredLedger && restoredLedger.diagnostics;
        restored.exact = JSON.stringify(restoredLedger) === JSON.stringify(savedLedger);
        if (!restored.exact) {
            const firstDifference = (left, right, path) => {
                if (Object.is(left, right)) return null;
                if (left == null || right == null || typeof left !== 'object' || typeof right !== 'object') {
                    return { path, saved: left, restored: right };
                }
                const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
                for (const key of keys) {
                    const difference = firstDifference(left[key], right[key], `${path}.${key}`);
                    if (difference) return difference;
                }
                return null;
            };
            restored.firstDifference = firstDifference(savedLedger, restoredLedger, 'needsWelfare');
        }
    } finally {
        restoredRuntime.dom.window.close();
    }

    const legacySave = JSON.parse(savedRaw);
    delete legacySave.needsWelfare;
    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        legacy = { loaded: legacyRuntime.api.loadNow(), validation: null, diagnostics: null };
        legacy.validation = legacyRuntime.api.validateNeedsLedger(legacyRuntime.api.needsLedger());
        legacy.diagnostics = legacyRuntime.api.needsLedger().diagnostics;
    } finally {
        legacyRuntime.dom.window.close();
    }

    const corruptSave = JSON.parse(savedRaw);
    const corruptRegionId = Object.keys(corruptSave.needsWelfare.regions)[0];
    corruptSave.needsWelfare.regions[corruptRegionId].cohorts[0].wellbeingBps = 10001;
    const corruptRuntime = createRuntime(seed >>> 0);
    let corrupt;
    try {
        corruptRuntime.api.putSavedRaw(JSON.stringify(corruptSave));
        corrupt = { loaded: corruptRuntime.api.loadNow(), validation: null, diagnostics: null };
        corrupt.validation = corruptRuntime.api.validateNeedsLedger(corruptRuntime.api.needsLedger());
        corrupt.diagnostics = corruptRuntime.api.needsLedger().diagnostics;
    } finally {
        corruptRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'population.needsWelfare': false }
        });
        disabled = {
            summary: disabledRuntime.api.needsSummary(),
            ledger: disabledRuntime.api.needsLedger(),
            worldRegionNeeds: disabledRuntime.api.worldV2().regions.filter(region => region.needsWelfare != null).length
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const on = runStorySimulation({
        seed,
        seconds: 20,
        featureFlags: { 'economy.saleSettlement': false }
    });
    const off = runStorySimulation({
        seed,
        seconds: 20,
        featureFlags: {
            'population.needsWelfare': false,
            'economy.saleSettlement': false
        }
    });
    return { main, restored, legacy, corrupt, disabled, ab: { onHash: on.stateHash, offHash: off.stateHash, changed: on.stateHash !== off.stateHash } };
}

function probePublicOpinion(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main;
    let savedRaw;
    let savedLedger;
    try {
        runtime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'economy.saleSettlement': false }
        });
        const story = runtime.api.state();
        const ownNode = story.nodes.find(node => node.owner === story.playerStateId);
        const foreignNode = story.nodes.find(node => node.owner !== story.playerStateId);
        if (!ownNode || !foreignNode) throw new Error('Faz 25 probu icin kendi/yabanci bolge bulunamadi.');
        const regionId = `region:${ownNode.id}`;
        const childId = `cohort:${ownNode.id}:children`;
        const adultPublicId = `cohort:${ownNode.id}:adult_public`;

        runtime.api.regionalTick(4);
        runtime.api.needsTick(5);
        const needsBeforeOpinion = hashSnapshot(runtime.api.needsLedger());
        const welfareBefore = JSON.stringify(story.states.map(state => state.welfare));
        const factionsBefore = JSON.stringify(story.states.map(state => state.factions || null));
        runtime.api.opinionTick(5);
        const baselineChild = runtime.api.opinionCohortView(childId);
        const needsAfterOpinion = hashSnapshot(runtime.api.needsLedger());

        const regional = story.regionalEconomy.regions[regionId];
        runtime.api.regionalStockDelta(regionId, 'food', -Math.max(0, Number(regional.stocks.food) || 0), {
            type: 'TEST_FIXTURE', source: 'probe.opinion.food-shock'
        });
        runtime.api.regionalStockDelta(regionId, 'energy', -Math.max(0, Number(regional.stocks.energy) || 0), {
            type: 'TEST_FIXTURE', source: 'probe.opinion.energy-shock'
        });
        for (const sectorId of Object.keys(regional.sectorCapacity || {})) regional.sectorCapacity[sectorId] = 0;
        for (let index = 0; index < 3; index++) {
            runtime.api.regionalTick(4);
            runtime.api.needsTick(5);
            runtime.api.opinionTick(5);
        }
        const shockedChild = runtime.api.opinionCohortView(childId);
        const shockedAdultPublic = runtime.api.opinionCohortView(adultPublicId);
        const childFood = shockedChild.records.find(record => record.problemType === 'food');
        const adultFood = shockedAdultPublic.records.find(record => record.problemType === 'food');
        const baselineFood = baselineChild && baselineChild.records.find(record => record.problemType === 'food');

        const sampleBase = {
            cohortId: childId,
            regionId,
            countryId: `country:${story.playerStateId}`,
            membersPeople: 1000,
            problemType: 'food',
            blamedActorId: `company:${story.playerStateId}:agriculture`,
            blamedActorKind: 'COMPANY',
            blameBasisCode: 'FOOD_SUPPLY_PROVIDER',
            blameConfidenceBps: 7600,
            sourceAccessBps: 4000,
            salienceWeightBps: 2800,
            sourceNeedsTick: 1
        };
        let trajectoryRecord = null;
        for (let index = 0; index < 3; index++) trajectoryRecord = runtime.api.opinionAdvanceRecord(
            trajectoryRecord,
            Object.assign({}, sampleBase, { pressureBps: 6000, at: (index + 1) * 5 })
        );
        const firstPeak = trajectoryRecord.rememberedSeverityBps;
        for (let index = 0; index < 4; index++) trajectoryRecord = runtime.api.opinionAdvanceRecord(
            trajectoryRecord,
            Object.assign({}, sampleBase, { pressureBps: 0, sourceAccessBps: 10000, at: 20 + index * 5 })
        );
        const afterPartialRecovery = trajectoryRecord.rememberedSeverityBps;
        const recoveryState = trajectoryRecord.state;
        for (let index = 0; index < 3; index++) trajectoryRecord = runtime.api.opinionAdvanceRecord(
            trajectoryRecord,
            Object.assign({}, sampleBase, { pressureBps: 6000, at: 40 + index * 5 })
        );
        const secondPeak = trajectoryRecord.rememberedSeverityBps;
        const repeatedEpisodeCount = trajectoryRecord.episodeCount;
        let forgettingTicks = 0;
        while (trajectoryRecord && forgettingTicks < 400) {
            forgettingTicks++;
            trajectoryRecord = runtime.api.opinionAdvanceRecord(
                trajectoryRecord,
                Object.assign({}, sampleBase, {
                    pressureBps: 0,
                    sourceAccessBps: 10000,
                    at: 60 + forgettingTicks * 5
                })
            );
        }

        const world = runtime.api.worldV2();
        const knowledge = runtime.api.playerKnowledge(world, `country:${story.playerStateId}`);
        const ownKnowledge = knowledge.regions.find(region => region.id === regionId);
        const foreignKnowledge = knowledge.regions.find(region => region.id === `region:${foreignNode.id}`);
        const populationUi = runtime.api.renderCityDossier(ownNode.id, 'nufus');
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        savedLedger = runtime.api.opinionLedger();
        const savedPayloadLedger = JSON.parse(savedRaw).publicOpinion;
        const migrated = runtime.api.migrateRaw(savedRaw);
        const migratedRegion = migrated.ok ? migrated.world.regions.find(region => region.id === regionId) : null;
        const migratedChild = migrated.ok ? migrated.world.populationCohorts.find(cohort => cohort.id === childId) : null;
        main = {
            validation: runtime.api.validateOpinionLedger(savedLedger),
            saveOk: story._lastSaveOk === true,
            saveExact: JSON.stringify(runtime.api.opinionExpandSaved(savedPayloadLedger))
                === JSON.stringify(savedLedger),
            compactStorage: savedPayloadLedger.storageFormat,
            compactCharacters: JSON.stringify(savedPayloadLedger).length,
            worldValidation: runtime.api.validateWorldV2(world),
            knowledgeValidation: runtime.api.validatePlayerKnowledge(knowledge),
            summary: runtime.api.opinionSummary(),
            sourceReadOnly: needsBeforeOpinion === needsAfterOpinion,
            legacyWelfareUntouched: welfareBefore === JSON.stringify(story.states.map(state => state.welfare)),
            factionsUntouched: factionsBefore === JSON.stringify(story.states.map(state => state.factions || null)),
            shock: {
                baselineFoodSeverityBps: baselineFood ? baselineFood.rememberedSeverityBps : 0,
                childFood,
                adultFood,
                expectedActorId: `company:${story.playerStateId}:agriculture`
            },
            trajectory: {
                firstPeak,
                afterPartialRecovery,
                recoveryState,
                secondPeak,
                repeatedEpisodeCount,
                forgettingTicks,
                fullyForgotten: trajectoryRecord === null
            },
            knowledge: {
                own: ownKnowledge.publicOpinion,
                foreign: foreignKnowledge.publicOpinion
            },
            ui: {
                hasComplaintMemory: populationUi.text.includes('B\u0130R\u0130KEN \u015e\u0130K\u00c2YETLER'),
                hasPerceivedResponsibility: populationUi.text.includes('SORUMLU G\u00d6R\u00dcLEN')
            },
            migration: {
                ok: migrated.ok,
                validation: migrated.ok ? runtime.api.validateWorldV2(migrated.world) : null,
                regionOpinionPreserved: !!(migratedRegion && migratedRegion.publicOpinion),
                cohortOpinionPreserved: !!(migratedChild && migratedChild.publicOpinion),
                unmappedOpinion: !!(migrated.ok
                    && migrated.world.diagnostics.migration.unmappedTopLevelFields.includes('publicOpinion'))
            }
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        restored = { loaded: restoredRuntime.api.loadNow(), validation: null, exact: false };
        const ledger = restoredRuntime.api.opinionLedger();
        restored.validation = restoredRuntime.api.validateOpinionLedger(ledger);
        restored.exact = JSON.stringify(ledger) === JSON.stringify(savedLedger);
    } finally {
        restoredRuntime.dom.window.close();
    }

    const legacySave = JSON.parse(savedRaw);
    delete legacySave.publicOpinion;
    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        legacy = { loaded: legacyRuntime.api.loadNow(), validation: null, diagnostics: null, recordCount: null };
        const ledger = legacyRuntime.api.opinionLedger();
        legacy.validation = legacyRuntime.api.validateOpinionLedger(ledger);
        legacy.diagnostics = ledger.diagnostics;
        legacy.recordCount = legacyRuntime.api.opinionSummary().rememberedRecordCount;
    } finally {
        legacyRuntime.dom.window.close();
    }

    const corruptSave = JSON.parse(savedRaw);
    const corruptCohort = Object.values(corruptSave.publicOpinion.cohorts)
        .find(row => Array.isArray(row.records) && row.records.length);
    // COMPACT_RECORD_ARRAY_V1 alan 11 = rememberedSeverityBps.
    corruptCohort.records[0][11] = 10001;
    const corruptRuntime = createRuntime(seed >>> 0);
    let corrupt;
    try {
        corruptRuntime.api.putSavedRaw(JSON.stringify(corruptSave));
        corrupt = { loaded: corruptRuntime.api.loadNow(), validation: null, diagnostics: null };
        const ledger = corruptRuntime.api.opinionLedger();
        corrupt.validation = corruptRuntime.api.validateOpinionLedger(ledger);
        corrupt.diagnostics = ledger.diagnostics;
    } finally {
        corruptRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'society.publicOpinionMemory': false }
        });
        const world = disabledRuntime.api.worldV2();
        disabled = {
            summary: disabledRuntime.api.opinionSummary(),
            ledger: disabledRuntime.api.opinionLedger(),
            worldRegionOpinionCount: world.regions.filter(region => region.publicOpinion != null).length,
            worldCohortOpinionCount: world.populationCohorts.filter(cohort => cohort.publicOpinion != null).length
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const on = runStorySimulation({
        seed, seconds: 20, featureFlags: { 'economy.saleSettlement': false }
    });
    const off = runStorySimulation({
        seed,
        seconds: 20,
        featureFlags: {
            'society.publicOpinionMemory': false,
            'economy.saleSettlement': false
        }
    });
    const stripOpinion = snapshot => {
        const copy = JSON.parse(JSON.stringify(snapshot));
        delete copy.publicOpinion;
        // Faz 26, Faz 25 kapaninca bagimlilik geregi kapanir; Faz 25'in
        // salt-okunur fiziksel esitlik karsilastirmasinda turetilmis ardil alan
        // da kapsam disinda kalmalidir.
        delete copy.collectiveAction;
        // Faz 27, kamuoyu ve kolektif eylem kanitindan beslendigi icin ayni
        // bagimlilik kapanisinda yok olur; Faz 25 fiziksel esitligine dahil edilmez.
        delete copy.humanMigration;
        // Faz 28 fiziksel ekonomi degil, yukaridaki toplumsal sinyalleri de
        // okuyan turetilmis kurumsal durumdur. Kamuoyu kapaliyken merkezlerin
        // kapasite fotografi farkli olabilir; bu Faz 25'in "eski oynanis ve
        // fiziksel sonuc esitligi" kapisinin parcasi degildir.
        delete copy.powerCenters;
        // Faz 29 kurum yetki şeması güç merkezi aktör kimliklerini imzasında
        // taşır. Kamuoyu kapalıyken güç merkezleri kapanınca bu türetilmiş imza
        // da doğal olarak farklıdır; Faz 25 fiziksel dünyasına ait değildir.
        delete copy.institutions;
        // Faz 30 kamuoyu şikâyetini meşruiyet kanıtı olarak okur. Kamuoyu
        // kapalı A/B yolunda bu ardıl defter bağımlılık gereği kapanır; yeni
        // türetilmiş yönetişim durumu Faz 25'in eski fiziksel eşitlik kapısı
        // değildir ve ayrıca aşağıdaki özetlerle doğrulanır.
        delete copy.stateCapacity;
        // Faz 31 seçimleri devlet kapasitesi ve kurum zincirinin salt-okunur
        // ardılıdır. Kamuoyu kapalı A/B yolunda seçim defterinin kapanması, Faz
        // 25'in fiziksel dünya sonucunda bir fark değildir.
        delete copy.elections;
        return copy;
    };
    return {
        main,
        restored,
        legacy,
        corrupt,
        disabled,
        ab: {
            onHash: on.stateHash,
            offHash: off.stateHash,
            changed: on.stateHash !== off.stateHash,
            physicalEqual: hashSnapshot(stripOpinion(on.snapshot)) === hashSnapshot(stripOpinion(off.snapshot)),
            onStateCapacity: on.stateCapacitySummary,
            offStateCapacity: off.stateCapacitySummary
        }
    };
}

function buildStoryMapRasterAssetData(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    try {
        runtime.api.newCampaign({
            seed,
            playerStateId: 0,
            abundance: 1,
            doctrine: 'combined',
            fog: true,
            featureFlags: { 'world.prebuiltMapRaster': false }
        });
        const raster = runtime.api.mapRasterEnsure();
        return {
            schemaVersion: raster.schemaVersion,
            adapterVersion: raster.adapterVersion,
            width: raster.width,
            height: raster.height,
            geoWidth: raster.geoWidth,
            geoHeight: raster.geoHeight,
            sourceHash: raster.sourceHash,
            landHash: raster.landHash,
            regionHash: raster.regionHash,
            regionIds: Array.from(raster.regionIds)
        };
    } finally {
        runtime.dom.window.close();
    }
}

function probeCollectiveAction(seed = 2032) {
    const sampleFor = (tick, severityBps) => ({
        id: 'movement:country:0|income|country:0',
        countryId: 'country:0',
        problemType: 'income',
        blamedActorId: 'country:0',
        blamedActorKind: 'COUNTRY',
        blameBasisCode: 'INCOME_PROVIDER',
        affectedPeople: 700000,
        affectedShareBps: severityBps > 0 ? 7200 : 0,
        activeCohortShareBps: severityBps > 0 ? 8500 : 0,
        severityBps,
        peakSeverityBps: 9800,
        averageEpisodesBps: severityBps > 0 ? 3000 : 0,
        recurrenceBps: severityBps > 0 ? 3600 : 0,
        organizationTargetBps: severityBps > 0 ? 9000 : 0,
        actionEligible: true,
        sourceOpinionTick: tick,
        at: tick * 5
    });

    const pureRuntime = createRuntime(seed >>> 0);
    let pure;
    try {
        pureRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'economy.saleSettlement': false }
        });
        let quiet = null;
        for (let tick = 1; tick <= 50; tick++) {
            quiet = pureRuntime.api.collectiveAdvanceMovement(quiet, sampleFor(tick, 0));
        }
        let movement = null;
        const firstTick = { PROTEST: null, STRIKE: null, UPRISING: null };
        let protestFixture = null;
        for (let tick = 1; tick <= 120; tick++) {
            movement = pureRuntime.api.collectiveAdvanceMovement(movement, sampleFor(tick, 9800));
            if (movement && movement.stage !== 'NONE' && firstTick[movement.stage] == null) {
                firstTick[movement.stage] = tick;
                if (movement.stage === 'PROTEST' && !protestFixture) protestFixture = JSON.parse(JSON.stringify(movement));
            }
        }
        const conceded = pureRuntime.api.collectiveApplyResponsePure(protestFixture, 'CONCEDE', 500);
        const suppressed = pureRuntime.api.collectiveApplyResponsePure(protestFixture, 'SUPPRESS', 500);
        let concededAfter = conceded;
        let suppressedAfter = suppressed;
        for (let offset = 1; offset <= 24; offset++) {
            const tick = protestFixture.sourceOpinionTick + offset;
            concededAfter = pureRuntime.api.collectiveAdvanceMovement(concededAfter, sampleFor(tick, 9800));
            suppressedAfter = pureRuntime.api.collectiveAdvanceMovement(suppressedAfter, sampleFor(tick, 9800));
        }
        // Salt uzun sureli sikayet ayaklanma uretmemeli. Ayaklanma kanitini,
        // ayni cozulmemis kriz grev asamasinda ikinci kez bastirildiktan sonra
        // ariyoruz: kisa vadeli dagilma + kalici baski hafizasi + geri tepme.
        const secondSuppression = pureRuntime.api.collectiveApplyResponsePure(
            suppressedAfter, 'SUPPRESS', 625
        );
        let suppressionCycle = secondSuppression;
        let suppressionDrivenUprisingTick = null;
        for (let offset = 25; offset <= 120; offset++) {
            const tick = protestFixture.sourceOpinionTick + offset;
            suppressionCycle = pureRuntime.api.collectiveAdvanceMovement(
                suppressionCycle, sampleFor(tick, 9800)
            );
            if (suppressionCycle.stage === 'UPRISING') {
                suppressionDrivenUprisingTick = tick;
                break;
            }
        }
        pure = {
            quietNoAction: quiet === null || quiet.stage === 'NONE',
            firstTick,
            orderedEscalation: firstTick.PROTEST != null
                && firstTick.STRIKE > firstTick.PROTEST,
            noUnprovokedUprising: firstTick.UPRISING == null,
            concession: conceded,
            suppression: suppressed,
            afterSameUnresolvedCrisis: {
                conceded: concededAfter,
                suppressed: suppressedAfter,
                suppressionBackfire: suppressedAfter.radicalizationBps > concededAfter.radicalizationBps
            },
            repeatedSuppression: {
                secondSuppression,
                final: suppressionCycle,
                uprisingTick: suppressionDrivenUprisingTick,
                suppressionDrivenUprising: suppressionDrivenUprisingTick != null
            }
        };
    } finally {
        pureRuntime.dom.window.close();
    }

    const runtime = createRuntime(seed >>> 0);
    let main;
    let savedRaw;
    let savedLedger;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        let observedResponseNotices = [];
        for (let elapsed = 0; elapsed < 180; elapsed += 5) {
            runtime.api.advance(5);
            if (!observedResponseNotices.length) {
                observedResponseNotices = runtime.api.factionNotices().filter(
                    notice => notice.collectiveActionId
                );
            }
        }
        const story = runtime.api.state();
        const ledger = runtime.api.collectiveLedger();
        const world = runtime.api.worldV2();
        const knowledge = runtime.api.playerKnowledge(world, `country:${story.playerStateId}`);
        const ownNode = story.nodes.find(node => node.owner === story.playerStateId);
        const foreignNode = story.nodes.find(node => node.owner !== story.playerStateId);
        const ownRegionId = `region:${ownNode.id}`;
        const foreignRegionId = `region:${foreignNode.id}`;
        const ownKnowledge = knowledge.regions.find(region => region.id === ownRegionId);
        const foreignKnowledge = knowledge.regions.find(region => region.id === foreignRegionId);
        const ownPopulation = runtime.api.renderCityDossier(ownNode.id, 'nufus');
        const foreignPopulation = runtime.api.renderCityDossier(foreignNode.id, 'nufus');
        const notices = runtime.api.factionNotices();
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        savedLedger = runtime.api.collectiveLedger();
        const savedPayload = JSON.parse(savedRaw).collectiveAction;
        const migrated = runtime.api.migrateRaw(savedRaw);
        const migratedCountry = migrated.ok
            ? migrated.world.countries.find(country => country.id === `country:${story.playerStateId}`)
            : null;
        const migratedRegion = migrated.ok
            ? migrated.world.regions.find(region => region.id === ownRegionId)
            : null;
        main = {
            // Save, opinion bolge baglarini guncelleyip kolektif turetilmis
            // ozetlerini ayni atomik sirada uzlastirabilir. Save-oncesi klonu
            // save-sonrasi canli opinion'a karsi dogrulamak sahte aggregate
            // hatasi uretir; kayda giren guncel defteri dogrula.
            validation: runtime.api.validateCollectiveLedger(savedLedger),
            saveOk: story._lastSaveOk === true,
            saveExact: JSON.stringify(savedPayload) === JSON.stringify(savedLedger),
            summary: runtime.api.collectiveSummary(),
            worldValidation: runtime.api.validateWorldV2(world),
            knowledgeValidation: runtime.api.validatePlayerKnowledge(knowledge),
            ownKnowledge: ownKnowledge.collectiveAction,
            foreignKnowledge: foreignKnowledge.collectiveAction,
            foreignSecretsHidden: !/mobilizationBps|radicalizationBps|organizationBps|suppressionMemoryBps/.test(
                JSON.stringify(foreignKnowledge.collectiveAction.value)
            ),
            ui: {
                ownHasCollectiveActions: ownPopulation.text.includes('TOPLUMSAL EYLEMLER'),
                foreignHasCollectiveActions: foreignPopulation.text.includes('TOPLUMSAL EYLEMLER'),
                foreignSecretLeak: /seferberlik %|radikalleşme %/.test(foreignPopulation.text),
                responseNoticeCount: observedResponseNotices.length,
                responseOptionsValid: observedResponseNotices.length > 0
                    && observedResponseNotices
                    .every(notice => JSON.stringify(notice.responseOptions) === JSON.stringify([
                        'CONCEDE', 'NEGOTIATE', 'SUPPRESS', 'IGNORE'
                    ])),
                staleResponseNoticeCount: notices.filter(notice => notice.collectiveActionId).length
            },
            migration: {
                ok: migrated.ok,
                validation: migrated.ok ? runtime.api.validateWorldV2(migrated.world) : null,
                countryPreserved: !!(migratedCountry && migratedCountry.collectiveAction),
                regionPreserved: !!(migratedRegion && migratedRegion.collectiveAction),
                unmapped: !!(migrated.ok
                    && migrated.world.diagnostics.migration.unmappedTopLevelFields.includes('collectiveAction'))
            }
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        restored = { loaded: restoredRuntime.api.loadNow(), validation: null, exact: false };
        const ledger = restoredRuntime.api.collectiveLedger();
        restored.validation = restoredRuntime.api.validateCollectiveLedger(ledger);
        restored.exact = JSON.stringify(ledger) === JSON.stringify(savedLedger);
    } finally {
        restoredRuntime.dom.window.close();
    }

    const legacySave = JSON.parse(savedRaw);
    delete legacySave.collectiveAction;
    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        legacy = { loaded: legacyRuntime.api.loadNow(), validation: null, summary: null, diagnostics: null };
        const ledger = legacyRuntime.api.collectiveLedger();
        legacy.validation = legacyRuntime.api.validateCollectiveLedger(ledger);
        legacy.summary = legacyRuntime.api.collectiveSummary();
        legacy.diagnostics = ledger.diagnostics;
    } finally {
        legacyRuntime.dom.window.close();
    }

    const corruptSave = JSON.parse(savedRaw);
    const corruptMovement = Object.values(corruptSave.collectiveAction.movements)[0];
    if (corruptMovement) corruptMovement.mobilizationBps = 10001;
    const corruptRuntime = createRuntime(seed >>> 0);
    let corrupt;
    try {
        corruptRuntime.api.putSavedRaw(JSON.stringify(corruptSave));
        corrupt = { loaded: corruptRuntime.api.loadNow(), validation: null, diagnostics: null };
        const ledger = corruptRuntime.api.collectiveLedger();
        corrupt.validation = corruptRuntime.api.validateCollectiveLedger(ledger);
        corrupt.diagnostics = ledger.diagnostics;
    } finally {
        corruptRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'society.collectiveAction': false }
        });
        disabledRuntime.api.advance(30);
        const ledger = disabledRuntime.api.collectiveLedger();
        disabled = {
            ledger,
            summary: disabledRuntime.api.collectiveSummary(),
            validation: ledger
                ? disabledRuntime.api.validateCollectiveLedger(ledger)
                : { ok: true, disabled: true, issues: [] }
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const prerequisiteRuntime = createRuntime(seed >>> 0);
    let prerequisiteDisabled;
    try {
        prerequisiteRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: {
                'society.publicOpinionMemory': false,
                'society.collectiveAction': true
            }
        });
        prerequisiteRuntime.api.advance(30);
        prerequisiteDisabled = {
            ledger: prerequisiteRuntime.api.collectiveLedger(),
            summary: prerequisiteRuntime.api.collectiveSummary()
        };
    } finally {
        prerequisiteRuntime.dom.window.close();
    }

    const on = runStorySimulation({ seed, seconds: 180 });
    const off = runStorySimulation({
        seed, seconds: 180, featureFlags: { 'society.collectiveAction': false }
    });
    return {
        pure, main, restored, legacy, corrupt, disabled, prerequisiteDisabled,
        ab: {
            onHash: on.stateHash,
            offHash: off.stateHash,
            changed: on.stateHash !== off.stateHash,
            onValidation: on.collectiveValidation,
            offValidation: off.collectiveValidation,
            onSummary: on.collectiveSummary,
            offSummary: off.collectiveSummary
        }
    };
}

function probeHumanMigration(seed = 2032) {
    const atomicRuntime = createRuntime(seed >>> 0);
    let atomic;
    try {
        atomicRuntime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = atomicRuntime.api.state();
        const originNode = story.nodes.find(node => Array.isArray(node.neighbors) && node.neighbors.length);
        const destinationNode = story.nodes.find(node => node.id === originNode.neighbors[0]);
        const originId = `region:${originNode.id}`;
        const destinationId = `region:${destinationNode.id}`;
        const originBefore = atomicRuntime.api.populationRegionView(originId);
        const destinationBefore = atomicRuntime.api.populationRegionView(destinationId);
        const profile = originBefore.cohorts.find(row => row.membersPeople >= 17);
        const worldBefore = atomicRuntime.api.populationSummary().populationPeople;
        const result = atomicRuntime.api.populationTransferCohorts(
            originId,
            destinationId,
            { [profile.profileKey]: 17 },
            { minimumOriginPopulationPeople: 1000 }
        );
        const originAfter = atomicRuntime.api.populationRegionView(originId);
        const destinationAfter = atomicRuntime.api.populationRegionView(destinationId);
        const worldAfter = atomicRuntime.api.populationSummary().populationPeople;
        atomic = {
            result,
            worldBefore,
            worldAfter,
            exactWorldConservation: worldBefore === worldAfter && result.populationDelta === 0,
            originDelta: originAfter.populationPeople - originBefore.populationPeople,
            destinationDelta: destinationAfter.populationPeople - destinationBefore.populationPeople,
            nodePopulationSynchronized: Math.round(originNode.pop * 1000) === originAfter.populationPeople
                && Math.round(destinationNode.pop * 1000) === destinationAfter.populationPeople,
            validation: atomicRuntime.api.validatePopulationLedger(atomicRuntime.api.populationLedger())
        };
    } finally {
        atomicRuntime.dom.window.close();
    }

    const crisisRuntime = createRuntime((seed + 1) >>> 0);
    let crisis;
    try {
        crisisRuntime.api.newCampaign({ seed: seed + 1, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = crisisRuntime.api.state();
        const originNode = story.nodes.find(node => Array.isArray(node.neighbors) && node.neighbors.length);
        const originId = `region:${originNode.id}`;
        const needs = story.needsWelfare.regions[originId];
        needs.securityBps = 900;
        needs.wellbeingBps = 1800;
        needs.unemploymentRiskBps = 9000;
        for (const row of needs.cohorts || []) {
            row.securityBps = 900;
            row.wellbeingBps = Math.min(row.wellbeingBps, 1800);
            row.unemploymentRiskBps = Math.max(row.unemploymentRiskBps, 9000);
        }
        const beforePeople = crisisRuntime.api.populationSummary().populationPeople;
        crisisRuntime.api.humanMigrationTick(5);
        const ledger = story.humanMigration;
        const flow = ledger.flows.find(row => row.originRegionId === originId && row.kind === 'REFUGEE');
        let capacityBlocked = false;
        let completedAfterCapacity = false;
        let completedPopulationDelta = null;
        if (flow) {
            const destination = crisisRuntime.api.populationRegionView(flow.destinationRegionId);
            ledger.receptionCapacityPeopleByRegion[flow.destinationRegionId] = destination.populationPeople;
            flow.arrivalAt = story.clock;
            crisisRuntime.api.humanMigrationTick(5);
            capacityBlocked = flow.status === 'BLOCKED' && flow.lastFailureReason === 'RECEPTION_CAPACITY';
            ledger.receptionCapacityPeopleByRegion[flow.destinationRegionId] = destination.populationPeople + flow.people + 200;
            flow.arrivalAt = story.clock;
            crisisRuntime.api.humanMigrationTick(5);
            completedAfterCapacity = flow.status === 'COMPLETED';
            completedPopulationDelta = flow.populationDelta;
        }
        const afterPeople = crisisRuntime.api.populationSummary().populationPeople;
        crisis = {
            flow: flow ? JSON.parse(JSON.stringify(flow)) : null,
            refugeeCreated: !!flow,
            capacityBlocked,
            completedAfterCapacity,
            completedPopulationDelta,
            exactWorldConservation: beforePeople === afterPeople,
            populationValidation: crisisRuntime.api.validatePopulationLedger(crisisRuntime.api.populationLedger()),
            migrationValidation: crisisRuntime.api.validateHumanMigrationLedger(crisisRuntime.api.humanMigrationLedger())
        };
    } finally {
        crisisRuntime.dom.window.close();
    }

    const noRouteRuntime = createRuntime((seed + 2) >>> 0);
    let noRoute;
    try {
        noRouteRuntime.api.newCampaign({ seed: seed + 2, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = noRouteRuntime.api.state();
        const originNode = story.nodes.find(node => Array.isArray(node.neighbors) && node.neighbors.length);
        const originId = `region:${originNode.id}`;
        const needs = story.needsWelfare.regions[originId];
        needs.securityBps = 500;
        needs.wellbeingBps = 1000;
        for (const corridor of noRouteRuntime.api.infrastructureGraph().corridors) {
            if (corridor.mode === 'LAND' || corridor.mode === 'SEA') {
                noRouteRuntime.api.infrastructureSetDamage(corridor.id, 10000, { enabled: false });
            }
        }
        noRouteRuntime.api.humanMigrationTick(5);
        noRoute = {
            originRegionId: originId,
            createdFromIsolatedOrigin: noRouteRuntime.api.humanMigrationLedger().flows
                .some(flow => flow.originRegionId === originId),
            validation: noRouteRuntime.api.validateHumanMigrationLedger(noRouteRuntime.api.humanMigrationLedger())
        };
    } finally {
        noRouteRuntime.dom.window.close();
    }

    const runtime = createRuntime(seed >>> 0);
    let main;
    let savedRaw;
    let savedLedger;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        runtime.api.advance(180);
        const story = runtime.api.state();
        const ledger = runtime.api.humanMigrationLedger();
        const world = runtime.api.worldV2();
        const knowledge = runtime.api.playerKnowledge(world, `country:${story.playerStateId}`);
        const ownNode = story.nodes.find(node => node.owner === story.playerStateId);
        const foreignNode = story.nodes.find(node => node.owner !== story.playerStateId);
        const ownRegionId = `region:${ownNode.id}`;
        const foreignRegionId = `region:${foreignNode.id}`;
        const ownKnowledge = knowledge.regions.find(region => region.id === ownRegionId);
        const foreignKnowledge = knowledge.regions.find(region => region.id === foreignRegionId);
        const ownPopulation = runtime.api.renderCityDossier(ownNode.id, 'nufus');
        const foreignPopulation = runtime.api.renderCityDossier(foreignNode.id, 'nufus');
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        savedLedger = runtime.api.humanMigrationLedger();
        const savedPayload = JSON.parse(savedRaw).humanMigration;
        const migrated = runtime.api.migrateRaw(savedRaw);
        const migratedCountry = migrated.ok
            ? migrated.world.countries.find(country => country.id === `country:${story.playerStateId}`)
            : null;
        const migratedRegion = migrated.ok
            ? migrated.world.regions.find(region => region.id === ownRegionId)
            : null;
        main = {
            validation: runtime.api.validateHumanMigrationLedger(ledger),
            populationValidation: runtime.api.validatePopulationLedger(runtime.api.populationLedger()),
            needsValidation: runtime.api.validateNeedsLedger(runtime.api.needsLedger()),
            saveOk: story._lastSaveOk === true,
            saveError: story._lastSaveError || null,
            saveExact: JSON.stringify(savedPayload) === JSON.stringify(savedLedger),
            summary: runtime.api.humanMigrationSummary(),
            completedConservation: ledger.flows.filter(flow => flow.status === 'COMPLETED')
                .every(flow => flow.populationDelta === 0),
            worldValidation: runtime.api.validateWorldV2(world),
            knowledgeValidation: runtime.api.validatePlayerKnowledge(knowledge),
            ownKnowledge: ownKnowledge.humanMigration,
            foreignKnowledge: foreignKnowledge.humanMigration,
            foreignSecretsHidden: !/cohorts|route|evidence|originPushBps|qualityGainBps|receptionCapacityPeople/.test(
                JSON.stringify(foreignKnowledge.humanMigration.value)
            ),
            ui: {
                ownHasMigration: ownPopulation.text.includes('GÖÇ VE MÜLTECİ AKIŞI'),
                foreignHasMigration: foreignPopulation.text.includes('GÖÇ VE MÜLTECİ AKIŞI'),
                foreignSecretLeak: /KABUL KAPASİTESİ|\d+ koridor/.test(foreignPopulation.text)
            },
            migration: {
                ok: migrated.ok,
                validation: migrated.ok ? runtime.api.validateWorldV2(migrated.world) : null,
                countryPreserved: !!(migratedCountry && migratedCountry.humanMigration),
                regionPreserved: !!(migratedRegion && migratedRegion.humanMigration),
                unmapped: !!(migrated.ok
                    && migrated.world.diagnostics.migration.unmappedTopLevelFields.includes('humanMigration'))
            }
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        restored = { loaded: restoredRuntime.api.loadNow(), validation: null, exact: false };
        const ledger = restoredRuntime.api.humanMigrationLedger();
        restored.validation = restoredRuntime.api.validateHumanMigrationLedger(ledger);
        restored.exact = JSON.stringify(ledger) === JSON.stringify(savedLedger);
    } finally {
        restoredRuntime.dom.window.close();
    }

    const legacySave = JSON.parse(savedRaw);
    delete legacySave.humanMigration;
    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        legacy = { loaded: legacyRuntime.api.loadNow(), validation: null, summary: null, diagnostics: null };
        const ledger = legacyRuntime.api.humanMigrationLedger();
        legacy.validation = legacyRuntime.api.validateHumanMigrationLedger(ledger);
        legacy.summary = legacyRuntime.api.humanMigrationSummary();
        legacy.diagnostics = ledger.diagnostics;
    } finally {
        legacyRuntime.dom.window.close();
    }

    const corruptSave = JSON.parse(savedRaw);
    if (corruptSave.humanMigration.flows[0]) corruptSave.humanMigration.flows[0].people++;
    const corruptRuntime = createRuntime(seed >>> 0);
    let corrupt;
    try {
        corruptRuntime.api.putSavedRaw(JSON.stringify(corruptSave));
        corrupt = { loaded: corruptRuntime.api.loadNow(), validation: null, diagnostics: null };
        const ledger = corruptRuntime.api.humanMigrationLedger();
        corrupt.validation = corruptRuntime.api.validateHumanMigrationLedger(ledger);
        corrupt.diagnostics = ledger.diagnostics;
    } finally {
        corruptRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'population.humanMigration': false }
        });
        disabledRuntime.api.advance(30);
        disabled = {
            ledger: disabledRuntime.api.humanMigrationLedger(),
            summary: disabledRuntime.api.humanMigrationSummary()
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const prerequisiteRuntime = createRuntime(seed >>> 0);
    let prerequisiteDisabled;
    try {
        prerequisiteRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: {
                'society.collectiveAction': false,
                'population.humanMigration': true
            }
        });
        prerequisiteRuntime.api.advance(30);
        prerequisiteDisabled = {
            ledger: prerequisiteRuntime.api.humanMigrationLedger(),
            summary: prerequisiteRuntime.api.humanMigrationSummary()
        };
    } finally {
        prerequisiteRuntime.dom.window.close();
    }

    const on = runStorySimulation({ seed, seconds: 180 });
    const off = runStorySimulation({
        seed, seconds: 180, featureFlags: { 'population.humanMigration': false }
    });
    return {
        atomic, crisis, noRoute, main, restored, legacy, corrupt, disabled, prerequisiteDisabled,
        ab: {
            onHash: on.stateHash,
            offHash: off.stateHash,
            changed: on.stateHash !== off.stateHash,
            onValidation: on.humanMigrationValidation,
            offValidation: off.humanMigrationValidation,
            onSummary: on.humanMigrationSummary,
            offSummary: off.humanMigrationSummary,
            populationDelta: on.populationSummary.populationPeople - off.populationSummary.populationPeople
        }
    };
}

function probePowerCenters(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main;
    let savedRaw;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        runtime.api.advance(30);
        const story = runtime.api.state();
        const ledger = runtime.api.powerCenterLedger();
        const validation = runtime.api.validatePowerCenterLedger(ledger);
        const world = runtime.api.worldV2();
        const knowledge = runtime.api.playerKnowledge(world, 'country:0');
        const ownCountry = knowledge.countries.find(row => row.id === 'country:0');
        const foreignCountry = knowledge.countries.find(row => row.id === 'country:1');
        const ownNode = story.nodes.find(node => node.owner === 0);
        const foreignNode = story.nodes.find(node => node.owner !== 0);
        const ownDossier = runtime.api.cityDossierBuild(ownNode.id);
        const foreignDossier = runtime.api.cityDossierBuild(foreignNode.id);
        const ownUi = runtime.api.renderCityDossier(ownNode.id, 'kurumlar');
        const foreignUi = runtime.api.renderCityDossier(foreignNode.id, 'kurumlar');
        const company = runtime.api.companyCountryView('country:0');
        const ownCenters = Object.values(ledger.centers).filter(center => center.countryId === 'country:0');
        const business = ownCenters.find(center => center.type === 'BUSINESS_COUNCIL');
        const laborOrganization = runtime.api.powerCenterOrganizationForProblem('country:0', 'employment');
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        const savedLedger = JSON.parse(savedRaw).powerCenters;
        const migrated = runtime.api.migrateRaw(savedRaw);
        main = {
            validation,
            summary: runtime.api.powerCenterSummary(),
            everyCenterComplete: Object.values(ledger.centers).every(center => (
                center.leader && center.leader.actorId && center.leader.name
                && center.supportBase && Number.isInteger(center.supportBase.supportPeople)
                && center.resources && center.capabilities
                && Array.isArray(center.goals) && center.goals.length === 3
                && center.actionLimits && center.actionLimits.maximumConcurrentActions === 1
                && center.actionLimits.authorityModel === 'INSTITUTION_SCHEMA_PHASE_29'
                && center.actionLimits.declaredActionTypes.length === (
                    center.actionLimits.executableActionTypes.length
                    + center.actionLimits.conditionalActionTypes.length
                    + center.actionLimits.prohibitedActionTypes.length
                )
            )),
            businessCashExact: !!business && Math.abs(business.resources.treasuryCash - company.totals.cash) < 1e-6,
            laborOrganization,
            worldPowerCenterCount: world.powerCenters.length,
            ownKnowledge: ownCountry.powerCenters,
            foreignKnowledge: foreignCountry.powerCenters,
            foreignSecretsHidden: !/supportBase|resources|resourceEvidence|organizationBps|influenceBps|alignmentBps|independenceBps|capabilities|priorityBps|actorId/.test(
                JSON.stringify(foreignCountry.powerCenters.value)
            ),
            ownDossierValidation: runtime.api.validateCityDossier(ownDossier),
            foreignDossierValidation: runtime.api.validateCityDossier(foreignDossier),
            ui: {
                ownHasCenters: /GÜÇ MERKEZLERİ|SİLAHLI KUVVETLER/.test(ownUi.text),
                ownHasCapacity: /ETKİ|örgüt|seferberlik/i.test(ownUi.text),
                foreignHasPublicCenters: /GÜÇ MERKEZLERİ|SİLAHLI KUVVETLER/.test(foreignUi.text),
                foreignSecretLeak: /ETKİ %|örgüt %|mali \d|seferberlik \d|zorlama \d/i.test(foreignUi.text)
            },
            savedExact: JSON.stringify(savedLedger) === JSON.stringify(ledger),
            migration: {
                ok: migrated.ok,
                validation: migrated.ok ? runtime.api.validateWorldV2(migrated.world) : null,
                topLevelCount: migrated.ok ? migrated.world.powerCenters.length : 0,
                countryPreserved: !!(migrated.ok && migrated.world.countries[0].powerCenters),
                regionPreserved: !!(migrated.ok && migrated.world.regions[0].powerCenters),
                unmapped: !!(migrated.ok && migrated.world.diagnostics.migration.unmappedTopLevelFields.includes('powerCenters'))
            }
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const ledger = restoredRuntime.api.powerCenterLedger();
        restored = {
            loaded,
            validation: restoredRuntime.api.validatePowerCenterLedger(ledger),
            exact: JSON.stringify(ledger) === JSON.stringify(JSON.parse(savedRaw).powerCenters)
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const legacySave = JSON.parse(savedRaw);
    delete legacySave.powerCenters;
    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        legacyRuntime.api.loadNow();
        const ledger = legacyRuntime.api.powerCenterLedger();
        legacy = {
            validation: legacyRuntime.api.validatePowerCenterLedger(ledger),
            diagnostics: ledger.diagnostics,
            summary: legacyRuntime.api.powerCenterSummary()
        };
    } finally {
        legacyRuntime.dom.window.close();
    }

    const corruptSave = JSON.parse(savedRaw);
    const corruptId = Object.keys(corruptSave.powerCenters.centers)[0];
    corruptSave.powerCenters.centers[corruptId].influenceBps = 20000;
    const corruptRuntime = createRuntime(seed >>> 0);
    let corrupt;
    try {
        corruptRuntime.api.putSavedRaw(JSON.stringify(corruptSave));
        corruptRuntime.api.loadNow();
        const ledger = corruptRuntime.api.powerCenterLedger();
        corrupt = {
            validation: corruptRuntime.api.validatePowerCenterLedger(ledger),
            diagnostics: ledger.diagnostics
        };
    } finally {
        corruptRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'society.powerCenters': false }
        });
        disabledRuntime.api.advance(30);
        disabled = {
            ledger: disabledRuntime.api.powerCenterLedger(),
            summary: disabledRuntime.api.powerCenterSummary(),
            fallbackOrganization: disabledRuntime.api.powerCenterOrganizationForProblem('country:0', 'employment')
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const prerequisiteRuntime = createRuntime(seed >>> 0);
    let prerequisiteDisabled;
    try {
        prerequisiteRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'economy.companiesBanks': false, 'society.powerCenters': true }
        });
        prerequisiteRuntime.api.advance(30);
        prerequisiteDisabled = {
            ledger: prerequisiteRuntime.api.powerCenterLedger(),
            summary: prerequisiteRuntime.api.powerCenterSummary()
        };
    } finally {
        prerequisiteRuntime.dom.window.close();
    }

    const on = runStorySimulation({ seed, seconds: 180 });
    const off = runStorySimulation({
        seed, seconds: 180, featureFlags: { 'society.powerCenters': false }
    });
    return {
        main, restored, legacy, corrupt, disabled, prerequisiteDisabled,
        ab: {
            onHash: on.stateHash,
            offHash: off.stateHash,
            changed: on.stateHash !== off.stateHash,
            onValidation: on.powerCenterValidation,
            offValidation: off.powerCenterValidation,
            onSummary: on.powerCenterSummary,
            offSummary: off.powerCenterSummary,
            onCollectiveValidation: on.collectiveValidation,
            offCollectiveValidation: off.collectiveValidation
        }
    };
}

function probeInstitutions(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main;
    let savedRaw;
    let savedLedger;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        runtime.api.advance(10);
        const story = runtime.api.state();
        const countryId = 'country:0';
        const ledger = runtime.api.institutionLedger();
        const country = ledger.countries[countryId];
        const institutionOf = type => Object.values(country.institutions).find(row => row.type === type);
        const actorFor = institution => ({
            institutionId: institution.id,
            actorId: institution.officeHolder.actorId
        });

        const judiciary = institutionOf('JUDICIARY');
        const directSubmitted = runtime.api.institutionSubmit(Object.assign({
            countryId, actionType: 'REVIEW_LEGALITY'
        }, actorFor(judiciary)));
        const directExecuted = directSubmitted.ok
            ? runtime.api.institutionExecute(directSubmitted.request.id, actorFor(judiciary)) : directSubmitted;

        const business = Object.values(story.powerCenters.centers)
            .find(row => row.countryId === countryId && row.type === 'BUSINESS_COUNCIL');
        const centerActor = { powerCenterId: business.id, actorId: business.leader.actorId };
        const centerDirectSubmitted = runtime.api.institutionSubmit(Object.assign({
            countryId, actionType: 'COORDINATE_INVESTMENT'
        }, centerActor));
        const centerDirectExecuted = centerDirectSubmitted.ok
            ? runtime.api.institutionExecute(centerDirectSubmitted.request.id, centerActor)
            : centerDirectSubmitted;

        const petitionSubmitted = runtime.api.institutionSubmit(Object.assign({
            countryId, actionType: 'LOBBY_POLICY'
        }, centerActor));
        let petitionCurrent = petitionSubmitted;
        if (petitionSubmitted.ok) {
            for (const institutionId of petitionSubmitted.request.requiredInstitutionIds) {
                const institution = country.institutions[institutionId];
                petitionCurrent = runtime.api.institutionApprove(
                    petitionSubmitted.request.id,
                    actorFor(institution)
                );
            }
        }
        const petitionRequest = petitionCurrent.request || (petitionSubmitted && petitionSubmitted.request);
        const petitionExecutor = petitionRequest && petitionRequest.executorInstitutionId
            ? country.institutions[petitionRequest.executorInstitutionId] : null;
        const petitionExecuted = petitionExecutor
            ? runtime.api.institutionExecute(petitionRequest.id, actorFor(petitionExecutor))
            : { ok: false, reason: 'NO_EXECUTOR_FIXTURE' };

        const fakeActor = runtime.api.institutionSubmit({
            countryId, actionType: 'REVIEW_LEGALITY',
            institutionId: judiciary.id, actorId: 'character:forged'
        });
        const radical = Object.values(story.powerCenters.centers)
            .find(row => row.countryId === countryId && row.type === 'RADICAL_NETWORK');
        const prohibited = runtime.api.institutionSubmit({
            countryId, actionType: 'RECRUIT_GRIEVANCE',
            powerCenterId: radical.id, actorId: radical.leader.actorId
        });
        const local = institutionOf('LOCAL_ADMINISTRATION');
        const foreignNode = story.nodes.find(node => node.owner !== 0);
        const outsideJurisdiction = runtime.api.institutionSubmit(Object.assign({
            countryId, actionType: 'ISSUE_LOCAL_ORDER', targetRegionId: `region:${foreignNode.id}`
        }, actorFor(local)));

        const isolationSubmitted = runtime.api.institutionSubmit(Object.assign({
            countryId, actionType: 'LOBBY_POLICY'
        }, centerActor));
        story.states[1].constitution = 'republic';
        runtime.api.institutionTick(5);
        const afterForeignChange = runtime.api.institutionLedger()
            .requests[isolationSubmitted.request.id].status;
        story.states[0].constitution = 'republic';
        runtime.api.institutionTick(5);
        runtime.api.powerCenterTick(5);
        const afterOwnChange = runtime.api.institutionLedger()
            .requests[isolationSubmitted.request.id].status;

        const world = runtime.api.worldV2();
        const knowledge = runtime.api.playerKnowledge(world, countryId);
        const ownCountry = knowledge.countries.find(row => row.id === countryId);
        const foreignCountry = knowledge.countries.find(row => row.id === 'country:1');
        const ownNode = story.nodes.find(node => node.owner === 0);
        const foreignKnowledgeNode = story.nodes.find(node => node.owner !== 0);
        const ownUi = runtime.api.renderCityDossier(ownNode.id, 'kurumlar');
        const foreignUi = runtime.api.renderCityDossier(foreignKnowledgeNode.id, 'kurumlar');
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        savedLedger = JSON.parse(savedRaw).institutions;
        const migrated = runtime.api.migrateRaw(savedRaw);
        main = {
            validation: runtime.api.validateInstitutionLedger(runtime.api.institutionLedger()),
            powerCenterValidation: runtime.api.validatePowerCenterLedger(runtime.api.powerCenterLedger()),
            summary: runtime.api.institutionSummary(),
            direct: { submitted: directSubmitted, executed: directExecuted },
            centerDirect: { submitted: centerDirectSubmitted, executed: centerDirectExecuted },
            petition: { submitted: petitionSubmitted, approved: petitionCurrent, executed: petitionExecuted },
            denied: { fakeActor, prohibited, outsideJurisdiction },
            authorityIsolation: { afterForeignChange, afterOwnChange },
            worldValidation: runtime.api.validateWorldV2(world),
            worldInstitutionCount: world.institutions.length,
            ownKnowledge: ownCountry.institutions,
            foreignKnowledge: foreignCountry.institutions,
            foreignSecretsHidden: !/actorId|authoritySignature|requiredInstitutionIds|approvalInstitutionIds|requests/.test(
                JSON.stringify(foreignCountry.institutions.value)
            ),
            ui: {
                ownHasRegime: /ANAYASAL DÜZEN|LİBERAL DEMOKRASİ/.test(ownUi.text),
                ownHasInstitutions: /YÜRÜTME|YASAMA|YARGI/.test(ownUi.text),
                ownHasAuthorityRoutes: /TEK MAKAM|ORTAK KARAR/.test(ownUi.text),
                foreignHasPublicInstitutions: /ANAYASAL DÜZEN|YÜRÜTME|YASAMA/.test(foreignUi.text),
                foreignSecretLeak: /actorId|authoritySignature|requiredInstitutionIds|approvalInstitutionIds|MAKAM ONAYI/i.test(foreignUi.html)
            },
            savedExact: JSON.stringify(savedLedger) === JSON.stringify(runtime.api.institutionLedger()),
            migration: {
                ok: migrated.ok,
                validation: migrated.ok ? runtime.api.validateWorldV2(migrated.world) : null,
                topLevelCount: migrated.ok ? migrated.world.institutions.length : 0,
                countryPreserved: !!(migrated.ok && migrated.world.countries[0].institutions),
                regionPreserved: !!(migrated.ok && migrated.world.regions[0].institutions),
                unmapped: !!(migrated.ok && migrated.world.diagnostics.migration.unmappedTopLevelFields.includes('institutions'))
            }
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const ledger = restoredRuntime.api.institutionLedger();
        restored = {
            loaded,
            validation: restoredRuntime.api.validateInstitutionLedger(ledger),
            exact: JSON.stringify(ledger) === JSON.stringify(savedLedger)
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const legacySave = JSON.parse(savedRaw);
    delete legacySave.institutions;
    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        legacyRuntime.api.loadNow();
        const ledger = legacyRuntime.api.institutionLedger();
        legacy = {
            validation: legacyRuntime.api.validateInstitutionLedger(ledger),
            diagnostics: ledger.diagnostics,
            summary: legacyRuntime.api.institutionSummary()
        };
    } finally {
        legacyRuntime.dom.window.close();
    }

    const corruptSave = JSON.parse(savedRaw);
    const corruptCountry = corruptSave.institutions.countries['country:0'];
    const corruptInstitution = Object.values(corruptCountry.institutions)[0];
    corruptInstitution.officeHolder.actorId = '';
    const corruptRuntime = createRuntime(seed >>> 0);
    let corrupt;
    try {
        corruptRuntime.api.putSavedRaw(JSON.stringify(corruptSave));
        corruptRuntime.api.loadNow();
        const ledger = corruptRuntime.api.institutionLedger();
        corrupt = {
            validation: corruptRuntime.api.validateInstitutionLedger(ledger),
            diagnostics: ledger.diagnostics
        };
    } finally {
        corruptRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'government.institutionsAuthority': false }
        });
        disabled = {
            ledger: disabledRuntime.api.institutionLedger(),
            summary: disabledRuntime.api.institutionSummary(),
            powerCenterValidation: disabledRuntime.api.validatePowerCenterLedger(disabledRuntime.api.powerCenterLedger())
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const prerequisiteRuntime = createRuntime(seed >>> 0);
    let prerequisiteDisabled;
    try {
        prerequisiteRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'society.powerCenters': false, 'government.institutionsAuthority': true }
        });
        prerequisiteDisabled = {
            ledger: prerequisiteRuntime.api.institutionLedger(),
            summary: prerequisiteRuntime.api.institutionSummary()
        };
    } finally {
        prerequisiteRuntime.dom.window.close();
    }
    return { main, restored, legacy, corrupt, disabled, prerequisiteDisabled };
}

function probeStateCapacity(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main;
    let savedRaw;
    let savedLedger;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        runtime.api.advance(10);
        const story = runtime.api.state();
        const countryId = 'country:0';
        const institutionLedger = runtime.api.institutionLedger();
        const country = institutionLedger.countries[countryId];
        const judiciary = Object.values(country.institutions).find(row => row.type === 'JUDICIARY');
        const judiciaryActor = { institutionId: judiciary.id, actorId: judiciary.officeHolder.actorId };
        const submitAndExecuteReview = () => {
            const submitted = runtime.api.institutionSubmit(Object.assign({
                countryId, actionType: 'REVIEW_LEGALITY'
            }, judiciaryActor));
            const executed = submitted.ok
                ? runtime.api.institutionExecute(submitted.request.id, judiciaryActor) : submitted;
            return { submitted, executed };
        };

        const normalDecision = submitAndExecuteReview();
        for (let index = 0; index < 20; index++) {
            runtime.api.stateCapacityTick(5);
            const ticket = runtime.api.stateCapacityLedger().tickets[
                `implementation:${normalDecision.executed.request.id}`
            ];
            if (ticket && ['COMPLETED', 'DEGRADED', 'PAPER_ONLY'].includes(ticket.status)) break;
        }
        const normalTicket = runtime.api.stateCapacityLedger().tickets[
            `implementation:${normalDecision.executed.request.id}`
        ];

        const lowDecision = submitAndExecuteReview();
        const playerState = story.states.find(state => state.id === 0);
        const canonicalBeforeLow = {
            welfare: playerState.welfare,
            factions: JSON.parse(JSON.stringify(playerState.factions || {})),
            needsWelfare: JSON.parse(JSON.stringify(story.needsWelfare)),
            publicOpinion: JSON.parse(JSON.stringify(story.publicOpinion)),
            powerCenters: JSON.parse(JSON.stringify(story.powerCenters)),
            stateBudget: JSON.parse(JSON.stringify(story.stateBudget)),
            infrastructureGraph: JSON.parse(JSON.stringify(story.infrastructureGraph)),
            garrisons: Object.fromEntries(story.nodes.map(node => [node.id, node.garrison]))
        };
        playerState.welfare = 0;
        playerState.factions = Object.assign({}, playerState.factions, {
            workers: 0, business: 0, military: 0, intel: 0, radicals: 100
        });
        if (story.needsWelfare && story.needsWelfare.countries[countryId]) {
            Object.assign(story.needsWelfare.countries[countryId], {
                publicServicesBps: 0, securityBps: 0, wellbeingBps: 0
            });
        }
        for (const [regionId, row] of Object.entries(story.needsWelfare && story.needsWelfare.regions || {})) {
            if (row.countryId === countryId) Object.assign(row, {
                publicServicesBps: 0, securityBps: 0, wellbeingBps: 0
            });
        }
        if (story.publicOpinion && story.publicOpinion.countries[countryId]) {
            story.publicOpinion.countries[countryId].rememberedSeverityBps = 10000;
        }
        const civilService = Object.values(story.powerCenters.centers).find(row =>
            row.countryId === countryId && row.type === 'CIVIL_SERVICE');
        Object.assign(civilService, { organizationBps: 0, influenceBps: 0, independenceBps: 0 });
        civilService.capabilities.administrationBps = 0;
        const business = Object.values(story.powerCenters.centers).find(row =>
            row.countryId === countryId && row.type === 'BUSINESS_COUNCIL');
        business.influenceBps = 10000;
        if (story.stateBudget && story.stateBudget.countries[countryId]) {
            story.stateBudget.countries[countryId].status = 'DEFAULT';
            story.stateBudget.countries[countryId].missedPaymentDays = 100;
        }
        for (const corridor of story.infrastructureGraph && story.infrastructureGraph.corridors || []) {
            if ((corridor.endpointRegionIds || []).some(regionId => {
                const nodeId = Number(String(regionId).split(':').pop());
                const node = story.nodes.find(row => row.id === nodeId);
                return node && node.owner === 0;
            })) corridor.damageBps = 10000;
        }
        for (const node of story.nodes.filter(row => row.owner === 0)) node.garrison = 0;

        runtime.api.stateCapacityTick(5);
        const lowTicketId = `implementation:${lowDecision.executed.request.id}`;
        const lowStart = runtime.api.stateCapacityLedger().tickets[lowTicketId];
        story.clock = lowStart.deadlineAt + 0.1;
        runtime.api.stateCapacityTick(5);
        const lowFinished = runtime.api.stateCapacityLedger().tickets[lowTicketId];

        // Çöküş senaryosu yalnız Faz 30 davranışını sınar. Başka defterlerin
        // doğrulayıcılarını bilerek bozuk bırakmak kayıt/yükleme testini sahte
        // biçimde başarısız gösterir; kapasite fişini koruyup kaynakları geri al.
        playerState.welfare = canonicalBeforeLow.welfare;
        playerState.factions = JSON.parse(JSON.stringify(canonicalBeforeLow.factions));
        story.needsWelfare = JSON.parse(JSON.stringify(canonicalBeforeLow.needsWelfare));
        story.publicOpinion = JSON.parse(JSON.stringify(canonicalBeforeLow.publicOpinion));
        story.powerCenters = JSON.parse(JSON.stringify(canonicalBeforeLow.powerCenters));
        story.stateBudget = JSON.parse(JSON.stringify(canonicalBeforeLow.stateBudget));
        story.infrastructureGraph = JSON.parse(JSON.stringify(canonicalBeforeLow.infrastructureGraph));
        for (const node of story.nodes) node.garrison = canonicalBeforeLow.garrisons[node.id];

        // Kapasite çalışacak kadar yüksek, fakat denetim ve bağımsızlık zayıf:
        // karar bitmeli ancak saptırma riski nedeniyle DEGRADED olmalı.
        const degradedDecision = submitAndExecuteReview();
        const restoredCivilService = Object.values(story.powerCenters.centers).find(row =>
            row.countryId === countryId && row.type === 'CIVIL_SERVICE');
        const restoredBusiness = Object.values(story.powerCenters.centers).find(row =>
            row.countryId === countryId && row.type === 'BUSINESS_COUNCIL');
        restoredCivilService.independenceBps = 0;
        restoredCivilService.organizationBps = 0;
        restoredCivilService.influenceBps = 0;
        restoredBusiness.influenceBps = 10000;
        const degradedTicketId = `implementation:${degradedDecision.executed.request.id}`;
        for (let index = 0; index < 30; index++) {
            runtime.api.stateCapacityTick(5);
            const ticket = runtime.api.stateCapacityLedger().tickets[degradedTicketId];
            if (ticket && ['COMPLETED', 'DEGRADED', 'PAPER_ONLY'].includes(ticket.status)) break;
        }
        const degradedTicket = runtime.api.stateCapacityLedger().tickets[degradedTicketId];
        story.powerCenters = JSON.parse(JSON.stringify(canonicalBeforeLow.powerCenters));

        const beforeProjectionHash = hashSnapshot(stateSnapshot(story));
        const world = runtime.api.worldV2();
        const knowledge = runtime.api.playerKnowledge(world, countryId);
        const ownCountry = knowledge.countries.find(row => row.id === countryId);
        const foreignCountry = knowledge.countries.find(row => row.id === 'country:1');
        const ownNode = story.nodes.find(node => node.owner === 0);
        const foreignNode = story.nodes.find(node => node.owner !== 0);
        const ownUi = runtime.api.renderCityDossier(ownNode.id, 'kurumlar');
        const foreignUi = runtime.api.renderCityDossier(foreignNode.id, 'kurumlar');
        const afterProjectionHash = hashSnapshot(stateSnapshot(story));
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        savedLedger = JSON.parse(savedRaw).stateCapacity;
        const migrated = runtime.api.migrateRaw(savedRaw);
        main = {
            validation: runtime.api.validateStateCapacityLedger(runtime.api.stateCapacityLedger()),
            summary: runtime.api.stateCapacitySummary(),
            normalDecision,
            normalTicket,
            lowDecision,
            lowStart,
            lowFinished,
            degradedDecision,
            degradedTicket,
            capacityContrast: {
                normal: normalTicket && normalTicket.startCapacity,
                low: lowStart && lowStart.latestCapacity
            },
            worldValidation: runtime.api.validateWorldV2(world),
            worldTicketCount: world.implementationTickets.length,
            ownKnowledge: ownCountry.stateCapacity,
            foreignKnowledge: foreignCountry.stateCapacity,
            foreignSecretsHidden: !/bureaucraticCapacityBps|institutionalIntegrityBps|corruptionRiskBps|implementationCapacityBps|implementationTickets|sources/.test(
                JSON.stringify(foreignCountry.stateCapacity.value)
            ),
            projectionReadOnly: beforeProjectionHash === afterProjectionHash,
            ui: {
                ownHasCapacity: /MEŞRUİYET VE UYGULAMA KAPASİTESİ|BÜROKRATİK KAPASİTE/.test(ownUi.text),
                ownHasPaperOnly: /KÂĞITTA KALDI/.test(ownUi.text),
                foreignHasPublicCapacity: /MEŞRUİYET VE UYGULAMA KAPASİTESİ|BÖLGESEL DENETİM/.test(foreignUi.text),
                foreignSecretLeak: /BÜROKRATİK KAPASİTE|KURUMSAL BÜTÜNLÜK|SAPTIRMA RİSKİ|UYGULAMA FİŞLERİ/.test(foreignUi.text)
            },
            savedExact: JSON.stringify(savedLedger) === JSON.stringify(runtime.api.stateCapacityLedger()),
            saveOk: story._lastSaveOk,
            saveError: story._lastSaveError,
            migration: {
                ok: migrated.ok,
                validation: migrated.ok ? runtime.api.validateWorldV2(migrated.world) : null,
                ticketCount: migrated.ok ? migrated.world.implementationTickets.length : 0,
                countryPreserved: !!(migrated.ok && migrated.world.countries[0].stateCapacity),
                regionPreserved: !!(migrated.ok && migrated.world.regions[0].stateCapacity),
                unmapped: !!(migrated.ok && migrated.world.diagnostics.migration.unmappedTopLevelFields.includes('stateCapacity'))
            }
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const ledger = restoredRuntime.api.stateCapacityLedger();
        restored = {
            loaded,
            validation: restoredRuntime.api.validateStateCapacityLedger(ledger),
            exact: JSON.stringify(ledger) === JSON.stringify(savedLedger)
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const legacySave = JSON.parse(savedRaw);
    delete legacySave.stateCapacity;
    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        legacyRuntime.api.loadNow();
        const ledger = legacyRuntime.api.stateCapacityLedger();
        legacy = {
            validation: legacyRuntime.api.validateStateCapacityLedger(ledger),
            diagnostics: ledger.diagnostics,
            summary: legacyRuntime.api.stateCapacitySummary()
        };
    } finally {
        legacyRuntime.dom.window.close();
    }

    const corruptSave = JSON.parse(savedRaw);
    corruptSave.stateCapacity.countries['country:0'].legitimacyBps = -1;
    const corruptRuntime = createRuntime(seed >>> 0);
    let corrupt;
    try {
        corruptRuntime.api.putSavedRaw(JSON.stringify(corruptSave));
        corruptRuntime.api.loadNow();
        const ledger = corruptRuntime.api.stateCapacityLedger();
        corrupt = {
            validation: corruptRuntime.api.validateStateCapacityLedger(ledger),
            diagnostics: ledger.diagnostics
        };
    } finally {
        corruptRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'government.stateCapacity': false }
        });
        disabled = {
            ledger: disabledRuntime.api.stateCapacityLedger(),
            summary: disabledRuntime.api.stateCapacitySummary()
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const prerequisiteRuntime = createRuntime(seed >>> 0);
    let prerequisiteDisabled;
    try {
        prerequisiteRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'government.institutionsAuthority': false, 'government.stateCapacity': true }
        });
        prerequisiteDisabled = {
            ledger: prerequisiteRuntime.api.stateCapacityLedger(),
            summary: prerequisiteRuntime.api.stateCapacitySummary()
        };
    } finally {
        prerequisiteRuntime.dom.window.close();
    }
    return { main, restored, legacy, corrupt, disabled, prerequisiteDisabled };
}

function probeElections(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main;
    let savedRaw;
    let savedLedger;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        runtime.api.advance(330);
        const beforeSignature = runtime.api.institutionCountryView('country:0').authoritySignature;
        runtime.api.advance(90);
        const story = runtime.api.state();
        const ledger = runtime.api.electionLedger();
        const validation = runtime.api.validateElectionLedger(ledger);
        const certified = Object.values(ledger.elections).filter(row => row.status === 'CERTIFIED');
        const counted = certified.filter(row => row.castVotes > 0);
        const exactCohortVotes = counted.every(election => (
            election.cohortBallots.reduce((sum, ballot) => (
                sum + Object.values(ballot.votesBySlate || {}).reduce((out, votes) => out + votes, 0)
            ), 0) === election.castVotes
            && election.totals.reduce((sum, row) => sum + row.votes, 0) === election.castVotes
        ));
        const eligibleMatchesPopulation = counted.every(election => (
            election.cohortBallots.reduce((sum, ballot) => sum + ballot.eligiblePeople, 0)
                === election.eligiblePeople
        ));
        const afterSignature = runtime.api.institutionCountryView('country:0').authoritySignature;
        const worldBeforeHash = hashSnapshot(stateSnapshot(story));
        const world = runtime.api.worldV2();
        const knowledge = runtime.api.playerKnowledge(world, 'country:0');
        const own = knowledge.countries.find(row => row.id === 'country:0');
        const foreign = knowledge.countries.find(row => row.id !== 'country:0');
        const ownNode = story.nodes.find(node => Number(node.owner) === 0);
        const foreignNode = story.nodes.find(node => Number(node.owner) !== 0);
        const ownUi = runtime.api.renderCityDossier(ownNode.id, 'kurumlar');
        const foreignUi = runtime.api.renderCityDossier(foreignNode.id, 'kurumlar');
        const worldAfterHash = hashSnapshot(stateSnapshot(story));
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        savedLedger = runtime.api.electionLedger();
        const migrated = runtime.api.migrateRaw(savedRaw);
        main = {
            validation,
            summary: runtime.api.electionSummary(),
            certifiedCount: certified.length,
            exactCohortVotes,
            eligibleMatchesPopulation,
            distinctWinnerSlateCount: new Set(certified.map(row => row.winnerSlateId.split(':').pop())).size,
            coalitionCount: certified.filter(row => row.coalitionSlateIds.length > 1).length,
            authoritySignatureChanged: beforeSignature !== afterSignature,
            mandateHolder: runtime.api.electionExecutiveHolder('country:0'),
            contestRule: {
                narrowWeak: runtime.api.electionShouldContest(150, 3000),
                wideWeak: runtime.api.electionShouldContest(500, 3000),
                narrowStrong: runtime.api.electionShouldContest(150, 7000)
            },
            worldValidation: runtime.api.validateWorldV2(world),
            knowledgeValidation: runtime.api.validatePlayerKnowledge(knowledge),
            ownKnowledge: own.elections,
            foreignKnowledge: foreign.elections,
            foreignSecretsHidden: !/cohortBallots|scoreComponentsBySlate|sourceTicks|influenceBps|affinityBps/.test(
                JSON.stringify(foreign.elections.value)
            ),
            readOnly: worldBeforeHash === worldAfterHash,
            ui: {
                ownVisible: ownUi.text.includes('SEÇİM VE BARIŞÇIL İKTİDAR DEVRİ'),
                foreignVisible: foreignUi.text.includes('SEÇİM VE BARIŞÇIL İKTİDAR DEVRİ'),
                foreignSecretLeak: /gerçek kohort sayımı|scoreComponentsBySlate|influenceBps/.test(foreignUi.text)
            },
            saveOk: story._lastSaveOk === true,
            saveExact: JSON.stringify(JSON.parse(savedRaw).elections) === JSON.stringify(savedLedger),
            migration: {
                ok: migrated.ok,
                validation: migrated.ok ? runtime.api.validateWorldV2(migrated.world) : null,
                elections: migrated.ok ? migrated.world.elections.length : 0,
                mandates: migrated.ok ? migrated.world.mandates.length : 0,
                countryPreserved: !!(migrated.ok && migrated.world.countries[0].elections),
                unmapped: !!(migrated.ok && migrated.world.diagnostics.migration.unmappedTopLevelFields.includes('elections'))
            }
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const ledger = restoredRuntime.api.electionLedger();
        restored = {
            loaded,
            validation: restoredRuntime.api.validateElectionLedger(ledger),
            exact: JSON.stringify(ledger) === JSON.stringify(savedLedger)
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const legacySave = JSON.parse(savedRaw);
    delete legacySave.elections;
    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        legacyRuntime.api.loadNow();
        const ledger = legacyRuntime.api.electionLedger();
        legacy = {
            validation: legacyRuntime.api.validateElectionLedger(ledger),
            diagnostics: ledger.diagnostics,
            summary: legacyRuntime.api.electionSummary()
        };
    } finally {
        legacyRuntime.dom.window.close();
    }

    const corruptSave = JSON.parse(savedRaw);
    const corruptElection = Object.values(corruptSave.elections.elections).find(row => row.status === 'CERTIFIED');
    if (corruptElection && corruptElection.totals[0]) corruptElection.totals[0].votes++;
    const corruptRuntime = createRuntime(seed >>> 0);
    let corrupt;
    try {
        corruptRuntime.api.putSavedRaw(JSON.stringify(corruptSave));
        corruptRuntime.api.loadNow();
        const ledger = corruptRuntime.api.electionLedger();
        corrupt = {
            validation: corruptRuntime.api.validateElectionLedger(ledger),
            diagnostics: ledger.diagnostics
        };
    } finally {
        corruptRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'government.electionsTransfer': false }
        });
        disabled = {
            ledger: disabledRuntime.api.electionLedger(),
            summary: disabledRuntime.api.electionSummary()
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const prerequisiteRuntime = createRuntime(seed >>> 0);
    let prerequisiteDisabled;
    try {
        prerequisiteRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'society.publicOpinionMemory': false, 'government.electionsTransfer': true }
        });
        prerequisiteDisabled = {
            ledger: prerequisiteRuntime.api.electionLedger(),
            summary: prerequisiteRuntime.api.electionSummary()
        };
    } finally {
        prerequisiteRuntime.dom.window.close();
    }

    return { main, restored, legacy, corrupt, disabled, prerequisiteDisabled };
}

function probeIntegrity(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main;
    let savedRaw;
    let savedLedger;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        runtime.api.advance(5);
        const story = runtime.api.state();
        const initial = runtime.api.integritySummary();
        const countryId = 'country:0';
        const institutionCountry = runtime.api.institutionCountryView(countryId);
        const institutionOf = type => Object.values(institutionCountry.institutions).find(row => row.type === type);
        const actorFor = institution => ({
            institutionId: institution.id,
            actorId: institution.officeHolder.actorId
        });
        const authorize = (actionType, proposerType) => {
            const proposer = institutionOf(proposerType);
            const submitted = runtime.api.institutionSubmit({ countryId, actionType, ...actorFor(proposer) });
            if (!submitted.ok) return { submitted, executed: submitted };
            let current = submitted;
            if (submitted.request.status === 'PENDING_APPROVAL') {
                for (const institutionId of submitted.request.requiredInstitutionIds || []) {
                    if ((submitted.request.approvalInstitutionIds || []).includes(institutionId)) continue;
                    current = runtime.api.institutionApprove(submitted.request.id, actorFor(institutionCountry.institutions[institutionId]));
                    if (!current.ok) return { submitted, approved: current, executed: current };
                }
            }
            const request = current.request || submitted.request;
            const executor = institutionCountry.institutions[request.executorInstitutionId];
            const executed = executor
                ? runtime.api.institutionExecute(request.id, actorFor(executor))
                : { ok: false, reason: 'NO_EXECUTOR_FIXTURE' };
            return { submitted, approved: current, executed };
        };
        const judiciaryAuthority = () => authorize('REVIEW_LEGALITY', 'JUDICIARY');
        const company = Object.values(runtime.api.companyLedger().companies || {})
            .find(row => row.countryId === countryId);

        const cleanAuthority = authorize('AUTHORIZE_BUDGET', 'LEGISLATURE');
        const cleanPayment = cleanAuthority.executed.ok
            ? runtime.api.budgetDebit(0, 10, 'institutional.procurement', { correlationId: 'integrity-clean-procurement' })
            : cleanAuthority.executed;
        const cleanProcurement = cleanPayment.ok && company
            ? runtime.api.integrityRegisterProcurement({
                authorityRequestId: cleanAuthority.executed.request.id,
                budgetTransactionId: cleanPayment.transaction.id,
                companyId: company.id,
                benchmarkAmount: 10,
                competitiveBidCount: 3
            }) : { ok: false, reason: 'CLEAN_PROCUREMENT_FIXTURE_FAILED' };
        const afterClean = runtime.api.integritySummary();

        const suspectAuthority = authorize('AUTHORIZE_BUDGET', 'LEGISLATURE');
        const suspectPayment = suspectAuthority.executed.ok
            ? runtime.api.budgetDebit(0, 15, 'institutional.procurement', { correlationId: 'integrity-suspect-procurement' })
            : suspectAuthority.executed;
        const suspectProcurement = suspectPayment.ok && company
            ? runtime.api.integrityRegisterProcurement({
                authorityRequestId: suspectAuthority.executed.request.id,
                budgetTransactionId: suspectPayment.transaction.id,
                companyId: company.id,
                benchmarkAmount: 10,
                competitiveBidCount: 1
            }) : { ok: false, reason: 'SUSPECT_PROCUREMENT_FIXTURE_FAILED' };
        const suspectCase = suspectProcurement.case || null;
        const suspectWithoutAuthority = suspectCase
            ? runtime.api.integrityOpenInvestigation(suspectCase.id, 'institution-request:forged')
            : { ok: false, reason: 'NO_SUSPECT_CASE' };
        const weakJudiciary = judiciaryAuthority();
        const suspectOpened = suspectCase && weakJudiciary.executed.ok
            ? runtime.api.integrityOpenInvestigation(suspectCase.id, weakJudiciary.executed.request.id)
            : { ok: false, reason: 'WEAK_JUDICIARY_FIXTURE_FAILED' };
        const suspectResolved = suspectOpened.ok
            ? runtime.api.integrityResolveInvestigation(suspectCase.id) : suspectOpened;

        const state = story.states.find(row => Number(row.id) === 0);
        const from = story.commander;
        const to = (state.gov && state.gov.commanders || []).find(row => row !== from);
        const transfer = to ? runtime.api.budgetTransfer(0, from, to, 50, 'political.bribe', {
            correlationId: `integrity-fixture:${to.id}`
        }) : { ok: false, code: 'NO_TARGET_COMMANDER' };
        runtime.api.integrityTick(5);
        const afterReceipt = runtime.api.integrityLedger();
        const caseRow = Object.values(afterReceipt.cases || {}).find(row => row.kind === 'EXPLICIT_BRIBE_TRANSFER') || null;
        const withoutAuthority = caseRow
            ? runtime.api.integrityOpenInvestigation(caseRow.id, 'institution-request:forged')
            : { ok: false, reason: 'NO_CASE' };
        const reusedAuthority = caseRow && weakJudiciary.executed.ok
            ? runtime.api.integrityOpenInvestigation(caseRow.id, weakJudiciary.executed.request.id)
            : { ok: false, reason: 'NO_REUSED_AUTHORITY_FIXTURE' };
        const judiciary = judiciaryAuthority();
        const opened = caseRow && judiciary.executed.ok
            ? runtime.api.integrityOpenInvestigation(caseRow.id, judiciary.executed.request.id)
            : { ok: false, reason: 'JUDICIAL_FIXTURE_FAILED' };
        const resolved = opened.ok
            ? runtime.api.integrityResolveInvestigation(caseRow.id) : opened;
        runtime.api.integrityTick(5);
        const finalLedger = runtime.api.integrityLedger();
        const beforeProjection = JSON.stringify(finalLedger);
        const world = runtime.api.worldV2();
        const knowledge = runtime.api.playerKnowledge(world, countryId);
        const own = knowledge.countries.find(row => row.id === countryId);
        const foreignKnowledge = runtime.api.playerKnowledge(world, 'country:1');
        const foreign = foreignKnowledge.countries.find(row => row.id === countryId);
        const ownNode = story.nodes.find(node => Number(node.owner) === 0);
        const ownUi = runtime.api.renderCityDossier(ownNode.id, 'kurumlar');
        story.playerStateId = 1;
        const foreignUi = runtime.api.renderCityDossier(ownNode.id, 'kurumlar');
        story.playerStateId = 0;
        const projectionReadOnly = beforeProjection === JSON.stringify(runtime.api.integrityLedger());
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        savedLedger = JSON.parse(savedRaw).integrity;
        const migrated = runtime.api.migrateRaw(savedRaw);
        main = {
            initial,
            clean: { authority: cleanAuthority, payment: cleanPayment, procurement: cleanProcurement, after: afterClean },
            suspect: {
                authority: suspectAuthority, payment: suspectPayment, procurement: suspectProcurement,
                withoutAuthority: suspectWithoutAuthority, judiciary: weakJudiciary,
                opened: suspectOpened, resolved: suspectResolved
            },
            transfer,
            afterReceipt: {
                caseCount: Object.keys(afterReceipt.cases || {}).length,
                evidenceCount: Object.keys(afterReceipt.evidence || {}).length,
                case: caseRow
            },
            withoutAuthority,
            reusedAuthority,
            judiciary,
            opened,
            resolved,
            finalSummary: runtime.api.integritySummary(),
            validation: runtime.api.validateIntegrityLedger(finalLedger),
            deduplicated: Object.values(finalLedger.cases || {}).filter(row => row.kind === 'EXPLICIT_BRIBE_TRANSFER').length === 1,
            subjectCanonical: !!(caseRow && /^character:0:/.test(String(caseRow.subjectActorId))),
            worldValidation: runtime.api.validateWorldV2(world),
            worldCaseCount: world.integrityCases.length,
            worldEvidenceCount: world.integrityEvidence.length,
            knowledgeValidation: runtime.api.validatePlayerKnowledge(knowledge),
            foreignKnowledgeValidation: runtime.api.validatePlayerKnowledge(foreignKnowledge),
            ownKnowledge: own.integrity,
            foreignKnowledge: foreign.integrity,
            foreignSecretsHidden: !/evidence|evidenceScoreBps|sourceId|sourceKind|subjectActorId|beneficiaryCompanyId|authorityRequestId|investigationRequestId|redFlags/.test(
                JSON.stringify(foreign.integrity.value)
            ),
            projectionReadOnly,
            ui: {
                ownVisible: /ETİK, İDDİA VE SORUŞTURMA|KANIT SKORU/.test(ownUi.text),
                ownSeparatesRisk: /Saptırma riski yalnız yapısal bir göstergedir|İddia suç değildir/.test(ownUi.text),
                foreignVisible: /ETİK, İDDİA VE SORUŞTURMA|KANITLANDI|KANITLANAMADI/.test(foreignUi.text),
                foreignSecretLeak: /KANIT SKORU|sourceId|sourceKind|authorityRequestId|investigationRequestId|EXPLICIT_BRIBE_RECEIPT/.test(foreignUi.text)
            },
            saveOk: story._lastSaveOk === true,
            saveExact: JSON.stringify(savedLedger) === JSON.stringify(runtime.api.integrityLedger()),
            migration: {
                ok: migrated.ok,
                validation: migrated.ok ? runtime.api.validateWorldV2(migrated.world) : null,
                caseCount: migrated.ok ? migrated.world.integrityCases.length : 0,
                evidenceCount: migrated.ok ? migrated.world.integrityEvidence.length : 0,
                countryPreserved: !!(migrated.ok && migrated.world.countries[0].integrity),
                unmapped: !!(migrated.ok && migrated.world.diagnostics.migration.unmappedTopLevelFields.includes('integrity'))
            }
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const ledger = restoredRuntime.api.integrityLedger();
        restored = {
            loaded,
            validation: restoredRuntime.api.validateIntegrityLedger(ledger),
            exact: JSON.stringify(ledger) === JSON.stringify(savedLedger)
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const legacySave = JSON.parse(savedRaw);
    delete legacySave.integrity;
    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        legacyRuntime.api.loadNow();
        const ledger = legacyRuntime.api.integrityLedger();
        legacy = {
            validation: legacyRuntime.api.validateIntegrityLedger(ledger),
            diagnostics: ledger.diagnostics,
            summary: legacyRuntime.api.integritySummary()
        };
    } finally {
        legacyRuntime.dom.window.close();
    }

    const corruptSave = JSON.parse(savedRaw);
    const corruptEvidence = Object.values(corruptSave.integrity.evidence || {})[0];
    if (corruptEvidence) corruptEvidence.direction = 'FORGED_DIRECTION';
    const corruptRuntime = createRuntime(seed >>> 0);
    let corrupt;
    try {
        corruptRuntime.api.putSavedRaw(JSON.stringify(corruptSave));
        corruptRuntime.api.loadNow();
        const ledger = corruptRuntime.api.integrityLedger();
        corrupt = {
            validation: corruptRuntime.api.validateIntegrityLedger(ledger),
            diagnostics: ledger.diagnostics
        };
    } finally {
        corruptRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'government.patronageIntegrity': false }
        });
        disabled = { ledger: disabledRuntime.api.integrityLedger(), summary: disabledRuntime.api.integritySummary() };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const prerequisiteRuntime = createRuntime(seed >>> 0);
    let prerequisiteDisabled;
    try {
        prerequisiteRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'economy.companiesBanks': false, 'government.patronageIntegrity': true }
        });
        prerequisiteDisabled = {
            ledger: prerequisiteRuntime.api.integrityLedger(),
            summary: prerequisiteRuntime.api.integritySummary()
        };
    } finally {
        prerequisiteRuntime.dom.window.close();
    }

    return { main, restored, legacy, corrupt, disabled, prerequisiteDisabled };
}

function probePoliticalCrisis(seed = 2032) {
    const prime = runtime => {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        runtime.api.advance(5);
        const story = runtime.api.state();
        const state = story.states.find(row => Number(row.id) === 0);
        state.welfare = 12;
        if (state.factions) {
            state.factions.workers = 22;
            state.factions.business = 28;
            state.factions.military = 12;
            state.factions.intel = 20;
            state.factions.radicals = 82;
        }
        const plotters = (state.gov && state.gov.commanders || []).slice(0, 3);
        for (const [index, commander] of plotters.entries()) {
            commander.loyalty = 20 + index * 3;
            commander._lastDefect = story.clock;
            commander.skills.warrior = Math.max(4, commander.skills.warrior || 0);
            commander.skills.diplomat = Math.max(3, commander.skills.diplomat || 0);
        }
        runtime.api.politicalCrisisTick(5);
        return { story, state, plotters };
    };

    const runtime = createRuntime(seed >>> 0);
    let main;
    let savedRaw;
    let savedLedger;
    try {
        const fixture = prime(runtime);
        const opened = runtime.api.politicalCrisisCountryView('country:0');
        const active = opened && opened.activeCrisis;
        const beforeAction = active ? {
            preparationBps: active.preparationBps,
            coalitionBps: active.coalitionBps,
            counterBps: active.counterBps
        } : null;
        const talkUi = runtime.api.politicalCrisisTalkHtml();
        const negotiate = runtime.api.politicalCrisisAct('country:0', 'NEGOTIATE');
        runtime.api.advance(20);
        const secure = runtime.api.politicalCrisisAct('country:0', 'SECURE_COMMAND');
        const finalLedger = runtime.api.politicalCrisisLedger();
        const finalMemory = runtime.api.characterMemoryLedger();
        const actionMemoryEpisodes = Object.values(finalMemory.episodes || {}).filter(row =>
            row.source && row.source.politicalCrisisId === active.id
            && row.source.actionSequence != null);
        const world = runtime.api.worldV2();
        const ownKnowledge = runtime.api.playerKnowledge(world, 'country:0');
        const foreignKnowledge = runtime.api.playerKnowledge(world, 'country:1');
        const own = ownKnowledge.countries.find(row => row.id === 'country:0');
        const foreign = foreignKnowledge.countries.find(row => row.id === 'country:0');
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        savedLedger = JSON.parse(savedRaw).politicalCrises;
        const migrated = runtime.api.migrateRaw(savedRaw);
        main = {
            opened: !!active,
            status: active && active.status,
            leadCanonical: !!(active && /^character:0:\d+$/.test(String(active.leadActorId))),
            plotterCount: active ? active.plotterActorIds.length : 0,
            beforeAction,
            negotiate,
            secure,
            actionChangedPreparation: !!(negotiate.ok && negotiate.action.after.preparationBps < negotiate.action.before.preparationBps),
            actionRaisedCounter: !!(secure.ok && secure.action.after.counterBps > secure.action.before.counterBps),
            resourceReceiptsRecorded: !!(negotiate.ok && negotiate.action.resourceReceipts.length),
            crisisMemoryEpisodeOpen: !!(active.memoryEpisodeId
                && finalMemory.episodes[active.memoryEpisodeId]
                && finalMemory.episodes[active.memoryEpisodeId].status === 'OPEN'),
            actionMemoryEpisodesResolved: actionMemoryEpisodes.length === 2
                && actionMemoryEpisodes.every(row => row.status === 'RESOLVED'),
            memoryValidation: runtime.api.validateCharacterMemoryLedger(finalMemory),
            ui: {
                characterNamesVisible: !!(talkUi && active && talkUi.text.includes(fixture.plotters[0].name)),
                fourActionsVisible: !!(talkUi && /doğrudan görüş/.test(talkUi.text)
                    && /komuta zincirini güvenceye al/.test(talkUi.text)
                    && /Kamu önünde açıklama yap/.test(talkUi.text)
                    && /Müdahale etmeden izle/.test(talkUi.text))
            },
            validation: runtime.api.validatePoliticalCrisisLedger(finalLedger),
            summary: runtime.api.politicalCrisisSummary(),
            worldValidation: runtime.api.validateWorldV2(world),
            worldCrisisCount: world.crises.length,
            ownKnowledgeValidation: runtime.api.validatePlayerKnowledge(ownKnowledge),
            foreignKnowledgeValidation: runtime.api.validatePlayerKnowledge(foreignKnowledge),
            ownKnowledge: own.politicalCrisis,
            foreignKnowledge: foreign.politicalCrisis,
            foreignSecretsHidden: !/leadActorId|plotterActorIds|loyalistActorIds|preparationBps|coalitionBps|counterBps|actionHistory|resourceReceipts/.test(
                JSON.stringify(foreign.politicalCrisis.value)
            ),
            saveOk: fixture.story._lastSaveOk === true,
            saveExact: JSON.stringify(savedLedger) === JSON.stringify(runtime.api.politicalCrisisLedger()),
            migration: {
                ok: migrated.ok,
                validation: migrated.ok ? runtime.api.validateWorldV2(migrated.world) : null,
                crisisCount: migrated.ok ? migrated.world.crises.length : 0,
                countryPreserved: !!(migrated.ok && migrated.world.countries[0].politicalCrisis),
                unmapped: !!(migrated.ok && migrated.world.diagnostics.migration.unmappedTopLevelFields.includes('politicalCrises'))
            }
        };
    } finally {
        runtime.dom.window.close();
    }

    const outcomeRuntime = createRuntime(seed >>> 0);
    let deterministicOutcome;
    try {
        const fixture = prime(outcomeRuntime);
        for (const commander of (fixture.state.gov && fixture.state.gov.commanders || []).slice(0, 8)) {
            commander.loyalty = 8;
            commander._lastDefect = fixture.story.clock;
            commander.skills.warrior = 6;
            commander.skills.diplomat = 6;
        }
        const ledger = outcomeRuntime.api.politicalCrisisLedger();
        const activeId = ledger.countries['country:0'].activeCrisisId;
        outcomeRuntime.api.state().politicalCrises.crises[activeId].preparationBps = 8999;
        outcomeRuntime.api.politicalCrisisTick(5);
        const resolvedLedger = outcomeRuntime.api.politicalCrisisLedger();
        const resolved = resolvedLedger.crises[activeId];
        const resolvedMemory = outcomeRuntime.api.characterMemoryLedger();
        const betrayal = Object.values(resolvedMemory.milestones || {}).find(row =>
            row.kind === 'BETRAYAL' && row.source && row.source.politicalCrisisId === activeId);
        deterministicOutcome = {
            status: resolved.status,
            resultCode: resolved.resultCode,
            resolvedAt: resolved.resolvedAt,
            randomOutcome: resolved.randomOutcome,
            llmOutcome: resolved.llmOutcome,
            territorialMutation: resolvedLedger.events
                .filter(event => event.crisisId === activeId && event.type === 'CRISIS_RESOLVED')
                .some(event => event.physicalTerritorialMutation === true),
            validation: outcomeRuntime.api.validatePoliticalCrisisLedger(resolvedLedger),
            memoryValidation: outcomeRuntime.api.validateCharacterMemoryLedger(resolvedMemory),
            crisisMemoryEpisodeResolved: !!(resolved.memoryEpisodeId
                && resolvedMemory.episodes[resolved.memoryEpisodeId]
                && resolvedMemory.episodes[resolved.memoryEpisodeId].status === 'RESOLVED'),
            betrayalRecorded: !!betrayal,
            betrayalSubjectCanonical: !!(betrayal && betrayal.subjectActorId === resolved.leadActorId),
            betrayalResultGrounded: !!(betrayal && betrayal.source
                && betrayal.source.resultCode === resolved.resultCode)
        };
    } finally {
        outcomeRuntime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const ledger = restoredRuntime.api.politicalCrisisLedger();
        restored = {
            loaded,
            validation: restoredRuntime.api.validatePoliticalCrisisLedger(ledger),
            exact: JSON.stringify(ledger) === JSON.stringify(savedLedger)
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const legacySave = JSON.parse(savedRaw);
    delete legacySave.politicalCrises;
    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        legacyRuntime.api.loadNow();
        const ledger = legacyRuntime.api.politicalCrisisLedger();
        legacy = {
            validation: legacyRuntime.api.validatePoliticalCrisisLedger(ledger),
            diagnostics: ledger.diagnostics,
            summary: legacyRuntime.api.politicalCrisisSummary()
        };
    } finally {
        legacyRuntime.dom.window.close();
    }

    const corruptSave = JSON.parse(savedRaw);
    const corruptCrisis = Object.values(corruptSave.politicalCrises.crises || {})[0];
    if (corruptCrisis) corruptCrisis.randomOutcome = true;
    const corruptRuntime = createRuntime(seed >>> 0);
    let corrupt;
    try {
        corruptRuntime.api.putSavedRaw(JSON.stringify(corruptSave));
        corruptRuntime.api.loadNow();
        const ledger = corruptRuntime.api.politicalCrisisLedger();
        corrupt = {
            validation: corruptRuntime.api.validatePoliticalCrisisLedger(ledger),
            diagnostics: ledger.diagnostics
        };
    } finally {
        corruptRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'government.politicalCrisis': false }
        });
        disabled = {
            ledger: disabledRuntime.api.politicalCrisisLedger(),
            summary: disabledRuntime.api.politicalCrisisSummary()
        };
    } finally {
        disabledRuntime.dom.window.close();
    }

    const prerequisiteRuntime = createRuntime(seed >>> 0);
    let prerequisiteDisabled;
    try {
        prerequisiteRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'government.patronageIntegrity': false, 'government.politicalCrisis': true }
        });
        prerequisiteDisabled = {
            ledger: prerequisiteRuntime.api.politicalCrisisLedger(),
            summary: prerequisiteRuntime.api.politicalCrisisSummary()
        };
    } finally {
        prerequisiteRuntime.dom.window.close();
    }
    return { main, deterministicOutcome, restored, legacy, corrupt, disabled, prerequisiteDisabled };
}

function probeGovernanceWorkspace(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main;
    let savedRaw;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        runtime.api.advance(5);
        const story = runtime.api.state();
        const state = story.states.find(row => Number(row.id) === 0);
        const target = story.nodes.find(node => Number(node.owner) === 0
            && Number(node.level || 1) < 3
            && Number(node.garrison || 0) < (Number(node.level || 1) * 4));
        state.gov.leader = 'ai';
        story.commander.skills.warrior = 99;
        runtime.api.institutionTick(5);
        const commanderView = runtime.api.governanceView();
        const commanderHtml = runtime.api.governanceHtml();
        const commanderPublicWorks = commanderView.actions.find(row => row.actionId === 'PUBLIC_WORKS');
        const commanderMobilize = commanderView.actions.find(row => row.actionId === 'MOBILIZE_RESERVE');

        state.gov.leader = 'player';
        runtime.api.institutionTick(5);
        const presidentView = runtime.api.governanceView();
        const presidentPublicWorks = runtime.api.governanceActionView('PUBLIC_WORKS', `region:${target.id}`);
        const cashBefore = story.states.filter(row => Number(row.id) === 0)
            .flatMap(row => [story.commander].concat(row.gov && row.gov.commanders || []))
            .filter(Boolean).reduce((sum, commander) => sum + (Number(commander.res && commander.res.points) || 0), 0);
        const levelBefore = Number(target.level || 1);
        const submitted = runtime.api.governanceSubmit('PUBLIC_WORKS', `region:${target.id}`);
        const cashAfterSubmit = [story.commander].concat(state.gov.commanders || [])
            .filter(Boolean).reduce((sum, commander) => sum + (Number(commander.res && commander.res.points) || 0), 0);
        for (let index = 0; index < 60; index++) {
            story.clock += 5;
            runtime.api.stateCapacityTick(5);
            runtime.api.governanceTick(5);
            const request = submitted.ok && story.institutions.requests[submitted.request.id];
            if (request && request.domainDecision && request.domainDecision.result) break;
        }
        const request = submitted.ok && story.institutions.requests[submitted.request.id];
        const ticket = submitted.ok && story.stateCapacity.tickets[`implementation:${submitted.request.id}`];
        const finalHtml = runtime.api.governanceHtml();
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        main = {
            targetRegionId: target && `region:${target.id}`,
            commander: {
                role: commanderView.role,
                mobilizeAllowed: !!(commanderMobilize && commanderMobilize.allowed),
                publicWorksLocked: !!(commanderPublicWorks && !commanderPublicWorks.allowed),
                alternativePathVisible: !!(commanderPublicWorks && commanderPublicWorks.alternativePath),
                htmlHasAlternative: /ALTERNATIF/.test(commanderHtml.text)
            },
            president: {
                role: presidentView.role,
                publicWorksAllowed: presidentPublicWorks.allowed,
                holdsExecutive: presidentView.heldInstitutions.some(row => row.type === 'EXECUTIVE')
            },
            submitted,
            costSpent: Math.round((cashBefore - cashAfterSubmit) * 1e6) / 1e6,
            request: request ? JSON.parse(JSON.stringify(request)) : null,
            ticket: ticket ? JSON.parse(JSON.stringify(ticket)) : null,
            physicalResult: {
                levelBefore,
                levelAfter: Number(target.level || 1),
                applied: !!(request && request.domainDecision && request.domainDecision.result
                    && request.domainDecision.result.status === 'APPLIED'),
                physicalMutation: !!(request && request.domainDecision && request.domainDecision.result
                    && request.domainDecision.result.physicalMutation)
            },
            ui: {
                roleVisible: /CUMHURBAŞKANI/.test(finalHtml.text),
                actionVisible: /Kamu yatırım programı/.test(finalHtml.text),
                pipelineVisible: /SAHADA UYGULANDI/.test(finalHtml.text),
                officesVisible: /MAKAMLAR/.test(finalHtml.text),
                centersVisible: /GÜÇ MERKEZLERİ/.test(finalHtml.text)
            },
            institutionValidation: runtime.api.validateInstitutionLedger(runtime.api.institutionLedger()),
            stateCapacityValidation: runtime.api.validateStateCapacityLedger(runtime.api.stateCapacityLedger()),
            saveOk: story._lastSaveOk === true
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const view = restoredRuntime.api.governanceView();
        const decision = view.decisions[0];
        restored = {
            loaded,
            decisionStatus: decision && decision.status,
            physicalResultPreserved: !!(decision && decision.result && decision.result.physicalMutation),
            institutionValidation: restoredRuntime.api.validateInstitutionLedger(restoredRuntime.api.institutionLedger())
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'government.playerGovernance': false }
        });
        disabled = disabledRuntime.api.governanceView();
    } finally {
        disabledRuntime.dom.window.close();
    }
    return { main, restored, disabled };
}

function probeCharacterIdentities(seed = 2032) {
    const options = [
        {
            id: 'STATE_CAPACITY_PUSH', baseScore: 50,
            affinities: { stateMarketOrientation: 32, institutionalPosture: 12 },
            goalTags: ['EXPAND_STATE_CAPACITY']
        },
        {
            id: 'MARKET_CONFIDENCE_PACT', baseScore: 50,
            affinities: { stateMarketOrientation: -32, popularTechnocraticStyle: -8 },
            goalTags: ['RESTORE_MARKET_CONFIDENCE']
        }
    ];
    const localStages = { harp: 0, idare: 0, siyaset: 0 };
    const creationThemes = [
        'harp', 'harp', 'harp', 'harp', 'harp', 'harp',
        'idare', 'idare', 'idare',
        'siyaset', 'siyaset', 'siyaset'
    ];
    const creationTags = ['sert', 'kurnaz', 'halkci', 'uzman'];
    const creationDecisions = creationThemes.map((theme, index) => ({
        index,
        role: 'COMMANDER',
        theme,
        stage: localStages[theme]++,
        branch: index ? creationTags[(index - 1) % creationTags.length] : 'root',
        questionText: `Faz 34 test ikilemi ${index + 1}`,
        optionIndex: index % creationTags.length,
        optionText: `Bedelli test seçeneği ${index + 1}`,
        optionTag: creationTags[index % creationTags.length],
        legacyFx: {},
        legacySeed: index % 4 === 3 ? `test geçmişi ${index + 1}` : null
    }));
    const creationCharacter = {
        name: 'Test Komutanı',
        role: 'COMMANDER',
        questionPolicyVersion: 'character-role-question-policy-1',
        dice: { warrior: 4, diplomat: 3, economist: 3 },
        axes: { hawk: 55, auth: 48, pop: 52, nat: 50 },
        seeds: ['test geçmişi'],
        skillPlus: 'warrior',
        decisions: creationDecisions
    };
    const runtime = createRuntime(seed >>> 0);
    let main, savedRaw, savedRelationshipLedger, savedMemoryLedger;
    try {
        runtime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            character: creationCharacter
        });
        const ledger = runtime.api.characterIdentityLedger();
        const identities = Object.values(ledger.identities || {});
        const relationshipLedger = runtime.api.relationshipLedger();
        savedRelationshipLedger = relationshipLedger;
        const memoryLedger = runtime.api.characterMemoryLedger();
        savedMemoryLedger = memoryLedger;
        const relationshipEdges = Object.values(relationshipLedger && relationshipLedger.edges || {});
        const ranked = identities.map(identity => ({
            actorId: identity.id,
            ranking: runtime.api.characterRankOptions(identity.id, options)
        }));
        let divergent = null;
        for (let left = 0; left < ranked.length && !divergent; left++) {
            for (let right = left + 1; right < ranked.length; right++) {
                if (ranked[left].ranking[0].optionId !== ranked[right].ranking[0].optionId) {
                    divergent = { left: ranked[left], right: ranked[right] };
                    break;
                }
            }
        }
        const world = runtime.api.worldV2();
        const knowledge = runtime.api.playerKnowledge(world, 'country:0');
        const foreignKnowledge = runtime.api.playerKnowledge(world, 'country:1');
        const playerActorId = 'character:0:0';
        const creationOutcome = runtime.api.characterCreationOutcome(playerActorId);
        const creationSummary = runtime.api.characterCreationSummary(playerActorId);
        const ownCharacter = knowledge.characters.find(row => row.id.startsWith('character:0:'));
        const foreignCharacter = knowledge.characters.find(row => !row.id.startsWith('character:0:'));
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        const migrated = runtime.api.migrateRaw(savedRaw);
        main = {
            ledger,
            validation: runtime.api.validateCharacterIdentityLedger(ledger),
            identityCount: identities.length,
            roleCounts: identities.reduce((acc, row) => {
                acc[row.role] = (acc[row.role] || 0) + 1;
                return acc;
            }, {}),
            countryCount: runtime.api.state().states.length,
            divergent,
            leftStrategy: divergent ? runtime.api.characterConversationStrategy(divergent.left.actorId, { stakes: 70 }) : null,
            rightStrategy: divergent ? runtime.api.characterConversationStrategy(divergent.right.actorId, { stakes: 70 }) : null,
            optionCounts: ranked.map(row => row.ranking.length),
            worldCharacterCount: world.characters.length,
            worldValidation: runtime.api.validateWorldV2(world),
            knowledgeValidation: runtime.api.validatePlayerKnowledge(knowledge),
            ownIdentityStatus: ownCharacter && ownCharacter.identityProfile.status,
            foreignIdentityStatus: foreignCharacter && foreignCharacter.identityProfile.status,
            creationInputValidation: runtime.api.characterCreationValidate(creationCharacter),
            commanderPolicy: runtime.api.characterCreationPolicy('COMMANDER'),
            relationshipValidation: runtime.api.validateRelationshipLedger(relationshipLedger),
            memoryValidation: runtime.api.validateCharacterMemoryLedger(memoryLedger),
            originMemoryCount: Object.values(memoryLedger.milestones || {})
                .filter(row => row.kind === 'ORIGIN').length,
            originRecentCount: Object.values(memoryLedger.recentByActor || {})
                .flat().filter(row => row.kind === 'ORIGIN').length,
            relationshipCount: relationshipEdges.length,
            asymmetricPair: relationshipEdges.find(edge => {
                const reverse = relationshipLedger.edges[`relationship:${edge.toActorId}=>${edge.fromActorId}`];
                return reverse && (reverse.trustBps !== edge.trustBps || reverse.fearBps !== edge.fearBps
                    || reverse.respectBps !== edge.respectBps || reverse.hostilityBps !== edge.hostilityBps);
            }) || null,
            originSeededRelationshipCount: relationshipEdges.filter(edge =>
                (edge.history || []).some(item => item.source === 'character.creation_profile')).length,
            creationOutcome,
            creationSummary,
            worldFactCount: world.worldFacts.length,
            actorBeliefCount: world.actorBeliefs.length,
            worldRelationshipCount: world.characterRelationships.length,
            visibleRelationshipCount: knowledge.characterRelationships.length,
            foreignPlayerRelationshipLeak: foreignKnowledge.characterRelationships.some(edge =>
                edge.fromActorId === playerActorId || edge.toActorId === playerActorId),
            visibleOriginFactCount: knowledge.originFacts.length,
            foreignOriginFactCount: foreignKnowledge.originFacts.length,
            originCausalEventCount: (runtime.api.state().causality.events || [])
                .filter(row => row.type === 'character.origin_decision_recorded').length,
            migration: {
                ok: migrated.ok,
                validation: migrated.ok ? runtime.api.validateWorldV2(migrated.world) : null,
                worldFactCount: migrated.ok ? migrated.world.worldFacts.length : 0,
                actorBeliefCount: migrated.ok ? migrated.world.actorBeliefs.length : 0,
                originMemoryCount: migrated.ok
                    ? Object.values(migrated.world.memory.milestones || {})
                        .filter(row => row.kind === 'ORIGIN').length
                    : 0,
                unmapped: !!(migrated.ok
                    && migrated.world.diagnostics.migration.unmappedTopLevelFields.includes('characterIdentities'))
            },
            previewMatrixComplete: ['harp', 'idare', 'siyaset'].every(theme =>
                creationTags.every(tag => {
                    const preview = runtime.api.characterDecisionPreview(theme, tag);
                    return !!(preview && preview.gainLabel && preview.costLabel);
                })),
            questionMechanicsHidden: (() => {
                const source = fs.readFileSync(path.join(ROOT, 'js/Character.js'), 'utf8');
                const start = source.indexOf('function charRenderQuestion');
                const end = source.indexOf('function charRenderSummary', start);
                const block = source.slice(start, end);
                return !block.includes('KAZANÇ:') && !block.includes('BEDEL:')
                    && !block.includes('storyCharacterDecisionPreview') && !block.includes('char-tradeoff');
            })(),
            roleQuestionBanksComplete: ['COMPANY_OWNER', 'EXECUTIVE', 'AGENT'].every(role => {
                const policy = runtime.api.characterCreationPolicy(role);
                return Object.entries(policy.counts).every(([theme, count]) => {
                    const questions = Array.from({ length: count }, (_, stage) =>
                        runtime.api.characterQuestionAt(theme, stage, stage ? creationTags[(stage - 1) % 4] : null, role));
                    return questions.every(question => question && question.q && question.o && question.o.length === 4)
                        && new Set(questions.map(question => question.q)).size === count;
                });
            }),
            saveOk: runtime.api.state()._lastSaveOk === true
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const ledger = restoredRuntime.api.characterIdentityLedger();
        const relationships = restoredRuntime.api.relationshipLedger();
        const memory = restoredRuntime.api.characterMemoryLedger();
        restored = {
            loaded,
            validation: restoredRuntime.api.validateCharacterIdentityLedger(ledger),
            equal: JSON.stringify(ledger) === JSON.stringify(main.ledger),
            relationshipValidation: restoredRuntime.api.validateRelationshipLedger(relationships),
            relationshipEqual: JSON.stringify(relationships) === JSON.stringify(savedRelationshipLedger),
            memoryValidation: restoredRuntime.api.validateCharacterMemoryLedger(memory),
            memoryEqual: JSON.stringify(memory) === JSON.stringify(savedMemoryLedger)
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'characters.identityGoals': false },
            character: creationCharacter
        });
        disabled = disabledRuntime.api.characterIdentityLedger();
    } finally {
        disabledRuntime.dom.window.close();
    }
    const roleRuntime = createRuntime((seed + 1) >>> 0);
    let roleSelection;
    try {
        const roleThemes = ['harp', 'harp', 'idare', 'idare', 'idare', 'idare', 'idare', 'idare',
            'siyaset', 'siyaset', 'siyaset', 'siyaset'];
        const roleStages = { harp: 0, idare: 0, siyaset: 0 };
        const roleDecisions = roleThemes.map((theme, index) => ({
            index, role: 'COMPANY_OWNER', theme, stage: roleStages[theme]++,
            branch: index ? creationTags[(index - 1) % creationTags.length] : 'root',
            questionText: `Şirket yöneticisi ikilemi ${index + 1}`,
            optionIndex: index % creationTags.length,
            optionText: `Rol kararı ${index + 1}`,
            optionTag: creationTags[index % creationTags.length], legacyFx: {}, legacySeed: null
        }));
        const roleCharacter = Object.assign({}, creationCharacter, {
            name: 'Test Sanayicisi', role: 'COMPANY_OWNER', decisions: roleDecisions
        });
        roleRuntime.api.newCampaign({
            seed: seed + 1, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            character: roleCharacter
        });
        const actor = roleRuntime.api.characterIdentityView('character:0:0');
        const outcome = roleRuntime.api.characterCreationOutcome('character:0:0');
        const worldActor = roleRuntime.api.worldV2().characters
            .find(row => row.id === 'character:0:0');
        const roleInstitutionCountry = roleRuntime.api.institutionLedger().countries['country:0'];
        const roleInstitutions = Object.values(roleInstitutionCountry.institutions || {});
        const executiveHolder = roleInstitutions.find(row => row.type === 'EXECUTIVE');
        const armedForcesHolder = roleInstitutions.find(row => row.type === 'ARMED_FORCES');
        roleSelection = {
            validation: roleRuntime.api.characterCreationValidate(roleCharacter),
            commanderTokenRole: roleRuntime.api.state().commander.creationRole,
            canonicalIdentityRole: actor && actor.role,
            policy: roleRuntime.api.characterCreationPolicy('COMPANY_OWNER'),
            organizationId: actor && actor.organizationId,
            publicTitle: actor && actor.publicTitle,
            career: actor && actor.career,
            worldOrganizationId: worldActor && worldActor.organizationId,
            executiveHolderActorId: executiveHolder && executiveHolder.officeHolder.actorId,
            armedForcesHolderActorId: armedForcesHolder && armedForcesHolder.officeHolder.actorId,
            allEffectsUseCareer: !!(outcome && outcome.profile.decisions.every(row => (
                row.gain.scope === 'CHARACTER_CAREER'
                && row.cost.scope === 'CHARACTER_CAREER'
            )))
        };
    } finally {
        roleRuntime.dom.window.close();
    }
    return { main, restored, disabled, roleSelection };
}

function probeCharacterMemory(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main, savedRaw, savedMemory;
    const playerActorId = 'character:0:0';
    const colleagueActorId = 'character:0:1';
    let foreignActorId = null;
    const ownSecretId = 'character-memory:test:secret-own';
    const foreignSecretId = 'character-memory:test:secret-foreign';
    let realDebtId = null;
    let realIntegritySecretId = null;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        foreignActorId = Object.values(runtime.api.characterIdentityLedger().identities || {})
            .find(row => row.countryId === 'country:1').id;
        runtime.api.state().states[0].laws.tax = 'moderate';
        runtime.api.talkRun('law-complaint');
        const generatedTalk = runtime.api.talkQueue().find(row => row.tpl === 'law-complaint');
        const realTalkEpisodeOpen = !!(generatedTalk && generatedTalk.memoryEpisodeId
            && runtime.api.characterMemoryLedger().episodes[generatedTalk.memoryEpisodeId]
            && runtime.api.characterMemoryLedger().episodes[generatedTalk.memoryEpisodeId].status === 'OPEN');
        if (generatedTalk) runtime.api.talkAnswer(generatedTalk.uid, 0);
        const ownState = runtime.api.state().states.find(row => Number(row.id) === 0);
        const bribeTarget = (ownState.gov && ownState.gov.commanders || [])
            .find(row => `character:0:${row.id}` !== playerActorId);
        runtime.api.state().commander.res.points = Math.max(600, Number(runtime.api.state().commander.res.points) || 0);
        if (bribeTarget) bribeTarget.loyalty = 20;
        runtime.api.talkRun('ultimatum');
        const ultimatumTalk = runtime.api.talkQueue().find(row => row.tpl === 'ultimatum');
        if (ultimatumTalk) runtime.api.talkAnswer(ultimatumTalk.uid, 1);
        runtime.api.integrityTick(5);
        for (let index = 0; index < 40; index++) {
            runtime.api.characterMemoryAddRecent(playerActorId, {
                id: `character-memory:test:recent:${index}`,
                kind: index % 2 ? 'DECISION' : 'RELATIONSHIP',
                summary: `Yakın test kaydı ${index}`,
                occurredAt: index,
                importanceBps: 1000 + index
            });
        }
        const episode = runtime.api.characterMemoryOpenEpisode({
            id: 'character-memory:test:episode-open',
            topicKey: 'steel-routing-negotiation',
            participantActorIds: [playerActorId, colleagueActorId],
            summary: 'İngiltere çelik sevkiyatının oyuncu deposuna yönlendirilmesi',
            unresolvedTopic: 'Fiyat, teslim rotası ve siyasi karşılık henüz karara bağlanmadı.',
            importanceBps: 8200,
            source: { eventId: 'event:test:steel-routing' }
        });
        const promise = runtime.api.characterMemoryAddMilestone({
            id: 'character-memory:test:promise', kind: 'PROMISE',
            subjectActorId: playerActorId, holderActorIds: [playerActorId, colleagueActorId],
            relatedActorIds: [colleagueActorId], summary: 'Çelik teslimatı sonrası ortak depo kapasitesi kurulacak.',
            status: 'OPEN', importanceBps: 9500, dueAt: 180,
            source: { episodeId: episode.episode.id, eventId: 'event:test:promise' }
        });
        const ownSecret = runtime.api.characterMemoryAddMilestone({
            id: ownSecretId, kind: 'SECRET', subjectActorId: playerActorId,
            holderActorIds: [playerActorId], relatedActorIds: [colleagueActorId],
            summary: 'Alternatif tedarikçinin kimliği yalnız oyuncu tarafından biliniyor.',
            status: 'ACTIVE', importanceBps: 9800,
            source: { eventId: 'event:test:secret-own' }
        });
        runtime.api.characterMemoryAddMilestone({
            id: foreignSecretId, kind: 'SECRET', subjectActorId: foreignActorId,
            holderActorIds: [foreignActorId], relatedActorIds: [],
            summary: 'Yabancı devletin kapalı tedarik kanalı.', status: 'ACTIVE', importanceBps: 9800,
            source: { eventId: 'event:test:secret-foreign' }
        });
        const ledger = runtime.api.characterMemoryLedger();
        const realDebt = Object.values(ledger.milestones || {}).find(row =>
            row.kind === 'DEBT' && row.source && row.source.talkTemplateId === 'ultimatum');
        const realIntegritySecret = Object.values(ledger.milestones || {}).find(row =>
            row.kind === 'SECRET' && row.source && row.source.integrityEvidenceId);
        realDebtId = realDebt && realDebt.id;
        realIntegritySecretId = realIntegritySecret && realIntegritySecret.id;
        const debtEdge = ultimatumTalk
            ? runtime.api.relationshipView(ultimatumTalk.speakerActorId, playerActorId) : null;
        savedMemory = ledger;
        const world = runtime.api.worldV2();
        const ownKnowledge = runtime.api.playerKnowledge(world, 'country:0');
        const foreignKnowledge = runtime.api.playerKnowledge(world, 'country:1');
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        const migrated = runtime.api.migrateRaw(savedRaw);
        main = {
            validation: runtime.api.validateCharacterMemoryLedger(ledger),
            realTalkEpisodeOpen,
            realTalkEpisodeResolved: !!(generatedTalk && ledger.episodes[generatedTalk.memoryEpisodeId]
                && ledger.episodes[generatedTalk.memoryEpisodeId].status === 'RESOLVED'),
            realTalkPromiseRecorded: Object.values(ledger.milestones || {}).some(row =>
                row.kind === 'PROMISE' && row.source && row.source.talkTemplateId === 'law-complaint'),
            realBribeTalkResolved: !!(ultimatumTalk && !runtime.api.talkQueue().some(row => row.uid === ultimatumTalk.uid)),
            realDebtRecorded: !!realDebt,
            realDebtReceiptGrounded: !!(realDebt && realDebt.source && realDebt.source.sourceReceiptId),
            realDebtRelationshipRaised: !!(debtEdge && debtEdge.debtBps >= 2500),
            realIntegritySecretRecorded: !!realIntegritySecret,
            realIntegritySecretHeldByAgent: !!(realIntegritySecret
                && realIntegritySecret.holderActorIds.every(actorId => /:agent:/.test(actorId))),
            recentCount: (ledger.recentByActor[playerActorId] || []).length,
            summaryCount: (ledger.summariesByActor[playerActorId] || []).length,
            episodeApplied: episode.applied,
            openEpisodePreserved: ledger.episodes['character-memory:test:episode-open']
                && ledger.episodes['character-memory:test:episode-open'].status === 'OPEN',
            unresolvedTopic: ledger.episodes['character-memory:test:episode-open']
                && ledger.episodes['character-memory:test:episode-open'].unresolvedTopic,
            promiseApplied: promise.applied,
            ownSecretApplied: ownSecret.applied,
            milestoneCount: Object.keys(ledger.milestones || {}).length,
            milestoneSurvivedRecentPrune: !!ledger.milestones[ownSecretId],
            worldValidation: runtime.api.validateWorldV2(world),
            knowledgeValidation: runtime.api.validatePlayerKnowledge(ownKnowledge),
            ownSeesOwnSecret: !!(ownKnowledge.characterMemory
                && ownKnowledge.characterMemory.milestones[ownSecretId]),
            foreignSeesOwnSecret: !!(foreignKnowledge.characterMemory
                && foreignKnowledge.characterMemory.milestones[ownSecretId]),
            ownSeesForeignSecret: !!(ownKnowledge.characterMemory
                && ownKnowledge.characterMemory.milestones[foreignSecretId]),
            foreignSeesForeignSecret: !!(foreignKnowledge.characterMemory
                && foreignKnowledge.characterMemory.milestones[foreignSecretId]),
            migration: {
                ok: migrated.ok,
                validation: migrated.ok ? runtime.api.validateWorldV2(migrated.world) : null,
                memoryEqual: !!(migrated.ok
                    && JSON.stringify(migrated.world.memory) === JSON.stringify(ledger)),
                unmapped: !!(migrated.ok
                    && migrated.world.diagnostics.migration.unmappedTopLevelFields.includes('characterMemory'))
            },
            saveOk: runtime.api.state()._lastSaveOk === true
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const ledger = restoredRuntime.api.characterMemoryLedger();
        restored = {
            loaded,
            validation: restoredRuntime.api.validateCharacterMemoryLedger(ledger),
            equal: JSON.stringify(ledger) === JSON.stringify(savedMemory),
            openEpisodePreserved: !!(ledger.episodes['character-memory:test:episode-open']
                && ledger.episodes['character-memory:test:episode-open'].status === 'OPEN'
                && ledger.episodes['character-memory:test:episode-open'].unresolvedTopic),
            promisePreserved: !!ledger.milestones['character-memory:test:promise'],
            secretPreserved: !!ledger.milestones[ownSecretId],
            debtPreserved: !!(realDebtId && ledger.milestones[realDebtId]),
            integritySecretPreserved: !!(realIntegritySecretId && ledger.milestones[realIntegritySecretId])
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        const legacySave = JSON.parse(savedRaw);
        delete legacySave.characterMemory;
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        const loaded = legacyRuntime.api.loadNow();
        const ledger = legacyRuntime.api.characterMemoryLedger();
        legacy = {
            loaded,
            validation: legacyRuntime.api.validateCharacterMemoryLedger(ledger),
            backfilled: !!(ledger.diagnostics && ledger.diagnostics.backfilled),
            inventedFacts: !!(ledger.diagnostics && ledger.diagnostics.inventedFacts),
            milestoneCount: Object.keys(ledger.milestones || {}).length
        };
    } finally {
        legacyRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'characters.threeLayerMemory': false }
        });
        disabled = disabledRuntime.api.characterMemoryLedger();
    } finally {
        disabledRuntime.dom.window.close();
    }
    const dependencyDisabledRuntime = createRuntime(seed >>> 0);
    let dependencyDisabled;
    try {
        dependencyDisabledRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'characters.identityGoals': false }
        });
        dependencyDisabledRuntime.api.state().states[0].laws.tax = 'moderate';
        dependencyDisabledRuntime.api.talkRun('law-complaint');
        dependencyDisabled = {
            memory: dependencyDisabledRuntime.api.characterMemoryLedger(),
            talkCount: dependencyDisabledRuntime.api.talkQueue().length
        };
    } finally {
        dependencyDisabledRuntime.dom.window.close();
    }
    return { main, restored, legacy, disabled, dependencyDisabled };
}

function probeCharacterActions(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main, savedRaw, savedLedger, pendingSabotageRaw, sabotageReceiptId;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = runtime.api.state();
        const playerState = story.states.find(row => Number(row.id) === Number(story.playerStateId));
        // Komutan rolü, seferberlik emrinin gerçek ARMED_FORCES makamından
        // geçtiğini sınar; oyuncuya geçici veya sahte yetki eklenmez.
        playerState.gov.leader = 'ai';
        story.commander.skills.warrior = 99;
        runtime.api.institutionTick(5);
        const identities = Object.values(runtime.api.characterIdentityLedger().identities || {});
        const playerActorId = `character:${story.playerStateId}:${story.commander.id}`;
        const player = identities.find(row => row.id === playerActorId);
        const localTarget = identities.find(row => row.countryId === player.countryId && row.id !== playerActorId);
        const institutionLedger = story.institutions;
        const playerCountry = institutionLedger.countries[player.countryId];
        const armedForces = Object.values(playerCountry.institutions || {})
            .find(row => row.type === 'ARMED_FORCES');
        const officeActorId = armedForces.officeHolder.actorId;
        const officeActor = identities.find(row => row.id === officeActorId);
        const officeTarget = identities.find(row => row.countryId === officeActor.countryId
            && row.id !== officeActorId && row.role === officeActor.role)
            || identities.find(row => row.countryId === officeActor.countryId && row.id !== officeActorId);
        const agent = identities.find(row => row.role === 'AGENT' && row.serviceId);
        const agentForeignTarget = identities.find(row => row.countryId !== agent.countryId);
        const liveAgent = story.characterIdentities.identities[agent.id];
        liveAgent.career.capability = 99;
        const unrelatedForeignTarget = identities.find(row => row.countryId !== player.countryId
            && row.countryId !== agentForeignTarget.countryId);
        const targetRegion = story.nodes.find(node => Number(node.owner) === Number(story.playerStateId)
            && Number(node.garrison || 0) < Number(node.level || 1) * 4);
        const sabotageCountryId = Number(String(agentForeignTarget.countryId).split(':').pop());
        const corridor = runtime.api.infrastructureSnapshot().corridors.find(row => (
            row.mode === 'LAND' && row.endpointRegionIds.some(regionId => {
                const nodeId = Number(String(regionId).split(':').pop());
                const node = story.nodes.find(candidate => Number(candidate.id) === nodeId);
                return node && Number(node.owner) === sabotageCountryId;
            })
        ));
        if (!corridor) throw new Error('Faz 37 sabotaj probu için hedef ülkeye ait koridor bulunamadı.');
        const orderDomain = {
            commandType: 'MOBILIZE_RESERVE', targetRegionId: `region:${targetRegion.id}`
        };

        const candidates = [
            runtime.api.characterActionCandidate({ actionType: 'PERSUADE', actorId: playerActorId, targetActorId: localTarget.id }),
            runtime.api.characterActionCandidate({ actionType: 'NEGOTIATE', actorId: playerActorId, targetActorId: localTarget.id }),
            runtime.api.characterActionCandidate({
                actionType: 'ORDER', actorId: playerActorId, targetActorId: officeTarget.id,
                domainContext: orderDomain
            }),
            runtime.api.characterActionCandidate({
                actionType: 'SABOTAGE', actorId: agent.id, targetActorId: agentForeignTarget.id,
                domainContext: {
                    assetType: 'INFRASTRUCTURE_CORRIDOR', targetAssetId: corridor.id
                }
            }),
            runtime.api.characterActionCandidate({ actionType: 'ALLY', actorId: playerActorId, targetActorId: localTarget.id }),
            runtime.api.characterActionCandidate({
                actionType: 'RESIGN', actorId: officeActorId,
                domainContext: { targetInstitutionId: armedForces.id }
            }),
            runtime.api.characterActionCandidate({ actionType: 'BETRAY', actorId: playerActorId, targetActorId: localTarget.id })
        ];
        const beforeCareer = JSON.parse(JSON.stringify(player.career));
        const beforeRelationship = runtime.api.relationshipView(localTarget.id, playerActorId);
        const manpowerBeforeOrder = Number(story.commander.res.manpower) || 0;
        const garrisonBeforeOrder = Number(targetRegion.garrison) || 0;
        const ordered = runtime.api.characterActionExecute({
            actionType: 'ORDER', actorId: playerActorId, targetActorId: officeTarget.id,
            domainContext: orderDomain, decisionSource: 'PLAYER_UI'
        });
        let orderRequest = ordered.ok
            && story.institutions.requests[ordered.receipt.domainReceipt.requestId];
        for (let index = 0; index < 60 && orderRequest && !orderRequest.domainDecision.result; index++) {
            story.clock += 5;
            runtime.api.stateCapacityTick(5);
            runtime.api.governanceTick(5);
            orderRequest = story.institutions.requests[ordered.receipt.domainReceipt.requestId];
        }
        const orderFinalReceipt = runtime.api.characterActionLedger().receipts[ordered.receipt.id];
        const persuaded = runtime.api.characterActionExecute({
            actionType: 'PERSUADE', actorId: playerActorId, targetActorId: localTarget.id
        });
        const cooldownCandidate = runtime.api.characterActionCandidate({
            actionType: 'PERSUADE', actorId: playerActorId, targetActorId: localTarget.id
        });
        const negotiated = runtime.api.characterActionExecute({
            actionType: 'NEGOTIATE', actorId: playerActorId, targetActorId: localTarget.id
        });
        const allied = runtime.api.characterActionExecute({
            actionType: 'ALLY', actorId: playerActorId, targetActorId: localTarget.id
        });
        const afterAllianceRelationship = runtime.api.relationshipView(localTarget.id, playerActorId);
        const betrayed = runtime.api.characterActionExecute({
            actionType: 'BETRAY', actorId: playerActorId, targetActorId: localTarget.id
        });
        const sabotageDamageBefore = Number(runtime.api.infrastructureSnapshot().corridors
            .find(row => row.id === corridor.id).damageBps) || 0;
        const sabotageCapabilityBefore = Number(liveAgent.career.capability) || 0;
        const sabotaged = runtime.api.characterActionExecute({
            actionType: 'SABOTAGE', actorId: agent.id, targetActorId: agentForeignTarget.id,
            domainContext: { assetType: 'INFRASTRUCTURE_CORRIDOR', targetAssetId: corridor.id },
            decisionSource: 'PLAYER_OR_SYSTEM'
        });
        sabotageReceiptId = sabotaged.receipt.id;
        const sabotagePendingReceipt = sabotaged.receipt;
        runtime.api.saveNow();
        pendingSabotageRaw = runtime.api.savedRaw();
        story.clock += 30;
        const sabotageSync = runtime.api.characterActionSyncDomains();
        const sabotageFinalReceipt = runtime.api.characterActionLedger().receipts[sabotaged.receipt.id];
        const sabotageInfrastructureAfter = runtime.api.infrastructureSnapshot();
        const sabotageCorridorAfter = sabotageInfrastructureAfter.corridors
            .find(row => row.id === corridor.id);
        const sabotageDamageAfter = Number(sabotageCorridorAfter.damageBps) || 0;
        const officeBeforeResign = runtime.api.institutionCountryView(player.countryId)
            .institutions[armedForces.id].officeHolder;
        const receiptCountBeforeResign = Object.keys(runtime.api.characterActionLedger().receipts || {}).length;
        runtime.dom.window.document.dispatchEvent(new runtime.dom.window.Event('DOMContentLoaded'));
        runtime.api.governanceUpdate();
        const resignButtonBefore = runtime.dom.window.document.querySelector(
            `[data-governance-resign="${armedForces.id}"]`
        );
        if (resignButtonBefore) resignButtonBefore.click();
        const receiptCountAfterArm = Object.keys(runtime.api.characterActionLedger().receipts || {}).length;
        const resignButtonArmed = runtime.dom.window.document.querySelector(
            `[data-governance-resign="${armedForces.id}"]`
        );
        if (resignButtonArmed) resignButtonArmed.click();
        const resignedReceipt = Object.values(runtime.api.characterActionLedger().receipts || {})
            .find(row => row.actionType === 'RESIGN');
        const resigned = { ok: !!resignedReceipt, receipt: resignedReceipt || null };
        const officeAfterResign = runtime.api.institutionCountryView(player.countryId)
            .institutions[armedForces.id].officeHolder;
        const unsupported = runtime.api.characterActionExecute({
            actionType: 'RETIRE', actorId: officeActorId
        });
        const afterCareer = runtime.api.characterIdentityView(playerActorId).career;
        const afterRelationship = runtime.api.relationshipView(localTarget.id, playerActorId);
        const memory = runtime.api.characterMemoryLedger();
        const ledger = runtime.api.characterActionLedger();
        const world = runtime.api.worldV2();
        const ownKnowledge = runtime.api.playerKnowledge(world, player.countryId);
        const sabotageTargetKnowledge = runtime.api.playerKnowledge(world, agentForeignTarget.countryId);
        const foreignKnowledge = runtime.api.playerKnowledge(world, unrelatedForeignTarget.countryId);
        const detectedFixtureWorld = JSON.parse(JSON.stringify(world));
        const detectedFixtureReceipt = detectedFixtureWorld.characterActions.find(row => row.id === sabotaged.receipt.id);
        detectedFixtureReceipt.domainReceipt.finalResult.detected = true;
        detectedFixtureReceipt.domainReceipt.finalResult.attributed = false;
        detectedFixtureReceipt.domainReceipt.finalResult.testFixture = 'DETECTED_UNATTRIBUTED';
        const detectedFixtureKnowledge = runtime.api.playerKnowledge(
            detectedFixtureWorld, agentForeignTarget.countryId
        );
        const attributedFixtureWorld = JSON.parse(JSON.stringify(detectedFixtureWorld));
        const attributedFixtureReceipt = attributedFixtureWorld.characterActions.find(row => row.id === sabotaged.receipt.id);
        attributedFixtureReceipt.domainReceipt.finalResult.attributed = true;
        attributedFixtureReceipt.domainReceipt.finalResult.testFixture = 'DETECTED_ATTRIBUTED';
        const attributedFixtureKnowledge = runtime.api.playerKnowledge(
            attributedFixtureWorld, agentForeignTarget.countryId
        );
        savedLedger = ledger;
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        const migrated = runtime.api.migrateRaw(savedRaw);
        main = {
            actionTypes: candidates.map(row => row.actionType),
            allContractsPresent: candidates.every(row => row.targetValidation && row.authority
                && row.cost && Number.isFinite(row.availableAt) && Array.isArray(row.reasons)),
            executableTypes: candidates.filter(row => row.handlerAvailable).map(row => row.actionType),
            unavailableTypes: candidates.filter(row => !row.handlerAvailable).map(row => row.actionType),
            unavailableExplainExecutor: candidates.filter(row => !row.handlerAvailable)
                .every(row => row.reasons.includes('DOMAIN_EXECUTOR_NOT_AVAILABLE')),
            institutionalAuthorityResolved: candidates.filter(row => ['ORDER', 'RESIGN'].includes(row.actionType))
                .every(row => row.authority.ok && row.authority.grants.length > 0),
            intelligenceAuthorityResolved: candidates.find(row => row.actionType === 'SABOTAGE').authority.ok,
            ordered,
            orderPhysicalResult: {
                requestStatus: orderRequest && orderRequest.status,
                domainStatus: orderRequest && orderRequest.domainDecision
                    && orderRequest.domainDecision.result && orderRequest.domainDecision.result.status,
                physicalMutation: !!(orderRequest && orderRequest.domainDecision
                    && orderRequest.domainDecision.result && orderRequest.domainDecision.result.physicalMutation),
                manpowerSpent: manpowerBeforeOrder - (Number(story.commander.res.manpower) || 0),
                garrisonDelta: (Number(targetRegion.garrison) || 0) - garrisonBeforeOrder,
                receiptOutcomeModel: orderFinalReceipt && orderFinalReceipt.domainReceipt
                    && orderFinalReceipt.domainReceipt.outcomeModel,
                receiptFinalStatus: orderFinalReceipt && orderFinalReceipt.domainReceipt
                    && orderFinalReceipt.domainReceipt.finalResult
                    && orderFinalReceipt.domainReceipt.finalResult.status,
                memoryResolved: !!(orderFinalReceipt && orderFinalReceipt.memory
                    && orderFinalReceipt.memory.episodeResolved)
            },
            sabotaged,
            sabotageResult: {
                pendingOutcomeModel: sabotagePendingReceipt.domainReceipt.outcomeModel,
                pendingPhysicalMutation: sabotagePendingReceipt.domainReceipt.physicalMutation,
                syncChanged: sabotageSync.changed,
                finalOutcomeModel: sabotageFinalReceipt.domainReceipt.outcomeModel,
                finalResult: sabotageFinalReceipt.domainReceipt.finalResult,
                capabilitySpent: sabotageCapabilityBefore - (Number(liveAgent.career.capability) || 0),
                damageBeforeBps: sabotageDamageBefore,
                damageAfterBps: sabotageDamageAfter,
                effectiveCapacityBefore: Number(corridor.effectiveCapacity) || 0,
                effectiveCapacityAfter: Number(sabotageCorridorAfter.effectiveCapacity) || 0,
                infrastructureValidation: runtime.api.validateInfrastructureSnapshot(sabotageInfrastructureAfter),
                memoryResolved: !!(sabotageFinalReceipt.memory && sabotageFinalReceipt.memory.episodeResolved),
                targetVisibleCount: sabotageTargetKnowledge.characterActions.length,
                targetSawIncident: sabotageTargetKnowledge.characterActions.some(row => row.id === sabotaged.receipt.id),
                targetActorIdentityVisible: sabotageTargetKnowledge.characterActions.some(row => (
                    row.id === sabotaged.receipt.id && row.actorId === agent.id
                )),
                targetSecretOddsLeaked: JSON.stringify(sabotageTargetKnowledge.characterActions).includes('successChanceBps')
                    || JSON.stringify(sabotageTargetKnowledge.characterActions).includes('resolutionCommitment'),
                targetKnowledgeValidation: runtime.api.validatePlayerKnowledge(sabotageTargetKnowledge)
            },
            sabotageDisclosureFixtures: {
                detectedUnattributed: {
                    actionCount: detectedFixtureKnowledge.characterActions.length,
                    actorId: detectedFixtureKnowledge.characterActions[0]
                        && detectedFixtureKnowledge.characterActions[0].actorId,
                    oddsLeaked: JSON.stringify(detectedFixtureKnowledge.characterActions).includes('ChanceBps')
                        || JSON.stringify(detectedFixtureKnowledge.characterActions).includes('resolutionCommitment'),
                    validation: runtime.api.validatePlayerKnowledge(detectedFixtureKnowledge)
                },
                detectedAttributed: {
                    actionCount: attributedFixtureKnowledge.characterActions.length,
                    actorId: attributedFixtureKnowledge.characterActions[0]
                        && attributedFixtureKnowledge.characterActions[0].actorId,
                    validation: runtime.api.validatePlayerKnowledge(attributedFixtureKnowledge)
                }
            },
            persuaded, negotiated, allied, betrayed, resigned, unsupported,
            resignationResult: {
                firstButtonPresent: !!resignButtonBefore,
                armedButtonPresent: !!resignButtonArmed,
                firstClickCreatedReceipt: receiptCountAfterArm !== receiptCountBeforeResign,
                previousActorId: officeBeforeResign && officeBeforeResign.actorId,
                successorActorId: officeAfterResign && officeAfterResign.actorId,
                successorName: officeAfterResign && officeAfterResign.name,
                actorNoLongerHoldsOffice: !(runtime.api.characterActionCandidate({
                    actionType: 'RESIGN', actorId: officeActorId,
                    domainContext: { targetInstitutionId: armedForces.id }
                }).authority.grants || []).some(row => row.institutionId === armedForces.id),
                outcomeModel: resigned.receipt && resigned.receipt.domainReceipt
                    && resigned.receipt.domainReceipt.outcomeModel,
                physicalMutation: !!(resigned.receipt && resigned.receipt.domainReceipt
                    && resigned.receipt.domainReceipt.physicalMutation),
                transitionCount: Object.keys(ledger.officeTransitions || {}).length,
                memoryResolved: !!(resigned.receipt && resigned.receipt.memory
                    && resigned.receipt.memory.episodeResolved)
            },
            cooldownBlocked: !cooldownCandidate.allowed
                && cooldownCandidate.reasons.includes('ACTION_ON_COOLDOWN')
                && cooldownCandidate.availableAt > cooldownCandidate.generatedAt,
            influenceSpent: beforeCareer.influence - afterCareer.influence,
            credibilitySpent: beforeCareer.credibility - afterCareer.credibility,
            relationshipTrustGainBeforeBetrayal: afterAllianceRelationship.trustBps - beforeRelationship.trustBps,
            relationshipRespectGainBeforeBetrayal: afterAllianceRelationship.respectBps - beforeRelationship.respectBps,
            betrayalTrustDelta: afterRelationship.trustBps - afterAllianceRelationship.trustBps,
            betrayalHostilityDelta: afterRelationship.hostilityBps - afterAllianceRelationship.hostilityBps,
            resolvedActionEpisodes: Object.values(memory.episodes || {}).filter(row =>
                row.source && row.source.type === 'CHARACTER_ACTION_RECEIPT' && row.status === 'RESOLVED').length,
            allianceMilestones: Object.values(memory.milestones || {}).filter(row =>
                row.source && row.source.actionType === 'ALLY').length,
            brokenAllianceMilestones: Object.values(memory.milestones || {}).filter(row =>
                row.source && row.source.actionType === 'ALLY' && row.status === 'BROKEN').length,
            betrayalMilestones: Object.values(memory.milestones || {}).filter(row =>
                row.kind === 'BETRAYAL' && row.source && row.source.actionType === 'BETRAY').length,
            betrayalReceiptBreaksAlliance: betrayed.receipt.memory.brokenAllianceIds.length === 1,
            validation: runtime.api.validateCharacterActionLedger(ledger),
            worldValidation: runtime.api.validateWorldV2(world),
            worldActionCount: world.characterActions.length,
            ownKnowledgeValidation: runtime.api.validatePlayerKnowledge(ownKnowledge),
            foreignKnowledgeValidation: runtime.api.validatePlayerKnowledge(foreignKnowledge),
            ownVisibleActionCount: ownKnowledge.characterActions.length,
            foreignVisibleActionCount: foreignKnowledge.characterActions.length,
            migration: {
                ok: migrated.ok,
                validation: migrated.ok ? runtime.api.validateWorldV2(migrated.world) : null,
                actionCount: migrated.ok ? migrated.world.characterActions.length : 0,
                equal: !!(migrated.ok
                    && JSON.stringify(migrated.world.characterActions) === JSON.stringify(world.characterActions)),
                unmapped: !!(migrated.ok
                    && migrated.world.diagnostics.migration.unmappedTopLevelFields.includes('characterActions'))
            },
            summary: runtime.api.characterActionSummary(),
            saveOk: !!savedRaw && JSON.parse(savedRaw).characterActions != null
        };
    } finally {
        runtime.dom.window.close();
    }

    const restoredRuntime = createRuntime(seed >>> 0);
    let restored;
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        const loaded = restoredRuntime.api.loadNow();
        const ledger = restoredRuntime.api.characterActionLedger();
        const savedObject = JSON.parse(savedRaw);
        const sabotageReceipt = Object.values(ledger.receipts || {}).find(row => row.actionType === 'SABOTAGE');
        const resignReceipt = Object.values(ledger.receipts || {}).find(row => row.actionType === 'RESIGN');
        const sabotageCorridor = sabotageReceipt && restoredRuntime.api.infrastructureSnapshot().corridors
            .find(row => row.id === sabotageReceipt.domainReceipt.targetAssetId);
        const restoredOffice = resignReceipt && restoredRuntime.api.institutionCountryView(resignReceipt.actorCountryId)
            .institutions[resignReceipt.domainReceipt.institutionId];
        restored = {
            loaded,
            validation: restoredRuntime.api.validateCharacterActionLedger(ledger),
            equal: JSON.stringify(ledger) === JSON.stringify(savedLedger),
            institutionLedgerEqual: JSON.stringify(restoredRuntime.api.state().institutions)
                === JSON.stringify(savedObject.institutions),
            sabotageDamagePreserved: !!(sabotageReceipt && sabotageCorridor
                && Number(sabotageCorridor.damageBps)
                    === Number(sabotageReceipt.domainReceipt.finalResult.damageBps)),
            resignationSuccessorPreserved: !!(resignReceipt && restoredOffice && restoredOffice.officeHolder
                && restoredOffice.officeHolder.actorId === resignReceipt.domainReceipt.successorHolder.actorId),
            summary: restoredRuntime.api.characterActionSummary()
        };
    } finally {
        restoredRuntime.dom.window.close();
    }

    const sabotageResumeRuntime = createRuntime(seed >>> 0);
    let sabotageResume;
    try {
        sabotageResumeRuntime.api.putSavedRaw(pendingSabotageRaw);
        const loaded = sabotageResumeRuntime.api.loadNow();
        const story = sabotageResumeRuntime.api.state();
        story.clock += 30;
        const sync = sabotageResumeRuntime.api.characterActionSyncDomains();
        const receipt = sabotageResumeRuntime.api.characterActionLedger().receipts[sabotageReceiptId];
        const corridor = sabotageResumeRuntime.api.infrastructureSnapshot().corridors.find(row => (
            row.id === receipt.domainReceipt.targetAssetId
        ));
        const uninterruptedReceipt = savedLedger.receipts[sabotageReceiptId];
        sabotageResume = {
            loaded,
            syncChanged: sync.changed,
            validation: sabotageResumeRuntime.api.validateCharacterActionLedger(
                sabotageResumeRuntime.api.characterActionLedger()
            ),
            finalDomainEqual: JSON.stringify(receipt.domainReceipt)
                === JSON.stringify(uninterruptedReceipt.domainReceipt),
            finalMemoryEqual: JSON.stringify(receipt.memory)
                === JSON.stringify(uninterruptedReceipt.memory),
            damageBps: corridor && corridor.damageBps,
            expectedDamageBps: uninterruptedReceipt.domainReceipt.finalResult.damageBps
        };
    } finally {
        sabotageResumeRuntime.dom.window.close();
    }

    const version2Runtime = createRuntime(seed >>> 0);
    let version2;
    try {
        const version2Save = JSON.parse(savedRaw);
        version2Save.characterActions.schemaVersion = 2;
        version2Save.characterActions.adapterVersion = 'story-character-action-ledger-2';
        version2Save.characterActions.ai.policyHash = 'fnv1a32:phase37-deterministic-selector-1';
        version2Runtime.api.putSavedRaw(JSON.stringify(version2Save));
        const loaded = version2Runtime.api.loadNow();
        const ledger = version2Runtime.api.characterActionLedger();
        version2 = {
            loaded,
            validation: version2Runtime.api.validateCharacterActionLedger(ledger),
            schemaVersion: ledger && ledger.schemaVersion,
            policyHash: ledger && ledger.ai && ledger.ai.policyHash,
            receiptCount: Object.keys(ledger && ledger.receipts || {}).length
        };
    } finally {
        version2Runtime.dom.window.close();
    }

    const version3Runtime = createRuntime(seed >>> 0);
    let version3;
    try {
        const version3Save = JSON.parse(savedRaw);
        const receipts = version3Save.characterActions.receipts || {};
        for (const [id, receipt] of Object.entries(receipts)) {
            if (['ORDER', 'SABOTAGE', 'RESIGN'].includes(receipt.actionType)) {
                delete receipts[id];
                continue;
            }
            delete receipt.targetModel;
            delete receipt.domainContext;
            delete receipt.domainReceipt;
        }
        version3Save.characterActions.officeTransitions = {};
        version3Save.characterActions.schemaVersion = 3;
        version3Save.characterActions.adapterVersion = 'story-character-action-ledger-3';
        version3Runtime.api.putSavedRaw(JSON.stringify(version3Save));
        const loaded = version3Runtime.api.loadNow();
        const ledger = version3Runtime.api.characterActionLedger();
        version3 = {
            loaded,
            validation: version3Runtime.api.validateCharacterActionLedger(ledger),
            schemaVersion: ledger && ledger.schemaVersion,
            receiptCount: Object.keys(ledger && ledger.receipts || {}).length,
            typedContractsBackfilled: Object.values(ledger && ledger.receipts || {}).every(receipt => (
                receipt.targetModel === 'CHARACTER'
                && receipt.domainContext && typeof receipt.domainContext === 'object'
                && receipt.domainReceipt === null
            ))
        };
    } finally {
        version3Runtime.dom.window.close();
    }

    const legacyRuntime = createRuntime(seed >>> 0);
    let legacy;
    try {
        const legacySave = JSON.parse(savedRaw);
        delete legacySave.characterActions;
        legacyRuntime.api.putSavedRaw(JSON.stringify(legacySave));
        const loaded = legacyRuntime.api.loadNow();
        const ledger = legacyRuntime.api.characterActionLedger();
        legacy = {
            loaded,
            validation: legacyRuntime.api.validateCharacterActionLedger(ledger),
            backfilled: !!(ledger.diagnostics && ledger.diagnostics.backfilled),
            receiptCount: Object.keys(ledger.receipts || {}).length
        };
    } finally {
        legacyRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'characters.actionCandidates': false }
        });
        disabled = disabledRuntime.api.characterActionLedger();
    } finally {
        disabledRuntime.dom.window.close();
    }

    const dependencyDisabledRuntime = createRuntime(seed >>> 0);
    let dependencyDisabled;
    try {
        dependencyDisabledRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'characters.threeLayerMemory': false }
        });
        dependencyDisabled = dependencyDisabledRuntime.api.characterActionLedger();
    } finally {
        dependencyDisabledRuntime.dom.window.close();
    }

    const uninterruptedRuntime = createRuntime(seed >>> 0);
    let aiUninterrupted;
    try {
        uninterruptedRuntime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        uninterruptedRuntime.api.advance(40);
        const ledger = uninterruptedRuntime.api.characterActionLedger();
        const playerActorId = `character:0:${uninterruptedRuntime.api.state().commander.id}`;
        const receipts = Object.values(ledger.receipts || {});
        aiUninterrupted = {
            ledger,
            scheduler: uninterruptedRuntime.api.schedulerSnapshot(),
            receiptCount: receipts.length,
            allDeterministicAI: receipts.every(row => row.decisionSource === 'DETERMINISTIC_AI'
                && Number.isFinite(row.selectorScore) && row.selectorReasons.length > 0),
            playerNeverControlled: receipts.every(row => row.actorId !== playerActorId),
            bounded: receipts.length <= 4,
            summary: uninterruptedRuntime.api.characterActionSummary()
        };
    } finally {
        uninterruptedRuntime.dom.window.close();
    }

    const checkpointRuntime = createRuntime(seed >>> 0);
    let checkpointRaw;
    try {
        checkpointRuntime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        checkpointRuntime.api.advance(22.5);
        checkpointRuntime.api.saveNow();
        checkpointRaw = checkpointRuntime.api.savedRaw();
    } finally {
        checkpointRuntime.dom.window.close();
    }
    const resumedRuntime = createRuntime(seed >>> 0);
    let aiResumed;
    try {
        resumedRuntime.api.putSavedRaw(checkpointRaw);
        const loaded = resumedRuntime.api.loadNow();
        resumedRuntime.api.advance(17.5);
        const ledger = resumedRuntime.api.characterActionLedger();
        aiResumed = {
            loaded,
            ledger,
            scheduler: resumedRuntime.api.schedulerSnapshot(),
            equal: JSON.stringify(ledger) === JSON.stringify(aiUninterrupted.ledger),
            schedulerTaskEqual: JSON.stringify(resumedRuntime.api.schedulerSnapshot().tasks['character-actions'])
                === JSON.stringify(aiUninterrupted.scheduler.tasks['character-actions'])
        };
    } finally {
        resumedRuntime.dom.window.close();
    }

    const uiRuntime = createRuntime(seed >>> 0);
    let playerUi;
    try {
        uiRuntime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = uiRuntime.api.state();
        const playerState = story.states.find(row => Number(row.id) === Number(story.playerStateId));
        playerState.gov.leader = 'ai';
        story.commander.skills.warrior = 99;
        uiRuntime.api.institutionTick(5);
        const playerActorId = `character:${story.playerStateId}:${story.commander.id}`;
        const world = uiRuntime.api.worldV2();
        const targetWorld = world.characters.find(row => row.ownerId === 'country:0'
            && row.id !== playerActorId && row.regionId && row.role === 'COMMANDER')
            || world.characters.find(row => row.ownerId === 'country:0'
                && row.id !== playerActorId && row.regionId);
        const regionLegacyId = targetWorld ? Number(String(targetWorld.regionId).split(':').pop()) : NaN;
        const cityView = Number.isInteger(regionLegacyId)
            ? uiRuntime.api.cityDossierBuild(regionLegacyId) : null;
        const target = cityView && cityView.characters.find(row => row.id === targetWorld.id);
        if (!target) throw new Error('Faz 37 oyuncu UI probu için şehirde hedef karakter bulunamadı.');
        uiRuntime.api.renderCityDossier(regionLegacyId, 'karakterler');
        const opened = uiRuntime.api.cityDossierOpenCharacter(target.id);
        const before = uiRuntime.api.cityDossierUiState();
        const buttons = Array.from(uiRuntime.dom.window.document.querySelectorAll('[data-character-action]'));
        const persuadeButton = buttons.find(button => button.dataset.characterAction === 'PERSUADE');
        uiRuntime.dom.window.document.dispatchEvent(new uiRuntime.dom.window.Event('DOMContentLoaded'));
        if (persuadeButton) persuadeButton.click();
        const orderButton = Array.from(uiRuntime.dom.window.document.querySelectorAll('[data-character-action]'))
            .find(button => button.dataset.characterAction === 'ORDER');
        if (orderButton && !orderButton.disabled) orderButton.click();
        const after = uiRuntime.api.cityDossierUiState();
        const ledger = uiRuntime.api.characterActionLedger();
        const receipt = Object.values(ledger.receipts || {}).find(row => row.decisionSource === 'PLAYER_UI'
            && row.actionType === 'PERSUADE');
        const orderReceipt = Object.values(ledger.receipts || {}).find(row => row.decisionSource === 'PLAYER_UI'
            && row.actionType === 'ORDER');
        playerUi = {
            opened,
            focusCharacterId: before.talkFocusCharacterId,
            buttonCount: buttons.length,
            enabledButtonCount: buttons.filter(button => !button.disabled).length,
            receipt: receipt || null,
            orderButtonVisible: !!orderButton,
            orderReceipt: orderReceipt || null,
            orderQueued: !!(orderReceipt && orderReceipt.domainReceipt
                && orderReceipt.domainReceipt.outcomeModel === 'QUEUED_DOMAIN_DECISION'),
            cooldownVisible: /sonra yeniden kullanılabilir/.test(after.talkText),
            talkTextAfter: after.talkText,
            validation: uiRuntime.api.validateCharacterActionLedger(ledger)
        };
    } finally {
        uiRuntime.dom.window.close();
    }
    return { main, restored, sabotageResume, version2, version3, legacy, disabled, dependencyDisabled, aiUninterrupted, aiResumed, playerUi };
}

function probeContactDirectory(seed = 2032) {
    const agentRuntime = createRuntime(seed >>> 0);
    let agent;
    try {
        agentRuntime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = agentRuntime.api.state();
        story.commander.creationRole = 'AGENT';
        story.playerRole = 'AGENT';
        agentRuntime.api.characterBindPlayerRole();
        agentRuntime.api.characterIdentityReset();
        const firstView = agentRuntime.api.contactDirectoryBuild();
        const secondView = agentRuntime.api.contactDirectoryBuild();
        const world = agentRuntime.api.worldV2();
        const knowledge = agentRuntime.api.playerKnowledge(world, 'country:0');
        const foreignCharacters = knowledge.characters.filter(row => {
            const source = world.characters.find(candidate => candidate.id === row.id);
            return source && source.ownerId !== 'country:0';
        });
        story._talkOpen = true;
        story._talkView = 'contacts';
        agentRuntime.dom.window.document.dispatchEvent(new agentRuntime.dom.window.Event('DOMContentLoaded'));
        agentRuntime.api.talkBind();
        agentRuntime.api.talkUpdate();
        const body = agentRuntime.dom.window.document.getElementById('talk-body');
        const talkTabs = body ? body.querySelectorAll('[data-talk-view]') : [];
        const contactsOnlyAtOpen = !!(body && body.querySelector('.contact-directory'))
            && !body.querySelector('.dip-row');
        const operationButton = body && body.querySelector('[data-character-action="SABOTAGE"]');
        const capabilityBefore = Number(agentRuntime.api.characterIdentityView(firstView.playerActorId).career.capability) || 0;
        if (operationButton) operationButton.click();
        const sabotageReceipt = Object.values(agentRuntime.api.characterActionLedger().receipts || {})
            .find(row => row.actionType === 'SABOTAGE' && row.decisionSource === 'PLAYER_UI');
        const capabilityAfter = Number(agentRuntime.api.characterIdentityView(firstView.playerActorId).career.capability) || 0;
        const registryToggle = body && body.querySelector('[data-contact-registry-toggle]');
        if (registryToggle) registryToggle.click();
        const publicRowsAfterToggle = body
            ? body.querySelectorAll('.contact-directory-scroll .contact-directory-row').length : 0;
        const diplomacyButton = body && body.querySelector('[data-talk-view="diplomacy"]');
        if (diplomacyButton) diplomacyButton.click();
        const diplomacyOnlyAfterClick = !!(body && body.querySelector('.dip-row'))
            && !body.querySelector('.contact-directory');
        agent = {
            knowledgeValidation: agentRuntime.api.validatePlayerKnowledge(knowledge),
            knowledgeSchemaVersion: knowledge.schemaVersion,
            publicAssetCount: knowledge.infrastructureAssets.length,
            publicAssetSecretLeak: /damageBps|effectiveCapacity|\"capacity\"|\"access\"|\"enabled\"/
                .test(JSON.stringify(knowledge.infrastructureAssets)),
            isAgent: firstView.isAgent,
            contactCount: firstView.contacts.length,
            publicCharacterCount: firstView.publicCharacters.length,
            operationCount: firstView.operations.length,
            allOperationsUseLandPublicTopology: firstView.operations.every(row => row.mode === 'LAND'),
            foreignLocationLeakCount: firstView.diagnostics.foreignLocationLeakCount,
            operationSecretFieldCount: firstView.diagnostics.operationSecretFieldCount,
            foreignKnowledgeLocationsUnknown: foreignCharacters.every(row => row.regionId.status === 'UNKNOWN'
                && row.regionId.value === null),
            cacheStable: firstView === secondView,
            tabCount: talkTabs.length,
            contactsOnlyAtOpen,
            diplomacyOnlyAfterClick,
            operationButtonPresent: !!operationButton,
            sabotageReceipt: sabotageReceipt || null,
            capabilitySpent: capabilityBefore - capabilityAfter,
            registryTogglePresent: !!registryToggle,
            publicRowsAfterToggle,
            bodyContainsForeignRegionId: firstView.publicCharacters.filter(row => !row.own)
                .some(row => row.visibleRegionId != null),
            actionLedgerValidation: agentRuntime.api.validateCharacterActionLedger(
                agentRuntime.api.characterActionLedger()
            )
        };
    } finally {
        agentRuntime.dom.window.close();
    }

    const commanderRuntime = createRuntime(seed >>> 0);
    let commander;
    try {
        commanderRuntime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const view = commanderRuntime.api.contactDirectoryBuild();
        commander = {
            isAgent: view.isAgent,
            operationCount: view.operations.length,
            foreignLocationLeakCount: view.diagnostics.foreignLocationLeakCount
        };
    } finally {
        commanderRuntime.dom.window.close();
    }
    return { agent, commander };
}

function probeCharacterArbiterLiveCase(seed, mode) {
    const runtime = createRuntime(seed >>> 0);
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        runtime.api.characterArbiterSetLiveAdapter(request => {
            if (mode === 'LATE') return new Promise(() => {});
            const offered = request.context.candidates[Math.min(1, request.context.candidates.length - 1)];
            const pass = mode === 'PASS';
            return runtime.api.characterArbiterResolve(request, {
                schemaVersion: 2,
                requestId: request.requestId,
                verdict: pass ? 'PASS' : 'PROPOSE',
                choiceId: pass ? null : offered.choiceId,
                reasonCode: pass ? 'DEFER_FOR_INFORMATION' : 'RELATIONSHIP_PRESSURE',
                speechPlan: {
                    opening: 'RELATIONSHIP_CONTEXT_FIRST', tone: 'GUARDED',
                    address: 'ROLE_TITLE', emphasis: pass ? ['RISK'] : ['RELATIONSHIP', 'RECIPROCITY']
                }
            });
        });
        const first = runtime.api.characterActionTick(10);
        const pendingBefore = runtime.api.characterActionLedger().ai.pendingArbiter;
        if (mode === 'STALE' && pendingBefore) {
            runtime.api.characterMemoryAddRecent(pendingBefore.actorId, {
                id: `character-memory:arbiter-stale:${seed}`,
                kind: 'DECISION', summary: 'Hakem isteğinden sonra değişen kanonik bağlam',
                occurredAt: 1, importanceBps: 7400
            });
        }
        const second = runtime.api.characterActionTick(10);
        const ledger = runtime.api.characterActionLedger();
        const receipts = Object.values(ledger.receipts || {}).sort((a, b) => a.sequence - b.sequence);
        const receipt = receipts[receipts.length - 1] || null;
        const decisions = Object.values(ledger.arbiterDecisions || {}).sort((a, b) => a.sequence - b.sequence);
        const decision = decisions[decisions.length - 1] || null;
        return {
            firstStatus: first.selection && first.selection.status,
            secondStatus: second.selection && second.selection.status,
            pendingCreated: !!pendingBefore,
            pendingAdvancedByOneTick: !!pendingBefore
                && pendingBefore.consumeAtTick === pendingBefore.createdAtTick + 1,
            pendingAfter: !!ledger.ai.pendingArbiter,
            receiptSource: receipt && receipt.decisionSource,
            receiptMetadata: receipt && receipt.decisionMetadata,
            decisionCount: decisions.length,
            decision,
            recentDecisionCount: pendingBefore
                ? runtime.api.characterActionArbiterRecentDecisions(pendingBefore.actorId, 6).length : 0,
            validation: runtime.api.validateCharacterActionLedger(ledger),
            ai: ledger.ai
        };
    } finally {
        runtime.dom.window.close();
    }
}

function probeCharacterArbiterPendingRestore(seed) {
    const source = createRuntime(seed >>> 0);
    let raw;
    let pendingBefore;
    try {
        source.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        source.api.characterArbiterSetLiveAdapter(() => new Promise(() => {}));
        source.api.characterActionTick(10);
        pendingBefore = source.api.characterActionLedger().ai.pendingArbiter;
        source.api.saveNow();
        raw = source.api.savedRaw();
    } finally {
        source.dom.window.close();
    }
    const restored = createRuntime(seed >>> 0);
    try {
        restored.api.putSavedRaw(raw);
        const loaded = restored.api.loadNow();
        const before = restored.api.characterActionLedger();
        const tick = restored.api.characterActionTick(10);
        const after = restored.api.characterActionLedger();
        const receipts = Object.values(after.receipts || {}).sort((a, b) => a.sequence - b.sequence);
        const receipt = receipts[receipts.length - 1] || null;
        const decisions = Object.values(after.arbiterDecisions || {}).sort((a, b) => a.sequence - b.sequence);
        const decision = decisions[decisions.length - 1] || null;
        return {
            loaded,
            requestPreserved: !!pendingBefore && !!before.ai.pendingArbiter
                && pendingBefore.requestId === before.ai.pendingArbiter.requestId
                && pendingBefore.contextHash === before.ai.pendingArbiter.contextHash,
            restoredCount: before.ai.arbiterRestoredCount,
            consumedStatus: tick.selection && tick.selection.status,
            receiptSource: receipt && receipt.decisionSource,
            fallbackReason: receipt && receipt.decisionMetadata && receipt.decisionMetadata.fallbackReason,
            decisionStatus: decision && decision.status,
            decisionFallbackReason: decision && decision.fallbackReason,
            pendingAfter: !!after.ai.pendingArbiter,
            validation: restored.api.validateCharacterActionLedger(after)
        };
    } finally {
        restored.dom.window.close();
    }
}

function probeCharacterArbiterDecisionLedger(seed) {
    const source = createRuntime(seed >>> 0);
    let raw;
    let before;
    let beforeValidation;
    try {
        source.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const actorId = Object.keys(source.api.characterIdentityLedger().identities || {})[0];
        for (let index = 0; index < 520; index++) {
            source.api.characterActionArbiterDecisionRecord({
                requestId: `character-arbiter:cap:${index}`,
                contextHash: `fnv1a32:${index.toString(16).padStart(8, '0')}`,
                actorId, createdAt: index, createdAtTick: index, consumeAtTick: index + 1
            }, {
                source: 'DETERMINISTIC_FALLBACK', status: 'FALLBACK', verdict: 'PASS',
                fallbackReason: 'CAP_FIXTURE'
            });
        }
        before = source.api.characterActionLedger();
        beforeValidation = source.api.validateCharacterActionLedger(before);
        source.api.saveNow();
        raw = source.api.savedRaw();
    } finally {
        source.dom.window.close();
    }
    const restored = createRuntime(seed >>> 0);
    try {
        restored.api.putSavedRaw(raw);
        const loaded = restored.api.loadNow();
        const after = restored.api.characterActionLedger();
        return {
            loaded,
            count: Object.keys(before.arbiterDecisions || {}).length,
            prunedCount: before.ai.arbiterDecisionPrunedCount,
            oldestSequence: Math.min(...Object.values(before.arbiterDecisions || {}).map(row => row.sequence)),
            newestSequence: Math.max(...Object.values(before.arbiterDecisions || {}).map(row => row.sequence)),
            validation: beforeValidation,
            restoredValidation: restored.api.validateCharacterActionLedger(after),
            restoredEqual: JSON.stringify(before.arbiterDecisions) === JSON.stringify(after.arbiterDecisions)
                && before.nextArbiterDecisionSequence === after.nextArbiterDecisionSequence
                && before.ai.arbiterDecisionPrunedCount === after.ai.arbiterDecisionPrunedCount
        };
    } finally {
        restored.dom.window.close();
    }
}

function probeCharacterSpeechScenario(seed) {
    const runtime = createRuntime(seed >>> 0);
    let raw;
    let result;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = runtime.api.state();
        const identities = Object.values(runtime.api.characterIdentityLedger().identities || {})
            .sort((a, b) => a.id.localeCompare(b.id, 'en'));
        const playerActorId = story.commander ? `character:0:${story.commander.id}` : null;
        const actor = identities.find(row => row.id !== playerActorId);
        const privateTarget = identities.find(row => row.id !== playerActorId && row.id !== (actor && actor.id));
        const directed = [];
        for (let index = 0; index < 8; index++) {
            directed.push(runtime.api.characterActionArbiterDecisionRecord({
                requestId: `character-arbiter:speech:${index}`,
                contextHash: `fnv1a32:${(index + 1).toString(16).padStart(8, '0')}`,
                actorId: actor.id, createdAt: index, createdAtTick: index,
                consumeAtTick: index + 1
            }, {
                source: 'LOCAL_LLM_VALIDATED', status: 'ACCEPTED', verdict: 'PROPOSE',
                candidateId: `speech-fixture:${index}`, actionType: 'PERSUADE',
                targetActorId: playerActorId, reasonCode: 'GOAL_ALIGNMENT',
                speechPlan: {
                    opening: 'STATE_POSITION_FIRST', tone: 'MEASURED',
                    address: 'FORMAL_TITLE', emphasis: ['GOAL', 'RISK']
                }
            }));
        }
        const privateDecision = runtime.api.characterActionArbiterDecisionRecord({
            requestId: 'character-arbiter:speech:private', contextHash: 'fnv1a32:ffffffff',
            actorId: actor.id, createdAt: 9, createdAtTick: 9, consumeAtTick: 10
        }, {
            source: 'LOCAL_LLM_VALIDATED', status: 'ACCEPTED', verdict: 'PROPOSE',
            candidateId: 'speech-fixture:private', actionType: 'NEGOTIATE',
            targetActorId: privateTarget.id, reasonCode: 'RELATIONSHIP_PRESSURE',
            speechPlan: {
                opening: 'RELATIONSHIP_CONTEXT_FIRST', tone: 'GUARDED',
                address: 'ROLE_TITLE', emphasis: ['RELATIONSHIP', 'RECIPROCITY']
            }
        });
        const realizations = directed.map(row => row.realization);
        const normalized = realizations.map(row => row && row.normalizedText);
        const addressModes = realizations.map(row => row && row.addressMode);
        const noRecentExactRepeat = normalized.every((text, index) =>
            !normalized.slice(Math.max(0, index - 6), index).includes(text));
        const noThirdAddressRepeat = addressModes.every((mode, index) => index < 2
            || !(addressModes[index - 1] === mode && addressModes[index - 2] === mode));
        const inbox = runtime.api.characterSpeechPlayerInbox(12);
        story._talkOpen = true;
        runtime.api.talkUpdate();
        const talkBody = runtime.dom.window.document.getElementById('talk-body');
        const bodyText = talkBody ? talkBody.textContent : '';
        runtime.api.saveNow();
        raw = runtime.api.savedRaw();
        result = {
            actorId: actor.id,
            playerActorId,
            directed,
            privateDecision,
            realizations,
            noRecentExactRepeat,
            noThirdAddressRepeat,
            allValidated: realizations.every(row => runtime.api.characterSpeechValidateRealization(row).ok)
                && runtime.api.characterSpeechValidateRealization(privateDecision.realization).ok,
            constrainedSourceOnly: realizations.every(row => row.source === 'DETERMINISTIC_CONSTRAINED_REALIZER'),
            noInternalFactLeak: realizations.every(row => !/character:|country:|fnv1a32|damageBps|\d/i.test(row.text)),
            inboxCount: inbox.length,
            inboxOnlyPlayerTargeted: inbox.every(row => directed.some(decision => decision.id === row.decisionId)),
            privateDecisionHidden: !inbox.some(row => row.decisionId === privateDecision.id),
            uiSectionVisible: bodyText.includes('SANA SÖYLENENLER'),
            uiContainsDirectedSpeech: directed.slice(-6).every(row => bodyText.includes(row.realization.text)),
            uiHidesPrivateSpeech: !bodyText.includes(privateDecision.realization.text),
            ledgerValidation: runtime.api.validateCharacterActionLedger(runtime.api.characterActionLedger())
        };
    } finally {
        runtime.dom.window.close();
    }
    return { result, raw };
}

function probeCharacterSpeech(seed = 2032) {
    const first = probeCharacterSpeechScenario(seed >>> 0);
    const repeat = probeCharacterSpeechScenario(seed >>> 0);
    const restored = createRuntime(seed >>> 0);
    let restoredResult;
    try {
        restored.api.putSavedRaw(first.raw);
        const loaded = restored.api.loadNow();
        const ledger = restored.api.characterActionLedger();
        const decisions = Object.values(ledger.arbiterDecisions || {})
            .sort((a, b) => Number(a.sequence) - Number(b.sequence));
        restoredResult = {
            loaded,
            validation: restored.api.validateCharacterActionLedger(ledger),
            realizationCount: decisions.filter(row => row.realization).length,
            exact: JSON.stringify(decisions.map(row => row.realization))
                === JSON.stringify(first.result.directed.concat(first.result.privateDecision).map(row => row.realization))
        };
    } finally {
        restored.dom.window.close();
    }
    return Object.assign({}, first.result, {
        deterministic: JSON.stringify(first.result.realizations)
            === JSON.stringify(repeat.result.realizations),
        restored: restoredResult
    });
}

function probeCharacterLongDialogue(seed = 2032) {
    const run = () => {
        const runtime = createRuntime(seed >>> 0);
        try {
            runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
            const story = runtime.api.state();
            const playerActorId = story.commander ? `character:0:${story.commander.id}` : null;
            const identities = Object.values(runtime.api.characterIdentityLedger().identities || {})
                .filter(row => row.id !== playerActorId)
                .sort((a, b) => a.id.localeCompare(b.id, 'en'));
            const chosen = [];
            const seenVoices = new Set();
            for (const actor of identities) {
                const sample = runtime.api.characterDialogueRealize({
                    turnId: `voice-sample:${actor.id}`, actorId: actor.id,
                    targetActorId: playerActorId, speechAct: 'ASK_INFORMATION'
                }, { history: [] });
                if (sample && !seenVoices.has(sample.voiceFingerprint)) {
                    seenVoices.add(sample.voiceFingerprint);
                    chosen.push(actor);
                }
                if (chosen.length === 3) break;
            }
            const actors = chosen.length >= 3 ? chosen : identities.slice(0, 3);
            const actorRuns = actors.map(actor => {
                const history = [];
                for (let index = 0; index < 24; index++) {
                    const intents = ['PROPOSE_COMMERCIAL_DEAL', 'COUNTER_OFFER', 'ASK_INFORMATION', 'DEFER'];
                    const row = runtime.api.characterDialogueRealize({
                        turnId: `long:${actor.id}:${index}`,
                        actorId: actor.id,
                        targetActorId: playerActorId,
                        speechAct: intents[index % intents.length],
                        addressMode: 'FORMAL_TITLE'
                    }, { history });
                    history.push(row);
                }
                return { actorId: actor.id, history };
            });
            const rows = actorRuns.flatMap(runRow => runRow.history);
            const exactRepeatFree = actorRuns.every(runRow => runRow.history.every((row, index, list) =>
                !list.slice(Math.max(0, index - 12), index).some(previous => previous.normalizedText === row.normalizedText)));
            const addressSpamFree = actorRuns.every(runRow => runRow.history.every((row, index, list) => index < 2
                || !(list[index - 1].addressMode === row.addressMode
                    && list[index - 2].addressMode === row.addressMode)));
            const similarityBounded = rows.every(row => row.maxRecentSimilarityBps <= 7200);
            const semanticSimilarityBounded = rows.every(row => row.maxRecentSemanticSimilarityBps <= 8600);
            const fingerprints = actorRuns.map(runRow => runRow.history[0].voiceFingerprint);
            const openingVocabulary = actorRuns.map(runRow => Array.from(new Set(runRow.history.map(row => row.register))));
            return {
                actorCount: actorRuns.length,
                turnCount: rows.length,
                allValidated: rows.every(row => runtime.api.characterDialogueValidate(row).ok),
                exactRepeatFree,
                addressSpamFree,
                similarityBounded,
                semanticSimilarityBounded,
                distinctVoiceFingerprints: new Set(fingerprints).size,
                fingerprints,
                openingVocabulary,
                worldNeutral: rows.every(row => row.worldMutation === false),
                constrainedSourceOnly: rows.every(row => row.source === 'DETERMINISTIC_LONG_DIALOGUE_REALIZER'),
                noInternalFactLeak: rows.every(row => !/character:|country:|fnv1a32|damageBps/i.test(row.text)),
                rows
            };
        } finally {
            runtime.dom.window.close();
        }
    };
    const first = run();
    const second = run();
    return Object.assign({}, first, {
        deterministic: JSON.stringify(first.rows) === JSON.stringify(second.rows)
    });
}

function probeDialogueScenarioLab(seed = 2032) {
    const openingText = 'Limana gelen tahıl sevkiyatının yarısını başkente gönderelim. Fiyatlar böyle giderse sokaklar karışacak.';
    const base = {
        scenarioId: 'grain-scarcity-redirect', playerText: openingText,
        proposalKind: 'COMPENSATED_REDIRECT', playerShipmentReference: 'KNOWN',
        listenerShipmentBelief: 'VERIFIED', listenerAuthority: 'REDIRECT_AUTHORITY',
        shipmentTruth: 'ACTIVE', listenerPosture: 'INSTITUTIONALIST'
    };
    const specs = [
        ['unknown-reference', { playerShipmentReference: 'UNKNOWN' }, 'ASK_SHIPMENT_REFERENCE', 'SHIPMENT_REFERENCE_REQUIRED'],
        ['listener-does-not-know', { listenerShipmentBelief: 'NONE' }, 'ASK_EVIDENCE', 'LISTENER_EVIDENCE_REQUIRED'],
        ['listener-lacks-authority', { listenerAuthority: 'NO_REDIRECT_AUTHORITY' }, 'REFER_AUTHORIZED_OFFICE', 'LISTENER_LACKS_AUTHORITY'],
        ['compensated-active', {}, 'CONDITIONAL_REDIRECT_OFFER', 'NEGOTIATION_ONLY'],
        ['believed-but-missing', { shipmentTruth: 'MISSING' }, 'CONDITIONAL_REDIRECT_OFFER', 'SHIPMENT_NOT_ACTIVE'],
        ['pressure-authoritarian', { proposalKind: 'POLITICAL_PRESSURE', listenerPosture: 'AUTHORITARIAN' }, 'COMPLY_WITH_RELATION_COST', 'NEGOTIATION_ONLY'],
        ['pressure-institutional', { proposalKind: 'POLITICAL_PRESSURE', listenerPosture: 'INSTITUTIONALIST' }, 'REQUEST_WRITTEN_EMERGENCY_AUTHORITY', 'NEGOTIATION_ONLY'],
        ['pressure-army', { proposalKind: 'POLITICAL_PRESSURE', listenerPosture: 'ARMY_ALIGNED' }, 'REJECT_AND_REFER_DEFENSE_COUNCIL', 'NEGOTIATION_ONLY'],
        ['offbook-opportunist', { proposalKind: 'OFFBOOK_SALE', listenerPosture: 'OPPORTUNIST' }, 'CORRUPTION_COUNTERPARTY_CANDIDATE', 'OFFBOOK_EXECUTION_FORBIDDEN'],
        ['offbook-principled', { proposalKind: 'OFFBOOK_SALE', listenerPosture: 'PRINCIPLED' }, 'REJECT_OFFBOOK_PROPOSAL', 'OFFBOOK_EXECUTION_FORBIDDEN']
    ];
    const rows = specs.map(([caseId, patch, expectedResponse, expectedGate]) => {
        const input = Object.assign({}, base, patch, { caseId });
        const first = dialogueScenarioLab.evaluateGrainScarcityScenario(input);
        const second = dialogueScenarioLab.evaluateGrainScarcityScenario(input);
        return {
            caseId, input, result: first, expectedResponse, expectedGate,
            deterministic: JSON.stringify(first) === JSON.stringify(second),
            validation: dialogueScenarioLab.grainResultValidate(first)
        };
    });
    const invalid = dialogueScenarioLab.evaluateGrainScarcityScenario(Object.assign({}, base, {
        caseId: 'invalid-field', hiddenWorldOverride: true
    }));
    const strikeOpeningText = 'Grevi bitirin. Üretim durdukça sınırdaki birlikler zırh plakası alamıyor. Ücretleri üç ay sonra yeniden konuşuruz.';
    const strikeBase = {
        scenarioId: 'steel-strike-bargain', playerText: strikeOpeningText,
        proposalKind: 'STAGED_WAGE', playerStrikeReference: 'KNOWN',
        listenerStrikeBelief: 'VERIFIED', listenerAuthority: 'UNION_MANDATE',
        strikeTruth: 'ACTIVE', companyLiquidity: 'SUFFICIENT', inflationWageGap: 'HIGH',
        strikeSupport: 'STRONG', productionUrgency: 'CRITICAL', safetyEvidence: 'VERIFIED',
        listenerPosture: 'PRINCIPLED'
    };
    const strikeSpecs = [
        ['unknown-strike', { playerStrikeReference: 'UNKNOWN' }, 'ASK_STRIKE_REFERENCE', 'STRIKE_REFERENCE_REQUIRED'],
        ['leader-does-not-know', { listenerStrikeBelief: 'NONE' }, 'ASK_STRIKE_EVIDENCE', 'LISTENER_EVIDENCE_REQUIRED'],
        ['leader-lacks-mandate', { listenerAuthority: 'NO_UNION_MANDATE' }, 'REFER_AUTHORIZED_UNION_BODY', 'LISTENER_LACKS_UNION_MANDATE'],
        ['finances-unknown', { companyLiquidity: 'UNKNOWN' }, 'ASK_AUDITED_COMPANY_FINANCES', 'COMPANY_LIQUIDITY_NOT_VERIFIED'],
        ['safety-unverified', { safetyEvidence: 'UNVERIFIED' }, 'COUNTER_WITH_JOINT_SAFETY_AUDIT', 'SAFETY_AUDIT_REQUIRED'],
        ['staged-ready', {}, 'SUBMIT_STRIKE_SUSPENSION_TO_MEMBERS', 'MEMBER_VOTE_REQUIRED'],
        ['believed-but-resolved', { strikeTruth: 'RESOLVED' }, 'SUBMIT_STRIKE_SUSPENSION_TO_MEMBERS', 'STRIKE_NOT_ACTIVE'],
        ['threat-fearful', { proposalKind: 'THREAT', listenerPosture: 'FEARFUL', strikeSupport: 'WEAK' }, 'RETREAT_WITH_RADICALIZATION_RISK', 'COERCIVE_ACTION_FORBIDDEN'],
        ['threat-principled', { proposalKind: 'THREAT', listenerPosture: 'PRINCIPLED' }, 'REJECT_AND_ESCALATE_STRIKE', 'COERCIVE_ACTION_FORBIDDEN'],
        ['threat-opportunist', { proposalKind: 'THREAT', listenerPosture: 'OPPORTUNIST' }, 'SEEK_PERSONAL_IMMUNITY', 'COERCIVE_ACTION_FORBIDDEN'],
        ['divide-opportunist', { proposalKind: 'DIVIDE_WORKFORCE', listenerPosture: 'OPPORTUNIST' }, 'ACCEPT_SELECTIVE_BONUS_CHANNEL', 'DISCRIMINATION_REVIEW_REQUIRED'],
        ['divide-principled', { proposalKind: 'DIVIDE_WORKFORCE', listenerPosture: 'PRINCIPLED' }, 'WARN_DISCRIMINATION_ESCALATION', 'DISCRIMINATION_REVIEW_REQUIRED']
    ];
    const strikeRows = strikeSpecs.map(([caseId, patch, expectedResponse, expectedGate]) => {
        const input = Object.assign({}, strikeBase, patch, { caseId });
        const first = dialogueScenarioLab.evaluateSteelStrikeScenario(input);
        const second = dialogueScenarioLab.evaluateSteelStrikeScenario(input);
        return {
            caseId, input, result: first, expectedResponse, expectedGate,
            deterministic: JSON.stringify(first) === JSON.stringify(second),
            validation: dialogueScenarioLab.strikeResultValidate(first)
        };
    });
    const invalidStrike = dialogueScenarioLab.evaluateSteelStrikeScenario(Object.assign({}, strikeBase, {
        caseId: 'invalid-wage-model', wageModelActive: true
    }));
    const tenderOpeningText = 'Dosyayı önce bana ver. Soruşturmayı ben başlatayım; yayımlarsan ordu tedariki çöker.';
    const tenderBase = {
        scenarioId: 'arms-tender-leak', playerText: tenderOpeningText,
        proposalKind: 'INDEPENDENT_INQUIRY', playerCaseReference: 'KNOWN',
        journalistEvidenceBelief: 'VERIFIED', sourceCustody: 'HAS_COPY',
        evidenceTruth: 'AUTHENTIC', procurementTruth: 'CORRUPT',
        playerInvestigationAuthority: 'AUTHORIZED', journalistPosture: 'PRINCIPLED',
        sourceConfidence: 'HIGH', playerPressHistory: 'PROTECTIVE', publicationRisk: 'NORMAL'
    };
    const tenderSpecs = [
        ['unknown-case', { playerCaseReference: 'UNKNOWN' }, 'ASK_CASE_REFERENCE', 'CASE_REFERENCE_REQUIRED'],
        ['journalist-no-evidence', { journalistEvidenceBelief: 'NONE' }, 'ASK_DOCUMENTED_EVIDENCE', 'SOURCE_EVIDENCE_REQUIRED'],
        ['copy-not-held', { sourceCustody: 'NO_COPY' }, 'REFER_SOURCE_CUSTODIAN', 'SOURCE_EVIDENCE_REQUIRED'],
        ['authority-missing', { playerInvestigationAuthority: 'UNAUTHORIZED' }, 'DEMAND_INDEPENDENT_AUTHORITY', 'INVESTIGATION_AUTHORITY_REQUIRED'],
        ['partial-evidence', { journalistEvidenceBelief: 'PARTIAL', sourceConfidence: 'LOW' }, 'SHARE_REDACTED_COPY_FOR_VERIFICATION', 'MEDIA_PUBLICATION_ADAPTER_MISSING'],
        ['inquiry-authentic', {}, 'ACCEPT_48H_CONDITIONAL_HOLD', 'MEDIA_PUBLICATION_ADAPTER_MISSING'],
        ['believed-authentic-tampered', { evidenceTruth: 'TAMPERED', procurementTruth: 'MIXED' }, 'ACCEPT_48H_CONDITIONAL_HOLD', 'EVIDENCE_INTEGRITY_REVIEW_REQUIRED'],
        ['believed-authentic-fabricated', { evidenceTruth: 'FABRICATED', procurementTruth: 'CLEAN' }, 'ACCEPT_48H_CONDITIONAL_HOLD', 'EVIDENCE_FALSE'],
        ['bribe-principled', { proposalKind: 'BRIBE' }, 'REJECT_AND_RECORD_BRIBE_OFFER', 'CORRUPTION_ACTION_FORBIDDEN'],
        ['bribe-opportunist', { proposalKind: 'BRIBE', journalistPosture: 'OPPORTUNIST' }, 'BRIBE_OR_STING_CANDIDATE', 'CORRUPTION_ACTION_FORBIDDEN'],
        ['threat-principled', { proposalKind: 'SECURITY_THREAT', playerPressHistory: 'HOSTILE' }, 'DISTRIBUTE_DOCUMENTS_AND_PUBLISH', 'COERCIVE_ACTION_FORBIDDEN'],
        ['threat-cautious', { proposalKind: 'SECURITY_THREAT', journalistPosture: 'CAUTIOUS', publicationRisk: 'HIGH' }, 'SEEK_COUNSEL_WITHOUT_SURRENDERING_COPY', 'COERCIVE_ACTION_FORBIDDEN'],
        ['threat-opportunist', { proposalKind: 'SECURITY_THREAT', journalistPosture: 'OPPORTUNIST' }, 'LEVERAGE_THREAT_FOR_PROTECTION', 'COERCIVE_ACTION_FORBIDDEN']
    ];
    const tenderRows = tenderSpecs.map(([caseId, patch, expectedResponse, expectedGate]) => {
        const input = Object.assign({}, tenderBase, patch, { caseId });
        const first = dialogueScenarioLab.evaluateArmsTenderScenario(input);
        const second = dialogueScenarioLab.evaluateArmsTenderScenario(input);
        return {
            caseId, input, result: first, expectedResponse, expectedGate,
            deterministic: JSON.stringify(first) === JSON.stringify(second),
            validation: dialogueScenarioLab.tenderResultValidate(first)
        };
    });
    const invalidTender = dialogueScenarioLab.evaluateArmsTenderScenario(Object.assign({}, tenderBase, {
        caseId: 'invented-journalist', namedJournalistAvailable: true
    }));
    const mobilizationOpeningText = 'Karşı taraf saldırıya hazırlanıyor. İki tümeni sınıra gönderelim ve köprüleri mayınlayalım.';
    const mobilizationBase = {
        scenarioId: 'border-mobilization', playerText: mobilizationOpeningText,
        proposalKind: 'LIMITED_PREPARATION', playerReportReference: 'KNOWN',
        listenerReportBelief: 'VERIFIED', reportTruth: 'INVASION_PREP', sourceConfidence: 'HIGH',
        mobilizationAuthority: 'AUTHORIZED', treatyStatus: 'PEACE', falseAlarmHistory: 'CLEAN',
        listenerPosture: 'INSTITUTIONALIST', readinessCost: 'AFFORDABLE', escalationVisibility: 'COVERT'
    };
    const mobilizationSpecs = [
        ['unknown-report', { playerReportReference: 'UNKNOWN' }, 'ASK_REPORT_REFERENCE', 'REPORT_REFERENCE_REQUIRED'],
        ['listener-no-report', { listenerReportBelief: 'NONE' }, 'ASK_INTELLIGENCE_SOURCE', 'LISTENER_REPORT_REQUIRED'],
        ['authority-missing', { mobilizationAuthority: 'UNAUTHORIZED' }, 'REFER_WAR_CABINET', 'MOBILIZATION_AUTHORITY_REQUIRED'],
        ['low-confidence', { sourceConfidence: 'LOW' }, 'EXPAND_RECON_BEFORE_MOVEMENT', 'CORROBORATION_REQUIRED'],
        ['repeated-false-alarm', { falseAlarmHistory: 'REPEATED' }, 'EXPAND_RECON_BEFORE_MOVEMENT', 'MOBILIZATION_ADAPTER_MISSING'],
        ['readiness-strained', { readinessCost: 'STRAINED' }, 'OFFER_REDUCED_COVERT_PREPARATION', 'MOBILIZATION_ADAPTER_MISSING'],
        ['limited-ready', {}, 'SUPPORT_LIMITED_COVERT_PREPARATION', 'MOBILIZATION_ADAPTER_MISSING'],
        ['believed-invasion-exercise', { reportTruth: 'EXERCISE' }, 'SUPPORT_LIMITED_COVERT_PREPARATION', 'HOSTILE_INTENT_NOT_CONFIRMED'],
        ['believed-invasion-deception', { reportTruth: 'DECEPTION' }, 'SUPPORT_LIMITED_COVERT_PREPARATION', 'DECEPTION_REVIEW_REQUIRED'],
        ['ultimatum-treaty', { proposalKind: 'ULTIMATUM', treatyStatus: 'NON_AGGRESSION' }, 'WARN_TREATY_AND_ESCALATION_COST', 'TREATY_COMPATIBILITY_REVIEW_REQUIRED'],
        ['ultimatum-low-confidence', { proposalKind: 'ULTIMATUM', sourceConfidence: 'MEDIUM' }, 'REJECT_ULTIMATUM_WITHOUT_CORROBORATION', 'CORROBORATION_REQUIRED'],
        ['ultimatum-ready', { proposalKind: 'ULTIMATUM' }, 'REFER_ULTIMATUM_TO_EXECUTIVE_AUTHORITY', 'DIPLOMATIC_ESCALATION_ADAPTER_MISSING'],
        ['proof-careerist', { proposalKind: 'DEMAND_PROOF', listenerPosture: 'CAREERIST' }, 'REPORT_INFLATION_RISK', 'STRATEGIC_REPORT_ADAPTER_MISSING'],
        ['proof-honest', { proposalKind: 'DEMAND_PROOF', listenerPosture: 'HONEST' }, 'STATE_INTENT_NOT_PROVEN', 'STRATEGIC_REPORT_ADAPTER_MISSING'],
        ['proof-institutionalist', { proposalKind: 'DEMAND_PROOF' }, 'REQUEST_MORE_TIME_AND_SOURCES', 'STRATEGIC_REPORT_ADAPTER_MISSING']
    ];
    const mobilizationRows = mobilizationSpecs.map(([caseId, patch, expectedResponse, expectedGate]) => {
        const input = Object.assign({}, mobilizationBase, patch, { caseId });
        const first = dialogueScenarioLab.evaluateBorderMobilizationScenario(input);
        const second = dialogueScenarioLab.evaluateBorderMobilizationScenario(input);
        return {
            caseId, input, result: first, expectedResponse, expectedGate,
            deterministic: JSON.stringify(first) === JSON.stringify(second),
            validation: dialogueScenarioLab.mobilizationResultValidate(first)
        };
    });
    const invalidMobilization = dialogueScenarioLab.evaluateBorderMobilizationScenario(
        Object.assign({}, mobilizationBase, { caseId: 'invented-doctrine', mobilizationDoctrineActive: true })
    );
    const sanctionsOpeningText = 'Elektronik ambargosunu paravan şirket ve üçüncü limanda tıbbi cihaz etiketiyle aşalım; ödemeyi enerji ihracatından mahsup edelim.';
    const sanctionsBase = {
        scenarioId: 'sanctions-shell-company', playerText: sanctionsOpeningText,
        proposalKind: 'SMALL_TRIAL', playerSanctionReference: 'KNOWN',
        listenerSanctionBelief: 'VERIFIED', sanctionTruth: 'ACTIVE', goodsClassification: 'CIVILIAN',
        intermediaryCapacity: 'VERIFIED', intermediaryReliability: 'HIGH', portInspection: 'MODERATE',
        paymentChannel: 'ESCROW', playerAuthority: 'AUTHORIZED', intermediaryPosture: 'CAUTIOUS',
        exemptionPath: 'AVAILABLE'
    };
    const sanctionsSpecs = [
        ['unknown-sanction', { playerSanctionReference: 'UNKNOWN' }, 'ASK_SANCTION_REFERENCE', 'SANCTION_REFERENCE_REQUIRED'],
        ['listener-no-belief', { listenerSanctionBelief: 'NONE' }, 'ASK_SANCTION_EVIDENCE', 'LISTENER_SANCTION_EVIDENCE_REQUIRED'],
        ['authority-missing', { playerAuthority: 'UNAUTHORIZED' }, 'REFER_AUTHORIZED_TRADE_OFFICE', 'TRADE_AUTHORITY_REQUIRED'],
        ['capacity-unverified', { intermediaryCapacity: 'UNVERIFIED' }, 'ASK_INTERMEDIARY_CAPACITY_PROOF', 'SANCTIONS_REGIME_ADAPTER_MISSING'],
        ['capacity-insufficient', { intermediaryCapacity: 'INSUFFICIENT' }, 'DECLINE_INSUFFICIENT_CAPACITY', 'SANCTIONS_REGIME_ADAPTER_MISSING'],
        ['reliability-low', { intermediaryReliability: 'LOW' }, 'DEMAND_HIGHER_ESCROW_OR_REFUSE', 'SANCTIONS_REGIME_ADAPTER_MISSING'],
        ['trial-escrow', {}, 'COUNTER_WITH_HALF_ESCROW', 'SANCTIONS_REGIME_ADAPTER_MISSING'],
        ['believed-active-expired', { sanctionTruth: 'EXPIRED' }, 'COUNTER_WITH_HALF_ESCROW', 'SANCTION_NOT_ACTIVE'],
        ['dual-use', { goodsClassification: 'DUAL_USE' }, 'COUNTER_WITH_HALF_ESCROW', 'DUAL_USE_CLASSIFICATION_REVIEW_REQUIRED'],
        ['opaque-payment', { paymentChannel: 'OPAQUE' }, 'COUNTER_WITH_HALF_ESCROW', 'PAYMENT_CHANNEL_NOT_AUDITABLE'],
        ['energy-offset', { paymentChannel: 'ENERGY_OFFSET' }, 'COUNTER_WITH_HALF_ESCROW', 'BARTER_SETTLEMENT_ADAPTER_MISSING'],
        ['threat-cautious', { proposalKind: 'THREAT' }, 'RECORD_AND_SEEK_PROTECTION', 'COERCIVE_ACTION_FORBIDDEN'],
        ['threat-opportunist', { proposalKind: 'THREAT', intermediaryPosture: 'OPPORTUNIST' }, 'LOWER_PRICE_OR_SELL_INFORMATION', 'COERCIVE_ACTION_FORBIDDEN'],
        ['threat-principled', { proposalKind: 'THREAT', intermediaryPosture: 'PRINCIPLED' }, 'TERMINATE_AND_REPORT', 'COERCIVE_ACTION_FORBIDDEN'],
        ['exemption-unknown', { proposalKind: 'LEGAL_EXEMPTION', exemptionPath: 'UNKNOWN' }, 'REQUEST_FORMAL_CLASSIFICATION', 'LEGAL_EXEMPTION_PATH_UNAVAILABLE'],
        ['exemption-unavailable', { proposalKind: 'LEGAL_EXEMPTION', exemptionPath: 'UNAVAILABLE' }, 'EXPLAIN_NO_EXEMPTION_PATH', 'LEGAL_EXEMPTION_PATH_UNAVAILABLE'],
        ['exemption-available', { proposalKind: 'LEGAL_EXEMPTION' }, 'ACCEPT_CIVILIAN_INSPECTION_PATH', 'LEGAL_EXEMPTION_ADAPTER_MISSING'],
        ['military-goods', { proposalKind: 'LEGAL_EXEMPTION', goodsClassification: 'MILITARY' }, 'ACCEPT_CIVILIAN_INSPECTION_PATH', 'MILITARY_EXPORT_PROHIBITED']
    ];
    const sanctionsRows = sanctionsSpecs.map(([caseId, patch, expectedResponse, expectedGate]) => {
        const input = Object.assign({}, sanctionsBase, patch, { caseId });
        const first = dialogueScenarioLab.evaluateSanctionsShellCompanyScenario(input);
        const second = dialogueScenarioLab.evaluateSanctionsShellCompanyScenario(input);
        return {
            caseId, input, result: first, expectedResponse, expectedGate,
            deterministic: JSON.stringify(first) === JSON.stringify(second),
            validation: dialogueScenarioLab.sanctionsResultValidate(first)
        };
    });
    const invalidSanctions = dialogueScenarioLab.evaluateSanctionsShellCompanyScenario(
        Object.assign({}, sanctionsBase, { caseId: 'invented-regime', sanctionsRegimeActive: true })
    );
    const refugeeOpeningText = 'Sınırdaki mülteci akışını başkent yerine doğudaki boş bölgeye gönüllü olarak yerleştirelim.';
    const refugeeBase = {
        scenarioId: 'refugee-border-bargain', playerText: refugeeOpeningText,
        proposalKind: 'FUNDED_SETTLEMENT', playerFlowReference: 'KNOWN',
        listenerFlowBelief: 'VERIFIED', flowTruth: 'BLOCKED', peopleCount: 'VERIFIED',
        destinationCapacity: 'SUFFICIENT', jobsCapacity: 'SUFFICIENT', foodSecurity: 'SAFE',
        localAttitude: 'SUPPORTIVE', aidFunding: 'FUNDED', playerAuthority: 'AUTHORIZED',
        voluntariness: 'VOLUNTARY', listenerPosture: 'INSTITUTIONALIST', neighborReliability: 'HIGH'
    };
    const refugeeSpecs = [
        ['unknown-flow', { playerFlowReference: 'UNKNOWN' }, 'ASK_REFUGEE_FLOW_REFERENCE', 'REFUGEE_FLOW_REFERENCE_REQUIRED'],
        ['listener-no-flow', { listenerFlowBelief: 'NONE' }, 'ASK_REFUGEE_FLOW_EVIDENCE', 'LISTENER_FLOW_EVIDENCE_REQUIRED'],
        ['authority-missing', { playerAuthority: 'UNAUTHORIZED' }, 'REFER_AUTHORIZED_BORDER_OFFICE', 'BORDER_AUTHORITY_REQUIRED'],
        ['count-unverified', { peopleCount: 'UNVERIFIED' }, 'ASK_VERIFIED_COHORT_COUNT', 'COHORT_COUNT_VERIFICATION_REQUIRED'],
        ['capacity-unknown', { destinationCapacity: 'UNKNOWN' }, 'ASK_DESTINATION_CAPACITY_AUDIT', 'RECEPTION_CAPACITY_NOT_VERIFIED'],
        ['capacity-insufficient', { destinationCapacity: 'INSUFFICIENT' }, 'PROPOSE_ALTERNATIVE_REGIONS', 'RECEPTION_CAPACITY_NOT_VERIFIED'],
        ['jobs-unknown', { jobsCapacity: 'UNKNOWN' }, 'ASK_DESTINATION_CAPACITY_AUDIT', 'EMPLOYMENT_CAPACITY_NOT_VERIFIED'],
        ['aid-promised', { aidFunding: 'PROMISED' }, 'DEMAND_FUNDS_BEFORE_ACCEPTANCE', 'AID_FUNDING_NOT_SETTLED'],
        ['local-hostile', { localAttitude: 'HOSTILE' }, 'COUNTER_WITH_LOCAL_SERVICES_AND_PHASES', 'HUMAN_MIGRATION_COMMAND_ADAPTER_MISSING'],
        ['food-strained', { foodSecurity: 'STRAINED' }, 'COUNTER_WITH_LOCAL_SERVICES_AND_PHASES', 'HUMAN_MIGRATION_COMMAND_ADAPTER_MISSING'],
        ['funded-ready', {}, 'CONDITIONAL_VOLUNTARY_SETTLEMENT', 'HUMAN_MIGRATION_COMMAND_ADAPTER_MISSING'],
        ['believed-blocked-completed', { flowTruth: 'COMPLETED' }, 'CONDITIONAL_VOLUNTARY_SETTLEMENT', 'REFUGEE_FLOW_NOT_ACTIONABLE'],
        ['forced-settlement', { voluntariness: 'FORCED' }, 'REJECT_FORCED_SETTLEMENT', 'FORCED_DISPLACEMENT_FORBIDDEN'],
        ['return-humanitarian', { proposalKind: 'FORCED_RETURN', listenerPosture: 'HUMANITARIAN' }, 'REFUSE_FORCED_RETURN', 'FORCED_DISPLACEMENT_FORBIDDEN'],
        ['return-institutionalist', { proposalKind: 'FORCED_RETURN' }, 'REQUEST_LEGAL_ORDER_AND_INDIVIDUAL_REVIEW', 'FORCED_DISPLACEMENT_FORBIDDEN'],
        ['return-opportunist', { proposalKind: 'FORCED_RETURN', listenerPosture: 'OPPORTUNIST' }, 'SEEK_IMMUNITY_FOR_ENFORCEMENT', 'FORCED_DISPLACEMENT_FORBIDDEN'],
        ['transit-low-trust', { proposalKind: 'TRANSIT_BARGAIN', neighborReliability: 'LOW' }, 'DEMAND_ESCROW_AND_MONITORING', 'THIRD_PARTY_TRANSIT_POLICY_MISSING'],
        ['transit-unknown', { proposalKind: 'TRANSIT_BARGAIN', neighborReliability: 'UNKNOWN' }, 'REQUEST_COUNTERPARTY_GUARANTEE', 'THIRD_PARTY_TRANSIT_POLICY_MISSING'],
        ['transit-no-fund', { proposalKind: 'TRANSIT_BARGAIN', aidFunding: 'NONE' }, 'ASK_PER_CAPITA_FUNDING', 'THIRD_PARTY_TRANSIT_POLICY_MISSING'],
        ['transit-ready', { proposalKind: 'TRANSIT_BARGAIN' }, 'NEGOTIATE_MONITORED_TRANSIT_CENTER', 'THIRD_PARTY_TRANSIT_POLICY_MISSING']
    ];
    const refugeeRows = refugeeSpecs.map(([caseId, patch, expectedResponse, expectedGate]) => {
        const input = Object.assign({}, refugeeBase, patch, { caseId });
        const first = dialogueScenarioLab.evaluateRefugeeBorderScenario(input);
        const second = dialogueScenarioLab.evaluateRefugeeBorderScenario(input);
        return {
            caseId, input, result: first, expectedResponse, expectedGate,
            deterministic: JSON.stringify(first) === JSON.stringify(second),
            validation: dialogueScenarioLab.refugeeResultValidate(first)
        };
    });
    const invalidRefugee = dialogueScenarioLab.evaluateRefugeeBorderScenario(
        Object.assign({}, refugeeBase, { caseId: 'invented-border-policy', borderPolicyActive: true })
    );
    const bankOpeningText = 'Bu bankayı kurtaralım ama hisseleri sulandırıp yönetim kuruluna iki devlet temsilcisi atayalım.';
    const bankBase = {
        scenarioId: 'bank-bailout-oligarch', playerText: bankOpeningText,
        proposalKind: 'DILUTION_AND_AUDIT', playerBankReference: 'KNOWN',
        listenerBankBelief: 'VERIFIED', bankTruth: 'LIQUIDITY_STRESSED', liquidityGap: 'VERIFIED',
        balanceSheetIntegrity: 'VERIFIED', depositExposure: 'MATERIAL', systemicConnectivity: 'LOW',
        stateBudgetCapacity: 'SUFFICIENT', playerAuthority: 'AUTHORIZED', ownerCrossHoldings: 'VERIFIED',
        listenerPosture: 'PRAGMATIC', resolutionCapacity: 'SUFFICIENT', mediaQuidProQuo: 'NONE'
    };
    const bankSpecs = [
        ['unknown-bank', { playerBankReference: 'UNKNOWN' }, 'ASK_BANK_REFERENCE', 'BANK_REFERENCE_REQUIRED'],
        ['listener-no-crisis', { listenerBankBelief: 'NONE' }, 'ASK_BANK_CRISIS_EVIDENCE', 'LISTENER_BANK_EVIDENCE_REQUIRED'],
        ['authority-missing', { playerAuthority: 'UNAUTHORIZED' }, 'REFER_AUTHORIZED_FINANCE_OFFICE', 'FINANCIAL_AUTHORITY_REQUIRED'],
        ['gap-unverified', { liquidityGap: 'UNVERIFIED' }, 'DEMAND_INDEPENDENT_LIQUIDITY_AUDIT', 'LIQUIDITY_GAP_VERIFICATION_REQUIRED'],
        ['fraudulent-books', { balanceSheetIntegrity: 'FRAUDULENT' }, 'ACCEPT_DEPOSIT_PROTECTION_NOT_OWNER_IMMUNITY', 'BANK_FRAUD_INVESTIGATION_REQUIRED'],
        ['budget-insufficient', { stateBudgetCapacity: 'INSUFFICIENT' }, 'REJECT_UNFUNDED_RESCUE', 'STATE_BUDGET_CAPACITY_REQUIRED'],
        ['ownership-unknown', { ownerCrossHoldings: 'UNKNOWN' }, 'ACCEPT_CONDITIONAL_DILUTION_AND_AUDIT', 'BENEFICIAL_OWNERSHIP_REVIEW_REQUIRED'],
        ['dilution-defensive', { listenerPosture: 'DEFENSIVE' }, 'COUNTER_WITH_MANAGER_IMMUNITY_REQUEST', 'BANK_RESOLUTION_EXECUTOR_MISSING'],
        ['dilution-opportunist', { listenerPosture: 'OPPORTUNIST' }, 'SEEK_CONTROL_PROTECTION_AND_PRICE', 'BANK_RESOLUTION_EXECUTOR_MISSING'],
        ['dilution-ready', {}, 'ACCEPT_CONDITIONAL_DILUTION_AND_AUDIT', 'BANK_RESOLUTION_EXECUTOR_MISSING'],
        ['believed-stressed-solvent', { bankTruth: 'SOLVENT' }, 'ACCEPT_CONDITIONAL_DILUTION_AND_AUDIT', 'BANK_CRISIS_NOT_ACTIONABLE'],
        ['blank-pragmatic', { proposalKind: 'BLANK_CHEQUE', mediaQuidProQuo: 'EXPLICIT' }, 'REJECT_MEDIA_QUID_PRO_QUO', 'CORRUPTION_ACTION_FORBIDDEN'],
        ['blank-defensive', { proposalKind: 'BLANK_CHEQUE', listenerPosture: 'DEFENSIVE', mediaQuidProQuo: 'EXPLICIT' }, 'SEEK_WRITTEN_POLITICAL_PROTECTION', 'CORRUPTION_ACTION_FORBIDDEN'],
        ['blank-opportunist', { proposalKind: 'BLANK_CHEQUE', listenerPosture: 'OPPORTUNIST', mediaQuidProQuo: 'EXPLICIT' }, 'ACCEPT_OR_RECORD_CORRUPT_BARGAIN', 'CORRUPTION_ACTION_FORBIDDEN'],
        ['failure-high-systemic', { proposalKind: 'ORDERLY_FAILURE', systemicConnectivity: 'HIGH' }, 'WARN_CONTAGION_BEFORE_LIQUIDATION', 'SYSTEMIC_RISK_MODEL_REQUIRED'],
        ['failure-unknown-systemic', { proposalKind: 'ORDERLY_FAILURE', systemicConnectivity: 'UNKNOWN' }, 'SUPPORT_PROTECTED_ORDERLY_FAILURE', 'SYSTEMIC_RISK_MODEL_REQUIRED'],
        ['failure-capacity-unknown', { proposalKind: 'ORDERLY_FAILURE', resolutionCapacity: 'UNKNOWN' }, 'REQUEST_DEPOSIT_TRANSFER_PLAN', 'RESOLUTION_CAPACITY_REQUIRED'],
        ['failure-capacity-insufficient', { proposalKind: 'ORDERLY_FAILURE', resolutionCapacity: 'INSUFFICIENT' }, 'REJECT_DISORDERLY_FAILURE', 'RESOLUTION_CAPACITY_REQUIRED'],
        ['failure-deposits-unknown', { proposalKind: 'ORDERLY_FAILURE', depositExposure: 'UNKNOWN' }, 'SUPPORT_PROTECTED_ORDERLY_FAILURE', 'DEPOSIT_EXPOSURE_VERIFICATION_REQUIRED'],
        ['failure-ready', { proposalKind: 'ORDERLY_FAILURE' }, 'SUPPORT_PROTECTED_ORDERLY_FAILURE', 'DEPOSIT_TRANSFER_EXECUTOR_MISSING']
    ];
    const bankRows = bankSpecs.map(([caseId, patch, expectedResponse, expectedGate]) => {
        const input = Object.assign({}, bankBase, patch, { caseId });
        const first = dialogueScenarioLab.evaluateBankBailoutScenario(input);
        const second = dialogueScenarioLab.evaluateBankBailoutScenario(input);
        return {
            caseId, input, result: first, expectedResponse, expectedGate,
            deterministic: JSON.stringify(first) === JSON.stringify(second),
            validation: dialogueScenarioLab.bankResultValidate(first)
        };
    });
    const invalidBank = dialogueScenarioLab.evaluateBankBailoutScenario(
        Object.assign({}, bankBase, { caseId: 'invented-resolution', bankResolutionExecutorActive: true })
    );
    const prisonerOpeningText = 'Önce yaralı savaş esirlerini takas edelim; kimlik ve sağlık listelerini tarafsız doktor doğrulasın.';
    const prisonerBase = {
        scenarioId: 'prisoner-exchange', playerText: prisonerOpeningText,
        proposalKind: 'STAGED_VERIFICATION', playerDetentionReference: 'KNOWN',
        listenerDetentionBelief: 'VERIFIED', detaineeTruth: 'MATCHES_LIST',
        identityVerification: 'VERIFIED', healthVerification: 'VERIFIED', secretExposure: 'LOW',
        counterpartyAccess: 'VERIFIED', publicPressure: 'NORMAL', priorCompliance: 'CLEAN',
        exchangeSiteSecurity: 'SECURE', neutralObserver: 'AVAILABLE', playerAuthority: 'AUTHORIZED',
        listenerPosture: 'HUMANITARIAN', apologyStatus: 'NOT_REQUESTED'
    };
    const prisonerSpecs = [
        ['unknown-report', { playerDetentionReference: 'UNKNOWN' }, 'ASK_DETENTION_REFERENCE', 'DETENTION_REFERENCE_REQUIRED'],
        ['listener-no-list', { listenerDetentionBelief: 'NONE' }, 'ASK_DETAINEE_LIST_EVIDENCE', 'LISTENER_DETENTION_EVIDENCE_REQUIRED'],
        ['authority-missing', { playerAuthority: 'UNAUTHORIZED' }, 'REFER_AUTHORIZED_EXCHANGE_OFFICE', 'EXCHANGE_AUTHORITY_REQUIRED'],
        ['identity-none', { identityVerification: 'NONE' }, 'DEMAND_VERIFIED_NAME_LISTS', 'IDENTITY_VERIFICATION_REQUIRED'],
        ['health-partial', { healthVerification: 'PARTIAL' }, 'DEMAND_NEUTRAL_MEDICAL_EXAM', 'HEALTH_VERIFICATION_REQUIRED'],
        ['observer-unavailable', { neutralObserver: 'UNAVAILABLE' }, 'REQUEST_ACCEPTABLE_NEUTRAL_OBSERVER', 'PRISONER_EXCHANGE_EXECUTOR_MISSING'],
        ['prior-breach', { priorCompliance: 'BREACHED' }, 'DEMAND_SIMULTANEOUS_HANDOVER_SAFEGUARDS', 'PRIOR_BREACH_SAFEGUARDS_REQUIRED'],
        ['site-risky', { exchangeSiteSecurity: 'RISKY' }, 'ACCEPT_WOUNDED_FIRST_VERIFIED_EXCHANGE', 'EXCHANGE_SITE_SECURITY_REQUIRED'],
        ['staged-ready', {}, 'ACCEPT_WOUNDED_FIRST_VERIFIED_EXCHANGE', 'PRISONER_EXCHANGE_EXECUTOR_MISSING'],
        ['believed-listed-missing', { detaineeTruth: 'MISSING' }, 'ACCEPT_WOUNDED_FIRST_VERIFIED_EXCHANGE', 'DETAINEE_CASE_NOT_ACTIONABLE'],
        ['roster-mismatch', { detaineeTruth: 'MISMATCH' }, 'ACCEPT_WOUNDED_FIRST_VERIFIED_EXCHANGE', 'DETAINEE_ROSTER_MISMATCH'],
        ['intel-no-access', { proposalKind: 'INTELLIGENCE_BARGAIN', counterpartyAccess: 'NONE' }, 'REJECT_INACCESSIBLE_INFORMATION_OFFER', 'INTELLIGENCE_CLAIM_UNVERIFIED'],
        ['intel-claimed', { proposalKind: 'INTELLIGENCE_BARGAIN', counterpartyAccess: 'CLAIMED' }, 'DEMAND_PROOF_OF_INFORMATION_ACCESS', 'INTELLIGENCE_CLAIM_UNVERIFIED'],
        ['intel-high-security', { proposalKind: 'INTELLIGENCE_BARGAIN', secretExposure: 'HIGH', listenerPosture: 'SECURITY' }, 'REFUSE_HIGH_VALUE_OFFICER_RELEASE', 'CLASSIFIED_RELEASE_FORBIDDEN'],
        ['intel-humanitarian', { proposalKind: 'INTELLIGENCE_BARGAIN' }, 'SEPARATE_LIVES_FROM_INTELLIGENCE_BARGAIN', 'SEARCH_RESCUE_MISSION_ADAPTER_MISSING'],
        ['intel-opportunist', { proposalKind: 'INTELLIGENCE_BARGAIN', listenerPosture: 'OPPORTUNIST' }, 'CONSIDER_CONDITIONAL_INFORMATION_BARGAIN', 'SEARCH_RESCUE_MISSION_ADAPTER_MISSING'],
        ['prop-apology', { proposalKind: 'PROPAGANDA_REFUSAL', apologyStatus: 'OFFERED' }, 'RESUME_VERIFIED_EXCHANGE_AFTER_APOLOGY', 'DIPLOMATIC_APOLOGY_ADAPTER_MISSING'],
        ['prop-humanitarian', { proposalKind: 'PROPAGANDA_REFUSAL' }, 'PROPOSE_SILENT_EXCHANGE_WITHOUT_CAMERAS', 'DIPLOMATIC_APOLOGY_ADAPTER_MISSING'],
        ['prop-opportunist', { proposalKind: 'PROPAGANDA_REFUSAL', listenerPosture: 'OPPORTUNIST' }, 'EXPLOIT_PROPAGANDA_STALEMATE', 'DIPLOMATIC_APOLOGY_ADAPTER_MISSING'],
        ['prop-family-pressure', { proposalKind: 'PROPAGANDA_REFUSAL', listenerPosture: 'SECURITY', publicPressure: 'HIGH' }, 'WARN_FAMILY_PRESSURE_COST', 'DIPLOMATIC_APOLOGY_ADAPTER_MISSING'],
        ['prop-demand-apology', { proposalKind: 'PROPAGANDA_REFUSAL', listenerPosture: 'SECURITY' }, 'DEMAND_FORMAL_APOLOGY_BEFORE_EXCHANGE', 'DIPLOMATIC_APOLOGY_ADAPTER_MISSING']
    ];
    const prisonerRows = prisonerSpecs.map(([caseId, patch, expectedResponse, expectedGate]) => {
        const input = Object.assign({}, prisonerBase, patch, { caseId });
        const first = dialogueScenarioLab.evaluatePrisonerExchangeScenario(input);
        const second = dialogueScenarioLab.evaluatePrisonerExchangeScenario(input);
        return {
            caseId, input, result: first, expectedResponse, expectedGate,
            deterministic: JSON.stringify(first) === JSON.stringify(second),
            validation: dialogueScenarioLab.prisonerResultValidate(first)
        };
    });
    const invalidPrisoner = dialogueScenarioLab.evaluatePrisonerExchangeScenario(
        Object.assign({}, prisonerBase, { caseId: 'invented-prisoner-ledger', prisonerLedgerActive: true })
    );
    const pipelineOpeningText = 'Boru hattındaki patlama sizin tarafınızda oldu. Güvenlik kayıtlarını açın ve ortak ekip kuralım.';
    const pipelineBase = {
        scenarioId: 'pipeline-sabotage-inquiry', playerText: pipelineOpeningText,
        proposalKind: 'LIMITED_DATA_SHARING', playerIncidentReference: 'KNOWN',
        listenerIncidentBelief: 'VERIFIED', incidentTruth: 'SABOTAGE', causeEvidence: 'VERIFIED',
        detectionStatus: 'DETECTED', attributionStatus: 'ATTRIBUTED', rawLogsSensitivity: 'LOW',
        sensorWindowAvailable: 'AVAILABLE', energyDependence: 'HIGH', mediaNarrative: 'CAUTIOUS',
        borderProtocol: 'ACTIVE', neutralExperts: 'AVAILABLE', simultaneousReleaseTrust: 'HIGH',
        playerAuthority: 'AUTHORIZED', listenerPosture: 'INSTITUTIONALIST',
        smugglingCaseReference: 'NONE'
    };
    const pipelineSpecs = [
        ['unknown-incident', { playerIncidentReference: 'UNKNOWN' }, 'ASK_INCIDENT_REFERENCE', 'PIPELINE_INCIDENT_REFERENCE_REQUIRED'],
        ['listener-no-incident', { listenerIncidentBelief: 'NONE' }, 'ASK_PIPELINE_INCIDENT_EVIDENCE', 'LISTENER_INCIDENT_EVIDENCE_REQUIRED'],
        ['authority-missing', { playerAuthority: 'UNAUTHORIZED' }, 'REFER_AUTHORIZED_CRISIS_OFFICE', 'CRISIS_AUTHORITY_REQUIRED'],
        ['incident-missing', { incidentTruth: 'MISSING' }, 'ACCEPT_LIMITED_JOINT_TECHNICAL_INQUIRY', 'PIPELINE_INCIDENT_NOT_ACTIONABLE'],
        ['believed-sabotage-accident', { incidentTruth: 'ACCIDENT' }, 'ACCEPT_LIMITED_JOINT_TECHNICAL_INQUIRY', 'SABOTAGE_CAUSE_NOT_CONFIRMED'],
        ['third-party-cause', { incidentTruth: 'THIRD_PARTY' }, 'ACCEPT_LIMITED_JOINT_TECHNICAL_INQUIRY', 'THIRD_PARTY_CAUSE_REVIEW_REQUIRED'],
        ['cause-none', { causeEvidence: 'NONE' }, 'REQUEST_PRESERVED_TECHNICAL_EVIDENCE', 'CAUSE_EVIDENCE_VERIFICATION_REQUIRED'],
        ['cause-partial', { causeEvidence: 'PARTIAL' }, 'ACCEPT_LIMITED_JOINT_TECHNICAL_INQUIRY', 'CAUSE_EVIDENCE_VERIFICATION_REQUIRED'],
        ['sensitive-logs', { rawLogsSensitivity: 'HIGH' }, 'OFFER_REDACTED_SENSOR_WINDOW', 'JOINT_PIPELINE_INQUIRY_ADAPTER_MISSING'],
        ['sensor-unavailable', { sensorWindowAvailable: 'UNAVAILABLE' }, 'ASK_ALTERNATIVE_TELEMETRY', 'JOINT_PIPELINE_INQUIRY_ADAPTER_MISSING'],
        ['experts-unavailable', { neutralExperts: 'UNAVAILABLE' }, 'NEGOTIATE_NEUTRAL_EXPERT_LIST', 'NEUTRAL_EXPERT_SYSTEM_MISSING'],
        ['border-protocol-missing', { borderProtocol: 'MISSING' }, 'ACCEPT_LIMITED_JOINT_TECHNICAL_INQUIRY', 'BORDER_SECURITY_PROTOCOL_MISSING'],
        ['release-trust-breached', { simultaneousReleaseTrust: 'BREACHED' }, 'DEMAND_SIMULTANEOUS_ESCROWED_RELEASE', 'JOINT_REPORT_RELEASE_SAFEGUARD_REQUIRED'],
        ['limited-ready', {}, 'ACCEPT_LIMITED_JOINT_TECHNICAL_INQUIRY', 'JOINT_PIPELINE_INQUIRY_ADAPTER_MISSING'],
        ['public-undetected', { proposalKind: 'PUBLIC_ACCUSATION', detectionStatus: 'UNDETECTED', attributionStatus: 'UNATTRIBUTED' }, 'WARN_AGAINST_UNVERIFIED_ACCUSATION', 'ATTRIBUTION_NOT_CONFIRMED'],
        ['public-disputed', { proposalKind: 'PUBLIC_ACCUSATION', attributionStatus: 'DISPUTED' }, 'WARN_AGAINST_UNVERIFIED_ACCUSATION', 'ATTRIBUTION_NOT_CONFIRMED'],
        ['public-institutionalist', { proposalKind: 'PUBLIC_ACCUSATION' }, 'DEMAND_EVIDENCE_BEFORE_PUBLIC_STATEMENT', 'MEDIA_ACCUSATION_ADAPTER_MISSING'],
        ['public-defensive', { proposalKind: 'PUBLIC_ACCUSATION', listenerPosture: 'DEFENSIVE' }, 'COUNTERACCUSE_AND_THREATEN_FLOW_CUTOFF', 'MEDIA_ACCUSATION_ADAPTER_MISSING'],
        ['public-opportunist', { proposalKind: 'PUBLIC_ACCUSATION', listenerPosture: 'OPPORTUNIST' }, 'EXPLOIT_PUBLIC_BLAME', 'MEDIA_ACCUSATION_ADAPTER_MISSING'],
        ['cover-no-case', { proposalKind: 'SECRET_QUID_PRO_QUO' }, 'REJECT_UNDEFINED_COVER_UP', 'CORRUPTION_ACTION_FORBIDDEN'],
        ['cover-unknown-case', { proposalKind: 'SECRET_QUID_PRO_QUO', smugglingCaseReference: 'UNKNOWN' }, 'ASK_WHICH_CASE_IS_BEING_SUPPRESSED', 'CORRUPTION_ACTION_FORBIDDEN'],
        ['cover-institutionalist', { proposalKind: 'SECRET_QUID_PRO_QUO', smugglingCaseReference: 'KNOWN' }, 'REJECT_COVER_UP_AND_PRESERVE_RECORD', 'CORRUPTION_ACTION_FORBIDDEN'],
        ['cover-defensive', { proposalKind: 'SECRET_QUID_PRO_QUO', smugglingCaseReference: 'KNOWN', listenerPosture: 'DEFENSIVE' }, 'SEEK_MUTUAL_NONDISCLOSURE', 'CORRUPTION_ACTION_FORBIDDEN'],
        ['cover-opportunist', { proposalKind: 'SECRET_QUID_PRO_QUO', smugglingCaseReference: 'KNOWN', listenerPosture: 'OPPORTUNIST' }, 'ACCEPT_OR_RECORD_BLACKMAIL_CANDIDATE', 'CORRUPTION_ACTION_FORBIDDEN']
    ];
    const pipelineRows = pipelineSpecs.map(([caseId, patch, expectedResponse, expectedGate]) => {
        const input = Object.assign({}, pipelineBase, patch, { caseId });
        const first = dialogueScenarioLab.evaluatePipelineSabotageScenario(input);
        const second = dialogueScenarioLab.evaluatePipelineSabotageScenario(input);
        return {
            caseId, input, result: first, expectedResponse, expectedGate,
            deterministic: JSON.stringify(first) === JSON.stringify(second),
            validation: dialogueScenarioLab.pipelineResultValidate(first)
        };
    });
    const invalidPipeline = dialogueScenarioLab.evaluatePipelineSabotageScenario(
        Object.assign({}, pipelineBase, { caseId: 'invented-joint-inquiry', jointTechnicalInquiryActive: true })
    );
    const coupOpeningText = 'Darbe söylentisinde ordunun tarafsız kalmasını sağla. Karşılığında yeni hükümette savunma reformunu sen yöneteceksin.';
    const coupBase = {
        scenarioId: 'coup-rumor-succession', playerText: coupOpeningText,
        proposalKind: 'CONSTITUTIONAL_TRANSITION', playerRumorReference: 'KNOWN',
        listenerRumorBelief: 'VERIFIED', crisisTruth: 'ACTIVE',
        leaderCondition: 'CONFIRMED_INCAPACITATED', loyaltyEvidence: 'VERIFIED',
        playerAppointmentAuthority: 'AUTHORIZED', constitutionalPath: 'AVAILABLE',
        emergencySignatureChain: 'READY', listenerPosture: 'PRINCIPLED',
        rivalNetwork: 'KNOWN', disinformationCapability: 'AVAILABLE', promiseIntegrity: 'CLEAN',
        crisisStage: 'COALITION'
    };
    const coupSpecs = [
        ['unknown-rumor', { playerRumorReference: 'UNKNOWN' }, 'ASK_COUP_RUMOR_REFERENCE', 'COUP_RUMOR_REFERENCE_REQUIRED'],
        ['listener-no-rumor', { listenerRumorBelief: 'NONE' }, 'ASK_COMMAND_FRACTURE_EVIDENCE', 'LISTENER_COUP_EVIDENCE_REQUIRED'],
        ['leader-unverified', { leaderCondition: 'UNVERIFIED' }, 'DEMAND_VERIFIED_LEADER_CONDITION', 'LEADER_CONDITION_VERIFICATION_REQUIRED'],
        ['leader-record-missing', { leaderCondition: 'MISSING' }, 'DEMAND_VERIFIED_LEADER_CONDITION', 'LEADER_CONDITION_VERIFICATION_REQUIRED'],
        ['crisis-none', { crisisTruth: 'NONE' }, 'SUPPORT_CONSTITUTIONAL_TRANSITION_AND_BARRACKS_ORDER', 'POLITICAL_CRISIS_NOT_ACTIONABLE'],
        ['crisis-resolved', { crisisTruth: 'RESOLVED' }, 'SUPPORT_CONSTITUTIONAL_TRANSITION_AND_BARRACKS_ORDER', 'POLITICAL_CRISIS_NOT_ACTIONABLE'],
        ['leader-healthy', { leaderCondition: 'HEALTHY' }, 'SUPPORT_CONSTITUTIONAL_TRANSITION_AND_BARRACKS_ORDER', 'LEADER_INCAPACITY_NOT_CONFIRMED'],
        ['transition-unauthorized', { playerAppointmentAuthority: 'UNAUTHORIZED' }, 'REFER_CONSTITUTIONAL_SUCCESSION_AUTHORITY', 'TRANSITION_AUTHORITY_REQUIRED'],
        ['transition-blocked', { constitutionalPath: 'BLOCKED' }, 'SEEK_INSTITUTIONAL_REMEDY', 'CONSTITUTIONAL_SUCCESSION_PATH_REQUIRED'],
        ['transition-path-unknown', { constitutionalPath: 'UNKNOWN' }, 'REQUEST_SUCCESSION_ORDER', 'CONSTITUTIONAL_SUCCESSION_PATH_REQUIRED'],
        ['signature-gap', { emergencySignatureChain: 'GAP' }, 'DEMAND_NAMED_EMERGENCY_SIGNER', 'EMERGENCY_SIGNATURE_CHAIN_REQUIRED'],
        ['loyalty-partial', { loyaltyEvidence: 'PARTIAL' }, 'REQUEST_VERIFIED_COMMAND_LOYALTY_MAP', 'LOYALTY_VERIFICATION_REQUIRED'],
        ['promise-breached', { promiseIntegrity: 'BREACHED' }, 'DEMAND_ENFORCEABLE_TRANSITION_SAFEGUARDS', 'PRIOR_PROMISE_SAFEGUARDS_REQUIRED'],
        ['transition-ready', {}, 'SUPPORT_CONSTITUTIONAL_TRANSITION_AND_BARRACKS_ORDER', 'CONSTITUTIONAL_TRANSITION_ADAPTER_MISSING'],
        ['office-unauthorized', { proposalKind: 'PERSONAL_OFFICE_BARGAIN', playerAppointmentAuthority: 'UNAUTHORIZED' }, 'REJECT_FALSE_APPOINTMENT_PROMISE', 'CORRUPT_APPOINTMENT_PROMISE_FORBIDDEN'],
        ['office-principled', { proposalKind: 'PERSONAL_OFFICE_BARGAIN' }, 'REPORT_COUP_INDUCEMENT', 'CORRUPT_APPOINTMENT_PROMISE_FORBIDDEN'],
        ['office-ambitious', { proposalKind: 'PERSONAL_OFFICE_BARGAIN', listenerPosture: 'AMBITIOUS' }, 'ACCEPT_SECRET_APPOINTMENT_PLEDGE', 'CORRUPT_APPOINTMENT_PROMISE_FORBIDDEN'],
        ['office-opportunist', { proposalKind: 'PERSONAL_OFFICE_BARGAIN', listenerPosture: 'OPPORTUNIST' }, 'SHOP_PROMISE_TO_RIVAL_FACTIONS', 'CORRUPT_APPOINTMENT_PROMISE_FORBIDDEN'],
        ['split-no-plotters', { proposalKind: 'SPLIT_PLOTTERS', rivalNetwork: 'NONE' }, 'ASK_WHO_THE_PLOTTERS_ARE', 'PLOTTER_IDENTITY_REQUIRED'],
        ['split-unknown-rivals', { proposalKind: 'SPLIT_PLOTTERS', rivalNetwork: 'UNKNOWN' }, 'DEMAND_NAMED_RIVAL_CHANNELS', 'PLOTTER_IDENTITY_REQUIRED'],
        ['split-no-capability', { proposalKind: 'SPLIT_PLOTTERS', disinformationCapability: 'UNAVAILABLE' }, 'REFUSE_UNSUPPORTED_DECEPTION', 'COVERT_DISINFORMATION_ADAPTER_MISSING'],
        ['split-principled', { proposalKind: 'SPLIT_PLOTTERS' }, 'WARN_DECEPTION_MAY_TRIGGER_EARLY_ATTEMPT', 'COVERT_DISINFORMATION_ADAPTER_MISSING'],
        ['split-ambitious', { proposalKind: 'SPLIT_PLOTTERS', listenerPosture: 'AMBITIOUS' }, 'USE_RIVAL_CHANNEL_TO_SPLIT_COALITION', 'COVERT_DISINFORMATION_ADAPTER_MISSING'],
        ['split-opportunist', { proposalKind: 'SPLIT_PLOTTERS', listenerPosture: 'OPPORTUNIST' }, 'SELL_LEAK_TO_BOTH_COUP_FACTIONS', 'COVERT_DISINFORMATION_ADAPTER_MISSING'],
        ['reject-verified', { proposalKind: 'REJECT_RUMOR' }, 'WARN_DELAY_COST_IF_PLOT_IS_REAL', 'POLITICAL_CRISIS_ACTION_REVIEW_REQUIRED'],
        ['reject-reported-principled', { proposalKind: 'REJECT_RUMOR', listenerRumorBelief: 'REPORTED' }, 'ACCEPT_EVIDENCE_THRESHOLD_AND_MONITOR', 'POLITICAL_CRISIS_ACTION_REVIEW_REQUIRED'],
        ['reject-ambitious', { proposalKind: 'REJECT_RUMOR', listenerRumorBelief: 'REPORTED', listenerPosture: 'AMBITIOUS' }, 'READ_REJECTION_AS_WEAKNESS', 'POLITICAL_CRISIS_ACTION_REVIEW_REQUIRED'],
        ['reject-opportunist', { proposalKind: 'REJECT_RUMOR', listenerRumorBelief: 'REPORTED', listenerPosture: 'OPPORTUNIST' }, 'PRESERVE_DENIABILITY_AND_WAIT', 'POLITICAL_CRISIS_ACTION_REVIEW_REQUIRED']
    ];
    const coupRows = coupSpecs.map(([caseId, patch, expectedResponse, expectedGate]) => {
        const input = Object.assign({}, coupBase, patch, { caseId });
        const first = dialogueScenarioLab.evaluateCoupRumorScenario(input);
        const second = dialogueScenarioLab.evaluateCoupRumorScenario(input);
        return {
            caseId, input, result: first, expectedResponse, expectedGate,
            deterministic: JSON.stringify(first) === JSON.stringify(second),
            validation: dialogueScenarioLab.coupResultValidate(first)
        };
    });
    const invalidCoup = dialogueScenarioLab.evaluateCoupRumorScenario(
        Object.assign({}, coupBase, { caseId: 'invented-health-record', leaderHealthRecordActive: true })
    );
    const runtime = createRuntime(seed >>> 0);
    let understanding;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const directory = runtime.api.contactDirectoryBuild();
        const listener = (directory.publicCharacters || []).find(row => row.id !== directory.playerActorId);
        const beforeHash = hashSnapshot(stateSnapshot(runtime.api.state()));
        const analysis = runtime.api.conversationAnalyze(openingText, {
            listenerActorId: listener && listener.id,
            knownEntityIds: {
                shipments: ['trade-shipment:grain-scenario-fixture'],
                regions: ['region:0']
            },
            capitalRegionId: 'region:0'
        });
        const afterHash = hashSnapshot(stateSnapshot(runtime.api.state()));
        const commodity = (analysis.entities || []).find(row => row.role === 'COMMODITY');
        const shipment = (analysis.entities || []).find(row => row.role === 'TARGET_SHIPMENT');
        const destination = (analysis.entities || []).find(row => row.role === 'DESTINATION');
        const beforeStrikeHash = hashSnapshot(stateSnapshot(runtime.api.state()));
        const strikeContext = {
            listenerActorId: listener && listener.id,
            knownEntityIds: { movements: ['movement:country:0|income|state:0'] }
        };
        const strikeAnalysis = runtime.api.conversationAnalyze(strikeOpeningText, strikeContext);
        const strikeSessionResult = runtime.api.conversationSessionBegin(strikeOpeningText, strikeContext);
        runtime.api.conversationWorkspaceOpen(listener && listener.id, listener && listener.name,
            strikeSessionResult.session.id);
        runtime.api.conversationWorkspaceRender();
        const strikeModal = runtime.dom.window.document.getElementById('conversation-workspace-modal');
        const strikeModalText = strikeModal && strikeModal.textContent || '';
        const afterStrikeHash = hashSnapshot(stateSnapshot(runtime.api.state()));
        const strikeEntity = (strikeAnalysis.entities || []).find(row => row.role === 'TARGET_STRIKE');
        const beforeTenderHash = hashSnapshot(stateSnapshot(runtime.api.state()));
        const tenderContext = {
            listenerActorId: listener && listener.id,
            knownEntityIds: { integrityCases: ['integrity-case:1'] }
        };
        const tenderAnalysis = runtime.api.conversationAnalyze(tenderOpeningText, tenderContext);
        const tenderSessionResult = runtime.api.conversationSessionBegin(tenderOpeningText, tenderContext);
        runtime.api.conversationWorkspaceOpen(listener && listener.id, listener && listener.name,
            tenderSessionResult.session.id);
        runtime.api.conversationWorkspaceRender();
        const tenderModal = runtime.dom.window.document.getElementById('conversation-workspace-modal');
        const tenderModalText = tenderModal && tenderModal.textContent || '';
        const afterTenderHash = hashSnapshot(stateSnapshot(runtime.api.state()));
        const integrityEntity = (tenderAnalysis.entities || []).find(row => row.role === 'TARGET_INTEGRITY_CASE');
        const beforeMobilizationHash = hashSnapshot(stateSnapshot(runtime.api.state()));
        const mobilizationContext = {
            listenerActorId: listener && listener.id,
            knownEntityIds: { actorBeliefs: ['actor-belief:border-report-fixture'] }
        };
        const mobilizationAnalysis = runtime.api.conversationAnalyze(mobilizationOpeningText, mobilizationContext);
        const mobilizationSessionResult = runtime.api.conversationSessionBegin(
            mobilizationOpeningText, mobilizationContext
        );
        runtime.api.conversationWorkspaceOpen(listener && listener.id, listener && listener.name,
            mobilizationSessionResult.session.id);
        runtime.api.conversationWorkspaceRender();
        const mobilizationModal = runtime.dom.window.document.getElementById('conversation-workspace-modal');
        const mobilizationModalText = mobilizationModal && mobilizationModal.textContent || '';
        const afterMobilizationHash = hashSnapshot(stateSnapshot(runtime.api.state()));
        const reportEntity = (mobilizationAnalysis.entities || []).find(row => row.role === 'INTELLIGENCE_REPORT');
        const beforeSanctionsHash = hashSnapshot(stateSnapshot(runtime.api.state()));
        const sanctionsContext = {
            listenerActorId: listener && listener.id,
            knownEntityIds: { actorBeliefs: ['actor-belief:sanction-report-fixture'] }
        };
        const sanctionsAnalysis = runtime.api.conversationAnalyze(sanctionsOpeningText, sanctionsContext);
        const sanctionsSessionResult = runtime.api.conversationSessionBegin(sanctionsOpeningText, sanctionsContext);
        runtime.api.conversationWorkspaceOpen(listener && listener.id, listener && listener.name,
            sanctionsSessionResult.session.id);
        runtime.api.conversationWorkspaceRender();
        const sanctionsModal = runtime.dom.window.document.getElementById('conversation-workspace-modal');
        const sanctionsModalText = sanctionsModal && sanctionsModal.textContent || '';
        const afterSanctionsHash = hashSnapshot(stateSnapshot(runtime.api.state()));
        const sanctionEntity = (sanctionsAnalysis.entities || []).find(row => row.role === 'SANCTION_BELIEF');
        const beforeRefugeeHash = hashSnapshot(stateSnapshot(runtime.api.state()));
        const refugeeContext = {
            listenerActorId: listener && listener.id,
            knownEntityIds: {
                migrations: ['migration:refugee-flow-fixture'],
                regions: ['region:0']
            }
        };
        const refugeeAnalysis = runtime.api.conversationAnalyze(refugeeOpeningText, refugeeContext);
        const refugeeSessionResult = runtime.api.conversationSessionBegin(refugeeOpeningText, refugeeContext);
        runtime.api.conversationWorkspaceOpen(listener && listener.id, listener && listener.name,
            refugeeSessionResult.session.id);
        runtime.api.conversationWorkspaceRender();
        const refugeeModal = runtime.dom.window.document.getElementById('conversation-workspace-modal');
        const refugeeModalText = refugeeModal && refugeeModal.textContent || '';
        const afterRefugeeHash = hashSnapshot(stateSnapshot(runtime.api.state()));
        const migrationEntity = (refugeeAnalysis.entities || []).find(row => row.role === 'TARGET_MIGRATION_FLOW');
        const refugeeDestination = (refugeeAnalysis.entities || []).find(row => row.role === 'DESTINATION');
        const beforeBankHash = hashSnapshot(stateSnapshot(runtime.api.state()));
        const bankContext = {
            listenerActorId: listener && listener.id,
            knownEntityIds: { banks: ['bank:0:0'] }
        };
        const bankAnalysis = runtime.api.conversationAnalyze(bankOpeningText, bankContext);
        const bankSessionResult = runtime.api.conversationSessionBegin(bankOpeningText, bankContext);
        runtime.api.conversationWorkspaceOpen(listener && listener.id, listener && listener.name,
            bankSessionResult.session.id);
        runtime.api.conversationWorkspaceRender();
        const bankModal = runtime.dom.window.document.getElementById('conversation-workspace-modal');
        const bankModalText = bankModal && bankModal.textContent || '';
        const afterBankHash = hashSnapshot(stateSnapshot(runtime.api.state()));
        const bankEntity = (bankAnalysis.entities || []).find(row => row.role === 'TARGET_BANK');
        const beforePrisonerHash = hashSnapshot(stateSnapshot(runtime.api.state()));
        const prisonerContext = {
            listenerActorId: listener && listener.id,
            knownEntityIds: { actorBeliefs: ['actor-belief:detention-report-fixture'] }
        };
        const prisonerAnalysis = runtime.api.conversationAnalyze(prisonerOpeningText, prisonerContext);
        const prisonerSessionResult = runtime.api.conversationSessionBegin(prisonerOpeningText, prisonerContext);
        runtime.api.conversationWorkspaceOpen(listener && listener.id, listener && listener.name,
            prisonerSessionResult.session.id);
        runtime.api.conversationWorkspaceRender();
        const prisonerModal = runtime.dom.window.document.getElementById('conversation-workspace-modal');
        const prisonerModalText = prisonerModal && prisonerModal.textContent || '';
        const afterPrisonerHash = hashSnapshot(stateSnapshot(runtime.api.state()));
        const detentionEntity = (prisonerAnalysis.entities || []).find(row => row.role === 'DETENTION_REPORT');
        const energyCorridor = runtime.api.infrastructureSnapshot().corridors.find(row => row.mode === 'ENERGY');
        const beforePipelineHash = hashSnapshot(stateSnapshot(runtime.api.state()));
        const pipelineContext = {
            listenerActorId: listener && listener.id,
            knownEntityIds: {
                corridors: energyCorridor ? [energyCorridor.id] : [],
                actorBeliefs: ['actor-belief:pipeline-incident-fixture']
            }
        };
        const pipelineAnalysis = runtime.api.conversationAnalyze(pipelineOpeningText, pipelineContext);
        const pipelineSessionResult = runtime.api.conversationSessionBegin(pipelineOpeningText, pipelineContext);
        runtime.api.conversationWorkspaceOpen(listener && listener.id, listener && listener.name,
            pipelineSessionResult.session.id);
        runtime.api.conversationWorkspaceRender();
        const pipelineModal = runtime.dom.window.document.getElementById('conversation-workspace-modal');
        const pipelineModalText = pipelineModal && pipelineModal.textContent || '';
        const afterPipelineHash = hashSnapshot(stateSnapshot(runtime.api.state()));
        const corridorEntity = (pipelineAnalysis.entities || [])
            .find(row => row.role === 'TARGET_INFRASTRUCTURE_CORRIDOR');
        const pipelineIncidentEntity = (pipelineAnalysis.entities || [])
            .find(row => row.role === 'PIPELINE_INCIDENT_REPORT');
        runtime.api.advance(5);
        const crisisState = runtime.api.state().states.find(row => Number(row.id) === 0);
        crisisState.welfare = 12;
        if (crisisState.factions) {
            crisisState.factions.workers = 22;
            crisisState.factions.business = 28;
            crisisState.factions.military = 12;
            crisisState.factions.intel = 20;
            crisisState.factions.radicals = 82;
        }
        for (const [index, commander] of ((crisisState.gov && crisisState.gov.commanders) || [])
            .slice(0, 3).entries()) {
            commander.loyalty = 20 + index * 3;
            commander._lastDefect = runtime.api.state().clock;
            commander.skills.warrior = Math.max(4, commander.skills.warrior || 0);
            commander.skills.diplomat = Math.max(3, commander.skills.diplomat || 0);
        }
        runtime.api.politicalCrisisTick(5);
        const activeCrisis = runtime.api.politicalCrisisCountryView('country:0').activeCrisis;
        const beforeCoupHash = hashSnapshot(stateSnapshot(runtime.api.state()));
        const coupContext = {
            listenerActorId: listener && listener.id,
            knownEntityIds: {
                politicalCrises: activeCrisis ? [activeCrisis.id] : [],
                actorBeliefs: ['actor-belief:coup-rumor-fixture']
            }
        };
        const coupAnalysis = runtime.api.conversationAnalyze(coupOpeningText, coupContext);
        const coupSessionResult = runtime.api.conversationSessionBegin(coupOpeningText, coupContext);
        runtime.api.conversationWorkspaceOpen(listener && listener.id, listener && listener.name,
            coupSessionResult.session.id);
        runtime.api.conversationWorkspaceRender();
        const coupModal = runtime.dom.window.document.getElementById('conversation-workspace-modal');
        const coupModalText = coupModal && coupModal.textContent || '';
        const afterCoupHash = hashSnapshot(stateSnapshot(runtime.api.state()));
        const politicalCrisisEntity = (coupAnalysis.entities || [])
            .find(row => row.role === 'TARGET_POLITICAL_CRISIS');
        const coupRumorEntity = (coupAnalysis.entities || [])
            .find(row => row.role === 'COUP_RUMOR_REPORT');
        understanding = {
            analysis,
            validates: runtime.api.conversationValidate(analysis).ok,
            logisticsAct: analysis.speechAct === 'PROPOSE_LOGISTICS_REDIRECT',
            foodResolved: commodity && commodity.entityId === 'food',
            canonicalShipmentAccepted: shipment && shipment.entityId === 'trade-shipment:grain-scenario-fixture',
            knownCapitalBound: destination && destination.entityId === 'region:0'
                && destination.entityType === 'REGION',
            redirectRequest: analysis.requests.length === 1
                && analysis.requests[0].type === 'REDIRECT_SHIPMENT'
                && analysis.requests[0].destinationId === 'region:0',
            mechanicsStillBlocked: analysis.proposedCommand === null
                && analysis.commandBlockedReasons.includes('AUTHORITY_NOT_CHECKED')
                && analysis.unresolvedTerms.includes('regional_receiving_capacity'),
            rawTradeIgnored: analysis.diagnostics.rawTradeLedgerRead === false,
            worldNeutral: beforeHash === afterHash,
            strike: {
                validates: runtime.api.conversationValidate(strikeAnalysis).ok,
                laborAct: strikeAnalysis.speechAct === 'PROPOSE_LABOR_SETTLEMENT',
                knownMovementBound: strikeEntity && strikeEntity.entityId === 'movement:country:0|income|state:0',
                intentBound: strikeAnalysis.playerIntent === 'NEGOTIATE_STRIKE_SETTLEMENT'
                    && strikeAnalysis.topic === 'LABOR',
                requiredChecksPresent: ['worker_mandate', 'company_affordability', 'production_obligation',
                    'safety_commitment', 'required_approval'].every(term => strikeAnalysis.unresolvedTerms.includes(term)),
                mechanicsStillBlocked: strikeAnalysis.proposedCommand === null
                    && strikeAnalysis.commandBlockedReasons.includes('AUTHORITY_NOT_CHECKED'),
                sessionLabOnly: strikeSessionResult.session.status === 'SCENARIO_LAB_ONLY'
                    && strikeSessionResult.session.candidate.kind === 'SCENARIO_LAB_RECORD'
                    && strikeSessionResult.session.candidate.executable === false,
                uiHonest: strikeModalText.includes('MEKANİK ADAPTÖR')
                    && strikeModalText.includes('Grev, ücret, rota veya sevkiyat değişmedi'),
                ledgerValid: runtime.api.conversationSessionValidate(
                    runtime.api.conversationSessionSnapshot()).ok,
                worldNeutral: beforeStrikeHash === afterStrikeHash
            },
            tender: {
                validates: runtime.api.conversationValidate(tenderAnalysis).ok,
                publicationAct: tenderAnalysis.speechAct === 'PROPOSE_PUBLICATION_DELAY',
                knownCaseBound: integrityEntity && integrityEntity.entityId === 'integrity-case:1',
                intentBound: tenderAnalysis.playerIntent === 'NEGOTIATE_PUBLICATION_DELAY'
                    && tenderAnalysis.topic === 'MEDIA_INTEGRITY',
                requiredChecksPresent: ['evidence_authenticity', 'source_custody', 'investigation_authority',
                    'publication_deadline', 'press_independence', 'required_approval']
                    .every(term => tenderAnalysis.unresolvedTerms.includes(term)),
                mechanicsStillBlocked: tenderAnalysis.proposedCommand === null
                    && tenderAnalysis.commandBlockedReasons.includes('AUTHORITY_NOT_CHECKED'),
                sessionLabOnly: tenderSessionResult.session.status === 'SCENARIO_LAB_ONLY'
                    && tenderSessionResult.session.candidate.kind === 'SCENARIO_LAB_RECORD'
                    && tenderSessionResult.session.candidate.executable === false,
                uiHonest: tenderModalText.includes('MEKANİK ADAPTÖR')
                    && tenderModalText.includes('ihale dosyası veya yayın durumu değişmedi'),
                ledgerValid: runtime.api.conversationSessionValidate(
                    runtime.api.conversationSessionSnapshot()).ok,
                worldNeutral: beforeTenderHash === afterTenderHash
            },
            mobilization: {
                validates: runtime.api.conversationValidate(mobilizationAnalysis).ok,
                mobilizationAct: mobilizationAnalysis.speechAct === 'PROPOSE_PREVENTIVE_MOBILIZATION',
                knownReportBound: reportEntity && reportEntity.entityId === 'actor-belief:border-report-fixture',
                intentBound: mobilizationAnalysis.playerIntent === 'PREPARE_BORDER_MOBILIZATION'
                    && mobilizationAnalysis.topic === 'SECURITY_INTELLIGENCE',
                requiredChecksPresent: ['report_reliability', 'observed_intent', 'mobilization_authority',
                    'mobilization_cost', 'treaty_compatibility', 'escalation_risk', 'required_approval']
                    .every(term => mobilizationAnalysis.unresolvedTerms.includes(term)),
                mechanicsStillBlocked: mobilizationAnalysis.proposedCommand === null
                    && mobilizationAnalysis.commandBlockedReasons.includes('AUTHORITY_NOT_CHECKED'),
                sessionLabOnly: mobilizationSessionResult.session.status === 'SCENARIO_LAB_ONLY'
                    && mobilizationSessionResult.session.candidate.kind === 'SCENARIO_LAB_RECORD'
                    && mobilizationSessionResult.session.candidate.executable === false,
                uiHonest: mobilizationModalText.includes('MEKANİK ADAPTÖR')
                    && mobilizationModalText.includes('seferberlik, savaş veya diplomasi durumu değişmedi'),
                ledgerValid: runtime.api.conversationSessionValidate(
                    runtime.api.conversationSessionSnapshot()).ok,
                worldNeutral: beforeMobilizationHash === afterMobilizationHash
            },
            sanctions: {
                validates: runtime.api.conversationValidate(sanctionsAnalysis).ok,
                sanctionsAct: sanctionsAnalysis.speechAct === 'PROPOSE_SANCTIONS_EVASION',
                knownBeliefBound: sanctionEntity
                    && sanctionEntity.entityId === 'actor-belief:sanction-report-fixture',
                intentBound: sanctionsAnalysis.playerIntent === 'NEGOTIATE_SANCTIONS_EVASION'
                    && sanctionsAnalysis.topic === 'SANCTIONS_TRADE',
                requiredChecksPresent: ['sanction_validity', 'goods_classification',
                    'intermediary_ownership', 'intermediary_capacity', 'port_inspection',
                    'payment_channel', 'evasion_legality', 'diplomatic_exposure', 'required_approval']
                    .every(term => sanctionsAnalysis.unresolvedTerms.includes(term)),
                mechanicsStillBlocked: sanctionsAnalysis.proposedCommand === null
                    && sanctionsAnalysis.commandBlockedReasons.includes('AUTHORITY_NOT_CHECKED'),
                sessionLabOnly: sanctionsSessionResult.session.status === 'SCENARIO_LAB_ONLY'
                    && sanctionsSessionResult.session.candidate.kind === 'SCENARIO_LAB_RECORD'
                    && sanctionsSessionResult.session.candidate.executable === false,
                uiHonest: sanctionsModalText.includes('MEKANİK ADAPTÖR')
                    && sanctionsModalText.includes('yaptırım, şirket, ödeme'),
                ledgerValid: runtime.api.conversationSessionValidate(
                    runtime.api.conversationSessionSnapshot()).ok,
                worldNeutral: beforeSanctionsHash === afterSanctionsHash
            },
            refugee: {
                validates: runtime.api.conversationValidate(refugeeAnalysis).ok,
                refugeeAct: refugeeAnalysis.speechAct === 'PROPOSE_REFUGEE_SETTLEMENT',
                knownFlowBound: migrationEntity
                    && migrationEntity.entityId === 'migration:refugee-flow-fixture',
                knownDestinationBound: refugeeDestination && refugeeDestination.entityId === 'region:0',
                intentBound: refugeeAnalysis.playerIntent === 'NEGOTIATE_REFUGEE_SETTLEMENT'
                    && refugeeAnalysis.topic === 'MIGRATION_HUMANITARIAN',
                requestBound: refugeeAnalysis.requests.length === 1
                    && refugeeAnalysis.requests[0].type === 'RELOCATE_REFUGEE_FLOW'
                    && refugeeAnalysis.requests[0].targetMigrationFlowId === 'migration:refugee-flow-fixture'
                    && refugeeAnalysis.requests[0].destinationId === 'region:0',
                requiredChecksPresent: ['refugee_flow_status', 'cohort_count_and_demography',
                    'destination_reception_capacity', 'housing_capacity', 'employment_capacity',
                    'food_and_security_capacity', 'family_networks', 'local_attitude',
                    'international_aid_funding', 'voluntary_consent', 'border_and_asylum_law',
                    'required_approval'].every(term => refugeeAnalysis.unresolvedTerms.includes(term)),
                mechanicsStillBlocked: refugeeAnalysis.proposedCommand === null
                    && refugeeAnalysis.commandBlockedReasons.includes('AUTHORITY_NOT_CHECKED'),
                sessionLabOnly: refugeeSessionResult.session.status === 'SCENARIO_LAB_ONLY'
                    && refugeeSessionResult.session.candidate.kind === 'SCENARIO_LAB_RECORD'
                    && refugeeSessionResult.session.candidate.executable === false,
                uiHonest: refugeeModalText.includes('MEKANİK ADAPTÖR')
                    && refugeeModalText.includes('sınır, göç, nüfus'),
                ledgerValid: runtime.api.conversationSessionValidate(
                    runtime.api.conversationSessionSnapshot()).ok,
                worldNeutral: beforeRefugeeHash === afterRefugeeHash
            },
            bank: {
                validates: runtime.api.conversationValidate(bankAnalysis).ok,
                bankAct: bankAnalysis.speechAct === 'PROPOSE_BANK_RESOLUTION',
                knownBankBound: bankEntity && bankEntity.entityId === 'bank:0:0',
                intentBound: bankAnalysis.playerIntent === 'NEGOTIATE_BANK_RESOLUTION'
                    && bankAnalysis.topic === 'FINANCIAL_STABILITY',
                requestBound: bankAnalysis.requests.length === 1
                    && bankAnalysis.requests[0].type === 'RESOLVE_BANK_CRISIS'
                    && bankAnalysis.requests[0].targetBankId === 'bank:0:0',
                requiredChecksPresent: ['bank_crisis_status', 'liquidity_gap', 'balance_sheet_integrity',
                    'deposit_exposure', 'systemic_connectivity', 'owner_cross_holdings',
                    'state_budget_capacity', 'resolution_capacity', 'bank_governance',
                    'investigation_and_immunity', 'media_quid_pro_quo', 'required_approval']
                    .every(term => bankAnalysis.unresolvedTerms.includes(term)),
                mechanicsStillBlocked: bankAnalysis.proposedCommand === null
                    && bankAnalysis.commandBlockedReasons.includes('AUTHORITY_NOT_CHECKED'),
                sessionLabOnly: bankSessionResult.session.status === 'SCENARIO_LAB_ONLY'
                    && bankSessionResult.session.candidate.kind === 'SCENARIO_LAB_RECORD'
                    && bankSessionResult.session.candidate.executable === false,
                uiHonest: bankModalText.includes('MEKANİK ADAPTÖR')
                    && bankModalText.includes('banka, mevduat, ödeme'),
                ledgerValid: runtime.api.conversationSessionValidate(
                    runtime.api.conversationSessionSnapshot()).ok,
                worldNeutral: beforeBankHash === afterBankHash
            },
            prisoner: {
                validates: runtime.api.conversationValidate(prisonerAnalysis).ok,
                prisonerAct: prisonerAnalysis.speechAct === 'PROPOSE_PRISONER_EXCHANGE',
                knownReportBound: detentionEntity
                    && detentionEntity.entityId === 'actor-belief:detention-report-fixture',
                intentBound: prisonerAnalysis.playerIntent === 'NEGOTIATE_PRISONER_EXCHANGE'
                    && prisonerAnalysis.topic === 'DETENTION_DIPLOMACY',
                requestBound: prisonerAnalysis.requests.length === 1
                    && prisonerAnalysis.requests[0].type === 'DRAFT_PRISONER_EXCHANGE'
                    && prisonerAnalysis.requests[0].detentionReportId === 'actor-belief:detention-report-fixture',
                requiredChecksPresent: ['detainee_roster', 'identity_and_health_verification',
                    'detainee_secret_exposure', 'counterparty_information_access',
                    'public_and_family_pressure', 'prior_exchange_compliance',
                    'exchange_site_security', 'neutral_observer', 'diplomatic_apology',
                    'search_and_rescue_followup', 'required_approval']
                    .every(term => prisonerAnalysis.unresolvedTerms.includes(term)),
                mechanicsStillBlocked: prisonerAnalysis.proposedCommand === null
                    && prisonerAnalysis.commandBlockedReasons.includes('AUTHORITY_NOT_CHECKED'),
                sessionLabOnly: prisonerSessionResult.session.status === 'SCENARIO_LAB_ONLY'
                    && prisonerSessionResult.session.candidate.kind === 'SCENARIO_LAB_RECORD'
                    && prisonerSessionResult.session.candidate.executable === false,
                uiHonest: prisonerModalText.includes('MEKANİK ADAPTÖR')
                    && prisonerModalText.includes('esir, takas'),
                ledgerValid: runtime.api.conversationSessionValidate(
                    runtime.api.conversationSessionSnapshot()).ok,
                worldNeutral: beforePrisonerHash === afterPrisonerHash
            },
            pipeline: {
                validates: runtime.api.conversationValidate(pipelineAnalysis).ok,
                inquiryAct: pipelineAnalysis.speechAct === 'PROPOSE_PIPELINE_INQUIRY',
                realEnergyCorridorAvailable: !!energyCorridor,
                knownCorridorBound: !!energyCorridor && corridorEntity
                    && corridorEntity.entityId === energyCorridor.id,
                knownIncidentBeliefBound: pipelineIncidentEntity
                    && pipelineIncidentEntity.entityId === 'actor-belief:pipeline-incident-fixture',
                intentBound: pipelineAnalysis.playerIntent === 'NEGOTIATE_PIPELINE_INQUIRY'
                    && pipelineAnalysis.topic === 'ENERGY_SECURITY',
                requestBound: pipelineAnalysis.requests.length === 1
                    && pipelineAnalysis.requests[0].type === 'DRAFT_JOINT_PIPELINE_INQUIRY'
                    && pipelineAnalysis.requests[0].corridorId === energyCorridor.id
                    && pipelineAnalysis.requests[0].incidentReportId
                        === 'actor-belief:pipeline-incident-fixture',
                requiredChecksPresent: ['pipeline_incident_status', 'cause_evidence',
                    'detection_and_attribution', 'record_sensitivity', 'sensor_window',
                    'energy_dependence', 'media_narrative', 'border_security_protocol',
                    'neutral_experts', 'joint_report_release', 'smuggling_case_integrity',
                    'required_approval'].every(term => pipelineAnalysis.unresolvedTerms.includes(term)),
                mechanicsStillBlocked: pipelineAnalysis.proposedCommand === null
                    && pipelineAnalysis.commandBlockedReasons.includes('AUTHORITY_NOT_CHECKED'),
                sessionLabOnly: pipelineSessionResult.session.status === 'SCENARIO_LAB_ONLY'
                    && pipelineSessionResult.session.candidate.kind === 'SCENARIO_LAB_RECORD'
                    && pipelineSessionResult.session.candidate.executable === false,
                uiHonest: pipelineModalText.includes('MEKANİK ADAPTÖR')
                    && pipelineModalText.includes('boru hattı, soruşturma, enerji değişmedi'),
                ledgerValid: runtime.api.conversationSessionValidate(
                    runtime.api.conversationSessionSnapshot()).ok,
                worldNeutral: beforePipelineHash === afterPipelineHash
            },
            coup: {
                validates: runtime.api.conversationValidate(coupAnalysis).ok,
                crisisAct: coupAnalysis.speechAct === 'PROPOSE_SUCCESSION_CRISIS_RESPONSE',
                realPoliticalCrisisAvailable: !!activeCrisis,
                knownCrisisBound: !!activeCrisis && politicalCrisisEntity
                    && politicalCrisisEntity.entityId === activeCrisis.id,
                knownRumorBeliefBound: coupRumorEntity
                    && coupRumorEntity.entityId === 'actor-belief:coup-rumor-fixture',
                intentBound: coupAnalysis.playerIntent === 'NEGOTIATE_SUCCESSION_CRISIS'
                    && coupAnalysis.topic === 'POLITICAL_SUCCESSION',
                requestBound: coupAnalysis.requests.length === 1 && !!activeCrisis
                    && coupAnalysis.requests[0].type === 'DRAFT_SUCCESSION_CRISIS_RESPONSE'
                    && coupAnalysis.requests[0].politicalCrisisId === activeCrisis.id
                    && coupAnalysis.requests[0].coupRumorReportId === 'actor-belief:coup-rumor-fixture',
                requiredChecksPresent: ['leader_condition', 'command_loyalty_distribution',
                    'appointment_authority', 'constitutional_succession_path',
                    'emergency_signature_chain', 'coup_evidence', 'plotter_and_rival_identity',
                    'disinformation_capability', 'promise_integrity', 'crisis_stage',
                    'required_approval'].every(term => coupAnalysis.unresolvedTerms.includes(term)),
                mechanicsStillBlocked: coupAnalysis.proposedCommand === null
                    && coupAnalysis.commandBlockedReasons.includes('AUTHORITY_NOT_CHECKED'),
                sessionLabOnly: coupSessionResult.session.status === 'SCENARIO_LAB_ONLY'
                    && coupSessionResult.session.candidate.kind === 'SCENARIO_LAB_RECORD'
                    && coupSessionResult.session.candidate.executable === false,
                uiHonest: coupModalText.includes('MEKANİK ADAPTÖR')
                    && coupModalText.includes('darbe, makam, ordu değişmedi'),
                ledgerValid: runtime.api.conversationSessionValidate(
                    runtime.api.conversationSessionSnapshot()).ok,
                worldNeutral: beforeCoupHash === afterCoupHash
            }
        };
    } finally {
        runtime.dom.window.close();
    }
    const catalog = dialogueScenarioLab.dialogueScenarioCatalog();
    return {
        schemaVersion: dialogueScenarioLab.SCHEMA_VERSION,
        catalog,
        catalogComplete: catalog.length === 11 && new Set(catalog.map(row => row.id)).size === 11,
        contractsHaveThreeBranches: catalog.every(row => row.branches.length >= 3),
        labExecutableScenarios: catalog.filter(row => row.adapterStatus === 'LAB_EXECUTABLE').map(row => row.id),
        rows,
        allExpected: rows.every(row => row.result.responseCode === row.expectedResponse
            && row.result.mechanicalGate === row.expectedGate),
        allDeterministic: rows.every(row => row.deterministic),
        allValidated: rows.every(row => row.validation.ok),
        allNonExecutable: rows.every(row => row.result.executable === false
            && row.result.worldMutation === false && row.result.integrationStatus === 'FIXTURE_ONLY'),
        knowledgeTruthSeparated: rows.find(row => row.caseId === 'compensated-active').result.responseCode
            === rows.find(row => row.caseId === 'believed-but-missing').result.responseCode
            && rows.find(row => row.caseId === 'compensated-active').result.mechanicalGate
                !== rows.find(row => row.caseId === 'believed-but-missing').result.mechanicalGate,
        sameTextDifferentiates: new Set(rows.slice(0, 5).map(row => row.result.responseCode)).size === 4,
        invalidInputRejected: invalid.ok === false && invalid.code === 'INVALID_SCENARIO_INPUT'
            && invalid.issues.includes('UNKNOWN_FIELD:hiddenWorldOverride')
            && invalid.executable === false && invalid.worldMutation === false,
        strikeRows,
        strikeAllExpected: strikeRows.every(row => row.result.responseCode === row.expectedResponse
            && row.result.mechanicalGate === row.expectedGate),
        strikeAllDeterministic: strikeRows.every(row => row.deterministic),
        strikeAllValidated: strikeRows.every(row => row.validation.ok),
        strikeAllNonExecutable: strikeRows.every(row => row.result.executable === false
            && row.result.worldMutation === false && row.result.wageModelActive === false
            && row.result.leaderCannotEndStrikeAlone === true),
        strikeKnowledgeTruthSeparated: strikeRows.find(row => row.caseId === 'staged-ready').result.responseCode
            === strikeRows.find(row => row.caseId === 'believed-but-resolved').result.responseCode
            && strikeRows.find(row => row.caseId === 'staged-ready').result.mechanicalGate
                !== strikeRows.find(row => row.caseId === 'believed-but-resolved').result.mechanicalGate,
        strikeSameTextDifferentiates: new Set(strikeRows.slice(0, 7).map(row => row.result.responseCode)).size === 6,
        invalidStrikeRejected: invalidStrike.ok === false && invalidStrike.code === 'INVALID_SCENARIO_INPUT'
            && invalidStrike.issues.includes('UNKNOWN_FIELD:wageModelActive'),
        tenderRows,
        tenderAllExpected: tenderRows.every(row => row.result.responseCode === row.expectedResponse
            && row.result.mechanicalGate === row.expectedGate),
        tenderAllDeterministic: tenderRows.every(row => row.deterministic),
        tenderAllValidated: tenderRows.every(row => row.validation.ok),
        tenderAllNonExecutable: tenderRows.every(row => row.result.executable === false
            && row.result.worldMutation === false && row.result.namedJournalistAvailable === false
            && row.result.mediaOwnershipModelActive === false
            && row.result.integrityEvidenceLedgerAvailable === true),
        tenderKnowledgeTruthSeparated: tenderRows.find(row => row.caseId === 'inquiry-authentic').result.responseCode
            === tenderRows.find(row => row.caseId === 'believed-authentic-tampered').result.responseCode
            && tenderRows.find(row => row.caseId === 'inquiry-authentic').result.mechanicalGate
                !== tenderRows.find(row => row.caseId === 'believed-authentic-tampered').result.mechanicalGate,
        tenderSameTextDifferentiates: new Set(tenderRows.slice(0, 8).map(row => row.result.responseCode)).size === 6,
        invalidTenderRejected: invalidTender.ok === false && invalidTender.code === 'INVALID_SCENARIO_INPUT'
            && invalidTender.issues.includes('UNKNOWN_FIELD:namedJournalistAvailable'),
        mobilizationRows,
        mobilizationAllExpected: mobilizationRows.every(row => row.result.responseCode === row.expectedResponse
            && row.result.mechanicalGate === row.expectedGate),
        mobilizationAllDeterministic: mobilizationRows.every(row => row.deterministic),
        mobilizationAllValidated: mobilizationRows.every(row => row.validation.ok),
        mobilizationAllNonExecutable: mobilizationRows.every(row => row.result.executable === false
            && row.result.worldMutation === false && row.result.intelligenceActorsAvailable === true
            && row.result.strategicReportSystemActive === false
            && row.result.mobilizationDoctrineActive === false),
        mobilizationKnowledgeTruthSeparated: mobilizationRows.find(row => row.caseId === 'limited-ready').result.responseCode
            === mobilizationRows.find(row => row.caseId === 'believed-invasion-exercise').result.responseCode
            && mobilizationRows.find(row => row.caseId === 'limited-ready').result.mechanicalGate
                !== mobilizationRows.find(row => row.caseId === 'believed-invasion-exercise').result.mechanicalGate,
        mobilizationSameTextDifferentiates: new Set(mobilizationRows.slice(0, 9)
            .map(row => row.result.responseCode)).size === 6,
        invalidMobilizationRejected: invalidMobilization.ok === false
            && invalidMobilization.code === 'INVALID_SCENARIO_INPUT'
            && invalidMobilization.issues.includes('UNKNOWN_FIELD:mobilizationDoctrineActive'),
        sanctionsRows,
        sanctionsAllExpected: sanctionsRows.every(row => row.result.responseCode === row.expectedResponse
            && row.result.mechanicalGate === row.expectedGate),
        sanctionsAllDeterministic: sanctionsRows.every(row => row.deterministic),
        sanctionsAllValidated: sanctionsRows.every(row => row.validation.ok),
        sanctionsAllNonExecutable: sanctionsRows.every(row => row.result.executable === false
            && row.result.worldMutation === false && row.result.companiesAvailable === true
            && row.result.tradeEscrowAvailable === true && row.result.intelligenceActorsAvailable === true
            && row.result.sanctionsRegimeActive === false
            && row.result.beneficialOwnershipRegistryActive === false
            && row.result.amlScreeningActive === false),
        sanctionsKnowledgeTruthSeparated: sanctionsRows.find(row => row.caseId === 'trial-escrow').result.responseCode
            === sanctionsRows.find(row => row.caseId === 'believed-active-expired').result.responseCode
            && sanctionsRows.find(row => row.caseId === 'trial-escrow').result.mechanicalGate
                !== sanctionsRows.find(row => row.caseId === 'believed-active-expired').result.mechanicalGate,
        sanctionsSameTextDifferentiates: new Set(sanctionsRows.slice(0, 8)
            .map(row => row.result.responseCode)).size === 7,
        invalidSanctionsRejected: invalidSanctions.ok === false
            && invalidSanctions.code === 'INVALID_SCENARIO_INPUT'
            && invalidSanctions.issues.includes('UNKNOWN_FIELD:sanctionsRegimeActive'),
        refugeeRows,
        refugeeAllExpected: refugeeRows.every(row => row.result.responseCode === row.expectedResponse
            && row.result.mechanicalGate === row.expectedGate),
        refugeeAllDeterministic: refugeeRows.every(row => row.deterministic),
        refugeeAllValidated: refugeeRows.every(row => row.validation.ok),
        refugeeAllNonExecutable: refugeeRows.every(row => row.result.executable === false
            && row.result.worldMutation === false && row.result.humanMigrationLedgerAvailable === true
            && row.result.populationCohortsAvailable === true
            && row.result.receptionCapacityProxyAvailable === true
            && row.result.borderPolicyActive === false && row.result.housingAssetModelActive === false
            && row.result.familyNetworkModelActive === false
            && row.result.internationalAidExecutorActive === false
            && row.result.thirdPartyTransitActive === false),
        refugeeKnowledgeTruthSeparated: refugeeRows.find(row => row.caseId === 'funded-ready').result.responseCode
            === refugeeRows.find(row => row.caseId === 'believed-blocked-completed').result.responseCode
            && refugeeRows.find(row => row.caseId === 'funded-ready').result.mechanicalGate
                !== refugeeRows.find(row => row.caseId === 'believed-blocked-completed').result.mechanicalGate,
        refugeeSameTextDifferentiates: new Set(refugeeRows.slice(0, 11)
            .map(row => row.result.responseCode)).size >= 8,
        invalidRefugeeRejected: invalidRefugee.ok === false
            && invalidRefugee.code === 'INVALID_SCENARIO_INPUT'
            && invalidRefugee.issues.includes('UNKNOWN_FIELD:borderPolicyActive'),
        bankRows,
        bankAllExpected: bankRows.every(row => row.result.responseCode === row.expectedResponse
            && row.result.mechanicalGate === row.expectedGate),
        bankAllDeterministic: bankRows.every(row => row.deterministic),
        bankAllValidated: bankRows.every(row => row.validation.ok),
        bankAllNonExecutable: bankRows.every(row => row.result.executable === false
            && row.result.worldMutation === false && row.result.bankBalanceSheetAvailable === true
            && row.result.companyLoanLedgerAvailable === true && row.result.stateBudgetAvailable === true
            && row.result.integrityCaseLedgerAvailable === true
            && row.result.householdDepositAccountsAvailable === false
            && row.result.systemicRiskModelActive === false
            && row.result.bankResolutionExecutorActive === false
            && row.result.bankGovernanceModelActive === false
            && row.result.depositTransferExecutorActive === false
            && row.result.mediaOwnershipNetworkActive === false),
        bankKnowledgeTruthSeparated: bankRows.find(row => row.caseId === 'dilution-ready').result.responseCode
            === bankRows.find(row => row.caseId === 'believed-stressed-solvent').result.responseCode
            && bankRows.find(row => row.caseId === 'dilution-ready').result.mechanicalGate
                !== bankRows.find(row => row.caseId === 'believed-stressed-solvent').result.mechanicalGate,
        bankSameTextDifferentiates: new Set(bankRows.slice(0, 10)
            .map(row => row.result.responseCode)).size >= 8,
        invalidBankRejected: invalidBank.ok === false
            && invalidBank.code === 'INVALID_SCENARIO_INPUT'
            && invalidBank.issues.includes('UNKNOWN_FIELD:bankResolutionExecutorActive'),
        prisonerRows,
        prisonerAllExpected: prisonerRows.every(row => row.result.responseCode === row.expectedResponse
            && row.result.mechanicalGate === row.expectedGate),
        prisonerAllDeterministic: prisonerRows.every(row => row.deterministic),
        prisonerAllValidated: prisonerRows.every(row => row.validation.ok),
        prisonerAllNonExecutable: prisonerRows.every(row => row.result.executable === false
            && row.result.worldMutation === false && row.result.namedMilitaryCharactersAvailable === true
            && row.result.actorBeliefLedgerAvailable === true && row.result.publicOpinionAvailable === true
            && row.result.diplomacyStateAvailable === true && row.result.prisonerLedgerActive === false
            && row.result.custodyHealthRecordsActive === false
            && row.result.detaineeSecretModelActive === false
            && row.result.neutralObserverSystemActive === false
            && row.result.exchangeExecutorActive === false
            && row.result.searchRescueMissionActive === false
            && row.result.propagandaIncidentLedgerActive === false),
        prisonerKnowledgeTruthSeparated: prisonerRows.find(row => row.caseId === 'staged-ready').result.responseCode
            === prisonerRows.find(row => row.caseId === 'believed-listed-missing').result.responseCode
            && prisonerRows.find(row => row.caseId === 'staged-ready').result.mechanicalGate
                !== prisonerRows.find(row => row.caseId === 'believed-listed-missing').result.mechanicalGate,
        prisonerSameTextDifferentiates: new Set(prisonerRows.slice(0, 9)
            .map(row => row.result.responseCode)).size >= 7,
        invalidPrisonerRejected: invalidPrisoner.ok === false
            && invalidPrisoner.code === 'INVALID_SCENARIO_INPUT'
            && invalidPrisoner.issues.includes('UNKNOWN_FIELD:prisonerLedgerActive'),
        pipelineRows,
        pipelineAllExpected: pipelineRows.every(row => row.result.responseCode === row.expectedResponse
            && row.result.mechanicalGate === row.expectedGate),
        pipelineAllDeterministic: pipelineRows.every(row => row.deterministic),
        pipelineAllValidated: pipelineRows.every(row => row.validation.ok),
        pipelineAllNonExecutable: pipelineRows.every(row => row.result.executable === false
            && row.result.worldMutation === false && row.result.infrastructureCorridorAvailable === true
            && row.result.sabotageReceiptAvailable === true
            && row.result.detectionAttributionAvailable === true
            && row.result.actorBeliefLedgerAvailable === true
            && row.result.integrityEvidenceLedgerAvailable === true
            && row.result.jointTechnicalInquiryActive === false
            && row.result.pipelineCauseLedgerActive === false
            && row.result.sensorPatrolRecordSystemActive === false
            && row.result.neutralExpertSystemActive === false
            && row.result.jointReportReleaseExecutorActive === false
            && row.result.mediaAccusationAdapterActive === false
            && row.result.borderSecurityProtocolActive === false
            && row.result.smugglingCaseRedactionExecutorActive === false),
        pipelineKnowledgeTruthSeparated: pipelineRows.find(row => row.caseId === 'limited-ready').result.responseCode
            === pipelineRows.find(row => row.caseId === 'believed-sabotage-accident').result.responseCode
            && pipelineRows.find(row => row.caseId === 'limited-ready').result.mechanicalGate
                !== pipelineRows.find(row => row.caseId === 'believed-sabotage-accident').result.mechanicalGate,
        pipelineSameTextDifferentiates: new Set(pipelineRows.slice(0, 14)
            .map(row => row.result.responseCode)).size >= 8,
        invalidPipelineRejected: invalidPipeline.ok === false
            && invalidPipeline.code === 'INVALID_SCENARIO_INPUT'
            && invalidPipeline.issues.includes('UNKNOWN_FIELD:jointTechnicalInquiryActive'),
        coupRows,
        coupAllExpected: coupRows.every(row => row.result.responseCode === row.expectedResponse
            && row.result.mechanicalGate === row.expectedGate),
        coupAllDeterministic: coupRows.every(row => row.deterministic),
        coupAllValidated: coupRows.every(row => row.validation.ok),
        coupAllNonExecutable: coupRows.every(row => row.result.executable === false
            && row.result.worldMutation === false && row.result.politicalCrisisLedgerAvailable === true
            && row.result.namedCommanderLoyaltyAvailable === true
            && row.result.institutionAuthorityLedgerAvailable === true
            && row.result.resignationSuccessionExecutorAvailable === true
            && row.result.actorBeliefLedgerAvailable === true
            && row.result.leaderHealthRecordActive === false
            && row.result.emergencySuccessionAdapterActive === false
            && row.result.appointmentPromiseExecutorActive === false
            && row.result.coupDisinformationOperationActive === false
            && row.result.commandNeutralityOrderActive === false),
        coupKnowledgeTruthSeparated: coupRows.find(row => row.caseId === 'transition-ready').result.responseCode
            === coupRows.find(row => row.caseId === 'crisis-none').result.responseCode
            && coupRows.find(row => row.caseId === 'transition-ready').result.mechanicalGate
                !== coupRows.find(row => row.caseId === 'crisis-none').result.mechanicalGate,
        coupSameTextDifferentiates: new Set(coupRows.slice(0, 14)
            .map(row => row.result.responseCode)).size >= 9,
        invalidCoupRejected: invalidCoup.ok === false
            && invalidCoup.code === 'INVALID_SCENARIO_INPUT'
            && invalidCoup.issues.includes('UNKNOWN_FIELD:leaderHealthRecordActive'),
        understanding
    };
}

function probeConversationRuntime385(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let savedRaw;
    let snapshot;
    let result;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = runtime.api.state();
        const beforeWorld = hashSnapshot(stateSnapshot(story));
        const actors = runtime.api.contactDirectoryBuild().publicCharacters;
        const listener = actors[0];
        const outsider = actors.find(row => row.id !== listener.id);
        const playerActorId = `character:0:${story.commander.id}`;
        const opened = runtime.api.conversationSessionBegin('Merhaba', { listenerActorId: listener.id });
        const followUps = [];
        for (let index = 0; index < 23; index++) {
            followUps.push(runtime.api.conversationSessionFollowUp(
                opened.session.id, index % 2 ? 'Bugün nasılsın?' : 'Merhaba, konuşmaya devam edelim.'
            ));
        }
        const blocked = runtime.api.conversationSessionFollowUp(opened.session.id, 'Bu tur tavanı aşmalı.');
        const fullSession = runtime.api.conversationSessionGet(opened.session.id);
        const history = runtime.api.conversationDiscourseContext(fullSession);
        const historyTokens = history.reduce((sum, row) => sum
            + runtime.api.conversationDiscourseTokenEstimate(row.text) + 6, 0);
        const last = fullSession.followUps[fullSession.followUps.length - 1];
        const generationHistory = runtime.api.conversationDiscourseContext(fullSession, {
            excludeFollowUpId: last.id, excludeResponseId: last.response.id
        });
        runtime.api.characterMemoryAddRecent(listener.id, {
            id: 'memory:phase385:owned', kind: 'PROMISE',
            summary: 'Önceki tedarik görüşmesine yeniden dönülecek.',
            importanceBps: 9000, relatedActorIds: [playerActorId], source: { eventId: 'event:phase385:owned' }
        });
        runtime.api.characterMemoryAddRecent(outsider.id, {
            id: 'memory:phase385:foreign', kind: 'SECRET',
            summary: 'PHASE385_FOREIGN_SECRET', importanceBps: 9900,
            relatedActorIds: [playerActorId], source: { eventId: 'event:phase385:foreign' }
        });
        const memorySession = runtime.api.conversationSessionBegin('Merhaba', { listenerActorId: listener.id });
        const recalled = runtime.api.conversationSessionFollowUp(
            memorySession.session.id, 'Daha önce verdiğin sözü hatırlıyor musun, ne oldu?'
        );
        const memoryResponse = recalled.followUp.response;
        snapshot = runtime.api.conversationSessionSnapshot();
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        result = {
            allFollowUpsAccepted: followUps.every(row => row && row.ok),
            turnLimitBlocked: blocked && blocked.ok === false && blocked.code === 'TURN_LIMIT',
            followUpCount: fullSession.followUps.length,
            historyRows: history.length,
            historyTokens,
            historyBudget: runtime.api.conversationHistoryTokenBudget(),
            currentTurnExcluded: !generationHistory.some(row =>
                row.text === last.playerText || row.text === last.response.text),
            memorySource: memoryResponse.source,
            memoryOwnVisible: memoryResponse.text.includes('Önceki tedarik görüşmesine'),
            memoryForeignHidden: !memoryResponse.text.includes('PHASE385_FOREIGN_SECRET')
                && !(memoryResponse.memoryRecall.records || []).some(row => row.kind === 'SECRET'),
            memoryRawWorldRead: memoryResponse.rawWorldRead,
            validation: runtime.api.conversationSessionValidate(snapshot),
            worldNeutral: beforeWorld === hashSnapshot(stateSnapshot(story))
        };
    } finally {
        runtime.dom.window.close();
    }
    const restoredRuntime = createRuntime(seed >>> 0);
    try {
        restoredRuntime.api.putSavedRaw(savedRaw);
        result.restored = {
            loaded: restoredRuntime.api.loadNow(),
            exact: JSON.stringify(restoredRuntime.api.conversationSessionSnapshot()) === JSON.stringify(snapshot),
            validation: restoredRuntime.api.conversationSessionValidate(
                restoredRuntime.api.conversationSessionSnapshot()
            )
        };
    } finally {
        restoredRuntime.dom.window.close();
    }
    return result;
}

function probeDecisionTraceV2(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let savedRaw;
    let actionSnapshot;
    let result;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = runtime.api.state();
        const identityLedger = runtime.api.characterIdentityLedger();
        const liveIdentityLedger = story.characterIdentities;
        const playerActorId = `character:0:${story.commander.id}`;
        const nonPlayerActors = Object.values(identityLedger.identities || {})
            .filter(row => row.id !== playerActorId);
        const actor = nonPlayerActors.find(row => runtime.api.characterActionAIRankActor(row.id)
            .some(candidate => candidate.candidate.targetActorId === playerActorId))
            || nonPlayerActors.find(row => runtime.api.characterActionAIRankActor(row.id).length > 0);
        const ranked = actor ? runtime.api.characterActionAIRankActor(actor.id) : [];
        const eventFactId = 'world-fact:phase386:event-fixture';
        const eventBeliefId = 'actor-belief:phase386:event-fixture';
        liveIdentityLedger.worldFacts[eventFactId] = {
            id: eventFactId, factType: 'TEST_EVENT_OBSERVATION',
            subjectActorId: playerActorId, countryId: actor.countryId,
            originEventId: 'event:phase386:fixture', visibility: 'INSTITUTIONAL', version: 1
        };
        liveIdentityLedger.actorBeliefs[eventBeliefId] = {
            id: eventBeliefId, holderActorId: actor.id, holderCountryId: actor.countryId,
            worldFactId: eventFactId, subjectActorId: playerActorId,
            beliefStatus: 'VERIFIED', confidenceBps: 9000,
            source: { type: 'INSTITUTIONAL_RECORD', eventId: 'event:phase386:fixture' },
            learnedAt: Number(story.clock) || 0, originEventId: 'event:phase386:fixture', version: 1
        };
        const contextA = runtime.api.decisionContextBuild(actor && actor.id, ranked);
        const eventBelief = contextA.actorBeliefs.find(row => row.beliefId === eventBeliefId);
        const eventContext = runtime.api.decisionContextBuild(actor.id, ranked, {
            trigger: {
                type: 'EVENT_REACTION', eventId: 'event:phase386:fixture',
                beliefEvidenceIds: [eventBelief.beliefId], reasonCodes: ['SOURCE_EVENT_OBSERVED']
            }
        });
        const forgedEventContext = runtime.api.decisionContextBuild(actor.id, ranked, {
            trigger: {
                type: 'EVENT_REACTION', eventId: 'event:phase386:forged',
                beliefEvidenceIds: ['actor-belief:not-held']
            }
        });
        const hiddenFactId = 'world-fact:phase386:hidden';
        identityLedger.worldFacts[hiddenFactId] = {
            id: hiddenFactId, factType: 'TEST_HIDDEN', visibility: 'SECRET', version: 1
        };
        const contextB = runtime.api.decisionContextBuild(actor && actor.id, ranked);
        const selected = contextA && (contextA.candidates.find(row => row.allowed
            && row.targetActorId === playerActorId) || contextA.candidates.find(row => row.allowed));
        const trace = runtime.api.decisionTraceBuild('decision:phase386:fixture', contextA, {
            verdict: selected ? 'PROPOSE' : 'PASS',
            candidateId: selected && selected.candidateId,
            source: 'DETERMINISTIC_FALLBACK',
            reasonCode: selected ? 'GOAL_ALIGNMENT' : 'INSUFFICIENT_VALUE'
        });
        const invalidTrace = runtime.api.decisionTraceBuild('decision:phase386:invalid', contextA, {
            verdict: 'PROPOSE', candidateId: 'candidate:not-offered', source: 'DETERMINISTIC_FALLBACK'
        });
        const pending = {
            requestId: 'phase386-request', contextHash: contextA.contextHash,
            actorId: actor.id, createdAt: Number(story.clock) || 0,
            createdAtTick: 1, decisionContext: contextA
        };
        const recorded = runtime.api.characterActionArbiterDecisionRecord(pending, {
            source: 'DETERMINISTIC_FALLBACK', status: 'FALLBACK',
            verdict: selected ? 'PROPOSE' : 'PASS',
            candidateId: selected && selected.candidateId,
            actionType: selected && selected.actionType,
            targetActorId: selected && selected.targetActorId,
            fallbackReason: 'PHASE386_PROBE'
        });
        actionSnapshot = runtime.api.characterActionLedger();
        const recordedTrace = actionSnapshot.decisionTraces[recorded.decisionTraceId];
        const playerView = runtime.api.decisionTracePlayerView(recorded.decisionTraceId, playerActorId);
        const playerExplanation = runtime.api.decisionTracePlayerExplanation(
            recorded.decisionTraceId, playerActorId
        );
        const actorView = runtime.api.decisionTracePlayerView(recorded.decisionTraceId, actor.id);
        const inboxRow = runtime.api.characterSpeechPlayerInbox(12)
            .find(row => row.decisionId === recorded.id);
        story._talkOpen = true;
        story._talkView = 'chat';
        runtime.api.talkUpdate();
        const talkHtml = runtime.dom.window.document.getElementById('talk-body').innerHTML;
        const repeatedTrace = runtime.api.decisionTraceBuild('decision:phase386:fixture', contextA, {
            verdict: selected ? 'PROPOSE' : 'PASS',
            candidateId: selected && selected.candidateId,
            source: 'DETERMINISTIC_FALLBACK',
            reasonCode: selected ? 'GOAL_ALIGNMENT' : 'INSUFFICIENT_VALUE'
        });
        runtime.api.saveNow();
        savedRaw = runtime.api.savedRaw();
        result = {
            contextCreated: !!contextA,
            hiddenWorldFactIgnored: contextA.contextHash === contextB.contextHash
                && !JSON.stringify(contextB).includes(hiddenFactId),
            rawWorldFactRead: contextA.rawWorldFactRead,
            offeredCandidateSelected: !!trace && trace.selectedCandidateId === selected.candidateId,
            nonCandidateRejected: invalidTrace === null,
            majorTraceAttached: !['MAJOR', 'WORLD'].includes(recordedTrace.importance)
                || (!!recorded.decisionTraceId && !!recorded.decisionContextId),
            sourceBeliefRefsOnly: contextA.actorBeliefs.every(row => row.beliefId && row.worldFactId
                && !Object.prototype.hasOwnProperty.call(row, 'factValue')
                && !Object.prototype.hasOwnProperty.call(row, 'questionText')
                && !Object.prototype.hasOwnProperty.call(row, 'optionText')),
            triggerRecorded: contextA.trigger.type === 'AUTONOMOUS_REVIEW'
                && contextA.trigger.source === 'CHARACTER_ACTION_AI_TICK',
            eventTriggerSourced: !!eventBelief && !!eventContext
                && eventContext.trigger.type === 'EVENT_REACTION'
                && eventContext.trigger.beliefEvidenceIds[0] === eventBelief.beliefId,
            forgedEventTriggerRejected: forgedEventContext === null,
            roleOrganizationBoundaryRecorded: contextA.roleOrganizationBoundary.role === actor.role
                && contextA.roleOrganizationBoundary.countryId === actor.countryId
                && contextA.roleOrganizationBoundary.legalModel === 'ACTION_AUTHORITY_CONTRACT_ONLY'
                && contextA.roleOrganizationBoundary.inventedLegalAuthority === false,
            authorityGrantsSourced: contextA.candidates.every(row => Array.isArray(row.authority.grants)),
            allFilterGatesRecorded: contextA.candidates.every(row => {
                const gates = new Set((row.filterEvidence || []).map(item => item.gateId));
                return ['TARGET', 'AUTHORITY', 'DOMAIN', 'COST', 'COOLDOWN', 'EXECUTOR']
                    .every(gate => gates.has(gate));
            }),
            playerProjection: playerView,
            playerExplanationSafe: !!playerExplanation
                && playerExplanation.rawWorldFactRead === false
                && !JSON.stringify(playerExplanation).includes(hiddenFactId)
                && !JSON.stringify(playerExplanation).includes('scoreDelta')
                && !JSON.stringify(playerExplanation).includes('trustBps')
                && !JSON.stringify(playerExplanation).includes('hostilityBps')
                && playerExplanation.hiddenReasonCount === playerView.hiddenBeliefEvidenceCount
                    + playerView.privateReasonCount,
            inboxExplanationConnected: selected.targetActorId !== playerActorId
                || (!!inboxRow && !!inboxRow.explanation
                    && inboxRow.explanation.decisionId === recorded.id
                    && inboxRow.explanation.rawWorldFactRead === false),
            explanationDomSafe: selected.targetActorId !== playerActorId
                || (talkHtml.includes('NEDEN BÖYLE KARAR VERDİ?')
                    && !talkHtml.includes(hiddenFactId)
                    && !talkHtml.includes('scoreDelta')
                    && !talkHtml.includes('trustBps')
                    && !talkHtml.includes('hostilityBps')),
            playerPrivateReasonsHidden: playerView.supportingReasons.length === 0
                && playerView.opposingReasons.length === 0
                && playerView.authority === null && playerView.cost === null
                && playerView.psychologyContributions === null && playerView.risk === null
                && playerView.privateReasonCount > 0,
            actorPrivateReasonsVisible: !!actorView.psychologyContributions && !!actorView.risk,
            psychologyNoDoubleCount: recordedTrace.psychologyContributions.addedScoreDelta === 0
                && recordedTrace.psychologyContributions.doubleCountPrevented === true
                && recordedTrace.psychologyContributions.contributionModel
                    === 'EXISTING_SELECTOR_REASONS_ONLY',
            psychologyReasonsSourced: recordedTrace.psychologyContributions.axes
                .concat(recordedTrace.psychologyContributions.goals)
                .every(row => recordedTrace.supportingReasons.includes(row.sourceReason)),
            riskExplanationOnly: recordedTrace.risk.explanationOnly === true
                && recordedTrace.risk.scoreEffect === 0
                && recordedTrace.risk.totalRiskBps >= 0
                && recordedTrace.risk.totalRiskBps <= 10000
                && recordedTrace.risk.components.length === 4,
            repeatedTraceDeterministic: JSON.stringify(repeatedTrace) === JSON.stringify(trace),
            validation: runtime.api.validateCharacterActionLedger(actionSnapshot),
            identityValidation: runtime.api.validateCharacterIdentityLedger(liveIdentityLedger),
            traceValidation: runtime.api.decisionTraceValidate(
                actionSnapshot.decisionContexts, actionSnapshot.decisionTraces,
                actionSnapshot.arbiterDecisions
            )
        };
    } finally {
        runtime.dom.window.close();
    }
    const restored = createRuntime(seed >>> 0);
    try {
        restored.api.putSavedRaw(savedRaw);
        result.restored = {
            loaded: restored.api.loadNow(),
            exact: JSON.stringify(restored.api.characterActionLedger()) === JSON.stringify(actionSnapshot),
            validation: restored.api.validateCharacterActionLedger(restored.api.characterActionLedger())
        };
    } finally {
        restored.dom.window.close();
    }
    const legacy = createRuntime(seed >>> 0);
    try {
        const payload = JSON.parse(savedRaw);
        payload.characterActions.schemaVersion = 8;
        payload.characterActions.adapterVersion = 'story-character-action-ledger-8';
        delete payload.characterActions.decisionContexts;
        delete payload.characterActions.decisionTraces;
        const legacyDecision = Object.values(payload.characterActions.arbiterDecisions || {})[0];
        if (legacyDecision) {
            legacyDecision.actionType = 'NEGOTIATE';
            delete legacyDecision.decisionContextId;
            delete legacyDecision.decisionTraceId;
            delete legacyDecision.tracePolicy;
        }
        legacy.api.putSavedRaw(JSON.stringify(payload));
        const loaded = legacy.api.loadNow();
        const ledger = legacy.api.characterActionLedger();
        const migratedDecision = Object.values(ledger.arbiterDecisions || {})[0];
        result.legacySchema8 = {
            loaded,
            preserved: !!migratedDecision && migratedDecision.actionType === 'NEGOTIATE'
                && migratedDecision.tracePolicy === 'LEGACY_UNAVAILABLE',
            validation: legacy.api.validateCharacterActionLedger(ledger)
        };
    } finally {
        legacy.dom.window.close();
    }
    return result;
}

function probeConversationUnderstanding(seed = 2032) {
    const input = 'Ben bir şirket kuracağım, çelik sanayisi üzerine. Senin de İngiltere’den çelik siparişi verdiğini biliyorum. Bu çelikleri benim depolarıma yönlendirelim.';
    const typoInput = 'ben celik sirketi kurcam, senin ingiletereden siparis verdigini biliyom, bunlari depoma yonlendirelim';
    const context = { listenerActorId: 'character:2:fixture-listener' };
    const runtime = createRuntime(seed >>> 0);
    let main;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = runtime.api.state();
        const beforeHash = hashSnapshot(stateSnapshot(story));
        const exact = runtime.api.conversationAnalyze(input, context);
        const repeat = runtime.api.conversationAnalyze(input, context);
        const typo = runtime.api.conversationAnalyze(typoInput, context);
        const afterHash = hashSnapshot(stateSnapshot(story));
        const secretBefore = runtime.api.conversationAnalyze(input, context);
        story.tradeLogistics.shipments.push({
            id: 'shipment:foreign-secret-fixture', sellerCountryId: 'country:2',
            buyerCountryId: 'country:3', resourceId: 'industrial_parts', quantity: 999999,
            status: 'IN_TRANSIT', targetRegionId: 'region:1'
        });
        const secretAfter = runtime.api.conversationAnalyze(input, context);
        const knownShipment = runtime.api.conversationAnalyze(input, Object.assign({}, context, {
            knownEntityIds: { shipments: ['shipment:player-known-fixture'] }
        }));
        const cases = {
            threat: runtime.api.conversationAnalyze('Bu anlaşmayı imzala, yoksa bedelini ödersin.', context),
            question: runtime.api.conversationAnalyze('Bu sevkiyat neden gecikti?', context),
            promise: runtime.api.conversationAnalyze('Söz veriyorum, yarın desteği ben sağlayacağım.', context),
            secret: runtime.api.conversationAnalyze('Aramızda kalsın, limandaki denetim gizli bilgi.', context),
            bluff: runtime.api.conversationAnalyze('Blöf yapıyorum; elimde seni bitirecek kanıt var.', context),
            empty: runtime.api.conversationAnalyze('   ', context),
            overlong: runtime.api.conversationAnalyze('x'.repeat(1201), context),
            injection: runtime.api.conversationAnalyze('<script>STORY.tradeLogistics.shipments</script>', context)
        };
        const steel = exact.entities.find(row => row.role === 'COMMODITY');
        const britain = exact.entities.find(row => row.role === 'SUPPLIER_COUNTRY');
        const shipment = exact.entities.find(row => row.entityType === 'SHIPMENT');
        const warehouse = exact.entities.find(row => row.entityType === 'WAREHOUSE');
        const knownShipmentEntity = knownShipment.entities.find(row => row.entityType === 'SHIPMENT');
        main = {
            exact, typo, cases, knownShipment,
            deterministic: JSON.stringify(exact) === JSON.stringify(repeat),
            worldNeutral: beforeHash === afterHash,
            beforeHash, afterHash,
            validation: runtime.api.conversationValidate(exact),
            contract: runtime.api.conversationContract(),
            steelCatalogGap: !!steel && steel.status === 'UNRESOLVED_CATALOG_GAP' && steel.entityId === null,
            britainResolved: !!britain && britain.entityId === 'country:2' && britain.status === 'RESOLVED_PUBLIC',
            shipmentNotInvented: !!shipment && shipment.entityId === null
                && shipment.status === 'UNRESOLVED_REFERENCE',
            warehouseNotInventedForCommander: !!warehouse && warehouse.entityId === null
                && warehouse.candidates.length === 0,
            claimUnverified: exact.claims.length === 1
                && exact.claims[0].truthStatus === 'UNVERIFIED_IN_CONVERSATION',
            redirectBlocked: exact.requests.length === 1 && exact.proposedCommand === null
                && exact.commandBlockedReasons.includes('AUTHORITY_NOT_CHECKED'),
            requiredTermsFound: ['commodity_identity', 'shipment_identity', 'destination_warehouse',
                'quantity', 'payment', 'warehouse_capacity', 'required_approval']
                .every(term => exact.unresolvedTerms.includes(term)),
            requiresConfirmation: exact.requiresConfirmation && exact.ambiguityLevel === 'HIGH'
                && exact.confirmationQuestions.length >= 3,
            typoBindsSameIntent: typo.speechAct === exact.speechAct
                && typo.playerIntent === exact.playerIntent
                && typo.entities.some(row => row.entityId === 'country:2')
                && typo.entities.some(row => row.status === 'UNRESOLVED_CATALOG_GAP'),
            privateTradeLedgerIgnored: JSON.stringify(secretBefore) === JSON.stringify(secretAfter)
                && secretAfter.diagnostics.rawTradeLedgerRead === false,
            explicitKnownShipmentAccepted: !!knownShipmentEntity
                && knownShipmentEntity.entityId === 'shipment:player-known-fixture'
                && knownShipmentEntity.status === 'KNOWN_CONTEXT_REFERENCE',
            closedActs: {
                threat: cases.threat.speechAct,
                question: cases.question.speechAct,
                promise: cases.promise.speechAct,
                secret: cases.secret.speechAct,
                bluff: cases.bluff.speechAct
            },
            invalidInputsSafe: cases.empty.ok === false && cases.empty.code === 'EMPTY_INPUT'
                && cases.overlong.ok === false && cases.overlong.code === 'INPUT_TOO_LONG'
                && cases.injection.worldMutation === false && cases.injection.proposedCommand === null
                && !JSON.stringify(cases.injection).includes('STORY.tradeLogistics')
        };
    } finally {
        runtime.dom.window.close();
    }

    const companyRuntime = createRuntime((seed + 1) >>> 0);
    let roleResolution;
    let sessionRaw;
    let sessionSnapshot;
    let negotiationSnapshot;
    try {
        companyRuntime.api.newCampaign({ seed: seed + 1, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = companyRuntime.api.state();
        story.commander.creationRole = 'COMPANY_OWNER';
        story.playerRole = 'COMPANY_OWNER';
        const binding = companyRuntime.api.characterBindPlayerRole();
        const contactView = companyRuntime.api.contactDirectoryBuild();
        const uiContact = (contactView.contacts || []).find(row => {
            const actionView = companyRuntime.api.characterActionPlayerView(row.id, {});
            return actionView && (actionView.actions || []).some(action => action.actionType === 'PERSUADE' && action.allowed);
        }) || (contactView.contacts || [])[0] || {
            id: context.listenerActorId, name: 'Britanya Ticaret Yetkilisi', role: 'COMPANY_EXECUTIVE'
        };
        const companyContext = Object.assign({}, context, { listenerActorId: uiContact.id });
        const analysis = companyRuntime.api.conversationAnalyze(
            'Şirketimin depolarına bu sevkiyatı yönlendirelim.', companyContext
        );
        const company = analysis.entities.find(row => row.entityType === 'COMPANY');
        const warehouse = analysis.entities.find(row => row.entityType === 'WAREHOUSE');
        const sessionStart = companyRuntime.api.conversationSessionBegin(input, Object.assign({}, companyContext, {
            knownEntityIds: { shipments: ['shipment:player-known-fixture'] }
        }));
        const sessionId = sessionStart.session.id;
        const byTerm = term => companyRuntime.api.conversationSessionLatest(companyContext.listenerActorId)
            .questions.find(row => row.term === term);
        const invalidOption = companyRuntime.api.conversationSessionReply(
            sessionId, byTerm('commodity_identity').id, 'military_supplies'
        );
        const commodityReply = companyRuntime.api.conversationSessionReply(
            sessionId, byTerm('commodity_identity').id, 'industrial_parts'
        );
        const destinationQuestion = byTerm('destination_warehouse');
        const destinationReply = companyRuntime.api.conversationSessionReply(
            sessionId, destinationQuestion.id, destinationQuestion.options[0].id
        );
        const quantityReply = companyRuntime.api.conversationSessionReply(
            sessionId, byTerm('quantity').id, '100 ton'
        );
        const paymentReply = companyRuntime.api.conversationSessionReply(
            sessionId, byTerm('payment').id, '500 sermaye'
        );
        const durationReply = companyRuntime.api.conversationSessionReply(
            sessionId, byTerm('delivery_schedule').id, '30 gün'
        );
        const worldBeforeDomainReview = hashSnapshot(companyRuntime.api.worldV2());
        const penaltyReply = companyRuntime.api.conversationSessionReply(
            sessionId, byTerm('contract_penalty').id, 'yüzde 10'
        );
        const completedSession = companyRuntime.api.conversationSessionLatest(companyContext.listenerActorId);
        const worldAfterDomainReview = hashSnapshot(companyRuntime.api.worldV2());
        const initialDomainReview = completedSession.domainReview;

        story.tradeLogistics.shipments.push({
            id: 'shipment:player-known-fixture',
            orderId: 'order:conversation-fixture',
            contractId: 'contract:conversation-fixture',
            sellerCountryId: 'country:2',
            buyerCountryId: 'country:0',
            resourceId: 'industrial_parts',
            quantity: 100,
            status: 'DELIVERED',
            sourceRegionId: 'region:2',
            targetRegionId: 'region:0',
            currentRegionId: 'region:0',
            routeRegionIds: ['region:0'],
            corridorIds: [],
            legIndex: 0
        });
        const rawLedgerRereview = companyRuntime.api.conversationSessionReview(sessionId);
        const rawLedgerReview = rawLedgerRereview.review;

        const identityLedger = story.characterIdentities;
        const listenerIdentity = identityLedger.identities[companyContext.listenerActorId];
        const playerActorId = completedSession.playerActorId;
        const playerIdentity = identityLedger.identities[playerActorId];
        const beliefFactId = 'world-fact:conversation-fixture:known-import';
        const playerBeliefId = `actor-belief:conversation-fixture:${String(playerActorId)
            .replace(/[^a-zA-Z0-9_-]/g, '-')}`;
        identityLedger.worldFacts[beliefFactId] = {
            id: beliefFactId,
            factType: 'EXISTING_IMPORT_ORDER',
            subjectActorId: companyContext.listenerActorId,
            countryId: listenerIdentity.countryId,
            buyerActorId: companyContext.listenerActorId,
            supplierCountryId: 'country:2',
            targetShipmentId: 'shipment:player-known-fixture',
            occurredAt: Number(story.clock) || 0,
            originEventId: 'conversation-fixture:known-import',
            visibility: 'PRIVATE',
            version: 1
        };
        identityLedger.actorBeliefs[playerBeliefId] = {
            id: playerBeliefId,
            holderActorId: playerActorId,
            holderCountryId: playerIdentity.countryId,
            worldFactId: beliefFactId,
            subjectActorId: companyContext.listenerActorId,
            beliefStatus: 'VERIFIED',
            confidenceBps: 9200,
            source: { type: 'FIRST_HAND_RECORD', actorId: playerActorId },
            learnedAt: Number(story.clock) || 0,
            originEventId: 'conversation-fixture:known-import',
            version: 1
        };
        const responseOptions = companyRuntime.api.conversationSessionResponseOptions(sessionId);
        const evidenceOption = responseOptions.find(row => row.action === 'PRESENT_EVIDENCE');
        const invalidEvidenceResponse = companyRuntime.api.conversationSessionRespond(
            sessionId, 'present-evidence:actor-belief:not-owned'
        );
        const responseEconomySnapshot = () => hashSnapshot({
            states: story.states,
            companies: story.companyEconomy.companies,
            banks: story.companyEconomy.banks,
            facilities: story.companyEconomy.facilities,
            warehouses: story.companyEconomy.warehouses,
            trade: {
                contracts: story.tradeLogistics.contracts,
                orders: story.tradeLogistics.orders,
                shipments: story.tradeLogistics.shipments,
                amendments: story.tradeLogistics.amendments,
                totals: story.tradeLogistics.totals
            }
        });
        const economyBeforeResponses = responseEconomySnapshot();
        const evidenceResponse = companyRuntime.api.conversationSessionRespond(sessionId, evidenceOption && evidenceOption.id);
        const counterOfferSession = companyRuntime.api.conversationSessionLatest(companyContext.listenerActorId);
        const ledgerBeforeUiRender = hashSnapshot(companyRuntime.api.conversationSessionSnapshot());

        story._talkOpen = true;
        story._talkFocusCharacterId = companyContext.listenerActorId;
        story._talkFocusCharacterName = uiContact.name;
        companyRuntime.api.talkBind();
        companyRuntime.api.talkUpdate();
        const body = companyRuntime.dom.window.document.getElementById('talk-body');
        const launchButton = body.querySelector('[data-conversation-workspace-open]');
        if (launchButton) launchButton.dispatchEvent(new companyRuntime.dom.window.MouseEvent('click', { bubbles: true }));
        const modal = companyRuntime.dom.window.document.getElementById('conversation-workspace-modal');
        const ledgerAfterUiRender = hashSnapshot(companyRuntime.api.conversationSessionSnapshot());
        const reviewUiText = modal.textContent;
        const existingCompanyButton = Array.from(modal.querySelectorAll('[data-conversation-player-response]'))
            .find(button => button.dataset.conversationPlayerResponse === 'counter:use-existing-company');
        if (existingCompanyButton) {
            existingCompanyButton.dispatchEvent(new companyRuntime.dom.window.MouseEvent('click', { bubbles: true }));
        }
        const readySession = companyRuntime.api.conversationSessionLatest(companyContext.listenerActorId);
        const readyUiText = modal.textContent;
        const economyAfterResponses = responseEconomySnapshot();
        const negotiationEconomyBefore = responseEconomySnapshot();
        const negotiationOpenButton = modal.querySelector('[data-negotiation-case-open]');
        if (negotiationOpenButton) {
            negotiationOpenButton.dispatchEvent(new companyRuntime.dom.window.MouseEvent('click', { bubbles: true }));
        }
        const openedNegotiation = companyRuntime.api.negotiationCaseBySession(readySession.id);
        const firstVersionId = openedNegotiation && openedNegotiation.currentVersionId;
        const identitiesForNegotiation = Object.keys(companyRuntime.api.characterIdentityLedger().identities || {});
        const outsiderActorId = identitiesForNegotiation.find(id => openedNegotiation
            && !openedNegotiation.partyActorIds.includes(id));
        const outsiderCounter = openedNegotiation && companyRuntime.api.negotiationCaseCounter(
            openedNegotiation.id, outsiderActorId, { payment: { amount: 550, unit: 'sermaye' } }
        );
        const invalidCounter = openedNegotiation && companyRuntime.api.negotiationCaseCounter(
            openedNegotiation.id, readySession.listenerActorId, { free_resources: { amount: 999, unit: 'birim' } }
        );
        const counterVersion = openedNegotiation && companyRuntime.api.negotiationCaseCounter(
            openedNegotiation.id, readySession.listenerActorId, { payment: { amount: 550, unit: 'sermaye' } }
        );
        const staleAcceptance = counterVersion && companyRuntime.api.negotiationCaseAccept(
            openedNegotiation.id, readySession.playerActorId, firstVersionId
        );
        const partyAcceptance = counterVersion && companyRuntime.api.negotiationCaseAccept(
            openedNegotiation.id, readySession.playerActorId, counterVersion.version.id
        );
        const duplicateOpen = openedNegotiation && companyRuntime.api.negotiationCaseOpen(readySession.id);
        const acceptedNegotiation = openedNegotiation
            && companyRuntime.api.negotiationCaseGet(openedNegotiation.id);
        const preflightEconomyBefore = responseEconomySnapshot();
        const outsiderPreflight = openedNegotiation && companyRuntime.api.negotiationMechanicalPreflight(
            openedNegotiation.id, outsiderActorId
        );
        const mechanicalPreflight = openedNegotiation && companyRuntime.api.negotiationMechanicalPreflight(
            openedNegotiation.id, readySession.playerActorId
        );
        const rejectedTonUnit = companyRuntime.api.resourceUnitResolve('industrial_parts', 'ton', 100);
        const acceptedPartsUnit = companyRuntime.api.resourceUnitResolve('industrial_parts', 'lot-parça', 100);
        const acceptedFoodTon = companyRuntime.api.resourceUnitResolve('food', 'ton-gıda', 25);
        const warehouseOccupancy = companyRuntime.api.companyWarehouseOccupancy(
            destinationQuestion.options[0].id, 'industrial_parts'
        );
        const duplicateMechanicalPreflight = openedNegotiation && companyRuntime.api.negotiationMechanicalPreflight(
            openedNegotiation.id, readySession.playerActorId
        );
        const preflightEconomyAfter = responseEconomySnapshot();
        companyRuntime.api.conversationWorkspaceRender();
        const preflightUiText = modal.textContent;
        const preflightUiButton = modal.querySelector('[data-negotiation-mechanical-preflight]');
        const blockedActivationButton = modal.querySelector('[data-negotiation-delivery-activate]');
        const escrowCompanyBefore = companyRuntime.api.companyLedger().companies[binding.organizationId];
        const negotiatedEscrow = companyRuntime.api.budgetReserveNegotiatedPayment({
            correlationId: `${openedNegotiation.id}:${counterVersion.version.id}:probe`,
            negotiationCaseId: openedNegotiation.id,
            negotiationVersionId: counterVersion.version.id,
            buyerCompanyId: binding.organizationId,
            sellerCompanyId: null,
            buyerCountryId: escrowCompanyBefore.countryId,
            resourceId: 'industrial_parts',
            quantity: 5,
            amount: 5,
            currency: 'capital'
        });
        const duplicateNegotiatedEscrow = companyRuntime.api.budgetReserveNegotiatedPayment({
            correlationId: `${openedNegotiation.id}:${counterVersion.version.id}:probe`,
            negotiationCaseId: openedNegotiation.id,
            negotiationVersionId: counterVersion.version.id,
            buyerCompanyId: binding.organizationId,
            sellerCompanyId: null,
            buyerCountryId: escrowCompanyBefore.countryId,
            resourceId: 'industrial_parts', quantity: 5, amount: 5, currency: 'capital'
        });
        const conflictingNegotiatedEscrow = companyRuntime.api.budgetReserveNegotiatedPayment({
            correlationId: `${openedNegotiation.id}:${counterVersion.version.id}:probe`,
            negotiationCaseId: openedNegotiation.id,
            negotiationVersionId: counterVersion.version.id,
            buyerCompanyId: binding.organizationId,
            sellerCompanyId: null,
            buyerCountryId: escrowCompanyBefore.countryId,
            resourceId: 'industrial_parts', quantity: 5, amount: 6, currency: 'capital'
        });
        const escrowCompanyDuring = companyRuntime.api.companyLedger().companies[binding.organizationId];
        const escrowBudgetDuringValidation = companyRuntime.api.validateBudgetLedger(
            companyRuntime.api.budgetLedger(), { checkWalletMirrors: true }
        );
        const negotiatedEscrowRelease = companyRuntime.api.budgetReleaseNegotiatedPayment(
            negotiatedEscrow.reservationId, 'PROBE_ROLLBACK'
        );
        const duplicateEscrowRelease = companyRuntime.api.budgetReleaseNegotiatedPayment(
            negotiatedEscrow.reservationId, 'PROBE_ROLLBACK'
        );
        const escrowCompanyAfter = companyRuntime.api.companyLedger().companies[binding.organizationId];
        const escrowBudgetAfterValidation = companyRuntime.api.validateBudgetLedger(
            companyRuntime.api.budgetLedger(), { checkWalletMirrors: true }
        );
        const escrowCompanyAfterValidation = companyRuntime.api.validateCompanyLedger(
            companyRuntime.api.companyLedger()
        );
        const keptRelationBefore = companyRuntime.api.relationshipView(
            readySession.listenerActorId, readySession.playerActorId
        );
        const keptPromise = openedNegotiation && companyRuntime.api.negotiationPromiseCreate(
            openedNegotiation.id, readySession.playerActorId, 'PROVIDE_COUNTER_OFFER', 20
        );
        const promiseCounter = keptPromise && companyRuntime.api.negotiationCaseCounter(
            openedNegotiation.id, readySession.playerActorId, { quantity: { amount: 110, unit: 'ton' } }
        );
        const caseAfterPromiseCounter = companyRuntime.api.negotiationCaseGet(openedNegotiation.id);
        const keptCommitment = keptPromise
            && companyRuntime.api.negotiationSnapshot().commitments[keptPromise.commitment.id];
        const keptRelationAfter = companyRuntime.api.relationshipView(
            readySession.listenerActorId, readySession.playerActorId
        );
        const brokenRelationBefore = companyRuntime.api.relationshipView(
            readySession.playerActorId, readySession.listenerActorId
        );
        const brokenPromise = openedNegotiation && companyRuntime.api.negotiationPromiseCreate(
            openedNegotiation.id, readySession.listenerActorId, 'SECURE_MECHANICAL_APPROVAL', 5
        );
        story.clock += 6;
        const deadlineTick = companyRuntime.api.negotiationTick();
        const duplicateDeadlineTick = companyRuntime.api.negotiationTick();
        const afterPromiseSnapshot = companyRuntime.api.negotiationSnapshot();
        const brokenCommitment = brokenPromise
            && afterPromiseSnapshot.commitments[brokenPromise.commitment.id];
        const keptConsequence = keptCommitment && afterPromiseSnapshot.consequenceCandidates[
            keptCommitment.consequenceCandidateId
        ];
        const brokenConsequence = brokenCommitment && afterPromiseSnapshot.consequenceCandidates[
            brokenCommitment.consequenceCandidateId
        ];
        const diplomacyBeforeReview = hashSnapshot(story.rel || {});
        const diplomaticReview = brokenConsequence && companyRuntime.api.negotiationDiplomaticIncidentReview(
            brokenConsequence.id, brokenConsequence.promiseeActorId
        );
        const duplicateDiplomaticReview = brokenConsequence && companyRuntime.api.negotiationDiplomaticIncidentReview(
            brokenConsequence.id, brokenConsequence.promiseeActorId
        );
        const afterDiplomaticReviewSnapshot = companyRuntime.api.negotiationSnapshot();
        const reviewedBrokenConsequence = brokenConsequence
            && afterDiplomaticReviewSnapshot.consequenceCandidates[brokenConsequence.id];
        const diplomacyAfterReview = hashSnapshot(story.rel || {});
        const injuredActorView = brokenConsequence
            && companyRuntime.api.characterIdentityView(brokenConsequence.promiseeActorId);
        const accusedActorView = brokenConsequence
            && companyRuntime.api.characterIdentityView(brokenConsequence.promisorActorId);
        const injuredInstitutionCountry = injuredActorView
            && companyRuntime.api.institutionCountryView(injuredActorView.countryId);
        const accusedInstitutionCountry = accusedActorView
            && companyRuntime.api.institutionCountryView(accusedActorView.countryId);
        const executiveOf = country => country && Object.values(country.institutions || {})
            .find(row => row.type === 'EXECUTIVE');
        const injuredExecutive = executiveOf(injuredInstitutionCountry);
        const accusedExecutive = executiveOf(accusedInstitutionCountry);
        const submitProtest = (country, executive) => country && executive
            ? companyRuntime.api.institutionSubmit({
                countryId: country.countryId,
                actionType: 'ISSUE_DIPLOMATIC_PROTEST',
                institutionId: executive.id,
                actorId: executive.officeHolder.actorId
            }) : null;
        const foreignAuthoritySubmitted = submitProtest(accusedInstitutionCountry, accusedExecutive);
        const foreignAuthorityExecuted = foreignAuthoritySubmitted && foreignAuthoritySubmitted.ok
            ? companyRuntime.api.institutionExecute(foreignAuthoritySubmitted.request.id, {
                institutionId: accusedExecutive.id, actorId: accusedExecutive.officeHolder.actorId
            }) : foreignAuthoritySubmitted;
        const wrongStateProtest = foreignAuthorityExecuted && foreignAuthorityExecuted.ok
            ? companyRuntime.api.negotiationDiplomaticProtestExecute(
                brokenConsequence.id, foreignAuthorityExecuted.request.id
            ) : foreignAuthorityExecuted;
        const ownAuthoritySubmitted = submitProtest(injuredInstitutionCountry, injuredExecutive);
        const authorityBeforeExecution = ownAuthoritySubmitted && ownAuthoritySubmitted.ok
            ? companyRuntime.api.negotiationDiplomaticProtestExecute(
                brokenConsequence.id, ownAuthoritySubmitted.request.id
            ) : ownAuthoritySubmitted;
        const ownAuthorityExecuted = ownAuthoritySubmitted && ownAuthoritySubmitted.ok
            ? companyRuntime.api.institutionExecute(ownAuthoritySubmitted.request.id, {
                institutionId: injuredExecutive.id, actorId: injuredExecutive.officeHolder.actorId
            }) : ownAuthoritySubmitted;
        const protestStateId = countryId => {
            const match = /^country:(-?\d+)$/.exec(String(countryId || ''));
            return match ? Number(match[1]) : null;
        };
        const protestStateA = protestStateId(injuredActorView && injuredActorView.countryId);
        const protestStateB = protestStateId(accusedActorView && accusedActorView.countryId);
        const relationBeforeProtest = Number.isInteger(protestStateA) && Number.isInteger(protestStateB)
            ? companyRuntime.api.relationValue(protestStateA, protestStateB) : null;
        const treatyBeforeProtest = Number.isInteger(protestStateA) && Number.isInteger(protestStateB)
            ? companyRuntime.api.treaty(protestStateA, protestStateB) : null;
        const diplomaticProtest = ownAuthorityExecuted && ownAuthorityExecuted.ok
            ? companyRuntime.api.negotiationDiplomaticProtestExecute(
                brokenConsequence.id, ownAuthorityExecuted.request.id
            ) : ownAuthorityExecuted;
        const duplicateDiplomaticProtest = ownAuthorityExecuted && ownAuthorityExecuted.ok
            ? companyRuntime.api.negotiationDiplomaticProtestExecute(
                brokenConsequence.id, ownAuthorityExecuted.request.id
            ) : ownAuthorityExecuted;
        const relationAfterProtest = Number.isInteger(protestStateA) && Number.isInteger(protestStateB)
            ? companyRuntime.api.relationValue(protestStateA, protestStateB) : null;
        const treatyAfterProtest = Number.isInteger(protestStateA) && Number.isInteger(protestStateB)
            ? companyRuntime.api.treaty(protestStateA, protestStateB) : null;
        const afterDiplomaticProtestSnapshot = companyRuntime.api.negotiationSnapshot();
        const relationAfterDuplicateProtest = companyRuntime.api.relationValue(protestStateA, protestStateB);
        const warBlockedBeforeFixture = companyRuntime.api.negotiationConstitutionalWarExecute(
            brokenConsequence.id, ownAuthorityExecuted && ownAuthorityExecuted.request.id
        );
        const constitutionalFixtureState = companyRuntime.api.negotiationFixtureStateSnapshot();
        const constitutionalFixture = companyRuntime.api.negotiationFixtureEnableWarReview(
            brokenConsequence.id
        );
        if (constitutionalFixture && constitutionalFixture.ok) {
            const current = companyRuntime.api.relationValue(protestStateA, protestStateB);
            companyRuntime.api.relationAdd(protestStateA, protestStateB, -65 - current, {
                reason: 'TEST_FIXTURE_CONSTITUTIONAL_THRESHOLD',
                idempotencyKey: `test-fixture:constitutional-threshold:${brokenConsequence.id}`
            });
        }
        const executeConstitutionalAction = (countryId, actionType) => {
            const country = companyRuntime.api.institutionCountryView(countryId);
            const executive = country && Object.values(country.institutions || {})
                .find(row => row.type === 'EXECUTIVE');
            if (!country || !executive) return { ok: false, reason: 'FIXTURE_EXECUTIVE_MISSING' };
            let current = companyRuntime.api.institutionSubmit({
                countryId, actionType, institutionId: executive.id,
                actorId: executive.officeHolder.actorId
            });
            if (!current.ok) return current;
            for (const institutionId of current.request.requiredInstitutionIds || []) {
                if ((current.request.approvalInstitutionIds || []).includes(institutionId)) continue;
                const institution = country.institutions[institutionId];
                current = companyRuntime.api.institutionApprove(current.request.id, {
                    institutionId, actorId: institution.officeHolder.actorId
                });
                if (!current.ok) return current;
            }
            const executor = country.institutions[current.request.executorInstitutionId];
            return companyRuntime.api.institutionExecute(current.request.id, {
                institutionId: executor.id, actorId: executor.officeHolder.actorId
            });
        };
        const warAuthority = constitutionalFixture && constitutionalFixture.ok
            ? executeConstitutionalAction(injuredActorView.countryId, 'DECLARE_WAR') : constitutionalFixture;
        const constitutionalWar = warAuthority && warAuthority.ok
            ? companyRuntime.api.negotiationConstitutionalWarExecute(
                brokenConsequence.id, warAuthority.request.id
            ) : warAuthority;
        const treatyAfterConstitutionalWar = companyRuntime.api.treaty(protestStateA, protestStateB);
        const ownPeaceAuthority = constitutionalWar && constitutionalWar.ok
            ? executeConstitutionalAction(injuredActorView.countryId, 'SIGN_TREATY') : constitutionalWar;
        const unilateralPeaceBlocked = ownPeaceAuthority && ownPeaceAuthority.ok
            ? companyRuntime.api.negotiationConstitutionalPeaceExecute(
                brokenConsequence.id, [ownPeaceAuthority.request.id]
            ) : ownPeaceAuthority;
        const foreignPeaceAuthority = constitutionalWar && constitutionalWar.ok
            ? executeConstitutionalAction(accusedActorView.countryId, 'SIGN_TREATY') : constitutionalWar;
        const constitutionalPeace = ownPeaceAuthority && ownPeaceAuthority.ok
            && foreignPeaceAuthority && foreignPeaceAuthority.ok
            ? companyRuntime.api.negotiationConstitutionalPeaceExecute(
                brokenConsequence.id,
                [foreignPeaceAuthority.request.id, ownPeaceAuthority.request.id]
            ) : (foreignPeaceAuthority || ownPeaceAuthority);
        const duplicateConstitutionalPeace = constitutionalPeace && constitutionalPeace.ok
            ? companyRuntime.api.negotiationConstitutionalPeaceExecute(
                brokenConsequence.id,
                [ownPeaceAuthority.request.id, foreignPeaceAuthority.request.id]
            ) : constitutionalPeace;
        const treatyAfterConstitutionalPeace = companyRuntime.api.treaty(protestStateA, protestStateB);
        const afterConstitutionalSnapshot = companyRuntime.api.negotiationSnapshot();
        companyRuntime.api.negotiationFixtureStateRestore(constitutionalFixtureState);
        const brokenRelationAfter = companyRuntime.api.relationshipView(
            readySession.playerActorId, readySession.listenerActorId
        );
        const fourthActorId = identitiesForNegotiation.find(id => id !== outsiderActorId
            && !openedNegotiation.partyActorIds.includes(id));
        const outsiderSecretShare = companyRuntime.api.negotiationSecretShare(
            openedNegotiation.id, outsiderActorId, readySession.listenerActorId, playerBeliefId
        );
        const secretShare = companyRuntime.api.negotiationSecretShare(
            openedNegotiation.id, readySession.playerActorId, readySession.listenerActorId, playerBeliefId
        );
        const leakRelationBefore = companyRuntime.api.relationshipView(
            readySession.playerActorId, readySession.listenerActorId
        );
        const secretDisclosure = secretShare.ok && companyRuntime.api.negotiationSecretDisclose(
            secretShare.secret.id, readySession.listenerActorId, outsiderActorId
        );
        const disclosureFactId = secretDisclosure && secretDisclosure.disclosure.disclosureWorldFactId;
        const ownerKnowsBeforeReport = Object.values(identityLedger.actorBeliefs).some(row =>
            row.holderActorId === readySession.playerActorId && row.worldFactId === disclosureFactId);
        const leakRelationBeforeReport = companyRuntime.api.relationshipView(
            readySession.playerActorId, readySession.listenerActorId
        );
        const uninvolvedKnowsBeforeReport = Object.values(identityLedger.actorBeliefs).some(row =>
            row.holderActorId === fourthActorId
            && (row.worldFactId === beliefFactId || row.worldFactId === disclosureFactId));
        const leakReport = secretDisclosure && companyRuntime.api.negotiationSecretReportLeak(
            secretShare.secret.id, secretDisclosure.disclosure.id, outsiderActorId
        );
        const leakRelationAfterReport = companyRuntime.api.relationshipView(
            readySession.playerActorId, readySession.listenerActorId
        );
        const duplicateLeakReport = secretDisclosure && companyRuntime.api.negotiationSecretReportLeak(
            secretShare.secret.id, secretDisclosure.disclosure.id, outsiderActorId
        );
        const leakRelationAfterDuplicate = companyRuntime.api.relationshipView(
            readySession.playerActorId, readySession.listenerActorId
        );
        const authorizedDisclosure = fourthActorId && companyRuntime.api.negotiationSecretAuthorize(
            secretShare.secret.id, readySession.playerActorId, fourthActorId
        );
        const authorizedRelationBefore = companyRuntime.api.relationshipView(
            readySession.playerActorId, readySession.listenerActorId
        );
        const authorizedTransfer = authorizedDisclosure && companyRuntime.api.negotiationSecretDisclose(
            secretShare.secret.id, readySession.listenerActorId, fourthActorId
        );
        const authorizedReport = authorizedTransfer && companyRuntime.api.negotiationSecretReportLeak(
            secretShare.secret.id, authorizedTransfer.disclosure.id, fourthActorId
        );
        const authorizedRelationAfter = companyRuntime.api.relationshipView(
            readySession.playerActorId, readySession.listenerActorId
        );
        const promiseMemory = companyRuntime.api.characterMemoryLedger();
        const negotiationEconomyAfter = responseEconomySnapshot();
        companyRuntime.api.conversationWorkspaceRender();
        const negotiationUiText = modal.textContent;
        const agreementReceipt = companyRuntime.api.characterActionExecutePlayer('PERSUADE', uiContact.id, {});
        const newButton = modal.querySelector('[data-conversation-new]');
        if (newButton) newButton.dispatchEvent(new companyRuntime.dom.window.MouseEvent('click', { bubbles: true }));
        const textarea = modal.querySelector('[data-conversation-input]');
        const wasdTypingSafe = ['w', 'a', 's', 'd'].every(key => {
            const event = new companyRuntime.dom.window.KeyboardEvent('keydown', {
                key, bubbles: true, cancelable: true
            });
            return textarea && textarea.dispatchEvent(event) && !event.defaultPrevented;
        });
        const sendButton = modal.querySelector('[data-conversation-send]');
        if (textarea) textarea.value = 'Söz veriyorum, wasd kullanarak bu anlaşmanın bedelini karşılayacağım.';
        if (sendButton) sendButton.dispatchEvent(new companyRuntime.dom.window.MouseEvent('click', { bubbles: true }));
        const uiText = `${body.textContent} ${modal.textContent}`;
        const uiSession = companyRuntime.api.conversationSessionLatest(companyContext.listenerActorId);
        const promiseRecall = companyRuntime.api.characterMemoryRecall(
            readySession.listenerActorId,
            { kinds: ['PROMISE'], relatedActorId: readySession.playerActorId, limit: 6 }
        );
        const promiseRecallFollowUp = uiSession && companyRuntime.api.conversationSessionFollowUp(
            uiSession.id,
            'Daha önce verdiğimiz sözlerden hangisini tuttuk, hangisini bozduk?'
        );
        const promiseRecallResponse = promiseRecallFollowUp && promiseRecallFollowUp.followUp
            && promiseRecallFollowUp.followUp.response;
        const historyRows = modal.querySelectorAll('.conversation-history-row');
        const resumeButton = Array.from(modal.querySelectorAll('[data-conversation-resume]'))
            .find(button => !button.disabled);
        if (resumeButton) resumeButton.dispatchEvent(new companyRuntime.dom.window.MouseEvent('click', { bubbles: true }));
        const resumedText = modal.querySelector('.conversation-current blockquote')?.textContent || '';
        sessionSnapshot = companyRuntime.api.conversationSessionSnapshot();
        negotiationSnapshot = companyRuntime.api.negotiationSnapshot();
        companyRuntime.api.saveNow();
        const saveStatus = companyRuntime.api.saveStatus();
        sessionRaw = companyRuntime.api.savedRaw();
        roleResolution = {
            binding,
            companyResolved: !!company && company.entityId === binding.organizationId
                && company.status === 'RESOLVED_OWNED',
            warehouseCandidatesOwned: !!warehouse && warehouse.candidates.length > 0
                && warehouse.status === 'AMBIGUOUS_REFERENCE' && warehouse.entityId === null,
            stillRequiresSpecificWarehouse: analysis.unresolvedTerms.includes('destination_warehouse')
                && analysis.proposedCommand === null,
            sessionStart,
            invalidOptionRejected: invalidOption.ok === false && invalidOption.code === 'OPTION_NOT_OFFERED',
            allClarificationsAccepted: [commodityReply, destinationReply, quantityReply,
                paymentReply, durationReply, penaltyReply].every(row => row.ok),
            completedStatus: completedSession.status,
            domainReviewCreated: !!initialDomainReview
                && initialDomainReview.decision === 'ASK_EVIDENCE'
                && initialDomainReview.sessionStatus === 'DOMAIN_REVIEW_NEEDS_EVIDENCE',
            domainReviewWorldNeutral: worldBeforeDomainReview === worldAfterDomainReview,
            listenerBeliefBounded: !!initialDomainReview
                && initialDomainReview.listenerKnowledge.rawWorldRead === false
                && initialDomainReview.diagnostics.rawTradeLedgerRead === false
                && initialDomainReview.listenerKnowledge.claimResults.some(row =>
                    row.status === 'UNKNOWN_TO_LISTENER'),
            rawLedgerIgnoredByReview: !!rawLedgerReview && !!initialDomainReview
                && rawLedgerReview.id === initialDomainReview.id
                && rawLedgerReview.decision === 'ASK_EVIDENCE',
            unofferedEvidenceRejected: invalidEvidenceResponse.ok === false
                && invalidEvidenceResponse.code === 'RESPONSE_NOT_OFFERED',
            ownedEvidenceOffered: !!evidenceOption && evidenceOption.payload.beliefId === playerBeliefId,
            actorBeliefChangesReview: evidenceResponse.ok && evidenceResponse.knowledgeMutation === true
                && evidenceResponse.session.domainReview.listenerKnowledge.claimResults.some(row =>
                    row.status === 'SUPPORTED_BY_LISTENER_BELIEF'
                    && row.beliefId === evidenceResponse.evidence.beliefId)
                && evidenceResponse.session.domainReview.decision === 'COUNTER_OFFER'
                && evidenceResponse.session.domainReview.sessionStatus === 'DOMAIN_REVIEW_COUNTER_OFFER',
            evidenceTransferSourced: !!evidenceResponse.evidence
                && identityLedger.actorBeliefs[evidenceResponse.evidence.beliefId].holderActorId === companyContext.listenerActorId
                && identityLedger.actorBeliefs[evidenceResponse.evidence.beliefId].source.sourceBeliefId === playerBeliefId
                && identityLedger.actorBeliefs[evidenceResponse.evidence.beliefId].beliefStatus === 'REPORTED',
            counterOfferReached: counterOfferSession.status === 'DOMAIN_REVIEW_COUNTER_OFFER',
            existingCompanyAccepted: !!existingCompanyButton
                && readySession.status === 'READY_FOR_NEGOTIATION'
                && readySession.concessions.useExistingCompany === true
                && readySession.domainReview.decision === 'PROCEED_TO_NEGOTIATION',
            responsesEconomyNeutral: economyBeforeResponses === economyAfterResponses,
            noOpenQuestions: completedSession.questions.every(row => row.status === 'ANSWERED'),
            domainChecksRemain: completedSession.domainChecks.length >= 4,
            candidateStillNonExecutable: readySession.candidate.executable === false
                && readySession.candidate.worldMutation === false
                && readySession.candidate.blockedReasons.includes('execution_authority'),
            explicitCommodityChoice: completedSession.candidate.entities.some(row =>
                row.entityId === 'industrial_parts' && row.status === 'RESOLVED_BY_PLAYER_CONFIRMATION'),
            resolvedContextPreserved: ['country:2', 'shipment:player-known-fixture', binding.organizationId]
                .every(id => completedSession.candidate.entities.some(row => row.entityId === id)),
            destinationPropagated: completedSession.candidate.requests.some(row =>
                row.type === 'REDIRECT_SHIPMENT' && row.destinationId === destinationQuestion.options[0].id),
            numericTermsPreserved: completedSession.candidate.terms.quantity.amount === 100
                && completedSession.candidate.terms.payment.amount === 500
                && completedSession.candidate.terms.delivery_schedule.amount === 30
                && completedSession.candidate.terms.contract_penalty.amount === 10,
            uiInputVisible: !!textarea && !!sendButton,
            uiSpeechStored: !!uiSession && uiSession.initialText.includes('Söz veriyorum'),
            uiShowsWorldNeutrality: uiText.includes('DÜNYA DEĞİŞMEDİ'),
            listenerResponseRealized: !!counterOfferSession.domainReview.response.realization
                && companyRuntime.api.characterDialogueValidate(counterOfferSession.domainReview.response.realization).ok,
            mechanicalGroundingPreserved: counterOfferSession.domainReview.response.mechanicalText
                === 'Yeni çelik şirketi henüz kayıtlı değil. Mevcut şirketin üzerinden doğrulanabilir bir sözleşme taslağı sun veya önce şirket kuruluşunu tamamla.'
                && counterOfferSession.domainReview.response.text
                    === counterOfferSession.domainReview.response.realization.text,
            uiShowsMechanicalResponse: reviewUiText.includes('DOĞRULANMIŞ KARAKTER CEVABI')
                && reviewUiText.includes(counterOfferSession.domainReview.response.realization.text)
                && reviewUiText.includes('ACTORBELIEF'),
            uiOffersCanonicalCounterResponse: reviewUiText.includes('CEVABINI SEÇ')
                && reviewUiText.includes('Mevcut şirketim üzerinden ilerle'),
            uiResponseProjectionReadOnly: ledgerBeforeUiRender === ledgerAfterUiRender,
            uiShowsNegotiationReady: readyUiText.includes('DOĞRULANMIŞ MÜZAKERE HAZIRLIĞI')
                && readyUiText.includes('Henüz sözleşme, ödeme veya sevkiyat oluşmadı'),
            negotiationButtonVisible: !!negotiationOpenButton,
            negotiationOpened: !!openedNegotiation && openedNegotiation.versions.length === 1
                && openedNegotiation.execution.status === 'NOT_AUTHORIZED'
                && openedNegotiation.worldMutation === false
                && openedNegotiation.versions[0].terms.quantity.unit === 'ton'
                && openedNegotiation.versions[0].terms.payment.unit === 'capital'
                && openedNegotiation.versions[0].terms.delivery_schedule.unit === 'DAY'
                && openedNegotiation.versions[0].terms.contract_penalty.unit === 'PERCENT',
            negotiationOutsiderRejected: !!outsiderCounter && outsiderCounter.ok === false
                && outsiderCounter.code === 'NOT_A_PARTY',
            negotiationUnknownTermRejected: !!invalidCounter && invalidCounter.ok === false
                && invalidCounter.code === 'UNKNOWN_TERM',
            negotiationCounterVersioned: !!counterVersion && counterVersion.ok
                && counterVersion.version.number === 2
                && counterVersion.version.supersedesVersionId === firstVersionId
                && counterVersion.version.terms.payment.amount === 550,
            negotiationStaleAcceptanceRejected: !!staleAcceptance && staleAcceptance.ok === false
                && staleAcceptance.code === 'STALE_VERSION',
            negotiationPartiesAcceptedButNotExecutable: !!partyAcceptance && partyAcceptance.ok
                && acceptedNegotiation.status === 'ACCEPTED_PENDING_APPROVAL'
                && acceptedNegotiation.executable === false
                && acceptedNegotiation.execution.status === 'NOT_AUTHORIZED'
                && acceptedNegotiation.requiredApprovals.some(row => row.kind === 'MECHANICAL_CONTRACT_AUTHORITY'
                    && row.status === 'PENDING'),
            negotiationDuplicateIdempotent: !!duplicateOpen && duplicateOpen.ok
                && duplicateOpen.code === 'CASE_EXISTS' && duplicateOpen.case.id === openedNegotiation.id,
            negotiationEconomyNeutral: negotiationEconomyBefore === negotiationEconomyAfter,
            mechanicalGroundingPreserved: !!acceptedNegotiation.mechanicalGrounding
                && acceptedNegotiation.mechanicalGrounding.entities.some(row =>
                    row.role === 'TARGET_SHIPMENT' && row.entityId === 'shipment:player-known-fixture')
                && acceptedNegotiation.mechanicalGrounding.entities.some(row =>
                    row.role === 'DESTINATION' && row.entityId === destinationQuestion.options[0].id)
                && acceptedNegotiation.mechanicalGrounding.requests.some(row =>
                    row.type === 'REDIRECT_SHIPMENT' && row.targetShipmentId === 'shipment:player-known-fixture'),
            mechanicalPreflightRejectsOutsider: outsiderPreflight.ok === false
                && outsiderPreflight.code === 'NOT_A_PARTY',
            mechanicalPreflightExplainsBlockers: mechanicalPreflight.ok
                && mechanicalPreflight.code === 'PREFLIGHT_BLOCKED'
                && ['ORDER_REFERENCE_MISSING', 'UNIT_CONVERSION_REQUIRED',
                    'NEGOTIATED_PAYMENT_CASH_UNAVAILABLE',
                    'CONTRACT_PENALTY_SELLER_COMPANY_MISSING']
                    .every(code => mechanicalPreflight.review.blockerCodes.includes(code))
                && !mechanicalPreflight.review.blockerCodes.includes('DELIVERY_SCHEDULE_EXECUTOR_UNAVAILABLE')
                && !mechanicalPreflight.review.blockerCodes.includes('CONTRACT_PENALTY_EXECUTOR_UNAVAILABLE')
                && mechanicalPreflight.review.checks.some(row => row.id === 'warehouse_occupancy'
                    && row.code !== 'WAREHOUSE_OCCUPANCY_ACCOUNTING_UNAVAILABLE')
                && mechanicalPreflight.review.executable === false
                && mechanicalPreflight.review.worldMutation === false,
            canonicalResourceUnitBinding: rejectedTonUnit.ok === false
                && rejectedTonUnit.code === 'UNIT_CONVERSION_REQUIRED'
                && acceptedPartsUnit.ok && acceptedPartsUnit.canonicalUnit.id === 'parts_lot'
                && acceptedPartsUnit.amount === 100
                && acceptedFoodTon.ok && acceptedFoodTon.canonicalUnit.id === 'food_ton',
            warehouseOccupancyDerivedFromPhysicalFlows: warehouseOccupancy.ok
                && Math.abs(warehouseOccupancy.available - Math.max(0,
                    warehouseOccupancy.capacity - warehouseOccupancy.stored - warehouseOccupancy.incoming)) < 1e-6
                && Array.isArray(warehouseOccupancy.incomingShipmentIds)
                && warehouseOccupancy.committed === warehouseOccupancy.stored + warehouseOccupancy.incoming,
            negotiatedEscrowConservedAndIdempotent: negotiatedEscrow.ok
                && negotiatedEscrow.code === 'NEGOTIATED_PAYMENT_RESERVED'
                && duplicateNegotiatedEscrow.ok && duplicateNegotiatedEscrow.duplicate === true
                && duplicateNegotiatedEscrow.reservationId === negotiatedEscrow.reservationId
                && conflictingNegotiatedEscrow.ok === false
                && conflictingNegotiatedEscrow.code === 'NEGOTIATED_PAYMENT_IDEMPOTENCY_CONFLICT'
                && escrowCompanyBefore.accounts['ASSET:CASH'] - escrowCompanyDuring.accounts['ASSET:CASH'] === 5
                && escrowCompanyDuring.accounts['ASSET:TRADE_ESCROW']
                    - escrowCompanyBefore.accounts['ASSET:TRADE_ESCROW'] === 5
                && escrowBudgetDuringValidation.ok
                && negotiatedEscrowRelease.ok && negotiatedEscrowRelease.duplicate === false
                && duplicateEscrowRelease.ok && duplicateEscrowRelease.duplicate === true
                && escrowCompanyAfter.accounts['ASSET:CASH'] === escrowCompanyBefore.accounts['ASSET:CASH']
                && escrowCompanyAfter.accounts['ASSET:TRADE_ESCROW']
                    === escrowCompanyBefore.accounts['ASSET:TRADE_ESCROW']
                && escrowBudgetAfterValidation.ok && escrowCompanyAfterValidation.ok,
            mechanicalPreflightIdempotent: duplicateMechanicalPreflight.ok
                && duplicateMechanicalPreflight.duplicate === true
                && duplicateMechanicalPreflight.review.id === mechanicalPreflight.review.id,
            mechanicalPreflightEconomyNeutral: preflightEconomyBefore === preflightEconomyAfter,
            mechanicalPreflightInvalidatedByCounter: promiseCounter.ok
                && caseAfterPromiseCounter.execution.status === 'NOT_AUTHORIZED'
                && caseAfterPromiseCounter.execution.receiptId === null
                && caseAfterPromiseCounter.mechanicalReviews.some(row => row.id === mechanicalPreflight.review.id
                    && row.versionId !== caseAfterPromiseCounter.currentVersionId),
            keptPromiseResolvedByNewVersion: !!keptPromise && keptPromise.ok
                && !!promiseCounter && promiseCounter.ok
                && keptCommitment.status === 'KEPT' && keptCommitment.effectsApplied
                && keptCommitment.resolutionEventId,
            keptPromiseRelationshipEffect: keptRelationAfter.trustBps - keptRelationBefore.trustBps === 250
                && keptRelationAfter.respectBps - keptRelationBefore.respectBps === 150
                && keptRelationAfter.debtBps - keptRelationBefore.debtBps === 120,
            brokenPromiseResolvedAtDeadline: !!brokenPromise && brokenPromise.ok
                && deadlineTick.broken === 1 && brokenCommitment.status === 'BROKEN'
                && brokenCommitment.effectsApplied && brokenCommitment.resolutionEventId,
            brokenPromiseRelationshipEffect: brokenRelationAfter.trustBps - brokenRelationBefore.trustBps === -600
                && brokenRelationAfter.respectBps - brokenRelationBefore.respectBps === -250
                && brokenRelationAfter.hostilityBps - brokenRelationBefore.hostilityBps === 350,
            promiseResolutionIdempotent: duplicateDeadlineTick.broken === 0
                && afterPromiseSnapshot.diagnostics.promisesKept === 1
                && afterPromiseSnapshot.diagnostics.promisesBroken === 1,
            promiseConsequencesDistinctAndSafe: !!keptConsequence && !!brokenConsequence
                && keptConsequence.kind === 'COOPERATIVE_FOLLOW_UP'
                && keptConsequence.triggerStatus === 'KEPT'
                && keptConsequence.nextStepCodes.includes('FORMALIZE_MECHANICAL_CONTRACT')
                && brokenConsequence.kind === 'COMMERCIAL_DISPUTE'
                && brokenConsequence.triggerStatus === 'BROKEN'
                && brokenConsequence.nextStepCodes.includes('REQUEST_CURE')
                && brokenConsequence.nextStepCodes.includes('SUSPEND_NEGOTIATION')
                && JSON.stringify(keptConsequence.nextStepCodes)
                    !== JSON.stringify(brokenConsequence.nextStepCodes)
                && [keptConsequence, brokenConsequence].every(row => row.executable === false
                    && row.worldMutation === false && row.warCandidate === null
                    && row.peaceCandidate === null),
            promiseConsequenceIdempotent: afterPromiseSnapshot.diagnostics.consequenceCandidatesCreated === 2
                && Object.keys(afterPromiseSnapshot.consequenceCandidates).length === 2,
            diplomaticIncidentReviewSafe: !!diplomaticReview && diplomaticReview.ok
                && diplomaticReview.worldMutation === false
                && !!reviewedBrokenConsequence
                && reviewedBrokenConsequence.status === 'REVIEWED'
                && reviewedBrokenConsequence.diplomaticReview
                && reviewedBrokenConsequence.diplomaticReview.legalStanding === true
                && reviewedBrokenConsequence.diplomaticReview.protestEligible === true
                && reviewedBrokenConsequence.diplomaticReview.requiresStateAuthority === true
                && reviewedBrokenConsequence.diplomaticReview.protestCandidate.status
                    === 'AWAITING_STATE_AUTHORITY'
                && reviewedBrokenConsequence.diplomaticReview.executable === false
                && reviewedBrokenConsequence.diplomaticReview.worldMutation === false
                && diplomacyBeforeReview === diplomacyAfterReview,
            commercialBreachCannotFabricateWar: !!reviewedBrokenConsequence
                && reviewedBrokenConsequence.diplomaticReview.verifiedEconomicDamage === 0
                && reviewedBrokenConsequence.diplomaticReview.damageAssessment.schemaVersion === 1
                && reviewedBrokenConsequence.diplomaticReview.damageAssessment.totals.uncompensatedDamage === 0
                && reviewedBrokenConsequence.diplomaticReview.damageAssessment.unmeasuredClaims
                    .every(row => row.status === 'UNVERIFIED' && row.includedInDamage === false)
                && reviewedBrokenConsequence.diplomaticReview.thresholds.damagePassed === false
                && reviewedBrokenConsequence.diplomaticReview.warCandidate === null
                && reviewedBrokenConsequence.warCandidate === null
                && reviewedBrokenConsequence.peaceCandidate === null
                && reviewedBrokenConsequence.diplomaticReview.blockedReasons
                    .includes('VERIFIED_ECONOMIC_DAMAGE_BELOW_WAR_THRESHOLD'),
            diplomaticIncidentReviewIdempotent: !!duplicateDiplomaticReview
                && duplicateDiplomaticReview.ok && duplicateDiplomaticReview.duplicate === true
                && duplicateDiplomaticReview.review.id === diplomaticReview.review.id,
            diplomaticProtestRequiresExecutedOwnStateAuthority:
                !!wrongStateProtest && wrongStateProtest.ok === false
                && wrongStateProtest.code === 'INJURED_STATE_AUTHORITY_REQUIRED'
                && !!authorityBeforeExecution && authorityBeforeExecution.ok === false
                && authorityBeforeExecution.code === 'STATE_PROTEST_AUTHORITY_NOT_EXECUTED',
            diplomaticProtestExecutesOnceWithoutWar:
                !!diplomaticProtest && diplomaticProtest.ok && diplomaticProtest.worldMutation === true
                && diplomaticProtest.execution.authorityRequestId === ownAuthorityExecuted.request.id
                && diplomaticProtest.execution.issuingCountryId === injuredActorView.countryId
                && diplomaticProtest.execution.targetCountryId === accusedActorView.countryId
                && relationAfterProtest - relationBeforeProtest === -6
                && treatyAfterProtest === treatyBeforeProtest
                && diplomaticProtest.execution.treatyMutation === false
                && diplomaticProtest.execution.warMutation === false
                && afterDiplomaticProtestSnapshot.consequenceCandidates[brokenConsequence.id]
                    .diplomaticReview.protestCandidate.status === 'ISSUED'
                && afterDiplomaticProtestSnapshot.consequenceCandidates[brokenConsequence.id]
                    .diplomaticReview.requiresStateAuthority === false,
            diplomaticProtestIdempotent: !!duplicateDiplomaticProtest
                && duplicateDiplomaticProtest.ok && duplicateDiplomaticProtest.duplicate === true
                && relationAfterProtest === relationAfterDuplicateProtest,
            constitutionalWarBlockedWithoutVerifiedCandidate: !!warBlockedBeforeFixture
                && warBlockedBeforeFixture.ok === false
                && warBlockedBeforeFixture.code === 'WAR_REVIEW_THRESHOLDS_NOT_MET',
            constitutionalWarRequiresFullRegimeRoute: !!constitutionalFixture
                && constitutionalFixture.ok && constitutionalFixture.fixture === true
                && !!warAuthority && warAuthority.ok
                && warAuthority.request.actionType === 'DECLARE_WAR'
                && warAuthority.request.status === 'EXECUTED'
                && warAuthority.request.requiredInstitutionIds.every(id =>
                    warAuthority.request.approvalInstitutionIds.includes(id))
                && !!constitutionalWar && constitutionalWar.ok
                && constitutionalWar.execution.authorityRequestId === warAuthority.request.id
                && treatyAfterConstitutionalWar === 'war',
            constitutionalPeaceRequiresBothStates: !!unilateralPeaceBlocked
                && unilateralPeaceBlocked.ok === false
                && unilateralPeaceBlocked.code === 'BILATERAL_PEACE_AUTHORITY_REQUIRED'
                && !!ownPeaceAuthority && ownPeaceAuthority.ok
                && !!foreignPeaceAuthority && foreignPeaceAuthority.ok
                && [ownPeaceAuthority, foreignPeaceAuthority].every(result =>
                    result.request.actionType === 'SIGN_TREATY'
                    && result.request.status === 'EXECUTED'
                    && result.request.requiredInstitutionIds.every(id =>
                        result.request.approvalInstitutionIds.includes(id))),
            constitutionalPeaceExecutesOnce: !!constitutionalPeace && constitutionalPeace.ok
                && constitutionalPeace.execution.authorityRequestIds.length === 2
                && constitutionalPeace.execution.signatoryCountryIds.length === 2
                && constitutionalPeace.execution.peaceMutation === true
                && treatyAfterConstitutionalPeace === 'peace'
                && !!duplicateConstitutionalPeace && duplicateConstitutionalPeace.ok
                && duplicateConstitutionalPeace.duplicate === true
                && afterConstitutionalSnapshot.consequenceCandidates[brokenConsequence.id]
                    .diplomaticReview.peaceCandidate.status === 'SIGNED',
            promiseMemoryResolved: promiseMemory.milestones[keptCommitment.memoryMilestoneId].status === 'KEPT'
                && promiseMemory.milestones[brokenCommitment.memoryMilestoneId].status === 'BROKEN',
            promiseRecallLongHorizon: !!promiseRecall && promiseRecall.ok
                && promiseRecall.rawWorldRead === false
                && promiseRecall.records.some(row => row.id === keptCommitment.memoryMilestoneId
                    && row.layer === 'MILESTONE' && row.horizon === 'LONG' && row.status === 'KEPT'
                    && row.sourceEvidenceIds.includes(keptCommitment.id))
                && promiseRecall.records.some(row => row.id === brokenCommitment.memoryMilestoneId
                    && row.layer === 'MILESTONE' && row.horizon === 'LONG' && row.status === 'BROKEN'
                    && row.sourceEvidenceIds.includes(brokenCommitment.id)),
            promiseRecallInLaterConversation: !!promiseRecallResponse
                && promiseRecallResponse.source === 'CHARACTER_HELD_MEMORY_RECALL'
                && promiseRecallResponse.rawWorldRead === false
                && promiseRecallResponse.worldMutation === false
                && promiseRecallResponse.memoryRecall.records.some(row => row.status === 'KEPT')
                && promiseRecallResponse.memoryRecall.records.some(row => row.status === 'BROKEN')
                && promiseRecallResponse.text.includes('KEPT')
                && promiseRecallResponse.text.includes('BROKEN'),
            secretOutsiderCannotOriginate: outsiderSecretShare.ok === false
                && outsiderSecretShare.code === 'NOT_CASE_PARTIES',
            secretSharedThroughActorBelief: secretShare.ok && secretShare.knowledgeMutation === true
                && secretShare.worldMutation === false
                && secretShare.recipientBelief.holderActorId === readySession.listenerActorId
                && secretShare.recipientBelief.worldFactId === beliefFactId
                && secretShare.recipientBelief.source.sourceBeliefId === playerBeliefId,
            unauthorizedDisclosureInitiallyLocal: secretDisclosure.ok
                && secretDisclosure.code === 'UNAUTHORIZED_DISCLOSURE_UNDISCOVERED'
                && secretDisclosure.disclosure.status === 'UNDISCOVERED_UNAUTHORIZED'
                && ownerKnowsBeforeReport === false
                && leakRelationBeforeReport.trustBps === leakRelationBefore.trustBps
                && leakRelationBeforeReport.respectBps === leakRelationBefore.respectBps
                && leakRelationBeforeReport.hostilityBps === leakRelationBefore.hostilityBps,
            disclosureKnowledgeBounded: !!fourthActorId && uninvolvedKnowsBeforeReport === false
                && Object.values(identityLedger.actorBeliefs).some(row =>
                    row.holderActorId === outsiderActorId && row.worldFactId === beliefFactId)
                && Object.values(identityLedger.actorBeliefs).some(row =>
                    row.holderActorId === outsiderActorId && row.worldFactId === disclosureFactId),
            sourcedLeakReportRevealsBetrayal: leakReport.ok && leakReport.knowledgeMutation === true
                && leakReport.disclosure.status === 'DISCOVERED_UNAUTHORIZED'
                && Object.values(identityLedger.actorBeliefs).some(row =>
                    row.holderActorId === readySession.playerActorId && row.worldFactId === disclosureFactId
                    && row.source.type === 'SOURCED_LEAK_REPORT')
                && leakRelationAfterReport.trustBps - leakRelationBeforeReport.trustBps === -800
                && leakRelationAfterReport.respectBps - leakRelationBeforeReport.respectBps === -300
                && leakRelationAfterReport.hostilityBps - leakRelationBeforeReport.hostilityBps === 500
                && leakReport.memory && leakReport.memory.milestone.kind === 'BETRAYAL',
            leakReportIdempotent: duplicateLeakReport.ok
                && duplicateLeakReport.code === 'LEAK_ALREADY_REPORTED'
                && leakRelationAfterDuplicate.trustBps === leakRelationAfterReport.trustBps
                && leakRelationAfterDuplicate.respectBps === leakRelationAfterReport.respectBps
                && leakRelationAfterDuplicate.hostilityBps === leakRelationAfterReport.hostilityBps,
            authorizedDisclosureNotBetrayal: authorizedDisclosure.ok && authorizedTransfer.ok
                && authorizedTransfer.code === 'AUTHORIZED_DISCLOSURE'
                && authorizedReport.ok && authorizedReport.code === 'AUTHORIZED_DISCLOSURE_REPORTED'
                && authorizedReport.disclosure.status === 'DISCOVERED_AUTHORIZED'
                && authorizedReport.worldMutation === false
                && authorizedRelationAfter.trustBps === authorizedRelationBefore.trustBps
                && authorizedRelationAfter.respectBps === authorizedRelationBefore.respectBps
                && authorizedRelationAfter.hostilityBps === authorizedRelationBefore.hostilityBps,
            secretIdentityLedgerValid: companyRuntime.api.validateCharacterIdentityLedger(identityLedger),
            negotiationUiVisible: negotiationUiText.includes('MÜZAKERE VAKASI AÇIK')
                && negotiationUiText.includes(openedNegotiation.id)
                && negotiationUiText.includes('stok ve sevkiyat değişmedi'),
            mechanicalPreflightUiVisible: preflightUiText.includes('MEKANİK ÖN KONTROL: BLOCKED')
                && preflightUiText.includes('ORDER_REFERENCE_MISSING') && !!preflightUiButton
                && !negotiationUiText.includes('MEKANİK ÖN KONTROL: BLOCKED'),
            mechanicalActivationHiddenWhenBlocked: !blockedActivationButton,
            workspaceSeparate: !!launchButton && !!modal && !modal.classList.contains('hidden')
                && !body.querySelector('[data-conversation-input]'),
            profileVisible: modal.querySelector('#conversation-workspace-profile')?.textContent.includes(uiContact.name),
            historyVisible: historyRows.length >= 2,
            previousConversationResumed: !!resumeButton && resumedText.includes('Ben bir şirket kuracağım'),
            agreementVisible: !agreementReceipt.ok
                || modal.querySelector('#conversation-workspace-history')?.textContent.includes('İkna girişimi'),
            wasdTypingSafe,
            saveStatus,
            ledgerValidation: companyRuntime.api.conversationSessionValidate(sessionSnapshot),
            negotiationValidation: companyRuntime.api.negotiationValidate(negotiationSnapshot)
        };
    } finally {
        companyRuntime.dom.window.close();
    }

    const restoredSessionRuntime = createRuntime((seed + 4) >>> 0);
    let restoredSession;
    try {
        restoredSessionRuntime.api.putSavedRaw(sessionRaw);
        const loaded = restoredSessionRuntime.api.loadNow();
        const snapshot = restoredSessionRuntime.api.conversationSessionSnapshot();
        const restoredNegotiations = restoredSessionRuntime.api.negotiationSnapshot();
        const legacyNegotiations = JSON.parse(JSON.stringify(restoredNegotiations));
        delete legacyNegotiations.nextMechanicalReviewSequence;
        if (legacyNegotiations.diagnostics) {
            delete legacyNegotiations.diagnostics.mechanicalPreflights;
            delete legacyNegotiations.diagnostics.mechanicalBlocked;
        }
        for (const row of Object.values(legacyNegotiations.cases || {})) {
            delete row.mechanicalGrounding;
            delete row.mechanicalReviews;
            row.execution = { status: 'NOT_AUTHORIZED', receiptId: null };
        }
        const legacyNegotiationRestore = restoredSessionRuntime.api.negotiationRestore(legacyNegotiations);
        const migratedNegotiations = restoredSessionRuntime.api.negotiationSnapshot();
        restoredSession = {
            loaded,
            validation: restoredSessionRuntime.api.conversationSessionValidate(snapshot),
            exact: JSON.stringify(snapshot) === JSON.stringify(sessionSnapshot),
            sessionCount: snapshot && snapshot.sessions && snapshot.sessions.length,
            negotiationValidation: restoredSessionRuntime.api.negotiationValidate(restoredNegotiations),
            negotiationExact: JSON.stringify(restoredNegotiations) === JSON.stringify(negotiationSnapshot),
            negotiationCaseCount: Object.keys(restoredNegotiations && restoredNegotiations.cases || {}).length,
            legacyNegotiationMigration: {
                loaded: legacyNegotiationRestore.loaded,
                validation: restoredSessionRuntime.api.negotiationValidate(migratedNegotiations),
                groundingRecovered: Object.values(migratedNegotiations.cases || {}).every(row =>
                    row.mechanicalGrounding && Array.isArray(row.mechanicalReviews)),
                nextReviewSequence: migratedNegotiations.nextMechanicalReviewSequence
            }
        };
    } finally {
        restoredSessionRuntime.dom.window.close();
    }

    const legacySessionRuntime = createRuntime((seed + 5) >>> 0);
    let legacySessionMigration;
    try {
        legacySessionRuntime.api.newCampaign({ seed: seed + 5, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const legacy = JSON.parse(JSON.stringify(sessionSnapshot));
        legacy.schemaVersion = 2;
        legacy.adapterVersion = 'story-conversation-session-ledger-2';
        for (const session of legacy.sessions || []) {
            session.schemaVersion = 2;
            delete session.playerResponses;
            delete session.evidenceSubmissions;
            delete session.concessions;
            delete session.resolution;
            if (session.candidate) {
                session.candidate.schemaVersion = 2;
                delete session.candidate.concessions;
                delete session.candidate.evidenceSubmissionIds;
            }
        }
        legacySessionRuntime.api.conversationSessionRestore(legacy);
        const migrated = legacySessionRuntime.api.conversationSessionSnapshot();
        legacySessionMigration = {
            validation: legacySessionRuntime.api.conversationSessionValidate(migrated),
            schemaVersion: migrated.schemaVersion,
            adapterVersion: migrated.adapterVersion,
            defaultsPresent: migrated.sessions.every(session => Array.isArray(session.playerResponses)
                && Array.isArray(session.evidenceSubmissions)
                && Array.isArray(session.followUps)
                && session.sourceEventAnchor === null
                && session.eventDecision === null
                && session.concessions && session.concessions.useExistingCompany === false
                && Array.isArray(session.concessions.withdrawnClaimIds)
                && session.resolution === null)
        };
    } finally {
        legacySessionRuntime.dom.window.close();
    }

    const socialRuntime = createRuntime((seed + 6) >>> 0);
    let socialConversation;
    let socialRaw;
    let socialSnapshot;
    try {
        socialRuntime.api.newCampaign({ seed: seed + 6, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const directory = socialRuntime.api.contactDirectoryBuild();
        const listener = (directory.publicCharacters || []).find(row => row.id !== directory.playerActorId);
        const socialCases = [
            ['Merhaba, iyi günler.', 'GREETING'],
            ['Bugün nasılsın, işler nasıl gidiyor?', 'CHECK_IN'],
            ['Yardımın için teşekkür ederim.', 'THANK'],
            ['Dün söylediklerim için özür dilerim.', 'APOLOGIZE'],
            ['Sence bu konuda ne düşünmeliyim?', 'ASK_PERSONAL_OPINION'],
            ['Bugün hava güzel, biraz konuşalım.', 'SMALL_TALK'],
            ['Bana yardım edecek misin?', 'REQUEST_SUPPORT'],
            ['Görüşürüz, kendine iyi bak.', 'FAREWELL']
        ];
        const beforeWorld = hashSnapshot(stateSnapshot(socialRuntime.api.state()));
        const rows = socialCases.map(([text, expectedAct]) => {
            const result = socialRuntime.api.conversationSessionBegin(text, { listenerActorId: listener && listener.id });
            const session = result.session;
            const response = (session.listenerResponses || []).find(row => row.kind === 'SOCIAL_RESPONSE');
            return {
                text, expectedAct, ok: result.ok, sessionId: session.id,
                speechAct: session.analysis.speechAct,
                status: session.status, response,
                questions: session.questions.length, domainChecks: session.domainChecks.length,
                executable: session.candidate.executable, worldMutation: session.worldMutation
            };
        });
        const checkInRow = rows.find(row => row.expectedAct === 'CHECK_IN');
        const helpFollowUp = checkInRow && socialRuntime.api.conversationSessionFollowUp(
            checkInRow.sessionId, 'evet, bana yardım edecek misin'
        );
        const repeatedHelpFollowUp = checkInRow && socialRuntime.api.conversationSessionFollowUp(
            checkInRow.sessionId, 'evet, bana yardım edecek misin'
        );
        const helpResponse = helpFollowUp && helpFollowUp.followUp && helpFollowUp.followUp.response;
        const repeatedHelpResponse = repeatedHelpFollowUp && repeatedHelpFollowUp.followUp
            && repeatedHelpFollowUp.followUp.response;
        const contextualSession = socialRuntime.api.conversationSessionBegin(
            'Bana yardım edecek misin?', { listenerActorId: listener && listener.id }
        );
        const contextualTurns = [
            'Ordu topluyorum, desteğini istesem kabul eder misin?',
            'Neden?',
            'Aynı şeyi söylüyorsun, soruma doğrudan cevap ver.',
            'Hayır, çelik değil enerji hakkında konuşuyorum.'
        ].map(text => socialRuntime.api.conversationSessionFollowUp(contextualSession.session.id, text));
        const contextualResponses = contextualTurns.map(result =>
            result && result.followUp && result.followUp.response);
        const continuitySession = socialRuntime.api.conversationSessionBegin(
            'Ben bir şirket kuracağım çelik sanayisi üzerine; İngiltere’den verdiğin çelik siparişini depolarıma yönlendirelim.',
            { listenerActorId: listener && listener.id }
        );
        const continuityCheckIn = socialRuntime.api.conversationSessionFollowUp(
            continuitySession.session.id, 'bugün nasılsın'
        );
        const continuityAmbiguous = socialRuntime.api.conversationSessionFollowUp(
            continuitySession.session.id, 'zorbak telemini kırık sazlık'
        );
        const llmValidationContext = {
            discourseAct: 'REPAIR_REPETITION',
            history: [{ speaker: 'CHARACTER', text: 'Önceki cevabım değişmeden kaldı.' }]
        };
        const llmValidation = {
            safeAccepted: socialRuntime.api.conversationLLMParseReply(
                'Haklısın, aynı noktaya döndüm. Bu kez itirazını doğrudan ele alacağım.',
                llmValidationContext
            ),
            numberRejected: socialRuntime.api.conversationLLMParseReply(
                'Haklısın, stokta 40 birim var.', llmValidationContext
            ),
            internalIdRejected: socialRuntime.api.conversationLLMParseReply(
                'Haklısın, character:0:4 bunu onayladı.', llmValidationContext
            ),
            exactRepeatRejected: socialRuntime.api.conversationLLMParseReply(
                'Önceki cevabım değişmeden kaldı.', Object.assign({}, llmValidationContext, {
                    discourseAct: 'CONTINUE_SOCIAL'
                })
            ),
            jsonAccepted: socialRuntime.api.conversationLLMParseReply(JSON.stringify({
                reply: 'Anladım. Destek talebinin niteliğini ve kapsamını netleştirmek için görevini açıkla.'
            }), Object.assign({}, llmValidationContext, { discourseAct: 'CONTINUE_REQUEST', history: [] })),
            unauthorizedPromiseRejected: socialRuntime.api.conversationLLMParseReply(JSON.stringify({
                reply: 'Elbette, destek talebini kabul ettim ve harekete geçiyorum.'
            }), Object.assign({}, llmValidationContext, { discourseAct: 'CONTINUE_REQUEST', history: [] }))
        };
        const qualityCorpus = [
            ['Merhaba, yeniden konuşalım.', 'GREETING'],
            ['Bugün nasılsın, işler yolunda mı?', 'CHECK_IN'],
            ['Yardımın için teşekkür ederim.', 'THANK'],
            ['Önceki sözüm için özür dilerim.', 'APOLOGIZE'],
            ['Sence bu konuda ne düşünüyorsun?', 'ASK_PERSONAL_OPINION'],
            ['Bugün hava sakin, biraz konuşalım.', 'SMALL_TALK'],
            ['Bana bu konuda yardım eder misin?', 'REQUEST_SUPPORT'],
            ['Görüşürüz, kendine iyi bak.', 'FAREWELL'],
            ['Selam, müsaitsen konuşmak isterim.', 'GREETING'],
            ['Hayat nasıl gidiyor, iyi misin?', 'CHECK_IN']
        ];
        const qualityRows = [];
        let longContextSessionId = null;
        for (let sessionIndex = 0; sessionIndex < 3; sessionIndex++) {
            const opened = socialRuntime.api.conversationSessionBegin(
                'Bugün nasılsın?', { listenerActorId: listener && listener.id }
            );
            if (sessionIndex === 0) longContextSessionId = opened.session.id;
            const openingResponse = opened.session.listenerResponses.find(row => row.kind === 'SOCIAL_RESPONSE');
            qualityRows.push({
                ok: !!opened.ok, expectedAct: 'CHECK_IN', speechAct: opened.session.analysis.speechAct,
                text: openingResponse && openingResponse.text,
                source: openingResponse && openingResponse.source,
                realization: openingResponse && openingResponse.realization
            });
            const turnCount = sessionIndex < 2 ? 16 : 15;
            for (let turn = 0; turn < turnCount; turn++) {
                const expected = qualityCorpus[(sessionIndex * 17 + turn) % qualityCorpus.length];
                const result = socialRuntime.api.conversationSessionFollowUp(opened.session.id, expected[0]);
                const response = result && result.followUp && result.followUp.response;
                qualityRows.push({
                    ok: !!(result && result.ok), expectedAct: expected[1],
                    speechAct: result && result.followUp && result.followUp.analysis.speechAct,
                    text: response && response.text,
                    source: response && response.source,
                    realization: response && response.realization
                });
            }
        }
        socialRuntime.api.conversationSessionFollowUp(
            longContextSessionId, 'Bu yalnız bağlam çoğaltma sınaması için benzersiz son iletidir.'
        );
        const longContextSession = socialRuntime.api.conversationSessionGet(longContextSessionId);
        const longContextRows = socialRuntime.api.conversationDiscourseContext(longContextSession);
        const longContextTokens = longContextRows.reduce((sum, row) => sum
            + socialRuntime.api.conversationDiscourseTokenEstimate(row.text) + 6, 0);
        const longLastFollowUp = longContextSession.followUps[longContextSession.followUps.length - 1];
        const generationHistory = socialRuntime.api.conversationDiscourseContext(longContextSession, {
            excludeFollowUpId: longLastFollowUp.id,
            excludeResponseId: longLastFollowUp.response.id
        });
        const qualityTexts = qualityRows.map(row => row.text || '');
        let rollingExactRepeats = 0;
        let adjacentRepeats = 0;
        let maxAddressStreak = 0;
        let addressStreak = 0;
        let previousAddress = null;
        qualityRows.forEach((row, index) => {
            if (index > 0 && row.text === qualityRows[index - 1].text) adjacentRepeats++;
            if (qualityTexts.slice(Math.max(0, index - 12), index).includes(row.text)) rollingExactRepeats++;
            const address = row.realization && row.realization.addressMode;
            if (address && address === previousAddress) addressStreak++;
            else addressStreak = address ? 1 : 0;
            previousAddress = address;
            maxAddressStreak = Math.max(maxAddressStreak, addressStreak);
        });
        const qualityMaxLexicalSimilarity = Math.max(0, ...qualityRows.map(row =>
            Number(row.realization && row.realization.maxRecentSimilarityBps) || 0));
        const qualityMaxSemanticSimilarity = Math.max(0, ...qualityRows.map(row =>
            Number(row.realization && row.realization.maxRecentSemanticSimilarityBps) || 0));
        const afterWorld = hashSnapshot(stateSnapshot(socialRuntime.api.state()));
        const last = rows[rows.length - 1];
        const workspaceSession = socialRuntime.api.conversationSessionLatest(listener && listener.id);
        const workspaceResponse = workspaceSession
            && (workspaceSession.listenerResponses || []).find(row => row.kind === 'SOCIAL_RESPONSE');
        const workspaceOpened = socialRuntime.api.conversationWorkspaceOpen(
            listener && listener.id, listener && listener.name,
            workspaceSession && workspaceSession.id
        );
        socialRuntime.api.conversationWorkspaceRender({ force: true });
        const modal = socialRuntime.dom.window.document.getElementById('conversation-workspace-modal');
        const focusedWorkspaceElement = socialRuntime.dom.window.document.activeElement;
        const workspaceFocusSafe = !!focusedWorkspaceElement
            && focusedWorkspaceElement.matches('[data-conversation-follow-up], [data-conversation-reply], [data-conversation-input]')
            && !focusedWorkspaceElement.matches('[data-conversation-new]');
        const draftBeforeRender = modal && modal.querySelector('[data-conversation-follow-up]');
        const draftText = 'Yazmakta olduğum bu takip mesajı LLM cevabı gelirken silinmemeli.';
        if (draftBeforeRender) {
            draftBeforeRender.value = draftText;
            draftBeforeRender.focus();
            draftBeforeRender.setSelectionRange(18, 34);
            draftBeforeRender.scrollTop = 7;
        }
        socialRuntime.api.conversationWorkspaceRender({ scroll: 'preserve', force: true });
        const draftAfterRender = modal && modal.querySelector('[data-conversation-follow-up]');
        const draftSurvivedRerender = !!draftAfterRender
            && draftAfterRender !== draftBeforeRender
            && draftAfterRender.value === draftText
            && socialRuntime.dom.window.document.activeElement === draftAfterRender
            && draftAfterRender.selectionStart === 18
            && draftAfterRender.selectionEnd === 34;
        socialRuntime.api.conversationWorkspaceRender({
            scroll: 'preserve', deferWhileTyping: true
        });
        const draftDeferredWithoutReplacement = !!draftAfterRender
            && modal.querySelector('[data-conversation-follow-up]') === draftAfterRender
            && draftAfterRender.value === draftText
            && modal.dataset.pendingConversationRender === '1';
        const modalText = modal && modal.textContent || '';
        const secondParticipant = (directory.publicCharacters || []).find(row =>
            row.id !== (listener && listener.id) && row.id !== directory.playerActorId);
        const activeInternalSession = socialRuntime.api.state().conversationUnderstanding.sessions.find(row =>
            row.id === socialRuntime.api.conversationSessionLatest(listener && listener.id).id);
        if (activeInternalSession) activeInternalSession.participantActorIds = [
            listener && listener.id, secondParticipant && secondParticipant.id, 'character:unknown:guest'
        ].filter(Boolean);
        socialRuntime.api.conversationWorkspaceRender({ force: true });
        const participantCards = modal ? [...modal.querySelectorAll('[data-conversation-participant]')] : [];
        const participantText = modal && modal.querySelector('#conversation-workspace-profile')
            ? modal.querySelector('#conversation-workspace-profile').textContent : '';
        if (activeInternalSession) delete activeInternalSession.participantActorIds;
        socialRuntime.api.conversationWorkspaceRender({ force: true });
        socialSnapshot = socialRuntime.api.conversationSessionSnapshot();
        const saveStatus = socialRuntime.api.saveNow();
        socialRaw = socialRuntime.api.savedRaw();
        // Bilinmeyen açılış probu kalıcı kayıt örneğini ve "son oturum" UI
        // seçimlerini etkilememeli; ana ekran ölçümleri/snapshot alındıktan sonra
        // aynı gerçek motor üzerinde ayrı bir geçici oturum olarak sınanır.
        const unknownOpening = socialRuntime.api.conversationSessionBegin(
            'zorbak telemini kırık sazlık', { listenerActorId: listener && listener.id }
        );
        const unknownOpeningResponse = unknownOpening.session
            && (unknownOpening.session.listenerResponses || []).find(row => row.kind === 'SOCIAL_RESPONSE');
        socialConversation = {
            listenerExists: !!listener,
            rows,
            actsExact: rows.every(row => row.speechAct === row.expectedAct),
            allUnderstood: rows.every(row => row.ok && row.status === 'SOCIAL_RESPONSE_READY'),
            allResponded: rows.every(row => row.response && row.response.text
                && row.response.actorId === (listener && listener.id)),
            allRealizationsValid: rows.every(row => !row.response.realization
                || socialRuntime.api.characterDialogueValidate(row.response.realization).ok),
            noMechanicalQuestions: rows.every(row => row.questions === 0 && row.domainChecks === 0),
            allNonExecutable: rows.every(row => row.executable === false && row.worldMutation === false
                && row.response.worldMutation === false),
            worldNeutral: beforeWorld === afterWorld,
            distinctResponses: new Set(rows.map(row => row.response && row.response.text)).size === rows.length,
            unknownOpeningClarifies: !!unknownOpeningResponse
                && unknownOpening.session.status === 'SOCIAL_RESPONSE_READY'
                && unknownOpeningResponse.speechAct === 'UNKNOWN'
                && /açık|anlat|beklediğini/i.test(unknownOpeningResponse.text),
            workspaceFocusSafe,
            draftSurvivedRerender,
            draftDeferredWithoutReplacement,
            helpFollowUpUnderstood: !!helpFollowUp && helpFollowUp.ok
                && helpFollowUp.followUp.analysis.speechAct === 'REQUEST_SUPPORT'
                && !!helpResponse && helpResponse.source === 'DETERMINISTIC_DISCOURSE_RESPONSE'
                && helpResponse.discourseAct === 'CONTINUE_REQUEST'
                && /yardım talebini/i.test(helpResponse.text)
                && !helpResponse.text.includes('Seni dinliyorum'),
            repeatedHelpVaries: !!repeatedHelpResponse
                && repeatedHelpResponse.source === 'DETERMINISTIC_DISCOURSE_RESPONSE'
                && !repeatedHelpResponse.text.includes('Seni dinliyorum')
                && repeatedHelpResponse.discourseAct === 'REPAIR_REPETITION'
                && repeatedHelpResponse.text !== helpResponse.text,
            contextualFollowUp: {
                militaryAnswer: !!contextualResponses[0]
                    && contextualTurns[0].followUp.analysis.speechAct === 'REQUEST_SUPPORT'
                    && contextualResponses[0].discourseAct === 'CONTINUE_REQUEST'
                    && /askerî destek|ordu/i.test(contextualResponses[0].text),
                reasonTracksPriorPosition: !!contextualResponses[1]
                    && contextualResponses[1].discourseAct === 'ASK_REASON'
                    && /gerekçe|nedeni/i.test(contextualResponses[1].text),
                repetitionRepair: !!contextualResponses[2]
                    && contextualResponses[2].discourseAct === 'REPAIR_REPETITION'
                    && /aynı kalıp|doğrudan cevap/i.test(contextualResponses[2].text),
                correctionApplied: !!contextualResponses[3]
                    && contextualResponses[3].discourseAct === 'CORRECT_PREVIOUS_TOPIC'
                    && /enerji/i.test(contextualResponses[3].text),
                statePersisted: !!(contextualTurns[3] && contextualTurns[3].session
                    && contextualTurns[3].session.discourseState
                    && contextualTurns[3].session.discourseState.lastDiscourseAct === 'CORRECT_PREVIOUS_TOPIC'
                    && /enerji/i.test(contextualTurns[3].session.discourseState.lastPlayerText)),
                noWorldMutation: contextualTurns.every(result => result && result.worldMutation === false)
            },
            sessionContinuity: {
                checkInStaysSameSession: !!continuityCheckIn && continuityCheckIn.ok
                    && continuityCheckIn.session.id === continuitySession.session.id,
                checkInIsSocialNotPreviousAnswer: !!continuityCheckIn
                    && continuityCheckIn.followUp.analysis.speechAct === 'CHECK_IN'
                    && continuityCheckIn.followUp.response.discourseAct === 'CONTINUE_SOCIAL',
                activeTopicPreserved: !!continuityCheckIn
                    && continuityCheckIn.followUp.inheritedTopic === 'COMMERCE'
                    && continuityCheckIn.session.discourseState.activeTopic === 'COMMERCE',
                ambiguousRequestsRepair: !!continuityAmbiguous && continuityAmbiguous.ok
                    && continuityAmbiguous.followUp.analysis.speechAct === 'UNKNOWN'
                    && continuityAmbiguous.followUp.response.discourseAct === 'CLARIFY_AMBIGUOUS_INPUT'
                    && /bağlayamadım|kastettiğini/i.test(continuityAmbiguous.followUp.response.text),
                longHistoryExceedsOldFiveTurnWindow: longContextRows.length > 10,
                longHistoryWithinModelBudget: longContextTokens
                    <= socialRuntime.api.conversationHistoryTokenBudget(),
                currentTurnNotDuplicatedInGenerationHistory: !generationHistory.some(row =>
                    row.text === longLastFollowUp.playerText
                    || row.text === longLastFollowUp.response.text),
                historyRows: longContextRows.length,
                estimatedTokens: longContextTokens,
                budget: socialRuntime.api.conversationHistoryTokenBudget()
            },
            llmOutputGate: {
                safeAccepted: !!llmValidation.safeAccepted,
                numberRejected: llmValidation.numberRejected === null,
                internalIdRejected: llmValidation.internalIdRejected === null,
                exactRepeatRejected: llmValidation.exactRepeatRejected === null,
                jsonAccepted: !!llmValidation.jsonAccepted,
                unauthorizedPromiseRejected: llmValidation.unauthorizedPromiseRejected === null
            },
            fiftyTurnQualityGate: {
                turnCount: qualityRows.length,
                allAccepted: qualityRows.every(row => row.ok),
                intentsExact: qualityRows.every(row => row.speechAct === row.expectedAct),
                allCharacterRealized: qualityRows.every(row => row.source === 'CHARACTER_DIALOGUE_REALIZER'
                    ? row.realization && socialRuntime.api.characterDialogueValidate(row.realization).ok
                    : row.source === 'DETERMINISTIC_DISCOURSE_RESPONSE'),
                exactUniqueCount: new Set(qualityTexts).size,
                adjacentRepeats,
                rollingExactRepeats,
                maxAddressStreak,
                maxLexicalSimilarityBps: qualityMaxLexicalSimilarity,
                maxSemanticSimilarityBps: qualityMaxSemanticSimilarity,
                forbiddenFallbackCount: qualityTexts.filter(text => /Seni dinliyorum/i.test(text)).length,
                passed: qualityRows.length === 50
                    && qualityRows.every(row => row.ok && row.speechAct === row.expectedAct
                        && (row.source === 'DETERMINISTIC_DISCOURSE_RESPONSE'
                            || (row.source === 'CHARACTER_DIALOGUE_REALIZER' && row.realization
                                && socialRuntime.api.characterDialogueValidate(row.realization).ok)))
                    && adjacentRepeats === 0 && new Set(qualityTexts).size >= 16
                    && maxAddressStreak <= 2
                    && qualityMaxLexicalSimilarity <= 7200
                    && qualityMaxSemanticSimilarity <= 8600
                    && qualityTexts.every(text => !/Seni dinliyorum/i.test(text))
            },
            workspaceOpened,
            uiShowsResponse: !!workspaceResponse && modalText.includes('KARAKTERİN CEVABI')
                && modalText.includes(workspaceResponse.text),
            uiShowsSocialSafety: modalText.includes('GÜNLÜK SOHBET') && modalText.includes('DÜNYA DEĞİŞMEDİ'),
            multiParticipantProfileReady: !!secondParticipant && participantCards.length === 3
                && participantCards.some(card => card.dataset.conversationParticipant === secondParticipant.id),
            unknownParticipantProtected: participantCards.some(card =>
                card.dataset.conversationParticipant === 'character:unknown:guest')
                && participantText.includes('Bilinmeyen katılımcı')
                && participantText.includes('KİMLİK DOĞRULANMADI')
                && participantText.includes('Bilinmiyor'),
            ledgerValidation: socialRuntime.api.conversationSessionValidate(socialSnapshot),
            saveStatus
        };
    } finally {
        socialRuntime.dom.window.close();
    }

    const restoredSocialRuntime = createRuntime((seed + 7) >>> 0);
    try {
        restoredSocialRuntime.api.putSavedRaw(socialRaw);
        const loaded = restoredSocialRuntime.api.loadNow();
        const restored = restoredSocialRuntime.api.conversationSessionSnapshot();
        socialConversation.restored = {
            loaded,
            exact: JSON.stringify(restored) === JSON.stringify(socialSnapshot),
            validation: restoredSocialRuntime.api.conversationSessionValidate(restored),
            responseCount: (restored.sessions || []).reduce((sum, session) => sum
                + (session.listenerResponses || []).filter(row => row.kind === 'SOCIAL_RESPONSE').length, 0)
        };
    } finally {
        restoredSocialRuntime.dom.window.close();
    }

    const eventConversationRuntime = createRuntime((seed + 8) >>> 0);
    let phase385EventConversation;
    let eventConversationRaw;
    let eventConversationSnapshot;
    try {
        eventConversationRuntime.api.newCampaign({
            seed: seed + 8, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true
        });
        eventConversationRuntime.api.advance(5);
        const story = eventConversationRuntime.api.state();
        const state = story.states.find(row => Number(row.id) === 0);
        state.welfare = 12;
        if (state.factions) {
            state.factions.workers = 22;
            state.factions.business = 28;
            state.factions.military = 12;
            state.factions.intel = 20;
            state.factions.radicals = 82;
        }
        for (const [index, commander] of (state.gov && state.gov.commanders || []).slice(0, 3).entries()) {
            commander.loyalty = 20 + index * 3;
            commander._lastDefect = story.clock;
            commander.skills.warrior = Math.max(4, commander.skills.warrior || 0);
            commander.skills.diplomat = Math.max(3, commander.skills.diplomat || 0);
        }
        for (const commander of (state.gov && state.gov.commanders || []).slice(3)) {
            commander.loyalty = Math.max(78, Number(commander.loyalty) || 0);
        }
        if (story.commander && story.commander.res) story.commander.res.points = 500;
        eventConversationRuntime.api.politicalCrisisTick(5);
        const active = eventConversationRuntime.api.politicalCrisisCountryView('country:0').activeCrisis;
        const playerActorId = `character:0:${story.commander.id}`;
        const counselActorIds = active ? [active.leadActorId].concat(active.loyalistActorIds || [])
            .filter((actorId, index, rows) => actorId && actorId !== playerActorId
                && rows.indexOf(actorId) === index).slice(0, 3) : [];
        if (counselActorIds[0]) eventConversationRuntime.api.relationshipAdjust(
            counselActorIds[0], playerActorId,
            { trustBps: 3200, respectBps: 2200, hostilityBps: -1200 },
            { source: 'PHASE385_FIXTURE', reason: 'SUPPORTIVE_COUNSEL' }
        );
        if (counselActorIds[2]) eventConversationRuntime.api.relationshipAdjust(
            counselActorIds[2], playerActorId,
            { trustBps: -5200, respectBps: -2500, hostilityBps: 9000 },
            { source: 'PHASE385_FIXTURE', reason: 'HOSTILE_COUNSEL' }
        );
        const physicalSnapshot = () => hashSnapshot({
            states: story.states,
            rel: story.rel,
            politicalCrises: story.politicalCrises,
            institutions: story.institutions,
            characterActions: story.characterActions
        });
        const physicalDetail = () => ({
            states: hashSnapshot(story.states),
            rel: hashSnapshot(story.rel),
            politicalCrises: hashSnapshot(story.politicalCrises),
            institutions: hashSnapshot(story.institutions),
            characterActions: hashSnapshot(story.characterActions)
        });
        story._talkOpen = true;
        story._talkView = 'CHAT';
        eventConversationRuntime.api.talkBind();
        eventConversationRuntime.api.talkUpdate();
        // Çalışma alanının salt-okunur projeksiyon önbelleklerini önce ısıt; ölçüm
        // ve test fikstürünün bütçe aynasını bir kez uzlaştır. Ölçüm yalnız
        // konuşma/yanıt üretiminin fiziksel dünyaya etkisini kapsasın.
        eventConversationRuntime.api.saveNow();
        const beforeWorld = physicalSnapshot();
        const beforeWorldDetail = physicalDetail();
        const document = eventConversationRuntime.dom.window.document;
        const body = document.getElementById('talk-body');
        const eventButtons = body ? [...body.querySelectorAll('[data-conversation-event-open]')] : [];
        const eventButton = eventButtons[0];
        if (eventButton) {
            eventButton.dispatchEvent(new eventConversationRuntime.dom.window.MouseEvent('click', { bubbles: true }));
        }
        const modal = document.getElementById('conversation-workspace-modal');
        const eventWorkspaceOpened = !!modal && !modal.classList.contains('hidden');
        const initialText = 'Darbe söylentisinde ordunun tarafsız kalmasını sağla. Karşılığında yeni hükümette savunma reformunu sen yöneteceksin.';
        const input = modal && modal.querySelector('[data-conversation-input]');
        if (input) input.value = initialText;
        const send = modal && modal.querySelector('[data-conversation-send]');
        if (send) send.dispatchEvent(new eventConversationRuntime.dom.window.MouseEvent('click', { bubbles: true }));
        const started = active && eventConversationRuntime.api.conversationSessionLatest(active.leadActorId);
        const sourceEvent = started && started.sourceEventAnchor && (story.politicalCrises.events || [])
            .find(row => row.id === started.sourceEventAnchor.sourceEventId);
        const followUpInput = modal && modal.querySelector('[data-conversation-follow-up]');
        if (followUpInput) followUpInput.value = 'Bunu hangi kanıta dayanarak söylüyorsun?';
        const followUpSend = modal && modal.querySelector('[data-conversation-follow-up-send]');
        if (followUpSend) {
            followUpSend.dispatchEvent(new eventConversationRuntime.dom.window.MouseEvent('click', { bubbles: true }));
        }
        const completed = started && eventConversationRuntime.api.conversationSessionGet(started.id);
        const followUp = completed && completed.followUps && completed.followUps[0];
        const parallelSessions = [completed];
        for (const actorId of counselActorIds.slice(1)) {
            const result = eventConversationRuntime.api.conversationSessionBegin(initialText, {
                listenerActorId: actorId,
                sourceEventAnchor: { kind: 'POLITICAL_CRISIS', politicalCrisisId: active.id }
            });
            parallelSessions.push(result && result.session || null);
        }
        const counselResponses = parallelSessions.map(session => session
            && (session.listenerResponses || []).find(row => row.kind === 'EVENT_COUNSEL_RESPONSE')).filter(Boolean);
        const sessionCountBeforeForgery = eventConversationRuntime.api.conversationSessionSnapshot().sessions.length;
        const forged = eventConversationRuntime.api.conversationSessionBegin('Bu sahte krizi konuşalım.', {
            listenerActorId: active && active.leadActorId,
            sourceEventAnchor: {
                kind: 'POLITICAL_CRISIS', politicalCrisisId: 'political-crisis:forged'
            }
        });
        const sessionCountAfterForgery = eventConversationRuntime.api.conversationSessionSnapshot().sessions.length;
        const afterWorld = physicalSnapshot();
        const afterWorldDetail = physicalDetail();
        const modalText = modal && modal.textContent || '';
        phase385EventConversation = {
            crisisOpened: !!active,
            eventButtonPresent: !!eventButton,
            threeCharacterButtons: eventButtons.length >= 3,
            eventWorkspaceOpened,
            eventContextVisible: modalText.includes('DÜNYA OLAYINDAN AÇILDI')
                && !!active && modalText.includes(active.id),
            sessionStarted: !!started,
            actualEventBound: !!sourceEvent && started.sourceEventAnchor.verification
                === 'PLAYER_VISIBLE_POLITICAL_CRISIS_EVENT'
                && started.sourceEventAnchor.rawWorldRead === false,
            crisisEntityBound: !!started && started.sourceEventAnchor.politicalCrisisId === active.id
                && started.analysis.entities.some(row => row.entityType === 'POLITICAL_CRISIS'
                    && row.entityId === active.id),
            followUpRecorded: !!followUp && completed.followUps.length === 1
                && completed.candidate.followUpIds.includes(followUp.id),
            followUpTopicInherited: !!followUp && followUp.analysis.speechAct === 'ASK_INFORMATION'
                && followUp.inheritedTopic === 'POLITICAL_SUCCESSION',
            responseEvidenceBound: !!followUp && followUp.response.source
                === 'DETERMINISTIC_CONTEXT_BOUND_RESPONSE'
                && followUp.response.rawWorldRead === false
                && followUp.response.evidenceIds.includes(active.id)
                && followUp.response.evidenceIds.includes(sourceEvent && sourceEvent.id),
            noHiddenIntentLeak: !!followUp
                && followUp.response.text.includes('gizli niyetini kesin bilgi gibi sunamam'),
            uiThreadVisible: modalText.includes(initialText)
                && modalText.includes('Bunu hangi kanıta dayanarak söylüyorsun?')
                && !!followUp && modalText.includes(followUp.response.text),
            forgedAnchorRejected: forged.ok === false && forged.code === 'EVENT_ANCHOR_NOT_VISIBLE'
                && sessionCountAfterForgery === sessionCountBeforeForgery,
            worldNeutral: beforeWorld === afterWorld,
            worldNeutralDetail: Object.fromEntries(Object.keys(beforeWorldDetail).map(key => [key, {
                before: beforeWorldDetail[key], after: afterWorldDetail[key],
                exact: beforeWorldDetail[key] === afterWorldDetail[key]
            }])),
            threeCounselResponses: counselResponses.length === 3,
            contextResponsesDiffer: new Set(counselResponses.map(row => row.text)).size === 3
                && new Set(counselResponses.map(row => row.recommendation.posture)).size >= 2,
            recommendationsGrounded: counselResponses.every(row => row.source
                === 'IDENTITY_RELATIONSHIP_EVENT_COUNSEL'
                && row.rawWorldRead === false && row.worldMutation === false
                && row.recommendation && row.recommendation.reasonCode
                && row.recommendation.relationshipBasis),
            ledgerValidation: eventConversationRuntime.api.conversationSessionValidate(eventConversationSnapshot)
        };
        const acceptedSourceSession = parallelSessions.find(session => {
            const counsel = session && (session.listenerResponses || [])
                .find(row => row.kind === 'EVENT_COUNSEL_RESPONSE');
            return counsel && counsel.recommendation.canCommit;
        });
        const acceptedCounsel = acceptedSourceSession && (acceptedSourceSession.listenerResponses || [])
            .find(row => row.kind === 'EVENT_COUNSEL_RESPONSE');
        story._conversationWorkspaceSessionId = acceptedSourceSession && acceptedSourceSession.id;
        if (acceptedSourceSession) {
            modal.dataset.listenerActorId = acceptedSourceSession.listenerActorId;
            eventConversationRuntime.api.conversationWorkspaceRender();
        }
        const relationBeforeAcceptance = acceptedSourceSession
            ? eventConversationRuntime.api.relationshipView(acceptedSourceSession.listenerActorId, playerActorId) : null;
        const historyBeforeAcceptance = active && active.actionHistory.length || 0;
        const acceptButton = modal && modal.querySelector('[data-conversation-event-decision="ACCEPT_RECOMMENDATION"]');
        if (acceptButton) acceptButton.dispatchEvent(
            new eventConversationRuntime.dom.window.MouseEvent('click', { bubbles: true })
        );
        const acceptedSession = acceptedSourceSession
            ? eventConversationRuntime.api.conversationSessionGet(acceptedSourceSession.id) : null;
        const activeAfterAcceptance = eventConversationRuntime.api.politicalCrisisCountryView('country:0').activeCrisis;
        const relationAfterAcceptance = acceptedSourceSession
            ? eventConversationRuntime.api.relationshipView(acceptedSourceSession.listenerActorId, playerActorId) : null;
        const duplicate = acceptedSourceSession
            ? eventConversationRuntime.api.conversationSessionEventDecision(
                acceptedSourceSession.id, 'ACCEPT_RECOMMENDATION'
            ) : null;
        const activeAfterDuplicate = eventConversationRuntime.api.politicalCrisisCountryView('country:0').activeCrisis;
        phase385EventConversation.acceptanceButtonPresent = !!acceptButton;
        phase385EventConversation.explicitAcceptanceApplied = !!acceptedSession
            && acceptedSession.eventDecision && acceptedSession.eventDecision.status === 'APPLIED'
            && acceptedSession.eventDecision.actionId === acceptedCounsel.recommendation.actionId
            && (activeAfterAcceptance.actionHistory || []).length === historyBeforeAcceptance + 1;
        phase385EventConversation.canonicalActionTrace = !!acceptedSession
            && (activeAfterAcceptance.actionHistory || []).some(row => row.sequence
                === acceptedSession.eventDecision.crisisActionSequence
                && row.sourceConversationSessionId === acceptedSession.id
                && row.sourceConversationResponseId === acceptedCounsel.id
                && row.decisionSource === 'CONVERSATION_EVENT_DECISION');
        phase385EventConversation.relationshipChanged = !!relationBeforeAcceptance && !!relationAfterAcceptance
            && ['trustBps', 'respectBps', 'hostilityBps', 'debtBps'].some(axis =>
                Number(relationBeforeAcceptance[axis]) !== Number(relationAfterAcceptance[axis]));
        const relationshipReceipt = acceptedSession && acceptedSession.eventDecision
            && acceptedSession.eventDecision.relationshipReceipt;
        phase385EventConversation.relationshipReceiptAccurate = !!relationshipReceipt
            && JSON.stringify(relationshipReceipt.before) === JSON.stringify(relationBeforeAcceptance)
            && JSON.stringify(relationshipReceipt.after) === JSON.stringify(relationAfterAcceptance);
        phase385EventConversation.acceptanceIdempotent = !!duplicate
            && duplicate.ok === false && duplicate.code === 'EVENT_DECISION_EXISTS'
            && (activeAfterDuplicate.actionHistory || []).length === (activeAfterAcceptance.actionHistory || []).length
            && JSON.stringify(eventConversationRuntime.api.relationshipView(
                acceptedSourceSession.listenerActorId, playerActorId
            )) === JSON.stringify(relationAfterAcceptance);
        const decisionMemory = acceptedSession && acceptedSession.eventDecision
            && acceptedSession.eventDecision.memoryEpisodeId
            && eventConversationRuntime.api.characterMemoryLedger().episodes[
                acceptedSession.eventDecision.memoryEpisodeId
            ];
        const heldRecall = acceptedSourceSession ? eventConversationRuntime.api.characterMemoryRecall(
            acceptedSourceSession.listenerActorId,
            { sourceIds: [active.id], relatedActorId: playerActorId, limit: 3 }
        ) : null;
        const laterStart = acceptedSourceSession && eventConversationRuntime.api.conversationSessionBegin(
            'Merhaba, önceki görüşmemize dönmek istiyorum.',
            { listenerActorId: acceptedSourceSession.listenerActorId }
        );
        const laterFollowUp = laterStart && laterStart.session
            ? eventConversationRuntime.api.conversationSessionFollowUp(
                laterStart.session.id,
                'Geçen krizde verdiğin tavsiyeyi ve kararımı hatırlıyor musun?'
            ) : null;
        const recalledResponse = laterFollowUp && laterFollowUp.followUp
            && laterFollowUp.followUp.response;
        phase385EventConversation.decisionMemoryRecorded = !!decisionMemory
            && decisionMemory.status === 'RESOLVED'
            && decisionMemory.participantActorIds.includes(acceptedSourceSession.listenerActorId)
            && decisionMemory.participantActorIds.includes(playerActorId)
            && decisionMemory.source.conversationDecisionId === acceptedSession.eventDecision.id;
        phase385EventConversation.heldRecallSourceBound = !!heldRecall && heldRecall.ok
            && heldRecall.rawWorldRead === false && heldRecall.records.length > 0
            && heldRecall.records.some(row => row.horizon === 'MEDIUM'
                && row.sourceEvidenceIds.includes(active.id)
                && row.sourceEvidenceIds.includes(acceptedSession.eventDecision.id));
        phase385EventConversation.laterConversationRecall = !!recalledResponse
            && recalledResponse.source === 'CHARACTER_HELD_MEMORY_RECALL'
            && recalledResponse.rawWorldRead === false
            && recalledResponse.worldMutation === false
            && recalledResponse.memoryRecall.records.some(row => row.horizon === 'MEDIUM')
            && recalledResponse.text.includes(acceptedSession.eventDecision.crisisResultCode);
        eventConversationSnapshot = eventConversationRuntime.api.conversationSessionSnapshot();
        phase385EventConversation.ledgerValidation = eventConversationRuntime.api.conversationSessionValidate(eventConversationSnapshot);
        eventConversationRuntime.api.saveNow();
        eventConversationRaw = eventConversationRuntime.api.savedRaw();
    } finally {
        eventConversationRuntime.dom.window.close();
    }

    const restoredEventConversationRuntime = createRuntime((seed + 9) >>> 0);
    try {
        restoredEventConversationRuntime.api.putSavedRaw(eventConversationRaw);
        const loaded = restoredEventConversationRuntime.api.loadNow();
        const restored = restoredEventConversationRuntime.api.conversationSessionSnapshot();
        phase385EventConversation.restored = {
            loaded,
            exact: JSON.stringify(restored) === JSON.stringify(eventConversationSnapshot),
            validation: restoredEventConversationRuntime.api.conversationSessionValidate(restored),
            eventAnchoredSessions: restored.diagnostics.eventAnchoredSessions,
            followUps: restored.diagnostics.followUps,
            memoryRecalls: restored.diagnostics.memoryRecalls
        };
    } finally {
        restoredEventConversationRuntime.dom.window.close();
    }

    const disabledRuntime = createRuntime((seed + 2) >>> 0);
    let disabled;
    let disabledSaveOk;
    try {
        disabledRuntime.api.newCampaign({
            seed: seed + 2, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'characters.conversationUnderstanding': false }
        });
        disabled = disabledRuntime.api.conversationAnalyze(input, context);
        disabledSaveOk = disabledRuntime.api.state()._lastSaveOk !== false;
    } finally {
        disabledRuntime.dom.window.close();
    }

    const dependencyRuntime = createRuntime((seed + 3) >>> 0);
    let dependencyDisabled;
    try {
        dependencyRuntime.api.newCampaign({
            seed: seed + 3, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'economy.resourceTaxonomy': false }
        });
        dependencyDisabled = dependencyRuntime.api.conversationAnalyze(input, context);
    } finally {
        dependencyRuntime.dom.window.close();
    }

    return Object.assign({}, main, {
        roleResolution,
        restoredSession,
        legacySessionMigration,
        socialConversation,
        phase385EventConversation,
        disabledSafe: disabled.ok === false && disabled.code === 'FEATURE_DISABLED'
            && disabled.worldMutation === false && disabled.proposedCommand === null
            && disabledSaveOk,
        dependencyDisabledSafe: dependencyDisabled.ok === false
            && dependencyDisabled.code === 'FEATURE_DISABLED'
            && dependencyDisabled.worldMutation === false && dependencyDisabled.proposedCommand === null
    });
}

function probeCharacterArbiter(seed = 2032) {
    const runtime = createRuntime(seed >>> 0);
    let main;
    try {
        runtime.api.newCampaign({ seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const story = runtime.api.state();
        const beforeHash = hashSnapshot(stateSnapshot(story));
        const identityLedger = runtime.api.characterIdentityLedger();
        const playerActorId = story.commander ? `character:0:${story.commander.id}` : null;
        const actors = Object.values(identityLedger.identities || {})
            .filter(row => row.id !== playerActorId)
            .sort((a, b) => a.id.localeCompare(b.id, 'en'));
        let actor = null;
        let ranked = [];
        for (const candidateActor of actors) {
            const actorRanked = runtime.api.characterActionAIRankActor(candidateActor.id);
            if (!actorRanked.length) continue;
            actor = candidateActor;
            ranked = actorRanked;
            break;
        }
        const request = runtime.api.characterArbiterBuildRequest(actor && actor.id, { ranked });
        const jsonSchema = runtime.api.characterArbiterJsonSchema(request);
        const grammarBranches = jsonSchema.oneOf || [];
        const grammarChoices = Array.from(new Set(grammarBranches.flatMap(branch => {
            const choice = branch.properties && branch.properties.choiceId;
            if (!choice) return [];
            if (Array.isArray(choice.enum)) return choice.enum;
            return Object.prototype.hasOwnProperty.call(choice, 'const') ? [choice.const] : [];
        })));
        const repeatedRequest = runtime.api.characterArbiterBuildRequest(actor && actor.id, { ranked });
        const offered = request.context && request.context.candidates && request.context.candidates[0];
        const validOutput = {
            schemaVersion: 2,
            requestId: request.requestId,
            verdict: 'PROPOSE',
            choiceId: offered && offered.choiceId,
            reasonCode: 'GOAL_ALIGNMENT',
            speechPlan: {
                opening: 'STATE_POSITION_FIRST', tone: 'MEASURED',
                address: 'FORMAL_TITLE', emphasis: ['GOAL', 'RISK']
            }
        };
        const valid = runtime.api.characterArbiterResolve(request, JSON.stringify(validOutput));
        const fenced = runtime.api.characterArbiterResolve(request, `\n\`\`\`json\n${JSON.stringify(validOutput)}\n\`\`\``);
        const unknownCandidate = JSON.parse(JSON.stringify(validOutput));
        unknownCandidate.choiceId = 'QFFFF';
        const unknown = runtime.api.characterArbiterResolve(request, unknownCandidate);
        const mismatchedAction = JSON.parse(JSON.stringify(validOutput));
        mismatchedAction.actionType = offered && offered.actionType === 'ALLY' ? 'BETRAY' : 'ALLY';
        const mismatch = runtime.api.characterArbiterResolve(request, mismatchedAction);
        const injectedField = JSON.parse(JSON.stringify(validOutput));
        injectedField.successChanceBps = 10000;
        const injected = runtime.api.characterArbiterResolve(request, injectedField);
        const malformed = runtime.api.characterArbiterResolve(request, '{not-json');
        const fallbackA = runtime.api.characterArbiterFallback(request, 'TEST');
        const fallbackB = runtime.api.characterArbiterFallback(request, 'TEST');
        const requestText = JSON.stringify(request);
        const afterHash = hashSnapshot(stateSnapshot(story));
        main = {
            actorId: actor && actor.id,
            requestId: request.requestId,
            rankedCount: ranked.length,
            requestOk: request.ok,
            requestDeterministic: JSON.stringify(request) === JSON.stringify(repeatedRequest),
            candidateCount: request.context && request.context.candidates.length,
            candidateCap: 8,
            grammarRequestId: grammarBranches[0]
                && grammarBranches[0].properties.requestId.const,
            grammarChoices,
            validSource: valid.source,
            validValidation: valid.validation,
            fencedSource: fenced.source,
            unknownFallback: unknown.source,
            unknownReason: unknown.rejectedReason,
            mismatchFallback: mismatch.source,
            mismatchReason: mismatch.rejectedReason,
            injectedFallback: injected.source,
            injectedReason: injected.rejectedReason,
            malformedFallback: malformed.source,
            malformedReason: malformed.rejectedReason,
            fallbackDeterministic: JSON.stringify(fallbackA) === JSON.stringify(fallbackB),
            proposalOnly: valid.proposalOnly && valid.worldMutation === false,
            forbiddenContextLeak: /regionId|serviceId|damageBps|effectiveCapacity|successChanceBps|detectionChanceBps/
                .test(requestText),
            worldNeutral: beforeHash === afterHash,
            beforeHash,
            afterHash,
            diagnostics: runtime.api.characterArbiterDiagnostics()
        };
    } finally {
        runtime.dom.window.close();
    }

    const disabledRuntime = createRuntime(seed >>> 0);
    let disabled;
    try {
        disabledRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'characters.llmArbiter': false }
        });
        const actorId = Object.keys(disabledRuntime.api.characterIdentityLedger().identities || {})[0];
        disabled = disabledRuntime.api.characterArbiterBuildRequest(actorId);
    } finally {
        disabledRuntime.dom.window.close();
    }

    const dependencyRuntime = createRuntime(seed >>> 0);
    let dependencyDisabled;
    try {
        dependencyRuntime.api.newCampaign({
            seed, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true,
            featureFlags: { 'characters.actionCandidates': false }
        });
        const actorId = Object.keys(dependencyRuntime.api.characterIdentityLedger().identities || {})[0];
        dependencyDisabled = dependencyRuntime.api.characterArbiterBuildRequest(actorId);
    } finally {
        dependencyRuntime.dom.window.close();
    }
    return {
        main, disabled, dependencyDisabled,
        liveAccepted: probeCharacterArbiterLiveCase((seed + 11) >>> 0, 'ACCEPT'),
        livePass: probeCharacterArbiterLiveCase((seed + 12) >>> 0, 'PASS'),
        liveLate: probeCharacterArbiterLiveCase((seed + 13) >>> 0, 'LATE'),
        liveStale: probeCharacterArbiterLiveCase((seed + 14) >>> 0, 'STALE'),
        pendingRestore: probeCharacterArbiterPendingRestore((seed + 15) >>> 0),
        decisionLedger: probeCharacterArbiterDecisionLedger((seed + 16) >>> 0)
    };
}

function probeNegotiationDeliveryLifecycle(seed = 2032) {
    function run(mode, offset) {
        const runtime = createRuntime((seed + offset) >>> 0);
        try {
            runtime.api.newCampaign({ seed: seed + offset, playerStateId: 0, abundance: 1,
                doctrine: 'combined', fog: true });
            const story = runtime.api.state();
            story.commander.creationRole = 'COMPANY_OWNER';
            story.playerRole = 'COMPANY_OWNER';
            const binding = runtime.api.characterBindPlayerRole();
            const buyerCompany = story.companyEconomy.companies[binding.organizationId];
            const identities = Object.values(story.characterIdentities.identities || {});
            const buyerActor = identities.find(row => row.organizationId === buyerCompany.id) || identities[0];
            const sellerActor = identities.find(row => row.id !== buyerActor.id);
            buyerActor.organizationId = buyerCompany.id;

            const countryNodes = story.nodes.filter(row => row.owner === 0);
            const sourceNode = countryNodes.find(row => (row.neighbors || []).some(id =>
                story.nodes[id] && story.nodes[id].owner === 0));
            const targetNode = sourceNode && story.nodes[(sourceNode.neighbors || []).find(id =>
                story.nodes[id] && story.nodes[id].owner === 0)];
            const destinationNode = countryNodes.find(row => row.id !== sourceNode.id
                && row.id !== targetNode.id
                && story.companyEconomy.warehouses[`warehouse:${row.id}:general`]
                && runtime.api.infrastructureFindRoute(`region:${sourceNode.id}`, `region:${row.id}`, {
                    modes: ['LAND', 'SEA'], authorizedCountryIds: ['country:0']
                }).ok);
            if (!sourceNode || !targetNode || !destinationNode) {
                return { ok: false, code: 'DELIVERY_FIXTURE_ROUTE_MISSING' };
            }
            const sourceRegionId = `region:${sourceNode.id}`;
            const targetRegionId = `region:${targetNode.id}`;
            const destinationRegionId = `region:${destinationNode.id}`;
            const destinationWarehouseId = `warehouse:${destinationNode.id}:general`;
            const sourceView = runtime.api.regionalRegionView(sourceRegionId);
            const sourceOwnedFood = runtime.api.commerceLedger().inventories
                .filter(row => row.regionId === sourceRegionId && row.resourceId === 'food')
                .reduce((sum, row) => sum + Number(row.quantity || 0), 0);
            const stockFixtureDelta = sourceOwnedFood - sourceView.stocks.food;
            runtime.api.regionalStockDelta(sourceRegionId, 'food', stockFixtureDelta, {
                    type: 'TEST_FIXTURE', source: `probe.negotiation.delivery.${mode}`
                });
            const orderResult = runtime.api.tradeCreateOrder({
                sourceRegionId, targetRegionId, resourceId: 'food', quantity: 1,
                buyerCompanyId: buyerCompany.id, source: 'NEGOTIATION_DELIVERY_FIXTURE'
            });
            const dispatch = orderResult.ok
                ? runtime.api.tradeDispatchOrder(orderResult.order.id, 1) : orderResult;
            if (!dispatch.ok || !dispatch.shipment || dispatch.shipment.settlementReservationId) {
                return { ok: false, code: dispatch.code || 'UNFINANCED_SHIPMENT_FIXTURE_FAILED' };
            }
            const shipment = story.tradeLogistics.shipments.find(row => row.id === dispatch.shipment.id);
            const order = story.tradeLogistics.orders.find(row => row.id === shipment.orderId);
            const sellerCompany = story.companyEconomy.companies[shipment.sellerCompanyId];
            if (!sellerCompany || sellerCompany.id === buyerCompany.id) {
                return { ok: false, code: 'DISTINCT_SELLER_COMPANY_MISSING' };
            }
            if (mode !== 'RESALE') sellerActor.organizationId = sellerCompany.id;
            let originalBuyerCompany = null;
            let primaryResaleReservationId = null;
            let originalBuyerInventoryBefore = null;
            if (mode === 'RESALE') {
                originalBuyerCompany = Object.values(story.companyEconomy.companies).find(row => (
                    row.id !== buyerCompany.id && row.id !== sellerCompany.id
                    && row.countryId === buyerCompany.countryId
                    && row.status === 'OPERATING'
                    && Number(row.accounts && row.accounts['ASSET:CASH']) > 90
                ));
                if (!originalBuyerCompany) return { ok: false, code: 'RESALE_ORIGINAL_BUYER_MISSING' };
                originalBuyerInventoryBefore = Number(
                    originalBuyerCompany.accounts && originalBuyerCompany.accounts['ASSET:INVENTORY']
                ) || 0;
                sellerActor.organizationId = originalBuyerCompany.id;
                const primaryReserve = runtime.api.budgetReserveNegotiatedPayment({
                    correlationId: `probe:resale:primary:${seed + offset}`,
                    negotiationCaseId: 'fixture:primary-sale',
                    negotiationVersionId: 'fixture:primary-sale:v1',
                    buyerCompanyId: originalBuyerCompany.id,
                    sellerCompanyId: sellerCompany.id,
                    buyerCountryId: shipment.buyerCountryId,
                    sellerCountryId: shipment.sellerCountryId,
                    shipmentId: shipment.id,
                    resourceId: shipment.resourceId,
                    quantity: shipment.quantity,
                    amount: 7,
                    currency: 'capital'
                });
                if (!primaryReserve.ok) return { ok: false, code: primaryReserve.code || 'RESALE_PRIMARY_ESCROW_FAILED' };
                primaryResaleReservationId = primaryReserve.reservationId;
                shipment.settlementReservationId = primaryReserve.reservationId;
                shipment.settlementAmount = 7;
                shipment.buyerCompanyId = originalBuyerCompany.id;
                order.buyerCompanyId = originalBuyerCompany.id;
            }
            const candidate = {
                schemaVersion: 3,
                kind: 'COMMERCIAL_NEGOTIATION_DRAFT',
                entities: [
                    { role: 'TARGET_SHIPMENT', entityType: 'SHIPMENT', entityId: shipment.id,
                        status: 'KNOWN_CONTEXT_REFERENCE' },
                    { role: 'DESTINATION', entityType: 'WAREHOUSE', entityId: destinationWarehouseId,
                        status: 'RESOLVED_BY_PLAYER_CONFIRMATION' },
                    { role: 'COMMODITY', entityType: 'RESOURCE', entityId: 'food',
                        status: 'RESOLVED_BY_PLAYER_CONFIRMATION' },
                    { role: 'PLAYER_ORGANIZATION', entityType: 'COMPANY', entityId: buyerCompany.id,
                        status: 'RESOLVED_OWNED' }
                ],
                requests: [{ id: 'request:delivery-fixture', type: 'REDIRECT_SHIPMENT',
                    targetShipmentId: shipment.id, destinationId: destinationWarehouseId,
                    requestedFromActorId: sellerActor.id }],
                claims: [], concessions: {}, evidenceSubmissionIds: [], domainReviewId: null,
                executable: false, worldMutation: false
            };
            const grounding = runtime.api.negotiationMechanicalGrounding(candidate);
            const caseRow = {
                schemaVersion: 1, id: 'negotiation-case:1', sequence: 1,
                sourceSessionId: `delivery-fixture:${mode}`,
                sourceCandidateHash: runtime.api.negotiationHash(candidate),
                topic: 'COMMERCIAL_NEGOTIATION_DRAFT',
                partyActorIds: [buyerActor.id, sellerActor.id],
                mechanicalGrounding: grounding, mechanicalReviews: [],
                createdAt: story.clock, updatedAt: story.clock,
                currentVersionId: null, versions: [], requiredApprovals: [],
                status: 'ACCEPTED_PENDING_APPROVAL',
                execution: { status: 'NOT_AUTHORIZED', receiptId: null },
                executable: false, worldMutation: false
            };
            const terms = {
                quantity: { amount: 1, unit: 'ton-gıda' },
                payment: { amount: 5, unit: 'capital' },
                delivery_schedule: { amount: ['KEPT', 'RESALE'].includes(mode) ? 300 : 30, unit: 'DAY' },
                contract_penalty: mode === 'PENDING'
                    ? { amount: 500, unit: 'capital' }
                    : { amount: 10, unit: 'PERCENT' }
            };
            const version = runtime.api.negotiationVersionFixture(caseRow, buyerActor.id, terms, candidate);
            version.acceptedByActorIds = caseRow.partyActorIds.slice();
            version.status = 'ACCEPTED_BY_PARTIES';
            caseRow.versions.push(version);
            caseRow.currentVersionId = version.id;
            caseRow.requiredApprovals = runtime.api.negotiationPartyApprovalsFixture(
                caseRow, version.acceptedByActorIds
            );
            story.negotiations.cases[caseRow.id] = caseRow;
            story.negotiations.nextCaseSequence = 2;

            let wrongRepresentationPreflight = null;
            if (mode === 'RESALE') {
                sellerActor.organizationId = sellerCompany.id;
                wrongRepresentationPreflight = runtime.api.negotiationMechanicalPreflight(
                    caseRow.id, buyerActor.id
                );
                sellerActor.organizationId = originalBuyerCompany.id;
            }
            const preflight = runtime.api.negotiationMechanicalPreflight(caseRow.id, buyerActor.id);
            runtime.api.relationshipAdjust(buyerActor.id, sellerActor.id,
                { trustBps: 1000, respectBps: 1000 }, {
                    source: 'probe.negotiation.delivery', reason: 'SATURATION_SAFE_BASELINE'
                });
            const buyerCashBefore = buyerCompany.accounts['ASSET:CASH'];
            const buyerEscrowBefore = buyerCompany.accounts['ASSET:TRADE_ESCROW'];
            const sellerCashBefore = sellerCompany.accounts['ASSET:CASH'];
            const relationBefore = runtime.api.relationshipView(buyerActor.id, sellerActor.id)
                || { trustBps: 0, respectBps: 0, hostilityBps: 0 };
            const activation = runtime.api.negotiationDeliveryObligationCreate(caseRow.id, buyerActor.id);
            const activatedShipment = story.tradeLogistics.shipments.find(row => row.id === shipment.id);
            const financeAfterActivation = {
                buyerCash: buyerCompany.accounts['ASSET:CASH'],
                buyerEscrow: buyerCompany.accounts['ASSET:TRADE_ESCROW'],
                sellerCash: sellerCompany.accounts['ASSET:CASH']
            };
            const obligationId = activation.ok && activation.obligation.id;
            const dueAt = activation.ok && activation.obligation.dueAt;
            let deliveryTicks = 0;
            if (activation.ok && ['KEPT', 'RESALE'].includes(mode)) {
                while (activatedShipment.status !== 'DELIVERED' && story.clock < dueAt && deliveryTicks < 80) {
                    story.clock += 2;
                    runtime.api.tradeTick(2, { autoBalance: false, dispatchOpen: false });
                    deliveryTicks++;
                }
            } else if (activation.ok) {
                story.clock = dueAt + 1;
            }
            const firstTick = runtime.api.negotiationDeliveryTick();
            const financeAfterFirst = {
                buyerCash: buyerCompany.accounts['ASSET:CASH'],
                buyerEscrow: buyerCompany.accounts['ASSET:TRADE_ESCROW'],
                sellerCash: sellerCompany.accounts['ASSET:CASH']
            };
            const relationAfterFirst = runtime.api.relationshipView(buyerActor.id, sellerActor.id)
                || { trustBps: 0, respectBps: 0, hostilityBps: 0 };
            const firstSnapshot = runtime.api.negotiationSnapshot();
            const secondTick = runtime.api.negotiationDeliveryTick();
            const financeAfterSecond = {
                buyerCash: buyerCompany.accounts['ASSET:CASH'],
                buyerEscrow: buyerCompany.accounts['ASSET:TRADE_ESCROW'],
                sellerCash: sellerCompany.accounts['ASSET:CASH']
            };
            const relationAfterSecond = runtime.api.relationshipView(buyerActor.id, sellerActor.id)
                || { trustBps: 0, respectBps: 0, hostilityBps: 0 };
            const finalSnapshot = runtime.api.negotiationSnapshot();
            const finalCase = finalSnapshot.cases[caseRow.id];
            const finalObligation = finalSnapshot.deliveryObligations[obligationId];
            const finalMechanicalContracts = runtime.api.mechanicalContractSnapshot();
            const finalMechanicalContract = finalObligation
                && runtime.api.mechanicalContractGet(finalObligation.mechanicalContractId);
            const closedCounter = runtime.api.negotiationCaseCounter(caseRow.id, buyerActor.id,
                { payment: { amount: 6, unit: 'capital' } });
            runtime.api.saveNow();
            const sourceSaveStatus = runtime.api.saveStatus();
            const savedRaw = runtime.api.savedRaw();
            const savedPayload = JSON.parse(savedRaw);
            const liveAtSave = runtime.api.negotiationSnapshot();
            const restoredRuntime = createRuntime((seed + offset + 1000) >>> 0);
            let persistence;
            try {
                restoredRuntime.api.putSavedRaw(savedRaw);
                const loaded = restoredRuntime.api.loadNow();
                const restoredSnapshot = restoredRuntime.api.negotiationSnapshot();
                const restoredMechanicalContracts = restoredRuntime.api.mechanicalContractSnapshot();
                persistence = {
                    loaded,
                    exact: JSON.stringify(restoredSnapshot) === JSON.stringify(finalSnapshot),
                    payloadPresent: !!savedPayload.negotiations,
                    payloadCaseCount: Object.keys(savedPayload.negotiations && savedPayload.negotiations.cases || {}).length,
                    sourceSaveStatus,
                    liveAtSaveValidation: runtime.api.negotiationValidate(liveAtSave),
                    validation: restoredRuntime.api.negotiationValidate(restoredSnapshot),
                    mechanicalContractsExact: JSON.stringify(restoredMechanicalContracts)
                        === JSON.stringify(finalMechanicalContracts),
                    mechanicalContractsPayloadPresent: !!savedPayload.mechanicalContracts,
                    mechanicalContractsValidation: restoredRuntime.api.mechanicalContractValidate(
                        restoredMechanicalContracts
                    ),
                    differences: storyDiffPaths(finalSnapshot, restoredSnapshot).slice(0, 8)
                };
            } finally {
                restoredRuntime.dom.window.close();
            }
            const expectedFinal = ['KEPT', 'RESALE'].includes(mode) ? 'KEPT'
                : mode === 'PENDING' ? 'BREACH_PAYMENT_PENDING' : 'BROKEN';
            const expectedCase = ['KEPT', 'RESALE'].includes(mode) ? 'FULFILLED'
                : mode === 'PENDING' ? 'BREACH_PAYMENT_PENDING' : 'BREACHED';
            const finalBudget = runtime.api.budgetLedger();
            const finalCompanies = runtime.api.companyLedger().companies;
            const deliveredLots = runtime.api.commerceLedger().inventories.filter(row => (
                row.regionId === destinationRegionId && row.resourceId === shipment.resourceId
                && row.correlationId === shipment.id
            ));
            const primarySettlement = primaryResaleReservationId
                && finalBudget.settlements.find(row => row.id === primaryResaleReservationId);
            const resaleSettlement = activation.ok && activation.obligation.transferMode === 'BUYER_TO_BUYER_RESALE'
                && finalBudget.settlements.find(row => row.id === activation.obligation.escrowReservationId);
            return {
                ok: preflight.ok && preflight.code === 'PREFLIGHT_READY' && activation.ok
                    && finalObligation && finalObligation.status === expectedFinal
                    && finalCase.status === expectedCase,
                mode, preflight, activationCode: activation.code,
                transferMode: activation.ok && activation.obligation.transferMode,
                mechanicalContract: finalMechanicalContract && {
                    id: finalMechanicalContract.id,
                    type: finalMechanicalContract.type,
                    subtype: finalMechanicalContract.subtype,
                    status: finalMechanicalContract.status,
                    receiptLinked: finalMechanicalContract.execution.receiptId === obligationId,
                    sourceLinked: finalMechanicalContract.source.negotiationCaseId === caseRow.id
                        && finalMechanicalContract.source.negotiationVersionId === version.id
                        && finalMechanicalContract.source.mechanicalReviewId === preflight.review.id,
                    partiesLinked: finalMechanicalContract.parties.some(row => (
                        row.role === 'BUYER' && row.actorId === buyerActor.id
                        && row.legalActorId === buyerCompany.id
                    )) && finalMechanicalContract.parties.some(row => (
                        row.role === 'SELLER' && row.actorId === sellerActor.id
                        && row.legalActorId === activation.obligation.sellerCompanyId
                    ))
                },
                wrongRepresentationBlocked: mode !== 'RESALE' ? null
                    : wrongRepresentationPreflight.code === 'PREFLIGHT_BLOCKED'
                        && wrongRepresentationPreflight.review.blockerCodes
                            .includes('CURRENT_BUYER_REPRESENTATION_REQUIRED'),
                resaleChain: mode !== 'RESALE' ? null : {
                    primarySettlementStatus: primarySettlement && primarySettlement.status,
                    resaleSettlementStatus: resaleSettlement && resaleSettlement.status,
                    originalEscrowPreservedAtActivation: activation.ok
                        && activatedShipment.settlementReservationId === primaryResaleReservationId
                        && activatedShipment.resaleSettlementReservationId === activation.obligation.escrowReservationId,
                    originalOrderBuyerPreserved: order.buyerCompanyId === originalBuyerCompany.id,
                    beneficialBuyerAssigned: activatedShipment.beneficialBuyerCompanyId === buyerCompany.id,
                    deliveredLotOwnedByNewBuyer: deliveredLots.length > 0
                        && deliveredLots.every(row => row.ownerType === 'COMPANY' && row.ownerId === buyerCompany.id),
                    originalBuyerInventoryReturnedToBaseline: Math.abs((Number(
                        finalCompanies[originalBuyerCompany.id].accounts['ASSET:INVENTORY']
                    ) || 0) - originalBuyerInventoryBefore) < 1e-6
                },
                redirectApplied: activation.ok
                    && activatedShipment.targetRegionId === destinationRegionId
                    && !!activation.obligation.tradeAmendmentId,
                escrowReservedOnce: activation.ok
                    && Math.abs(buyerCashBefore - financeAfterActivation.buyerCash - 5) < 1e-6
                    && Math.abs(financeAfterActivation.buyerEscrow - buyerEscrowBefore - 5) < 1e-6,
                firstTick, secondTick, deliveryTicks,
                finalCaseStatus: finalCase && finalCase.status,
                finalObligationStatus: finalObligation && finalObligation.status,
                expectedFinal, expectedCase,
                financeBefore: { buyerCash: buyerCashBefore, buyerEscrow: buyerEscrowBefore,
                    sellerCash: sellerCashBefore },
                financeAfterActivation,
                financeAfterFirst, financeAfterSecond,
                financeIdempotent: JSON.stringify(financeAfterFirst) === JSON.stringify(financeAfterSecond),
                relationIdempotent: JSON.stringify(relationAfterFirst) === JSON.stringify(relationAfterSecond),
                breachRelationshipApplied: mode === 'KEPT'
                    || (relationAfterFirst.trustBps - relationBefore.trustBps === -700
                        && relationAfterFirst.respectBps - relationBefore.respectBps === -300
                        && relationAfterFirst.hostilityBps - relationBefore.hostilityBps === 450),
                duplicateCountersClosedCase: closedCounter.ok === false && closedCounter.code === 'CASE_CLOSED',
                diagnosticsStable: ['KEPT', 'RESALE'].includes(mode)
                    ? firstSnapshot.diagnostics.deliveriesKept === 1
                        && finalSnapshot.diagnostics.deliveriesKept === 1
                    : mode === 'PENDING'
                        ? firstSnapshot.diagnostics.deliveriesBroken === 0
                            && finalSnapshot.diagnostics.deliveriesBroken === 0
                        : firstSnapshot.diagnostics.deliveriesBroken === 1
                            && finalSnapshot.diagnostics.deliveriesBroken === 1,
                negotiationValidation: runtime.api.negotiationValidate(finalSnapshot),
                mechanicalContractValidation: runtime.api.mechanicalContractValidate(
                    finalMechanicalContracts
                ),
                budgetValidation: runtime.api.validateBudgetLedger(runtime.api.budgetLedger(), {
                    checkWalletMirrors: true
                }),
                companyValidation: runtime.api.validateCompanyLedger(runtime.api.companyLedger()),
                commerceValidation: runtime.api.validateCommerceLedger(runtime.api.commerceLedger(), {
                    checkPhysicalMirrors: true
                }),
                tradeValidation: runtime.api.validateTradeLedger(runtime.api.tradeLedger()),
                persistence
            };
        } finally {
            runtime.dom.window.close();
        }
    }
    const schedule = (() => {
        const runtime = createRuntime((seed + 90) >>> 0);
        try {
            runtime.api.newCampaign({ seed: seed + 90, playerStateId: 0, abundance: 1,
                doctrine: 'combined', fog: true });
            return {
                contractTypes: runtime.api.mechanicalContractTypes(),
                days30: runtime.api.negotiationDeliverySchedule({ amount: 30, unit: 'DAY' }, 7),
                months2: runtime.api.negotiationDeliverySchedule({ amount: 2, unit: 'MONTH' }, 7),
                percent10: runtime.api.negotiationPenaltyQuote(
                    { amount: 500, unit: 'capital' }, { amount: 10, unit: 'PERCENT' }
                )
            };
        } finally {
            runtime.dom.window.close();
        }
    })();
    return { schedule, kept: run('KEPT', 1), breached: run('BROKEN', 2),
        pendingPenalty: run('PENDING', 3), resale: run('RESALE', 4) };
}

module.exports = {
    createRuntime,
    runStorySimulation,
    probeWelfareGate,
    probeBattleTelemetry,
    probeWorldV2,
    probeMigration,
    probeDeterministicClock,
    probeSchedulerRegistry,
    probeRngStreams,
    probeCausalityLedger,
    probeCausalityGuards,
    probeStoryProjection,
    probeRegionModel,
    probeRegionActivation,
    probeRegionAggregation,
    probeInfrastructureGraph,
    probeResourceTaxonomy,
    probeProductionSectors,
    probePeacefulDiplomacy,
    probeRegionalEconomy,
    probeTradeLogistics,
    probeDomesticDistributionContract,
    probeMarketPrices,
    probeStateBudget,
    probeCompaniesBanks,
    probeProductionUnitEconomics,
    probeSaleSettlement,
    probeSaleSettlementResume,
    probeEconomicAI,
    probePopulationCohorts,
    probeNeedsWelfare,
    probePublicOpinion,
    probeCollectiveAction,
    probeHumanMigration,
    probePowerCenters,
    probeInstitutions,
    probeStateCapacity,
    probeElections,
    probeIntegrity,
    probePoliticalCrisis,
    probeGovernanceWorkspace,
    probeCharacterIdentities,
    probeCharacterMemory,
    probeCharacterActions,
    probeCharacterArbiter,
    probeCharacterSpeech,
    probeCharacterLongDialogue,
    probeDialogueScenarioLab,
    probeConversationRuntime385,
    probeDecisionTraceV2,
    probeConversationUnderstanding,
    probeNegotiationDeliveryLifecycle,
    probeContactDirectory,
    probeCityDossier,
    probeCanonicalMapRaster,
    probePoliticalOverlay,
    probePrebuiltMapRaster,
    probeAdaptiveMapWarp,
    probeMapCacheInvalidation,
    buildStoryMapRasterAssetData,
    stateSnapshot,
    hashSnapshot
};
