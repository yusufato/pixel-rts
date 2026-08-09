// ═══════════════════════════════════════════════════════════════════════════
//  PLAYER KNOWLEDGE SERVICE — Faz 4.1
//  ---------------------------------------------------------------------------
//  UI ham StoryWorldStateV2 okumaz. Her değer kaynak, güven, gözlem zamanı ve
//  bilgi sınıfıyla PlayerVisibleFact üzerinden oyuncuya açılır.
// ═══════════════════════════════════════════════════════════════════════════

const PLAYER_KNOWLEDGE_SCHEMA_VERSION = 4;
const PLAYER_FACT_STATUS = Object.freeze({
    UNKNOWN: 'UNKNOWN',
    ESTIMATED: 'ESTIMATED',
    RUMOR: 'RUMOR',
    VERIFIED: 'VERIFIED'
});

function storyPlayerKnowledgeClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

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
            institutions: fact(storyPlayerVerifiedFact(
                country.id,
                'institutions',
                own ? country.institutions : (typeof storyInstitutionPublicView === 'function'
                    ? storyInstitutionPublicView(country.institutions) : null),
                gameTime,
                own ? 'OWN_CONSTITUTIONAL_AUTHORITY_LEDGER' : 'PUBLIC_CONSTITUTIONAL_RECORD'
            )),
            stateCapacity: fact(storyPlayerVerifiedFact(
                country.id,
                'stateCapacity',
                own ? country.stateCapacity : (typeof storyStateCapacityPublicView === 'function'
                    ? storyStateCapacityPublicView(country.stateCapacity) : null),
                gameTime,
                own ? 'OWN_STATE_CAPACITY_LEDGER' : 'PUBLIC_GOVERNANCE_RECORD'
            )),
            elections: fact(storyPlayerVerifiedFact(
                country.id,
                'elections',
                own ? country.elections : (typeof storyElectionPublicView === 'function'
                    ? storyElectionPublicView(country.elections) : null),
                gameTime,
                own ? 'OWN_ELECTION_ADMINISTRATION' : 'PUBLIC_ELECTION_RECORD'
            )),
            integrity: fact(storyPlayerVerifiedFact(
                country.id,
                'integrity',
                own ? country.integrity : (typeof storyIntegrityPublicView === 'function'
                    ? storyIntegrityPublicView(country.integrity) : null),
                gameTime,
                own ? 'OWN_INTEGRITY_INVESTIGATION_LEDGER' : 'PUBLIC_INTEGRITY_RECORD'
            )),
            politicalCrisis: fact(storyPlayerVerifiedFact(
                country.id,
                'politicalCrisis',
                own ? country.politicalCrisis : (typeof storyPoliticalCrisisPublicView === 'function'
                    ? storyPoliticalCrisisPublicView(country.politicalCrisis) : null),
                gameTime,
                own ? 'OWN_POLITICAL_CRISIS_LEDGER' : 'PUBLIC_POLITICAL_CRISIS_RECORD'
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
            institutions: fact(storyPlayerVerifiedFact(
                region.id,
                'institutions',
                own ? region.institutions : (typeof storyInstitutionPublicView === 'function'
                    ? storyInstitutionPublicView(region.institutions) : null),
                gameTime,
                own ? 'OWN_LOCAL_AUTHORITY_LEDGER' : 'PUBLIC_LOCAL_AUTHORITY_RECORD'
            )),
            stateCapacity: fact(storyPlayerVerifiedFact(
                region.id,
                'stateCapacity',
                own ? region.stateCapacity : (typeof storyStateCapacityPublicView === 'function'
                    ? storyStateCapacityPublicView(region.stateCapacity) : null),
                gameTime,
                own ? 'OWN_LOCAL_CAPACITY_LEDGER' : 'PUBLIC_REGIONAL_CONTROL_RECORD'
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
            organizationId: fact(own
                ? storyPlayerVerifiedFact(character.id, 'organizationId', character.organizationId, gameTime, 'OWN_CHARACTER_RECORD')
                : storyPlayerUnknownFact(character.id, 'organizationId', gameTime)),
            institutionId: fact(own
                ? storyPlayerVerifiedFact(character.id, 'institutionId', character.institutionId, gameTime, 'OWN_CHARACTER_RECORD')
                : storyPlayerUnknownFact(character.id, 'institutionId', gameTime)),
            serviceId: fact(own
                ? storyPlayerVerifiedFact(character.id, 'serviceId', character.serviceId, gameTime, 'OWN_CHARACTER_RECORD')
                : storyPlayerUnknownFact(character.id, 'serviceId', gameTime)),
            publicTitle: fact(storyPlayerVerifiedFact(
                character.id, 'publicTitle', character.publicTitle, gameTime, 'PUBLIC_RECORD'
            )),
            identityProfile: fact(own
                ? storyPlayerVerifiedFact(character.id, 'identityProfile', character.identityProfile, gameTime, 'OWN_CHARACTER_RECORD')
                : storyPlayerUnknownFact(character.id, 'identityProfile', gameTime)),
            values: fact(own
                ? storyPlayerVerifiedFact(character.id, 'values', character.values, gameTime, 'OWN_CHARACTER_RECORD')
                : storyPlayerUnknownFact(character.id, 'values', gameTime)),
            goals: fact(own
                ? storyPlayerVerifiedFact(character.id, 'goals', character.goals, gameTime, 'OWN_CHARACTER_RECORD')
                : storyPlayerUnknownFact(character.id, 'goals', gameTime)),
            career: fact(own
                ? storyPlayerVerifiedFact(character.id, 'career', character.career, gameTime, 'OWN_CHARACTER_RECORD')
                : storyPlayerUnknownFact(character.id, 'career', gameTime)),
            voiceProfile: fact(own
                ? storyPlayerVerifiedFact(character.id, 'voiceProfile', character.voiceProfile, gameTime, 'OWN_CHARACTER_RECORD')
                : storyPlayerUnknownFact(character.id, 'voiceProfile', gameTime)),
            currentRegimeAlignment: fact(own
                ? storyPlayerVerifiedFact(character.id, 'currentRegimeAlignment', character.currentRegimeAlignment, gameTime, 'OWN_CHARACTER_RECORD')
                : storyPlayerUnknownFact(character.id, 'currentRegimeAlignment', gameTime)),
            personality: fact(storyPlayerUnknownFact(character.id, 'personality', gameTime))
        };
    });

    // Faz 35: yönlü ilişki iç durumdur. Oyuncunun kendi ülkesindeki bir
    // aktörün taraf olduğu kayıtlar açılır; yabancıların birbirine güveni
    // salt WorldV2'de bulunuyor diye oyuncuya sızmaz.
    const characterOwnerById = new Map((world.characters || []).map(row => [row.id, row.ownerId]));
    const characterRelationships = (world.characterRelationships || []).filter(edge =>
        characterOwnerById.get(edge.fromActorId) === playerCountryId
        || characterOwnerById.get(edge.toActorId) === playerCountryId
    ).map(edge => ({
        id: edge.id,
        fromActorId: edge.fromActorId,
        toActorId: edge.toActorId,
        contactReason: fact(storyPlayerVerifiedFact(edge.id, 'contactReason', edge.contactReason, gameTime, 'OWN_RELATIONSHIP_MEMORY')),
        trustBps: fact(storyPlayerVerifiedFact(edge.id, 'trustBps', edge.trustBps, gameTime, 'OWN_RELATIONSHIP_MEMORY')),
        fearBps: fact(storyPlayerVerifiedFact(edge.id, 'fearBps', edge.fearBps, gameTime, 'OWN_RELATIONSHIP_MEMORY')),
        respectBps: fact(storyPlayerVerifiedFact(edge.id, 'respectBps', edge.respectBps, gameTime, 'OWN_RELATIONSHIP_MEMORY')),
        debtBps: fact(storyPlayerVerifiedFact(edge.id, 'debtBps', edge.debtBps, gameTime, 'OWN_RELATIONSHIP_MEMORY')),
        hostilityBps: fact(storyPlayerVerifiedFact(edge.id, 'hostilityBps', edge.hostilityBps, gameTime, 'OWN_RELATIONSHIP_MEMORY'))
    }));

    // Faz 37: oyuncu kendi aktörünün eylem makbuzunu tam görür. Yabancı bir
    // aktör oyuncu karakterini hedeflediyse olayın varlığı ve sosyal sonucu
    // görünür, fakat yabancı kariyer bedeli ve kurum içi yetki kanıtı sızmaz.
    const characterActions = (world.characterActions || []).filter(receipt => {
        if (receipt.actorCountryId === playerCountryId) return true;
        if (receipt.targetCountryId !== playerCountryId) return false;
        if (receipt.actionType !== 'SABOTAGE') return true;
        const finalResult = receipt.domainReceipt && receipt.domainReceipt.finalResult;
        return !!(finalResult && finalResult.detected);
    }).map(receipt => {
        if (receipt.actorCountryId === playerCountryId) return storyPlayerKnowledgeClone(receipt);
        if (receipt.actionType === 'SABOTAGE') {
            const domain = receipt.domainReceipt || {};
            const finalResult = domain.finalResult || {};
            const attributed = !!finalResult.attributed;
            return {
                id: receipt.id,
                entityType: receipt.entityType,
                actionType: receipt.actionType,
                actorId: attributed ? receipt.actorId : null,
                actorCountryId: attributed ? receipt.actorCountryId : null,
                targetActorId: receipt.targetActorId,
                targetCountryId: receipt.targetCountryId,
                targetModel: receipt.targetModel,
                status: receipt.status,
                completedAt: receipt.completedAt,
                domainContext: {
                    assetType: receipt.domainContext && receipt.domainContext.assetType || null,
                    targetAssetId: domain.targetAssetId || null
                },
                domainReceipt: {
                    outcomeModel: 'DETECTED_COVERT_INCIDENT',
                    targetAssetType: domain.targetAssetType || null,
                    targetAssetId: domain.targetAssetId || null,
                    finalResult: {
                        status: finalResult.status,
                        detected: true,
                        attributed,
                        physicalMutation: !!finalResult.physicalMutation,
                        previousDamageBps: finalResult.previousDamageBps,
                        damageBps: finalResult.damageBps,
                        damageDeltaBps: finalResult.damageDeltaBps,
                        resolvedAt: finalResult.resolvedAt
                    }
                },
                relationshipEffects: [],
                authority: null,
                cost: null,
                costReceipt: null,
                foreignDetailsRedacted: true
            };
        }
        return {
            id: receipt.id,
            entityType: receipt.entityType,
            actionType: receipt.actionType,
            actorId: receipt.actorId,
            actorCountryId: receipt.actorCountryId,
            targetActorId: receipt.targetActorId,
            targetCountryId: receipt.targetCountryId,
            status: receipt.status,
            completedAt: receipt.completedAt,
            relationshipEffects: storyPlayerKnowledgeClone((receipt.relationshipEffects || []).filter(effect =>
                characterOwnerById.get(effect.fromActorId) === playerCountryId
                || characterOwnerById.get(effect.toActorId) === playerCountryId)),
            authority: null,
            cost: null,
            costReceipt: null,
            foreignDetailsRedacted: true
        };
    });

    // Faz 34 köken kararları ham dünya gerçeğinden açılmaz. Oyuncunun ülkesine
    // ait bir karakter gerçekten biliyorsa, en güvenilir ActorBelief üzerinden
    // görünür olur; yabancı/özel geçmiş böylece WorldV2'den UI'a sızmaz.
    const knownOriginByFact = new Map();
    for (const belief of (world.actorBeliefs || [])) {
        if (belief.holderCountryId !== playerCountryId) continue;
        const previous = knownOriginByFact.get(belief.worldFactId);
        if (!previous || Number(belief.confidenceBps) > Number(previous.confidenceBps)) {
            knownOriginByFact.set(belief.worldFactId, belief);
        }
    }
    const worldFactById = new Map((world.worldFacts || []).map(row => [row.id, row]));
    const originFacts = Array.from(knownOriginByFact.values()).sort((a, b) =>
        a.worldFactId.localeCompare(b.worldFactId, 'en')).map(belief => {
        const origin = worldFactById.get(belief.worldFactId);
        if (!origin) return null;
        const confidence = Math.max(1, Math.min(10000, Number(belief.confidenceBps) || 1));
        return fact(storyPlayerVisibleFact({
            id: `visible-origin:${belief.worldFactId}`,
            subjectId: origin.subjectActorId,
            field: `originDecision:${origin.decisionIndex}`,
            value: {
                worldFactId: origin.id,
                role: origin.role,
                theme: origin.theme,
                questionText: origin.questionText,
                optionText: origin.optionText,
                gain: origin.gain,
                cost: origin.cost,
                reactionHook: origin.reactionHook,
                occurredAt: origin.occurredAt
            },
            status: confidence === 10000 ? PLAYER_FACT_STATUS.VERIFIED : PLAYER_FACT_STATUS.ESTIMATED,
            confidenceBps: confidence,
            source: { type: belief.source && belief.source.type || 'ACTOR_BELIEF', id: belief.id },
            observedAt: belief.learnedAt,
            expiresAt: null
        }));
    }).filter(Boolean);

    // Faz 36: hafıza da bilgi filtresinden geçer. Bir ülke, yalnız kendi
    // aktörlerinden en az birinin gerçekten bildiği yakın kayıt, bölüm ve
    // mihenk taşını görür. SECRET etiketi WorldV2'de var diye yabancıya açılmaz.
    const memorySource = world.memory && typeof world.memory === 'object' ? world.memory : {};
    const ownActorIds = new Set((world.characters || [])
        .filter(row => row.ownerId === playerCountryId).map(row => row.id));
    const characterMemory = {
        schemaVersion: memorySource.schemaVersion,
        adapterVersion: memorySource.adapterVersion,
        policyHash: memorySource.policyHash,
        nextSequence: Number(memorySource.nextSequence) || 0,
        recentByActor: {},
        episodes: {},
        milestones: {},
        summariesByActor: {},
        diagnostics: Object.assign({}, memorySource.diagnostics || {}, { playerFiltered: true })
    };
    for (const actorId of Array.from(ownActorIds).sort()) {
        if (Array.isArray(memorySource.recentByActor && memorySource.recentByActor[actorId])) {
            characterMemory.recentByActor[actorId] = storyPlayerKnowledgeClone(memorySource.recentByActor[actorId]);
        }
        if (Array.isArray(memorySource.summariesByActor && memorySource.summariesByActor[actorId])) {
            characterMemory.summariesByActor[actorId] = storyPlayerKnowledgeClone(memorySource.summariesByActor[actorId]);
        }
    }
    for (const [id, episode] of Object.entries(memorySource.episodes || {})) {
        if ((episode.participantActorIds || []).some(actorId => ownActorIds.has(actorId))) {
            characterMemory.episodes[id] = storyPlayerKnowledgeClone(episode);
        }
    }
    for (const [id, milestone] of Object.entries(memorySource.milestones || {})) {
        if ((milestone.holderActorIds || []).some(actorId => ownActorIds.has(actorId))) {
            characterMemory.milestones[id] = storyPlayerKnowledgeClone(milestone);
        }
    }

    const publicPhysicalAssets = world.diagnostics && world.diagnostics.infrastructure
        && Array.isArray(world.diagnostics.infrastructure.publicPhysicalAssets)
        ? world.diagnostics.infrastructure.publicPhysicalAssets : [];
    const infrastructureAssets = publicPhysicalAssets.map(asset => ({
        id: asset.id,
        topology: fact(storyPlayerVerifiedFact(
            asset.id,
            'publicTopology',
            {
                mode: asset.mode,
                endpointRegionIds: (asset.endpointRegionIds || []).slice(),
                ownerCountryIds: (asset.ownerCountryIds || []).slice()
            },
            gameTime,
            'PUBLIC_INFRASTRUCTURE_MAP'
        ))
    }));

    return {
        schemaVersion: PLAYER_KNOWLEDGE_SCHEMA_VERSION,
        playerCountryId,
        worldCampaignId: world.meta.campaignId,
        generatedAt: gameTime,
        facts,
        countries,
        regions,
        characters,
        characterRelationships,
        characterActions,
        infrastructureAssets,
        originFacts,
        characterMemory
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
    if (!Array.isArray(view.originFacts)) issues.push({ code: 'ORIGIN_FACTS_ARRAY', path: '$.originFacts' });
    if (!Array.isArray(view.characterRelationships)) issues.push({ code: 'CHARACTER_RELATIONSHIPS_ARRAY', path: '$.characterRelationships' });
    if (!Array.isArray(view.characterActions)) issues.push({ code: 'CHARACTER_ACTIONS_ARRAY', path: '$.characterActions' });
    if (!Array.isArray(view.infrastructureAssets)) {
        issues.push({ code: 'INFRASTRUCTURE_ASSETS_ARRAY', path: '$.infrastructureAssets' });
    } else {
        view.infrastructureAssets.forEach((asset, index) => {
            const at = `$.infrastructureAssets[${index}]`;
            if (!asset || typeof asset.id !== 'string' || !asset.id) issues.push({ code: 'INFRASTRUCTURE_ASSET_ID', path: `${at}.id` });
            if (!asset || !asset.topology || asset.topology.status !== PLAYER_FACT_STATUS.VERIFIED) {
                issues.push({ code: 'INFRASTRUCTURE_ASSET_TOPOLOGY', path: `${at}.topology` });
            }
            const serialized = JSON.stringify(asset || {});
            for (const secret of ['damageBps', 'capacity', 'effectiveCapacity', 'access', 'enabled']) {
                if (serialized.includes(`\"${secret}\"`)) issues.push({ code: 'INFRASTRUCTURE_SECRET_LEAK', path: at });
            }
        });
    }
    if (!view.characterMemory || typeof view.characterMemory !== 'object' || Array.isArray(view.characterMemory)) {
        issues.push({ code: 'CHARACTER_MEMORY_OBJECT', path: '$.characterMemory' });
    }
    return { ok: issues.length === 0, issues };
}
