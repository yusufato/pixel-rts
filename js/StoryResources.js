// ============================================================================
//  HİKÂYE KAYNAK TAKSONOMİSİ — Faz 15
//  --------------------------------------------------------------------------
//  Bu dosya üretim veya tüketim çalıştırmaz. Sekiz ekonomik kaynağın anlamını,
//  birimini, üretici/tüketici sınıflarını ve yokluk sonucunu sürümlü bir
//  sözleşmeye bağlar. Faz 16–20 bu kimlikleri kullanacaktır.
//
//  Mevcut oil/manpower/points sayaçları sessizce yeni stoklara çevrilmez.
//  Yalnız üç açık LEGACY_ALIAS yayımlanır; diğer beş kaynak gerçek stok sistemi
//  gelene kadar null/UNAVAILABLE kalır.
// ============================================================================

const STORY_RESOURCE_SCHEMA_VERSION = 1;
const STORY_RESOURCE_CATALOG_VERSION = 1;
const STORY_RESOURCE_ADAPTER_VERSION = 'story-resource-taxonomy-1';
const STORY_RESOURCE_LEGACY_ADAPTER_VERSION = 'legacy-resource-alias-1';
const STORY_RESOURCE_IDS = Object.freeze([
    'food',
    'energy',
    'raw_materials',
    'industrial_parts',
    'electronics',
    'military_supplies',
    'labor',
    'capital'
]);

const STORY_RESOURCE_DEFINITIONS = Object.freeze([
    {
        id: 'food',
        label: 'Gıda',
        category: 'PHYSICAL',
        unit: { id: 'food_ton', label: 'gıda eşdeğeri ton', symbol: 't-gıda', precision: 3 },
        producers: ['AGRICULTURE', 'FOOD_PROCESSING'],
        consumers: ['HOUSEHOLDS', 'MILITARY', 'FOOD_PROCESSING'],
        storage: { storable: true, perishable: true, decayModel: 'SHELF_LIFE', shelfLifeDays: 180 },
        transportModes: ['LAND', 'SEA'],
        shortageEffects: [
            { id: 'HOUSEHOLD_NEED_UNMET', activationPhase: 17 },
            { id: 'WELFARE_PRESSURE', activationPhase: 17 },
            { id: 'MILITARY_SUPPLY_PENALTY', activationPhase: 48 }
        ]
    },
    {
        id: 'energy',
        label: 'Enerji',
        category: 'NETWORK',
        unit: { id: 'megawatt_hour', label: 'megavat-saat', symbol: 'MWh', precision: 3 },
        producers: ['ENERGY'],
        consumers: ['HOUSEHOLDS', 'CIVIL_INDUSTRY', 'ADVANCED_TECH', 'DEFENSE_INDUSTRY', 'INFRASTRUCTURE'],
        storage: { storable: true, perishable: false, decayModel: 'BUFFER_LOSS', shelfLifeDays: null },
        transportModes: ['ENERGY_GRID'],
        shortageEffects: [
            { id: 'PRODUCTION_CURTAILMENT', activationPhase: 16 },
            { id: 'INFRASTRUCTURE_OUTAGE', activationPhase: 17 },
            { id: 'PRICE_PRESSURE', activationPhase: 19 }
        ]
    },
    {
        id: 'raw_materials',
        label: 'Maden ve Hammadde',
        category: 'PHYSICAL',
        unit: { id: 'material_ton', label: 'hammadde tonu', symbol: 't-ham', precision: 3 },
        producers: ['EXTRACTION'],
        consumers: ['CIVIL_INDUSTRY', 'ADVANCED_TECH', 'DEFENSE_INDUSTRY'],
        storage: { storable: true, perishable: false, decayModel: 'NONE', shelfLifeDays: null },
        transportModes: ['LAND', 'SEA'],
        shortageEffects: [
            { id: 'INDUSTRIAL_INPUT_BLOCKED', activationPhase: 16 },
            { id: 'CONSTRUCTION_DELAY', activationPhase: 24 }
        ]
    },
    {
        id: 'industrial_parts',
        label: 'Sanayi Parçası',
        category: 'PHYSICAL',
        unit: { id: 'parts_lot', label: 'standart parça lotu', symbol: 'lot-parça', precision: 3 },
        producers: ['CIVIL_INDUSTRY'],
        consumers: ['ENERGY', 'CIVIL_INDUSTRY', 'ADVANCED_TECH', 'DEFENSE_INDUSTRY', 'INFRASTRUCTURE'],
        storage: { storable: true, perishable: false, decayModel: 'OBSOLESCENCE', shelfLifeDays: null },
        transportModes: ['LAND', 'SEA'],
        shortageEffects: [
            { id: 'MAINTENANCE_BACKLOG', activationPhase: 16 },
            { id: 'CAPACITY_DEGRADATION', activationPhase: 16 }
        ]
    },
    {
        id: 'electronics',
        label: 'Elektronik',
        category: 'PHYSICAL',
        unit: { id: 'electronics_lot', label: 'elektronik lotu', symbol: 'lot-elek', precision: 3 },
        producers: ['ADVANCED_TECH'],
        consumers: ['ADVANCED_TECH', 'DEFENSE_INDUSTRY', 'INFRASTRUCTURE', 'MILITARY'],
        storage: { storable: true, perishable: false, decayModel: 'OBSOLESCENCE', shelfLifeDays: null },
        transportModes: ['LAND', 'SEA'],
        shortageEffects: [
            { id: 'ADVANCED_OUTPUT_BLOCKED', activationPhase: 16 },
            { id: 'COMMAND_SYSTEM_PENALTY', activationPhase: 48 }
        ]
    },
    {
        id: 'military_supplies',
        label: 'Askerî Malzeme',
        category: 'PHYSICAL',
        unit: { id: 'supply_ton', label: 'askerî ikmal tonu', symbol: 't-ikmal', precision: 3 },
        producers: ['DEFENSE_INDUSTRY'],
        consumers: ['MILITARY', 'SECURITY_FORCES'],
        storage: { storable: true, perishable: false, decayModel: 'READINESS_LOSS', shelfLifeDays: null },
        transportModes: ['LAND', 'SEA'],
        shortageEffects: [
            { id: 'REPLENISHMENT_BLOCKED', activationPhase: 48 },
            { id: 'COMBAT_READINESS_LOSS', activationPhase: 48 }
        ]
    },
    {
        id: 'labor',
        label: 'İnsan Gücü',
        category: 'SERVICE',
        unit: { id: 'worker_day', label: 'işçi-gün', symbol: 'işçi-gün', precision: 3 },
        producers: ['HOUSEHOLDS', 'EDUCATION'],
        consumers: ['AGRICULTURE', 'ENERGY', 'EXTRACTION', 'CIVIL_INDUSTRY', 'ADVANCED_TECH', 'DEFENSE_INDUSTRY', 'MILITARY'],
        storage: { storable: false, perishable: false, decayModel: 'NON_STOCK', shelfLifeDays: null },
        transportModes: ['NOT_TRANSPORTED'],
        shortageEffects: [
            { id: 'CAPACITY_REDUCTION', activationPhase: 16 },
            { id: 'WAGE_PRESSURE', activationPhase: 19 },
            { id: 'RECRUITMENT_SHORTFALL', activationPhase: 48 }
        ]
    },
    {
        id: 'capital',
        label: 'Sermaye',
        category: 'FINANCIAL',
        unit: { id: 'currency_unit', label: 'para birimi', symbol: 'PB', precision: 2 },
        producers: ['HOUSEHOLDS', 'COMPANIES', 'FINANCIAL_SYSTEM', 'STATE'],
        consumers: ['HOUSEHOLDS', 'COMPANIES', 'FINANCIAL_SYSTEM', 'STATE'],
        storage: { storable: true, perishable: false, decayModel: 'FINANCIAL', shelfLifeDays: null },
        transportModes: ['FINANCIAL_NETWORK'],
        shortageEffects: [
            { id: 'INVESTMENT_BLOCKED', activationPhase: 20 },
            { id: 'PAYMENT_ARREARS', activationPhase: 20 },
            { id: 'DEFAULT_RISK', activationPhase: 20 }
        ]
    }
]);

const STORY_RESOURCE_LEGACY_MAPPINGS = Object.freeze([
    {
        legacyKey: 'oil',
        resourceId: 'energy',
        scale: 1,
        readMode: 'ALIAS_ONLY',
        writeMode: 'LEGACY_AUTHORITATIVE',
        semanticLoss: 'HIGH',
        note: 'Eski oil savaş yakıtı/gelir havuzudur; gerçek MWh enerji stoğu değildir.'
    },
    {
        legacyKey: 'manpower',
        resourceId: 'labor',
        scale: 1,
        readMode: 'ALIAS_ONLY',
        writeMode: 'LEGACY_AUTHORITATIVE',
        semanticLoss: 'HIGH',
        note: 'Eski manpower askerî personel havuzudur; sivil işçi-gün stoğu değildir.'
    },
    {
        legacyKey: 'points',
        resourceId: 'capital',
        scale: 1,
        readMode: 'ALIAS_ONLY',
        writeMode: 'LEGACY_AUTHORITATIVE',
        semanticLoss: 'HIGH',
        note: 'Eski points inşa/teknoloji puanıdır; para, kredi veya bilanço sermayesi değildir.'
    }
]);

function storyResourceEnabled() {
    return typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('economy.resourceTaxonomy');
}

function storyResourceClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyResourceStable(value) {
    if (value == null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(storyResourceStable).join(',')}]`;
    const keys = Object.keys(value).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${storyResourceStable(value[key])}`).join(',')}}`;
}

function storyResourceHash(value) {
    const text = storyResourceStable(value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return `fnv1a32:${(`00000000${(hash >>> 0).toString(16)}`).slice(-8)}`;
}

function storyResourceCanonicalPayload(resources, legacyMappings) {
    return {
        schemaVersion: STORY_RESOURCE_SCHEMA_VERSION,
        catalogVersion: STORY_RESOURCE_CATALOG_VERSION,
        adapterVersion: STORY_RESOURCE_ADAPTER_VERSION,
        legacyAdapterVersion: STORY_RESOURCE_LEGACY_ADAPTER_VERSION,
        resources: storyResourceClone(resources || STORY_RESOURCE_DEFINITIONS),
        legacyMappings: storyResourceClone(legacyMappings || STORY_RESOURCE_LEGACY_MAPPINGS)
    };
}

const STORY_RESOURCE_CATALOG_HASH = storyResourceHash(storyResourceCanonicalPayload());

function storyResourceCatalogCreate(options) {
    options = options || {};
    const payload = storyResourceCanonicalPayload();
    return Object.assign(payload, {
        catalogHash: STORY_RESOURCE_CATALOG_HASH,
        disabled: false,
        diagnostics: {
            backfilled: !!options.backfilled,
            restoredFromInvalidCatalog: !!options.restoredFromInvalidCatalog,
            issues: Array.isArray(options.issues) ? storyResourceClone(options.issues).slice(0, 50) : [],
            warnings: Array.isArray(options.warnings) ? options.warnings.map(String).slice(0, 30) : [],
            liveStockSystem: false,
            nextActivationPhase: 16
        }
    });
}

function storyResourceCatalogValidate(catalog) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
        return { ok: false, issues: [{ code: 'CATALOG_REQUIRED', path: '$', message: 'Kaynak kataloğu nesnesi zorunlu.' }] };
    }
    if (catalog.schemaVersion !== STORY_RESOURCE_SCHEMA_VERSION) add('SCHEMA_VERSION', '$.schemaVersion', 'Kaynak katalog şema sürümü uyuşmuyor.');
    if (catalog.catalogVersion !== STORY_RESOURCE_CATALOG_VERSION) add('CATALOG_VERSION', '$.catalogVersion', 'Kaynak katalog içerik sürümü uyuşmuyor.');
    if (catalog.adapterVersion !== STORY_RESOURCE_ADAPTER_VERSION) add('ADAPTER_VERSION', '$.adapterVersion', 'Kaynak katalog adaptörü uyuşmuyor.');
    if (catalog.legacyAdapterVersion !== STORY_RESOURCE_LEGACY_ADAPTER_VERSION) add('LEGACY_ADAPTER_VERSION', '$.legacyAdapterVersion', 'Eski kaynak adaptörü uyuşmuyor.');
    if (catalog.disabled) return { ok: issues.length === 0, issues };
    if (!Array.isArray(catalog.resources)) {
        add('RESOURCES_ARRAY', '$.resources', 'Kaynak tanımları dizi olmalı.');
        return { ok: false, issues };
    }
    if (catalog.resources.length !== STORY_RESOURCE_IDS.length) {
        add('RESOURCE_COUNT', '$.resources', `Tam ${STORY_RESOURCE_IDS.length} kaynak tanımı zorunlu.`);
    }
    const ids = new Set();
    catalog.resources.forEach((resource, index) => {
        const at = `$.resources[${index}]`;
        if (!resource || typeof resource !== 'object' || Array.isArray(resource)) {
            add('INVALID_RESOURCE', at, 'Kaynak tanımı nesne olmalı.');
            return;
        }
        if (typeof resource.id !== 'string' || !resource.id) add('RESOURCE_ID', `${at}.id`, 'Kaynak kimliği zorunlu.');
        else if (ids.has(resource.id)) add('DUPLICATE_RESOURCE_ID', `${at}.id`, `Yinelenen kaynak: ${resource.id}`);
        else ids.add(resource.id);
        if (!STORY_RESOURCE_IDS.includes(resource.id)) add('UNKNOWN_RESOURCE_ID', `${at}.id`, `Bilinmeyen kaynak: ${resource.id}`);
        if (typeof resource.label !== 'string' || !resource.label.trim()) add('RESOURCE_LABEL', `${at}.label`, 'Oyuncu etiketi zorunlu.');
        if (!['PHYSICAL', 'NETWORK', 'SERVICE', 'FINANCIAL'].includes(resource.category)) {
            add('RESOURCE_CATEGORY', `${at}.category`, 'Kaynak kategorisi geçersiz.');
        }
        if (!resource.unit || typeof resource.unit !== 'object'
            || typeof resource.unit.id !== 'string' || !resource.unit.id
            || typeof resource.unit.label !== 'string' || !resource.unit.label
            || typeof resource.unit.symbol !== 'string' || !resource.unit.symbol
            || !Number.isInteger(resource.unit.precision)
            || resource.unit.precision < 0 || resource.unit.precision > 6) {
            add('RESOURCE_UNIT', `${at}.unit`, 'Kaynak için kimlikli, etiketli ve 0–6 hassasiyetli birim zorunlu.');
        }
        if (!Array.isArray(resource.producers) || resource.producers.length === 0) {
            add('PRODUCERS_REQUIRED', `${at}.producers`, 'En az bir üretici sınıfı zorunlu.');
        }
        if (!Array.isArray(resource.consumers) || resource.consumers.length === 0) {
            add('CONSUMERS_REQUIRED', `${at}.consumers`, 'En az bir tüketici sınıfı zorunlu.');
        }
        if (!resource.storage || typeof resource.storage !== 'object'
            || typeof resource.storage.storable !== 'boolean'
            || typeof resource.storage.perishable !== 'boolean'
            || typeof resource.storage.decayModel !== 'string') {
            add('STORAGE_POLICY', `${at}.storage`, 'Stoklanabilirlik ve bozulma politikası zorunlu.');
        }
        if (!Array.isArray(resource.transportModes) || resource.transportModes.length === 0) {
            add('TRANSPORT_MODE_REQUIRED', `${at}.transportModes`, 'En az bir taşıma/aktarım modu zorunlu.');
        }
        if (!Array.isArray(resource.shortageEffects) || resource.shortageEffects.length === 0
            || resource.shortageEffects.some(effect => (
                !effect || typeof effect.id !== 'string' || !effect.id
                || !Number.isInteger(effect.activationPhase)
            ))) {
            add('SHORTAGE_EFFECT_REQUIRED', `${at}.shortageEffects`, 'Kaynağın yokluk sonucu ve etkinleşeceği faz zorunlu.');
        }
    });
    for (const id of STORY_RESOURCE_IDS) {
        if (!ids.has(id)) add('MISSING_RESOURCE_ID', '$.resources', `Zorunlu kaynak eksik: ${id}`);
    }

    if (!Array.isArray(catalog.legacyMappings)) {
        add('LEGACY_MAPPINGS_ARRAY', '$.legacyMappings', 'Eski kaynak eşlemeleri dizi olmalı.');
    } else {
        const legacyKeys = new Set();
        const mappedIds = new Set();
        catalog.legacyMappings.forEach((mapping, index) => {
            const at = `$.legacyMappings[${index}]`;
            if (!mapping || typeof mapping !== 'object') {
                add('INVALID_LEGACY_MAPPING', at, 'Eski kaynak eşlemesi nesne olmalı.');
                return;
            }
            if (!['oil', 'manpower', 'points'].includes(mapping.legacyKey)) {
                add('UNKNOWN_LEGACY_KEY', `${at}.legacyKey`, `Bilinmeyen eski alan: ${mapping.legacyKey}`);
            } else if (legacyKeys.has(mapping.legacyKey)) {
                add('DUPLICATE_LEGACY_KEY', `${at}.legacyKey`, `Yinelenen eski alan: ${mapping.legacyKey}`);
            } else legacyKeys.add(mapping.legacyKey);
            if (!STORY_RESOURCE_IDS.includes(mapping.resourceId)) add('BROKEN_RESOURCE_REFERENCE', `${at}.resourceId`, 'Eski eşleme bilinmeyen kaynağa bağlı.');
            else if (mappedIds.has(mapping.resourceId)) add('DUPLICATE_LEGACY_RESOURCE', `${at}.resourceId`, 'Bir kanonik kaynak birden fazla eski alandan türetilemez.');
            else mappedIds.add(mapping.resourceId);
            if (!Number.isFinite(Number(mapping.scale)) || Number(mapping.scale) <= 0) add('INVALID_LEGACY_SCALE', `${at}.scale`, 'Eski eşleme ölçeği pozitif ve sonlu olmalı.');
            if (mapping.readMode !== 'ALIAS_ONLY' || mapping.writeMode !== 'LEGACY_AUTHORITATIVE') {
                add('UNSAFE_LEGACY_MODE', at, 'Faz 15 eşlemesi yalnız alias okuma ve eski alanı yetkili yazma kullanabilir.');
            }
            if (!['LOW', 'MEDIUM', 'HIGH'].includes(mapping.semanticLoss)) add('SEMANTIC_LOSS_REQUIRED', `${at}.semanticLoss`, 'Anlam kaybı açıkça sınıflandırılmalı.');
            if (typeof mapping.note !== 'string' || !mapping.note) add('LEGACY_NOTE_REQUIRED', `${at}.note`, 'Anlam kaybı açıklaması zorunlu.');
        });
        for (const key of ['oil', 'manpower', 'points']) {
            if (!legacyKeys.has(key)) add('MISSING_LEGACY_KEY', '$.legacyMappings', `Eski alan eşlemesi eksik: ${key}`);
        }
    }

    const payload = storyResourceCanonicalPayload(catalog.resources, catalog.legacyMappings);
    const actualHash = storyResourceHash(payload);
    if (catalog.catalogHash !== actualHash) add('CATALOG_HASH_MISMATCH', '$.catalogHash', 'Kaynak katalog checksum’ı içerikle uyuşmuyor.');
    if (actualHash !== STORY_RESOURCE_CATALOG_HASH
        || storyResourceStable(payload) !== storyResourceStable(storyResourceCanonicalPayload())) {
        add('STATIC_CATALOG_MISMATCH', '$.resources', 'Katalog güncel Faz 15 sabit tanımlarıyla uyuşmuyor.');
    }
    return { ok: issues.length === 0, issues };
}

function storyResourceTaxonomyReset(options) {
    if (!storyResourceEnabled()) {
        STORY.resourceTaxonomy = null;
        return null;
    }
    STORY.resourceTaxonomy = storyResourceCatalogCreate(options);
    return STORY.resourceTaxonomy;
}

function storyResourceTaxonomyRestore(saved) {
    if (!storyResourceEnabled()) {
        STORY.resourceTaxonomy = null;
        return null;
    }
    if (!saved) {
        return storyResourceTaxonomyReset({
            backfilled: true,
            warnings: ['Kayıt kaynak taksonomisi taşımıyordu; güncel statik katalogla backfill yapıldı.']
        });
    }
    const candidate = storyResourceCatalogCreate({
        backfilled: !!(saved.diagnostics && saved.diagnostics.backfilled),
        restoredFromInvalidCatalog: !!(saved.diagnostics && saved.diagnostics.restoredFromInvalidCatalog),
        issues: saved.diagnostics && saved.diagnostics.issues,
        warnings: saved.diagnostics && saved.diagnostics.warnings
    });
    candidate.schemaVersion = saved.schemaVersion;
    candidate.catalogVersion = saved.catalogVersion;
    candidate.adapterVersion = saved.adapterVersion;
    candidate.legacyAdapterVersion = saved.legacyAdapterVersion;
    candidate.catalogHash = saved.catalogHash;
    const validation = storyResourceCatalogValidate(candidate);
    if (!validation.ok) {
        return storyResourceTaxonomyReset({
            backfilled: true,
            restoredFromInvalidCatalog: true,
            issues: validation.issues,
            warnings: ['Geçersiz kaynak taksonomisi kullanılmadı; güncel statik katalog yeniden kuruldu.']
        });
    }
    STORY.resourceTaxonomy = candidate;
    return STORY.resourceTaxonomy;
}

function storyResourceTaxonomyEnsure() {
    if (!storyResourceEnabled()) return null;
    if (!STORY.resourceTaxonomy) return storyResourceTaxonomyReset({ backfilled: true });
    const validation = storyResourceCatalogValidate(STORY.resourceTaxonomy);
    if (!validation.ok) {
        return storyResourceTaxonomyReset({
            backfilled: true,
            restoredFromInvalidCatalog: true,
            issues: validation.issues,
            warnings: ['Canlı kaynak kataloğu bozulmuştu; statik tanımlardan yeniden kuruldu.']
        });
    }
    return STORY.resourceTaxonomy;
}

function storyResourceTaxonomyForSave() {
    const catalog = STORY.resourceTaxonomy || storyResourceTaxonomyEnsure();
    if (!catalog) return null;
    return {
        schemaVersion: catalog.schemaVersion,
        catalogVersion: catalog.catalogVersion,
        adapterVersion: catalog.adapterVersion,
        legacyAdapterVersion: catalog.legacyAdapterVersion,
        catalogHash: catalog.catalogHash,
        diagnostics: storyResourceClone(catalog.diagnostics)
    };
}

function storyResourceCatalogSnapshot() {
    const catalog = STORY.resourceTaxonomy || storyResourceTaxonomyEnsure();
    if (!catalog) {
        return {
            schemaVersion: STORY_RESOURCE_SCHEMA_VERSION,
            catalogVersion: STORY_RESOURCE_CATALOG_VERSION,
            adapterVersion: STORY_RESOURCE_ADAPTER_VERSION,
            legacyAdapterVersion: STORY_RESOURCE_LEGACY_ADAPTER_VERSION,
            catalogHash: STORY_RESOURCE_CATALOG_HASH,
            disabled: true,
            resources: [],
            legacyMappings: [],
            summary: { resourceCount: 0, legacyMappedCount: 0, liveStockSystem: false },
            diagnostics: { warnings: ['Kaynak taksonomisi özellik bayrağıyla kapalı.'], liveStockSystem: false }
        };
    }
    const snapshot = storyResourceClone(catalog);
    snapshot.summary = {
        resourceCount: snapshot.resources.length,
        physicalCount: snapshot.resources.filter(resource => resource.category === 'PHYSICAL').length,
        legacyMappedCount: snapshot.legacyMappings.length,
        unavailableStockCount: snapshot.resources.length - snapshot.legacyMappings.length,
        liveStockSystem: false
    };
    return snapshot;
}

function storyResourceLegacyToCanonical(legacyResources) {
    const catalog = storyResourceCatalogSnapshot();
    const legacy = legacyResources && typeof legacyResources === 'object' ? legacyResources : {};
    const mappings = new Map(catalog.legacyMappings.map(mapping => [mapping.resourceId, mapping]));
    const quantities = {};
    const issues = [];
    for (const resource of catalog.resources) {
        const mapping = mappings.get(resource.id);
        if (!mapping) {
            quantities[resource.id] = {
                resourceId: resource.id,
                unitId: resource.unit.id,
                value: null,
                status: 'UNAVAILABLE_PHASE_17',
                legacyKey: null,
                semanticLoss: null
            };
            continue;
        }
        const raw = Number(legacy[mapping.legacyKey]);
        const valid = Number.isFinite(raw) && raw >= 0;
        if (!valid) {
            issues.push({
                code: 'INVALID_LEGACY_VALUE',
                path: `$.${mapping.legacyKey}`,
                message: `${mapping.legacyKey} sonlu ve negatif olmayan sayı olmalı.`
            });
        }
        quantities[resource.id] = {
            resourceId: resource.id,
            unitId: resource.unit.id,
            value: valid ? raw * mapping.scale : null,
            status: valid ? 'LEGACY_ALIAS' : 'INVALID_LEGACY_VALUE',
            legacyKey: mapping.legacyKey,
            semanticLoss: mapping.semanticLoss
        };
    }
    return {
        schemaVersion: STORY_RESOURCE_SCHEMA_VERSION,
        adapterVersion: STORY_RESOURCE_LEGACY_ADAPTER_VERSION,
        catalogHash: catalog.catalogHash,
        quantities,
        diagnostics: {
            issues,
            warnings: catalog.legacyMappings.map(mapping => mapping.note),
            authoritative: 'legacy',
            liveStockSystem: false
        }
    };
}

function storyResourceCanonicalToLegacy(canonicalView, fallbackLegacy) {
    const view = canonicalView && typeof canonicalView === 'object' ? canonicalView : {};
    const quantities = view.quantities && typeof view.quantities === 'object' ? view.quantities : {};
    const fallback = fallbackLegacy && typeof fallbackLegacy === 'object' ? fallbackLegacy : {};
    const legacy = {};
    const issues = [];
    for (const mapping of STORY_RESOURCE_LEGACY_MAPPINGS) {
        const quantity = quantities[mapping.resourceId];
        const value = quantity && Number(quantity.value);
        if (quantity && quantity.status === 'LEGACY_ALIAS' && Number.isFinite(value) && value >= 0) {
            legacy[mapping.legacyKey] = value / mapping.scale;
            continue;
        }
        const fallbackValue = Number(fallback[mapping.legacyKey]);
        if (Number.isFinite(fallbackValue) && fallbackValue >= 0) {
            legacy[mapping.legacyKey] = fallbackValue;
            issues.push({
                code: 'LEGACY_FALLBACK_USED',
                path: `$.${mapping.legacyKey}`,
                message: `${mapping.resourceId} geçerli alias taşımadığı için eski değer korundu.`
            });
        } else {
            legacy[mapping.legacyKey] = null;
            issues.push({
                code: 'LEGACY_VALUE_UNAVAILABLE',
                path: `$.${mapping.legacyKey}`,
                message: `${mapping.resourceId} için kayıpsız eski değer üretilemedi.`
            });
        }
    }
    return {
        schemaVersion: STORY_RESOURCE_SCHEMA_VERSION,
        adapterVersion: STORY_RESOURCE_LEGACY_ADAPTER_VERSION,
        resources: legacy,
        diagnostics: {
            issues,
            ignoredCanonicalResourceIds: STORY_RESOURCE_IDS.filter(id => (
                !STORY_RESOURCE_LEGACY_MAPPINGS.some(mapping => mapping.resourceId === id)
            )),
            authoritative: 'legacy'
        }
    };
}
