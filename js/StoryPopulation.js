// ============================================================================
//  NÜFUS KOHORTLARI — Faz 23
//  --------------------------------------------------------------------------
//  Her bireyi ayrı simüle etmeden yaş, gelir, meslek, eğitim ve kimlik
//  kesişimlerini tutar. Bölgesel toplamlar canlı node.pop değeriyle tamsayı
//  kişi düzeyinde uzlaştırılır. İş gücü bu defterden gelir; ücret Faz 28'den
//  önce uydurulmaz.
// ============================================================================

const STORY_POPULATION_SCHEMA_VERSION = 1;
const STORY_POPULATION_ADAPTER_VERSION = 'story-population-cohort-ledger-1';
const STORY_POPULATION_LABOR_SCALE = 3.6; // bin çalışan başına günlük labor lotu

const STORY_POPULATION_PROFILES = Object.freeze([
    Object.freeze({ key: 'children', ageBand: 'CHILD', incomeBand: 'DEPENDENT', occupation: 'DEPENDENT', education: 'BASIC', identity: 'LOCAL', base: 150 }),
    Object.freeze({ key: 'students', ageBand: 'YOUNG', incomeBand: 'LOW', occupation: 'STUDENT', education: 'SECONDARY', identity: 'NATIONAL', base: 75 }),
    Object.freeze({ key: 'young_agriculture', ageBand: 'YOUNG', incomeBand: 'LOW', occupation: 'AGRICULTURE', education: 'PRIMARY', identity: 'LOCAL', base: 65 }),
    Object.freeze({ key: 'young_industry', ageBand: 'YOUNG', incomeBand: 'LOWER_MIDDLE', occupation: 'INDUSTRY', education: 'SECONDARY', identity: 'NATIONAL', base: 75 }),
    Object.freeze({ key: 'young_services', ageBand: 'YOUNG', incomeBand: 'MIDDLE', occupation: 'SERVICES', education: 'TERTIARY', identity: 'COSMOPOLITAN', base: 65 }),
    Object.freeze({ key: 'adult_agriculture', ageBand: 'ADULT', incomeBand: 'LOWER_MIDDLE', occupation: 'AGRICULTURE', education: 'PRIMARY', identity: 'LOCAL', base: 90 }),
    Object.freeze({ key: 'adult_industry', ageBand: 'ADULT', incomeBand: 'MIDDLE', occupation: 'INDUSTRY', education: 'SECONDARY', identity: 'NATIONAL', base: 105 }),
    Object.freeze({ key: 'adult_services', ageBand: 'ADULT', incomeBand: 'MIDDLE', occupation: 'SERVICES', education: 'TERTIARY', identity: 'COSMOPOLITAN', base: 105 }),
    Object.freeze({ key: 'adult_public', ageBand: 'ADULT', incomeBand: 'UPPER_MIDDLE', occupation: 'PUBLIC', education: 'TERTIARY', identity: 'NATIONAL', base: 55 }),
    Object.freeze({ key: 'adult_defense', ageBand: 'ADULT', incomeBand: 'MIDDLE', occupation: 'DEFENSE', education: 'SECONDARY', identity: 'NATIONAL', base: 35 }),
    Object.freeze({ key: 'unemployed', ageBand: 'ADULT', incomeBand: 'LOW', occupation: 'UNEMPLOYED', education: 'SECONDARY', identity: 'LOCAL', base: 55 }),
    Object.freeze({ key: 'retired', ageBand: 'SENIOR', incomeBand: 'LOWER_MIDDLE', occupation: 'RETIRED', education: 'PRIMARY', identity: 'LOCAL', base: 125 })
]);

const STORY_POPULATION_ENUMS = Object.freeze({
    ageBand: Object.freeze(['CHILD', 'YOUNG', 'ADULT', 'SENIOR']),
    incomeBand: Object.freeze(['DEPENDENT', 'LOW', 'LOWER_MIDDLE', 'MIDDLE', 'UPPER_MIDDLE']),
    occupation: Object.freeze(['DEPENDENT', 'STUDENT', 'AGRICULTURE', 'INDUSTRY', 'SERVICES', 'PUBLIC', 'DEFENSE', 'UNEMPLOYED', 'RETIRED']),
    education: Object.freeze(['BASIC', 'PRIMARY', 'SECONDARY', 'TERTIARY']),
    identity: Object.freeze(['LOCAL', 'NATIONAL', 'COSMOPOLITAN'])
});

const STORY_POPULATION_POLICY_HASH = storyProductionHash({
    schemaVersion: STORY_POPULATION_SCHEMA_VERSION,
    adapterVersion: STORY_POPULATION_ADAPTER_VERSION,
    laborScale: STORY_POPULATION_LABOR_SCALE,
    profiles: STORY_POPULATION_PROFILES
});

function storyPopulationEnabled() {
    return typeof storyFeatureEnabled !== 'function' || storyFeatureEnabled('population.cohorts');
}

function storyPopulationClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyPopulationPeople(node) {
    const units = typeof storyRegionalPopulation === 'function'
        ? storyRegionalPopulation(node)
        : (Number(node && node.pop) || 10);
    return Math.max(0, Math.round(units * 1000));
}

function storyPopulationHashNumber(text) {
    let value = 0x811c9dc5;
    for (let i = 0; i < String(text).length; i++) {
        value ^= String(text).charCodeAt(i);
        value = Math.imul(value, 0x01000193);
    }
    return value >>> 0;
}

function storyPopulationProfileWeights(node) {
    const urban = Math.max(0, Number(node.level) || 1) + Math.max(0, Number(node.cities) || 0);
    // ALTI BİNA: sanayi/savunma istihdamı artık tek binadan değil, tesis TOPLAMINDAN okunur
    // (iki bina varken sonuç birebir aynıydı; bkz. Production.prodIndustryLevel).
    const industry = typeof prodIndustryLevel === 'function'
        ? Math.max(0, prodIndustryLevel(node)) : Math.max(0, Number(node.fac) || 0);
    const defense = typeof prodDefenseLevel === 'function'
        ? Math.max(0, prodDefenseLevel(node)) : Math.max(0, Number(node.bar) || 0);
    const wealth = Math.max(0, Number(node.wealth) || 0);
    const raw = STORY_POPULATION_PROFILES.map(profile => {
        let weight = profile.base;
        if (profile.occupation === 'AGRICULTURE') weight += Math.max(0, 22 - urban * 3);
        if (profile.occupation === 'INDUSTRY') weight += industry * 14;
        if (profile.occupation === 'SERVICES' || profile.occupation === 'PUBLIC') weight += urban * 5 + wealth * 0.8;
        if (profile.occupation === 'DEFENSE') weight += defense * 10;
        if (profile.occupation === 'UNEMPLOYED') weight += Math.max(0, 12 - wealth * 0.5);
        if (profile.education === 'TERTIARY') weight += Math.max(0, urban - 2) * 3;
        const jitter = (storyPopulationHashNumber(`${node.id}|${profile.key}`) % 1701 - 850) / 10000;
        return Math.max(1, weight * (1 + jitter));
    });
    const total = raw.reduce((sum, value) => sum + value, 0) || 1;
    const exact = raw.map(value => value / total * 10000);
    const shares = exact.map(Math.floor);
    let remainder = 10000 - shares.reduce((sum, value) => sum + value, 0);
    exact.map((value, index) => ({ index, fraction: value - Math.floor(value) }))
        .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
        .slice(0, remainder)
        .forEach(row => { shares[row.index]++; });
    return shares;
}

function storyPopulationAllocate(totalPeople, shares) {
    const exact = shares.map(share => totalPeople * share / 10000);
    const values = exact.map(Math.floor);
    let remainder = totalPeople - values.reduce((sum, value) => sum + value, 0);
    exact.map((value, index) => ({ index, fraction: value - Math.floor(value) }))
        .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
        .slice(0, remainder)
        .forEach(row => { values[row.index]++; });
    return values;
}

function storyPopulationCountryId(owner) {
    return Number.isInteger(Number(owner)) && Number(owner) >= 0 ? `country:${Number(owner)}` : null;
}

function storyPopulationRegionCreate(node, existing) {
    const regionId = `region:${Number(node.id)}`;
    const countryId = storyPopulationCountryId(node.owner);
    const populationPeople = storyPopulationPeople(node);
    const existingByKey = new Map(((existing && existing.cohorts) || []).map(row => [row.profileKey, row]));
    const generatedShares = storyPopulationProfileWeights(node);
    const shares = STORY_POPULATION_PROFILES.map((profile, index) => {
        const previous = existingByKey.get(profile.key);
        return previous && Number.isInteger(previous.shareBps) ? previous.shareBps : generatedShares[index];
    });
    // Eski/bozuk paylar uzlaştırma sırasında dünyaya sızmasın.
    const normalizedShares = shares.length === STORY_POPULATION_PROFILES.length
        && shares.every(value => Number.isInteger(value) && value >= 0)
        && shares.reduce((sum, value) => sum + value, 0) === 10000
        ? shares
        : generatedShares;
    const members = storyPopulationAllocate(populationPeople, normalizedShares);
    const cohorts = STORY_POPULATION_PROFILES.map((profile, index) => ({
        id: `cohort:${Number(node.id)}:${profile.key}`,
        profileKey: profile.key,
        regionId,
        countryId,
        ageBand: profile.ageBand,
        incomeBand: profile.incomeBand,
        occupation: profile.occupation,
        education: profile.education,
        identity: profile.identity,
        shareBps: normalizedShares[index],
        membersPeople: members[index]
    }));
    return { regionId, countryId, populationPeople, cohorts };
}

function storyPopulationAggregateCountries(regions) {
    const countries = {};
    for (const state of (STORY.states || [])) {
        countries[`country:${Number(state.id)}`] = {
            countryId: `country:${Number(state.id)}`,
            populationPeople: 0,
            workingAgePeople: 0,
            availableWorkersPeople: 0,
            regionCount: 0
        };
    }
    for (const region of Object.values(regions || {})) {
        if (!region.countryId) continue;
        const country = countries[region.countryId] || (countries[region.countryId] = {
            countryId: region.countryId, populationPeople: 0, workingAgePeople: 0,
            availableWorkersPeople: 0, regionCount: 0
        });
        country.populationPeople += region.populationPeople;
        country.regionCount++;
        for (const cohort of region.cohorts) {
            if (cohort.ageBand === 'YOUNG' || cohort.ageBand === 'ADULT') country.workingAgePeople += cohort.membersPeople;
            country.availableWorkersPeople += storyPopulationAvailableWorkers(cohort);
        }
    }
    return countries;
}

function storyPopulationAvailableWorkers(cohort) {
    const rates = { AGRICULTURE: 7000, INDUSTRY: 7200, SERVICES: 6800, PUBLIC: 6200, DEFENSE: 4500 };
    return Math.floor((Number(cohort.membersPeople) || 0) * (rates[cohort.occupation] || 0) / 10000);
}

function storyPopulationLedgerCreate(options) {
    options = options || {};
    const regions = {};
    for (const node of (STORY.nodes || [])) {
        const region = storyPopulationRegionCreate(node, null);
        regions[region.regionId] = region;
    }
    return {
        schemaVersion: STORY_POPULATION_SCHEMA_VERSION,
        adapterVersion: STORY_POPULATION_ADAPTER_VERSION,
        policyHash: STORY_POPULATION_POLICY_HASH,
        topologyHash: STORY.regionModel ? STORY.regionModel.topologyHash : null,
        revision: 1,
        lastReconciledAt: Number(STORY.clock) || 0,
        regions,
        countries: storyPopulationAggregateCountries(regions),
        diagnostics: {
            backfilled: !!options.backfilled,
            restoredFromInvalidLedger: !!options.restoredFromInvalidLedger,
            issues: (options.issues || []).slice(0, 50),
            warnings: (options.warnings || []).map(String).slice(0, 30),
            exactPopulationReconciliation: true,
            wageModelActive: false
        }
    };
}

function storyPopulationValidate(ledger) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) {
        return { ok: false, issues: [{ code: 'POPULATION_LEDGER_REQUIRED', path: '$', message: 'Nüfus defteri zorunlu.' }] };
    }
    if (ledger.schemaVersion !== STORY_POPULATION_SCHEMA_VERSION) add('POPULATION_SCHEMA_VERSION', '$.schemaVersion', 'Nüfus şeması uyuşmuyor.');
    if (ledger.adapterVersion !== STORY_POPULATION_ADAPTER_VERSION) add('POPULATION_ADAPTER_VERSION', '$.adapterVersion', 'Nüfus adaptörü uyuşmuyor.');
    if (ledger.policyHash !== STORY_POPULATION_POLICY_HASH) add('POPULATION_POLICY_HASH', '$.policyHash', 'Nüfus politikası uyuşmuyor.');
    const topologyHash = STORY.regionModel ? STORY.regionModel.topologyHash : null;
    if (ledger.topologyHash !== topologyHash) add('POPULATION_TOPOLOGY_HASH', '$.topologyHash', 'Nüfus defteri yanlış topolojiye bağlı.');
    const expectedIds = (STORY.nodes || []).map(node => `region:${Number(node.id)}`).sort();
    const actualIds = Object.keys(ledger.regions || {}).sort();
    if (JSON.stringify(expectedIds) !== JSON.stringify(actualIds)) add('POPULATION_REGION_SET', '$.regions', 'Bölge kümesi birebir uyuşmalı.');
    const ids = new Set();
    for (const node of (STORY.nodes || [])) {
        const regionId = `region:${Number(node.id)}`;
        const region = ledger.regions && ledger.regions[regionId];
        if (!region) continue;
        const expectedCountryId = storyPopulationCountryId(node.owner);
        if (region.countryId !== expectedCountryId) add('POPULATION_OWNER_MISMATCH', `$.regions.${regionId}.countryId`, 'Kohortların güncel siyasi sahibiyle bağı uyuşmuyor.');
        const expectedPeople = storyPopulationPeople(node);
        if (region.populationPeople !== expectedPeople) add('POPULATION_REGION_TOTAL', `$.regions.${regionId}.populationPeople`, 'Bölge toplamı canlı nüfusla uyuşmuyor.');
        if (!Array.isArray(region.cohorts) || region.cohorts.length !== STORY_POPULATION_PROFILES.length) {
            add('POPULATION_COHORT_SET', `$.regions.${regionId}.cohorts`, 'Bölgenin kohort profilleri eksiksiz olmalı.');
            continue;
        }
        let members = 0;
        let shares = 0;
        for (const cohort of region.cohorts) {
            if (ids.has(cohort.id)) add('POPULATION_DUPLICATE_ID', `$.regions.${regionId}.cohorts`, `Yinelenen kohort: ${cohort.id}`);
            ids.add(cohort.id);
            if (cohort.regionId !== regionId || cohort.countryId !== expectedCountryId) add('POPULATION_COHORT_LINK', `$.regions.${regionId}.cohorts`, 'Kohort bölge/ülke bağı bozuk.');
            for (const field of Object.keys(STORY_POPULATION_ENUMS)) {
                if (!STORY_POPULATION_ENUMS[field].includes(cohort[field])) add('POPULATION_ENUM', `$.regions.${regionId}.cohorts.${cohort.id}.${field}`, `Geçersiz ${field}.`);
            }
            if (!Number.isInteger(cohort.membersPeople) || cohort.membersPeople < 0) add('POPULATION_MEMBERS', `$.regions.${regionId}.cohorts.${cohort.id}.membersPeople`, 'Kişi sayısı negatif olmayan tamsayı olmalı.');
            if (!Number.isInteger(cohort.shareBps) || cohort.shareBps < 0) add('POPULATION_SHARE', `$.regions.${regionId}.cohorts.${cohort.id}.shareBps`, 'Pay baz puanı geçersiz.');
            members += Number(cohort.membersPeople) || 0;
            shares += Number(cohort.shareBps) || 0;
        }
        if (members !== expectedPeople) add('POPULATION_COHORT_TOTAL', `$.regions.${regionId}.cohorts`, 'Kohort toplamı bölge nüfusuyla tam uyuşmalı.');
        if (shares !== 10000) add('POPULATION_SHARE_TOTAL', `$.regions.${regionId}.cohorts`, 'Kohort payları tam 10.000 baz puan olmalı.');
    }
    const expectedCountries = storyPopulationAggregateCountries(ledger.regions || {});
    if (JSON.stringify(expectedCountries) !== JSON.stringify(ledger.countries || {})) add('POPULATION_COUNTRY_TOTAL', '$.countries', 'Ülke toplamları bölge toplamlarından birebir türemeli.');
    return { ok: issues.length === 0, issues };
}

function storyPopulationReset(options) {
    if (!storyPopulationEnabled()) { STORY.population = null; return null; }
    STORY.population = storyPopulationLedgerCreate(options);
    return STORY.population;
}

function storyPopulationRestore(saved) {
    if (!storyPopulationEnabled()) { STORY.population = null; return null; }
    if (!saved) return storyPopulationReset({ backfilled: true, warnings: ['Eski kayıtta nüfus kohortu yoktu; canlı bölge nüfusundan deterministik olarak kuruldu.'] });
    const candidate = storyPopulationClone(saved);
    const validation = storyPopulationValidate(candidate);
    if (!validation.ok) return storyPopulationReset({
        backfilled: true,
        restoredFromInvalidLedger: true,
        issues: validation.issues,
        warnings: ['Bozuk nüfus defteri kullanılmadı; canlı bölge nüfusundan güvenli kohortlar kuruldu.']
    });
    STORY.population = candidate;
    return STORY.population;
}

function storyPopulationEnsure() {
    if (!storyPopulationEnabled()) return null;
    return STORY.population || storyPopulationReset({ backfilled: true });
}

function storyPopulationReconcile() {
    const ledger = storyPopulationEnsure();
    if (!ledger) return null;
    const regions = {};
    let changed = false;
    for (const node of (STORY.nodes || [])) {
        const id = `region:${Number(node.id)}`;
        const previous = ledger.regions[id];
        const next = storyPopulationRegionCreate(node, previous);
        regions[id] = next;
        if (!previous || previous.populationPeople !== next.populationPeople || previous.countryId !== next.countryId) changed = true;
    }
    ledger.regions = regions;
    ledger.countries = storyPopulationAggregateCountries(regions);
    ledger.lastReconciledAt = Number(STORY.clock) || 0;
    if (changed) ledger.revision++;
    return ledger;
}

function storyPopulationTick() {
    const before = storyPopulationEnsure();
    if (!before) return { disabled: true, regionsProcessed: 0 };
    const oldRevision = before.revision;
    const ledger = storyPopulationReconcile();
    return { disabled: false, regionsProcessed: Object.keys(ledger.regions).length, changed: ledger.revision !== oldRevision };
}

function storyPopulationForSave() {
    const ledger = storyPopulationReconcile();
    if (!ledger) return null;
    const validation = storyPopulationValidate(ledger);
    if (!validation.ok) {
        ledger.diagnostics.issues = validation.issues.slice(0, 50);
        ledger.diagnostics.warnings = ['Nüfus kaydı doğrulama sorunları taşıyor.'];
    }
    return storyPopulationClone(ledger);
}

function storyPopulationRegionView(regionId) {
    const ledger = storyPopulationEnsure();
    const id = String(regionId).startsWith('region:') ? String(regionId) : `region:${Number(regionId)}`;
    const region = ledger && ledger.regions[id];
    return region ? storyPopulationClone(region) : null;
}

function storyPopulationCountryView(countryId) {
    const ledger = storyPopulationEnsure();
    const id = String(countryId).startsWith('country:') ? String(countryId) : `country:${Number(countryId)}`;
    return ledger && ledger.countries[id] ? storyPopulationClone(ledger.countries[id]) : null;
}

function storyPopulationLaborSupply(regionId, worldDays) {
    const region = storyPopulationRegionView(regionId);
    if (!region) return { status: 'UNAVAILABLE', availableWorkersPeople: 0, laborLots: 0, wageIndex: null };
    const availableWorkersPeople = region.cohorts.reduce((sum, cohort) => sum + storyPopulationAvailableWorkers(cohort), 0);
    const laborLots = Math.round(availableWorkersPeople / 1000 * STORY_POPULATION_LABOR_SCALE * Math.max(0, Number(worldDays) || 0) * 1e6) / 1e6;
    return {
        status: 'COHORT_DERIVED',
        availableWorkersPeople,
        workingAgePeople: region.cohorts.filter(row => row.ageBand === 'YOUNG' || row.ageBand === 'ADULT').reduce((sum, row) => sum + row.membersPeople, 0),
        laborLots,
        wageIndex: null
    };
}

// Faz 27'nin tek nüfus mutasyon kapısı. Göç katmanı kendi nüfus kopyasını
// tutmaz; doğrulanmış bir profil dağılımını iki kanonik bölge arasında atomik
// taşır. node.pop ve kohort toplamları aynı işlemde kapanır.
function storyPopulationSharesFromMembers(cohorts) {
    const total = (cohorts || []).reduce((sum, row) => sum + Math.max(0, Math.floor(Number(row.membersPeople) || 0)), 0);
    if (total <= 0) return STORY_POPULATION_PROFILES.map((profile, index) => ({
        profileKey: profile.key,
        shareBps: index === 0 ? 10000 : 0
    }));
    const exact = (cohorts || []).map(row => Math.max(0, Math.floor(Number(row.membersPeople) || 0)) * 10000 / total);
    const shares = exact.map(Math.floor);
    let remainder = 10000 - shares.reduce((sum, value) => sum + value, 0);
    exact.map((value, index) => ({ index, fraction: value - Math.floor(value) }))
        .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
        .slice(0, remainder)
        .forEach(row => { shares[row.index]++; });
    return (cohorts || []).map((row, index) => ({ profileKey: row.profileKey, shareBps: shares[index] }));
}

function storyPopulationRegionApplyMembers(region, membersByProfile, countryId) {
    const shares = storyPopulationSharesFromMembers(region.cohorts.map(row => ({
        profileKey: row.profileKey,
        membersPeople: Math.max(0, Math.floor(Number(membersByProfile[row.profileKey]) || 0))
    })));
    const shareByProfile = Object.fromEntries(shares.map(row => [row.profileKey, row.shareBps]));
    for (const cohort of region.cohorts) {
        cohort.membersPeople = Math.max(0, Math.floor(Number(membersByProfile[cohort.profileKey]) || 0));
        cohort.shareBps = shareByProfile[cohort.profileKey];
        cohort.countryId = countryId;
    }
    region.countryId = countryId;
    region.populationPeople = region.cohorts.reduce((sum, row) => sum + row.membersPeople, 0);
}

function storyPopulationScaleTransfer(entries, maximumPeople) {
    const total = entries.reduce((sum, row) => sum + row.people, 0);
    const limit = Math.max(0, Math.min(total, Math.floor(Number(maximumPeople) || 0)));
    if (limit >= total) return entries.map(row => ({ profileKey: row.profileKey, people: row.people }));
    if (limit <= 0 || total <= 0) return [];
    const exact = entries.map(row => row.people * limit / total);
    const values = exact.map(Math.floor);
    let remainder = limit - values.reduce((sum, value) => sum + value, 0);
    exact.map((value, index) => ({ index, fraction: value - Math.floor(value) }))
        .sort((a, b) => b.fraction - a.fraction || entries[a.index].profileKey.localeCompare(entries[b.index].profileKey))
        .slice(0, remainder)
        .forEach(row => { values[row.index]++; });
    return entries.map((row, index) => ({ profileKey: row.profileKey, people: values[index] }))
        .filter(row => row.people > 0);
}

function storyPopulationTransferCohorts(originRegionId, destinationRegionId, requestedByProfile, options) {
    options = options || {};
    const ledger = storyPopulationEnsure();
    if (!ledger) return { ok: false, reason: 'FEATURE_DISABLED' };
    const originId = String(originRegionId).startsWith('region:') ? String(originRegionId) : `region:${Number(originRegionId)}`;
    const destinationId = String(destinationRegionId).startsWith('region:') ? String(destinationRegionId) : `region:${Number(destinationRegionId)}`;
    if (originId === destinationId) return { ok: false, reason: 'SAME_REGION' };
    const origin = ledger.regions[originId];
    const destination = ledger.regions[destinationId];
    if (!origin || !destination) return { ok: false, reason: 'REGION_NOT_FOUND' };
    const originNode = (STORY.nodes || []).find(node => `region:${Number(node.id)}` === originId);
    const destinationNode = (STORY.nodes || []).find(node => `region:${Number(node.id)}` === destinationId);
    if (!originNode || !destinationNode) return { ok: false, reason: 'NODE_NOT_FOUND' };

    const requested = requestedByProfile && typeof requestedByProfile === 'object' ? requestedByProfile : {};
    const originByProfile = Object.fromEntries(origin.cohorts.map(row => [row.profileKey, row]));
    const entries = STORY_POPULATION_PROFILES.map(profile => ({
        profileKey: profile.key,
        people: Math.min(
            Math.max(0, Math.floor(Number(requested[profile.key]) || 0)),
            Math.max(0, Number(originByProfile[profile.key] && originByProfile[profile.key].membersPeople) || 0)
        )
    })).filter(row => row.people > 0);
    const minimumOriginPopulationPeople = Math.max(0, Math.floor(Number(options.minimumOriginPopulationPeople) || 1000));
    const maximumPeople = Math.max(0, origin.populationPeople - minimumOriginPopulationPeople);
    const transfer = storyPopulationScaleTransfer(entries, maximumPeople);
    const movedPeople = transfer.reduce((sum, row) => sum + row.people, 0);
    if (movedPeople <= 0) return { ok: false, reason: 'NO_MOVABLE_POPULATION' };

    const before = {
        origin: storyPopulationClone(origin),
        destination: storyPopulationClone(destination),
        countries: storyPopulationClone(ledger.countries),
        revision: ledger.revision,
        originPop: originNode.pop,
        destinationPop: destinationNode.pop
    };
    const originMembers = Object.fromEntries(origin.cohorts.map(row => [row.profileKey, row.membersPeople]));
    const destinationMembers = Object.fromEntries(destination.cohorts.map(row => [row.profileKey, row.membersPeople]));
    for (const row of transfer) {
        originMembers[row.profileKey] -= row.people;
        destinationMembers[row.profileKey] += row.people;
    }
    const originCountryId = storyPopulationCountryId(originNode.owner);
    const destinationCountryId = storyPopulationCountryId(destinationNode.owner);
    storyPopulationRegionApplyMembers(origin, originMembers, originCountryId);
    storyPopulationRegionApplyMembers(destination, destinationMembers, destinationCountryId);
    originNode.pop = origin.populationPeople / 1000;
    destinationNode.pop = destination.populationPeople / 1000;
    ledger.countries = storyPopulationAggregateCountries(ledger.regions);
    ledger.lastReconciledAt = Number(STORY.clock) || 0;
    ledger.revision++;
    const validation = storyPopulationValidate(ledger);
    if (!validation.ok) {
        ledger.regions[originId] = before.origin;
        ledger.regions[destinationId] = before.destination;
        ledger.countries = before.countries;
        ledger.revision = before.revision;
        originNode.pop = before.originPop;
        destinationNode.pop = before.destinationPop;
        return { ok: false, reason: 'POPULATION_VALIDATION_FAILED', issues: validation.issues.slice(0, 20) };
    }
    return {
        ok: true,
        originRegionId: originId,
        destinationRegionId: destinationId,
        originCountryId,
        destinationCountryId,
        movedPeople,
        cohorts: transfer,
        originPopulationBefore: before.origin.populationPeople,
        originPopulationAfter: origin.populationPeople,
        destinationPopulationBefore: before.destination.populationPeople,
        destinationPopulationAfter: destination.populationPeople,
        populationDelta: (origin.populationPeople + destination.populationPeople)
            - (before.origin.populationPeople + before.destination.populationPeople)
    };
}

function storyPopulationWorldEntities() {
    const ledger = storyPopulationEnsure();
    if (!ledger) return [];
    const entities = [];
    for (const regionId of Object.keys(ledger.regions).sort()) {
        for (const cohort of ledger.regions[regionId].cohorts) entities.push(storyPopulationClone(cohort));
    }
    return entities;
}

function storyPopulationSummary() {
    const ledger = storyPopulationEnsure();
    if (!ledger) return { schemaVersion: STORY_POPULATION_SCHEMA_VERSION, adapterVersion: STORY_POPULATION_ADAPTER_VERSION, disabled: true, regionCount: 0, cohortCount: 0 };
    return {
        schemaVersion: ledger.schemaVersion,
        adapterVersion: ledger.adapterVersion,
        policyHash: ledger.policyHash,
        disabled: false,
        regionCount: Object.keys(ledger.regions).length,
        cohortCount: Object.values(ledger.regions).reduce((sum, region) => sum + region.cohorts.length, 0),
        populationPeople: Object.values(ledger.regions).reduce((sum, region) => sum + region.populationPeople, 0),
        revision: ledger.revision,
        wageModelActive: false,
        diagnostics: storyPopulationClone(ledger.diagnostics)
    };
}
