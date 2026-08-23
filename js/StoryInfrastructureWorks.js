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
const STORY_INFRA_ROUTE_PROPOSAL_STATUSES = Object.freeze([
    'PENDING_EXECUTIVE', 'RESOURCE_BLOCKED', 'COMMAND_CREATED', 'REJECTED', 'CANCELLED'
]);
const STORY_INFRA_RIGHT_OF_WAY_STATUSES = Object.freeze([
    'PENDING_FOREIGN_EXECUTIVE', 'COUNTERED', 'GRANTED', 'REJECTED', 'REVOKED'
]);
const STORY_INFRA_WORK_POLICY = Object.freeze({
    LAND: Object.freeze({ cash: 40, materials: Object.freeze({ raw_materials: 8, industrial_parts: 6 }), workforce: 25, durationDays: 20 }),
    SEA: Object.freeze({ cash: 70, materials: Object.freeze({ raw_materials: 12, industrial_parts: 10, electronics: 1 }), workforce: 40, durationDays: 35 }),
    RAIL: Object.freeze({ cash: 55, materials: Object.freeze({ raw_materials: 10, industrial_parts: 9, electronics: 1 }), workforce: 32, durationDays: 28 })
});
const STORY_INFRA_ROUTE_MODES = Object.freeze(['LAND', 'SEA', 'RAIL']);
const STORY_INFRA_ROUTE_ECONOMIC_AI_POLICY = Object.freeze({
    decisionIntervalDays: 90,
    executiveReviewDelaySeconds: 8,
    maximumApplicationsPerCycle: 2,
    maximumTargetCandidatesPerCompany: 8,
    minimumApplicationScore: 600,
    decisionHistoryLimit: 240
});
const STORY_INFRA_ROUTE_POLICY = Object.freeze({
    LAND: Object.freeze({ cashPerEdge: 16, rawPerEdge: 3, partsPerEdge: 2,
        workforcePerEdge: 7, daysPerEdge: 4, bridgeCash: 18, tunnelCash: 34 }),
    RAIL: Object.freeze({ cashPerEdge: 25, rawPerEdge: 4, partsPerEdge: 4,
        electronicsPerEdge: .25, workforcePerEdge: 10, daysPerEdge: 6,
        bridgeCash: 28, tunnelCash: 50 }),
    SEA: Object.freeze({ cashPerEdge: 12, rawPerEdge: 2, partsPerEdge: 2,
        electronicsPerEdge: .15, workforcePerEdge: 5, daysPerEdge: 3,
        portCash: 90, dredgingCash: 45 })
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
            reservationSequence: 0, receiptSequence: 0, proposalSequence: 0,
            rightOfWaySequence: 0, aiRouteElapsedDays: 0, aiRouteDecisionSequence: 0,
            commands: [], routeCommands: [], routeProposals: [], aiRouteDecisions: [],
            rightOfWayRequests: [], routes: [], receipts: []
        };
    }
    if (!Array.isArray(state.infrastructureWorks.routeCommands)) state.infrastructureWorks.routeCommands = [];
    if (!Array.isArray(state.infrastructureWorks.routeProposals)) state.infrastructureWorks.routeProposals = [];
    if (!Array.isArray(state.infrastructureWorks.rightOfWayRequests)) state.infrastructureWorks.rightOfWayRequests = [];
    state.infrastructureWorks.proposalSequence = Math.max(0,
        Number(state.infrastructureWorks.proposalSequence) || 0);
    state.infrastructureWorks.rightOfWaySequence = Math.max(0,
        Number(state.infrastructureWorks.rightOfWaySequence) || 0);
    state.infrastructureWorks.aiRouteElapsedDays = Math.max(0,
        Number(state.infrastructureWorks.aiRouteElapsedDays) || 0);
    state.infrastructureWorks.aiRouteDecisionSequence = Math.max(0,
        Number(state.infrastructureWorks.aiRouteDecisionSequence) || 0);
    if (!Array.isArray(state.infrastructureWorks.aiRouteDecisions)) {
        state.infrastructureWorks.aiRouteDecisions = [];
    }
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
        findLandPath: opts.findLandPath || (typeof storyHexRoadFindPath === 'function' ? storyHexRoadFindPath : null),
        findSeaPath: opts.findSeaPath || (typeof storyHexInfrastructureFindSeaPath === 'function'
            ? storyHexInfrastructureFindSeaPath : null)
    };
}

function storyInfrastructureRouteRegionNumber(regionId) {
    const match = /^region:(\d+)$/.exec(String(regionId || ''));
    return match ? Number(match[1]) : -1;
}

function storyInfrastructureCountryNumber(countryId) {
    const match = /^country:(\d+)$/.exec(String(countryId || ''));
    return match ? Number(match[1]) : -1;
}

function storyInfrastructureWorkClock(options) {
    return Number(options && options.clock != null ? options.clock
        : typeof STORY !== 'undefined' && STORY.clock) || 0;
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

function storyInfrastructureRoutePortCandidate(context, cityId) {
    if (!context || !context.world || !context.geography || !context.settlements) return null;
    const settlements = context.settlements;
    const existing = Number(settlements.portTerminalIds[cityId]) >= 0
        && Number(settlements.portLandCellIndices[cityId]) >= 0
        && Number(settlements.portWaterCellIndices[cityId]) >= 0;
    if (existing) return {
        cityId, existing: true,
        landIndex: Number(settlements.portLandCellIndices[cityId]),
        waterIndex: Number(settlements.portWaterCellIndices[cityId]),
        hostRegionId: Number(settlements.portHostRegionIds[cityId]),
        fallback: !!Number(settlements.portFallbackFlags[cityId]), distance: 0
    };
    const cities = typeof GEO_CITIES !== 'undefined' ? GEO_CITIES : [];
    const city = cities[cityId];
    if (!city || typeof storyHexSettlementNearestPort !== 'function') return null;
    const x = Number(city.x) / Number(GEO.W) * context.world.width;
    const y = Number(city.y) / Number(GEO.H) * context.world.height;
    const local = storyHexSettlementNearestPort(context.world, context.geography, cityId, x, y);
    const fallback = local ? null
        : storyHexSettlementNearestPort(context.world, context.geography, null, x, y);
    const selected = local || fallback;
    if (!selected) return null;
    const distance = Math.sqrt(selected.distanceSq);
    const maxFallback = typeof STORY_HEX_SETTLEMENT_PORT_FALLBACK_MAX_DISTANCE !== 'undefined'
        ? STORY_HEX_SETTLEMENT_PORT_FALLBACK_MAX_DISTANCE : 128.8;
    if (!local && distance > maxFallback) return null;
    return { cityId, existing: false, landIndex: selected.landIndex,
        waterIndex: selected.waterIndex,
        hostRegionId: Number(context.geography.regionIds[selected.landIndex]),
        fallback: !local, distance };
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
    const routeFinderAvailable = mode === 'SEA' ? context.findSeaPath : context.findLandPath;
    if (!context.world || !context.geography || !context.settlements || !routeFinderAvailable) {
        blocks.push('HEX_CONTEXT_UNAVAILABLE');
    }
    if (from < 0 || to < 0 || from === to) blocks.push('ROUTE_ENDPOINT_INVALID');
    const ports = mode === 'SEA' && !blocks.includes('HEX_CONTEXT_UNAVAILABLE')
        ? [storyInfrastructureRoutePortCandidate(context, from),
            storyInfrastructureRoutePortCandidate(context, to)] : [];
    if (mode === 'SEA' && ports.some(port => !port)) blocks.push('PORT_SITE_UNAVAILABLE');
    const start = mode === 'SEA' ? ports[0] && ports[0].waterIndex
        : context.settlements && Number(context.settlements.coreCellIndices[from]);
    const end = mode === 'SEA' ? ports[1] && ports[1].waterIndex
        : context.settlements && Number(context.settlements.coreCellIndices[to]);
    const routePath = blocks.includes('HEX_CONTEXT_UNAVAILABLE') || !Number.isInteger(start)
        || !Number.isInteger(end) ? []
        : mode === 'SEA'
            ? routeFinderAvailable(context.world, context.geography, start, end)
            : routeFinderAvailable(context.world, context.geography, start, end, context.natural);
    const path = mode === 'SEA' && routePath.length && ports.every(Boolean)
        ? [ports[0].landIndex, ...routePath, ports[1].landIndex] : routePath;
    if (!path.length) blocks.push('NO_PHYSICAL_ROUTE');
    const endpointKey = [fromRegionId, toRegionId].sort().join('|');
    const duplicate = context.graph && context.graph.corridors.some(corridor =>
        corridor.mode === mode && corridor.endpointRegionIds.slice().sort().join('|') === endpointKey);
    if (duplicate) blocks.push('ROUTE_ALREADY_EXISTS');
    const kinds = [];
    if (mode === 'SEA' && routePath.length) {
        kinds.push('PORT_ACCESS');
        for (let index = 1; index < routePath.length; index++) {
            kinds.push(typeof storyHexInfrastructureSeaSegmentKind === 'function'
                ? storyHexInfrastructureSeaSegmentKind(context.world, context.geography,
                    routePath[index - 1], routePath[index]) : 'SEA_LANE');
        }
        kinds.push('PORT_ACCESS');
    } else {
        for (let index = 1; index < path.length; index++) {
            kinds.push(storyInfrastructureRouteSegmentKind(mode, context.geography,
                path[index - 1], path[index]));
        }
    }
    const crossedRegionIds = mode === 'SEA'
        ? Array.from(new Set(ports.filter(Boolean).map(port => port.hostRegionId)
            .filter(id => id >= 0).map(id => `region:${id}`))).sort()
        : Array.from(new Set(path.map(index => Number(context.geography.regionIds[index]))
            .filter(Number.isInteger).filter(id => id >= 0)
            .map(id => `region:${id}`))).sort();
    const rightOfWay = spec.rightOfWay || {};
    const evidence = rightOfWay.evidenceByRegion || {};
    const grantsByRegion = Object.fromEntries(Object.entries(rightOfWay.grantsByRegion || {})
        .map(([regionId, grant]) => [String(regionId), {
            requestId: String(grant && grant.requestId || ''),
            targetCountryId: String(grant && grant.targetCountryId || ''),
            evidenceId: String(grant && grant.evidenceId || ''),
            compensationCash: Math.max(0, Math.round(Number(grant && grant.compensationCash) || 0))
        }]));
    for (const regionId of crossedRegionIds) {
        if (!String(evidence[regionId] || '')) blocks.push(`RIGHT_OF_WAY_REQUIRED:${regionId}`);
    }
    const portAuthority = spec.portAuthority || {};
    const portEvidence = portAuthority.evidenceByRegion || {};
    if (mode === 'SEA') {
        for (const regionId of crossedRegionIds) {
            if (!String(portEvidence[regionId] || '')) blocks.push(`PORT_AUTHORITY_REQUIRED:${regionId}`);
        }
    }
    const forestCode = typeof STORY_HEX_NATURAL_COVER_NAMES !== 'undefined'
        ? STORY_HEX_NATURAL_COVER_NAMES.indexOf('FOREST') : -1;
    const forestCellCount = context.natural && context.natural.coverCodes && forestCode >= 0
        ? path.filter(index => Number(context.natural.coverCodes[index]) === forestCode).length : 0;
    const bridgeCount = kinds.filter(kind => String(kind).includes('BRIDGE')).length;
    const tunnelCount = kinds.filter(kind => String(kind).includes('TUNNEL')).length;
    const environmental = spec.environmentalAssessment || {};
    if ((mode === 'SEA' || forestCellCount || bridgeCount || tunnelCount)
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
        portSites: ports.map(port => port && Object.assign({}, port)),
        portAuthority: { evidenceByRegion: Object.assign({}, portEvidence),
            dredgingPermitId: String(portAuthority.dredgingPermitId || '') },
        rightOfWay: { evidenceByRegion: Object.assign({}, evidence), grantsByRegion,
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
    const newPortCount = candidate.mode === 'SEA'
        ? candidate.portSites.filter(port => port && !port.existing).length : 0;
    const fallbackPortCount = candidate.mode === 'SEA'
        ? candidate.portSites.filter(port => port && port.fallback).length : 0;
    const cash = Math.ceil(edges * policy.cashPerEdge
        + candidate.bridgeCount * (policy.bridgeCash || 0)
        + candidate.tunnelCount * (policy.tunnelCash || 0)
        + newPortCount * (policy.portCash || 0)
        + fallbackPortCount * (policy.dredgingCash || 0)
        + candidate.rightOfWay.compensationCash + candidate.environmentalAssessment.restorationCash);
    const materials = {
        raw_materials: Math.ceil(edges * policy.rawPerEdge),
        industrial_parts: Math.ceil(edges * policy.partsPerEdge)
    };
    if (policy.electronicsPerEdge) materials.electronics = Math.max(1,
        Math.ceil(edges * policy.electronicsPerEdge));
    return { cash, materials,
        workforce: Math.ceil(edges * policy.workforcePerEdge),
        durationDays: Math.ceil(edges * policy.daysPerEdge), edgeCount: edges,
        newPortCount, fallbackPortCount };
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
    const prepaid = options && options.preReservedCash;
    const prepaidProposal = prepaid && (ledger.routeProposals || []).find(proposal =>
        proposal.id === String(prepaid.proposalId || '')
        && ['PENDING_EXECUTIVE', 'RESOURCE_BLOCKED'].includes(proposal.status)
        && proposal.companyId === ownerId
        && proposal.escrowReservation
        && proposal.escrowReservation.id === String(prepaid.reservationId || '')
        && proposal.escrowReservation.status === 'HELD'
        && Number(proposal.escrowReservation.cash) + 1e-6 >= requirements.cash);
    const usesPrepaidCash = !!(prepaid && ownerType === 'COMPANY'
        && prepaidProposal
        && String(prepaid.ownerId || '') === ownerId
        && Number(prepaid.cash) + 1e-6 >= requirements.cash
        && String(prepaid.reservationId || ''));
    if (prepaid && !usesPrepaidCash) return { ok: false, code: 'ROUTE_PREPAID_ESCROW_INVALID' };
    if (!usesPrepaidCash
        && Number(economy.cashAvailable(ownerType, ownerId)) + 1e-6 < requirements.cash) {
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
    const cash = usesPrepaidCash ? { ok: true, prepaid: true }
        : economy.cashReserve(ownerType, ownerId, requirements.cash, details);
    if (!cash || !cash.ok) return cash || { ok: false, code: 'ROUTE_CASH_RESERVATION_FAILED' };
    const debited = [];
    for (const [resourceId, amount] of Object.entries(requirements.materials)) {
        const result = economy.stockDelta(regionId, resourceId, -amount,
            { type: 'INFRASTRUCTURE_ROUTE_RESERVE', ownerId, reservationId });
        if (!result || !result.ok) {
            for (const row of debited) economy.stockDelta(regionId, row.resourceId, row.amount,
                { type: 'INFRASTRUCTURE_ROUTE_ROLLBACK', ownerId, reservationId });
            if (!usesPrepaidCash) economy.cashRollback(ownerType, ownerId, requirements.cash, details);
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
        resourceReservation: { id: usesPrepaidCash ? String(prepaid.reservationId) : reservationId,
            ownerType, ownerId, regionId,
            cash: requirements.cash, workforce: requirements.workforce,
            materials: storyInfrastructureWorkClone(requirements.materials),
            proposalId: usesPrepaidCash ? String(prepaid.proposalId || '') : null }
    }, storyInfrastructureWorkClone(candidate));
    delete command.ok;
    command.financialSettlement = {
        cashSettled: false,
        compensationRows: Object.entries(command.rightOfWay && command.rightOfWay.grantsByRegion || {})
            .map(([regionId, grant]) => ({
                regionId: String(regionId), requestId: String(grant.requestId || ''),
                targetCountryId: String(grant.targetCountryId || ''),
                evidenceId: String(grant.evidenceId || ''),
                amount: Math.max(0, Math.round(Number(grant.compensationCash) || 0)),
                status: 'PENDING', paidAt: null, transactionId: null
            })).filter(row => row.targetCountryId && row.amount > 0)
    };
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

function storyInfrastructureRoutePlayerActor() {
    if (typeof STORY === 'undefined' || !STORY.commander) return null;
    const actorId = `character:${Number(STORY.playerStateId)}:${Number(STORY.commander.id)}`;
    const identity = typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(actorId) : null;
    return {
        actorId,
        countryId: `country:${Number(STORY.playerStateId)}`,
        role: String(STORY.commander.creationRole || STORY.playerRole
            || identity && identity.role || 'COMMANDER').toUpperCase(),
        organizationId: String(STORY.commander.organizationId
            || identity && identity.organizationId || ''),
        identity
    };
}

function storyInfrastructureRouteCompanyForActor(actor, options) {
    if (!actor || !['COMPANY_OWNER', 'COMPANY_EXECUTIVE'].includes(actor.role)
        || !actor.organizationId) return null;
    if (options && typeof options.company === 'function') return options.company(actor.organizationId);
    return typeof storyCompanyById === 'function' ? storyCompanyById(actor.organizationId) : null;
}

function storyInfrastructureRightOfWayRouteKey(spec, regionId) {
    const endpoints = [String(spec && spec.fromRegionId || ''), String(spec && spec.toRegionId || '')]
        .sort().join('|');
    return `${String(spec && spec.mode || '').toUpperCase()}|${endpoints}|${String(regionId || '')}`;
}

function storyInfrastructureRightOfWayCountry(regionId, options) {
    const nodes = options && options.nodes
        || (typeof STORY !== 'undefined' ? STORY.nodes || [] : []);
    const id = storyInfrastructureRouteRegionNumber(regionId);
    const node = nodes[id];
    return node && Number.isInteger(Number(node.owner)) ? `country:${Number(node.owner)}` : null;
}

function storyInfrastructureRightOfWayActorCountry(actorId, options) {
    if (options && typeof options.actorCountryId === 'function') {
        return String(options.actorCountryId(String(actorId || '')) || '');
    }
    const identity = typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(String(actorId || '')) : null;
    if (identity && identity.countryId) return String(identity.countryId);
    const country = /country:(\d+)/.exec(String(actorId || ''));
    if (country) return `country:${Number(country[1])}`;
    const character = /^character:(\d+):/.exec(String(actorId || ''));
    return character ? `country:${Number(character[1])}` : '';
}

function storyInfrastructureRightOfWayEvidenceValidate(source, spec, targetRegionId,
    applicantActor, targetCountryId, options) {
    const kind = String(source && source.kind || '');
    const id = String(source && source.id || '').trim();
    if (!id || !['INFRASTRUCTURE_DOSSIER', 'CONVERSATION', 'NEGOTIATION_CASE'].includes(kind)) {
        return { ok: false, code: 'RIGHT_OF_WAY_DIPLOMATIC_EVIDENCE_REQUIRED' };
    }
    if (kind === 'INFRASTRUCTURE_DOSSIER') return { ok: true, kind, id };
    const routeKey = storyInfrastructureRightOfWayRouteKey(spec, targetRegionId);
    if (String(source.routeKey || '') !== routeKey
        || String(source.targetRegionId || '') !== String(targetRegionId || '')) {
        return { ok: false, code: 'RIGHT_OF_WAY_EVIDENCE_ROUTE_BINDING_REQUIRED' };
    }
    const row = kind === 'CONVERSATION'
        ? options && typeof options.conversationSession === 'function'
            ? options.conversationSession(id)
            : typeof storyConversationSessionGet === 'function' ? storyConversationSessionGet(id) : null
        : options && typeof options.negotiationCase === 'function'
            ? options.negotiationCase(id)
            : typeof storyNegotiationCaseGet === 'function' ? storyNegotiationCaseGet(id) : null;
    if (!row) return { ok: false, code: kind === 'CONVERSATION'
        ? 'RIGHT_OF_WAY_CONVERSATION_NOT_FOUND' : 'RIGHT_OF_WAY_NEGOTIATION_CASE_NOT_FOUND' };
    const parties = kind === 'CONVERSATION'
        ? [row.playerActorId, row.listenerActorId].filter(Boolean).map(String)
        : (row.partyActorIds || []).filter(Boolean).map(String);
    if (!parties.includes(String(applicantActor && applicantActor.actorId || ''))) {
        return { ok: false, code: 'RIGHT_OF_WAY_EVIDENCE_APPLICANT_NOT_PARTY' };
    }
    const foreignParty = parties.find(actorId => actorId !== String(applicantActor.actorId || '')
        && storyInfrastructureRightOfWayActorCountry(actorId, options) === targetCountryId);
    if (!foreignParty) return { ok: false, code: 'RIGHT_OF_WAY_EVIDENCE_TARGET_COUNTRY_NOT_PARTY' };
    return { ok: true, kind, id, routeKey, targetRegionId: String(targetRegionId),
        applicantActorId: String(applicantActor.actorId), foreignPartyActorId: foreignParty };
}

function storyInfrastructureRightOfWayEvidenceCandidates(input, options) {
    input = input || {};
    const actor = input.applicantActor || options && options.actor;
    const spec = storyInfrastructureWorkClone(input.spec || {});
    const targetRegionId = String(input.targetRegionId || '');
    const targetCountryId = storyInfrastructureRightOfWayCountry(targetRegionId, options);
    if (!actor || !targetCountryId) return [];
    const routeKey = storyInfrastructureRightOfWayRouteKey(spec, targetRegionId);
    const sessions = options && typeof options.conversationSessions === 'function'
        ? options.conversationSessions(actor.actorId) || []
        : typeof storyConversationSessionList === 'function' ? storyConversationSessionList() : [];
    const cases = options && typeof options.negotiationCases === 'function'
        ? options.negotiationCases(actor.actorId) || []
        : typeof storyNegotiationCaseList === 'function' ? storyNegotiationCaseList(actor.actorId) : [];
    const sources = sessions.map(row => ({ kind: 'CONVERSATION', id: String(row.id), row }))
        .concat(cases.map(row => ({ kind: 'NEGOTIATION_CASE', id: String(row.id), row })));
    return sources.map(source => {
        const evidence = { kind: source.kind, id: source.id, routeKey, targetRegionId };
        const validation = storyInfrastructureRightOfWayEvidenceValidate(evidence, spec,
            targetRegionId, actor, targetCountryId, Object.assign({}, options, {
                conversationSession: id => source.kind === 'CONVERSATION' && id === source.id
                    ? source.row : null,
                negotiationCase: id => source.kind === 'NEGOTIATION_CASE' && id === source.id
                    ? source.row : null
            }));
        if (!validation.ok) return null;
        const excerpt = source.kind === 'CONVERSATION'
            ? String(source.row.initialText || source.row.analysis && source.row.analysis.intent || 'Görüşme')
            : String(source.row.topic || source.row.status || 'Müzakere dosyası');
        return { kind: source.kind, id: source.id,
            label: `${source.kind === 'CONVERSATION' ? 'GÖRÜŞME' : 'MÜZAKERE'} · ${excerpt.slice(0, 72)}`,
            sourceEvidence: validation };
    }).filter(Boolean).slice(0, 8);
}

function storyInfrastructureRightOfWayGrant(spec, regionId, applicantCountryId, options) {
    const ledger = storyInfrastructureWorkEnsure(options && options.root);
    const routeKey = storyInfrastructureRightOfWayRouteKey(spec, regionId);
    const row = (ledger.rightOfWayRequests || []).find(request => request.status === 'GRANTED'
        && request.routeKey === routeKey
        && request.applicantCountryId === String(applicantCountryId || '')) || null;
    if (row && row.foreignDecision && Number(row.foreignDecision.validUntil) > 0
        && storyInfrastructureWorkClock(options) >= Number(row.foreignDecision.validUntil)) {
        row.status = 'REVOKED';
        row.revocation = { reason: 'EXPIRED', actorId: null,
            at: storyInfrastructureWorkClock(options) };
        ledger.revision++;
        return null;
    }
    return row;
}

function storyInfrastructureRightOfWayRequest(input, options) {
    input = input || {};
    const ledger = storyInfrastructureWorkEnsure(options && options.root);
    const actor = input.applicantActor || options && options.actor
        || storyInfrastructureRoutePlayerActor();
    const spec = storyInfrastructureWorkClone(input.spec || {});
    const targetRegionId = String(input.targetRegionId || '');
    const applicantCountryId = String(actor && actor.countryId || '');
    if (!actor || !applicantCountryId || !['EXECUTIVE', 'COMPANY_OWNER', 'COMPANY_EXECUTIVE'].includes(actor.role)) {
        return { ok: false, code: 'RIGHT_OF_WAY_APPLICANT_AUTHORITY_REQUIRED' };
    }
    const targetCountryId = storyInfrastructureRightOfWayCountry(targetRegionId, options);
    if (!targetCountryId || targetCountryId === applicantCountryId) {
        return { ok: false, code: 'RIGHT_OF_WAY_FOREIGN_REGION_REQUIRED' };
    }
    const source = input.sourceEvidence || {};
    const evidence = storyInfrastructureRightOfWayEvidenceValidate(source, spec,
        targetRegionId, actor, targetCountryId, options);
    if (!evidence.ok) return evidence;
    const candidate = storyInfrastructureRouteCandidate(spec, options);
    if (!candidate.crossedRegionIds.includes(targetRegionId)) {
        return { ok: false, code: 'RIGHT_OF_WAY_REGION_NOT_ON_ROUTE' };
    }
    const routeKey = storyInfrastructureRightOfWayRouteKey(spec, targetRegionId);
    const duplicate = (ledger.rightOfWayRequests || []).find(row => row.routeKey === routeKey
        && row.applicantCountryId === applicantCountryId
        && ['PENDING_FOREIGN_EXECUTIVE', 'COUNTERED', 'GRANTED'].includes(row.status));
    if (duplicate) return { ok: true, duplicate: true,
        request: storyInfrastructureWorkClone(duplicate) };
    const sequence = ++ledger.rightOfWaySequence;
    const request = {
        schemaVersion: 1, id: `right-of-way-request:${sequence}`, sequence,
        routeKey, mode: String(spec.mode || '').toUpperCase(),
        fromRegionId: String(spec.fromRegionId || ''), toRegionId: String(spec.toRegionId || ''),
        targetRegionId, applicantActorId: String(actor.actorId || ''),
        applicantCountryId, targetCountryId,
        offeredCompensationCash: Math.max(0, Math.round(Number(input.compensationCash) || 0)),
        sourceEvidence: storyInfrastructureWorkClone(evidence),
        status: 'PENDING_FOREIGN_EXECUTIVE', requestedAt: storyInfrastructureWorkClock(options),
        foreignDecision: null, grantEvidenceId: null, portAuthorityEvidenceId: null,
        revocation: null
    };
    ledger.rightOfWayRequests.push(request); ledger.revision++;
    return { ok: true, duplicate: false, request: storyInfrastructureWorkClone(request) };
}

function storyInfrastructureRightOfWayDecide(requestId, decision, options) {
    const ledger = storyInfrastructureWorkEnsure(options && options.root);
    const request = (ledger.rightOfWayRequests || []).find(row => row.id === String(requestId || ''));
    if (!request) return { ok: false, code: 'RIGHT_OF_WAY_REQUEST_NOT_FOUND' };
    if (request.status !== 'PENDING_FOREIGN_EXECUTIVE') {
        return { ok: false, code: 'RIGHT_OF_WAY_REQUEST_NOT_DECIDABLE' };
    }
    const actor = options && options.actor;
    if (!actor || actor.role !== 'EXECUTIVE' || String(actor.countryId || '') !== request.targetCountryId) {
        return { ok: false, code: 'FOREIGN_EXECUTIVE_AUTHORITY_REQUIRED' };
    }
    const normalized = String(decision && decision.action || decision || '').toUpperCase();
    if (!['APPROVE', 'REJECT', 'COUNTER'].includes(normalized)) {
        return { ok: false, code: 'RIGHT_OF_WAY_DECISION_INVALID' };
    }
    const hasCompensation = decision && typeof decision === 'object'
        && Object.prototype.hasOwnProperty.call(decision, 'compensationCash');
    const compensation = ['APPROVE', 'COUNTER'].includes(normalized)
        ? Math.max(0, Math.round(hasCompensation
            ? Number(decision.compensationCash) || 0 : request.offeredCompensationCash))
        : 0;
    const decidedAt = storyInfrastructureWorkClock(options);
    const defaultValidFor = typeof YEAR_SECONDS !== 'undefined'
        ? Math.max(0, Number(YEAR_SECONDS) || 0) * 5 : 600;
    const hasValidFor = decision && typeof decision === 'object'
        && Object.prototype.hasOwnProperty.call(decision, 'validForSeconds');
    const validForSeconds = normalized === 'APPROVE' ? Math.max(0,
        hasValidFor ? Number(decision.validForSeconds) || 0 : defaultValidFor) : 0;
    request.status = normalized === 'APPROVE' ? 'GRANTED'
        : normalized === 'COUNTER' ? 'COUNTERED' : 'REJECTED';
    request.foreignDecision = {
        action: normalized, actorId: String(actor.actorId || ''),
        countryId: String(actor.countryId), decidedAt,
        validUntil: validForSeconds > 0 ? decidedAt + validForSeconds : null,
        compensationCash: compensation,
        sourceEvidenceId: String(decision && decision.sourceEvidenceId || ''),
        policy: decision && decision.policy ? storyInfrastructureWorkClone(decision.policy) : null
    };
    if (normalized === 'APPROVE') {
        request.grantEvidenceId = `right-of-way-grant:${request.sequence}`;
        if (request.mode === 'SEA') request.portAuthorityEvidenceId = `foreign-port-access:${request.sequence}`;
    } else if (normalized === 'COUNTER') {
        request.counterOffer = { status: 'OPEN', compensationCash: compensation,
            proposedAt: decidedAt, proposedByActorId: String(actor.actorId || ''),
            respondedAt: null, responseActorId: null };
    }
    ledger.revision++;
    return { ok: true, request: storyInfrastructureWorkClone(request) };
}

function storyInfrastructureRightOfWayCounterRespond(requestId, action, options) {
    const ledger = storyInfrastructureWorkEnsure(options && options.root);
    const request = (ledger.rightOfWayRequests || []).find(row => row.id === String(requestId || ''));
    if (!request) return { ok: false, code: 'RIGHT_OF_WAY_REQUEST_NOT_FOUND' };
    if (request.status !== 'COUNTERED' || !request.counterOffer
        || request.counterOffer.status !== 'OPEN') {
        return { ok: false, code: 'RIGHT_OF_WAY_COUNTER_NOT_RESPONDABLE' };
    }
    const actor = options && options.actor;
    if (!actor || String(actor.countryId || '') !== request.applicantCountryId
        || !['EXECUTIVE', 'COMPANY_OWNER', 'COMPANY_EXECUTIVE'].includes(actor.role)) {
        return { ok: false, code: 'RIGHT_OF_WAY_APPLICANT_AUTHORITY_REQUIRED' };
    }
    const normalized = String(action || '').toUpperCase();
    if (!['ACCEPT', 'REJECT'].includes(normalized)) {
        return { ok: false, code: 'RIGHT_OF_WAY_COUNTER_RESPONSE_INVALID' };
    }
    const at = storyInfrastructureWorkClock(options);
    request.counterOffer.status = normalized === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
    request.counterOffer.respondedAt = at;
    request.counterOffer.responseActorId = String(actor.actorId || '');
    if (normalized === 'REJECT') {
        request.status = 'REJECTED';
    } else {
        request.status = 'GRANTED';
        request.foreignDecision.action = 'APPROVE';
        request.foreignDecision.compensationCash = Math.max(0,
            Number(request.counterOffer.compensationCash) || 0);
        request.grantEvidenceId = `right-of-way-grant:${request.sequence}`;
        if (request.mode === 'SEA') request.portAuthorityEvidenceId = `foreign-port-access:${request.sequence}`;
    }
    ledger.revision++;
    return { ok: true, request: storyInfrastructureWorkClone(request) };
}

function storyInfrastructureRightOfWayPlayerRespondCounter(requestId, action) {
    const actor = storyInfrastructureRoutePlayerActor();
    const result = storyInfrastructureRightOfWayCounterRespond(requestId, action, { actor });
    if (typeof storyCityDossierPanelReset === 'function') storyCityDossierPanelReset();
    return result;
}

function storyInfrastructureRightOfWayRevoke(requestId, reason, options) {
    const ledger = storyInfrastructureWorkEnsure(options && options.root);
    const request = (ledger.rightOfWayRequests || []).find(row => row.id === String(requestId || ''));
    if (!request) return { ok: false, code: 'RIGHT_OF_WAY_REQUEST_NOT_FOUND' };
    if (request.status !== 'GRANTED') return { ok: false, code: 'RIGHT_OF_WAY_GRANT_NOT_REVOCABLE' };
    const actor = options && options.actor;
    if (!actor || actor.role !== 'EXECUTIVE'
        || String(actor.countryId || '') !== request.targetCountryId) {
        return { ok: false, code: 'FOREIGN_EXECUTIVE_AUTHORITY_REQUIRED' };
    }
    request.status = 'REVOKED';
    request.revocation = { reason: String(reason || 'FOREIGN_EXECUTIVE_DECISION').slice(0, 120),
        actorId: String(actor.actorId || ''), at: storyInfrastructureWorkClock(options) };
    ledger.revision++;
    return { ok: true, request: storyInfrastructureWorkClone(request) };
}

function storyInfrastructureRightOfWayExecutive(countryId, options) {
    if (options && typeof options.executiveForCountry === 'function') {
        return options.executiveForCountry(String(countryId || '')) || null;
    }
    const identities = typeof storyCharacterIdentityEnsure === 'function'
        ? storyCharacterIdentityEnsure() : null;
    const actor = Object.values(identities && identities.identities || {})
        .filter(row => row && row.role === 'EXECUTIVE'
            && String(row.countryId || '') === String(countryId || ''))
        .sort((a, b) => String(a.id).localeCompare(String(b.id), 'en'))[0];
    return actor ? { actorId: actor.id, countryId: actor.countryId, role: actor.role } : {
        actorId: `officeholder:${String(countryId || '')}:executive-ai`,
        countryId: String(countryId || ''), role: 'EXECUTIVE'
    };
}

function storyInfrastructureRightOfWayAiSignals(request, actor, options) {
    if (options && typeof options.aiSignals === 'function') {
        return Object.assign({}, options.aiSignals(request, actor) || {});
    }
    const targetNumber = storyInfrastructureCountryNumber(request.targetCountryId);
    const applicantNumber = storyInfrastructureCountryNumber(request.applicantCountryId);
    const diplomaticRelation = typeof storyRelValue === 'function'
        ? Number(storyRelValue(targetNumber, applicantNumber)) || 0 : 0;
    const treaty = typeof storyTreaty === 'function'
        ? String(storyTreaty(targetNumber, applicantNumber) || 'peace') : 'peace';
    const relation = typeof storyRelationshipView === 'function'
        ? storyRelationshipView(actor.actorId, request.applicantActorId) : null;
    const targetState = typeof storyState === 'function' ? storyState(targetNumber) : null;
    return {
        diplomaticRelation,
        treaty,
        trustBps: Number(relation && relation.trustBps) || 5000,
        hostilityBps: Number(relation && relation.hostilityBps) || 2000,
        marketConfidence: Number(targetState && targetState.marketConfidence) || 50
    };
}

function storyInfrastructureRightOfWayAiEvaluate(request, actor, options) {
    const signals = storyInfrastructureRightOfWayAiSignals(request, actor, options);
    const relation = Math.max(-100, Math.min(100, Number(signals.diplomaticRelation) || 0));
    const trust = Math.max(0, Math.min(10000, Number(signals.trustBps) || 0));
    const hostility = Math.max(0, Math.min(10000, Number(signals.hostilityBps) || 0));
    const confidence = Math.max(0, Math.min(100, Number(signals.marketConfidence) || 0));
    const treaty = String(signals.treaty || 'peace').toLowerCase();
    const offer = Math.max(0, Number(request.offeredCompensationCash) || 0);
    const components = {
        neutrality: -8,
        diplomaticRelation: Math.round(relation * 0.35 * 100) / 100,
        personalTrust: Math.round((trust - 5000) / 500 * 100) / 100,
        personalHostility: -Math.round(hostility / 500 * 100) / 100,
        compensation: Math.min(25, Math.round(offer / 4 * 100) / 100),
        economicNeed: Math.max(-5, Math.min(8, Math.round((50 - confidence) / 5 * 100) / 100)),
        routeUtility: request.mode === 'RAIL' ? 8 : request.mode === 'SEA' ? 6 : 4,
        securityRisk: treaty === 'war' ? -100 : treaty === 'truce' ? -12 : 0
    };
    const score = Math.round(Object.values(components).reduce((sum, value) => sum + value, 0) * 100) / 100;
    const action = score >= 0 ? 'APPROVE'
        : treaty !== 'war' && score >= -20 ? 'COUNTER' : 'REJECT';
    const recommendedCompensationCash = action === 'COUNTER'
        ? Math.ceil(offer + Math.abs(score) * 4 + 10) : offer;
    return { action, score, components, recommendedCompensationCash,
        signals: { diplomaticRelation: relation, treaty, trustBps: trust,
            hostilityBps: hostility, marketConfidence: confidence },
        offeredCompensationCash: offer };
}

function storyInfrastructureRightOfWayAiTick(options) {
    const ledger = storyInfrastructureWorkEnsure(options && options.root);
    const now = storyInfrastructureWorkClock(options);
    const delay = Math.max(0, Number(options && options.reviewDelaySeconds) || 8);
    const playerCountryId = options && options.playerCountryId != null
        ? String(options.playerCountryId) : typeof STORY !== 'undefined'
            ? `country:${Number(STORY.playerStateId)}` : '';
    const decisions = [];
    for (const request of ledger.rightOfWayRequests || []) {
        if (request.status !== 'PENDING_FOREIGN_EXECUTIVE'
            || now + 1e-6 < Number(request.requestedAt || 0) + delay
            || request.targetCountryId === playerCountryId) continue;
        const actor = storyInfrastructureRightOfWayExecutive(request.targetCountryId, options);
        const policy = storyInfrastructureRightOfWayAiEvaluate(request, actor, options);
        const result = storyInfrastructureRightOfWayDecide(request.id, {
            action: policy.action,
            compensationCash: policy.action === 'COUNTER'
                ? policy.recommendedCompensationCash : request.offeredCompensationCash,
            sourceEvidenceId: `foreign-ai-review:${request.id}`, policy
        }, Object.assign({}, options, { actor }));
        if (result.ok) decisions.push(result.request);
    }
    return { ok: true, reviewed: decisions.length, decisions: storyInfrastructureWorkClone(decisions) };
}

function storyInfrastructureRoutePlayerSpec(fromRegionId, toRegionId, mode) {
    const actor = storyInfrastructureRoutePlayerActor();
    const from = storyInfrastructureRouteRegionNumber(fromRegionId);
    const to = storyInfrastructureRouteRegionNumber(toRegionId);
    const nodes = typeof STORY !== 'undefined' ? STORY.nodes || [] : [];
    const ownsEndpoints = [from, to].every(id => nodes[id]
        && Number(nodes[id].owner) === Number(STORY.playerStateId));
    if (!actor) return { ok: false, code: 'PLAYER_ACTOR_UNAVAILABLE' };
    const company = storyInfrastructureRouteCompanyForActor(actor);
    const isExecutive = actor.role === 'EXECUTIVE';
    const isCompany = !!company;
    if (!isExecutive && !isCompany) {
        return { ok: false, code: 'EXECUTIVE_ROLE_REQUIRED' };
    }
    if (!ownsEndpoints) return { ok: false, code: 'ENDPOINT_OUTSIDE_PLAYER_JURISDICTION' };
    if (isCompany && (String(company.countryId || '') !== actor.countryId
        || company.status !== 'OPERATING' || company.licenseStatus !== 'LICENSED')) {
        return { ok: false, code: 'PLAYER_COMPANY_UNAVAILABLE' };
    }
    const base = {
        mode: String(mode || '').toUpperCase(), fromRegionId: String(fromRegionId),
        toRegionId: String(toRegionId), ownerType: isExecutive ? 'STATE' : 'COMPANY',
        ownerId: isExecutive ? actor.countryId : company.id,
        fundingRegionId: String(fromRegionId),
        permission: { approved: true, institutionId: 'institution:executive',
            decisionId: isExecutive ? `player-infrastructure:${Number(STORY.clock) || 0}`
                : 'pending-executive-decision',
            authorityActorId: actor.actorId },
        environmentalAssessment: { assessmentId: 'institution:environmental-review',
            mitigationId: 'policy:mandatory-restoration', restorationCash: 0 }
    };
    const preview = storyInfrastructureRouteCandidate(base);
    const foreign = preview.crossedRegionIds.filter(regionId => {
        const id = storyInfrastructureRouteRegionNumber(regionId);
        return !nodes[id] || Number(nodes[id].owner) !== Number(STORY.playerStateId);
    });
    const ownRegions = preview.crossedRegionIds.filter(regionId => !foreign.includes(regionId));
    const grants = Object.fromEntries(foreign.map(regionId => [
        regionId, storyInfrastructureRightOfWayGrant(base, regionId, actor.countryId)
    ]).filter(row => !!row[1]));
    const unresolvedForeign = foreign.filter(regionId => !grants[regionId]);
    const spec = Object.assign({}, base, {
        rightOfWay: { evidenceByRegion: Object.assign(Object.fromEntries(ownRegions
            .map(regionId => [regionId, `executive-right-of-way:${regionId}`])),
            Object.fromEntries(Object.entries(grants).map(([regionId, grant]) =>
                [regionId, grant.grantEvidenceId]))),
            grantsByRegion: Object.fromEntries(Object.entries(grants).map(([regionId, grant]) =>
                [regionId, { requestId: grant.id, targetCountryId: grant.targetCountryId,
                    evidenceId: grant.grantEvidenceId,
                    compensationCash: Math.max(0, Number(grant.foreignDecision
                        && grant.foreignDecision.compensationCash) || 0) }])),
            compensationCash: Object.values(grants).reduce((sum, grant) =>
                sum + Math.max(0, Number(grant.foreignDecision && grant.foreignDecision.compensationCash) || 0), 0) },
        portAuthority: { evidenceByRegion: Object.assign(Object.fromEntries(ownRegions
            .map(regionId => [regionId, `national-port-authority:${regionId}`])),
            Object.fromEntries(Object.entries(grants).filter(([, grant]) => grant.portAuthorityEvidenceId)
                .map(([regionId, grant]) => [regionId, grant.portAuthorityEvidenceId]))),
            dredgingPermitId: base.mode === 'SEA' ? 'national-dredging-permit' : '' }
    });
    const candidate = storyInfrastructureRouteCandidate(spec);
    if (unresolvedForeign.length) candidate.blockReasons.push(...unresolvedForeign.map(id =>
        `FOREIGN_RIGHT_OF_WAY_REQUIRED:${id}`));
    candidate.blockReasons = Array.from(new Set(candidate.blockReasons));
    candidate.ok = candidate.blockReasons.length === 0;
    return { ok: true, actor, company: company ? storyInfrastructureWorkClone(company) : null,
        submissionKind: isExecutive ? 'STATE_COMMAND' : 'COMPANY_PROPOSAL', spec, candidate,
        requirements: storyInfrastructureRouteRequirements(candidate),
        foreignRegionIds: foreign, unresolvedForeignRegionIds: unresolvedForeign,
        rightOfWayGrants: storyInfrastructureWorkClone(grants) };
}

function storyInfrastructureRoutePlayerView(fromRegionId) {
    const actor = storyInfrastructureRoutePlayerActor();
    const ledger = storyInfrastructureWorkEnsure();
    const from = storyInfrastructureRouteRegionNumber(fromRegionId);
    const nodes = typeof STORY !== 'undefined' ? STORY.nodes || [] : [];
    const ownsOrigin = !!(nodes[from] && Number(nodes[from].owner) === Number(STORY.playerStateId));
    const company = storyInfrastructureRouteCompanyForActor(actor);
    const allowedRole = !!(actor && (actor.role === 'EXECUTIVE' || company));
    const allowed = !!(allowedRole && ownsOrigin);
    const destinations = nodes.filter(node => Number(node.id) !== from
        && Number(node.owner) === Number(STORY.playerStateId))
        .map(node => ({ regionId: `region:${node.id}`, name: String(node.name),
            distance: nodes[from] ? Math.hypot(Number(node.lx) - Number(nodes[from].lx),
                Number(node.ly) - Number(nodes[from].ly)) : 0 }))
        .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name, 'tr'));
    let draft = STORY._infrastructureRouteDraft
        && STORY._infrastructureRouteDraft.fromRegionId === String(fromRegionId)
        ? storyInfrastructureWorkClone(STORY._infrastructureRouteDraft) : null;
    if (draft) {
        const refreshed = storyInfrastructureRoutePlayerSpec(
            draft.fromRegionId, draft.toRegionId, draft.mode);
        if (refreshed.ok) {
            draft.candidate = refreshed.candidate;
            draft.requirements = refreshed.requirements;
            draft.resourceBlocks = storyInfrastructureRoutePlayerResourceBlocks(refreshed);
            draft.foreignRegionIds = refreshed.foreignRegionIds;
            draft.unresolvedForeignRegionIds = refreshed.unresolvedForeignRegionIds;
            draft.rightOfWayEvidenceByRegion = Object.fromEntries(
                refreshed.foreignRegionIds.map(regionId => [regionId,
                    storyInfrastructureRightOfWayEvidenceCandidates({
                        applicantActor: refreshed.actor, spec: refreshed.spec, targetRegionId: regionId
                    })]));
        }
    }
    const selectedMode = STORY._infrastructureRouteModeDraft
        && STORY._infrastructureRouteModeDraft.fromRegionId === String(fromRegionId)
        ? String(STORY._infrastructureRouteModeDraft.mode || '') : null;
    const proposals = storyInfrastructureWorkClone((ledger.routeProposals || []).filter(proposal =>
        proposal.countryId === (actor && actor.countryId)
        && (proposal.fromRegionId === String(fromRegionId)
            || proposal.toRegionId === String(fromRegionId))));
    const rightOfWayRequests = storyInfrastructureWorkClone((ledger.rightOfWayRequests || [])
        .filter(request => request.applicantCountryId === (actor && actor.countryId)
            && (request.fromRegionId === String(fromRegionId)
                || request.toRegionId === String(fromRegionId))));
    return { allowed, lockedReason: !actor ? 'PLAYER_ACTOR_UNAVAILABLE'
        : !ownsOrigin ? 'REGION_OUTSIDE_PLAYER_JURISDICTION'
            : !allowedRole ? 'EXECUTIVE_ROLE_REQUIRED' : null,
        actor, company: company ? { id: company.id, name: company.name,
            cash: Math.max(0, Number(company.accounts && company.accounts['ASSET:CASH']) || 0) } : null,
        submissionKind: actor && actor.role === 'EXECUTIVE' ? 'STATE_COMMAND' : 'COMPANY_PROPOSAL',
        fromRegionId: String(fromRegionId), destinations, draft, selectedMode, proposals,
        rightOfWayRequests,
        commands: storyInfrastructureWorkClone((ledger.routeCommands || []).filter(command =>
            command.fromRegionId === String(fromRegionId) || command.toRegionId === String(fromRegionId))) };
}

function storyInfrastructureRoutePlayerChooseMode(fromRegionId, mode) {
    const view = storyInfrastructureRoutePlayerView(fromRegionId);
    const selected = String(mode || '').toUpperCase();
    if (!view.allowed) return { ok: false, code: view.lockedReason };
    if (!STORY_INFRA_ROUTE_MODES.includes(selected)) return { ok: false, code: 'ROUTE_MODE_UNSUPPORTED' };
    STORY._infrastructureRouteModeDraft = { fromRegionId: String(fromRegionId), mode: selected };
    if (typeof storyCityDossierPanelReset === 'function') storyCityDossierPanelReset();
    return { ok: true, mode: selected };
}

function storyInfrastructureRoutePlayerSetTargetFilter(fromRegionId, query) {
    if (typeof STORY === 'undefined') return { ok: false, code: 'STORY_STATE_UNAVAILABLE' };
    const from = String(fromRegionId || '');
    if (storyInfrastructureRouteRegionNumber(from) < 0) {
        return { ok: false, code: 'ROUTE_ENDPOINT_INVALID' };
    }
    const value = String(query == null ? '' : query).trim().slice(0, 64);
    STORY._infrastructureRouteTargetFilter = { fromRegionId: from, query: value };
    return { ok: true, fromRegionId: from, query: value };
}

function storyInfrastructureRoutePlayerResourceBlocks(resolved) {
    const req = resolved && resolved.requirements;
    const spec = resolved && resolved.spec;
    if (!req || !spec) return [{ code: 'ROUTE_REQUIREMENTS_UNAVAILABLE' }];
    const economy = storyInfrastructureWorkEconomy();
    const ledger = storyInfrastructureWorkEnsure();
    const blocks = [];
    const cash = Number(economy.cashAvailable(spec.ownerType, spec.ownerId)) || 0;
    if (cash + 1e-6 < req.cash) blocks.push({ code: 'ROUTE_CASH_UNAVAILABLE',
        required: req.cash, available: cash });
    const workers = Math.max(0, Number(economy.availableWorkers(spec.fundingRegionId))
        - storyInfrastructureWorkReservedWorkforce(ledger, spec.fundingRegionId));
    if (workers + 1e-6 < req.workforce) blocks.push({ code: 'ROUTE_WORKFORCE_UNAVAILABLE',
        required: req.workforce, available: workers });
    for (const [resourceId, required] of Object.entries(req.materials || {})) {
        const available = Number(economy.stock(spec.fundingRegionId, resourceId)) || 0;
        if (available + 1e-6 < required) blocks.push({ code: 'ROUTE_MATERIAL_UNAVAILABLE',
            resourceId, required, available });
    }
    return blocks;
}

function storyInfrastructureRoutePlayerSelect(fromRegionId, toRegionId, mode) {
    const result = storyInfrastructureRoutePlayerSpec(fromRegionId, toRegionId, mode);
    if (!result.ok) return result;
    STORY._infrastructureRouteDraft = { fromRegionId: String(fromRegionId),
        toRegionId: String(toRegionId), mode: String(mode).toUpperCase(),
        candidate: result.candidate, requirements: result.requirements,
        resourceBlocks: storyInfrastructureRoutePlayerResourceBlocks(result),
        foreignRegionIds: result.foreignRegionIds,
        unresolvedForeignRegionIds: result.unresolvedForeignRegionIds,
        createdAt: Number(STORY.clock) || 0 };
    if (typeof storyCityDossierPanelReset === 'function') storyCityDossierPanelReset();
    return { ok: true, draft: storyInfrastructureWorkClone(STORY._infrastructureRouteDraft) };
}

function storyInfrastructureRightOfWayPlayerRequest(targetRegionId, compensationCash, sourceEvidence) {
    const draft = typeof STORY !== 'undefined' && STORY._infrastructureRouteDraft;
    if (!draft) return { ok: false, code: 'ROUTE_DRAFT_MISSING' };
    const resolved = storyInfrastructureRoutePlayerSpec(
        draft.fromRegionId, draft.toRegionId, draft.mode);
    if (!resolved.ok) return resolved;
    const target = String(targetRegionId || '');
    if (!resolved.unresolvedForeignRegionIds.includes(target)) {
        return { ok: false, code: 'RIGHT_OF_WAY_FOREIGN_REGION_NOT_PENDING' };
    }
    const result = storyInfrastructureRightOfWayRequest({
        spec: resolved.spec, targetRegionId: target,
        compensationCash: Math.max(0, Number(compensationCash) || 0),
        sourceEvidence: sourceEvidence || {
            kind: 'INFRASTRUCTURE_DOSSIER',
            id: `route-dossier:${draft.mode}:${draft.fromRegionId}:${draft.toRegionId}:${target}`
        }
    });
    if (typeof storyCityDossierPanelReset === 'function') storyCityDossierPanelReset();
    return result;
}

function storyInfrastructureRoutePlayerCancelDraft() {
    if (typeof STORY !== 'undefined') {
        STORY._infrastructureRouteDraft = null;
        STORY._infrastructureRouteModeDraft = null;
    }
    if (typeof storyCityDossierPanelReset === 'function') storyCityDossierPanelReset();
    return { ok: true };
}

function storyInfrastructureRoutePlayerSubmitDraft() {
    const draft = typeof STORY !== 'undefined' && STORY._infrastructureRouteDraft;
    if (!draft) return { ok: false, code: 'ROUTE_DRAFT_MISSING' };
    const resolved = storyInfrastructureRoutePlayerSpec(draft.fromRegionId, draft.toRegionId, draft.mode);
    if (!resolved.ok) return resolved;
    if (!resolved.candidate.ok) return { ok: false,
        code: resolved.candidate.blockReasons[0] || 'ROUTE_REQUIREMENTS_INCOMPLETE' };
    if (resolved.submissionKind === 'COMPANY_PROPOSAL') {
        const proposed = storyInfrastructureRouteSubmitCompanyProposal(resolved.spec, {
            applicant: resolved.actor, company: () => resolved.company
        });
        if (!proposed.ok) return proposed;
        STORY._infrastructureRouteDraft = null;
        STORY._infrastructureRouteModeDraft = null;
        if (typeof storyCityDossierPanelReset === 'function') storyCityDossierPanelReset();
        return proposed;
    }
    const submitted = storyInfrastructureRouteReserveAndSubmit(resolved.spec);
    if (!submitted.ok) return submitted;
    const started = storyInfrastructureRouteStart(submitted.command.id);
    if (!started.ok) return started;
    STORY._infrastructureRouteDraft = null;
    STORY._infrastructureRouteModeDraft = null;
    if (typeof storyCityDossierPanelReset === 'function') storyCityDossierPanelReset();
    return { ok: true, command: started.command };
}

function storyInfrastructureRouteSubmitCompanyProposal(spec, options) {
    spec = spec || {};
    const ledger = storyInfrastructureWorkEnsure(options && options.root);
    const applicant = options && options.applicant || storyInfrastructureRoutePlayerActor();
    const company = storyInfrastructureRouteCompanyForActor(applicant, options);
    if (!company || String(company.id) !== String(spec.ownerId || '')
        || String(company.countryId || '') !== String(applicant && applicant.countryId || '')) {
        return { ok: false, code: 'COMPANY_APPLICANT_AUTHORITY_MISMATCH' };
    }
    if (String(spec.ownerType || '').toUpperCase() !== 'COMPANY') {
        return { ok: false, code: 'COMPANY_PROPOSAL_FINANCING_REQUIRED' };
    }
    const candidate = storyInfrastructureRouteCandidate(spec, options);
    const requirements = storyInfrastructureRouteRequirements(candidate);
    const fatalBlocks = candidate.blockReasons.filter(reason => reason !== 'AUTHORITY_APPROVAL_REQUIRED');
    if (!requirements || fatalBlocks.length) return { ok: false,
        code: fatalBlocks[0] || 'ROUTE_SPEC_INVALID', candidate, requirements };
    const collision = (ledger.routeProposals || []).some(row => row.companyId === company.id
        && row.mode === candidate.mode
        && [row.fromRegionId, row.toRegionId].sort().join('|')
            === [candidate.fromRegionId, candidate.toRegionId].sort().join('|')
        && ['PENDING_EXECUTIVE', 'RESOURCE_BLOCKED'].includes(row.status));
    if (collision) return { ok: false, code: 'COMPANY_ROUTE_PROPOSAL_ALREADY_OPEN' };
    const economy = storyInfrastructureWorkEconomy(options);
    if (Number(economy.cashAvailable('COMPANY', company.id)) + 1e-6 < requirements.cash) {
        return { ok: false, code: 'ROUTE_CASH_UNAVAILABLE', required: requirements.cash };
    }
    ledger.reservationSequence++;
    const escrowReservationId = `infrastructure-route-proposal-escrow:${ledger.reservationSequence}`;
    const cash = economy.cashReserve('COMPANY', company.id, requirements.cash, {
        reservationId: escrowReservationId, proposal: true,
        fromRegionId: candidate.fromRegionId, toRegionId: candidate.toRegionId,
        applicantActorId: applicant.actorId
    });
    if (!cash || !cash.ok) {
        return cash || { ok: false, code: 'PROPOSAL_ESCROW_RESERVATION_FAILED' };
    }
    ledger.proposalSequence++;
    const id = `infrastructure-route-proposal:${ledger.proposalSequence}`;
    const now = typeof STORY !== 'undefined' ? Number(STORY.clock) || 0 : 0;
    const proposal = {
        id, correlationId: String(spec.correlationId || id), status: 'PENDING_EXECUTIVE',
        origin: String(options && options.origin || spec.origin || 'PLAYER_COMPANY'),
        countryId: String(applicant.countryId),
        applicantActorId: String(applicant.actorId), companyId: String(company.id),
        mode: candidate.mode, fromRegionId: candidate.fromRegionId,
        toRegionId: candidate.toRegionId, fundingRegionId: String(spec.fundingRegionId),
        submittedAt: now, updatedAt: now,
        requirements: storyInfrastructureWorkClone(requirements),
        escrowReservation: { id: escrowReservationId, cash: requirements.cash,
            ownerType: 'COMPANY', ownerId: String(company.id), status: 'HELD' },
        spec: storyInfrastructureWorkClone(Object.assign({}, spec, {
            permission: { approved: false, institutionId: '', decisionId: '', authorityActorId: '' }
        })),
        executiveDecision: null, resourceBlockReason: null, commandId: null
    };
    ledger.routeProposals.push(proposal); ledger.revision++;
    return { ok: true, proposal: storyInfrastructureWorkClone(proposal) };
}

function storyInfrastructureRouteDecideCompanyProposal(proposalId, decision, options) {
    const ledger = storyInfrastructureWorkEnsure(options && options.root);
    const proposal = (ledger.routeProposals || []).find(row => row.id === String(proposalId));
    if (!proposal) return { ok: false, code: 'COMPANY_ROUTE_PROPOSAL_NOT_FOUND' };
    const actor = options && options.actor || storyInfrastructureRoutePlayerActor();
    if (!actor || actor.role !== 'EXECUTIVE' || actor.countryId !== proposal.countryId) {
        return { ok: false, code: 'EXECUTIVE_PROPOSAL_AUTHORITY_REQUIRED' };
    }
    if (!['PENDING_EXECUTIVE', 'RESOURCE_BLOCKED'].includes(proposal.status)) {
        return { ok: false, code: 'COMPANY_ROUTE_PROPOSAL_NOT_DECIDABLE' };
    }
    const verdict = String(decision || '').toUpperCase();
    const economy = storyInfrastructureWorkEconomy(options);
    const now = typeof STORY !== 'undefined' ? Number(STORY.clock) || 0 : 0;
    if (verdict === 'REJECT') {
        const rolled = economy.cashRollback('COMPANY', proposal.companyId,
            proposal.escrowReservation.cash, { reservationId: proposal.escrowReservation.id,
                proposalId: proposal.id, executiveActorId: actor.actorId });
        if (!rolled || !rolled.ok) {
            return rolled || { ok: false, code: 'PROPOSAL_ESCROW_RELEASE_FAILED' };
        }
        proposal.status = 'REJECTED'; proposal.updatedAt = now;
        proposal.escrowReservation.status = 'RELEASED';
        proposal.executiveDecision = { verdict, actorId: actor.actorId, decidedAt: now };
        ledger.revision++;
        return { ok: true, proposal: storyInfrastructureWorkClone(proposal) };
    }
    if (verdict !== 'APPROVE') return { ok: false, code: 'PROPOSAL_DECISION_INVALID' };
    const spec = storyInfrastructureWorkClone(proposal.spec);
    spec.permission = { approved: true, institutionId: 'institution:executive',
        decisionId: `infrastructure-proposal-approval:${proposal.id}`,
        authorityActorId: actor.actorId };
    const submitted = storyInfrastructureRouteReserveAndSubmit(spec, Object.assign({}, options, {
        preReservedCash: { reservationId: proposal.escrowReservation.id,
            proposalId: proposal.id, ownerId: proposal.companyId,
            cash: proposal.escrowReservation.cash }
    }));
    proposal.updatedAt = now;
    proposal.executiveDecision = { verdict, actorId: actor.actorId, decidedAt: now };
    if (!submitted.ok) {
        proposal.status = 'RESOURCE_BLOCKED';
        proposal.resourceBlockReason = String(submitted.code || 'ROUTE_RESOURCE_RESERVATION_FAILED');
        ledger.revision++;
        return { ok: false, code: proposal.resourceBlockReason,
            proposal: storyInfrastructureWorkClone(proposal) };
    }
    const started = storyInfrastructureRouteStart(submitted.command.id, options);
    if (!started.ok) {
        proposal.status = 'RESOURCE_BLOCKED'; proposal.resourceBlockReason = started.code;
        ledger.revision++;
        return { ok: false, code: started.code, proposal: storyInfrastructureWorkClone(proposal) };
    }
    proposal.status = 'COMMAND_CREATED'; proposal.commandId = started.command.id;
    proposal.resourceBlockReason = null; proposal.escrowReservation.status = 'BOUND_TO_COMMAND';
    ledger.revision++;
    return { ok: true, proposal: storyInfrastructureWorkClone(proposal), command: started.command };
}

function storyInfrastructureRoutePlayerDecideProposal(proposalId, decision) {
    const result = storyInfrastructureRouteDecideCompanyProposal(proposalId, decision);
    if (typeof storyCityDossierPanelReset === 'function') storyCityDossierPanelReset();
    return result;
}

function storyInfrastructureRouteEconomicAiRecord(ledger, input) {
    ledger.aiRouteDecisionSequence++;
    const row = Object.assign({
        id: `infrastructure-route-ai-decision:${ledger.aiRouteDecisionSequence}`,
        sequence: ledger.aiRouteDecisionSequence,
        at: typeof STORY !== 'undefined' ? Number(STORY.clock) || 0 : 0
    }, storyInfrastructureWorkClone(input || {}));
    ledger.aiRouteDecisions.push(row);
    if (ledger.aiRouteDecisions.length > STORY_INFRA_ROUTE_ECONOMIC_AI_POLICY.decisionHistoryLimit) {
        ledger.aiRouteDecisions.splice(0, ledger.aiRouteDecisions.length
            - STORY_INFRA_ROUTE_ECONOMIC_AI_POLICY.decisionHistoryLimit);
    }
    ledger.revision++;
    return row;
}

function storyInfrastructureRouteEconomicAiCompanies(options) {
    const source = options && options.companies
        || (typeof STORY !== 'undefined' && STORY.companyEconomy
            ? STORY.companyEconomy.companies : {});
    return (Array.isArray(source) ? source : Object.values(source || {}))
        .filter(company => company && company.status === 'OPERATING'
            && company.licenseStatus === 'LICENSED')
        .sort((a, b) => String(a.id).localeCompare(String(b.id), 'en'));
}

function storyInfrastructureRouteEconomicAiNodes(options) {
    return options && options.nodes
        || (typeof STORY !== 'undefined' ? STORY.nodes || [] : []);
}

function storyInfrastructureRouteEconomicAiRegional(regionId, options) {
    if (options && typeof options.regionalView === 'function') {
        return options.regionalView(String(regionId || '')) || null;
    }
    return typeof storyRegionalRegionView === 'function'
        ? storyRegionalRegionView(String(regionId || '')) : null;
}

function storyInfrastructureRouteEconomicAiTargetScore(company, origin, target, options) {
    const regional = storyInfrastructureRouteEconomicAiRegional(`region:${target.id}`, options);
    const shortages = regional && Array.isArray(regional.shortages) ? regional.shortages : [];
    const sectorResources = {
        agriculture: ['food'], energy: ['energy'],
        civil_industry: ['raw_materials', 'industrial_parts'],
        advanced_tech: ['electronics'], defense_industry: ['military_supplies']
    };
    const relevant = shortages.filter(row =>
        (sectorResources[String(company.sectorId || '')] || []).includes(row.resourceId));
    const distance = Math.hypot(Number(target.lx) - Number(origin.lx),
        Number(target.ly) - Number(origin.ly));
    const score = relevant.length * 2200 + shortages.length * 700
        + Math.min(1200, Math.max(0, Number(target.pop) || 0) * 4)
        - Math.min(1600, Math.round(distance * 3));
    return {
        score, reason: relevant.length ? 'SECTOR_SHORTAGE_CORRIDOR'
            : shortages.length ? 'MULTI_RESOURCE_LOGISTICS_PRESSURE' : 'NETWORK_EXPANSION',
        shortageCount: shortages.length, relevantShortageCount: relevant.length,
        distance: Math.round(distance * 100) / 100
    };
}

function storyInfrastructureRouteEconomicAiSpec(company, actor, origin, target, mode, options) {
    const fromRegionId = `region:${Number(origin.id)}`;
    const toRegionId = `region:${Number(target.id)}`;
    const base = {
        origin: 'ECONOMIC_AI', mode, fromRegionId, toRegionId,
        ownerType: 'COMPANY', ownerId: String(company.id),
        fundingRegionId: fromRegionId,
        permission: { approved: false, institutionId: '',
            decisionId: '', authorityActorId: '' },
        environmentalAssessment: {
            assessmentId: `institution:environmental-review:${company.countryId}`,
            mitigationId: 'policy:mandatory-restoration', restorationCash: 0
        }
    };
    const candidateFn = options && options.routeCandidate
        || storyInfrastructureRouteCandidate;
    const preview = candidateFn(base, options);
    if (!preview || !preview.pathCellIndices || !preview.pathCellIndices.length) {
        return { ok: false, code: preview && preview.blockReasons
            && preview.blockReasons[0] || 'NO_PHYSICAL_ROUTE', preview };
    }
    const nodes = storyInfrastructureRouteEconomicAiNodes(options);
    const ownRegions = [], foreignRegions = [];
    for (const regionId of preview.crossedRegionIds || []) {
        const id = storyInfrastructureRouteRegionNumber(regionId);
        if (nodes[id] && `country:${Number(nodes[id].owner)}` === String(company.countryId)) {
            ownRegions.push(regionId);
        } else foreignRegions.push(regionId);
    }
    const grants = Object.fromEntries(foreignRegions.map(regionId => [
        regionId, storyInfrastructureRightOfWayGrant(base, regionId, company.countryId, options)
    ]).filter(([, grant]) => !!grant));
    const unresolvedForeignRegionIds = foreignRegions.filter(regionId => !grants[regionId]);
    const spec = Object.assign({}, base, {
        rightOfWay: {
            evidenceByRegion: Object.assign(Object.fromEntries(ownRegions.map(regionId =>
                [regionId, `domestic-company-route-right:${company.countryId}:${regionId}`])),
            Object.fromEntries(Object.entries(grants).map(([regionId, grant]) =>
                [regionId, grant.grantEvidenceId]))),
            grantsByRegion: Object.fromEntries(Object.entries(grants).map(([regionId, grant]) =>
                [regionId, { requestId: grant.id, targetCountryId: grant.targetCountryId,
                    evidenceId: grant.grantEvidenceId,
                    compensationCash: Math.max(0, Number(grant.foreignDecision
                        && grant.foreignDecision.compensationCash) || 0) }])),
            compensationCash: Object.values(grants).reduce((sum, grant) =>
                sum + Math.max(0, Number(grant.foreignDecision
                    && grant.foreignDecision.compensationCash) || 0), 0)
        },
        portAuthority: {
            evidenceByRegion: Object.assign(Object.fromEntries(ownRegions.map(regionId =>
                [regionId, `national-port-authority:${regionId}`])),
            Object.fromEntries(Object.entries(grants).filter(([, grant]) =>
                grant.portAuthorityEvidenceId).map(([regionId, grant]) =>
                [regionId, grant.portAuthorityEvidenceId]))),
            dredgingPermitId: mode === 'SEA' ? 'national-dredging-permit' : ''
        }
    });
    const candidate = candidateFn(spec, options);
    return { ok: true, spec, candidate, preview, unresolvedForeignRegionIds,
        actor: storyInfrastructureWorkClone(actor) };
}

function storyInfrastructureRouteEconomicAiCounterTick(ledger, playerCountryId, options) {
    let responded = 0;
    const companies = storyInfrastructureRouteEconomicAiCompanies(options);
    for (const request of ledger.rightOfWayRequests || []) {
        if (request.status !== 'COUNTERED' || request.applicantCountryId === playerCountryId
            || !String(request.applicantActorId || '').startsWith('character:company-executive:')) continue;
        const company = companies.find(row =>
            `character:company-executive:${row.id}` === request.applicantActorId);
        if (!company) continue;
        const actor = { actorId: request.applicantActorId, countryId: company.countryId,
            role: 'COMPANY_EXECUTIVE', organizationId: company.id };
        const counter = Math.max(0, Number(request.counterOffer
            && request.counterOffer.compensationCash) || 0);
        const ceiling = Math.max(50,
            Math.max(0, Number(request.offeredCompensationCash) || 0) * 2 + 20);
        const action = counter <= ceiling ? 'ACCEPT' : 'REJECT';
        const result = storyInfrastructureRightOfWayCounterRespond(
            request.id, action, Object.assign({}, options, { actor }));
        if (!result.ok) continue;
        storyInfrastructureRouteEconomicAiRecord(ledger, {
            kind: 'RIGHT_OF_WAY_COUNTER', companyId: company.id,
            countryId: company.countryId, requestId: request.id,
            action, counterCash: counter, ceilingCash: ceiling
        });
        responded++;
    }
    return responded;
}

function storyInfrastructureRouteEconomicAiExecutiveTick(ledger, playerCountryId, options) {
    let reviewed = 0;
    const now = storyInfrastructureWorkClock(options);
    const delay = Math.max(0, Number(options && options.executiveReviewDelaySeconds)
        || STORY_INFRA_ROUTE_ECONOMIC_AI_POLICY.executiveReviewDelaySeconds);
    for (const proposal of ledger.routeProposals || []) {
        if (proposal.origin !== 'ECONOMIC_AI'
            || !['PENDING_EXECUTIVE', 'RESOURCE_BLOCKED'].includes(proposal.status)
            || proposal.countryId === playerCountryId
            || now + 1e-6 < Number(proposal.submittedAt || 0) + delay) continue;
        const actor = storyInfrastructureRightOfWayExecutive(proposal.countryId, options);
        const result = storyInfrastructureRouteDecideCompanyProposal(
            proposal.id, 'APPROVE', Object.assign({}, options, { actor }));
        storyInfrastructureRouteEconomicAiRecord(ledger, {
            kind: 'EXECUTIVE_REVIEW', proposalId: proposal.id,
            companyId: proposal.companyId, countryId: proposal.countryId,
            action: 'APPROVE', result: result.ok ? 'COMMAND_CREATED' : String(result.code || 'FAILED')
        });
        reviewed++;
    }
    return reviewed;
}

function storyInfrastructureRouteEconomicAiApply(company, options) {
    const ledger = storyInfrastructureWorkEnsure(options && options.root);
    if ((ledger.routeProposals || []).some(row => row.companyId === company.id
        && ['PENDING_EXECUTIVE', 'RESOURCE_BLOCKED'].includes(row.status))) {
        return { ok: false, code: 'COMPANY_ROUTE_PROPOSAL_ALREADY_OPEN' };
    }
    const nodes = storyInfrastructureRouteEconomicAiNodes(options);
    const facilities = options && typeof options.facilitiesForCompany === 'function'
        ? options.facilitiesForCompany(company) || []
        : (company.facilityIds || []).map(id => typeof STORY !== 'undefined'
            && STORY.companyEconomy && STORY.companyEconomy.facilities[id]).filter(Boolean);
    const origins = Array.from(new Set(facilities.map(row => String(row.regionId || ''))))
        .map(storyInfrastructureRouteRegionNumber).filter(id => id >= 0 && nodes[id])
        .map(id => nodes[id]).sort((a, b) => Number(a.id) - Number(b.id));
    if (!origins.length) return { ok: false, code: 'COMPANY_ROUTE_ORIGIN_UNAVAILABLE' };
    const actor = { actorId: `character:company-executive:${company.id}`,
        countryId: String(company.countryId), role: 'COMPANY_EXECUTIVE',
        organizationId: String(company.id) };
    const modes = ['advanced_tech', 'defense_industry', 'energy'].includes(company.sectorId)
        ? ['RAIL', 'LAND'] : ['LAND', 'RAIL'];
    for (const origin of origins) {
        const targets = nodes.filter(node => Number(node.id) !== Number(origin.id)
            && `country:${Number(node.owner)}` === String(company.countryId))
            .map(node => ({ node, policy: storyInfrastructureRouteEconomicAiTargetScore(
                company, origin, node, options) }))
            .sort((a, b) => b.policy.score - a.policy.score
                || a.policy.distance - b.policy.distance || Number(a.node.id) - Number(b.node.id))
            .slice(0, STORY_INFRA_ROUTE_ECONOMIC_AI_POLICY.maximumTargetCandidatesPerCompany);
        for (const target of targets) {
            if (target.policy.score < STORY_INFRA_ROUTE_ECONOMIC_AI_POLICY.minimumApplicationScore) {
                continue;
            }
            for (const mode of modes) {
                const resolved = storyInfrastructureRouteEconomicAiSpec(
                    company, actor, origin, target.node, mode, options);
                if (!resolved.ok) continue;
                const fatal = (resolved.candidate.blockReasons || []).filter(reason =>
                    reason !== 'AUTHORITY_APPROVAL_REQUIRED'
                    && !String(reason).startsWith('RIGHT_OF_WAY_REQUIRED:')
                    && !String(reason).startsWith('FOREIGN_RIGHT_OF_WAY_REQUIRED:')
                    && !String(reason).startsWith('PORT_AUTHORITY_REQUIRED:'));
                if (fatal.length) continue;
                if (resolved.unresolvedForeignRegionIds.length) {
                    const requirements = storyInfrastructureRouteRequirements(resolved.candidate)
                        || storyInfrastructureRouteRequirements(resolved.preview);
                    const offer = Math.max(10, Math.ceil(
                        Math.max(0, Number(requirements && requirements.cash) || 0) * .1));
                    const requests = resolved.unresolvedForeignRegionIds.map(regionId =>
                        storyInfrastructureRightOfWayRequest({
                            spec: resolved.spec, targetRegionId: regionId,
                            applicantActor: actor, compensationCash: offer,
                            sourceEvidence: { kind: 'INFRASTRUCTURE_DOSSIER',
                                id: `ai-route-dossier:${company.id}:${mode}:${origin.id}:${target.node.id}:${regionId}` }
                        }, options)).filter(result => result && result.ok);
                    return { ok: false, code: 'FOREIGN_RIGHT_OF_WAY_PENDING',
                        companyId: company.id, requests: requests.map(row => row.request),
                        policy: target.policy };
                }
                if (!resolved.candidate.ok
                    && (resolved.candidate.blockReasons || []).some(reason =>
                        reason !== 'AUTHORITY_APPROVAL_REQUIRED')) continue;
                resolved.spec.aiDecisionEvidence = storyInfrastructureWorkClone(target.policy);
                const result = storyInfrastructureRouteSubmitCompanyProposal(
                    resolved.spec, Object.assign({}, options, {
                        applicant: actor, company: () => company, origin: 'ECONOMIC_AI'
                    }));
                return Object.assign({}, result, { companyId: company.id,
                    policy: target.policy, mode, fromRegionId: resolved.spec.fromRegionId,
                    toRegionId: resolved.spec.toRegionId });
            }
        }
    }
    return { ok: false, code: 'NO_JUSTIFIED_PHYSICAL_ROUTE' };
}

function storyInfrastructureRouteEconomicAiTick(dtSec, options) {
    const ledger = storyInfrastructureWorkEnsure(options && options.root);
    if (typeof STORY === 'undefined' && !(options && options.root)) {
        return { disabled: true, applications: 0, reviews: 0 };
    }
    const secondsPerYear = Math.max(1, Number(options && options.secondsPerYear)
        || (typeof STORY_CALENDAR !== 'undefined' ? Number(STORY_CALENDAR.secondsPerYear) : 120) || 120);
    const worldDays = Math.max(0, Number(dtSec) || 0) * 365 / secondsPerYear;
    const playerCountryId = options && options.playerCountryId != null
        ? String(options.playerCountryId) : typeof STORY !== 'undefined'
            ? `country:${Number(STORY.playerStateId)}` : '';
    const counterResponses = storyInfrastructureRouteEconomicAiCounterTick(
        ledger, playerCountryId, options);
    const reviews = storyInfrastructureRouteEconomicAiExecutiveTick(
        ledger, playerCountryId, options);
    ledger.aiRouteElapsedDays += worldDays;
    if (ledger.aiRouteElapsedDays + 1e-6
        < STORY_INFRA_ROUTE_ECONOMIC_AI_POLICY.decisionIntervalDays) {
        return { disabled: false, applications: 0, reviews, counterResponses,
            waitingDays: ledger.aiRouteElapsedDays };
    }
    ledger.aiRouteElapsedDays -= STORY_INFRA_ROUTE_ECONOMIC_AI_POLICY.decisionIntervalDays;
    const playerOrganizationId = typeof STORY !== 'undefined' && STORY.commander
        ? String(STORY.commander.organizationId || '') : '';
    let applications = 0;
    const decisions = [];
    for (const company of storyInfrastructureRouteEconomicAiCompanies(options)) {
        if (applications >= STORY_INFRA_ROUTE_ECONOMIC_AI_POLICY.maximumApplicationsPerCycle) break;
        if (company.id === playerOrganizationId) continue;
        const result = storyInfrastructureRouteEconomicAiApply(company, options);
        decisions.push({ companyId: company.id, result: result.ok ? 'SUBMITTED' : result.code,
            proposalId: result.proposal && result.proposal.id || null });
        if (result.ok) {
            applications++;
            storyInfrastructureRouteEconomicAiRecord(ledger, {
                kind: 'COMPANY_APPLICATION', companyId: company.id,
                countryId: company.countryId, proposalId: result.proposal.id,
                mode: result.mode, fromRegionId: result.fromRegionId,
                toRegionId: result.toRegionId, policy: result.policy
            });
        } else if (result.code === 'FOREIGN_RIGHT_OF_WAY_PENDING') {
            storyInfrastructureRouteEconomicAiRecord(ledger, {
                kind: 'RIGHT_OF_WAY_APPLICATION', companyId: company.id,
                countryId: company.countryId,
                requestIds: (result.requests || []).map(row => row.id),
                policy: result.policy
            });
        }
    }
    return { disabled: false, applications, reviews, counterResponses, decisions };
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
            const posted = company && typeof storyCompanyPost === 'function'
                ? storyCompanyPost(company, 'infrastructure.work.complete', [
                    { account: 'EXPENSE:CAPACITY_INVESTMENT', amount: cash },
                    { account: 'ASSET:PROJECT_ESCROW', amount: -cash }
                ], details) : { ok: false, code: 'COMPANY_POSTING_UNAVAILABLE' };
            if (!posted || !posted.ok) return posted;
            const companyLedger = typeof storyCompanyEnsure === 'function'
                ? storyCompanyEnsure() : null;
            if (companyLedger) {
                const clearingCash = Math.max(0, cash
                    - Math.max(0, Number(details && details.compensationCash) || 0));
                companyLedger.marketClearingCash = Math.round(
                    ((Number(companyLedger.marketClearingCash) || 0) + clearingCash) * 1e6
                ) / 1e6;
            }
            if (!company.cumulative) company.cumulative = {};
            company.cumulative.expense = Math.round(
                ((Number(company.cumulative.expense) || 0) + cash) * 1e6
            ) / 1e6;
            company.cumulative.investment = Math.round(
                ((Number(company.cumulative.investment) || 0) + cash) * 1e6
            ) / 1e6;
            return posted;
        },
        compensationSettle: (targetCountryId, amount, details) =>
            typeof storyBudgetCredit === 'function'
                ? storyBudgetCredit(targetCountryId, amount,
                    'infrastructure.right_of_way.compensation', details)
                : { ok: false, code: 'STATE_BUDGET_UNAVAILABLE' },
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
    if (typeof storyRoutePlannerInvalidate === 'function') {
        storyRoutePlannerInvalidate({
            segmentIds: [segment.id],
            corridorIds: segment.corridorIds || []
        });
    }
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
        if (typeof storyRoutePlannerInvalidate === 'function') {
            storyRoutePlannerInvalidate({
                segmentIds: [segment.id],
                corridorIds: segment.corridorIds || []
            });
        }
    }
    for (const command of ledger.routeCommands || []) {
        if (command.status !== 'IN_PROGRESS') continue;
        command.remainingDays = Math.max(0,
            Math.round((command.remainingDays - days) * 1000) / 1000);
        if (command.remainingDays > 0) continue;
        const reservation = command.resourceReservation || {};
        const economy = storyInfrastructureWorkEconomy(options);
        if (!command.financialSettlement) {
            command.financialSettlement = { cashSettled: false, compensationRows: [] };
        }
        const financial = command.financialSettlement;
        if (!Array.isArray(financial.compensationRows)) financial.compensationRows = [];
        const compensationCash = financial.compensationRows.reduce((sum, row) =>
            sum + (row.status === 'CANCELLED' ? 0 : Math.max(0, Number(row.amount) || 0)), 0);
        if (!financial.cashSettled) {
            const settled = economy.cashSettle(
                reservation.ownerType, reservation.ownerId, Number(reservation.cash) || 0,
                { commandId: command.id, completion: true, route: true, compensationCash }
            );
            if (!settled || !settled.ok) {
                command.completionBlockedReason = settled && settled.code
                    || 'ROUTE_FINANCIAL_SETTLEMENT_FAILED';
                continue;
            }
            financial.cashSettled = true;
            financial.cashTransactionId = settled.transaction && settled.transaction.id || null;
        }
        let compensationBlocked = false;
        for (const row of financial.compensationRows) {
            if (row.status === 'PAID' || row.status === 'CANCELLED') continue;
            if (typeof economy.compensationSettle !== 'function') {
                command.completionBlockedReason = 'RIGHT_OF_WAY_SETTLEMENT_UNAVAILABLE';
                compensationBlocked = true;
                break;
            }
            const paid = economy.compensationSettle(row.targetCountryId,
                Math.max(0, Number(row.amount) || 0), {
                    commandId: command.id, requestId: row.requestId,
                    regionId: row.regionId, evidenceId: row.evidenceId
                });
            if (!paid || !paid.ok) {
                command.completionBlockedReason = paid && paid.code
                    || 'RIGHT_OF_WAY_SETTLEMENT_FAILED';
                compensationBlocked = true;
                break;
            }
            row.status = 'PAID';
            row.paidAt = typeof STORY !== 'undefined' ? Number(STORY.clock) || 0 : 0;
            row.transactionId = paid.transaction && paid.transaction.id || null;
        }
        if (compensationBlocked) continue;
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
            portSites: storyInfrastructureWorkClone(command.portSites || []),
            portAuthority: storyInfrastructureWorkClone(command.portAuthority || {}),
            consumed: storyInfrastructureWorkClone(command.resourceReservation),
            permissionDecisionId: command.permission.decisionId,
            completedAt: typeof STORY !== 'undefined' ? Number(STORY.clock) || 0 : 0
        };
        const route = {
            id: `infrastructure-route:${routeNumber}`,
            corridorId, receiptId: receipt.id, mode: command.mode,
            fromRegionId: command.fromRegionId, toRegionId: command.toRegionId,
            pathCellIndices: command.pathCellIndices.slice(),
            portSites: storyInfrastructureWorkClone(command.portSites || []),
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
        if (completedRoutes.some(receipt => receipt.mode === 'SEA')) {
            if (typeof storyHexSettlementsResetCache === 'function') storyHexSettlementsResetCache();
            if (typeof STORY !== 'undefined') STORY._hexRoadRegistry = null;
        }
        const graph = storyInfrastructureReset({
            generatedAt: typeof STORY !== 'undefined' ? Number(STORY.clock) || 0 : 0
        });
        // Route completion is an additive live catalog revision: every old
        // corridor and in-flight shipment remains valid. Advance the durable
        // sidecar revision links at this controlled boundary instead of
        // resetting their economic state or weakening restore validation.
        if (graph && typeof STORY !== 'undefined') {
            if (STORY.tradeLogistics) STORY.tradeLogistics.networkHash = graph.networkHash;
            if (STORY.marketPrices) STORY.marketPrices.networkHash = graph.networkHash;
        }
        if (typeof storyHexInfrastructureReset === 'function') storyHexInfrastructureReset();
    }
    return { ok: true, processedDays: days, completed, completedRoutes };
}

function storyInfrastructureWorkTickSeconds(dtSec, options) {
    storyInfrastructureRightOfWayAiTick(options);
    storyInfrastructureRouteEconomicAiTick(dtSec, options);
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
    if (!Array.isArray(candidate.routeProposals)) candidate.routeProposals = [];
    if (!Array.isArray(candidate.rightOfWayRequests)) candidate.rightOfWayRequests = [];
    if (!Array.isArray(candidate.aiRouteDecisions)) candidate.aiRouteDecisions = [];
    candidate.proposalSequence = Math.max(0, Number(candidate.proposalSequence) || 0);
    candidate.rightOfWaySequence = Math.max(0, Number(candidate.rightOfWaySequence) || 0);
    candidate.aiRouteElapsedDays = Math.max(0, Number(candidate.aiRouteElapsedDays) || 0);
    candidate.aiRouteDecisionSequence = Math.max(0,
        Number(candidate.aiRouteDecisionSequence) || 0);
    if (!Array.isArray(candidate.routes)) candidate.routes = [];
    if (Number(candidate.schemaVersion) !== STORY_INFRA_WORK_SCHEMA_VERSION
        || candidate.adapterVersion !== STORY_INFRA_WORK_ADAPTER_VERSION
        || !Array.isArray(candidate.commands) || !Array.isArray(candidate.receipts)
        || candidate.commands.concat(candidate.routeCommands)
            .some(command => !command || !STORY_INFRA_WORK_STATUSES.includes(command.status))
        || candidate.routeProposals.some(proposal => !proposal
            || !STORY_INFRA_ROUTE_PROPOSAL_STATUSES.includes(proposal.status))
        || candidate.rightOfWayRequests.some(request => !request
            || !STORY_INFRA_RIGHT_OF_WAY_STATUSES.includes(request.status)
            || !request.routeKey || !request.targetRegionId
            || !request.applicantCountryId || !request.targetCountryId)) {
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
    storyInfrastructureRoutePlayerView,
    storyInfrastructureRoutePlayerChooseMode,
    storyInfrastructureRoutePlayerSetTargetFilter,
    storyInfrastructureRoutePlayerSelect,
    storyInfrastructureRoutePlayerCancelDraft,
    storyInfrastructureRoutePlayerSubmitDraft,
    storyInfrastructureRightOfWayRequest,
    storyInfrastructureRightOfWayDecide,
    storyInfrastructureRightOfWayCounterRespond,
    storyInfrastructureRightOfWayPlayerRespondCounter,
    storyInfrastructureRightOfWayEvidenceCandidates,
    storyInfrastructureRightOfWayRevoke,
    storyInfrastructureRightOfWayAiEvaluate,
    storyInfrastructureRightOfWayAiTick,
    storyInfrastructureRightOfWayPlayerRequest,
    storyInfrastructureRightOfWayGrant,
    storyInfrastructureRouteSubmitCompanyProposal,
    storyInfrastructureRouteDecideCompanyProposal,
    storyInfrastructureRoutePlayerDecideProposal,
    storyInfrastructureRouteEconomicAiApply,
    storyInfrastructureRouteEconomicAiTick,
    storyInfrastructureRouteCorridorDefinitions,
    storyInfrastructureWorkStart,
    storyInfrastructureWorkTick,
    storyInfrastructureWorkForSave,
    storyInfrastructureWorkRestore
};
