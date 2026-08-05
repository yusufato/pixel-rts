// ═══════════════════════════════════════════════════════════════════════════
//  PLAYER KNOWLEDGE SERVICE — Faz 4.1
//  ---------------------------------------------------------------------------
//  UI ham StoryWorldStateV2 okumaz. Her değer kaynak, güven, gözlem zamanı ve
//  bilgi sınıfıyla PlayerVisibleFact üzerinden oyuncuya açılır.
// ═══════════════════════════════════════════════════════════════════════════

const PLAYER_KNOWLEDGE_SCHEMA_VERSION = 1;
const PLAYER_FACT_STATUS = Object.freeze({
    UNKNOWN: 'UNKNOWN',
    ESTIMATED: 'ESTIMATED',
    RUMOR: 'RUMOR',
    VERIFIED: 'VERIFIED'
});

function storyPlayerVisibleFact(input) {
    const status = input && input.status;
    if (!Object.values(PLAYER_FACT_STATUS).includes(status)) {
        throw new Error(`Geçersiz oyuncu bilgi durumu: ${status}`);
    }
    const confidence = Math.max(0, Math.min(10000, Number(input.confidenceBps) || 0));
    if (status === PLAYER_FACT_STATUS.UNKNOWN && confidence !== 0) {
        throw new Error('UNKNOWN bilgi güveni 0 olmalıdır.');
    }
    if (status === PLAYER_FACT_STATUS.VERIFIED && confidence !== 10000) {
        throw new Error('VERIFIED bilgi güveni 10000 olmalıdır.');
    }
    if ((status === PLAYER_FACT_STATUS.ESTIMATED || status === PLAYER_FACT_STATUS.RUMOR)
        && (confidence <= 0 || confidence >= 10000)) {
        throw new Error(`${status} bilgi güveni 1–9999 arasında olmalıdır.`);
    }
    return {
        id: String(input.id),
        subjectId: String(input.subjectId),
        field: String(input.field),
        value: status === PLAYER_FACT_STATUS.UNKNOWN ? null : storyWorldV2Clone(input.value),
        status,
        confidenceBps: confidence,
        source: {
            type: String(input.source && input.source.type || 'UNKNOWN'),
            id: input.source && input.source.id != null ? String(input.source.id) : null
        },
        observedAt: Number.isFinite(Number(input.observedAt)) ? Number(input.observedAt) : 0,
        expiresAt: input.expiresAt == null ? null : Number(input.expiresAt)
    };
}

function storyPlayerVerifiedFact(subjectId, field, value, gameTime, sourceType) {
    return storyPlayerVisibleFact({
        id: `fact:${subjectId}:${field}`,
        subjectId,
        field,
        value,
        status: PLAYER_FACT_STATUS.VERIFIED,
        confidenceBps: 10000,
        source: { type: sourceType || 'DIRECT', id: null },
        observedAt: gameTime,
        expiresAt: null
    });
}

function storyPlayerUnknownFact(subjectId, field, gameTime) {
    return storyPlayerVisibleFact({
        id: `fact:${subjectId}:${field}`,
        subjectId,
        field,
        value: null,
        status: PLAYER_FACT_STATUS.UNKNOWN,
        confidenceBps: 0,
        source: { type: 'NO_SOURCE', id: null },
        observedAt: gameTime,
        expiresAt: null
    });
}

// Protesto/grev/ayaklanma kamusal olaydır; yabancı oyuncudan gizlenmez. Ancak
// örgütlenme, seferberlik, radikalleşme ve hükümet yanıt eşiği iç veridir.
function storyPlayerCollectivePublicView(value) {
    if (!value || typeof value !== 'object') return null;
    if (Array.isArray(value.movements)) {
        const movements = value.movements.filter(row => row.stage && row.stage !== 'NONE').map(row => ({
            id: row.id,
            problemType: row.problemType,
            blamedActorId: row.blamedActorId,
            stage: row.stage,
            stageSince: row.stageSince
        }));
        return {
            countryId: value.countryId,
            activeActionCount: movements.length,
            protestCount: movements.filter(row => row.stage === 'PROTEST').length,
            strikeCount: movements.filter(row => row.stage === 'STRIKE').length,
            uprisingCount: movements.filter(row => row.stage === 'UPRISING').length,
            movements
        };
    }
    const participations = (value.participations || []).filter(row => row.stage && row.stage !== 'NONE').map(row => ({
        movementId: row.movementId,
        problemType: row.problemType,
        blamedActorId: row.blamedActorId,
        stage: row.stage
    }));
    return {
        regionId: value.regionId,
        countryId: value.countryId,
        activeActionCount: participations.length,
        participations
    };
}

function storyPlayerKnowledgeProject(world, playerCountryId) {
    if (typeof storyFeatureEnabled === 'function' && !storyFeatureEnabled('knowledge.playerProjection')) {
        throw new Error('Oyuncu bilgi projeksiyonu özellik bayrağıyla kapalı.');
    }
    const valid = storyWorldV2Validate(world);
    if (!valid.ok) throw new StoryWorldValidationError(valid.issues);
    const countryIds = new Set(world.countries.map(country => country.id));
    if (!countryIds.has(playerCountryId)) throw new Error(`Oyuncu ülkesi bulunamadı: ${playerCountryId}`);

    const gameTime = world.clock.gameTime;
    const facts = [];
    const fact = value => { facts.push(value); return value; };
    const countries = world.countries.map(country => {
        const own = country.id === playerCountryId;
        return {
            id: country.id,
            name: fact(storyPlayerVerifiedFact(country.id, 'name', country.name, gameTime, 'PUBLIC_RECORD')),
            color: fact(storyPlayerVerifiedFact(country.id, 'color', country.color, gameTime, 'PUBLIC_MAP')),
            welfare: fact(own
                ? storyPlayerVerifiedFact(country.id, 'welfare', country.welfare, gameTime, 'OWN_GOVERNMENT')
                : storyPlayerUnknownFact(country.id, 'welfare', gameTime)),
            reputation: fact(own
                ? storyPlayerVerifiedFact(country.id, 'reputation', country.reputation, gameTime, 'OWN_GOVERNMENT')
                : storyPlayerUnknownFact(country.id, 'reputation', gameTime)),
            inflation: fact(own
                ? storyPlayerVerifiedFact(country.id, 'inflation', country.inflation, gameTime, 'OWN_TREASURY')
                : storyPlayerUnknownFact(country.id, 'inflation', gameTime)),
            market: fact(own
                ? storyPlayerVerifiedFact(country.id, 'market', country.market, gameTime, 'OWN_MARKET_LEDGER')
                : storyPlayerUnknownFact(country.id, 'market', gameTime)),
            budget: fact(own
                ? storyPlayerVerifiedFact(country.id, 'budget', country.budget, gameTime, 'OWN_BUDGET_LEDGER')
                : storyPlayerUnknownFact(country.id, 'budget', gameTime)),
            companyEconomy: fact(own
                ? storyPlayerVerifiedFact(country.id, 'companyEconomy', country.companyEconomy, gameTime, 'OWN_COMPANY_REGISTRY')
                : storyPlayerUnknownFact(country.id, 'companyEconomy', gameTime)),
            economicPolicy: fact(own
                ? storyPlayerVerifiedFact(country.id, 'economicPolicy', country.economicPolicy, gameTime, 'OWN_ECONOMIC_DECISION_LEDGER')
                : storyPlayerUnknownFact(country.id, 'economicPolicy', gameTime)),
            publicOpinion: fact(own
                ? storyPlayerVerifiedFact(country.id, 'publicOpinion', country.publicOpinion, gameTime, 'OWN_SOCIAL_RESEARCH')
                : storyPlayerUnknownFact(country.id, 'publicOpinion', gameTime)),
            collectiveAction: fact(storyPlayerVerifiedFact(
                country.id,
                'collectiveAction',
                own ? country.collectiveAction : storyPlayerCollectivePublicView(country.collectiveAction),
                gameTime,
                own ? 'OWN_SOCIAL_ADMINISTRATION' : 'PUBLIC_COLLECTIVE_EVENT'
            )),
            humanMigration: fact(storyPlayerVerifiedFact(
                country.id,
                'humanMigration',
                own ? country.humanMigration : (typeof storyHumanMigrationPublicView === 'function'
                    ? storyHumanMigrationPublicView(country.humanMigration) : null),
                gameTime,
                own ? 'OWN_MIGRATION_ADMINISTRATION' : 'PUBLIC_MIGRATION_RECORD'
            )),
            powerCenters: fact(storyPlayerVerifiedFact(
                country.id,
                'powerCenters',
                own ? country.powerCenters : (typeof storyPowerCenterPublicView === 'function'
                    ? storyPowerCenterPublicView(country.powerCenters) : null),
                gameTime,
                own ? 'OWN_INSTITUTIONAL_REGISTRY' : 'PUBLIC_INSTITUTIONAL_RECORD'
            )),
            resources: fact(own
                ? storyPlayerVerifiedFact(country.id, 'resources', country.resources, gameTime, 'OWN_TREASURY')
                : storyPlayerUnknownFact(country.id, 'resources', gameTime))
        };
    });

    const regions = world.regions.map(region => {
        const own = region.ownerId === playerCountryId;
        const populationCohorts = world.populationCohorts.filter(cohort => cohort.regionId === region.id);
        return {
            id: region.id,
            name: fact(storyPlayerVerifiedFact(region.id, 'name', region.name, gameTime, 'PUBLIC_MAP')),
            ownerId: fact(storyPlayerVerifiedFact(region.id, 'ownerId', region.ownerId, gameTime, 'PUBLIC_MAP')),
            neighborIds: fact(storyPlayerVerifiedFact(region.id, 'neighborIds', region.neighborIds, gameTime, 'PUBLIC_MAP')),
            level: fact(own
                ? storyPlayerVerifiedFact(region.id, 'level', region.level, gameTime, 'OWN_ADMINISTRATION')
                : storyPlayerUnknownFact(region.id, 'level', gameTime)),
            garrison: fact(own
                ? storyPlayerVerifiedFact(region.id, 'garrison', region.garrison, gameTime, 'OWN_MILITARY')
                : storyPlayerUnknownFact(region.id, 'garrison', gameTime)),
            infrastructure: fact(own
                ? storyPlayerVerifiedFact(region.id, 'infrastructure', region.infrastructure, gameTime, 'OWN_ADMINISTRATION')
                : storyPlayerUnknownFact(region.id, 'infrastructure', gameTime)),
            population: fact(own
                ? storyPlayerVerifiedFact(region.id, 'population', region.population, gameTime, 'OWN_CENSUS')
                : storyPlayerUnknownFact(region.id, 'population', gameTime)),
            populationCohorts: fact(own
                ? storyPlayerVerifiedFact(region.id, 'populationCohorts', populationCohorts, gameTime, 'OWN_CENSUS')
                : storyPlayerUnknownFact(region.id, 'populationCohorts', gameTime)),
            needsWelfare: fact(own
                ? storyPlayerVerifiedFact(region.id, 'needsWelfare', region.needsWelfare, gameTime, 'OWN_SOCIAL_SERVICES')
                : storyPlayerUnknownFact(region.id, 'needsWelfare', gameTime)),
            publicOpinion: fact(own
                ? storyPlayerVerifiedFact(region.id, 'publicOpinion', region.publicOpinion, gameTime, 'OWN_SOCIAL_RESEARCH')
                : storyPlayerUnknownFact(region.id, 'publicOpinion', gameTime)),
            collectiveAction: fact(storyPlayerVerifiedFact(
                region.id,
                'collectiveAction',
                own ? region.collectiveAction : storyPlayerCollectivePublicView(region.collectiveAction),
                gameTime,
                own ? 'OWN_SOCIAL_ADMINISTRATION' : 'PUBLIC_COLLECTIVE_EVENT'
            )),
            humanMigration: fact(storyPlayerVerifiedFact(
                region.id,
                'humanMigration',
                own ? region.humanMigration : (typeof storyHumanMigrationPublicView === 'function'
                    ? storyHumanMigrationPublicView(region.humanMigration) : null),
                gameTime,
                own ? 'OWN_MIGRATION_ADMINISTRATION' : 'PUBLIC_MIGRATION_RECORD'
            )),
            powerCenters: fact(storyPlayerVerifiedFact(
                region.id,
                'powerCenters',
                own ? region.powerCenters : (typeof storyPowerCenterPublicView === 'function'
                    ? storyPowerCenterPublicView(region.powerCenters) : null),
                gameTime,
                own ? 'OWN_INSTITUTIONAL_REGISTRY' : 'PUBLIC_INSTITUTIONAL_RECORD'
            )),
            wealth: fact(own
                ? storyPlayerVerifiedFact(region.id, 'wealth', region.wealth, gameTime, 'OWN_TREASURY')
                : storyPlayerUnknownFact(region.id, 'wealth', gameTime)),
            deposits: fact(own
                ? storyPlayerVerifiedFact(region.id, 'deposits', region.deposits, gameTime, 'OWN_ADMINISTRATION')
                : storyPlayerUnknownFact(region.id, 'deposits', gameTime)),
            stocks: fact(own
                ? storyPlayerVerifiedFact(region.id, 'stocks', {
                    quantities: region.stocks,
                    safeTargets: region.safeStockTargets,
                    shortages: region.stockShortages
                }, gameTime, 'OWN_STOCK_LEDGER')
                : storyPlayerUnknownFact(region.id, 'stocks', gameTime)),
            trade: fact(own
                ? storyPlayerVerifiedFact(region.id, 'trade', region.trade, gameTime, 'OWN_TRADE_LEDGER')
                : storyPlayerUnknownFact(region.id, 'trade', gameTime)),
            market: fact(own
                ? storyPlayerVerifiedFact(region.id, 'market', region.market, gameTime, 'OWN_MARKET_LEDGER')
                : storyPlayerUnknownFact(region.id, 'market', gameTime)),
            companyEconomy: fact(own
                ? storyPlayerVerifiedFact(region.id, 'companyEconomy', region.companyEconomy, gameTime, 'OWN_COMPANY_REGISTRY')
                : storyPlayerUnknownFact(region.id, 'companyEconomy', gameTime)),
            logistics: fact(own
                ? storyPlayerVerifiedFact(region.id, 'logistics', region.logistics, gameTime, 'OWN_INFRASTRUCTURE')
                : storyPlayerUnknownFact(region.id, 'logistics', gameTime))
        };
    });

    const characters = world.characters.map(character => {
        const own = character.ownerId === playerCountryId;
        return {
            id: character.id,
            name: fact(storyPlayerVerifiedFact(character.id, 'name', character.name, gameTime, 'PUBLIC_RECORD')),
            role: fact(storyPlayerVerifiedFact(character.id, 'role', character.role, gameTime, 'PUBLIC_RECORD')),
            regionId: fact(own
                ? storyPlayerVerifiedFact(character.id, 'regionId', character.regionId, gameTime, 'OWN_COMMAND')
                : storyPlayerUnknownFact(character.id, 'regionId', gameTime)),
            loyalty: fact(own
                ? storyPlayerVerifiedFact(character.id, 'loyalty', character.loyalty, gameTime, 'OWN_COMMAND')
                : storyPlayerUnknownFact(character.id, 'loyalty', gameTime)),
            skills: fact(own
                ? storyPlayerVerifiedFact(character.id, 'skills', character.skills, gameTime, 'OWN_COMMAND')
                : storyPlayerUnknownFact(character.id, 'skills', gameTime)),
            personality: fact(storyPlayerUnknownFact(character.id, 'personality', gameTime))
        };
    });

    return {
        schemaVersion: PLAYER_KNOWLEDGE_SCHEMA_VERSION,
        playerCountryId,
        worldCampaignId: world.meta.campaignId,
        generatedAt: gameTime,
        facts,
        countries,
        regions,
        characters
    };
}

function storyPlayerKnowledgeValidate(view) {
    const issues = [];
    if (!view || typeof view !== 'object') return { ok: false, issues: [{ code: 'VIEW_REQUIRED', path: '$' }] };
    if (view.schemaVersion !== PLAYER_KNOWLEDGE_SCHEMA_VERSION) {
        issues.push({ code: 'SCHEMA_VERSION', path: '$.schemaVersion' });
    }
    if (!Array.isArray(view.facts)) issues.push({ code: 'FACTS_ARRAY', path: '$.facts' });
    else {
        const ids = new Set();
        view.facts.forEach((fact, index) => {
            const at = `$.facts[${index}]`;
            if (!fact || typeof fact !== 'object') {
                issues.push({ code: 'INVALID_FACT', path: at });
                return;
            }
            if (ids.has(fact.id)) issues.push({ code: 'DUPLICATE_FACT', path: `${at}.id` });
            ids.add(fact.id);
            if (!Object.values(PLAYER_FACT_STATUS).includes(fact.status)) {
                issues.push({ code: 'INVALID_STATUS', path: `${at}.status` });
            }
            if (fact.status === PLAYER_FACT_STATUS.UNKNOWN && fact.value !== null) {
                issues.push({ code: 'UNKNOWN_VALUE_LEAK', path: `${at}.value` });
            }
            if (fact.status === PLAYER_FACT_STATUS.VERIFIED && fact.confidenceBps !== 10000) {
                issues.push({ code: 'VERIFIED_CONFIDENCE', path: `${at}.confidenceBps` });
            }
        });
    }
    return { ok: issues.length === 0, issues };
}
