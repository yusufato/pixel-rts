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

// Durum yoklaması — SALT BİLGİ, model YÜKLEMEZ.
// BELLEK DÜZELTMESİ: eskiden bu çağrı modeli yüklüyordu ve açılıştaki sessiz yoklama
// yüzünden oyun, anlatıcı hiç kullanılmasa bile 4.9GB alıyordu (ölçüm: llm-host 4900MB,
// oyunun geri kalanı toplam ~770MB). Model artık yalnız gerçekten gerektiğinde yüklenir.
function llmProbe() {
    const b = llmBridge();
    if (!b) { LLM.error = 'masaüstü değil'; return Promise.resolve(LLM); }
    return b.status().then(s => {
        LLM.ready = !!(s && s.ready);
        LLM.model = s && s.model;
        LLM.error = s && s.error;
        LLM.yuklendi = !!(s && s.yuklendi);
        LLM.modelVar = !!(s && s.modelVar);
        return LLM;
    }).catch(e => { LLM.error = String(e); return LLM; });
}

// Modeli AÇIKÇA yükle (kullanıcı anlatıcıyı açtı ya da ilk üretim gerekti).
// Birkaç saniye sürer ve ~5GB bellek alır — bu yüzden asla kendiliğinden çağrılmaz.
function llmEnsure() {
    const b = llmBridge();
    if (!b) { LLM.error = 'masaüstü değil'; return Promise.resolve(LLM); }
    if (LLM.ready) return Promise.resolve(LLM);
    const cagri = b.start ? b.start() : b.status();   // eski köprüyle geriye uyumlu
    return Promise.resolve(cagri).then(s => {
        LLM.ready = !!(s && s.ready);
        LLM.model = s && s.model;
        LLM.error = s && s.error;
        return LLM;
    }).catch(e => { LLM.error = String(e); return LLM; });
}

// ── SAHNE BAĞLAMI → İSTEM ──────────────────────────────────────────────────
// Dünya Çağı (Era.js) buraya girer: model dönemin havasını bilerek yazar.
const LLM_SYSTEM = `Sen bir strateji oyununun anlatıcısısın. Oyun yakın gelecekte, 2030'larda, kurgusal bir dünyada geçiyor; modern ordular, canlı medya ve sert diplomasi çağı.
Komutanlar arasında geçen KISA bir diyalog yaz.
KURALLAR:
- Sadece Türkçe yaz. İngilizce kelime kullanma.
- Tam 2 replik yaz, her replik tek satır, "İsim: söz" biçiminde.
- Her replik en fazla 20 kelime.
- Açıklama, başlık, madde işareti YAZMA. Sadece iki satır.
- Konuşanların kişiliğini ve dönemin havasını yansıt.

ÖRNEKLER (bu üslupta ve bu dil kalitesinde yaz):

Kemal Paşa: Mühimmat tükeniyor, başkentten hâlâ onay çıkmadı.
Rıza Komutan: İkmal konvoyu yolda vuruldu Paşam, beklemekten başka çare yok.

Nuri Paşa: Bu ittifak bize zaman kazandırır, fazlasını değil.
Cemil Komutan: Zaman da bir kazançtır efendim, hafife almayalım.

Hasan Paşa: Adamlarım üç aydır maaş görmedi, sabırları taştı.
Orhan Komutan: Sabır taşarsa isyan başlar, bunu ikimiz de biliyoruz.`;

// SICAKLIK 0.85 → 0.40. Ölçüldü (gram_bench.js, 4 kol × 3 sahne):
// Modele açıkça "dil bilgisi kurallarına uy, uydurma kelime yazma" demek HİÇBİR
// İYİLEŞME sağlamadı (12 satırda ~4 temiz; kuralsız kolla aynı). Beklenen sonuç:
// bu bir itaat değil YETENEK sorunu — model "hamımlık" yazarken kural çiğnediğini
// bilmiyor. Buna karşılık sıcaklığı düşürmek ~8/12'ye çıkardı: bozuk morfoloji
// dağılımın kuyruğunda yaşıyor, örnekleme oraya inmeyince hata da azalıyor.
// Örnekler ise dil bilgisinden çok ÜSLUBU düzeltti (dönem sesi, "sabırlar tükeniyor").
// İkisi birlikte: doğruluk için düşük sıcaklık, karakter için örnekler.
const LLM_TEMPERATURE = 0.40;

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
// KONUŞAN-ADI-ÇAPALI ayrıştırma. Ölçüm (gram_bench, 3 model): iki model iki ayrı
// yönde hata yapıyor. Qwen biçime uyuyor ama Türkçesi bozuk; Türkçe-Llama'nın
// Türkçesi temiz ama "2 satır, başlık yok" kuralını yok sayıp her çıktıya
// **Başlık:** / **Madde İşareti:** / İsim: / Söz: iskelesi ekliyor.
// Kilit gözlem: iskele DİYALOGUN ÖNÜNDE durur ve komutan adıyla ASLA başlamaz;
// gerçek replikler başlar. O yüzden "ilk 2 satırı al" yanlış — "komutan adıyla
// başlayan 2 satırı al" doğru. Böylece bozuk morfoloji ayıklanamaz ama ayıklanabilir
// olan iskele temizlenir ve Türkçe-Llama'nın temiz repliği kurtulur.
function llmParseDialog(text, a, b) {
    if (!text) return null;
    const names = [a && a.name, b && b.name].filter(Boolean).map(n => n.split(' ')[0]);
    // markdown vurgusunu (**...**, *, öndeki #/>/madde imleri) soy — konuşan adı açığa çıksın
    const strip = l => l.replace(/\*\*/g, '').replace(/^[*#>\s]+/, '').replace(/\*+$/, '').trim();
    const raw = String(text).split('\n').map(strip).filter(Boolean);

    let picked;
    if (names.length) {
        // yalnız komutan adı + ':' ile başlayan satırlar (İsim:/Başlık:/Madde: iskelesi elenir)
        const dlg = raw.filter(l => names.some(n => l.startsWith(n) && l.slice(0, n.length + 12).includes(':')));
        if (dlg.length < 2) return null;
        picked = dlg.slice(0, 2);
    } else {
        // konuşan adı verilmemişse (savunma amaçlı) eski davranışa düş
        const cl = raw.filter(l => !/^[-]/.test(l) && l.includes(':'));
        if (cl.length < 2) return null;
        picked = cl.slice(0, 2);
    }

    for (const l of picked) {
        if (l.length > 240) return null;                       // aşırı uzun
        if (l.split(/\s+/).length > 30) return null;
        if (LLM_EN_LEAK.test(l)) return null;                  // İngilizce sızıntı
        if (LLM_NONLATIN.test(l)) return null;                 // Çince/Kiril/Arap kaçağı
    }
    return picked;
}

// ── İSTEK ──────────────────────────────────────────────────────────────────
// Oyun bunu "ateşle ve unut" olarak çağırır. Söz döner ama beklenmesi ŞART DEĞİL.
function llmEnrich(system, prompt, validate) {
    const b = llmBridge();
    if (!llmAvailable() || LLM.inFlight >= LLM.maxInFlight) return Promise.resolve(null);
    LLM.inFlight++; LLM.stats.asked++;
    const telemetryActive = typeof STORY !== 'undefined' && STORY.active
        && typeof storyTelemetryEvent === 'function';
    const telemetryClock = typeof STORY !== 'undefined' ? Number(STORY.clock) || 0 : 0;
    const requestId = `llm:${typeof storyTelemetryRound === 'function' ? storyTelemetryRound(telemetryClock) : telemetryClock}:${LLM.stats.asked}`;
    const startedAt = (typeof performance !== 'undefined' && performance.now)
        ? performance.now()
        : Date.now();
    let finalized = false;
    const finish = (type, payload) => {
        if (!finalized) {
            finalized = true;
            LLM.inFlight = Math.max(0, LLM.inFlight - 1);
        }
        if (!telemetryActive) return;
        const endedAt = (typeof performance !== 'undefined' && performance.now)
            ? performance.now()
            : Date.now();
        storyTelemetryEvent(type, Object.assign({
            requestId,
            latencyMs: typeof storyTelemetryRound === 'function'
                ? storyTelemetryRound(endedAt - startedAt, 2)
                : Math.round((endedAt - startedAt) * 100) / 100
        }, payload || {}), { correlationId: requestId });
    };
    if (telemetryActive) {
        storyTelemetryEvent('llm.requested', {
            requestId,
            systemChars: String(system || LLM_SYSTEM).length,
            promptChars: String(prompt || '').length
        }, { correlationId: requestId });
    }
    // maxTokens 160 → 70 → 110. Önce 160'tan 70'e indirdik: Qwen'de kalan jeton
    // "devam et" alanıydı ve kaçaklar orada başlıyordu. Ama Türkçe modeli seçince
    // yeni bir kısıt çıktı: Türkçe-Llama her çıktıya **Başlık:**/**Madde:** iskelesi
    // ekliyor (ölçülü davranış, prompt'la kırılamadı) ve o iskele ~20-25 jeton yiyor.
    // 70 jetonla iskeleden sonra 2. replik yarıda kesiliyordu. 110: iskele + iki TAM
    // replik sığıyor, doğrulayıcı zaten fazlasını atıyor. CPU maliyeti anahtar kapalı
    // varsayılan olduğu için kabul edilebilir (saf CPU'da ~0.8 jeton/sn).
    return b.generate({ system: system || LLM_SYSTEM, prompt, maxTokens: 110, temperature: LLM_TEMPERATURE })
        .then(txt => {
            if (!txt) { LLM.stats.failed++; finish('llm.failed', { reason: 'empty' }); return null; }
            const v = validate ? validate(txt) : txt;
            if (!v) { LLM.stats.rejected++; finish('llm.rejected', { reason: 'validation' }); return null; }
            LLM.stats.used++;
            finish('llm.used', { outputChars: Array.isArray(v) ? v.join('\n').length : String(v).length });
            return v;
        })
        .catch(() => { LLM.stats.failed++; finish('llm.failed', { reason: 'exception' }); return null; });
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

// Oyun açılışında sessizce yokla — YALNIZ DURUM OKUR, model YÜKLEMEZ.
// (Bu satır eskiden modeli yüklüyordu: oyun her açılışta 4.9GB alıyordu.)
if (typeof document !== 'undefined') {
    const _p = () => { if (llmBridge()) llmProbe(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _p);
    else _p();
}

// ═══ AŞAMA 4: GAZETECİ + UZUN DİYALOG ═══════════════════════════════════════
// İki yeni üretim türü, aynı sözleşme: şablon zaten basıldı, LLM yetişirse
// zenginleştirir; her çıktı doğrulayıcıdan geçer, sayı/etki asla LLM'den gelmez.

const LLM_NEWS_SYSTEM = `Sen kurgusal bir dünyada sert kalemli bir gazete editörüsün. Yıl 2030'lar.
Sana verilen OLAYI tek cümlelik çarpıcı bir Türkçe MANŞET yap.
KURALLAR:
- Sadece Türkçe. En fazla 12 kelime. TEK satır.
- Başına "Manşet:", "Başlık:" gibi etiket YAZMA. Tırnak kullanma.
- Verilen isimleri aynen kullan; yeni isim uydurma.`;

// Manşet doğrulayıcı: iskele soyulur, ilk makul satır alınır, kaçaklar elenir.
function llmParseHeadline(text) {
    if (!text) return null;
    // Önek/tırnak/yıldız temizliği: model "Manşet:" etiketini bazen TIRNAK İÇİNDE
    // veriyor ("Manşet: ..."). Tek geçişte sıra yanlıştı — tırnak etiketten sonra
    // soyulunca etiket kalıyordu. İki kez uygula: tırnak açılır, sonra etiket düşer.
    const strip1 = l => l.replace(/\*\*/g, '').replace(/^[-*#>\s"«»]+/, '')
        .replace(/^(manşet|başlık|haber|headline)\s*[:—-]\s*/i, '').replace(/["«»]+$/, '').trim();
    const strip = l => strip1(strip1(l));
    const lines = String(text).split('\n').map(strip).filter(Boolean)
        .filter(l => !/^(madde|işaret|not)\b/i.test(l));
    if (!lines.length) return null;
    const h = lines[0];
    if (h.split(/\s+/).length > 14 || h.length > 120) return null;
    if (LLM_EN_LEAK.test(h) || LLM_NONLATIN.test(h)) return null;
    return h;
}
function llmEnrichNews(rec) {
    if (!llmAvailable() || !rec) return;
    const f = rec.facts || {};
    const facts = Object.entries(f).map(([k, v]) => `${k}: ${v}`).join(' · ');
    const tone = rec.spun
        ? 'TON: hükümet yanlısı devlet basını — olayı yumuşat, paniği önle, yönetimi iyi göster (ama olayı inkâr etme).'
        : 'TON: bağımsız, keskin, gerçekçi.';
    llmEnrich(LLM_NEWS_SYSTEM, `OLAY TÜRÜ: ${rec.arch}\nBUGÜN: ${rec.date}\nGERÇEKLER: ${facts}\nŞABLON: ${rec.headline}\n${tone}`,
        llmParseHeadline)
        .then(h => {
            if (!h) return;
            const icon = (typeof NEWS_ARCH !== 'undefined' && NEWS_ARCH[rec.arch]) ? NEWS_ARCH[rec.arch].icon : '📰';
            rec.headline = (rec.spun ? '📢 ' : icon + ' ') + h;
            rec.llm = true;
            if (STORY._newsOpen && typeof storyNewsUpdate === 'function') storyNewsUpdate();
        });
}

// UZUN DİYALOG: oyuncunun katıldığı sohbetler 3-6 replikli karşılıklı konuşmaya
// dönüşür (kullanıcı isteği: "ben de varsam uzun karşılıklı diyalog silsilesi").
const LLM_DIALOG_LONG = LLM_SYSTEM.replace('Tam 2 replik yaz', '4 ile 6 arasında replik yaz (karşılıklı konuşma)')
    .replace('- Her replik en fazla 20 kelime.', '- Her replik en fazla 18 kelime. Konuşma gerçek bir alışveriş olsun: soru, itiraz, cevap.');
function llmParseDialogLong(text, a, b) {
    if (!text) return null;
    const names = [a && a.name, b && b.name].filter(Boolean).map(n => n.split(' ')[0]);
    const strip = l => l.replace(/\*\*/g, '').replace(/^[*#>\s]+/, '').replace(/\*+$/, '').trim();
    const raw = String(text).split('\n').map(strip).filter(Boolean);
    const dlg = raw.filter(l => names.some(n => l.startsWith(n) && l.slice(0, n.length + 12).includes(':')));
    if (dlg.length < 3) return null;                       // uzun diyalog en az 3 replik ister
    const picked = dlg.slice(0, 6);
    for (const l of picked) {
        if (l.length > 220 || l.split(/\s+/).length > 26) return null;
        if (LLM_EN_LEAK.test(l) || LLM_NONLATIN.test(l)) return null;
    }
    return picked;
}
function llmEnrichChatterLong(rec, a, b, topicDesc) {
    if (!llmAvailable()) return;
    llmEnrich(LLM_DIALOG_LONG, llmChatterPrompt(rec, a, b, topicDesc), txt => llmParseDialogLong(txt, a, b))
        .then(lines => {
            if (!lines) return;
            rec.lines = lines; rec.llm = true;
            if (typeof storyTalkUpdate === 'function') storyTalkUpdate();
        });
}
