// ============================================================================
//  REJIM VE KURUM YETKISI — Faz 29
//  --------------------------------------------------------------------------
//  Mevcut anayasa etiketi, hukumet lideri, komutanlar ve Faz 28 guc merkezleri
//  tek bir yasal-yetki sozlesmesine projekte edilir. Bu katman fiziksel dunya
//  sonucunu kendi basina uygulamaz: bir eylemi yalniz DIRECT / JOINT / PETITION
//  / PROHIBITED rotasina yerlestirir, gerekli makam onaylarini dogrular ve tek
//  kullanimlik karar kaydini sonuclandirir. LLM, fraksiyon puani veya istemci
//  payload'i makam, yetki, onay ya da yasal dayanak uretemez.
// ============================================================================

const STORY_INSTITUTION_SCHEMA_VERSION = 1;
const STORY_INSTITUTION_ADAPTER_VERSION = 'story-institution-authority-ledger-1';
const STORY_INSTITUTION_TYPES = Object.freeze([
    'EXECUTIVE', 'LEGISLATURE', 'JUDICIARY', 'ARMED_FORCES', 'LOCAL_ADMINISTRATION'
]);
const STORY_INSTITUTION_REQUEST_STATUSES = Object.freeze([
    'PENDING_APPROVAL', 'AUTHORIZED', 'EXECUTED', 'DENIED', 'STALE_AUTHORITY', 'CANCELLED'
]);

const STORY_INSTITUTION_DEFS = Object.freeze({
    EXECUTIVE: Object.freeze({ name: 'Yürütme Makamı', scope: 'COUNTRY' }),
    LEGISLATURE: Object.freeze({ name: 'Yasama Meclisi', scope: 'COUNTRY' }),
    JUDICIARY: Object.freeze({ name: 'Yargı Kurumu', scope: 'COUNTRY' }),
    ARMED_FORCES: Object.freeze({ name: 'Silahlı Kuvvetler Komutası', scope: 'COUNTRY' }),
    LOCAL_ADMINISTRATION: Object.freeze({ name: 'Yerel İdareler', scope: 'REGION' })
});

// proposerInstitutionTypes / proposerPowerCenterTypes basvuru hakkidir; karar
// hakkini requiredInstitutionTypes belirler. Etki modeli Faz 29'da bilerek
// kayitla sinirlidir; sonraki domain fazlari bu yetki fisini tuketecektir.
const STORY_INSTITUTION_ACTIONS = Object.freeze({
    ENACT_LAW: Object.freeze({ executor: 'LEGISLATURE', scope: 'COUNTRY', proposers: ['EXECUTIVE', 'LEGISLATURE'], centers: ['BUSINESS_COUNCIL', 'LABOR_CONFEDERATION', 'CIVIL_SERVICE'] }),
    AMEND_CONSTITUTION: Object.freeze({ executor: 'LEGISLATURE', scope: 'COUNTRY', proposers: ['EXECUTIVE', 'LEGISLATURE', 'JUDICIARY'], centers: [] }),
    APPOINT_COMMANDER: Object.freeze({ executor: 'EXECUTIVE', scope: 'COUNTRY', proposers: ['EXECUTIVE', 'ARMED_FORCES'], centers: ['ARMED_FORCES'] }),
    DISMISS_COMMANDER: Object.freeze({ executor: 'EXECUTIVE', scope: 'COUNTRY', proposers: ['EXECUTIVE', 'ARMED_FORCES'], centers: ['ARMED_FORCES'] }),
    AUTHORIZE_BUDGET: Object.freeze({ executor: 'LEGISLATURE', scope: 'COUNTRY', proposers: ['EXECUTIVE', 'LEGISLATURE'], centers: ['BUSINESS_COUNCIL', 'LABOR_CONFEDERATION', 'CIVIL_SERVICE', 'ARMED_FORCES'] }),
    SIGN_TREATY: Object.freeze({ executor: 'EXECUTIVE', scope: 'COUNTRY', proposers: ['EXECUTIVE'], centers: [] }),
    DECLARE_WAR: Object.freeze({ executor: 'EXECUTIVE', scope: 'COUNTRY', proposers: ['EXECUTIVE', 'ARMED_FORCES'], centers: ['ARMED_FORCES'] }),
    MOBILIZE_FORCE: Object.freeze({ executor: 'EXECUTIVE', scope: 'COUNTRY', proposers: ['EXECUTIVE', 'ARMED_FORCES'], centers: ['ARMED_FORCES'] }),
    CONTAIN_VIOLENCE: Object.freeze({ executor: 'EXECUTIVE', scope: 'REGION', proposers: ['EXECUTIVE', 'JUDICIARY'], centers: ['SECURITY_SERVICE'] }),
    ISSUE_LOCAL_ORDER: Object.freeze({ executor: 'LOCAL_ADMINISTRATION', scope: 'REGION', proposers: ['EXECUTIVE', 'LOCAL_ADMINISTRATION'], centers: ['CIVIL_SERVICE'] }),
    REVIEW_LEGALITY: Object.freeze({ executor: 'JUDICIARY', scope: 'COUNTRY', proposers: ['JUDICIARY'], centers: [] }),

    ADVISE_SECURITY: Object.freeze({ executor: 'ARMED_FORCES', scope: 'COUNTRY', proposers: [], centers: ['ARMED_FORCES'], centerDirect: true }),
    REQUEST_READINESS_BUDGET: Object.freeze({ executor: 'LEGISLATURE', scope: 'COUNTRY', proposers: [], centers: ['ARMED_FORCES'] }),
    LOBBY_POLICY: Object.freeze({ executor: 'LEGISLATURE', scope: 'COUNTRY', proposers: [], centers: ['BUSINESS_COUNCIL'] }),
    COORDINATE_INVESTMENT: Object.freeze({ executor: null, scope: 'COUNTRY', proposers: [], centers: ['BUSINESS_COUNCIL'], centerDirect: true }),
    WITHHOLD_INVESTMENT: Object.freeze({ executor: null, scope: 'COUNTRY', proposers: [], centers: ['BUSINESS_COUNCIL'], centerDirect: true }),
    NEGOTIATE_LABOR: Object.freeze({ executor: null, scope: 'COUNTRY', proposers: [], centers: ['LABOR_CONFEDERATION'], centerDirect: true }),
    MOBILIZE_PROTEST: Object.freeze({ executor: null, scope: 'COUNTRY', proposers: [], centers: ['LABOR_CONFEDERATION', 'RADICAL_NETWORK'], externalDomain: 'COLLECTIVE_ACTION' }),
    CALL_STRIKE: Object.freeze({ executor: null, scope: 'COUNTRY', proposers: [], centers: ['LABOR_CONFEDERATION'], externalDomain: 'COLLECTIVE_ACTION' }),
    ADVISE_ADMINISTRATION: Object.freeze({ executor: 'EXECUTIVE', scope: 'COUNTRY', proposers: [], centers: ['CIVIL_SERVICE'], centerDirect: true }),
    DELAY_IMPLEMENTATION: Object.freeze({ executor: 'JUDICIARY', scope: 'COUNTRY', proposers: [], centers: ['CIVIL_SERVICE'] }),
    REPORT_CAPACITY: Object.freeze({ executor: null, scope: 'COUNTRY', proposers: [], centers: ['CIVIL_SERVICE'], centerDirect: true }),
    PUBLISH_POSITION: Object.freeze({ executor: null, scope: 'COUNTRY', proposers: [], centers: ['MEDIA_NETWORK'], centerDirect: true }),
    INVESTIGATE_PUBLIC_EVENT: Object.freeze({ executor: null, scope: 'COUNTRY', proposers: [], centers: ['MEDIA_NETWORK'], centerDirect: true }),
    WITHHOLD_ENDORSEMENT: Object.freeze({ executor: null, scope: 'COUNTRY', proposers: [], centers: ['MEDIA_NETWORK'], centerDirect: true }),
    ASSESS_INTERNAL_THREAT: Object.freeze({ executor: 'EXECUTIVE', scope: 'COUNTRY', proposers: [], centers: ['SECURITY_SERVICE'], centerDirect: true }),
    REQUEST_SECURITY_RESOURCES: Object.freeze({ executor: 'LEGISLATURE', scope: 'COUNTRY', proposers: [], centers: ['SECURITY_SERVICE'] }),
    RECRUIT_GRIEVANCE: Object.freeze({ executor: null, scope: 'COUNTRY', proposers: [], centers: ['RADICAL_NETWORK'], prohibited: true }),
    ESCALATE_DISRUPTION: Object.freeze({ executor: null, scope: 'COUNTRY', proposers: [], centers: ['RADICAL_NETWORK'], prohibited: true })
});

const STORY_INSTITUTION_CONSTITUTIONS = Object.freeze({
    monarchy: Object.freeze({
        regimeKey: 'PARLIAMENTARY_BALANCE', name: 'Parlamenter Sistem',
        requirements: Object.freeze({
            ENACT_LAW: ['LEGISLATURE', 'EXECUTIVE'], AMEND_CONSTITUTION: ['LEGISLATURE', 'EXECUTIVE', 'JUDICIARY'],
            APPOINT_COMMANDER: ['EXECUTIVE'], DISMISS_COMMANDER: ['EXECUTIVE', 'ARMED_FORCES'],
            AUTHORIZE_BUDGET: ['LEGISLATURE', 'EXECUTIVE'], SIGN_TREATY: ['EXECUTIVE'],
            DECLARE_WAR: ['EXECUTIVE', 'LEGISLATURE', 'ARMED_FORCES'], MOBILIZE_FORCE: ['EXECUTIVE', 'ARMED_FORCES'],
            CONTAIN_VIOLENCE: ['EXECUTIVE', 'JUDICIARY'], ISSUE_LOCAL_ORDER: ['LOCAL_ADMINISTRATION'], REVIEW_LEGALITY: ['JUDICIARY']
        })
    }),
    absolute: Object.freeze({
        regimeKey: 'EXECUTIVE_DOMINANT', name: 'Otokratik Başkanlık',
        requirements: Object.freeze({
            ENACT_LAW: ['EXECUTIVE'], AMEND_CONSTITUTION: ['EXECUTIVE', 'JUDICIARY'],
            APPOINT_COMMANDER: ['EXECUTIVE'], DISMISS_COMMANDER: ['EXECUTIVE'], AUTHORIZE_BUDGET: ['EXECUTIVE'],
            SIGN_TREATY: ['EXECUTIVE'], DECLARE_WAR: ['EXECUTIVE', 'ARMED_FORCES'], MOBILIZE_FORCE: ['EXECUTIVE', 'ARMED_FORCES'],
            CONTAIN_VIOLENCE: ['EXECUTIVE'], ISSUE_LOCAL_ORDER: ['EXECUTIVE'], REVIEW_LEGALITY: ['JUDICIARY']
        })
    }),
    republic: Object.freeze({
        regimeKey: 'LIBERAL_DEMOCRATIC', name: 'Liberal Demokrasi',
        requirements: Object.freeze({
            ENACT_LAW: ['LEGISLATURE', 'EXECUTIVE'], AMEND_CONSTITUTION: ['LEGISLATURE', 'EXECUTIVE', 'JUDICIARY'],
            APPOINT_COMMANDER: ['EXECUTIVE', 'LEGISLATURE'], DISMISS_COMMANDER: ['EXECUTIVE', 'JUDICIARY'],
            AUTHORIZE_BUDGET: ['LEGISLATURE', 'EXECUTIVE'], SIGN_TREATY: ['EXECUTIVE', 'LEGISLATURE'],
            DECLARE_WAR: ['EXECUTIVE', 'LEGISLATURE', 'ARMED_FORCES'], MOBILIZE_FORCE: ['EXECUTIVE', 'ARMED_FORCES'],
            CONTAIN_VIOLENCE: ['EXECUTIVE', 'JUDICIARY'], ISSUE_LOCAL_ORDER: ['LOCAL_ADMINISTRATION'], REVIEW_LEGALITY: ['JUDICIARY']
        })
    }),
    junta: Object.freeze({
        regimeKey: 'MILITARY_RULE', name: 'Askerî Cunta',
        requirements: Object.freeze({
            ENACT_LAW: ['EXECUTIVE', 'ARMED_FORCES'], AMEND_CONSTITUTION: ['EXECUTIVE', 'ARMED_FORCES'],
            APPOINT_COMMANDER: ['ARMED_FORCES'], DISMISS_COMMANDER: ['ARMED_FORCES'], AUTHORIZE_BUDGET: ['EXECUTIVE', 'ARMED_FORCES'],
            SIGN_TREATY: ['EXECUTIVE', 'ARMED_FORCES'], DECLARE_WAR: ['EXECUTIVE', 'ARMED_FORCES'], MOBILIZE_FORCE: ['ARMED_FORCES'],
            CONTAIN_VIOLENCE: ['ARMED_FORCES'], ISSUE_LOCAL_ORDER: ['EXECUTIVE'], REVIEW_LEGALITY: ['JUDICIARY']
        })
    }),
    council: Object.freeze({
        regimeKey: 'ASSEMBLY_RULE', name: 'Halk Meclisi',
        requirements: Object.freeze({
            ENACT_LAW: ['LEGISLATURE'], AMEND_CONSTITUTION: ['LEGISLATURE', 'JUDICIARY'],
            APPOINT_COMMANDER: ['LEGISLATURE', 'ARMED_FORCES'], DISMISS_COMMANDER: ['LEGISLATURE', 'ARMED_FORCES'],
            AUTHORIZE_BUDGET: ['LEGISLATURE'], SIGN_TREATY: ['LEGISLATURE'], DECLARE_WAR: ['LEGISLATURE', 'ARMED_FORCES'],
            MOBILIZE_FORCE: ['LEGISLATURE', 'ARMED_FORCES'], CONTAIN_VIOLENCE: ['LEGISLATURE', 'JUDICIARY'],
            ISSUE_LOCAL_ORDER: ['LOCAL_ADMINISTRATION'], REVIEW_LEGALITY: ['JUDICIARY']
        })
    })
});

const STORY_INSTITUTION_POLICY = Object.freeze({
    maximumRequests: 256,
    maximumEvents: 512,
    institutionsPerCountry: STORY_INSTITUTION_TYPES.length,
    effectModel: 'AUTHORIZATION_RECORD_ONLY_PHASE_29',
    officeHolderModel: 'CANONICAL_WHERE_AVAILABLE_OTHERWISE_EXPLICIT_PROXY_PRE_PHASE_34',
    localOfficeModel: 'COLLECTIVE_LOCAL_OFFICE_PRE_PHASE_35'
});
const STORY_INSTITUTION_POLICY_HASH = storyProductionHash({
    schemaVersion: STORY_INSTITUTION_SCHEMA_VERSION,
    adapterVersion: STORY_INSTITUTION_ADAPTER_VERSION,
    institutionTypes: STORY_INSTITUTION_TYPES,
    actions: STORY_INSTITUTION_ACTIONS,
    constitutions: STORY_INSTITUTION_CONSTITUTIONS,
    policy: STORY_INSTITUTION_POLICY
});

function storyInstitutionEnabled() {
    return (typeof storyFeatureEnabled !== 'function' || storyFeatureEnabled('government.institutionsAuthority'))
        && (typeof storyPowerCenterEnabled !== 'function' || storyPowerCenterEnabled());
}
function storyInstitutionClone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function storyInstitutionRound(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 1e6) / 1e6 : 0;
}
function storyInstitutionCountryId(value) {
    const raw = String(value == null ? '' : value);
    return raw.startsWith('country:') ? raw : `country:${Number(value)}`;
}
function storyInstitutionRegionId(value) {
    const raw = String(value == null ? '' : value);
    return raw.startsWith('region:') ? raw : `region:${Number(value)}`;
}
function storyInstitutionId(countryId, type) {
    return `institution:${storyInstitutionCountryId(countryId)}:${String(type).toLowerCase()}`;
}
function storyInstitutionState(countryId) {
    const id = Number(String(countryId).split(':').pop());
    return (STORY.states || []).find(state => Number(state.id) === id) || null;
}
function storyInstitutionConstitution(st) {
    return STORY_INSTITUTION_CONSTITUTIONS[String(st && st.constitution || 'monarchy')]
        || STORY_INSTITUTION_CONSTITUTIONS.monarchy;
}
function storyInstitutionCommanderHolder(countryId, st) {
    const rows = typeof storyStateCommanders === 'function' ? storyStateCommanders(st) : [];
    const sorted = rows.slice().sort((a, b) => (
        (Number(b.skills && b.skills.warrior) || 0) - (Number(a.skills && a.skills.warrior) || 0)
        || Number(a.id) - Number(b.id)
    ));
    const commander = sorted[0] || null;
    return commander ? {
        actorId: `character:${st.id}:${commander.id}`,
        actorType: 'CHARACTER',
        name: String(commander.name || 'Genelkurmay Başkanı'),
        model: 'CANONICAL_COMMANDER'
    } : {
        actorId: `office:${countryId}:armed-forces`, actorType: 'OFFICE',
        name: 'Genelkurmay Makamı', model: 'VACANT_COLLECTIVE_OFFICE'
    };
}
function storyInstitutionHolder(countryId, type, st) {
    if (type === 'EXECUTIVE') {
        if (st && st.isPlayer && st.gov && st.gov.leader === 'player' && STORY.commander) {
            return {
                actorId: `character:${st.id}:${STORY.commander.id}`,
                actorType: 'CHARACTER', name: String(STORY.commander.name), model: 'CANONICAL_PLAYER_EXECUTIVE'
            };
        }
        return {
            actorId: `officeholder:${countryId}:president`, actorType: 'OFFICEHOLDER_PROXY',
            name: typeof storyPresidentName === 'function' ? storyPresidentName(st) : 'Cumhurbaşkanı',
            model: 'NAMED_PRESIDENT_PROFILE_PRE_PHASE_34'
        };
    }
    if (type === 'ARMED_FORCES') return storyInstitutionCommanderHolder(countryId, st);
    if (type === 'LEGISLATURE') return {
        actorId: `office:${countryId}:legislature`, actorType: 'COLLECTIVE_OFFICE',
        name: 'Meclis Başkanlığı', model: 'COLLECTIVE_OFFICE_PRE_PHASE_34'
    };
    if (type === 'JUDICIARY') return {
        actorId: `officeholder:${countryId}:chief-justice`, actorType: 'OFFICEHOLDER_PROXY',
        name: 'Yüksek Yargı Başkanlığı', model: 'OFFICEHOLDER_PROXY_PRE_PHASE_34'
    };
    return {
        actorId: `office:${countryId}:local-administration`, actorType: 'COLLECTIVE_OFFICE',
        name: 'Yerel İdareler Kurulu', model: STORY_INSTITUTION_POLICY.localOfficeModel
    };
}

function storyInstitutionRequirements(constitutionId, actionType) {
    const profile = STORY_INSTITUTION_CONSTITUTIONS[constitutionId]
        || STORY_INSTITUTION_CONSTITUTIONS.monarchy;
    const action = STORY_INSTITUTION_ACTIONS[actionType];
    if (!action || action.prohibited || action.externalDomain) return [];
    if (action.centerDirect) return [];
    return (profile.requirements[actionType] || (action.executor ? [action.executor] : [])).slice();
}
function storyInstitutionRoute(countryId, constitutionId, actionType) {
    const action = STORY_INSTITUTION_ACTIONS[actionType];
    if (!action) return null;
    const requiredTypes = storyInstitutionRequirements(constitutionId, actionType);
    let mode = requiredTypes.length > 1 ? 'JOINT' : (requiredTypes.length === 1 ? 'DIRECT' : 'DIRECT');
    if (action.externalDomain) mode = 'EXTERNAL_DOMAIN';
    if (action.prohibited) mode = 'PROHIBITED';
    if (!action.centerDirect && (action.centers || []).length && requiredTypes.length) mode = 'PETITION';
    return {
        actionType,
        mode,
        targetScope: action.scope,
        executorInstitutionType: action.executor,
        proposerInstitutionTypes: (action.proposers || []).slice(),
        proposerPowerCenterTypes: (action.centers || []).slice(),
        requiredInstitutionTypes: requiredTypes,
        requiredInstitutionIds: requiredTypes.map(type => storyInstitutionId(countryId, type)),
        legalBasis: `constitution:${constitutionId}:${actionType.toLowerCase()}`,
        externalDomain: action.externalDomain || null,
        effectModel: STORY_INSTITUTION_POLICY.effectModel
    };
}

function storyInstitutionCountryBuild(st) {
    const countryId = storyInstitutionCountryId(st.id);
    const constitutionId = String(st.constitution || 'monarchy');
    const profile = storyInstitutionConstitution(st);
    const authorityByAction = {};
    for (const actionType of Object.keys(STORY_INSTITUTION_ACTIONS)) {
        authorityByAction[actionType] = storyInstitutionRoute(countryId, constitutionId, actionType);
    }
    const institutions = {};
    for (const type of STORY_INSTITUTION_TYPES) {
        const id = storyInstitutionId(countryId, type);
        const grants = Object.values(authorityByAction).filter(route => (
            route.executorInstitutionType === type
            || route.requiredInstitutionTypes.includes(type)
            || route.proposerInstitutionTypes.includes(type)
        )).map(route => ({
            actionType: route.actionType,
            canPropose: route.proposerInstitutionTypes.includes(type),
            canApprove: route.requiredInstitutionTypes.includes(type),
            canExecute: route.executorInstitutionType === type,
            legalBasis: route.legalBasis
        })).sort((a, b) => a.actionType.localeCompare(b.actionType, 'en'));
        institutions[id] = {
            schemaVersion: STORY_INSTITUTION_SCHEMA_VERSION,
            id, countryId, type,
            name: `${st.name} ${STORY_INSTITUTION_DEFS[type].name}`,
            status: 'ACTIVE',
            scope: STORY_INSTITUTION_DEFS[type].scope,
            officeHolder: storyInstitutionHolder(countryId, type, st),
            regionIds: type === 'LOCAL_ADMINISTRATION'
                ? (STORY.nodes || []).filter(node => Number(node.owner) === Number(st.id)).map(node => storyInstitutionRegionId(node.id))
                : [],
            authorityGrants: grants,
            diagnostics: {
                authorityFromConstitution: true,
                officeHolderModel: STORY_INSTITUTION_POLICY.officeHolderModel,
                randomDecisions: false,
                llmDecisions: false
            }
        };
    }
    return {
        countryId,
        constitutionId,
        regimeKey: profile.regimeKey,
        regimeName: profile.name,
        institutionIds: Object.keys(institutions),
        institutions,
        authorityByAction
    };
}

function storyInstitutionSourceSignature() {
    return storyProductionHash((STORY.states || []).map(st => ({
        id: st.id,
        constitution: st.constitution || 'monarchy',
        leader: st.gov && st.gov.leader || null,
        president: st.gov && st.gov.president && st.gov.president.name || null,
        regions: (STORY.nodes || []).filter(node => Number(node.owner) === Number(st.id)).map(node => node.id),
        // Sadakat ve benzeri akiskan nitelikler makam kimligini degistirmez.
        // Imza yalniz kurum rotasini veya gercek makam sahibini etkileyen
        // kanonik alanlari kapsar; aksi halde her sosyal tik bekleyen karar
        // fislerini gereksiz yere STALE_AUTHORITY yapardi.
        commanders: (typeof storyStateCommanders === 'function' ? storyStateCommanders(st) : []).map(c => ({
            id: c.id, name: c.name, warrior: c.skills && c.skills.warrior
        }))
    })));
}
function storyInstitutionBuildCountries() {
    const countries = {};
    for (const st of (STORY.states || [])) {
        const row = storyInstitutionCountryBuild(st);
        countries[row.countryId] = row;
    }
    return countries;
}
function storyInstitutionRecordEvent(ledger, type, extra) {
    const event = Object.assign({
        id: `institution-event:${ledger.nextEventSequence}`,
        sequence: ledger.nextEventSequence++,
        type: String(type),
        at: storyInstitutionRound(STORY.clock)
    }, extra || {});
    ledger.events.push(event);
    if (ledger.events.length > STORY_INSTITUTION_POLICY.maximumEvents) {
        ledger.events.splice(0, ledger.events.length - STORY_INSTITUTION_POLICY.maximumEvents);
    }
    return event;
}
function storyInstitutionLedgerCreate(options) {
    options = options || {};
    return {
        schemaVersion: STORY_INSTITUTION_SCHEMA_VERSION,
        adapterVersion: STORY_INSTITUTION_ADAPTER_VERSION,
        policyHash: STORY_INSTITUTION_POLICY_HASH,
        tickSequence: 0,
        lastTickAt: storyInstitutionRound(STORY.clock),
        sourceSignature: storyInstitutionSourceSignature(),
        nextRequestSequence: 1,
        nextEventSequence: 1,
        countries: storyInstitutionBuildCountries(),
        requests: {},
        events: [],
        diagnostics: {
            backfilled: !!options.backfilled,
            restoredFromInvalidLedger: !!options.restoredFromInvalidLedger,
            issues: Array.isArray(options.issues) ? storyInstitutionClone(options.issues).slice(0, 50) : [],
            warnings: options.backfilled
                ? ['Eski kayıtta kurum/yetki geçmişi yoktu; mevcut anayasa ve makamlardan başlangıç şeması kuruldu.'] : [],
            effectModel: STORY_INSTITUTION_POLICY.effectModel,
            directWorldWrites: false,
            randomDecisions: false,
            llmDecisions: false
        }
    };
}

function storyInstitutionValidate(ledger) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) {
        return { ok: false, issues: [{ code: 'INSTITUTION_LEDGER_REQUIRED', path: '$', message: 'Kurum/yetki defteri zorunlu.' }] };
    }
    if (ledger.schemaVersion !== STORY_INSTITUTION_SCHEMA_VERSION) add('INSTITUTION_SCHEMA_VERSION', '$.schemaVersion', 'Kurum şeması uyuşmuyor.');
    if (ledger.adapterVersion !== STORY_INSTITUTION_ADAPTER_VERSION) add('INSTITUTION_ADAPTER_VERSION', '$.adapterVersion', 'Kurum adaptörü uyuşmuyor.');
    if (ledger.policyHash !== STORY_INSTITUTION_POLICY_HASH) add('INSTITUTION_POLICY_HASH', '$.policyHash', 'Kurum politika karması uyuşmuyor.');
    if (!Number.isInteger(ledger.tickSequence) || ledger.tickSequence < 0) add('INSTITUTION_TICK', '$.tickSequence', 'Tik sayacı geçersiz.');
    const knownCountries = new Set((STORY.states || []).map(st => storyInstitutionCountryId(st.id)));
    for (const countryId of knownCountries) {
        const country = ledger.countries && ledger.countries[countryId];
        if (!country) { add('INSTITUTION_COUNTRY_REQUIRED', `$.countries.${countryId}`, 'Ülke kurum şeması eksik.'); continue; }
        const st = storyInstitutionState(countryId);
        if (country.constitutionId !== String(st && st.constitution || 'monarchy')) add('INSTITUTION_CONSTITUTION_STALE', `$.countries.${countryId}.constitutionId`, 'Kurum şeması canlı anayasayla uyuşmuyor.');
        const institutionRows = Object.values(country.institutions || {});
        if (institutionRows.length !== STORY_INSTITUTION_POLICY.institutionsPerCountry) add('INSTITUTION_COUNTRY_COUNT', `$.countries.${countryId}.institutions`, 'Her ülke beş temel kurum taşımalı.');
        for (const type of STORY_INSTITUTION_TYPES) {
            const id = storyInstitutionId(countryId, type);
            const institution = country.institutions && country.institutions[id];
            if (!institution || institution.id !== id || institution.type !== type || institution.countryId !== countryId) {
                add('INSTITUTION_IDENTITY', `$.countries.${countryId}.institutions.${id}`, 'Kurum kimliği veya türü geçersiz.');
                continue;
            }
            if (!institution.officeHolder || !institution.officeHolder.actorId || !institution.officeHolder.actorType || !institution.officeHolder.name) {
                add('INSTITUTION_OFFICE_HOLDER', `$.countries.${countryId}.institutions.${id}.officeHolder`, 'Kurum doğrulanmış makam sahibi/ofis taşımalı.');
            }
        }
        for (const actionType of Object.keys(STORY_INSTITUTION_ACTIONS)) {
            const route = country.authorityByAction && country.authorityByAction[actionType];
            if (!route || route.actionType !== actionType || !['DIRECT', 'JOINT', 'PETITION', 'PROHIBITED', 'EXTERNAL_DOMAIN'].includes(route.mode)) {
                add('INSTITUTION_ACTION_ROUTE', `$.countries.${countryId}.authorityByAction.${actionType}`, 'Eylem yetki rotası eksik veya geçersiz.');
            }
        }
    }
    const requests = Object.values(ledger.requests || {});
    if (requests.length > STORY_INSTITUTION_POLICY.maximumRequests) add('INSTITUTION_REQUEST_LIMIT', '$.requests', 'Karar isteği bütçesi aşıldı.');
    for (const request of requests) {
        const at = `$.requests.${request && request.id}`;
        if (!request || !request.id || !knownCountries.has(request.countryId)) { add('INSTITUTION_REQUEST_IDENTITY', at, 'Karar isteği kimliği/ülkesi geçersiz.'); continue; }
        if (!STORY_INSTITUTION_ACTIONS[request.actionType]) add('INSTITUTION_REQUEST_ACTION', `${at}.actionType`, 'Karar isteği bilinmeyen eylem taşıyor.');
        if (!STORY_INSTITUTION_REQUEST_STATUSES.includes(request.status)) add('INSTITUTION_REQUEST_STATUS', `${at}.status`, 'Karar isteği durumu geçersiz.');
        if (!Array.isArray(request.requiredInstitutionIds) || !Array.isArray(request.approvalInstitutionIds)) add('INSTITUTION_REQUEST_APPROVALS', at, 'Onay listeleri zorunlu.');
        const approvals = new Set(request.approvalInstitutionIds || []);
        if (approvals.size !== (request.approvalInstitutionIds || []).length) add('INSTITUTION_DUPLICATE_APPROVAL', `${at}.approvalInstitutionIds`, 'Aynı kurum iki kez onay veremez.');
        if ((request.status === 'AUTHORIZED' || request.status === 'EXECUTED')
            && (request.requiredInstitutionIds || []).some(id => !approvals.has(id))) {
            add('INSTITUTION_MISSING_APPROVAL', `${at}.approvalInstitutionIds`, 'Yetkili/uygulanmış istek bütün zorunlu onayları taşımalı.');
        }
        if (request.effectModel !== STORY_INSTITUTION_POLICY.effectModel) add('INSTITUTION_EFFECT_MODEL', `${at}.effectModel`, 'Faz 29 karar kaydı fiziksel etki uyduramaz.');
    }
    if (!Array.isArray(ledger.events) || ledger.events.length > STORY_INSTITUTION_POLICY.maximumEvents) add('INSTITUTION_EVENT_LIMIT', '$.events', 'Kurum olay bütçesi aşıldı.');
    return { ok: issues.length === 0, issues };
}

function storyInstitutionReset(options) {
    if (!storyInstitutionEnabled()) { STORY.institutions = null; return null; }
    STORY.institutions = storyInstitutionLedgerCreate(options);
    return STORY.institutions;
}
function storyInstitutionReconcile(ledger) {
    if (!ledger) return ledger;
    const signature = storyInstitutionSourceSignature();
    if (ledger.sourceSignature === signature) return ledger;
    const previousSignature = ledger.sourceSignature;
    ledger.countries = storyInstitutionBuildCountries();
    ledger.sourceSignature = signature;
    for (const request of Object.values(ledger.requests || {})) {
        if (request.status === 'PENDING_APPROVAL' || request.status === 'AUTHORIZED') {
            request.status = 'STALE_AUTHORITY';
            request.updatedAt = storyInstitutionRound(STORY.clock);
        }
    }
    storyInstitutionRecordEvent(ledger, 'AUTHORITY_SCHEMA_RECONCILED', { previousSignature, nextSignature: signature });
    return ledger;
}
function storyInstitutionEnsure() {
    if (!storyInstitutionEnabled()) return null;
    const ledger = STORY.institutions || storyInstitutionReset({ backfilled: true });
    return storyInstitutionReconcile(ledger);
}
function storyInstitutionRestore(saved) {
    if (!storyInstitutionEnabled()) { STORY.institutions = null; return null; }
    if (!saved) return storyInstitutionReset({ backfilled: true });
    const candidate = storyInstitutionClone(saved);
    const validation = storyInstitutionValidate(candidate);
    if (validation.ok) { STORY.institutions = candidate; return storyInstitutionReconcile(candidate); }
    const ledger = storyInstitutionLedgerCreate({ backfilled: true, restoredFromInvalidLedger: true, issues: validation.issues });
    ledger.diagnostics.warnings.push('Bozuk kurum/yetki defteri kullanılmadı; canlı anayasa ve makamlardan güvenli şema kuruldu.');
    STORY.institutions = ledger;
    return ledger;
}
function storyInstitutionForSave() {
    const ledger = storyInstitutionEnsure();
    if (!ledger) return null;
    const validation = storyInstitutionValidate(ledger);
    if (!validation.ok) throw new Error(`Geçersiz kurum/yetki defteri: ${validation.issues[0].code}`);
    return storyInstitutionClone(ledger);
}
function storyInstitutionTick() {
    const ledger = storyInstitutionEnsure();
    if (!ledger) return { disabled: true };
    ledger.tickSequence++;
    ledger.lastTickAt = storyInstitutionRound(STORY.clock);
    return { disabled: false, tickSequence: ledger.tickSequence, countryCount: Object.keys(ledger.countries).length };
}

function storyInstitutionResolveActor(country, input) {
    input = input || {};
    if (input.institutionId) {
        const institution = country.institutions && country.institutions[String(input.institutionId)];
        if (!institution || String(input.actorId || '') !== institution.officeHolder.actorId) return null;
        return {
            actorId: institution.officeHolder.actorId,
            actorType: institution.officeHolder.actorType,
            sourceKind: 'INSTITUTION', sourceId: institution.id, institutionType: institution.type,
            powerCenterType: null
        };
    }
    if (input.powerCenterId && STORY.powerCenters && STORY.powerCenters.centers) {
        const center = STORY.powerCenters.centers[String(input.powerCenterId)];
        if (!center || center.countryId !== country.countryId || String(input.actorId || '') !== center.leader.actorId) return null;
        return {
            actorId: center.leader.actorId,
            actorType: center.leader.actorType,
            sourceKind: 'POWER_CENTER', sourceId: center.id, institutionType: null,
            powerCenterType: center.type
        };
    }
    return null;
}
function storyInstitutionActorCanPropose(route, actor) {
    return actor.sourceKind === 'INSTITUTION'
        ? route.proposerInstitutionTypes.includes(actor.institutionType)
            || route.requiredInstitutionTypes.includes(actor.institutionType)
        : route.proposerPowerCenterTypes.includes(actor.powerCenterType);
}
function storyInstitutionDenied(ledger, input, reason) {
    storyInstitutionRecordEvent(ledger, 'ACTION_DENIED', {
        countryId: input && input.countryId ? storyInstitutionCountryId(input.countryId) : null,
        actionType: input && input.actionType ? String(input.actionType) : null,
        actorId: input && input.actorId ? String(input.actorId) : null,
        reason
    });
    return { ok: false, status: 'DENIED', reason };
}
function storyInstitutionSubmitAction(input) {
    const ledger = storyInstitutionEnsure();
    if (!ledger) return { ok: false, status: 'DISABLED', reason: 'INSTITUTION_LAYER_DISABLED' };
    input = input || {};
    const countryId = storyInstitutionCountryId(input.countryId);
    const country = ledger.countries[countryId];
    const actionType = String(input.actionType || '');
    const route = country && country.authorityByAction[actionType];
    if (!country) return storyInstitutionDenied(ledger, input, 'UNKNOWN_COUNTRY');
    if (!route) return storyInstitutionDenied(ledger, input, 'UNKNOWN_ACTION');
    if (route.mode === 'PROHIBITED') return storyInstitutionDenied(ledger, input, 'NO_LAWFUL_ROUTE');
    if (route.mode === 'EXTERNAL_DOMAIN') return storyInstitutionDenied(ledger, input, `EXTERNAL_DOMAIN_${route.externalDomain}`);
    const actor = storyInstitutionResolveActor(country, input);
    if (!actor) return storyInstitutionDenied(ledger, input, 'ACTOR_SOURCE_MISMATCH');
    if (!storyInstitutionActorCanPropose(route, actor)) return storyInstitutionDenied(ledger, input, 'ACTOR_NOT_AUTHORIZED_TO_PROPOSE');
    if (route.targetScope === 'REGION') {
        const regionId = storyInstitutionRegionId(input.targetRegionId);
        const nodeId = Number(regionId.split(':').pop());
        const node = (STORY.nodes || []).find(row => Number(row.id) === nodeId);
        if (!node || storyInstitutionCountryId(node.owner) !== countryId) return storyInstitutionDenied(ledger, input, 'TARGET_OUTSIDE_JURISDICTION');
    }
    const requestId = `institution-request:${ledger.nextRequestSequence++}`;
    const approvals = [];
    if (actor.sourceKind === 'INSTITUTION') {
        const ownId = storyInstitutionId(countryId, actor.institutionType);
        if (route.requiredInstitutionIds.includes(ownId)) approvals.push(ownId);
    }
    const request = {
        id: requestId,
        countryId,
        actionType,
        targetRegionId: input.targetRegionId == null ? null : storyInstitutionRegionId(input.targetRegionId),
        proposer: actor,
        routeMode: route.mode,
        legalBasis: route.legalBasis,
        authoritySignature: ledger.sourceSignature,
        requiredInstitutionIds: route.requiredInstitutionIds.slice(),
        approvalInstitutionIds: approvals,
        // Kuruma dilekce veren bir merkez son karari ilgili makamdan bekler.
        // Merkezin kendi bildirimi/koordinasyonu ise merkez tarafindan dogrudan
        // tamamlanir; eylemin konu kurumu burada ikinci bir imza makamı degildir.
        executorInstitutionId: !STORY_INSTITUTION_ACTIONS[actionType].centerDirect && route.executorInstitutionType
            ? storyInstitutionId(countryId, route.executorInstitutionType) : null,
        status: route.requiredInstitutionIds.every(id => approvals.includes(id)) ? 'AUTHORIZED' : 'PENDING_APPROVAL',
        createdAt: storyInstitutionRound(STORY.clock),
        updatedAt: storyInstitutionRound(STORY.clock),
        executedAt: null,
        effectModel: STORY_INSTITUTION_POLICY.effectModel,
        result: null
    };
    ledger.requests[requestId] = request;
    const ids = Object.keys(ledger.requests).sort((a, b) => Number(a.split(':').pop()) - Number(b.split(':').pop()));
    while (ids.length > STORY_INSTITUTION_POLICY.maximumRequests) delete ledger.requests[ids.shift()];
    storyInstitutionRecordEvent(ledger, 'ACTION_SUBMITTED', { requestId, countryId, actionType, actorId: actor.actorId, status: request.status });
    return { ok: true, request: storyInstitutionClone(request) };
}
function storyInstitutionApproveAction(requestId, input) {
    const ledger = storyInstitutionEnsure();
    if (!ledger) return { ok: false, status: 'DISABLED', reason: 'INSTITUTION_LAYER_DISABLED' };
    const request = ledger.requests[String(requestId)];
    if (!request) return { ok: false, status: 'DENIED', reason: 'UNKNOWN_REQUEST' };
    if (request.status !== 'PENDING_APPROVAL') return { ok: false, status: request.status, reason: 'REQUEST_NOT_PENDING' };
    if (request.authoritySignature !== ledger.sourceSignature) {
        request.status = 'STALE_AUTHORITY';
        return { ok: false, status: request.status, reason: 'AUTHORITY_SCHEMA_CHANGED' };
    }
    const country = ledger.countries[request.countryId];
    const actor = storyInstitutionResolveActor(country, input || {});
    if (!actor || actor.sourceKind !== 'INSTITUTION') return { ok: false, status: 'DENIED', reason: 'APPROVER_SOURCE_MISMATCH' };
    const institutionId = storyInstitutionId(request.countryId, actor.institutionType);
    if (!request.requiredInstitutionIds.includes(institutionId)) return { ok: false, status: 'DENIED', reason: 'INSTITUTION_APPROVAL_NOT_REQUIRED' };
    if (!request.approvalInstitutionIds.includes(institutionId)) request.approvalInstitutionIds.push(institutionId);
    request.approvalInstitutionIds.sort((a, b) => a.localeCompare(b, 'en'));
    request.status = request.requiredInstitutionIds.every(id => request.approvalInstitutionIds.includes(id))
        ? 'AUTHORIZED' : 'PENDING_APPROVAL';
    request.updatedAt = storyInstitutionRound(STORY.clock);
    storyInstitutionRecordEvent(ledger, 'ACTION_APPROVED', { requestId: request.id, institutionId, status: request.status });
    return { ok: true, request: storyInstitutionClone(request) };
}
function storyInstitutionExecuteAction(requestId, input) {
    const ledger = storyInstitutionEnsure();
    if (!ledger) return { ok: false, status: 'DISABLED', reason: 'INSTITUTION_LAYER_DISABLED' };
    const request = ledger.requests[String(requestId)];
    if (!request) return { ok: false, status: 'DENIED', reason: 'UNKNOWN_REQUEST' };
    if (request.status !== 'AUTHORIZED') return { ok: false, status: request.status, reason: 'REQUEST_NOT_AUTHORIZED' };
    if (request.authoritySignature !== ledger.sourceSignature) {
        request.status = 'STALE_AUTHORITY';
        return { ok: false, status: request.status, reason: 'AUTHORITY_SCHEMA_CHANGED' };
    }
    const country = ledger.countries[request.countryId];
    const actor = storyInstitutionResolveActor(country, input || {});
    if (!actor) return { ok: false, status: 'DENIED', reason: 'EXECUTOR_SOURCE_MISMATCH' };
    const executorOk = request.executorInstitutionId
        ? actor.sourceKind === 'INSTITUTION' && actor.sourceId === request.executorInstitutionId
        : actor.sourceKind === request.proposer.sourceKind && actor.sourceId === request.proposer.sourceId;
    if (!executorOk) return { ok: false, status: 'DENIED', reason: 'ACTOR_NOT_EXECUTOR' };
    request.status = 'EXECUTED';
    request.executedAt = storyInstitutionRound(STORY.clock);
    request.updatedAt = request.executedAt;
    request.result = { status: 'RECORDED', physicalMutation: false, effectModel: STORY_INSTITUTION_POLICY.effectModel };
    storyInstitutionRecordEvent(ledger, 'ACTION_EXECUTED', {
        requestId: request.id, countryId: request.countryId, actionType: request.actionType,
        actorId: actor.actorId, physicalMutation: false
    });
    return { ok: true, request: storyInstitutionClone(request) };
}

function storyInstitutionCountryView(countryId) {
    const ledger = storyInstitutionEnsure();
    const id = storyInstitutionCountryId(countryId);
    if (!ledger || !ledger.countries[id]) return null;
    const out = storyInstitutionClone(ledger.countries[id]);
    out.requests = Object.values(ledger.requests || {}).filter(row => row.countryId === id);
    return out;
}
function storyInstitutionRegionView(regionId) {
    const ledger = storyInstitutionEnsure();
    if (!ledger) return null;
    const id = storyInstitutionRegionId(regionId);
    const node = (STORY.nodes || []).find(row => storyInstitutionRegionId(row.id) === id);
    if (!node) return null;
    const countryId = storyInstitutionCountryId(node.owner);
    const country = ledger.countries[countryId];
    const localId = storyInstitutionId(countryId, 'LOCAL_ADMINISTRATION');
    return {
        regionId: id,
        countryId,
        institutionId: localId,
        institution: country && country.institutions ? storyInstitutionClone(country.institutions[localId]) : null
    };
}
function storyInstitutionPublicView(value) {
    if (!value) return null;
    if (value.regionId) return {
        regionId: value.regionId, countryId: value.countryId, institutionId: value.institutionId,
        institution: value.institution ? {
            id: value.institution.id, type: value.institution.type, name: value.institution.name,
            status: value.institution.status, officeName: value.institution.officeHolder && value.institution.officeHolder.name
        } : null
    };
    return {
        countryId: value.countryId,
        constitutionId: value.constitutionId,
        regimeKey: value.regimeKey,
        regimeName: value.regimeName,
        institutions: Object.values(value.institutions || {}).map(row => ({
            id: row.id, type: row.type, name: row.name, status: row.status,
            officeName: row.officeHolder && row.officeHolder.name,
            publicActionTypes: row.authorityGrants.filter(grant => grant.canExecute || grant.canApprove).map(grant => grant.actionType)
        }))
    };
}
function storyInstitutionPowerCenterActionLimits(countryId, centerType, declaredActions) {
    if (!storyInstitutionEnabled()) return null;
    const ledger = storyInstitutionEnsure();
    const country = ledger && ledger.countries[storyInstitutionCountryId(countryId)];
    if (!country) return null;
    const direct = [], conditional = [], prohibited = [];
    for (const actionType of (declaredActions || [])) {
        const route = country.authorityByAction[actionType];
        if (!route || !route.proposerPowerCenterTypes.includes(centerType)) { prohibited.push(actionType); continue; }
        if (route.mode === 'DIRECT') direct.push(actionType);
        else if (route.mode === 'PETITION' || route.mode === 'JOINT') conditional.push(actionType);
        else prohibited.push(actionType);
    }
    return {
        authorityModel: 'INSTITUTION_SCHEMA_PHASE_29',
        declaredActionTypes: (declaredActions || []).slice(),
        executableActionTypes: direct,
        conditionalActionTypes: conditional,
        prohibitedActionTypes: prohibited,
        blockedUntilPhase: null,
        maximumConcurrentActions: 1
    };
}
function storyInstitutionSummary() {
    const ledger = storyInstitutionEnsure();
    if (!ledger) return {
        schemaVersion: STORY_INSTITUTION_SCHEMA_VERSION,
        adapterVersion: STORY_INSTITUTION_ADAPTER_VERSION,
        disabled: true, countryCount: 0, institutionCount: 0, requestCount: 0
    };
    const countries = Object.values(ledger.countries || {});
    const requests = Object.values(ledger.requests || {});
    return {
        schemaVersion: ledger.schemaVersion,
        adapterVersion: ledger.adapterVersion,
        policyHash: ledger.policyHash,
        disabled: false,
        tickSequence: ledger.tickSequence,
        countryCount: countries.length,
        institutionCount: countries.reduce((sum, row) => sum + Object.keys(row.institutions || {}).length, 0),
        requestCount: requests.length,
        pendingRequestCount: requests.filter(row => row.status === 'PENDING_APPROVAL').length,
        authorizedRequestCount: requests.filter(row => row.status === 'AUTHORIZED').length,
        executedRequestCount: requests.filter(row => row.status === 'EXECUTED').length,
        deniedEventCount: (ledger.events || []).filter(row => row.type === 'ACTION_DENIED').length,
        eventCount: (ledger.events || []).length,
        regimes: Object.fromEntries(countries.map(row => [row.countryId, row.regimeKey]))
    };
}
