// ═══════════════════════════════════════════════════════════════════════════
//  ŞEHİR DOSYASI — Faz 14.1
//  ---------------------------------------------------------------------------
//  Bu UI ham STORY.nodes veya StoryWorldStateV2 değerlerini doğrudan çizmez.
//  Görünen bütün bölge/karakter gerçekleri PlayerKnowledge üzerinden geçer.
//  UNKNOWN bilgi null kalır; "0" gibi sahte bir kesinlik üretilmez.
//
//  Kapsam sınırı:
//   • mevcut şehir üretim/bina/garnizon işlemleri yalnız oyuncunun şehrinde;
//   • yabancı şehir salt-okunur ve gizli idari/askerî değerleri göstermez;
//   • şirket/tesis/banka, Faz 28 güç merkezi ve Faz 29 kurum/yetki verisi
//     bilgi filtresinden geçer;
//     doğrudan karakter görüşmesi henüz simüle edilmez.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_CITY_DOSSIER_SCHEMA_VERSION = 1;
const STORY_CITY_DOSSIER_TABS = Object.freeze([
    'genel', 'nufus', 'kurumlar', 'tarih', 'karakterler', 'binalar', 'ordu'
]);
const STORY_ECONOMY_TABS = Object.freeze([
    'genel', 'butce', 'sirketler', 'piyasa', 'lojistik', 'fraksiyonlar'
]);
const STORY_CITY_MODE_META = Object.freeze({
    LAND: { icon: '↔', label: 'KARA' },
    SEA: { icon: '≈', label: 'DENİZ' },
    ENERGY: { icon: 'ϟ', label: 'ENERJİ' },
    DATA: { icon: '⌁', label: 'VERİ' }
});
const STORY_DOSSIER_RESOURCE_LABELS = Object.freeze({
    food: 'GIDA', energy: 'ENERJİ', raw_materials: 'HAMMADDE',
    industrial_parts: 'SANAYİ PARÇASI', electronics: 'ELEKTRONİK',
    military_supplies: 'ASKERÎ MALZEME', labor: 'İŞ GÜCÜ', capital: 'SERMAYE'
});
const STORY_DOSSIER_SECTOR_LABELS = Object.freeze({
    agriculture: 'TARIM', energy: 'ENERJİ', extraction: 'HAMMADDE',
    civil_industry: 'SİVİL SANAYİ', advanced_tech: 'İLERİ TEKNOLOJİ',
    defense_industry: 'SAVUNMA SANAYİİ', finance: 'FİNANS', logistics: 'LOJİSTİK'
});
const STORY_DOSSIER_STATUS_LABELS = Object.freeze({
    CURRENT: 'ÖDEMELER DÜZENLİ', DEFAULT: 'TEMERRÜT', ARREARS: 'GECİKMEDE',
    REGISTERED: 'KAYITLI', LICENSED: 'LİSANSLI', OPERATING: 'FAAL',
    HELD: 'BEKLEMEDE', APPLIED: 'UYGULANDI', REJECTED: 'REDDEDİLDİ',
    IN_TRANSIT: 'YOLDA', DELIVERED: 'TESLİM EDİLDİ', LOST: 'KAYIP',
    RETURNED: 'GERİ DÖNDÜ', FAILED: 'BAŞARISIZ', PLANNED: 'PLANLANDI', PARTIAL: 'KISMİ'
});
const STORY_DOSSIER_ACTION_LABELS = Object.freeze({
    HOLD: 'YATIRIMI BEKLET', INVEST_OWN_FUNDS: 'ÖZ KAYNAKLA YATIRIM',
    BORROW_AND_INVEST: 'KREDİYLE YATIRIM', PREPARE_INVESTMENT_INPUTS: 'YATIRIM GİRDİLERİNİ HAZIRLA',
    TARGETED_CAPACITY_GRANT: 'HEDEFLİ KAPASİTE DESTEĞİ'
});
const STORY_DOSSIER_REASON_LABELS = Object.freeze({
    NO_ELIGIBLE_INVESTMENT: 'Yatırım koşulları oluşmadı',
    BENEFIT_BELOW_THRESHOLD: 'Beklenen fayda yatırım eşiğinin altında',
    INSUFFICIENT_CASH: 'Nakit yetersiz', INSUFFICIENT_INPUTS: 'Girdi yetersiz',
    CREDIT_UNAVAILABLE: 'Kredi kullanılamıyor', COOLDOWN_ACTIVE: 'Yeni karar için bekleme süresi var'
});
const STORY_DOSSIER_OBJECTIVE_LABELS = Object.freeze({
    FORCE_READINESS: 'HAREKÂT HAZIRLIĞI', BUDGET_SECURITY: 'SAVUNMA BÜTÇESİ', TERRITORIAL_ORDER: 'SINIR GÜVENLİĞİ',
    MARKET_STABILITY: 'PİYASA İSTİKRARI', LOGISTICS_OPEN: 'AÇIK LOJİSTİK HATLARI', CAPITAL_PRESERVATION: 'SERMAYEYİ KORUMA',
    EMPLOYMENT_SECURITY: 'İSTİHDAM GÜVENCESİ', INCOME_SECURITY: 'GELİR GÜVENCESİ', PUBLIC_SERVICES: 'KAMU HİZMETLERİ',
    ADMIN_CAPACITY: 'İDARİ KAPASİTE', BUDGET_CONTINUITY: 'BÜTÇE SÜREKLİLİĞİ', LEGAL_CONTINUITY: 'HUKUKİ SÜREKLİLİK',
    INFORMATION_ACCESS: 'BİLGİYE ERİŞİM', PRESS_AUTONOMY: 'BASIN ÖZERKLİĞİ', AUDIENCE_TRUST: 'KAMU GÜVENİ',
    INTERNAL_ORDER: 'İÇ DÜZEN', COUNTER_RADICALIZATION: 'RADİKALLEŞMEYLE MÜCADELE', EXECUTIVE_CONTINUITY: 'YÖNETİM SÜREKLİLİĞİ',
    MASS_MOBILIZATION: 'KİTLE SEFERBERLİĞİ', GRIEVANCE_ESCALATION: 'ŞİKÂYETLERİ BÜYÜTME', REGIME_DISRUPTION: 'YÖNETİMİ SARSMA'
});

function storyCityDossierLabel(value, labels) {
    const key = String(value == null ? '' : value);
    return labels[key] || key.replace(/_/g, ' ').toLocaleUpperCase('tr-TR');
}

function storyCityDossierRegionName(regionId) {
    const legacyId = storyCityDossierLegacyId(regionId);
    const node = legacyId == null || typeof storyNode !== 'function' ? null : storyNode(legacyId);
    return node && node.name ? node.name : String(regionId || '—');
}

function storyCityDossierEnabled() {
    return typeof storyFeatureEnabled !== 'function' || storyFeatureEnabled('ui.cityDossier');
}

function storyCityDossierEscape(value) {
    if (typeof storyProjectionEscape === 'function') return storyProjectionEscape(value);
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function storyCityDossierClone(value) {
    if (typeof storyWorldV2Clone === 'function') return storyWorldV2Clone(value);
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyCityDossierLegacyId(regionId) {
    const match = /^region:(-?\d+)$/.exec(String(regionId || ''));
    return match ? Number(match[1]) : null;
}

function storyCityDossierFactCopy(fact) {
    if (!fact) return null;
    return {
        id: String(fact.id),
        subjectId: String(fact.subjectId),
        field: String(fact.field),
        value: fact.status === PLAYER_FACT_STATUS.UNKNOWN ? null : storyCityDossierClone(fact.value),
        status: String(fact.status),
        confidenceBps: Number(fact.confidenceBps) || 0,
        sourceType: String(fact.source && fact.source.type || 'UNKNOWN'),
        observedAt: Number(fact.observedAt) || 0
    };
}

function storyCityDossierCountryName(knowledge, countryId) {
    const country = (knowledge.countries || []).find(candidate => candidate.id === countryId);
    return country && country.name && country.name.value != null
        ? String(country.name.value)
        : 'Sahipsiz';
}

function storyCityDossierCollectHistory(regionId) {
    if (typeof storyPlayerProjectionCurrent !== 'function') return [];
    try {
        const projection = storyPlayerProjectionCurrent({ maxItems: 200, recentSeconds: 600 });
        return (projection.items || [])
            .filter(item => item.subjectId === regionId)
            .map(item => ({
                id: String(item.id),
                observedAt: Number(item.observedAt) || 0,
                subjectName: String(item.subjectName || ''),
                label: String(item.label || ''),
                domain: String(item.domain || ''),
                direction: String(item.direction || 'CHANGED'),
                badgeText: String(item.badge && item.badge.text || item.label || ''),
                precision: String(item.precision || 'OPAQUE'),
                causeSteps: item.cause && Array.isArray(item.cause.steps)
                    ? item.cause.steps.map(step => String(step.label || '')).filter(Boolean)
                    : []
            }));
    } catch (_error) {
        return [];
    }
}

function storyCityDossierCorridors(regionId, logisticsFact, world) {
    if (!logisticsFact || logisticsFact.status !== PLAYER_FACT_STATUS.VERIFIED
        || !logisticsFact.value || !Array.isArray(logisticsFact.value.corridorIds)
        || typeof storyInfrastructureSnapshot !== 'function') return [];
    const knownIds = new Set(logisticsFact.value.corridorIds.map(String));
    const regionNames = new Map((world.regions || []).map(region => [region.id, String(region.name || region.id)]));
    const snapshot = storyInfrastructureSnapshot();
    if (!snapshot || snapshot.disabled) return [];
    return (snapshot.corridors || [])
        .filter(corridor => knownIds.has(String(corridor.id))
            && (corridor.endpointRegionIds || []).includes(regionId))
        .map(corridor => {
            const destinationRegionId = (corridor.endpointRegionIds || []).find(id => id !== regionId) || null;
            return {
                id: String(corridor.id),
                mode: String(corridor.mode),
                destinationRegionId,
                destinationName: regionNames.get(destinationRegionId) || 'Bilinmeyen bağlantı',
                status: String(corridor.status || 'BLOCKED'),
                effectiveCapacity: Math.max(0, Number(corridor.effectiveCapacity) || 0),
                damageBps: Math.max(0, Math.min(10000, Number(corridor.damageBps) || 0)),
                latencySeconds: Math.max(0, Number(corridor.latencySeconds) || 0)
            };
        })
        .sort((a, b) => a.mode.localeCompare(b.mode)
            || a.destinationName.localeCompare(b.destinationName, 'tr'));
}

function storyCityDossierBuild(nodeId) {
    if (!storyCityDossierEnabled()) {
        return { schemaVersion: STORY_CITY_DOSSIER_SCHEMA_VERSION, disabled: true };
    }
    const legacyId = Number(nodeId);
    if (!Number.isInteger(legacyId)) throw new Error('Şehir dosyası için geçerli düğüm kimliği zorunlu.');
    const world = storyWorldV2ExportValidated();
    const playerCountryId = storyWorldV2CountryId(STORY.playerStateId);
    const knowledge = storyPlayerKnowledgeProject(world, playerCountryId);
    const regionId = storyWorldV2RegionId(legacyId);
    const worldRegion = (world.regions || []).find(region => region.id === regionId);
    const region = (knowledge.regions || []).find(candidate => candidate.id === regionId);
    if (!worldRegion || !region) throw new Error(`Şehir dosyası bölgesi bulunamadı: ${regionId}`);

    const ownerId = region.ownerId.value;
    const isOwn = ownerId === playerCountryId;
    const facts = {};
    for (const field of [
        'name', 'ownerId', 'neighborIds', 'level', 'garrison', 'infrastructure',
        'population', 'populationCohorts', 'needsWelfare', 'publicOpinion', 'collectiveAction', 'humanMigration', 'powerCenters', 'institutions', 'stateCapacity', 'wealth', 'deposits', 'stocks', 'trade', 'market', 'companyEconomy', 'logistics'
    ]) facts[field] = storyCityDossierFactCopy(region[field]);
    const ownerCountry = (knowledge.countries || []).find(candidate => candidate.id === ownerId);
    facts.budget = storyCityDossierFactCopy(ownerCountry && ownerCountry.budget);
    facts.countryCompanies = storyCityDossierFactCopy(ownerCountry && ownerCountry.companyEconomy);
    facts.economicPolicy = storyCityDossierFactCopy(ownerCountry && ownerCountry.economicPolicy);
    facts.countryPowerCenters = storyCityDossierFactCopy(ownerCountry && ownerCountry.powerCenters);
    facts.countryInstitutions = storyCityDossierFactCopy(ownerCountry && ownerCountry.institutions);
    facts.countryStateCapacity = storyCityDossierFactCopy(ownerCountry && ownerCountry.stateCapacity);
    facts.countryElections = storyCityDossierFactCopy(ownerCountry && ownerCountry.elections);
    facts.countryIntegrity = storyCityDossierFactCopy(ownerCountry && ownerCountry.integrity);

    const characters = (knowledge.characters || [])
        .filter(character => character.regionId
            && character.regionId.status !== PLAYER_FACT_STATUS.UNKNOWN
            && character.regionId.value === regionId)
        .map(character => ({
            id: String(character.id),
            name: storyCityDossierFactCopy(character.name),
            role: storyCityDossierFactCopy(character.role),
            loyalty: storyCityDossierFactCopy(character.loyalty),
            skills: storyCityDossierFactCopy(character.skills)
        }));

    const neighborIds = Array.isArray(facts.neighborIds.value) ? facts.neighborIds.value : [];
    const publicRegions = new Map((knowledge.regions || []).map(candidate => [
        candidate.id,
        {
            id: candidate.id,
            legacyId: storyCityDossierLegacyId(candidate.id),
            name: candidate.name.value,
            ownerId: candidate.ownerId.value
        }
    ]));

    const view = {
        schemaVersion: STORY_CITY_DOSSIER_SCHEMA_VERSION,
        disabled: false,
        generatedAt: Number(world.clock.gameTime) || 0,
        regionId,
        legacyId,
        playerCountryId,
        ownerId,
        ownerName: storyCityDossierCountryName(knowledge, ownerId),
        isOwn,
        facts,
        neighbors: neighborIds.map(id => publicRegions.get(id)).filter(Boolean),
        corridors: storyCityDossierCorridors(regionId, facts.logistics, world),
        history: storyCityDossierCollectHistory(regionId),
        characters,
        missingSystems: facts.countryPowerCenters && facts.countryPowerCenters.value
            && facts.countryInstitutions && facts.countryInstitutions.value
            ? [] : [{ id: 'institutions', label: 'KURUMLAR VE GÜÇ MERKEZLERİ', status: 'NOT_IMPLEMENTED' }]
    };
    const validation = storyCityDossierValidate(view);
    if (!validation.ok) throw new Error(`Geçersiz şehir dosyası: ${validation.issues[0].code}`);
    return view;
}

function storyCityDossierValidate(view) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!view || typeof view !== 'object' || Array.isArray(view)) {
        return { ok: false, issues: [{ code: 'VIEW_REQUIRED', path: '$', message: 'Şehir dosyası nesnesi zorunlu.' }] };
    }
    if (view.schemaVersion !== STORY_CITY_DOSSIER_SCHEMA_VERSION) {
        add('SCHEMA_VERSION', '$.schemaVersion', 'Şehir dosyası sürümü uyuşmuyor.');
    }
    if (view.disabled) return { ok: issues.length === 0, issues };
    if (!/^region:-?\d+$/.test(String(view.regionId || ''))) add('REGION_ID', '$.regionId', 'Kalıcı bölge kimliği geçersiz.');
    if (!view.facts || typeof view.facts !== 'object') add('FACTS_REQUIRED', '$.facts', 'Bilgi görünümü zorunlu.');
    else {
        for (const [field, fact] of Object.entries(view.facts)) {
            const at = `$.facts.${field}`;
            if (!fact || typeof fact !== 'object') {
                add('FACT_REQUIRED', at, 'Alan PlayerVisibleFact taşımalı.');
                continue;
            }
            if (!Object.values(PLAYER_FACT_STATUS).includes(fact.status)) add('FACT_STATUS', `${at}.status`, 'Bilgi sınıfı geçersiz.');
            if (fact.status === PLAYER_FACT_STATUS.UNKNOWN && fact.value !== null) {
                add('UNKNOWN_VALUE_LEAK', `${at}.value`, 'Bilinmeyen şehir bilgisi değer taşıyamaz.');
            }
        }
    }
    if (!view.isOwn) {
        for (const field of ['level', 'garrison', 'infrastructure', 'population', 'populationCohorts', 'needsWelfare', 'publicOpinion', 'wealth', 'deposits', 'trade', 'market', 'logistics', 'budget']) {
            const fact = view.facts && view.facts[field];
            if (!fact || fact.status !== PLAYER_FACT_STATUS.UNKNOWN || fact.value !== null) {
                add('FOREIGN_SECRET_LEAK', `$.facts.${field}`, `Yabancı ${field} bilgisi gizli kalmalı.`);
            }
        }
        if ((view.corridors || []).length) add('FOREIGN_LOGISTICS_LEAK', '$.corridors', 'Yabancı lojistik ayrıntısı gösterilemez.');
        if ((view.characters || []).length) add('FOREIGN_CHARACTER_LOCATION_LEAK', '$.characters', 'Bilinmeyen yabancı karakter konumu gösterilemez.');
        const collective = view.facts && view.facts.collectiveAction;
        const collectiveText = collective && collective.value ? JSON.stringify(collective.value) : '';
        if (/mobilizationBps|radicalizationBps|organizationBps|suppressionMemoryBps/.test(collectiveText)) {
            add('FOREIGN_COLLECTIVE_INTELLIGENCE_LEAK', '$.facts.collectiveAction', 'Yabancı hareketin gizli örgütlenme/radikalleşme ölçüleri sızamaz.');
        }
        const migration = view.facts && view.facts.humanMigration;
        const migrationText = migration && migration.value ? JSON.stringify(migration.value) : '';
        if (/cohorts|route|evidence|originPushBps|qualityGainBps|receptionCapacityPeople/.test(migrationText)) {
            add('FOREIGN_MIGRATION_INTELLIGENCE_LEAK', '$.facts.humanMigration', 'Yabancı göçün kohort, rota, kapasite ve karar kanıtı sızamaz.');
        }
        const powerCenters = view.facts && view.facts.countryPowerCenters;
        const powerText = powerCenters && powerCenters.value ? JSON.stringify(powerCenters.value) : '';
        if (/supportBase|resources|resourceEvidence|organizationBps|influenceBps|alignmentBps|independenceBps|capabilities|priorityBps|actorId/.test(powerText)) {
            add('FOREIGN_POWER_CENTER_INTELLIGENCE_LEAK', '$.facts.countryPowerCenters', 'Yabancı güç merkezinin gizli kaynak, kapasite, hizalanma ve lider kimliği sızamaz.');
        }
        const institutions = view.facts && view.facts.countryInstitutions;
        const institutionText = institutions && institutions.value ? JSON.stringify(institutions.value) : '';
        if (/actorId|authoritySignature|requiredInstitutionIds|approvalInstitutionIds|requests/.test(institutionText)) {
            add('FOREIGN_INSTITUTION_INTELLIGENCE_LEAK', '$.facts.countryInstitutions', 'Yabancı kurumların aktör kimliği ve iç onay kayıtları sızamaz.');
        }
        const capacity = view.facts && view.facts.countryStateCapacity;
        const capacityText = capacity && capacity.value ? JSON.stringify(capacity.value) : '';
        if (/bureaucraticCapacityBps|institutionalIntegrityBps|corruptionRiskBps|implementationCapacityBps|implementationTickets|sources/.test(capacityText)) {
            add('FOREIGN_STATE_CAPACITY_INTELLIGENCE_LEAK', '$.facts.countryStateCapacity', 'Yabancı bürokrasi, bütünlük, sızıntı riski ve uygulama fişleri sızamaz.');
        }
        const elections = view.facts && view.facts.countryElections;
        const electionText = elections && elections.value ? JSON.stringify(elections.value) : '';
        if (/cohortBallots|scoreComponentsBySlate|sourceTicks|influenceBps|affinityBps/.test(electionText)) {
            add('FOREIGN_ELECTION_INTELLIGENCE_LEAK', '$.facts.countryElections', 'Yabancı seçimin kohort tercih hesabı ve iç destek ağı sızamaz.');
        }
        const integrity = view.facts && view.facts.countryIntegrity;
        const integrityText = integrity && integrity.value ? JSON.stringify(integrity.value) : '';
        if (/evidence|evidenceScoreBps|sourceId|sourceKind|subjectActorId|beneficiaryCompanyId|authorityRequestId|investigationRequestId|redFlags/.test(integrityText)) {
            add('FOREIGN_INTEGRITY_INTELLIGENCE_LEAK', '$.facts.countryIntegrity', 'Yabancı soruşturmanın gizli kanıtı, öznesi ve iç kaynak kimlikleri sızamaz.');
        }
    }
    if (!Array.isArray(view.missingSystems)
        || view.missingSystems.some(item => item.status !== 'NOT_IMPLEMENTED')) {
        add('MISSING_SYSTEM_STATUS', '$.missingSystems', 'Eksik sistemler açık NOT_IMPLEMENTED durumu taşımalı.');
    }
    return { ok: issues.length === 0, issues };
}

function storyCityDossierFactValue(fact, formatter) {
    if (!fact || fact.status === PLAYER_FACT_STATUS.UNKNOWN) {
        return '<span class="city-unknown">BİLGİ YOK</span>';
    }
    const value = formatter ? formatter(fact.value) : fact.value;
    return `<b>${storyCityDossierEscape(value)}</b>`;
}

function storyCityDossierNumber(value) {
    const number = Number(value);
    return Number.isFinite(number)
        ? (Math.abs(number) >= 100
            ? Math.round(number).toLocaleString('tr-TR')
            : Number(number.toFixed(1)).toLocaleString('tr-TR'))
        : '—';
}

function storyCityDossierMoney(value) {
    return `${storyCityDossierNumber(value)}<i class="city-money-unit"> devlet kredisi</i>`;
}

function storyCityDossierTabs(view, active) {
    const tabs = [
        ['genel', 'GENEL'],
        ['nufus', 'NÜFUS'],
        ['kurumlar', 'KURUMLAR'],
        ['tarih', 'TARİH'],
        ['karakterler', 'KARAKTERLER']
    ];
    if (view.isOwn) tabs.push(['binalar', 'BİNALAR'], ['ordu', 'ORDU']);
    return `<div class="city-dossier-tabs" role="tablist" aria-label="Şehir dosyası bölümleri">`
        + tabs.map(([id, label]) => `<button class="cb-sub${active === id ? ' active' : ''}" data-sub="${id}" role="tab" aria-selected="${active === id ? 'true' : 'false'}">${label}</button>`).join('')
        + `</div>`;
}

function storyCityDossierHeader(view, active) {
    const ownership = view.isOwn ? 'KENDİ YÖNETİMİN' : 'YABANCI BÖLGE';
    const neighbors = view.neighbors.map(region => (
        `<button class="city-chip city-route" data-region="${storyCityDossierEscape(region.id)}">${storyCityDossierEscape(region.name)}</button>`
    )).join('');
    return `<section class="city-dossier-head">`
        + `<div class="city-dossier-kicker">${ownership} · ${storyCityDossierEscape(view.ownerName)}</div>`
        + `<div class="city-dossier-name">${storyCityDossierEscape(view.facts.name.value)}</div>`
        + `<div class="city-dossier-source">${view.isOwn ? 'DOĞRULANMIŞ YÖNETİM KAYDI' : 'YALNIZ KAMUYA AÇIK HARİTA BİLGİSİ'}</div>`
        + (neighbors ? `<div class="city-dossier-neighbors"><span>KOMŞULAR</span><div class="city-chips">${neighbors}</div></div>` : '')
        + `</section>${storyCityDossierTabs(view, active)}`;
}

function storyCityDossierMissing(view) {
    if (!view.missingSystems.length) return '';
    return `<section class="city-dossier-sec"><h3>HENÜZ BAĞLANMAYAN KATMANLAR</h3>`
        + `<div class="city-missing-grid">${view.missingSystems.map(item => (
            `<div><b>${storyCityDossierEscape(item.label)}</b><span>SİSTEM HENÜZ YOK</span></div>`
        )).join('')}</div></section>`;
}

function storyCityDossierRenderPowerCenters(view) {
    const fact = view.facts.countryPowerCenters;
    if (!fact || fact.status === PLAYER_FACT_STATUS.UNKNOWN || !fact.value) {
        return `<section class="city-dossier-empty"><b>GÜÇ MERKEZİ KAYDI YOK</b>`
            + `<span>Bu ülkenin kurumsal aktörleri hakkında doğrulanmış bilgi bulunmuyor.</span></section>`;
    }
    const typeLabels = {
        ARMED_FORCES: 'SİLAHLI KUVVETLER', BUSINESS_COUNCIL: 'İŞ DÜNYASI',
        LABOR_CONFEDERATION: 'EMEK KONFEDERASYONU', CIVIL_SERVICE: 'KAMU İDARESİ',
        MEDIA_NETWORK: 'MEDYA AĞI', SECURITY_SERVICE: 'İÇ GÜVENLİK',
        RADICAL_NETWORK: 'RADİKAL AĞLAR'
    };
    const centers = Array.isArray(fact.value.centers) ? fact.value.centers : [];
    const rows = centers.map(center => {
        const leader = center.leader || {};
        if (!view.isOwn) {
            return `<article class="city-character-row"><div><b>${storyCityDossierEscape(typeLabels[center.type] || center.type)}</b>`
                + `<span>${storyCityDossierEscape(center.name || '')}</span>`
                + `<small>KAMUSAL TEMSİL: ${storyCityDossierEscape(leader.name || 'Bilinmiyor')} · kesin kaynak ve kapasite bilinmiyor</small></div></article>`;
        }
        const resources = center.resources || {};
        const capabilities = center.capabilities || {};
        const goals = Array.isArray(center.goals) ? center.goals : [];
        const topGoal = goals[0];
        const local = view.facts.powerCenters && view.facts.powerCenters.value;
        const localRow = local && Array.isArray(local.centers)
            ? local.centers.find(item => item.centerId === center.id) : null;
        const detail = `Örgüt %${storyCityDossierNumber(center.organizationBps / 100)}`
            + ` · Ülke desteği ${Math.round(Number(center.supportBase && center.supportBase.supportPeople) || 0).toLocaleString('tr-TR')} kişi`
            + `${localRow ? ` · Bu bölgede ${Math.round(Number(localRow.supportPeople) || 0).toLocaleString('tr-TR')} kişi` : ''}`
            + ` · Mali güç %${storyCityDossierNumber(capabilities.financeBps / 100)}`
            + ` · Seferberlik %${storyCityDossierNumber(capabilities.mobilizationBps / 100)}`
            + ` · Zorlama %${storyCityDossierNumber(capabilities.coercionBps / 100)}`
            + `${resources.facilityCount ? ` · ${storyCityDossierNumber(resources.facilityCount)} tesis` : ''}`;
        return `<article class="city-character-row detail-hover" tabindex="0" data-story-tooltip="${storyCityDossierEscape(detail)}"><div><b>${storyCityDossierEscape(typeLabels[center.type] || center.type)} · ETKİ %${storyCityDossierNumber(center.influenceBps / 100)}</b>`
            + `<span>${storyCityDossierEscape(center.name)} · LİDER: ${storyCityDossierEscape(leader.name || '—')}</span>`
            + `<small>${topGoal ? `ÖNCELİK: ${storyCityDossierEscape(storyCityDossierLabel(topGoal.code, STORY_DOSSIER_OBJECTIVE_LABELS))} %${storyCityDossierNumber(topGoal.priorityBps / 100)}` : 'Öncelik kaydı yok'}</small></div></article>`;
    }).join('');
    return `<section class="city-dossier-sec"><h3>ÜLKEDEKİ GÜÇ MERKEZLERİ</h3>`
        + (rows ? `<div class="city-character-list">${rows}</div>`
            : `<div class="city-dossier-empty"><b>ETKİN MERKEZ YOK</b><span>Kayıtlı kurumsal aktör bulunmuyor.</span></div>`)
        + `<p class="city-hint">Her güç merkezinin etkisi; toplumsal desteğine, mali kaynaklarına, örgütlenmesine ve güvenlik kapasitesine dayanır. Yapabilecekleri anayasal yetki düzeniyle sınırlıdır.</p></section>`;
}

function storyCityDossierRenderInstitutions(view) {
    const fact = view.facts.countryInstitutions;
    if (!fact || fact.status === PLAYER_FACT_STATUS.UNKNOWN || !fact.value) {
        return `<section class="city-dossier-empty"><b>KURUMSAL YETKİ KAYDI YOK</b>`
            + `<span>Bu ülkenin anayasal makamları hakkında doğrulanmış bilgi bulunmuyor.</span></section>`;
    }
    const value = fact.value;
    const typeLabels = {
        EXECUTIVE: 'YÜRÜTME', LEGISLATURE: 'YASAMA', JUDICIARY: 'YARGI',
        ARMED_FORCES: 'SİLAHLI KUVVETLER KOMUTASI', LOCAL_ADMINISTRATION: 'YEREL İDARELER'
    };
    const institutionRows = Array.isArray(value.institutions)
        ? value.institutions : Object.values(value.institutions || {});
    const localFact = view.facts.institutions && view.facts.institutions.value;
    const localInstitutionId = localFact && localFact.institutionId;
    const rows = institutionRows.map(institution => {
        const holder = institution.officeHolder || {};
        const officeName = institution.officeName || holder.name || 'Makam bilgisi yok';
        const localMark = institution.id === localInstitutionId ? ' · BU ŞEHRİN YEREL MAKAMI' : '';
        if (!view.isOwn) {
            const publicActions = Array.isArray(institution.publicActionTypes)
                ? institution.publicActionTypes.length : 0;
            return `<article class="city-character-row"><div><b>${storyCityDossierEscape(typeLabels[institution.type] || institution.type)}${localMark}</b>`
                + `<span>${storyCityDossierEscape(officeName)}</span>`
                + `<small>KAMUSAL YETKİ ALANI: ${publicActions} eylem türü · iç onay ve aktör kimliği gizli</small></div></article>`;
        }
        const grants = Array.isArray(institution.authorityGrants) ? institution.authorityGrants : [];
        const propose = grants.filter(grant => grant.canPropose).length;
        const approve = grants.filter(grant => grant.canApprove).length;
        const execute = grants.filter(grant => grant.canExecute).length;
        return `<article class="city-character-row"><div><b>${storyCityDossierEscape(typeLabels[institution.type] || institution.type)}${localMark}</b>`
            + `<span>${storyCityDossierEscape(institution.name || '')} · MAKAM: ${storyCityDossierEscape(officeName)}</span>`
            + `<small>${propose} teklif yetkisi · ${approve} onay yetkisi · ${execute} uygulama yetkisi</small></div></article>`;
    }).join('');
    let routeSummary = '';
    let requestSummary = '';
    if (view.isOwn) {
        const routes = Object.values(value.authorityByAction || {});
        const routeCounts = routes.reduce((out, route) => {
            out[route.mode] = (out[route.mode] || 0) + 1;
            return out;
        }, {});
        routeSummary = `<div class="city-fact-grid">`
            + `<div><span>TEK MAKAM KARARI</span><b>${routeCounts.DIRECT || 0}</b></div>`
            + `<div><span>ORTAK KARAR / ONAY</span><b>${routeCounts.JOINT || 0}</b></div>`
            + `<div><span>YETKİ DIŞI</span><b>${routeCounts.PROHIBITED || 0}</b></div>`
            + `<div><span>BAŞKA KURUMA BAĞLI</span><b>${routeCounts.EXTERNAL_DOMAIN || 0}</b></div></div>`;
        const requests = Array.isArray(value.requests) ? value.requests : [];
        const active = requests.filter(request => ['PENDING_APPROVAL', 'AUTHORIZED', 'STALE_AUTHORITY'].includes(request.status));
        requestSummary = active.length
            ? `<div class="city-character-list">${active.slice(-6).reverse().map(request => `<article class="city-character-row"><div>`
                + `<b>${storyCityDossierEscape(request.actionType)} · ${storyCityDossierEscape(request.status)}</b>`
                + `<span>${storyCityDossierEscape(request.routeMode)} · ${request.approvalInstitutionIds.length}/${request.requiredInstitutionIds.length} makam onayı</span>`
                + `<small>${storyCityDossierEscape(request.legalBasis)}</small></div></article>`).join('')}</div>`
            : `<div class="city-dossier-empty"><b>BEKLEYEN KARAR YOK</b><span>Onay bekleyen veya makam değişimiyle bayatlayan karar kaydı bulunmuyor.</span></div>`;
    }
    return `<section class="city-dossier-sec"><h3>ANAYASAL DÜZEN · ${storyCityDossierEscape(value.regimeName || value.regimeKey || 'Bilinmiyor')}</h3>`
        + routeSummary
        + `<div class="city-character-list">${rows}</div>`
        + requestSummary
        + `<p class="city-hint">Teklif, onay ve uygulama ayrı yetkilerdir. Makam veya anayasa değişirse tamamlanmamış kararlar yeniden yetkilendirme isteyebilir.</p></section>`;
}

function storyCityDossierRenderStateCapacity(view) {
    const countryFact = view.facts.countryStateCapacity;
    const localFact = view.facts.stateCapacity;
    if (!countryFact || countryFact.status === PLAYER_FACT_STATUS.UNKNOWN || !countryFact.value) {
        return `<section class="city-dossier-empty"><b>DEVLET KAPASİTESİ KAYDI YOK</b>`
            + `<span>Kararların uygulanabilirliği hakkında doğrulanmış bilgi bulunmuyor.</span></section>`;
    }
    const country = countryFact.value;
    const local = localFact && localFact.value;
    const pct = value => storyCityDossierNumber((Number(value) || 0) / 100);
    const metric = (label, value, detail) => `<div class="detail-hover" tabindex="0" data-story-tooltip="${storyCityDossierEscape(detail)}">`
        + `<span>${storyCityDossierEscape(label)}</span><b>%${pct(value)}</b></div>`;
    let grid = metric('MEŞRUİYET', country.legitimacyBps,
        'Refah, temel fraksiyon desteği, hatırlanan toplumsal zarar ve kamu hizmetinden türetilir. Tek bir popülerlik puanı değildir.')
        + metric('BÖLGESEL DENETİM', local ? local.regionalControlBps : country.regionalControlBps,
            'İdari erişim, fiziksel güvenlik, koridor durumu ve garnizon mevcudunun birleşimidir.');
    if (view.isOwn) {
        grid += metric('BÜROKRATİK KAPASİTE', country.bureaucraticCapacityBps,
            'Kamu idaresinin örgütü ve idari yeteneği, kamu hizmeti sonucu ve mali süreklilikten türetilir.')
            + metric('KURUMSAL BÜTÜNLÜK', country.institutionalIntegrityBps,
                'Hukuki denetim, kamu idaresi bağımsızlığı/örgütlülüğü ve mali süreklilik bileşimidir.')
            + metric('SAPTIRMA RİSKİ', country.corruptionRiskBps,
                'Kanıtlanmış suç değildir. Zayıf kurumsal bütünlük, mali gecikme ve güç yoğunlaşmasının uygulamayı saptırma riskidir.')
            + metric('UYGULAMA GÜCÜ', country.implementationCapacityBps,
                'Meşruiyet, bürokrasi, bütünlük ve bölgesel denetimin karar uygulamasında kullanılan birleşik kapasitesidir.');
    }
    let tickets = '';
    if (view.isOwn) {
        const labels = {
            QUEUED: 'SIRADA', IMPLEMENTING: 'UYGULANIYOR', COMPLETED: 'TAMAMLANDI',
            DEGRADED: 'EKSİK/SIZINTILI', PAPER_ONLY: 'KÂĞITTA KALDI'
        };
        const rows = (country.implementationTickets || []).slice(0, 6).map(ticket => {
            const result = ticket.result || {};
            const detail = result.reasonCodes && result.reasonCodes.length
                ? result.reasonCodes.join(' · ')
                : `Gerekli kapasite %${pct(ticket.requiredCapacityBps)} · son ölçüm %${pct(ticket.latestCapacity && ticket.latestCapacity.implementationCapacityBps)}`;
            return `<article class="city-character-row detail-hover" tabindex="0" data-story-tooltip="${storyCityDossierEscape(detail)}"><div>`
                + `<b>${storyCityDossierEscape(ticket.actionType)} · ${storyCityDossierEscape(labels[ticket.status] || ticket.status)}</b>`
                + `<span>İLERLEME %${pct(ticket.progressBps)} · ${storyCityDossierEscape(ticket.complexity)}</span>`
                + `<small>kaynak kaybı riski %${pct(ticket.latestCapacity && ticket.latestCapacity.leakageRiskBps)}</small>`
                + `</div></article>`;
        }).join('');
        tickets = `<h3>UYGULAMA FİŞLERİ</h3>` + (rows
            ? `<div class="city-character-list">${rows}</div>`
            : `<div class="city-dossier-empty"><b>UYGULAMA BEKLEMİYOR</b><span>Şu anda kurumların uygulamasını bekleyen onaylı karar yok.</span></div>`);
    }
    return `<section class="city-dossier-sec"><h3>MEŞRUİYET VE UYGULAMA KAPASİTESİ</h3>`
        + `<div class="city-fact-grid">${grid}</div>${tickets}`
        + `<p class="city-hint">Hukuken onaylanmış karar otomatik olarak dünya sonucu değildir. Düşük kapasite kararı geciktirir; zayıf bütünlük ve bölgesel denetim eksik/sızdırılmış uygulama veya kâğıtta kalma üretir.</p></section>`;
}

function storyCityDossierRenderElections(view) {
    const fact = view.facts.countryElections;
    if (!fact || fact.status === PLAYER_FACT_STATUS.UNKNOWN || !fact.value) {
        return `<section class="city-dossier-empty"><b>SEÇİM KAYDI YOK</b>`
            + `<span>Bu ülkenin seçim takvimi veya iktidar devri hakkında doğrulanmış bilgi bulunmuyor.</span></section>`;
    }
    const value = fact.value;
    const pct = bps => storyCityDossierNumber((Number(bps) || 0) / 100);
    const date = seconds => typeof storyCalendarAt === 'function' && seconds != null
        ? storyCalendarAt(seconds).label : '—';
    const mandate = value.currentMandate || {};
    const mandateName = mandate.officeHolderName
        || (mandate.officeHolder && mandate.officeHolder.name)
        || 'Makam bilgisi yok';
    const mandateGrid = `<div class="city-fact-grid">`
        + `<div><span>YÜRÜTME MANDATI</span><b>${storyCityDossierEscape(mandateName)}</b>`
        + `<small>${storyCityDossierEscape(mandate.officeHolderModel || (mandate.officeHolder && mandate.officeHolder.model) || '')}</small></div>`
        + `<div><span>SEÇİM MODELİ</span><b>${storyCityDossierEscape(value.electionModel || '—')}</b></div>`
        + `<div><span>SONRAKİ SEÇİM</span><b>${value.competitive ? date(value.nextElectionAt) : 'SEÇİM YOK'}</b></div>`
        + `<div><span>KOALİSYON</span><b>${(mandate.coalitionSlateIds || []).length}</b><small>mandat ortağı</small></div></div>`;
    const elections = (value.elections || []).slice(0, 4);
    const rows = elections.map(election => {
        const totals = (election.totals || []).map(row => `<small>${storyCityDossierEscape(row.name || row.slateKey || row.slateId)}: `
            + `${Math.round(Number(row.votes) || 0).toLocaleString('tr-TR')} oy · %${pct(row.voteShareBps)}</small>`).join('');
        const contest = election.contest
            ? `<span>İTİRAZ: ${storyCityDossierEscape(election.contest.resolutionCode || election.contest.reasonCode || 'İnceleniyor')}</span>` : '';
        const internal = view.isOwn && Array.isArray(election.cohortBallots)
            ? `<small>${election.cohortBallots.length} gerçek kohort sayımı · tercih bileşenleri denetlenebilir</small>` : '';
        return `<article class="city-character-row"><div><b>${date(election.scheduledAt)} · ${storyCityDossierEscape(election.status)}</b>`
            + `<span>KATILIM %${pct(election.turnoutBps)} · ${Math.round(Number(election.castVotes) || 0).toLocaleString('tr-TR')} / ${Math.round(Number(election.eligiblePeople) || 0).toLocaleString('tr-TR')}</span>`
            + contest + totals + internal + `</div></article>`;
    }).join('');
    return `<section class="city-dossier-sec"><h3>SEÇİM VE BARIŞÇIL İKTİDAR DEVRİ</h3>${mandateGrid}`
        + (rows ? `<div class="city-character-list">${rows}</div>`
            : `<div class="city-dossier-empty"><b>HENÜZ SEÇİM YOK</b><span>İlk kampanya takvimde bekliyor.</span></div>`)
        + `<p class="city-hint">Oy dağılımı seçmen nüfusu ve toplumsal desteğe göre hesaplanır. Seçim sonucu yönetim makamının meşruiyetini ve karar yetkisini değiştirir.</p></section>`;
}

function storyCityDossierRenderIntegrity(view) {
    const fact = view.facts.countryIntegrity;
    if (!fact || fact.status === PLAYER_FACT_STATUS.UNKNOWN || !fact.value) {
        return `<section class="city-dossier-empty"><b>ETİK VE SORUŞTURMA KAYDI YOK</b>`
            + `<span>Bu ülke hakkında doğrulanmış iddia veya kamusal soruşturma kaydı bulunmuyor.</span></section>`;
    }
    const value = fact.value;
    const pct = bps => storyCityDossierNumber((Number(bps) || 0) / 100);
    const statusLabels = {
        ALLEGATION: 'İDDİA', PRELIMINARY_REVIEW: 'ÖN İNCELEME',
        FORMAL_INVESTIGATION: 'RESMÎ SORUŞTURMA', SUBSTANTIATED: 'KANITLANDI',
        UNSUBSTANTIATED: 'KANITLANAMADI', CLOSED: 'KAPANDI'
    };
    const metrics = `<div class="city-fact-grid">`
        + `<div><span>İDDİA DOSYASI</span><b>${storyCityDossierNumber(value.allegationCount)}</b></div>`
        + `<div><span>AÇIK SORUŞTURMA</span><b>${storyCityDossierNumber(value.openInvestigationCount)}</b></div>`
        + `<div><span>KANITLANAN</span><b>${storyCityDossierNumber(value.substantiatedCount)}</b></div>`
        + (view.isOwn ? `<div><span>KANITLANAMAYAN</span><b>${storyCityDossierNumber(value.unsubstantiatedCount)}</b></div>` : '')
        + `</div>`;
    const rows = (value.cases || []).slice().sort((a, b) => Number(b.openedAt) - Number(a.openedAt)).slice(0, 8).map(row => {
        const evidence = view.isOwn ? (row.evidence || []) : [];
        const evidenceRows = evidence.slice(0, 6).map(item => `<small>${storyCityDossierEscape(item.summaryCode || item.type)} · `
            + `${storyCityDossierEscape(item.direction)} · güven %${pct(item.authenticityBps)} · ilgi %${pct(item.relevanceBps)}`
            + ` · kaynak ${storyCityDossierEscape(item.sourceKind)} / ${storyCityDossierEscape(item.sourceId)}</small>`).join('');
        const internal = view.isOwn
            ? `<span>KANIT SKORU %${pct(row.evidenceScoreBps)} · BAYRAK ${(row.redFlags || []).length}</span>${evidenceRows}`
            : '';
        return `<article class="city-character-row"><div><b>${storyCityDossierEscape(row.kind)} · ${storyCityDossierEscape(statusLabels[row.status] || row.status)}</b>`
            + internal + `</div></article>`;
    }).join('');
    return `<section class="city-dossier-sec"><h3>ETİK, İDDİA VE SORUŞTURMA</h3>${metrics}`
        + (rows ? `<div class="city-character-list">${rows}</div>`
            : `<div class="city-dossier-empty"><b>DOSYA YOK</b><span>Yapısal risk tek başına iddia veya suç üretmez.</span></div>`)
        + `<p class="city-hint">Saptırma riski yalnız yapısal bir göstergedir. İddia suç değildir; resmî soruşturma yetkili yargı kararı ve kaynaklı ön kanıt ister. “Kanıtlandı” sonucu yalnız kanıt eşiği aşıldığında kullanılır.</p></section>`;
}

function storyCityDossierGeneral(view, node) {
    const facts = view.facts;
    let html = `<section class="city-dossier-sec"><h3>ŞEHİR ÖZETİ</h3><div class="city-fact-grid">`
        + `<div><span>SEVİYE</span>${storyCityDossierFactValue(facts.level, storyCityDossierNumber)}</div>`
        + `<div><span>NÜFUS (BİN)</span>${storyCityDossierFactValue(facts.population, storyCityDossierNumber)}</div>`
        + `<div><span>GARNİZON</span>${storyCityDossierFactValue(facts.garrison, storyCityDossierNumber)}</div>`
        + `<div><span>YÖNETİM</span><b>${view.isOwn ? 'DOĞRUDAN' : 'YABANCI'}</b></div>`
        + `</div><p class="city-hint">Bütçe, zenginlik, sanayi, stok, piyasa ve lojistik verileri EKONOMİ paneline taşındı.</p></section>`;
    if (view.isOwn && node) {
        const wallet = (STORY.commander && STORY.commander.res) || { oil: 0, manpower: 0, points: 0 };
        const gar = node.garrison | 0;
        const cap = typeof storyCityGarrisonCap === 'function' ? storyCityGarrisonCap(node) : gar;
        html += `<div class="prod-sec"><div class="prod-head"><span>🛡️ GARNİZON <b>${gar}/${cap}</b></span>`
            + `<button class="city-btn cb-gar" data-node="${node.id}" ${(gar >= cap || (wallet.manpower || 0) < CITY_GARRISON_COST) ? 'disabled' : ''}>+1 (${CITY_GARRISON_COST}👥)</button></div>`
            + `<div class="city-hint">Savunma düellosunda birlik olarak savaşır; kuşatma savunmasını güçlendirir.</div></div>`
            + (typeof prodPoolSection === 'function' ? prodPoolSection(node) : '');
    }
    return html + storyCityDossierMissing(view);
}

function storyEconomyRenderOverview(view) {
    const facts = view.facts;
    let html = '';
    const stateMatch = /^country:(-?\d+)$/.exec(String(view.ownerId || ''));
    const ownerState = stateMatch && typeof storyState === 'function' ? storyState(Number(stateMatch[1])) : null;
    if (view.isOwn && ownerState && typeof storyEconHtml === 'function') html += storyEconHtml(ownerState);
    html += `<section class="city-dossier-sec"><h3>BÖLGESEL EKONOMİ ÖZETİ</h3><div class="city-fact-grid">`
        + `<div><span>ZENGİNLİK</span>${storyCityDossierFactValue(facts.wealth, storyCityDossierNumber)}</div>`
        + `<div><span>FABRİKA</span>${storyCityDossierFactValue(facts.infrastructure, value => storyCityDossierNumber(value && value.factory))}</div>`
        + `<div><span>KIŞLA</span>${storyCityDossierFactValue(facts.infrastructure, value => storyCityDossierNumber(value && value.barracks))}</div>`
        + `<div><span>PETROL YATAĞI</span>${storyCityDossierFactValue(facts.deposits, value => storyCityDossierNumber(value && value.oil))}</div>`
        + `<div><span>ÜRETİM NOKTASI</span>${storyCityDossierFactValue(facts.deposits, value => storyCityDossierNumber(value && value.points))}</div>`
        + `</div></section><section class="city-dossier-sec"><h3>BÖLGESEL STOKLAR</h3>`;
    if (!facts.stocks || facts.stocks.status === PLAYER_FACT_STATUS.UNKNOWN) {
        html += `<div class="city-dossier-empty"><b>STOK İSTİHBARATI YOK</b><span>Yabancı bölgenin kanonik stokları doğrulanmadı.</span></div>`;
    } else {
        const quantities = facts.stocks.value && facts.stocks.value.quantities || {};
        const targets = facts.stocks.value && facts.stocks.value.safeTargets || {};
        const shortages = facts.stocks.value && facts.stocks.value.shortages || [];
        const labels = {
            food: 'GIDA', energy: 'ENERJİ', raw_materials: 'HAMMADDE',
            industrial_parts: 'SANAYİ PARÇASI', electronics: 'ELEKTRONİK',
            military_supplies: 'ASKERÎ MALZEME', labor: 'İŞ GÜCÜ', capital: 'SERMAYE'
        };
        html += `<div class="city-fact-grid">${Object.keys(labels).map(id => (
            `<div><span>${labels[id]}</span><b>${storyCityDossierNumber(quantities[id])}</b>`
            + `<small>Güvenli hedef ${storyCityDossierNumber(targets[id])}</small></div>`
        )).join('')}</div>`
            + `<p class="city-hint">${shortages.length ? `${shortages.length} karşılanmamış talep kaydı var.` : 'Kayıtlı karşılanmamış talep yok.'}</p>`;
    }
    return html + `</section>`;
}

function storyCityDossierRenderLogistics(view) {
    if (!view.isOwn) {
        return `<section class="city-dossier-empty"><b>ALTYAPI İSTİHBARATI YOK</b>`
            + `<span>Yabancı bölgenin kapasite, hasar ve hat durumu oyuncu tarafından doğrulanmadı.</span></section>`;
    }
    if (!view.corridors.length) {
        return `<section class="city-dossier-empty"><b>BAĞLANTI BULUNAMADI</b><span>Doğrulanmış koridor kaydı yok.</span></section>`;
    }
    const trade = view.facts.trade && view.facts.trade.value;
    const shipments = trade
        ? [...(trade.incoming || []), ...(trade.outgoing || [])]
            .filter((item, index, rows) => rows.findIndex(row => row.id === item.id) === index)
        : [];
    const shipmentStatus = value => storyCityDossierLabel(value, STORY_DOSSIER_STATUS_LABELS);
    return `<section class="city-dossier-sec"><h3>AKTİF SİPARİŞ VE SEVKİYATLAR</h3>`
        + (shipments.length
            ? `<div class="city-route-list">${shipments.map(shipment => (
                `<article class="city-route-row ${String(shipment.status || 'held').toLowerCase()}">`
                + `<div><span>${storyCityDossierEscape(storyCityDossierLabel(shipment.resourceId, STORY_DOSSIER_RESOURCE_LABELS))}</span><b>${storyCityDossierNumber(shipment.quantity)}</b></div>`
                + `<div class="city-route-metrics"><span>${storyCityDossierEscape(shipmentStatus(shipment.status))}</span>`
                + `<span>${storyCityDossierEscape(storyCityDossierRegionName(shipment.sourceRegionId))} → ${storyCityDossierEscape(storyCityDossierRegionName(shipment.targetRegionId))}</span>`
                + `<span>ŞİMDİ: ${storyCityDossierEscape(storyCityDossierRegionName(shipment.currentRegionId))}</span>`
                + (shipment.marketQuote && shipment.marketQuote.status === 'INDICATIVE_INDEX_QUOTE'
                    ? `<span>FİYAT ${storyCityDossierNumber(shipment.marketQuote.unitIndex)} / ÖDEME BEKLİYOR</span>`
                    : '')
                + `</div></article>`
            )).join('')}</div>`
            : `<div class="city-dossier-empty"><b>AKTİF YÜK YOK</b><span>Bu bölgeye gelen veya buradan çıkan fiziksel sevkiyat bulunmuyor.</span></div>`)
        + `</section><section class="city-dossier-sec"><h3>ULAŞIM / ENERJİ / VERİ KORİDORLARI</h3><div class="city-route-list">`
        + view.corridors.map(corridor => {
            const meta = STORY_CITY_MODE_META[corridor.mode] || { icon: '·', label: corridor.mode };
            const damage = Math.round(corridor.damageBps / 100);
            return `<article class="city-route-row ${corridor.status.toLowerCase()}">`
                + `<div><span>${meta.icon} ${storyCityDossierEscape(meta.label)}</span><b>${storyCityDossierEscape(corridor.destinationName)}</b></div>`
                + `<div class="city-route-metrics"><span>KAPASİTE ${storyCityDossierNumber(corridor.effectiveCapacity)}</span><span>HASAR %${damage}</span><span>${storyCityDossierEscape(storyCityDossierLabel(corridor.status, STORY_DOSSIER_STATUS_LABELS))}</span></div>`
                + `<button class="city-btn city-route" data-region="${storyCityDossierEscape(corridor.destinationRegionId)}">ROTAYA GİT</button>`
                + `</article>`;
        }).join('') + `</div><p class="city-hint">Ticaret bu kapasiteyi tüketir; dış ticaret bedeli sevkte bütçeden bloke edilir, fiziksel teslimatta satıcıya aktarılır.</p></section>`;
}

function storyCityDossierRenderBudget(view) {
    const fact = view.facts.budget;
    if (!fact || fact.status === PLAYER_FACT_STATUS.UNKNOWN || !fact.value) {
        return `<section class="city-dossier-empty"><b>BÜTÇE VERİSİ DOĞRULANMADI</b>`
            + `<span>Yabancı devletin nakit, borç ve ödeme defteri oyuncuya açık değildir.</span></section>`;
    }
    const budget = fact.value;
    const totals = budget.totals || {};
    const balance = (Number(totals.revenue) || 0) - (Number(totals.expense) || 0);
    const status = storyCityDossierLabel(budget.status, STORY_DOSSIER_STATUS_LABELS);
    return `<section class="city-dossier-sec"><h3>DEVLET BÜTÇESİ</h3><div class="city-fact-grid">`
        + `<div><span>NAKİT</span><b>${storyCityDossierMoney(budget.cash)}</b></div>`
        + `<div><span>TİCARET BLOKESİ</span><b>${storyCityDossierMoney(budget.tradeEscrow)}</b></div>`
        + `<div><span>BORÇ</span><b>${storyCityDossierMoney(budget.debt)}</b><small>tavan ${storyCityDossierNumber(budget.debtCeiling)} devlet kredisi</small></div>`
        + `<div><span>YILLIK FAİZ</span><b>%${storyCityDossierNumber((Number(budget.annualInterestBps) || 0) / 100)}</b></div>`
        + `<div><span>TOPLAM GELİR</span><b>${storyCityDossierMoney(totals.revenue)}</b></div>`
        + `<div><span>TOPLAM GİDER</span><b>${storyCityDossierMoney(totals.expense)}</b></div>`
        + `<div><span>BASILAN PARA</span><b>${storyCityDossierMoney(budget.moneyIssued)}</b></div>`
        + `<div><span>BÜTÇE DENGESİ</span><b>${balance >= 0 ? '+' : ''}${storyCityDossierMoney(balance)}</b></div>`
        + `<div><span>DURUM</span><b>${storyCityDossierEscape(status)}</b><small>${budget.missedPaymentDays ? `${storyCityDossierNumber(budget.missedPaymentDays)} gün gecikme` : 'gecikmiş ödeme yok'}</small></div>`
        + `</div><p class="city-hint">Bütçe değerleri devlet kredisiyle gösterilir; bu kaynak üst çubuktaki komutan puanından ayrıdır. Yeterli nakit veya borçlanma alanı olmayan harcamalar uygulanmaz.</p></section>`;
}

function storyCityDossierRenderCompanies(view) {
    const fact = view.facts.companyEconomy;
    const countryFact = view.facts.countryCompanies;
    if (!fact || fact.status === PLAYER_FACT_STATUS.UNKNOWN || !fact.value) {
        return `<section class="city-dossier-empty"><b>ŞİRKET KAYDI DOĞRULANMADI</b>`
            + `<span>Yabancı şirketlerin nakit, borç, tesis ve yatırım kayıtları istihbarat olmadan açılmaz.</span></section>`;
    }
    const local = fact.value;
    const country = countryFact && countryFact.value;
    const bank = country && country.bank;
    const facilities = Array.isArray(local.facilities) ? local.facilities : [];
    const projects = Array.isArray(local.projects) ? local.projects : [];
    const policyFact = view.facts.economicPolicy;
    const policy = policyFact && policyFact.value;
    const decisions = [];
    if (policy && Array.isArray(policy.decisions)) {
        const seenActors = new Set();
        for (const decision of policy.decisions) {
            const actorKey = `${decision && decision.actorType || ''}:${decision && decision.actorId || ''}`;
            if (seenActors.has(actorKey)) continue;
            seenActors.add(actorKey);
            decisions.push(decision);
            if (decisions.length >= 8) break;
        }
    }
    const rows = facilities.map(facility => {
        const company = facility.company || {};
        const debt = Math.max(0, -(Number(company.accounts && company.accounts['LIABILITY:DEBT']) || 0));
        const cash = Math.max(0, Number(company.accounts && company.accounts['ASSET:CASH']) || 0);
        const stateShare = (company.owners || []).find(owner => owner.ownerType === 'STATE');
        return `<article class="city-route-row ${String(company.status || 'operating').toLowerCase()}">`
            + `<div><span>${storyCityDossierEscape(storyCityDossierLabel(company.sectorId, STORY_DOSSIER_SECTOR_LABELS))}</span><b>${storyCityDossierEscape(company.name)}</b></div>`
            + `<div class="city-route-metrics"><span>${storyCityDossierEscape(storyCityDossierLabel(company.legalStatus, STORY_DOSSIER_STATUS_LABELS))} / ${storyCityDossierEscape(storyCityDossierLabel(company.licenseStatus, STORY_DOSSIER_STATUS_LABELS))}</span>`
            + `<span>NAKİT ${storyCityDossierNumber(cash)} DEVLET KREDİSİ</span><span>BORÇ ${storyCityDossierNumber(debt)} DEVLET KREDİSİ</span>`
            + `<span>KAP. ${storyCityDossierNumber(facility.capacity)}</span>`
            + `<span>DEVLET PAYI %${storyCityDossierNumber((Number(stateShare && stateShare.shareBps) || 0) / 100)}</span></div></article>`;
    }).join('');
    const projectRows = projects.map(project => (
        `<div><span>${storyCityDossierEscape(storyCityDossierLabel(project.sectorId, STORY_DOSSIER_SECTOR_LABELS))}</span><b>${storyCityDossierEscape(storyCityDossierLabel(project.status, STORY_DOSSIER_STATUS_LABELS))}</b>`
        + `<small>${storyCityDossierNumber(project.remainingDays)} gün · +${storyCityDossierNumber(project.capacityIncrease)} kapasite</small></div>`
    )).join('');
    const decisionRows = decisions.map(decision => {
        const selected = decision.selectedAction || 'HOLD';
        const execution = decision.execution || {};
        const outcome = decision.outcome || {};
        const actor = decision.actorType === 'COMPANY'
            ? storyCityDossierLabel(String(decision.actorId || '').split(':').pop(), STORY_DOSSIER_SECTOR_LABELS)
            : (decision.actorType === 'STATE' ? 'DEVLET' : storyCityDossierLabel(decision.actorType, {}));
        const reason = storyCityDossierLabel(execution.code || '', STORY_DOSSIER_REASON_LABELS);
        return `<div><span>${storyCityDossierEscape(actor)}</span>`
            + `<b>${storyCityDossierEscape(storyCityDossierLabel(selected, STORY_DOSSIER_ACTION_LABELS))}</b>`
            + `<small>${storyCityDossierEscape(storyCityDossierLabel(execution.status || 'HELD', STORY_DOSSIER_STATUS_LABELS))}${reason ? ` · ${storyCityDossierEscape(reason)}` : ''}`
            + `${outcome.status && outcome.status !== 'NOT_APPLICABLE' ? ` · ${storyCityDossierEscape(storyCityDossierLabel(outcome.status, STORY_DOSSIER_STATUS_LABELS))}` : ''}</small></div>`;
    }).join('');
    return `<section class="city-dossier-sec"><h3>TESİS SAHİPLİĞİ VE ŞİRKETLER</h3>`
        + (rows ? `<div class="city-route-list">${rows}</div>` : `<div class="city-dossier-empty"><b>KAYITLI TESİS YOK</b><span>Bu bölgede çalışan sektör kapasitesi bulunmuyor.</span></div>`)
        + `</section><section class="city-dossier-sec"><h3>YATIRIM PROJELERİ</h3>`
        + (projectRows ? `<div class="city-fact-grid">${projectRows}</div>` : `<div class="city-hint">İnşa hâlinde veya tamamlanmış kayıtlı kapasite yatırımı yok.</div>`)
        + `</section><section class="city-dossier-sec"><h3>EKONOMİK KARAR GEREKÇELERİ</h3>`
        + (decisionRows ? `<div class="city-fact-grid">${decisionRows}</div>`
            : `<div class="city-hint">Henüz uygulanmış veya bekletilmiş kayıtlı ekonomik karar yok.</div>`)
        + `</section><section class="city-dossier-sec"><h3>YEREL BANKA</h3>`
        + (bank ? `<div class="city-fact-grid"><div><span>BANKA</span><b>${storyCityDossierEscape(bank.name)}</b></div>`
            + `<div><span>REZERV</span><b>${storyCityDossierMoney(bank.reserves)}</b></div>`
            + `<div><span>KREDİLER</span><b>${storyCityDossierMoney(bank.loansReceivable)}</b></div>`
            + `<div><span>DURUM</span><b>${storyCityDossierEscape(storyCityDossierLabel(bank.status, STORY_DOSSIER_STATUS_LABELS))}</b></div></div>`
            : `<div class="city-hint">Doğrulanmış banka kaydı yok.</div>`)
        + `<p class="city-hint">Şirket kasası devlet bütçesi değildir. Üretim gideri şirket nakdinden, kredi banka rezervinden, kapasite artışı fiziksel parça ve tamamlanma süresinden geçer.</p></section>`;
}

function storyCityDossierRenderMarket(view) {
    const fact = view.facts.market;
    if (!fact || fact.status === PLAYER_FACT_STATUS.UNKNOWN || !fact.value) {
        return `<section class="city-dossier-empty"><b>PİYASA VERİSİ DOĞRULANMADI</b>`
            + `<span>Bu bölgenin stok, talep ve lojistik riskinden türetilmiş fiyat defteri oyuncuya açık değil.</span></section>`;
    }
    const market = fact.value;
    const labels = STORY_DOSSIER_RESOURCE_LABELS;
    const rows = Object.keys(labels).map(resourceId => {
        const resource = market.resources && market.resources[resourceId];
        if (!resource) return '';
        if (resource.status === 'DEFERRED') {
            return `<div><span>${labels[resourceId]}</span><b>VERİ YOK</b><small>ayrı bir bölgesel fiyat oluşmuyor</small></div>`;
        }
        if (resource.status === 'NUMERAIRE') {
            return `<div><span>${labels[resourceId]}</span><b>1,00</b><small>hesaplama için sabit referans</small></div>`;
        }
        const change = Number(resource.lastChangeBps) || 0;
        const direction = change > 0 ? '+' : '';
        const stockRatio = resource.signals ? Number(resource.signals.stockCoverageRatio) : null;
        const stockDays = resource.signals && resource.signals.stockCoverageDays != null
            ? Number(resource.signals.stockCoverageDays)
            : null;
        return `<div><span>${labels[resourceId]}</span><b>${storyCityDossierNumber(resource.priceIndex)}</b>`
            + `<small>${storyCityDossierEscape(resource.band)} · ${direction}${storyCityDossierNumber(change / 100)}%`
            + `${Number.isFinite(stockRatio) ? ` · stok/hedef ${storyCityDossierNumber(stockRatio)}` : ''}`
            + `${Number.isFinite(stockDays) ? ` · ${storyCityDossierNumber(stockDays)} gün` : ''}</small></div>`;
    }).join('');
    return `<section class="city-dossier-sec"><h3>BÖLGESEL FİYAT ENDEKSLERİ</h3>`
        + `<div class="city-fact-grid">${rows}</div>`
        + `<p class="city-hint">Baz endeks 100'dür. Hane sepeti: <b>${storyCityDossierNumber(market.householdCpi)}</b>; üretici endeksi: <b>${storyCityDossierNumber(market.producerPriceIndex)}</b>. Dış ticaret ödemesi sevk anındaki endeksle kilitlenir.</p></section>`;
}

function storyCityDossierRenderHistory(view) {
    if (!view.history.length) {
        return `<section class="city-dossier-empty"><b>DOĞRULANMIŞ YAKIN OLAY YOK</b>`
            + `<span>Şehir kayıtlarında yakın döneme ait doğrulanmış önemli bir değişiklik bulunmuyor.</span></section>`;
    }
    return `<section class="city-dossier-sec"><h3>SON DOĞRULANMIŞ DEĞİŞİKLİKLER</h3><div class="city-history-list">`
        + view.history.map(item => {
            const detail = item.causeSteps.length
                ? `NEDEN DEĞİŞTİ?\n${item.causeSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`
                : 'Bu olay için oyuncunun doğrulayabildiği ayrıntılı neden zinciri yok.';
            return `<div class="city-history-row detail-hover" tabindex="0" data-story-tooltip="${storyCityDossierEscape(detail)}">`
            + `<span>${storyCityDossierEscape(item.domain.toLocaleUpperCase('tr'))}</span>`
            + `<b>${storyCityDossierEscape(item.badgeText)}</b>`
            + `<em>${Math.max(0, Math.round(view.generatedAt - item.observedAt))} sn önce</em></div>`;
        }).join('')
        + `</div></section>`;
}

function storyCityDossierRenderCharacters(view) {
    if (!view.isOwn) {
        return `<section class="city-dossier-empty"><b>KARAKTER KONUMLARI BİLİNMİYOR</b>`
            + `<span>Kamuya açık kimlik, doğrulanmış şehir konumu demek değildir.</span></section>`;
    }
    if (!view.characters.length) {
        return `<section class="city-dossier-empty"><b>DOĞRULANMIŞ KARAKTER YOK</b>`
            + `<span>Bu şehirde kendi komuta kayıtlarında görünen bir karakter bulunmuyor.</span></section>`;
    }
    const roleLabels = { COMMANDER: 'KOMUTAN', PRESIDENT: 'CUMHURBAŞKANI', MINISTER: 'BAKAN', MAYOR: 'BELEDİYE BAŞKANI', EXECUTIVE: 'YÖNETİCİ' };
    return `<section class="city-dossier-sec"><h3>ŞEHİRDEKİ KARAKTERLER</h3><div class="city-character-list">`
        + view.characters.map(character => {
            const skills = character.skills && character.skills.value || {};
            const loyalty = character.loyalty && Number(character.loyalty.value);
            return `<article class="city-character-row"><div class="city-character-main">`
                + `<b>${storyCityDossierEscape(character.name.value)}</b>`
                + `<span>${storyCityDossierEscape(roleLabels[character.role.value] || character.role.value)}`
                + `${Number.isFinite(loyalty) ? ` · SADAKAT ${Math.round(loyalty)}` : ''}</span>`
                + `<div class="city-character-skills"><i>SAVAŞ ${Math.max(0, Number(skills.warrior) || 0)}</i>`
                + `<i>DİPLOMASİ ${Math.max(0, Number(skills.diplomat) || 0)}</i>`
                + `<i>İKTİSAT ${Math.max(0, Number(skills.economist) || 0)}</i></div></div>`
                + `<button class="city-btn city-character" data-character="${storyCityDossierEscape(character.id)}">GÖRÜŞMEYİ AÇ</button></article>`;
        }).join('')
        + `</div><p class="city-hint">Görüşme, karakterin görevi ve bulunduğu şehir bağlamıyla açılır. Bekleyen gündemler sohbet merkezinde gösterilir.</p></section>`;
}

function storyCityDossierRenderCollective(view) {
    const fact = view.facts.collectiveAction;
    if (!fact || fact.status === PLAYER_FACT_STATUS.UNKNOWN || !fact.value) return '';
    const value = fact.value;
    const rows = Array.isArray(value.participations) ? value.participations : [];
    const problemLabels = {
        food: 'Gıda erişimi', energy: 'Enerji erişimi', income: 'Gelir güvencesi',
        employment: 'İşsizlik', security: 'Fiziksel güvenlik', publicServices: 'Kamu hizmetleri'
    };
    const stageLabels = { NONE: 'ÖRGÜTLENME', PROTEST: 'PROTESTO', STRIKE: 'GREV', UPRISING: 'AYAKLANMA' };
    const visible = view.isOwn ? rows : rows.filter(row => row.stage !== 'NONE');
    return `<section class="city-dossier-sec"><h3>TOPLUMSAL EYLEMLER</h3>`
        + (visible.length
            ? `<div class="city-character-list">${visible.slice(0, 4).map(row => `<article class="city-character-row"><div>`
                + `<b>${storyCityDossierEscape(stageLabels[row.stage] || row.stage)} · ${storyCityDossierEscape(problemLabels[row.problemType] || row.problemType)}</b>`
                + `<span>SORUMLU GÖRÜLEN: ${storyCityDossierEscape(typeof storyOpinionActorLabel === 'function' ? storyOpinionActorLabel(row.blamedActorId) : row.blamedActorId)}</span>`
                + (view.isOwn ? `<small>Yerel şiddet %${storyCityDossierNumber(row.localSeverityBps / 100)} · seferberlik %${storyCityDossierNumber(row.mobilizationBps / 100)} · radikalleşme %${storyCityDossierNumber(row.radicalizationBps / 100)}</small>` : '<small>Kamuya açık eylem; örgütlenme gücü ve radikalleşme bilinmiyor.</small>')
                + `</div></article>`).join('')}</div>`
            : `<div class="city-dossier-empty"><b>AKTİF KAMUSAL EYLEM YOK</b><span>${view.isOwn ? 'Şikâyetler henüz kalıcı seferberlik eşiğini aşmadı.' : 'Bu bölgede kamuya yansımış protesto, grev veya ayaklanma gözlenmedi.'}</span></div>`)
        + `<p class="city-hint">Protesto riski; şikâyetin süresi, tekrarı, etkilediği nüfus ve örgütlenme gücü birlikte yükseldiğinde artar. Yabancı ülkelerde yalnız doğrulanmış kamusal hareketler görünür.</p></section>`;
}

function storyCityDossierRenderMigration(view) {
    const fact = view.facts.humanMigration;
    if (!fact || fact.status === PLAYER_FACT_STATUS.UNKNOWN || !fact.value) return '';
    const value = fact.value;
    const flows = Array.isArray(value.recentFlows) ? value.recentFlows : [];
    const kindLabels = {
        INTERNAL_MIGRATION: 'İÇ GÖÇ',
        CROSS_BORDER_MIGRATION: 'SINIR ÖTESİ GÖÇ',
        REFUGEE: 'MÜLTECİ AKIŞI'
    };
    const causeLabels = {
        SECURITY: 'Güvenlik', UPRISING: 'Ayaklanma', EMPLOYMENT: 'İstihdam', WELLBEING: 'Yaşam koşulu'
    };
    return `<section class="city-dossier-sec"><h3>GÖÇ VE MÜLTECİ AKIŞI</h3><div class="city-fact-grid">`
        + `<div><span>GELEN</span><b>${Math.round(Number(value.incomingPeople) || 0).toLocaleString('tr-TR')}</b><small>tamamlanan akış</small></div>`
        + `<div><span>GİDEN</span><b>${Math.round(Number(value.outgoingPeople) || 0).toLocaleString('tr-TR')}</b><small>tamamlanan akış</small></div>`
        + `<div><span>MÜLTECİ GİRİŞİ</span><b>${Math.round(Number(value.refugeeInPeople) || 0).toLocaleString('tr-TR')}</b></div>`
        + `<div><span>MÜLTECİ ÇIKIŞI</span><b>${Math.round(Number(value.refugeeOutPeople) || 0).toLocaleString('tr-TR')}</b></div>`
        + (view.isOwn ? `<div><span>YOLDA GELEN</span><b>${Math.round(Number(value.activeInboundPeople) || 0).toLocaleString('tr-TR')}</b></div>`
            + `<div><span>YOLDA GİDEN</span><b>${Math.round(Number(value.activeOutboundPeople) || 0).toLocaleString('tr-TR')}</b></div>`
            + `<div><span>KABUL KAPASİTESİ</span><b>${Math.round(Number(value.receptionCapacityPeople) || 0).toLocaleString('tr-TR')}</b><small>mevcut hizmet ve altyapı kapasitesi</small></div>` : '')
        + `</div>`
        + (flows.length ? `<div class="city-character-list">${flows.slice(-6).reverse().map(flow => `<article class="city-character-row"><div>`
            + `<b>${storyCityDossierEscape(kindLabels[flow.kind] || flow.kind)} · ${Math.round(Number(flow.people) || 0).toLocaleString('tr-TR')} kişi</b>`
            + `<span>${storyCityDossierEscape(causeLabels[flow.cause] || flow.cause)} · ${storyCityDossierEscape(flow.originRegionId)} → ${storyCityDossierEscape(flow.destinationRegionId)}</span>`
            + (view.isOwn
                ? `<small>${storyCityDossierEscape(flow.status)} · ${Math.max(0, (flow.route && flow.route.corridorIds || []).length)} koridor</small>`
                : '<small>Kamuya açık tamamlanmış akış; kohort ve rota ayrıntısı gizli.</small>')
            + `</div></article>`).join('')}</div>`
            : `<div class="city-dossier-empty"><b>KAYITLI GÖÇ AKIŞI YOK</b><span>Bu bölge için tamamlanmış veya yolda bir nüfus hareketi bulunmuyor.</span></div>`)
        + `<p class="city-hint">Göç; güvenlik ve yaşam baskısına, ulaşılabilir kara-deniz rotalarına, koridor kapasitesine ve hedef bölgenin kabul gücüne bağlıdır.</p></section>`;
}

function storyCityDossierRenderPopulation(view) {
    const fact = view.facts.populationCohorts;
    if (!fact || fact.status === PLAYER_FACT_STATUS.UNKNOWN || !Array.isArray(fact.value)) {
        return `<section class="city-dossier-empty"><b>NÜFUS SAYIMI DOĞRULANMADI</b>`
            + `<span>Yabancı bölgenin yaş, gelir, meslek, eğitim ve kimlik dağılımı istihbarat olmadan gösterilmez.</span></section>`
            + storyCityDossierRenderCollective(view)
            + storyCityDossierRenderMigration(view);
    }
    const rows = fact.value;
    const total = rows.reduce((sum, row) => sum + (Number(row.membersPeople) || 0), 0);
    const dimensions = [
        ['ageBand', 'YAŞ', { CHILD: 'Çocuk', YOUNG: 'Genç', ADULT: 'Yetişkin', SENIOR: 'Yaşlı' }],
        ['occupation', 'MESLEK', { DEPENDENT: 'Bağımlı', STUDENT: 'Öğrenci', AGRICULTURE: 'Tarım', INDUSTRY: 'Sanayi', SERVICES: 'Hizmet', PUBLIC: 'Kamu', DEFENSE: 'Savunma', UNEMPLOYED: 'İşsiz', RETIRED: 'Emekli' }],
        ['incomeBand', 'GELİR', { DEPENDENT: 'Bağımlı', LOW: 'Düşük', LOWER_MIDDLE: 'Alt orta', MIDDLE: 'Orta', UPPER_MIDDLE: 'Üst orta' }],
        ['education', 'EĞİTİM', { BASIC: 'Temel', PRIMARY: 'İlköğretim', SECONDARY: 'Ortaöğretim', TERTIARY: 'Yükseköğretim' }],
        ['identity', 'KİMLİK YÖNELİMİ', { LOCAL: 'Yerel', NATIONAL: 'Ulusal', COSMOPOLITAN: 'Kozmopolit' }]
    ];
    const sections = dimensions.map(([field, title, labels]) => {
        const totals = {};
        for (const row of rows) totals[row[field]] = (totals[row[field]] || 0) + (Number(row.membersPeople) || 0);
        const cards = Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([key, value]) => {
            const percent = total > 0 ? value / total * 100 : 0;
            return `<div><span>${storyCityDossierEscape(labels[key] || key)}</span><b>%${storyCityDossierNumber(percent)}</b>`
                + `<small>${Math.round(value).toLocaleString('tr-TR')} kişi</small></div>`;
        }).join('');
        return `<section class="city-dossier-sec"><h3>${title}</h3><div class="city-fact-grid">${cards}</div></section>`;
    }).join('');
    const labor = typeof storyPopulationLaborSupply === 'function'
        ? storyPopulationLaborSupply(view.regionId, 1)
        : null;
    const needsFact = view.facts.needsWelfare;
    const needs = needsFact && needsFact.status === PLAYER_FACT_STATUS.VERIFIED
        ? needsFact.value
        : null;
    const conditions = needs ? `<section class="city-dossier-sec"><h3>YAŞAM KOŞULLARI</h3><div class="city-fact-grid">`
        + `<div><span>GIDA ERİŞİMİ</span><b>%${storyCityDossierNumber(needs.foodAccessBps / 100)}</b></div>`
        + `<div><span>ENERJİ ERİŞİMİ</span><b>%${storyCityDossierNumber(needs.energyAccessBps / 100)}</b></div>`
        + `<div><span>GELİR GÜVENLİĞİ</span><b>%${storyCityDossierNumber(needs.incomeSecurityBps / 100)}</b><small>ücret değil, istihdam vekili · düzenli işe erişim</small></div>`
        + `<div><span>İŞSİZLİK RİSKİ</span><b>%${storyCityDossierNumber(needs.unemploymentRiskBps / 100)}</b></div>`
        + `<div><span>FİZİKSEL GÜVENLİK</span><b>%${storyCityDossierNumber(needs.securityBps / 100)}</b></div>`
        + `<div><span>KAMU HİZMETİ</span><b>%${storyCityDossierNumber(needs.publicServicesBps / 100)}</b></div>`
        + `<div><span>TOPLAM YAŞAM KOŞULU</span><b>%${storyCityDossierNumber(needs.wellbeingBps / 100)}</b></div>`
        + `</div><p class="city-hint">Aynı kaynak şoku bütün toplumu eşit etkilemez; aşağıdaki kohortların ihtiyaç ağırlıkları farklıdır. Bu anlık sonuçlar şikâyet hafızasına kaynak olur, fakat geçmiş tepkiyi tek başına silmez.</p></section>` : '';
    const opinionFact = view.facts.publicOpinion;
    const opinion = opinionFact && opinionFact.status === PLAYER_FACT_STATUS.VERIFIED
        ? opinionFact.value
        : null;
    const problemLabels = {
        food: 'Gıda erişimi', energy: 'Enerji erişimi', income: 'Gelir güvencesi',
        employment: 'İşsizlik', security: 'Fiziksel güvenlik', publicServices: 'Kamu hizmetleri'
    };
    const complaints = opinion ? `<section class="city-dossier-sec"><h3>BİRİKEN ŞİKÂYETLER</h3>`
        + `<div class="city-fact-grid"><div><span>TOPLUMSAL HAFIZA</span><b>%${storyCityDossierNumber(opinion.rememberedSeverityBps / 100)}</b>`
        + `<small>${opinion.affectedCohortCount}/${opinion.cohortCount} kohort etkileniyor</small></div></div>`
        + ((opinion.topIssues || []).length
            ? `<div class="city-character-list">${opinion.topIssues.slice(0, 4).map(issue => `<article class="city-character-row"><div>`
                + `<b>${storyCityDossierEscape(problemLabels[issue.problemType] || issue.problemType)} · %${storyCityDossierNumber(issue.severityBps / 100)}</b>`
                + `<span>SORUMLU GÖRÜLEN: ${storyCityDossierEscape(typeof storyOpinionActorLabel === 'function' ? storyOpinionActorLabel(issue.blamedActorId) : issue.blamedActorId)}</span>`
                + `<small>${Math.round(issue.affectedPeople).toLocaleString('tr-TR')} kişi · ${issue.activeCohortCount} aktif / ${issue.recoveringCohortCount} iyileşen kohort</small>`
                + `</div></article>`).join('')}</div>`
            : `<div class="city-dossier-empty"><b>BİRİKMİŞ ŞİKÂYET YOK</b><span>Anlık baskı hafıza eşiğini aşmadı veya tamamen unutuldu.</span></div>`)
        + `<p class="city-hint">Sorumlu görülen taraf, halkın mevcut bilgi ve deneyimine dayanan algısını gösterir; kesinleşmiş bir mahkeme hükmü değildir.</p></section>` : '';
    return `<section class="city-dossier-sec"><h3>NÜFUS SAYIMI</h3><div class="city-fact-grid">`
        + `<div><span>TOPLAM</span><b>${Math.round(total).toLocaleString('tr-TR')}</b><small>tam kişi uzlaştırması</small></div>`
        + `<div><span>ÇALIŞMA ÇAĞINDAKİ NÜFUS</span><b>${labor ? Math.round(labor.workingAgePeople).toLocaleString('tr-TR') : '—'}</b></div>`
        + `<div><span>KULLANILABİLİR ÇALIŞAN</span><b>${labor ? Math.round(labor.availableWorkersPeople).toLocaleString('tr-TR') : '—'}</b><small>üretime katılabilecek iş gücü havuzu</small></div>`
        + `</div><p class="city-hint">Çalışabilir ve kullanılabilir nüfus, bölgesel üretimin iş gücü kapasitesini doğrudan belirler.</p></section>${conditions}${complaints}${storyCityDossierRenderCollective(view)}${storyCityDossierRenderMigration(view)}${sections}`;
}

function storyCityDossierRender(view, active, node) {
    if (view.disabled) return '<div class="city-hint">Şehir dosyası bu seferde kullanılamıyor.</div>';
    let content = '';
    if (active === 'nufus') content = storyCityDossierRenderPopulation(view);
    else if (active === 'kurumlar') content = storyCityDossierRenderInstitutions(view)
        + storyCityDossierRenderStateCapacity(view)
        + storyCityDossierRenderIntegrity(view)
        + storyCityDossierRenderElections(view)
        + storyCityDossierRenderPowerCenters(view);
    else if (active === 'tarih') content = storyCityDossierRenderHistory(view);
    else if (active === 'karakterler') content = storyCityDossierRenderCharacters(view);
    else if (active === 'binalar' && view.isOwn && node) {
        const wallet = (STORY.commander && STORY.commander.res) || { oil: 0, manpower: 0, points: 0 };
        content = prodBuildingSection(node, 'fac', wallet, true)
            + prodBuildingSection(node, 'bar', wallet, true)
            + `<div class="city-hint">Bina seviyesi şehir seviyesini en fazla 1 aşar.</div>`;
    } else if (active === 'ordu' && view.isOwn && node) {
        const wallet = (STORY.commander && STORY.commander.res) || { oil: 0, manpower: 0, points: 0 };
        content = prodBuildingSection(node, 'fac', wallet, false)
            + prodBuildingSection(node, 'bar', wallet, false)
            + prodQueueSection(node);
    } else content = storyCityDossierGeneral(view, node);
    return storyCityDossierHeader(view, active) + content;
}

function storyEconomyTabs(active) {
    const tabs = [
        ['genel', 'ÖZET'], ['butce', 'BÜTÇE'], ['sirketler', 'ŞİRKETLER'],
        ['piyasa', 'PİYASA'], ['lojistik', 'LOJİSTİK'], ['fraksiyonlar', 'FRAKSİYONLAR']
    ];
    return `<div class="city-dossier-tabs economy-tabs" role="tablist" aria-label="Ekonomi bölümleri">`
        + tabs.map(([id, label]) => `<button class="economy-sub${active === id ? ' active' : ''}" data-sub="${id}" role="tab" aria-selected="${active === id ? 'true' : 'false'}">${label}</button>`).join('')
        + `</div>`;
}

function storyEconomyRender(view, active) {
    let content = '';
    if (active === 'butce') content = storyCityDossierRenderBudget(view);
    else if (active === 'sirketler') content = storyCityDossierRenderCompanies(view);
    else if (active === 'piyasa') content = storyCityDossierRenderMarket(view);
    else if (active === 'lojistik') content = storyCityDossierRenderLogistics(view);
    else if (active === 'fraksiyonlar') {
        const match = /^country:(-?\d+)$/.exec(String(view.ownerId || ''));
        const ownerState = match && typeof storyState === 'function' ? storyState(Number(match[1])) : null;
        content = view.facts.countryPowerCenters && view.facts.countryPowerCenters.value
            ? storyCityDossierRenderPowerCenters(view)
            : (view.isOwn && ownerState && typeof storyFacHtml === 'function'
                ? storyFacHtml(ownerState)
                : `<section class="city-dossier-empty"><b>TOPLUMSAL DENGE DOĞRULANMADI</b><span>Yabancı devletin fraksiyon bağlılıkları açık bilgi değildir.</span></section>`);
    } else content = storyEconomyRenderOverview(view);
    return `<section class="city-dossier-head economy-dossier-head">`
        + `<div class="city-dossier-kicker">${view.isOwn ? 'ULUSAL VE BÖLGESEL DEFTER' : 'KAMUYA AÇIK EKONOMİK GÖRÜNÜM'}</div>`
        + `<div class="city-dossier-name">${storyCityDossierEscape(view.facts.name.value)}</div>`
        + `<div class="city-dossier-source">${storyCityDossierEscape(view.ownerName)} · ${view.isOwn ? 'DOĞRULANMIŞ KAYIT' : 'SINIRLI İSTİHBARAT'}</div>`
        + `</section>${storyEconomyTabs(active)}${content}`;
}

function storyEconomyUpdate() {
    if (!STORY._economyOpen) return;
    const body = document.getElementById('economy-body');
    if (!body) return;
    const node = typeof storyCityFocus === 'function' ? storyCityFocus() : null;
    const title = document.getElementById('economy-title');
    if (!node) {
        if (title) title.textContent = 'EKONOMİ';
        body.innerHTML = '<div class="city-dossier-empty"><b>BÖLGE SEÇİLMEDİ</b><span>Haritadan bir şehir seç.</span></div>';
        return;
    }
    try {
        const view = storyCityDossierBuild(node.id);
        const active = STORY_ECONOMY_TABS.includes(STORY._economySub) ? STORY._economySub : 'genel';
        STORY._economySub = active;
        STORY._economyView = view;
        if (title) title.textContent = `EKONOMİ / ${String(view.facts.name.value).toLocaleUpperCase('tr')}`;
        body.innerHTML = storyEconomyRender(view, active);
        if (typeof storyActivateDetailTooltips === 'function') storyActivateDetailTooltips(body);
    } catch (error) {
        body.innerHTML = `<div class="city-dossier-empty"><b>EKONOMİ DOSYASI OLUŞTURULAMADI</b><span>${storyCityDossierEscape(error && error.message || error)}</span></div>`;
    }
}

function storyCityDossierUpdate() {
    if (!STORY._cityOpen) return;
    const body = document.getElementById('city-body');
    if (!body) return;
    const node = typeof storyCityFocus === 'function' ? storyCityFocus() : null;
    const title = document.getElementById('city-title');
    if (!node) {
        if (title) title.textContent = 'ŞEHİR DOSYASI';
        body.innerHTML = '<div class="city-dossier-empty"><b>ŞEHİR SEÇİLMEDİ</b><span>Haritadan bir şehir seç.</span></div>';
        return;
    }
    let view;
    try {
        view = storyCityDossierBuild(node.id);
    } catch (error) {
        body.innerHTML = `<div class="city-dossier-empty"><b>DOSYA OLUŞTURULAMADI</b><span>${storyCityDossierEscape(error && error.message || error)}</span></div>`;
        return;
    }
    if (title) title.textContent = `${String(view.facts.name.value).toLocaleUpperCase('tr')} / DOSYA`;
    let active = STORY_CITY_DOSSIER_TABS.includes(STORY._citySub) ? STORY._citySub : 'genel';
    if (!view.isOwn && (active === 'binalar' || active === 'ordu')) active = 'genel';
    STORY._citySub = active;
    STORY._cityDossierView = view;
    body.innerHTML = storyCityDossierRender(view, active, node);
    if (typeof storyActivateDetailTooltips === 'function') storyActivateDetailTooltips(body);
}

function storyCityDossierOpenRegion(regionId) {
    const legacyId = storyCityDossierLegacyId(regionId);
    const node = legacyId == null ? null : storyNode(legacyId);
    if (!node) return false;
    STORY.selectedNodeId = node.id;
    STORY._citySub = 'genel';
    if (typeof storyCamCenterOn === 'function') storyCamCenterOn(node);
    storyCityDossierUpdate();
    return true;
}

function storyCityDossierOpenEvent(changeId) {
    return !!String(changeId || '');
}

function storyCityDossierOpenCharacter(characterId) {
    const view = STORY._cityDossierView;
    const character = view && (view.characters || []).find(candidate => candidate.id === String(characterId));
    if (!character) return false;
    STORY._talkFocusCharacterId = character.id;
    STORY._talkFocusCharacterName = character.name.value;
    STORY._talkFocusRegionId = view.regionId;
    if (typeof storyTalkOpen === 'function') {
        storyTalkOpen();
        return true;
    }
    return false;
}
