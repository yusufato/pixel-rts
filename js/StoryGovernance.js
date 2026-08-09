// ============================================================================
//  YONETIM CALISMA ALANI — Faz 33.1
//  ---------------------------------------------------------------------------
//  Oyuncu eylemini mevcut kurum (Faz 29), uygulama kapasitesi (Faz 30) ve
//  fiziksel kaynak defterlerine baglayan ilk dikey dilim. Bu katman yeni bir
//  anayasa veya paralel ekonomi uretmez. Kurumsal karar fisine alan-sahibi bir
//  domain makbuzu ekler; sonucu ancak kapasite fisi tamamlandiktan sonra uygular.
// ============================================================================

const STORY_GOVERNANCE_SCHEMA_VERSION = 1;
const STORY_GOVERNANCE_REVIEW_DELAY_SECONDS = 5;
const STORY_GOVERNANCE_TERMINAL_REQUESTS = Object.freeze([
    'DENIED', 'STALE_AUTHORITY', 'CANCELLED'
]);
const STORY_GOVERNANCE_TERMINAL_RESULTS = Object.freeze([
    'APPLIED', 'PAPER_ONLY', 'FAILED_JURISDICTION', 'SUPERSEDED', 'REFUNDED'
]);
const STORY_GOVERNANCE_ACTIONS = Object.freeze({
    PUBLIC_WORKS: Object.freeze({
        id: 'PUBLIC_WORKS',
        name: 'Kamu yatırım programı',
        description: 'Seçilen şehrin üretim, gelir ve garnizon kapasitesini bir kademe büyütür.',
        institutionActionType: 'ISSUE_LOCAL_ORDER',
        playerInstitutionTypes: Object.freeze(['EXECUTIVE']),
        cost: Object.freeze({ points: 120 }),
        resultType: 'REGION_LEVEL_UP'
    }),
    MOBILIZE_RESERVE: Object.freeze({
        id: 'MOBILIZE_RESERVE',
        name: 'Yerel ihtiyatı seferber et',
        description: 'Seçilen dost şehre bir garnizon birliği kazandırır.',
        institutionActionType: 'MOBILIZE_FORCE',
        playerInstitutionTypes: Object.freeze(['ARMED_FORCES']),
        cost: Object.freeze({ manpower: 70 }),
        resultType: 'REGION_GARRISON_UP'
    })
});

function storyGovernanceEnabled() {
    return (typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('government.playerGovernance'))
        && typeof storyInstitutionCountryView === 'function'
        && typeof storyStateCapacityCountryView === 'function';
}

function storyGovernanceClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyGovernanceRound(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 1e6) / 1e6 : 0;
}

function storyGovernanceCountryId(value) {
    const raw = String(value == null ? '' : value);
    return raw.startsWith('country:') ? raw : `country:${Number(value)}`;
}

function storyGovernanceRegionId(value) {
    const raw = String(value == null ? '' : value);
    return raw.startsWith('region:') ? raw : `region:${Number(value)}`;
}

function storyGovernanceRegionNode(regionId) {
    const nodeId = Number(String(regionId).split(':').pop());
    return (STORY.nodes || []).find(node => Number(node.id) === nodeId) || null;
}

function storyGovernancePlayerActorId(st) {
    return st && STORY.commander ? `character:${st.id}:${STORY.commander.id}` : null;
}

function storyGovernancePlayerContext() {
    const st = typeof storyPlayerState === 'function' ? storyPlayerState() : null;
    const countryId = st ? storyGovernanceCountryId(st.id) : null;
    const country = st && storyGovernanceEnabled() ? storyInstitutionCountryView(countryId) : null;
    const actorId = storyGovernancePlayerActorId(st);
    const heldInstitutions = country && actorId
        ? Object.values(country.institutions || {}).filter(row => (
            row.officeHolder && row.officeHolder.actorId === actorId
        )) : [];
    return { st, countryId, country, actorId, heldInstitutions };
}

function storyGovernanceRegionCap(node) {
    return typeof storyCityGarrisonCap === 'function'
        ? storyCityGarrisonCap(node)
        : Math.max(1, Number(node && node.level) || 1) * 4;
}

function storyGovernanceCostAvailable(ctx, action) {
    const cost = action.cost || {};
    if (cost.points) {
        const budget = typeof storyBudgetCountryView === 'function'
            ? storyBudgetCountryView(ctx.st) : null;
        const cash = budget ? Number(budget.cash) || 0
            : Number(ctx.st && ctx.st.res && ctx.st.res.points) || 0;
        if (cash + 1e-6 < cost.points) return {
            ok: false, reason: `Devlet bütçesinde ${cost.points} puan yok (mevcut ${Math.floor(cash)}).`
        };
    }
    if (cost.manpower) {
        const manpower = Number(STORY.commander && STORY.commander.res
            && STORY.commander.res.manpower) || 0;
        if (manpower + 1e-6 < cost.manpower) return {
            ok: false, reason: `Komuta havuzunda ${cost.manpower} insan gücü yok (mevcut ${Math.floor(manpower)}).`
        };
    }
    return { ok: true, reason: null };
}

function storyGovernanceDecisionOpen(request) {
    const decision = request && request.domainDecision;
    return !!(decision && !STORY_GOVERNANCE_TERMINAL_RESULTS.includes(
        decision.result && decision.result.status
    ));
}

function storyGovernanceActionView(actionId, targetRegionId) {
    const action = STORY_GOVERNANCE_ACTIONS[String(actionId)];
    const ctx = storyGovernancePlayerContext();
    const regionId = storyGovernanceRegionId(targetRegionId);
    const node = storyGovernanceRegionNode(regionId);
    const reasons = [];
    let institution = null;
    if (!storyGovernanceEnabled()) reasons.push('Yönetim eylemleri devre dışı.');
    if (!ctx.st || !ctx.country || !ctx.actorId) reasons.push('Oyuncu makam kimliği çözümlenemedi.');
    if (!action) reasons.push('Bilinmeyen yönetim eylemi.');
    if (action && ctx.country) {
        const route = ctx.country.authorityByAction[action.institutionActionType];
        institution = ctx.heldInstitutions.find(row => (
            action.playerInstitutionTypes.includes(row.type)
            && route && route.proposerInstitutionTypes.includes(row.type)
        )) || null;
        if (!institution) {
            const names = action.playerInstitutionTypes.map(type => (
                type === 'EXECUTIVE' ? 'Yürütme Makamı' : 'Silahlı Kuvvetler Komutası'
            )).join(' / ');
            reasons.push(`Bu karar için ${names} yetkisi gerekiyor.`);
        }
    }
    if (!node || !ctx.st || Number(node.owner) !== Number(ctx.st.id)) {
        reasons.push('Kendi yönetimindeki bir şehir seçmelisin.');
    } else if (action && action.resultType === 'REGION_LEVEL_UP' && Number(node.level || 1) >= 3) {
        reasons.push('Şehir zaten en yüksek gelişim kademesinde.');
    } else if (action && action.resultType === 'REGION_GARRISON_UP'
        && Number(node.garrison || 0) >= storyGovernanceRegionCap(node)) {
        reasons.push('Şehrin garnizon kapasitesi dolu.');
    }
    if (action && ctx.country) {
        const duplicate = (ctx.country.requests || []).find(request => (
            request.domainDecision && request.domainDecision.actionId === action.id
            && request.domainDecision.targetRegionId === regionId
            && storyGovernanceDecisionOpen(request)
        ));
        if (duplicate) reasons.push('Bu şehir için aynı karar zaten işlemde.');
        const funds = storyGovernanceCostAvailable(ctx, action);
        if (!funds.ok) reasons.push(funds.reason);
    }
    return {
        actionId: action ? action.id : String(actionId),
        name: action ? action.name : 'Bilinmeyen eylem',
        description: action ? action.description : '',
        institutionActionType: action ? action.institutionActionType : null,
        targetRegionId: regionId,
        cost: action ? storyGovernanceClone(action.cost) : {},
        allowed: reasons.length === 0,
        reasons,
        institution: institution ? {
            id: institution.id, type: institution.type,
            officeName: institution.officeHolder && institution.officeHolder.name
        } : null,
        alternativePath: institution ? null
            : 'Yetkili makama gelmeli veya Sohbet ekranından mevcut makam sahibiyle siyasi yol aramalısın.'
    };
}

function storyGovernanceResourceFlow(st, source, delta, correlationId) {
    if (typeof storyResourceFlow === 'function') {
        storyResourceFlow(st, source, delta, { correlationId });
    }
}

function storyGovernanceReserveCost(ctx, request, action) {
    const cost = action.cost || {};
    const correlationId = `governance:${request.id}`;
    let receipt = { ok: true, points: 0, manpower: 0, transactionId: null };
    if (cost.points) {
        const paid = typeof storyBudgetDebit === 'function'
            ? storyBudgetDebit(ctx.st, cost.points, 'governance.public_works', { correlationId })
            : { ok: false, code: 'BUDGET_LEDGER_MISSING' };
        if (!paid.ok) return paid;
        receipt.points = cost.points;
        receipt.transactionId = paid.transaction && paid.transaction.id || null;
        storyGovernanceResourceFlow(ctx.st, 'expense.governance.public_works', {
            points: -cost.points
        }, correlationId);
    }
    if (cost.manpower) {
        const commander = STORY.commander;
        const available = Number(commander && commander.res && commander.res.manpower) || 0;
        if (!commander || available + 1e-6 < cost.manpower) return {
            ok: false, code: 'INSUFFICIENT_MANPOWER'
        };
        commander.res.manpower = storyGovernanceRound(available - cost.manpower);
        receipt.manpower = cost.manpower;
        storyGovernanceResourceFlow(ctx.st, 'expense.governance.mobilization', {
            manpower: -cost.manpower
        }, correlationId);
    }
    return receipt;
}

function storyGovernanceRefundCost(request) {
    const decision = request && request.domainDecision;
    if (!decision || !decision.funds || decision.funds.status !== 'RESERVED') return false;
    const st = typeof storyState === 'function'
        ? storyState(Number(String(request.countryId).split(':').pop())) : null;
    if (!st) return false;
    const correlationId = `governance-refund:${request.id}`;
    if (decision.funds.points) {
        const credited = typeof storyBudgetCredit === 'function'
            ? storyBudgetCredit(st, decision.funds.points, 'governance.refund', {
                commander: STORY.commander, correlationId
            }) : { ok: false };
        if (!credited.ok) return false;
        storyGovernanceResourceFlow(st, 'refund.governance', {
            points: decision.funds.points
        }, correlationId);
    }
    if (decision.funds.manpower) {
        if (!STORY.commander || !STORY.commander.res) return false;
        STORY.commander.res.manpower = storyGovernanceRound(
            (Number(STORY.commander.res.manpower) || 0) + decision.funds.manpower
        );
        storyGovernanceResourceFlow(st, 'refund.governance', {
            manpower: decision.funds.manpower
        }, correlationId);
    }
    decision.funds.status = 'REFUNDED';
    decision.result = {
        status: 'REFUNDED', at: storyGovernanceRound(STORY.clock),
        physicalMutation: true, reason: request.status
    };
    return true;
}

function storyGovernanceSubmit(actionId, targetRegionId) {
    const action = STORY_GOVERNANCE_ACTIONS[String(actionId)];
    const available = storyGovernanceActionView(actionId, targetRegionId);
    if (!available.allowed || !action) return {
        ok: false, status: 'LOCKED', reasons: available.reasons,
        alternativePath: available.alternativePath
    };
    const ctx = storyGovernancePlayerContext();
    STORY._governanceRegionId = available.targetRegionId;
    const input = {
        countryId: ctx.countryId,
        actionType: action.institutionActionType,
        institutionId: available.institution.id,
        actorId: ctx.actorId
    };
    if (action.institutionActionType === 'ISSUE_LOCAL_ORDER') {
        input.targetRegionId = available.targetRegionId;
    }
    const submitted = storyInstitutionSubmitAction(input);
    if (!submitted.ok) return submitted;
    const request = STORY.institutions.requests[submitted.request.id];
    const node = storyGovernanceRegionNode(available.targetRegionId);
    request.domainDecision = {
        schemaVersion: STORY_GOVERNANCE_SCHEMA_VERSION,
        actionId: action.id,
        initiatedByPlayer: true,
        initiatorActorId: ctx.actorId,
        targetRegionId: available.targetRegionId,
        baseRegionLevel: Math.max(1, Number(node && node.level) || 1),
        baseGarrison: Math.max(0, Number(node && node.garrison) || 0),
        submittedAt: storyGovernanceRound(STORY.clock),
        funds: { status: 'PENDING', points: 0, manpower: 0, transactionId: null },
        result: null
    };
    const funds = storyGovernanceReserveCost(ctx, request, action);
    if (!funds.ok) {
        request.status = 'CANCELLED';
        request.updatedAt = storyGovernanceRound(STORY.clock);
        request.domainDecision.result = {
            status: 'REFUNDED', at: request.updatedAt,
            physicalMutation: false, reason: funds.code || 'COST_RESERVATION_FAILED'
        };
        return { ok: false, status: 'CANCELLED', reason: funds.code || 'COST_RESERVATION_FAILED' };
    }
    request.domainDecision.funds = Object.assign({ status: 'RESERVED' }, funds);
    if (typeof storyTelemetryEvent === 'function') {
        storyTelemetryEvent('governance.decision_submitted', {
            requestId: request.id, actionId: action.id, countryId: request.countryId,
            targetRegionId: available.targetRegionId, cost: storyGovernanceClone(action.cost)
        });
    }
    if (typeof storySave === 'function') storySave();
    return { ok: true, request: storyGovernanceClone(request) };
}

function storyGovernanceApproveNext(request, country) {
    const missingId = (request.requiredInstitutionIds || []).find(id => (
        !(request.approvalInstitutionIds || []).includes(id)
    ));
    if (!missingId) return false;
    const institution = country.institutions && country.institutions[missingId];
    if (!institution || !institution.officeHolder) return false;
    const result = storyInstitutionApproveAction(request.id, {
        institutionId: institution.id,
        actorId: institution.officeHolder.actorId
    });
    return !!result.ok;
}

function storyGovernanceExecute(request, country) {
    let actor = null;
    if (request.executorInstitutionId) {
        const institution = country.institutions && country.institutions[request.executorInstitutionId];
        if (institution && institution.officeHolder) actor = {
            institutionId: institution.id,
            actorId: institution.officeHolder.actorId
        };
    } else if (request.proposer && request.proposer.sourceKind === 'INSTITUTION') {
        actor = { institutionId: request.proposer.sourceId, actorId: request.proposer.actorId };
    }
    if (!actor) return false;
    const result = storyInstitutionExecuteAction(request.id, actor);
    return !!result.ok;
}

function storyGovernanceApplyResult(request, ticket) {
    const decision = request.domainDecision;
    if (!decision || decision.result) return false;
    decision.funds.status = 'COMMITTED';
    if (!ticket || !ticket.result || !ticket.result.effectReady) {
        if (ticket && ticket.status === 'PAPER_ONLY') {
            decision.result = {
                status: 'PAPER_ONLY', at: storyGovernanceRound(STORY.clock),
                physicalMutation: false,
                reasonCodes: storyGovernanceClone(ticket.result && ticket.result.reasonCodes || [])
            };
            return true;
        }
        return false;
    }
    const action = STORY_GOVERNANCE_ACTIONS[decision.actionId];
    const node = storyGovernanceRegionNode(decision.targetRegionId);
    const stateId = Number(String(request.countryId).split(':').pop());
    if (!action || !node || Number(node.owner) !== stateId) {
        decision.result = {
            status: 'FAILED_JURISDICTION', at: storyGovernanceRound(STORY.clock),
            physicalMutation: false, reason: 'TARGET_OUTSIDE_JURISDICTION'
        };
        return true;
    }
    let key;
    let nextValue;
    if (action.resultType === 'REGION_LEVEL_UP') {
        key = 'level';
        nextValue = Math.min(3, Math.max(1, Number(node.level) || 1) + 1);
    } else {
        key = 'garrison';
        nextValue = Math.min(storyGovernanceRegionCap(node), Math.max(0, Number(node.garrison) || 0) + 1);
    }
    if (Number(node[key]) === Number(nextValue)) {
        decision.result = {
            status: 'SUPERSEDED', at: storyGovernanceRound(STORY.clock),
            physicalMutation: false, reason: 'TARGET_ALREADY_AT_CAP'
        };
        return true;
    }
    const receipt = typeof storyCausalityRun === 'function'
        ? storyCausalityRun({
            type: 'governance.decision_effect',
            eventType: 'governance.physical_result',
            actor: { type: 'character', id: decision.initiatorActorId },
            target: { type: 'region', id: node.id },
            payload: { requestId: request.id, actionId: action.id, ticketId: ticket.id },
            idempotencyKey: `governance-effect:${request.id}`,
            correlationId: `governance:${request.id}`
        }, () => {
            const changed = typeof storyCausalitySet === 'function'
                ? storyCausalitySet(node, key, nextValue, {
                    target: { type: 'region', id: node.id },
                    path: `region:${node.id}.${key}`,
                    source: `governance.${action.id.toLowerCase()}`
                })
                : ((node[key] = nextValue), true);
            return { changed, key, value: nextValue };
        })
        : { applied: true, result: ((node[key] = nextValue), { changed: true, key, value: nextValue }) };
    if (!receipt.applied && !receipt.duplicate) return false;
    decision.result = {
        status: 'APPLIED', at: storyGovernanceRound(STORY.clock),
        physicalMutation: true, field: key, value: nextValue,
        ticketStatus: ticket.status,
        implementationQualityBps: ticket.result.implementationQualityBps,
        leakageBps: ticket.result.leakageBps,
        commandId: receipt.commandId || null
    };
    if (typeof storyTelemetryEvent === 'function') {
        storyTelemetryEvent('governance.decision_applied', {
            requestId: request.id, actionId: action.id, regionId: decision.targetRegionId,
            field: key, value: nextValue, ticketStatus: ticket.status
        });
    }
    if (typeof storyLog === 'function') {
        storyLog(`🏛️ <b>${node.name}</b>: ${action.name} sahada ${ticket.status === 'DEGRADED' ? 'eksik kaliteyle ' : ''}uygulandı.`);
    }
    return true;
}

function storyGovernanceTick() {
    if (!storyGovernanceEnabled() || !STORY.institutions) return { disabled: true };
    let changed = 0;
    const requests = Object.values(STORY.institutions.requests || {})
        .filter(request => request.domainDecision)
        .sort((a, b) => String(a.id).localeCompare(String(b.id), 'en'));
    for (const request of requests) {
        const decision = request.domainDecision;
        if (!decision || decision.result) continue;
        if (STORY_GOVERNANCE_TERMINAL_REQUESTS.includes(request.status)) {
            if (storyGovernanceRefundCost(request)) changed++;
            continue;
        }
        const country = STORY.institutions.countries[request.countryId];
        if (!country) continue;
        const age = (Number(STORY.clock) || 0) - (Number(request.updatedAt) || 0);
        if (request.status === 'PENDING_APPROVAL' && age >= STORY_GOVERNANCE_REVIEW_DELAY_SECONDS) {
            if (storyGovernanceApproveNext(request, country)) changed++;
            continue;
        }
        if (request.status === 'AUTHORIZED' && age >= STORY_GOVERNANCE_REVIEW_DELAY_SECONDS) {
            if (storyGovernanceExecute(request, country)) changed++;
            continue;
        }
        if (request.status !== 'EXECUTED') continue;
        const ticketId = typeof storyStateCapacityTicketId === 'function'
            ? storyStateCapacityTicketId(request.id) : `implementation:${request.id}`;
        const ticket = STORY.stateCapacity && STORY.stateCapacity.tickets
            && STORY.stateCapacity.tickets[ticketId];
        if (ticket && ['COMPLETED', 'DEGRADED', 'PAPER_ONLY'].includes(ticket.status)
            && storyGovernanceApplyResult(request, ticket)) changed++;
    }
    const characterActionSync = changed && typeof storyCharacterActionSyncDomainReceipts === 'function'
        ? storyCharacterActionSyncDomainReceipts() : { changed: 0 };
    if ((changed || characterActionSync.changed) && typeof storySave === 'function') storySave();
    return { disabled: false, decisionCount: requests.length, changed };
}

function storyGovernanceStatusLabel(request) {
    const decision = request.domainDecision || {};
    if (decision.result) {
        const labels = {
            APPLIED: 'SAHADA UYGULANDI', PAPER_ONLY: 'KÂĞITTA KALDI',
            FAILED_JURISDICTION: 'YETKİ ALANI KAYBEDİLDİ', SUPERSEDED: 'GEREKSİZ KALDI',
            REFUNDED: 'İPTAL / İADE'
        };
        return labels[decision.result.status] || decision.result.status;
    }
    if (request.status === 'PENDING_APPROVAL') return 'KURUM ONAYI BEKLİYOR';
    if (request.status === 'AUTHORIZED') return 'YÜRÜTME BEKLİYOR';
    if (request.status === 'EXECUTED') {
        const ticketId = `implementation:${request.id}`;
        const ticket = STORY.stateCapacity && STORY.stateCapacity.tickets
            && STORY.stateCapacity.tickets[ticketId];
        if (!ticket) return 'UYGULAMA KUYRUĞUNA GİRMEDİ';
        if (ticket.status === 'QUEUED') return 'İDARİ KAPASİTE BEKLİYOR';
        if (ticket.status === 'IMPLEMENTING') return `UYGULANIYOR %${Math.round(ticket.progressBps / 100)}`;
        return ticket.status;
    }
    return request.status;
}

function storyGovernancePlayerView() {
    const ctx = storyGovernancePlayerContext();
    if (!storyGovernanceEnabled() || !ctx.st || !ctx.country) return { disabled: true };
    const ownedRegions = (STORY.nodes || []).filter(node => Number(node.owner) === Number(ctx.st.id))
        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'tr'))
        .map(node => ({
            regionId: storyGovernanceRegionId(node.id), nodeId: node.id, name: node.name,
            level: Math.max(1, Number(node.level) || 1),
            garrison: Math.max(0, Number(node.garrison) || 0), cap: storyGovernanceRegionCap(node)
        }));
    const rememberedRegionId = String(STORY._governanceRegionId || '');
    const defaultRegionId = ownedRegions.some(row => row.regionId === rememberedRegionId)
        ? rememberedRegionId
        : ownedRegions.some(row => row.nodeId === Number(STORY.selectedNodeId))
            ? storyGovernanceRegionId(STORY.selectedNodeId)
            : (ownedRegions[0] && ownedRegions[0].regionId);
    const heldTypes = ctx.heldInstitutions.map(row => row.type);
    const role = heldTypes.includes('EXECUTIVE') ? 'CUMHURBAŞKANI'
        : heldTypes.includes('ARMED_FORCES') ? 'GENELKURMAY BAŞKANI'
            : 'KOMUTAN — KURUMSAL MAKAM YOK';
    const actions = Object.keys(STORY_GOVERNANCE_ACTIONS).map(actionId => (
        storyGovernanceActionView(actionId, defaultRegionId)
    ));
    const capacity = storyStateCapacityCountryView(ctx.countryId);
    const power = typeof storyPowerCenterCountryView === 'function'
        ? storyPowerCenterCountryView(ctx.countryId) : null;
    const centers = (power && power.centers || []).slice()
        .sort((a, b) => Number(b.influenceBps || 0) - Number(a.influenceBps || 0))
        .map(center => ({
            id: center.id, name: center.name, type: center.type,
            influenceBps: Number(center.influenceBps) || 0,
            leaderName: center.leader && center.leader.name || 'Kurumsal temsilci'
        }));
    const decisions = (ctx.country.requests || []).filter(request => request.domainDecision)
        .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
        .map(request => ({
            id: request.id, actionId: request.domainDecision.actionId,
            actionName: STORY_GOVERNANCE_ACTIONS[request.domainDecision.actionId]
                ? STORY_GOVERNANCE_ACTIONS[request.domainDecision.actionId].name : request.actionType,
            targetRegionId: request.domainDecision.targetRegionId,
            targetName: (ownedRegions.find(row => row.regionId === request.domainDecision.targetRegionId) || {}).name || 'Bölge',
            status: storyGovernanceStatusLabel(request),
            requiredApprovals: request.requiredInstitutionIds.length,
            receivedApprovals: request.approvalInstitutionIds.length,
            result: storyGovernanceClone(request.domainDecision.result),
            funds: storyGovernanceClone(request.domainDecision.funds)
        }));
    return {
        disabled: false, countryId: ctx.countryId, actorId: ctx.actorId, role,
        heldInstitutions: ctx.heldInstitutions.map(row => ({
            id: row.id, type: row.type, name: row.name,
            officeHolderName: row.officeHolder && row.officeHolder.name
        })),
        offices: Object.values(ctx.country.institutions || {}).map(row => {
            const heldByPlayer = row.officeHolder && row.officeHolder.actorId === ctx.actorId;
            const resignCandidate = heldByPlayer && typeof storyCharacterActionCandidate === 'function'
                ? storyCharacterActionCandidate({
                    actorId: ctx.actorId, targetActorId: null, actionType: 'RESIGN',
                    decisionSource: 'PLAYER_UI',
                    domainContext: { targetInstitutionId: row.id }
                }) : null;
            return {
                id: row.id, type: row.type, name: row.name,
                officeHolderName: row.officeHolder && row.officeHolder.name,
                heldByPlayer,
                resignAction: resignCandidate ? {
                    allowed: resignCandidate.allowed,
                    reasons: resignCandidate.reasons.slice(),
                    successorName: resignCandidate.domainValidation && resignCandidate.domainValidation.view
                        && resignCandidate.domainValidation.view.successorHolder
                        && resignCandidate.domainValidation.view.successorHolder.name || null
                } : null
            };
        }),
        ownedRegions, selectedRegionId: defaultRegionId, actions, decisions, centers,
        capacity: capacity ? {
            legitimacyBps: capacity.legitimacyBps,
            bureaucraticCapacityBps: capacity.bureaucraticCapacityBps,
            implementationCapacityBps: capacity.implementationCapacityBps,
            institutionalIntegrityBps: capacity.institutionalIntegrityBps
        } : null
    };
}

function storyGovernanceEscape(value) {
    return typeof storyProjectionEscape === 'function'
        ? storyProjectionEscape(String(value == null ? '' : value))
        : String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
}

function storyGovernanceCostLabel(cost) {
    const parts = [];
    if (cost && cost.points) parts.push(`${cost.points} bütçe puanı`);
    if (cost && cost.manpower) parts.push(`${cost.manpower} insan gücü`);
    return parts.join(' + ') || 'Kaynak maliyeti yok';
}

function storyGovernanceRenderHtml(view) {
    if (!view || view.disabled) return '<div class="governance-empty">Yönetim çalışma alanı kullanılamıyor.</div>';
    const selected = view.selectedRegionId || '';
    const regionOptions = view.ownedRegions.map(region => (
        `<option value="${storyGovernanceEscape(region.regionId)}"${region.regionId === selected ? ' selected' : ''}>`
        + `${storyGovernanceEscape(region.name)} · sv.${region.level} · garnizon ${region.garrison}/${region.cap}</option>`
    )).join('');
    const cap = view.capacity;
    const capacityHtml = cap ? `<div class="governance-metrics">`
        + `<span>MEŞRUİYET <b>%${Math.round(cap.legitimacyBps / 100)}</b></span>`
        + `<span>BÜROKRASİ <b>%${Math.round(cap.bureaucraticCapacityBps / 100)}</b></span>`
        + `<span>UYGULAMA <b>%${Math.round(cap.implementationCapacityBps / 100)}</b></span>`
        + `<span>BÜTÜNLÜK <b>%${Math.round(cap.institutionalIntegrityBps / 100)}</b></span></div>` : '';
    const officesHtml = view.offices.map(office => {
        const armed = STORY._governanceResignConfirmId === office.id;
        const resign = office.resignAction && office.heldByPlayer
            ? (office.resignAction.allowed
                ? `<small>GEÇİCİ HALEF · ${storyGovernanceEscape(office.resignAction.successorName || 'belirlenemedi')}</small>`
                    + `<button class="story-btn governance-resign${armed ? ' armed' : ''}" data-governance-resign="${storyGovernanceEscape(office.id)}">`
                    + `${armed ? 'İSTİFAYI ONAYLA' : 'İSTİFAYI HAZIRLA'}</button>`
                : `<small class="governance-lock">${storyGovernanceEscape(office.resignAction.reasons.join(' '))}</small>`)
            : '';
        return `<div class="governance-office${office.heldByPlayer ? ' is-player' : ''}">`
            + `<b>${storyGovernanceEscape(office.name)}</b><span>${storyGovernanceEscape(office.officeHolderName)}`
            + `${office.heldByPlayer ? ' · SEN' : ''}</span>${resign}</div>`;
    }).join('');
    const actionHtml = view.actions.map(action => `<article class="governance-action${action.allowed ? '' : ' locked'}">`
        + `<h4>${storyGovernanceEscape(action.name)}</h4><p>${storyGovernanceEscape(action.description)}</p>`
        + `<small>MALIYET · ${storyGovernanceEscape(storyGovernanceCostLabel(action.cost))}</small>`
        + (action.allowed
            ? `<button class="story-btn governance-submit" data-governance-action="${storyGovernanceEscape(action.actionId)}">KARARI BAŞLAT</button>`
            : `<div class="governance-lock">${storyGovernanceEscape(action.reasons.join(' '))}</div>`
                + `<div class="governance-path">ALTERNATIF · ${storyGovernanceEscape(action.alternativePath || '')}</div>`)
        + `</article>`).join('');
    const decisionHtml = view.decisions.length ? view.decisions.map(decision => (
        `<div class="governance-decision"><b>${storyGovernanceEscape(decision.actionName)}</b>`
        + `<span>${storyGovernanceEscape(decision.targetName)} · ${storyGovernanceEscape(decision.status)}</span>`
        + `<small>ONAY ${decision.receivedApprovals}/${decision.requiredApprovals}</small></div>`
    )).join('') : '<div class="governance-empty">Henüz oyuncunun başlattığı kurumsal karar yok.</div>';
    const centersHtml = view.centers.slice(0, 4).map(center => (
        `<div class="governance-center"><b>${storyGovernanceEscape(center.name)}</b>`
        + `<span>${storyGovernanceEscape(center.leaderName)} · etki %${Math.round(center.influenceBps / 100)}</span></div>`
    )).join('') || '<div class="governance-empty">Güç merkezi verisi yok.</div>';
    return `<section class="governance-workspace">`
        + `<div class="governance-role"><span>MEVCUT ROLÜN</span><b>${storyGovernanceEscape(view.role)}</b></div>`
        + capacityHtml
        + `<label class="governance-region-label">HEDEF ŞEHİR<select id="governance-region-select">${regionOptions}</select></label>`
        + `<h3>YETKILI EYLEMLER</h3><div class="governance-actions">${actionHtml}</div>`
        + `<h3>BEKLEYEN ONAYLAR VE UYGULAMA</h3><div class="governance-decisions">${decisionHtml}</div>`
        + `<h3>MAKAMLAR</h3><div class="governance-offices">${officesHtml}</div>`
        + `<h3>GÜÇ MERKEZLERİ</h3><div class="governance-centers">${centersHtml}</div>`
        + `<div class="governance-promises">SÖZLER · Kalıcı karakter söz defteri Faz 38'de açılacak; burada sahte söz kaydı gösterilmez.</div>`
        + `</section>`;
}

function storyGovernanceUpdate() {
    const body = typeof document !== 'undefined' && document.getElementById('governance-body');
    if (!body) return null;
    const view = storyGovernancePlayerView();
    const html = storyGovernanceRenderHtml(view);
    if (body.innerHTML !== html) body.innerHTML = html;
    return view;
}

function storyGovernanceHandleClick(event) {
    const resignButton = event && event.target && event.target.closest
        ? event.target.closest('[data-governance-resign]') : null;
    if (resignButton && !resignButton.disabled) {
        const institutionId = resignButton.dataset.governanceResign;
        if (STORY._governanceResignConfirmId !== institutionId) {
            STORY._governanceResignConfirmId = institutionId;
            if (typeof storyFlash === 'function') storyFlash('İstifa makamı kalıcı olarak devreder. İkinci kez onayla.');
            storyGovernanceUpdate();
            return { ok: false, status: 'CONFIRMATION_REQUIRED', institutionId };
        }
        STORY._governanceResignConfirmId = null;
        const result = typeof storyCharacterActionExecutePlayer === 'function'
            ? storyCharacterActionExecutePlayer('RESIGN', null, { targetInstitutionId: institutionId })
            : { ok: false, reason: 'CHARACTER_ACTION_EXECUTOR_UNAVAILABLE' };
        if (typeof storyFlash === 'function') {
            const successor = result.receipt && result.receipt.domainReceipt
                && result.receipt.domainReceipt.successorHolder;
            storyFlash(result.ok
                ? `İstifa yürürlüğe girdi. Geçici halef: ${successor && successor.name || 'belirlenemedi'}.`
                : (result.reason || (result.candidate && result.candidate.reasons[0]) || 'İstifa uygulanamadı.'));
        }
        storyGovernanceUpdate();
        return result;
    }
    const button = event && event.target && event.target.closest
        ? event.target.closest('[data-governance-action]') : null;
    if (!button || button.disabled) return false;
    const select = document.getElementById('governance-region-select');
    const result = storyGovernanceSubmit(button.dataset.governanceAction, select && select.value);
    if (typeof storyFlash === 'function') {
        storyFlash(result.ok ? 'Karar kurumsal onay zincirine girdi.'
            : ((result.reasons && result.reasons[0]) || result.reason || 'Karar başlatılamadı.'));
    }
    storyGovernanceUpdate();
    return result;
}

function storyGovernanceHandleChange(event) {
    const select = event && event.target && event.target.closest
        ? event.target.closest('#governance-region-select') : null;
    if (!select) return false;
    STORY._governanceRegionId = select.value;
    storyGovernanceUpdate();
    return true;
}
