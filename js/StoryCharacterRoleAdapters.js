// ═══════════════════════════════════════════════════════════════════════════
//  KURUMSAL KARAKTER ROL ADAPTÖRLERİ — Faz 38.9
//  Rol/unvan yetki değildir. Bu salt-okunur katalog karakter kimliğini gerçek
//  kurum, şirket veya servis kaydıyla eşler; yürütücüsü olmayan bağı açıkça
//  CONTRACT_ONLY bırakır.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_CHARACTER_ROLE_ADAPTER_SCHEMA_VERSION = 1;

const STORY_CHARACTER_ROLE_ADAPTER_CATALOG = Object.freeze({
    COMPANY: Object.freeze({
        identitySource: 'CHARACTER_IDENTITY', bindingSource: 'COMPANY_LEDGER',
        executorStatus: 'LIMITED_COMPANY_EXECUTORS', institutionAvailable: true
    }),
    GOVERNMENT: Object.freeze({
        identitySource: 'CHARACTER_IDENTITY', bindingSource: 'INSTITUTION_OFFICE_HOLDER',
        executorStatus: 'INSTITUTION_ROUTE_REQUIRED', institutionAvailable: true
    }),
    INTELLIGENCE: Object.freeze({
        identitySource: 'CHARACTER_IDENTITY_SERVICE_REFERENCE', bindingSource: null,
        executorStatus: 'CONTRACT_ONLY', institutionAvailable: false
    }),
    MILITARY: Object.freeze({
        identitySource: 'CHARACTER_IDENTITY', bindingSource: 'INSTITUTION_OFFICE_HOLDER',
        executorStatus: 'INSTITUTION_ROUTE_REQUIRED', institutionAvailable: true
    }),
    MEDIA: Object.freeze({
        identitySource: null, bindingSource: null,
        executorStatus: 'UNAVAILABLE', institutionAvailable: false
    }),
    PERSONAL: Object.freeze({
        identitySource: 'CHARACTER_IDENTITY', bindingSource: null,
        executorStatus: 'PERSONAL_AGENCY', institutionAvailable: true
    })
});

function storyCharacterRoleAdapterEnabled() {
    return typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('characters.roleAdapters');
}
function storyCharacterRoleAdapterClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}
function storyCharacterRoleAdapterFamily(role) {
    const key = String(role || '').toUpperCase();
    if (['COMPANY_OWNER', 'COMPANY_EXECUTIVE'].includes(key)) return 'COMPANY';
    if (['EXECUTIVE', 'POLITICAL_FIGURE', 'POLITICAL_CANDIDATE', 'MAYOR'].includes(key)) return 'GOVERNMENT';
    if (key === 'AGENT') return 'INTELLIGENCE';
    if (['COMMANDER', 'GENERAL', 'OFFICER', 'SOLDIER'].includes(key)) return 'MILITARY';
    if (['JOURNALIST', 'EDITOR', 'MEDIA_OWNER'].includes(key)) return 'MEDIA';
    return 'PERSONAL';
}
function storyCharacterRoleAdapterCatalog() {
    return {
        schemaVersion: STORY_CHARACTER_ROLE_ADAPTER_SCHEMA_VERSION,
        families: storyCharacterRoleAdapterClone(STORY_CHARACTER_ROLE_ADAPTER_CATALOG),
        rules: {
            titleGrantsAuthority: false,
            generalNegotiationMechanical: false,
            missingExecutorMayMutateWorld: false
        },
        worldMutation: false
    };
}
function storyCharacterRoleAdapterInstitutionBindings(actorId) {
    const ledger = typeof storyInstitutionEnsure === 'function' ? storyInstitutionEnsure() : null;
    const rows = [];
    for (const country of Object.values(ledger && ledger.countries || {})) {
        for (const institution of Object.values(country.institutions || {})) {
            if (institution.officeHolder && institution.officeHolder.actorId === actorId) {
                rows.push({
                    institutionId: institution.id, institutionType: institution.type,
                    countryId: country.countryId, status: institution.status,
                    authorityGrantCount: (institution.authorityGrants || []).length,
                    authorityGrants: (institution.authorityGrants || []).map(grant => ({
                        actionType: grant.actionType,
                        canPropose: grant.canPropose === true,
                        canApprove: grant.canApprove === true,
                        canExecute: grant.canExecute === true,
                        legalBasis: grant.legalBasis || null
                    })).sort((a, b) => a.actionType.localeCompare(b.actionType, 'en'))
                });
            }
        }
    }
    return rows.sort((a, b) => a.institutionId.localeCompare(b.institutionId, 'en'));
}
function storyCharacterRoleAdapterView(actorId) {
    if (!storyCharacterRoleAdapterEnabled()) return {
        ok: false, code: 'FEATURE_DISABLED', worldMutation: false
    };
    const actor = typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(actorId) : null;
    if (!actor) return { ok: false, code: 'ACTOR_NOT_FOUND', worldMutation: false };
    const family = storyCharacterRoleAdapterFamily(actor.role);
    const institutions = storyCharacterRoleAdapterInstitutionBindings(actor.id);
    const company = actor.organizationId && typeof storyCompanyById === 'function'
        ? storyCompanyById(actor.organizationId) : null;
    const identityServiceBound = family === 'INTELLIGENCE' && !!actor.serviceId;
    const actorRoleGoals = (actor.goals || []).filter(goal => goal.kind === 'ROLE');
    const actorPersonalGoals = (actor.goals || []).filter(goal => goal.kind === 'PERSONAL');
    let bindingStatus = 'PERSONAL_ONLY';
    let executorStatus = 'PERSONAL_AGENCY';
    let bindingEvidence = [];
    let capabilities = ['PERSONAL_RELATIONSHIP'];
    if (family === 'COMPANY') {
        bindingStatus = company ? 'CANONICAL_ORGANIZATION_BOUND' : 'ORGANIZATION_BINDING_MISSING';
        executorStatus = company ? 'LIMITED_COMPANY_EXECUTORS' : 'UNAVAILABLE';
        bindingEvidence = company ? [{ type: 'COMPANY_LEDGER', id: company.id }] : [];
        capabilities = company ? ['COMPANY_NEGOTIATION_REPRESENTATION', 'COMPANY_APPLICATION'] : [];
    } else if (family === 'GOVERNMENT' || family === 'MILITARY') {
        bindingStatus = institutions.length ? 'CANONICAL_OFFICE_BOUND' : 'OFFICE_BINDING_MISSING';
        executorStatus = institutions.length ? 'INSTITUTION_ROUTE_REQUIRED' : 'UNAVAILABLE';
        bindingEvidence = institutions.map(row => ({ type: 'INSTITUTION_OFFICE', id: row.institutionId }));
        capabilities = institutions.map(row => `INSTITUTION:${row.institutionType}`);
    } else if (family === 'INTELLIGENCE') {
        bindingStatus = identityServiceBound ? 'IDENTITY_SERVICE_BOUND' : 'SERVICE_BINDING_MISSING';
        executorStatus = 'CONTRACT_ONLY';
        bindingEvidence = identityServiceBound ? [{ type: 'IDENTITY_SERVICE_REFERENCE', id: actor.serviceId }] : [];
        capabilities = identityServiceBound ? ['COVERT_ACTION_CONTRACT_ONLY'] : [];
    } else if (family === 'MEDIA') {
        bindingStatus = 'MEDIA_INSTITUTION_MISSING';
        executorStatus = 'UNAVAILABLE';
        capabilities = [];
    }
    return {
        ok: true, code: 'ROLE_ADAPTER_VIEW',
        adapter: {
            schemaVersion: STORY_CHARACTER_ROLE_ADAPTER_SCHEMA_VERSION,
            actorId: actor.id, role: actor.role, family,
            bindingStatus, executorStatus,
            bindingEvidence, capabilities,
            institutionalBindings: institutions,
            authorityRoutes: institutions.flatMap(row => row.authorityGrants.map(grant => ({
                institutionId: row.institutionId,
                institutionType: row.institutionType,
                countryId: row.countryId,
                ...grant
            }))),
            organizationId: company ? company.id : null,
            serviceId: identityServiceBound ? actor.serviceId : null,
            goalBoundary: {
                actorRoleGoalIds: actorRoleGoals.map(goal => goal.id),
                actorPersonalGoalIds: actorPersonalGoals.map(goal => goal.id),
                organizationGoalIds: [], institutionGoalIds: [],
                organizationGoalLedgerAvailable: false,
                institutionGoalLedgerAvailable: false,
                actorRoleGoalIsOrganizationGoal: false,
                actorPersonalGoalIsInstitutionGoal: false
            },
            titleGrantsAuthority: false,
            generalNegotiationMechanical: false,
            worldMutation: false
        },
        worldMutation: false
    };
}

function storyCharacterRoleInstitutionPhaseCapability(phase) {
    const key = String(phase || '').toUpperCase();
    return { PROPOSE: 'canPropose', APPROVE: 'canApprove', EXECUTE: 'canExecute' }[key] || null;
}
function storyCharacterRoleInstitutionActionPreview(input) {
    input = input || {};
    const phase = String(input.phase || '').toUpperCase();
    const capability = storyCharacterRoleInstitutionPhaseCapability(phase);
    if (!capability) return { ok: false, code: 'UNKNOWN_INSTITUTION_PHASE', worldMutation: false };
    const view = storyCharacterRoleAdapterView(input.actorId);
    if (!view.ok) return view;
    const adapter = view.adapter;
    if (!['GOVERNMENT', 'MILITARY'].includes(adapter.family)) {
        return { ok: false, code: 'INSTITUTIONAL_ROLE_REQUIRED', worldMutation: false };
    }
    if (adapter.bindingStatus !== 'CANONICAL_OFFICE_BOUND') {
        return { ok: false, code: 'CANONICAL_OFFICE_REQUIRED', worldMutation: false };
    }
    const ledger = typeof storyInstitutionEnsure === 'function' ? storyInstitutionEnsure() : null;
    const request = input.requestId && ledger && ledger.requests
        ? ledger.requests[String(input.requestId)] : null;
    if (phase !== 'PROPOSE' && !request) {
        return { ok: false, code: 'INSTITUTION_REQUEST_REQUIRED', worldMutation: false };
    }
    const actionType = String(request ? request.actionType : input.actionType || '');
    if (!actionType) return { ok: false, code: 'ACTION_TYPE_REQUIRED', worldMutation: false };
    const eligibleRoutes = adapter.authorityRoutes.filter(route =>
        route.actionType === actionType && route[capability] === true
        && (!request || route.institutionId.startsWith(`institution:${request.countryId}:`))
        && (phase !== 'APPROVE' || request.requiredInstitutionIds.includes(route.institutionId))
        && (phase !== 'EXECUTE' || request.executorInstitutionId === route.institutionId));
    if (!eligibleRoutes.length) {
        return { ok: false, code: `ACTOR_NOT_AUTHORIZED_TO_${phase}`, worldMutation: false };
    }
    return {
        ok: true, code: 'INSTITUTION_ROLE_ROUTE_READY', phase, actionType,
        requestId: request ? request.id : null,
        route: storyCharacterRoleAdapterClone(eligibleRoutes[0]),
        actorId: adapter.actorId, worldMutation: false
    };
}
function storyCharacterRoleInstitutionAction(input) {
    const preview = storyCharacterRoleInstitutionActionPreview(input);
    if (!preview.ok) return preview;
    const actorInput = {
        actorId: preview.actorId,
        institutionId: preview.route.institutionId
    };
    let result;
    if (preview.phase === 'PROPOSE') {
        result = typeof storyInstitutionSubmitAction === 'function'
            ? storyInstitutionSubmitAction({
                ...actorInput, countryId: preview.route.countryId,
                actionType: preview.actionType,
                targetRegionId: input && input.targetRegionId
            }) : { ok: false, reason: 'INSTITUTION_EXECUTOR_MISSING' };
    } else if (preview.phase === 'APPROVE') {
        result = typeof storyInstitutionApproveAction === 'function'
            ? storyInstitutionApproveAction(preview.requestId, actorInput)
            : { ok: false, reason: 'INSTITUTION_EXECUTOR_MISSING' };
    } else {
        result = typeof storyInstitutionExecuteAction === 'function'
            ? storyInstitutionExecuteAction(preview.requestId, actorInput)
            : { ok: false, reason: 'INSTITUTION_EXECUTOR_MISSING' };
    }
    return {
        ok: result.ok === true,
        code: result.ok ? `INSTITUTION_ROLE_${preview.phase}_APPLIED`
            : (result.reason || 'INSTITUTION_ROLE_ACTION_REJECTED'),
        phase: preview.phase, actionType: preview.actionType,
        actorId: preview.actorId, route: preview.route,
        request: result.request || null,
        worldMutation: result.ok === true
    };
}

function storyCharacterRoleInstitutionReviewPreview(input) {
    input = input || {};
    const routePreview = storyCharacterRoleInstitutionActionPreview({
        phase: 'APPROVE', actorId: input.actorId, requestId: input.requestId
    });
    if (!routePreview.ok) return routePreview;
    const actor = typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(input.actorId) : null;
    if (!actor) return { ok: false, code: 'ACTOR_NOT_FOUND', worldMutation: false };
    const securityActions = new Set([
        'DECLARE_WAR', 'MOBILIZE_FORCE', 'CONTAIN_VIOLENCE',
        'APPOINT_COMMANDER', 'DISMISS_COMMANDER'
    ]);
    const constitutionalActions = new Set(['ENACT_LAW', 'AMEND_CONSTITUTION', 'REVIEW_LEGALITY']);
    const economicActions = new Set(['AUTHORIZE_BUDGET', 'ISSUE_LOCAL_ORDER']);
    const evidence = [];
    let supportScore = 50;
    const addAxis = (axis, value, weight, reasonCode) => {
        const centered = Number(value) - 50;
        const contribution = Math.round(centered * weight * 100) / 100;
        supportScore += contribution;
        evidence.push({ axis, value: Number(value), weight, contribution, reasonCode });
    };
    if (securityActions.has(routePreview.actionType)) {
        addAxis('values.hawkishness', actor.values && actor.values.hawkishness, 0.9,
            'SECURITY_ESCALATION_POSTURE');
        addAxis('coreAxes.institutionalPosture', actor.coreAxes && actor.coreAxes.institutionalPosture,
            0.25, 'CHAIN_OF_COMMAND_POSTURE');
    } else if (constitutionalActions.has(routePreview.actionType)) {
        addAxis('coreAxes.institutionalPosture', actor.coreAxes && actor.coreAxes.institutionalPosture,
            0.7, 'INSTITUTIONAL_CHANGE_POSTURE');
        addAxis('values.libertyAuthority', actor.values && actor.values.libertyAuthority,
            0.25, 'LEGAL_ORDER_POSTURE');
    } else if (economicActions.has(routePreview.actionType)) {
        addAxis('coreAxes.stateMarketOrientation', actor.coreAxes && actor.coreAxes.stateMarketOrientation,
            0.6, 'STATE_MARKET_POSTURE');
        addAxis('values.publicResponsiveness', actor.values && actor.values.publicResponsiveness,
            0.25, 'PUBLIC_RESPONSIVENESS');
    } else {
        addAxis('coreAxes.institutionalPosture', actor.coreAxes && actor.coreAxes.institutionalPosture,
            0.5, 'GENERAL_INSTITUTIONAL_POSTURE');
    }
    supportScore = Math.max(0, Math.min(100, Math.round(supportScore * 100) / 100));
    const recommendation = supportScore < 30 ? 'REJECT'
        : supportScore < 45 ? 'OBJECT' : 'APPROVE';
    return {
        ok: true, code: 'INSTITUTION_ROLE_REVIEW_READY',
        actorId: actor.id, requestId: routePreview.requestId,
        actionType: routePreview.actionType, route: routePreview.route,
        supportScore, recommendation, evidence,
        thresholds: { rejectBelow: 30, objectBelow: 45 },
        randomDecision: false, llmDecision: false,
        rawWorldRead: false, applied: false, worldMutation: false
    };
}
function storyCharacterRoleInstitutionReviewApply(input) {
    const review = storyCharacterRoleInstitutionReviewPreview(input);
    if (!review.ok) return review;
    if (review.recommendation === 'OBJECT') {
        return {
            ok: true, code: 'INSTITUTION_ROLE_OBJECTION_RECORDED_AS_PROPOSAL',
            review, request: null, applied: false, worldMutation: false
        };
    }
    const actorInput = { actorId: review.actorId, institutionId: review.route.institutionId };
    const result = review.recommendation === 'REJECT'
        ? storyInstitutionRejectAction(review.requestId, {
            ...actorInput, reasonCode: 'CHARACTER_ROLE_REVIEW_REJECTED'
        })
        : storyInstitutionApproveAction(review.requestId, actorInput);
    return {
        ok: result.ok === true,
        code: result.ok
            ? `INSTITUTION_ROLE_REVIEW_${review.recommendation}_APPLIED`
            : (result.reason || 'INSTITUTION_ROLE_REVIEW_REJECTED'),
        review, request: result.request || null,
        applied: result.ok === true,
        worldMutation: result.ok === true
    };
}
