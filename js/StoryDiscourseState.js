// ============================================================================
//  DISCOURSE STATE V1 — konuşmanın kalıcı durum makinesi
// ============================================================================

const STORY_DISCOURSE_STATE_SCHEMA_VERSION = 1;
const STORY_DISCOURSE_STATE_ADAPTER_VERSION = 'story-discourse-state-1';
const STORY_DISCOURSE_TOPIC_HISTORY_LIMIT = 12;
const STORY_DISCOURSE_OPEN_QUESTION_LIMIT = 12;
const STORY_DISCOURSE_REPAIR_LIMIT = 16;
const STORY_DISCOURSE_CLAIM_POSITION_LIMIT = 24;
const STORY_DISCOURSE_SOCIAL_TOPICS = Object.freeze(['SOCIAL', 'GENERAL']);
const STORY_DISCOURSE_REPAIR_ACTS = Object.freeze([
    'REPAIR_MISUNDERSTANDING', 'REPAIR_MISSING_ANSWER', 'REPAIR_REPETITION',
    'EXPLAIN_FALLBACK_FAILURE', 'REPAIR_ROLE_CONTRADICTION', 'CORRECT_PREVIOUS_TOPIC'
]);
const STORY_DISCOURSE_QUESTION_ACTS = Object.freeze([
    'CLARIFY_UNKNOWN_WITHOUT_FAKE_CONTINUITY', 'REPAIR_MISUNDERSTANDING',
    'REPAIR_MISSING_ANSWER', 'QUALIFY_PERSONAL_JUDGMENT',
    'ACKNOWLEDGE_UNVERIFIED_SECTOR_REPORT'
]);

function storyDiscourseClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function storyDiscourseStateCreate(sessionId, analysis) {
    const topic = storyDiscourseEffectiveTopic(analysis);
    const substantive = topic && !STORY_DISCOURSE_SOCIAL_TOPICS.includes(topic) ? topic : null;
    return {
        schemaVersion: STORY_DISCOURSE_STATE_SCHEMA_VERSION,
        adapterVersion: STORY_DISCOURSE_STATE_ADAPTER_VERSION,
        sessionId: String(sessionId), revision: 0,
        activeTopic: substantive,
        activeTopicTurnId: substantive ? `conversation-turn:${sessionId}:0` : null,
        topicHistory: [], openQuestions: [], answerDebts: [], repairChain: [], claimPositions: [],
        lastTurnId: null, lastPlayerText: '', lastDiscourseAct: '',
        lastSubstantiveTurnId: substantive ? `conversation-turn:${sessionId}:0` : null,
        worldMutation: false
    };
}

function storyDiscourseQuestionId(turnId) {
    return `discourse-question:${String(turnId).replace(/[^a-zA-Z0-9:_-]/g, '_')}`;
}

function storyDiscourseFold(value) {
    return String(value || '').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function storyDiscourseEffectiveTopic(analysis) {
    if (!analysis || typeof analysis !== 'object') return 'GENERAL';
    if (['FOUND_COMPANY', 'FOUND_STEEL_COMPANY', 'REDIRECT_SHIPMENT'].includes(analysis.playerIntent)
        || (analysis.entities || []).some(row => ['COMMODITY', 'SHIPMENT', 'WAREHOUSE'].includes(row.role))
        || (analysis.claims || []).some(row => row.type === 'PLAYER_REPORTED_BUDGET')) return 'COMMERCE';
    if (analysis.playerIntent === 'REQUEST_MILITARY_SUPPORT'
        || (analysis.claims || []).some(row => row.type === 'PLAYER_REPORTED_MILITARY_THREAT')) return 'MILITARY';
    return String(analysis.topic || 'GENERAL');
}

function storyDiscourseStateApply(state, input) {
    const next = storyDiscourseClone(state);
    input = input && typeof input === 'object' ? input : {};
    const analysis = input.analysis || {};
    const response = input.response || {};
    const turnId = String(input.turnId || `conversation-turn:${next.sessionId}:${next.revision}`);
    const topic = storyDiscourseEffectiveTopic(analysis);
    const substantive = !STORY_DISCOURSE_SOCIAL_TOPICS.includes(topic);
    const repair = STORY_DISCOURSE_REPAIR_ACTS.includes(response.discourseAct);
    const foldedPlayer = storyDiscourseFold(input.playerText);
    const rawPlayer = String(input.playerText || '').toLocaleLowerCase('tr-TR');
    const requestsTopicReturn = ['önceki konuya dön', 'önceki konumuza dön',
        'o konuya dön', 'kaldığımız yere dön'].some(row => rawPlayer.includes(row))
        || ['onceki konuya don', 'onceki konumuza don', 'o konuya don',
            'kaldigimiz yere don'].some(row => foldedPlayer.includes(row));
    const correctsPrior = ['onu demiyorum', 'yanlış anladın', 'yanlış anladınız',
        'onu kastetmedim', 'demek istediğim'].some(row => rawPlayer.includes(row))
        || ['onu demiyorum', 'yanlis anladin', 'yanlis anladiniz',
            'onu kastetmedim', 'demek istedigim'].some(row => foldedPlayer.includes(row))
        || (/^hayir\b/.test(foldedPlayer) && /\bdegil\b.*\bhakkinda\b/.test(foldedPlayer));

    // Bir önceki karakter sorusuna gerçek içerikli oyuncu cevabı geldiyse borcu
    // kapat. Onarım/selam/teşekkür cevap değildir; borcu sessizce silmez.
    const hasGroundedContent = (analysis.entities || []).length > 0
        || (analysis.claims || []).length > 0 || (analysis.requests || []).length > 0
        || !['UNSPECIFIED', 'SOCIAL_GREETING', 'SOCIAL_CHECK_IN'].includes(analysis.playerIntent);
    const canAnswer = !repair && hasGroundedContent && !['GREETING', 'CHECK_IN', 'THANK',
        'APOLOGIZE', 'FAREWELL'].includes(analysis.speechAct);
    if (canAnswer) {
        const debt = next.answerDebts.find(row => row.debtor === 'PLAYER' && row.status === 'OPEN');
        if (debt) {
            debt.status = 'ANSWERED'; debt.answeredByTurnId = turnId;
            const question = next.openQuestions.find(row => row.id === debt.questionId);
            if (question) { question.status = 'ANSWERED'; question.answeredByTurnId = turnId; }
        }
    }

    if (requestsTopicReturn && next.topicHistory.length) {
        const prior = next.topicHistory.pop();
        if (next.activeTopic) next.topicHistory.push({
            topic: next.activeTopic, openedByTurnId: next.activeTopicTurnId,
            suspendedByTurnId: turnId, status: 'SUSPENDED'
        });
        next.activeTopic = prior.topic;
        next.activeTopicTurnId = turnId;
        next.lastSubstantiveTurnId = turnId;
    } else if (substantive && topic !== next.activeTopic) {
        if (next.activeTopic) next.topicHistory.push({
            topic: next.activeTopic, openedByTurnId: next.activeTopicTurnId,
            suspendedByTurnId: turnId, status: 'SUSPENDED'
        });
        next.activeTopic = topic;
        next.activeTopicTurnId = turnId;
        next.lastSubstantiveTurnId = turnId;
    } else if (substantive) {
        next.lastSubstantiveTurnId = turnId;
    }

    if (repair) next.repairChain.push({
        id: `discourse-repair:${next.sessionId}:${next.revision + 1}`,
        repairTurnId: turnId,
        repairOfTurnId: next.lastTurnId || next.lastSubstantiveTurnId,
        act: response.discourseAct,
        status: 'APPLIED'
    });

    if (correctsPrior) {
        const previous = next.claimPositions.slice().reverse().find(row => row.status === 'ACTIVE');
        if (previous) {
            previous.status = 'CORRECTED_BY_PLAYER';
            previous.correctedByTurnId = turnId;
        }
        if (!repair) next.repairChain.push({
            id: `discourse-repair:${next.sessionId}:${next.revision + 1}`,
            repairTurnId: turnId,
            repairOfTurnId: previous && previous.introducedAtTurnId
                || next.lastTurnId || next.lastSubstantiveTurnId,
            act: 'PLAYER_CORRECTION', status: 'APPLIED'
        });
    }

    for (const claim of analysis.claims || []) if (claim && claim.id
        && !next.claimPositions.some(row => row.claimId === claim.id)) {
        next.claimPositions.push({
            claimId: claim.id, claimType: claim.type || 'UNKNOWN',
            introducedAtTurnId: turnId, truthStatus: claim.truthStatus || 'UNVERIFIED',
            status: 'ACTIVE', correctedByTurnId: null
        });
    }

    if (STORY_DISCOURSE_QUESTION_ACTS.includes(response.discourseAct)
        || /\?\s*$/.test(String(response.text || '').trim())) {
        const questionId = storyDiscourseQuestionId(turnId);
        next.openQuestions.push({
            id: questionId, askedBy: 'CHARACTER', owedBy: 'PLAYER',
            openedAtTurnId: turnId, topic: next.activeTopic || topic,
            status: 'OPEN', answeredByTurnId: null
        });
        next.answerDebts.push({
            id: `answer-debt:${questionId}`, questionId, debtor: 'PLAYER',
            creditor: 'CHARACTER', status: 'OPEN', answeredByTurnId: null
        });
    }

    next.topicHistory = next.topicHistory.slice(-STORY_DISCOURSE_TOPIC_HISTORY_LIMIT);
    next.openQuestions = next.openQuestions.slice(-STORY_DISCOURSE_OPEN_QUESTION_LIMIT);
    next.answerDebts = next.answerDebts.slice(-STORY_DISCOURSE_OPEN_QUESTION_LIMIT);
    next.repairChain = next.repairChain.slice(-STORY_DISCOURSE_REPAIR_LIMIT);
    next.claimPositions = next.claimPositions.slice(-STORY_DISCOURSE_CLAIM_POSITION_LIMIT);
    next.lastTurnId = turnId;
    next.lastPlayerText = String(input.playerText || '');
    next.lastDiscourseAct = String(response.discourseAct || analysis.speechAct || 'UNKNOWN');
    next.revision++;
    return next;
}

function storyDiscourseStateValidate(candidate) {
    const issues = [];
    const add = (code, path) => issues.push({ code, path });
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return { ok: false, issues: [{ code: 'STATE_REQUIRED', path: '$' }] };
    }
    if (candidate.schemaVersion !== STORY_DISCOURSE_STATE_SCHEMA_VERSION) add('SCHEMA', '$.schemaVersion');
    if (candidate.adapterVersion !== STORY_DISCOURSE_STATE_ADAPTER_VERSION) add('ADAPTER', '$.adapterVersion');
    if (!candidate.sessionId || !Number.isInteger(candidate.revision) || candidate.revision < 0) add('IDENTITY', '$');
    for (const key of ['topicHistory', 'openQuestions', 'answerDebts', 'repairChain', 'claimPositions']) {
        if (!Array.isArray(candidate[key])) add('LIST_REQUIRED', `$.${key}`);
    }
    if ((candidate.topicHistory || []).length > STORY_DISCOURSE_TOPIC_HISTORY_LIMIT) add('TOPIC_LIMIT', '$.topicHistory');
    if ((candidate.openQuestions || []).length > STORY_DISCOURSE_OPEN_QUESTION_LIMIT
        || (candidate.answerDebts || []).length > STORY_DISCOURSE_OPEN_QUESTION_LIMIT) add('QUESTION_LIMIT', '$.openQuestions');
    if ((candidate.repairChain || []).length > STORY_DISCOURSE_REPAIR_LIMIT) add('REPAIR_LIMIT', '$.repairChain');
    if ((candidate.claimPositions || []).length > STORY_DISCOURSE_CLAIM_POSITION_LIMIT) add('CLAIM_LIMIT', '$.claimPositions');
    const questionIds = new Set((candidate.openQuestions || []).map(row => row.id));
    for (const debt of candidate.answerDebts || []) {
        if (!debt.id || !questionIds.has(debt.questionId)
            || !['OPEN', 'ANSWERED'].includes(debt.status)) add('ANSWER_DEBT', '$.answerDebts');
    }
    for (const repair of candidate.repairChain || []) {
        if (!repair.id || !repair.repairTurnId || !repair.repairOfTurnId
            || repair.status !== 'APPLIED') add('REPAIR_LINK', '$.repairChain');
    }
    for (const claim of candidate.claimPositions || []) {
        if (!claim.claimId || !claim.introducedAtTurnId
            || !['ACTIVE', 'CORRECTED_BY_PLAYER'].includes(claim.status)
            || (claim.status === 'CORRECTED_BY_PLAYER' && !claim.correctedByTurnId)) {
            add('CLAIM_POSITION', '$.claimPositions');
        }
    }
    if (candidate.worldMutation !== false) add('WORLD_MUTATION', '$.worldMutation');
    return { ok: issues.length === 0, issues };
}

if (typeof module !== 'undefined' && module.exports) module.exports = {
    storyDiscourseStateCreate, storyDiscourseStateApply, storyDiscourseStateValidate
};
