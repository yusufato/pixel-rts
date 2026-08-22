# 1) Verdict

- **Root cause:** Bir oyuncu cümlesi hem ortak sözü hem ortak sırrı açıkça geri çağırdığında `storyConversationMemoryIntent`, bileşik isteği yalnız `SECRET` türüne indiriyor.
- **Confidence:** Confirmed.
- **Chain:** Metinde söz + sır var → `secretRecall=true` → ilk öncelik dalı `kinds=['SECRET']` seçiyor → sahiplik-korumalı recall doğru söz kaydını filtreliyor → context pack söz hafızasını içeremiyor.
- Hata devam ediyor; tam pakette ve tekil `conversationContextPackProbe` görevinde yeniden üretildi.

# 2) Failure Definition

- Kesin belirti: `conversationContextPackProbe` sonucu `canonicalPromiseIncluded=false`; diğer bağlam paketi sözleşmeleri aynı koşuda geçiyor.
- Yeniden üretim: `node tools/story-test-parallel.js --task conversationContextPackProbe --workers 1`; 1/1 başarısız.
- Etki alanı: Aynı cümlede birden fazla kalıcı hafıza türünü soran oyuncu konuşmaları; özellikle söz + sır bileşimi.
- İlk oluşum kesin değil. Bağlam paketi probu `5f53935` ile eklendi; seçicinin tür önceliği onunla uyumsuz.

# 3) Timeline

| Zaman | Olay | Kaynak | Önemi |
|---|---|---|---|
| 2026-08-13 | Kanonik söz + ortak sır bağlam paketi probu eklendi | `5f53935` | Bileşik hafıza beklentisi sözleşmeye girdi. |
| 2026-08-22 | Tam paket 48/88 sonrasında bağlam paketinde durdu | `npm test` | Dokümantasyon planı kapanışı yeniden engellendi. |
| 2026-08-22 | Tekil prob aynı sonucu verdi | `--task conversationContextPackProbe --workers 1` | Paralellik dışlandı. |
| 2026-08-22 | Çalışma zamanı çıktısı yalnız iki SECRET kaydı gösterdi | İzole `createRuntime(2032)` koşusu | PROMISE kaydının depoda olduğu halde filtreye alınmadığı kanıtlandı. |

# 4) Hypotheses (ranked)

## H1 — Hafıza niyeti bileşik türleri korumuyor

- **If true, we would also see:** Söz ve ortak sır başarıyla kaydedilir; yanıttaki `memoryRecall.records` yalnız SECRET olur ve pack içinde PROMISE bulunmaz.
- **Discriminating test:** Seed 2032 senaryosunda kayıt uygulama sonuçlarını, analiz çıktısını, recall kayıtlarını ve MEMORY bölümlerini birlikte yazdırmak.
- **Status:** Supported. Her iki kayıt `applied=true`; recall ve pack yalnız ortak SECRET milestone ile onun RECENT izdüşümünü içeriyor.

## H2 — Söz kaydının sahiplik veya ilişki alanları geçersiz

- **If true, we would also see:** `storyMemoryAddMilestone` söz kaydını reddeder veya ilişki filtresi onu oyuncuyla ilgisiz sayar.
- **Discriminating test:** Kayıt uygulama sonucunu ve prob girdisindeki holder/related kimliklerini kontrol etmek.
- **Status:** Refuted. Söz `applied=true`; dinleyici ile oyuncu holder, oyuncu ayrıca related actor.

## H3 — Token bütçesi düşük öncelikli sözü düşürüyor

- **If true, we would also see:** Recall söz kaydını içerir fakat derlenmiş pack `dropped` listesine taşır.
- **Discriminating test:** Recall ile derlenmiş MEMORY kimliklerini karşılaştırmak.
- **Status:** Refuted. Söz recall aşamasına hiç girmiyor; PROMISE/SECRET bölümleri ayrıca korumalı ve aynı 92 önceliğinde.

## H4 — Paralel worker paylaşılmış durum üretiyor

- **If true, we would also see:** Tek görev/tek worker koşusunda sonuç düzelir.
- **Discriminating test:** `--task conversationContextPackProbe --workers 1`.
- **Status:** Refuted. Tek worker koşusu deterministik biçimde aynı assertion ile başarısız.

# 5) Mechanism

1. `storyConversationMemoryIntent` cümlede hem `promise` hem `secretRecall` sinyallerini doğru buluyor (`js/StoryConversationUnderstanding.js:4193-4210`).
2. Tür seçimi ilk olarak `secretRecall` kontrol ediyor ve sonucu yalnız `['SECRET']` yapıyor (`js/StoryConversationUnderstanding.js:4229-4231`).
3. `storyConversationSocialMemoryRecall`, bu dar tür listesini sahiplik-korumalı recall kapısına gönderiyor (`js/StoryConversationUnderstanding.js:4241-4249`).
4. Recall doğru biçimde yalnız ortak SECRET kayıtlarını döndürüyor; yabancı sır dışarıda kalıyor.
5. Context pack yalnız açık recall kayıtlarını ve aynı dar niyetten türetilen obligation recall kayıtlarını birleştirdiği için PROMISE bölümü oluşmuyor (`js/StoryConversationUnderstanding.js:3261-3277`).

- **Root cause:** Hafıza niyet çözümleyicisinin birbirini dışlamayan sinyalleri öncelik zinciriyle birbirini dışlayan tek bir kategoriye çevirmesi.
- **Contributing factor:** Gizlilik sızıntısını önlemeye yönelik SECRET önceliği, bileşik isteklerde ek türleri korumuyor.
- **Detection failure:** Uzun paralel pakette bu görev, daha erken semantik ve raster hataları düzeltilene kadar çalışmadı.
- **Weakest link:** İlk başarısız commit bisect edilmedi; mevcut mekanizma çalışma zamanı kayıtlarıyla doğrudan kanıtlandı.

# 6) Remediation Options

## Mitigation

- **Title:** Bağlam paketi derleyicisinde PROMISE için ikinci bağımsız recall yapmak
- **Category:** Mitigation
- **Severity:** Medium
- **Confidence:** Likely
- **Location:** `js/StoryConversationUnderstanding.js:3261-3271`
- **Evidence:** Eksik sözü bu tek bağlam paketine geri getirir.
- **Why it matters:** Testi geçirir fakat karakter yanıtının ilk recall metni hâlâ sözü unutmuş görünür.
- **Recommended fix:** Uygulama; niyet hatasını aşağı katmanda maskeleyen çift davranış yaratır.
- **Tradeoffs / Risks:** UI yanıtı ve LLM bağlamı farklı hafıza görür.

## Fix

- **Title:** Açık hafıza sinyallerini birleşik tür kümesine dönüştürmek
- **Category:** Fix
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** `js/StoryConversationUnderstanding.js:4193-4238`
- **Evidence:** Aynı cümlede hem promise hem secret sinyali mevcut; recall kapısı tür dizisini zaten destekliyor ve sahiplik filtresi yabancı sırrı engelliyor.
- **Why it matters:** Karakter yanıtı ile LLM context pack aynı kanonik hafızaları görür.
- **Recommended fix:** SECRET güvenlik filtresini koruyarak tespit edilen PROMISE/DEBT/DECISION türlerini aynı kümeye ekle; genel recall fallback’ini değiştirme.
- **Tradeoffs / Risks:** Daha çok kayıt recall limitini tüketebilir; sıralama milestone önemi ve zamanla deterministik kalır.

## Prevention

- **Title:** Bileşik ve yabancı-gizli hafıza regresyonunu birlikte kapılamak
- **Category:** Prevention
- **Severity:** Low
- **Confidence:** Confirmed
- **Location:** `tests/story-world.test.js` / `conversationContextPackProbe`
- **Evidence:** Mevcut prob hem ortak söz+sır kapsamını hem yabancı sır dışlamasını aynı senaryoda ölçüyor.
- **Why it matters:** Bileşik recall genişletilirken gizlilik sınırı gevşetilemez.
- **Recommended fix:** Mevcut assertionları koru; gerekirse recall türlerini doğrudan sınayan küçük bir test ekle.
- **Tradeoffs / Risks:** Yok.

# 7) Verification Plan

- `node tools/story-test-parallel.js --task conversationContextPackProbe --workers 1` başarıyla bitmeli.
- Pack hem `context:memory:context-probe:promise` hem `context:memory:context-probe:secret:shared` içermeli.
- Pack `context-probe:secret:foreign` kimliğini veya özetini içermemeli.
- Doğrudan çalışma zamanı çıktısında `response.memoryRecall.records` PROMISE ve ortak SECRET türlerini göstermeli.
- Son olarak `npm test` baştan sona geçmeli.
- Tekrar belirtisi: bileşik hafıza sorusunda türlerden birinin kaybolması veya yabancı sır içeriğinin görünmesi.
