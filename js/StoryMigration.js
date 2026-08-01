// ═══════════════════════════════════════════════════════════════════════════
//  V3 KAYIT → STORY WORLD V2 GÖÇÜ — Faz 5
//  ---------------------------------------------------------------------------
//  Kaynak anahtarı ASLA değiştirilmez. Saf dönüştürücü önce doğrular; depolama
//  akışı kaynakla byte-for-byte aynı yedeği doğrulamadan V2 hedefini yazmaz.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_MIGRATION_SCHEMA_VERSION = 1;
const STORY_MIGRATION_KEYS = Object.freeze({
    source: 'pixelrts_story_v3',
    backup: 'pixelrts_story_v3_backup_phase5',
    target: 'pixelrts_story_world_v2',
    report: 'pixelrts_story_v3_migration_report'
});

function storyMigrationChecksum(raw) {
    const text = String(raw == null ? '' : raw);
    let a = 0x811c9dc5;
    let b = 0x9e3779b9;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        a ^= code;
        a = Math.imul(a, 0x01000193);
        b ^= code + i;
        b = Math.imul(b, 0x85ebca6b);
    }
    const hex = value => (`00000000${(value >>> 0).toString(16)}`).slice(-8);
    return `fnv2:${text.length}:${hex(a)}${hex(b)}`;
}

function storyMigrationBase(id, ownerId, clock) {
    return {
        id: String(id),
        createdAt: 0,
        updatedAt: Number.isFinite(Number(clock)) ? Number(clock) : 0,
        version: 1,
        ownerId: ownerId == null ? null : String(ownerId),
        sourceEventId: null
    };
}

function storyMigrationNumber(value, fallback) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function storyMigrationObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function storyMigrationClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyMigrationFail(raw, errors, details) {
    const checksum = storyMigrationChecksum(raw);
    return {
        ok: false,
        backupRaw: String(raw == null ? '' : raw),
        sourceChecksum: checksum,
        world: null,
        report: {
            schemaVersion: STORY_MIGRATION_SCHEMA_VERSION,
            status: 'FAILED',
            source: {
                storageKey: STORY_MIGRATION_KEYS.source,
                checksum,
                characterLength: String(raw == null ? '' : raw).length,
                declaredVersion: details && details.declaredVersion != null ? details.declaredVersion : null
            },
            target: null,
            backfills: [],
            warnings: details && details.warnings || [],
            errors: errors.map((message, index) => ({
                code: `MIGRATION_ERROR_${index + 1}`,
                message: String(message)
            }))
        }
    };
}

function storyMigrationValidateLegacy(save) {
    const errors = [];
    if (!save || typeof save !== 'object' || Array.isArray(save)) {
        errors.push('Kayıt kökü nesne olmalıdır.');
        return errors;
    }
    if (!Array.isArray(save.states) || !save.states.length) errors.push('states dizisi eksik veya boş.');
    if (!Array.isArray(save.nodes) || !save.nodes.length) errors.push('nodes dizisi eksik veya boş.');
    if (!Number.isInteger(Number(save.playerStateId))) errors.push('playerStateId tamsayı olmalıdır.');
    if (Array.isArray(save.states)) {
        const ids = new Set();
        for (const state of save.states) {
            if (!state || !Number.isInteger(Number(state.id))) {
                errors.push('Her devlet tamsayı id taşımalıdır.');
                continue;
            }
            if (ids.has(Number(state.id))) errors.push(`Tekrarlanan devlet id: ${state.id}`);
            ids.add(Number(state.id));
        }
        if (Number.isInteger(Number(save.playerStateId)) && !ids.has(Number(save.playerStateId))) {
            errors.push(`Oyuncu devleti bulunamadı: ${save.playerStateId}`);
        }
    }
    if (Array.isArray(save.nodes) && Array.isArray(save.states)) {
        const stateIds = new Set(save.states.map(state => Number(state.id)));
        const nodeIds = new Set();
        for (const node of save.nodes) {
            if (!node || !Number.isInteger(Number(node.id))) {
                errors.push('Her bölge tamsayı id taşımalıdır.');
                continue;
            }
            if (nodeIds.has(Number(node.id))) errors.push(`Tekrarlanan bölge id: ${node.id}`);
            nodeIds.add(Number(node.id));
            if (!stateIds.has(Number(node.owner))) errors.push(`Bölge ${node.id} geçersiz sahibe sahip: ${node.owner}`);
        }
    }
    return errors;
}

function storyMigrationV3RawToV2(raw, options) {
    options = options || {};
    const sourceRaw = String(raw == null ? '' : raw);
    let save;
    try {
        save = JSON.parse(sourceRaw);
    } catch (error) {
        return storyMigrationFail(sourceRaw, [`JSON okunamadı: ${error.message}`]);
    }

    const legacyErrors = storyMigrationValidateLegacy(save);
    if (legacyErrors.length) {
        return storyMigrationFail(sourceRaw, legacyErrors, { declaredVersion: save && save.v });
    }

    const clock = storyMigrationNumber(save.clock, 0);
    const playerStateId = Number(save.playerStateId);
    const telemetry = storyMigrationObject(save.telemetry);
    const telemetryMeta = storyMigrationObject(telemetry.meta);
    const savedRng = storyMigrationObject(save.rng);
    const seed = Number.isFinite(Number(savedRng.rootSeed))
        ? Number(savedRng.rootSeed)
        : Number.isFinite(Number(telemetryMeta.campaignSeed))
            ? Number(telemetryMeta.campaignSeed)
            : (Number.isFinite(Number(options.seed)) ? Number(options.seed) : null);
    const backfillCounts = {
        countryResources: 0,
        countryGovernment: 0,
        regionLevel: 0,
        regionInfrastructure: 0,
        regionPopulation: 0,
        regionPosition: 0,
        commanderArmy: 0,
        rngState: save.rng ? 0 : 1
    };

    const countries = save.states.map(state => {
        const resources = storyMigrationObject(state.res);
        if (!state.res) backfillCounts.countryResources++;
        if (!state.gov) backfillCounts.countryGovernment++;
        return Object.assign(
            storyMigrationBase(`country:${state.id}`, null, clock),
            {
                legacyId: Number(state.id),
                name: String(state.name || `Devlet ${state.id}`),
                color: String(state.color || '#777777'),
                isPlayer: Number(state.id) === playerStateId,
                welfare: storyMigrationNumber(state.welfare, 50),
                reputation: storyMigrationNumber(state.reputation, 0),
                inflation: storyMigrationNumber(state.inflation, 0),
                marketConfidence: storyMigrationNumber(state.marketConfidence, 0),
                resources: {
                    oil: storyMigrationNumber(resources.oil, 0),
                    manpower: storyMigrationNumber(resources.manpower, 0),
                    points: storyMigrationNumber(resources.points, 0)
                },
                government: {
                    leader: state.gov && state.gov.leader != null ? String(state.gov.leader) : 'ai',
                    constitution: state.constitution || 'monarchy',
                    laws: storyMigrationClone(storyMigrationObject(state.laws))
                },
                technologyIds: Array.isArray(state.tech) ? state.tech.map(String).sort() : []
            }
        );
    }).sort((a, b) => a.legacyId - b.legacyId);

    const regions = save.nodes.map(node => {
        if (node.level == null) backfillCounts.regionLevel++;
        if (node.fac == null || node.bar == null) backfillCounts.regionInfrastructure++;
        if (node.pop == null) backfillCounts.regionPopulation++;
        if (!Number.isFinite(Number(node.lx)) || !Number.isFinite(Number(node.ly))) {
            backfillCounts.regionPosition++;
        }
        const neighborIds = (Array.isArray(node.neighbors) ? node.neighbors : [])
            .map(id => `region:${id}`).sort();
        return Object.assign(
            storyMigrationBase(`region:${node.id}`, `country:${node.owner}`, clock),
            {
                legacyId: Number(node.id),
                name: String(node.name || `Bölge ${node.id}`),
                neighborIds,
                level: Math.max(1, storyMigrationNumber(node.level, 1)),
                garrison: Math.max(0, storyMigrationNumber(node.garrison, 0)),
                infrastructure: {
                    factory: Math.max(0, storyMigrationNumber(node.fac, 0)),
                    barracks: Math.max(0, storyMigrationNumber(node.bar, 0))
                },
                population: storyMigrationNumber(node.pop, 0),
                wealth: storyMigrationNumber(node.wealth, 0),
                deposits: {
                    oil: Math.max(0, storyMigrationNumber(node.oil, 0)),
                    cities: Math.max(0, storyMigrationNumber(node.cities, 0)),
                    points: Math.max(0, storyMigrationNumber(node.pts, 0))
                },
                position: {
                    coordinateSpace: 'NORMALIZED_WORLD',
                    x: Math.max(0, Math.min(1, storyMigrationNumber(node.lx, 0))),
                    y: Math.max(0, Math.min(1, storyMigrationNumber(node.ly, 0)))
                },
                classification: {
                    kind: 'CITY_REGION',
                    geoSource: !!node.geo
                },
                logistics: {
                    landNeighborIds: neighborIds.slice(),
                    corridorIds: []
                }
            }
        );
    }).sort((a, b) => a.legacyId - b.legacyId);

    const characters = [];
    const forces = [];
    const seenCharacterIds = new Set();
    const addCommander = (stateId, commander, isPlayer) => {
        if (!commander || commander.id == null) return;
        const characterId = `character:${stateId}:${commander.id}`;
        if (seenCharacterIds.has(characterId)) return;
        seenCharacterIds.add(characterId);
        const army = storyMigrationObject(commander.army);
        if (!commander.army) backfillCounts.commanderArmy++;
        characters.push(Object.assign(
            storyMigrationBase(characterId, `country:${stateId}`, clock),
            {
                legacyId: Number(commander.id),
                name: String(commander.name || `Komutan ${commander.id}`),
                role: isPlayer || commander.isPlayer ? 'PLAYER_COMMANDER' : 'COMMANDER',
                personality: commander.personality || null,
                regionId: commander.node == null ? null : `region:${commander.node}`,
                loyalty: storyMigrationNumber(commander.loyalty, isPlayer ? 100 : 60),
                skills: storyMigrationClone(storyMigrationObject(commander.skills)),
                axes: storyMigrationClone(storyMigrationObject(commander.axes))
            }
        ));
        const units = {};
        for (const type of Object.keys(army).sort((a, b) => Number(a) - Number(b))) {
            const count = storyMigrationNumber(army[type], 0);
            if (count > 0) units[String(type)] = count;
        }
        forces.push(Object.assign(
            storyMigrationBase(`force:${stateId}:${commander.id}`, `country:${stateId}`, clock),
            {
                commanderId: characterId,
                regionId: commander.node == null ? null : `region:${commander.node}`,
                units
            }
        ));
    };
    for (const state of save.states) {
        const commanders = state.gov && Array.isArray(state.gov.commanders) ? state.gov.commanders : [];
        for (const commander of commanders) addCommander(Number(state.id), commander, false);
    }
    if (save.commander) {
        addCommander(playerStateId, save.commander, true);
    }
    characters.sort((a, b) => a.id.localeCompare(b.id));
    forces.sort((a, b) => a.id.localeCompare(b.id));

    const sourceEvents = Array.isArray(telemetry.events) ? telemetry.events : [];
    const events = sourceEvents.map((event, index) => {
        const eventId = event.id == null ? index + 1 : event.id;
        return Object.assign(
            storyMigrationBase(`event:${eventId}`, null, storyMigrationNumber(event.time, clock)),
            {
                eventType: String(event.type || 'unknown'),
                correlationId: event.correlationId == null ? null : String(event.correlationId),
                payload: storyMigrationClone(storyMigrationObject(event.payload))
            }
        );
    });
    const decisions = events.filter(event => event.eventType === 'council.decision').map(event => Object.assign(
        storyMigrationClone(event),
        { id: event.id.replace(/^event:/, 'decision:'), sourceEventId: event.id }
    ));
    const populationCohorts = [];
    const savedPopulationRegions = storyMigrationObject(storyMigrationObject(save.population).regions);
    const savedNeedsRegions = storyMigrationObject(storyMigrationObject(save.needsWelfare).regions);
    const migratedNeedsByCohort = new Map();
    for (const regionId of Object.keys(savedNeedsRegions)) {
        const needsRegion = storyMigrationObject(savedNeedsRegions[regionId]);
        for (const outcome of (Array.isArray(needsRegion.cohorts) ? needsRegion.cohorts : [])) {
            if (outcome && outcome.cohortId != null) {
                migratedNeedsByCohort.set(String(outcome.cohortId), storyMigrationClone(outcome));
            }
        }
        const migratedRegion = regions.find(region => region.id === regionId);
        if (migratedRegion) {
            const summary = storyMigrationClone(needsRegion);
            delete summary.cohorts;
            migratedRegion.needsWelfare = summary;
        }
    }
    for (const regionId of Object.keys(savedPopulationRegions).sort()) {
        const savedRegion = storyMigrationObject(savedPopulationRegions[regionId]);
        for (const cohort of (Array.isArray(savedRegion.cohorts) ? savedRegion.cohorts : [])) {
            populationCohorts.push(Object.assign(
                storyMigrationBase(String(cohort.id), cohort.countryId == null ? null : String(cohort.countryId), 0),
                {
                    profileKey: String(cohort.profileKey || ''),
                    regionId: String(cohort.regionId || regionId),
                    ageBand: String(cohort.ageBand || ''),
                    incomeBand: String(cohort.incomeBand || ''),
                    occupation: String(cohort.occupation || ''),
                    education: String(cohort.education || ''),
                    identity: String(cohort.identity || ''),
                    shareBps: Math.max(0, Math.round(Number(cohort.shareBps) || 0)),
                    membersPeople: Math.max(0, Math.round(Number(cohort.membersPeople) || 0)),
                    needsWelfare: migratedNeedsByCohort.get(String(cohort.id)) || null
                }
            ));
        }
    }

    const knownTop = new Set([
        'v', 'states', 'nodes', 'playerStateId', 'commander', 'veterans', 'tech',
        'cfg', 'pendingReward', 'clock', 'log', 'caps', 'nextCouncil', 'councilNo',
        'time', 'rng', 'scheduler', 'runtime', 'era', 'eraEvents', 'eraFlips',
        'lastUrgent', 'news', 'telemetry', 'causality', 'regionModel',
        'activationPolicy', 'aggregationPolicy', 'infrastructureGraph', 'population', 'needsWelfare', 'rel'
    ]);
    const unmappedTopLevelFields = Object.keys(save).filter(key => !knownTop.has(key)).sort();
    const featureOverrides = storyMigrationObject(storyMigrationObject(save.cfg).featureFlags);
    const featureFlags = {};
    const featureDefaults = typeof STORY_FEATURE_DEFAULTS === 'object' && STORY_FEATURE_DEFAULTS
        ? STORY_FEATURE_DEFAULTS
        : {};
    for (const key of Object.keys(featureDefaults)) {
        featureFlags[key] = Object.prototype.hasOwnProperty.call(featureOverrides, key)
            ? !!featureOverrides[key]
            : !!featureDefaults[key];
    }

    const world = {
        meta: {
            schemaVersion: STORY_WORLD_V2_SCHEMA_VERSION,
            adapterVersion: 'legacy-save-v3-to-v2-2',
            campaignId: `story:${seed == null ? 'legacy' : seed}:${playerStateId}`,
            seed,
            engineVersions: {
                story: 'story-v1-migrated',
                battle: 'battlefield-v2-fixed50'
            },
            featureFlags
        },
        clock: {
            gameTime: clock,
            speed: storyMigrationNumber(storyMigrationObject(save.time).speed, 1),
            paused: true,
            schedulerState: {
                fixedStepSeconds: storyMigrationNumber(
                    storyMigrationObject(save.time).fixedStepSeconds,
                    typeof STORY_FIXED_STEP_SECONDS === 'number' ? STORY_FIXED_STEP_SECONDS : 0.25
                ),
                accumulatorSeconds: storyMigrationNumber(
                    storyMigrationObject(save.time).accumulatorSeconds,
                    0
                ),
                tick: storyMigrationNumber(storyMigrationObject(save.time).tick, Math.round(clock * 4)),
                clock: {
                    fixedStepSeconds: storyMigrationNumber(
                        storyMigrationObject(save.time).fixedStepSeconds,
                        typeof STORY_FIXED_STEP_SECONDS === 'number' ? STORY_FIXED_STEP_SECONDS : 0.25
                    ),
                    accumulatorSeconds: storyMigrationNumber(
                        storyMigrationObject(save.time).accumulatorSeconds,
                        0
                    ),
                    tick: storyMigrationNumber(storyMigrationObject(save.time).tick, Math.round(clock * 4))
                },
                registry: save.scheduler ? storyMigrationClone(save.scheduler) : null
            }
        },
        countries,
        regions,
        characters,
        populationCohorts,
        powerCenters: [],
        companies: [],
        mediaOutlets: [],
        diplomaticEdges: [],
        markets: [],
        militaryForces: forces,
        crises: [],
        events,
        decisions,
        memory: {
            playerPromises: [],
            characterSummaries: {}
        },
        diagnostics: {
            sourceSchema: 'pixelrts_story_v3',
            stateHash: null,
            warnings: ['V2 göç kopyasıdır; kaynak V3 kaydı korunmuştur.'],
            migration: {
                declaredLegacyVersion: save.v == null ? null : save.v,
                unmappedTopLevelFields,
                backfillCounts
            },
            rng: save.rng ? storyMigrationClone(save.rng) : null,
            scheduler: save.scheduler ? storyMigrationClone(save.scheduler) : null,
            activationPolicy: save.activationPolicy
                ? storyMigrationClone(save.activationPolicy)
                : null,
            aggregationPolicy: save.aggregationPolicy
                ? storyMigrationClone(save.aggregationPolicy)
                : null,
            infrastructureGraph: save.infrastructureGraph
                ? storyMigrationClone(save.infrastructureGraph)
                : null
        }
    };

    const validation = storyWorldV2Validate(world);
    if (!validation.ok) {
        return storyMigrationFail(
            sourceRaw,
            validation.issues.map(issue => `${issue.code} ${issue.path}: ${issue.message || ''}`),
            { declaredVersion: save.v }
        );
    }

    const targetRaw = JSON.stringify(world);
    const sourceChecksum = storyMigrationChecksum(sourceRaw);
    const targetChecksum = storyMigrationChecksum(targetRaw);
    const backfills = Object.entries(backfillCounts)
        .filter(([, count]) => count > 0)
        .map(([field, count]) => ({ field, count }));
    const warnings = [];
    if (save.v !== 3) warnings.push(`Depolama anahtarı v3 olsa da payload v=${save.v}; mevcut oyun biçimi olarak kabul edildi.`);
    if (unmappedTopLevelFields.length) warnings.push(`Eşlenmeyen üst alanlar: ${unmappedTopLevelFields.join(', ')}`);

    return {
        ok: true,
        backupRaw: sourceRaw,
        sourceChecksum,
        targetRaw,
        targetChecksum,
        world,
        report: {
            schemaVersion: STORY_MIGRATION_SCHEMA_VERSION,
            status: 'READY',
            source: {
                storageKey: STORY_MIGRATION_KEYS.source,
                checksum: sourceChecksum,
                characterLength: sourceRaw.length,
                declaredVersion: save.v == null ? null : save.v
            },
            target: {
                storageKey: STORY_MIGRATION_KEYS.target,
                schemaVersion: STORY_WORLD_V2_SCHEMA_VERSION,
                checksum: targetChecksum,
                characterLength: targetRaw.length,
                counts: {
                    countries: countries.length,
                    regions: regions.length,
                    characters: characters.length,
                    militaryForces: forces.length,
                    events: events.length
                }
            },
            coverage: {
                countries: `${countries.length}/${save.states.length}`,
                regions: `${regions.length}/${save.nodes.length}`,
                playerCommander: characters.some(character => character.role === 'PLAYER_COMMANDER')
            },
            backfills,
            warnings,
            errors: []
        }
    };
}

function storyMigrateV3Storage(storage, keys) {
    keys = Object.assign({}, STORY_MIGRATION_KEYS, keys || {});
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
        return { ok: false, stage: 'storage', error: 'Geçerli depolama arayüzü gerekli.' };
    }
    const sourceRaw = storage.getItem(keys.source);
    if (sourceRaw == null) return { ok: false, stage: 'source', error: 'Kaynak V3 kayıt bulunamadı.', writes: 0 };
    const prepared = storyMigrationV3RawToV2(sourceRaw);
    if (!prepared.ok) return Object.assign({ stage: 'preflight', writes: 0 }, prepared);

    const existingBackup = storage.getItem(keys.backup);
    if (existingBackup != null && existingBackup !== sourceRaw) {
        return { ok: false, stage: 'backup-conflict', error: 'Farklı bir Faz 5 yedeği zaten var.', writes: 0, report: prepared.report };
    }
    const existingTarget = storage.getItem(keys.target);
    if (existingTarget != null && storyMigrationChecksum(existingTarget) !== prepared.targetChecksum) {
        return { ok: false, stage: 'target-conflict', error: 'Farklı bir V2 hedef kaydı zaten var.', writes: 0, report: prepared.report };
    }

    let writes = 0;
    try {
        if (existingBackup == null) {
            storage.setItem(keys.backup, sourceRaw);
            writes++;
        }
        const backupRaw = storage.getItem(keys.backup);
        if (backupRaw !== sourceRaw || storyMigrationChecksum(backupRaw) !== prepared.sourceChecksum) {
            throw new Error('Yedek byte-for-byte doğrulanamadı.');
        }
        if (storage.getItem(keys.source) !== sourceRaw) throw new Error('Kaynak kayıt göç sırasında değişti.');
        if (existingTarget == null) {
            storage.setItem(keys.target, prepared.targetRaw);
            writes++;
        }
        const targetRaw = storage.getItem(keys.target);
        if (storyMigrationChecksum(targetRaw) !== prepared.targetChecksum) throw new Error('V2 hedef checksum doğrulanamadı.');
        const targetWorld = JSON.parse(targetRaw);
        const validation = storyWorldV2Validate(targetWorld);
        if (!validation.ok) throw new Error('Yazılan V2 hedef doğrulayıcıyı geçmedi.');

        prepared.report.status = 'MIGRATED';
        prepared.report.backup = {
            storageKey: keys.backup,
            checksum: prepared.sourceChecksum,
            exactSourceCopy: true
        };
        storage.setItem(keys.report, JSON.stringify(prepared.report));
        writes++;
        return {
            ok: true,
            stage: 'complete',
            writes,
            sourceUnchanged: storage.getItem(keys.source) === sourceRaw,
            backupExact: storage.getItem(keys.backup) === sourceRaw,
            report: prepared.report,
            world: targetWorld
        };
    } catch (error) {
        return {
            ok: false,
            stage: 'write',
            writes,
            sourceUnchanged: storage.getItem(keys.source) === sourceRaw,
            error: String(error && error.message || error),
            report: prepared.report
        };
    }
}
