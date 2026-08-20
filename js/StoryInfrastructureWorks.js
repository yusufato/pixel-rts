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
            revision: 0, commandSequence: 0, reservationSequence: 0, receiptSequence: 0,
            commands: [], receipts: []
        };
    }
    return state.infrastructureWorks;
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
    return ledger.commands.filter(command => ['AUTHORIZED', 'IN_PROGRESS'].includes(command.status)
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
    if (completed.length) {
        ledger.revision++;
        if (typeof STORY !== 'undefined') STORY._networkLayerKey = null;
    }
    return { ok: true, processedDays: days, completed };
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
    if (Number(saved.schemaVersion) !== STORY_INFRA_WORK_SCHEMA_VERSION
        || saved.adapterVersion !== STORY_INFRA_WORK_ADAPTER_VERSION
        || !Array.isArray(saved.commands) || !Array.isArray(saved.receipts)
        || saved.commands.some(command => !command || !STORY_INFRA_WORK_STATUSES.includes(command.status))) {
        return { ok: false, code: 'INFRASTRUCTURE_WORK_SAVE_INVALID' };
    }
    state.infrastructureWorks = storyInfrastructureWorkClone(saved);
    storyInfrastructureWorkEnsure(state);
    return { ok: true, backfilled: false };
}

if (typeof module !== 'undefined' && module.exports) module.exports = {
    STORY_INFRA_WORK_POLICY,
    storyInfrastructureWorkEnsure,
    storyInfrastructureWorkPreflight,
    storyInfrastructureWorkSubmit,
    storyInfrastructureWorkReserveAndSubmit,
    storyInfrastructureWorkStart,
    storyInfrastructureWorkTick,
    storyInfrastructureWorkForSave,
    storyInfrastructureWorkRestore
};
