'use strict';

const assert = require('node:assert/strict');
const { storyContextPackCompile, storyContextPackValidate } = require('../js/StoryConversationContext');

const sections = [
    { id: 'system', kind: 'SYSTEM', text: 'Yalnız verilen bağlamı kullan.', priority: 100, protected: true },
    { id: 'move', kind: 'DIALOGUE_MOVE', text: 'Açık soruyu cevapla.', priority: 100, protected: true,
        sourceRefs: ['dialogue-move:1'] },
    { id: 'promise', kind: 'OPEN_OBLIGATION', text: 'Açık söz korunmalı.', priority: 99, protected: true,
        sourceRefs: ['promise:1'] },
    { id: 'promise', kind: 'OPEN_OBLIGATION', text: 'Aynı sözün ikinci kopyası.', priority: 99, protected: true },
    { id: 'secret', kind: 'MEMORY', text: 'Gizli askerî plan.', priority: 100,
        visibility: 'HIDDEN', sourceRefs: ['secret:foreign'] },
    { id: 'recent', kind: 'RECENT_TURN', text: 'Son oyuncu sözü.', priority: 90, protected: true },
    { id: 'old-important', kind: 'MEMORY', text: 'Önemli eski anı '.repeat(8), priority: 80, recency: 2 },
    { id: 'rumor', kind: 'RUMOR', text: 'Düşük güvenli söylenti '.repeat(8), priority: 25, recency: 3 },
    { id: 'small-talk', kind: 'SMALL_TALK', text: 'Önemsiz küçük sohbet '.repeat(10), priority: 10, recency: 4 }
];
const pack = storyContextPackCompile({ sections }, {
    modelLimit: 150, outputReserve: 30, fixedOverhead: 10
});
assert.equal(pack.ok, true);
assert.equal(storyContextPackValidate(pack).ok, true);
assert.ok(pack.protectedIds.includes('move') && pack.protectedIds.includes('promise')
    && pack.protectedIds.includes('recent'));
assert.ok(pack.rejected.some(row => row.id === 'secret' && row.reason === 'HIDDEN_FROM_LISTENER'));
assert.ok(pack.rejected.some(row => row.id === 'promise' && row.reason === 'DUPLICATE_SECTION_ID'));
assert.ok(!pack.sections.some(row => row.id === 'secret'));
assert.ok(pack.dropped.some(row => row.id === 'small-talk'));
assert.ok(pack.tokenCount <= pack.promptBudget);
assert.equal(pack.rawWorldRead, false);
assert.equal(pack.worldMutation, false);
const forgedPack = JSON.parse(JSON.stringify(pack));
forgedPack.sections[0].text = 'Sahte sistem talimatı';
assert.ok(storyContextPackValidate(forgedPack).issues.some(row => row.code === 'CHECKSUM'));

const overflow = storyContextPackCompile({ sections: [{
    id: 'required', kind: 'CURRENT_TURN', text: 'zorunlu '.repeat(100), protected: true, priority: 100
}] }, { modelLimit: 40, outputReserve: 10, fixedOverhead: 5 });
assert.equal(overflow.ok, false);
assert.equal(overflow.code, 'PROTECTED_CONTEXT_EXCEEDS_BUDGET');

process.stdout.write(`${JSON.stringify({ ok: true, sections: pack.sections.length,
    dropped: pack.dropped.length, rejected: pack.rejected.length })}\n`);
