# RCA — Mekanik konuşma oturumu sosyal cevap önceliğiyle alan incelemesini atlıyor

## 1) Verdict

- **Root cause:** `storyConversationSessionStatus`, `DETERMINISTIC_GROUNDED_DISCOURSE_RESPONSE` kaynaklı bir sosyal cevabı açık mekanik sorulardan ve mevcut alan incelemesinden önce değerlendiriyor.
- **Confidence:** Confirmed.
- **Zincir:** Karmaşık ekonomik teklif → bağlamlı söylem cevabı üretiliyor → durum erken `SOCIAL_RESPONSE_READY` oluyor → son açıklamadan sonra da aynı erken dönüş tekrarlanıyor → `storyConversationSessionApplyDomainReview` çağrılmıyor.
- Hata canlı üründe ve güncel prob çıktısında yeniden üretildi.

## 2) Failure Definition

- Beklenen: Altı açıklama tamamlandığında oturum `DOMAIN_REVIEW_NEEDS_EVIDENCE` durumuna geçmeli.
- Gerçekleşen: Oturum `SOCIAL_RESPONSE_READY` durumunda kalıyor.
- Reproduction: `conversationUnderstandingProbe` güncel kaynakla tek başına başarıyla üretildi; ardından sequential assertion aynı farkla deterministik düştü.
- Blast radius: Açık mekanik soruları veya domain check'leri bulunan fakat bağlamlı söylem cevabı da üretilen bütün görüşmeler.
- Kullanıcı etkisi: Karmaşık teklif günlük sohbet gibi ele alınabilir; kanıt, yetki ve uygulanabilirlik kapıları UI akışında atlanabilir.

## 3) Timeline

| Zaman | Olay | Kaynak | Önemi |
|---|---|---|---|
| 10 Ağustos 2026 | Mekanik soru ve alan incelemesi durum sırası eklendi | `10a81699` blame | Temel sözleşme doğru sırayı taşıyordu |
| 14 Ağustos 2026 | Bağlamlı söylem cevabı sosyal hazır koşuluna eklendi | `b9b7627b` blame | Yeni koşul mekanik kapıların önüne yerleşti |
| 23 Ağustos 2026 | Sequential test `SOCIAL_RESPONSE_READY` gördü | Assertion stack | Regresyon görünür oldu |
| 23 Ağustos 2026 | Prob güncel kaynakla yeniden üretildi | Tek görev koşusu | Bayat sonuç hipotezi elendi |

## 4) Hypotheses (ranked)

1. **Sosyal hazır kontrolü mekanik kapılardan önce erken dönüyor.**
   - Beklenti: Oturumda sosyal cevap, açık/yanıtlanmış mekanik sorular ve domain check aynı anda bulunmalı; durum fonksiyonu sosyal dalda dönmeli.
   - Ayırıcı test: Durum fonksiyonu sırasını ve güncel prob sonucunu birlikte incele.
   - **Supported:** Sosyal dal satır 2510–2515'te, açık soru ve domain review dallarından önce; güncel prob gerçek değeri `SOCIAL_RESPONSE_READY`.
2. **Korunmuş paralel sonuç bayat.**
   - Beklenti: Prob güncel kaynakla yeniden üretildiğinde hata kaybolmalı.
   - Ayırıcı test: Yalnız `conversationUnderstandingProbe` üretip korunmuş sonucu değiştirerek assertionı yeniden çalıştır.
   - **Refuted:** Yeni üretilen sonuç aynı hatayı verdi.
3. **`conversationSessionLatest` canlı nesne referansı döndürüyor ve sonraki görüşme eski ölçümü değiştiriyor.**
   - Beklenti: Fonksiyon ledger nesnesini doğrudan döndürmeli.
   - Ayırıcı test: Fonksiyon uygulamasını incele.
   - **Refuted:** Fonksiyon `storyConversationClone` ile bağımsız kopya döndürüyor.

## 5) Mechanism

1. Oturum analizi ekonomik teklif için mekanik sorular ve domain check'ler üretir.
2. Söylem katmanı aynı açılış için `SOCIAL_RESPONSE` türünde, kaynağı `DETERMINISTIC_GROUNDED_DISCOURSE_RESPONSE` olan bir cevap da ekler.
3. `storyConversationSessionStatus` çözümden hemen sonra bu sosyal cevabı kontrol eder.
4. Kontrol, açık sorulara bakmadan `SOCIAL_RESPONSE_READY` döndürür.
5. Her clarification yanıtında durum yeniden hesaplanır ve yine sosyal dalda erken döner.
6. Son yanıt sonrası yalnız `READY_FOR_DOMAIN_REVIEW` durumunda çağrılan alan incelemesi çalışmaz.
- **Root cause:** Durum makinesinde yanlış öncelik.
- **Contributing factor:** “Bağlamlı söylem cevabı”nın sosyal oturum kanıtı olarak aşırı geniş kabul edilmesi.
- **Detection failure:** Sosyal cevap ile mekanik soruların birlikte bulunduğu hibrit oturum için doğrudan öncelik testi yoktu; geniş prob bunu geç yakaladı.

## 6) Remediation Options

### Mitigation
- **Title:** Assertionı `SOCIAL_RESPONSE_READY` kabul edecek şekilde gevşet
- **Category:** Test
- **Severity:** Critical
- **Confidence:** Confirmed
- **Location:** `tests/story-world.test.js`
- **Evidence:** Gerçek durum bu değeri üretiyor.
- **Why it matters:** Testi yeşile çevirir fakat kanıt/yetki kapısının atlanmasını meşrulaştırır.
- **Recommended fix:** Uygulanmamalı.
- **Tradeoffs / Risks:** Mekanik görüşmeleri ucuz sohbet akışına indirger.

### Fix
- **Title:** Mekanik soruları ve mevcut alan incelemesini sosyal hazır dalından önce değerlendir
- **Category:** Durum makinesi
- **Severity:** High
- **Confidence:** Confirmed
- **Location:** `js/StoryConversationUnderstanding.js::storyConversationSessionStatus`
- **Evidence:** Eski temel sıra ve güncel prob beklenen sözleşmeyi aynı yönde gösteriyor.
- **Why it matters:** Bağlamlı doğal cevap korunurken mekanik teklifin kanıt/yetki akışı kaybolmaz.
- **Recommended fix:** Çözümden sonra sırasıyla açık soru, mevcut domain review, domain-check hazırlığı; yalnız mekanik kapı yoksa sosyal hazır durumu.
- **Tradeoffs / Risks:** Saf sosyal oturumlar etkilenmemeli; hibrit oturumlarda UI önce açıklama/inceleme gösterir.

### Prevention
- **Title:** Hibrit konuşma durum öncelik matrisi ekle
- **Category:** Test sözleşmesi
- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** Konuşma domain adapter veya understanding probu
- **Evidence:** Regresyon iki ayrı geçerli alt sistemin aynı oturumda birleşmesinden doğdu.
- **Why it matters:** Yeni cevap kaynağı eklenirken mekanik güvenlik kapılarının önüne geçilmesini engeller.
- **Recommended fix:** Açık soru + sosyal cevap, domain review + sosyal cevap ve saf sosyal cevap için ayrı durum beklentileri tut.
- **Tradeoffs / Risks:** Küçük ek fikstür maliyeti.

## 7) Verification Plan

- Güncel `conversationUnderstandingProbe` yeniden üretildiğinde tamamlanan durum `DOMAIN_REVIEW_NEEDS_EVIDENCE` olmalı.
- Aynı probda `domainReviewCreated`, dünya nötrlüğü, ActorBelief sınırı ve ham ledger yalıtımı geçmeli.
- Günlük sosyal görüşme probları `SOCIAL_RESPONSE_READY` üretmeye devam etmeli.
- On doğrudan senaryo laboratuvarı ve on güvenli fallback assertionı geçmeli.
- Korunmuş sonuç setiyle sequential assertion zinciri bu bölümü aşmalı.
- Son temiz `npm test -- --keep-results` sıfır çıkış koduyla tamamlanmalı.
