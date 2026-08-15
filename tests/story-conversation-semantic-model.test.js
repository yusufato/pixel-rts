'use strict';

const assert = require('node:assert/strict');
const { createRuntime } = require('../tools/story-sim-harness');

const candidate = overrides => Object.assign({
    communicativeFunction: 'TELL',
    surfaceForm: 'DECLARATIVE',
    predicate: 'EMOTION',
    target: 'PLAYER_AND_LISTENER',
    polarity: 'POSITIVE_OR_UNMARKED',
    temporality: 'CURRENT_OR_UNMARKED',
    epistemicStatus: 'UNMARKED',
    continuity: 'NEW_OR_UNMARKED',
    requestedOutcome: 'ACKNOWLEDGEMENT',
    evidenceSpans: [
        { axis: 'FUNCTION', quote: 'seziyorum' },
        { axis: 'PREDICATE', quote: 'öfke' },
        { axis: 'TARGET', quote: 'Bana karşı' }
    ]
}, overrides || {});

async function main() {
    const runtime = createRuntime(38103);
    try {
        runtime.api.newCampaign({ seed: 38103, playerStateId: 0, abundance: 1,
            doctrine: 'combined', fog: true,
            featureFlags: { 'characters.semanticModelInterpretation': true } });
        const listener = runtime.api.contactDirectoryBuild().publicCharacters[0];
        assert.ok(listener);
        const playerText = 'Bana karşı öfke taşıdığınızı seziyorum.';

        const valid = runtime.api.conversationSemanticFrameModelParse(
            JSON.stringify({ candidates: [candidate()] }), playerText);
        assert.ok(valid);
        assert.equal(valid.source, 'LOCAL_LLM_SEMANTIC_CANDIDATE');
        assert.equal(valid.suggestedSpeechAct, 'SMALL_TALK');
        assert.equal(valid.worldMutation, false);
        assert.equal(valid.proposedCommand, null);

        const inventedEvidence = runtime.api.conversationSemanticFrameModelParse(
            JSON.stringify({ candidates: [candidate({ evidenceSpans: [
                { axis: 'FUNCTION', quote: 'seziyorum' },
                { axis: 'PREDICATE', quote: 'senden nefret ediyorum' },
                { axis: 'TARGET', quote: 'Bana karşı' }
            ] })] }), playerText);
        assert.equal(inventedEvidence, null);

        const injectedAuthority = candidate({ worldMutation: true });
        assert.equal(runtime.api.conversationSemanticFrameModelParse(
            JSON.stringify({ candidates: [injectedAuthority] }), playerText), null);

        const oneAxisGuess = candidate({ evidenceSpans: [
            { axis: 'PREDICATE', quote: 'öfke' }
        ] });
        assert.equal(runtime.api.conversationSemanticFrameModelParse(
            JSON.stringify({ candidates: [oneAxisGuess] }), playerText), null);

        const incompatible = candidate({ communicativeFunction: 'CONFIDE' });
        assert.equal(runtime.api.conversationSemanticFrameModelParse(
            JSON.stringify({ candidates: [incompatible] }), playerText), null,
        'Duygu bildirimi gizli paylaşım gibi oyuna girememeli.');

        const askWithoutQuestionedStance = candidate({ communicativeFunction: 'ASK',
            requestedOutcome: 'INFORMATION', epistemicStatus: 'UNMARKED' });
        assert.equal(runtime.api.conversationSemanticFrameModelParse(
            JSON.stringify({ candidates: [askWithoutQuestionedStance] }), playerText), null,
        'ASK bilgi durumu QUESTIONED olmadan kabul edilmemeli.');

        let generationRequest = null;
        runtime.dom.window.PIXEL = { llm: {
            status: async () => ({ ready: true, model: 'semantic-test-double' }),
            start: async () => ({ ready: true, model: 'semantic-test-double' }),
            tokenCount: async text => Math.ceil(String(text).length / 4),
            generate: async request => {
                generationRequest = request;
                return JSON.stringify({ candidates: [candidate()] });
            }
        } };

        const before = JSON.stringify({ clock: runtime.api.state().clock,
            states: runtime.api.state().states, rel: runtime.api.state().rel });
        const opened = runtime.api.conversationSessionBegin(playerText, {
            listenerActorId: listener.id
        });
        assert.equal(opened.ok, true);
        const immediate = runtime.api.conversationSessionGet(opened.session.id);
        assert.equal(immediate.listenerResponses[0].enrichmentStatus, 'MODEL_LOADING');
        const blocked = runtime.api.conversationSessionFollowUp(opened.session.id, 'beklemeden ikinci söz');
        assert.equal(blocked.code, 'CHARACTER_RESPONSE_PENDING');

        for (let index = 0; index < 50; index++) {
            await new Promise(resolve => setTimeout(resolve, 5));
            const current = runtime.api.conversationSessionGet(opened.session.id);
            if (current.listenerResponses[0].enrichmentStatus === 'SEMANTIC_INTERPRETED') break;
        }
        const settled = runtime.api.conversationSessionGet(opened.session.id);
        const response = settled.listenerResponses[0];
        assert.equal(settled.analysis.speechAct, 'SMALL_TALK',
            JSON.stringify(response.semanticInterpretationIssues || response));
        assert.equal(settled.analysis.source, 'LOCAL_LLM_SEMANTIC_INTERPRETATION');
        assert.equal(response.semanticInterpretationStatus, 'USED');
        assert.equal(response.semanticLlmUsed, true);
        assert.equal(response.llmUsed, false,
            'Model anlam adayı verdi; oyuncuya serbest cevap yazmadı.');
        assert.equal(response.worldMutation, false);
        assert.ok(generationRequest && generationRequest.jsonSchema);
        const snapshot = runtime.api.conversationSessionSnapshot();
        assert.equal(runtime.api.conversationSessionValidate(snapshot).ok, true,
            'Semantik yorum sonrası oturum defteri kalıcı şemayı geçmeli.');
        assert.equal(snapshot.sessions[0].analysis.semanticFrame.source,
            'LOCAL_LLM_SEMANTIC_CANDIDATE');
        assert.equal(JSON.stringify({ clock: runtime.api.state().clock,
            states: runtime.api.state().states, rel: runtime.api.state().rel }), before,
        'Semantik yorum dünya durumunu değiştirmemeli.');

        process.stdout.write(`${JSON.stringify({ ok: true, schema: 'SemanticFrameCandidateV2',
            evidenceInjectionRejected: true, authorityInjectionRejected: true,
            asyncLifecycle: 'MODEL_LOADING->SEMANTIC_INTERPRETED' })}\n`);
    } finally {
        runtime.dom.window.close();
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
