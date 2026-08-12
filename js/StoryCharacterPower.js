// ═══════════════════════════════════════════════════════════════════════════
//  TÜRETİLMİŞ KARAKTER GÜCÜ — Faz 38.10
//  Güç saklanan bonus değildir. Bu salt-okunur görünüm yalnız kanonik makam,
//  şirket, ilişki ve bilgi kayıtlarından yeniden hesaplanır.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_CHARACTER_POWER_SCHEMA_VERSION = 1;

function storyCharacterPowerEnabled() {
    return typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('characters.derivedPower');
}
function storyCharacterPowerClamp(value) {
    return Math.max(0, Math.min(10000, Math.round(Number(value) || 0)));
}
function storyCharacterPowerView(actorId) {
    if (!storyCharacterPowerEnabled()) return { ok: false, code: 'FEATURE_DISABLED', worldMutation: false };
    const actor = typeof storyCharacterIdentityView === 'function'
        ? storyCharacterIdentityView(actorId) : null;
    if (!actor) return { ok: false, code: 'ACTOR_NOT_FOUND', worldMutation: false };
    const adapterView = typeof storyCharacterRoleAdapterView === 'function'
        ? storyCharacterRoleAdapterView(actor.id) : null;
    const adapter = adapterView && adapterView.ok ? adapterView.adapter : null;
    const company = adapter && adapter.organizationId && typeof storyCompanyById === 'function'
        ? storyCompanyById(adapter.organizationId) : null;
    const authorityRoutes = adapter ? adapter.authorityRoutes || [] : [];
    const institutional = storyCharacterPowerClamp(authorityRoutes.reduce((sum, route) =>
        sum + (route.canExecute ? 1100 : 0) + (route.canApprove ? 700 : 0)
        + (route.canPropose ? 350 : 0), 0));
    const economic = company ? storyCharacterPowerClamp(
        (Number(company.accounts && company.accounts['ASSET:CASH']) || 0) * 12
        + (company.facilityIds || []).length * 650
        + (company.warehouseIds || []).length * 350
    ) : 0;
    const military = adapter && adapter.institutionalBindings.some(row => row.institutionType === 'ARMED_FORCES')
        ? storyCharacterPowerClamp(3000 + authorityRoutes.filter(row =>
            ['DECLARE_WAR', 'MOBILIZE_FORCE', 'APPOINT_COMMANDER', 'DISMISS_COMMANDER'].includes(row.actionType)
        ).length * 900) : 0;
    const relationshipLedger = typeof storyRelationshipEnsure === 'function'
        ? storyRelationshipEnsure() : null;
    const incoming = Object.values(relationshipLedger && relationshipLedger.edges || {})
        .filter(edge => edge.toActorId === actor.id);
    const network = incoming.length ? storyCharacterPowerClamp(incoming.reduce((sum, edge) =>
        sum + Number(edge.trustBps) * 0.35 + Number(edge.respectBps) * 0.45
        + Number(edge.debtBps) * 0.2 - Number(edge.hostilityBps) * 0.25, 0) / incoming.length) : 0;
    const identityLedger = typeof storyCharacterIdentityEnsure === 'function'
        ? storyCharacterIdentityEnsure() : null;
    const beliefs = Object.values(identityLedger && identityLedger.actorBeliefs || {})
        .filter(row => row.holderActorId === actor.id);
    const information = storyCharacterPowerClamp(beliefs.reduce((sum, row) =>
        sum + Math.min(1200, Number(row.confidenceBps) * 0.12), 0));
    const sources = {
        institutional: { status: authorityRoutes.length ? 'AVAILABLE' : 'NOT_APPLICABLE',
            valueBps: institutional, evidenceCount: authorityRoutes.length },
        economic: { status: company ? 'AVAILABLE' : 'NOT_APPLICABLE', valueBps: economic,
            evidenceCount: company ? (company.facilityIds || []).length + 1 : 0 },
        military: { status: military ? 'AVAILABLE' : 'NOT_APPLICABLE', valueBps: military,
            evidenceCount: military ? 1 : 0 },
        network: { status: incoming.length ? 'AVAILABLE' : 'NO_EDGES', valueBps: network,
            evidenceCount: incoming.length },
        information: { status: beliefs.length ? 'AVAILABLE' : 'NO_HELD_BELIEFS',
            valueBps: information, evidenceCount: beliefs.length },
        media: { status: 'UNAVAILABLE', valueBps: null, evidenceCount: 0 },
        publicBase: { status: 'UNAVAILABLE', valueBps: null, evidenceCount: 0 },
        expertise: { status: 'UNAVAILABLE', valueBps: null, evidenceCount: 0 },
        legal: { status: 'MERGED_INTO_INSTITUTIONAL', valueBps: null, evidenceCount: 0 }
    };
    const available = Object.values(sources).filter(source => source.status === 'AVAILABLE');
    const totalBps = storyCharacterPowerClamp(available.length
        ? available.reduce((sum, source) => sum + source.valueBps, 0) / available.length : 0);
    return {
        ok: true, code: 'DERIVED_POWER_READY',
        power: {
            schemaVersion: STORY_CHARACTER_POWER_SCHEMA_VERSION,
            actorId: actor.id, totalBps,
            sources,
            storedCareerInfluenceUsed: false,
            storedPowerBonus: null,
            canonicalLedgerReadOnly: true,
            worldMutation: false
        },
        worldMutation: false
    };
}
