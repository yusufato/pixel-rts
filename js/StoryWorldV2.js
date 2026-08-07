// ═══════════════════════════════════════════════════════════════════════════
//  STORY WORLD STATE V2 — Faz 4 salt-okunur adaptör ve doğrulayıcı
//  ---------------------------------------------------------------------------
//  Canlı V1 durumunun sahibi değildir. Mevcut oyunu değiştirmeden V2 sözleşmesi
//  üretir; Faz 5 göçünden önce V1 kayıt biçimine geri yazmaz.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_WORLD_V2_SCHEMA_VERSION = 2;
const STORY_WORLD_V2_ADAPTER_VERSION = 'story-v1-to-v2-adapter-6';

const STORY_WORLD_V2_TOP_LEVEL = Object.freeze([
    'meta', 'clock', 'countries', 'regions', 'characters',
    'populationCohorts', 'powerCenters', 'institutions', 'implementationTickets', 'elections', 'mandates', 'integrityCases', 'integrityEvidence', 'companies', 'mediaOutlets',
    'diplomaticEdges', 'markets', 'militaryForces', 'crises',
    'events', 'decisions', 'memory', 'diagnostics'
]);

const STORY_WORLD_V2_ENTITY_BASE = Object.freeze([
    'id', 'createdAt', 'updatedAt', 'version', 'ownerId', 'sourceEventId'
]);

class StoryWorldValidationError extends Error {
    constructor(issues) {
        super(`StoryWorldStateV2 doğrulaması başarısız: ${issues.length} sorun`);
        this.name = 'StoryWorldValidationError';
        this.issues = issues;
    }
}

function storyWorldV2Round(value, digits = 4) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    const scale = 10 ** digits;
    return Math.round(number * scale) / scale;
}

function storyWorldV2Clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyWorldV2CampaignSeed() {
    if (typeof storyRngSnapshot === 'function') {
        const rng = storyRngSnapshot();
        if (Number.isFinite(Number(rng.rootSeed))) return Number(rng.rootSeed);
    }
    const telemetrySeed = STORY.telemetry && STORY.telemetry.meta
        ? STORY.telemetry.meta.campaignSeed
        : null;
    return Number.isFinite(Number(telemetrySeed)) ? Number(telemetrySeed) : null;
}

function storyWorldV2EntityBase(id, ownerId, createdAt, sourceEventId) {
    return {
        id: String(id),
        createdAt: storyWorldV2Round(createdAt),
        updatedAt: storyWorldV2Round(STORY.clock),
        version: 1,
        ownerId: ownerId == null ? null : String(ownerId),
        sourceEventId: sourceEventId == null ? null : String(sourceEventId)
    };
}

function storyWorldV2CountryId(stateId) { return `country:${stateId}`; }
function storyWorldV2RegionId(nodeId) { return `region:${nodeId}`; }
function storyWorldV2CharacterId(stateId, commanderId) { return `character:${stateId}:${commanderId}`; }
function storyWorldV2ForceId(stateId, commanderId) { return `force:${stateId}:${commanderId}`; }

function storyWorldV2Countries() {
    return (STORY.states || []).map(state => Object.assign(
        storyWorldV2EntityBase(storyWorldV2CountryId(state.id), null, 0, null),
        {
            legacyId: state.id,
            name: String(state.name || `Devlet ${state.id}`),
            color: String(state.color || '#777777'),
            isPlayer: !!state.isPlayer,
            welfare: storyWorldV2Round(state.welfare),
            reputation: storyWorldV2Round(state.reputation),
            inflation: storyWorldV2Round(state.inflation),
            marketConfidence: storyWorldV2Round(state.marketConfidence),
            market: typeof storyMarketCountryView === 'function'
                ? storyWorldV2Clone(storyMarketCountryView(storyWorldV2CountryId(state.id)))
                : null,
            budget: typeof storyBudgetCountryView === 'function'
                ? storyWorldV2Clone(storyBudgetCountryView(storyWorldV2CountryId(state.id)))
                : null,
            companyEconomy: typeof storyCompanyCountryView === 'function'
                ? storyWorldV2Clone(storyCompanyCountryView(storyWorldV2CountryId(state.id)))
                : null,
            economicPolicy: typeof storyEconomicAICountryView === 'function'
                ? storyWorldV2Clone(storyEconomicAICountryView(storyWorldV2CountryId(state.id)))
                : null,
            publicOpinion: typeof storyOpinionCountryView === 'function'
                ? storyWorldV2Clone(storyOpinionCountryView(storyWorldV2CountryId(state.id)))
                : null,
            collectiveAction: typeof storyCollectiveCountryView === 'function'
                ? storyWorldV2Clone(storyCollectiveCountryView(storyWorldV2CountryId(state.id)))
                : null,
            humanMigration: typeof storyHumanMigrationCountryView === 'function'
                ? storyWorldV2Clone(storyHumanMigrationCountryView(storyWorldV2CountryId(state.id)))
                : null,
            powerCenters: typeof storyPowerCenterCountryView === 'function'
                ? storyWorldV2Clone(storyPowerCenterCountryView(storyWorldV2CountryId(state.id)))
                : null,
            institutions: typeof storyInstitutionCountryView === 'function'
                ? storyWorldV2Clone(storyInstitutionCountryView(storyWorldV2CountryId(state.id)))
                : null,
            stateCapacity: typeof storyStateCapacityCountryView === 'function'
                ? storyWorldV2Clone(storyStateCapacityCountryView(storyWorldV2CountryId(state.id)))
                : null,
            elections: typeof storyElectionCountryView === 'function'
                ? storyWorldV2Clone(storyElectionCountryView(storyWorldV2CountryId(state.id)))
                : null,
            integrity: typeof storyIntegrityCountryView === 'function'
                ? storyWorldV2Clone(storyIntegrityCountryView(storyWorldV2CountryId(state.id)))
                : null,
            politicalCrisis: typeof storyPoliticalCrisisCountryView === 'function'
                ? storyWorldV2Clone(storyPoliticalCrisisCountryView(storyWorldV2CountryId(state.id)))
                : null,
            resources: {
                oil: storyWorldV2Round(state.res && state.res.oil),
                manpower: storyWorldV2Round(state.res && state.res.manpower),
                points: storyWorldV2Round(state.res && state.res.points)
            },
            government: {
                leader: state.gov && state.gov.leader != null ? String(state.gov.leader) : null,
                constitution: state.constitution || null,
                laws: storyWorldV2Clone(state.laws || {})
            },
            technologyIds: Array.isArray(state.tech) ? state.tech.map(String).sort() : []
        }
    ));
}

function storyWorldV2Regions() {
    const regionRecords = typeof storyRegionV2Records === 'function'
        ? storyRegionV2Records()
        : null;
    if (Array.isArray(regionRecords)) {
        return regionRecords.map(region => {
            const regional = typeof storyRegionalRegionView === 'function'
                ? storyRegionalRegionView(region.id)
                : null;
            return Object.assign(
                storyWorldV2EntityBase(region.id, region.ownerId, 0, null),
                storyWorldV2Clone(region),
                {
                    stocks: regional ? storyWorldV2Clone(regional.stocks) : null,
                    safeStockTargets: regional ? storyWorldV2Clone(regional.safeTargets) : null,
                    stockShortages: regional ? storyWorldV2Clone(regional.shortages) : [],
                    trade: typeof storyTradeRegionView === 'function'
                        ? storyWorldV2Clone(storyTradeRegionView(region.id))
                        : null,
                    market: typeof storyMarketRegionView === 'function'
                        ? storyWorldV2Clone(storyMarketRegionView(region.id))
                        : null,
                    companyEconomy: typeof storyCompanyRegionView === 'function'
                        ? storyWorldV2Clone(storyCompanyRegionView(region.id))
                        : null,
                    needsWelfare: typeof storyNeedsRegionSummaryView === 'function'
                        ? storyWorldV2Clone(storyNeedsRegionSummaryView(region.id))
                        : null,
                    publicOpinion: typeof storyOpinionRegionView === 'function'
                        ? storyWorldV2Clone(storyOpinionRegionView(region.id))
                        : null,
                    collectiveAction: typeof storyCollectiveRegionView === 'function'
                        ? storyWorldV2Clone(storyCollectiveRegionView(region.id))
                        : null,
                    humanMigration: typeof storyHumanMigrationRegionView === 'function'
                        ? storyWorldV2Clone(storyHumanMigrationRegionView(region.id))
                        : null,
                    powerCenters: typeof storyPowerCenterRegionView === 'function'
                        ? storyWorldV2Clone(storyPowerCenterRegionView(region.id))
                        : null,
                    institutions: typeof storyInstitutionRegionView === 'function'
                        ? storyWorldV2Clone(storyInstitutionRegionView(region.id))
                        : null,
                    stateCapacity: typeof storyStateCapacityRegionView === 'function'
                        ? storyWorldV2Clone(storyStateCapacityRegionView(region.id))
                        : null
                }
            );
        });
    }
    return (STORY.nodes || []).map(node => Object.assign(
        storyWorldV2EntityBase(
            storyWorldV2RegionId(node.id),
            Number.isInteger(node.owner) ? storyWorldV2CountryId(node.owner) : null,
            0,
            null
        ),
        {
            legacyId: node.id,
            name: String(node.name || `Bölge ${node.id}`),
            neighborIds: (node.neighbors || []).map(storyWorldV2RegionId).sort(),
            level: Math.max(1, Number(node.level) || 1),
            garrison: Math.max(0, Number(node.garrison) || 0),
            infrastructure: {
                factory: Math.max(0, Number(node.fac) || 0),
                barracks: Math.max(0, Number(node.bar) || 0)
            },
            population: storyWorldV2Round(node.pop),
            wealth: storyWorldV2Round(node.wealth),
            deposits: {
                oil: Math.max(0, Number(node.oil) || 0),
                cities: Math.max(0, Number(node.cities) || 0),
                points: Math.max(0, Number(node.pts) || 0)
            },
            stocks: typeof storyRegionalRegionView === 'function'
                ? (() => {
                    const regional = storyRegionalRegionView(storyWorldV2RegionId(node.id));
                    return regional ? storyWorldV2Clone(regional.stocks) : null;
                })()
                : null,
            safeStockTargets: typeof storyRegionalRegionView === 'function'
                ? (() => {
                    const regional = storyRegionalRegionView(storyWorldV2RegionId(node.id));
                    return regional ? storyWorldV2Clone(regional.safeTargets) : null;
                })()
                : null,
            stockShortages: typeof storyRegionalRegionView === 'function'
                ? (() => {
                    const regional = storyRegionalRegionView(storyWorldV2RegionId(node.id));
                    return regional ? storyWorldV2Clone(regional.shortages) : [];
                })()
                : [],
            trade: typeof storyTradeRegionView === 'function'
                ? storyWorldV2Clone(storyTradeRegionView(storyWorldV2RegionId(node.id)))
                : null,
            market: typeof storyMarketRegionView === 'function'
                ? storyWorldV2Clone(storyMarketRegionView(storyWorldV2RegionId(node.id)))
                : null,
            companyEconomy: typeof storyCompanyRegionView === 'function'
                ? storyWorldV2Clone(storyCompanyRegionView(storyWorldV2RegionId(node.id)))
                : null,
            needsWelfare: typeof storyNeedsRegionSummaryView === 'function'
                ? storyWorldV2Clone(storyNeedsRegionSummaryView(storyWorldV2RegionId(node.id)))
                : null,
            publicOpinion: typeof storyOpinionRegionView === 'function'
                ? storyWorldV2Clone(storyOpinionRegionView(storyWorldV2RegionId(node.id)))
                : null,
            collectiveAction: typeof storyCollectiveRegionView === 'function'
                ? storyWorldV2Clone(storyCollectiveRegionView(storyWorldV2RegionId(node.id)))
                : null,
            humanMigration: typeof storyHumanMigrationRegionView === 'function'
                ? storyWorldV2Clone(storyHumanMigrationRegionView(storyWorldV2RegionId(node.id)))
                : null,
            powerCenters: typeof storyPowerCenterRegionView === 'function'
                ? storyWorldV2Clone(storyPowerCenterRegionView(storyWorldV2RegionId(node.id)))
                : null,
            institutions: typeof storyInstitutionRegionView === 'function'
                ? storyWorldV2Clone(storyInstitutionRegionView(storyWorldV2RegionId(node.id)))
                : null,
            stateCapacity: typeof storyStateCapacityRegionView === 'function'
                ? storyWorldV2Clone(storyStateCapacityRegionView(storyWorldV2RegionId(node.id)))
                : null,
            position: {
                coordinateSpace: 'NORMALIZED_WORLD',
                x: storyWorldV2Round(node.lx),
                y: storyWorldV2Round(node.ly)
            },
            classification: {
                kind: 'CITY_REGION',
                geoSource: !!node.geo
            },
            logistics: {
                landNeighborIds: (node.neighbors || []).map(storyWorldV2RegionId).sort(),
                corridorIds: []
            }
        }
    ));
}

function storyWorldV2Characters() {
    const characters = [];
    for (const state of (STORY.states || [])) {
        for (const commander of ((state.gov && state.gov.commanders) || [])) {
            characters.push(Object.assign(
                storyWorldV2EntityBase(
                    storyWorldV2CharacterId(state.id, commander.id),
                    storyWorldV2CountryId(state.id),
                    0,
                    null
                ),
                {
                    legacyId: commander.id,
                    name: String(commander.name || `Komutan ${commander.id}`),
                    role: commander.isPlayer ? 'PLAYER_COMMANDER' : 'COMMANDER',
                    personality: commander.personality || null,
                    regionId: commander.node == null ? null : storyWorldV2RegionId(commander.node),
                    loyalty: storyWorldV2Round(commander.loyalty),
                    skills: storyWorldV2Clone(commander.skills || {}),
                    axes: storyWorldV2Clone(commander.axes || {})
                }
            ));
        }
    }
    return characters.sort((a, b) => a.id.localeCompare(b.id));
}

function storyWorldV2PopulationCohorts() {
    const rows = typeof storyPopulationWorldEntities === 'function'
        ? storyPopulationWorldEntities()
        : [];
    return rows.map(row => Object.assign(
        storyWorldV2EntityBase(row.id, row.countryId, 0, null),
        {
            profileKey: row.profileKey,
            regionId: row.regionId,
            ageBand: row.ageBand,
            incomeBand: row.incomeBand,
            occupation: row.occupation,
            education: row.education,
            identity: row.identity,
            shareBps: row.shareBps,
            membersPeople: row.membersPeople,
            needsWelfare: typeof storyNeedsCohortView === 'function'
                ? storyWorldV2Clone(storyNeedsCohortView(row.id))
                : null,
            publicOpinion: typeof storyOpinionCohortView === 'function'
                ? storyWorldV2Clone(storyOpinionCohortView(row.id))
                : null
        }
    ));
}

function storyWorldV2PowerCenters() {
    const ledger = typeof storyPowerCenterEnsure === 'function' ? storyPowerCenterEnsure() : null;
    if (!ledger) return [];
    return Object.values(ledger.centers || {}).map(center => Object.assign(
        storyWorldV2EntityBase(center.id, center.countryId, center.foundedAt, null),
        storyWorldV2Clone(center)
    )).sort((a, b) => a.id.localeCompare(b.id, 'en'));
}

function storyWorldV2Institutions() {
    // Dünya projeksiyonu salt-okunurdur. Rejim/makam uzlaştırması scheduler
    // veya kayıt kapısında yapılır; UI açmak simülasyon olayına dönüşemez.
    const ledger = typeof storyInstitutionEnabled === 'function'
        && storyInstitutionEnabled() ? STORY.institutions : null;
    if (!ledger) return [];
    const rows = [];
    for (const country of Object.values(ledger.countries || {})) {
        for (const institution of Object.values(country.institutions || {})) {
            rows.push(Object.assign(
                storyWorldV2EntityBase(institution.id, institution.countryId, 0, null),
                storyWorldV2Clone(institution),
                { entityType: 'INSTITUTION' }
            ));
        }
    }
    return rows.sort((a, b) => a.id.localeCompare(b.id, 'en'));
}

function storyWorldV2ImplementationTickets() {
    // Uygulama görünümü de salt-okunurdur; snapshot almak yeni karar fişi
    // üretmez ve ilerlemeyi değiştirmez.
    const ledger = typeof storyStateCapacityEnabled === 'function'
        && storyStateCapacityEnabled() ? STORY.stateCapacity : null;
    if (!ledger) return [];
    return Object.values(ledger.tickets || {}).map(ticket => Object.assign(
        storyWorldV2EntityBase(
            ticket.id,
            ticket.countryId,
            Number(ticket.createdAt) || 0,
            null
        ),
        storyWorldV2Clone(ticket),
        { entityType: 'IMPLEMENTATION_TICKET' }
    )).sort((a, b) => a.id.localeCompare(b.id, 'en'));
}

function storyWorldV2Elections() {
    const ledger = typeof storyElectionEnabled === 'function'
        && storyElectionEnabled() ? STORY.elections : null;
    if (!ledger) return [];
    return Object.values(ledger.elections || {}).map(election => Object.assign(
        storyWorldV2EntityBase(election.id, election.countryId, election.campaignStartsAt, null),
        storyWorldV2Clone(election),
        { entityType: 'ELECTION' }
    )).sort((a, b) => a.id.localeCompare(b.id, 'en'));
}

function storyWorldV2Mandates() {
    const ledger = typeof storyElectionEnabled === 'function'
        && storyElectionEnabled() ? STORY.elections : null;
    if (!ledger) return [];
    return Object.values(ledger.mandates || {}).map(mandate => Object.assign(
        storyWorldV2EntityBase(mandate.id, mandate.countryId, mandate.startedAt, mandate.sourceElectionId),
        storyWorldV2Clone(mandate),
        { entityType: 'GOVERNMENT_MANDATE' }
    )).sort((a, b) => a.id.localeCompare(b.id, 'en'));
}

function storyWorldV2IntegrityCases() {
    const ledger = typeof storyIntegrityEnabled === 'function'
        && storyIntegrityEnabled() ? STORY.integrity : null;
    if (!ledger) return [];
    return Object.values(ledger.cases || {}).map(row => Object.assign(
        storyWorldV2EntityBase(row.id, row.countryId, row.openedAt, null),
        storyWorldV2Clone(row),
        { entityType: 'INTEGRITY_CASE' }
    )).sort((a, b) => a.id.localeCompare(b.id, 'en'));
}

function storyWorldV2IntegrityEvidence() {
    const ledger = typeof storyIntegrityEnabled === 'function'
        && storyIntegrityEnabled() ? STORY.integrity : null;
    if (!ledger) return [];
    return Object.values(ledger.evidence || {}).map(row => Object.assign(
        storyWorldV2EntityBase(row.id, row.countryId, row.createdAt, row.caseId),
        storyWorldV2Clone(row),
        { entityType: 'INTEGRITY_EVIDENCE' }
    )).sort((a, b) => a.id.localeCompare(b.id, 'en'));
}

function storyWorldV2PoliticalCrises() {
    const ledger = typeof storyPoliticalCrisisEnabled === 'function'
        && storyPoliticalCrisisEnabled() ? STORY.politicalCrises : null;
    if (!ledger) return [];
    return Object.values(ledger.crises || {}).map(row => Object.assign(
        storyWorldV2EntityBase(row.id, row.countryId, row.openedAt, null),
        storyWorldV2Clone(row),
        { entityType: 'POLITICAL_CRISIS' }
    )).sort((a, b) => a.id.localeCompare(b.id, 'en'));
}

function storyWorldV2Forces() {
    const forces = [];
    for (const state of (STORY.states || [])) {
        for (const commander of ((state.gov && state.gov.commanders) || [])) {
            const units = {};
            for (const type of Object.keys(commander.army || {}).sort((a, b) => Number(a) - Number(b))) {
                const count = Number(commander.army[type]) || 0;
                if (count > 0) units[String(type)] = count;
            }
            forces.push(Object.assign(
                storyWorldV2EntityBase(
                    storyWorldV2ForceId(state.id, commander.id),
                    storyWorldV2CountryId(state.id),
                    0,
                    null
                ),
                {
                    commanderId: storyWorldV2CharacterId(state.id, commander.id),
                    regionId: commander.node == null ? null : storyWorldV2RegionId(commander.node),
                    units
                }
            ));
        }
    }
    return forces.sort((a, b) => a.id.localeCompare(b.id));
}

function storyWorldV2Markets() {
    const ledger = typeof storyMarketEnsure === 'function' ? storyMarketEnsure() : null;
    if (!ledger) return [];
    return Object.keys(ledger.countries || {}).sort().map(countryId => Object.assign(
        storyWorldV2EntityBase(`market:${countryId}`, countryId, 0, null),
        storyWorldV2Clone(ledger.countries[countryId]),
        {
            marketType: 'NATIONAL_INDEXED_GOODS_MARKET',
            settlementStatus: 'PENDING_PHASE_20'
        }
    ));
}

function storyWorldV2Events() {
    const telemetrySource = STORY.telemetry && Array.isArray(STORY.telemetry.events)
        ? STORY.telemetry.events
        : [];
    const telemetryEvents = telemetrySource.map(event => Object.assign(
        storyWorldV2EntityBase(`event:${event.id}`, null, event.time, event.causeEventId == null ? null : `event:${event.causeEventId}`),
        {
            eventType: String(event.type || 'unknown'),
            correlationId: event.correlationId == null ? null : String(event.correlationId),
            payload: storyWorldV2Clone(event.payload || {})
        }
    ));
    const causalitySource = STORY.causality && Array.isArray(STORY.causality.events)
        ? STORY.causality.events
        : [];
    const causalEvents = causalitySource.map(event => Object.assign(
        storyWorldV2EntityBase(
            `causal-${event.id}`,
            null,
            event.time,
            event.causeEventId == null ? null : `causal-${event.causeEventId}`
        ),
        {
            eventType: String(event.type || 'unknown'),
            correlationId: event.correlationId == null ? null : String(event.correlationId),
            commandId: event.commandId == null ? null : String(event.commandId),
            rootEventId: event.rootEventId == null ? null : `causal-${event.rootEventId}`,
            effectIds: (event.effectIds || []).map(String),
            payload: storyWorldV2Clone(event.payload || {})
        }
    ));
    return telemetryEvents.concat(causalEvents);
}

function storyWorldV2CreateEmpty(options) {
    options = options || {};
    const seed = Number.isFinite(Number(options.seed)) ? Number(options.seed) : null;
    return {
        meta: {
            schemaVersion: STORY_WORLD_V2_SCHEMA_VERSION,
            adapterVersion: 'native-v2-empty-1',
            campaignId: String(options.campaignId || `story:${seed == null ? 'new' : seed}:0`),
            seed,
            engineVersions: {
                story: 'story-world-v2',
                battle: 'battlefield-v2-fixed50'
            },
            featureFlags: typeof storyFeatureSnapshot === 'function' ? storyFeatureSnapshot() : {}
        },
        clock: {
            gameTime: 0,
            speed: 1,
            paused: true,
            schedulerState: {}
        },
        countries: [],
        regions: [],
        characters: [],
        populationCohorts: [],
        powerCenters: [],
        institutions: [],
        implementationTickets: [],
        elections: [],
        mandates: [],
        integrityCases: [],
        integrityEvidence: [],
        companies: [],
        mediaOutlets: [],
        diplomaticEdges: [],
        markets: storyWorldV2Markets(),
        militaryForces: [],
        crises: [],
        events: [],
        decisions: [],
        memory: {
            playerPromises: [],
            characterSummaries: {}
        },
        diagnostics: {
            sourceSchema: 'story-world-v2',
            stateHash: null,
            warnings: []
        }
    };
}

function storyWorldV2Snapshot() {
    const seed = storyWorldV2CampaignSeed();
    const events = storyWorldV2Events();
    const stateHash = typeof storyTelemetryStateHash === 'function' ? storyTelemetryStateHash() : null;
    return {
        meta: {
            schemaVersion: STORY_WORLD_V2_SCHEMA_VERSION,
            adapterVersion: STORY_WORLD_V2_ADAPTER_VERSION,
            campaignId: `story:${seed == null ? 'legacy' : seed}:${STORY.playerStateId | 0}`,
            seed,
            engineVersions: {
                story: 'story-v1-adapter',
                battle: 'battlefield-v2-fixed50'
            },
            featureFlags: typeof storyFeatureSnapshot === 'function' ? storyFeatureSnapshot() : {}
        },
        clock: {
            gameTime: storyWorldV2Round(STORY.clock),
            speed: typeof storyClockSnapshot === 'function' ? storyClockSnapshot().speed : 1,
            paused: !!STORY.paused,
            schedulerState: {
                fixedStepSeconds: typeof STORY_FIXED_STEP_SECONDS === 'number' ? STORY_FIXED_STEP_SECONDS : 0.25,
                accumulatorSeconds: typeof storyClockSnapshot === 'function'
                    ? storyClockSnapshot().accumulatorSeconds
                    : 0,
                tick: typeof storyClockSnapshot === 'function' ? storyClockSnapshot().tick : 0,
                clock: typeof storyClockSnapshot === 'function' ? storyClockSnapshot() : null,
                registry: typeof storySchedulerSnapshot === 'function' ? storySchedulerSnapshot() : null
            }
        },
        countries: storyWorldV2Countries(),
        regions: storyWorldV2Regions(),
        characters: storyWorldV2Characters(),
        populationCohorts: storyWorldV2PopulationCohorts(),
        powerCenters: storyWorldV2PowerCenters(),
        institutions: storyWorldV2Institutions(),
        implementationTickets: storyWorldV2ImplementationTickets(),
        elections: storyWorldV2Elections(),
        mandates: storyWorldV2Mandates(),
        integrityCases: storyWorldV2IntegrityCases(),
        integrityEvidence: storyWorldV2IntegrityEvidence(),
        companies: typeof storyCompanyEnsure === 'function'
            ? (() => {
                const ledger = storyCompanyEnsure();
                if (!ledger) return [];
                const companyRows = Object.values(ledger.companies || {}).map(company => Object.assign(
                    storyWorldV2EntityBase(company.id, company.countryId, company.foundedAt, null),
                    {
                        entityType: 'COMPANY',
                        name: company.name,
                        countryId: company.countryId,
                        sectorId: company.sectorId,
                        legalStatus: company.legalStatus,
                        licenseStatus: company.licenseStatus,
                        status: company.status,
                        owners: storyWorldV2Clone(company.owners),
                        accounts: storyWorldV2Clone(company.accounts),
                        facilityIds: company.facilityIds.slice(),
                        warehouseIds: company.warehouseIds.slice(),
                        bankId: company.bankId
                    }
                ));
                const bankRows = Object.values(ledger.banks || {}).map(bank => Object.assign(
                    storyWorldV2EntityBase(bank.id, bank.countryId, 0, null),
                    {
                        entityType: 'BANK',
                        name: bank.name,
                        countryId: bank.countryId,
                        status: bank.status,
                        reserves: bank.reserves,
                        deposits: bank.deposits,
                        loansReceivable: bank.loansReceivable,
                        equity: bank.equity
                    }
                ));
                return companyRows.concat(bankRows);
            })()
            : [],
        mediaOutlets: [],
        diplomaticEdges: [],
        markets: [],
        militaryForces: storyWorldV2Forces(),
        crises: storyWorldV2PoliticalCrises(),
        events,
        decisions: events.filter(event => event.eventType === 'council.decision').map(event => Object.assign(
            storyWorldV2Clone(event),
            {
                id: event.id.replace(/^event:/, 'decision:'),
                sourceEventId: event.id
            }
        )),
        memory: {
            playerPromises: [],
            characterSummaries: {}
        },
        diagnostics: {
            sourceSchema: 'pixelrts_story_v3/runtime-v1',
            stateHash,
            rng: typeof storyRngSnapshot === 'function' ? storyRngSnapshot() : null,
            causality: STORY.causality ? {
                schemaVersion: STORY.causality.schemaVersion,
                commands: (STORY.causality.commands || []).length,
                events: (STORY.causality.events || []).length,
                effects: (STORY.causality.effects || []).length,
                droppedCommands: STORY.causality.droppedCommands || 0,
                droppedEvents: STORY.causality.droppedEvents || 0,
                droppedEffects: STORY.causality.droppedEffects || 0,
                guard: storyWorldV2Clone(STORY.causality.guard || null),
                warningCount: (STORY.causality.warnings || []).length
            } : null,
            regionModel: STORY.regionModel ? {
                schemaVersion: STORY.regionModel.schemaVersion,
                adapterVersion: STORY.regionModel.adapterVersion,
                topologyHash: STORY.regionModel.topologyHash,
                regionCount: (STORY.regionModel.regions || []).length,
                diagnostics: storyWorldV2Clone(STORY.regionModel.diagnostics || null)
            } : null,
            activation: typeof storyActivationSnapshot === 'function'
                ? (() => {
                    const activation = storyActivationSnapshot();
                    return {
                        schemaVersion: activation.schemaVersion,
                        policyVersion: activation.policyVersion,
                        disabled: !!activation.disabled,
                        topologyHash: activation.topologyHash,
                        summary: storyWorldV2Clone(activation.summary),
                        diagnostics: storyWorldV2Clone(activation.diagnostics || null)
                    };
                })()
                : null,
            aggregation: typeof storyAggregationSnapshot === 'function'
                ? (() => {
                    const aggregation = storyAggregationSnapshot();
                    return {
                        schemaVersion: aggregation.schemaVersion,
                        policyVersion: aggregation.policyVersion,
                        disabled: !!aggregation.disabled,
                        topologyHash: aggregation.topologyHash,
                        conservation: storyWorldV2Clone(aggregation.conservation),
                        diagnostics: storyWorldV2Clone(aggregation.diagnostics || null)
                    };
                })()
                : null,
            infrastructure: typeof storyInfrastructureSnapshot === 'function'
                ? (() => {
                    const infrastructure = storyInfrastructureSnapshot();
                    return {
                        schemaVersion: infrastructure.schemaVersion,
                        adapterVersion: infrastructure.adapterVersion,
                        disabled: !!infrastructure.disabled,
                        topologyHash: infrastructure.topologyHash,
                        networkHash: infrastructure.networkHash,
                        damageRevision: infrastructure.damageRevision,
                        summary: storyWorldV2Clone(infrastructure.summary),
                        diagnostics: storyWorldV2Clone(infrastructure.diagnostics || null)
                    };
                })()
                : null,
            resourceTaxonomy: typeof storyResourceCatalogSnapshot === 'function'
                ? (() => {
                    const catalog = storyResourceCatalogSnapshot();
                    return {
                        schemaVersion: catalog.schemaVersion,
                        catalogVersion: catalog.catalogVersion,
                        adapterVersion: catalog.adapterVersion,
                        legacyAdapterVersion: catalog.legacyAdapterVersion,
                        catalogHash: catalog.catalogHash,
                        disabled: !!catalog.disabled,
                        summary: storyWorldV2Clone(catalog.summary || null),
                        diagnostics: storyWorldV2Clone(catalog.diagnostics || null)
                    };
                })()
                : null,
            productionSectors: typeof storyProductionCatalogSnapshot === 'function'
                ? (() => {
                    const catalog = storyProductionCatalogSnapshot();
                    return {
                        schemaVersion: catalog.schemaVersion,
                        catalogVersion: catalog.catalogVersion,
                        adapterVersion: catalog.adapterVersion,
                        resourceCatalogHash: catalog.resourceCatalogHash,
                        catalogHash: catalog.catalogHash,
                        disabled: !!catalog.disabled,
                        summary: storyWorldV2Clone(catalog.summary || null),
                        diagnostics: storyWorldV2Clone(catalog.diagnostics || null)
                    };
                })()
                : null,
            regionalEconomy: typeof storyRegionalSummary === 'function'
                ? storyRegionalSummary()
                : null,
            tradeLogistics: typeof storyTradeSummary === 'function'
                ? storyTradeSummary()
                : null,
            marketPrices: typeof storyMarketSummary === 'function'
                ? storyMarketSummary()
                : null,
            stateBudget: typeof storyBudgetSummary === 'function'
                ? storyBudgetSummary()
                : null,
            companyEconomy: typeof storyCompanySummary === 'function'
                ? storyCompanySummary()
                : null,
            economicAI: typeof storyEconomicAISummary === 'function'
                ? storyEconomicAISummary()
                : null,
            mapRaster: typeof storyMapRasterDiagnostics === 'function'
                ? storyMapRasterDiagnostics()
                : null,
            warnings: [
                'Bu belge salt-okunur V1 adaptörüdür; boş V2 katmanları henüz simüle edilmez.',
                'createdAt alanı V1 kaynakta bulunmadığı için 0 olarak taşındı.'
            ]
        }
    };
}

function storyWorldV2Validate(world, options) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!world || typeof world !== 'object' || Array.isArray(world)) {
        add('TYPE_OBJECT_REQUIRED', '$', 'Dünya kök değeri nesne olmalıdır.');
        return { ok: false, issues };
    }

    const allowedTop = new Set(STORY_WORLD_V2_TOP_LEVEL);
    for (const key of STORY_WORLD_V2_TOP_LEVEL) {
        if (!Object.prototype.hasOwnProperty.call(world, key)) {
            add('MISSING_FIELD', `$.${key}`, `Zorunlu üst alan eksik: ${key}`);
        }
    }
    for (const key of Object.keys(world)) {
        if (!allowedTop.has(key)) add('UNKNOWN_FIELD', `$.${key}`, `Şema dışı üst alan: ${key}`);
    }

    if (!world.meta || typeof world.meta !== 'object') {
        add('INVALID_META', '$.meta', 'meta nesnesi zorunludur.');
    } else {
        if (world.meta.schemaVersion !== STORY_WORLD_V2_SCHEMA_VERSION) {
            add('SCHEMA_VERSION', '$.meta.schemaVersion', `Beklenen sürüm ${STORY_WORLD_V2_SCHEMA_VERSION}.`);
        }
        for (const key of ['adapterVersion', 'campaignId', 'engineVersions', 'featureFlags']) {
            if (!Object.prototype.hasOwnProperty.call(world.meta, key)) {
                add('MISSING_FIELD', `$.meta.${key}`, `meta.${key} zorunludur.`);
            }
        }
    }

    if (!world.clock || typeof world.clock !== 'object' || !Number.isFinite(Number(world.clock.gameTime))) {
        add('INVALID_CLOCK', '$.clock.gameTime', 'Sonlu oyun zamanı zorunludur.');
    }

    const collectionNames = STORY_WORLD_V2_TOP_LEVEL.filter(key => [
        'countries', 'regions', 'characters', 'populationCohorts', 'powerCenters', 'institutions', 'implementationTickets', 'elections', 'mandates', 'integrityCases', 'integrityEvidence',
        'companies', 'mediaOutlets', 'diplomaticEdges', 'markets', 'militaryForces',
        'crises', 'events', 'decisions'
    ].includes(key));
    const allIds = new Map();
    for (const collectionName of collectionNames) {
        const collection = world[collectionName];
        if (!Array.isArray(collection)) {
            add('TYPE_ARRAY_REQUIRED', `$.${collectionName}`, `${collectionName} dizi olmalıdır.`);
            continue;
        }
        collection.forEach((entity, index) => {
            const at = `$.${collectionName}[${index}]`;
            if (!entity || typeof entity !== 'object' || Array.isArray(entity)) {
                add('INVALID_ENTITY', at, 'Varlık nesne olmalıdır.');
                return;
            }
            for (const key of STORY_WORLD_V2_ENTITY_BASE) {
                if (!Object.prototype.hasOwnProperty.call(entity, key)) {
                    add('MISSING_ENTITY_FIELD', `${at}.${key}`, `Kalıcı varlık alanı eksik: ${key}`);
                }
            }
            if (typeof entity.id !== 'string' || !entity.id) add('INVALID_ID', `${at}.id`, 'Boş olmayan metin kimlik zorunludur.');
            else if (allIds.has(entity.id)) add('DUPLICATE_ID', `${at}.id`, `Kimlik zaten kullanıldı: ${entity.id}`);
            else allIds.set(entity.id, at);
            if (!Number.isInteger(entity.version) || entity.version < 1) add('INVALID_VERSION', `${at}.version`, 'Sürüm pozitif tamsayı olmalıdır.');
            if (!Number.isFinite(Number(entity.createdAt))) add('INVALID_TIME', `${at}.createdAt`, 'createdAt sonlu olmalıdır.');
            if (!Number.isFinite(Number(entity.updatedAt))) add('INVALID_TIME', `${at}.updatedAt`, 'updatedAt sonlu olmalıdır.');
        });
    }

    const countryIds = new Set((world.countries || []).map(country => country && country.id));
    const regionIds = new Set((world.regions || []).map(region => region && region.id));
    for (let i = 0; i < (world.regions || []).length; i++) {
        const region = world.regions[i];
        if (!region || typeof region !== 'object') continue;
        if (region.ownerId != null && !countryIds.has(region.ownerId)) {
            add('BROKEN_REFERENCE', `$.regions[${i}].ownerId`, `Bilinmeyen ülke: ${region.ownerId}`);
        }
        for (const neighborId of (region.neighborIds || [])) {
            if (!regionIds.has(neighborId)) {
                add('BROKEN_REFERENCE', `$.regions[${i}].neighborIds`, `Bilinmeyen komşu bölge: ${neighborId}`);
            }
        }
        const position = region.position;
        if (!position || position.coordinateSpace !== 'NORMALIZED_WORLD'
            || !Number.isFinite(Number(position.x)) || !Number.isFinite(Number(position.y))) {
            add('INVALID_REGION_POSITION', `$.regions[${i}].position`, 'Bölge sonlu NORMALIZED_WORLD konumu taşımalıdır.');
        } else if (Number(position.x) < 0 || Number(position.x) > 1
            || Number(position.y) < 0 || Number(position.y) > 1) {
            add('REGION_POSITION_RANGE', `$.regions[${i}].position`, 'Bölge konumu 0–1 aralığında olmalıdır.');
        }
        if (!region.classification || region.classification.kind !== 'CITY_REGION') {
            add('INVALID_REGION_CLASSIFICATION', `$.regions[${i}].classification`, 'Bölge CITY_REGION sınıflandırması taşımalıdır.');
        }
        const logistics = region.logistics;
        if (!logistics || !Array.isArray(logistics.landNeighborIds) || !Array.isArray(logistics.corridorIds)) {
            add('INVALID_REGION_LOGISTICS', `$.regions[${i}].logistics`, 'Bölge kara komşuları ve koridor dizileri taşımalıdır.');
        } else {
            for (const neighborId of logistics.landNeighborIds) {
                if (!regionIds.has(neighborId)) {
                    add('BROKEN_REFERENCE', `$.regions[${i}].logistics.landNeighborIds`, `Bilinmeyen lojistik komşu: ${neighborId}`);
                }
            }
            if (JSON.stringify(logistics.landNeighborIds) !== JSON.stringify(region.neighborIds || [])) {
                add('REGION_LOGISTICS_MISMATCH', `$.regions[${i}].logistics.landNeighborIds`, 'Faz 11 kara lojistiği bölge komşuluğuyla aynı olmalıdır.');
            }
        }
    }
    for (let i = 0; i < (world.characters || []).length; i++) {
        const character = world.characters[i];
        if (!character || typeof character !== 'object') continue;
        if (character.ownerId != null && !countryIds.has(character.ownerId)) {
            add('BROKEN_REFERENCE', `$.characters[${i}].ownerId`, `Bilinmeyen ülke: ${character.ownerId}`);
        }
        if (character.regionId != null && !regionIds.has(character.regionId)) {
            add('BROKEN_REFERENCE', `$.characters[${i}].regionId`, `Bilinmeyen bölge: ${character.regionId}`);
        }
    }
    for (let i = 0; i < (world.populationCohorts || []).length; i++) {
        const cohort = world.populationCohorts[i];
        if (!cohort || typeof cohort !== 'object') continue;
        if (cohort.ownerId != null && !countryIds.has(cohort.ownerId)) {
            add('BROKEN_REFERENCE', `$.populationCohorts[${i}].ownerId`, `Bilinmeyen kohort ülkesi: ${cohort.ownerId}`);
        }
        if (!regionIds.has(cohort.regionId)) {
            add('BROKEN_REFERENCE', `$.populationCohorts[${i}].regionId`, `Bilinmeyen kohort bölgesi: ${cohort.regionId}`);
        }
        if (!Number.isInteger(cohort.membersPeople) || cohort.membersPeople < 0) {
            add('INVALID_COHORT_MEMBERS', `$.populationCohorts[${i}].membersPeople`, 'Kohort kişi sayısı negatif olmayan tamsayı olmalı.');
        }
    }

    const result = { ok: issues.length === 0, issues };
    if (!result.ok && options && options.throwOnError) throw new StoryWorldValidationError(issues);
    return result;
}

function storyWorldV2ExportValidated() {
    const world = storyWorldV2Snapshot();
    storyWorldV2Validate(world, { throwOnError: true });
    return world;
}
