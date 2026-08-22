# 1) Verdict

- **Root cause:** `storyConversationSessionBegin` ve `storyConversationSessionFollowUp`, deterministik bilinmeyen-anlam yedeğinin verdiği `NOT_REQUIRED` durumunu semantik model gereksinimi kararı sanarak `storyConversationSessionQueueSemanticLLM` çağrısını atlıyor.
- **Confidence:** Confirmed.
- **Chain:** Düşük güvenli `UNKNOWN` analiz → `CLARIFY_UNKNOWN_WITHOUT_FAKE_CONTINUITY` yedeği → `enrichmentStatus: NOT_REQUIRED` → çağıran kısa devresi → model kuyruğu hiç başlamıyor.
- Hata devam ediyor ve tekil testte deterministik olarak yeniden üretildi.

# 2) Failure Definition

- `tests/story-conversation-semantic-model.test.js:88`, ilk karakter yanıtında `MODEL_LOADING` beklerken `NOT_REQUIRED` alıyor.
- Yeniden üretim: `npm run story:conversation-semantic-model-test`; bu incelemedeki iki çalıştırmanın ikisinde de aynı assertion oluştu.
- Test girdisinin güncel analizi `speechAct: UNKNOWN`, `confidenceBps: 1100`, `riskLevel: LOW`; semantik model kapısının değerlendirmesi gereken sınıftadır.
- İlk gerçek ürün oluşumu bilinmiyor. Regresyon testi `a938df0` commitinde 2026-08-15 tarihinde eklendi.
- Etki alanı: semantik model bayrağı açıkken bile deterministik yedeğin `NOT_REQUIRED` verdiği açılışlar ve takip turları.

# 3) Timeline

| Zaman | Olay | Kaynak | Önemi |
|---|---|---|---|
| 2026-08-15 | Semantik model yaşam döngüsü testi ve kuyruk kapısı eklendi | `a938df0` | Beklenen sözleşme `MODEL_LOADING → SEMANTIC_INTERPRETED` olarak tanımlandı. |
| 2026-08-22 | Tam test paketi `NOT_REQUIRED` ile durdu | `npm test` | Belge düzeni planının kapanmasını engelledi. |
| 2026-08-22 | Tekil test aynı hatayı yeniden üretti | `npm run story:conversation-semantic-model-test` | Hatanın deterministik olduğu doğrulandı. |
| 2026-08-22 | Açılış oturumu doğrudan incelendi | Harness seed `38103` | Yedek yanıtın kuyruğa girmeden önce `NOT_REQUIRED` ürettiği doğrulandı. |

# 4) Hypotheses (ranked)

## H1 — Deterministik yedek etiketi semantik kuyruk kararını kısa devre ediyor

- **If true, we would also see:** Analiz model gerektirirken yanıt kaynağı `DETERMINISTIC_GROUNDED_DISCOURSE_RESPONSE`, söylem hareketi `CLARIFY_UNKNOWN_WITHOUT_FAKE_CONTINUITY` ve durum `NOT_REQUIRED` olur.
- **Discriminating test:** Aynı seed ve metinle, LLM test köprüsü kurulduktan hemen sonra açılış oturumunu incelemek.
- **Status:** Supported. Gözlenen yanıt bu üç alanı da taşıyor; `js/StoryConversationUnderstanding.js:4414-4418` çağrıyı durum üzerinden atlıyor.

## H2 — Özellik bayrağı veya bağımlılığı semantik modeli kapatıyor

- **If true, we would also see:** `storyConversationSemanticFrameNeedsModel` çağrılsa bile false döner; ancak çağıran kod yanıt durumundan bağımsız kuyruğu denemiş olurdu.
- **Discriminating test:** Kampanyayı `characters.semanticModelInterpretation: true` ile başlatıp analiz sınıfını ve çağrı sırasını incelemek.
- **Status:** Refuted. Kampanya bayrakla başlatılıyor; daha önemlisi çağrı, özellik kontrolüne ulaşmadan `NOT_REQUIRED` kısa devresinde kesiliyor.

## H3 — LLM köprüsü hazır olmadığı için kuyruk başlayamıyor

- **If true, we would also see:** `storyConversationSessionQueueSemanticLLM` çağrılır ve köprü kontrolünde false döner.
- **Discriminating test:** `PIXEL.llm` test çiftini kurup yanıtın ilk durumunu ve üretim isteğini incelemek.
- **Status:** Refuted. Test çifti hazır olmasına rağmen kuyruk fonksiyonu çağrılmadan durum `NOT_REQUIRED`; köprü hazır oluşu karar zincirine ulaşmıyor.

# 5) Mechanism

1. `storyConversationAnalyze` girdiyi `UNKNOWN`, güveni `1100` olarak sınıflandırıyor.
2. `storyConversationSessionBuildSocialResponse`, bilinmeyen anlam için güvenli deterministik açıklama üretiyor ve grounded yanıtı `NOT_REQUIRED` işaretliyor (`js/StoryConversationUnderstanding.js:4163`).
3. `storyConversationSessionBegin`, semantik kuyruğu yalnız durum `NOT_REQUIRED` değilse çağırıyor (`js/StoryConversationUnderstanding.js:4414-4418`).
4. Böylece `storyConversationSemanticFrameNeedsModel` içindeki gerçek karar — `UNKNOWN` veya güven `<5200` — hiç çalışmıyor (`js/StoryConversationSemanticFrame.js:267-274`).
5. Takip turlarında aynı kısa devre `js/StoryConversationUnderstanding.js:4362-4365` üzerinde bulunuyor.

- **Root cause:** Sunum/yedek zenginleştirme durumunun model gereksinimi otoritesi olarak yeniden kullanılması.
- **Contributing factor:** `NOT_REQUIRED` hem “bu deterministik yanıt kendi başına güvenli” hem “semantik model gereksiz” anlamlarında kullanılıyor.
- **Detection failure:** Doğru regresyon testi mevcut fakat tam paket bu değişiklik zinciri kapanmadan önce yeşil kapı olarak uygulanmamış.
- **Weakest link:** İlk ürün regresyonunun hangi committe başladığı belirlenemedi; mekanizma ve mevcut hata bundan bağımsız olarak doğrudan kanıtlıdır.

# 6) Remediation Options

## Mitigation

- **Title:** Test girdisini başka bir belirsiz cümleyle değiştirmek
- **Category:** Mitigation
- **Severity:** Low
- **Confidence:** Confirmed
- **Location:** `tests/story-conversation-semantic-model.test.js:82-88`
- **Evidence:** Mevcut cümle model gerektirmesine rağmen çağıran durum kapısında kesiliyor.
- **Why it matters:** Testi geçirebilir fakat ürün hatasını gizler.
- **Recommended fix:** Uygulama; bu yalnız suppression olur.
- **Tradeoffs / Risks:** Yanlış yeşil test üretir.

## Fix

- **Title:** Semantik gereksinim kararını yanıt durumundan ayırmak
- **Category:** Fix
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** `js/StoryConversationUnderstanding.js:4362-4365`, `4414-4418`
- **Evidence:** Kuyruk fonksiyonu zaten özellik, risk ve güven koşullarını tek yerde değerlendiriyor.
- **Why it matters:** Güvenli deterministik yedek ekranda kalırken, bayrak açık ve anlam belirsizse semantik yorum başlayabilir.
- **Recommended fix:** İki çağrı yerinde `NOT_REQUIRED` önkoşulunu kaldır; sosyal serbest-metin kuyruğunun mevcut grounded korumasını değiştirme.
- **Tradeoffs / Risks:** Bayrak açık deneylerde daha fazla semantik model çağrısı olur; varsayılan bayrak kapalıdır.

## Prevention

- **Title:** Grounded UNKNOWN açılış ve takip turu yaşam döngülerini birlikte kapılamak
- **Category:** Prevention
- **Severity:** Low
- **Confidence:** Confirmed
- **Location:** `tests/story-conversation-semantic-model.test.js`
- **Evidence:** Mevcut test açılışı yakalıyor, aynı mekanizmanın takip turu dalı ayrıca bulunuyor.
- **Why it matters:** İki çağrı yerinin yeniden ayrışmasını önler.
- **Recommended fix:** Mevcut açılış assertionını koru; aynı oturumda belirsiz takip sözünün de `MODEL_LOADING → SEMANTIC_INTERPRETED` geçtiğini doğrula.
- **Tradeoffs / Risks:** Asenkron test süresini az miktarda artırır.

# 7) Verification Plan

- `npm run story:conversation-semantic-model-test` ile açılış yaşam döngüsünü doğrula.
- Takip turu için aynı düşük güvenli `UNKNOWN` sınıfında `MODEL_LOADING`, bekleme engeli ve son `SEMANTIC_INTERPRETED` durumunu doğrula.
- Ardından `npm test` çalıştır; belge düzeni planını yalnız tam paket yeşilse `Landed` yap.
- Tekrar belirtisi: model bayrağı açık ve düşük güvenli analizde ilk durumun yeniden `NOT_REQUIRED` olması veya üretim isteğinin hiç oluşmaması.
