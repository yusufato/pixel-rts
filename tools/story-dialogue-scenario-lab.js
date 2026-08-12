'use strict';

const crypto = require('node:crypto');

const SCHEMA_VERSION = 1;
const SOURCE = 'STORY_DIALOGUE_SCENARIO_LAB_FIXTURE_V1';

const REFERENCE_SCENARIOS = Object.freeze([
    ['steel-import-redirect', 'Britanya çelik sevkiyatının yönlendirilmesi', 'EXISTING_VERTICAL',
        ['EVIDENCE', 'COUNTER_OFFER', 'REJECT']],
    ['grain-scarcity-redirect', 'Kıtlıkta tahıl sevkiyatının yönlendirilmesi', 'LAB_EXECUTABLE',
        ['COMPENSATED_REDIRECT', 'POLITICAL_PRESSURE', 'OFFBOOK_SALE']],
    ['steel-strike-bargain', 'Çelik fabrikasında grev ve ücret pazarlığı', 'LAB_EXECUTABLE',
        ['STAGED_WAGE', 'THREAT', 'DIVIDE_WORKFORCE']],
    ['arms-tender-leak', 'Gazetecideki silah ihalesi dosyası', 'LAB_EXECUTABLE',
        ['INDEPENDENT_INQUIRY', 'BRIBE', 'SECURITY_THREAT']],
    ['border-mobilization', 'Sınırdaki gizli yığınak ve önleyici seferberlik', 'LAB_EXECUTABLE',
        ['VERIFY_FIRST', 'LIMITED_MOBILIZATION', 'PREEMPTIVE_ESCALATION']],
    ['sanctions-shell-company', 'Yaptırımları paravan şirketle aşma teklifi', 'LAB_EXECUTABLE',
        ['SMALL_TRIAL', 'THREAT', 'LEGAL_EXEMPTION']],
    ['refugee-border-bargain', 'Mülteci yerleştirme ve sınır geçiş pazarlığı', 'LAB_EXECUTABLE',
        ['FUNDED_SETTLEMENT', 'FORCED_RETURN', 'TRANSIT_BARGAIN']],
    ['bank-bailout-oligarch', 'Banka kurtarma ve oligark şartları', 'LAB_EXECUTABLE',
        ['DILUTION_AND_AUDIT', 'BLANK_CHEQUE', 'ORDERLY_FAILURE']],
    ['prisoner-exchange', 'Savaş esiri takası', 'LAB_EXECUTABLE',
        ['STAGED_VERIFICATION', 'INTELLIGENCE_BARGAIN', 'PROPAGANDA_REFUSAL']],
    ['pipeline-sabotage-inquiry', 'Boru hattı sabotajı için ortak soruşturma', 'LAB_EXECUTABLE',
        ['LIMITED_DATA_SHARING', 'PUBLIC_ACCUSATION', 'SECRET_QUID_PRO_QUO']],
    ['coup-rumor-succession', 'Darbe söylentisi ve halefiyet pazarlığı', 'LAB_EXECUTABLE',
        ['CONSTITUTIONAL_TRANSITION', 'PERSONAL_OFFICE_BARGAIN', 'SPLIT_PLOTTERS', 'REJECT_RUMOR']]
].map(([id, title, adapterStatus, branches]) => Object.freeze({
    schemaVersion: SCHEMA_VERSION, id, title, adapterStatus,
    branches: Object.freeze(branches.slice()), source: SOURCE
})));

const GRAIN_ENUMS = Object.freeze({
    proposalKind: Object.freeze(['COMPENSATED_REDIRECT', 'POLITICAL_PRESSURE', 'OFFBOOK_SALE']),
    playerShipmentReference: Object.freeze(['KNOWN', 'UNKNOWN']),
    listenerShipmentBelief: Object.freeze(['VERIFIED', 'UNVERIFIED', 'NONE']),
    listenerAuthority: Object.freeze(['REDIRECT_AUTHORITY', 'NO_REDIRECT_AUTHORITY']),
    shipmentTruth: Object.freeze(['ACTIVE', 'MISSING', 'COMPLETED']),
    listenerPosture: Object.freeze(['AUTHORITARIAN', 'INSTITUTIONALIST', 'ARMY_ALIGNED', 'PRINCIPLED', 'OPPORTUNIST'])
});

const STRIKE_ENUMS = Object.freeze({
    proposalKind: Object.freeze(['STAGED_WAGE', 'THREAT', 'DIVIDE_WORKFORCE']),
    playerStrikeReference: Object.freeze(['KNOWN', 'UNKNOWN']),
    listenerStrikeBelief: Object.freeze(['VERIFIED', 'UNVERIFIED', 'NONE']),
    listenerAuthority: Object.freeze(['UNION_MANDATE', 'NO_UNION_MANDATE']),
    strikeTruth: Object.freeze(['ACTIVE', 'MISSING', 'RESOLVED']),
    companyLiquidity: Object.freeze(['SUFFICIENT', 'INSUFFICIENT', 'UNKNOWN']),
    inflationWageGap: Object.freeze(['HIGH', 'LOW', 'UNKNOWN']),
    strikeSupport: Object.freeze(['STRONG', 'WEAK']),
    productionUrgency: Object.freeze(['CRITICAL', 'NORMAL']),
    safetyEvidence: Object.freeze(['VERIFIED', 'UNVERIFIED', 'NONE']),
    listenerPosture: Object.freeze(['PRINCIPLED', 'FEARFUL', 'OPPORTUNIST'])
});

const TENDER_ENUMS = Object.freeze({
    proposalKind: Object.freeze(['INDEPENDENT_INQUIRY', 'BRIBE', 'SECURITY_THREAT']),
    playerCaseReference: Object.freeze(['KNOWN', 'UNKNOWN']),
    journalistEvidenceBelief: Object.freeze(['VERIFIED', 'PARTIAL', 'NONE']),
    sourceCustody: Object.freeze(['HAS_COPY', 'NO_COPY']),
    evidenceTruth: Object.freeze(['AUTHENTIC', 'TAMPERED', 'FABRICATED']),
    procurementTruth: Object.freeze(['CORRUPT', 'MIXED', 'CLEAN']),
    playerInvestigationAuthority: Object.freeze(['AUTHORIZED', 'UNAUTHORIZED']),
    journalistPosture: Object.freeze(['PRINCIPLED', 'CAUTIOUS', 'OPPORTUNIST']),
    sourceConfidence: Object.freeze(['HIGH', 'LOW']),
    playerPressHistory: Object.freeze(['PROTECTIVE', 'HOSTILE', 'UNKNOWN']),
    publicationRisk: Object.freeze(['HIGH', 'NORMAL'])
});

const MOBILIZATION_ENUMS = Object.freeze({
    proposalKind: Object.freeze(['LIMITED_PREPARATION', 'ULTIMATUM', 'DEMAND_PROOF']),
    playerReportReference: Object.freeze(['KNOWN', 'UNKNOWN']),
    listenerReportBelief: Object.freeze(['VERIFIED', 'REPORTED', 'NONE']),
    reportTruth: Object.freeze(['INVASION_PREP', 'EXERCISE', 'DECEPTION']),
    sourceConfidence: Object.freeze(['HIGH', 'MEDIUM', 'LOW']),
    mobilizationAuthority: Object.freeze(['AUTHORIZED', 'UNAUTHORIZED']),
    treatyStatus: Object.freeze(['PEACE', 'NON_AGGRESSION', 'ALLIANCE', 'WAR']),
    falseAlarmHistory: Object.freeze(['CLEAN', 'RECENT', 'REPEATED']),
    listenerPosture: Object.freeze(['INSTITUTIONALIST', 'CAREERIST', 'HONEST']),
    readinessCost: Object.freeze(['AFFORDABLE', 'STRAINED']),
    escalationVisibility: Object.freeze(['COVERT', 'OVERT'])
});

const SANCTIONS_ENUMS = Object.freeze({
    proposalKind: Object.freeze(['SMALL_TRIAL', 'THREAT', 'LEGAL_EXEMPTION']),
    playerSanctionReference: Object.freeze(['KNOWN', 'UNKNOWN']),
    listenerSanctionBelief: Object.freeze(['VERIFIED', 'REPORTED', 'NONE']),
    sanctionTruth: Object.freeze(['ACTIVE', 'EXPIRED', 'NONE']),
    goodsClassification: Object.freeze(['DUAL_USE', 'CIVILIAN', 'MILITARY']),
    intermediaryCapacity: Object.freeze(['VERIFIED', 'UNVERIFIED', 'INSUFFICIENT']),
    intermediaryReliability: Object.freeze(['HIGH', 'LOW', 'UNKNOWN']),
    portInspection: Object.freeze(['STRICT', 'MODERATE', 'WEAK']),
    paymentChannel: Object.freeze(['ESCROW', 'ENERGY_OFFSET', 'OPAQUE']),
    playerAuthority: Object.freeze(['AUTHORIZED', 'UNAUTHORIZED']),
    intermediaryPosture: Object.freeze(['CAUTIOUS', 'OPPORTUNIST', 'PRINCIPLED']),
    exemptionPath: Object.freeze(['AVAILABLE', 'UNAVAILABLE', 'UNKNOWN'])
});

const REFUGEE_ENUMS = Object.freeze({
    proposalKind: Object.freeze(['FUNDED_SETTLEMENT', 'FORCED_RETURN', 'TRANSIT_BARGAIN']),
    playerFlowReference: Object.freeze(['KNOWN', 'UNKNOWN']),
    listenerFlowBelief: Object.freeze(['VERIFIED', 'REPORTED', 'NONE']),
    flowTruth: Object.freeze(['BLOCKED', 'IN_TRANSIT', 'COMPLETED', 'MISSING']),
    peopleCount: Object.freeze(['VERIFIED', 'UNVERIFIED']),
    destinationCapacity: Object.freeze(['SUFFICIENT', 'INSUFFICIENT', 'UNKNOWN']),
    jobsCapacity: Object.freeze(['SUFFICIENT', 'INSUFFICIENT', 'UNKNOWN']),
    foodSecurity: Object.freeze(['SAFE', 'STRAINED']),
    localAttitude: Object.freeze(['SUPPORTIVE', 'DIVIDED', 'HOSTILE']),
    aidFunding: Object.freeze(['FUNDED', 'PROMISED', 'NONE']),
    playerAuthority: Object.freeze(['AUTHORIZED', 'UNAUTHORIZED']),
    voluntariness: Object.freeze(['VOLUNTARY', 'MIXED', 'FORCED']),
    listenerPosture: Object.freeze(['HUMANITARIAN', 'INSTITUTIONALIST', 'OPPORTUNIST']),
    neighborReliability: Object.freeze(['HIGH', 'LOW', 'UNKNOWN'])
});

const BANK_ENUMS = Object.freeze({
    proposalKind: Object.freeze(['DILUTION_AND_AUDIT', 'BLANK_CHEQUE', 'ORDERLY_FAILURE']),
    playerBankReference: Object.freeze(['KNOWN', 'UNKNOWN']),
    listenerBankBelief: Object.freeze(['VERIFIED', 'REPORTED', 'NONE']),
    bankTruth: Object.freeze(['LIQUIDITY_STRESSED', 'SOLVENT', 'FAILED', 'MISSING']),
    liquidityGap: Object.freeze(['VERIFIED', 'UNVERIFIED']),
    balanceSheetIntegrity: Object.freeze(['VERIFIED', 'SUSPICIOUS', 'FRAUDULENT']),
    depositExposure: Object.freeze(['MATERIAL', 'LOW', 'UNKNOWN']),
    systemicConnectivity: Object.freeze(['HIGH', 'LOW', 'UNKNOWN']),
    stateBudgetCapacity: Object.freeze(['SUFFICIENT', 'INSUFFICIENT', 'UNKNOWN']),
    playerAuthority: Object.freeze(['AUTHORIZED', 'UNAUTHORIZED']),
    ownerCrossHoldings: Object.freeze(['VERIFIED', 'NONE', 'UNKNOWN']),
    listenerPosture: Object.freeze(['PRAGMATIC', 'DEFENSIVE', 'OPPORTUNIST']),
    resolutionCapacity: Object.freeze(['SUFFICIENT', 'INSUFFICIENT', 'UNKNOWN']),
    mediaQuidProQuo: Object.freeze(['EXPLICIT', 'NONE'])
});

const PRISONER_ENUMS = Object.freeze({
    proposalKind: Object.freeze(['STAGED_VERIFICATION', 'INTELLIGENCE_BARGAIN', 'PROPAGANDA_REFUSAL']),
    playerDetentionReference: Object.freeze(['KNOWN', 'UNKNOWN']),
    listenerDetentionBelief: Object.freeze(['VERIFIED', 'REPORTED', 'NONE']),
    detaineeTruth: Object.freeze(['MATCHES_LIST', 'MISMATCH', 'MISSING']),
    identityVerification: Object.freeze(['VERIFIED', 'PARTIAL', 'NONE']),
    healthVerification: Object.freeze(['VERIFIED', 'PARTIAL', 'NONE']),
    secretExposure: Object.freeze(['HIGH', 'LOW', 'UNKNOWN']),
    counterpartyAccess: Object.freeze(['VERIFIED', 'CLAIMED', 'NONE']),
    publicPressure: Object.freeze(['HIGH', 'NORMAL']),
    priorCompliance: Object.freeze(['CLEAN', 'BREACHED', 'UNKNOWN']),
    exchangeSiteSecurity: Object.freeze(['SECURE', 'RISKY', 'UNKNOWN']),
    neutralObserver: Object.freeze(['AVAILABLE', 'UNAVAILABLE']),
    playerAuthority: Object.freeze(['AUTHORIZED', 'UNAUTHORIZED']),
    listenerPosture: Object.freeze(['HUMANITARIAN', 'SECURITY', 'OPPORTUNIST']),
    apologyStatus: Object.freeze(['OFFERED', 'REFUSED', 'NOT_REQUESTED'])
});

const PIPELINE_ENUMS = Object.freeze({
    proposalKind: Object.freeze(['LIMITED_DATA_SHARING', 'PUBLIC_ACCUSATION', 'SECRET_QUID_PRO_QUO']),
    playerIncidentReference: Object.freeze(['KNOWN', 'UNKNOWN']),
    listenerIncidentBelief: Object.freeze(['VERIFIED', 'REPORTED', 'NONE']),
    incidentTruth: Object.freeze(['SABOTAGE', 'ACCIDENT', 'THIRD_PARTY', 'MISSING']),
    causeEvidence: Object.freeze(['VERIFIED', 'PARTIAL', 'NONE']),
    detectionStatus: Object.freeze(['DETECTED', 'UNDETECTED']),
    attributionStatus: Object.freeze(['ATTRIBUTED', 'UNATTRIBUTED', 'DISPUTED']),
    rawLogsSensitivity: Object.freeze(['HIGH', 'LOW']),
    sensorWindowAvailable: Object.freeze(['AVAILABLE', 'UNAVAILABLE']),
    energyDependence: Object.freeze(['HIGH', 'LOW', 'UNKNOWN']),
    mediaNarrative: Object.freeze(['ACCUSATORY', 'CAUTIOUS', 'NONE']),
    borderProtocol: Object.freeze(['ACTIVE', 'MISSING', 'UNKNOWN']),
    neutralExperts: Object.freeze(['AVAILABLE', 'UNAVAILABLE']),
    simultaneousReleaseTrust: Object.freeze(['HIGH', 'LOW', 'BREACHED']),
    playerAuthority: Object.freeze(['AUTHORIZED', 'UNAUTHORIZED']),
    listenerPosture: Object.freeze(['INSTITUTIONALIST', 'DEFENSIVE', 'OPPORTUNIST']),
    smugglingCaseReference: Object.freeze(['KNOWN', 'UNKNOWN', 'NONE'])
});

const COUP_ENUMS = Object.freeze({
    proposalKind: Object.freeze(['CONSTITUTIONAL_TRANSITION', 'PERSONAL_OFFICE_BARGAIN',
        'SPLIT_PLOTTERS', 'REJECT_RUMOR']),
    playerRumorReference: Object.freeze(['KNOWN', 'UNKNOWN']),
    listenerRumorBelief: Object.freeze(['VERIFIED', 'REPORTED', 'NONE']),
    crisisTruth: Object.freeze(['ACTIVE', 'RESOLVED', 'NONE']),
    leaderCondition: Object.freeze(['CONFIRMED_INCAPACITATED', 'UNVERIFIED', 'HEALTHY', 'MISSING']),
    loyaltyEvidence: Object.freeze(['VERIFIED', 'PARTIAL', 'NONE']),
    playerAppointmentAuthority: Object.freeze(['AUTHORIZED', 'UNAUTHORIZED']),
    constitutionalPath: Object.freeze(['AVAILABLE', 'BLOCKED', 'UNKNOWN']),
    emergencySignatureChain: Object.freeze(['READY', 'GAP', 'UNKNOWN']),
    listenerPosture: Object.freeze(['PRINCIPLED', 'AMBITIOUS', 'OPPORTUNIST']),
    rivalNetwork: Object.freeze(['KNOWN', 'UNKNOWN', 'NONE']),
    disinformationCapability: Object.freeze(['AVAILABLE', 'UNAVAILABLE']),
    promiseIntegrity: Object.freeze(['CLEAN', 'BREACHED', 'UNKNOWN']),
    crisisStage: Object.freeze(['ORGANIZING', 'COALITION', 'ULTIMATUM', 'ATTEMPT', 'TERMINAL'])
});

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}
function hash(value) {
    return `sha256:${crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')}`;
}

function dialogueScenarioCatalog() { return clone(REFERENCE_SCENARIOS); }

function grainInputValidate(input) {
    const issues = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, issues: ['INPUT_OBJECT'] };
    const allowed = new Set(['scenarioId', 'caseId', 'playerText', ...Object.keys(GRAIN_ENUMS)]);
    Object.keys(input).forEach(key => { if (!allowed.has(key)) issues.push(`UNKNOWN_FIELD:${key}`); });
    if (input.scenarioId !== 'grain-scarcity-redirect') issues.push('SCENARIO_ID');
    if (!input.caseId || !/^[a-z0-9-]{1,64}$/.test(input.caseId)) issues.push('CASE_ID');
    if (!input.playerText || String(input.playerText).length > 1200) issues.push('PLAYER_TEXT');
    for (const [key, values] of Object.entries(GRAIN_ENUMS)) {
        if (!values.includes(input[key])) issues.push(`ENUM:${key}`);
    }
    return { ok: issues.length === 0, issues };
}

function grainResponseCode(input) {
    if (input.playerShipmentReference === 'UNKNOWN') return 'ASK_SHIPMENT_REFERENCE';
    if (input.listenerShipmentBelief !== 'VERIFIED') return 'ASK_EVIDENCE';
    if (input.listenerAuthority !== 'REDIRECT_AUTHORITY') return 'REFER_AUTHORIZED_OFFICE';
    if (input.proposalKind === 'COMPENSATED_REDIRECT') return 'CONDITIONAL_REDIRECT_OFFER';
    if (input.proposalKind === 'POLITICAL_PRESSURE') {
        if (input.listenerPosture === 'AUTHORITARIAN') return 'COMPLY_WITH_RELATION_COST';
        if (input.listenerPosture === 'ARMY_ALIGNED') return 'REJECT_AND_REFER_DEFENSE_COUNCIL';
        return 'REQUEST_WRITTEN_EMERGENCY_AUTHORITY';
    }
    return input.listenerPosture === 'OPPORTUNIST'
        ? 'CORRUPTION_COUNTERPARTY_CANDIDATE' : 'REJECT_OFFBOOK_PROPOSAL';
}

function grainMechanicalGate(input) {
    if (input.playerShipmentReference !== 'KNOWN') return 'SHIPMENT_REFERENCE_REQUIRED';
    if (input.listenerShipmentBelief !== 'VERIFIED') return 'LISTENER_EVIDENCE_REQUIRED';
    if (input.listenerAuthority !== 'REDIRECT_AUTHORITY') return 'LISTENER_LACKS_AUTHORITY';
    if (input.shipmentTruth !== 'ACTIVE') return 'SHIPMENT_NOT_ACTIVE';
    if (input.proposalKind === 'OFFBOOK_SALE') return 'OFFBOOK_EXECUTION_FORBIDDEN';
    return 'NEGOTIATION_ONLY';
}

function evaluateGrainScarcityScenario(input) {
    const validation = grainInputValidate(input);
    if (!validation.ok) return {
        schemaVersion: SCHEMA_VERSION, ok: false, code: 'INVALID_SCENARIO_INPUT',
        issues: validation.issues, executable: false, worldMutation: false, source: SOURCE
    };
    const definition = REFERENCE_SCENARIOS.find(row => row.id === input.scenarioId);
    const responseCode = grainResponseCode(input);
    const mechanicalGate = grainMechanicalGate(input);
    const payload = {
        schemaVersion: SCHEMA_VERSION, scenarioId: input.scenarioId, caseId: input.caseId,
        selectedBranch: input.proposalKind, responseCode, mechanicalGate,
        candidateBranches: definition.branches.slice(),
        listenerKnowledgeUsed: input.listenerShipmentBelief,
        playerKnowledgeUsed: input.playerShipmentReference,
        rawWorldRead: false, integrationStatus: 'FIXTURE_ONLY',
        executable: false, worldMutation: false, source: SOURCE
    };
    return Object.assign({ ok: true, code: 'SCENARIO_EVALUATED', decisionHash: hash(payload) }, payload);
}

function grainResultValidate(result) {
    const issues = [];
    if (!result || typeof result !== 'object') return { ok: false, issues: ['RESULT_OBJECT'] };
    if (result.schemaVersion !== SCHEMA_VERSION) issues.push('SCHEMA_VERSION');
    if (result.source !== SOURCE) issues.push('SOURCE');
    if (result.executable !== false || result.worldMutation !== false) issues.push('MUTATION_AUTHORITY');
    if (result.ok) {
        if (result.integrationStatus !== 'FIXTURE_ONLY') issues.push('INTEGRATION_STATUS');
        if (result.rawWorldRead !== false) issues.push('RAW_WORLD_READ');
        if (!Array.isArray(result.candidateBranches) || result.candidateBranches.length < 3) issues.push('BRANCH_COUNT');
        if (!result.candidateBranches.includes(result.selectedBranch)) issues.push('SELECTED_BRANCH');
        const payload = clone(result);
        delete payload.ok;
        delete payload.code;
        delete payload.decisionHash;
        if (result.decisionHash !== hash(payload)) issues.push('DECISION_HASH');
    }
    return { ok: issues.length === 0, issues };
}

function strikeInputValidate(input) {
    const issues = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, issues: ['INPUT_OBJECT'] };
    const allowed = new Set(['scenarioId', 'caseId', 'playerText', ...Object.keys(STRIKE_ENUMS)]);
    Object.keys(input).forEach(key => { if (!allowed.has(key)) issues.push(`UNKNOWN_FIELD:${key}`); });
    if (input.scenarioId !== 'steel-strike-bargain') issues.push('SCENARIO_ID');
    if (!input.caseId || !/^[a-z0-9-]{1,64}$/.test(input.caseId)) issues.push('CASE_ID');
    if (!input.playerText || String(input.playerText).length > 1200) issues.push('PLAYER_TEXT');
    for (const [key, values] of Object.entries(STRIKE_ENUMS)) {
        if (!values.includes(input[key])) issues.push(`ENUM:${key}`);
    }
    return { ok: issues.length === 0, issues };
}

function strikeResponseCode(input) {
    if (input.playerStrikeReference === 'UNKNOWN') return 'ASK_STRIKE_REFERENCE';
    if (input.listenerStrikeBelief !== 'VERIFIED') return 'ASK_STRIKE_EVIDENCE';
    if (input.listenerAuthority !== 'UNION_MANDATE') return 'REFER_AUTHORIZED_UNION_BODY';
    if (input.proposalKind === 'STAGED_WAGE') {
        if (input.companyLiquidity === 'UNKNOWN') return 'ASK_AUDITED_COMPANY_FINANCES';
        if (input.safetyEvidence !== 'VERIFIED') return 'COUNTER_WITH_JOINT_SAFETY_AUDIT';
        return 'SUBMIT_STRIKE_SUSPENSION_TO_MEMBERS';
    }
    if (input.proposalKind === 'THREAT') {
        if (input.listenerPosture === 'OPPORTUNIST') return 'SEEK_PERSONAL_IMMUNITY';
        if (input.listenerPosture === 'FEARFUL' && input.strikeSupport === 'WEAK') {
            return 'RETREAT_WITH_RADICALIZATION_RISK';
        }
        return 'REJECT_AND_ESCALATE_STRIKE';
    }
    if (input.listenerPosture === 'OPPORTUNIST') return 'ACCEPT_SELECTIVE_BONUS_CHANNEL';
    if (input.listenerPosture === 'PRINCIPLED') return 'WARN_DISCRIMINATION_ESCALATION';
    return 'SPLIT_RISK_UNCERTAIN';
}

function strikeMechanicalGate(input) {
    if (input.playerStrikeReference !== 'KNOWN') return 'STRIKE_REFERENCE_REQUIRED';
    if (input.listenerStrikeBelief !== 'VERIFIED') return 'LISTENER_EVIDENCE_REQUIRED';
    if (input.listenerAuthority !== 'UNION_MANDATE') return 'LISTENER_LACKS_UNION_MANDATE';
    if (input.strikeTruth !== 'ACTIVE') return 'STRIKE_NOT_ACTIVE';
    if (input.proposalKind === 'STAGED_WAGE') {
        if (input.companyLiquidity !== 'SUFFICIENT') return 'COMPANY_LIQUIDITY_NOT_VERIFIED';
        if (input.inflationWageGap === 'UNKNOWN') return 'WAGE_GAP_NOT_VERIFIED';
        if (input.safetyEvidence !== 'VERIFIED') return 'SAFETY_AUDIT_REQUIRED';
        return 'MEMBER_VOTE_REQUIRED';
    }
    if (input.proposalKind === 'THREAT') return 'COERCIVE_ACTION_FORBIDDEN';
    return 'DISCRIMINATION_REVIEW_REQUIRED';
}

function evaluateSteelStrikeScenario(input) {
    const validation = strikeInputValidate(input);
    if (!validation.ok) return {
        schemaVersion: SCHEMA_VERSION, ok: false, code: 'INVALID_SCENARIO_INPUT',
        issues: validation.issues, executable: false, worldMutation: false, source: SOURCE
    };
    const definition = REFERENCE_SCENARIOS.find(row => row.id === input.scenarioId);
    const responseCode = strikeResponseCode(input);
    const mechanicalGate = strikeMechanicalGate(input);
    const payload = {
        schemaVersion: SCHEMA_VERSION, scenarioId: input.scenarioId, caseId: input.caseId,
        selectedBranch: input.proposalKind, responseCode, mechanicalGate,
        candidateBranches: definition.branches.slice(),
        listenerKnowledgeUsed: input.listenerStrikeBelief,
        playerKnowledgeUsed: input.playerStrikeReference,
        wageModelActive: false, leaderCannotEndStrikeAlone: true,
        rawWorldRead: false, integrationStatus: 'FIXTURE_ONLY',
        executable: false, worldMutation: false, source: SOURCE
    };
    return Object.assign({ ok: true, code: 'SCENARIO_EVALUATED', decisionHash: hash(payload) }, payload);
}

function strikeResultValidate(result) {
    const shared = grainResultValidate(result);
    const issues = shared.issues.slice();
    if (result && result.ok && (result.wageModelActive !== false
        || result.leaderCannotEndStrikeAlone !== true)) issues.push('LABOR_AUTHORITY_BOUNDARY');
    return { ok: issues.length === 0, issues };
}

function tenderInputValidate(input) {
    const issues = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, issues: ['INPUT_OBJECT'] };
    const allowed = new Set(['scenarioId', 'caseId', 'playerText', ...Object.keys(TENDER_ENUMS)]);
    Object.keys(input).forEach(key => { if (!allowed.has(key)) issues.push(`UNKNOWN_FIELD:${key}`); });
    if (input.scenarioId !== 'arms-tender-leak') issues.push('SCENARIO_ID');
    if (!input.caseId || !/^[a-z0-9-]{1,64}$/.test(input.caseId)) issues.push('CASE_ID');
    if (!input.playerText || String(input.playerText).length > 1200) issues.push('PLAYER_TEXT');
    for (const [key, values] of Object.entries(TENDER_ENUMS)) {
        if (!values.includes(input[key])) issues.push(`ENUM:${key}`);
    }
    return { ok: issues.length === 0, issues };
}

function tenderResponseCode(input) {
    if (input.playerCaseReference === 'UNKNOWN') return 'ASK_CASE_REFERENCE';
    if (input.journalistEvidenceBelief === 'NONE') return 'ASK_DOCUMENTED_EVIDENCE';
    if (input.sourceCustody !== 'HAS_COPY') return 'REFER_SOURCE_CUSTODIAN';
    if (input.proposalKind === 'INDEPENDENT_INQUIRY') {
        if (input.playerInvestigationAuthority !== 'AUTHORIZED') return 'DEMAND_INDEPENDENT_AUTHORITY';
        if (input.journalistEvidenceBelief === 'PARTIAL' || input.sourceConfidence === 'LOW') {
            return 'SHARE_REDACTED_COPY_FOR_VERIFICATION';
        }
        if (input.journalistPosture === 'OPPORTUNIST') return 'ACCEPT_DELAY_WITH_PERSONAL_GUARANTEE';
        return 'ACCEPT_48H_CONDITIONAL_HOLD';
    }
    if (input.proposalKind === 'BRIBE') {
        return input.journalistPosture === 'OPPORTUNIST'
            ? 'BRIBE_OR_STING_CANDIDATE' : 'REJECT_AND_RECORD_BRIBE_OFFER';
    }
    if (input.journalistPosture === 'PRINCIPLED' || input.playerPressHistory === 'HOSTILE') {
        return 'DISTRIBUTE_DOCUMENTS_AND_PUBLISH';
    }
    if (input.journalistPosture === 'CAUTIOUS' && input.publicationRisk === 'HIGH') {
        return 'SEEK_COUNSEL_WITHOUT_SURRENDERING_COPY';
    }
    return 'LEVERAGE_THREAT_FOR_PROTECTION';
}

function tenderMechanicalGate(input) {
    if (input.playerCaseReference !== 'KNOWN') return 'CASE_REFERENCE_REQUIRED';
    if (input.journalistEvidenceBelief === 'NONE' || input.sourceCustody !== 'HAS_COPY') {
        return 'SOURCE_EVIDENCE_REQUIRED';
    }
    if (input.evidenceTruth === 'FABRICATED') return 'EVIDENCE_FALSE';
    if (input.evidenceTruth === 'TAMPERED' || input.procurementTruth === 'MIXED') {
        return 'EVIDENCE_INTEGRITY_REVIEW_REQUIRED';
    }
    if (input.proposalKind === 'INDEPENDENT_INQUIRY') {
        if (input.playerInvestigationAuthority !== 'AUTHORIZED') return 'INVESTIGATION_AUTHORITY_REQUIRED';
        return 'MEDIA_PUBLICATION_ADAPTER_MISSING';
    }
    return input.proposalKind === 'BRIBE'
        ? 'CORRUPTION_ACTION_FORBIDDEN' : 'COERCIVE_ACTION_FORBIDDEN';
}

function evaluateArmsTenderScenario(input) {
    const validation = tenderInputValidate(input);
    if (!validation.ok) return {
        schemaVersion: SCHEMA_VERSION, ok: false, code: 'INVALID_SCENARIO_INPUT',
        issues: validation.issues, executable: false, worldMutation: false, source: SOURCE
    };
    const definition = REFERENCE_SCENARIOS.find(row => row.id === input.scenarioId);
    const responseCode = tenderResponseCode(input);
    const mechanicalGate = tenderMechanicalGate(input);
    const payload = {
        schemaVersion: SCHEMA_VERSION, scenarioId: input.scenarioId, caseId: input.caseId,
        selectedBranch: input.proposalKind, responseCode, mechanicalGate,
        candidateBranches: definition.branches.slice(),
        listenerKnowledgeUsed: input.journalistEvidenceBelief,
        playerKnowledgeUsed: input.playerCaseReference,
        namedJournalistAvailable: false, mediaOwnershipModelActive: false,
        integrityEvidenceLedgerAvailable: true,
        rawWorldRead: false, integrationStatus: 'FIXTURE_ONLY',
        executable: false, worldMutation: false, source: SOURCE
    };
    return Object.assign({ ok: true, code: 'SCENARIO_EVALUATED', decisionHash: hash(payload) }, payload);
}

function tenderResultValidate(result) {
    const shared = grainResultValidate(result);
    const issues = shared.issues.slice();
    if (result && result.ok && (result.namedJournalistAvailable !== false
        || result.mediaOwnershipModelActive !== false
        || result.integrityEvidenceLedgerAvailable !== true)) issues.push('MEDIA_INTEGRATION_BOUNDARY');
    return { ok: issues.length === 0, issues };
}

function mobilizationInputValidate(input) {
    const issues = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, issues: ['INPUT_OBJECT'] };
    const allowed = new Set(['scenarioId', 'caseId', 'playerText', ...Object.keys(MOBILIZATION_ENUMS)]);
    Object.keys(input).forEach(key => { if (!allowed.has(key)) issues.push(`UNKNOWN_FIELD:${key}`); });
    if (input.scenarioId !== 'border-mobilization') issues.push('SCENARIO_ID');
    if (!input.caseId || !/^[a-z0-9-]{1,64}$/.test(input.caseId)) issues.push('CASE_ID');
    if (!input.playerText || String(input.playerText).length > 1200) issues.push('PLAYER_TEXT');
    for (const [key, values] of Object.entries(MOBILIZATION_ENUMS)) {
        if (!values.includes(input[key])) issues.push(`ENUM:${key}`);
    }
    return { ok: issues.length === 0, issues };
}

function mobilizationResponseCode(input) {
    if (input.playerReportReference === 'UNKNOWN') return 'ASK_REPORT_REFERENCE';
    if (input.listenerReportBelief === 'NONE') return 'ASK_INTELLIGENCE_SOURCE';
    if (input.proposalKind === 'LIMITED_PREPARATION') {
        if (input.mobilizationAuthority !== 'AUTHORIZED') return 'REFER_WAR_CABINET';
        if (input.sourceConfidence === 'LOW' || input.falseAlarmHistory === 'REPEATED') {
            return 'EXPAND_RECON_BEFORE_MOVEMENT';
        }
        if (input.readinessCost === 'STRAINED') return 'OFFER_REDUCED_COVERT_PREPARATION';
        return 'SUPPORT_LIMITED_COVERT_PREPARATION';
    }
    if (input.proposalKind === 'ULTIMATUM') {
        if (input.treatyStatus === 'NON_AGGRESSION' || input.treatyStatus === 'ALLIANCE') {
            return 'WARN_TREATY_AND_ESCALATION_COST';
        }
        if (input.sourceConfidence !== 'HIGH') return 'REJECT_ULTIMATUM_WITHOUT_CORROBORATION';
        return 'REFER_ULTIMATUM_TO_EXECUTIVE_AUTHORITY';
    }
    if (input.listenerPosture === 'CAREERIST') return 'REPORT_INFLATION_RISK';
    if (input.listenerPosture === 'HONEST') return 'STATE_INTENT_NOT_PROVEN';
    return 'REQUEST_MORE_TIME_AND_SOURCES';
}

function mobilizationMechanicalGate(input) {
    if (input.playerReportReference !== 'KNOWN') return 'REPORT_REFERENCE_REQUIRED';
    if (input.listenerReportBelief === 'NONE') return 'LISTENER_REPORT_REQUIRED';
    if (input.reportTruth === 'EXERCISE') return 'HOSTILE_INTENT_NOT_CONFIRMED';
    if (input.reportTruth === 'DECEPTION') return 'DECEPTION_REVIEW_REQUIRED';
    if (input.sourceConfidence !== 'HIGH') return 'CORROBORATION_REQUIRED';
    if (input.proposalKind === 'LIMITED_PREPARATION') {
        if (input.mobilizationAuthority !== 'AUTHORIZED') return 'MOBILIZATION_AUTHORITY_REQUIRED';
        if (input.treatyStatus === 'ALLIANCE') return 'ALLIANCE_CONFLICT_REVIEW_REQUIRED';
        return 'MOBILIZATION_ADAPTER_MISSING';
    }
    if (input.proposalKind === 'ULTIMATUM') {
        if (input.treatyStatus === 'NON_AGGRESSION' || input.treatyStatus === 'ALLIANCE') {
            return 'TREATY_COMPATIBILITY_REVIEW_REQUIRED';
        }
        return 'DIPLOMATIC_ESCALATION_ADAPTER_MISSING';
    }
    return 'STRATEGIC_REPORT_ADAPTER_MISSING';
}

function evaluateBorderMobilizationScenario(input) {
    const validation = mobilizationInputValidate(input);
    if (!validation.ok) return {
        schemaVersion: SCHEMA_VERSION, ok: false, code: 'INVALID_SCENARIO_INPUT',
        issues: validation.issues, executable: false, worldMutation: false, source: SOURCE
    };
    const definition = REFERENCE_SCENARIOS.find(row => row.id === input.scenarioId);
    const responseCode = mobilizationResponseCode(input);
    const mechanicalGate = mobilizationMechanicalGate(input);
    const selectedBranch = ({
        LIMITED_PREPARATION: 'LIMITED_MOBILIZATION',
        ULTIMATUM: 'PREEMPTIVE_ESCALATION',
        DEMAND_PROOF: 'VERIFY_FIRST'
    })[input.proposalKind];
    const payload = {
        schemaVersion: SCHEMA_VERSION, scenarioId: input.scenarioId, caseId: input.caseId,
        selectedBranch, proposalKind: input.proposalKind, responseCode, mechanicalGate,
        candidateBranches: definition.branches.slice(),
        listenerKnowledgeUsed: input.listenerReportBelief,
        playerKnowledgeUsed: input.playerReportReference,
        intelligenceActorsAvailable: true, strategicReportSystemActive: false,
        mobilizationDoctrineActive: false, rawWorldRead: false,
        integrationStatus: 'FIXTURE_ONLY', executable: false, worldMutation: false, source: SOURCE
    };
    return Object.assign({ ok: true, code: 'SCENARIO_EVALUATED', decisionHash: hash(payload) }, payload);
}

function mobilizationResultValidate(result) {
    const shared = grainResultValidate(result);
    const issues = shared.issues.slice();
    if (result && result.ok && (result.intelligenceActorsAvailable !== true
        || result.strategicReportSystemActive !== false
        || result.mobilizationDoctrineActive !== false)) issues.push('MOBILIZATION_INTEGRATION_BOUNDARY');
    return { ok: issues.length === 0, issues };
}

function sanctionsInputValidate(input) {
    const issues = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, issues: ['INPUT_OBJECT'] };
    const allowed = new Set(['scenarioId', 'caseId', 'playerText', ...Object.keys(SANCTIONS_ENUMS)]);
    Object.keys(input).forEach(key => { if (!allowed.has(key)) issues.push(`UNKNOWN_FIELD:${key}`); });
    if (input.scenarioId !== 'sanctions-shell-company') issues.push('SCENARIO_ID');
    if (!input.caseId || !/^[a-z0-9-]{1,64}$/.test(input.caseId)) issues.push('CASE_ID');
    if (!input.playerText || String(input.playerText).length > 1200) issues.push('PLAYER_TEXT');
    for (const [key, values] of Object.entries(SANCTIONS_ENUMS)) {
        if (!values.includes(input[key])) issues.push(`ENUM:${key}`);
    }
    return { ok: issues.length === 0, issues };
}

function sanctionsResponseCode(input) {
    if (input.playerSanctionReference === 'UNKNOWN') return 'ASK_SANCTION_REFERENCE';
    if (input.listenerSanctionBelief === 'NONE') return 'ASK_SANCTION_EVIDENCE';
    if (input.playerAuthority !== 'AUTHORIZED') return 'REFER_AUTHORIZED_TRADE_OFFICE';
    if (input.proposalKind === 'SMALL_TRIAL') {
        if (input.intermediaryCapacity === 'UNVERIFIED') return 'ASK_INTERMEDIARY_CAPACITY_PROOF';
        if (input.intermediaryCapacity === 'INSUFFICIENT') return 'DECLINE_INSUFFICIENT_CAPACITY';
        if (input.intermediaryReliability !== 'HIGH') return 'DEMAND_HIGHER_ESCROW_OR_REFUSE';
        return 'COUNTER_WITH_HALF_ESCROW';
    }
    if (input.proposalKind === 'THREAT') {
        if (input.intermediaryPosture === 'CAUTIOUS') return 'RECORD_AND_SEEK_PROTECTION';
        if (input.intermediaryPosture === 'OPPORTUNIST') return 'LOWER_PRICE_OR_SELL_INFORMATION';
        return 'TERMINATE_AND_REPORT';
    }
    if (input.exemptionPath === 'UNAVAILABLE') return 'EXPLAIN_NO_EXEMPTION_PATH';
    if (input.exemptionPath === 'UNKNOWN') return 'REQUEST_FORMAL_CLASSIFICATION';
    return 'ACCEPT_CIVILIAN_INSPECTION_PATH';
}

function sanctionsMechanicalGate(input) {
    if (input.playerSanctionReference !== 'KNOWN') return 'SANCTION_REFERENCE_REQUIRED';
    if (input.listenerSanctionBelief === 'NONE') return 'LISTENER_SANCTION_EVIDENCE_REQUIRED';
    if (input.playerAuthority !== 'AUTHORIZED') return 'TRADE_AUTHORITY_REQUIRED';
    if (input.sanctionTruth !== 'ACTIVE') return 'SANCTION_NOT_ACTIVE';
    if (input.goodsClassification === 'MILITARY') return 'MILITARY_EXPORT_PROHIBITED';
    if (input.paymentChannel === 'OPAQUE') return 'PAYMENT_CHANNEL_NOT_AUDITABLE';
    if (input.proposalKind === 'THREAT') return 'COERCIVE_ACTION_FORBIDDEN';
    if (input.proposalKind === 'LEGAL_EXEMPTION') {
        if (input.exemptionPath !== 'AVAILABLE') return 'LEGAL_EXEMPTION_PATH_UNAVAILABLE';
        return 'LEGAL_EXEMPTION_ADAPTER_MISSING';
    }
    if (input.goodsClassification === 'DUAL_USE') return 'DUAL_USE_CLASSIFICATION_REVIEW_REQUIRED';
    if (input.paymentChannel === 'ENERGY_OFFSET') return 'BARTER_SETTLEMENT_ADAPTER_MISSING';
    return 'SANCTIONS_REGIME_ADAPTER_MISSING';
}

function evaluateSanctionsShellCompanyScenario(input) {
    const validation = sanctionsInputValidate(input);
    if (!validation.ok) return {
        schemaVersion: SCHEMA_VERSION, ok: false, code: 'INVALID_SCENARIO_INPUT',
        issues: validation.issues, executable: false, worldMutation: false, source: SOURCE
    };
    const definition = REFERENCE_SCENARIOS.find(row => row.id === input.scenarioId);
    const payload = {
        schemaVersion: SCHEMA_VERSION, scenarioId: input.scenarioId, caseId: input.caseId,
        selectedBranch: input.proposalKind,
        responseCode: sanctionsResponseCode(input), mechanicalGate: sanctionsMechanicalGate(input),
        candidateBranches: definition.branches.slice(),
        listenerKnowledgeUsed: input.listenerSanctionBelief,
        playerKnowledgeUsed: input.playerSanctionReference,
        companiesAvailable: true, tradeEscrowAvailable: true, intelligenceActorsAvailable: true,
        sanctionsRegimeActive: false, beneficialOwnershipRegistryActive: false,
        amlScreeningActive: false, rawWorldRead: false,
        integrationStatus: 'FIXTURE_ONLY', executable: false, worldMutation: false, source: SOURCE
    };
    return Object.assign({ ok: true, code: 'SCENARIO_EVALUATED', decisionHash: hash(payload) }, payload);
}

function sanctionsResultValidate(result) {
    const shared = grainResultValidate(result);
    const issues = shared.issues.slice();
    if (result && result.ok && (result.companiesAvailable !== true
        || result.tradeEscrowAvailable !== true
        || result.intelligenceActorsAvailable !== true
        || result.sanctionsRegimeActive !== false
        || result.beneficialOwnershipRegistryActive !== false
        || result.amlScreeningActive !== false)) issues.push('SANCTIONS_INTEGRATION_BOUNDARY');
    return { ok: issues.length === 0, issues };
}

function refugeeInputValidate(input) {
    const issues = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, issues: ['INPUT_OBJECT'] };
    const allowed = new Set(['scenarioId', 'caseId', 'playerText', ...Object.keys(REFUGEE_ENUMS)]);
    Object.keys(input).forEach(key => { if (!allowed.has(key)) issues.push(`UNKNOWN_FIELD:${key}`); });
    if (input.scenarioId !== 'refugee-border-bargain') issues.push('SCENARIO_ID');
    if (!input.caseId || !/^[a-z0-9-]{1,64}$/.test(input.caseId)) issues.push('CASE_ID');
    if (!input.playerText || String(input.playerText).length > 1200) issues.push('PLAYER_TEXT');
    for (const [key, values] of Object.entries(REFUGEE_ENUMS)) {
        if (!values.includes(input[key])) issues.push(`ENUM:${key}`);
    }
    return { ok: issues.length === 0, issues };
}

function refugeeResponseCode(input) {
    if (input.playerFlowReference === 'UNKNOWN') return 'ASK_REFUGEE_FLOW_REFERENCE';
    if (input.listenerFlowBelief === 'NONE') return 'ASK_REFUGEE_FLOW_EVIDENCE';
    if (input.playerAuthority !== 'AUTHORIZED') return 'REFER_AUTHORIZED_BORDER_OFFICE';
    if (input.peopleCount !== 'VERIFIED') return 'ASK_VERIFIED_COHORT_COUNT';
    if (input.proposalKind === 'FUNDED_SETTLEMENT') {
        if (input.voluntariness === 'FORCED') return 'REJECT_FORCED_SETTLEMENT';
        if (input.destinationCapacity === 'UNKNOWN' || input.jobsCapacity === 'UNKNOWN') {
            return 'ASK_DESTINATION_CAPACITY_AUDIT';
        }
        if (input.destinationCapacity === 'INSUFFICIENT') return 'PROPOSE_ALTERNATIVE_REGIONS';
        if (input.aidFunding !== 'FUNDED') return 'DEMAND_FUNDS_BEFORE_ACCEPTANCE';
        if (input.localAttitude === 'HOSTILE' || input.foodSecurity === 'STRAINED') {
            return 'COUNTER_WITH_LOCAL_SERVICES_AND_PHASES';
        }
        return 'CONDITIONAL_VOLUNTARY_SETTLEMENT';
    }
    if (input.proposalKind === 'FORCED_RETURN') {
        if (input.listenerPosture === 'HUMANITARIAN') return 'REFUSE_FORCED_RETURN';
        if (input.listenerPosture === 'OPPORTUNIST') return 'SEEK_IMMUNITY_FOR_ENFORCEMENT';
        return 'REQUEST_LEGAL_ORDER_AND_INDIVIDUAL_REVIEW';
    }
    if (input.neighborReliability === 'LOW') return 'DEMAND_ESCROW_AND_MONITORING';
    if (input.neighborReliability === 'UNKNOWN') return 'REQUEST_COUNTERPARTY_GUARANTEE';
    if (input.aidFunding === 'NONE') return 'ASK_PER_CAPITA_FUNDING';
    return 'NEGOTIATE_MONITORED_TRANSIT_CENTER';
}

function refugeeMechanicalGate(input) {
    if (input.playerFlowReference !== 'KNOWN') return 'REFUGEE_FLOW_REFERENCE_REQUIRED';
    if (input.listenerFlowBelief === 'NONE') return 'LISTENER_FLOW_EVIDENCE_REQUIRED';
    if (input.playerAuthority !== 'AUTHORIZED') return 'BORDER_AUTHORITY_REQUIRED';
    if (input.flowTruth === 'MISSING' || input.flowTruth === 'COMPLETED') return 'REFUGEE_FLOW_NOT_ACTIONABLE';
    if (input.peopleCount !== 'VERIFIED') return 'COHORT_COUNT_VERIFICATION_REQUIRED';
    if (input.proposalKind === 'FORCED_RETURN' || input.voluntariness === 'FORCED') {
        return 'FORCED_DISPLACEMENT_FORBIDDEN';
    }
    if (input.proposalKind === 'TRANSIT_BARGAIN') return 'THIRD_PARTY_TRANSIT_POLICY_MISSING';
    if (input.destinationCapacity !== 'SUFFICIENT') return 'RECEPTION_CAPACITY_NOT_VERIFIED';
    if (input.jobsCapacity !== 'SUFFICIENT') return 'EMPLOYMENT_CAPACITY_NOT_VERIFIED';
    if (input.aidFunding !== 'FUNDED') return 'AID_FUNDING_NOT_SETTLED';
    return 'HUMAN_MIGRATION_COMMAND_ADAPTER_MISSING';
}

function evaluateRefugeeBorderScenario(input) {
    const validation = refugeeInputValidate(input);
    if (!validation.ok) return {
        schemaVersion: SCHEMA_VERSION, ok: false, code: 'INVALID_SCENARIO_INPUT',
        issues: validation.issues, executable: false, worldMutation: false, source: SOURCE
    };
    const definition = REFERENCE_SCENARIOS.find(row => row.id === input.scenarioId);
    const payload = {
        schemaVersion: SCHEMA_VERSION, scenarioId: input.scenarioId, caseId: input.caseId,
        selectedBranch: input.proposalKind,
        responseCode: refugeeResponseCode(input), mechanicalGate: refugeeMechanicalGate(input),
        candidateBranches: definition.branches.slice(),
        listenerKnowledgeUsed: input.listenerFlowBelief,
        playerKnowledgeUsed: input.playerFlowReference,
        humanMigrationLedgerAvailable: true, populationCohortsAvailable: true,
        receptionCapacityProxyAvailable: true, borderPolicyActive: false,
        housingAssetModelActive: false, familyNetworkModelActive: false,
        internationalAidExecutorActive: false, thirdPartyTransitActive: false,
        rawWorldRead: false, integrationStatus: 'FIXTURE_ONLY',
        executable: false, worldMutation: false, source: SOURCE
    };
    return Object.assign({ ok: true, code: 'SCENARIO_EVALUATED', decisionHash: hash(payload) }, payload);
}

function refugeeResultValidate(result) {
    const shared = grainResultValidate(result);
    const issues = shared.issues.slice();
    if (result && result.ok && (result.humanMigrationLedgerAvailable !== true
        || result.populationCohortsAvailable !== true
        || result.receptionCapacityProxyAvailable !== true
        || result.borderPolicyActive !== false
        || result.housingAssetModelActive !== false
        || result.familyNetworkModelActive !== false
        || result.internationalAidExecutorActive !== false
        || result.thirdPartyTransitActive !== false)) issues.push('REFUGEE_INTEGRATION_BOUNDARY');
    return { ok: issues.length === 0, issues };
}

function bankInputValidate(input) {
    const issues = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, issues: ['INPUT_OBJECT'] };
    const allowed = new Set(['scenarioId', 'caseId', 'playerText', ...Object.keys(BANK_ENUMS)]);
    Object.keys(input).forEach(key => { if (!allowed.has(key)) issues.push(`UNKNOWN_FIELD:${key}`); });
    if (input.scenarioId !== 'bank-bailout-oligarch') issues.push('SCENARIO_ID');
    if (!input.caseId || !/^[a-z0-9-]{1,64}$/.test(input.caseId)) issues.push('CASE_ID');
    if (!input.playerText || String(input.playerText).length > 1200) issues.push('PLAYER_TEXT');
    for (const [key, values] of Object.entries(BANK_ENUMS)) {
        if (!values.includes(input[key])) issues.push(`ENUM:${key}`);
    }
    return { ok: issues.length === 0, issues };
}

function bankResponseCode(input) {
    if (input.playerBankReference === 'UNKNOWN') return 'ASK_BANK_REFERENCE';
    if (input.listenerBankBelief === 'NONE') return 'ASK_BANK_CRISIS_EVIDENCE';
    if (input.playerAuthority !== 'AUTHORIZED') return 'REFER_AUTHORIZED_FINANCE_OFFICE';
    if (input.liquidityGap !== 'VERIFIED') return 'DEMAND_INDEPENDENT_LIQUIDITY_AUDIT';
    if (input.proposalKind === 'DILUTION_AND_AUDIT') {
        if (input.balanceSheetIntegrity === 'FRAUDULENT') return 'ACCEPT_DEPOSIT_PROTECTION_NOT_OWNER_IMMUNITY';
        if (input.stateBudgetCapacity !== 'SUFFICIENT') return 'REJECT_UNFUNDED_RESCUE';
        if (input.listenerPosture === 'DEFENSIVE') return 'COUNTER_WITH_MANAGER_IMMUNITY_REQUEST';
        if (input.listenerPosture === 'OPPORTUNIST') return 'SEEK_CONTROL_PROTECTION_AND_PRICE';
        return 'ACCEPT_CONDITIONAL_DILUTION_AND_AUDIT';
    }
    if (input.proposalKind === 'BLANK_CHEQUE') {
        if (input.listenerPosture === 'OPPORTUNIST') return 'ACCEPT_OR_RECORD_CORRUPT_BARGAIN';
        if (input.listenerPosture === 'DEFENSIVE') return 'SEEK_WRITTEN_POLITICAL_PROTECTION';
        return 'REJECT_MEDIA_QUID_PRO_QUO';
    }
    if (input.systemicConnectivity === 'HIGH') return 'WARN_CONTAGION_BEFORE_LIQUIDATION';
    if (input.resolutionCapacity === 'UNKNOWN') return 'REQUEST_DEPOSIT_TRANSFER_PLAN';
    if (input.resolutionCapacity === 'INSUFFICIENT') return 'REJECT_DISORDERLY_FAILURE';
    return 'SUPPORT_PROTECTED_ORDERLY_FAILURE';
}

function bankMechanicalGate(input) {
    if (input.playerBankReference !== 'KNOWN') return 'BANK_REFERENCE_REQUIRED';
    if (input.listenerBankBelief === 'NONE') return 'LISTENER_BANK_EVIDENCE_REQUIRED';
    if (input.playerAuthority !== 'AUTHORIZED') return 'FINANCIAL_AUTHORITY_REQUIRED';
    if (input.bankTruth !== 'LIQUIDITY_STRESSED') return 'BANK_CRISIS_NOT_ACTIONABLE';
    if (input.liquidityGap !== 'VERIFIED') return 'LIQUIDITY_GAP_VERIFICATION_REQUIRED';
    if (input.balanceSheetIntegrity === 'FRAUDULENT') return 'BANK_FRAUD_INVESTIGATION_REQUIRED';
    if (input.proposalKind === 'BLANK_CHEQUE' || input.mediaQuidProQuo === 'EXPLICIT') {
        return 'CORRUPTION_ACTION_FORBIDDEN';
    }
    if (input.proposalKind === 'DILUTION_AND_AUDIT') {
        if (input.stateBudgetCapacity !== 'SUFFICIENT') return 'STATE_BUDGET_CAPACITY_REQUIRED';
        if (input.ownerCrossHoldings === 'UNKNOWN') return 'BENEFICIAL_OWNERSHIP_REVIEW_REQUIRED';
        return 'BANK_RESOLUTION_EXECUTOR_MISSING';
    }
    if (input.systemicConnectivity !== 'LOW') return 'SYSTEMIC_RISK_MODEL_REQUIRED';
    if (input.resolutionCapacity !== 'SUFFICIENT') return 'RESOLUTION_CAPACITY_REQUIRED';
    if (input.depositExposure === 'UNKNOWN') return 'DEPOSIT_EXPOSURE_VERIFICATION_REQUIRED';
    return 'DEPOSIT_TRANSFER_EXECUTOR_MISSING';
}

function evaluateBankBailoutScenario(input) {
    const validation = bankInputValidate(input);
    if (!validation.ok) return {
        schemaVersion: SCHEMA_VERSION, ok: false, code: 'INVALID_SCENARIO_INPUT',
        issues: validation.issues, executable: false, worldMutation: false, source: SOURCE
    };
    const definition = REFERENCE_SCENARIOS.find(row => row.id === input.scenarioId);
    const payload = {
        schemaVersion: SCHEMA_VERSION, scenarioId: input.scenarioId, caseId: input.caseId,
        selectedBranch: input.proposalKind,
        responseCode: bankResponseCode(input), mechanicalGate: bankMechanicalGate(input),
        candidateBranches: definition.branches.slice(),
        listenerKnowledgeUsed: input.listenerBankBelief,
        playerKnowledgeUsed: input.playerBankReference,
        bankBalanceSheetAvailable: true, companyLoanLedgerAvailable: true,
        stateBudgetAvailable: true, integrityCaseLedgerAvailable: true,
        householdDepositAccountsAvailable: false, systemicRiskModelActive: false,
        bankResolutionExecutorActive: false, bankGovernanceModelActive: false,
        depositTransferExecutorActive: false, mediaOwnershipNetworkActive: false,
        rawWorldRead: false, integrationStatus: 'FIXTURE_ONLY',
        executable: false, worldMutation: false, source: SOURCE
    };
    return Object.assign({ ok: true, code: 'SCENARIO_EVALUATED', decisionHash: hash(payload) }, payload);
}

function bankResultValidate(result) {
    const shared = grainResultValidate(result);
    const issues = shared.issues.slice();
    if (result && result.ok && (result.bankBalanceSheetAvailable !== true
        || result.companyLoanLedgerAvailable !== true
        || result.stateBudgetAvailable !== true
        || result.integrityCaseLedgerAvailable !== true
        || result.householdDepositAccountsAvailable !== false
        || result.systemicRiskModelActive !== false
        || result.bankResolutionExecutorActive !== false
        || result.bankGovernanceModelActive !== false
        || result.depositTransferExecutorActive !== false
        || result.mediaOwnershipNetworkActive !== false)) issues.push('BANK_INTEGRATION_BOUNDARY');
    return { ok: issues.length === 0, issues };
}

function prisonerInputValidate(input) {
    const issues = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, issues: ['INPUT_OBJECT'] };
    const allowed = new Set(['scenarioId', 'caseId', 'playerText', ...Object.keys(PRISONER_ENUMS)]);
    Object.keys(input).forEach(key => { if (!allowed.has(key)) issues.push(`UNKNOWN_FIELD:${key}`); });
    if (input.scenarioId !== 'prisoner-exchange') issues.push('SCENARIO_ID');
    if (!input.caseId || !/^[a-z0-9-]{1,64}$/.test(input.caseId)) issues.push('CASE_ID');
    if (!input.playerText || String(input.playerText).length > 1200) issues.push('PLAYER_TEXT');
    for (const [key, values] of Object.entries(PRISONER_ENUMS)) {
        if (!values.includes(input[key])) issues.push(`ENUM:${key}`);
    }
    return { ok: issues.length === 0, issues };
}

function prisonerResponseCode(input) {
    if (input.playerDetentionReference === 'UNKNOWN') return 'ASK_DETENTION_REFERENCE';
    if (input.listenerDetentionBelief === 'NONE') return 'ASK_DETAINEE_LIST_EVIDENCE';
    if (input.playerAuthority !== 'AUTHORIZED') return 'REFER_AUTHORIZED_EXCHANGE_OFFICE';
    if (input.proposalKind === 'STAGED_VERIFICATION') {
        if (input.identityVerification !== 'VERIFIED') return 'DEMAND_VERIFIED_NAME_LISTS';
        if (input.healthVerification !== 'VERIFIED') return 'DEMAND_NEUTRAL_MEDICAL_EXAM';
        if (input.neutralObserver !== 'AVAILABLE') return 'REQUEST_ACCEPTABLE_NEUTRAL_OBSERVER';
        if (input.priorCompliance === 'BREACHED') return 'DEMAND_SIMULTANEOUS_HANDOVER_SAFEGUARDS';
        return 'ACCEPT_WOUNDED_FIRST_VERIFIED_EXCHANGE';
    }
    if (input.proposalKind === 'INTELLIGENCE_BARGAIN') {
        if (input.counterpartyAccess === 'NONE') return 'REJECT_INACCESSIBLE_INFORMATION_OFFER';
        if (input.counterpartyAccess === 'CLAIMED') return 'DEMAND_PROOF_OF_INFORMATION_ACCESS';
        if (input.secretExposure === 'HIGH' && input.listenerPosture === 'SECURITY') {
            return 'REFUSE_HIGH_VALUE_OFFICER_RELEASE';
        }
        if (input.listenerPosture === 'HUMANITARIAN') return 'SEPARATE_LIVES_FROM_INTELLIGENCE_BARGAIN';
        return 'CONSIDER_CONDITIONAL_INFORMATION_BARGAIN';
    }
    if (input.apologyStatus === 'OFFERED') return 'RESUME_VERIFIED_EXCHANGE_AFTER_APOLOGY';
    if (input.listenerPosture === 'HUMANITARIAN') return 'PROPOSE_SILENT_EXCHANGE_WITHOUT_CAMERAS';
    if (input.listenerPosture === 'OPPORTUNIST') return 'EXPLOIT_PROPAGANDA_STALEMATE';
    if (input.publicPressure === 'HIGH') return 'WARN_FAMILY_PRESSURE_COST';
    return 'DEMAND_FORMAL_APOLOGY_BEFORE_EXCHANGE';
}

function prisonerMechanicalGate(input) {
    if (input.playerDetentionReference !== 'KNOWN') return 'DETENTION_REFERENCE_REQUIRED';
    if (input.listenerDetentionBelief === 'NONE') return 'LISTENER_DETENTION_EVIDENCE_REQUIRED';
    if (input.playerAuthority !== 'AUTHORIZED') return 'EXCHANGE_AUTHORITY_REQUIRED';
    if (input.detaineeTruth === 'MISSING') return 'DETAINEE_CASE_NOT_ACTIONABLE';
    if (input.detaineeTruth === 'MISMATCH') return 'DETAINEE_ROSTER_MISMATCH';
    if (input.identityVerification !== 'VERIFIED') return 'IDENTITY_VERIFICATION_REQUIRED';
    if (input.healthVerification !== 'VERIFIED') return 'HEALTH_VERIFICATION_REQUIRED';
    if (input.exchangeSiteSecurity !== 'SECURE') return 'EXCHANGE_SITE_SECURITY_REQUIRED';
    if (input.priorCompliance === 'BREACHED') return 'PRIOR_BREACH_SAFEGUARDS_REQUIRED';
    if (input.proposalKind === 'INTELLIGENCE_BARGAIN') {
        if (input.secretExposure === 'HIGH') return 'CLASSIFIED_RELEASE_FORBIDDEN';
        if (input.counterpartyAccess !== 'VERIFIED') return 'INTELLIGENCE_CLAIM_UNVERIFIED';
        return 'SEARCH_RESCUE_MISSION_ADAPTER_MISSING';
    }
    if (input.proposalKind === 'PROPAGANDA_REFUSAL') return 'DIPLOMATIC_APOLOGY_ADAPTER_MISSING';
    return 'PRISONER_EXCHANGE_EXECUTOR_MISSING';
}

function evaluatePrisonerExchangeScenario(input) {
    const validation = prisonerInputValidate(input);
    if (!validation.ok) return {
        schemaVersion: SCHEMA_VERSION, ok: false, code: 'INVALID_SCENARIO_INPUT',
        issues: validation.issues, executable: false, worldMutation: false, source: SOURCE
    };
    const definition = REFERENCE_SCENARIOS.find(row => row.id === input.scenarioId);
    const payload = {
        schemaVersion: SCHEMA_VERSION, scenarioId: input.scenarioId, caseId: input.caseId,
        selectedBranch: input.proposalKind,
        responseCode: prisonerResponseCode(input), mechanicalGate: prisonerMechanicalGate(input),
        candidateBranches: definition.branches.slice(),
        listenerKnowledgeUsed: input.listenerDetentionBelief,
        playerKnowledgeUsed: input.playerDetentionReference,
        namedMilitaryCharactersAvailable: true, actorBeliefLedgerAvailable: true,
        publicOpinionAvailable: true, diplomacyStateAvailable: true,
        prisonerLedgerActive: false, custodyHealthRecordsActive: false,
        detaineeSecretModelActive: false, neutralObserverSystemActive: false,
        exchangeExecutorActive: false, searchRescueMissionActive: false,
        propagandaIncidentLedgerActive: false, rawWorldRead: false,
        integrationStatus: 'FIXTURE_ONLY', executable: false, worldMutation: false, source: SOURCE
    };
    return Object.assign({ ok: true, code: 'SCENARIO_EVALUATED', decisionHash: hash(payload) }, payload);
}

function prisonerResultValidate(result) {
    const shared = grainResultValidate(result);
    const issues = shared.issues.slice();
    if (result && result.ok && (result.namedMilitaryCharactersAvailable !== true
        || result.actorBeliefLedgerAvailable !== true || result.publicOpinionAvailable !== true
        || result.diplomacyStateAvailable !== true || result.prisonerLedgerActive !== false
        || result.custodyHealthRecordsActive !== false || result.detaineeSecretModelActive !== false
        || result.neutralObserverSystemActive !== false || result.exchangeExecutorActive !== false
        || result.searchRescueMissionActive !== false
        || result.propagandaIncidentLedgerActive !== false)) issues.push('PRISONER_INTEGRATION_BOUNDARY');
    return { ok: issues.length === 0, issues };
}

function pipelineInputValidate(input) {
    const issues = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, issues: ['INPUT_OBJECT'] };
    const allowed = new Set(['scenarioId', 'caseId', 'playerText', ...Object.keys(PIPELINE_ENUMS)]);
    Object.keys(input).forEach(key => { if (!allowed.has(key)) issues.push(`UNKNOWN_FIELD:${key}`); });
    if (input.scenarioId !== 'pipeline-sabotage-inquiry') issues.push('SCENARIO_ID');
    if (!input.caseId || !/^[a-z0-9-]{1,64}$/.test(input.caseId)) issues.push('CASE_ID');
    if (!input.playerText || String(input.playerText).length > 1200) issues.push('PLAYER_TEXT');
    for (const [key, values] of Object.entries(PIPELINE_ENUMS)) {
        if (!values.includes(input[key])) issues.push(`ENUM:${key}`);
    }
    return { ok: issues.length === 0, issues };
}

function pipelineResponseCode(input) {
    if (input.playerIncidentReference === 'UNKNOWN') return 'ASK_INCIDENT_REFERENCE';
    if (input.listenerIncidentBelief === 'NONE') return 'ASK_PIPELINE_INCIDENT_EVIDENCE';
    if (input.playerAuthority !== 'AUTHORIZED') return 'REFER_AUTHORIZED_CRISIS_OFFICE';
    if (input.proposalKind === 'LIMITED_DATA_SHARING') {
        if (input.causeEvidence === 'NONE') return 'REQUEST_PRESERVED_TECHNICAL_EVIDENCE';
        if (input.rawLogsSensitivity === 'HIGH') return 'OFFER_REDACTED_SENSOR_WINDOW';
        if (input.sensorWindowAvailable === 'UNAVAILABLE') return 'ASK_ALTERNATIVE_TELEMETRY';
        if (input.neutralExperts === 'UNAVAILABLE') return 'NEGOTIATE_NEUTRAL_EXPERT_LIST';
        if (input.simultaneousReleaseTrust === 'BREACHED') return 'DEMAND_SIMULTANEOUS_ESCROWED_RELEASE';
        return 'ACCEPT_LIMITED_JOINT_TECHNICAL_INQUIRY';
    }
    if (input.proposalKind === 'PUBLIC_ACCUSATION') {
        if (input.detectionStatus !== 'DETECTED' || input.attributionStatus !== 'ATTRIBUTED') {
            return 'WARN_AGAINST_UNVERIFIED_ACCUSATION';
        }
        if (input.listenerPosture === 'DEFENSIVE') return 'COUNTERACCUSE_AND_THREATEN_FLOW_CUTOFF';
        if (input.listenerPosture === 'OPPORTUNIST') return 'EXPLOIT_PUBLIC_BLAME';
        return 'DEMAND_EVIDENCE_BEFORE_PUBLIC_STATEMENT';
    }
    if (input.smugglingCaseReference === 'NONE') return 'REJECT_UNDEFINED_COVER_UP';
    if (input.smugglingCaseReference === 'UNKNOWN') return 'ASK_WHICH_CASE_IS_BEING_SUPPRESSED';
    if (input.listenerPosture === 'INSTITUTIONALIST') return 'REJECT_COVER_UP_AND_PRESERVE_RECORD';
    if (input.listenerPosture === 'DEFENSIVE') return 'SEEK_MUTUAL_NONDISCLOSURE';
    return 'ACCEPT_OR_RECORD_BLACKMAIL_CANDIDATE';
}

function pipelineMechanicalGate(input) {
    if (input.playerIncidentReference !== 'KNOWN') return 'PIPELINE_INCIDENT_REFERENCE_REQUIRED';
    if (input.listenerIncidentBelief === 'NONE') return 'LISTENER_INCIDENT_EVIDENCE_REQUIRED';
    if (input.playerAuthority !== 'AUTHORIZED') return 'CRISIS_AUTHORITY_REQUIRED';
    if (input.incidentTruth === 'MISSING') return 'PIPELINE_INCIDENT_NOT_ACTIONABLE';
    if (input.incidentTruth === 'ACCIDENT') return 'SABOTAGE_CAUSE_NOT_CONFIRMED';
    if (input.incidentTruth === 'THIRD_PARTY') return 'THIRD_PARTY_CAUSE_REVIEW_REQUIRED';
    if (input.causeEvidence !== 'VERIFIED') return 'CAUSE_EVIDENCE_VERIFICATION_REQUIRED';
    if (input.proposalKind === 'LIMITED_DATA_SHARING') {
        if (input.neutralExperts !== 'AVAILABLE') return 'NEUTRAL_EXPERT_SYSTEM_MISSING';
        if (input.borderProtocol !== 'ACTIVE') return 'BORDER_SECURITY_PROTOCOL_MISSING';
        if (input.simultaneousReleaseTrust === 'BREACHED') return 'JOINT_REPORT_RELEASE_SAFEGUARD_REQUIRED';
        return 'JOINT_PIPELINE_INQUIRY_ADAPTER_MISSING';
    }
    if (input.proposalKind === 'PUBLIC_ACCUSATION') {
        if (input.detectionStatus !== 'DETECTED' || input.attributionStatus !== 'ATTRIBUTED') {
            return 'ATTRIBUTION_NOT_CONFIRMED';
        }
        return 'MEDIA_ACCUSATION_ADAPTER_MISSING';
    }
    return 'CORRUPTION_ACTION_FORBIDDEN';
}

function evaluatePipelineSabotageScenario(input) {
    const validation = pipelineInputValidate(input);
    if (!validation.ok) return {
        schemaVersion: SCHEMA_VERSION, ok: false, code: 'INVALID_SCENARIO_INPUT',
        issues: validation.issues, executable: false, worldMutation: false, source: SOURCE
    };
    const definition = REFERENCE_SCENARIOS.find(row => row.id === input.scenarioId);
    const payload = {
        schemaVersion: SCHEMA_VERSION, scenarioId: input.scenarioId, caseId: input.caseId,
        selectedBranch: input.proposalKind,
        responseCode: pipelineResponseCode(input), mechanicalGate: pipelineMechanicalGate(input),
        candidateBranches: definition.branches.slice(),
        listenerKnowledgeUsed: input.listenerIncidentBelief,
        playerKnowledgeUsed: input.playerIncidentReference,
        infrastructureCorridorAvailable: true, sabotageReceiptAvailable: true,
        detectionAttributionAvailable: true, actorBeliefLedgerAvailable: true,
        integrityEvidenceLedgerAvailable: true, jointTechnicalInquiryActive: false,
        pipelineCauseLedgerActive: false, sensorPatrolRecordSystemActive: false,
        neutralExpertSystemActive: false, jointReportReleaseExecutorActive: false,
        mediaAccusationAdapterActive: false, borderSecurityProtocolActive: false,
        smugglingCaseRedactionExecutorActive: false, rawWorldRead: false,
        integrationStatus: 'FIXTURE_ONLY', executable: false, worldMutation: false, source: SOURCE
    };
    return Object.assign({ ok: true, code: 'SCENARIO_EVALUATED', decisionHash: hash(payload) }, payload);
}

function pipelineResultValidate(result) {
    const shared = grainResultValidate(result);
    const issues = shared.issues.slice();
    if (result && result.ok && (result.infrastructureCorridorAvailable !== true
        || result.sabotageReceiptAvailable !== true || result.detectionAttributionAvailable !== true
        || result.actorBeliefLedgerAvailable !== true || result.integrityEvidenceLedgerAvailable !== true
        || result.jointTechnicalInquiryActive !== false || result.pipelineCauseLedgerActive !== false
        || result.sensorPatrolRecordSystemActive !== false || result.neutralExpertSystemActive !== false
        || result.jointReportReleaseExecutorActive !== false
        || result.mediaAccusationAdapterActive !== false
        || result.borderSecurityProtocolActive !== false
        || result.smugglingCaseRedactionExecutorActive !== false)) issues.push('PIPELINE_INTEGRATION_BOUNDARY');
    return { ok: issues.length === 0, issues };
}

function coupInputValidate(input) {
    const issues = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, issues: ['INPUT_OBJECT'] };
    const allowed = new Set(['scenarioId', 'caseId', 'playerText', ...Object.keys(COUP_ENUMS)]);
    Object.keys(input).forEach(key => { if (!allowed.has(key)) issues.push(`UNKNOWN_FIELD:${key}`); });
    if (input.scenarioId !== 'coup-rumor-succession') issues.push('SCENARIO_ID');
    if (!input.caseId || !/^[a-z0-9-]{1,64}$/.test(input.caseId)) issues.push('CASE_ID');
    if (!input.playerText || String(input.playerText).length > 1200) issues.push('PLAYER_TEXT');
    for (const [key, values] of Object.entries(COUP_ENUMS)) {
        if (!values.includes(input[key])) issues.push(`ENUM:${key}`);
    }
    return { ok: issues.length === 0, issues };
}

function coupResponseCode(input) {
    if (input.playerRumorReference === 'UNKNOWN') return 'ASK_COUP_RUMOR_REFERENCE';
    if (input.listenerRumorBelief === 'NONE') return 'ASK_COMMAND_FRACTURE_EVIDENCE';
    if (input.leaderCondition === 'UNVERIFIED' || input.leaderCondition === 'MISSING') {
        return 'DEMAND_VERIFIED_LEADER_CONDITION';
    }
    if (input.proposalKind === 'CONSTITUTIONAL_TRANSITION') {
        if (input.playerAppointmentAuthority !== 'AUTHORIZED') return 'REFER_CONSTITUTIONAL_SUCCESSION_AUTHORITY';
        if (input.constitutionalPath === 'BLOCKED') return 'SEEK_INSTITUTIONAL_REMEDY';
        if (input.constitutionalPath === 'UNKNOWN') return 'REQUEST_SUCCESSION_ORDER';
        if (input.emergencySignatureChain !== 'READY') return 'DEMAND_NAMED_EMERGENCY_SIGNER';
        if (input.loyaltyEvidence !== 'VERIFIED') return 'REQUEST_VERIFIED_COMMAND_LOYALTY_MAP';
        if (input.promiseIntegrity === 'BREACHED') return 'DEMAND_ENFORCEABLE_TRANSITION_SAFEGUARDS';
        return 'SUPPORT_CONSTITUTIONAL_TRANSITION_AND_BARRACKS_ORDER';
    }
    if (input.proposalKind === 'PERSONAL_OFFICE_BARGAIN') {
        if (input.playerAppointmentAuthority !== 'AUTHORIZED') return 'REJECT_FALSE_APPOINTMENT_PROMISE';
        if (input.listenerPosture === 'PRINCIPLED') return 'REPORT_COUP_INDUCEMENT';
        if (input.listenerPosture === 'AMBITIOUS') return 'ACCEPT_SECRET_APPOINTMENT_PLEDGE';
        return 'SHOP_PROMISE_TO_RIVAL_FACTIONS';
    }
    if (input.proposalKind === 'SPLIT_PLOTTERS') {
        if (input.rivalNetwork === 'NONE') return 'ASK_WHO_THE_PLOTTERS_ARE';
        if (input.rivalNetwork === 'UNKNOWN') return 'DEMAND_NAMED_RIVAL_CHANNELS';
        if (input.disinformationCapability !== 'AVAILABLE') return 'REFUSE_UNSUPPORTED_DECEPTION';
        if (input.listenerPosture === 'PRINCIPLED') return 'WARN_DECEPTION_MAY_TRIGGER_EARLY_ATTEMPT';
        if (input.listenerPosture === 'AMBITIOUS') return 'USE_RIVAL_CHANNEL_TO_SPLIT_COALITION';
        return 'SELL_LEAK_TO_BOTH_COUP_FACTIONS';
    }
    if (input.listenerRumorBelief === 'VERIFIED') return 'WARN_DELAY_COST_IF_PLOT_IS_REAL';
    if (input.listenerPosture === 'PRINCIPLED') return 'ACCEPT_EVIDENCE_THRESHOLD_AND_MONITOR';
    if (input.listenerPosture === 'AMBITIOUS') return 'READ_REJECTION_AS_WEAKNESS';
    return 'PRESERVE_DENIABILITY_AND_WAIT';
}

function coupMechanicalGate(input) {
    if (input.playerRumorReference !== 'KNOWN') return 'COUP_RUMOR_REFERENCE_REQUIRED';
    if (input.listenerRumorBelief === 'NONE') return 'LISTENER_COUP_EVIDENCE_REQUIRED';
    if (input.crisisTruth !== 'ACTIVE') return 'POLITICAL_CRISIS_NOT_ACTIONABLE';
    if (input.leaderCondition === 'HEALTHY') return 'LEADER_INCAPACITY_NOT_CONFIRMED';
    if (input.leaderCondition !== 'CONFIRMED_INCAPACITATED') return 'LEADER_CONDITION_VERIFICATION_REQUIRED';
    if (input.proposalKind === 'CONSTITUTIONAL_TRANSITION') {
        if (input.playerAppointmentAuthority !== 'AUTHORIZED') return 'TRANSITION_AUTHORITY_REQUIRED';
        if (input.constitutionalPath !== 'AVAILABLE') return 'CONSTITUTIONAL_SUCCESSION_PATH_REQUIRED';
        if (input.emergencySignatureChain !== 'READY') return 'EMERGENCY_SIGNATURE_CHAIN_REQUIRED';
        if (input.loyaltyEvidence !== 'VERIFIED') return 'LOYALTY_VERIFICATION_REQUIRED';
        if (input.promiseIntegrity === 'BREACHED') return 'PRIOR_PROMISE_SAFEGUARDS_REQUIRED';
        return 'CONSTITUTIONAL_TRANSITION_ADAPTER_MISSING';
    }
    if (input.proposalKind === 'PERSONAL_OFFICE_BARGAIN') return 'CORRUPT_APPOINTMENT_PROMISE_FORBIDDEN';
    if (input.proposalKind === 'SPLIT_PLOTTERS') {
        if (input.rivalNetwork !== 'KNOWN') return 'PLOTTER_IDENTITY_REQUIRED';
        return 'COVERT_DISINFORMATION_ADAPTER_MISSING';
    }
    return 'POLITICAL_CRISIS_ACTION_REVIEW_REQUIRED';
}

function evaluateCoupRumorScenario(input) {
    const validation = coupInputValidate(input);
    if (!validation.ok) return {
        schemaVersion: SCHEMA_VERSION, ok: false, code: 'INVALID_SCENARIO_INPUT',
        issues: validation.issues, executable: false, worldMutation: false, source: SOURCE
    };
    const definition = REFERENCE_SCENARIOS.find(row => row.id === input.scenarioId);
    const payload = {
        schemaVersion: SCHEMA_VERSION, scenarioId: input.scenarioId, caseId: input.caseId,
        selectedBranch: input.proposalKind,
        responseCode: coupResponseCode(input), mechanicalGate: coupMechanicalGate(input),
        candidateBranches: definition.branches.slice(),
        listenerKnowledgeUsed: input.listenerRumorBelief,
        playerKnowledgeUsed: input.playerRumorReference,
        politicalCrisisLedgerAvailable: true, namedCommanderLoyaltyAvailable: true,
        institutionAuthorityLedgerAvailable: true, resignationSuccessionExecutorAvailable: true,
        actorBeliefLedgerAvailable: true, leaderHealthRecordActive: false,
        emergencySuccessionAdapterActive: false, appointmentPromiseExecutorActive: false,
        coupDisinformationOperationActive: false, commandNeutralityOrderActive: false,
        rawWorldRead: false, integrationStatus: 'FIXTURE_ONLY',
        executable: false, worldMutation: false, source: SOURCE
    };
    return Object.assign({ ok: true, code: 'SCENARIO_EVALUATED', decisionHash: hash(payload) }, payload);
}

function coupResultValidate(result) {
    const shared = grainResultValidate(result);
    const issues = shared.issues.slice();
    if (result && result.ok && (result.politicalCrisisLedgerAvailable !== true
        || result.namedCommanderLoyaltyAvailable !== true
        || result.institutionAuthorityLedgerAvailable !== true
        || result.resignationSuccessionExecutorAvailable !== true
        || result.actorBeliefLedgerAvailable !== true || result.leaderHealthRecordActive !== false
        || result.emergencySuccessionAdapterActive !== false
        || result.appointmentPromiseExecutorActive !== false
        || result.coupDisinformationOperationActive !== false
        || result.commandNeutralityOrderActive !== false)) issues.push('COUP_INTEGRATION_BOUNDARY');
    return { ok: issues.length === 0, issues };
}

module.exports = {
    SCHEMA_VERSION,
    SOURCE,
    dialogueScenarioCatalog,
    grainInputValidate,
    evaluateGrainScarcityScenario,
    grainResultValidate,
    strikeInputValidate,
    evaluateSteelStrikeScenario,
    strikeResultValidate,
    tenderInputValidate,
    evaluateArmsTenderScenario,
    tenderResultValidate,
    mobilizationInputValidate,
    evaluateBorderMobilizationScenario,
    mobilizationResultValidate,
    sanctionsInputValidate,
    evaluateSanctionsShellCompanyScenario,
    sanctionsResultValidate,
    refugeeInputValidate,
    evaluateRefugeeBorderScenario,
    refugeeResultValidate,
    bankInputValidate,
    evaluateBankBailoutScenario,
    bankResultValidate,
    prisonerInputValidate,
    evaluatePrisonerExchangeScenario,
    prisonerResultValidate,
    pipelineInputValidate,
    evaluatePipelineSabotageScenario,
    pipelineResultValidate,
    coupInputValidate,
    evaluateCoupRumorScenario,
    coupResultValidate
};
