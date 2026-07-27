// ═══════════════════════════════════════════════════════════════════════════
// BattleCoach.js — Faz 7: 8B LLM KOÇ (döngü-dışı analist + deney tasarımcısı)
// ───────────────────────────────────────────────────────────────────────────
// Plan §6/§12A-Faz7. LLM gerçek-zamanlı mikro YAPMAZ (§11: ~0.8 tok/s CPU, çok yavaş).
// Rolü: eğitim turlarının METRİKLERİNİ okur → sıradaki DENEYİ önerir (hangi rakip/ordu eklensin,
// reward-ağırlığı nasıl değişsin, DAgger hangi faza odaklansın). Hat her öneriyi ÖLÇER → iyileştiren kalır.
// LLM MODEL DEĞİL — credit-assignment yine Oracle rollout'ta; LLM stratejik yön verir.
//
// Türkçe-tavan (bkz hafıza): 8B model karmaşık JSON'da zayıf → KISITLI SATIR-FORMAT + TOLERANSLI parser.
// Sayı/etki asla körlemesine uygulanmaz; öneri bir DENEY'dir, ölçülür.
// ═══════════════════════════════════════════════════════════════════════════

// Koç sistem-promptu: rol + KISITLI çıktı formatı (model bunu üretebilir; serbest JSON üretemez)
const BATTLE_COACH_SYSTEM = `Sen bir savaş-AI eğitim koçusun. Sana modelin son eğitim turundaki ÖLÇÜMLERİ verilir.
Görevin: bir sonraki eğitim turu için EN FAYDALI tek deneyi önermek.
KURALLAR:
- Sadece Türkçe. Açıklama yazma, yalnız aşağıdaki 3 satırı doldur.
- RAKIP: modelin en zayıf olduğu rakip gücü (sayı, örn 1600) veya kompozisyon (combat/mixed).
- ODAK: hangi savaş fazına DAgger odaklansın (temas / gec-savas / kanat).
- GEREKCE: tek cümle, neden.
Örnek çıktı:
RAKIP: 1600
ODAK: gec-savas
GEREKCE: model 1600'e karşı geç-savaşta üstünlüğü kaybediyor.`;

// Eğitim metriklerini kompakt Türkçe özete çevir (LLM promptu için)
function battleCoachMetricsSummary(rounds) {
    // rounds = [{ round, opponents:[{budget, delta, winRate}], devRegret, notes }]
    const lines = [];
    for (const r of rounds || []) {
        const opp = (r.opponents || []).map(o => `blue-${o.budget}:Δ${o.delta}${o.winRate != null ? '(' + o.winRate + ')' : ''}`).join('  ');
        lines.push(`Tur ${r.round}: devRegret=${r.devRegret != null ? r.devRegret : '?'}  ${opp}${r.notes ? '  · ' + r.notes : ''}`);
    }
    return lines.join('\n');
}

// LLM'e sorulacak tam prompt
function battleCoachPrompt(rounds) {
    return `ÖLÇÜMLER:\n${battleCoachMetricsSummary(rounds)}\n\nSıradaki tur için deney öner (3 satır):`;
}

// TOLERANSLI parser: model dağınık yazsa da RAKIP/ODAK'ı düz-metinden çıkar. Geçersizse null (öneri atılır).
function battleCoachParseProposal(text) {
    if (!text || typeof text !== 'string') return null;
    const out = {};
    // RAKIP: sayı (bütçe) veya combat/mixed
    const mBudget = text.match(/RAKIP[:\s]*([0-9]{3,4})/i) || text.match(/\b(1[0-9]{3})\b/);
    if (mBudget) out.opponentBudget = Math.max(800, Math.min(2400, parseInt(mBudget[1], 10)));
    if (/mixed|karışık|karisik/i.test(text)) out.opponentComposition = 'mixed';
    else if (/combat|muharebe/i.test(text)) out.opponentComposition = 'combat';
    // ODAK: faz
    if (/gec-savas|geç-savaş|gec savas|late/i.test(text)) out.focus = 'late';
    else if (/kanat|flank/i.test(text)) out.focus = 'flank';
    else if (/temas|contact/i.test(text)) out.focus = 'contact';
    // GEREKCE: serbest cümle (varsa)
    const mReason = text.match(/GEREKCE[:\s]*(.+)/i);
    if (mReason) out.reason = mReason[1].trim().slice(0, 140);
    // En az bir eyleme dönüştürülebilir alan yoksa geçersiz
    if (out.opponentBudget == null && out.opponentComposition == null && out.focus == null) return null;
    return out;
}

// LLM'i çağır (yalnız electron/browser + model hazırsa). Döner: {opponentBudget, focus, reason} | null.
// maxTokens llmEnrich'te 110'a sabit → koç için b.generate'i doğrudan daha yüksek limitle çağırırız.
function battleCoachAsk(rounds) {
    if (typeof llmAvailable !== 'function' || !llmAvailable()) return Promise.resolve(null);
    const b = (typeof llmBridge === 'function') ? llmBridge() : null;
    if (!b) return Promise.resolve(null);
    return b.generate({
        system: BATTLE_COACH_SYSTEM, prompt: battleCoachPrompt(rounds),
        maxTokens: 90, temperature: 0.3   // düşük sıcaklık → yapı daha kararlı (Türkçe-tavan dersi)
    }).then(txt => battleCoachParseProposal(txt)).catch(() => null);
}

// Öneriyi eğitim-turu parametrelerine çevir (orkestratör bunu kullanır). Öneri null ise varsayılan çeşitlilik.
function battleCoachProposalToRoundParams(proposal) {
    const p = proposal || {};
    // rakip listesi: öneri varsa onu öne al, yoksa dengeli varsayılan set
    const budgets = p.opponentBudget ? [p.opponentBudget, 1400, 1700] : [1400, 1700, 1400];
    const comps = p.opponentComposition ? [p.opponentComposition, 'combat', 'combat'] : ['combat', 'combat', 'mixed'];
    // odak → DAgger karar-tikleri (late = geç tikler, contact = orta, flank = orta)
    const ticks = p.focus === 'late' ? '900,1050,1200,1350' : (p.focus === 'flank' ? '650,800,950,1100' : '550,700,850,1000,1150');
    return { budgets, comps, ticks, reason: p.reason || null };
}

if (typeof module !== 'undefined') module.exports = {
    BATTLE_COACH_SYSTEM, battleCoachMetricsSummary, battleCoachPrompt,
    battleCoachParseProposal, battleCoachProposalToRoundParams
};
