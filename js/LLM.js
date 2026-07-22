// ═══════════════════════════════════════════════════════════════════════════
//  LLM KATMANI (PIXEL EUROPA — Faz-11)
//  ---------------------------------------------------------------------------
//  TEMEL KURAL: OYUN ASLA BEKLEMEZ.
//  Sahne önce birleşim üreteciyle (Chatter.js) ANINDA yazılır ve oyuna girer.
//  LLM arka planda aynı sahneyi yeniden yazar; yetişirse metin ZENGİNLEŞİR,
//  yetişmezse hiçbir şey olmaz. Model yoksa, tarayıcıdaysak ya da hata varsa
//  oyun eksiksiz çalışmaya devam eder.
//
//  LLM oyunun KURALLARINA KARIŞMAZ. Kim konuşuyor, kim kime ne yapıyor, hangi
//  sadakat değişiyor — hepsi kodda kalır ve test edilebilir. Modelden gelen tek
//  şey METİNDİR ve o metin de doğrulamadan geçer (biçim tutmuyorsa atılır).
//  Böylece model kötü bir çıktı verdiğinde oyun bozulmaz, sadece yedeğe döner.
// ═══════════════════════════════════════════════════════════════════════════

const LLM = {
    enabled: true,          // ayarlardan kapatılabilir
    ready: false,
    model: null,
    error: null,
    inFlight: 0,
    maxInFlight: 1,         // tek sıra: model zaten tek süreç
    stats: { asked: 0, used: 0, rejected: 0, failed: 0 },
};

function llmBridge() {
    return (typeof window !== 'undefined' && window.PIXEL && window.PIXEL.llm) ? window.PIXEL.llm : null;
}
function llmAvailable() { return !!(LLM.enabled && llmBridge() && LLM.ready); }

// Durum yoklaması — modeli TEMBEL başlatır (ilk çağrıda yüklenir)
function llmProbe() {
    const b = llmBridge();
    if (!b) { LLM.error = 'masaüstü değil'; return Promise.resolve(LLM); }
    return b.status().then(s => {
        LLM.ready = !!(s && s.ready);
        LLM.model = s && s.model;
        LLM.error = s && s.error;
        return LLM;
    }).catch(e => { LLM.error = String(e); return LLM; });
}

// ── SAHNE BAĞLAMI → İSTEM ──────────────────────────────────────────────────
// Dünya Çağı (Era.js) buraya girer: model dönemin havasını bilerek yazar.
const LLM_SYSTEM = `Sen bir strateji oyununun anlatıcısısın. Oyun 1900'lerin başında geçen kurgusal bir Avrupa'da.
Komutanlar arasında geçen KISA bir diyalog yaz.
KURALLAR:
- Sadece Türkçe yaz. İngilizce kelime kullanma.
- Tam 2 replik yaz, her replik tek satır, "İsim: söz" biçiminde.
- Her replik en fazla 20 kelime.
- Açıklama, başlık, madde işareti YAZMA. Sadece iki satır.
- Konuşanların kişiliğini ve dönemin havasını yansıt.`;

function llmSceneContext() {
    const era = (typeof storyEra === 'function') ? storyEra() : null;
    const me = (typeof storyPlayerState === 'function') ? storyPlayerState() : null;
    return {
        eraName: era ? era.name : '—',
        eraDesc: era ? era.desc : '',
        date: (typeof storyDateLabel === 'function') ? storyDateLabel() : '',
        welfare: me ? Math.round(me.welfare) : 50,
    };
}
function llmCommanderLine(c) {
    if (!c) return '—';
    const sk = c.skills || {};
    return `${c.name} (${c.personality || 'dengeli'}, savaş ${sk.warrior | 0}, diplomasi ${sk.diplomat | 0}, `
         + `iktisat ${sk.economist | 0}, sadakat ${Math.round(c.loyalty == null ? 60 : c.loyalty)}/100)`;
}
// Chatter kaydından istem üretir
function llmChatterPrompt(rec, a, b, topicDesc) {
    const x = llmSceneContext();
    return `DÖNEM: ${x.eraName} — ${x.eraDesc}
TARİH: ${x.date}
YER: ${rec.node}, ${rec.where}
KONUŞANLAR:
- ${llmCommanderLine(a)}
- ${llmCommanderLine(b)}
ARALARINDAKİ BAĞ: ${(typeof cmdBondLabel === 'function' && typeof cmdBond === 'function') ? cmdBondLabel(cmdBond(a, b)).t : 'bilinmiyor'}
DURUM: ${topicDesc}`;
}

// ── DOĞRULAMA ──────────────────────────────────────────────────────────────
// Model serbest metin üretir; oyun kesin biçim bekler. Tutmayan çıktı ATILIR.
const LLM_EN_LEAK = /\b(the|and|with|that|from|this|would|should|could|there|their|about|which|please|note|here|assistant|user)\b/i;
// LATİN DIŞI ALFABE — ölçümde Qwen bir üretimde göreve tamamen çıkıp ÇİNCE bastı
// ("Kaya Bey: Sorumlular找出所有以字母'f'开头的单词"). EN_LEAK bunu yakalayamaz çünkü
// kelime sınırı (\b) Çince yazıda tutmuyor; satır kısa ve iki noktalı olduğu için
// diğer tüm süzgeçlerden de geçip ekrana basılırdı. Tek karakter bile yeter: ele.
const LLM_NONLATIN = /[　-鿿Ѐ-ӿ؀-ۿ가-힯぀-ヿ]/;
function llmParseDialog(text, a, b) {
    if (!text) return null;
    const lines = String(text).split('\n').map(l => l.trim())
        .filter(l => l && !/^[-*#>]/.test(l) && l.includes(':'));
    if (lines.length < 2) return null;
    const out = lines.slice(0, 2);
    for (const l of out) {
        if (l.length > 240) return null;                       // aşırı uzun
        if (l.split(/\s+/).length > 30) return null;
        if (LLM_EN_LEAK.test(l)) return null;                  // İngilizce sızıntı
        if (LLM_NONLATIN.test(l)) return null;                 // Çince/Kiril/Arap kaçağı
    }
    // en az bir replik konuşanlardan birinin adıyla başlamalı (halüsinasyon süzgeci)
    const names = [a && a.name, b && b.name].filter(Boolean).map(n => n.split(' ')[0]);
    if (names.length && !out.some(l => names.some(n => l.startsWith(n)))) return null;
    return out;
}

// ── İSTEK ──────────────────────────────────────────────────────────────────
// Oyun bunu "ateşle ve unut" olarak çağırır. Söz döner ama beklenmesi ŞART DEĞİL.
function llmEnrich(system, prompt, validate) {
    const b = llmBridge();
    if (!llmAvailable() || LLM.inFlight >= LLM.maxInFlight) return Promise.resolve(null);
    LLM.inFlight++; LLM.stats.asked++;
    // maxTokens 160 → 70: iki replik ~40 jeton. Kalan 120 jeton modele "devam et"
    // alanı açıyordu ve ölçümde kaçakların ÇOĞU tam orada başladı (2 replik yazıp
    // sonra listeye/meta metne dalma). Ayrıca CPU'da süreyi yarıdan fazla kısar —
    // saf CPU'da 7B ~0.8 jeton/sn ölçüldü, yani her 100 jeton ~2 dakika demek.
    return b.generate({ system: system || LLM_SYSTEM, prompt, maxTokens: 70, temperature: 0.85 })
        .then(txt => {
            LLM.inFlight--;
            if (!txt) { LLM.stats.failed++; return null; }
            const v = validate ? validate(txt) : txt;
            if (!v) { LLM.stats.rejected++; return null; }
            LLM.stats.used++;
            return v;
        })
        .catch(() => { LLM.inFlight--; LLM.stats.failed++; return null; });
}

// Chatter kaydını arka planda zenginleştir (kayıt zaten oyunda; metni değiştiririz)
function llmEnrichChatter(rec, a, b, topicDesc) {
    if (!llmAvailable()) return;
    llmEnrich(LLM_SYSTEM, llmChatterPrompt(rec, a, b, topicDesc), txt => llmParseDialog(txt, a, b))
        .then(lines => {
            if (!lines) return;
            rec.lines = lines;
            rec.llm = true;
            if (typeof storyTalkUpdate === 'function') storyTalkUpdate();
        });
}

// Oyun açılışında sessizce yokla (model varsa yüklenmeye başlar)
if (typeof document !== 'undefined') {
    const _p = () => { if (llmBridge()) llmProbe(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _p);
    else _p();
}
