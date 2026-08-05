'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
    runStorySimulation,
    probeWelfareGate,
    probePoliticalOverlay,
    probePrebuiltMapRaster,
    probeAdaptiveMapWarp,
    probeMapCacheInvalidation,
    probeResourceTaxonomy,
    probeProductionSectors,
    probePeacefulDiplomacy,
    probeRegionalEconomy,
    probeTradeLogistics,
    probeMarketPrices,
    probeStateBudget,
    probeCompaniesBanks,
    probeEconomicAI,
    probePopulationCohorts,
    probeNeedsWelfare,
    probePublicOpinion,
    probeCollectiveAction,
    probeHumanMigration,
    probePowerCenters,
    probeInstitutions,
    probeStateCapacity
} = require('./story-sim-harness');

function numberArg(name, fallback) {
    const prefix = `--${name}=`;
    const raw = process.argv.find(arg => arg.startsWith(prefix));
    const value = raw == null ? NaN : Number(raw.slice(prefix.length));
    return Number.isFinite(value) ? value : fallback;
}

function stringArg(name, fallback) {
    const prefix = `--${name}=`;
    const raw = process.argv.find(arg => arg.startsWith(prefix));
    return raw == null ? fallback : raw.slice(prefix.length);
}

function metricDelta(control, treatment) {
    const keys = [
        'averageWelfare', 'averageInflation', 'averageUnrest',
        'activeStates', 'newsCount'
    ];
    const out = {};
    for (const key of keys) {
        out[key] = Math.round((Number(treatment[key]) - Number(control[key])) * 10000) / 10000;
    }
    out.totalResources = {};
    for (const key of ['oil', 'manpower', 'points']) {
        out.totalResources[key] = Math.round(
            (Number(treatment.totalResources[key]) - Number(control.totalResources[key])) * 10000
        ) / 10000;
    }
    return out;
}

function differencePreview(value) {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return { type: 'array', length: value.length };
    const keys = Object.keys(value).sort();
    return {
        type: 'object',
        keyCount: keys.length,
        keys: keys.slice(0, 12),
        schemaVersion: value.schemaVersion == null ? undefined : value.schemaVersion
    };
}

function diffPaths(left, right, pathName = '$', out = []) {
    if (out.length >= 30 || Object.is(left, right)) return out;
    const leftObject = left && typeof left === 'object';
    const rightObject = right && typeof right === 'object';
    if (!leftObject || !rightObject || Array.isArray(left) !== Array.isArray(right)) {
        out.push({ path: pathName, control: differencePreview(left), treatment: differencePreview(right) });
        return out;
    }
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(left, key) || !Object.prototype.hasOwnProperty.call(right, key)) {
            out.push({
                path: `${pathName}.${key}`,
                control: differencePreview(left[key]),
                treatment: differencePreview(right[key])
            });
        } else {
            diffPaths(left[key], right[key], `${pathName}.${key}`, out);
        }
        if (out.length >= 30) break;
    }
    return out;
}

function compactRegionalProbe(seed) {
    const probe = probeRegionalEconomy(seed);
    return {
        main: {
            initialSummary: probe.main.initialSummary,
            finalSummary: probe.main.finalSummary,
            tick: probe.main.tick,
            validation: probe.main.validation,
            worldValidation: probe.main.worldValidation,
            stockConservationDelta: probe.main.stockConservationDelta,
            legacyResourcesPreserved: probe.main.legacyResourcesPreserved,
            ownStocksStatus: probe.main.ownDossier.facts.stocks.status,
            foreignStocksStatus: probe.main.foreignDossier.facts.stocks.status,
            capsuleValidation: probe.main.capsuleValidation,
            capsuleStocksMatch: probe.main.capsuleStocksMatch,
            invalid: probe.main.invalid
        },
        atomic: {
            validCommit: probe.atomic.validCommit,
            tamperedCommit: probe.atomic.tamperedCommit,
            tamperAtomic: probe.atomic.tamperAtomic,
            staleCommit: probe.atomic.staleCommit,
            staleAtomic: probe.atomic.staleAtomic,
            allocation: probe.atomic.allocation,
            shortageLifecycle: {
                active: probe.atomic.priorityFinal.shortages[0],
                resolved: probe.atomic.resolvedShortage
            }
        },
        restored: {
            loaded: probe.restored.loaded,
            validation: probe.restored.validation,
            exactLedger: probe.restored.exactLedger,
            resourcesPreserved: probe.restored.resourcesPreserved
        },
        legacy: {
            loaded: probe.legacy.loaded,
            validation: probe.legacy.validation,
            diagnostics: probe.legacy.ledger.diagnostics,
            resourcesPreserved: probe.legacy.resourcesPreserved
        },
        corrupt: {
            loaded: probe.corrupt.loaded,
            validation: probe.corrupt.validation,
            diagnostics: probe.corrupt.ledger.diagnostics,
            resourcesPreserved: probe.corrupt.resourcesPreserved
        },
        disabled: probe.disabled,
        ab: probe.ab
    };
}

function compactTradeProbe(seed) {
    const probe = probeTradeLogistics(seed);
    return {
        main: {
            validation: probe.main.validation,
            sourceDebit: probe.main.sourceAfterDispatch - probe.main.sourceBefore,
            targetAtDispatch: probe.main.targetAfterDispatch - probe.main.targetBefore,
            targetWhileHeld: probe.main.targetWhileHeld - probe.main.targetBefore,
            targetAtDelivery: probe.main.targetAfterDelivery - probe.main.targetBefore,
            heldStatus: probe.main.heldShipment.status,
            deliveredStatus: probe.main.deliveredShipment.status,
            interruptionSeconds: probe.main.deliveredShipment.interruptionSeconds,
            redirectAccepted: probe.main.redirect.ok,
            redirectStatus: probe.main.redirectedShipment.status,
            redirectOldTargetDelta: probe.main.oldTargetAfterRedirect - probe.main.oldTargetBeforeRedirect,
            redirectNewTargetDelta: probe.main.alternateAfterRedirect - probe.main.alternateBeforeRedirect,
            sharedCapacity: probe.main.sharedCapacity,
            secondCapacityResult: probe.main.capacityDispatchB.code,
            borderTitle: {
                seller: probe.main.borderSourceCountryId,
                buyer: probe.main.borderTargetCountryId,
                before: probe.main.borderTitleBefore,
                after: probe.main.borderDelivered.titleOwnerCountryId
            },
            ownTradeStatus: probe.main.ownDossier.facts.trade.status,
            foreignTradeStatus: probe.main.foreignDossier.facts.trade.status,
            invalid: Object.fromEntries(Object.entries(probe.main.invalid).map(
                ([key, result]) => [key, result.issues.map(issue => issue.code)]
            ))
        },
        restored: {
            loaded: probe.restored.loaded,
            validation: probe.restored.validation,
            exactLedger: probe.restored.exactLedger,
            regionalUnchanged: probe.restored.regionalUnchanged
        },
        legacy: {
            loaded: probe.legacy.loaded,
            validation: probe.legacy.validation,
            diagnostics: probe.legacy.ledger.diagnostics,
            regionalUnchanged: probe.legacy.regionalUnchanged
        },
        corrupt: {
            loaded: probe.corrupt.loaded,
            validation: probe.corrupt.validation,
            diagnostics: probe.corrupt.ledger.diagnostics,
            regionalUnchanged: probe.corrupt.regionalUnchanged
        },
        disabled: probe.disabled,
        ab: probe.ab
    };
}

function compactMarketProbe(seed) {
    const probe = probeMarketPrices(seed);
    return {
        main: {
            validation: probe.main.validation,
            worldValidation: probe.main.worldValidation,
            summary: probe.main.summary,
            indicativeQuote: probe.main.indicativeQuote,
            routeRiskIntegrated: probe.main.routeRiskIntegrated,
            readOnly: probe.main.readOnly,
            alternating: probe.main.alternating,
            zeroStock: probe.main.zeroStock,
            surplus: probe.main.surplus,
            labor: probe.main.labor,
            capital: probe.main.capital,
            ownMarketStatus: probe.main.ownMarketFact.status,
            foreignMarketStatus: probe.main.foreignMarketFact.status,
            invalid: Object.fromEntries(Object.entries(probe.main.invalid).map(
                ([key, result]) => [key, result.issues.map(issue => issue.code)]
            ))
        },
        restored: probe.restored,
        legacy: {
            loaded: probe.legacy.loaded,
            validation: probe.legacy.validation,
            diagnostics: probe.legacy.ledger.diagnostics,
            regionalUnchanged: probe.legacy.regionalUnchanged,
            tradeUnchanged: probe.legacy.tradeUnchanged
        },
        corrupt: {
            loaded: probe.corrupt.loaded,
            validation: probe.corrupt.validation,
            diagnostics: probe.corrupt.ledger.diagnostics,
            regionalUnchanged: probe.corrupt.regionalUnchanged,
            tradeUnchanged: probe.corrupt.tradeUnchanged
        },
        disabled: probe.disabled,
        ab: probe.ab
    };
}

function compactBudgetProbe(seed) {
    const probe = probeStateBudget(seed);
    return {
        main: {
            opening: probe.main.opening,
            debit: probe.main.debit,
            afterDebit: probe.main.afterDebit,
            credit: probe.main.credit,
            afterCredit: probe.main.afterCredit,
            rejected: probe.main.rejected,
            rejectedAtomic: probe.main.rejectedAtomic,
            debt: probe.main.debt,
            afterDebt: probe.main.afterDebt,
            issuance: probe.main.issuance,
            afterIssuance: probe.main.afterIssuance,
            inflationBeforePrint: probe.main.inflationBeforePrint,
            inflationAfterPrint: probe.main.inflationAfterPrint,
            confidenceBeforePrint: probe.main.confidenceBeforePrint,
            confidenceAfterPrint: probe.main.confidenceAfterPrint,
            validation: probe.main.validation,
            invalid: Object.fromEntries(Object.entries(probe.main.invalid).map(
                ([key, result]) => [key, result.issues.map(issue => issue.code)]
            )),
            ownBudgetStatus: probe.main.ownBudgetFact.status,
            foreignBudgetStatus: probe.main.foreignBudgetFact.status
        },
        restored: probe.restored,
        legacy: probe.legacy,
        disabled: probe.disabled,
        ab: probe.ab
    };
}

function compactCompanyProbe(seed) {
    const probe = probeCompaniesBanks(seed);
    return {
        main: {
            opening: probe.main.opening,
            validation: probe.main.validation,
            loan: {
                ok: probe.main.loan.ok,
                companyBefore: probe.main.companyBeforeLoan,
                companyAfter: probe.main.companyAfterLoan,
                bankBefore: probe.main.bankBeforeLoan,
                bankAfter: probe.main.bankAfterLoan
            },
            investment: {
                result: probe.main.investment,
                capacityBefore: probe.main.capacityBefore,
                capacityDuring: probe.main.capacityDuring,
                capacityAfter: probe.main.capacityAfter,
                stockBefore: probe.main.stockBeforeInvestment,
                stockAfter: probe.main.stockAfterInvestment,
                completedProject: probe.main.completedProject
            },
            application: {
                premature: probe.main.prematureRegistration,
                funding: probe.main.funding,
                stillPremature: probe.main.stillPremature,
                license: probe.main.license,
                registration: probe.main.registration,
                countBefore: probe.main.countBeforeApplication,
                countAfter: probe.main.countAfterApplication
            },
            lobby: probe.main.lobby,
            ownCompanyStatus: probe.main.ownCompanyFact.status,
            foreignCompanyStatus: probe.main.foreignCompanyFact.status,
            invalid: Object.fromEntries(Object.entries(probe.main.invalid).map(
                ([key, result]) => [key, result.issues.map(issue => issue.code)]
            ))
        },
        restored: probe.restored,
        legacy: probe.legacy,
        corrupt: probe.corrupt,
        disabled: probe.disabled,
        ab: probe.ab
    };
}

function compactEconomicAIProbe(seed) {
    const probe = probeEconomicAI(seed);
    return {
        main: {
            summary: probe.main.summary,
            companySummary: probe.main.companySummary,
            validation: probe.main.validation,
            companyValidation: probe.main.companyValidation,
            budgetValidation: probe.main.budgetValidation,
            regionalValidation: probe.main.regionalValidation,
            firstApplied: probe.main.firstApplied,
            appliedCount: probe.main.appliedCount,
            companyAppliedCount: probe.main.companyAppliedCount,
            playerStateAutonomousCount: probe.main.playerStateAutonomousCount,
            ownPolicyStatus: probe.main.ownPolicyFact.status,
            foreignPolicyStatus: probe.main.foreignPolicyFact.status,
            invalid: Object.fromEntries(Object.entries(probe.main.invalid).map(
                ([key, result]) => [key, result.issues.map(issue => issue.code)]
            ))
        },
        stateGrant: probe.stateGrant,
        restored: probe.restored,
        legacy: probe.legacy,
        corrupt: probe.corrupt,
        disabled: probe.disabled,
        ab: probe.ab
    };
}

function targetedProbeFor(flag, seed) {
    if (flag === 'welfare.continuousCap') {
        return {
            control: probeWelfareGate(seed, { [flag]: false }),
            treatment: probeWelfareGate(seed, { [flag]: true })
        };
    }
    if (flag === 'render.imageDataPoliticalOverlay') return probePoliticalOverlay(seed);
    if (flag === 'world.prebuiltMapRaster') return probePrebuiltMapRaster(seed);
    if (flag === 'render.adaptiveMapWarp') return probeAdaptiveMapWarp(seed);
    if (flag === 'render.mapCacheInvalidation') return probeMapCacheInvalidation(seed);
    if (flag === 'economy.resourceTaxonomy') return probeResourceTaxonomy(seed);
    if (flag === 'economy.productionSectors') return probeProductionSectors(seed);
    if (flag === 'economy.regionalStocks') return compactRegionalProbe(seed);
    if (flag === 'economy.tradeLogistics') return compactTradeProbe(seed);
    if (flag === 'economy.marketPrices') return compactMarketProbe(seed);
    if (flag === 'economy.stateBudget') return compactBudgetProbe(seed);
    if (flag === 'economy.companiesBanks') return compactCompanyProbe(seed);
    if (flag === 'economy.economicAI') return compactEconomicAIProbe(seed);
    if (flag === 'population.cohorts') return probePopulationCohorts(seed);
    if (flag === 'population.needsWelfare') return probeNeedsWelfare(seed);
    if (flag === 'society.publicOpinionMemory') return probePublicOpinion(seed);
    if (flag === 'society.collectiveAction') return probeCollectiveAction(seed);
    if (flag === 'population.humanMigration') return probeHumanMigration(seed);
    if (flag === 'society.powerCenters') return probePowerCenters(seed);
    if (flag === 'government.institutionsAuthority') return probeInstitutions(seed);
    if (flag === 'government.stateCapacity') {
        const probe = probeStateCapacity(seed);
        return {
            main: {
                validation: probe.main.validation,
                summary: probe.main.summary,
                normal: probe.main.normalTicket,
                degraded: probe.main.degradedTicket,
                paperOnly: probe.main.lowFinished,
                capacityContrast: probe.main.capacityContrast,
                worldValidation: probe.main.worldValidation,
                worldTicketCount: probe.main.worldTicketCount,
                foreignSecretsHidden: probe.main.foreignSecretsHidden,
                projectionReadOnly: probe.main.projectionReadOnly,
                ui: probe.main.ui,
                saveOk: probe.main.saveOk,
                savedExact: probe.main.savedExact,
                migration: probe.main.migration
            },
            restored: probe.restored,
            legacy: {
                validation: probe.legacy.validation,
                diagnostics: probe.legacy.diagnostics,
                summary: probe.legacy.summary
            },
            corrupt: probe.corrupt,
            disabled: probe.disabled,
            prerequisiteDisabled: probe.prerequisiteDisabled
        };
    }
    if (flag === 'diplomacy.peacefulStart') return probePeacefulDiplomacy(seed);
    return null;
}

const seed = numberArg('seed', 2032);
const seconds = numberArg('seconds', 900);
const flag = stringArg('flag', 'welfare.continuousCap');
const output = path.resolve(
    process.cwd(),
    stringArg('output', 'qa-runtime/story-ab-report.json')
);

const control = runStorySimulation({
    seed,
    seconds,
    includeTradeProductionOpportunityView: true,
    featureFlags: { [flag]: false }
});
const treatment = runStorySimulation({
    seed,
    seconds,
    includeTradeProductionOpportunityView: true,
    featureFlags: { [flag]: true }
});
const report = {
    schemaVersion: 1,
    seed,
    seconds,
    flag,
    control: {
        enabled: false,
        featureFlags: control.telemetry.meta.featureFlags,
        stateHash: control.stateHash,
        final: control.final,
        regionalSummary: control.regionalSummary,
        populationSummary: control.populationSummary,
        needsSummary: control.needsSummary,
        opinionSummary: control.opinionSummary,
        opinionValidation: control.opinionValidation,
        collectiveSummary: control.collectiveSummary,
        collectiveValidation: control.collectiveValidation,
        humanMigrationSummary: control.humanMigrationSummary,
        humanMigrationValidation: control.humanMigrationValidation,
        powerCenterSummary: control.powerCenterSummary,
        powerCenterValidation: control.powerCenterValidation,
        institutionSummary: control.institutionSummary,
        institutionValidation: control.institutionValidation,
        stateCapacitySummary: control.stateCapacitySummary,
        stateCapacityValidation: control.stateCapacityValidation,
        tradeSummary: control.tradeSummary,
        tradeProductionOpportunityView: control.tradeProductionOpportunityView,
        tradeProductionAdmissionPlan: control.tradeProductionAdmissionPlan,
        tradeDecisionObserverNeutral: control.tradeDecisionObserverNeutral,
        marketSummary: control.marketSummary,
        budgetSummary: control.budgetSummary,
        companySummary: control.companySummary,
        economicAISummary: control.economicAISummary,
        telemetryCounters: control.telemetry.counters,
        welfareSuppressed: Object.values(control.telemetry.welfareTotals || {})
            .reduce((sum, row) => sum + (Number(row.suppressed) || 0), 0)
    },
    treatment: {
        enabled: true,
        featureFlags: treatment.telemetry.meta.featureFlags,
        stateHash: treatment.stateHash,
        final: treatment.final,
        regionalSummary: treatment.regionalSummary,
        populationSummary: treatment.populationSummary,
        needsSummary: treatment.needsSummary,
        opinionSummary: treatment.opinionSummary,
        opinionValidation: treatment.opinionValidation,
        collectiveSummary: treatment.collectiveSummary,
        collectiveValidation: treatment.collectiveValidation,
        humanMigrationSummary: treatment.humanMigrationSummary,
        humanMigrationValidation: treatment.humanMigrationValidation,
        powerCenterSummary: treatment.powerCenterSummary,
        powerCenterValidation: treatment.powerCenterValidation,
        institutionSummary: treatment.institutionSummary,
        institutionValidation: treatment.institutionValidation,
        stateCapacitySummary: treatment.stateCapacitySummary,
        stateCapacityValidation: treatment.stateCapacityValidation,
        tradeSummary: treatment.tradeSummary,
        tradeProductionOpportunityView: treatment.tradeProductionOpportunityView,
        tradeProductionAdmissionPlan: treatment.tradeProductionAdmissionPlan,
        tradeDecisionObserverNeutral: treatment.tradeDecisionObserverNeutral,
        marketSummary: treatment.marketSummary,
        budgetSummary: treatment.budgetSummary,
        companySummary: treatment.companySummary,
        economicAISummary: treatment.economicAISummary,
        telemetryCounters: treatment.telemetry.counters,
        welfareSuppressed: Object.values(treatment.telemetry.welfareTotals || {})
            .reduce((sum, row) => sum + (Number(row.suppressed) || 0), 0)
    },
    changedWorldState: control.stateHash !== treatment.stateHash,
    firstStateDifferences: diffPaths(control.snapshot, treatment.snapshot),
    delta: metricDelta(control.final, treatment.final),
    targetedProbe: targetedProbeFor(flag, seed)
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Hikâye A/B raporu yazıldı: ${output}`);
console.log(JSON.stringify(report, null, 2));
