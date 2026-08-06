'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const STORY_SOURCES = [
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
    'js/Factions.js',
    'js/Economy.js',
    'js/News.js',
    'js/StoryRender.js',
    'js/StoryUI.js',
    'js/Production.js',
    'js/Council.js',
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
        const T = {
            INFANTRY: 0, MECH_INFANTRY: 1, ARMOR_INFANTRY: 2,
            RECON: 3, ENGINEER: 4, MEDIC: 5,
            ARMOR: 6, ANTI_TANK: 7, ARTILLERY: 8
        };
        const STATS = [
            { cost: 70 }, { cost: 110 }, { cost: 140 },
            { cost: 55 }, { cost: 75 }, { cost: 75 },
            { cost: 220 }, { cost: 115 }, { cost: 165 }
        ];
        const UNIT_RES_GROUP = {
            [T.INFANTRY]: 'manpower',
            [T.MECH_INFANTRY]: 'oil',
            [T.ARMOR_INFANTRY]: 'manpower',
            [T.RECON]: 'oil',
            [T.ENGINEER]: 'manpower',
            [T.MEDIC]: 'manpower',
            [T.ARMOR]: 'oil',
            [T.ANTI_TANK]: 'points',
            [T.ARTILLERY]: 'points'
        };
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
            diplomacySnapshot: () => JSON.parse(JSON.stringify(STORY.rel || {})),
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
                talkText: document.getElementById('talk-body')?.textContent || ''
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
            fac: node.fac || 0,
            bar: node.bar || 0,
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
        const playerCommanderMatch = !expectedPlayerCommanderId || (
            target
            && target.characters.some(character => (
                character.id === expectedPlayerCommanderId
                && character.role === 'PLAYER_COMMANDER'
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
        'factions', 'society', 'state-capacity', 'elections', 'integrity', 'siege', 'technology',
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

    const on = runStorySimulation({
        seed,
        seconds: 120,
        featureFlags: { 'diplomacy.peacefulStart': true }
    });
    const off = runStorySimulation({
        seed,
        seconds: 120,
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
        const ownGeneral = runtime.api.renderCityDossier(ownNode.id, 'genel');
        const ownPopulation = runtime.api.renderCityDossier(ownNode.id, 'nufus');
        const ownEconomy = runtime.api.renderEconomy(ownNode.id, 'genel');
        const ownMarket = runtime.api.renderEconomy(ownNode.id, 'piyasa');
        const ownLogistics = runtime.api.renderEconomy(ownNode.id, 'lojistik');
        const ownFactions = runtime.api.renderEconomy(ownNode.id, 'fraksiyonlar');
        const ownCharacters = runtime.api.renderCityDossier(ownNode.id, 'karakterler');
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
        const character = ownView.characters[0];
        const characterOpened = character
            ? runtime.api.cityDossierOpenCharacter(character.id)
            : false;
        const characterState = runtime.api.cityDossierUiState();

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
            ownPopulation,
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

module.exports = {
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
