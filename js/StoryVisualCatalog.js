// ═══════════════════════════════════════════════════════════════════════════
//  HİKÂYE GÖRSEL DİLİ VE VARLIK SİCİLİ — HXD-6.4
//  ---------------------------------------------------------------------------
//  2010–2100 dünyasında mekanik gerçek ile çizilen varlığı birbirine bağlar.
//  Yıl yalnız sanat dönemini belirler; araştırma bir üst sınırdır. Bir hücre,
//  ancak kurulu/işletilen fiziksel varlık o kademeyi taşıyorsa yeni görünür.
//
//  Sicil binlerce dosyanın renderer içinde `if (yıl...)` dallarına dönüşmesini
//  engeller. Mantıksal varlık → paket → atlas → kontrollü fallback zinciri
//  veriyle çözülür. Bugünkü tek yerleşim atlası ilk fiziksel fallback'tir.
// ═══════════════════════════════════════════════════════════════════════════

const STORY_VISUAL_CATALOG_SCHEMA_VERSION = 3;
const STORY_VISUAL_CATALOG_VERSION = 'story-visual-catalog-2010-2100-v3';

const STORY_VISUAL_PERIODS = Object.freeze([
    { id: 'MODERN_2010', from: 2010, to: 2029, artDirection: 'contemporary' },
    { id: 'CONNECTED_2030', from: 2030, to: 2049, artDirection: 'connected-transition' },
    { id: 'AUTOMATED_2050', from: 2050, to: 2074, artDirection: 'automation-heavy' },
    { id: 'ADAPTIVE_2075', from: 2075, to: 2089, artDirection: 'climate-adaptive' },
    { id: 'FRONTIER_2090', from: 2090, to: 2100, artDirection: 'frontier-modern' }
]);

const STORY_VISUAL_INSTALL_STAGES = Object.freeze([
    'BASELINE', 'CONNECTED', 'AUTOMATED', 'ADAPTIVE', 'FRONTIER'
]);

const STORY_VISUAL_CONDITIONS = Object.freeze([
    'OPERATING', 'CONSTRUCTION', 'DAMAGED', 'BURNING', 'BURNED', 'ABANDONED'
]);

// Paketler bağımsız yüklenebilir. HXD-6 yalnız `urban-core` ve
// `urban-districts` paketlerini kullanır; sonraki fazlar diğerlerini aktive eder.
const STORY_VISUAL_ASSET_PACKS = Object.freeze([
    { id: 'terrain-base', load: 'MAP', families: ['terrain', 'forest', 'mountain', 'water'] },
    { id: 'urban-core', load: 'VISIBLE_ERA', families: ['core', 'residential', 'civic'] },
    { id: 'urban-industry', load: 'VISIBLE_ERA', families: ['industrial', 'energy', 'extraction'] },
    { id: 'urban-logistics', load: 'VISIBLE_ERA', families: ['logistics', 'port', 'warehouse'] },
    { id: 'land-use', load: 'VISIBLE_REGION', families: ['agriculture', 'forestry', 'mine', 'renewable'] },
    { id: 'infrastructure', load: 'VISIBLE_REGION', families: ['road', 'rail', 'utility'] },
    { id: 'mobile-agents', load: 'VISIBLE_REGION', families: ['truck', 'train', 'ship', 'aircraft', 'character'] },
    { id: 'conflict-state', load: 'ON_DEMAND', families: ['fortification', 'damage', 'fire', 'ruin'] }
]);

const STORY_VISUAL_SOURCE_STATUS = Object.freeze(['ACTIVE', 'ARCHIVED']);
const STORY_VISUAL_HEX_DOMAINS = Object.freeze(['LAND', 'COAST', 'WATER', 'MOBILE', 'OVERLAY']);

function storyVisualSourceDefinition(atlasKey, source, category, purpose, options) {
    const spec = options || {};
    return Object.freeze({
        id: spec.id || `source.${String(atlasKey || 'archive')}.${String(purpose).toLowerCase()}`,
        atlasKey: atlasKey || null,
        source,
        category,
        purpose,
        purposes: Object.freeze((spec.purposes || [purpose]).slice()),
        family: spec.family || null,
        status: spec.status || 'ACTIVE',
        domains: Object.freeze((spec.domains || ['LAND']).slice()),
        climateZones: Object.freeze((spec.climateZones || ['ANY']).slice()),
        periodId: spec.periodId || 'MODERN_2010',
        visualStage: storyVisualClampInt(spec.visualStage || 0, 0, 4),
        archivedAliasOf: spec.archivedAliasOf || null,
        placement: Object.freeze({
            anchor: spec.anchor || 'HEX_FOOTPRINT_BOTTOM',
            clipToHex: spec.clipToHex !== false,
            allowRotation: !!spec.allowRotation,
            allowFlip: !!spec.allowFlip,
            minLandCoverageBps: Math.max(0, Number(spec.minLandCoverageBps) || 0),
            requiresClearedLand: !!spec.requiresClearedLand
        })
    });
}

// Every runtime image under assets/maps has one semantic owner. Selection is
// driven by purpose first, then physical domain, regional climate and installed
// technology. Superseded files remain catalogued as ARCHIVED so an old atlas
// cannot silently return to the live renderer merely because it still exists.
const STORY_VISUAL_SOURCE_CATALOG = Object.freeze([
    storyVisualSourceDefinition('mountains', 'assets/maps/terrain-mountains-atlas-v2.png',
        'NATURAL_COVER', 'MOUNTAIN', { family: 'mountain', domains: ['LAND', 'COAST'],
            allowFlip: true, minLandCoverageBps: 5500 }),
    storyVisualSourceDefinition('forests', 'assets/maps/terrain-forests-atlas-v2.png',
        'NATURAL_COVER', 'FOREST', { family: 'forest', domains: ['LAND', 'COAST'],
            allowFlip: true, minLandCoverageBps: 7000 }),
    storyVisualSourceDefinition('settlements', 'assets/maps/settlements-atlas-modern-v3.png',
        'URBAN', 'URBAN_BASELINE', { family: 'settlement', domains: ['LAND'],
            requiresClearedLand: true, minLandCoverageBps: 9000 }),
    storyVisualSourceDefinition('constructionModern',
        'assets/maps/urban-construction-atlas-modern-v1.png',
        'URBAN', 'CONSTRUCTION', { family: 'construction', domains: ['LAND'],
            requiresClearedLand: true, minLandCoverageBps: 9000 }),
    storyVisualSourceDefinition('urbanClimateModern',
        'assets/maps/urban-climate-atlas-modern-v1.png',
        'URBAN', 'URBAN_CLIMATE', { family: 'urban', domains: ['LAND'],
            climateZones: ['TEMPERATE', 'DRY', 'BOREAL', 'COASTAL'],
            requiresClearedLand: true, minLandCoverageBps: 9000 }),
    storyVisualSourceDefinition('urbanFunctionalModern',
        'assets/maps/urban-functional-atlas-modern-v1.png',
        'URBAN', 'URBAN_FUNCTIONAL', { family: 'urban', domains: ['LAND'],
            climateZones: ['TEMPERATE', 'COASTAL'], requiresClearedLand: true,
            minLandCoverageBps: 9000 }),
    storyVisualSourceDefinition('urbanFunctionalBorealModern',
        'assets/maps/urban-functional-boreal-modern-v1.png',
        'URBAN', 'URBAN_FUNCTIONAL', { family: 'urban', domains: ['LAND'],
            climateZones: ['BOREAL'], requiresClearedLand: true, minLandCoverageBps: 9000 }),
    storyVisualSourceDefinition('urbanFunctionalDryModern',
        'assets/maps/urban-functional-dry-modern-v1.png',
        'URBAN', 'URBAN_FUNCTIONAL', { family: 'urban', domains: ['LAND'],
            climateZones: ['DRY'], requiresClearedLand: true, minLandCoverageBps: 9000 }),
    storyVisualSourceDefinition('urbanDamageModern',
        'assets/maps/urban-damage-atlas-modern-v1.png',
        'URBAN', 'URBAN_DAMAGE', { family: 'urban-damage', domains: ['LAND'],
            requiresClearedLand: true, minLandCoverageBps: 9000 }),
    storyVisualSourceDefinition('specialFacilitiesModern',
        'assets/maps/special-facilities-atlas-modern-v1.png',
        'FACILITY', 'SPECIAL_FACILITY', { family: 'facility', domains: ['LAND'],
            climateZones: ['TEMPERATE', 'DRY', 'BOREAL', 'COASTAL'],
            requiresClearedLand: true, minLandCoverageBps: 9000 }),
    storyVisualSourceDefinition('industrialSectorsModern',
        'assets/maps/industrial-sector-atlas-modern-v1.png',
        'FACILITY', 'SECTOR_FACILITY', { family: 'industry', domains: ['LAND'],
            requiresClearedLand: true, minLandCoverageBps: 9000 }),
    storyVisualSourceDefinition('landUseModern', 'assets/maps/land-use-atlas-modern-v1.png',
        'LAND_USE', 'LAND_USE', { family: 'land-use', domains: ['LAND'],
            purposes: ['LAND_USE', 'AGRICULTURE', 'FORESTRY', 'MINE', 'RENEWABLE'],
            minLandCoverageBps: 9000 }),
    storyVisualSourceDefinition('groundDetail', 'assets/maps/ground-texture-atlas-v1.png',
        'TERRAIN', 'GROUND_BASE', { family: 'ground', domains: ['LAND', 'COAST'],
            allowFlip: true }),
    storyVisualSourceDefinition('seasonalGround', 'assets/maps/seasonal-ground-atlas-v1.png',
        'TERRAIN', 'SEASON_OVERLAY', { family: 'season', domains: ['LAND', 'COAST'],
            climateZones: ['TEMPERATE', 'BOREAL'], allowFlip: true }),
    storyVisualSourceDefinition('terrainDetail', 'assets/maps/terrain-detail-atlas-v2.png',
        'TERRAIN', 'TERRAIN_DETAIL', { family: 'terrain', domains: ['LAND', 'COAST'],
            allowFlip: true, minLandCoverageBps: 5500 }),
    storyVisualSourceDefinition('ruralEnvironment',
        'assets/maps/rural-environment-atlas-v1.png',
        'TERRAIN', 'RURAL_DETAIL', { family: 'rural', domains: ['LAND'],
            allowFlip: true, minLandCoverageBps: 9000 }),
    storyVisualSourceDefinition('geographyVarietyModern',
        'assets/maps/geography-variety-atlas-modern-v1.png',
        'TERRAIN', 'GEOGRAPHY_DETAIL', { family: 'geography', domains: ['LAND', 'COAST'],
            purposes: ['GEOGRAPHY_DETAIL', 'TERRAIN_DETAIL', 'MOUNTAIN', 'FOREST',
                'PETROLEUM', 'MINERAL'],
            allowFlip: true, minLandCoverageBps: 6000 }),
    storyVisualSourceDefinition('maritime', 'assets/maps/maritime-atlas-v2.png',
        'MARITIME', 'MARITIME_DECORATION', { family: 'maritime', domains: ['WATER'],
            anchor: 'WATER_HEX_CENTER', clipToHex: false }),
    storyVisualSourceDefinition('modernPorts',
        'assets/maps/modern-port-terminal-atlas-v1.png',
        'MARITIME', 'PORT_TERMINAL', { family: 'port', domains: ['COAST'],
            anchor: 'COAST_LAND_EDGE', clipToHex: false, minLandCoverageBps: 3500 }),
    storyVisualSourceDefinition('seaDetail', 'assets/maps/sea-detail-atlas-v2.png',
        'MARITIME', 'SEA_DETAIL', { family: 'sea', domains: ['WATER'],
            anchor: 'WATER_HEX_CENTER', clipToHex: true }),
    storyVisualSourceDefinition('transportRoad',
        'assets/maps/transport-road-convoy-modern-v1.png',
        'MOBILE', 'ROAD_TRANSPORT', { family: 'truck', domains: ['LAND', 'COAST', 'MOBILE'],
            anchor: 'ROUTE_CENTER', clipToHex: false, allowFlip: true }),
    storyVisualSourceDefinition('transportRail',
        'assets/maps/transport-freight-train-modern-v1.png',
        'MOBILE', 'RAIL_TRANSPORT', { family: 'train', domains: ['LAND', 'COAST', 'MOBILE'],
            anchor: 'ROUTE_CENTER', clipToHex: false, allowFlip: true }),
    storyVisualSourceDefinition('transportSea',
        'assets/maps/transport-cargo-ship-modern-v1.png',
        'MOBILE', 'SEA_TRANSPORT', { family: 'ship', domains: ['WATER', 'COAST', 'MOBILE'],
            anchor: 'ROUTE_CENTER', clipToHex: false, allowFlip: true }),
    storyVisualSourceDefinition('conflictFireOverlay',
        'assets/maps/conflict-fire-overlay-modern-v1.png',
        'CONFLICT', 'FIRE_OVERLAY', { family: 'fire', domains: ['LAND', 'COAST', 'OVERLAY'],
            anchor: 'ASSET_CENTER', clipToHex: false }),
    storyVisualSourceDefinition(null, 'assets/maps/terrain-mountains-atlas-v1.png',
        'NATURAL_COVER', 'MOUNTAIN', { id: 'archive.mountains.v1', status: 'ARCHIVED',
            archivedAliasOf: 'mountains' }),
    storyVisualSourceDefinition(null, 'assets/maps/terrain-forests-atlas-v1.png',
        'NATURAL_COVER', 'FOREST', { id: 'archive.forests.v1', status: 'ARCHIVED',
            archivedAliasOf: 'forests' }),
    storyVisualSourceDefinition(null, 'assets/maps/settlements-atlas-v1.png',
        'URBAN', 'URBAN_BASELINE', { id: 'archive.settlements.v1', status: 'ARCHIVED',
            archivedAliasOf: 'settlements' }),
    storyVisualSourceDefinition(null, 'assets/maps/settlements-atlas-v2.png',
        'URBAN', 'URBAN_BASELINE', { id: 'archive.settlements.v2', status: 'ARCHIVED',
            archivedAliasOf: 'settlements' }),
    storyVisualSourceDefinition(null, 'assets/maps/terrain-detail-atlas-v1.png',
        'TERRAIN', 'TERRAIN_DETAIL', { id: 'archive.terrain-detail.v1', status: 'ARCHIVED',
            archivedAliasOf: 'terrainDetail' }),
    storyVisualSourceDefinition(null, 'assets/maps/maritime-atlas-v1.png',
        'MARITIME', 'MARITIME_DECORATION', { id: 'archive.maritime.v1', status: 'ARCHIVED',
            archivedAliasOf: 'maritime', domains: ['WATER'] }),
    storyVisualSourceDefinition(null, 'assets/maps/sea-detail-atlas-v1.png',
        'MARITIME', 'SEA_DETAIL', { id: 'archive.sea-detail.v1', status: 'ARCHIVED',
            archivedAliasOf: 'seaDetail', domains: ['WATER'] })
]);

const STORY_VISUAL_URBAN_KIND = Object.freeze({
    CORE: { family: 'core', packId: 'urban-core', legacyAtlasRow: null },
    RESIDENTIAL: { family: 'residential', packId: 'urban-core', legacyAtlasRow: 0 },
    INDUSTRIAL: { family: 'industrial', packId: 'urban-industry', legacyAtlasRow: 2 },
    CIVIC: { family: 'civic', packId: 'urban-core', legacyAtlasRow: 1 },
    DEFENSE: { family: 'defense', packId: 'conflict-state', legacyAtlasRow: 1 },
    LOGISTICS: { family: 'logistics', packId: 'urban-logistics', legacyAtlasRow: 2 }
});

const STORY_VISUAL_CONSTRUCTION_FAMILIES = Object.freeze({
    RESIDENTIAL: { row: 0, family: 'residential' },
    INDUSTRIAL: { row: 1, family: 'industrial' },
    LOGISTICS: { row: 2, family: 'logistics' },
    CIVIC: { row: 3, family: 'civic' }
});

const STORY_VISUAL_CONSTRUCTION_PHASES = Object.freeze({
    FOUNDATION: { column: 0, minProgressBps: 0 },
    STRUCTURE: { column: 1, minProgressBps: 3300 },
    OPERATING: { column: 2, minProgressBps: 10000 },
    DAMAGED: { column: 3, minProgressBps: 0 }
});

const STORY_VISUAL_CLIMATE_ZONES = Object.freeze({
    TEMPERATE: { column: 0 },
    DRY: { column: 1 },
    BOREAL: { column: 2 },
    COASTAL: { column: 3 }
});

const STORY_VISUAL_A2_URBAN_FAMILIES = Object.freeze({
    CORE: { row: 0, family: 'core', packId: 'urban-core' },
    RESIDENTIAL: { row: 1, family: 'residential', packId: 'urban-core' },
    CIVIC: { row: 2, family: 'civic', packId: 'urban-core' },
    INDUSTRIAL: { row: 3, family: 'industrial', packId: 'urban-industry' }
});

// HXD-7.4.3c: iklim atlası çevresel uyumu korur; bu atlas ise aynı iklim
// kuşağındaki bütün ilçelerin aynı gri silüete dönüşmesini engeller. Satırlar
// gerçek kentsel işleve, sütunlar deterministik mimari varyanta aittir.
const STORY_VISUAL_FUNCTIONAL_FAMILIES = Object.freeze({
    RESIDENTIAL: { row: 0, family: 'residential', packId: 'urban-core' },
    CIVIC: { row: 1, family: 'civic', packId: 'urban-core' },
    COMMERCIAL: { row: 2, family: 'commercial', packId: 'urban-core' },
    INDUSTRIAL: { row: 3, family: 'industrial', packId: 'urban-industry' }
});

const STORY_VISUAL_DAMAGE_STATES = Object.freeze({
    OPERATING: { column: 0 },
    DAMAGED: { column: 1 },
    BURNED: { column: 2 },
    ABANDONED: { column: 3 }
});

const STORY_VISUAL_SPECIAL_FAMILIES = Object.freeze({
    LOGISTICS: { row: 0, family: 'logistics', packId: 'urban-logistics' },
    ENERGY: { row: 1, family: 'energy', packId: 'urban-industry' },
    EXTRACTION: { row: 2, family: 'extraction', packId: 'urban-industry' },
    DEFENSE: { row: 3, family: 'defense', packId: 'conflict-state' }
});

// HXD-6.9 A3: Şehir içindeki gerçek PhysicalSiteV1 sektörünü, genel bir
// "sanayi" silüeti yerine kendi kanonik tesisiyle gösterir. Hücre sırası
// üretilen 3x2 atlasın sözleşmesidir; fiziksel site olmadan bu seçici çalışmaz.
const STORY_VISUAL_SECTOR_FACILITIES = Object.freeze({
    civil_industry: { cell: 0, family: 'civil_industry', packId: 'urban-industry' },
    advanced_tech: { cell: 1, family: 'advanced_tech', packId: 'urban-industry' },
    defense_industry: { cell: 2, family: 'defense_industry', packId: 'conflict-state' },
    energy: { cell: 3, family: 'energy', packId: 'urban-industry' },
    extraction: { cell: 4, family: 'extraction', packId: 'urban-industry' },
    agriculture: { cell: 5, family: 'agriculture', packId: 'land-use' }
});

const STORY_VISUAL_LAND_USE_FAMILIES = Object.freeze({
    AGRICULTURE: { row: 0, family: 'agriculture' },
    FORESTRY: { row: 1, family: 'forestry' },
    MINE: { row: 2, family: 'mine' },
    RENEWABLE: { row: 3, family: 'renewable' }
});

const STORY_VISUAL_LAND_USE_PHASES = Object.freeze({
    SETUP: { column: 0 },
    OPERATING: { column: 1 },
    DAMAGED: { column: 2 },
    RECLAIMED: { column: 3 }
});

// HXD-9B: hareketli görsel yalnız ShipmentV2 üzerindeki gerçek araç sınıfından
// çözülür. Bu kayıtlar dekoratif trafik üretmez; renderer yalnız taşıma
// defterinin verdiği ajan için buradaki atlas anahtarını kullanır.
const STORY_VISUAL_TRANSPORT_CLASSES = Object.freeze({
    ROAD_CONVOY: {
        family: 'truck', atlasKey: 'transportRoad', atlasCell: 0,
        source: 'assets/maps/transport-road-convoy-modern-v1.png', mirrorForReverse: true
    },
    FREIGHT_TRAIN: {
        family: 'train', atlasKey: 'transportRail', atlasCell: 0,
        source: 'assets/maps/transport-freight-train-modern-v1.png', mirrorForReverse: true
    },
    CARGO_SHIP: {
        family: 'ship', atlasKey: 'transportSea', atlasCell: 0,
        source: 'assets/maps/transport-cargo-ship-modern-v1.png', mirrorForReverse: true
    }
});

const STORY_VISUAL_INFRASTRUCTURE_CLASSES = Object.freeze({
    ROAD: Object.freeze({
        family: 'road',
        styles: Object.freeze([
            { width: 1.00, innerWidth: .42, dash: [] },
            { width: 1.08, innerWidth: .48, dash: [] },
            { width: 1.14, innerWidth: .54, dash: [] },
            { width: 1.20, innerWidth: .58, dash: [] },
            { width: 1.26, innerWidth: .62, dash: [] }
        ])
    }),
    RAIL: Object.freeze({
        family: 'rail',
        styles: Object.freeze([
            { width: 1.00, innerWidth: .38, dash: [5, 4] },
            { width: 1.08, innerWidth: .42, dash: [6, 3] },
            { width: 1.14, innerWidth: .46, dash: [7, 3] },
            { width: 1.20, innerWidth: .50, dash: [8, 2] },
            { width: 1.26, innerWidth: .54, dash: [9, 2] }
        ])
    }),
    UTILITY: Object.freeze({
        family: 'utility',
        styles: Object.freeze([
            { width: .72, innerWidth: .26, dash: [2, 4] },
            { width: .78, innerWidth: .30, dash: [3, 4] },
            { width: .84, innerWidth: .34, dash: [4, 3] },
            { width: .90, innerWidth: .38, dash: [5, 3] },
            { width: .96, innerWidth: .42, dash: [6, 2] }
        ])
    })
});

// İlk manifest mevcut modern atlasın fiziksel olarak sunduğu altı aileyi ilan
// eder. Yeni resim/atlas eklemek renderer değişikliği değil, bu manifestin veri
// üretim adımı olacaktır. CORE satırı nüfus seviyesine göre tarifte tamamlanır.
const STORY_VISUAL_BASELINE_URBAN_ASSETS = Object.entries(STORY_VISUAL_URBAN_KIND)
    .map(([kind, definition]) => Object.freeze({
        id: `urban.${kind.toLowerCase()}.baseline.operating.modern_2010`,
        packId: definition.packId,
        family: definition.family,
        atlasKey: 'settlements',
        atlasRow: definition.legacyAtlasRow,
        periodId: 'MODERN_2010',
        visualStage: 0,
        condition: 'OPERATING'
    }));

const STORY_VISUAL_CONSTRUCTION_ASSETS = Object.entries(STORY_VISUAL_CONSTRUCTION_FAMILIES)
    .flatMap(([projectType, family]) => Object.entries(STORY_VISUAL_CONSTRUCTION_PHASES)
        .map(([phase, phaseDefinition]) => Object.freeze({
            id: `construction.${family.family}.${phase.toLowerCase()}.modern_2010`,
            packId: STORY_VISUAL_URBAN_KIND[projectType]
                ? STORY_VISUAL_URBAN_KIND[projectType].packId : 'urban-core',
            family: family.family,
            atlasKey: 'constructionModern',
            atlasCell: family.row * 4 + phaseDefinition.column,
            atlasRow: family.row,
            atlasColumn: phaseDefinition.column,
            periodId: 'MODERN_2010',
            visualStage: 0,
            condition: phase === 'FOUNDATION' || phase === 'STRUCTURE'
                ? 'CONSTRUCTION' : phase
        })));

function storyVisualGridAssets(domain, atlasKey, rows, columns, columnField) {
    return Object.entries(rows).flatMap(([rowId, row]) => Object.entries(columns)
        .map(([columnId, column]) => Object.freeze({
            id: `${domain}.${row.family}.${columnId.toLowerCase()}.modern_2010`,
            packId: row.packId || 'land-use',
            family: row.family,
            [columnField]: columnId,
            atlasKey,
            atlasCell: row.row * 4 + column.column,
            atlasRow: row.row,
            atlasColumn: column.column,
            periodId: 'MODERN_2010',
            visualStage: 0,
            condition: columnField === 'condition' ? columnId : 'OPERATING',
            sourceRowId: rowId
        })));
}

const STORY_VISUAL_URBAN_CLIMATE_ASSETS = storyVisualGridAssets(
    'urban-climate', 'urbanClimateModern', STORY_VISUAL_A2_URBAN_FAMILIES,
    STORY_VISUAL_CLIMATE_ZONES, 'climateZone'
);
const STORY_VISUAL_URBAN_FUNCTIONAL_ASSETS = Object.entries(STORY_VISUAL_FUNCTIONAL_FAMILIES)
    .flatMap(([familyId, definition]) => Array.from({ length: 4 }, (_, variant) => Object.freeze({
        id: `urban-functional.${definition.family}.variant_${variant}.modern_2010`,
        packId: definition.packId,
        family: definition.family,
        functionalFamily: familyId,
        variant,
        atlasKey: 'urbanFunctionalModern',
        atlasCell: definition.row * 4 + variant,
        atlasRow: definition.row,
        atlasColumn: variant,
        periodId: 'MODERN_2010',
        visualStage: 0,
        condition: 'OPERATING'
    })));
const STORY_VISUAL_URBAN_FUNCTIONAL_BOREAL_ASSETS = STORY_VISUAL_URBAN_FUNCTIONAL_ASSETS
    .map(entry => Object.freeze(Object.assign({}, entry, {
        id: entry.id.replace('urban-functional.', 'urban-functional-boreal.'),
        atlasKey: 'urbanFunctionalBorealModern',
        climateZone: 'BOREAL'
    })));
const STORY_VISUAL_URBAN_FUNCTIONAL_DRY_ASSETS = STORY_VISUAL_URBAN_FUNCTIONAL_ASSETS
    .map(entry => Object.freeze(Object.assign({}, entry, {
        id: entry.id.replace('urban-functional.', 'urban-functional-dry.'),
        atlasKey: 'urbanFunctionalDryModern',
        climateZone: 'DRY'
    })));
const STORY_VISUAL_URBAN_DAMAGE_ASSETS = storyVisualGridAssets(
    'urban-damage', 'urbanDamageModern', STORY_VISUAL_A2_URBAN_FAMILIES,
    STORY_VISUAL_DAMAGE_STATES, 'condition'
);
const STORY_VISUAL_SPECIAL_ASSETS = storyVisualGridAssets(
    'special', 'specialFacilitiesModern', STORY_VISUAL_SPECIAL_FAMILIES,
    STORY_VISUAL_CLIMATE_ZONES, 'climateZone'
);
const STORY_VISUAL_LAND_USE_ASSETS = storyVisualGridAssets(
    'land-use', 'landUseModern', STORY_VISUAL_LAND_USE_FAMILIES,
    STORY_VISUAL_LAND_USE_PHASES, 'lifecyclePhase'
);
const STORY_VISUAL_SECTOR_FACILITY_ASSETS = Object.entries(STORY_VISUAL_SECTOR_FACILITIES)
    .map(([sectorId, definition]) => Object.freeze({
        id: `sector-facility.${definition.family}.operating.modern_2010`,
        packId: definition.packId,
        family: definition.family,
        sectorId,
        atlasKey: 'industrialSectorsModern',
        atlasCell: definition.cell,
        source: 'assets/maps/industrial-sector-atlas-modern-v1.png',
        periodId: 'MODERN_2010',
        visualStage: 0,
        condition: 'OPERATING'
    }));
const STORY_VISUAL_TRANSPORT_ASSETS = Object.entries(STORY_VISUAL_TRANSPORT_CLASSES)
    .map(([vehicleClass, definition]) => Object.freeze({
        id: `mobile.${definition.family}.baseline.operating.modern_2010`,
        packId: 'mobile-agents',
        family: definition.family,
        vehicleClass,
        atlasKey: definition.atlasKey,
        atlasCell: definition.atlasCell,
        source: definition.source,
        periodId: 'MODERN_2010',
        visualStage: 0,
        condition: 'OPERATING'
    }));

const STORY_VISUAL_CONFLICT_ASSETS = Object.freeze([
    Object.freeze({
        id: 'conflict.fire.active.modern_2010',
        packId: 'conflict-state',
        family: 'fire',
        atlasKey: 'conflictFireOverlay',
        atlasCell: 0,
        source: 'assets/maps/conflict-fire-overlay-modern-v1.png',
        periodId: 'MODERN_2010',
        visualStage: 0,
        condition: 'BURNING'
    })
]);

const STORY_VISUAL_ASSET_MANIFEST = Object.freeze([
    ...STORY_VISUAL_BASELINE_URBAN_ASSETS,
    ...STORY_VISUAL_CONSTRUCTION_ASSETS,
    ...STORY_VISUAL_URBAN_CLIMATE_ASSETS,
    ...STORY_VISUAL_URBAN_FUNCTIONAL_ASSETS,
    ...STORY_VISUAL_URBAN_FUNCTIONAL_BOREAL_ASSETS,
    ...STORY_VISUAL_URBAN_FUNCTIONAL_DRY_ASSETS,
    ...STORY_VISUAL_URBAN_DAMAGE_ASSETS,
    ...STORY_VISUAL_SPECIAL_ASSETS,
    ...STORY_VISUAL_LAND_USE_ASSETS,
    ...STORY_VISUAL_SECTOR_FACILITY_ASSETS,
    ...STORY_VISUAL_TRANSPORT_ASSETS,
    ...STORY_VISUAL_CONFLICT_ASSETS
]);

function storyVisualPeriodIndex(period) {
    const id = String(period && period.id || period || 'MODERN_2010');
    const index = STORY_VISUAL_PERIODS.findIndex(row => row.id === id);
    return index < 0 ? 0 : index;
}

function storyVisualSelectionContext(input) {
    const spec = input || {};
    const calendarPeriod = storyVisualPeriodForYear(spec.year);
    const sources = Array.isArray(spec.installedSources)
        ? spec.installedSources : [spec.installedSource];
    const installedStage = sources.reduce((maximum, source) =>
        Math.max(maximum, storyVisualExplicitInstalledStage(source)), 0);
    const researchCeiling = spec.state
        ? storyVisualResearchCeiling(spec.state, spec.techById) : 4;
    const visualStage = Math.min(installedStage, researchCeiling);
    const assetPeriodIndex = Math.min(storyVisualPeriodIndex(calendarPeriod), visualStage);
    return {
        calendarPeriodId: calendarPeriod.id,
        installedStage,
        researchCeiling,
        visualStage,
        visualStageName: STORY_VISUAL_INSTALL_STAGES[visualStage],
        assetPeriodId: STORY_VISUAL_PERIODS[assetPeriodIndex].id
    };
}

function storyVisualHexDomain(input) {
    const spec = input || {};
    const explicit = String(spec.hexDomain || spec.domain || '').toUpperCase();
    if (STORY_VISUAL_HEX_DOMAINS.includes(explicit)) return explicit;
    if (spec.mobile) return 'MOBILE';
    if (spec.overlay) return 'OVERLAY';
    if (spec.port || spec.coastal) return 'COAST';
    const coverage = Number(spec.landCoverageBps);
    if (Number.isFinite(coverage)) {
        if (coverage <= 0) return 'WATER';
        if (coverage < 9400) return 'COAST';
        return 'LAND';
    }
    const cover = String(spec.cover || spec.coverType || '').toUpperCase();
    if (cover === 'WATER') return 'WATER';
    if (cover === 'COAST') return 'COAST';
    return 'LAND';
}

function storyVisualSourceCandidates(input) {
    const spec = input || {};
    const selection = storyVisualSelectionContext(spec);
    const purpose = String(spec.purpose || '').toUpperCase();
    const category = String(spec.category || '').toUpperCase();
    const family = String(spec.family || '').toLowerCase();
    const domain = storyVisualHexDomain(spec);
    const climateZone = storyVisualClimateZone(spec);
    const preferred = new Set((spec.preferredAtlasKeys || []).map(String));
    const targetPeriod = storyVisualPeriodIndex(selection.assetPeriodId);
    return STORY_VISUAL_SOURCE_CATALOG
        .filter(source => source.status === 'ACTIVE')
        .filter(source => !purpose || source.purposes.includes(purpose))
        .filter(source => !category || source.category === category)
        .filter(source => !family || source.family === family)
        .filter(source => source.domains.includes(domain)
            || domain === 'MOBILE' && source.category === 'MOBILE')
        .filter(source => source.climateZones.includes('ANY')
            || source.climateZones.includes(climateZone))
        .filter(source => source.visualStage <= selection.visualStage
            && storyVisualPeriodIndex(source.periodId) <= targetPeriod)
        .map(source => {
            let score = source.visualStage * 20
                + storyVisualPeriodIndex(source.periodId) * 10;
            if (purpose && source.purposes.includes(purpose)) score += 120;
            if (category && source.category === category) score += 60;
            if (family && source.family === family) score += 35;
            if (source.climateZones.includes(climateZone)) score += 25;
            else if (source.climateZones.includes('ANY')) score += 5;
            if (preferred.has(source.atlasKey)) score += 80;
            return { source, score };
        })
        .sort((a, b) => b.score - a.score
            || String(a.source.id).localeCompare(String(b.source.id), 'en'));
}

function storyVisualSelectCategorizedSource(input) {
    const spec = input || {};
    const selection = storyVisualSelectionContext(spec);
    const candidates = storyVisualSourceCandidates(spec);
    const selected = candidates[0] && candidates[0].source || null;
    if (!selected) return Object.assign({}, selection, {
        ok: false,
        source: null,
        atlasKey: null,
        fallbackReason: 'NO_COMPATIBLE_CATEGORY_SOURCE'
    });
    const fallback = selected.visualStage < selection.visualStage
        || selected.periodId !== selection.assetPeriodId;
    return Object.assign({}, selection, {
        ok: true,
        source: selected,
        sourceId: selected.id,
        atlasKey: selected.atlasKey,
        category: selected.category,
        purpose: selected.purpose,
        placement: selected.placement,
        fallbackReason: fallback ? 'PERIOD_ASSET_MISSING' : null,
        candidateCount: candidates.length
    });
}

function storyVisualAtlasPlacementPolicy(atlasKey) {
    const source = STORY_VISUAL_SOURCE_CATALOG.find(entry =>
        entry.status === 'ACTIVE' && entry.atlasKey === String(atlasKey || ''));
    return source ? source.placement : null;
}

function storyVisualPlacementDecision(input) {
    const spec = input || {};
    const source = STORY_VISUAL_SOURCE_CATALOG.find(entry =>
        entry.status === 'ACTIVE' && entry.atlasKey === String(spec.atlasKey || ''));
    const domain = storyVisualHexDomain(spec);
    if (!source) return {
        ok: false, domain, reason: 'UNCATEGORIZED_ATLAS', atlasKey: spec.atlasKey || null
    };
    if (!source.domains.includes(domain)
        && !(domain === 'MOBILE' && source.category === 'MOBILE')) {
        return {
            ok: false, domain, reason: 'HEX_DOMAIN_MISMATCH',
            atlasKey: source.atlasKey, sourceId: source.id
        };
    }
    const coverage = Number(spec.landCoverageBps);
    if (Number.isFinite(coverage)
        && coverage < source.placement.minLandCoverageBps) {
        return {
            ok: false, domain, reason: 'INSUFFICIENT_LAND_FOOTPRINT',
            atlasKey: source.atlasKey, sourceId: source.id
        };
    }
    const cover = String(spec.cover || spec.coverType || '').toUpperCase();
    if (source.placement.requiresClearedLand
        && ['FOREST', 'MOUNTAIN'].includes(cover) && !spec.physicalOccupancy) {
        return {
            ok: false, domain, reason: 'UNCLEARED_HEX',
            atlasKey: source.atlasKey, sourceId: source.id
        };
    }
    const climateZone = storyVisualClimateZone(spec);
    if (!source.climateZones.includes('ANY')
        && !source.climateZones.includes(climateZone)) {
        return {
            ok: false, domain, reason: 'REGIONAL_CLIMATE_MISMATCH',
            atlasKey: source.atlasKey, sourceId: source.id
        };
    }
    return {
        ok: true,
        domain,
        climateZone,
        atlasKey: source.atlasKey,
        sourceId: source.id,
        category: source.category,
        purpose: source.purpose,
        anchor: source.placement.anchor,
        clipToHex: source.placement.clipToHex,
        rotation: source.placement.allowRotation ? Number(spec.rotation) || 0 : 0,
        flipX: source.placement.allowFlip ? !!spec.flipX : false
    };
}

function storyVisualTransportAsset(vehicleClass, year, installedSource) {
    const normalized = String(vehicleClass || '').toUpperCase();
    const definition = STORY_VISUAL_TRANSPORT_CLASSES[normalized] || null;
    const context = storyVisualSelectionContext({
        year: year == null ? (typeof STORY !== 'undefined' && STORY.year) || 2010 : year,
        installedSource
    });
    if (!definition) return {
        ok: false, vehicleClass: normalized, periodId: context.calendarPeriodId,
        fallbackReason: 'UNKNOWN_VEHICLE_CLASS'
    };
    const resolvedAssetId = `mobile.${definition.family}.baseline.operating.modern_2010`;
    const requestedAssetId = [
        'mobile', definition.family, context.visualStageName.toLowerCase(),
        'operating', context.assetPeriodId.toLowerCase()
    ].join('.');
    const fallbackDepth = requestedAssetId === resolvedAssetId ? 0 : 1;
    const categorized = storyVisualSelectCategorizedSource({
        purpose: normalized === 'ROAD_CONVOY' ? 'ROAD_TRANSPORT'
            : normalized === 'FREIGHT_TRAIN' ? 'RAIL_TRANSPORT' : 'SEA_TRANSPORT',
        hexDomain: 'MOBILE',
        year: year == null ? (typeof STORY !== 'undefined' && STORY.year) || 2010 : year,
        installedSource,
        preferredAtlasKeys: [definition.atlasKey]
    });
    const placement = storyVisualPlacementDecision({
        atlasKey: categorized.ok ? categorized.atlasKey : definition.atlasKey,
        hexDomain: 'MOBILE'
    });
    return Object.assign({
        ok: true,
        vehicleClass: normalized,
        periodId: context.calendarPeriodId,
        assetPeriodId: context.assetPeriodId,
        visualStage: context.visualStage,
        visualStageName: context.visualStageName,
        requestedAssetId,
        resolvedAssetId,
        fallbackDepth,
        fallbackReason: fallbackDepth ? 'PERIOD_ASSET_MISSING' : null,
        category: categorized.category || 'MOBILE',
        purpose: categorized.purpose || null,
        placement
    }, definition);
}

function storyVisualInfrastructureRecipe(input) {
    const spec = input || {};
    const kind = String(spec.kind || spec.infrastructureClass || 'ROAD').toUpperCase();
    const definition = STORY_VISUAL_INFRASTRUCTURE_CLASSES[kind]
        || STORY_VISUAL_INFRASTRUCTURE_CLASSES.ROAD;
    const context = storyVisualSelectionContext({
        year: spec.year,
        installedSource: spec.segment || spec.installedSource,
        state: spec.state,
        techById: spec.techById
    });
    const condition = storyVisualNormalizeCondition(spec.condition
        || spec.segment && (spec.segment.lifecycleState || spec.segment.status));
    const requestedAssetId = [
        'infrastructure', definition.family, context.visualStageName.toLowerCase(),
        condition.toLowerCase(), context.assetPeriodId.toLowerCase()
    ].join('.');
    const resolvedAssetId =
        `infrastructure.${definition.family}.baseline.operating.modern_2010`;
    const fallbackDepth = requestedAssetId === resolvedAssetId ? 0 : 1;
    return Object.assign({}, context, {
        kind,
        family: definition.family,
        condition,
        requestedAssetId,
        resolvedAssetId,
        fallbackDepth,
        fallbackReason: fallbackDepth ? 'PERIOD_ASSET_MISSING' : null,
        assetMissing: false,
        renderStyle: definition.styles[context.visualStage]
    });
}

function storyVisualAuditSelections(selections) {
    const rows = Array.isArray(selections) ? selections.filter(Boolean) : [];
    const byReason = Object.create(null);
    const missingRequestedIds = [];
    let exactCount = 0, fallbackCount = 0, assetMissingCount = 0;
    for (const row of rows) {
        if (row.assetMissing) assetMissingCount++;
        if (Number(row.fallbackDepth) > 0 || row.fallbackReason) {
            fallbackCount++;
            const reason = String(row.fallbackReason || 'UNSPECIFIED_FALLBACK');
            byReason[reason] = (byReason[reason] || 0) + 1;
            if (row.requestedAssetId && !missingRequestedIds.includes(row.requestedAssetId)) {
                missingRequestedIds.push(row.requestedAssetId);
            }
        } else exactCount++;
    }
    return {
        selectionCount: rows.length,
        exactCount,
        fallbackCount,
        assetMissingCount,
        byReason,
        missingRequestedIds
    };
}

function storyVisualClampInt(value, min, max) {
    return Math.max(min, Math.min(max, Math.floor(Number(value) || 0)));
}

function storyVisualPeriodForYear(year) {
    const target = storyVisualClampInt(year == null ? 2010 : year, 2010, 2100);
    return STORY_VISUAL_PERIODS.find(period => target >= period.from && target <= period.to)
        || STORY_VISUAL_PERIODS[0];
}

function storyVisualNormalizeCondition(value) {
    const condition = String(value || 'OPERATING').toUpperCase();
    return STORY_VISUAL_CONDITIONS.includes(condition) ? condition : 'OPERATING';
}

function storyVisualExplicitInstalledStage(source) {
    if (!source || typeof source !== 'object') return 0;
    const candidates = [
        source.visualInstalledStage,
        source.installedVisualStage,
        source.installedTechStage,
        source.visualStage
    ];
    for (const value of candidates) {
        if (Number.isFinite(Number(value))) return storyVisualClampInt(value, 0, 4);
        const name = String(value || '').toUpperCase();
        const index = STORY_VISUAL_INSTALL_STAGES.indexOf(name);
        if (index >= 0) return index;
    }
    return 0;
}

// Eski teknoloji kayıtları görsel kademe taşımıyor ve bu nedenle şehri geleceğe
// sıçratamaz. Yeni teknoloji kayıtları `visualStage` eklediğinde yalnız tavanı
// yükseltir; gerçek görünüm için ayrıca kurulu varlık gerekir.
function storyVisualResearchCeiling(state, techById) {
    const lookup = techById || (typeof TECH_BY_ID !== 'undefined' ? TECH_BY_ID : {});
    let ceiling = 0;
    for (const id of (state && Array.isArray(state.tech) ? state.tech : [])) {
        const tech = lookup && lookup[id];
        ceiling = Math.max(ceiling, storyVisualExplicitInstalledStage(tech));
    }
    return storyVisualClampInt(ceiling, 0, 4);
}

function storyVisualFacilityForDistrict(node, kind, companyEconomy) {
    const ledger = companyEconomy || (typeof STORY !== 'undefined' && STORY.companyEconomy);
    if (!node || !ledger || !ledger.facilities) return null;
    const regionId = `region:${Number(node.id)}`;
    const preferred = {
        INDUSTRIAL: ['civil_industry', 'advanced_tech', 'defense_industry'],
        LOGISTICS: ['logistics'],
        DEFENSE: ['defense_industry'],
        CIVIC: ['services'],
        RESIDENTIAL: ['construction']
    }[kind] || [];
    if (!preferred.length) return null;
    const facilities = Object.values(ledger.facilities).filter(facility =>
        facility && facility.regionId === regionId && facility.status === 'OPERATING'
        && preferred.includes(facility.sectorId));
    return facilities.sort((a, b) => {
        const ai = preferred.indexOf(a.sectorId), bi = preferred.indexOf(b.sectorId);
        const ar = ai < 0 ? 999 : ai, br = bi < 0 ? 999 : bi;
        return ar - br || String(a.id).localeCompare(String(b.id), 'en');
    })[0] || null;
}

function storyVisualLegacyUrbanRow(kind, visualLevel, industrial) {
    if (kind !== 'CORE') {
        const entry = STORY_VISUAL_URBAN_KIND[kind] || STORY_VISUAL_URBAN_KIND.RESIDENTIAL;
        return entry.legacyAtlasRow;
    }
    const level = storyVisualClampInt(visualLevel || 1, 1, 3);
    return industrial && level < 3 ? 2 : level >= 3 ? 3 : level - 1;
}

function storyVisualAssetFallbackIds(recipe) {
    const kind = String(recipe && recipe.kind || 'CORE').toLowerCase();
    const stage = String(recipe && recipe.visualStageName || 'BASELINE').toLowerCase();
    const condition = String(recipe && recipe.condition || 'OPERATING').toLowerCase();
    const period = String(recipe && (recipe.assetPeriodId || recipe.periodId)
        || 'MODERN_2010').toLowerCase();
    const ids = [
        `urban.${kind}.${stage}.${condition}.${period}`,
        `urban.${kind}.${stage}.operating.${period}`,
        `urban.${kind}.${stage}.operating.modern_2010`,
        `urban.${kind}.baseline.operating.modern_2010`
    ];
    return ids.filter((id, index) => ids.indexOf(id) === index);
}

function storyVisualResolveAsset(recipe, manifest) {
    const entries = Array.isArray(manifest) ? manifest : STORY_VISUAL_ASSET_MANIFEST;
    const byId = new Map(entries.map(entry => [entry.id, entry]));
    const candidates = storyVisualAssetFallbackIds(recipe);
    for (let depth = 0; depth < candidates.length; depth++) {
        const entry = byId.get(candidates[depth]);
        if (entry) return {
            ok: true,
            entry,
            requestedId: candidates[0],
            resolvedId: entry.id,
            fallbackDepth: depth,
            fallbackReason: depth ? 'REQUESTED_ASSET_MISSING' : null
        };
    }
    return {
        ok: false,
        entry: null,
        requestedId: candidates[0],
        resolvedId: null,
        fallbackDepth: candidates.length,
        fallbackReason: 'NO_REGISTERED_ASSET_FALLBACK'
    };
}

function storyVisualConstructionProgressBps(command, physicalSite) {
    if (command && command.status === 'COMPLETED') return 10000;
    const duration = Math.max(0, Number(command && command.requirements
        && command.requirements.durationDays) || 0);
    const remaining = Math.max(0, Number(command && command.remainingDays) || 0);
    if (duration) {
        return storyVisualClampInt(Math.round((1 - remaining / duration) * 10000), 0, 10000);
    }
    const explicit = Number(physicalSite && physicalSite.constructionProgressBps);
    if (Number.isFinite(explicit)) return storyVisualClampInt(explicit, 0, 10000);
    return 0;
}

function storyVisualConstructionPhase(command, physicalSite) {
    const condition = storyVisualNormalizeCondition(physicalSite && physicalSite.lifecycleState);
    if (condition === 'DAMAGED' || condition === 'BURNED') return 'DAMAGED';
    if (command && command.status === 'COMPLETED' || condition === 'OPERATING') return 'OPERATING';
    return storyVisualConstructionProgressBps(command, physicalSite) >= 3300
        ? 'STRUCTURE' : 'FOUNDATION';
}

function storyVisualConstructionRecipe(input) {
    const spec = input || {};
    const command = spec.command || null;
    const physicalSite = spec.physicalSite || null;
    const projectType = String(spec.projectType || command && command.projectType
        || physicalSite && physicalSite.siteType || 'RESIDENTIAL').toUpperCase();
    const definition = STORY_VISUAL_CONSTRUCTION_FAMILIES[projectType]
        || STORY_VISUAL_CONSTRUCTION_FAMILIES.RESIDENTIAL;
    const phase = storyVisualConstructionPhase(command, physicalSite);
    const period = storyVisualPeriodForYear(spec.year == null
        ? (typeof STORY !== 'undefined' && STORY.year) || 2010 : spec.year);
    const requestedId = `construction.${definition.family}.${phase.toLowerCase()}.${period.id.toLowerCase()}`;
    const fallbackIds = [
        requestedId,
        `construction.${definition.family}.${phase.toLowerCase()}.modern_2010`
    ].filter((id, index, rows) => rows.indexOf(id) === index);
    const entries = Array.isArray(spec.assetManifest)
        ? spec.assetManifest : STORY_VISUAL_ASSET_MANIFEST;
    const byId = new Map(entries.map(entry => [entry.id, entry]));
    let entry = null, fallbackDepth = fallbackIds.length;
    for (let index = 0; index < fallbackIds.length; index++) {
        if (!byId.has(fallbackIds[index])) continue;
        entry = byId.get(fallbackIds[index]);
        fallbackDepth = index;
        break;
    }
    const atlasKey = entry && entry.atlasKey || 'constructionModern';
    return {
        schemaVersion: STORY_VISUAL_CATALOG_SCHEMA_VERSION,
        catalogVersion: STORY_VISUAL_CATALOG_VERSION,
        projectType,
        family: definition.family,
        phase,
        progressBps: storyVisualConstructionProgressBps(command, physicalSite),
        periodId: period.id,
        requestedAssetId: requestedId,
        resolvedAssetId: entry && entry.id || null,
        atlasKey,
        atlasCell: entry && Number(entry.atlasCell),
        fallbackDepth,
        fallbackReason: entry ? (fallbackDepth ? 'PERIOD_ASSET_MISSING' : null)
            : 'NO_REGISTERED_CONSTRUCTION_ASSET',
        assetMissing: !entry,
        category: 'URBAN',
        purpose: 'CONSTRUCTION',
        placement: storyVisualPlacementDecision({
            atlasKey,
            hexDomain: 'LAND',
            landCoverageBps: spec.landCoverageBps == null ? 10000 : spec.landCoverageBps,
            cover: spec.cover,
            physicalOccupancy: !!physicalSite
        })
    };
}

function storyVisualClimateZone(input) {
    const spec = input || {};
    const explicit = String(spec.climateZone || '').toUpperCase();
    if (STORY_VISUAL_CLIMATE_ZONES[explicit]) return explicit;
    const node = spec.node || null;
    if (node && (node.port || node.isPort || node.coastal)) return 'COASTAL';
    const latitudeY = Number(node && (node.ly ?? node.normalizedY));
    if (Number.isFinite(latitudeY)) {
        const calendar = spec.calendar || (typeof STORY !== 'undefined'
            && typeof storyCalendarNow === 'function' ? storyCalendarNow() : null);
        const winterPresentation = !calendar || Number(calendar.month) === 12
            || Number(calendar.month) <= 3;
        if (latitudeY <= .31 && winterPresentation) return 'BOREAL';
        if (latitudeY >= .67) return 'DRY';
    }
    return 'TEMPERATE';
}

function storyVisualResolveVariant(domain, family, variant, period, manifest) {
    const periodId = String(period && period.id || period || 'MODERN_2010').toLowerCase();
    const stem = `${domain}.${String(family).toLowerCase()}.${String(variant).toLowerCase()}`;
    const candidates = [`${stem}.${periodId}`, `${stem}.modern_2010`]
        .filter((id, index, rows) => rows.indexOf(id) === index);
    const entries = Array.isArray(manifest) ? manifest : STORY_VISUAL_ASSET_MANIFEST;
    const byId = new Map(entries.map(entry => [entry.id, entry]));
    for (let index = 0; index < candidates.length; index++) {
        const entry = byId.get(candidates[index]);
        if (!entry) continue;
        return {
            assetMissing: false,
            requestedAssetId: candidates[0],
            resolvedAssetId: entry.id,
            atlasKey: entry.atlasKey,
            atlasCell: Number(entry.atlasCell),
            fallbackDepth: index,
            fallbackReason: index ? 'PERIOD_ASSET_MISSING' : null
        };
    }
    return {
        assetMissing: true,
        requestedAssetId: candidates[0],
        resolvedAssetId: null,
        atlasKey: null,
        atlasCell: null,
        fallbackDepth: candidates.length,
        fallbackReason: 'NO_REGISTERED_VARIANT_ASSET'
    };
}

function storyVisualSpecialFamily(input) {
    const spec = input || {};
    const kind = String(spec.kind || '').toUpperCase();
    if (kind === 'LOGISTICS' || kind === 'DEFENSE') return kind;
    const site = spec.physicalSite || {};
    const siteType = String(site.siteType || '').toUpperCase();
    const sector = String(site.sectorId || '').toLowerCase();
    if (siteType === 'LOGISTICS') return 'LOGISTICS';
    if (siteType === 'DEFENSE' || sector.includes('defense')) return 'DEFENSE';
    if (siteType === 'ENERGY' || sector.includes('energy')) return 'ENERGY';
    if (['EXTRACTION', 'MINE', 'MINERAL'].includes(siteType)
        || sector.includes('extract') || sector.includes('mining')) return 'EXTRACTION';
    return null;
}

function storyVisualSectorFacilityRecipe(input) {
    const spec = input || {};
    const site = spec.physicalSite || null;
    const sectorId = String(site && site.sectorId || '').toLowerCase();
    const definition = STORY_VISUAL_SECTOR_FACILITIES[sectorId] || null;
    const condition = storyVisualNormalizeCondition(spec.condition
        || site && site.lifecycleState || 'OPERATING');
    if (!site || !definition || condition !== 'OPERATING') return null;
    const mechanics = spec.mechanics || storyVisualUrbanRecipe(spec);
    const period = mechanics.assetPeriodId || mechanics.periodId || 'MODERN_2010';
    return Object.assign({
        sectorId,
        family: definition.family,
        condition,
        sourcePhysicalSiteId: site.id || null
    }, storyVisualResolveVariant('sector-facility', definition.family,
        'OPERATING', period, spec.assetManifest));
}

function storyVisualStableVariant(value) {
    const text = String(value == null ? '' : value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % 4;
}

function storyVisualFunctionalFamily(input, mechanics) {
    const spec = input || {};
    const siteType = String(spec.physicalSite && spec.physicalSite.siteType || '').toUpperCase();
    const kind = String(mechanics && mechanics.kind || spec.kind || 'CORE').toUpperCase();
    if (siteType === 'RESIDENTIAL' || kind === 'RESIDENTIAL') return 'RESIDENTIAL';
    if (siteType === 'CIVIC' || kind === 'CIVIC' || kind === 'DEFENSE') return 'CIVIC';
    if (siteType === 'INDUSTRIAL' || kind === 'INDUSTRIAL') return 'INDUSTRIAL';
    if (siteType === 'LOGISTICS' || kind === 'LOGISTICS') return 'COMMERCIAL';
    // Şehir çekirdeği nüfus seviyesi yükseldikçe konut kümesinden ticaret ve
    // ofis silüetine geçer; bu yalnız sunumdur, yeni tesis uydurmaz.
    return Number(spec.visualLevel) >= 2 ? 'COMMERCIAL' : 'RESIDENTIAL';
}

function storyVisualUrbanFunctionalRecipe(input, mechanics) {
    const spec = input || {};
    const familyId = storyVisualFunctionalFamily(spec, mechanics);
    const definition = STORY_VISUAL_FUNCTIONAL_FAMILIES[familyId];
    const identity = spec.physicalSite && spec.physicalSite.id
        || spec.district && spec.district.id
        || `${spec.node && spec.node.id || 0}:${mechanics && mechanics.kind || spec.kind || 'CORE'}`;
    const variant = storyVisualStableVariant(identity);
    const climateZone = storyVisualClimateZone(spec);
    const climate = climateZone === 'BOREAL' ? {
        prefix: 'urban-functional-boreal', atlasKey: 'urbanFunctionalBorealModern'
    } : climateZone === 'DRY' ? {
        prefix: 'urban-functional-dry', atlasKey: 'urbanFunctionalDryModern'
    } : {
        prefix: 'urban-functional', atlasKey: 'urbanFunctionalModern'
    };
    const contextual = storyVisualSelectCategorizedSource({
        purpose: 'URBAN_FUNCTIONAL',
        climateZone,
        hexDomain: 'LAND',
        year: spec.year,
        state: spec.state,
        techById: spec.techById,
        installedSources: [spec.node, spec.urbanFootprint, spec.physicalSite],
        preferredAtlasKeys: [climate.atlasKey]
    });
    const atlasKey = contextual.ok ? contextual.atlasKey : climate.atlasKey;
    const prefix = atlasKey === 'urbanFunctionalBorealModern'
        ? 'urban-functional-boreal'
        : atlasKey === 'urbanFunctionalDryModern'
            ? 'urban-functional-dry' : 'urban-functional';
    return {
        assetMissing: false,
        requestedAssetId: `${prefix}.${definition.family}.variant_${variant}.modern_2010`,
        resolvedAssetId: `${prefix}.${definition.family}.variant_${variant}.modern_2010`,
        atlasKey,
        atlasCell: definition.row * 4 + variant,
        atlasRow: definition.row,
        atlasColumn: variant,
        fallbackDepth: contextual.fallbackReason ? 1 : 0,
        fallbackReason: contextual.fallbackReason,
        category: contextual.category || 'URBAN',
        purpose: contextual.purpose || 'URBAN_FUNCTIONAL',
        functionalFamily: familyId,
        functionalVariant: variant
    };
}

function storyVisualUrbanClimateRecipe(input, mechanics) {
    const spec = input || {};
    const kind = String(mechanics && mechanics.kind || spec.kind || 'CORE').toUpperCase();
    const definition = STORY_VISUAL_A2_URBAN_FAMILIES[kind]
        || STORY_VISUAL_A2_URBAN_FAMILIES.CORE;
    const climateZone = storyVisualClimateZone(spec);
    const period = mechanics && (mechanics.assetPeriodId || mechanics.periodId)
        || storyVisualPeriodForYear(spec.year);
    const resolved = storyVisualResolveVariant('urban-climate', definition.family,
        climateZone, period, spec.assetManifest);
    const contextual = storyVisualSelectCategorizedSource({
        purpose: 'URBAN_CLIMATE',
        climateZone,
        hexDomain: 'LAND',
        year: spec.year,
        state: spec.state,
        techById: spec.techById,
        installedSources: [spec.node, spec.urbanFootprint],
        preferredAtlasKeys: ['urbanClimateModern']
    });
    return Object.assign({}, resolved, {
        atlasKey: contextual.ok ? contextual.atlasKey : resolved.atlasKey,
        fallbackDepth: contextual.fallbackReason ? 1 : resolved.fallbackDepth,
        fallbackReason: contextual.fallbackReason || resolved.fallbackReason,
        category: contextual.category || 'URBAN',
        purpose: contextual.purpose || 'URBAN_CLIMATE',
        climateZone
    });
}

function storyVisualUrbanPresentationRecipe(input) {
    const spec = input || {};
    const mechanics = storyVisualUrbanRecipe(spec);
    const period = mechanics.assetPeriodId || mechanics.periodId;
    const climateZone = storyVisualClimateZone(spec);
    const condition = storyVisualNormalizeCondition(spec.condition
        || spec.physicalSite && spec.physicalSite.lifecycleState || mechanics.condition);
    const damaged = ['DAMAGED', 'BURNING', 'BURNED', 'ABANDONED'].includes(condition);
    const sectorFacility = damaged ? null
        : storyVisualSectorFacilityRecipe(Object.assign({}, spec, { mechanics, condition }));
    const specialFamily = damaged || sectorFacility ? null : storyVisualSpecialFamily(spec);
    let art;
    if (damaged) {
        const family = STORY_VISUAL_A2_URBAN_FAMILIES[mechanics.kind]
            || STORY_VISUAL_A2_URBAN_FAMILIES.CORE;
        const damageCondition = condition === 'BURNING' ? 'DAMAGED' : condition;
        art = storyVisualResolveVariant('urban-damage', family.family, damageCondition,
            period, spec.assetManifest);
    } else if (sectorFacility) {
        art = sectorFacility;
    } else if (specialFamily) {
        const row = STORY_VISUAL_SPECIAL_FAMILIES[specialFamily];
        art = storyVisualResolveVariant('special', row.family, climateZone, period,
            spec.assetManifest);
    } else if (mechanics.kind === 'CORE') {
        // CORE is the civic silhouette of the city. Routing it through the
        // functional COMMERCIAL row made coastal capitals look like bus depots.
        art = storyVisualUrbanClimateRecipe(spec, mechanics);
    } else {
        art = storyVisualUrbanFunctionalRecipe(spec, mechanics);
    }
    const placement = storyVisualPlacementDecision({
        atlasKey: art.atlasKey,
        hexDomain: 'LAND',
        climateZone,
        landCoverageBps: spec.landCoverageBps == null ? 10000 : spec.landCoverageBps,
        cover: spec.cover,
        physicalOccupancy: true
    });
    return Object.assign({}, mechanics, art, {
        climateZone,
        condition,
        placement,
        fireOverlay: condition === 'BURNING',
        fireOverlayAssetId: condition === 'BURNING'
            ? 'conflict.fire.active.modern_2010' : null,
        fireOverlayAtlasKey: condition === 'BURNING' ? 'conflictFireOverlay' : null,
        fireOverlayAtlasCell: condition === 'BURNING' ? 0 : null,
        presentationSource: sectorFacility ? `SECTOR_${sectorFacility.sectorId.toUpperCase()}`
            : specialFamily ? `SPECIAL_${specialFamily}`
            : condition === 'OPERATING' || condition === 'CONSTRUCTION'
                ? (String(art.atlasKey).startsWith('urbanFunctional')
                    ? 'URBAN_FUNCTIONAL' : 'URBAN_CLIMATE')
                : 'URBAN_DAMAGE'
    });
}

function storyVisualLandUseRecipe(input) {
    const spec = input || {};
    const type = String(spec.landUseType || spec.family || 'AGRICULTURE').toUpperCase();
    const family = STORY_VISUAL_LAND_USE_FAMILIES[type]
        || STORY_VISUAL_LAND_USE_FAMILIES.AGRICULTURE;
    const lifecycle = String(spec.lifecyclePhase || spec.lifecycleState || 'OPERATING').toUpperCase();
    const phase = STORY_VISUAL_LAND_USE_PHASES[lifecycle] ? lifecycle
        : lifecycle === 'CONSTRUCTION' ? 'SETUP'
            : ['DAMAGED', 'BURNING', 'BURNED'].includes(lifecycle) ? 'DAMAGED'
                : lifecycle === 'ABANDONED' ? 'RECLAIMED' : 'OPERATING';
    const period = storyVisualPeriodForYear(spec.year == null
        ? (typeof STORY !== 'undefined' && STORY.year) || 2010 : spec.year);
    const art = storyVisualResolveVariant('land-use', family.family, phase, period,
        spec.assetManifest);
    const contextual = storyVisualSelectCategorizedSource({
        purpose: type,
        hexDomain: spec.hexDomain || 'LAND',
        year: spec.year,
        installedSource: spec.installedSource,
        preferredAtlasKeys: [art.atlasKey || 'landUseModern']
    });
    const atlasKey = contextual.ok ? contextual.atlasKey : art.atlasKey;
    return Object.assign({ family: family.family, lifecyclePhase: phase, periodId: period.id },
        art, {
            atlasKey,
            category: contextual.category || 'LAND_USE',
            purpose: contextual.purpose || type,
            placement: storyVisualPlacementDecision({
                atlasKey,
                hexDomain: spec.hexDomain || 'LAND',
                landCoverageBps: spec.landCoverageBps == null ? 10000 : spec.landCoverageBps,
                cover: spec.cover,
                physicalOccupancy: true
            })
        });
}

function storyVisualUrbanRecipe(input) {
    const spec = input || {};
    const kind = String(spec.kind || 'CORE').toUpperCase();
    const kindDef = STORY_VISUAL_URBAN_KIND[kind] || STORY_VISUAL_URBAN_KIND.CORE;
    const node = spec.node || null;
    const state = spec.state || (typeof STORY !== 'undefined' && STORY.states && node
        ? STORY.states[Number(node.owner)] : null);
    const physicalSite = spec.physicalSite || null;
    const facility = spec.facility || (!spec.physicalSites
        ? storyVisualFacilityForDistrict(node, kind, spec.companyEconomy) : null);
    const researchCeiling = storyVisualResearchCeiling(state, spec.techById);
    const installedStage = Math.max(
        storyVisualExplicitInstalledStage(node),
        storyVisualExplicitInstalledStage(spec.urbanFootprint),
        storyVisualExplicitInstalledStage(physicalSite),
        storyVisualExplicitInstalledStage(facility)
    );
    const visualStage = state ? Math.min(installedStage, researchCeiling) : installedStage;
    const period = storyVisualPeriodForYear(spec.year == null
        ? (typeof STORY !== 'undefined' && STORY.year) || 2010 : spec.year);
    const assetPeriod = STORY_VISUAL_PERIODS[
        Math.min(storyVisualPeriodIndex(period), visualStage)
    ];
    const condition = storyVisualNormalizeCondition(spec.condition
        || (physicalSite && physicalSite.lifecycleState)
        || (facility && facility.status) || 'OPERATING');
    const atlasRow = storyVisualLegacyUrbanRow(
        kind, spec.visualLevel, !!spec.industrial
    );
    const logicalAssetId = [
        'urban', kind.toLowerCase(), STORY_VISUAL_INSTALL_STAGES[visualStage].toLowerCase(),
        condition.toLowerCase(), assetPeriod.id.toLowerCase()
    ].join('.');
    const baseRecipe = {
        schemaVersion: STORY_VISUAL_CATALOG_SCHEMA_VERSION,
        catalogVersion: STORY_VISUAL_CATALOG_VERSION,
        kind,
        logicalAssetId,
        packId: kindDef.packId,
        family: kindDef.family,
        periodId: period.id,
        assetPeriodId: assetPeriod.id,
        installedStage,
        researchCeiling,
        visualStage,
        visualStageName: STORY_VISUAL_INSTALL_STAGES[visualStage],
        condition,
        sourcePhysicalSiteId: physicalSite && physicalSite.id || null,
        sourceFacilityId: physicalSite && physicalSite.sourceFacilityId
            || facility && facility.id || null
    };
    const resolved = storyVisualResolveAsset(baseRecipe, spec.assetManifest);
    return Object.assign(baseRecipe, {
        resolvedAssetId: resolved.resolvedId,
        atlasKey: resolved.entry && resolved.entry.atlasKey || 'settlements',
        atlasRow: resolved.entry && resolved.entry.atlasRow != null
            ? resolved.entry.atlasRow : atlasRow,
        fallbackDepth: resolved.fallbackDepth,
        fallbackReason: resolved.fallbackReason,
        assetMissing: !resolved.ok
    });
}

function storyVisualCatalogValidate() {
    const issues = [];
    let expectedYear = 2010;
    const periodIds = new Set();
    for (const period of STORY_VISUAL_PERIODS) {
        if (periodIds.has(period.id)) issues.push(`DUPLICATE_PERIOD:${period.id}`);
        periodIds.add(period.id);
        if (period.from !== expectedYear || period.to < period.from) {
            issues.push(`PERIOD_GAP_OR_OVERLAP:${period.id}`);
        }
        expectedYear = period.to + 1;
    }
    if (expectedYear !== 2101) issues.push('PERIOD_RANGE_MUST_END_AT_2100');
    const packIds = new Set();
    for (const pack of STORY_VISUAL_ASSET_PACKS) {
        if (!pack.id || packIds.has(pack.id)) issues.push(`DUPLICATE_PACK:${pack.id || '?'}`);
        packIds.add(pack.id);
        if (!Array.isArray(pack.families) || !pack.families.length) issues.push(`EMPTY_PACK:${pack.id}`);
    }
    for (const [kind, definition] of Object.entries(STORY_VISUAL_URBAN_KIND)) {
        if (!packIds.has(definition.packId)) issues.push(`UNKNOWN_PACK:${kind}:${definition.packId}`);
        if (definition.legacyAtlasRow != null
            && (definition.legacyAtlasRow < 0 || definition.legacyAtlasRow > 3)) {
            issues.push(`INVALID_LEGACY_ROW:${kind}`);
        }
    }
    const sourceIds = new Set();
    const sourcePaths = new Set();
    const activeAtlasKeys = new Set();
    for (const source of STORY_VISUAL_SOURCE_CATALOG) {
        if (!source.id || sourceIds.has(source.id)) {
            issues.push(`DUPLICATE_VISUAL_SOURCE:${source.id || '?'}`);
        }
        sourceIds.add(source.id);
        if (!source.source || sourcePaths.has(source.source)) {
            issues.push(`DUPLICATE_VISUAL_SOURCE_PATH:${source.source || '?'}`);
        }
        sourcePaths.add(source.source);
        if (!STORY_VISUAL_SOURCE_STATUS.includes(source.status)) {
            issues.push(`INVALID_VISUAL_SOURCE_STATUS:${source.id}`);
        }
        if (!source.purposes.length) issues.push(`VISUAL_SOURCE_WITHOUT_PURPOSE:${source.id}`);
        if (!source.domains.length || source.domains.some(domain =>
            !STORY_VISUAL_HEX_DOMAINS.includes(domain))) {
            issues.push(`INVALID_VISUAL_SOURCE_DOMAIN:${source.id}`);
        }
        if (source.status === 'ACTIVE') {
            if (!source.atlasKey || activeAtlasKeys.has(source.atlasKey)) {
                issues.push(`DUPLICATE_ACTIVE_ATLAS:${source.atlasKey || '?'}`);
            }
            activeAtlasKeys.add(source.atlasKey);
        } else if (!source.archivedAliasOf || !sourceIds.has(source.archivedAliasOf)
            && !STORY_VISUAL_SOURCE_CATALOG.some(candidate =>
                candidate.atlasKey === source.archivedAliasOf)) {
            issues.push(`ARCHIVE_WITHOUT_ACTIVE_ALIAS:${source.id}`);
        }
    }
    const assetIds = new Set();
    for (const entry of STORY_VISUAL_ASSET_MANIFEST) {
        if (!entry.id || assetIds.has(entry.id)) issues.push(`DUPLICATE_ASSET:${entry.id || '?'}`);
        assetIds.add(entry.id);
        if (!packIds.has(entry.packId)) issues.push(`ASSET_UNKNOWN_PACK:${entry.id}:${entry.packId}`);
        if (!['settlements', 'constructionModern', 'urbanClimateModern', 'urbanFunctionalModern',
            'urbanFunctionalBorealModern', 'urbanFunctionalDryModern',
            'urbanDamageModern', 'specialFacilitiesModern', 'landUseModern',
            'industrialSectorsModern',
            'transportRoad', 'transportRail', 'transportSea',
            'conflictFireOverlay'].includes(entry.atlasKey)) {
            issues.push(`ASSET_UNKNOWN_ATLAS:${entry.id}`);
        }
        if (entry.atlasKey !== 'settlements'
            && (!Number.isInteger(entry.atlasCell) || entry.atlasCell < 0 || entry.atlasCell > 15)) {
            issues.push(`ASSET_INVALID_CELL:${entry.id}`);
        }
        if (!activeAtlasKeys.has(entry.atlasKey)) {
            issues.push(`ASSET_ATLAS_NOT_CATEGORIZED:${entry.id}:${entry.atlasKey}`);
        }
    }
    return { ok: issues.length === 0, issues };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STORY_VISUAL_CATALOG_SCHEMA_VERSION,
        STORY_VISUAL_CATALOG_VERSION,
        STORY_VISUAL_PERIODS,
        STORY_VISUAL_INSTALL_STAGES,
        STORY_VISUAL_CONDITIONS,
        STORY_VISUAL_ASSET_PACKS,
        STORY_VISUAL_SOURCE_STATUS,
        STORY_VISUAL_HEX_DOMAINS,
        STORY_VISUAL_SOURCE_CATALOG,
        STORY_VISUAL_URBAN_KIND,
        STORY_VISUAL_CONSTRUCTION_FAMILIES,
        STORY_VISUAL_CONSTRUCTION_PHASES,
        STORY_VISUAL_CLIMATE_ZONES,
        STORY_VISUAL_A2_URBAN_FAMILIES,
        STORY_VISUAL_FUNCTIONAL_FAMILIES,
        STORY_VISUAL_DAMAGE_STATES,
        STORY_VISUAL_SPECIAL_FAMILIES,
        STORY_VISUAL_SECTOR_FACILITIES,
        STORY_VISUAL_LAND_USE_FAMILIES,
        STORY_VISUAL_LAND_USE_PHASES,
        STORY_VISUAL_TRANSPORT_CLASSES,
        STORY_VISUAL_INFRASTRUCTURE_CLASSES,
        STORY_VISUAL_CONFLICT_ASSETS,
        STORY_VISUAL_ASSET_MANIFEST,
        storyVisualPeriodForYear,
        storyVisualSelectionContext,
        storyVisualHexDomain,
        storyVisualSourceCandidates,
        storyVisualSelectCategorizedSource,
        storyVisualAtlasPlacementPolicy,
        storyVisualPlacementDecision,
        storyVisualNormalizeCondition,
        storyVisualExplicitInstalledStage,
        storyVisualResearchCeiling,
        storyVisualFacilityForDistrict,
        storyVisualLegacyUrbanRow,
        storyVisualAssetFallbackIds,
        storyVisualResolveAsset,
        storyVisualConstructionProgressBps,
        storyVisualConstructionPhase,
        storyVisualConstructionRecipe,
        storyVisualClimateZone,
        storyVisualResolveVariant,
        storyVisualSpecialFamily,
        storyVisualSectorFacilityRecipe,
        storyVisualStableVariant,
        storyVisualFunctionalFamily,
        storyVisualUrbanFunctionalRecipe,
        storyVisualUrbanClimateRecipe,
        storyVisualUrbanPresentationRecipe,
        storyVisualLandUseRecipe,
        storyVisualTransportAsset,
        storyVisualInfrastructureRecipe,
        storyVisualAuditSelections,
        storyVisualUrbanRecipe,
        storyVisualCatalogValidate
    };
}
