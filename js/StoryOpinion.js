// ============================================================================
//  KAMUOYU VE SIKAYET HAFIZASI — Faz 25
//  --------------------------------------------------------------------------
//  Faz 24'ün anlik ihtiyac sonuclarini zaman icinde biriken, yavas unutulan ve
//  sorumlu gorulen aktore bagli toplumsal hafizaya cevirir. Bu katman fiziksel
//  ekonomi, eski welfare veya fraksiyon degerlerini degistirmez. Faz 26/31/41
//  yalniz bu aciklanabilir defteri okuyarak eylem, oy ve inanc uretecektir.
// ============================================================================

const STORY_OPINION_SCHEMA_VERSION = 1;
const STORY_OPINION_ADAPTER_VERSION = 'story-public-opinion-memory-1';
const STORY_OPINION_STORAGE_FORMAT = 'COMPACT_RECORD_ARRAY_V1';
const STORY_OPINION_PROBLEMS = Object.freeze([
    'food', 'energy', 'income', 'employment', 'security', 'publicServices'
]);
const STORY_OPINION_STATES = Object.freeze(['ACTIVE', 'RECOVERING']);
const STORY_OPINION_POLICY = Object.freeze({
    accumulationMode: 'ASYMMETRIC_TARGET_EMA',
    activationThresholdBps: 800,
    riseRateBps: 1400,
    recurrenceBoostBps: 420,
    maximumRecurrenceBoostBps: 2100,
    decayRateBps: 520,
    minimumRiseBps: 20,
    minimumDecayBps: 18,
    maximumRecordsPerCohort: 12,
    maximumTopIssues: 6
});
const STORY_OPINION_POLICY_HASH = storyProductionHash({
    schemaVersion: STORY_OPINION_SCHEMA_VERSION,
    adapterVersion: STORY_OPINION_ADAPTER_VERSION,
    problems: STORY_OPINION_PROBLEMS,
    policy: STORY_OPINION_POLICY
});

function storyOpinionEnabled() {
    return (typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('society.publicOpinionMemory'))
        && (typeof storyNeedsEnabled !== 'function' || storyNeedsEnabled());
}

function storyOpinionClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyOpinionClampBps(value) {
    return Math.max(0, Math.min(10000, Math.round(Number(value) || 0)));
}

function storyOpinionRound(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 1e6) / 1e6 : 0;
}

function storyOpinionCountryId(value) {
    const raw = String(value == null ? '' : value);
    return raw.startsWith('country:') ? raw : `country:${Number(value)}`;
}

function storyOpinionRecordId(cohortId, problemType, actorId) {
    return `opinion:${String(cohortId)}|${String(problemType)}|${String(actorId)}`;
}

function storyOpinionCompanyActor(countryId, sectorId) {
    const stateId = Number(String(countryId || '').split(':')[1]);
    const id = `company:${stateId}:${sectorId}`;
    const company = STORY.companyEconomy && STORY.companyEconomy.companies
        ? STORY.companyEconomy.companies[id]
        : null;
    return company ? id : null;
}

function storyOpinionAttribution(outcome, problemType) {
    const countryId = storyOpinionCountryId(outcome.countryId);
    let companyId = null;
    let basisCode = 'GOVERNMENT_GENERAL_RESPONSIBILITY';
    let confidenceBps = 5600;
    if (problemType === 'food') {
        companyId = storyOpinionCompanyActor(countryId, 'agriculture');
        basisCode = companyId ? 'FOOD_SUPPLY_PROVIDER' : 'FOOD_POLICY_AUTHORITY';
        confidenceBps = companyId ? 7600 : 6200;
    } else if (problemType === 'energy') {
        companyId = storyOpinionCompanyActor(countryId, 'energy');
        basisCode = companyId ? 'ENERGY_SUPPLY_PROVIDER' : 'ENERGY_POLICY_AUTHORITY';
        confidenceBps = companyId ? 7800 : 6400;
    } else if (problemType === 'income') {
        const sector = {
            AGRICULTURE: 'agriculture', INDUSTRY: 'civil_industry', DEFENSE: 'defense_industry'
        }[outcome.occupation];
        companyId = sector ? storyOpinionCompanyActor(countryId, sector) : null;
        basisCode = companyId ? 'EMPLOYER_INCOME_SECURITY' : 'INCOME_POLICY_PROXY';
        confidenceBps = companyId ? 6200 : 4300;
    } else if (problemType === 'employment') {
        basisCode = 'LABOR_POLICY_AUTHORITY';
        confidenceBps = 5200;
    } else if (problemType === 'security') {
        basisCode = 'SECURITY_AUTHORITY';
        confidenceBps = 8500;
    } else if (problemType === 'publicServices') {
        basisCode = 'PUBLIC_SERVICE_AUTHORITY';
        confidenceBps = 8200;
    }
    return {
        blamedActorId: companyId || countryId,
        blamedActorKind: companyId ? 'COMPANY' : 'COUNTRY',
        blameBasisCode: basisCode,
        blameConfidenceBps: confidenceBps
    };
}

function storyOpinionProblemSample(outcome, problemType, sourceNeedsTick, at) {
    const weightKey = problemType === 'employment' ? 'income' : problemType;
    const weights = outcome.weights || {};
    const salienceWeightBps = storyOpinionClampBps(weights[weightKey] || 2000);
    let sourceAccessBps = 10000;
    if (problemType === 'food') sourceAccessBps = outcome.foodAccessBps;
    else if (problemType === 'energy') sourceAccessBps = outcome.energyAccessBps;
    else if (problemType === 'income') sourceAccessBps = outcome.incomeSecurityBps;
    else if (problemType === 'employment') sourceAccessBps = 10000 - outcome.unemploymentRiskBps;
    else if (problemType === 'security') sourceAccessBps = outcome.securityBps;
    else if (problemType === 'publicServices') sourceAccessBps = outcome.publicServicesBps;
    sourceAccessBps = storyOpinionClampBps(sourceAccessBps);
    const deprivationBps = 10000 - sourceAccessBps;
    // Ayni fiziksel erisim, Faz 24'teki kohort onemine gore farkli algilanir.
    // 0,75–1,25 bandi fiziksel gercegi korur; kimlik agirligi yoktan sikayet
    // yaratamaz ve tam erisim daima sifir baski verir.
    const salienceMultiplierBps = 7500 + Math.min(5000, salienceWeightBps);
    const pressureBps = storyOpinionClampBps(
        deprivationBps * salienceMultiplierBps / 10000
    );
    return Object.assign({
        cohortId: outcome.cohortId,
        regionId: outcome.regionId,
        countryId: outcome.countryId,
        membersPeople: Math.max(0, Math.round(Number(outcome.membersPeople) || 0)),
        problemType,
        sourceAccessBps,
        salienceWeightBps,
        pressureBps,
        sourceNeedsTick: Math.max(0, Math.floor(Number(sourceNeedsTick) || 0)),
        at: storyOpinionRound(at)
    }, storyOpinionAttribution(outcome, problemType));
}

// Saf gecis fonksiyonu: hedefli test, ayni kotu olay + kismi iyilesme + tekrar
// dizisini dunya yan etkisi olmadan kanitlayabilir.
function storyOpinionAdvanceRecord(previous, sample) {
    const pressureBps = storyOpinionClampBps(sample && sample.pressureBps);
    const active = pressureBps >= STORY_OPINION_POLICY.activationThresholdBps;
    const at = storyOpinionRound(sample && sample.at);
    if (!previous && !active) return null;
    const record = previous ? storyOpinionClone(previous) : {
        id: storyOpinionRecordId(sample.cohortId, sample.problemType, sample.blamedActorId),
        cohortId: String(sample.cohortId),
        regionId: String(sample.regionId),
        countryId: String(sample.countryId),
        membersPeople: Math.max(0, Math.round(Number(sample.membersPeople) || 0)),
        problemType: String(sample.problemType),
        blamedActorId: String(sample.blamedActorId),
        blamedActorKind: String(sample.blamedActorKind),
        blameBasisCode: String(sample.blameBasisCode),
        blameConfidenceBps: storyOpinionClampBps(sample.blameConfidenceBps),
        firstObservedAt: at,
        lastObservedAt: null,
        lastUpdatedAt: at,
        recoveryStartedAt: null,
        episodeCount: 0,
        exposureTicks: 0,
        recoveryTicks: 0,
        currentPressureBps: 0,
        rememberedSeverityBps: 0,
        peakSeverityBps: 0,
        sourceAccessBps: storyOpinionClampBps(sample.sourceAccessBps),
        salienceWeightBps: storyOpinionClampBps(sample.salienceWeightBps),
        sourceNeedsTick: Math.max(0, Math.floor(Number(sample.sourceNeedsTick) || 0)),
        state: 'RECOVERING',
        trend: 'STABLE'
    };
    const before = storyOpinionClampBps(record.rememberedSeverityBps);
    record.regionId = String(sample.regionId);
    record.countryId = String(sample.countryId);
    record.membersPeople = Math.max(0, Math.round(Number(sample.membersPeople) || 0));
    record.currentPressureBps = pressureBps;
    record.sourceAccessBps = storyOpinionClampBps(sample.sourceAccessBps);
    record.salienceWeightBps = storyOpinionClampBps(sample.salienceWeightBps);
    record.sourceNeedsTick = Math.max(0, Math.floor(Number(sample.sourceNeedsTick) || 0));
    record.lastUpdatedAt = at;
    if (active) {
        const episodeStarted = record.state !== 'ACTIVE';
        if (episodeStarted) record.episodeCount = Math.max(0, Number(record.episodeCount) || 0) + 1;
        const recurrenceBoost = Math.min(
            STORY_OPINION_POLICY.maximumRecurrenceBoostBps,
            Math.max(0, record.episodeCount - 1) * STORY_OPINION_POLICY.recurrenceBoostBps
        );
        const target = storyOpinionClampBps(pressureBps + recurrenceBoost);
        if (target > before) {
            const rise = Math.max(
                STORY_OPINION_POLICY.minimumRiseBps,
                Math.round((target - before) * STORY_OPINION_POLICY.riseRateBps / 10000)
            );
            record.rememberedSeverityBps = Math.min(target, before + rise);
        } else if (target < before) {
            const activeDecay = Math.max(
                STORY_OPINION_POLICY.minimumDecayBps,
                Math.round((before - target) * STORY_OPINION_POLICY.decayRateBps / 10000)
            );
            record.rememberedSeverityBps = Math.max(target, before - activeDecay);
        } else {
            record.rememberedSeverityBps = before;
        }
        record.peakSeverityBps = Math.max(
            storyOpinionClampBps(record.peakSeverityBps),
            record.rememberedSeverityBps
        );
        record.lastObservedAt = at;
        record.recoveryStartedAt = null;
        record.exposureTicks = Math.max(0, Number(record.exposureTicks) || 0) + 1;
        record.recoveryTicks = 0;
        record.state = 'ACTIVE';
    } else {
        const decay = Math.max(
            STORY_OPINION_POLICY.minimumDecayBps,
            Math.round(before * STORY_OPINION_POLICY.decayRateBps / 10000)
        );
        record.rememberedSeverityBps = Math.max(0, before - decay);
        record.recoveryStartedAt = record.recoveryStartedAt == null ? at : record.recoveryStartedAt;
        record.recoveryTicks = Math.max(0, Number(record.recoveryTicks) || 0) + 1;
        record.state = 'RECOVERING';
    }
    record.trend = record.rememberedSeverityBps > before
        ? 'RISING'
        : (record.rememberedSeverityBps < before ? 'FADING' : 'STABLE');
    return record.rememberedSeverityBps > 0 ? record : null;
}

function storyOpinionCohortFromNeeds(outcome, previous, sourceNeedsTick, at) {
    const previousRecords = new Map((previous && previous.records || []).map(row => [row.id, row]));
    const currentIds = new Set();
    const records = [];
    for (const problemType of STORY_OPINION_PROBLEMS) {
        const sample = storyOpinionProblemSample(outcome, problemType, sourceNeedsTick, at);
        const id = storyOpinionRecordId(sample.cohortId, sample.problemType, sample.blamedActorId);
        currentIds.add(id);
        const advanced = storyOpinionAdvanceRecord(previousRecords.get(id) || null, sample);
        if (advanced) records.push(advanced);
    }
    // Siyasi sahiplik veya saglayici degisirse eski suclama bir anda silinmez;
    // yeni aktorden bagimsiz bicimde unutma egrisinde soner.
    for (const [id, oldRecord] of previousRecords) {
        if (currentIds.has(id)) continue;
        const advanced = storyOpinionAdvanceRecord(oldRecord, Object.assign({}, oldRecord, {
            pressureBps: 0,
            sourceAccessBps: 10000,
            sourceNeedsTick,
            at
        }));
        if (advanced) records.push(advanced);
    }
    records.sort((a, b) => b.rememberedSeverityBps - a.rememberedSeverityBps
        || b.peakSeverityBps - a.peakSeverityBps
        || a.id.localeCompare(b.id, 'en'));
    if (records.length > STORY_OPINION_POLICY.maximumRecordsPerCohort) {
        records.splice(STORY_OPINION_POLICY.maximumRecordsPerCohort);
    }
    return {
        cohortId: outcome.cohortId,
        regionId: outcome.regionId,
        countryId: outcome.countryId,
        membersPeople: Math.max(0, Math.round(Number(outcome.membersPeople) || 0)),
        rememberedSeverityBps: records.length ? records[0].rememberedSeverityBps : 0,
        dominantProblemType: records.length ? records[0].problemType : null,
        dominantBlamedActorId: records.length ? records[0].blamedActorId : null,
        records
    };
}

function storyOpinionAggregateIssues(cohorts) {
    const groups = new Map();
    for (const cohort of cohorts || []) {
        for (const record of cohort.records || []) {
            if (record.rememberedSeverityBps <= 0) continue;
            const key = `${record.problemType}|${record.blamedActorId}`;
            if (!groups.has(key)) groups.set(key, {
                problemType: record.problemType,
                blamedActorId: record.blamedActorId,
                blamedActorKind: record.blamedActorKind,
                blameBasisCode: record.blameBasisCode,
                affectedPeople: 0,
                weightedSeverity: 0,
                peakSeverityBps: 0,
                episodeCount: 0,
                activeCohortCount: 0,
                recoveringCohortCount: 0
            });
            const group = groups.get(key);
            const people = Math.max(0, Number(cohort.membersPeople) || 0);
            group.affectedPeople += people;
            group.weightedSeverity += record.rememberedSeverityBps * people;
            group.peakSeverityBps = Math.max(group.peakSeverityBps, record.peakSeverityBps);
            group.episodeCount += Math.max(0, Number(record.episodeCount) || 0);
            if (record.state === 'ACTIVE') group.activeCohortCount++;
            else group.recoveringCohortCount++;
        }
    }
    return [...groups.values()].map(group => ({
        problemType: group.problemType,
        blamedActorId: group.blamedActorId,
        blamedActorKind: group.blamedActorKind,
        blameBasisCode: group.blameBasisCode,
        affectedPeople: Math.round(group.affectedPeople),
        severityBps: group.affectedPeople > 0
            ? storyOpinionClampBps(group.weightedSeverity / group.affectedPeople)
            : 0,
        peakSeverityBps: storyOpinionClampBps(group.peakSeverityBps),
        episodeCount: Math.max(0, Math.round(group.episodeCount)),
        activeCohortCount: group.activeCohortCount,
        recoveringCohortCount: group.recoveringCohortCount
    })).sort((a, b) => (b.severityBps * b.affectedPeople) - (a.severityBps * a.affectedPeople)
        || b.severityBps - a.severityBps
        || a.problemType.localeCompare(b.problemType, 'en')
        || a.blamedActorId.localeCompare(b.blamedActorId, 'en'))
        .slice(0, STORY_OPINION_POLICY.maximumTopIssues);
}

function storyOpinionAggregateScope(idField, idValue, cohorts) {
    const rows = (cohorts || []).filter(row => row[idField] === idValue);
    const populationPeople = rows.reduce((sum, row) => sum + row.membersPeople, 0);
    const weightedSeverity = rows.reduce((sum, row) => (
        sum + row.rememberedSeverityBps * row.membersPeople
    ), 0);
    return {
        [idField]: idValue,
        populationPeople,
        cohortCount: rows.length,
        affectedCohortCount: rows.filter(row => row.rememberedSeverityBps > 0).length,
        rememberedSeverityBps: populationPeople > 0
            ? storyOpinionClampBps(weightedSeverity / populationPeople)
            : 0,
        topIssues: storyOpinionAggregateIssues(rows)
    };
}

function storyOpinionBuildAggregates(cohortsById) {
    const cohorts = Object.values(cohortsById || {});
    const regions = {};
    const countries = {};
    const population = typeof storyPopulationEnsure === 'function' ? storyPopulationEnsure() : null;
    for (const regionId of Object.keys(population && population.regions || {}).sort()) {
        regions[regionId] = storyOpinionAggregateScope('regionId', regionId, cohorts);
        regions[regionId].countryId = population.regions[regionId].countryId;
    }
    for (const state of (STORY.states || [])) {
        const countryId = `country:${state.id}`;
        countries[countryId] = storyOpinionAggregateScope('countryId', countryId, cohorts);
        countries[countryId].regionCount = Object.values(regions)
            .filter(region => region.countryId === countryId).length;
    }
    return { regions, countries };
}

function storyOpinionLedgerCreate(options) {
    options = options || {};
    const aggregates = storyOpinionBuildAggregates({});
    return {
        schemaVersion: STORY_OPINION_SCHEMA_VERSION,
        adapterVersion: STORY_OPINION_ADAPTER_VERSION,
        policyHash: STORY_OPINION_POLICY_HASH,
        needsPolicyHash: typeof STORY_NEEDS_POLICY_HASH === 'string' ? STORY_NEEDS_POLICY_HASH : null,
        populationPolicyHash: typeof STORY_POPULATION_POLICY_HASH === 'string' ? STORY_POPULATION_POLICY_HASH : null,
        populationRevision: STORY.population ? Math.max(0, Number(STORY.population.revision) || 0) : 0,
        topologyHash: STORY.regionModel ? STORY.regionModel.topologyHash : null,
        tickSequence: 0,
        lastTickAt: Number(STORY.clock) || 0,
        sourceNeedsTick: STORY.needsWelfare ? STORY.needsWelfare.tickSequence : 0,
        cohorts: {},
        regions: aggregates.regions,
        countries: aggregates.countries,
        diagnostics: {
            backfilled: !!options.backfilled,
            restoredFromInvalidLedger: !!options.restoredFromInvalidLedger,
            issues: (options.issues || []).slice(0, 50),
            warnings: (options.warnings || []).map(String).slice(0, 30),
            linkReconciliations: 0,
            mutatesNeeds: false,
            mutatesLegacyWelfare: false,
            mutatesFactions: false,
            attributionModel: 'DIRECT_PROVIDER_OR_PUBLIC_AUTHORITY_V1'
        }
    };
}

function storyOpinionActorExists(actorId) {
    const raw = String(actorId || '');
    const country = /^country:(-?\d+)$/.exec(raw);
    if (country) return !!(STORY.states || []).find(state => state.id === Number(country[1]));
    if (/^company:-?\d+:[a-z_]+$/.test(raw)) {
        return !!(STORY.companyEconomy && STORY.companyEconomy.companies
            && STORY.companyEconomy.companies[raw]);
    }
    return false;
}

function storyOpinionValidate(ledger) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) return {
        ok: false,
        issues: [{ code: 'OPINION_LEDGER_REQUIRED', path: '$', message: 'Kamuoyu defteri zorunlu.' }]
    };
    if (ledger.schemaVersion !== STORY_OPINION_SCHEMA_VERSION) add('OPINION_SCHEMA_VERSION', '$.schemaVersion', 'Kamuoyu şeması uyuşmuyor.');
    if (ledger.adapterVersion !== STORY_OPINION_ADAPTER_VERSION) add('OPINION_ADAPTER_VERSION', '$.adapterVersion', 'Kamuoyu adaptörü uyuşmuyor.');
    if (ledger.policyHash !== STORY_OPINION_POLICY_HASH) add('OPINION_POLICY_HASH', '$.policyHash', 'Kamuoyu politikası uyuşmuyor.');
    if (ledger.needsPolicyHash !== STORY_NEEDS_POLICY_HASH) add('OPINION_NEEDS_LINK', '$.needsPolicyHash', 'Kamuoyu yanlış ihtiyaç politikasına bağlı.');
    if (ledger.populationPolicyHash !== STORY_POPULATION_POLICY_HASH) add('OPINION_POPULATION_LINK', '$.populationPolicyHash', 'Kamuoyu yanlış nüfus politikasına bağlı.');
    if (ledger.populationRevision !== (STORY.population ? Math.max(0, Number(STORY.population.revision) || 0) : 0)) add('OPINION_POPULATION_REVISION', '$.populationRevision', 'Kamuoyu kohort bağları güncel nüfus revizyonuyla uyuşmuyor.');
    if (ledger.topologyHash !== (STORY.regionModel ? STORY.regionModel.topologyHash : null)) add('OPINION_TOPOLOGY_HASH', '$.topologyHash', 'Kamuoyu yanlış topolojiye bağlı.');
    const population = typeof storyPopulationEnsure === 'function' ? storyPopulationEnsure() : null;
    const expectedCohorts = new Map();
    for (const region of Object.values(population && population.regions || {})) {
        for (const cohort of region.cohorts || []) expectedCohorts.set(cohort.id, cohort);
    }
    const cohorts = ledger.cohorts || {};
    for (const cohortId of Object.keys(cohorts).sort()) {
        const row = cohorts[cohortId];
        const expected = expectedCohorts.get(cohortId);
        if (!expected) {
            add('OPINION_UNKNOWN_COHORT', `$.cohorts.${cohortId}`, 'Bilinmeyen kohort hafızası.');
            continue;
        }
        if (row.cohortId !== expected.id || row.regionId !== expected.regionId
            || row.countryId !== expected.countryId || row.membersPeople !== expected.membersPeople) {
            add('OPINION_COHORT_LINK', `$.cohorts.${cohortId}`, 'Kamuoyu kohortu güncel nüfusla uyuşmuyor.');
        }
        if (!Number.isInteger(row.rememberedSeverityBps) || row.rememberedSeverityBps < 0 || row.rememberedSeverityBps > 10000) {
            add('OPINION_COHORT_SEVERITY', `$.cohorts.${cohortId}.rememberedSeverityBps`, 'Kohort hafızası 0–10.000 baz puan olmalı.');
        }
        const records = Array.isArray(row.records) ? row.records : [];
        if (records.length > STORY_OPINION_POLICY.maximumRecordsPerCohort) add('OPINION_RECORD_LIMIT', `$.cohorts.${cohortId}.records`, 'Kohort şikâyet kaydı sınırı aşıldı.');
        const ids = new Set();
        for (let index = 0; index < records.length; index++) {
            const record = records[index];
            const path = `$.cohorts.${cohortId}.records[${index}]`;
            if (ids.has(record.id)) add('OPINION_DUPLICATE_RECORD', `${path}.id`, 'Aynı şikâyet kaydı iki kez bulunamaz.');
            ids.add(record.id);
            const expectedId = storyOpinionRecordId(cohortId, record.problemType, record.blamedActorId);
            if (record.id !== expectedId) add('OPINION_RECORD_ID', `${path}.id`, 'Şikâyet kimliği kohort, sorun ve aktörden türemeli.');
            if (!STORY_OPINION_PROBLEMS.includes(record.problemType)) add('OPINION_PROBLEM_TYPE', `${path}.problemType`, 'Bilinmeyen şikâyet türü.');
            if (!STORY_OPINION_STATES.includes(record.state)) add('OPINION_STATE', `${path}.state`, 'Şikâyet durumu geçersiz.');
            if (!storyOpinionActorExists(record.blamedActorId)) add('OPINION_ACTOR_REFERENCE', `${path}.blamedActorId`, 'Sorumlu görülen aktör dünyada yok.');
            for (const field of ['blameConfidenceBps', 'currentPressureBps', 'rememberedSeverityBps', 'peakSeverityBps', 'sourceAccessBps', 'salienceWeightBps']) {
                if (!Number.isInteger(record[field]) || record[field] < 0 || record[field] > 10000) add('OPINION_BPS_RANGE', `${path}.${field}`, 'Kamuoyu baz puanı 0–10.000 tamsayı olmalı.');
            }
            if (!Number.isInteger(record.episodeCount) || record.episodeCount < 1) add('OPINION_EPISODE_COUNT', `${path}.episodeCount`, 'Aktif hafıza en az bir olay bölümü taşımalı.');
            if (record.peakSeverityBps < record.rememberedSeverityBps) add('OPINION_PEAK', `${path}.peakSeverityBps`, 'Tepe şiddeti mevcut hafızadan düşük olamaz.');
            if (record.state === 'ACTIVE' && record.currentPressureBps < STORY_OPINION_POLICY.activationThresholdBps) add('OPINION_ACTIVE_PRESSURE', path, 'Aktif şikâyet eşik altı baskı taşıyamaz.');
            if (record.state === 'RECOVERING' && record.rememberedSeverityBps <= 0) add('OPINION_EMPTY_RECOVERY', path, 'Tam unutulmuş kayıt defterde tutulmamalı.');
        }
        const dominant = records[0] || null;
        if (row.rememberedSeverityBps !== (dominant ? dominant.rememberedSeverityBps : 0)
            || row.dominantProblemType !== (dominant ? dominant.problemType : null)
            || row.dominantBlamedActorId !== (dominant ? dominant.blamedActorId : null)) {
            add('OPINION_DOMINANT_RECORD', `$.cohorts.${cohortId}`, 'Kohort baskın şikâyeti sıralı hafızadan türemeli.');
        }
    }
    const aggregates = storyOpinionBuildAggregates(cohorts);
    if (JSON.stringify(aggregates.regions) !== JSON.stringify(ledger.regions || {})) add('OPINION_REGION_AGGREGATE', '$.regions', 'Bölge kamuoyu kohort hafızasından türemeli.');
    if (JSON.stringify(aggregates.countries) !== JSON.stringify(ledger.countries || {})) add('OPINION_COUNTRY_AGGREGATE', '$.countries', 'Ülke kamuoyu kohort hafızasından türemeli.');
    return { ok: issues.length === 0, issues };
}

function storyOpinionCompactForSave(ledger) {
    const payload = storyOpinionClone(ledger);
    payload.storageFormat = STORY_OPINION_STORAGE_FORMAT;
    for (const cohort of Object.values(payload.cohorts || {})) {
        cohort.records = (cohort.records || []).map(record => [
            record.problemType,
            record.blamedActorId,
            record.blameBasisCode,
            record.blameConfidenceBps,
            record.firstObservedAt,
            record.lastObservedAt,
            record.recoveryStartedAt,
            record.episodeCount,
            record.exposureTicks,
            record.recoveryTicks,
            record.currentPressureBps,
            record.rememberedSeverityBps,
            record.peakSeverityBps,
            record.sourceAccessBps,
            record.salienceWeightBps,
            record.sourceNeedsTick,
            record.state,
            record.trend
        ]);
    }
    return payload;
}

function storyOpinionExpandSaved(saved) {
    const payload = storyOpinionClone(saved);
    if (!payload || payload.storageFormat !== STORY_OPINION_STORAGE_FORMAT) return payload;
    for (const cohort of Object.values(payload.cohorts || {})) {
        cohort.records = (cohort.records || []).map(values => {
            if (!Array.isArray(values) || values.length !== 18) return values;
            const problemType = String(values[0]);
            const blamedActorId = String(values[1]);
            return {
                id: storyOpinionRecordId(cohort.cohortId, problemType, blamedActorId),
                cohortId: cohort.cohortId,
                regionId: cohort.regionId,
                countryId: cohort.countryId,
                membersPeople: cohort.membersPeople,
                problemType,
                blamedActorId,
                blamedActorKind: blamedActorId.startsWith('company:') ? 'COMPANY' : 'COUNTRY',
                blameBasisCode: String(values[2]),
                blameConfidenceBps: values[3],
                firstObservedAt: values[4],
                lastObservedAt: values[5],
                lastUpdatedAt: payload.lastTickAt,
                recoveryStartedAt: values[6],
                episodeCount: values[7],
                exposureTicks: values[8],
                recoveryTicks: values[9],
                currentPressureBps: values[10],
                rememberedSeverityBps: values[11],
                peakSeverityBps: values[12],
                sourceAccessBps: values[13],
                salienceWeightBps: values[14],
                sourceNeedsTick: values[15],
                state: String(values[16]),
                trend: String(values[17])
            };
        });
    }
    delete payload.storageFormat;
    return payload;
}

function storyOpinionReset(options) {
    if (!storyOpinionEnabled()) { STORY.publicOpinion = null; return null; }
    STORY.publicOpinion = storyOpinionLedgerCreate(options);
    return STORY.publicOpinion;
}

function storyOpinionReconcilePopulationLinks(ledger) {
    if (!ledger || !STORY.population || !STORY.population.regions) return ledger;
    const expected = new Map();
    for (const region of Object.values(STORY.population.regions)) {
        for (const cohort of region.cohorts || []) expected.set(cohort.id, cohort);
    }
    for (const cohortId of Object.keys(ledger.cohorts || {})) {
        const row = ledger.cohorts[cohortId];
        const population = expected.get(cohortId);
        if (!population) {
            delete ledger.cohorts[cohortId];
            continue;
        }
        row.regionId = population.regionId;
        row.countryId = population.countryId;
        row.membersPeople = population.membersPeople;
        for (const record of row.records || []) {
            record.regionId = population.regionId;
            record.countryId = population.countryId;
            record.membersPeople = population.membersPeople;
        }
    }
    const aggregates = storyOpinionBuildAggregates(ledger.cohorts || {});
    ledger.regions = aggregates.regions;
    ledger.countries = aggregates.countries;
    ledger.populationRevision = Math.max(0, Number(STORY.population.revision) || 0);
    ledger.topologyHash = STORY.regionModel ? STORY.regionModel.topologyHash : null;
    ledger.diagnostics = ledger.diagnostics || {};
    ledger.diagnostics.linkReconciliations = Math.max(
        0, Number(ledger.diagnostics.linkReconciliations) || 0
    ) + 1;
    return ledger;
}

function storyOpinionRestore(saved) {
    if (!storyOpinionEnabled()) { STORY.publicOpinion = null; return null; }
    if (!saved) return storyOpinionReset({
        backfilled: true,
        warnings: ['Eski kayıtta şikâyet geçmişi yoktu; geçmiş uydurulmadı, hafıza boş başladı.']
    });
    const candidate = storyOpinionExpandSaved(saved);
    const validation = storyOpinionValidate(candidate);
    if (!validation.ok) return storyOpinionReset({
        backfilled: true,
        restoredFromInvalidLedger: true,
        issues: validation.issues,
        warnings: ['Bozuk kamuoyu defteri kullanılmadı; dünya korunarak hafıza boş başlatıldı.']
    });
    STORY.publicOpinion = candidate;
    return STORY.publicOpinion;
}

function storyOpinionEnsure() {
    if (!storyOpinionEnabled()) return null;
    const ledger = STORY.publicOpinion || storyOpinionReset({ backfilled: true });
    const populationRevision = STORY.population ? Math.max(0, Number(STORY.population.revision) || 0) : 0;
    if (ledger && ledger.populationRevision !== populationRevision) {
        storyOpinionReconcilePopulationLinks(ledger);
    }
    return ledger;
}

function storyOpinionTick() {
    if (!storyOpinionEnabled()) return { disabled: true, cohortsProcessed: 0 };
    // Population tiki hemen once calisir. Bu fonksiyon zaten tum kohortlari
    // yeniden kuracagi icin storyOpinionEnsure() ile once bosuna bag/ozet
    // uzlastirmasi yapilmaz; kayit ve salt-okunur gorunumler gerektiğinde bunu
    // ayrica yapar.
    const ledger = STORY.publicOpinion || storyOpinionReset({ backfilled: true });
    const needs = typeof storyNeedsEnsure === 'function' ? storyNeedsEnsure() : null;
    if (!ledger || !needs) return { disabled: true, cohortsProcessed: 0 };
    const at = Number(STORY.clock) || 0;
    const cohorts = {};
    for (const regionId of Object.keys(needs.regions || {}).sort()) {
        const region = needs.regions[regionId];
        for (const outcome of region.cohorts || []) {
            const previous = ledger.cohorts && ledger.cohorts[outcome.cohortId];
            // Faz 24 gorunumu meslek alanini tasimaz; kanonik nufus profiliyle
            // salt-okunur birlestirilir.
            const populationRegion = STORY.population && STORY.population.regions
                ? STORY.population.regions[outcome.regionId]
                : null;
            const population = populationRegion && Array.isArray(populationRegion.cohorts)
                ? populationRegion.cohorts.find(row => row.id === outcome.cohortId) || null
                : null;
            const source = Object.assign({}, outcome, population || {});
            cohorts[outcome.cohortId] = storyOpinionCohortFromNeeds(
                source, previous, needs.tickSequence, at
            );
        }
    }
    const aggregates = storyOpinionBuildAggregates(cohorts);
    STORY.publicOpinion = {
        schemaVersion: STORY_OPINION_SCHEMA_VERSION,
        adapterVersion: STORY_OPINION_ADAPTER_VERSION,
        policyHash: STORY_OPINION_POLICY_HASH,
        needsPolicyHash: STORY_NEEDS_POLICY_HASH,
        populationPolicyHash: STORY_POPULATION_POLICY_HASH,
        populationRevision: STORY.population ? Math.max(0, Number(STORY.population.revision) || 0) : 0,
        topologyHash: STORY.regionModel ? STORY.regionModel.topologyHash : null,
        tickSequence: Math.max(0, Number(ledger.tickSequence) || 0) + 1,
        lastTickAt: at,
        sourceNeedsTick: needs.tickSequence,
        cohorts,
        regions: aggregates.regions,
        countries: aggregates.countries,
        diagnostics: storyOpinionClone(ledger.diagnostics)
    };
    return {
        disabled: false,
        tickSequence: STORY.publicOpinion.tickSequence,
        cohortsProcessed: Object.keys(cohorts).length,
        rememberedRecordCount: Object.values(cohorts).reduce((sum, row) => sum + row.records.length, 0)
    };
}

function storyOpinionForSave() {
    const ledger = storyOpinionEnsure();
    if (!ledger) return null;
    const validation = storyOpinionValidate(ledger);
    ledger.diagnostics.issues = validation.ok ? [] : validation.issues.slice(0, 50);
    if (!validation.ok) throw new Error(`Geçersiz kamuoyu defteri: ${validation.issues[0].code}`);
    return storyOpinionCompactForSave(ledger);
}

function storyOpinionCohortView(cohortId) {
    const ledger = storyOpinionEnsure();
    return ledger && ledger.cohorts[String(cohortId)]
        ? storyOpinionClone(ledger.cohorts[String(cohortId)])
        : null;
}

function storyOpinionRegionView(regionId) {
    const ledger = storyOpinionEnsure();
    const id = String(regionId).startsWith('region:') ? String(regionId) : `region:${Number(regionId)}`;
    return ledger && ledger.regions[id] ? storyOpinionClone(ledger.regions[id]) : null;
}

function storyOpinionCountryView(countryId) {
    const ledger = storyOpinionEnsure();
    const id = storyOpinionCountryId(countryId);
    return ledger && ledger.countries[id] ? storyOpinionClone(ledger.countries[id]) : null;
}

function storyOpinionActorLabel(actorId) {
    const raw = String(actorId || '');
    if (raw.startsWith('company:')) {
        const company = STORY.companyEconomy && STORY.companyEconomy.companies
            ? STORY.companyEconomy.companies[raw]
            : null;
        return company ? company.name : raw;
    }
    const match = /^country:(-?\d+)$/.exec(raw);
    const state = match && typeof storyState === 'function' ? storyState(Number(match[1])) : null;
    return state ? `${state.name} yönetimi` : raw;
}

function storyOpinionSummary(options) {
    const ledger = storyOpinionEnsure();
    if (!ledger) return {
        schemaVersion: STORY_OPINION_SCHEMA_VERSION,
        adapterVersion: STORY_OPINION_ADAPTER_VERSION,
        disabled: true,
        cohortCount: 0,
        rememberedRecordCount: 0
    };
    const cohorts = Object.values(ledger.cohorts || {});
    const records = cohorts.flatMap(row => row.records || []);
    const populationPeople = cohorts.reduce((sum, row) => sum + row.membersPeople, 0);
    return {
        schemaVersion: ledger.schemaVersion,
        adapterVersion: ledger.adapterVersion,
        policyHash: ledger.policyHash,
        disabled: false,
        tickSequence: ledger.tickSequence,
        cohortCount: cohorts.length,
        rememberedRecordCount: cohorts.reduce((sum, row) => sum + row.records.length, 0),
        affectedCohortCount: cohorts.filter(row => row.rememberedSeverityBps > 0).length,
        saturatedCohortCount: cohorts.filter(row => row.rememberedSeverityBps >= 9900).length,
        highSeverityCohortCount: cohorts.filter(row => row.rememberedSeverityBps >= 7500).length,
        activeRecordCount: records.filter(row => row.state === 'ACTIVE').length,
        recoveringRecordCount: records.filter(row => row.state === 'RECOVERING').length,
        averageRememberedSeverityBps: populationPeople > 0
            ? storyOpinionClampBps(cohorts.reduce((sum, row) => (
                sum + row.rememberedSeverityBps * row.membersPeople
            ), 0) / populationPeople)
            : 0,
        serializedCharacters: options && options.includeStorageMetrics
            ? JSON.stringify(storyOpinionCompactForSave(ledger)).length
            : null,
        diagnostics: storyOpinionClone(ledger.diagnostics)
    };
}
