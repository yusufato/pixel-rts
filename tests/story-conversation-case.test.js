'use strict';

const assert = require('node:assert/strict');
const { createRuntime } = require('../tools/story-sim-harness');

function firstDifference(left, right, path = '$') {
    if (Object.is(left, right)) return null;
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object') {
        return { path, left, right };
    }
    const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort();
    for (const key of keys) {
        const difference = firstDifference(left[key], right[key], `${path}.${key}`);
        if (difference) return difference;
    }
    return null;
}

function verifyInstitutionalTaskOfferDecisions() {
    const taskRuntime = createRuntime(3813002);
    try {
        taskRuntime.api.newCampaign({ seed: 3813002, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
        const taskStory = taskRuntime.api.state();
        const taskDirectory = taskRuntime.api.contactDirectoryBuild();
        const country = taskRuntime.api.institutionLedger().countries['country:0'];
        const armedForces = Object.values(country.institutions).find(row => row.type === 'ARMED_FORCES');
        const issuerActorId = armedForces.officeHolder.actorId;
        const payerCommanderId = issuerActorId.split(':').pop();
        const payerCommander = taskStory.states[0].gov.commanders.find(row => String(row.id) === payerCommanderId);
        assert.ok(payerCommander && taskDirectory.publicCharacters.some(row => row.id === issuerActorId && row.contactable),
            'The institutional issuer must be both the canonical armed-forces holder and a contactable commander.');

        const openTaskSession = listenerActorId => {
            const openedTask = taskRuntime.api.conversationSessionBegin('Merhaba.', { listenerActorId });
            assert.equal(openedTask.ok, true);
            assert.equal(taskRuntime.api.conversationSessionSetMode(openedTask.session.id, 'TASKS_JOBS').ok, true);
            return openedTask.session.id;
        };

        const acceptedSessionId = openTaskSession(issuerActorId);
        const authorityPreview = taskRuntime.api.conversationInstitutionalTaskOfferPreview(acceptedSessionId);
        assert.equal(authorityPreview.ok, true);
        assert.equal(authorityPreview.preview.institutionId, armedForces.id);
        assert.equal(authorityPreview.preview.payerCommanderId, payerCommanderId);
        assert.equal(authorityPreview.preview.payerSufficient, true);
        taskRuntime.api.talkBind();
        taskRuntime.dom.window.storyConversationWorkspaceOpen(
            issuerActorId, armedForces.officeHolder.name, acceptedSessionId);
        assert.ok(taskRuntime.dom.window.document.querySelector('[data-conversation-task-create]'));
        const institutionalCreateButton = taskRuntime.dom.window.document.querySelector(
            '[data-conversation-institutional-task-create]');
        assert.ok(institutionalCreateButton);
        institutionalCreateButton.click();
        assert.equal(taskRuntime.api.conversationTaskOfferList(acceptedSessionId)[0].kind,
            'INSTITUTIONAL_PAID_CONTACT_TASK');
        taskRuntime.dom.window.storyConversationWorkspaceClose();
        const payerBefore = payerCommander.res.points;
        const escrowBefore = taskRuntime.api.budgetLedger().countries['country:0'].accounts['ASSET:TASK_ESCROW'];
        const created = taskRuntime.api.conversationInstitutionalTaskOfferCreate(acceptedSessionId);
        assert.equal(created.ok, true);
        assert.equal(created.taskOffer.kind, 'INSTITUTIONAL_PAID_CONTACT_TASK');
        taskRuntime.dom.window.storyConversationWorkspaceOpen(
            issuerActorId, armedForces.officeHolder.name, acceptedSessionId);
        const institutionalCard = taskRuntime.dom.window.document.querySelector(
            '[data-task-offer-kind="INSTITUTIONAL_PAID_CONTACT_TASK"]');
        assert.ok(institutionalCard);
        assert.match(institutionalCard.textContent, /KURUMSAL GÖREV/);
        assert.match(institutionalCard.textContent, /25 DEVLET KREDİSİ/);
        assert.match(institutionalCard.textContent, /ANAYASAL GÖREV İHALE YETKİSİ/);
        assert.doesNotMatch(institutionalCard.textContent, /payerCommanderId|payeeCommanderId|budget-settlement/);
        taskRuntime.dom.window.storyConversationWorkspaceClose();
        const institutionRequest = taskRuntime.api.institutionLedger().requests[created.taskOffer.authority.institutionRequestId];
        assert.equal(institutionRequest.status, 'EXECUTED');
        assert.equal(institutionRequest.proposer.actorId, issuerActorId);
        const duplicatePersonal = taskRuntime.api.conversationTaskOfferCreate(acceptedSessionId);
        assert.equal(duplicatePersonal.code, 'TASK_OFFER_ALREADY_OPEN');
        assert.equal(duplicatePersonal.taskOffer.id, created.taskOffer.id);
        const accepted = taskRuntime.api.conversationTaskOfferDecision(created.taskOffer.id, 'ACCEPT');
        assert.equal(accepted.ok, true);
        assert.equal(accepted.taskOffer.status, 'ACCEPTED');
        assert.equal(accepted.taskOffer.institutional.paymentStatus, 'RESERVED');
        assert.equal(payerCommander.res.points, payerBefore - 25);
        assert.equal(taskRuntime.api.budgetLedger().countries['country:0'].accounts['ASSET:TASK_ESCROW'], escrowBefore + 25);
        const doubleAcceptBefore = JSON.stringify({
            conversation: taskRuntime.api.conversationSessionSnapshot(), budget: taskRuntime.api.budgetLedger()
        });
        const doubleAccept = taskRuntime.api.conversationTaskOfferDecision(created.taskOffer.id, 'ACCEPT');
        assert.equal(doubleAccept.ok, false);
        assert.equal(doubleAccept.code, 'TASK_OFFER_NOT_OPEN');
        assert.equal(JSON.stringify({
            conversation: taskRuntime.api.conversationSessionSnapshot(), budget: taskRuntime.api.budgetLedger()
        }), doubleAcceptBefore, 'Double accept must not mutate the task or budget ledgers.');
        const playerPointsBeforeCompletion = taskStory.commander.res.points;
        const institutionalReverseBefore = JSON.stringify(taskRuntime.api.relationshipView(
            accepted.taskOffer.assigneeActorId, accepted.taskOffer.issuerActorId
        ));
        const completion = taskRuntime.api.conversationSessionBegin('G�rev g�r�_mesini tamamlamak i�in geldim.', {
            listenerActorId: created.taskOffer.objective.targetActorId
        });
        assert.equal(completion.ok, true);
        const completedInstitutional = taskRuntime.api.conversationTaskOfferList(acceptedSessionId)
            .find(row => row.id === created.taskOffer.id);
        assert.equal(completedInstitutional.status, 'COMPLETED');
        assert.equal(completedInstitutional.institutional.paymentStatus, 'SETTLED');
        assert.equal(taskStory.commander.res.points, playerPointsBeforeCompletion + 25);
        const resultReceipt = completedInstitutional.institutional.resultReceipt;
        assert.equal(resultReceipt.schemaVersion, 1);
        assert.equal(resultReceipt.completionSessionId, completion.session.id);
        assert.equal(resultReceipt.institutionRequestId, institutionRequest.id);
        assert.equal(completedInstitutional.relationshipResultReceiptId,
            completedInstitutional.institutional.relationshipResultReceiptId);
        assert.equal(resultReceipt.relationshipResultReceiptId,
            completedInstitutional.relationshipResultReceiptId);
        const institutionalRelationshipReceipt = taskRuntime.api.relationshipResultReceipt(
            completedInstitutional.relationshipResultReceiptId
        );
        assert.equal(institutionalRelationshipReceipt.interpretationType, 'TASK_COMMITMENT_KEPT');
        assert.equal(institutionalRelationshipReceipt.fromActorId, completedInstitutional.issuerActorId);
        assert.equal(institutionalRelationshipReceipt.toActorId, completedInstitutional.assigneeActorId);
        assert.equal(JSON.stringify(taskRuntime.api.relationshipView(
            completedInstitutional.assigneeActorId, completedInstitutional.issuerActorId
        )), institutionalReverseBefore);
        const settledPayment = taskRuntime.api.budgetLedger().settlements.find(row =>
            row.id === completedInstitutional.institutional.escrowReservationId);
        assert.equal(settledPayment.status, 'SETTLED');
        assert.equal(resultReceipt.payerTransactionId, settledPayment.payerTransactionId);
        assert.equal(resultReceipt.payeeTransactionId, settledPayment.payeeTransactionId);
        taskRuntime.dom.window.storyConversationWorkspaceOpen(
            issuerActorId, armedForces.officeHolder.name, acceptedSessionId);
        const completedInstitutionalCard = taskRuntime.dom.window.document.querySelector(
            '[data-task-offer-kind="INSTITUTIONAL_PAID_CONTACT_TASK"]');
        assert.match(completedInstitutionalCard.textContent, /ÖDEME MAKBUZU DOĞRULANDI/);
        assert.doesNotMatch(completedInstitutionalCard.textContent, /budget:/);
        taskRuntime.dom.window.storyConversationWorkspaceClose();
        const duplicateCompletionBefore = JSON.stringify({
            conversation: taskRuntime.api.conversationSessionSnapshot(), budget: taskRuntime.api.budgetLedger(),
            relationships: taskRuntime.api.relationshipLedger(), playerPoints: taskStory.commander.res.points
        });
        assert.equal(taskRuntime.api.conversationSessionBegin('Ayo1 hedefle tekrar g�r�_�yorum.', {
            listenerActorId: created.taskOffer.objective.targetActorId
        }).ok, true);
        const duplicateCompletionAfter = {
            budget: taskRuntime.api.budgetLedger(), relationships: taskRuntime.api.relationshipLedger(),
            playerPoints: taskStory.commander.res.points
        };
        const duplicateCompletionExpected = JSON.parse(duplicateCompletionBefore);
        assert.equal(JSON.stringify(duplicateCompletionAfter), JSON.stringify({
            budget: duplicateCompletionExpected.budget,
            relationships: duplicateCompletionExpected.relationships,
            playerPoints: duplicateCompletionExpected.playerPoints
        }), 'A repeated target conversation must not settle or pay the task twice.');
        const forgedReceiptLedger = taskRuntime.api.conversationSessionSnapshot();
        forgedReceiptLedger.taskOffers.find(row => row.id === created.taskOffer.id)
            .institutional.resultReceipt.payeeTransactionId = 'budget:forged';
        assert.ok(taskRuntime.api.conversationSessionValidate(forgedReceiptLedger).issues
            .some(row => row.code === 'TASK_OFFER_INSTITUTIONAL_RECEIPT'));

        const declinedSessionId = openTaskSession(issuerActorId);
        const declinedCreated = taskRuntime.api.conversationInstitutionalTaskOfferCreate(declinedSessionId);
        const declineBudgetBefore = JSON.stringify(taskRuntime.api.budgetLedger());
        const declineRelationshipsBefore = JSON.stringify(taskRuntime.api.relationshipLedger());
        const declined = taskRuntime.api.conversationTaskOfferDecision(declinedCreated.taskOffer.id, 'DECLINE');
        assert.equal(declined.ok, true);
        assert.equal(declined.taskOffer.status, 'DECLINED');
        assert.equal(declined.taskOffer.institutional.paymentStatus, 'NOT_RESERVED');
        assert.equal(JSON.stringify(taskRuntime.api.budgetLedger()), declineBudgetBefore,
            'Declining an institutional offer must not reserve compensation.');
        assert.equal(JSON.stringify(taskRuntime.api.relationshipLedger()), declineRelationshipsBefore,
            'Declining an institutional offer must not create a relationship result.');

        const insufficientSessionId = openTaskSession(issuerActorId);
        const insufficientCreated = taskRuntime.api.conversationInstitutionalTaskOfferCreate(insufficientSessionId);
        const spendAmount = payerCommander.res.points - 10;
        assert.equal(taskRuntime.api.budgetDebit(0, spendAmount, 'test.institutional_task_payer_spend', {
            commander: payerCommander, commanderOnly: true,
            correlationId: 'test:institutional-task:payer-spend'
        }).ok, true);
        const insufficientBefore = JSON.stringify({
            conversation: taskRuntime.api.conversationSessionSnapshot(), budget: taskRuntime.api.budgetLedger()
        });
        const insufficient = taskRuntime.api.conversationTaskOfferDecision(insufficientCreated.taskOffer.id, 'ACCEPT');
        assert.equal(insufficient.ok, false);
        assert.equal(insufficient.code, 'INSTITUTIONAL_TASK_INSUFFICIENT_CASH');
        assert.equal(insufficient.taskOffer.status, 'OFFERED');
        assert.equal(JSON.stringify({
            conversation: taskRuntime.api.conversationSessionSnapshot(), budget: taskRuntime.api.budgetLedger()
        }), insufficientBefore, 'Insufficient cash must leave both ledgers unchanged.');

        const forgedSessionId = openTaskSession(issuerActorId);
        const lowCreateBefore = JSON.stringify({
            conversation: taskRuntime.api.conversationSessionSnapshot(),
            institutions: taskRuntime.api.institutionLedger(), budget: taskRuntime.api.budgetLedger()
        });
        const lowCreate = taskRuntime.api.conversationInstitutionalTaskOfferCreate(forgedSessionId);
        assert.equal(lowCreate.ok, false);
        assert.equal(lowCreate.code, 'INSTITUTIONAL_TASK_INSUFFICIENT_CASH');
        assert.equal(JSON.stringify({
            conversation: taskRuntime.api.conversationSessionSnapshot(),
            institutions: taskRuntime.api.institutionLedger(), budget: taskRuntime.api.budgetLedger()
        }), lowCreateBefore, 'An already-insolvent issuer must not create an institution request or task.');
        assert.equal(taskRuntime.api.budgetCredit(0, 100, 'test.institutional_task_payer_refill', {
            commander: payerCommander, correlationId: 'test:institutional-task:payer-refill'
        }).ok, true);
        const forgedCreated = taskRuntime.api.conversationInstitutionalTaskOfferCreate(forgedSessionId);
        const liveForged = taskStory.conversationUnderstanding.taskOffers.find(row => row.id === forgedCreated.taskOffer.id);
        liveForged.institutional.payerCommanderId = String(taskStory.commander.id);
        const forgedBefore = JSON.stringify({
            conversation: taskStory.conversationUnderstanding, budget: taskRuntime.api.budgetLedger()
        });
        const forged = taskRuntime.api.conversationTaskOfferDecision(forgedCreated.taskOffer.id, 'ACCEPT');
        assert.equal(forged.ok, false);
        assert.equal(forged.code, 'INSTITUTIONAL_TASK_AUTHORITY_STALE');
        assert.equal(JSON.stringify({
            conversation: taskStory.conversationUnderstanding, budget: taskRuntime.api.budgetLedger()
        }), forgedBefore, 'A forged payer must produce zero partial mutation.');
        assert.equal(taskRuntime.api.conversationSessionValidate(taskStory.conversationUnderstanding).ok, false,
            'The deliberately forged payer fixture must be rejected by validation.');
        liveForged.institutional.payerCommanderId = payerCommanderId;
        const blockedSettlementAccept = taskRuntime.api.conversationTaskOfferDecision(forgedCreated.taskOffer.id, 'ACCEPT');
        assert.equal(blockedSettlementAccept.ok, true);
        const taskEscrowAccount = taskStory.stateBudget.countries['country:0'].accounts;
        const taskEscrowBeforeTamper = taskEscrowAccount['ASSET:TASK_ESCROW'];
        const playerBeforeBlockedSettlement = taskStory.commander.res.points;
        taskEscrowAccount['ASSET:TASK_ESCROW'] = 0;
        assert.equal(taskRuntime.api.conversationSessionBegin('�deme kaq1s1 bozukken hedef g�r�_me.', {
            listenerActorId: forgedCreated.taskOffer.objective.targetActorId
        }).ok, true);
        const blockedSettlementTask = taskStory.conversationUnderstanding.taskOffers.find(row =>
            row.id === forgedCreated.taskOffer.id);
        assert.equal(blockedSettlementTask.status, 'ACCEPTED');
        assert.equal(blockedSettlementTask.institutional.paymentStatus, 'RESERVED');
        assert.equal(blockedSettlementTask.institutional.resultReceiptId, null);
        assert.equal(taskStory.commander.res.points, playerBeforeBlockedSettlement,
            'A failed escrow gate must not credit the player or mark the task completed.');
        taskEscrowAccount['ASSET:TASK_ESCROW'] = taskEscrowBeforeTamper;
        const payerBeforeExpiry = payerCommander.res.points;
        const escrowBeforeExpiry = taskEscrowAccount['ASSET:TASK_ESCROW'];
        taskStory.clock = blockedSettlementTask.dueAt + 1;
        assert.ok(taskRuntime.api.conversationTaskOfferTick() >= 1);
        assert.equal(blockedSettlementTask.status, 'EXPIRED');
        assert.equal(blockedSettlementTask.institutional.paymentStatus, 'RELEASED');
        assert.equal(blockedSettlementTask.relationshipResultReceiptId,
            blockedSettlementTask.institutional.relationshipResultReceiptId);
        const expiredRelationshipReceipt = taskRuntime.api.relationshipResultReceipt(
            blockedSettlementTask.relationshipResultReceiptId
        );
        assert.equal(expiredRelationshipReceipt.interpretationType, 'TASK_COMMITMENT_BROKEN');
        assert.equal(expiredRelationshipReceipt.fromActorId, blockedSettlementTask.issuerActorId);
        assert.equal(expiredRelationshipReceipt.toActorId, blockedSettlementTask.assigneeActorId);
        assert.equal(payerCommander.res.points, payerBeforeExpiry + 25);
        assert.equal(taskEscrowAccount['ASSET:TASK_ESCROW'], escrowBeforeExpiry - 25);
        const unacceptedExpiredTask = taskStory.conversationUnderstanding.taskOffers.find(row =>
            row.id === insufficientCreated.taskOffer.id);
        assert.equal(unacceptedExpiredTask.status, 'EXPIRED');
        assert.equal(unacceptedExpiredTask.acceptedAt, null);
        assert.equal(unacceptedExpiredTask.relationshipResultReceiptId, null);
        const duplicateExpiryBefore = JSON.stringify({
            conversation: taskRuntime.api.conversationSessionSnapshot(), budget: taskRuntime.api.budgetLedger(),
            relationships: taskRuntime.api.relationshipLedger(),
            payerPoints: payerCommander.res.points
        });
        assert.equal(taskRuntime.api.conversationTaskOfferTick(), 0);
        assert.equal(JSON.stringify({
            conversation: taskRuntime.api.conversationSessionSnapshot(), budget: taskRuntime.api.budgetLedger(),
            relationships: taskRuntime.api.relationshipLedger(),
            payerPoints: payerCommander.res.points
        }), duplicateExpiryBefore, 'Repeated expiry ticks must not release escrow twice.');

        const atomicSessionId = openTaskSession(issuerActorId);
        const atomicCreated = taskRuntime.api.conversationInstitutionalTaskOfferCreate(atomicSessionId);
        const atomicAccepted = taskRuntime.api.conversationTaskOfferDecision(
            atomicCreated.taskOffer.id, 'ACCEPT'
        );
        assert.equal(atomicAccepted.ok, true);
        const atomicTask = taskStory.conversationUnderstanding.taskOffers.find(row =>
            row.id === atomicCreated.taskOffer.id);
        const healthyRelationships = taskRuntime.api.relationshipLedger();
        let limitFixtureSequence = 1;
        while (Object.keys(taskStory.characterRelationships.resultReceipts).length < 256) {
            taskStory.characterRelationships.resultReceipts[`relationship-result:limit-fixture:${limitFixtureSequence++}`] = {};
        }
        const atomicBefore = JSON.stringify({
            task: atomicTask, budget: taskRuntime.api.budgetLedger(),
            relationships: taskRuntime.api.relationshipLedger(), playerPoints: taskStory.commander.res.points
        });
        assert.equal(taskRuntime.api.conversationSessionBegin('İlişki kapısı kapalı hedef görüşmesi.', {
            listenerActorId: atomicCreated.taskOffer.objective.targetActorId
        }).ok, true);
        assert.equal(JSON.stringify({
            task: atomicTask, budget: taskRuntime.api.budgetLedger(),
            relationships: taskRuntime.api.relationshipLedger(), playerPoints: taskStory.commander.res.points
        }), atomicBefore, 'A rejected relationship result must roll back task completion and payment settlement.');
        assert.equal(atomicTask.status, 'ACCEPTED');
        assert.equal(atomicTask.institutional.paymentStatus, 'RESERVED');
        assert.equal(taskRuntime.api.relationshipRestore(healthyRelationships).schemaVersion, 2);

        const unauthorized = taskDirectory.publicCharacters.find(row => {
            const parts = row.id.split(':');
            return row.contactable && row.id !== taskDirectory.playerActorId && row.id !== issuerActorId
                && parts.length === 3 && /^\d+$/.test(parts[2]);
        });
        assert.ok(unauthorized, 'A title-only/non-office commander fixture must exist.');
        const unauthorizedSessionId = openTaskSession(unauthorized.id);
        const unauthorizedBefore = JSON.stringify({
            conversation: taskRuntime.api.conversationSessionSnapshot(), institutions: taskRuntime.api.institutionLedger(),
            budget: taskRuntime.api.budgetLedger()
        });
        const unauthorizedPreview = taskRuntime.api.conversationInstitutionalTaskOfferPreview(unauthorizedSessionId);
        assert.equal(unauthorizedPreview.ok, false);
        assert.ok(['CANONICAL_OFFICE_REQUIRED', 'ACTOR_NOT_AUTHORIZED_TO_PROPOSE'].includes(unauthorizedPreview.code));
        assert.equal(JSON.stringify({
            conversation: taskRuntime.api.conversationSessionSnapshot(), institutions: taskRuntime.api.institutionLedger(),
            budget: taskRuntime.api.budgetLedger()
        }), unauthorizedBefore, 'A non-office title must not mutate any ledger.');

        const persistedOfferedSession = openTaskSession(issuerActorId);
        assert.equal(taskRuntime.api.conversationInstitutionalTaskOfferCreate(persistedOfferedSession).ok, true);
        const persistedAcceptedSession = openTaskSession(issuerActorId);
        const persistedAccepted = taskRuntime.api.conversationInstitutionalTaskOfferCreate(persistedAcceptedSession);
        assert.equal(taskRuntime.api.conversationTaskOfferDecision(
            persistedAccepted.taskOffer.id, 'ACCEPT').ok, true);
        const assertTaskTamperRejected = mutate => {
            const candidate = taskRuntime.api.conversationSessionSnapshot();
            mutate(candidate);
            assert.equal(taskRuntime.api.conversationSessionValidate(candidate).ok, false);
            return candidate;
        };
        const findPersistedAccepted = candidate => candidate.taskOffers.find(row =>
            row.id === persistedAccepted.taskOffer.id);
        assertTaskTamperRejected(candidate => {
            findPersistedAccepted(candidate).institutional.institutionId = 'institution:country:0:executive';
        });
        assertTaskTamperRejected(candidate => {
            findPersistedAccepted(candidate).issuerActorId = unauthorized.id;
        });
        assertTaskTamperRejected(candidate => {
            findPersistedAccepted(candidate).institutional.payeeCommanderId = payerCommanderId;
        });
        assertTaskTamperRejected(candidate => {
            findPersistedAccepted(candidate).institutional.amount = 26;
        });
        const correlationTamper = assertTaskTamperRejected(candidate => {
            findPersistedAccepted(candidate).institutional.correlationId = 'conversation-task-offer:forged';
        });
        assertTaskTamperRejected(candidate => {
            findPersistedAccepted(candidate).institutional.escrowReservationId = 'budget-settlement:forged';
        });
        assertTaskTamperRejected(candidate => {
            const completed = candidate.taskOffers.find(row => row.id === created.taskOffer.id);
            completed.completionSessionId = persistedAcceptedSession;
        });
        taskRuntime.api.saveNow();
        assert.equal(taskRuntime.api.saveStatus().ok, true);
        const savedRaw = taskRuntime.api.savedRaw();
        const savedPayload = JSON.parse(savedRaw);
        const restoredTaskRuntime = createRuntime(3813003);
        try {
            restoredTaskRuntime.api.putSavedRaw(savedRaw);
            assert.equal(restoredTaskRuntime.api.loadNow(), true);
            assert.equal(JSON.stringify(restoredTaskRuntime.api.conversationSessionSnapshot()),
                JSON.stringify(savedPayload.conversationUnderstanding),
                'Restore must preserve offered, accepted, completed, declined, and expired task records exactly.');
            assert.equal(JSON.stringify(restoredTaskRuntime.api.budgetLedger()),
                JSON.stringify(savedPayload.stateBudget),
                'Restore must not settle or release institutional task payments.');
            assert.equal(restoredTaskRuntime.api.conversationSessionValidate(
                restoredTaskRuntime.api.conversationSessionSnapshot()).ok, true);
            assert.equal(restoredTaskRuntime.api.validateBudgetLedger(
                restoredTaskRuntime.api.budgetLedger(), { checkWalletMirrors: true }).ok, true);
            assert.equal(restoredTaskRuntime.api.conversationSessionRestore(correlationTamper).taskOffers.length, 0,
                'Restore must reject a tampered institutional payment link instead of accepting it.');
        } finally {
            restoredTaskRuntime.dom.window.close();
        }

        assert.equal(taskRuntime.api.conversationSessionValidate(taskRuntime.api.conversationSessionSnapshot()).ok, true);
        assert.equal(taskRuntime.api.validateInstitutionLedger(taskRuntime.api.institutionLedger()).ok, true);
        assert.equal(taskRuntime.api.validateBudgetLedger(taskRuntime.api.budgetLedger(), { checkWalletMirrors: true }).ok, true);
        return { accepted: accepted.taskOffer.status, declined: declined.taskOffer.status };
    } finally {
        taskRuntime.dom.window.close();
    }
}

const institutionalTaskDecisions = verifyInstitutionalTaskOfferDecisions();

const runtime = createRuntime(3813001);
try {
    runtime.api.newCampaign({ seed: 3813001, playerStateId: 0, abundance: 1, doctrine: 'combined', fog: true });
    const story = runtime.api.state();
    const directory = runtime.api.contactDirectoryBuild();
    const listener = (directory.publicCharacters || []).find(row => row.id !== directory.playerActorId);
    assert.ok(listener && listener.id, 'Konuşma için oyuncu dışı bir karakter bulunmalı.');

    const physicalSnapshot = () => JSON.stringify({
        clock: story.clock,
        states: story.states.map(row => ({
            id: row.id, welfare: row.welfare, treasury: row.treasury,
            regions: Array.isArray(row.regions) ? row.regions.slice() : []
        })),
        resources: story.resources
    });
    const physicalBefore = physicalSnapshot();

    const opened = runtime.api.conversationSessionBegin('Merhaba', { listenerActorId: listener.id });
    assert.equal(opened.ok, true);
    assert.equal(opened.worldMutation, false);
    const sessionId = opened.session.id;
    let conversationCase = runtime.api.conversationSessionCaseGet(sessionId);
    assert.equal(conversationCase.schemaVersion, 1);
    assert.equal(conversationCase.mode, 'DAILY_CHAT');
    assert.equal(conversationCase.mechanicalStatus, 'LIVE');
    assert.equal(conversationCase.modeHistory.length, 1);
    assert.equal(JSON.stringify(conversationCase.participantActorIds),
        JSON.stringify([opened.session.playerActorId, opened.session.listenerActorId]));

    const pausedBeforeWorkspace = story.paused;
    runtime.dom.window.storyConversationWorkspaceOpen(listener.id, listener.name, sessionId);
    assert.equal(runtime.dom.window.document.querySelectorAll('[data-conversation-case-mode]').length, 6);
    assert.equal(runtime.dom.window.document.querySelector('.conversation-case-picker small').textContent,
        'KULLANILABİLİR');
    runtime.dom.window.storyConversationWorkspaceClose();
    assert.equal(story.paused, pausedBeforeWorkspace,
        'Görüşme kapanınca önceki duraklatma hali geri gelmeli.');

    const taskMode = runtime.api.conversationSessionSetMode(sessionId, 'TASKS_JOBS');
    assert.equal(taskMode.ok, true);
    assert.equal(taskMode.code, 'CONVERSATION_MODE_CHANGED');
    assert.equal(taskMode.worldMutation, false);
    assert.equal(taskMode.conversationCase.mechanicalStatus, 'LIVE_TASK_OFFER_ADAPTER');
    assert.equal(JSON.stringify(taskMode.conversationCase.taskOfferIds), '[]');
    runtime.dom.window.storyConversationWorkspaceOpen(listener.id, listener.name, sessionId);
    assert.ok(runtime.dom.window.document.querySelector('[data-conversation-task-create]'));
    assert.equal(runtime.dom.window.document.querySelector('.conversation-case-picker small').textContent,
        'KAYNAKLI GÖREV TEKLİFİ HAZIR');
    runtime.dom.window.storyConversationWorkspaceClose();
    const taskCreated = runtime.api.conversationTaskOfferCreate(sessionId);
    assert.equal(taskCreated.ok, true);
    assert.equal(taskCreated.taskOffer.schemaVersion, 3);
    assert.equal(taskCreated.taskOffer.relationshipResultReceiptId, null);
    assert.equal(taskCreated.taskOffer.kind, 'PERSONAL_CONTACT_REQUEST');
    assert.equal(taskCreated.taskOffer.status, 'OFFERED');
    assert.equal(taskCreated.taskOffer.authority.model, 'PERSONAL_REQUEST');
    assert.equal(taskCreated.taskOffer.authority.canCompel, false);
    assert.equal(taskCreated.taskOffer.reward.kind, 'NONE');
    assert.equal(taskCreated.taskOffer.institutional, null);
    const taskUnionFixture = runtime.api.conversationSessionSnapshot();
    const institutionalFixture = JSON.parse(JSON.stringify(taskUnionFixture));
    const institutionalTask = institutionalFixture.taskOffers.find(row => row.id === taskCreated.taskOffer.id);
    institutionalTask.kind = 'INSTITUTIONAL_PAID_CONTACT_TASK';
    institutionalTask.authority = {
        model: 'INSTITUTIONAL_COMMISSION',
        sourceActorId: institutionalTask.issuerActorId,
        canCompel: false,
        institutionRequestId: 'institution-request:fixture',
        institutionId: 'institution:country:0:executive',
        countryId: 'country:0',
        legalBasis: 'constitution:monarchy:commission_paid_contact_task'
    };
    institutionalTask.reward = {
        kind: 'STATE_CREDIT_COMPENSATION', amount: 25, currency: 'STATE_CREDIT'
    };
    institutionalTask.institutional = {
        correlationId: 'conversation-task-offer:fixture:institutional-payment',
        institutionRequestId: 'institution-request:fixture',
        institutionId: 'institution:country:0:executive',
        countryId: 'country:0',
        legalBasis: 'constitution:monarchy:commission_paid_contact_task',
        payerCountryId: 'country:0', payerCommanderId: '1',
        payeeCountryId: 'country:0', payeeCommanderId: '0',
        compensationPolicyId: 'institutional-contact-task-v1',
        amount: 25, currency: 'STATE_CREDIT',
        escrowReservationId: null, paymentStatus: 'NOT_RESERVED',
        resultReceiptId: null, resultReceipt: null,
        relationshipResultReceiptId: null
    };
    assert.equal(runtime.api.conversationSessionValidate(institutionalFixture).ok, true,
        'A complete offered institutional branch must satisfy TaskOfferV3.');
    const mixedPersonalFixture = JSON.parse(JSON.stringify(institutionalFixture));
    const mixedPersonalTask = mixedPersonalFixture.taskOffers.find(row => row.id === taskCreated.taskOffer.id);
    mixedPersonalTask.kind = 'PERSONAL_CONTACT_REQUEST';
    mixedPersonalTask.authority = taskCreated.taskOffer.authority;
    mixedPersonalTask.reward = taskCreated.taskOffer.reward;
    assert.ok(runtime.api.conversationSessionValidate(mixedPersonalFixture).issues
        .some(row => row.code === 'TASK_OFFER_UNION_MIXED'),
    'A personal task cannot carry institutional payment fields.');
    const mixedInstitutionalFixture = JSON.parse(JSON.stringify(institutionalFixture));
    mixedInstitutionalFixture.taskOffers.find(row => row.id === taskCreated.taskOffer.id).reward = {
        kind: 'NONE', amount: 0
    };
    assert.ok(runtime.api.conversationSessionValidate(mixedInstitutionalFixture).issues
        .some(row => row.code === 'TASK_OFFER_REWARD'),
    'An institutional task cannot use the personal no-reward branch.');
    const legacyTaskLedger = JSON.parse(JSON.stringify(taskUnionFixture));
    const legacyTask = legacyTaskLedger.taskOffers.find(row => row.id === taskCreated.taskOffer.id);
    const legacyAuthority = JSON.stringify(legacyTask.authority);
    const legacyReward = JSON.stringify(legacyTask.reward);
    legacyTask.schemaVersion = 1;
    legacyTask.kind = 'CONTACT_REQUEST';
    delete legacyTask.institutional;
    const migratedTaskLedger = runtime.api.conversationSessionMigrate(legacyTaskLedger);
    const migratedTask = migratedTaskLedger.taskOffers.find(row => row.id === taskCreated.taskOffer.id);
    assert.equal(migratedTask.schemaVersion, 3);
    assert.equal(migratedTask.kind, 'PERSONAL_CONTACT_REQUEST');
    assert.equal(JSON.stringify(migratedTask.authority), legacyAuthority);
    assert.equal(JSON.stringify(migratedTask.reward), legacyReward);
    assert.equal(migratedTask.institutional, null);
    assert.equal(migratedTask.relationshipResultReceiptId, null);
    assert.equal(runtime.api.conversationSessionValidate(migratedTaskLedger).ok, true,
        'TaskOfferV1 must migrate without inventing authority, compensation, escrow, or receipts.');
    const taskTargetActorId = taskCreated.taskOffer.objective.targetActorId;
    const taskAccepted = runtime.api.conversationTaskOfferDecision(taskCreated.taskOffer.id, 'ACCEPT');
    assert.equal(taskAccepted.ok, true);
    assert.equal(taskAccepted.taskOffer.status, 'ACCEPTED');
    const personalReverseBefore = JSON.stringify(runtime.api.relationshipView(
        taskAccepted.taskOffer.assigneeActorId, taskAccepted.taskOffer.issuerActorId
    ));

    const confidential = runtime.api.conversationSessionFollowUp(sessionId, 'Bu bilgi aramızda kalsın.');
    assert.equal(confidential.ok, true);
    conversationCase = runtime.api.conversationSessionCaseGet(sessionId);
    assert.equal(conversationCase.mode, 'CONFIDENTIALITY');
    assert.equal(conversationCase.mechanicalStatus, 'PARTIAL_SECRET_LEDGER_AVAILABLE');
    assert.equal(conversationCase.modeHistory.length, 3);

    const dailyFollowUp = runtime.api.conversationSessionFollowUp(sessionId, 'Bugün nasılsın?');
    assert.equal(dailyFollowUp.ok, true);
    conversationCase = runtime.api.conversationSessionCaseGet(sessionId);
    assert.equal(conversationCase.mode, 'CONFIDENTIALITY',
        'Günlük bir takip sözü etkin özel bağlamı sessizce silmemeli.');
    assert.equal(conversationCase.modeHistory.length, 3);

    const formal = runtime.api.conversationSessionSetMode(sessionId, 'FORMAL_MEETING');
    assert.equal(formal.ok, true);
    assert.equal(formal.conversationCase.mechanicalStatus, 'LIVE_MEETING_CASE_SHELL');
    assert.equal(formal.conversationCase.meetingCaseId, null);
    assert.equal(formal.conversationCase.worldMutation, false);
    const invalidMeeting = runtime.api.conversationMeetingCreate(sessionId, 'kısa');
    assert.equal(invalidMeeting.ok, false);
    assert.equal(invalidMeeting.code, 'MEETING_AGENDA_INVALID');
    const meetingCreated = runtime.api.conversationMeetingCreate(sessionId,
        'Sanayi yatırımı için kurumlar arası sorumluluk ve kaynak planı');
    assert.equal(meetingCreated.ok, true);
    const meeting = meetingCreated.meetingCase;
    assert.equal(meeting.status, 'OPEN_NO_DECISION_ADAPTER');
    assert.ok(meeting.participants.length >= 3);
    assert.equal(meeting.chair.authoritySource, 'CANONICAL_INSTITUTION_OFFICE');
    assert.equal(meeting.agendaItems[0].source, 'PLAYER_PROPOSED_AGENDA');
    assert.equal(JSON.stringify(meeting.motions), '[]');
    assert.equal(JSON.stringify(meeting.votes), '[]');
    assert.equal(meeting.outcomeReceiptId, null);
    const caseAfterMeeting = runtime.api.conversationSessionCaseGet(sessionId);
    assert.equal(caseAfterMeeting.kind, 'MULTI_PARTY');
    assert.equal(caseAfterMeeting.meetingCaseId, meeting.id);
    assert.equal(JSON.stringify(caseAfterMeeting.participantActorIds),
        JSON.stringify(meeting.participantActorIds));
    const identities = story.characterIdentities;
    const publicFactId = 'world-fact:meeting-test:industrial-capacity';
    const publicBeliefId = 'actor-belief:meeting-test:chair-public';
    identities.worldFacts[publicFactId] = {
        id: publicFactId, factType: 'MEETING_POLICY_POSITION',
        subjectActorId: meeting.chair.actorId, countryId: meeting.countryId,
        publicSummary: 'Sanayi yatırımında kaynak tahsisi ile denetim sorumluluğu birlikte tanımlanmalı.',
        position: 'SUPPORT',
        visibility: 'INSTITUTIONAL', occurredAt: story.clock,
        originEventId: 'event:meeting-test:public', version: 1
    };
    identities.actorBeliefs[publicBeliefId] = {
        id: publicBeliefId, holderActorId: meeting.chair.actorId,
        holderCountryId: meeting.countryId, worldFactId: publicFactId,
        beliefStatus: 'VERIFIED', confidenceBps: 9100, learnedAt: story.clock,
        source: { type: 'INSTITUTIONAL_RECORD', eventId: 'event:meeting-test:public' }
    };
    const privateFactId = 'world-fact:meeting-test:private-plan';
    const privateBeliefId = 'actor-belief:meeting-test:chair-private';
    identities.worldFacts[privateFactId] = {
        id: privateFactId, factType: 'PRIVATE_PLAN', subjectActorId: meeting.chair.actorId,
        countryId: meeting.countryId, publicSummary: 'Bu özel plan toplantıda açıklanmamalı.',
        visibility: 'PRIVATE', occurredAt: story.clock,
        originEventId: 'event:meeting-test:private', version: 1
    };
    identities.actorBeliefs[privateBeliefId] = {
        id: privateBeliefId, holderActorId: meeting.chair.actorId,
        holderCountryId: meeting.countryId, worldFactId: privateFactId,
        beliefStatus: 'VERIFIED', confidenceBps: 10000, learnedAt: story.clock + 1,
        source: { type: 'PRIVATE_MEMORY', eventId: 'event:meeting-test:private' }
    };
    const outOfOrder = runtime.api.conversationMeetingSubmitPlayerTurn(meeting.id,
        'Bu söz sırası dışında kalmalı.', null);
    assert.equal(outOfOrder.ok, false);
    assert.equal(outOfOrder.code, 'MEETING_SPEAKER_OUT_OF_ORDER');
    const stancePreview = runtime.api.conversationMeetingStancePreview(meeting.id, meeting.chair.actorId);
    const stancePreviewRepeat = runtime.api.conversationMeetingStancePreview(meeting.id, meeting.chair.actorId);
    assert.equal(stancePreview.ok, true);
    assert.equal(JSON.stringify(stancePreview.stance), JSON.stringify(stancePreviewRepeat.stance));
    assert.ok(['SUPPORT', 'LEAN_SUPPORT'].includes(stancePreview.stance.direction));
    assert.ok(stancePreview.stance.publicReasonCodes.includes('SOURCED_ACTOR_BELIEF'));
    assert.equal(stancePreview.stance.rawPersonalityAxesExposed, false);
    assert.equal(stancePreview.stance.rawRelationshipAxesExposed, false);
    const chairTurn = runtime.api.conversationMeetingGenerateCharacterTurn(meeting.id,
        opened.session.playerActorId);
    assert.equal(chairTurn.ok, true);
    assert.equal(chairTurn.turn.actorId, meeting.chair.actorId);
    assert.equal(chairTurn.turn.knowledgePolicy.otherPrivateContextReadable, false);
    assert.equal(chairTurn.turn.grounding.beliefId, publicBeliefId);
    assert.ok(chairTurn.turn.sourceRefs.includes(publicBeliefId));
    assert.ok(chairTurn.turn.sourceRefs.includes(publicFactId));
    assert.ok(!chairTurn.turn.sourceRefs.includes(privateBeliefId));
    assert.doesNotMatch(chairTurn.turn.text, /özel plan/i);
    assert.match(chairTurn.turn.text, /Sanayi yatırımında kaynak tahsisi/);
    assert.equal(chairTurn.turn.stance.direction, stancePreview.stance.direction);
    assert.ok(chairTurn.turn.stance.sourceRefs.every(ref => chairTurn.turn.sourceRefs.includes(ref)));
    const playerMeetingTurn = runtime.api.conversationMeetingSubmitPlayerTurn(meeting.id,
        'Sanayi yatırımı için önce sorumluluk ve denetim sınırlarını netleştirelim.',
        opened.session.listenerActorId);
    assert.equal(playerMeetingTurn.ok, true);
    for (let index = 0; index < 6; index++) {
        const current = runtime.api.conversationMeetingGet(meeting.id);
        const currentActorId = current.speakingOrderActorIds[current.currentSpeakerIndex];
        const result = currentActorId === opened.session.playerActorId
            ? runtime.api.conversationMeetingSubmitPlayerTurn(meeting.id,
                `Toplantıdaki ${index + 1}. kamusal değerlendirmemi kayda geçiriyorum.`, null)
            : runtime.api.conversationMeetingGenerateCharacterTurn(meeting.id, null);
        assert.equal(result.ok, true);
    }
    const meetingAfterTurns = runtime.api.conversationMeetingGet(meeting.id);
    assert.equal(meetingAfterTurns.turns.length, 8);
    assert.ok(meetingAfterTurns.turns.every((turn, index) =>
        turn.actorId === meetingAfterTurns.speakingOrderActorIds[index % meetingAfterTurns.speakingOrderActorIds.length]));
    const characterTextsByActor = new Map();
    for (const turn of meetingAfterTurns.turns.filter(row => row.kind === 'CHARACTER_PROCEDURAL_STATEMENT')) {
        const rows = characterTextsByActor.get(turn.actorId) || [];
        rows.push(turn.text);
        characterTextsByActor.set(turn.actorId, rows);
    }
    assert.ok([...characterTextsByActor.values()].every(rows => new Set(rows).size === rows.length),
        'Aynı karakter sonraki toplantı turunda aynı usul cümlesini kopyalamamalı.');
    const visibleTurnIds = meetingAfterTurns.turns.map(turn => turn.id);
    assert.ok(meetingAfterTurns.visibilityMatrix.every(row =>
        JSON.stringify(row.visibleTurnIds) === JSON.stringify(visibleTurnIds)
        && row.privateContextOwnerActorId === row.actorId
        && row.mayReadOtherPrivateContext === false));
    const outsider = (directory.publicCharacters || []).find(row =>
        !meeting.participantActorIds.includes(row.id));
    if (outsider) {
        assert.equal(runtime.api.conversationMeetingSendPrivateNote(meeting.id, outsider.id,
            'Bu not toplantı dışına çıkmamalı.').code, 'MEETING_PRIVATE_NOTE_RECIPIENT_INVALID');
    }
    const privateNoteResult = runtime.api.conversationMeetingSendPrivateNote(meeting.id,
        opened.session.listenerActorId, 'Kaynak planının ayrıntısını toplantıdan sonra ikili ele alalım.');
    assert.equal(privateNoteResult.ok, true);
    assert.equal(privateNoteResult.privateNote.visibility, 'BILATERAL_PRIVATE');
    assert.equal(privateNoteResult.privateNote.schemaVersion, 2);
    assert.equal(privateNoteResult.privateNote.kind, 'PLAYER_NOTE');
    assert.equal(privateNoteResult.privateNote.replyToPrivateNoteId, null);
    assert.equal(privateNoteResult.privateNote.generationMode, 'PLAYER_AUTHORED');
    assert.equal(privateNoteResult.privateNote.knowledgePolicy.rawWorldRead, false);
    const privateTrapRecipient = meeting.participants.find(row =>
        row.actorId !== opened.session.playerActorId
        && row.actorId !== opened.session.listenerActorId);
    const privateTrap = runtime.api.conversationMeetingSendPrivateNote(meeting.id,
        privateTrapRecipient.actorId, 'UCUNCU_TARAF_GIZLI_TUZAK bu ikili kanalın dışına çıkmamalı.');
    assert.equal(privateTrap.ok, true);
    const beforeWrongSpeakerReply = JSON.stringify(runtime.api.conversationSessionSnapshot());
    const physicalBeforeWrongSpeakerReply = physicalSnapshot();
    assert.equal(runtime.api.conversationMeetingPrivateNoteRespond(
        meeting.id, privateTrap.privateNote.id).code,
    'MEETING_PRIVATE_NOTE_RECIPIENT_NOT_SPEAKER');
    assert.equal(JSON.stringify(runtime.api.conversationSessionSnapshot()), beforeWrongSpeakerReply);
    assert.equal(physicalSnapshot(), physicalBeforeWrongSpeakerReply);
    const beforePrivateReply = runtime.api.conversationMeetingGet(meeting.id);
    assert.equal(beforePrivateReply.speakingOrderActorIds[beforePrivateReply.currentSpeakerIndex],
        opened.session.listenerActorId);
    const publicTurnsBeforePrivateReply = beforePrivateReply.turns.length;
    const speakerIndexBeforePrivateReply = beforePrivateReply.currentSpeakerIndex;
    const physicalBeforePrivateReply = physicalSnapshot();
    const privateReplyResult = runtime.api.conversationMeetingPrivateNoteRespond(
        meeting.id, privateNoteResult.privateNote.id
    );
    assert.equal(privateReplyResult.ok, true);
    assert.equal(privateReplyResult.privateReply.kind, 'CHARACTER_REPLY');
    assert.equal(privateReplyResult.privateReply.replyToPrivateNoteId,
        privateNoteResult.privateNote.id);
    assert.equal(privateReplyResult.privateReply.authorActorId, opened.session.listenerActorId);
    assert.equal(privateReplyResult.privateReply.recipientActorId, opened.session.playerActorId);
    assert.equal(privateReplyResult.privateReply.generationMode, 'DETERMINISTIC_SOURCE_BOUND');
    assert.equal(privateReplyResult.privateReply.knowledgePolicy.rootPrivateNoteOnly, true);
    assert.equal(privateReplyResult.privateReply.knowledgePolicy.otherPrivateContextReadable, false);
    assert.equal(privateReplyResult.privateReply.knowledgePolicy.rawWorldRead, false);
    assert.ok(privateReplyResult.privateReply.sourceRefs.includes(privateNoteResult.privateNote.id));
    assert.ok(!privateReplyResult.privateReply.sourceRefs.includes(privateTrap.privateNote.id));
    assert.ok(!privateReplyResult.privateReply.sourceRefs.includes(privateBeliefId));
    assert.ok(!privateReplyResult.privateReply.sourceRefs.includes(privateFactId));
    assert.doesNotMatch(privateReplyResult.privateReply.text, /UCUNCU_TARAF_GIZLI_TUZAK/);
    assert.doesNotMatch(privateReplyResult.privateReply.text, /Bu özel plan toplantıda açıklanmamalı/i);
    assert.ok(!privateReplyResult.privateReply.grounding
        || ['PUBLIC', 'INSTITUTIONAL'].includes(privateReplyResult.privateReply.grounding.visibility));
    const meetingAfterPrivateReply = runtime.api.conversationMeetingGet(meeting.id);
    assert.equal(meetingAfterPrivateReply.turns.length, publicTurnsBeforePrivateReply);
    assert.equal(meetingAfterPrivateReply.currentSpeakerIndex, speakerIndexBeforePrivateReply);
    assert.equal(physicalSnapshot(), physicalBeforePrivateReply);
    assert.equal(JSON.stringify(meetingAfterPrivateReply.visibilityMatrix
        .filter(row => row.visiblePrivateNoteIds.includes(privateReplyResult.privateReply.id))
        .map(row => row.actorId).sort()),
    JSON.stringify([opened.session.playerActorId, opened.session.listenerActorId].sort()));
    const beforeDuplicatePrivateReply = JSON.stringify(runtime.api.conversationSessionSnapshot());
    assert.equal(runtime.api.conversationMeetingPrivateNoteRespond(
        meeting.id, privateNoteResult.privateNote.id).code,
    'MEETING_PRIVATE_NOTE_ALREADY_ANSWERED');
    assert.equal(JSON.stringify(runtime.api.conversationSessionSnapshot()), beforeDuplicatePrivateReply);
    const uiReplyRoot = runtime.api.conversationMeetingSendPrivateNote(meeting.id,
        opened.session.listenerActorId, 'Bu ikinci not için yalnız ikili ve kaynaklı bir yanıt bekliyorum.');
    assert.equal(uiReplyRoot.ok, true);
    const meetingAfterNote = runtime.api.conversationMeetingGet(meeting.id);
    assert.equal(JSON.stringify(meetingAfterNote.visibilityMatrix
        .filter(row => row.visiblePrivateNoteIds.includes(privateNoteResult.privateNote.id))
        .map(row => row.actorId).sort()),
    JSON.stringify([opened.session.playerActorId, opened.session.listenerActorId].sort()));
    assert.ok(meetingAfterNote.visibilityMatrix.filter(row =>
        ![opened.session.playerActorId, opened.session.listenerActorId].includes(row.actorId))
        .every(row => !row.visiblePrivateNoteIds.includes(privateNoteResult.privateNote.id)));
    runtime.dom.window.storyConversationWorkspaceOpen(listener.id, listener.name, sessionId);
    assert.equal(runtime.dom.window.document.querySelectorAll('[data-conversation-participant]').length,
        meeting.participants.length);
    assert.ok(runtime.dom.window.document.querySelector(
        '[data-conversation-meeting-character-turn], [data-conversation-meeting-player-send]'));
    assert.equal(runtime.dom.window.document.querySelectorAll('.conversation-meeting-transcript article').length, 8);
    const privateReplyButton = runtime.dom.window.document.querySelector(
        `[data-conversation-meeting-private-reply="${uiReplyRoot.privateNote.id}"]`
    );
    assert.ok(privateReplyButton, 'Yanıtsız notun gerçek alıcısı sıradaysa özel yanıt düğmesi görünmeli.');
    runtime.dom.window.storyConversationWorkspaceHandleClick({ target: privateReplyButton });
    runtime.dom.window.storyConversationWorkspaceHandleClick({ target: privateReplyButton });
    assert.equal(runtime.api.conversationMeetingGet(meeting.id).privateNotes.filter(note =>
        note.kind === 'CHARACTER_REPLY'
        && note.replyToPrivateNoteId === uiReplyRoot.privateNote.id).length, 1);
    assert.equal(runtime.dom.window.document.querySelector(
        `[data-conversation-meeting-private-reply="${uiReplyRoot.privateNote.id}"]`), null);
    assert.equal(runtime.dom.window.document.querySelectorAll(
        '.conversation-meeting-private-reply').length, 2);
    const meetingUiText = runtime.dom.window.document.getElementById('conversation-workspace-modal').textContent;
    assert.doesNotMatch(meetingUiText,
        /OPEN_NO_DECISION_ADAPTER|KNOWN_PUBLIC_PROFILE|PLAYER_NOTE|CHARACTER_REPLY/);
    assert.match(meetingUiText, /ÖNERGE İNCELEMESİ AÇIK · OYLAMA KAPALI|DOĞRULANMIŞ KAMUSAL PROFİL/);
    assert.match(meetingUiText, /KAYNAKLI GÖRÜŞ · KURUMSAL KAYIT · 91% GÜVEN/);
    assert.match(meetingUiText, /TUTUM · (DESTEKLİYOR|DESTEĞE YAKIN)/);
    assert.match(meetingUiText, /Kaynak planının ayrıntısını toplantıdan sonra ikili ele alalım/);
    assert.match(meetingUiText, /KENDİ KAYNAK SINIRI · KARAR, EMİR VEYA TAAHHÜT DEĞİL/);
    runtime.dom.window.storyConversationWorkspaceClose();

    assert.equal(runtime.api.conversationMeetingMotionPropose(meeting.id, 'kısa').code,
        'MEETING_MOTION_TEXT_INVALID');
    const proposalRoutes = runtime.api.conversationMeetingProposalRoutes(meeting.id);
    assert.equal(proposalRoutes.ok, true);
    const budgetRoute = proposalRoutes.routes.find(row =>
        row.actionType === 'AUTHORIZE_BUDGET' && row.requiresTargetRegion === false);
    assert.ok(budgetRoute, 'Kanonik yürütme başkanı ülke kapsamlı bütçe teklifi rotası taşımalı.');
    const beforeUnauthorizedIntent = JSON.stringify(runtime.api.conversationSessionSnapshot());
    assert.equal(runtime.api.conversationMeetingMotionPropose(meeting.id,
        'Sanayi yatırımı kaynak tahsisi kurum planına bağlansın.',
        { actionType: 'REVIEW_LEGALITY' }).code, 'ACTOR_NOT_AUTHORIZED_TO_PROPOSE');
    assert.equal(JSON.stringify(runtime.api.conversationSessionSnapshot()), beforeUnauthorizedIntent);
    const motionProposed = runtime.api.conversationMeetingMotionPropose(meeting.id,
        'Sanayi yatırımı kaynak tahsisi ve kurum denetimi birlikte yazılı plana bağlansın.',
        { actionType: budgetRoute.actionType });
    assert.equal(motionProposed.ok, true);
    assert.equal(motionProposed.motion.status, 'PENDING_CHAIR_REVIEW');
    assert.equal(motionProposed.motion.proposalIntent.actionType, 'AUTHORIZE_BUDGET');
    assert.equal(motionProposed.motion.proposalIntent.motionVersionId,
        motionProposed.motion.activeVersionId);
    assert.equal(motionProposed.worldMutation, false);
    const motionReviewed = runtime.api.conversationMeetingMotionChairReview(
        meeting.id, motionProposed.motion.id
    );
    assert.equal(motionReviewed.ok, true);
    assert.equal(motionReviewed.motion.status, 'IN_ORDER');
    assert.equal(motionReviewed.motion.chairReview.authoritySource, 'CANONICAL_INSTITUTION_OFFICE');
    assert.ok(motionReviewed.motion.chairReview.matchedAgendaTerms.length > 0);
    assert.equal(motionReviewed.turn.kind, 'CHAIR_MOTION_RULING');
    assert.equal(runtime.api.conversationMeetingMotionChairReview(
        meeting.id, motionProposed.motion.id).code, 'MEETING_MOTION_ALREADY_REVIEWED');
    assert.equal(runtime.api.conversationMeetingGet(meeting.id)
        .speakingOrderActorIds[runtime.api.conversationMeetingGet(meeting.id).currentSpeakerIndex],
    opened.session.playerActorId);
    runtime.dom.window.storyConversationWorkspaceOpen(listener.id, listener.name, sessionId);
    const meetingDraft = runtime.dom.window.document.querySelector('[data-conversation-meeting-player-turn]');
    assert.ok(meetingDraft, 'Oyuncunun toplantı söz sırası için metin alanı görünmeli.');
    meetingDraft.value = 'Yazmakta olduğum toplantı sözü arka plan yanıtıyla silinmemeli.';
    meetingDraft.focus();
    meetingDraft.setSelectionRange(18, 31);
    const visibleResponseId = runtime.api.conversationSessionGet(sessionId).listenerResponses[0].id;
    runtime.dom.window.storyConversationWorkspaceResponseSettled(visibleResponseId);
    assert.equal(runtime.dom.window.document.querySelector('[data-conversation-meeting-player-turn]'), meetingDraft,
        'Arka plan yanıtı odaktaki toplantı düzenleyicisini yeniden yaratmamalı.');
    assert.equal(meetingDraft.value,
        'Yazmakta olduğum toplantı sözü arka plan yanıtıyla silinmemeli.');
    assert.equal(meetingDraft.selectionStart, 18);
    assert.equal(meetingDraft.selectionEnd, 31);
    assert.equal(runtime.dom.window.document.getElementById('conversation-workspace-modal')
        .dataset.pendingConversationRender, '1');
    assert.match(runtime.dom.window.document.getElementById('conversation-workspace-modal').textContent,
        /USULE UYGUN/);
    runtime.dom.window.storyConversationWorkspaceClose();

    const unrelatedMotion = runtime.api.conversationMeetingMotionPropose(meeting.id,
        'Ay kolonilerinde şiir yarışması düzenlenmesi için ayrı bir takvim hazırlansın.');
    assert.equal(unrelatedMotion.ok, true);
    assert.equal(runtime.api.conversationMeetingMotionChairReview(
        meeting.id, unrelatedMotion.motion.id).code, 'MEETING_CHAIR_TURN_REQUIRED');
    assert.equal(runtime.api.conversationMeetingSubmitPlayerTurn(meeting.id,
        'İlk önergenin usul kaydını gördüm; diğer katılımcıların sözünü dinliyorum.', null).ok, true);
    while (runtime.api.conversationMeetingGet(meeting.id)
        .speakingOrderActorIds[runtime.api.conversationMeetingGet(meeting.id).currentSpeakerIndex]
        !== meeting.chair.actorId) {
        assert.equal(runtime.api.conversationMeetingGenerateCharacterTurn(meeting.id, null).ok, true);
    }
    const unrelatedReview = runtime.api.conversationMeetingMotionChairReview(
        meeting.id, unrelatedMotion.motion.id
    );
    assert.equal(unrelatedReview.ok, true);
    assert.equal(unrelatedReview.motion.status, 'OUT_OF_ORDER');
    assert.equal(unrelatedReview.motion.chairReview.matchedAgendaTerms.length, 0);

    assert.equal(runtime.api.conversationMeetingMotionRespond(
        meeting.id, motionProposed.motion.id).code, 'MEETING_CHARACTER_TURN_REQUIRED');
    assert.equal(runtime.api.conversationMeetingSubmitPlayerTurn(meeting.id,
        'Usule uygun önerge için katılımcıların kaynaklı itirazlarını dinlemek istiyorum.', null).ok, true);
    const responseMeeting = runtime.api.conversationMeetingGet(meeting.id);
    const respondingActorId = responseMeeting.speakingOrderActorIds[responseMeeting.currentSpeakerIndex];
    const opposeFactId = 'world-fact:meeting-test:motion-opposition';
    const opposeBeliefId = 'actor-belief:meeting-test:motion-opposition';
    identities.worldFacts[opposeFactId] = {
        id: opposeFactId, factType: 'MEETING_POLICY_POSITION', subjectActorId: respondingActorId,
        countryId: meeting.countryId,
        publicSummary: 'Sanayi kaynak tahsisi denetim güvencesi kurulmadan uygulanmamalı.',
        position: 'OPPOSE', visibility: 'INSTITUTIONAL', occurredAt: story.clock,
        originEventId: 'event:meeting-test:motion-opposition', version: 1
    };
    identities.actorBeliefs[opposeBeliefId] = {
        id: opposeBeliefId, holderActorId: respondingActorId, holderCountryId: meeting.countryId,
        worldFactId: opposeFactId, beliefStatus: 'VERIFIED', confidenceBps: 10000,
        learnedAt: story.clock + 10,
        source: { type: 'INSTITUTIONAL_RECORD', eventId: 'event:meeting-test:motion-opposition' }
    };
    const objection = runtime.api.conversationMeetingMotionRespond(meeting.id, motionProposed.motion.id);
    assert.equal(objection.ok, true);
    assert.equal(objection.response.kind, 'OBJECTION');
    assert.equal(objection.response.status, 'OPEN');
    assert.equal(objection.response.actorId, respondingActorId);
    assert.ok(objection.response.sourceRefs.includes(opposeBeliefId));
    assert.equal(objection.turn.kind, 'MOTION_OBJECTION');
    assert.match(objection.turn.text, /itiraz ediyorum/i);
    const amendmentMeeting = runtime.api.conversationMeetingGet(meeting.id);
    const amendmentActorId = amendmentMeeting.speakingOrderActorIds[amendmentMeeting.currentSpeakerIndex];
    const amendmentFactId = 'world-fact:meeting-test:motion-amendment';
    const amendmentBeliefId = 'actor-belief:meeting-test:motion-amendment';
    identities.worldFacts[amendmentFactId] = {
        id: amendmentFactId, factType: 'MEETING_POLICY_POSITION', subjectActorId: amendmentActorId,
        countryId: meeting.countryId,
        publicSummary: 'Sanayi yatırımında kapsam ve denetim koşulları önergeye eklenmeli.',
        position: 'AMEND', visibility: 'INSTITUTIONAL', occurredAt: story.clock,
        originEventId: 'event:meeting-test:motion-amendment', version: 1
    };
    identities.actorBeliefs[amendmentBeliefId] = {
        id: amendmentBeliefId, holderActorId: amendmentActorId, holderCountryId: meeting.countryId,
        worldFactId: amendmentFactId, beliefStatus: 'VERIFIED', confidenceBps: 10000,
        learnedAt: story.clock + 11,
        source: { type: 'INSTITUTIONAL_RECORD', eventId: 'event:meeting-test:motion-amendment' }
    };
    const amendment = runtime.api.conversationMeetingMotionRespond(meeting.id, motionProposed.motion.id);
    assert.equal(amendment.ok, true);
    assert.equal(amendment.response.kind, 'AMENDMENT_REQUEST');
    assert.match(amendment.turn.text, /Değişiklik talebimi/i);
    const endorsementMeeting = runtime.api.conversationMeetingGet(meeting.id);
    assert.equal(endorsementMeeting.speakingOrderActorIds[endorsementMeeting.currentSpeakerIndex],
        meeting.chair.actorId);
    const endorsement = runtime.api.conversationMeetingMotionRespond(meeting.id, motionProposed.motion.id);
    assert.equal(endorsement.ok, true);
    assert.equal(endorsement.response.kind, 'ENDORSEMENT');
    assert.equal(endorsement.response.status, 'NOTED');
    runtime.dom.window.storyConversationWorkspaceOpen(listener.id, listener.name, sessionId);
    assert.match(runtime.dom.window.document.getElementById('conversation-workspace-modal').textContent,
        /İTİRAZ/);
    assert.match(runtime.dom.window.document.getElementById('conversation-workspace-modal').textContent,
        /DEĞİŞİKLİK TALEBİ/);
    assert.match(runtime.dom.window.document.getElementById('conversation-workspace-modal').textContent,
        /DESTEK/);
    assert.ok(runtime.dom.window.document.querySelector('[data-conversation-amendment-decision="ACCEPT"]'));
    runtime.dom.window.storyConversationWorkspaceClose();

    assert.equal(runtime.api.conversationMeetingMotionAmendmentDecision(
        meeting.id, motionProposed.motion.id, amendment.response.id, 'ACCEPT',
        motionProposed.motion.text).code, 'MEETING_AMENDMENT_TEXT_INVALID');
    const revisedText = 'Sanayi yatırımı kaynak tahsisi; kapsam, sorumluluk ve bağımsız kurum denetimi yazılı plana bağlansın.';
    const amendmentAccepted = runtime.api.conversationMeetingMotionAmendmentDecision(
        meeting.id, motionProposed.motion.id, amendment.response.id, 'ACCEPT', revisedText
    );
    assert.equal(amendmentAccepted.ok, true);
    assert.equal(amendmentAccepted.response.status, 'ACCEPTED');
    assert.equal(amendmentAccepted.motion.status, 'PENDING_CHAIR_REVIEW');
    assert.equal(amendmentAccepted.motion.versions.length, 2);
    assert.equal(amendmentAccepted.motion.versions[0].status, 'SUPERSEDED');
    assert.equal(amendmentAccepted.motion.versions[1].status, 'ACTIVE');
    assert.equal(amendmentAccepted.motion.proposalIntent, null);
    runtime.dom.window.storyConversationWorkspaceOpen(listener.id, listener.name, sessionId);
    assert.ok(runtime.dom.window.document.querySelector(
        `[data-conversation-motion-intent-set="${motionProposed.motion.id}"]`));
    runtime.dom.window.storyConversationWorkspaceClose();
    assert.equal(amendmentAccepted.motion.versions[1].sourceResponseId, amendment.response.id);
    assert.equal(amendmentAccepted.motion.text, revisedText);
    assert.equal(amendmentAccepted.motion.chairReview, null);
    assert.equal(amendmentAccepted.turn.kind, 'MOTION_AMENDMENT_ACCEPTED');
    assert.equal(runtime.api.conversationMeetingMotionAmendmentDecision(
        meeting.id, motionProposed.motion.id, amendment.response.id, 'REJECT', null).code,
    'MEETING_AMENDMENT_ALREADY_DECIDED');
    while (runtime.api.conversationMeetingGet(meeting.id)
        .speakingOrderActorIds[runtime.api.conversationMeetingGet(meeting.id).currentSpeakerIndex]
        !== meeting.chair.actorId) {
        assert.equal(runtime.api.conversationMeetingGenerateCharacterTurn(meeting.id, null).ok, true);
    }
    const revisedReview = runtime.api.conversationMeetingMotionChairReview(
        meeting.id, motionProposed.motion.id
    );
    assert.equal(revisedReview.ok, true);
    assert.equal(revisedReview.motion.status, 'IN_ORDER');
    assert.equal(revisedReview.motion.activeVersionId, amendmentAccepted.motion.versions[1].id);
    assert.equal(revisedReview.motion.versions[1].chairReview.rulingTurnId, revisedReview.turn.id);
    const reboundIntent = runtime.api.conversationMeetingMotionProposalIntentSet(
        meeting.id, motionProposed.motion.id, { actionType: budgetRoute.actionType }
    );
    assert.equal(reboundIntent.ok, true);
    assert.equal(reboundIntent.proposalIntent.motionVersionId, revisedReview.motion.activeVersionId);
    assert.equal(runtime.api.conversationMeetingMotionOpenVote(
        meeting.id, motionProposed.motion.id).code, 'MEETING_VOTE_UNRESOLVED_OBJECTION');
    runtime.dom.window.storyConversationWorkspaceOpen(listener.id, listener.name, sessionId);
    const revisedUiText = runtime.dom.window.document.getElementById('conversation-workspace-modal').textContent;
    assert.match(revisedUiText, /ÖNERGE 1 · SÜRÜM 2/);
    assert.match(revisedUiText, /KABUL EDİLDİ/);
    assert.doesNotMatch(revisedUiText, /ACCEPTED|REJECTED|PENDING_CHAIR_REVIEW/);
    assert.ok(runtime.dom.window.document.querySelector('[data-conversation-objection-refer]'));
    runtime.dom.window.storyConversationWorkspaceClose();

    const objectionReferred = runtime.api.conversationMeetingObjectionRefer(
        meeting.id, motionProposed.motion.id, objection.response.id
    );
    assert.equal(objectionReferred.ok, true);
    assert.equal(objectionReferred.response.status, 'REFERRED_TO_CHAIR');
    assert.equal(objectionReferred.turn.kind, 'MOTION_OBJECTION_REFERRED');
    assert.equal(runtime.api.conversationMeetingObjectionChairRule(
        meeting.id, motionProposed.motion.id, objection.response.id).code,
    'MEETING_CHAIR_TURN_REQUIRED');
    while (runtime.api.conversationMeetingGet(meeting.id)
        .speakingOrderActorIds[runtime.api.conversationMeetingGet(meeting.id).currentSpeakerIndex]
        !== meeting.chair.actorId) {
        assert.equal(runtime.api.conversationMeetingGenerateCharacterTurn(meeting.id, null).ok, true);
    }
    const objectionRuled = runtime.api.conversationMeetingObjectionChairRule(
        meeting.id, motionProposed.motion.id, objection.response.id
    );
    assert.equal(objectionRuled.ok, true);
    assert.equal(objectionRuled.response.status, 'RESOLVED_FOR_PROCEDURE');
    assert.equal(objectionRuled.response.resolution.ruling, 'MOOT_BY_REVISION');
    assert.equal(objectionRuled.response.resolution.preservesDissent, false);
    assert.equal(objectionRuled.turn.kind, 'MOTION_OBJECTION_CHAIR_RULING');
    runtime.dom.window.storyConversationWorkspaceOpen(listener.id, listener.name, sessionId);
    const ruledUiText = runtime.dom.window.document.getElementById('conversation-workspace-modal').textContent;
    assert.match(ruledUiText, /USULEN ÇÖZÜLDÜ/);
    assert.doesNotMatch(ruledUiText, /REFERRED_TO_CHAIR|RESOLVED_FOR_PROCEDURE/);
    runtime.dom.window.storyConversationWorkspaceClose();

    assert.equal(runtime.api.conversationMeetingMotionOpenVote(
        meeting.id, motionProposed.motion.id).code, 'MEETING_CHAIR_TURN_REQUIRED');
    assert.equal(runtime.api.conversationMeetingSubmitPlayerTurn(meeting.id,
        'Usul borçları kapandı; güncel önerge sürümünün oylamaya açılmasını istiyorum.', null).ok, true);
    while (runtime.api.conversationMeetingGet(meeting.id)
        .speakingOrderActorIds[runtime.api.conversationMeetingGet(meeting.id).currentSpeakerIndex]
        !== meeting.chair.actorId) {
        assert.equal(runtime.api.conversationMeetingGenerateCharacterTurn(meeting.id, null).ok, true);
    }
    runtime.dom.window.storyConversationWorkspaceOpen(listener.id, listener.name, sessionId);
    assert.ok(runtime.dom.window.document.querySelector('[data-conversation-motion-vote-open]'));
    runtime.dom.window.storyConversationWorkspaceClose();
    const voteOpened = runtime.api.conversationMeetingMotionOpenVote(
        meeting.id, motionProposed.motion.id
    );
    assert.equal(voteOpened.ok, true);
    assert.equal(voteOpened.voting.status, 'OPEN');
    assert.equal(voteOpened.voting.motionVersionId, amendmentAccepted.motion.versions[1].id);
    assert.equal(voteOpened.turn.kind, 'MOTION_VOTE_OPENED');
    assert.equal(runtime.api.conversationMeetingMotionOpenVote(
        meeting.id, motionProposed.motion.id).code, 'MEETING_VOTE_ALREADY_OPENED');
    assert.equal(runtime.api.conversationMeetingMotionCastVote(
        meeting.id, motionProposed.motion.id, 'MAYBE').code, 'MEETING_PLAYER_VOTE_INVALID');
    runtime.dom.window.storyConversationWorkspaceOpen(listener.id, listener.name, sessionId);
    assert.match(runtime.dom.window.document.getElementById('conversation-workspace-modal').textContent,
        /OYLAMA AÇIK/);
    assert.ok(runtime.dom.window.document.querySelector('[data-conversation-motion-vote="YES"]'));
    runtime.dom.window.storyConversationWorkspaceClose();
    const playerVote = runtime.api.conversationMeetingMotionCastVote(
        meeting.id, motionProposed.motion.id, 'YES'
    );
    assert.equal(playerVote.ok, true);
    assert.equal(playerVote.vote.choice, 'YES');
    assert.equal(playerVote.outcomeReceipt, null);
    let completedVote = null;
    for (let voteIndex = 1; voteIndex < meeting.participantActorIds.length; voteIndex++) {
        const result = runtime.api.conversationMeetingMotionCastVote(
            meeting.id, motionProposed.motion.id, null
        );
        assert.equal(result.ok, true);
        completedVote = result;
    }
    assert.ok(completedVote.outcomeReceipt);
    assert.equal(completedVote.outcomeReceipt.schemaVersion, 2);
    assert.equal(JSON.stringify(completedVote.outcomeReceipt.relationshipResultReceiptIds), '[]');
    assert.ok(['ADOPTED', 'REJECTED'].includes(completedVote.outcomeReceipt.decision));
    assert.equal(Object.values(completedVote.outcomeReceipt.tally)
        .reduce((sum, value) => sum + value, 0), meeting.participantActorIds.length);
    assert.equal(completedVote.outcomeReceipt.physicalMutation, false);
    assert.equal(completedVote.motion.voting.status, 'COMPLETED');
    assert.equal(completedVote.motion.outcomeReceiptId, completedVote.outcomeReceipt.id);
    runtime.dom.window.storyConversationWorkspaceOpen(listener.id, listener.name, sessionId);
    const completedVoteUi = runtime.dom.window.document.getElementById('conversation-workspace-modal').textContent;
    assert.match(completedVoteUi, /OYLAMA · TAMAMLANDI/);
    assert.match(completedVoteUi, /TOPLANTI SONUÇ KAYDI · DÜNYAYA HENÜZ UYGULANMADI/);
    assert.doesNotMatch(completedVoteUi, /ADOPTED|REJECTED|ABSTAIN|\bYES\b/);
    runtime.dom.window.storyConversationWorkspaceClose();

    const openMeetingSnapshot = runtime.api.conversationSessionSnapshot();
    assert.equal(runtime.api.conversationSessionRestore(openMeetingSnapshot).schemaVersion, 7);
    assert.equal(runtime.api.conversationMeetingGet(meeting.id).status, 'OPEN_NO_DECISION_ADAPTER');
    assert.equal(JSON.stringify(runtime.api.conversationSessionSnapshot()),
        JSON.stringify(openMeetingSnapshot));
    const closeBeforeChair = JSON.stringify(runtime.api.conversationSessionSnapshot());
    assert.equal(runtime.api.conversationMeetingClose(
        meeting.id, completedVote.outcomeReceipt.id).code, 'MEETING_CHAIR_TURN_REQUIRED');
    assert.equal(JSON.stringify(runtime.api.conversationSessionSnapshot()), closeBeforeChair);
    while (runtime.api.conversationMeetingGet(meeting.id)
        .speakingOrderActorIds[runtime.api.conversationMeetingGet(meeting.id).currentSpeakerIndex]
        !== meeting.chair.actorId) {
        const currentActorId = runtime.api.conversationMeetingGet(meeting.id)
            .speakingOrderActorIds[runtime.api.conversationMeetingGet(meeting.id).currentSpeakerIndex];
        const advanced = currentActorId === opened.session.playerActorId
            ? runtime.api.conversationMeetingSubmitPlayerTurn(meeting.id,
                'Oylama tamamlandı; başkanın kapanış tutanağını bekliyorum.', null)
            : runtime.api.conversationMeetingGenerateCharacterTurn(meeting.id, null);
        assert.equal(advanced.ok, true);
    }
    runtime.dom.window.storyConversationWorkspaceOpen(listener.id, listener.name, sessionId);
    assert.ok(runtime.dom.window.document.querySelector('[data-conversation-meeting-close]'));
    runtime.dom.window.storyConversationWorkspaceClose();
    const meetingPlayerActorId = opened.session.playerActorId;
    const meetingObserverActorIds = meeting.participantActorIds.filter(row =>
        row !== meetingPlayerActorId);
    const meetingReverseBefore = Object.fromEntries(meetingObserverActorIds.map(actorId => [
        actorId, JSON.stringify(runtime.api.relationshipView(meetingPlayerActorId, actorId))
    ]));
    const healthyMeetingRelationships = runtime.api.relationshipLedger();
    let meetingLimitFixtureSequence = 1;
    while (Object.keys(story.characterRelationships.resultReceipts).length < 256) {
        story.characterRelationships.resultReceipts[
            `relationship-result:meeting-limit-fixture:${meetingLimitFixtureSequence++}`
        ] = {};
    }
    const meetingLimitBefore = JSON.stringify({
        conversation: story.conversationUnderstanding,
        relationships: story.characterRelationships
    });
    const failedLimitClose = runtime.api.conversationMeetingClose(
        meeting.id, completedVote.outcomeReceipt.id
    );
    assert.equal(failedLimitClose.ok, false);
    assert.equal(failedLimitClose.rolledBack, true);
    assert.equal(JSON.stringify({
        conversation: story.conversationUnderstanding,
        relationships: story.characterRelationships
    }), meetingLimitBefore, 'A receipt-cap rejection must leave the whole meeting closure untouched.');
    runtime.api.relationshipRestore(healthyMeetingRelationships);
    assert.equal(runtime.api.conversationSessionValidate(story.conversationUnderstanding).ok, true);
    const relationshipsBeforeAdoptedClose = runtime.api.relationshipLedger();
    const closedMeeting = runtime.api.conversationMeetingClose(
        meeting.id, completedVote.outcomeReceipt.id
    );
    assert.equal(closedMeeting.ok, true);
    assert.equal(closedMeeting.closure.outcomeReceiptId, completedVote.outcomeReceipt.id);
    assert.equal(closedMeeting.closure.relationshipResultReceiptIds.length,
        meetingObserverActorIds.length);
    const adoptedOutcome = runtime.api.conversationMeetingGet(meeting.id).outcomeReceipts.find(row =>
        row.id === completedVote.outcomeReceipt.id);
    assert.equal(JSON.stringify(closedMeeting.closure.relationshipResultReceiptIds),
        JSON.stringify(adoptedOutcome.relationshipResultReceiptIds));
    const adoptedVotes = runtime.api.conversationMeetingGet(meeting.id).votes.filter(row =>
        adoptedOutcome.voteIds.includes(row.id));
    const adoptedPlayerVote = adoptedVotes.find(row => row.actorId === meetingPlayerActorId);
    for (let observerIndex = 0; observerIndex < meetingObserverActorIds.length; observerIndex++) {
        const observerActorId = meetingObserverActorIds[observerIndex];
        const observerVote = adoptedVotes.find(row => row.actorId === observerActorId);
        const relationshipReceipt = runtime.api.relationshipResultReceipt(
            adoptedOutcome.relationshipResultReceiptIds[observerIndex]
        );
        assert.equal(relationshipReceipt.fromActorId, observerActorId);
        assert.equal(relationshipReceipt.toActorId, meetingPlayerActorId);
        assert.equal(relationshipReceipt.sourceReceiptId, adoptedOutcome.id);
        const sharedSuccess = adoptedOutcome.decision === 'ADOPTED'
            && adoptedPlayerVote.choice === 'YES' && observerVote.choice === 'YES';
        assert.equal(relationshipReceipt.decision, sharedSuccess ? 'APPLIED' : 'NO_CHANGE');
        assert.equal(JSON.stringify(runtime.api.relationshipView(meetingPlayerActorId, observerActorId)),
            meetingReverseBefore[observerActorId]);
    }
    assert.equal(closedMeeting.closure.decision, completedVote.outcomeReceipt.decision);
    assert.equal(closedMeeting.closure.proposalId, null);
    assert.equal(closedMeeting.closure.physicalMutation, false);
    const adoptedRelationshipSnapshot = runtime.api.relationshipLedger();
    const duplicateCloseRelationships = JSON.stringify(adoptedRelationshipSnapshot);
    assert.equal(runtime.api.conversationMeetingClose(
        meeting.id, completedVote.outcomeReceipt.id).code, 'MEETING_ALREADY_CLOSED');
    assert.equal(JSON.stringify(runtime.api.relationshipLedger()), duplicateCloseRelationships);
    assert.equal(runtime.api.conversationMeetingClosureGet(closedMeeting.closure.id).id,
        closedMeeting.closure.id);
    const liveMotion = story.conversationUnderstanding.meetingCases
        .find(row => row.id === meeting.id).motions
        .find(row => row.id === motionProposed.motion.id);
    const authorizedActionType = liveMotion.proposalIntent.actionType;
    liveMotion.proposalIntent.actionType = 'REVIEW_LEGALITY';
    const unauthorizedRouteBefore = JSON.stringify({
        conversation: story.conversationUnderstanding,
        institutions: story.institutions,
        physical: physicalSnapshot()
    });
    assert.equal(runtime.api.conversationMeetingClosureRoute(
        closedMeeting.closure.id).code, 'ACTOR_NOT_AUTHORIZED_TO_PROPOSE');
    assert.equal(JSON.stringify({
        conversation: story.conversationUnderstanding,
        institutions: story.institutions,
        physical: physicalSnapshot()
    }), unauthorizedRouteBefore);
    liveMotion.proposalIntent.actionType = authorizedActionType;
    const physicalBeforeProposalRoute = physicalSnapshot();
    const institutionRequestCountBefore = Object.keys(story.institutions.requests || {}).length;
    runtime.dom.window.storyConversationWorkspaceOpen(listener.id, listener.name, sessionId);
    const routeClosureButton = runtime.dom.window.document.querySelector(
        '[data-conversation-meeting-route-closure]'
    );
    assert.ok(routeClosureButton);
    runtime.dom.window.storyConversationWorkspaceHandleClick({ target: routeClosureButton });
    runtime.dom.window.storyConversationWorkspaceHandleClick({ target: routeClosureButton });
    const routedClosure = runtime.api.conversationMeetingClosureGet(closedMeeting.closure.id);
    assert.equal(routedClosure.status, 'CLOSED_ADOPTED_PROPOSAL_ROUTED');
    assert.equal(routedClosure.proposalActionType, authorizedActionType);
    assert.ok(routedClosure.proposalId);
    assert.equal(Object.keys(story.institutions.requests || {}).length,
        institutionRequestCountBefore + 1);
    assert.equal(physicalSnapshot(), physicalBeforeProposalRoute);
    assert.equal(runtime.api.conversationMeetingClosureRoute(
        closedMeeting.closure.id).code, 'MEETING_PROPOSAL_ALREADY_ROUTED');
    assert.equal(Object.keys(story.institutions.requests || {}).length,
        institutionRequestCountBefore + 1);
    const proposalTrace = runtime.api.conversationMeetingClosureTraceByProposal(
        routedClosure.proposalId
    );
    assert.equal(proposalTrace.ok, true);
    assert.equal(proposalTrace.meetingClosureId, closedMeeting.closure.id);
    assert.equal(proposalTrace.outcomeReceiptId, completedVote.outcomeReceipt.id);
    assert.equal(proposalTrace.motionVersionId, completedVote.motion.activeVersionId);
    assert.equal(proposalTrace.institutionRequest.id, routedClosure.proposalId);
    const routedUiText = runtime.dom.window.document
        .getElementById('conversation-workspace-modal').textContent;
    assert.match(routedUiText, /TEKLİF KAYDI · HENÜZ ONAY VEYA UYGULAMA DEĞİL/);
    assert.match(routedUiText, new RegExp(routedClosure.proposalId));
    assert.equal(runtime.dom.window.document.querySelector(
        '[data-conversation-meeting-motion-propose]'), null);
    assert.equal(runtime.dom.window.document.querySelector(
        '[data-conversation-meeting-motion-review], [data-conversation-meeting-motion-respond], [data-conversation-motion-vote-open], [data-conversation-motion-vote], [data-conversation-motion-intent-set]'), null);
    assert.ok(runtime.dom.window.document.querySelector('.conversation-meeting-private-list'));
    assert.equal(runtime.dom.window.document.querySelector(
        '[data-conversation-meeting-private-reply]'), null);
    assert.match(routedUiText, /TOPLANTI KAPANDI · ÖZEL YAZIŞMA YALNIZ OKUNABİLİR/);
    runtime.dom.window.storyConversationWorkspaceClose();
    const adoptedClosedSnapshot = runtime.api.conversationSessionSnapshot();
    const rejectedOpenSnapshot = JSON.parse(JSON.stringify(openMeetingSnapshot));
    const rejectedMeeting = rejectedOpenSnapshot.meetingCases.find(row => row.id === meeting.id);
    const rejectedReceipt = rejectedMeeting.outcomeReceipts.find(row =>
        row.id === completedVote.outcomeReceipt.id);
    const rejectedVotes = rejectedMeeting.votes.filter(row =>
        rejectedReceipt.voteIds.includes(row.id));
    for (const vote of rejectedVotes) vote.choice = 'NO';
    rejectedReceipt.tally = { yes: 0, no: rejectedVotes.length, abstain: 0 };
    rejectedReceipt.decision = 'REJECTED';
    runtime.api.relationshipRestore(relationshipsBeforeAdoptedClose);
    assert.equal(runtime.api.conversationSessionValidate(rejectedOpenSnapshot).ok, true);
    runtime.api.conversationSessionRestore(rejectedOpenSnapshot);
    while (runtime.api.conversationMeetingGet(meeting.id)
        .speakingOrderActorIds[runtime.api.conversationMeetingGet(meeting.id).currentSpeakerIndex]
        !== meeting.chair.actorId) {
        const currentActorId = runtime.api.conversationMeetingGet(meeting.id)
            .speakingOrderActorIds[runtime.api.conversationMeetingGet(meeting.id).currentSpeakerIndex];
        const advanced = currentActorId === opened.session.playerActorId
            ? runtime.api.conversationMeetingSubmitPlayerTurn(meeting.id,
                'Ret sonucunun başkan kapanış tutanağını bekliyorum.', null)
            : runtime.api.conversationMeetingGenerateCharacterTurn(meeting.id, null);
        assert.equal(advanced.ok, true);
    }
    const rejectedRequestCountBefore = Object.keys(story.institutions.requests || {}).length;
    const rejectedEdgesBefore = Object.fromEntries(meetingObserverActorIds.map(actorId => [
        actorId, JSON.stringify(runtime.api.relationshipView(actorId, meetingPlayerActorId))
    ]));
    const rejectedClosure = runtime.api.conversationMeetingClose(meeting.id, rejectedReceipt.id);
    assert.equal(rejectedClosure.ok, true);
    assert.equal(rejectedClosure.closure.status, 'CLOSED_REJECTED');
    assert.equal(rejectedClosure.closure.proposalStatus, 'NOT_APPLICABLE_REJECTED');
    assert.equal(rejectedClosure.closure.proposalId, null);
    for (const [observerIndex, relationshipReceiptId] of rejectedClosure.closure
        .relationshipResultReceiptIds.entries()) {
        const relationshipReceipt = runtime.api.relationshipResultReceipt(relationshipReceiptId);
        const observerActorId = meetingObserverActorIds[observerIndex];
        assert.equal(relationshipReceipt.decision, 'NO_CHANGE');
        assert.equal(relationshipReceipt.reason, 'MEETING_REJECTED');
        assert.equal(JSON.stringify(runtime.api.relationshipView(observerActorId, meetingPlayerActorId)),
            rejectedEdgesBefore[observerActorId]);
    }
    assert.equal(runtime.api.conversationMeetingClosureRoute(
        rejectedClosure.closure.id).code, 'MEETING_REJECTED_NO_PROPOSAL');
    assert.equal(Object.keys(story.institutions.requests || {}).length,
        rejectedRequestCountBefore);
    assert.equal(runtime.api.conversationSessionValidate(
        runtime.api.conversationSessionSnapshot()).ok, true);
    runtime.api.relationshipRestore(adoptedRelationshipSnapshot);
    runtime.api.conversationSessionRestore(adoptedClosedSnapshot);
    assert.equal(JSON.stringify(runtime.api.conversationSessionSnapshot()),
        JSON.stringify(adoptedClosedSnapshot));
    assert.equal(JSON.stringify(runtime.api.relationshipLedger()),
        JSON.stringify(adoptedRelationshipSnapshot));

    const completion = runtime.api.conversationSessionBegin('Merhaba, görev için geldim.', {
        listenerActorId: taskTargetActorId
    });
    assert.equal(completion.ok, true);
    const completedTask = runtime.api.conversationTaskOfferList(sessionId)[0];
    assert.equal(completedTask.status, 'COMPLETED');
    assert.equal(completedTask.completionSessionId, completion.session.id);
    const personalRelationshipReceipt = runtime.api.relationshipResultReceipt(
        completedTask.relationshipResultReceiptId
    );
    assert.equal(personalRelationshipReceipt.interpretationType, 'TASK_COMMITMENT_KEPT');
    assert.equal(personalRelationshipReceipt.fromActorId, completedTask.issuerActorId);
    assert.equal(personalRelationshipReceipt.toActorId, completedTask.assigneeActorId);
    assert.equal(JSON.stringify(runtime.api.relationshipView(
        completedTask.assigneeActorId, completedTask.issuerActorId
    )), personalReverseBefore);

    const beforeInvalid = runtime.api.conversationSessionCaseGet(sessionId);
    const invalid = runtime.api.conversationSessionSetMode(sessionId, 'MAKE_UP_A_REWARD');
    assert.equal(invalid.ok, false);
    assert.equal(invalid.code, 'CONVERSATION_MODE_INVALID');
    assert.equal(JSON.stringify(runtime.api.conversationSessionCaseGet(sessionId)), JSON.stringify(beforeInvalid));
    assert.equal(physicalSnapshot(), physicalBefore,
        'Konuşma türleri fiziksel dünyayı veya kampanya saatini değiştirmemeli.');

    runtime.api.conversationSessionSetMode(sessionId, 'TASKS_JOBS');
    const expiringTask = runtime.api.conversationTaskOfferCreate(sessionId).taskOffer;
    runtime.api.conversationTaskOfferDecision(expiringTask.id, 'ACCEPT');
    const clockBeforeExpiryProbe = story.clock;
    story.clock = expiringTask.dueAt + 1;
    assert.equal(runtime.api.conversationTaskOfferTick(), 1);
    assert.equal(runtime.api.conversationTaskOfferList(sessionId)
        .find(row => row.id === expiringTask.id).status, 'EXPIRED');
    story.clock = clockBeforeExpiryProbe;

    const snapshot = runtime.api.conversationSessionSnapshot();
    assert.equal(runtime.api.conversationSessionValidate(snapshot).ok, true);
    const forgedMeeting = JSON.parse(JSON.stringify(snapshot));
    forgedMeeting.meetingCases[0].sessionId = 'conversation-session:missing';
    assert.ok(runtime.api.conversationSessionValidate(forgedMeeting).issues
        .some(row => row.code === 'MEETING_SESSION_REFERENCE'));
    const forgedGrounding = JSON.parse(JSON.stringify(snapshot));
    forgedGrounding.meetingCases[0].turns[0].sourceRefs = forgedGrounding.meetingCases[0]
        .turns[0].sourceRefs.filter(ref => ref !== publicBeliefId);
    assert.ok(runtime.api.conversationSessionValidate(forgedGrounding).issues
        .some(row => row.code === 'MEETING_TURNS'));
    const forgedStance = JSON.parse(JSON.stringify(snapshot));
    forgedStance.meetingCases[0].turns[0].stance.rawPersonalityAxesExposed = true;
    assert.ok(runtime.api.conversationSessionValidate(forgedStance).issues
        .some(row => row.code === 'MEETING_TURNS'));
    const forgedMotion = JSON.parse(JSON.stringify(snapshot));
    forgedMotion.meetingCases[0].motions[0].chairReview.rulingTurnId = 'meeting-turn:missing';
    assert.ok(runtime.api.conversationSessionValidate(forgedMotion).issues
        .some(row => row.code === 'MEETING_MOTIONS'));
    const forgedMotionResponse = JSON.parse(JSON.stringify(snapshot));
    forgedMotionResponse.meetingCases[0].motions[0].responses[0].actorId = opened.session.playerActorId;
    assert.ok(runtime.api.conversationSessionValidate(forgedMotionResponse).issues
        .some(row => row.code === 'MEETING_MOTIONS'));
    const forgedObjectionRuling = JSON.parse(JSON.stringify(snapshot));
    forgedObjectionRuling.meetingCases[0].motions[0].responses[0]
        .resolution.chairActorId = opened.session.playerActorId;
    assert.ok(runtime.api.conversationSessionValidate(forgedObjectionRuling).issues
        .some(row => row.code === 'MEETING_MOTIONS'));
    const forgedVote = JSON.parse(JSON.stringify(snapshot));
    forgedVote.meetingCases[0].votes[0].motionVersionId = forgedVote.meetingCases[0]
        .motions[0].versions[0].id;
    assert.ok(runtime.api.conversationSessionValidate(forgedVote).issues
        .some(row => row.code === 'MEETING_VOTES'));
    const forgedOutcome = JSON.parse(JSON.stringify(snapshot));
    forgedOutcome.meetingCases[0].outcomeReceipts[0].tally.yes += 1;
    assert.ok(runtime.api.conversationSessionValidate(forgedOutcome).issues
        .some(row => row.code === 'MEETING_OUTCOME_RECEIPTS'));
    const linkedCompletedTask = snapshot.taskOffers.find(row => row.id === taskCreated.taskOffer.id);
    const linkedTaskResult = runtime.api.relationshipApplyResult({
        sourceType: 'TASK_RESULT', sourceReceiptId: linkedCompletedTask.id,
        fromActorId: linkedCompletedTask.issuerActorId, toActorId: linkedCompletedTask.assigneeActorId,
        interpretationType: 'TASK_COMMITMENT_KEPT'
    });
    assert.equal(linkedTaskResult.applied, true);
    const linkedTaskLedger = JSON.parse(JSON.stringify(snapshot));
    linkedTaskLedger.taskOffers.find(row => row.id === linkedCompletedTask.id)
        .relationshipResultReceiptId = linkedTaskResult.receipt.id;
    assert.equal(runtime.api.conversationSessionValidate(linkedTaskLedger).ok, true);
    const forgedTaskRelationshipLink = JSON.parse(JSON.stringify(linkedTaskLedger));
    forgedTaskRelationshipLink.taskOffers.find(row => row.id === linkedCompletedTask.id)
        .relationshipResultReceiptId = 'relationship-result:missing';
    assert.ok(runtime.api.conversationSessionValidate(forgedTaskRelationshipLink).issues
        .some(row => row.code === 'TASK_OFFER_RELATIONSHIP_RESULT_LINK'));
    const forgedOutcomeRelationshipLink = JSON.parse(JSON.stringify(snapshot));
    forgedOutcomeRelationshipLink.meetingCases[0].outcomeReceipts[0]
        .relationshipResultReceiptIds = ['relationship-result:missing'];
    assert.ok(runtime.api.conversationSessionValidate(forgedOutcomeRelationshipLink).issues
        .some(row => row.code === 'MEETING_OUTCOME_RECEIPTS'));
    const forgedClosure = JSON.parse(JSON.stringify(snapshot));
    forgedClosure.meetingClosures[0].closingTurnId = 'meeting-turn:forged';
    assert.ok(runtime.api.conversationSessionValidate(forgedClosure).issues
        .some(row => row.code === 'MEETING_CLOSURES'));
    const forgedMotionVersion = JSON.parse(JSON.stringify(snapshot));
    forgedMotionVersion.meetingCases[0].motions[0].versions[1].text = 'Kaynak dışı sahte sürüm';
    assert.ok(runtime.api.conversationSessionValidate(forgedMotionVersion).issues
        .some(row => row.code === 'MEETING_MOTIONS'));
    const forgedPrivateVisibility = JSON.parse(JSON.stringify(snapshot));
    const note = forgedPrivateVisibility.meetingCases[0].privateNotes[0];
    const uninvolvedVisibility = forgedPrivateVisibility.meetingCases[0].visibilityMatrix.find(row =>
        row.actorId !== note.authorActorId && row.actorId !== note.recipientActorId);
    uninvolvedVisibility.visiblePrivateNoteIds.push(note.id);
    assert.ok(runtime.api.conversationSessionValidate(forgedPrivateVisibility).issues
        .some(row => row.code === 'MEETING_VISIBILITY_MATRIX'));
    const forgedReplyParent = JSON.parse(JSON.stringify(snapshot));
    const forgedReplyRows = forgedReplyParent.meetingCases[0].privateNotes
        .filter(row => row.kind === 'CHARACTER_REPLY');
    forgedReplyRows[0].replyToPrivateNoteId = forgedReplyRows[1].id;
    assert.ok(runtime.api.conversationSessionValidate(forgedReplyParent).issues
        .some(row => row.code === 'MEETING_PRIVATE_NOTES'));
    const forgedSecondReply = JSON.parse(JSON.stringify(snapshot));
    const forgedSecondMeeting = forgedSecondReply.meetingCases[0];
    const originalReply = forgedSecondMeeting.privateNotes.find(row =>
        row.kind === 'CHARACTER_REPLY');
    const duplicateReply = JSON.parse(JSON.stringify(originalReply));
    duplicateReply.sequence = forgedSecondMeeting.privateNotes.length + 1;
    duplicateReply.id = `${forgedSecondMeeting.id}:private-note:${duplicateReply.sequence}`;
    forgedSecondMeeting.privateNotes.push(duplicateReply);
    for (const row of forgedSecondMeeting.visibilityMatrix) {
        if (row.actorId === duplicateReply.authorActorId
            || row.actorId === duplicateReply.recipientActorId) {
            row.visiblePrivateNoteIds.push(duplicateReply.id);
        }
    }
    assert.ok(runtime.api.conversationSessionValidate(forgedSecondReply).issues
        .some(row => row.code === 'MEETING_PRIVATE_NOTES'));
    const forgedFutureTurnSource = JSON.parse(JSON.stringify(snapshot));
    const forgedFutureMeeting = forgedFutureTurnSource.meetingCases[0];
    const forgedFutureReply = forgedFutureMeeting.privateNotes.find(row =>
        row.kind === 'CHARACTER_REPLY');
    const futureTurn = forgedFutureMeeting.turns.find(row =>
        row.sequence > forgedFutureReply.publicTurnCountAtReply);
    forgedFutureReply.sourceRefs.push(futureTurn.id);
    assert.ok(runtime.api.conversationSessionValidate(forgedFutureTurnSource).issues
        .some(row => row.code === 'MEETING_PRIVATE_NOTES'));
    const forgedPrivateReplyGrounding = JSON.parse(JSON.stringify(snapshot));
    const privateGroundingReply = forgedPrivateReplyGrounding.meetingCases[0].privateNotes
        .find(row => row.kind === 'CHARACTER_REPLY' && row.grounding);
    privateGroundingReply.grounding.visibility = 'PRIVATE';
    assert.ok(runtime.api.conversationSessionValidate(forgedPrivateReplyGrounding).issues
        .some(row => row.code === 'MEETING_PRIVATE_NOTES'));
    assert.equal(runtime.api.conversationSessionRestore(snapshot).schemaVersion, 7);
    const restoredSnapshot = runtime.api.conversationSessionSnapshot();
    const restoreDifference = firstDifference(restoredSnapshot, snapshot);
    assert.equal(restoreDifference, null, `Kayıt geri yükleme farkı: ${JSON.stringify(restoreDifference)}`);

    const schemaSixLedger = JSON.parse(JSON.stringify(snapshot));
    schemaSixLedger.schemaVersion = 6;
    schemaSixLedger.adapterVersion = 'story-conversation-session-ledger-6';
    for (const oldTask of schemaSixLedger.taskOffers) {
        oldTask.schemaVersion = 2;
        delete oldTask.relationshipResultReceiptId;
        if (oldTask.institutional) {
            delete oldTask.institutional.relationshipResultReceiptId;
            if (oldTask.institutional.resultReceipt) {
                delete oldTask.institutional.resultReceipt.relationshipResultReceiptId;
            }
        }
    }
    for (const oldMeeting of schemaSixLedger.meetingCases) {
        for (const oldOutcome of oldMeeting.outcomeReceipts) {
            oldOutcome.schemaVersion = 1;
            delete oldOutcome.relationshipResultReceiptIds;
        }
    }
    for (const oldClosure of schemaSixLedger.meetingClosures) {
        delete oldClosure.relationshipResultReceiptIds;
    }
    const migratedSchemaSix = runtime.api.conversationSessionMigrate(schemaSixLedger);
    assert.equal(migratedSchemaSix.schemaVersion, 7);
    assert.ok(migratedSchemaSix.taskOffers.every(row => row.schemaVersion === 3
        && row.relationshipResultReceiptId === null
        && (!row.institutional || row.institutional.relationshipResultReceiptId === null)
        && (!row.institutional || !row.institutional.resultReceipt
            || row.institutional.resultReceipt.relationshipResultReceiptId === null)));
    assert.ok(migratedSchemaSix.meetingCases.every(row => row.outcomeReceipts.every(receipt =>
        receipt.schemaVersion === 2 && receipt.relationshipResultReceiptIds.length === 0)));
    assert.ok(migratedSchemaSix.meetingClosures.every(row =>
        row.relationshipResultReceiptIds.length === 0));
    assert.equal(runtime.api.conversationSessionValidate(migratedSchemaSix).ok, true);

    const legacy = JSON.parse(JSON.stringify(snapshot));
    legacy.schemaVersion = 3;
    legacy.adapterVersion = 'story-conversation-session-ledger-3';
    delete legacy.nextTaskOfferSequence;
    delete legacy.taskOffers;
    delete legacy.nextMeetingSequence;
    delete legacy.meetingCases;
    delete legacy.nextMeetingClosureSequence;
    delete legacy.meetingClosures;
    for (const session of legacy.sessions) {
        session.schemaVersion = 3;
        delete session.conversationCase;
    }
    const migrated = runtime.api.conversationSessionMigrate(legacy);
    assert.equal(migrated.schemaVersion, 7);
    assert.equal(migrated.adapterVersion, 'story-conversation-session-ledger-7');
    assert.ok(migrated.sessions.every(session => session.conversationCase
        && session.conversationCase.modeHistory.length === 1));
    assert.equal(runtime.api.conversationSessionValidate(migrated).ok, true);

    const schemaFiveLedger = JSON.parse(JSON.stringify(snapshot));
    schemaFiveLedger.schemaVersion = 5;
    schemaFiveLedger.adapterVersion = 'story-conversation-session-ledger-5';
    for (const session of schemaFiveLedger.sessions) session.schemaVersion = 5;
    for (const oldMeeting of schemaFiveLedger.meetingCases) {
        oldMeeting.privateNotes = oldMeeting.privateNotes
            .filter(row => row.kind === 'PLAYER_NOTE')
            .map((row, index) => {
                const legacyNote = {
                    schemaVersion: 1, id: `${oldMeeting.id}:private-note:${index + 1}`,
                    sequence: index + 1, authorActorId: row.authorActorId,
                    recipientActorId: row.recipientActorId, text: row.text,
                    visibility: row.visibility, sourceTurnId: null,
                    createdAt: row.createdAt, worldMutation: false
                };
                return legacyNote;
            });
        for (const visibility of oldMeeting.visibilityMatrix) {
            visibility.visiblePrivateNoteIds = oldMeeting.privateNotes.filter(note =>
                note.authorActorId === visibility.actorId
                || note.recipientActorId === visibility.actorId).map(note => note.id);
        }
    }
    const migratedSchemaFive = runtime.api.conversationSessionMigrate(schemaFiveLedger);
    assert.equal(migratedSchemaFive.schemaVersion, 7);
    assert.ok(migratedSchemaFive.meetingCases.every(row =>
        row.privateNotes.every(note => note.schemaVersion === 2
            && note.kind === 'PLAYER_NOTE'
            && note.replyToPrivateNoteId === null
            && note.sourceRefs.length === 0)));
    assert.equal(migratedSchemaFive.meetingCases
        .flatMap(row => row.privateNotes)
        .filter(note => note.kind === 'CHARACTER_REPLY').length, 0);
    assert.equal(runtime.api.conversationSessionValidate(migratedSchemaFive).ok, true);

    const preVersionLedger = JSON.parse(JSON.stringify(openMeetingSnapshot));
    preVersionLedger.meetingCases[0].votes = [];
    preVersionLedger.meetingCases[0].outcomeReceipts = [];
    preVersionLedger.meetingCases[0].outcomeReceiptId = null;
    for (const motion of preVersionLedger.meetingCases[0].motions) {
        delete motion.activeVersionId;
        delete motion.versions;
        delete motion.voting;
        delete motion.outcomeReceiptId;
        for (const response of motion.responses) {
            delete response.motionVersionId;
            if (response.status === 'OPEN' || response.status === 'NOTED') delete response.resolution;
        }
    }
    const migratedMotions = runtime.api.conversationSessionMigrate(preVersionLedger);
    assert.ok(migratedMotions.meetingCases[0].motions.every(motion =>
        motion.versions.length === 1 && motion.activeVersionId === motion.versions[0].id));
    assert.equal(runtime.api.conversationSessionValidate(migratedMotions).ok, true);

    process.stdout.write(`${JSON.stringify({
        ok: true,
        taskCompleted: completedTask.status,
        meetingParticipants: meeting.participants.length,
        meetingTurns: runtime.api.conversationMeetingGet(meeting.id).turns.length,
        motions: runtime.api.conversationMeetingGet(meeting.id).motions.map(row => row.status),
        motionResponses: runtime.api.conversationMeetingGet(meeting.id).motions[0].responses.map(row => row.kind),
        motionVersions: runtime.api.conversationMeetingGet(meeting.id).motions[0].versions.length,
        meetingChairInstitution: meeting.chair.institutionType,
        modeHistory: runtime.api.conversationSessionCaseGet(sessionId).modeHistory.length,
        privateNotes: runtime.api.conversationMeetingGet(meeting.id).privateNotes.length,
        privateReplies: runtime.api.conversationMeetingGet(meeting.id).privateNotes
            .filter(row => row.kind === 'CHARACTER_REPLY').length,
        migratedSessions: migrated.sessions.length,
        institutionalAccepted: institutionalTaskDecisions.accepted,
        institutionalDeclined: institutionalTaskDecisions.declined
    })}\n`);
} finally {
    runtime.dom.window.close();
}
