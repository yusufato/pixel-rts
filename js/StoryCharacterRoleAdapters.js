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
