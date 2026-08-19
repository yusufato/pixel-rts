'use strict';

const assert = require('assert');
const construction = require('../js/StoryHexConstruction.js');

const world = {
    cellCount: 6,
    qValues: Int16Array.from([0, 1, 2, 3, 4, 5]),
    rValues: Int16Array.from([0, 0, 0, 0, 0, 0])
};
const geography = {
    regionIds: Int16Array.from([0, 0, 0, 1, 0, 0]),
    landCoverageBps: Uint16Array.from([10000, 10000, 0, 10000, 10000, 10000]),
    terrainClass: Uint8Array.from([1, 1, 0, 1, 3, 1])
};
const natural = {
    coverCodes: Uint8Array.from([2, 2, 0, 2, 4, 3]),
    deposits: [{ id: 'deposit:iron:1', cellIndex: 1 }]
};
const sites = { landUseByCellId: { 'hex:0:0': { activeUse: 'CIVIC' } } };
const root = {};

const base = {
    projectType: 'INDUSTRIAL', regionId: 'region:0', targetCellId: 'hex:5:0',
    applicantActorId: 'actor:1', companyId: 'company:1', countryId: 'country:0',
    landAcquisition: { mode: 'PURCHASE', evidenceId: 'deed:1', cost: 20 },
    permission: { approved: true, authorityActorId: 'actor:mayor', institutionId: 'city:0', decisionId: 'decision:1' },
    resourceReservation: { id: 'reservation:1', cash: 180, workforce: 120,
        materials: { raw_materials: 30, industrial_parts: 24, electronics: 2 } },
    environmentalAssessmentId: 'assessment:1',
    environmentalMitigation: { id: 'mitigation:1', restorationBudget: 12 }
};
const options = { root, world, geography, natural, sites, clock: 10 };

const valid = construction.storyHexConstructionPreflight(base, options);
assert.strictEqual(valid.ok, true, valid.blockReasons.join(','));
assert.strictEqual(valid.targetCellIndex, 5);
assert.strictEqual(valid.requirements.durationDays, 180);
assert.strictEqual(root.hexConstruction, undefined, 'önizleme kalıcı dünyayı değiştirmemeli');

for (const [targetCellId, code] of [
    ['hex:0:0', 'TARGET_OCCUPIED'],
    ['hex:1:0', 'RESOURCE_DEPOSIT_CONFLICT'],
    ['hex:2:0', 'TARGET_NOT_LAND'],
    ['hex:3:0', 'TARGET_REGION_MISMATCH'],
    ['hex:4:0', 'TARGET_IMPASSABLE']
]) {
    const result = construction.storyHexConstructionPreflight(
        Object.assign({}, base, { targetCellId }), options);
    assert(result.blockReasons.includes(code), `${targetCellId} ${code} ile reddedilmeli`);
}

const missingEvidence = Object.assign({}, base, {
    projectType: 'RESIDENTIAL',
    permission: {}, resourceReservation: {}, landAcquisition: {}
});
const submittedBlocked = construction.storyHexConstructionSubmit(missingEvidence, options);
assert.strictEqual(submittedBlocked.ok, true);
assert.strictEqual(submittedBlocked.command.status, 'AWAITING_REQUIREMENTS');
assert(submittedBlocked.command.blockReasons.includes('AUTHORITY_APPROVAL_REQUIRED'));

const refreshed = construction.storyHexConstructionRefresh(
    submittedBlocked.command.id,
    { permission: base.permission, resourceReservation: base.resourceReservation,
        landAcquisition: base.landAcquisition }, options);
assert.strictEqual(refreshed.ok, true);
assert.strictEqual(refreshed.command.status, 'AUTHORIZED');

const started = construction.storyHexConstructionStart(submittedBlocked.command.id,
    Object.assign({}, options, { clock: 20 }));
assert.strictEqual(started.ok, true);
assert.strictEqual(started.command.status, 'BUILDING');
assert.strictEqual(started.command.startedAt, 20);

const half = construction.storyHexConstructionTick(90,
    Object.assign({}, options, { clock: 30 }));
assert.strictEqual(half.completed.length, 0);
assert.strictEqual(root.hexConstruction.commands[0].remainingDays, 30);
const finished = construction.storyHexConstructionTick(90,
    Object.assign({}, options, { clock: 40 }));
assert.strictEqual(finished.completed.length, 1);
assert.strictEqual(root.hexConstruction.commands[0].status, 'COMPLETED');
assert.strictEqual(finished.completed[0].targetCellId, 'hex:5:0');
assert.strictEqual(finished.completed[0].permissionDecisionId, 'decision:1');
assert.strictEqual(finished.completed[0].consumed.materials.industrial_parts, 24);
assert.strictEqual(construction.storyHexConstructionRegionCapacity('region:0', root).residential, 1);
assert.strictEqual(construction.storyHexConstructionHousingPopulationCap('region:0', 140, root), 145);

const saved = construction.storyHexConstructionForSave(root);
const restoredRoot = {};
assert.strictEqual(construction.storyHexConstructionRestore(saved, restoredRoot).ok, true);
assert.deepStrictEqual(restoredRoot.hexConstruction, saved,
    'inşaat emri ve tamamlanma makbuzu save/load boyunca kaybolmamalı');
const tamperedCapacitySave = construction.storyHexConstructionForSave(root);
tamperedCapacitySave.commissionedCapacityByRegion['region:0'].residential = 999;
const reconciledRoot = {};
assert.strictEqual(construction.storyHexConstructionRestore(tamperedCapacitySave,
    reconciledRoot).ok, true);
assert.strictEqual(construction.storyHexConstructionRegionCapacity('region:0',
    reconciledRoot).residential, 1,
    'yüklemede kapasite sayacı makbuzdan yeniden türemeli');
const brokenSave = construction.storyHexConstructionForSave(root);
brokenSave.commands.push(Object.assign({}, brokenSave.commands[0], { id: 'duplicate-command' }));
assert.strictEqual(construction.storyHexConstructionRestore(brokenSave, {}).code,
    'CONSTRUCTION_SAVE_CELL_COLLISION');

const duplicate = construction.storyHexConstructionSubmit(base, options);
assert.strictEqual(duplicate.ok, false);
assert.strictEqual(duplicate.code, 'CONSTRUCTION_TARGET_RESERVED');

const cancelRoot = {};
const cancelSubmit = construction.storyHexConstructionSubmit(base,
    Object.assign({}, options, { root: cancelRoot }));
const cancelled = construction.storyHexConstructionCancel(cancelSubmit.command.id,
    'PLAYER_CANCELLED', Object.assign({}, options, { root: cancelRoot, clock: 15 }));
assert.strictEqual(cancelled.ok, true);
assert.strictEqual(cancelled.command.refundStatus, 'RESERVATION_OWNER_ROLLBACK_REQUIRED');
assert.strictEqual(cancelRoot.hexConstruction.receipts.length, 0);

const economyRoot = {};
const economyCompany = { id: 'company:1', countryId: 'country:0',
    sectorId: 'civil_industry', status: 'OPERATING', licenseStatus: 'LICENSED',
    facilityIds: [], accounts: { 'ASSET:CASH': 500, 'ASSET:PROJECT_ESCROW': 0 } };
const economyRegion = { stocks: { raw_materials: 100, industrial_parts: 100,
    electronics: 20 }, sectorCapacity: { civil_industry: 0 } };
const economyLedger = { facilities: {}, companies: { 'company:1': economyCompany },
    marketClearingCash: 0 };
const economy = {
    company: () => economyCompany,
    region: () => economyRegion,
    companyLedger: () => economyLedger,
    availableWorkers: () => 500,
    postCash: (company, postings) => {
        for (const row of postings) company.accounts[row.account]
            = (Number(company.accounts[row.account]) || 0) + row.amount;
        return { ok: true };
    },
    stockDelta: (_regionId, resourceId, amount) => {
        if (economyRegion.stocks[resourceId] + amount < 0) return { ok: false };
        economyRegion.stocks[resourceId] += amount;
        return { ok: true };
    }
};
const reserved = construction.storyHexConstructionReserveAndSubmit(base,
    Object.assign({}, options, { root: economyRoot, economy }));
assert.strictEqual(reserved.ok, true);
assert.strictEqual(reserved.command.resourceReservation.cash, 180);
assert.strictEqual(economyCompany.accounts['ASSET:CASH'], 320);
assert.strictEqual(economyCompany.accounts['ASSET:PROJECT_ESCROW'], 180);
assert.strictEqual(economyRegion.stocks.industrial_parts, 76);
assert.strictEqual(reserved.command.resourceReservation.ownerType, 'COMPANY');
assert.strictEqual(construction.storyHexConstructionStart(reserved.command.id,
    Object.assign({}, options, { root: economyRoot, economy, clock: 20 })).ok, true);
const economicallyFinished = construction.storyHexConstructionTick(180,
    Object.assign({}, options, { root: economyRoot, economy, clock: 200 }));
assert.strictEqual(economicallyFinished.completed.length, 1);
assert.strictEqual(economyCompany.accounts['ASSET:PROJECT_ESCROW'], 0);
assert.strictEqual(economyCompany.accounts['EXPENSE:CAPACITY_INVESTMENT'], 180);
assert.strictEqual(economyLedger.marketClearingCash, 180);
assert.strictEqual(economyCompany.cumulative.investment, 180);
assert.strictEqual(economicallyFinished.completed[0].commissioning.status, 'COMMISSIONED');
assert.strictEqual(economicallyFinished.completed[0].commissioning.sectorId, 'civil_industry');

const industrialRoot = {};
const industrialCompany = { id: 'company:1', countryId: 'country:0',
    sectorId: 'civil_industry', status: 'OPERATING', licenseStatus: 'LICENSED',
    facilityIds: [], accounts: { 'ASSET:CASH': 500, 'ASSET:PROJECT_ESCROW': 0 } };
const industrialRegion = { stocks: { raw_materials: 100, industrial_parts: 100,
    electronics: 20 }, sectorCapacity: { civil_industry: 2 } };
const industrialLedger = { facilities: {}, companies: { 'company:1': industrialCompany } };
const industrialEconomy = Object.assign({}, economy, {
    company: () => industrialCompany, region: () => industrialRegion,
    companyLedger: () => industrialLedger,
    postCash: (company, postings) => {
        for (const row of postings) company.accounts[row.account]
            = (Number(company.accounts[row.account]) || 0) + row.amount;
        return { ok: true };
    },
    stockDelta: (_regionId, resourceId, amount) => {
        industrialRegion.stocks[resourceId] += amount;
        return { ok: true };
    }
});
const industrial = construction.storyHexConstructionReserveAndSubmit(base,
    Object.assign({}, options, { root: industrialRoot, economy: industrialEconomy }));
assert.strictEqual(construction.storyHexConstructionStart(industrial.command.id,
    Object.assign({}, options, { root: industrialRoot, economy: industrialEconomy })).ok, true);
const industrialFinish = construction.storyHexConstructionTick(180,
    Object.assign({}, options, { root: industrialRoot, economy: industrialEconomy, clock: 250 }));
assert.strictEqual(industrialFinish.completed.length, 1);
assert.strictEqual(industrialRegion.sectorCapacity.civil_industry, 3);
assert.strictEqual(industrialLedger.facilities['facility:0:civil_industry'].capacity, 1);
assert(industrialCompany.facilityIds.includes('facility:0:civil_industry'));
assert.strictEqual(construction.storyHexConstructionRegionCapacity('region:0', industrialRoot)
    .industrialBySector.civil_industry, 1);

const refundRoot = {};
const refundCompany = { id: 'company:1', status: 'OPERATING', licenseStatus: 'LICENSED',
    accounts: { 'ASSET:CASH': 500, 'ASSET:PROJECT_ESCROW': 0 } };
const refundRegion = { stocks: { raw_materials: 100, industrial_parts: 100, electronics: 20 } };
const refundEconomy = Object.assign({}, economy, {
    company: () => refundCompany,
    region: () => refundRegion,
    postCash: (company, postings) => {
        for (const row of postings) company.accounts[row.account]
            = (Number(company.accounts[row.account]) || 0) + row.amount;
        return { ok: true };
    },
    stockDelta: (_regionId, resourceId, amount) => {
        refundRegion.stocks[resourceId] += amount;
        return { ok: true };
    }
});
const refundable = construction.storyHexConstructionReserveAndSubmit(base,
    Object.assign({}, options, { root: refundRoot, economy: refundEconomy }));
const refunded = construction.storyHexConstructionCancel(refundable.command.id,
    'PLAYER_CANCELLED', Object.assign({}, options, { root: refundRoot,
        economy: refundEconomy, clock: 22 }));
assert.strictEqual(refunded.ok, true);
assert.strictEqual(refunded.command.refundStatus, 'REFUNDED');
assert.strictEqual(refundCompany.accounts['ASSET:CASH'], 500);
assert.strictEqual(refundRegion.stocks.industrial_parts, 100);

const logisticsRoot = {};
const logisticsSpec = Object.assign({}, base, {
    projectType: 'LOGISTICS',
    resourceReservation: { id: 'reservation:logistics', cash: 140, workforce: 90,
        materials: { raw_materials: 22, industrial_parts: 16, electronics: 1 } }
});
const logistics = construction.storyHexConstructionSubmit(logisticsSpec,
    Object.assign({}, options, { root: logisticsRoot }));
assert.strictEqual(logistics.ok, true);
assert.strictEqual(construction.storyHexConstructionStart(logistics.command.id,
    Object.assign({}, options, { root: logisticsRoot })).ok, true);
assert.strictEqual(construction.storyHexConstructionTick(150,
    Object.assign({}, options, { root: logisticsRoot, clock: 180 })).completed.length, 1);
assert.strictEqual(construction.storyHexConstructionRegionCapacity('region:0', logisticsRoot)
    .logistics, 1);

console.log('story-hex-construction: OK', JSON.stringify({
    commands: root.hexConstruction.commands.length,
    receipts: root.hexConstruction.receipts.length,
    adapterVersion: construction.STORY_HEX_CONSTRUCTION_ADAPTER_VERSION
}));
