// ==========================================================================
//  FİZİKSEL ALTYAPI İŞ EMİRLERİ — HXD-7.4.1
//  ------------------------------------------------------------------------
//  Hasarlı ROAD / SEA / RAIL segmentlerini doğrudan iyileştiren sihirli bir
//  mutasyon yerine; hedef, yetki, kaynak rezervasyonu, süre ve makbuz taşıyan
//  deterministik bakım/onarım sözleşmesi. LLM bu deftere sayı veya onay yazamaz.
// ==========================================================================

const STORY_INFRA_WORK_SCHEMA_VERSION = 1;
const STORY_INFRA_WORK_ADAPTER_VERSION = 'story-infrastructure-work-order-1';
const STORY_INFRA_WORK_STATUSES = Object.freeze([
    'AWAITING_REQUIREMENTS', 'AUTHORIZED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
]);
const STORY_INFRA_WORK_POLICY = Object.freeze({
    LAND: Object.freeze({ cash: 40, materials: Object.freeze({ raw_materials: 8, industrial_parts: 6 }), workforce: 25, durationDays: 20 }),
    SEA: Object.freeze({ cash: 70, materials: Object.freeze({ raw_materials: 12, industrial_parts: 10, electronics: 1 }), workforce: 40, durationDays: 35 }),
    RAIL: Object.freeze({ cash: 55, materials: Object.freeze({ raw_materials: 10, industrial_parts: 9, electronics: 1 }), workforce: 32, durationDays: 28 })
});
const STORY_INFRA_ROUTE_MODES = Object.freeze(['LAND', 'RAIL']);
const STORY_INFRA_ROUTE_POLICY = Object.freeze({
    LAND: Object.freeze({ cashPerEdge: 16, rawPerEdge: 3, partsPerEdge: 2,
        workforcePerEdge: 7, daysPerEdge: 4, bridgeCash: 18, tunnelCash: 34 }),
    RAIL: Object.freeze({ cashPerEdge: 25, rawPerEdge: 4, partsPerEdge: 4,
        electronicsPerEdge: .25, workforcePerEdge: 10, daysPerEdge: 6,
        bridgeCash: 28, tunnelCash: 50 })
});

function storyInfrastructureWorkClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyInfrastructureWorkEnsure(root) {
    const state = root || (typeof STORY !== 'undefined' ? STORY : null);
    if (!state) throw new Error('STORY_INFRASTRUCTURE_WORK_STATE_REQUIRED');
    if (!state.infrastructureWorks
        || Number(state.infrastructureWorks.schemaVersion) !== STORY_INFRA_WORK_SCHEMA_VERSION) {
        state.infrastructureWorks = {
            schemaVersion: STORY_INFRA_WORK_SCHEMA_VERSION,
            adapterVersion: STORY_INFRA_WORK_ADAPTER_VERSION,
            revision: 0, commandSequence: 0, routeSequence: 0,
            reservationSequence: 0, receiptSequence: 0,
            commands: [], routeCommands: [], routes: [], receipts: []
        };
    }
    if (!Array.isArray(state.infrastructureWorks.routeCommands)) state.infrastructureWorks.routeCommands = [];
    if (!Array.isArray(state.infrastructureWorks.routes)) state.infrastructureWorks.routes = [];
    return state.infrastructureWorks;
}

function storyInfrastructureRouteContext(options) {
    const opts = options || {};
    return {
        world: opts.world || (typeof storyHexWorldEnsure === 'function' ? storyHexWorldEnsure() : null),
        geography: opts.geography || (typeof storyHexGeographyEnsure === 'function' ? storyHexGeographyEnsure() : null),
        settlements: opts.settlements || (typeof storyHexSettlementsEnsure === 'function' ? storyHexSettlementsEnsure() : null),
        natural: opts.natural || (typeof storyHexNaturalResourcesEnsure === 'function' ? storyHexNaturalResourcesEnsure() : null),
        graph: opts.graph || (typeof storyInfrastructureEnsure === 'function' ? storyInfrastructureEnsure() : null),
        findLandPath: opts.findLandPath || (typeof storyHexRoadFindPath === 'function' ? storyHexRoadFindPath : null)
    };
}

function storyInfrastructureRouteRegionNumber(regionId) {
    const match = /^region:(\d+)$/.exec(String(regionId || ''));
    return match ? Number(match[1]) : -1;
}

function storyInfrastructureRouteSegmentKind(mode, geography, a, b) {
    if (mode === 'RAIL' && typeof storyHexInfrastructureRailSegmentKind === 'function') {
        return storyHexInfrastructureRailSegmentKind(geography, a, b);
    }
    if (typeof storyHexInfrastructureSegmentKind === 'function') {
        return storyHexInfrastructureSegmentKind(geography, a, b);
    }
    const coverage = Math.min(Number(geography.landCoverageBps[a]) || 0,
        Number(geography.landCoverageBps[b]) || 0);
    const mountain = Math.max(Number(geography.mountainIntensityBps[a]) || 0,
        Number(geography.mountainIntensityBps[b]) || 0);
    const base = coverage < 9400 ? 'BRIDGE' : mountain >= 7000 ? 'TUNNEL' : 'ROAD';
    return mode === 'RAIL' ? (base === 'ROAD' ? 'RAIL_TRACK' : `RAIL_${base}`) : base;
}

function storyInfrastructureRouteCandidate(spec, options) {
    spec = spec || {};
    const context = storyInfrastructureRouteContext(options);
    const mode = String(spec.mode || '').toUpperCase();
    const fromRegionId = String(spec.fromRegionId || '');
    const toRegionId = String(spec.toRegionId || '');
    const from = storyInfrastructureRouteRegionNumber(fromRegionId);
    const to = storyInfrastructureRouteRegionNumber(toRegionId);
    const blocks = [];
    if (!STORY_INFRA_ROUTE_MODES.includes(mode)) blocks.push('ROUTE_MODE_UNSUPPORTED');
    if (!context.world || !context.geography || !context.settlements || !context.findLandPath) {
        blocks.push('HEX_CONTEXT_UNAVAILABLE');
    }
    if (from < 0 || to < 0 || from === to) blocks.push('ROUTE_ENDPOINT_INVALID');
    const start = context.settlements && Number(context.settlements.coreCellIndices[from]);
    const end = context.settlements && Number(context.settlements.coreCellIndices[to]);
    const path = blocks.includes('HEX_CONTEXT_UNAVAILABLE') || !Number.isInteger(start)
        || !Number.isInteger(end) ? []
        : context.findLandPath(context.world, context.geography, start, end);
    if (!path.length) blocks.push('NO_PHYSICAL_ROUTE');
    const endpointKey = [fromRegionId, toRegionId].sort().join('|');
    const duplicate = context.graph && context.graph.corridors.some(corridor =>
        corridor.mode === mode && corridor.endpointRegionIds.slice().sort().join('|') === endpointKey);
    if (duplicate) blocks.push('ROUTE_ALREADY_EXISTS');
    const kinds = [];
    for (let index = 1; index < path.length; index++) {
        kinds.push(storyInfrastructureRouteSegmentKind(mode, context.geography,
            path[index - 1], path[index]));
    }
    const crossedRegionIds = Array.from(new Set(path.map(index =>
        Number(context.geography.regionIds[index])).filter(Number.isInteger)
        .filter(id => id >= 0).map(id => `region:${id}`))).sort();
    const rightOfWay = spec.rightOfWay || {};
    const evidence = rightOfWay.evidenceByRegion || {};
    for (const regionId of crossedRegionIds) {
        if (!String(evidence[regionId] || '')) blocks.push(`RIGHT_OF_WAY_REQUIRED:${regionId}`);
    }
    const forestCode = typeof STORY_HEX_NATURAL_COVER_NAMES !== 'undefined'
        ? STORY_HEX_NATURAL_COVER_NAMES.indexOf('FOREST') : -1;
    const forestCellCount = context.natural && context.natural.coverCodes && forestCode >= 0
        ? path.filter(index => Number(context.natural.coverCodes[index]) === forestCode).length : 0;
    const bridgeCount = kinds.filter(kind => String(kind).includes('BRIDGE')).length;
    const tunnelCount = kinds.filter(kind => String(kind).includes('TUNNEL')).length;
    const environmental = spec.environmentalAssessment || {};
    if ((forestCellCount || bridgeCount || tunnelCount)
        && (!String(environmental.assessmentId || '') || !String(environmental.mitigationId || ''))) {
        blocks.push('ENVIRONMENTAL_ASSESSMENT_REQUIRED');
    }
    const permission = spec.permission || {};
    if (permission.approved !== true || !String(permission.institutionId || '')
        || !String(permission.decisionId || '') || !String(permission.authorityActorId || '')) {
        blocks.push('AUTHORITY_APPROVAL_REQUIRED');
    }
    return {
        ok: blocks.length === 0,
        mode, fromRegionId, toRegionId, startCellIndex: start, endCellIndex: end,
        pathCellIndices: path.slice(), segmentKinds: kinds,
        crossedRegionIds, forestCellCount, bridgeCount, tunnelCount,
        rightOfWay: { evidenceByRegion: Object.assign({}, evidence),
            compensationCash: Math.max(0, Number(rightOfWay.compensationCash) || 0) },
        environmentalAssessment: {
            assessmentId: String(environmental.assessmentId || ''),
            mitigationId: String(environmental.mitigationId || ''),
            restorationCash: Math.max(0, Number(environmental.restorationCash) || 0)
        },
        permission: {
            approved: permission.approved === true,
            institutionId: String(permission.institutionId || ''),
            decisionId: String(permission.decisionId || ''),
            authorityActorId: String(permission.authorityActorId || '')
        },
        blockReasons: Array.from(new Set(blocks))
    };
}

function storyInfrastructureRouteRequirements(candidate) {
    const policy = candidate && STORY_INFRA_ROUTE_POLICY[candidate.mode];
    if (!policy || !candidate.pathCellIndices.length) return null;
    const edges = Math.max(1, candidate.pathCellIndices.length - 1);
    const cash = Math.ceil(edges * policy.cashPerEdge
        + candidate.bridgeCount * policy.bridgeCash + candidate.tunnelCount * policy.tunnelCash
        + candidate.rightOfWay.compensationCash + candidate.environmentalAssessment.restorationCash);
    const materials = {
        raw_materials: Math.ceil(edges * policy.rawPerEdge),
        industrial_parts: Math.ceil(edges * policy.partsPerEdge)
    };
    if (policy.electronicsPerEdge) materials.electronics = Math.max(1,
        Math.ceil(edges * policy.electronicsPerEdge));
    return { cash, materials,
        workforce: Math.ceil(edges * policy.workforcePerEdge),
        durationDays: Math.ceil(edges * policy.daysPerEdge), edgeCount: edges };
}

function storyInfrastructureRouteCorridorDefinitions() {
    const ledger = typeof STORY !== 'undefined' && STORY.infrastructureWorks;
    if (!ledger || !Array.isArray(ledger.routes)) return [];
    const model = typeof storyRegionEnsure === 'function' ? storyRegionEnsure()
        : typeof STORY !== 'undefined' ? STORY.regionModel : null;
    const regions = model && Array.isArray(model.regions) ? model.regions : [];
    const byId = new Map(regions.map(region => [String(region.id), region]));
    return ledger.routes.map(route => {
        const from = byId.get(String(route.fromRegionId));
        const to = byId.get(String(route.toRegionId));
        if (!from || !to || typeof storyInfrastructurePhysicalDefinition !== 'function') return null;
        const corridor = storyInfrastructurePhysicalDefinition(route.mode, from, to);
        corridor.id = route.corridorId;
        corridor.builtByReceiptId = route.receiptId;
        return corridor;
    }).filter(Boolean);
}

function storyInfrastructureRouteReserveAndSubmit(spec, options) {
    spec = spec || {};
    const ledger = storyInfrastructureWorkEnsure(options && options.root);
    const candidate = storyInfrastructureRouteCandidate(spec, options);
    const requirements = storyInfrastructureRouteRequirements(candidate);
    const fatal = ['ROUTE_MODE_UNSUPPORTED', 'HEX_CONTEXT_UNAVAILABLE',
        'ROUTE_ENDPOINT_INVALID', 'NO_PHYSICAL_ROUTE', 'ROUTE_ALREADY_EXISTS'];
    if (!requirements || candidate.blockReasons.some(reason => fatal.includes(reason))) {
        return { ok: false, code: candidate.blockReasons[0] || 'ROUTE_SPEC_INVALID', candidate };
    }
    if (candidate.blockReasons.length) return {
        ok: false, code: 'ROUTE_REQUIREMENTS_INCOMPLETE', candidate, requirements
    };
    const endpointKey = [candidate.fromRegionId, candidate.toRegionId].sort().join('|');
    const collision = ledger.routeCommands.some(command => command.mode === candidate.mode
        && [command.fromRegionId, command.toRegionId].sort().join('|') === endpointKey
        && !['COMPLETED', 'CANCELLED'].includes(command.status));
    if (collision) return { ok: false, code: 'ROUTE_WORK_ALREADY_OPEN' };
    const ownerType = String(spec.ownerType || '').toUpperCase();
    const ownerId = String(spec.ownerId || '');
    const regionId = String(spec.fundingRegionId || candidate.fromRegionId);
    if (!['COMPANY', 'STATE'].includes(ownerType) || !ownerId || !regionId) {
        return { ok: false, code: 'RESOURCE_OWNER_INVALID' };
    }
    const economy = storyInfrastructureWorkEconomy(options);
    if (Number(economy.cashAvailable(ownerType, ownerId)) + 1e-6 < requirements.cash) {
        return { ok: false, code: 'ROUTE_CASH_UNAVAILABLE', required: requirements.cash };
    }
    const freeWorkers = Math.max(0, Number(economy.availableWorkers(regionId))
        - storyInfrastructureWorkReservedWorkforce(ledger, regionId));
    if (freeWorkers + 1e-6 < requirements.workforce) {
        return { ok: false, code: 'ROUTE_WORKFORCE_UNAVAILABLE',
            required: requirements.workforce, available: freeWorkers };
    }
    for (const [resourceId, amount] of Object.entries(requirements.materials)) {
        if (Number(economy.stock(regionId, resourceId)) + 1e-6 < amount) {
            return { ok: false, code: 'ROUTE_MATERIAL_UNAVAILABLE', resourceId, required: amount };
        }
    }
    ledger.reservationSequence++;
    const reservationId = `infrastructure-route-reservation:${ledger.reservationSequence}`;
    const details = { reservationId, mode: candidate.mode,
        fromRegionId: candidate.fromRegionId, toRegionId: candidate.toRegionId };
    const cash = economy.cashReserve(ownerType, ownerId, requirements.cash, details);
    if (!cash || !cash.ok) return cash || { ok: false, code: 'ROUTE_CASH_RESERVATION_FAILED' };
    const debited = [];
    for (const [resourceId, amount] of Object.entries(requirements.materials)) {
        const result = economy.stockDelta(regionId, resourceId, -amount,
            { type: 'INFRASTRUCTURE_ROUTE_RESERVE', ownerId, reservationId });
        if (!result || !result.ok) {
            for (const row of debited) economy.stockDelta(regionId, row.resourceId, row.amount,
                { type: 'INFRASTRUCTURE_ROUTE_ROLLBACK', ownerId, reservationId });
            economy.cashRollback(ownerType, ownerId, requirements.cash, details);
            return { ok: false, code: 'ROUTE_ATOMIC_RESERVATION_FAILED', resourceId };
        }
        debited.push({ resourceId, amount });
    }
    ledger.routeSequence++;
    const id = `infrastructure-route-work:${ledger.routeSequence}`;
    const command = Object.assign({
        id, correlationId: String(spec.correlationId || id), status: 'AUTHORIZED',
        submittedAt: typeof STORY !== 'undefined' ? Number(STORY.clock) || 0 : 0,
        startedAt: null, completedAt: null, remainingDays: requirements.durationDays,
        completionReceiptId: null, requirements,
        resourceReservation: { id: reservationId, ownerType, ownerId, regionId,
            cash: requirements.cash, workforce: requirements.workforce,
            materials: storyInfrastructureWorkClone(requirements.materials) }
    }, storyInfrastructureWorkClone(candidate));
    delete command.ok;
    ledger.routeCommands.push(command); ledger.revision++;
    return { ok: true, command: storyInfrastructureWorkClone(command) };
}

function storyInfrastructureRouteStart(commandId, options) {
    const ledger = storyInfrastructureWorkEnsure(options && options.root);
    const command = ledger.routeCommands.find(row => row.id === String(commandId));
    if (!command) return { ok: false, code: 'ROUTE_WORK_NOT_FOUND' };
    if (command.status !== 'AUTHORIZED' || command.blockReasons.length) {
        return { ok: false, code: 'ROUTE_WORK_REQUIREMENTS_INCOMPLETE' };
    }
    command.status = 'IN_PROGRESS';
    command.startedAt = typeof STORY !== 'undefined' ? Number(STORY.clock) || 0 : 0;
    ledger.revision++;
    return { ok: true, command: storyInfrastructureWorkClone(command) };
}

function storyInfrastructureWorkEconomy(options) {
    if (options && options.economy) return options.economy;
    return {
        cashAvailable: (ownerType, ownerId) => {
            if (ownerType === 'COMPANY') {
                const company = typeof storyCompanyById === 'function' ? storyCompanyById(ownerId) : null;
                return Number(company && company.accounts && company.accounts['ASSET:CASH']) || 0;
            }
            const state = typeof storyState === 'function'
                ? storyState(Number(String(ownerId).replace('country:', ''))) : null;
            return state && typeof storyBudgetWalletCash === 'function' ? storyBudgetWalletCash(state) : 0;
        },
        cashReserve: (ownerType, ownerId, cash, details) => {
            if (ownerType === 'COMPANY') {
                const company = typeof storyCompanyById === 'function' ? storyCompanyById(ownerId) : null;
                return company && typeof storyCompanyPost === 'function'
                    ? storyCompanyPost(company, 'infrastructure.work.reserve', [
                        { account: 'ASSET:PROJECT_ESCROW', amount: cash },
                        { account: 'ASSET:CASH', amount: -cash }
                    ], details) : { ok: false, code: 'COMPANY_POSTING_UNAVAILABLE' };
            }
            return typeof storyBudgetDebit === 'function'
                ? storyBudgetDebit(ownerId, cash, 'infrastructure.work.reserve', details)
                : { ok: false, code: 'STATE_BUDGET_UNAVAILABLE' };
        },
        cashRollback: (ownerType, ownerId, cash, details) => {
            if (ownerType === 'COMPANY') {
                const company = typeof storyCompanyById === 'function' ? storyCompanyById(ownerId) : null;
                return company && typeof storyCompanyPost === 'function'
                    ? storyCompanyPost(company, 'infrastructure.work.rollback', [
                        { account: 'ASSET:CASH', amount: cash },
                        { account: 'ASSET:PROJECT_ESCROW', amount: -cash }
                    ], details) : { ok: false };
            }
            return typeof storyBudgetCredit === 'function'
                ? storyBudgetCredit(ownerId, cash, 'infrastructure.work.rollback', details)
                : { ok: false };
        },
        cashSettle: (ownerType, ownerId, cash, details) => {
            if (ownerType !== 'COMPANY') return { ok: true };
            const company = typeof storyCompanyById === 'function' ? storyCompanyById(ownerId) : null;
            return company && typeof storyCompanyPost === 'function'
                ? storyCompanyPost(company, 'infrastructure.work.complete', [
                    { account: 'EXPENSE:CAPACITY_INVESTMENT', amount: cash },
                    { account: 'ASSET:PROJECT_ESCROW', amount: -cash }
                ], details) : { ok: false, code: 'COMPANY_POSTING_UNAVAILABLE' };
        },
        stock: (regionId, resourceId) => {
            const region = typeof STORY !== 'undefined' && STORY.regionalEconomy
                && STORY.regionalEconomy.regions && STORY.regionalEconomy.regions[regionId];
            return Number(region && region.stocks && region.stocks[resourceId]) || 0;
        },
        stockDelta: (regionId, resourceId, amount, details) =>
            typeof storyRegionalStockDelta === 'function'
                ? storyRegionalStockDelta(regionId, resourceId, amount, details)
                : { ok: false, code: 'REGIONAL_STOCK_DELTA_UNAVAILABLE' },
        availableWorkers: regionId => {
            const supply = typeof storyPopulationLaborSupply === 'function'
                ? storyPopulationLaborSupply(regionId, 1) : null;
            return Number(supply && supply.availableWorkersPeople) || 0;
        }
    };
}

function storyInfrastructureWorkReservedWorkforce(ledger, regionId) {
    return ledger.commands.concat(ledger.routeCommands || [])
        .filter(command => ['AUTHORIZED', 'IN_PROGRESS'].includes(command.status)
        && command.resourceReservation && command.resourceReservation.regionId === regionId)
        .reduce((sum, command) => sum + (Number(command.resourceReservation.workforce) || 0), 0);
}

function storyInfrastructureWorkReserveAndSubmit(spec, options) {
    spec = spec || {};
    const ledger = storyInfrastructureWorkEnsure(options && options.root);
    const registry = storyInfrastructureWorkRegistry(options);
    const segment = registry && registry.segmentById[String(spec.targetSegmentId || '')];
    const requirements = storyInfrastructureWorkRequirements(segment);
    if (!segment || !requirements) return { ok: false, code: 'SEGMENT_NOT_FOUND' };
    const ownerType = String(spec.ownerType || '').toUpperCase();
    const ownerId = String(spec.ownerId || '');
    const regionId = String(spec.regionId || '');
    if (!['COMPANY', 'STATE'].includes(ownerType) || !ownerId || !regionId) {
        return { ok: false, code: 'RESOURCE_OWNER_INVALID' };
    }
    const economy = storyInfrastructureWorkEconomy(options);
    if (Number(economy.cashAvailable(ownerType, ownerId)) + 1e-6 < requirements.cash) {
        return { ok: false, code: 'WORK_CASH_UNAVAILABLE', required: requirements.cash };
    }
    const freeWorkers = Math.max(0, Number(economy.availableWorkers(regionId))
        - storyInfrastructureWorkReservedWorkforce(ledger, regionId));
    if (freeWorkers + 1e-6 < requirements.workforce) {
        return { ok: false, code: 'WORK_WORKFORCE_UNAVAILABLE', required: requirements.workforce, available: freeWorkers };
    }
    for (const [resourceId, amount] of Object.entries(requirements.materials)) {
        if (Number(economy.stock(regionId, resourceId)) + 1e-6 < amount) {
            return { ok: false, code: 'WORK_MATERIAL_UNAVAILABLE', resourceId, required: amount };
        }
    }
    ledger.reservationSequence = Math.max(0, Number(ledger.reservationSequence) || 0) + 1;
    const reservationId = `infrastructure-work-reservation:${ledger.reservationSequence}`;
    const details = { reservationId, targetSegmentId: segment.id };
    const cash = economy.cashReserve(ownerType, ownerId, requirements.cash, details);
    if (!cash || !cash.ok) return cash || { ok: false, code: 'WORK_CASH_RESERVATION_FAILED' };
    const debited = [];
    for (const [resourceId, amount] of Object.entries(requirements.materials)) {
        const result = economy.stockDelta(regionId, resourceId, -amount,
            { type: 'INFRASTRUCTURE_WORK_RESERVE', ownerId, reservationId });
        if (!result || !result.ok) {
            for (const row of debited) economy.stockDelta(regionId, row.resourceId, row.amount,
                { type: 'INFRASTRUCTURE_WORK_ROLLBACK', ownerId, reservationId });
            economy.cashRollback(ownerType, ownerId, requirements.cash, details);
            return { ok: false, code: 'WORK_ATOMIC_RESERVATION_FAILED', resourceId };
        }
        debited.push({ resourceId, amount });
    }
    const candidate = Object.assign({}, spec, { resourceReservation: {
        id: reservationId, ownerType, ownerId, regionId,
        cash: requirements.cash, workforce: requirements.workforce,
        materials: storyInfrastructureWorkClone(requirements.materials)
    } });
    const submitted = storyInfrastructureWorkSubmit(candidate, options);
    if (!submitted.ok) {
        for (const row of debited) economy.stockDelta(regionId, row.resourceId, row.amount,
            { type: 'INFRASTRUCTURE_WORK_ROLLBACK', ownerId, reservationId });
        economy.cashRollback(ownerType, ownerId, requirements.cash, details);
    }
    return submitted;
}

function storyInfrastructureWorkRegistry(options) {
    return options && options.registry || (typeof storyHexInfrastructureSegmentsEnsure === 'function'
        ? storyHexInfrastructureSegmentsEnsure() : null);
}

function storyInfrastructureWorkRequirements(segment) {
    const policy = segment && STORY_INFRA_WORK_POLICY[String(segment.mode)] || null;
    if (!policy) return null;
    const damage = Math.max(0, Math.min(10000, Number(segment.damageBps) || 0)) / 10000;
    const neglect = Math.max(0, 10000 - (Number(segment.maintenanceBps) || 0)) / 10000;
    const scale = Math.max(.25, Math.min(1, damage + neglect * .5));
    const materials = {};
    for (const [resourceId, amount] of Object.entries(policy.materials)) {
        materials[resourceId] = Math.max(1, Math.ceil(amount * scale));
    }
    return {
        cash: Math.max(1, Math.ceil(policy.cash * scale)),
        materials,
        workforce: Math.max(1, Math.ceil(policy.workforce * scale)),
        durationDays: Math.max(1, Math.ceil(policy.durationDays * scale)),
        targetDamageBps: 0,
        targetMaintenanceBps: 10000
    };
}

function storyInfrastructureWorkDaysToSeconds(days) {
    const secondsPerYear = typeof STORY_CALENDAR !== 'undefined'
        ? Number(STORY_CALENDAR.secondsPerYear) || 120 : 120;
    return Math.max(0, Number(days) || 0) * secondsPerYear / 365;
}

function storyInfrastructureWorkPreflight(spec, options) {
    spec = spec || {};
    const registry = storyInfrastructureWorkRegistry(options);
    const segment = registry && registry.segmentById[String(spec.targetSegmentId || '')];
    const blocks = [];
    if (!registry) blocks.push('SEGMENT_REGISTRY_UNAVAILABLE');
    if (!segment) blocks.push('SEGMENT_NOT_FOUND');
    if (segment && !STORY_INFRA_WORK_POLICY[String(segment.mode)]) blocks.push('SEGMENT_MODE_UNSUPPORTED');
    if (segment && Number(segment.damageBps) <= 0 && Number(segment.maintenanceBps) >= 10000) {
        blocks.push('SEGMENT_REPAIR_NOT_REQUIRED');
    }
    const permission = spec.permission || {};
    if (permission.approved !== true || !String(permission.institutionId || '')
        || !String(permission.decisionId || '') || !String(permission.authorityActorId || '')) {
        blocks.push('AUTHORITY_APPROVAL_REQUIRED');
    }
    const requirements = storyInfrastructureWorkRequirements(segment);
    const reservation = spec.resourceReservation || {};
    if (!String(reservation.id || '')) blocks.push('RESOURCE_RESERVATION_REQUIRED');
    if (requirements && Number(reservation.cash) < requirements.cash) blocks.push('CASH_RESERVATION_INSUFFICIENT');
    if (requirements && Number(reservation.workforce) < requirements.workforce) blocks.push('WORKFORCE_RESERVATION_INSUFFICIENT');
    for (const [resourceId, amount] of Object.entries(requirements && requirements.materials || {})) {
        if (Number(reservation.materials && reservation.materials[resourceId]) < amount) {
            blocks.push(`MATERIAL_RESERVATION_INSUFFICIENT:${resourceId}`);
        }
    }
    return {
        ok: blocks.length === 0,
        targetSegmentId: String(spec.targetSegmentId || ''),
        mode: segment ? String(segment.mode) : null,
        kind: segment ? String(segment.kind) : null,
        corridorIds: segment ? segment.corridorIds.slice() : [],
        permission: {
            approved: permission.approved === true,
            institutionId: String(permission.institutionId || ''),
            decisionId: String(permission.decisionId || ''),
            authorityActorId: String(permission.authorityActorId || '')
        },
        resourceReservation: {
            id: String(reservation.id || ''),
            ownerType: String(reservation.ownerType || ''),
            ownerId: String(reservation.ownerId || ''),
            regionId: String(reservation.regionId || ''),
            cash: Math.max(0, Number(reservation.cash) || 0),
            workforce: Math.max(0, Number(reservation.workforce) || 0),
            materials: Object.assign({}, reservation.materials || {})
        },
        requirements,
        blockReasons: Array.from(new Set(blocks))
    };
}

function storyInfrastructureWorkSubmit(spec, options) {
    const ledger = storyInfrastructureWorkEnsure(options && options.root);
    const preview = storyInfrastructureWorkPreflight(spec, options);
    if (!preview.targetSegmentId || preview.blockReasons.includes('SEGMENT_NOT_FOUND')) {
        return { ok: false, code: preview.blockReasons[0] || 'WORK_SPEC_INVALID', preview };
    }
    const collision = ledger.commands.some(command => command.targetSegmentId === preview.targetSegmentId
        && !['COMPLETED', 'CANCELLED'].includes(command.status));
    if (collision) return { ok: false, code: 'SEGMENT_WORK_ALREADY_OPEN', preview };
    ledger.commandSequence++;
    const command = Object.assign({
        id: `infrastructure-work:${ledger.commandSequence}`,
        correlationId: String(spec && spec.correlationId || `infrastructure-work:${ledger.commandSequence}`),
        status: preview.ok ? 'AUTHORIZED' : 'AWAITING_REQUIREMENTS',
        submittedAt: typeof STORY !== 'undefined' ? Number(STORY.clock) || 0 : 0,
        startedAt: null, completedAt: null,
        remainingDays: preview.requirements ? preview.requirements.durationDays : 0,
        completionReceiptId: null
    }, storyInfrastructureWorkClone(preview));
    delete command.ok;
    ledger.commands.push(command); ledger.revision++;
    return { ok: true, command: storyInfrastructureWorkClone(command) };
}

function storyInfrastructureWorkStart(commandId, options) {
    const ledger = storyInfrastructureWorkEnsure(options && options.root);
    const command = ledger.commands.find(row => row.id === String(commandId));
    if (!command) return { ok: false, code: 'WORK_NOT_FOUND' };
    if (command.status !== 'AUTHORIZED' || command.blockReasons.length) {
        return { ok: false, code: 'WORK_REQUIREMENTS_INCOMPLETE' };
    }
    const registry = storyInfrastructureWorkRegistry(options);
    const segment = registry && registry.segmentById[command.targetSegmentId];
    if (!segment) return { ok: false, code: 'SEGMENT_NOT_FOUND' };
    command.status = 'IN_PROGRESS';
    command.startedAt = typeof STORY !== 'undefined' ? Number(STORY.clock) || 0 : 0;
    segment.lifecycleState = 'UNDER_REPAIR';
    segment.repairRemainingSeconds = storyInfrastructureWorkDaysToSeconds(command.remainingDays);
    registry.revision++; ledger.revision++;
    if (typeof STORY !== 'undefined') STORY._networkLayerKey = null;
    return { ok: true, command: storyInfrastructureWorkClone(command) };
}

function storyInfrastructureWorkTick(worldDays, options) {
    const ledger = storyInfrastructureWorkEnsure(options && options.root);
    const registry = storyInfrastructureWorkRegistry(options);
    const days = Math.max(0, Number(worldDays) || 0);
    const completed = [];
    const completedRoutes = [];
    for (const command of ledger.commands) {
        if (command.status !== 'IN_PROGRESS') continue;
        const segment = registry && registry.segmentById[command.targetSegmentId];
        if (!segment) { command.completionBlockedReason = 'SEGMENT_NOT_FOUND'; continue; }
        command.remainingDays = Math.max(0, Math.round((command.remainingDays - days) * 1000) / 1000);
        segment.repairRemainingSeconds = storyInfrastructureWorkDaysToSeconds(command.remainingDays);
        if (command.remainingDays > 0) continue;
        const reservation = command.resourceReservation || {};
        const settled = storyInfrastructureWorkEconomy(options).cashSettle(
            reservation.ownerType, reservation.ownerId, Number(reservation.cash) || 0,
            { commandId: command.id, completion: true }
        );
        if (!settled || !settled.ok) {
            command.completionBlockedReason = settled && settled.code || 'WORK_FINANCIAL_SETTLEMENT_FAILED';
            continue;
        }
        segment.damageBps = command.requirements.targetDamageBps;
        segment.maintenanceBps = command.requirements.targetMaintenanceBps;
        segment.enabled = true; segment.lifecycleState = 'OPERATING';
        segment.repairRemainingSeconds = 0;
        ledger.receiptSequence++;
        const receipt = {
            id: `infrastructure-work-receipt:${ledger.receiptSequence}`,
            commandId: command.id, correlationId: command.correlationId,
            targetSegmentId: command.targetSegmentId, mode: command.mode,
            consumed: storyInfrastructureWorkClone(command.resourceReservation),
            permissionDecisionId: command.permission.decisionId,
            completedAt: typeof STORY !== 'undefined' ? Number(STORY.clock) || 0 : 0
        };
        ledger.receipts.push(receipt);
        command.status = 'COMPLETED'; command.completedAt = receipt.completedAt;
        command.completionReceiptId = receipt.id; command.completionBlockedReason = null;
        completed.push(storyInfrastructureWorkClone(receipt));
        registry.revision++;
        if (typeof STORY !== 'undefined' && STORY.infrastructureGraph) STORY.infrastructureGraph.damageRevision++;
    }
    for (const command of ledger.routeCommands || []) {
        if (command.status !== 'IN_PROGRESS') continue;
        command.remainingDays = Math.max(0,
            Math.round((command.remainingDays - days) * 1000) / 1000);
        if (command.remainingDays > 0) continue;
        const reservation = command.resourceReservation || {};
        const settled = storyInfrastructureWorkEconomy(options).cashSettle(
            reservation.ownerType, reservation.ownerId, Number(reservation.cash) || 0,
            { commandId: command.id, completion: true, route: true }
        );
        if (!settled || !settled.ok) {
            command.completionBlockedReason = settled && settled.code
                || 'ROUTE_FINANCIAL_SETTLEMENT_FAILED';
            continue;
        }
        ledger.receiptSequence++;
        const routeNumber = Number(String(command.id).split(':').pop()) || ledger.routeSequence;
        const corridorId = `corridor:built:${command.mode.toLowerCase()}:${routeNumber}`;
        const receipt = {
            id: `infrastructure-route-receipt:${ledger.receiptSequence}`,
            commandId: command.id, correlationId: command.correlationId,
            corridorId, mode: command.mode,
            fromRegionId: command.fromRegionId, toRegionId: command.toRegionId,
            pathCellIndices: command.pathCellIndices.slice(),
            segmentKinds: command.segmentKinds.slice(),
            edgeCount: command.requirements.edgeCount,
            crossedRegionIds: command.crossedRegionIds.slice(),
            rightOfWay: storyInfrastructureWorkClone(command.rightOfWay),
            environmentalAssessment: storyInfrastructureWorkClone(command.environmentalAssessment),
            consumed: storyInfrastructureWorkClone(command.resourceReservation),
            permissionDecisionId: command.permission.decisionId,
            completedAt: typeof STORY !== 'undefined' ? Number(STORY.clock) || 0 : 0
        };
        const route = {
            id: `infrastructure-route:${routeNumber}`,
            corridorId, receiptId: receipt.id, mode: command.mode,
            fromRegionId: command.fromRegionId, toRegionId: command.toRegionId,
            pathCellIndices: command.pathCellIndices.slice(),
            commissionedAt: receipt.completedAt
        };
        ledger.routes.push(route); ledger.receipts.push(receipt);
        command.status = 'COMPLETED'; command.completedAt = receipt.completedAt;
        command.completionReceiptId = receipt.id; command.completionBlockedReason = null;
        completedRoutes.push(storyInfrastructureWorkClone(receipt));
    }
    if (completed.length || completedRoutes.length) {
        ledger.revision++;
        if (typeof STORY !== 'undefined') STORY._networkLayerKey = null;
    }
    if (completedRoutes.length && typeof storyInfrastructureReset === 'function') {
        storyInfrastructureReset({ generatedAt: typeof STORY !== 'undefined' ? Number(STORY.clock) || 0 : 0 });
        if (typeof storyHexInfrastructureReset === 'function') storyHexInfrastructureReset();
    }
    return { ok: true, processedDays: days, completed, completedRoutes };
}

function storyInfrastructureWorkTickSeconds(dtSec, options) {
    const secondsPerYear = typeof STORY_CALENDAR !== 'undefined'
        ? Number(STORY_CALENDAR.secondsPerYear) || 120 : 120;
    return storyInfrastructureWorkTick(Math.max(0, Number(dtSec) || 0) * 365 / secondsPerYear, options);
}

function storyInfrastructureWorkForSave(root) {
    return storyInfrastructureWorkClone(storyInfrastructureWorkEnsure(root));
}

function storyInfrastructureWorkRestore(saved, root) {
    const state = root || (typeof STORY !== 'undefined' ? STORY : null);
    if (!state) return { ok: false, code: 'STORY_INFRASTRUCTURE_WORK_STATE_REQUIRED' };
    if (!saved) { delete state.infrastructureWorks; storyInfrastructureWorkEnsure(state); return { ok: true, backfilled: true }; }
    const candidate = storyInfrastructureWorkClone(saved);
    if (!Array.isArray(candidate.routeCommands)) candidate.routeCommands = [];
    if (!Array.isArray(candidate.routes)) candidate.routes = [];
    if (Number(candidate.schemaVersion) !== STORY_INFRA_WORK_SCHEMA_VERSION
        || candidate.adapterVersion !== STORY_INFRA_WORK_ADAPTER_VERSION
        || !Array.isArray(candidate.commands) || !Array.isArray(candidate.receipts)
        || candidate.commands.concat(candidate.routeCommands)
            .some(command => !command || !STORY_INFRA_WORK_STATUSES.includes(command.status))) {
        return { ok: false, code: 'INFRASTRUCTURE_WORK_SAVE_INVALID' };
    }
    state.infrastructureWorks = candidate;
    storyInfrastructureWorkEnsure(state);
    return { ok: true, backfilled: false };
}

if (typeof module !== 'undefined' && module.exports) module.exports = {
    STORY_INFRA_WORK_POLICY,
    storyInfrastructureWorkEnsure,
    storyInfrastructureWorkPreflight,
    storyInfrastructureWorkSubmit,
    storyInfrastructureWorkReserveAndSubmit,
    storyInfrastructureRouteCandidate,
    storyInfrastructureRouteRequirements,
    storyInfrastructureRouteReserveAndSubmit,
    storyInfrastructureRouteStart,
    storyInfrastructureRouteCorridorDefinitions,
    storyInfrastructureWorkStart,
    storyInfrastructureWorkTick,
    storyInfrastructureWorkForSave,
    storyInfrastructureWorkRestore
};
