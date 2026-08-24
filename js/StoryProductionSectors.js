// ============================================================================
//  HİKÂYE ÜRETİM SEKTÖRLERİ — Faz 16
//  --------------------------------------------------------------------------
//  Altı makro sektörün reçete, kapasite, iş gücü, verimlilik ve koruma
//  sözleşmesini tanımlar. Bu katman gerçek stoklara yazmaz. Faz 17 gelene kadar
//  yalnız deterministik üretim teklifi ve darboğaz raporu üretir.
// ============================================================================

const STORY_PRODUCTION_SCHEMA_VERSION = 1;
const STORY_PRODUCTION_CATALOG_VERSION = 1;
const STORY_PRODUCTION_ADAPTER_VERSION = 'story-production-sectors-1';
const STORY_PRODUCTION_RESOURCE_CATALOG_HASH = STORY_RESOURCE_CATALOG_HASH;
const STORY_PRODUCTION_SECTOR_IDS = Object.freeze([
    'agriculture',
    'energy',
    'extraction',
    'civil_industry',
    'advanced_tech',
    'defense_industry'
]);

const STORY_PRODUCTION_SECTOR_DEFINITIONS = Object.freeze([
    {
        id: 'agriculture',
        label: 'Tarım ve Gıda',
        producerClass: 'AGRICULTURE',
        capacity: { unitId: 'sector_capacity_point', baseCyclesPerCapacity: 1, min: 0, max: 1000000 },
        workforce: { resourceId: 'labor', unitId: 'worker_day', quantityPerCycle: 4 },
        efficiency: { baseBps: 10000, minBps: 2500, maxBps: 15000 },
        recipe: {
            id: 'recipe:agriculture:food',
            version: 1,
            cycleHours: 24,
            inputs: [
                { resourceId: 'energy', unitId: 'megawatt_hour', quantity: 0.25, role: 'POWER' },
                { resourceId: 'labor', unitId: 'worker_day', quantity: 4, role: 'WORKFORCE' },
                { resourceId: 'capital', unitId: 'currency_unit', quantity: 2, role: 'OPERATING_CAPITAL' }
            ],
            endowments: [
                { id: 'arable_capacity', unitId: 'food_ton_potential', quantity: 1.25, depletable: false }
            ],
            outputs: [
                { resourceId: 'food', unitId: 'food_ton', quantity: 1, materialEquivalentTonsPerUnit: 1 }
            ],
            conservation: {
                mode: 'ENDOWMENT_BOUND',
                endowmentId: 'arable_capacity',
                maxOutputPerEndowmentUnit: 0.8
            }
        }
    },
    {
        id: 'energy',
        label: 'Enerji',
        producerClass: 'ENERGY',
        capacity: { unitId: 'sector_capacity_point', baseCyclesPerCapacity: 1, min: 0, max: 1000000 },
        workforce: { resourceId: 'labor', unitId: 'worker_day', quantityPerCycle: 1.5 },
        efficiency: { baseBps: 10000, minBps: 2500, maxBps: 15000 },
        recipe: {
            id: 'recipe:energy:power',
            version: 1,
            cycleHours: 24,
            inputs: [
                { resourceId: 'industrial_parts', unitId: 'parts_lot', quantity: 0.08, role: 'MAINTENANCE' },
                { resourceId: 'labor', unitId: 'worker_day', quantity: 1.5, role: 'WORKFORCE' },
                { resourceId: 'capital', unitId: 'currency_unit', quantity: 1, role: 'OPERATING_CAPITAL' }
            ],
            endowments: [
                { id: 'energy_potential', unitId: 'megawatt_hour_potential', quantity: 10, depletable: false }
            ],
            outputs: [
                { resourceId: 'energy', unitId: 'megawatt_hour', quantity: 10, materialEquivalentTonsPerUnit: 0 }
            ],
            conservation: {
                mode: 'ENDOWMENT_BOUND',
                endowmentId: 'energy_potential',
                maxOutputPerEndowmentUnit: 1
            }
        }
    },
    {
        id: 'extraction',
        label: 'Hammadde Çıkarımı',
        producerClass: 'EXTRACTION',
        capacity: { unitId: 'sector_capacity_point', baseCyclesPerCapacity: 1, min: 0, max: 1000000 },
        workforce: { resourceId: 'labor', unitId: 'worker_day', quantityPerCycle: 2.5 },
        efficiency: { baseBps: 10000, minBps: 2500, maxBps: 15000 },
        recipe: {
            id: 'recipe:extraction:raw-materials',
            version: 1,
            cycleHours: 24,
            inputs: [
                { resourceId: 'energy', unitId: 'megawatt_hour', quantity: 0.5, role: 'POWER' },
                { resourceId: 'industrial_parts', unitId: 'parts_lot', quantity: 0.1, role: 'MAINTENANCE' },
                { resourceId: 'labor', unitId: 'worker_day', quantity: 2.5, role: 'WORKFORCE' },
                { resourceId: 'capital', unitId: 'currency_unit', quantity: 1.5, role: 'OPERATING_CAPITAL' }
            ],
            endowments: [
                { id: 'mineral_reserve', unitId: 'material_ton_potential', quantity: 1.25, depletable: true }
            ],
            outputs: [
                { resourceId: 'raw_materials', unitId: 'material_ton', quantity: 1, materialEquivalentTonsPerUnit: 1 }
            ],
            conservation: {
                mode: 'ENDOWMENT_BOUND',
                endowmentId: 'mineral_reserve',
                maxOutputPerEndowmentUnit: 0.8
            }
        }
    },
    {
        id: 'civil_industry',
        label: 'Sivil Sanayi',
        producerClass: 'CIVIL_INDUSTRY',
        capacity: { unitId: 'sector_capacity_point', baseCyclesPerCapacity: 1, min: 0, max: 1000000 },
        workforce: { resourceId: 'labor', unitId: 'worker_day', quantityPerCycle: 3 },
        efficiency: { baseBps: 10000, minBps: 2500, maxBps: 15000 },
        recipe: {
            id: 'recipe:civil-industry:parts',
            version: 1,
            cycleHours: 24,
            inputs: [
                { resourceId: 'raw_materials', unitId: 'material_ton', quantity: 1.5, role: 'MATERIAL', materialEquivalentTonsPerUnit: 1 },
                { resourceId: 'energy', unitId: 'megawatt_hour', quantity: 2, role: 'POWER', materialEquivalentTonsPerUnit: 0 },
                { resourceId: 'labor', unitId: 'worker_day', quantity: 3, role: 'WORKFORCE', materialEquivalentTonsPerUnit: 0 },
                { resourceId: 'capital', unitId: 'currency_unit', quantity: 2.5, role: 'OPERATING_CAPITAL', materialEquivalentTonsPerUnit: 0 }
            ],
            endowments: [],
            outputs: [
                { resourceId: 'industrial_parts', unitId: 'parts_lot', quantity: 1, materialEquivalentTonsPerUnit: 1.2 }
            ],
            conservation: { mode: 'MASS_EQUIVALENT' }
        }
    },
    {
        id: 'advanced_tech',
        label: 'İleri Teknoloji',
        producerClass: 'ADVANCED_TECH',
        capacity: { unitId: 'sector_capacity_point', baseCyclesPerCapacity: 1, min: 0, max: 1000000 },
        workforce: { resourceId: 'labor', unitId: 'worker_day', quantityPerCycle: 5 },
        efficiency: { baseBps: 10000, minBps: 2500, maxBps: 15000 },
        recipe: {
            id: 'recipe:advanced-tech:electronics',
            version: 1,
            cycleHours: 24,
            inputs: [
                { resourceId: 'raw_materials', unitId: 'material_ton', quantity: 0.5, role: 'MATERIAL', materialEquivalentTonsPerUnit: 1 },
                { resourceId: 'industrial_parts', unitId: 'parts_lot', quantity: 1, role: 'COMPONENT', materialEquivalentTonsPerUnit: 1.2 },
                { resourceId: 'energy', unitId: 'megawatt_hour', quantity: 4, role: 'POWER', materialEquivalentTonsPerUnit: 0 },
                { resourceId: 'labor', unitId: 'worker_day', quantity: 5, role: 'WORKFORCE', materialEquivalentTonsPerUnit: 0 },
                { resourceId: 'capital', unitId: 'currency_unit', quantity: 5, role: 'OPERATING_CAPITAL', materialEquivalentTonsPerUnit: 0 }
            ],
            endowments: [],
            outputs: [
                { resourceId: 'electronics', unitId: 'electronics_lot', quantity: 1, materialEquivalentTonsPerUnit: 0.8 }
            ],
            conservation: { mode: 'MASS_EQUIVALENT' }
        }
    },
    {
        id: 'defense_industry',
        label: 'Savunma Sanayisi',
        producerClass: 'DEFENSE_INDUSTRY',
        capacity: { unitId: 'sector_capacity_point', baseCyclesPerCapacity: 1, min: 0, max: 1000000 },
        workforce: { resourceId: 'labor', unitId: 'worker_day', quantityPerCycle: 4 },
        efficiency: { baseBps: 10000, minBps: 2500, maxBps: 15000 },
        recipe: {
            id: 'recipe:defense-industry:supplies',
            version: 1,
            cycleHours: 24,
            inputs: [
                { resourceId: 'raw_materials', unitId: 'material_ton', quantity: 0.7, role: 'MATERIAL', materialEquivalentTonsPerUnit: 1 },
                { resourceId: 'industrial_parts', unitId: 'parts_lot', quantity: 1.2, role: 'COMPONENT', materialEquivalentTonsPerUnit: 1.2 },
                { resourceId: 'electronics', unitId: 'electronics_lot', quantity: 0.3, role: 'COMPONENT', materialEquivalentTonsPerUnit: 0.8 },
                { resourceId: 'energy', unitId: 'megawatt_hour', quantity: 5, role: 'POWER', materialEquivalentTonsPerUnit: 0 },
                { resourceId: 'labor', unitId: 'worker_day', quantity: 4, role: 'WORKFORCE', materialEquivalentTonsPerUnit: 0 },
                { resourceId: 'capital', unitId: 'currency_unit', quantity: 4, role: 'OPERATING_CAPITAL', materialEquivalentTonsPerUnit: 0 }
            ],
            endowments: [],
            outputs: [
                { resourceId: 'military_supplies', unitId: 'supply_ton', quantity: 1, materialEquivalentTonsPerUnit: 1 }
            ],
            conservation: { mode: 'MASS_EQUIVALENT' }
        }
    }
]);

function storyProductionEnabled() {
    return (typeof storyFeatureEnabled !== 'function'
        || storyFeatureEnabled('economy.productionSectors'))
        && (typeof storyResourceEnabled !== 'function' || storyResourceEnabled());
}

function storyProductionClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyProductionStable(value) {
    if (typeof storyResourceStable === 'function') return storyResourceStable(value);
    if (value == null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(storyProductionStable).join(',')}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${storyProductionStable(value[key])}`).join(',')}}`;
}

function storyProductionHash(value) {
    if (typeof storyResourceHash === 'function') return storyResourceHash(value);
    const text = storyProductionStable(value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return `fnv1a32:${(`00000000${(hash >>> 0).toString(16)}`).slice(-8)}`;
}

function storyProductionCanonicalPayload(sectors) {
    return {
        schemaVersion: STORY_PRODUCTION_SCHEMA_VERSION,
        catalogVersion: STORY_PRODUCTION_CATALOG_VERSION,
        adapterVersion: STORY_PRODUCTION_ADAPTER_VERSION,
        resourceCatalogHash: STORY_PRODUCTION_RESOURCE_CATALOG_HASH,
        sectors: storyProductionClone(sectors || STORY_PRODUCTION_SECTOR_DEFINITIONS)
    };
}

const STORY_PRODUCTION_CATALOG_HASH = storyProductionHash(storyProductionCanonicalPayload());

function storyProductionCatalogCreate(options) {
    options = options || {};
    return Object.assign(storyProductionCanonicalPayload(), {
        catalogHash: STORY_PRODUCTION_CATALOG_HASH,
        disabled: false,
        diagnostics: {
            backfilled: !!options.backfilled,
            restoredFromInvalidCatalog: !!options.restoredFromInvalidCatalog,
            issues: Array.isArray(options.issues) ? storyProductionClone(options.issues).slice(0, 50) : [],
            warnings: Array.isArray(options.warnings) ? options.warnings.map(String).slice(0, 30) : [],
            liveStockSystem: false,
            proposalsCommit: false,
            nextActivationPhase: 17
        }
    });
}

function storyProductionCatalogValidate(catalog) {
    const issues = [];
    const add = (code, path, message) => issues.push({ code, path, message });
    if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
        return { ok: false, issues: [{ code: 'PRODUCTION_CATALOG_REQUIRED', path: '$', message: 'Üretim kataloğu nesnesi zorunlu.' }] };
    }
    if (catalog.schemaVersion !== STORY_PRODUCTION_SCHEMA_VERSION) add('PRODUCTION_SCHEMA_VERSION', '$.schemaVersion', 'Üretim şema sürümü uyuşmuyor.');
    if (catalog.catalogVersion !== STORY_PRODUCTION_CATALOG_VERSION) add('PRODUCTION_CATALOG_VERSION', '$.catalogVersion', 'Üretim katalog sürümü uyuşmuyor.');
    if (catalog.adapterVersion !== STORY_PRODUCTION_ADAPTER_VERSION) add('PRODUCTION_ADAPTER_VERSION', '$.adapterVersion', 'Üretim adaptörü uyuşmuyor.');
    if (catalog.resourceCatalogHash !== STORY_PRODUCTION_RESOURCE_CATALOG_HASH) add('RESOURCE_CATALOG_LINK', '$.resourceCatalogHash', 'Üretim kataloğu yanlış kaynak kataloğuna bağlı.');
    if (catalog.disabled) return { ok: issues.length === 0, issues };
    if (!Array.isArray(catalog.sectors)) {
        add('SECTORS_ARRAY', '$.sectors', 'Sektör tanımları dizi olmalı.');
        return { ok: false, issues };
    }
    if (catalog.sectors.length !== STORY_PRODUCTION_SECTOR_IDS.length) {
        add('SECTOR_COUNT', '$.sectors', `Tam ${STORY_PRODUCTION_SECTOR_IDS.length} sektör zorunlu.`);
    }

    const resources = storyResourceCatalogSnapshot();
    const resourceById = new Map((resources.resources || []).map(resource => [resource.id, resource]));
    const sectorIds = new Set();
    const recipeIds = new Set();
    const primaryClasses = new Set(['AGRICULTURE', 'ENERGY', 'EXTRACTION']);
    catalog.sectors.forEach((sector, sectorIndex) => {
        const at = `$.sectors[${sectorIndex}]`;
        if (!sector || typeof sector !== 'object' || Array.isArray(sector)) {
            add('INVALID_SECTOR', at, 'Sektör tanımı nesne olmalı.');
            return;
        }
        if (!STORY_PRODUCTION_SECTOR_IDS.includes(sector.id)) add('UNKNOWN_SECTOR_ID', `${at}.id`, `Bilinmeyen sektör: ${sector.id}`);
        if (sectorIds.has(sector.id)) add('DUPLICATE_SECTOR_ID', `${at}.id`, `Yinelenen sektör: ${sector.id}`);
        sectorIds.add(sector.id);
        if (typeof sector.label !== 'string' || !sector.label.trim()) add('SECTOR_LABEL', `${at}.label`, 'Sektör etiketi zorunlu.');
        if (typeof sector.producerClass !== 'string' || !sector.producerClass) add('PRODUCER_CLASS', `${at}.producerClass`, 'Üretici sınıfı zorunlu.');
        const cap = sector.capacity;
        if (!cap || cap.unitId !== 'sector_capacity_point'
            || !Number.isFinite(cap.baseCyclesPerCapacity) || cap.baseCyclesPerCapacity <= 0
            || !Number.isFinite(cap.min) || !Number.isFinite(cap.max) || cap.min < 0 || cap.max <= cap.min) {
            add('CAPACITY_POLICY', `${at}.capacity`, 'Pozitif ve sınırlı sektör kapasite politikası zorunlu.');
        }
        const efficiency = sector.efficiency;
        if (!efficiency || !Number.isInteger(efficiency.baseBps)
            || !Number.isInteger(efficiency.minBps) || !Number.isInteger(efficiency.maxBps)
            || efficiency.minBps <= 0 || efficiency.minBps > efficiency.baseBps
            || efficiency.maxBps < efficiency.baseBps) {
            add('EFFICIENCY_POLICY', `${at}.efficiency`, 'Geçerli baz/minimum/maksimum verimlilik BPS politikası zorunlu.');
        }

        const recipe = sector.recipe;
        if (!recipe || typeof recipe !== 'object') {
            add('RECIPE_REQUIRED', `${at}.recipe`, 'Sektör reçetesi zorunlu.');
            return;
        }
        if (typeof recipe.id !== 'string' || !recipe.id) add('RECIPE_ID', `${at}.recipe.id`, 'Reçete kimliği zorunlu.');
        else if (recipeIds.has(recipe.id)) add('DUPLICATE_RECIPE_ID', `${at}.recipe.id`, `Yinelenen reçete: ${recipe.id}`);
        else recipeIds.add(recipe.id);
        if (!Number.isInteger(recipe.version) || recipe.version < 1) add('RECIPE_VERSION', `${at}.recipe.version`, 'Pozitif reçete sürümü zorunlu.');
        if (!Number.isFinite(recipe.cycleHours) || recipe.cycleHours <= 0) add('RECIPE_CYCLE', `${at}.recipe.cycleHours`, 'Pozitif çevrim süresi zorunlu.');
        if (!Array.isArray(recipe.inputs) || recipe.inputs.length === 0) add('RECIPE_INPUTS_REQUIRED', `${at}.recipe.inputs`, 'En az bir kaynak girdisi zorunlu.');
        if (!Array.isArray(recipe.outputs) || recipe.outputs.length !== 1) add('RECIPE_OUTPUT_REQUIRED', `${at}.recipe.outputs`, 'Faz 16 reçetesi tam bir ana çıktı taşımalı.');
        const inputs = Array.isArray(recipe.inputs) ? recipe.inputs : [];
        const outputs = Array.isArray(recipe.outputs) ? recipe.outputs : [];
        const inputIds = new Set();
        inputs.forEach((input, inputIndex) => {
            const inputAt = `${at}.recipe.inputs[${inputIndex}]`;
            const resource = input && resourceById.get(input.resourceId);
            if (!resource) add('UNKNOWN_RECIPE_RESOURCE', `${inputAt}.resourceId`, 'Girdi bilinmeyen kaynak kimliğine bağlı.');
            else if (input.unitId !== resource.unit.id) add('RECIPE_UNIT_MISMATCH', `${inputAt}.unitId`, `${input.resourceId} birimi kaynak kataloğuyla uyuşmuyor.`);
            if (!Number.isFinite(input && input.quantity) || input.quantity <= 0) add('INVALID_INPUT_QUANTITY', `${inputAt}.quantity`, 'Girdi miktarı pozitif ve sonlu olmalı.');
            if (inputIds.has(input && input.resourceId)) add('DUPLICATE_RECIPE_INPUT', `${inputAt}.resourceId`, 'Aynı kaynak reçetede iki kez girdi olamaz.');
            inputIds.add(input && input.resourceId);
            if (!input || typeof input.role !== 'string' || !input.role) add('INPUT_ROLE', `${inputAt}.role`, 'Girdi rolü zorunlu.');
        });
        let outputResource = null;
        outputs.forEach((output, outputIndex) => {
            const outputAt = `${at}.recipe.outputs[${outputIndex}]`;
            outputResource = output && resourceById.get(output.resourceId);
            if (!outputResource) add('UNKNOWN_RECIPE_RESOURCE', `${outputAt}.resourceId`, 'Çıktı bilinmeyen kaynak kimliğine bağlı.');
            else {
                if (output.unitId !== outputResource.unit.id) add('RECIPE_UNIT_MISMATCH', `${outputAt}.unitId`, `${output.resourceId} birimi kaynak kataloğuyla uyuşmuyor.`);
                if (!outputResource.producers.includes(sector.producerClass)) {
                    add('PRODUCER_OUTPUT_MISMATCH', outputAt, `${sector.producerClass}, ${output.resourceId} için kayıtlı üretici değildir.`);
                }
            }
            if (!Number.isFinite(output && output.quantity) || output.quantity <= 0) add('INVALID_OUTPUT_QUANTITY', `${outputAt}.quantity`, 'Çıktı miktarı pozitif ve sonlu olmalı.');
        });
        const laborInput = inputs.find(input => input && input.resourceId === 'labor');
        if (!sector.workforce || sector.workforce.resourceId !== 'labor'
            || sector.workforce.unitId !== 'worker_day'
            || !Number.isFinite(sector.workforce.quantityPerCycle)
            || sector.workforce.quantityPerCycle <= 0
            || !laborInput
            || Math.abs(laborInput.quantity - sector.workforce.quantityPerCycle) > 1e-9) {
            add('WORKFORCE_CONTRACT', `${at}.workforce`, 'İş gücü politikası reçetedeki labor girdisiyle bire bir uyuşmalı.');
        }

        const endowments = Array.isArray(recipe.endowments) ? recipe.endowments : [];
        const endowmentIds = new Set();
        endowments.forEach((endowment, endowmentIndex) => {
            const endowmentAt = `${at}.recipe.endowments[${endowmentIndex}]`;
            if (!endowment || typeof endowment.id !== 'string' || !endowment.id
                || typeof endowment.unitId !== 'string' || !endowment.unitId
                || !Number.isFinite(endowment.quantity) || endowment.quantity <= 0
                || typeof endowment.depletable !== 'boolean') {
                add('INVALID_ENDOWMENT', endowmentAt, 'Doğal kapasite girdisi kimlik, birim, pozitif miktar ve tükenebilirlik taşımalı.');
            }
            if (endowmentIds.has(endowment && endowment.id)) add('DUPLICATE_ENDOWMENT', `${endowmentAt}.id`, 'Doğal kapasite girdisi yinelenemez.');
            endowmentIds.add(endowment && endowment.id);
        });
        if (primaryClasses.has(sector.producerClass) && endowments.length === 0) {
            add('PRIMARY_ENDOWMENT_REQUIRED', `${at}.recipe.endowments`, 'Birincil sektör doğal kapasite/rezerve bağlı olmalı.');
        }

        const conservation = recipe.conservation;
        if (!conservation || !['ENDOWMENT_BOUND', 'MASS_EQUIVALENT'].includes(conservation.mode)) {
            add('CONSERVATION_POLICY', `${at}.recipe.conservation`, 'Açık koruma politikası zorunlu.');
        } else if (conservation.mode === 'ENDOWMENT_BOUND') {
            const bound = endowments.find(endowment => endowment.id === conservation.endowmentId);
            if (!bound || !Number.isFinite(conservation.maxOutputPerEndowmentUnit)
                || conservation.maxOutputPerEndowmentUnit <= 0) {
                add('ENDOWMENT_BOUND_INVALID', `${at}.recipe.conservation`, 'Çıktı geçerli doğal kapasite girdisine ve pozitif verime bağlı olmalı.');
            } else if (outputs.length === 1
                && outputs[0].quantity > bound.quantity * conservation.maxOutputPerEndowmentUnit + 1e-9) {
                add('ENDOWMENT_OUTPUT_GAIN', `${at}.recipe.outputs`, 'Çıktı doğal kapasite sınırını aşıyor.');
            }
        } else {
            const materialInput = inputs.reduce((sum, input) => (
                sum + (Number(input.quantity) || 0) * (Number(input.materialEquivalentTonsPerUnit) || 0)
            ), 0);
            const materialOutput = outputs.reduce((sum, output) => (
                sum + (Number(output.quantity) || 0) * (Number(output.materialEquivalentTonsPerUnit) || 0)
            ), 0);
            if (materialInput <= 0) add('MATERIAL_INPUT_REQUIRED', `${at}.recipe.inputs`, 'Sanayi çıktısı pozitif malzeme eşdeğeri girdiye bağlı olmalı.');
            if (materialOutput > materialInput + 1e-9) add('MASS_CREATION', `${at}.recipe.outputs`, 'Malzeme eşdeğeri çıktı girdiyi aşamaz.');
        }

        if (outputResource && ['PHYSICAL', 'NETWORK'].includes(outputResource.category)
            && inputs.length === 0 && endowments.length === 0) {
            add('EX_NIHILO_OUTPUT', `${at}.recipe`, 'Fiziksel/ağ kaynağı girdisiz üretilemez.');
        }
    });
    for (const id of STORY_PRODUCTION_SECTOR_IDS) {
        if (!sectorIds.has(id)) add('MISSING_SECTOR_ID', '$.sectors', `Zorunlu sektör eksik: ${id}`);
    }

    const payload = storyProductionCanonicalPayload(catalog.sectors);
    const actualHash = storyProductionHash(payload);
    if (catalog.catalogHash !== actualHash) add('PRODUCTION_CATALOG_HASH_MISMATCH', '$.catalogHash', 'Üretim katalog checksum’ı içerikle uyuşmuyor.');
    if (actualHash !== STORY_PRODUCTION_CATALOG_HASH
        || storyProductionStable(payload) !== storyProductionStable(storyProductionCanonicalPayload())) {
        add('STATIC_PRODUCTION_CATALOG_MISMATCH', '$.sectors', 'Katalog güncel Faz 16 sabit tanımlarıyla uyuşmuyor.');
    }
    return { ok: issues.length === 0, issues };
}

function storyProductionReset(options) {
    if (!storyProductionEnabled()) {
        STORY.productionSectors = null;
        return null;
    }
    STORY.productionSectors = storyProductionCatalogCreate(options);
    return STORY.productionSectors;
}

function storyProductionRestore(saved) {
    if (!storyProductionEnabled()) {
        STORY.productionSectors = null;
        return null;
    }
    if (!saved) {
        return storyProductionReset({
            backfilled: true,
            warnings: ['Kayıt üretim sektörleri sözleşmesi taşımıyordu; güncel statik katalogla backfill yapıldı.']
        });
    }
    const candidate = storyProductionCatalogCreate({
        backfilled: !!(saved.diagnostics && saved.diagnostics.backfilled),
        restoredFromInvalidCatalog: !!(saved.diagnostics && saved.diagnostics.restoredFromInvalidCatalog),
        issues: saved.diagnostics && saved.diagnostics.issues,
        warnings: saved.diagnostics && saved.diagnostics.warnings
    });
    candidate.schemaVersion = saved.schemaVersion;
    candidate.catalogVersion = saved.catalogVersion;
    candidate.adapterVersion = saved.adapterVersion;
    candidate.resourceCatalogHash = saved.resourceCatalogHash;
    candidate.catalogHash = saved.catalogHash;
    const validation = storyProductionCatalogValidate(candidate);
    if (!validation.ok) {
        return storyProductionReset({
            backfilled: true,
            restoredFromInvalidCatalog: true,
            issues: validation.issues,
            warnings: ['Geçersiz üretim kataloğu kullanılmadı; güncel statik katalog yeniden kuruldu.']
        });
    }
    STORY.productionSectors = candidate;
    return STORY.productionSectors;
}

function storyProductionEnsure() {
    if (!storyProductionEnabled()) return null;
    if (!STORY.productionSectors) return storyProductionReset({ backfilled: true });
    const validation = storyProductionCatalogValidate(STORY.productionSectors);
    if (!validation.ok) {
        return storyProductionReset({
            backfilled: true,
            restoredFromInvalidCatalog: true,
            issues: validation.issues,
            warnings: ['Canlı üretim kataloğu bozulmuştu; statik tanımlardan yeniden kuruldu.']
        });
    }
    return STORY.productionSectors;
}

function storyProductionForSave() {
    const catalog = STORY.productionSectors || storyProductionEnsure();
    if (!catalog) return null;
    return {
        schemaVersion: catalog.schemaVersion,
        catalogVersion: catalog.catalogVersion,
        adapterVersion: catalog.adapterVersion,
        resourceCatalogHash: catalog.resourceCatalogHash,
        catalogHash: catalog.catalogHash,
        diagnostics: storyProductionClone(catalog.diagnostics)
    };
}

function storyProductionCatalogSnapshot() {
    const catalog = STORY.productionSectors || storyProductionEnsure();
    if (!catalog) {
        return {
            schemaVersion: STORY_PRODUCTION_SCHEMA_VERSION,
            catalogVersion: STORY_PRODUCTION_CATALOG_VERSION,
            adapterVersion: STORY_PRODUCTION_ADAPTER_VERSION,
            resourceCatalogHash: STORY_PRODUCTION_RESOURCE_CATALOG_HASH,
            catalogHash: STORY_PRODUCTION_CATALOG_HASH,
            disabled: true,
            sectors: [],
            summary: { sectorCount: 0, recipeCount: 0, liveStockSystem: false, proposalsCommit: false },
            diagnostics: { warnings: ['Üretim sektörleri özellik bayrağıyla kapalı.'], liveStockSystem: false, proposalsCommit: false }
        };
    }
    const snapshot = storyProductionClone(catalog);
    snapshot.summary = {
        sectorCount: snapshot.sectors.length,
        recipeCount: snapshot.sectors.filter(sector => !!sector.recipe).length,
        primarySectorCount: snapshot.sectors.filter(sector => sector.recipe.endowments.length > 0).length,
        manufacturingSectorCount: snapshot.sectors.filter(sector => sector.recipe.conservation.mode === 'MASS_EQUIVALENT').length,
        liveStockSystem: false,
        proposalsCommit: false
    };
    return snapshot;
}

function storyProductionRound(value, precision) {
    const factor = 10 ** (precision == null ? 6 : precision);
    return Math.round((Number(value) || 0) * factor) / factor;
}

function storyProductionEvaluate(sectorId, request) {
    request = request && typeof request === 'object' ? request : {};
    // Canlı Faz 17 tikleri bu fonksiyonu yüzlerce kez çağırır. Statik katalog
    // zaten reset/restore kapısında doğrulandığı için her teklifte 7 KB klonlama
    // yapılmaz; yalnız beklenmeyen başlıkta tam doğrulamaya geri dönülür.
    const liveCatalog = STORY.productionSectors;
    const catalog = liveCatalog
        && liveCatalog.catalogHash === STORY_PRODUCTION_CATALOG_HASH
        && liveCatalog.resourceCatalogHash === STORY_PRODUCTION_RESOURCE_CATALOG_HASH
        ? liveCatalog
        : storyProductionCatalogSnapshot();
    if (catalog.disabled) {
        return {
            schemaVersion: STORY_PRODUCTION_SCHEMA_VERSION,
            adapterVersion: STORY_PRODUCTION_ADAPTER_VERSION,
            sectorId,
            status: 'DISABLED',
            committed: false,
            liveStockSystem: false,
            bottlenecks: [{ code: 'FEATURE_DISABLED', key: 'economy.productionSectors', severity: 'BLOCKING' }]
        };
    }
    const validation = catalog.catalogHash === STORY_PRODUCTION_CATALOG_HASH
        && catalog.resourceCatalogHash === STORY_PRODUCTION_RESOURCE_CATALOG_HASH
        ? { ok: true, issues: [] }
        : storyProductionCatalogValidate(catalog);
    if (!validation.ok) {
        return {
            schemaVersion: STORY_PRODUCTION_SCHEMA_VERSION,
            adapterVersion: STORY_PRODUCTION_ADAPTER_VERSION,
            sectorId,
            status: 'INVALID_CATALOG',
            committed: false,
            liveStockSystem: false,
            bottlenecks: validation.issues.map(issue => ({ code: issue.code, key: issue.path, severity: 'BLOCKING' }))
        };
    }
    const sector = catalog.sectors.find(candidate => candidate.id === sectorId);
    if (!sector) {
        return {
            schemaVersion: STORY_PRODUCTION_SCHEMA_VERSION,
            adapterVersion: STORY_PRODUCTION_ADAPTER_VERSION,
            sectorId,
            status: 'UNKNOWN_SECTOR',
            committed: false,
            liveStockSystem: false,
            bottlenecks: [{ code: 'UNKNOWN_SECTOR', key: String(sectorId), severity: 'BLOCKING' }]
        };
    }

    const requestedCycles = Number(request.requestedCycles);
    const capacityUnits = Number(request.capacityUnits);
    const efficiencyBps = request.efficiencyBps == null
        ? sector.efficiency.baseBps
        : Number(request.efficiencyBps);
    const invalidRequest = [];
    if (!Number.isFinite(requestedCycles) || requestedCycles <= 0) invalidRequest.push('requestedCycles');
    if (!Number.isFinite(capacityUnits) || capacityUnits < sector.capacity.min || capacityUnits > sector.capacity.max) invalidRequest.push('capacityUnits');
    if (!Number.isInteger(efficiencyBps)
        || efficiencyBps < sector.efficiency.minBps
        || efficiencyBps > sector.efficiency.maxBps) invalidRequest.push('efficiencyBps');
    if (invalidRequest.length) {
        return {
            schemaVersion: STORY_PRODUCTION_SCHEMA_VERSION,
            adapterVersion: STORY_PRODUCTION_ADAPTER_VERSION,
            catalogHash: catalog.catalogHash,
            sectorId,
            recipeId: sector.recipe.id,
            status: 'INVALID_REQUEST',
            requestedCycles: Number.isFinite(requestedCycles) ? requestedCycles : null,
            actualCycles: 0,
            committed: false,
            liveStockSystem: false,
            bottlenecks: invalidRequest.map(key => ({ code: 'INVALID_REQUEST_VALUE', key, severity: 'BLOCKING' }))
        };
    }

    const available = request.availableQuantities && typeof request.availableQuantities === 'object'
        ? request.availableQuantities
        : {};
    const endowments = request.endowments && typeof request.endowments === 'object'
        ? request.endowments
        : {};
    const capacityCycles = capacityUnits * sector.capacity.baseCyclesPerCapacity * efficiencyBps / 10000;
    let actualCycles = Math.min(requestedCycles, capacityCycles);
    const bottlenecks = [];
    if (capacityCycles + 1e-9 < requestedCycles) {
        bottlenecks.push({
            code: 'CAPACITY_LIMIT',
            key: 'capacityUnits',
            severity: capacityCycles <= 0 ? 'BLOCKING' : 'LIMITING',
            availableCycles: storyProductionRound(capacityCycles),
            requestedCycles: storyProductionRound(requestedCycles)
        });
    }
    for (const input of sector.recipe.inputs) {
        const raw = available[input.resourceId];
        const value = Number(raw);
        const valid = Number.isFinite(value) && value >= 0;
        const limit = valid ? value / input.quantity : 0;
        actualCycles = Math.min(actualCycles, limit);
        if (!valid || limit + 1e-9 < requestedCycles) {
            bottlenecks.push({
                code: valid ? 'INPUT_SHORTAGE' : 'STOCK_UNAVAILABLE',
                key: input.resourceId,
                unitId: input.unitId,
                severity: limit <= 0 ? 'BLOCKING' : 'LIMITING',
                available: valid ? storyProductionRound(value) : null,
                required: storyProductionRound(input.quantity * requestedCycles),
                availableCycles: storyProductionRound(limit)
            });
        }
    }
    for (const endowment of sector.recipe.endowments) {
        const raw = endowments[endowment.id];
        const value = Number(raw);
        const valid = Number.isFinite(value) && value >= 0;
        const limit = valid ? value / endowment.quantity : 0;
        actualCycles = Math.min(actualCycles, limit);
        if (!valid || limit + 1e-9 < requestedCycles) {
            bottlenecks.push({
                code: valid ? 'ENDOWMENT_SHORTAGE' : 'ENDOWMENT_UNAVAILABLE',
                key: endowment.id,
                unitId: endowment.unitId,
                severity: limit <= 0 ? 'BLOCKING' : 'LIMITING',
                available: valid ? storyProductionRound(value) : null,
                required: storyProductionRound(endowment.quantity * requestedCycles),
                availableCycles: storyProductionRound(limit)
            });
        }
    }
    actualCycles = storyProductionRound(Math.max(0, actualCycles));
    bottlenecks.sort((a, b) => (
        String(a.code).localeCompare(String(b.code), 'en')
        || String(a.key).localeCompare(String(b.key), 'en')
    ));
    const consumed = {};
    for (const input of sector.recipe.inputs) {
        consumed[input.resourceId] = {
            unitId: input.unitId,
            quantity: storyProductionRound(input.quantity * actualCycles)
        };
    }
    const endowmentUse = {};
    for (const endowment of sector.recipe.endowments) {
        endowmentUse[endowment.id] = {
            unitId: endowment.unitId,
            quantity: storyProductionRound(endowment.quantity * actualCycles),
            depletable: endowment.depletable
        };
    }
    const produced = {};
    for (const output of sector.recipe.outputs) {
        produced[output.resourceId] = {
            unitId: output.unitId,
            quantity: storyProductionRound(output.quantity * actualCycles)
        };
    }
    const status = actualCycles <= 0
        ? 'BLOCKED'
        : (actualCycles + 1e-9 < requestedCycles ? 'PARTIAL' : 'READY');
    const proposal = {
        schemaVersion: STORY_PRODUCTION_SCHEMA_VERSION,
        adapterVersion: STORY_PRODUCTION_ADAPTER_VERSION,
        catalogHash: catalog.catalogHash,
        resourceCatalogHash: catalog.resourceCatalogHash,
        sectorId: sector.id,
        recipeId: sector.recipe.id,
        recipeVersion: sector.recipe.version,
        requestedCycles: storyProductionRound(requestedCycles),
        capacityCycles: storyProductionRound(capacityCycles),
        actualCycles,
        efficiencyBps,
        status,
        consumed,
        endowmentUse,
        produced,
        bottlenecks,
        committed: false,
        liveStockSystem: false
    };
    proposal.proposalHash = storyProductionHash(proposal);
    proposal._trustedDirect = true;
    return proposal;
}
