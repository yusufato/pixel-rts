'use strict';

const assert = require('node:assert/strict');
const { createRuntime } = require('../tools/story-sim-harness');

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
    assert.equal(taskCreated.taskOffer.status, 'OFFERED');
    assert.equal(taskCreated.taskOffer.authority.model, 'PERSONAL_REQUEST');
    assert.equal(taskCreated.taskOffer.authority.canCompel, false);
    assert.equal(taskCreated.taskOffer.reward.kind, 'NONE');
    const taskTargetActorId = taskCreated.taskOffer.objective.targetActorId;
    const taskAccepted = runtime.api.conversationTaskOfferDecision(taskCreated.taskOffer.id, 'ACCEPT');
    assert.equal(taskAccepted.ok, true);
    assert.equal(taskAccepted.taskOffer.status, 'ACCEPTED');

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
    const meetingUiText = runtime.dom.window.document.getElementById('conversation-workspace-modal').textContent;
    assert.doesNotMatch(meetingUiText, /OPEN_NO_DECISION_ADAPTER|KNOWN_PUBLIC_PROFILE/);
    assert.match(meetingUiText, /KARAR ADAPTÖRÜ YOK|DOĞRULANMIŞ KAMUSAL PROFİL/);
    assert.match(meetingUiText, /KAYNAKLI GÖRÜŞ · KURUMSAL KAYIT · 91% GÜVEN/);
    assert.match(meetingUiText, /Kaynak planının ayrıntısını toplantıdan sonra ikili ele alalım/);
    runtime.dom.window.storyConversationWorkspaceClose();

    const chairThirdTurn = runtime.api.conversationMeetingGenerateCharacterTurn(meeting.id, null);
    assert.equal(chairThirdTurn.ok, true);
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
    runtime.dom.window.storyConversationWorkspaceClose();

    const completion = runtime.api.conversationSessionBegin('Merhaba, görev için geldim.', {
        listenerActorId: taskTargetActorId
    });
    assert.equal(completion.ok, true);
    const completedTask = runtime.api.conversationTaskOfferList(sessionId)[0];
    assert.equal(completedTask.status, 'COMPLETED');
    assert.equal(completedTask.completionSessionId, completion.session.id);

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
    const forgedPrivateVisibility = JSON.parse(JSON.stringify(snapshot));
    const note = forgedPrivateVisibility.meetingCases[0].privateNotes[0];
    const uninvolvedVisibility = forgedPrivateVisibility.meetingCases[0].visibilityMatrix.find(row =>
        row.actorId !== note.authorActorId && row.actorId !== note.recipientActorId);
    uninvolvedVisibility.visiblePrivateNoteIds.push(note.id);
    assert.ok(runtime.api.conversationSessionValidate(forgedPrivateVisibility).issues
        .some(row => row.code === 'MEETING_VISIBILITY_MATRIX'));
    assert.equal(runtime.api.conversationSessionRestore(snapshot).schemaVersion, 4);
    assert.equal(JSON.stringify(runtime.api.conversationSessionSnapshot()), JSON.stringify(snapshot));

    const legacy = JSON.parse(JSON.stringify(snapshot));
    legacy.schemaVersion = 3;
    legacy.adapterVersion = 'story-conversation-session-ledger-3';
    delete legacy.nextTaskOfferSequence;
    delete legacy.taskOffers;
    delete legacy.nextMeetingSequence;
    delete legacy.meetingCases;
    for (const session of legacy.sessions) {
        session.schemaVersion = 3;
        delete session.conversationCase;
    }
    const migrated = runtime.api.conversationSessionMigrate(legacy);
    assert.equal(migrated.schemaVersion, 4);
    assert.equal(migrated.adapterVersion, 'story-conversation-session-ledger-4');
    assert.ok(migrated.sessions.every(session => session.conversationCase
        && session.conversationCase.modeHistory.length === 1));
    assert.equal(runtime.api.conversationSessionValidate(migrated).ok, true);

    process.stdout.write(`${JSON.stringify({
        ok: true,
        taskCompleted: completedTask.status,
        meetingParticipants: meeting.participants.length,
        meetingTurns: meetingAfterTurns.turns.length,
        meetingChairInstitution: meeting.chair.institutionType,
        modeHistory: runtime.api.conversationSessionCaseGet(sessionId).modeHistory.length,
        migratedSessions: migrated.sessions.length
    })}\n`);
} finally {
    runtime.dom.window.close();
}
