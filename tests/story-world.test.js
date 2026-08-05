'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
    runStorySimulation,
    probeWelfareGate,
    probeBattleTelemetry,
    probeWorldV2,
    probeMigration,
    probeDeterministicClock,
    probeSchedulerRegistry,
    probeRngStreams,
    probeCausalityLedger,
    probeCausalityGuards,
    probeStoryProjection,
    probeRegionModel,
    probeRegionActivation,
    probeRegionAggregation,
    probeInfrastructureGraph,
    probeResourceTaxonomy,
    probeProductionSectors,
    probePeacefulDiplomacy,
    probeRegionalEconomy,
    probeTradeLogistics,
    probeDomesticDistributionContract,
    probeMarketPrices,
    probeStateBudget,
    probeCompaniesBanks,
    probeProductionUnitEconomics,
    probeSaleSettlement,
    probeSaleSettlementResume,
    probeEconomicAI,
    probePopulationCohorts,
    probeNeedsWelfare,
    probePublicOpinion,
    probeCollectiveAction,
    probeHumanMigration,
    probePowerCenters,
    probeCityDossier,
    probeCanonicalMapRaster,
    probePoliticalOverlay,
    probePrebuiltMapRaster,
    probeAdaptiveMapWarp,
    probeMapCacheInvalidation
} = require('../tools/story-sim-harness');

function run() {
    const first = runStorySimulation({
        seed: 2032,
        seconds: 900,
        includeTradeProductionOpportunityView: true,
        includeOpinionStorageMetrics: true
    });
    const paretoVolumeTreatment = runStorySimulation({
        seed: 2032,
        seconds: 300,
        featureFlags: {
            'economy.saleSettlement': true,
            'economy.paretoVolumeAdmission': true,
            'economy.householdDistributionAdmission': true,
            // Bu 300 sn kabul koşusu Faz 22.1E'nin hane boru hattını izole eder.
            // Faz 27'nin küçük nüfus aktarımı bile Pareto aday sırasını değiştirip
            // aynı anda lojistik dalı çatallayabilir; göç kendi 900 sn A/B ve kriz
            // problarında ayrıca sınanır. Buradaki %83 eşiğini gevşetmiyoruz.
            'population.humanMigration': false
        }
    });
    const repeat = runStorySimulation({ seed: 2032, seconds: 900 });
    const alternate = runStorySimulation({ seed: 2033, seconds: 900 });
    const telemetryOff = runStorySimulation({
        seed: 2032,
        seconds: 900,
        featureFlags: {
            'telemetry.world': false,
            'telemetry.resources': false,
            'telemetry.performance': false,
            'welfare.continuousCap': true,
            'world.v2Projection': false,
            'knowledge.playerProjection': false
        }
    });
    const welfareCapOff = runStorySimulation({
        seed: 2032,
        seconds: 900,
        featureFlags: { 'welfare.continuousCap': false }
    });

    assert.equal(first.simulatedSeconds, 900, 'Hikâye saati 900 saniyeyi tamamlamalı.');
    assert.equal(first.snapshot.states.length, 8, 'Dünya sekiz devlet içermeli.');
    assert.ok(first.snapshot.nodes.length >= 36, 'Dünya en az 36 bölge içermeli.');
    assert.equal(
        first.stateHash,
        repeat.stateHash,
        'Aynı tohum ve aynı adımlar aynı dünya karmasını üretmeli.'
    );
    assert.notEqual(
        first.stateHash,
        alternate.stateHash,
        'Farklı tohum kontrollü olarak farklı dünya karması üretmeli.'
    );
    assert.equal(
        first.stateHash,
        telemetryOff.stateHash,
        'Gözlem katmanı kapatıldığında dünya davranışı değişmemeli.'
    );
    assert.equal(
        welfareCapOff.simulatedSeconds,
        900,
        'Davranış bayrağı kapalıyken eski akış güvenle tamamlanmalı.'
    );
    assert.throws(
        () => runStorySimulation({ seed: 2032, seconds: 1, featureFlags: { 'typo.invalid': true } }),
        /Bilinmeyen hikâye özellik bayrağı/,
        'Bilinmeyen bayrak sessizce kabul edilmemeli.'
    );
    assert.ok(first.samples.length >= 30, 'Sağlık eğrisi düzenli örneklenmeli.');
    assert.ok(first.telemetry.samples.length >= 80, 'Motor içi telemetri en az 10 saniyede bir örnek almalı.');
    assert.ok(
        (first.telemetry.counters['welfare.delta'] || 0) > 0,
        'Refah değişimleri kaynak etiketiyle ham olay defterine girmeli.'
    );
    assert.equal(
        first.telemetry.counters['territory.owner_changed'] || 0,
        0,
        'Barışla başlayan standart koşu açık savaş ilanı olmadan sahiplik değiştirmemeli.'
    );
    assert.ok(
        (first.telemetry.counters['council.decision'] || 0) > 0,
        'Konsey kararları ham olay defterine girmeli.'
    );
    assert.ok(
        (first.telemetry.counters['resource.flow'] || 0) > 0,
        'Kaynak üretim ve tüketimleri kaynak etiketiyle izlenmeli.'
    );
    assert.ok(
        Object.values(first.telemetry.resourceTotals || {}).some(total => total.source === 'income.city' && total.oil > 0),
        'Şehir geliri kaynak muhasebesinde pozitif akış üretmeli.'
    );
    assert.equal(
        first.telemetry.final.stateHash,
        repeat.telemetry.final.stateHash,
        'Motor içi durum özeti aynı tohumda tekrar üretilebilir olmalı.'
    );
    assert.ok(first.telemetry.performance.stepCount >= 899, 'Dünya adımlarının performansı ölçülmeli.');
    assert.ok(Number.isFinite(first.telemetry.performance.p95Ms), 'Performans raporu p95 üretmeli.');
    assert.ok(first.causality.commands.length <= 180, 'Canlı komut defteri sınırını aşmamalı.');
    assert.ok(first.causality.events.length <= 360, 'Canlı nedensel olay defteri sınırını aşmamalı.');
    assert.ok(first.causality.effects.length <= 720, 'Canlı etki defteri sınırını aşmamalı.');
    assert.equal(first.causalityValidation.ok, true, 'Normal uzun koşu nedensellik doğrulayıcısını geçmeli.');
    assert.equal(first.causalityWorldConsistency.ok, true, 'Normal uzun koşu dünya–defter mutabakatını geçmeli.');
    assert.equal(first.causality.guard.blockedTotal, 0, 'Normal 900 saniyelik dünya hiçbir sigortaya çarpmamalı.');
    assert.equal(first.causality.guard.invariantFailures, 0, 'Normal dünya geçersiz kalıcı değer üretmemeli.');
    assert.equal(first.regionalValidation.ok, true, 'Normal 900 saniyelik dünya geçerli bölgesel stok defteri korumalı.');
    assert.equal(first.tradeValidation.ok, true, 'Normal 900 saniyelik dünya geçerli ticaret defteri korumalı.');
    assert.equal(first.opinionValidation.ok, true,
        'Normal 900 saniyelik dünya geçerli kamuoyu hafıza defteri korumalı.');
    assert.equal(first.collectiveValidation.ok, true,
        'Normal 900 saniyelik dünya geçerli kolektif eylem defteri korumalı.');
    assert.ok(first.collectiveSummary.movementCount <= 8 * 12,
        'Kolektif eylem hafizasi ulke basi kayit tavanini asmamali.');
    assert.ok(first.collectiveSummary.activeActionCount <= 8,
        'Ulusal dikkat butcesi ulke basi tek etkin hareket sinirini korumali.');
    assert.equal(first.humanMigrationValidation.ok, true,
        'Normal 900 saniyelik dünya geçerli göç ve mülteci defteri korumalı.');
    assert.ok(first.humanMigrationSummary.flowCount <= 256,
        'Göç geçmişi sınırlı kayıt tavanını aşmamalı.');
    assert.ok(first.humanMigrationSummary.activeFlowCount <= 152,
        'Bölge başına tek etkin çıkış ilkesi aktif akışları bölge sayısının altında tutmalı.');
    assert.equal(first.powerCenterValidation.ok, true,
        'Normal 900 saniyelik dünya geçerli güç merkezi defteri korumalı.');
    assert.equal(first.powerCenterSummary.centerCount, 8 * 7,
        'Her devlet yedi kaynaklı güç merkezi taşımalı.');
    assert.ok(first.powerCenterSummary.eventCount <= 256,
        'Güç merkezi olay geçmişi sınırlı kayıt tavanını aşmamalı.');
    assert.equal(first.opinionSummary.cohortCount, 152 * 12,
        'Normal 900 saniyelik dünyada bütün kohortlar kamuoyu taşıyıcısı olarak izlenmeli.');
    assert.ok(first.opinionSummary.averageRememberedSeverityBps < 9500,
        'Sabit orta düzey baskı uzun koşuda bütün kamuoyunu kaçınılmaz olarak tavana kilitlememeli.');
    assert.ok(first.opinionSummary.saturatedCohortCount < first.opinionSummary.cohortCount,
        '900 saniyede bütün kohortlar aynı maksimum şikâyet şiddetine doymamalı.');
    assert.ok(first.opinionSummary.rememberedRecordCount <= 152 * 12 * 12,
        'Şikâyet hafızası kohort başı kayıt tavanını aşarak sınırsız büyümemeli.');
    assert.ok(first.opinionSummary.serializedCharacters > 0
        && first.opinionSummary.serializedCharacters < 2000000,
    'Faz 25 kompakt kaydı 900 saniyelik kabul dünyasında 2 milyon karakteri aşmamalı.');
    assert.equal(paretoVolumeTreatment.regionalValidation.ok, true,
        'Pareto hacim adayı bölgesel fizik defterini korumalı.');
    assert.equal(paretoVolumeTreatment.needsValidation.ok, true,
        'Pareto hacim adayı ihtiyaç defterini korumalı.');
    assert.equal(paretoVolumeTreatment.opinionValidation.ok, true,
        'Pareto hacim adayı kamuoyu hafıza defterini korumalı.');
    assert.equal(paretoVolumeTreatment.tradeValidation.ok, true,
        'Pareto hacim adayı ticaret defterini korumalı.');
    assert.equal(paretoVolumeTreatment.marketValidation.ok, true,
        'Pareto hacim adayı piyasa defterini korumalı.');
    assert.equal(paretoVolumeTreatment.budgetValidation.ok, true,
        'Pareto hacim adayı bütçe defterini korumalı.');
    assert.equal(paretoVolumeTreatment.companyValidation.ok, true,
        'Pareto hacim adayı şirket defterini korumalı.');
    assert.equal(paretoVolumeTreatment.commerceValidation.ok, true,
        'Pareto hacim adayı sahiplik/ticaret defterini korumalı.');
    assert.equal(paretoVolumeTreatment.economicAIValidation.ok, true,
        'Pareto hacim adayı ekonomik AI defterini korumalı.');
    assert.ok(paretoVolumeTreatment.final.needs.foodAccessBps >= 7900,
        'Canlı hane boru hattı 300 saniyede gıda erişimini en az %79 bandında tutmalı.');
    assert.ok(paretoVolumeTreatment.final.needs.energyAccessBps >= 8300,
        'Canlı hane boru hattı 300 saniyede enerji erişimini en az %83 bandında tutmalı.');
    assert.ok(paretoVolumeTreatment.final.needs.wellbeingBps >= 7100,
        'Canlı hane boru hattı 300 saniyede yaşam koşulunu en az %71 bandında tutmalı.');
    assert.ok(Object.entries(paretoVolumeTreatment.tradeOperationalSummary.ordersBySourceStatus)
        .some(([key, count]) => key.startsWith('AUTO_PRODUCTION_INPUT_PARETO_VOLUME|')
            && count > 0),
    'Özellik açık treatment gerçek Pareto hacim siparişleri üretmeli.');
    assert.ok(Object.entries(paretoVolumeTreatment.tradeOperationalSummary.ordersBySourceStatus)
        .some(([key, count]) => key.startsWith('AUTO_HOUSEHOLD_PIPELINE_CLEARING|')
            && count > 0),
    'Özellik açık treatment canlı nüfus talebine bağlı gerçek hane sevkiyatları üretmeli.');
    assert.equal(
        paretoVolumeTreatment.tradeSummary.diagnostics
            .householdDistributionAdmissionTotals.failed,
        0,
        'Hane dağıtım kabulü fizik veya koridor yarışında sevk kaybetmemeli.'
    );
    const stabilizedTail = first.samples.filter(sample => Number(sample.clock) >= 600);
    const stabilizedTailAverage = key => stabilizedTail.reduce(
        (sum, sample) => sum + Number(sample.needs && sample.needs[key] || 0),
        0
    ) / Math.max(1, stabilizedTail.length);
    assert.ok(first.final.needs.foodAccessBps >= 7500,
        'Varsayılan ekonomi 900 saniye sonunda gıda erişimini en az %75 bandında tutmalı.');
    assert.ok(first.final.needs.energyAccessBps >= 7700,
        'Varsayılan ekonomi 900 saniye sonunda enerji erişimini en az %77 bandında tutmalı.');
    assert.ok(first.final.needs.wellbeingBps >= 7000,
        'Varsayılan ekonomi 900 saniye sonunda yaşam koşulu %70 kabul kapısını geçmeli.');
    assert.ok(stabilizedTailAverage('foodAccessBps') >= 7500,
        'Son 300 saniyelik örneklerde ortalama gıda erişimi %75 altına düşmemeli.');
    assert.ok(stabilizedTailAverage('energyAccessBps') >= 7700,
        'Son 300 saniyelik örneklerde ortalama enerji erişimi %77 altına düşmemeli.');
    assert.ok(stabilizedTailAverage('wellbeingBps') >= 7000,
        'Son 300 saniyelik örneklerde ortalama yaşam koşulu %70 altına düşmemeli.');
    assert.equal(first.tradeProductionOpportunityView.disabled, false,
        'Üretim-girdisi karşı-olgusal gözlemcisi canlı ticaret dünyasında çalışmalı.');
    assert.ok(first.tradeProductionOpportunityView.opportunityCount > 0,
        'Karşı-olgusal gözlemci gerçek bloke üretim fırsatlarını bulmalı.');
    assert.ok(first.tradeProductionOpportunityView.opportunities.every(opportunity => (
        Number.isFinite(opportunity.score)
            && opportunity.marginal
            && Number.isFinite(opportunity.marginal.realizedValueIndex)
            && opportunity.objectives
            && Number.isFinite(opportunity.objectives.directNeedReliefBps)
            && Number.isFinite(opportunity.objectives.chainReliefBps)
            && Number.isFinite(opportunity.objectives.realizationBps)
            && Number.isFinite(opportunity.objectives.deliveryCoverageBps)
            && Number.isFinite(opportunity.objectives.economicValueIndex)
            && ['IMMEDIATE', 'CONDITIONAL', 'PIPELINE_COVERED',
                'NO_ROUTE_CAPACITY', 'NO_DOMESTIC_SOURCE']
                .includes(opportunity.status)
    )), 'Her dağıtım fırsatı sonlu marjinal değer ve açıklamalı gerçekleştirilebilirlik taşımalı.');
    const dispatchableOpportunities = first.tradeProductionOpportunityView.opportunities.filter(
        opportunity => ['IMMEDIATE', 'CONDITIONAL'].includes(opportunity.status)
    );
    assert.ok(dispatchableOpportunities.every(opportunity => (
        Number.isInteger(opportunity.countryParetoRank)
            && opportunity.countryParetoRank >= 1
            && Number.isInteger(opportunity.legacy.priorityRank)
            && opportunity.legacy.priorityRank >= 1
            && Number.isFinite(opportunity.objectives.latencySeconds)
    )), 'Fiziksel olarak sevk edilebilir her fırsat eski sıra ve Pareto katmanı taşımalı.');
    if (dispatchableOpportunities.length) {
        assert.ok(first.tradeProductionOpportunityView.paretoFrontierCount > 0,
            'Sevk edilebilir fırsatlar varsa en az bir açıklanabilir Pareto öncüsü bulunmalı.');
        assert.ok(dispatchableOpportunities.filter(opportunity => opportunity.paretoFrontier)
            .every(opportunity => opportunity.dominatedByCount === 0),
        'Pareto öncüsü ilan edilen hiçbir fırsat başka bir sevk edilebilir fırsatça ezilmemeli.');
    }
    const productionAdmission = first.tradeProductionAdmissionPlan;
    assert.equal(first.tradeDecisionObserverNeutral, true,
        'Üretim karar gözlemcisi salt-okunur olmalı; dünya durum hashini değiştirmemeli.');
    assert.equal(productionAdmission.disabled, false,
        'Üretim kabul planlayıcısı canlı ticaret dünyasında çalışmalı.');
    assert.equal(productionAdmission.validation.ok, true,
        'Kabul planı ortak stok, sahiplik, talep veya koridor kapasitesini aşmamalı.');
    assert.equal(productionAdmission.summary.conflictFree, true,
        'Kabul planı aynı karar penceresinde çifte kaynak ayırmamalı.');
    assert.ok(productionAdmission.summary.selectedCount
        <= productionAdmission.guardrails.maxDispatches,
    'Kabul planı küresel sevkiyat bütçesini aşmamalı.');
    assert.ok(productionAdmission.selected.every(selection => (
        selection.quantity > 0
            && selection.volume
            && selection.quantity <= selection.volume.pipelineUncoveredNeed + 1e-6
            && selection.volume.plannedWindowCoverageBps >= 10000
            && selection.volume.plannedWindowCoverageBps
                <= productionAdmission.guardrails.pipelineWindows * 10000 + 1
            && ['SURVIVAL', 'CHAIN_RECOVERY'].includes(selection.policyLane)
    )), 'Canlı adayı yalnız pozitif, 1–4 pencere hacimli ve açıklanabilir politika şeritlerinden seçmeli.');
    assert.ok(Object.values(productionAdmission.summary.byCountry).every(count => (
        count <= productionAdmission.guardrails.maxPerCountry
    )), 'Tek devlet karar penceresini tekeline alamamalı.');
    assert.ok(Object.entries(productionAdmission.summary.byResource).every(([resourceId, count]) => (
        count <= Number(productionAdmission.guardrails.resourceDispatchLimits[resourceId] || 0)
    )), 'Kaynak başına sevkiyat bütçesi aşılmamalı.');
    assert.equal(productionAdmission.guardrails.laneMinimumsSatisfied, true,
        'Mevcutsa hem yaşam hem zincir kurtarma şeridi karar penceresinde temsil edilmeli.');
    const selectedQuantity = productionAdmission.selected.reduce(
        (sum, selection) => sum + Number(selection.quantity || 0),
        0
    );
    const actionQuantity = productionAdmission.actions.reduce(
        (sum, action) => sum + Number(action.quantity || 0),
        0
    );
    assert.ok(Math.abs(selectedQuantity - actionQuantity) <= 1e-6,
        'Planlanan eylemlerin miktarı seçilen sevkiyat miktarını birebir korumalı.');
    assert.ok(productionAdmission.actions.every(action => (
        Math.abs(Number(action.quantity || 0) - action.legs.reduce(
            (sum, leg) => sum + Number(leg.quantity || 0),
            0
        )) <= 1e-6
    )), 'Her toplu/tekil eylem kendi bacak toplamını birebir korumalı.');
    assert.equal(first.marketValidation.ok, true, 'Normal 900 saniyelik dünya geçerli piyasa/fiyat defteri korumalı.');
    assert.equal(first.budgetValidation.ok, true, 'Normal 900 saniyelik dünya dengeli devlet bütçesi defteri korumalı.');
    assert.equal(first.companyValidation.ok, true, 'Normal 900 saniyelik dünya geçerli şirket/banka defteri korumalı.');
    assert.equal(first.companySummary.companyCount, 48, 'Açılış ekonomisi sekiz devlet × altı sektör için ayrı şirket taşımalı.');
    assert.equal(first.companySummary.bankCount, 8, 'Her devletin şirketlerden ve hazineden ayrı banka aktörü bulunmalı.');
    assert.equal(first.budgetSummary.countryCount, 8, 'Bütçe motoru sekiz devletin tamamını aynı kurallarla izlemeli.');
    assert.ok(first.budgetSummary.totalCash >= 0, 'Toplam kanonik nakit negatif olamaz.');
    assert.ok(first.marketSummary.minIndex >= 25 && first.marketSummary.maxIndex <= 800,
        'Uzun koşuda bütün fiyatlar politika sınırlarında kalmalı.');
    const retainedCommandIds = new Set(first.causality.commands.map(command => command.id));
    const retainedEventIds = new Set(first.causality.events.map(event => event.id));
    const retainedEffectIds = new Set(first.causality.effects.map(effect => effect.id));
    for (const event of first.causality.events) {
        assert.ok(retainedCommandIds.has(event.commandId), `Tutulan olayın komutu bulunmalı: ${event.id}`);
        for (const effectId of event.effectIds) {
            assert.ok(retainedEffectIds.has(effectId), `Olayın etki referansı yetim kalmamalı: ${effectId}`);
        }
    }
    for (const effect of first.causality.effects) {
        assert.ok(retainedCommandIds.has(effect.commandId), `Tutulan etkinin komutu bulunmalı: ${effect.id}`);
        assert.ok(retainedEventIds.has(effect.eventId), `Tutulan etkinin olayı bulunmalı: ${effect.id}`);
    }

    const peaceProbe = probePeacefulDiplomacy();
    assert.equal(peaceProbe.main.initialCount, 28, 'Sekiz devletin bütün 28 ikili diplomatik kenarı başlangıçta kurulmalı.');
    assert.deepEqual(peaceProbe.main.initialTreaties, { peace: 28 }, 'Yeni kampanyada bütün devletler barışta başlamalı.');
    assert.equal(peaceProbe.main.initialAllNonHostile, true, 'Barış başlangıcında hiçbir devlet çifti düşman sayılmamalı.');
    assert.equal(peaceProbe.main.expiredTreaty, 'peace', 'Ateşkes süresinin dolması otomatik savaş ilanı olmamalı.');
    assert.equal(peaceProbe.main.ownersStable, true, 'Barış döneminde AI kuşatma yoluyla diplomasi kapısını atlamamalı.');
    assert.equal(peaceProbe.main.ownerChangeEvents, 0, 'İlk 120 saniyede savaş ilanı yoksa sahiplik olayı olmamalı.');
    assert.equal(peaceProbe.restored.loaded, true, 'Barış ilişkilerini taşıyan kayıt yüklenebilmeli.');
    assert.equal(peaceProbe.restored.relationCount, 28, 'Kayıt/yükleme bütün diplomatik kenarları korumalı.');
    assert.equal(peaceProbe.restored.exact, true, 'Diplomasi tablosu kayıt/yüklemede birebir kalmalı.');
    assert.deepEqual(peaceProbe.disabled.treaties, { war: 28 }, 'Özellik kapalı A/B yolu eski tüm-savaş başlangıcını korumalı.');
    assert.equal(peaceProbe.disabled.hostile, true, 'Eski yol gerçekten düşmanlık üretmeli.');
    assert.equal(peaceProbe.ab.changed, true, 'Barış başlangıcı dünya davranışını ölçülebilir biçimde değiştirmeli.');
    assert.equal(peaceProbe.ab.onOwnerChanges, 0, 'Barış açıkken 120 saniyelik koşuda fetih olmamalı.');
    assert.ok(peaceProbe.ab.offOwnerChanges > 0, 'Eski tüm-savaş kontrolü fetih üretmeli ve A/B karşı-testi sağlamalı.');

    const battleProbe = probeBattleTelemetry();
    assert.equal(battleProbe.counter, 1, 'Tamamlanan savaş tek bir ham olay üretmeli.');
    assert.equal(battleProbe.event.payload.engineVersion, 'battlefield-v2-fixed50', 'Savaş motor sürümü telemetride korunmalı.');
    assert.equal(battleProbe.event.payload.seed, 424242, 'Savaş tohumu telemetride korunmalı.');

    const worldV2Probe = probeWorldV2();
    assert.equal(worldV2Probe.validation.ok, true, 'V1 adaptörü geçerli StoryWorldStateV2 üretmeli.');
    assert.equal(worldV2Probe.world.meta.schemaVersion, 2, 'V2 şema sürümü açıkça yazılmalı.');
    assert.ok(
        worldV2Probe.world.diagnostics.causality
        && worldV2Probe.world.diagnostics.causality.schemaVersion === 1,
        'V2 projeksiyonu nedensellik defterinin sürüm ve sayaçlarını taşımalı.'
    );
    assert.ok(
        worldV2Probe.world.diagnostics.causality.guard
        && worldV2Probe.world.diagnostics.causality.guard.schemaVersion === 1,
        'V2 teşhisi zincir sigortası sayaçlarını taşımalı.'
    );
    assert.ok(
        worldV2Probe.world.events.some(event => String(event.id).startsWith('causal-world-event:')),
        'V2 olay akışı komut kaynaklı nedensel olayları da taşımalı.'
    );
    assert.equal(worldV2Probe.world.countries.length, 8, 'V2 adaptörü sekiz ülkeyi korumalı.');
    assert.equal(worldV2Probe.world.regions.length, first.snapshot.nodes.length, 'V2 adaptörü bütün bölgeleri korumalı.');
    assert.equal(worldV2Probe.beforeHash, worldV2Probe.afterHash, 'V2 dışa aktarımı canlı dünyayı değiştirmemeli.');
    assert.equal(worldV2Probe.isolated, true, 'V2 projeksiyonu canlı V1 nesnelerine referans sızdırmamalı.');
    assert.equal(worldV2Probe.emptyWorldValidation.ok, true, 'V2 varsayılan boş dünya kendi şemasını geçmeli.');

    assert.ok(
        worldV2Probe.invalidCases.missingField.issues.some(issue => issue.code === 'MISSING_FIELD'),
        'Eksik V2 üst alanı açıklamalı hata üretmeli.'
    );
    assert.ok(
        worldV2Probe.invalidCases.unknownField.issues.some(issue => issue.code === 'UNKNOWN_FIELD'),
        'Şema dışı V2 üst alanı açıklamalı hata üretmeli.'
    );
    assert.ok(
        worldV2Probe.invalidCases.duplicateId.issues.some(issue => issue.code === 'DUPLICATE_ID'),
        'Çakışan V2 kimliği açıklamalı hata üretmeli.'
    );
    assert.ok(
        worldV2Probe.invalidCases.brokenReference.issues.some(issue => issue.code === 'BROKEN_REFERENCE'),
        'Kırık V2 referansı açıklamalı hata üretmeli.'
    );
    assert.ok(
        worldV2Probe.invalidCases.invalidClock.issues.some(issue => issue.code === 'INVALID_CLOCK'),
        'Bozuk V2 saat değeri açıklamalı hata üretmeli.'
    );
    assert.equal(worldV2Probe.knowledge.validation.ok, true, 'Oyuncu bilgi projeksiyonu kendi sözleşmesini geçmeli.');
    assert.equal(worldV2Probe.knowledge.secretLeaked, false, 'Yabancı ülkenin gizli kesin değerleri oyuncuya sızmamalı.');
    assert.equal(worldV2Probe.knowledge.ownResources.status, 'VERIFIED', 'Kendi hazine değeri doğrulanmış görünmeli.');
    assert.equal(worldV2Probe.knowledge.foreignResources.status, 'UNKNOWN', 'Yabancı hazine değeri bilinmiyor görünmeli.');
    assert.equal(worldV2Probe.knowledge.foreignResources.value, null, 'Bilinmeyen yabancı hazine gerçek değer taşımamalı.');
    assert.equal(worldV2Probe.knowledge.invalidUnknownRejected, true, 'UNKNOWN bilgi güven veya değer taşıyarak üretilememeli.');
    assert.equal(worldV2Probe.knowledge.estimatedFact.status, 'ESTIMATED', 'Tahmin ayrı bilgi sınıfı olmalı.');
    assert.equal(worldV2Probe.knowledge.rumorFact.status, 'RUMOR', 'Söylenti ayrı bilgi sınıfı olmalı.');

    const regionProbe = probeRegionModel();
    assert.equal(regionProbe.main.count, 152, 'Kanonik dünya tam 152 bölge taşımalı.');
    assert.equal(regionProbe.main.validation.ok, true, 'Yeni kampanya RegionModel sözleşmesini geçmeli.');
    assert.equal(regionProbe.main.identityMatches, true, 'Kalıcı bölge kimliği legacy dizi indeksi ve konumuyla birebir eşleşmeli.');
    assert.equal(regionProbe.main.topologyMatches, true, 'RegionModel komşuluğu canlı düğüm topolojisiyle birebir eşleşmeli.');
    assert.equal(regionProbe.main.transferApplied, true, 'Bölge sahipliği canlı mutasyon kapısından değişebilmeli.');
    assert.equal(regionProbe.main.saveOk, true, 'Sahiplik değişimi türetilmiş katmanları bayat bırakarak kaydı engellememeli.');
    assert.equal(regionProbe.main.savedNodeOwner, 1, 'Yeni bölge sahibi gerçek kayıt yüküne yazılmalı.');
    assert.equal(regionProbe.main.dynamicOwnerAfter, 'country:1', 'Dinamik bölge görünümü yeni sahipliği tek kaynaktan okumalı.');
    assert.equal(regionProbe.main.worldOwnerAfter, 'country:1', 'V2 projeksiyonu aynı canlı sahipliği görmeli.');
    assert.equal(
        regionProbe.main.topologyHashBefore,
        regionProbe.main.topologyHashAfter,
        'Sahiplik değişimi sabit bölge topolojisini değiştirmemeli.'
    );
    assert.equal(regionProbe.main.v2Validation.ok, true, 'RegionModel kaynaklı V2 bölgeleri konum ve lojistik sözleşmesini geçmeli.');
    assert.ok(
        regionProbe.main.invalidLiveValidation.issues.some(issue => issue.code === 'NODE_INDEX_ID_MISMATCH'),
        'Dizi indeksi–bölge kimliği sapması açıklamalı değişmez hatası üretmeli.'
    );
    assert.equal(regionProbe.restored.loaded, true, 'RegionModel taşıyan kayıt yüklenebilmeli.');
    assert.equal(regionProbe.restored.validation.ok, true, 'Yüklenen RegionModel yeniden doğrulanmalı.');
    assert.equal(regionProbe.restored.exactModel, true, 'Geçerli RegionModel kayıt/yüklemede birebir korunmalı.');
    assert.equal(regionProbe.restored.owner, 'country:1', 'Dinamik sahiplik kayıt/yüklemede korunmalı.');
    assert.equal(regionProbe.legacy.loaded, true, 'RegionModel taşımayan eski kayıt backfill ile açılmalı.');
    assert.equal(regionProbe.legacy.validation.ok, true, 'Eski kayıt backfill’i geçerli topoloji üretmeli.');
    assert.equal(regionProbe.legacy.model.diagnostics.backfilled, true, 'Eski kayıt backfill’i sessiz olmamalı.');
    assert.ok(regionProbe.legacy.model.diagnostics.warnings.length > 0, 'Eski kayıt bölge backfill’i uyarı taşımalı.');
    assert.equal(regionProbe.corrupt.loaded, true, 'Bozuk RegionModel canlı düğümleri kaybetmeden açılmalı.');
    assert.equal(regionProbe.corrupt.validation.ok, true, 'Bozuk RegionModel güvenli yeniden kurulumdan sonra doğrulanmalı.');
    assert.equal(regionProbe.corrupt.model.diagnostics.restoredFromInvalidModel, true, 'Bozuk model fallback’i açıkça teşhis edilmeli.');
    assert.ok(regionProbe.corrupt.model.diagnostics.issues.length > 0, 'Bozuk modelin reddedilme nedeni saklanmalı.');
    assert.equal(regionProbe.disabled.snapshot.disabled, true, 'world.regionModel kapalıyken yan model güvenli biçimde devre dışı kalmalı.');
    assert.equal(regionProbe.disabled.worldValidation.ok, true, 'Bayrak kapalı legacy V2 adaptörü yeni bölge sözleşmesini yine geçmeli.');
    assert.equal(regionProbe.disabled.regionCount, 152, 'Bayrak kapalıyken oynanış bölgeleri kaybolmamalı.');
    assert.equal(regionProbe.ab.equal, true, 'RegionModel açık/kapalı normal dünya karmasını değiştirmemeli.');

    const activationProbe = probeRegionActivation();
    assert.equal(activationProbe.main.validation.ok, true, 'Aktivasyon görünümü kendi sözleşmesini geçmeli.');
    assert.deepEqual(
        {
            HOT: activationProbe.main.snapshot.summary.HOT,
            WARM: activationProbe.main.snapshot.summary.WARM,
            COLD: activationProbe.main.snapshot.summary.COLD
        },
        { HOT: 12, WARM: 48, COLD: 92 },
        '152 bölge 12 HOT, 48 WARM ve 92 COLD bütçesine ayrılmalı.'
    );
    assert.equal(activationProbe.main.commanderBefore.level, 'HOT', 'Oyuncu komutanının bulunduğu bölge daima HOT olmalı.');
    assert.equal(activationProbe.main.uiNeutral, true, 'Kamera, seçili şehir ve açık paneller aktivasyon görünümünü değiştirmemeli.');
    assert.equal(activationProbe.main.beforeHash, activationProbe.main.afterUiHash, 'Salt UI hareketi dünya karmasını değiştirmemeli.');
    assert.equal(activationProbe.main.batchesRepeatable, true, 'Aynı sistem ve tik aynı bölge çalışma dilimini üretmeli.');
    assert.equal(activationProbe.main.cadenceMatches, true, '20 tikte HOT/WARM/COLD bölgeler tam 20/5/1 kez çalışmalı.');
    assert.ok(
        activationProbe.main.benchmark.wallTimeMs < 1000,
        `250 aktivasyon dilimi bir saniyelik tezgâh bütçesini aşmamalı: ${activationProbe.main.benchmark.wallTimeMs} ms`
    );
    assert.equal(activationProbe.main.moved, true, 'Oyuncu komutanı hedef bölgeye taşınabilmeli.');
    assert.equal(activationProbe.main.movedRegion.level, 'HOT', 'Önceden COLD olan yeni komutan bölgesi anında HOT olmalı.');
    assert.ok(
        activationProbe.main.damagedValidation.issues.some(issue => issue.code === 'INVALID_LEVEL'),
        'Şema dışı aktivasyon seviyesi açıklamalı biçimde reddedilmeli.'
    );
    assert.ok(
        activationProbe.main.damagedValidation.issues.some(issue => issue.code === 'DUPLICATE_REGION_ID'),
        'Yinelenen aktivasyon kimliği açıklamalı biçimde reddedilmeli.'
    );
    assert.equal(activationProbe.restored.loaded, true, 'Aktivasyon politikası taşıyan kayıt yüklenebilmeli.');
    assert.equal(activationProbe.restored.validation.ok, true, 'Yükleme sonrası türetilen aktivasyon görünümü geçerli olmalı.');
    assert.equal(activationProbe.restored.exactPolicy, true, 'Geçerli aktivasyon politikası kayıt/yüklemede birebir korunmalı.');
    assert.equal(activationProbe.restored.exactSnapshot, true, 'Aynı dünya kaydı aynı aktivasyon görünümünü yeniden üretmeli.');
    assert.equal(activationProbe.legacy.loaded, true, 'Aktivasyon politikası taşımayan eski kayıt açılmalı.');
    assert.equal(activationProbe.legacy.validation.ok, true, 'Eski kaydın türetilmiş aktivasyon görünümü geçerli olmalı.');
    assert.equal(activationProbe.legacy.policy.diagnostics.backfilled, true, 'Eski kayıt aktivasyon fallback’i sessiz olmamalı.');
    assert.ok(activationProbe.legacy.policy.diagnostics.warnings.length > 0, 'Eski kayıt aktivasyon fallback’i uyarı taşımalı.');
    assert.equal(activationProbe.corrupt.loaded, true, 'Bozuk aktivasyon politikası dünya kaybı olmadan açılmalı.');
    assert.equal(activationProbe.corrupt.validation.ok, true, 'Bozuk politika yeniden kurulduktan sonra görünüm geçerli olmalı.');
    assert.equal(
        activationProbe.corrupt.policy.diagnostics.restoredFromInvalidPolicy,
        true,
        'Bozuk aktivasyon politikası kurtarması açık teşhis taşımalı.'
    );
    assert.equal(activationProbe.disabled.snapshot.disabled, true, 'world.regionActivation kapalıyken görünüm güvenli biçimde kapanmalı.');
    assert.equal(activationProbe.disabled.batch.length, 152, 'Bayrak kapalı legacy yol her bölgeyi her tik çalıştırmalı.');
    assert.equal(activationProbe.disabled.validation.ok, true, 'Kapalı aktivasyon görünümü kendi sözleşmesini geçmeli.');
    assert.equal(activationProbe.disabled.worldValidation.ok, true, 'Aktivasyon kapalıyken V2 dünya geçerli kalmalı.');
    assert.equal(activationProbe.uiOutcome.equal, true, '60 saniyelik yoğun kamera/panel kullanımı ekonomik ve siyasi sonucu değiştirmemeli.');
    assert.deepEqual(activationProbe.uiOutcome.differences, [], 'UI tarafsızlık koşusunda hiçbir dünya alanı ayrışmamalı.');
    assert.equal(activationProbe.ab.equal, true, 'Aktivasyon açık/kapalı normal dünya karmasını değiştirmemeli.');

    const aggregationProbe = probeRegionAggregation();
    assert.equal(aggregationProbe.main.validation.ok, true, 'Toplulaştırma görünümü kendi sözleşmesini geçmeli.');
    assert.equal(aggregationProbe.main.snapshot.regions.length, 152, 'Her bölge bir korunum özeti taşımalı.');
    assert.ok(aggregationProbe.main.liveConservation.population > 0, 'Korunum testi sıfır olmayan gerçek nüfus üzerinde çalışmalı.');
    assert.ok(
        aggregationProbe.main.liveConservation.countryResources.oil > 0
        && aggregationProbe.main.liveConservation.countryResources.manpower > 0
        && aggregationProbe.main.liveConservation.countryResources.points > 0,
        'Dünya korunum imzası sıfır olmayan ulusal kaynak toplamlarını taşımalı.'
    );
    assert.equal(
        JSON.stringify(aggregationProbe.main.snapshot.conservation),
        JSON.stringify(aggregationProbe.main.liveConservation),
        'Toplulaştırılmış dünya nüfus, servet, altyapı, garnizon, yatak, kuyruk ve havuz toplamlarını korumalı.'
    );
    assert.equal(
        JSON.stringify(aggregationProbe.main.coldConservation),
        JSON.stringify(aggregationProbe.main.liveConservation),
        '152 HOT→COLD geçişinin toplamları canlı dünya ile birebir uyuşmalı.'
    );
    assert.equal(aggregationProbe.main.allCapsulesValid, true, 'Bütün COLD kapsülleri checksum ve topoloji doğrulamasını geçmeli.');
    assert.equal(aggregationProbe.main.allHydrated, true, 'Bütün COLD kapsülleri yeniden HOT açılabilmeli.');
    assert.equal(aggregationProbe.main.allExact, true, '152 bölgenin HOT→COLD→HOT turu kanonik içeriği birebir korumalı.');
    assert.equal(aggregationProbe.main.fixtureExact, true, 'Üretim kuyruğu, stok, şirket, olay, kuşatma ve bilinmeyen gelecek alanı round-tripte korunmalı.');
    assert.equal(aggregationProbe.main.fixtureCold.summary.production.count, 2, 'Üretim kuyruğu sayısı COLD özetine taşınmalı.');
    assert.equal(aggregationProbe.main.fixtureCold.summary.companies.count, 2, 'Şirket kimlikleri COLD özetine taşınmalı.');
    assert.equal(aggregationProbe.main.fixtureCold.summary.pendingEvents.count, 2, 'Bekleyen bölgesel olay sayısı COLD özetine taşınmalı.');
    assert.equal(aggregationProbe.main.fixtureCold.summary.pendingEvents.activeSiege, true, 'Aktif kuşatma COLD özetinde kaybolmamalı.');
    assert.equal(
        JSON.stringify(aggregationProbe.main.distributionA),
        JSON.stringify(aggregationProbe.main.distributionB),
        'Deterministik dağıtım giriş anahtarı sırasından etkilenmemeli.'
    );
    assert.equal(aggregationProbe.main.distributionTotal, 100.007, 'Deterministik dağıtım küsurat dâhil toplamı tam korumalı.');
    assert.ok(
        aggregationProbe.main.damagedPayloadValidation.issues.some(issue => issue.code === 'PAYLOAD_HASH_MISMATCH'),
        'Checksum sonrası değiştirilen payload açıklamalı biçimde reddedilmeli.'
    );
    assert.equal(aggregationProbe.main.damagedHot.ok, false, 'Bozuk kapsül HOT dünyaya açılamamalı.');
    assert.ok(
        aggregationProbe.main.damagedSummaryValidation.issues.some(issue => issue.code === 'SUMMARY_PAYLOAD_MISMATCH'),
        'Payload’dan ayrışan özet açıklamalı biçimde reddedilmeli.'
    );
    assert.equal(aggregationProbe.main.invalidTopologyCold.mode, 'INVALID', 'Sabit bölge komşuluğunu değiştiren kapsül üretilememeli.');
    assert.ok(
        aggregationProbe.main.invalidTopologyCold.validation.issues.some(issue => issue.code === 'STATIC_TOPOLOGY_MISMATCH'),
        'Topoloji sapması kaynak kodlu hata taşımalı.'
    );
    assert.equal(aggregationProbe.main.uiNeutral, true, 'Kamera/panel durumu toplulaştırma görünümünü değiştirmemeli.');
    assert.equal(aggregationProbe.main.beforeHash, aggregationProbe.main.afterHash, 'Salt toplulaştırma ve UI probu canlı dünya karmasını değiştirmemeli.');
    assert.ok(
        aggregationProbe.main.benchmark.wallTimeMs < 1000,
        `152 bölge round-trip tezgâhı bir saniyeyi aşmamalı: ${aggregationProbe.main.benchmark.wallTimeMs} ms`
    );
    assert.equal(aggregationProbe.restored.loaded, true, 'Toplulaştırma politikası taşıyan kayıt yüklenebilmeli.');
    assert.equal(aggregationProbe.restored.validation.ok, true, 'Yükleme sonrası toplulaştırma görünümü geçerli olmalı.');
    assert.equal(aggregationProbe.restored.exactPolicy, true, 'Geçerli toplulaştırma politikası kayıt/yüklemede birebir korunmalı.');
    assert.equal(aggregationProbe.restored.exactSnapshot, true, 'Aynı dünya kaydı aynı toplulaştırma görünümünü üretmeli.');
    assert.equal(aggregationProbe.legacy.loaded, true, 'Toplulaştırma politikası taşımayan eski kayıt açılmalı.');
    assert.equal(aggregationProbe.legacy.validation.ok, true, 'Eski kayıt toplulaştırma görünümü geçerli olmalı.');
    assert.equal(aggregationProbe.legacy.policy.diagnostics.backfilled, true, 'Eski kayıt toplulaştırma fallback’i sessiz olmamalı.');
    assert.ok(aggregationProbe.legacy.policy.diagnostics.warnings.length > 0, 'Eski kayıt toplulaştırma fallback’i uyarı taşımalı.');
    assert.equal(aggregationProbe.corrupt.loaded, true, 'Bozuk toplulaştırma politikası dünya kaybı olmadan açılmalı.');
    assert.equal(aggregationProbe.corrupt.validation.ok, true, 'Bozuk politika yeniden kurulduktan sonra görünüm geçerli olmalı.');
    assert.equal(
        aggregationProbe.corrupt.policy.diagnostics.restoredFromInvalidPolicy,
        true,
        'Bozuk toplulaştırma politika kurtarması açık teşhis taşımalı.'
    );
    assert.equal(aggregationProbe.disabled.snapshot.disabled, true, 'world.regionAggregation kapalıyken görünüm güvenli biçimde kapanmalı.');
    assert.equal(aggregationProbe.disabled.transition.mode, 'HOT', 'Bayrak kapalı legacy yol canlı bölgeyi HOT bırakmalı.');
    assert.equal(aggregationProbe.disabled.transition.disabled, true, 'Kapalı geçiş legacy davranışı açıkça işaretlemeli.');
    assert.equal(aggregationProbe.disabled.validation.ok, true, 'Kapalı toplulaştırma görünümü kendi sözleşmesini geçmeli.');
    assert.equal(aggregationProbe.disabled.worldValidation.ok, true, 'Toplulaştırma kapalıyken V2 dünya geçerli kalmalı.');
    assert.equal(aggregationProbe.ab.equal, true, 'Toplulaştırma açık/kapalı normal dünya karmasını değiştirmemeli.');

    const infrastructureProbe = probeInfrastructureGraph();
    assert.equal(infrastructureProbe.main.validation.ok, true, 'Altyapı görünümü kendi sözleşmesini geçmeli.');
    assert.equal(infrastructureProbe.main.worldValidation.ok, true, 'Altyapı koridorlu V2 dünya geçerli kalmalı.');
    assert.ok(infrastructureProbe.main.snapshotBefore.summary.byMode.LAND > 0, 'Kara koridorları üretilmeli.');
    assert.ok(infrastructureProbe.main.snapshotBefore.summary.byMode.SEA > 0, 'Açık tanımlı deniz koridorları üretilmeli.');
    assert.equal(
        infrastructureProbe.main.snapshotBefore.summary.byMode.ENERGY,
        infrastructureProbe.main.snapshotBefore.summary.byMode.LAND
            + infrastructureProbe.main.snapshotBefore.summary.byMode.SEA,
        'Her fiziksel koridor bağımsız enerji katmanı taşımalı.'
    );
    assert.equal(
        infrastructureProbe.main.snapshotBefore.summary.byMode.DATA,
        infrastructureProbe.main.snapshotBefore.summary.byMode.LAND
            + infrastructureProbe.main.snapshotBefore.summary.byMode.SEA,
        'Her fiziksel koridor bağımsız veri katmanı taşımalı.'
    );
    assert.ok(
        infrastructureProbe.main.worldBefore.diagnostics.infrastructure
        && infrastructureProbe.main.worldBefore.diagnostics.infrastructure.networkHash,
        'V2 teşhisi altyapı ağ sürümü, karma ve özetini taşımalı.'
    );
    assert.equal(infrastructureProbe.main.regionCorridorCoverage, true, 'Her V2 bölgesi bağlı koridor kimliklerini taşımalı.');
    assert.equal(infrastructureProbe.main.accessMatches, true, 'Koridor erişimi canlı uç bölge sahiplerinden türetilmeli.');
    assert.equal(
        JSON.stringify(infrastructureProbe.main.routeBefore),
        JSON.stringify(infrastructureProbe.main.routeRepeat),
        'Aynı altyapı durumu aynı rotayı deterministik üretmeli.'
    );
    assert.ok(infrastructureProbe.main.routeBefore.ok, 'Açık doğrudan kara koridoru rota üretmeli.');
    assert.ok(
        infrastructureProbe.main.routeBefore.corridorIds.includes(infrastructureProbe.main.firstCorridorId),
        'Hasar öncesi doğrudan rota hedef kara koridorunu kullanmalı.'
    );
    assert.equal(infrastructureProbe.main.damageResult.ok, true, 'Geçerli koridora hasar uygulanabilmeli.');
    assert.equal(infrastructureProbe.main.damageResult.effectiveCapacity, 0, '10000 baz puan hasar koridor kapasitesini sıfırlamalı.');
    assert.ok(infrastructureProbe.main.flowsBefore.every(flow => flow.delivered > 0), 'Kesinti öncesi bütün test akışları taşıma yapmalı.');
    assert.equal(infrastructureProbe.main.flowsAfter[0].delivered, 0, 'Kesilen koridora bağlı akış durmalı.');
    assert.equal(
        infrastructureProbe.main.flowsAfter[1].delivered,
        infrastructureProbe.main.flowsBefore[1].delivered,
        'Ayrı kara koridorundaki akış kesintiden etkilenmemeli.'
    );
    assert.equal(
        infrastructureProbe.main.flowsAfter[2].delivered,
        infrastructureProbe.main.flowsBefore[2].delivered,
        'Ayrı enerji koridoru kara kesintisinden kendiliğinden etkilenmemeli.'
    );
    assert.equal(
        infrastructureProbe.main.flowsAfter[3].delivered,
        infrastructureProbe.main.flowsBefore[3].delivered,
        'Ayrı veri koridoru kara kesintisinden kendiliğinden etkilenmemeli.'
    );
    if (infrastructureProbe.main.routeAfter.ok) {
        assert.equal(
            infrastructureProbe.main.routeAfter.corridorIds.includes(infrastructureProbe.main.firstCorridorId),
            false,
            'Kesilmiş koridor alternatif rotaya sızmamalı.'
        );
    } else {
        assert.equal(infrastructureProbe.main.routeAfter.reason, 'NO_ROUTE', 'Alternatif yoksa açık rota-yok teşhisi dönmeli.');
    }
    assert.equal(infrastructureProbe.main.beforeHash, infrastructureProbe.main.afterHash, 'Altyapı probu eski dünya davranışını değiştirmemeli.');
    assert.equal(infrastructureProbe.main.uiNeutral, true, 'Kamera/panel durumu altyapı grafını değiştirmemeli.');
    assert.ok(
        infrastructureProbe.main.invalidCapacity.issues.some(issue => issue.code === 'INVALID_CAPACITY'),
        'Sıfır/negatif koridor kapasitesi açıklamalı biçimde reddedilmeli.'
    );
    assert.ok(
        infrastructureProbe.main.invalidDamage.issues.some(issue => issue.code === 'INVALID_DAMAGE'),
        'Aralık dışı koridor hasarı açıklamalı biçimde reddedilmeli.'
    );
    assert.ok(
        infrastructureProbe.main.duplicate.issues.some(issue => issue.code === 'DUPLICATE_CORRIDOR_ID'),
        'Yinelenen koridor kimliği açıklamalı biçimde reddedilmeli.'
    );
    assert.ok(
        infrastructureProbe.main.brokenParent.issues.some(issue => issue.code === 'BROKEN_PARENT_CORRIDOR'),
        'Enerji/veri katmanının kırık fiziksel koridor referansı reddedilmeli.'
    );
    assert.ok(
        infrastructureProbe.main.brokenRegion.issues.some(issue => issue.code === 'BROKEN_REGION_REFERENCE'),
        'Bilinmeyen uç bölge referansı reddedilmeli.'
    );
    assert.equal(infrastructureProbe.main.allBenchmarkRoutesFound, true, 'Rota tezgâhındaki bütün komşu çiftleri bulunmalı.');
    assert.ok(
        infrastructureProbe.main.benchmark.wallTimeMs < 1000,
        `100 rota sorgusu bir saniyeyi aşmamalı: ${infrastructureProbe.main.benchmark.wallTimeMs} ms`
    );
    assert.ok(
        infrastructureProbe.main.compactBytes < infrastructureProbe.main.fullGraphBytes * 0.2,
        'Kayıt tam statik graf yerine yalnız değişmiş koridor durumlarını taşımalı.'
    );
    assert.equal(infrastructureProbe.main.savedPolicy.corridorStates.length, 1, 'Tek hasarlı koridor kayıtta tek dinamik durum üretmeli.');
    assert.equal(infrastructureProbe.restored.loaded, true, 'Altyapı hasarı taşıyan kayıt yüklenebilmeli.');
    assert.equal(infrastructureProbe.restored.validation.ok, true, 'Yüklenen altyapı görünümü geçerli olmalı.');
    assert.equal(infrastructureProbe.restored.exactPolicy, true, 'Kompakt altyapı kaydı yüklemede birebir korunmalı.');
    assert.equal(infrastructureProbe.restored.exactSnapshot, true, 'Altyapı hasarı ve erişim görünümü yüklemede birebir korunmalı.');
    assert.equal(infrastructureProbe.legacy.loaded, true, 'Altyapı grafı taşımayan eski kayıt açılmalı.');
    assert.equal(infrastructureProbe.legacy.validation.ok, true, 'Eski kayıt güncel geçerli altyapı grafı üretmeli.');
    assert.equal(infrastructureProbe.legacy.policy.diagnostics.backfilled, true, 'Eski kayıt altyapı backfill’i sessiz olmamalı.');
    assert.equal(infrastructureProbe.corrupt.loaded, true, 'Bozuk altyapı karmalı kayıt dünya kaybı olmadan açılmalı.');
    assert.equal(infrastructureProbe.corrupt.validation.ok, true, 'Bozuk altyapı kaydı güvenli yeniden kurulum sonrası geçerli olmalı.');
    assert.equal(
        infrastructureProbe.corrupt.policy.diagnostics.restoredFromInvalidGraph,
        true,
        'Bozuk altyapı kurtarması açık teşhis taşımalı.'
    );
    assert.equal(infrastructureProbe.disabled.snapshot.disabled, true, 'world.infrastructureGraph kapalıyken görünüm güvenli kapanmalı.');
    assert.equal(infrastructureProbe.disabled.validation.ok, true, 'Kapalı altyapı görünümü kendi sözleşmesini geçmeli.');
    assert.equal(infrastructureProbe.disabled.damage.reason, 'FEATURE_DISABLED', 'Kapalı graf hasar mutasyonunu reddetmeli.');
    assert.equal(infrastructureProbe.disabled.corridorIds.length, 0, 'Kapalı graf V2 bölgesine sahte koridor kimliği vermemeli.');
    assert.equal(infrastructureProbe.disabled.worldValidation.ok, true, 'Altyapı kapalıyken V2 dünya geçerli kalmalı.');
    assert.equal(infrastructureProbe.ab.changed, true,
        'Altyapı, Faz 27 göç rotalarının fiziksel girdisi olduğu için açık/kapalı dünya karmasını değiştirmeli.');
    assert.equal(infrastructureProbe.ab.onMigrationValidation.ok, true,
        'Altyapı açık A/B kolunda göç defteri geçerli kalmalı.');
    assert.equal(infrastructureProbe.ab.offMigrationValidation.disabled, true,
        'Altyapı kapalı A/B kolunda bağımlı göç katmanı sahte rota üretmeden kapanmalı.');

    const resourceProbe = probeResourceTaxonomy();
    const resourceCatalog = resourceProbe.main.snapshot;
    assert.equal(resourceProbe.main.validation.ok, true, 'Kaynak kataloğu kendi sözleşmesini geçmeli.');
    assert.equal(resourceProbe.main.worldValidation.ok, true, 'Kaynak katalog teşhisli V2 dünya geçerli kalmalı.');
    assert.equal(resourceProbe.main.uiNeutral, true, 'Salt kaynak kataloğu ve uyumluluk görünümü canlı dünyayı değiştirmemeli.');
    assert.equal(resourceCatalog.schemaVersion, 1, 'Kaynak katalog şema sürümü sabit olmalı.');
    assert.equal(resourceCatalog.catalogVersion, 1, 'Kaynak katalog içerik sürümü sabit olmalı.');
    assert.equal(resourceCatalog.resources.length, 8, 'Faz 15 tam sekiz kaynak tanımlamalı.');
    assert.deepEqual(
        Array.from(resourceCatalog.resources, resource => resource.id),
        ['food', 'energy', 'raw_materials', 'industrial_parts', 'electronics', 'military_supplies', 'labor', 'capital'],
        'Kaynak kimlikleri plan sırasıyla kararlı olmalı.'
    );
    for (const resource of resourceCatalog.resources) {
        assert.ok(resource.unit && resource.unit.id && resource.unit.label && resource.unit.symbol,
            `${resource.id} açık birim tanımı taşımalı.`);
        assert.ok(resource.producers.length > 0, `${resource.id} en az bir üretici sınıfı taşımalı.`);
        assert.ok(resource.consumers.length > 0, `${resource.id} en az bir tüketici sınıfı taşımalı.`);
        assert.ok(resource.shortageEffects.length > 0, `${resource.id} en az bir yokluk sonucu taşımalı.`);
        assert.ok(resource.shortageEffects.every(effect => Number.isInteger(effect.activationPhase)),
            `${resource.id} yokluk sonuçları etkinleşeceği fazı açıklamalı.`);
    }
    assert.equal(resourceCatalog.summary.legacyMappedCount, 3, 'Yalnız üç eski alan açık alias taşımalı.');
    assert.equal(resourceCatalog.summary.unavailableStockCount, 5, 'Canlı stoğu olmayan beş kaynak sahte sıfırla doldurulmamalı.');
    assert.equal(resourceCatalog.summary.liveStockSystem, false, 'Faz 15 henüz canlı stok sistemi varmış gibi davranmamalı.');
    assert.equal(resourceProbe.main.worldDiagnostics.catalogHash, resourceCatalog.catalogHash,
        'V2 teşhisi kullanılan katalog checksum’ını yayınlamalı.');
    const canonicalQuantities = resourceProbe.main.canonicalView.quantities;
    assert.equal(canonicalQuantities.energy.status, 'LEGACY_ALIAS', 'oil yalnız enerji alias’ı olarak okunmalı.');
    assert.equal(canonicalQuantities.labor.status, 'LEGACY_ALIAS', 'manpower yalnız iş gücü alias’ı olarak okunmalı.');
    assert.equal(canonicalQuantities.capital.status, 'LEGACY_ALIAS', 'points yalnız sermaye alias’ı olarak okunmalı.');
    assert.equal(canonicalQuantities.energy.value, resourceProbe.main.legacyFixture.oil, 'oil alias değeri kaybolmamalı.');
    assert.equal(canonicalQuantities.labor.value, resourceProbe.main.legacyFixture.manpower, 'manpower alias değeri kaybolmamalı.');
    assert.equal(canonicalQuantities.capital.value, resourceProbe.main.legacyFixture.points, 'points alias değeri kaybolmamalı.');
    for (const id of ['food', 'raw_materials', 'industrial_parts', 'electronics', 'military_supplies']) {
        assert.equal(canonicalQuantities[id].status, 'UNAVAILABLE_PHASE_17', `${id} gerçek stok yokken açıkça unavailable olmalı.`);
        assert.equal(canonicalQuantities[id].value, null, `${id} gerçek stok yokken sahte sıfır üretmemeli.`);
    }
    assert.equal(
        JSON.stringify(resourceProbe.main.roundTrip.resources),
        JSON.stringify(resourceProbe.main.legacyFixture),
        'Eski→kanonik alias→eski gidiş-dönüş üç değeri kayıpsız korumalı.'
    );
    assert.equal(resourceProbe.main.roundTrip.diagnostics.ignoredCanonicalResourceIds.length, 5,
        'Eski kayda yazılamayan beş kaynak sessizce yutulmamalı.');
    assert.ok(resourceProbe.main.invalid.duplicate.issues.some(issue => issue.code === 'DUPLICATE_RESOURCE_ID'),
        'Yinelenen kaynak kimliği reddedilmeli.');
    assert.ok(resourceProbe.main.invalid.producer.issues.some(issue => issue.code === 'PRODUCERS_REQUIRED'),
        'Üreticisi olmayan kaynak reddedilmeli.');
    assert.ok(resourceProbe.main.invalid.consumer.issues.some(issue => issue.code === 'CONSUMERS_REQUIRED'),
        'Tüketicisi olmayan kaynak reddedilmeli.');
    assert.ok(resourceProbe.main.invalid.unit.issues.some(issue => issue.code === 'RESOURCE_UNIT'),
        'Geçersiz kaynak birimi reddedilmeli.');
    assert.ok(resourceProbe.main.invalid.shortage.issues.some(issue => issue.code === 'SHORTAGE_EFFECT_REQUIRED'),
        'Yokluk sonucu olmayan kaynak reddedilmeli.');
    assert.ok(resourceProbe.main.invalid.hash.issues.some(issue => issue.code === 'CATALOG_HASH_MISMATCH'),
        'Bozuk katalog checksum’ı reddedilmeli.');
    assert.ok(resourceProbe.main.invalid.unknown.issues.some(issue => issue.code === 'UNKNOWN_RESOURCE_ID'),
        'Checksum yeniden hesaplanmış olsa bile bilinmeyen kaynak reddedilmeli.');
    assert.ok(resourceProbe.main.invalid.legacyMode.issues.some(issue => issue.code === 'UNSAFE_LEGACY_MODE'),
        'Eski sayaçları sessizce materialize eden uyumluluk modu reddedilmeli.');
    assert.ok(resourceProbe.main.compactBytes < resourceProbe.main.fullCatalogBytes,
        'Kayıt tam statik kataloğu çoğaltmak yerine kompakt sürüm/hash başlığı taşımalı.');
    assert.equal(resourceProbe.restored.loaded, true, 'Kaynak taksonomili kayıt yüklenebilmeli.');
    assert.equal(resourceProbe.restored.validation.ok, true, 'Yüklenen katalog geçerli olmalı.');
    assert.equal(resourceProbe.restored.exactPolicy, true, 'Kaynak katalog kayıt başlığı birebir korunmalı.');
    assert.equal(resourceProbe.restored.resourcesPreserved, true, 'Kaynak katalog yüklemesi eski gerçek sayaçları değiştirmemeli.');
    assert.equal(resourceProbe.legacy.loaded, true, 'Taksonomi taşımayan eski kayıt açılmalı.');
    assert.equal(resourceProbe.legacy.validation.ok, true, 'Eski kayıttan backfill edilen katalog geçerli olmalı.');
    assert.equal(resourceProbe.legacy.snapshot.diagnostics.backfilled, true, 'Eski kayıt backfill’i açık teşhis taşımalı.');
    assert.equal(resourceProbe.legacy.resourcesPreserved, true, 'Eski kayıt backfill’i oil/manpower/points değerlerini korumalı.');
    assert.equal(resourceProbe.corrupt.loaded, true, 'Bozuk katalog başlığı dünya kaybı olmadan açılmalı.');
    assert.equal(resourceProbe.corrupt.validation.ok, true, 'Bozuk katalog güncel sabit katalogla onarılmalı.');
    assert.equal(resourceProbe.corrupt.snapshot.diagnostics.restoredFromInvalidCatalog, true,
        'Bozuk katalog kurtarması açık teşhis taşımalı.');
    assert.equal(resourceProbe.corrupt.resourcesPreserved, true, 'Bozuk katalog kurtarması eski sayaçları değiştirmemeli.');
    assert.equal(resourceProbe.disabled.snapshot.disabled, true, 'Kaynak taksonomisi özellik bayrağıyla kapanabilmeli.');
    assert.equal(resourceProbe.disabled.validation.ok, true, 'Kapalı kaynak görünümü kendi sözleşmesini geçmeli.');
    assert.equal(resourceProbe.disabled.worldValidation.ok, true, 'Kaynak taksonomisi kapalıyken V2 dünya geçerli kalmalı.');
    assert.equal(resourceProbe.ab.equal, true, 'Kaynak taksonomisi açık/kapalı normal dünya karmasını değiştirmemeli.');

    const productionProbe = probeProductionSectors();
    const productionCatalog = productionProbe.main.snapshot;
    assert.equal(productionProbe.main.validation.ok, true, 'Üretim sektörü kataloğu kendi sözleşmesini geçmeli.');
    assert.equal(productionProbe.main.worldValidation.ok, true, 'Üretim teşhisli V2 dünya geçerli kalmalı.');
    assert.equal(productionProbe.main.stateNeutral, true, 'Faz 16 teklif motoru canlı dünyayı değiştirmemeli.');
    assert.equal(productionCatalog.schemaVersion, 1, 'Üretim katalog şema sürümü sabit olmalı.');
    assert.equal(productionCatalog.catalogVersion, 1, 'Üretim katalog içerik sürümü sabit olmalı.');
    assert.equal(productionCatalog.sectors.length, 6, 'Faz 16 tam altı sektör tanımlamalı.');
    assert.deepEqual(
        Array.from(productionCatalog.sectors, sector => sector.id),
        ['agriculture', 'energy', 'extraction', 'civil_industry', 'advanced_tech', 'defense_industry'],
        'Sektör kimlikleri plan sırasıyla kararlı olmalı.'
    );
    assert.equal(productionCatalog.summary.primarySectorCount, 3, 'Tarım, enerji ve çıkarım doğal kapasiteye bağlı olmalı.');
    assert.equal(productionCatalog.summary.manufacturingSectorCount, 3, 'Üç sanayi sektörü malzeme eşdeğeri koruması kullanmalı.');
    assert.equal(productionCatalog.summary.liveStockSystem, false, 'Faz 16 canlı stok sistemi varmış gibi davranmamalı.');
    assert.equal(productionCatalog.summary.proposalsCommit, false, 'Üretim teklifleri Faz 17 öncesi gerçek stoğa yazmamalı.');
    assert.equal(
        productionProbe.main.worldDiagnostics.catalogHash,
        productionCatalog.catalogHash,
        'V2 teşhisi kullanılan üretim katalog checksum’ını yayınlamalı.'
    );
    for (const sector of productionCatalog.sectors) {
        assert.ok(sector.capacity && sector.capacity.baseCyclesPerCapacity > 0, `${sector.id} kapasite politikası taşımalı.`);
        assert.ok(sector.workforce && sector.workforce.quantityPerCycle > 0, `${sector.id} iş gücü sözleşmesi taşımalı.`);
        assert.ok(sector.efficiency && sector.efficiency.baseBps === 10000, `${sector.id} açık baz verimlilik taşımalı.`);
        assert.ok(sector.recipe && sector.recipe.version === 1, `${sector.id} sürümlü reçete taşımalı.`);
        assert.ok(sector.recipe.inputs.length > 0, `${sector.id} kaynaksız çalışmamalı.`);
        assert.equal(sector.recipe.outputs.length, 1, `${sector.id} bir ana çıktı taşımalı.`);
        assert.equal(productionProbe.main.ready[sector.id].status, 'READY', `${sector.id} yeterli girdide çalışmalı.`);
        assert.equal(productionProbe.main.ready[sector.id].actualCycles, 2, `${sector.id} kapasite kadar deterministik çevrim üretmeli.`);
        assert.equal(productionProbe.main.ready[sector.id].committed, false, `${sector.id} teklifi canlı stoğa yazmamalı.`);
    }
    assert.equal(productionProbe.main.partial.status, 'PARTIAL', 'Eksik hammadde kısmi üretim vermeli.');
    assert.equal(productionProbe.main.partial.actualCycles, 0.5, '0,75 ton hammadde 0,5 sivil sanayi çevrimiyle sınırlanmalı.');
    assert.equal(productionProbe.main.partial.produced.industrial_parts.quantity, 0.5, 'Kısmi çevrim çıktıya orantılı yansımalı.');
    assert.ok(productionProbe.main.partial.bottlenecks.some(item => (
        item.code === 'INPUT_SHORTAGE' && item.key === 'raw_materials'
    )), 'Darboğaz raporu sınırlayan hammaddeyi açıkça göstermeli.');
    assert.equal(productionProbe.main.deterministicProposal, true, 'Aynı üretim girdisi byte düzeyinde aynı teklifi üretmeli.');
    assert.equal(productionProbe.main.inputImmutable, true, 'Teklif hesabı çağıranın stok görünümünü değiştirmemeli.');
    assert.equal(productionProbe.main.blocked.status, 'BLOCKED', 'Stok görünümü yoksa ileri teknoloji çalışmamalı.');
    assert.ok(productionProbe.main.blocked.bottlenecks.every(item => item.code === 'STOCK_UNAVAILABLE'),
        'Eksik stoklar sahte sıfır yerine STOCK_UNAVAILABLE olarak raporlanmalı.');
    assert.equal(productionProbe.main.capacityLimited.status, 'PARTIAL', 'Kapasite/verimlilik sınırı kısmi üretim vermeli.');
    assert.equal(productionProbe.main.capacityLimited.actualCycles, 0.5, '1 kapasite ve %50 verim 0,5 çevrim vermeli.');
    assert.ok(productionProbe.main.capacityLimited.bottlenecks.some(item => item.code === 'CAPACITY_LIMIT'),
        'Kapasite darboğazı girdi kıtlığından ayrı raporlanmalı.');
    assert.equal(productionProbe.main.unknownSector.status, 'UNKNOWN_SECTOR', 'Bilinmeyen sektör sessizce çalışmamalı.');
    assert.equal(productionProbe.main.invalidRequest.status, 'INVALID_REQUEST', 'Negatif çevrim isteği reddedilmeli.');
    assert.ok(productionProbe.main.invalid.duplicate.issues.some(issue => issue.code === 'DUPLICATE_SECTOR_ID'),
        'Yinelenen sektör reddedilmeli.');
    assert.ok(productionProbe.main.invalid.unknownResource.issues.some(issue => issue.code === 'UNKNOWN_RECIPE_RESOURCE'),
        'Bilinmeyen reçete kaynağı reddedilmeli.');
    assert.ok(productionProbe.main.invalid.unit.issues.some(issue => issue.code === 'RECIPE_UNIT_MISMATCH'),
        'Kaynak kataloğuyla uyuşmayan reçete birimi reddedilmeli.');
    assert.ok(productionProbe.main.invalid.quantity.issues.some(issue => issue.code === 'INVALID_INPUT_QUANTITY'),
        'Sıfır/negatif reçete girdisi reddedilmeli.');
    assert.ok(productionProbe.main.invalid.endowment.issues.some(issue => issue.code === 'PRIMARY_ENDOWMENT_REQUIRED'),
        'Birincil sektör doğal kapasite olmadan çalışmamalı.');
    assert.ok(productionProbe.main.invalid.exNihilo.issues.some(issue => issue.code === 'EX_NIHILO_OUTPUT'),
        'Girdisiz fiziksel üretim açıkça reddedilmeli.');
    assert.ok(productionProbe.main.invalid.massGain.issues.some(issue => issue.code === 'MASS_CREATION'),
        'Malzeme eşdeğeri çıktısı girdiyi aşan reçete reddedilmeli.');
    assert.ok(productionProbe.main.invalid.producer.issues.some(issue => issue.code === 'PRODUCER_OUTPUT_MISMATCH'),
        'Kaynak kataloğunda yetkili olmayan sektör çıktısı reddedilmeli.');
    assert.ok(productionProbe.main.invalid.resourceLink.issues.some(issue => issue.code === 'RESOURCE_CATALOG_LINK'),
        'Yanlış kaynak katalog sürümüne bağlı üretim kataloğu reddedilmeli.');
    assert.ok(productionProbe.main.invalid.hash.issues.some(issue => issue.code === 'PRODUCTION_CATALOG_HASH_MISMATCH'),
        'Bozuk üretim katalog checksum’ı reddedilmeli.');
    assert.ok(productionProbe.main.compactBytes < productionProbe.main.fullCatalogBytes * 0.2,
        'Kayıt tam statik reçeteleri değil kompakt sürüm/hash başlığını taşımalı.');
    assert.equal(productionProbe.restored.loaded, true, 'Üretim kataloglu kayıt yüklenebilmeli.');
    assert.equal(productionProbe.restored.validation.ok, true, 'Yüklenen üretim kataloğu geçerli olmalı.');
    assert.equal(productionProbe.restored.exactPolicy, true, 'Üretim katalog kayıt başlığı birebir korunmalı.');
    assert.equal(productionProbe.restored.resourcesPreserved, true, 'Üretim yüklemesi eski gerçek sayaçları değiştirmemeli.');
    assert.equal(productionProbe.legacy.loaded, true, 'Üretim kataloğu taşımayan eski kayıt açılmalı.');
    assert.equal(productionProbe.legacy.validation.ok, true, 'Eski kayıttan backfill edilen üretim kataloğu geçerli olmalı.');
    assert.equal(productionProbe.legacy.snapshot.diagnostics.backfilled, true, 'Üretim backfill’i açık teşhis taşımalı.');
    assert.equal(productionProbe.legacy.resourcesPreserved, true, 'Üretim backfill’i eski kaynakları korumalı.');
    assert.equal(productionProbe.corrupt.loaded, true, 'Bozuk üretim başlığı dünya kaybı olmadan açılmalı.');
    assert.equal(productionProbe.corrupt.validation.ok, true, 'Bozuk üretim kataloğu güvenli statik katalogla onarılmalı.');
    assert.equal(productionProbe.corrupt.snapshot.diagnostics.restoredFromInvalidCatalog, true,
        'Bozuk üretim kataloğu kurtarması açık teşhis taşımalı.');
    assert.equal(productionProbe.corrupt.resourcesPreserved, true, 'Bozuk üretim kurtarması eski kaynakları değiştirmemeli.');
    assert.equal(productionProbe.disabled.snapshot.disabled, true, 'Üretim sektörleri özellik bayrağıyla kapanabilmeli.');
    assert.equal(productionProbe.disabled.validation.ok, true, 'Kapalı üretim görünümü kendi sözleşmesini geçmeli.');
    assert.equal(productionProbe.disabled.evaluation.status, 'DISABLED', 'Kapalı üretim motoru teklif üretmemeli.');
    assert.equal(productionProbe.disabled.worldValidation.ok, true, 'Üretim kapalıyken V2 dünya geçerli kalmalı.');
    assert.equal(productionProbe.ab.equal, true, 'Üretim sözleşmesi açık/kapalı normal dünya karmasını değiştirmemeli.');

    const regionalProbe = probeRegionalEconomy();
    const regionalSummary = regionalProbe.main.finalSummary;
    assert.equal(regionalProbe.main.validation.ok, true, 'Kanonik bölgesel stok defteri kendi sözleşmesini geçmeli.');
    assert.equal(regionalProbe.main.worldValidation.ok, true, 'Bölgesel stoklu V2 dünya geçerli kalmalı.');
    assert.equal(regionalSummary.schemaVersion, 1, 'Bölgesel stok şema sürümü sabit olmalı.');
    assert.equal(regionalSummary.adapterVersion, 'story-regional-stock-ledger-1', 'Stok adaptör sürümü açık olmalı.');
    assert.equal(regionalSummary.liveStockSystem, true, 'Faz 17 canlı stok sistemini gerçekten etkinleştirmeli.');
    assert.equal(regionalSummary.legacyMaterialized, false, 'Oil/manpower/points sayaçları bölgesel stoğa dönüştürülmemeli.');
    assert.equal(regionalSummary.regionCount, 152, 'Kanonik defter bütün bölgeleri kapsamalı.');
    assert.equal(regionalProbe.main.tick.tickSequence, 1, 'Doğrudan ekonomi tiki tam bir kez işlenmeli.');
    assert.equal(regionalProbe.main.tick.regionsProcessed, 152, 'Ekonomi tiki hiçbir bölgeyi atlamamalı.');
    assert.ok(regionalProbe.main.tick.productionCommits > 0, 'Canlı üretim teklifleri atomik olarak stoğa işlenmeli.');
    assert.ok(regionalProbe.main.tick.blockedProposals > 0, 'Gerçek darboğazlar BLOCKED olarak gözlenebilmeli.');
    assert.ok(regionalSummary.shortageCount > 0, 'Tüketim açığı görünür kıtlık kaydı üretmeli.');
    assert.ok(regionalSummary.shortageCount < 2000, 'Tek tik kıtlık günlüğü güvenlik tavanını doldurmamalı.');
    for (const [resourceId, delta] of Object.entries(regionalProbe.main.stockConservationDelta)) {
        assert.equal(delta, 0, `${resourceId} stok koruma denklemi dışarıdan akış/üretim/tüketim/kayıpla kapanmalı.`);
    }
    assert.ok(Object.values(regionalSummary.flowTotals.produced).some(value => value > 0), 'Üretim akış toplamı boş kalmamalı.');
    assert.ok(Object.values(regionalSummary.flowTotals.consumed).some(value => value > 0), 'Tüketim akış toplamı boş kalmamalı.');
    assert.ok(Object.values(regionalSummary.flowTotals.decayed).some(value => value > 0), 'Raf ömrü/depolama kaybı ölçülmeli.');
    assert.ok(regionalSummary.flowTotals.cohortLaborSupply.labor > 0,
        'Emek hizmet akışı çalışma çağındaki kohortlardan ayrı muhasebeleştirilmeli.');
    assert.equal(regionalSummary.flowTotals.externalInflow.labor, 0,
        'Faz 23 açıkken sınırsız dış emek akışı kapalı kalmalı.');
    assert.ok(regionalSummary.flowTotals.financialOperatingUse.capital > 0,
        'Şirket sermayesi üretim işletme gideri olarak açıkça muhasebeleştirilmeli.');
    assert.equal(regionalProbe.main.legacyResourcesPreserved, true, 'Faz 17 eski oil/manpower/points değerlerini değiştirmemeli.');
    assert.equal(regionalProbe.main.ownDossier.facts.stocks.status, 'VERIFIED', 'Oyuncu kendi stoklarını doğrulanmış veriyle görmeli.');
    assert.equal(regionalProbe.main.ownDossier.facts.stocks.sourceType, 'OWN_STOCK_LEDGER', 'Kendi stok bilgisi kanonik defterden gelmeli.');
    assert.equal(regionalProbe.main.foreignDossier.facts.stocks.status, 'UNKNOWN', 'Yabancı stoklar istihbarat olmadan bilinmemeli.');
    assert.equal(regionalProbe.main.foreignDossier.facts.stocks.value, null, 'Yabancı stoklar sahte sıfır veya kesin değer sızdırmamalı.');
    assert.equal(regionalProbe.main.capsuleValidation.ok, true, 'Bölge kapsülü stok aynasıyla geçerli kalmalı.');
    assert.equal(regionalProbe.main.capsuleStocksMatch, true, 'HOT/WARM/COLD kapsülü kanonik stokla birebir uyuşmalı.');
    const regionalInvalidCodes = Object.fromEntries(Object.entries(regionalProbe.main.invalid).map(
        ([key, result]) => [key, result.issues[0] && result.issues[0].code]
    ));
    assert.equal(regionalInvalidCodes.negative, 'REGIONAL_NEGATIVE_OR_INVALID', 'Negatif stok reddedilmeli.');
    assert.equal(regionalInvalidCodes.missingRegion, 'REGIONAL_REGION_SET', 'Eksik bölge defteri reddedilmeli.');
    assert.equal(regionalInvalidCodes.policy, 'REGIONAL_POLICY_HASH', 'Yanlış tüketim/rezerv politikası reddedilmeli.');
    assert.equal(regionalInvalidCodes.topology, 'REGIONAL_TOPOLOGY_HASH', 'Yanlış dünya topolojisine bağlı defter reddedilmeli.');
    assert.equal(regionalInvalidCodes.missingResource, 'REGIONAL_NEGATIVE_OR_INVALID', 'Eksik kaynak sütunu reddedilmeli.');

    assert.equal(regionalProbe.atomic.validCommit.ok, true, 'Geçerli üretim teklifi atomik commit edilmelidir.');
    assert.equal(regionalProbe.atomic.validCommit.committed, true, 'Commit sonucu açık committed işareti taşımalı.');
    assert.equal(regionalProbe.atomic.afterValid.stocks.raw_materials, regionalProbe.atomic.expectedRawAfter,
        'Sivil sanayi tam reçete kadar hammadde tüketmeli.');
    assert.equal(regionalProbe.atomic.afterValid.stocks.industrial_parts, regionalProbe.atomic.expectedPartsAfter,
        'Sivil sanayi tam reçete kadar parça üretmeli.');
    assert.equal(regionalProbe.atomic.tamperedCommit.code, 'PROPOSAL_QUANTITY_MISMATCH', 'Oynanmış teklif reddedilmeli.');
    assert.equal(regionalProbe.atomic.tamperAtomic, true, 'Reddedilen oynanmış teklif hiçbir stoğu değiştirmemeli.');
    assert.equal(regionalProbe.atomic.staleCommit.code, 'INSUFFICIENT_STOCK', 'Eski stok görünümüne göre hazırlanmış teklif reddedilmeli.');
    assert.equal(regionalProbe.atomic.staleAtomic, true, 'Yetersiz stok reddi kısmi tüketim bırakmamalı.');
    assert.deepEqual(
        Array.from(regionalProbe.atomic.allocation.allocations, item => item.delivered),
        [8, 0],
        'Hane ihtiyacı rezervi kullanırken düşük öncelikli şirket talebi güvenli stoğu yiyememeli.'
    );
    assert.equal(regionalProbe.atomic.priorityFinal.stocks.food, 2, 'Öncelikli tüketim sonrası kalan stok deterministik olmalı.');
    assert.equal(regionalProbe.atomic.priorityFinal.shortages[0].cause, 'SAFE_RESERVE_PROTECTED',
        'Kıtlık nedeni sıradan yetersizlikten güvenli rezerv korumasını ayırmalı.');
    assert.equal(regionalProbe.atomic.priorityFinal.shortages[0].lifecycleStatus, 'ACTIVE',
        'Karşılanmayan talep etkin kıtlık yaşam döngüsüne girmeli.');
    assert.equal(regionalProbe.atomic.resolvedAllocation.allocations[0].status, 'SATISFIED',
        'Stok yenilendiğinde önceki talep karşılanabilmeli.');
    assert.equal(regionalProbe.atomic.resolvedShortage.lifecycleStatus, 'RESOLVED',
        'Stok yenilenince kıtlık yaşam döngüsü kapanmalı.');

    assert.equal(regionalProbe.restored.loaded, true, 'Bölgesel stoklu kayıt yüklenebilmeli.');
    assert.equal(regionalProbe.restored.validation.ok, true, 'Yüklenen bölgesel stok defteri geçerli olmalı.');
    assert.equal(regionalProbe.restored.exactLedger, true, 'Kayıt/geri yükleme kanonik defteri birebir korumalı.');
    assert.equal(regionalProbe.restored.resourcesPreserved, true, 'Stok geri yüklemesi eski kaynak sayaçlarını değiştirmemeli.');
    assert.equal(regionalProbe.legacy.loaded, true, 'Bölgesel stok taşımayan eski kayıt açılmalı.');
    assert.equal(regionalProbe.legacy.validation.ok, true, 'Eski kayıttan kurulan stok defteri geçerli olmalı.');
    assert.equal(regionalProbe.legacy.ledger.diagnostics.backfilled, true, 'Eski kayıt backfill teşhisi taşımalı.');
    assert.equal(regionalProbe.legacy.ledger.diagnostics.legacyMaterialized, false, 'Backfill eski kaynakları stok diye kopyalamamalı.');
    assert.equal(regionalProbe.legacy.resourcesPreserved, true, 'Eski kayıt backfill’i kaynak sayaçlarını korumalı.');
    assert.equal(regionalProbe.corrupt.loaded, true, 'Bozuk bölgesel defter dünya kaybı olmadan açılmalı.');
    assert.equal(regionalProbe.corrupt.validation.ok, true, 'Bozuk defter deterministik başlangıçla onarılmalı.');
    assert.equal(regionalProbe.corrupt.ledger.diagnostics.restoredFromInvalidLedger, true, 'Bozuk defter kurtarması teşhis taşımalı.');
    assert.equal(regionalProbe.corrupt.resourcesPreserved, true, 'Bozuk defter kurtarması eski kaynaklara dokunmamalı.');
    assert.equal(regionalProbe.disabled.summary.disabled, true, 'Bölgesel ekonomi özellik bayrağıyla kapanabilmeli.');
    assert.equal(regionalProbe.disabled.nodeStocksPresent, false, 'Kapalı sistem bölge düğümlerine sahte stok aynası yazmamalı.');
    assert.equal(regionalProbe.disabled.worldValidation.ok, true, 'Bölgesel ekonomi kapalıyken V2 dünya geçerli kalmalı.');
    assert.equal(regionalProbe.ab.regionalChanged, true, 'Canlı stok sistemi açıldığında yeni dünya durumu gerçekten değişmeli.');
    assert.equal(regionalProbe.ab.legacyGameplayEqual, true, 'Yeni stok sistemi eski oynanış metriklerini değiştirmemeli.');

    const tradeProbe = probeTradeLogistics();
    assert.equal(tradeProbe.main.validation.ok, true, 'Ticaret/sevkiyat defteri kendi sözleşmesini geçmeli.');
    assert.equal(tradeProbe.main.dispatched.ok, true, 'Geçerli sözleşmeye bağlı sipariş fiziksel sevkiyata dönüşmeli.');
    assert.equal(
        tradeProbe.main.sourceAfterDispatch,
        tradeProbe.main.sourceBefore - 10,
        'Yük sevk edilirken gönderici stoğundan atomik olarak çıkmalı.'
    );
    assert.equal(
        tradeProbe.main.targetAfterDispatch,
        tradeProbe.main.targetBefore,
        'Sipariş veya sevk anı alıcı stoğuna ışınlanmış mal yazmamalı.'
    );
    assert.equal(tradeProbe.main.heldShipment.status, 'HELD', 'Tam kesilmiş koridor yoldaki yükü bekletmeli.');
    assert.equal(
        tradeProbe.main.targetWhileHeld,
        tradeProbe.main.targetBefore,
        'Koridorda bekleyen yük alıcı stoğunda görünmemeli.'
    );
    assert.equal(tradeProbe.main.deliveredShipment.status, 'DELIVERED', 'Koridor açılınca yük fiziksel teslimata ulaşmalı.');
    assert.equal(
        tradeProbe.main.targetAfterDelivery,
        tradeProbe.main.targetBefore + 10,
        'Alıcı stoğu yalnız fiziksel teslimatta artmalı.'
    );
    assert.ok(tradeProbe.main.deliveredShipment.interruptionSeconds >= 20, 'Kesinti süresi sevkiyat manifestosunda ölçülmeli.');
    assert.equal(tradeProbe.main.redirect.ok, true, 'Yetkili taraf geçerli sözleşme değişikliğiyle hedef depoyu değiştirebilmeli.');
    assert.equal(tradeProbe.main.redirectedShipment.status, 'DELIVERED', 'Yönlendirilen yük yeni rotada fiziksel teslimatı tamamlamalı.');
    assert.equal(
        tradeProbe.main.oldTargetAfterRedirect,
        tradeProbe.main.oldTargetBeforeRedirect,
        'Yönlendirme eski hedefte hayalî stok bırakmamalı.'
    );
    assert.equal(
        tradeProbe.main.alternateAfterRedirect,
        tradeProbe.main.alternateBeforeRedirect + 5,
        'Yönlendirilen yük yalnız yeni hedef depoya teslim edilmeli.'
    );
    assert.equal(tradeProbe.main.capacityDispatchA.shipment.quantity, tradeProbe.main.sharedCapacity,
        'İlk akış ortak koridor kapasitesini gerçekten ayırabilmeli.');
    assert.equal(tradeProbe.main.capacityDispatchB.code, 'CORRIDOR_CAPACITY_EXHAUSTED',
        'Aynı penceredeki ikinci akış tüketilmiş kapasiteyi yeniden kullanamamalı.');
    assert.notEqual(tradeProbe.main.borderSourceCountryId, tradeProbe.main.borderTargetCountryId,
        'Sahiplik devri testi gerçekten iki ayrı devlet arasında çalışmalı.');
    assert.equal(tradeProbe.main.borderTitleBefore, tradeProbe.main.borderSourceCountryId,
        'Yoldaki yükün mülkiyeti teslimata kadar satıcıda kalmalı.');
    assert.equal(tradeProbe.main.borderDelivered.titleOwnerCountryId, tradeProbe.main.borderTargetCountryId,
        'Yük mülkiyeti yalnız sınır ötesi fiziksel teslimatta alıcıya geçmeli.');
    assert.ok(tradeProbe.main.borderBuyerBudgetReserved.cash < tradeProbe.main.borderBuyerBudgetBefore.cash,
        'Sınır ötesi sevkte alıcı nakdi gerçek ödeme tutarı kadar azalmalı.');
    assert.ok(tradeProbe.main.borderBuyerBudgetReserved.tradeEscrow > tradeProbe.main.borderBuyerBudgetBefore.tradeEscrow,
        'Sevk bedeli teslimata kadar alıcı bütçesinde bloke edilmelidir.');
    assert.equal(tradeProbe.main.borderSellerBudgetReserved.cash, tradeProbe.main.borderSellerBudgetBefore.cash,
        'Satıcı fiziksel teslimattan önce ödeme alamamalı.');
    assert.equal(tradeProbe.main.borderSettlement.status, 'SETTLED',
        'Fiziksel teslimat bütçe uzlaşmasını kapatmalı.');
    assert.equal(tradeProbe.main.borderBuyerBudgetAfter.tradeEscrow, tradeProbe.main.borderBuyerBudgetBefore.tradeEscrow,
        'Teslimattan sonra sevkiyat blokesi kapanmalı.');
    assert.equal(tradeProbe.main.borderSellerBudgetAfter.cash, tradeProbe.main.borderSellerBudgetBefore.cash,
        'Özel şirket ihracatı satıcı devlet hazinesine bedava gelir yazmamalı.');
    assert.ok(tradeProbe.main.borderSellerCompanyId,
        'Sınır ötesi satış fiziksel kaynağın sektör şirketine bağlanmalı.');
    assert.ok(
        tradeProbe.main.borderSellerCompanyAfter.accounts['ASSET:CASH']
            > tradeProbe.main.borderSellerCompanyBefore.accounts['ASSET:CASH'],
        'Fiziksel teslimat ihracat bedelini satıcı şirketin nakdine yazmalı.'
    );
    assert.equal(tradeProbe.main.borderSettlement.payeeType, 'COMPANY',
        'Uzlaşma alacaklı türünü şirket olarak açıkça kaydetmeli.');
    assert.equal(tradeProbe.main.ownDossier.facts.trade.status, 'VERIFIED',
        'Oyuncu kendi bölgesinin sipariş ve sevkiyat kaydını doğrulanmış görmeli.');
    assert.equal(tradeProbe.main.foreignDossier.facts.trade.status, 'UNKNOWN',
        'Yabancı sevkiyat ayrıntısı istihbarat olmadan sızmamalı.');
    assert.ok(tradeProbe.main.invalid.policy.issues.some(issue => issue.code === 'TRADE_POLICY_HASH'),
        'Yanlış ticaret politika karması reddedilmeli.');
    assert.ok(tradeProbe.main.invalid.network.issues.some(issue => issue.code === 'TRADE_NETWORK_HASH'),
        'Başka altyapı ağına ait ticaret defteri reddedilmeli.');
    assert.ok(tradeProbe.main.invalid.cargo.issues.some(issue => issue.code === 'TRADE_CARGO_CONSERVATION'),
        'Kaynağı belirsiz yoldaki yük koruma kapısında reddedilmeli.');
    assert.ok(tradeProbe.main.invalid.route.issues.some(issue => issue.code === 'INVALID_SHIPMENT_ROUTE'),
        'Bozuk sevkiyat rotası reddedilmeli.');
    assert.equal(tradeProbe.restored.loaded, true, 'Yoldaki yük taşıyan kayıt açılabilmeli.');
    assert.equal(tradeProbe.restored.validation.ok, true, 'Yüklenen ticaret defteri geçerli kalmalı.');
    assert.equal(tradeProbe.restored.exactLedger, true, 'Sipariş, rota, ayak ilerlemesi ve kapasite kayıtta birebir korunmalı.');
    assert.equal(tradeProbe.restored.regionalUnchanged, true, 'Ticaret yüklemesi bölgesel stoğu ikinci kez borçlandırmamalı.');
    assert.equal(tradeProbe.legacyActive.loaded, true,
        'Faz 20 öncesinden yolda kalan sınır ötesi yük yeni bütçe sistemiyle açılabilmeli.');
    assert.equal(tradeProbe.legacyActive.tradeValidation.ok, true,
        'Eski aktif yük taşıyan ticaret defteri göçten sonra geçerli kalmalı.');
    assert.equal(tradeProbe.legacyActive.budgetValidation.ok, true,
        'Eski aktif yüke eklenen escrow kaydı çift taraflı muhasebe denetimini geçmeli.');
    assert.ok(tradeProbe.legacyActive.shipment.settlementReservationId,
        'Eski sınır ötesi yük kayıt açılışında gerçek bir ödeme rezervasyonuna bağlanmalı.');
    assert.equal(tradeProbe.legacyActive.settlement.status, 'RESERVED',
        'Eski yük teslim edilmeden satıcıya ödenmemeli; bedel escrow durumunda kalmalı.');
    assert.equal(tradeProbe.legacyActive.settlement.shipmentId, tradeProbe.legacyActive.shipment.id,
        'Göçte üretilen escrow kaydı fiziksel sevkiyata izlenebilir biçimde bağlanmalı.');
    assert.equal(tradeProbe.legacyActive.diagnostics.priceSettlementActive, true,
        'Eski ticaret kaydının teşhisi Faz 20 uzlaşmasının etkinleştiğini bildirmeli.');
    assert.equal(tradeProbe.legacy.loaded, true, 'Ticaret defteri taşımayan eski kayıt açılmalı.');
    assert.equal(tradeProbe.legacy.validation.ok, true, 'Eski kayıt hayalî yük üretmeden geçerli boş defter kurmalı.');
    assert.equal(tradeProbe.legacy.ledger.diagnostics.backfilled, true, 'Eski kayıt ticaret backfill teşhisi taşımalı.');
    assert.equal(tradeProbe.legacy.regionalUnchanged, true, 'Ticaret backfill’i mevcut bölgesel stoklara dokunmamalı.');
    assert.equal(tradeProbe.corrupt.loaded, true, 'Bozuk ticaret defteri dünya kaybı olmadan açılmalı.');
    assert.equal(tradeProbe.corrupt.validation.ok, true, 'Bozuk ticaret defteri güvenli boş defterle kurtarılmalı.');
    assert.equal(tradeProbe.corrupt.ledger.diagnostics.restoredFromInvalidLedger, true,
        'Bozuk ticaret kurtarması sessiz olmamalı.');
    assert.equal(tradeProbe.corrupt.regionalUnchanged, true, 'Bozuk ticaret kurtarması stok üretmemeli veya silmemeli.');
    assert.equal(tradeProbe.disabled.summary.disabled, true, 'Ticaret katmanı özellik bayrağıyla kapanabilmeli.');
    assert.equal(tradeProbe.disabled.ledger, null, 'Kapalı ticaret katmanı sahte sözleşme veya yük üretmemeli.');
    assert.equal(tradeProbe.ab.changed, true, 'Ticaret açık/kapalı A/B koşusu gerçek fiziksel dünya farkı üretmeli.');
    assert.ok(tradeProbe.ab.onTrade.totals.delivered.food > 0, 'Canlı barış dünyasında gıda ticareti gerçekten teslimat yapmalı.');

    const distributionProbe = probeDomesticDistributionContract();
    assert.equal(distributionProbe.main.admission.ok, true,
        'Tek ulke dagitim karari butun fiziksel bacaklar birlikte dogrulandiktan sonra kabul edilmeli.');
    assert.equal(distributionProbe.main.committed.ok, true,
        'Kabul edilen dagitim karari gercek siparis ve sevkiyat fislerine donusmeli.');
    assert.equal(distributionProbe.main.inTransitBatch.legs.length, 2,
        'Tek dagitim sozlesmesi en az iki ayri hedef bacagi tasiyabilmeli.');
    assert.equal(distributionProbe.main.sourceAfterDispatch,
        distributionProbe.main.sourceBefore - 5,
        'Dagitimin iki bacagi toplam miktari kaynak stoktan yalniz sevkte borclanmali.');
    assert.deepEqual(distributionProbe.main.targetsAfterDispatch,
        distributionProbe.main.targetsBefore,
        'Dagitim kabulu veya sevki hedeflere enerji isinlamamali.');
    assert.equal(new Set(distributionProbe.main.cargoReceipts.map(row => row.shipmentId)).size, 2,
        'Her dagitim bacagi ayri fiziksel sevkiyat ve teslim fisi tasimali.');
    assert.ok(distributionProbe.main.cargoReceipts.every(row => (
        row.corridorIds.length > 0
            && row.lotQuantity === row.quantity
            && row.ownerIds.length > 0
    )), 'Her bacak gercek rota ve miktari esit sahipli kargo lotu tasimali.');
    assert.equal(distributionProbe.main.deliveredBatch.status, 'DELIVERED',
        'Dagitim sozlesmesi ancak butun fiziksel bacaklar teslim edilince kapanmali.');
    assert.deepEqual(distributionProbe.main.targetsAfterDelivery,
        distributionProbe.main.targetsBefore.map((value, index) => (
            value + distributionProbe.main.quantities[index]
        )), 'Her hedef yalniz kendi bacaginin fiziksel teslimati kadar enerji almali.');
    assert.ok(Math.abs(
        distributionProbe.main.physicalAfter - distributionProbe.main.physicalBefore
    ) < 1e-6, 'Cok bacakli dagitim dunya fiziksel enerji toplamini korumali.');
    assert.ok(Math.abs(
        distributionProbe.main.commerceAfter - distributionProbe.main.commerceBefore
    ) < 1e-6, 'Cok bacakli dagitim sahipli enerji lotu toplamini korumali.');
    assert.equal(distributionProbe.main.tradeValidation.ok, true,
        'Teslim edilmis dagitim sozlesmesi ticaret koruma denklemini gecmeli.');
    assert.equal(distributionProbe.main.commerceValidation.ok, true,
        'Dagitim sonrasi sahipli lotlar fiziksel bolge stoklariyla kapanmali.');
    assert.equal(distributionProbe.main.crossBorderPlan.code,
        'DISTRIBUTION_CROSS_BORDER_FORBIDDEN',
        'Ulke-ici dagitim sozlesmesi dis ticareti odeme kapisindan kacirmamali.');
    assert.ok(distributionProbe.main.invalidTotal.issues.some(
        issue => issue.code === 'DISTRIBUTION_QUANTITY_CONSERVATION'
    ), 'Bacak toplamini bozan dagitim kaydi dogrulayicida reddedilmeli.');
    assert.equal(distributionProbe.main.summary.domesticDistribution.deliveredQuantity, 5,
        'Dagitim ozeti planlanan ve fiziksel teslim edilen miktari ayirmali.');
    assert.equal(distributionProbe.restored.loaded, true,
        'Yolda cok bacakli dagitim tasiyan kayit yeniden acilabilmeli.');
    assert.equal(distributionProbe.restored.tradeExact, true,
        'Dagitim sozlesmesi, bacaklar ve rota fisleri kayitta birebir korunmali.');
    assert.equal(distributionProbe.restored.commerceExact, true,
        'Yoldaki dagitim kargolarinin sahiplik lotlari kayitta birebir korunmali.');
    assert.equal(distributionProbe.restored.tradeValidation.ok, true,
        'Yuklenen dagitim sozlesmesi ticaret dogrulamasini gecmeli.');
    assert.equal(distributionProbe.restored.commerceValidation.ok, true,
        'Yuklenen sahipli dagitim kargosu fiziksel stok aynasini korumali.');

    const marketProbe = probeMarketPrices();
    assert.equal(marketProbe.main.validation.ok, true, 'Bölgesel fiyat defteri kendi sözleşmesini geçmeli.');
    assert.equal(marketProbe.main.worldValidation.ok, true, 'Piyasa kayıtlı V2 dünya geçerli kalmalı.');
    assert.equal(marketProbe.main.summary.adapterVersion, 'story-market-price-ledger-1',
        'Fiyat defteri adaptör sürümü açık ve sabit olmalı.');
    assert.equal(marketProbe.main.summary.regionCount, 152, 'Her kanonik bölgenin ayrı piyasa kaydı olmalı.');
    assert.equal(marketProbe.main.summary.countryCount, 8, 'Sekiz devletin nüfus ağırlıklı ulusal fiyat özeti olmalı.');
    assert.equal(marketProbe.main.summary.activePriceCount, 152 * 6,
        'Her bölgede altı fiziksel mal/enerji fiyatı canlı olmalı.');
    assert.equal(marketProbe.main.readOnly.regionalUnchanged, true,
        'Fiyat tiki bölgesel stok defterini değiştirmemeli.');
    assert.equal(marketProbe.main.readOnly.tradeUnchanged, true,
        'Fiyat tiki sipariş veya sevkiyat durumunu değiştirmemeli.');
    assert.equal(marketProbe.main.readOnly.legacyInflationUnchanged, true,
        'Faz 19 eski makro enflasyonu sessizce ezmemeli.');
    assert.equal(marketProbe.main.indicativeQuote.status, 'INDICATIVE_INDEX_QUOTE',
        'Canlı sözleşme için kaynak/hedef fiyatlarından izlenebilir bir endeks teklifi üretilebilmeli.');
    assert.equal(marketProbe.main.indicativeQuote.settlementStatus, 'BUDGET_ESCROW_PRICE_LOCK',
        'Fiyat teklifi Faz 20 bütçe blokesi ve teslimat uzlaşmasını açıkça göstermeli.');
    assert.equal(marketProbe.main.indicativeQuote.createsDebt, false,
        'Faz 19 fiyat teklifi sahte finansal borç yaratmamalı.');
    assert.equal(marketProbe.main.indicativeQuote.transfersCapital, false,
        'Faz 19 fiyat teklifi sermaye transferi yapmamalı.');
    assert.equal(marketProbe.main.routeRiskIntegrated.shipmentStatus, 'HELD',
        'Piyasa risk probundaki kesilmiş koridor yükü gerçekten HELD olmalı.');
    assert.ok(marketProbe.main.routeRiskIntegrated.inboundHeld > 0,
        'Bekleyen fiziksel yük hedef bölgenin fiyat sinyalinde ölçülmeli.');
    assert.equal(marketProbe.main.routeRiskIntegrated.routeDamageBps, 10000,
        'Tam koridor kesintisi fiyat sinyaline 10.000 baz puan risk olarak girmeli.');
    assert.ok(
        marketProbe.main.routeRiskIntegrated.riskTarget > marketProbe.main.routeRiskIntegrated.noRiskTarget,
        'Aynı stok ve talepte bekleyen yük/rota hasarı fiyat hedefini ölçülebilir biçimde yükseltmeli.'
    );
    assert.ok(Number.isFinite(marketProbe.main.targetFood.signals.stockCoverageDays),
        'Tüketilen mallar şehir UI’ına aktarılabilir sonlu stok-günü sinyali üretmeli.');
    assert.ok(marketProbe.main.alternating.spread < 1,
        'Küçük ve dönüşümlü stok şoku fiyatı sonsuz salınıma sokmamalı.');
    assert.equal(marketProbe.main.zeroStock.targetIndex, 600,
        'Sıfır stok ağır fakat sonlu fiyat baskısı üretmeli.');
    assert.equal(marketProbe.main.zeroStock.nextIndex, 110,
        'Sıfır stokta tek tik fiyat hareketi %10 tavanını aşmamalı.');
    assert.ok(marketProbe.main.surplus.targetIndex < 100,
        'Açık arz fazlası fiyat hedefini baz endeksin altına indirmeli.');
    assert.equal(marketProbe.main.labor.status, 'DEFERRED',
        'NON_STOCK iş gücü sahte stok kıtlığıyla fiyatlandırılmamalı.');
    assert.equal(marketProbe.main.labor.priceIndex, null,
        'İş gücü piyasası kurulmadan kesin ücret endeksi uydurulmamalı.');
    assert.equal(marketProbe.main.capital.status, 'NUMERAIRE',
        'Para sistemi gelene kadar sermaye açıkça numeraire olmalı.');
    assert.equal(marketProbe.main.capital.priceIndex, 1,
        'Faz 20 öncesi sermaye numeraire değeri sabit 1 kalmalı.');
    assert.equal(marketProbe.main.ownMarketFact.status, 'VERIFIED',
        'Oyuncunun kendi bölgesel fiyatları doğrulanmış piyasa kaydı olmalı.');
    assert.equal(marketProbe.main.foreignMarketFact.status, 'UNKNOWN',
        'Yabancı bölgesel fiyat ayrıntısı bilgi sistemi olmadan sızmamalı.');
    for (const invalid of Object.values(marketProbe.main.invalid)) {
        assert.equal(invalid.ok, false, 'Bozuk piyasa defteri doğrulayıcıdan geçmemeli.');
    }
    assert.equal(marketProbe.restored.loaded, true, 'Fiyat geçmişi taşıyan kayıt yeniden açılabilmeli.');
    assert.equal(marketProbe.restored.validation.ok, true, 'Yüklenen piyasa defteri geçerli kalmalı.');
    assert.equal(marketProbe.restored.exact, true, 'Bölgesel fiyat, sinyal ve ulusal sepet kayıtta birebir korunmalı.');
    assert.equal(marketProbe.restored.regionalUnchanged, true,
        'Piyasa yüklemesi bölgesel stoğu ikinci kez değiştirmemeli.');
    assert.equal(marketProbe.restored.tradeUnchanged, true,
        'Piyasa yüklemesi yoldaki yükü ikinci kez işlememeli.');
    assert.equal(marketProbe.legacy.loaded, true, 'Piyasa defteri olmayan eski kayıt açılabilmeli.');
    assert.equal(marketProbe.legacy.validation.ok, true, 'Eski kayıt güvenli baz fiyatlarla backfill edilmeli.');
    assert.equal(marketProbe.legacy.ledger.diagnostics.backfilled, true,
        'Eski kayıt piyasa backfill teşhisini açıkça taşımalı.');
    assert.equal(marketProbe.legacy.regionalUnchanged, true, 'Piyasa backfill’i mevcut stoklara dokunmamalı.');
    assert.equal(marketProbe.legacy.tradeUnchanged, true, 'Piyasa backfill’i mevcut sevkiyatlara dokunmamalı.');
    assert.equal(marketProbe.corrupt.loaded, true, 'Bozuk piyasa defteri dünya kaybı olmadan açılabilmeli.');
    assert.equal(marketProbe.corrupt.validation.ok, true, 'Bozuk piyasa defteri güvenli baz fiyatlarla kurtarılmalı.');
    assert.equal(marketProbe.corrupt.ledger.diagnostics.restoredFromInvalidLedger, true,
        'Bozuk piyasa kurtarması sessiz olmamalı.');
    assert.equal(marketProbe.corrupt.regionalUnchanged, true, 'Bozuk fiyat defteri stok üretmemeli veya silmemeli.');
    assert.equal(marketProbe.corrupt.tradeUnchanged, true, 'Bozuk fiyat defteri sevkiyat üretmemeli veya silmemeli.');
    assert.equal(marketProbe.disabled.summary.disabled, true, 'Piyasa katmanı özellik bayrağıyla kapanabilmeli.');
    assert.equal(marketProbe.disabled.ledger, null, 'Kapalı piyasa katmanı sahte fiyat üretmemeli.');
    assert.equal(marketProbe.ab.changed, true, 'Piyasa açık/kapalı A/B karması fiyat defteri nedeniyle farklı olmalı.');
    assert.equal(marketProbe.ab.physicalEqual, true,
        'Piyasa defteri çıkarıldığında açık/kapalı koşuların fiziksel dünyası birebir aynı kalmalı.');

    const budgetProbe = probeStateBudget();
    assert.equal(budgetProbe.main.validation.ok, true, 'Devlet bütçesi çift taraflı muhasebe sözleşmesini geçmeli.');
    assert.equal(budgetProbe.main.debit.ok, true, 'Bakiyesi olan devlet gerçek bütçe gideri yapabilmeli.');
    assert.equal(budgetProbe.main.afterDebit.cash, budgetProbe.main.opening.cash - 100,
        'Gider devlet nakdini tam tutarı kadar azaltmalı.');
    assert.equal(budgetProbe.main.afterCredit.cash, budgetProbe.main.afterDebit.cash + 40,
        'Vergi geliri devlet nakdini tam tutarı kadar artırmalı.');
    assert.equal(budgetProbe.main.rejected.code, 'INSUFFICIENT_CASH',
        'Bakiyeyi aşan harcama sessiz negatif hazine yerine reddedilmeli.');
    assert.equal(budgetProbe.main.rejectedAtomic, true, 'Reddedilen harcama nakit, borç veya blokeyi değiştirmemeli.');
    assert.equal(budgetProbe.main.debt.ok, true, 'Borç tavanı içindeki eşit-kural tahvili nakit üretebilmeli.');
    assert.equal(budgetProbe.main.afterDebt.debt, 200, 'Borç ihracı eşit tutarda açık yükümlülük yaratmalı.');
    assert.equal(budgetProbe.main.issuance.ok, true, 'Para basımı gizli gelir yerine ayrı işlem olarak kaydedilebilmeli.');
    assert.equal(budgetProbe.main.afterIssuance.moneyIssued, 50, 'Basılan para ayrı karşı hesapta görünmeli.');
    assert.ok(budgetProbe.main.inflationAfterPrint > budgetProbe.main.inflationBeforePrint,
        'Para basımı eski makro katmanda ölçülebilir enflasyon baskısı yaratmalı.');
    assert.ok(budgetProbe.main.confidenceAfterPrint < budgetProbe.main.confidenceBeforePrint,
        'Para basımı piyasa güvenini bedelsiz bırakmamalı.');
    assert.ok(budgetProbe.main.invalid.policy.issues.some(issue => issue.code === 'BUDGET_POLICY_HASH'),
        'Yanlış bütçe politika karması reddedilmeli.');
    assert.ok(budgetProbe.main.invalid.cash.issues.some(issue => issue.code === 'BUDGET_NEGATIVE_CASH'),
        'Negatif nakit bütçe doğrulamasından geçmemeli.');
    assert.ok(budgetProbe.main.invalid.posting.issues.some(issue => issue.code === 'BUDGET_UNBALANCED_TRANSACTION'),
        'Tek taraflı muhasebe fişi reddedilmeli.');
    assert.ok(budgetProbe.main.invalid.country.issues.some(issue => issue.code === 'BUDGET_COUNTRY_MISSING'),
        'Eksik devlet hesabı sessizce kabul edilmemeli.');
    assert.equal(budgetProbe.main.ownBudgetFact.status, 'VERIFIED',
        'Oyuncunun kendi bütçesi doğrulanmış yönetim verisi olmalı.');
    assert.equal(budgetProbe.main.foreignBudgetFact.status, 'UNKNOWN',
        'Yabancı bütçe istihbarat olmadan kesin değer sızdırmamalı.');
    assert.match(budgetProbe.main.budgetTabText, /DEVLET BÜTÇESİ/i,
        'Ekonomi paneli planın gerektirdiği veri odaklı bütçe görünümünü taşımalı.');
    assert.equal(budgetProbe.restored.loaded, true, 'Bütçe taşıyan kayıt açılabilmeli.');
    assert.equal(budgetProbe.restored.validation.ok, true, 'Yüklenen bütçe defteri geçerli kalmalı.');
    assert.equal(budgetProbe.restored.exactLedger, true, 'Bütçe hesapları ve fişleri kayıt/yüklemede birebir korunmalı.');
    assert.equal(budgetProbe.legacy.loaded, true, 'Bütçe öncesi eski kayıt açılabilmeli.');
    assert.equal(budgetProbe.legacy.validation.ok, true, 'Eski kayıttan cüzdan toplamına bağlı geçerli açılış bütçesi kurulmalı.');
    assert.equal(budgetProbe.legacy.diagnostics.backfilled, true, 'Eski kayıt bütçe backfill teşhisi taşımalı.');
    assert.equal(budgetProbe.disabled.summary.disabled, true, 'Bütçe motoru özellik bayrağıyla kapanabilmeli.');
    assert.equal(budgetProbe.disabled.ledger, null, 'Kapalı bütçe motoru sahte hesap üretmemeli.');
    assert.equal(budgetProbe.ab.changed, true, 'Bütçe açık/kapalı A/B koşusu gerçek mali sınır farkı üretmeli.');

    const companyProbe = probeCompaniesBanks();
    assert.equal(companyProbe.main.validation.ok, true,
        'Şirket, banka, tesis ve para koruma defteri kendi sözleşmesini geçmeli.');
    assert.equal(companyProbe.main.opening.companyCount, 48,
        'Açılışta her devletin altı fiziksel sektöründe ayrı şirket bulunmalı.');
    assert.equal(companyProbe.main.opening.bankCount, 8,
        'Bankalar devlet kasasının takma adı değil ayrı sekiz bilanço olmalı.');
    assert.ok(companyProbe.main.opening.facilityCount > 0 && companyProbe.main.opening.warehouseCount === 152,
        'Canlı sektör kapasitesinin sahibi ve her bölgenin depo kaydı bulunmalı.');
    assert.equal(companyProbe.main.loan.ok, true, 'Banka rezervi ve şirket borç tavanı içindeki kredi verilebilmeli.');
    assert.equal(
        companyProbe.main.companyAfterLoan.accounts['ASSET:CASH'],
        companyProbe.main.companyBeforeLoan.accounts['ASSET:CASH'] + 100,
        'Kredi şirket nakdini tam tutarda artırmalı.'
    );
    assert.equal(companyProbe.main.bankAfterLoan.reserves, companyProbe.main.bankBeforeLoan.reserves - 100,
        'Kredi devlet hazinesinden değil bankanın gerçek rezervinden çıkmalı.');
    assert.equal(companyProbe.main.companyAfterLoan.accounts['LIABILITY:DEBT'], -100,
        'Kredi şirket bilançosunda eşit borç yaratmalı.');
    assert.equal(companyProbe.main.investment.ok, true,
        'Yeterli nakit ve fiziksel parçaya sahip şirket kapasite yatırımı başlatabilmeli.');
    assert.equal(companyProbe.main.investment.project.status, 'BUILDING',
        'Yatırım emri sonuç anının kopyasını taşımalı; sonraki tik eski karar raporunu geriye dönük değiştirmemeli.');
    assert.equal(companyProbe.main.capacityDuring, companyProbe.main.capacityBefore,
        'Yatırım emri kapasiteyi anında ve bedelsiz artırmamalı.');
    assert.equal(companyProbe.main.stockAfterInvestment, companyProbe.main.stockBeforeInvestment - 18,
        'Yatırım gerçek sanayi parçasını bölgesel stoktan tüketmeli.');
    assert.equal(companyProbe.main.completedProject.status, 'COMPLETED',
        'Dünya günü gereksinimi tamamlanan proje inşa durumundan çıkmalı.');
    assert.equal(
        companyProbe.main.capacityAfter,
        companyProbe.main.capacityBefore + 0.2,
        'Tamamlanan yatırım hem tesis hem kanonik sektör kapasitesini artırmalı.'
    );
    assert.equal(companyProbe.main.lobby.ok, true, 'Şirket lobi faaliyeti gerçek şirket gideriyle çalışabilmeli.');
    assert.ok(companyProbe.main.lobbyAfter > companyProbe.main.lobbyBefore,
        'Lobi harcaması izlenebilir şirket etkisi üretmeli.');
    assert.equal(companyProbe.main.prematureRegistration.code, 'APPLICATION_REQUIREMENTS_INCOMPLETE',
        'Sermaye ve ruhsat yokken konuşmada adı geçen şirket hukuken var sayılamaz.');
    assert.equal(companyProbe.main.stillPremature.code, 'APPLICATION_REQUIREMENTS_INCOMPLETE',
        'Yalnız sermaye yatırmak ruhsat gereksinimini atlatmamalı.');
    assert.equal(companyProbe.main.funding.application.status, 'PENDING_LICENSE',
        'Sermaye sonucu sonraki ruhsat/kayıt adımlarıyla geriye dönük değişmemeli.');
    assert.equal(companyProbe.main.license.application.status, 'READY_TO_REGISTER',
        'Ruhsat sonucu kayıt öncesi karar anının bağımsız kopyasını taşımalı.');
    assert.equal(companyProbe.main.registration.ok, true,
        'Sermaye doğrulaması ve ruhsat tamamlanınca şirket tescil edilebilmeli.');
    assert.equal(companyProbe.main.countAfterApplication, companyProbe.main.countBeforeApplication + 1,
        'Başvuru zinciri yalnız tamamlandığında gerçek şirket kaydı üretmeli.');
    assert.equal(companyProbe.main.ownCompanyFact.status, 'VERIFIED',
        'Oyuncunun kendi bölgesindeki şirket ve tesis sicili doğrulanmış görünmeli.');
    assert.equal(companyProbe.main.foreignCompanyFact.status, 'UNKNOWN',
        'Yabancı şirket bilançosu ve tesis ayrıntısı istihbarat olmadan sızmamalı.');
    assert.match(companyProbe.main.companyTabText, /TESİS SAHİPLİĞİ/i,
        'Ekonomi paneli şirketleri sahte boş kart yerine tesis sahipliğiyle göstermeli.');
    assert.ok(companyProbe.main.invalid.policy.issues.some(issue => issue.code === 'COMPANY_POLICY_HASH'),
        'Yanlış şirket politika karması reddedilmeli.');
    assert.ok(companyProbe.main.invalid.cash.issues.some(issue => issue.code === 'COMPANY_NEGATIVE_CASH'),
        'Negatif şirket nakdi doğrulamadan geçmemeli.');
    assert.ok(companyProbe.main.invalid.ownership.issues.some(issue => issue.code === 'COMPANY_OWNERSHIP'),
        'Toplamı yüzde yüz olmayan ortaklık reddedilmeli.');
    assert.ok(companyProbe.main.invalid.facility.issues.some(issue => issue.code === 'FACILITY_OWNER'),
        'Sahibi bulunmayan tesis sessizce kabul edilmemeli.');
    assert.ok(companyProbe.main.invalid.money.issues.some(issue => issue.code === 'COMPANY_MONEY_CONSERVATION'),
        'Şirket/banka sisteminde karşılıksız para oluşumu yakalanmalı.');
    assert.equal(companyProbe.restored.loaded, true, 'Şirket ve yatırım taşıyan kayıt açılabilmeli.');
    assert.equal(companyProbe.restored.validation.ok, true, 'Yüklenen şirket/banka defteri geçerli kalmalı.');
    assert.equal(companyProbe.restored.exactLedger, true, 'Şirket hesapları, tesisler ve projeler birebir korunmalı.');
    assert.equal(companyProbe.legacy.loaded, true, 'Şirket katmanı öncesi kayıt güvenle açılabilmeli.');
    assert.equal(companyProbe.legacy.validation.ok, true, 'Eski kayıttan geçerli şirket/tesis açılışı kurulmalı.');
    assert.equal(companyProbe.legacy.diagnostics.backfilled, true, 'Eski kayıt şirket backfill teşhisi taşımalı.');
    assert.equal(companyProbe.corrupt.loaded, true, 'Bozuk şirket defteri dünya kaybı olmadan açılmalı.');
    assert.equal(companyProbe.corrupt.validation.ok, true, 'Bozuk şirket defteri güvenli açılışla onarılmalı.');
    assert.equal(companyProbe.corrupt.diagnostics.restoredFromInvalidLedger, true,
        'Bozuk şirket defteri kurtarması sessiz olmamalı.');
    assert.equal(companyProbe.disabled.summary.disabled, true,
        'Şirket/banka katmanı özellik bayrağıyla güvenle kapanabilmeli.');
    assert.equal(companyProbe.disabled.ledger, null, 'Kapalı şirket katmanı sahte aktör üretmemeli.');
    assert.equal(companyProbe.ab.changed, true,
        'Şirket/banka açık-kapalı A/B koşusu gerçek ekonomik dünya farkı üretmeli.');

    const unitEconomics = probeProductionUnitEconomics();
    const civilianEconomics = unitEconomics.rows.filter(
        row => row.sectorId !== 'defense_industry'
    );
    assert.equal(civilianEconomics.length, 5,
        'Birim ekonomi probu bes sivil uretim sektorunu olcmeli.');
    assert.ok(civilianEconomics.every(row => row.marginWithCapitalReserved > 0),
        'Isletme sermayesi gider yazilmadiginda sivil sektorler taban fiyatlarda pozitif brut marj tasimali.');
    assert.ok(civilianEconomics.every(row => row.currentViability.approved),
        'Sivil uretim karari gercek fiziksel girdi maliyetini kullanarak baslangicta calisabilmeli.');
    assert.ok(civilianEconomics.every(row => row.currentViability.costBasis === 'PHYSICAL_INPUTS'),
        'Satis mutabakati acikken planlayici ile muhasebe ayni fiziksel girdi maliyetini kullanmali.');
    const defenseEconomics = unitEconomics.rows.find(
        row => row.sectorId === 'defense_industry'
    );
    assert.ok(defenseEconomics && defenseEconomics.marginWithCapitalReserved < 0,
        'Savunma sanayii spot piyasa acigi gizli taban fiyat degisikligiyle saklanmamali.');
    assert.equal(defenseEconomics.currentViability.revenueBasis, 'STATE_MILITARY_CONTRACT',
        'Savunma uretimi spot zararini yalniz acik devlet/ordu sozlesmesiyle kapatmali.');
    assert.equal(defenseEconomics.currentViability.approved, true,
        'Maliyeti ve sozlesme marjini odeyen askeri tedarik, savunma uretimini planlama kapisindan gecirmeli.');

    const saleProbe = probeSaleSettlement();
    assert.equal(saleProbe.production.ok, true,
        'Faz 22.1E mikro uretimi fiziksel ve mali on kapilardan gecmeli.');
    assert.equal(
        saleProbe.afterProduction.company.cumulative.revenue,
        saleProbe.before.revenue,
        'Uretim tek basina sirket geliri yaratmamali.'
    );
    assert.equal(saleProbe.production.transaction.companySettlement.revenue, 0,
        'Uretim fisi geliri satisa kadar kesin olarak ertelemeli.');
    assert.ok(saleProbe.afterProduction.producedLot,
        'Uretilen fiziksel mal sahipli ve maliyetli sirket envanterine donusmeli.');
    assert.equal(saleProbe.afterProduction.producedLot.totalCost, 0.045,
        'Tarim ciktisi yalniz gercek enerji girdisini maliyetlestirmeli; likidite sarti ikinci kez gider olmamali.');
    assert.equal(saleProbe.production.transaction.companySettlement.workingCapitalRequired, 2,
        'Tarifin isletme sermayesi uretim icin korunan likidite sarti olarak raporlanmali.');
    assert.equal(saleProbe.production.transaction.companySettlement.purchaseCashRequired, 0.045,
        'Uretim fisinde gercek fiziksel girdi nakit cikisi ayri gorunmeli.');
    assert.equal(
        Math.round((saleProbe.before.company.accounts['ASSET:CASH']
            - saleProbe.afterProduction.company.accounts['ASSET:CASH']) * 1000) / 1000,
        0.045,
        'Uretim sirket kasasindan isletme sermayesini yok etmemeli; yalniz satin alinan girdiyi odemeli.'
    );
    assert.equal(saleProbe.afterProduction.validation.ok, true,
        'Uretim sonrasinda fiziksel stok ile sahipli lot aynasi uyusmali.');
    assert.equal(saleProbe.sale.allocations[0].delivered, 0.5,
        'Hane talebi gercek satis kapisindan teslim edilmeli.');
    assert.equal(saleProbe.afterSale.invoice.status, 'SETTLED',
        'Teslim edilen satis ortak kimlikli kapanmis fatura uretmeli.');
    assert.equal(saleProbe.afterSale.invoice.sellerId, saleProbe.companyId,
        'Faturadaki satici malin gercek sahibi sirket olmali.');
    assert.equal(saleProbe.afterSale.invoice.buyerType, 'HOUSEHOLDS',
        'Hane satisinda gercek alici sinifi kaydedilmeli.');
    assert.ok(
        saleProbe.afterSale.company.cumulative.revenue > saleProbe.afterProduction.company.cumulative.revenue,
        'Sirket geliri ancak mulkiyet aliciya gectiginde artmali.'
    );
    assert.equal(saleProbe.afterSale.companyValidation.ok, true,
        'Satis sonrasinda sirket cift kayit defteri gecerli kalmali.');
    assert.equal(saleProbe.afterSale.commerceValidation.ok, true,
        'Satis sonrasinda fatura, maliyet ve fiziksel lot defteri gecerli kalmali.');
    assert.equal(saleProbe.before.money, saleProbe.afterProduction.money,
        'Uretim finansmani toplam para yaratmamali veya yok etmemeli.');
    assert.equal(saleProbe.before.money, saleProbe.afterSale.money,
        'Hane satisi toplam para yaratmamali veya yok etmemeli.');
    assert.equal(saleProbe.companySale.allocations[0].delivered, 0.25,
        'Sirket girdisi gercek alici sirket kimligiyle teslim edilmeli.');
    assert.equal(saleProbe.afterCompanySale.invoice.buyerId,
        saleProbe.afterCompanySale.buyerCompanyId,
        'Sirketler arasi faturada gercek alici sirket kaydedilmeli.');
    assert.ok(
        saleProbe.afterCompanySale.seller.cumulative.revenue
            > saleProbe.afterCompanySale.sellerRevenueBefore,
        'Sirketler arasi teslim satucunun gelirini artirmali.'
    );
    assert.ok(
        saleProbe.afterCompanySale.buyer.accounts['ASSET:CASH']
            < saleProbe.afterCompanySale.buyerCashBefore,
        'Sirketler arasi teslim alicinin gercek nakdini azaltmali.'
    );
    assert.equal(saleProbe.afterCompanySale.companyValidation.ok, true,
        'Sirketler arasi satis cift kayit defterini bozmamali.');
    assert.equal(saleProbe.afterCompanySale.commerceValidation.ok, true,
        'Sirketler arasi satis fiziksel lot ve fatura mutabakatini bozmamali.');
    assert.equal(saleProbe.before.money, saleProbe.afterCompanySale.money,
        'Sirketler arasi satis toplam para yaratmamali veya yok etmemeli.');
    assert.equal(saleProbe.restored.loaded, true,
        'Faz 22.1E envanter ve faturasi tasiyan kayit yeniden acilabilmeli.');
    assert.equal(saleProbe.restored.exactCommerce, true,
        'Sahipli lotlar ve faturalar kayit/yuklemede birebir korunmali.');
    assert.equal(saleProbe.restored.companyValidation.ok, true,
        'Yuklenen satis kaydi sirket muhasebesini korumali.');
    assert.equal(saleProbe.restored.commerceValidation.ok, true,
        'Yuklenen satis kaydi fiziksel lot aynasini korumali.');
    assert.equal(saleProbe.ab.defaultMatchesExplicitOn, true,
        'Faz 22.1E varsayilan yolu acik bayrakla ayni dunya karmasini uretmeli.');
    assert.equal(saleProbe.ab.explicitOffDiffers, true,
        'Faz 22.1E acikca kapatildiginda yeni satis ve sahiplik akisi dunya karmasindan cikmali.');
    const saleFlow = runStorySimulation({
        seed: 2032,
        seconds: 60,
        featureFlags: { 'economy.saleSettlement': true }
    });
    assert.equal(saleFlow.commerceValidation.ok, true,
        'Gercek ekonomi dongusunde satis, depolama, ticaret kargosu ve yatirim emaneti fiziksel lot aynasini korumali.');
    assert.equal(saleFlow.companyValidation.ok, true,
        'Uzun satis akisinda sirket envanter maliyeti cift kayit muhasebesiyle uyusmali.');
    assert.equal(saleFlow.tradeValidation.ok, true,
        'Sahipli ticaret kargosu lojistik koruma denklemini bozmamali.');
    assert.equal(saleFlow.economicAIValidation.ok, true,
        'Yatirim girdisi emaneti ekonomik AI karar defterini bozmamali.');
    assert.ok(saleFlow.commerceSummary.countByBuyerType.COMPANY > 0,
        'Bolgesel sirket bakim talebi gercek alici sirket kimlikleriyle faturalanmali.');
    assert.equal(saleFlow.regionalOperationalSummary.demandRequested.industrial_parts, 0,
        'Uretim recetesinde gercekten satin alinan parca, ikinci bir vekil bakim talebiyle tekrar tuketilmemeli.');
    assert.equal(saleFlow.regionalOperationalSummary.demandRequested.electronics, 0,
        'Uretim recetesinde gercekten satin alinan elektronik, ikinci bir vekil bakim talebiyle tekrar tuketilmemeli.');
    assert.ok(saleFlow.commerceSummary.countByBuyerType.STATE > 0,
        'Kamu hizmeti talebi gercek devlet butcesi kimligiyle faturalanmali.');
    assert.ok(saleFlow.commerceSummary.countByBuyerType.MILITARY > 0,
        'Ordu ikmali gercek devlet odemesi ve askeri alici turuyle faturalanmali.');
    assert.ok(saleFlow.companySummary.capacityBySector.agriculture > 0,
        'Uzun ekonomi akisinda tarim kapasitesi sektor bazinda gozlenebilir olmali.');
    assert.ok(saleFlow.companySummary.projectCountsBySectorStatus
        && typeof saleFlow.companySummary.projectCountsBySectorStatus === 'object',
        'Yatirim darboğazi aktif ve tamamlanan projeler sektor/durum kirilimiyla raporlanmali.');
    assert.equal(
        Object.keys(saleFlow.regionalOperationalSummary.countryBreakdown).length,
        8,
        'Ekonomi raporu sekiz devletin stok, akim ve blokaj kirilimini ayri vermeli.'
    );
    const countryEnergyStock = Object.values(
        saleFlow.regionalOperationalSummary.countryBreakdown
    ).reduce((sum, country) => sum + Number(country.stocks.energy || 0), 0);
    assert.ok(
        Math.abs(countryEnergyStock - saleFlow.regionalSummary.stockTotals.energy) < 1e-3,
        'Ulke bazli enerji stogu dunya toplamiyla mutabik olmali.'
    );
    const countryRows = Object.values(
        saleFlow.regionalOperationalSummary.countryBreakdown
    );
    assert.ok(countryRows.every(country => (
        Number.isFinite(Number(country.productionInputOperatingReserve.energy))
            && Number(country.productionInputOperatingReserve.energy) >= 0
            && Number.isFinite(Number(country.productionInputDomesticAvailable.energy))
            && Number(country.productionInputDomesticAvailable.energy) >= 0
    )), 'Ulke tanisi fiziksel stok ile gercek uretim/tuketim rezervini ayri gostermeli.');
    const countryCommerceEnergy = countryRows.reduce(
        (sum, country) => sum + Number(country.commerceInventory.energy || 0),
        0
    );
    assert.ok(
        Math.abs(countryCommerceEnergy - saleFlow.regionalSummary.stockTotals.energy) < 1e-2,
        'Ulke bazli sahipli enerji lotlari fiziksel dunya stoguyla mutabik olmali.'
    );
    assert.ok(countryRows.every(country => (
        country.agricultureEnergyBlockingRegions
            === country.agricultureEnergyBlockers.length
    )), 'Tarim-enerji blokaji sayaci denetlenebilir bolge listesiyle birebir kapanmali.');
    assert.ok(countryRows.every(country => (
        country.productionInputOrdersByResourceStatus
            && country.productionInputOrderFailures
            && country.productionInputInboundByResourceStatus
            && country.productionInputOutboundByResourceStatus
    )), 'Uretim girdisi siparis, hata ve fiziksel kargo akisları ulke bazinda ayrilabilmeli.');
    assert.ok(saleFlow.regionalSummary.flowTotals.produced.military_supplies > 0,
        'Maliyeti karsilayan askeri tedarik sozlesmesi savunma uretimini gercekten baslatmali.');
    assert.ok(saleFlow.tradeOperationalSummary.companyBuyerOrders > 0,
        'Sinir otesi otomatik siparis gercek ithalatci sektor sirketine baglanmali.');
    assert.ok(saleFlow.tradeOperationalSummary.crossBorderDeliveredShipments > 0,
        'Sirket alicili sinir otesi yukler fiziksel teslimata ulasabilmeli.');
    assert.ok(saleFlow.budgetSummary.companyFundedReservations > 0,
        'Ithalat blokesi devlet hazinesi yerine gercek alici sirket hesabinda tutulmali.');
    assert.ok(saleFlow.budgetSummary.companyTradeEscrow > 0,
        'Aktif sirket ithalat siparislerinin nakit blokesi raporda gorunmeli.');
    const saleResume = probeSaleSettlementResume();
    assert.equal(saleResume.loaded, true,
        'Aktif sirket ithalat blokesi tasiyan Faz 22.1E kaydi yeniden acilabilmeli.');
    assert.ok(saleResume.before.tradeEscrow > 0 && saleResume.before.companyReservations > 0,
        'Kayit probu gercek aktif sirket ithalat blokesi tasimali.');
    assert.equal(saleResume.before.orphanEscrowRejected, true,
        'Aktif uzlasmasi olmayan sirket ticaret emaneti defter dogrulamasindan gecmemeli.');
    assert.deepEqual(saleResume.exact, { company: true, budget: true, trade: true },
        'Sirket, butce uzlasmasi ve fiziksel ticaret defterleri kayit/yuklemede birebir korunmali.');
    assert.equal(saleResume.after.companyValidation.ok, true,
        'Yuklenen ithalat blokeleri ilerledikten sonra sirket defteri gecerli kalmali.');
    assert.equal(saleResume.after.budgetValidation.ok, true,
        'Yuklenen ithalat blokeleri ilerledikten sonra butce uzlasmasi gecerli kalmali.');
    assert.equal(saleResume.after.tradeValidation.ok, true,
        'Yuklenen ithalat blokeleri ilerledikten sonra fiziksel yuk defteri gecerli kalmali.');

    const economicAIProbe = probeEconomicAI();
    assert.equal(economicAIProbe.main.validation.ok, true,
        'Ekonomik AI karar defteri kendi yapisal sozlesmesini gecmeli.');
    assert.equal(economicAIProbe.main.companyValidation.ok, true,
        'Ekonomik AI kararlari sirket ve banka muhasebesini bozmamali.');
    assert.equal(economicAIProbe.main.budgetValidation.ok, true,
        'Ekonomik AI kararlari devlet butcesi mutabakatini bozmamali.');
    assert.equal(economicAIProbe.main.regionalValidation.ok, true,
        'Ekonomik AI yatirimlari fiziksel bolgesel stok korumasini bozmamali.');
    assert.ok(economicAIProbe.main.summary.totals.cycles > 0,
        'Ekonomik AI karar dongusu hikaye saati ilerledikce calismali.');
    assert.ok(economicAIProbe.main.summary.totals.projectsStarted > 0,
        'Kronik arz baskisi gorulunce en az bir gercek kapasite yatirimi baslamali.');
    assert.ok(economicAIProbe.main.summary.totals.loansTaken > 0,
        'Likidite eksigi uygun banka rezervi ve borc tavani icinde krediyle giderilebilmeli.');
    assert.ok(economicAIProbe.main.summary.totals.outcomesRealized > 0,
        'Yatirim karari yalniz raporda kalmamali; tamamlanip kapasite sonucuna donusmeli.');
    assert.equal(economicAIProbe.main.companySummary.bankruptCompanies.length, 0,
        'Ekonomik AI calisma sermayesini sifira indirerek sirketleri yapay bicimde batirmamali.');
    assert.ok(economicAIProbe.main.firstApplied
        && economicAIProbe.main.firstApplied.selectedScore >= 4300,
    'Uygulanan ilk ekonomik karar esik ustu puan ve kaydedilmis sinyaller tasimali.');
    assert.ok(economicAIProbe.main.firstApplied.candidates[0].reasons.length > 0,
        'Karar kaydi oyuncuya anlatilabilir gerekceler tasimali.');
    assert.equal(economicAIProbe.main.playerStateAutonomousCount, 0,
        'AI oyuncunun devlet hazinesi adina otonom karar alamamali.');
    assert.equal(economicAIProbe.main.ownPolicyFact.status, 'VERIFIED',
        'Oyuncunun kendi ekonomik karar gerekceleri dogrulanmis bilgi olmali.');
    assert.equal(economicAIProbe.main.foreignPolicyFact.status, 'UNKNOWN',
        'Yabanci ekonomik karar gerekceleri istihbarat olmadan sizmamali.');
    assert.match(economicAIProbe.main.companyTabText, /EKONOM.K KARAR GEREK.ELER./i,
        'Sirket arayuzu ekonomik AI kararlarini ve gerekcelerini gostermeli.');
    assert.ok(economicAIProbe.main.invalid.policy.issues.some(
        issue => issue.code === 'ECONOMIC_AI_POLICY_HASH'
    ), 'Yanlis ekonomik AI politika karmasi reddedilmeli.');
    assert.ok(economicAIProbe.main.invalid.sequence.issues.some(
        issue => issue.code === 'ECONOMIC_AI_SEQUENCE'
    ), 'Gecersiz ekonomik AI karar sayaci reddedilmeli.');
    assert.ok(economicAIProbe.main.invalid.action.issues.some(
        issue => issue.code === 'ECONOMIC_AI_SELECTION'
            || issue.code === 'ECONOMIC_AI_CANDIDATE'
    ), 'Katalog disi ekonomik eylem reddedilmeli.');
    assert.ok(economicAIProbe.main.invalid.score.issues.some(
        issue => issue.code === 'ECONOMIC_AI_CANDIDATE'
    ), 'Sonlu olmayan ekonomik aday puani reddedilmeli.');
    assert.ok(economicAIProbe.stateGrant.decision
        && economicAIProbe.stateGrant.decision.execution.status === 'APPLIED',
    'AI devleti kronik stratejik acik ve ozel finansman yoklugunda hedefli destek verebilmeli.');
    assert.equal(
        economicAIProbe.stateGrant.stateCashAfter,
        economicAIProbe.stateGrant.stateCashBefore
            - economicAIProbe.stateGrant.decision.execution.amount,
        'Devlet destegi hazineden tam tutarda cikmali.'
    );
    assert.equal(
        economicAIProbe.stateGrant.companyCashAfter,
        economicAIProbe.stateGrant.companyCashBefore
            + economicAIProbe.stateGrant.decision.execution.amount,
        'Devlet destegi sirket hesabina ayni tutarda girmeli.'
    );
    assert.equal(economicAIProbe.stateGrant.economicValidation.ok, true,
        'Hedefli destek sonrasi ekonomik AI defteri gecerli kalmali.');
    assert.equal(economicAIProbe.stateGrant.companyValidation.ok, true,
        'Hedefli destek sonrasi sirket para korumasi gecerli kalmali.');
    assert.equal(economicAIProbe.stateGrant.budgetValidation.ok, true,
        'Hedefli destek sonrasi devlet butcesi gecerli kalmali.');
    assert.equal(economicAIProbe.restored.loaded, true,
        'Ekonomik AI kararlarini tasiyan kayit acilabilmeli.');
    assert.equal(economicAIProbe.restored.validation.ok, true,
        'Yuklenen ekonomik AI karar defteri gecerli kalmali.');
    assert.equal(economicAIProbe.restored.exactLedger, true,
        'Ekonomik AI karar ve sonuc kayitlari birebir korunmali.');
    assert.equal(economicAIProbe.legacy.loaded, true,
        'Ekonomik AI katmani oncesi kayit guvenle acilabilmeli.');
    assert.equal(economicAIProbe.legacy.diagnostics.backfilled, true,
        'Eski kayit ekonomik AI backfill teshisi tasimali.');
    assert.equal(economicAIProbe.corrupt.loaded, true,
        'Bozuk ekonomik AI defteri dunya kaybi olmadan acilabilmeli.');
    assert.equal(economicAIProbe.corrupt.diagnostics.restoredFromInvalidLedger, true,
        'Bozuk ekonomik AI defteri kurtarmasi sessiz olmamali.');
    assert.equal(economicAIProbe.disabled.summary.disabled, true,
        'Ekonomik AI ozellik bayragiyla guvenle kapanabilmeli.');
    assert.equal(economicAIProbe.disabled.ledger, null,
        'Kapali ekonomik AI sahte karar aktoru uretmemeli.');
    assert.equal(economicAIProbe.ab.changed, true,
        'Ekonomik AI acik-kapali A/B kosusu gercek dunya farki uretmeli.');
    assert.ok(economicAIProbe.ab.onEconomicAI.totals.projectsStarted > 0,
        'A/B treatment kosusunda ekonomik yatirim gorulmeli.');
    assert.equal(economicAIProbe.ab.offEconomicAI.disabled, true,
        'A/B control kosusunda ekonomik AI tamamen kapali kalmali.');

    const populationProbe = probePopulationCohorts();
    assert.equal(populationProbe.main.validation.ok, true,
        'Nüfus kohort defteri yapısal ve muhasebesel sözleşmesini geçmeli.');
    assert.equal(populationProbe.main.worldValidation.ok, true,
        'Kohortlar V2 dünya varlığı olarak geçerli bölge ve ülkelere bağlanmalı.');
    assert.equal(populationProbe.main.knowledgeValidation.ok, true,
        'Nüfus bilgisi oyuncu bilgi sözleşmesini bozmamalı.');
    assert.equal(populationProbe.main.liveRegionExact, true,
        'Her bölgenin kohort toplamı canlı bölge nüfusuyla tamsayı kişi düzeyinde uyuşmalı.');
    assert.equal(populationProbe.main.countryExact, true,
        'Her ülkenin nüfusu sahip olduğu bölgelerin toplamından birebir türemeli.');
    assert.equal(populationProbe.main.summary.regionCount, 152,
        'Her kanonik bölgenin nüfus kohort kaydı olmalı.');
    assert.equal(populationProbe.main.summary.cohortCount, 152 * 12,
        'Her bölgede yaş/gelir/meslek/eğitim/kimlik kesişimini taşıyan 12 anlamlı kohort olmalı.');
    assert.equal(populationProbe.main.worldCohortCount, 152 * 12,
        'Kohortlar yalnız iç defterde değil V2 dünyasında da görünür olmalı.');
    assert.ok(populationProbe.main.distinctDistributions > 1,
        'Bütün bölgeler aynı demografik şablonun kopyası olmamalı.');
    assert.equal(populationProbe.main.ownCensus.status, 'VERIFIED',
        'Oyuncunun kendi bölgesindeki kohortlar doğrulanmış nüfus sayımı olmalı.');
    assert.equal(populationProbe.main.foreignCensus.status, 'UNKNOWN',
        'Yabancı bölgenin ayrıntılı kohortları istihbarat olmadan sızmamalı.');
    assert.equal(populationProbe.main.labor.status, 'COHORT_DERIVED',
        'İş gücü sınırsız dış akıştan değil çalışma çağındaki kohortlardan türemeli.');
    assert.ok(populationProbe.main.labor.availableWorkersPeople > 0,
        'Canlı nüfus gerçek ve sonlu bir kullanılabilir çalışan sayısı üretmeli.');
    assert.equal(populationProbe.main.labor.wageIndex, null,
        'Ücret katmanı gelmeden sahte ücret endeksi üretilmemeli.');
    assert.equal(populationProbe.main.regionalLabor.status, 'COHORT_DERIVED',
        'Bölgesel üretim tiki kohort işgücü kaynağını gerçekten kullanmalı.');
    assert.ok(populationProbe.main.cohortLaborTotal > 0,
        'Kohort işgücü arzı ayrı koruma toplamında ölçülmeli.');
    assert.equal(populationProbe.main.externalLaborTotal, 0,
        'Kohort sistemi açıkken sınırsız dış işgücü girişi kapanmalı.');
    assert.equal(populationProbe.main.laborScarcity.validation.ok, true,
        'İşgücü kıtlığı senaryosu nüfus muhasebesini bozmamalı.');
    assert.equal(populationProbe.main.laborScarcity.labor.laborLots, 0,
        'Çalışabilir meslek kohortu olmayan bölgede işgücü yoktan üretilememeli.');
    assert.equal(populationProbe.main.laborScarcity.consumedLabor, 0,
        'Sıfır kohort işgücünde üretim emek tüketememeli.');
    assert.equal(populationProbe.main.laborScarcity.producedTotal, 0,
        'Sıfır kohort işgücünde bütün emek gerektiren sektörler gerçekten durmalı.');
    assert.equal(populationProbe.main.migration.ok, true,
        'Güncel kayıt V2 gölge göçüne kohortlarıyla çevrilebilmeli.');
    assert.equal(populationProbe.main.migration.validation.ok, true,
        'Kohort taşıyan V2 gölge dünya geçerli kalmalı.');
    assert.equal(populationProbe.main.migration.cohortCount, 152 * 12,
        'V3→V2 göçü Faz 23 nüfus varlıklarını sessizce düşürmemeli.');
    assert.equal(populationProbe.main.reconciliation.actualPopulation,
        populationProbe.main.reconciliation.expectedPopulation,
        'Nüfus değişimi bir sonraki uzlaştırmada tam kişi sayısına yansımalı.');
    assert.equal(populationProbe.main.reconciliation.cohortTotal,
        populationProbe.main.reconciliation.expectedPopulation,
        'Nüfus büyümesi kohortlar arasında kayıpsız dağıtılmalı.');
    assert.equal(populationProbe.main.reconciliation.actualCountryId,
        populationProbe.main.reconciliation.expectedCountryId,
        'Fetih sonrası kohortların siyasi ülke bağı güncellenmeli.');
    assert.equal(populationProbe.restored.loaded, true,
        'Kohort defteri taşıyan kayıt açılabilmeli.');
    assert.equal(populationProbe.restored.validation.ok, true,
        'Yüklenen nüfus defteri geçerli kalmalı.');
    assert.equal(populationProbe.restored.exact, true,
        'Kohort payları ve tamsayı kişi sayıları kayıtta birebir korunmalı.');
    assert.equal(populationProbe.legacy.loaded, true,
        'Faz 23 öncesi kayıt güvenle açılabilmeli.');
    assert.equal(populationProbe.legacy.validation.ok, true,
        'Eski kayıttan canlı nüfusa uygun geçerli kohortlar kurulmalı.');
    assert.equal(populationProbe.legacy.diagnostics.backfilled, true,
        'Eski kayıt nüfus backfill teşhisini açıkça taşımalı.');
    assert.equal(populationProbe.corrupt.loaded, true,
        'Bozuk nüfus defteri dünya kaybı olmadan açılabilmeli.');
    assert.equal(populationProbe.corrupt.validation.ok, true,
        'Bozuk nüfus defteri canlı nüfustan güvenli biçimde onarılmalı.');
    assert.equal(populationProbe.corrupt.diagnostics.restoredFromInvalidLedger, true,
        'Bozuk nüfus kurtarması sessiz olmamalı.');
    assert.equal(populationProbe.disabled.summary.disabled, true,
        'Nüfus katmanı özellik bayrağıyla güvenle kapanabilmeli.');
    assert.equal(populationProbe.disabled.ledger, null,
        'Kapalı nüfus katmanı sahte kohort üretmemeli.');
    assert.equal(populationProbe.disabled.worldCohortCount, 0,
        'Kapalı nüfus katmanı V2 dünyasına kohort sızdırmamalı.');
    assert.equal(populationProbe.ab.changed, true,
        'Nüfus kohortları açık/kapalı A/B koşusunda gerçek işgücü farkı üretmeli.');

    const needsProbe = probeNeedsWelfare();
    assert.equal(needsProbe.main.validation.ok, true,
        'Faz 24 ihtiyac ve yasam kosulu defteri gecerli kalmali.');
    assert.equal(needsProbe.main.saveOk, true,
        'Faz 24 kaydi dogrulama hatasini yutup onceki kaydi birakmamali.');
    assert.equal(needsProbe.main.saveExact, true,
        'Faz 24 kaydi sessizce eski kayitta kalmamali; yazilan ve canli yasam kosulu defterleri birebir olmali.');
    assert.equal(needsProbe.main.worldValidation.ok, true,
        'Ihtiyac sonuclari V2 dunya sozlesmesini bozmamali.');
    assert.equal(needsProbe.main.knowledgeValidation.ok, true,
        'Ihtiyac sonuclari oyuncu bilgi sinirini bozmamali.');
    assert.equal(needsProbe.main.summary.regionCount, 152,
        'Her kanonik bolgenin yasam kosulu sonucu olmali.');
    assert.equal(needsProbe.main.summary.cohortOutcomeCount, 152 * 12,
        'Her nufus kohortu ayri ihtiyac sonucu tasimali.');
    assert.equal(needsProbe.main.legacyWelfareUntouched, true,
        'Faz 24 eski refah alanina ikinci surekli ceza yazmamali.');
    assert.equal(needsProbe.main.shock.householdFoodAllocation.fillBps, 0,
        'Sifir stok ve kapasitede hane gida tahsisi fiziksel olarak sifirlanmali.');
    assert.equal(needsProbe.main.shock.householdEnergyAllocation.fillBps, 0,
        'Sifir stok ve kapasitede hane enerji tahsisi fiziksel olarak sifirlanmali.');
    assert.ok(needsProbe.main.shock.child.hardshipContributionsBps.food
        > needsProbe.main.shock.adultPublic.hardshipContributionsBps.food,
    'Ayni gida soku cocuk kohortunu ust-orta gelirli kamu kohortundan daha sert agirliklandirmali.');
    assert.ok(needsProbe.main.shock.childWellbeingDropBps
        > needsProbe.main.shock.adultPublicWellbeingDropBps,
    'Kaynak soku farkli kohortlarda gercekten farkli yasam kosulu kaybi uretmeli.');
    assert.ok(needsProbe.main.strike.activeIncomeSecurityBps
        < needsProbe.main.strike.baselineIncomeSecurityBps,
    'Grev, calisan kohortun istihdam guvenligi vekilini dusurmeli.');
    assert.ok(needsProbe.main.siege.activeSecurityBps < needsProbe.main.siege.baselineSecurityBps,
        'Kusatma fiziksel guvenlik sonucunu dusurmeli.');
    assert.equal(needsProbe.main.knowledge.own.status, 'VERIFIED',
        'Kendi bolgesinin yasam kosullari dogrulanmis yonetim verisi olmali.');
    assert.equal(needsProbe.main.knowledge.foreign.status, 'UNKNOWN',
        'Yabanci bolgenin yasam kosullari istihbarat olmadan sizmamali.');
    assert.equal(needsProbe.main.ui.hasLivingConditions, true,
        'Nufus sekmesi yasam kosullarini oyuncuya gostermeli.');
    assert.equal(needsProbe.main.ui.hasProxyDisclosure, true,
        'UI gelir guvenligi degerinin ucret degil vekil oldugunu aciklamali.');
    assert.equal(needsProbe.main.migration.ok, true,
        'Faz 24 kaydi V3-V2 golge gocunu tamamlamali.');
    assert.equal(needsProbe.main.migration.validation.ok, true,
        'Yasam kosulu tasiyan golge dunya gecerli olmali.');
    assert.equal(needsProbe.main.migration.regionNeedsPreserved, true,
        'Goc bolge yasam kosulu ozetini sessizce dusurmemeli.');
    assert.equal(needsProbe.main.migration.cohortNeedsPreserved, true,
        'Goc kohort yasam kosulu sonucunu sessizce dusurmemeli.');
    assert.equal(needsProbe.main.migration.unmappedNeeds, false,
        'needsWelfare bilinen kayit alani olarak islenmeli.');
    assert.equal(needsProbe.restored.loaded, true,
        'Ihtiyac defteri tasiyan kayit acilabilmeli.');
    assert.equal(needsProbe.restored.validation.ok, true,
        'Yuklenen ihtiyac defteri gecerli kalmali.');
    assert.equal(needsProbe.restored.exact, true,
        'Kohort yasam kosulu sonuclari kayitta birebir korunmali.');
    assert.equal(needsProbe.legacy.loaded, true,
        'Faz 24 oncesi kayit guvenle acilabilmeli.');
    assert.equal(needsProbe.legacy.diagnostics.backfilled, true,
        'Eski kayit ihtiyac backfill teshisini tasimali.');
    assert.equal(needsProbe.corrupt.loaded, true,
        'Bozuk ihtiyac defteri dunya kaybi olmadan acilabilmeli.');
    assert.equal(needsProbe.corrupt.validation.ok, true,
        'Bozuk ihtiyac defteri canli veriden yeniden kurulabilmeli.');
    assert.equal(needsProbe.corrupt.diagnostics.restoredFromInvalidLedger, true,
        'Bozuk ihtiyac defteri kurtarmasi sessiz olmamali.');
    assert.equal(needsProbe.disabled.summary.disabled, true,
        'Ihtiyac katmani ozellik bayragiyla kapanabilmeli.');
    assert.equal(needsProbe.disabled.ledger, null,
        'Kapali ihtiyac katmani sahte defter uretmemeli.');
    assert.equal(needsProbe.disabled.worldRegionNeeds, 0,
        'Kapali ihtiyac katmani V2 dunyasina sonuc sizdirmamali.');
    assert.equal(needsProbe.ab.changed, true,
        'Faz 24 acik-kapali A/B kosusu olculebilir durum farki uretmeli.');

    const opinionProbe = probePublicOpinion();
    assert.equal(opinionProbe.main.validation.ok, true,
        'Faz 25 kamuoyu ve sikayet hafizasi defteri gecerli kalmali.');
    assert.equal(opinionProbe.main.saveOk, true,
        'Faz 25 kaydi dogrulama hatasini yutup onceki kaydi birakmamali.');
    assert.equal(opinionProbe.main.saveExact, true,
        'Yazilan ve canli kamuoyu defteri birebir olmali.');
    assert.equal(opinionProbe.main.compactStorage, 'COMPACT_RECORD_ARRAY_V1',
        'Faz 25 kaydi uzun alan adlarini her sikayet kaydinda tekrar etmemeli.');
    assert.ok(opinionProbe.main.compactCharacters > 0,
        'Kompakt Faz 25 kaydinin boyutu olculebilir olmali.');
    assert.ok(opinionProbe.main.compactCharacters < 1500000,
        'Hedefli Faz 25 kaydi 1,5 milyon karakterlik mikro butceyi asmamali.');
    assert.equal(opinionProbe.main.worldValidation.ok, true,
        'Kamuoyu ozetleri V2 dunya sozlesmesini bozmamali.');
    assert.equal(opinionProbe.main.knowledgeValidation.ok, true,
        'Kamuoyu ozetleri oyuncu bilgi sinirini bozmamali.');
    assert.equal(opinionProbe.main.summary.cohortCount, 152 * 12,
        'Faz 25 her kanonik kohortu ayri hafiza tasiyicisi olarak izlemeli.');
    assert.ok(opinionProbe.main.summary.rememberedRecordCount > 0,
        'Gercek ihtiyac baskilari aciklanabilir sikayet kaydi uretmeli.');
    assert.equal(opinionProbe.main.sourceReadOnly, true,
        'Kamuoyu tiki Faz 24 ihtiyac defterini degistirmemeli.');
    assert.equal(opinionProbe.main.legacyWelfareUntouched, true,
        'Faz 25 eski welfare alanina yeni ceza yazmamali.');
    assert.equal(opinionProbe.main.factionsUntouched, true,
        'Faz 25, Faz 26 gelmeden fraksiyon/protesto sonucu yazmamali.');
    assert.ok(opinionProbe.main.shock.childFood,
        'Fiziksel gida soku cocuk kohortunda gida sikayeti uretmeli.');
    assert.ok(opinionProbe.main.shock.adultFood,
        'Fiziksel gida soku karsilastirma kohortunda gida sikayeti uretmeli.');
    assert.ok(opinionProbe.main.shock.childFood.rememberedSeverityBps
        > opinionProbe.main.shock.baselineFoodSeverityBps,
    'Tekrarlanan fiziksel gida baskisi mevcut hafizada birikmeli.');
    assert.ok(opinionProbe.main.shock.childFood.rememberedSeverityBps
        > opinionProbe.main.shock.adultFood.rememberedSeverityBps,
    'Ayni gida soku Faz 24 salience agirligi yuksek cocuk kohortunda daha sert birikmeli.');
    assert.equal(opinionProbe.main.shock.childFood.blamedActorId,
        opinionProbe.main.shock.expectedActorId,
    'Gida sikayeti hayali aktore degil gercek ulke tarim sirketine baglanmali.');
    assert.ok(opinionProbe.main.trajectory.afterPartialRecovery
        < opinionProbe.main.trajectory.firstPeak,
    'Iyilesme sikayet hafizasini azaltmali.');
    assert.ok(opinionProbe.main.trajectory.afterPartialRecovery > 0,
        'Kisa iyilesme gecmisi bir anda silmemeli.');
    assert.equal(opinionProbe.main.trajectory.recoveryState, 'RECOVERING',
        'Baski kalkinca kayit aninda yok olmak yerine iyilesme durumuna gecmeli.');
    assert.ok(opinionProbe.main.trajectory.secondPeak > opinionProbe.main.trajectory.firstPeak,
        'Ayni kotu olay kismi iyilesmeden sonra tekrarlandiginda tepki ilkinden buyuk olmali.');
    assert.equal(opinionProbe.main.trajectory.repeatedEpisodeCount, 2,
        'Ayrik tekrar ikinci olay bolumu olarak sayilmali.');
    assert.equal(opinionProbe.main.trajectory.fullyForgotten, true,
        'Yeterince uzun iyilesme sonunda sifir hafiza kaydi budanmali.');
    assert.ok(opinionProbe.main.trajectory.forgettingTicks > 4,
        'Unutma tek tikte gerceklesmemeli.');
    assert.equal(opinionProbe.main.knowledge.own.status, 'VERIFIED',
        'Kendi bolgesinin kamuoyu idari arastirma verisi olarak gorunmeli.');
    assert.equal(opinionProbe.main.knowledge.foreign.status, 'UNKNOWN',
        'Yabanci bolgenin sikayet hafizasi istihbaratsiz sizmamali.');
    assert.equal(opinionProbe.main.ui.hasComplaintMemory, true,
        'Nufus ekrani biriken sikayetleri gostermeli.');
    assert.equal(opinionProbe.main.ui.hasPerceivedResponsibility, true,
        'UI sikayetin sorumlu gorulen aktorunu acikca gostermeli.');
    assert.equal(opinionProbe.main.migration.ok, true,
        'Faz 25 kaydi V3-V2 golge gocunu tamamlamali.');
    assert.equal(opinionProbe.main.migration.validation.ok, true,
        'Kamuoyu tasiyan golge dunya gecerli olmali.');
    assert.equal(opinionProbe.main.migration.regionOpinionPreserved, true,
        'Goc bolge kamuoyu ozetini sessizce dusurmemeli.');
    assert.equal(opinionProbe.main.migration.cohortOpinionPreserved, true,
        'Goc kohort sikayet hafizasini sessizce dusurmemeli.');
    assert.equal(opinionProbe.main.migration.unmappedOpinion, false,
        'publicOpinion bilinen kayit alani olarak islenmeli.');
    assert.equal(opinionProbe.restored.loaded, true,
        'Kamuoyu defteri tasiyan kayit acilabilmeli.');
    assert.equal(opinionProbe.restored.validation.ok, true,
        'Yuklenen kamuoyu defteri gecerli kalmali.');
    assert.equal(opinionProbe.restored.exact, true,
        'Sikayet siddeti, olay sayisi ve unutma durumu kayitta birebir korunmali.');
    assert.equal(opinionProbe.legacy.loaded, true,
        'Faz 25 oncesi kayit guvenle acilabilmeli.');
    assert.equal(opinionProbe.legacy.validation.ok, true,
        'Eski kayit icin gecerli bos kamuoyu hafizasi kurulabilmeli.');
    assert.equal(opinionProbe.legacy.diagnostics.backfilled, true,
        'Eski kayitta gecmis uydurulmadigi acik teshis olmali.');
    assert.equal(opinionProbe.legacy.recordCount, 0,
        'Eski kaydin bulunmayan sikayet gecmisi anlik durumdan uydurulmamali.');
    assert.equal(opinionProbe.corrupt.loaded, true,
        'Bozuk kamuoyu defteri dunya kaybi olmadan acilabilmeli.');
    assert.equal(opinionProbe.corrupt.validation.ok, true,
        'Bozuk kamuoyu defteri guvenli bos hafizaya alinmali.');
    assert.equal(opinionProbe.corrupt.diagnostics.restoredFromInvalidLedger, true,
        'Bozuk kamuoyu kurtarmasi sessiz olmamali.');
    assert.equal(opinionProbe.disabled.summary.disabled, true,
        'Faz 25 ozellik bayragiyla kapanabilmeli.');
    assert.equal(opinionProbe.disabled.ledger, null,
        'Kapali Faz 25 sahte sikayet defteri uretmemeli.');
    assert.equal(opinionProbe.disabled.worldRegionOpinionCount, 0,
        'Kapali Faz 25 bolge projeksiyonuna kamuoyu sizdirmamali.');
    assert.equal(opinionProbe.disabled.worldCohortOpinionCount, 0,
        'Kapali Faz 25 kohort projeksiyonuna kamuoyu sizdirmamali.');
    assert.equal(opinionProbe.ab.changed, true,
        'Faz 25 acik-kapali A/B kosusunda olculebilir yeni durum uretmeli.');
    assert.equal(opinionProbe.ab.physicalEqual, true,
        'Kamuoyu hafizasi fiziksel ekonomi veya eski oynanis sonucunu degistirmemeli.');

    const collectiveProbe = probeCollectiveAction();
    assert.equal(collectiveProbe.pure.quietNoAction, true,
        'Sakin toplum salt zaman gecti diye protesto uretmemeli.');
    assert.equal(collectiveProbe.pure.orderedEscalation, true,
        'Agir kriz protestodan greve asamali ve histerezisli gecmeli.');
    assert.equal(collectiveProbe.pure.noUnprovokedUprising, true,
        'Salt kronik sikayet, baski hafizasi olmadan otomatik ayaklanmaya donusmemeli.');
    assert.equal(collectiveProbe.pure.afterSameUnresolvedCrisis.suppressionBackfire, true,
        'Bastirma kisa vadede dagitsa da ayni cozulmemis krizde tavizden daha cok radikallesme biriktirmeli.');
    assert.equal(collectiveProbe.pure.repeatedSuppression.suppressionDrivenUprising, true,
        'Tekrarlanan baski ve cozulmeyen kriz kanitli olarak ayaklanmaya donebilmeli.');
    assert.ok(collectiveProbe.pure.repeatedSuppression.uprisingTick
        > collectiveProbe.pure.firstTick.STRIKE,
    'Baski kaynakli ayaklanma protesto ve grevden sonra gelmeli.');
    assert.equal(collectiveProbe.main.validation.ok, true,
        'Faz 26 kolektif eylem defteri kendi sozlesmesini gecmeli.');
    assert.equal(collectiveProbe.main.saveOk, true,
        'Faz 26 kaydi dogrulama hatasini yutmamali.');
    assert.equal(collectiveProbe.main.saveExact, true,
        'Canli ve kaydedilen kolektif eylem defteri birebir olmali.');
    assert.equal(collectiveProbe.main.worldValidation.ok, true,
        'Kolektif eylem ozetleri V2 dunya sozlesmesini bozmamali.');
    assert.equal(collectiveProbe.main.knowledgeValidation.ok, true,
        'Kolektif eylem oyuncu bilgi sinirini bozmamali.');
    assert.ok(collectiveProbe.main.summary.activeActionCount <= 8,
        'Ulusal dikkat butcesi sekiz devlette birden fazla etkin hareketi ayni anda tasimamali.');
    assert.ok(collectiveProbe.main.summary.activeActionCount > 0,
        'Gercek 180 saniyelik dunya kanitli toplumsal eylem uretebilmeli.');
    assert.equal(collectiveProbe.main.ownKnowledge.status, 'VERIFIED',
        'Oyuncu kendi ulkesindeki eylemin idari ayrintisini dogrulanmis gormeli.');
    assert.equal(collectiveProbe.main.foreignKnowledge.status, 'VERIFIED',
        'Kamusal yabanci protesto/grev varligi gozlenebilir olmali.');
    assert.equal(collectiveProbe.main.foreignSecretsHidden, true,
        'Yabanci seferberlik, orgutlenme ve radikallesme puanlari kamusal olaydan sizmamali.');
    assert.equal(collectiveProbe.main.ui.ownHasCollectiveActions, true,
        'Kendi sehir nufus ekrani toplumsal eylem mercegini tasimali.');
    assert.equal(collectiveProbe.main.ui.foreignHasCollectiveActions, true,
        'Yabanci sehir ekrani kamusal eylem mercegini tasimali.');
    assert.equal(collectiveProbe.main.ui.foreignSecretLeak, false,
        'Yabanci sehir HTML gizli radikallesme/seferberlik oranini sizdirmamali.');
    assert.ok(collectiveProbe.main.ui.responseNoticeCount > 0,
        'Oyuncu eylem dogdugunda ayri bir karar penceresi gormeli.');
    assert.equal(collectiveProbe.main.ui.responseOptionsValid, true,
        'Karar penceresi taviz, muzakere, bastirma ve gormezden gelme yollarini sunmali.');
    assert.equal(collectiveProbe.main.ui.staleResponseNoticeCount, 0,
        'Suresi dolan karar penceresi calismayan dugmelerle ekranda kalmamali.');
    assert.equal(collectiveProbe.main.migration.ok, true,
        'Faz 26 kaydi V3-V2 golge gocunu tamamlamali.');
    assert.equal(collectiveProbe.main.migration.validation.ok, true,
        'Kolektif eylem tasiyan golge dunya gecerli olmali.');
    assert.equal(collectiveProbe.main.migration.countryPreserved, true,
        'Goc ulke kolektif eylem ozetini korumali.');
    assert.equal(collectiveProbe.main.migration.regionPreserved, true,
        'Goc bolge kolektif eylem ozetini korumali.');
    assert.equal(collectiveProbe.main.migration.unmapped, false,
        'collectiveAction bilinen kayit alani olarak islenmeli.');
    assert.equal(collectiveProbe.restored.loaded, true,
        'Kolektif eylem defteri tasiyan kayit acilabilmeli.');
    assert.equal(collectiveProbe.restored.validation.ok, true,
        'Yuklenen kolektif eylem defteri gecerli kalmali.');
    assert.equal(collectiveProbe.restored.exact, true,
        'Hareket asamasi ve baski hafizasi kayitta birebir korunmali.');
    assert.equal(collectiveProbe.legacy.validation.ok, true,
        'Faz 26 oncesi kayit icin gecerli bos eylem defteri kurulabilmeli.');
    assert.equal(collectiveProbe.legacy.diagnostics.backfilled, true,
        'Eski kayitta eylem gecmisi uydurulmadigi acik teshis olmali.');
    assert.equal(collectiveProbe.corrupt.validation.ok, true,
        'Bozuk eylem defteri dunya kaybi olmadan guvenli bos deftere alinmali.');
    assert.equal(collectiveProbe.corrupt.diagnostics.restoredFromInvalidLedger, true,
        'Bozuk eylem defteri kurtarmasi sessiz olmamali.');
    assert.equal(collectiveProbe.disabled.ledger, null,
        'Kapali Faz 26 sahte eylem defteri uretmemeli.');
    assert.equal(collectiveProbe.prerequisiteDisabled.ledger, null,
        'Faz 25 kapaliyken Faz 26 istense bile etkinlesmemeli.');
    assert.equal(collectiveProbe.ab.changed, true,
        'Faz 26 acik-kapali A/B kosusunda fiziksel grev etkisi olculebilir durum farki uretmeli.');

    const humanMigrationProbe = probeHumanMigration();
    assert.equal(humanMigrationProbe.atomic.result.ok, true,
        'Faz 27 kanonik nüfus mutasyon kapısı kohort aktarımını kabul etmeli.');
    assert.equal(humanMigrationProbe.atomic.exactWorldConservation, true,
        'İki bölge arasındaki göç dünya toplam nüfusunu tam kişi düzeyinde korumalı.');
    assert.equal(humanMigrationProbe.atomic.originDelta, -17,
        'Atomik göç probunda kaynak bölgeden tam 17 kişi çıkmalı.');
    assert.equal(humanMigrationProbe.atomic.destinationDelta, 17,
        'Atomik göç probunda hedef bölgeye tam 17 kişi girmeli.');
    assert.equal(humanMigrationProbe.atomic.nodePopulationSynchronized, true,
        'Kohort toplamı ile canlı node.pop aynı atomik işlemde kapanmalı.');
    assert.equal(humanMigrationProbe.atomic.validation.ok, true,
        'Atomik transfer sonrası nüfus defteri geçerli kalmalı.');
    assert.equal(humanMigrationProbe.crisis.refugeeCreated, true,
        'Ağır güvenlik krizi rastgele zar olmadan mülteci akışı üretmeli.');
    assert.equal(humanMigrationProbe.crisis.capacityBlocked, true,
        'Dolu hedefe mülteci akışı yerleşememeli ve kapasite nedeniyle beklemeli.');
    assert.equal(humanMigrationProbe.crisis.completedAfterCapacity, true,
        'Kabul kapasitesi açıldığında bekleyen mülteci akışı tamamlanabilmeli.');
    assert.equal(humanMigrationProbe.crisis.completedPopulationDelta, 0,
        'Mülteci varışı nüfus yaratmamalı veya silmemeli.');
    assert.equal(humanMigrationProbe.crisis.exactWorldConservation, true,
        'Kapasite beklemesi ve varış boyunca dünya nüfusu korunmalı.');
    assert.equal(humanMigrationProbe.crisis.populationValidation.ok, true,
        'Mülteci varışı sonrası nüfus defteri geçerli kalmalı.');
    assert.equal(humanMigrationProbe.crisis.migrationValidation.ok, true,
        'Mülteci varışı sonrası göç defteri geçerli kalmalı.');
    assert.equal(humanMigrationProbe.noRoute.createdFromIsolatedOrigin, false,
        'Bütün kara/deniz yolları kapalı bölgeden nüfus ışınlanmamalı.');
    assert.equal(humanMigrationProbe.noRoute.validation.ok, true,
        'Rota bulunamayan senaryo geçerli ve boş göç kararı üretmeli.');
    assert.equal(humanMigrationProbe.main.validation.ok, true,
        'Faz 27 canlı göç defteri kendi sözleşmesini geçmeli.');
    assert.equal(humanMigrationProbe.main.populationValidation.ok, true,
        'Canlı göçler kanonik nüfus defterini bozmamalı.');
    assert.equal(humanMigrationProbe.main.needsValidation.ok, true,
        'Göç sonrası ihtiyaç sonuçları güncel kohort sayılarıyla uyuşmalı.');
    assert.equal(humanMigrationProbe.main.completedConservation, true,
        'Tamamlanan her canlı akış sıfır nüfus deltası kaydetmeli.');
    assert.equal(humanMigrationProbe.main.saveOk, true,
        'Faz 27 kaydı downstream kohort hatasını yutmamalı.');
    assert.equal(humanMigrationProbe.main.saveExact, true,
        'Canlı ve kaydedilen göç defteri birebir olmalı.');
    assert.equal(humanMigrationProbe.main.worldValidation.ok, true,
        'Göç özetleri V2 dünya sözleşmesini bozmamalı.');
    assert.equal(humanMigrationProbe.main.knowledgeValidation.ok, true,
        'Göç projeksiyonu oyuncu bilgi sözleşmesini bozmamalı.');
    assert.equal(humanMigrationProbe.main.foreignSecretsHidden, true,
        'Yabancı göç görünümünde kohort, rota, kapasite ve karar kanıtı sızmamalı.');
    assert.equal(humanMigrationProbe.main.ui.ownHasMigration, true,
        'Kendi şehir nüfus ekranı göç bölümünü göstermeli.');
    assert.equal(humanMigrationProbe.main.ui.foreignHasMigration, true,
        'Yabancı şehir nüfus ekranı kamuya açık göç özetini göstermeli.');
    assert.equal(humanMigrationProbe.main.ui.foreignSecretLeak, false,
        'Yabancı şehir göç ekranı gizli kapasite veya koridor sayısını göstermemeli.');
    assert.equal(humanMigrationProbe.main.migration.ok, true,
        'V3→V2 göç adaptörü Faz 27 özetlerini taşımalı.');
    assert.equal(humanMigrationProbe.main.migration.validation.ok, true,
        'Faz 27 özetli V2 dünya geçerli olmalı.');
    assert.equal(humanMigrationProbe.main.migration.countryPreserved, true,
        'V3→V2 göçü ülke göç özetini korumalı.');
    assert.equal(humanMigrationProbe.main.migration.regionPreserved, true,
        'V3→V2 göçü bölge göç özetini korumalı.');
    assert.equal(humanMigrationProbe.main.migration.unmapped, false,
        'humanMigration bilinen kayıt alanı olarak işlenmeli.');
    assert.equal(humanMigrationProbe.restored.loaded, true,
        'Faz 27 kaydı yeni süreçte yüklenebilmeli.');
    assert.equal(humanMigrationProbe.restored.validation.ok, true,
        'Yüklenen Faz 27 defteri geçerli olmalı.');
    assert.equal(humanMigrationProbe.restored.exact, true,
        'Göç defteri kayıt/yüklemede birebir korunmalı.');
    assert.equal(humanMigrationProbe.legacy.validation.ok, true,
        'Faz 27 öncesi kayıt güvenli boş göç geçmişiyle açılmalı.');
    assert.equal(humanMigrationProbe.legacy.diagnostics.backfilled, true,
        'Eski kayıt backfill durumu açıklamalı olmalı.');
    assert.equal(humanMigrationProbe.corrupt.validation.ok, true,
        'Bozuk göç defteri kanonik nüfusu silmeden güvenli sıfırlanmalı.');
    assert.equal(humanMigrationProbe.corrupt.diagnostics.restoredFromInvalidLedger, true,
        'Bozuk göç kurtarması teşhiste görünmeli.');
    assert.equal(humanMigrationProbe.disabled.ledger, null,
        'Faz 27 özellik bayrağı kapalıyken göç defteri ve davranışı oluşmamalı.');
    assert.equal(humanMigrationProbe.prerequisiteDisabled.ledger, null,
        'Faz 26 öncülü kapalıysa Faz 27 etkinleşmemeli.');
    assert.equal(humanMigrationProbe.ab.changed, true,
        'Faz 27 açık/kapalı A/B dünyası gerçek nüfus dağılımı nedeniyle farklı olmalı.');
    assert.equal(humanMigrationProbe.ab.onValidation.ok, true,
        'Faz 27 açık A/B yolu geçerli göç defteri üretmeli.');
    assert.equal(humanMigrationProbe.ab.offValidation.ok, true,
        'Faz 27 kapalı A/B yolu geçersiz defter bırakmamalı.');

    const powerCenterProbe = probePowerCenters();
    assert.equal(powerCenterProbe.main.validation.ok, true,
        'Faz 28 güç merkezi defteri kendi sözleşmesini geçmeli.');
    assert.equal(powerCenterProbe.main.summary.centerCount, 56,
        'Sekiz devletin her biri yedi güç merkezi taşımalı.');
    assert.equal(powerCenterProbe.main.everyCenterComplete, true,
        'Her güç merkezi lider, destek, kaynak, amaç, kapasite ve eylem sınırı taşımalı.');
    assert.equal(powerCenterProbe.main.businessCashExact, true,
        'İş dünyası kaynağı şirket defterindeki gerçek nakitle birebir uyuşmalı.');
    assert.equal(powerCenterProbe.main.laborOrganization.model, 'POWER_CENTER_CAPACITY_PHASE_28',
        'Emek hareketinin örgütlenme kapasitesi gerçek Faz 28 merkezinden gelmeli.');
    assert.ok(powerCenterProbe.main.laborOrganization.centerIds.some(id => id.includes('labor_confederation')),
        'Emek örgütlenmesi kanonik konfederasyon kimliğine bağlanmalı.');
    assert.equal(powerCenterProbe.main.worldPowerCenterCount, 56,
        'WorldV2 bütün kanonik güç merkezlerini taşımalı.');
    assert.equal(powerCenterProbe.main.ownKnowledge.status, 'VERIFIED',
        'Kendi güç merkezleri doğrulanmış kurumsal kayıt olmalı.');
    assert.equal(powerCenterProbe.main.foreignKnowledge.status, 'VERIFIED',
        'Yabancı güç merkezlerinin yalnız kamusal varlığı görünür olmalı.');
    assert.equal(powerCenterProbe.main.foreignSecretsHidden, true,
        'Yabancı güç merkezinin kaynak, kapasite, hizalanma ve lider kimliği sızmamalı.');
    assert.equal(powerCenterProbe.main.ownDossierValidation.ok, true,
        'Kendi şehir kurum görünümü bilgi sözleşmesini geçmeli.');
    assert.equal(powerCenterProbe.main.foreignDossierValidation.ok, true,
        'Yabancı şehir kurum görünümü gizlilik sözleşmesini geçmeli.');
    assert.equal(powerCenterProbe.main.ui.ownHasCenters, true,
        'Kendi şehir dosyası güç merkezlerini göstermeli.');
    assert.equal(powerCenterProbe.main.ui.ownHasCapacity, true,
        'Kendi güç merkezi ekranı gerçek örgüt ve kapasite ölçülerini göstermeli.');
    assert.equal(powerCenterProbe.main.ui.foreignHasPublicCenters, true,
        'Yabancı şehir ekranı kamusal kurumsal varlığı gösterebilmeli.');
    assert.equal(powerCenterProbe.main.ui.foreignSecretLeak, false,
        'Yabancı kurum ekranı kesin etki, örgüt ve zorlama kapasitesi sızdırmamalı.');
    assert.equal(powerCenterProbe.main.savedExact, true,
        'Güç merkezi defteri kayıt anında canlı durumu değiştirmeden birebir yazılmalı.');
    assert.equal(powerCenterProbe.main.migration.ok, true,
        'V3→V2 adaptörü Faz 28 güç merkezlerini taşımalı.');
    assert.equal(powerCenterProbe.main.migration.validation.ok, true,
        'Faz 28 güç merkezli V2 dünya geçerli olmalı.');
    assert.equal(powerCenterProbe.main.migration.topLevelCount, 56,
        'V3→V2 üst düzey güç merkezi sayısını korumalı.');
    assert.equal(powerCenterProbe.main.migration.countryPreserved, true,
        'V3→V2 ülke güç merkezi özetini korumalı.');
    assert.equal(powerCenterProbe.main.migration.regionPreserved, true,
        'V3→V2 bölgesel güç merkezi varlığını korumalı.');
    assert.equal(powerCenterProbe.main.migration.unmapped, false,
        'powerCenters bilinen kayıt alanı olarak işlenmeli.');
    assert.equal(powerCenterProbe.restored.loaded, true,
        'Faz 28 kaydı yeni süreçte yüklenebilmeli.');
    assert.equal(powerCenterProbe.restored.validation.ok, true,
        'Yüklenen Faz 28 defteri geçerli olmalı.');
    assert.equal(powerCenterProbe.restored.exact, true,
        'Güç merkezi defteri kayıt/yüklemede birebir korunmalı.');
    assert.equal(powerCenterProbe.legacy.validation.ok, true,
        'Faz 28 öncesi kayıt mevcut kanonik kaynaklardan güvenli merkez fotoğrafı kurmalı.');
    assert.equal(powerCenterProbe.legacy.diagnostics.backfilled, true,
        'Eski kayıt güç merkezi backfill durumunu açıklamalı.');
    assert.equal(powerCenterProbe.corrupt.validation.ok, true,
        'Bozuk güç merkezi defteri dünyayı silmeden güvenli yeniden kurulmalı.');
    assert.equal(powerCenterProbe.corrupt.diagnostics.restoredFromInvalidLedger, true,
        'Bozuk Faz 28 kurtarması teşhiste görünmeli.');
    assert.equal(powerCenterProbe.disabled.ledger, null,
        'Faz 28 özellik bayrağı kapalıyken güç merkezi defteri oluşmamalı.');
    assert.equal(powerCenterProbe.disabled.fallbackOrganization, null,
        'Faz 28 kapalıyken güç merkezi API’si sahte kapasite üretmemeli.');
    assert.equal(powerCenterProbe.prerequisiteDisabled.ledger, null,
        'Şirket öncülü kapalıysa Faz 28 etkinleşmemeli.');
    assert.equal(powerCenterProbe.ab.changed, true,
        'Faz 28 açık/kapalı A/B dünyası gerçek örgütlenme kaynağı nedeniyle farklı olmalı.');
    assert.equal(powerCenterProbe.ab.onValidation.ok, true,
        'Faz 28 açık A/B yolu geçerli güç merkezi defteri üretmeli.');
    assert.equal(powerCenterProbe.ab.offValidation.ok, true,
        'Faz 28 kapalı A/B yolu geçersiz defter bırakmamalı.');
    assert.equal(powerCenterProbe.ab.onCollectiveValidation.ok, true,
        'Faz 28 açık kolektif eylem yolu güç merkezi referanslarını doğrulamalı.');
    assert.equal(powerCenterProbe.ab.offCollectiveValidation.ok, true,
        'Faz 28 kapalı kolektif eylem yolu açık legacy vekille geçerli kalmalı.');

    const cityDossierProbe = probeCityDossier();
    assert.equal(cityDossierProbe.main.ownValidation.ok, true, 'Kendi şehir dosyası sözleşmesini geçmeli.');
    assert.equal(cityDossierProbe.main.foreignValidation.ok, true, 'Yabancı şehir dosyası sözleşmesini geçmeli.');
    assert.equal(cityDossierProbe.main.uiNeutral, true, 'Şehir dosyasını açmak dünya durumunu değiştirmemeli.');
    assert.equal(
        cityDossierProbe.main.ownView.facts.population.status,
        'VERIFIED',
        'Kendi şehrinin nüfusu doğrulanmış yönetim verisi olmalı.'
    );
    assert.equal(
        cityDossierProbe.main.foreignView.facts.population.status,
        'UNKNOWN',
        'Yabancı nüfus bilgisi doğrulanmadan kesin gösterilmemeli.'
    );
    assert.equal(cityDossierProbe.main.foreignView.facts.population.value, null, 'Yabancı nüfus UNKNOWN/null kalmalı.');
    assert.match(cityDossierProbe.main.ownPopulation.text, /KULLANILABİLİR ÇALIŞAN/,
        'Şehir nüfus sekmesi kohortlardan türeyen gerçek işgücü tavanını göstermeli.');
    assert.match(cityDossierProbe.main.ownPopulation.text, /KİMLİK YÖNELİMİ/,
        'Şehir nüfus sekmesi kimlik dağılımını tablo kalabalığı olmadan özetlemeli.');
    assert.match(cityDossierProbe.main.foreignPopulation.text, /NÜFUS SAYIMI DOĞRULANMADI/,
        'Yabancı ayrıntılı nüfus yapısı kesin değer uydurmamalı.');
    assert.equal(cityDossierProbe.main.foreignView.facts.deposits.value, null, 'Yabancı kaynak yatakları UNKNOWN/null kalmalı.');
    assert.equal(cityDossierProbe.main.ownView.facts.market.status, 'VERIFIED',
        'Kendi şehrinin piyasa defteri doğrulanmış olmalı.');
    assert.equal(cityDossierProbe.main.foreignView.facts.market.value, null,
        'Yabancı bölgesel fiyat ayrıntısı UNKNOWN/null kalmalı.');
    assert.ok(cityDossierProbe.main.ownMarket.html.includes('BÖLGESEL FİYAT ENDEKSLERİ'),
        'Ekonomi paneli planın gerektirdiği ayrı piyasa görünümünü üretmeli.');
    assert.ok(cityDossierProbe.main.foreignMarket.html.includes('PİYASA VERİSİ DOĞRULANMADI'),
        'Yabancı piyasa sekmesi kesin değer uydurmak yerine bilgi açığını söylemeli.');
    assert.equal(cityDossierProbe.main.foreignView.facts.logistics.value, null, 'Yabancı lojistik UNKNOWN/null kalmalı.');
    assert.equal(cityDossierProbe.main.foreignView.corridors.length, 0, 'Yabancı koridor ayrıntısı şehir dosyasına sızmamalı.');
    assert.equal(cityDossierProbe.main.foreignView.characters.length, 0, 'Bilinmeyen yabancı karakter konumu sızmamalı.');
    assert.equal(cityDossierProbe.main.foreignSentinelLeaked, false, 'Kasıtlı gizli sentinel değerler HTML/view-model içinde görünmemeli.');
    assert.match(cityDossierProbe.main.foreignGeneral.text, /BİLGİ YOK/, 'Yabancı kesin olmayan değerler sahte sıfır yerine bilgi-yok durumu göstermeli.');
    assert.match(cityDossierProbe.main.foreignLogistics.text, /ALTYAPI İSTİHBARATI YOK/, 'Yabancı lojistik açık eksik-bilgi durumu göstermeli.');
    assert.ok(cityDossierProbe.main.ownView.corridors.length > 0, 'Kendi şehir dosyası doğrulanmış altyapı koridorlarını göstermeli.');
    assert.match(cityDossierProbe.main.ownLogistics.text, /Ticaret bu kapasiteyi tüketir/i, 'Lojistik ekranı canlı kapasite tüketimini açıklamalı.');
    assert.doesNotMatch(cityDossierProbe.main.ownGeneral.text, /GÜÇ MERKEZLERİ.*SİSTEM HENÜZ YOK/s,
        'Faz 28 tamamlandıktan sonra güç merkezleri eksik sistem diye gösterilmemeli.');
    assert.doesNotMatch(cityDossierProbe.main.ownGeneral.text, /ZENGİNLİK|BÖLGESEL STOKLAR|BÜTÇE|PİYASA/,
        'Şehir paneli ekonomik veri kalabalığını tekrar etmemeli.');
    assert.match(cityDossierProbe.main.ownEconomy.text, /BÖLGESEL EKONOMİ ÖZETİ/,
        'Şehirden kaldırılan ekonomik gerçekler ekonomi panelinde korunmalı.');
    assert.match(cityDossierProbe.main.ownFactions.text, /GÜÇ MERKEZLERİ|SİLAHLI KUVVETLER/,
        'Eski fraksiyon sekmesi destek puanı yerine gerçek güç merkezi kaydını göstermeli.');
    assert.match(cityDossierProbe.main.ownGeneral.html, /role="tablist"/, 'Şehir bölümleri erişilebilir tablist semantiği taşımalı.');
    assert.match(cityDossierProbe.main.ownGeneral.html, /aria-selected="true"/, 'Etkin şehir sekmesi erişilebilir seçim durumu taşımalı.');
    assert.equal(cityDossierProbe.main.routeOpened, true, 'Koridordan bağlı şehir dosyasına gidilebilmeli.');
    assert.equal(
        cityDossierProbe.main.routeState.selectedNodeId,
        Number(cityDossierProbe.main.ownView.corridors[0].destinationRegionId.split(':')[1]),
        'Rota düğmesi hedef bölgeyi seçmeli.'
    );
    assert.ok(cityDossierProbe.main.ownView.characters.length > 0, 'Komutanın bulunduğu şehir doğrulanmış karakter girişini göstermeli.');
    assert.equal(cityDossierProbe.main.characterOpened, true, 'Şehir karakterinden sohbet merkezine gidilebilmeli.');
    assert.equal(cityDossierProbe.main.characterState.talkOpen, true, 'Karakter girişi sohbet panelini açmalı.');
    assert.equal(
        cityDossierProbe.main.characterState.talkFocusCharacterId,
        cityDossierProbe.main.ownView.characters[0].id,
        'Sohbet merkezi şehirden gelen karakter bağlamını korumalı.'
    );
    assert.match(cityDossierProbe.main.characterState.talkText, /henüz sistemde yok/, 'Eksik hedefli sohbet uydurulmadan açıkça belirtilmeli.');
    assert.doesNotMatch(cityDossierProbe.main.characterState.talkText, /DÜNYANIN HÂLİ/,
        'Dünya özeti sohbet panelini ilgisiz veriyle doldurmamalı.');
    assert.match(cityDossierProbe.main.topBarWorldState.tooltip, /Savaş.*Refah/s,
        'Dünya hâli üst çubuktaki çağ etiketinin ayrıntı balonuna taşınmalı.');
    assert.equal(cityDossierProbe.main.topBarWorldState.focusable, '0',
        'Çağ ayrıntısı fareye ek olarak klavyeyle de erişilebilir olmalı.');
    assert.equal(cityDossierProbe.main.topBarWorldState.stableWhileFocused, true,
        'Çağ tooltip düğümü odak/hover sırasında yeniden yaratılıp titreşmemeli.');
    assert.equal(cityDossierProbe.main.factionNotice.visible, true,
        'Fraksiyon olayı oyuncu görmeden geçmek yerine ayrı pencerede açılmalı.');
    assert.equal(cityDossierProbe.main.factionNotice.role, 'dialog',
        'Fraksiyon olay penceresi erişilebilir diyalog semantiği taşımalı.');
    assert.equal(cityDossierProbe.main.factionNotice.badgeHidden, false,
        'Okunmamış toplumsal olay ekonomi aracında rozet bırakmalı.');
    assert.ok(cityDossierProbe.main.eventNavigation.historyCount > 0, 'Bölge sahiplik değişimi şehir tarihine düşmeli.');
    assert.equal(cityDossierProbe.main.eventNavigation.tooltipVisibleInMarkup, true,
        'Şehir tarihinin neden zinciri ayrı panel yerine satır üstü ayrıntı olarak korunmalı.');
    assert.equal(cityDossierProbe.main.eventNavigation.changePanelAbsent, true,
        'Kaldırılan Değişim paneli test DOM’una gizlice geri eklenmemeli.');
    assert.equal(cityDossierProbe.disabled.disabled, true, 'ui.cityDossier kapalıyken yeni görünüm güvenle kapanmalı.');
    assert.equal(cityDossierProbe.ab.equal, true, 'Şehir dosyası açık/kapalı normal dünya karmasını değiştirmemeli.');

    const mapRasterProbe = probeCanonicalMapRaster();
    assert.equal(mapRasterProbe.main.validation.ok, true, 'Kanonik harita rasterı kendi sözleşmesini geçmeli.');
    assert.equal(mapRasterProbe.main.uiNeutral, true, 'Raster üretmek kalıcı dünya durumunu değiştirmemeli.');
    assert.equal(mapRasterProbe.main.raster.width, 820, 'Kanonik raster planlanan 820 piksel taban genişliği kullanmalı.');
    assert.equal(mapRasterProbe.main.raster.regionCount, 152, 'Kanonik raster 152 bölgenin tamamını temsil etmeli.');
    assert.equal(
        mapRasterProbe.main.worldMapDiagnostics.sourceHash,
        mapRasterProbe.main.raster.sourceHash,
        'V2 dünya teşhisi kullanılan kanonik raster kaynak checksum’ını yayınlamalı.'
    );
    assert.ok(mapRasterProbe.main.raster.landCells > 0, 'Kanonik raster kara hücresi üretmeli.');
    assert.ok(mapRasterProbe.main.raster.seaCells > 0, 'Kanonik raster deniz hücresi üretmeli.');
    assert.ok(
        mapRasterProbe.main.raster.buildMs < 1000,
        `Kanonik raster kurulumu bir saniyeyi aşmamalı: ${mapRasterProbe.main.raster.buildMs} ms`
    );
    assert.equal(mapRasterProbe.main.repeatHashesEqual, true, 'Aynı GEO/düğüm geometrisi aynı raster checksumlarını üretmeli.');
    assert.equal(mapRasterProbe.main.sameInstance, true, 'Değişmeyen geometri kanonik raster cache’ini yeniden kurmamalı.');
    assert.equal(mapRasterProbe.main.overlay.gridMismatch, 0, 'Politik grid kanonik region raster örneğiyle birebir uyuşmalı.');
    assert.equal(mapRasterProbe.main.overlay.seaRegionLeaks, 0, 'Politik grid deniz hücresine bölge kimliği yazmamalı.');
    assert.equal(mapRasterProbe.main.overlay.landRegionMissing, 0, 'Politik grid kara hücresini bölgesiz bırakmamalı.');
    assert.equal(
        mapRasterProbe.main.overlay.source.adapterVersion,
        'canonical-map-raster-1',
        'Politik grid kaynak kimliğini kanonik raster olarak yayınlamalı.'
    );
    assert.equal(
        mapRasterProbe.main.renderCaches.terrain.source.sourceHash,
        mapRasterProbe.main.raster.sourceHash,
        'Gerçek terrain cache’i kanonik raster kaynak checksum’ını kullanmalı.'
    );
    assert.equal(
        mapRasterProbe.main.renderCaches.overlay.source.sourceHash,
        mapRasterProbe.main.raster.sourceHash,
        'Gerçek politik overlay cache’i kanonik raster kaynak checksum’ını kullanmalı.'
    );
    assert.equal(mapRasterProbe.main.renderCaches.terrain.width, 1350, 'Terrain cache yüksek çözünürlüğünü korumalı.');
    assert.equal(mapRasterProbe.main.renderCaches.overlay.width, 300, 'Faz 14.2 geçici overlay çözünürlüğünü açıkça korumalı.');
    assert.ok(
        mapRasterProbe.main.renderCaches.wallTimeMs < 2000,
        `Terrain+overlay cache kurulumu iki saniyeyi aşmamalı: ${mapRasterProbe.main.renderCaches.wallTimeMs} ms`
    );
    assert.ok(
        mapRasterProbe.main.terrain.differenceRatio < 0.005,
        `Terrain/300-overlay kıyı farkı belgelenen ince-geometri bütçesini aşmamalı: ${mapRasterProbe.main.terrain.differenceRatio}`
    );
    assert.ok(
        mapRasterProbe.main.diagnostics.overlay300.thinGeometryLostRatio < 0.02,
        '300 overlay downsample ince kara geometrisinin %2’den fazlasını kaybetmemeli.'
    );
    assert.equal(
        mapRasterProbe.main.hitTest.landPick,
        mapRasterProbe.main.hitTest.expectedLandRegionId,
        'Kara hit-test’i kanonik region kimliğini döndürmeli.'
    );
    assert.equal(mapRasterProbe.main.hitTest.seaPick, -1, 'Deniz hit-test’i hiçbir şehir/bölge seçmemeli.');
    assert.ok(
        mapRasterProbe.main.invalid.source.issues.some(issue => issue.code === 'SOURCE_HASH_MISMATCH'),
        'Eski GEO/düğüm kaynağına ait raster reddedilmeli.'
    );
    assert.ok(
        mapRasterProbe.main.invalid.landValue.issues.some(issue => issue.code === 'INVALID_LAND_VALUE'),
        '0/1 dışı kara değeri reddedilmeli.'
    );
    assert.ok(
        mapRasterProbe.main.invalid.seaRegion.issues.some(issue => issue.code === 'SEA_REGION_LEAK'),
        'Denize yazılmış bölge kimliği reddedilmeli.'
    );
    assert.ok(
        mapRasterProbe.main.invalid.landRegion.issues.some(issue => issue.code === 'LAND_REGION_MISSING'),
        'Bilinmeyen kimlikli kara hücresi reddedilmeli.'
    );
    assert.ok(
        mapRasterProbe.main.invalid.checksum.issues.some(issue => issue.code === 'LAND_HASH_MISMATCH'),
        'Bozuk kara checksum’ı reddedilmeli.'
    );
    assert.ok(
        mapRasterProbe.main.invalid.length.issues.some(issue => issue.code === 'LAND_MASK_LENGTH'),
        'Yanlış raster uzunluğu reddedilmeli.'
    );
    assert.equal(mapRasterProbe.disabled.diagnostics.disabled, true, 'world.canonicalMapRaster kapalıyken teşhis güvenli kapanmalı.');
    assert.equal(mapRasterProbe.disabled.raster, null, 'Bayrak kapalıyken kanonik raster üretilmemeli.');
    assert.equal(mapRasterProbe.ab.equal, true, 'Kanonik raster açık/kapalı normal dünya karmasını değiştirmemeli.');

    const prebuiltRasterProbe = probePrebuiltMapRaster();
    assert.equal(prebuiltRasterProbe.asset.uiNeutral, true, 'Build-time raster yüklemek kalıcı dünyayı değiştirmemeli.');
    assert.equal(prebuiltRasterProbe.asset.diagnostics.loadMode, 'asset', 'Normal açılış build-time raster varlığını kullanmalı.');
    assert.equal(prebuiltRasterProbe.generated.diagnostics.loadMode, 'runtime-disabled', 'Bayrak kapalıyken KD-tree runtime üreticisi çalışmalı.');
    assert.deepEqual(
        prebuiltRasterProbe.asset.hashes,
        prebuiltRasterProbe.generated.hashes,
        'Build-time varlık ve runtime fallback aynı kanonik checksum’ları üretmeli.'
    );
    assert.equal(prebuiltRasterProbe.asset.asset.width, 820, 'Build-time varlık kanonik genişliği taşımalı.');
    assert.equal(prebuiltRasterProbe.asset.asset.height, 645, 'Build-time varlık kanonik yüksekliği taşımalı.');
    assert.equal(prebuiltRasterProbe.asset.asset.payloadBytes, 43064, 'RLE payload boyutu beklenen deterministik değerde olmalı.');
    assert.equal(prebuiltRasterProbe.asset.asset.runCount, 10766, 'RLE kayıt sayısı deterministik olmalı.');
    assert.ok(
        prebuiltRasterProbe.asset.asset.payloadBytes < prebuiltRasterProbe.asset.asset.rawPixelCount * 0.1,
        'Sıkıştırılmış varlık piksel başına 0,1 bayttan küçük olmalı.'
    );
    assert.ok(
        prebuiltRasterProbe.asset.wallMs < 500,
        `Build-time raster yükleme/doğrulama yarım saniyeyi aşmamalı: ${prebuiltRasterProbe.asset.wallMs} ms`
    );
    assert.ok(
        prebuiltRasterProbe.asset.invalid.schema.issues.some(issue => issue.code === 'ASSET_SCHEMA_VERSION'),
        'Eski asset şema sürümü reddedilmeli.'
    );
    assert.ok(
        prebuiltRasterProbe.asset.invalid.source.issues.some(issue => issue.code === 'ASSET_SOURCE_HASH'),
        'Eski GEO/bölge kaynağına ait asset reddedilmeli.'
    );
    assert.ok(
        prebuiltRasterProbe.asset.invalid.encoding.issues.some(issue => issue.code === 'ASSET_ENCODING'),
        'Bilinmeyen asset encoding reddedilmeli.'
    );
    assert.ok(
        prebuiltRasterProbe.asset.invalid.payloadHash.issues.some(issue => issue.code === 'ASSET_PAYLOAD_HASH'),
        'Bozuk sıkıştırılmış payload checksum’ı reddedilmeli.'
    );
    assert.ok(
        prebuiltRasterProbe.asset.invalid.runCount.issues.some(issue => issue.code === 'ASSET_RUN_COUNT'),
        'Yanlış RLE kayıt sayısı reddedilmeli.'
    );
    assert.ok(
        prebuiltRasterProbe.asset.invalid.truncated.issues.some(issue => (
            issue.code === 'ASSET_PAYLOAD_HASH' || issue.code === 'ASSET_PIXEL_COUNT'
        )),
        'Kesilmiş RLE payload reddedilmeli.'
    );
    assert.equal(prebuiltRasterProbe.asset.fallback.missing.diagnostics.loadMode, 'runtime-fallback', 'Eksik asset runtime fallback çalıştırmalı.');
    assert.equal(prebuiltRasterProbe.asset.fallback.missing.diagnostics.fallbackCode, 'ASSET_MISSING', 'Eksik asset açık teşhis kodu üretmeli.');
    assert.equal(prebuiltRasterProbe.asset.fallback.source.diagnostics.fallbackCode, 'ASSET_SOURCE_HASH', 'Eski kaynak asset’i açık teşhisle fallback yapmalı.');
    assert.equal(prebuiltRasterProbe.asset.fallback.payload.diagnostics.fallbackCode, 'ASSET_PAYLOAD_HASH', 'Bozuk payload açık teşhisle fallback yapmalı.');
    assert.equal(
        prebuiltRasterProbe.asset.fallback.missing.regionHash,
        prebuiltRasterProbe.generated.hashes.regionHash,
        'Eksik asset fallback’i aynı region rasterını üretmeli.'
    );
    assert.equal(prebuiltRasterProbe.ab.equal, true, 'Build-time raster açık/kapalı dünya karmasını değiştirmemeli.');

    const politicalOverlayProbe = probePoliticalOverlay();
    assert.equal(politicalOverlayProbe.main.uiNeutral, true, 'Politik ImageData üretimi kalıcı dünya durumunu değiştirmemeli.');
    assert.equal(politicalOverlayProbe.main.audit.validation.ok, true, 'Politik RGBA/sınır çıktısı kendi sözleşmesini geçmeli.');
    assert.equal(politicalOverlayProbe.main.first.width, 820, 'Politik overlay kanonik 820 piksel genişliği kullanmalı.');
    assert.equal(politicalOverlayProbe.main.first.height, 645, 'Politik overlay kanonik raster yüksekliğini kullanmalı.');
    assert.equal(politicalOverlayProbe.main.first.fillRectCalls, 0, 'Yeni politik overlay hücre başına fillRect kullanmamalı.');
    assert.equal(politicalOverlayProbe.main.first.putImageDataCalls, 1, 'İlk politik overlay tek putImageData ile yazılmalı.');
    assert.equal(politicalOverlayProbe.main.first.source.putImageDataCalls, 1, 'Overlay kaynağı tek ImageData yazımını yayınlamalı.');
    assert.equal(
        politicalOverlayProbe.main.first.source.sourceHash,
        mapRasterProbe.main.raster.sourceHash,
        'Politik overlay kanonik coğrafya checksum’ını kullanmalı.'
    );
    assert.equal(politicalOverlayProbe.main.audit.seaAlphaLeaks, 0, 'Denize politik RGBA sızmamalı.');
    assert.equal(politicalOverlayProbe.main.audit.landAlphaMissing, 0, 'Hiçbir kanonik kara pikseli renksiz kalmamalı.');
    assert.equal(politicalOverlayProbe.main.audit.seaBorderLeaks, 0, 'Denize siyasi sınır yazılmamalı.');
    assert.equal(politicalOverlayProbe.main.audit.invalidLandAlpha, 0, 'Kara alfa değerleri yalnız iç tint veya sınır opaklığı olmalı.');
    assert.ok(politicalOverlayProbe.main.audit.interiorPixels > 0, 'Politik overlay iç bölge pikselleri üretmeli.');
    assert.ok(politicalOverlayProbe.main.audit.borderPixels > 0, 'Politik overlay devlet sınırı üretmeli.');
    assert.ok(
        politicalOverlayProbe.main.firstBuildWallMs < 1000,
        `Politik ImageData ilk kurulumu bir saniyeyi aşmamalı: ${politicalOverlayProbe.main.firstBuildWallMs} ms`
    );
    assert.equal(
        politicalOverlayProbe.main.transfer.firstSource.revision,
        politicalOverlayProbe.main.transfer.cachedSource.revision,
        'Değişmeyen sahiplik cache revision’ını artırmamalı.'
    );
    assert.equal(politicalOverlayProbe.main.transfer.sameCanvasOnCacheHit, true, 'Değişmeyen sahiplik aynı canvas cache’ini kullanmalı.');
    assert.equal(politicalOverlayProbe.main.transfer.transferred, true, 'Gerçek sahiplik transferi politik overlay probunda uygulanmalı.');
    assert.equal(
        politicalOverlayProbe.main.transfer.rebuiltSource.revision,
        politicalOverlayProbe.main.transfer.firstSource.revision + 1,
        'Sahiplik transferi overlay revision’ını tam bir kez artırmalı.'
    );
    assert.notEqual(
        politicalOverlayProbe.main.transfer.rebuiltSource.ownerHash,
        politicalOverlayProbe.main.transfer.firstSource.ownerHash,
        'Sahiplik transferi owner checksum’ını değiştirmeli.'
    );
    assert.equal(politicalOverlayProbe.main.transfer.invalidation.reason, 'territory-transfer', 'Fetih politik cache’i açık nedenle geçersiz kılmalı.');
    assert.equal(politicalOverlayProbe.main.transfer.sameCanvasAfterTransfer, true, 'Fetih mevcut kanonik canvas belleğini yeniden kullanmalı.');
    assert.equal(politicalOverlayProbe.main.transfer.fillRectCalls, 0, 'Fetih rebuild’i fillRect kullanmamalı.');
    assert.equal(politicalOverlayProbe.main.transfer.putImageDataCalls, 2, 'İlk üretim ve fetih toplam iki ImageData yazımı yapmalı.');
    assert.ok(
        politicalOverlayProbe.main.invalid.source.issues.some(issue => issue.code === 'SOURCE_HASH_MISMATCH'),
        'Farklı kanonik kaynağa ait politik overlay reddedilmeli.'
    );
    assert.ok(
        politicalOverlayProbe.main.invalid.owner.issues.some(issue => issue.code === 'OWNER_HASH_MISMATCH'),
        'Eski sahiplik revizyonuna ait politik overlay reddedilmeli.'
    );
    assert.ok(
        politicalOverlayProbe.main.invalid.dimension.issues.some(issue => issue.code === 'DIMENSION_MISMATCH'),
        'Kanonik rasterden farklı overlay boyutu reddedilmeli.'
    );
    assert.ok(
        politicalOverlayProbe.main.invalid.rgbaChecksum.issues.some(issue => issue.code === 'RGBA_HASH_MISMATCH'),
        'Bozuk politik RGBA checksum’ı reddedilmeli.'
    );
    assert.ok(
        politicalOverlayProbe.main.invalid.borderChecksum.issues.some(issue => issue.code === 'BORDER_HASH_MISMATCH'),
        'Bozuk sınır checksum’ı reddedilmeli.'
    );
    assert.ok(
        politicalOverlayProbe.main.invalid.seaAlpha.issues.some(issue => issue.code === 'SEA_ALPHA_LEAK'),
        'Denize taşan politik alfa reddedilmeli.'
    );
    assert.ok(
        politicalOverlayProbe.main.invalid.borderValue.issues.some(issue => issue.code === 'BORDER_VALUE'),
        '0/1 dışı sınır maskesi değeri reddedilmeli.'
    );
    assert.ok(
        politicalOverlayProbe.main.invalid.borderTopology.issues.some(issue => issue.code === 'BORDER_TOPOLOGY_MISMATCH'),
        'Sahiplik topolojisiyle uyuşmayan sınır maskesi reddedilmeli.'
    );
    assert.equal(politicalOverlayProbe.disabled.diagnostics.disabled, true, 'ImageData politik overlay bayrakla kapanabilmeli.');
    assert.equal(politicalOverlayProbe.disabled.directCanvas, null, 'Bayrak kapalıyken yeni overlay canvası doğrudan üretilmemeli.');
    assert.equal(politicalOverlayProbe.disabled.render.width, 300, 'Bayrak kapalı fallback eski 300 piksel overlay’i korumalı.');
    assert.ok(politicalOverlayProbe.disabled.render.fillRectCalls > 10000, 'Eski fallback’in hücre başına fillRect maliyeti ölçülmeli.');
    assert.equal(politicalOverlayProbe.disabled.render.putImageDataCalls, 0, 'Eski fallback putImageData kullanmamalı.');
    assert.equal(politicalOverlayProbe.ab.equal, true, 'Politik ImageData açık/kapalı normal dünya karmasını değiştirmemeli.');

    const warpProbe = probeAdaptiveMapWarp();
    assert.equal(warpProbe.main.uiNeutral, true, 'Warp planı/çizimi kalıcı dünya durumunu değiştirmemeli.');
    assert.equal(warpProbe.main.adaptive720.band, 4, '720p adaptif warp 4 px band kullanmalı.');
    assert.equal(warpProbe.main.adaptive1080.band, 5, '1080p adaptif warp 5 px band kullanmalı.');
    assert.equal(warpProbe.main.adaptive1440.band, 7, '1440p adaptif warp 7 px band kullanmalı.');
    assert.equal(warpProbe.main.adaptiveClose.band, 4, 'Yakın zoom 1080p bandını ayrıntı için bir kademe inceltmeli.');
    assert.equal(warpProbe.main.fixed1080.band, 3, 'Özellik kapalı fallback sabit 3 px bandı korumalı.');
    for (const sample of [
        warpProbe.main.adaptive720,
        warpProbe.main.adaptive1080,
        warpProbe.main.adaptive1440,
        warpProbe.main.adaptiveClose
    ]) {
        assert.equal(sample.first, true, 'Geçerli warp kaynağı ilk katmanı çizebilmeli.');
        assert.equal(sample.second, true, 'Geçerli warp kaynağı ikinci katmanı çizebilmeli.');
        assert.equal(sample.drawCalls, sample.rows * 2, 'İki harita katmanı plan satırı başına tek drawImage yapmalı.');
        assert.equal(sample.cache.misses, 1, 'İki katman aynı warp planını yalnız bir kez üretmeli.');
        assert.ok(sample.cache.hits >= 1, 'İkinci katman ortak warp planı cache’ini kullanmalı.');
        assert.ok(sample.maxScaleError < 0.01, `Band perspektif ölçek hatası %1’i aşmamalı: ${sample.maxScaleError}`);
        assert.ok(sample.maxRoundTripError < 1e-8, `Warp hit-test tersinim hatası oluşmamalı: ${sample.maxRoundTripError}`);
    }
    assert.equal(warpProbe.main.adaptive1080.rows, 216, '1080p adaptif katman 216 draw şeridi üretmeli.');
    assert.equal(warpProbe.main.fixed1080.rows, 360, '1080p eski katman 360 draw şeridi üretmeli.');
    assert.ok(warpProbe.main.callReduction1080 >= 0.4, '1080p draw-call sayısı en az %40 azalmalı.');
    assert.equal(warpProbe.main.invalid.ok, false, 'Geçersiz warp kaynağı çizime girmemeli.');
    assert.equal(warpProbe.main.invalid.error.code, 'SOURCE_DIMENSIONS', 'Geçersiz kaynak açık teşhis kodu üretmeli.');
    assert.equal(warpProbe.ab.equal, true, 'Adaptif warp açık/kapalı dünya karmasını değiştirmemeli.');
    const storyRenderSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'StoryRender.js'), 'utf8');
    const warpStart = storyRenderSource.indexOf('function storyBlitWarp');
    const warpEnd = storyRenderSource.indexOf('// (Eski terrain.png', warpStart);
    const warpBody = storyRenderSource.slice(warpStart, warpEnd);
    assert.ok(warpStart >= 0 && warpEnd > warpStart, 'Warp çizim gövdesi kaynak denetimine bulunmalı.');
    assert.doesNotMatch(warpBody, /\btry\s*\{/, 'Warp draw döngüsü hataları sessiz try/catch ile yutmamalı.');

    const mapCacheProbe = probeMapCacheInvalidation();
    const mapCache = mapCacheProbe.main.contract;
    assert.equal(mapCacheProbe.main.uiNeutral, true, 'Hedefli cache probu kalıcı dünya durumunu test sonunda geri yüklemeli.');
    assert.equal(mapCache.ownership.event.ok, true, 'Sahiplik invalidation olayı kabul edilmeli.');
    assert.equal(mapCache.ownership.sameRaster, true, 'Sahiplik değişimi kanonik rasterı gereksiz yenilememeli.');
    assert.equal(mapCache.ownership.sameTerrain, true, 'Sahiplik değişimi terrain cache’ini gereksiz yenilememeli.');
    assert.equal(mapCache.ownership.sameOwnerCanvas, true, 'Sahiplik rebuild’i mevcut owner canvas belleğini kullanmalı.');
    assert.equal(mapCache.ownership.ownerRevisionDelta, 1, 'Sahiplik invalidation yalnız bir owner revision üretmeli.');
    assert.equal(mapCache.ownership.sameWarp, true, 'Sahiplik değişimi viewport warp planını yenilememeli.');
    assert.equal(mapCache.era.transition.ok, true, 'Gerçek çağ geçiş kapısı geçerli çağ kimliğini kabul etmeli.');
    assert.equal(mapCache.era.transition.changed, true, 'Test çağ geçişi gerçekten farklı çağa gitmeli.');
    assert.equal(mapCache.era.transition.invalidation.scope, 'era', 'Çağ geçişi merkezî era scope’unu kullanmalı.');
    assert.equal(mapCache.era.terrainRebuilt, true, 'Çağ değişimi terrain cache’ini yenilemeli.');
    assert.equal(mapCache.era.terrainHashChanged, true, 'Çağ değişimi yalnız nesneyi değil gerçek terrain piksellerini değiştirmeli.');
    assert.equal(mapCache.era.paletteChanged, true, 'Terrain kaynağı yeni sürümlü palet anahtarını yayınlamalı.');
    assert.equal(mapCache.era.ownerUnchanged, true, 'Çağ değişimi sahiplik RGBA katmanını gereksiz yenilememeli.');
    assert.equal(mapCache.era.warpUnchanged, true, 'Çağ değişimi warp geometrisini gereksiz yenilememeli.');
    assert.equal(mapCache.palette.event.ok, true, 'Palet invalidation olayı kabul edilmeli.');
    assert.equal(mapCache.palette.terrainRebuilt, true, 'Palet değişimi terrain cache’ini yenilemeli.');
    assert.equal(mapCache.palette.ownerCanvasReused, true, 'Devlet paleti değişince owner canvas belleği yeniden kullanılmalı.');
    assert.equal(mapCache.palette.ownerRevisionDelta, 1, 'Palet değişimi politik overlay’i yalnız bir kez yenilemeli.');
    assert.equal(mapCache.viewport.terrainUnchanged, true, 'Viewport değişimi terrain cache’ine dokunmamalı.');
    assert.equal(mapCache.viewport.ownerUnchanged, true, 'Viewport değişimi politik overlay’e dokunmamalı.');
    assert.equal(mapCache.viewport.warpRebuilt, true, 'Viewport invalidation warp planını yeniden kurmalı.');
    assert.equal(mapCache.invalid.event.code, 'MAP_CACHE_SCOPE_UNKNOWN', 'Bilinmeyen cache scope açık kodla reddedilmeli.');
    assert.equal(mapCache.invalid.revisionUnchanged, true, 'Reddedilen scope cache revision’ını değiştirmemeli.');
    assert.equal(mapCache.geometry.cleared.raster, false, 'Geometri invalidation kanonik rasterı temizlemeli.');
    assert.equal(mapCache.geometry.cleared.landGrid, false, 'Geometri invalidation kara gridini temizlemeli.');
    assert.equal(mapCache.geometry.cleared.geoTerrain, false, 'Geometri invalidation terrain’i temizlemeli.');
    assert.equal(mapCache.geometry.cleared.ownerData, false, 'Geometri invalidation politik veriyi temizlemeli.');
    assert.equal(mapCache.geometry.cleared.warpPlan, false, 'Geometri invalidation warp planını temizlemeli.');
    assert.equal(mapCache.geometry.rasterRebuilt, true, 'Temizlenen raster aynı nesne olarak sızmamalı.');
    assert.equal(mapCache.geometry.sourceHashStable, true, 'Değişmeyen geometri rebuild sonrası aynı kaynak checksum’ını vermeli.');
    assert.equal(mapCache.geometry.terrainReady, true, 'Geometri rebuild sonrası terrain hazır olmalı.');
    assert.equal(mapCache.geometry.ownerReady, true, 'Geometri rebuild sonrası politik overlay hazır olmalı.');
    assert.equal(mapCache.geometry.warpReady, true, 'Geometri rebuild sonrası warp planı hazır olmalı.');
    assert.equal(mapCacheProbe.disabled.diagnostics.enabled, false, 'Merkezî cache kapısı özellik bayrağıyla kapanabilmeli.');
    assert.equal(mapCacheProbe.disabled.invalidation.code, 'MAP_CACHE_INVALIDATION_DISABLED', 'Kapalı kapı açık teşhis kodu vermeli.');
    assert.equal(mapCacheProbe.ab.equal, true, 'Merkezî cache sözleşmesi açık/kapalı dünya karmasını değiştirmemeli.');

    const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const readmeSource = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
    const packageSource = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    const overlayScriptAt = indexSource.indexOf('js/StoryPoliticalOverlay.js');
    const cacheScriptAt = indexSource.indexOf('js/StoryMapCache.js');
    const renderScriptAt = indexSource.indexOf('js/StoryRender.js');
    assert.ok(overlayScriptAt >= 0 && cacheScriptAt > overlayScriptAt && renderScriptAt > cacheScriptAt,
        'Aktif index politik overlay → cache sözleşmesi → renderer sırasını korumalı.');
    assert.equal(indexSource.includes('src="StoryGeoRender.js"'), false,
        'Kök StoryGeoRender prototipi aktif index tarafından yüklenmemeli.');
    assert.equal(indexSource.includes('src="js/StoryGeoRender.js"'), false,
        'Artık var olmayan override renderer index’e geri eklenmemeli.');
    assert.equal(indexSource.includes('src="js/MapData.js"'), true,
        'Aktif taktik MapData kaynağı index’te kalmalı.');
    assert.equal(fs.existsSync(path.join(__dirname, '..', 'StoryGeoRender.js')), true,
        'README’de arşiv olarak açıklanan prototip envanterde bulunmalı.');
    assert.equal(fs.existsSync(path.join(__dirname, '..', 'MapData.v2.js')), false,
        'Eski kök MapData.v2 çifti çalışma ağacında geri oluşmamalı.');
    assert.equal(fs.existsSync(path.join(__dirname, '..', 'js', 'mapDataV2.js')), false,
        'Eski js/mapDataV2 çifti çalışma ağacında geri oluşmamalı.');
    assert.match(readmeSource, /StoryMapCache\.js/, 'README merkezî cache kaynağını açıklamalı.');
    assert.match(readmeSource, /3000/, 'README gerçek 3000 px hikâye dünya genişliğini yazmalı.');
    assert.match(readmeSource, /StoryGeoRender\.js.*prototip/s,
        'README yüklenmeyen kök renderer’ı prototip olarak ayırmalı.');
    assert.match(readmeSource, /js\/MapData\.js.*aktif taktik/s,
        'README aktif savaş MapData kaynağını ölü prototipten ayırmalı.');
    assert.ok(Array.isArray(packageSource.build.files)
        && packageSource.build.files.includes('js/**/*')
        && !packageSource.build.files.includes('StoryGeoRender.js'),
    'Paket aktif js kaynaklarını almalı, kök prototipi açıkça dahil etmemeli.');

    const migrationProbe = probeMigration();
    assert.equal(migrationProbe.prepared.ok, true, 'Geçerli V3 kayıt saf V2 dönüşümüne hazırlanmalı.');
    assert.equal(migrationProbe.success.ok, true, 'Geçerli V3 kayıt güvenli gölge V2 kopyasına göçebilmeli.');
    assert.equal(migrationProbe.success.stage, 'complete', 'Başarılı göç bütün doğrulama kapılarını tamamlamalı.');
    assert.equal(migrationProbe.success.sourceUnchanged, true, 'Göç kaynak V3 kaydını byte-byte korumalı.');
    assert.equal(migrationProbe.success.backupExact, true, 'Göç yedeği kaynak V3 kaydının byte-byte kopyası olmalı.');
    assert.equal(migrationProbe.success.targetValidation.ok, true, 'Yazılan V2 hedefi şema doğrulayıcıyı geçmeli.');
    assert.equal(migrationProbe.success.storedReport.status, 'MIGRATED', 'Başarılı göç raporu MIGRATED olmalı.');
    assert.deepEqual(
        migrationProbe.success.writes,
        [
            'pixelrts_story_v3_backup_phase5',
            'pixelrts_story_world_v2',
            'pixelrts_story_v3_migration_report'
        ],
        'İlk göç yalnız yedek, hedef ve rapor anahtarlarını bu sırayla yazmalı.'
    );
    assert.equal(
        migrationProbe.success.counts.countries,
        migrationProbe.success.sourceCounts.countries,
        'Göç bütün devletleri korumalı.'
    );
    assert.equal(
        migrationProbe.success.counts.regions,
        migrationProbe.success.sourceCounts.regions,
        'Göç bütün bölgeleri korumalı.'
    );
    assert.equal(migrationProbe.success.countryResourcesMatch, true, 'Devlet kaynakları V3→V2 bire bir korunmalı.');
    assert.equal(migrationProbe.success.regionOwnersMatch, true, 'Bölge sahipliği V3→V2 bire bir korunmalı.');
    assert.equal(migrationProbe.success.playerCommanderMatch, true, 'Oyuncu komutanı V2 karakter/kuvvet modeline taşınmalı.');
    assert.equal(migrationProbe.success.clock.schedulerState.fixedStepSeconds, 0.25, 'Göç sabit saat adımını V2 zamanlayıcısına taşımalı.');
    assert.equal(migrationProbe.success.rng.rootSeed, 2032, 'Göç RNG kök tohumunu V2 teşhisine taşımalı.');
    assert.equal(
        migrationProbe.success.scheduler.schemaVersion,
        1,
        'Göç görev sicilini V2 teşhisine taşımalı.'
    );
    assert.equal(migrationProbe.beforeHash, migrationProbe.afterHash, 'Göç canlı V3 dünya durumunu değiştirmemeli.');
    assert.equal(migrationProbe.malformed.ok, false, 'Bozuk JSON göçü reddedilmeli.');
    assert.equal(migrationProbe.malformed.stage, 'preflight', 'Bozuk JSON yazmadan önce reddedilmeli.');
    assert.equal(migrationProbe.malformed.writes, 0, 'Bozuk JSON için depolamaya hiçbir şey yazılmamalı.');
    assert.equal(migrationProbe.malformed.sourceUnchanged, true, 'Bozuk JSON kaynağı değiştirilmemeli.');
    assert.equal(migrationProbe.invalid.ok, false, 'Yapısal olarak bozuk V3 kayıt reddedilmeli.');
    assert.equal(migrationProbe.invalid.writes, 0, 'Yapısal olarak bozuk kayıtta hiçbir şey yazılmamalı.');
    assert.equal(migrationProbe.invalid.sourceUnchanged, true, 'Yapısal olarak bozuk kaynak değiştirilmemeli.');
    assert.equal(migrationProbe.backupConflict.stage, 'backup-conflict', 'Farklı mevcut yedek sessizce ezilmemeli.');
    assert.equal(migrationProbe.backupConflict.writes, 0, 'Yedek çakışmasında hiçbir şey yazılmamalı.');
    assert.equal(migrationProbe.backupConflict.sourceUnchanged, true, 'Yedek çakışması kaynak kaydı değiştirmemeli.');
    assert.equal(migrationProbe.targetConflict.stage, 'target-conflict', 'Farklı mevcut V2 hedef sessizce ezilmemeli.');
    assert.equal(migrationProbe.targetConflict.writes, 0, 'Hedef çakışmasında hiçbir şey yazılmamalı.');
    assert.equal(migrationProbe.targetConflict.sourceUnchanged, true, 'Hedef çakışması kaynak kaydı değiştirmemeli.');

    const clockProbe = probeDeterministicClock();
    const fixedHashes = Object.values(clockProbe.patterns).map(result => result.hash);
    assert.equal(new Set(fixedHashes).size, 1, '30/60/144 FPS ve jitter aynı dünya karmasını üretmeli.');
    const speedHashes = Object.values(clockProbe.speeds).map(result => result.hash);
    assert.equal(new Set(speedHashes).size, 1, '1×/2×/4× aynı oyun süresinde aynı dünya karmasını üretmeli.');
    for (const result of [...Object.values(clockProbe.patterns), ...Object.values(clockProbe.speeds)]) {
        assert.equal(result.gameTime, 30, 'Her kare/hız deseni tam 30 oyun saniyesinde bitmeli.');
        assert.equal(result.clock.fixedStepSeconds, 0.25, 'Dünya adımı 0,25 saniye olmalı.');
        assert.equal(result.clock.tick, 120, '30 oyun saniyesi tam 120 sabit tik üretmeli.');
        assert.equal(result.clock.accumulatorSeconds, 0, 'Tam süre sonunda kısmi tik kalmamalı.');
    }
    assert.equal(clockProbe.pause.before.hash, clockProbe.pause.after.hash, 'Duraklatma dünya durumunu değiştirmemeli.');
    assert.equal(clockProbe.pause.before.gameTime, clockProbe.pause.after.gameTime, 'Duraklatma oyun saatini ilerletmemeli.');
    assert.equal(
        clockProbe.pause.before.clock.accumulatorSeconds,
        clockProbe.pause.after.clock.accumulatorSeconds,
        'Duraklatma yarım kalan sabit tik kuyruğunu değiştirmemeli.'
    );
    assert.equal(clockProbe.restored.loaded, true, 'Saat durumu taşıyan V3 kayıt yeniden yüklenebilmeli.');
    assert.equal(
        JSON.stringify(clockProbe.restored.savedClock),
        JSON.stringify(clockProbe.restored.beforeAdvance),
        'Kayıt/yükleme hız, tik ve kısmi adımı eksiksiz korumalı.'
    );
    assert.equal(clockProbe.restored.beforeGameTime, 12, '12,125 sn giriş 12 sn dünya zamanı ve 0,125 sn kuyruk bırakmalı.');
    assert.equal(clockProbe.restored.savedClock.accumulatorSeconds, 0.125, 'Kısmi sabit adım kayda girmeli.');
    assert.equal(clockProbe.restored.afterGameTime, 12.25, 'Yükleme sonrası kalan 0,125 sn yeni 0,125 sn ile tek tik üretmeli.');
    assert.equal(clockProbe.restored.afterAdvance.accumulatorSeconds, 0, 'Yükleme sonrası tamamlanan tik kuyruk bırakmamalı.');
    assert.equal(clockProbe.calendar.start.label, '01.01.2032', 'Takvim başlangıcı açık olmalı.');
    assert.equal(clockProbe.calendar.yearEnd.label, '30.12.2032', 'Yıl sonu sınırı doğru olmalı.');
    assert.equal(clockProbe.calendar.nextYear.label, '01.01.2033', '120. saniye yeni yıla geçmeli.');
    assert.equal(clockProbe.calendar.tenYears.label, '01.01.2042', 'On yıllık takvim dönüşümü kaymamalı.');

    const schedulerProbe = probeSchedulerRegistry();
    assert.equal(
        JSON.stringify(schedulerProbe.cadence.atBoundary.taskOrder),
        JSON.stringify(schedulerProbe.expectedOrder),
        'Aynı tikte vadesi gelen dünya görevleri sürümlü sicil sırasında çalışmalı.'
    );
    const expectedRunsAt14 = {
        resource: 14,
        production: 14,
        'commander-ai': 14,
        loyalty: 28,
        economy: 3,
        'city-growth': 2,
        population: 2,
        'human-migration': 2,
        'power-centers': 2,
        'population-needs': 2,
        factions: 7,
        society: 3,
        siege: 5,
        technology: 1,
        chatter: 1,
        talks: 1,
        diplomacy: 1,
        era: 2,
        'city-development': 1,
        replenishment: 1
    };
    for (const [taskId, expectedRuns] of Object.entries(expectedRunsAt14)) {
        assert.equal(
            schedulerProbe.cadence.atBoundary.tasks[taskId].runCount,
            expectedRuns,
            `${taskId} görevi 14 saniyede beklenen sayıda çalışmalı.`
        );
        assert.equal(
            schedulerProbe.cadence.afterQuarter.tasks[taskId].runCount,
            expectedRuns,
            `${taskId} görevi vadesi gelmeden ikinci kez çalışmamalı.`
        );
    }
    assert.equal(
        schedulerProbe.ab.registryHash,
        schedulerProbe.ab.legacyHash,
        'Merkezî görev sicili A/B geri dönüş yoluyla aynı 30 saniyelik dünyayı üretmeli.'
    );
    assert.equal(schedulerProbe.continuation.loaded, true, 'Görev sicilli kayıt yeni süreçte yüklenebilmeli.');
    assert.equal(
        schedulerProbe.continuation.equal,
        true,
        `Kesintisiz ve kayıt-yükleme-devam dünyaları birebir aynı olmalı: ${schedulerProbe.continuation.continuousHash} / ${schedulerProbe.continuation.resumedHash}\nYükleme anı: ${JSON.stringify(schedulerProbe.continuation.checkpointDifferences, null, 2)}\nGelecek: ${JSON.stringify(schedulerProbe.continuation.differences, null, 2)}`
    );
    assert.equal(
        schedulerProbe.fallback.loaded,
        true,
        'Görev sicili taşımayan eski kayıt kontrollü fallback ile açılmalı.'
    );
    assert.ok(
        schedulerProbe.fallback.scheduler.warnings.length > 0,
        'Eski kayıt görev sicili fallback’i sessiz olmamalı.'
    );

    const rngProbe = probeRngStreams();
    assert.equal(rngProbe.initialSnapshot.rootSeed, 2032, 'Kampanya RNG kök tohumu açıkça saklanmalı.');
    assert.equal(rngProbe.initialSnapshot.schemaVersion, 1, 'RNG durumu sürümlü olmalı.');
    assert.equal(Object.keys(rngProbe.initialSnapshot.streams).length, 9, 'Dokuz bağımsız RNG akışı bulunmalı.');
    assert.equal(
        JSON.stringify(rngProbe.initialSnapshot),
        JSON.stringify(rngProbe.sameSeed.snapshot),
        'Aynı tohum kampanya kuruluşundan sonra aynı RNG durumunu üretmeli.'
    );
    assert.notEqual(
        JSON.stringify(rngProbe.sameSeed.military),
        JSON.stringify(rngProbe.differentSeed.military),
        'Farklı kök tohum askerî rastgele diziyi değiştirmeli.'
    );
    assert.equal(rngProbe.restored.loaded, true, 'RNG durumu taşıyan kayıt yüklenebilmeli.');
    assert.equal(
        JSON.stringify(rngProbe.savedSnapshot),
        JSON.stringify(rngProbe.restored.snapshot),
        'Kayıt/yükleme bütün RNG akış durumlarını ve çağrı sayaçlarını korumalı.'
    );
    assert.equal(
        JSON.stringify(rngProbe.expectedAfterSave),
        JSON.stringify(rngProbe.restored.actualAfterLoad),
        'Kayıt sonrası beklenen rastgele diziler yükleme sonrasında aynen devam etmeli.'
    );
    assert.equal(
        JSON.stringify(rngProbe.isolated.baselineMilitary),
        JSON.stringify(rngProbe.isolated.militaryAfterNarrativeNoise),
        'Anlatı akışına 100 ek çağrı askerî rastgele diziyi değiştirmemeli.'
    );
    assert.notEqual(
        JSON.stringify(rngProbe.coupled.baselineMilitary),
        JSON.stringify(rngProbe.coupled.militaryAfterNarrativeNoise),
        'rng.streams kapalı A/B yolu eski küresel çağrı bağımlılığını göstermeli.'
    );
    assert.equal(rngProbe.fallback.loadedA, true, 'RNG taşımayan eski kayıt deterministik fallback ile açılmalı.');
    assert.equal(rngProbe.fallback.loadedB, true, 'Aynı eski kayıt ikinci kez de açılmalı.');
    assert.equal(
        JSON.stringify(rngProbe.fallback.snapshotA),
        JSON.stringify(rngProbe.fallback.snapshotB),
        'RNG taşımayan aynı eski kayıt her yüklemede aynı fallback durumunu üretmeli.'
    );
    assert.ok(
        rngProbe.fallback.snapshotA.warnings.length > 0,
        'RNG fallback sessiz olmamalı; göç uyarısı üretmeli.'
    );
    assert.equal(rngProbe.unknownRejected, true, 'Bilinmeyen RNG akışı sessizce kabul edilmemeli.');

    const causalityProbe = probeCausalityLedger();
    assert.equal(causalityProbe.enabled.firstWelfare, -5, 'İlk idempotent refah komutu uygulanmalı.');
    assert.equal(causalityProbe.enabled.duplicateWelfare, 0, 'Aynı idempotencyKey ikinci kez uygulanmamalı.');
    assert.equal(
        causalityProbe.enabled.welfareAfter,
        causalityProbe.enabled.welfareBefore - 5,
        'Yinelenen komut refahı yalnız bir kez değiştirmeli.'
    );
    assert.equal(causalityProbe.enabled.transferApplied, true, 'Sahiplik kapısı geçerli transferi uygulamalı.');
    assert.equal(
        causalityProbe.enabled.telemetryImmediate,
        causalityProbe.enabled.telemetryBefore + 1,
        'Sahiplik telemetrisi mutasyon anında tam bir olay üretmeli.'
    );
    assert.equal(
        causalityProbe.enabled.telemetryAfterTick,
        causalityProbe.enabled.telemetryImmediate,
        'Sonraki gözlem tiki aynı sahiplik değişimini ikinci kez yazmamalı.'
    );
    assert.ok(causalityProbe.enabled.welfareEffect, 'Refah değişimi before/after etkisi üretmeli.');
    assert.equal(causalityProbe.enabled.welfareEffect.before, causalityProbe.enabled.welfareBefore, 'Refah etkisi eski değeri taşımalı.');
    assert.equal(causalityProbe.enabled.welfareEffect.after, causalityProbe.enabled.welfareAfter, 'Refah etkisi yeni değeri taşımalı.');
    assert.ok(causalityProbe.enabled.ownerEffect, 'Bölge sahipliği kalıcı etki üretmeli.');
    assert.ok(causalityProbe.enabled.treatyEffect, 'Antlaşma değişimi kalıcı etki üretmeli.');
    assert.ok(causalityProbe.enabled.relationEffect, 'Diplomatik ilişki değişimi kalıcı etki üretmeli.');
    assert.ok(causalityProbe.enabled.resourceEffect, 'Kaynak akışı kaynak etiketli delta etkisi üretmeli.');
    assert.equal(causalityProbe.enabled.resourceEffect.delta.points, -7, 'Kaynak etkisi tipli deltayı korumalı.');
    assert.equal(causalityProbe.enabled.resourceEffect.observed, true, 'Mevcut kaynak muhasebesi gözlemlenen etki olarak işaretlenmeli.');
    assert.equal(causalityProbe.enabled.moveApplied, true, 'Komutan hareket kapısı geçerli hareketi uygulamalı.');
    assert.ok(causalityProbe.enabled.movementEffect, 'Komutan hareketi eski/yeni bölge etkisi üretmeli.');
    assert.equal(causalityProbe.enabled.movementEffect.before, causalityProbe.enabled.moveFrom, 'Hareket etkisi çıkış bölgesini taşımalı.');
    assert.equal(causalityProbe.enabled.movementEffect.after, causalityProbe.enabled.moveTarget, 'Hareket etkisi varış bölgesini taşımalı.');
    assert.ok(
        causalityProbe.enabled.trace
        && causalityProbe.enabled.trace.command
        && causalityProbe.enabled.trace.event
        && causalityProbe.enabled.trace.effect,
        'Bir etkiden komut ve kök olaya geri izleme yapılabilmeli.'
    );
    for (const collectionName of ['commands', 'events', 'effects']) {
        const rows = causalityProbe.enabled.ledger[collectionName];
        for (let index = 1; index < rows.length; index++) {
            assert.ok(
                rows[index].sequence > rows[index - 1].sequence,
                `${collectionName} kendi içinde kesin artan sıra taşımalı.`
            );
        }
    }
    const causalityCommandIds = new Set(causalityProbe.enabled.ledger.commands.map(command => command.id));
    const causalityEventIds = new Set(causalityProbe.enabled.ledger.events.map(event => event.id));
    for (const effect of causalityProbe.enabled.ledger.effects) {
        assert.ok(causalityCommandIds.has(effect.commandId), `Etki kaynak komuta bağlanmalı: ${effect.id}`);
        assert.ok(causalityEventIds.has(effect.eventId), `Etki kaynak olaya bağlanmalı: ${effect.id}`);
    }
    assert.equal(causalityProbe.enabled.invalidKeyRejected, true, 'Boş idempotencyKey sessizce kabul edilmemeli.');
    assert.equal(causalityProbe.restored.loaded, true, 'Nedensellik taşıyan kayıt yeniden yüklenebilmeli.');
    assert.equal(causalityProbe.restored.exact, true, 'Kayıt/yükleme nedensellik defterini birebir korumalı.');
    assert.ok(
        causalityProbe.restored.after.commands.some(command => command.id === causalityProbe.restored.continuedCommandId),
        'Yükleme sonrasında komut kimliği kaldığı yerden devam etmeli.'
    );
    assert.equal(causalityProbe.disabled.after, causalityProbe.disabled.before - 5, 'Defter kapalıyken dünya davranışı korunmalı.');
    assert.deepEqual(
        [causalityProbe.disabled.commands, causalityProbe.disabled.events, causalityProbe.disabled.effects],
        [0, 0, 0],
        'causality.ledger kapalı A/B yolunda defter boş kalmalı.'
    );

    const guardProbe = probeCausalityGuards();
    assert.equal(guardProbe.guarded.cycle.executed, 3, 'Aynı nedensel adım üç uygulamadan sonra kesilmeli.');
    assert.ok(
        guardProbe.guarded.cycle.blocked.includes('CYCLE_REPEAT'),
        'Tekrarlanan neden zinciri açık döngü teşhisi üretmeli.'
    );
    assert.equal(guardProbe.guarded.eventFlood.applied, 31, 'Kök olayla birlikte komut başına en çok 32 olay uygulanmalı.');
    assert.equal(guardProbe.guarded.eventFlood.blocked, 69, 'Olay bütçesini aşan alt olaylar mutatörü çalıştırmadan engellenmeli.');
    assert.equal(guardProbe.guarded.effectFlood.applied, 96, 'Komut başına etki bütçesi tam 96 olmalı.');
    assert.equal(guardProbe.guarded.effectFlood.blocked, 54, 'Etki bütçesini aşan yazımlar uygulanmamalı.');
    assert.deepEqual(
        guardProbe.guarded.invariants.after,
        guardProbe.guarded.invariants.before,
        'Geçersiz refah, sahiplik, kaynak ve komutan konumu dünyaya sızmamalı.'
    );
    assert.ok(
        Object.values(guardProbe.guarded.invariants.attempts).every(value => value === false),
        'Bütün geçersiz değişmez enjeksiyonları reddedilmeli.'
    );
    assert.ok(
        guardProbe.guarded.invariants.guard.invariantFailures >= 4,
        'Her geçersiz domain değeri kaynak koduyla sayılmalı.'
    );
    assert.equal(guardProbe.guarded.consistency.broken.ok, false, 'Kapı dışı doğrudan yazım dünya–defter mutabakatını bozmalı.');
    assert.ok(
        guardProbe.guarded.consistency.broken.issues.some(issue => issue.code === 'WORLD_LEDGER_MISMATCH'),
        'Mutabakat hatası açıklamalı kod ve beklenen/gerçek değer üretmeli.'
    );
    assert.equal(guardProbe.guarded.consistency.repaired.ok, true, 'Canlı değer defterle eşitlenince mutabakat yeniden geçmeli.');
    assert.equal(guardProbe.guarded.validation.ok, true, 'Sigortalar sonrası tutulan defter yapısal olarak geçerli kalmalı.');
    assert.ok(guardProbe.guarded.ledger.warnings.length <= 120, 'Sigorta uyarı defteri kendi sınırını aşmamalı.');
    assert.equal(guardProbe.windowFlood.applied, 512, 'Bir dünya saniyesinde komut bütçesine kadar işlem uygulanmalı.');
    assert.equal(guardProbe.windowFlood.blocked, 88, 'Pencere bütçesini aşan komutlar mutatörü çalıştırmadan kesilmeli.');
    assert.ok(
        guardProbe.windowFlood.guard.blockedCommandBudget >= 88,
        'Komut fırtınası ayrı sağlık sayacında görünmeli.'
    );
    assert.equal(guardProbe.corrupt.validationBeforeRestore.ok, false, 'Kırık olay referanslı kayıt doğrulayıcıdan geçmemeli.');
    assert.ok(
        guardProbe.corrupt.validationBeforeRestore.issues.some(issue => issue.code === 'BROKEN_EVENT_REFERENCE'),
        'Bozuk kayıt açıklamalı kırık-referans kodu üretmeli.'
    );
    assert.equal(guardProbe.corrupt.validationAfterRestore.ok, true, 'Bozuk defter dünya kaydını bozmadan güvenli boş deftere dönmeli.');
    assert.equal(guardProbe.corrupt.restored.meta.restoredFromInvalidLedger, true, 'Bozuk defter fallback’i sessiz olmamalı.');
    assert.equal(guardProbe.corrupt.restored.guard.invalidRestores, 1, 'Bozuk defter geri yükleme sayacı artmalı.');
    assert.equal(guardProbe.disabled.after.welfare, 999, 'Sigorta kapalı A/B yolu eski doğrulamasız yazımı korumalı.');
    assert.equal(guardProbe.disabled.guard.invariantFailures, 0, 'Sigorta kapalıyken değişmez kapısı çalışmamalı.');
    assert.equal(guardProbe.ab.equal, true, 'Normal dünyada sigorta açık/kapalı aynı karma üretmeli.');

    const projectionProbe = probeStoryProjection();
    assert.equal(projectionProbe.main.beforeHash, projectionProbe.main.afterHash, 'UI projeksiyonu canlı dünya durumunu değiştirmemeli.');
    assert.equal(projectionProbe.main.worldUnchanged, true, 'UI projeksiyonu verilen V2 dünya nesnesini değiştirmemeli.');
    assert.equal(projectionProbe.main.ledgerUnchanged, true, 'UI projeksiyonu nedensellik defterini değiştirmemeli.');
    assert.equal(projectionProbe.main.validation0.ok, true, 'Oyuncu 0 projeksiyonu kendi sözleşmesini geçmeli.');
    assert.equal(projectionProbe.main.validation1.ok, true, 'Oyuncu 1 projeksiyonu kendi sözleşmesini geçmeli.');
    assert.equal(projectionProbe.main.validationEstimated.ok, true, 'Tahminli bilgi projeksiyonu kendi sözleşmesini geçmeli.');
    assert.equal(projectionProbe.main.player0Foreign, null, 'Rakibin bilinmeyen refah değişimi oyuncu 0 akışına hiç girmemeli.');
    assert.ok(projectionProbe.main.player1Foreign, 'Aynı refah değişimi sahibi oyuncu için görünür olmalı.');
    assert.equal(projectionProbe.main.player1Foreign.precision, 'EXACT', 'Sahibin doğrulanmış refah değişimi kesin olmalı.');
    assert.ok(projectionProbe.main.estimatedForeign, 'İstihbarat tahmini yabancı değişimin varlığını görünür kılmalı.');
    assert.equal(projectionProbe.main.estimatedForeign.precision, 'OPAQUE', 'Tahmin yabancı gerçek değişim değerini açmamalı.');
    assert.equal(projectionProbe.main.estimatedForeign.before, null, 'Tahmin kesin eski değer taşımamalı.');
    assert.equal(projectionProbe.main.estimatedForeign.after, null, 'Tahmin kesin yeni değer taşımamalı.');
    assert.equal(projectionProbe.main.estimatedForeign.delta, null, 'Tahmin kesin delta taşımamalı.');
    assert.ok(projectionProbe.main.player0Own, 'Oyuncunun kendi refah değişimi görünür olmalı.');
    assert.ok(projectionProbe.main.player0Public, 'Kamusal bölge kontrol değişimi oyuncu 0 için görünür olmalı.');
    assert.ok(projectionProbe.main.player1Public, 'Kamusal bölge kontrol değişimi oyuncu 1 için de görünür olmalı.');
    assert.ok(
        projectionProbe.main.player0Own.cause.steps.length >= 3,
        'Görünür değişim komut → olay → etki neden zinciri taşımalı.'
    );
    assert.equal(
        projectionProbe.main.player0Own.cause.steps.some(step => (
            Object.prototype.hasOwnProperty.call(step, 'payload')
            || Object.prototype.hasOwnProperty.call(step, 'actor')
            || Object.prototype.hasOwnProperty.call(step, 'target')
        )),
        false,
        'UI neden izi ham komut payload/aktör/hedef taşımamalı.'
    );
    assert.ok(
        projectionProbe.main.damagedEstimatedValidation.issues.some(issue => issue.code === 'IMPRECISE_FACT_EXACT_LEAK'),
        'Tahmine kesin değer enjekte edilirse projeksiyon doğrulayıcı reddetmeli.'
    );
    assert.ok(
        projectionProbe.main.hiddenLeakValidation.issues.some(issue => issue.code === 'HIDDEN_FACT_LEAK'),
        'UNKNOWN gerçeği değişim listesine enjekte etmek açıklamalı sızıntı hatası üretmeli.'
    );
    assert.equal(projectionProbe.main.exactSecretLeakedToPlayer0, false, 'Yabancı kesin refah değeri oyuncu 0 görünümüne sızmamalı.');
    assert.equal(projectionProbe.main.ui.panelRemoved, true,
        'Gereksiz Değişim paneli gerçek oyun ve test DOM’undan kaldırılmış olmalı.');
    assert.ok(projectionProbe.main.ui.projectedItemCount > 0,
        'Panel kaldırılsa da nedensellik verisi simülasyon motorunda korunmalı.');
    assert.ok(projectionProbe.main.ui.projectedStepCount >= 3,
        'Hover ayrıntılarını besleyen komut → olay → etki zinciri korunmalı.');
    assert.equal(projectionProbe.restored.loaded, true, 'Projeksiyon kaynakları taşıyan kayıt yeniden yüklenebilmeli.');
    assert.equal(projectionProbe.restored.equal, true, 'Kayıt/yükleme sonrası aynı oyuncu görünümü birebir yeniden üretilmeli.');
    assert.equal(projectionProbe.disabled.disabled, true, 'Projeksiyon bayrağı kapalıyken güvenli boş görünüm dönmeli.');
    assert.equal(projectionProbe.disabled.items.length, 0, 'Kapalı projeksiyon olay veya etki açmamalı.');
    assert.equal(projectionProbe.ab.equal, true, 'Projeksiyon açık/kapalı normal dünya karmasını değiştirmemeli.');

    const welfareProbe = probeWelfareGate();
    const welfareProbeOff = probeWelfareGate(2032, { 'welfare.continuousCap': false });
    assert.ok(welfareProbe.applied >= -0.360001, 'Sürekli refah kaybı burst tavanını aşmamalı.');
    assert.ok(
        Object.values(welfareProbe.welfareTotals || {}).some(total => total.suppressed > 0),
        'Sürekli refah kaybı tavanı bastırdığı miktarı raporlamalı.'
    );
    assert.equal(
        Object.values(welfareProbeOff.welfareTotals || {}).reduce((sum, total) => sum + total.suppressed, 0),
        0,
        'Refah tavanı bayrakla kapatıldığında eski sınırsız akış korunmalı.'
    );
    assert.ok(
        welfareProbeOff.applied < welfareProbe.applied,
        'Hedefli A/B probu davranış bayrağının gerçekten çalıştığını göstermeli.'
    );

    const welfareWriters = [
        'js/Story.js',
        'js/StoryAI.js',
        'js/StorySocial.js',
        'js/Council.js',
        'js/Economy.js',
        'js/Factions.js',
        'js/News.js'
    ].flatMap(relativePath => {
        const source = fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
        return source.match(/\.welfare\s*=(?!=)/g) || [];
    });
    assert.equal(
        welfareWriters.length,
        0,
        'Hikâye sistemleri refahı doğrudan yazmamalı; storyWelfareDelta kullanmalı.'
    );
    const ownershipWriters = ['js/StoryAI.js', 'js/StorySocial.js'].flatMap(relativePath => {
        const source = fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
        return source.match(/\.owner\s*=(?!=)/g) || [];
    });
    assert.equal(
        ownershipWriters.length,
        0,
        'Canlı AI ve toplum katmanı sahipliği doğrudan yazmamalı; storyTransferNodeOwnership kullanmalı.'
    );
    const aiMovementWriters = ['js/StoryAI.js', 'js/StorySocial.js'].flatMap(relativePath => {
        const source = fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
        return source.match(/\b(?:cmd|dc|lead)\.node\s*=(?!=)/g) || [];
    });
    assert.equal(
        aiMovementWriters.length,
        0,
        'AI komutan hareketleri doğrudan node yazmamalı; storyMoveCommander kullanmalı.'
    );
    const llmSource = fs.readFileSync(path.resolve(__dirname, '..', 'js/LLM.js'), 'utf8');
    for (const eventType of ['llm.requested', 'llm.used', 'llm.rejected', 'llm.failed']) {
        assert.ok(llmSource.includes(eventType), `LLM telemetrisi ${eventType} sonucunu kaydetmeli.`);
    }

    const storyRandomDomains = [
        'js/Story.js', 'js/StoryAI.js', 'js/StorySocial.js', 'js/Character.js',
        'js/Factions.js', 'js/Economy.js', 'js/News.js', 'js/StoryUI.js',
        'js/Production.js', 'js/Council.js', 'js/Era.js', 'js/Chatter.js',
        'js/Talks.js', 'js/CommanderTree.js', 'js/StoryProductionSectors.js',
        'js/StoryRegionalEconomy.js', 'js/StoryMarket.js'
    ];
    const directStoryRandomCalls = storyRandomDomains.flatMap(relativePath => {
        const source = fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
        return source.match(/Math\.random\s*\(/g) || [];
    });
    assert.equal(
        directStoryRandomCalls.length,
        0,
        'Hikâye domainleri doğrudan Math.random kullanmamalı; adlandırılmış StoryRng akışına gitmeli.'
    );

    console.log('Hikâye dünya testi geçti.');
    console.log(JSON.stringify({
        seed: first.seed,
        simulatedSeconds: first.simulatedSeconds,
        stateHash: first.stateHash,
        wallTimeMs: first.wallTimeMs,
        final: first.final,
        publicOpinion: first.opinionSummary,
        collectiveAction: first.collectiveSummary,
        humanMigration: first.humanMigrationSummary
    }, null, 2));
}

run();
