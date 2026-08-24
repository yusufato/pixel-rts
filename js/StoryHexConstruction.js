// ═══════════════════════════════════════════════════════════════════════════
//  FİZİKSEL İMAR VE İNŞAAT DEFTERİ — HXD-6.8
//  ---------------------------------------------------------------------------
//  Yeni konut, sanayi ve lojistik alanlarını soyut `level + 1` yerine gerçek
//  bir altıgene bağlayan kalıcı komut sözleşmesi. Bu katman karar üretmez:
//  arazi edinimi, yetkili kurum kararı, para/malzeme ve iş gücü kanıtlanmadan
//  inşaat başlamaz. LLM hiçbir alanı onaylayamaz veya miktar üretemez.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_HEX_CONSTRUCTION_SCHEMA_VERSION = 1;
const STORY_HEX_CONSTRUCTION_ADAPTER_VERSION = 'story-hex-construction-command-1';
const STORY_HEX_CONSTRUCTION_TYPES = Object.freeze(['RESIDENTIAL', 'INDUSTRIAL', 'LOGISTICS']);
const STORY_HEX_CONSTRUCTION_STATUSES = Object.freeze([
    'AWAITING_REQUIREMENTS', 'AUTHORIZED', 'BUILDING', 'COMPLETED', 'CANCELLED'
]);
const STORY_HEX_CONSTRUCTION_APPLICATION_STATUSES = Object.freeze([
    'PENDING_AUTHORITY', 'AUTHORIZED', 'REJECTED', 'RESOURCE_BLOCKED',
    'COMMAND_CREATED', 'CANCELLED'
]);
const STORY_HEX_CONSTRUCTION_POLICY = Object.freeze({
    RESIDENTIAL: Object.freeze({ cash: 90, materials: Object.freeze({ raw_materials: 18, industrial_parts: 12 }), workforce: 80, durationDays: 120, capacity: 1, environmentalCost: 4 }),
    INDUSTRIAL: Object.freeze({ cash: 160, materials: Object.freeze({ raw_materials: 30, industrial_parts: 24, electronics: 2 }), workforce: 120, durationDays: 180, capacity: 1, environmentalCost: 12 }),
    LOGISTICS: Object.freeze({ cash: 120, materials: Object.freeze({ raw_materials: 22, industrial_parts: 16, electronics: 1 }), workforce: 90, durationDays: 150, capacity: 1, environmentalCost: 7 })
});
const STORY_HEX_CONSTRUCTION_INDUSTRIAL_SECTORS = Object.freeze([
    'energy', 'civil_industry', 'advanced_tech', 'defense_industry'
]);
const STORY_HEX_CONSTRUCTION_LAND_COST = Object.freeze({
    RESIDENTIAL: 10, INDUSTRIAL: 20, LOGISTICS: 15
});
const STORY_HEX_CONSTRUCTION_APPLICATION_POLICY = Object.freeze({
    authorityReviewDays: 30,
    economicAIDecisionIntervalDays: 90,
    maximumOpenApplicationsPerRegion: 3,
    maximumEconomicAIApplicationsPerCycle: 1
});

function storyHexConstructionClone(value) {
    if (value == null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.slice();
    return Object.assign({}, value);
}

function storyHexConstructionRegionNumber(regionId) {
    const match = /^region:(\d+)$/.exec(String(regionId || ''));
    return match ? Number(match[1]) : -1;
}

function storyHexConstructionCellId(world, index) {
    if (!world || !Number.isInteger(index) || index < 0 || index >= Number(world.cellCount)) return null;
    const q = Number(world.qValues[index]), r = Number(world.rValues[index]);
    return typeof storyHexWorldId === 'function' ? storyHexWorldId(q, r) : `hex:${q}:${r}`;
}

function storyHexConstructionCellIndex(world, cellId) {
    const match = /^hex:(-?\d+):(-?\d+)$/.exec(String(cellId || ''));
    if (!world || !match) return -1;
    const q = Number(match[1]), r = Number(match[2]);
    if (world.indexById && Number.isInteger(world.indexById[cellId])) return Number(world.indexById[cellId]);
    for (let index = 0; index < Number(world.cellCount); index++) {
        if (Number(world.qValues[index]) === q && Number(world.rValues[index]) === r) return index;
    }
    return -1;
}

function storyHexConstructionContext(options) {
    const opts = options || {};
    return {
        world: opts.world || (typeof storyHexWorldEnsure === 'function' ? storyHexWorldEnsure() : null),
        geography: opts.geography || (typeof storyHexGeographyEnsure === 'function' ? storyHexGeographyEnsure() : null),
        natural: opts.natural || (typeof storyHexNaturalResourcesEnsure === 'function' ? storyHexNaturalResourcesEnsure() : null),
        sites: opts.sites || (typeof storyHexSitesEnsure === 'function' ? storyHexSitesEnsure() : null),
        clock: Number.isFinite(Number(opts.clock)) ? Number(opts.clock)
            : (typeof STORY !== 'undefined' ? Number(STORY.clock) || 0 : 0)
    };
}

function storyHexConstructionEnvironment(context, index, spec) {
    const natural = context.natural;
    const coverNames = typeof STORY_HEX_NATURAL_COVER_NAMES !== 'undefined'
        ? STORY_HEX_NATURAL_COVER_NAMES : ['WATER', 'COAST', 'OPEN_LAND', 'FOREST', 'MOUNTAIN', 'DRYLAND'];
    const cover = natural && natural.coverCodes
        ? coverNames[Number(natural.coverCodes[index])] || 'UNKNOWN' : 'UNKNOWN';
    const deposit = natural && (natural.deposits || []).find(row => Number(row.cellIndex) === index);
    const forestClearing = cover === 'FOREST';
    const mitigation = spec && spec.environmentalMitigation || {};
    return {
        naturalCover: cover,
        forestClearing,
        depositId: deposit && deposit.id || null,
        protectedResource: !!deposit,
        assessmentId: String(spec && spec.environmentalAssessmentId || ''),
        mitigationId: String(mitigation.id || ''),
        restorationBudget: Math.max(0, Number(mitigation.restorationBudget) || 0)
    };
}

function storyHexConstructionPreflight(spec, options) {
    spec = spec || {};
    const context = storyHexConstructionContext(options);
    const world = context.world, geography = context.geography;
    const projectType = String(spec.projectType || '').toUpperCase();
    const policy = STORY_HEX_CONSTRUCTION_POLICY[projectType] || null;
    const regionId = String(spec.regionId || '');
    const regionNumber = storyHexConstructionRegionNumber(regionId);
    const cellIndex = Number.isInteger(Number(spec.targetCellIndex))
        ? Number(spec.targetCellIndex) : storyHexConstructionCellIndex(world, spec.targetCellId);
    const targetCellId = storyHexConstructionCellId(world, cellIndex);
    const blocks = [];
    if (!policy) blocks.push('PROJECT_TYPE_INVALID');
    if (!world || !geography) blocks.push('HEX_CONTEXT_UNAVAILABLE');
    if (!targetCellId) blocks.push('TARGET_CELL_INVALID');
    if (regionNumber < 0) blocks.push('REGION_INVALID');
    if (targetCellId && geography) {
        if (Number(geography.regionIds && geography.regionIds[cellIndex]) !== regionNumber) blocks.push('TARGET_REGION_MISMATCH');
        if (Number(geography.landCoverageBps && geography.landCoverageBps[cellIndex]) < 5000) blocks.push('TARGET_NOT_LAND');
        const terrain = Number(geography.terrainClass && geography.terrainClass[cellIndex]);
        if (terrain === 0) blocks.push('TARGET_WATER');
        if (terrain === 3) blocks.push('TARGET_IMPASSABLE');
    }
    const occupied = context.sites && context.sites.landUseByCellId
        && context.sites.landUseByCellId[targetCellId];
    if (occupied) blocks.push('TARGET_OCCUPIED');
    const environment = targetCellId
        ? storyHexConstructionEnvironment(context, cellIndex, spec)
        : { naturalCover: 'UNKNOWN', forestClearing: false, depositId: null, protectedResource: false, assessmentId: '', mitigationId: '', restorationBudget: 0 };
    if (environment.protectedResource) blocks.push('RESOURCE_DEPOSIT_CONFLICT');
    if (environment.naturalCover === 'MOUNTAIN') blocks.push('MOUNTAIN_CONSTRUCTION_FORBIDDEN');
    if (environment.forestClearing && (!environment.assessmentId || !environment.mitigationId)) {
        blocks.push('FOREST_CLEARING_ASSESSMENT_REQUIRED');
    }
    const acquisition = spec.landAcquisition || {};
    const acquisitionMode = String(acquisition.mode || '').toUpperCase();
    if (!['PURCHASE', 'LEASE', 'PUBLIC_ALLOCATION'].includes(acquisitionMode)) blocks.push('LAND_ACQUISITION_REQUIRED');
    if (!String(acquisition.evidenceId || '')) blocks.push('LAND_ACQUISITION_EVIDENCE_REQUIRED');
    const permission = spec.permission || {};
    if (!String(permission.authorityActorId || '') || !String(permission.institutionId || '')
        || !String(permission.decisionId || '') || permission.approved !== true) blocks.push('AUTHORITY_APPROVAL_REQUIRED');
    const reservation = spec.resourceReservation || {};
    const requiredCash = policy ? policy.cash + Math.max(0, Number(acquisition.cost) || 0) : 0;
    if (!String(reservation.id || '')) blocks.push('RESOURCE_RESERVATION_REQUIRED');
    if (policy && Number(reservation.cash) < requiredCash) blocks.push('CASH_RESERVATION_INSUFFICIENT');
    for (const [resourceId, quantity] of Object.entries(policy && policy.materials || {})) {
        if (Number(reservation.materials && reservation.materials[resourceId]) < quantity) {
            blocks.push(`MATERIAL_RESERVATION_INSUFFICIENT:${resourceId}`);
        }
    }
    if (policy && Number(reservation.workforce) < policy.workforce) blocks.push('WORKFORCE_RESERVATION_INSUFFICIENT');
    const uniqueBlocks = Array.from(new Set(blocks));
    return {
        ok: uniqueBlocks.length === 0,
        adapterVersion: STORY_HEX_CONSTRUCTION_ADAPTER_VERSION,
        projectType,
        regionId,
        cityId: regionNumber,
        targetCellId,
        targetCellIndex: cellIndex,
        applicantActorId: String(spec.applicantActorId || ''),
        companyId: spec.companyId == null ? null : String(spec.companyId),
        countryId: spec.countryId == null ? null : String(spec.countryId),
        landAcquisition: {
            mode: acquisitionMode,
            evidenceId: String(acquisition.evidenceId || ''),
            cost: Math.max(0, Number(acquisition.cost) || 0)
        },
        permission: {
            approved: permission.approved === true,
            authorityActorId: String(permission.authorityActorId || ''),
            institutionId: String(permission.institutionId || ''),
            decisionId: String(permission.decisionId || '')
        },
        requirements: policy ? {
            constructionCash: policy.cash,
            landCash: Math.max(0, Number(acquisition.cost) || 0),
            cash: requiredCash,
            materials: Object.assign({}, policy.materials),
            workforce: policy.workforce,
            durationDays: policy.durationDays,
            capacity: policy.capacity,
            environmentalCost: policy.environmentalCost
        } : null,
        resourceReservation: {
            id: String(reservation.id || ''),
            cash: Math.max(0, Number(reservation.cash) || 0),
            materials: Object.assign({}, reservation.materials || {}),
            workforce: Math.max(0, Number(reservation.workforce) || 0)
        },
        environment,
        blockReasons: uniqueBlocks
    };
}

function storyHexConstructionEnsureLedger(root) {
    const state = root || (typeof STORY !== 'undefined' ? STORY : null);
    if (!state) throw new Error('STORY_HEX_CONSTRUCTION_STATE_REQUIRED');
    if (!state.hexConstruction || Number(state.hexConstruction.schemaVersion) !== STORY_HEX_CONSTRUCTION_SCHEMA_VERSION) {
        state.hexConstruction = {
            schemaVersion: STORY_HEX_CONSTRUCTION_SCHEMA_VERSION,
            adapterVersion: STORY_HEX_CONSTRUCTION_ADAPTER_VERSION,
            version: 0,
            commandSequence: 0,
            applicationSequence: 0,
            reservationSequence: 0,
            receiptSequence: 0,
            economicAIElapsedDays: 0,
            economicAIDecisionSequence: 0,
            applications: [],
            commands: [],
            receipts: [],
            commissionedCapacityByRegion: {}
        };
    }
    if (!Array.isArray(state.hexConstruction.applications)) state.hexConstruction.applications = [];
    state.hexConstruction.version = Math.max(0, Number(state.hexConstruction.version) || 0);
    state.hexConstruction.economicAIElapsedDays = Math.max(0,
        Number(state.hexConstruction.economicAIElapsedDays) || 0);
    state.hexConstruction.economicAIDecisionSequence = Math.max(0,
        Number(state.hexConstruction.economicAIDecisionSequence) || 0);
    state.hexConstruction.applicationSequence = Math.max(0,
        Number(state.hexConstruction.applicationSequence) || state.hexConstruction.applications.length);
    return state.hexConstruction;
}

function storyHexConstructionTouch(ledger) {
    ledger.version = Math.max(0, Number(ledger.version) || 0) + 1;
}

function storyHexConstructionCandidateBlock(index, projectType, regionId, context, ledger) {
    const world = context.world, geography = context.geography;
    const cellId = storyHexConstructionCellId(world, index);
    const reasons = [];
    if (!STORY_HEX_CONSTRUCTION_POLICY[projectType]) reasons.push('PROJECT_TYPE_INVALID');
    if (!cellId) reasons.push('TARGET_CELL_INVALID');
    if (Number(geography.regionIds && geography.regionIds[index])
        !== storyHexConstructionRegionNumber(regionId)) reasons.push('TARGET_REGION_MISMATCH');
    if (Number(geography.landCoverageBps && geography.landCoverageBps[index]) < 5000) reasons.push('TARGET_NOT_LAND');
    const terrain = Number(geography.terrainClass && geography.terrainClass[index]);
    if (terrain === 0) reasons.push('TARGET_WATER');
    if (terrain === 3) reasons.push('TARGET_IMPASSABLE');
    const environment = storyHexConstructionEnvironment(context, index, {});
    if (environment.protectedResource) reasons.push('RESOURCE_DEPOSIT_CONFLICT');
    if (environment.naturalCover === 'MOUNTAIN') reasons.push('MOUNTAIN_CONSTRUCTION_FORBIDDEN');
    if (context.sites && context.sites.landUseByCellId
        && context.sites.landUseByCellId[cellId]) reasons.push('TARGET_OCCUPIED');
    if ((ledger.commands || []).some(row => row.targetCellId === cellId && row.status !== 'CANCELLED')) {
        reasons.push('CONSTRUCTION_TARGET_RESERVED');
    }
    if ((ledger.applications || []).some(row => row.targetCellId === cellId
        && !['REJECTED', 'CANCELLED'].includes(row.status))) reasons.push('APPLICATION_TARGET_RESERVED');
    return { cellId, reasons: Array.from(new Set(reasons)), environment };
}

function storyHexConstructionCandidates(regionId, projectType, options) {
    const context = storyHexConstructionContext(options);
    const root = options && options.root || (typeof STORY !== 'undefined' ? STORY : null);
    const ledger = root && root.hexConstruction || { applications: [], commands: [] };
    const type = String(projectType || '').toUpperCase();
    if (!context.world || !context.geography || !STORY_HEX_CONSTRUCTION_POLICY[type]) return [];
    const rows = [];
    let centerQ = 0, centerR = 0, count = 0;
    for (let index = 0; index < Number(context.world.cellCount); index++) {
        if (Number(context.geography.regionIds[index]) !== storyHexConstructionRegionNumber(regionId)) continue;
        centerQ += Number(context.world.qValues[index]);
        centerR += Number(context.world.rValues[index]);
        count++;
    }
    centerQ /= Math.max(1, count); centerR /= Math.max(1, count);
    for (let index = 0; index < Number(context.world.cellCount); index++) {
        const checked = storyHexConstructionCandidateBlock(index, type, String(regionId), context, ledger);
        if (checked.reasons.length) continue;
        const q = Number(context.world.qValues[index]), r = Number(context.world.rValues[index]);
        const distance = Math.abs(q - centerQ) + Math.abs(r - centerR)
            + Math.abs((q + r) - (centerQ + centerR));
        const forestPenalty = checked.environment.forestClearing ? 1000 : 0;
        rows.push({
            regionId: String(regionId), projectType: type,
            targetCellId: checked.cellId, targetCellIndex: index,
            score: Math.round((100000 - distance * 100 - forestPenalty) * 1000) / 1000,
            naturalCover: checked.environment.naturalCover,
            requiresEnvironmentalAssessment: checked.environment.forestClearing,
            evidence: ['REGION_MATCH', 'BUILDABLE_LAND', 'NO_SITE_COLLISION', 'NO_RESOURCE_COLLISION']
        });
    }
    return rows.sort((a, b) => b.score - a.score || a.targetCellIndex - b.targetCellIndex)
        .slice(0, Math.max(1, Math.min(50, Number(options && options.limit) || 12)));
}

function storyHexConstructionAuthority(options) {
    if (options && options.authority) return options.authority;
    return {
        submit: spec => {
            if (typeof storyInstitutionRegionView !== 'function'
                || typeof storyInstitutionSubmitAction !== 'function') {
                return { ok: false, status: 'DISABLED', reason: 'INSTITUTION_AUTHORITY_UNAVAILABLE' };
            }
            const region = storyInstitutionRegionView(spec.regionId);
            const office = region && region.institution && region.institution.officeHolder;
            if (!region || !region.institution || !office) {
                return { ok: false, status: 'DENIED', reason: 'LOCAL_AUTHORITY_NOT_FOUND' };
            }
            return storyInstitutionSubmitAction({
                countryId: spec.countryId || region.countryId,
                actionType: 'ISSUE_LOCAL_ORDER', targetRegionId: spec.regionId,
                institutionId: region.institution.id, actorId: office.actorId
            });
        },
        get: requestId => {
            const request = typeof STORY !== 'undefined' && STORY.institutions
                && STORY.institutions.requests && STORY.institutions.requests[String(requestId)];
            return request ? storyHexConstructionClone(request) : null;
        },
        progress: requestId => {
            if (typeof STORY === 'undefined' || !STORY.institutions
                || typeof storyInstitutionApproveAction !== 'function'
                || typeof storyInstitutionExecuteAction !== 'function') {
                return { ok: false, code: 'INSTITUTION_AUTHORITY_UNAVAILABLE' };
            }
            let request = STORY.institutions.requests[String(requestId)];
            if (!request) return { ok: false, code: 'AUTHORITY_REQUEST_NOT_FOUND' };
            const country = STORY.institutions.countries[request.countryId];
            if (!country) return { ok: false, code: 'AUTHORITY_COUNTRY_NOT_FOUND' };
            for (const institutionId of (request.requiredInstitutionIds || [])) {
                if ((request.approvalInstitutionIds || []).includes(institutionId)) continue;
                const institution = country.institutions && country.institutions[institutionId];
                if (!institution || !institution.officeHolder) {
                    return { ok: false, code: 'REQUIRED_AUTHORITY_OFFICE_VACANT' };
                }
                const approved = storyInstitutionApproveAction(request.id, {
                    institutionId: institution.id,
                    actorId: institution.officeHolder.actorId
                });
                if (!approved.ok) return { ok: false, code: approved.reason || approved.status };
                request = STORY.institutions.requests[String(requestId)];
            }
            if (request.status !== 'AUTHORIZED') return { ok: false, code: request.status };
            let executorInput = null;
            if (request.executorInstitutionId) {
                const executor = country.institutions && country.institutions[request.executorInstitutionId];
                if (executor && executor.officeHolder) executorInput = {
                    institutionId: executor.id, actorId: executor.officeHolder.actorId
                };
            } else if (request.proposer && request.proposer.sourceKind === 'INSTITUTION') {
                executorInput = { institutionId: request.proposer.sourceId,
                    actorId: request.proposer.actorId };
            } else if (request.proposer && request.proposer.sourceKind === 'POWER_CENTER') {
                executorInput = { powerCenterId: request.proposer.sourceId,
                    actorId: request.proposer.actorId };
            }
            if (!executorInput) return { ok: false, code: 'AUTHORITY_EXECUTOR_UNAVAILABLE' };
            const executed = storyInstitutionExecuteAction(request.id, executorInput);
            return executed.ok ? { ok: true, request: executed.request }
                : { ok: false, code: executed.reason || executed.status };
        }
    };
}

function storyHexConstructionSubmitApplication(spec, options) {
    spec = spec || {};
    const context = storyHexConstructionContext(options);
    const ledger = storyHexConstructionEnsureLedger(options && options.root);
    const projectType = String(spec.projectType || '').toUpperCase();
    const regionId = String(spec.regionId || '');
    const targetCellIndex = Number.isInteger(Number(spec.targetCellIndex))
        ? Number(spec.targetCellIndex) : storyHexConstructionCellIndex(context.world, spec.targetCellId);
    const checked = context.world && context.geography
        ? storyHexConstructionCandidateBlock(targetCellIndex, projectType, regionId, context, ledger)
        : { cellId: null, reasons: ['HEX_CONTEXT_UNAVAILABLE'], environment: {} };
    if (checked.reasons.length) return { ok: false, code: checked.reasons[0], reasons: checked.reasons };
    if (!String(spec.applicantActorId || '')) return { ok: false, code: 'APPLICANT_ACTOR_REQUIRED' };
    const origin = String(spec.origin || '').toUpperCase();
    if (!['PLAYER', 'ECONOMIC_AI'].includes(origin)) {
        return { ok: false, code: 'APPLICATION_ORIGIN_INVALID' };
    }
    if (typeof storyCharacterIdentityView === 'function') {
        const identity = storyCharacterIdentityView(String(spec.applicantActorId));
        if (!identity || !['COMPANY_OWNER', 'COMPANY_EXECUTIVE'].includes(String(identity.role).toUpperCase())
            || String(identity.organizationId || '') !== String(spec.companyId || '')) {
            return { ok: false, code: 'APPLICANT_COMPANY_AUTHORITY_MISMATCH' };
        }
    }
    if (origin === 'PLAYER' && typeof STORY !== 'undefined') {
        const player = storyHexConstructionPlayerActor();
        if (!player || player.actorId !== String(spec.applicantActorId)
            || player.organizationId !== String(spec.companyId || '')) {
            return { ok: false, code: 'PLAYER_APPLICATION_IDENTITY_MISMATCH' };
        }
    }
    if (typeof storyCompanyById === 'function') {
        const company = storyCompanyById(String(spec.companyId || ''));
        if (!company || company.countryId !== String(spec.countryId || '')) {
            return { ok: false, code: 'APPLICATION_COMPANY_COUNTRY_MISMATCH' };
        }
    }
    if (checked.environment.forestClearing
        && (!String(spec.environmentalAssessmentId || '')
            || !String(spec.environmentalMitigation && spec.environmentalMitigation.id || ''))) {
        return { ok: false, code: 'FOREST_CLEARING_ASSESSMENT_REQUIRED' };
    }
    const authority = storyHexConstructionAuthority(options);
    const submitted = authority.submit(Object.assign({}, spec, {
        projectType, regionId, targetCellId: checked.cellId, targetCellIndex
    }));
    if (!submitted || !submitted.ok || !submitted.request) return {
        ok: false, code: submitted && (submitted.reason || submitted.status)
            || 'AUTHORITY_SUBMISSION_FAILED'
    };
    ledger.applicationSequence++;
    const application = {
        id: `hex-construction-application:${ledger.applicationSequence}`,
        correlationId: String(spec.correlationId || `hex-construction-application:${ledger.applicationSequence}`),
        origin, projectType, regionId,
        countryId: String(spec.countryId || submitted.request.countryId || ''),
        targetCellId: checked.cellId, targetCellIndex,
        applicantActorId: String(spec.applicantActorId),
        companyId: spec.companyId == null ? null : String(spec.companyId),
        status: submitted.request.status === 'EXECUTED' ? 'AUTHORIZED' : 'PENDING_AUTHORITY',
        authorityRequestId: String(submitted.request.id),
        authorityStatus: String(submitted.request.status),
        rejectionReason: null, resourceBlockReason: null, commandId: null,
        submittedAt: context.clock, updatedAt: context.clock,
        spec: storyHexConstructionClone(Object.assign({}, spec, {
            projectType, regionId, targetCellId: checked.cellId, targetCellIndex
        }))
    };
    ledger.applications.push(application);
    storyHexConstructionTouch(ledger);
    return { ok: true, application: storyHexConstructionClone(application) };
}

function storyHexConstructionSyncApplication(applicationId, options) {
    const ledger = storyHexConstructionEnsureLedger(options && options.root);
    const application = ledger.applications.find(row => row.id === String(applicationId));
    if (!application) return { ok: false, code: 'CONSTRUCTION_APPLICATION_NOT_FOUND' };
    if (['REJECTED', 'CANCELLED', 'COMMAND_CREATED'].includes(application.status)) {
        return { ok: true, application: storyHexConstructionClone(application), idempotent: true };
    }
    const request = storyHexConstructionAuthority(options).get(application.authorityRequestId);
    if (!request) return { ok: false, code: 'AUTHORITY_REQUEST_NOT_FOUND' };
    application.authorityStatus = String(request.status || 'UNKNOWN');
    application.updatedAt = storyHexConstructionContext(options).clock;
    if (['DENIED', 'CANCELLED', 'STALE_AUTHORITY'].includes(request.status)) {
        application.status = 'REJECTED';
        application.rejectionReason = String(request.result && request.result.reasonCode
            || request.status);
        storyHexConstructionTouch(ledger);
        return { ok: true, application: storyHexConstructionClone(application) };
    }
    if (request.status !== 'EXECUTED') {
        application.status = 'PENDING_AUTHORITY';
        storyHexConstructionTouch(ledger);
        return { ok: true, application: storyHexConstructionClone(application) };
    }
    if (request.actionType !== 'ISSUE_LOCAL_ORDER'
        || String(request.targetRegionId) !== application.regionId
        || String(request.countryId) !== application.countryId) {
        application.status = 'REJECTED';
        application.rejectionReason = 'AUTHORITY_DECISION_SCOPE_MISMATCH';
        storyHexConstructionTouch(ledger);
        return { ok: true, application: storyHexConstructionClone(application) };
    }
    application.status = 'AUTHORIZED';
    const authorityActorId = String(request.executedByActorId
        || request.proposer && request.proposer.actorId || '');
    const institutionId = String(request.executorInstitutionId
        || request.proposer && request.proposer.sourceId || '');
    const commandSpec = Object.assign({}, application.spec, {
        correlationId: application.correlationId,
        permission: { approved: true, authorityActorId, institutionId,
            decisionId: application.authorityRequestId }
    });
    const submitted = storyHexConstructionReserveAndSubmit(commandSpec, options);
    if (!submitted.ok) {
        application.status = 'RESOURCE_BLOCKED';
        application.resourceBlockReason = String(submitted.code || 'RESOURCE_RESERVATION_FAILED');
        storyHexConstructionTouch(ledger);
        return { ok: true, application: storyHexConstructionClone(application), command: null };
    }
    const started = storyHexConstructionStart(submitted.command.id, options);
    application.status = 'COMMAND_CREATED';
    application.commandId = submitted.command.id;
    application.resourceBlockReason = started.ok ? null : String(started.code || 'CONSTRUCTION_START_FAILED');
    storyHexConstructionTouch(ledger);
    return { ok: true, application: storyHexConstructionClone(application),
        command: started.ok ? started.command : submitted.command };
}

function storyHexConstructionSyncApplications(options) {
    const ledger = storyHexConstructionEnsureLedger(options && options.root);
    const authority = storyHexConstructionAuthority(options);
    const context = storyHexConstructionContext(options);
    const secondsPerYear = typeof STORY_CALENDAR !== 'undefined'
        ? Number(STORY_CALENDAR.secondsPerYear) || 120 : 120;
    const reviewSeconds = STORY_HEX_CONSTRUCTION_APPLICATION_POLICY.authorityReviewDays
        / 365 * secondsPerYear;
    const results = [];
    for (const application of ledger.applications.slice()) {
        if (!['PENDING_AUTHORITY', 'AUTHORIZED', 'RESOURCE_BLOCKED'].includes(application.status)) continue;
        if (application.status === 'PENDING_AUTHORITY'
            && context.clock - Number(application.submittedAt || 0) + 1e-6 >= reviewSeconds
            && typeof authority.progress === 'function') {
            const progressed = authority.progress(application.authorityRequestId, application);
            if (!progressed.ok) application.authorityProgressBlock = String(progressed.code || 'AUTHORITY_PROGRESS_FAILED');
            else application.authorityProgressBlock = null;
        }
        results.push(storyHexConstructionSyncApplication(application.id, options));
    }
    return results;
}

function storyHexConstructionRegionView(regionId, root) {
    const state = root || (typeof STORY !== 'undefined' ? STORY : null);
    const ledger = state && state.hexConstruction
        || { applications: [], commands: [], receipts: [] };
    return {
        regionId: String(regionId),
        applications: storyHexConstructionClone((ledger.applications || [])
            .filter(row => row.regionId === String(regionId))),
        commands: storyHexConstructionClone((ledger.commands || [])
            .filter(row => row.regionId === String(regionId))),
        receipts: storyHexConstructionClone((ledger.receipts || [])
            .filter(row => row.regionId === String(regionId)))
    };
}

function storyHexConstructionPlayerActor() {
    if (typeof STORY === 'undefined' || !STORY.commander) return null;
    const countryId = `country:${Number(STORY.playerStateId)}`;
    const actorId = `character:${Number(STORY.playerStateId)}:${STORY.commander.id}`;
    const identity = typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(actorId) : null;
    const role = String(identity && identity.role
        || STORY.commander.creationRole || STORY.playerRole || '').toUpperCase();
    const organizationId = String(identity && identity.organizationId
        || STORY.commander.organizationId || '');
    return { actorId, countryId, role, organizationId, identity };
}

function storyHexConstructionPlayerView(regionId) {
    const actor = storyHexConstructionPlayerActor();
    const nodeId = storyHexConstructionRegionNumber(regionId);
    const node = typeof STORY !== 'undefined' && (STORY.nodes || [])
        .find(row => Number(row.id) === nodeId);
    const allowedRole = actor && ['COMPANY_OWNER', 'COMPANY_EXECUTIVE'].includes(actor.role);
    const company = allowedRole && actor.organizationId
        && typeof storyCompanyById === 'function'
        ? storyCompanyById(actor.organizationId) : null;
    const ownsRegion = !!(node && Number(node.owner) === Number(STORY.playerStateId));
    const companyValid = !!(company && company.countryId === actor.countryId
        && company.status === 'OPERATING' && company.licenseStatus === 'LICENSED');
    const draft = typeof STORY !== 'undefined' && STORY._hexConstructionDraft
        && STORY._hexConstructionDraft.regionId === String(regionId)
        ? storyHexConstructionClone(STORY._hexConstructionDraft) : null;
    let lockedReason = null;
    if (!actor) lockedReason = 'PLAYER_ACTOR_UNAVAILABLE';
    else if (!ownsRegion) lockedReason = 'REGION_OUTSIDE_PLAYER_JURISDICTION';
    else if (!allowedRole) lockedReason = 'COMPANY_ROLE_REQUIRED';
    else if (!companyValid) lockedReason = 'PLAYER_COMPANY_UNAVAILABLE';
    return {
        allowed: !lockedReason, lockedReason, regionId: String(regionId),
        actor, company: company ? {
            id: company.id, name: company.name, sectorId: company.sectorId,
            cash: Math.max(0, Number(company.accounts && company.accounts['ASSET:CASH']) || 0)
        } : null,
        draft
    };
}

function storyHexConstructionPlayerBegin(regionId, projectType) {
    const view = storyHexConstructionPlayerView(regionId);
    const type = String(projectType || '').toUpperCase();
    if (!view.allowed) return { ok: false, code: view.lockedReason };
    if (!STORY_HEX_CONSTRUCTION_POLICY[type]) return { ok: false, code: 'PROJECT_TYPE_INVALID' };
    if (type === 'INDUSTRIAL'
        && !STORY_HEX_CONSTRUCTION_INDUSTRIAL_SECTORS.includes(view.company.sectorId)) {
        return { ok: false, code: 'PLAYER_COMPANY_SECTOR_CANNOT_BUILD_INDUSTRIAL' };
    }
    const candidates = storyHexConstructionCandidates(String(regionId), type, { limit: 24 })
        .filter(row => !row.requiresEnvironmentalAssessment);
    if (!candidates.length) return { ok: false, code: 'NO_BUILDABLE_HEX_CANDIDATE' };
    STORY._hexConstructionDraft = {
        regionId: String(regionId), projectType: type,
        companyId: view.company.id, applicantActorId: view.actor.actorId,
        countryId: view.actor.countryId,
        candidateCellIds: candidates.map(row => row.targetCellId),
        selectedCellId: null, startedAt: Number(STORY.clock) || 0
    };
    STORY._hexConstructionPickMode = true;
    if (typeof storyCityDossierPanelReset === 'function') storyCityDossierPanelReset();
    if (typeof storyRender === 'function') storyRender();
    return { ok: true, draft: storyHexConstructionClone(STORY._hexConstructionDraft) };
}

function storyHexConstructionPlayerPickCell(cellId) {
    const draft = typeof STORY !== 'undefined' && STORY._hexConstructionDraft;
    if (!draft || !STORY._hexConstructionPickMode) return { ok: false, code: 'CONSTRUCTION_PICK_MODE_INACTIVE' };
    const id = String(cellId || '');
    if (!draft.candidateCellIds.includes(id)) return { ok: false, code: 'HEX_NOT_IN_APPLICATION_CANDIDATES' };
    draft.selectedCellId = id;
    STORY._hexConstructionPickMode = false;
    if (typeof storyCityDossierPanelReset === 'function') storyCityDossierPanelReset();
    if (typeof storyEconomyUpdate === 'function') storyEconomyUpdate();
    if (typeof storyRender === 'function') storyRender();
    return { ok: true, draft: storyHexConstructionClone(draft) };
}

function storyHexConstructionPlayerCancelDraft() {
    if (typeof STORY === 'undefined') return false;
    STORY._hexConstructionDraft = null;
    STORY._hexConstructionPickMode = false;
    if (typeof storyCityDossierPanelReset === 'function') storyCityDossierPanelReset();
    if (typeof storyEconomyUpdate === 'function') storyEconomyUpdate();
    if (typeof storyRender === 'function') storyRender();
    return true;
}

function storyHexConstructionPlayerSubmitDraft() {
    const draft = typeof STORY !== 'undefined' && STORY._hexConstructionDraft;
    if (!draft || !draft.selectedCellId) return { ok: false, code: 'CONSTRUCTION_TARGET_NOT_SELECTED' };
    const view = storyHexConstructionPlayerView(draft.regionId);
    if (!view.allowed || !view.company || view.company.id !== draft.companyId) {
        return { ok: false, code: view.lockedReason || 'PLAYER_COMPANY_BINDING_CHANGED' };
    }
    const nextSequence = Math.max(0, Number(STORY.hexConstruction
        && STORY.hexConstruction.applicationSequence) || 0) + 1;
    const result = storyHexConstructionSubmitApplication({
        origin: 'PLAYER', projectType: draft.projectType,
        regionId: draft.regionId, countryId: draft.countryId,
        targetCellId: draft.selectedCellId,
        applicantActorId: draft.applicantActorId, companyId: draft.companyId,
        landAcquisition: {
            mode: 'LEASE',
            evidenceId: `hex-land-lease-application:${nextSequence}`,
            cost: STORY_HEX_CONSTRUCTION_LAND_COST[draft.projectType]
        }
    });
    if (!result.ok) return result;
    storyHexConstructionPlayerCancelDraft();
    if (typeof storySave === 'function') storySave();
    return result;
}

function storyHexConstructionEconomicAIProject(company, regionId) {
    const nodeId = storyHexConstructionRegionNumber(regionId);
    const node = typeof STORY !== 'undefined' && (STORY.nodes || [])
        .find(row => Number(row.id) === nodeId);
    const regional = typeof storyRegionalRegionView === 'function'
        ? storyRegionalRegionView(regionId) : null;
    const capacity = storyHexConstructionHousingPopulationCap(regionId, 140);
    if (company.sectorId === 'civil_industry' && node
        && Number(node.pop) >= capacity * .92) {
        return { projectType: 'RESIDENTIAL', reason: 'HOUSING_CAP_PRESSURE',
            pressure: Math.round(Number(node.pop) / Math.max(1, capacity) * 10000) };
    }
    const shortages = regional && Array.isArray(regional.shortages) ? regional.shortages : [];
    if (company.sectorId === 'civil_industry' && shortages.length >= 3) {
        return { projectType: 'LOGISTICS', reason: 'MULTI_RESOURCE_LOGISTICS_PRESSURE',
            pressure: Math.min(10000, shortages.length * 1200) };
    }
    const sectorResources = {
        energy: ['energy'], civil_industry: ['raw_materials', 'industrial_parts'],
        advanced_tech: ['electronics'], defense_industry: ['military_supplies']
    };
    const ownShortages = shortages.filter(row =>
        (sectorResources[company.sectorId] || []).includes(row.resourceId));
    if (STORY_HEX_CONSTRUCTION_INDUSTRIAL_SECTORS.includes(company.sectorId)
        && ownShortages.length) {
        return { projectType: 'INDUSTRIAL', reason: 'SECTOR_SHORTAGE_PRESSURE',
            pressure: Math.min(10000, ownShortages.length * 2200) };
    }
    return null;
}

function storyHexConstructionEconomicAITick(dtSec, options) {
    if (typeof STORY === 'undefined' || !STORY.companyEconomy) return { disabled: true };
    const ledger = storyHexConstructionEnsureLedger(options && options.root);
    const secondsPerYear = typeof STORY_CALENDAR !== 'undefined'
        ? Number(STORY_CALENDAR.secondsPerYear) || 120 : 120;
    const worldDays = Math.max(0, Number(dtSec) || 0) * 365 / secondsPerYear;
    ledger.economicAIElapsedDays += worldDays;
    if (ledger.economicAIElapsedDays + 1e-6
        < STORY_HEX_CONSTRUCTION_APPLICATION_POLICY.economicAIDecisionIntervalDays) {
        return { disabled: false, applications: 0, waitingDays: ledger.economicAIElapsedDays };
    }
    ledger.economicAIElapsedDays -= STORY_HEX_CONSTRUCTION_APPLICATION_POLICY.economicAIDecisionIntervalDays;
    const playerOrganizationId = STORY.commander && STORY.commander.organizationId
        ? String(STORY.commander.organizationId) : null;
    let created = 0;
    const decisions = [];
    const companies = Object.values(STORY.companyEconomy.companies || {})
        .filter(company => company.status === 'OPERATING' && company.licenseStatus === 'LICENSED'
            && company.id !== playerOrganizationId)
        .sort((a, b) => a.id.localeCompare(b.id, 'en'));
    for (const company of companies) {
        if (created >= STORY_HEX_CONSTRUCTION_APPLICATION_POLICY.maximumEconomicAIApplicationsPerCycle) break;
        const regionIds = Array.from(new Set((company.facilityIds || [])
            .map(id => STORY.companyEconomy.facilities[id])
            .filter(Boolean).map(row => row.regionId))).sort((a, b) => a.localeCompare(b, 'en'));
        for (const regionId of regionIds) {
            const open = (ledger.applications || []).filter(row => row.regionId === regionId
                && !['REJECTED', 'CANCELLED'].includes(row.status));
            if (open.length >= STORY_HEX_CONSTRUCTION_APPLICATION_POLICY.maximumOpenApplicationsPerRegion
                || open.some(row => row.companyId === company.id)) continue;
            const decision = storyHexConstructionEconomicAIProject(company, regionId);
            if (!decision) continue;
            const candidate = storyHexConstructionCandidates(regionId, decision.projectType,
                Object.assign({}, options, { limit: 12 }))
                .find(row => !row.requiresEnvironmentalAssessment);
            if (!candidate) continue;
            ledger.economicAIDecisionSequence++;
            const result = storyHexConstructionSubmitApplication({
                origin: 'ECONOMIC_AI', projectType: decision.projectType,
                regionId, countryId: company.countryId,
                targetCellId: candidate.targetCellId,
                applicantActorId: `character:company-executive:${company.id}`,
                companyId: company.id,
                landAcquisition: {
                    mode: 'LEASE',
                    evidenceId: `hex-land-lease-ai:${ledger.economicAIDecisionSequence}`,
                    cost: STORY_HEX_CONSTRUCTION_LAND_COST[decision.projectType]
                },
                decisionEvidence: decision
            }, options);
            decisions.push({ companyId: company.id, regionId,
                decision: storyHexConstructionClone(decision), result: result.ok ? 'SUBMITTED' : result.code });
            if (result.ok) { created++; break; }
        }
    }
    storyHexConstructionTouch(ledger);
    return { disabled: false, applications: created, decisions };
}

function storyHexConstructionRegionCapacity(regionId, root) {
    const ledger = storyHexConstructionEnsureLedger(root);
    const row = ledger.commissionedCapacityByRegion[String(regionId)] || {};
    return {
        residential: Math.max(0, Number(row.residential) || 0),
        logistics: Math.max(0, Number(row.logistics) || 0),
        industrialBySector: Object.assign({}, row.industrialBySector || {}),
        sourceReceiptIds: Array.isArray(row.sourceReceiptIds) ? row.sourceReceiptIds.slice() : []
    };
}

function storyHexConstructionHousingPopulationCap(regionId, legacyCap, root) {
    const baseline = Math.max(0, Number(legacyCap) || 0);
    return baseline + storyHexConstructionRegionCapacity(regionId, root).residential * 5;
}

function storyHexConstructionCapacityRow(ledger, regionId) {
    if (!ledger.commissionedCapacityByRegion) ledger.commissionedCapacityByRegion = {};
    if (!ledger.commissionedCapacityByRegion[regionId]) {
        ledger.commissionedCapacityByRegion[regionId] = {
            residential: 0, logistics: 0, industrialBySector: {}, sourceReceiptIds: []
        };
    }
    return ledger.commissionedCapacityByRegion[regionId];
}

function storyHexConstructionCapacityProjection(receipts) {
    const projected = {};
    for (const receipt of receipts || []) {
        const commissioning = receipt && receipt.commissioning;
        if (!receipt || !receipt.regionId || !commissioning
            || commissioning.status !== 'COMMISSIONED') continue;
        if (!projected[receipt.regionId]) projected[receipt.regionId] = {
            residential: 0, logistics: 0, industrialBySector: {}, sourceReceiptIds: []
        };
        const row = projected[receipt.regionId];
        const amount = Math.max(0, Number(commissioning.capacityAmount) || 0);
        if (commissioning.capacityType === 'RESIDENTIAL') row.residential += amount;
        if (commissioning.capacityType === 'LOGISTICS') row.logistics += amount;
        if (commissioning.capacityType === 'INDUSTRIAL' && commissioning.sectorId) {
            row.industrialBySector[commissioning.sectorId] = Math.round(
                ((Number(row.industrialBySector[commissioning.sectorId]) || 0) + amount) * 1e6
            ) / 1e6;
        }
        row.residential = Math.round(row.residential * 1e6) / 1e6;
        row.logistics = Math.round(row.logistics * 1e6) / 1e6;
        row.sourceReceiptIds.push(receipt.id);
    }
    return projected;
}

function storyHexConstructionCommissionPreflight(command, options) {
    if (command.projectType !== 'INDUSTRIAL') return { ok: true };
    const economy = storyHexConstructionEconomy(options);
    const company = economy.company(command.companyId);
    const region = economy.region(command.regionId);
    if (!company) return { ok: false, code: 'COMMISSIONING_COMPANY_NOT_FOUND' };
    if (!STORY_HEX_CONSTRUCTION_INDUSTRIAL_SECTORS.includes(company.sectorId)) {
        return { ok: false, code: 'COMMISSIONING_INDUSTRIAL_SECTOR_REQUIRED' };
    }
    if (!region || !region.sectorCapacity) return { ok: false, code: 'COMMISSIONING_REGION_NOT_FOUND' };
    const companyLedger = economy.companyLedger && economy.companyLedger();
    if (!companyLedger || !companyLedger.facilities) return { ok: false, code: 'COMMISSIONING_COMPANY_LEDGER_UNAVAILABLE' };
    const facilityId = `facility:${storyHexConstructionRegionNumber(command.regionId)}:${company.sectorId}`;
    const existing = companyLedger.facilities[facilityId];
    if (existing && existing.ownerCompanyId !== company.id) {
        return { ok: false, code: 'COMMISSIONING_FACILITY_OWNER_CONFLICT' };
    }
    return { ok: true, company, region, companyLedger, facilityId, existing,
        sectorId: company.sectorId };
}

function storyHexConstructionCommission(command, receipt, options, preflight) {
    const ledger = storyHexConstructionEnsureLedger(options && options.root);
    const row = storyHexConstructionCapacityRow(ledger, command.regionId);
    const amount = Math.max(0, Number(command.requirements && command.requirements.capacity) || 0);
    if (command.projectType === 'RESIDENTIAL') row.residential += amount;
    if (command.projectType === 'LOGISTICS') row.logistics += amount;
    let facilityId = null, sectorId = null;
    if (command.projectType === 'INDUSTRIAL') {
        const checked = preflight || storyHexConstructionCommissionPreflight(command, options);
        if (!checked.ok) return checked;
        facilityId = checked.facilityId;
        sectorId = checked.sectorId;
        if (checked.existing) {
            checked.existing.capacity = Math.round((Number(checked.existing.capacity) + amount) * 1e6) / 1e6;
            checked.existing.status = 'OPERATING';
        } else {
            checked.companyLedger.facilities[facilityId] = {
                id: facilityId,
                regionId: command.regionId,
                countryId: command.countryId || checked.company.countryId,
                sectorId,
                ownerCompanyId: checked.company.id,
                status: 'OPERATING',
                capacity: amount,
                licensed: true,
                acquiredAt: receipt.completedAt,
                sourceConstructionId: command.id
            };
            if (!checked.company.facilityIds.includes(facilityId)) checked.company.facilityIds.push(facilityId);
        }
        checked.region.sectorCapacity[sectorId] = Math.round(
            ((Number(checked.region.sectorCapacity[sectorId]) || 0) + amount) * 1e6
        ) / 1e6;
        row.industrialBySector[sectorId] = Math.round(
            ((Number(row.industrialBySector[sectorId]) || 0) + amount) * 1e6
        ) / 1e6;
    }
    row.residential = Math.round(row.residential * 1e6) / 1e6;
    row.logistics = Math.round(row.logistics * 1e6) / 1e6;
    if (!row.sourceReceiptIds.includes(receipt.id)) row.sourceReceiptIds.push(receipt.id);
    receipt.commissioning = {
        status: 'COMMISSIONED',
        capacityType: command.projectType,
        capacityAmount: amount,
        facilityId,
        sectorId
    };
    command.commissionedAt = receipt.completedAt;
    command.commissioningReceiptId = receipt.id;
    return { ok: true, commissioning: storyHexConstructionClone(receipt.commissioning) };
}

function storyHexConstructionEconomy(options) {
    if (options && options.economy) return options.economy;
    return {
        company: id => typeof storyCompanyById === 'function' ? storyCompanyById(id) : null,
        companyLedger: () => typeof storyCompanyEnsure === 'function' ? storyCompanyEnsure() : null,
        region: id => typeof STORY !== 'undefined' && STORY.regionalEconomy
            && STORY.regionalEconomy.regions && STORY.regionalEconomy.regions[id] || null,
        postCash: (company, postings, details) => typeof storyCompanyPost === 'function'
            ? storyCompanyPost(company, 'hex.construction.reserve', postings, details)
            : { ok: false, code: 'COMPANY_POSTING_UNAVAILABLE' },
        stockDelta: (regionId, resourceId, amount, details) => {
            if (typeof storyRegionalStockDelta !== 'function') return { ok: false, code: 'REGIONAL_STOCK_DELTA_UNAVAILABLE' };
            const physical = storyRegionalStockDelta(regionId, resourceId, amount, details);
            if (physical && physical.ok && amount < 0 && typeof storyCommerceApplyPhysicalLoss === 'function') {
                storyCommerceApplyPhysicalLoss(regionId, resourceId, -amount, details && details.type);
            }
            return physical;
        },
        availableWorkers: regionId => {
            const view = typeof storyPopulationLaborSupply === 'function'
                ? storyPopulationLaborSupply(regionId, 1) : null;
            return view && view.status === 'COHORT_DERIVED'
                ? Number(view.availableWorkersPeople) || 0 : 0;
        }
    };
}

function storyHexConstructionReservedWorkforce(ledger, regionId) {
    return (ledger.commands || []).filter(command => command.regionId === regionId
        && ['AUTHORIZED', 'BUILDING'].includes(command.status)
        && command.resourceReservation && command.resourceReservation.ownerType === 'COMPANY')
        .reduce((sum, command) => sum + (Number(command.resourceReservation.workforce) || 0), 0);
}

function storyHexConstructionReserveAndSubmit(spec, options) {
    spec = spec || {};
    const ledger = storyHexConstructionEnsureLedger(options && options.root);
    const policy = STORY_HEX_CONSTRUCTION_POLICY[String(spec.projectType || '').toUpperCase()];
    if (!policy) return { ok: false, code: 'PROJECT_TYPE_INVALID' };
    const economy = storyHexConstructionEconomy(options);
    const company = economy.company(String(spec.companyId || ''));
    const regionId = String(spec.regionId || '');
    const region = economy.region(regionId);
    if (!company || company.status !== 'OPERATING' || company.licenseStatus !== 'LICENSED') {
        return { ok: false, code: 'COMPANY_NOT_OPERATING' };
    }
    if (!region || !region.stocks) return { ok: false, code: 'REGION_NOT_FOUND' };
    const acquisitionCost = Math.max(0, Number(spec.landAcquisition && spec.landAcquisition.cost) || 0);
    const cash = policy.cash + acquisitionCost;
    const workforceFree = Math.max(0, Number(economy.availableWorkers(regionId))
        - storyHexConstructionReservedWorkforce(ledger, regionId));
    if (Number(company.accounts && company.accounts['ASSET:CASH']) + 1e-6 < cash) {
        return { ok: false, code: 'CONSTRUCTION_CASH_UNAVAILABLE', required: cash };
    }
    if (workforceFree + 1e-6 < policy.workforce) {
        return { ok: false, code: 'CONSTRUCTION_WORKFORCE_UNAVAILABLE', required: policy.workforce, available: workforceFree };
    }
    for (const [resourceId, quantity] of Object.entries(policy.materials)) {
        if (Number(region.stocks[resourceId]) + 1e-6 < quantity) {
            return { ok: false, code: 'CONSTRUCTION_MATERIAL_UNAVAILABLE', resourceId, required: quantity };
        }
    }
    ledger.reservationSequence = Math.max(0, Number(ledger.reservationSequence) || 0) + 1;
    const reservationId = `hex-construction-reservation:${ledger.reservationSequence}`;
    const candidate = Object.assign({}, spec, { resourceReservation: {
        id: reservationId, ownerType: 'COMPANY', ownerId: company.id,
        cash, workforce: policy.workforce, materials: Object.assign({}, policy.materials)
    } });
    const preview = storyHexConstructionPreflight(candidate, options);
    if (!preview.ok) return { ok: false, code: 'CONSTRUCTION_PREFLIGHT_BLOCKED', preview };
    const cashPost = economy.postCash(company, [
        { account: 'ASSET:PROJECT_ESCROW', amount: cash },
        { account: 'ASSET:CASH', amount: -cash }
    ], { reservationId, targetCellId: preview.targetCellId });
    if (!cashPost.ok) return cashPost;
    const debited = [];
    for (const [resourceId, quantity] of Object.entries(policy.materials)) {
        const result = economy.stockDelta(regionId, resourceId, -quantity, {
            type: 'HEX_CONSTRUCTION_RESERVE', source: company.id, reservationId
        });
        if (!result.ok) {
            for (const row of debited) economy.stockDelta(regionId, row.resourceId, row.quantity,
                { type: 'HEX_CONSTRUCTION_ROLLBACK', source: company.id, reservationId });
            economy.postCash(company, [
                { account: 'ASSET:CASH', amount: cash },
                { account: 'ASSET:PROJECT_ESCROW', amount: -cash }
            ], { reservationId, rollback: true });
            return { ok: false, code: 'CONSTRUCTION_ATOMIC_RESERVATION_FAILED', resourceId };
        }
        debited.push({ resourceId, quantity });
    }
    const submitted = storyHexConstructionSubmit(candidate, options);
    if (!submitted.ok) {
        for (const row of debited) economy.stockDelta(regionId, row.resourceId, row.quantity,
            { type: 'HEX_CONSTRUCTION_ROLLBACK', source: company.id, reservationId });
        economy.postCash(company, [
            { account: 'ASSET:CASH', amount: cash },
            { account: 'ASSET:PROJECT_ESCROW', amount: -cash }
        ], { reservationId, rollback: true });
        return submitted;
    }
    const stored = ledger.commands.find(command => command.id === submitted.command.id);
    stored.resourceReservation.ownerType = 'COMPANY';
    stored.resourceReservation.ownerId = company.id;
    stored.resourceReservation.reservedAt = storyHexConstructionContext(options).clock;
    return { ok: true, command: storyHexConstructionClone(stored) };
}

function storyHexConstructionForSave(root) {
    const ledger = storyHexConstructionEnsureLedger(root);
    return storyHexConstructionClone(ledger);
}

function storyHexConstructionRestore(saved, root) {
    const state = root || (typeof STORY !== 'undefined' ? STORY : null);
    if (!state) return { ok: false, code: 'STORY_HEX_CONSTRUCTION_STATE_REQUIRED' };
    if (!saved) {
        delete state.hexConstruction;
        return { ok: true, restored: 0 };
    }
    if (Number(saved.schemaVersion) !== STORY_HEX_CONSTRUCTION_SCHEMA_VERSION
        || !Array.isArray(saved.commands) || !Array.isArray(saved.receipts)) {
        return { ok: false, code: 'CONSTRUCTION_SAVE_SCHEMA_INVALID' };
    }
    const ids = new Set(), occupied = new Set();
    for (const command of saved.commands) {
        if (!command || !command.id || ids.has(command.id)
            || !STORY_HEX_CONSTRUCTION_TYPES.includes(command.projectType)
            || !STORY_HEX_CONSTRUCTION_STATUSES.includes(command.status)) {
            return { ok: false, code: 'CONSTRUCTION_SAVE_COMMAND_INVALID' };
        }
        ids.add(command.id);
        if (command.status !== 'CANCELLED') {
            if (!command.targetCellId || occupied.has(command.targetCellId)) {
                return { ok: false, code: 'CONSTRUCTION_SAVE_CELL_COLLISION' };
            }
            occupied.add(command.targetCellId);
        }
    }
    state.hexConstruction = storyHexConstructionClone(saved);
    state.hexConstruction.adapterVersion = STORY_HEX_CONSTRUCTION_ADAPTER_VERSION;
    state.hexConstruction.commandSequence = Math.max(0,
        Number(state.hexConstruction.commandSequence) || saved.commands.length);
    if (!Array.isArray(state.hexConstruction.applications)) state.hexConstruction.applications = [];
    for (const application of state.hexConstruction.applications) {
        if (!application || !application.id
            || !STORY_HEX_CONSTRUCTION_APPLICATION_STATUSES.includes(application.status)) {
            return { ok: false, code: 'CONSTRUCTION_SAVE_APPLICATION_INVALID' };
        }
    }
    state.hexConstruction.applicationSequence = Math.max(0,
        Number(state.hexConstruction.applicationSequence) || state.hexConstruction.applications.length);
    state.hexConstruction.reservationSequence = Math.max(0,
        Number(state.hexConstruction.reservationSequence) || 0);
    state.hexConstruction.receiptSequence = Math.max(0,
        Number(state.hexConstruction.receiptSequence) || saved.receipts.length);
    // Toplam kapasite bir save girdisi değil, imzalı tamamlanma makbuzlarının
    // izdüşümüdür. Yüklemede yeniden kurmak bedelsiz/tahrif edilmiş kapasiteyi
    // ve sayaç-makbuz ayrışmasını engeller.
    state.hexConstruction.commissionedCapacityByRegion =
        storyHexConstructionCapacityProjection(state.hexConstruction.receipts);
    return { ok: true, restored: saved.commands.length };
}

function storyHexConstructionSubmit(spec, options) {
    const root = options && options.root;
    const ledger = storyHexConstructionEnsureLedger(root);
    const preview = storyHexConstructionPreflight(spec, options);
    if (!preview.targetCellId || preview.blockReasons.includes('PROJECT_TYPE_INVALID')
        || preview.blockReasons.includes('REGION_INVALID')) {
        return { ok: false, code: preview.blockReasons[0] || 'CONSTRUCTION_SPEC_INVALID', preview };
    }
    const collision = ledger.commands.some(row => row.targetCellId === preview.targetCellId
        && !['CANCELLED'].includes(row.status));
    if (collision) return { ok: false, code: 'CONSTRUCTION_TARGET_RESERVED', preview };
    ledger.commandSequence++;
    const command = Object.assign({
        id: `hex-construction:${ledger.commandSequence}`,
        correlationId: String(spec && spec.correlationId || `hex-construction:${ledger.commandSequence}`),
        status: preview.ok ? 'AUTHORIZED' : 'AWAITING_REQUIREMENTS',
        submittedAt: storyHexConstructionContext(options).clock,
        startedAt: null,
        completedAt: null,
        remainingDays: preview.requirements ? preview.requirements.durationDays : 0,
        completionReceiptId: null
    }, storyHexConstructionClone(preview));
    delete command.ok;
    ledger.commands.push(command);
    storyHexConstructionTouch(ledger);
    if (typeof storyHexSitesResetCache === 'function') storyHexSitesResetCache();
    return { ok: true, command: storyHexConstructionClone(command) };
}

function storyHexConstructionRefresh(commandId, specPatch, options) {
    const ledger = storyHexConstructionEnsureLedger(options && options.root);
    const command = ledger.commands.find(row => row.id === String(commandId));
    if (!command || !['AWAITING_REQUIREMENTS', 'AUTHORIZED'].includes(command.status)) return { ok: false, code: 'CONSTRUCTION_NOT_REFRESHABLE' };
    const merged = Object.assign({}, command, specPatch || {}, {
        landAcquisition: Object.assign({}, command.landAcquisition, specPatch && specPatch.landAcquisition),
        permission: Object.assign({}, command.permission, specPatch && specPatch.permission),
        resourceReservation: Object.assign({}, command.resourceReservation, specPatch && specPatch.resourceReservation, {
            materials: Object.assign({}, command.resourceReservation && command.resourceReservation.materials,
                specPatch && specPatch.resourceReservation && specPatch.resourceReservation.materials)
        }),
        environmentalAssessmentId: String(specPatch && specPatch.environmentalAssessmentId
            || command.environment && command.environment.assessmentId || ''),
        environmentalMitigation: Object.assign({
            id: command.environment && command.environment.mitigationId || '',
            restorationBudget: command.environment && command.environment.restorationBudget || 0
        }, specPatch && specPatch.environmentalMitigation)
    });
    const preview = storyHexConstructionPreflight(merged, options);
    const immutable = ['projectType', 'regionId', 'cityId', 'targetCellId', 'targetCellIndex', 'applicantActorId', 'companyId', 'countryId'];
    for (const key of immutable) preview[key] = command[key];
    Object.assign(command, storyHexConstructionClone(preview));
    delete command.ok;
    command.status = preview.ok ? 'AUTHORIZED' : 'AWAITING_REQUIREMENTS';
    storyHexConstructionTouch(ledger);
    return { ok: true, command: storyHexConstructionClone(command) };
}

function storyHexConstructionStart(commandId, options) {
    const ledger = storyHexConstructionEnsureLedger(options && options.root);
    const command = ledger.commands.find(row => row.id === String(commandId));
    if (!command) return { ok: false, code: 'CONSTRUCTION_NOT_FOUND' };
    if (command.status !== 'AUTHORIZED' || command.blockReasons.length) return { ok: false, code: 'CONSTRUCTION_REQUIREMENTS_INCOMPLETE', blockReasons: command.blockReasons.slice() };
    command.status = 'BUILDING';
    command.startedAt = storyHexConstructionContext(options).clock;
    storyHexConstructionTouch(ledger);
    if (typeof storyHexSitesResetCache === 'function') storyHexSitesResetCache();
    return { ok: true, command: storyHexConstructionClone(command) };
}

function storyHexConstructionTick(worldDays, options) {
    const ledger = storyHexConstructionEnsureLedger(options && options.root);
    const days = Math.max(0, Number(worldDays) || 0);
    const now = storyHexConstructionContext(options).clock;
    const completed = [];
    for (const command of ledger.commands) {
        if (command.status !== 'BUILDING') continue;
        command.remainingDays = Math.max(0, Math.round((command.remainingDays - days) * 1000) / 1000);
        if (command.remainingDays > 0) continue;
        const commissionPreflight = storyHexConstructionCommissionPreflight(command, options);
        if (!commissionPreflight.ok) {
            command.completionBlockedReason = commissionPreflight.code;
            continue;
        }
        if (command.resourceReservation && command.resourceReservation.ownerType === 'COMPANY') {
            const economy = storyHexConstructionEconomy(options);
            const company = economy.company(command.resourceReservation.ownerId || command.companyId);
            const cash = Math.max(0, Number(command.resourceReservation.cash) || 0);
            const settled = company && economy.postCash(company, [
                { account: 'EXPENSE:CAPACITY_INVESTMENT', amount: cash },
                { account: 'ASSET:PROJECT_ESCROW', amount: -cash }
            ], { commandId: command.id, completion: true });
            if (!settled || !settled.ok) {
                command.completionBlockedReason = settled && settled.code
                    || 'CONSTRUCTION_FINANCIAL_SETTLEMENT_FAILED';
                continue;
            }
            const companyLedger = economy.companyLedger && economy.companyLedger();
            if (companyLedger) {
                companyLedger.marketClearingCash = Math.round(
                    ((Number(companyLedger.marketClearingCash) || 0) + cash) * 1e6
                ) / 1e6;
            }
            if (!company.cumulative) company.cumulative = {};
            company.cumulative.expense = Math.round(
                ((Number(company.cumulative.expense) || 0) + cash) * 1e6
            ) / 1e6;
            company.cumulative.investment = Math.round(
                ((Number(company.cumulative.investment) || 0) + cash) * 1e6
            ) / 1e6;
            command.completionBlockedReason = null;
            command.resourceReservation.settledAt = now;
        }
        ledger.receiptSequence++;
        const receipt = {
            id: `hex-construction-receipt:${ledger.receiptSequence}`,
            commandId: command.id,
            correlationId: command.correlationId,
            projectType: command.projectType,
            targetCellId: command.targetCellId,
            targetCellIndex: command.targetCellIndex,
            regionId: command.regionId,
            capacityCreated: command.requirements.capacity,
            consumed: storyHexConstructionClone(command.resourceReservation),
            environmentalCost: command.requirements.environmentalCost,
            permissionDecisionId: command.permission.decisionId,
            landAcquisitionEvidenceId: command.landAcquisition.evidenceId,
            completedAt: now
        };
        const commissioned = storyHexConstructionCommission(command, receipt, options,
            commissionPreflight);
        if (!commissioned.ok) {
            command.completionBlockedReason = commissioned.code;
            continue;
        }
        ledger.receipts.push(receipt);
        command.status = 'COMPLETED';
        command.completedAt = now;
        command.completionReceiptId = receipt.id;
        completed.push(storyHexConstructionClone(receipt));
    }
    if (completed.length && typeof storyHexSitesResetCache === 'function') storyHexSitesResetCache();
    if (completed.length) storyHexConstructionTouch(ledger);
    return { ok: true, processedDays: days, completed };
}

function storyHexConstructionTickSeconds(dtSec, options) {
    const secondsPerYear = typeof STORY_CALENDAR !== 'undefined'
        ? Number(STORY_CALENDAR.secondsPerYear) || 120 : 120;
    const worldDays = Math.max(0, Number(dtSec) || 0) * 365 / secondsPerYear;
    const applications = storyHexConstructionSyncApplications(options);
    const construction = storyHexConstructionTick(worldDays, options);
    return Object.assign({}, construction, { applicationResults: applications });
}

function storyHexConstructionCancel(commandId, reason, options) {
    const ledger = storyHexConstructionEnsureLedger(options && options.root);
    const command = ledger.commands.find(row => row.id === String(commandId));
    if (!command || ['COMPLETED', 'CANCELLED'].includes(command.status)) return { ok: false, code: 'CONSTRUCTION_NOT_CANCELLABLE' };
    if (command.resourceReservation && command.resourceReservation.ownerType === 'COMPANY') {
        const economy = storyHexConstructionEconomy(options);
        const company = economy.company(command.resourceReservation.ownerId || command.companyId);
        const cash = Math.max(0, Number(command.resourceReservation.cash) || 0);
        const refunded = company && economy.postCash(company, [
            { account: 'ASSET:CASH', amount: cash },
            { account: 'ASSET:PROJECT_ESCROW', amount: -cash }
        ], { commandId: command.id, cancellation: true });
        if (!refunded || !refunded.ok) return {
            ok: false,
            code: refunded && refunded.code || 'CONSTRUCTION_CASH_REFUND_FAILED'
        };
        for (const [resourceId, quantity] of Object.entries(
            command.resourceReservation.materials || {})) {
            const restored = economy.stockDelta(command.regionId, resourceId,
                Math.max(0, Number(quantity) || 0), {
                    type: 'HEX_CONSTRUCTION_CANCEL_REFUND', source: company.id,
                    reservationId: command.resourceReservation.id
                });
            if (!restored.ok) return { ok: false, code: 'CONSTRUCTION_MATERIAL_REFUND_FAILED', resourceId };
        }
        command.resourceReservation.refundedAt = storyHexConstructionContext(options).clock;
        command.refundStatus = 'REFUNDED';
    }
    command.status = 'CANCELLED';
    command.cancelledAt = storyHexConstructionContext(options).clock;
    command.cancelReason = String(reason || 'UNSPECIFIED');
    // Kaynak iadesi burada uydurulmaz. Rezervasyon sahibinin muhasebe kaydıyla
    // ayrı bir rollback makbuzu üretmesi sonraki ekonomi entegrasyonudur.
    if (!command.refundStatus) command.refundStatus = 'RESERVATION_OWNER_ROLLBACK_REQUIRED';
    storyHexConstructionTouch(ledger);
    if (typeof storyHexSitesResetCache === 'function') storyHexSitesResetCache();
    return { ok: true, command: storyHexConstructionClone(command) };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STORY_HEX_CONSTRUCTION_SCHEMA_VERSION,
        STORY_HEX_CONSTRUCTION_ADAPTER_VERSION,
        STORY_HEX_CONSTRUCTION_TYPES,
        STORY_HEX_CONSTRUCTION_STATUSES,
        STORY_HEX_CONSTRUCTION_APPLICATION_STATUSES,
        STORY_HEX_CONSTRUCTION_POLICY,
        STORY_HEX_CONSTRUCTION_INDUSTRIAL_SECTORS,
        STORY_HEX_CONSTRUCTION_LAND_COST,
        STORY_HEX_CONSTRUCTION_APPLICATION_POLICY,
        storyHexConstructionCellId,
        storyHexConstructionCellIndex,
        storyHexConstructionPreflight,
        storyHexConstructionEnsureLedger,
        storyHexConstructionCandidates,
        storyHexConstructionSubmitApplication,
        storyHexConstructionSyncApplication,
        storyHexConstructionSyncApplications,
        storyHexConstructionRegionView,
        storyHexConstructionPlayerView,
        storyHexConstructionPlayerBegin,
        storyHexConstructionPlayerPickCell,
        storyHexConstructionPlayerCancelDraft,
        storyHexConstructionPlayerSubmitDraft,
        storyHexConstructionEconomicAIProject,
        storyHexConstructionEconomicAITick,
        storyHexConstructionRegionCapacity,
        storyHexConstructionHousingPopulationCap,
        storyHexConstructionCapacityProjection,
        storyHexConstructionCommissionPreflight,
        storyHexConstructionCommission,
        storyHexConstructionReserveAndSubmit,
        storyHexConstructionForSave,
        storyHexConstructionRestore,
        storyHexConstructionSubmit,
        storyHexConstructionRefresh,
        storyHexConstructionStart,
        storyHexConstructionTick,
        storyHexConstructionTickSeconds,
        storyHexConstructionCancel
    };
}
