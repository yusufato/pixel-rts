'use strict';

const assert = require('node:assert/strict');
const { createRuntime } = require('../tools/story-sim-harness');

function configureRole(runtime, role) {
    const story = runtime.api.state();
    story.commander.creationRole = role;
    story.playerRole = role;
    story.commander.res.points = 10000;
    story.commander.res.manpower = 10000;
    runtime.api.characterBindPlayerRole();
    if (role === 'COMMANDER') story.commander.skills.warrior = 999;
    runtime.api.institutionTick(5);
    return story;
}

function executeFamily(runtime, familyId, input = {}) {
    const family = runtime.api.playerAgencyView().find(row => row.id === familyId);
    assert.ok(family, `${familyId}: family view missing`);
    const action = family.actions[0];
    assert.ok(action, `${familyId}: action missing`);
    assert.equal(action.allowed, true, `${familyId}: ${JSON.stringify(action.reasons)}`);
    const result = runtime.api.playerAgencyExecute(familyId, action.actionId, input);
    assert.equal(result.ok, true, `${familyId}: ${result.code || JSON.stringify(result.result)}`);
    assert.equal(result.receipt.worldMutation, true, `${familyId}: physical mutation receipt missing`);
    assert.ok(result.receipt.canonicalReceipt && result.receipt.canonicalReceipt.ledger,
        `${familyId}: canonical domain ledger missing`);
    return result.receipt;
}

const expectedFamilies = [
    'TRADE', 'PRODUCTION', 'MARKET', 'INVESTMENT', 'COMPANY', 'BANKING', 'BUDGET',
    'INFRASTRUCTURE', 'MIGRATION', 'LABOR', 'POWER_CENTERS', 'INSTITUTIONS', 'ELECTIONS',
    'INVESTIGATIONS', 'DIPLOMACY', 'MEDIA', 'MILITARY_STRATEGY', 'TECHNOLOGY'
];
const executed = new Set();
let savedRaw;

const executive = createRuntime(62001);
try {
    executive.api.newCampaign({ seed: 62001, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
    const story = configureRole(executive, 'EXECUTIVE');
    const acceptance = executive.api.playerAgencyAcceptance();
    assert.equal(acceptance.total, 18);
    assert.equal(acceptance.actionable, 18);
    assert.equal(acceptance.closed, true);
    assert.deepEqual(Array.from(acceptance.missing), []);
    assert.deepEqual(Array.from(acceptance.families, row => row.id).sort(), expectedFamilies.slice().sort());

    const html = executive.api.governanceHtml();
    assert.match(html.text, /OYUNCU EYLEM ALANLARI - 18 SISTEM/);
    assert.match(html.text, /Ticaret/);
    assert.match(html.text, /Teknoloji ve AR-GE/);

    const deniedBefore = executive.api.playerAgencyLedger().receipts.length;
    const denied = executive.api.playerAgencyExecute('MILITARY_STRATEGY', 'MOBILIZE_RESERVE', {});
    assert.equal(denied.ok, false, 'Executive must not inherit armed-forces authority.');
    assert.equal(executive.api.playerAgencyLedger().receipts.length, deniedBefore,
        'Denied action must not write a success receipt.');

    const eligibleNode = story.nodes.find(row => Number(row.owner) === 0);
    eligibleNode.level = 1;
    for (const familyId of [
        'TRADE', 'PRODUCTION', 'MARKET', 'INVESTMENT', 'BUDGET', 'INFRASTRUCTURE',
        'MIGRATION', 'LABOR', 'POWER_CENTERS', 'ELECTIONS', 'INVESTIGATIONS',
        'DIPLOMACY', 'MEDIA', 'TECHNOLOGY'
    ]) {
        const receipt = executeFamily(executive, familyId);
        if (familyId === 'MARKET' || familyId === 'LABOR') {
            assert.notEqual(receipt.canonicalReceipt.before, receipt.canonicalReceipt.after,
                `${familyId}: default UI command must change the domain state.`);
        }
        executed.add(familyId);
    }
    executeFamily(executive, 'INSTITUTIONS');
    executed.add('INSTITUTIONS');
    assert.equal(executive.api.playerAgencyLedger().receipts.length, 15);
    assert.equal(executive.api.validatePlayerAgencyLedger(executive.api.playerAgencyLedger()).ok, true);
    executive.api.saveNow();
    assert.equal(story._lastSaveOk, true);
    savedRaw = executive.api.savedRaw();
} finally {
    executive.dom.window.close();
}

const restored = createRuntime(62001);
try {
    restored.api.putSavedRaw(savedRaw);
    assert.equal(restored.api.loadNow(), true);
    assert.equal(restored.api.playerAgencyLedger().receipts.length, 15);
    assert.equal(restored.api.validatePlayerAgencyLedger(restored.api.playerAgencyLedger()).ok, true);
} finally {
    restored.dom.window.close();
}

const company = createRuntime(62002);
try {
    company.api.newCampaign({ seed: 62002, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
    const story = configureRole(company, 'COMPANY_OWNER');
    const identity = company.api.characterIdentityView(`character:0:${story.commander.id}`);
    assert.equal(identity.role, 'COMPANY_OWNER');
    assert.ok(identity.organizationId, 'Company owner must retain canonical organization authority.');
    executeFamily(company, 'COMPANY');
    executeFamily(company, 'BANKING');
    executed.add('COMPANY');
    executed.add('BANKING');
} finally {
    company.dom.window.close();
}

const commander = createRuntime(62003);
try {
    commander.api.newCampaign({ seed: 62003, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
    configureRole(commander, 'COMMANDER');
    const view = commander.api.governanceView();
    assert.ok(view.heldInstitutions.some(row => row.type === 'ARMED_FORCES'),
        'Commander fixture must physically hold armed-forces authority.');
    executeFamily(commander, 'MILITARY_STRATEGY');
    executed.add('MILITARY_STRATEGY');
} finally {
    commander.dom.window.close();
}

assert.deepEqual(Array.from(executed).sort(), expectedFamilies.slice().sort(),
    'Every one of the 18 system families must complete one real, role-authorized mutation.');
console.log('story-player-agency: 18/18 role-authorized mutations and persistence OK');